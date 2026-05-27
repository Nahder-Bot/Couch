---
phase: 16
slug: calendar-layer
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-27
---

# Phase 16 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node smoke contracts (`scripts/smoke-*.cjs`) + Firestore rules emulator (`tests/rules.test.js`, Jest) |
| **Config file** | `package.json` (npm scripts), `tests/firebase.json` (rules emulator), `firebase.json` (functions) |
| **Quick run command** | `node scripts/smoke-<specific>.cjs` (~50-100ms each) |
| **Full suite command** | `npm run smoke && cd tests && npm test` (~5s smoke + ~20s rules tests) |
| **Estimated runtime** | ~5s smoke contracts, ~20s rules tests, ~30s total for full suite |

---

## Sampling Rate

- **After every task commit:** Run the smoke contract(s) relevant to the task (e.g., `node scripts/smoke-series-materializer.cjs` after touching `watchpartySeriesTick`)
- **After every plan wave:** Run `npm run smoke` (all 13+ contracts including new Phase 16 ones)
- **Before `/gsd-verify-work`:** Full suite (smoke + rules tests) must be green
- **Max feedback latency:** ~5 seconds per smoke contract, ~30s for full suite

---

## Per-Task Verification Map

> **Populated by the planner during plan creation.** Each task row maps to a CAL-16-XX requirement and a verification command. The planner agent fills this table as it writes the 10 PLAN.md files; the executor agent runs the commands at each task commit per the sampling rate above.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD by planner | | | | | | | | | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Per research findings (RESEARCH.md § Wave 0 smoke gaps), Phase 16 introduces three new smoke contracts that must exist before any task touches the materializer CF, rules block, or cadence computation:

- [ ] `scripts/smoke-series-materializer.cjs` — production-code sentinels for `watchpartySeriesTick` CF (deterministic wpId pattern, memberUids fan-out, seriesId back-reference on instantiated wp doc)
- [ ] `scripts/smoke-series-idempotency.cjs` — verifies the deterministic wpId pattern (`series_{seriesId}_{instanceDateKey}`) is referenced at the materializer call site so double-instantiation is provably blocked at the Firestore document-id layer
- [ ] `scripts/smoke-series-cadence-compute.cjs` — DST critical-path coverage: `computeNextFireAt()` produces correct local-time results across spring-forward + fall-back transitions in `America/Los_Angeles` and `America/New_York` (per RESEARCH.md DST landmine analysis). This is the highest-risk contract — DST bugs are silent until 2x per year and easy to miss in code review.

Existing infrastructure that Phase 16 builds on (already green):
- `tests/rules.test.js` Phase 27 + Phase 28 rules tests (88+ passing per latest STATE.md) — Phase 16 adds new describe blocks for `watchpartySeries` + `picks_reminders`-style series-reminder idempotency doc
- 13 existing smoke contracts (per Phase 28 deploy gate FLOOR=13)

After Wave 0 ships, smoke FLOOR becomes 16 (3 new + 13 existing). The Phase 16 deploy will fail-fast at `scripts/deploy.sh` if any of the new contracts regress.

---

## Manual-Only Verifications

These behaviors cannot be fully validated by automated tests and require device-UAT in `16-HUMAN-UAT.md`:

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Push notification arrives 30min before scheduled instance fires | CAL-16-* (seriesReminder push) | Real APNs/FCM delivery only verifiable on physical devices; emulator stubs APNS | Schedule a test series 31min in future, confirm push lands at T-30min on iPhone PWA + Android Chrome PWA |
| Week-view visual rhythm at narrow viewport (375px) | CAL-16-* (week-view UI) | Layout judgement, not behavioral correctness | iOS Safari PWA at iPhone SE width; verify no horizontal scroll, day columns readable, time labels not clipped |
| Cadence picker multi-day selection is touch-friendly | CAL-16-* (cadence picker) | Touch target validation requires real device | Tap 7 day checkboxes in succession on iPhone PWA; verify no missed taps, visual feedback consistent |
| DST transition behavior for already-materialized future instances | CAL-16-* (timezone) | Real DST event needed to fully verify; emulator can't fake system clock cleanly | Document expected behavior in HUMAN-UAT; manually verify at next DST event OR force-set device clock to a DST boundary |
| In-place edit cadence change does NOT double-fire instances | CAL-16-* (edit safety) | Multi-day window required to observe; emulator-fake-clock alternative documented | Edit a series at T+0; verify only one instance fires at T+next-eligible-day |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills table)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (planner enforces)
- [ ] Wave 0 covers all MISSING references (3 new smoke contracts named above)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s (full suite)
- [ ] `nyquist_compliant: true` set in frontmatter after planner populates per-task table

**Approval:** pending (awaiting planner to populate per-task verification map)
