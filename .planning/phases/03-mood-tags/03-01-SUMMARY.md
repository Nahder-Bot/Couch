---
phase: 03-mood-tags
plan: 01
subsystem: ui
tags: [pwa, firestore, vanilla-js, mood-tags, detail-view]

# Dependency graph
requires:
  - phase: phases-1-2-shipped
    provides: "index.html single-file PWA with MOODS constant, Firestore updateDoc, escapeHtml, renderDetailShell, autoBackfill, haptic"
provides:
  - "renderDetailMoodsSection(t) helper renders mood chips between genre pills and overview in detail view"
  - "window.addDetailMood / removeDetailMood for optimistic Firestore mood writes with moodsUserEdited flag"
  - "window.openDetailMoodPalette / closeDetailMoodPalette inline palette with deferred outside-click dismiss"
  - "_rerenderDetailFromState() scroll-preserving re-render helper for detail modal"
  - "detailMoodPaletteOpen + detailMoodPaletteOutsideHandler module-level ephemeral state"
  - "moodsUserEdited guard on both autoBackfill Phase 1 filter and Phase 2 runtime-driven re-suggestion"
  - "detail-moods CSS block (.detail-moods, .detail-moods-palette, .mood-chip--add, .mood-chip--add-active, .mood-chip--palette)"
affects: [03-02-PLAN, phase-4-veto, phase-6-year-in-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-array Firestore mood writes (no arrayRemove — not imported); always write moods: newArray + moodsUserEdited: true together"
    - "Optimistic local mutation (t.moods = newMoods) then _rerenderDetailFromState() before awaiting Firestore write — mirrors addSimilar() pattern"
    - "Deferred addEventListener via setTimeout(0) to prevent the palette-opening click from immediately triggering outside-click dismiss (Pitfall 1)"
    - "Scroll position preserved in _rerenderDetailFromState via content.scrollTop save/restore around innerHTML reassignment (Pitfall 3)"
    - "ASVS V5 input validation gate: moodById(moodId) check before any local mutation or Firestore write in add/removeDetailMood"

key-files:
  created: []
  modified:
    - "index.html — CSS block at ~line 642 (.detail-moods, .detail-moods-palette, .mood-chip--add variants)"
    - "index.html — renderDetailMoodsSection(t) helper inserted before renderDetailShell (~line 7022)"
    - "index.html — renderDetailShell wired to interpolate ${moodsHtml} between .detail-genres and .detail-overview (~line 7090-7098)"
    - "index.html — detailMoodPaletteOpen + detailMoodPaletteOutsideHandler state vars after let detailTitleId (~line 6989)"
    - "index.html — 4 window functions (openDetailMoodPalette, closeDetailMoodPalette, addDetailMood, removeDetailMood) + _rerenderDetailFromState after addSimilar block (~line 7167-7237)"
    - "index.html — autoBackfill Phase 1 filter guard at ~line 6007 (added && !t.moodsUserEdited)"
    - "index.html — autoBackfill Phase 2 runtime re-suggestion guard at ~line 6035 (added && !t.moodsUserEdited)"
    - "index.html — closeDetailModal reset of detailMoodPaletteOpen + listener cleanup before detailTitleId = null"

key-decisions:
  - "Full-array mood writes (moods: newArray) not arrayRemove — arrayRemove is not in the Firestore import at line 2696; this avoids modifying the import list and keeps writes explicit"
  - "moodsUserEdited guard added to BOTH autoBackfill paths (Phase 1 filter line 6007 and Phase 2 runtime re-suggestion line 6035) — prevents silent re-suggestion after any user edit, whether initial or runtime-triggered"
  - "Scroll position preserved in _rerenderDetailFromState via content.scrollTop save/restore — prevents jarring jump-to-top on every mood add/remove"
  - "Outside-click dismiss via deferred addEventListener (setTimeout 0) — prevents the palette-opening click from immediately propagating and closing the palette"
  - "Palette state vars (detailMoodPaletteOpen, detailMoodPaletteOutsideHandler) live at module scope, not in state object — they are ephemeral UI state that should reset on page reload"

patterns-established:
  - "Pattern: optimistic-mutate-then-rerender for Firestore-backed detail-view edits (mirrors addSimilar shape at line 7126-7129)"
  - "Pattern: _rerenderDetailFromState() as scroll-preserving re-render helper — use for any future detail-view state change that needs UI refresh without scroll reset"
  - "Pattern: deferred outside-click handler registration to avoid same-tick dismiss"

requirements-completed: [MOOD-01, MOOD-02, MOOD-03, MOOD-04]

# Metrics
duration: ~45min
completed: 2026-04-20
---

# Phase 3 Plan 01: Detail-View Mood Editing Summary

**Inline mood editing in the title detail view: render existing chips, one-tap add via inline palette, one-tap remove, full Firestore sync with moodsUserEdited guard preventing autoBackfill from overwriting deliberate user empties**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-20
- **Completed:** 2026-04-20
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 1 (index.html)

## Accomplishments

- Mood chips now render inline in the detail view between genre pills and the overview — no modal required for mood management
- Full add/remove cycle working: palette opens inline, chip taps write to Firestore with optimistic local update, changes propagate cross-device via existing onSnapshot listener within 2s (MOOD-04)
- autoBackfill moodsUserEdited guard ensures a user who deliberately clears all moods from a title will not see them silently re-suggested on the next boot cycle

## Task Commits

1. **Task 1: Add detail-moods CSS, renderDetailMoodsSection, wire into renderDetailShell** — `0cc3133` (feat)
2. **Task 2: Add detailMoodPaletteOpen state, mood edit functions, autoBackfill guards** — `5a740fe` (feat)
3. **Task 3: Human verification checkpoint** — approved (no code commit — checkpoint only)

## Files Created/Modified

- `index.html` — All changes in one file:
  - CSS block (~line 642): `.detail-moods`, `.detail-moods-palette`, `.mood-chip--add`, `.mood-chip--add-active`, `.mood-chip--palette`
  - `renderDetailMoodsSection(t)` helper (~before line 7022)
  - `renderDetailShell` wired to use `${moodsHtml}` between `.detail-genres` and `.detail-overview`
  - `let detailMoodPaletteOpen = false` + `let detailMoodPaletteOutsideHandler = null` (~after line 6987)
  - `window.openDetailMoodPalette`, `window.closeDetailMoodPalette`, `window.addDetailMood`, `window.removeDetailMood`, `function _rerenderDetailFromState` (~after addSimilar block)
  - autoBackfill Phase 1 guard at ~line 6007: `&& !t.moodsUserEdited` added to filter
  - autoBackfill Phase 2 guard at ~line 6035: `&& !t.moodsUserEdited` added to condition
  - `closeDetailModal` reset: `detailMoodPaletteOpen = false` + listener cleanup before `detailTitleId = null`

## Decisions Made

- **Full-array writes over arrayRemove:** `arrayRemove` is not in the Firestore import at line 2696. Rather than modify the import list, all mood writes use `moods: newArray` — explicit, auditable, consistent with saveEditTitle at line 8046.
- **moodsUserEdited guard on both autoBackfill paths:** The Phase 1 filter at line 6007 and the Phase 2 runtime re-suggestion at line 6035 both needed the guard independently. Missing either path would allow autoBackfill to re-suggest moods for a user who emptied the list via the runtime TMDB-extras path.
- **Scroll preservation in _rerenderDetailFromState:** Capturing `content.scrollTop` before and restoring after `innerHTML` reassignment avoids a jarring scroll-to-top on every chip tap. This becomes the canonical re-render helper for any future detail-view state changes.
- **Deferred outside-click listener:** The click that opens the palette would immediately satisfy an outside-click handler registered synchronously. `setTimeout(0)` defers registration until after the current event loop tick, preventing instant self-dismiss.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Human Verification

Task 3 checkpoint approved. All 13 verification steps passed:
1. Moods section renders between genre pills and overview — confirmed
2. "+ add mood" chip visible with dashed border — confirmed
3. Palette opens inline (no modal/bottom sheet) — confirmed
4. Palette chip tap adds mood and closes palette — confirmed
5. Cross-device sync within 2s (MOOD-04) — confirmed
6. Existing mood chip tap removes mood — confirmed
7. Removal propagates cross-device within 2s — confirmed
8. Removing all moods leaves only "+ add mood" chip — confirmed
9. Hard-refresh + 6s wait: autoBackfill does NOT restore moods (moodsUserEdited guard confirmed) — confirmed
10. Outside-click dismisses palette without adding — confirmed
11. No "interactive content not allowed" warnings in Safari DevTools — confirmed
12. No uncaught errors from add/removeDetailMood or closeDetailModal — confirmed
13. Warm/cinematic styling: dashed border on add chip, correct spacing — confirmed

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- MOOD-01, MOOD-02, MOOD-03, MOOD-04 complete
- Plan 03-02 can start: Tonight active-mood inline row (MOOD-05, MOOD-06, MOOD-07)
- No blockers

## Known Stubs

None — all features fully wired to Firestore.

## Self-Check: PASSED

- `0cc3133` confirmed in git log
- `5a740fe` confirmed in git log
- `index.html` modified with all required additions verified during task execution

---
*Phase: 03-mood-tags*
*Completed: 2026-04-20*
