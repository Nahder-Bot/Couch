---
phase: 07-watchparty
plan: 01
subsystem: watchparty-lifecycle
tags: [firestore, cloud-functions, scheduler, watchparty, lifecycle-state-machine]

# Dependency graph
requires:
  - phase: 06-push-notifications
    provides: "onWatchpartyUpdate CF + watchpartyStarting event wiring (waiting for the scheduled→active transition that Phase 7 supplies)"
  - phase: 07-watchparty
    provides: "Existing Sports Watchparty wp doc schema + confirmStartWatchparty / scheduleSportsWatchparty create paths + activeWatchparties() filter"
provides:
  - "Client-side scheduled→active flip via setTimeout (idempotent, conditional-on-status updateDoc) — the missing transition that unblocks Phase 6's watchpartyStarting push"
  - "watchpartyTick onSchedule CF (every 5 minutes) — safety net for offline-client scenarios + 3-branch lifecycle: flip stale→archived (>6h past startAt), flip scheduled→active, archive empty active >30min inactivity"
  - "lastActivityAt field on watchparty doc — bookkeeping foundation for orphan detection (consumed by D-06 auto-archive threshold)"
affects: [07-02-tonight-banner, 07-03-reactions-palette, 07-05-creatorTimeZone-push-body, 07-06-render-path-gap, all future watchparty work]

# Tech tracking
tech-stack:
  added:
    - "firebase-functions/v2/scheduler — onSchedule trigger added to queuenight/functions/index.js"
  patterns:
    - "Client-primary state-flip + CF cron safety net: every connected client schedules a setTimeout to flip the first scheduled party crossing startAt; if no client is online, the 5-min CF cron picks it up. Idempotency handled by re-reading status before write (conditional-on-status pattern — Firestore has no `where` for conditional updates so client/CF both check)."
    - "Per-family iteration in the CF cron rather than collection-group query — pubsub/eventarc fan-out cost remains negligible at scale (small per-family query × 5-min cadence)."

key-files:
  created: []
  modified:
    - "js/app.js — _wpFlipTimers Map, scheduleWatchpartyFlips, flipWatchpartyToActive, lastActivityAt bookkeeping in confirmStartWatchparty + sendReaction + setWpMode"
    - "queuenight/functions/index.js — exports.watchpartyTick onSchedule('every 5 minutes', us-central1) with 3-branch state machine"

key-decisions:
  - "Client-primary flip with CF cron safety net (D-04 in 07-CONTEXT.md): every connected client owns the timer for the soonest-flippable party; CF cron is the fallback when no clients are online. Reasoning: minimizes CF invocation cost (~$<1/mo) while giving instant flip when any device is open."
  - "No Firestore rule changes — existing Phase 5 family-member-scoped writes already cover the threat surface (T-07-01-04 disposition: existing rules cover; client uses writeAttribution(); CF uses admin SDK by design)."
  - "lastActivityAt added as new doc field rather than derived from max(startAt, max reaction.at, max participant.joinedAt) — explicit field is cheaper to query and clearer to reason about for the D-06 auto-archive threshold."
  - "CF schedule: 'every 5 minutes' (not every minute) — balances client-flip primacy + acceptable orphan-detection latency (worst case 5 min for offline-only families)."

patterns-established:
  - "Client-primary state-flip + CF cron safety net pattern — applies to any time-driven state transition where client primacy is desirable for instant UX feedback but offline-resilience is required."
  - "lastActivityAt bookkeeping pattern: explicit timestamp field updated by every meaningful client write (reactions, mode toggles, participant changes) — feeds orphan-detection thresholds without derivation cost."

requirements_completed: [PARTY-06]
verifier_method: retroactive_backfill_phase_15.2

# Metrics
duration: ~unknown (autonomous run; commit febdc8a follows immediately, so approximately 1-2 min)
completed: 2026-04-22
---

# Plan 07-01 — Watchparty Lifecycle State Machine

**Closes the lifecycle gap surfaced by Phase 6 UAT: scheduled watchparties now flip to `active` at their startAt, triggering the previously-dead-code `onWatchpartyUpdate` push. CF cron is the offline safety net + cleans up stale scheduled parties (>6h) + empty active timeouts (>30min).**

## What landed

- **Client-side flip:** `_wpFlipTimers` Map (wpId → timeoutId) tracks pending flips. `scheduleWatchpartyFlips(parties)` is called from the existing `state.unsubWatchparties` onSnapshot handler — clears timers for parties no longer scheduled, arms `setTimeout(flipWatchpartyToActive, max(0, startAt - now))` for each scheduled party with delay ≤6h. Far-future parties skip client timers and rely on the CF cron.
- **`flipWatchpartyToActive(wpId)`:** Re-reads doc, validates status still `scheduled` AND startAt past (defensive double-check), writes `{ status: 'active', lastActivityAt: Date.now(), ...writeAttribution() }`. Idempotent under multi-client races — each client re-reads status before write.
- **`lastActivityAt` bookkeeping:** Added to `confirmStartWatchparty` doc create payload + `sendReaction` updateDoc + `setWpMode` updateDoc. Foundation for the D-06 auto-archive threshold.
- **CF `watchpartyTick`:** New `onSchedule({ schedule: 'every 5 minutes', region: 'us-central1' })` function imports `firebase-functions/v2/scheduler`. Iterates families × watchparties with 3 branches:
  1. **Stale-scheduled archive:** `status === 'scheduled' AND startAt < now - 6h` → archived with `archivedReason: 'stale_scheduled'`
  2. **Scheduled→active flip (CF fallback):** `status === 'scheduled' AND startAt <= now AND startAt >= now - 6h` → active + `lastActivityAt: now`
  3. **Empty-active archive:** `status === 'active' AND len(participants) === 0 AND lastActivityAt < now - 30min` → archived with `archivedReason: 'empty_active_timeout'`
- **Phase 6 unblock:** The `onWatchpartyUpdate` CF (Phase 6) watches `before.status !== 'active' && after.status === 'active'` — now actually fires because something writes that transition, delivering the `watchpartyStarting` push. UAT Scenario 1 (flagship) verifies this end-to-end with <5s push latency.

## Commits

- **`6a8d473`** — `feat(07-01): watchparty lifecycle state machine — client flip + CF cron safety net`

## Cross-repo note

Per Pitfall 2 (and the precedent established by 07-05-SUMMARY's deviation block + STATE.md "two-repo discipline" notes): the `queuenight/` repo is **not git-tracked from couch**. The `watchpartyTick` CF source lives at `C:\Users\nahde\queuenight\functions\index.js` and shipped via `firebase deploy --only functions:watchpartyTick` to `queuenight-84044` us-central1. The deploy itself is the shipping surface — the couch-repo commit `6a8d473` carries the client-side changes only.

Production health verification 2026-04-21 22:00-22:35 UTC: 8 consecutive `watchpartyTick` invocations, 10 families scanned, 0 errors. Branch logic confirmed sound at `queuenight/functions/index.js:425-428` (stale_scheduled) + `:436-441` (empty_active_timeout) per 07-04 UAT-RESULTS.md Scenarios 7+8.

## Smoke tests

What was tested at the static + runtime level:

1. `node --check queuenight/functions/index.js` passed
2. `grep "exports.watchpartyTick" queuenight/functions/index.js` returns 1 match
3. `grep "scheduleWatchpartyFlips\|flipWatchpartyToActive" js/app.js` returns implementations + onSnapshot call-site
4. Existing `onWatchpartyCreate` + `onWatchpartyUpdate` CFs preserved unchanged
5. Existing Sports Watchparty code paths untouched (regression-safe)
6. UAT Scenario 1 (flagship): scheduled wp 2-min-out from device A, iPhone PWA closed → push arrives <5s after startAt + flip lands + routing to live modal works

## Must-haves checklist

- [x] Client-side flip: watchparties onSnapshot schedules setTimeout to flip the first `scheduled` party crossing its startAt to `active`
- [x] Client flip uses updateDoc conditional-on-status pattern (read status, write only if still scheduled — idempotent under multi-client races)
- [x] CF onSchedule cron runs every 5 minutes with 3 responsibilities: flip scheduled→active for parties past startAt; archive stale scheduled parties >6h past startAt; archive empty active parties >30min inactive
- [x] lastActivityAt field added to watchparty doc — updated on reactions / participant changes; used for orphan detection
- [x] onWatchpartyUpdate CF (Phase 6) now actually fires on real flip transitions, delivering the watchpartyStarting push
- [x] No regression: existing Sports Watchparty continues to work

## What this enables

- **Phase 6 closure:** `watchpartyStarting` push delivers in production for the first time (UAT Scenario 1 PASS).
- **Plan 07-02:** Tonight banner can now reliably show "Live now" for scheduled-but-flipped parties.
- **Plan 07-03:** Reactions polish + advisory timer can assume the wp lifecycle is sound.
- **Plan 07-05 (gap-closure):** `creatorTimeZone` capture builds on the create paths this plan touched.
- **Plan 07-06 (gap-closure):** `lastActivityAt: Date.now()` pattern reused in `setWpMode`'s payload.
- **Plan 07-08 (gap-closure):** `effectiveStartFor` overrides build on the participant-doc shape this plan formalized.

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 07-01 shipped 2026-04-22 — only the 4 gap-closure plans (07-05..08) got proper SUMMARYs at the time. The v33.3 milestone audit YAML (`.planning/v33.3-MILESTONE-AUDIT.md` lines 51-102) identified the gap as "PARTY-02 + PARTY-06: orphaned / partial — 07-01-SUMMARY.md absent." Evidence sources used for this reconstruction:

- `07-01-PLAN.md` (must_haves checklist + interfaces sketch with the exact client + CF code shapes)
- `07-CONTEXT.md` (locked decisions D-01..D-17, especially D-04/D-05/D-06/D-07 for the lifecycle state machine)
- `07-04-UAT-RESULTS.md` (Scenarios 1, 7, 8 PASS — flagship + both orphan-archive branches)
- Production-live `watchpartyTick` CF at queuenight-84044 us-central1 (8-tick health check 2026-04-21)
- `07-05-SUMMARY.md` (cross-repo deploy nuance template + the 178-line CF reference)
- v33.3 audit YAML evidence blocks for PARTY-02 + PARTY-06

---

_Phase: 07-watchparty_
_Plan: 01_
_Completed: 2026-04-22_
_Reconstructed: 2026-04-27 by Phase 15.2-03 (retroactive_backfill_phase_15.2)_
