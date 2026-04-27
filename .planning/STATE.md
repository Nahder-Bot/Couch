---
gsd_state_version: 1.0
milestone: v33.3
milestone_name: milestone
status: Executing Phase 15.2
last_updated: "2026-04-27T17:15:37.394Z"
progress:
  total_phases: 14
  completed_phases: 5
  total_plans: 65
  completed_plans: 40
  percent: 62
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-19)

**Core value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.
**Current focus:** Phase 15.2 — audit-trail-backfill
**Active milestone:** v1 Commercial Release (Phases 3-10)

## Current Position

Phase: 15.2 (audit-trail-backfill) — EXECUTING
Plan: 1 of 7
Phase: 15 (Tracking Layer) shipped 2026-04-27 (v35.0-tracking-layer); follow-up holistic security audit (15-SECURITY.md + 15-REVIEW.md) surfaced 2 HIGH + 2 MEDIUM open findings → Phase 15.1 hardening pass shipped same day.
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

Current source: `couch-v35.1-security-hardening` (Plan 15.1-03 — Wave 3 close-out **DEPLOYED 2026-04-27** via REVERSED cross-repo deploy ritual; couch hosting deployed first via `scripts/deploy.sh 35.1-security-hardening`, then queuenight firestore:rules deployed second). Live on couchtonight.app: `couch-v35.1-security-hardening`. Bumped via `bash scripts/deploy.sh <short-tag>`. Phase progression: v29 (P11 final) → v32 (P12) → v33 (P13/13-01 account deletion) → v33.1 (P13/13-02 Sentry) → v33.2 (P13/13-05 CSP) → v33.3-sentry-dsn (P13/post-merge DSN substitution) → v34.0-decision-ritual (P14 / 14-09 — superseded mid-deploy by 14-10) → v34.1-roster-control (P14 / 14-10 — DEPLOYED 2026-04-26) → v35.0-tracking-layer (P15 / 15-08 — DEPLOYED 2026-04-27) → v35.0.1-stale-fix (post-15 hotfix) → v35.1-security-hardening (P15.1 / 15.1-03 — **DEPLOYED 2026-04-27**).

## Production services

See RUNBOOK §M for the full inventory (Firebase project, Sentry org/project/DSN, GitHub repo + branch protection + CI). Quick refs:

- Firebase: `queuenight-84044` (us-central1)
- Sentry: `couchtonight.sentry.io` project `couch`
- GitHub: `Nahder-Bot/Couch` (public; legacy Branch Protection on main)

## Open follow-ups

| Type | Item | Where |
|---|---|---|
| HUMAN-VERIFY | iOS Safari touch-DnD UAT for Library queue drag-reorder (Phase 14 / 14-02 Task 3 — must run before v34 production deploy; fallback if broken: load Sortable.js via CDN per 14-02-SUMMARY.md). **Soft confirmation absorbed (Phase 14 / 14-05 Task 5):** while iOS Safari is already in hand for this UAT, also confirm the `.detail-close{position:fixed}` rule at css/app.css:1540 renders correctly under iOS PWA standalone mode + iOS-specific safe-area-inset behavior on a long detail body (Library/Queue title with TMDB community reviews). NON-BLOCKING — the carry-over UAT bug is already CLOSED by source analysis (see 14-05-SUMMARY.md Task 5); this is an additive smoke check, not a separate gate. | .planning/phases/14-decision-ritual-core/14-02-SUMMARY.md + 14-05-SUMMARY.md |
| HUMAN-VERIFY | ~~Couch viz visual + iOS PWA UAT (Phase 14 / 14-04 Task 5)~~ — **OBSOLETED by 14-10 redesign**. Original 14-04 cushion-grid surface no longer exists. New surface is V5 roster pills (per sketch 003 V5 winner) — re-verify under 14-10 below. | .planning/phases/14-decision-ritual-core/14-04-SUMMARY.md |
| HUMAN-VERIFY | ✓ COMPLETED 2026-04-26 — user replied 'approved-deploy' after 4-step UAT pass on production. Couch viz V5 roster UAT (Phase 14 / 14-10) — recap: hero icon 84px renders + Fraunces headline + dynamic Instrument Serif sub-line by state; pills wrap-flex with no row-of-empty-cells problem on desktop; OUT pills dashed + dim, IN pills filled member-color, ME pill amber outline + YOU tag; tap any pill flips in/out for self AND proxy; long-press out-pill 700ms shows progress underline + sends push (toast confirmation); tally bar shows num/total; 3 action links visibility-gated; couchInTonight Firestore round-trip + dual-write to couchSeating; iOS PWA tap targets >=44pt; prefers-reduced-motion respected; Bug A regression check — no .who-card double-render; Bug B regression check — Find-a-seat CTA card no longer appears under V5; downstream consumers 14-01 / 14-03 / 14-07 still work because state.couchMemberIds keeps the same shape. Row retained for traceability. See .planning/phases/14-decision-ritual-core/14-UAT.md tests 1/3/5/24 (commit b9199fb). | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
| Two-repo discipline | ✓ COMPLETED 2026-04-26 — user committed + deployed firestore:rules from queuenight session per approved-deploy signal. queuenight/firestore.rules 14-10 4th UPDATE branch (couchInTonight + couchSeating dual-write allowlist) live on queuenight-84044. Row retained for audit trail. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
| Polish backlog | Couch-ping push channel wiring — sendCouchPing in js/app.js currently shows toast + Sentry breadcrumb only (Path C from 14-10 Task 5). Real push fan-out requires queuenight/functions/index.js new event type 'couchPing' added to NOTIFICATION_DEFAULTS + NOTIFICATION_EVENT_LABELS, fan-out branch in onIntentCreated, client subscription handler. Defer to follow-up plan; Sentry breadcrumb under category='couch-ping' captures attempted fires for product analytics in the meantime. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
| Polish backlog | Drop legacy couchSeating dual-write — persistCouchInTonight writes BOTH couchInTonight (canonical V5 shape) AND couchSeating (legacy 14-04 positional shape) for backward-compat with v33/v34.0 PWAs in transit. After one PWA cache cycle (~1-2 weeks of v34.1 deployed), drop the couchSeating write AND the legacy 3rd UPDATE branch in queuenight/firestore.rules. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
| HUMAN-VERIFY | Multi-device Flow B UAT (Phase 14 / 14-08 Task 5 — must run before v34 production deploy; recap: nominate flow / push delivery / counter-time / nominator decision / T-15 auto-convert / all-No edge / deep-link routing) | .planning/phases/14-decision-ritual-core/14-08-SUMMARY.md |
| HUMAN-VERIFY | Multi-device Flow A UAT (Phase 14 / 14-07 Task 5 — must run before v34 production deploy; recap: Flow A entry CTA → picker 3-tier with T3 collapse → roster proxy-confirm → send-picks → recipient response in/reject/drop/counter → counter-nom chain 3-cap → reject-majority retry → quorum convert). Bundle conceptually with the 14-08 multi-device Flow B UAT entry above — same staging deploy + 2-device session covers both flows. | .planning/phases/14-decision-ritual-core/14-07-SUMMARY.md |
| HUMAN-VERIFY | Tooltip + empty-states + push toggles UAT (Phase 14 / 14-09 — must run before v34 production deploy; recap: (1) 3 D-10 tooltips fire once per user — couchSeating on Couch viz first render / tileActionSheet on first tile tap / queueDragReorder on first Library queue render — and DON'T re-fire after re-login (Firestore flag wrote correctly); (2) 5 D-11 empty states render with verbatim CONTEXT.md D-11 copy and CTAs work end-to-end — brand-new family / empty queue / Flow A no-couch (cushion-glow pulses) / all-watched (Show rewatch options resurfaces watched titles) / reject-majority no-#2 (Open Flow B hands off titleId to nominate); (3) Settings notifications shows the 7 new D-12 toggles with BRAND-voice labels + hints, toggling one off suppresses the corresponding push). Bundle into the same staging deploy + multi-device session that covers 14-07 + 14-08. | .planning/phases/14-decision-ritual-core/14-09-SUMMARY.md |
| Two-repo discipline | queuenight commit pending — `C:/Users/nahde/queuenight/functions/index.js` NOTIFICATION_DEFAULTS edit applied in-place but uncommitted on this machine (same pattern as 14-06 deviation 1). User must `cd ~/queuenight && git add functions/index.js && git commit -m "feat(14-09): add 7 D-12 push categories to NOTIFICATION_DEFAULTS"` from a queuenight-equipped session before deploy. | .planning/phases/14-decision-ritual-core/14-09-SUMMARY.md |
| Polish backlog | DR-3 friendly-UI parity — the 7 new D-12 keys surface ONLY in the legacy NOTIFICATION_EVENT_LABELS Settings UI per the DR-3 follow-up override. Phase 12 friendly-UI maps (`NOTIF_UI_TO_SERVER_KEY` / `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` at js/app.js:128-155) need a follow-up polish plan to mirror them in. RESEARCH §5 flagged the dual-Settings-screen collision risk; a future polish plan must resolve which Settings surface wins (legacy vs friendly-UI) before adding the keys to friendly-UI. | .planning/phases/14-decision-ritual-core/14-09-SUMMARY.md DR-3 override note |
| Deploy gate | ✓ DEPLOYED 2026-04-26 — **v34/v34.1 cross-repo deploy ritual** completed end-to-end via 'approved-deploy' signal. (1) `firebase deploy --only functions` from `~/queuenight` (NOTIFICATION_DEFAULTS with 7 D-12 keys + 14-06 CF branches live); (2) `firebase deploy --only firestore:rules --project queuenight-84044` from `~/queuenight` (covers 14-10's couchInTonight 4th UPDATE branch + 14-04's couchSeating 3rd branch); (3) `bash scripts/deploy.sh 34.1-roster-control` from couch repo (sw.js CACHE = couch-v34.1-roster-control + queuenight/public/ mirror + firebase deploy --only hosting). couchtonight.app live at v34.1-roster-control. Row retained for audit trail. Recommended future remediation (out of scope): extend `scripts/deploy.sh` to add `--only hosting,firestore:rules` with mirror-check guard between the two repos AND optionally chain the queuenight `--only functions` deploy if `QUEUENIGHT_PATH` env var is set. | .planning/phases/14-decision-ritual-core/14-04 + 14-09 + 14-10 SUMMARYs |
| HUMAN-VERIFY (soak) | Phase 15.1 post-deploy soak — within ~24h, monitor Sentry for unexpected `progress.write.failed` / `tupleNames.write.failed` / `coWatchPromptDeclined.write.failed` breadcrumbs from in-flight pre-v35.1 PWAs that haven't yet picked up the new sw.js. Service worker auto-revalidates on next online activation; small spike from old PWAs would be expected and benign. Persistent spike past 1h triggers investigation. | .planning/phases/15.1-security-hardening/15.1-03-SUMMARY.md |
| HUMAN-VERIFY | gcloud Firestore export setup (run `bash scripts/firestore-export-setup.sh`) | RUNBOOK §K |
| Manual UAT | Trigger account-deletion flow E2E from a real signed-in user | — |
| Tech debt | TD-1 (firebase-functions SDK 4→7), TD-2 (Variant-B storage rules), TD-4 (CSP audit window 2 weeks then enforcement flip), TD-6 (Sentry Replay re-enable +30 days), TD-7 (Firestore index spec record-only) | .planning/TECH-DEBT.md |
| Scheduled | 1-week follow-up agent on 2026-05-02 to check HUMAN-VERIFY progress | trig_015twvB1JTH1zEFvyeQhTmnj |
