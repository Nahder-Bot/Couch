---
phase: 20
slug: decision-explanation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 20 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `20-RESEARCH.md` § Validation Architecture (lines 635-672).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node.js plain (no test runner) — matches existing smoke contracts |
| **Config file** | None — `'use strict'` + inline `check()` harness |
| **Quick run command** | `node scripts/smoke-decision-explanation.cjs` |
| **Full suite command** | `npm run smoke` (chains all 5 contracts: tonight-matches + availability + kid-mode + positionToSeconds + decision-explanation) |
| **Estimated runtime** | ~300 ms (matches Phase 18/19 smoke runtimes) |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-decision-explanation.cjs` (or `npm run smoke:decision-explanation` once package.json wired)
- **After every plan wave:** Run `npm run smoke` (all 5 contracts)
- **Before `/gsd-verify-work`:** Full suite must be green AND `node --check js/app.js` passes (syntax gate)
- **Max feedback latency:** ~5 seconds (smoke) / ~5 seconds (full chain — all contracts are sub-second)

---

## Per-Task Verification Map

> Plan/Task IDs are placeholders (planner owns final IDs). REQ-IDs sourced from RESEARCH.md § "Phase Requirements → Test Map" rows REQ-20-01 through REQ-20-11.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 20-01-01 | 01 | 1 | REQ-20-01 | — | Helper is pure (no state mutation, returns string) | unit | `node scripts/smoke-decision-explanation.cjs` (A1-A2) | ❌ W0 | ⬜ pending |
| 20-01-02 | 01 | 1 | REQ-20-02 | — | Voter phrase covers 1 / 2 / 3+ / all couch (D-03) | unit | smoke A3-A6 | ❌ W0 | ⬜ pending |
| 20-01-03 | 01 | 1 | REQ-20-03 | — | Provider phrase uses m.services intersection + fallback (D-04) | unit | smoke A7-A9 | ❌ W0 | ⬜ pending |
| 20-01-04 | 01 | 1 | REQ-20-04 | — | Runtime phrase ≥60min "{H} hr {M} min" / else "{M} min" / null skipped (D-05) | unit | smoke A10-A12 | ❌ W0 | ⬜ pending |
| 20-01-05 | 01 | 1 | REQ-20-05 | — | Cap ≤ 3 phrases with voters > provider > runtime priority (D-06) | unit | smoke A13-A14 | ❌ W0 | ⬜ pending |
| 20-01-06 | 01 | 1 | REQ-20-06 | — | Considerable variant uses "Some of you said yes" 1-of-N (D-10) | unit | smoke A15 | ❌ W0 | ⬜ pending |
| 20-02-01 | 02 | 2 | REQ-20-07 | — | Spin-pick result modal shows italic serif sub-line (D-07) | manual UAT | Visual + `node --check js/app.js` | ❌ | ⬜ pending |
| 20-02-02 | 02 | 2 | REQ-20-08 | — | Match card dim footer rendered always (D-08); considerable variant in considerable list | manual UAT | Visual on Tonight surface | ❌ | ⬜ pending |
| 20-02-03 | 02 | 2 | REQ-20-09 | — | Detail-modal "Why this is in your matches" section appears only when t.id ∈ matches (D-09) | manual UAT | Visual + Library-open negative case | ❌ | ⬜ pending |
| 20-03-01 | 03 | 3 | REQ-20-10 | — | sw.js CACHE = `couch-v36.2-decision-explanation` (D-17) | curl | `curl -s https://couchtonight.app/sw.js \| grep -c "couch-v36.2-decision-explanation"` returns 1 | ❌ | ⬜ pending |
| 20-03-02 | 03 | 3 | REQ-20-11 | — | `npm run smoke` chains all 5 contracts green | integration | `npm run smoke` exit 0 | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · W0 = file produced in Wave 0*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-decision-explanation.cjs` — pure-function contract, ~15 assertions covering REQ-20-01..REQ-20-06 (mirror `scripts/smoke-kid-mode.cjs` shape since helper is self-contained — no cross-repo require)
- [ ] `scripts/deploy.sh` § 2.5 — 5th `if [ -f scripts/smoke-decision-explanation.cjs ]` block + updated echo line
- [ ] `package.json` — `"smoke:decision-explanation": "node scripts/smoke-decision-explanation.cjs"` script entry + extended `"smoke"` chain

*Existing infrastructure (`'use strict'` + inline `check()` harness) is reused — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Spin-pick result italic serif sub-line renders below picked title name | REQ-20-07 | DOM rendered post-state-mutation; cannot snapshot-test without headless browser | Open Tonight → trigger spin → confirm explanation line visible in italic Instrument Serif under title |
| Tonight matches list dim-text footer renders on every card | REQ-20-08 | Same — requires live state with ≥1 voted title | Open Tonight matches → confirm footer visible on each card; switch to considerable list and confirm "Some of you said yes" variant shows |
| Detail modal "Why this is in your matches" section appears only when t.id is in matches | REQ-20-09 | Conditional render depends on live matches list state | Open detail modal from matches list → section visible. Then open same title from Library or History → section absent |
| Cross-device visual review of all 3 surfaces | REQ-20-07/08/09 | Visual fidelity (italic Instrument Serif, dim color tokens) requires real browser + iOS PWA | iPhone Safari + Android Chrome quick walkthrough on couchtonight.app post-deploy |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify (all unit tasks have direct smoke assertions; manual UATs are clustered in Wave 2 and isolated by REQ)
- [ ] Wave 0 covers all MISSING references (smoke contract + deploy.sh wiring + package.json)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter (set by planner once Wave 0 tasks confirmed)

**Approval:** pending (locks once 20-01 plan finalizes Wave 0 task IDs)
