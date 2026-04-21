---
phase: 05-auth-groups
plan: "03"
subsystem: cloud-functions
tags: [cloud-functions, bcrypt, firestore-transactions, auth, callable]
dependency_graph:
  requires: [05-01]
  provides: [setGroupPassword-CF, joinGroup-CF, claimMember-CF, inviteGuest-CF, transferOwnership-CF]
  affects: [05-06, 05-07, 05-08]
tech_stack:
  added: [bcryptjs@^2.4.3]
  patterns: [firebase-functions/v2/https onCall, Firestore runTransaction, base64url token generation]
key_files:
  created:
    - C:/Users/nahde/queuenight/functions/src/setGroupPassword.js
    - C:/Users/nahde/queuenight/functions/src/joinGroup.js
    - C:/Users/nahde/queuenight/functions/src/claimMember.js
    - C:/Users/nahde/queuenight/functions/src/inviteGuest.js
    - C:/Users/nahde/queuenight/functions/src/transferOwnership.js
  modified:
    - C:/Users/nahde/queuenight/functions/package.json
    - C:/Users/nahde/queuenight/functions/index.js
decisions:
  - "Used firebase-functions/v2/https onCall (not v1) — v4.9.0 installed has v2 path in lib/; confirmed via ls"
  - "Node 22 runtime confirmed (package.json engines.node = 22, not 20 as RESEARCH assumed)"
  - "bcryptjs cost factor 12 per RESEARCH §4 recommendation"
  - "consumeInviteToken helper lives in joinGroup.js (same file, top-level function)"
  - "metadata.temporary stored in inviteMetadata variable in joinGroup.js — propagated via inviteMetadata.temporary check"
  - "No firebase deploy executed — pending orchestrator action"
  - "No npm install executed — pending orchestrator action"
metrics:
  duration: "~30 minutes"
  completed: "2026-04-20"
  tasks_completed: 3
  files_created: 5
  files_modified: 2
  cf_loc_added: 505
  index_js_lines_added: 7
---

# Phase 5 Plan 03: Cloud Functions (Auth Gates) Summary

Five Callable Cloud Functions written to `C:/Users/nahde/queuenight/functions/src/`, bcryptjs added to package.json, and all five wired into index.js — ready for `npm install` + `firebase deploy --only functions`.

## What Was Built

| Function | File | Purpose |
|----------|------|---------|
| `setGroupPassword` | src/setGroupPassword.js | Owner-only bcrypt hash + family doc write; invalidates pending invites on rotation |
| `joinGroup` | src/joinGroup.js | Password-or-invite-gated membership write; idempotent via `m_${uid}` memberId |
| `claimMember` | src/claimMember.js | Single-use claim-token redemption; uid assigned to existing member doc atomically |
| `inviteGuest` | src/inviteGuest.js | Owner-issued timed invite with 32-byte base64url token and deep link |
| `transferOwnership` | src/transferOwnership.js | Atomic ownerUid swap with audit trail; verifies target is authed member |

## Environment Confirmed

| Property | Value | Notes |
|----------|-------|-------|
| Node runtime | 22 | package.json `engines.node: "22"` — RESEARCH assumed 20; code is compatible |
| firebase-functions | v4.9.0 (installed) / ^4.6.0 (declared) | v2 path (`lib/v2/providers/https.js`) confirmed present in v4.9.0 |
| firebase-admin | ^12.0.0 | Existing dep — no change |
| bcryptjs | ^2.4.3 (added) | Pure JS — no native-binding build issues on CF deploy |
| Region | us-central1 | Matches existing Trakt functions |
| Existing export style | `exports.xxx = functions.https.onRequest(...)` | Trakt functions use v1 onRequest; new CFs use v2 onCall (correct per plan) |

## Syntax Check Results

All 5 CF files + index.js passed `node --check`:

```
setGroupPassword OK
joinGroup OK
claimMember OK
inviteGuest OK
transferOwnership OK
index.js OK
```

## Must-Have Verification

| Requirement | Status |
|-------------|--------|
| `bcryptjs` in package.json dependencies | PASS — `"bcryptjs": "^2.4.3"` |
| Each CF throws `HttpsError('unauthenticated')` on missing auth | PASS — all 5 files guard `req.auth?.uid` |
| `setGroupPassword` calls `bcrypt.hash(newPassword, 12)` | PASS |
| `setGroupPassword` verifies `ownerUid === uid` | PASS |
| `joinGroup` calls `bcrypt.compare()` | PASS |
| `joinGroup` has `consumeInviteToken` helper with Firestore transaction | PASS |
| `joinGroup` propagates `temporary + expiresAt` from guest invite metadata | PASS — `inviteMetadata.temporary === true` branch sets `memberData.temporary + memberData.expiresAt` |
| `claimMember` uses `runTransaction` on `consumedAt` | PASS |
| `claimMember` checks `consumedAt` for single-use enforcement | PASS |
| `inviteGuest` uses `crypto.randomBytes(32).toString('base64url')` | PASS |
| `inviteGuest` writes invite doc with `expiresAt`, `consumedAt: null`, `metadata.temporary` | PASS |
| `transferOwnership` wraps swap in `runTransaction` | PASS |
| `transferOwnership` verifies current owner + target-authed | PASS — reads `families/{code}` ownerUid and `members/m_{newOwnerUid}` uid field |
| All 5 functions exported in `index.js` | PASS |

## CF Source Metrics

- Total new CF lines: 505 (across 5 files)
- index.js additions: 7 lines (5 exports + 1 comment header + 1 blank line)

## Pending Orchestrator Actions

The following steps were intentionally NOT executed per plan instructions and are pending orchestrator action with user approval:

1. **`npm install`** — run inside `C:/Users/nahde/queuenight/functions/` to install bcryptjs
   ```bash
   cd C:/Users/nahde/queuenight/functions && npm install
   ```

2. **`firebase deploy --only functions`** — deploy all 5 new CFs plus the existing Trakt functions
   ```bash
   cd C:/Users/nahde/queuenight && firebase deploy --only functions
   ```

3. **Post-deploy verification** — confirm in Firebase Console → Functions that all 5 new CFs appear as Healthy in us-central1.

## Deviations from Plan

### 1. [Rule 1 - Deviation] Node runtime is v22, not v20

- **Found during:** Task 1 (environment inspection)
- **Issue:** RESEARCH.md §4 assumed `engines.node: "20"` (assumption A1). Actual package.json has `"node": "22"`.
- **Fix:** No code change needed — all CF code is compatible with Node 22. Documented here.
- **Impact:** None. Node 22 is LTS; bcryptjs, firebase-admin, and firebase-functions v4.9.0 all support it.

### 2. [Rule 1 - Deviation] grep pattern `metadata.temporary` hits comment, not code

- **Found during:** Task 3 verification review
- **Issue:** Plan's automated verify check greps for `metadata.temporary` in joinGroup.js. The implementation stores invite metadata in `inviteMetadata` and checks `inviteMetadata.temporary === true`. The string `metadata.temporary` appears in a comment (not executable code).
- **Fix:** Behavior is correct — the guest expiry propagation is fully implemented. The variable naming diverges from the grep pattern but matches the intent. Documented here so the verifier knows to check `inviteMetadata.temporary` instead of `metadata.temporary`.
- **Files modified:** None — deviation is in naming convention vs grep pattern only.

### 3. [Rule 1 - Deviation] Task 1 (checkpoint:human-verify) auto-skipped

- **Context:** Task 1 was a `checkpoint:human-verify` discovery task gating on access to the sibling repo. The orchestrator's inline instructions confirmed direct write access to `C:/Users/nahde/queuenight/` and provided the resume signal `node20 fn-v2 us-central1 writable` (updated to node22 per actual package.json). Task 1 was treated as confirmed and Tasks 2+3 executed inline.

## Threat Surface Scan

No new network endpoints beyond the 5 declared Callable Functions. All 5 are server-authoritative writes behind Firebase ID token verification. No client-readable passwordHash paths introduced. Threat register in PLAN.md covers all 5 functions (T-05-03-01 through T-05-03-10) — no new surface found beyond the plan's declared scope.

## Self-Check: PASSED

All 5 CF files confirmed present:
- `C:/Users/nahde/queuenight/functions/src/setGroupPassword.js` — exists
- `C:/Users/nahde/queuenight/functions/src/joinGroup.js` — exists
- `C:/Users/nahde/queuenight/functions/src/claimMember.js` — exists
- `C:/Users/nahde/queuenight/functions/src/inviteGuest.js` — exists
- `C:/Users/nahde/queuenight/functions/src/transferOwnership.js` — exists

package.json bcryptjs confirmed. index.js exports confirmed. All syntax checks passed.
