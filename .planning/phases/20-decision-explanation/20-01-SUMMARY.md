---
phase: 20-decision-explanation
plan: "01"
subsystem: frontend-helper + smoke-infrastructure
tags: [pure-function, smoke-contract, decision-explanation, phase-20]
dependency_graph:
  requires: []
  provides:
    - buildMatchExplanation pure helper in js/app.js
    - scripts/smoke-decision-explanation.cjs (15 assertions)
    - deploy.sh 5th smoke gate
    - package.json smoke chain (5 contracts)
  affects:
    - js/app.js (helper insertion at module top ~line 112)
    - scripts/deploy.sh (§2.5 5th smoke if-block)
    - package.json (smoke chain + new entry)
tech_stack:
  added: []
  patterns:
    - Pure helper at module top (mirrors getEffectiveTierCap Phase 19 pattern)
    - Self-contained CJS smoke contract (mirrors smoke-kid-mode.cjs pattern)
    - deploy.sh if-file-exists smoke gate (5th in §2.5 chain)
key_files:
  created:
    - scripts/smoke-decision-explanation.cjs
  modified:
    - js/app.js
    - scripts/deploy.sh
    - package.json
decisions:
  - "Voter phrase 2-of-N fix: '{Name1} + {Name2} said yes' only when exactly 2 couch members AND both yes-voted; 2-of-3+ falls through to '{count} of you said yes' (A5 contract)"
  - "Smoke mirror takes explicit `members` 4th arg instead of reading state.members — keeps smoke pure and testable without global state"
  - "escapeHtml applied to all member name interpolations per T-20-01 XSS mitigation"
  - "Runtime 0 guarded same as null per RESEARCH Pitfall 5"
metrics:
  duration: ~15 minutes
  completed: "2026-04-30"
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
---

# Phase 20 Plan 01: Decision Explanation — Helper + Smoke Infrastructure Summary

**One-liner:** Pure `buildMatchExplanation(t, couchMemberIds, opts)` helper at js/app.js module top with 15-assertion smoke contract; wired into deploy.sh §2.5 and npm run smoke chain.

## Objective Recap

Land the testable nucleus of Phase 20: the pure-function core helper and Wave 0 validation infrastructure. After this plan, the helper is live in source, regression-locked by 15 smoke assertions, and gated on every deploy.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Insert buildMatchExplanation pure helper in js/app.js at module top | `9b2c1f7` | js/app.js |
| 2 | Create scripts/smoke-decision-explanation.cjs (15 assertions, self-contained) | `98358b8` | scripts/smoke-decision-explanation.cjs, js/app.js (voter-phrase fix) |
| 3 | Wire smoke contract into scripts/deploy.sh §2.5 + package.json scripts | `cc0bb6f` | scripts/deploy.sh, package.json |

## Key Files Created / Modified

- `js/app.js` — `buildMatchExplanation(t, couchMemberIds, opts)` declared at line 112, immediately after `getEffectiveTierCap` (line 97-99). Zero state mutations. Uses `escapeHtml` for all member name interpolations (T-20-01). Guards runtime 0 same as null.
- `scripts/smoke-decision-explanation.cjs` — 195-line self-contained CJS smoke. Inlines BRAND_MAP (8 entries) and escapeHtml stub. Mirror takes `(t, couchMemberIds, members, opts)` — explicit members arg avoids state.members dependency. 15/15 assertions pass in ~50ms.
- `scripts/deploy.sh` — 5th `if [ -f scripts/smoke-decision-explanation.cjs ]` block in §2.5 after kid-mode block. Echo updated to include `+ decision-explanation`.
- `package.json` — `"smoke"` chain extended with `&& node scripts/smoke-decision-explanation.cjs`. New `"smoke:decision-explanation"` entry as final scripts key.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed voter-phrase 2-of-N branch condition**
- **Found during:** Task 2 (smoke run A5 failed)
- **Issue:** The `yesVoters.length === 2` branch fired before the `couchMemberIds.length` check, so 2-of-3 couch returned `"Nahder + Zoey said yes"` instead of `"2 of you said yes"`. The plan's assertion A5 contracts `"2 of you said yes"` for this case.
- **Fix:** Changed condition to `yesVoters.length === 2 && yesVoters.length === couchMemberIds.length` so the name-pair format only fires when those 2 voters ARE the entire couch; otherwise falls through to the `"{count} of you said yes"` branch.
- **Files modified:** `js/app.js` (helper), `scripts/smoke-decision-explanation.cjs` (mirror)
- **Commit:** `98358b8`

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes. Phase 20 is purely additive read-only display. T-20-01 (member name XSS) mitigated via `escapeHtml()` at every name interpolation site in the helper.

## Wave 1 Verification Chain Results

All 6 gates passed:

| Gate | Command | Result |
|------|---------|--------|
| 1 | `node --check js/app.js` | PASS |
| 2 | `grep -c "^function buildMatchExplanation" js/app.js` | 1 |
| 3 | `node scripts/smoke-decision-explanation.cjs` | 15/15, exit 0 |
| 4 | `bash -n scripts/deploy.sh` | PASS |
| 5 | `node -e "require('./package.json')"` | PASS |
| 6 | `npm run smoke` | 5 contracts green, exit 0 |

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `js/app.js` exists | FOUND |
| `scripts/smoke-decision-explanation.cjs` exists | FOUND |
| `scripts/deploy.sh` exists | FOUND |
| `package.json` exists | FOUND |
| `.planning/phases/20-decision-explanation/20-01-SUMMARY.md` exists | FOUND |
| commit `9b2c1f7` (feat: helper) | FOUND |
| commit `98358b8` (test: smoke contract) | FOUND |
| commit `cc0bb6f` (chore: wiring) | FOUND |
| `npm run smoke` exit 0, 5 contracts green | PASS |
