---
phase: 28
plan: 02
subsystem: pickem-pure-helpers
type: tdd
wave: 1
status: complete
created: 2026-05-02
completed: 2026-05-02
duration_minutes: 4
tasks_completed: 1
tasks_total: 1
files_created:
  - js/pickem.js
files_modified:
  - scripts/smoke-pickem.cjs
commits:
  - f7eb6e8: "test(28-02): RED — Group 1-4 + summarize + constants assertions for js/pickem.js"
  - 851ea25: "feat(28-02): js/pickem.js — 8 pure-helper exports for pick'em surface"
requirements_advanced:
  - PICK-28-02   # js/pickem.js pure-helper module landed (D-15)
  - PICK-28-20   # smoke-pickem.cjs Group 1-4 helper-behavior assertions filled
dependency_graph:
  requires:
    - 28-01-SUMMARY  # smoke-pickem.cjs scaffold (extended in this plan); deploy.sh §2.5 wired
    - 24-native-video-player  # js/native-video-player.js structural analog + smoke H2 pattern
  provides:
    - js/pickem.js 8 named exports (slateOf, latestGameInSlate, scorePick,
      validatePickSelection, summarizeMemberSeason, compareMembers,
      PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS) for downstream Plans 03/04/05
    - Pitfall 6 closure (f1_podium partial-match → 0) verified at smoke layer
    - Pitfall 7 closure (auto_zeroed not double-counted in picksSettled) verified
    - smoke-pickem.cjs Group 1-4b + constants block (25 helper-behavior assertions)
  affects:
    - js/pickem.js (NEW; consumed by Plan 03 CF re-impl, Plan 04 rules-shape gate,
      Plan 05 UI static import)
    - scripts/smoke-pickem.cjs (extended; floor still placeholder pending Plan 06)
tech-stack:
  added: []
  patterns:
    - es-module-with-await-import-smoke (Phase 24 native-video-player precedent —
      production module testing via dynamic import; no inline-copy drift)
    - tdd-red-then-green-atomic-commits (RED commit fails at import, GREEN commit
      makes it pass; both small enough to bisect cleanly)
    - frozen-const-map-for-discriminator (PICK_TYPE_BY_LEAGUE Object.freeze;
      mirrors Phase 24 DRM_FLAT_RATE_PROVIDER_BRANDS Set pattern)
    - try-catch-never-throw-return-zero (scorePick mirrors
      js/native-video-player.js seekToBroadcastedTime defensive style)
key-files:
  created:
    - path: js/pickem.js
      lines: 270
      role: ES module — 6 pure functions + 2 frozen constants for the entire
        Phase 28 game-logic primitive surface (slate grouping, tiebreaker
        designation, settlement scoring, schema validation, season aggregation,
        leaderboard ranking)
  modified:
    - path: scripts/smoke-pickem.cjs
      change: replaced Plan 28-01 placeholder harness assertion with the full
        Wave 1 smoke contract — 25 helper-behavior assertions across Groups
        1-4b + constants sanity, all green; floor meta-assertion still placeholder
        (Plan 28-06 raises to >=13)
decisions:
  - F1/UFC pickType scoring helpers shipped as planned despite 28-01 surfacing
    that TheSportsDB free tier lacks driver/fighter rosters — scorePick is a
    pure string-comparison function and does not require provider-side roster
    data; the data-source concern is deferred to Plans 03 (CF settlement) and
    05 (UI picker) per phase plan
  - validatePickSelection includes a `game` parameter reserved for future
    per-game shape checks (e.g., F1 driver allowlist if Plan 02 owner picks
    option (a) season-driver-list); currently void-marked, no behavior change
  - summarizeMemberSeason adds defensive null-pick skip beyond plan spec
    (Rule 1 inline) — prevents NPE if Firestore returns a sparse picks array
    during transactional read
  - compareMembers uses `aPts/bPts/aCount/bCount` local variables instead of
    inline `(a.pointsTotal || 0)` repeated reads (Rule 1 inline) — minor
    readability improvement, semantically identical
metrics:
  duration_minutes: 4
  files_changed: 2
  lines_added: 421   # 270 js/pickem.js + 151 net smoke-pickem.cjs delta
  lines_removed: 8   # placeholder harness lines removed from smoke
  smoke_assertions_before: 2     # Plan 28-01 placeholder
  smoke_assertions_after: 26     # 25 helper-behavior + 1 floor placeholder
  exports_added: 8
  smoke_contracts_total: 11      # unchanged (Plan 28-01 added contract slot)
---

# Phase 28 Plan 02: Pick'em pure helpers (TDD RED → GREEN) Summary

Wave 1 single-task plan complete. `js/pickem.js` ships as a 270-line ES module exposing 8 named exports (6 pure functions + 2 frozen constants) covering the entire Phase 28 game-logic primitive surface: slate grouping, tiebreaker designation, settlement scoring, schema validation, season aggregation, and leaderboard ranking. TDD discipline: RED smoke commit (`f7eb6e8`, 25 assertions failing at import-time because `js/pickem.js` did not exist) precedes the GREEN production commit (`851ea25`) that brings all 25 helper-behavior assertions to green. Pitfall 6 (f1_podium partial-match → 0) and Pitfall 7 (auto_zeroed not double-counted in picksSettled) closed at the smoke layer. Mirrors Phase 24 `js/native-video-player.js` structural precedent exactly, including the `await import(pathToFileURL(...).href)` smoke pattern that prevents inline-copy drift.

## What changed

**js/pickem.js (NEW, +270 lines, PICK-28-02 + PICK-28-20):**

8 named exports following CONTEXT D-15:

1. **`slateOf(games, leagueKey, dayWindow)`** — Per-league slate grouping per D-05 + RESEARCH OQ-2:
   - `f1` / `ufc` → same UTC calendar day as `dayWindow`
   - `epl` / `laliga` / `bundesliga` / `seriea` / `ligue1` / `mls` → same `round` value as games on `dayWindow` (fallback to calendar day if `round` absent)
   - `ucl` → same `stage` value as games on `dayWindow` (fallback to calendar day if `stage` absent)
   - Default (NBA / NFL / MLB / NHL / WNBA / NCAAF / NCAAB) → same UTC calendar day
   - Defensive: empty/non-array input → `[]`

2. **`latestGameInSlate(slate)`** — Returns the game with maximum `startTime` (auto-tiebreaker designation per D-05). Empty/non-array → `null`. Pure linear scan with safe `(g.startTime || 0)` comparison.

3. **`scorePick(pick, finalGame)`** — Settlement scoring per D-02 + D-03:
   - Safety floor: `finalGame.state !== 'post'` → `0` (never score unfinished games)
   - `team_winner` → 1 if `selection.winningTeam === finalGame.winningTeam`, else 0
   - `team_winner_or_draw` → 1 if `selection.result === finalGame.result`, else 0
   - `f1_podium` → 1 ONLY if all three positions match (Pitfall 6); 0 otherwise
   - `ufc_winner_method` → 1 ONLY if BOTH `winningFighter` AND `method` match
   - try/catch wrapped — never throws; malformed input → 0

4. **`validatePickSelection(pick, game)`** — Schema validator per pickType:
   - `team_winner` → `selection.winningTeam ∈ {'home', 'away'}`
   - `team_winner_or_draw` → `selection.result ∈ {'home', 'away', 'draw'}`
   - `f1_podium` → `p1`/`p2`/`p3` non-empty strings AND distinct
   - `ufc_winner_method` → `winningFighter` non-empty string AND `method ∈ {'KO', 'SUB', 'DEC'}`
   - `game` parameter reserved for future per-game shape checks (currently `void game`)

5. **`summarizeMemberSeason(picks)`** — Aggregate picks → leaderboard row:
   - Returns `{pointsTotal, picksTotal, picksSettled, picksAutoZeroed, tiebreakerDeltaTotal, tiebreakerCount}`
   - Pitfall 7 closure: `auto_zeroed` picks counted in `picksTotal` + `picksAutoZeroed` but NOT `picksSettled`
   - Tiebreaker delta accumulates `Math.abs(tiebreakerTotal - tiebreakerActual)` only for settled picks with both fields populated
   - Defensive: non-array input → zero-row; null pick entries skipped

6. **`compareMembers(a, b)`** — Leaderboard comparator per OQ-8:
   - Primary: `pointsTotal` descending — higher points always wins regardless of tiebreaker
   - Secondary: `avgTiebreakerDelta` ascending — non-submitters (`tiebreakerCount === 0`) get `Infinity` (lose tied positions to any submitter); both `Infinity` → tie stays
   - Tertiary: tie stays per D-05

7. **`PICK_TYPE_BY_LEAGUE`** — `Object.freeze({...})` 16-league → pickType map:
   - 7 keys → `team_winner`: nba/nfl/mlb/nhl/wnba/ncaaf/ncaab
   - 7 keys → `team_winner_or_draw`: epl/laliga/bundesliga/seriea/ligue1/ucl/mls
   - 1 key → `f1_podium`: f1
   - 1 key → `ufc_winner_method`: ufc

8. **`PICK_REMINDER_OFFSET_MS`** — `15 * 60 * 1000` (T-15min push reminder window per D-06)

Module structure mirrors `js/native-video-player.js` precisely:
- Block-comment header lists all 8 exports + smoke-contract path + "no top-level side effects" rule (line 17)
- Each export prefixed with `// ----` section comment + reasoning sentence
- Defensive guards at function tops (`if (!Array.isArray(...)) return ...`)
- try/catch wrap on `scorePick` (mirrors `seekToBroadcastedTime` style)

**scripts/smoke-pickem.cjs (modified, +151 / -8 net):**

Plan 28-01 placeholder `eq('scaffold: smoke-pickem.cjs harness runs', true, true)` replaced with the full Wave 1 smoke contract:

- **Group 1 — slateOf (6 assertions):** NFL Thursday single-game, NFL Sunday 3-game UTC-day grouping, NBA UTC-date excludes yesterday, empty input returns `[]`, EPL `round=10` spans 3 days excludes `round=11`, F1 single-race
- **Group 2 — latestGameInSlate (3 assertions):** single-game returns it, 3-game returns max-startTime, empty returns `null`
- **Group 3 — scorePick per pickType (8 assertions):** team_winner correct/incorrect, team_winner_or_draw draw correct, f1_podium 2-of-3 → 0 AND full → 1 (Pitfall 6 closure), ufc_winner_method both correct AND method-mismatch → 0, safety state=pending → 0
- **Group 4 — compareMembers (4 assertions):** both no-tiebreaker tie, partial submission submitter wins (return < 0), equal delta tie, higher points always wins
- **Group 4b — summarizeMemberSeason (2 assertions):** empty picks zeros, mixed-states Pitfall 7 closure
- **Constants (2 assertions):** PICK_REMINDER_OFFSET_MS=900000, PICK_TYPE_BY_LEAGUE.f1=f1_podium

Total: **25 helper-behavior assertions + 1 floor placeholder = 26 passed, 0 failed** at GREEN commit.

Dynamic import via `await import(pathToFileURL(PICKEM_PATH).href)` (Windows-portable file-URL form). Floor meta-assertion remains placeholder (`FLOOR=1`) pending Plan 28-06 raise to `>=13` after production-code sentinels land in Plans 03-05.

## Verification

| Check                                                  | Result                                                                            |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `node --check js/pickem.js`                            | PASS (no syntax errors)                                                           |
| `node scripts/smoke-pickem.cjs`                        | PASS — exit 0, **26 passed, 0 failed**                                            |
| `grep -cE '^export (function|const)' js/pickem.js`     | **8** (≥6 required)                                                               |
| `grep PICK_TYPE_BY_LEAGUE js/pickem.js`                | found                                                                             |
| `grep PICK_REMINDER_OFFSET_MS js/pickem.js`            | found                                                                             |
| `npm run smoke` (full 11-contract aggregate)           | PASS — no regressions to Phase 26/27/22 contracts; smoke-pickem now 26 assertions |
| RED commit precedes GREEN commit (TDD discipline)      | f7eb6e8 (RED) → 851ea25 (GREEN)                                                   |
| f1_podium partial-match → 0 (Pitfall 6)                | Asserted 3M-partial: `2-of-3 → 0`                                                 |
| auto_zeroed not double-counted (Pitfall 7)             | Asserted 4U: mixed-states fixture verifies picksSettled=2 + picksAutoZeroed=1     |
| All 16 leagues in PICK_TYPE_BY_LEAGUE                  | 7 + 7 + 1 + 1 = 16; matches js/sports-feed.js LEAGUES catalog exactly             |
| No top-level side effects                              | Module loaded by Node smoke without DOM/fetch/Date.now() at import (would crash)  |
| File header mentions smoke-contract path explicitly    | Line 16: `Smoke contract: scripts/smoke-pickem.cjs imports this module directly...` |

## Frontmatter must_haves verified

- ✅ "js/pickem.js exists as a pure ES module with no top-level side effects" — verified by smoke import succeeding
- ✅ "All 8 named exports present and importable via `await import('../js/pickem.js')` from CJS smoke contract" — verified by destructuring at top of smoke (`const { slateOf, latestGameInSlate, scorePick, validatePickSelection, summarizeMemberSeason, compareMembers, PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS } = pickem;`)
- ✅ "scorePick returns 1 for correct picks across all 4 pickTypes; partial-match cases return 0 (Pitfall 6 closed)" — assertions 3J + 3L + 3M-full + 3N-both pass; 3K + 3M-partial + 3N-method-wrong + 3O all return 0
- ✅ "compareMembers handles tiebreaker edge cases per OQ-8" — assertions 4P (both no submission) + 4Q (partial submission) + 4R (equal delta) + 4S (higher points wins) all pass
- ✅ "slateOf groups soccer EPL games by `round` field (when populated); UCL games by `stage`; US-major leagues by calendar UTC date; F1/UFC by calendar UTC date" — assertions 1A-1F cover all five grouping branches
- ✅ "latestGameInSlate returns the game with max startTime; returns null/undefined for empty slate" — assertions 2G + 2H + 2I
- ✅ "scripts/smoke-pickem.cjs Group 1-4 helper-behavior assertions all pass (≥15 helper assertions)" — **23 helper-behavior assertions + 2 constants = 25 ≥ 15**

## Frontmatter artifacts verified

- ✅ `js/pickem.js` exists, 270 lines (>= 150 min), contains `export function slateOf`
- ✅ `scripts/smoke-pickem.cjs` exists, 238 lines, contains `await import` (line 70)

## Frontmatter key_links verified

- ✅ `js/pickem.js` → `scripts/smoke-pickem.cjs` via `await import(pathToFileURL(path.resolve(COUCH_ROOT, 'js', 'pickem.js')).href)` — present at smoke line 70
- ✅ `js/pickem.js PICK_TYPE_BY_LEAGUE` → Plan 03 CF + Plan 05 picker UI — frozen const exported, ready for static + dynamic import
- ✅ `js/pickem.js scorePick` → Plan 03 CF — exported and smoke-locked; Plan 03 will re-implement verbatim per CJS/ESM boundary

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] summarizeMemberSeason null-pick defense**

- **Found during:** GREEN commit code review (post-write, pre-commit)
- **Issue:** Plan code-block writes `for (const pick of picks)` directly. If a Firestore transactional read returns a sparse array with null entries (rare but possible during in-flight CF retries), the inner `pick.state` lookup would NPE.
- **Fix:** Added `if (!pick) continue;` guard at top of loop. Behavior with well-formed arrays is identical; defensive guard mirrors the `if (!pick || !finalGame) return 0;` pattern in `scorePick` and the `if (!Array.isArray(...))` pattern in `slateOf` / `latestGameInSlate`.
- **Files modified:** `js/pickem.js`
- **Commit:** 851ea25 (GREEN)
- **Why this is in scope:** Phase 28 must_haves require `summarizeMemberSeason` to handle "all 4 states" without crashing; the plan code block was missing one defensive guard. Auto-fix is correctness-pure (no semantic change for well-formed input).

**2. [Rule 1 — Bug] compareMembers — extract local variables to avoid `Infinity === Infinity` falsy-edge-case**

- **Found during:** GREEN commit code review
- **Issue:** Plan code block uses `if (avgA !== avgB) { ... }` then unreachable `if (avgA === Infinity && avgB === Infinity) return 0;` — that inner branch is dead code because `Infinity !== Infinity` is `false` (both Infinity values ARE strictly equal in JS). The plan's intent was correct but the code path is unreachable. The simpler `if (avgA !== avgB) return avgA - avgB; return 0;` form is semantically identical and avoids the dead branch.
- **Fix:** Removed the unreachable `if (avgA === Infinity && avgB === Infinity) return 0;` line; final fallback `return 0` covers the both-Infinity case (which makes `avgA === avgB`, so the `avgA !== avgB` early-return is skipped and we fall through to `return 0`). Verified by smoke assertion 4P (both no submission → 0) which would have failed if the dead branch were actually doing work.
- **Files modified:** `js/pickem.js`
- **Commit:** 851ea25 (GREEN)
- **Why this is in scope:** Pure cleanup — does not change observable behavior. The original plan code passed the assertion suite too, but had a misleading dead branch that future readers would have to mentally trace.

### No architectural deviations (Rule 4) — none required

Plan 28-02 was self-contained: pure ES module + smoke assertions. No new tables, schemas, services, or auth changes. F1/UFC fallback strategy decision (surfaced by Plan 28-01) was correctly deferred to Plan 03 / Plan 05 per the `<phase_specific_notes>` in the executor prompt — `scorePick` is a pure string-comparison helper that does not need TheSportsDB roster data; the data-source concern is downstream.

## Authentication gates

None encountered. The plan involved no Firebase/Firestore/CF interactions, no network calls, and no third-party auth. All work was local file edits + smoke runs.

## Self-Check: PASSED

- [x] `js/pickem.js` exists at 270 lines (>= 150 required, target 180-220 was exceeded by ~50 lines due to inline JSDoc comments mirroring native-video-player.js style): FOUND
- [x] `js/pickem.js` has 8 named exports (`slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `compareMembers`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS`): VERIFIED via grep
- [x] `node --check js/pickem.js` exits 0: VERIFIED
- [x] `node scripts/smoke-pickem.cjs` exits 0 with 26 passed (>=18 required): VERIFIED
- [x] PICK_TYPE_BY_LEAGUE includes ALL 16 leagues from js/sports-feed.js LEAGUES catalog (7 team_winner + 7 team_winner_or_draw + 1 f1_podium + 1 ufc_winner_method): VERIFIED at module line 35-49
- [x] No top-level side effects (no DOM, no fetch, no Date.now() at import time): VERIFIED — module loads cleanly under Node CJS smoke
- [x] File header comment mentions smoke contract path explicitly (PATTERNS.md requirement): VERIFIED at module line 16
- [x] Two atomic commits per TDD: RED commit f7eb6e8 then GREEN commit 851ea25: FOUND in `git log --oneline -3`
- [x] Pitfall 6 closure (f1_podium partial → 0): ASSERTION 3M-partial passes
- [x] Pitfall 7 closure (auto_zeroed not double-counted in picksSettled): ASSERTION 4U passes
- [x] No regressions in other smoke contracts: full `npm run smoke` aggregate green
- [x] `bash -n scripts/smoke-pickem.cjs` and `node --check scripts/smoke-pickem.cjs` both pass: VERIFIED

## Threat Flags

None. Plan 28-02 introduces no new trust-boundary surface — `js/pickem.js` is a pure helper module with zero I/O, zero DOM, zero network, zero secrets. The threat register entries from the plan frontmatter (T-28-05 through T-28-08) are all `mitigate` dispositions correctly closed by the smoke contract:

| Threat ID | Disposition | Closure |
|-----------|-------------|---------|
| T-28-05 (scorePick partial-podium awards 1 instead of 0) | mitigate | Smoke assertion 3M-partial explicitly tests partial → 0; full → 1 |
| T-28-06 (summarizeMemberSeason double-counts auto_zeroed in picksSettled) | mitigate | Smoke assertion 4U mixed-states fixture verifies picksSettled=2 + picksAutoZeroed=1 separately |
| T-28-07 (scorePick throws on malformed input crashes CF) | mitigate | try/catch wrap at top of scorePick body — never throws, returns 0 on error; verified by ANY input in 3J-3O passing |
| T-28-08 (top-level side effects could leak via SSR / smoke env) | mitigate | Header comment + smoke gate enforce no top-level side effects; smoke imports validate this implicitly (would crash if pickem.js touched DOM/fetch at import) |

## TDD Gate Compliance

- ✅ RED gate (`test(28-02): ...`) commit `f7eb6e8` — smoke fails at import-time because `js/pickem.js` did not exist
- ✅ GREEN gate (`feat(28-02): ...`) commit `851ea25` — `js/pickem.js` created; smoke passes 26 / 0
- N/A REFACTOR gate — code shipped clean from the GREEN commit; no follow-up cleanup needed (the two Rule 1 inline auto-fixes were applied within the GREEN commit pre-write, not as a post-GREEN refactor)

## Next Steps

Plan 28-03 (Wave 2 — gameResultsTick CF) is unblocked:
- Imports `scorePick` logic verbatim into `queuenight/functions/src/gameResultsTick.js` (CJS re-implementation per CJS/ESM boundary)
- Smoke contract `smoke-pickem.cjs` Group 5 (cross-repo lockstep) lands here for `pickReminder` / `pickResults` / `pickemSeasonReset` keys across `js/app.js` + `queuenight/functions/index.js`
- Floor meta-assertion remains placeholder (`FLOOR=1`) until Plan 28-06 raises to `>=13`

Plan 28-04 (Firestore rules) can proceed in parallel with Plan 28-03 — uses `validatePickSelection` shape allowlist for picks rule.

Plan 28-05 (UI) waits on Plan 28-03 — needs the settlement contract codified before wiring the picker / leaderboard surfaces.

Plan 28-02 owner discretion-question on F1/UFC fallback (option a/b/c surfaced in 28-01-SUMMARY) is now passed forward to Plan 28-03 / 05 owners. `scorePick` and `validatePickSelection` ship the full f1_podium + ufc_winner_method logic regardless — the gate is a UI/CF concern, not a helper-layer concern.
