---
phase: 13-compliance-and-ops
plan: "01"
subsystem: compliance
tags: [account-deletion, gdpr, ccpa, cloud-functions, firestore, pwa]
dependency_graph:
  requires: []
  provides: [COMP-13-01-account-deletion-backend, COMP-13-01-account-deletion-ui]
  affects: [js/app.js, app.html, css/app.css, sw.js, queuenight/functions]
tech_stack:
  added:
    - firebase-functions/v2/https onCall (requestAccountDeletion, cancelAccountDeletion, checkAccountDeleteEligibility)
    - firebase-functions/v2/scheduler onSchedule (accountDeletionReaper — hourly)
    - Admin SDK db.recursiveDelete (firebase-admin ^12.0.0, already pinned)
    - Admin SDK db.collectionGroup('members') fallback for family discovery
    - Admin SDK admin.auth().deleteUser (terminal step)
    - Admin SDK admin.storage().bucket().getFiles (couch-albums sweep)
  patterns:
    - Soft-delete with 14-day grace window (deletionRequestedAt + hardDeleteAt fields)
    - Dual-path family discovery (reverse-index + collectionGroup fallback, de-duped by familyCode)
    - Sessions sweep: delete-if-expired (dateKey < today) OR scrub-in-place (actingUid/votes/vetoes/chooserHistory/participants)
    - Admin SDK recursiveDelete with BulkWriter fallback (no firebase-tools CLI in CF runtime)
    - Typed-DELETE confirmation modal (autocapitalize="characters", client-side gate + CF-side gate)
    - Sign-in soft-delete detour (onAuthStateChangedCouch wedge before startUserGroupsSubscription)
key_files:
  created:
    - C:\Users\nahde\queuenight\functions\src\requestAccountDeletion.js
    - C:\Users\nahde\queuenight\functions\src\cancelAccountDeletion.js
    - C:\Users\nahde\queuenight\functions\src\checkAccountDeleteEligibility.js
    - C:\Users\nahde\queuenight\functions\src\accountDeletionReaper.js
    - C:\Users\nahde\queuenight\firestore.indexes.json
  modified:
    - C:\Users\nahde\queuenight\functions\index.js (+5 lines: 4 exports + comment)
    - C:\Users\nahde\queuenight\firebase.json (+1 line: firestore.indexes pointer)
    - C:\Users\nahde\claude-projects\couch\app.html (+42 lines: 1 button + 3 modals)
    - C:\Users\nahde\claude-projects\couch\css\app.css (+27 lines: destructive-confirm generalization + delete-account styles)
    - C:\Users\nahde\claude-projects\couch\sw.js (1 line changed: CACHE bump v32.2 -> v33)
    - C:\Users\nahde\claude-projects\couch\js\app.js (+144 lines: 6 handlers + soft-delete detour)
decisions:
  - "firebase-admin already at ^12.0.0 — no package.json change needed (HIGH-3 resolved without a bump)"
  - "firestore.rules /users/{u} already had allow read, write: if signedIn() && u == uid() — no rule change needed (self-read already covered)"
  - "queuenight is a deploy mirror (not a git repo) — CF files written to disk, committed in couch worktree only"
  - "soft-delete detour wedged before startUserGroupsSubscription so early return prevents subscription start on pending-deletion sign-in"
metrics:
  duration: "~35 minutes"
  completed: "2026-04-25T16:21:12Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 5
  files_modified: 6
---

# Phase 13 Plan 01: COMP-13-01 Self-Serve Account Deletion Summary

**One-liner:** Self-serve account deletion with 14-day grace window: typed-DELETE modal, 3 callables + hourly reaper (Admin SDK recursiveDelete + collectionGroup fallback + sessions sweep), sign-in soft-delete detour, sw.js v33 cache bust.

## Commits

| Hash | Message |
|------|---------|
| `ccd3eec` | feat(13-01): add delete-account button + 3 modals + destructive-confirm class generalization + sw.js v33 bump |
| `4fc49ee` | feat(13-01): add delete-account modal handlers + sign-in soft-delete detour (fallback contact privacy@couchtonight.app per review) |

Note: queuenight/ CF files (4 new, 2 modified) are written to the deploy mirror filesystem and will be committed to the queuenight deploy flow by the user after this wave completes. They are not tracked in the couch git tree per the deploy-mirror pattern.

## Files Modified

| File | Delta | Notes |
|------|-------|-------|
| `queuenight/functions/src/requestAccountDeletion.js` | NEW ~43 lines | Soft-delete entry callable; 14-day grace; owner-of-family defense-in-depth |
| `queuenight/functions/src/cancelAccountDeletion.js` | NEW ~22 lines | Clears deletionRequestedAt + hardDeleteAt; sets deletionCancelledAt |
| `queuenight/functions/src/checkAccountDeleteEligibility.js` | NEW ~22 lines | Read-only owner pre-flight; returns {eligible, ownedFamilies} |
| `queuenight/functions/src/accountDeletionReaper.js` | NEW ~270 lines | Hourly scheduled reaper with all 3 review fixes (HIGH-1/2/3) |
| `queuenight/functions/index.js` | +5 lines | 4 exports + comment registered at end of exports block |
| `queuenight/firestore.indexes.json` | NEW 11 lines | collectionGroup members index on uid (HIGH-2) |
| `queuenight/firebase.json` | +1 line | Added `"indexes": "firestore.indexes.json"` to firestore block |
| `app.html` | +42 lines | delete-account-btn + 3 modals (typed-DELETE, blocker, deletion-pending) |
| `css/app.css` | +27 lines | .destructive-confirm generalization + #delete-account-confirm-input styles |
| `sw.js` | 1 line changed | CACHE: couch-v32.2-asset-cache-control → couch-v33-comp-13-01-account-deletion |
| `js/app.js` | +144 lines | 6 window handlers + onAuthStateChangedCouch soft-delete detour |

## STRIDE Threat Register — All 12 Threats

| Threat ID | Category | Component | Disposition | Code Reference |
|-----------|----------|-----------|-------------|----------------|
| T-13-01-01 | E (Elevation) | requestAccountDeletion CF | mitigate | `requestAccountDeletion.js:13` — uid from `req.auth.uid` only; payload uid ignored |
| T-13-01-02 | T (Tampering) | accountDeletionReaper at hard-delete | mitigate | `accountDeletionReaper.js` — `fresh.data().hardDeleteAt > now` re-check inside per-uid loop |
| T-13-01-03 | I (Info disclosure) | Storage couch-albums during grace | mitigate | Storage sweep at hard-delete time (step 3, after Firestore sweeps, before Auth delete) |
| T-13-01-04 | I (Info disclosure) | PII via error reporting | mitigate | console.error to Cloud Logging only; cross-cuts with Plan 13-02 Sentry beforeSend |
| T-13-01-05 | A (Availability) | cancelAccountDeletion silent fail | mitigate | `cancelMyDeletion` checks `r.data.ok` before clearing UI |
| T-13-01-06 | E (Elevation) | Owner-of-family blocks deletion | mitigate | Two layers: `openDeleteAccountConfirm` eligibility pre-flight + CF re-checks `owned` |
| T-13-01-07 | D (DoS) | requestAccountDeletion rate-limit | accept | Auth gate prevents unauthenticated abuse |
| T-13-01-08 | T (Tampering) | Reaper retries leaving partial state | mitigate | Per-uid try/catch writes lastDeletionAttemptError; all sweeps are idempotent |
| T-13-01-09 | I (Info disclosure) | firestore.rules /users/{uid} read leak | mitigate | Pre-existing rule already scoped to `request.auth.uid == uid` — confirmed, no change needed |
| T-13-01-10 | A+I | Reaper uses CLI tool in CF runtime | mitigate | **HIGH-3:** Admin SDK `db.recursiveDelete` with BulkWriter fallback; no firebase-tools dep |
| T-13-01-11 | I (Info disclosure) | Stale users/{uid}/groups reverse index | mitigate | **HIGH-2:** `discoverFamilyCodes` queries both reverse-index AND `collectionGroup('members').where('uid','==',uid)` |
| T-13-01-12 | I (Info disclosure) | Vote/veto attribution left in sessions | mitigate | **HIGH-1:** `sweepSessionsForFamily` deletes expired session docs or scrubs actingUid/votes/vetoes/chooserHistory/participants in active ones |

## Review Fix Evidence

### HIGH-1: Sessions Sweep
`sweepSessionsForFamily(famRef, uid)` in `accountDeletionReaper.js`:
- Iterates `families/{familyCode}/sessions` subcollection
- Expired sessions (dateKey < today OR lastUpdatedAt > 30 days ago) → `sessDoc.ref.delete()`
- Active sessions → atomic update scrubbing: `actingUid=null`, `participants.{uid}=FieldValue.delete()`, `votes.{titleId}.{uid}=FieldValue.delete()`, `vetoes` and `chooserHistory` arrays filtered
- Audit log records `sweepCounts.sessionsDeleted` + `sweepCounts.sessionsScrubbed`

### HIGH-2: collectionGroup Family Discovery Fallback
`discoverFamilyCodes(uid)` in `accountDeletionReaper.js`:
- Primary: `db.collection('users').doc(uid).collection('groups').get()` (reverse-index)
- Fallback: `db.collectionGroup('members').where('uid', '==', uid).get()` (catches stale/missing indexes)
- De-duped via `Set<familyCode>`
- `firestore.indexes.json` (NEW): `{"collectionGroup":"members","queryScope":"COLLECTION_GROUP","fields":[{"fieldPath":"uid","order":"ASCENDING"}]}`
- `firebase.json` updated with `"indexes": "firestore.indexes.json"` so `firebase deploy --only firestore:indexes` works
- **Deploy note:** Index build takes a few minutes after first deploy; reaper falls through gracefully (logs warning, uses reverse-index-only result) if index not yet READY

### HIGH-3: Admin SDK recursiveDelete (No firebase-tools in CF)
`recursiveDeleteRef(ref)` in `accountDeletionReaper.js`:
- `if (typeof db.recursiveDelete === 'function')` → `await db.recursiveDelete(ref)` (Admin SDK >= 11.5)
- Fallback: BulkWriter + `recursiveDeleteManual` (manual subcollection traversal for older Admin SDKs)
- `firebase-admin ^12.0.0` already pinned in `package.json` — no bump needed
- `grep -c "require('firebase-tools')" src/accountDeletionReaper.js` → 0 (verified)
- `"firebase-tools"` absent from `package.json` dependencies (verified)

### MEDIUM-9: Must-Have Wording Alignment
Must-haves explicitly enumerate the sessions sweep (HIGH-1) and collectionGroup fallback (HIGH-2) — no "all PII" overclaim. The must-have "hard-delete claim is now backed by code that actually delivers it" is satisfied by the sessions sweep implementation.

### MEDIUM-10: Fallback Contact Email
All user-facing fallback toast strings use `privacy@couchtonight.app`:
- `performDeleteAccount` generic fallback: `"Couldn't schedule deletion. Try again or email privacy@couchtonight.app."`
- `nahderz@gmail.com` appears only in the pre-existing feedback `mailto:` link (line 4979 — not Phase 13 code)

## Deviations from Plan

### Auto-resolved: firestore.rules already covered
The plan specified adding a `match /users/{uid} { allow read: ... }` rule. On reading the file, the existing rule at line 98-100 already covers self-read: `allow read, write: if signedIn() && u == uid()`. No change was needed — the rule is additive-compatible and the sign-in detour's `getDoc` call will succeed under the existing rule.

### Auto-resolved: firebase-admin already at ^12.0.0
Plan Step 1.6 said to bump firebase-admin if pinned below 11.5. Package.json already had `"firebase-admin": "^12.0.0"`. No change needed.

### Auto-resolved: worktree path isolation
Edits to `app.html`, `css/app.css`, `sw.js`, `js/app.js` were made to the worktree copies at `.claude/worktrees/agent-af13dfa24b5c4e93d/` rather than the main repo files — this is the correct behavior for parallel agent execution in a git worktree.

## Known Stubs

None. All handlers are fully wired: eligibility CF called, requestAccountDeletion CF called, cancelAccountDeletion CF called, soft-delete detour reads Firestore. No hardcoded empty values or placeholder text in the feature path.

## Threat Flags

None. All new network endpoints (4 Cloud Functions) were planned and are in the threat register. The Firestore collectionGroup query is index-backed. The `deletionAudits` collection is admin-SDK-only (no client-read rule needed).

## Deploy Steps Required (User Action)

Per `user_setup` in the plan frontmatter:

1. **Deploy Cloud Functions:**
   ```
   cd C:\Users\nahde\queuenight
   firebase deploy --only functions:requestAccountDeletion,functions:cancelAccountDeletion,functions:checkAccountDeleteEligibility,functions:accountDeletionReaper --project queuenight-84044
   ```
2. **Verify Cloud Scheduler job** auto-created: `firebase-schedule-accountDeletionReaper-us-central1` in GCP Console > Cloud Scheduler > us-central1

3. **Deploy Firestore indexes (HIGH-2):**
   ```
   firebase deploy --only firestore:indexes --project queuenight-84044
   ```
   Index build may take a few minutes. Verify READY state in GCP Console > Firestore > Indexes before relying on the collectionGroup fallback path.

4. **Deploy hosting** (handled by Plan 13-03 deploy.sh after wave completes).

## Deferred Items

- **RESEARCH.md Open Question #1:** Deletion-confirmation push notification at soft-delete time (nice-to-have; deferred)
- **RESEARCH.md Open Question #3:** Feature flag for v1 soft-launch of deletion UI (deferred; button ships enabled)
- **Manual UAT** deferred to `/gsd-verify-work` after deploy (see plan verification section for full UAT script)

## Self-Check: PASSED

Files verified:
- `FOUND: /c/Users/nahde/queuenight/functions/src/requestAccountDeletion.js` ✓
- `FOUND: /c/Users/nahde/queuenight/functions/src/cancelAccountDeletion.js` ✓
- `FOUND: /c/Users/nahde/queuenight/functions/src/checkAccountDeleteEligibility.js` ✓
- `FOUND: /c/Users/nahde/queuenight/functions/src/accountDeletionReaper.js` ✓
- `FOUND: /c/Users/nahde/queuenight/firestore.indexes.json` ✓
- `node --check` passes on all 4 CF files and index.js ✓
- Commits `ccd3eec` and `4fc49ee` exist in git log ✓
- `app.html` contains `delete-account-modal-bg`, `delete-account-blocker-bg`, `deletion-pending-bg`, `delete-account-btn` ✓
- `sw.js` CACHE = `couch-v33-comp-13-01-account-deletion` ✓
- `css/app.css` contains `.destructive-confirm` and `#delete-account-confirm-input` ✓
- `js/app.js` contains all 6 window handlers, soft-delete-detour, `privacy@couchtonight.app` ✓
