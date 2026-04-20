# Phase 3: Mood Tags - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 5 code surfaces (all in `index.html`)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified Surface | Role | Data Flow | Closest Analog | Match Quality |
|----------------------|------|-----------|----------------|---------------|
| `renderDetailMoodsSection(t)` — new helper, insert near line 7022 | component (template helper) | request-response | `renderDetailShell()` lines 7022-7084 — existing detail template helpers | exact |
| `addDetailMood / removeDetailMood` — new functions, insert near line 2914 | service (Firestore write) | CRUD | `saveEditTitle()` lines 8046-8059 — full-array mood write + `autoBackfill` line 6012 | exact |
| `detailMoodPaletteOpen` state var + `openDetailMoodPalette / closeDetailMoodPalette` — insert near line 6987 | utility (ephemeral UI state) | request-response | `detailTitleId` module-level var line 6987; `openDetailModal` re-render pattern lines 6989-7014 | exact |
| `updateFiltersBar()` — extend, line 5044 | controller (DOM update) | event-driven | existing `updateFiltersBar()` lines 5044-5068 + `renderMoodFilter()` lines 4873-4895 | role-match |
| CSS additions — insert after line 640; HTML `#t-mood-active-row` — insert after line 2040 | config (CSS + HTML) | — | `.mood-chip` CSS lines 624-640; `.t-filter-body` HTML lines 2037-2039; `.detail-section` CSS lines 1318-1322 | exact |

---

## Pattern Assignments

### 1. `renderDetailMoodsSection(t)` — new template helper

**Analog:** `renderDetailShell()` lines 7022–7084 (how other detail sections are built as template-string variables)

**Template variable pattern** (lines 7030-7032 — how `genresHtml`, `castHtml` etc. are built):
```javascript
// Each section is a const variable built from t.* data, then interpolated into the return string
const genresHtml = (t.genres || []).map(g => `<span class="genre-pill">${escapeHtml(g)}</span>`).join('');
const castHtml = (t.cast && t.cast.length)
  ? `<div class="detail-section"><h4>Cast</h4>...</div>`
  : '';
```

**`detail-section` h4 heading pattern** (line 1322 — CSS):
```css
.detail-section h4{font-family:'Inter',sans-serif;font-size:var(--t-micro);color:var(--accent);
  text-transform:uppercase;letter-spacing:0.18em;margin:0 0 var(--s3);font-weight:600}
```

**Insertion point in `renderDetailShell` return string** (lines 7071-7072):
```javascript
// Current:
    <div class="detail-genres">${genresHtml}</div>
    <div class="detail-overview">${escapeHtml(t.overview||'No description available.')}</div>

// New (insert moodsHtml between the two):
    <div class="detail-genres">${genresHtml}</div>
    ${moodsHtml}
    <div class="detail-overview">${escapeHtml(t.overview||'No description available.')}</div>
```

**`escapeHtml` usage convention** (lines 7025, 7028, 7030 — always wrap user/TMDB strings):
```javascript
const ratingPill = t.rating ? `...${escapeHtml(t.rating)}...` : '';
const metaParts = [t.year, t.kind, runtime, tvInfo].filter(Boolean).map(escapeHtml);
const genresHtml = (t.genres || []).map(g => `<span class="genre-pill">${escapeHtml(g)}</span>`).join('');
```

---

### 2. `addDetailMood(titleId, moodId)` and `removeDetailMood(titleId, moodId)` — new Firestore write functions

**Analog 1:** `saveEditTitle()` lines 8046-8059 — full-array mood write pattern
```javascript
window.saveEditTitle = async function() {
  if (!editTitleId) return;
  // ...
  const update = {
    name,
    // ...
    moods: editMoods.slice()       // full array write, not arrayUnion/arrayRemove
  };
  try { await updateDoc(doc(titlesRef(), editTitleId), update); closeEditModal(); }
  catch(e) { flashToast('Could not save. Try again.', { kind: 'warn' }); }
};
```

**Analog 2:** `autoBackfill()` lines 6009-6013 — the exact mood write shape:
```javascript
for (const t of needsMoods) {
  const moods = suggestMoods(t.genres || [], t.runtime);
  if (moods.length) {
    try { await updateDoc(doc(titlesRef(), t.id), { moods }); } catch(e){}
  }
}
```

**Analog 3:** `addSimilar()` lines 7112-7129 — optimistic local update then detail re-render:
```javascript
window.addSimilar = async function(id) {
  const t = state.titles.find(x => x.id === detailTitleId);
  // ... compute newTitle ...
  // Optimistically add to local state so the green check shows immediately
  state.titles.push(newTitle);
  const merged = state.titles.find(x => x.id === detailTitleId);
  if (merged) document.getElementById('detail-modal-content').innerHTML = renderDetailShell(merged);
};
```

**Key write rule (line 2696 — Firestore import):**
```javascript
// arrayRemove is NOT imported. Do NOT use arrayUnion/arrayRemove for mood writes.
import { ..., updateDoc, ..., arrayUnion, deleteField }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
// Write the full moods array: updateDoc(doc(titlesRef(), titleId), { moods: newArray })
```

**`haptic('light')` convention** — used in `toggleMood()` line 4898, copy the same call before Firestore writes.

---

### 3. `detailMoodPaletteOpen` + `openDetailMoodPalette` / `closeDetailMoodPalette`

**Analog:** `detailTitleId` module-level null variable (line 6987) + `openDetailModal` re-render pattern (lines 6989-7014)

**Module-level state variable pattern** (line 6987):
```javascript
let detailTitleId = null;
// Ephemeral UI state — not in state{}, not in Firestore. Module-level let.
```

**Re-render-on-state-change pattern** (lines 6992-6995 and 7011-7013):
```javascript
// On open: set state, render
detailTitleId = id;
const content = document.getElementById('detail-modal-content');
content.innerHTML = renderDetailShell(t);

// On update: find merged title from state, re-render
if (detailTitleId === id) {
  const merged = { ...t, ...update };
  content.innerHTML = renderDetailShell(merged);
}
```

**Scroll position preservation** — the detail modal content div is re-rendered by innerHTML replacement. Capture and restore `content.scrollTop` before/after assignment (per RESEARCH.md Pitfall 3):
```javascript
const scrollTop = content.scrollTop;
content.innerHTML = renderDetailShell(t);
content.scrollTop = scrollTop;
```

---

### 4. `updateFiltersBar()` — extend for active-mood inline row

**Analog 1:** Existing `updateFiltersBar()` lines 5044-5068 — badge update pattern to extend:
```javascript
function updateFiltersBar() {
  const toggle = document.getElementById('t-filter-toggle');
  const countEl = document.getElementById('t-filter-count');
  if (toggle && countEl) {
    const active = state.selectedMoods.length;
    if (active > 0) {
      toggle.classList.add('has-active');
      countEl.textContent = String(active);
    } else {
      toggle.classList.remove('has-active');
      countEl.textContent = '';
    }
  }
  // ... limitCheck and paidWrap handling follows ...
}
```

**Analog 2:** `renderMoodFilter()` lines 4873-4895 — exact chip rendering pattern (map MOODS, check `state.selectedMoods`, emit chip HTML):
```javascript
function renderMoodFilter() {
  const el = document.getElementById('mood-filter-tonight');
  if (!el) return;
  const shown = MOODS.filter(m => available.has(m.id));
  if (!shown.length) { el.innerHTML = ''; return; }
  const chips = shown.map(m => {
    const on = state.selectedMoods.includes(m.id);
    return `<button class="mood-chip ${on?'on':''}" onclick="toggleMood('${m.id}')">
      <span class="mood-icon">${m.icon}</span>${m.label}
    </button>`;
  });
  el.innerHTML = chips.join('');
}
```

**Analog 3:** `toggleMood()` lines 4897-4905 + `clearMoodFilter()` lines 4907-4910 — the new `removeMoodFilter(id)` follows the same pattern:
```javascript
window.toggleMood = function(id) {
  haptic('light');
  if (state.selectedMoods.includes(id)) {
    state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  } else {
    state.selectedMoods = [...state.selectedMoods, id];
  }
  renderTonight();
};
window.clearMoodFilter = function() {
  state.selectedMoods = [];
  renderTonight();
};
```

**Nested-button constraint** (RESEARCH.md Pitfall 2): the active-mood chip with × must NOT use `<button>` inside `<button>`. Use `<div class="mood-chip on">` as outer wrapper with `<button class="mood-chip-remove">` as the only interactive child.

**HTML insertion point** (lines 2040-2042 — insert `#t-mood-active-row` between `</div>` closing `.t-filters` and the first `.t-section`):
```html
<!-- Current (lines 2040-2042): -->
    </div>  <!-- closes #t-filter-body -->
  </div>    <!-- closes #t-filters (.t-filters div) -->

  <div class="t-section">  <!-- line 2042 -->

<!-- New — insert between them: -->
  </div>  <!-- closes #t-filters -->
  <div class="t-mood-active-row" id="t-mood-active-row"
       aria-label="Active mood filters" style="display:none;"></div>
  <div class="t-section">
```

---

### 5. CSS additions and `#t-mood-active-row` HTML

**Analog:** `.mood-chip` CSS block lines 624-640; `.detail-genres` CSS line 1318; `.detail-section` CSS lines 1321-1322; `.t-filter-body` CSS lines 1120-1122

**Existing mood-chip CSS to extend from** (lines 624-640 — reuse as-is, only add modifiers):
```css
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
.mood-chip.all{padding:var(--s2) var(--s4)}
.mood-chips-edit{display:flex;flex-wrap:wrap;gap:var(--s2);margin-top:var(--s2)}
.mood-chips-edit .mood-chip{font-size:var(--t-meta)}
```

**`.detail-genres` layout pattern** (line 1318 — `.detail-moods` container should mirror this):
```css
.detail-genres{display:flex;gap:var(--s1);flex-wrap:wrap;margin-bottom:var(--s4)}
```

**`.t-filter-body` layout pattern** (lines 1120-1122 — `.t-mood-active-row` should follow same flex pattern):
```css
.t-filter-body{flex-basis:100%;margin-top:var(--s3);padding:var(--s4);
  background:var(--surface);border-radius:var(--r-md);
  border:1px solid var(--border);display:flex;flex-direction:column;gap:var(--s2)}
```

**CSS insertion point:** after line 640 (end of `.mood-chips-edit` block), before `.wp-banner` which starts line 641. New rules to add:
- `.detail-moods` — wrapping flex row for detail view mood chips
- `.detail-moods-palette` — palette row (unselected moods shown when "+" tapped)
- `.mood-chip--add` — dashed affordance chip
- `.mood-chip--add-active` — active state when palette is open
- `.mood-chip--palette` — palette chip variant
- `.t-mood-active-row` — inline active-filter row below the Mood toggle
- `.mood-chip-remove` — × button inside active-mood chip

---

## Shared Patterns

### Firestore Write
**Source:** `saveEditTitle()` line 8057; `autoBackfill()` line 6012
**Apply to:** `addDetailMood`, `removeDetailMood`
```javascript
// Full-array write — arrayRemove not imported (line 2696). This is the established pattern.
try { await updateDoc(doc(titlesRef(), titleId), { moods: newArray }); }
catch(e) { console.error(e); }
```

### Optimistic Local State + Detail Re-render
**Source:** `addSimilar()` lines 7126-7129; `openDetailModal` update path lines 7011-7013
**Apply to:** `addDetailMood`, `removeDetailMood`
```javascript
// Mutate state.titles in place, then re-render detail content
t.moods = newMoods;                                           // optimistic update
const content = document.getElementById('detail-modal-content');
if (detailTitleId === titleId && content) {
  const scrollTop = content.scrollTop;                        // preserve scroll (Pitfall 3)
  content.innerHTML = renderDetailShell(t);
  content.scrollTop = scrollTop;
}
```

### `haptic('light')` on User Interaction
**Source:** `toggleMood()` line 4898
**Apply to:** `addDetailMood`, `removeDetailMood`, `removeMoodFilter`
```javascript
haptic('light');   // call before async work, same as toggleMood
```

### `moodById()` Validation Before Write
**Source:** `moodById()` line 2927; `MOODS[]` lines 2915-2926
**Apply to:** `addDetailMood`, `removeDetailMood` (input validation per RESEARCH.md §Security)
```javascript
function moodById(id) { return MOODS.find(m => m.id === id); }
// Validate: if (!moodById(moodId)) return; — before any Firestore write
```

### `escapeHtml()` in All HTML Templates
**Source:** used throughout `renderDetailShell` (lines 7025, 7028, 7069) and `renderMoodFilter` (line 4888)
**Apply to:** `renderDetailMoodsSection` — all mood labels and title IDs interpolated into onclick strings
```javascript
// Mood labels from MOODS[] are trusted, but use escapeHtml as a habit
`<span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}`
```

### `renderTonight()` as the Tonight-State Sink
**Source:** `toggleMood()` line 4904; `clearMoodFilter()` line 4909
**Apply to:** `removeMoodFilter` — must call `renderTonight()` after mutating `state.selectedMoods`
```javascript
window.removeMoodFilter = function(id) {
  haptic('light');
  state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  renderTonight();   // re-renders renderMoodFilter() + updateFiltersBar() + card list
};
```

---

## autoBackfill Interaction — Pitfall 5

**Source:** `autoBackfill()` line 6007
**Affects:** `removeDetailMood` — if last mood removed, `{ moods: [] }` written; on next boot `autoBackfill` sees `moods.length === 0` and re-suggests moods, overwriting user intent.

```javascript
// autoBackfill trigger condition (line 6007):
const needsMoods = state.titles.filter(t => !Array.isArray(t.moods) || t.moods.length === 0);
```

**Resolution the planner must confirm:** Write `{ moods: newArray, moodsUserEdited: true }` when a user removes a mood via the detail view. Check `t.moodsUserEdited` in `autoBackfill` to skip that title. Alternatively, accept that backfill will silently restore moods on next boot (simpler, but may surprise users). This is the only open behavioral decision for Phase 3.

---

## No Analog Found

None — all five surfaces have close analogs in the existing codebase.

---

## Metadata

**Analog search scope:** `index.html` (entire file — single-file architecture)
**Sections scanned:** lines 624-640 (CSS), 2693-2696 (Firestore import), 2914-2944 (MOODS constant), 4873-4910 (renderMoodFilter + toggleMood), 5044-5068 (updateFiltersBar), 6987-7014 (detailTitleId pattern + openDetailModal), 7022-7084 (renderDetailShell), 6001-6043 (autoBackfill), 8046-8059 (saveEditTitle), 7112-7130 (addSimilar), 1311-1327 (detail CSS), 1110-1128 (filter pills CSS), 2024-2042 (Tonight HTML filter bar)
**Pattern extraction date:** 2026-04-19
