---
phase: 26-position-anchored-reactions-async-replay
plan: 05
subsystem: phase-close-deploy-uat-scaffold
tags: [deploy, cache-bump, smoke-floor, human-uat, phase-close]

# Dependency graph
requires:
  - phase: 26-position-anchored-reactions-async-replay
    plan: 01
    provides: 9th smoke contract scaffold + state slots + helpers + write-site integration
  - phase: 26-position-anchored-reactions-async-replay
    plan: 02
    provides: replay-modal chrome (REVISITING + together again + scrubber strip + getScrubberDurationMs)
  - phase: 26-position-anchored-reactions-async-replay
    plan: 03
    provides: replay-feed real impl + rAF clock + scrubber handlers + compound-write contract D-05
  - phase: 26-position-anchored-reactions-async-replay
    plan: 04
    provides: Past parties expansion + title-detail bifurcation + dual-entry universal replay-mode entry surfaces
  - phase: 24-native-video-player
    provides: Phase 24 v37-native-video-player baseline cache + extended Phase 24 watchparty schema (REVIEWS C2) + REVIEWS M2 firestore.rules
provides:
  - "RPLY-26-17 floor meta-assertion: scripts/smoke-position-anchored-reactions.cjs fails the deploy gate when total < 13 (UI-SPEC §7 floor)"
  - "RPLY-26-18 production CACHE bump: sw.js v37-native-video-player → v38-async-replay; curl-verified live at couchtonight.app"
  - ".planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md scaffolds 10 device-UAT scripts mirroring Phase 18/19/24 pattern"
  - "STATE.md + ROADMAP.md + REQUIREMENTS.md updated with Phase 26 SHIPPED status; new HUMAN-VERIFY follow-up row; sw.js progression v37 → v38; all 24 RPLY-26-* IDs Complete"
  - "D-07 single-repo couch-only deploy proof — firestore.rules untouched in Phase 26; queuenight repo unchanged"
affects: [downstream phases will inherit couch-v38-async-replay cache + 9-contract smoke gate baseline]

# Tech tracking
tech-stack:
  added: []  # No new libraries; deploy + meta-assertion only
  patterns:
    - "Smoke floor meta-assertion: counts itself, fails gate when total < threshold; preserves Final-report block exactly (avoids confusing console output ordering)"
    - "Single-repo couch-only deploy ritual (D-07): bash scripts/deploy.sh 38-async-replay → 9-contract smoke gate → sed auto-bump sw.js → mirror to legacy queuenight/public/ → firebase deploy --only hosting → post-deploy curl verification. Mirrors Phase 18/19/20/24 close-out shape exactly"
    - "HUMAN-UAT scaffold authored at deploy-time with deploy-day-empty-state expectation noted (D-10 + D-11 + first-week-after-deploy framing); 10 scripts mirror VALIDATION.md Manual-Only Verifications matrix verbatim"
    - "Phase-close ritual finalized: 3 atomic commits (smoke floor / UAT scaffold / cache bump) + STATE.md + ROADMAP.md + REQUIREMENTS.md metadata commit. Pattern matches Phase 18-04 / 19-03 / 20-03 / 24-04 phase-close plans"

key-files:
  created:
    - .planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md (318 lines; 10 device-UAT scripts; resume signal "uat passed" → /gsd-verify-work 26)
    - .planning/phases/26-position-anchored-reactions-async-replay/26-05-SUMMARY.md (this file)
  modified:
    - scripts/smoke-position-anchored-reactions.cjs (12 lines added — RPLY-26-17 floor meta-assertion immediately before Final-report block; total grew 102 → 103)
    - sw.js (1 line — CACHE bumped from couch-v37-native-video-player → couch-v38-async-replay via deploy.sh §4 sed auto-bump)
    - .planning/STATE.md (Current Position + last-updated + progress counters + close-out narrative + Recent shipped phases row + sw.js progression + HUMAN-VERIFY follow-up row)
    - .planning/ROADMAP.md (Phase 26 row in Progress table → 5/5 SHIPPED; Plan 26-05 checkbox checked with commit hashes)
    - .planning/REQUIREMENTS.md (RPLY-26-17 + RPLY-26-18 traceability rows added; Coverage block refreshed: 158/178 complete; v2 section 42/42)

key-decisions:
  - "Smoke floor literal locked at 13 per UI-SPEC §7 (5 helper-behavior + 6 production-code sentinels + 2 replay-list filter). The actual count is 103 — well above floor — so the meta-assertion is silently green AND defensive against future regression. Researcher recommended ≥25; locked at the strict UI-SPEC floor (13) to avoid future drift if assertion shape evolves; total stays well above the floor by virtue of Plans 01-04 codification (90 prior assertions)"
  - "Used legacy /c/Users/nahde/queuenight/public/ as the deploy mirror (not the new couch-deploy/ name). The deploy.sh script auto-detects and warns; the path rename is purely cosmetic per script comment. No deploy-time ambiguity — the legacy path was found, used, and confirmed via post-deploy curl"
  - "HUMAN-UAT.md frontmatter `deployed:` field set to 2026-05-01 with comment annotation `# production deploy 2026-05-01T18:32:30Z (curl-verified)` — keeps frontmatter parsing clean (date-only) while preserving the precise deploy timestamp in the comment for later auditing"
  - "Followed plan task ordering EXACTLY: 5.1 (smoke floor) → 5.2 (UAT scaffold) → 5.3 (deploy + STATE updates). The deploy gate runs the smoke at §2.5 BEFORE the cache bump, so the new RPLY-26-17 floor meta-assertion was exercised by the deploy itself — verified the gate end-to-end at the same moment as production push"

patterns-established:
  - "Phase-close plans (18-04 / 19-03 / 20-03 / 24-04 / 26-05) all follow the same 3-task shape: smoke-floor sentinel + HUMAN-UAT scaffold + deploy + STATE updates. This is the canonical close-out ritual for autonomous-deploy phases on the Couch project. Future phase-close plans (Phase 27 / 28 / 30 etc when shipped) should mirror this exact shape"
  - "deploy.sh is now Phase 26-aware: §2.5 smoke gate includes the 9th contract (smoke-position-anchored-reactions); §4 sed auto-bumps sw.js; the script is a stable platform for future phase deploys. No deploy.sh changes needed in Plan 26-05 since Plan 01 wired the smoke contract path"
  - "post-deploy curl verification at https://couchtonight.app/sw.js is the canonical production-side confirmation. Always within ~30s of firebase deploy completion (Firebase Hosting CDN is global + fast); no need for retry-with-sleep ritual in normal cases"

requirements-completed: [RPLY-26-17, RPLY-26-18]

# Metrics
duration: ~12min
completed: 2026-05-01
---

# Phase 26 Plan 05: Phase-Close — Smoke Floor Lock + Production Deploy + HUMAN-UAT Scaffold Summary

**Phase 26 ships end-to-end. Smoke floor sentinel locked at 13 (RPLY-26-17). Production deployed via `bash scripts/deploy.sh 38-async-replay`; sw.js auto-bumped to `couch-v38-async-replay`; curl-verified live at couchtonight.app at 2026-05-01T18:32:30Z (RPLY-26-18). 26-HUMAN-UAT.md scaffolds 10 device-UAT scripts mirroring Phase 18/19/24 pattern. STATE.md + ROADMAP.md + REQUIREMENTS.md updated. D-07 single-repo proof: firestore.rules untouched in Phase 26; queuenight repo unchanged. All 24 RPLY-26-* IDs now codified in production source.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T18:30:00Z (approx)
- **Completed:** 2026-05-01T18:42:00Z (approx)
- **Production deploy:** 2026-05-01T18:32:30Z (curl-verified)
- **Tasks:** 3 (all atomic-committed)
- **Files modified:** 2 (1 new — HUMAN-UAT.md; 1 edited — smoke; 1 auto-bumped — sw.js)
- **Smoke assertions:** 102 → 103 (+1 self-counting floor meta-assertion)

## Accomplishments

- **RPLY-26-17 smoke floor meta-assertion (Task 5.1):** `scripts/smoke-position-anchored-reactions.cjs` extended with a 12-line block immediately before the Final-report block. Predicate: `const PHASE_26_ASSERTION_FLOOR = 13; if (total < FLOOR) failMsg(...) else pass(...)`. The meta-assertion counts itself as 1 passing assertion when satisfied (silently green). Total grew 102 → 103. The Final-report block (`console.log('---')` / `Total assertions: ...; Failures: ...` / `if (fails) { exit(1) } else { exit(0) }` / IIFE wrapper) preserved exactly per plan's preservation requirement. UI-SPEC §7 floor (13 = 5 helper-behavior + 6 production-code sentinels + 2 replay-list filter) locked.

- **26-HUMAN-UAT.md scaffold (Task 5.2):** 318-line file (well above ≥80-line minimum) created at `.planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md`. Frontmatter has `phase`, `type: human-uat`, `status: pending-device-verification`, `deployed: 2026-05-01` (with deploy-time comment), `cache: couch-v38-async-replay`, `resume_signal: "uat passed"`. Pre-UAT setup section explicitly notes the deploy-day-empty-state expectation per CONTEXT specifics + D-10 + D-11 + first-week-after-deploy framing. 10 numbered scripts mirror VALIDATION.md Manual-Only Verifications matrix:
  1. Replay-modal entry from Past parties tap (RPLY-26-08, 04)
  2. Replay-modal entry from title-detail tap (RPLY-26-11, 04)
  3. Scrubber drag + reaction fade-in at known position (RPLY-26-05, DRIFT)
  4. Compound-reaction posts to Firestore at correct position (RPLY-26-07)
  5. Hide-when-empty / deploy-day silence (RPLY-26-06, 09, 20)
  6. Wait Up disabled in replay (RPLY-26-14)
  7. Video player renders but does NOT auto-start (RPLY-26-16)
  8. Drift tolerance ±2s feel (RPLY-26-DRIFT)
  9. Scrub-backward preserves shown reactions (UI-SPEC §3 persistence)
  10. Post-deploy `couch-v38-async-replay` CACHE active (RPLY-26-18)
  Each script has title + What to test + Setup + Steps + Expected + Pass criterion + Resume signal. Final sign-off section: reply `uat passed` → trigger `/gsd-verify-work 26`.

- **Production deploy via `bash scripts/deploy.sh 38-async-replay` (Task 5.3):** Sub-step A pre-flight: working tree was clean (Task 5.1 + 5.2 commits both atomic). Sub-step B confirmed pre-deploy CACHE was `couch-v37-native-video-player` (Phase 24 baseline). Sub-step C ran the deploy ritual:
  - **§2.5 smoke gate:** ALL 9 contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed + native-video-player + position-anchored-reactions). The new RPLY-26-17 floor meta-assertion was exercised here at production-gate time.
  - **Rules tests:** 48 passing / 0 failing (incl. Phase 24 wp1-wp5 host-only branch covering REVIEWS M2 tightening).
  - **§4 sed auto-bump:** sw.js line 8 `const CACHE = 'couch-v37-native-video-player';` → `const CACHE = 'couch-v38-async-replay';`
  - **Mirror to deploy target:** Files mirrored to `/c/Users/nahde/queuenight/public/` (legacy path; new couch-deploy/ name not yet present locally — script auto-detected and warned per its design).
  - **BUILD_DATE stamp:** 2026-05-01 stamped in mirror only (source tree untouched per MEDIUM-8 review fix).
  - **Sentry DSN guard:** No placeholder violations.
  - **firebase deploy --only hosting:** uploaded 64 files; release complete to project queuenight-84044.
  Sub-step D post-deploy verification: `curl -fsSL https://couchtonight.app/sw.js | grep "const CACHE"` returns `const CACHE = 'couch-v38-async-replay';` — production live and curl-verified at 2026-05-01T18:32:30Z (within seconds of deploy completion; no CDN propagation delay observed).
  Sub-step E cross-repo gate verification (D-07 proof):
  - `git log --oneline -- firestore.rules` shows last commit `a2fd4b0 feat(24-04): Firestore rules-tests + tighten wp host-only fields (REVIEWS M2)` — NO Phase 26 commits on firestore.rules.
  - HUMAN-UAT.md frontmatter `deployed:` field updated to `2026-05-01  # production deploy 2026-05-01T18:32:30Z (curl-verified)`.
  Sub-step F STATE.md updates landed (see Files Modified for the full set).

- **STATE.md updates:** `last_updated` → 2026-05-01T18:33:00Z; progress counters refreshed (96/97 → 97/97 plans; 17/27 → 18/27 phases; 98% → 99%); Current focus narrative updated to "ALL 5 WAVES SHIPPED 2026-05-01; awaiting device-UAT"; Current Position → "Phase: 26 / Plan: All 5 ready for /gsd-verify-work 26 after device-UAT"; new Phase 26 / Plan 05 close-out narrative inserted at top with all 3 atomic commits + deploy timestamp + curl verification + D-07 proof; new Phase 26 row added to Recent shipped phases lookback table; sw.js cache version section refreshed (Current source: `couch-v38-async-replay`; progression line extended `... → v37-native-video-player (P24) → v38-async-replay (P26)`); new Phase 26 HUMAN-VERIFY follow-up row added to Open follow-ups table.

- **ROADMAP.md updates:** Phase 26 row in Progress table refreshed from `4/5 IN PROGRESS` to `5/5 SHIPPED 2026-05-01` with deploy timestamp + 17 atomic commit hashes + 9th smoke contract status + all 24 RPLY-26-* IDs codified; Plan 26-05 checkbox updated from `[ ]` to `[x]` with completion narrative + 3 commit hashes.

- **REQUIREMENTS.md updates:** Two new traceability rows added immediately after RPLY-26-DATE: RPLY-26-17 (floor meta-assertion at PHASE_26_ASSERTION_FLOOR=13; commit `01f31cc`) + RPLY-26-18 (sw.js v38-async-replay; production curl-verified 2026-05-01T18:32:30Z; D-07 single-repo proof; commit `d9336cf`). Coverage block refreshed: total 178 / 158 complete; v2 in-flight section 42/42; Phase 26 contributed 24 new RPLY-26-* IDs all closed across Plans 26-01..26-05.

## Task Commits

Each task was committed atomically:

1. **Task 5.1: Add RPLY-26-17 smoke floor meta-assertion (≥13)** — `01f31cc` (test) — 12 lines added; smoke total 102 → 103; floor meta-assertion silently green; Final-report block preserved verbatim
2. **Task 5.2: Scaffold 26-HUMAN-UAT.md (10 device-UAT scripts)** — `df1752b` (docs) — 318 lines; mirrors Phase 18/19/24 pattern; deploy-day-empty-state expectation noted; resume signal `uat passed` → `/gsd-verify-work 26`
3. **Task 5.3: Bump sw.js CACHE to couch-v38-async-replay (RPLY-26-18)** — `d9336cf` (chore) — auto-bumped via `bash scripts/deploy.sh 38-async-replay` §4 sed; production curl-verified at 2026-05-01T18:32:30Z

**Plan metadata commit:** pending (final commit at the end of this plan with this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md + 26-HUMAN-UAT.md frontmatter touchup).

## Files Created/Modified

- `scripts/smoke-position-anchored-reactions.cjs` — 12 lines added immediately before the `// ===== Final report =====` block. Block preserved exactly per plan preservation requirement (the `console.log('---')` + total/failures line + `if (fails)` exit logic + trailing `})().catch(err => { ... })` IIFE wrapper untouched).
- `.planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md` — NEW 318-line file with frontmatter + Pre-UAT setup + 10 numbered scripts + Final sign-off section. All required acceptance criteria met: ≥80 lines (318), ≥10 scripts (10), `uat passed` resume signal present, `couch-v38-async-replay` cache name present, frontmatter has `phase` + `type: human-uat` + `status: pending-device-verification` + `resume_signal`.
- `sw.js` — Line 8 `const CACHE` value bumped from `couch-v37-native-video-player` → `couch-v38-async-replay` via deploy.sh §4 sed auto-bump (deterministic; no manual edit).
- `.planning/STATE.md` — multiple sections updated: frontmatter (`last_updated` + `completed_phases` 17 → 18 + `completed_plans` 96 → 97 + `percent` 98 → 99); Current focus + Current Position; new close-out narrative for Plan 05 with full deploy detail; new Phase 26 row in Recent shipped phases lookback; sw.js cache version section refreshed (Current source + progression line); new HUMAN-VERIFY follow-up row in Open follow-ups table.
- `.planning/ROADMAP.md` — Phase 26 row in Progress table → 5/5 SHIPPED with full close-out narrative; Plan 26-05 checkbox `[ ]` → `[x]` with commit hashes + acceptance summary.
- `.planning/REQUIREMENTS.md` — 2 new traceability rows (RPLY-26-17 + RPLY-26-18) added immediately after RPLY-26-DATE; Coverage block refreshed to reflect Phase 26 closure (158/178 complete).

## Decisions Made

- **Smoke floor literal locked at 13 per UI-SPEC §7 (not the researcher's recommended 25):** The actual smoke ships 103 assertions today — well above either threshold. Locking at the strict UI-SPEC floor (13) maximizes resilience against future shape changes (if Plans 01-04 sentinels need to be reshaped or some are subsumed by integration tests, the floor still bites). Researcher's ≥25 was a soft recommendation; UI-SPEC §7 is the canonical lock.

- **Used legacy queuenight/public/ as deploy mirror (not the new couch-deploy/):** The deploy.sh script auto-detected the missing couch-deploy/ directory and printed a deprecation warning per its design (HIGH-4 review fix). The script then fell back to the legacy queuenight/ path which exists. The rename is purely cosmetic per the script comment ("Rename it to couch-deploy when convenient"). No deploy-time ambiguity — the legacy path was found, used, mirror successful, firebase deploy succeeded, post-deploy curl confirmed v38 live.

- **HUMAN-UAT.md frontmatter `deployed:` field stays date-only with comment annotation:** Set to `2026-05-01` (matching today's date which is also the deploy date) with the comment `# production deploy 2026-05-01T18:32:30Z (curl-verified)` carrying the precise timestamp. This keeps YAML frontmatter parsing clean (date-only field) while preserving the timestamp for later auditing. Phase 24's HUMAN-UAT.md uses similar shape.

- **Plan tasks executed in exact specified order:** 5.1 (smoke floor) → 5.2 (UAT scaffold) → 5.3 (deploy + STATE updates). The deploy gate (§2.5) runs the smoke BEFORE the cache bump, so the new RPLY-26-17 meta-assertion was exercised by the deploy itself — verified the gate end-to-end at the same moment as production push. No re-run needed.

## Deviations from Plan

None - plan executed exactly as written.

The only judgment call was on the deploy mirror path (legacy queuenight/ vs new couch-deploy/) — and that's not really a deviation, the script handles it deterministically per its own design. All deploy script automation, all curl verifications, all STATE.md updates landed exactly as specified in the plan's `<action>` blocks.

## Issues Encountered

- **`MODULE_TYPELESS_PACKAGE_JSON` warning surfaced twice during deploy:** Same benign warning Plans 01-04 surfaced; project intentionally has no `"type": "module"` in package.json (single-file no-bundler architecture per CLAUDE.md). Smoke contracts that use dynamic-import of ES modules (smoke-native-video-player + smoke-position-anchored-reactions) trigger the warning at startup. All 9 contracts still exit 0 cleanly. Warning is consistent across all deploys — not a Plan 05 regression.

- **Legacy mirror path warning:** deploy.sh emitted `WARN: /c/Users/nahde/claude-projects/couch/../../couch-deploy not found; falling back to legacy /c/Users/nahde/claude-projects/couch/../../queuenight.` Documented as expected per Decisions Made above. No deploy-time issue.

## Smoke Output

```
Total assertions: 103; Failures: 0
Phase 26 smoke PASSED.
```

Breakdown:
- 102 carried-forward assertions (Plans 01 + 02 + 03 + 04)
- 1 Plan 05 floor meta-assertion (counts itself; silently green when total ≥ 13)

The new RPLY-26-17 line in smoke output:
```
OK   Phase 26 smoke meets UI-SPEC §7 floor (>=13 assertions) (RPLY-26-17) — total=102
```
(Note: `total=102` is the count BEFORE the meta-assertion increments it; after pass(), total=103.)

## Production Status

- **Live cache version on couchtonight.app:** `couch-v38-async-replay` (curl-verified at 2026-05-01T18:32:30Z; production-side confirmed within seconds of deploy completion — no CDN propagation delay)
- **Source-tree sw.js:** `const CACHE = 'couch-v38-async-replay';` (committed in `d9336cf`)
- **Cross-repo state:**
  - `firestore.rules` UNTOUCHED in Phase 26 (last commit `a2fd4b0` from Phase 24 / REVIEWS M2 — pre-Phase-26)
  - `~/queuenight` repo NOT modified by Phase 26 (single-repo couch-only deploy per D-07)
  - 9 smoke contracts all green at deploy gate including new Phase 26 contract
  - 48/48 rules tests green
- **Phase 26 ships end-to-end:**
  - Schema: runtimePositionMs + runtimeSource on every reaction (Plan 01)
  - Replay variant of live-watchparty modal: REVISITING + together again + scrubber + scrubber strip + drift tolerance + rAF clock + position-aligned reactions feed (Plans 02-03)
  - Past parties surface: extended from 5h-25h window to all-time-paginated with replayable filter (Plan 04)
  - Title-detail bifurcation: Watchparties (active-only) + Past watchparties (NEW; archived with replayable) (Plan 04)
  - D-08 dual-entry universal replay-mode entry: Past parties row tap + title-detail row tap (Plan 04)
  - 9th smoke contract at 103 assertions including RPLY-26-17 floor meta-assertion (Plan 05)
  - sw.js CACHE bump to couch-v38-async-replay (Plan 05)
  - 10 device-UAT scripts in 26-HUMAN-UAT.md (Plan 05)
- **All 24 RPLY-26-* IDs Complete in REQUIREMENTS.md:**
  - Plan 01: RPLY-26-01, 02, 03, 07, 10, 13 (slot), 19
  - Plan 02: RPLY-26-04, 05, 13 (full), 15, 16, SNAP
  - Plan 03: RPLY-26-06, 14, DRIFT
  - Plan 04: RPLY-26-08, 09, 11, 12, 20, PAGE, DATE
  - Plan 05: RPLY-26-17, 18

## D-07 Single-Repo Proof

Confirmation that Phase 26 is single-repo couch-only per D-07:

1. `git log --oneline -- firestore.rules` shows zero Phase 26 commits — last commit on this file is `a2fd4b0 feat(24-04): Firestore rules-tests + tighten wp host-only fields (REVIEWS M2)` from Phase 24 / REVIEWS M2 (pre-Phase-26).
2. The Phase 26 deploy ritual (`bash scripts/deploy.sh 38-async-replay`) only ran `firebase deploy --only hosting` — NOT `--only firestore:rules` — so production rules at queuenight-84044 are unchanged from the Phase 24 baseline.
3. The smoke contract's RPLY-26-19 sentinel (`reactions` NOT in firestore.rules `affectedKeys().hasAny([...])` denylist) remains green — proving the wp.reactions write path remains open for non-host members (as required for D-05 compound-write contract to function).
4. `~/queuenight` repo NOT modified by Phase 26.

## RPLY-26-* Coverage at the Smoke Layer

| ID | Status | Where |
|---|---|---|
| RPLY-26-17 | ✓ Smoke-codified (Plan 05) | Floor meta-assertion at scripts/smoke-position-anchored-reactions.cjs immediately before Final report block; predicate `total < PHASE_26_ASSERTION_FLOOR (13)` triggers failMsg; counts itself as 1 passing assertion when satisfied |
| RPLY-26-18 | ✓ Production-verified (Plan 05) | sw.js source `const CACHE = 'couch-v38-async-replay'` (committed `d9336cf`) AND production curl `https://couchtonight.app/sw.js` returns same string (verified 2026-05-01T18:32:30Z); auto-bumped via bash scripts/deploy.sh 38-async-replay §4 sed |

## RPLY-26-* Audit Trail (Final)

Plan-by-plan codification breakdown — all 24 IDs codified after Plan 05:

- **Plan 01:** 7 IDs codified (RPLY-26-01, 02, 03, 07, 10, 13 part 1, 19)
- **Plan 02:** 6 IDs codified (RPLY-26-04, 05, 13 parts 2+3, 15, 16, SNAP)
- **Plan 03:** 3 IDs codified (RPLY-26-06, 14, DRIFT)
- **Plan 04:** 7 IDs codified (RPLY-26-08, 09, 11, 12, 20, PAGE, DATE)
- **Plan 05:** 2 IDs codified (RPLY-26-17, 18)

**Coverage progress: 7 + 6 + 3 + 7 + 2 = 25 RPLY-26-* codifications across 24 IDs (RPLY-26-13 is partially-codified in Plan 01 + completed in Plan 02; counted once in the unique-ID total).**

**100% of Phase 26's 24 RPLY-26-* IDs are now codified in production source.**

## Next: Awaiting Device-UAT

Phase 26 awaits user device-UAT per the standard close-out shape (mirroring Phase 18/19/20/24):

- 10 device-UAT scripts in `.planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md`
- Resume signal: reply `uat passed` → trigger `/gsd-verify-work 26`
- On any script fail: reply with script number + observation; orchestrator routes to remediation flow
- HUMAN-VERIFY row tracked in `.planning/STATE.md` § Open follow-ups

## User Setup Required

None — production deploy already complete; sw.js cache bump auto-bumped + curl-verified live at couchtonight.app. User's only remaining action is real-device UAT per 26-HUMAN-UAT.md scripts (force-reload PWA once on each device to activate `couch-v38-async-replay` service worker, then run scripts 1-10).

## Self-Check: PASSED

- ✓ FOUND: scripts/smoke-position-anchored-reactions.cjs (floor meta-assertion present; smoke exits 0 with 103 total)
- ✓ FOUND: .planning/phases/26-position-anchored-reactions-async-replay/26-HUMAN-UAT.md (318 lines; 10 ### Script sections; resume signal `uat passed` present; cache name `couch-v38-async-replay` present)
- ✓ FOUND: sw.js with CACHE = 'couch-v38-async-replay'
- ✓ FOUND: 01f31cc (Task 5.1 commit) via `git log --oneline | grep 01f31cc`
- ✓ FOUND: df1752b (Task 5.2 commit)
- ✓ FOUND: d9336cf (Task 5.3 commit)
- ✓ Production curl: `curl -fsSL https://couchtonight.app/sw.js | grep "const CACHE"` returns `const CACHE = 'couch-v38-async-replay';` (2026-05-01T18:32:30Z)
- ✓ D-07 proof: `git log --oneline -- firestore.rules` shows zero Phase 26 commits
- ✓ All must_haves.truths verified at code level (smoke floor meta-assertion present; total well above floor; sw.js source + production curl both v38; 26-HUMAN-UAT.md scaffolds 10 scripts; firestore.rules untouched)
- ✓ All must_haves.artifacts present with required `contains:` substrings (smoke contains "RPLY-26-17"; HUMAN-UAT.md ≥80 lines (318); sw.js contains "couch-v38-async-replay")
- ✓ All must_haves.key_links patterns grep-find on the live codebase ("Total assertions:" + meta-assertion in smoke; "couch-v38-async-replay" in post-deploy sw.js)
- ✓ STATE.md + ROADMAP.md + REQUIREMENTS.md all updated with Phase 26 SHIPPED status

---
*Phase: 26-position-anchored-reactions-async-replay*
*Completed: 2026-05-01*
*Production deploy: 2026-05-01T18:32:30Z (couch-v38-async-replay live at couchtonight.app)*
