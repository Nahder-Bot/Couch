---
phase: 04-veto-system
verified: 2026-04-20T00:00:00Z
status: passed
score: 6/6 requirements verified (statically); multi-tab UAT deferred
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Sequence A — Concurrent veto (two tabs veto different titles within 1s)"
    expected: "Both entries persist in session.vetoes (dotted-path mitigation); two docs in families/{code}/vetoHistory"
    why_human: "Requires live multi-tab Firestore console inspection; concurrency timing can't be staged statically"
  - test: "Sequence B — Daily cap (third veto attempt)"
    expected: "flashToast 'you've used both vetoes tonight' fires; modal does NOT open"
    why_human: "Requires live UI interaction and two real vetoes first"
  - test: "Sequence C — Undo within session"
    expected: "Session entry removed AND vetoHistory doc deleted (both paths)"
    why_human: "Requires Firestore console cross-check after live undo"
  - test: "Sequence D — VETO-01 pre-spin propagation"
    expected: "Tab A veto → title disappears from Tab B candidate list within 2s, surfaces under 'Vetoed tonight' divider on both"
    why_human: "Requires live real-time propagation timing test"
  - test: "Sequence E — Post-spin auto re-spin (VETO-02 happy path)"
    expected: "Pass on it → 400ms shimmer → re-spin lands on different title; spinnerId NOT rewritten for vetoer (Pitfall 2)"
    why_human: "Requires visual shimmer timing + Firestore spinnerId inspection"
  - test: "Sequence F — Fairness gate (VETO-06 D-06 / D-07 / D-08)"
    expected: "Vetoer Spin button disabled with tooltip; other member's is enabled; clears on next manual landing; solo session waives"
    why_human: "Requires multi-member family, DOM attribute inspection, and state.selectedMembers manipulation"
  - test: "Sequence G — Empty-pool mood relaxation and terminal empty-state (D-04)"
    expected: "Single-candidate mood + veto → auto re-spin relaxes inline + info toast; mood chip stays selected; full-empty pool renders 'Nothing left to spin — try clearing some filters' in spin modal"
    why_human: "Requires staging a narrow mood and exhausting the pool"
  - test: "Sequence H — Real-time toast on other devices (VETO-03 D-13 / D-14)"
    expected: "Bob vetoes → Alice sees 'Bob passed on X — spinning again…' within 2s; Bob sees no self-echo; if Alice's spin modal is open, shimmer applies"
    why_human: "Requires two live tabs and onSnapshot timing"
  - test: "Sequence I — Midnight rollover diff reset (Assumption A3)"
    expected: "Past-midnight reload → no spurious toasts from yesterday's vetoes; prevVetoKeys empty on fresh subscribe"
    why_human: "Requires time advance or midnight-crossing test session"
---

# Phase 4: Veto System Verification Report

**Phase Goal:** Any member can reject a pick — before the spin (removing a title from the pool) or after (triggering a re-spin) — with the veto propagating in real-time, carrying optional context, and respecting a fairness rule so the vetoer doesn't control the replacement.

**Verified:** 2026-04-20
**Status:** passed (static code verification — multi-tab live QA deferred to UAT)
**Re-verification:** No — initial verification

---

## Requirements Coverage

| Req     | Description                                                                 | Source Plan(s) | Status          | Static Evidence                                                                                                                                      |
| ------- | --------------------------------------------------------------------------- | -------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| VETO-01 | Pre-spin veto removes title from candidate pool for that session            | 04-01          | PASS            | `isVetoed(t.id)` filter in renderTonight at `js/app.js:2063`; `submitVeto` writes `vetoes.<id>` via `updateDoc` dotted-path at `js/app.js:5368`; real-time listener assigns `state.session = incoming` at `js/app.js:1544` → `renderTonight()` re-emits at `:1545` |
| VETO-02 | Post-spin veto triggers re-spin from remaining pool                          | 04-02          | PASS            | `.spin-veto` button injected in `showSpinResult` at `js/app.js:4564`; `submitVeto` branches on `vetoFromSpinResult` at `js/app.js:5382-5387` firing `showRespinShimmer()` + `setTimeout(spinPick({auto:true}), 400)`; `isVetoed` filter still applied via `getCurrentMatches` |
| VETO-03 | Real-time surfacing of who vetoed (and reason) on all family devices         | 04-03          | PASS            | `subscribeSession` at `js/app.js:1515-1547` diffs `prevVetoKeys` across snapshots; emits `flashToast("... passed on ... — spinning again…", {kind:'info'})` at `:1534`; self-echo guarded at `:1531`; first-snapshot flood suppressed at `:1527`; cross-device shimmer at `:1538`. `.tc-note.veto` card at `:2286` renders `memberName` + optional comment escaped via `escapeHtml` |
| VETO-04 | Veto carries optional reason (short text)                                    | 04-01          | PASS            | `submitVeto` reads `document.getElementById('veto-comment').value.trim().slice(0, 200)` at `js/app.js:5357`; comment persisted to both session entry (`baseEntry.comment`) and `vetoHistory` doc. Rendered with `escapeHtml` at `:2286`. 200-char cap enforced |
| VETO-05 | Vetoes recorded per-member for Year-in-Review                                | 04-01          | PASS            | `families/{code}/vetoHistory` subcollection wired via `vetoHistoryRef()` in `js/state.js:8`; `submitVeto` calls `addDoc(vetoHistoryRef(), {...baseEntry, titleId, titleName, sessionDate: todayKey()})` at `js/app.js:5370-5375`. Captures `memberId`, `memberName`, `at`, `sessionDate` — consumable by Phase 6 |
| VETO-06 | Vetoer cannot be the one to re-spin that same session (fairness)             | 04-02          | PASS            | `isFairnessLocked()` at `js/app.js:1069-1086` checks: `state.me` exists, `selectedMembers.length > 1` (D-08 solo waiver at `:1072`), member has latest veto, `latestMine > session.spinnerAt` (D-07). Tonight Spin button emits disabled variant with tooltip at `:2110-2114`. `showSpinResult` writes `spinnerId`/`spinnerAt` only when `!(meta && meta.auto)` at `js/app.js:4532-4534` — Pitfall 2 mitigated |

**All 6 VETO-* requirements are statically satisfied.** Multi-tab behavioral confirmation is captured in human_verification (UAT).

---

## Observable Truths

| # | Truth | Status | Evidence |
| - | ----- | ------ | -------- |
| 1 | Pre-spin veto disappears candidate on all devices within 2s | VERIFIED (static) / UAT timing | Filter at `:2063`; session onSnapshot listener re-renders on every mutation |
| 2 | Post-spin veto triggers re-spin from remaining pool within 2s | VERIFIED (static) / UAT timing | `fromSpinResult` branch at `:5384`; 400ms shimmer delay; `spinPick({auto:true})` call |
| 3 | Every veto event surfaces who + reason on all family devices real-time | VERIFIED (static) / UAT timing | Diff-based toast at `:1527-1540`; self-echo guard; comment rendered in `.tc-note.veto` at `:2286` |
| 4 | Vetoer is not selected as re-spinner for same session | VERIFIED | `isFairnessLocked()` + disabled emit path; auto branch skips spinnership write |
| 5 | Vetoes persist per-member to Firestore in Phase-6-consumable shape | VERIFIED | `vetoHistory` subcollection schema matches Year-in-Review prerequisites |

---

## Required Artifacts

| Artifact                  | Expected                                                          | Status | Details                                                                                          |
| ------------------------- | ----------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------ |
| `js/state.js`             | `vetoHistoryRef()` + `vetoHistoryDoc(id)` exports                  | PASS   | Lines 8-9; mirrors `membersRef`/`titlesRef` pattern                                              |
| `js/app.js` (Plan 01)     | Extended `submitVeto` + `unveto` + `myVetoesToday` + cap guard    | PASS   | Lines 1053-1067 (helpers), 5330-5413 (Veto block); imports on line 3                             |
| `js/app.js` (Plan 02)     | `.spin-veto` injection + `showRespinShimmer` + `isFairnessLocked` + opts-auto plumbing + empty-state | PASS | Lines 1069-1086, 2110-2114, 4450-4481, 4520, 4526-4534, 4564, 5332, 5382-5387 |
| `js/app.js` (Plan 03)     | Extended `subscribeSession` with `prevVetoKeys` diff + toast + cross-device shimmer | PASS | Lines 1512-1547                                                                                   |
| `css/app.css`             | `.spin-veto` + pseudos + `.t-spin.disabled`                       | PASS   | Lines 1336-1358                                                                                   |

---

## Key Link Verification

| From                                    | To                                                         | Via                                                        | Status | Details                                 |
| --------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------- | ------ | --------------------------------------- |
| `submitVeto`                            | Firestore `families/{code}/sessions/{date}`                | `updateDoc(sessionRef(), { ['vetoes.' + id]: entry })`     | WIRED  | `js/app.js:5368` (dotted-path — Pitfall 6 mitigated) |
| `submitVeto`                            | Firestore `families/{code}/vetoHistory`                    | `addDoc(vetoHistoryRef(), {...})`                           | WIRED  | `js/app.js:5370`                         |
| `unveto`                                | Firestore `families/{code}/vetoHistory/{id}`               | `deleteDoc(vetoHistoryDoc(id))`                             | WIRED  | `js/app.js:5408`                         |
| `showSpinResult` template               | `openVetoModal`                                            | `onclick="openVetoModal('${t.id}', {fromSpinResult: true})"` | WIRED  | `js/app.js:4564`                         |
| `submitVeto` (fromSpinResult branch)    | `spinPick({auto: true})`                                   | `setTimeout(..., 400)` after `showRespinShimmer`           | WIRED  | `js/app.js:5385-5386`                    |
| `spinPick` manual                       | session doc spinnerId/spinnerAt                            | `setDoc(sessionRef(), {spinnerId, spinnerAt}, {merge:true})` in `showSpinResult` guarded by `!meta.auto` | WIRED | `js/app.js:4532-4534` |
| `renderTonight` Spin button             | `isFairnessLocked()`                                       | conditional disabled emit                                  | WIRED  | `js/app.js:2110-2114`                    |
| `subscribeSession` onSnapshot           | `flashToast` (diff-based)                                  | per-snapshot key-diff against `prevVetoKeys`                | WIRED  | `js/app.js:1527-1540`                    |
| `subscribeSession`                      | `showRespinShimmer` (cross-device)                         | gated on `#spin-modal-bg.on`                                | WIRED  | `js/app.js:1536-1539`                    |

---

## Data-Flow Trace (Level 4)

| Artifact           | Data Variable              | Source                                        | Produces Real Data | Status  |
| ------------------ | -------------------------- | --------------------------------------------- | ------------------ | ------- |
| Vetoed-tonight UI  | `state.session.vetoes`     | `onSnapshot(sessionRef(...))` at `:1521-1546` | Yes (Firestore real-time) | FLOWING |
| `vetoHistory` write| `baseEntry` + title metadata | `state.me`, `state.titles.find`, `todayKey()` | Yes                | FLOWING |
| Fairness gate      | `state.session.spinnerAt` + `vetoes[*].at` | Firestore session doc                         | Yes (populated by `showSpinResult` + `submitVeto`) | FLOWING |
| Real-time toast    | `incoming.vetoes` via snapshot | Firestore onSnapshot                          | Yes                | FLOWING |
| `.tc-note.veto` comment | `vetoEntry.comment`   | `submitVeto` → `baseEntry.comment` (trimmed, sliced to 200) | Yes           | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| js/state.js parses and exports both helpers | `grep -cE "^export function vetoHistory" js/state.js` | 2 | PASS |
| `submitVeto` uses dotted-path updateDoc (Pitfall 6) | `grep -c "updateDoc(sessionRef(), { \['vetoes\." js/app.js` | 1 | PASS |
| `submitVeto` writes to vetoHistory | `grep -c "addDoc(vetoHistoryRef()" js/app.js` | 1 | PASS |
| `unveto` deletes history doc | `grep -c "deleteDoc(vetoHistoryDoc" js/app.js` | 1 | PASS |
| Auto re-spin call plumbed | `grep -c "spinPick({ auto: true })" js/app.js` | 1 | PASS |
| Spinnership guarded by auto flag | `grep -c "!(meta && meta.auto)" js/app.js` | 1 | PASS |
| Only one session onSnapshot (no duplicate listener) | `grep -c "onSnapshot(sessionRef" js/app.js` | 1 | PASS |
| `showRespinShimmer` called twice (submitVeto + subscribeSession) | `grep -c "showRespinShimmer()" js/app.js` | 2 | PASS |
| Empty-state copy present verbatim (UI-SPEC line 169) | `grep -c "Nothing left to spin — try clearing some filters" js/app.js` | 1 | PASS |
| CSS rules present | `grep -cE "^\.spin-veto \{\|^\.t-spin\.disabled \{" css/app.css` | 2 | PASS |
| Fairness solo waiver (D-08) | `grep -n "selectedMembers \|\| \[\]).length <= 1" js/app.js` | 1 | PASS |
| Cap copy (Plan 01) | `grep -c "you've used both vetoes tonight" js/app.js` | 1 | PASS |
| Cross-device shimmer trigger | `grep -c "bg.classList.contains('on')" js/app.js` | 1 in subscribeSession | PASS |
| Legacy veto-path alerts removed | `grep -cE "alert\('Could not save veto\|alert\('Could not undo veto\|You already used your veto" js/app.js` | 0 | PASS |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| —    | —    | None found in veto-path code | —       | No TODO/FIXME/placeholder/stub returns in any of the modified veto code |

A stray `alert('Join the group first.')` remains in `openVetoModal` at `js/app.js:5334`, but Plan 01 Task 2 explicitly calls this out as intentional scope exclusion ("tone change out of scope for this task"). Not a veto-goal blocker.

The fairness rule is explicitly declared a social rule, not a security boundary (T-04-08 accepted in Plan 02 threat model). A malicious client could hand-invoke `window.spinPick()` from console — this is acknowledged and acceptable per the family-trust model.

---

## Human Verification Required

Phase 4's primary behaviors (real-time propagation, multi-tab concurrency, fairness across members, midnight rollover, empty-pool staging) fundamentally require a live browser + Firestore setup. Static code verification confirms all wiring is correct; runtime confirmation is UAT work.

See `human_verification` in frontmatter for the 9 test sequences (A–I) mapping to the manual QA sequences already defined in each plan's `<verification>` section. These are deferred to UAT — they are NOT blocking gaps for this phase's goal-backward verification.

---

## Gaps Summary

**No static gaps found.** Every VETO-01..VETO-06 requirement maps to substantive code that is wired end-to-end:

- Plan 01's Firestore foundation (dotted-path concurrency safety, vetoHistory subcollection, daily cap, undo) is present and matches the planned shape exactly.
- Plan 02's post-spin veto UI + auto re-spin + fairness gate + D-04 empty-pool relaxation and terminal empty-state surface are all in place. The spinnership-write `!(meta && meta.auto)` gate correctly implements the Pitfall 2 mitigation.
- Plan 03's diff-based real-time toast reuses the existing `subscribeSession` listener (confirmed single `onSnapshot(sessionRef(...))` call site), correctly resets state on re-subscribe (Assumption A3), suppresses self-echo and subscribe-flood, and triggers the cross-device shimmer.
- CSS for `.spin-veto` and `.t-spin.disabled` is present and matches the plan verbatim.
- Anti-pattern scan found no TODO/FIXME/stub returns in any modified veto-path code.

The only items outstanding are the multi-tab live UAT sequences (A–I) captured in `human_verification` — these exercise timing, concurrency, cross-device, and midnight-rollover behaviors that are not testable statically. They are not gaps against the implementation — they are the final acceptance check before shipping.

---

## Overall Verdict

**PASS (static)** — Phase 4 delivers its stated goal. All 6 VETO-* requirements are substantively and correctly implemented in the codebase. Proceed to multi-tab UAT against sequences A–I before closing the phase for production.

---

_Verified: 2026-04-20_
_Verifier: Claude (gsd-verifier)_
