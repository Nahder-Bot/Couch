---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 5 executing — 05-08 deployed + phone-input fix deployed. 05-09 in progress; UAT-RESULTS.md partial (4 PASS, 7 PENDING hands-on, 1 DEFERRED to Phase 9).
stopped_at: 2026-04-21 -- Production deploy complete. Functions mintClaimTokens + claimMember (with graduatedAt) live on queuenight-84044. Hosting deployed to couchtonight.app (47 files, includes phone-input fix b3a0ca3). Couch repo clean at b7f2ab0. Phase 5 now blocked only on hands-on UAT for scenarios 2, 3, 4, 6, 8, 9, 10 + iOS standalone PWA verification.
last_updated: "2026-04-21T12:00:00.000Z"
last_activity: 2026-04-21 -- 05-09 deploy pass: phone-input fix + CF refresh + hosting deploy to prod (commits b3a0ca3, d85d6f5, b7f2ab0)
progress:
  total_phases: 8
  completed_phases: 2
  total_plans: 14
  completed_plans: 7
  percent: 50
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phase 5 — Auth + Groups (next up, after roadmap restructure)
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

Phase: 5 (Auth + Groups) — EXECUTING (9 plans, 7 waves)
Plan: 9 of 9 (05-08 deployed; 05-09 in-progress — partial UAT + full prod deploy)
Status: Prod deploy complete on 2026-04-21. Functions mintClaimTokens + claimMember (with graduatedAt) deployed to queuenight-84044 (v2 callable, nodejs22). Hosting deployed to couchtonight.app with phone-input validation fix (commit b3a0ca3 — strip spaces/dashes/parens, auto-+1 for bare 10-digit US numbers). UAT-RESULTS.md current: Google/Email-link/Phone-SMS/Sign-out PASS; Apple DEFERRED to Phase 9; scenarios 2 (sub-profile act-as), 3 (password join), 4 (guest invite), 6 (Sports Watchparty), 8 (migration claim), 9 (graduation), 10 (grace cutoff) PENDING hands-on. iOS standalone PWA round-trip also still owed (single-provider Google is sufficient minimum per RESEARCH §9).
Last activity: 2026-04-21 -- 05-09 deploy pass: phone fix + CF refresh + hosting (3 commits: b3a0ca3, d85d6f5, b7f2ab0)
Resume file: .planning/phases/05-auth-groups/05-09-PLAN.md
Resume UAT from: .planning/phases/05-auth-groups/05-UAT-RESULTS.md

Progress: [█████░░░░░] 50% (Phases 3-4 complete; 05-01..05-08 complete; 05-09 pending; Phases 6-10 pending)

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

### Pending Todos

None.

### Blockers/Concerns

None.

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-21T00:00:00.000Z
Stopped at: 05-08 complete — migration claim panel + claim-confirm screen + sub-profile graduation (D-16 graduatedAt) + post-grace read-only enforcement (D-15 banner + body.is-readonly + guardReadOnlyWrite). Commit cc077ed local; mintClaimTokens CF + claimMember graduatedAt extension authored in queuenight/functions/ (not couch-repo tracked). Orchestrator to: firebase deploy --only functions:mintClaimTokens, then deploy claimMember redeploy, then sync client to queuenight/public/ + firebase deploy --only hosting.
Resume file: .planning/phases/05-auth-groups/05-09-PLAN.md
