---
phase: 26-position-anchored-reactions-async-replay
plan: 01
subsystem: testing
tags: [reactions, watchparty, schema-additive, smoke-contract, position-derivation]

# Dependency graph
requires:
  - phase: 24-native-video-player
    provides: STALE_BROADCAST_MAX_MS export from js/native-video-player.js (D-02 staleness gate)
  - phase: 07-watchparty
    provides: wp.reactions[] arrayUnion + per-reaction elapsedMs (D-01 fallback proxy)
  - phase: 23-live-scoreboard
    provides: window.postBurstReaction sports-mode amplified-burst write site (Phase 26 wires position-anchored fields here too)
provides:
  - state.activeWatchpartyMode session slot (Plans 02-03 will write 'revisit'|'live')
  - state.replayLocalPositionMs session slot (Plan 03 writes on local replay clock tick)
  - state.pastPartiesShownCount session slot (Plan 04 writes for pagination cursor)
  - derivePositionForReaction(ctx) helper — 4-state hybrid (replay/live-stream/broadcast/elapsed) per D-01..D-05
  - replayableReactionCount(wp) helper — D-10 hide-empty filter for Past parties + Tonight inline-link gating
  - postReaction + postBurstReaction stamping runtimePositionMs + runtimeSource on every new reaction
  - scripts/smoke-position-anchored-reactions.cjs (9th smoke contract; 33 assertions; ~249 lines)
  - scripts/deploy.sh §2.5 9th gate wiring
  - package.json smoke aggregate + smoke:replay alias
affects: [26-02-replay-modal-chrome, 26-03-replay-feed-render, 26-04-past-parties-expansion, 26-05-deploy]

# Tech tracking
tech-stack:
  added: []  # No new libraries; all changes are vanilla-JS additions inside existing modules
  patterns:
    - "Position-derivation hybrid: 4-branch waterfall locked at the helper layer (replay > live-stream > fresh-broadcast > elapsed) per CONTEXT D-01..D-05"
    - "Reaction schema-additive evolution: runtimePositionMs + runtimeSource on every new wp.reactions[] entry; existing fields unchanged; pre-Phase-26 reactions silently fail the replay-able predicate via loose-equality (!= null) per RESEARCH Pitfall 2"
    - "Inline-mirror smoke pattern (Phase 20 / smoke-decision-explanation analog): helpers live inside js/app.js as ES module; smoke mirrors body inline for behavior-test, then regex-greps production source for sentinels"

key-files:
  created:
    - scripts/smoke-position-anchored-reactions.cjs
  modified:
    - js/state.js (3 new session slots in single-line state initializer)
    - js/app.js (2 new helpers + postReaction + postBurstReaction integration)
    - scripts/deploy.sh (9th smoke gate + recap echo extension)
    - package.json (smoke aggregate chain + smoke:replay alias)

key-decisions:
  - "All 3 session state slots ship in Plan 01 as one coherent set; splitting across plans would force later plans to re-edit js/state.js"
  - "STALE_BROADCAST_MAX_MS import was already added during Phase 24 (per VID-24-15 — confirmed at js/app.js:14); Plan 01 reuses it without adding a duplicate import"
  - "Helpers stay regular function declarations (NOT window.foo = ...) — they're internal consumers; smoke mirrors body inline per Phase 20 precedent"
  - "Loose-equality (!= null) in replayableReactionCount catches BOTH null (live-stream sourced) AND undefined (pre-Phase-26 reactions) — single predicate, two semantics"

patterns-established:
  - "Plans 02-05 will EXTEND scripts/smoke-position-anchored-reactions.cjs incrementally — assertion floor 13 from UI-SPEC §7; Plan 01 already exceeds at 33"
  - "isReplay branch is wired NOW but unreachable until Plan 02 sets state.activeWatchpartyMode = 'revisit'; the 'replay' enum value is intentionally inert in production until Plan 02 ships"

requirements-completed: [RPLY-26-01, RPLY-26-02, RPLY-26-03, RPLY-26-07, RPLY-26-10, RPLY-26-13, RPLY-26-19]

# Metrics
duration: 5min
completed: 2026-05-01
---

# Phase 26 Plan 01: Foundation Summary

**Schema-additive runtimePositionMs + runtimeSource stamping at both reaction write sites, 4-state derivePositionForReaction helper (replay/live-stream/broadcast/elapsed), 3 session state slots, and the Phase 26 smoke contract foundation (33 assertions) wired into the 9-contract deploy gate.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-01T17:42:41Z
- **Completed:** 2026-05-01T17:47:25Z
- **Tasks:** 4 (all atomic-committed)
- **Files modified:** 4 (1 new + 3 edited)

## Accomplishments
- Every new reaction posted via `postReaction` OR `postBurstReaction` now stamps `runtimePositionMs` (number|null) AND `runtimeSource` (one of 'broadcast'|'elapsed'|'live-stream'|'replay') as literal keys on the `wp.reactions[]` entry
- `derivePositionForReaction(ctx)` 4-state hybrid is callable from both write sites with `ctx={wp,mine,elapsedMs,isReplay,localReplayPositionMs}` and returns the locked CONTEXT D-01..D-05 shape (replay first, then live-stream, then fresh-broadcast, then elapsed fallback)
- `replayableReactionCount(wp)` returns 0 for pre-Phase-26 reactions (undefined `runtimePositionMs`) AND for live-stream-only reactions; counts only broadcast/elapsed/replay-sourced — D-10 hide-empty filter ready for Plan 04 Past parties surface gating
- 3 new session state slots (`activeWatchpartyMode`, `replayLocalPositionMs`, `pastPartiesShownCount`) live on the state object initializer (default `null`) ready for Plans 02-04 to write
- 9th smoke contract `scripts/smoke-position-anchored-reactions.cjs` (~249 lines; 33 assertions) runs in <5s and exits 0; wired into both `bash scripts/deploy.sh` §2.5 deploy gate AND `npm run smoke` aggregate (with `npm run smoke:replay` alias)
- `firestore.rules` confirmed via smoke sentinel: `reactions` is NOT in the Phase 24 / REVIEWS M2 currentTime denylist (D-07 single-repo deploy assertion holds)

## Task Commits

Each task was committed atomically:

1. **Task 1.1: Add Phase 26 session state slots to js/state.js** — `dd06cec` (feat)
2. **Task 1.2: Add derivePositionForReaction + replayableReactionCount helpers + STALE_BROADCAST_MAX_MS import** — `29dacbf` (feat)
3. **Task 1.3: Wire derivePositionForReaction into postReaction AND postBurstReaction** — `0e77105` (feat)
4. **Task 1.4: Create scripts/smoke-position-anchored-reactions.cjs scaffold + wire into deploy.sh + package.json** — `149e035` (chore)

**Plan metadata commit:** pending (final commit at the end of this plan).

## Files Created/Modified

- `scripts/smoke-position-anchored-reactions.cjs` — NEW; 249 lines; 33 assertions covering helper-behavior + production-code sentinels for the Phase 26 foundation. Imports STALE_BROADCAST_MAX_MS via dynamic `await import(pathToFileURL(...).href)`; mirrors `derivePositionForReaction` + `replayableReactionCount` inline per Phase 20 precedent
- `js/state.js` — 3 new session slots inserted into the single-line state initializer immediately after `activeWatchpartyId:null,` (preserves single-line formatting)
- `js/app.js` — Two new helpers (one ~30-line `derivePositionForReaction`, one one-liner `replayableReactionCount`); two write-site integrations (`postReaction` at line ~11932 + `postBurstReaction` at line ~10672) — both stamp the two new fields as literal keys on the reaction object
- `scripts/deploy.sh` — 4-line `if [ -f ... ]; then ... fi` block added after `smoke-native-video-player.cjs` block; recap echo extended to list `position-anchored-reactions`
- `package.json` — Appended `&& node scripts/smoke-position-anchored-reactions.cjs` to the `smoke` aggregate chain (now 9 smokes); added `smoke:replay` alias

## Decisions Made

- **Helper insertion location:** `replayableReactionCount` immediately after `archivedWatchparties` (line 2935-area; same neighborhood, same one-liner shape per 26-PATTERNS.md row); `derivePositionForReaction` immediately before `postReaction` (so the helper is defined before its first call site)
- **`postBurstReaction` wp lookup:** added `const wp = state.watchparties.find(x => x.id === wpId)` BEFORE the `derivePositionForReaction` call, since the original function only had `wpId` (string) — defensive `wp || {}` passed to the helper handles missing-wp cases
- **`isReplay` ctx field reads `state.activeWatchpartyMode === 'revisit'`:** wired NOW so future Plan 02 just-works when it sets the flag; until then `isReplay === false` always, so the 'replay' enum branch is unreachable in production (intentional — Plan 02 owns the activation)
- **Field-name literal keys:** `runtimePositionMs` and `runtimeSource` MUST appear as object literal keys (not via dynamic `[key]` or rest-spread) — smoke regex sentinels grep for the literal forms per RPLY-26-07; documented in code comments at both write sites

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 1.2 Edit A noted the `STALE_BROADCAST_MAX_MS` import "should be extended" on the existing `./native-video-player.js` import line. Verification at execution time showed Phase 24 already added this import (see `js/app.js:14` — `STALE_BROADCAST_MAX_MS` is the 6th named import in the existing static import block). The plan's verify command (`grep -E "STALE_BROADCAST_MAX_MS[^;]*from\s+['\"]\./native-video-player\.js['\"]"` matches exactly 1 line) was already satisfied — no edit needed. This was anticipated by the plan ("Phase 24 already imports from this module per VID-24-15 — executor must extend that existing import statement, NOT add a new one"); the import was already correctly extended during Phase 24, so Plan 01's only requirement was to verify (which it did).

## Issues Encountered

- One minor warning during smoke execution: `MODULE_TYPELESS_PACKAGE_JSON — Reparsing as ES module because module syntax was detected.` This is a pre-existing condition (the project intentionally has no `"type": "module"` in package.json — single-file no-bundler architecture per CLAUDE.md). The smoke still passes; warning is benign and consistent with `smoke-native-video-player.cjs` behavior.

## Smoke Output

```
Total assertions: 33; Failures: 0
Phase 26 smoke PASSED.
```

Breakdown:
- 11 helper-behavior assertions (4-state hybrid + replay branch + defensive defaults + replayableReactionCount predicate)
- 19 production-code sentinels (RPLY-26-01..03/07/10/13/19 — both write sites grep-checked for runtimePositionMs + runtimeSource LITERAL keys; both helper declarations grep-checked; both state slots grep-checked)
- 3 firestore.rules sanity checks (RPLY-26-19 + Phase 24 M2 currentTime denylist still present)

## RPLY-26-* Coverage at the Smoke Layer

| ID | Status | Where |
|---|---|---|
| RPLY-26-01 | ✓ Smoke-codified | `derivePositionForReaction` 4-branch hybrid + helper-behavior assertions for all 5 cases (live-stream / fresh-broadcast / stale-broadcast / no-broadcast / replay-mode) + helper-declaration sentinel |
| RPLY-26-02 | ✓ Smoke-codified | `STALE_BROADCAST_MAX_MS` import sentinel + dynamic-import behavior assertion (positive finite) |
| RPLY-26-03 | ✓ Smoke-codified | All 4 `runtimeSource` enum values appear as literals in production source (sentinel checks each) |
| RPLY-26-07 | ✓ Smoke-codified | `runtimeSource: 'replay'` literal sentinel covers both the helper-return-shape AND the future compound-write case (Plan 03 finishes the path) |
| RPLY-26-10 | ✓ Smoke-codified | `replayableReactionCount` predicate + helper-declaration sentinel + 4-fixture behavior tests |
| RPLY-26-13 | ◐ Partial (slot only) | `activeWatchpartyMode:null` slot sentinel landed; full assignment (Plan 02 sets `'revisit'` in `openWatchpartyLive` + Plan 02 clears in `closeWatchpartyLive`) lands next |
| RPLY-26-19 | ✓ Smoke-codified | `firestore.rules` sentinel: `reactions` NOT in `affectedKeys().hasAny([...])` denylist; sanity sentinel: `currentTimeMs` IS in denylist |

## Next Plan Readiness

- **Plan 02 (replay-modal chrome)** can ASSUME:
  - `state.activeWatchpartyMode` exists on state initializer (just write `'revisit'` / `'live'` from `openWatchpartyLive(opts)`)
  - `state.replayLocalPositionMs` exists ready for Plan 03 to populate
  - `derivePositionForReaction` is in place — `isReplay` branch will activate the moment `state.activeWatchpartyMode === 'revisit'`
  - Smoke contract exists; just append assertions for the Plan 02 changes
- **Plan 02's first assertion to add:** `js/state.js` slot is also ASSIGNED in `openWatchpartyLive` (sentinel: literal `state.activeWatchpartyMode = 'revisit'` appears inside `window.openWatchpartyLive`)
- **No UI is visible to users yet** — the `'replay'` enum branch is unreachable until Plan 02 sets `state.activeWatchpartyMode = 'revisit'`. Live-mode reactions and sports-mode amplified-bursts now carry the new schema fields, which is invisible to users (additive only) but unblocks all downstream replay UX.

## User Setup Required

None — no external service configuration required; no deploy in this plan (Plan 26-05 owns the deploy + CACHE bump).

## Self-Check: PASSED

- ✓ FOUND: js/state.js (3 new slots; node --check pass)
- ✓ FOUND: js/app.js (2 new helpers + 2 modified write sites; node --check pass)
- ✓ FOUND: scripts/smoke-position-anchored-reactions.cjs (249 lines; 33 assertions; exits 0)
- ✓ FOUND: scripts/deploy.sh (9th gate + recap echo)
- ✓ FOUND: package.json (smoke aggregate + smoke:replay alias)
- ✓ FOUND: dd06cec (Task 1.1 commit)
- ✓ FOUND: 29dacbf (Task 1.2 commit)
- ✓ FOUND: 0e77105 (Task 1.3 commit)
- ✓ FOUND: 149e035 (Task 1.4 commit)

---
*Phase: 26-position-anchored-reactions-async-replay*
*Completed: 2026-05-01*
