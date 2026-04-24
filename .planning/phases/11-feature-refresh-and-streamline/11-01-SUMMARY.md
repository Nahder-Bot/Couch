---
phase: 11-feature-refresh-and-streamline
plan: 01
subsystem: ui
tags: [ux-tightening, density, feature-flag, who-card, mood-chip, refr-01, refr-02, refr-03]

# Dependency graph
requires:
  - phase: 09-redesign-brand-marketing-surface/02
    provides: "Semantic token layer (--s1/--s2/--s3/--s4, --ink-dim, --accent, --font-serif, --font-sans)"
  - phase: 09-redesign-brand-marketing-surface/03
    provides: "Token-backed component classes pattern for density-adjusting rules"
provides:
  - "Tightened mood-chip density: gap --s2→--s1, padding --s2/--s4→--s1/--s3, min-height:36px tap-target floor (REFR-01)"
  - "body.picker-ui-hidden feature-flag kill-switch hiding 'whose turn to pick' surfaces across Tonight + Family tabs (REFR-02)"
  - "Compact horizontal scrollable who-card layout (Variant B) with 26px avatars, empty-state fallback + Share invite CTA (REFR-03)"
  - "sw.js CACHE bump: couch-v21-09-07b-guest-invite → couch-v22-11-01-ux-tightening"
affects: [11-02-tab-restructures, 11-03-discovery, later-phases-needing-picker-restore-path]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Body-class feature-flag kill-switch for surface-level UI subtraction (reversible in 1 commit via `body.classList.remove('picker-ui-hidden')`)"
    - "Backend writes preserved while hiding UI — spinnerId / renderPickerCard / renderPickerStrip / getPicker / togglePickerAuto / passPickerTurn all intact under the hide"
    - "Variant B who-card = horizontal scroll row with 26px avatars, reuses .wp-participant-chip aesthetic, empty-state with Instrument Serif italic fallback"

key-files:
  created: []
  modified:
    - "css/app.css (mood-chip density + .picker-ui-hidden CSS kill-switch + who-card compact row rules)"
    - "js/app.js (boot() sets body.classList.add('picker-ui-hidden') + renderTonight who-card template + openInviteShare helper at ~2810)"
    - "sw.js (CACHE const bumped to couch-v22-11-01-ux-tightening)"

key-decisions:
  - "Mood-chip min-height:36px floor preserved tap target comfort while achieving visibly tighter row (per UI-SPEC §Spacing REFR-01 exception)"
  - "Picker-hide implemented as single CSS kill-switch under .picker-ui-hidden body class, not removal. Backend writes preserved — grep confirms spinnerId (1 ref), renderPickerCard (7 code refs), renderPickerStrip (3 code refs), getPicker/togglePickerAuto/passPickerTurn all intact. Reversible in one commit."
  - "Who-card Variant B (compact horizontal row) chosen over A (overlapping stack) or C (per-person rows) per UI-SPEC default recommendation and CONTEXT.md REFR-03 locked decision"
  - "Empty-state copy: 'Nothing but us.' headline + '*Pull up a seat — invite someone to the couch.*' italic body + 'Share an invite' button wired via openInviteShare() → showScreen('family') + scroll #share-url into view"

patterns-established:
  - "Body-class feature-flag kill-switch: CSS-only, backend-preserving, one-commit reversible (REFR-02 template; reusable for future 'hide without deleting' subtractions)"
  - "Compact horizontal chip-strip with poster-serif empty state (who-card; reusable for other family-size-variable surfaces)"

requirements-completed: [REFR-01, REFR-02, REFR-03]

# Metrics
duration: ~5min (executor agent)
completed: 2026-04-24
---

# Phase 11 Plan 01 Summary

**Mood-chip density tightening + picker-UI feature-flag kill-switch + compact who-card horizontal row — three user-visible UX wins in 3 atomic commits with backend writes preserved.**

## Performance

- **Duration:** ~5 min (executor agent run)
- **Completed:** 2026-04-24
- **Tasks:** 3 automated + 1 human-verify checkpoint (approved on automated gates per user direction)
- **Files modified:** 3 (css/app.css, js/app.js, sw.js)

## Accomplishments

- **REFR-01** Mood-chip row visibly tighter — gap tightened from `--s2` (8px) to `--s1` (4px), padding from `var(--s2) var(--s4)` to `var(--s1) var(--s3)`, with `min-height:36px` floor preserving tap target comfort
- **REFR-02** "Whose turn to pick" UI surfaces hidden across Tonight + Family tabs via `body.picker-ui-hidden` CSS kill-switch; backend spinnership writes (spinnerId, spinnerAt, auto-advance) fully preserved; feature-flag reversible in one commit
- **REFR-03** "Who's on the couch" card redesigned to compact horizontal scrollable row (Variant B) with 26px avatars reusing `.wp-participant-chip` aesthetic; includes empty-state fallback ("Nothing but us.") with Instrument Serif italic body + Share invite CTA that routes to Family tab `#share-url`
- **sw.js CACHE bump** to `couch-v22-11-01-ux-tightening` so installed PWAs invalidate on next online activation

## Task Commits

Each task was committed atomically:

1. **Task 1: REFR-01 Tighten mood-chip density** — `f8a8ee3` (style)
2. **Task 2: REFR-02 Picker-UI hide via body class feature flag** — `226a856` (feat)
3. **Task 3: REFR-03 Who-card compact horizontal row + bump sw.js** — `b073fb9` (feat)

## Files Created/Modified

- `css/app.css` — mood-chip density rules (~line 697, 700-701); `.picker-ui-hidden` CSS kill-switch rules (after existing body-class feature-flag template at ~line 2237); who-card compact-row rules (~lines 1599-1628)
- `js/app.js` — `boot()` at ~line 3400 adds `document.body.classList.add('picker-ui-hidden')` as the default-on flag; `renderTonight` at ~line 3849 renders compact who-card template (horizontal chip strip + empty-state branch); new `openInviteShare` helper at ~line 2810 (invoked by empty-state CTA → navigates to Family tab + scrolls share URL into view)
- `sw.js` — CACHE const at line 8 bumped from `couch-v21-09-07b-guest-invite` to `couch-v22-11-01-ux-tightening`

## Decisions Made

- **Picker hide, not removal** — preserved all 6 backend write paths (spinnerId, spinnerAt, auto-advance logic, renderPickerCard/renderPickerStrip render fns, getPicker/togglePickerAuto/passPickerTurn state helpers). This honors REFR-02 "feature-flag reversible" requirement and CONTEXT.md D-02 decision.
- **Who-card Variant B over A/C** — compact horizontal row chosen per UI-SPEC §Interaction States REFR-03 default recommendation. Horizontal scroll handles 6+ member families gracefully.
- **Empty-state Share invite CTA** — wired to existing Family tab `#share-url` anchor rather than opening a new modal, keeping the interaction low-friction per BRAND.md voice ("warm, invitational").
- **Single CACHE bump covers all 3 commits** — per Couch convention, one CACHE bump per user-visible deploy unit. Plan 11-02 will bump to v23 at the end of Wave 1.

## Deviations from Plan

None significant. One minor pre-edit state observation: the plan's `interfaces` block described `.mood-chip` pre-edit padding as `var(--s2) var(--s3)` but actual was `var(--s2) var(--s4)`; executor followed the UI-SPEC locked final state `var(--s1) var(--s3)` per D-XX — grep acceptance literally passes and "visibly tighter" behavior intent is met.

## Issues Encountered

None. Automated verification ran cleanly on first pass:

- `node --check js/app.js` exits 0
- `node --check sw.js` exits 0
- CSS brace balance: 1270/1270 (balanced)
- All per-task grep acceptance patterns matched
- Backend preservation grep confirmed (spinnerId / renderPickerCard / renderPickerStrip / getPicker / togglePickerAuto / passPickerTurn all intact)
- `:has()` selector count: 0 (unchanged — avoided per mobile Safari compat rule)

## User Setup Required

None — no external service configuration required. Visual verification (14-check walkthrough) deferred to end of Wave 1 per user direction "skip to 11-02".

## Next Phase Readiness

Plan 11-02 (Family + Account tab restructures — REFR-11, REFR-12) can now proceed on the same working tree. Both plans share app.html and css/app.css so Plan 11-02 executor will pick up this commit's state as baseline. sw.js CACHE will advance from v22 → v23 at end of 11-02.

**Deferred verification:** The 14-check manual walkthrough (mobile chip density, tap targets, picker-hide console check, who-card scroll + empty state, SW cache registration) bundles into the Wave 1 end-of-wave user verification gate alongside Plan 11-02.

---
*Phase: 11-feature-refresh-and-streamline*
*Plan: 01*
*Completed: 2026-04-24*
