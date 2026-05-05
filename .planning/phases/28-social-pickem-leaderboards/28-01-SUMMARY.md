---
phase: 28
plan: 01
subsystem: sports-feed-extension + smoke-scaffold + deploy-gate
type: execute
wave: 0
status: complete
created: 2026-05-02
completed: 2026-05-02
duration_minutes: 6
tasks_completed: 3
tasks_total: 3
files_created:
  - scripts/smoke-pickem.cjs
files_modified:
  - js/sports-feed.js
  - scripts/smoke-sports-feed.cjs
  - scripts/deploy.sh
commits:
  - 8c0e948: "feat(28-01): Wave 0 — TheSportsDB free-tier verification + season/round/stage fields"
  - 155423d: "feat(28-01): scaffold smoke-pickem.cjs (11th contract) + register smoke gate"
requirements_advanced:
  - PICK-28-01  # season/round/stage on normalizeTsdEvent
  - PICK-28-21  # smoke-pickem.cjs scaffold
  - PICK-28-22  # deploy.sh §2.5 registration (+ Phase 27 catch-up)
dependency_graph:
  requires:
    - 22-sports-feed-abstraction  # normalizeTsdEvent surface to extend
    - 27-guest-rsvp                # smoke-guest-rsvp.cjs catch-up reference
  provides:
    - additive game.season/round/stage canonical fields (consumed by Plan 02 pickem.js)
    - 11th smoke contract scaffold (consumed by Plans 02-06 to add assertions)
    - 11-contract deploy gate (Phase 27 catch-up + Phase 28 wired)
  affects:
    - js/sports-feed.js (Phase 28 consumes; no Phase 22 contract changes)
    - scripts/deploy.sh §2.5 (smoke gate now 11 contracts, was 9)
tech-stack:
  added: []
  patterns:
    - smoke-pattern-Phase-27-Wave0-scaffold (passed/failed counters + eq + eqContains + readIfExists)
    - additive-fallback-ladder (strSeason || calendarYear(startMs) || 'unknown' per RESEARCH Pitfall 1)
    - inline-mirror-lockstep (smoke-sports-feed.cjs mirror updated in same commit as production)
key-files:
  created:
    - path: scripts/smoke-pickem.cjs
      lines: 95
      role: 11th smoke contract scaffold; floor=1 placeholder; ready for Plans 02-06 to fill 5 behavior families
  modified:
    - path: js/sports-feed.js
      change: normalizeTsdEvent return block extended with season/round/stage; TSD_API_KEY '1'->'3' (free-tier bump per Wave 0 finding)
    - path: scripts/smoke-sports-feed.cjs
      change: inline mirror updated with 3 additive fields + Scenario G with 8 assertions (25 -> 33 passed)
    - path: scripts/deploy.sh
      change: §2.5 smoke gate extended with smoke-guest-rsvp.cjs (Phase 27 catch-up) + smoke-pickem.cjs (Phase 28); echo line lists 11 contracts
decisions:
  - TheSportsDB free-tier API key '1' is no longer functional — bumped to '3' in js/sports-feed.js (Rule 1 auto-fix; production sports feed restored)
  - F1 podium pickType cannot be auto-settled on TheSportsDB free tier (driver names absent from structured fields) — Plan 02 must implement free-text fallback OR manual settlement OR season-driver-list constraint
  - UFC winner+method pickType cannot be auto-settled either (fighter names parseable from strEvent title only; no method field) — same fallback options as F1
  - EPL `intRound` confirmed populated; team_winner_or_draw pickType + D-05 soccer slate grouping fully unblocked
metrics:
  duration_minutes: 6
  files_changed: 4
  lines_added: 168
  lines_removed: 6
  smoke_assertions_before: 25
  smoke_assertions_after: 33  # smoke-sports-feed.cjs only; smoke-pickem.cjs adds +2 placeholder
  smoke_contracts_total: 11
---

# Phase 28 Plan 01: Wave 0 — Sports-feed extension + smoke scaffold + deploy gate Summary

Wave 0 BLOCKING gate satisfied: three TheSportsDB curl checks executed against free-tier key, two critical findings surfaced (legacy key '1' became Premium-only; F1/UFC structured-field gaps confirmed), `js/sports-feed.js` `normalizeTsdEvent` return block extended with three additive fields (season/round/stage) for downstream pick'em consumption, smoke-sports-feed.cjs Scenario G locks the contract (33 assertions passing), 11th smoke contract scaffolded, and deploy.sh §2.5 wired with both the Phase 27 catch-up if-block (smoke-guest-rsvp.cjs) and the Phase 28 if-block (smoke-pickem.cjs) — echo line now lists 11 contracts.

## What changed

**js/sports-feed.js (+9 lines, additive):**
1. `normalizeTsdEvent` return block extended with three Phase 28 fields after `isScheduled`:
   - `season: ev.strSeason || (startMs ? String(new Date(startMs).getFullYear()) : 'unknown')` — Pitfall 1 fallback ladder
   - `round: ev.intRound ? String(ev.intRound) : null` — soccer matchday (D-05 slate grouping)
   - `stage: ev.strStage || null` — UCL stage label (D-05 UCL slate)
2. `TSD_API_KEY` bumped from `'1'` to `'3'` (Rule 1 auto-fix — see Deviations below).

**scripts/smoke-sports-feed.cjs (+47 lines):**
1. Inline mirror of `normalizeTsdEvent` updated in lockstep with the three additive fields.
2. New "Scenario G" block with 8 assertions covering:
   - G1.1-3: NBA-style with strSeason/intRound populated, strStage empty
   - G2.1-3: F1 fallback ladder (strSeason null → calendar year)
   - G3.1: UCL stage populated
   - G4.1: 'unknown' fallback when both strSeason and startMs are absent

**scripts/smoke-pickem.cjs (NEW, 95 lines, PICK-28-21):**
- Phase 27 smoke-guest-rsvp.cjs structural pattern (eq, eqContains, readIfExists; passed/failed counters; exit-1 on fail)
- 5 behavior-family comment markers (Groups 1-7) ready for Plans 02-06 to fill
- Wave 0 placeholders: 1 harness assertion + floor=1 placeholder (Plan 28-06 raises to ≥13)
- Imports `js/pickem.js` via `path.resolve(COUCH_ROOT, 'js', 'pickem.js')` ready for Plan 02 dynamic-import (REVIEWS H2 fix pattern from Phase 24)
- Exits 0 with `2 passed, 0 failed`

**scripts/deploy.sh §2.5 (PICK-28-22):**
- New if-block: `smoke-guest-rsvp.cjs` (Phase 27 catch-up — was missing per RESEARCH Risk 8)
- New if-block: `smoke-pickem.cjs` (Phase 28)
- Echo line updated from 9 contracts to 11: `+ guest-rsvp + pickem`

## Wave 0 curl evidence (PICK-28-01)

All three checks executed via `curl --max-time 10` with API key `'3'` (the free-tier key after legacy `'1'` was Premium-locked) and `node -e` for JSON parsing (jq not available in this Git Bash).

### Check #1 — F1 (`eventsseason.php?id=4370&s=2025`)

| Field            | Value                              |
| ---------------- | ---------------------------------- |
| `total_events`   | 15                                 |
| `idEvent`        | 2200759 (Australian Grand Prix)    |
| `strHomeTeam`    | **null**                           |
| `strAwayTeam`    | **null**                           |
| `intHomeScore`   | **null**                           |
| `intAwayScore`   | **null**                           |
| `strSeason`      | "2025"                             |
| `intRound`       | "1"                                |
| `strResult`      | unstructured prose, ~2000 chars   |

**Conclusion (Risk 7 confirmed):** F1 driver names are NOT exposed in structured fields. `f1_podium` pickType cannot be auto-settled. Plan 02 must implement one of three fallbacks (free-text input + manual settlement, deferred to v3, or hardcoded season-driver-list).

### Check #2 — UFC (`eventsseason.php?id=4443&s=2025`)

| Field            | Value                                                              |
| ---------------- | ------------------------------------------------------------------ |
| `total_events`   | 15                                                                 |
| `idEvent`        | 2179600 (UFC 311 Makhachev vs Moicano)                            |
| `strHomeTeam`    | **null**                                                           |
| `strAwayTeam`    | **null**                                                           |
| `intHomeScore`   | **null**                                                           |
| `intAwayScore`   | **null**                                                           |
| `strSeason`      | "2025"                                                             |
| `intRound`       | "2"                                                                |
| `strEvent`       | "UFC 311 Makhachev vs Moicano" (fighter names parseable from title) |

**Conclusion (Risk 7 extended):** UFC fighter names also absent from structured fields, but the main-event headliners are parseable from the `strEvent` title (regex `/^UFC \S+ (\w+) vs (\w+)$/`). Method-of-victory field is not present at all. `ufc_winner_method` pickType requires the same fallback strategy as F1.

### Check #3 — EPL (`eventsseason.php?id=4328&s=2025-2026`) — PASS

| Field            | Value                              |
| ---------------- | ---------------------------------- |
| `total_events`   | 15                                 |
| `idEvent`        | 2267073 (Liverpool vs Bournemouth) |
| `strHomeTeam`    | "Liverpool"                        |
| `strAwayTeam`    | "Bournemouth"                      |
| `intHomeScore`   | "4"                                |
| `intAwayScore`   | "2"                                |
| `strSeason`      | "2025-2026"                        |
| `intRound`       | "1"                                |
| `strStatus`      | "Match Finished"                   |

**Conclusion: PASS.** `intRound` populated; team names + scores in structured fields. `team_winner_or_draw` pickType (D-02) and D-05 soccer slate grouping are FULLY UNBLOCKED. Round 1 contained 10 events (full matchday); 2 distinct intRound values present in the 15-event sample, confirming the field is populated reliably.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] TheSportsDB free-tier key '1' became Premium-locked**

- **Found during:** Task 1.1 (Wave 0 curl checks)
- **Issue:** Every endpoint (`all_leagues.php`, `eventsday.php`, `eventsseason.php`, `lookupevent.php`, `searchteams.php`) returned `{"Message":"Invalid Premium API key: Signup here: https://www.thesportsdb.com/pricing"}` when called with key `'1'`. This means the production sports feed at couchtonight.app is currently broken for all 16 leagues — every `fetchSchedule` and `fetchScore` call returns null/empty. The Phase 22 contract is silently failing in production.
- **Fix:** Probed alternative keys; key `'3'` returns structured payloads (verified with EPL eventsseason.php). Bumped `TSD_API_KEY` from `'1'` to `'3'` in `js/sports-feed.js:25` and updated the surrounding header comment to document the change with verification date (2026-05-02). All three Wave 0 curl checks then passed with key `'3'`.
- **Files modified:** `js/sports-feed.js` (lines 5-7 header comment + line 25 const)
- **Commit:** 8c0e948
- **Why this is in scope:** `js/sports-feed.js` was already on the plan's `files_modified` list. The key bump is a one-line additive change colocated with the season/round/stage extension. Per CLAUDE.md "Public-by-design secrets" convention, the key remains in client source intentionally.
- **Downstream impact:** Plan 02 + 04 (which consume `fetchSchedule`/`fetchScore`) now have a working data source. Without this fix, every Plan 02-06 task would have failed at the smoke gate the first time they tried to validate against real API data.

**2. [Rule 3 — Blocking] jq not installed in Git Bash on Windows**

- **Found during:** Task 1.1 (Wave 0 curl checks)
- **Issue:** Plan 28-01 stated "use Bash to run each curl with `-s --max-time 10` and pipe through `jq` (already installed)" — but `jq` is not installed in this Git Bash environment.
- **Fix:** Worked around by piping curl output to `node -e "let s='';process.stdin.on('data',d=>s+=d);..."` for stdin JSON parsing. Equivalent JQ-extracted field views captured in the Wave 0 commit message.
- **Files modified:** None — workaround is invocation-only.
- **Commit:** N/A
- **Note:** Future Wave 0 curl tasks should either install jq via `pacman -S jq` (MSYS2) or document the node-stdin fallback in the plan template.

### Surfaced for downstream waves (NOT auto-fixed; require Plan 02 owner decision)

**3. [Architectural — defer to Plan 02] F1/UFC pickType auto-settlement infeasibility**

- **Surfaced during:** Wave 0 curl checks #1 and #2
- **Finding:** Driver/fighter names not in structured fields on TheSportsDB free tier. `f1_podium` and `ufc_winner_method` pickTypes (D-02) cannot be auto-settled by `gameResultsTick` against TheSportsDB scores.
- **Decision:** NOT auto-fixed in this plan because the fallback strategy is a Plan 02 / Plan 04 design choice (Rule 4 territory — affects pickType validator, picker UI variant, and settlement CF logic). Three options surfaced:
  - (a) free-text input for P1/P2/P3 (F1) and fighter names (UFC) + manual settlement (host marks correct via admin UI — adds Phase 28 admin surface, increases scope)
  - (b) defer F1 podium + UFC method pickTypes to Phase 28.x; ship Phase 28 with team_winner + team_winner_or_draw pickTypes only
  - (c) hardcoded season-driver-list (F1) and roster-list (UFC) — low-maintenance, ~30 names per season, manually updated quarterly
- **Recommendation for Plan 02 owner:** Option (b) for v1 ship velocity — F1 and UFC are the lowest-engagement leagues in the family-decision-ritual posture; team-sport pickTypes carry the bulk of pick'em value.

## Self-Check: PASSED

- `[x]` `js/sports-feed.js` exists with `season: ev.strSeason` (line 99): FOUND
- `[x]` `js/sports-feed.js` line 25 contains `TSD_API_KEY = '3'`: FOUND
- `[x]` `scripts/smoke-sports-feed.cjs` Scenario G assertions present (8 new): FOUND
- `[x]` `scripts/smoke-sports-feed.cjs` exit code 0 / 33 assertions pass: VERIFIED
- `[x]` `scripts/smoke-pickem.cjs` exists at 95 lines (>=60 required): FOUND
- `[x]` `scripts/smoke-pickem.cjs` exit code 0 / 2 passed: VERIFIED
- `[x]` `scripts/deploy.sh` §2.5 contains smoke-guest-rsvp.cjs if-block (Phase 27 catch-up): FOUND
- `[x]` `scripts/deploy.sh` §2.5 contains smoke-pickem.cjs if-block (Phase 28): FOUND
- `[x]` `scripts/deploy.sh` echo line lists 11 contracts ending with `+ guest-rsvp + pickem`: FOUND
- `[x]` `bash -n scripts/deploy.sh` passes: VERIFIED
- `[x]` Commit 8c0e948 (Tasks 1.1 + 1.2): FOUND in git log
- `[x]` Commit 155423d (Task 1.3): FOUND in git log
- `[x]` All 11 smoke contracts pass standalone (no regressions to Phase 26/27): VERIFIED

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: provider-trust | js/sports-feed.js | TheSportsDB free-tier API key bumped '1'→'3' — provider control over key allowlist is a Phase 22 trust assumption that is now demonstrably brittle. Per T-28-03 ("Information Disclosure — curl checks expose only public TheSportsDB API endpoints; accept") this remains an `accept` disposition because the key is publicly documented; but the provider's unilateral free-tier deprecation is a NEW availability risk worth flagging for Phase 22 RESEARCH revision (TheSportsDB Patreon $14/yr is now the only stable upgrade path, not just the live-data unlock claimed in the Phase 22 SUMMARY). |

## Next Steps

Plan 28-02 is unblocked: ready to create `js/pickem.js` with pure helpers (`slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS`).

Plan 02 owner MUST decide on the F1/UFC fallback strategy before coding `validatePickSelection` and `scorePick` (option a/b/c above). Recommend reviewing the three options with the user before continuing wave 1.

The Phase 22 RESEARCH should be revisited in a follow-up — the "free-tier API key '1'" claim is now stale; downstream phases consuming `js/sports-feed.js` should know that production reliability now depends on a Patreon subscription (TheSportsDB has demonstrated willingness to wall off free endpoints).
