# Phase 30 Hotfix Wave 5C — CR-10 Stale memberUids Cleanup

**Date:** 2026-05-03
**Repo:** queuenight (Cloud Functions)
**Finding:** CR-10 (Phase 30 cross-cutting review) — stale `memberUids[]` retention enables post-leave eavesdropping window on top-level wps.

## Problem

Phase 30 introduced `wp.memberUids[]` as the read gate for top-level `/watchparties/{wpId}`:

```
// firestore.rules:142
allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
```

`memberUids[]` is snapshotted at:

1. wp-create time (host's family members)
2. `addFamilyToWp` time (cross-family expansion → other family's members appended)

There was **no cleanup path** when:

1. A member leaves a family (`window.leaveFamily` in `couch/js/app.js:4035`)
2. A member is removed by the family owner
3. A member's `uid` field changes (e.g., re-claim flow post Phase 5 auth)

**Result:** an ex-member retained real-time read+update access to wps from their former family for the wp's full ~25h archive lifecycle. For long-scheduled wps (e.g., next Sunday's game scheduled now, member leaves tonight), they got a multi-day eavesdropping window.

## Fix

New v1 Firestore-trigger CF in `queuenight/functions/src/onMemberDelete.js`. Fires on `families/{familyCode}/members/{memberId}` doc-delete; reads the `uid` off the deleted snapshot; runs a `collectionGroup('watchparties').where('memberUids', 'array-contains', staleUid)` scan; `arrayRemove`s the stale uid from each matching top-level wp via batched updates.

## Design Rationale

- **v1 API not v2.** v1 onDelete document-trigger is the simplest signature for this single-doc-per-event use case. v2's `onDocumentDeleted` would also work but the team's other doc-triggers (`onWatchpartyCreate`, `onTitleApproval`) still use v1 for the nested paths, so v1 keeps the pattern uniform here. The v2 migration that's already in flight is scoped to top-level `/watchparties/{wpId}` triggers (`onWatchpartyCreateTopLevel` / `onWatchpartyUpdateTopLevel`); member-doc triggers are out of scope for that migration.
- **No composite index needed.** Firestore auto-indexes single-field `array-contains` predicates. The collection-group scope is automatic for any indexed field.
- **Top-level only.** The collection-group query also returns hits from legacy nested wps at `families/{code}/watchparties/{wpId}`, but those have a different read gate (family membership, not memberUids). The CF skips them by inspecting `wpDoc.ref.path` and only acting on 2-segment paths starting with `watchparties/`.
- **Best-effort, no rethrow.** The member-delete itself has already happened by the time this fires; the cleanup is purely defensive. A throw would trigger v1's retry-on-failure semantics, which could produce duplicate scrub work but no extra correctness. Silent log + continue is preferred — the wp's natural archive (~25h post startAt) is the safety-net upper bound.
- **Skip already-archived wps.** Two short-circuits: (a) `status === 'archived' || 'cancelled'`, (b) `Date.now() - startAt > 25h`. Saves writes on wps that were already past their effective read-window. This is purely a write-cost optimization; correctness is unaffected since rules already deny reads on archived wps via separate gates.
- **Batch chunking.** Firestore batches max at 500 ops. Threshold set at 450 to leave headroom for any defensive double-counting. After commit, a fresh `db.batch()` is allocated (Firestore batches are not reusable post-commit).

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Member doc has no `uid` (legacy / orphan) | Log + skip cleanup. No-op. |
| Member's `uid` is non-string | Same — typeof guard. |
| Member belongs to multiple families with the same uid (re-claim) | Each member-doc delete triggers independently. Each scrubs only the wps that family-A's wp-create snapshotted. Correct: leaving family-A revokes family-A wp access; family-B membership remains. |
| Cross-family wp where staleUid was added via `addFamilyToWp` | Caught by the same array-contains scan. Removed from all wps that ever included them, regardless of which family added them. |
| Wp already past archive | Skipped (write-cost optimization). |
| 500+ matching wps for a single uid | Batch is committed + re-initialized at every 450 ops; final partial batch committed at end. |
| `addFamilyToWp` happens AFTER member-delete (race) | Out of scope — `addFamilyToWp` should already validate member-doc existence at call time. If a stale `uid` somehow re-enters memberUids post-delete, this CF won't catch it (it only fires on the delete event itself). Mitigated by `addFamilyToWp`'s own member-fetch which returns 0 members for the deleted user. |
| CF throws mid-scan | Log to Sentry; member delete is unaffected. wp's natural 25h archive is the upper-bound safety net. |

## Files

- **New:** `queuenight/functions/src/onMemberDelete.js` (84 lines)
- **Modified:** `queuenight/functions/index.js` (+4 lines, single export block in the Phase 30 section)

## Commits

```
1632f38 feat(security): onMemberDelete CF cleans stale memberUids from top-level wps (CR-10)
c103d09 chore: export onMemberDelete from functions/index.js
```

## Deploy-Time Verification Recipe

1. `cd queuenight && firebase deploy --only functions:onMemberDelete --project queuenight-84044`
2. Confirm in Cloud Functions console that `onMemberDelete` is listed as a Firestore trigger on `families/{familyCode}/members/{memberId}` onDelete.
3. **End-to-end smoke (production-safe):**
   - As host, create a test wp (`startAt` = +1 day, status `scheduled`).
   - Add a test guest-member to your family (or use an existing throwaway member).
   - Open the wp in another browser as the test member; confirm read access.
   - Note the test member's `uid`.
   - As host, remove the test member from the family (or have the test member leave via `window.leaveFamily()`).
   - Within ~5s, in Firebase console → Firestore → `/watchparties/{wpId}`, confirm `memberUids[]` no longer contains the test member's `uid`.
   - Refresh the test member's browser — wp read should now be denied (rule:142 array-membership check fails).
4. **Log inspection:** `firebase functions:log --only onMemberDelete` should show `[onMemberDelete] family=... member=... uid=... scanned=N scrubbed=M` for each delete event.
5. **Negative case:** delete a member with no `uid` field — logs should show `no uid on deleted member; skip cleanup` and no Firestore writes.
6. **Bulk case (manual / staging only):** create a member, schedule 3-5 wps spanning multiple days, delete the member, confirm all 3-5 wps had the uid scrubbed and any already-past-archive wps were correctly skipped (visible in `scanned` vs `scrubbed` log delta).

## Out-of-Scope / Follow-ups

- **`uid` change without delete** (Phase 5 re-claim flow): if a member's `uid` field is updated in-place rather than the doc being deleted+recreated, this CF won't fire. Not currently a known flow, but if Phase 5 introduces one, it'd need a sibling `onMemberUpdate` CF that diffs `before.uid` vs `after.uid`. Tracked as a forward-looking concern, not blocking CR-10.
- **Backfill for already-leaked wps:** any wps that currently have stale memberUids from leaves that happened pre-CF will not be retroactively scrubbed. Their natural 25h archive is the bound. A one-time `wpMigrate`-style admin script could fix the long-tail, but the leak window for currently-live wps is bounded so it's deferred.
- **Front-end leaveFamily UX:** unchanged. The leak fix is server-side only; clients see no behavior change.
