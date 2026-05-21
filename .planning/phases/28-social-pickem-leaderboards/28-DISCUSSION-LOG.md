# Phase 28: Social pick'em + leaderboards — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `28-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 28-social-pickem-leaderboards
**Areas discussed:** League scope at v2 launch, Surface entry + participation model, Pick types + scoring + tiebreakers, Pick lock timing + season boundaries

---

## Area 1 — League scope at v2 launch

### Q1.1: Which leagues should pick'em support at v2 launch?

| Option | Description | Selected |
|--------|-------------|----------|
| US-major 4 only (Recommended) | NBA / NFL / MLB / NHL only. Cleanest pick'em UX (winner / spread / total) — same shape across all 4. | |
| US-major 7 | Above + WNBA + NCAAF + NCAAB. Covers college football Saturdays which families care about more than Premier League. | |
| All 16 leagues | Whatever Phase 22's sports-feed.js catalog covers. Means handling soccer draws, F1 podium, UFC method-of-victory. | ✓ |
| All 16 + per-family toggle | All 16 enabled by default; family settings has multi-select to hide irrelevant ones. | |

**User's choice:** All 16 leagues.

### Q1.2: Should pick'em be always-available on sports watchparties, or require a family-level toggle?

| Option | Description | Selected |
|--------|-------------|----------|
| Always on (Recommended) | Whenever `wp.mode === 'game'` exists, surface available pre-tip-off. | ✓ |
| Family-level opt-in | One `family.pickemEnabled` toggle in settings. | |
| Per-member opt-in | Each member toggles whether they want pick'em. | |

**User's choice:** Always on (Recommended).

### Q1.3: TheSportsDB free key vs Patreon $14/yr — does pick'em ship on free or block on paid?

| Option | Description | Selected |
|--------|-------------|----------|
| Launch on free key (Recommended) | Pick settlement runs async; latency irrelevant for season leaderboard. Patreon stays a single-line bump. | ✓ |
| Block on Patreon $14/yr | Wait for user to subscribe before launching pick'em. Adds 1+ week delay. | |

**User's choice:** Launch on free key (Recommended).

### Q1.4: All 16 leagues is bold — do non-team sports (F1 podium, UFC method) get a pick'em UX too?

| Option | Description | Selected |
|--------|-------------|----------|
| Team sports only get pick'em | All 14 team-sport leagues get pick'em; F1/UFC keep watchparty chrome but show "Pick'em not available". | |
| Polymorphic schema (Recommended for 16) | `pickType` discriminator: team_winner / team_winner_or_draw / f1_podium / ufc_winner_method. | ✓ |
| Winner-only across all 16 | Even F1/UFC with full driver/fighter list. F1 picks become luck-of-the-draw. | |

**User's choice:** Polymorphic schema (Recommended for 16).

### Q1.5: For leagues with calendar-spanning seasons, does the leaderboard tag picks with TheSportsDB strSeason or family picks a season window manually?

| Option | Description | Selected |
|--------|-------------|----------|
| Use TheSportsDB strSeason (Recommended) | Auto-correct across calendar boundaries; no user config. | ✓ |
| Family picks a window manually | Family settings has manual "Pick'em season runs from X to Y". | |

**User's choice:** Use TheSportsDB strSeason (Recommended).

**Notes:** `normalizeTsdEvent` in `js/sports-feed.js:65-98` does NOT currently surface `strSeason` — small additive change required at planning time.

---

## Area 2 — Surface entry + participation model

### Q2.1: Where should the pick'em surface live in the app?

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone Pick'em tab (Recommended) | New top-nav tab; lists upcoming games for enabled leagues. Picks live in `families/{code}/picks/{pickId}`. | ✓ |
| Bolt-on inside openGamePicker | Toggle 'Make this a pick'em' on wp creation. Picks live as `wp.picks[]` array. | |
| Live in the wp modal pre-tip-off | Picker renders inside active watchparty modal during pre-game window. | |
| Standalone tab AND wp integration | Both. | |

**User's choice:** Standalone Pick'em tab (Recommended).

### Q2.2: Who can submit picks for a game?

| Option | Description | Selected |
|--------|-------------|----------|
| Family members only (Recommended) | Active family members with an `m.id`. Guests cannot pick. | ✓ |
| Members + guests (per wp) | Phase 27 guests can pick within the wp they RSVP'd to (using guestId). | |
| Members only + 'pick on behalf of' for kids | Parent member can submit picks on behalf of a child member. | |

**User's choice:** Family members only (Recommended).

### Q2.3: Should the picker pre-fill from `participants[mid].teamAllegiance` (Phase 11)?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft pre-fill, member can override (Recommended) | Pre-select team with italic-serif "Lakers — your pick from your team commitment. Tap to change." | ✓ |
| No pre-fill | Picker starts empty. | |
| Hard pre-fill, member must explicitly change | Treats teamAllegiance as the pick unless explicitly changed. | |

**User's choice:** Soft pre-fill, member can override (Recommended).

### Q2.4: Pick visibility before lock — sealed-bid or visible to other family members?

| Option | Description | Selected |
|--------|-------------|----------|
| Visible to family in real-time (Recommended) | All family members see each other's picks the moment submitted. Drives the social part. | ✓ |
| Sealed-bid until lock | Picks hidden from other members until lock time, then revealed simultaneously. | |
| Sealed-bid with optional reveal | Default sealed; member can tap 'reveal my pick'. | |

**User's choice:** Visible to family in real-time (Recommended).

---

## Area 3 — Pick types + scoring + tiebreakers

### Q3.1: What pick types are in scope for v2 launch?

| Option | Description | Selected |
|--------|-------------|----------|
| Winner only (Recommended for v2) | Per game: pick the winner (with polymorphic per-pickType variants). One field per pick. | ✓ |
| Winner + spread | Adds 'pick the spread'. Spread auto-fetched? Or manually entered? Adds external-API dependency. | |
| Winner + total score | Pick winner + numeric total prediction. Total fed to tiebreaker. | |
| Polymorphic per pickType (full) | team_winner / team_winner_or_draw / f1_podium / ufc_winner_method bespoke UI + scoring per type. | |

**User's choice:** Winner only (Recommended for v2).

### Q3.2: Scoring — how many points per correctly-settled pick?

| Option | Description | Selected |
|--------|-------------|----------|
| 1 point per correct pick (Recommended) | Flat 1pt per right call across all pick types and leagues. Cleanest mental model. | ✓ |
| Weighted by pickType | Winner = 1pt, spread = 2pt, F1 podium = 5pt, UFC method = 3pt. Rewards harder picks more. | |
| Confidence pool (multi-game slates) | Member ranks picks 1-N for higher confidence = more points. NFL Sundays / NCAAF Saturdays only. | |

**User's choice:** 1 point per correct pick (Recommended).

### Q3.3: Tiebreaker rule when two members tied at season-end?

| Option | Description | Selected |
|--------|-------------|----------|
| Earliest pick wins (Recommended) | Member who submitted picks earliest wins ties. Captured via `pick.submittedAt`. | |
| Closest-to-total on tiebreaker game | Family designates one game per week as 'tiebreaker'; closest-to-total wins ties. Requires 'total' pick type in scope. | ✓ |
| No tiebreaker (ties stay ties) | Leaderboard renders 'T-1st: Mom & Dad'. | |
| Most picks made (engagement tiebreak) | Tied? Member who submitted MORE total picks across season wins. | |

**User's choice:** Closest-to-total on tiebreaker game.

**Notes:** Initially conflicted with Q3.1 ("Winner only" pick type). Resolved in Q3.5 below.

### Q3.4: How should a missed pick (no submission before lock) be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-zero, no penalty (Recommended) | No pick = 0 points. Member's pick rate naturally tracks engagement. | |
| Push reminder at T-15min, then auto-zero | Send push at T-15 to anyone who hasn't picked, then auto-zero at lock. Adds `pickReminder` event to all 3 notification maps. | ✓ |
| Auto-pick from teamAllegiance if set | Auto-submit the teamAllegiance pick at T-1min before lock. | |

**User's choice:** Push reminder at T-15min, then auto-zero.

### Q3.5: Reconcile 'winner only' (Q3.1) with 'closest-to-total tiebreaker' (Q3.3)?

| Option | Description | Selected |
|--------|-------------|----------|
| Add tiebreaker-total field on one designated game per slate (Recommended) | Picks stay winner-only for ALL games. ONE designated tiebreaker game gets ONE extra numeric field. Schema adds `pick.tiebreakerTotal`. | ✓ |
| Switch tiebreaker to 'Earliest pick wins' | Drop closest-to-total; use earliest-pick-wins. No schema change. | |
| Switch pick type to 'Winner + total score' | Every pick on every game requires winner + total prediction. Bigger picker surface. | |
| Cascade to no-tiebreaker (ties stay ties) | Drop the tiebreaker entirely. | |

**User's choice:** Add tiebreaker-total field on one designated game per slate (Recommended).

### Q3.6: How should the tiebreaker game be designated each slate?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-pick: latest game of the slate (Recommended) | Chronologically-last game in the slate auto-designated. Zero family config. | ✓ |
| Family settings picker per league | Family settings has 'Tiebreaker game pattern' per league. | |
| Picker prompts host at slate-creation time | When the picker shows the slate, host taps to mark one game as 'tiebreaker'. | |

**User's choice:** Auto-pick: latest game of the slate (Recommended).

---

## Area 4 — Pick lock timing + season boundaries

### Q4.1: When should picks lock for a given game?

| Option | Description | Selected |
|--------|-------------|----------|
| At kickoff (game.startTime) (Recommended) | Picks lock at exact game start time. Lock enforced via Firestore rules: `request.time < gameStartTime`. | ✓ |
| T-30min before kickoff | 30 min lock before game start. Standard for NFL Sunday cluster. Requires per-league lockOffsetMs config. | |
| Configurable per league | Family settings has `pickemLockOffsetMs` per league. | |
| T-30min for first game, then per-game at kickoff | Cluster slates lock together at T-30min before first game. Standalone games at own kickoff. | |

**User's choice:** At kickoff (game.startTime) (Recommended).

### Q4.2: Season boundary handling — how does the leaderboard transition between seasons?

| Option | Description | Selected |
|--------|-------------|----------|
| Hard reset, snapshot to history (Recommended) | New season = snapshot to `families/{code}/leaderboards/{leagueKey}/{strSeason}`; live board resets to 0/0. | ✓ |
| Carry across years (cumulative all-time board) | No reset; accumulates forever. "Mom is 412-298 lifetime in NFL". | |
| Hard reset + cumulative all-time view | Both. | |
| Family chooses at season-end (prompt) | One-tap 'reset for next season?' prompt. | |

**User's choice:** Hard reset, snapshot to history (Recommended).

### Q4.3: Mid-season join — how does a family that enables pick'em halfway through a season start?

| Option | Description | Selected |
|--------|-------------|----------|
| Forward-only, start at 0/0 (Recommended) | Family starts at 0 picks / 0 wins from first pick. Past games not in record. | ✓ |
| Backfill prompt for past games | Family shown all past games, prompted to retroactively pick. | |
| Pro-rate / scale to season completion | Win rate as percentage rather than absolute count. | |

**User's choice:** Forward-only, start at 0/0 (Recommended).

### Q4.4: Pre-launch family setup moment for pick'em, or just-works at first pick?

| Option | Description | Selected |
|--------|-------------|----------|
| Zero-config onboarding (Recommended) | Pick'em starts working at first pick. No settings, no setup modal. Defaults: hard reset, latest-game tiebreaker, all 16 leagues. | ✓ |
| One-tap onboarding modal on first visit | First Pick'em tab visit shows 3-question modal. Defaults to recommendations. | |
| Settings page for advanced config (no required setup) | Zero-config to start, BUT settings panel with all knobs available. | |

**User's choice:** Zero-config onboarding (Recommended).

---

## Claude's Discretion

Areas where the user explicitly deferred to Claude or where the planner has flexibility:

- **Picker card layout** (D-Discretion in CONTEXT.md) — exact field positions on small screens, iconography, hover states.
- **Pick'em tab nav placement** — top-nav vs sub-surface. Researcher checks app.html tab structure.
- **Empty state copy** — BRAND voice. Planner drafts.
- **Leaderboard chrome** — color-by-rank? Trophy icon? Streak callouts? Within BRAND restraint.
- **Slate definition for F1 + UFC** — concrete logic deferred to researcher / planner.
- **Picker pre-fill animation** — subtle highlight then fade? Planner discretion.
- **`pickReminder` snooze action** — Web Push action buttons. Nice-to-have.
- **Live-wp inline pick row visibility threshold** — show only when 2+ members picked vs always.
- **`gameResultsTick` scheduling** — global 5-min vs per-league active-window. Planner / researcher decides.

## Deferred Ideas

Ideas mentioned during discussion that were noted for future phases:

- Spread picks (Phase 28.x or v3 — needs Vegas-line API)
- Exact-score / total-score picks for non-tiebreaker games
- Confidence pool scoring (multi-game slates)
- F1 podium bonus / UFC method bonus scoring
- Cross-family / public leaderboard (Out-of-Scope per PROJECT.md)
- Guest picks (Phase 27 wp.guests[] participation in pick'em)
- Backfill picks for past games (cheating vector)
- Manual settle / score-override admin UI
- Live-leaderboard sub-minute updates (TheSportsDB Patreon $14/yr)
- Pick'em settings panel (per-league enable, custom tiebreaker, push prefs)
- "Parent picks on behalf of kid" pattern (Phase 14 parent-approval mirror)
- Push action buttons on `pickReminder`
- Streak / milestone badges

## Open Questions for Researcher (8)

(See `28-CONTEXT.md § Open questions for researcher` for full detail.)

1. TheSportsDB `strSeason` consistency across all 16 leagues
2. Slate definition per league (especially F1 race-weekend + UFC event-card semantics)
3. Firestore rules pattern for `families/{code}/picks/{pickId}` member-self-write + lock-time check + CF-only fields
4. `gameResultsTick` scheduling cost vs cadence
5. `pickReminder` push idempotency window pattern
6. `families/{code}/leaderboards/{leagueKey}/{strSeason}` doc-size budget worst-case
7. Cross-repo lockstep verification for the 3-map notification stack (smoke assertion)
8. Tiebreaker arithmetic edge cases (no-submission / partial-submission)

---

*Discussion completed: 2026-05-02*
