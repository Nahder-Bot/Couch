---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phases 5 + 7 + 8 COMPLETE this session (3 closures back-to-back). Phase 6 UAT still partial (2/7). Phase 9 (Redesign) owns the desktop responsive-layout gap surfaced during Phase 7 UAT + Phase 5/7/8 polish items.
stopped_at: 2026-04-22 -- Three UAT cycles completed this session. /gsd-verify-work 7: 8/8, 2 runtime fixes shipped (14e959a snapshot re-render + ce3c507 wall-clock filter). /gsd-verify-work 5: 8/8, 0 code bugs, environmental repair for legacy-family ownerUid, 3 seeds captured. /gsd-verify-work 8: 7/7 via browser-Claude autonomous automation — 4 runtime PASS (Tests 1-create, 2-create+cancel, 3 RSVP change, 4 pref toggle write, 5 cancel) + 3 static-verified (Tests 6 expiry CF, 7 majority math + 1/2 convert paths). 0 feature-code bugs. 1 incidental gap seeded: onIntentCreated CF renders proposedStartAt without timeZone option (same class as Phase 7 Plan 05 bug but on intent-creation path — phase-08x-intent-cf-timezone.md). Browser-Claude drove the full Chrome flow: openProposeIntent, confirmProposeIntent, RSVP modal clicks, checkbox toggle of users/{uid}.notificationPrefs.intentProposed, cancel button invoke. Match + convert runtime flows not testable solo (7-member family majority rule needs 4 authed Yes RSVPs; setIntentRsvp keys by state.me.id so act-as doesn't help by design). Phase 8 closes code-complete with runtime coverage for all single-user paths. Next: /gsd-verify-work 6 (5/7 push-notification scenarios still pending) or /gsd-plan-phase 9 (Redesign — owns multiple deferred polish items now).
last_updated: "2026-04-22T04:05:00Z"
last_activity: 2026-04-22 -- /gsd-verify-work 8 complete. UAT + seed commit c34776e + Phase 8 marked COMPLETE in ROADMAP.
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 28
  completed_plans: 22
  percent: 93
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phases 5 + 7 + 8 all CLOSED this session (3 phase closures in a row). 5/8 phases complete (3, 4, 5, 7, 8). Remaining: Phase 6 (deployed, UAT 2/7), Phase 9 (not started — Redesign, owns all deferred polish items), Phase 10 (not started — YIR). Next natural targets: /gsd-verify-work 6 to close Phase 6 or /gsd-plan-phase 9 to kick off Redesign.
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

Phase: 5 + 7 + 8 all COMPLETE this session (three phase closures in a row). Next up: Phase 6 (UAT 5/7 pending) or Phase 9 (not started — Redesign, absorbs 7+ deferred polish items accumulated this session).

Phase 8 closure (2026-04-22, /gsd-verify-work 8): UAT 7/7 accounted for via browser-Claude autonomous Chrome automation. 4 runtime PASS (Tests 1/2 create + cancel paths, Test 3 RSVP live-sync, Test 4 pref toggle persistence, Test 5 creator cancel) + 3 static-verified (Test 6 expiry CF logic trivial, Test 7 majority-rule ceil(n/2) math + family→majority binding, plus match+convert paths on 1/2). Zero feature-code bugs. 1 incidental gap seeded: onIntentCreated CF renders proposedStartAt via toLocaleTimeString without timeZone option — same class as Phase 7 Plan 05 bug (which we fixed for watchparty pushes) but on the intent-creation path. Seed: .planning/seeds/phase-08x-intent-cf-timezone.md. Match + convert runtime flows not testable solo: 7-member family majority rule needs 4 authenticated Yes RSVPs; setIntentRsvp keys by state.me.id directly so act-as sub-profile workaround doesn't help (by product design — intents are real-member polls, sub-profiles don't vote).


Phase 5 closure (2026-04-22, /gsd-verify-work 5): UAT 8/8 accounted for. 1 runtime PASS (sub-profile act-as + per-action revert), 4 static-verified via parallel Explore agent (Sports WP writeAttribution regression — all 17 wp write sites spread writeAttribution; migration claim AUTH-04 — mintClaimTokens + claimMember CFs + showClaimConfirmScreen client path all wired; graduation D-16 — mintClaimTokens type='graduation' + claimMember branch clears managedBy + stamps graduatedAt atomically; grace-window cutoff — isReadOnlyForMember + applyReadOnlyState + guardReadOnlyWrite integrated into 10+ write paths + firestore.rules validAttribution + legacyGraceWrite branches + CSS is-readonly dimming), 1 blocked (password-protected join — no 2nd Google account), 1 fail_scope_deferred (guest invite redeem — Plan 05-08 line 139 explicitly preserved showInviteRedeemScreen as stub; seed captured at .planning/seeds/phase-05x-guest-invite-redemption.md), 1 skipped (iOS standalone PWA — user declined physical-device test, previously-owed per 05-UAT-RESULTS.md). Zero code bugs found in Phase 5 plans.

Environmental repair during Phase 5 UAT: families/ZFAM7 legacy doc created 2026-04-08 (pre-Phase-5) had NO ownerUid field; js/app.js:2557 renderOwnerSettings check state.auth.uid===state.ownerUid evaluated undefined; Group admin section was hidden. Client-side updateDoc rules-denied (catch-22 for legacy docs without ownerUid). Repaired via Firebase Console write stamping ownerUid='jpTjwFzWiHaOalIr6OkD81p9ngn2'. Seeded proper fix (client-side self-claim CTA + rules branch) at .planning/seeds/phase-05x-legacy-family-ownership-migration.md. Incidental finding: a second family FILMCLUB exists in prod; may also lack ownerUid — seed's scope may be >1 family.

Informal Phase 5 feedback captured as seed items (.planning/seeds/phase-05x-account-linking.md): (6) "Set a password for faster sign-in" — email-link upgrade to email+password via updatePassword() so returning users can skip the magic-link dance on new devices. (7) "Sign in vs Create account" UX split on the landing screen — pure microcopy/layout polish; current flow feels like re-creating an account each visit.

Phase 7 closure (2026-04-22, /gsd-verify-work 7): UAT 8/8 accounted for. Tests 1-2 runtime PASS on phone + PC Chrome incognito; Tests 3-8 static-verified via parallel code-explorer. Two runtime fixes landed in-session, both on master + deployed to queuenight-84044.web.app:
  1. `14e959a` fix(07): wire renderWatchpartyLive into watchparties onSnapshot. Pre-existing bug — handler at js/app.js:3121-3139 had comment claiming the full re-render ran from snapshot but the call was missing. Masked until multi-device passive-observer UAT.
  2. `ce3c507` fix(07): renderReactionsFeed filter uses wall-clock time, not mixed-anchor elapsed. Closes the edge case 07-08 risk_notes flagged as follow-up candidate (poster-anchored r.elapsedMs vs viewer-anchored myElapsed incompatibility). New predicate `r.at <= Date.now() - delayMs` uses r.at (already written at post time). Synced-viewing case mathematically identical; cross-anchor degrades gracefully.

DEFERRED GAP (routed to Phase 9): Desktop responsive layout of watchparty live modal — constrains to ~mobile width in wide desktop viewports. Pre-existing, owned by Phase 9 (Redesign / Brand).

ENVIRONMENT NOTE (reusable across future UAT): iOS PWA installs do NOT auto-invalidate on Hosting deploys. Cache bust procedure: iPhone Settings → Safari → Advanced → Website Data → delete couchtonight.app → reopen PWA. Incognito/Private browsing bypasses SW entirely (faster for desktop verification).

Phase 6 status: Scenarios 1-2 PASS (flagship iOS push via watchpartyScheduled event + self-echo guard). 5 PENDING (per-event opt-out, quiet hours, invite received, veto cap, Android delivery).

Last activity: 2026-04-22 -- /gsd-verify-work 8 complete via browser-Claude autonomous Chrome automation. UAT + seed commit c34776e + Phase 8 marked COMPLETE in ROADMAP.
Resume file: Pick next target — Phase 6 UAT (5/7 still pending) OR Phase 9 planning (fresh start — Redesign + polish-absorption).
Next action: /gsd-verify-work 6 (continuing partial UAT) OR /gsd-plan-phase 9 (start Redesign — large phase; absorbs multiple deferred items: Phase 7 desktop responsive-layout gap, Phase 5's account-linking/sign-in-UX polish items, Phase 5's legacy family-ownership seed, Phase 5's guest-invite redemption seed, Phase 8's CF timezone seed).
Phase 6 UAT resume: .planning/phases/06-push-notifications/06-UAT-RESULTS.md (5 of 7 still PENDING)
Phase 8 UAT file: .planning/phases/08-intent-flows/08-UAT.md (closed)
Phase 5 UAT file: .planning/phases/05-auth-groups/05-UAT.md (closed); 05-UAT-RESULTS.md (prior state preserved)

Active seeds accumulated this session:
  - phase-05x-legacy-family-ownership-migration.md (self-claim CTA for pre-Phase-5 family docs)
  - phase-05x-guest-invite-redemption.md (ship consumeGuestInvite CF + showInviteRedeemScreen)
  - phase-05x-account-linking.md (expanded with #6 set-password-for-resign-in + #7 sign-in-vs-create-account UX split)
  - phase-08x-intent-cf-timezone.md (onIntentCreated CF timezone echo of 07-05 fix)
  - Phase 9 responsive-layout gap (watchparty live modal desktop viewport) — tracked in Phase 7 UAT, routed to Phase 9

Progress: [█████████░] 93% of plans (22/28); phase-level: Phases 3-4 complete; **5 COMPLETE** (all plans + UAT + 3 seeds); 6 deployed UAT-partial; **7 COMPLETE** (all plans + UAT + 2 runtime fixes); **8 COMPLETE** (all plans + UAT + 1 seed); 9-10 pending

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
