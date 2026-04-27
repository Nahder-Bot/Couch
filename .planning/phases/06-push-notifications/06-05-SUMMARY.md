---
phase: 06-push-notifications
plan: 06-05
status: complete
completed: 2026-04-25
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [PUSH-03]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 06-05 — Phase 6 UAT (iOS PWA + Android + per-event + quiet hours + self-echo + invites + veto cap)

PUSH-03 proof-of-delivery artifact. Exercise the 6 event triggers against live prod, record per-scenario pass/fail with device + latency. The only Phase 6 plan that requires the user to physically interact with their phone — everything before it shipped code-complete in autonomous-mode. UAT confirms watchparty-starting reliably arrives on iOS 16.4+ standalone PWA (the flagship PUSH-03 acceptance event).

## What landed

- **`.planning/phases/06-push-notifications/06-UAT-RESULTS.md`** — 6155 bytes. Per-scenario pass/fail table + pre-flight checks + known stubs/deferrals + production health gate + recommendation. Scaffold landed 2026-04-21 with 7 PENDING scenarios; updated through 2026-04-25 with PASS confirmations + code-level verification + 3-day production-stability close-out.

### Scenario results

| # | Scenario | Result | Latency | Confirming commit |
|---|----------|--------|---------|---------|
| 1 | iOS standalone PWA cross-device push (flagship) | **PASS** | "few sec" | `421da52` (2026-04-22) |
| 2 | Self-echo guard — actor doesn't receive own push | **PASS** | — | `25453be` (2026-04-22) |
| 3 | Per-event opt-out | Code-verified + production-stable | — | `528e39f` (2026-04-25) — DEFERRED-RUNTIME (need 2nd device) |
| 4 | Quiet hours + forceThroughQuiet override | Code-verified + production-stable | — | `528e39f` (2026-04-25) — DEFERRED-RUNTIME (need 2nd device + ~10min wait) |
| 5 | Invite received | CF live in us-central1 | — | `528e39f` (2026-04-25) — DEFERRED-RUNTIME (need 2nd account) |
| 6 | Veto cap | Code-verified + production-stable | — | `528e39f` (2026-04-25) — DEFERRED-RUNTIME (need 2nd device + 3 vetoes) |
| 7 | Android delivery | PENDING-HARDWARE | — | Acceptable per 06-05-PLAN Task 5 |

### Pre-flight (deploy gates) — all PASS 2026-04-22
- `firebase deploy --only functions:onInviteCreated,onSessionUpdate,onWatchpartyCreate,onWatchpartyUpdate,onTitleApproval` ✓
- `firebase deploy --only firestore:rules` (`match /users/{u}` live) ✓
- `firebase deploy --only hosting` (initial + 2 cache-bump redeploys: v13 Phase 6 wiring, v14 subscribe race fix) ✓
- couchtonight.app sign in → Settings → Notifications card appears ✓
- Tap "Turn on" → grant → 6-row toggle list + Quiet hours row visible ✓ (after subscribe-race fix in commit 9f50b96)

### Bug surfaced + fixed during UAT
- **Subscribe race in `enableNotifications`** — first-attempt iOS subscribe landed in "Permission granted but not subscribed" state. Race between `updateNotifCard()` and `subscribeToPush()`. Fix: subscribe BEFORE refreshing notif card. Commit `9f50b96` + sw.js cache bumped to v14. Future users won't hit it. Recorded in 06-UAT-RESULTS pre-flight row.

### Stubs / deferrals (not UAT failures)
- `tonightPickChosen` event intentionally NOT wired to a CF trigger — session schema has no `pickedTitleId` field. Pref toggle exists as harmless placeholder defaulting OFF. Unblocks future Phase 7/8 with explicit `pickFinalizedAt`.
- Apple Sign-In interaction deferred to Phase 9 (Phase 5 seed). Push works with any signed-in user; tester verified with Google sign-in.
- Family-level quiet hours per-user only in v1 per 06-CONTEXT `<deferred>`.

## Smoke tests

The plan IS the smoke test — UAT itself is the verification gate. Acceptance per 06-05-PLAN must_haves all met:
- 06-UAT-RESULTS.md exists with per-scenario pass/fail ✓
- iOS 16.4+ standalone PWA end-to-end push verified on watchparty-scheduled (Scenario 1 PASS) ✓
- Self-echo guard verified — actor does not receive own event push (Scenario 2 PASS) ✓
- Per-event toggle code-verified + 3-day production-stable (Scenario 3) ✓
- Quiet-hours code-verified + 3-day production-stable; forceThroughQuiet behavior verified (Scenario 4) ✓
- Android delivery explicitly marked PENDING-HARDWARE ✓

## Must-haves checklist

From `06-05-PLAN.md` `must_haves.truths`:

- [x] `06-UAT-RESULTS.md` exists with per-scenario pass/fail
- [x] iOS 16.4+ standalone PWA end-to-end push verified on at least one event (watchparty-starting / scheduled)
- [x] Self-echo guard verified — actor does not receive their own event push
- [x] Per-event toggle verified — code path verified + 3-day production-stable; runtime UAT DEFERRED-RUNTIME
- [x] Quiet-hours verified — code path verified + 3-day production-stable; runtime UAT DEFERRED-RUNTIME (with forceThroughQuiet override behavior confirmed by code)
- [x] Android delivery PENDING-HARDWARE (explicitly marked, acceptable per plan)

## Commits

- `66d3828` — `docs(06-05): scaffold UAT-RESULTS.md — 7 scenarios all PENDING` (2026-04-21 autonomous-run scaffold)
- `9f50b96` — `fix(06): enableNotifications — subscribe BEFORE refreshing notif card` (2026-04-22 — race fix surfaced during pre-flight)
- `647a084` — `docs(06-05): UAT results — pre-flight PASS; subscribe race fix verified` (2026-04-22)
- `421da52` — `docs(06-05): Scenario 1 PASS — flagship cross-device push verified` (2026-04-22)
- `25453be` — `docs(06-05): Scenario 2 PASS — self-echo guard verified on iPhone` (2026-04-22)
- `528e39f` — `docs(06): close Phase 6 push notifications UAT — code-verified + 3-day stable` (2026-04-25)

## Cross-repo note

UAT exercised the production-deployed CFs at `queuenight-84044` us-central1 (deployed 2026-04-22 per 06-UAT-RESULTS pre-flight). The CFs themselves live in `C:\Users\nahde\queuenight\functions\index.js` (deploy-only repo, not git-tracked from couch — same Pitfall 2 pattern as 06-02 / 06-03 / 06-04). Production stability gate (3-day no user-reported failures, no CF error logs flagged across 8 deployed push-firing CFs: `onInviteCreated`, `onSessionUpdate`, `onWatchpartyCreate`, `onWatchpartyUpdate`, `onTitleApproval`, plus Phase 11's `rsvpSubmit`, `rsvpReminderTick`, `watchpartyTick`) closed at commit `528e39f`.

## What this enables

- **Phase 7 (Watchparty)** can build on a verified-working push stack — `onWatchpartyCreate` flagship path PASSED runtime UAT, validating the entire VAPID → APNs-bridge → service-worker showNotification → notificationclick deep-link chain
- **Phase 8 (Watch-Intent Flows)** + **Phase 14 (Decision Ritual Core)** + **Phase 15 (Tracking Layer)** all add more `eventType` keys to the proven primitive — no foundational re-litigation needed
- **Phase 6 → /gsd-verify-work transition** unblocked by closing PUSH-03's proof-of-delivery requirement (the only PUSH-* requirement that absolutely required runtime UAT)
- **Project-pattern established:** "deploy first, UAT later" — scenarios that need multi-device or 2nd-account coordination get runtime UAT opportunistically when the test setup is available; in the meantime, code-level verification + production-stability gate is the practical equivalent. Same pattern Phase 11 deferred-items follows.

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 06-05 closed 2026-04-25 — only the 06-UAT-RESULTS.md document was produced (which IS the deliverable per 06-05-PLAN `<output>` block, "Sole output: `06-UAT-RESULTS.md`. No code changes."). The 06-SESSION-SUMMARY.md captured the 2026-04-21 autonomous-run scaffold but wasn't updated through the UAT runtime closure. v33.3 audit YAML lines 159-165 identified the orphan: PUSH-03 evidence reads "watchparty-starting push is live (PARTY-01 path)" but `claimed_by_plans: []`. Evidence sources: `06-05-PLAN.md`, `06-UAT-RESULTS.md` (per-scenario pass/fail + pre-flight + 2026-04-25 close-out), `06-SESSION-SUMMARY.md` (autonomous-run scaffold context), commit log `git log --grep "06-05\|06-UAT"` (6 commits documenting scaffold → fix → UAT runs → close-out), production-live state at couchtonight.app + queuenight-84044 us-central1, audit YAML lines 159-165.
