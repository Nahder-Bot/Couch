---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 14 IN PROGRESS — 5/9 plans complete (14-01 + 14-02 + 14-03 + 14-06 + 14-08)
stopped_at: "Phase 14 Plan 08 (Flow B — solo-nominate + invite + counter-time, D-08 / DECI-14-08) SHIPPED 2026-04-26. Couch repo: 1 commit (af168f1) adding Flow B's full client surface to js/app.js + css/app.css — openFlowBNominate UI (tile action sheet entry + datetime-local time picker + 200-char note + createIntent({flow:'nominate', ...}) submit), recipient response screen (Join @ proposed / Counter-suggest / Decline; counter writes rsvps[me]={state:'maybe',counterTime,note} + atomic counterChainDepth bump capped at 3), nominator status screen (live tally + T-15 auto-convert indicator + all-No banner with cancelReason='all-no' + counter rows with Accept/Reject/Compromise actions), maybeRerenderFlowBStatus() wired into state.unsubIntents tick, and ?intent= deep-link handler routing creator → status screen / recipient → response screen with defensive typeof guard so 14-08 lands cleanly before 14-07. CF side already shipped in 14-06 (onIntentCreated flowBNominate push, onIntentUpdate flowBCounterTime push, watchpartyTick T-15 auto-convert + T-30 hard-expire warning). One auto-fix Rule 2 deviation: added .tc-secondary CSS class to css/app.css (existing .tc-primary at css/app.css:1403 had no design-system partner). Task 5 multi-device UAT DEFERRED via the plan's explicit `skip-uat` resume signal — same pattern as 14-02 — multi-device + push UAT batched as a single pre-v34-production-deploy verification pass; recap captured in 14-08-SUMMARY.md (nominate flow / push delivery / counter-time / nominator decision / T-15 auto-convert / all-No edge / deep-link routing). UAT remains valid and MUST run before Phase 14 ships to v34 production deploy (tracked in Open follow-ups below). Cross-plan dependency: Plan 14-09 must ship the 7 push category prefs (DR-3) before user pref toggles take effect; until then Flow B pushes (flowBNominate / flowBCounterTime / flowBConvert / intentExpiring) default-ON via fallback at queuenight/functions/index.js:114-115 (defaultOn=true when hasDefault=false). Remaining Phase 14 plans: W1 (14-04 SVG couch viz, 14-05 tile redesign) → W3 (14-07 Flow A — unblocked since 14-03 done) → W4 (14-09 onboarding+empty+push+CACHE). DEPLOY ORDER REMINDER (when v34 ships): deploy CFs from ~/queuenight FIRST, then bash scripts/deploy.sh from couch repo. PRIOR: 14-02 Task 3 iOS Safari touch-DnD UAT still DEFERRED to batch UAT pass (must run before v34 production deploy; Sortable.js fallback documented). PRIOR (14-06): queuenight CF edits to onIntentCreated/onIntentUpdate/watchpartyTick uncommitted (queuenight has no .git on this machine — see 14-06-SUMMARY.md deviation 1); 7 new eventTypes wired but pending NOTIFICATION_DEFAULTS/DEFAULT_NOTIFICATION_PREFS/NOTIFICATION_EVENT_LABELS additions in 14-09. ORIGINAL stopped_at (14-03) preserved for reference: Phase 14 Plan 03 (tier aggregators T1/T2/T3 + T3 visibility resolver, D-02 / DECI-14-02) SHIPPED 2026-04-26. Couch repo: 1 commit (ccf600f) adding 4 pure functions getTierOneRanked / getTierTwoRanked / getTierThreeRanked / resolveT3Visibility immediately after getGroupNext3 at js/app.js:7006-7106 (+102 lines, plan minimum was 80). All 3 tier aggregators consume isWatchedByCouch (14-01) before classifying so already-watched titles never leak into any tier. T1 = intersection across couch. T2 = strict T1 complement within any-couch-presence. T3 = zero couch overlap + >=1 off-couch. resolveT3Visibility = explicit-false-wins across state.me/family/group.preferences.showT3 (privacy-leaning default-show). UI consumer is 14-07 (Flow A picker) which must call resolveT3Visibility() to gate T3 expand affordance per D-02 privacy posture."
last_updated: "2026-04-26T05:00:00.000Z"
last_activity: 2026-04-26 -- Phase 14 Plan 08 SHIPPED (D-08 Flow B solo-nominate + counter-time + auto-convert + all-No edge; Tasks 1-4 in commit af168f1; Task 5 multi-device UAT deferred to pre-v34 batch UAT)
progress:
  total_phases: 11
  completed_phases: 4
  total_plans: 67
  completed_plans: 39
  percent: 58
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phase 13 SHIPPED — manual UAT + gcloud Firestore export remain
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

**Phase 13 — Compliance & Ops Sprint:** SHIPPED 2026-04-25 (5/5 plans, 33 commits squash-merged via PR #1 db03573 + 1 cleanup commit via PR #2 3b6082c).

| Requirement | Status |
|---|---|
| COMP-13-01 self-serve account deletion | ✅ Code-complete + 4 CFs live in us-central1 |
| OPS-13-02 BUILD_DATE auto-stamp | ✅ scripts/deploy.sh handles |
| OPS-13-04 CSP Report-Only | ✅ Live on couchtonight.app/* (audit window TD-4) |
| OPS-13-05 Sentry | ✅ DSN substituted + deployed (couch-v33.3-sentry-dsn) |
| OPS-13-06 GitHub branch protection | ✅ Legacy Branch Protection on main; repo flipped public |
| OPS-13-07 Firestore daily export | ⏸ scripts/firestore-export-setup.sh ready; awaits gcloud auth on user's machine |

**Deferred (CONTEXT.md):** OPS-13-01 (firebase-functions SDK 4→7 → Phase 14, TD-1), OPS-13-03 (Variant-B storage rules → post-Phase-5, TD-2).

**For Phase 13 details:** see .planning/phases/13-compliance-and-ops/13-VERIFICATION.md (HUMAN_NEEDED verdict, per-requirement evidence) + 13-0[1-5]-SUMMARY.md.

## Recent shipped phases (lookback)

| Phase | Status | Reference |
|---|---|---|
| 12 — Pre-launch polish | SHIPPED 2026-04-25, 8/8 smoke tests | .planning/phases/12-pre-launch-polish/12-VERIFICATION.md |
| 11 — Feature refresh & streamline | CODE-COMPLETE 2026-04-24 (deploys bundled, pending Blaze + Storage enablement) | .planning/phases/11-feature-refresh-and-streamline/11-COMPLETION.md |
| 7 — Watchparty | All gap-closure deployed; awaiting consolidated /gsd-verify-work 7 UAT | .planning/phases/07-watchparty/ |
| 4 — Veto System | Implementation complete; awaiting /gsd-verify-work | .planning/phases/04-veto-system/ |
| 3 — Mood Tags | Implementation complete; awaiting /gsd-verify-work | .planning/phases/03-mood-tags/ |

## sw.js cache version

Current: `couch-v33.3-sentry-dsn` (live on couchtonight.app). Bumped via `bash scripts/deploy.sh <short-tag>`. Phase progression: v29 (P11 final) → v32 (P12) → v33 (P13/13-01 account deletion) → v33.1 (P13/13-02 Sentry) → v33.2 (P13/13-05 CSP) → v33.3-sentry-dsn (P13/post-merge DSN substitution).

## Production services

See RUNBOOK §M for the full inventory (Firebase project, Sentry org/project/DSN, GitHub repo + branch protection + CI). Quick refs:
- Firebase: `queuenight-84044` (us-central1)
- Sentry: `couchtonight.sentry.io` project `couch`
- GitHub: `Nahder-Bot/Couch` (public; legacy Branch Protection on main)

## Open follow-ups

| Type | Item | Where |
|---|---|---|
| HUMAN-VERIFY | iOS Safari touch-DnD UAT for Library queue drag-reorder (Phase 14 / 14-02 Task 3 — must run before v34 production deploy; fallback if broken: load Sortable.js via CDN per 14-02-SUMMARY.md) | .planning/phases/14-decision-ritual-core/14-02-SUMMARY.md |
| HUMAN-VERIFY | Multi-device Flow B UAT (Phase 14 / 14-08 Task 5 — must run before v34 production deploy; recap: nominate flow / push delivery / counter-time / nominator decision / T-15 auto-convert / all-No edge / deep-link routing) | .planning/phases/14-decision-ritual-core/14-08-SUMMARY.md |
| HUMAN-VERIFY | gcloud Firestore export setup (run `bash scripts/firestore-export-setup.sh`) | RUNBOOK §K |
| Manual UAT | Trigger account-deletion flow E2E from a real signed-in user | — |
| Tech debt | TD-1 (firebase-functions SDK 4→7), TD-2 (Variant-B storage rules), TD-4 (CSP audit window 2 weeks then enforcement flip), TD-6 (Sentry Replay re-enable +30 days), TD-7 (Firestore index spec record-only) | .planning/TECH-DEBT.md |
| Scheduled | 1-week follow-up agent on 2026-05-02 to check HUMAN-VERIFY progress | trig_015twvB1JTH1zEFvyeQhTmnj |
