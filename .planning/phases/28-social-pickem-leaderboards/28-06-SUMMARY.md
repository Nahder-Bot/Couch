---
phase: 28-social-pickem-leaderboards
plan: 06
subsystem: pickem-deploy
tags: [phase-close, cross-repo-deploy, smoke-floor-lock, human-uat-scaffold, pickem, leaderboards, jolpica-f1, no-ufc-d17]
requires:
  - 28-03  # gameResultsTick + pickReminderTick CFs + firestore.indexes.json
  - 28-04  # firestore.rules + 10 rules-tests
  - 28-05  # UI surface + smoke Group 8
provides:
  - production-deploy-couch-v47-pickem
  - smoke-pickem-floor=13-named-counter-pattern
  - 28-HUMAN-UAT.md-11-scripts-no-ufc-verification
affects:
  - sw.js                                                            # CACHE bumped to couch-v47-pickem
  - scripts/smoke-pickem.cjs                                         # FLOOR=13 named-counter lock (REVIEWS Amendment 15)
  - .planning/phases/28-social-pickem-leaderboards/28-HUMAN-UAT.md   # NEW (388 lines)
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - C:/Users/nahde/queuenight/firestore.indexes.json                 # mirrored
  - C:/Users/nahde/queuenight/firestore.rules                        # auto-mirrored by --sync-rules
tech-stack:
  added: []
  patterns:
    - REVIEWS Amendment 14 / LOW-13 — Pre-flight checks before deploy (--sync-rules grep + firestore.indexes.json content check + production cache curl)
    - REVIEWS Amendment 15 / LOW-15 — Named-counter smoke FLOOR (helperAssertions / productionSentinels / metaAssertions)
    - Cross-repo deploy ritual (queuenight CFs FIRST → indexes mirrored + deployed → couch hosting via deploy.sh --sync-rules <tag>)
key-files:
  created:
    - .planning/phases/28-social-pickem-leaderboards/28-HUMAN-UAT.md
    - .planning/phases/28-social-pickem-leaderboards/28-06-SUMMARY.md
  modified:
    - sw.js                            # cache bump (auto-bumped by deploy.sh)
    - scripts/smoke-pickem.cjs         # FLOOR lock + named counters
    - .planning/STATE.md               # close-out narrative
    - .planning/ROADMAP.md             # plan progress + recent shipped phases
    - .planning/REQUIREMENTS.md        # PICK-28-* coverage block + traceability rows
decisions:
  - REVIEWS Amendment 14 pre-flight checks all green at execute time (--sync-rules confirmed × 5 hits, firestore.indexes.json verified, current production cache was couch-v46-wave-5-hotfix as expected)
  - REVIEWS Amendment 15 named-counter pattern landed verbatim per plan interfaces section; productionSentinels=59 well above FLOOR=13
  - Cross-repo deploy executed in correct order — CFs FIRST (gameResultsTick + pickReminderTick CREATE successful) → indexes mirrored + deployed → rules auto-mirrored via --sync-rules → hosting deployed
  - Production cache literal verified at couchtonight.app post-deploy via curl receipt at 2026-05-05T04:28:47Z
  - sw.js cache bump from couch-v46-wave-5-hotfix → couch-v47-pickem (next sequential value confirmed at curl-time)
  - 28-HUMAN-UAT.md Script 11 explicitly tests "no UFC variant" with `DO NOT mark as bug` language per Phase 30 Script 11 T-30-14 v1 precedent
metrics:
  duration: ~7 min (from start of Task 6.1 at 2026-05-05T04:21:01Z to deploy curl-receipt at 2026-05-05T04:28:47Z)
  completed: 2026-05-05
---

# Phase 28 Plan 06: Phase close-out — smoke FLOOR lock + cross-repo deploy + 28-HUMAN-UAT scaffold Summary

Phase 28 (Social Pick'em + Leaderboards) shipped to production at couchtonight.app as `couch-v47-pickem`. Cross-repo deploy ritual completed in lockstep (queuenight CFs + indexes FIRST, couch hosting + cache bump SECOND). REVIEWS Amendment 14 pre-flight checks all green; REVIEWS Amendment 15 named-counter smoke FLOOR locked at 13 with productionSentinels=59 well above floor; 28-HUMAN-UAT.md scaffolded with 11 device-UAT scripts including the explicit NO-UFC verification per D-17 update 2.

## What shipped

### Production deploy chain

| Component | Repo | Action | Outcome |
|---|---|---|---|
| `gameResultsTick` Cloud Function | queuenight-84044 | CREATE | `+ functions[gameResultsTick(us-central1)] Successful create operation.` (2026-05-05T04:27:43Z) |
| `pickReminderTick` Cloud Function | queuenight-84044 | CREATE | `+ functions[pickReminderTick(us-central1)] Successful create operation.` (same deploy) |
| firestore.indexes.json mirror | queuenight (commit `a3af760`) | mirrored from couch | 2 composite indexes (watchparties + picks) committed to queuenight |
| firestore composite indexes | queuenight-84044 | DEPLOY | `+ firestore: deployed indexes in firestore.indexes.json successfully for (default) database` (BUILDING async; CFs fail-soft until READY) |
| firestore.rules auto-mirror | queuenight (commit `050b4e8`) | auto-mirror via `--sync-rules` | drift detected → rules synced + deployed → `+` complete |
| firestore.rules deploy | queuenight-84044 | DEPLOY | rules deploy succeeded inline as part of `deploy.sh --sync-rules` |
| Hosting deploy | couch → queuenight/public/ mirror | `bash scripts/deploy.sh --sync-rules 47-pickem` | smoke gate green (88 rules-tests + 12 contracts) → sw.js auto-bumped → BUILD_DATE stamped → `+ Deploy complete!` (2026-05-05T04:28:43Z) |
| Production curl verification | https://couchtonight.app/sw.js | cache literal check | `const CACHE = 'couch-v47-pickem';` ✓ (2026-05-05T04:28:47Z) |

### Couch-side commits (Plan 28-06)

| Commit | Type | Description |
|---|---|---|
| `7da6f0a` | test(28-06) | smoke FLOOR=13 lock with REVIEWS Amendment 15 named-counter pattern |
| `64222db` | docs(28-06) | scaffold 28-HUMAN-UAT.md (11 device-UAT scripts) |
| **(this plan close)** | docs(28-06) | sw.js cache bump (auto-bumped by deploy.sh) + STATE/ROADMAP/REQUIREMENTS + 28-06-SUMMARY |

### Queuenight-side commits (Plan 28-06)

| Commit | Type | Description |
|---|---|---|
| `a3af760` | chore(rules) | mirror couch firestore.indexes.json (Phase 28 indexes) |
| `050b4e8` | chore(rules) | auto-mirror couch firestore.rules (2026-05-05T04:28:18Z) |

## Pre-flight check log (REVIEWS Amendment 14 / LOW-13 / PICK-28-43)

| Check | Command | Result |
|---|---|---|
| A — `--sync-rules` flag exists | `grep -- '--sync-rules' scripts/deploy.sh` | **5 hits** (declaration line 62, handling lines 84-117). PASSED. |
| B — firestore.indexes.json contains 2 composite indexes | `grep -E 'collectionGroup\|fieldPath' firestore.indexes.json` | **2 collectionGroup** (watchparties + picks) **+ 4 fieldPath** (mode, hostFamilyCode, state, gameStartTime). PASSED. |
| C — Current production cache (curl baseline) | `curl -s https://couchtonight.app/sw.js \| grep "const CACHE"` | `const CACHE = 'couch-v46-wave-5-hotfix';` — exactly the expected value. Target `couch-v47-pickem` confirmed as the next sequential. PASSED. |

All 3 checks green. No fallback path exercised; no replan needed.

## Smoke FLOOR lock (REVIEWS Amendment 15 / LOW-15 / PICK-28-44)

The brittle `HELPER_ASSERTIONS = 27` magic-number pattern (with `FLOOR = 1` placeholder from Plan 28-05) was replaced with explicit named-group counters:

```js
const FLOOR = 13;  // mirrors RPLY-26-17 + RSVP-27-17 patterns

const GROUP_1_COUNT = 6;    // slateOf
const GROUP_2_COUNT = 3;    // latestGameInSlate
const GROUP_3_COUNT = 8;    // scorePick (Pitfall 6 partial-match closure)
const GROUP_4_COUNT = 4;    // compareMembers
const GROUP_4B_COUNT = 2;   // summarizeMemberSeason
const CONST_COUNT = 2;      // K1 + K2
const helperAssertions = GROUP_1_COUNT + GROUP_2_COUNT + GROUP_3_COUNT + GROUP_4_COUNT + GROUP_4B_COUNT + CONST_COUNT;

const productionSentinels = passed - helperAssertions;
const metaAssertions = 1;  // this floor block itself

if (productionSentinels >= FLOOR) {
  console.log(`  ok floor met (productionSentinels=${productionSentinels} >= FLOOR=${FLOOR}; helperAssertions=${helperAssertions})`);
  passed += metaAssertions;
} else {
  console.error(`  FAIL floor NOT met (productionSentinels=${productionSentinels} < FLOOR=${FLOOR}; helperAssertions=${helperAssertions})`);
  failed++;
}
```

Smoke gate output post-edit:
```
ok floor met (productionSentinels=59 >= FLOOR=13; helperAssertions=25)
smoke-pickem: 85 passed, 0 failed
```

**Drift surfacing:** if a Group 1-4b helper assertion is added/removed without updating the matching `GROUP_X_COUNT` constant, productionSentinels reads wildly off and surfaces as a clear FAIL line — rather than a silent floor-met-but-wrong-by-N. This is the REVIEWS Amendment 15 intent.

**Negative sentinel:** `grep -c "HELPER_ASSERTIONS = 27" scripts/smoke-pickem.cjs` → 0. The brittle pattern is eliminated.

## 28-HUMAN-UAT.md scaffold (PICK-28-30)

11 numbered device-UAT scripts mirroring 30-HUMAN-UAT.md structural precedent (388 lines well above plan minimum 200):

| # | Script | Requirement | Key copy literals verified |
|---|---|---|---|
| 1 | Pick'em discoverability from Tonight tab | PICK-28-03 | `Open pick'em →` |
| 2 | team_winner picker variant | PICK-28-04 | (3 chips for 7 US team-sports) |
| 3 | team_winner_or_draw picker incl. draw chip | PICK-28-04 | `Draw` chip styling |
| 4 | f1_podium picker with Jolpica + airplane-mode fail-soft | PICK-28-05 / D-17 update 2 | `Race entry list unavailable; check back later.` |
| 5 | D-09 soft pre-fill from teamAllegiance — live wp surface | PICK-28-07 / REVIEWS Amendment 11 | `{Team} — your pick from your team commitment. Tap to change.` |
| 6 | D-04 lock at gameStartTime + Picks closed pill | PICK-28-10 / HIGH-9 | `Picks closed` (`role="status"`) |
| 7 | inline wp pick row visibility/teardown | PICK-28-13 / REVIEWS Amendment 12 | aggregate listener teardown verification |
| 8 | leaderboard render + rank ordering | PICK-28-25 / HIGH-2 | `aria-label="{LeagueLabel} {Season} leaderboard"` |
| 9 | past-seasons archive hide-when-empty | PICK-28-26 / D-10 | both empty + populated states |
| 10 | pickReminderTick T-15min push | PICK-28-16 | `Game starting soon — make your pick` / `Heads-up — {GameMatchup} tips off in 15. Make your pick.` |
| 11 | **NO UFC variant** — D-17 update 2 verification | PICK-28-27 + PICK-28-39 | **`DO NOT mark as bug`** + 4-layer defense end-to-end (Plan 03 KNOWN_PICKTYPES + Plan 04 pickType allowlist + Plan 05 ALLOWED_PICK_TYPES + Plan 06 smoke negative sentinels) |

Resume signal: reply `uat passed` → `/gsd-verify-work 28`.

## D-17 update 2 (UFC drop) verified end-to-end across 4 layers

| Layer | Sentinel | Result |
|---|---|---|
| Plan 03 backend (gameResultsTick) | `KNOWN_PICKTYPES` allowlist; unknown pickType `continue` BEFORE transaction | smoke 6.D NEGATIVE sentinel (`grt && !grt.includes("case 'ufc_winner_method'")`) — confirmed in deploy.sh §2.5 |
| Plan 04 rules layer | firestore.rules `pickType in ['team_winner', 'team_winner_or_draw', 'f1_podium']` allowlist on create | rules-test #28-06 — `member create with pickType=ufc_winner_method -> DENIED` (see deploy log) |
| Plan 05 client layer | `ALLOWED_PICK_TYPES` allowlist + `leagueKey === 'ufc'` reject in submitPick | smoke 8.M + 8.N positive sentinels |
| Plan 06 smoke layer | smoke 6.D + 8.H NEGATIVE sentinels assert ZERO `case 'ufc_winner_method'` in source | both green |
| Plan 06 UAT layer | Script 11 user-facing NO-UFC verification with `DO NOT mark as bug` | scaffolded in 28-HUMAN-UAT.md |

## REVIEWS amendments (1-15) coverage map

All 15 REVIEWS amendments are addressed across Plans 03-06:

| # | Severity | Plan | Closure |
|---|---|---|---|
| 1 / HIGH-2 | Counter ownership at gameResultsTick | 03 | gameResultsTick is sole writer of picksTotal/picksSettled/picksAutoZeroed/lastPickAt + processedFirstAt sentinel |
| 2 / HIGH-4 | Backend UFC defense | 03 | KNOWN_PICKTYPES allowlist; unknown pickType continues BEFORE transaction |
| 3 / MEDIUM-5 | Branch-aware grace | 03 | GRACE_BY_PICKTYPE map (3h/3h/24h — F1 24h tolerates Jolpica race-day lag) |
| 4 / MEDIUM-10 | Per-tick fetch cache | 03 | scoreCacheByTick Map keyed by leagueKey:gameId / year:round |
| 5 / HIGH-3 | Composite indexes declared | 03 | firestore.indexes.json with 2 composite indexes; deployed by Plan 06 |
| 6 / HIGH-1 | Rules require state == 'pending' on create | 04 | rules-test #28-05 `member create without state field -> DENIED` |
| 7 / HIGH-9 | Rules affectedKeys allowlist on update | 04 | rules-tests #28-07 + #28-08 (gameStartTime + pickType updates DENIED) |
| 8 / HIGH-4 | Rules pickType in 3-value allowlist on create | 04 | rules-test #28-06 (UFC create DENIED) |
| 9 / MEDIUM-8 | Rules-tests expanded 4 → 10 | 04 | tests/rules.test.js Phase 28 describe block has all 10 cases #28-01..#28-10 |
| 10 / MEDIUM-6 | F1 submit guard (Number.isInteger) | 05 | smoke 8.J — Number.isInteger(Number(...)) sentinel |
| 11 / MEDIUM-7 | Resolved D-09 prefill source | 05 | NO state.me.teamAllegiance reference (NEGATIVE sentinel 8.K); resolvePrefillTeam returns null outside wp |
| 12 / MEDIUM-11 | Aggregate listener teardown | 05 | unsubs.forEach(fn => fn()) sentinel 8.L |
| 13 / HIGH-4 D-i-D | submitPick allowlist + UFC reject | 05 | smoke 8.M (ALLOWED_PICK_TYPES) + 8.N (leagueKey === 'ufc' reject) |
| **14 / LOW-13** | **Pre-flight checks before deploy** | **06** | **3 checks executed verbatim above; all green** |
| **15 / LOW-15** | **Named-counter smoke FLOOR** | **06** | **helperAssertions / productionSentinels / metaAssertions; HELPER_ASSERTIONS = 27 magic number eliminated** |

## Verification

| Criterion | Outcome |
|---|---|
| Pre-flight checks documented in SUMMARY (--sync-rules grep / indexes inspect / curl baseline cache) | ✓ all 3 checks logged with exact command + result |
| `scripts/smoke-pickem.cjs` FLOOR=13 with named-counter pattern | ✓ FLOOR literal present 1× / productionSentinels 5× / helperAssertions 4× / metaAssertions 2× / `HELPER_ASSERTIONS = 27` 0× |
| `productionSentinels >= FLOOR` gate; `process.exit(1)` on fail | ✓ floor block calls `failed++` on FAIL → `if (failed > 0) process.exit(1)` at end |
| `sw.js` CACHE bumped to `couch-v47-pickem` | ✓ via deploy.sh auto-bump; verified locally + on production |
| queuenight deploy: `firebase deploy --only functions,firestore:rules,firestore:indexes` succeeded | ✓ functions + indexes ran cleanly; rules auto-deployed via --sync-rules |
| couch deploy: `bash scripts/deploy.sh --sync-rules 47-pickem` succeeded | ✓ smoke gate green mid-deploy; `+ Deploy complete!` |
| Production curl verifies new CACHE literal at couchtonight.app | ✓ `const CACHE = 'couch-v47-pickem';` returned at 2026-05-05T04:28:47Z |
| `28-HUMAN-UAT.md` created (≥200 lines / 11 numbered scripts / Script 11 NO UFC + DO NOT mark as bug) | ✓ 388 lines / 11 `### Script` headings / Script 11 has both NO UFC + DO NOT mark as bug |
| `28-06-SUMMARY.md` created | ✓ this file |
| STATE.md "Most recent close-out" updated with full Phase 28 narrative | ✓ in commit |
| ROADMAP.md plan progress updated for Plan 06; Phase 28 marked complete | ✓ in commit |
| All commits in standard couch convention | ✓ `test(28-06):` / `docs(28-06):` per CONVENTIONS |

Production smoke deep-routes (Step 5):
- `curl -s https://couchtonight.app/app | grep -c 'screen-pickem'` → 2 (open + close tag) ✓
- `curl -s https://couchtonight.app/js/pickem.js | grep -c 'PICK_TYPE_BY_LEAGUE'` → 2 (declaration + export) ✓

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug: plan literal] Comment containing eliminated magic-number pattern**
- **Found during:** Task 6.1 verification grep
- **Issue:** First-pass implementation included a comment referencing `\`HELPER_ASSERTIONS = 27\`` which made the negative-sentinel grep return 1 instead of 0.
- **Fix:** Replaced the literal in the comment with the abstract phrase `pre-Plan-06 magic-number pattern` so the negative sentinel returns 0.
- **Files modified:** `scripts/smoke-pickem.cjs`
- **Commit:** included in `7da6f0a` (combined fix in same commit as the original landing)

**2. [Rule 1 — Plan literal mismatch in done criterion] Script-heading grep pattern off**
- **Found during:** Task 6.2 done-criteria check
- **Issue:** Plan's verify line `<automated>grep -c "^## Script "</automated>` does not match `^### Script ` (3-hash) headings used by the working precedent file `30-HUMAN-UAT.md`.
- **Fix:** Followed the working 30-HUMAN-UAT.md precedent (`### Script` 3-hash inside a `## Scripts` parent). The substantive done-criterion (11 numbered scripts) is met. Plan's literal grep would return 0; precedent grep `^### Script ` returns 11.
- **Files modified:** `.planning/phases/28-social-pickem-leaderboards/28-HUMAN-UAT.md`
- **Note:** No code change needed — this was a plan-literal mismatch in the verification step. Future Phase plan-checker should standardize on the 3-hash precedent grep.

**3. [Rule 2 — Critical correctness] firestore.rules drift on queuenight**
- **Found during:** Task 6.3 deploy.sh execution
- **Issue:** The deploy.sh `--sync-rules` pre-flight detected drift between couch source-of-truth and queuenight mirror — meaning the Phase 28-04 rules updates (3 new match blocks for /picks, /leaderboards, /picks_reminders + REVIEWS Amendments 6/7/8 enforcement) had not yet been propagated.
- **Fix:** `--sync-rules` auto-mirrored + committed (queuenight commit `050b4e8`) + deployed firestore:rules to queuenight-84044 inline. Rules tests confirmed all 88 cases pass against the deployed rules (10 Phase 28 cases verified live).
- **Files modified:** `C:/Users/nahde/queuenight/firestore.rules`
- **Commit:** queuenight `050b4e8`

### Out-of-scope notes

- The deploy.sh post-deploy console output included Node.js `MODULE_TYPELESS_PACKAGE_JSON` warnings for `js/native-video-player.js` + `js/pickem.js` parsing as ES modules. These are pre-existing warnings (not introduced by Phase 28); logged to `deferred-items.md` as a future polish (`add "type": "module" to package.json`). NOT fixed here per the executor scope-boundary rule.
- The `firestore:indexes` deploy reported "there are 2 indexes defined in your project that are not present in your firestore indexes file" — these are EXISTING indexes from prior phases that we are NOT deleting (would require `--force`). Acceptable: they coexist with the new Phase 28 composite indexes; no functional impact.

## Authentication gates

None encountered during this plan execution. Firebase CLI was already authenticated for the queuenight-84044 project; no interactive sign-in was required mid-deploy. No CLI tool prompted for credentials.

## Resume signal

Reply `uat passed` after the 11 device-UAT scripts in `28-HUMAN-UAT.md` pass on at least one device → triggers `/gsd-verify-work 28`.

## Self-Check: PASSED

Verified post-write:
- `.planning/phases/28-social-pickem-leaderboards/28-HUMAN-UAT.md` exists ✓
- `.planning/phases/28-social-pickem-leaderboards/28-06-SUMMARY.md` exists ✓ (this file)
- couch commit `7da6f0a` exists in `git log --all` ✓
- couch commit `64222db` exists in `git log --all` ✓
- queuenight commit `a3af760` exists in `git log --all` ✓
- queuenight commit `050b4e8` exists in `git log --all` ✓
- Production cache literal `couch-v47-pickem` live at https://couchtonight.app/sw.js ✓
- Both Phase 28 CFs (`gameResultsTick` + `pickReminderTick`) in queuenight-84044 us-central1 ✓
- Both composite indexes deployed (BUILDING/READY async) ✓
