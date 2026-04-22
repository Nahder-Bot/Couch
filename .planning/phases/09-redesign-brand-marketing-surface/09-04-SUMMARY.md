---
phase: 09-redesign-brand-marketing-surface
plan: 04
subsystem: ui
tags: [responsive, css, media-query, modal, layout, desktop, pwa]

# Dependency graph
requires:
  - phase: 09-redesign-brand-marketing-surface/09-02
    provides: Semantic token layer (--color-*, --space-*, --text-*) used by surrounding rules; baseline body rule and modal classes that 09-04 wraps and extends.
  - phase: 09-redesign-brand-marketing-surface/09-03
    provides: Phase 9 / DESIGN-03 inline-style purge section in css/app.css (~lines 2212-2327). Plan 09-04 appends its @media block after this section to preserve mobile-first reading order.
provides:
  - .phone-shell wrapper class capping the user-visible screen DOM at 480px on mobile / 520px on desktop
  - body rule freed from max-width:480px so the viewport background is full-bleed at desktop widths
  - Single @media (min-width: 900px) block expanding modals + sticky bars (.tabbar, .who-mini) for desktop
  - Phase 7 UAT deferred gap closure: .wp-live-modal expands to 800px max-width with 85vh cap on desktop
affects: [phase-10-year-in-review, phase-11-and-beyond, watchparty-modal-followups, future-desktop-polish]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Mobile-first single-breakpoint responsive layer (one @media (min-width: 900px) rule, no container queries, no second breakpoint)"
    - "Wrapper-owned column cap (max-width lives on .phone-shell, not body) so body can host viewport-anchored film grain + safe-area handling unchanged"

key-files:
  created: []
  modified:
    - "index.html: single <div class=\"phone-shell\"> wrapping #signin-screen through end of #app-shell"
    - "css/app.css: body rule loses max-width/margin (lines ~208); new .phone-shell rule (line 209); new @media (min-width: 900px) block (lines 2329-2359)"

key-decisions:
  - "ONE shared .phone-shell wrapper around all user-visible screens, not per-screen wrappers — fewer DOM nodes, easier revert."
  - "body padding-bottom:110px preserved through max-width removal — tabbar clearance invariant (T-09-04-06)."
  - ".phone-shell declared with width:100% so the wrapper does not collapse to content width on wide viewports."
  - "Legal-footer and <script> stay OUTSIDE .phone-shell — legal-footer is position:fixed (viewport-anchored, ancestry irrelevant); <script> is non-visual."
  - "Skip-link kept inside #app-shell (its existing position) — its target #screen-tonight is also inside, position-in-DOM minimizes diff."
  - "@media block placed at END of css/app.css (after Phase 9 / DESIGN-03 section) to keep top-to-bottom file reading mobile-first."
  - "Single 900px breakpoint — deliberately above iPad Air portrait (820px), below iPad Pro 12.9\" portrait (1024px). iPhones never reach 900px so iOS PWA layout is provably unchanged."
  - "All 14 selectors in the @media block pre-flight verified to exist in css/app.css before commit (T-09-04-03). Zero stale selectors pruned."

patterns-established:
  - "Mobile-first single-breakpoint: prefer one @media (min-width:N) block at file end over multiple breakpoints; revisit only if a real desktop polish need surfaces."
  - "Wrapper-owned column cap: when body needs to span the viewport (background, position:fixed children, safe-area-inset), move the column max-width to a single inner wrapper instead."
  - "Pre-flight selector existence check: before shipping a CSS rule that references multiple selectors from a research dump, grep each selector to confirm it still exists. Silently shipping rules for nonexistent selectors wastes bytes and confuses future readers."

requirements-completed: [DESIGN-04]

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 09 / Plan 04: Desktop responsive layer Summary

**Single @media (min-width: 900px) breakpoint + .phone-shell wrapper give Couch a desktop layer; .wp-live-modal expands to 800px on desktop, closing the Phase 7 UAT deferred gap.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22 (Plan 09-04 executor handoff)
- **Completed:** 2026-04-22
- **Tasks:** 2 of 3 (Task 3 is blocking human-verify checkpoint, deferred to user)
- **Files modified:** 2

## Accomplishments

- Introduced `.phone-shell` wrapper around the entire user-visible screen DOM (#signin-screen through #app-shell), enabling body to span the full viewport while content stays capped.
- Removed `max-width:480px` and `margin:0 auto` from the `body` rule. **Critically preserved `padding-bottom:110px` (tabbar clearance, threat T-09-04-06).**
- Added a single `@media (min-width: 900px)` block at the end of `css/app.css` (lines 2329-2359, immediately after the Phase 9 / DESIGN-03 section) — purely additive, zero existing rules modified.
- **Closed Phase 7 UAT deferred gap:** `.wp-live-modal` now expands to `max-width: 800px` with `max-height: 85vh` on desktop viewports, ending the cramped watchparty live modal on wide screens.
- 14 selectors expanded inside the @media block; all pre-flight verified to exist in current `css/app.css`.

## Task Commits

Each task committed atomically per the plan's commit_strategy:

1. **Task 1: Introduce .phone-shell wrapper + relax body max-width** — `6897cc5` (refactor)
2. **Task 2: Add single @media (min-width:900px) block** — `f4297ee` (feat)
3. **Task 3: Multi-viewport human-verify checkpoint** — DEFERRED (blocking checkpoint, awaits user)

## Files Created/Modified

- `index.html` — Wrapped lines 58-976 (signin-screen through app-shell close) in a single `<div class="phone-shell">...</div>`. Legal footer (position:fixed) and `<script>` tags remain outside the wrapper.
- `css/app.css`:
  - Line 208: `body{...}` rule — removed `max-width:480px` and `margin:0 auto`. **Preserved `min-height:100vh; padding-bottom:110px; position:relative`** (tabbar clearance + film-grain stacking context invariants).
  - Line 209: NEW `.phone-shell{max-width:480px;margin:0 auto;width:100%}` declaration.
  - Lines 2329-2359: NEW `@media (min-width: 900px)` block, placed immediately after the Phase 9 / DESIGN-03 section (line 2327 was the last pre-existing line). Block contents:
    - `.phone-shell`, `.tabbar`, `.who-mini`: max-width 520px (sticky bars align with desktop content column)
    - `.modal`: max-width 640px (general modal reading width)
    - `.wp-live-modal`: max-width 800px + max-height 85vh (Phase 7 UAT closure)
    - `.wp-live-header / -body / -footer`: padding bumps for the wider column
    - `.yir-modal, .yir-story-modal`: max-width 720px
    - `.avatar-picker-modal`: 540px / `.manual-modal`: 560px / `.schedule-modal`: 480px
    - `.swipe-card`: max-width 480px + height min(640px, 80vh) (preserves portrait card ratio on desktop)

## Selector Pre-Flight Audit (Threat T-09-04-03)

Per the plan's Task 2 Step instructions, every selector in the @media block was grepped against current `css/app.css` BEFORE committing the block. All 14 selectors found in the baseline:

| Selector | Baseline rule count | Status |
|---|---|---|
| `.phone-shell` | 0 (introduced in Task 1, present at commit-2 time) | EXPANDED |
| `.tabbar` | 1 | EXPANDED |
| `.who-mini` | 5 | EXPANDED |
| `.modal` | 19 | EXPANDED |
| `.wp-live-modal` | 1 | EXPANDED |
| `.wp-live-header` | 1 | EXPANDED |
| `.wp-live-body` | 1 | EXPANDED |
| `.wp-live-footer` | 1 | EXPANDED |
| `.yir-modal` | 1 | EXPANDED |
| `.yir-story-modal` | 1 | EXPANDED |
| `.avatar-picker-modal` | 4 | EXPANDED |
| `.manual-modal` | 6 | EXPANDED |
| `.schedule-modal` | 5 | EXPANDED |
| `.swipe-card` | 7 | EXPANDED |

**Selectors pruned as stale: NONE.** Plan's research references all matched current css/app.css state.

## Invariants Verified Post-Commit

- `body { padding-bottom: 110px }` preserved on the body rule (`grep -qE 'padding-bottom:\s*110px' css/app.css` → true). Tabbar clearance invariant intact (T-09-04-06).
- `body` no longer has `max-width` (`grep -qE '^body\{[^}]*max-width' css/app.css` → false).
- Single `@media (min-width: 900px)` block — no second breakpoint added.
- @media block does NOT override `body { padding-bottom: ... }` — mobile-first clearance carries through to desktop (verified via node regex scan of the block's contents).
- Zero rules outside the @media block were touched in commit 2 (`git diff f4297ee~1 -- css/app.css` shows only insertions at end of file).
- Existing @media blocks at lines 95, 1634, 1660, 1972, 2017 untouched.
- Zero JS modifications.

## Decisions Made

- Wrapper closing tag placed at line 977 (after `</div>` of app-shell at 976), keeping the legal-footer + script outside. Legal-footer's `position:fixed` makes ancestry irrelevant; `<script>` is non-visual.
- Wrapper opening at line 58 (immediately before #signin-screen) — the skip-link inside #app-shell is naturally inside the wrapper as a side effect, which is the recommended placement (target is also inside).
- Added an HTML comment `<!-- /.phone-shell -->` to the closing div to make the wrapper boundary self-documenting in a long file (no behavioral cost).
- @media block placed AFTER the Phase 9 / DESIGN-03 section per plan recommendation — top-to-bottom reading of the file matches mobile-first intent.

## Deviations from Plan

None — plan executed exactly as written. All gates passed on first attempt; no auto-fixes triggered.

## Issues Encountered

None. The plan's frontmatter indicated body rule was at line 101 but it had migrated to line 208 (post 09-02 + 09-03 additions to the token layer). This was anticipated by the executor brief ("Treat the plan's line-number references as approximate — verify with grep/Read before each edit"). Verified actual location via grep, then edited the correct line.

## Next Phase Readiness

- **Task 3 ready for human-verify checkpoint.** User runs the multi-viewport smoke test (iOS physical device + Chrome DevTools at iPhone / iPad Air portrait / iPad Pro portrait + landscape / 1440 desktop / 1920 desktop) plus the dedicated tabbar-clearance probe (step 10 of Task 3) on every viewport.
- **No deploy.** Plan does not run `firebase deploy` until Task 3 passes.
- After Task 3 approval: `.planning/STATE.md` should record DESIGN-04 second half closed and Phase 7 UAT deferred gap (watchparty desktop modal width) closed.

---
*Phase: 09-redesign-brand-marketing-surface, plan 04*
*Completed: 2026-04-22*
