---
phase: 27
slug: guest-rsvp
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-01
---

# Phase 27 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Sourced from `27-RESEARCH.md` §Validation Architecture (lines 360-414).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | `@firebase/rules-unit-testing` v3.0.2 + custom `it/describe` harness in `tests/rules.test.js` + Node-only smoke harness (no test framework) for `scripts/smoke-guest-rsvp.cjs` |
| **Config file** | `tests/firebase.json` + `tests/package.json` (existing) for rules-unit-testing; couch repo `package.json` `scripts.smoke` aggregate for smoke contracts |
| **Quick run command** | `cd C:/Users/nahde/claude-projects/couch && npm run smoke:guest-rsvp` (per-task fast feedback, runs only the Phase 27 smoke contract) |
| **Full suite command** | `cd C:/Users/nahde/claude-projects/couch && npm run smoke && cd tests && npm test` (runs all 10 smoke contracts + Firestore-emulator rules tests) |
| **Estimated runtime** | ~2-3s for `smoke:guest-rsvp` alone; ~15-25s for full smoke aggregate; ~30-45s for `tests/ npm test` (emulator boot + rules tests) |

---

## Sampling Rate

- **After every task commit:** Run `npm run smoke:guest-rsvp` (quick) — catches per-task drift in <3s.
- **After every plan wave (Wave 1 / Wave 2 / Wave 3):** Run `npm run smoke` (full smoke aggregate) AND `cd tests && npm test` (rules + emulator tests). Required gate before next wave begins.
- **Before `/gsd-verify-work 27`:** Full suite must be green (all 10 smoke contracts + all rules-test describe blocks). No watch-mode flags used anywhere.
- **Max feedback latency:** 45 seconds (full suite). Per-task quick feedback target: <5 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 27-01-01 (Task 1.1 rsvpSubmit extend) | 01 | 1 | RSVP-27-01, RSVP-27-02, RSVP-27-03, RSVP-27-04, RSVP-27-12 | T-27-01, T-27-02, T-27-04 | runTransaction upsert; 6h legacy hardcode removed; closed/cap gates | CF unit (Node require + grep sentinels) | `cd /c/Users/nahde/queuenight && node -e "require('./functions/src/rsvpSubmit.js')"` + grep checks in plan | ✅ (Plan 01 exists; rsvpSubmit.js created in Phase 11) | ⬜ pending |
| 27-01-02 (Task 1.2 create rsvpStatus) | 01 | 1 | RSVP-27-09 (read path) | T-27-03 | read-only CF; no `.update(` calls | CF unit (Node require + grep) | `node -e "require('./functions/src/rsvpStatus.js').rsvpStatus"` | ❌ W0 (file does not exist; created in this task) | ⬜ pending |
| 27-01-03 (Task 1.3 create rsvpRevoke + wire index.js) | 01 | 1 | RSVP-27-15, RSVP-27-05 | T-27-05 | host-gate via `permission-denied`; soft-delete via runTransaction | CF unit (Node require + grep) | `node -e "const m=require('./functions/index.js'); if(!m.rsvpRevoke)process.exit(1)"` | ❌ W0 (rsvpRevoke.js created in this task) | ⬜ pending |
| 27-02-01 (Task 2.1 firestore.rules comment) | 02 | 1 | RSVP-27-05 (documentation) | T-27-08 | comment-only — no rule logic change; `git diff` proves zero predicate changes | doc-only sentinel | `grep -nE "Phase 27" C:/Users/nahde/claude-projects/couch/firestore.rules` + `git diff -U0 firestore.rules \| grep -E "^\+" \| grep -vE "^\+\+\+" \| grep -vE "^\+\s*//"` returns empty | ✅ (firestore.rules exists) | ⬜ pending |
| 27-02-02 (Task 2.2 rules.test.js Phase 27 describe block) | 02 | 1 | RSVP-27-05, RSVP-27-06 | T-27-08 | rules deny anon writes to wp.guests / wp.rsvpClosed / wp.guestCount; member can read | rules-test (Firestore emulator) | `cd C:/Users/nahde/claude-projects/couch/tests && npm test` (must pass + must include `Phase 27 Guest RSVP rules` substring) | ✅ (rules.test.js exists; new describe block added) | ⬜ pending |
| 27-02-03 (Task 2.3 smoke-guest-rsvp.cjs scaffold + package.json wiring) | 02 | 1 | RSVP-27-11, RSVP-27-14 | — | helper-behavior assertions for guestId regex / collision / response normalization / guestCount filter | smoke (Node-only, no framework) | `cd C:/Users/nahde/claude-projects/couch && npm run smoke:guest-rsvp` (must report ≥17 ok lines, 0 failed) + `npm run smoke` aggregate green | ❌ W0 (file does not exist; created in this task) | ⬜ pending |
| 27-03-01 (rsvp.html guestId localStorage + privacy footer) | 03 | 2 | RSVP-27-13 | T-27-04 | guestId persisted client-side; privacy link → /privacy | smoke sentinel (Plan 05 grep) | Plan 05 Task 5.3 sentinels 9.1-9.5 (`qn_guest_`, `VAPID_PUBLIC_KEY`, `startStatusPoll`, `requestPushOptIn`, `rsvp-privacy-link`) | ❌ W0 (rsvp.html does not yet have these surfaces; Plan 03 adds) | ⬜ pending |
| 27-03-02 (rsvp.html push opt-in + State A/B render) | 03 | 2 | RSVP-27-07, RSVP-27-08 | T-27-21 | feature-detect guard for PushManager; iOS non-PWA shows graceful absence | manual UAT (browser matrix) | iOS Safari (non-PWA), Android Chrome — see "Manual-Only Verifications" below | ❌ W0 | ⬜ pending |
| 27-03-03 (rsvp.html status poll + revoked/closed render paths) | 03 | 2 | RSVP-27-09 | — | 30s poll fetches rsvpStatus; flips to revoked/closed states within one cycle | manual UAT (two-device) | UAT-27-04 in 27-HUMAN-UAT.md (created in Plan 05) | ❌ W0 | ⬜ pending |
| 27-04-01 (Task 4.1 renderParticipantTimerStrip guest chips) | 04 | 2 | RSVP-27-14 | T-27-18 | escapeHtml on all guest fields; (guest) suffix only on collision | smoke sentinel (Plan 05 grep) | Plan 05 Task 5.3 sentinels 9.6, 9.9 (`wp-participant-chip guest`, `function displayGuestName`) | ✅ (js/app.js exists) | ⬜ pending |
| 27-04-02 (Task 4.2 window.openGuestMenu/revokeGuest/closeRsvps/openRsvps) | 04 | 2 | RSVP-27-15 | T-27-15, T-27-16 | client-side host gate (defense-in-depth); no confirm() (D-07 reversibility) | smoke sentinel (Plan 05 grep) | Plan 05 Task 5.3 sentinels 9.7, 9.8 (`window.revokeGuest`, `window.closeRsvps`) | ✅ (js/app.js exists) | ⬜ pending |
| 27-04-03 (Task 4.3 banner guest count + RSVPs CLOSED pill + CSS) | 04 | 2 | RSVP-27-15 (close path UI) | — | host-only Close/Open RSVPs toggle visible iff state.me.id === wp.hostId | smoke sentinel + manual UAT | grep `buildWpBannerMetaSuffix`, `.wp-rsvp-closed-pill` in css/app.css; UAT-27-05 | ✅ (js/app.js + css/app.css exist) | ⬜ pending |
| 27-05-01 (Task 5.1 rsvpRevoke action='attachPushSub') | 05 | 3 | RSVP-27-08 (server side) | T-27-20 | guestId-bound write; idempotent on missing guest; revoked guests cannot subscribe | CF unit (Node require + grep) | `node -e "require('./functions/src/rsvpRevoke.js')"` + grep `attachPushSub`, `pushSub.endpoint`, `runTransaction` | ✅ (file created in Plan 01; extended here) | ⬜ pending |
| 27-05-02 (Task 5.2 rsvpReminderTick guest loop + dead-sub prune) | 05 | 3 | RSVP-27-10, RSVP-27-11 | T-27-21, T-27-22, T-27-23 | direct webpush.sendNotification (not sendToMembers); 410/404 prune via runTransaction; payload uses titleName + hostName only (no guest names) | CF unit (Node require + grep sentinels) | `node -e "require('./functions/src/rsvpReminderTick.js').rsvpReminderTick"` + grep `wp.guests`, `webpush.sendNotification(gs.pushSub`, `410`, `404`, `pushSub: null` | ✅ (existing file from Phase 11; extended here) | ⬜ pending |
| 27-05-03 (Task 5.3 smoke production-code sentinels — final ≥30 floor) | 05 | 3 | (locks all 15 RSVP-27-* IDs at smoke layer) | (locks all T-27-* threats) | grep-based deploy gate; floor meta-assertion mirrors Phase 26 RPLY-26-17 | smoke (Node-only) | `cd C:/Users/nahde/claude-projects/couch && npm run smoke:guest-rsvp` (must report ≥30 passed, 0 failed; floor meta line `production-code sentinel floor met (≥13)`) | ✅ (file extended; Plan 02 created scaffold) | ⬜ pending |
| 27-05-04 (Task 5.4 27-HUMAN-UAT.md scaffold) | 05 | 3 | RSVP-27-07, RSVP-27-08, RSVP-27-09, RSVP-27-13 | — | ≥10 device-UAT scripts; browser matrix coverage map | doc-only sentinel | `node -e "const fs=require('fs');const s=fs.readFileSync('.planning/phases/27-guest-rsvp/27-HUMAN-UAT.md','utf8');if((s.match(/### UAT-27-/g)\|\|[]).length<10)process.exit(1)"` | ❌ W0 (file does not exist; created in this task) | ⬜ pending |
| 27-05-05 (Task 5.5 deploy CHECKPOINT) | 05 | 3 | (deploy ritual; no functional req) | T-27-24 | sw.js CACHE bump auto-fires from `bash scripts/deploy.sh 39-guest-rsvp`; cross-repo functions deploy first | manual (user-confirmed) | `curl -s https://couchtonight.app/sw.js \| grep "CACHE = "` returns `couch-v39-guest-rsvp` | ✅ (deploy.sh exists; sw.js exists) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

These files do NOT yet exist and MUST be created by the listed task before any downstream task can verify against them:

- [ ] `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js` — created by Plan 01 Task 1.2 (RSVP-27-09 polling endpoint)
- [ ] `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js` — created by Plan 01 Task 1.3 (RSVP-27-15 + Plan 05 attachPushSub extension)
- [ ] `C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs` — created by Plan 02 Task 2.3 (Wave 0 smoke contract; extended to ≥30 assertions in Plan 05 Task 5.3)
- [ ] `C:/Users/nahde/claude-projects/couch/tests/rules.test.js` — `Phase 27 Guest RSVP rules` describe block + `wp_phase27_test` seed doc — added by Plan 02 Task 2.2
- [ ] `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-HUMAN-UAT.md` — scaffolded by Plan 05 Task 5.4
- [ ] `npm run smoke:guest-rsvp` script alias in `package.json` — wired by Plan 02 Task 2.3
- [ ] `npm run smoke` aggregate appended with `&& node scripts/smoke-guest-rsvp.cjs` — wired by Plan 02 Task 2.3

`wave_0_complete` will flip to `true` after Plan 02 ships (last Wave 1 plan; both rules-test extension + smoke scaffold land together; Plan 05 fills the rest in Wave 3).

Existing infrastructure (already in place pre-Phase-27): `@firebase/rules-unit-testing` package + emulator config + `tests/package.json`; couch repo `package.json` smoke aggregate scaffold; `bash scripts/deploy.sh` cache-bump automation; Firebase Functions deploy ritual.

---

## Manual-Only Verifications

Browser-matrix UAT for web push (RESEARCH §Validation Architecture lines 391-402; full coverage in `27-HUMAN-UAT.md` after Plan 05 Task 5.4):

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| iOS Safari (not PWA): "Push not supported" state renders; no permission prompt | RSVP-27-07 | Push permission flow is browser-OS-mediated; PushManager absence depends on host browser; cannot be Node-emulated | UAT-27-01 in 27-HUMAN-UAT.md: open `/rsvp/<token>` on iPhone Safari (NOT added to Home Screen), tap "Going" + name, confirm graceful absence of "Get reminded" block |
| iOS Safari (PWA, added to Home Screen): permission prompt shown post-RSVP | RSVP-27-08 | PWA-only push availability is iOS 16.4+ runtime feature; cannot be Node-emulated | UAT-27-02 variant: install rsvp.html as Home Screen webclip first (or use app shell PWA), then RSVP and tap "Remind me" |
| iOS Safari (Chrome iOS): "Push not supported" (Chrome iOS = WKWebView, same restriction as Safari non-PWA) | RSVP-27-07 | WKWebView dependency is iOS-runtime; cannot be Node-emulated | Re-run UAT-27-01 in Chrome iOS app |
| Android Chrome: permission prompt shown immediately on tap | RSVP-27-08 | OS-level permission UX | UAT-27-02 in 27-HUMAN-UAT.md |
| macOS Safari 16+: permission prompt shown without install | RSVP-27-08 | OS-level permission UX | UAT-27-02 (run on Mac) |
| Desktop Chrome: permission prompt shown without install | RSVP-27-08 | OS-level permission UX | UAT-27-02 |
| Desktop Firefox: permission prompt shown without install | RSVP-27-08 | OS-level permission UX | UAT-27-02 (re-run on FF) |
| Two-device revoke flow: guest sees evicted state within one 30s poll cycle | RSVP-27-09 | Requires real wall-clock poll cycle + two physical devices | UAT-27-04 in 27-HUMAN-UAT.md |
| Web push reminder fires on schedule (T-1h window) | RSVP-27-10 | Cloud Scheduler trigger + real Push Service delivery | UAT-27-09 (DEFERRABLE if no scheduler trigger access — Plan 05 Task 5.4 marks it deferred) |
| pushSub=null guests skipped silently | RSVP-27-11 | Verifying *absence* of a side-effect requires production logs (Firebase Functions logs) | UAT-27-10 (DEFERRABLE if no logs access) |
| Privacy link navigates to /privacy | RSVP-27-13 | Render path correctness on touch device | UAT-27-01 step 5 (privacy footer click) |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies declared (per-task map above)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (every task has either Node require sentinel, smoke grep, rules-test, or doc-only sentinel; manual UAT items are post-deploy verification, not in-flight blockers)
- [x] Wave 0 covers all MISSING references (rsvpStatus.js, rsvpRevoke.js, smoke-guest-rsvp.cjs, Phase 27 rules-test describe block, 27-HUMAN-UAT.md — all listed above with creating task)
- [x] No watch-mode flags (smoke harness is one-shot Node script; rules tests use `cd tests && npm test` which is one-shot emulator-exec)
- [x] Feedback latency < 45s (full suite); per-task quick feedback < 5s
- [x] `nyquist_compliant: true` set in frontmatter

`wave_0_complete: false` will flip to `true` once Plan 02 lands the smoke scaffold + rules-test describe block (the two foundational Wave 0 artifacts gating downstream verification).

**Approval:** pending — flip to `approved` after planner-checker validates and before Plan 01 Task 1.1 begins execution.
