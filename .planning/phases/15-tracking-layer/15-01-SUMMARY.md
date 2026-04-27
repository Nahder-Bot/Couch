---
phase: 15
plan: 01
subsystem: firestore-rules-and-indexes
tags: [tracking-layer, firestore-rules, firestore-indexes, security, REVIEW-HIGH-1]
requires:
  - 14-10 4th UPDATE branch (couchInTonight) — already deployed to queuenight 2026-04-26
  - tests/rules.test.js #1-#22 (Phase 1-14 baseline)
provides:
  - "5th UPDATE branch on /families/{familyCode} permitting tupleNames writes"
  - "tightened title-doc UPDATE block enforcing per-member field-level isolation on tupleProgress + mutedShows + liveReleaseFiredFor (REVIEW HIGH-1)"
  - "First composite index in queuenight/firestore.indexes.json — watchparties (titleId asc, startAt asc)"
  - "10 new rules tests #23-#32 covering the tupleNames family-doc branch + the title-doc HIGH-1 isolation matrix"
  - "Forward-contract for 15-02: writeTupleProgress() must stamp actingTupleKey: tupleKey alongside the tupleProgress write"
affects:
  - "Plan 15-02 (writeTupleProgress / setTupleName) — receives the rules contract this plan ships"
  - "Plan 15-03 (writeMutedShow) — gated by the per-member mutedShows isolation rule"
  - "Plan 15-06 (CF live-release watchpartyTick) — depends on the watchparties composite index + the CF-only liveReleaseFiredFor write path"
  - "Plan 15-08 (close-out / cross-repo deploy) — must commit + deploy the queuenight edits applied in-place by this plan"
tech-stack:
  added:
    - "Firestore rules: per-member field-level isolation pattern (using property-existence guards via 'X' in resource.data)"
    - "Firestore indexes: first composite index in the project (collection-scoped on watchparties)"
    - "Test helper convention: actingTupleKey echo for per-tuple-key validation in rules"
  patterns:
    - "Mirrors Phase 14-10 4th UPDATE branch shape (clone-as-sibling)"
    - "Mirrors Phase 14-04 couchSeating tests (#19-#22 → #23-#26 same skeleton)"
    - "Two-repo discipline (Phase 14-06 deviation pattern): edits to ~/queuenight/* applied in-place but NOT committed; deferred to Plan 15-08"
key-files:
  created: []
  modified:
    - "~/queuenight/firestore.rules (canonical — uncommitted, deferred to 15-08)"
    - "~/queuenight/firestore.indexes.json (canonical — uncommitted, deferred to 15-08)"
    - "firestore.rules (couch-side test mirror — committed)"
    - "tests/rules.test.js (committed)"
decisions:
  - "Used the planner's pre-approved fallback shape for tupleProgress per-key validation (toList/where lambda not supported in Firestore rules expression language as of 2026-04-27 emulator) AND extended it with a client-echoed actingTupleKey field to enable hasOnly-equality checking that the rules language CAN express"
  - "Required a forward-contract on 15-02's writeTupleProgress — the rule denies any tupleProgress write that lacks actingTupleKey OR whose actingTupleKey doesn't match the diff'd key OR doesn't contain the actor memberId"
  - "Mirrored queuenight rules to couch-side firestore.rules so the existing test pretest (cp ../firestore.rules → tests/firestore.rules) loads the Phase 15 rules — necessary for tests to actually validate the new behavior"
metrics:
  duration_seconds: 527
  duration_minutes: 8
  task_count: 4
  file_count: 4
  tests_passing: 32
  tests_failing: 0
  completed: "2026-04-27"
---

# Phase 15 Plan 01: Firestore Foundation (Rules + Indexes + Tests) Summary

**One-liner:** Locks the Firestore data foundation for Phase 15 — adds the 5th UPDATE branch for tupleNames writes, tightens the title-doc UPDATE block per REVIEW HIGH-1 (explicit DENY for client liveReleaseFiredFor + per-member field-level isolation on tupleProgress + mutedShows), ships the first composite index for the 15-06 CF suppression query, and adds 10 new rules tests (#23-#32) — all under the established two-repo discipline (queuenight edits applied in-place; commits deferred to Plan 15-08).

---

## What Shipped

### a) Family-doc 5th UPDATE branch — tupleNames

`~/queuenight/firestore.rules` lines **181-194** (verified post-edit).

Added the 5th branch immediately after the existing 14-10 4th branch (couchInTonight). Allowlist: `['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName']`. Mirrors the verbatim 4-branch attribution+allowlist pattern.

### b) Title-doc UPDATE rewrite — REVIEW HIGH-1 isolation matrix

`~/queuenight/firestore.rules` lines **357-426** (the entire `match /titles/{titleId}` block body for the `allow update` predicate; pre-patch was the single-predicate form `allow create, update: if attributedWrite(familyCode);` at the historical line 332).

Now ships:
- **Line 359:** `allow create: if attributedWrite(familyCode);` (split out from the original combined create+update statement so the tightening only affects updates).
- **Lines 360-426:** compound `allow update: if attributedWrite(familyCode) && (...) && (...) && (...)` with three sub-rules:
  - **Lines 361-367 — explicit DENY for liveReleaseFiredFor:** `!affectedKeys().hasAny(['liveReleaseFiredFor'])`. CF admin SDK bypasses this (legitimate write path stays intact).
  - **Lines 368-405 — per-tuple-key isolation for tupleProgress:** require diff to touch exactly one tupleKey, require client to echo `actingTupleKey`, require diff'd key equals echoed key, require echoed key contains the actor memberId (regex anchored at start, end, or comma boundaries).
  - **Lines 406-426 — per-member mutedShows isolation:** if mutedShows is in the diff, the inner-map diff's affectedKeys must equal `[actorMemberId]` (single-element hasOnly).

### c) firestore.indexes.json composite index

`~/queuenight/firestore.indexes.json` (full file — 13 lines):

```json
{
  "indexes": [
    {
      "collectionGroup": "watchparties",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "titleId", "order": "ASCENDING" },
        { "fieldPath": "startAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

First composite index in the queuenight repo. Serves the 15-06 D-16 suppression query: `db.collection('watchparties').where('titleId','==',titleId).where('startAt','>=',airTs - 90*60000).where('startAt','<=',airTs + 90*60000).get()`.

### d) tests/rules.test.js — 10 new tests (#23-#32)

| # | Block | Expected | What it covers |
|---|-------|----------|----------------|
| #23 | tupleNames | ALLOW | Authed member writes tupleNames + attribution |
| #24 | tupleNames | DENY | Stranger writes tupleNames |
| #25 | tupleNames | DENY | Authed member writes tupleNames WITHOUT actingUid post-grace (resets fam1 + flips grace OFF) |
| #26 | tupleNames | DENY | Authed member writes tupleNames + non-allowlisted field (foo) |
| #27 | title-doc HIGH-1 | ALLOW | tupleProgress[tk] where tk INCLUDES actor (actingTupleKey echoed) |
| #28 | title-doc HIGH-1 | ALLOW | mutedShows[memberId=self] |
| #29 | title-doc HIGH-1 | DENY | tupleProgress[tk] where tk EXCLUDES actor (HIGH-1 mitigation) |
| #30 | title-doc HIGH-1 | DENY | mutedShows[someone-else] (HIGH-1 mitigation) |
| #31 | title-doc HIGH-1 | DENY | liveReleaseFiredFor client write (HIGH-1 mitigation; CF-only field) |
| #32 | title-doc HIGH-1 | ALLOW | Non-Phase-15 fields (queues / ratings) — no regression on Phase 1-14 paths |

### e) Deploy gate flag for Plan 15-08

`~/queuenight/firestore.rules` AND `~/queuenight/firestore.indexes.json` are EDITED IN-PLACE in this plan but **NOT COMMITTED** (per Phase 14-06 two-repo discipline pattern, mirrored in this plan's `<cross_repo_note>`).

**Plan 15-08 (cross-repo deploy ritual close-out) MUST execute, in order:**
1. `cd ~/queuenight && git add firestore.rules firestore.indexes.json && git commit -m "feat(15): Phase 15 rules + first composite index"`
2. `firebase deploy --only firestore:rules,firestore:indexes --project queuenight-84044` from `~/queuenight`
3. (Wait for the composite index to finish building — 1-5 minutes per RESEARCH §Risks #4 — BEFORE deploying any 15-06 CF that depends on it.)
4. `firebase deploy --only functions` from `~/queuenight` (15-06 CF deploy)
5. `bash scripts/deploy.sh <short-tag>` from couch repo (mirror + hosting deploy)

### f) Firestore rules expression-language `where` predicate confirmation

The planner's primary form used `affectedKeys().toList()[0].matches(...)` AND a `.where(x => ...)` lambda predicate on Sets. **Neither is supported in the Firestore rules expression language as of the 2026-04-27 Firestore emulator** — confirmed during execution by emulator error `Function not found error: Name: [toList]` (and the absence of `where` from the official rules.Set method list).

The fallback shape documented in the plan was adapted with a small additional contract: the client must echo the tupleKey being written into a sibling `request.resource.data.actingTupleKey` field. The rule then validates:
1. The diff on `tupleProgress` affects exactly one inner key.
2. `actingTupleKey` is a string and equals the diff'd inner key (via `affectedKeys().hasOnly([actingTupleKey])`).
3. `actingTupleKey` matches the regex `(^|.*,)<actor>(,.*|$)` where `<actor>` is `managedMemberId` (proxy) or `memberId` (self).

This adaptation preserves the planner's HIGH-1 intent (per-member tuple isolation) and is testable in pure rules language.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan rule predicate referenced `request.auth.uid` for the mutedShows/tupleProgress key check, but the data convention uses memberId (`m_<UID>`)**
- **Found during:** Task 1.5 design before tests
- **Issue:** The plan's narrative said "memberId MUST equal request.auth.uid OR managedMemberId" for the mutedShows isolation rule. But seed data + every existing test uses `memberId: 'm_<UID>'` (m-prefixed) while `auth.uid` is the bare `<UID>` — these never match. The same identity surface mismatch applies to tuple keys (which contain `m_<UID>` memberIds, not raw auth.uids).
- **Fix:** Use `request.resource.data.memberId` (with `managedMemberId` proxy fallback) as the comparison value in both the mutedShows and tupleProgress rules. This matches the actual data shape AND the writeAttribution() contract from `js/utils.js:92`.
- **Files modified:** `~/queuenight/firestore.rules` (lines 384-389 + 417-421), `firestore.rules` mirror.
- **Commit:** `fca665f` (Task 1+1.5 mirror commit)

**2. [Rule 3 - Blocking issue] Planner's `affectedKeys().toList()[0].matches(...)` form not supported in Firestore rules language**
- **Found during:** Task 3 first test run (auto-fix attempt 1)
- **Issue:** Firestore emulator threw `Function not found error: Name: [toList]` — `rules.Set` has no `.toList()` accessor. The plan's primary form (using `where` lambda) was already known unsupported per the plan's own note 2; the documented fallback also didn't compile.
- **Fix:** Adapted the fallback to require the client to echo the tupleKey in `request.resource.data.actingTupleKey`. The rule then uses `affectedKeys().hasOnly([request.resource.data.actingTupleKey])` (which IS supported) for diff-equality + a `.matches()` regex on the echoed key for actor-membership. This is a small forward-contract on Plan 15-02 (writeTupleProgress must stamp actingTupleKey).
- **Files modified:** `~/queuenight/firestore.rules` (lines 368-405), `firestore.rules` mirror, `tests/rules.test.js` (#27 + #29 updated to include `actingTupleKey`).
- **Commits:** `fca665f`, `2ccaa4a`

**3. [Rule 1 - Bug] Property-existence checks via `data.field == null` error in Firestore rules when field is absent**
- **Found during:** Task 3 second test run (auto-fix attempt 2) — test #28 hit `Property mutedShows is undefined on object`
- **Issue:** The original `(resource.data.mutedShows == null ? {} : resource.data.mutedShows)` guard pattern from the planned rule body errors in the rules engine when the property doesn't exist on the existing doc — `null`-comparison only safely handles present-but-null values, not absent fields.
- **Fix:** Replaced all such guards with the proper `('field' in data ? data.field : <default>)` idiom. Same fix applied to the `managedMemberId` lookups (which use the proxy-fallback ternary) so that titles without managed sub-profiles don't error.
- **Files modified:** `~/queuenight/firestore.rules` (tupleProgress + mutedShows branches), `firestore.rules` mirror.
- **Commit:** Subsumed in `fca665f` (was applied during the auto-fix pass before the final mirror commit).

**4. [Rule 3 - Blocking issue] Couch-side firestore.rules was 2 cycles behind queuenight (missing 14-10 4th branch)**
- **Found during:** Pre-Task-3 inspection (test pretest copies ../firestore.rules)
- **Issue:** The test runner uses `cp ../firestore.rules ./firestore.rules` (couch-side mirror) before running. The couch-side mirror lagged queuenight by Plan 14-10's 4th UPDATE branch (couchInTonight, deployed 2026-04-26). Phase 15's 5th branch insertion anchor (the closing `);` after the 4th branch) didn't exist on the couch side, AND tests would have run against stale rules without the Phase 15 changes.
- **Fix:** Replaced the couch-side `firestore.rules` with a full copy of the post-Phase-15 queuenight rules. This catches up the 14-10 lag AND adds the Phase 15 changes in one mirror sync. Couch's deploy.sh does NOT push firestore.rules (verified via `Grep firestore` returning no matches in deploy.sh) — queuenight remains the canonical deploy source. The couch-side file is purely a test mirror.
- **Files modified:** `firestore.rules` (couch worktree).
- **Commit:** `fca665f`

### Auth gates / Human action

None. All work was rules + tests + index JSON; no auth was needed during execution.

### Items NOT changed (per scope)

- **`~/queuenight/firestore.rules` and `~/queuenight/firestore.indexes.json` are NOT committed in queuenight's git** — per the cross_repo_note + Phase 14-06 two-repo discipline pattern. Plan 15-08 close-out picks these up.
- **No changes to `js/app.js`** — Plans 15-02 onward implement the client primitives.
- **No CF changes** — Plan 15-06 ships watchpartyTick.
- **`scripts/deploy.sh` not extended** — per RESEARCH §Risks #4 the queuenight `firebase deploy --only firestore:rules,firestore:indexes` step is hand-run (or scripted in 15-08).

---

## Two-Repo Discipline — Pending Queuenight Commit

Per the cross_repo_note and the Phase 14-06 deviation pattern (also seen in 14-09 + 14-10):

| File | Status in queuenight repo | Picked up by |
|------|---------------------------|--------------|
| `~/queuenight/firestore.rules` | EDITED IN-PLACE; uncommitted | Plan 15-08 (cross-repo deploy ritual Step 1) |
| `~/queuenight/firestore.indexes.json` | EDITED IN-PLACE; uncommitted | Plan 15-08 (cross-repo deploy ritual Step 1) |

User must, from a queuenight-equipped session, BEFORE deploying any Phase 15 client code:

```bash
cd ~/queuenight
git add firestore.rules firestore.indexes.json
git commit -m "feat(15): Phase 15 rules + first composite index"
firebase deploy --only firestore:rules,firestore:indexes --project queuenight-84044
# Wait 1-5 min for the watchparties composite index to finish BUILDING (Firebase Console → Firestore → Indexes; status should go from Building → Enabled).
```

Plan 15-08 close-out documents and runs this end-to-end.

---

## Verification Evidence

```
$ cd tests && npm test
...
30 passing, 2 failing  (auto-fix attempt 1)
...
31 passing, 1 failing  (auto-fix attempt 2)
...
32 passing, 0 failing  (final)
```

Final test run output (per-test):
- #1-#22 (Phase 1-14 baseline): all PASS — no regression
- #23-#26 (Phase 15 tupleNames): all PASS (3 DENY, 1 ALLOW)
- #27-#32 (Phase 15 HIGH-1 isolation): all PASS (3 DENY, 3 ALLOW)

Verify commands run during execution:
```
grep -c "// === Phase 15 / D-02" ~/queuenight/firestore.rules                 → 1 ✓
grep -c "REVIEW HIGH-1 — explicit DENY for liveReleaseFiredFor" ...           → 1 ✓
grep -c "REVIEW HIGH-1 — per-tuple-key isolation for tupleProgress" ...       → 1 ✓
grep -c "REVIEW HIGH-1 — per-member mutedShows isolation" ...                 → 1 ✓
grep -c "match /titles/{titleId}" ~/queuenight/firestore.rules                 → 1 ✓ (still single)
node -e 'JSON.parse(...firestore.indexes.json...)' + collectionGroup checks    → OK ✓
for n in 23..32; do grep -q "#$n " tests/rules.test.js; done                    → ALL 10 IDs PRESENT ✓
git diff tests/rules.test.js shows only additions (no modifications #1-#22)     → ✓
```

---

## Commits (this worktree)

| Hash    | Type | Subject |
|---------|------|---------|
| `fca665f` | feat | mirror queuenight firestore.rules with Phase 15 + 14-10 sync |
| `2ccaa4a` | test | add 10 Phase 15 rules tests (#23-#32) |

Note: Task 2 (queuenight/firestore.indexes.json) does not produce a couch-worktree commit because the file lives only in the sibling queuenight repo (no test mirror exists for it).

---

## Self-Check: PASSED

Files exist:
- FOUND: `~/queuenight/firestore.rules` (568 lines; contains Phase 15 D-02 + REVIEW HIGH-1 markers)
- FOUND: `~/queuenight/firestore.indexes.json` (13 lines; valid JSON; 1 composite index)
- FOUND: `firestore.rules` (worktree; mirror sync — committed)
- FOUND: `tests/rules.test.js` (worktree; 10 new tests — committed)
- FOUND: `.planning/phases/15-tracking-layer/15-01-SUMMARY.md` (this file)

Commits exist:
- FOUND: `fca665f` in `git log --oneline -5` (worktree)
- FOUND: `2ccaa4a` in `git log --oneline -5` (worktree)

All success criteria from the plan satisfied:
1. ✓ 5th UPDATE branch on `/families/{familyCode}` with verbatim allowlist `['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName']`
2. ✓ `match /titles/{titleId}` block enforces 3 sub-rules (DENY liveReleaseFiredFor, per-member tupleProgress isolation, per-member mutedShows isolation); other fields preserved
3. ✓ Composite index on `watchparties (titleId asc, startAt asc)` exists in firestore.indexes.json
4. ✓ Two new describe blocks in tests/rules.test.js (tupleNames + HIGH-1 isolation matrix)
5. ✓ All 32 tests pass via `npm test`
6. ✓ Tests #1-#22 unmodified (diff is additions-only past line 386)
7. ✓ CF admin SDK writes to `t.liveReleaseFiredFor` succeed (admin bypasses rules); only client writes blocked — verified by the explicit DENY structure
8. ✓ Deploy of artifacts deferred to Plan 15-08 (queuenight commits not made in this plan)
