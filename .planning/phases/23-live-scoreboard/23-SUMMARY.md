---
phase: 23-live-scoreboard
status: shipped
shipped: 2026-04-30
mode: direct-ship (no formal /gsd-plan-phase chain — autonomous execution per user direction)
verifier_method: code-level acceptance + smoke contract green + live curl verification
---

# Phase 23: Live scoreboard + flow consolidation — Summary

**Shipped:** 2026-04-30 — `couch-v36.7-live-scoreboard` live on couchtonight.app

## What was delivered

Closes the "scoreboard renders but never updates" gap on legacy sports watchparties identified in the watchparty/sports brutally-honest review. The scoreboard chrome (`renderSportsScoreStrip`) and polling pipeline (`startSportsScorePolling` → `SportsDataProvider.getScore` → `updateSportsScoreStrip`) were already built in Phase 11/REFR-10 — but the polling gate at the live-modal-open path only fired when `wp.mode === 'game'`, which the legacy `scheduleSportsWatchparty` flow never set.

**Two surgical changes:**

1. **Polling gate widened** (`js/app.js` ~line 10984): now fires `startSportsScorePolling(wp)` when EITHER `wp.mode === 'game'` OR `wp.sportEvent` is set. The team-flair picker (a Phase 11 surface that didn't exist when the legacy flow was built) stays gated on `mode === 'game'` only, since legacy wps wouldn't have user expectations around it.

2. **Legacy `scheduleSportsWatchparty` sets `mode: 'game'`** (`js/app.js` ~line 10241): brings legacy sports wp records up to the canonical Game Mode shape. Both flows now produce equivalent records → both flows get the full Game Mode pipeline (live polling + scoring-play amplified reactions + scoringPlays catch-me-up + team-flair picker).

**Two-flow consolidation note:** The legacy `openSportsPicker` UI entry was **already orphaned in app.html before Phase 23** — only `openGamePicker()` is wired to a button (app.html:450). The legacy modal HTML (`#sports-picker-bg`) and `openSportsPicker()` JS function remain in place for back-compat (in case any deep-linked surface or future code path calls them) but no UI surfaces invoke them. No further consolidation work needed beyond Phase 23's two changes — the two flows are now functionally equivalent at the wp-record level, and the UI is already single-flow.

## Key files

### Modified
- `js/app.js` (2 surgical edits — ~5 lines net):
  - Polling gate widened to also fire for `wp.sportEvent` (not just `mode === 'game'`)
  - Legacy `scheduleSportsWatchparty` wp creation sets `mode: 'game'`
- `sw.js` — CACHE bumped from `couch-v36.6-sports-feed-swap` to `couch-v36.7-live-scoreboard`

## Commits (2 atomic on main)

1. `ad95a15` — feat(sports): live scoreboard polling now fires for legacy sportEvent wps; legacy flow sets mode=game (full Game Mode pipeline)
2. `516cbae` — chore: bump sw.js CACHE to couch-v36.7-live-scoreboard

## Verification

- **Smoke gate:** all 7 contracts green (`npm run smoke` exits 0; ~146 total assertions). No new contracts added — fix is pure runtime behavior change.
- **Syntax gate:** `node --check js/app.js` passes
- **Live deploy:** `bash scripts/deploy.sh 36.7-live-scoreboard` exits 0; firebase release complete
- **Live curl verification:** `https://couchtonight.app/sw.js` returns `const CACHE = 'couch-v36.7-live-scoreboard';`

## Process notes

Autonomous execution per user direction at end of session ("work on what you can without my involvement"). No user input required — phase scoped + executed + deployed entirely from existing code analysis. Mirrors Phase 21 / 22 direct-ship pattern.

## Pending / deferred

- **Removal of legacy `openSportsPicker` modal HTML + JS function** — deferred to a future cleanup phase. Currently dead UI (no call sites in app.html) but kept for back-compat. Safe to remove when next touching app.html.
- **Per-play narrative ("Lakers 2-pointer at 9:32 in Q3")** — requires `SportsDataProvider.getPlays` to return data, which depends on TheSportsDB Patreon upgrade ($14/yr) or per-league API-Sports supplement. Already noted in Phase 22 SUMMARY.
- **REQ-23-XX traceability rows** in REQUIREMENTS.md — documentation debt; defer to a future audit-trail backfill phase mirroring Phase 15.6.
- **Device UAT** — visual confirmation that the live scoreboard updates during a real sports watchparty deferred to user (per 4-day in-person UAT freeze).

## Next phase

Phase 24 — Native video player (iframe + HTML5). Iframe wrapper for YouTube/Twitch/Vimeo + HTML5 `<video>` for self-hosted MP4/M3U8/Plex/Jellyfin URLs. Player.currentTime broadcast to Firestore so Phase 26 reactions can anchor.

---

*Phase: 23-live-scoreboard*
*Shipped: 2026-04-30 via autonomous direct-ship (2 atomic commits ad95a15 → 516cbae)*
