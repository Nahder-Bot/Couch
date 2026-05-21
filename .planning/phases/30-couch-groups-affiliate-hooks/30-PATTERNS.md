# Phase 30: Couch Groups — Pattern Map

**Mapped:** 2026-05-03
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `queuenight/functions/src/addFamilyToWp.js` | service (CF) | request-response + CRUD | `/c/Users/nahde/queuenight/functions/src/rsvpSubmit.js` | role-match (auth CF, admin-SDK, idempotency guard, transaction) |
| `queuenight/functions/src/wpMigrate.js` | service (CF) | batch | `/c/Users/nahde/queuenight/functions/src/accountDeletionReaper.js` | role-match (admin-SDK batch, collectionGroup scan, scheduled/one-shot) |
| `scripts/smoke-couch-groups.cjs` | test | request-response (smoke sentinel) | `/c/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs` | exact (same helper-behavior + production-code sentinel + floor meta-assertion pattern) |
| `js/firebase.js` | config | — | existing file — additive import only | exact (established import extension pattern at line 1) |
| `js/app.js` | component + service | request-response + event-driven | `js/app.js` — internal Phase 27 guest-chip block + `confirmStartWatchparty` | exact (extend same functions in-place) |
| `js/state.js` | service | request-response | `js/state.js` lines 9–13 (existing collection ref helpers) | exact (add `watchpartiesRef` function sibling) |
| `firestore.rules` | middleware | request-response | `firestore.rules` lines 577–610 (Phase 24 `/watchparties/{wpId}` nested block) | exact (transplant Path A/B structure to new top-level block) |
| `queuenight/firestore.indexes.json` | config | — | existing file — additive index entry | exact (mirrors existing `watchparties` index shape at lines 3–12) |
| `queuenight/functions/src/rsvpSubmit.js` | service (CF) | request-response | self — modify existing file (top-level lookup + fallback scan) | exact (O(1) top-level direct lookup prepended before existing scan at line 79) |
| `tests/rules.test.js` | test | request-response | `tests/rules.test.js` lines 937–974 (Phase 27 describe block) | exact (add Phase 30 describe block with same assertSucceeds/assertFails shape) |
| `package.json` | config | — | existing file — additive script entries | exact (mirror existing `smoke:guest-rsvp` alias + extend `smoke` aggregate chain) |
| `sw.js` | config | — | existing file — single `CACHE` const bump at line 8 | exact |

---

## Pattern Assignments

### `queuenight/functions/src/addFamilyToWp.js` (service CF, request-response + CRUD)

**Analog:** `/c/Users/nahde/queuenight/functions/src/rsvpSubmit.js`

**Imports pattern** (rsvpSubmit.js lines 26–30):
```javascript
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```

**Auth check pattern** (rsvpSubmit.js lines 50–55, 63–65):
```javascript
exports.rsvpSubmit = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => {
  // ...input destructure...
  if (!looksLikeWpId(token)) {
    throw new HttpsError('invalid-argument', 'Invalid invite token.');
  }
```
Pattern divergence for `addFamilyToWp`: the CF is **authenticated** (not open), so replace the `cors` RSVP pattern with a `request.auth` guard like `joinGroup.js` line 72: `if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');`

**Input validation + family-code regex** (rsvpSubmit.js lines 44–48 for token shape; adapt for family code):
```javascript
// Token shape: Firestore auto-ids (20 char base62) OR 'wp_<ts>_<rand>' ids
function looksLikeWpId(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 64 && /^[A-Za-z0-9_-]+$/.test(s);
}
```
Apply equivalent regex guard to `familyCode` input. Mirror RESEARCH Security note: return a neutral error ("No family with that code") rather than "not found" vs "bad format" split.

**Idempotency guard pattern** (rsvpSubmit.js lines 119–123 — soft-cap check with early return):
```javascript
const currentGuests = Array.isArray(wp.guests) ? wp.guests : [];
const isNewGuest = !guestId || !currentGuests.some(g => g && g.guestId === guestId);
if (isNewGuest && currentGuests.filter(g => g && !g.revoked).length >= 100) {
  return { guestCapReached: true };
}
```
For `addFamilyToWp`: check `if ((wp.families || []).includes(familyCode)) return { ok: true, alreadyAdded: true };` before any Firestore write (RESEARCH Pitfall 3).

**Host-only gate pattern** (rsvpSubmit.js lacks this — mirror `joinGroup.js` lines 82–85 + RESEARCH Pattern 2):
```javascript
const wpDoc = await db.doc(`watchparties/${wpId}`).get();
if (!wpDoc.exists || wpDoc.data().hostUid !== request.auth.uid) {
  throw new HttpsError('permission-denied', 'Host only.');
}
```

**Admin-SDK cross-family member read** (no exact analog — new pattern justified by RESEARCH Q6):
```javascript
// Admin SDK bypasses Firestore rules — reads foreign family's members subcollection
// which the host's client cannot access (isMemberOfFamily(foreignCode) is false for host).
const membersSnap = await db.collection(`families/${familyCode}/members`).get();
const newUids = membersSnap.docs.map(d => d.data().uid).filter(uid => uid && typeof uid === 'string');
```

**Transaction + FieldValue.arrayUnion pattern** (rsvpSubmit.js lines 130–171 for `runTransaction`; use `update` + `arrayUnion` for additive-only fan-out):
```javascript
// NOTE: arrayUnion on objects uses deep equality — safe only for additive-only cases.
// rsvpSubmit uses runTransaction for read-modify-write. addFamilyToWp uses arrayUnion
// because it never removes rows in one call (the idempotency guard above ensures no
// duplicate family entry). See RESEARCH Pitfall 3 for the caveat on object arrayUnion.
await db.doc(`watchparties/${wpId}`).update({
  families: admin.firestore.FieldValue.arrayUnion(familyCode),
  memberUids: admin.firestore.FieldValue.arrayUnion(...newUids),
  crossFamilyMembers: admin.firestore.FieldValue.arrayUnion(...crossFamilyRows),
});
```

**Confidentiality pattern** (rsvpSubmit.js lines 93–97):
```javascript
// Treat not-found as expired for confidentiality — don't leak whether
// the token is "wrong" vs "too old" to unauthenticated callers.
return { expired: true };
```
For `addFamilyToWp`: return neutral `HttpsError('not-found', 'No family with that code.')` regardless of whether family code doesn't exist vs code is valid but caller is not host.

**Return shape** (rsvpSubmit.js line 186–191 pattern):
```javascript
return { ok: true, addedMemberCount: newUids.length };
```

---

### `queuenight/functions/src/wpMigrate.js` (service CF, batch)

**Analog:** `/c/Users/nahde/queuenight/functions/src/accountDeletionReaper.js`

**Imports + admin-SDK init pattern** (accountDeletionReaper.js lines 1–9):
```javascript
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```
`wpMigrate` is a one-shot callable (not a scheduled trigger) — use `onCall` from `rsvpSubmit.js`/`joinGroup.js`, not `onSchedule`. Caller must be authenticated (or a dev-only secret key gate) to prevent open migration triggers.

**CollectionGroup scan pattern** (accountDeletionReaper.js lines 51–57):
```javascript
// Admin SDK collectionGroup scan — finds all docs across family subcollections
const cgSnap = await db.collectionGroup('watchparties').get();
cgSnap.docs.forEach(d => {
  // d.ref.path is "families/{familyCode}/watchparties/{wpId}"
  const parts = d.ref.path.split('/');
  const idx = parts.indexOf('families');
  if (idx >= 0 && parts[idx + 1]) familyCodes.add(parts[idx + 1]);
});
```
`wpMigrate` uses this to enumerate ALL nested `families/*/watchparties` docs, then copies each to `/watchparties/{wpId}` with `memberUids` stamped from the family's current `members` subcollection.

**BulkWriter batch write pattern** (accountDeletionReaper.js lines 20–23):
```javascript
const bulkWriter = db.bulkWriter();
// ... accumulate .set() calls ...
await bulkWriter.close();
```
Use for batching the top-level wp doc creation — avoids sequential await-per-doc overhead.

**Dry-run / idempotency** (no exact analog — new pattern): check `await db.doc('watchparties/' + wpId).get()` before writing; skip if already migrated (`!existingDoc.exists || !existingDoc.data().memberUids`).

---

### `scripts/smoke-couch-groups.cjs` (test, smoke sentinel)

**Analog:** `/c/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs`

**Harness scaffold** (smoke-guest-rsvp.cjs lines 27–47):
```javascript
'use strict';

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)}`);
  console.error(`     actual:   ${JSON.stringify(actual)}`);
  failed++;
}
function eqObj(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${e}`);
  console.error(`     actual:   ${a}`);
  failed++;
}
```

**Path resolution + readIfExists pattern** (smoke-guest-rsvp.cjs lines 122–140):
```javascript
const path = require('path');
const fs = require('fs');
const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}
function eqContains(label, fileContent, needle) {
  if (fileContent === null) {
    console.log(`  skip ${label} (file not present in this checkout)`);
    return;
  }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     missing substring: ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}
```

**Production-code sentinel block** (smoke-guest-rsvp.cjs lines 143–152):
```javascript
const rsvpSubmitSrc = readIfExists(path.join(QN_FUNCTIONS, 'src', 'rsvpSubmit.js'));
eqContains('5.1 rsvpSubmit uses runTransaction', rsvpSubmitSrc, 'db.runTransaction');
eqContains('5.2 rsvpSubmit reconciles WP_ARCHIVE_MS to 25h', rsvpSubmitSrc, '25 * 60 * 60 * 1000');
```
Phase 30 sentinel targets: `addFamilyToWp.js` (idempotency guard, host check, arrayUnion), `firestore.rules` (`memberUids` in path A, `families` in Path B denylist), `js/app.js` (`collectionGroup`, `buildNameCollisionMap`, `crossFamilyMembers`).

**`(guest)` collision suffix helper test pattern** (smoke-guest-rsvp.cjs lines 66–78 — EXACT pattern to mirror for D-09 family-suffix):
```javascript
function displayGuestName(rawName, familyMemberNames) {
  const norm = (rawName || '').trim().toLowerCase();
  if (familyMemberNames.has(norm)) return rawName + ' (guest)';
  return rawName;
}
// Test: collision -> suffix fires; no collision -> verbatim
eq('2.1 collision: "Alex" -> "Alex (guest)"', displayGuestName('Alex', fam), 'Alex (guest)');
eq('2.2 no collision: "Riley" -> "Riley"', displayGuestName('Riley', fam), 'Riley');
```
Phase 30 analog tests `buildNameCollisionMap` with cross-family + within-family cases (Pitfall 6: within-family collision must NOT trigger suffix).

**Floor meta-assertion** (smoke-guest-rsvp.cjs lines 200–211):
```javascript
{
  const FLOOR = 13;
  const productionCodeAssertions = passed - 17; // subtract helper-behavior assertions
  if (productionCodeAssertions >= FLOOR) {
    console.log(`  ok 11.1 production-code sentinel floor met (${productionCodeAssertions} >= ${FLOOR})`);
    passed++;
  } else {
    console.error(`  FAIL 11.1 production-code sentinel floor NOT met`);
    failed++;
  }
}
```

**Exit pattern** (smoke-guest-rsvp.cjs lines 212–215):
```javascript
console.log('=================================================');
console.log(`smoke-guest-rsvp: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
```

---

### `js/firebase.js` (config, additive import)

**Analog:** `js/firebase.js` — itself, additive change only.

**Existing import line to extend** (firebase.js line 1 — the single Firestore import):
```javascript
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs,
         deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField,
         writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```
**Modification:** Add `collectionGroup` to this import list. Verify `A1` assumption from RESEARCH: `collectionGroup` is NOT yet present in this line (confirmed — it is absent).

**Export line to extend** (firebase.js line 27):
```javascript
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc,
         query, orderBy, addDoc, arrayUnion, deleteField, writeBatch };
```
**Modification:** Add `collectionGroup` to the export list.

**Pattern note:** The Firebase CDN URL `https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js` is already the CDN-pinned version for the whole project. `collectionGroup` is a standard Firestore function at this version — no URL change needed.

---

### `js/app.js` (component + service, request-response + event-driven)

**Analog:** `js/app.js` — internal Phase 27 guest-chip block + `confirmStartWatchparty` + `watchpartiesRef` subscription.

#### Modification point 1: `watchpartiesRef()` + subscription (lines 1935, 4889–4911)

**Existing `watchpartiesRef` to replace** (app.js line 1935):
```javascript
function watchpartiesRef() { return collection(db, 'families', state.familyCode, 'watchparties'); }
function watchpartyRef(id) { return doc(db, 'families', state.familyCode, 'watchparties', id); }
```
**Replacement pattern** (RESEARCH Pattern 1 Code Example):
```javascript
// Phase 30 — collectionGroup subscription replaces per-family collection.
// `watchpartyRef(id)` keeps pointing at top-level for single-doc writes.
function watchpartyRef(id) { return doc(db, 'watchparties', id); }
```
New `watchpartiesRef()` goes away in favour of an inline `collectionGroup` query (see subscription block below).

**Existing subscription to modify** (app.js lines 4889–4911):
```javascript
state.unsubWatchparties = onSnapshot(watchpartiesRef(), s => {
  state.watchparties = s.docs.map(d => d.data());
  // Auto-archive any that have passed the 25h window...
  const now = Date.now();
  state.watchparties.forEach(wp => { ... });
  maybeFlipScheduledParties(state.watchparties);
  maybeNotifyWatchparties(state.watchparties);
  renderWatchpartyBanner();
  if (state.activeWatchpartyId) renderWatchpartyLive();
}, e => {});
```
**Replacement:**
```javascript
// Phase 30 — collectionGroup query replaces families/{code}/watchparties.
// where('memberUids', 'array-contains', uid) filter must be present or
// Firestore rejects the query. See RESEARCH Pitfall 2.
state.unsubWatchparties = onSnapshot(
  query(
    collectionGroup(db, 'watchparties'),
    where('memberUids', 'array-contains', state.auth.uid)
  ),
  s => {
    state.watchparties = s.docs.map(d => d.data());
    // ... existing auto-archive, flip-scheduled, notify, render — UNCHANGED ...
  },
  e => { qnLog('[watchparties] snapshot error', e.message); }
);
```
**Import dependency:** `collectionGroup` and `where` must be imported in `js/firebase.js` (see above) and then imported in `js/app.js`'s existing import from `./firebase.js`.

#### Modification point 2: `confirmStartWatchparty` wp doc shape (lines 11141–11189)

**Existing `wp` object literal to extend** (app.js lines 11161–11187):
```javascript
const wp = {
  id,
  titleId: wpStartTitleId,
  titleName: t.name,
  titlePoster: t.poster || '',
  hostId: state.me.id,
  hostName: state.me.name,
  hostUid: (state.auth && state.auth.uid) || null,
  // ... existing fields: creatorTimeZone, startAt, createdAt, lastActivityAt,
  //     status, participants, reactions, videoUrl, videoSource ...
};
```
**Extension:** Add Phase 30 fields after the existing `videoSource` line:
```javascript
  // Phase 30 — couch groups fields
  hostFamilyCode: state.familyCode,
  families: [state.familyCode],        // host's own family; CF appends others
  memberUids: memberUidsForFamily,     // all UIDs from host family (stamped at create)
  crossFamilyMembers: [],              // empty at create; CF fans out when host adds family
```
`memberUidsForFamily` = `state.members.map(m => m.uid).filter(Boolean)` (host family UIDs only at create time). This stamps `memberUids` so the top-level rules and subscription filter work immediately on create.

**Firestore write call to update** (app.js line 11189):
```javascript
await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
```
`watchpartyRef(id)` will now point to `doc(db, 'watchparties', id)` (Phase 30 modification of `watchpartyRef`), so this line changes its write target automatically.

#### Modification point 3: `renderParticipantTimerStrip` (lines 12296–12368)

**Phase 27 guest-chip append block to mirror** (app.js lines 12345–12367):
```javascript
// === Phase 27 — append guest chips after member chips ===
const familyMemberNamesSet = getFamilyMemberNamesSet();
const visibleGuests = (Array.isArray(wp.guests) ? wp.guests : []).filter(g => g && !g.revoked);
const isHost = state.me && state.me.id === wp.hostId;
const guestChips = visibleGuests.map(guest => {
  const safeGuestId = escapeHtml(guest.guestId || '');
  const rawName = (guest.name || 'Guest').toString();
  const display = displayGuestName(rawName, familyMemberNamesSet);
  const initial = (display || '?')[0].toUpperCase();
  const respLabel = guestResponseLabel(guest.response);
  const kebab = isHost
    ? `<button class="wp-guest-kebab" ...>&#8942;</button>` : '';
  return `<div class="wp-participant-chip guest" data-guest-id="${safeGuestId}" role="listitem">
    <div class="wp-participant-av" style="background:#5a8a84;" aria-hidden="true">${escapeHtml(initial)}</div>
    <div class="wp-participant-info">
      <div class="wp-participant-name">${escapeHtml(display)}<span class="chip-badge badge-guest">guest</span></div>
      <div class="wp-participant-time" data-role="pt-time">${escapeHtml(respLabel)}</div>
    </div>${kebab}</div>`;
}).join('');
return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}</div>`;
```
**Phase 30 extension:** Append cross-family member chips between `guestChips` and the final return. Insert AFTER line 12366, BEFORE line 12367 (`return ...`):
```javascript
// === Phase 30 — append cross-family member chips ===
// buildNameCollisionMap returns a map of { name.toLowerCase(): count } across
// all participants + crossFamilyMembers. Only cross-family collisions trigger suffix
// (RESEARCH Pitfall 6: within-family same-name does NOT trigger suffix per D-09).
const collisionMap = buildNameCollisionMap(wp);
const crossFamilyChips = (Array.isArray(wp.crossFamilyMembers) ? wp.crossFamilyMembers : []).map(m => {
  const rawName = (m.name || 'Member').toString();
  const norm = rawName.trim().toLowerCase();
  // Suffix only when name appears across TWO DIFFERENT families (collision across families)
  const hasCrossCollision = (collisionMap[norm] || 0) > 1;
  const familyDisplayName = m.familyDisplayName || m.familyCode || '';
  const displayName = hasCrossCollision ? `${rawName} <span class="family-suffix">(${escapeHtml(familyDisplayName)})</span>` : escapeHtml(rawName);
  const initial = (rawName || '?')[0].toUpperCase();
  const color = m.color || '#888';
  return `<div class="wp-participant-chip cross-family" data-member-id="${escapeHtml(m.memberId || '')}" role="listitem">
    <div class="wp-participant-av" style="background:${escapeHtml(color)};" aria-hidden="true">${escapeHtml(initial)}</div>
    <div class="wp-participant-info">
      <div class="wp-participant-name">${displayName}</div>
      <div class="wp-participant-time" data-role="pt-time">Joined</div>
    </div></div>`;
}).join('');
```
Then update the `return` at line 12367 to include `crossFamilyChips`:
```javascript
return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}${crossFamilyChips}</div>`;
```

**`(you)` pattern to mirror for `(your couch)` label** (app.js line 12339):
```javascript
<div class="wp-participant-name">${escapeHtml(name)}${isMe ? ' <span class="muted">(you)</span>' : ''}</div>
```
Phase 30 uses the same inline `<span>` pattern for `(your couch)` — no `<em>` per UI-SPEC accessibility note.

#### Modification point 4: `buildNameCollisionMap` helper (NEW — add near line 12272)

**`getFamilyMemberNamesSet` at line 12272 as anchor:**
```javascript
// === Phase 27 — Guest RSVP helpers ===
function getFamilyMemberNamesSet() {
  return new Set((state.members || []).map(m => (m.name || '').trim().toLowerCase()).filter(Boolean));
}
```
Add `buildNameCollisionMap` immediately after:
```javascript
// Phase 30 — D-09 render-time collision detection across families.
// Only cross-family collisions trigger the (FamilyName) suffix (RESEARCH Pitfall 6).
// Returns { [name.toLowerCase()]: count } for collision detection.
function buildNameCollisionMap(wp) {
  const nameCounts = {};
  // Count names from wp.participants (host family members in the wp)
  Object.values(wp.participants || {}).forEach(p => {
    const n = (p.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  // Count names from crossFamilyMembers — tagged with their familyCode
  (wp.crossFamilyMembers || []).forEach(m => {
    const n = (m.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  return nameCounts;
}
```

#### Modification point 5: "+ Add a family" affordance in `confirmStartWatchparty` form

**Insertion anchor:** The existing form render is in the `#wp-start-modal-bg` HTML in `app.html` (not in `js/app.js` — the form fields are static HTML; the dynamic part is added via a render function called from the modal-open path). Use Grep on `app.html` to locate `#wp-start-modal-bg` and insert `.wp-add-family-section` before the submit button.

Pattern: mirror the Phase 27 RSVP share block at `confirmStartWatchparty` lines 11194–11230 as the structural precedent for "post-create action block" placement.

---

### `js/state.js` (service, request-response)

**Analog:** `js/state.js` lines 9–13.

**Existing ref helper pattern** (state.js lines 9–13):
```javascript
export function membersRef() { return collection(db, 'families', state.familyCode, 'members'); }
export function titlesRef() { return collection(db, 'families', state.familyCode, 'titles'); }
export function familyDocRef() { return doc(db, 'families', state.familyCode); }
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
```
**Modification:** The `watchpartiesRef` and `watchpartyRef` helpers currently live in `js/app.js` lines 1935–1936, NOT in `js/state.js`. RESEARCH.md says to migrate the subscription pattern to `collectionGroup` — the subscription is in `js/app.js`. The `state.js` modification, if any, is limited to confirming `state.auth.uid` is accessible at subscription time (it is, via `state.auth` already in the `state` object at line 7). No new exports needed in `state.js` unless the planner moves `watchpartyRef(id)` here. If moved, the pattern is identical to `vetoHistoryDoc(id)` above.

---

### `firestore.rules` (middleware, request-response)

**Analog:** `firestore.rules` lines 577–610 (Phase 24 nested `/watchparties/{wpId}` block).

**Existing nested block to carry forward** (firestore.rules lines 577–609):
```javascript
match /watchparties/{wpId} {
  // Phase 27 — wp.guests[], wp.guestCount, and wp.rsvpClosed written by admin-SDK CFs.
  allow read: if isMemberOfFamily(familyCode);
  allow create: if attributedWrite(familyCode);
  allow update: if attributedWrite(familyCode) && (
    // Path A: caller is the wp host — any field allowed.
    (
      'hostUid' in resource.data
      && resource.data.hostUid == request.auth.uid
    )
    ||
    // Path B: non-host denylist.
    !request.resource.data.diff(resource.data).affectedKeys().hasAny([
      'currentTimeMs', 'currentTimeUpdatedAt', 'currentTimeSource',
      'durationMs', 'isLiveStream', 'videoUrl', 'videoSource',
      'hostId', 'hostUid', 'hostName'
    ])
  );
  allow delete: if isOwner(familyCode) || (isMemberOfFamily(familyCode) && graceActive());
}
```

**New top-level block** (add BEFORE the existing `match /families/{familyCode}` block — at top-level inside `match /databases/{database}/documents`):
```javascript
// === Phase 30 — Top-level /watchparties/{wpId} collection ===
// Post-migration: wp docs live at /watchparties/{wpId}, not nested under families/.
// READ gate: any uid listed in wp.memberUids (set by addFamilyToWp CF + confirmStartWatchparty).
// Path A / Path B write split mirrors Phase 24 nested rule verbatim.
// memberUids + families added to Path B denylist so non-host cannot write them
// (CF uses admin-SDK which bypasses rules — RESEARCH Pattern 2).
match /watchparties/{wpId} {
  allow read: if signedIn() && request.auth.uid in resource.data.memberUids;

  allow create: if signedIn()
    && request.resource.data.hostUid == uid()
    && request.auth.uid in request.resource.data.memberUids;

  allow update: if signedIn()
    && request.auth.uid in resource.data.memberUids
    && (
      // Path A: host — any field.
      (
        'hostUid' in resource.data
        && resource.data.hostUid == request.auth.uid
      )
      ||
      // Path B: non-host denylist — Phase 24 fields + Phase 30 families/memberUids.
      !request.resource.data.diff(resource.data).affectedKeys().hasAny([
        'currentTimeMs', 'currentTimeUpdatedAt', 'currentTimeSource',
        'durationMs', 'isLiveStream', 'videoUrl', 'videoSource',
        'hostId', 'hostUid', 'hostName',
        'families', 'memberUids'          // ← Phase 30 additions to denylist
      ])
    );

  allow delete: if signedIn() && resource.data.hostUid == uid();
}
```

**Interaction note:** The existing nested `/families/{familyCode}/watchparties/{wpId}` block STAYS in the rules for backward-compat during the cache-bust window. After Phase 30 client is live + old cache purged, a follow-up can add `allow read: if false` to the nested block. Do NOT remove it now.

---

### `queuenight/firestore.indexes.json` (config, additive)

**Analog:** `queuenight/firestore.indexes.json` lines 1–13.

**Existing index structure** (firestore.indexes.json lines 1–13):
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

**New entry to add** (append to `"indexes"` array):
```json
{
  "collectionGroup": "watchparties",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "memberUids", "arrayConfig": "CONTAINS" },
    { "fieldPath": "startAt", "order": "DESCENDING" }
  ]
}
```
**Critical:** `queryScope` must be `"COLLECTION_GROUP"` (not `"COLLECTION"`) to support the `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` query. RESEARCH Pitfall 7 confirms the query fails silently without this index.

---

### `queuenight/functions/src/rsvpSubmit.js` (service CF, modification)

**Analog:** itself — the existing scan at lines 79–96.

**Existing family scan** (rsvpSubmit.js lines 79–97):
```javascript
// No top-level token→family index yet (v1 simplicity); scan families.
const familiesSnap = await db.collection('families').get();
let wpRef = null;
let wpDoc = null;
let familyCode = null;
for (const f of familiesSnap.docs) {
  const candidateRef = db.collection('families').doc(f.id).collection('watchparties').doc(token);
  const candidateDoc = await candidateRef.get();
  if (candidateDoc.exists) {
    wpRef = candidateRef;
    wpDoc = candidateDoc;
    familyCode = f.id;
    break;
  }
}
if (!wpRef || !wpDoc) {
  return { expired: true };
}
```
**Modification:** Prepend a direct top-level lookup BEFORE the scan (RESEARCH Pitfall 5 fix):
```javascript
// Phase 30 — check top-level /watchparties/{token} first (O(1) lookup).
// Post-Phase-30 wp docs live at the top-level collection. The familyCode
// field is retained on the top-level doc for backward compat below.
let wpRef = null;
let wpDoc = null;
let familyCode = null;

const topLevelRef = db.doc(`watchparties/${token}`);
const topLevelDoc = await topLevelRef.get();
if (topLevelDoc.exists) {
  wpRef = topLevelRef;
  wpDoc = topLevelDoc;
  familyCode = topLevelDoc.data().hostFamilyCode || null; // denormalized on top-level doc
} else {
  // Fall back to legacy nested scan for pre-Phase-30 wps.
  const familiesSnap = await db.collection('families').get();
  for (const f of familiesSnap.docs) {
    const candidateRef = db.collection('families').doc(f.id).collection('watchparties').doc(token);
    const candidateDoc = await candidateRef.get();
    if (candidateDoc.exists) {
      wpRef = candidateRef;
      wpDoc = candidateDoc;
      familyCode = f.id;
      break;
    }
  }
}
if (!wpRef || !wpDoc) {
  return { expired: true };
}
```
The `hostFamilyCode` field must be present on top-level wp docs (stamped by `confirmStartWatchparty` Phase 30 extension or by `wpMigrate` CF).

---

### `tests/rules.test.js` (test, rules assertions)

**Analog:** `tests/rules.test.js` lines 937–974 (Phase 27 `describe` block).

**Seed pattern** (tests/rules.test.js lines 100–119 for Phase 24 seed; 121–130 for Phase 27 seed):
```javascript
// Phase 27 seed — wp with guests[] + rsvpClosed=false for guest-RSVP rule tests.
await db.doc('families/fam1/watchparties/wp_phase27_test').set({
  hostId: 'UID_OWNER',
  hostUid: 'UID_OWNER',
  hostName: 'Test Host',
  // ... guests: [], rsvpClosed: false, ...
});
```
Phase 30 seed adds a TOP-LEVEL wp doc (not nested):
```javascript
// Phase 30 seed — top-level /watchparties/{wpId} with memberUids for cross-family rule tests.
await db.doc('watchparties/wp_phase30_test').set({
  hostUid: UID_OWNER,
  hostFamilyCode: 'fam1',
  families: ['fam1'],
  memberUids: [UID_OWNER, UID_MEMBER],    // both fam1 members
  crossFamilyMembers: [],
  startAt: now,
  status: 'active',
});
```

**Test structure** (tests/rules.test.js lines 947–974):
```javascript
await describe('Phase 27 Guest RSVP rules', async () => {
  await it('#27-01 anon client write to wp.guests → DENIED', async () => {
    await assertFails(
      anon.doc('families/fam1/watchparties/wp_phase27_test')
        .update({ guests: [{ guestId: 'fake-guest-id-aaaaaaaaaa', name: 'Hacker', response: 'yes' }] })
    );
  });
  // ...
  await it('#27-03 family member can read wp doc including guests array → ALLOWED', async () => {
    await assertSucceeds(
      member.doc('families/fam1/watchparties/wp_phase27_test').get()
    );
  });
});
```
Phase 30 analog (GROUP-30-06 + GROUP-30-07):
```javascript
await describe('Phase 30 Couch Groups rules', async () => {
  // GROUP-30-07: stranger cannot read a top-level wp they're not in memberUids
  await it('#30-01 stranger read top-level wp → DENIED', async () => {
    await assertFails(stranger.doc('watchparties/wp_phase30_test').get());
  });
  // GROUP-30-07: member in memberUids can read
  await it('#30-02 member in memberUids reads top-level wp → ALLOWED', async () => {
    await assertSucceeds(member.doc('watchparties/wp_phase30_test').get());
  });
  // GROUP-30-06: non-host cannot write families or memberUids (Path B denylist)
  await it('#30-03 non-host cannot write wp.memberUids → DENIED', async () => {
    await assertFails(
      member.doc('watchparties/wp_phase30_test')
        .update({ memberUids: [UID_OWNER, UID_MEMBER, UID_STRANGER] })
    );
  });
  // GROUP-30-06: non-host cannot write wp.families (Path B denylist)
  await it('#30-04 non-host cannot write wp.families → DENIED', async () => {
    await assertFails(
      member.doc('watchparties/wp_phase30_test')
        .update({ families: ['fam1', 'fam2'] })
    );
  });
});
```

**Test runner boilerplate** (tests/rules.test.js lines 12–29 + lines 976–985):
```javascript
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
// ...
let testEnv;
async function it(name, fn) { ... }
async function describe(name, fn) { ... }
async function seed() { ... }
// run() wraps the entire test file; insert Phase 30 block before testEnv.cleanup() at line 976.
```
**Insertion point:** Add the Phase 30 `describe` block immediately BEFORE `await testEnv.cleanup()` at line 976.

---

### `package.json` (config, additive)

**Analog:** `package.json` lines 18–20 (Phase 27 `smoke:guest-rsvp` alias).

**Existing alias pattern** (package.json line 18):
```json
"smoke:guest-rsvp": "node scripts/smoke-guest-rsvp.cjs",
```
**New alias to add** (insert after line 19 `smoke:pickem`):
```json
"smoke:couch-groups": "node scripts/smoke-couch-groups.cjs",
```

**Existing `smoke` aggregate** (package.json line 8 — truncated):
```
"smoke": "node scripts/smoke-position-transform.cjs && ... && node scripts/smoke-guest-rsvp.cjs && node scripts/smoke-pickem.cjs && node scripts/smoke-app-parse.cjs"
```
**Modification:** Append `&& node scripts/smoke-couch-groups.cjs` at the END of the chain, before the final `smoke-app-parse.cjs` (keep `smoke-app-parse` last — it validates ES module parse integrity of all modified JS files).

---

### `queuenight/functions/src/index.js` (config, additive export)

**Analog:** `queuenight/functions/index.js` lines 1628–1636 (Phase 27 rsvp* exports).

**Existing export block** (index.js lines 1628–1636):
```javascript
exports.rsvpSubmit = require('./src/rsvpSubmit').rsvpSubmit;
exports.rsvpReminderTick = require('./src/rsvpReminderTick').rsvpReminderTick;
// ...
exports.rsvpStatus = require('./src/rsvpStatus').rsvpStatus;
exports.rsvpRevoke = require('./src/rsvpRevoke').rsvpRevoke;
```
**New exports to add** (append after the RSVP block):
```javascript
// Phase 30 — Couch Groups CFs
exports.addFamilyToWp = require('./src/addFamilyToWp').addFamilyToWp;
exports.wpMigrate = require('./src/wpMigrate').wpMigrate;
```

---

### `sw.js` (config, CACHE bump)

**Analog:** `sw.js` line 8.

**Current CACHE value** (sw.js line 8):
```javascript
const CACHE = 'couch-v40-sports-feed-fix';
```
**Bump target** (per CONTEXT.md `§ Canonical refs / Project posture / deploy`):
```javascript
const CACHE = 'couch-v40-couch-groups';
```
Done automatically via `bash scripts/deploy.sh 40-couch-groups`. **Do not hand-edit** — run `deploy.sh` with the short-tag instead; it handles the CACHE bump + mirror copy.

---

## Shared Patterns

### Admin-SDK Init Guard
**Source:** `/c/Users/nahde/queuenight/functions/src/rsvpSubmit.js` lines 30–31
**Apply to:** `addFamilyToWp.js`, `wpMigrate.js`
```javascript
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```

### `onCall` CF Skeleton with CORS
**Source:** `/c/Users/nahde/queuenight/functions/src/rsvpSubmit.js` lines 50–55
**Apply to:** `addFamilyToWp.js`
```javascript
exports.addFamilyToWp = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => { ... });
```

### Auth Guard for Callable CFs
**Source:** `/c/Users/nahde/queuenight/functions/src/joinGroup.js` lines 70–73
**Apply to:** `addFamilyToWp.js`, `wpMigrate.js`
```javascript
if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
```

### Idempotency Guard (Early Return on Already-Done)
**Source:** `/c/Users/nahde/queuenight/functions/src/rsvpSubmit.js` lines 119–123
**Apply to:** `addFamilyToWp.js` (family already-added guard), `wpMigrate.js` (wp already-migrated guard)
```javascript
const isNewGuest = !guestId || !currentGuests.some(g => g && g.guestId === guestId);
if (isNewGuest && currentGuests.filter(g => g && !g.revoked).length >= 100) {
  return { guestCapReached: true };
}
```

### Firestore Rules Path A/B (Host / Non-Host) Split
**Source:** `firestore.rules` lines 587–609
**Apply to:** new top-level `/watchparties/{wpId}` block
```javascript
allow update: if signedIn()
  && request.auth.uid in resource.data.memberUids
  && (
    ( 'hostUid' in resource.data && resource.data.hostUid == request.auth.uid )
    ||
    !request.resource.data.diff(resource.data).affectedKeys().hasAny([...denylist...])
  );
```

### Smoke Sentinel `readIfExists` + `eqContains` Pattern
**Source:** `scripts/smoke-guest-rsvp.cjs` lines 128–140
**Apply to:** `scripts/smoke-couch-groups.cjs`
```javascript
function readIfExists(p) { try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; } }
function eqContains(label, fileContent, needle) {
  if (fileContent === null) { console.log(`  skip ${label} (file not present)`); return; }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`); failed++;
}
```

### Rules Test Seed + Describe/It Harness
**Source:** `tests/rules.test.js` lines 33–47 (harness), lines 50–130 (seed)
**Apply to:** Phase 30 describe block + seed additions
```javascript
async function it(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}`); console.error(`      ${err.message}`); failed++; }
}
```

---

## No Analog Found

No files in Phase 30 are completely without analog. The closest to "no analog" situation:

| File | Risk Note |
|------|-----------|
| `queuenight/functions/src/wpMigrate.js` | One-shot backfill CFs exist (`accountDeletionReaper.js`) but they're scheduled, not callable. The callable one-shot shape is new — combine `onCall` skeleton from `rsvpSubmit.js` + batch-write approach from `accountDeletionReaper.js`. LOW risk. |
| `firestore.rules` (top-level `/watchparties/{wpId}` block) | No prior top-level collection rule with `uid in resource.data.array` membership check exists in this project. The pattern is proven canonical per RESEARCH (Firebase official docs + Doug Stevenson article) but has never been emulator-tested against this codebase. MEDIUM risk — rules tests (GROUP-30-06, GROUP-30-07) are the mitigation. |

---

## Metadata

**Analog search scope:** `js/` (app.js, firebase.js, state.js), `scripts/smoke-*.cjs`, `tests/rules.test.js`, `firestore.rules`, `/c/Users/nahde/queuenight/functions/src/*.js`, `/c/Users/nahde/queuenight/firestore.indexes.json`, `/c/Users/nahde/queuenight/functions/index.js`, `sw.js`, `package.json`
**Files scanned:** 24 source files read or grepped
**Pattern extraction date:** 2026-05-03
