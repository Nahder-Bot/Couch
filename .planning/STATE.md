---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: Phase 13 SHIPPED — 3/4 HUMAN-VERIFY items closed; 1 remains (gcloud Firestore export setup)
stopped_at: "Phase 13 SHIPPED 2026-04-25 — 5/5 plans + verification merged via PR #1 (db03573) + PR #2 (3b6082c). 3/4 HUMAN-VERIFY items closed (Sentry account+DSN+deploy of couch-v33.3-sentry-dsn; legacy Branch Protection on main; 4 Cloud Functions deployed to us-central1). Remaining: gcloud Firestore export setup (user-side, gcloud CLI not installed). Prior shipped: Phase 12 (POL-01..04 polish, 8/8 smoke), Phase 11 (REFR-1..13 feature refresh, code-complete; deploy bundled with 11-04+11-05+11-06 pending Blaze billing + Firebase Console Storage). Full per-phase audit trail lives in .planning/phases/{phase-dir}/{phase-num}-VERIFICATION.md and per-plan SUMMARY.md."
last_updated: "2026-04-25T19:30:00.000Z"
last_activity: 2026-04-25 -- Phase 13 SHIPPED + cleanup PR (CLAUDE.md sw.js version refresh, RUNBOOK §L GH006 fix, accountDeletionReaper.js comments-sweep hoist, STATE.md token-bloat trim)
progress:
  total_phases: 11
  completed_phases: 4
  total_plans: 58
  completed_plans: 35
  percent: 60
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
| HUMAN-VERIFY | gcloud Firestore export setup (run `bash scripts/firestore-export-setup.sh`) | RUNBOOK §K |
| Manual UAT | Trigger account-deletion flow E2E from a real signed-in user | — |
| Tech debt | TD-1 (firebase-functions SDK 4→7), TD-2 (Variant-B storage rules), TD-4 (CSP audit window 2 weeks then enforcement flip), TD-6 (Sentry Replay re-enable +30 days), TD-7 (Firestore index spec record-only) | .planning/TECH-DEBT.md |
| Scheduled | 1-week follow-up agent on 2026-05-02 to check HUMAN-VERIFY progress | trig_015twvB1JTH1zEFvyeQhTmnj |
