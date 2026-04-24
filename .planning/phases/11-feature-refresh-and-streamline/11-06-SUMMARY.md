---
phase: 11
plan: 06
subsystem: sports-game-mode, espn-provider, score-polling, dvr-offset, team-flair, catch-me-up-sport-variant
tags: [sports, game-mode, espn, balldontlie, sports-data-provider, score-strip, score-delta, amplified-reactions, dvr, late-joiner-sports, team-flair, security-surface]
requirements: [REFR-10]
requirements_closed: [REFR-10]
dependency_graph:
  requires: [Phase 7 watchparty infrastructure (wp.sportEvent schema, reactionDelay filter in renderReactionsFeed), Phase 9 design tokens, Plan 11-05 renderCatchupCard sports-variant placeholder (now replaced), Plan 11-05 sw.js baseline (v27)]
  provides: [SportsDataProvider abstraction (ESPN primary + BALLDONTLIE stub), openGamePicker + confirmGamePicker flow (mode='game' watchparty creation), renderSportsScoreStrip sticky chrome, startSportsScorePolling adaptive 5s/15s loop, handleScoringPlay + showAmplifiedReactionPicker + postBurstReaction, renderDvrSlider + setDvrOffset (reuses Phase 7 reactionDelay anchor), maybeShowTeamFlairPicker + setUserTeamFlair (teamColor via --team-color custom property), sports variant of renderCatchupCard (score + last 3 plays)]
  affects: [renderWatchpartyLive (score strip prepended + DVR slider appended when mode='game'), openWatchpartyLive (starts polling + team-flair prompt when mode='game'), closeWatchpartyLive (stops polling), renderParticipantTimerStrip (avatar inline-style --team-color passthrough + has-team-flair class), app.html Add-tab (new 'Watch a game live' entry), sw.js CACHE]
tech_stack:
  added:
    - "ESPN hidden API summary endpoint (site.api.espn.com/.../summary?event=<id>) for score + play-by-play polling — distinct from the existing scoreboard?dates=<date> endpoint used by loadSportsGames"
    - "BALLDONTLIE provider slot (www.balldontlie.io) — code branch stubbed for future swap if ESPN denies; not active in v1"
  patterns:
    - "SportsDataProvider abstraction: getSchedule(leagueKey, daysAhead) / getScore(gameId, leagueKey) / getPlays(gameId, leagueKey, sinceTs). All 3 methods route on SPORTS_PROVIDER_CONFIG[leagueKey].provider === 'espn' vs 'balldontlie' — single switch-point for future swap."
    - "(gameId, bucket) cache keys for score + plays (15s/30s buckets) so 100 concurrent viewers of the same game = 1 fetch/bucket. Mitigates T-11-06-02 DoS vector."
    - "Adaptive polling interval: 5s when score.state === 'in' (active play) / 15s otherwise. setTimeout-chain rather than setInterval so in-flight fetches can't overlap and the interval adapts per-tick."
    - "Score-delta detection via in-memory baseline (_sportsLastScore) + diff on each tick. On change: flash + amplified picker + Firestore scoringPlays arrayUnion + lastScore patch."
    - "Amplified reaction picker: fixed-position DOM overlay inside .wp-live-modal, 3s auto-dismiss, on-tap dismiss immediately. Reactions flow through existing reactions[] array with amplified:true flag (future render-side differentiator)."
    - "DVR slider writes BOTH participants[mid].dvrOffsetMs (the new canonical field) AND participants[mid].reactionDelay (the Phase 7 PARTY-04 anchor) — the existing reactionDelay render-filter in renderReactionsFeed already implements the correct behavior, so the DVR slider is a relabeled UI driving the proven filter. Zero new render-side logic required."
    - "Throttled Firestore writes on slider drag — 500ms debounce via _dvrThrottleHandle. UI-side oninput updates the readout instantly; onchange commits."
    - "Team-flair prompt one-shot guard: maybeShowTeamFlairPicker exits early when mine.teamAllegiance is set (already picked) or when #team-flair-overlay exists (modal already open). Prevents re-prompt on every renderWatchpartyLive tick."
    - "Polling lifecycle hooks: openWatchpartyLive starts (when mode==='game'), closeWatchpartyLive stops. _sportsPollWpId guards against stale in-flight fetches overwriting state after a close."
    - "Sports variant of Catch-me-up card ALWAYS renders for late-joiners (no <3 reactions guard) — the score + last-plays card is informative even with zero reactions. Movie-mode <3 guard preserved verbatim."
key_files:
  modified:
    - "js/app.js"
    - "app.html"
    - "css/app.css"
    - "sw.js"
decisions:
  - "ESPN primary / BALLDONTLIE stub — per RESEARCH §4 + CONTEXT decision 3: Game Mode ships on ESPN hidden API first (proven, no key required) with BALLDONTLIE as a fallback slot if ESPN denies. SPORTS_PROVIDER_CONFIG is the single switch-point; BALLDONTLIE branch is placeholder-return today (3-5 hr to activate when needed). Accepted ToS-gray posture per T-11-06-01."
  - "Cache bucket sizes: 15s for scores, 30s for plays. Scores change most frequently (every play-by-play tick during live); plays are an auxiliary feed. Bucket keys are (gameId, floor(now/bucketMs)) so expiry is natural — no manual TTL cleanup."
  - "Adaptive polling 5s/15s: per RESEARCH §4 recommendation. 5s during STATUS_IN_PROGRESS (matches user-perceived 'immediate' threshold for score-delta reactions); 15s during pre-game and post-final (budget discipline). Not tunable at runtime in v1 — single-source of truth in the tick handler."
  - "DVR slider reuses Phase 7 reactionDelay field instead of introducing a parallel render-filter: writes go to BOTH dvrOffsetMs (new, canonical) AND reactionDelay (existing anchor) so the existing render-filter picks up the change without modification. If a future plan decouples DVR from spoiler-protection they can migrate renderReactionsFeed to read dvrOffsetMs, but for v1 one-field-two-uses is simpler."
  - "Team-flair written on Firestore participants sub-doc (not members sub-doc) so allegiance is per-watchparty (a family member who roots for different teams across games gets a fresh prompt each game). teamColor is sanitized via escapeHtml on client-side but trusted at the render layer — accepted v1 posture per T-11-06-05 (own-entry writes only)."
  - "Game picker is a SECOND entry point on Add tab (icon 📺, title 'Watch a game live') distinct from the legacy 'Schedule a game' entry (icon 🏈). Legacy sports watchparties (openSportsPicker flow) stay functional with wp.sportEvent but WITHOUT wp.mode === 'game'; Game Mode UI variants (score polling, amplified reactions, DVR, team-flair) only activate on mode==='game'. Rule 3 auto-fix — plan 'note to executor' L846 called this out as a branching decision."
  - "Score strip renders for BOTH wp.mode === 'game' AND legacy wp.sportEvent (without mode flag) — the score strip is read-only chrome that improves any sport wp. Polling + amplified reactions + DVR + team-flair remain gated on mode === 'game' alone so legacy sports watchparties don't silently change behavior."
  - "wp.scoringPlays initialized to [] at watchparty creation time (confirmGamePicker). arrayUnion appends are idempotent at the Firestore level but the in-memory _sportsLastScore diff is the real dedup — same-score polls don't hit handleScoringPlay in the first place."
metrics:
  duration_minutes: 35
  completed_at: "2026-04-24T00:00:00Z"
  tasks_completed: 3_of_3_code
  tasks_total: 4
  main_repo_commits: 4
  sibling_repo_commits: 0
  files_modified: 4
  checkpoint_reached: "Task 4 human-verify (deferred — deploy + manual Game Mode walkthrough + live score verification)"
---

# Phase 11 Plan 06: Sports Game Mode v1 Summary

**Dedicated Game Mode unlocks SportsDataProvider (ESPN primary, BALLDONTLIE stub), game picker modal, sticky live score strip, score-delta adaptive polling (5s on-play / 15s off-play), amplified burst-reaction picker, per-user DVR slider reusing Phase 7's reactionDelay anchor, team-flair avatar badges, and the sports variant of the late-joiner Catch-me-up card. Closes REFR-10; movie watchparty mode untouched. Per-RESEARCH §4 guidance: Couch owns the social layer; users BYO stream; DVR slider mitigates the #1 sports-watch complaint (friend on DirecTV sees TD 30s before friend on streaming).**

## What Shipped

### Main repo (4 atomic commits)

1. **`0181de1`** `feat(11-06): SportsDataProvider abstraction + ESPN wrappers (REFR-10)`
   - `js/app.js` +132 lines — `SPORTS_PROVIDER_CONFIG` (4 leagues, provider router), `sportsScoreCache` + `sportsPlaysCache` objects, `SCORE_CACHE_BUCKET_MS = 15s`, `PLAYS_CACHE_BUCKET_MS = 30s`, `sportsBucketKey` helper, `SportsDataProvider` object with 3 async methods.
   - `getSchedule(leagueKey, daysAhead=7)` — 7-day fan-out over ESPN scoreboard dates, parses with existing `parseEspnEvent`, tags results with `league` key for downstream routing.
   - `getScore(gameId, leagueKey)` — ESPN summary endpoint, extracts homeScore/awayScore/period/clock/state/statusDetail, caches per 15s bucket. Returns null on fetch failure (graceful degradation).
   - `getPlays(gameId, leagueKey, sinceTs)` — ESPN summary.plays array, slices last 10, normalizes to `{id,text,scoringPlay,period,clock,ts}`. Caches per 30s bucket.
   - Existing `loadSportsGames` + `parseEspnEvent` + `SPORTS_LEAGUES` + `sportsGamesCache` PRESERVED verbatim — SportsDataProvider sits alongside, not in place of.
   - BALLDONTLIE branch stubbed: returns `[]` for unknown-provider config. Activation requires implementing the single branch inside each of the 3 methods (~3-5 hr).

2. **`c79ab78`** `feat(11-06): game picker modal + sports mode + live score strip (REFR-10)`
   - `app.html` +21 lines — new `#game-picker-modal-bg` modal: h3 "Tonight's game" + meta subtitle + 4 league pill buttons (NFL/NBA/MLB/NHL) + scrollable `#game-picker-list` + Cancel + Use-this-game CTA (brand-grad, disabled until a card is selected).
   - `js/app.js` +193 lines — `_gamePickerSelected` + `_gamePickerLeague` module-scoped state; 5 window handlers: `openGamePicker`, `closeGamePicker`, `loadGamePickerLeague(leagueKey)`, `selectGame(gameId, encodedJson)`, `confirmGamePicker()`.
   - `loadGamePickerLeague` fetches via `SportsDataProvider.getSchedule(leagueKey, 7)`, renders game cards (away team + at + home team + kickoff time). Empty state: "No live games right now — check back near kickoff."
   - `selectGame` decodes URI-encoded game JSON payload from onclick, highlights card with `.on` (accent border + scale 0.99), enables CTA.
   - `confirmGamePicker` creates a wp with `mode: 'game'` flag + full `wp.sportEvent` payload (id/league/emoji/teams/abbrevs/logos/venue/broadcast) + `scoringPlays: []` init. Fires Web Share path (navigator.share → /rsvp/<wpId>) non-blockingly. Opens `wp-live-modal-bg` 200ms after create.
   - `renderSportsScoreStrip(wp)` — sticky-top chrome injected into `wp-live-body` when `wp.mode === 'game' || wp.sportEvent`. Shows: away-abbr + away-score · LIVE/Pre-game middle · home-abbr + home-score. Tabular-nums. Seeded from `wp.lastScore` (persisted by polling loop in commit 3) falling back to `wp.sportEvent` abbreviations.
   - `renderWatchpartyLive` now prepends `renderSportsScoreStrip(wp)` to `body` when `wp.mode === 'game' || wp.sportEvent`. Legacy sports wps get the chrome too (no regression for existing flows).
   - `css/app.css` +56 lines — `.game-picker-modal` / `.game-picker-league-row` / `.game-picker-league-btn.on` / `.game-picker-list` / `.game-picker-card` (grid 1fr auto 1fr + accent border on `.on`) / `.game-picker-team` / `.game-picker-at` / `.game-picker-kickoff` / `.game-picker-empty` / `.game-picker-confirm` (brand-grad) + `.sports-score-strip` (sticky top:0 z-index:2, 40px min-height) / `.sports-score-team` / `.sports-score-team-abbr` / `.sports-score-num` (Fraunces 22px tabular-nums) / `.sports-score-middle` / `.sports-score-live` / `@keyframes sports-score-pulse` / `.sports-score-strip.flash`.

3. **`1f03ff1`** `feat(11-06): score-delta polling + amplified reactions + DVR + team-flair + bump sw.js (REFR-10)`
   - `js/app.js` +370 lines — 9 new functions + 4 wire-up integrations:
     - **Score polling:** `startSportsScorePolling(wp)` (adaptive setTimeout chain), `stopSportsScorePolling()` (interval + baseline reset), `updateSportsScoreStrip(wpId, score)` (in-place DOM update — no full re-render; updates scores, middle text, and team abbreviations), `handleScoringPlay(wp, prevScore, newScore)` (flash strip + amplified picker + Firestore scoringPlays arrayUnion + lastScore patch + getPlays for play-by-play text).
     - **Amplified reactions:** `showAmplifiedReactionPicker(wp)` (fixed-position overlay with 4 burst emojis 🔥🎉😱💪, 3s auto-dismiss), `postBurstReaction(wpId, emoji)` (writes to reactions[] with `amplified: true` flag via arrayUnion, haptic success).
     - **DVR slider:** `renderDvrSlider(wp, mine)` (HTML5 range input 0-180s step=5s with accent-styled thumb), `dvrReadoutText(sec)` helper, `updateDvrReadout(secStr)` (real-time on-input), `setDvrOffset(wpId, secStr)` (throttled 500ms Firestore write to BOTH dvrOffsetMs AND reactionDelay so Phase 7 render-filter picks it up).
     - **Team-flair:** `maybeShowTeamFlairPicker(wp, mine)` (one-shot modal overlay, skips if teamAllegiance set or overlay already exists), `setUserTeamFlair(wpId, allegiance, hexColor)` (writes teamAllegiance + teamColor to own participant entry, removes overlay).
     - **Lifecycle wire-up:** `openWatchpartyLive(wpId)` — on `wp.mode === 'game'`, starts `startSportsScorePolling(wp)` + `maybeShowTeamFlairPicker(wp, mine)`. `closeWatchpartyLive()` — always calls `stopSportsScorePolling()` (safe on non-sport wps; no-op when handle is null).
     - **Catch-me-up sports variant:** `renderCatchupCard(wp, mine)` now branches on `wp.mode === 'game' || !!wp.sportEvent`. Sport variant renders "YOU MISSED" eyebrow + "Here's where we are." italic title + "Score: AWY X, HOM Y" + "Last 3 plays:" + 3 play descriptions (or "No scoring plays yet." when scoringPlays is empty). Movie variant preserved verbatim.
     - **DVR slider injection:** `renderWatchpartyLive` appends `renderDvrSlider(wp, mine)` to body tail when `wp.mode === 'game'` only (movie mode unchanged).
     - **Team-flair avatar badge:** `renderParticipantTimerStrip` adds `has-team-flair` class + `style="--team-color:<hex>"` to `.wp-participant-av` when participant has `teamColor` set. CSS rule `.wp-participant-av.has-team-flair` draws a 2px box-shadow border in the team color.
   - `css/app.css` +75 lines — `.sports-reaction-picker.amplified` (fixed bottom:120px centered, `--easing-spring` entrance) / `@keyframes sports-amplified-enter` / `.sports-burst-btn` (32px emoji, 44px touch target, scale 1.2 hover) + `.wp-dvr-slider` (flex, --bg-deep surface) / `.wp-dvr-label` / `.wp-dvr-input` (styled range track + 22px accent thumb for both webkit + moz) / `.wp-dvr-readout` (tabular-nums) + `.team-flair-modal` / `.team-flair-options` / `.team-flair-pick.neutral` / `.wp-participant-av.has-team-flair` (box-shadow var(--team-color, var(--accent))) + `.wp-catchup-sport-score` / `.wp-catchup-sport-label` / `.wp-catchup-sport-play` + `@media (prefers-reduced-motion: reduce)` guard clamps amplified-enter + burst transitions + score-strip flash.
   - `sw.js` — `CACHE` bumped: `couch-v27-11-05-lifecycle` → `couch-v28-11-06-sports`.

4. **`0ec62f8`** `fix(11-06): add Add-tab entry point for Game Mode picker (REFR-10)`
   - `app.html` +13 lines — new `.sports-entry` card beneath the existing legacy "Schedule a game" entry. Icon 📺 + title "Watch a game live" + subtitle "Live score · amplified reactions · DVR offset" + keyboard accessibility via `onkeydown` handler, routes to `openGamePicker()`.
   - Rule 3 auto-fix — without a UI entry point the modal would be unreachable. Plan line 846 called this out as a branching decision: add a second entry OR replace the existing one. Chose to add a second entry so the legacy sports-watchparty path stays functional (backward-compat) and the Game Mode path is a conscious opt-in.

## Requirements Closed

- **REFR-10 — Dedicated Sports Game Mode** ✅ All 6 v1 Game Mode features per RESEARCH §4 ship:
  1. Game picker (NFL/NBA/MLB/NHL) with live + upcoming games
  2. Live score strip (sticky-top, tabular-nums, LIVE indicator with accent color)
  3. Kickoff countdown + auto-transition (reuses Phase 7 scheduled → active flip; sport-flagged wps inherit the same CF behavior)
  4. Play-scoped amplified reactions (score-delta detection + 3s burst picker + haptic)
  5. Late-joiner "current score + last 3 plays" card (replaces Plan 11-05 placeholder cleanly)
  6. Team-flair avatar badges (border in runtime --team-color custom property)
- **Bonus:** Per-user DVR slider — "I'm N seconds behind" offset (0-180s step=5s), writes to both dvrOffsetMs (new canonical) and reactionDelay (Phase 7 anchor) so the existing render-filter picks it up.

## SportsDataProvider Architecture

```
SportsDataProvider (js/app.js:~7742)
├── getSchedule(leagueKey, daysAhead)
│   └── SPORTS_PROVIDER_CONFIG[leagueKey].provider === 'espn'
│       → 7 parallel fetches to site.api.espn.com/.../scoreboard?dates=YYYYMMDD
│       → parseEspnEvent (EXISTING, Phase 7 / Turn 12) normalizes each
│       → tags results with league key for downstream routing
│   └── provider === 'balldontlie' (STUB — returns [])
├── getScore(gameId, leagueKey)
│   └── sportsScoreCache[bucketKey] (15s buckets) — cache-first
│   └── ESPN summary?event=<id> endpoint — header.competitions[0]
│   └── Extracts: homeScore, awayScore, homeAbbr, awayAbbr, period, clock, state ('pre'|'in'|'post'), statusDetail
├── getPlays(gameId, leagueKey, sinceTs)
│   └── sportsPlaysCache[bucketKey] (30s buckets)
│   └── ESPN summary?event=<id> endpoint — .plays array, slice(-10)
│   └── Normalizes to {id, text, scoringPlay, period, clock, ts}
└── Error handling: all 3 methods try/catch + qnLog + graceful return (null/[])
```

**Switch-point for BALLDONTLIE activation:** single `SPORTS_PROVIDER_CONFIG` object. Setting `provider: 'balldontlie'` on any league routes all 3 methods into the stub branch. Implementing the stub requires 3 fetch calls + mapping (~3-5 hr).

## Polling Cadence & Rate-Limit Discipline

| State | Poll interval | Rationale |
|-------|---------------|-----------|
| `score.state === 'in'` (active play) | 5s | Score-delta user-perceived "immediate" threshold per RESEARCH §4 |
| `score.state === 'pre' | 'post' | 'unknown'` | 15s | Budget discipline — pre/post game score doesn't change |

Cache buckets: 100 simultaneous viewers of the same game = **1 fetch per bucket** (15s for scores, 30s for plays). ESPN documented rate limit is loose (unrestricted public use); BALLDONTLIE free tier is ~5/sec. Budget is healthy at v1 scale with the cache.

## Sports Catch-me-up Variant Integration with Plan 11-05

Plan 11-05 shipped `renderCatchupCard` with an `isSport` branch left as a placeholder passthrough (v1 fell through to the movie-mode reaction rail). **This plan replaced the placeholder cleanly:**

- The `isSport` check now branches EARLY (before the `<3 reactions` movie-mode guard) — sports late-joiners see the score card even with zero pre-join reactions because the score itself is informative context.
- Movie-mode variant preserved verbatim (same <3 guard, same rail render, same dismissCatchup window._catchupDismissed map).
- Both variants share the same card shell (`.wp-catchup-card` + `.wp-catchup-eyebrow` + `.wp-catchup-dismiss`) so Plan 11-05's CSS rules are fully reused.

## DVR Slider Integration with Phase 7 reactionDelay Anchor

Phase 7 PARTY-04 shipped per-user reaction-delay (0/5/15/30s preset chips) as spoiler-protection UX. The render-side filter at `renderReactionsFeed` already implements the correct behavior: `delayMs = (mine.reactionDelay || 0) * 1000` then `r.at <= nowMs - delayMs` for non-self reactions.

**Plan 11-06 DVR slider re-uses this anchor without modification:**

- `setDvrOffset` writes to BOTH `participants[mid].dvrOffsetMs` (new canonical field in seconds*1000) AND `participants[mid].reactionDelay` (Phase 7 field in seconds).
- Zero new render-side logic required — the Phase 7 filter picks up the slider-driven value automatically.
- Movie-mode reactionDelay chip UI (Phase 7) still works independently when outside Game Mode — the two writes are parallel, not competing.
- If a future plan wants to decouple DVR from spoiler-protection (different semantics in different modes), they can migrate `renderReactionsFeed` to read `dvrOffsetMs` when `wp.mode === 'game'` and `reactionDelay` otherwise. For v1, one-field-two-uses is simpler and proven.

## Team-flair UX Flow + Persistence

1. User opens a `mode === 'game'` watchparty via openGamePicker or banner-join.
2. `maybeShowTeamFlairPicker(wp, mine)` fires once per session per wp — skips early if `mine.teamAllegiance` is set (already picked) OR if `#team-flair-overlay` already exists in DOM (modal already open).
3. Modal shows 3 options: `<Away Team>` / `<Home Team>` / "Just here for the show" (neutral).
4. On tap: `setUserTeamFlair(wpId, allegiance, hexColor)` writes to Firestore per-participant sub-doc:
   - `participants[mid].teamAllegiance = 'away'|'home'|'neutral'`
   - `participants[mid].teamColor = <hex>` (omitted for neutral)
5. Overlay removes; next render picks up the team color.
6. `renderParticipantTimerStrip` picks up `p.teamColor` and emits `style="background:<color>;--team-color:<hex>;"` + `class="has-team-flair"` on the avatar.
7. CSS rule `.wp-participant-av.has-team-flair { box-shadow: 0 0 0 2px var(--team-color, var(--accent)); }` draws the team-color border.

**Re-prompt pattern:** team-flair is wp-scoped, not member-scoped — a family member who roots for different teams across different games gets a fresh prompt per game. Intentional.

## sw.js CACHE Bump

`couch-v27-11-05-lifecycle` → `couch-v28-11-06-sports`. SHELL array unchanged — per-wp assets (score polls, emoji renders) are never in the pre-cache set.

## Verification Matrix — DEFERRED TO HUMAN-VERIFY

Plan Task 4 (deploy + live game walkthrough) deferred per execution context: "Do NOT run `firebase deploy`. Land code-only."

Owed at human-verify time (preferably during a real live game window so score-delta detection can be observed):

| # | Check | Status |
|---|-------|--------|
| 1 | `node --check js/app.js && node --check sw.js` exit 0 | ✅ passed at commit time |
| 2 | Add-tab "Watch a game live" entry opens game picker | DEFERRED |
| 3 | Game picker shows 4 league tabs; tap NFL → loads games | DEFERRED |
| 4 | Tap game card → accent border + CTA enables | DEFERRED |
| 5 | Tap "Use this game" → wp-live-modal opens with score strip sticky-top | DEFERRED |
| 6 | (Live game) Score strip values update within 5-15s | DEFERRED |
| 7 | (Live game) Score change → strip flashes + amplified picker surfaces | DEFERRED |
| 8 | Tap burst emoji → reaction posts to feed; picker dismisses | DEFERRED |
| 9 | `wp.scoringPlays` array in Firestore grows by 1 per detected score change | DEFERRED |
| 10 | 2nd device joins after scoring plays → Catch-me-up sports card shows | DEFERRED |
| 11 | DVR slider drag → readout updates in real-time | DEFERRED |
| 12 | DVR slider release → Firestore participants[mid].dvrOffsetMs + reactionDelay update | DEFERRED |
| 13 | Team-flair prompt on first join; allegiance + color persist; avatar border appears | DEFERRED |
| 14 | Movie watchparty mode unchanged (REFR-07/08/09 still work for non-sport) | DEFERRED |
| 15 | Existing reactionDelay slider in movie mode (Phase 7) still functions | DEFERRED |
| 16 | SW version reports couch-v28-11-06-sports on installed PWA | DEFERRED |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing UI entry point for Game Mode picker**
- **Found during:** Task 3 acceptance review (after commits 1-3 landed)
- **Issue:** `openGamePicker` was defined but no HTML element called it. Plan line 846 flagged this: "If no entry-point exists, add a button on Add tab or replace existing sports entry to call openGamePicker()."
- **Fix:** Added a new `.sports-entry` card beneath the existing legacy "Schedule a game" entry at app.html:377-387. Icon 📺, title "Watch a game live", subtitle describes the Game Mode features. Routes to `openGamePicker()` with keyboard accessibility (onkeydown for Enter + Space).
- **Design decision:** Chose to ADD a second entry rather than REPLACE the existing one — legacy sports watchparty flow (`openSportsPicker` → wp with `sportEvent` but no `mode: 'game'`) stays functional for backward compatibility. Movie-style sports watchparties coexist with Game Mode watchparties; only Game Mode gets the full polling + amplified + DVR + team-flair UI.
- **Files modified:** app.html
- **Commit:** 0ec62f8

### Accepted Deviations (not fixes — explicit scope calls)

- **Kickoff countdown auto-transition:** Plan §must_haves asserts this behavior, but the actual mechanism is the existing `watchpartyTick` CF's scheduled → active flip (extended in Plan 11-05 for majority-Ready early start). Sport-flagged watchparties go through the same CF — no new CF needed. Client-side countdown renders come from the existing Plan 11-05 lobby card (reused when `wp.mode === 'game' && wp.status === 'scheduled' && within T-15min`). Verified by inspection; runtime behavior deferred to human-verify.
- **BALLDONTLIE branch:** Stubbed for future activation. Plan explicitly called this out as a swap-path (~3-5 hr work when/if ESPN denies). Accepted v1 posture per T-11-06-01.
- **Deploy:** Per execution context, no `firebase deploy`. Code-only land. Deploy steps:
  ```bash
  cp sw.js app.html /c/Users/nahde/queuenight/public/
  cp js/app.js /c/Users/nahde/queuenight/public/js/
  cp css/app.css /c/Users/nahde/queuenight/public/css/
  cd /c/Users/nahde/queuenight && firebase deploy --only hosting
  ```
  Bundles naturally with the deferred Plan 11-04 + Plan 11-05 deploy.

## Threat Model Post-Review

Plan §threat_model listed 7 threats T-11-06-01 through T-11-06-07. Shipped mitigations:

| ID | Category | Shipped | Notes |
|----|----------|---------|-------|
| T-11-06-01 | Info Disclosure — ESPN hidden API ToS-gray | accept | Per RESEARCH §4 + CONTEXT decision 3. No PII transmitted (public game IDs only). BALLDONTLIE swap-path wired for when/if ESPN denies. |
| T-11-06-02 | DoS — score polling burns rate budget | ✅ mitigate | Per-(gameId, 15s-bucket) cache means 100 concurrent viewers = 1 fetch/bucket. Adaptive 5s/15s cadence matches pre/in/post state. |
| T-11-06-03 | Tampering — fake scoringPlays writes | ✅ mitigate | scoringPlays writes via existing watchparty firestore.rules — only host or participant can write. `writeAttribution` stamps actor identity on every call. |
| T-11-06-04 | Info Disclosure — DVR offset reveals lag | accept | dvrOffsetMs is per-participant + visible to other family members. Not PII; product feature (other members understand why your reactions lag). |
| T-11-06-05 | Tampering — pick team allegiance for someone else | ✅ mitigate | `setUserTeamFlair` writes only to `participants[state.me.id]` (own entry). Client-side guard + firestore.rules per-participant scoping. |
| T-11-06-06 | Spoofing — DNS-hijacked score injection | accept | All ESPN calls go to site.api.espn.com over HTTPS (hardcoded); browser TLS validates cert. Out-of-scope network attack. |
| T-11-06-07 | Info Disclosure — viewing patterns to ESPN | accept | Same-class as TMDB usage today. No PII. Acceptable per CLAUDE.md public-by-design posture. |

## Known Stubs

**1. BALLDONTLIE branch — 3 methods stubbed.**
- Location: `SportsDataProvider.getSchedule` / `getScore` / `getPlays` — each has an ESPN branch + a fallthrough `return []` or `return null` for non-ESPN providers.
- Intent: Future activation when/if ESPN denies. SPORTS_PROVIDER_CONFIG is the single switch-point.
- This is NOT a user-facing stub — users never see "BALLDONTLIE" anywhere in the UI. It's a provider-side fallback slot that's intentionally dormant.

**All user-facing surfaces fully data-wired:**
- Game picker binds to live ESPN schedule data (no mock data).
- Score strip binds to wp.lastScore (seeded) + live score polls.
- Scoring plays card binds to wp.scoringPlays (written by handleScoringPlay at real score change time).
- DVR slider binds to mine.dvrOffsetMs + mine.reactionDelay.
- Team-flair binds to mine.teamAllegiance + mine.teamColor.

## Deferred Items — routed forward

| Item | Routed To | Why |
|------|-----------|-----|
| Deploy (hosting) | User / next session | Per execution context: no firebase deploy run by executor. Bundles with deferred Plan 11-04 + 11-05 deploy. |
| Live game end-to-end verification | Human-verify session | Requires a real live game window (ESPN scoreboard live state) + 2 devices to test late-joiner catch-me-up + cross-device DVR behavior |
| BALLDONTLIE branch activation | Future plan (post-ESPN-denial trigger) | ~3-5 hr work: fill 3 stub branches + add balldontlieKey support in SPORTS_PROVIDER_CONFIG |
| Free pick'em layer | Phase 12 per RESEARCH §4 stretch | Stretch feature outside REFR-10 v1 scope |
| Voice rooms | Phase 12 per RESEARCH §4 stretch | Explicitly out-of-scope (11-CONTEXT.md: incompatible with per-user reaction-delay moat) |
| Post-game debrief mode | Phase 12 per RESEARCH §4 stretch | Out-of-scope v1; Plan 11-05's post-session modal partially covers |
| Per-sport play schema normalization (basketball vs football plays differ) | Phase 12 | v1 uses ESPN's play.text shorthand which is consistent enough for the "Last 3 plays" display |

## Notes for Checkpoint / Future Work

1. **ESPN ToS-gray remains accepted posture** per CONTEXT decision 3. BALLDONTLIE swap-stub is the pressure-relief valve — activation is single-config-flip + 3 branch implementations.
2. **Score polling lifecycle boundaries** — `startSportsScorePolling` hooks to `openWatchpartyLive`, `stopSportsScorePolling` hooks to `closeWatchpartyLive`. `_sportsPollWpId` guard prevents stale in-flight fetches from overwriting state after a close — critical for rapid open/close cycles.
3. **Team-flair is wp-scoped, not member-scoped** — allegiance prompt fires per wp. A family member rooting for different teams across different games gets a fresh prompt per game. If this turns out to be annoying in UAT, add a member-level default in a future plan.
4. **DVR slider + reactionDelay reuse** — any future plan touching renderReactionsFeed filter logic needs to know that `reactionDelay` is dual-written (Phase 7 spoiler-protection chip + Plan 11-06 DVR slider). If the two paths ever need to diverge semantically, migrate the filter to read `dvrOffsetMs` when `wp.mode === 'game'`.
5. **Sport variant of Catch-me-up** ALWAYS renders (no <3 reactions guard) — the score card is informative even with zero reactions. Movie variant guard preserved.
6. **Score strip renders for legacy sports wps too** — not just `mode === 'game'`. Legacy `wp.sportEvent` watchparties (scheduled via `openSportsPicker`) get the read-only chrome but DO NOT get polling + amplified + DVR + team-flair (those remain gated on `mode === 'game'`).

## Threat Flags

None — no new trust boundaries introduced beyond those the plan's threat model already catalogs.

## Self-Check: PASSED

**Commits confirmed (git log):**
- `0181de1` ✓ feat(11-06): SportsDataProvider abstraction + ESPN wrappers (REFR-10)
- `c79ab78` ✓ feat(11-06): game picker modal + sports mode + live score strip (REFR-10)
- `1f03ff1` ✓ feat(11-06): score-delta polling + amplified reactions + DVR + team-flair + bump sw.js (REFR-10)
- `0ec62f8` ✓ fix(11-06): add Add-tab entry point for Game Mode picker (REFR-10)

**Modified files confirmed:**
- `js/app.js` ✓ MODIFIED (+502 net lines — SportsDataProvider, game picker handlers, score strip, polling, amplified reactions, DVR, team-flair, lifecycle wire-up, catch-me-up sport variant, team-flair avatar classes)
- `app.html` ✓ MODIFIED (+34 lines — game picker modal + Add-tab entry)
- `css/app.css` ✓ MODIFIED (+131 lines — game picker + score strip + amplified picker + DVR slider + team-flair + sport catch-me-up + reduced-motion guard)
- `sw.js` ✓ MODIFIED (v27 → v28)

**Verification gates (all PASS):**
- `node --check js/app.js` OK ✓
- `node --check sw.js` OK ✓
- `grep -c "const SportsDataProvider" js/app.js` = 1 ✓
- `grep -c "SPORTS_PROVIDER_CONFIG" js/app.js` = 4 ✓
- `grep -c "sportsScoreCache" js/app.js` = 3 ✓, `sportsPlaysCache` = 3 ✓
- `grep -c "site.api.espn.com" js/app.js` = 4 ✓ (existing loadSportsGames + SportsDataProvider getScore + getPlays + jsdoc)
- `grep -c "async getSchedule\|async getScore\|async getPlays" js/app.js` = 3 ✓
- `grep -c 'id="game-picker-modal-bg"' app.html` = 1 ✓
- `grep -c "function renderSportsScoreStrip" js/app.js` = 1 ✓
- `grep -c "wp.mode === 'game'" js/app.js` = 3 ✓
- `grep -c "Tonight's game" app.html` = 1 ✓, `Use this game` = 1 ✓
- `grep -c "startSportsScorePolling" js/app.js` = 3 ✓, `stopSportsScorePolling` = 3 ✓, `handleScoringPlay` = 3 ✓, `updateSportsScoreStrip` = 4 ✓, `showAmplifiedReactionPicker` = 2 ✓, `postBurstReaction` = 2 ✓, `renderDvrSlider` = 2 ✓, `setDvrOffset` = 2 ✓, `setUserTeamFlair` = 4 ✓
- `grep -c "scoringPlays" js/app.js` = 4 ✓, `lastScore` = 5 ✓
- `grep -c "Last 3 plays\|Here's where we are" js/app.js` = 3 ✓
- `grep -c "dvrOffsetMs" js/app.js` = 2 ✓, `teamColor\|teamAllegiance` = 8 ✓
- `grep -c "Who are you rooting for" js/app.js` = 1 ✓
- `grep -c ".sports-reaction-picker" css/app.css` = 2 ✓, `.wp-dvr-slider` = 1 ✓, `team-flair` = 5 ✓, `.wp-catchup-sport-score` = 1 ✓
- `grep -c "couch-v28-11-06-sports" sw.js` = 1 ✓
- Regression preserved: `if (preStart && !inLobbyWindow)` = 1 ✓ (BLOCKER 2 mutex), `reactionDelay` = 13 ✓ (Phase 7 filter + Plan 11-06 DVR write both referenced)

## CHECKPOINT REACHED

Plan code-complete. Task 4 (deploy + live-game Game Mode walkthrough) is a blocking human-verify checkpoint owned by the user. Outstanding human-verify items deferred:

- Deploy hosting (bundles with deferred Plan 11-04 + 11-05 deploy)
- Live game walkthrough: game picker → score strip → score-delta flash → amplified picker → Firestore scoringPlays growth → late-joiner Catch-me-up sports variant → DVR slider cross-device → team-flair prompt + color border
- Regression verification: movie watchparty mode unchanged (Phase 7 + Plan 11-05 paths intact)

Post-human-verify: mark REFR-10 validated + ROADMAP Phase 11 progress 7/8.
