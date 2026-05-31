---
phase: 16
slug: calendar-layer
status: ready-for-execution
nyquist_compliant: true
wave_0_complete: false
created: 2026-05-27
populated_by_planner: 2026-05-27
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Populated by /gsd-plan-phase 16 on 2026-05-27.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node smoke contracts (`scripts/smoke-*.cjs`) + Firestore rules emulator (`tests/rules.test.js`, Jest) |
| **Config file** | `package.json` (npm scripts), `tests/firebase.json` (rules emulator), `firebase.json` (functions) |
| **Quick run command** | `node scripts/smoke-<specific>.cjs` (~50-100ms each) |
| **Full suite command** | `bash scripts/deploy.sh --gate-only` (registers all smoke contracts) + `cd tests && npm test` (~20s for rules emulator) |
| **Estimated runtime** | ~5s smoke contracts, ~20s rules tests, ~30s total for full suite |

---

## Sampling Rate

- **After every task commit:** Run the smoke contract relevant to the task (e.g., `node scripts/smoke-series-cadence-compute.cjs` after Wave 1 task 1)
- **After every plan wave:** Run all relevant smoke contracts (e.g., after Wave 3 deploys CF changes, run all 3 series-* contracts + smoke-app-parse)
- **Before `/gsd-verify-work 16`:** Full suite (16 smoke contracts + 12+ rules tests) must be green
- **Max feedback latency:** ~5 seconds per smoke contract, ~30s for full suite

---

## Per-Task Verification Map

Each plan task maps to a CAL-16-XX requirement + a verification command. The executor runs the listed command at each task commit per the sampling rate above.

| Plan | Task | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 16-01 | T1 watchpartySeries rules block | 1 | CAL-16-02 | T-16-01, T-16-04, T-16-06, T-16-09, T-16-10, T-16-11 | rules block enforces memberUids read + creator-only write + immutable titleType + soft-delete | grep contract | `node -e "...firestore.rules content checks..."` (in plan 16-01 task 1 verify) | ⬜ pending |
| 16-01 | T2 composite indexes | 1 | CAL-16-15 | — | indexes ready for materializer query | json-parse contract | `node -e "...firestore.indexes.json structural check..."` | ⬜ pending |
| 16-02 | T1 computeNextFireAt helper | 1 | CAL-16-12 | T-16-12, T-16-13, T-16-14 | DST-correct cadence computation | unit smoke (node) | `cd queuenight/functions && node -e "require + LA offset check"` | ⬜ pending |
| 16-02 | T2 smoke-series-cadence-compute.cjs | 1 | CAL-16-12 | T-16-12 | DST spring-forward + fall-back coverage; cross-tz; same-day-past wrap | unit smoke | `node scripts/smoke-series-cadence-compute.cjs` | ⬜ pending |
| 16-03 | T1 watchpartySeriesTick.js CF | 2 | CAL-16-03, CAL-16-04 | T-16-02, T-16-07, T-16-15, T-16-16 | deterministic wpId + idempotent set + advancement via pure helper | sentinel smoke | `node -e "...wstick content sentinels..."` (in plan 16-03 task 1 verify) | ⬜ pending |
| 16-03 | T2 index.js export | 2 | CAL-16-03 | — | CF deploy registration | runtime check | `cd queuenight/functions && node -e "require('./index.js'); typeof idx.watchpartySeriesTick"` | ⬜ pending |
| 16-03 | T3 smoke-series-materializer.cjs | 2 | CAL-16-03, CAL-16-04 | T-16-07 | CF + rules + indexes + helper presence verified | grep contract | `node scripts/smoke-series-materializer.cjs` (FLOOR=18 in plan 16-03; bumped to 27 in plan 16-04) | ⬜ pending |
| 16-03 | T4 smoke-series-idempotency.cjs | 2 | CAL-16-04 | T-16-07 | deterministic wpId has NO Date.now() / Math.random(); wpSnap.exists check present | negative grep contract | `node scripts/smoke-series-idempotency.cjs` (FLOOR=8) | ⬜ pending |
| 16-04 | T1 watchpartyTick reminder branch + NOTIFICATION_DEFAULTS key | 3 | CAL-16-05, CAL-16-06 | T-16-08, T-16-17, T-16-18, T-16-19 | T-30min reminder with in-doc flag + per-user pref gate + deterministic tag | sentinel smoke | `node -e "...index.js content checks..."` (in plan 16-04 task 1 verify) | ⬜ pending |
| 16-04 | T2 DEFAULT_NOTIFICATION_PREFS + LABELS in js/app.js | 3 | CAL-16-06 | T-16-17 | DR-3 client lockstep | parse-clean smoke | `node scripts/smoke-app-parse.cjs` | ⬜ pending |
| 16-04 | T3 smoke-series-materializer extension (DR-3 + reminder sentinels) | 3 | CAL-16-05, CAL-16-06 | T-16-08, T-16-17 | cross-repo lockstep enforced at deploy gate | grep contract | `node scripts/smoke-series-materializer.cjs` (FLOOR=27) | ⬜ pending |
| 16-05 | T1 app.html + css/app.css series-list-card | 4 | CAL-16-10 | T-16-20, T-16-21 | section + row styling shipped | grep contract | inline node -e content checks | ⬜ pending |
| 16-05 | T2 state.unsubSeries + renderSeriesListCard + handlers | 4 | CAL-16-10, CAL-16-13 | T-16-06, T-16-20, T-16-21, T-16-22 | subscription + renderer + lifecycle handlers; escapeHtml everywhere; teardown on sign-out | parse-clean smoke | `node scripts/smoke-app-parse.cjs` + inline grep checks | ⬜ pending |
| 16-06 | T1 series-create modal + cadence picker CSS | 5 | CAL-16-07, CAL-16-08 | — | modal shell + .cadence-day-pill 44px touch targets | grep contract | inline node -e content checks | ⬜ pending |
| 16-06 | T2 Tonight CTA + create handlers + TMDB search | 5 | CAL-16-07, CAL-16-08 | T-16-23, T-16-24, T-16-25, T-16-26 | client validation + escapeHtml + Auth gate; rules enforce shape | parse-clean smoke + grep | `node scripts/smoke-app-parse.cjs` + inline grep checks | ⬜ pending |
| 16-07 | T1 openSeriesEdit + saveSeriesEdit + titleType disable + Edit button | 6 | CAL-16-12 | T-16-09, T-16-27, T-16-28, T-16-29 | DOM-shared modal; titleType immutable; nextFireAt reset on save; close-handler resets mode | parse-clean smoke + grep | `node scripts/smoke-app-parse.cjs` + inline grep checks | ⬜ pending |
| 16-08 | T1 #wp-make-recurring-cta tile + openMakeRecurring + TV-only gate | 7 | CAL-16-09 | T-16-30, T-16-31, T-16-32 | tile only shown for t.kind === 'TV'; defensive cadence inference with fallback | parse-clean smoke + grep | `node scripts/smoke-app-parse.cjs` + inline grep checks | ⬜ pending |
| 16-09 | T1 week-view modal + CSS | 8 | CAL-16-11 | T-16-33 | greenfield calendar grid; 1-col mobile; today highlight | grep contract | inline node -e content checks | ⬜ pending |
| 16-09 | T2 openWeekView + renderWeekViewContent + shiftWeekView + tapWeekEvent | 8 | CAL-16-11 | T-16-33, T-16-34, T-16-35 | escapeHtml + bucket by day; navigate-on-tap | parse-clean smoke + grep | `node scripts/smoke-app-parse.cjs` + inline grep checks | ⬜ pending |
| 16-10 | T1 Phase 16 rules tests | 9 | CAL-16-01, CAL-16-02 | T-16-01..T-16-11 | 12+ describe cases for create/read/update/delete | rules emulator test | `cd tests && npm test` | ⬜ pending |
| 16-10 | T2 deploy.sh smoke registration + sw.js bump + 16-HUMAN-UAT.md scaffold | 9 | CAL-16-14 | T-16-36, T-16-37, T-16-38 | smoke gate enforces FLOOR + CACHE bump + UAT scripts documented | inline content checks | inline node -e checks | ⬜ pending |
| 16-10 | T3 REQUIREMENTS.md CAL-16-* backfill | 9 | — (documentation) | — | 15 IDs registered | grep contract | inline node -e check for all 15 IDs | ⬜ pending |
| 16-10 | T4 cross-repo deploy (CHECKPOINT) | 9 | CAL-16-14 | T-16-36, T-16-37, T-16-38 | ordered deploy: indexes → CFs → rules → hosting | manual + curl | checkpoint:human-verify; curl `https://couchtonight.app/sw.js` validates CACHE | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per research findings (RESEARCH.md § Wave 0 smoke gaps), Phase 16 introduces three new smoke contracts that must exist before any task touches the materializer CF, rules block, or cadence computation. **Plans 16-02 and 16-03 BUILD these contracts as part of normal execution** — Wave 0 is functionally complete after Wave 2 ships.

- [ ] `scripts/smoke-series-materializer.cjs` — shipped in plan 16-03 task 3 (FLOOR=18) and augmented in plan 16-04 task 3 (FLOOR=27)
- [ ] `scripts/smoke-series-idempotency.cjs` — shipped in plan 16-03 task 4 (FLOOR=8)
- [ ] `scripts/smoke-series-cadence-compute.cjs` — shipped in plan 16-02 task 2 (FLOOR=8); CRITICAL PATH: DST spring-forward + fall-back coverage

Existing infrastructure that Phase 16 builds on (already green):
- `tests/rules.test.js` Phase 27 + 28 + 30 rules tests (88+ passing per latest STATE.md) — Phase 16 adds new describe block in plan 16-10 task 1
- 13 existing smoke contracts (per Phase 28 deploy gate FLOOR=13)

After Phase 16 ships, smoke gate composition is:
- 13 existing contracts + 3 new Phase 16 contracts = 16 total
- Deploy aborts via `process.exit(1)` if any contract fails

---

## Manual-Only Verifications

These behaviors cannot be fully validated by automated tests and require device-UAT in `16-HUMAN-UAT.md` (scaffolded in plan 16-10 task 2):

| Behavior | Requirement | Why Manual | UAT Script |
|----------|-------------|------------|------------|
| Push notification arrives 30min before scheduled instance fires | CAL-16-05 | Real APNs/FCM delivery only verifiable on physical devices; emulator stubs APNS | Script 6 |
| Week-view visual rhythm at narrow viewport (375px) | CAL-16-11 | Layout judgement, not behavioral correctness | Script 5 |
| Cadence picker multi-day selection is touch-friendly | CAL-16-07 | Touch target validation requires real device | Script 1 |
| DST transition behavior for already-materialized future instances | CAL-16-04, CAL-16-12 | Real DST event needed to fully verify; emulator can't fake system clock cleanly | Script 7 (informational; next DST event) |
| In-place edit cadence change does NOT double-fire instances | CAL-16-12 | Multi-day window required to observe; emulator-fake-clock alternative documented | Script 3 + post-deploy monitoring |
| Entry 2 (Make recurring tile) appears for TV-only | CAL-16-09 | Requires running a TV wp + a movie wp + a sports wp through completion | Script 2 |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (planner populated table)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (each plan has at least one smoke check; smoke-app-parse runs after every js/app.js edit)
- [x] Wave 0 covers all MISSING references (3 new smoke contracts named above — shipped in plans 16-02 + 16-03 + augmented in 16-04)
- [x] No watch-mode flags
- [x] Feedback latency < 30s (full suite ≤ 30s per test-infra estimate)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution. /gsd-execute-phase 16 may proceed.
