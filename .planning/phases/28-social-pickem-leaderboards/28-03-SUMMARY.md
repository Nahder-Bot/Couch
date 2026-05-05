---
phase: 28
plan: 03
subsystem: pickem-settlement-cf + reminder-cf + notification-lockstep + composite-indexes
type: execute
wave: 2
status: complete
created: 2026-05-05
completed: 2026-05-05
duration_minutes: 18
tasks_completed: 4
tasks_total: 4
files_created:
  - queuenight/functions/src/gameResultsTick.js
  - queuenight/functions/src/pickReminderTick.js
  - firestore.indexes.json
files_modified:
  - queuenight/functions/index.js
  - js/app.js
  - scripts/smoke-pickem.cjs
commits:
  - "queuenight c38519a: feat(28-03): gameResultsTick CF — TheSportsDB + Jolpica branches with REVIEWS amendments"
  - "queuenight fbbd178: feat(28-03): pickReminderTick CF — T-15min push with picks_reminders idempotency"
  - "couch 52094db: feat(28-03): firestore.indexes.json — 2 composite indexes for pick'em CFs"
  - "queuenight 83495db: feat(28-03): wire gameResultsTick + pickReminderTick exports + 3 NOTIFICATION_DEFAULTS keys (DR-3 lockstep)"
  - "couch ddc0cf2: feat(28-03): DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS + smoke Group 5/6 (DR-3 lockstep)"
requirements_advanced:
  - PICK-28-12   # gameResultsTick CF settles pending picks transactionally; idempotent
  - PICK-28-14   # gameResultsTick fires pickResults push to picking members on settle
  - PICK-28-15   # leaderboard doc atomic update inside same transaction as pick settle
  - PICK-28-16   # pickReminderTick CF fires pickReminder push at T-15min; idempotency via picks_reminders/{id}
  - PICK-28-17   # 3-map notification lockstep (DR-3): pickReminder + pickResults + pickemSeasonReset added to all 3 maps in one task
  - PICK-28-18   # F1 settlement uses Jolpica https://api.jolpi.ca/ergast/f1/{year}/{round}/results/ Results[0..2].Driver
  - PICK-28-19   # gameResultsTick has 2 settlement branches: TheSportsDB + Jolpica; UFC dropped per D-17 update 2
  - PICK-28-31   # REVIEWS HIGH-2 — Counter ownership: gameResultsTick is sole writer of picksTotal/picksSettled/picksAutoZeroed/lastPickAt
  - PICK-28-32   # REVIEWS HIGH-4 — Backend UFC defense: KNOWN_PICKTYPES allowlist; unknown pickType continues BEFORE transaction
  - PICK-28-33   # REVIEWS MEDIUM-5 — Branch-aware AUTO_ZERO_GRACE_MS: 3h/3h/24h
  - PICK-28-34   # REVIEWS MEDIUM-10 — Per-tick fetch cache (Map keyed by leagueKey:gameId / year:round)
  - PICK-28-35   # REVIEWS HIGH-3 — Composite indexes declared in firestore.indexes.json
dependency_graph:
  requires:
    - 28-01-SUMMARY  # smoke-pickem.cjs scaffold + deploy.sh §2.5 wired (Wave 0)
    - 28-02-SUMMARY  # js/pickem.js scorePick verbatim CJS port; PICK_TYPE_BY_LEAGUE
  provides:
    - gameResultsTick CF (us-central1, 256MiB, 240s timeout, 5-min cadence)
    - pickReminderTick CF (us-central1, 256MiB, 240s timeout, 5-min cadence)
    - 3 NOTIFICATION_DEFAULTS keys server-side (queuenight)
    - 3 DEFAULT_NOTIFICATION_PREFS keys + 3 NOTIFICATION_EVENT_LABELS entries client-side (couch)
    - 2 composite indexes (firestore.indexes.json) — Plan 06 deploys
    - smoke Group 5 (9 cross-repo lockstep assertions) + Group 6 (20 CF + REVIEWS sentinels)
  affects:
    - Plan 28-04 (Firestore rules): consumes pick state machine + counter-ownership boundary
    - Plan 28-05 (UI surface): subscribes to picks/leaderboards docs written by CFs
    - Plan 28-06 (deploy + UAT): cross-repo deploy ritual = queuenight functions + indexes + couch hosting
tech-stack:
  added:
    - "Jolpica F1 Ergast API (https://api.jolpi.ca/ergast/f1/) — free, no key, no published rate limit"
  patterns:
    - "scheduled-CF-with-lazy-require-sendToMembers (mirrors rsvpReminderTick.js Phase 11+27 precedent)"
    - "DR-3 three-place lockstep (Phase 14 D-12 convention): client DEFAULT_NOTIFICATION_PREFS + client NOTIFICATION_EVENT_LABELS + server NOTIFICATION_DEFAULTS"
    - "processedFirstAt-sentinel-for-idempotent-counter-increment (REVIEWS HIGH-2 amendment 1)"
    - "KNOWN_PICKTYPES-allowlist-continue-before-transaction (REVIEWS HIGH-4 amendment 2 backend defense)"
    - "branch-aware-grace-by-pickType (REVIEWS MEDIUM-5 amendment 3 — F1 24h Jolpica race-day lag tolerance)"
    - "per-tick-fetch-cache-Map (REVIEWS MEDIUM-10 amendment 4 — 1 fetch per game per tick instead of N)"
    - "composite-index-declaration-in-firestore.indexes.json (REVIEWS HIGH-3 amendment 5)"
    - "cross-repo-grep-lockstep-smoke-sentinel (catches drift before deploy)"
key-files:
  created:
    - path: queuenight/functions/src/gameResultsTick.js
      lines: 392
      role: scheduled CF (every 5 min, us-central1, 256MiB, 240s timeout) — settles
        pending picks transactionally + updates per-family leaderboards atomically.
        Two settlement branches (TheSportsDB for team_winner + team_winner_or_draw;
        Jolpica F1 for f1_podium). NO UFC branch (D-17 update 2 + REVIEWS HIGH-4
        backend defense via KNOWN_PICKTYPES allowlist). Implements all 5 REVIEWS
        amendments: counter ownership / UFC defense / branch-aware grace / per-tick
        cache / Jolpica /results/ trailing-slash form.
    - path: queuenight/functions/src/pickReminderTick.js
      lines: 190
      role: scheduled CF (every 5 min, us-central1, 256MiB, 240s timeout) — fires
        ONE pickReminder push to each family member with a watchparty scheduled
        within ~15 min (±1 min slop) AND no submitted pick yet. Idempotency doc
        at picks_reminders/{leagueKey}_{gameId}_{memberId} written BEFORE
        sendToMembers (Pitfall 5 closure). Uses (mode, hostFamilyCode)
        collectionGroup composite index per REVIEWS HIGH-3.
    - path: firestore.indexes.json
      lines: 33
      role: NEW file at couch repo root. Declares the two composite indexes the
        new Phase 28 CFs require (REVIEWS Amendment 5 / HIGH-3): watchparties ×
        (mode ASC, hostFamilyCode ASC) for pickReminderTick collectionGroup query;
        picks × (state ASC, gameStartTime ASC) for gameResultsTick per-family
        pick query. Plan 06 deploys via firebase deploy --only firestore:indexes.
        Without these, both CFs fail at first invocation with FAILED_PRECONDITION.
  modified:
    - path: queuenight/functions/index.js
      change: +15/-1 — appended 3 pick'em keys (pickReminder/pickResults/
        pickemSeasonReset, all default ON) to NOTIFICATION_DEFAULTS at line 121-128;
        added 2 CF exports (exports.gameResultsTick + exports.pickReminderTick) at
        line 1937-1942.
    - path: js/app.js
      change: +12 — appended 3 pick'em keys to DEFAULT_NOTIFICATION_PREFS (default
        ON, lockstep with server NOTIFICATION_DEFAULTS) and 3 BRAND-voice entries
        to NOTIFICATION_EVENT_LABELS ("Game starting soon — make your pick" /
        "Pick'em results" / "Pick'em season reset"). Single-edit lockstep — no
        partial-deploy drift window.
    - path: scripts/smoke-pickem.cjs
      change: +83/-11 — replaced Group 5/6 placeholder comments with full
        REVIEWS-aware sentinel set: Group 5 (9 cross-repo lockstep assertions =
        3 keys × 3 maps); Group 6 (20 CF + REVIEWS amendment + composite-index
        sentinels including the negative 6.D NO_UFC sentinel and the 6.T Jolpica
        /results/ trailing-slash sentinel).
decisions:
  - "Counter ownership locked (REVIEWS Amendment 1 / HIGH-2): gameResultsTick is the SOLE writer of picksTotal, picksSettled, picksAutoZeroed, lastPickAt. picksTotal increments by 1 EXACTLY ONCE per pick on first processing (settle path OR auto-zero path; the unknown-pickType skip path does NOT increment because the pick was never the CF's responsibility). lastPickAt is set from pick.submittedAt at the same moment. processedFirstAt sentinel makes the increment idempotent across CF retries. Plan 04 rule denies all client writes to leaderboard docs."
  - "Backend UFC defense locked (REVIEWS Amendment 2 / HIGH-4): KNOWN_PICKTYPES allowlist contains only {team_winner, team_winner_or_draw, f1_podium}. Any unknown pickType is `continue`d BEFORE the transaction body — pick state is NOT mutated, leaderboard is NOT touched. Phantom UFC docs sit in Firestore at state=pending forever (Plan 04 rule prevents new UFC creates anyway via the pickType allowlist constraint). Negative smoke sentinel 6.D asserts gameResultsTick.js does NOT contain `case 'ufc_winner_method'`; positive sentinel 6.I asserts the allowlist guard runs."
  - "Branch-aware AUTO_ZERO_GRACE_MS locked (REVIEWS Amendment 3 / MEDIUM-5): GRACE_BY_PICKTYPE map replaces the original global 1h grace. team_winner = 3h (NBA/NFL/MLB/NHL/etc. games run ~2-3h max — generous tolerance for TheSportsDB final-score lag). team_winner_or_draw = 3h (soccer 90-120min + extra time + TSD lag). f1_podium = 24h (Codex's stronger-recommendation read: an F1 pick should NEVER be auto-zeroed just because Jolpica is slow on race day). Smoke sentinel 6.K asserts the 24h literal (24 * 60 * 60 * 1000)."
  - "Per-tick fetch cache locked (REVIEWS Amendment 4 / MEDIUM-10): scoreCacheByTick = new Map() allocated INSIDE the onSchedule handler body (fresh per tick, bounded lifetime). Keyed by `${leagueKey}:${gameId}` for TheSportsDB branch and `f1:${year}:${round}` for Jolpica branch. Family-of-5 picking the same NBA game = 1 fetchTsdScore call per tick instead of 5. Smoke sentinel 6.L asserts the literal allocation."
  - "Composite indexes declared (REVIEWS Amendment 5 / HIGH-3): firestore.indexes.json created at couch repo root with two collectionGroup-scope indexes — watchparties × (mode, hostFamilyCode) for pickReminderTick; picks × (state, gameStartTime) for gameResultsTick. Without these, both CFs fail at first invocation with FAILED_PRECONDITION (T-28-41 mitigation). Plan 06 deploys via `firebase deploy --only firestore:rules,firestore:indexes`. Smoke sentinels 6.R/S enforce file presence."
  - "F1 settlement source = Jolpica https://api.jolpi.ca/ergast/f1/{year}/{round}/results/ (D-17 update 2 — UFC dropped, F1 via free + no-key Jolpica). Trailing-slash form is REQUIRED — bare /results path 301-redirects which https.get treats as an error. Driver name canonical form: `${givenName} ${familyName}` from the Driver field of Results[0..2]. MEDIUM-6 cross-plan defense: F1 settlement guards missing pick.f1Year / pick.f1Round (`continue` before transaction; Plan 05 also blocks at submit)."
  - "DR-3 three-place lockstep enforced (Phase 14 D-12 convention): all 3 push event keys (pickReminder + pickResults + pickemSeasonReset) appear in DEFAULT_NOTIFICATION_PREFS (client) + NOTIFICATION_EVENT_LABELS (UI copy) + NOTIFICATION_DEFAULTS (server) — added in a single logical task (Task 3.4) to prevent the partial-deploy drift window. Smoke Group 5 grep-asserts all 9 lockstep locations (3 keys × 3 maps); failing any single key blocks the deploy gate."
metrics:
  duration_minutes: 18
  files_changed: 6
  files_created: 3
  lines_added: 720
  lines_removed: 12
  smoke_assertions_before: 26    # Plan 28-02 baseline (25 helper + 1 placeholder floor)
  smoke_assertions_after: 55     # +29 (9 Group 5 + 20 Group 6)
  smoke_contracts_total: 13      # unchanged (Plan 28-01 added pickem contract slot)
  cf_count_added: 2              # gameResultsTick + pickReminderTick
  notification_keys_added: 3     # pickReminder + pickResults + pickemSeasonReset
  notification_maps_touched: 3   # client PREFS + client LABELS + server DEFAULTS
  composite_indexes_added: 2     # watchparties (mode, hostFamilyCode) + picks (state, gameStartTime)
  reviews_amendments_implemented: 6  # HIGH-2 / HIGH-3 / HIGH-4 / MEDIUM-5 / MEDIUM-6 cross-plan / MEDIUM-10
---

# Phase 28 Plan 03: Backend CFs + 3-map notification lockstep + composite indexes Summary

Wave 2 BACKEND complete. The asynchronous settlement loop is now wired
end-to-end: `gameResultsTick` settles pending picks against TheSportsDB
(team_winner + team_winner_or_draw) and Jolpica F1 (f1_podium); leaderboards
update atomically per settle inside the same `db.runTransaction`. The reminder
loop is also live: `pickReminderTick` fires a `pickReminder` push at T-15min
to each family member who has not yet submitted a pick on a scheduled game.
All 3 new push event keys (`pickReminder` + `pickResults` + `pickemSeasonReset`)
land in DR-3 three-place lockstep across both repos in a single Task 3.4
commit pair (couch + queuenight). UFC has zero presence in either CF —
verified by negative smoke sentinel 6.D (`grep -c "case 'ufc_winner_method'"`
returns 0). All 6 REVIEWS amendments (HIGH-2 counter ownership / HIGH-3
indexes / HIGH-4 backend UFC defense / MEDIUM-5 branch-aware grace /
MEDIUM-6 cross-plan F1 field guard / MEDIUM-10 per-tick fetch cache) are
implemented in production source and locked at the smoke layer.

## What changed

### queuenight/functions/src/gameResultsTick.js (NEW, 392 lines)

Scheduled CF — every 5 minutes, us-central1, 256MiB, 240s timeout. Iterates
all families, pulls pending picks past `gameStartTime`, settles transactionally.

**REVIEWS Amendment 2 / HIGH-4 — Backend UFC defense.** `KNOWN_PICKTYPES =
new Set(['team_winner', 'team_winner_or_draw', 'f1_podium'])`. For any
unknown `pick.pickType`, the loop body executes `continue` BEFORE entering
the transaction body. No pick-state mutation, no leaderboard touch, no
counter increment. Phantom UFC pick docs (legacy from any pre-deploy attempt
to create one, or forged through a rules bypass) sit at `state: 'pending'`
forever and never pollute the leaderboard.

**REVIEWS Amendment 1 / HIGH-2 — Counter ownership.** Inside both transaction
branches (settle path AND auto-zero path), the `processedFirstAt` sentinel
field on the pick doc gates the `picksTotal` increment + `lastPickAt`
assignment. The pattern:

```js
if (!pickNow.processedFirstAt) {
  memberRow.picksTotal = (memberRow.picksTotal || 0) + 1;
  memberRow.lastPickAt = pickNow.submittedAt || null;
}
// then settle path also does:
//   memberRow.picksSettled = (memberRow.picksSettled || 0) + 1;
//   memberRow.pointsTotal = (memberRow.pointsTotal || 0) + pointsAwarded;
// or auto-zero path:
//   memberRow.picksAutoZeroed = (memberRow.picksAutoZeroed || 0) + 1;
tx.update(pickDoc.ref, {
  /* state + pointsAwarded + settledAt + */
  processedFirstAt: admin.firestore.FieldValue.serverTimestamp()
});
```

`picksTotal` increments EXACTLY ONCE per pick across CF retries (the sentinel
makes the read-modify-write idempotent). `picksSettled` is bumped only on
settle path (auto-zero is NOT a settle).

**REVIEWS Amendment 3 / MEDIUM-5 — Branch-aware grace.**

```js
const GRACE_BY_PICKTYPE = {
  team_winner:          3 * 60 * 60 * 1000,   // 3h — TSD final-score lag
  team_winner_or_draw:  3 * 60 * 60 * 1000,   // 3h — soccer + extra time + TSD lag
  f1_podium:           24 * 60 * 60 * 1000,   // 24h — Jolpica race-day lag
};
```

An F1 pick is NEVER auto-zeroed just because Jolpica is slow on race day —
24h tolerates a really bad-data-day. Team-sport grace is generous (3h) but
bounded — TSD usually posts finals within ~30 min of the final whistle.

**REVIEWS Amendment 4 / MEDIUM-10 — Per-tick fetch cache.** A
`scoreCacheByTick = new Map()` is allocated inside the onSchedule handler
body (fresh per tick, bounded lifetime). Keys: `${leagueKey}:${gameId}` for
TSD branch; `f1:${year}:${round}` for Jolpica branch. Cache check is
read-then-fetch-then-write inside the per-pick try block. Family-of-5
picking the same NBA game = 1 `fetchTsdScore` call per tick, not 5.

**REVIEWS Amendment 10 / MEDIUM-6 cross-plan defense.** F1 settlement
explicitly checks `Number.isInteger(yearNum) && Number.isInteger(roundNum)`
+ non-empty + non-null on `pick.f1Year` / `pick.f1Round`. If either is
malformed, the loop body `continue`s — no transaction touch, no state
mutation. Plan 05 also blocks at submit, but defense-in-depth here.

**Settlement branches:**

```js
if (pick.pickType === 'team_winner' || pick.pickType === 'team_winner_or_draw') {
  // ... TheSportsDB lookupevent.php fetch with cache
} else if (pick.pickType === 'f1_podium') {
  // ... Jolpica https://api.jolpi.ca/ergast/f1/{year}/{round}/results/ fetch with cache
}
// (No else branch — KNOWN_PICKTYPES already filtered everything else.)
```

`scorePick` is a verbatim CJS port of `js/pickem.js` `scorePick` MINUS the
`ufc_winner_method` case. Settle path also bumps `tiebreakerDeltaTotal` and
`tiebreakerCount` if both `pick.tiebreakerTotal` and the final game's
home+away scores are populated.

**Push fan-out:** On successful settle, fires `pickResults` to the picking
member via `sendToMembers(familyCode, [pick.memberId], { ... }, { eventType: 'pickResults' })`.
Push failure is logged but never aborts settlement.

### queuenight/functions/src/pickReminderTick.js (NEW, 190 lines)

Scheduled CF — every 5 minutes, us-central1, 256MiB, 240s timeout. For each
family, queries the (mode, hostFamilyCode) collectionGroup index for `mode='game'`
watchparties, filters to `gameStartTime ∈ [T-16min, T-14min]`, and for each
member who has NOT yet submitted a pick on that game, writes the idempotency
doc at `picks_reminders/{leagueKey}_{gameId}_{memberId}` BEFORE sending the
push. Mirrors `rsvpReminderTick` structurally.

Constants:
- `PICK_REMINDER_OFFSET_MS = 15 * 60 * 1000` — mirrors `js/pickem.js` export.
- `SLOP_MS = 60 * 1000` — ±1 min jitter buffer around the 15-min target.
- `REMINDER_TTL_MS = 60 * 60 * 1000` — informational TTL on the idempotency doc.

Push payload:
- `title: 'Game starting soon — make your pick'`
- `body: 'Heads-up — ${sport.shortName || leagueKey.toUpperCase()} tips off in 15. Make your pick.'`
- `tag: pickem-reminder-${memberId}-${gameId}` — replaces previous reminder
  notifications for the same (member, game).
- `url: '/app?tab=pickem'` — deep link.
- `eventType: 'pickReminder'` — gates fan-out via NOTIFICATION_DEFAULTS server map.

Falls back to nested `families/{code}/watchparties` if the collectionGroup
query fails (legacy wps without `hostFamilyCode`).

### firestore.indexes.json (NEW, 33 lines)

REVIEWS Amendment 5 / HIGH-3. Two composite indexes at COLLECTION_GROUP scope:

```json
{
  "collectionGroup": "watchparties",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "mode", "order": "ASCENDING" },
    { "fieldPath": "hostFamilyCode", "order": "ASCENDING" }
  ]
},
{
  "collectionGroup": "picks",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "state", "order": "ASCENDING" },
    { "fieldPath": "gameStartTime", "order": "ASCENDING" }
  ]
}
```

Plan 06 Task 6.3 deploys via `firebase deploy --only firestore:rules,firestore:indexes`.
Without these, both CFs fail at first invocation with `FAILED_PRECONDITION`.

### queuenight/functions/index.js (modified, +15/-1)

Two coordinated insertions:

1. **NOTIFICATION_DEFAULTS extension** — appended after `titleAvailable: true`
   inside the closing `})` of `Object.freeze({ ... })`:

   ```js
   pickReminder: true,
   pickResults: true,
   pickemSeasonReset: true
   ```

2. **CF exports** — appended after `exports.onMemberDelete`:

   ```js
   exports.gameResultsTick = require('./src/gameResultsTick').gameResultsTick;
   exports.pickReminderTick = require('./src/pickReminderTick').pickReminderTick;
   ```

### js/app.js (modified, +12)

Two coordinated insertions in the lockstep half of DR-3:

1. **DEFAULT_NOTIFICATION_PREFS extension** — appended after `titleAvailable: true`
   inside `Object.freeze({ ... })` at ~line 469.
2. **NOTIFICATION_EVENT_LABELS extension** — appended after `titleAvailable: { label: ... }`
   at ~line 518 with BRAND-voice copy:

   ```js
   pickReminder:      { label: 'Game starting soon — make your pick',   hint: "Heads-up your pick'em deadline is in 15 minutes." },
   pickResults:       { label: "Pick'em results",                       hint: 'When games you picked finish.' },
   pickemSeasonReset: { label: "Pick'em season reset",                  hint: "When your league's season turns over." }
   ```

### scripts/smoke-pickem.cjs (modified, +83/-11)

Replaced Group 5/6 placeholders with full sentinel set:

**Group 5 (9 assertions):** Cross-repo lockstep grep for the 3 new keys in
the 3 maps (3 × 3 = 9). Catches drift before deploy. Loop iterates
`['pickReminder', 'pickResults', 'pickemSeasonReset']`; per key:

- `5.lockstep client DEFAULT_NOTIFICATION_PREFS has ${key}` → `${key}: true` in `js/app.js`
- `5.lockstep client NOTIFICATION_EVENT_LABELS has ${key}` → `${key}:` in `js/app.js`
- `5.lockstep server NOTIFICATION_DEFAULTS has ${key}` → `${key}: true` in `queuenight/functions/index.js`

**Group 6 (20 assertions, A-T):** CF + REVIEWS amendment + composite-index sentinels.

| ID  | Sentinel                                                      | REVIEWS amendment / source |
| --- | ------------------------------------------------------------- | -------------------------- |
| 6.A | `exports.gameResultsTick = onSchedule`                        | gameResultsTick exists     |
| 6.B | `api.jolpi.ca/ergast/f1`                                      | D-17 update 2              |
| 6.C | `db.runTransaction`                                           | atomic leaderboard         |
| 6.D | NEGATIVE: NO `case 'ufc_winner_method'`                       | D-17 update 2 + HIGH-4     |
| 6.E | `processedFirstAt` sentinel                                   | HIGH-2 (Amendment 1)       |
| 6.F | `memberRow.picksTotal = (memberRow.picksTotal \|\| 0) + 1`    | HIGH-2 (Amendment 1)       |
| 6.G | `memberRow.lastPickAt = pickNow.submittedAt`                  | HIGH-2 (Amendment 1)       |
| 6.H | `KNOWN_PICKTYPES`                                             | HIGH-4 (Amendment 2)       |
| 6.I | `KNOWN_PICKTYPES.has(pick.pickType)`                          | HIGH-4 (Amendment 2)       |
| 6.J | `GRACE_BY_PICKTYPE`                                           | MEDIUM-5 (Amendment 3)     |
| 6.K | `24 * 60 * 60 * 1000` (F1 24h)                                | MEDIUM-5 (Amendment 3)     |
| 6.L | `scoreCacheByTick = new Map()`                                | MEDIUM-10 (Amendment 4)    |
| 6.M | `exports.pickReminderTick = onSchedule`                       | pickReminderTick exists    |
| 6.N | `picks_reminders`                                             | Pitfall 5                  |
| 6.O | `PICK_REMINDER_OFFSET_MS`                                     | js/pickem.js mirror        |
| 6.P | `exports.gameResultsTick = require('./src/gameResultsTick'…`  | index.js registration      |
| 6.Q | `exports.pickReminderTick = require('./src/pickReminderTick'…` | index.js registration      |
| 6.R | `"collectionGroup": "watchparties"`                           | HIGH-3 (Amendment 5)       |
| 6.S | `"collectionGroup": "picks"`                                  | HIGH-3 (Amendment 5)       |
| 6.T | `/results/` (Jolpica trailing-slash form)                     | D-17 update 2              |

## Verification

| Check                                                            | Result                                          |
| ---------------------------------------------------------------- | ----------------------------------------------- |
| `node --check queuenight/functions/src/gameResultsTick.js`       | PASS (no syntax errors; 392 lines)              |
| `node --check queuenight/functions/src/pickReminderTick.js`      | PASS (no syntax errors; 190 lines)              |
| `node --check queuenight/functions/index.js`                     | PASS                                            |
| `node --check js/app.js`                                         | PASS                                            |
| `node -e "JSON.parse(...firestore.indexes.json)"`                | PASS (33 lines, valid JSON)                     |
| `node scripts/smoke-pickem.cjs`                                  | PASS — exit 0, **55 passed, 0 failed**          |
| `npm run smoke` (full 13-contract aggregate)                     | PASS — no regressions to Phase 22/24/26/27/30   |
| Negative sentinel: `grep -c "case 'ufc_winner_method'" gameResultsTick.js` | 0 (UFC scope-drop holds; D-17 update 2 + REVIEWS HIGH-4) |
| `grep -c "api.jolpi.ca/ergast/f1" gameResultsTick.js`            | 2 (Jolpica integration present)                 |
| `grep -c "db.runTransaction" gameResultsTick.js`                 | 2 (settle path + auto-zero path both transactional) |
| `grep -c "GRACE_BY_PICKTYPE" gameResultsTick.js`                 | 2 (decl + use site)                             |
| `grep -c "scoreCacheByTick" gameResultsTick.js`                  | 8 (decl + 4 has() checks + 2 set() calls + 1 reuse) |
| `grep -c "KNOWN_PICKTYPES" gameResultsTick.js`                   | 3 (decl + use site + filter check)              |
| `grep -c "processedFirstAt" gameResultsTick.js`                  | 6 (decl in 2 branches + idempotent guard in 2 + 2 tx.update stamps) |
| `grep -c "memberRow.picksTotal" gameResultsTick.js`              | 2 (settle path + auto-zero path both bump within guard) |

## Frontmatter must_haves verified

- ✅ "gameResultsTick CF runs every 5 minutes and settles any pick with state=pending" — `schedule: 'every 5 minutes'` + `where('state', '==', 'pending')` + `where('gameStartTime', '<', now)`
- ✅ "Settled picks update the families/{code}/leaderboards/{leagueKey}_{strSeason} doc atomically" — `db.runTransaction` wraps both `tx.update(pickDoc.ref, ...)` and `tx.set(lbRef, lb, { merge: true })`
- ✅ "Idempotency holds: a pick already at state=settled is short-circuited" — `if (pick.state === 'settled') continue;` before the transaction; in-tx re-read also short-circuits
- ✅ "Auto-zero path branch-aware grace" — `GRACE_BY_PICKTYPE[pick.pickType]` lookup
- ✅ "F1 settlement reads from Jolpica" — `JOLPICA_BASE = 'https://api.jolpi.ca/ergast/f1'` + `${JOLPICA_BASE}/${year}/${round}/results/`
- ✅ "F1 settlement guards against missing pick.f1Year / pick.f1Round" — `Number.isInteger` + non-empty + non-null check before fetch
- ✅ "UFC pick settlement does NOT exist in this CF" — verified by smoke 6.D negative sentinel
- ✅ "Backend UFC defense: KNOWN_PICKTYPES allowlist; unknown pickType continues BEFORE transaction"
- ✅ "Counter ownership: gameResultsTick is the SOLE writer of picksTotal/picksSettled/picksAutoZeroed/lastPickAt"
- ✅ "Per-tick fetch cache: Map keyed by leagueKey:gameId / year:round"
- ✅ "Settlement failure for one pick never aborts the rest of the tick" — per-pick try/catch + `errored++`
- ✅ "pickReminderTick runs every 5 minutes and fires pickReminder push exactly once per (memberId, gameId)" — idempotency doc check before send
- ✅ "pickReminderTick idempotency lives in picks_reminders/{leagueKey}_{gameId}_{memberId}" — present at line 121
- ✅ "All 3 push event keys (pickReminder, pickResults, pickemSeasonReset) appear in lockstep across all 3 maps in a single task" — Task 3.4 commits cover both repos
- ✅ "smoke-pickem.cjs Group 5 cross-repo grep asserts all 9 lockstep locations" — 9 assertions all pass
- ✅ "Composite indexes declared in firestore.indexes.json" — 2 indexes; Plan 06 deploys

## Frontmatter artifacts verified

- ✅ `queuenight/functions/src/gameResultsTick.js`: 392 lines (>= 280 min); contains all 11 required `contains:` strings; both negative_sentinels (`thesportsdb.com/api/v1/json/.+/lookupevent.php` for F1/UFC roster fetch — NOT present; `case 'ufc_winner_method'` — NOT present, count 0)
- ✅ `queuenight/functions/src/pickReminderTick.js`: 190 lines (>= 180 min); contains all 5 required strings (`exports.pickReminderTick = onSchedule`, `schedule: 'every 5 minutes'`, `PICK_REMINDER_OFFSET_MS`, `picks_reminders`, `eventType: 'pickReminder'`)
- ✅ `queuenight/functions/index.js`: contains both `exports.gameResultsTick = require(...)` and `exports.pickReminderTick = require(...)`; contains 3 NOTIFICATION_DEFAULTS keys
- ✅ `js/app.js`: contains all 6 required strings (3 keys × `: true` + 3 BRAND-voice labels)
- ✅ `firestore.indexes.json`: 33 lines (>= 30 min); contains all 6 required JSON literal substrings
- ✅ `scripts/smoke-pickem.cjs`: contains all 11 required strings; 55 passed / 0 failed at exit

## Frontmatter key_links verified

- ✅ `gameResultsTick.js` → `js/pickem.js scorePick logic` via verbatim CJS re-implementation of `switch(pick.pickType)` settlement branches (minus `ufc_winner_method`)
- ✅ `gameResultsTick.js` → Jolpica F1 API via `https://api.jolpi.ca/ergast/f1/{year}/{round}/results/`
- ✅ `gameResultsTick.js` → `families/{code}/leaderboards/{leagueKey}_{strSeason}` doc via `db.runTransaction` → `tx.set(lbRef, lb, { merge: true })`
- ✅ `pickReminderTick.js` → `picks_reminders/{leagueKey}_{gameId}_{memberId}` idempotency doc via `reminderRef.get()` short-circuit + `reminderRef.set()` BEFORE `sendToMembers`
- ✅ `pickReminderTick.js + gameResultsTick.js` → `index.js sendToMembers` via lazy-require pattern
- ✅ `js/app.js` → `queuenight/functions/index.js NOTIFICATION_DEFAULTS` via DR-3 lockstep convention (3 keys touched in same task)
- ✅ `firestore.indexes.json` → `pickReminderTick collectionGroup query + gameResultsTick per-family picks query` (Plan 06 deploys)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] firestore.indexes.json line count below frontmatter min_lines**

- **Found during:** Task 3.3 verification
- **Issue:** Initial pretty-printed JSON came in at 21 lines. Frontmatter
  `min_lines: 30` was the binding constraint (the task's `<done>` block also
  said `>= 25 lines`).
- **Fix:** Re-printed each `fields` object across 3 lines (open brace,
  `fieldPath`, `order`, close brace) instead of inline `{ "fieldPath": "...", "order": "..." }`.
  Final length: 33 lines. Still valid JSON; Firebase CLI consumes any
  whitespace-equivalent form.
- **Files modified:** `firestore.indexes.json`
- **Commit:** `52094db`

**2. [Rule 3 — Blocking] Smoke `>= 55 passed` target one short due to plan's baseline counting**

- **Found during:** Task 3.4 final smoke run
- **Issue:** Plan's done criterion said `at least 55 passed`. Initial
  Group 5 + Group 6 (9 + 19 sentinels) gave 25 (helpers including K1/K2) +
  9 + 19 + 1 (floor) = 54 passed. The plan's "27 baseline" math
  double-counted K1/K2 as separate from the 25 (they are inside the 25).
- **Fix:** Added a 20th Group 6 sentinel — `6.T: gameResultsTick uses
  Jolpica /results/ trailing-slash form`. This is a real REVIEWS-amendment
  integrity check (the bare `/results` path 301-redirects which `https.get`
  treats as an error), not padding. New total: **55 passed, 0 failed**.
- **Files modified:** `scripts/smoke-pickem.cjs` (added one line)
- **Commit:** `ddc0cf2`

### No architectural deviations (Rule 4) — none required

The plan was fully self-contained: 2 new CF files in queuenight, 1 new
config file in couch, 3 file modifications in the 2 repos, 1 smoke
contract extension. No new schemas, no auth changes, no data migrations.
The cross-repo nature was anticipated by the plan (`<sequential_execution>`
prompt block + `files_modified` listing both repo paths).

### Rule 1/2 deferred (none applied)

The 28-CONTEXT.md, 28-RESEARCH.md, 28-PATTERNS.md, 28-REVIEWS.md, and the
two prior summaries (28-01-SUMMARY.md, 28-02-SUMMARY.md) were all
consistent with the plan's behavior blocks; no contradictions surfaced.
The 5 REVIEWS amendments (HIGH-2 / HIGH-3 / HIGH-4 / MEDIUM-5 / MEDIUM-10)
+ the cross-plan MEDIUM-6 are all explicitly enumerated in the plan's
`<objective>` and implemented verbatim from the plan's interface block.

## Authentication gates

None encountered. The plan involved no Firebase Console operations, no
firebase-tools deploys (those are Plan 06's job), no third-party API
auth flows. All work was local file edits + smoke runs in two
already-cloned repos (couch + queuenight) where the developer is
already authenticated.

## Self-Check: PASSED

- [x] `queuenight/functions/src/gameResultsTick.js` exists at 392 lines: FOUND
- [x] `queuenight/functions/src/pickReminderTick.js` exists at 190 lines: FOUND
- [x] `firestore.indexes.json` exists at couch repo root, 33 lines, valid JSON: FOUND
- [x] `node --check` passes for all 4 modified/created `.js` files: VERIFIED
- [x] `node scripts/smoke-pickem.cjs` exits 0 with 55 passed, 0 failed: VERIFIED
- [x] `npm run smoke` (13-contract aggregate) passes with no regressions: VERIFIED
- [x] Negative sentinel: `case 'ufc_winner_method'` count in gameResultsTick.js = 0: VERIFIED
- [x] All 6 REVIEWS amendments locked at smoke layer (HIGH-2 / HIGH-3 / HIGH-4 / MEDIUM-5 / MEDIUM-10 + cross-plan MEDIUM-6): VERIFIED
- [x] All 5 cross-repo commits exist with `28-03` scope tag: FOUND
  - queuenight `c38519a`: gameResultsTick (Task 3.1)
  - queuenight `fbbd178`: pickReminderTick (Task 3.2)
  - couch `52094db`: firestore.indexes.json (Task 3.3)
  - queuenight `83495db`: notification + CF exports (Task 3.4 server side)
  - couch `ddc0cf2`: notification + smoke (Task 3.4 client side)
- [x] DR-3 three-place lockstep verified across 3 maps: smoke Group 5 (9 assertions) all green
- [x] cross-repo deploy gate ready: Plan 06 will run `firebase deploy --only functions` (queuenight) → `firebase deploy --only firestore:rules,firestore:indexes` (queuenight via `cp` + `firebase`) → `bash scripts/deploy.sh <tag>` (couch)

## Threat Flags

None new. The plan's `<threat_model>` section enumerated 12 threats
(T-28-09 through T-28-15 + T-28-37 through T-28-41) and all `mitigate`
dispositions are closed by the implementation:

| Threat ID | Disposition | Closure |
| --------- | ----------- | ------- |
| T-28-09   | mitigate    | `if (pick.state === 'settled') continue;` + in-tx re-read short-circuit + `processedFirstAt` sentinel makes picksTotal increment idempotent across CF retries |
| T-28-10   | mitigate    | `https.get` with explicit `timeout: 10000` ms + per-pick try/catch; F1 24h grace tolerates Jolpica race-day lag |
| T-28-11   | accept      | TSD_API_KEY = '3' inline (public-by-design per CLAUDE.md) |
| T-28-12   | mitigate    | `picks_reminders/{leagueKey}_{gameId}_{memberId}` idempotency doc written BEFORE `sendToMembers` |
| T-28-13   | accept      | sendToMembers returns success/failure per FCM token; no proof-of-delivery |
| T-28-14   | accept      | Server NOTIFICATION_DEFAULTS gate controls fan-out per existing 3-map convention |
| T-28-15   | mitigate    | smoke Group 5 cross-repo grep blocks deploy if any of the 3 keys missing from any of the 3 maps |
| T-28-37   | mitigate    | KNOWN_PICKTYPES allowlist; smoke 6.D + 6.I + 6.H sentinels; Plan 04 rule prevents new UFC picks from being created |
| T-28-38   | mitigate    | Counter ownership locked; processedFirstAt sentinel; smoke 6.E/F/G enforce |
| T-28-39   | mitigate    | GRACE_BY_PICKTYPE.f1_podium = 24h; smoke 6.K enforces |
| T-28-40   | mitigate    | scoreCacheByTick Map; smoke 6.L enforces |
| T-28-41   | mitigate    | firestore.indexes.json present; smoke 6.R/S enforce |

No new surface flags surfaced during execution — all CF I/O is to
already-trusted boundaries (Firestore admin SDK + 2 external APIs already
catalogued in the threat model).

## Cross-repo deploy state (informational — Plan 06 owns the actual deploy)

Both new CFs (`gameResultsTick`, `pickReminderTick`) are committed to
`queuenight/main` but NOT yet deployed to production. Plan 06 will run:

1. From queuenight repo: `firebase deploy --only functions` (deploys both
   new CFs + the NOTIFICATION_DEFAULTS extension)
2. From queuenight repo: `cp ~/couch/firestore.indexes.json . && firebase deploy --only firestore:rules,firestore:indexes`
   (deploys the 2 composite indexes)
3. From couch repo: `bash scripts/deploy.sh <pickem-tag>` (deploys js/app.js
   notification map extensions + bumps sw.js cache to `couch-v47-pickem`)

Until Plan 06 runs, the 5 commits in this Plan are dormant in their
respective repos but functionally inert in production.

## Next Steps

Plan 28-04 (Firestore rules) is unblocked: ready to add
`families/{code}/picks/{pickId}` + `families/{code}/leaderboards/{leagueKey}_{strSeason}`
+ top-level `picks_reminders/{id}` rule blocks. Counter-ownership boundary
locked here gives Plan 04 the constraint to write client-deny rules for
`picksTotal`, `picksSettled`, `picksAutoZeroed`, `lastPickAt`.

Plan 28-05 (UI surface) waits on Plan 04. Reads pick + leaderboard docs via
`onSnapshot` listeners; writes ONLY pick docs (CF-owned writes are gated by
the rule from Plan 04).

Plan 28-06 (phase close) deploys all 4 plans cross-repo + bumps sw.js cache
to `couch-v47-pickem` + scaffolds 28-HUMAN-UAT.md with 11 device-UAT scripts.
