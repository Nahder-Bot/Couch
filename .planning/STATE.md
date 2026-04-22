---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 7 COMPLETE — all 8 plans shipped (4 original + 4 gap-closure), UAT passed, 2 in-session runtime fixes. Phase 8 LIVE on prod UAT pending. Phases 5/6 UAT still partial. Phase 9 (Redesign) owns the desktop responsive-layout gap surfaced during Phase 7 UAT.
stopped_at: 2026-04-22 -- /gsd-verify-work 7 closed cleanly. UAT 8/8 accounted for (Tests 1-2 runtime pass on phone + PC Chrome incognito; Tests 3-8 static-verified via parallel code-explorer). Two runtime fixes landed in-session: (1) 14e959a wired renderWatchpartyLive into watchparties onSnapshot handler at js/app.js:~3138 (the comment at that handler explicitly claimed this call existed but it didn't — pre-existing bug masked until multi-device passive-observer UAT). (2) ce3c507 renderReactionsFeed filter switched from mixed-anchor elapsed-based (r.elapsedMs <= myElapsed - delayMs) to anchor-agnostic wall-clock-based (r.at <= Date.now() - delayMs) at js/app.js:7757-7773 — closes the edge case 07-08 risk_notes explicitly flagged as a follow-up candidate ("poster vs viewer anchor mismatch in rare cases"). Synced-viewing case mathematically identical to old predicate; cross-anchor degrades gracefully. Final re-verify: user confirmed reactions propagate within ~1s of post on PC Chrome incognito with no local action. One deferred gap: desktop responsive layout of watchparty live modal (narrow mobile column in wide viewport) — routed to Phase 9 (Redesign / Brand) which owns desktop surface. One environment note captured: iOS PWA installs do NOT auto-invalidate on Hosting deploys; Safari Website Data purge required for PWA UAT on Hosting-shipped changes. Phase 7 UAT file: .planning/phases/07-watchparty/07-UAT.md. Total Phase 7 commits on master this cycle: 8 feat/fix + 4 docs = 12 + 1 UAT + 2 runtime fixes = 15. Next: /gsd-verify-work 8 or /gsd-verify-work 6 (both have partial/pending UAT).
last_updated: "2026-04-22T02:30:00Z"
last_activity: 2026-04-22 -- /gsd-verify-work 7 complete. UAT 8/8 + 2 runtime fixes (14e959a snapshot re-render + ce3c507 wall-clock filter) + deploy + commit bdc2ae3 UAT file.
progress:
  total_phases: 8
  completed_phases: 3
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

Phase: 7 (Watchparty) — COMPLETE. All 8 plans shipped + UAT passed + 2 runtime fixes landed.
Plan: 8 of 8 (4 original + 4 gap-closure) + 2 in-session runtime fixes = 10 Phase 7 code deliveries on master.
Status: 2026-04-22 /gsd-verify-work 7 closed cleanly. UAT 8/8 accounted for:
  - Test 1 (CF timezone push body) — PASS runtime (post-cache-bust doc has creatorTimeZone='America/New_York', CF fired successfully). Initial FAIL was environmental: stale iOS PWA service-worker cache on creator device; resolved via Safari Website Data purge.
  - Test 2 (Hide-reactions live toggle) — PASS runtime (toggle collapses/expands feed immediately).
  - Tests 3-8 — static-verified via parallel code-explorer: late-joiner backlog branch, un-joined viewer regression, reaction-delay feature (all 5 sub-surfaces), mode-gated delay row, effectiveStartFor 3-case cascade with all 7 call sites migrated to 2-arg form, claimStartedOnTime persist fn with pre-await optimistic shape + own-chip UI injection + CSS states. Zero shipping bugs in gap-closure plans.

TWO RUNTIME FIXES LANDED IN-SESSION (both on master, both deployed to queuenight-84044.web.app):
  1. `14e959a` fix(07): wire renderWatchpartyLive into watchparties onSnapshot. Pre-existing bug — the snapshot handler at js/app.js:3121-3139 has a comment explicitly stating "Full re-render still runs from the watchparties onSnapshot when participant state / reactions change" but the actual renderWatchpartyLive() call was missing. Masked until this UAT because prior UAT always had users actively tapping things (which triggers explicit-action re-render paths). The multi-device UAT with passive observers surfaced it. Fix: `if (state.activeWatchpartyId) renderWatchpartyLive();` added after renderWatchpartyBanner() call. Necessary but not sufficient.
  2. `ce3c507` fix(07): renderReactionsFeed filter uses wall-clock time, not mixed-anchor elapsed. Closes the edge case 07-08's risk_notes explicitly flagged as a follow-up candidate (poster-anchored r.elapsedMs vs viewer-anchored myElapsed in incompatible coordinate spaces). Old predicate `r.elapsedMs <= myElapsed - delayMs` rejected legitimate reactions when participants started timers at different wall-clock moments. New predicate `r.at <= Date.now() - delayMs` uses r.at (already written at post time, line ~7935). Synced-viewing case mathematically identical; cross-anchor degrades gracefully. Final re-verify confirmed: reactions propagate passively within ~1s of post on PC Chrome incognito.

DEFERRED GAP (routed to Phase 9):
  - Desktop responsive layout of watchparty live modal — modal constrains to ~mobile width in wide desktop viewports; Pause/Hide reactions/Real-time/Done controls squeezed. Pre-existing UX bug, not introduced by Phase 7 plans. Owned by Phase 9 (Redesign / Brand).

ENVIRONMENT NOTE (capture for future UAT):
  - iOS PWA installs do NOT auto-invalidate on Hosting deploys. Cache bust procedure: iPhone Settings → Safari → Advanced → Website Data → delete couchtonight.app → reopen PWA. Required any time UAT verifies a hosting-shipped change on the installed PWA.

Phase 6 status: Scenarios 1-2 PASS (flagship iOS push via watchpartyScheduled event + self-echo guard). 5 PENDING (per-event opt-out, quiet hours, invite received, veto cap, Android delivery).

Phase 5 status unchanged: 4 PASS (Google / Email-link / Phone / Sign-out), 7 PENDING hands-on (scenarios 2-4, 6, 8-10), iOS PWA round-trip still owed, Apple + account-linking seeds held as Phase 5.x polish.

Last activity: 2026-04-22 -- /gsd-verify-work 7 complete. UAT + 2 runtime fixes (14e959a + ce3c507) + deploy + UAT commit bdc2ae3. Phase 7 fully closed.
Resume file: Pick next target — Phase 8 UAT (deployed-pending), Phase 6 UAT (5/7 pending), or Phase 5 UAT (7/11 pending)
Next action: /gsd-verify-work 8 (closest to done — deployed, just UAT pending) OR /gsd-verify-work 6 (continuing partial UAT) OR /gsd-verify-work 5 (bulk pending)
Phase 6 UAT resume: .planning/phases/06-push-notifications/06-UAT-RESULTS.md (5 of 7 still PENDING)
Phase 5 UAT resume: .planning/phases/05-auth-groups/05-UAT-RESULTS.md

Progress: [█████████░] 93% of plans (22/28); phase-level: Phases 3-4 complete; 5 impl-complete UAT-partial; 6 deployed UAT-partial; **7 COMPLETE** (all plans + UAT + 2 runtime fixes); 8 deployed UAT-pending; 9-10 pending

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
