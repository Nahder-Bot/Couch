---
phase: 14-decision-ritual-core
plan: 08
plan-name: Flow B — solo-nominate + invite + counter-time (D-08 / DECI-14-08)
requirements_addressed: [DECI-14-08]
status: complete
completed: 2026-04-26
ship_state: SHIPPED — Tasks 1-4 code-complete and committed; Task 5 multi-device UAT DEFERRED to a later batch UAT pass (matches 14-02 pattern)
followup_tag: "Multi-device UAT deferred — recap before v34 production deploy"
commits:
  - hash: af168f1
    type: feat
    msg: "feat(14-08): ship Flow B solo-nominate (D-08 / DECI-14-08)"
    files: [js/app.js, css/app.css]
    repo: couch
files-touched:
  created: []
  modified:
    - js/app.js   # Tasks 1-4: openFlowBNominate + recipient response UI + nominator status screen + counter-decision UI + auto-convert indicator + all-No detection + snapshot re-render wiring + ?intent= deep-link routing
    - css/app.css # .flow-b-{nominate,response,counter,status,indicator,counter-row} on the warm-dark surface; .tc-secondary fallback (Rule 2)
deviations: 1   # Rule 2 .tc-secondary fallback (existing .tc-primary at css/app.css:1403 had no secondary partner)
checkpoints-hit: 1   # Task 5 — resolved with skip-uat (deferred)
auth-gates-hit: 0
key-decisions:
  - "Defer multi-device UAT to batch UAT pass before v34 production deploy (matches 14-02 pattern)"
  - "Add .tc-secondary CSS class (Rule 2) — preserves design-system parity with the existing .tc-primary token"
  - "Defensive typeof openFlowAResponseScreen guard so 14-08 lands cleanly before 14-07 (rank-pick)"
---

# Phase 14 Plan 08: Flow B — Solo-Nominate + Invite + Counter-Time Summary

D-08's Flow B nominate ritual shipped per plan — member nominates a title with
a proposed time, push goes to other family members (via 14-06's
`onIntentCreated` `flowBNominate` branch), recipients can join / counter /
decline, the nominator decides per counter (accept / reject / pick
compromise), CF auto-converts to a watchparty at T-15min if any Yes RSVPs
exist (handled CF-side per 14-06's `watchpartyTick` extension), all-No edge
case auto-cancels with `cancelReason='all-no'`, and hard expire at T+4hr is
enforced CF-side. The fifth task — multi-device UAT on staging — was
**explicitly DEFERRED** to a later batch UAT pass, matching the deferral
pattern locked by 14-02's iOS Safari touch-DnD UAT.

Together with 14-07 (Flow A — pending), this plan completes the two parallel
decision rituals that replace the vote-prominent Tonight tile with a
couch-centered, conversation-first UX.

## What shipped

### Task 1 — "Watch with the couch?" entry + openFlowBNominate UI

**Tile action-sheet entry** added to both `openTileActionSheet` (the new sheet
to be introduced in 14-05) and the existing `openActionSheet` at
`js/app.js:11853` for back-compat. The entry routes to a new
`window.openFlowBNominate(titleId)` function that lazy-creates a modal with:
- Title header
- `<input type="datetime-local">` for proposed start time, defaulting to
  8pm tonight (or now+1hr if past 8pm)
- `<textarea maxlength="200">` for an optional note
- Cancel + "Send nomination" submit

Submit calls `createIntent({flow:'nominate', titleId, proposedStartAt,
proposedNote})` from 14-06; on success it transitions to the nominator's
status screen (Task 3) so the actor can watch live RSVP progress.

### Task 2 — Recipient response UI: Join / Counter-suggest / Decline

`window.openFlowBResponseScreen(intentId)` lazy-creates a modal showing the
proposed time, optional note from the nominator, and three buttons:
- **Join @ proposed time** — writes `rsvps[me]={state:'in', at, actingUid,
  memberName}` via `updateDoc` with `writeAttribution()`.
- **Counter-suggest** — opens an inline counter-time picker prefilled with
  proposed-time + 1hr; submit writes
  `rsvps[me]={state:'maybe', counterTime, note, ...}` AND atomically
  increments `counterChainDepth` (capped at 3 client-side; rules from 14-06
  enforce server-side cap).
- **Decline** — writes `rsvps[me]={state:'reject', ...}`.

If the actor is the nominator, the function defers to
`openFlowBStatusScreen` instead (Task 3 path).

### Task 3 — Nominator status screen + counter-decision UI

`window.openFlowBStatusScreen(intentId)` shows:
- Live tally line: `${ins} in · ${counters} counter · ${declines} declined of
  ${recipientCount} family`.
- **Auto-convert indicator** — when `ins.length > 0` and
  `minutesToStart <= 30 && > 0`, renders
  `⏱ Auto-converting to watchparty in ${minutesToStart - 15} min (T-15)`.
- **All-No banner** — when `declines.length === recipientCount && ins.length
  === 0`, renders a banner with a "Cancel nomination" button that writes
  `status='cancelled', cancelledAt, cancelReason='all-no'` via `onFlowBAutoCancel`.
- **Counter rows** — one per recipient with a counter; each row has
  Accept / Reject / Compromise buttons:
  - **Accept** (`onFlowBAcceptCounter(memberId)`) — writes
    `proposedStartAt=counter.counterTime, proposedNote=counter.note,
    rsvps[me]={state:'in',...}` atomically.
  - **Reject** (`onFlowBRejectCounter(memberId)`) — clears the counter by
    writing `rsvps[memberId]={state:'maybe', note:'counter rejected by
    nominator'}` so the counter-er can re-respond.
  - **Compromise** (`onFlowBOpenCompromiseTimePicker(memberId)`) — opens
    `window.prompt()` prefilled with the midpoint timestamp; user-edited
    value is validated for future-time and written to `proposedStartAt`.
- "End nomination" footer button — writes `status='cancelled', cancelledAt`.

### Task 3 wiring — snapshot re-render

`maybeRerenderFlowBStatus()` is wired into the `state.unsubIntents` snapshot
handler (the same one used by Flow A and Phase 8 intents). Whenever the
intents subscription ticks, both the status screen and the response screen
re-render if open, so the nominator sees counter rows appear and the
recipient sees their `state` reflected back without manual refresh.

### Task 4 — `?intent=<id>` deep-link routing

`maybeOpenIntentFromDeepLink()` parses `?intent=` from `window.location`,
strips the param via `history.replaceState` (so refresh doesn't re-trigger),
then waits for the intents subscription to hydrate before routing:

| Intent `flow` value | Routes to |
|---|---|
| `'rank-pick'` | `openFlowAResponseScreen` (typeof-guarded — 14-07 ships later) |
| `'nominate'` (creator) | `openFlowBStatusScreen` |
| `'nominate'` (recipient) | `openFlowBResponseScreen` |
| Legacy Phase 8 `type` | falls through to existing handler |

The defensive `typeof openFlowAResponseScreen === 'function'` guard means
14-08 can land cleanly before 14-07 without breaking deep links — Flow A
intents simply no-op until the function exists.

### Task 5 — HUMAN-VERIFY multi-device UAT (DEFERRED — `skip-uat` resume signal)

**Deferral was a deliberate user choice, not an oversight.** Same pattern
as 14-02's iOS Safari touch-DnD UAT: a multi-device end-to-end UAT
(2 devices, 2 family members, push delivery, T-15 auto-convert wait, all-No
edge case) is best run as a single batch verification pass right before
v34 production deploy, NOT mid-phase. Running it now buys us nothing
that running it then doesn't, and Phase 14's remaining plans (14-04, 14-05,
14-07, 14-09) may touch adjacent surfaces that the same UAT pass should
exercise together.

**The UAT remains valid and must run before Phase 14 ships to v34
production deploy.** It is recorded in STATE.md "Open follow-ups" as a
HUMAN-VERIFY item so the v34 deploy gate cannot be missed.

**Recap items for the future UAT** (extracted from
`14-08-flow-b-solo-nominate-PLAN.md` Task 5 `<how-to-verify>`):

1. Deploy CFs (queuenight) + hosting (couch) to staging. Sign in on
   Device A and Device B as different family members.
2. **Nominate flow:** Device A taps a tile → "Watch with the couch?" →
   sets time to NOW+20min → submits. Status screen opens for nominator.
3. **Push delivery:** Device B receives a push within ~5s on iOS PWA;
   body matches D-12 BRAND voice ("X wants to watch Y at Z. Join,
   counter, or pass?").
4. **Recipient response — counter:** Device B taps push → response screen
   opens → tap Counter-suggest → set NOW+30min → send.
   `counterChainDepth` should now be 1 in Firestore.
5. **Nominator counter-decision:** Device A status screen updates live →
   counter row appears with Accept/Reject/Compromise buttons → tap
   Accept → `proposedStartAt` updates to NOW+30min in Firestore.
6. **Recipient join:** Device B taps "Join @ proposed time" → ins count
   reaches 1 on Device A; nominator status updates live.
7. **T-15 auto-convert:** wait until `proposedStartAt - now <= 15min`
   (or temporarily set `proposedStartAt` to NOW+5min to expedite). The
   `watchpartyTick` CF (5min cadence, shipped in 14-06) creates a
   watchparty doc → `flowBConvert` push lands on Device B → intent
   `status` flips to `'converted'` → nominator's status screen
   auto-closes after 1.5s grace.
8. **All-No edge case:** nominate again, set time NOW+30min, both other
   devices Decline → all-No banner appears on nominator screen → tap
   "Cancel nomination" → `status='cancelled'` with
   `cancelReason='all-no'` in Firestore.
9. **Deep-link routing (Task 4 surface):** with the app closed, tap a
   push notification on Device B → app opens directly to the response
   screen (not a generic landing); refresh — `?intent=` is stripped from
   the URL so reload doesn't re-trigger.

**Cross-plan dependency:** Plan 14-09 must ship the 7 push category
preferences (DR-3) before user toggles take effect — until 14-09 deploys,
all 7 new event types (`flowAPick`, `flowAVoteOnPick`, `flowARejectMajority`,
`flowBNominate`, `flowBCounterTime`, `flowBConvert`, `intentExpiring`)
default-ON via the fallback at
`queuenight/functions/index.js:114-115` (`defaultOn=true` when
`hasDefault=false`). This is the documented behavior — see 14-06-SUMMARY.md
deviation 1 — and it means the multi-device UAT will receive every push
whether the user has explicitly opted in or not.

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `grep -c "window.openFlowBNominate" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowBNominateScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowBResponseScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderFlowBStatusScreen" js/app.js` | 1 | **1 ✓** |
| `grep -c "createIntent\\(\\{[^}]*flow:[^}]*['\"]nominate" js/app.js` | ≥1 | **1 ✓** |
| `grep -c "all-no" js/app.js` | ≥1 | **1 ✓** |
| `grep -c "Auto-converting" js/app.js` | ≥1 | **1 ✓** |
| Task 5 multi-device UAT resolved | one of {passed, failed, skip-uat} | **skip-uat ✓** (deferred per user decision; documented above + tracked in STATE.md follow-ups) |

## Success criteria (per plan `<success_criteria>`)

1. ✓ "Watch with the couch?" entry present in tile action sheet AND
   full action sheet for back-compat.
2. ✓ Nominate UI accepts title + datetime-local time + 200-char note;
   submit creates Flow B intent with `flow:'nominate'`.
3. ✓ Recipient UI offers Join / Counter-suggest / Decline; counter writes
   `rsvps[me]={state:'maybe', counterTime, note}` + atomic
   `counterChainDepth` bump.
4. ✓ Nominator status screen surfaces live tally, auto-convert indicator,
   all-No detection, counter rows with Accept/Reject/Compromise actions.
5. ✓ Deep-link from `?intent=<id>` routes to nominator's status screen
   (creator) OR recipient's response screen (others); legacy Phase 8
   intents fall through.
6. ✓ Auto-convert at T-15min handled CF-side by `watchpartyTick`
   (14-06); UI surfaces a countdown indicator client-side.
7. ✓ All-No edge case auto-cancel writes `cancelReason='all-no'` with
   audit trail (`writeAttribution()`).
8. ◐ Multi-device UAT — DEFERRED (resolved via the plan's explicit
   `skip-uat` path; recorded in STATE.md follow-ups; must run before
   v34 production deploy).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 2 — missing critical functionality] Added `.tc-secondary` CSS
class as the design-system partner to the existing `.tc-primary` at
`css/app.css:1403`.**

- **Found during:** Task 1 (CSS implementation)
- **Issue:** The plan's CSS used `.tc-secondary` for Cancel buttons,
  Counter-suggest secondary CTA, "End nomination" footer, etc., but
  `.tc-secondary` did not exist in `css/app.css` — only `.tc-primary`
  was defined. Rendering would have produced unstyled `<button>` elements,
  visually breaking the modal.
- **Fix:** Added a `.tc-secondary` rule with warm-dark token-aligned
  styling (transparent bg, `--c-border` outline, `--c-text-strong`
  text) so secondary CTAs across all 3 Flow B modals render correctly.
- **Files modified:** `css/app.css`
- **Commit:** `af168f1`

## Authentication gates

None.

## Threat surface scan

The threat register in 14-08-PLAN.md (T-14.08-01, -02, -03) is fully
mitigated:

- **T-14.08-01 (non-nominator updates `proposedStartAt`)** — the convert /
  update branches in `firestore.rules` (shipped in 14-06) require
  `createdByUid` match; the new update branch (5) for counter-chain bumps
  only allows the `rsvps` and `counterChainDepth` keys, so a non-nominator
  cannot mutate `proposedStartAt`.
- **T-14.08-02 (counter-time DoS)** — `counterChainDepth` cap of 3 enforced
  both server-side (rules from 14-06) and client-side (Task 2's
  `if (counterDepth >= 3) flashToast('Counter chain full')` early-return).
- **T-14.08-03 (compromise time set to past timestamp)** — Task 3's
  client-side validation (`finalTime < Date.now()` early-return). Server-side
  `proposedStartAt` has no rule constraint, but the `watchpartyTick`
  auto-convert won't fire for past timestamps (`minutesBefore <= 15 AND >
  0` check in 14-06's CF), so a malicious past-timestamp write cannot trigger
  unintended watchparty creation.

No new threat surface introduced.

## Known stubs

None. All 4 implementation tasks render real data sourced from the live
intents subscription and produce real Firestore writes via
`writeAttribution()`-attributed `updateDoc` calls. The auto-convert
indicator is computed from live `proposedStartAt - Date.now()`; the all-No
banner is computed from live RSVP counts; counter rows render the actual
`counterTime` + `note` from each recipient's RSVP doc.

## Open follow-ups for downstream plans

- **Multi-device Flow B UAT** — deferred from this plan's Task 5.
  Tracked in STATE.md "Open follow-ups" as a HUMAN-VERIFY item.
  **Must run before Phase 14 ships to v34 production deploy.** Recap
  steps captured in the Task 5 section above.
- **14-09 (push categories)** — must ship `flowBNominate`,
  `flowBCounterTime`, `flowBConvert`, and `intentExpiring` in
  `NOTIFICATION_DEFAULTS` (`queuenight/functions/index.js:74`) +
  `DEFAULT_NOTIFICATION_PREFS` (`js/app.js:100`) +
  `NOTIFICATION_EVENT_LABELS` (`js/app.js:113`) so user pref toggles
  take effect. Until then, all Flow B pushes default-ON via the fallback
  at `queuenight/functions/index.js:114-115`. See 14-06-SUMMARY.md
  deviation 1 for the underlying reason.
- **14-07 (Flow A)** — when 14-07 ships, the deep-link handler in Task 4
  will route `flow:'rank-pick'` intents to `openFlowAResponseScreen`
  automatically. The defensive `typeof` guard means no edit to 14-08 is
  needed.
- **14-09 (sw.js v34 bump)** — the `bash scripts/deploy.sh
  34.0-decision-ritual` at the end of Phase 14 per DECI-14-13 will push
  Flow B + the deep-link handler + the new CSS to installed PWAs.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f css/app.css ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-08-SUMMARY.md ]` → FOUND (this file)
- Commit `af168f1` in `git log --oneline` → FOUND
