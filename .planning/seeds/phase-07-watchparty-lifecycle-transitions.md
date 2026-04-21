---
seeded: 2026-04-22
target-phase: 7
trigger: "Phase 6 UAT (2026-04-22) revealed onWatchpartyUpdate trigger listens for status→active transition that nothing in the codebase actually writes"
related: []
---

# Phase 7 seed — Watchparty lifecycle state transitions

## Observation

Phase 6 Push Notifications UAT surfaced a pre-existing gap in the watchparty implementation:

- `confirmStartWatchparty` in `js/app.js` (line ~6861) sets status at create time based on lead time:
  - `startAt <= Date.now()` → status = `'active'`
  - `startAt >  Date.now()` → status = `'scheduled'`
- Nothing in the codebase flips `'scheduled'` → `'active'` when the clock reaches `startAt`. No scheduled Cloud Function, no pubsub timer, no client-side listener.
- Consequence: `onWatchpartyUpdate` (the CF trigger that watches for `status → 'active'` and sends the "Watchparty starting" push) never fires in normal usage. It's aspirational infrastructure.

## What still works (why this isn't immediately broken)

- Picking **"Now"** as the lead time creates the watchparty directly as `'active'`, so `onWatchpartyCreate` fires and pushes under `watchpartyScheduled`. The flagship cross-device push case is covered.
- Users who open a scheduled watchparty at/after startAt see it in the watchparty-live modal regardless of status because `activeWatchparties()` includes anything with `status !== 'cancelled' && status !== 'archived'` and the live modal opens on click.
- Nothing is broken in the current UX — the "Watchparty starting" push just never arrives, which users never noticed because the watchparty-starting event has never been tested end-to-end on prod.

## What to build in Phase 7

### Decision: client-side or server-side flip?

- **Server-side (cron CF):** periodic (every minute) Firestore query for watchparties with status=scheduled AND startAt<=now. Flip to active. Pros: deterministic, independent of any client being online. Cons: ongoing CF quota cost (tiny), cron granularity = ~1 min lag.
- **Client-side (local timer):** each client subscribed to the watchparty collection schedules a `setTimeout` to flip the first one crossing startAt. Pros: zero CF cost, sub-second precision. Cons: only fires if at least one client is open; races if multiple clients try to flip at once.
- **Hybrid:** client-side primary, CF cron as safety net every 5 min.

Phase 6 ROADMAP D-03 decision assumed the flip happens somewhere; planner never explicitly chose. Revisit in /gsd-discuss-phase 7.

### Other Phase 7 lifecycle touchpoints affected

- `'ended'` / `'archived'` transition when the last participant leaves — partially implemented (`leaveWatchparty` archives when participants empty) but no natural end-of-movie transition
- Watchparty expiry — scheduled parties that never start should auto-cancel after ~6 hours past startAt
- Reaction cleanup — reactions on archived parties should be TTL'd

## Fix-now vs Phase 7

Fix-now is an option — ~1 hour of work to add the client-side flip timer. Risk: adds realtime surface area before Phase 7's broader watchparty rework could consolidate the decision. Recommendation: let Phase 7 decide the full state machine rather than patching in isolation.

## Success criteria (for Phase 7 plan)

- Scheduling a watchparty 5 minutes out, then closing all clients, then reopening any client after startAt → watchparty appears as `active`, not stuck at `scheduled`
- `onWatchpartyUpdate` fires on the status transition, delivering the "Watchparty starting" push the Phase 6 plan intended
- No double-flips under contention (multiple clients racing to flip the same doc)
- `06-UAT-RESULTS.md` Scenario 1 note about the adaptation can be removed

## Estimate

~3 hours including tests + UAT verification on iOS PWA. Low risk if done as a discrete Phase 7 plan.
