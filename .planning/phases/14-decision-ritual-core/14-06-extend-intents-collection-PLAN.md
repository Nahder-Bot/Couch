---
phase: 14-decision-ritual-core
plan: 06
type: execute
wave: 1
depends_on: []
files_modified:
  - js/app.js
  - firestore.rules
  - C:\Users\nahde\queuenight\functions\index.js
autonomous: true
requirements_addressed: [DECI-14-09]
must_haves:
  truths:
    - "createIntent at js/app.js:1400 accepts a `flow` argument with 4 valid values: 'tonight_at_time', 'watch_this_title', 'rank-pick', 'nominate'. Legacy `type` argument still accepted (back-compat). Both fields are written to the intent doc (legacy `type` + new `flow`)."
    - "Per-flow expiresAt: 'rank-pick' = 11pm same-day; 'nominate' = proposedStartAt + 4hr; 'tonight_at_time' = proposedStartAt + 3hr (existing); 'watch_this_title' = now + 30 days (existing)."
    - "Per-flow rsvps[me] seed: 'rank-pick' / 'nominate' use {state:'in', at, actingUid, memberName}; 'tonight_at_time' / 'watch_this_title' use {value:'yes', at, actingUid, memberName} (existing — back-compat preserved)."
    - "intent doc carries new fields when flow is 'rank-pick' or 'nominate': expectedCouchMemberIds[] (Flow A only), counterChainDepth=0 (initialized; capped at 3 by rules)."
    - "firestore.rules:338-386 widened: create accepts 4 type values (was 2); new update branch (5) for counter-chain bump that requires counterChainDepth strictly increasing AND new value <= 3; convert branch (4) extended to allow `open → converted` (was `matched → converted` only) AND adds convertedToWpId to the affectedKeys allowlist."
    - "queuenight/functions/index.js onIntentCreated branched on flow: 'rank-pick' fires `flowAPick` push to expectedCouchMemberIds (filtered subset, NOT all family members); 'nominate' fires `flowBNominate` push to all family members minus creator; existing 'tonight_at_time' + 'watch_this_title' branches preserved verbatim."
    - "queuenight/functions/index.js watchpartyTick (existing intent expiry branch lines 494-512) extended with 3 new behaviors per flow: (a) hard-expire when expiresAt elapsed (existing behavior + new flows); (b) Flow B auto-convert at T-15min when any rsvps[*].state==='in' OR rsvps[*].value==='yes' — creates watchparty doc + flips intent status to 'converted'; (c) T-30min `intentExpiring` warning push when warned30 flag is unset."
  artifacts:
    - path: "js/app.js"
      provides: "createIntent extension to accept 4 flow values + back-compat with 2 legacy types"
      contains: "rank-pick"
    - path: "firestore.rules"
      provides: "intents block widened: 4 types, counter-chain branch, open→converted convert branch"
      contains: "counterChainDepth"
    - path: "C:\\Users\\nahde\\queuenight\\functions\\index.js"
      provides: "onIntentCreated flow branches + watchpartyTick auto-convert + T-30min warning"
      contains: "flowAPick"
  key_links:
    - from: "Flow A picker UI in 14-07 (downstream)"
      to: "createIntent({flow:'rank-pick', titleId, expectedCouchMemberIds: state.couchMemberIds})"
      via: "function call"
      pattern: "createIntent\\(\\{\\s*flow:\\s*['\"]rank-pick"
    - from: "Flow B nominate UI in 14-08 (downstream)"
      to: "createIntent({flow:'nominate', titleId, proposedStartAt})"
      via: "function call"
      pattern: "createIntent\\(\\{\\s*flow:\\s*['\"]nominate"
    - from: "watchpartyTick auto-convert"
      to: "watchparty doc creation in families/{code}/watchparties/{wpId}"
      via: "atomic write inside CF"
      pattern: "convertedFromIntentId"
---

<objective>
Extend the existing Phase 8 `families/{code}/intents/` collection with two new `flow` values (`rank-pick`, `nominate`) per DR-1 reconciliation. NOT a new collection. NOT new Cloud Functions. Extends `createIntent` (js/app.js:1400), `firestore.rules:338-386`, `onIntentCreated` (functions/index.js:354), `onIntentUpdate` (functions/index.js:408), and the existing intent-expiry branch inside `watchpartyTick` (functions/index.js:494-512). Preserves all Phase 8 behavior verbatim — legacy callers still work; new callers opt into the new flows via the `flow` argument.

Purpose: This is the foundational data + CF layer that Flow A (14-07) and Flow B (14-08) write to and that all 7 D-12 push categories (added in 14-09) deliver against. DR-1 explicitly chose extension over forking — this plan is the canonical implementation of that choice. Anti-pattern #7 (CONTEXT) explicitly warns against forking the intent primitive; following the extension path keeps one schema, one CF, one rules block.

Output: createIntent extension (js/app.js), firestore.rules widening, onIntentCreated flow branches (queuenight CF), watchpartyTick extension with auto-convert + T-30min warning logic. Push copy + new push categories are NOT in this plan — those land in 14-09 (which references the eventTypes wired here).
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 1 (foundation). No upstream dependencies in code; logically depends on Phase 8 for the existing `intents` collection (already shipped). Unblocks 14-07 (Flow A) and 14-08 (Flow B).

**Two-repo discipline (CRITICAL):** This plan modifies BOTH repos:
- Couch repo (`C:\Users\nahde\claude-projects\couch\`) — js/app.js + firestore.rules use repo-relative paths.
- Queuenight repo (`C:\Users\nahde\queuenight\`) — functions/index.js MUST be referenced by absolute path per Anti-pattern #2 + S6 in PATTERNS.md.

Deploys are SEPARATE: `bash scripts/deploy.sh` for couch hosting + rules; `firebase deploy --only functions` from `~/queuenight/` for the CF. Coordinate the deploy order in 14-09 (which holds the final cache bump): deploy CFs FIRST so the new push fan-out is live by the time the client UI starts writing rank-pick / nominate intents.

**DR-1 invariant: extend, don't fork.** Do NOT create a `watchpartyIntents` collection. Do NOT create new top-level CFs. Do NOT mint new onSchedule triggers. Extend existing primitives only.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md

<interfaces>
**Existing createIntent** at js/app.js:1400-1442 — full body in PATTERNS.md §9. Validates `type` ∈ {'tonight_at_time', 'watch_this_title'}; computes per-type expiresAt; seeds rsvps[me] with `{value:'yes', at, actingUid, memberName}`; calls `setDoc(intentRef(id), {...intent, ...writeAttribution()})`.

**Existing firestore.rules intents block** at firestore.rules:338-386 — full block in PATTERNS.md §10. Validates create with `type` ∈ {'tonight_at_time', 'watch_this_title'} only; 4 update branches (RSVP / cancel / match / convert).

**Existing onIntentCreated** at queuenight/functions/index.js:354-403 — full body in PATTERNS.md §11. Branches on `intent.type`; uses `sendToMembers(familyCode, recipientIds, {title, body, tag, url}, {excludeUid, excludeMemberId, eventType: 'intentProposed'})`.

**Existing watchpartyTick** intent-expiry branch at queuenight/functions/index.js:494-512 — full body in PATTERNS.md §12. Iterates intents, sets status='expired' when expiresAt has elapsed.

**sendToMembers helper** at queuenight/functions/index.js:92 — handles VAPID, dead-sub pruning, eventType pref gate, quiet-hours, self-echo. Required signature documented in PATTERNS.md S2. The `eventType` arg gates against `NOTIFICATION_DEFAULTS` map at functions/index.js:74.

**writeAttribution()** in js/utils.js — required spread in every Firestore write per S1 in PATTERNS.md.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend createIntent (js/app.js) to accept 4 flow values + new fields</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 1380-1450 (existing intentsRef + createIntent + computeIntentThreshold)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §9 (concrete extension excerpt — copy verbatim)
  </read_first>
  <action>
1. Locate `async function createIntent(...)` at js/app.js:1400. Read the full body (lines 1400-1442).

2. Replace the function with the extended version from PATTERNS.md §9. Key changes:
   - Function signature accepts `{ type, flow, titleId, proposedStartAt, proposedNote, expectedCouchMemberIds }` (added `flow` and `expectedCouchMemberIds`).
   - `flowVal = flow || type` (back-compat — new callers pass `flow`; legacy callers pass `type`).
   - Type validation widens to allow 4 values.
   - Per-flow expiresAt computed:
     - `rank-pick`: end-of-day at 11pm local (`new Date(); setHours(23, 0, 0, 0)`).
     - `nominate`: `(proposedStartAt || now) + 4 * 60 * 60 * 1000`.
     - `tonight_at_time`: `(proposedStartAt || now) + 3 * 60 * 60 * 1000` (existing — preserved verbatim).
     - `watch_this_title`: `now + 30 * 24 * 60 * 60 * 1000` (existing — preserved verbatim).
   - Per-flow rsvps[me] seed:
     - `rank-pick` or `nominate`: `{state:'in', at, actingUid, memberName}`.
     - `tonight_at_time` or `watch_this_title`: `{value:'yes', at, actingUid, memberName}` (existing).
   - Intent doc payload includes BOTH `type: flowVal` (legacy) AND `flow: flowVal` (new) so renderers and CFs can read either.
   - `counterChainDepth: 0` initialized for all writes (rules cap at 3; legacy intents reading this field will see 0/undefined and default-handle).
   - `expectedCouchMemberIds: [...]` written ONLY when flow === 'rank-pick' AND argument provided.

3. Verify the helper functions referenced (`computeIntentThreshold`, `intentRef`, `setDoc`, `writeAttribution`, `Intl.DateTimeFormat`) are all in scope. They were before the extension; preserve them.

4. Add a one-line comment marker `// === D-09 createIntent extension — DECI-14-09 (DR-1: extend, do not fork) ===` immediately above the function.

5. Run `node --check` after edits.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "rank-pick" js/app.js && grep -c "counterChainDepth" js/app.js</automated>
    Expect: `node --check` exits 0; both grep ≥1.
  </verify>
  <done>
    - createIntent accepts and validates 4 flow values.
    - Legacy callers passing `type` still work (back-compat verified by inspection).
    - New callers passing `flow` get correct per-flow expiresAt + rsvps[me] seed + counterChainDepth init + expectedCouchMemberIds (Flow A only).
    - Both `type` and `flow` fields written to the intent doc.
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Widen firestore.rules intents block — accept 4 types, add counter-chain branch, extend convert branch</name>
  <files>firestore.rules</files>
  <read_first>
    - firestore.rules lines 315-386 (full intents block + surrounding context)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §10 (concrete diff — copy verbatim)
  </read_first>
  <action>
1. Locate the `match /intents/{intentId} {` block at firestore.rules:338. Read the full block (allow read + create + 4 update branches + delete:false).

2. Replace the block with the extended version from PATTERNS.md §10. Key changes:
   - **CREATE**: widen the type enum from 2 to 4 values; add a counterChainDepth bound check (allowed ONLY if 0..3 inclusive, OR absent).
   - **UPDATE branch 1 (RSVP)**: UNCHANGED. Rules don't validate the inner `rsvps[mid]` shape; client-side createIntent / setIntentRsvp helpers enforce shape.
   - **UPDATE branch 2 (Cancel)**: UNCHANGED.
   - **UPDATE branch 3 (Match)**: UNCHANGED. (Flow B may pass through 'matched' state; Flow A skips it.)
   - **UPDATE branch 4 (Convert)**: EXTENDED. Allow `open → converted` (Flow A direct) in addition to existing `matched → converted` (Flow B/Phase 8). Add `convertedToWpId` to allowed affectedKeys (alongside existing `convertedTo`).
   - **UPDATE branch 5 (NEW — Counter-chain bump)**: any family member can bump counterChainDepth atomically with their RSVP write. Constraints: status remains 'open'; new counterChainDepth strictly equals (existing + 1) or 1 if previously null/undefined; new counterChainDepth ≤ 3; affectedKeys hasOnly(['rsvps', 'counterChainDepth', attribution-keys]).

3. Verify `attributedWrite(familyCode)` and `uid()` rule helpers are still in scope (Phase 5 added them; they're at the top of firestore.rules per researcher's notes — read lines 1-50 to confirm).

4. After editing, run any available rules unit tests: `npm test --prefix tests` (from couch repo root). If tests/rules.test.js has intent-doc tests, add a sibling case for:
   - Create with `type: 'rank-pick'` succeeds.
   - Create with `type: 'nominate'` succeeds.
   - Create with `counterChainDepth: 4` FAILS.
   - Update bumping counterChainDepth from 0 → 1 succeeds.
   - Update bumping counterChainDepth from 3 → 4 FAILS.
   - Update from `open → converted` succeeds (with createdByUid match).
   - Update from any state → 'cancelled' by non-creator FAILS (existing rule preserved).

   If no rules.test.js exists, do NOT scaffold one in this plan — defer to a tech-debt follow-up.
  </action>
  <verify>
    <automated>grep -c "rank-pick" firestore.rules && grep -c "counterChainDepth" firestore.rules</automated>
    Expect: rank-pick ≥1; counterChainDepth ≥2 (create cap + update branch).
  </verify>
  <done>
    - firestore.rules:338-386 (or thereabouts) accepts 4 type values on create.
    - New update branch 5 enforces counterChainDepth ≤ 3 cap and strictly-increasing increments.
    - Convert branch extended to allow open → converted (Flow A) AND adds convertedToWpId to allowed keys.
    - Existing 4 update branches preserved verbatim where unchanged.
    - If tests/rules.test.js exists, sibling intent test cases pass.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Extend onIntentCreated CF (queuenight/functions/index.js) with 'rank-pick' + 'nominate' branches</name>
  <files>C:\Users\nahde\queuenight\functions\index.js</files>
  <read_first>
    - C:\Users\nahde\queuenight\functions\index.js lines 60-220 (sendToMembers helper, NOTIFICATION_DEFAULTS, configureWebPush)
    - C:\Users\nahde\queuenight\functions\index.js lines 354-410 (existing onIntentCreated body)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §11 (concrete extension excerpt)
    - .planning/phases/14-decision-ritual-core/14-CONTEXT.md D-12 push copy table
  </read_first>
  <action>
1. **Use absolute path `C:\Users\nahde\queuenight\functions\index.js`** per S6 two-repo discipline. Locate `exports.onIntentCreated = ...` at line 354.

2. Replace the function body with the extended version from PATTERNS.md §11. Key changes:
   - Read `flow = intent.flow || intent.type` for back-compat with legacy intents.
   - 4-way branch on `flow`:
     - `tonight_at_time`: existing copy + eventType `'intentProposed'` PRESERVED VERBATIM.
     - `watch_this_title`: existing copy + eventType `'intentProposed'` PRESERVED VERBATIM.
     - `rank-pick`: NEW. Title="Tonight's pick"; body=`${senderName} picked ${intent.titleName} for tonight. In, reject, or drop?`; eventType=`'flowAPick'`.
     - `nominate`: NEW. Title="Watch with the couch?"; body=`${senderName} wants to watch ${intent.titleName} at ${when}. Join, counter, or pass?`; eventType=`'flowBNominate'`. Render `when` from `intent.proposedStartAt` using `intent.creatorTimeZone` (same toLocaleTimeString pattern as existing `tonight_at_time` branch).
   - **Recipient filter:** for `rank-pick`, restrict recipients to `intent.expectedCouchMemberIds` (set intersection with family members, minus the creator). For all other flows, recipients = all family members minus creator (existing behavior).

3. Use the EXACT D-12 copy from CONTEXT.md (no paraphrasing). The copy table:
   - Flow A pick: `"${senderName} picked ${intent.titleName} for tonight. In, reject, or drop?"` (matches "Dad picked Inception for tonight. In, reject, or drop?")
   - Flow B nominate: `"${senderName} wants to watch ${intent.titleName} at ${when}. Join, counter, or pass?"` (matches "Sister wants to watch Past Lives at 8pm. Join, counter, or pass?")

4. Verify `db`, `functions`, `sendToMembers` are all already imported/scoped in queuenight/functions/index.js. They are (per existing 354 onIntentCreated).

5. Do NOT touch NOTIFICATION_DEFAULTS in this plan — that's 14-09's responsibility (DR-3 the 3-place add). However: if `eventType: 'flowAPick'` or `'flowBNominate'` is missing from NOTIFICATION_DEFAULTS at deploy time, sendToMembers falls back to `defaultOn=true` per the `hasDefault` check at index.js:114. Pushes will go through but the user toggle is silently ignored. Document this dependency in SUMMARY for the 14-09 executor.
  </action>
  <verify>
    <automated>grep -c "flowAPick" C:/Users/nahde/queuenight/functions/index.js && grep -c "flowBNominate" C:/Users/nahde/queuenight/functions/index.js && grep -c "expectedCouchMemberIds" C:/Users/nahde/queuenight/functions/index.js</automated>
    Expect: all ≥1.
  </verify>
  <done>
    - onIntentCreated branches on flow; 4 cases handled.
    - rank-pick recipients restricted to expectedCouchMemberIds intersection.
    - nominate recipients = all family members minus creator.
    - Existing 'tonight_at_time' + 'watch_this_title' branches preserved verbatim.
    - D-12 copy used verbatim; no paraphrasing.
    - eventType strings: 'flowAPick' (rank-pick), 'flowBNominate' (nominate), 'intentProposed' (legacy).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Extend onIntentUpdate CF with new state-transition push branches</name>
  <files>C:\Users\nahde\queuenight\functions\index.js</files>
  <read_first>
    - C:\Users\nahde\queuenight\functions\index.js lines 408-450 (existing onIntentUpdate body)
    - .planning/phases/14-decision-ritual-core/14-CONTEXT.md D-12 push copy table (the rest of the categories)
  </read_first>
  <action>
1. Locate `exports.onIntentUpdate = ...` at line 408. Read the full existing body to understand which state transitions already trigger pushes (likely the `open → matched` transition fires `intentMatched`).

2. Extend the function with these new branches (preserve all existing branches verbatim):
   - **counterChainDepth bump (any flow)**: detect when `before.counterChainDepth !== after.counterChainDepth` AND status === 'open'. Identify the actor (the rsvps[mid] entry that changed). Branch on flow:
     - `rank-pick`: counter-nomination submitted. Push to picker (`intent.createdBy`) with eventType `'flowAVoteOnPick'`. Body matches D-12: `"${actorName} countered with ${counterTitleName}. Vote on it?"` (resolve counterTitleName from `t.titleName` of the new title via Firestore lookup).
     - `nominate`: counter-time submitted. Push to nominator (`intent.createdBy`) with eventType `'flowBCounterTime'`. Body: `"${actorName} countered with ${formattedCounterTime}. ${nominatorName} is deciding."` (per D-12 copy).
   - **rsvps[mid] state change (existing flow): reject majority detection**. Compute count of `state === 'reject'` across all rsvps. If ≥ majority of expectedCouchMemberIds (Flow A) AND status === 'open': push to picker with eventType `'flowARejectMajority'`. Body: `"The couch passed on ${intent.titleName}. ${createdByName}'s picking again."` (per D-12).

3. Use D-12 copy verbatim. No paraphrasing.

4. Self-echo guard: every push call uses `excludeUid: actorUid, excludeMemberId: actorMid` so the actor doesn't get pushed about their own action.
  </action>
  <verify>
    <automated>grep -c "flowAVoteOnPick" C:/Users/nahde/queuenight/functions/index.js && grep -c "flowBCounterTime" C:/Users/nahde/queuenight/functions/index.js && grep -c "flowARejectMajority" C:/Users/nahde/queuenight/functions/index.js</automated>
    Expect: all ≥1.
  </verify>
  <done>
    - onIntentUpdate fires `flowAVoteOnPick` on counter-nomination submission (Flow A).
    - onIntentUpdate fires `flowBCounterTime` on counter-time submission (Flow B).
    - onIntentUpdate fires `flowARejectMajority` when reject count ≥ majority of expectedCouchMemberIds (Flow A).
    - Self-echo guard applied to every push call.
    - D-12 copy used verbatim.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Extend watchpartyTick — add Flow B auto-convert + T-30min warning + flow-aware expiry</name>
  <files>C:\Users\nahde\queuenight\functions\index.js</files>
  <read_first>
    - C:\Users\nahde\queuenight\functions\index.js lines 435-516 (full watchpartyTick body)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §12 (concrete branched extension)
  </read_first>
  <action>
1. Locate the existing intent-expiry branch inside watchpartyTick at lines 494-512. Replace the for-loop body with the flow-aware branch tree from PATTERNS.md §12. Key changes:
   - **Branch A (hard expire)**: existing behavior preserved — `intent.expiresAt <= now AND status==='open' → status='expired'`. Unchanged.
   - **Branch B (Flow B auto-convert at T-15min)**: NEW. When `flow === 'nominate' AND intent.proposedStartAt AND minutesBefore <= 15 AND minutesBefore > 0 AND any rsvp has state==='in' (or legacy value==='yes')`:
     - Create new watchparty doc in `families/{familyCode}/watchparties` with shape: `{status:'scheduled', hostId: intent.createdBy, hostUid: intent.createdByUid, hostName: intent.createdByName, titleId: intent.titleId, startAt: intent.proposedStartAt, creatorTimeZone: intent.creatorTimeZone, createdAt: now, convertedFromIntentId: intent.id, actingUid + memberId + memberName attribution fields}`.
     - Update intent doc: `status='converted', convertedToWpId: wpRef.id, convertedAt: now`.
     - Fire `flowBConvert` push to all rsvp respondents with state==='in' OR value==='yes', using D-12 copy: `"${intent.titleName} in 15 min — head to the couch."`.
   - **Branch C (T-30min warning push)**: NEW. When `flow === 'rank-pick' OR flow === 'nominate'` AND `expiresAt > now` AND `(expiresAt - now) <= 30 min` AND `(expiresAt - now) > 15 min` AND `!intent.warned30`:
     - Update intent doc: `warned30: true` (idempotent flag).
     - Fire `intentExpiring` push to all family members (or for Flow A, just expectedCouchMemberIds) with D-12 copy: `"Tonight's pick expiring soon. ${actionableNudge}"`.
   - All branches stay idempotent via status re-checks (matches existing pattern at functions/index.js:454).

2. Per-doc try/catch around each branch — preserves the existing per-family iteration safety (a single intent failure doesn't abort the whole sweep).

3. Self-echo NOT applicable here (CF acts as system; no actor uid). All flowBConvert / intentExpiring pushes go to all eligible recipients.

4. Coordinate with 14-09 (NOTIFICATION_DEFAULTS additions): pushes from this CF will silently default-on until 14-09 adds the keys to NOTIFICATION_DEFAULTS. Document this in SUMMARY.
  </action>
  <verify>
    <automated>grep -c "convertedFromIntentId" C:/Users/nahde/queuenight/functions/index.js && grep -c "warned30" C:/Users/nahde/queuenight/functions/index.js && grep -c "flowBConvert" C:/Users/nahde/queuenight/functions/index.js</automated>
    Expect: all ≥1.
  </verify>
  <done>
    - watchpartyTick intent loop branches on flow; 3 new behaviors (auto-convert, T-30min warning, flow-aware expiry) implemented inside existing for-loop.
    - Auto-convert creates a watchparty doc + flips intent to 'converted' atomically (per-doc try/catch ensures one failure doesn't cascade).
    - T-30min warning idempotent via `warned30` flag.
    - All status re-checks ensure idempotency under retry.
    - No new top-level CF added; no new onSchedule trigger; reuses existing watchpartyTick cadence.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Firestore intents collection | Schema widening allows 2 new flow values + 1 new field (counterChainDepth) — rules must enforce caps |
| Cloud Function → Firestore watchparties collection | Auto-convert writes a new watchparty doc; uses admin SDK so bypasses client rules; integrity relies on the CF's own logic |
| Cloud Function → push transport (FCM web push) | New eventTypes 'flowAPick', 'flowBNominate', 'flowAVoteOnPick', 'flowBCounterTime', 'flowARejectMajority', 'flowBConvert', 'intentExpiring' — NOTIFICATION_DEFAULTS missing means they silently default-on until 14-09 adds them |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.06-01 | Tampering | A member writes counterChainDepth: 100 to flood the counter chain | mitigate | Rule cap counterChainDepth ≤ 3 enforced on every update branch (Task 2 acceptance criterion) |
| T-14.06-02 | DoS | Auto-convert fires repeatedly on the same intent (no idempotency) | mitigate | Status re-check: only `status === 'open'` intents enter Branch B; once converted, status='converted' short-circuits next sweep (Task 5 acceptance criterion) |
| T-14.06-03 | Spoofing | A member writes status='converted' to skip the watchparty creation step | mitigate | Convert update rule branch (Task 2) requires resource.data.createdByUid == uid() — only the picker can convert; CF uses admin SDK with intent.createdByUid attribution preserved |
| T-14.06-04 | Information Disclosure | Recipient list for rank-pick includes non-couch members (privacy regression — they shouldn't know what the couch is deciding) | mitigate | Recipient filter restricts rank-pick pushes to expectedCouchMemberIds (Task 3 acceptance criterion) |
| T-14.06-05 | Integrity | Legacy Phase 8 intents (no `flow` field) misread by new code paths | mitigate | All read sites use `intent.flow || intent.type` fallback — back-compat verified by inspection |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "rank-pick" js/app.js` → ≥1.
- `grep -c "counterChainDepth" js/app.js` → ≥1.
- `grep -c "rank-pick" firestore.rules` → ≥1.
- `grep -c "counterChainDepth" firestore.rules` → ≥2 (create cap + update branch).
- `grep -c "flowAPick" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "flowBNominate" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "flowAVoteOnPick" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "flowBCounterTime" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "flowARejectMajority" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "flowBConvert" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "intentExpiring" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "convertedFromIntentId" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- `grep -c "warned30" C:/Users/nahde/queuenight/functions/index.js` → ≥1.
- ZERO new CF exports (i.e. no `exports.watchpartyIntentTick =` or similar): `grep -c "exports.watchpartyIntent" C:/Users/nahde/queuenight/functions/index.js` → 0.
- ZERO new collection: `grep -c "watchpartyIntents" C:/Users/nahde/queuenight/functions/index.js` → 0; same for js/app.js + firestore.rules.
</verification>

<success_criteria>
1. createIntent extended to accept 4 flow values with per-flow expiresAt + rsvps seed + new fields; Phase 8 back-compat preserved.
2. firestore.rules widened: 4 type values on create; counterChainDepth cap; counter-chain bump branch; convert branch extended to open → converted.
3. onIntentCreated branches on flow; rank-pick + nominate fire correct eventTypes with D-12 copy verbatim; rank-pick recipient list restricted to expectedCouchMemberIds.
4. onIntentUpdate fires flowAVoteOnPick (counter-nom submitted), flowBCounterTime (counter-time submitted), flowARejectMajority (reject majority hit) with D-12 copy.
5. watchpartyTick auto-converts Flow B at T-15min when ≥1 'in' RSVP; fires flowBConvert push; fires T-30min intentExpiring warning idempotently via warned30 flag.
6. DR-1 invariant holds: NO new collection, NO new CF export, NO new onSchedule trigger.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-06-SUMMARY.md` documenting:
- createIntent file:line of modification + summary of 4 changes (signature, expiresAt branches, rsvps seed branches, new fields).
- firestore.rules diff summary (which existing branches preserved, which extended, new branch 5 inserted).
- onIntentCreated extension diff summary; eventType-to-flow mapping table.
- onIntentUpdate extension diff summary; new state-transition triggers documented.
- watchpartyTick extension diff summary; idempotency claims documented.
- Cross-plan dependency note: 14-09 MUST add 'flowAPick', 'flowAVoteOnPick', 'flowARejectMajority', 'flowBNominate', 'flowBCounterTime', 'flowBConvert', 'intentExpiring' to NOTIFICATION_DEFAULTS — until then pushes default-on (functional but user toggles silently ignored).
</output>
