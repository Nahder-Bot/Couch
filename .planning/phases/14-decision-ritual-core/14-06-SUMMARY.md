---
phase: 14-decision-ritual-core
plan: 06
plan-name: Extend intents collection + CFs (D-09 / DECI-14-09 — DR-1 reframed)
requirements_addressed: [DECI-14-09]
status: complete
completed: 2026-04-25
commits:
  - hash: 3c6b4b9
    type: feat
    msg: "feat(14-06): extend createIntent to accept 4 flow values (DR-1)"
    files: [js/app.js]
    repo: couch
  - hash: 9a09872
    type: feat
    msg: "feat(14-06): widen intents rules — 4 types + counter-chain branch (DR-1)"
    files: [firestore.rules]
    repo: couch
  - hash: NONE
    type: feat
    msg: "Tasks 3-5 edits applied to queuenight/functions/index.js (queuenight is NOT a git repo on this machine — see Two-repo discipline note below)"
    files: [C:\Users\nahde\queuenight\functions\index.js]
    repo: queuenight
files-touched:
  created: []
  modified:
    - js/app.js                                       # Task 1: createIntent extension
    - firestore.rules                                 # Task 2: intents block widening + branch (5)
    - C:\Users\nahde\queuenight\functions\index.js    # Tasks 3-5: onIntentCreated / onIntentUpdate / watchpartyTick
deviations: 1   # queuenight is not a git repo on this machine — Tasks 3-5 cannot be committed atomically per the plan instructions; documented below
checkpoints-hit: 0
auth-gates-hit: 0
---

# Phase 14 Plan 06: Extend intents collection + CFs Summary

D-09 / DR-1 reconciliation shipped: the existing Phase 8
`families/{code}/intents/` collection now accepts two new `flow` values
(`rank-pick` for Flow A, `nominate` for Flow B) with per-flow expiry,
per-flow rsvps[me] seed shape, and a `counterChainDepth` field capped at
3 by the rules. The four Phase 8 callers / readers / branches stay
untouched — they continue to read intent docs via the legacy
`intent.type` field, while new code paths read via
`intent.flow || intent.type` for back-compat.

The Cloud Functions side (`queuenight/functions/index.js`) gains 6 new
push branches without adding any new top-level CF or scheduled trigger:
4 in `onIntentCreated` (one per flow), 3 in `onIntentUpdate`
(counter-chain bump for Flow A + Flow B, reject-majority for Flow A),
and 2 new behaviors inside `watchpartyTick`'s existing intent expiry
loop (Flow B auto-convert at T-15min + T-30min hard-expire warning).

**DR-1 invariant verified across all 3 modified files:**
`grep -c "watchpartyIntents"` returns **0** in `js/app.js`,
`firestore.rules`, and `queuenight/functions/index.js`. No new
collection forked.

`grep -c "exports.watchpartyIntent"` in `queuenight/functions/index.js`
returns **0** — no new top-level CF added; the existing
`onIntentCreated` / `onIntentUpdate` / `watchpartyTick` triggers are
extended in-place.

## What shipped

### Task 1 — `js/app.js`: createIntent extension (commit 3c6b4b9)

**Function signature change** at `js/app.js:1400-ish` (line numbers
shift; locate via the marker comment
`// === D-09 createIntent extension — DECI-14-09 (DR-1: extend, do not fork) ===`):

```js
async function createIntent({ type, flow, titleId, proposedStartAt,
  proposedNote, expectedCouchMemberIds } = {}) {
  // flowVal = flow || type   (back-compat with Phase 8 callers)
  ...
}
```

**Four discrete changes from Phase 8 baseline:**

1. **Signature** — added `flow` and `expectedCouchMemberIds` arguments;
   legacy `type` callers still work because `flowVal = flow || type`.
2. **Type validation** — widened from 2 → 4 values:
   `['tonight_at_time', 'watch_this_title', 'rank-pick', 'nominate']`.
   New error key `bad_intent_flow` (was `bad_intent_type`); kept
   error-throw path so callers' try/catch still triggers.
3. **Per-flow expiresAt** branched:
   - `rank-pick` → 11pm same-day local (`new Date().setHours(23,0,0,0)`).
   - `nominate` → `(proposedStartAt || now) + 4 * 60 * 60 * 1000`.
   - `tonight_at_time` → `(proposedStartAt || now) + 3 * 60 * 60 * 1000` (preserved verbatim).
   - `watch_this_title` → `now + 30 * 24 * 60 * 60 * 1000` (preserved verbatim).
4. **Per-flow rsvps[me] seed** branched:
   - `rank-pick` / `nominate` → `{state:'in', at, actingUid, memberName}` (D-09 new vocabulary).
   - `tonight_at_time` / `watch_this_title` → `{value:'yes', at, actingUid, memberName}` (preserved verbatim).
5. **New fields written to the intent doc:**
   - `flow: flowVal` — new D-09 discriminator (always written).
   - `type: flowVal` — legacy field, also always written (back-compat with Phase 8 readers + rules).
   - `counterChainDepth: 0` — initialized for all writes (rules cap at 3 per D-07.6).
   - `expectedCouchMemberIds: [...]` — written ONLY when `flow === 'rank-pick'` AND argument provided (Flow A privacy filter input — used by CF to restrict push recipients to couch members only).
6. **`proposedStartAt` is now also written for `nominate`** flow (legacy code wrote it only for `tonight_at_time`).

### Task 2 — `firestore.rules`: intents block widening (commit 9a09872)

**Block location:** `firestore.rules:338-ish` (search for
`match /intents/{intentId} {`).

**Diff summary vs Phase 8 baseline:**

| Branch | Before | After | Notes |
|---|---|---|---|
| `allow read` | unchanged | unchanged | `isMemberOfFamily(familyCode)` |
| `allow create` | type ∈ {tonight_at_time, watch_this_title}; status==='open' | type ∈ {tonight_at_time, watch_this_title, **rank-pick, nominate**}; status==='open'; counterChainDepth (when present) bounded 0..3 | Type enum widened from 2 → 4. counterChainDepth bound prevents an attacker writing `counterChainDepth: 100` on create (T-14.06-01). |
| update (1) RSVP | `rsvps + actingUid + managedMemberId + memberId + memberName` | UNCHANGED | Inner rsvps[mid] shape (state vs value) enforced client-side. |
| update (2) Cancel | creator only; status === 'cancelled' | UNCHANGED | |
| update (3) Match | open → matched | UNCHANGED | Flow A may skip directly to converted; Flow B / Phase 8 may pass through. |
| update (4) Convert | matched → converted; affectedKeys + `convertedTo` | **open OR matched → converted; affectedKeys + `convertedTo` AND `convertedToWpId`** | Flow A converts directly from open at quorum. `convertedToWpId` added for the auto-convert + manual-convert paths. |
| update (5) **Counter-chain bump** | (did not exist) | **NEW.** Status remains 'open'; new counterChainDepth strictly equals (existing + 1) or 1; new counterChainDepth ≤ 3; affectedKeys hasOnly(rsvps + counterChainDepth + attribution-keys) | Enforces D-07.6 "3-level cap" for Flow A counter-noms + Flow B counter-times. |
| `allow delete` | false | false | Year-in-Review raw data; archival via status transitions only. |

**Rules unit tests:** the existing `tests/rules.test.js` (323 lines)
covers Phase 5 family/member/auth scenarios but has zero existing intent
tests (`grep -c intent tests/rules.test.js` → 0). Per the plan
instructions ("If no rules.test.js [intent tests] exist, do NOT scaffold
one in this plan — defer to a tech-debt follow-up"), I did NOT add new
intent test cases. **Tech-debt follow-up:** scaffold intent rules tests
in a future plan covering: rank-pick / nominate creates, counter-chain
bump from 0 → 1 succeeds, 3 → 4 fails, open → converted by creator
succeeds, cancel by non-creator fails.

### Task 3 — `queuenight/functions/index.js` `onIntentCreated`: 4-way flow branch (no commit hash — see "Two-repo discipline" deviation)

**Location:** `exports.onIntentCreated = ...` at queuenight/functions/index.js:354-ish.

**EventType-to-flow mapping table:**

| `intent.flow` | `eventType` | `title` | `body` (D-12 verbatim) | Recipient set |
|---|---|---|---|---|
| `tonight_at_time` (legacy) | `intentProposed` | "Tonight @ time" | `${senderName} proposed "${titleName}" for ${when}` | All family members minus creator |
| `watch_this_title` (legacy) | `intentProposed` | "Asking the family" | `${senderName}: "${titleName}"?` | All family members minus creator |
| `rank-pick` (Flow A) | `flowAPick` | "Tonight's pick" | `${senderName} picked ${titleName} for tonight. In, reject, or drop?` | **expectedCouchMemberIds intersection** minus creator |
| `nominate` (Flow B) | `flowBNominate` | "Watch with the couch?" | `${senderName} wants to watch ${titleName} at ${when}. Join, counter, or pass?` | All family members minus creator |
| (unknown flow) | n/a | n/a | n/a | (defensive log + return null) |

The legacy `tonight_at_time` + `watch_this_title` branches are
preserved verbatim (the time-render block, `intentProposed` eventType,
the membersSnap recipient calc, `excludeUid`/`excludeMemberId`
self-echo guards). The Flow A privacy filter
(T-14.06-04 mitigation) intersects `recipientIds` with a
`Set(intent.expectedCouchMemberIds)` and is the only behaviorally
different recipient calculation in the function.

### Task 4 — `queuenight/functions/index.js` `onIntentUpdate`: counter-chain + reject-majority branches (no commit hash)

**Location:** `exports.onIntentUpdate = ...` at queuenight/functions/index.js:455-ish.

**Phase 8 `intentMatched` branch preserved verbatim at top.** Phase 14
adds three new branches that activate ONLY when `after.status === 'open'`
AND `flow ∈ {'rank-pick', 'nominate'}`:

| Trigger | eventType | Push recipient | Body (D-12 verbatim) |
|---|---|---|---|
| counterChainDepth bumped on `rank-pick` | `flowAVoteOnPick` | picker (`after.createdBy`) | `${actorName} countered with ${counterTitleName}. Vote on it?` |
| counterChainDepth bumped on `nominate` | `flowBCounterTime` | nominator (`after.createdBy`) | `${actorName} countered with ${counterTimeStr}. ${nominatorName} is deciding.` |
| Flow A rejects cross majority of expectedCouchMemberIds (idempotent: only fires when count CROSSES) | `flowARejectMajority` | picker (`after.createdBy`) | `The couch passed on ${titleName}. ${createdByName}'s picking again.` |

**Actor identification** (used for self-echo guards): the function
iterates `after.rsvps` against `before.rsvps` and identifies the slot
whose `at` timestamp advanced (if multiple, picks the one with the
latest `at`). The actor's `actingUid` and `mid` are passed as
`excludeUid` / `excludeMemberId` to `sendToMembers` so the actor doesn't
get pushed about their own counter / reject.

**Counter title name resolution** for `flowAVoteOnPick`: looks up
`actorRsvp.counterTitleId` against `families/{code}/titles/{titleId}`;
fallback string `"a different title"` if lookup fails.

**Counter time render** for `flowBCounterTime`: renders
`actorRsvp.counterTime` via `toLocaleTimeString` with
`after.creatorTimeZone || 'UTC'` (matches the Phase 8 timezone-aware
render pattern from Plan 09-07a).

**Reject-majority idempotency:** the count is computed both before AND
after; the push fires ONLY when `beforeRejects < majority &&
afterRejects >= majority` (i.e. this update is the one that crossed the
threshold). Subsequent rsvps updates that don't change the threshold
state stay silent.

### Task 5 — `queuenight/functions/index.js` `watchpartyTick`: flow-aware intent loop (no commit hash)

**Location:** intent-expiry branch inside `watchpartyTick` at
queuenight/functions/index.js:494-ish (now significantly extended).

**Three behaviors inside the existing per-family `for (const idoc of intentsSnap.docs)` loop:**

| Branch | Condition | Action | Idempotency |
|---|---|---|---|
| **A — Hard expire** | `(intent.expiresAt || 0) <= now` AND `status === 'open'` | `update({ status: 'expired', expiredAt: now })` | Status re-check at loop top (`if (intent.status !== 'open') continue`). |
| **B — Flow B auto-convert at T-15min** | `flow === 'nominate'` AND `proposedStartAt - now ∈ (0, 15min]` AND `any rsvp.state==='in' OR value==='yes'` | (1) `wpRef.set({status:'scheduled', host*, titleId, startAt, creatorTimeZone, createdAt, convertedFromIntentId, attribution})`; (2) `idoc.update({status:'converted', convertedToWpId, convertedAt})`; (3) push opted-in respondents with `flowBConvert` eventType, body `"${titleName} in 15 min — head to the couch."` (D-12 verbatim) | Status re-check at loop top + the `status='converted'` write itself short-circuits subsequent ticks (T-14.06-02 mitigation). |
| **C — T-30min warning push** | `flow ∈ {'rank-pick', 'nominate'}` AND `expiresAt - now ∈ (15min, 30min]` AND `!intent.warned30` | (1) `idoc.update({warned30: true})` set FIRST to short-circuit concurrent ticks; (2) push recipients with `intentExpiring` eventType + actionable nudge ("Vote in, reject, or drop." for rank-pick; "Join, counter, or pass." for nominate) | `warned30` flag is the idempotency gate — set before the push so a second tick can't fire even if the push fails. |

**Recipient sets:** Branch C uses the same Flow A privacy filter as
`onIntentCreated` (intersect with `expectedCouchMemberIds` for
`rank-pick`; for `nominate` it pushes all family members minus creator).

**Per-doc try/catch:** each branch's writes are wrapped — a single
intent failure logs and continues to the next intent within the same
family. Matches the existing `'watchpartyTick per-doc failed'` pattern
at functions/index.js:489.

**No new top-level CF / no new onSchedule trigger** — Branches B + C
piggyback on the existing 5-min `watchpartyTick` cadence. Acceptable
latency for Flow B auto-convert (worst-case 5 min before T-15min push
fires; Flow B nomination still at least 15 min from start when this
runs).

## Deviations from Plan

### 1. `queuenight/` is not a git repository on this machine

**Found during:** Task 3 (first attempt to commit queuenight changes
separately).

**Issue:** The plan's `<execution_instructions>` directed me to
"Commit the queuenight changes separately in the queuenight repo. (cd
/c/Users/nahde/queuenight && git add ... && git commit -m ...)".
However, `C:/Users/nahde/queuenight/` has no `.git` directory and
`git -C "C:/Users/nahde/queuenight" status` returns `fatal: not a git
repository`. The `queuenight/` tree contains `firebase.json`,
`functions/`, `public/`, `marketing-source/`, `storage.rules`,
`firestore.rules`, `firestore.indexes.json`, and `.firebaserc` — i.e.
it's a Firebase project workspace, not a versioned repo on this
machine.

**Fix:** I edited `C:/Users/nahde/queuenight/functions/index.js`
directly (Tasks 3, 4, 5) and validated each task with `node --check`
+ targeted `grep -c` checks. The 3 task edits in queuenight are
**uncommitted** (the file has been modified on disk but no version
control captures the change). The couch repo's commits 3c6b4b9 and
9a09872 cover Tasks 1 + 2 atomically as the plan specifies.

**Impact:**
- The functional behavior of Tasks 3-5 is identical to what would have
  shipped via separate commits; only the audit trail differs.
- Before the next CF deploy (`firebase deploy --only functions` from
  `~/queuenight/`), the operator should diff the working tree against
  the last deployed function source to confirm only the intended Phase
  14 Plan 06 extensions are present.
- A future tech-debt follow-up: either initialize git in
  `C:/Users/nahde/queuenight/` so future GSD plans can commit Cloud
  Function changes atomically, or codify the "couch repo holds the
  audit trail; queuenight is deploy-only" convention in CLAUDE.md.

**Tracked as:** Rule 4 (architectural / project-config decision) — not
auto-fixable inside this plan.

## Cross-plan dependency note (for 14-09)

Plan 14-06 wires SEVEN new push categories through `sendToMembers` via
the `eventType` argument. Until Plan 14-09 adds them to
`NOTIFICATION_DEFAULTS` (`queuenight/functions/index.js:74`), the
following events go through `sendToMembers`'s "no default → defaultOn=true"
fallback at functions/index.js:114-115. Pushes will deliver, but per-user
toggle state in `users/{uid}.notificationPrefs[eventType]` is silently
ignored:

- `flowAPick`
- `flowAVoteOnPick`
- `flowARejectMajority`
- `flowBNominate`
- `flowBCounterTime`
- `flowBConvert`
- `intentExpiring`

**14-09 owner**: per the DR-3 reconciliation in 14-CONTEXT.md, all
seven keys must be added in THREE places (server defaults, client
defaults, client labels + UI key map). Plan 14-06's CF changes are
defensive against the "missing key" case (defaultOn fallback) so 14-09
can ship at its own cadence without breaking 14-06; the only cost is
that user opt-outs don't take effect until 14-09 lands.

## Threat surface scan

The threat register in 14-06-PLAN.md (T-14.06-01 through T-14.06-05)
covers all newly introduced surfaces. No additional threat flags
detected:

- New collections: NONE (DR-1 invariant — extends existing intents collection).
- New endpoints: NONE.
- New auth paths: NONE.
- New file access patterns: NONE.
- New schema at trust boundaries: `counterChainDepth`,
  `expectedCouchMemberIds`, `convertedToWpId`, `warned30`, `flow` — all
  in the intents collection, all gated by the existing
  `attributedWrite(familyCode)` check + the new branch-level
  affectedKeys allowlists.

## Verification (commands run + results)

```
node --check js/app.js                                              → exit 0
node --check C:/Users/nahde/queuenight/functions/index.js           → exit 0

grep -c "rank-pick"            js/app.js                            → 5  (≥1 expected)
grep -c "counterChainDepth"    js/app.js                            → 2  (≥1 expected)
grep -c "rank-pick"            firestore.rules                      → 2  (≥1 expected)
grep -c "counterChainDepth"    firestore.rules                      → 10 (≥2 expected)

grep -c "flowAPick"            queuenight/functions/index.js        → 2  (≥1 expected)
grep -c "flowBNominate"        queuenight/functions/index.js        → 2  (≥1 expected)
grep -c "flowAVoteOnPick"      queuenight/functions/index.js        → 2  (≥1 expected)
grep -c "flowBCounterTime"     queuenight/functions/index.js        → 2  (≥1 expected)
grep -c "flowARejectMajority"  queuenight/functions/index.js        → 2  (≥1 expected)
grep -c "flowBConvert"         queuenight/functions/index.js        → 4  (≥1 expected)
grep -c "intentExpiring"       queuenight/functions/index.js        → 5  (≥1 expected)
grep -c "convertedFromIntentId" queuenight/functions/index.js       → 1  (≥1 expected)
grep -c "warned30"             queuenight/functions/index.js        → 5  (≥1 expected)

DR-1 invariant — NO new collection / NO new top-level CF:
grep -c "watchpartyIntents"        js/app.js                        → 0  ✓
grep -c "watchpartyIntents"        firestore.rules                  → 0  ✓
grep -c "watchpartyIntents"        queuenight/functions/index.js    → 0  ✓
grep -c "exports.watchpartyIntent" queuenight/functions/index.js    → 0  ✓
```

All 14 verification predicates from `<verification>` block pass.

## Self-Check: PASSED

- ✓ js/app.js modified, commit 3c6b4b9 present in `git log`.
- ✓ firestore.rules modified, commit 9a09872 present in `git log`.
- ✓ C:/Users/nahde/queuenight/functions/index.js modified on disk
   (uncommitted per deviation 1; node --check passes; all required
   markers present per grep counts above).
- ✓ DR-1 invariant: 0 occurrences of `watchpartyIntents` across all 3
   files; 0 new top-level `exports.watchpartyIntent*` in queuenight CF.
- ✓ All 14 verification grep predicates pass.
- ✓ Phase 8 legacy callers preserved (createIntent still accepts `type`;
   onIntentCreated tonight_at_time + watch_this_title branches verbatim;
   onIntentUpdate intentMatched branch verbatim; watchpartyTick hard-expire branch verbatim).
