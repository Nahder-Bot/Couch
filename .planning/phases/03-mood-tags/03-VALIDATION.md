---
phase: 3
slug: mood-tags
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-19
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | None — single-file vanilla HTML/JS, no build step, no test framework |
| **Config file** | none |
| **Quick run command** | Open `index.html` in browser, exercise changed surface |
| **Full suite command** | Manual end-to-end walkthrough of all 5 success criteria |
| **Estimated runtime** | ~10 minutes (manual) |

---

## Sampling Rate

- **After every task commit:** Open `index.html` in browser, exercise the changed surface
- **After every plan wave:** Full walkthrough of all 5 success criteria from CONTEXT.md
- **Before `/gsd-verify-work`:** All 5 success criteria must pass manually
- **Max feedback latency:** ~600 seconds (manual testing)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 1 | MOOD-01 | — | N/A | manual smoke | — | ❌ no test infra | ⬜ pending |
| 3-01-02 | 01 | 1 | MOOD-02 | T-3-01 | moodById(id) validates before write | manual integration | — | ❌ no test infra | ⬜ pending |
| 3-01-03 | 01 | 1 | MOOD-03 | — | N/A | manual integration | — | ❌ no test infra | ⬜ pending |
| 3-02-01 | 02 | 1 | MOOD-04 | — | N/A | manual real-time | — | ❌ no test infra | ⬜ pending |
| 3-02-02 | 02 | 1 | MOOD-05 | — | N/A | manual smoke | — | ❌ no test infra | ⬜ pending |
| 3-02-03 | 02 | 1 | MOOD-06 | — | N/A | manual integration | — | ❌ no test infra | ⬜ pending |
| 3-03-01 | 03 | 1 | MOOD-07 | — | N/A | manual smoke | — | ❌ no test infra | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

None — no test framework to install. Existing manual testing covers all phase requirements per the project's established pattern.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Moods visible in detail view | MOOD-01 | No test infra | Open title detail, verify mood chips render for a title with auto-suggested moods |
| Add mood from detail view | MOOD-02 | No test infra | Tap "+" in mood section, select a mood, verify it appears on the title |
| Remove mood from detail view | MOOD-03 | No test infra | Tap an existing mood chip to remove it, verify it disappears |
| Cross-device mood visibility within 2s | MOOD-04 | Requires 2 devices | Add mood on device A, verify it appears on device B within 2 seconds |
| Tonight filter mood control visible | MOOD-05 | No test infra | Open Tonight tab, verify mood filter toggle is present |
| Active moods narrow spin pool | MOOD-06 | No test infra | Select a mood filter, spin, verify result matches at least one selected mood |
| Active mood chips visible + clearable outside panel | MOOD-07 | No test infra | Select mood filter, close panel, verify chips appear below toggle with × buttons |

---

## Validation Sign-Off

- [ ] All tasks have manual verify instructions above
- [ ] All 7 MOOD-XX requirements mapped to at least one manual test
- [ ] No automated tests required (project has no test infrastructure)
- [ ] `nyquist_compliant: true` set in frontmatter when sign-off complete

**Approval:** pending
