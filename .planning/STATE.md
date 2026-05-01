---
gsd_state_version: 1.0
milestone: v1-commercial-release
milestone_name: v1 Commercial Release
status: executing
last_updated: "2026-04-30T16:56:55.912Z"
last_activity: 2026-04-30
progress:
  total_phases: 27
  completed_phases: 16
  total_plans: 92
  completed_plans: 88
  percent: 96
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phase 15.6 — audit-trail-backfill-2
**Active milestone:** v1 Commercial Release (Phases 3-15.5 + 18) — slug: `v1-commercial-release`

## Current Position

**Status:** Ready to execute

**Last Activity:** 2026-04-30

**Most recent close-out:** Phase 20 — Decision Explanation (3 plans / 3 waves shipped 2026-04-30 via /gsd-discuss-phase --auto → /gsd-plan-phase --auto → /gsd-execute-phase --auto chain. `buildMatchExplanation` pure helper at js/app.js:112 + 3 surface integrations (spin-pick italic serif sub-line / matches card dim footer / detail modal "Why this is in your matches" section gated on getCurrentMatches.some) + sw.js → `couch-v36.2-decision-explanation`. Live at couchtonight.app, curl-verified. 13 device-UAT items in 20-HUMAN-UAT.md user-pending. REQ-20-01..11 all Complete in REQUIREMENTS.md post-15.6).

**Most recent reconciliation:** Phase 15.6 — Audit-trail backfill 2 + STATE.md repair (3 plans / 2 waves; Plan 01 added 29 traceability rows for REQ-18-01..10 + KID-19-01..08 + REQ-20-01..11; Plan 02 reconciled ROADMAP Progress table for Phases 18 + 19; Plan 03 = this plan).

**Next available work:**

- Phase 15.3 — DESIGN-01 (canonical SVG logo + wordmark sources) — SCOPED, awaiting kickoff. Closes the only genuinely unsatisfied requirement from v33.3 milestone audit.
- Phase 16 — Calendar Layer (recurring + multi-future watchparty scheduling) — SCOPED, awaiting kickoff.
- Phase 17 — App Store Launch Readiness (native wrapper + App Store / Play listings) — SCOPED, awaiting kickoff (next-milestone candidate per cross-AI review 2026-04-28).
- Run `/gsd-verify-work 18` after device UAT (7 items in 18-HUMAN-UAT.md).
- Run `/gsd-verify-work 19` after device UAT (8 items in 19-HUMAN-UAT.md).
- Run `/gsd-verify-work 20` after device UAT (13 items in 20-HUMAN-UAT.md).

**Detail-rich phase records:** ROADMAP.md is the source of truth for phase narratives + Progress table — see § Phase 18 / 19 / 20 sections + closed-out footnotes (lines ~486-491). REQUIREMENTS.md is source of truth for traceability — see Coverage block at line ~341.

## Recent shipped phases (lookback)

| Phase | Status | Reference |
|---|---|---|
| 15.6 — Audit-trail backfill 2 + STATE.md repair | SHIPPED 2026-04-30 (3 plans / 2 waves; pure documentation phase mirroring 15.2 pattern; 29 REQ rows backfilled in REQUIREMENTS.md + ROADMAP-table reconciled for Phases 18+19 + STATE.md repaired) | .planning/phases/15.6-audit-trail-backfill-2/ |
| 20 — Decision Explanation | SHIPPED 2026-04-30 (v36.2-decision-explanation; 3 plans / 3 waves; buildMatchExplanation helper + 3 surface integrations + 5-smoke gate; 13 device-UAT items in 20-HUMAN-UAT.md) | .planning/phases/20-decision-explanation/20-VERIFICATION.md |
| 19 — Kid Mode | SHIPPED 2026-04-29 (v36.1-kid-mode; 3 plans / 3 waves; couch-only deploy; getEffectiveTierCap + 7 filter splices + V5 roster pill toggle + parent override; 8 device-UAT items in 19-HUMAN-UAT.md) | .planning/phases/19-kid-mode/19-HUMAN-UAT.md |
| 18 — Availability Notifications | SHIPPED 2026-04-29 (v36-availability-notifs; cross-repo deploy queuenight 22:48Z + couch 22:50Z; daily providerRefreshTick CF live in us-central1; 7 device-UAT items in 18-HUMAN-UAT.md) | .planning/phases/18-availability-notifications/18-HUMAN-UAT.md |
| 15.4 — Integration polish | SHIPPED 2026-04-29 (v35.6-integration-polish; 13 commits across couch+queuenight; 6 device-UAT items tracked; user scheduled 1-week soak check) | .planning/phases/15.4-integration-polish/15.4-HUMAN-UAT.md |
| 15.5 — Wait Up flex | SHIPPED 2026-04-28 (v35.5-wait-up-flex; 26 commits; verifier human_needed; user approved; 6 device-UAT items tracked) | .planning/phases/15.5-wait-up-flex/15.5-VERIFICATION.md + 15.5-HUMAN-UAT.md |
| 12 — Pre-launch polish | SHIPPED 2026-04-25, 8/8 smoke tests | .planning/phases/12-pre-launch-polish/12-VERIFICATION.md |
| 11 — Feature refresh & streamline | CODE-COMPLETE 2026-04-24 (deploys bundled, pending Blaze + Storage enablement) | .planning/phases/11-feature-refresh-and-streamline/11-COMPLETION.md |
| 7 — Watchparty | All gap-closure deployed; awaiting consolidated /gsd-verify-work 7 UAT | .planning/phases/07-watchparty/ |
| 4 — Veto System | Implementation complete; awaiting /gsd-verify-work | .planning/phases/04-veto-system/ |
| 3 — Mood Tags | Implementation complete; awaiting /gsd-verify-work | .planning/phases/03-mood-tags/ |

## sw.js cache version

Current source: `couch-v36.2-decision-explanation` (Plan 20-03 — Wave 3 close-out **DEPLOYED 2026-04-30** via SINGLE-REPO couch-only deploy ritual: `bash scripts/deploy.sh 36.2-decision-explanation`; 5-smoke gate (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation) PASS; queuenight unchanged per D-16). Live on couchtonight.app: `couch-v36.2-decision-explanation` (curl-verified). Bumped via `bash scripts/deploy.sh <short-tag>`. Phase progression: v29 (P11 final) → v32 (P12) → v33 (P13) → v34.0/v34.1 (P14) → v35.0/v35.0.1 (P15) → v35.1-security-hardening (P15.1) → v35.5-wait-up-flex (P15.5) → v35.6-integration-polish (P15.4) → v36-availability-notifs (P18) → v36.1-kid-mode (P19) → v36.2-decision-explanation (P20).

## Production services

See RUNBOOK §M for the full inventory (Firebase project, Sentry org/project/DSN, GitHub repo + branch protection + CI). Quick refs:

- Firebase: `queuenight-84044` (us-central1)
- Sentry: `couchtonight.sentry.io` project `couch`
- GitHub: `Nahder-Bot/Couch` (public; legacy Branch Protection on main)

## Open follow-ups

| Type | Item | Where |
|---|---|---|
| HUMAN-VERIFY | Phase 20 UAT (13 scripts) — pending real-device verification post-2026-04-30 deploy. Scripts cover spin-pick italic serif sub-line / matches card dim footer / detail-modal "Why this is in your matches" gated render / considerable variant. Resume signal: "uat passed" → trigger /gsd-verify-work 20. | .planning/phases/20-decision-explanation/20-HUMAN-UAT.md |
| HUMAN-VERIFY | Phase 19 UAT (8 scripts) — pending real-device verification post-2026-04-29 deploy. Scripts cover Kid-mode toggle visibility + session-scope + tier-cap + Library filter + amber tint + parent override + cache bump + reset boundaries. Resume signal: "uat passed" → trigger /gsd-verify-work 19. | .planning/phases/19-kid-mode/19-HUMAN-UAT.md |
| HUMAN-VERIFY | Phase 18 UAT (4 scripts) — pending real-device verification post-2026-04-29 deploy. Scripts: Settings UI toggle parity + manual refresh affordance + simulated CF tick + opt-out. Resume signal: "uat passed" → trigger /gsd-verify-work 18. | .planning/phases/18-availability-notifications/18-04-SUMMARY.md |
| HUMAN-VERIFY (soak) | Phase 18 post-deploy 7-day Sentry soak — monitor [18/providerRefreshTick] error breadcrumbs. Persistent TMDB 429 spike past 1 day → reduce per-tick cap from 50. Also monitor 30-day usage analytics on titleAvailable opt-out rate (RESEARCH risk 2 — if opt-out >30%, revisit cadence/threshold). | .planning/phases/18-availability-notifications/18-04-SUMMARY.md |
| HUMAN-VERIFY | Multi-device Flow A UAT (Phase 14 / 14-07 Task 5) + Multi-device Flow B UAT (14-08 Task 5) + Tooltip + empty-states + push toggles UAT (14-09) — bundle into one staging deploy + multi-device session. Must run before any v34-baseline regression. | .planning/phases/14-decision-ritual-core/14-07-SUMMARY.md + 14-08-SUMMARY.md + 14-09-SUMMARY.md |
| HUMAN-VERIFY | iOS Safari touch-DnD UAT for Library queue drag-reorder (Phase 14 / 14-02 Task 3) + soft confirmation `.detail-close{position:fixed}` rule under iOS PWA standalone mode (Phase 14 / 14-05 Task 5). NON-BLOCKING; smoke during the same iOS session as the multi-device UAT bundle. | .planning/phases/14-decision-ritual-core/14-02-SUMMARY.md + 14-05-SUMMARY.md |
| HUMAN-VERIFY (soak) | Phase 15.1 post-deploy 24h Sentry soak — monitor unexpected `progress.write.failed` / `tupleNames.write.failed` / `coWatchPromptDeclined.write.failed` breadcrumbs from in-flight pre-v35.1 PWAs. Service worker auto-revalidates on next online activation; small spike from old PWAs would be expected and benign. Persistent spike past 1h triggers investigation. | .planning/phases/15.1-security-hardening/15.1-03-SUMMARY.md |
| HUMAN-VERIFY | gcloud Firestore export setup (run `bash scripts/firestore-export-setup.sh`) — gcloud CLI not yet installed locally per Phase 18 / 18-04 surfaced gap; affects RUNBOOK §K. | RUNBOOK §K |
| Manual UAT | Trigger account-deletion flow E2E from a real signed-in user (COMP-13-01 closure verification). | — |
| Polish backlog | Drop legacy couchSeating dual-write — persistCouchInTonight writes BOTH couchInTonight (canonical V5) AND couchSeating (legacy 14-04). After one PWA cache cycle (~1-2 weeks of v34.1 deployed), drop the couchSeating write AND the legacy 3rd UPDATE branch in queuenight/firestore.rules. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
| Tech debt | TD-1 (firebase-functions SDK 4→7), TD-2 (Variant-B storage rules), TD-4 (CSP audit window 2 weeks then enforcement flip), TD-6 (Sentry Replay re-enable +30 days), TD-7 (Firestore index spec record-only), TD-8 (dual-Settings-screen consolidation — added 2026-04-29 by Plan 15.4-02). | .planning/TECH-DEBT.md |
| Tooling gap | gcloud CLI not installed on local Windows machine — affects (a) Phase 18 UAT 3 manual-trigger via `gcloud scheduler jobs run firebase-schedule-providerRefreshTick-us-central1` (workaround: Firebase Console scheduler-page click OR 24h Path B soak); (b) RUNBOOK §K Firestore daily export setup. Recommended future install for full deploy/observability symmetry. | .planning/phases/18-availability-notifications/18-04-SUMMARY.md |
| Scheduled | 1-week follow-up agent on 2026-05-02 to check HUMAN-VERIFY progress | trig_015twvB1JTH1zEFvyeQhTmnj |

## Resolved follow-ups

Recent ✓ COMPLETED items moved here from Open follow-ups for compaction. Items >30 days old auto-prune per `auto_prune_state` config.

| Type | Item | Where | Resolved |
|---|---|---|---|
| HUMAN-VERIFY | ✓ Couch viz V5 roster UAT (Phase 14 / 14-10) — user replied 'approved-deploy' after 4-step UAT pass on production. Hero icon 84px + Fraunces headline + dynamic Instrument Serif sub-line by state; pills wrap-flex; OUT pills dashed + dim, IN pills filled; long-press 700ms → push; tally bar; 3 action links visibility-gated; couchInTonight Firestore round-trip + dual-write to couchSeating. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md | 2026-04-26 |
| Two-repo discipline | ✓ queuenight/firestore.rules 14-10 4th UPDATE branch (couchInTonight + couchSeating dual-write allowlist) live on queuenight-84044. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md | 2026-04-26 |
| Polish backlog | ✓ couch-ping push channel wiring complete (Phase 15.4 Plans 01 + 02 — queuenight onCouchPingFire CF + NOTIFICATION_DEFAULTS.couchPing + 3-way firestore.rules /couchPings block + sendCouchPing Path A Firestore write at js/app.js:14477-14506). | .planning/phases/15.4-integration-polish/15.4-01-SUMMARY.md + 15.4-02-SUMMARY.md | 2026-04-29 |
| Polish backlog | ✓ Friendly-UI parity reached via mirror approach (Plan 15.4-02 — 9 keys added to all 3 friendly-UI maps at js/app.js:181-247). POL-01 partial → satisfied. | .planning/phases/15.4-integration-polish/15.4-02-SUMMARY.md + .planning/TECH-DEBT.md TD-8 | 2026-04-29 |
| Deploy gate | ✓ v34/v34.1 cross-repo deploy ritual completed end-to-end. firebase deploy --only functions from ~/queuenight + firebase deploy --only firestore:rules + bash scripts/deploy.sh 34.1-roster-control. couchtonight.app live at v34.1-roster-control. | .planning/phases/14-decision-ritual-core/14-04 + 14-09 + 14-10 SUMMARYs | 2026-04-26 |
| Two-repo discipline | ✓ Plan 18-01 queuenight commit `d622dc6` on `main` — `feat(18-01): add providerRefreshTick CF + titleAvailable in NOTIFICATION_DEFAULTS`. Deployed via Plan 18-04 cross-repo ritual. | .planning/phases/18-availability-notifications/18-01-SUMMARY.md | 2026-04-29 |
| Pre-deploy gate | ✓ Phase 18 / 18-04 Task 2 pre-flight — TMDB_KEY auto-fixed by appending to queuenight/functions/.env pre-deploy. firebase v2 onSchedule deploy logged `Loaded environment variables from .env.` confirming pickup. | .planning/phases/18-availability-notifications/18-04-SUMMARY.md | 2026-04-29 |
| Phase 18 progress | ✓ Plans 18-01 + 18-02 + 18-03 + 18-04 all committed + deployed (couch commits 5a86045 + 7f04d2f + 416ab32 + c5fb713 + fac3d71 + adcebfc; queuenight d622dc6). Cross-repo deploy queuenight 22:48Z → couch 22:50Z. | .planning/phases/18-availability-notifications/ | 2026-04-29 |
