---
phase: 19-kid-mode
plan: 03
subsystem: cache-bump-and-deploy
tags: [deploy, sw-cache, uat-pending]
requires:
  - 19-01 (kid-mode state + toggle + filters + smoke contract)
  - 19-02 (parent override on detail modal)
provides:
  - Live couch-v36.1-kid-mode service-worker cache at couchtonight.app
  - 4-contract smoke gate (92 assertions) baseline for future deploys
  - UAT-pending Phase-19 production rollout
affects:
  - sw.js (CACHE constant)
  - .planning/STATE.md (sw.js cache version line)
tech-stack:
  added: []
  patterns:
    - Single-repo couch-only deploy ritual (D-21..D-23) — no queuenight CF deploy, no firestore.rules update
    - 4-contract smoke gate (positionToSeconds + tonight-matches + availability + kid-mode = 92 assertions)
key-files:
  created: []
  modified:
    - sw.js (CACHE bump couch-v36-availability-notifs → couch-v36.1-kid-mode)
    - .planning/STATE.md (cache version line + Wave-3 close-out note)
decisions:
  - D-21 honored: single-repo couch-only deploy (no queuenight changes)
  - D-22 honored: decimal cache continuation (couch-v36.1-kid-mode) since Phase 18 took v36
  - D-23 honored: no Cloud Function deploy + no firestore.rules update (pure-client phase)
metrics:
  duration: ~5 minutes (commit + smoke + deploy + curl)
  completed: 2026-04-29
  assertions_passing: 92 smoke + 43 rules = 135 total gating assertions
---

# Phase 19 Plan 03: sw.js cache bump + couch-only production deploy + UAT Summary

Single-repo couch-only deploy of Phase 19 kid-mode to couchtonight.app on cache `couch-v36.1-kid-mode`; UAT walkthrough pending on a real iOS device with a family roster that includes ≥1 kid avatar.

## Deploy Events

| Step | Event | Outcome | Detail |
|------|-------|---------|--------|
| 1 | sw.js CACHE bump | PASS | `couch-v36-availability-notifs` → `couch-v36.1-kid-mode` (line 8); committed at `59c3fe6` |
| 2 | `bash scripts/deploy.sh 36.1-kid-mode` | PASS | exit 0; ran from couch repo root |
| 2a | rules suite (43 cases) | PASS | Firestore emulator; all SEC-15-1-* anchors + Phase 14/15 isolation matrix held |
| 2b | node --check (app.js + sw.js + stamp-build-date.cjs) | PASS | (implicit from deploy.sh §2.4) |
| 2c | smoke contract: positionToSeconds (17 assertions) | PASS | Phase 14 baseline |
| 2d | smoke contract: tonight-matches (29 assertions) | PASS | Phase 14 baseline |
| 2e | smoke contract: availability (23 assertions) | PASS | Phase 18 baseline |
| 2f | smoke contract: kid-mode (23 assertions) | PASS | NEW from Plan 19-01 — 4th gate |
| 2g | sw.js auto-bump idempotence | PASS | "sw.js CACHE already at couch-v36.1-kid-mode; skipping bump." (manual edit + script no-op as expected) |
| 2h | mirror to queuenight/public/ | PASS | 18 files copied; legacy `queuenight` directory still in use (cosmetic rename to `couch-deploy` deferred) |
| 2i | BUILD_DATE stamp | PASS | 2026-04-29 stamped in deploy mirror only (source untouched per review fix MEDIUM-8) |
| 2j | Sentry DSN guard | PASS | (no placeholder leak warning fired) |
| 2k | `firebase deploy --only hosting` | PASS | 61 files uploaded to queuenight-84044; release complete |
| 3 | curl https://couchtonight.app/sw.js | PASS | `const CACHE = 'couch-v36.1-kid-mode';` returned |
| 4 | curl -I https://couchtonight.app/app | PASS | HTTP/1.1 200 OK |

## Commits Created (this plan)

| Hash | Message |
|------|---------|
| `59c3fe6` | chore(19-03): bump sw.js CACHE to couch-v36.1-kid-mode |

The deploy.sh run did not produce a separate commit (BUILD_DATE stamp lives in the mirror repo only per review-fix MEDIUM-8; source tree was clean post-cache-bump).

## Live Verification Captured 2026-04-29 23:39Z

```
$ curl -s https://couchtonight.app/sw.js | grep "const CACHE"
const CACHE = 'couch-v36.1-kid-mode';

$ curl -sI https://couchtonight.app/app | head -3
HTTP/1.1 200 OK
Connection: keep-alive
Cache-Control: no-cache, max-age=0, must-revalidate
```

## Deviations from Plan

None — plan executed exactly as written. Path (a) was used (manual edit) to side-step the decimal-cache stamp-build-date.cjs regex risk noted in the plan; deploy.sh subsequently confirmed idempotence ("already at couch-v36.1-kid-mode; skipping bump.").

## Multi-Condition Device UAT — PENDING (Task 2 / checkpoint)

Per plan, UAT must run against the 8 ROADMAP success criteria on a real iOS device with the author's family roster (≥1 member with `effectiveMaxTier ≤ 3`). UAT 1+2+3+6 are blocking; UAT 4+5+7+8 are pass-or-defer.

UAT walkthrough is surfaced as `checkpoint:human-verify` for the user. Per-UAT pass/fail matrix to be appended to this SUMMARY once user signals "uat passed" (or surfaces failure modes for triage).

### UAT Pass/Fail Matrix (to be filled)

| UAT | Description | Status | Notes |
|-----|-------------|--------|-------|
| 1 | Toggle visibility (familyHasKids gate) | ⏸ pending | |
| 2 | Toggle interaction + visual state + flashToast copy | ⏸ pending | |
| 3 | Tier-cap filter on Tonight (excludes PG-13/R, preserves vetoed/watched gates) | ⏸ pending | |
| 4 | Library 'forme' + 'unwatched' filter respects kid-mode | ⏸ pending | |
| 5 | Session-scope reset (showScreen + couchClearAll boundaries) | ⏸ pending | |
| 6 | Parent override on detail modal (visibility-gated to parents; clears on toggle) | ⏸ pending | |
| 7 | Cross-device session isolation | ⏸ pending | |
| 8 | sw.js cache bump active in installed PWA | ⏸ pending | |

## Phase 19 Status After This Plan

- 19-01 SHIPPED + 19-02 SHIPPED + 19-03 deploy SHIPPED → code-and-cache live on couchtonight.app
- Phase 19 awaits UAT to declare fully shipped
- Standing follow-ups: none expected; if UAT 1+2+3+6 all pass, /gsd-verify-work 19 closes the phase

## Self-Check: PASSED

- sw.js modified: FOUND (CACHE = 'couch-v36.1-kid-mode' on line 8)
- Commit `59c3fe6`: FOUND (git log)
- Live cache: FOUND (curl couchtonight.app/sw.js)
- Live /app: FOUND (HTTP 200)
- STATE.md cache version line: FOUND (Wave-3 close-out appended)
