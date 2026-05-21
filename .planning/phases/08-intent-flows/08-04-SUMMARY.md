---
phase: 08-intent-flows
plan: 08-04
status: complete
completed: 2026-04-22
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [INTENT-01, INTENT-02, INTENT-03]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 08-04 — Push integration: intentProposed + intentMatched event types

Wires the intent-flow primitive into the Phase 6 push infrastructure with two new event types and two new Cloud Function triggers. Per-event opt-out works automatically because Phase 6's `sendToMembers` already reads notificationPrefs keyed by eventType. Without this plan intents are silent unless a user is actively looking at the app; with it, intents and matches reach people on their home screens.

## What landed

### Client (`js/app.js`)
- **`DEFAULT_NOTIFICATION_PREFS`** gains `intentProposed: true` + `intentMatched: true` keys per D-19
- **`NOTIFICATION_EVENT_LABELS`** gains:
  - `intentProposed: { label: 'New intent posted', hint: 'When someone proposes a tonight-watch or asks the family about a title' }`
  - `intentMatched: { label: 'Intent match', hint: 'When your proposed watch reaches the family threshold — time to schedule' }`
- Existing Settings → Notifications renderer auto-includes the new toggles via its `Object.keys(DEFAULT_NOTIFICATION_PREFS)` iteration (no code change needed beyond the map updates)
- **`createIntent` extended** to also stamp `createdByName: state.me.name` alongside `createdBy` so CF push bodies can render clean copy without an extra members lookup

### Cloud Functions (`queuenight/functions/index.js`)
- **`exports.onIntentCreated`** at queuenight/functions/index.js:379 — fires on `families/{familyCode}/intents/{intentId}` doc create:
  - Reads intent doc; resolves `createdByName` fallback ("A family member")
  - Composes type-specific body:
    - tonight_at_time → "{name} proposed \"{title}\" for {hh:mm}" (uses `proposedStartAt` formatted via `toLocaleTimeString`)
    - watch_this_title → "{name} asked: \"{title}\"?"
  - Pushes to non-creator members via `sendToMembers(...)`:
    - `tag: 'intent-${intentId}'`
    - `url: '/?intent=${intentId}'` (deep-link to RSVP modal)
    - `eventType: 'intentProposed'`
    - Self-echo discipline: `excludeUid: intent.createdByUid, excludeMemberId: intent.createdBy` per D-20
- **`exports.onIntentUpdate`** at queuenight/functions/index.js:484 — fires on `families/{familyCode}/intents/{intentId}` onUpdate:
  - Gates on open→matched transition only: `if (before.status === 'matched' || after.status !== 'matched') return null`
  - Pushes to `[after.createdBy]` via `sendToMembers` with:
    - `title: 'Your intent matched!'`
    - `body: '"{title}" — everyone\'s in. Time to schedule.'`
    - `eventType: 'intentMatched'`
    - **No self-echo args** — creator IS the intended sole recipient per D-21

### Server `NOTIFICATION_DEFAULTS` parity
- Same two keys (`intentProposed: true, intentMatched: true`) added to the server-side defaults map for parity with client; server reads notificationPrefs keyed by eventType when fanning out, so without server-side defaults the ON-by-default semantic wouldn't hold for users with no explicit prefs map yet

## Cross-repo note

This plan was primarily a **queuenight-repo plan** (2 new CFs + NOTIFICATION_DEFAULTS parity), with a small couch-repo client-map update (DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS). Per Pitfall 2 (RESEARCH §8): **queuenight repo is not git-tracked from couch — deploy itself is shipping surface; production-live in us-central1 (project queuenight-84044).**

The two new CFs were deployed via `firebase deploy --only "functions:onIntentCreated,functions:onIntentUpdate"` from `~/queuenight`. Production verification: 14-VERIFICATION.md (Phase 14 retroactive verification) cites `onIntentCreated` at :379 and `onIntentUpdate` at :484 still firing for all 4 flows post-DECI-14-09 extension — Phase 8 origin preserved through the Phase 14 widening. Couch-repo client-map updates shipped via standard hosting deploy.

## Smoke tests

- `grep -n "intentProposed\|intentMatched" js/app.js` → both keys present in DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS
- `grep -n "onIntentCreated\|onIntentUpdate" queuenight/functions/index.js` → exports at :379 + :484
- `grep -n "createdByName" js/app.js` → createIntent stamps the field
- Phase 14 14-VERIFICATION.md cross-references confirm all 16 push event types lockstep across server NOTIFICATION_DEFAULTS + client DEFAULT_NOTIFICATION_PREFS + client NOTIFICATION_EVENT_LABELS, including the 2 originally added by this plan

## Must-haves checklist

- [x] DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_DEFAULTS gain intentProposed (default true) + intentMatched (default true)
- [x] NOTIFICATION_EVENT_LABELS gains 2 entries with warm human-readable copy
- [x] CF onIntentCreated fires on doc create; pushes eventType=intentProposed to non-creator members
- [x] CF onIntentUpdate fires on status→matched transition; pushes eventType=intentMatched to creator only
- [x] Both triggers pass excludeUid + excludeMemberId for self-echo discipline (D-20)
- [x] No regression on existing Phase 6 eventTypes
- [x] createIntent stamps createdByName on the intent doc for CF rendering

## What this enables

- **Plan 08-05** UAT exercises end-to-end push delivery (browser-Claude autonomous run 2026-04-22)
- **Phase 14 / 14-09 (DECI-14-12)** extends the same push-categories pattern with 7 new D-12 keys (`flowAPick`, `flowBNominate`, `flowAVoteOnPick`, `flowBCounterTime`, `flowARejectMajority`, `flowBConvert`, `intentExpiring`) — all keep parity across the same 3 maps that this plan established the pattern for
- **Phase 9 / 09-07a** closed the `08x-intent-cf-timezone` seed surfaced from the push body's time-formatting in `onIntentCreated` (the `toLocaleTimeString` call in this plan's CF body needed creator's IANA tz to render correctly across timezones — fix landed via creatorTimeZone capture pattern, see 09-07a-SUMMARY.md line 90)

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Phase 8 had ZERO SUMMARYs prior to Phase 15.2 per v33.3 milestone audit (lines 180-191) — the largest single audit-trail gap in the project. UAT was browser-Claude autonomous run 2026-04-22 (per ROADMAP §25). Evidence sources: 08-04-PLAN.md (5-task block + onIntentCreated/onIntentUpdate interfaces), 08-CONTEXT.md (D-19/D-20/D-21 push decisions), production-live `onIntentCreated` at queuenight/functions/index.js:379 + `onIntentUpdate` at :484, audit YAML lines 192-205 (INTENT-01..03 evidence blocks), Phase 14 14-VERIFICATION.md cross-reference confirming push lockstep, 09-07a-SUMMARY.md timezone-echo absorption note.
