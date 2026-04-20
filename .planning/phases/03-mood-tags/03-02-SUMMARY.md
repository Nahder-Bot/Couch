---
phase: 03-mood-tags
plan: 02
subsystem: ui
tags: [pwa, vanilla-js, mood-tags, tonight-filter, active-mood-row]

# Dependency graph
requires:
  - phase: 03-01
    provides: "MOODS constant, moodById, escapeHtml, haptic, renderTonight, state.selectedMoods, toggleMood, clearMoodFilter, updateFiltersBar, existing .mood-chip / .mood-chip.on CSS base classes"
provides:
  - ".t-mood-active-row CSS block (flex row, flex-wrap, --s{N} tokens only)"
  - ".mood-chip-remove CSS (transparent × button styled for accent-filled on-state chip)"
  - "<div id='t-mood-active-row'> HTML container — sibling of .t-filters, outside collapsible panel"
  - "updateFiltersBar() extension: renders active-mood chips into #t-mood-active-row, shows/hides row, Pitfall 4 flicker guard"
  - "window.removeMoodFilter(id): ASVS V5 moodById gate + haptic + state.selectedMoods filter + renderTonight()"
affects: [phase-4-veto, phase-6-year-in-review, gsd-verify-work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Active-mood inline row: outer chip wrapper is <div class='mood-chip on' role='group'> NOT <button> — nested interactive elements break Safari (Pitfall 2)"
    - "innerHTML flicker guard: compare activeRow.innerHTML !== html before assignment to prevent needless layout thrash on unrelated Tonight re-renders (Pitfall 4)"
    - "ASVS V5 input validation gate in removeMoodFilter: moodById(id) check rejects any id not in MOODS[] before touching state or calling renderTonight"
    - "updateFiltersBar extension pattern: active-row rendering appended after existing badge/checkbox logic, before closing brace — matches existing function structure"

key-files:
  created: []
  modified:
    - "index.html — CSS block at ~line 649-651: .t-mood-active-row, .mood-chip-remove, .mood-chip-remove:hover"
    - "index.html — HTML div at ~line 2052-2054: <div class='t-mood-active-row' id='t-mood-active-row' aria-label='Active mood filters' style='display:none;'></div>"
    - "index.html — updateFiltersBar extension at ~line 5088-5105: active-row rendering with flicker guard and show/hide logic"
    - "index.html — window.removeMoodFilter at ~line 4924-4929: ASVS V5 gate + haptic + state mutation + renderTonight"

key-decisions:
  - "Outer chip wrapper is <div class='mood-chip on'> NOT <button> — Pitfall 2: nested <button> inside <button> produces invalid HTML and breaks Safari input event routing; the × is the sole interactive element inside the div"
  - "innerHTML flicker guard (activeRow.innerHTML !== html) before every assignment — Pitfall 4: updateFiltersBar is called on every Tonight re-render; without the guard, each scroll or state change would repaint the row unnecessarily"
  - "moodById ASVS V5 guard in removeMoodFilter mirrors existing toggleMood/addDetailMood pattern — rejects any id not in MOODS[] before touching state, preventing a modified-page onclick from injecting unexpected ids"
  - "Active-mood row is a sibling of .t-filters (outside the collapsible .t-filter-body) per D-07 — row stays visible when panel is collapsed, confirming MOOD-07 always-visible contract"

patterns-established:
  - "Pattern: sibling-of-filter-panel placement for always-visible filter-state indicators — replicate in Phase 4 (veto badges) if needed"
  - "Pattern: Pitfall 2 wrapper — any chip that contains an interactive element must use <div role='group'> as outer, not <button>"

requirements-completed: [MOOD-05, MOOD-06, MOOD-07]

# Metrics
duration: ~30min
completed: 2026-04-20
---

# Phase 3 Plan 02: Tonight Active-Mood Inline Row Summary

**Always-visible active-mood chip row below the Tonight filter toggle: per-chip × removal outside the collapsible panel, with Pitfall 2 div-wrapper and Pitfall 4 flicker guard; closes MOOD-07 and confirms MOOD-05/MOOD-06 not regressed**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-04-20
- **Completed:** 2026-04-20
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint — approved)
- **Files modified:** 1 (index.html)

## Accomplishments

- Active-mood inline row is now always visible below the Mood toggle pill when any moods are active — users no longer need to open the collapsible filter panel to see or clear their active mood filters
- Per-chip × removal works without touching the collapsible panel state; collapsing the panel leaves the active row and its count badge intact
- All 14 human-verification steps passed including narrow-viewport flex-wrap at 375px and iOS PWA home-screen launch

## Task Commits

1. **Task 1: Add CSS and HTML for the Tonight active-mood inline row** — `cfb6b08` (feat)
2. **Task 2: Extend updateFiltersBar for active-mood row; add removeMoodFilter** — `b039abf` (feat)
3. **Task 3: Human verification checkpoint** — approved (no code commit — checkpoint only)

## Files Created/Modified

- `index.html` — All changes in one file:
  - CSS block (~line 649-651): `.t-mood-active-row{display:flex;gap:var(--s2);flex-wrap:wrap;padding:var(--s2) 0 var(--s1)}`, `.mood-chip-remove`, `.mood-chip-remove:hover`
  - HTML div (~line 2052-2054): `<div class="t-mood-active-row" id="t-mood-active-row" aria-label="Active mood filters" style="display:none;"></div>` — inserted between `.t-filters` closing `</div>` and first `.t-section`
  - `updateFiltersBar()` extension (~line 5088-5105): renders active-mood chips with flicker guard; shows row when `state.selectedMoods.length > 0`, hides when empty
  - `window.removeMoodFilter(id)` (~line 4924-4929): ASVS V5 moodById gate, `haptic('light')`, `state.selectedMoods.filter(m => m !== id)`, `renderTonight()`

## Decisions Made

- **Outer chip wrapper is `<div class="mood-chip on">` not `<button>`:** Pitfall 2 is non-negotiable — nested interactive buttons produce invalid HTML and break Safari's input event routing. The × `<button>` is the sole interactive element inside the wrapper div. Confirmed: no Safari "interactive content not allowed" warnings in DevTools.
- **Flicker guard before every innerHTML assignment:** `updateFiltersBar` is called on every Tonight re-render (scroll, state change, etc.). Without comparing `activeRow.innerHTML !== html` before writing, each re-render would repaint the active-row chips unnecessarily (Pitfall 4). Guard added for both the populated-row case and the empty-row teardown case.
- **ASVS V5 moodById guard in removeMoodFilter:** Matches the existing pattern established in Plan 01's `addDetailMood`/`removeDetailMood`. The id arrives via onclick string from an inline chip; a modified page could call `removeMoodFilter('<script>')` directly. The guard silently returns for any id not in `MOODS[]`, preventing state corruption or XSS.
- **Row placement as sibling of `.t-filters`:** Per D-07, the active-mood row must be outside `.t-filter-body` so it stays visible when the panel is collapsed. Verified during human verification step 5: collapsing the panel leaves the active row present.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## Human Verification

Task 3 checkpoint approved. All 14 verification steps passed:
1. Tonight screen opens; existing Mood filter toggle pill visible — confirmed
2. Tapping Mood toggle opens `.t-filter-body` with pre-existing `#mood-filter-tonight` chip row (MOOD-05 regression) — confirmed
3. Tapping "cozy" chip: chip gains on-state accent, count badge shows "1", active-mood row appears below toggle — confirmed
4. Collapsing filter panel: active row stays visible outside the panel (D-07) — confirmed
5. Count badge stays on toggle after panel collapse — confirmed
6. Scrolling Tonight titles: active row does not flicker (Pitfall 4 mitigated) — confirmed
7. Tapping × on active-row chip: chip removed, count badge clears, active row hides (display:none), Tonight list expands — confirmed
8. Selecting 3 moods: 3 chips appear in active row each with own × — confirmed
9. Tapping × on middle chip: only middle chip removed, other two remain, count badge shows "2" — confirmed
10. Tonight candidate list with active moods: only titles with intersecting moods shown (MOOD-06 regression) — confirmed
11. Safari DevTools: no "interactive content not allowed" warnings; no uncaught errors — confirmed
12. Visual check: active-row chips match filter-panel chips (same accent fill, same size); × at opacity 0.75 recedes appropriately — confirmed
13. Narrow viewport (375px Responsive Design Mode): 5 moods selected, active row wraps to second line cleanly; no horizontal overflow — confirmed
14. iOS PWA home-screen launch: steps 4-7 behavior identical — confirmed

## Phase 3 Closure

All 7 MOOD-* requirements now PASS:
- MOOD-01: Member can see auto-suggested moods in detail view (Plan 01)
- MOOD-02: Member can add a personal mood tag; others see it within 2s Firestore latency (Plan 01)
- MOOD-03: Member can remove a mood tag they added (Plan 01)
- MOOD-04: Mood changes propagate cross-device within 2s via onSnapshot (Plan 01)
- MOOD-05: Tonight filter bar exposes a Mood filter control (existing surface — regression-confirmed this plan)
- MOOD-06: Selecting moods narrows the spin candidate pool (existing logic — regression-confirmed this plan)
- MOOD-07: Active mood filters visible as inline row outside collapsible panel; each chip has × for one-tap individual removal (this plan)

Phase 3 implementation is complete. Ready for `/gsd-verify-work` to run the full MOOD-01 through MOOD-07 verification pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 3 implementation fully complete; all 7 MOOD-* requirements delivered
- Phase 4 (Veto System) can start independently; no Phase 3 dependency
- Phase 5 (Watchparty) can also start independently
- No blockers

## Known Stubs

None — all features fully wired to live state and Firestore.

## Threat Flags

No new security-relevant surface introduced beyond what was modeled in the plan's threat register (T-03-07 through T-03-11). All mitigations applied as specified.

## Self-Check: PASSED

- `cfb6b08` confirmed in git log (Task 1: CSS and HTML)
- `b039abf` confirmed in git log (Task 2: updateFiltersBar extension + removeMoodFilter)
- index.html: `.t-mood-active-row{`, `.mood-chip-remove{`, `id="t-mood-active-row"`, `window.removeMoodFilter`, `activeRow.innerHTML !== html` — all present

---
*Phase: 03-mood-tags*
*Completed: 2026-04-20*
