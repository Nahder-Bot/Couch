---
phase: 04-veto-system
plan: 01
subsystem: veto-data-layer
tags: [firestore, veto, subcollection, persistence, concurrent-writes]
requirements_completed: [VETO-01, VETO-04, VETO-05]
dependency_graph:
  requires:
    - "js/firebase.js exports (collection, doc, updateDoc, addDoc, deleteDoc, setDoc)"
    - "js/state.js state object + familyCode"
    - "js/utils.js flashToast"
    - "Existing sessionRef/todayKey helpers at app.js:1046-1051"
  provides:
    - "state.vetoHistoryRef() — CollectionReference to families/{code}/vetoHistory"
    - "state.vetoHistoryDoc(id) — DocumentReference to families/{code}/vetoHistory/{id}"
    - "myVetoesToday() — array of my session vetoes"
    - "myVetoToday() — compat alias (first-match-or-null)"
    - "submitVeto writes concurrent-safe + vetoHistory doc + historyDocId back-reference"
    - "unveto deletes session key AND matching vetoHistory doc with same-session gate"
  affects:
    - "Plans 02 + 03 rely on state.session.vetoes[titleId].historyDocId being reliably present post-Plan-01"
tech-stack:
  added:
    - "Firestore subcollection families/{code}/vetoHistory (auto-id docs)"
  patterns:
    - "updateDoc dotted-path for map-key writes (Pitfall 6 mitigation)"
    - "Optimistic local state update before onSnapshot broadcast (Pitfall 1)"
    - "flashToast warn-tone replaces legacy alert() in veto code paths"
key-files:
  created: []
  modified:
    - "js/state.js (+2 lines — new exports)"
    - "js/app.js (+41 net lines — import, myVetoesToday, openVetoModal cap, submitVeto, unveto)"
decisions:
  - "Two-write historyDocId persistence (first updateDoc, then addDoc, then second updateDoc for historyDocId back-ref) — intentional because auto-id is not known until addDoc resolves"
  - "v.sessionDate gate in unveto is belt-and-suspenders — primary defense is the session re-subscription at midnight returning empty vetoes map (existing guard)"
metrics:
  duration_min: 8
  completed_date: "2026-04-20"
  tasks_completed: 3
  commits: 3
---

# Phase 4 Plan 1: Veto Data Layer Summary

**One-liner:** Firestore schema extension for veto persistence — new `vetoHistory` subcollection, concurrent-write-safe dotted-path session writes, daily cap of 2 with warm-tone toasts, same-session undo with history cleanup.

## What Changed

### `js/state.js` (2 lines added, position 8-9)

Appended after `familyDocRef`:

```js
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
```

Mirrors the existing `membersRef` / `titlesRef` / `familyDocRef` one-liner convention verbatim.

### `js/app.js` — 4 edits

1. **Line 3 — import extension.** Added `vetoHistoryRef, vetoHistoryDoc` to the state.js import list.
2. **Lines ~1053-1067 — `myVetoToday` → `myVetoesToday` + compat alias.** New primary helper returns an array; `myVetoToday()` preserved as `arr[0] || null` for the Tonight inline note (line 2059) and action sheet (line 7369) callers which remain untouched.
3. **Lines ~5240-5253 — `openVetoModal` cap guard.** Legacy `alert()` removed; now `myVetoesToday().length >= 2` triggers `flashToast("you've used both vetoes tonight", { kind: 'warn' })` and early-returns.
4. **Lines ~5259-5311 — `submitVeto` + `unveto` rewrite.**
   - `submitVeto` now writes via `updateDoc(sessionRef(), { ['vetoes.' + vetoTitleId]: baseEntry })` (Pitfall 6 defense), then `addDoc(vetoHistoryRef(), { ...baseEntry, titleId, titleName, sessionDate: todayKey() })`, optimistically updates `state.session.vetoes[vetoTitleId]` with the returned `historyDocId`, then does a second `updateDoc` to persist the `historyDocId` back into the session map so post-reload unveto works.
   - `unveto` now deletes both the session key and (when present) the `vetoHistory` doc. A `v.sessionDate !== state.sessionDate` check refuses cross-midnight undo with `flashToast('this veto is locked', { kind: 'warn' })`. Both error paths use `flashToast` instead of `alert()`.

## Firestore State Before / After

**Before:**
- `families/{code}/sessions/{date}.vetoes = { [titleId]: { memberId, memberName, comment, at } }` (set via `setDoc({merge:true})` — **not concurrent-safe**)
- No veto history outside the session doc (wiped on midnight refresh)

**After:**
- `families/{code}/sessions/{date}.vetoes.{titleId} = { memberId, memberName, comment, at, historyDocId }` (written via `updateDoc` dotted path — concurrent-safe)
- `families/{code}/vetoHistory/{autoId} = { memberId, memberName, comment, at, titleId, titleName, sessionDate }` (append-only; persists across midnight for VETO-05 / YEAR-04)

## Note for Plan 02 Executor

`state.session.vetoes[titleId].historyDocId` is **reliably present on all session veto entries written post-Plan-01**. Plan 02's auto-respin and toast-diff logic can safely read it. Any pre-Plan-01 vetoes (unlikely — session doc resets at midnight) would lack the field and the `if (v.historyDocId)` guard in `unveto` handles that case.

## Deviations from Plan

None. The action blocks were executed verbatim. The only noted implementation detail (two-write `historyDocId` persistence) was explicitly called out in the plan's Step 2 note and implemented as specified.

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | Add vetoHistory Firestore ref helpers | `3c7eb99` |
| 2 | Bump veto cap to 2 with myVetoesToday array helper | `e04eb28` |
| 3 | Persist veto history + concurrent-safe session writes | `70ef938` |

## Verification Results

**Automated grep acceptance (all pass):**
- `grep -c "export function vetoHistoryRef" js/state.js` → 1
- `grep -c "export function vetoHistoryDoc" js/state.js` → 1
- `grep -c "function myVetoesToday" js/app.js` → 1
- `grep -c "function myVetoToday" js/app.js` → 1 (compat alias retained)
- `grep -c "addDoc(vetoHistoryRef()" js/app.js` → 1
- `grep -cE "updateDoc\(sessionRef\(\), \{ \['vetoes\." js/app.js` → 2 (primary write + historyDocId back-ref)
- `grep -c "deleteDoc(vetoHistoryDoc" js/app.js` → 1
- `grep -c "you've used both vetoes tonight" js/app.js` → 1
- `grep -c "alert('Could not save veto" js/app.js` → 0
- `grep -c "alert('Could not undo veto" js/app.js` → 0
- `grep -c "You already used your veto tonight" js/app.js` → 0
- `grep -c "sessionDate: todayKey()" js/app.js` → 1
- `grep -c "historyDocId" js/app.js` → 5 (import usage + two writes + optimistic update + unveto read/delete)

**Syntax check:**
- `node --check js/state.js` → OK
- `node --check js/app.js` → OK

**Manual QA sequences (A-D):** Not executed in this headless session — the executor flagged these as required multi-tab browser tests with a live Firebase console. **These are gated to the human verifier at the Phase 4 verify-work step.** All grep-checkable acceptance criteria are satisfied; the logic mirrors the reference implementation in `04-RESEARCH.md` §Code Examples verbatim.

## TDD Gate Compliance

N/A — plan is `type: execute` (non-TDD). No RED/GREEN/REFACTOR gate required.

## Known Stubs

None. All new code paths are fully wired to Firestore and local state.

## Threat Flags

None. All trust-boundary surface is within the existing `families/{code}/**` Firestore security scope. No new network endpoints, no new render surface, no new inline-onclick handlers.

## Self-Check: PASSED

- `js/state.js` export lines 8-9 — FOUND
- `js/app.js` import of vetoHistoryRef/vetoHistoryDoc on line 3 — FOUND
- Commit `3c7eb99` — FOUND in `git log`
- Commit `e04eb28` — FOUND in `git log`
- Commit `70ef938` — FOUND in `git log`
