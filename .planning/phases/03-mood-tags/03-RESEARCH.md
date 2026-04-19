# Phase 3: Mood Tags - Research

**Researched:** 2026-04-19
**Domain:** Vanilla JS / Firestore real-time sync / inline UI editing in a single-file PWA
**Confidence:** HIGH — all findings verified directly against index.html source code and Firestore import line

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Mood tags live in the existing shared `title.moods: string[]` Firestore field. No per-member tagging structure needed.
- **D-02:** Any family member can add or remove any mood on any title — no ownership restriction.
- **D-03:** Auto-suggested moods and user-added moods are stored identically in `moods[]`. No distinction in storage or display.
- **D-04:** The mood section lives below the genre pills, above the overview — inline with other title metadata.
- **D-05:** Chips are always-editable — no separate read/edit mode toggle. Existing chips tap-to-remove. "+" or empty-state prompt reveals the full MOODS palette inline. No modal, no toggle.
- **D-06:** All mood chips render identically regardless of origin.
- **D-07:** When one or more moods are active in the filter, the selected mood chips appear inline as a second row below the "Mood" filter toggle — outside the collapsible panel.
- **D-08:** Each inline active-mood chip has an × button to remove that individual mood without opening the panel.
- **D-09:** The existing count badge on the "Mood" toggle pill stays as-is. The inline row is the primary clearability surface.

### Claude's Discretion

- Exact styling of the inline active-mood chips (size, padding, font) — follow existing `.mood-chip` pattern from Tonight filter.
- Whether the "+" entry point in the detail view is a chip-shaped affordance or a subtle icon.
- Empty-state copy for when a title has no moods yet.
- Whether removing the last mood from a title via the detail view re-runs `suggestMoods()` to repopulate, or leaves it empty.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MOOD-01 | User can view automatically-suggested moods on a title | `suggestMoods()` already runs during `autoBackfill()` and writes to `title.moods[]`. Detail view needs only to render `t.moods`. |
| MOOD-02 | User can add a personal mood tag to a title from the detail view | Requires new `addDetailMood(titleId, moodId)` function using `updateDoc` + full-array write (see §Firestore Write Strategy). |
| MOOD-03 | User can remove a personal mood tag they previously added | Requires new `removeDetailMood(titleId, moodId)` function using `updateDoc` + full-array write. |
| MOOD-04 | Mood tags added by any member are visible to all members on that title | Already satisfied by Firestore real-time listener + `state.titles` — no new work beyond confirming re-render triggers. |
| MOOD-05 | Tonight screen shows a mood filter control in the filter bar | Already exists (`renderMoodFilter()` + `#mood-filter-tonight` inside `#t-filter-body`). No new control needed — only the active-row (MOOD-07) is new. |
| MOOD-06 | Selecting moods narrows the candidate pool for the spin | Already implemented in `passesBaseFilter()` via `state.selectedMoods`. No changes needed. |
| MOOD-07 | Active mood filters are visible and easily clearable without opening the filter panel | Requires new `#t-mood-active-row` div + `.t-mood-active-row` CSS + `updateFiltersBar()` extension. |
</phase_requirements>

---

## Summary

Phase 3 is a **mostly-additive UI phase** against a stable, well-understood codebase. The infrastructure — mood data model, `suggestMoods()`, `MOODS[]` constant, `moodById()`, `.mood-chip` CSS, `renderMoodFilter()`, `toggleMood()`, and `passesBaseFilter()` — already exists and is correct. Context.md is accurate about what is and isn't done.

Two UI surfaces need to be built from scratch: (1) the mood editing section inside `renderDetailShell()`, and (2) the active-filter inline row below the Tonight filter toggle. Both are pure DOM/CSS work wired to existing Firestore update patterns. No new external dependencies, no TMDB calls, no schema migrations.

The most consequential technical detail is that **`arrayRemove` is not imported** in the current Firestore import line (line 2696). The existing codebase handles mood writes by replacing the full `moods` array (`updateDoc(ref, { moods: [...] })`), not using atomic `arrayUnion`/`arrayRemove`. The planner must decide: stay with full-array writes (simpler, no import change needed) or add `arrayRemove` to the import (more semantically correct for concurrent edits, small import change). This is the only non-trivial decision the planner must resolve.

A secondary finding: the UI-SPEC (already approved) specifies a mood picker palette that renders inline beneath the existing chips when "+" is tapped. The detail view re-render pattern (`renderDetailShell` called with merged state) is the correct approach — no in-place DOM surgery needed.

**Primary recommendation:** Use full-array writes for mood add/remove (consistent with existing `saveEditTitle` and `autoBackfill` patterns). Add palette open/close state as a module-level variable (`let detailMoodPaletteOpen = false`), mirroring how `detailTitleId` is managed. Extend `updateFiltersBar()` for the active-mood inline row.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Display moods on title (MOOD-01) | Browser / Client | — | Pure render — `t.moods[]` already in `state.titles`; just HTML generation in `renderDetailShell()` |
| Add/remove mood on title (MOOD-02/03) | Browser / Client → Firestore | — | Client writes to Firestore; real-time listener propagates back to all clients |
| Real-time cross-device visibility (MOOD-04) | Firestore → Browser | — | Firestore `onSnapshot` already subscribed to `titlesRef()`; no new listener needed |
| Tonight mood filter control (MOOD-05) | Browser / Client | — | Already exists; no tier change needed |
| Mood-filtered spin candidate pool (MOOD-06) | Browser / Client | — | Already implemented in `passesBaseFilter()` |
| Active-filter inline row with × clear (MOOD-07) | Browser / Client | — | DOM + CSS addition to `updateFiltersBar()` and Tonight HTML |

---

## Standard Stack

### Core (all already present in index.html)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase Firestore JS SDK | 10.12.0 | Real-time title data sync | Already imported — line 2696 |
| Vanilla JS (ES modules) | Native | All application logic | Single-file architecture constraint |
| Vanilla CSS (custom properties) | Native | Design system | All tokens defined in `:root` block |

### No New Libraries Needed

This phase requires zero new npm packages, CDN imports, or external dependencies. All building blocks exist in the codebase.

**Installation:** None required.

---

## Architecture Patterns

### System Architecture Diagram

```
User taps mood chip (detail view)
        |
        v
removeDetailMood(titleId, moodId)
        |
        +-- Optimistic local update: state.titles[i].moods = filtered array
        |         |
        |         v
        |   re-render detail modal content (renderDetailShell with merged t)
        |
        +-- Firestore write: updateDoc(doc(titlesRef(), titleId), { moods: newArray })
                  |
                  v
           Firestore real-time listener (onSnapshot on titlesRef())
                  |
                  v
           state.titles updated on ALL family devices
                  |
                  v
           renderTonight() → renderMoodFilter() + updateFiltersBar()
                  (active-mood row re-renders on all devices if filter was active)


User taps "+" in detail view
        |
        v
detailMoodPaletteOpen = true  →  renderDetailShell(t) re-called with palette flag
        |                            (shows palette row of unselected MOODS)
        v
User taps palette chip
        |
        v
addDetailMood(titleId, moodId)
        |
        +-- Optimistic local update
        +-- Firestore write
        +-- detailMoodPaletteOpen = false
        +-- re-render detail content


User taps × on active-mood chip (Tonight row)
        |
        v
removeMoodFilter(moodId)
        |
        +-- state.selectedMoods = filtered array
        +-- renderTonight() → updateFiltersBar() re-renders inline row
```

### Recommended Project Structure

This phase adds code to existing sections of `index.html`:

```
index.html
├── CSS block (~line 624)        Add: .detail-moods, .t-mood-active-row, .mood-chip-remove
├── HTML block (~line 2024)      Add: <div id="t-mood-active-row"> after .t-filters, before .t-section
├── renderDetailShell (~line 7022)  Extend: add moodsHtml between .detail-genres and .detail-overview
├── updateFiltersBar (~line 5044)   Extend: render active-mood inline row into #t-mood-active-row
└── Mood tags section (~line 2914)  Add: addDetailMood(), removeDetailMood(), removeMoodFilter(),
                                         detailMoodPaletteOpen state var, openDetailMoodPalette()
```

### Pattern 1: Full-Array Mood Write (existing pattern — use this)

**What:** Read current moods from `state.titles`, compute new array, write full array to Firestore.
**When to use:** For both add and remove operations. Consistent with `saveEditTitle` and `autoBackfill` patterns.

```javascript
// Source: verified against index.html line 8050-8056 (saveEditTitle) and line 6012 (autoBackfill)
// ADD mood to title
window.addDetailMood = async function(titleId, moodId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const current = Array.isArray(t.moods) ? t.moods : [];
  if (current.includes(moodId)) return; // idempotent
  const newMoods = [...current, moodId];
  // Optimistic local update
  t.moods = newMoods;
  if (detailTitleId === titleId) {
    document.getElementById('detail-modal-content').innerHTML = renderDetailShell(t);
  }
  haptic('light');
  try { await updateDoc(doc(titlesRef(), titleId), { moods: newMoods }); } catch(e) { console.error(e); }
};

// REMOVE mood from title
window.removeDetailMood = async function(titleId, moodId) {
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const current = Array.isArray(t.moods) ? t.moods : [];
  const newMoods = current.filter(m => m !== moodId);
  // Optimistic local update
  t.moods = newMoods;
  if (detailTitleId === titleId) {
    document.getElementById('detail-modal-content').innerHTML = renderDetailShell(t);
  }
  haptic('light');
  try { await updateDoc(doc(titlesRef(), titleId), { moods: newMoods }); } catch(e) { console.error(e); }
};
```

### Pattern 2: Palette Open/Close State

**What:** Module-level boolean to track whether the mood picker palette is expanded in the detail view.
**When to use:** Palette state lives at module scope (not in `state`) because it is ephemeral UI — it doesn't need to survive re-renders from Firestore updates. Mirrored after `detailTitleId` (line 6987).

```javascript
// Source: mirrors detailTitleId pattern at line 6987
let detailMoodPaletteOpen = false;

window.openDetailMoodPalette = function() {
  detailMoodPaletteOpen = true;
  // Re-render detail content with palette visible
  const t = state.titles.find(x => x.id === detailTitleId);
  if (t) document.getElementById('detail-modal-content').innerHTML = renderDetailShell(t);
};

window.closeDetailMoodPalette = function() {
  detailMoodPaletteOpen = false;
  const t = state.titles.find(x => x.id === detailTitleId);
  if (t) document.getElementById('detail-modal-content').innerHTML = renderDetailShell(t);
};
```

### Pattern 3: Mood Section in renderDetailShell

**What:** HTML snippet for the mood section, inserted between `.detail-genres` and `.detail-overview`.
**When to use:** Called inside `renderDetailShell(t)` as a template string variable.

```javascript
// Source: verified against renderDetailShell structure at line 7065-7083,
//         UI-SPEC §"Detail View — Mood Section", CONTEXT.md D-04/D-05/D-06
function renderDetailMoodsSection(t) {
  const existingMoods = Array.isArray(t.moods) ? t.moods : [];
  const moodChips = existingMoods.map(id => {
    const m = moodById(id);
    if (!m) return '';
    return `<button class="mood-chip" onclick="removeDetailMood('${t.id}','${id}')" title="Remove ${escapeHtml(m.label)}">
      <span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}
    </button>`;
  }).join('');

  const addChip = `<button class="mood-chip mood-chip--add ${detailMoodPaletteOpen ? 'mood-chip--add-active' : ''}"
    onclick="${detailMoodPaletteOpen ? 'closeDetailMoodPalette' : 'openDetailMoodPalette'}()">
    + add mood
  </button>`;

  const paletteChips = detailMoodPaletteOpen
    ? MOODS.filter(m => !existingMoods.includes(m.id)).map(m =>
        `<button class="mood-chip mood-chip--palette" onclick="addDetailMood('${t.id}','${m.id}')">
          <span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}
        </button>`
      ).join('')
    : '';

  const paletteRow = paletteChips
    ? `<div class="detail-moods-palette">${paletteChips}</div>`
    : '';

  return `<div class="detail-section detail-moods-section">
    <h4>Moods</h4>
    <div class="detail-moods">
      ${existingMoods.length ? moodChips : ''}
      ${addChip}
    </div>
    ${paletteRow}
  </div>`;
}
```

### Pattern 4: Active-Mood Inline Row (Tonight)

**What:** Extend `updateFiltersBar()` to render/clear the inline active-mood row below the filter toggle.
**When to use:** Called inside `updateFiltersBar()` after existing badge logic.

```javascript
// Source: mirrors renderMoodFilter() pattern at line 4873-4894;
//         UI-SPEC §"Tonight Filter Bar — Active Mood Inline Row"; CONTEXT.md D-07/D-08/D-09
// Extend updateFiltersBar() — add after line 5067:
const activeRow = document.getElementById('t-mood-active-row');
if (activeRow) {
  if (state.selectedMoods.length > 0) {
    activeRow.innerHTML = state.selectedMoods.map(id => {
      const m = moodById(id);
      if (!m) return '';
      return `<button class="mood-chip on" aria-label="${escapeHtml(m.label)}">
        <span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}
        <button class="mood-chip-remove" onclick="removeMoodFilter('${id}')"
          aria-label="Remove ${escapeHtml(m.label)}">×</button>
      </button>`;
    }).join('');
    activeRow.style.display = '';
  } else {
    activeRow.innerHTML = '';
    activeRow.style.display = 'none';
  }
}

// New function — remove a single mood from Tonight filter:
window.removeMoodFilter = function(id) {
  haptic('light');
  state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  renderTonight();
};
```

### Anti-Patterns to Avoid

- **Using `arrayUnion`/`arrayRemove` Firestore operators:** `arrayRemove` is NOT in the current import (line 2696 only has `arrayUnion`). Adding it would require touching the import line. Full-array writes (`{ moods: newArray }`) are the existing pattern for mood updates and are simpler. Use that. [VERIFIED: index.html line 2696]
- **Re-triggering `suggestMoods()` after user removes a mood:** The decision (Claude's Discretion) leaves this open, but the safest default is "leave empty" — re-running `suggestMoods` would silently override a user's intentional removal. Planner should confirm and default to no-rerun.
- **Putting `detailMoodPaletteOpen` inside `state`:** It's ephemeral UI state, not persistent. Use module-level `let`, not `state.*`.
- **In-place DOM patching inside the detail modal:** The codebase pattern is always full re-render: `content.innerHTML = renderDetailShell(merged)`. Don't diverge from this.
- **Adding mood-chip-remove as a child `<button>` inside a `<button>`:** HTML spec disallows nested buttons. The × remove control inside the active-mood chip must be implemented via a `<span role="button">` or by restructuring the outer chip as a `<div>` for the active-row case. See §Pitfall 2.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Real-time cross-device sync after mood write | Custom polling or broadcast | Existing Firestore `onSnapshot` on `titlesRef()` | Already wired — writes propagate automatically |
| Mood-filtered spin logic | New filter function | Existing `passesBaseFilter()` at line 4943 | Already checks `state.selectedMoods` — zero changes needed |
| Available-moods-in-library computation | New scan | Existing `renderMoodFilter()` logic at line 4876-4882 | Already computes `available` set from `state.titles` |
| Mood add/remove concurrency | Optimistic lock / version field | Firestore last-write-wins on array field | Per D-02 there is no ownership; last write wins is correct behavior |

**Key insight:** MOOD-04, MOOD-05, and MOOD-06 are already implemented. Only MOOD-01 (render in detail view), MOOD-02/03 (inline editing), and MOOD-07 (active-filter row) require new code.

---

## Common Pitfalls

### Pitfall 1: Palette Dismiss on Outside Click
**What goes wrong:** The UI-SPEC requires "tap outside palette to dismiss." In a single-page app with inline elements (not a modal), a `document` click listener risks triggering immediately (same event bubble) or firing on unrelated taps.
**Why it happens:** `addEventListener('click', handler)` added during palette open will catch the originating click on the "+" button if not handled carefully.
**How to avoid:** Use `setTimeout(..., 0)` to defer the document listener registration so it doesn't catch the same event that opened the palette. Check `e.target.closest('.detail-moods-section')` to allow clicks within the palette. Remove the listener in `closeDetailMoodPalette()`.
**Warning signs:** Palette opens and closes immediately; palette closes when tapping chips inside it.

### Pitfall 2: Nested Button HTML
**What goes wrong:** The active-mood chip with × button looks like `<button class="mood-chip on"><button class="mood-chip-remove">×</button></button>`. This is invalid HTML (buttons cannot contain interactive elements per spec) and breaks in Safari.
**Why it happens:** Copying the `.mood-chip` button pattern and adding a child button naively.
**How to avoid:** Two options: (a) Use `<div class="mood-chip on" role="presentation">` as the outer wrapper with `<span role="button">` for the label area and `<button>` for the × only. (b) Structure the chip as a single `<button>` that fires the × action, with the × glyph styled inside — but then the chip label area can't be a separate touch target. Option (a) is what the UI-SPEC describes ("`.mood-chip.on` with an appended `<button class="mood-chip-remove">` inside it") — acceptable in modern browsers when the outer chip is not itself a `<button>`.
**Warning signs:** Console warning "interactive content not allowed here"; Safari treats taps unexpectedly.

### Pitfall 3: Detail Modal Re-render Dropping Scroll Position
**What goes wrong:** `content.innerHTML = renderDetailShell(t)` replaces the entire modal content, scrolling the modal back to top every time a mood is added or removed.
**Why it happens:** Full innerHTML replacement is the existing pattern; it works fine for infrequent operations (detail open, TMDB backfill). Mood edits may happen mid-scroll.
**How to avoid:** Capture `content.scrollTop` before re-render and restore it after. One line before and after the innerHTML assignment.
**Warning signs:** Detail modal jumps to top after tapping a mood chip.

### Pitfall 4: Active-Mood Row Flicker on renderTonight
**What goes wrong:** `renderTonight()` calls `updateFiltersBar()` which re-renders `#t-mood-active-row`. If `renderTonight` is called frequently (e.g., during member selection), the row flickers.
**Why it happens:** Setting `innerHTML` on every render even when content is identical triggers layout.
**How to avoid:** Compare the new rendered HTML to `activeRow.innerHTML` before assigning, or track `state.selectedMoods` identity — only update when the array reference changes.
**Warning signs:** Chips flash briefly during Tonight screen interactions unrelated to mood.

### Pitfall 5: Firestore Write on Empty Moods Array
**What goes wrong:** Removing the last mood writes `{ moods: [] }` to Firestore. On next `autoBackfill()`, the title passes the `!Array.isArray(t.moods) || t.moods.length === 0` check and gets re-suggestMoods'd, overwriting the user's intentional empty state.
**Why it happens:** `autoBackfill` runs `needsMoods = state.titles.filter(t => !Array.isArray(t.moods) || t.moods.length === 0)` (line 6007).
**How to avoid:** Write a sentinel value when user explicitly empties moods, such as `{ moods: ['__user_cleared'] }`, OR add a `moodsUserEdited: true` flag to prevent backfill re-running. Simplest option: add `moodsUserEdited: true` to the Firestore write when user removes a mood, and check it in `autoBackfill()`.
**Warning signs:** Users remove moods, but they reappear after the next backfill cycle (4 seconds after boot per line 4578-4579).

---

## Code Examples

### Existing mood chip CSS (verified)
```css
/* Source: index.html line 628-638 */
.mood-chip{display:inline-flex;align-items:center;gap:var(--s2);
  padding:var(--s2) var(--s4);background:var(--surface);
  border:1px solid var(--border-mid);border-radius:var(--r-pill);
  cursor:pointer;font-family:inherit;color:var(--ink-warm);font-size:var(--t-meta);
  flex-shrink:0;white-space:nowrap;font-weight:500;
  transition:all var(--t-quick)}
.mood-chip:hover{border-color:var(--border-strong);color:var(--ink)}
.mood-chip.on{background:var(--accent);color:var(--bg);border-color:transparent;
  font-weight:600;box-shadow:var(--shadow-warm)}
.mood-chip .mood-icon{font-size:var(--t-body);line-height:1}
```

### New CSS to add (detail-moods section and active-row)
```css
/* Source: derived from UI-SPEC §Component Inventory + existing token usage */

/* Detail view mood section container */
.detail-moods {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-bottom: var(--s4);
}

/* Add-mood affordance chip (dashed, empty-looking) */
.mood-chip--add {
  border-style: dashed;
  border-color: var(--border-strong);
  background: transparent;
  color: var(--ink-dim);
}
.mood-chip--add:hover {
  border-color: var(--accent);
  color: var(--ink);
}
.mood-chip--add-active {
  border-color: var(--accent);
  color: var(--accent);
}

/* Palette row chips (distinguished from existing-mood chips) */
.detail-moods-palette {
  display: flex;
  flex-wrap: wrap;
  gap: var(--s2);
  margin-top: var(--s2);
}
.mood-chip--palette {
  background: var(--surface-2);
}

/* Tonight active-mood inline row */
.t-mood-active-row {
  display: flex;
  gap: var(--s2);
  flex-wrap: wrap;
  padding: var(--s2) 0 var(--s1);
}

/* × remove button inside active-mood chip */
.mood-chip-remove {
  background: transparent;
  border: none;
  color: var(--bg);
  font-size: var(--t-meta);
  font-weight: 500;
  cursor: pointer;
  padding: 0 0 0 var(--s1);
  line-height: 1;
  opacity: 0.75;
  min-width: 24px;     /* part of 36px tap target via surrounding chip padding */
  min-height: 24px;
}
.mood-chip-remove:hover { opacity: 1; }
```

### Tonight HTML — new active row (insert after .t-filters div, before .t-section)
```html
<!-- Source: CONTEXT.md D-07; UI-SPEC §"Tonight Filter Bar — Active Mood Inline Row" -->
<!-- Insert between lines 2040 and 2042 of index.html -->
<div class="t-mood-active-row" id="t-mood-active-row"
     aria-label="Active mood filters" style="display:none;"></div>
```

### renderDetailShell insertion point (verified against line 7065-7083)
```javascript
// Source: index.html line 7065-7083 — renderDetailShell return template
// Insert moodsHtml variable before the return statement:
const moodsHtml = renderDetailMoodsSection(t);

// In the template string, replace:
//   <div class="detail-genres">${genresHtml}</div>
//   <div class="detail-overview">...
// With:
//   <div class="detail-genres">${genresHtml}</div>
//   ${moodsHtml}
//   <div class="detail-overview">...
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Mood editing only via Edit Title modal | Inline editing in detail view | Phase 3 (this phase) | Users can manage moods without leaving the detail view |
| Active mood filter requires opening panel | Active-mood chips visible below toggle | Phase 3 (this phase) | One-tap mood removal without panel interaction |

**Nothing deprecated by this phase.** Existing `toggleMood()`, `clearMoodFilter()`, `renderMoodFilter()` remain unchanged and continue to work in the collapsible panel.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Removing the last mood from a title via the detail view should NOT re-run `suggestMoods()` — leave moods empty until next `autoBackfill()` which WILL repopulate | Pitfall 5 / Claude's Discretion | If Nahder wants "no moods stays empty", the `moodsUserEdited` sentinel approach is needed; otherwise backfill silently restores moods |
| A2 | The outer wrapper of the active-mood chip with × is a `<div>` (not `<button>`) to avoid nested-button HTML invalidity | Pitfall 2 / Code Examples | Negligible: both approaches work in modern browsers; Safari behavior for nested buttons can be erratic |

**Note on A1:** This is the only open behavior decision the planner needs to make explicit.

---

## Open Questions

1. **Should removing the last mood from a title prevent `autoBackfill` from re-suggestMoods?**
   - What we know: `autoBackfill` runs on boot and checks `t.moods.length === 0` (line 6007). An explicit user empty would be overwritten on next load.
   - What's unclear: Is it acceptable for `suggestMoods` to "restore" moods after a user clears them all? Or should user intent be preserved?
   - Recommendation: Add `moodsUserEdited: true` flag written alongside the mood update when user removes a mood via detail view. Check this flag in `autoBackfill` to skip the title. This requires one extra field in the Firestore write but no schema migration.

---

## Environment Availability

Step 2.6: SKIPPED — this phase is pure code/CSS changes to `index.html` with no new external dependencies. Firestore SDK (10.12.0) and all other required services are already active.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None detected — no test config files, no test directories, no package.json |
| Config file | None |
| Quick run command | Manual browser testing on couchtonight.app or local file serve |
| Full suite command | Manual end-to-end walkthrough per success criteria |

No automated test infrastructure exists in this project (single-file vanilla HTML, no build step). All validation is manual.

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MOOD-01 | Title with moods shows them in detail view | manual smoke | — | ❌ no test infra |
| MOOD-02 | Member can add a mood from detail view | manual integration | — | ❌ no test infra |
| MOOD-03 | Member can remove a mood from detail view | manual integration | — | ❌ no test infra |
| MOOD-04 | Added mood appears on second device within 2s | manual real-time | — | ❌ no test infra |
| MOOD-05 | Tonight filter bar shows mood control | manual smoke | — | ❌ no test infra |
| MOOD-06 | Active mood filters narrow spin pool | manual integration | — | ❌ no test infra |
| MOOD-07 | Active mood chips visible + clearable outside panel | manual smoke | — | ❌ no test infra |

### Sampling Rate
- **Per task:** Open index.html in browser, exercise the changed surface
- **Per wave:** Full walkthrough of all 5 success criteria from CONTEXT.md
- **Phase gate:** All 5 success criteria pass before `/gsd-verify-work`

### Wave 0 Gaps
None — no test framework to install. All validation is manual per the project's established pattern.

---

## Security Domain

Security enforcement is enabled (no explicit `false` in config). However, this phase introduces no new attack surfaces:

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Not affected — mood edits are family-scoped, no auth changes |
| V3 Session Management | No | No session changes |
| V4 Access Control | Minimal | D-02 explicitly allows any family member to edit any mood — no access control needed |
| V5 Input Validation | Yes | `moodId` values must come from `MOODS[]` constant only — never free text. Validate with `moodById(id) !== undefined` before any Firestore write. |
| V6 Cryptography | No | No new secrets or crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Arbitrary string injected into `moods[]` via modified onclick | Tampering | Validate `moodById(moodId)` returns non-null before write; `moodId` values are hardcoded in HTML from `MOODS[]` constant, not from user text input |
| XSS via mood label rendered without escaping | Tampering | All mood labels come from `MOODS[]` constant (trusted), but use `escapeHtml(m.label)` in all HTML templates as a habit — already done in existing `renderMoodFilter()` code |

---

## Sources

### Primary (HIGH confidence)
- `index.html` (direct read) — all functional claims verified against source: MOODS constant (line 2914), mood CSS (line 624-640), renderMoodFilter (line 4873), toggleMood/clearMoodFilter (line 4897-4910), passesBaseFilter (line 4943-4953), updateFiltersBar (line 5044-5067), renderDetailShell (line 7022-7083), autoBackfill (line 6001-6040), saveEditTitle mood pattern (line 8046-8056), Firestore import line (2696), detailTitleId pattern (line 6987), addSimilar optimistic-update pattern (line 7112-7129)
- `03-CONTEXT.md` — locked decisions D-01 through D-09
- `03-UI-SPEC.md` — approved design contract for both new surfaces
- `REQUIREMENTS.md` — MOOD-01 through MOOD-07 acceptance criteria
- `CLAUDE.md` — architecture constraints (single-file, no bundlers, mobile Safari first)

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` — project history and validation status
- `.planning/STATE.md` — current phase position

### Tertiary (LOW confidence)
None — all claims verified from primary sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies, all verified in source
- Architecture: HIGH — verified against actual function signatures and call sites
- Pitfalls: HIGH — Pitfall 1/2/3/4 derived from existing code patterns; Pitfall 5 derived from direct read of `autoBackfill` at line 6007
- Firestore import gap: HIGH — `arrayRemove` confirmed absent from line 2696

**Research date:** 2026-04-19
**Valid until:** Until index.html is modified — these line numbers are point-in-time references

---

## Project Constraints (from CLAUDE.md)

| Directive | Category |
|-----------|----------|
| All code lives in `index.html` — no modules, no bundlers | Architecture |
| Internal "phase 1/2/3/4" in code = catalog migration stages, NOT product phases | Naming |
| TMDB rate limit ~40 req/10s — new features must budget for it | Performance |
| Firestore schema: new data under per-family nesting | Data |
| Design system: Fraunces + Instrument Serif + Inter; warm dark palette; `--s{N}` spacing tokens | Design |
| Test on mobile Safari — PWA + iOS home-screen use is primary surface | QA |
| TMDB key and Firebase config are public-by-design — do not "fix" | Security |
| Do not start monetization / billing work | Scope |
| Do not renumber product phases — GSD roadmap starts at Phase 3 on purpose | Naming |
