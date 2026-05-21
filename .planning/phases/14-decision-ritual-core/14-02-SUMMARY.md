---
phase: 14-decision-ritual-core
plan: 02
plan-name: Queue polish + Add-tab insertion verify + iOS DnD UAT (D-03 / DECI-14-03 — DR-2 reframed)
requirements_addressed: [DECI-14-03]
status: complete
completed: 2026-04-25
ship_state: SHIPPED — Tasks 1+2 code-complete and committed; Task 3 iOS Safari touch-DnD UAT DEFERRED to a later batch UAT pass
followup_tag: "iOS DnD UAT deferred — recap before v34 production deploy"
commits:
  - hash: 2e1ca4b
    type: feat
    msg: "feat(14-02): add Yes-vote queue-add discoverability toast in applyVote"
    files: [js/app.js]
    repo: couch
  - hash: 2b670d2
    type: feat
    msg: "feat(14-02): wire Add-tab insertion paths to populate state.me's queue"
    files: [js/app.js]
    repo: couch
files-touched:
  created: []
  modified:
    - js/app.js  # Task 1: applyVote toast extension (+6 lines @ 12477-12483); Task 2: createTitleWithApprovalCheck addToMyQueue opt-in + 4 user-Add caller migrations (+23/-5)
deviations: 0
checkpoints-hit: 1   # Task 3 — resolved with skip-uat (deferred)
auth-gates-hit: 0
---

# Phase 14 Plan 02: Queue polish + Add-tab insertion verify + iOS DnD UAT Summary

D-03's queue-polish trio shipped per the DR-2 reframe — the existing
per-member queue infrastructure (`queues` map at js/app.js:12340-ish,
drag-reorder at js/app.js:4664, persist at js/app.js:4648, reindex at
js/app.js:6834) was NOT rebuilt. Two correctness/discoverability gaps were
closed in code, and the third item (iOS Safari touch-DnD UAT) was
explicitly DEFERRED to a later batch UAT pass — drag-reorder is
pre-existing shipped behavior that this plan did not modify, so testing
it now vs. later does not change anything functionally.

## What shipped

### Task 1 — applyVote discoverability toast (commit 2e1ca4b)

**Location:** `js/app.js:12477-12483` — inserted immediately after the
`queues[memberId] = memberQueueLen + 1` write inside the `applyVote`
queue-sync block.

```js
// D-03 (DECI-14-03 / Anti-pattern #5) — surface the silent queue mutation to the actor.
// Guard: only toast when the local user is the actor; onSnapshot-driven updates from other
// members' votes would otherwise spam the local UI with toasts about their queue changes.
if (newVote === 'yes' && !wasInQueue && memberId === (state.me && state.me.id)) {
  flashToast(`Added "${t.name}" to your queue`, { kind: 'info' });
}
```

**Threat T-14.02-01 mitigated** — the actor-identity guard
(`memberId === state.me.id`) blocks the toast for every non-actor case,
so a family member's Yes vote arriving via `onSnapshot` does not surface
a toast on the local user's device.

**Out-of-scope confirmation** — no parallel toast was added for the
No → remove-from-queue branch (D-03 only specifies discoverability for
the Yes auto-add path; toasting removals would be chatty and
unsurprising).

### Task 2 — Add-tab insertion path audit + fix (commit 2b670d2)

**Audit finding:** the canonical Firestore-write wrapper for new title
docs is `createTitleWithApprovalCheck` (js/app.js:5322-ish). Its
pre-Phase-14 payload included `votes`, `watched`, `addedBy`, `addedAt`,
and other core fields, but did NOT seed `queues[state.me.id]`. The
followup-Yes-vote-on-add path the plan flagged as a possible escape hatch
**does not exist** in any of the user-Add call paths — the Add flows
write the title doc and return without seeding a Yes vote. The audit
therefore concluded **the gap was real** and Task 2 fix was applied.

**Fix shape — opts.addToMyQueue (default false) on the wrapper:**

```js
// === D-03 Add-tab insertion (DECI-14-03) ===
// opts.addToMyQueue (default false): when true, the new title is appended to the BOTTOM
// of state.me's personal queue at create time (queues[state.me.id] = currentQueueLen + 1).
// Caller-opt-in keeps bulk-import paths (Trakt sync, Couch Nights packs, first-run seed)
// from auto-populating the actor's queue.
async function createTitleWithApprovalCheck(id, payload, opts = {}) {
  // ... existing approval-check branches preserved verbatim ...
  if (opts.addToMyQueue && state.me) {
    const myQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[state.me.id] != null).length;
    payload.queues = { ...(payload.queues || {}), [state.me.id]: myQueueLen + 1 };
  }
  // ... existing setDoc preserved verbatim ...
}
```

**Title-creation call-site enumeration (per `<verify>` plan block):**

| File:line             | Caller                       | Surface                              | Disposition |
|-----------------------|------------------------------|--------------------------------------|-------------|
| `js/app.js:5587`      | `addToLibrary`               | Add-tab search "+ Pull up"           | **Modified — passes `{ addToMyQueue: true }`** |
| `js/app.js:5632`      | `submitManualAdd`            | Add-tab manual-entry modal           | **Modified — passes `{ addToMyQueue: true }`** |
| `js/app.js:6563`      | `addSimilar`                 | Detail-modal "more like this"        | **Modified — passes `{ addToMyQueue: true }`** (treated as user-driven Add) |
| `js/app.js:11020`     | `addFromAddTab`              | Add-tab discovery row "+ Pull up"    | **Modified — passes `{ addToMyQueue: true }`** |
| `js/app.js:825`       | `trakt.createTitleFromTrakt` | Trakt watch-history sync             | NOT modified — bulk import (privacy regression to populate queues) |
| `js/app.js:11289`     | `seedBallotFromPack`         | Couch Nights pack expand             | NOT modified — bulk import |
| `js/app.js:11757`     | `finishOnboarding`           | First-run seed pack                  | NOT modified — bulk import |

Each modified call site carries the comment marker
`// === D-03 Add-tab insertion (DECI-14-03) ===` for greppable audit
trail.

**Threat T-14.02-02 mitigated** — the wrapper writes only to
`queues[state.me.id]` (never `queues[someoneElse.id]`); foreign-memberId
writes are impossible by construction.

### Task 3 — iOS Safari touch-DnD UAT (DEFERRED — `skip-uat` resume signal)

**Deferral was a deliberate choice, not an oversight.** The user opted to
defer iOS Safari touch-DnD verification on the existing
`attachQueueDragReorder` (js/app.js:4664) to a batch UAT pass once all of
Phase 14 is in. Rationale:

1. Drag-reorder is **pre-existing shipped behavior** — Plan 14-02 did
   not modify the DnD handler, the persist function, the reindex
   function, or the Library `myqueue` filter gate. Whatever the iOS
   Safari touch-DnD does today is what it has always done since the
   primitive shipped pre-Phase-14.
2. Testing it now (mid-phase) vs. later (Phase 14 batch UAT) does not
   change anything functionally — no code path in 14-02 depends on the
   UAT outcome.
3. The plan's `<resume-signal>` block explicitly enumerates `skip-uat`
   as a valid resolution: *"defer iOS UAT to a later session. SUMMARY.md
   records the deferral as a known gap; Task 3 closes with conditional
   approval."*

**Documented fallback if the batch UAT later finds touch-DnD broken on
iOS Safari:** load Sortable.js via CDN —
`<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js">`
in `app.html`, then replace the body of `attachQueueDragReorder`
(js/app.js:4664) with Sortable bindings against the same
`.full-queue-row` class. This swap is the documented contingency; the
plan's `<resume-signal>` block specifies it as the failure-path
follow-up. Captured here as a follow-up note rather than as a separate
14-02-FOLLOWUP.md file (the failure has not occurred yet — the swap
remains a contingent plan stub).

**UAT remains valid** and **must run before Phase 14 ships to v34
production deploy** — it is recorded in STATE.md "Open follow-ups" so
the v34 deploy gate cannot be missed.

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `grep -c "Added \\\"" js/app.js` | ≥1 | **1 ✓** (Task 1 toast literal at js/app.js:12482) |
| `grep -c "memberId === (state.me && state.me.id)" js/app.js` | ≥1 | **1 ✓** (Task 1 actor guard at js/app.js:12481) |
| Task 2 SUMMARY enumerates every title-creation call site with disposition | yes | **yes ✓** (table above — 4 modified user-Add paths, 3 NOT-modified bulk-import paths) |
| Task 3 checkpoint resolved with one of {passed, failed, skip-uat} | one | **skip-uat ✓** (deferred per user decision; documented above + tracked in STATE.md follow-ups) |

## Success criteria (per plan `<success_criteria>`)

1. ✓ applyVote surfaces a flashToast for state.me's Yes-vote queue
   auto-add; does NOT toast for other members' votes (actor-identity
   guard verified).
2. ✓ Add-tab insertion path verified end-to-end: new titles land in
   state.me's queue at the bottom via the wrapper's `addToMyQueue`
   opt-in; all 4 user-Add call sites pass the flag (3 bulk-import paths
   intentionally not modified for the privacy reasons spelled out in the
   plan).
3. ◐ iOS Safari touch-DnD UAT — DEFERRED (resolved via the plan's
   explicit `skip-uat` path; recorded in STATE.md follow-ups; must run
   before v34 production deploy; documented Sortable.js fallback if it
   fails).
4. ✓ Existing queue infrastructure (queues map, attachQueueDragReorder,
   persistQueueOrder, reindexMyQueue) NOT rebuilt — DR-2 polish-only
   invariant holds. Task 1 added 6 lines of new code; Task 2 added 23
   lines and removed 5; zero lines of existing queue infrastructure
   were touched.

## Deviations from plan

None. The plan was well-specified, the codebase analogs landed cleanly,
and Task 3 was resolved via the plan's explicit `skip-uat` resume
signal — itself a documented closure path, not a deviation.

## Authentication gates

None.

## Threat surface scan

The threat register in 14-02-PLAN.md (T-14.02-01 + T-14.02-02) is fully
mitigated by the actor-identity guard (Task 1) and the
state.me-only-queues-write invariant of the wrapper (Task 2). No
additional threat surface introduced.

## Known stubs

None. The toast surfaces real data (the actor's own Yes-vote-driven
queue addition), and the wrapper writes real per-member queue ranks
into the title doc at create time.

## Open follow-ups for downstream plans

- **iOS Safari touch-DnD UAT** — deferred from this plan's Task 3.
  Tracked in STATE.md "Open follow-ups" as a HUMAN-VERIFY item.
  **Must run before Phase 14 ships to v34 production deploy.** If the
  UAT finds touch-DnD broken, swap to Sortable.js via CDN per the
  fallback documented above; the swap itself is out of scope for this
  plan.
- **14-09 (sw.js bump)** — when the v34 CACHE bump happens at the end
  of Phase 14 per DECI-14-13, the Yes-vote toast + Add-tab queue
  insertion will reach installed PWAs.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-02-SUMMARY.md ]` → FOUND (this file)
- Commit `2e1ca4b` in `git log --oneline` → FOUND
- Commit `2b670d2` in `git log --oneline` → FOUND
