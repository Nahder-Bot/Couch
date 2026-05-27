---
phase: 16-calendar-layer
plan: 01
subsystem: database
tags: [firestore, security-rules, composite-indexes, watchpartySeries]

# Dependency graph
requires:
  - phase: 30-couch-groups
    provides: top-level /watchparties/{wpId} match-block pattern (memberUids array-contains read-gate, host/non-host write split, soft-delete-only)
provides:
  - top-level /watchpartySeries/{seriesId} security-rules block (create/read/update/delete branches)
  - 2 composite indexes for watchpartySeries (materializer query + Account-tab list query)
affects: [16-02-cadence-helper, 16-03-materializer-cf, 16-04-reminder-push, 16-05-account-tab-list, 16-06-tonight-cta, 16-07-edit-modal, 16-08-post-wp-prompt, 16-09-week-view, 16-10-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 30 top-level wp memberUids-gated read pattern, reused verbatim for series read gate"
    - "Phase 30 create-time familyCode-existence gate via users/{uid}/groups/{familyCode} index"
    - "Phase 15.1 SEC-15-1-02 memberId regex anchor '^m_[A-Za-z0-9_-]+$' reused on createdBy + memberId + managedMemberId fields"
    - "Phase 15.1 affectedKeys().hasOnly([...]) allowlist pattern reused for non-creator/CF-bypass update scoping"
    - "Soft-delete via status='ended' (mirrors Phase 30 CDX-4 hard-delete denial)"
    - "queryScope=COLLECTION (NOT COLLECTION_GROUP) for single-tier top-level collection — divergence from watchparties which retained legacy nested path"

key-files:
  created: []
  modified:
    - firestore.rules
    - firestore.indexes.json

key-decisions:
  - "queryScope=COLLECTION not COLLECTION_GROUP for watchpartySeries indexes — single-tier top-level collection with no nested counterpart (PATTERNS D15.2 divergence from watchparties)"
  - "Insert series rules block at the database-level (siblings of /watchparties/{wpId}), not inside /families/{familyCode} — top-level collection per Phase 30 architecture"
  - "Trust planner's deferral of firebase rules-test + deploy validation to Wave 4 / plan 16-10 — this plan is local commits only"

patterns-established:
  - "Series block sits at lines 988-1045 in firestore.rules, immediately after the families closing brace and before the database-documents closing brace (sibling of top-level /watchparties/ block)"
  - "Series indexes appended to firestore.indexes.json indexes[] after picks entry (entries 3 + 4 in the array)"

requirements-completed: [CAL-16-01, CAL-16-02, CAL-16-15]

# Metrics
duration: 2min
completed: 2026-05-27
---

# Phase 16 Plan 01: Firestore Primitive (rules + indexes) Summary

**Locked the watchpartySeries top-level Firestore security boundary + 2 composite indexes (materializer query + Account-tab list query) — the foundation block all subsequent Phase 16 plans build on.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-27T23:41:35Z
- **Completed:** 2026-05-27T23:43:49Z
- **Tasks:** 2 / 2
- **Files modified:** 2

## Accomplishments

- Top-level `/watchpartySeries/{seriesId}` security-rules block with all 4 branches (read / create / update / delete) inserted at firestore.rules lines 988-1045, sibling of the Phase 30 `/watchparties/{wpId}` block — memberUids-gated read, creator-only mutations, immutable titleType, soft-delete-only.
- 2 composite indexes appended to firestore.indexes.json: `(status ASC, nextFireAt ASC)` for the watchpartySeriesTick materializer CF query (Wave 3 / plan 16-03), and `(familyCode ASC, status ASC, nextFireAt ASC)` for the Account-tab list view (Wave 5 / plan 16-05). Both use `queryScope=COLLECTION` per PATTERNS D15.2.
- All 6 threat-model mitigations encoded at the rules layer in a single atomic write: T-16-01 (Spoofing — createdByUid==uid + familyCode-membership exists()), T-16-04 (InfoDisclosure — memberUids read-gate), T-16-06 (Elevation — creator-only update), T-16-09 (Tampering titleType — immutability invariant on update), T-16-10 (Tampering hard-delete — `allow delete: if false`), T-16-11 (InputValidation bypass — daysOfWeek bounds + timeOfDay HH:MM regex + timezone non-empty + titleType enum).

## Task Commits

Each task was committed atomically:

1. **Task 1: Append watchpartySeries match block to firestore.rules** — `a0a0072` (feat)
2. **Task 2: Add 2 composite indexes for watchpartySeries to firestore.indexes.json** — `a9729e4` (feat)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Files Created/Modified

- `firestore.rules` — appended 59-line `match /watchpartySeries/{seriesId}` block at lines 988-1045 (top-level, sibling of `/watchparties/{wpId}` at line 160). 4 branches: read (memberUids gate), create (10-clause shape + identity validation), update (creator-only + affectedKeys allowlist + titleType immutability), delete (denied).
- `firestore.indexes.json` — appended 2 new entries to `indexes[]` (now 4 total): `watchpartySeries (status, nextFireAt)` + `watchpartySeries (familyCode, status, nextFireAt)`. Both `queryScope=COLLECTION`. `fieldOverrides[]` unchanged.

## Decisions Made

- **Insertion point in firestore.rules:** chose lines 988-1045 (just after the families block closes at line 985, before the database-documents wrapper closes at line 1044). This makes the series block a true sibling of the top-level `/watchparties/{wpId}` block (line 160) and the recursive `/{path=**}/watchparties/{wpId}` block (line 156) — same architectural tier per Phase 30.
- **No recursive collectionGroup rule:** unlike `/{path=**}/watchparties/{wpId}` which exists because watchparties also lives nested under legacy `/families/{code}/watchparties/`, watchpartySeries is greenfield single-tier — no collectionGroup recursive rule needed.
- **queryScope=COLLECTION on indexes:** PATTERNS D15.2 enforced — divergence from the existing `watchparties` index (which uses COLLECTION_GROUP) is intentional and load-bearing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Planner acceptance-criterion miscount: `watchpartySeries` literal occurrences**
- **Found during:** Task 1 verification
- **Issue:** Plan acceptance criterion stated `grep -c "watchpartySeries" firestore.rules` should return at least 3 ("block name + comment + at least one body reference"). The plan-supplied EXACT block text contains the literal word `watchpartySeries` only once (in `match /watchpartySeries/{seriesId}`); the comment block uses the word "series" (without the `watchparty` prefix) and the body uses `resource.data.memberUids` etc., none containing the literal `watchpartySeries`.
- **Fix:** Honored the plan's "Use this EXACT text — do not paraphrase or 'improve' it" directive (which has higher authority than the downstream grep-count acceptance criterion). The grep-count check would have required either (a) rewriting the comments to add the word `watchpartySeries` redundantly, or (b) renaming `series.memberUids` in the comment to `watchpartySeries.memberUids`. Both would have been paraphrase. The block as inserted is structurally complete (all 4 branches present, all threat mitigations encoded, automated `node -e` verification PASS, structural acceptance criteria 1-4 all PASS), and Wave 4's `firebase deploy --only firestore:rules --dry-run` will be the true syntactic validator.
- **Files modified:** none (no fix applied — accepted the planner's primary directive over the secondary acceptance count)
- **Verification:** `node -e` automated check PASS; 4 of 5 grep acceptance criteria PASS; structural completeness verified by inspection.
- **Committed in:** N/A — no fix code; documented here for audit trail.

---

**Total deviations:** 1 documentation-level (planner-side acceptance-criterion drift; no source-of-truth change needed).
**Impact on plan:** Zero — block is structurally correct and meets all functional acceptance criteria.

## Threat Flags

None — block introduces exactly the surface the threat model already enumerates. All 6 threat IDs (T-16-01, T-16-04, T-16-06, T-16-09, T-16-10, T-16-11) are mitigated by the inserted rules. No new attack surface beyond what CONTEXT/RESEARCH already planned.

## Issues Encountered

None.

## Wave 4 / Plan 16-10 Deploy Ordering Note

When Wave 9 / plan 16-10 deploys these two artifacts:

1. **Indexes FIRST** — `firebase deploy --only firestore:indexes` triggers an async 5-30 min build per composite. The watchpartySeriesTick CF (plan 16-03) will 400 on first tick if it runs before the `(status, nextFireAt)` index is `READY`. Deploy indexes before pushing the CF and before any client write that would attempt the indexed query.
2. **Rules SECOND** — `firebase deploy --only firestore:rules` is atomic-instant (no async build). Safe to deploy any time after step 1 starts; can be parallel with CF deploy.
3. **Cross-repo mirror:** scripts/deploy.sh handles the queuenight/ mirror of firestore.rules + firestore.indexes.json via `--sync-rules` (Phase 30 Wave 4 process gate). Plan 16-10 invocation: `bash scripts/deploy.sh --sync-rules <cache-tag>`.

## User Setup Required

None — no external service configuration required for this plan. The Firestore project (queuenight-84044) already has Blaze billing enabled (no quota changes needed for adding 2 indexes).

## Next Phase Readiness

- **Wave 1 sibling (plan 16-02 cadence-helper + smoke):** Ready to start — no dependency on this plan's deploy state; 16-02 is pure helper-module + smoke contract work.
- **Wave 3 (plan 16-03 materializer CF):** Ready to author against the new schema once deployed. The CF query `where('status','==','active').where('nextFireAt','<=',horizon).orderBy('nextFireAt')` will resolve cleanly against the new `(status ASC, nextFireAt ASC)` index.
- **Wave 5 (plan 16-05 Account-tab list):** Ready to author against the new schema once deployed. Client query `where('familyCode','==',code).where('status','==','active').orderBy('nextFireAt','asc')` resolves against the new `(familyCode ASC, status ASC, nextFireAt ASC)` index.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `firestore.rules` exists and contains `match /watchpartySeries/{seriesId}` at line 993 (verified via `grep -n`).
- File `firestore.indexes.json` exists and parses as valid JSON with 2 `watchpartySeries` entries (verified via `node -e`).
- Commit `a0a0072` exists in `git log` on current branch `hotfix/phase-30-cross-cutting-wave` (verified).
- Commit `a9729e4` exists in `git log` on current branch (verified).
- No file deletions on either commit (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` for both commits — output empty).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-27*
