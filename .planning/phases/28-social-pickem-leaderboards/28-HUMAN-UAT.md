---
phase: 28-social-pickem-leaderboards
type: human-uat-scripts
created: 2026-05-05
status: pending
deploy_cache: couch-v47-pickem
resume_signal: "uat passed"
---

# Phase 28 — Social Pick'em + Leaderboards — Device UAT

> Real-device verification scripts for the Phase 28 production deploy `couch-v47-pickem`.
> Resume signal after pass: reply `uat passed` in the chat to trigger `/gsd-verify-work 28`.

## Pre-flight

- Device A: iOS Safari (PWA installed via Add to Home Screen)
- Device B: Android Chrome (PWA installed)
- Family: at least 2 active members signed in across the two devices
- Optional: at least 1 active `wp.mode === 'game'` watchparty for Scripts 5 + 7 + 10
- Cache check from any device: `curl -s https://couchtonight.app/sw.js | grep CACHE`
  Expected: `const CACHE = 'couch-v47-pickem';`
- Confirm the 2 Phase 28 Cloud Functions are deployed via Firebase Console scheduler page:
  - `firebase-schedule-gameResultsTick-us-central1` exists with 5-minute cadence
  - `firebase-schedule-pickReminderTick-us-central1` exists with 5-minute cadence
- Confirm both composite indexes are in `READY` state via `firebase firestore:indexes --pretty --project queuenight-84044`:
  - `(watchparties) -- (mode,ASCENDING) (hostFamilyCode,ASCENDING)`
  - `(picks) -- (state,ASCENDING) (gameStartTime,ASCENDING)`
- On each test device, fully close the PWA and re-open so the new service worker activates and serves `couch-v47-pickem`.
- D-17 update 2 lock context: UFC pickType is intentionally absent in v1. Script 11 verifies this is honored end-to-end as a deliberate scope choice — NOT a bug.

## Scripts

### Script 1: Pick'em discoverability from Tonight tab (PICK-28-03)

**Goal:** Verify the Pick'em sub-surface is reachable in ≤2 taps from the Tonight tab inline link.

**Setup:**
- Device A: iOS Safari PWA, signed in.
- Pre-state: at least one `wp.mode === 'game'` watchparty exists with games in the upcoming slate (any of the 15 supported leagues — UFC excluded per D-17 update 2).

**Steps:**
1. Open the app on Device A. Land on the Tonight tab.
2. Verify the inline `Open pick'em →` link renders inside the `#pe-tonight-link-container` block when an upcoming slate is detected. Copy reads exactly `Open pick'em →` (Fraunces, brand-voice).
3. Tap the inline link.
4. Verify the `#screen-pickem` sub-surface opens.
5. Verify the surface lists upcoming games per league with one picker card per game.

**Pass criteria:**
- Tonight inline link present and tappable.
- Tap navigates to `#screen-pickem` in <1s.
- Picker cards render for upcoming games in each available league.
- The 15 league filter excludes UFC at render time (no UFC card visible — see Script 11).

**Decision reference:** D-17 update 2 (UFC drop), CONTEXT D-04 (kickoff lock).

---

### Script 2: team_winner picker variant (PICK-28-04)

**Goal:** Verify the `team_winner` picker variant renders correctly and submits a valid pick for an NBA / NFL / MLB / NHL / WNBA / NCAAF / NCAAB game.

**Setup:**
- Device A: signed in.
- Pre-state: at least one upcoming team-sport game with kickoff > now in the slate.

**Steps:**
1. Open Pick'em from Tonight (per Script 1).
2. Locate a team-sport game card (e.g. NBA, NFL).
3. Verify the picker shows two team chips — `Home` team + `Away` team — both tappable.
4. Tap the home team chip.
5. Verify a tactile hover/tap feedback (`--good` accent or chip activation).
6. Tap **Submit pick** (or whatever submit affordance the picker exposes).
7. Verify a confirmation toast renders.
8. Re-open the same picker; verify the chosen team chip shows in the persisted state.

**Pass criteria:**
- Two team chips render with full team names + abbreviations.
- Selection persists across modal close/reopen.
- Submit succeeds; pick doc lands at `/families/{code}/picks/{pickId}` with `pickType: 'team_winner'` + `selection.winningTeam: 'home' | 'away'` + `state: 'pending'`.
- No console error.

**Decision reference:** D-02 (polymorphic pickType), HIGH-1 rules-lock (state == 'pending' on create).

---

### Script 3: team_winner_or_draw picker variant including draw chip (PICK-28-04)

**Goal:** Verify the soccer picker variant renders THREE chips (home / away / draw) for EPL / La Liga / Bundesliga / Serie A / Ligue 1 / UCL / MLS games.

**Setup:**
- Device A: signed in.
- Pre-state: at least one upcoming soccer-league game.

**Steps:**
1. Open Pick'em.
2. Locate a soccer game card.
3. Verify THREE chips render: home team / away team / `Draw`.
4. Tap the `Draw` chip.
5. Verify the chip activates.
6. Submit the pick.

**Pass criteria:**
- Three chips render with the `Draw` chip rendering with neutral / `--ink-warm` styling distinct from team chips.
- Submit succeeds; pick doc has `pickType: 'team_winner_or_draw'` + `selection.result: 'draw'` + `state: 'pending'`.
- No console error.

**Decision reference:** D-02 selection shape `team_winner_or_draw`.

---

### Script 4: f1_podium picker with Jolpica roster + fail-soft (PICK-28-05 + D-17 update 2)

**Goal:** Verify the F1 picker fetches the 22-driver roster from Jolpica AND fails-soft when Jolpica is unreachable.

**Setup (happy path):**
- Device A: signed in, online with full network.
- Pre-state: at least one upcoming F1 race in the slate (round number + 2026 season).

**Steps (happy path):**
1. Open Pick'em.
2. Locate the F1 race card.
3. Verify three dropdowns / picker rows render: `P1`, `P2`, `P3`.
4. Tap each dropdown. Verify each shows ~22 drivers fetched from `https://api.jolpi.ca/ergast/f1/2026/{round}/drivers/` rendered as `givenName + " " + familyName` (e.g. `Max Verstappen`, `Lewis Hamilton`).
5. Pick three drivers (one per position).
6. Submit the pick.
7. Verify the pick doc has `pickType: 'f1_podium'` + `selection: { p1, p2, p3 }`.

**Steps (fail-soft):**
1. Put Device A in airplane mode.
2. Open the F1 race card.
3. Verify the picker renders the empty-state copy: `Race entry list unavailable; check back later.`
4. Verify other leagues' picker cards (NBA, EPL, etc.) STILL work — only F1 falls back.

**Pass criteria:**
- Happy path: 22 drivers in each P1/P2/P3 dropdown; pick submits.
- Fail-soft: F1 card shows `Race entry list unavailable; check back later.` copy verbatim.
- Other leagues unaffected by Jolpica outage.
- No console crash; just a graceful empty state.

**Decision reference:** D-17 update 2 (Jolpica adoption — free, no key, verified 2026-05-04). CONTEXT D-02 (`f1_podium` selection shape).

---

### Script 5: D-09 soft pre-fill from teamAllegiance — live wp surface (PICK-28-07)

**Goal:** Verify the D-09 soft pre-fill renders the brand-voice sub-line when the user has a `participants[mid].teamAllegiance` set within an active wp.

**Setup:**
- Device A: signed in.
- Pre-state: an active `wp.mode === 'game'` watchparty where the user has `wp.participants[me.id].teamAllegiance = 'Lakers'` (or any team) AND the wp's `sportEvent` references a game involving that team.

**Steps:**
1. Open the wp live modal.
2. Locate the inline pick row inside the wp.
3. Verify the picker auto-pre-fills the user's team chip with a `prefilled` styling (visible in `.pe-chip.prefilled` class).
4. Verify the brand-voice sub-line renders below the chip, copy reads exactly: `{Team} — your pick from your team commitment. Tap to change.` with `{Team}` replaced (e.g. `Lakers — your pick from your team commitment. Tap to change.`)
5. Tap the OTHER team's chip to override.
6. Verify the pre-filled styling clears and the sub-line is removed (override succeeded; selection now matches the new tap).

**Pass criteria:**
- Pre-fill chip is visually distinct (`.pe-chip.prefilled` styling — typically `--accent` ring or fill).
- Sub-line renders with team name + brand-voice copy verbatim.
- Tap-to-override works without re-render flicker.
- D-09 negative test: standalone Pick'em surface (NOT inside a wp) does NOT pre-fill from any global teamAllegiance — REVIEWS Amendment 11 / MEDIUM-7 verified (no `state.me.teamAllegiance` reference exists in the codebase).

**Decision reference:** D-09 (soft pre-fill scope = within-wp only), REVIEWS Amendment 11 (resolvePrefillTeam returns null outside wp).

---

### Script 6: D-04 lock at gameStartTime (PICK-28-10)

**Goal:** Verify the picker locks once the game starts.

**Setup:**
- Device A: signed in.
- Pre-state: at least one game whose `startTime` is within ~2 minutes of now (or a game starting in the next minute).

**Steps:**
1. Open Pick'em ~30s before kickoff.
2. Verify the picker is still active and submitting.
3. Wait until `now > gameStartTime`.
4. Refresh the Pick'em surface (or wait for the next render tick).
5. Attempt to submit a pick on the just-started game.

**Pass criteria:**
- Before kickoff: pick submits normally.
- After kickoff: picker shows the locked state with a `Picks closed` pill (background `--warn`, text `--bg`).
- Defensive submit attempt (e.g. via DevTools console) returns `permission-denied` from Firestore rules per the D-04 lock check.
- The pill has `role="status"` so screen readers announce the status change.

**Decision reference:** CONTEXT D-04 (kickoff lock at game.startTime), HIGH-9 affectedKeys allowlist.

---

### Script 7: Inline wp pick row visibility/teardown (PICK-28-13)

**Goal:** Verify the inline pick row renders inside the live wp modal AND tears down cleanly when the modal closes.

**Setup:**
- Device A: signed in.
- Pre-state: an active `wp.mode === 'game'` watchparty with at least one pending pick by a family member; the wp's game has `startTime > now`.

**Steps:**
1. Open the wp live modal.
2. Verify the inline `renderInlineWpPickRow` row appears at the top of the wp body (immediately after the score strip).
3. Verify the row shows the user's pick (or a "Make a pick" affordance if no pick is in).
4. Verify a family member's pick (made on Device B) appears within ~2s via the chunked onSnapshot listener.
5. Close the wp live modal.
6. Wait 5s.
7. Submit a new pick from Device B.
8. Verify Device A's listener no longer fires (no console spam, no DOM update).
9. Open Device A's wp live modal again — pick row re-mounts cleanly with the latest state.

**Pass criteria:**
- Inline row renders immediately when modal opens.
- Real-time visibility of family member picks within ~2s.
- Aggregate teardown works: `state.pickemPicksUnsubscribe = () => unsubs.forEach(fn => fn())` cleans up ALL chunked listeners (REVIEWS Amendment 12 / MEDIUM-11).
- No console error on close/reopen.
- Modal re-mount does not double-listen.

**Decision reference:** PICK-28-13 (inline wp pick row), REVIEWS Amendment 12 (aggregate listener teardown).

---

### Script 8: Leaderboard render + rank ordering (PICK-28-25)

**Goal:** Verify the per-family per-league per-season leaderboard renders correctly, ordered by points + tiebreaker.

**Setup:**
- Device A: signed in.
- Pre-state: family has at least 2 members with at least 3 settled picks each in one league/season (NBA 2025-2026, EPL 2025-2026, etc.).

**Steps:**
1. Open Pick'em.
2. Tap the leaderboard sub-surface (or whatever affordance opens it).
3. Select a league + season with settled picks.
4. Verify the leaderboard renders members in rank order: highest `pointsTotal` first.
5. Verify ties resolve via the D-03 tiebreaker chain: `tiebreakerCount` higher first; then `tiebreakerDeltaTotal` lower first; then tied members render as same rank.
6. Verify the `<ol>` is semantic with `aria-label="{LeagueLabel} {Season} leaderboard"`.
7. Tap a member row.
8. Verify the member's pick history surface opens (read-only — picks_history view).

**Pass criteria:**
- Leaderboard ordered correctly by points → tiebreaker count → tiebreaker delta.
- aria-label present and well-formed.
- Tap on row navigates to per-member surface.
- Round-trip is single doc-read at `/families/{code}/leaderboards/{leagueKey}/{strSeason}` (cheap; CF-only writes).

**Decision reference:** D-03 (1-pt scoring + tiebreaker chain), REVIEWS HIGH-2 (counter ownership at gameResultsTick).

---

### Script 9: Past-seasons archive hide-when-empty (PICK-28-26)

**Goal:** Verify the past-seasons archive surface hides cleanly when there are no past seasons AND renders when there are.

**Setup (empty state):**
- Device A: a brand-new family member or a family in their first season.

**Steps (empty state):**
1. Open Pick'em → leaderboard surface.
2. Verify NO `Past seasons` section renders. The surface renders ONLY the current season's leaderboard.
3. The hide-when-empty branch follows the D-10 silent-UX preference (mirrors Phase 26 RPLY-26-20 framing).

**Setup (populated state):**
- Family with at least 1 prior season's leaderboard doc archived (e.g. NBA 2024-2025 with `endedAt` timestamp).

**Steps (populated state):**
1. Open Pick'em → leaderboard surface.
2. Verify a `Past seasons` heading + sub-line render.
3. Tap a past-season row.
4. Verify the prior leaderboard renders read-only with member rankings.

**Pass criteria:**
- Empty state: no UI clutter, silent absence.
- Populated state: heading renders + tap loads prior season.
- No console error in either branch.

**Decision reference:** D-10 (hide-when-empty, mirrors RPLY-26-20).

---

### Script 10: Push reminder T-15min (PICK-28-16)

**Goal:** Verify the `pickReminderTick` CF fires the T-15min push to opted-in family members for a pending pick.

**Setup:**
- Device A: iOS PWA + push notifications opted-in for `pickReminder`.
- Device B: Android Chrome PWA + push notifications opted-in for `pickReminder`.
- Pre-state: at least one upcoming game with `gameStartTime` within the next 15-20 minutes; user has NO pick yet (`state: pending` for the game's slate but no pick doc submitted).

**Steps:**
1. Both devices: confirm push opt-in for `pickReminder` is ON in Settings → Notifications.
2. Wait until `gameStartTime - 15min`.
3. Within the next 5-min CF tick, observe the push notification arrive on both devices.
4. Verify the push title reads: `Game starting soon — make your pick`
5. Verify the push body reads: `Heads-up — {GameMatchup} tips off in 15. Make your pick.` with `{GameMatchup}` substituted (e.g. `Lakers vs Celtics`).
6. Tap the push.
7. Verify it deep-links to the picker for that specific game.

**Pass criteria:**
- Push arrives within ~5min of T-15min via the scheduled CF tick.
- Title + body copy match verbatim.
- Tap deep-links correctly.
- Idempotency: opening the picker AFTER receiving the push does NOT trigger a second push (`picks_reminders/{leagueKey}_{gameId}_{memberId}` doc gates re-fire — Pitfall 5 closure).
- Push is suppressed if the user already submitted a pick (no spam for finished work).
- Quiet-hours suppression honored per Phase 6 PUSH-04.

**Decision reference:** CONTEXT D-06 (3-map notification stack), REVIEWS Amendment 4 / MEDIUM-10 (per-tick fetch cache).

---

### Script 11: NO UFC variant — D-17 update 2 verification (PICK-28-27)

**Goal:** Document and verify the v1 known scope decision — UFC pickType is INTENTIONALLY absent in v1 per CONTEXT D-17 update 2 (2026-05-04). UFC stays in `js/sports-feed.js` LEAGUES catalog for the existing watchparty mode (Phase 22) but is excluded from the pick'em surface end-to-end. **DO NOT mark this as a bug.**

**Setup:**
- Device A: iOS Safari PWA, signed in.
- Pre-state: a UFC event exists in the upcoming sports feed (verify by checking the regular sports watchparty mode — the UFC event card SHOULD appear there).

**Steps:**
1. Open Pick'em from the Tonight inline link.
2. Scroll through every league's picker cards.
3. **Verify**: NO UFC card appears anywhere on the pick'em surface, even if a UFC event is upcoming.
4. **Verify**: the league filter excludes `'ufc'` at render time (`leagueKeys.filter(k => k !== 'ufc')` per js/app.js).
5. **Verify**: regular sports watchparty mode STILL shows UFC events — `js/sports-feed.js` LEAGUES catalog has UFC; only the pick'em surface filters it out.
6. From DevTools console, attempt to forge a UFC pick: `await firebase.firestore().doc('families/{code}/picks/forged-ufc').set({pickType:'ufc_winner_method', selection:{winningFighter:'X', method:'KO'}, leagueKey:'ufc', state:'pending', gameStartTime: Date.now() + 60000})`
7. **Verify**: the write FAILS with `permission-denied` because firestore.rules constrains `pickType` to the 3-value allowlist `['team_winner', 'team_winner_or_draw', 'f1_podium']` (REVIEWS HIGH-4 + Plan 04 rules block).
8. **Verify** in the queuenight CF logs: even if a forged UFC pick somehow landed, `gameResultsTick` would skip it BEFORE the transaction via the `KNOWN_PICKTYPES.has(pick.pickType)` guard (REVIEWS Amendment 2 / HIGH-4 backend defense — defense-in-depth).
9. **Verify** in the smoke contract: `scripts/smoke-pickem.cjs` Group 6 has assertion 6.D as a NEGATIVE sentinel (`grt && !grt.includes("case 'ufc_winner_method'")` returns `'NO_UFC'`) and Group 8 has assertion 8.H likewise (`appJs && !appJs.includes("case 'ufc_winner_method'")` returns `'NO_UFC_PICKER'`).

**Pass criteria:**
- (a) NO UFC card visible on the Pick'em surface.
- (b) Regular sports watchparty mode still shows UFC events (only pick'em filters).
- (c) Direct Firestore write of a UFC pick is rejected with `permission-denied` at the rules layer (Plan 04 HIGH-4).
- (d) `gameResultsTick` skips unknown pickTypes BEFORE transaction (Plan 03 HIGH-4 backend defense).
- (e) Smoke contract has both 6.D + 8.H NEGATIVE sentinels green.
- (f) Document this script's outcome as the v1 known scope decision — **DO NOT mark as bug**. UFC moves to a future Phase 28.x triggered by (i) actual user demand, (ii) project budget materializing, or (iii) a free UFC API emerging with structured roster + settlement at zero cost (none currently exists; API-Sports MMA free tier was ruled out 2026-05-04 due to its 3-day data window restriction; TheSportsDB Patreon was ruled out same date due to $108/yr cost vs zero-revenue personal-project guardrails per CLAUDE.md).

**Decision reference:** CONTEXT D-17 update 2 (UFC drop, Option B locked 2026-05-04).
**Threat reference:** Plan 03 KNOWN_PICKTYPES (HIGH-4 backend defense), Plan 04 pickType allowlist (HIGH-4 rules-layer defense), Plan 05 ALLOWED_PICK_TYPES + UFC-leagueKey reject (HIGH-4 client-layer defense-in-depth — REVIEWS Amendment 13).

---

## Sign-off

User confirms PASS / FAIL on each script above and replies `uat passed` (or describes failures). On `uat passed`, run `/gsd-verify-work 28`.

## Browser matrix coverage map

| Platform | Browser | Covered by | Expected |
|---|---|---|---|
| iOS 16.4+ | Safari (PWA from home-screen) | Scripts 1, 2, 4, 5, 7, 10, 11 (Device A) | Pick'em surface + picker variants + Jolpica + cache bump activation |
| Android | Chrome | Scripts 2, 3, 7, 10 (Device B) | Real-time pick visibility + push reminder + listener teardown |
| Desktop | Chrome | Scripts 8, 11 (DevTools needed) | Leaderboard ARIA + rules-layer permission-denied check + smoke negative sentinel verification |

## Requirement coverage

This UAT scaffold covers the live + locked Phase 28 requirements:

| Requirement ID | Covered by |
|---|---|
| PICK-28-03 (Pick'em sub-surface) | Script 1 |
| PICK-28-04 (3 picker variants — NO UFC) | Scripts 2, 3, 11 |
| PICK-28-05 (F1 picker reads Jolpica) | Script 4 |
| PICK-28-07 (D-09 soft pre-fill) | Script 5 |
| PICK-28-08 (real-time pick visibility via onSnapshot) | Script 7 |
| PICK-28-10 (D-04 lock at gameStartTime) | Script 6 |
| PICK-28-13 (inline wp pick row) | Script 7 |
| PICK-28-16 (pickReminderTick T-15min push) | Script 10 |
| PICK-28-25 (leaderboard sub-surface) | Script 8 |
| PICK-28-26 (past-seasons archive hide-when-empty) | Script 9 |
| PICK-28-27 (UFC drop / D-17 update 2) | Script 11 |
| PICK-28-39 (REVIEWS HIGH-4 D-i-D submitPick allowlist) | Script 11 |
| PICK-28-41 (REVIEWS Amendment 12 aggregate listener teardown) | Script 7 |

CONTEXT decisions exercised: D-04 (kickoff lock, Script 6), D-06 (3-map notification, Script 10), D-09 (soft pre-fill, Script 5), D-10 (hide-when-empty, Script 9), D-17 update 2 (UFC drop, Script 11).

REVIEWS amendments verified end-to-end: Amendment 2 / HIGH-4 backend KNOWN_PICKTYPES (Script 11 step 8), Amendment 8 / HIGH-4 rules pickType allowlist (Script 11 step 7), Amendment 12 / MEDIUM-11 aggregate listener teardown (Script 7), Amendment 13 / HIGH-4 D-i-D submitPick (Script 11 sentinel reference).

## Resume signal

After all 11 scripts pass on at least one device:
- Reply `uat passed` in the chat to trigger `/gsd-verify-work 28`
- Verifier auto-confirms phase completion + bumps STATE.md milestone progress

If any script fails, reply with the script number + observed behavior + expected behavior so the failure can be triaged.
