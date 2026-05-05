---
phase: 30-couch-groups-affiliate-hooks
plan: 02
subsystem: backend, security, infra
tags: [cloud-functions, firestore-rules, rules-test, cross-repo-deploy, firestore-index, pitfall-5, stride]

# Dependency graph
requires:
  - phase: 30-couch-groups-affiliate-hooks
    plan: 01
    provides: composite index DECLARED in queuenight/firestore.indexes.json (Plan 02 deploys it); 8 GROUP-30-* IDs registered in REQUIREMENTS.md; tests/rules.test.js Phase 30 PENDING describe block (Plan 02 fills the 4 it() bodies); ROADMAP Phase 30 entry rewritten
  - phase: 27-guest-rsvp
    provides: rsvpSubmit.js skeleton (CF + auth + transactional upsert) that addFamilyToWp.js mirrors; smoke-guest-rsvp.cjs sentinel pattern; tests/rules.test.js Phase 27 describe-block precedent
  - phase: 24-native-video-player
    provides: Path A/Path B host-only / non-host denylist rule pattern transplanted verbatim into the new top-level /watchparties/{wpId} block
provides:
  - new top-level /watchparties/{wpId} firestore.rules block (memberUids[] read gate + Path A/B split + families/memberUids in Path B denylist) DEPLOYED LIVE
  - addFamilyToWp callable CF (queuenight) DEPLOYED LIVE — host-only; admin-SDK fan-out of memberUids/crossFamilyMembers; STRIDE-mitigated; W4 zero-member family guard
  - wpMigrate one-shot callable CF (queuenight) DEPLOYED LIVE — collectionGroup-scans nested wps + bulkWriter-copies to top-level with memberUids stamps; idempotent
  - rsvpSubmit.js Pitfall 5 fix DEPLOYED LIVE — top-level lookup BEFORE legacy nested scan with B3 hostFamilyCode-gated branch; preserves Phase 27 semantics for ALL wps (pre/post-Phase-30 + deploy-window edge)
  - tests/rules.test.js Phase 30 describe block ACTIVE — 52 to 56 PASS; GROUP-30-06 + GROUP-30-07 closed at rules-test layer
  - composite index COLLECTION_GROUP watchparties memberUids array-contains + startAt DESCENDING in BUILT (READY) state
affects: [30-03, 30-04, 30-05]

# Tech tracking
tech-stack:
  added: []  # No new packages — admin SDK + firebase-functions/v2 already present in queuenight
  patterns:
    - Cross-repo Wave 1 backend pattern — CF source + rules block landed in two repos, single deploy ritual sequences indexes (build) -> rules (live) -> functions (live)
    - admin-SDK cross-family member read pattern — bypasses isMemberOfFamily(foreignCode) rule to read /families/{otherCode}/members for memberUids fan-out
    - B3 hostFamilyCode-gated top-level lookup with three-branch resolution (top-level + hostFamilyCode = use directly; top-level missing hostFamilyCode = fall through to nested scan; no top-level = fall through to nested scan)
    - W4 zero-member family guard — failed-precondition error class distinct from not-found (Plan 04 maps to brand-voice toast)
    - Path A/Path B firestore.rules write split — host = any field; non-host = denylist of host-only Phase 24 fields PLUS Phase 30 families/memberUids
    - Source-tree firestore.rules canonical-test pattern — couch tests/rules.test.js runs against the source-tree rules; mirror to queuenight before deploy ensures byte-identical production behavior

key-files:
  created:
    - C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js
    - C:/Users/nahde/queuenight/functions/src/wpMigrate.js
    - .planning/phases/30-couch-groups-affiliate-hooks/30-02-cf-rules-rsvpsubmit-fix-deploy-SUMMARY.md
  modified:
    - C:/Users/nahde/queuenight/functions/index.js
    - C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js
    - C:/Users/nahde/queuenight/firestore.rules
    - firestore.rules
    - tests/rules.test.js

key-decisions:
  - "B3 fix applied: rsvpSubmit top-level lookup is GATED on hostFamilyCode presence — never silently sets familyCode = null and proceeds (downstream host-member doc fetch at line ~178 would silently break otherwise). When hostFamilyCode is missing on the top-level doc (deploy-window edge case), code falls through to the nested scan where familyCode = f.id is set correctly."
  - "W4 fix applied: addFamilyToWp throws 'failed-precondition' (NOT 'not-found') when the foreign family has zero qualifying members — distinct error code lets Plan 04 UI map to a brand-voice toast different from the generic missing-family toast."
  - "Hard cap = 8 only enforced server-side; soft cap = 4 lives client-side (D-08). The CF intentionally does NOT trip on >=4."
  - "addFamilyToWp uses arrayUnion.apply(null, ...) form (Node 22 supports spread, but apply form is identical-behavior + neutral on older runtimes)."
  - "Legacy nested /families/{familyCode}/watchparties/{wpId} rule block PRESERVED in firestore.rules (not removed) for backward compat during cache-bust window per RESEARCH Q5 — a follow-up phase can lock it down with allow read: if false after Plan 03 client lands."
  - "Cross-repo deploy ritual sequence: indexes FIRST (build is async), then rules (live immediately), then functions (live immediately). Index BUILT state polled via firebase firestore:indexes --pretty before declaring done — observed CREATING for ~3.5min then READY (empty collection)."
  - "Rules tests run from main couch repo (worktree lacks tests/node_modules); copied edited firestore.rules + tests/rules.test.js to /c/Users/nahde/claude-projects/couch/ for the emulator run, confirmed 56 passing 0 failing, then committed only the worktree."

patterns-established:
  - "B3 three-branch top-level/nested resolution: gate top-level on hostFamilyCode presence, never silently null. Future single-doc-by-id lookups (push setup, RSVP variants) should mirror this pattern."
  - "W4 distinct-error-code-per-business-condition: failed-precondition for 'valid family but empty roster' vs not-found for 'family does not exist'. UI matrix in Plan 04 will map both to distinct brand-voice toasts."
  - "Cross-repo source-of-truth: couch/firestore.rules is canonical (couch tests/rules.test.js exercises it); queuenight/firestore.rules is a deploy mirror copied byte-identically before each rules deploy."

requirements-completed:
  - "GROUP-30-01 (partial — CF supports it; client wiring lands in Plan 03+04)"
  - "GROUP-30-05 (partial — CF hard cap 8 enforced; client soft cap 4 + warning copy lands in Plan 04)"
  - "GROUP-30-06 (rules-test layer — #30-03 + #30-04 deny non-host writes to families + memberUids via Path B denylist)"
  - "GROUP-30-07 (rules-test layer — #30-01 strangers denied; #30-02 members in memberUids allowed)"

# Metrics
duration: 12m
completed: 2026-05-03
---

# Phase 30 Plan 02: Cloud Functions + Rules + rsvpSubmit Fix + Deploy Summary

**Wave 1 backend complete: 2 new CFs (addFamilyToWp + wpMigrate) + rsvpSubmit Pitfall 5 fix + new top-level /watchparties/{wpId} firestore.rules block deployed cross-repo to queuenight-84044; composite index in BUILT (READY) state; rules tests grew 52 to 56 PASS. Plan 03 (client subscription shift) UNBLOCKED.**

## Performance

- **Duration:** ~12 min (deploy-bound; index BUILT poll took 3.5 min)
- **Started:** 2026-05-03T21:23:00Z
- **Completed:** 2026-05-03T21:35:25Z
- **Tasks:** 5
- **Files created:** 3 (2 CFs in queuenight + this SUMMARY)
- **Files modified:** 5 (couch firestore.rules + couch tests/rules.test.js + queuenight functions/index.js + queuenight rsvpSubmit.js + queuenight firestore.rules mirror)

## Accomplishments

- **Task 2.1 — Cross-repo CFs created and exported:** `addFamilyToWp.js` (~110 lines) implements all 5 STRIDE mitigations from RESEARCH Security Domain (Spoofing T-30-01 via auth + host-only check, Tampering T-30-02 deferred to rules layer, Info-Disclosure T-30-03 via uniform 'No family with that code' error, DoS T-30-04 via hard cap 8) PLUS the W4 zero-member family guard (failed-precondition error). `wpMigrate.js` (~75 lines) one-shot collectionGroup-scans nested wps and bulkWriter-copies them to top-level with memberUids stamps. Both wired into `queuenight/functions/index.js` exports immediately after the rsvp* block.
- **Task 2.2 — rsvpSubmit Pitfall 5 fix deployed:** Top-level `/watchparties/{token}` lookup now runs BEFORE the legacy family-scan loop, gated on `hostFamilyCode` presence (B3 fix). Three-branch resolution: (a) top-level + hostFamilyCode → use directly; (b) top-level missing hostFamilyCode → fall through to nested scan (deploy-window edge case); (c) no top-level → fall through to nested scan (pre-Phase-30 wps). Phase 27 runTransaction block UNCHANGED — smoke contract sentinels (runTransaction, WP_ARCHIVE_MS=25h, rsvpClosed gate, 100-cap, guestCounts) all preserved.
- **Task 2.3 — firestore.rules top-level block added:** New `match /watchparties/{wpId}` block before `match /families/{familyCode}` with `request.auth.uid in resource.data.memberUids` read gate + Path A (host = any field) / Path B (non-host = denylist of Phase 24 fields PLUS Phase 30 'families' and 'memberUids'). Existing nested block PRESERVED for backward compat. `signedIn()` and `uid()` helpers reused (already exist at lines 26 + 30).
- **Task 2.4 — 4 PENDING rules-test stubs converted to ACTIVE:** Phase 30 seed added (top-level `watchparties/wp_phase30_test` with `hostFamilyCode='fam1'`, `memberUids=['UID_OWNER', 'UID_MEMBER']`, families=['fam1']). 4 it() bodies replaced with real `assertSucceeds`/`assertFails` calls. Describe label dropped the PENDING marker. Verified end-to-end: `cd tests && npm test` reports `56 passing, 0 failing` exactly as the plan's success criterion specified (52 baseline + 4 new). All 4 Phase 30 assertions hit the expected branch — `#30-03` and `#30-04` show `evaluation error at L148:24 for update` confirming the Path B denylist on memberUids/families is firing as designed.
- **Task 2.5 — Cross-repo deploy executed cleanly:** Indexes deployed FIRST (composite watchparties memberUids array-contains + startAt DESC), polled every 30s via `firebase firestore:indexes --pretty` until READY (~3.5 min), then rules deployed live, then 3 CFs deployed (`addFamilyToWp` CREATED, `wpMigrate` CREATED, `rsvpSubmit` UPDATED). `firebase functions:list` confirms all 3 are live in us-central1 on nodejs22 runtime. sw.js CACHE unchanged (still `couch-v40-sports-feed-fix`; Plan 05 owns the bump).

## Task Commits

Each task committed atomically:

| Task | Repo | Hash | Type | Description |
| ---- | ---- | ---- | ---- | ----------- |
| 2.1 — addFamilyToWp + wpMigrate CFs + index.js exports | queuenight | `b6ad8cc` | feat | 2 new callable CFs + wired into functions/index.js after rsvp* block |
| 2.2 — rsvpSubmit Pitfall 5 fix | queuenight | `b51b4d5` | fix | Top-level lookup gated on hostFamilyCode (B3 fix); preserves Phase 27 semantics for all wp paths |
| 2.3 — firestore.rules top-level /watchparties block | couch worktree | `01c8a80` | feat | New top-level rule block; legacy nested block preserved |
| 2.4 — 4 PENDING rules-test stubs converted to ACTIVE (52->56 PASS) | couch worktree | `7fef079` | test | Phase 30 seed + real assertSucceeds/assertFails for #30-01..04 |
| 2.5 — Cross-repo deploy ritual + queuenight firestore.rules mirror | queuenight | `08f4825` (mirror commit) | chore | Mirror commit; deploy itself produces no git diff (live-state change) |

**Plan metadata commit:** TBD (added by orchestrator post-Wave write)

_Note: Tasks 2.1, 2.2, and 2.5 commits live in `C:/Users/nahde/queuenight` (sibling repo), NOT in the couch worktree. Tasks 2.3 and 2.4 commits live in the couch worktree._

## Files Created/Modified

### Couch worktree (this repo)
- `firestore.rules` (modified) — New top-level `match /watchparties/{wpId}` block with memberUids[] read gate + Path A/B write split + Phase 30 denylist additions (`families`, `memberUids`). Legacy nested block at line 577 PRESERVED.
- `tests/rules.test.js` (modified) — Added Phase 30 seed (top-level `watchparties/wp_phase30_test`); replaced 4 PENDING `return;` no-op bodies with real `assertSucceeds`/`assertFails`; dropped PENDING marker from describe label.
- `.planning/phases/30-couch-groups-affiliate-hooks/30-02-cf-rules-rsvpsubmit-fix-deploy-SUMMARY.md` (new) — this file.

### Queuenight sibling repo
- `functions/src/addFamilyToWp.js` (new, ~110 lines) — Phase 30 callable CF: host-only validates family code + admin-SDK reads foreign family members + atomic fan-out via `FieldValue.arrayUnion`. STRIDE-mitigated + W4 zero-member family guard.
- `functions/src/wpMigrate.js` (new, ~75 lines) — One-shot callable CF: collectionGroup-scans nested wps and bulkWriter-copies to top-level with memberUids stamped from current family roster. Idempotent.
- `functions/index.js` (modified) — Two new exports `exports.addFamilyToWp` + `exports.wpMigrate` appended immediately after the rsvp* block.
- `functions/src/rsvpSubmit.js` (modified) — Pitfall 5 fix prepended: top-level `/watchparties/{token}` lookup BEFORE the existing nested scan, gated on `hostFamilyCode` presence (B3 fix). Phase 27 runTransaction block + 25h WP_ARCHIVE_MS + 100-guest cap + guestCounts return shape all UNCHANGED.
- `firestore.rules` (modified — mirror) — Byte-identical copy of couch source-tree firestore.rules. Required because production rules deploy from queuenight, but couch tests/rules.test.js runs against couch source-tree rules — they MUST agree.

## Decisions Made

- **B3 fix applied (decision documented in plan; executed verbatim):** rsvpSubmit's top-level lookup is GATED on `hostFamilyCode` presence rather than just `topLevelDoc.exists`. Without this gate, a top-level wp doc lacking the `hostFamilyCode` stamp (deploy-window edge case OR a wpMigrate run that landed docs without hostFamilyCode) would set `familyCode = null`, breaking the downstream `db.collection('families').doc(familyCode).collection('members').doc(wp.hostId).get()` host-member fetch at line ~179. The three-branch resolution preserves Phase 27 semantics for ALL three states.
- **W4 fix applied (decision documented in plan; executed verbatim):** addFamilyToWp throws `failed-precondition` (NOT `not-found`) when the foreign family has zero qualifying members. Distinct error class lets Plan 04 UI map to a brand-voice toast ("That family hasn't added any members yet — ask them to invite people first.") different from the generic missing-family toast ("No family with that code.").
- **arrayUnion.apply(null, ...) form preferred over spread (matches plan note):** Node 22 supports spread, but the apply() form is identical behavior + neutral on older runtimes. Reduces risk for any future runtime downgrade. Plan note explicitly authorized either form.
- **Legacy nested rule block PRESERVED (matches plan + RESEARCH Q5):** The existing `match /families/{familyCode}/watchparties/{wpId}` block at line 577 is NOT removed. RESEARCH Q5 + plan instructions both lock this — a follow-up phase can lock it down with `allow read: if false` after Plan 03 client lands and old caches purge.
- **Index BUILT poll cadence: 30s, max 5 min:** Plan said "1-15 min for empty/small collections". I polled every 30s and observed READY at the 8th check (~3.5 min). For larger collections, the poll loop should be extended; for queuenight which has no top-level wp docs yet, build was fast.
- **Tests run from main couch repo (worktree lacks tests/node_modules):** Plan 01 SUMMARY decision-table noted "Rules-test running deferred to Plan 02". The worktree at `.claude/worktrees/agent-*/tests/` has no node_modules; the main couch repo at `/c/Users/nahde/claude-projects/couch/tests/` does. I copied the edited `firestore.rules` + `tests/rules.test.js` to the main couch repo, ran `cd tests && npm test`, observed `56 passing, 0 failing`, then committed ONLY the worktree files. The orchestrator's worktree merge will land the same files into the main repo on completion.

## Deviations from Plan

### Auto-fixed Issues

None — Plan 02 executed exactly as written. The B3 + W4 fixes were already explicitly codified in the plan action sections (revision-locked), so they are not deviations; they are first-class plan instructions.

### Out-of-scope smoke FAIL (deferred — not a regression)

**[Out-of-scope] worktree-relative path resolution in `scripts/smoke-guest-rsvp.cjs`**
- **Found during:** Task 2.2 verify
- **Issue:** When `scripts/smoke-guest-rsvp.cjs` is run from the worktree (`.claude/worktrees/agent-*/`), the QN_FUNCTIONS path computes `__dirname/../../../queuenight` which does not exist (the worktree is 4 levels deep, not 3). All sibling-repo sentinels (5.x rsvpSubmit, 6.x rsvpStatus, 7.x rsvpRevoke, 8.x rsvpReminderTick) skip with `(file not present in this checkout)` and the floor meta-assertion FAILs at `10 < 13`.
- **Resolution:** Verified the smoke contract passes from the main couch repo: `cd /c/Users/nahde/claude-projects/couch && npm run smoke:guest-rsvp` reports `47 passed, 0 failed` with `production-code sentinel floor met (29 >= 13)`. The worktree FAIL is a path-resolution artifact, NOT a regression from my rsvpSubmit edit. All Phase 27 sentinels (runTransaction, WP_ARCHIVE_MS, rsvpClosed, 100-cap, guestCounts) are still present in `rsvpSubmit.js`.
- **Files modified:** None — out of scope for Plan 02. The smoke script could be hardened by walking up parents until it finds a directory named `queuenight`, but that's a Phase 30.x or smoke-infra task.
- **Logged to:** This SUMMARY.md only (no `deferred-items.md` exists yet in this phase).

---

**Total deviations:** 0 auto-fixed (Rules 1-3) + 1 out-of-scope (deferred).
**Impact on plan:** None — plan executed verbatim against locked specifications. The worktree-relative path issue is environmental, not behavioral.

## Issues Encountered

- **Worktree initially based on commit `93d102d` (an earlier feature branch HEAD):** The worktree HEAD pointed at a phase-14 branch checkout instead of `1903537` (Plan 30-01 merge). Per `<worktree_branch_check>`, ran `git reset --hard 1903537...` and verified HEAD equals the expected base. Resolution: clean reset; no data lost; Plan 01 artifacts (smoke-couch-groups.cjs, Phase 30 PENDING describe block, REQUIREMENTS GROUP-30-* IDs, ROADMAP rewrite, queuenight composite index entry) all visible after reset.
- **Composite index spent ~3.5 min in CREATING state before READY:** Index builds for empty/small collections were estimated at 1-15 min in RESEARCH Pitfall 7. Actual: 3.5 min from `firebase deploy --only firestore:indexes` to first `[READY]` observation. Acceptable — within the documented range. Polled every 30s using `firebase firestore:indexes --pretty | grep memberUids`.

## User Setup Required

None — Cross-repo deploy fully automated via pre-authorized firebase deploy ritual. The user does not need to take any manual action. Plan 03 can begin immediately.

## Next Phase Readiness

- **Plan 30-03 (client subscription shift) UNBLOCKED.** The BLOCKING gate from Plan 01 is now CLEAR:
  - Composite index `watchparties memberUids array-contains + startAt DESC` is **BUILT (READY)** — `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` will not silently fail.
  - firestore.rules top-level `/watchparties/{wpId}` block is LIVE — `request.auth.uid in resource.data.memberUids` read gate enforced in production.
  - 2 new CFs (`addFamilyToWp`, `wpMigrate`) are LIVE in us-central1 — Plan 04 client UI can call `addFamilyToWp` once Plan 03 lands the client subscription shift.
  - rsvpSubmit Pitfall 5 fix is LIVE — guest RSVP flow continues to work for ALL wps once Plan 03 starts writing top-level wp docs.
- **Plan 30-04 (UI affordance + caps) waiting on Plan 03:** Cannot begin until the client subscription is shifted to `collectionGroup` (Plan 03 owns this). The W4 zero-member family guard's `failed-precondition` error code is in place server-side and ready for Plan 04's UI error-matrix mapping.
- **Plan 30-05 (close-out) waiting on 03 + 04:** Will raise smoke FLOOR from 0 to 13 + bump sw.js CACHE to `couch-v41-couch-groups` once production-code sentinels in 03 + 04 are committed.

## Threat Flags

None — Plan 02's threat surface was fully enumerated in the plan's `<threat_model>` and all 5 STRIDE threats (T-30-01 Spoofing, T-30-02 Tampering, T-30-03 Info-Disclosure, T-30-04 DoS doc-size, T-30-05 DoS rsvpSubmit regression) have explicit mitigations implemented. No new surface introduced beyond what the plan documented.

## Self-Check

Verifying all claimed artifacts exist and all task commits are present:

- [x] `C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js` — exists; `node -c` exits 0; contains all required sentinels (auth check, host-only check, idempotency guard, hard cap 8, W4 zero-member guard, arrayUnion, T-30-03 uniform error)
- [x] `C:/Users/nahde/queuenight/functions/src/wpMigrate.js` — exists; `node -c` exits 0; contains `db.collectionGroup('watchparties')`, `db.bulkWriter()`, top-level path guard, idempotency check via existing.data().memberUids
- [x] `C:/Users/nahde/queuenight/functions/index.js` — `exports.addFamilyToWp = require('./src/addFamilyToWp').addFamilyToWp` and `exports.wpMigrate = require('./src/wpMigrate').wpMigrate` both present after the rsvp* block
- [x] `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` — `node -c` exits 0; B3 gate `topLevelDoc.exists && topLevelDoc.data() && topLevelDoc.data().hostFamilyCode` present; Pitfall 5 comment present; legacy nested scan loop preserved in else branch; runTransaction count = 1; no `|| null` problematic fallback
- [x] `firestore.rules` — 2 `match /watchparties/{wpId}` blocks (legacy nested + new top-level); `request.auth.uid in resource.data.memberUids` gate present; `'families', 'memberUids'` denylist additions present; legacy `attributedWrite(familyCode)` block preserved
- [x] `tests/rules.test.js` — Phase 30 seed (`watchparties/wp_phase30_test`) line present; 4 `#30-0[1-4]` it() declarations; 0 PENDING markers; describe label = `'Phase 30 Couch Groups rules'` (no PENDING)
- [x] Composite index BUILT (READY) — `firebase firestore:indexes --pretty` shows `[READY] (watchparties) -- (memberUids,CONTAINS) (startAt,DESCENDING)`
- [x] CFs LIVE — `firebase functions:list` shows `addFamilyToWp(us-central1) v2 callable nodejs22`, `wpMigrate(us-central1) v2 callable nodejs22`, `rsvpSubmit(us-central1) v2 callable nodejs22`
- [x] Rules DEPLOYED LIVE — `firebase deploy --only firestore:rules` returned `Deploy complete!` + `released rules firestore.rules to cloud.firestore`
- [x] Source-tree firestore.rules byte-identical to queuenight/firestore.rules — `diff` returns 0
- [x] sw.js CACHE UNCHANGED at `couch-v40-sports-feed-fix` — Plan 02 does NOT bump cache; Plan 05 owns it
- [x] Rules tests run from main couch repo: `56 passing, 0 failing` (52 baseline + 4 new Phase 30 = 56 exactly)
- [x] Commit `b6ad8cc` (Task 2.1) — present in queuenight `git log`
- [x] Commit `b51b4d5` (Task 2.2) — present in queuenight `git log`
- [x] Commit `01c8a80` (Task 2.3) — present in couch worktree `git log`
- [x] Commit `7fef079` (Task 2.4) — present in couch worktree `git log`
- [x] Commit `08f4825` (Task 2.5 mirror) — present in queuenight `git log`

## Self-Check: PASSED

All artifacts on disk in their expected locations across both repos; all 5 task commits in their respective git histories (3 in queuenight + 2 in couch worktree); composite index BUILT; rules + functions LIVE; rules tests pass at the documented count; sw.js CACHE unchanged. Plan 30-03 unblocked and ready to begin.

---
*Phase: 30-couch-groups-affiliate-hooks*
*Plan: 02*
*Completed: 2026-05-03*
