---
phase: 28-social-pickem-leaderboards
type: context
created: 2026-05-02
updated: 2026-05-04
status: paused-pending-api-sports-spike (D-17 superseded — see D-17 update 2026-05-04)
authored_via: /gsd-discuss-phase 28
gray_areas_discussed: 4
decisions_locked: 17
---

# Phase 28 — Social pick'em + leaderboards — CONTEXT

## Domain boundary

Add a pre-game prediction surface (winner-only picks across all 16 leagues from `js/sports-feed.js`) on top of the existing sports watchparty primitive, plus a per-family per-league per-season leaderboard that tracks pick accuracy. The pick'em data model is the single source of truth; the leaderboard is a derived view of it (Phase 28 explicitly merges old Phase 28 + 29 into one deploy because of this — see `seeds/v2-watchparty-sports-milestone.md`).

**In scope:** Standalone "Pick'em" tab listing upcoming games per league, winner-only picker (with polymorphic `pickType` discriminator handling team-sport / soccer-with-draw / F1 podium variants — UFC method-of-victory **DROPPED for v1** per D-17 update 2 2026-05-04), per-family `families/{code}/picks/{pickId}` collection, settlement via new scheduled `gameResultsTick` CF that polls TheSportsDB for finals + Jolpica for F1, per-family per-league per-season leaderboard surface with hard reset + history snapshot, push-notification opt-in for pick reminders + result alerts, real-time pick visibility within the family, soft pre-fill from `participants[mid].teamAllegiance`.

**Out of scope (explicitly):**
- Spread picks, exact-score picks, confidence-pool scoring (deferred to Phase 28.x or v3)
- Cross-family / public leaderboards (PROJECT.md Out-of-Scope: "no public discovery / cross-family social feed")
- Guest picks (Phase 27 guests stay RSVP-signal-only per `27-CONTEXT.md` D-01)
- Backfill picks for past games on mid-season join (cheating vector)
- Live-leaderboard sub-minute updates (would require TheSportsDB Patreon $14/yr — deferred per D-01)
- Manual settlement / score-override admin UI (settlement is fully automated via `gameResultsTick` against TheSportsDB final scores)
- Spread / Vegas-line auto-fetching (no provider; out of scope until v3)
- Monetization / paid leagues / premium leaderboards (CLAUDE.md "Don't start monetization / billing / plan-tier work")
- **UFC pickType (`ufc_winner_method`) — DROPPED for v1** per D-17 update 2 2026-05-04. No free UFC API exists with structured roster + settlement at zero cost; paid options ($108-120/yr) not justified for current scope. Deferred to Phase 28.x triggered by user demand, project budget, or emergence of a free UFC API.

## Carrying forward (already shipped)

- **`js/sports-feed.js`** (Phase 22) — exports `LEAGUES` (16-league map: nba/nfl/mlb/nhl/wnba/ncaaf/ncaab/epl/laliga/bundesliga/seriea/ligue1/ucl/mls/f1/ufc), `fetchSchedule(leagueKey, daysAhead)`, `fetchScore(gameId, leagueKey)`, `normalizeTsdEvent(ev, leagueKey)` returning canonical `Game` shape. **Note:** `normalizeTsdEvent` does NOT currently surface `strSeason` — small additive change required at planning time (see Open question #1).
- **`SportsDataProvider`** (`js/app.js` ~line 10544) — `getSchedule` / `getScore` / `getPlays` interface delegating to sports-feed.js. `getPlays` returns `[]` until TheSportsDB Patreon upgrade — irrelevant for winner-only picks (final score is enough).
- **Game Mode pipeline** (Phase 11/REFR-10 + Phase 23 widening) — `wp.mode === 'game'` is canonical; both `openGamePicker` (canonical) and `scheduleSportsWatchparty` (legacy) produce `wp.sportEvent: { id, leagueKey, awayTeam, homeTeam, awayAbbrev, homeAbbrev, leagueEmoji, ... }`. Phase 28 reads `wp.sportEvent.id` to link picks back to watchparties (denormalized for the "view your pick" surface inside the wp modal — see D-04 specifics below).
- **`participants[mid].teamAllegiance + teamColor`** (Phase 11) — per-member team commitment within a wp. Phase 28 uses this as the soft-pre-fill source for picks (see D-09).
- **3-map notification stack convention** (Phase 14 D-12 lockstep) — `DEFAULT_NOTIFICATION_PREFS` (client `js/app.js:330`) + `NOTIFICATION_DEFAULTS` (server `queuenight/functions/index.js`) + `NOTIFICATION_EVENT_LABELS` (UI copy `js/app.js:377`). Phase 28 extends all three with `pickReminder` + `pickResults` + `pickemSeasonReset` event keys.
- **Scheduled-CF tick pattern** — `watchpartyTick` (every 5 min, `queuenight/functions/index.js:931`) + `providerRefreshTick` (daily). Phase 28 mirrors this with new `gameResultsTick` (every 5 min during active league windows; settles picks when `score.state === 'post'` for any game with pending picks).
- **Per-family Firestore nesting** — Everything under `families/{code}/...`. Phase 28 adds `families/{code}/picks/{pickId}` and `families/{code}/leaderboards/{leagueKey}/{strSeason}`.
- **Single-file architecture + ES module split** (Phase 22 precedent) — Pure helpers (e.g. `scorePick(pick, finalGame)`, `slateOf(games, leagueKey, dayWindow)`, `latestGameInSlate(slate)`) belong in a new `js/pickem.js` module (~150-200 lines projected). UI logic stays in `js/app.js`.
- **Smoke-contract pattern** — Each phase ships one `scripts/smoke-pickem.cjs` (Phase 28's 11th contract) wired into `scripts/deploy.sh §2.5` + `package.json` smoke aggregate. Floor meta-assertion ≥13 fails the deploy gate when total < 13 (mirrors Phase 26 / 27).
- **Cross-repo deploy ritual** — `firebase deploy --only functions` from `~/queuenight` first → `bash scripts/deploy.sh <short-tag>` from couch second. Phase 28 is cross-repo because of `gameResultsTick` CF.

## Decisions

### D-01 — League scope at v2 launch = 15 of 16 leagues (UFC dropped per D-17 update 2)

15 of 16 leagues from `js/sports-feed.js` LEAGUES catalog get pick'em at v2 launch: nba/nfl/mlb/nhl/wnba/ncaaf/ncaab/epl/laliga/bundesliga/seriea/ligue1/ucl/mls/f1. **UFC dropped** per D-17 update 2 (2026-05-04) — no free UFC API exists with structured roster + settlement; paid options not justified for v1. UFC stays in `js/sports-feed.js` LEAGUES catalog for the existing watchparty mode (Phase 22) but is excluded from pickem surface; Pick'em tab + picker UI must filter `LEAGUES` to exclude `'ufc'` at render time.

**Always-on:** Whenever a `wp.mode === 'game'` watchparty exists OR the standalone Pick'em tab is opened, the pick'em surface is available. **NO** family-level or per-member toggle (would add settings UI without a clear win — families uninterested in pick'em simply don't open the tab).

**Free TheSportsDB key (`'1'`):** v1 ships on the free tier (5-min schedule cache, 15-sec score bucket). Pick settlement runs async via `gameResultsTick` CF — latency between game-end and leaderboard-update is irrelevant for a season-long board. Patreon $14/yr upgrade stays a single-line bump in `js/sports-feed.js` if user demand for sub-minute live-leaderboard emerges. Doesn't block ship.

> **Update 2026-05-02 (post Wave 0):** Free-tier key `'1'` was Premium-locked silently — Plan 28-01 bumped to key `'3'` (verified working). See 28-01-SUMMARY.md.

### D-17 — F1/UFC roster source = TheSportsDB Patreon spike (PENDING — blocks Wave 2)

Wave 0 verification (28-01) confirmed the free TheSportsDB tier exposes EPL `intRound` + team names + scores cleanly, but does **NOT** surface F1 driver names or UFC fighter names in structured fields. Without those, `f1_podium` and `ufc_winner_method` pickTypes cannot auto-settle and have no roster to populate the picker UI.

**Decision:** Spike the TheSportsDB Patreon ($14/yr) endpoints for F1 driver data + UFC fighter data before re-planning Waves 2-4. If Patreon exposes the rosters cleanly, ship all 4 pickTypes per the original D-02 lock. If Patreon doesn't expose them either, fall back to the "defer F1/UFC to Phase 28.x" path.

**Status:** Pending user execution of the spike on/after 2026-05-04 (user away from computer until then). Phase 28 execution paused after Plan 28-02. Plans 28-03 / 28-04 / 28-05 / 28-06 remain incomplete until D-17 resolves.

**Spike scope (when user is back):**
1. Sign up for TheSportsDB Patreon ($14/yr) → obtain Patreon API key
2. `curl` test against the relevant endpoints to confirm:
   - F1: race entry list with structured `Driver` field per position (or any structured driver name source)
   - UFC: event card with structured `Fighter` field per bout (winner + loser names)
3. If both confirmed: update `js/sports-feed.js` `TSD_API_KEY` to the Patreon key, then resume `/gsd-execute-phase 28` from Wave 2.
4. If either fails: drop F1/UFC from v1 scope, replan 28-03 / 28-05 to skip those pickTypes, defer to Phase 28.x.

**Why pause now rather than ship 14 leagues:** Avoids the wasted work of writing CF settlement + UI roster code twice (once for "team-only", once again when Patreon validates). The 2-day delay is cheaper than the rework.

> **Update 2026-05-04 (D-17 superseded — see new spike scope below):**
>
> User attempted Patreon signup, surfaced two facts that obsolete the original D-17 framing:
>
> 1. **Pricing was wrong.** Real cost is **$9/month** (= $108/yr), not $14/yr. 7.7× higher. Significantly changes the cost-benefit for a personal-project family app where CLAUDE.md explicitly says "Don't start monetization / billing / plan-tier work" — there is no revenue path to amortize $108/yr.
> 2. **TheSportsDB-or-nothing was a false dichotomy.** Looking outside `js/sports-feed.js`'s existing TheSportsDB dependency, two free alternatives cover the F1 + UFC roster gap completely:
>
>    - **F1 → Jolpica** (`https://api.jolpi.ca/ergast/f1/{year}/{round}/drivers/`) — open-source successor to the deprecated Ergast API; backwards-compatible endpoints; free, no key required, no published rate limit. Verified 2026-05-04 against `/2026/1/drivers/` returning all 22 drivers with structured `givenName` + `familyName` + `code` (3-letter abbrev) + `permanentNumber` + `nationality` fields. **Roster shape is exactly what `f1_podium` pickType needs.**
>    - **UFC → API-Sports MMA free tier** (`https://v1.mma.api-sports.io/`) — 100 requests/day, never expires, no credit card; paid plans from $10/mo if scaling needed; transparent pricing (unlike SportsDataIO MMA, which is opaque on post-trial terms — disqualified for a free-tier dependency). Estimated real usage: ~30 req/month (1 fighter-roster fetch + 1 result fetch per UFC event × ~15 events/month). 100/day = 3,000/month → **<1% quota utilization**; effectively unlimited for our scope.
>
> **New decision (locked 2026-05-04):** Adopt Option A — Jolpica for F1 + API-Sports MMA free tier for UFC. Total cost **$0/yr**. All 4 pickTypes from D-02 ship as originally scoped. TheSportsDB Patreon path is **abandoned** (free F1 alternative + cheaper transparent UFC alternative dominate the original Patreon path on every dimension: cost, transparency, time-to-key).
>
> **Failure-mode analysis:** If either Jolpica or API-Sports has an outage / breaking change / key revocation:
> - Jolpica down → F1 picker shows "Roster unavailable for this race" empty state; other 3 pickTypes unaffected.
> - API-Sports down or quota exceeded → UFC picker shows same empty state; other 3 pickTypes unaffected.
> - Settlement: `gameResultsTick` already has the per-pickType branching (D-02), so a missing roster fetch fails-soft per pickType.
>
> **Revised spike scope (when user is ready):**
> 1. ~~Sign up for TheSportsDB Patreon~~ → **DROPPED**.
> 2. Sign up for API-Sports free tier at `https://api-sports.io/` (no credit card; daily limit 100 req); obtain `x-apisports-key` header value.
> 3. `curl` test against API-Sports MMA endpoints to confirm:
>    - `GET /fights?event={eventId}` (or equivalent) — returns structured `Fighter` (winner + loser names) per bout
>    - `GET /events?league=ufc&date={today}` — returns upcoming UFC event list with `eventId`
>    - `GET /fights?event={eventId}` for a settled past event — returns winner + method (`KO|SUB|DEC`)
> 4. Jolpica F1 endpoints already verified (2026-05-04 via direct curl) — no additional test needed.
> 5. If API-Sports curl tests pass: resume `/gsd-execute-phase 28` from Wave 2; Plans 28-03..06 may need minor edits to (a) read F1 roster from Jolpica instead of TheSportsDB Patreon, (b) read UFC roster from API-Sports MMA instead of TheSportsDB Patreon, (c) add `js/sports-feed.js` `fetchF1Roster(round)` + `fetchUfcEvent(eventId)` functions alongside existing TheSportsDB calls.
> 6. If API-Sports MMA curl tests fail (unlikely given published spec): drop UFC only (NOT F1), `/gsd-plan-phase 28` to regenerate Plans 28-03..06 against Jolpica-F1 + 14-team-leagues scope. F1 still ships in v1 because Jolpica is verified working.
>
> **Original D-17 above preserved as historical record per CLAUDE.md "phase slot history" convention. Do not act on the original spike scope — it is superseded.**

> **Update 2 — 2026-05-04 (post-spike, Option A FALSIFIED):**
>
> API-Sports MMA spike completed against API key `5e9ded6ee71cdd0c4bf022cb243df16a` (free tier, 100/day). All 5 curl tests run; results below:
>
> | Endpoint | Result |
> |---|---|
> | `/status` | ✅ Account confirmed Free, 100/day quota, expires 2027-05-05 |
> | `/categories` | ✅ Returns 18 weight classes |
> | `/fighters?search=jones` | ✅ 9 results with full bio (no date restriction) |
> | `/fights?date=2026-05-04..06` | ⚠️ 0 results (no UFC events in 3-day window) |
> | `/fights?date=2024-04-13` (UFC 300) | ❌ "Free plans do not have access to this date, try from 2026-05-04 to 2026-05-06" |
> | `/fights?season=2026` | ❌ "Free plans do not have access to this season, try from 2022 to 2024" |
> | `/fights?fighter=2338` | ❌ Requires `date` or `season` → falls into the same trap |
>
> **Critical gating mechanism missed in Option A planning:** API-Sports' free tier restricts `/fights` queries to a 3-day rolling window for current data AND historical seasons 2022-2024 only. The "100 requests/day" headline rate limit is NOT the binding constraint — the binding constraint is the **data-window restriction** that makes the free tier unusable for our use case (need 7+ day schedule lookahead AND 2025/2026 settlement). To get useful UFC data on API-Sports requires the paid plan ($10/mo = $120/yr — actually MORE expensive than the rejected TheSportsDB Patreon $108/yr).
>
> **Lesson for future spikes:** Always test free tiers with both a near-term AND a far-term date before trusting. "Unlimited free trial" usually means unlimited requests within a sharply scoped data window.
>
> **Final decision (locked 2026-05-04, supersedes both prior D-17 versions): Option B — drop UFC for v1, ship F1 via Jolpica + 14 team-leagues.**
>
> Cost: **$0/yr**. Scope: 3 of 4 originally-locked pickTypes (`team_winner`, `team_winner_or_draw`, `f1_podium`). UFC moves to a future Phase 28.x triggered by (a) actual user demand for UFC picks, (b) project budget materializing, or (c) a free UFC API emerging (none currently exists with structured roster + settlement at zero cost).
>
> **Rationale for not paying $108/yr for UFC:**
> - Personal-project family app with no monetization path (CLAUDE.md "Don't start monetization / billing / plan-tier work")
> - 3 of 4 pickTypes covers all 7 US team sports + 7 soccer leagues + F1 — strong v1 surface
> - Phase 28.x can add UFC later without invalidating Phase 28 work (UFC adds a 4th pickType branch + a roster fetch function; existing 3 branches unchanged)
> - The $108/yr "bonus features" of TheSportsDB Patreon (live scoreboards, video highlights) are not in any v1 requirement
>
> **Replan trigger:** Plans 28-03 / 28-04 / 28-05 / 28-06 (paused since 2026-05-02) need regeneration via `/gsd-plan-phase 28` against the new 3-pickType + Jolpica-F1 scope. D-02 / D-01 / line-18 in-scope statement / D-05 slate notes have all been updated below to reflect the dropped UFC.
>
> **Resume signal:** When user is ready to ship Phase 28: `/gsd-plan-phase 28` (replans 03-06) → `/gsd-execute-phase 28` (resumes execution from Wave 2).

### D-02 — Polymorphic pick schema with `pickType` discriminator

Each pick document stamps a `pickType` discriminator that drives validator UI + settlement logic per league family:

```js
families/{code}/picks/{pickId} = {
  pickId,                      // random URL-safe base64 (mirrors guestId convention from Phase 27)
  memberId,                    // pick owner (from members/{mid}.id)
  gameId,                      // wp.sportEvent.id (TheSportsDB idEvent)
  leagueKey,                   // 'nba' | 'nfl' | ...
  strSeason,                   // copied from game at submit time (e.g. '2025-2026', '2026') — see Open question #1
  pickType,                    // 'team_winner' | 'team_winner_or_draw' | 'f1_podium' (UFC dropped per D-17 update 2)
  selection,                   // shape varies by pickType (see below)
  tiebreakerTotal: null,       // populated ONLY on the designated tiebreaker game per slate (D-05)
  submittedAt,                 // serverTimestamp — used for engagement tracking, NOT for tiebreaker (D-05)
  gameStartTime,               // denormalized from wp.sportEvent.startTime; used by Firestore rules for lock check (D-04)
  state: 'pending'|'settled'|'auto_zeroed',
  pointsAwarded: 0,            // set at settlement (1 if correct, 0 otherwise — D-03)
  settledAt: null              // set when gameResultsTick processes this pick
}
```

**Selection shapes per pickType:**
- `team_winner` (NBA / NFL / MLB / NHL / WNBA / NCAAF / NCAAB) — `selection: { winningTeam: 'home' | 'away' }`
- `team_winner_or_draw` (EPL / La Liga / Bundesliga / Serie A / Ligue 1 / UCL / MLS) — `selection: { result: 'home' | 'away' | 'draw' }`
- `f1_podium` (Formula 1) — `selection: { p1, p2, p3 }` where each is a Jolpica driver name in `givenName + " " + familyName` form (auto-supplied from `https://api.jolpi.ca/ergast/f1/{year}/{round}/drivers/` race entry list per D-17 update 2)
- ~~`ufc_winner_method` (UFC)~~ — **DROPPED for v1** per D-17 update 2 (2026-05-04). UFC pickType deferred to Phase 28.x.

**Settlement logic** (`gameResultsTick` CF, polls `feedFetchScore` (TheSportsDB) for team/soccer leagues + Jolpica for F1 podium until `score.state === 'post'`):
- `team_winner`: `winningTeam matches finalScore.winningTeam` → 1 pt
- `team_winner_or_draw`: `result matches finalScore.result` (with explicit 'draw' branch) → 1 pt
- `f1_podium`: ALL THREE positions correct → 1 pt (settled against Jolpica `https://api.jolpi.ca/ergast/f1/{year}/{round}/results/` `Results[0..2].Driver`; single-position-correct also = 0 pt; full-podium-correct could earn a bonus in v3 but stays 1pt for v1 per D-03)
- ~~`ufc_winner_method`~~ — **DROPPED for v1**.

### D-03 — Scoring = 1 point per correct pick, flat across all pick types

Flat 1-point scoring keeps the leaderboard mental model simple ("Mom is 32-19 this NFL season"). All pick types — even harder ones (F1 full-podium, UFC winner+method) — earn the same 1 pt. Rewards engagement over expertise; matches the family-ritual brand voice.

**Leaderboard math:** `families/{code}/leaderboards/{leagueKey}/{strSeason}` doc structure:
```js
{
  leagueKey,
  strSeason,
  members: {
    [memberId]: {
      pointsTotal,                 // sum of pointsAwarded across all settled picks
      picksTotal,                  // count of all picks (any state)
      picksSettled,                // count of state='settled' (correct OR incorrect — auto_zeroed picks NOT counted in picksTotal but tracked separately)
      tiebreakerDeltaTotal,        // sum of |tiebreakerTotal - actualTotal| across designated tiebreaker games (lower = better; only computed on settled tiebreaker picks)
      tiebreakerCount,             // count of tiebreaker-game picks settled
      lastPickAt                   // most recent pick submission (informational; NOT a tiebreaker)
    }
  },
  updatedAt
}
```

`gameResultsTick` updates this doc transactionally on every settled pick. Leaderboard render is a single doc-read per league/season (cheap).

### D-04 — Pick lock at `game.startTime` enforced via Firestore rules

Picks lock at `game.startTime` (the kickoff time from `wp.sportEvent.startTime` / TheSportsDB `strTimestamp`). Lock enforced in `firestore.rules` on `families/{code}/picks/{pickId}` writes:

```
allow create, update: if request.time < resource.data.gameStartTime
                      && request.auth.uid == /* member uid resolution */;
```

`gameStartTime` is denormalized onto every pick doc at create time so the rule has the data without a cross-doc read. Once `request.time >= gameStartTime`, the rule rejects writes and the picker UI surfaces a "Picks closed" state with a disabled tap target.

**No scheduled CF needed for lock.** Auto-zeros happen at the next `gameResultsTick` pass — picks with `state: 'pending'` whose `gameStartTime` has passed AND whose game has settled get flipped to `state: 'auto_zeroed'` with `pointsAwarded: 0`.

### D-05 — Tiebreaker = closest-to-total on auto-designated tiebreaker game per slate

Picks stay winner-only for ALL games. ONE designated tiebreaker game per slate (per league, per day-window) gets ONE extra numeric input on its picker card: "Predict total points (tiebreaker only)". Stored as `pick.tiebreakerTotal: number | null` populated only on the designated game.

**Designation rule (auto, no config):** The chronologically-latest game in each slate is the tiebreaker game. Implemented via a pure `latestGameInSlate(slate)` helper in `js/pickem.js` — returns the `Game` with the maximum `startTime` from the slate's game list.

**Slate definition per league** (researcher to verify — see Open question #2):
- NFL: All games in a single calendar day (regional + Sunday Night + Monday Night)
- NBA / WNBA / NHL: All games in a single calendar day
- MLB: All games in a single calendar day
- NCAAF: All games in a single calendar day (typical Saturday slate)
- NCAAB: All games in a single calendar day
- Soccer (EPL / La Liga / Bundesliga / Serie A / Ligue 1 / MLS / UCL): All games in a single matchday (TheSportsDB `intRound` field; UCL by `strStage`)
- F1: A race weekend (one race; tiebreaker total = sum of P1+P2+P3 finishing positions reversed-rank?)
- UFC: An event card (one main event; tiebreaker total = total round count of the event?)

**Tiebreaker arithmetic at season end:** For each member with a tied `pointsTotal`, compute `avgTiebreakerDelta = tiebreakerDeltaTotal / max(1, tiebreakerCount)`. Lowest delta wins. If still tied (delta also equal), ties stay ties (T-1st, T-2nd) — no further tiebreaker.

### D-06 — No-pick handling = push reminder at T-15min, then auto-zero

For any pending pick window where the member hasn't picked at T-15min before `game.startTime`, a `pickReminder` push fires (via existing push fan-out path; new event added to all three notification maps). At lock (`game.startTime` per D-04), missed picks auto-zero (`state: 'auto_zeroed', pointsAwarded: 0`) — counted in `picksTotal` but flagged separately in the leaderboard so families can see "Mom: 32-19 in submitted picks, 6 missed".

**Notification copy** (Phase 14 D-12 friendly-voice convention):
- `pickReminder`: label "Game starting soon — make your pick", hint "Heads-up your pick'em deadline is in 15 minutes."
- `pickResults`: label "Pick'em results", hint "When games you picked finish."
- `pickemSeasonReset`: label "Pick'em season reset", hint "When your league's season turns over."

All three default ON in `DEFAULT_NOTIFICATION_PREFS` per RESEARCH §5 convention (fire only when user has actively engaged — picking IS active engagement).

### D-07 — Surface entry = standalone "Pick'em" tab

New top-nav tab "Pick'em" (or sub-surface in Tonight tab — researcher picks per the existing nav skeleton). Surface lists upcoming games for all 16 leagues, lets family pick without scheduling a watchparty (the realistic case: family wants to pick NFL Sunday games but isn't sitting down for all of them).

**Watchparty integration:** When a `wp.mode === 'game'` watchparty exists, the live wp modal also surfaces "Your pick: Lakers • Mom picked Bucks • Dad picked Lakers" inline as a small chrome row inside the existing live-modal layout — non-modal, doesn't block the wp UX. Read-only pre-tip-off; disappears once locked.

**Picks live in `families/{code}/picks/{pickId}`** (D-02 schema) — NOT as `wp.picks[]` array on the wp doc. Cross-wp leaderboard query is the primary access pattern; per-family scoped collection is the right shape.

### D-08 — Who picks = family members only

Active family members (with an `m.id` and an authenticated uid) write picks. **Phase 27 guests do NOT pick** — guest picks would require persistent identity (guests have only a per-token `guestId`) and would dilute the family-scoped leaderboard with one-off contributors. Cleanest privacy + leaderboard model.

**Kid-mode interaction:** Members under the family's kid-mode tier cap (Phase 19 KID-19-* infrastructure) can submit their own picks normally. Pick'em is independent of content gating — picking is a signal, not media consumption. If demand emerges for "parent picks on behalf of kid" pattern (mirroring Phase 14 parent-approval), defer to Phase 28.x.

### D-09 — Soft pre-fill from `participants[mid].teamAllegiance`

If the member committed to one of the teams in this game via Phase 11's team-allegiance picker, the picker pre-selects that team as their winner pick with an italic-serif sub-line in the BRAND voice:

```
Lakers — your pick from your team commitment.
Tap to change.
```

**Honors the BRAND voice** (Fraunces / Instrument Serif / italic for moments of warmth). Friendly, low-coercion. Member can override with one tap. Pre-fill applies ONLY when `teamAllegiance` is set AND the team is one of the two teams in this game (otherwise picker starts empty).

**For non-team pickTypes** (`f1_podium` only — `ufc_winner_method` dropped per D-17 update 2): no pre-fill (`teamAllegiance` is team-flavored; doesn't map). Picker starts empty.

### D-10 — Pick visibility = visible to family in real-time (no sealed-bid)

The moment a member submits a pick, it's visible to all other family members via a Firestore `onSnapshot` listener on the `families/{code}/picks/` collection scoped to the current slate. Drives the "social" part of social pick'em — the whole point is "your kid picked Chiefs but you picked 49ers, who's right?" BRAND already optimizes for shared family decisions; sealed-bid would contradict that posture.

Implementation: Pick'em tab subscribes to picks for the current visible slate; the live-wp inline pick row subscribes to picks scoped to `wp.sportEvent.id`. Listener tear-down on close (mirrors Phase 26 replay clock teardown pattern).

### D-11 — Season tagging = TheSportsDB `strSeason` field

Each pick stamps `strSeason` (copied from the game's `ev.strSeason` at submit time) as the season identifier. Leaderboard groups by `(leagueKey, strSeason)`. Auto-correct across calendar boundaries (EPL Aug-May → "2025-2026"; F1 Mar-Dec → "2026"; NFL Sep-Feb → "2026"). Single source of truth; zero family config.

**Open question #1 below covers the small `js/sports-feed.js` change required to carry `strSeason` through `normalizeTsdEvent`.

### D-12 — Season boundary = hard reset, snapshot to history

When a new season starts (detected via `strSeason` changing on incoming games for that league), a one-shot CF (or `gameResultsTick` branch) snapshots the current `families/{code}/leaderboards/{leagueKey}/{currentSeason}` doc to a frozen-record sub-doc (it's already keyed by `strSeason` per D-03 — so "snapshot" really means stop-writing-to-this-doc + start-writing-to-the-next-one). The live leaderboard for that league becomes the new doc keyed by the new `strSeason`.

**Browse history:** Pick'em tab → tap a league → "Past seasons" link → shows list of frozen `{strSeason}` docs ranked by season label descending. Read-only.

Clean mental model. No "reset" event for the family to acknowledge — it just happens at the natural season turnover.

### D-13 — Mid-season-join = forward-only, start at 0/0

Family enabling pick'em mid-season starts with 0 picks / 0 wins from the moment they make their first pick. Past games of the current season are simply not in their record. Clean; no cheating vector. Leaderboard surface can render a small "Joined Week 8 of 17" context line if useful (planner discretion).

Past-game backfill is explicitly excluded — would either be a cheating vector (look up result, then "predict") or require auto-zeroing past games (which produces the same 0/0 as forward-only with extra UI).

### D-14 — Onboarding = zero-config

Pick'em starts working the moment a family member submits their first pick on the standalone Pick'em tab. **No settings flow, no setup modal, no first-visit welcome.** Defaults are baked in:
- All 16 leagues enabled (D-01)
- Hard reset per season with snapshot to history (D-12)
- Auto-pick latest game in slate as tiebreaker (D-05)
- All three pick'em push events default ON (D-06)

If user demand emerges for advanced configuration (per-league enable, custom tiebreaker pattern, push prefs), defer to a Phase 28.x settings panel. Honors the "minimum ritual friction" brand voice.

### D-15 — `js/pickem.js` ES module for pure helpers

Mirroring the Phase 22 `js/sports-feed.js` precedent, pure helpers belong in a new `js/pickem.js` module (~150-200 lines projected). Suggested exports (planner finalizes):
- `slateOf(games, leagueKey, dayWindow)` — group games into a slate per league's slate-definition
- `latestGameInSlate(slate)` — return the chronologically-last game (tiebreaker designation per D-05)
- `scorePick(pick, finalGame)` — return points awarded (1 or 0) for a settled pick
- `validatePickSelection(pick, game)` — schema validator per `pickType` (used at write-time on rsvpSubmit-style CF + at render-time)
- `summarizeMemberSeason(picks)` — aggregate picks → leaderboard member row
- Export constants: `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS = 15 * 60 * 1000`

UI logic (renderPickemTab, renderPicker, renderLeaderboard) stays in `js/app.js`.

### D-16 — `gameResultsTick` scheduled CF settles picks asynchronously

New `gameResultsTick` CF (every 5 min during active league windows; mirrors `watchpartyTick` pattern from `queuenight/functions/index.js:931`) iterates families with pending picks, polls `feedFetchScore(gameId, leagueKey)` for any game whose `gameStartTime` has passed, settles picks once `score.state === 'post'`, updates the leaderboard doc transactionally, fires `pickResults` push to picking members.

**Idempotency:** `pick.state === 'settled'` short-circuits (no double-scoring). `gameResultsTick` writes are wrapped in `db.runTransaction` for atomic leaderboard updates (mirrors Phase 27 `rsvpSubmit` transactional pattern).

**Scheduling cost:** 5-min cadence × ~10 active leagues × ~2 active families (today) = trivial Firestore cost. Scales linearly with families; will need a per-league "active window" gate (e.g. NFL only checks Thursday-Monday) before family count reaches ~100 to keep CF execution time low.

## Specifics

- **Picks are one-shot** until the first edit — once submitted, member can edit until `game.startTime` (D-04 lock applies to UPDATEs too). Edits overwrite `pick.selection` in place; `submittedAt` is preserved as the original-submission timestamp; an internal `editedAt` field tracks the last edit. No edit-history audit (out of scope for v1; can be added if cheating concern emerges).
- **Pick-row sort order in the picker** is by `game.startTime` ascending (next game first). Locked games render at the bottom in a "Locked games" collapsed section showing each member's pick + the result if settled.
- **Tiebreaker game indicator** is a small italic "(tiebreaker)" annotation on the picker card next to the game name, plus the inline numeric input. Locked tiebreaker games show "(tiebreaker — your guess: 47, actual: 52, off by 5)" once settled.
- **Inline wp picks display** when a watchparty exists: small chrome row inside the live-wp modal showing "Your pick: Lakers • Mom: Bucks • Dad: Lakers" (read-only). Disappears at lock. Updates real-time via D-10 listener.
- **Leaderboard surface** ranks by `pointsTotal` desc, ties broken by `avgTiebreakerDelta` asc (D-05). Each row shows: member avatar + name + `{pointsTotal} pts ({picksSettled} of {picksTotal} settled, {missedCount} missed)`. The "missed" count is `picksTotal - picksSettled` — gives families visibility into engagement gaps.
- **Past-seasons archive view** (D-12) is a flat list of frozen leaderboard docs sorted by `strSeason` desc. Each row: "NFL 2025 — Mom 152-89, Dad 144-97, Kid 38-17". Tap → opens the frozen leaderboard doc in read-only mode. No re-render of past picks (out of scope).
- **`pickReminder` push fan-out** (D-06) is fired by a small extension to `gameResultsTick` (or a sibling 5-min CF `pickReminderTick`) that scans for `(memberId, gameId)` pairs where `gameStartTime` is in `[T-16min, T-14min]` window AND no pick exists. Idempotency flag: `picks_reminders/{leagueKey}_{gameId}_{memberId}` doc with `sentAt` timestamp prevents double-firing across CF retries.
- **Service worker CACHE bump** at deploy: `couch-v40-pickem` (next in sequence after `couch-v39-guest-rsvp`).

## Claude's Discretion

- **Picker card layout** — exact field positions on small screens (mobile-portrait), iconography for pickType variants, hover states. Planner / UI-spec phase finalizes.
- **Pick'em tab nav placement** — top-nav vs sub-surface in Tonight tab vs sub-surface in Watchparty tab. Researcher checks the existing app.html tab structure and picks per the navigation skeleton's affordances. Constraint: Pick'em should be discoverable without burying it 3 taps deep.
- **Empty state copy** for "No picks made yet" / "No upcoming games for your enabled leagues this week" — BRAND voice (Fraunces, italic, warm). Planner drafts.
- **Leaderboard chrome** — color-by-rank? Trophy icon for #1? "On a hot streak (5W2L last 7 picks)" callout? Planner has discretion within the BRAND restraint posture.
- **Slate definition for F1** (D-05) — final call by researcher / planner. F1 is one race per weekend (clear). Tiebreaker semantics for `f1_podium` may need adjustment once the slate logic is concrete. (UFC slate question dropped per D-17 update 2 — UFC pickType deferred to Phase 28.x.)
- **Picker pre-fill animation** (D-09) — subtle highlight on the pre-filled team chip when picker first renders, then fade to normal? Planner / UI-spec discretion.
- **`pickReminder` snooze / unsubscribe quick action** — could surface "Don't remind me for NBA" from inside the push notification body (Web Push action buttons). Nice-to-have; planner discretion.
- **Live-wp inline pick row visibility threshold** (D-07) — show only when 2+ members have picked? Always show (renders empty placeholders for not-yet-picked members)? Planner picks based on the existing live-wp layout density.
- **Settle-time CF scheduling** (D-16) — does `gameResultsTick` run every 5 min globally, or only during active league windows (NFL: Thu-Mon, NBA: daily Oct-Jun)? Planner / researcher decides based on Firestore scheduled-CF cost analysis.

## Deferred Ideas

- **Spread picks** — auto-fetched Vegas lines via a separate API (TheSportsDB doesn't expose). Would add 1pt-ish weighted scoring for "covered the spread". Defer to Phase 28.x or v3 pending source identification (Action Network, Odds API ~$5-50/mo).
- **Exact-score / total-score picks for non-tiebreaker games** — adds expressiveness but bloats the picker. Defer until v1 base validates.
- **Confidence pool scoring** — rank your picks 1-N for higher rank = more points. Engaging for NFL Sundays / NCAAF Saturdays but cognitively different game. Defer to Phase 28.x once base pick'em validates.
- **F1 podium bonus scoring** — full-podium-correct could earn 3pt instead of 1pt to reward expertise. Stays at flat 1pt for v1 per D-03.
- **UFC method bonus / split-decision bonus** — same pattern. Stays at flat 1pt for v1.
- **Cross-family / public leaderboard** — explicit PROJECT.md Out-of-Scope ("no public discovery / cross-family social feed"). Couch is family-scoped by design.
- **Guest picks** (Phase 27 guests) — explicit D-08 exclusion. Would require persistent identity model. Defer to Phase 28.x if user demand emerges.
- **Backfill picks for past games on mid-season join** — explicit D-13 exclusion (cheating vector).
- **Manual settle / score-override admin UI** — fully automated via `gameResultsTick` against TheSportsDB. If TheSportsDB returns wrong score, that's a TheSportsDB bug; family files a support ticket. Out of scope for v1.
- **Live-leaderboard sub-minute updates** — would require TheSportsDB Patreon $14/yr. Free tier's 15-sec score bucket + 5-min `gameResultsTick` cadence is enough for season-long ritual. Defer per D-01.
- **Pick'em settings panel** (per-league enable, custom tiebreaker pattern, push prefs) — explicit D-14 zero-config exclusion. Defer to Phase 28.x once user demand emerges.
- **"Parent picks on behalf of kid" pattern** — mirrors Phase 14 parent-approval. Defer per D-08 if demand emerges.
- **Push action buttons on `pickReminder`** ("Don't remind me for NBA" inline action) — Phase 28 Discretion item; defer if Web Push action button complexity is high.
- **Streak / milestone badges** ("5 picks in a row correct", "First family member to 100 wins this season") — engagement add-on. Defer to a Phase 28.x or v3 polish phase.

## Canonical refs

**Downstream agents (researcher, planner) MUST read these before researching or planning.**

### Phase boundary + scope
- `.planning/ROADMAP.md` § Phase 28 (lines ~510-516, plus Progress-table row at ~568) — goal + dependencies + 4 pre-noted gray areas
- `.planning/seeds/v2-watchparty-sports-milestone.md` § Phase 28 (lines ~75-82) — merge rationale (old Phase 28 + 29 → one deploy because leaderboard is derived from picks)

### Direct dependency CONTEXT/SUMMARY files
- `.planning/phases/22-sports-feed-abstraction/22-SUMMARY.md` — TheSportsDB module + 16-league catalog + `getPlays = []` constraint (drives Phase 28 pick types — winner-only is sufficient because no play-by-play needed)
- `.planning/phases/23-live-scoreboard/23-SUMMARY.md` — Game Mode pipeline widening (`wp.mode === 'game'` canonical; legacy `wp.sportEvent` flow now sets `mode='game'` too — Phase 28 reads `wp.sportEvent.id` to link picks)
- `.planning/phases/27-guest-rsvp/27-CONTEXT.md` — pattern reference: `wp.guests[]` denormalized array + `guestId` URL-safe base64 convention + 3-map notification stack pattern + cross-repo deploy ritual (Phase 28 mirrors all of these)

### Project-level posture
- `.planning/PROJECT.md` — PWA / per-family Firestore nesting / public-by-design API keys / Out-of-Scope: monetization + cross-family discovery
- `.planning/REQUIREMENTS.md` — current Coverage block + traceability conventions (Phase 28 PICK-28-* IDs to be assigned during /gsd-research-phase 28 → /gsd-plan-phase 28; mirror VID-24-*, RPLY-26-*, RSVP-27-* prefix conventions)
- `CLAUDE.md` § Architecture + Conventions + Token cost (`js/app.js` is ~17400 lines — never read in full, use Grep + offset/limit) + Phase numbering + scope safeguards (don't conflate code-internal "Phase 1-4" TMDB catalog with product roadmap)

### Source files Phase 28 builds on
- `js/sports-feed.js` (entire file — 192 lines) — `LEAGUES` catalog, `fetchSchedule`, `fetchScore`, `normalizeTsdEvent`, `leagueLabel`, `leagueEmoji`, `leagueKeys` (Phase 28 reads these; `normalizeTsdEvent` needs additive change to surface `strSeason` per Open question #1)
- `js/app.js:330-411` — `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` (Phase 28 extends both; must stay in lockstep with server)
- `js/app.js:10334-10532` — `openSportsPicker` (legacy — DO NOT extend; orphaned UI per Phase 23) + `scheduleSportsWatchparty` + `SportsDataProvider` + `openGamePicker` (canonical entry)
- `js/app.js:10739-10870` — `renderSportsScoreStrip` + `startSportsScorePolling` (Phase 28 reuses the score-polling primitive for live-leaderboard refresh during game windows)
- `js/app.js:12330-12340` — participant chip render with `teamColor` + `teamFlair` (Phase 28 uses `participants[mid].teamAllegiance` for D-09 soft pre-fill; these chip lines show how teamColor surfaces today)
- `queuenight/functions/index.js` — push notification CF stack + `NOTIFICATION_DEFAULTS` server map (Phase 28 extends with `pickReminder` + `pickResults` + `pickemSeasonReset` keys; must stay in lockstep with client)
- `queuenight/functions/index.js:931-985` — `watchpartyTick` scheduled CF pattern (Phase 28's `gameResultsTick` mirrors this)
- `queuenight/functions/src/rsvpSubmit.js` — Phase 27 transactional CF reference (Phase 28 picks-submit-CF if any; or rules-only writes from client)
- `firestore.rules` — Phase 28 adds rules for `families/{code}/picks/{pickId}` (host-only or member-self-write; lock-time check `request.time < resource.data.gameStartTime` per D-04) + `families/{code}/leaderboards/{leagueKey}/{strSeason}` (CF-write-only via admin SDK bypass)
- `scripts/deploy.sh` — §2.5 smoke chain (Phase 28 adds 11th contract `smoke-pickem.cjs`); §3 CACHE bump (Phase 28 → `couch-v40-pickem`)

### Convention references
- `.planning/phases/26-position-anchored-reactions-async-replay/26-CONTEXT.md` — pattern reference for ES-module split (`js/native-video-player.js` precedent → Phase 28 mirrors with `js/pickem.js`); smoke-floor meta-assertion convention (RPLY-26-17 floor ≥13 → PICK-28-N equivalent)
- `.planning/phases/24-native-video-player/24-CONTEXT.md` — pattern reference for Firestore rules tightening with denylist (REVIEWS M2 split rule into Path A host-only / Path B non-host with field denylist) — Phase 28 may need similar splitting on `families/{code}/picks/{pickId}` (member-self-write for own picks; CF-only for `state` / `pointsAwarded` / `settledAt` fields)

## Open questions for researcher

1. **TheSportsDB `strSeason` consistency across all 16 leagues:** Verify via `lookupevent.php` sample fetch per league that `strSeason` is reliably populated and uses a consistent format. Soccer leagues use "2025-2026"; US-major leagues use "2026". F1 / UFC may use single-year. `normalizeTsdEvent` in `js/sports-feed.js:65-98` does NOT currently surface this field — small additive change required (add `season: ev.strSeason` to the normalized output). Confirm no league returns null/empty `strSeason` (would break D-11 season tagging).

2. **Slate definition per league (D-05):** The "designated tiebreaker game = chronologically-last in slate" rule needs a concrete `slateOf(games, leagueKey, dayWindow)` implementation. Per-league questions:
   - NFL: Calendar day clear (Thu/Sun/Mon games); but does Thursday Night Football count as its own slate or part of Sunday's slate?
   - NBA / WNBA / NHL / MLB: Daily slates clear; verify TheSportsDB `strDate` field maps to local time vs UTC.
   - NCAAF: Saturday clear; bowl-game weekday games as their own slates?
   - Soccer: Use `intRound` field? UCL by `strStage`?
   - F1: One race weekend = one slate (clear). Tiebreaker total = sum of P1/P2/P3 finish times in seconds? Or just race total laps completed by all drivers?
   - UFC: One event card = one slate (clear). Tiebreaker total = total round count of the entire card? Total fight times in seconds?
   Per-league concrete definition required before `js/pickem.js` can be coded.

3. **Firestore rules for `families/{code}/picks/{pickId}` (D-02, D-04):** Confirm rules pattern for member-self-write of own picks (`request.auth.uid == resolveMemberUid(memberId)` — verify the existing member→uid resolution helper in current `firestore.rules`) + lock-time check (`request.time < resource.data.gameStartTime`) + CF-only write of `state` / `pointsAwarded` / `settledAt` / `tiebreakerDelta` fields (admin SDK bypasses rules cleanly per Phase 27 pattern; or split rules with field-level allowlist mirroring REVIEWS M2 from Phase 24). Confirm whether family-code-scoped collection rules pattern from existing collections (titles, votes, queues, reactions) cleanly composes onto the new `picks` and `leaderboards` paths.

4. **`gameResultsTick` scheduling cost vs cadence (D-16):** At 5-min cadence × 10 active leagues × N families, what's the projected Firestore read cost? Should the CF gate per-league active-window scanning (e.g. NFL only Thu-Mon, NBA only Oct-Jun) before reaching ~100 families? Or is global 5-min sufficient for v1's family count (~5 families)?

5. **`pickReminder` push idempotency window (D-06):** The "T-15min push exactly once per (memberId, gameId)" rule needs an idempotency key. Proposal: `picks_reminders/{leagueKey}_{gameId}_{memberId}` Firestore doc with `sentAt` timestamp; CF skips if doc exists. Confirm this pattern is consistent with the existing push-fan-out idempotency conventions (Phase 14 / `excludeUid` pattern; Phase 27 `wp.reminders[guestId][windowKey]` pattern). Pick the closest match.

6. **`families/{code}/leaderboards/{leagueKey}/{strSeason}` doc-size budget:** With 16 leagues × ~17 seasons of historical archive × ~10 family members per family × ~50-200 picks per member per season → leaderboard docs stay tiny (one doc per league/season; member rows are aggregates, not per-pick). But verify the per-member aggregate row stays under Firestore 1MB doc limit even for an extreme case (NFL 2026 with 17 weeks × 16 games per week + playoffs = ~290 games per member = 290 settled-pick aggregates).

7. **Cross-repo lockstep verification for the 3-map notification stack (D-06):** Phase 14 D-12 established the lockstep convention (client `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` + server `NOTIFICATION_DEFAULTS`). Phase 28 adds 3 keys (`pickReminder`, `pickResults`, `pickemSeasonReset`). Confirm the deploy ritual in `scripts/deploy.sh` doesn't have an automated lockstep check (it doesn't, per Phase 14 / 15.4 close-out notes — this is manual dev discipline). Plan a `scripts/smoke-pickem.cjs` assertion that grep's both repos for the three keys to catch lockstep drift.

8. **Tiebreaker arithmetic edge cases (D-05):** What happens when no member submitted a tiebreaker total (all members skipped the optional tiebreaker input)? Confirm: ties stay ties (per D-05 final-tier fallback). What about partial submission (Mom submitted total, Dad didn't)? Confirm: members without tiebreaker submission lose tied positions to members with submission. Codify this in `summarizeMemberSeason` helper.

## Folded todos

(none — neither pending todo `2026-04-27-live-release-push-nominate-deep-link-handler.md` nor `2026-04-27-phase-15-ios-ux-fixes.md` matched Phase 28 scope on this pass)

## Reviewed-but-not-folded todos

(none — see above)

## Next steps

1. Run `/gsd-plan-phase 28` (recommended) to chain research → pattern-mapping → planning → plan-check in sequence. Researcher will read this CONTEXT.md as locked-decisions input + investigate the 8 open questions above to produce RESEARCH.md.
2. Or run `/gsd-research-phase 28` standalone first if you want to review the research findings before planning.
3. Or run `/gsd-ui-phase 28` first to lock the UI design contract before planning (Phase 28 has substantial new UI surface — Pick'em tab, picker cards, leaderboard, history archive, inline-wp pick row).

---

*Phase: 28-social-pickem-leaderboards*
*Context gathered: 2026-05-02*
