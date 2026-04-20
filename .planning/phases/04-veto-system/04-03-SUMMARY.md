---
phase: 04-veto-system
plan: 03
subsystem: real-time-veto-propagation
tags: [real-time, onSnapshot, toast, shimmer, diff]
requirements_completed: [VETO-03]
dependency_graph:
  requires:
    - "Plan 01: state.session.vetoes shape {memberId, memberName, comment, at, historyDocId}"
    - "Plan 02: showRespinShimmer() helper, #spin-modal-bg.on class gate"
    - "Existing subscribeSession, onSnapshot, sessionRef, flashToast, renderTonight, state.me, state.titles"
  provides:
    - "Module-scoped prevVetoKeys Set + vetoSubscribeIsFirstSnapshot flag"
    - "Extended subscribeSession that emits flashToast on net-new OTHER-member vetoes"
    - "Cross-device shimmer trigger when observing device has spin modal open"
  affects:
    - "Completes VETO-03 — final Wave of Phase 4. /gsd-verify-work can now confirm all 6 VETO-* reqs end-to-end."
tech-stack:
  added: []
  patterns:
    - "Snapshot-diff with module-scoped previous-keys Set (reset on re-subscribe)"
    - "First-snapshot suppression flag (baseline vs delta separation on subscribe)"
    - "Self-echo guard via memberId === state.me.id comparison"
    - "Observer-local DOM gate (#spin-modal-bg.on) to trigger visual on receiving device only"
key-files:
  created: []
  modified:
    - "js/app.js (+29 lines, -1 line — prevVetoKeys + vetoSubscribeIsFirstSnapshot decl, rewritten subscribeSession body)"
decisions:
  - "Reset prevVetoKeys and vetoSubscribeIsFirstSnapshot INSIDE subscribeSession (not module-init only) so midnight re-subscribe via scheduleMidnightRefresh gets clean diff state — mitigates Assumption A3."
  - "Capture incoming once per snapshot, then assign state.session = incoming AFTER diff processing — keeps the diff pass referencing the same object the render will read."
  - "Self-echo guard uses `v.memberId === (state.me && state.me.id)` (not just `state.me.id`) to survive the brief window between page load and state.me assignment."
metrics:
  duration_min: 2
  completed_date: "2026-04-20"
  tasks_completed: 1
  commits: 1
---

# Phase 4 Plan 3: Real-Time Veto Propagation Summary

**One-liner:** Extends the existing session onSnapshot callback with a veto-keys diff that emits warm toasts on every OTHER device and shimmers any open spin modal — completing VETO-03 without adding a second Firestore listener.

## What Changed

### `js/app.js` — 1 edit

**Lines 1512-1547 — prevVetoKeys + vetoSubscribeIsFirstSnapshot + rewritten subscribeSession:**

- Line 1512: `let prevVetoKeys = new Set();` (module scope, above subscribeSession)
- Line 1513: `let vetoSubscribeIsFirstSnapshot = true;` (module scope)
- Lines 1515-1547: rewritten subscribeSession:
  - Preserves existing cleanup of prior listener (`if (state.unsubSession) { state.unsubSession(); ... }`)
  - Lines 1518-1519: reset `prevVetoKeys = new Set()` and `vetoSubscribeIsFirstSnapshot = true` BEFORE onSnapshot (A3)
  - Line 1520: `state.sessionDate = todayKey();` (unchanged)
  - Lines 1521-1546: onSnapshot callback:
    - Captures `incoming` once, builds `incomingKeys` Set from `Object.keys(incoming.vetoes || {})`
    - First-snapshot guard (`if (!vetoSubscribeIsFirstSnapshot)`) skips the diff pass on initial subscribe
    - For each new key: skips if seen in prev, skips on self-echo, resolves titleName via `state.titles.find`, emits `flashToast` with the D-13 format (`"{memberName} passed on {titleName} — spinning again…"`, kind info)
    - Observer-local shimmer gate: if `#spin-modal-bg` exists and has class `on`, calls `showRespinShimmer()`
    - `prevVetoKeys = incomingKeys` + `vetoSubscribeIsFirstSnapshot = false` (state advances)
    - `state.session = incoming` + `renderTonight()` — existing behavior preserved

No other files modified. No new listener — the single `onSnapshot(sessionRef(...), ...)` call count remains 1.

## Pitfall / Assumption Mitigations (Confirmed)

- **A3 (midnight-leak of stale veto keys):** `prevVetoKeys` and `vetoSubscribeIsFirstSnapshot` are reset at the top of every `subscribeSession` call. `scheduleMidnightRefresh` (js/app.js:1553) calls `subscribeSession()` at local midnight, which now produces a clean diff.
- **Flood-on-subscribe:** `vetoSubscribeIsFirstSnapshot` gate ensures the initial snapshot after (re-)subscribe emits no toasts — the state is the baseline, not a delta.
- **Self-echo (vetoer toasts themselves):** `v.memberId === (state.me && state.me.id)` skip preserved.
- **XSS via memberName/titleName (T-04-12):** `flashToast` writes via `toast.textContent` (utils.js:27) — inherently safe.
- **Toast flood DoS (T-04-14):** `flashToast` caps visible toasts to 3 (utils.js:30) — flood visually bounded.

## Deviations from Plan

None. The plan's action text was implemented verbatim (module-scoped decls + rewritten subscribeSession body, exact string literals for the toast copy including the em-dash and ellipsis).

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | prevVetoKeys diff + flashToast + shimmer gate in subscribeSession | `f46cf0d` |

## Verification Results

**Automated grep (all pass):**

```
grep -c "let prevVetoKeys" js/app.js                          → 1
grep -c "vetoSubscribeIsFirstSnapshot" js/app.js              → 3  (decl at 1513, reset at 1519, flip at 1543)
grep -c "onSnapshot(sessionRef" js/app.js                     → 1  (NO new listener)
grep -c "showRespinShimmer()" js/app.js                       → 2  (Plan 02 submitVeto line 5385 + Plan 03 subscribeSession line 1538)
grep -Fc "' passed on '" js/app.js                            → 1
grep -Fc "' — spinning again…'" js/app.js                     → 1
grep -c "bg.classList.contains('on')" js/app.js               → 1  (line 1537)
grep -c "prevVetoKeys = incomingKeys" js/app.js               → 1
grep -c "v.memberId === (state.me && state.me.id)" js/app.js  → 1
grep -c "state.session = incoming" js/app.js                  → 1
```

**Syntax check:** `node --check js/app.js` → OK.

**Manual QA Sequences A–F:** Not executed in this headless session — multi-tab Firebase QA is gated to `/gsd-verify-work` per the convention established in Plans 01 and 02. The implementation mirrors the reference code in `04-RESEARCH.md` §Code Examples verbatim and every acceptance-criterion grep matches.

## Readiness for `/gsd-verify-work`

Phase 4 is now code-complete. All 6 VETO-* requirements are demonstrable end-to-end via Sequence F in the PLAN's `<verification>` block:

- **VETO-01** (pre-spin veto removes title from pool) — Plan 01
- **VETO-02** (post-spin auto re-spin with shimmer) — Plan 02
- **VETO-03** (real-time who-vetoed toast + cross-device shimmer) — **this plan**
- **VETO-04** (optional veto comment captured in vetoHistory) — Plan 01
- **VETO-05** (vetoHistory subcollection per family/sessionDate) — Plan 01
- **VETO-06** (fairness lock — one-veto-per-spinner per spin) — Plan 02

All wiring is live on the single `onSnapshot(sessionRef, ...)` subscription; no new listeners, no backend changes, no CSS touched.

## TDD Gate Compliance

N/A — plan is `type: execute` (non-TDD). No RED/GREEN/REFACTOR gate required.

## Known Stubs

None. The diff logic reads directly from the snapshot, resolves titleName from the live `state.titles` array, and emits live toasts. No hardcoded placeholder values anywhere in the changed lines.

## Threat Flags

None beyond those enumerated in the plan's `<threat_model>` (T-04-12 through T-04-15 all mitigated or accepted per the matrix).

## Self-Check: PASSED

- `js/app.js` contains `let prevVetoKeys = new Set();` at line 1512 — FOUND
- `js/app.js` contains `let vetoSubscribeIsFirstSnapshot = true;` at line 1513 — FOUND
- `js/app.js` toast literal at line 1534 contains `passed on` + em-dash + `spinning again…` — FOUND
- `js/app.js` showRespinShimmer() call at line 1538 (inside bg.classList.contains('on') guard) — FOUND
- Commit `f46cf0d` — FOUND in `git log` (verified via `git log --oneline -1`)
- `onSnapshot(sessionRef` grep count is exactly 1 — FOUND (no duplicate listener)
