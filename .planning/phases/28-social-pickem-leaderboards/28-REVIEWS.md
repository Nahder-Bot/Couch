---
phase: 28
reviewers: [gemini, codex]
reviewed_at: 2026-05-05T02:38:23Z
plans_reviewed:
  - 28-03-PLAN.md
  - 28-04-PLAN.md
  - 28-05-PLAN.md
  - 28-06-PLAN.md
plans_excluded:
  - 28-01-PLAN.md  # already shipped 2026-05-02
  - 28-02-PLAN.md  # already shipped 2026-05-02
self_skipped: claude  # workflow ran inside Claude Code; claude CLI excluded for reviewer independence
gemini_model: default (gemini-cli)
codex_model: gpt-5.5 (codex exec default)
---

# Cross-AI Plan Review — Phase 28 (Social Pick'em + Leaderboards)

This review evaluates Plans 28-03 through 28-06 against the locked Option B scope
(2026-05-04 D-17 update 2: drop UFC, ship F1 via Jolpica, 3 of 4 pickTypes).
Plans 01 + 02 already shipped 2026-05-02 against the original 4-pickType scope and
were excluded from review (`js/pickem.js` retains UFC code paths in the helper layer
by design — both reviewers flagged this as a cross-plan consistency concern).

---

## Gemini Review

> Note: Gemini's output contained multiple passes concatenated into a single response.
> The pass below is the most complete one (covers all 4 plans plus phase-level review).

### Phase Overall Assessment

Phase 28 is a significant expansion of the "v2 sports milestone," introducing the first
persistent engagement loop (leaderboards) and scheduled automation (`gameResultsTick`).
The pivot to **Option B** is technically sound and preserves the project's zero-cost
operating model. The architectural split between a "fat" UI/Helper layer and "transactional"
CF settlement is consistent with Couch's established patterns. However, the mid-phase
change has left a "ghost" logic trail for UFC in the helper module that requires careful
guarding in the UI and CF layers.

### Plan 28-03 Review (Backend: CFs & Notifications)

**Summary:** This plan implements the "heartbeat" of the pick'em system. It correctly
splits settlement between TheSportsDB and Jolpica and implements a robust transactional
update for leaderboards.

**Strengths:**
- **Idempotency:** The use of `picks_reminders` docs and `state: 'settled'` checks
  effectively prevents push-notification spam and double-scoring.
- **Fail-Soft:** The per-pick `try/catch` and per-branch fail-soft logic ensures a
  Jolpica outage doesn't block NBA/NFL settlement.
- **3-Map Lockstep:** Rigorous enforcement of the notification keys across the stack.

**Concerns:**
- **MEDIUM: F1 Auto-zero Grace:** The 60-minute `AUTO_ZERO_GRACE_MS` is likely too
  short for F1. A race can last 90–120 minutes, and Jolpica/Ergast data sometimes
  lags the podium by an hour. F1 picks might be auto-zeroed while the race is still
  technically active or just finishing.
- **MEDIUM: Index Requirements:** The `collectionGroup('watchparties')` query in
  `pickReminderTick` and the `pending` + `gameStartTime` query in `gameResultsTick`
  **require composite indexes**. These are not mentioned in the plan as additions to
  `firestore.indexes.json`.
- **LOW: Leaderboard Denominator:** The plan mentions incrementing `picksSettled` in
  the transaction, but doesn't explicitly clarify when `picksTotal` (the total
  attempted) is incremented. If it's only at settlement, a "pending" pick that never
  settles (e.g., game cancelled) won't show in the denominator.

**Suggestions:**
- Increase `AUTO_ZERO_GRACE_MS` to 180 minutes specifically for F1, or globally.
- Add a task to update `firestore.indexes.json` with the required composite indexes
  (specifically for the collectionGroup query).

### Plan 28-04 Review (Firestore Rules)

**Summary:** A surgical update to the rules that enforces the "lock at tip-off"
requirement and prevents clients from tampering with scoring fields.

**Strengths:**
- **Field Denylist:** Excellent use of `affectedKeys().hasAny(...)` to prevent clients
  from awarding themselves points.
- **Lock Enforcement:** `request.time.toMillis() < resource.data.gameStartTime` is the
  correct way to handle the T-0 cutoff.

**Concerns:**
- **HIGH: State Omission:** The rule
  `(!('state' in request.resource.data) || request.resource.data.state == 'pending')`
  allows a client to omit the `state` field entirely. However, `gameResultsTick`
  queries specifically for `where('state', '==', 'pending')`. A pick without a state
  field will be **invisible to the settlement engine**.
- **MEDIUM: Missing Negative Tests:** The 4 new tests cover the basics, but there are
  no tests verifying that `leaderboards` and `picks_reminders` are strictly
  write-denied for clients.

**Suggestions:**
- Change the rule to **require** the state field:
  `request.resource.data.state == 'pending'`.
- Add rules tests for: (1) Client write-deny on `leaderboards`, (2) Client write-deny
  on `picks_reminders`, (3) Client update-after-lock deny.

### Plan 28-05 Review (UI Surface)

**Summary:** This plan handles the heavy lifting of rendering the picker variants and
the leaderboard. The Jolpica integration for the F1 picker is a clever solution to the
"missing roster" problem.

**Strengths:**
- **UFC Filtering:** Explicitly filtering `PICKEM_LEAGUES` and removing the UFC case
  from the render switch prevents the "shipped" UFC helper code from reaching the user.
- **F1 Roster Caching:** Local caching of the Jolpica roster prevents redundant API
  calls during a single session.
- **D-09 Pre-fill:** The team-allegiance hint adds a high-polish feel and rewards
  early users.

**Concerns:**
- **MEDIUM: Team Allegiance Context:** Task 5.2 mentions using
  `state.me.teamAllegiance`. However, Phase 11 team allegiances are often stored
  per-watchparty or in a specific profile field. Ensure the picker correctly resolves
  the member's global allegiance if they aren't currently in a watchparty.
- **LOW: Jolpica Race-Day Performance:** Jolpica (as a community-run successor to
  Ergast) can be slow on race days. The "Race entry list unavailable" fail-soft is
  necessary, but the UI should perhaps suggest "Try again in a few minutes."
- **LOW: Line Count:** Adding 600 lines to `js/app.js` is a maintenance burden. While
  consistent with project style, this was an opportunity to move the 5 renderers into
  a `js/pickem-ui.js` or similar.

**Suggestions:**
- Ensure `state.me.teamAllegiance` is populated at app boot
  (check `auth.js` / `state.js`).
- Verify `escapeHtml()` is used on Jolpica driver names in the picker to prevent XSS.

### Plan 28-06 Review (Deploy & UAT)

**Summary:** A standard close-out plan. The jump to `couch-v47-pickem` is correct
given the intermediate hotfix waves.

**Strengths:**
- **Script 11:** Explicitly testing the *absence* of UFC is a critical validation step
  for the mid-phase pivot.
- **Smoke Floor:** Locking the floor at 13 production-code sentinels ensures the
  cross-repo lockstep doesn't drift in future phases.

**Concerns:**
- **LOW: `--sync-rules` Flag:** Ensure the `deploy.sh` script actually supports this
  flag. It was a requested feature in Phase 30; if that phase's hotfixes didn't merge
  it into the main `deploy.sh`, this plan will fail.

**Suggestions:**
- Verify `scripts/deploy.sh` for `--sync-rules` handling before executing the deploy
  task.

### Cross-Plan Consistency & Risks (Gemini)

1. **UFC Ghost Logic:** The risk of a forged UFC pick is **LOW**. The helper supports
   it, but the UI won't render it, the Rules block field tampering, and the CF awards
   it 0 points. It would essentially be a "dead" document in Firestore.
2. **Leaderboard Accuracy:** There is a slight ambiguity in how `picksTotal` vs
   `picksSettled` is handled. The CF should ideally recalculate the member's row or
   increment both to ensure the leaderboard "denominators" match reality.
3. **Data Types:** Plan 01 normalized `strSeason` to a string. Plan 03 uses it in the
   Jolpica URL. Jolpica expects the year (e.g., "2026"). Since TSD's `strSeason` for
   F1 is usually a single year, this is safe.

### Risk Assessment (Gemini): **MEDIUM**

The technical implementation is solid, but the reliance on **composite indexes**
(not yet declared) and the **F1 auto-zero race condition** are the primary risks to a
"clean" day-one launch.

### Final Recommendation (Gemini): **SHIP WITH NAMED AMENDMENTS**

1. **Amendment 1:** Update Plan 28-04 to **require** `state == 'pending'` in the pick
   creation rule.
2. **Amendment 2:** Add a task to Plan 28-03 to update `firestore.indexes.json` with a
   **Collection Group index** for `watchparties` (mode, hostFamilyCode) and a
   **Regular index** for `picks` (state, gameStartTime).
3. **Amendment 3:** Increase `AUTO_ZERO_GRACE_MS` in `gameResultsTick` to 3 hours to
   accommodate long F1 races.
4. **Amendment 4:** Explicitly verify that `gameResultsTick` increments both
   `picksTotal` and `picksSettled` (Gemini's response was truncated mid-sentence here;
   Codex independently surfaces the same concern below).

---

## Codex Review

> Codex was treated `CONTEXT.md` updated 2026-05-04 as authoritative over stale
> `RESEARCH.md`. Blunt read: Plans 03–06 are close, but not safe to execute as-is.
> The biggest risks are silent leaderboard pollution, missing index/deploy
> prerequisites, ambiguous pick counters, and F1 outage behavior.

### Plan 28-03 Summary

Backend direction is mostly sound: F1 via Jolpica, no UFC settlement branch,
scheduled settlement/reminder separation, transaction-wrapped leaderboard updates,
and fail-soft external API handling are all good. But the plan has a serious
data-accounting gap: `picksTotal` and `lastPickAt` are not clearly maintained
anywhere, and malformed/legacy/UFC picks can still mutate leaderboard rows as
0-point settled picks unless explicitly skipped.

**Strengths**
- Correctly supersedes stale TheSportsDB F1 settlement with Jolpica `/results/`.
- Per-pick try/catch prevents one bad API response from aborting the whole tick.
- Transactional leaderboard write is the right place for derived aggregates.
- Negative UFC settlement branch is directionally right.
- Idempotency doc before reminder send is the right bias for duplicate prevention.

**Concerns**
- **HIGH:** `picksTotal` has no owner. Plan text implies "incremented at create-time
  by client," but Plan 04 denies client leaderboard writes. If `gameResultsTick` only
  updates `picksSettled`, leaderboard accuracy and participation stats are wrong.
- **HIGH:** Unknown pick types should be skipped, not settled. Current behavior risks
  `ufc_winner_method` or forged pick types incrementing `picksSettled` / creating
  ghost leaderboard rows with 0 points.
- **HIGH:** `auto_zero` after `AUTO_ZERO_GRACE_MS = 1h` is too aggressive for
  F1/Jolpica. F1 result availability can lag. This would incorrectly zero legitimate
  F1 picks because the source is late.
- **MEDIUM:** `fetchJolpicaPodium(pick.f1Year, pick.f1Round)` depends on Plan 05
  denormalization, but Plan 03 does not specify fallback/validation when either field
  is missing. Shipped Plan 01 has `round: null` possible.
- **MEDIUM:** Per-pick API fetch will hammer TheSportsDB/Jolpica if many family
  members picked the same game. Fetch should be cached per tick by `leagueKey/gameId`
  or `f1Year/f1Round`.
- **MEDIUM:** Reminder query
  `collectionGroup('watchparties').where('mode','==','game').where('hostFamilyCode','==',familyCode)`
  likely needs a declared index.
- **MEDIUM:** Picks query `where('state','==','pending').where('gameStartTime','<',now)`
  may need an index depending on Firestore behavior and existing indexes.
- **LOW:** Writing `picks_reminders` before push prevents duplicates but can drop
  reminders permanently if push send fails after the write. That may be acceptable,
  but it should be explicit.

**Suggestions**
- In Task 3.1, define aggregate ownership exactly:
  - On settlement, increment `picksSettled`.
  - On auto-zero, increment both `picksSettled` and `picksAutoZeroed` if that field
    exists.
  - Either increment `picksTotal` at settlement based on every processed pick, or
    add a create-time Cloud Function. Do not rely on client leaderboard writes.
  - Set `lastPickAt` from `pick.submittedAt` when processing the pick, or remove it
    from the schema.
- In Task 3.1, for unknown pick types, `continue` before transaction. Do not update
  pick state or leaderboard.
- Add per-tick result cache:
  - `scoreCache.set(gameId, finalGame)` for team leagues.
  - `f1Cache.set(`${year}_${round}`, finalGame)` for F1.
- Use a longer or branch-specific grace:
  - Team sports: 1–3h may be okay.
  - F1: at least 24h, preferably do not auto-zero due to unavailable source.
    Auto-zero should mean "member missed pick," not "API was down."
- Add explicit sentinels/tests for no leaderboard update on unknown/UFC pick type.

### Plan 28-04 Summary

The rules plan has the right shape but is under-specified and has at least one
dangerous edge: allowing creates without `state` conflicts directly with the backend
query that only sees `state == 'pending'`. It also lacks enough negative tests for a
security-sensitive feature.

**Strengths**
- Puts lock enforcement in Firestore rules, not just UI.
- Denies client writes to leaderboards and reminders.
- Denies client mutation of settlement fields.
- Keeps reads scoped to family members.

**Concerns**
- **HIGH:** Create allows `state` to be omitted. `gameResultsTick` queries
  `where('state','==','pending')`, so omitted-state picks never settle and never
  appear in leaderboard.
- **HIGH:** Update rules do not appear to require
  `request.resource.data.gameStartTime == resource.data.gameStartTime`. A client may
  be able to move `gameStartTime` forward unless not covered by broader validation.
- **HIGH:** Update rules do not deny changing `pickType`, `gameId`, `leagueKey`,
  `strSeason`, `f1Year`, or `f1Round`. A client could submit a valid pick before
  lock, then mutate routing/scoring fields before lock.
- **MEDIUM:** Create does not validate `pickType` allowlist, `leagueKey`, `gameId`,
  `selection`, `strSeason`, or F1 denormalized fields.
- **MEDIUM:** `submittedAt` preservation is a requirement, but update rules do not
  prevent changing it.
- **MEDIUM:** New tests are too thin. Four tests is not enough for this rules
  surface.
- **LOW:** `memberName` and `actingUid` are allowed but not clearly constrained.
  Existing helpers may cover this, but the plan should say so.

**Suggestions**
- Require `state == 'pending'`, `pointsAwarded == 0`, `settledAt == null`, and
  `tiebreakerActual == null` on create. Do not allow omission for fields the backend
  queries.
- On update, allow only mutable fields:
  - `selection`
  - `tiebreakerTotal`
  - maybe `updatedAt`

  Everything else should be immutable.
- Add explicit update denylist or allowlist for:
  - `gameId`
  - `leagueKey`
  - `strSeason`
  - `pickType`
  - `gameStartTime`
  - `submittedAt`
  - `f1Year`
  - `f1Round`
  - `memberId`
- Add rules tests:
  - member update after lock denied
  - non-family read picks denied
  - leaderboard write denied
  - `picks_reminders` write denied
  - create without `state` denied
  - update `gameStartTime` denied
  - update `pickType` denied
  - create forged settlement fields denied

### Plan 28-05 Summary

The UI plan is coherent and aligned with Option B, but it tries to put too much new
behavior into `js/app.js`. The largest functional risks are F1 round/year derivation,
incorrect D-09 prefill source, listener/query complexity, and the fact that the
client helper still validates UFC.

**Strengths**
- Correctly filters UFC at render time.
- Handles three picker variants only.
- Uses Jolpica driver canonical name consistently with settlement.
- Includes real-time pick listener and listener teardown.
- Includes negative UFC smoke sentinel.
- Fail-soft F1 roster UI is the right UX for picker display.

**Concerns**
- **HIGH:** `validatePickSelection` still accepts `ufc_winner_method`. If `submitPick`
  trusts `PICK_TYPE_BY_LEAGUE`, a forged console call can still create valid
  UFC-shaped picks unless UI/rules/backend all reject them. Plan 05 accepts this, but
  Plan 03 may still settle them as phantom 0s.
- **HIGH:** D-09 source mismatch. CONTEXT says prefill from
  `participants[mid].teamAllegiance`; Plan 05 mentions `state.me.teamAllegiance`.
  Outside a watchparty, there may be no `participants[mid]`. The rule needs a clear
  fallback source or the feature will be inconsistent.
- **HIGH:** F1 `f1Year` / `f1Round` derivation is fragile. `game.season` is a string
  fallback and `game.round` may be null. Jolpica requires valid year and round. The
  UI should not allow F1 pick submission without both.
- **MEDIUM:** `onSnapshot` with chunked `where('gameId','in',...)` requires multiple
  unsubscribers, but plan names a single `state.pickemPicksUnsubscribe`. Needs an
  aggregate teardown function.
- **MEDIUM:** Existing-pick edits are underspecified. Plan says writes via `.set()`
  to a generated `pickId`; but decisions say edits overwrite existing pick in place
  and preserve `submittedAt`. The UI must find existing pick by `(memberId, gameId)`
  and reuse its doc id.
- **MEDIUM:** Race at lock is acknowledged, but UI should explicitly catch
  `PERMISSION_DENIED` and re-render locked state.
- **MEDIUM:** 600 more lines into `js/app.js` is a DX debt multiplier. Some logic
  belongs in `js/pickem.js` or a new UI module if the app's module system supports it.
- **LOW:** `PICK_REMINDER_OFFSET_MS` import appears unused in UI unless the plan uses
  it for deadline copy.

**Suggestions**
- Add a UI-level guard before `submitPick`:
  - if `leagueKey === 'ufc'`, refuse.
  - if `pickType` not in `team_winner/team_winner_or_draw/f1_podium`, refuse.
- Add a rules/backend guard too; do not rely on render filtering.
- For F1, require:
  - `Number.isInteger(Number(f1Year))`
  - non-empty `f1Round`
  - successful roster fetch before submit
- Implement listener teardown as:
  - `state.pickemPicksUnsubscribe = () => unsubscribers.forEach(fn => fn())`
- Clarify prefill:
  - If inside live watchparty, use `wp.participants[mid].teamAllegiance`.
  - If standalone Pick'em, either use a member-level stored allegiance if one exists,
    or omit prefill.
- Move pure UI helpers into `js/pickem.js` only if they are DOM-free. DOM render
  functions can stay in `app.js` for consistency, but data shaping, F1 URL building,
  pick doc construction, and selection labels should be extracted.

### Plan 28-06 Summary

Close-out plan is directionally fine but too optimistic about deploy assumptions.
The cache name, `--sync-rules` flag, index deployment, and smoke floor math all need
verification before this becomes an execution checklist.

**Strengths**
- Correctly bumps from current production cache lineage to `couch-v47-pickem`.
- Human UAT includes explicit no-UFC verification.
- Keeps cross-repo deploy ordering correct: functions before hosting.
- Smoke floor protects against sentinel group erosion.

**Concerns**
- **HIGH:** `--sync-rules` may not exist in `scripts/deploy.sh`. Plan assumes
  infrastructure that may not be present.
- **HIGH:** No mention of `firestore.indexes.json` or index deploy. Plans 03/04
  introduce likely index requirements.
- **MEDIUM:** `couch-v47-pickem` is only correct if nothing else ships before
  execution. Since today is after the 2026-05-04 lock in the prompt, this should be
  rechecked at execution time.
- **MEDIUM:** Smoke `HELPER_ASSERTIONS = 27` is brittle if Plan 02 counts drift.
  Better to count production sentinel group explicitly.
- **LOW:** UAT covers reminders, but scheduled functions are hard to manually test
  without emulator/test hooks. Needs an operational test recipe.

**Suggestions**
- Add preflight:
  - confirm `scripts/deploy.sh --help` or grep for `--sync-rules`
  - confirm current `sw.js` cache before choosing `v47`
  - confirm `firestore.indexes.json` contains required indexes
- Add deploy step for indexes if needed:
  - `firebase deploy --only firestore:rules,firestore:indexes`

  or ensure `scripts/deploy.sh --sync-rules` actually includes both.
- Replace fragile smoke floor math with named counters:
  - `helperAssertions`
  - `productionSentinels`
  - `metaAssertions`
- Add emulator/scripted checks for scheduled functions before production deploy.

### Phase-Wide Summary (Codex)

The mid-phase Option B replan is mostly consistent, but the "helper keeps UFC,
downstream drops UFC" split is only safe if rules and backend reject or skip
UFC-shaped picks. Right now it is not fully safe: the helper can validate UFC, UI
can be bypassed, rules do not reject UFC, and backend may pollute leaderboard rows
unless unknown pick types are skipped before transaction. The phase should ship with
amendments, not as-is.

**Cross-Plan Strengths**
- Option B is clearly reflected in Plans 03, 05, and 06.
- F1 canonical driver name is consistent across UI and settlement.
- UFC remains in watchparty catalog but is filtered from Pick'em surface, which
  matches D-01.
- Smoke strategy tries to guard cross-repo notification drift.
- Firestore-derived leaderboard model is the right architecture.

**Cross-Plan Concerns**
- **HIGH:** UFC defense is incomplete. "UI does not render it" is not enough.
  Rules/backend need to reject or skip it.
- **HIGH:** Counter ownership is unresolved: `picksTotal`, `picksSettled`,
  `picksAutoZeroed`, and `lastPickAt` need exact writers.
- **HIGH:** Missing indexes can break production scheduled functions immediately.
- **HIGH:** Pick create can omit `state`, making valid-looking picks invisible to
  settlement.
- **MEDIUM:** F1 outage handling conflates "API unavailable" with "user missed pick."
- **MEDIUM:** Client/server pick shape is not locked tightly enough in rules.
- **MEDIUM:** Notification lockstep grep should verify all three actual maps,
  including client UI copy map, not just loose string hits.
- **LOW:** `js/app.js` size is not a launch blocker, but every new surface makes
  future changes riskier.

### Risk Assessment (Codex)

Overall risk: **MEDIUM-HIGH if executed as written; MEDIUM after amendments.**

The concept is sound, and no single plan is fundamentally wrong. The launch risk
comes from cross-plan seams: rules permit shapes the backend does not process
correctly, backend aggregates fields no one owns, UI relies on data fields that may
be null, and deploy does not declare index prerequisites. These are fixable before
execution.

### Recommendation (Codex): **SHIP WITH NAMED AMENDMENTS**, not as-is

Minimum amendments before executing Plans 03–06:

1. Reject or skip unsupported pick types everywhere: rules, submit path, settlement
   transaction.
2. Make `state: 'pending'` required on create.
3. Define and implement ownership for `picksTotal`, `picksSettled`,
   `picksAutoZeroed`, and `lastPickAt`.
4. Add immutable-field rules for pick identity/routing fields.
5. Add required Firestore indexes and deploy them.
6. Make F1 auto-zero grace longer or source-aware.
7. Verify `--sync-rules` and cache version immediately before deploy.

---

## Consensus Summary

Both reviewers reached the same overall verdict: **SHIP WITH NAMED AMENDMENTS, not
as-is.** Both rated overall risk as MEDIUM (Codex: MEDIUM-HIGH if as-written → MEDIUM
after amendments; Gemini: MEDIUM driven by infra + denominator gap). Neither said the
phase is fundamentally broken — the architecture is sound; the issues are in
cross-plan seams that opened up during the mid-phase Option B scope change.

### Agreed Strengths (both reviewers)

- **Transactional leaderboard updates** in `gameResultsTick` are the right
  architecture for derived aggregates.
- **Per-pick fail-soft** (try/catch around each settlement) correctly isolates a
  TheSportsDB / Jolpica outage to one pick rather than the whole tick.
- **`picks_reminders` idempotency doc written before push send** is the right bias
  for duplicate prevention.
- **3-map notification lockstep gate** (smoke Group 5 cross-repo grep) is a strong
  automated safety net for the convention Phase 14 D-12 originally established
  manually.
- **UFC scope drop is correctly reflected** in the picker UI (filter at render),
  the CF (no UFC settlement branch), and the UAT scaffold (Script 11 verifies
  absence with explicit "DO NOT mark as bug" language).
- **Cross-repo deploy ordering** (queuenight functions first → couch hosting +
  cache bump) is correct.
- **Affected-keys denylist on the picks update rule** correctly prevents clients
  from self-settling.

### Agreed Concerns — Highest Priority (HIGH severity, raised by 2+ reviewers)

These are the must-fix amendments before executing Plans 03–06:

1. **Pick `state` field can be omitted on create.** Plan 04's create rule
   `(!('state' in request.resource.data) || request.resource.data.state == 'pending')`
   permits omission. `gameResultsTick` queries `where('state','==','pending')`, so
   any pick created without an explicit `state` field becomes **invisible to the
   settlement engine** — the pick sits in Firestore forever, never scored, never
   shown in the leaderboard.
   **Fix:** Tighten the create rule to **require** `request.resource.data.state == 'pending'`.

2. **Leaderboard counter ownership is unresolved.** Plan 03 increments `pointsTotal`
   and `picksSettled` on settlement; Plan 04 denies all client writes to leaderboard
   docs (`allow write: if false`). But the schema also includes `picksTotal` and
   `lastPickAt`, with a code comment in Plan 03 saying *"picksTotal is incremented at
   create-time by client; do NOT double-increment here"* — directly contradicting
   the rule. Result: `picksTotal` is never maintained, so the leaderboard
   "X of Y settled" denominator is silently broken. Same problem for `lastPickAt`.
   **Fix:** Pick exactly one writer for each counter and codify it in Plan 03's
   transaction body. Either `gameResultsTick` increments `picksTotal` on first
   processing of every pick (regardless of settle vs auto-zero outcome), or remove
   `picksTotal` and `lastPickAt` from the schema entirely.

3. **Required Firestore composite indexes are not declared.** Plan 03's
   `pickReminderTick` uses
   `db.collectionGroup('watchparties').where('mode','==','game').where('hostFamilyCode','==',familyCode)`
   — collection-group queries with two filters require a composite index. Plan 03's
   `gameResultsTick` per-family pick query
   `where('state','==','pending').where('gameStartTime','<',now)` likely also
   requires one. Neither plan touches `firestore.indexes.json`. Without the
   indexes, both CFs will fail at first invocation in production with
   "FAILED_PRECONDITION: The query requires an index" errors.
   **Fix:** Add `firestore.indexes.json` updates to either Plan 03 or Plan 04, and
   ensure Plan 06's deploy step actually pushes indexes
   (`firebase deploy --only firestore:rules,firestore:indexes`, not just rules).

4. **UFC defense is incomplete at the rules + backend layers.** Both reviewers note
   the helper-keeps-UFC / downstream-drops-UFC split is only *partially* safe.
   `js/pickem.js` (already shipped) still has `case 'ufc_winner_method'` in
   `validatePickSelection` and `scorePick`, plus `PICK_TYPE_BY_LEAGUE.ufc =
   'ufc_winner_method'`. Plan 04's rules do NOT validate the `pickType` allowlist
   on create — a forged console-call client could create a UFC-shaped pick that
   passes validation. Plan 03's `gameResultsTick` `default:` arm returns 0 for
   unknown pickTypes BUT still flips the pick to `state: 'settled'` and increments
   `picksSettled` — polluting the leaderboard with phantom 0/N rows.
   **Fix (combined):** Plan 04 add `pickType in ['team_winner', 'team_winner_or_draw', 'f1_podium']`
   constraint on create. Plan 03 `gameResultsTick`: for unknown pick types,
   `continue` BEFORE the transaction — don't update pick state, don't touch
   leaderboard. (Codex Concern + Gemini "UFC Residue" align here.)

### Agreed Concerns — Medium Priority

5. **F1 auto-zero grace conflates "API unavailable" with "user missed pick."**
   `AUTO_ZERO_GRACE_MS = 1h` flips a still-pending F1 pick to `auto_zeroed` once an
   hour past `gameStartTime` if the score isn't available. F1 races run 90–120
   minutes; Jolpica/Ergast can lag 30–60 min after the podium for finalization
   (post-race penalties shift positions). A late-but-correct Jolpica response
   would arrive AFTER the pick has been auto-zeroed.
   **Fix:** Branch grace by pickType. Team sports: 1–3h is fine. F1: 24h minimum,
   or — better — never auto-zero F1 picks just because Jolpica is slow; only
   auto-zero when the source confirms the race ended without that pick being
   scored (Codex's "auto-zero should mean member missed pick, not API was down").

6. **F1 `f1Year` / `f1Round` derivation is fragile.** Plan 05 stamps these from
   `game.season` (which Plan 01 made a string with possible `'unknown'` fallback)
   and `game.round` (which Plan 01 made null for non-soccer). Jolpica's URL
   `/ergast/f1/{year}/{round}/results/` is invalid if either is null/`'unknown'`.
   **Fix:** Plan 05 must validate `Number.isInteger(Number(f1Year))` AND non-empty
   `f1Round` before allowing F1 pick submit. Plan 03 must guard
   `fetchJolpicaPodium` against missing fields.

7. **D-09 soft pre-fill source mismatch.** CONTEXT D-09 says pre-fill source is
   `participants[mid].teamAllegiance` (per-watchparty). Plan 05 description references
   `state.me.teamAllegiance` (member-global). Outside an active watchparty (the
   primary use case for the standalone Pick'em tab — picking NFL Sundays without
   sitting down for a wp), there is no `participants[mid]` to read from.
   **Fix:** Plan 05 must specify exactly: inside-wp → `wp.participants[mid].teamAllegiance`;
   standalone Pick'em → either a member-level stored allegiance (does this even
   exist?) or omit pre-fill.

8. **Plan 04 rules-test coverage is too thin for a security-sensitive surface.**
   Only 4 tests; missing: leaderboards write-deny, picks_reminders write-deny,
   update-after-lock deny, non-family-member read deny, immutable-field
   protection.
   **Fix:** Expand Plan 04 Task 4.2 to ~10 tests covering the full denial surface.

9. **Plan 04 update rule does not lock immutable routing/identity fields.** A
   client could create a valid pick, then update `pickType` / `gameId` /
   `leagueKey` / `strSeason` / `f1Year` / `f1Round` / `gameStartTime` /
   `submittedAt` before lock. Most of these would never settle correctly afterward
   but could be used to confuse the leaderboard or move locks forward.
   **Fix:** Add `affectedKeys()` allowlist of mutable fields (`selection`,
   `tiebreakerTotal`, maybe `updatedAt`) in the update rule, and add a rules-test
   for each.

10. **Per-tick fetch is N×M, should be cached per (gameId, leagueKey).** If 5
    family members each pick the same NBA game, `gameResultsTick` will call
    `fetchTsdScore` 5× for that one game per tick. Same for Jolpica.
    **Fix:** Plan 03 add a per-tick `Map<string, finalGame>` cache keyed by
    `${leagueKey}:${gameId}` (and `${f1Year}:${f1Round}` for F1).

11. **`onSnapshot` chunked listener teardown.** Plan 05 acknowledges the Firestore
    `in` query 10-game limit and chunks slate game IDs, but only declares one
    `state.pickemPicksUnsubscribe` slot. Multiple unsubscribers need an aggregate
    teardown function.
    **Fix:** Plan 05 — `state.pickemPicksUnsubscribe = () => unsubs.forEach(fn => fn())`.

### Agreed Concerns — Low Priority

12. **`js/app.js` line count growth (~600 lines on top of ~17,500).** Both
    reviewers flag this as DX debt, not a functional issue. Both suggest moving
    the 5 render functions into `js/pickem.js` or a new `js/pickem-ui.js`.
13. **`--sync-rules` flag for `deploy.sh` may not exist.** Plan 06 assumes it; if
    Phase 30's hotfix waves didn't merge it, deploy will fail.
    **Fix:** Plan 06 add a preflight check (`grep -- '--sync-rules' scripts/deploy.sh`).
14. **`couch-v47-pickem` cache target is correct only if no other phase ships
    first.** Should be re-checked at execution time against current `sw.js` line.
15. **Plan 06 `HELPER_ASSERTIONS = 27` is brittle.** Better to count production
    sentinel groups explicitly rather than subtract a fixed helper count.

### Divergent Views

The reviewers were unusually aligned on this phase. Two areas of mild divergence:

- **UFC ghost-doc severity.** Gemini rated "UFC residue" as LOW (forged picks
  result in 0 points = harmless dead document). Codex rated the same issue HIGH on
  the basis that the CF would still flip the doc to `settled` and increment
  `picksSettled` (denominator), polluting the leaderboard with phantom rows. The
  more rigorous view is Codex's: "settles for 0 points" is not "no effect" — the
  pick still affects `picksSettled` and the rank-pill display. Recommend treating
  Codex's HIGH severity as the operative rating.

- **Jolpica race-day reliability.** Gemini noted Jolpica can be slow on race days
  but treated this as a UI fail-soft concern (LOW). Codex treated the same issue
  as a settlement integrity concern (the auto-zero grace should be source-aware,
  HIGH). Both are correct; they describe different time-windows of the same
  outage. Recommend addressing both: UI fail-soft (Gemini) AND settlement grace
  (Codex).

### Overall Recommendation

**Both reviewers: SHIP WITH NAMED AMENDMENTS, not as-is.**

Minimum amendments before `/gsd-execute-phase 28`:

1. **Plan 04** — Require `state == 'pending'` on create (HIGH-1).
2. **Plan 04** — Lock immutable routing/identity fields on update via affectedKeys
   allowlist (HIGH-9).
3. **Plan 04** — Constrain `pickType` to a 3-value allowlist on create (HIGH-4).
4. **Plan 04** — Expand rules-tests to ≥10 covering full denial surface (MEDIUM-8).
5. **Plan 03** — Skip unknown pick types BEFORE the transaction; never settle UFC
   ghost picks (HIGH-4).
6. **Plan 03** — Define and implement counter ownership for `picksTotal` +
   `lastPickAt` (HIGH-2).
7. **Plan 03** — Branch `AUTO_ZERO_GRACE_MS` by pickType; F1 ≥ 24h (MEDIUM-5).
8. **Plan 03** — Per-tick fetch cache by `(leagueKey, gameId)` and `(f1Year, f1Round)`
   (MEDIUM-10).
9. **Plan 03 (or 04)** — Add `firestore.indexes.json` updates for the two
   composite-index requirements; Plan 06 deploys them (HIGH-3).
10. **Plan 05** — Validate `f1Year` integer + `f1Round` non-empty before submit
    (MEDIUM-6).
11. **Plan 05** — Resolve D-09 prefill source per CONTEXT (`wp.participants[mid].teamAllegiance`
    inside wp; defined fallback or omit otherwise) (MEDIUM-7).
12. **Plan 05** — Aggregate listener teardown for chunked onSnapshots (MEDIUM-11).
13. **Plan 05** — UI-level guard before `submitPick` rejecting `leagueKey === 'ufc'`
    AND non-allowlisted `pickType` (HIGH-4 defense-in-depth).
14. **Plan 06** — Preflight check for `--sync-rules` flag existence; explicit index
    deploy step (LOW-13).
15. **Plan 06** — Replace fragile `HELPER_ASSERTIONS = 27` math with named-group
    counters (LOW-15).

Once these amendments land in the plan files (most cleanly via
`/gsd-plan-phase 28 --reviews` to regenerate Plans 03–06 against this REVIEWS.md),
the phase is well-shaped to execute.

---

*Review generated: 2026-05-05.
Workflow: `/gsd-review --phase 28 --all` (claude self-skipped — running inside
Claude Code session).
To incorporate feedback: `/gsd-plan-phase 28 --reviews`.*
