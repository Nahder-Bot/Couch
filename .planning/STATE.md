---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 7 gap-closure COMPLETE — all 4 gap-closure plans (07-05 + 07-06 + 07-07 + 07-08) shipped and deployed to prod. Phase 7 is implementation-complete; consolidated UAT deferred to /gsd-verify-work 7. Phase 8 LIVE on prod UAT pending. Phases 5/6 UAT still partial.
stopped_at: 2026-04-22 -- Phase 7 Plan 8 executed: on-time inference + manual override (Issue #4 closure). Two commits per plan commit_strategy — (1) 3be3575 feat(07-08) default on-time inference: ONTIME_GRACE_MS=60s + effectiveStartFor(participant, wp) 3-case helper (explicit override -> joinedAt<=startAt+grace inference -> startedAt fallback) + computeElapsed (participant, wp) signature update + all 7 call sites migrated to 2-arg form (3173 updateWatchpartyLiveTick, 3196 chip tick, 7553 renderWatchpartyBanner, 7640 renderWatchpartyLive header, 7743 renderReactionsFeed myElapsed, 7787 renderParticipantTimerStrip, 7910 postReaction). NO default for wp — a missed call site becomes an obvious anchor regression, not a silent wrong-anchor. Zero 1-arg stragglers. (2) 28e3622 feat(07-08) manual override UI + persist fn: window.claimStartedOnTime(wpId, opts) in the persist-fn cluster immediately after setReactionDelay — adopts pre-await optimistic shape verbatim (mutate effectiveStartAt + synchronous renderWatchpartyLive() BEFORE await updateDoc), toggleOff opts reverts to null, lastActivityAt:Date.now() on payload. renderParticipantTimerStrip injects contextual control on OWN chip only: "I started on time" button when isLate (joinedAt > startAt + grace) && !hasOverride, "On time ✓" revert badge when hasOverride; nothing otherwise. CSS adds .wp-ontime-claim (subtle underlined text-link) + .wp-ontime-revert (soft accent-tint pill with check) + hover states at lines 717-720. Firebase hosting redeployed — 47 files to queuenight-84044.web.app, release complete. Grep acceptance all PASS: computeElapsed( = 8 hits (1 def + 7 2-arg calls, zero 1-arg stragglers), effectiveStartFor = 2 hits, effectiveStartAt = 5 hits, claimStartedOnTime = 3 hits, ONTIME_GRACE_MS = 3 hits, wp-ontime js = 2 / css = 4. node --check js/app.js OK. UAT (7-sub-check behavioral verification including reaction-delay cross-check) deferred to /gsd-verify-work 7 per project pattern. Phase 7 gap-closure ALL shipped — no more Phase 7 plans queued. Next: /gsd-verify-work 7 rollup (07-05 + 07-06 + 07-07 + 07-08 UAT) or proceed to another phase.
last_updated: "2026-04-22T00:41:32Z"
last_activity: 2026-04-22 -- Phase 7 Plan 8 shipped: commits 3be3575 + 28e3622 on master + hosting deploy successful (on-time inference + manual override, PARTY-03 closure, final gap-closure plan)
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 28
  completed_plans: 22
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phase 7 gap closure COMPLETE — all 4 gap-closure plans (07-05 + 07-06 + 07-07 + 07-08) shipped + deployed to prod. Phase 7 is implementation-complete. Phase 8 deployed UAT pending. Phase 6 partially verified (2/7 PASS). Phase 5 UAT still owed. Phase 9 Redesign remains future work; Phase-9x async-replay seed captured.
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

Phase: 7 (Watchparty) — gap-closure ALL SHIPPED. 07-05 + 07-06 + 07-07 + 07-08 all deployed. Consolidated UAT deferred to /gsd-verify-work 7.
Plan: 8 of 8 (4 original + 4 gap-closure all shipped). Phase 7 implementation COMPLETE.
Status: 2026-04-22 Plan 7-08 executed per plan commit_strategy (two commits). Commit 1 `3be3575` feat(07-08): default on-time inference — passive, no UI, no Firestore write. ONTIME_GRACE_MS=60s + effectiveStartFor(participant, wp) 3-case cascade helper (explicit effectiveStartAt override → joinedAt<=startAt+grace inference → startedAt fallback → null) + computeElapsed signature changed to (participant, wp) + all 7 call sites migrated to 2-arg form (3173, 3196, 7553, 7640, 7743, 7787, 7910). NO default for wp — missed call site becomes obvious anchor regression not silent wrong-anchor. Zero 1-arg stragglers. Commit 2 `28e3622` feat(07-08): manual override UI + persist fn. window.claimStartedOnTime(wpId, opts) placed immediately after setReactionDelay in the persist-fn cluster — adopts 07-06 pre-await optimistic shape verbatim (mutate mine.effectiveStartAt + synchronous renderWatchpartyLive() BEFORE await updateDoc). opts.toggleOff===true reverts to null which cascades back to default inference via effectiveStartFor. lastActivityAt:Date.now() on payload. renderParticipantTimerStrip injects contextual on-time control on OWN chip only: 'I started on time' button when isLate (joinedAt > startAt + grace) && !hasOverride, 'On time ✓' revert badge when hasOverride, nothing otherwise (default inference is invisible by design). CSS adds .wp-ontime-claim (subtle underlined text-link feel) + .wp-ontime-revert (soft accent-tint pill with check) + hover states at css/app.css:717-720. Non-me chips + pre-start / on-time joiners see nothing — default inference is invisible by design. Firebase hosting redeployed — 47 files → queuenight-84044.web.app, release complete. Grep acceptance all PASS: computeElapsed( = 8 hits (1 def + 7 2-arg calls, ZERO 1-arg stragglers — meets "exactly 8" bar), effectiveStartFor = 2 hits, effectiveStartAt = 5 hits, claimStartedOnTime = 3 hits (def + 2 UI onclicks), ONTIME_GRACE_MS = 3 hits, wp-ontime js = 2 / css = 4. node --check js/app.js OK. Control placement decision: own chip only (contextual, visible when actionable) over footer row (would crowd already-full footer). isLate predicate uses joinedAt (RSVP gesture) not startedAt — pre-start joiners without timer are NOT late, they get default inference for free. Mixed-anchor reaction-delay edge case explicitly pre-called in plan risk_notes as out-of-scope follow-up candidate (poster vs viewer anchor mismatch in rare cases — 60s grace means most participants share startAt anchor naturally so mismatch window is narrow). UAT (7-sub-check behavioral incl. reaction-delay cross-check) deferred to /gsd-verify-work 7 per project pattern. Phase 7 gap-closure ALL shipped — no more Phase 7 plans queued.

Phase 6 status: Scenarios 1-2 PASS (flagship iOS push via watchpartyScheduled event + self-echo guard). 5 PENDING (per-event opt-out, quiet hours, invite received, veto cap, Android delivery).

Phase 5 status unchanged: 4 PASS (Google / Email-link / Phone / Sign-out), 7 PENDING hands-on (scenarios 2-4, 6, 8-10), iOS PWA round-trip still owed, Apple + account-linking seeds held as Phase 5.x polish.

Last activity: 2026-04-22 -- Phase 7 Plan 8 executed: commits 3be3575 + 28e3622 on master + hosting deploy (queuenight-84044.web.app, 47 files, release complete). Phase 7 gap-closure COMPLETE.
Resume file: /gsd-verify-work 7 (consolidated 07-05 + 07-06 + 07-07 + 07-08 UAT rollup) OR advance to another phase (Phase 5 UAT, Phase 6 UAT continuation, Phase 8 UAT, Phase 9 redesign planning)
Next action: /clear then /gsd-verify-work 7 (to rollup all 4 gap-closure UAT passes into a single consolidated verification) OR jump to Phase 5/6/8 UAT or Phase 9 planning
Phase 6 UAT resume: .planning/phases/06-push-notifications/06-UAT-RESULTS.md (5 of 7 still PENDING)
Phase 5 UAT resume: .planning/phases/05-auth-groups/05-UAT-RESULTS.md

Progress: [█████████░] 93% of plans (22/28); phase-level: Phases 3-4 complete; 5 impl-complete UAT-partial; 6 deployed UAT-partial; 7 gap-closure ALL SHIPPED (07-05 + 07-06 + 07-07 + 07-08 deployed, consolidated UAT pending via /gsd-verify-work 7); 8 deployed UAT-pending; 9-10 pending

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: ~22min
- Total execution time: ~86min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 3. Mood Tags | 2/2 | ~75min | ~38min |
| 4. Veto System | 3/3 | ~13min | ~4.3min |
| 5. Auth + Groups | 0/? | — | — |
| 6. Push Notifications | 0/? | — | — |
| 7. Watchparty | 0/4 | — | — |
| 8. Watch-Intent Flows | 0/? | — | — |
| 9. Redesign / Brand | 0/? | — | — |
| 10. Year-in-Review | 0/3 | — | — |

**Recent Trend:**

- Last 5 plans: 03-01 (~45min), 03-02 (~30min), 04-01 (~8min), 04-02 (~3min), 04-03 (~2min)
- Trend: Improving further (04-03 single-task surgical diff extension — 1 file, 1 commit, zero deviations, all grep acceptance passed)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Single-file `index.html` architecture preserved through v1 (no modularization).
- TMDB key + Firebase web config stay client-side (public-by-design).
- Product-phase numbering continues from shipped Phases 1-2; v1 roadmap starts at Phase 3.
- Phases 3, 4, 5 are independent; Phase 6 aggregates their data and runs last.
- Outer active-mood chip wrapper is `<div class="mood-chip on">` NOT `<button>` — nested interactive elements break Safari (Pitfall 2 pattern established for all future chip-with-action components).
- innerHTML flicker guard (compare before assign) for DOM containers updated on frequent re-renders.
- ASVS V5 moodById gate pattern for all window functions that accept mood ids via onclick.
- Post-spin veto uses a module-scoped vetoFromSpinResult flag captured BEFORE closeVetoModal() clears it — pattern: always snapshot module flags into locals before the clearing call that ends the flow.
- Auto re-spin does NOT claim spinnership; spinnerId/spinnerAt writes are gated on `!(meta && meta.auto)` in showSpinResult. This is how fairness stays correct after post-spin veto.
- Progressive filter relaxation (mood only for now) is inline per-call — save/clear/recompute/restore state.selectedMoods. Terminal empty-state renders UI-SPEC copy into the existing spin modal container rather than silent early-return.
- Real-time veto toasts use the existing session onSnapshot (not a new listener) with a module-scoped prevVetoKeys Set diff + first-snapshot suppression flag. Both reset inside subscribeSession so midnight re-subscribe starts clean (A3 mitigation). Self-echo guard: v.memberId === (state.me && state.me.id).
- Pre-await optimistic render pattern (Phase 7 Plan 6): for local UI preference toggles (setWpMode hide-reactions), mutate state + call renderXxx() SYNCHRONOUSLY BEFORE awaiting the Firestore write. Distinct from postReaction's post-await echo pattern. Used when instant-feel UX matters and rollback via onSnapshot authoritative overwrite is trivial (single primitive field). 07-07's setReactionDelay adopted the same shape (now confirmed as the canonical pattern for Firestore-backed local UI primitives).
- Optional modeOverride param on renderReactionsFeed (Phase 7 Plan 6): default-undefined semantics preserve existing call-site behavior while specific branches (late-joiner) can force a wallclock render mode orthogonal to the persisted user preference. Avoids conditional branching inside the helper.
- Render-branch narrowing (Phase 7 Plan 6): when a compound condition (!mine || !mine.startedAt) has two semantically distinct render trees (un-joined viewer CTA vs joined-pre-start backlog), split into separate branches rather than weaving conditional sub-blocks. Easier to scope-gate (e.g. preserving the !mine branch VERBATIM while rebuilding !mine.startedAt).
- Viewer-side reaction delay (Phase 7 Plan 7, PARTY-04): "spoiler protection for me" chosen over poster-side delay. Viewer picks their own comfort window independently of others via a 4-preset chip (Off/5s/15s/30s). Implementation is a pure render-filter shift in renderReactionsFeed (delayMs = (mine.reactionDelay||0)*1000 subtracted from myElapsed for non-self reactions). Poster-self bypass via r.memberId === state.me.id — you always see your own reactions immediately regardless of your delay setting. Poster-side delay (if ever wanted as a distinct feature) stacks cleanly on a different dimension.
- Poster-self bypass via r.memberId === state.me.id (Phase 7 Plan 7): canonical attribution predicate for any render-time filter that needs to exempt the poster. memberId is the pinned attribution field written by writeAttribution (js/utils.js:100) and spread into reactions via postReaction. Use verbatim, no grep needed.
- Elapsed-anchor 3-case cascade (Phase 7 Plan 8, Issue #4): effectiveStartFor(participant, wp) resolves the correct elapsed-time anchor via explicit override (effectiveStartAt) → default on-time inference (joinedAt within 60s grace of startAt → anchor to startAt) → startedAt fallback → null. Passive by design — zero Firestore writes for the common case; only the manual override branch writes. Sports + movie watchparties benefit identically (kickoff/scheduled-start both = wp.startAt). Future elapsed-anchor tweaks (different grace per wp type, host-broadcast anchor, etc.) layer into the same helper without touching call sites.
- No-default cascading signature change (Phase 7 Plan 8): when a function signature gains a new required parameter used across many call sites (computeElapsed: 1-arg → 2-arg, 7 call sites), deliberately OMIT a default value. Missed call sites become obvious regressions (elapsed=0 silently) rather than silent-wrong-anchor. Post-edit grep enumerating all sites in 2-arg form is the enforcement.
- Contextual per-user chip control (Phase 7 Plan 8): inject affordance into renderParticipantTimerStrip's per-chip map body, gated on (isMe && state predicate). Generalizes for any future "only-my-chip" affordance (mute self, per-user color, etc.). Invisible when irrelevant — non-me chips + pre-start joiners with passive inference see nothing.
- Pre-await optimistic canonical (3rd adoption, Phase 7 Plan 8): setWpMode (07-06) + setReactionDelay (07-07) + claimStartedOnTime (07-08) all use the same shape — mutate local state + synchronous renderWatchpartyLive() BEFORE await updateDoc. Rollback via onSnapshot authoritative overwrite. Reserved for local UI preference toggles on Firestore-backed single-primitive fields. Post-await echo (postReaction) remains reserved for semantically-server operations.

### Pending Todos

None.

### Blockers/Concerns

None.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-22T00:41:32Z
Stopped at: Phase 7 Plan 8 complete — on-time inference + manual override (Issue #4, PARTY-03 closure) shipped as TWO cohesive commits per plan commit_strategy. Commit 1 `3be3575` feat(07-08): default on-time inference (passive, no UI) — ONTIME_GRACE_MS=60s constant + effectiveStartFor(participant, wp) 3-case cascade helper (override → inference → fallback → null) at js/app.js:~1739-1775 + computeElapsed signature (participant, wp) + all 7 call sites migrated to 2-arg form at js/app.js:3173, 3196, 7553, 7640, 7743, 7787, 7910 (ZERO 1-arg stragglers — meets plan's "exactly 8" bar). NO default for wp — missed call site becomes obvious regression. Commit 2 `28e3622` feat(07-08): manual override UI + persist fn — window.claimStartedOnTime(wpId, opts) at js/app.js:~8029 in persist-fn cluster immediately after setReactionDelay (cluster order: setWpMode → toggleWpPause → setWpMode (07-06 mode) → setReactionDelay (07-07) → claimStartedOnTime (07-08) → leaveWatchparty). Pre-await optimistic shape (3rd adoption of 07-06 pattern). toggleOff opts reverts effectiveStartAt to null which cascades back to default inference. renderParticipantTimerStrip at js/app.js:~7790-7810 injects contextual on-time control on OWN chip only: "I started on time" button when isLate (joinedAt > startAt + grace) && !hasOverride, "On time ✓" revert badge when hasOverride, nothing otherwise. Non-me + pre-start + on-time joiners see nothing (default inference invisible). CSS adds .wp-ontime-claim + :hover + .wp-ontime-revert + :hover at css/app.css:717-720 — secondary affordance styling (subtle, does not compete with .wp-control-btn primary weight). Firebase hosting redeployed (queuenight-84044.web.app, 47 files, release complete). Grep acceptance all PASS: computeElapsed( = 8 hits (1 def + 7 2-arg calls), effectiveStartFor = 2, effectiveStartAt = 5, claimStartedOnTime = 3 (def + 2 UI onclicks), ONTIME_GRACE_MS = 3, wp-ontime js = 2 / css = 4. node --check js/app.js OK. Mixed-anchor reaction-delay edge case pre-called in plan risk_notes as out-of-scope follow-up (poster vs viewer anchor mismatch in rare cases — 60s grace means most participants share startAt naturally so mismatch window is narrow). UAT (7-sub-check behavioral incl. reaction-delay cross-check) deferred to /gsd-verify-work 7. Phase 7 gap-closure COMPLETE — no more Phase 7 plans queued.
Resume file: /gsd-verify-work 7 (consolidated 07-05 + 07-06 + 07-07 + 07-08 UAT rollup) OR advance to another phase
