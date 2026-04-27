---
phase: 06-push-notifications
plan: 06-04
status: complete
completed: 2026-04-21
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [PUSH-03, PUSH-04]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 06-04 — 3 new event triggers + quiet-hours enforcement

Close the event-coverage gap (PUSH-03) by adding the 3 new Cloud-Function triggers for events whose source surfaces already exist today: invite-received, veto-cap-hit, and tonight's-pick-chosen. At the same time, wire up quiet-hours (PUSH-04) end-to-end — Settings UI picker + auto-detected timezone + server-side enforcement in `sendToMembers`. After this plan, the user-facing promise of Phase 6 is functionally complete.

## What landed

### queuenight/ repo (deployed; not git-tracked)
- **`functions/index.js`** new exports:
  - `exports.onInviteCreated` at `:259` — fires on `families/{familyCode}/invites/{token}` doc create. Resolves recipient via `where('uid','==',invite.recipientUid).get()`; skips when recipient isn't a member (code-only invites bail). Pushes "Invite from {senderName}" via `sendToMembers(...{ eventType:'inviteReceived', excludeUid: invite.senderUid, excludeMemberId: invite.senderMemberId })`.
  - `exports.onSessionUpdate` at `:296` — single trigger covering both veto-cap and tonight-pick branches by checking what transitioned in the doc. Body has two clearly-separated transition checks:
    - **veto-cap branch:** fires when `Object.keys(after.vetoes||{}).length` crosses threshold of 3 (interpretation noted in scope deviation #2 below). Pushes to group owner (resolved via `families/{code}.ownerUid` → memberId via `where('uid','==',ownerUid)`).
    - **tonightPickChosen branch:** SKIPPED with inline comment per scope deviation #1 — the existing session schema has no `pickedTitleId` field, so no transition to detect; client-side toggle remains as a harmless placeholder defaulting OFF.
- **`isInQuietHours(qh)` helper** at `:45` — wraps `Intl.DateTimeFormat` to compute current `HH:mm` in recipient's tz, parses `qh.start`/`qh.end`, handles wrap-around (22:00 → 08:00 spans midnight) via `(startMin < endMin) ? in-range : (>=start || <end)`. Falsy-returns on parse error or 0-length range so we default to "send" (transient errors don't silently drop pushes).
- **Quiet-hours gate inside `sendToMembers`** at `:139-141` — after the prefs read, evaluates `prefs.quietHours.enabled && !payload.forceThroughQuiet && isInQuietHours(prefs.quietHours)`; `continue`s the loop on hit.
- **Function-export count** went from 12 to 14 (+2: `onInviteCreated`, `onSessionUpdate`). Existing 3 triggers (`onWatchpartyCreate`, `onWatchpartyUpdate`, `onTitleApproval`) updated to pass eventType in 06-03 — unchanged here.

### Couch repo (committed)
- **`js/app.js`** Settings-screen quiet-hours UI:
  - Quiet-hours row inside the `notif-prefs` section: enabled checkbox + 2 `<input type="time">` pickers (default 22:00 / 08:00) + auto-detected-timezone caption (`Intl.DateTimeFormat().resolvedOptions().timeZone`).
  - `updateQuietHours({ enabled, start, end, tz })` helper — writes the full block to `users/{uid}.notificationPrefs.quietHours` via `updateDoc` dot-path. Validates `start`/`end` are valid `HH:mm` strings; supplies tz from Intl if not provided.
  - `getNotificationPrefs()` extended to merge default quiet-hours block when missing.

## Smoke tests

Per Plan 06-04 Task 7 — static verification (prod deploy staged-only at end of autonomous run):

- `node --check queuenight/functions/index.js` — syntax validates ✓
- `grep -c "exports\." queuenight/functions/index.js` — +2 vs pre-plan count ✓ (12 → 14)
- Existing 3 triggers unchanged ✓
- All new `sendToMembers` calls pass `eventType` ✓
- `grep -n isInQuietHours queuenight/functions/index.js` — helper at `:45` + gate at `:140` ✓

Runtime verification was deferred to Plan 06-05 UAT. Scenarios 1 + 2 PASSED 2026-04-22 (commits 421da52 + 25453be) covering the watchparty-starting and self-echo paths. Scenarios 3-6 (per-event opt-out, quiet hours, invite, veto-cap) received code-level verification post-update 2026-04-25 (commit 528e39f) + 3-day production-stable close-out — DEFERRED-RUNTIME for the multi-device + multi-account UAT.

## Must-haves checklist

From `06-04-PLAN.md` `must_haves.truths`:

- [x] 3 new CF triggers exist: `onInviteCreated` (invite-received), `onSessionUpdate-vetoCap` (veto-cap-hit), `onSessionUpdate-tonightPick` (tonight's-pick-chosen) — caveat: `tonightPickChosen` branch skipped per scope deviation; the trigger function itself exists and the veto-cap branch fires
- [x] New triggers use `sendToMembers` as the single send path and pass `eventType` + self-echo args (D-05 of 06-CONTEXT)
- [x] `quietHours` block is fully wired: Settings UI has enabled toggle + start/end time pickers + detected timezone
- [x] `sendToMembers` checks quiet hours against the recipient's timezone and skips when enabled + current time falls within range
- [x] `forceThroughQuiet: true` flag on payload bypasses quiet hours (used by watchparty-starting per global-approach choice — see Deviations)
- [x] No regression on existing 3 triggers

## Commits

- `e3caa4a` — `feat(06-04): quiet-hours UI + helper, onInviteCreated + onSessionUpdate (PUSH-04)`

## Deviations (recorded in 06-SESSION-SUMMARY)

1. **`tonightPickChosen` CF trigger skipped** — existing session doc schema has no `pickedTitleId` field. The "pick accepted" flow is `acceptSpin → openScheduleModal → watchparty doc created`, and watchparty creation already pushes via `onWatchpartyCreate` under `watchpartyScheduled`. Adding a `tonightPickChosen` trigger on `spinnerId` would fire too early (spin not yet accepted) or double-push. Skipped with inline comment; client-side pref toggle defaults OFF and exists as harmless placeholder. Unblocks future Phase 7/8 introducing explicit `pickFinalizedAt` field. **Documented in 06-SESSION-SUMMARY scope deviation #1.**
2. **`vetoCapReached` cap interpretation** — Plan said "vetoCount crosses threshold" but session schema has no `vetoCount` field; has `vetoes` MAP keyed by titleId. Used `Object.keys(vetoes).length` as cap-check; threshold = 3 (mid-point between Phase 4 per-member cap of 2 and "stuck-enough to warrant owner intervention"). Single-fire on transition from <3 to ≥3. Inline comment explains; cap is a single-line change at `VETO_CAP_FAMILY` constant if wrong. **Documented in 06-SESSION-SUMMARY scope deviation #2.**
3. **`forceThroughQuiet` chosen as global** — Plan 06-04 Task 4 noted "planner's call: prefer the simpler global approach if scope allows." Implementation chose global: every recipient of watchparty-starting bypasses quiet hours, not just RSVP'd recipients. Rationale: if user opted-in to `prefs.watchpartyStarting`, quiet-hours shouldn't block the thing they're waiting for. **Documented in 06-SESSION-SUMMARY honest caveat #4.** Strict RSVP-only refinement available as future polish.

## Cross-repo note

`queuenight/` repo is not git-tracked from couch (same Pitfall 2 pattern as 06-02 / 06-03). The 2 new CF triggers + `isInQuietHours` helper + quiet-hours gate were edited in-place at `C:\Users\nahde\queuenight\functions\index.js` and deployed via `firebase deploy --only functions:onInviteCreated,functions:onSessionUpdate,functions:onWatchpartyCreate,functions:onWatchpartyUpdate,functions:onTitleApproval` per 06-SESSION-SUMMARY deploy batch. Production state at `queuenight-84044` us-central1 per 06-UAT-RESULTS pre-flight row "Deployed 2026-04-22. 2 creates (onInviteCreated, onSessionUpdate) + 3 updates."

## What this enables

- **Plan 06-05** can run iOS PWA UAT against the now-functionally-complete push stack — every event that should push, pushes; every user can opt out per-event-type OR silence a time window; self-echo doesn't bug them
- **Phase 7 (Watchparty)** inherits the canonical `sendToMembers({eventType,excludeUid,excludeMemberId})` pattern — `onWatchpartyTick` (in `src/rsvpReminderTick.js`) and reaction-related CFs use it without per-trigger reimplementation
- **Phase 8 (Watch-Intent Flows)** extends with `intentProposed` / `intentMatched` events — same primitive
- **Phase 14 (Decision Ritual Core)** extends with 7 D-12 keys (flowAPick / flowAVoteOnPick / flowARejectMajority / flowBNominate / flowBCounterTime / flowBConvert / intentExpiring) — same primitive, lockstep maintained
- **PUSH-03 (watchparty-starting flagship)** + **PUSH-04 (quiet hours)** both close at this plan in code; PUSH-03 receives runtime UAT confirmation in Plan 06-05

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 06-04 shipped 2026-04-21 (autonomous run; only `06-SESSION-SUMMARY.md` was produced for the merged plan-suite). v33.3 audit YAML lines 159-172 identified the orphans (PUSH-03 + PUSH-04 both `claimed_by_plans: []` because Phase 6 plans never explicitly minted REQ ownership in canonical frontmatter form). Evidence sources: `06-04-PLAN.md`, `06-SESSION-SUMMARY.md` (commits + scope deviations + caveats), `queuenight/functions/index.js:45-70` + `:139-141` + `:259` + `:296` (production-live state), `js/app.js:100-262` quiet-hours UI helpers, audit YAML lines 159-172, commit `e3caa4a` in couch repo `git log`.
