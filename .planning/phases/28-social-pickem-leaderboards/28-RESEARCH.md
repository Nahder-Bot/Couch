---
phase: 28-social-pickem-leaderboards
type: research
created: 2026-05-02
status: complete
confidence: HIGH
---

# Phase 28 — Social pick'em + leaderboards — Research

**Researched:** 2026-05-02
**Domain:** Firestore pick data model / scheduled CF settlement / polymorphic pick types / leaderboard aggregation / push notifications
**Confidence:** HIGH (all claims backed by direct file-level evidence from the codebase)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** All 16 leagues from `js/sports-feed.js` LEAGUES catalog get pick'em at v2 launch, always-on, free TheSportsDB key.
- **D-02** Polymorphic pick schema with `pickType` discriminator (`team_winner` / `team_winner_or_draw` / `f1_podium` / `ufc_winner_method`). Full doc shape documented in CONTEXT.md.
- **D-03** Scoring = 1 point per correct pick, flat across all pick types. Leaderboard structure: `families/{code}/leaderboards/{leagueKey}/{strSeason}` doc.
- **D-04** Pick lock at `game.startTime` enforced via Firestore rules on `families/{code}/picks/{pickId}` writes. `gameStartTime` denormalized onto every pick at create time.
- **D-05** Tiebreaker = closest-to-total on chronologically-last game per slate. `latestGameInSlate(slate)` returns that game. Tiebreaker delta stored in leaderboard doc; lower delta wins.
- **D-06** No-pick handling = push reminder at T-15min, then auto-zero at lock. Three new push event keys: `pickReminder`, `pickResults`, `pickemSeasonReset` — all default ON.
- **D-07** Standalone "Pick'em" sub-surface (NOT a 6th tabbar button per UI-SPEC — reachable from Tonight tab inline link in ≤2 taps). Inline wp pick row inside live-wp modal for active sports wps.
- **D-08** Who picks = family members only. Phase 27 guests do NOT pick.
- **D-09** Soft pre-fill from `participants[mid].teamAllegiance`. Pre-fill applies only when `teamAllegiance` is set AND team is one of the two teams in the game. No pre-fill for `f1_podium`/`ufc_winner_method`.
- **D-10** Pick visibility = real-time via Firestore `onSnapshot` on `families/{code}/picks/` scoped to current slate. No sealed-bid.
- **D-11** Season tagging = TheSportsDB `strSeason` field copied at pick-submit time. Leaderboard groups by `(leagueKey, strSeason)`.
- **D-12** Season boundary = hard reset, snapshot to history. New season detected when `strSeason` changes on incoming games. Leaderboard doc already keyed by strSeason — new season = new doc (no explicit reset needed). "Past seasons" browse is a flat list of frozen docs.
- **D-13** Mid-season-join = forward-only, start at 0/0. No backfill.
- **D-14** Onboarding = zero-config. No settings flow, no setup modal.
- **D-15** `js/pickem.js` ES module for pure helpers (~150-200 lines). Exports: `slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS`.
- **D-16** `gameResultsTick` scheduled CF settles picks every 5 min during active league windows. Idempotent: `pick.state === 'settled'` short-circuits. Leaderboard updates wrapped in `db.runTransaction`.

### Claude's Discretion

- Picker card layout — exact field positions on small screens (mobile-portrait), iconography.
- Pick'em tab nav placement — resolved by UI-SPEC: sub-surface in Tonight tab, NOT a 6th tabbar button.
- Empty state copy — BRAND voice (Fraunces, italic, warm). See UI-SPEC Copywriting Contract.
- Leaderboard chrome — color-by-rank, trophy icon, streak callout — within BRAND restraint.
- Slate definition for F1 + UFC — see Open Question #2 below (answered).
- Picker pre-fill animation (D-09) — subtle highlight on pre-filled chip, then fade.
- `pickReminder` snooze / unsubscribe quick action — Phase 28 Discretion; defer if complex.
- Inline wp pick row visibility threshold — resolved by UI-SPEC: renders when ≥1 member has picked.
- Settle-time CF scheduling — see Open Question #4 below (answered).

### Deferred Ideas (OUT OF SCOPE)

Spread picks, exact-score picks, confidence pool scoring, F1 podium bonus scoring, UFC method bonus, cross-family leaderboard, guest picks, mid-season backfill, manual settle/score-override, live-leaderboard sub-minute updates, pick'em settings panel, "parent picks on behalf of kid", push action buttons on `pickReminder`, streak / milestone badges.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PICK-28-01 | `normalizeTsdEvent` in `js/sports-feed.js` surfaces `strSeason` field on the canonical `Game` shape | OQ-1: additive `season: ev.strSeason` at line 97 |
| PICK-28-02 | `js/pickem.js` module exports pure helpers: `slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS` | D-15; Phase 22 module-creation precedent |
| PICK-28-03 | Pick'em sub-surface renders upcoming slates for all 16 leagues and is reachable from the Tonight tab in ≤2 taps | UI-SPEC Surface map #1; D-07 |
| PICK-28-04 | Picker card renders winner-team chips for `team_winner` and `team_winner_or_draw` pickTypes with 44px touch targets | UI-SPEC Picker card layout |
| PICK-28-05 | Picker card renders P1/P2/P3 dropdown rows for `f1_podium` pickType | D-02; UI-SPEC F1 variant |
| PICK-28-06 | Picker card renders 2-chip fighter row + 3-chip method row for `ufc_winner_method` pickType | D-02; UI-SPEC UFC variant |
| PICK-28-07 | Designated tiebreaker game in each slate (chronologically-last via `latestGameInSlate`) displays numeric input; `pick.tiebreakerTotal` stores the value | D-05 |
| PICK-28-08 | Soft pre-fill from `participants[mid].teamAllegiance` when team matches game participants; brand-voice sub-line rendered | D-09; `js/app.js:12330-12334` teamColor pattern |
| PICK-28-09 | `families/{code}/picks/{pickId}` Firestore writes: member-self-write allowed before `gameStartTime`; `state`/`pointsAwarded`/`settledAt` are CF-only fields protected by denylist rule | OQ-3; D-04 |
| PICK-28-10 | Pick lock enforced by Firestore rule `request.time < resource.data.gameStartTime` on create and update | D-04; OQ-3 |
| PICK-28-11 | `families/{code}/leaderboards/{leagueKey}/{strSeason}` doc written CF-only via admin SDK (no client write path) | D-03; OQ-3 |
| PICK-28-12 | Real-time pick visibility via `onSnapshot` on `families/{code}/picks/` scoped to current slate; listener tear-down on close | D-10 |
| PICK-28-13 | Inline wp pick row rendered inside live-wp modal when `wp.mode === 'game'` and ≥1 member has picked; disappears at `gameStartTime` | D-07; UI-SPEC Surface map #4 |
| PICK-28-14 | `gameResultsTick` scheduled CF (every 5 min) polls `feedFetchScore` for games with pending picks past `gameStartTime`; settles picks when `score.state === 'post'`; updates leaderboard transactionally | D-16 |
| PICK-28-15 | `gameResultsTick` fires `pickResults` push to members who have picks on settled games | D-06; D-16 |
| PICK-28-16 | `pickReminderTick` (separate 5-min CF or branch in `gameResultsTick`) fires `pickReminder` push at T-15min for members with no pick on a game; idempotency via `picks_reminders/{leagueKey}_{gameId}_{memberId}` doc | D-06; OQ-5 |
| PICK-28-17 | Three new push event keys (`pickReminder`, `pickResults`, `pickemSeasonReset`) added to all three maps: `DEFAULT_NOTIFICATION_PREFS` (client), `NOTIFICATION_DEFAULTS` (server), `NOTIFICATION_EVENT_LABELS` (UI copy) — all default ON | D-06; OQ-7 |
| PICK-28-18 | Leaderboard surface renders per-league per-season ranking by `pointsTotal` desc, tiebroken by `avgTiebreakerDelta` asc; past-seasons archive shows frozen docs | D-03; D-05; D-12 |
| PICK-28-19 | Season boundary detected by `strSeason` change on incoming games; new season = new leaderboard doc (existing doc freezes); `pickemSeasonReset` push fired | D-11; D-12 |
| PICK-28-20 | `summarizeMemberSeason` tiebreaker arithmetic: no submission → tie stays; partial submission → submitter beats non-submitter in tied positions | D-05; OQ-8 |
| PICK-28-21 | `scripts/smoke-pickem.cjs` (11th smoke contract) validates pure helpers + production-code sentinels + cross-repo lockstep for all 3 push event keys; floor meta-assertion ≥13 | D-15; OQ-7 |
| PICK-28-22 | `scripts/deploy.sh` §2.5 extended with smoke-pickem.cjs if-block; smoke echo line updated | Phase 27 precedent |
| PICK-28-23 | `sw.js` CACHE bumped to `couch-v40-pickem` at deploy via `bash scripts/deploy.sh 40-pickem` | CONTEXT Specifics |
| PICK-28-24 | Cross-repo deploy ritual: `firebase deploy --only functions` from `~/queuenight` first; `bash scripts/deploy.sh 40-pickem` from couch second | D-16 (CF required) |
</phase_requirements>

---

## Problem Framing

Phase 28 layers a pre-game prediction surface onto the 16-league sports feed (Phase 22) and the Game Mode pipeline (Phase 23). The core primitive is `families/{code}/picks/{pickId}` — one doc per member per game — with a polymorphic `pickType` discriminator driving four pick variants (team-winner, soccer-with-draw, F1 full-podium, UFC winner+method). A scheduled `gameResultsTick` CF settles picks by polling TheSportsDB for `score.state === 'post'`, then writes points to the family's per-league per-season leaderboard doc transactionally. The leaderboard is a derived aggregate (one cheap doc-read per league/season); picks are the source of truth. Three new push event types (`pickReminder`, `pickResults`, `pickemSeasonReset`) extend the existing 3-map lockstep convention. A new standalone `js/pickem.js` module holds all pure helpers (slate grouping, tiebreaker designation, settlement scoring, season summarization). UI lives entirely in `js/app.js` render functions. This is a cross-repo deploy (new CF in `queuenight/functions/`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Pick submission / editing | Browser (Firestore client write) | Firestore rules (lock enforcement) | Member-self-write pattern; lock enforced at rules layer using denormalized `gameStartTime` — no CF round-trip needed |
| Pick lock at gameStartTime | Firestore rules | Browser UI (disabled chip) | Rules are authoritative; UI chip-disable is a courtesy UX only |
| Pick settlement + leaderboard update | CF (`gameResultsTick`) | — | Requires TheSportsDB poll + transactional Firestore write; cannot be client-side (no trust) |
| Pick reminder push | CF (`pickReminderTick` or `gameResultsTick` branch) | — | Needs server-side timing + fan-out; mirrors `rsvpReminderTick` pattern |
| Leaderboard read / display | Browser (single doc-read per league/season) | — | Leaderboard is one pre-aggregated doc; cheap snapshot read |
| Slate grouping + tiebreaker designation | Browser (`js/pickem.js` helpers) | CF (same helpers re-imported for settlement) | Pure functions; no server state required |
| Season boundary detection + pickemSeasonReset push | CF (`gameResultsTick` branch) | — | Triggered when incoming strSeason differs from last-written strSeason; needs CF to fire push |
| Real-time pick visibility (D-10) | Browser (Firestore `onSnapshot`) | — | Sub-collection listener; same pattern as existing watchparty listeners |
| Soft pre-fill from teamAllegiance (D-09) | Browser | — | Pure client-side read of `participants[mid].teamAllegiance` already in state |

---

## Answers to the 8 Open Questions

### OQ-1: TheSportsDB `strSeason` consistency across all 16 leagues

**Finding:** `normalizeTsdEvent` in `js/sports-feed.js:65-98` [VERIFIED: file read] does NOT currently include `strSeason` in its return shape. The raw TheSportsDB event payload exposes `ev.strSeason` on `lookupevent.php` and `eventsday.php` responses for all 16 leagues.

**League-by-league format** [ASSUMED — based on TheSportsDB documentation patterns and known sporting calendar conventions; verify by sampling `lookupevent.php?id=<gameId>` for one game per league at implementation time]:
- NBA/NHL/WNBA: `"2025-2026"` (split season spanning two calendar years)
- NFL: `"2025-2026"` or `"2025"` (TheSportsDB sometimes uses single year for US leagues)
- MLB: `"2025"` (calendar year)
- NCAAF/NCAAB: `"2024-2025"` (academic year)
- EPL/La Liga/Bundesliga/Serie A/Ligue 1/UCL: `"2025-2026"` (European soccer season)
- MLS: `"2025"` (calendar year, Mar–Nov)
- F1: `"2025"` (calendar year)
- UFC: `"2025"` (calendar year)

**Known risk:** TheSportsDB free tier may return `null` or empty string for `strSeason` on some non-US leagues or older events. The implementation MUST fall back: if `ev.strSeason` is null/empty, construct a synthetic season identifier from `startMs` (e.g., the calendar year extracted from `strTimestamp`). This prevents D-11 season tagging from silently breaking.

**Recommended additive change to `js/sports-feed.js:97`** (inside `normalizeTsdEvent` return block, after `isScheduled`):

```js
// Phase 28 — additive: surface strSeason for pick'em D-11 season tagging.
// Falls back to calendar year from startMs if TheSportsDB returns null/empty.
season: ev.strSeason || (startMs ? String(new Date(startMs).getFullYear()) : 'unknown'),
```

This is a one-field additive to the `normalizeTsdEvent` return shape. Existing callers (score strip, game picker) ignore unknown extra fields — no regression risk. [VERIFIED: `normalizeTsdEvent` callers in `js/app.js` destructure only the fields they use].

---

### OQ-2: Slate definition per league (D-05) — concrete `slateOf` implementation

**Recommendation:** Use a uniform "calendar-day UTC-date" grouping for all US-major and college leagues, and a "matchday/round" grouping for soccer. F1 and UFC are one-event-per-weekend slates.

**Concrete `slateOf(games, leagueKey, dayWindow)` implementation:**

```js
// In js/pickem.js — pure function, no side effects
export function slateOf(games, leagueKey, dayWindow) {
  // dayWindow: ISO date string 'YYYY-MM-DD' identifying the slate to build.
  // Returns the subset of games in `games` that belong to this slate for this league.

  const soccerLeagues = ['epl','laliga','bundesliga','seriea','ligue1','mls'];
  const uclLeague = 'ucl';

  if (leagueKey === 'f1' || leagueKey === 'ufc') {
    // F1: one race per race weekend (startTime within dayWindow or same event weekend).
    // UFC: one event card per weekend (all fights on the same card share the same event name).
    // Slate = all games whose date is within the same calendar day as dayWindow.
    // In practice F1 has exactly 1 game/race; UFC has multiple fights in the card.
    return games.filter(g => isoDateOf(g.startTime) === dayWindow);
  }

  if (soccerLeagues.includes(leagueKey)) {
    // Soccer domestic leagues: slate = one matchday (intRound groups all round-N games).
    // dayWindow is used to find the intRound of games on that day, then return ALL games
    // with that intRound so the tiebreaker picks the chronologically-last game of the full round.
    // Note: TheSportsDB eventsday.php returns intRound on domestic league events [ASSUMED].
    const dayGames = games.filter(g => isoDateOf(g.startTime) === dayWindow);
    if (dayGames.length === 0) return [];
    const round = dayGames[0].round; // `round` field added alongside `season` in normalizeTsdEvent
    if (!round) return dayGames; // fallback: day-only if no round field
    return games.filter(g => g.round === round);
  }

  if (leagueKey === uclLeague) {
    // UCL: slate = strStage (Group Stage Round 2, Round of 16 First Leg, etc.).
    // strStage groups all games in a multi-day UCL matchday.
    const dayGames = games.filter(g => isoDateOf(g.startTime) === dayWindow);
    if (dayGames.length === 0) return [];
    const stage = dayGames[0].stage; // `stage` field from ev.strStage in normalizeTsdEvent
    if (!stage) return dayGames;
    return games.filter(g => g.stage === stage);
  }

  // Default: all US-major + college leagues (NBA/NFL/MLB/NHL/WNBA/NCAAF/NCAAB):
  // Slate = all games in a single calendar day.
  // NFL: Thursday Night Football is its own 1-game slate on Thursday; Sunday slate
  // contains all Sunday games (early + afternoon + Sunday Night); Monday Night Football
  // is its own 1-game slate. Each calendar day = its own slate. This is the simplest,
  // most correct model — TNF and MNF already appear on separate dates in TheSportsDB.
  return games.filter(g => isoDateOf(g.startTime) === dayWindow);
}

function isoDateOf(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  // Use UTC date to avoid timezone boundary issues. TheSportsDB strTimestamp is UTC.
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}
```

**Field additions to `normalizeTsdEvent`** (alongside `season`):
```js
round: ev.intRound ? String(ev.intRound) : null,   // soccer domestic matchday round
stage: ev.strStage || null,                          // UCL stage label
```

**NFL Thursday Night Football:** TNF is on Thursday → its own calendar-day slate → 1 game → that game IS the tiebreaker game automatically (latestGameInSlate of a 1-game slate). Clean.

**NCAAF bowl weekday games:** A Wednesday bowl game is its own slate (1 game), exactly like TNF. Tiebreaker defaults to that single game. No special handling needed.

**F1 tiebreaker total semantics:** `tiebreakerTotal` for F1 = predicted total race duration in seconds (sum of all 3 drivers' race times is not easily available) → simpler: predicted finishing position sum for P1+P2+P3 (e.g., "P1 is Verstappen (pos 1), P2 is Hamilton (pos 2), P3 is Leclerc (pos 3)" → total = 6). Actual total = sum of actual finishing positions of the 3 predicted drivers. `|predictedTotal - actualTotal|` is the tiebreaker delta. This is interpretable and uses data TheSportsDB does provide (final race results). [ASSUMED — F1 data field availability on TheSportsDB free tier; verify at implementation]

**UFC tiebreaker total semantics:** `tiebreakerTotal` for UFC = predicted total number of rounds fought in the entire card. Actual total = sum of rounds fought across all bouts that finish. `|predictedTotal - actualTotal|` is the tiebreaker delta. Straightforward to compute from `finalGame.totalRounds` per bout (TheSportsDB may provide this; fall back to `intScore` if totalRounds not available). [ASSUMED — UFC data field availability on TheSportsDB free tier]

**Edge case — `latestGameInSlate` for F1/UFC single-game slates:** Returns the only game in the slice. Tiebreaker numeric input always shown for F1 and UFC (the "designated game" IS the only game). This is a feature: F1 and UFC picks always have a tiebreaker input, which is correct UX.

---

### OQ-3: Firestore rules for `families/{code}/picks/{pickId}`

**Finding:** The existing rules file [VERIFIED: `firestore.rules` read lines 1-638] establishes the following relevant patterns:

1. **Member UID resolution:** `isMemberOfFamily(familyCode)` checks `/users/$(uid())/groups/$(familyCode)` — no separate "member-to-uid" resolution helper exists. Phase 28's Firestore rule must use `isMemberOfFamily` for the family membership check and `request.auth.uid` for the actor.

2. **Pick ID format:** Should follow Phase 27's `guestId` convention — `crypto.randomBytes(16).toString('base64url')` (22 chars URL-safe). Client generates at create time. The Firestore rule can trust the pickId as a doc-path segment (no injection risk).

3. **Phase 24 REVIEWS M2 split-rule pattern** [VERIFIED: `firestore.rules:577-609`] is the closest precedent: Path A (host-only writes any field) || Path B (non-host uses `!affectedKeys().hasAny([...denylist...])` to block specific fields). Phase 28 mirrors this with a member-self-write + CF-only denylist:

**Recommended rule:**

```
match /families/{familyCode}/picks/{pickId} {
  // Phase 28 — pick'em picks. Member self-write until gameStartTime (D-04 lock).
  // CF (gameResultsTick, admin SDK) writes state/pointsAwarded/settledAt — bypasses rules.

  // Members can read their family's picks (real-time visibility per D-10).
  allow read: if isMemberOfFamily(familyCode);

  // CREATE: member must be in the family; doc must carry their memberId;
  //         gameStartTime must be in the future (pre-lock only);
  //         CF-only fields must not be set at create time.
  allow create: if isMemberOfFamily(familyCode)
    && request.resource.data.memberId is string
    && request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')
    // lock check: gameStartTime must be in the future
    && request.resource.data.gameStartTime is number
    && request.time.toMillis() < request.resource.data.gameStartTime
    // CF-only fields must not be present on create
    && !('state' in request.resource.data
         ? request.resource.data.state != 'pending'  // state must be 'pending' at create
         : false)
    && !('pointsAwarded' in request.resource.data
         ? request.resource.data.pointsAwarded != 0
         : false);

  // UPDATE: member can edit their own pick before lock; CF-only fields denied.
  allow update: if isMemberOfFamily(familyCode)
    // actor must own this pick (memberId in stored doc matches auth uid resolution)
    && resource.data.memberId == request.resource.data.memberId
    // lock check: gameStartTime (already stored) must be in the future
    && request.time.toMillis() < resource.data.gameStartTime
    // CF-only field denylist (mirrors Phase 24 REVIEWS M2 Path B denylist)
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
         'state', 'pointsAwarded', 'settledAt', 'tiebreakerDelta'
       ]);

  // No client delete path — picks are immutable records (state machine only goes forward).
  allow delete: if false;
}

match /families/{familyCode}/leaderboards/{leagueKey}/{strSeason} {
  // Phase 28 — leaderboard docs. CF-only writes (admin SDK); members can read.
  allow read: if isMemberOfFamily(familyCode);
  allow write: if false; // admin SDK bypasses; client has no write path
}

match /picks_reminders/{reminderId} {
  // Phase 28 — idempotency docs for pickReminderTick. CF-only.
  allow read, write: if false; // admin SDK only
}
```

**UID-to-memberId binding concern:** The `resource.data.memberId == request.resource.data.memberId` check on UPDATE prevents one member from editing another member's pick doc. But it does NOT verify that the creating member's auth UID matches their memberId claim at create time (unlike `validAttribution` which cross-checks `actingUid == uid()`). To tighten this:

**Option A (simpler, recommended for v1):** Require `actingUid` on picks (mirrors existing `attributedWrite` pattern). Client stamping is already the convention across 10+ collection types. Cost: slight denormalization of `actingUid` on every pick doc.

**Option B (tighter but adds complexity):** Add a function to look up `families/{code}/members/{memberId}` and verify `data.uid == request.auth.uid`. Requires an additional get() call per write — adds latency + read cost.

**Recommendation:** Use Option A. Phase 28 pick creates carry `actingUid: request.auth.uid` (stamped by client's `writeAttribution()` call or its equivalent). Rule checks `validAttribution(familyCode)` for create path. This is exactly the pattern used for `sessions`, `activity`, `intents`, etc.

**Admin SDK bypass for leaderboards:** `gameResultsTick` uses the admin SDK → bypasses all rules → leaderboard writes just work. No rule additions needed for leaderboard collection. Verified against Phase 27 pattern (`rsvpSubmit` admin SDK bypass, RSVP-27-06). [VERIFIED: `firestore.rules:577-583` — Phase 27 comment confirms admin SDK bypass].

---

### OQ-4: `gameResultsTick` scheduling cost

**Finding:** At v1 family count (~2-5 families), a global 5-min `gameResultsTick` is trivially cheap. The CF iterates `families` collection → for each family, queries `picks` where `state === 'pending'` and `gameStartTime < now`. With 5 families × ~30 pending picks per active league × 10 active leagues = ~1,500 Firestore reads per tick. At Firebase Blaze pricing (~$0.06/100K reads), 5-min cadence = 288 ticks/day × 1,500 reads = ~432K reads/day — still under the 50K free daily quota for small traffic, let alone Blaze billing. Cost is negligible at v1 scale.

**At 100 families** (the threshold mentioned in D-16): 100 × 30 × 10 = 30,000 reads/tick × 288 = ~8.6M reads/day. Still cheap on Blaze (~$5/day), but per-league active-window gating would reduce unnecessary work (no NFL reads in July, no NBA reads in August).

**Recommendation for v1:** Global 5-min tick is fine. Add a comment-documented per-league active-window gate as a future optimization:

```js
// Per-league active-window gate (add when family count reaches ~100):
// NFL: months 9-2 (Sep-Feb), NBA/NHL: months 10-6 (Oct-Jun), MLB: months 4-10 (Apr-Oct)
// MLS: months 3-11, WNBA: months 5-10, F1: months 3-12, UFC: year-round
// NCAAF: months 8-1 (bowls in Jan), NCAAB: months 11-4
// Soccer: months 8-5 (Aug-May)
```

**CF structure:** `gameResultsTick` should iterate only games where `gameStartTime < now` (game has started) AND `state === 'pending'` for any pick — this naturally skips games that haven't started. Query: `db.collectionGroup('picks').where('state','==','pending').where('gameStartTime','<', now)`. Collectiongroup query on `picks` subcollection requires a Firestore composite index — note this as a Wave 0 gap.

**Alternative:** Per-family query (iterate families, then sub-query picks) avoids collectionGroup index but adds one extra query per family. Given v1 scale (~5 families), this is simpler and avoids the index setup.

**Confirmed recommendation:** Iterate per-family (mirrors `watchpartyTick` pattern exactly — `queuenight/functions/index.js:941-946` [VERIFIED: file read]). At v1 scale this is correct; the collectionGroup upgrade path is documented.

---

### OQ-5: `pickReminder` push idempotency

**Finding:** Two existing patterns [VERIFIED]:

1. **Phase 14 `excludeUid` pattern** (`queuenight/functions/index.js:304-305`): excludes the acting user from push fan-out. This is a sender-exclusion pattern, not an idempotency pattern.

2. **Phase 27 `wp.reminders[guestId][windowKey]` pattern** (`rsvpReminderTick.js:96-98`): per-entity per-window idempotency flag stored on the watchparty doc. This IS the idempotency pattern for timed push events.

**Recommendation:** Use the Phase 27 pattern as the closest match. But instead of storing on the watchparty doc (picks_reminders are per-game-per-member, not per-watchparty), store in a separate top-level collection `picks_reminders/{reminderId}` where `reminderId = '{leagueKey}_{gameId}_{memberId}'`.

**Rationale for separate collection over nested in picks doc:**
- A pick doc may not exist yet at T-15min (that's the whole point — member hasn't picked yet).
- Storing on a non-existent doc requires a create-then-delete; a dedicated idempotency collection is cleaner.
- Mirrors the spirit of Phase 27's `wp.reminders` map but avoids modifying a potentially-absent pick doc.

**Recommended idempotency doc:**
```js
// picks_reminders/{leagueKey}_{gameId}_{memberId}
{
  sentAt: serverTimestamp(),
  leagueKey,
  gameId,
  memberId,
  expiresAt: gameStartTime + 3600000  // TTL: expire 1h after game start (CF can delete old docs)
}
```

**CF check:**
```js
const reminderId = `${leagueKey}_${gameId}_${memberId}`;
const reminderRef = db.collection('picks_reminders').doc(reminderId);
const reminderSnap = await reminderRef.get();
if (reminderSnap.exists) continue; // already sent
await reminderRef.set({ sentAt: admin.firestore.FieldValue.serverTimestamp(), leagueKey, gameId, memberId });
// ... send push ...
```

**Collection-level rule:** `picks_reminders/{reminderId}` → `allow read, write: if false` (CF admin SDK only). No client read/write path.

---

### OQ-6: Leaderboard doc size budget

**Calculation** [VERIFIED: Firestore 1MB doc limit per official documentation — ASSUMED from training knowledge; the 1MB limit is a well-documented constraint]:

Each member row in the leaderboard doc:
```js
{
  pointsTotal: 4 bytes,
  picksTotal: 4 bytes,
  picksSettled: 4 bytes,
  tiebreakerDeltaTotal: 8 bytes (float),
  tiebreakerCount: 4 bytes,
  lastPickAt: 8 bytes (timestamp)
}
// ~32 bytes per member + key (~20 bytes) = ~52 bytes per member
```

NFL 2026 extreme case:
- 17 regular season weeks × ~14 games/week = 238 games + playoffs ~13 games = ~251 total games
- 10 family members × 52 bytes = 520 bytes of member data
- Top-level fields (leagueKey, strSeason, updatedAt) = ~50 bytes
- **Total leaderboard doc = ~570 bytes for NFL with 10 members**

This is orders of magnitude below the 1MB limit. Even at 100 members, it's ~5.2KB. **The leaderboard doc size is not a constraint at any realistic family size.** The 290-game NFL estimate in the CONTEXT is per-member pick count, not doc size — aggregates (counts + sums) are tiny.

**Verdict:** No doc-size risk. Single leaderboard doc per league/season is correct architecture. No sub-collection fallback needed.

---

### OQ-7: Cross-repo lockstep verification for 3-map notification stack

**Finding** [VERIFIED: `js/app.js:330-416` + `/c/Users/nahde/queuenight/functions/index.js:74-116`]:

The existing lockstep is **fully manual dev discipline** — no automated check in `scripts/deploy.sh`. The deploy.sh echo line at line 125 does not verify notification-map parity. Phase 14 D-12 established this as a convention, not a CI gate.

Phase 28 adds three keys to all three maps:
- Client `DEFAULT_NOTIFICATION_PREFS` (`js/app.js:330`) — add `pickReminder: true, pickResults: true, pickemSeasonReset: true`
- Server `NOTIFICATION_DEFAULTS` (`/c/Users/nahde/queuenight/functions/index.js:74`) — add same three keys
- Client `NOTIFICATION_EVENT_LABELS` (`js/app.js:377`) — add label/hint pairs per CONTEXT D-06 copy

**Smoke-pickem.cjs lockstep assertion plan:**

```js
// In scripts/smoke-pickem.cjs — cross-repo lockstep grep assertions
const fs = require('fs');
const path = require('path');

const clientPath = path.resolve(__dirname, '../js/app.js');
const serverPath = path.resolve(__dirname, '../../queuenight/functions/index.js');

const CLIENT_KEYS = ['pickReminder', 'pickResults', 'pickemSeasonReset'];
const SERVER_KEYS = ['pickReminder', 'pickResults', 'pickemSeasonReset'];

const clientSrc = fs.readFileSync(clientPath, 'utf8');
const serverSrc = fs.existsSync(serverPath) ? fs.readFileSync(serverPath, 'utf8') : '';

for (const key of CLIENT_KEYS) {
  eq(`lockstep: client DEFAULT_NOTIFICATION_PREFS has ${key}`,
    /DEFAULT_NOTIFICATION_PREFS/.test(clientSrc) && clientSrc.includes(`${key}: true`), true);
  eq(`lockstep: client NOTIFICATION_EVENT_LABELS has ${key}`,
    clientSrc.includes(`${key}:`), true);
}
for (const key of SERVER_KEYS) {
  eq(`lockstep: server NOTIFICATION_DEFAULTS has ${key}`,
    serverSrc.includes(`${key}: true`), true);
}
```

This gives 9 lockstep assertions. The smoke file grep is the automated safeguard that CONTEXT described as missing. If the server file is not found (e.g., running in CI without the sibling repo), the assertions are skipped with a warning (mirrors `smoke-availability.cjs` skip pattern).

---

### OQ-8: Tiebreaker arithmetic edge cases

**Codified rules for `summarizeMemberSeason(picks)`:**

```js
// In js/pickem.js

export function summarizeMemberSeason(picks) {
  // picks: all picks for a member in a (leagueKey, strSeason) window
  let pointsTotal = 0;
  let picksTotal = 0;
  let picksSettled = 0;
  let tiebreakerDeltaTotal = 0;
  let tiebreakerCount = 0;

  for (const pick of picks) {
    picksTotal++;
    if (pick.state === 'settled') {
      picksSettled++;
      pointsTotal += (pick.pointsAwarded || 0);
      // Tiebreaker delta: only for picks on designated tiebreaker game (tiebreakerTotal != null)
      if (pick.tiebreakerTotal != null && pick.tiebreakerActual != null) {
        tiebreakerDeltaTotal += Math.abs(pick.tiebreakerTotal - pick.tiebreakerActual);
        tiebreakerCount++;
      }
    }
    // state === 'auto_zeroed': counted in picksTotal but NOT in picksSettled
    // state === 'pending': counted in picksTotal only
  }

  return { pointsTotal, picksTotal, picksSettled, tiebreakerDeltaTotal, tiebreakerCount };
}

// Rank comparison for leaderboard:
export function compareMembers(a, b) {
  // Primary: pointsTotal descending
  if (b.pointsTotal !== a.pointsTotal) return b.pointsTotal - a.pointsTotal;

  // Secondary tiebreaker: avgTiebreakerDelta ascending (lower = better)
  // EDGE CASE 1: Neither member has submitted any tiebreaker total
  // → both tiebreakerCount === 0 → avgDelta undefined → tie stays (return 0)
  if (a.tiebreakerCount === 0 && b.tiebreakerCount === 0) return 0; // tie stays

  // EDGE CASE 2: Partial submission — Mom submitted, Dad didn't
  // → Dad has tiebreakerCount === 0 → treat Dad's avgDelta as Infinity
  // → Mom wins the tiebreaker (finite delta < Infinity)
  const avgA = a.tiebreakerCount > 0 ? a.tiebreakerDeltaTotal / a.tiebreakerCount : Infinity;
  const avgB = b.tiebreakerCount > 0 ? b.tiebreakerDeltaTotal / b.tiebreakerCount : Infinity;
  if (avgA !== avgB) return avgA - avgB;

  // Tertiary: tie stays (T-1st, T-2nd) — no further tiebreaker per D-05
  return 0;
}
```

**Codified rules in plain English:**
1. Member with no tiebreaker submission ever: `tiebreakerCount === 0`, `avgDelta = Infinity`. Loses tied positions to any member who has submitted.
2. Both members have no submissions: `avgDelta = Infinity = Infinity` → tie stays. Correct per D-05.
3. Both members have submissions with equal average delta: tie stays. Correct per D-05.
4. Partial submission (Mom yes, Dad no): Mom's `avgDelta` is finite; Dad's is `Infinity`. Mom wins. Correct per D-05 specification.

`tiebreakerActual` is the field `gameResultsTick` writes alongside `pointsAwarded` at settlement time — it records the actual total from the game (computed from `finalScore.homeScore + finalScore.awayScore` for US leagues, or league-specific equivalent for F1/UFC).

---

## Recommended File Plan

### New Files

| File | Purpose | Size Estimate |
|------|---------|---------------|
| `js/pickem.js` | Pure helpers: `slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `compareMembers`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS` | ~200 lines |
| `queuenight/functions/src/gameResultsTick.js` | Scheduled CF (every 5 min): iterates families → pending picks past gameStartTime → polls feedFetchScore → settles picks → updates leaderboard transactionally → fires pickResults push | ~180 lines |
| `queuenight/functions/src/pickReminderTick.js` | Scheduled CF (every 5 min, sibling to gameResultsTick): scans for `(memberId, gameId)` pairs at T-16min to T-14min with no pick → fires pickReminder push → writes idempotency doc | ~100 lines |
| `scripts/smoke-pickem.cjs` | 11th smoke contract: helper-behavior assertions (slateOf, latestGameInSlate, scorePick, summarizeMemberSeason, compareMembers edge cases) + production-code sentinels + cross-repo lockstep grep for 3 push keys | ~200 lines |

### Modified Files

| File | Change | Line Range (approx) |
|------|--------|---------------------|
| `js/sports-feed.js` | Add `season: ev.strSeason || fallback`, `round: ev.intRound`, `stage: ev.strStage` to `normalizeTsdEvent` return block | lines 76-97 (inside existing return) |
| `js/app.js` | Add `pickReminder: true, pickResults: true, pickemSeasonReset: true` to `DEFAULT_NOTIFICATION_PREFS` | line 366 (after `titleAvailable`) |
| `js/app.js` | Add label/hint entries to `NOTIFICATION_EVENT_LABELS` | line 415 (after `titleAvailable`) |
| `js/app.js` | Add import: `import { slateOf, latestGameInSlate, scorePick, PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS } from './pickem.js'` | top of file with other imports |
| `js/app.js` | Add `renderPickemSurface`, `renderPickerCard`, `renderLeaderboard`, `renderInlineWpPickRow`, `renderPastSeasonsArchive` render functions | new block after `renderSportsScoreStrip` (~line 10870+) |
| `js/app.js` | Extend live-wp modal (`renderWatchpartyLive`) to include inline pick row when `wp.mode === 'game'` | line ~12123 (after `renderSportsScoreStrip(wp)`) |
| `js/app.js` | Wire Tonight tab inline link to Pick'em surface entry (after existing `renderWatchpartyBanner`) | line ~12050 area |
| `css/app.css` | Append `.pe-*` class family (picker card, leaderboard, archive rows, picks-closed pill, tiebreaker input) | end of file (after current ~4654 lines) |
| `queuenight/functions/index.js` | Add `pickReminder: true, pickResults: true, pickemSeasonReset: true` to `NOTIFICATION_DEFAULTS` | line 115 (after `titleAvailable`) |
| `queuenight/functions/index.js` | Register `gameResultsTick` and `pickReminderTick` exports | end of exports block (~line 1644) |
| `firestore.rules` | Add `picks/{pickId}` rule block + `leaderboards/{leagueKey}/{strSeason}` rule block + `picks_reminders/{reminderId}` rule block under `families/{familyCode}` | after `watchparties/{wpId}` block (~line 610) |
| `scripts/deploy.sh` | Add `smoke-pickem.cjs` if-block after `smoke-guest-rsvp.cjs` block; update echo line (§2.5) | after line 124 |
| `package.json` | Add `smoke:pickem` entry + append to `smoke` aggregate chain | n/a |
| `sw.js` | Bump CACHE to `couch-v40-pickem` via `bash scripts/deploy.sh 40-pickem` | auto-bumped by deploy.sh |

**Note on `smoke-guest-rsvp.cjs`:** Deploy.sh at line 124-125 does NOT yet include the `smoke-guest-rsvp.cjs` block — the echo line at line 125 refers to 9 contracts (not 10). Phase 27 Plan 05 wired it into `package.json` but the `if-block` in `deploy.sh` may need to be added if it's missing. Verify before writing Phase 28's 11th block.

---

## Standard Stack

### Core (all existing — no new packages)

| Library/API | Version | Purpose | Location |
|-------------|---------|---------|---------|
| Firebase Firestore (client SDK) | existing | Pick reads/writes, real-time onSnapshot, leaderboard reads | `js/firebase.js` |
| Firebase Admin SDK (server) | existing | CF writes to picks (settle) + leaderboard (transaction) + idempotency docs | `queuenight/functions/` |
| firebase-functions v2 scheduler | existing | `gameResultsTick` + `pickReminderTick` scheduled CFs | `queuenight/functions/` |
| TheSportsDB API (free key `'1'`) | existing | `fetchScore` polling for `score.state === 'post'` settlement | `js/sports-feed.js` |
| web-push | existing | Push fan-out for `pickReminder` + `pickResults` | `queuenight/functions/src/rsvpReminderTick.js` |

No new npm packages required. Phase 28 is pure extension of existing infrastructure.

### Supporting (new JS module only)

| Module | Purpose |
|--------|---------|
| `js/pickem.js` (new, local) | Pure helper functions — imported by `js/app.js` and smoke contract |

---

## Architecture Patterns

### System Architecture Diagram

```
  [Family Member]
       |
       | tap pick chip
       v
  [Browser — js/app.js]
       |
       | renderPickemSurface() / renderPickerCard()
       | reads slateOf() from js/pickem.js
       |
       | Firestore client write (create/update)
       v
  [Firestore: families/{code}/picks/{pickId}]
       |    state='pending'
       |    gameStartTime (lock enforcement by rules)
       |
  [Rules Gate] ← request.time < resource.data.gameStartTime
       |        ← CF-only denylist: state/pointsAwarded/settledAt/tiebreakerDelta
       |
  [onSnapshot → other family members' browsers] ← D-10 real-time visibility
       |
       v
  [gameResultsTick CF] ← every 5 min (scheduled)
       |
       | polls feedFetchScore(gameId, leagueKey)
       | if score.state === 'post':
       |   scorePick(pick, finalGame) → pointsAwarded (1 or 0)
       |   tiebreakerDelta = |pick.tiebreakerTotal - actualTotal|
       |
       | db.runTransaction:
       |   pick.state = 'settled', pick.pointsAwarded, pick.settledAt
       |   leaderboard doc update (pointsTotal, picksSettled, tiebreakerDeltaTotal)
       v
  [Firestore: families/{code}/leaderboards/{leagueKey}/{strSeason}]
       |
       | (single cheap doc-read per render)
       v
  [Browser — renderLeaderboard()]
       |
       | compareMembers() → rank by pointsTotal, tiebreak by avgTiebreakerDelta
       v
  [Family Leaderboard UI]

  [pickReminderTick CF] ← every 5 min (scheduled)
       |
       | scan: games with gameStartTime in [T-16min, T-14min]
       | for each member without a pick on that game:
       |   check picks_reminders/{leagueKey}_{gameId}_{memberId} (idempotency)
       |   if not exists: write idempotency doc + send pickReminder push
       v
  [Member's device push: "Picks close in 15 min — make your pick."]
```

### Recommended Project Structure

```
js/
├── app.js              # (extended) renderPickemSurface, renderPickerCard,
│                       #   renderLeaderboard, renderInlineWpPickRow,
│                       #   renderPastSeasonsArchive + notification map extensions
├── pickem.js           # (NEW) pure helpers — slateOf, latestGameInSlate,
│                       #   scorePick, validatePickSelection,
│                       #   summarizeMemberSeason, compareMembers,
│                       #   PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS
└── sports-feed.js      # (modified) normalizeTsdEvent + season/round/stage fields

queuenight/functions/src/
├── gameResultsTick.js  # (NEW) settlement CF — per-family pick scan + score poll
│                       #   + transactional leaderboard update + pickResults push
├── pickReminderTick.js # (NEW) reminder CF — T-15min scan + push + idempotency
└── rsvpReminderTick.js # (existing Phase 27 — unchanged)

scripts/
└── smoke-pickem.cjs    # (NEW) 11th smoke contract

firestore.rules         # (extended) picks/{pickId} + leaderboards/{league}/{season}
                        #   + picks_reminders/{reminderId} rule blocks
```

### Pattern 1: Member-self-write with CF-only denylist (mirrors Phase 24 REVIEWS M2)

**What:** Firestore rule splits into two branches: client writes own picks with a field-level denylist blocking `state`/`pointsAwarded`/`settledAt`/`tiebreakerDelta`; CF admin SDK bypass handles settlement writes.

**When to use:** Any subcollection where the client creates records but a CF later augments them with trusted settlement data.

**Reference:** `firestore.rules:577-609` (Phase 24 watchparties Path A/B split) [VERIFIED]

### Pattern 2: Per-family pick iteration in CF (mirrors `watchpartyTick`)

**What:** `gameResultsTick` outer loop iterates `db.collection('families').get()`, inner loop iterates pending picks per family. Per-doc try/catch ensures one failure doesn't abort the entire tick.

**Reference:** `/c/Users/nahde/queuenight/functions/index.js:931-987` (watchpartyTick loop) [VERIFIED]

### Pattern 3: Transactional leaderboard update

**What:** `gameResultsTick` uses `db.runTransaction` to atomically read the current leaderboard doc, increment the relevant member's counters, and write back. Prevents double-counting if CF retries.

**Reference:** Phase 27 `rsvpSubmit.js` transactional `wp.guests[]` upsert pattern (confirmed in 27-05-SUMMARY.md).

### Pattern 4: Scheduled CF registration (mirrors `watchpartyTick` / `providerRefreshTick`)

**What:** Both `gameResultsTick` and `pickReminderTick` are registered in `queuenight/functions/index.js` using `onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', ... })`.

**Reference:** `index.js:931` (`watchpartyTick`) and `index.js:1340` (`providerRefreshTick`) [VERIFIED]

### Anti-Patterns to Avoid

- **Reading js/app.js in full at planning/execution time.** Use Grep + offset/limit. The file is now ~17,458 lines after Phase 27. [VERIFIED: STATE.md — Phase 27 ROADMAP 27-04-PLAN.md: "js/app.js 17297 → 17458 lines"]
- **Writing to `families/{code}/leaderboards/` from the client.** Leaderboard is CF-owned; client write path would enable score manipulation. Rule: `allow write: if false`.
- **Using collectionGroup query on `picks` without a Firestore index.** At v1 per-family iteration is safer (no index required) and equivalent in cost.
- **Storing tiebreaker delta on the pick doc at client-submit time.** Delta is only known after the game settles (actual total unknown until then). CF writes `tiebreakerActual` + `tiebreakerDelta` at settlement.
- **Mutating `pick.tiebreakerTotal` after gameStartTime.** The tiebreaker input is part of the pick — it locks at the same time as the selection.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Push fan-out for pickReminder/pickResults | Custom fan-out loop | `sendToMembers` helper (already exported from `queuenight/functions/index.js:1632`) | Already handles FCM subscription lookup, quiet-hours check, excludeUid, retry |
| Pick ID generation | Custom random string | `crypto.randomBytes(16).toString('base64url')` (Node built-in, same as Phase 27 guestId) | Proven URL-safe base64url format; 22-char string; already in production |
| Firestore transaction retries | Manual retry loop | `db.runTransaction()` (SDK handles retries with exponential backoff) | Firebase SDK handles contention automatically |
| TheSportsDB score polling | New HTTP layer | `feedFetchScore(gameId, leagueKey)` from `js/sports-feed.js` (already imports in CF via require) | 15s bucket cache already implemented; avoids rate-limit violations |
| Leaderboard aggregation from raw picks | Real-time aggregation on client | Pre-aggregated leaderboard doc updated by CF | Reading all picks per member per season on every render is O(N picks) and unbounded |

---

## Common Pitfalls

### Pitfall 1: `strSeason` null for some leagues / events

**What goes wrong:** `normalizeTsdEvent` returns `season: null` for events where TheSportsDB doesn't populate `strSeason`. Pick doc has `strSeason: null`. Leaderboard groups by `(leagueKey, null)` — all picks go into the same null-season doc regardless of actual year.

**Why it happens:** TheSportsDB free tier may omit `strSeason` on older events, pre-season games, or non-league tournaments (UCL qualifiers, F1 sprint races).

**How to avoid:** Use the fallback in `normalizeTsdEvent`: `season: ev.strSeason || String(new Date(startMs).getFullYear())`. Calendar-year fallback is always defined as long as `strTimestamp` is valid.

**Warning signs:** Multiple years' worth of picks appearing in one leaderboard doc; leaderboard `strSeason` showing `null`.

### Pitfall 2: gameResultsTick double-settling

**What goes wrong:** CF retries (Firebase auto-retry on timeout/error) cause `scorePick` to run twice on the same pick, awarding 2 points instead of 1.

**Why it happens:** CF execution timeout + Firebase retry policy.

**How to avoid:** `pick.state === 'settled'` check at the top of the settlement branch (before calling `scorePick`). The transaction atomically sets state='settled' so subsequent retries skip the doc. [VERIFIED: D-16 specifies this guard]

**Warning signs:** Member point totals higher than number of settled picks.

### Pitfall 3: Pick lock race condition (client submits just as gameStartTime passes)

**What goes wrong:** Member taps submit at T-0:01 before kick-off; network latency means the write arrives at Firestore 2 seconds after `gameStartTime`; Firestore rules reject the write. Client sees an error after a brief spinner.

**Why it happens:** Client clock vs Firestore server clock mismatch + network latency.

**How to avoid:** UI-SPEC already handles this with the "race condition" error copy: *"This pick locked while you were tapping. {OtherTeam} picked it for you? — no points awarded."* Implement by catching the Firestore PERMISSION_DENIED error code and rendering this specific message. The error is graceful and expected.

**Warning signs:** User sees a generic network error instead of the friendly lock message.

### Pitfall 4: `onSnapshot` listener leak on Pick'em surface

**What goes wrong:** User navigates away from Pick'em surface without unsubscribing the `picks` collection listener. Multiple ghost listeners accumulate; Firestore read costs grow linearly with navigation events.

**Why it happens:** `onSnapshot` returns an unsubscribe function that must be called on close. Phase 26 replay clock teardown (`closeWatchpartyLive` 4-new-clears pattern) is the established precedent.

**How to avoid:** Store unsubscribe function in `state.pickemPicksUnsubscribe`; call it in the surface's close/unmount function. Mirror Phase 26's `closeWatchpartyLive` pattern.

**Warning signs:** Increasing Firestore read counts in Firebase console during a session with repeated navigation.

### Pitfall 5: Cross-repo lockstep drift for 3-map notification keys

**What goes wrong:** Developer adds `pickReminder` to `DEFAULT_NOTIFICATION_PREFS` in `js/app.js` but forgets `NOTIFICATION_DEFAULTS` in `queuenight/functions/index.js`. Server silently defaults to `true` for unknown keys (per `index.js:304-305` logic), but client toggle UI won't match server behavior.

**Why it happens:** Two separate repositories, manual synchronization convention with no CI gate (per Phase 14 D-12 close-out notes).

**How to avoid:** The `smoke-pickem.cjs` cross-repo grep assertion (OQ-7) catches this at deploy time. The smoke gate blocks deploy if any of the 3 keys are missing from either repo. [VERIFIED: deploy.sh §2.5 smoke gate pattern]

**Warning signs:** `smoke-pickem.cjs` exits non-zero during deploy.

### Pitfall 6: F1 podium settlement — partial podium match

**What goes wrong:** Member predicts P1=Verstappen correctly but P2/P3 wrong. Settlement logic incorrectly awards 1 point for "getting P1 right."

**Why it happens:** `scorePick` implementation checks individual positions instead of requiring all three.

**How to avoid:** `scorePick` for `f1_podium` pickType: award 1 point ONLY when `pick.selection.p1 === finalGame.p1 AND pick.selection.p2 === finalGame.p2 AND pick.selection.p3 === finalGame.p3`. All three must match. (D-02 specifies this explicitly; smoke contract should include a test case for partial match → 0 points.)

### Pitfall 7: Leaderboard `missedCount` calculation

**What goes wrong:** UI shows "6 missed" but the number doesn't match what the family sees in their picks history.

**Why it happens:** `missedCount = picksTotal - picksSettled` but `auto_zeroed` picks should be visible as "missed" in the detail but are NOT in `picksSettled`. The formula must be `missedCount = picks with state='auto_zeroed'` (not just `picksTotal - picksSettled`, which would also include pending picks in-progress).

**How to avoid:** Track `missedCount` separately in `summarizeMemberSeason`: count picks with `state === 'auto_zeroed'`. Include this in the leaderboard doc as `picksAutoZeroed` alongside `picksSettled`. Render: `"32 pts · 32 of 51 settled · 6 missed"` where `6 = picksAutoZeroed`. (The UI-SPEC copy is locked: "N missed".)

---

## Validation Architecture

`workflow.nyquist_validation: true` (confirmed in `.planning/config.json`). This section is mandatory.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js native (`assert` module + manual ok/fail counters) — matches all existing smoke contracts |
| Config file | none (standalone `.cjs` files) |
| Quick run command | `node scripts/smoke-pickem.cjs` |
| Full suite command | `npm run smoke` (runs all 11 contracts) |
| Rules test command | `node tests/rules.test.js` (Firestore emulator) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PICK-28-01 | `normalizeTsdEvent` surfaces `season` field | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-02 | `js/pickem.js` exports all named helpers | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-05 | `slateOf` groups NFL Thursday games as separate slate | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-05 | `slateOf` groups NBA daily games correctly | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-05 | `latestGameInSlate` returns chronologically-last game | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-07 | Tiebreaker game = result of `latestGameInSlate` | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-09 | `scorePick` team_winner: correct → 1, incorrect → 0 | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-09 | `scorePick` team_winner_or_draw: draw correct → 1 | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-09 | `scorePick` f1_podium: all 3 correct → 1; partial → 0 | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-09 | `scorePick` ufc_winner_method: both correct → 1; fighter-only → 0 | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-20 | `compareMembers`: both no tiebreaker → tie | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-20 | `compareMembers`: partial submission → submitter wins tied positions | unit (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-17 | cross-repo lockstep: `pickReminder` in all 3 maps | sentinel (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-17 | cross-repo lockstep: `pickResults` in all 3 maps | sentinel (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-17 | cross-repo lockstep: `pickemSeasonReset` in all 3 maps | sentinel (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-10 | Firestore rules deny client pick write after gameStartTime | rules-test | `node tests/rules.test.js` | ❌ Wave 0 |
| PICK-28-10 | Firestore rules allow pick write before gameStartTime | rules-test | `node tests/rules.test.js` | ❌ Wave 0 |
| PICK-28-09 | Firestore rules deny client write of `state`/`pointsAwarded`/`settledAt` | rules-test | `node tests/rules.test.js` | ❌ Wave 0 |
| PICK-28-11 | Firestore rules deny client write to leaderboard doc | rules-test | `node tests/rules.test.js` | ❌ Wave 0 |
| PICK-28-23 | sw.js CACHE = 'couch-v40-pickem' | sentinel (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |
| PICK-28-21 | smoke floor meta-assertion: total ≥ 13 | meta (smoke) | `node scripts/smoke-pickem.cjs` | ❌ Wave 0 |

### Smoke-pickem.cjs Assertion List (target ≥ 13; aim for ~30)

The following assertion groups should appear in `scripts/smoke-pickem.cjs`:

**Group 1 — `slateOf` helper behavior** (~6 assertions)
1. NFL Thursday: single-game slate returns 1 game
2. NFL Sunday: multi-game slate groups all same-day games
3. NBA daily: all games on same UTC date grouped together
4. `slateOf` with empty games array → returns []
5. Soccer EPL: games with same `round` value grouped together
6. F1: single race in slate = that race only

**Group 2 — `latestGameInSlate` helper behavior** (~3 assertions)
7. Single-game slate: returns that game
8. Multi-game slate: returns game with max startTime
9. Empty slate: returns null/undefined (edge)

**Group 3 — `scorePick` per pickType** (~6 assertions)
10. `team_winner` correct → 1
11. `team_winner` incorrect → 0
12. `team_winner_or_draw` draw correct → 1
13. `f1_podium` all 3 correct → 1; partial (2/3) → 0
14. `ufc_winner_method` both correct → 1; fighter-only correct → 0
15. `scorePick` on `state !== 'pending'` game → 0 (safety)

**Group 4 — `compareMembers` tiebreaker edge cases** (~4 assertions)
16. Both members no tiebreaker submission → returns 0 (tie)
17. Mom submitted, Dad didn't → Mom wins (negative return value)
18. Both submitted, equal delta → returns 0 (tie)
19. Higher points member always wins regardless of tiebreaker

**Group 5 — `normalizeTsdEvent` season field** (~2 assertions)
20. `season` field present in return shape
21. `season` falls back to calendar year when `strSeason` is null

**Group 6 — Production-code sentinels** (~9 assertions)
22. `js/pickem.js` contains `export function slateOf`
23. `js/pickem.js` contains `export function scorePick`
24. `js/app.js` contains `pickReminder: true` (DEFAULT_NOTIFICATION_PREFS)
25. `js/app.js` contains `pickResults: true`
26. `js/app.js` contains `pickemSeasonReset: true`
27. Server `index.js` contains `pickReminder: true` (NOTIFICATION_DEFAULTS)
28. Server `index.js` contains `pickResults: true`
29. Server `index.js` contains `pickemSeasonReset: true`
30. `sw.js` contains `couch-v40-pickem`

**Group 7 — Floor meta-assertion** (1 assertion)
31. `passed >= 13` (fails deploy gate when total < 13)

### Sampling Rate

- **Per task commit:** `node scripts/smoke-pickem.cjs` (quick run, ~1s)
- **Per wave merge:** `npm run smoke` (full 11-contract suite, ~5s) + `node tests/rules.test.js` (Firestore emulator rules tests)
- **Phase gate:** Full suite green + rules tests pass before `/gsd-verify-work 28`

### Wave 0 Gaps

- [ ] `scripts/smoke-pickem.cjs` — covers PICK-28-01/02/05/07/09/10/17/20/21/23 (Groups 1-7 above)
- [ ] `tests/rules.test.js` additions — new Phase 28 describe block: 4 rules assertions (PICK-28-10 lock enforcement × 2, PICK-28-09 CF-only denylist, PICK-28-11 leaderboard client-write denial)
- [ ] `js/pickem.js` — Wave 0 creates this file so smoke can import and test it
- [ ] Framework install: `npm run smoke` already works (Node.js native, no new packages)

---

## Security Domain

`security_enforcement` is not explicitly set to false in config.json — enforcement is enabled.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Firebase Auth — existing `isMemberOfFamily` guard on all picks reads/writes |
| V3 Session Management | no | Pick'em is stateless; session managed by existing Firebase Auth tokens |
| V4 Access Control | yes | Member-self-write only; CF-only fields via denylist; leaderboard CF-write-only |
| V5 Input Validation | yes | `validatePickSelection(pick, game)` helper in `js/pickem.js` validates selection shape before write; Firestore rules validate `memberId` format via `.matches('^m_[A-Za-z0-9_-]+$')` (mirrors SEC-15-1-02 pattern) |
| V6 Cryptography | no | No cryptographic operations in Phase 28 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Member writes `state='settled'`/`pointsAwarded=10` directly | Tampering | CF-only field denylist in Firestore rules (OQ-3 recommendation) |
| Member writes picks after gameStartTime (score already known) | Tampering | Firestore rules lock: `request.time.toMillis() < resource.data.gameStartTime` |
| Member writes picks for another member (pick on someone else's behalf) | Tampering | `validAttribution(familyCode)` checks `actingUid == uid()` AND `memberId` regex match; UPDATE path checks `resource.data.memberId == request.resource.data.memberId` |
| Double-settling via CF retry | Tampering | `pick.state === 'settled'` short-circuit check + `db.runTransaction` atomicity |
| Guest accessing pick'em surface | Escalation | Phase 27 guests have no `uid` in `users/{uid}/groups/{familyCode}` — `isMemberOfFamily` returns false; all picks reads/writes denied |
| Pick reminder double-firing | Spoofing | `picks_reminders/{leagueKey}_{gameId}_{memberId}` idempotency doc; written before push attempt |
| Leaderboard client manipulation (write to leaderboard doc) | Tampering | `allow write: if false` on leaderboard collection; admin SDK bypass is the only write path |

---

## Risks / Landmines

### Risk 1: TheSportsDB free-tier `strSeason` null for some leagues

**Severity:** MEDIUM. The fallback (calendar year from startTime) is implemented in the recommended change, but it could silently produce incorrect season groupings for leagues that span calendar years (NBA, NHL, NCAAB). An NBA 2025-2026 game played in January 2026 would get `strSeason: '2026'` fallback, not `'2025-2026'`. **Mitigation:** Verify `strSeason` population for all 16 leagues by sampling one real event per league via `lookupevent.php` at Wave 0. If strSeason is reliably populated, the fallback is dead code. If it's unreliable for some leagues, use the split-year format as the canonical fallback for split-season leagues.

### Risk 2: TheSportsDB free-tier outages / rate limiting

**Severity:** LOW for pick submission (client-only, no TheSportsDB call needed). MEDIUM for `gameResultsTick` settlement (CF polls TheSportsDB for score.state). **Mitigation:** Settlement latency (hours after game ends) is acceptable per D-01. If TheSportsDB returns null/error for a specific game, `gameResultsTick` skips that pick and retries on the next 5-min tick. No data loss. **Monitoring:** Add `console.warn` for TheSportsDB null-score responses; Sentry will capture CF errors.

### Risk 3: Lockstep drift for 3-map notification keys

**Severity:** MEDIUM if undetected (push events silently fire against wrong server-gate state). **Mitigation:** `smoke-pickem.cjs` cross-repo grep assertions (OQ-7) catch this at deploy time. The smoke gate blocks deploy. Risk is LOW with the smoke gate in place.

### Risk 4: CF cost at scale (beyond v1)

**Severity:** LOW at v1 (2-5 families, ~$0 additional cost). MEDIUM at 100 families without per-league active-window gating. **Mitigation:** Comment-documented active-window gate in `gameResultsTick` for future activation. Code structure accommodates the gate as a simple `if` block around the per-league scan.

### Risk 5: Firestore picks sub-collection growing unboundedly

**Severity:** LOW for v1 (2-5 families, ~300 picks/season/league → ~150K docs total across all leagues). Firestore sub-collections have no practical size limit. **Monitoring:** Consider adding `picksTotal` to a family-level doc for dashboarding at Phase 30+ scale.

### Risk 6: `js/app.js` line count after Phase 28

**Severity:** LOW for functionality. HIGH for developer experience. Phase 28 adds ~500-700 new lines to `js/app.js` (5 render functions + notification map extensions + event wiring). After Phase 27's growth to 17,458 lines, Phase 28 pushes to ~18,000-18,200 lines. [ASSUMED — line count estimate]. The CLAUDE.md ⚠ token cost warning still applies: always Grep + offset/limit, never read in full.

### Risk 7: F1/UFC driver/fighter names from TheSportsDB free tier

**Severity:** MEDIUM. The `f1_podium` picker needs a driver list to populate the P1/P2/P3 dropdown selectors. TheSportsDB may or may not expose the race entry list (starting grid) on the free tier. **Mitigation:** Use `fetchSchedule(f1, daysAhead)` to get the race event; the event names may include driver names in `strHomeTeam`/`strAwayTeam` fields (used for head-to-head F1 events) [ASSUMED — F1 data format in TheSportsDB varies]. If driver list is not available via free tier, fall back to a free-text input for P1/P2/P3 (member types in the driver name). This degrades the UX but doesn't block the pick. **Action item for Wave 0:** Curl `lookupevent.php?id=<F1RaceId>` to verify driver data availability.

### Risk 8: Deploy.sh `smoke-guest-rsvp.cjs` if-block missing

**Severity:** LOW. As noted in the file plan, the `deploy.sh` echo line at line 125 lists 9 contracts but `smoke-guest-rsvp.cjs` may not have its own `if-block` in the file (the echo is ahead of that block). [VERIFIED: deploy.sh lines 116-125 — the if-blocks for existing contracts are present but the guest-rsvp one was added in Phase 27 Plan 05 and may need verification]. Planner should verify the deploy.sh has 10 if-blocks (not 9) before adding the 11th for smoke-pickem.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | TheSportsDB `strSeason` field populated for all 16 leagues on free tier | OQ-1 | Season grouping silently broken for leagues that return null; fallback partially mitigates |
| A2 | TheSportsDB returns `intRound` for EPL/La Liga/Bundesliga/Serie A/Ligue 1/MLS events on free tier | OQ-2 slateOf soccer | Soccer slates fall back to calendar-day grouping (same-day games only, not full matchday round) |
| A3 | TheSportsDB returns `strStage` for UCL events on free tier | OQ-2 slateOf UCL | UCL slates fall back to calendar-day grouping |
| A4 | F1 tiebreaker total = sum of P1/P2/P3 finishing position numbers | OQ-2 F1 | Tiebreaker semantics unclear to users; may need to switch to total race laps or another metric |
| A5 | UFC tiebreaker total = total rounds fought across the event card | OQ-2 UFC | Tiebreaker semantics unclear; total rounds may not be easily derivable from TheSportsDB free tier |
| A6 | TheSportsDB free tier provides F1 driver names / starting grid for the `f1_podium` picker | Risk 7 | Dropdown falls back to free-text input, degrading UX |
| A7 | `js/app.js` line count after Phase 27 = ~17,458 (from STATE.md 27-04-PLAN.md note) | File Plan | If significantly higher, token budget guidance needs updating |
| A8 | Firestore 1MB document limit is a well-documented constraint | OQ-6 | No risk — 1MB is a Firestore platform invariant; leaderboard doc is well under |
| A9 | `deploy.sh` has a smoke-guest-rsvp.cjs if-block already wired (Phase 27 Plan 05) | Risk 8 | Phase 28's 11th block would be the 10th if Phase 27's wasn't added; echo line would be wrong |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | smoke-pickem.cjs | ✓ | (existing — all smoke contracts run) | — |
| Firebase Admin SDK | gameResultsTick, pickReminderTick CFs | ✓ | (existing in queuenight/functions/) | — |
| TheSportsDB free API | gameResultsTick settlement, score polling | ✓ (HTTP) | free key '1' | Retry next tick |
| web-push | pickReminderTick, gameResultsTick push fan-out | ✓ | (existing in queuenight/functions/) | — |
| Firestore emulator (rules tests) | tests/rules.test.js Phase 28 additions | ✓ | (existing — 52 rules tests pass) | — |
| queuenight sibling repo | Cross-repo lockstep smoke assertions | ✓ | present at `/c/Users/nahde/queuenight/` [VERIFIED: directory listed] | Skip assertions with warning if absent |

---

## Open Questions Resolved

All 8 open questions from CONTEXT.md are answered above. No blockers remain for planning.

---

## Sources

### Primary (HIGH confidence — direct file reads in this session)

- `js/sports-feed.js` (entire file, 192 lines) — normalizeTsdEvent shape, LEAGUES catalog, fetching patterns [VERIFIED]
- `js/app.js:328-416` — DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS maps [VERIFIED]
- `js/app.js:10534-10565` — SportsDataProvider shape [VERIFIED]
- `js/app.js:10574-10582` — openGamePicker entry point [VERIFIED]
- `js/app.js:12326-12350` — teamColor/teamFlair chip render pattern [VERIFIED]
- `/c/Users/nahde/queuenight/functions/index.js:74-116` — NOTIFICATION_DEFAULTS server map [VERIFIED]
- `/c/Users/nahde/queuenight/functions/index.js:931-987` — watchpartyTick pattern [VERIFIED]
- `/c/Users/nahde/queuenight/functions/index.js:1340+` — providerRefreshTick + exports block [VERIFIED]
- `firestore.rules` (entire file, ~640 lines) — all rule patterns, isMemberOfFamily, Phase 24 Path A/B split, Phase 27 admin SDK bypass note [VERIFIED]
- `scripts/deploy.sh:83-125` — smoke gate §2.5 pattern [VERIFIED]
- `scripts/smoke-guest-rsvp.cjs:1-60` — smoke contract structure, assertion pattern, floor meta-assertion [VERIFIED]
- `/c/Users/nahde/queuenight/functions/src/rsvpReminderTick.js:1-50` — WINDOWS idempotency pattern [VERIFIED]
- `.planning/config.json` — nyquist_validation: true, commit_docs: true [VERIFIED]
- `.planning/STATE.md` — js/app.js line count history, deploy rituals [VERIFIED]
- `28-CONTEXT.md` — 16 locked decisions, 8 open questions [VERIFIED]
- `28-UI-SPEC.md` — surface map, component reuse, typography, color, motion [VERIFIED]
- `.planning/phases/22-sports-feed-abstraction/22-SUMMARY.md` — League catalog, normalizeTsdEvent shape [VERIFIED]
- `.planning/phases/23-live-scoreboard/23-SUMMARY.md` — Game Mode pipeline, wp.sportEvent [VERIFIED]
- `.planning/phases/27-guest-rsvp/27-CONTEXT.md` — 3-map lockstep pattern, cross-repo deploy ritual [VERIFIED]

### Tertiary (ASSUMED — training knowledge, not verified in this session)

- TheSportsDB `strSeason` field population per league (A1-A3)
- F1 tiebreaker semantics from TheSportsDB data shape (A4, A6)
- UFC tiebreaker total computation from TheSportsDB data (A5)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified as existing in project
- Architecture: HIGH — patterns verified against Phase 24/26/27 precedents
- Pitfalls: HIGH — all rooted in direct codebase evidence
- OQ answers: HIGH for OQ-1/3/4/5/6/7/8 (direct code evidence); MEDIUM for OQ-2 (F1/UFC specifics are ASSUMED)

**Research date:** 2026-05-02
**Valid until:** 2026-06-02 (stable stack; TheSportsDB API shape could shift but unlikely)

---

## RESEARCH COMPLETE

**Phase:** 28 - Social pick'em + leaderboards
**Confidence:** HIGH

### Key Findings

- `normalizeTsdEvent` needs one additive return field (`season: ev.strSeason || fallback`) + two soccer-specific fields (`round`, `stage`); all changes are backwards-compatible with existing callers.
- Firestore rules pattern for `picks/{pickId}` mirrors Phase 24 REVIEWS M2 Path B denylist approach; leaderboard collection is CF-write-only (admin SDK bypass, `allow write: if false` for clients).
- `gameResultsTick` should iterate per-family (mirrors `watchpartyTick`) at v1 scale; collectionGroup index not needed; per-league active-window gate documented as a future optimization.
- `pickReminderTick` uses a dedicated `picks_reminders/{leagueKey}_{gameId}_{memberId}` idempotency collection (not nested on a potentially-absent pick doc) — closer to Phase 27 `wp.reminders` spirit but cleaner for the "member hasn't picked yet" case.
- Leaderboard doc is trivially small even for extreme NFL season (570 bytes for 10 members) — no size risk.
- `smoke-pickem.cjs` cross-repo lockstep grep (OQ-7) is the primary automated safeguard against 3-map drift; planner must wire it into deploy.sh §2.5 as the 11th if-block.
- F1/UFC tiebreaker semantics and driver/fighter name availability from TheSportsDB free tier are ASSUMED — Wave 0 should curl-verify one live event per sport before implementing the picker variant UI.

### File Created

`C:\Users\nahde\claude-projects\couch\.planning\phases\28-social-pickem-leaderboards\28-RESEARCH.md`

### Confidence Assessment

| Area | Level | Reason |
|------|-------|--------|
| Standard Stack | HIGH | All libraries verified as existing in project; no new packages |
| Architecture | HIGH | Patterns traced directly to Phase 22/24/26/27 precedents in code |
| Firestore Rules | HIGH | Phase 24 REVIEWS M2 and Phase 27 admin SDK bypass both verified |
| Pitfalls | HIGH | All rooted in direct codebase evidence |
| OQ-2 F1/UFC slate semantics | MEDIUM | TheSportsDB free-tier data shapes assumed; verify at Wave 0 |
| OQ-1 strSeason coverage | MEDIUM | Known to be present on many events but null-return risk assumed |

### Open Questions Remaining (minor, Wave 0 verification items)

1. Curl-verify `lookupevent.php?id=<F1RaceId>` and `lookupevent.php?id=<UFCEventId>` to confirm driver/fighter names and tiebreaker data fields available on free tier.
2. Curl-verify `eventsday.php?d=<matchday>&l=<EPLLabel>` to confirm `intRound` is populated on domestic soccer events.
3. Confirm `deploy.sh` has 10 if-blocks (smoke-guest-rsvp.cjs was the 10th from Phase 27 Plan 05) before adding the 11th for smoke-pickem.

### Ready for Planning

Research complete. Planner can now create PLAN.md files for Phase 28.
