---
phase: 20-decision-explanation
plan: "03"
subsystem: infra
tags: [deploy, sw-cache, pwa, firebase, uat, phase-20]
dependency_graph:
  requires:
    - phase: 20-01
      provides: buildMatchExplanation helper + 5-smoke gate wired into deploy.sh
    - phase: 20-02
      provides: 3 surface integrations of buildMatchExplanation in js/app.js + css/app.css
  provides:
    - sw.js CACHE bumped to couch-v36.2-decision-explanation
    - Phase 20 decision-explanation features live at couchtonight.app
    - 20-HUMAN-UAT.md with 6 device-UAT items (status: partial — code-level accepted)
  affects:
    - gsd-verify-work 20 (phase readiness check)
tech-stack:
  added: []
  patterns:
    - Single-repo couch-only deploy ritual (D-16) — sw.js bump + deploy.sh tag run + curl-verify + UAT scaffold
    - Code-level acceptance + deferred device UAT pattern (matches Phases 18/19/15.4/15.5)
key-files:
  created:
    - .planning/phases/20-decision-explanation/20-HUMAN-UAT.md
  modified:
    - sw.js
key-decisions:
  - "Code-level acceptance closes the deploy gate per Phases 18/19/15.4/15.5 precedent; device UAT deferred to user walkthrough via HUMAN-UAT.md"
  - "Single-repo couch-only deploy (D-16): NO queuenight changes, NO firestore.rules, NO Cloud Function deploy"
  - "sw.js CACHE bumped manually via direct edit (not deploy.sh auto-bump) so change is an explicit, reviewable commit artifact — matches Phase 19-03 pattern"
requirements-completed: [REQ-20-10, REQ-20-11]
duration: ~10min (Wave 3 deploy + UAT scaffold)
completed: "2026-04-29"
---

# Phase 20 Plan 03: Decision Explanation — Deploy + UAT Scaffold Summary

**sw.js CACHE bumped to couch-v36.2-decision-explanation, single-repo couch-only deploy to couchtonight.app via deploy.sh + 5-smoke gate, and device UAT scaffold delivered in 20-HUMAN-UAT.md (code-level acceptance granted; 6 device-UAT items pending user iPhone walkthrough).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-29T00:00:00Z
- **Completed:** 2026-04-29
- **Tasks:** 3 / 3 (UAT scaffold delivered; device walkthrough pending in 20-HUMAN-UAT.md)
- **Files modified:** 2 (sw.js + 20-HUMAN-UAT.md)

## Accomplishments

- sw.js CACHE constant updated from `couch-v36.1-kid-mode` to `couch-v36.2-decision-explanation` via direct edit, committed atomically
- `bash scripts/deploy.sh 36.2-decision-explanation` completed cleanly: 5-smoke gate green → mirror → BUILD_DATE stamp → Sentry guard → firebase deploy --only hosting → post-deploy curl smoke confirmed
- 20-HUMAN-UAT.md created with 6 structured UAT items covering all 4 decision-explanation surfaces (D-07/D-08/D-09/D-10) + voice/brand check (D-11+D-12) + optional cross-device check
- Code-level acceptance granted by orchestrator auto-chain (established Couch pattern: Phases 18 / 19 / 15.4 / 15.5)

## Task Commits

1. **Task 1: Bump sw.js CACHE to couch-v36.2-decision-explanation** — `1c02ea0` (chore)
2. **Task 2: Deploy to production via bash scripts/deploy.sh 36.2-decision-explanation** — (no source commit — deploy ritual; deploy evidence captured below)
3. **Task 3: Create Phase 20 UAT script** — `7b67299` (docs)

## Files Created/Modified

- `sw.js` — CACHE constant updated to `couch-v36.2-decision-explanation`; no other lines touched; `node --check sw.js` passes; SHELL array unchanged
- `.planning/phases/20-decision-explanation/20-HUMAN-UAT.md` — 6 UAT items (UAT-1 through UAT-6); status set to `partial`; `code_level_accepted: 2026-04-29`; deploy evidence table included

## Deploy Evidence

| Check | Command | Result |
|-------|---------|--------|
| sw.js CACHE on prod | `curl -s https://couchtonight.app/sw.js \| grep "const CACHE"` | `const CACHE = 'couch-v36.2-decision-explanation';` |
| HTTP 200 | `curl -sI https://couchtonight.app/ \| head -1` | `HTTP/1.1 200 OK` |
| Old cache absent | `curl -s https://couchtonight.app/sw.js \| grep -c "couch-v36.1-kid-mode"` | 0 |
| BUILD_DATE | `curl -s https://couchtonight.app/js/constants.js \| grep BUILD_DATE` | `BUILD_DATE = '2026-04-30'` |
| 5-smoke gate | Deploy log | `Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation).` |
| Firebase deploy | Deploy log | `+ hosting[queuenight-84044]: release complete` |

Post-continuation smoke re-run (this session): all 5 contracts green, exit 0. `node --check js/app.js` exit 0.

## UAT Status

Code-level acceptance granted by orchestrator auto-chain. 6 device-UAT items remain pending in `20-HUMAN-UAT.md` for user device walkthrough on real iPhone (and optional Android cross-check). Pattern matches Phases 18 / 19 / 15.4 / 15.5 — closing the deploy gate at code level, deferring device UAT to user.

UAT items status: `result: pending` (prose pass/fail criteria in each UAT item; user closes by marking results or via `/gsd-verify-work 20`).

| UAT Item | Surface | Status |
|----------|---------|--------|
| UAT-1 | Spin-pick result modal italic serif sub-line (D-07) | pending |
| UAT-2 | Tonight match-card dim footer (D-08) | pending |
| UAT-3 | Considerable variant voter phrase (D-10) | pending (skippable if no considerable titles) |
| UAT-4 | Detail modal "Why this is in your matches" section gate (D-09) | pending |
| UAT-5 | Voice / brand check (D-11 + D-12) | pending |
| UAT-6 | Cross-device Android check | pending (optional) |

## Decisions Made

- Code-level acceptance closes the deploy gate per Phases 18/19/15.4/15.5 precedent; device UAT deferred to user walkthrough
- Single-repo couch-only deploy ritual (D-16): no queuenight changes, no firestore.rules, no Cloud Function deploy
- sw.js CACHE bumped via direct edit to make the change explicit and reviewable in git history (deploy.sh's auto-bump is a safety net, not the primary path — matches Phase 19-03 pattern)

## Deviations from Plan

None — plan executed exactly as written. The code-level acceptance + deferred device UAT pattern is the established Couch project convention (not a deviation).

## Issues Encountered

None.

## Known Stubs

None. All Phase 20 surfaces call `buildMatchExplanation` with live state data. No hardcoded placeholder text in any touched region.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Wave 3 (deploy + UAT scaffold) is purely operational — mirrors existing source to hosting, bumps sw.js cache string. No new threat flags beyond the plan's threat model (T-20-07/08/09 all addressed).

## Self-Check

| Item | Status |
|------|--------|
| `sw.js` — CACHE = `couch-v36.2-decision-explanation` | FOUND |
| `sw.js` — old cache `couch-v36.1-kid-mode` absent | CONFIRMED |
| commit `1c02ea0` (chore: sw.js bump) | FOUND |
| commit `7b67299` (docs: UAT script) | FOUND |
| `.planning/phases/20-decision-explanation/20-HUMAN-UAT.md` exists | FOUND |
| `20-HUMAN-UAT.md` frontmatter `status: partial` | SET |
| `20-HUMAN-UAT.md` frontmatter `code_level_accepted: 2026-04-29` | SET |
| `npm run smoke` exit 0, 5 contracts green (post-continuation re-run) | PASS |
| `node --check js/app.js` exit 0 | PASS |

## Self-Check: PASSED

All auto-checkable acceptance criteria met. UAT items appropriately marked pending (not passed) — awaiting user device walkthrough.

## Next Phase Readiness

Phase 20 is ready for `/gsd-verify-work 20` against the 13 ROADMAP success criteria. Device UAT items in `20-HUMAN-UAT.md` should be walked on a real iPhone before closing Phase 20 formally. No blockers.

---
*Phase: 20-decision-explanation*
*Completed: 2026-04-29*
