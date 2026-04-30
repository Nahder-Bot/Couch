---
phase: 22-sports-feed-abstraction
status: shipped
shipped: 2026-04-30
mode: direct-ship (no formal /gsd-plan-phase chain — mirrors Phase 21 pattern)
verifier_method: code-level acceptance + smoke contract green + live curl verification
---

# Phase 22: Sports feed abstraction + TheSportsDB swap — Summary

**Shipped:** 2026-04-30 — `couch-v36.6-sports-feed-swap` live on couchtonight.app

## What was delivered

Replaces the **ESPN hidden API** (explicitly noted as "ToS-gray" per Phase 11 RESEARCH §4 — App Store §2.3 + §5.1.5 reject apps using undocumented APIs) with a clean abstraction over **TheSportsDB** (legitimate public API). Expands league coverage from **4 US leagues → 16 global leagues** including soccer (Premier League, La Liga, Bundesliga, Serie A, Ligue 1, UCL, MLS), college (NCAAF, NCAAB), WNBA, F1, and UFC.

This is the foundational phase for the watchparty/sports v2 milestone — every downstream phase (live scoreboard / pick'em / affiliate referral) depends on legitimate, license-compliant sports data.

## Key files

### Created
- `js/sports-feed.js` (~155 lines) — abstraction module exporting:
  - `LEAGUES` — 16-entry catalog with TheSportsDB league IDs + sport name + emoji + source tag
  - `fetchSchedule(leagueKey, daysAhead)` — returns normalized Game array sorted by startTime
  - `fetchScore(gameId, leagueKey)` — 15s-bucketed score lookup
  - `normalizeTsdEvent(ev, leagueKey)` — TheSportsDB event → canonical Game shape
  - `leagueLabel(key)` / `leagueEmoji(key)` / `leagueKeys()` — UI helpers
- `scripts/smoke-sports-feed.cjs` (25 assertions A1-F2) — locks LEAGUES catalog (8 assertions) + normalizeTsdEvent contract (17 assertions covering scheduled / live / final / edges / case insensitivity)

### Modified
- `js/app.js`:
  - Added import: `import { LEAGUES, fetchSchedule, fetchScore, leagueKeys } from './sports-feed.js'`
  - Replaced the 4-entry `SPORTS_LEAGUES` const (line ~10094) with delegation to imported `SPORTS_FEED_LEAGUES`
  - `openSportsPicker` now renders league tabs **dynamically** from `feedLeagueKeys()` — adding a new league = single line in `sports-feed.js`
  - `loadSportsGames` swapped from direct ESPN URL fetch to `feedFetchSchedule(leagueKey, 7)` — pre-normalized games, no `parseEspnEvent` step needed
  - `renderSportsGames` skips the now-redundant `.map(parseEspnEvent)` call (input is already normalized)
  - `scheduleSportsWatchparty` reads normalized games directly from cache (no second parse)
  - `SportsDataProvider.getSchedule` + `.getScore` delegate to `feedFetchSchedule` / `feedFetchScore`
  - `SportsDataProvider.getPlays` returns `[]` (TheSportsDB free tier doesn't expose play-by-play; Patreon $14/yr or per-league API-Sports supplement restores this — deferred)
- `scripts/deploy.sh` §2.5 — added 7th smoke if-block + updated echo line
- `package.json` — extended `smoke` chain to 7 contracts + new `smoke:sports-feed` entry
- `sw.js` — CACHE bumped from `couch-v36.5-conflict-aware-empty` to `couch-v36.6-sports-feed-swap`

## Commits (5 atomic on main)

1. `d0fa183` — feat: add js/sports-feed.js — TheSportsDB+BALLDONTLIE abstraction (16 leagues incl. soccer/F1/UFC)
2. `3fd3f15` — refactor(sports): replace ESPN scrape (ToS-gray) with sports-feed delegation; dynamic 16-league picker; SportsDataProvider delegates
3. `8e73750` — test: add smoke-sports-feed (25 assertions A1-F2) — locks LEAGUES catalog + normalizeTsdEvent contract
4. `60f2b44` — chore: wire smoke-sports-feed into deploy.sh + package.json (7th contract)
5. `04f73cc` — chore: bump sw.js CACHE to couch-v36.6-sports-feed-swap

## Verification

- **Smoke gate:** all 7 contracts green (`npm run smoke` exits 0; ~146 total assertions across position-transform + tonight-matches + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed)
- **Syntax gate:** `node --check js/sports-feed.js` passes; `node --check js/app.js` passes
- **Live deploy:** `bash scripts/deploy.sh 36.6-sports-feed-swap` exits 0 with full smoke pre-flight; firebase release complete
- **Live curl verification:**
  - `https://couchtonight.app/sw.js` → `const CACHE = 'couch-v36.6-sports-feed-swap';`
  - `https://couchtonight.app/js/sports-feed.js` returns the new module (first line: `// === Phase 22 — Sports data abstraction ===`)
  - `https://couchtonight.app/js/app.js` contains 8 references to `feedFetchSchedule` / `sports-feed.js` (1 import + 7 usage sites)
  - `https://couchtonight.app/` returns HTTP 200

## League catalog (16 leagues, all source `tsd`)

| Key | Label | Sport | Emoji | TSD ID |
|-----|-------|-------|-------|--------|
| nba | NBA | Basketball | 🏀 | 4387 |
| nfl | NFL | American Football | 🏈 | 4391 |
| mlb | MLB | Baseball | ⚾ | 4424 |
| nhl | NHL | Ice Hockey | 🏒 | 4380 |
| wnba | WNBA | Basketball | 🏀 | 4516 |
| ncaaf | NCAAF | American Football | 🏈 | 4479 |
| ncaab | NCAAB | Basketball | 🏀 | 4607 |
| epl | English Premier League | Soccer | ⚽ | 4328 |
| laliga | Spanish La Liga | Soccer | ⚽ | 4335 |
| bundesliga | German Bundesliga | Soccer | ⚽ | 4331 |
| seriea | Italian Serie A | Soccer | ⚽ | 4332 |
| ligue1 | French Ligue 1 | Soccer | ⚽ | 4334 |
| ucl | UEFA Champions League | Soccer | ⚽ | 4480 |
| mls | American Major League Soccer | Soccer | ⚽ | 4346 |
| f1 | Formula 1 | Motorsport | 🏎 | 4370 |
| ufc | UFC | Fighting | 🥊 | 4443 |

## Process deviation note

This phase **deviated from the standard GSD chain** (CONTEXT.md → discuss → plan → verify → execute → complete). Mirrors Phase 21 pattern: direct-ship via inline edits + smoke + commit + deploy. Per user redirect at start of v2 milestone work — formal GSD ceremony is overhead for surgical refactors with clear scope.

## Pending / deferred

- **TheSportsDB Patreon API key ($14/yr)** — `TSD_API_KEY = '1'` (free test key) wired in `js/sports-feed.js`. **User needs to subscribe at https://www.patreon.com/thesportsdb and replace `'1'` with the dedicated key** to unlock: live in-game scores (faster updates), `eventsnext.php` endpoint (next-N-games queries), and rate-limit headroom. Free tier works for v1 ship and testing scope-of-coverage; the upgrade is a single-line change.
- **BALLDONTLIE NBA realtime supplement** — comments in `sports-feed.js` reference this as a future supplement for NBA. Not implemented in Phase 22 (TheSportsDB free tier is sufficient for the watchparty use case at v1). Will be wired alongside the Patreon key when the user subscribes.
- **Play-by-play (`getPlays`)** — returns `[]` until Patreon upgrade or per-league API-Sports supplement (~$10-50/mo per league). Phase 11's catch-me-up surface degrades gracefully.
- **Phase 23 — live scoreboard surface + consolidate the two sports flows** (`openSportsPicker` legacy + `openGamePicker` newer mode='game') is the next phase in the v2 milestone roadmap.
- **REQ-22-XX traceability rows** in REQUIREMENTS.md — documentation debt; defer to a future audit-trail backfill phase mirroring Phase 15.6.

## Next phase

Phase 23 — Live scoreboard surface (renders `scoringPlays[]` + `lastScore` Firestore fields during sports watchparties; currently written but never displayed) + consolidate the two parallel sports flows (`openSportsPicker` + `openGamePicker`) into one. Closes the tech-debt gap from the v2 review.

---

*Phase: 22-sports-feed-abstraction*
*Shipped: 2026-04-30 via direct implementation (5 atomic commits d0fa183 → 04f73cc)*
