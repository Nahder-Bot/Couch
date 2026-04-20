---
phase: 03-mood-tags
reviewed: 2026-04-20T00:00:00Z
depth: standard
files_reviewed: 1
files_reviewed_list:
  - index.html
findings:
  critical: 0
  warning: 4
  info: 3
  total: 7
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-04-20
**Depth:** standard
**Files Reviewed:** 1
**Status:** issues_found

## Summary

Phase 3 added inline mood editing to the detail view (`renderDetailMoodsSection`, `openDetailMoodPalette`, `closeDetailMoodPalette`, `addDetailMood`, `removeDetailMood`, `_rerenderDetailFromState`) and a Tonight active-mood row (`t-mood-active-row`, `updateFiltersBar` extension, `removeMoodFilter`). The ASVS V5 moodById gate is applied consistently across all mutation paths. The outside-click palette-dismiss pattern is correctly deferred via `setTimeout(0)` to avoid the immediate-dismiss pitfall. No critical security vulnerabilities were found.

Four warnings require attention: the TMDB details async re-render and two review-save paths bypass `_rerenderDetailFromState`, leaving `detailMoodPaletteOpen` state inconsistent with the DOM when those async paths complete while the palette is open. `removeDetailMood` does not close the palette before re-rendering, creating a visual glitch if a user removes a chip while the palette is also open. The `autoBackfill` Phase 1 mood write omits the optimistic local `t.moods` update, meaning the filter row stays empty until the Firestore snapshot returns. Three lower-severity info items cover `toggleMood` lacking the ASVS gate that `removeMoodFilter` has, the `role="group"` misuse on individual chip divs in the active-mood row, and an unescaped emoji in the palette (not a security issue but inconsistent with the escaping pattern).

---

## Warnings

### WR-01: Async TMDB re-render clobbers palette state without resetting it

**File:** `index.html:7051-7054`

**Issue:** `openDetailModal` is async. If a user opens the palette (`openDetailMoodPalette`) while the TMDB details fetch is in flight, the `await fetchTmdbDetails(...)` completes and writes `content.innerHTML = renderDetailShell(merged)` at line 7053. This tears down the live DOM the `detailMoodPaletteOutsideHandler` click listener is checking against (`.detail-moods-palette`, `.mood-chip--add`), but `detailMoodPaletteOpen` is still `true` and the outside-click handler is still attached to `document`. The next click anywhere after re-render will call `closeDetailMoodPalette()` unexpectedly, or the handler's `e.target.closest` call will silently fail because the old nodes are detached. `renderDetailShell` at line 7128 reads `detailMoodPaletteOpen` correctly, so the palette *will* be re-rendered open — but the outside-click handler still points to the detached version's closure context.

Additionally, the same direct `innerHTML` pattern appears in `addSimilar` (line 7194) and the review-save/delete paths (`deleteMyReview` line 6857, `saveReview` line 6882) — all four bypass `_rerenderDetailFromState`.

**Fix:** Replace all four direct `content.innerHTML = renderDetailShell(...)` calls in those async paths with `_rerenderDetailFromState()` (after merging any new data into the relevant entry in `state.titles`). For `openDetailModal`'s post-fetch re-render, merge `update` into the `state.titles` entry before calling `_rerenderDetailFromState()`:

```js
// openDetailModal — after line 7050
if (detailTitleId === id) {
  Object.assign(t, update);          // mutate the state.titles entry in-place
  _rerenderDetailFromState();        // preserves palette state + scroll
}
```

For `deleteMyReview` / `saveReview`, merge `reviews` into the state entry before calling `_rerenderDetailFromState()`:

```js
if (detailTitleId === reviewTitleId) {
  const merged = state.titles.find(x => x.id === detailTitleId);
  if (merged) {
    merged.reviews = reviews;
    _rerenderDetailFromState();
  }
}
```

---

### WR-02: `removeDetailMood` does not close the palette before re-rendering

**File:** `index.html:7244-7257`

**Issue:** `removeDetailMood` (called by the × button on an existing mood chip) calls `_rerenderDetailFromState()` at line 7254 without first setting `detailMoodPaletteOpen = false` or removing the outside-click handler. If the palette happens to be open when the user removes a chip (which is possible — both the palette and the chips are visible simultaneously), the palette re-renders as still-open, and the outside-click listener remains attached. The palette now shows the just-removed mood as re-selectable, which is correct, but the outside-click listener firing from the *remove* click itself races with the `setTimeout(0)` registration in `openDetailMoodPalette` and may close the palette unexpectedly on the very next interaction. Compare `addDetailMood` (lines 7234-7238), which correctly resets palette state before re-rendering.

**Fix:** Mirror the `addDetailMood` pattern:

```js
window.removeDetailMood = async function(titleId, moodId) {
  if (!moodById(moodId)) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const current = Array.isArray(t.moods) ? t.moods : [];
  if (!current.includes(moodId)) return;
  const newMoods = current.filter(m => m !== moodId);
  haptic('light');
  t.moods = newMoods;
  t.moodsUserEdited = true;
  // Close palette (same as addDetailMood does) to avoid outside-click race
  detailMoodPaletteOpen = false;
  if (detailMoodPaletteOutsideHandler) {
    document.removeEventListener('click', detailMoodPaletteOutsideHandler);
    detailMoodPaletteOutsideHandler = null;
  }
  _rerenderDetailFromState();
  try { await updateDoc(doc(titlesRef(), titleId), { moods: newMoods, moodsUserEdited: true }); }
  catch(e) { console.error('[QN] removeDetailMood failed', e); }
};
```

---

### WR-03: `autoBackfill` Phase 1 mood write skips optimistic local state update

**File:** `index.html:6047-6052`

**Issue:** When backfilling moods for titles that lack them (Phase 1 of `autoBackfill`), the code writes to Firestore but never updates `t.moods` in the local `state.titles` object:

```js
for (const t of needsMoods) {
  const moods = suggestMoods(t.genres || [], t.runtime);
  if (moods.length) {
    try { await updateDoc(doc(titlesRef(), t.id), { moods }); } catch(e){}
    // t.moods never set here
  }
}
```

Because the Firestore `onSnapshot` listener merges incoming document changes into `state.titles` asynchronously, the local state lags behind until the next snapshot fires. During that window, `state.selectedMoods` filtering in `passesBaseFilter` (line 4971) sees `t.moods` as still empty, so titles that just received backfilled moods are incorrectly excluded from any active mood filter on the Tonight screen. The mood section in an already-open detail modal also shows no chips until the next render cycle triggered by the snapshot.

**Fix:** Set `t.moods` immediately after the successful write, mirroring the `addDetailMood` / `removeDetailMood` pattern:

```js
for (const t of needsMoods) {
  const moods = suggestMoods(t.genres || [], t.runtime);
  if (moods.length) {
    try {
      await updateDoc(doc(titlesRef(), t.id), { moods });
      t.moods = moods;   // optimistic local update
    } catch(e){}
  }
}
```

---

### WR-04: `addDetailMood` / `removeDetailMood` write to Firestore without guarding `state.familyCode`

**File:** `index.html:7240`, `index.html:7255`

**Issue:** Both functions call `titlesRef()` (which builds a Firestore path from `state.familyCode`) without first verifying `state.familyCode` is non-null. `titlesRef()` itself has no null-guard — it will pass `null` as the family document path, which Firestore SDK accepts silently at construction time but throws at write time. Although the detail modal is in practice only reachable after a family is loaded (because `state.titles` is empty until `state.familyCode` is set), this is a latent crash if the family subscription is torn down while the modal is open (e.g., the user is removed from the family mid-session).

The same gap exists in `removeDetailMood`. By contrast, `logActivity` (line 7543) correctly guards `if (!state.familyCode || !state.me) return` before any Firestore call.

**Fix:**

```js
window.addDetailMood = async function(titleId, moodId) {
  if (!moodById(moodId)) return;
  if (!state.familyCode || !state.me) return;   // add this guard
  // ... rest unchanged
};

window.removeDetailMood = async function(titleId, moodId) {
  if (!moodById(moodId)) return;
  if (!state.familyCode || !state.me) return;   // add this guard
  // ... rest unchanged
};
```

---

## Info

### IN-01: `toggleMood` lacks the ASVS V5 moodById gate present on `removeMoodFilter`

**File:** `index.html:4910-4918`

**Issue:** `removeMoodFilter` (line 4925) validates `if (!moodById(id)) return` before mutating `state.selectedMoods`. `toggleMood` (line 4910) does not. Both are `window`-exposed functions callable from the console or a future UI path. An invalid id passed to `toggleMood` would push an unrecognised string into `state.selectedMoods`, causing `passesBaseFilter` (line 4971) to filter against a mood that exists in the array but matches nothing in any title's `t.moods`, silently returning zero Tonight results.

**Fix:**
```js
window.toggleMood = function(id) {
  if (!moodById(id)) return;   // ASVS V5: reject any id not in MOODS[]
  haptic('light');
  if (state.selectedMoods.includes(id)) {
    state.selectedMoods = state.selectedMoods.filter(m => m !== id);
  } else {
    state.selectedMoods = [...state.selectedMoods, id];
  }
  renderTonight();
};
```

---

### IN-02: `role="group"` misused on individual active-mood chip divs

**File:** `index.html:5096`

**Issue:** Each active-mood chip in the Tonight row is rendered as:

```html
<div class="mood-chip on" role="group" aria-label="Cozy filter active">...</div>
```

`role="group"` is a landmark grouping role meant for a container that holds multiple related controls (like a fieldset). Here it is applied to a single chip that wraps a text label and one `<button>`. Screen readers will announce it as a group and then announce the button inside, which is redundant and confusing. The chip div itself is not interactive — only the inner `<button>` is — so the div should carry no ARIA role, or at most `role="listitem"` if the parent carries `role="list"`.

**Fix:** Remove `role="group"` from the chip div, or wrap the row in `role="list"` and give each chip `role="listitem"`:

```js
// Option A — remove group role entirely (simplest)
return `<div class="mood-chip on" aria-label="${escapeHtml(m.label)} filter active">
  <span class="mood-icon">${m.icon}</span>${escapeHtml(m.label)}
  <button class="mood-chip-remove" onclick="removeMoodFilter('${escapeHtml(id)}')"
    aria-label="Remove ${escapeHtml(m.label)} filter">×</button>
</div>`;
```

---

### IN-03: Mood icon emoji rendered unescaped in HTML attributes and text nodes

**File:** `index.html:7072`, `7078`, `5096`, `4901`

**Issue:** Mood icons (e.g., `🧸`, `⚔️`, `😂`) are stored as Unicode emoji strings in the `MOODS` array and inserted into HTML via `m.icon` without `escapeHtml()`. This is consistent with pre-Phase-3 code and poses no injection risk because `MOODS` is a compile-time constant, not user-supplied. However, it creates an inconsistency with the codebase's defensive escaping convention: `m.label` is always escaped (correctly), but `m.icon` never is. If `MOODS` is ever extended with SVG strings or data-URIs rather than single-codepoint emoji, the unescaped path becomes a stored XSS vector.

**Fix:** This is low-priority for the current static `MOODS` definition. For future-proofing, wrap `m.icon` in `escapeHtml()` at all render sites, or add a comment to `MOODS` that icons must be single emoji codepoints only:

```js
const MOODS = [
  // icon MUST be a single emoji codepoint — not HTML/SVG. escapeHtml not applied.
  { id:'cozy', label:'Cozy', icon:'🧸' },
  // ...
];
```

---

_Reviewed: 2026-04-20_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
