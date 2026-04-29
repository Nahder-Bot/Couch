---
phase: 18-availability-notifications
plan: 03
subsystem: testing
tags: [smoke-test, deploy-gate, contract-tests, pure-function, cross-repo, cjs]

# Dependency graph
requires:
  - phase: 18-availability-notifications/01
    provides: "addedBrandsFor + buildPushBody + normalizeProviderName helpers exported from queuenight/functions/index.js via module.exports"
provides:
  - "scripts/smoke-availability.cjs — pure-Node contract suite (23 assertions, ~344ms) covering D-07 diff + D-14 single-title body + D-15 batch body with 3-title and 3-brand caps"
  - "scripts/deploy.sh §2.5 third smoke if-block — every couch deploy now validates Plan 18-01's helpers before firebase publishes"
  - "package.json npm scripts — smoke:availability standalone + smoke chains all 3 contracts"
  - "Graceful skip-on-missing-queuenight contract — fs.existsSync probe + exit 0 with SKIP message means the deploy gate doesn't fail in environments without the sibling repo"
affects: ["18-04 (deploy ritual exercises this gate)", "future queuenight CF helper changes (any drift in addedBrandsFor / buildPushBody / normalizeProviderName surfaces at next deploy)"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Cross-repo require() with fs.existsSync probe + graceful skip — sibling repo coupling without hard environmental dependency"
    - "OK/FAIL line per assertion + final pass/fail aggregator — third instance of this convention (alongside smoke-position-transform + smoke-tonight-matches), now established as the project's pure-function smoke style"

key-files:
  created:
    - "scripts/smoke-availability.cjs"
  modified:
    - "scripts/deploy.sh"
    - "package.json"

key-decisions:
  - "Smoke lives in couch repo, not queuenight — couch's deploy.sh is the gate that runs on every production push, queuenight's deploy is functions-only and doesn't have a comparable pre-flight pattern"
  - "Hard-coded relative path '../../../queuenight/functions/index.js' from scripts/smoke-availability.cjs assumes the documented C:/Users/nahde/{couch,queuenight} layout per CLAUDE.md; non-default layouts skip gracefully via fs.existsSync probe"
  - "23 assertions chosen as the regression-lock threshold: 9 D-07 cases + 7 D-14/D-15 cases + 7 normalizeProviderName sanity — covers all branches of the helper logic with deterministic inputs"

patterns-established:
  - "Cross-repo smoke: pure-function helpers in a sibling repo can be regression-locked by a smoke script in the deployer repo via relative require + presence-probe + graceful skip"
  - "deploy.sh §2.5 smoke gate is the project's regression-lock surface — adding a 4th/5th contract follows the established if-block + echo-line-update pattern"

requirements-completed: [REQ-18-01, REQ-18-02]

# Metrics
duration: 8min
completed: 2026-04-29
---

# Phase 18 Plan 03: smoke-availability deploy gate Summary

**Pure-Node contract suite (23 assertions / ~344ms) regression-locks queuenight's D-07 provider-diff + D-14/D-15 push-body builders, wired into scripts/deploy.sh §2.5 with graceful skip when the sibling repo is absent.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-29T22:34:00Z (approx — reconstructed from commit timestamps)
- **Completed:** 2026-04-29T22:42:28Z
- **Tasks:** 2
- **Files modified:** 3 (1 created + 2 modified)

## Accomplishments
- `scripts/smoke-availability.cjs` (185 lines, 23 assertions) created and passing live against the queuenight Plan 18-01 helpers — covers all 6 D-07 diff scenarios (incl. normalization collapse + cold-start + null/undefined defensive inputs), 7 D-14/D-15 push-body cases (single-title verbatim, 2/3-title batches, 5-title cap-at-3 with '+N more', 6-title with 5 distinct brands → '…' brand cap), and 7 normalizeProviderName sanity cases (Amazon Prime Video, HBO Max, Disney Plus, passthroughs, null, '')
- `scripts/deploy.sh` §2.5 smoke gate extended with a 3rd if-block invoking smoke-availability — preserves the existing two smokes verbatim, gains '+ availability' on the trailing echo line, and the comment header references Phase 18-03
- `package.json` npm scripts extended: new `smoke:availability` standalone target + chained `smoke` script now runs all 3 contracts end-to-end (verified via `npm run smoke` — ALL ASSERTIONS PASSED across position + tonight + availability)
- Graceful-skip contract verified by code-review: when `fs.existsSync(QUEUENIGHT_INDEX)` returns false, the script logs SKIP with the resolved path + reason and exits 0 — deploy.sh treats this as pass, no deploy fail in environments without the queuenight sibling

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/smoke-availability.cjs with the contract test suite** — `c5fb713` (test)
2. **Task 2: Wire scripts/smoke-availability.cjs into scripts/deploy.sh §2.5 smoke gate** — `fac3d71` (chore)

## Files Created/Modified

- `scripts/smoke-availability.cjs` (NEW, 185 lines) — pure-Node contract suite for queuenight Phase-18 helpers. Cross-repo require with graceful skip. 23 OK/FAIL assertions across 3 helper surfaces.
- `scripts/deploy.sh` (modified, §2.5 lines 83-99) — third smoke if-block invoking smoke-availability.cjs with the same fail-on-error pattern as the existing two; comment header updated to reference Phase 18-03; trailing echo line now reads `Smoke contracts pass (positionToSeconds + matches/considerable + availability).`
- `package.json` (modified) — added `smoke:availability` standalone npm script; extended chained `smoke` script to run all 3 contracts. Total npm scripts: 6 (was 5).

## Decisions Made

- **Smoke runtime placement (~344ms vs <100ms estimate):** the planner estimated <100ms but the live measurement is ~344ms — the overhead is queuenight/functions/index.js's top-level admin SDK initialization, which is unavoidable when require()ing the full module. Still well under the deploy-gate budget (the existing two smokes also pre-load ~50ms each, total §2.5 budget is now ~450ms — negligible vs the firebase-deploy step itself).
- **Cross-repo require shape:** `require()` rather than copy-paste mirroring of the helper code into the smoke. Mirroring would DRY-violate (helpers must stay byte-identical with their queuenight source per Plan 18-01), and the require-path approach means any change to the queuenight helpers shows up in the smoke immediately on the next run — no manual sync step. The graceful-skip-on-missing pattern keeps environment-portability intact.
- **23 assertions vs the planner's 9+7+small-subset:** kept exactly to the plan's case enumeration — 9 D-07, 7 D-14/D-15, 7 normalizeProviderName. Did not add extras beyond what the plan specified.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Functionality] Added npm scripts for smoke discoverability**
- **Found during:** Task 2 (deploy.sh wire-up)
- **Issue:** The plan's `<tasks>` block (PLAN.md lines 175-520) covered only smoke-availability.cjs creation + deploy.sh §2.5 wiring, but the orchestrator's `<key_context>` (this run's prompt) explicitly listed "Add to package.json: smoke:availability + smoke chain" and the success_criteria called for "package.json gains smoke:availability + updates smoke to chain all 3". Without the npm scripts, the new smoke is only invocable via `node scripts/smoke-availability.cjs` directly — it would not be discoverable via `npm run smoke` for local pre-push validation, and the pattern of the existing two smokes (each having a dedicated `smoke:position` / `smoke:tonight` script + chained `smoke`) would be inconsistent.
- **Fix:** Extended package.json: added `"smoke:availability": "node scripts/smoke-availability.cjs"` and updated `"smoke"` to chain all 3 contracts with `&&`. Bundled the package.json change into Task 2's commit (chore — no behavior change to the smoke itself, just discoverability).
- **Files modified:** package.json
- **Verification:** `npm run smoke` runs all 3 contracts end-to-end; `npm run smoke:availability` runs just the new one; both exit 0 with ALL ASSERTIONS PASSED.
- **Committed in:** fac3d71 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 2 — missing functionality from plan tasks but called out in orchestrator's success_criteria + key_context)
**Impact on plan:** No scope creep. The npm scripts addition was explicitly listed in the plan's success_criteria; the deviation is purely between the plan's `<tasks>` block (which omitted the npm scripts step) and the success_criteria (which required them). Bundled into Task 2's commit per atomic-commit convention.

## Issues Encountered

None — both tasks executed cleanly. The live smoke run on the first attempt produced all 23 OK lines and exited 0.

## Coverage Closure

- **REQ-18-01 (CF logic correctness):** regression-locked. Any drift in `addedBrandsFor` (D-07 diff) or `normalizeProviderName` (brand collapse) caught at next deploy via the §2.5 gate.
- **REQ-18-02 (push body voice):** regression-locked. Any drift in `buildPushBody` template strings (D-14 single-title + D-15 batch + 3-title cap + 3-brand cap + ellipsis) caught at next deploy.

## Open Questions

None.

## Verification Snapshot (Plan-level checks all passing 2026-04-29T22:42Z)

- `ls scripts/smoke-availability.cjs` → file exists ✓
- `node -c scripts/smoke-availability.cjs` → exit 0 ✓
- `node scripts/smoke-availability.cjs` → exit 0, ALL 23 ASSERTIONS PASSED, ~344ms ✓
- `grep -c "addedBrandsFor"` → 12 (≥11) ✓
- `grep -c "buildPushBody"` → 15 (≥8) ✓
- `grep -c "smoke-availability.cjs" scripts/deploy.sh` → 2 ✓
- `grep -c "Smoke contracts pass.*availability" scripts/deploy.sh` → 1 ✓
- `bash -n scripts/deploy.sh` → exit 0 ✓
- `npm run smoke` → all 3 contracts pass, exit 0 ✓
- `node scripts/smoke-availability.cjs > /dev/null && echo "GATE OK"` → GATE OK ✓

## User Setup Required

None — no external service configuration required for this plan. The new smoke gate runs on existing infrastructure; production deploy validation is exercised when Plan 18-04 runs `bash scripts/deploy.sh`.

## Next Phase Readiness

- Plan 18-04 (cross-repo deploy ritual) can now exercise the full §2.5 gate. Sequence will be:
  1. From `~/queuenight`: `firebase deploy --only functions,firestore:rules` (Plan 18-01 helpers + providerRefreshTick CF go live)
  2. From `~/claude-projects/couch`: `bash scripts/deploy.sh 36-availability-notifs` — §2.5 gate validates Plan 18-01 helpers BEFORE firebase publishes hosting, then mirrors to `queuenight/public/` and deploys
- The pre-deploy gate noted in STATE.md (TMDB_KEY in `queuenight/functions/.env`) remains the only outstanding pre-deploy item for Plan 18-04.
- No blockers from this plan's perspective. Phase 18 plans completed: 1 (helpers) + 2 (couch mirror) + 3 (smoke gate) — only 4 (deploy) remains.

## Self-Check: PASSED

Verified post-write:
- `scripts/smoke-availability.cjs` → FOUND
- `scripts/deploy.sh` (modified) → FOUND, contains "smoke-availability.cjs" 2× and "+ availability" echo
- `package.json` (modified) → FOUND, contains "smoke:availability" entry
- Commit `c5fb713` (Task 1) → FOUND in git log
- Commit `fac3d71` (Task 2) → FOUND in git log

---
*Phase: 18-availability-notifications*
*Completed: 2026-04-29*
