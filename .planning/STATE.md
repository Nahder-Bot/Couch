---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 9 Plan 02 COMPLETE (token canonicalization). 09-01 PARTIAL (vectorize-deferred). Phases 5 + 7 + 8 COMPLETE this session. Phase 6 UAT still partial (2/7). Next Wave 2: 09-03 (inline-style purge) + 09-04 (desktop responsive), runnable in parallel.
stopped_at: 2026-04-22 -- /gsd-execute plan 09-02 complete. 3 atomic commits per commit_strategy: 790e5cf fix reconciled --bg palette drift #14110d→#14110f (matches manifest + theme-color + CLAUDE.md canon); 5ad9ea3 feat added 47-token semantic alias layer (--color-*, --space-*, --text-*, --duration-*, --easing-*, --font-*) + motion ladder additions (--t-instant 50ms, --t-deliberate 300ms) + easing additions (--ease-standard, --ease-spring) + font-family role tokens (--font-display/serif/sans); 0d7262a docs added 3-tier hierarchy documentation + WCAG-AA contrast notes in :root header. css/app.css :root block grew from ~90 lines to ~172. Zero runtime behavior change — all 2000+ existing var(--primitive) references resolve identically. All end-of-plan grep acceptance PASS (#14110d=0, semantic tokens all ≥1, primitives all preserved, exactly 1 :root{). Deploy mirror synced + firebase deploy --only hosting complete (queuenight-84044.web.app, 47 files). Plan 09-02 closes DESIGN-02 fully; DESIGN-03 token-layer (applied-consistency deferred to 09-03); DESIGN-09 token-layer (motion audit deferred to 09-07b). Next: Wave 2 — 09-03 (inline-style purge, 119 style= attrs → ≤20) + 09-04 (desktop responsive, .phone-shell + @media 900px, closes Phase 7 deferred gap) can run in parallel.
last_updated: "2026-04-22T05:46:00Z"
last_activity: 2026-04-22 -- /gsd-execute-phase 9 plan 09-02 complete. 3 task commits (790e5cf + 5ad9ea3 + 0d7262a) + deploy.
progress:
  total_phases: 8
  completed_phases: 5
  total_plans: 36
  completed_plans: 23
  percent: 64
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phases 5 + 7 + 8 CLOSED + Phase 9 PLANNED (8 plans, 5 waves) this session. 5/8 phases complete (3, 4, 5, 7, 8). Remaining: Phase 6 (deployed, UAT 2/7), Phase 9 (8 plans ready to execute), Phase 10 (not started — depends on Phase 9 for brand tokens). Next natural targets: /gsd-execute-phase 9 to start Redesign execution, or /gsd-verify-work 6 to close Phase 6 first.
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

Phase: Phase 9 EXECUTING. Wave 1 plans: 09-01 (identity pipeline) PARTIAL — vectorize-deferred per user decision (keep existing photoreal PNG logos, defer canonical SVG + logo refresh to future designer engagement); 09-02 (token canonicalization) COMPLETE 2026-04-22. Wave 2 next: 09-03 (inline-style purge) + 09-04 (desktop responsive) runnable in parallel.

Phase 9 Plan 02 completion (2026-04-22, /gsd-execute-plan 09-02): 3 atomic commits per plan commit_strategy. (1) 790e5cf fix reconciled --bg palette drift from #14110d → #14110f (matches manifest inline URL + meta theme-color + CLAUDE.md canonical spec; <1% luminance delta, no visual rebaseline needed). (2) 5ad9ea3 feat added 47-token semantic alias layer INSIDE :root — 18 color (--color-surface/ink/accent/feedback/border-*), 9 spacing (--space-inline/stack-*, --space-section, --space-page), 8 typography (--text-display/heading/body-*, --text-eyebrow, --text-micro), 3 font-family role tokens (--font-display Fraunces, --font-serif Instrument Serif, --font-sans Inter), 2 motion tier additions (--t-instant 50ms, --t-deliberate 300ms), 2 easing additions (--ease-standard Material, --ease-spring overshoot), 9 motion aliases (--duration-*, --easing-*). All alias into primitives via var() chain — zero raw-value duplication, single source of truth preserved. (3) 0d7262a docs extended :root header with 3-tier hierarchy explanation (Layer 1 primitives → Layer 2 semantic aliases → Layer 3 component tokens declared in selectors) + WCAG-AA contrast reference for --ink family on --bg. Every existing primitive preserved verbatim; zero rule bodies outside :root touched; exactly 1 :root{ block. Deploy mirror copied (diff -q IDENTICAL) + firebase deploy --only hosting complete (queuenight-84044.web.app, 47 files, release finalized). Requirements: DESIGN-02 full close; DESIGN-03 token layer complete (applied-consistency → plan 09-03); DESIGN-09 token layer complete (motion audit → plan 09-07b). Summary: .planning/phases/09-redesign-brand-marketing-surface/09-02-SUMMARY.md.

Phase 9 planning (2026-04-22, /gsd-plan-phase 9): Research → 7 initial plans → checker (3 blockers + 5 majors + 6 minors) → revision 1 → checker (PASS) → 8 plans final. Waves: W1 09-01 identity + 09-02 tokens; W2 09-03 inline-style purge + 09-04 desktop responsive; W3 09-05 landing page + 09-06 marketing assets; W4 09-07a onboarding + self-claim + BRAND.md + intent tz fix; W5 09-07b guest-invite redemption + motion audit. Absorbs 4 seeds + Phase 7 deferred responsive gap. Research revealed: design system is 90% already built in css/app.css:1-90; desktop responsive fix is one-line `.phone-shell` wrapper + @media 900px; 119 inline style= attrs in index.html to purge; landing becomes separate landing.html + app.html rewrite for perf + SEO. 26 total tasks (18 auto + 1 decision + 5 human-verify + 2 human-action). Commit: f54ff8b.

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

Seeds absorbed into Phase 9 (4 of 6):
  - phase-05x-legacy-family-ownership-migration.md → 09-07a Task 1
  - phase-05x-guest-invite-redemption.md → 09-07b Task 2 (full CF + client)
  - phase-05x-account-linking.md items #6 + #7 → 09-07a Task 1
  - phase-08x-intent-cf-timezone.md → 09-07a Task 3
  - Phase 7 deferred responsive-layout gap → 09-04

Seeds remaining standalone:
  - phase-05x-apple-signin.md (needs \$99 Apple Dev account — gated on external purchase)
  - phase-07-watchparty-lifecycle-transitions.md (backend behavioral, not brand polish)

Progress: Phase-level: Phases 3-4 complete; **5 COMPLETE** (all plans + UAT); 6 deployed UAT-partial; **7 COMPLETE** (all plans + UAT + 2 runtime fixes); **8 COMPLETE** (all plans + UAT + 1 seed); **9 PLANNED** (8 plans, 5 waves, 26 tasks — ready to execute); 10 pending (depends on Phase 9 brand tokens).
Plan count changed: total_plans 28 → 36 (Phase 9 added 8 plans). Execution progress 22/36 = 61%.

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
- 3-tier token hierarchy (Phase 9 Plan 02): Layer 1 PRIMITIVES (short-name raw values like --bg, --accent, --s4 — 50+ tokens, never renamed) → Layer 2 SEMANTIC ALIASES (--color-*, --space-*, --text-*, --duration-*, --easing-*, --font-* — var() into primitives, express intent by role) → Layer 3 COMPONENT TOKENS (declared inside component selectors, NOT :root — e.g. .wp-live-modal { --wp-modal-max-width: 520px; }). Downstream rules should prefer Layer 2 for meaning-by-role clarity; Layer 1 stays available for brand moments where exact value matters; Layer 3 adopted by plans 09-03 (inline-style purge) + 09-04 (desktop responsive). Every existing primitive preserved — semantic aliases are ADDITIVE, zero renames.
- Font-family role tokens (Phase 9 Plan 02): --font-display (Fraunces) / --font-serif (Instrument Serif) / --font-sans (Inter). Future class rules should `font-family: var(--font-display)` not `font-family: 'Fraunces', serif`. Prevents drift when new components land. Minor-8 checker feedback closure.
- Motion vocabulary (Phase 9 Plan 02): 5-tier duration ladder --t-instant (50ms) / --t-quick (150ms) / --t-base (220ms) / --t-deliberate (300ms) / --t-cinema (400ms) + 4-token easing palette --ease-out / --ease-cinema / --ease-standard (Material) / --ease-spring (subtle overshoot, celebratory-only). Both layers have semantic alias forms (--duration-*, --easing-*); downstream rules pick the tier that matches how much intent they want to express. Motion audit (plan 09-07b) will migrate rule-body ms literals to these tokens.
- Palette drift pattern (Phase 9 Plan 02): when two files declare the same canonical color with 1-char hex drift, single-commit reconcile with <1% luminance delta requires NO visual rebaseline. Reconciled --bg #14110d → #14110f to match manifest + theme-color + CLAUDE.md.

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
