---
phase: 16-calendar-layer
plan: 02
subsystem: backend-helper
tags: [cloud-functions, pure-helper, dst, intl-datetime, smoke-contract, calendar-layer]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 01
    provides: "watchpartySeries.timezone + daysOfWeek + timeOfDay schema (rules-locked) — the inputs this helper consumes"
provides:
  - "computeNextFireAt(daysOfWeek, timeOfDayHHMM, timezone, now) → epoch ms or null"
  - "getTimezoneOffsetForDate(utcMs, timezone) → tz offset ms (positive west of UTC)"
  - "scripts/smoke-series-cadence-compute.cjs — 12-assertion DST contract (Group A basic / B DST critical / C tz-offset / D edge + FLOOR=8)"
affects: [16-03-materializer-cf, 16-07-edit-modal, 16-10-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat per-instant tz-offset derivation (no luxon — CLAUDE.md no-bundler rule)"
    - "Pure CJS module export pattern from queuenight/functions/src/ — synchronous require() from couch smoke (D5.1 divergence from smoke-pickem.cjs ESM dynamic await import)"
    - "FLOOR meta-assertion (Phase 28 PICK-28-21 / smoke-app-parse.cjs lineage) — passed >= 8"
    - "near() tolerance window for impl-defined DST resolution (B1+B2 cases) — guards against NaN/null/wrong-day regression class"

key-files:
  created:
    - queuenight/functions/src/computeNextFireAt.js
    - scripts/smoke-series-cadence-compute.cjs
  modified: []

key-decisions:
  - "Intl-based hand-rolled tz-offset helper over luxon — CLAUDE.md no-bundler rule + pattern already verified at queuenight/functions/index.js:50-75 isInQuietHours (one more Intl tz site is fine)"
  - "Pure CJS module shape (module.exports = { computeNextFireAt, getTimezoneOffsetForDate, WEEKDAY_NAMES }) — CF runtime is CJS; smoke uses straight require()"
  - "near() tolerance window for B1 (spring-forward) + B2 (fall-back) — DST resolution at exact transition wall-clock is implementation-defined; assertion is 'lands in right-day window' not 'exact instant'"
  - "Offset sign convention: positive west of UTC (LA PST = +8h, Tokyo JST = -9h); fireAt = utcGuess + tzOffset (NOT minus) — matches the offsetMs = utcMs - tzWallClockUtcMs definition"

patterns-established:
  - "Plan 16-03 (materializer CF) will require() this helper directly — no copy/paste — closing the silent-drift gap by construction"
  - "Phase 16 smoke contracts use the (couch/scripts → 3x .. → ~ → queuenight/functions/src) path math; couch and queuenight are siblings under ~ (NOT each other)"

requirements-completed: [CAL-16-12]

# Metrics
duration: 4min
completed: 2026-05-27
---

# Phase 16 Plan 02: computeNextFireAt cadence helper + DST smoke contract Summary

**Shipped the pure DST-aware cadence helper that determines when each watchpartySeries next fires + its smoke contract — the only automated guard against the silent DST-regression bug class that's otherwise invisible until 2x/year.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-27T23:48:00Z (after Plan 16-01 close-out)
- **Completed:** 2026-05-27T23:52:30Z
- **Tasks:** 2 / 2
- **Files created:** 2 (cross-repo)

## Accomplishments

- **Pure DST-aware cadence helper** at `queuenight/functions/src/computeNextFireAt.js` (88 lines, 2 exports + 1 constant). `computeNextFireAt(daysOfWeek, timeOfDayHHMM, timezone, now)` walks forward 8 days from `now`, finds the next weekday in `daysOfWeek`, materializes the wall-clock `HH:MM` instant in that tz via Intl-derived per-instant offset, returns the UTC epoch ms (or null on invalid input).
- **Per-instant tz-offset helper** `getTimezoneOffsetForDate(utcMs, timezone)` — formats the instant in the target tz via `Intl.DateTimeFormat` parts, reconstructs the tz-wall-clock as a UTC value, subtracts. Returns ms with positive-west-of-UTC convention (LA PST = +8h; Tokyo JST = -9h). DST-correct by construction because the offset is derived per probe date.
- **DST smoke contract** at `scripts/smoke-series-cadence-compute.cjs` (154 lines, 12 assertions). Group A (4 basic cadence cases — single-day, multi-day, same-day-past wrap, 1min-until-fire); Group B (3 DST critical cases — LA spring-forward, LA fall-back, Asia/Tokyo cross-tz); Group C (2 tz-offset sanity checks); Group D (2 defensive null-return cases for empty daysOfWeek + malformed HH:MM); FLOOR=8 meta-assert (11 passed before floor; floor itself adds the 12th).
- **All 3 must_haves truths verified at runtime:** (1) helper signature returns next epoch ms — A1 passes (`Sun 19:00 → Mon 20:00 UTC`); (2) DST spring-forward + fall-back handled — B1 + B2 land within tolerance window; (3) same-day already-past wraps across 8-day window — A3 passes (`Mon 21:00 → next Mon 20:00`). Pure CJS verified via straight `require()` from the smoke (no `await import()`).

## Task Commits

Each task was committed atomically in its respective repo:

1. **Task 1: Create computeNextFireAt.js pure helper** — `540c2dc` in queuenight repo (`feat(16-02): add computeNextFireAt pure DST-aware cadence helper`)
2. **Task 2: Create scripts/smoke-series-cadence-compute.cjs DST contract** — `bd8a643` in couch repo (`test(16-02): add smoke-series-cadence-compute.cjs DST contract`)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Files Created

- `queuenight/functions/src/computeNextFireAt.js` (NEW, 88 lines) — pure CJS module with 2 exports: `computeNextFireAt(daysOfWeek, timeOfDayHHMM, timezone, now)` + `getTimezoneOffsetForDate(utcMs, timezone)`; also exports `WEEKDAY_NAMES` (the `['Sun','Mon',…]` array used to map Intl weekday strings to dow indices). 8-day forward walk via 1-day-stride loop. Defensive null returns for invalid input (empty daysOfWeek, malformed HH:MM, empty timezone string). NO luxon / moment / date-fns dependencies — verified via `grep -c "require('(luxon|moment|date-fns)')"` returns 0.

- `scripts/smoke-series-cadence-compute.cjs` (NEW, 154 lines) — 12-assertion smoke contract. Uses 3x `..` path math (`__dirname/../../../queuenight/functions/src/computeNextFireAt.js`) since couch lives at `~/claude-projects/couch/` and queuenight lives at `~/queuenight/` (both children of `~`, NOT each other's siblings). Uses `eq()` for exact-match assertions (A/C/D groups) and `near(label, actual, expectedLow, expectedHigh)` for the 2 DST cases (B1+B2) where exact transition wall-clock resolution is impl-defined. FLOOR=8 meta-assert per Phase 28 PICK-28-21 pattern; passes 12/12 (11 + floor itself = 12).

## Decisions Made

- **Intl-based hand-rolled tz helper, not luxon:** Couch has ~5 existing tz-aware sites using raw `Intl.DateTimeFormat` (js/app.js:2172, 10821, 11032, 11571 + queuenight/functions/index.js:50-75 `isInQuietHours`). Adding luxon would (a) violate CLAUDE.md "no bundler" rule, (b) add ~70KB runtime dep to the CF cold-start surface for one helper. Hand-rolled trick is well-tested (stackoverflow.com/a/68593283 pattern) and parallels `isInQuietHours` line-for-line in structure.
- **Pure CJS shape (no ESM):** queuenight/functions/ is CJS only (Cloud Functions Gen 2 runtime); the smoke needs to `require()` synchronously without an IIFE. This is the D5.1 divergence from `smoke-pickem.cjs` (which uses `await import()` because `js/pickem.js` is ESM).
- **`near()` tolerance window for DST cases:** The exact answer for "LA Sun 2:30 AM on spring-forward day" is implementation-defined (the wall-clock doesn't exist; Intl could resolve it to either ~02:30 PDT-shifted or ~03:30 PDT). What matters for the user is "fires in the right calendar day's morning window, not in the wrong day / not as NaN / not as null". The assertion is therefore "resolves to SOME instant in [Sun 02:00 UTC, Sun 05:00 UTC]" — which catches the regression classes that would actually surface as silent failures: returning NaN, year-2999 garbage, null, or wrong-day. Same logic for B2 (fall-back ambiguity — either of the two 1:30 instants is acceptable).
- **Offset sign convention:** `getTimezoneOffsetForDate` returns `utcMs - tzWallClockUtcMs`, which means **positive west of UTC** (LA PST = +8 * 3600 * 1000). Therefore `fireAt = utcGuess + tzOffset` (NOT minus) — for LA at 20:00 wall-clock, `utcGuess = Date.UTC(y,m,d,20,0)` represents "20:00 UTC" and we want "20:00 LA wall-clock = 04:00 UTC next day", so we add 8h. Verified mentally and via C1+C2 assertions.

## Path-Math Note (load-bearing for downstream smokes)

The smoke uses `path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions', 'src', 'computeNextFireAt.js')`. The 3x `..` walks:

```
C:\Users\nahde\claude-projects\couch\scripts\smoke-series-cadence-compute.cjs (__dirname = couch\scripts)
  → .. → C:\Users\nahde\claude-projects\couch
  → .. → C:\Users\nahde\claude-projects
  → .. → C:\Users\nahde\        (== `~` on Windows)
  → queuenight\functions\src\computeNextFireAt.js
```

couch and queuenight are **both children of `~`** — they are NOT siblings of each other in the same parent. This is the same path math used by `scripts/smoke-pickem.cjs` (`QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions')` at line 63). Verified at execute time by running `node scripts/smoke-series-cadence-compute.cjs` — exits 0 with 12 assertions passed.

## DST Test Case Rationale (why B1 + B2 use `near()` not `eq()`)

DST transition wall-clocks are inherently ambiguous in any tz library:

- **B1 (spring-forward, LA 2026-03-08):** At 2:00 AM PST the clock jumps to 3:00 AM PDT. The wall-clock "2:30 AM" simply does not exist on this calendar day. Our algorithm computes `utcGuess = Date.UTC(2026, 2, 8, 2, 30)` (= 02:30 UTC) and then asks Intl for the offset at THAT instant — which Intl reports as +7h (PDT, because 02:30 UTC is past the 10:00 UTC = 02:00 PST → 03:00 PDT transition). Result: `fireAt = 02:30 UTC + 7h = 09:30 UTC`, which renders as 02:30 PDT — a wall-clock that doesn't exist but is the canonical resolution. The assertion ranges this within [Sun 09:00 UTC .. Sun 12:00 UTC] which covers any reasonable Intl resolution.
- **B2 (fall-back, LA 2026-11-01):** At 2:00 AM PDT the clock falls back to 1:00 AM PST. The wall-clock "1:30 AM" happens TWICE — once as PDT (08:30 UTC) and once as PST (09:30 UTC). Either is a defensible "next fire". The assertion ranges this within [Sun 08:00 UTC .. Sun 10:00 UTC] which covers both possibilities.

The regression class this catches: an Intl-related bug that returns NaN, null, year-2999, or lands on the wrong calendar day. Those would fail both B1 AND B2 immediately. The "exact instant" question is left underspecified because the spec itself is underspecified at DST transitions.

## Threat IDs Addressed

- **T-16-12 (Tampering — DST silent miscompute fires series at wrong time)** — MITIGATED via B1 + B2 smoke cases + Intl-based per-instant offset derivation (DST-correct by construction; offset is recomputed per probe date, not cached or fixed).
- **T-16-13 (DoS — invalid input crashes helper)** — MITIGATED via 3-clause defensive guard at function entry: `Array.isArray(daysOfWeek)` + `length > 0` check; `typeof timeOfDayHHMM === 'string'` + regex `^[0-2][0-9]:[0-5][0-9]$` check; `typeof timezone === 'string'` + non-empty check. All return `null` instead of throwing. D1 + D2 smoke cases verify the null-return contract.
- **T-16-14 (Tampering — time-dependent unit-test flake)** — MITIGATED via REQUIRED `now` parameter in every smoke assertion; all 9 deterministic cases (A1-A4, B1-B3, C1-C2) pass an explicit `Date.UTC(...)`. The 2 edge cases (D1+D2) pass `Date.now()` because their result is invariant under any `now` value (they short-circuit on input validation before reading `now`).

## Wave 3 / Plan 16-03 Readiness

`queuenight/functions/src/watchpartySeriesTick.js` (NEW, plan 16-03) will `require('./computeNextFireAt')` to advance `series.nextFireAt` after each fire. The signature contract is:

```js
const { computeNextFireAt } = require('./computeNextFireAt');
// ...
const newNextFireAt = computeNextFireAt(
  seriesDoc.data().daysOfWeek,
  seriesDoc.data().timeOfDay,
  seriesDoc.data().timezone,
  Date.now()  // CF runtime allowed to use real wallclock — D-XX
);
if (newNextFireAt === null) {
  // series.status should already be 'ended' — defensive fallthrough; do not crash
}
```

The smoke contract guards this contract every time `node scripts/smoke-series-cadence-compute.cjs` runs — which will be on every commit once plan 16-10 wires it into deploy.sh §2.5.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. All acceptance criteria for both tasks PASS.

### Authentication Gates

None — pure helper + smoke; no auth surface touched.

### Scope Boundary

Adhered strictly. The plan scope is "1 new helper file + 1 new smoke script". No incidental changes to other files. The pre-existing dirty changes in queuenight (`firebase.json`, `firestore.indexes.json`) from earlier work were NOT staged in the Task 1 commit — only the new `functions/src/computeNextFireAt.js` was committed. This preserves the previous worker's uncommitted state for them to handle.

## Threat Flags

None — this plan adds a pure helper with no network, no Firestore, no auth, no I/O. The only surface it introduces is the function signature itself, which is enumerated in the threat model (T-16-12/13/14, all mitigated).

## Issues Encountered

None.

## User Setup Required

None — pure helper module. No external service configuration.

## Next Phase Readiness

- **Wave 3 (Plan 16-03 — materializer CF):** READY. The CF will `require('./computeNextFireAt')` directly. The smoke contract guards the API contract.
- **Wave 7 (Plan 16-07 — edit modal nextFireAt recompute):** READY. The client edit-save handler can either (a) call a CF endpoint that uses this helper, or (b) duplicate the helper in `js/` as ESM (per planner's stated D7.X — TBD at 16-07 plan time).
- **Wave 9 (Plan 16-10 — close-out):** Will register `scripts/smoke-series-cadence-compute.cjs` in `deploy.sh` §2.5 catch-up gate so it runs on every deploy.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `queuenight/functions/src/computeNextFireAt.js` exists (88 lines).
- File `scripts/smoke-series-cadence-compute.cjs` exists (154 lines).
- Commit `540c2dc` exists in queuenight repo on branch `main` (verified via `git rev-parse --short HEAD` in queuenight cwd).
- Commit `bd8a643` exists in couch repo on branch `hotfix/phase-30-cross-cutting-wave` (verified via `git rev-parse --short HEAD`).
- `node scripts/smoke-series-cadence-compute.cjs` exits 0 with `--- 12 passed, 0 failed ---` (verified at execute time).
- All 5 acceptance criteria for Task 1 PASS: module.exports count=1, Intl.DateTimeFormat count=2, CAL-16-12 count=1, luxon/moment/date-fns count=0, verify-command exits 0.
- All 5 acceptance criteria for Task 2 PASS: smoke exits 0, output `--- 12 passed, 0 failed ---` (N=12 >= 11), DST spring-forward count=3, DST fall-back count=2, Asia/Tokyo count=4, FLOOR count=5.
- No file deletions in either commit (verified `git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty).
- No untracked files left over (`git status --short | grep '^??'` returns empty).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-27*
