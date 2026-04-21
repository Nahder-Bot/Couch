---
phase: 07-watchparty
plan: 04
type: uat-results
---

# Phase 7 — Watchparty UAT Results

**Scaffolded:** 2026-04-22 (autonomous execution of plans 07-01..03)
**Run:** 2026-04-21 — hands-on UAT (Scenarios 1-6) + remote code/health verification (Scenarios 7-8)
**Tester:** Nahder
**Devices:** iPhone home-screen PWA + second device (other family member signed in)
**Final status:** complete — 8/8 PASS (Scenarios 7-8 are code+health verified, not end-to-end behavioral); 5 issues logged (#1-#4 in-scope for Phase 7 fixes; #5 scoped to Phase 9.x seed)

---

## Pre-flight

| Check | Status | Notes |
|---|---|---|
| `firebase deploy --only functions:watchpartyTick` | PASS | CF observed ticking every 5 min, 10 families scanned, 0 errors (remote log 2026-04-21 22:00-22:35 UTC) |
| `firebase deploy --only hosting` | PASS | Verified via Scenarios 2/4/5/6 — Watch-together CTA, +more picker, participant strip, real-time reactions all live on iPhone PWA |
| Open couchtonight.app PWA → Settings → Notifications → ensure "Watchparty starting" toggle ON | PASS | Confirmed in-band by Scenario 1 — push arrived when party flipped to active |

---

## Scenarios

| # | Scenario | Result | Latency | Notes |
|---|---|---|---|---|
| 1 | **Flagship: scheduled→active flip + watchpartyStarting push** — Second device schedules a watchparty 2 min in the future. Leave iPhone PWA closed. At the scheduled time, iPhone should receive **"Watchparty starting"** push within ~5 s. This is the Phase 6 event that couldn't fire until 07-01 shipped the flip mechanism. | PASS (with follow-up) | <5s | 2026-04-21 UAT: push arrived, flip landed, routing to live modal worked. **Issue filed:** scheduled time displayed on the *other account* was off by ~4 hours vs actual 11pm scheduled time — timezone/UTC rendering bug. Tracked as Issue #1 below. Does not block scenario pass (lifecycle + push contract both honored). |
| 2 | **"Watch together" CTA from Tonight spin** — On iPhone, tap Spin → pick lands in modal → tap "🎬 Watch together" button → start-watchparty modal opens pre-populated → tap Now → Start. Existing watchparty live modal opens. | PASS | — | CTA lands, prepop works, Start flows into live modal. Side observations during run logged as Issues #2–#4 below. |
| 3 | **Existing banner shows live party** — From second device, start a watchparty. On iPhone, open Tonight tab. Banner should render with title + host + Join button. Tap Join → routed to live modal. | PASS | — | No regression on renderWatchpartyBanner. Side observation raised Issue #5 (banner dismiss + async replay mode) — scoped to future phase, not a Phase-7 fix. |
| 4 | **Emoji +more picker** — In a live watchparty modal, tap the "+" button at the right of the emoji bar. iOS native keyboard should open. Swipe to emoji tab (may need to do this once; iOS remembers thereafter). Tap any emoji (e.g., 🥹). Reaction posts and appears in the feed. | PASS | — | 07-03 picker hook working; multi-codepoint emoji extraction confirmed. |
| 5 | **Participant timer strip** — In a live watchparty with ≥2 members, the strip above the reactions feed shows one chip per member with name + elapsed-minutes status ("Joined" / "Paused" / "X min in"). Your own chip is highlighted with a warm border. Numbers advance as the minute rolls over. | PASS | — | Strip renders, self-highlight visible, elapsed tick advances. Related Issue #4 (on-time default + late-joiner override) still outstanding. |
| 6 | **Reactions real-time (regression check)** — iPhone taps 🎉 → second device shows "[iPhone member] 🎉" within 2 s. Repeat with 2-3 emoji in quick succession. No drops. | PASS | — | No regression on real-time delivery. (Late-joiner backlog gap = Issue #3, separate.) |
| 7 | **Orphan archive: stale scheduled** — Firebase Console → edit a watchparty doc to have status=scheduled, startAt=(now - 7h). Wait for next 5-min CF tick. Doc should update to status=archived, archivedReason=stale_scheduled. | PASS (code + health verified) | — | 2026-04-21 remote check: 8 consecutive ticks (22:00–22:35 UTC), 10 families scanned, 0 errors. Branch logic confirmed sound at `queuenight/functions/index.js:425-428` (status guard + 6h window + correct archivedReason write). Behavioral end-to-end (mutate prod doc + observe archive) NOT run — held for explicit user go-ahead. Upgrade to full PASS when an organic stale doc passes through or user authorizes Path A. |
| 8 | **Orphan archive: empty active** — From second device, create a watchparty (startAt=Now), then immediately leaveWatchparty. Watchparty doc now has status=active, participants={}. Wait 30 min + 5 min. Doc should archive with reason=empty_active_timeout. | PASS (code + health verified) | — | 2026-04-21 remote check: same CF / health as Scenario 7. Branch logic confirmed sound at `queuenight/functions/index.js:436-441` (status guard + participantCount===0 + 30m inactivity + correct archivedReason write). Behavioral end-to-end NOT run — upgrade to full PASS on next organic occurrence. |

---

## Known stubs / deferrals (not UAT failures)

- **GIF reactions** — deferred to Phase 9.x per seed `.planning/seeds/phase-9x-gif-reactions.md`. The `+` button is emoji-only in v1.
- **Banner session dismiss** — 07-02 scoped this in but the existing banner already naturally disappears when parties archive (25h window); explicit dismiss button skipped for v1.
- **Reaction palette lock to 8** — 07-03 CONTEXT D-13 proposed locking to 8 emoji; kept existing 10 + added `+more` picker to avoid churning familiar UX. Strict upgrade.

---

## Outstanding issues

### Issue #1 — Watchparty scheduled-time display off by ~4 hours on non-creator account
- **Found in:** Scenario 1 UAT, 2026-04-21
- **Symptom:** Creator scheduled watchparty for 11pm (local). When the "Watchparty starting" push landed on the *other* family member's device, the displayed start time was ~4 hours off (consistent with UTC-vs-EST rendering, or creator-local-vs-viewer-local mismatch).
- **Severity:** minor (lifecycle + push contract both correct; cosmetic-but-confusing metadata only)
- **Suspected root cause:** `startAt` Firestore Timestamp rendered without timezone conversion on the viewer's device — either (a) raw UTC `toLocaleString` without tz argument, or (b) `.toDate().toString()` path, or (c) creator's local-string stored as ISO without offset and re-parsed as UTC on read.
- **Where to look:** push-payload body construction in `js/app.js` (search for `startAt`, `toLocaleTimeString`, `toLocaleString`, and the `scheduleWatchparty` write path) + Cloud Function `onWatchpartyScheduled` payload if the time is formatted there.
- **Diagnosis plan:** grep app.js for watchparty time-rendering, verify timezone handling, confirm whether the bug is in the push payload or the in-app banner/modal on the receiver.
- **Fix routing:** if isolated to push-body formatting → 1 plan (small). If schema-level (startAt stored without offset) → wider (migration risk).

### Issue #2 — "Hide reactions" / "reaction delay" settings not taking effect
- **Found in:** Scenario 2 observation, 2026-04-21
- **Symptom:** User toggled hide-reactions and/or reaction-delay settings and the in-app behavior did not reflect the setting change (reactions still shown, no delay applied).
- **Severity:** major (feature is present in UI but non-functional — user expects setting parity with UI surface)
- **Suspected root cause candidates:** (a) setting not persisted to Firestore/local state on toggle, (b) persisted but reaction render path doesn't read it, (c) cached render not invalidated on setting change.
- **Where to look:** search `js/app.js` for `hideReactions`, `reactionDelay`, `reactionsHidden`, and the reaction feed render function. Check toggle handler writes → state.X → render gate.
- **Diagnosis plan:** spawn debug agent to trace setting from UI toggle → state write → render read and identify the break in the chain.

### Issue #3 — Late joiners receive no reaction backlog
- **Found in:** Scenario 2 observation, 2026-04-21
- **Symptom:** When a second family member joined a watchparty after reactions had already been posted, they saw none of the prior reactions — the feed started empty for them.
- **Severity:** major (pending clarification — may be by-design "live-only", but user expectation is backlog visible)
- **Open design question:** Should late joiners see reactions posted before they joined? User implies yes. If yes, this is a feed-load gap (`onSnapshot` of `reactions/` subcollection should pull existing docs on subscribe, not just `added` deltas from subscribe-time forward).
- **Where to look:** `subscribeWatchpartyReactions` (or equivalent) in `js/app.js`. Check whether initial snapshot is rendered or only `docChanges()` with type `added` from now on.
- **Diagnosis plan:** verify whether reactions subcollection subscription replays existing docs on attach; if not, change to full-query pattern OR add "since X" param so joiners pull from session-start.

### Issue #4 — Participant start-time: default on-time for pre/on-time joiners + manual "I started on time" toggle for late joiners
- **Type:** enhancement / product gap (not a regression — this is incremental PARTY-03 polish)
- **Found in:** Scenario 2 observation, 2026-04-21
- **Request:**
  1. **Default on-time inference:** If a participant's `joinedAt` is ≤ `startAt`, assume they started on time. Their strip chip should read their elapsed time from `startAt`, not from `joinedAt`.
  2. **Manual "I started on time" override:** If `joinedAt` > `startAt` (late), expose a one-tap control (chip menu or settings row) that lets the late joiner declare "I actually started on time" — e.g., they were already watching on TV and just joined the sync party late. Sets their effective-start = `startAt` for elapsed display and sync reference.
- **Why:** Real-world use case where the party's purpose is shared reactions; the exact moment someone tapped Join isn't the right anchor if they started watching at T=0 on another screen.
- **Severity:** minor (missing quality-of-life; current behavior is defensible but inferior)
- **Where to look:** `renderParticipantStrip` (or equivalent) in `js/app.js`, and the `joinedAt` write path in `joinWatchparty`. Participant doc shape may need an optional `effectiveStartAt` or `startedOnTime: boolean` field.
- **Fix routing:** 1 plan — add the inference + a UI affordance for late joiners.

### Issue #5 — Banner dismiss + async-replay watchparty mode (feature request, not a Phase-7 bug)
- **Found in:** Scenario 3 observation, 2026-04-21
- **Type:** product enhancement — scope belongs in a later phase (candidate for Phase 9.x or a new sub-phase under Watch-Intent/Year-in-Review). Not a Phase-7 regression.

- **Sub-request A — Banner lifecycle:** Live-watchparty banner should either (a) have a dismiss / collapse affordance, or (b) auto-minimize after some duration, so it doesn't permanently clog the Tonight surface for uninterested viewers. Must stay reachable from somewhere (e.g. a smaller pill, or a "Parties" surface).

- **Sub-request B — Async watchparty replay (big idea):** If a family member watches the same title the next day, they should be able to open a "replay" view of an archived party. As their own playback reaches position T, the view surfaces the reactions + comments that were posted when the original party was at position T of the same runtime. Goal: "feel like you were there, just delayed."

- **Schema implications:**
  - Reactions need to store the poster's **runtime position** (ms into the movie/episode), not just `serverTimestamp`. Today's model is wall-clock only.
  - The replay client needs a playback-position source of truth — either (i) user scrubs a slider, (ii) we hook into the provider app's reported progress (likely not feasible), or (iii) wall-clock-since-tap-Play estimate with manual resync.
  - Archived parties need a first-class "open in replay mode" entry point, distinct from the live-join banner.

- **Provider-source question:** For the replay's playback position, we likely can't read the external player (Netflix/Prime/etc.). Simplest v1: user taps **"I'm at X minutes"** or scrubs a timeline; reactions stream in aligned to that position.

- **Routing recommendation:** Seed this as `seeds/phase-9x-async-replay.md` (or similar). Out of scope for Phase 7 UAT closure; do **not** bundle into the gap-closure plan for Phase 7.

---

## Recommendation

**Phase 7 UAT outcome (2026-04-21):** all 8 scenarios PASS. Flagship (Scenario 1) passed — Phase 6 push loop is closed. UX surface (Scenarios 2-6) works end-to-end on iPhone + second device. Orphan-archive branches (7-8) verified by remote CF health + code-level branch review; behavioral end-to-end upgrade is opportunistic (organic cases or user-authorized prod mutation).

**Phase 7 closure is NOT clean:** 5 issues surfaced during UAT.

- **Ship-blocker candidates:** Issue #2 (hide-reactions/reaction-delay settings non-functional) — major, user-visible broken setting. Issue #3 (late-joiner reaction backlog missing) — major, subscription semantics gap.
- **Minor polish:** Issue #1 (timezone display on push/banner), Issue #4 (on-time inference + late-joiner override).
- **Out of scope for Phase 7:** Issue #5 (banner dismiss + async-replay mode) — seeded as Phase 9.x work.

**Routing recommendation:**
1. `/gsd-plan-phase 7 --gaps` (gap-closure plan) covering Issues #1-4. Expected ~3-4 plans (#2/#3 likely 1 plan each; #1/#4 can bundle).
2. Issue #5 → write `seeds/phase-9x-async-replay.md`; do NOT include in the gap-closure batch.
3. Re-run `/gsd-verify-work 7` on the fix branch to close the loop before Phase 7 is marked fully verified in STATE.md.

---

## Provenance

Scaffolded 2026-04-22 after autonomous execution of plans 07-01 (lifecycle), 07-02 (spin CTA), 07-03 (emoji picker + participant strip). Update in place and commit per scenario (`docs(07-04): UAT results — scenario N PASS`).
