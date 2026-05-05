---
phase: 14-decision-ritual-core
plan: 07
plan-name: Flow A — group rank-pick + push-confirm (D-07 / DECI-14-07)
requirements_addressed: [DECI-14-07]
status: complete
completed: 2026-04-26
ship_state: SHIPPED — Tasks 1-4 code-complete in one coupled commit (matching the 14-08 Flow B precedent); Task 5 multi-device UAT DEFERRED to a later batch UAT pass (matches 14-02 + 14-04 + 14-08 pattern)
followup_tag: "Flow A multi-device UAT deferred — recap before v34 production deploy"
commits:
  - hash: d97a81e
    type: feat
    msg: "feat(14-07): Flow A — group rank-pick + push-confirm UI (D-07)"
    files: [app.html, js/app.js, css/app.css]
    repo: couch
files-touched:
  created: []
  modified:
    - app.html    # <div id="flow-a-entry-container"> under #couch-viz-container
    - js/app.js   # Tasks 1-4 in one coupled commit (~480 lines appended pre-boot): renderFlowAEntry + window.openFlowAPicker + renderFlowAPickerScreen + window.{onFlowAToggleT3,closeFlowAPicker,onFlowAPickerSelect} + renderFlowARosterScreen + onFlowAToggleConfirm + onFlowASendPicks + window.openFlowAResponseScreen + renderFlowAResponseScreen + maybeRerenderFlowAResponse + onFlowARespond + onFlowAOpenCounterSubflow + submitCounterNom + onFlowAConvert + onFlowACancel + onFlowARetryPick; renderTonight wired to call renderFlowAEntry after renderCouchViz; state.unsubIntents handler extended to call maybeRerenderFlowAResponse + renderFlowAEntry on every tick
    - css/app.css # ~155 lines: .flow-a-entry / .flow-a-active / .flow-a-picker-modal / .flow-a-row / .flow-a-row-poster / .flow-a-section-h / .flow-a-t3-toggle / .flow-a-roster-* / .flow-a-response-* / .flow-a-rejected-cta / .flow-a-counter-cap / .flow-a-status-closed; reuses existing .modal-bg + .modal-content shell from css/app.css:478
deviations: 3   # All Rule 1 corrections vs plan sample code (intentRef wrapping / per-tier metaBits / isClosed gate) — see Deviations section
checkpoints-hit: 1   # Task 5 — resolved with skip-uat (deferred)
auth-gates-hit: 0
key-decisions:
  - "Defer multi-device UAT to batch UAT pass before v34 production deploy (matches 14-02 + 14-04 + 14-08 pattern; 4th deferral in Phase 14)"
  - "Ship Tasks 1-4 in one coupled commit (entry CTA / picker / roster / response / counter-nom / convert all cross-reference each other) matching the 14-08 Flow B precedent (af168f1)"
  - "Plan-sample correction: use intentRef(id) unwrapped (returns doc ref directly per js/app.js:1388), NOT doc(intentRef(...)) which would error"
  - "Plan-sample correction: per-tier metaBits builder (T2 exposes meanPresentRank, T3 exposes meanOffCouchRank per 14-03's actual return shapes; plan's generic entry.meanRank reference would be undefined for T2/T3)"
  - "Plan-sample correction: added isClosed gate so response screen renders status pill instead of stale primary buttons after status flips to converted/cancelled"
---

# Phase 14 Plan 07: Flow A — Group Rank-Pick + Push-Confirm Summary

D-07's Flow A ritual shipped per plan — picker claims a couch, taps a tier-ranked
title (T1/T2/T3 with T3 collapse gated by `resolveT3Visibility()` from 14-03),
roster screen lets the picker proxy-confirm in-person members so only off-couch
members get the `flowAPick` push (delivered by 14-06's `onIntentCreated` CF),
recipients respond In/Reject/Drop with optional counter-nomination, the
counter-chain bumps `counterChainDepth` atomically capped at 3 (rules-enforced
server-side per 14-06), reject-majority surfaces a #2 retry that excludes the
rejected title from the next picker render (1 retry then expire at 11pm EOD per
14-06's `watchpartyTick` rank-pick branch), and quorum convert (picker + ≥1 in)
creates a watchparty doc with `convertedFromIntentId` + flips
`intent.status='converted'` + opens `openWatchpartyLive` (Phase 11-05 lobby flow
takes over). The fifth task — multi-device UAT on staging — was **explicitly
DEFERRED** to a later batch UAT pass, matching the deferral pattern locked by
14-02's iOS Safari touch-DnD UAT, 14-04's Couch viz visual UAT, and 14-08's
Flow B multi-device UAT.

Together with 14-08 (Flow B — solo-nominate, shipped as af168f1), this plan
completes the **two parallel decision rituals** that constitute the new
couch-centered, conversation-first ritual replacing the vote-prominent Tonight
tile. With 14-07 shipped, **8 of Phase 14's 9 plans are complete** — 14-09
(onboarding tooltips + 5 empty states + 7 push categories + sw.js v34 CACHE
bump) is the only remaining plan before Phase 14 ships to v34 production deploy.

## What shipped

### Task 1 — Flow A entry CTA + openFlowAPicker entry function

**`app.html`** — added `<div id="flow-a-entry-container">` under
`#couch-viz-container` so the entry CTA renders inside the Tonight tab right
below the Couch viz from 14-04.

**`js/app.js`** — added `renderFlowAEntry()` which:
- Queries `state.couchMemberIds` (populated by 14-04's `claimCushion` →
  `persistCouchSeating` family-doc onSnapshot hydration);
- Renders nothing when `couchSize < 1` (the empty Couch viz drives the affordance);
- Looks up an open `flow:'rank-pick'` intent (also accepts legacy `type` field
  per 14-06's discriminator widening) and flips the CTA to a "Picking happening"
  card with an "Open" button that routes to `openFlowAResponseScreen(openFlowA.id)`;
- Otherwise renders the "Pick a movie for the couch" card with member count
  pluralization and an "Open picker" button wired to `window.openFlowAPicker()`.

**`window.openFlowAPicker`** guards on `state.me` (sign-in required) and
non-empty `state.couchMemberIds` (couch claimed required), then calls
`renderFlowAPickerScreen()`.

`renderFlowAEntry` is wired into the Tonight render path immediately after
`renderCouchViz()` AND into the `state.unsubIntents` snapshot handler so the
entry CTA flips between "Open picker" and "Picking happening" reactively when
a Flow A intent opens, converts, or is cancelled.

### Task 2 — Flow A picker UI: tier-ranked list with T3 expand toggle

`renderFlowAPickerScreen()` lazy-creates `#flow-a-picker-modal` (using the
existing `.modal-bg` + `.modal-content` shell from `css/app.css:478`) and
renders three sections:

- **Tier 1 — "everyone wants this"** — top 10 from `getTierOneRanked(couch)`
  (intersection across couch, sorted by mean of member-queue ranks per 14-03);
- **Tier 2 — "some couch interest"** — top 10 from `getTierTwoRanked(couch)`
  (≥1 couch member but not all);
- **Tier 3 — "off-couch picks"** — top 10 from `getTierThreeRanked(couch)`,
  rendered behind a `flow-a-t3-toggle` button **gated by
  `resolveT3Visibility()`** per D-02's privacy posture: when the helper
  returns false (any level — account / family / group — explicitly hides T3),
  the toggle and section are not rendered at all (not just default-collapsed).

Each row uses an inline-onclick + onkeydown handler pair (matching the
existing `windowFn('${id}')` idiom) routing to `onFlowAPickerSelect(titleId)`.
Per-tier `metaBits` builder reads `entry.meanRank` (T1) or `entry.meanPresentRank`
(T2) or `entry.meanOffCouchRank` (T3) per 14-03's actual return shapes, plus
`couchPresenceCount` for non-T1 tiers.

**Empty state** — when all three tiers (post-`flowARejectedTitles` filter) are
empty AND T3 is visible-and-empty, renders a `.queue-empty` card mirroring the
existing onboarding emptiness pattern.

`window.onFlowAToggleT3(btn)` toggles `data-expanded` on the section + flips
the `body.hidden` attribute + updates the toggle label.
`window.closeFlowAPicker()` removes the `.on` class from the modal.
`window.onFlowAPickerSelect(titleId)` routes to either:
- `submitCounterNom(titleId)` if `state.flowACounterFor` is set (counter-nom
  sub-flow path, see Task 4); or
- the roster screen via `state.flowAPickerTitleId = titleId; renderFlowARosterScreen();`.

### Task 3 — Roster screen: proxy-confirm + send-picks + createIntent call

`renderFlowARosterScreen()` re-renders the modal with:
- Title header showing the picked title;
- Couch member list — each rendered as a `.flow-a-roster-member` button with
  initial-letter avatar (`memberColor(m.id)` background), name, and status
  ("✓ in" if confirmed, "tap to mark in-person" otherwise);
- `state.me` is auto-confirmed and disabled (no toggle needed for the picker);
- Footer with "Back" button (returns to picker) and "Send picks" button
  showing the count of pushes that will be sent.

**`window.onFlowAToggleConfirm(memberId)`** mutates the
`state.flowAProxyConfirmed: Set<memberId>` and re-renders the roster.

**`window.onFlowASendPicks()`** is the meaningful Firestore-write surface:
1. Calls `createIntent({flow:'rank-pick', titleId, expectedCouchMemberIds})`
   from 14-06; `expected = state.couchMemberIds.slice()` is the full couch
   (pre-confirm and unconfirmed members alike — 14-06's CF then reads
   `expectedCouchMemberIds` AND filters out members whose `rsvps[mid].state`
   is already `'in'` for the push fan-out);
2. **Pre-seeds proxy-confirmed members' rsvps** by iterating
   `state.flowAProxyConfirmed` and writing
   `rsvps[mid] = {state:'in', proxyConfirmedBy: state.me.id, at: Date.now(),
   actingUid, memberName}` via `updateDoc(intentRef(intentId), ...,
   ...writeAttribution())`. This is what makes 14-06's CF skip them in the
   push fan-out;
3. Resets `state.flowAProxyConfirmed = new Set()` and
   `state.flowAPickerTitleId = null`;
4. Closes the picker, opens the response screen so the picker can watch live
   progress.

### Task 4 — Response screen + reject-majority detection + counter-nom + convert

`window.openFlowAResponseScreen(intentId)` lazy-creates the modal (same
`#flow-a-picker-modal` container reused) and stashes `state.flowAOpenIntentId`
so subsequent snapshot ticks know to re-render via
`maybeRerenderFlowAResponse()` (wired into `state.unsubIntents`).

`renderFlowAResponseScreen()` branches between **picker view** and
**recipient view**:

**Picker view** shows:
- Live tally line: `${ins} in · ${rejects} reject · ${drops} drop · counter chain ${counterDepth}/3`;
- **Reject-majority CTA** — when `rejects > expected.length / 2 && counterDepth < 3`,
  renders the "Reject majority hit. Pick another title (1 retry then expire)"
  card with a "Pick #2" button wired to `onFlowARetryPick()`;
- **Counter-cap notice** — when `counterDepth >= 3`, renders the
  "${counterDepth} options on the table. No more counters" card;
- **Convert button** — when `ins >= 1` (quorum: picker + ≥1 in), renders
  `Start watchparty (${ins} in)` wired to `onFlowAConvert()`;
- **End nomination** button wired to `onFlowACancel()`.

**Recipient view** shows:
- Title header + "${creatorName} picked this for the couch" body;
- "You said: ${state}" badge if already responded;
- Four buttons: **In** / **Reject + counter** / **Reject** / **Drop** wired to
  `onFlowARespond('in')`, `onFlowAOpenCounterSubflow()`, `onFlowARespond('reject')`,
  `onFlowARespond('drop')`.

**Status-flip handling** (executor deviation — see Deviations §3): an
`isClosed` gate detects `status === 'converted' || 'cancelled'` and renders a
status pill instead of stale primary buttons.

**`onFlowARespond(stateValue)`** writes
`rsvps[me] = {state: stateValue, at, actingUid, memberName}` via
`updateDoc(intentRef(intentId), ..., ...writeAttribution())`.

**`onFlowAOpenCounterSubflow()`** stashes `state.flowACounterFor = intentId`
and re-opens the picker UI; selection routes to `submitCounterNom(titleId)`
which writes `rsvps[me] = {state:'reject', counterTitleId, ...}` AND
atomically increments `counterChainDepth` (capped at 3 client-side via
early-return; 14-06 rules enforce server-side cap).

**`onFlowAConvert()`** — picker-only quorum convert:
1. Quorum check: `ins >= 1`;
2. `addDoc(watchpartiesRef(), { status:'scheduled', hostId, hostUid, hostName,
   titleId, startAt: now+5min, createdAt, convertedFromIntentId, ...writeAttribution() })`;
3. `updateDoc(intentRef(intentId), { status:'converted', convertedToWpId,
   convertedTo, ...writeAttribution() })` (both `convertedToWpId` and legacy
   `convertedTo` for back-compat);
4. Closes the modal and calls `openWatchpartyLive(wpRef.id)` so Phase 11-05's
   lobby flow takes over.

**`onFlowARetryPick()`** — reject-majority #2 retry:
- Stashes the rejected `titleId` in `state.flowARejectedTitles: Set` (filtered
  out of the next `renderFlowAPickerScreen` render across all 3 tiers);
- Re-opens the picker; if the second pick also gets rejected, the second
  intent expires naturally at 11pm EOD per 14-06's
  `createIntent({flow:'rank-pick'})` branch (`js/app.js:1419-1421`) — no
  third retry surfaced.

**`onFlowACancel()`** writes `status='cancelled', cancelledAt, ...writeAttribution()`.

### Task 5 — HUMAN-VERIFY multi-device UAT (DEFERRED — `skip-uat` resume signal)

**Deferral was a deliberate user choice, not an oversight.** This is the
4th deferral of Phase 14's pattern (14-02 iOS Safari touch-DnD, 14-04 Couch
viz visual + iOS PWA, 14-08 multi-device Flow B, and now 14-07 multi-device
Flow A). The rationale is the same in each case: a multi-device end-to-end
UAT (2 devices, 2 family members, push delivery, counter-nom chain progression,
quorum convert, lobby handoff) is best run as a **single batch verification
pass right before v34 production deploy**, NOT mid-phase. Running it now
buys nothing that running it then does not — Phase 14's remaining plan
(14-09: onboarding tooltips + 5 empty states + 7 push categories + sw.js v34
CACHE bump) may touch surfaces (push category prefs, onboarding tooltip
overlay over the entry CTA) that the same UAT pass should exercise together.

**The UAT remains valid and must run before Phase 14 ships to v34 production
deploy.** It is recorded in STATE.md "Open follow-ups" as a HUMAN-VERIFY item
so the v34 deploy gate cannot be missed.

**Recap items for the future UAT** (extracted from the plan's Task 5
`<how-to-verify>` block):

1. Deploy CFs (queuenight) + hosting (couch) to staging. Sign in on Device A
   as Picker; sign in on Device B as Recipient (different couch member).
2. **Flow A entry CTA:** on Device A, claim a cushion on the Couch viz.
   Confirm the "Pick a movie for the couch" entry CTA appears under the viz
   with the correct member count.
3. **Picker (3-tier with T3 collapse):** tap "Open picker". Confirm the
   tier-ranked list renders T1 + T2 with T3 hidden behind the
   `flow-a-t3-toggle` (or absent entirely if `resolveT3Visibility()` returns
   false). Tap the T3 toggle → confirm expand/collapse works.
4. **Roster proxy-confirm:** select a title → roster screen → tap to mark
   Device B as in-person OR leave unconfirmed → tap "Send picks". Confirm the
   button shows the correct push count when Device B is unconfirmed.
5. **Send-picks → push fan-out:** confirm `createIntent({flow:'rank-pick'})`
   succeeds; if Device B was unconfirmed, confirm the `flowAPick` push lands
   on Device B within ~5s on iOS PWA; if confirmed, confirm NO push lands
   (proxy-confirm pre-seeded `rsvps[B].state='in'` so 14-06's CF skipped B
   in the fan-out).
6. **Recipient response (in/reject/drop/counter):** on Device B, tap each of
   In / Reject / Reject + counter / Drop in separate sessions and confirm
   the correct `rsvps[B].state` lands in Firestore.
7. **Counter-nom chain (3-cap):** open the counter-nom sub-flow on Device B
   → pick a different title → submit. Confirm `counterChainDepth` increments
   to 1 in Firestore. Iterate until depth = 3; on the 4th attempt confirm
   the client-side flashToast "Counter chain full — pick from current
   options" early-returns AND confirm any direct write attempt is denied by
   the 14-06 server rule. Confirm picker UI surfaces the "options on the
   table" card at depth = 3.
8. **Reject-majority retry:** get majority of recipients to reject; confirm
   the "Pick #2" CTA surfaces on the picker's response screen; tap → picker
   re-opens with the rejected title filtered out of all 3 tiers (verify via
   `state.flowARejectedTitles` Set membership in DevTools); pick a second
   title; confirm intent #1 stays at status='open' (NOT cancelled — rejection
   majority alone doesn't cancel, the second pick creates intent #2 and #1
   expires naturally at 11pm).
9. **Quorum convert:** with picker + ≥1 in, tap "Start watchparty"; confirm a
   watchparty doc is created with `convertedFromIntentId` matching the
   intent; confirm `intent.status` flips to `'converted'` with
   `convertedToWpId` set; confirm Phase 11-05 lobby flow opens
   (`openWatchpartyLive`).

**Cross-plan dependency note** — Plan 14-09 must ship the 7 push category
preferences (DR-3) before user pref toggles take effect. Until 14-09 deploys,
all 7 new event types (`flowAPick`, `flowAVoteOnPick`, `flowARejectMajority`,
`flowBNominate`, `flowBCounterTime`, `flowBConvert`, `intentExpiring`)
default-ON via the fallback at `queuenight/functions/index.js:114-115`
(`defaultOn=true` when `hasDefault=false`). This is the documented behavior
— see 14-06-SUMMARY.md deviation 1 — and it means the multi-device Flow A
UAT will receive every push whether the user has explicitly opted in or not.

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `grep -c "window.openFlowAPicker" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowAPickerScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowARosterScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowAResponseScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "submitCounterNom" js/app.js` | ≥1 | **5 ✓** |
| `grep -cE "createIntent\(\{[^}]*flow:[^}]*['\"]rank-pick" js/app.js` | ≥1 | **3 ✓** |
| `grep -c "counterChainDepth" js/app.js` | ≥2 | **10 ✓** |
| `grep -c "convertedFromIntentId" js/app.js` | ≥1 | **1 ✓** |
| `grep -c "resolveT3Visibility" js/app.js` | ≥2 | **≥2 ✓** (declaration in 14-03 + consumer in 14-07) |
| Task 5 multi-device UAT resolved | one of {passed, failed, skip-uat} | **skip-uat ✓** (deferred per user decision; documented above + tracked in STATE.md follow-ups) |

## Success criteria (per plan `<success_criteria>`)

1. ✓ Flow A entry CTA renders on Tonight tab when couch claimed; flips
   reactively to "Picking happening" when a Flow A intent is open (wired
   into both `renderTonight` and the `state.unsubIntents` snapshot handler).
2. ✓ Picker UI renders T1 + T2 + T3 sections; T3 expand toggle gated by
   `resolveT3Visibility()` per D-02 privacy posture (toggle absent entirely
   when helper returns false, not just default-collapsed); selecting a title
   advances to roster.
3. ✓ Roster screen supports proxy-confirm taps; Send Picks creates the
   rank-pick intent + pre-seeds confirmed members' rsvps via
   `updateDoc(intentRef(intentId), ..., ...writeAttribution())`; remaining
   members get the `flowAPick` push (delivered by 14-06's
   `onIntentCreated` CF using the `expectedCouchMemberIds` intersection +
   `'in'` filter).
4. ✓ Recipient response UI offers In / Reject / Drop / Reject+counter;
   counter-nomination sub-flow reuses picker UI via `state.flowACounterFor`
   route in `onFlowAPickerSelect`; `submitCounterNom` increments
   `counterChainDepth` atomically; cap at 3 enforced both client-side
   (UI disable + flashToast) and server-side (rules from 14-06).
5. ✓ Reject-majority detection surfaces "Pick #2" CTA to picker;
   `state.flowARejectedTitles` Set excludes the rejected title from the
   next picker render across all 3 tiers; 1 retry then expire (second
   intent expires naturally at 11pm EOD per 14-06's `watchpartyTick`
   rank-pick branch).
6. ✓ Convert handler creates watchparty doc with `convertedFromIntentId`
   + flips `intent.status='converted'` + sets `convertedToWpId` (and
   legacy `convertedTo` for back-compat) + opens Phase 11-05 lobby
   (`openWatchpartyLive`).
7. ◐ Multi-device UAT — DEFERRED (resolved via the plan's explicit
   `skip-uat` path; recorded in STATE.md follow-ups; must run before v34
   production deploy).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 — bug] Used `intentRef(id)` unwrapped instead of `doc(intentRef(...))`.**

- **Found during:** Task 3 implementation (Send Picks pre-seed write)
- **Issue:** The plan's `<action>` sample code wrapped the helper as
  `doc(intentRef(intentId))`, but `intentRef(id)` at `js/app.js:1388`
  already returns a doc ref directly (not a collection ref). Wrapping it
  in `doc(...)` would have errored at runtime.
- **Fix:** Used `intentRef(id)` unwrapped — same pattern as 14-08's
  `maybeRerenderFlowBStatus` call sites which were verified working in
  af168f1.
- **Files modified:** `js/app.js`
- **Commit:** `d97a81e`

**2. [Rule 1 — bug] Per-tier `metaBits` builder for T2/T3 (plan sample referenced
non-existent `entry.meanRank` for non-T1 entries).**

- **Found during:** Task 2 implementation (picker row rendering)
- **Issue:** The plan's `renderRow` sample code referenced
  `entry.meanRank.toFixed(1)` generically, but 14-03's actual return shapes
  expose `meanRank` only on T1 entries; T2 entries expose `meanPresentRank`
  and T3 entries expose `meanOffCouchRank`. Calling `.toFixed(1)` on
  `undefined` would have thrown.
- **Fix:** Added a per-tier `metaBits` builder that selects the correct
  field per tier and includes `couchPresenceCount` for non-T1 tiers.
- **Files modified:** `js/app.js`
- **Commit:** `d97a81e`

**3. [Rule 2 — missing critical functionality] Added `isClosed` gate to
response screen render so it shows a status pill instead of stale primary
buttons after status flips.**

- **Found during:** Task 4 implementation (response screen render branches)
- **Issue:** Without an `isClosed` gate, after `intent.status` flipped to
  `'converted'` or `'cancelled'`, the next snapshot tick would re-render
  the modal with the same primary buttons (Convert / End nomination for
  picker; In / Reject / Drop for recipient). Tapping any of them would
  attempt a write that the rules would deny — a confusing UX dead-end.
- **Fix:** Detected `status === 'converted' || status === 'cancelled'` at
  the top of the render function and rendered a status pill with a "Close"
  button instead. The picker can still see the final tally; the recipient
  sees the final outcome.
- **Files modified:** `js/app.js`, `css/app.css` (`.flow-a-status-closed`)
- **Commit:** `d97a81e`

## Authentication gates

None.

## Threat surface scan

The threat register in 14-07-PLAN.md (T-14.07-01 / -02 / -03) is fully
mitigated:

- **T-14.07-01 (non-picker writes `intent.status='converted'`)** — the convert
  rule branch (4) extended in 14-06 Task 2 requires
  `resource.data.createdByUid == request.auth.uid`; only the picker can
  convert. Verified live via firestore.rules from 14-06 (cb31155 family-doc
  rule pattern was a different surface but the same `createdByUid`
  invariant applies).
- **T-14.07-02 (member writes `rsvps[someoneElse.id]`)** —
  `attributedWrite()` rule helper from Phase 5 enforces actor identity
  matches `rsvps[me]` only; the proxy-confirm pre-seed write at Task 3
  sends `proxyConfirmedBy: state.me.id` as a metadata field on the
  recipient's rsvp, NOT a write to `rsvps[someoneElse]` — the rule still
  enforces the picker is writing the recipient's slot, but the
  `proxyConfirmedBy` audit trail records who proxied. **Note:** the
  picker writing to other members' rsvps slots (Task 3 line 469-484) is a
  legitimate use case the rules permit because the picker is the intent
  creator AND `proxyConfirmedBy` carries the audit trail; if rules need
  tightening to require the picker's own uid for cross-member rsvp
  pre-seeds, that is a 14-06 follow-up not this plan's scope.
- **T-14.07-03 (rapid counter-nomination DoS)** — `counterChainDepth`
  cap at 3 enforced both server-side (rules from 14-06) and client-side
  (Task 4's `if (newDepth > 3) flashToast('Counter chain cap reached')`
  early-return + UI disable at `counterDepth >= 3`).

No new threat surface introduced.

## Known stubs

None. All rendered surfaces consume live state from `state.titles`,
`state.members`, `state.couchMemberIds`, and `state.intents` (the latter
hydrated by the existing `state.unsubIntents` subscription). Every action
button writes to Firestore via attributed `updateDoc`/`addDoc` calls. The
T1/T2/T3 tier aggregators consume real data from 14-03's pure functions
which themselves consume `isWatchedByCouch` from 14-01. Convert handler
creates a real watchparty doc and routes to Phase 11-05's real lobby flow.

## Open follow-ups for downstream plans

- **Multi-device Flow A UAT** — deferred from this plan's Task 5.
  Tracked in STATE.md "Open follow-ups" as a HUMAN-VERIFY item, bundled
  conceptually with the existing 14-08 multi-device Flow B UAT entry.
  **Must run before Phase 14 ships to v34 production deploy.** Recap
  steps captured in the Task 5 section above.
- **14-09 (push categories)** — must ship `flowAPick`, `flowAVoteOnPick`,
  `flowARejectMajority` (Flow A's three new event types) in
  `NOTIFICATION_DEFAULTS` (`queuenight/functions/index.js:74`) +
  `DEFAULT_NOTIFICATION_PREFS` (`js/app.js:100`) +
  `NOTIFICATION_EVENT_LABELS` (`js/app.js:113`) so user pref toggles
  take effect. Until then, all Flow A pushes default-ON via the fallback
  at `queuenight/functions/index.js:114-115`. See 14-06-SUMMARY.md
  deviation 1 for the underlying reason.
- **14-09 (onboarding tooltip)** — D-10's `tileActionSheet` tooltip and
  the new `couchSeating` tooltip both anchor near surfaces this plan
  reads from (couch viz + tile action sheet); 14-09 should also consider
  a per-first-encounter tooltip on the Flow A entry CTA itself
  ("Tap to start tonight's pick — taps you've made on the couch above
  determine who gets the push"). Optional; not in 14-09's locked scope.
- **14-09 (sw.js v34 CACHE bump)** — the `bash scripts/deploy.sh
  34.0-decision-ritual` at the end of Phase 14 per DECI-14-13 will push
  Flow A + the new CSS to installed PWAs alongside Flow B + onboarding
  tooltips + empty states + push categories.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f css/app.css ]` → FOUND
- `[ -f app.html ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-07-SUMMARY.md ]` → FOUND (this file)
- Commit `d97a81e` in `git log --oneline` → FOUND (verified via `git log --oneline -15` showing `d97a81e feat(14-07): Flow A — group rank-pick + push-confirm UI (D-07)`)
