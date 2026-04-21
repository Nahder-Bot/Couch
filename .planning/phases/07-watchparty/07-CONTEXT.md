# Phase 7: Watchparty - Context

**Gathered:** 2026-04-22 (autonomous, `/gsd-discuss-phase 7 --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Generalize the existing **Sports Watchparty** scaffolding in `js/app.js` (105 mentions, full lifecycle partially built) into a first-class Watchparty primitive usable from any movie/show title, tie it into the Phase 5 auth model so every write carries `actingUid`, close the lifecycle-state-machine gaps surfaced during Phase 6 UAT, and wire the existing push infrastructure (from Phase 6) end-to-end for watchparty-starting. The feature is half-shipped — Phase 7 finishes it.

**In scope:** Lifecycle state transitions (scheduled→active flip unblocked so Phase 6 `onWatchpartyUpdate` push actually fires, plus timeout + orphan cleanup); "Start watchparty from Tonight's Pick card" UX (PARTY-01); real-time reactions polish (PARTY-04/05 already render; session controls + modes need UX polish); advisory per-member timer sync model (PARTY-03 — formalizing the existing `reactionsMode: 'elapsed'` pattern); Tonight-screen join banner (PARTY-07 — scaffolding partially exists); auto-cancel stale scheduled parties; ghost-session prevention (PARTY-06).

**Out of scope (deferred):**
- Host-broadcast or consensus sync models (decision locked below — advisory only)
- Video embed / in-app playback — we never touch the user's streaming service, just coordinate state
- Cross-family watchparties (public / friends-not-in-family) — post-v1
- Rich reactions (custom emoji upload, gifs) — Phase 9 polish
- Audio / video chat overlay — way post-v1
- "Tonight @ time" intent-flow integration — that's Phase 8 scope; Phase 7 just exposes the hooks
- Watchparty replay / time-shift — not a v1 concern

</domain>

<scaffolding_already_in_place>
## What's Already Shipped (pre-Phase-7)

**Downstream agents: read this before proposing new primitives.** Phase 7 finishes a partially-built feature; the schema is stable.

### Client (`js/app.js`)
- `watchpartyRef(id)` (line 1285) — canonical Firestore path `families/{code}/watchparties/{id}`
- `confirmStartWatchparty` (line 6847) — create flow with lead-time picker (Now / 5 / 15 / 30 / 60 / custom); status decided at create (`startAt <= Date.now() ? 'active' : 'scheduled'`) — **NOT flipped later; this is the gap Phase 6 UAT surfaced**
- `openWatchpartyStart(titleId)` (line 6538) — opens the start modal
- `openWatchpartyLive(wpId)` — opens the live session modal (participants, reactions, leave)
- `setWpMode(mode)` (line 7257) — per-participant reactions mode toggle (elapsed / wallclock / hidden)
- `leaveWatchparty(wpId)` (line 7268) — removes self from participants; archives when last one leaves (PARTY-06 partial)
- `sendReaction(emoji)` / reactions UX — adds to `wp.reactions` array with `arrayUnion`
- `activeWatchparties()` (line 1286) — filters out cancelled/archived
- `wpForTitle(titleId)` (line 1303) — finds active party for a given title
- `maybeNotifyWatchparties` (line 1053) — local in-app Notification API fallback for soon-starting parties (not web-push; predates Phase 6)

### Service Worker + Cloud Functions
- `onWatchpartyCreate` (PHASE 6 wired, tested 2026-04-22) — pushes `watchpartyScheduled` on doc create, excluding host
- `onWatchpartyUpdate` (PHASE 6 wired, UNTESTED in practice) — pushes `watchpartyStarting` on `status → 'active'` transition. Currently never fires because nothing writes that transition (the gap seeded as phase-07-watchparty-lifecycle-transitions)
- Per-event-type granularity (Phase 6) — users can opt out of `watchpartyScheduled` / `watchpartyStarting` separately
- Quiet hours + `forceThroughQuiet` (Phase 6) — watchparty-starting overrides quiet hours since RSVP'd users explicitly signed up

### Data model
- `families/{code}/watchparties/{id}` — doc fields:
  - `titleId`, `titleName`, `hostId`, `hostName`, `hostUid` (Phase 5 attribution)
  - `startAt` (unix ms), `status` (`'scheduled' | 'active' | 'archived' | 'cancelled'`)
  - `participants` — map keyed by memberId, value = `{ joinedAt, elapsedMs, reactionsMode, pausedAt? }`
  - `reactions` — append-only array of `{ id, memberId, memberName, elapsedMs, at, emoji }`
- Session banner rendering: Tonight screen scaffolded with watchparty banner div; polish needed

### What's broken / missing
- **No scheduled→active flip** — biggest functional gap. Both blocks Phase 6's `watchpartyStarting` push AND means any watchparty scheduled >0 min out is stuck at `scheduled` forever (though the live modal opens regardless)
- **No auto-cancel for stale scheduled parties** — a party scheduled then abandoned sits in Firestore indefinitely
- **No session timeout** — if everyone force-quits, `status` never flips to `archived` (PARTY-06 partial)
- **"Start from Tonight's Pick card"** — PARTY-01 UX doesn't exist yet; currently you must tap ⋯ on a title card + "Start a watchparty" from the action sheet. The Tonight Pick card has no direct CTA.
- **Tonight banner when session active** — PARTY-07 scaffolding exists but visibility / clickability / content needs verification + polish
- **Advisory per-member timer UX** — the model is in the data shape (`elapsedMs` per participant), but no current UI shows "Alice is 23 min in, Bob is 18 min in"
- **Reactions real-time bug?** — need to verify reactions propagate instantly. `arrayUnion` + `onSnapshot` should handle this, but worth live-testing

</scaffolding_already_in_place>

<decisions>
## Implementation Decisions

### Sync model (PARTY-03 — the one hard decision)

- **D-01:** **Advisory per-member timer.** Each participant tracks their own `elapsedMs` + `reactionsMode`. No host-broadcast play/pause/seek forcing. When Alice pauses, only Alice's `pausedAt` flips. Other members see "Alice paused at 34:12" if they want but continue at their own pace.
- **D-02:** **Rationale:** (a) we never touch the user's video — we can't actually cause the streaming service to pause/seek; (b) families often watch on different devices at slightly different speeds (kid rewinds, parent scrubs); (c) consensus-mode complexity is a future-phase decision; (d) existing code already chose advisory via `reactionsMode: 'elapsed'`. We're formalizing, not changing.
- **D-03:** **Reactions are timestamped against the reacter's own elapsed time.** Alice reacts 🔥 at her 23:10; Bob sees "Alice reacted at 23:10" regardless of where Bob is in the movie. Feels right for advisory-timer: reactions are always comparable, regardless of drift.

### Lifecycle state machine (the big Phase 6 UAT surfaced gap)

- **D-04:** **Client-side primary flip, CF cron safety net.** Every client subscribed to the watchparty collection schedules a `setTimeout` to flip the first `scheduled` party crossing `startAt` to `'active'`. If no client is online, a CF scheduled every 5 minutes scans + flips. Double-flip prevention: `updateDoc` conditional on `status === 'scheduled'` (no `where` support for conditional updates; rely on client check + CF idempotency).
  - **CF cron runtime cost:** small — one query per 5 min, even in idle families with no active watchparties ($<1/mo at our scale).
- **D-05:** **Auto-cancel stale scheduled parties.** Scheduled CF (same cron) archives parties where `status === 'scheduled' AND startAt < now - 6h`. Prevents Firestore clutter + accidental push-storms when someone schedules and forgets.
- **D-06:** **Auto-archive empty active parties.** If `status === 'active' AND len(participants) === 0 AND lastActivityAt < now - 30min`, flip to `'archived'`. Orphan prevention for PARTY-06.
- **D-07:** **No flip on host sign-out.** Existing `leaveWatchparty` already handles the "everyone left" case. We don't need a session-vs-auth tie-in for v1.

### "Start from Tonight's Pick card" (PARTY-01)

- **D-08:** **Add a "Watch together" button** to the Tonight's-Pick card (post-spin result). Taps into the existing `openWatchpartyStart(titleId)` flow. No new modal; reuse the existing start-watchparty modal with its lead-time picker.
- **D-09:** **If a watchparty already exists for this title, the button changes to "Open watchparty" and routes to `openWatchpartyLive`.** Mirrors the existing action-sheet behavior from the ⋯ menu.

### Tonight banner (PARTY-07)

- **D-10:** **Banner shows the most imminent / currently-active watchparty**, not a feed. "Alice's watchparty starts in 12 minutes" or "Bob's watchparty is live — Inception" with a **Join** button.
- **D-11:** **Banner collapses when dismissed for this session** — sessionStorage flag, re-appears on next app open. Avoids nagging.
- **D-12:** **Multiple active parties in one family** — show only the first by startAt. Additional parties accessible via the title cards / activity feed. v1 will only rarely have multiple live parties.

### Reactions polish (PARTY-04/05)

- **D-13:** **Reaction palette = 8 emoji** (not user-configurable in v1). Picked to cover laugh / shock / love / chill / sad / cheer / silence / sleep. Specific emoji chosen at plan-time via quick UX judgment — Claude's discretion.
- **D-14:** **Real-time verified on snapshot** — reactions array appends via `arrayUnion` (existing); ensure `onSnapshot` on watchparty doc fires and re-renders the reaction feed without polling.
- **D-15:** **Reaction attribution** — use `writeAttribution()` helper (Phase 5 D-20). Self-echo suppression not needed client-side (reactions are fun to see your own pop up), but push (if we ever push on reactions) would need it.

### Other

- **D-16:** **No "Watchparty starting" push on every active-flip.** Only push when a `scheduled` party flips to `active` via the startAt-cross (not when a party is born active). Current onWatchpartyUpdate logic (`before.status !== 'active' && after.status === 'active'`) handles this correctly.
- **D-17:** **Scheduled-party push already covered by Phase 6 `watchpartyScheduled` event.** Phase 7 doesn't add new push events — just unblocks the existing `watchpartyStarting` by shipping the state transition.

### Claude's Discretion

- Emoji palette composition (8 slots)
- Banner copy tone (warm/cinematic — matches PROJECT.md design language)
- Plan granularity (likely 5 plans: lifecycle, PARTY-01+07, reactions polish, banner polish, UAT)
- Whether the CF cron uses `onSchedule` (2nd-gen) or `pubsub.schedule` (1st-gen) — planner to match existing `functions` SDK pattern (firebase-functions 4.9 supports both)
- Orphan-detection `lastActivityAt` field — derive from max(startAt, max reaction.at, max participant.joinedAt) or add an explicit field

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 7 goal, dependencies (5 + 6), success criteria
- `.planning/REQUIREMENTS.md` — PARTY-01 through PARTY-07
- `.planning/PROJECT.md` — constraints (no bundler, single-file-through-v1, warm cinematic design)
- `.planning/phases/05-auth-groups/05-CONTEXT.md` — writeAttribution (D-20), self-echo pattern (D-21)
- `.planning/phases/06-push-notifications/06-CONTEXT.md` — eventType granularity (D-08), forceThroughQuiet (D-13)
- `.planning/phases/06-push-notifications/06-UAT-RESULTS.md` — Scenario 1 adaptation note (why watchpartyStarting push never fires)
- `.planning/seeds/phase-07-watchparty-lifecycle-transitions.md` — the state-machine seed that motivated D-04/D-05/D-06
- `js/app.js` — existing Sports Watchparty scaffolding (105 mentions; start at line 1285 `watchpartyRef`)
- `queuenight/functions/index.js` — existing `onWatchpartyCreate` + `onWatchpartyUpdate` triggers

No external design doc exists. This CONTEXT.md is the design contract.

</canonical_refs>

<deferred>
## Deferred to Later Phases

- **Host-broadcast sync model** (if advisory-timer proves wrong in production feedback) — Phase 8 or Phase 10
- **Consensus sync** — post-v1 concept
- **Rich reactions** (gifs, custom emoji, audio) — Phase 9 polish
- **Audio/video chat overlay** — post-v1
- **Cross-family watchparties** (friends not in your family) — post-v1
- **Watchparty export / share surface** — Phase 9 (marketing surface) if useful for growth
- **Replay / timeline scrub** — post-v1
- **Multi-party concurrent display on Tonight banner** — D-12 picks one; revisit if families frequently have 2+ concurrent parties

</deferred>

<assumptions>
## Assumptions to Flag

1. **Existing `openWatchpartyLive` UX is workable** — I'm extending, not rebuilding. If the live modal has UX issues surfaced during Phase 7 UAT, fix them then. Scope-creep caution applies.
2. **`arrayUnion` reaction writes propagate within 2s on Firestore real-time** — matches existing MOOD-02 / VETO-03 patterns. Re-verify during UAT.
3. **CF scheduled functions are allowed on current Firebase plan** — queuenight-84044 is on Blaze or Spark-with-scheduled permitted. If not, fall back to client-only flip with explicit "someone must be online" caveat.
4. **`state.watchparties` onSnapshot is already wired** — verified via `activeWatchparties()` usage in multiple spots. Will re-confirm at plan-time.
5. **PARTY-07 banner scaffolding doesn't need HTML surgery** — if it does, that's a plan-time discovery and Plan 07-04 scope expands accordingly.

</assumptions>

---

*CONTEXT gathered autonomously 2026-04-22 after Phase 6 UAT Scenario 1/2 PASS. User wants planning only; execution is a separate decision.*
