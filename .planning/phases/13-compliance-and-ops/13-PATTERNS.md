# Phase 13: Compliance & Ops Sprint — Pattern Map

**Mapped:** 2026-04-25
**Files analyzed:** 14 distinct touch-points (5 NEW Cloud Functions, 4 NEW client/ops files, 5 MODIFY surfaces)
**Analogs found:** 13 / 14 matched (1 — global error handler — is greenfield; Sentry loader auto-instruments so no analog needed)

> **Scope posture:** Phase 13 is operational hygiene on a mature post-Phase-12 surface. Cloud Function additions land in sibling repo `C:\Users\nahde\queuenight\functions\src\` (NOT under `C:\Users\nahde\claude-projects\queuenight\` — that path was suggested in CONTEXT.md and does not exist; the real path is `C:\Users\nahde\queuenight\`). Frontend additions land in `js/app.js` + `app.html` + `landing.html`. Ops scripts land in `couch/scripts/` and `.planning/`.
>
> **Read discipline:** `js/app.js` (~10200 lines) was Grep'd then Read with offset/limit at lines 1, 2070-2120, 2640-2820, 3050-3120, 9420-9430. `css/app.css` (~2360 lines) similarly Grep'd then Read at 470-498 and 2645-2660. Cloud Functions read in full (each <200 lines). All reads non-overlapping; no range re-read.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **NEW** `queuenight/functions/src/requestAccountDelete.js` | callable CF (auth-bound, soft-delete writer) | request-response | `queuenight/functions/src/transferOwnership.js` | **exact** (auth-gated callable + Firestore admin write + auditable timestamp) |
| **NEW** `queuenight/functions/src/cancelAccountDelete.js` | callable CF (auth-bound, flag-clearer) | request-response | `queuenight/functions/src/setGroupPassword.js` | **exact** (auth-gated callable + idempotent flag flip) |
| **NEW** `queuenight/functions/src/checkAccountDeleteEligibility.js` | callable CF (auth-bound, read-only pre-flight) | request-response | `queuenight/functions/src/transferOwnership.js` (auth-gate header) + `consumeGuestInvite.js` `preview:true` branch | **exact** (read-only response shape + auth guard) |
| **NEW** `queuenight/functions/src/deletionReaperTick.js` | scheduled CF (cascading delete + Firestore + Storage + Auth) | scheduled / batch | `queuenight/functions/index.js:435-516` (`watchpartyTick`) + `rsvpReminderTick.js` | **exact** (per-family iteration + status flip + idempotent retry; cascading mutate matches watchpartyTick scope) |
| **MODIFY** `queuenight/functions/index.js` | CF index registration | config | Existing `exports.<name> = require('./src/<name>').<name>` block at `index.js:638-656` | **exact** (drop-in line additions) |
| **MODIFY** `queuenight/functions/package.json` | dependency declaration | config | Existing `dependencies` block | **exact** (add `firebase-tools` line) |
| **MODIFY** `queuenight/firebase.json` | Hosting headers (CSP-Report-Only) | config | Existing `**/*` headers entry at `firebase.json:71-78` (XCTO + Referrer-Policy + X-Frame-Options) | **exact** (additive 4th header) |
| **MODIFY** `js/app.js` Account-ADMIN delete button + modal handlers | JS event-handler + modal driver | request-response | `confirmLeaveFamily()` / `closeLeaveFamilyConfirm()` / `performLeaveFamily()` at `js/app.js:2667-2688` + `transferOwnershipTo()` at `:3093-3116` | **exact** (two-tap modal pattern + httpsCallable error-mapping) |
| **MODIFY** `js/app.js` PII-scrub helper for Sentry | JS utility (event mutator) | transform | No existing PII-scrub helper — net-new. Closest analog: `escapeHtml` at `js/utils.js` (single-input string transform) | **role-match** (signature parallel; logic net-new) |
| **MODIFY** `app.html` `<head>` Sentry loader script + `sentryOnLoad` block | HTML inline script | config | Existing inline-script-in-head: `landing.html:35-44` (PWA standalone redirect IIFE) — but `app.html` itself has no current `<head>` inline script | **role-match** (head inline script with one-shot init); Sentry block goes BEFORE `<link rel="stylesheet" href="/css/app.css">` at `app.html:54` |
| **MODIFY** `app.html` Delete-account button + confirmation modal HTML | HTML button + modal-bg block | presentation | `<button class="pill" id="leave-family-btn" onclick="confirmLeaveFamily()">` at `app.html:710` + leave-family modal at `app.html:731-741` | **exact** (clone-and-rename) |
| **MODIFY** `landing.html` `<head>` Sentry loader | HTML inline script | config | Existing inline-script-in-head: `landing.html:35-44` (standalone redirect IIFE) | **exact** (sibling addition in same `<head>`) |
| **MODIFY** `css/app.css` Delete-account button red variant + modal style | CSS component | presentation | `.leave-family-confirm{background:var(--bad);...}` at `css/app.css:2654-2656` + `.settings-row .pill.warn` at `css/app.css:2265` | **exact** (clone token usage; same `--bad` color token) |
| **MODIFY** `sw.js` CACHE bump | Cache versioning | config | Existing `const CACHE = 'couch-v32.2-asset-cache-control';` at `sw.js:8` | **exact** (regex replace per CLAUDE.md convention) |
| **NEW** `couch/scripts/deploy.sh` | shell script (build orchestration) | batch | `couch/scripts/stamp-build-date.cjs` (existing — invoked BY deploy.sh, not analog FOR it) | **role-match** (no existing shell script in repo; pattern from RESEARCH.md §Pattern 5) |
| **NEW** `couch/scripts/firestore-export-setup.sh` (or inline in RUNBOOK.md) | shell script (one-time gcloud setup) | batch | RESEARCH.md §Pattern 3 inline gcloud snippet | **no analog** (greenfield ops doc; document inline in RUNBOOK.md preferred over standalone .sh) |
| **MODIFY** `.planning/RUNBOOK.md` | runbook doc | docs | Existing §A through §G structure at `RUNBOOK.md:1-224` | **exact** (append new §H, §I, §J sections) |
| **MODIFY** `.planning/TECH-DEBT.md` | tech-debt doc | docs | Existing TD-1..TD-5 entries (read first) | **exact** (status flips on existing entries) |

## Pattern Assignments

### `queuenight/functions/src/requestAccountDelete.js` (NEW — callable CF)

**Analog:** `queuenight/functions/src/transferOwnership.js` (auth-gated callable + admin Firestore write + audit trail field)

**Imports pattern** (transferOwnership.js:21-25 → copy verbatim):
```javascript
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
```

**Auth gate pattern** (transferOwnership.js:27-32 → copy structure, drop `familyCode` param):
```javascript
exports.requestAccountDelete = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) {
    throw new HttpsError('unauthenticated', 'Sign in required');
  }
  // ... validation ...
});
```

**Why this analog:** Both are user-initiated destructive callables that:
1. Auth-gate via `req.auth.uid` then alias to a local `uid` variable
2. Use `firebase-functions/v2/https` (NOT v1 functions namespace)
3. Specify `region: 'us-central1'` explicitly (matches all other Couch CFs)
4. Write to Firestore via admin SDK to bypass per-user rules (legitimate admin op)
5. Stamp audit-trail timestamps (`previousOwnerUid` / `ownershipTransferredAt` in transferOwnership; `deletionRequestedAt` / `hardDeleteAt` for COMP-01)

**Concrete signature the new CF must match:**
```javascript
exports.requestAccountDelete = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30
}, async (req) => {
  // Returns: { success: true, hardDeleteAt: <ms-since-epoch> }
});
```

The `cors`/`memory`/`timeoutSeconds` triple is from `rsvpSubmit.js:48-51` — copy verbatim. Bare `{ region: 'us-central1' }` (transferOwnership style) also valid; pick one and stay consistent across the 3 new callables.

**Write-shape contract** (deletionRequestedAt + hardDeleteAt — uses serverTimestamp like consumeGuestInvite.js:122-125):
```javascript
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
const hardDeleteAt = Date.now() + FOURTEEN_DAYS_MS;
await admin.firestore().collection('users').doc(uid).set({
  deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
  hardDeleteAt: hardDeleteAt
}, { merge: true });
```

**Confirmation gate pattern** (mirrors rsvpSubmit.js:55-65 input-validation block):
```javascript
const { confirm } = (req.data || {});
if (confirm !== 'DELETE') {
  throw new HttpsError('failed-precondition', 'Confirmation phrase missing or wrong.');
}
```

---

### `queuenight/functions/src/cancelAccountDelete.js` (NEW — callable CF)

**Analog:** `queuenight/functions/src/setGroupPassword.js` (76 lines — confirmed by `wc -l`; auth-gated callable that toggles a single Firestore flag idempotently)

**Why this analog:** setGroupPassword is the simplest existing callable that does a flag-flip with `merge:true` against a Firestore doc keyed by an auth-bound identifier. cancelAccountDelete has identical shape — auth uid → clear two fields on `users/{uid}` → return `{ok:true}`.

**Signature contract:**
```javascript
exports.cancelAccountDelete = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  await admin.firestore().collection('users').doc(uid).set({
    deletionRequestedAt: admin.firestore.FieldValue.delete(),
    hardDeleteAt: admin.firestore.FieldValue.delete(),
    deletionCancelledAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});
```

The `FieldValue.delete()` idiom for clearing fields in `merge:true` writes is standard Firestore admin SDK (Couch already uses `admin.firestore.FieldValue.delete()` at `index.js:145` in the dead-push-subscription pruner — pattern verified in repo).

---

### `queuenight/functions/src/checkAccountDeleteEligibility.js` (NEW — callable CF)

**Analog:** `queuenight/functions/src/consumeGuestInvite.js:87-90` — the `preview === true` branch that returns metadata without mutating.

**Why this analog:** consumeGuestInvite has a documented dual-mode (preview vs consume) pattern. The Phase 13 eligibility check is a pure-read variant of the same idea: return `{eligible:bool, ownedFamilies:[...]}` without writing.

**Concrete pattern from RESEARCH.md §Example 4** (already vetted):
```javascript
exports.checkAccountDeleteEligibility = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 15
}, async (req) => {
  if (!req.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const uid = req.auth.uid;
  const owned = await admin.firestore().collection('families').where('ownerUid', '==', uid).get();
  return {
    eligible: owned.empty,
    ownedFamilies: owned.docs.map(d => ({ familyCode: d.id, name: d.data().name || d.id }))
  };
});
```

**Owner-of-family field name verified:** `families/{code}.ownerUid` is the canonical owner field — confirmed in `transferOwnership.js:52` (`fam.data().ownerUid !== uid`) and `transferOwnership.js:77` (`tx.update(familyRef, { ownerUid: newOwnerUid, ... })`).

---

### `queuenight/functions/src/deletionReaperTick.js` (NEW — scheduled CF)

**Analog:** `queuenight/functions/index.js:435-516` (`watchpartyTick`) + `queuenight/functions/src/rsvpReminderTick.js:57-182`

**Imports pattern** (rsvpReminderTick.js:23-29):
```javascript
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```

**Schedule wrapper signature** (watchpartyTick at index.js:435-440 — adjust schedule cadence):
```javascript
exports.deletionReaperTick = onSchedule({
  schedule: 'every 1 hours',     // hourly per RESEARCH.md §Pattern 2
  region: 'us-central1',
  timeoutSeconds: 540,            // max for v2 scheduled (from RESEARCH §Pattern 2; watchpartyTick uses 120 because lighter work)
  memory: '512MiB'                // up from 256MiB because firebase-tools recursive delete
}, async () => {
  // ...
});
```

**Per-family iteration pattern** (watchpartyTick:445-513 — exact):
```javascript
const families = await db.collection('families').get();
for (const familyDoc of families.docs) {
  let xxxSnap;
  try {
    xxxSnap = await db.collection('families').doc(familyDoc.id).collection('xxx').get();
  } catch (e) { console.warn('xxx list failed', familyDoc.id, e.message); continue; }
  for (const doc of xxxSnap.docs) {
    try {
      // mutation
    } catch (e) {
      console.warn('per-doc failed', familyDoc.id, doc.id, e.message);
      errored++;
    }
  }
}
console.log('xxxTick done', { ...counters });
return null;
```

**Idempotent retry pattern** (RESEARCH.md §Pattern 2 — copy verbatim):
```javascript
} catch (e) {
  // Idempotent: leave the user doc in place; log; next tick will retry
  console.error('deletionReaperTick failed for uid', uid, e.message);
  await db.collection('users').doc(uid).set({
    lastDeletionAttemptError: e.message,
    lastDeletionAttemptAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}
```

**Storage path enumeration** (RESEARCH.md §Storage path enumeration — verified against `js/app.js:9424-9425`):
```javascript
const bucket = admin.storage().bucket();  // default queuenight-84044.firebasestorage.app
for (const familyCode of familyCodes) {
  const [files] = await bucket.getFiles({ prefix: `couch-albums/${familyCode}/` });
  const mine = files.filter(f => f.name.includes(`_${uid}.jpg`));
  await Promise.all(mine.map(f => f.delete()));
}
```

**Filename pattern verified at `js/app.js:9425`:**
```javascript
const path = `couch-albums/${state.familyCode}/${_postSessionWpId}/${ts}_${uidForPath}.jpg`;
```
The `_${uid}.jpg` suffix substring is the reliable filter — `uidForPath` is the auth uid for adult members (verified at `js/app.js:9424`).

**Storage rule path verified at `queuenight/storage.rules:29`:**
```
match /couch-albums/{familyCode}/{wpId}/{filename} { ... }
```

**Auth deletion** (terminal step — admin SDK):
```javascript
await admin.auth().deleteUser(uid);
```

This is the only Firebase Auth admin call in the new CF; admin SDK already initialized via `admin.initializeApp()` (line 1 of file). No new imports needed.

**Twelve sweep paths from RESEARCH.md "Collections that reference user uid":** every plan action MUST enumerate all 12 paths explicitly (the planner should NOT collapse to "recursiveDelete users/{uid}" because per-family-nested data lives under `families/{code}/...`, not under `users/{uid}/...`). See RESEARCH.md table for the full list.

---

### `queuenight/functions/index.js` (MODIFY — register new exports)

**Analog (existing block at lines 638-656):**
```javascript
exports.setGroupPassword = require('./src/setGroupPassword').setGroupPassword;
exports.joinGroup = require('./src/joinGroup').joinGroup;
exports.claimMember = require('./src/claimMember').claimMember;
exports.inviteGuest = require('./src/inviteGuest').inviteGuest;
exports.transferOwnership = require('./src/transferOwnership').transferOwnership;
exports.mintClaimTokens = require('./src/mintClaimTokens').mintClaimTokens;
// ...
exports.consumeGuestInvite = require('./src/consumeGuestInvite').consumeGuestInvite;
// ...
exports.rsvpSubmit = require('./src/rsvpSubmit').rsvpSubmit;
exports.rsvpReminderTick = require('./src/rsvpReminderTick').rsvpReminderTick;
```

**Edit contract — add 4 lines at the end of the registration block:**
```javascript
exports.requestAccountDelete = require('./src/requestAccountDelete').requestAccountDelete;
exports.cancelAccountDelete = require('./src/cancelAccountDelete').cancelAccountDelete;
exports.checkAccountDeleteEligibility = require('./src/checkAccountDeleteEligibility').checkAccountDeleteEligibility;
exports.deletionReaperTick = require('./src/deletionReaperTick').deletionReaperTick;
```

**No edits needed elsewhere in index.js.** The reaper does NOT need to call `sendToMembers` (RESEARCH.md "Open Questions #1" defers deletion-confirmation push to Milestone 2). If push confirmation IS added in plan: lazy-require pattern from rsvpReminderTick.js:64-71 (NOT top-level require — would cause circular dep with index.js exporting sendToMembers at line 659).

---

### `queuenight/functions/package.json` (MODIFY — add firebase-tools dep)

**Current state** (line 14-19):
```json
"dependencies": {
    "bcryptjs": "^2.4.3",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.6.0",
    "web-push": "^3.6.7"
  },
```

**Edit contract — add one line, alphabetical insertion between `firebase-functions` and `web-push`:**
```json
"dependencies": {
    "bcryptjs": "^2.4.3",
    "firebase-admin": "^12.0.0",
    "firebase-functions": "^4.6.0",
    "firebase-tools": "^13.0.0",
    "web-push": "^3.6.7"
  },
```

Pin to a specific 13.x at install via `cd /c/Users/nahde/queuenight/functions && npm install firebase-tools` — the package.json line auto-updates with `^<version>`. **Do NOT skip Phase 13's deferred OPS-01** — keep `firebase-functions` at `^4.6.0` (NOT 7.x); RESEARCH.md §Standard Stack confirms TD-1's v4→v7 migration is Phase 14 work, not Phase 13.

**Cold-start impact note** (RESEARCH.md "Runtime State Inventory"): firebase-tools adds ~30MB to the CF bundle. Acceptable for `deletionReaperTick` (scheduled, hourly, not user-facing). NOT acceptable for high-traffic synchronous CFs — but no Phase 13 onCall imports firebase-tools, so contained.

---

### `queuenight/firebase.json` (MODIFY — CSP-Report-Only header)

**Current state** (lines 71-78 — confirmed by direct read; this is the existing `**/*` headers block):
```json
{
  "source": "**/*",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "X-Frame-Options", "value": "DENY" }
  ]
}
```

**Edit contract — additive 4th header object inside the same `headers` array:**
```json
{
  "source": "**/*",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "X-Frame-Options", "value": "DENY" },
    {
      "key": "Content-Security-Policy-Report-Only",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com https://*.sentry-cdn.com https://browser.sentry-cdn.com https://www.gstatic.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://image.tmdb.org https://*.googleusercontent.com https://firebasestorage.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://us-central1-queuenight-84044.cloudfunctions.net https://api.themoviedb.org https://image.tmdb.org https://api.trakt.tv https://*.ingest.us.sentry.io; frame-src 'self' https://queuenight-84044.firebaseapp.com https://*.firebaseapp.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    }
  ]
}
```

**Critical:** Phase 12 (commit history per CONTEXT.md) shipped XCTO + Referrer-Policy + X-Frame-Options. Preserve those three values **verbatim** — additive only. Use `Content-Security-Policy-Report-Only` (NOT `Content-Security-Policy`) per CONTEXT.md "Pre-planning decisions" addendum: "Start in Report-Only mode for v1; flip to enforcing in a later sprint after console reports are clean."

**`report-uri` directive omitted** per RESEARCH.md "Open Questions #5" recommendation: "Ship report-only WITHOUT a sink in v1." Browser console is sufficient for solo-dev introspection in week 1-2 post-deploy.

---

### `js/app.js` Account-ADMIN delete button + modal handlers (MODIFY)

**Analog 1 — confirmation modal driver:** `js/app.js:2667-2688` (`confirmLeaveFamily`, `closeLeaveFamilyConfirm`, `performLeaveFamily`). This is the **exact same shape** Phase 13 needs.

**Existing pattern (read verbatim from js/app.js:2667-2688):**
```javascript
window.confirmLeaveFamily = function() {
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.add('on');
};
window.closeLeaveFamilyConfirm = function() {
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.remove('on');
};
window.performLeaveFamily = async function() {
  // Close the modal first so it doesn't linger during the async leave work.
  const bg = document.getElementById('leave-family-confirm-bg');
  if (bg) bg.classList.remove('on');
  // Delegate to the existing leave path. We set a flag so window.leaveFamily's
  // built-in confirm() gets bypassed — it was the destructive gate we just
  // handled via the modal.
  window._leaveFamilyConfirmed = true;
  try {
    await window.leaveFamily();
  } finally {
    window._leaveFamilyConfirmed = false;
  }
};
```

**Phase 13 clone — three sibling functions for delete-account flow:**
```javascript
window.openDeleteAccountConfirm = async function() { /* pre-flight via checkAccountDeleteEligibility */ };
window.closeDeleteAccountModal = function() { /* mirrors closeLeaveFamilyConfirm */ };
window.performDeleteAccount = async function() { /* mirrors performLeaveFamily — calls requestAccountDelete then signOut */ };
```

**Analog 2 — httpsCallable invocation + error mapping:** `transferOwnershipTo()` at `js/app.js:3093-3116` (verified by direct Read).

**Existing pattern (lines 3093-3116):**
```javascript
window.transferOwnershipTo = async function() {
  const sel = document.getElementById('settings-transfer-target');
  const newOwnerUid = sel && sel.value;
  if (!newOwnerUid) { flashToast('Pick a member first', { kind: 'warn' }); return; }
  if (!confirm('Transfer ownership? The new owner has to agree before you can get it back.')) return;
  try {
    const fn = httpsCallable(functions, 'transferOwnership');
    const r = await fn({ familyCode: state.familyCode, newOwnerUid });
    if (r.data && r.data.ok) {
      flashToast('Ownership transferred', { kind: 'success' });
      haptic('success');
    }
  } catch(e) {
    console.error('[transfer-ownership]', e);
    const code = e && e.code;
    const msg = (code === 'failed-precondition' || code === 'functions/failed-precondition')
      ? 'That member has no account yet.'
      : (code === 'permission-denied' || code === 'functions/permission-denied')
        ? 'Only the current owner can transfer.'
        : "Couldn't transfer. Try again?";
    flashToast(msg, { kind: 'warn' });
  }
};
```

**Phase 13 clone for `performDeleteAccount`:**
```javascript
window.performDeleteAccount = async function() {
  const typed = document.getElementById('delete-account-confirm-input').value;
  if (typed !== 'DELETE') {
    document.getElementById('delete-account-error').textContent = 'Type DELETE in capitals to confirm.';
    return;
  }
  document.getElementById('delete-account-modal-bg').classList.remove('on');
  try {
    const fn = httpsCallable(functions, 'requestAccountDelete');
    const r = await fn({ confirm: 'DELETE' });
    if (r.data && r.data.success) {
      flashToast('Deletion scheduled. Signing out…', { kind: 'success' });
      haptic('success');
      setTimeout(() => signOut(), 2000);
    }
  } catch(e) {
    console.error('[delete-account]', e);
    const code = e && e.code;
    const msg = (code === 'failed-precondition' || code === 'functions/failed-precondition')
      ? 'Transfer family ownership first.'
      : (code === 'unauthenticated' || code === 'functions/unauthenticated')
        ? 'Sign in to delete your account.'
        : "Couldn't schedule deletion. Try again or email nahderz@gmail.com.";
    flashToast(msg, { kind: 'warn' });
  }
};
```

**Imports already available** (verified at `js/app.js:1`):
```javascript
import { db, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch, auth, functions, httpsCallable, ... } from './firebase.js';
```

`functions` and `httpsCallable` are both already imported — **no new imports needed**.

**signOut available** at `js/app.js:2653-2659` (verified):
```javascript
window.signOut = async function() {
  try { haptic('light'); } catch(e) {}
  try { await signOutUser(); }
  catch(e) { console.error('[signout]', e); }
};
```

**Sign-in side check (RESEARCH.md "Pitfall 2"):** Plan action MUST add a soft-delete check in `onAuthStateChangedCouch` (around `js/app.js:2070-2083` — verified by Read). When `users/{uid}.deletionRequestedAt` is set + not expired, render a banner with "Cancel deletion" CTA that calls `cancelAccountDelete`. The reading site is line 2070; the existing handler signs the user in via `startUserGroupsSubscription(user.uid)` first, then routes — wedge the deletion-pending check between those two.

---

### `js/app.js` PII-scrub helper for Sentry `beforeSend` (MODIFY — net-new function)

**Closest analog (role-match):** `escapeHtml` in `js/utils.js` — single-input transform with regex replacements. Sentry's `beforeSend` receives an `event` object and returns a (possibly mutated) `event` object — so the closest functional shape is a transform helper.

**No exact analog** for "iterate event payload + redact PII fields by name + regex-replace tokens in stack trace." This is greenfield logic but the transform pattern is familiar.

**Concrete signature from RESEARCH.md §Pattern 4** — drop verbatim into the `Sentry.init({ beforeSend(event, hint) {...}, ... })` block in `app.html`:
```javascript
beforeSend(event, hint) {
  // 1. Strip user.email (we never want this off-platform)
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
  }
  // 2. Strip stack trace strings that may contain family codes (6 hex chars)
  const FAMILY_RE = /\b[a-f0-9]{6}\b/gi;
  if (event.message) event.message = event.message.replace(FAMILY_RE, '<FAMILY>');
  if (event.exception?.values) {
    for (const ex of event.exception.values) {
      if (ex.value) ex.value = ex.value.replace(FAMILY_RE, '<FAMILY>');
    }
  }
  // 3. Strip request URLs that might carry tokens (?invite= ?claim= /rsvp/<token>)
  if (event.request?.url) {
    event.request.url = event.request.url
      .replace(/[?&](invite|claim)=[^&]+/g, (_, k) => `?${k}=<REDACTED>`)
      .replace(/\/rsvp\/[^/?]+/g, '/rsvp/<TOKEN>');
  }
  return event;
}
```

**Where it goes:** Inline inside the `<script>sentryOnLoad = function() { Sentry.init({...}); }</script>` block in `app.html` `<head>` AND `landing.html` `<head>`. NOT a separate `js/sentry-pii.js` module — a single inline helper keeps the Sentry init self-contained and works without bundler imports.

**Family code regex justification:** Verified by Grep — Couch family codes are 6-char lowercase hex (e.g. seen in `js/app.js` LocalStorage keys `qn_family`, in member doc IDs, in Firestore paths). The `\b[a-f0-9]{6}\b` regex catches them in stack trace strings without false-positives on common 6-char hex (timestamps are longer, hashes are longer).

---

### `app.html` `<head>` Sentry loader script (MODIFY)

**Analog (role-match):** `landing.html:35-44` (existing `<head>` inline script, IIFE-style):
```html
<!-- Installed-PWA + deep-link redirect. Runs before DOMContentLoaded, so no flash -->
<script>
(function() {
  var search = window.location.search || '';
  var isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  var isDeepLink = search.indexOf('invite=') !== -1 || search.indexOf('claim=') !== -1;
  if (isStandalone || isDeepLink) {
    window.location.replace('/app' + search + window.location.hash);
  }
})();
</script>
```

**Why this analog:** Both are ES5-flavored inline scripts that run early in `<head>` before any module imports. Sentry loader script must run in this same window — before `js/app.js` (which is loaded as a module at the bottom of body) so Sentry's `captureException` is registered before any app-code error can fire.

**Concrete edit contract** — insert immediately AFTER `<link rel="stylesheet" href="/css/app.css">` (line 54) and BEFORE `</head>` (line 55):
```html
<!-- Phase 13 / OPS-05 — Sentry loader (CDN, zero-bundler). Source: docs.sentry.io/platforms/javascript/install/loader/ -->
<script>
  window.sentryOnLoad = function () {
    Sentry.init({
      dsn: 'https://<PUBLIC_KEY>@o<ORGID>.ingest.us.sentry.io/<PROJECTID>',
      environment: location.hostname === 'couchtonight.app' ? 'production' : 'dev',
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0.1,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
      ],
      beforeSend(event, hint) {
        /* PII-scrub block from Pattern Assignment "PII-scrub helper" above */
        return event;
      }
    });
  };
</script>
<script src="https://js.sentry-cdn.com/<PUBLIC_KEY>.min.js" crossorigin="anonymous"></script>
```

**DSN placeholder:** Replace `<PUBLIC_KEY>`, `<ORGID>`, `<PROJECTID>` with values from Sentry dashboard once account is created (RESEARCH.md "Environment Availability" — Sentry account is a 5-minute signup blocker, NOT a code blocker; planner can ship with a placeholder DSN and the user fills it in at deploy time, OR the user creates the Sentry project before the plan executes).

**Critical CSP note:** The `script-src` directive in the Phase 13 CSP block (firebase.json) explicitly allow-lists `https://js.sentry-cdn.com https://*.sentry-cdn.com https://browser.sentry-cdn.com`. The two changes (Sentry loader + CSP) MUST ship in the same deploy or report-only mode will flag the script load.

---

### `app.html` Delete-account button + modal HTML (MODIFY)

**Analog (exact):** Existing leave-family pattern at `app.html:710` (button) + `app.html:731-741` (modal).

**Existing button (line 710) — verified by Read:**
```html
<button class="pill" id="leave-family-btn" onclick="confirmLeaveFamily()">Leave family</button>
```

**Existing modal (lines 731-741) — verified by Read:**
```html
<!-- Phase 11 / REFR-12: Leave-family confirmation modal (two-tap destructive per UI-SPEC §Destructive actions) -->
<div class="modal-bg" id="leave-family-confirm-bg" onclick="if(event.target.id==='leave-family-confirm-bg')closeLeaveFamilyConfirm()">
  <div class="modal modal--w-440">
    <h3>Leave this group?</h3>
    <p class="meta">You'll lose access to this couch on this device. Your votes and reactions stay with the group. You can rejoin with the code.</p>
    <div class="modal-actions-row">
      <button class="pill" onclick="closeLeaveFamilyConfirm()">Cancel</button>
      <button class="pill leave-family-confirm" onclick="performLeaveFamily()">Leave</button>
    </div>
  </div>
</div>
```

**Phase 13 clone — button (insert AFTER line 710 inside same `<div class="tab-footer">` cluster):**
```html
<!-- Phase 13 / COMP-01: Self-serve account deletion. Two-tap destructive per UI-SPEC. -->
<button class="pill" id="delete-account-btn" onclick="openDeleteAccountConfirm()">Delete account</button>
```

**Phase 13 clone — modal (insert AFTER line 741, sibling to leave-family modal):**
```html
<!-- Phase 13 / COMP-01: Delete-account typed-DELETE confirmation modal -->
<div class="modal-bg" id="delete-account-modal-bg" onclick="if(event.target.id==='delete-account-modal-bg')closeDeleteAccountModal()">
  <div class="modal modal--w-440">
    <h3>Delete your Couch account?</h3>
    <p class="meta">This permanently deletes your account, your votes, your reactions, your watchparty history, and any photos you uploaded. <strong>You have 14 days to undo this. After that, it cannot be reversed.</strong> Other members' data is unaffected.</p>
    <p class="meta">Type <strong>DELETE</strong> in capitals to confirm:</p>
    <input id="delete-account-confirm-input" type="text" autocomplete="off" />
    <p id="delete-account-error" class="meta error"></p>
    <div class="modal-actions-row">
      <button class="pill" onclick="closeDeleteAccountModal()">Cancel</button>
      <button class="pill leave-family-confirm" onclick="performDeleteAccount()">Delete my account</button>
    </div>
  </div>
</div>
```

**Class naming choice:** Reuse `.leave-family-confirm` for the destructive-button styling (it's already a generic red-on-warm-bg variant — see CSS analog below). Alternative: introduce `.destructive-confirm` and migrate both. The cheaper path for Phase 13 (zero CSS churn): reuse `.leave-family-confirm`. The cleaner path (rename now, save churn later): introduce `.destructive-confirm` as an alias and apply to both buttons. **Planner's call** — flag in plan with explicit recommendation.

---

### `landing.html` `<head>` Sentry loader (MODIFY)

**Analog:** Same as `app.html` Sentry loader (above). `landing.html:35-44` already has an inline script in `<head>` (the PWA standalone redirect IIFE).

**Edit contract** — insert AFTER line 44 (the closing `</script>` of the standalone redirect) and BEFORE line 47 (the `<script type="application/ld+json">` block):
```html
<!-- Phase 13 / OPS-05 — Sentry loader (landing-page coverage too) -->
<script>
  window.sentryOnLoad = function () { Sentry.init({ /* same config as app.html — duplicated */ }); };
</script>
<script src="https://js.sentry-cdn.com/<PUBLIC_KEY>.min.js" crossorigin="anonymous"></script>
```

**De-duplication note:** The Sentry init config is duplicated between `app.html` and `landing.html`. Acceptable for v1 (~30 lines, manageable). Refactor target for Milestone 2: extract to `js/sentry-config.js` and import — but importing from a `<script>` in `<head>` doesn't work without `type="module"`, which forces another deferral. Defer.

---

### `css/app.css` Delete-account button red variant (MODIFY)

**Analog:** Existing `.leave-family-confirm` rule at `css/app.css:2654-2656` (verified by Read):
```css
/* Leave-family destructive button — uses --bad token for the red "Leave" CTA. */
.leave-family-confirm{background:var(--bad);color:var(--bg);border-color:transparent;
  font-weight:700}
.leave-family-confirm:hover{opacity:0.92}
```

**Edit contract:**
- **Path A (cheaper, recommended):** No CSS edit needed. Reuse `.leave-family-confirm` class on the new Delete-account button. The class name is misleading-but-harmless ("leave family" applied to "delete account" button). Document in comment.
- **Path B (cleaner):** Rename the rule to `.destructive-confirm` + add a backwards-compat alias for `.leave-family-confirm`. Two-line edit. Then apply `.destructive-confirm` to both buttons.

**Recommendation:** Path B. Cost is 2 lines. Eliminates a future grep-confusion landmine when someone tries to find "the destructive button style" and finds `.leave-family-confirm`. Plan should specify Path B.

**Concrete Path B edit:**
```css
/* Destructive-action confirm button — uses --bad token. Phase 11 introduced for leave-family;
   Phase 13 generalized for delete-account. Backwards-compat alias kept. */
.destructive-confirm,
.leave-family-confirm{background:var(--bad);color:var(--bg);border-color:transparent;
  font-weight:700}
.destructive-confirm:hover,
.leave-family-confirm:hover{opacity:0.92}
```

**`--bad` token verified at `css/app.css:54`:** `--bad:#c44536;` (the warm-dark red). No new token needed. CSS modal styles (`.modal-bg`, `.modal`, `.modal--w-440`, `.modal-actions-row`) already exist at `css/app.css:478-498` and are used by the existing leave-family modal — the new delete-account modal inherits them automatically by using the same class names. **Zero new modal CSS needed.**

---

### `sw.js` CACHE bump (MODIFY)

**Analog (exact):** Existing `const CACHE = 'couch-v32.2-asset-cache-control';` at `sw.js:8` (verified by Read).

**Edit contract — single-line replacement:**
```javascript
const CACHE = 'couch-v33-compliance-and-ops';
```

**Naming convention enforced (CLAUDE.md):** `couch-v{N}-{short-tag}`. N increments to 33; short-tag describes the phase deliverable. Other valid tags: `couch-v33-comp-01`, `couch-v33-phase13`. **Planner's choice.**

**Why bump:** Phase 13 ships user-visible changes (Delete-account button in Account ADMIN, Sentry loader in `<head>`) per CLAUDE.md "✓ When you ship a user-visible change that affects the app shell, bump CACHE in sw.js." Sentry loader alone is borderline (no UI change), but COMP-01 button definitively triggers the bump.

**Lockstep concern (`js/constants.js:792` `APP_VERSION = 32`):** RESEARCH.md notes APP_VERSION lockstep with sw.js CACHE major version. If CACHE goes to v33, APP_VERSION should also go to 33. Plan should bump both in the same commit.

---

### `couch/scripts/deploy.sh` (NEW — orchestration script)

**Analog:** No existing shell script in repo (verified by Glob — only `scripts/stamp-build-date.cjs` exists). RESEARCH.md §Pattern 5 supplies the pattern; no codebase analog to extract from.

**Concrete content from RESEARCH.md §Pattern 5** (use as-is for plan action):
```bash
#!/usr/bin/env bash
# scripts/deploy.sh — Phase 13 / OPS-02
# One-stop pre-deploy automation. Replaces the manual checklist in RUNBOOK.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUEUENIGHT_ROOT="/c/Users/nahde/queuenight"

cd "$REPO_ROOT"

# 1. Tests must pass
if [ -d tests ]; then (cd tests && npm test); fi

# 2. node --check all JS
for f in js/*.js sw.js; do node --check "$f"; done

# 3. Auto-stamp BUILD_DATE
node scripts/stamp-build-date.cjs

# 4. Bump sw.js CACHE — caller must edit before running OR pass tag arg
TAG="${1:-}"
if [ -n "$TAG" ]; then
  sed -i.bak -E "s|const CACHE = '[^']+';|const CACHE = '${TAG}';|" sw.js
  rm sw.js.bak
fi

# 5. Mirror to deploy directory
cp -v app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml robots.txt "${QUEUENIGHT_ROOT}/public/"
mkdir -p "${QUEUENIGHT_ROOT}/public/css" "${QUEUENIGHT_ROOT}/public/js"
cp -v css/*.css "${QUEUENIGHT_ROOT}/public/css/"
cp -v js/*.js "${QUEUENIGHT_ROOT}/public/js/"

# 6. Deploy
cd "${QUEUENIGHT_ROOT}"
firebase deploy --only hosting --project queuenight-84044

# 7. Smoke test
curl -sI https://couchtonight.app/ | head -3
curl -s https://couchtonight.app/sw.js | grep "const CACHE"
```

**Critical path correction vs RESEARCH.md:** RESEARCH.md sets `QUEUENIGHT_ROOT="/c/Users/nahde/queuenight"`. **Verified correct** — the queuenight repo is at `C:\Users\nahde\queuenight\` (NOT under `claude-projects\`). Plan action MUST use the correct absolute path.

**File-list completeness check vs CLAUDE.md "Deploy by mirroring":**
- CLAUDE.md says: `app.html, landing.html, 404.html, robots.txt, sitemap.xml, sw.js, css/, js/`
- RESEARCH.md adds: `changelog.html, rsvp.html` (both verified to exist via Glob — repo root has those files)
- Phase 13 deploy.sh should mirror **all** of: `app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml robots.txt css/ js/`

**Existing analog NOT to copy from:** `scripts/stamp-build-date.cjs` is INVOKED by deploy.sh (line `node scripts/stamp-build-date.cjs`), not a structural template for it. The only structural pattern is RESEARCH.md §Pattern 5.

**Pitfall (RESEARCH.md "Pitfall 7"):** deploy.sh modifies `js/constants.js` via stamp-build-date.cjs. Plan should specify either (a) commit-then-deploy ordering (deploy.sh aborts if working tree dirty) OR (b) auto-commit the stamp before deploy.

---

### `couch/scripts/firestore-export-setup.sh` (NEW — one-time gcloud setup)

**Analog:** None in repo. RESEARCH.md §Pattern 3 supplies the gcloud commands. **Recommendation: do NOT create a standalone .sh file** — the commands are run once per project lifetime, never re-run. Document inline in `RUNBOOK.md` (see RUNBOOK section below) so the operator runs them via copy-paste from the runbook.

**If the planner insists on a script** (acceptable for the "automate everything" school of thought):
```bash
#!/usr/bin/env bash
# scripts/firestore-export-setup.sh — Phase 13 / OPS-07
# ONE-TIME setup. Run once per Firebase project. Idempotent (safe to re-run).
# Verbatim from RESEARCH.md §Pattern 3 — Cloud Scheduler HTTP job for daily Firestore export.
set -euo pipefail
PROJECT="queuenight-84044"
REGION="us-central1"
BUCKET="gs://${PROJECT}-backups"

# 1. Bucket
gsutil mb -l "${REGION}" "${BUCKET}" || true   # ignore "already exists"

# 2. Lifecycle (30-day retention)
TMP_LC="$(mktemp)"
cat > "${TMP_LC}" <<'EOF'
{
  "lifecycle": { "rule": [ { "action": {"type": "Delete"}, "condition": {"age": 30} } ] }
}
EOF
gsutil lifecycle set "${TMP_LC}" "${BUCKET}"
rm "${TMP_LC}"

# 3. IAM
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${PROJECT}@appspot.gserviceaccount.com" \
  --role="roles/datastore.importExportAdmin"
gsutil iam ch "serviceAccount:${PROJECT}@appspot.gserviceaccount.com:admin" "${BUCKET}"

# 4. Cloud Scheduler job
gcloud scheduler jobs create http daily-firestore-export \
  --location="${REGION}" \
  --schedule="0 3 * * *" \
  --time-zone="America/Los_Angeles" \
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email="${PROJECT}@appspot.gserviceaccount.com" \
  --oauth-token-scope="https://www.googleapis.com/auth/datastore" \
  --headers="Content-Type=application/json" \
  --message-body="{\"outputUriPrefix\":\"${BUCKET}\"}"
```

**Bucket region locked:** `us-central1` per project_couch_firebase memory note (Firestore region is `us-central1`, Storage region is `us-east1`). The backup bucket MUST match Firestore's region — RESEARCH.md §Pattern 3 confirms.

---

### `.planning/RUNBOOK.md` (MODIFY — append new sections)

**Analog (existing structure verified at RUNBOOK.md:1-80):** Triage tree at lines 13-25 + numbered sections §A through §G. New Phase 13 sections append as §H through §J.

**Existing section-header style:**
```markdown
## §A — Hosting issue
[paragraph]
**Quick checks:** ...
**Roll back to previous release:** ...
```

**New sections to add (mirror style):**
```markdown
## §H — Account deletion stuck (COMP-01)

Symptom: User clicked "Delete account" 14+ days ago but their data is still in Firestore.

**Check the reaper logs:**
- https://console.cloud.google.com/functions/details/us-central1/deletionReaperTick?project=queuenight-84044
- Look for `lastDeletionAttemptError` in `users/{uid}` doc — that's the error from the latest tick.

**Common causes:**
- User is `ownerUid` of a family — reaper throws `failed-precondition`. Resolution: ask user to transfer ownership before re-running.
- Storage delete permission issue — check the IAM binding for the App Engine SA on the storage bucket.
- Firestore quota exhaustion — rare; check Cloud Logging.

**Manual hard-delete (last resort):**
1. SSH to a machine with admin SDK creds OR use Firebase console + Cloud Shell.
2. Run the reaper logic by hand: `firebase functions:shell` → invoke `deletionReaperTick`.

## §I — Restore from Firestore export (OPS-07)

**Find the latest export:**
\`\`\`bash
gsutil ls gs://queuenight-84044-backups/
\`\`\`

**Restore (DESTRUCTIVE — overwrites current Firestore):**
\`\`\`bash
gcloud firestore import gs://queuenight-84044-backups/<YYYY-MM-DDTHH:MM:SS_NNNNN>/
\`\`\`

NEVER run this on production without an outage incident declared. The restore overwrites everything.

## §J — Cloud Scheduler job inventory

Phase 13 added daily-firestore-export. Current jobs:
\`\`\`bash
gcloud scheduler jobs list --location=us-central1
\`\`\`
Expected: `watchpartyTick`, `rsvpReminderTick`, `deletionReaperTick`, `daily-firestore-export`. Plus any jobs added later.

## §K — Firestore export setup (one-time)

[Inline the gcloud commands from RESEARCH.md §Pattern 3 — see scripts/firestore-export-setup.sh content above.]

## §L — GitHub branch protection (OPS-06)

Path: `github.com/<owner>/couch` → Settings → Rules → Rulesets → New branch ruleset.
[Inline the checklist from RESEARCH.md §Example 5.]
```

**No removals needed** — Phase 13 only appends.

---

### `.planning/TECH-DEBT.md` (MODIFY — close partial entries)

**Status flips per RESEARCH.md "Phase Requirements":**
- TD-1 (firebase-functions SDK 4→7): **stays open** (deferred to Phase 14)
- TD-2 (Variant-B storage rules): **stays open** (deferred — gated on Phase 5 member-uid migration)
- TD-3 (whatever it was): re-read entry; not directly affected by Phase 13
- TD-4 (CSP): **flips to "shipped (Report-Only mode); enforcement deferred to Milestone 2"**
- TD-5 (whatever it was): re-read entry; not directly affected

**Plan action:** Read TECH-DEBT.md FIRST (planner instruction), then update entries based on RESEARCH.md confidence. Do NOT close TD-1 or TD-2 — they survive Phase 13.

---

## Shared Patterns

### Cloud Function callable boilerplate (applies to all 3 NEW callables)

**Source:** `queuenight/functions/src/transferOwnership.js:21-32` + `queuenight/functions/src/rsvpSubmit.js:24-32`

**Apply to:** `requestAccountDelete.js`, `cancelAccountDelete.js`, `checkAccountDeleteEligibility.js`

```javascript
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.<NAME> = onCall({ region: 'us-central1' }, async (req) => {
  const uid = req.auth && req.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  // ... per-CF logic ...
});
```

The `if (!admin.apps.length) admin.initializeApp()` guard is REQUIRED for files in `src/` because they're loaded BEFORE `index.js`'s top-level `admin.initializeApp()` runs. Without the guard, double-init throws. Verified pattern in rsvpSubmit.js:30, rsvpReminderTick.js:28, consumeGuestInvite.js (uses different `admin.firestore()` access pattern but same guard implicit via require ordering).

### Cloud Function scheduled boilerplate (applies to deletionReaperTick)

**Source:** `queuenight/functions/index.js:435-440` (`watchpartyTick`)

**Apply to:** `deletionReaperTick.js`

```javascript
const { onSchedule } = require('firebase-functions/v2/scheduler');

exports.<NAME> = onSchedule({
  schedule: 'every 1 hours',
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '512MiB'
}, async (event) => {
  // ...
  return null;
});
```

### Modal driver boilerplate (applies to delete-account modal)

**Source:** `js/app.js:2667-2688` (leave-family confirm flow)

**Apply to:** `js/app.js` new delete-account modal handlers

3-function pattern: `confirm<Action>` (open) + `close<Action>Modal` (close) + `perform<Action>` (close + execute). Use `bg.classList.add('on')` / `bg.classList.remove('on')`. Modal background pattern: `id="<action>-modal-bg"`, with click-on-bg-closes via inline `onclick="if(event.target.id==='...')close...()"`.

### httpsCallable error mapping (applies to all client-side CF invocations)

**Source:** `js/app.js:3093-3116` (`transferOwnershipTo`) + `js/app.js:2783-2815` (`sendGraduationLink`)

**Apply to:** `openDeleteAccountConfirm()`, `performDeleteAccount()`, `cancelAccountDelete()` UI handler

Standard try/catch:
```javascript
try {
  const fn = httpsCallable(functions, '<cfName>');
  const r = await fn(payload);
  if (r.data && r.data.<ok-or-success>) { /* success path */ }
} catch (e) {
  console.error('[<short-tag>]', e);
  const code = e && e.code;
  const msg = (code === 'failed-precondition' || code === 'functions/failed-precondition') ? '<message>'
            : (code === 'unauthenticated' || code === 'functions/unauthenticated') ? '<message>'
            : '<fallback>';
  flashToast(msg, { kind: 'warn' });
}
```

The dual-prefix check (`'<code>'` AND `'functions/<code>'`) is a known Couch idiom — Firebase v9+ Functions SDK strips the `functions/` prefix in some browsers but not others. Always check both.

---

## Naming Conventions Enforced

Verified against existing repo code. The planner MUST respect these:

| Concept | Convention | Verified Source |
|---------|-----------|-----------------|
| Cloud Function name | camelCase, **verb-first** (e.g. `requestAccountDelete`, NOT `accountDeleteRequest`) | `rsvpSubmit`, `consumeGuestInvite`, `transferOwnership`, `inviteGuest`, `claimMember` (all in `queuenight/functions/src/`) |
| Scheduled CF suffix | `Tick` (e.g. `deletionReaperTick`, mirrors `watchpartyTick` / `rsvpReminderTick`) | `index.js:435`, `src/rsvpReminderTick.js` |
| CF file name | matches export name (`requestAccountDelete.js` exports `requestAccountDelete`) | All `src/*.js` follow this |
| Firestore field name | camelCase (e.g. `deletionRequestedAt`, `hardDeleteAt`, `ownerUid`, `actingUid`) | `transferOwnership.js:77-79`: `ownerUid`, `previousOwnerUid`, `ownershipTransferredAt` |
| JS module import | relative path with `.js` suffix (e.g. `from './firebase.js'`) | `js/app.js:1` |
| Window-attached function | `window.<verb><Noun> = async function() {}` (e.g. `window.openDeleteAccountConfirm`) | `js/app.js:2667-2688` (multiple) |
| Service worker CACHE | `couch-v{N}-{short-tag}` (e.g. `couch-v33-compliance`) | `sw.js:8` + CLAUDE.md "Do" list |
| HTML element id | kebab-case (e.g. `delete-account-modal-bg`, `delete-account-confirm-input`) | `app.html:732` (`leave-family-confirm-bg`), `app.html:706-711` (button ids) |
| CSS modal class | `.modal-bg` + `.modal` + `.modal--w-440` width modifier | `css/app.css:478-498` |
| Destructive button class | `.pill .leave-family-confirm` (Phase 11) → recommend new alias `.destructive-confirm` (Phase 13) | `css/app.css:2654` + `app.html:738` |
| Flash toast variants | `flashToast(msg, { kind: 'warn'\|'success'\|'info' })` | `js/app.js` (used in 50+ places per Grep) |
| Console error tag | `console.error('[<short-tag>]', e)` (e.g. `'[delete-account]'`, `'[transfer-ownership]'`) | `js/app.js:2752` (`'[create-subprofile]'`), `:2808` (`'[graduation]'`), `:3107` (`'[transfer-ownership]'`) |

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `js/app.js` PII-scrub helper for Sentry `beforeSend` | event-payload transform | transform | No existing PII-stripping utility in codebase. Pattern is greenfield but signature parallels `escapeHtml`. RESEARCH.md §Pattern 4 supplies verbatim implementation; planner can drop in. |
| Global error handler (`window.onerror` / `unhandledrejection`) | error capture | event-driven | Grep verified: NO existing global error handlers in `couch/`. **Sentry's loader script auto-instruments these** — RESEARCH.md confirms "no manual `addEventListener` needed." Plan action is "install Sentry"; no hand-rolled handler to ship. |
| `couch/scripts/firestore-export-setup.sh` | one-time gcloud setup | batch | No existing shell script in repo. Pattern from RESEARCH.md §Pattern 3 only. **Recommendation: skip the standalone .sh; document inline in RUNBOOK.md §K** (commands run once per project lifetime). |

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\queuenight\functions\src\` (9 CF files; all read in full or grep'd)
- `C:\Users\nahde\queuenight\functions\index.js` (Grep'd then read at lines 1-160 + 435-565)
- `C:\Users\nahde\queuenight\firebase.json` (read in full)
- `C:\Users\nahde\queuenight\firestore.rules` + `storage.rules` (Grep'd for couch-albums + uid attribution patterns)
- `C:\Users\nahde\claude-projects\couch\app.html` (read at 1-120, 600-760)
- `C:\Users\nahde\claude-projects\couch\landing.html` (read at 1-60)
- `C:\Users\nahde\claude-projects\couch\js\app.js` (Grep'd repeatedly; Read at 1, 2070-2120, 2640-2820, 3050-3120, 9420-9430)
- `C:\Users\nahde\claude-projects\couch\js\firebase.js` + `js/constants.js:1-60+788-793` (read)
- `C:\Users\nahde\claude-projects\couch\css\app.css` (Grep'd; Read at 470-498 + 2645-2665)
- `C:\Users\nahde\claude-projects\couch\sw.js` (read in full)
- `C:\Users\nahde\claude-projects\couch\scripts\stamp-build-date.cjs` (read in full)
- `C:\Users\nahde\claude-projects\couch\.planning\RUNBOOK.md` (read at 1-80)
- `C:\Users\nahde\claude-projects\couch\.planning\phases\11-feature-refresh-and-streamline\11-PATTERNS.md` (style reference, read at 1-120)

**Files scanned:** ~30 files, all under repo size limits per CLAUDE.md "read only what you need" — `js/app.js` accessed via Grep + offset/limit only; never loaded in full.

**Pattern extraction date:** 2026-04-25

**Path correction note:** CONTEXT.md and the orchestrator prompt referenced `C:\Users\nahde\claude-projects\queuenight\functions\` for the Cloud Functions repo. **The actual path is `C:\Users\nahde\queuenight\functions\`** (verified by directory listing). All Pattern Assignments above use the corrected path. Plans MUST use the corrected path.

## PATTERN MAPPING COMPLETE
