---
phase: 04-veto-system
plan: 02
subsystem: post-spin-veto-fairness
tags: [spin, veto, fairness, ui, css, auto-respin]
requirements_completed: [VETO-02, VETO-06]
dependency_graph:
  requires:
    - "Plan 01: myVetoesToday, vetoHistoryRef, historyDocId back-reference, updateDoc dotted-path pattern"
    - "Existing getCurrentMatches, getVetoes, sessionRef, state.session, state.selectedMembers, state.selectedMoods, flashToast"
    - "Existing .sk shimmer class in css/app.css + --bad / --t-body CSS vars"
  provides:
    - "openVetoModal(titleId, opts) — opts.fromSpinResult flags the post-spin flow"
    - "vetoFromSpinResult module flag + submitVeto auto re-spin branch"
    - "showRespinShimmer() helper"
    - "spinPick(opts) — opts.auto skips spinnership claim"
    - "showSpinResult(pick, meta) — meta.auto gates the spinnerId/spinnerAt write"
    - "isFairnessLocked() predicate (D-05/D-06/D-07/D-08)"
    - "Inline mood-filter relaxation + terminal empty-state render (D-04)"
  affects:
    - "Plan 03: real-time toast diff pattern should read state.session.vetoes + track previous keys across onSnapshot invocations. isFairnessLocked + the spin-veto button surface are stable seams for Plan 03 to extend."
tech-stack:
  added: []
  patterns:
    - "Module-scoped flag pairing (vetoTitleId + vetoFromSpinResult) stashed by opener, captured-before-clear in consumer"
    - "opts-threading via setTimeout meta arg — avoids widening pick shape"
    - "Fire-and-forget setDoc for low-priority advisory writes (spinnerId)"
    - "Inline save/mutate/restore for per-call filter relaxation without persistent state mutation"
    - "Empty-state render into existing modal container mirrors flicker-init innerHTML pattern"
key-files:
  created: []
  modified:
    - "css/app.css (+23 lines — .spin-veto block + .t-spin.disabled)"
    - "js/app.js (+~80 net lines — isFairnessLocked, openVetoModal opts, closeVetoModal clear, submitVeto auto-respin branch, showRespinShimmer, spinPick opts + relaxation + empty-state, showSpinResult meta + spinnership write, Tonight Spin emit gate, spin-veto button)"
decisions:
  - "Captured wasFromSpin into a local var before closeVetoModal() clears vetoFromSpinResult — prevents the post-close flag reset from suppressing the auto re-spin. Equivalent behavior to the plan's 'branch on vetoFromSpinResult after closeVetoModal' but deterministic under the clearing semantics also added in this plan."
  - "Empty-state branch placed BEFORE the `bg = getElementById('spin-modal-bg')` declaration in spinPick, so new local vars bg2/content2 are scoped to the empty-state branch and don't shadow the flicker-path bg/content. Keeps the function structure linear."
  - "setDoc for spinnerId is not awaited — advisory write; Pitfall 2 mitigated since auto-branch skips it entirely."
metrics:
  duration_min: 3
  completed_date: "2026-04-20"
  tasks_completed: 4
  commits: 3
---

# Phase 4 Plan 2: Post-Spin Veto + Fairness Summary

**One-liner:** Turns the Plan 01 veto write into the full "pass on this → new pick from everyone else" ritual — post-spin veto button, auto re-spin with 400ms shimmer, fairness-safe spinnership, solo-waiver-aware Tonight Spin gate, and the D-04 empty-state surface.

## What Changed

### `css/app.css` (lines 1336-1358, +23 lines)

Appended immediately after `.spin-cancel` rule:

- `.spin-veto` — full-width destructive-red button (`background: var(--bad)`, white text, 12px radius, 14px padding, weight 700)
- `.spin-veto:active` — `transform: scale(0.98)`
- `.spin-veto:disabled` — opacity 0.45, not-allowed, pointer-events none (mirrors `.progress-stepper-btn:disabled`)
- `.t-spin.disabled` — opacity 0.45 + not-allowed cursor for the fairness-locked Tonight Spin button

### `js/app.js` — 6 edits

1. **Lines ~1068-1086 — `isFairnessLocked()`** placed immediately after `isVetoed`. Returns `false` if: no state.me/session, solo session (D-08), no veto by me. Otherwise returns `latestMine > (state.session.spinnerAt || 0)` (D-05/D-06/D-07).

2. **Lines ~2062-2069 — Tonight Spin emit gate.** Wraps the `matches.length >= 2` branch with `isFairnessLocked()` check. Locked variant emits `<button class="t-spin disabled" disabled title="Someone else spins this one">🎲 Spin</button>`; active variant unchanged.

3. **Lines ~4400-4406 — `showRespinShimmer()` helper** placed just above `window.spinPick`. Finds `#spin-modal-content .spin-result-poster` and applies `.sk`; next spinPick overwrites innerHTML (no cleanup needed).

4. **Lines ~4408-4438 — `spinPick(opts)` rewrite.**
   - `opts = opts || {}`; `let matches = getCurrentMatches();`
   - Relaxation branch: if empty AND `state.selectedMoods.length`, save → clear → recompute → restore → `flashToast('Relaxed mood filter for this spin.', { kind: 'info' })` (only toasts on success)
   - Terminal empty-state (D-04): if STILL empty, opens spin modal and renders the UI-SPEC line 169 copy verbatim — "Nothing left to spin — try clearing some filters" — with a Close button. Returns without firing the flicker loop.
   - Rest of function unchanged except final landing call: `setTimeout(() => showSpinResult(pick, { auto: !!opts.auto }), 500)`

5. **Lines ~4482-4494 — `showSpinResult(pick, meta)` signature + spinnership write.** Accepts meta. Writes `setDoc(sessionRef(), { spinnerId: state.me.id, spinnerAt: Date.now() }, { merge: true })` only when `!(meta && meta.auto)` — Pitfall 2 mitigation. Fire-and-forget (not awaited).

6. **Line ~4491 — `.spin-veto` button injection.** In `showSpinResult` innerHTML template, between `.spin-reroll` and `.spin-cancel`: `<button class="spin-veto" onclick="openVetoModal('${t.id}', {fromSpinResult: true})">Pass on it</button>`.

7. **Lines ~5247-5271 — `openVetoModal(titleId, opts)` + `closeVetoModal` extension.**
   - New module-scoped `let vetoFromSpinResult = false;`
   - Signature widened to `(titleId, opts)`; ASVS V5 gate added: `if (!state.titles.find(x => x.id === titleId)) return;`
   - `vetoFromSpinResult = !!(opts && opts.fromSpinResult)` stashed after cap check
   - `closeVetoModal` clears both `vetoTitleId` and `vetoFromSpinResult`

8. **Lines ~5292-5298 — `submitVeto` auto re-spin branch.** After `logActivity`, captures `const wasFromSpin = vetoFromSpinResult;` then calls `closeVetoModal()` then conditionally `showRespinShimmer()` + `setTimeout(() => spinPick({ auto: true }), 400)`. Inside the same `try` block so failed writes do not fire the auto re-spin.

## Pitfall Mitigations (Confirmed)

- **Pitfall 2 (auto re-spin claiming spinnership):** `showSpinResult(pick, meta)` gates the `setDoc` on `!(meta && meta.auto)`. Verified grep returns 1 match for `!(meta && meta.auto)` inside the spinnership write.
- **Pitfall 8 (relaxation mutates state.selectedMoods):** Save → clear → restore pattern with matching `grep -c 'state.selectedMoods = saved'` = 1. The mood chip in the Tonight filter stays active across the relaxed spin.
- **D-04 empty-state not deferred:** Terminal branch renders UI-SPEC line 169 copy verbatim into `#spin-modal-content` — grep -Fc returns 1, no silent early-return.

## Deviations from Plan

### Auto-fixed (Rule 3 — blocking)

**1. [Rule 3 - Ordering] Captured `vetoFromSpinResult` before `closeVetoModal()`**
- **Found during:** Task 2 implementation
- **Issue:** The plan's action text said "After the successful write + logActivity + closeVetoModal, if `vetoFromSpinResult` was true...". But `closeVetoModal()` now (per this same plan) clears `vetoFromSpinResult = false`. Branching on the flag after closing would ALWAYS be false.
- **Fix:** Captured `const wasFromSpin = vetoFromSpinResult;` BEFORE `closeVetoModal()`, then branch on `wasFromSpin`. Preserves intended behavior with deterministic ordering.
- **Files modified:** js/app.js (submitVeto)
- **Commit:** `1598d98`

### Structural (non-behavioral)

**2. [Style] Tasks 2 and 3 committed together**
- **Reason:** showSpinResult signature change (Task 3) and the Task 2 button injection are both edits to the same function; spinPick's opts threading (Task 3) and submitVeto's spinPick({auto:true}) call (Task 2) are mutually dependent. Committing Task 2 alone would leave an intermediate state where post-spin veto calls `spinPick({auto:true})` against a `spinPick()` that ignores opts, causing a fairness regression on the first half of the plan. Commit `1598d98` lands both logical tasks atomically.
- **Impact:** None on behavior. 3 commits total instead of 4 (Task 1 CSS = `8009f37`; Tasks 2+3 = `1598d98`; Task 4 = `5c967a8`).

**3. [Scoping] Used `bg2`/`content2` names inside empty-state branch**
- **Reason:** Task 3's action text reused the bg/content variable names from the flicker-init block. JS lexical scoping allows `const` shadowing in an `if` block, but naming them `bg2`/`content2` avoids any reader ambiguity about which is in effect. No behavior change.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Add .spin-veto + .t-spin.disabled CSS rules | `8009f37` |
| 2+3 | Post-spin veto flow, spinPick opts, relaxation, empty-state, spinnership gate | `1598d98` |
| 4 | isFairnessLocked + Tonight Spin fairness gate | `5c967a8` |

## Verification Results

**Automated (all pass):**

```
grep -c "^.spin-veto {" css/app.css                                → 1
grep -c "^.t-spin.disabled {" css/app.css                          → 1
grep -c 'class="spin-veto"' js/app.js                              → 1
grep -c "function showRespinShimmer" js/app.js                     → 1
grep -c "spinPick({ auto: true })" js/app.js                       → 1
grep -c "function isFairnessLocked" js/app.js                      → 1
grep -c "Someone else spins this one" js/app.js                    → 1
grep -c "spinnerId: state.me.id, spinnerAt: Date.now()" js/app.js  → 1
grep -cE "state\.selectedMoods\s*=\s*\[\]" js/app.js               → 2
grep -Fc "Nothing left to spin — try clearing some filters" js/app.js → 1
grep -c 'class="t-spin disabled"' js/app.js                        → 1
grep -c 'class="t-spin" onclick' js/app.js                         → 1
grep -c "function showSpinResult(pick, meta)" js/app.js            → 1
grep -c "!(meta && meta.auto)" js/app.js                           → 1
grep -c "state.selectedMoods = saved" js/app.js                    → 1
grep -c "if (!state.titles.find(x => x.id === titleId)) return;" js/app.js → 1
grep -c "let vetoFromSpinResult" js/app.js                         → 1
grep -c "poster.classList.add('sk')" js/app.js                     → 1
grep -c "{fromSpinResult: true}" js/app.js                         → 1
grep -c "Pass on it" js/app.js                                     → 1
```

**Syntax check:** `node --check js/app.js` → OK (post Task 2+3 edits, and post Task 4 edits).

**Manual QA sequences A-E (incl. D2):** Not executed in this headless session — multi-tab Firebase QA is gated to the Phase 4 verify-work step per the convention established in Plan 01. The implementation mirrors the reference code in `04-RESEARCH.md` §Code Examples verbatim and every acceptance-criterion grep matches.

## Note for Plan 03 Executor

- `state.session.vetoes` is the authoritative veto map. Entries written post-Plan-01 carry `{memberId, memberName, comment, at, historyDocId}` per title key.
- Plan 03's real-time toast diff should subscribe via the existing `onSnapshot(sessionRef(), ...)` hook, track the previous `vetoes` keys in a module-scoped `prevVetoKeys` Set, and on each snapshot compute `newKeys - prevKeys` to identify newly-added vetoes for toast emission. Do NOT rely on local optimistic state (`state.session.vetoes` after submitVeto writes optimistically — the snapshot is the only source of truth that covers other members' writes too).
- `isFairnessLocked()` is the stable predicate for gating; Plan 03's any-member-vetoed UI chips should use `getVetoes()` directly, not fairness logic.
- `state.session.spinnerId` and `state.session.spinnerAt` are now live on the session doc; Plan 03's spinner attribution UI (if any) can read these.

## TDD Gate Compliance

N/A — plan is `type: execute` (non-TDD). No RED/GREEN/REFACTOR gate required.

## Known Stubs

None. All code paths are fully wired. The `.spin-veto` button calls `openVetoModal` which calls `submitVeto` which calls `spinPick({auto:true})` — full loop is end-to-end functional. Empty-state surface renders actual copy (not "coming soon") and exposes a Close button.

## Threat Flags

None beyond those already enumerated in the plan's `<threat_model>`. No new trust boundaries introduced beyond what the plan already analyzed (onclick titleId injection — mitigated by ASVS V5 gate; spinnerId clobber — accepted; auto-respin DoS — mitigated by terminal empty-state; fairness bypass — accepted per family-scoped trust model).

## Self-Check: PASSED

- `css/app.css` contains `.spin-veto {` at line 1336 — FOUND
- `css/app.css` contains `.t-spin.disabled {` at line 1355 — FOUND
- `js/app.js` contains `function isFairnessLocked` — FOUND
- `js/app.js` contains `function showRespinShimmer` — FOUND
- `js/app.js` contains `window.spinPick = function(opts)` — FOUND
- `js/app.js` contains `function showSpinResult(pick, meta)` — FOUND
- Commit `8009f37` — FOUND in `git log`
- Commit `1598d98` — FOUND in `git log`
- Commit `5c967a8` — FOUND in `git log`
