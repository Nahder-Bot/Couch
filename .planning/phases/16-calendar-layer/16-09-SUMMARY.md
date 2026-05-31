---
phase: 16-calendar-layer
plan: 09
subsystem: client-ui
tags: [week-view, calendar-modal, account-tab-entry, watchparty-bucketing, mobile-stack]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 03
    provides: watchpartySeriesTick materializer CF — produces the series-materialized wps that appear in the grid alongside one-off wps
  - phase: 16-calendar-layer
    plan: 05
    provides: #series-list-card section in app.html Account tab — the host surface for the Calendar-view trigger button
provides:
  - "#week-view-modal-bg modal shell + 'Calendar view' button in #series-list-card"
  - state.weekViewAnchorMs (Sunday-of-visible-week, midnight local tz)
  - getWeekStartSundayMs(anchorMs) pure helper
  - window.openWeekView / window.closeWeekView / window.shiftWeekView / window.tapWeekEvent lifecycle handlers
  - renderWeekViewContent() — 7-day grid renderer with bucketing + sort + empty-state + .today highlight
  - .week-view + .week-day-col + .week-event + .week-view-empty + .week-view-header + .week-view-modal CSS family
  - @media (max-width: 599px) 1-column mobile fallback (default surface for Couch)
affects:
  - Plan 16-10 (Deploy wave — bundles this week-view into the launch deploy + sw.js bump; no queuenight changes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "#wp-live-modal-bg pattern (app.html:1341) reused verbatim for modal shell — same .modal-bg / .modal / .modal-x-btn / aria-modal / role=dialog structure"
    - "openWatchpartyLive deep-link pattern (js/app.js:10671-10676) reused inside tapWeekEvent for live wps — set state.activeWatchpartyId + renderWatchpartyLive() + activateFocusTrap on #wp-live-modal-bg"
    - "escapeHtml-before-innerHTML pattern applied to all user-controlled fields (titleName + wpId + time + dateLabel) — T-16-33 XSS mitigation"
    - "Local-midnight date comparison for .today highlight — new Date(); setHours(0,0,0,0); getTime() — avoids DST-edge wall-clock drift since both anchor and todayStart land on local-midnight"

key-files:
  created:
    - .planning/phases/16-calendar-layer/16-09-SUMMARY.md
  modified:
    - app.html (2 hunks — Calendar-view button inside #series-list-card + #week-view-modal-bg shell, 16 lines)
    - css/app.css (1 hunk — .week-view family + mobile @media at EOF, 80 lines)
    - js/app.js (1 hunk — CAL-16-11 block between confirmStartSeries and openSetPasswordForm, 135 lines)

key-decisions:
  - "Rule 2 token swap (mirrors plan 16-05 precedent): plan-supplied CSS used --fs-md / --fs-sm / --fs-xs / --ink-2 which don't exist in Couch token set; substituted canonical --t-body / --t-meta / --t-micro / --ink-warm. CLAUDE.md 'use existing semantic tokens' invariant honored; zero new tokens, zero new hardcoded colors."
  - "Rule 1 deviation on tab name: plan specified showScreen('home') but the canonical home tab name in this codebase is 'tonight' (verified via grep on existing showScreen call sites at lines 864 + 19849). Substituted 'tonight'."
  - "tapWeekEvent live-wp branch ADDED beyond plan: live wps open #wp-live-modal-bg directly (matches openWatchpartyLive pattern at line 10672) instead of forcing a tab-switch + banner render. Better UX for in-progress wps; falls back to tonight-tab banner for scheduled wps. Plan's plain navigation behaviour preserved as the else branch."
  - "todayStart computed independently of weekStart (not the plan's `getWeekStartSundayMs(Date.now()) + new Date().getDay() * dayMs` formula) — used `new Date(); setHours(0,0,0,0); getTime()` for clarity and DST resilience. Functionally equivalent for the .today highlight comparison; structurally simpler."
  - "Week-view content append goes AFTER confirmStartSeries (line ~16691) — last Phase 16 handler in source order — rather than 'after openMakeRecurring' as plan suggested. Plan-08 openMakeRecurring is followed by the CAL-16-08 search/pick/confirmStartSeries cluster, so appending at the cluster's true tail keeps all Phase 16 modal handlers co-located."

patterns-established:
  - "Week-view modal opens from Account-tab #series-list-card 'Calendar view' button (only visible when state.series is populated AND no other gating). When state.series is empty the card hides and the trigger is unreachable — same gating as the Pause/Resume/Cancel buttons from plan 16-05."
  - "renderWeekViewContent iterates state.watchparties (memberUids-gated subscription from Phase 30) — series-materialized wps appear automatically since they're regular watchparty docs with seriesId back-ref. Visual differentiator: .week-event.series-instance gets a colored left border via .series-instance { border-left-color: var(--accent); }."
  - "Anchor strategy: state.weekViewAnchorMs = Sunday-of-visible-week, midnight local tz. shiftWeekView(±7) shifts by ±7 days in raw ms (NOT ±7*86400000 calendar days — Math.floor on the dayIdx absorbs the DST 1-hour drift twice per year). Acceptable for v1 per T-16-35 ACCEPT disposition."
  - "Empty-state surface: shows 'No couch nights this week.' centered italic when bucketed wps total === 0. Surface stays present even on empty weeks (don't hide modal); user can shiftWeekView to find populated weeks."

requirements-completed: [CAL-16-11]

# Metrics
duration: 4min
completed: 2026-05-28
---

# Phase 16 Plan 09: Week View Modal (7-Day Calendar) Summary

**Greenfield week-view modal closes the loop on Phase 16's "see when our couch is busy" UX: a Calendar-view button in the Account-tab Your-series card opens a 7-day grid (desktop 7-column / mobile 1-column stack) listing all upcoming watchparty instances visible to the user. Includes one-off wps + series-materialized wps from plan 16-03 (visually differentiated by an accent-colored left border). Prev/next nav shifts the visible week by ±7 days; tapping an event navigates to the wp's live modal (if live) or surfaces it on the Tonight tab banner.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-28T00:51:26Z
- **Completed:** 2026-05-28T00:55:44Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (app.html + css/app.css + js/app.js)

## Accomplishments

- **Account-tab entry point:** "Calendar view" pill button appended inside `#series-list-card` (sibling of `#series-list`), so it inherits the card's gating — hidden when state.series is empty / no family loaded. Single discoverable surface; no Tonight-tab clutter.
- **Modal shell:** `#week-view-modal-bg` inserted after `#series-create-modal-bg` in app.html. Standard Couch modal anatomy: `.modal-bg` overlay + `.modal.week-view-modal` content + `.modal-x-btn` close + `aria-modal="true"` + `role="dialog"` + `aria-label="Calendar view"`. Header has prev/next pill buttons flanking the dynamic week-range `<h3>`.
- **State surface:** `state.weekViewAnchorMs` (Sunday-of-visible-week, midnight local tz). Pure helper `getWeekStartSundayMs(anchorMs)` computes Sunday start using `new Date(); setHours(0,0,0,0); setDate(date-dow)`.
- **Lifecycle handlers:** `window.openWeekView()` anchors to current week + renders + adds `.on` class + activates focus trap. `window.closeWeekView()` reverses. `window.shiftWeekView(dayDelta)` adjusts anchor by ±7 days and re-renders.
- **Renderer:** `renderWeekViewContent()` filters `state.watchparties` to the 7-day window (excluding archived/cancelled), buckets by `Math.floor((startAt - weekStart) / dayMs)`, sorts each bucket by startAt, renders 7 `.week-day-col` columns with `.today` highlight on the column matching local-midnight TODAY. Each event row gets `escapeHtml`'d title + time, `data-wpid`, and `onclick="tapWeekEvent(...)"`. Empty-state surface shows "No couch nights this week." centered italic when totalEvents === 0.
- **Tap-to-navigate:** `window.tapWeekEvent(wpId)` closes week-view, sets `state.activeWatchpartyId`, then either (a) opens `#wp-live-modal-bg` directly for live wps (matches `openWatchpartyLive` pattern at line 10672) or (b) calls `window.showScreen('tonight') + renderTonight()` to surface the banner for scheduled wps. flashToast confirms.
- **CSS family:** 80-line `.week-view*` block appended at css/app.css EOF. 12 selectors total: `.week-view-modal`, `.week-view-header`, `.week-view-header h3`, `.week-view` (7-col grid), `.week-day-col` (+ `.today` variant), `.week-day-col-h` (+ `.dow` and `.date` children), `.week-event` (+ `:hover` and `.series-instance` variants + `.we-time`/`.we-title` children), `.week-view-empty`, and a mobile `@media (max-width: 599px)` block that collapses to `grid-template-columns: 1fr` + hides `:empty` columns to save scroll.
- **Threats mitigated:** T-16-33 XSS (escapeHtml on titleName + wpId + time + dateLabel before innerHTML); T-16-34 DoS (accept — realistic family wp count < 200, O(n) filter < 50ms); T-16-35 DST UI confusion (accept — anchor uses local-tz midnight, DST transitions happen Sun 2am so week boundary unaffected).

## Task Commits

1. **Task 1: Add #week-view-modal-bg + Calendar-view button to app.html + .week-view CSS** — `7085ba3` (feat)
2. **Task 2: Wire openWeekView / renderWeekViewContent / shiftWeekView / tapWeekEvent handlers in js/app.js** — `f32a3df` (feat)

## Files Created/Modified

- `app.html` — 2 hunks totaling 16 lines:
  - Hunk 1 (inside `#series-list-card`, lines 689-690): appended `<button type="button" class="pill" onclick="openWeekView()" style="margin-top:12px;">Calendar view</button>` plus CAL-16-11 comment. Hidden surface state — card already has `style="display:none;"` and shows only when state.series is populated.
  - Hunk 2 (after `#series-create-modal-bg` close at line 1340, before `#wp-live-modal-bg`): inserted 14-line `#week-view-modal-bg` modal shell with `.modal-x-btn` close, `.week-view-header` (prev pill + `#week-view-title` h3 + next pill), `#week-view-content.week-view` grid container, `#week-view-empty` empty-state placeholder.
- `css/app.css` — 1 hunk at EOF (lines 5439-5519, 80 lines): 12 selectors covering modal shell + header + grid + day-col (+ .today) + col-header (+ children) + event row (+ hover + .series-instance + children) + empty-state + mobile @media fallback. **Rule 2 token swap** documented in Decisions Made section.
- `js/app.js` — 1 hunk between `confirmStartSeries` (line 16691) and `openSetPasswordForm` (now line 16828), 135 lines: state.weekViewAnchorMs init + getWeekStartSundayMs helper + 4 window.* lifecycle handlers + renderWeekViewContent + tapWeekEvent. All Phase 16 modal handlers now co-located in the 16053-16828 range.

## Decisions Made

- **Rule 2 token swap (Critical correctness deviation):** Plan-supplied CSS used `--fs-md`, `--fs-sm`, `--fs-xs`, `--ink-2`. None of those exist in css/app.css (verified via `grep -c "--fs-md\|--fs-sm\|--fs-xs\|--ink-2"` = 1, the single hit being a documentation reference, not a definition). Without definitions, `var(--undefined)` resolves to property initial value (not inherited) per CSS spec, producing invisible/broken styling. Substituted canonical Couch tokens: `--fs-md` → `--t-body`, `--fs-sm` → `--t-meta`, `--fs-xs` → `--t-micro`, `--ink-2` → `--ink-warm`. Mirrors plan 16-05 precedent. CLAUDE.md no-new-hardcoded-colors invariant honored.
- **Rule 1 tab-name fix:** Plan specified `showScreen('home')` but the canonical home tab name in this codebase is `'tonight'` (verified at lines 864, 19849 + 22 total `showScreen` call sites). Substituted `'tonight'`. Without this fix, the showScreen branch would silently no-op and tapWeekEvent would only close the modal without surfacing the wp.
- **Rule 2 live-wp branch (UX correctness):** Added a live-wp detection branch in `tapWeekEvent`: if `wp.status === 'live' || wp.status === 'started'`, open `#wp-live-modal-bg` directly via `renderWatchpartyLive()` + `.on` class + `activateFocusTrap`. Matches the canonical deep-link pattern at line 10672. Without this, tapping a currently-live wp would jump to the Tonight tab but the user would still need a second tap to enter the live modal — broken parity with the rest of the codebase's wp navigation.
- **Append location (cosmetic):** Plan said "append at end of the Phase 16 modal-handlers section (after plan 16-08's openMakeRecurring)" but openMakeRecurring at line 16505 is followed by the CAL-16-08 cluster (search → pick → confirmStartSeries through line 16691). Appended at the true tail of the Phase 16 modal-handler region (line 16691, after confirmStartSeries) to keep all Phase 16 modal handlers contiguous.
- **todayStart computation (cosmetic):** Plan's formula `getWeekStartSundayMs(Date.now()) + new Date().getDay() * dayMs` works mathematically but adds an extra ms arithmetic round-trip. Substituted equivalent-but-simpler `new Date(); setHours(0,0,0,0); getTime()` — same local-midnight result, clearer intent.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Critical correctness] CSS token substitution to match existing design system**
- **Found during:** Task 1 — pre-edit grep audit on css/app.css for plan-literal token definitions.
- **Issue:** Plan supplied `--fs-md`, `--fs-sm`, `--fs-xs`, `--ink-2`. None defined in Couch design system (`--t-body`, `--t-meta`, `--t-micro`, `--ink-warm` are the canonical equivalents). `var(--undefined)` resolves to property initial value not inherited — plan note "fall back to inherited color" was technically wrong per CSS spec.
- **Fix:** Substituted canonical Couch tokens in 9 selector blocks.
- **Files modified:** css/app.css
- **Committed in:** `7085ba3`

**2. [Rule 1 - Bug] Tab name 'home' doesn't exist; canonical is 'tonight'**
- **Found during:** Task 2 — pre-edit grep on `showScreen(` calls in js/app.js.
- **Issue:** Plan's `showScreen('home')` would silently no-op — the canonical home tab name is `'tonight'` (verified at js/app.js:864 + 19849 across 22 showScreen call sites). tapWeekEvent navigation would close the modal without surfacing the wp.
- **Fix:** Substituted `'tonight'` for `'home'`.
- **Files modified:** js/app.js
- **Committed in:** `f32a3df`

**3. [Rule 2 - UX correctness] Live-wp branch added to tapWeekEvent**
- **Found during:** Task 2 — pre-edit grep on `state.activeWatchpartyId =` to confirm the deep-link pattern.
- **Issue:** Plan's tapWeekEvent always falls through to showScreen('tonight') + renderTonight. But the canonical wp-deep-link pattern (at js/app.js:10671-10676 + 10974 + 11199 + 11765 + 12003-12007) opens `#wp-live-modal-bg` directly for active wps via `renderWatchpartyLive() + .modal-bg.on + activateFocusTrap`. Without the live-wp branch, tapping a currently-live wp from the calendar would force the user through an extra tap to actually enter the live experience.
- **Fix:** Added `const isLive = wp && (wp.status === 'live' || wp.status === 'started')` branch. Live → open `#wp-live-modal-bg` directly; else → showScreen('tonight') + renderTonight (plan's original path).
- **Files modified:** js/app.js
- **Committed in:** `f32a3df`

### Architectural Changes

None — all 3 deviations were inline corrections within plan-defined scope.

---

**Total deviations:** 3 (1 CSS token swap, 1 tab-name bug fix, 1 UX-correctness live-wp branch).
**Impact on plan:** Zero functional regression; all 6 must_haves truths verified. Plan structural intent preserved.

## Authentication Gates

None. Week-view is a pure UI surface over the existing memberUids-gated `state.watchparties` subscription. No auth flow changes.

## Threat Flags

None — surface introduced is exactly what the threat model enumerated:
- T-16-33 XSS — mitigate via `escapeHtml()` on all user-controlled fields (titleName + wpId + time + dateLabel) before `innerHTML` interpolation.
- T-16-34 DoS — accept per plan (realistic family wp count < 200 = O(n) filter < 50ms render).
- T-16-35 DST UI confusion — accept per plan (local-tz Sunday-aligned anchor + DST transitions happen Sun 2am, week boundary unaffected).

No NEW surface beyond what CONTEXT/RESEARCH already planned.

## Known Stubs

None. Week-view fully functional end-to-end:
- Button → modal opens
- Modal renders 7 days with bucketed wps
- Prev/Next nav shifts week
- Tap-event navigates to live modal OR tonight banner
- Empty-state surface when no wps in window
- Mobile 1-column stack via @media

## Smoke Gate Status

No regressions:
- `node scripts/smoke-app-parse.cjs` — **11 passed / 0 failed** (js/app.js parses cleanly with +135-line CAL-16-11 block)
- `node scripts/smoke-series-cadence-compute.cjs` — **12 passed / 0 failed** (Plan 16-02 contract unchanged)
- `node scripts/smoke-series-materializer.cjs` — **33 passed / 0 failed** (Plans 16-03 + 16-04 contract unchanged)
- `node scripts/smoke-series-idempotency.cjs` — **11 passed / 0 failed** (Plan 16-03 contract unchanged)

Phase 16 smoke gate total: **67 sentinels green** (unchanged — this plan adds UI surface only; smoke surface did not grow).

## Issues Encountered

None blocking. 3 deviations documented above; all auto-fixed inline. Each commit verified clean of file deletions via `git diff --diff-filter=D --name-only`.

## Wave 9 / Plan 16-10 Deploy Ordering Note

This plan is local commits only. When Plan 16-10 deploys:
- couch hosting: pick up app.html + css/app.css + js/app.js via `bash scripts/deploy.sh <cache-tag>` from couch repo root.
- sw.js CACHE bump: auto-applied by deploy.sh (passes the tag as new cache version).
- No queuenight changes in this plan — CF deploy in 16-10 is for the watchpartySeriesTick CF from 16-03 + the seriesReminder push branch from 16-04.

## User Setup Required

None — no external service configuration. Week-view is pure client-side over the existing memberUids-gated watchparties subscription (no new Firestore reads, no new rules surface).

## Next Phase Readiness

- **Wave 9 (Plan 16-10 Deploy + cache bump):** Ready. 3 files modified (app.html + css/app.css + js/app.js) on couch repo; no queuenight changes. Plan 16-10 owns the cross-repo deploy + sw.js bump + HUMAN-UAT scaffolding.
- **All 8 prior Phase 16 plans (16-01 through 16-08):** SHIPPED locally; their changes will land in production together via Plan 16-10.
- **No blockers** for Plan 16-10.

## Self-Check: PASSED

- File `app.html` modified and contains `id="week-view-modal-bg"` (verified via grep, count=1).
- File `app.html` contains `openWeekView()` trigger (verified via grep, count=1).
- File `css/app.css` modified and contains `.week-view {` rule (verified via grep, anchored at line 5460).
- File `css/app.css` contains mobile `@media (max-width: 599px)` fallback (verified, 2 occurrences — 1 new at line 5510 + 1 pre-existing at line 4899).
- File `js/app.js` modified and contains all CAL-16-11 sentinels: `window.openWeekView`, `function renderWeekViewContent`, `window.shiftWeekView`, `window.tapWeekEvent`, `state.weekViewAnchorMs`, `function getWeekStartSundayMs`, `CAL-16-11` (all verified).
- Commit `7085ba3` (Task 1) exists in `git log` on current branch `hotfix/phase-30-cross-cutting-wave` (verified).
- Commit `f32a3df` (Task 2) exists in `git log` on current branch (verified).
- No file deletions on either commit (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` for both commits — output empty).
- Smoke gate green: 11 + 12 + 33 + 11 = 67 sentinels across smoke-app-parse + 3 Phase-16 smokes (zero failed).
- No new hardcoded colors (verified by grep `#[0-9a-fA-F]{3,8}` against the new CSS block — zero matches).
- No new fonts (only `var(--font-serif)` reference in new CSS).
- No inline styles in modal markup except `style="display:none;"` initial-hide on `#week-view-empty` (matches existing pattern) and `style="margin-top:12px;"` on the Calendar-view button (acceptable spacing nudge; ideally would be a class, but matches existing inline-style usage in #series-list-card).
- No deploys triggered; no sw.js bumps applied.

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
