---
plan: 02
phase: 30
wave: 1
depends_on: [01]
files_modified:
  - C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js
  - C:/Users/nahde/queuenight/functions/src/wpMigrate.js
  - C:/Users/nahde/queuenight/functions/index.js
  - C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js
  - firestore.rules
  - tests/rules.test.js
requirements: [GROUP-30-01, GROUP-30-05, GROUP-30-06, GROUP-30-07]
autonomous: false
risk: high
status: ready
gap_closure: false
must_haves:
  truths:
    - "addFamilyToWp callable CF exists in queuenight, validates family code + caller-is-host, fans out memberUids via admin-SDK, ships idempotency guard"
    - "wpMigrate one-shot callable CF exists in queuenight, batch-copies nested wps to top-level with memberUids stamps, idempotent on re-run"
    - "queuenight/functions/index.js exports both new CFs (addFamilyToWp + wpMigrate)"
    - "firestore.rules has a top-level /watchparties/{wpId} block with memberUids read gate + Path A/B write split + families/memberUids in Path B denylist"
    - "rsvpSubmit.js prepends a top-level /watchparties/{token} lookup BEFORE the existing per-family scan; falls back to scan for pre-Phase-30 nested wps (Pitfall 5 fix)"
    - "tests/rules.test.js Phase 30 describe block has 4 REAL assertSucceeds/assertFails tests (replacing Plan 01 PENDING no-ops); rules-tests run goes from 52 to 56 PASS"
    - "Cross-repo deploy executed: composite index built (verified live) + rules deployed + 2 new CFs deployed; ALL three are LIVE before Plan 03 ships"
    - "Composite index watchparties memberUids array-contains is in BUILT state (verified via firebase firestore:indexes listing)"
  artifacts:
    - path: "C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js"
      provides: "Host-only callable CF: validates family code, reads foreign family members via admin-SDK, fans out wp.families/memberUids/crossFamilyMembers"
      min_lines: 80
      exports: ["addFamilyToWp"]
    - path: "C:/Users/nahde/queuenight/functions/src/wpMigrate.js"
      provides: "One-shot callable CF: collectionGroup-scans nested watchparties, copies to top-level with memberUids stamps, idempotent guard"
      min_lines: 60
      exports: ["wpMigrate"]
    - path: "firestore.rules"
      provides: "New top-level /watchparties/{wpId} match block with memberUids read gate + Path A/B write split"
      contains: "match /watchparties/{wpId}"
    - path: "C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js"
      provides: "Top-level wp lookup BEFORE family scan (Pitfall 5 fix)"
      contains: "topLevelDoc.exists"
  key_links:
    - from: "addFamilyToWp CF"
      to: "/watchparties/{wpId} doc"
      via: "admin-SDK update with FieldValue.arrayUnion(...newUids)"
      pattern: "FieldValue\\.arrayUnion"
    - from: "firestore.rules /watchparties/{wpId}"
      to: "wp.memberUids[] field"
      via: "request.auth.uid in resource.data.memberUids"
      pattern: "request\\.auth\\.uid in resource\\.data\\.memberUids"
    - from: "rsvpSubmit.js"
      to: "/watchparties/{token} top-level doc"
      via: "db.doc top-level lookup prepended before family scan"
      pattern: "topLevelDoc\\.exists"
---

<objective>
Wave 1 backend: ship the three Cloud Function changes (addFamilyToWp NEW + wpMigrate NEW + rsvpSubmit MODIFY) plus the firestore.rules top-level /watchparties/{wpId} block, then execute the cross-repo deploy ritual that satisfies the BLOCKING gate from Plan 01: composite index BUILT, rules LIVE, CFs LIVE — ALL before Plan 03 client code ships.

This plan also fills in the 4 PENDING rules-test assertions Plan 01 scaffolded, taking the rules-tests count from 52 to 56 PASS.

Purpose: Establishes the server-side trust boundary (CF host-only check + rules memberUids gate + Pitfall 5 RSVP fix) so Wave 2 client code can safely subscribe via collectionGroup and trust that data writes are authorized.

Output: 4 new/modified files in queuenight (2 new CFs + 1 modified CF + 1 modified index.js); 2 modified files in couch (firestore.rules + tests/rules.test.js Phase 30 describe block — the source-tree firestore.rules acts as the canonical reference; production rules deploy from queuenight). Cross-repo deploy lands all three Firebase surfaces (indexes + rules + functions).

Checkpoint at end: human verification that the cross-repo deploy succeeded AND the index is BUILT (Firestore index builds can take 1-15 min for empty/small collections; client code in Plan 03 will silently fail until BUILT state).
</objective>

<execution_context>
@C:/Users/nahde/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/nahde/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-01-foundation-roadmap-requirements-indexes-PLAN.md
@CLAUDE.md
@C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js
@C:/Users/nahde/queuenight/functions/src/joinGroup.js
@C:/Users/nahde/queuenight/functions/src/accountDeletionReaper.js
@C:/Users/nahde/queuenight/functions/index.js
@firestore.rules
@tests/rules.test.js
@C:/Users/nahde/queuenight/firestore.indexes.json

NOTE: Embedded code samples for executor reference live in 30-RESEARCH.md (canonical CF skeleton, rules block, rsvpSubmit prepend) and 30-PATTERNS.md (analog file refs with line numbers). The action sections below cite those references and contain inline code blocks the executor can paste verbatim.
</context>

<tasks>

<task type="auto">
  <name>Task 2.1: Create addFamilyToWp + wpMigrate CFs and wire into queuenight/functions/index.js exports</name>
  <files>C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js, C:/Users/nahde/queuenight/functions/src/wpMigrate.js, C:/Users/nahde/queuenight/functions/index.js</files>
  <read_first>
    - C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js (full file — exact CF skeleton with onCall config, CORS, auth guard, idempotency guard, runTransaction pattern)
    - C:/Users/nahde/queuenight/functions/src/joinGroup.js (read lines 70-90 — exact `if (!request.auth)` auth pattern + family-code validation)
    - C:/Users/nahde/queuenight/functions/src/accountDeletionReaper.js (read lines 1-60 — admin-SDK init + bulkWriter + collectionGroup scan pattern)
    - C:/Users/nahde/queuenight/functions/index.js (Grep first for `exports.rsvp` to locate the existing rsvp* exports block — file is large; do NOT read in full)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (sections "addFamilyToWp.js", "wpMigrate.js", "queuenight/functions/src/index.js")
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (sections "Pattern 2: addFamilyToWp Cloud Function", "Common Pitfalls" Pitfall 3 idempotency, "Security Domain" 5 threats with mitigations)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md (D-07 host-only invite authority, D-08 soft cap 4 / hard cap 8)
  </read_first>
  <action>
Cross-repo work: All three files live in `C:/Users/nahde/queuenight/functions/` (NOT in couch repo). Use absolute paths.

(a) Create `C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js` — new file. Complete implementation (~110 lines). Use this exact content:

```
'use strict';
// Phase 30 — addFamilyToWp callable CF.
// Host-only: validates other family code, reads its members via admin-SDK,
// fans out wp.families[]/memberUids[]/crossFamilyMembers[] atomically.
// Mirrors rsvpSubmit.js skeleton (Phase 27 precedent).

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function looksLikeFamilyCode(s) {
  return typeof s === 'string' && s.length >= 4 && s.length <= 32 && /^[A-Za-z0-9_-]+$/.test(s);
}
function looksLikeWpId(s) {
  return typeof s === 'string' && s.length >= 8 && s.length <= 64 && /^[A-Za-z0-9_-]+$/.test(s);
}

exports.addFamilyToWp = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30,
}, async (request) => {
  // T-30-01 Spoofing: require auth.
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const { wpId, familyCode } = (request.data || {});

  // T-30 Input Validation: bound shapes.
  if (!looksLikeWpId(wpId)) throw new HttpsError('invalid-argument', 'Invalid watchparty.');
  if (!looksLikeFamilyCode(familyCode)) {
    // T-30-03 Confidentiality: same neutral error for malformed vs nonexistent code.
    throw new HttpsError('not-found', 'No family with that code.');
  }

  // T-30-03 Confidentiality: validate family exists. Same error as malformed.
  const familyDoc = await db.doc('families/' + familyCode).get();
  if (!familyDoc.exists) {
    throw new HttpsError('not-found', 'No family with that code.');
  }

  // T-30-01 Spoofing (host-only): caller MUST be wp host.
  const wpDoc = await db.doc('watchparties/' + wpId).get();
  if (!wpDoc.exists || wpDoc.data().hostUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Host only.');
  }
  const wp = wpDoc.data();

  // Idempotency (Pitfall 3): family already added.
  const currentFamilies = Array.isArray(wp.families) ? wp.families : [];
  if (currentFamilies.includes(familyCode)) {
    const familyDisplayName = familyDoc.data().displayName || familyDoc.data().name || familyCode;
    return { ok: true, alreadyAdded: true, familyDisplayName };
  }

  // T-30-04 DoS (hard cap): D-08 ceiling = 8 families per wp.
  if (currentFamilies.length >= 8) {
    throw new HttpsError('resource-exhausted', 'No more room on this couch tonight.');
  }

  // Read foreign family members via admin SDK (bypasses isMemberOfFamily(foreignCode) rule).
  const membersSnap = await db.collection('families/' + familyCode + '/members').get();
  const newUids = membersSnap.docs
    .map(d => d.data().uid)
    .filter(uid => uid && typeof uid === 'string');

  // W4 fix (revision): zero-member family guard.
  // If the family exists but has no qualifying members (no docs with a string  field),
  // refuse to fan-out — otherwise the host sees a misleading 'Couch added' toast for a
  // family that contributes nothing to memberUids/crossFamilyMembers. Throw a typed
  // failed-precondition error so the UI can surface a brand-voice toast (Plan 04 maps
  // the code to: "That family hasn't added any members yet — ask them to invite people first.").
  if (newUids.length === 0) {
    throw new HttpsError('failed-precondition', 'That family has no members yet.');
  }

  const familyDisplayName = familyDoc.data().displayName || familyDoc.data().name || familyCode;

  const crossFamilyRows = membersSnap.docs.map(d => {
    const dd = d.data();
    return {
      familyCode: familyCode,
      familyDisplayName: familyDisplayName,
      memberId: d.id,
      name: dd.name || '',
      color: dd.color || '#888',
      avatar: dd.avatar || null,
    };
  });

  // Atomic fan-out. arrayUnion safe here because the idempotency guard above
  // ensures we never call this with an already-added familyCode (Pitfall 3).
  await db.doc('watchparties/' + wpId).update({
    families: admin.firestore.FieldValue.arrayUnion(familyCode),
    memberUids: admin.firestore.FieldValue.arrayUnion.apply(null, newUids),
    crossFamilyMembers: admin.firestore.FieldValue.arrayUnion.apply(null, crossFamilyRows),
    lastActivityAt: Date.now(),
  });

  return {
    ok: true,
    addedMemberCount: newUids.length,
    familyDisplayName: familyDisplayName,
    familyCode: familyCode,
  };
});
```

Note on the spread-call: `arrayUnion.apply(null, newUids)` and `arrayUnion.apply(null, crossFamilyRows)` are used instead of spread syntax to avoid any ESM/CJS edge in older Node runtimes. If the queuenight runtime supports ES2020+ (verify via `node --version` in queuenight/functions/package.json engines), the executor MAY substitute `arrayUnion(...newUids)` and `arrayUnion(...crossFamilyRows)` for readability. Both forms produce identical behavior.

(b) Create `C:/Users/nahde/queuenight/functions/src/wpMigrate.js` — new file. Complete implementation (~75 lines). Use this exact content:

```
'use strict';
// Phase 30 — wpMigrate callable CF.
// One-shot: collectionGroup-scans nested families/{code}/watchparties/{wpId} docs,
// copies each to top-level /watchparties/{wpId} with memberUids stamped from the
// family current members. Idempotent on re-run (skips wps already migrated).

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.wpMigrate = onCall({
  region: 'us-central1',
  memory: '512MiB',
  timeoutSeconds: 540,
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');

  const cgSnap = await db.collectionGroup('watchparties').get();
  const bulkWriter = db.bulkWriter();
  let copied = 0;
  let skipped = 0;
  let invalid = 0;

  for (const d of cgSnap.docs) {
    const parts = d.ref.path.split('/');
    // Only process nested docs at families/{code}/watchparties/{wpId}.
    // Skip docs that are already top-level at /watchparties/{wpId}.
    if (parts.length !== 4 || parts[0] !== 'families' || parts[2] !== 'watchparties') {
      invalid++; continue;
    }
    const familyCode = parts[1];
    const wpId = parts[3];

    // Idempotency: already migrated (top-level doc exists with memberUids).
    const existing = await db.doc('watchparties/' + wpId).get();
    if (existing.exists && Array.isArray(existing.data().memberUids) && existing.data().memberUids.length > 0) {
      skipped++; continue;
    }

    // Stamp memberUids from this family current member roster.
    const membersSnap = await db.collection('families/' + familyCode + '/members').get();
    const memberUids = membersSnap.docs
      .map(m => m.data().uid)
      .filter(u => u && typeof u === 'string');

    const wpData = d.data();
    bulkWriter.set(db.doc('watchparties/' + wpId), Object.assign({}, wpData, {
      hostFamilyCode: familyCode,
      families: [familyCode],
      memberUids: memberUids,
      crossFamilyMembers: wpData.crossFamilyMembers || [],
    }));
    copied++;
  }

  await bulkWriter.close();

  return { ok: true, copied: copied, skipped: skipped, invalid: invalid, total: cgSnap.docs.length };
});
```

(c) Edit `C:/Users/nahde/queuenight/functions/index.js` — find the existing rsvp* exports block. Use Grep for `exports.rsvpRevoke` to locate. Append immediately AFTER that line:

```
// Phase 30 — Couch Groups CFs
exports.addFamilyToWp = require('./src/addFamilyToWp').addFamilyToWp;
exports.wpMigrate = require('./src/wpMigrate').wpMigrate;
```

Do NOT modify any other exports. Do NOT modify the rest of index.js.
  </action>
  <verify>
    <automated>node -c C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js &amp;&amp; node -c C:/Users/nahde/queuenight/functions/src/wpMigrate.js &amp;&amp; grep -q "exports.addFamilyToWp = require" C:/Users/nahde/queuenight/functions/index.js &amp;&amp; grep -q "exports.wpMigrate = require" C:/Users/nahde/queuenight/functions/index.js</automated>
  </verify>
  <acceptance_criteria>
    - `node -c C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js` exits 0 (parses cleanly)
    - `node -c C:/Users/nahde/queuenight/functions/src/wpMigrate.js` exits 0 (parses cleanly)
    - `grep -q "exports.addFamilyToWp = require" C:/Users/nahde/queuenight/functions/index.js` returns 0
    - `grep -q "exports.wpMigrate = require" C:/Users/nahde/queuenight/functions/index.js` returns 0
    - addFamilyToWp.js contains: `request.auth.uid` (auth check), `looksLikeFamilyCode` (input validation), `currentFamilies.includes(familyCode)` (idempotency guard), `currentFamilies.length >= 8` (hard cap = D-08 ceiling), `'No family with that code.'` (used in BOTH the malformed-code and nonexistent-code branches per T-30-03 confidentiality), `FieldValue.arrayUnion` (atomic fan-out)
    - addFamilyToWp.js does NOT contain `currentFamilies.length >= 4` (4 is SOFT cap = client-side; server enforces hard cap 8 only)
    - wpMigrate.js contains `db.collectionGroup('watchparties')` AND `db.bulkWriter()` AND `existing.data().memberUids` (idempotency)
    - wpMigrate.js skips top-level paths: `parts[0] !== 'families'` guard present
    - **W4 fix — zero-member family guard:** addFamilyToWp.js contains `if (newUids.length === 0) {` followed by `throw new HttpsError('failed-precondition', 'That family has no members yet.');` — verify via `grep -q "newUids.length === 0" C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js` returns 0 AND `grep -q "That family has no members yet" C:/Users/nahde/queuenight/functions/src/addFamilyToWp.js` returns 0
    - **W4 fix — guard order:** the zero-member check fires AFTER the membersSnap read but BEFORE the atomic fan-out. Verify by reading the action code block: the guard sits between `const newUids = ...` and `const familyDisplayName = ...`.
    - **W4 fix — failed-precondition disposition:** the thrown error code is `failed-precondition` (NOT `not-found`) so the UI error matrix in Plan 04 can map this distinct code to a brand-voice toast ("That family hasn't added any members yet — ask them to invite people first.") rather than the generic "No family with that code." toast used for genuinely missing families. Plan 04 Task 4.5 sentinel 2.48 codifies this.
    - All three files committed to queuenight git BEFORE deploy task (Task 2.5) runs
  </acceptance_criteria>
  <done>
    Both new CFs implemented in queuenight repo with all 5 STRIDE mitigations from RESEARCH.md Security Domain (Spoofing/Tampering/Info-Disclosure/DoS/DoS-via-RSVP-regression — the last is Task 2.2) PLUS the **W4 zero-member family guard** (revision fix). index.js exports both. Files parse cleanly via `node -c`. Ready for deploy in Task 2.5.
  </done>
</task>

<task type="auto">
  <name>Task 2.2: Patch rsvpSubmit.js with top-level lookup before family scan (Pitfall 5 fix)</name>
  <files>C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js</files>
  <read_first>
    - C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js (full file — specifically lines 79-97 which are the existing family-scan that we PREPEND a top-level lookup before; do NOT delete the scan, only prepend)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Common Pitfalls" Pitfall 5 — the exact failure mode: guest RSVP returns expired:true for all post-Phase-30 wps if scan isn't extended)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "queuenight/functions/src/rsvpSubmit.js" — exact prepend pattern; PRESERVE the legacy scan as fallback)
  </read_first>
  <action>
Critical Pitfall 5 fix. Without this, all post-Phase-30 watchparties will silently fail guest-RSVP because rsvpSubmit existing scan only looks under `families/*/watchparties/{token}` and post-Phase-30 wps live at top-level `/watchparties/{token}`.

Edit `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js`. Locate the existing family-scan block (PATTERNS.md says lines 79-97). It currently begins with the comment line `// No top-level token` and ends with the `if (!wpRef || !wpDoc) { return { expired: true }; }` block.

REPLACE that entire block with:

```
// Phase 30 — top-level /watchparties/{token} lookup FIRST (O(1) lookup;
// post-Phase-30 wps live at top-level). Falls back to legacy nested family scan
// for pre-Phase-30 wps still living at families/{code}/watchparties/{token}.
// See RESEARCH.md Pitfall 5 — without this branch, guest RSVP returns expired:true
// for ALL post-Phase-30 wps and breaks the entire Phase 27 guest flow for new wps.
//
// B3 fix (revision): Two-resolution branch.
// (a) Top-level doc exists AND has hostFamilyCode — use it. familyCode is non-null;
//     downstream usage (wp.guests aggregation, idempotency, push setup at lines 178-179
//     where familyCode drives the host-member doc fetch) is safe.
// (b) Top-level doc exists but hostFamilyCode is missing — this is the deploy-window
//     edge case: a wp written by the OLD client to the OLD nested path during the gap
//     between Plan 02 (CF + rules deploy) and Plan 03 (client subscription shift). The
//     top-level doc may have been minted by wpMigrate without a hostFamilyCode stamp,
//     OR the doc may not have a hostFamilyCode field for legitimate reasons. Fall
//     through to the nested scan, which sets familyCode = f.id correctly from the
//     legacy path. NEVER silently set familyCode = null and proceed; the downstream
//     `db.collection('families').doc(familyCode).collection('members').doc(wp.hostId)`
//     read at line ~178 would silently break.
// (c) Top-level doc does not exist — fall through to legacy nested scan (the original
//     Phase 27 behavior for pre-Phase-30 wps still living at families/{code}/watchparties/{token}).
let wpRef = null;
let wpDoc = null;
let familyCode = null;

const topLevelRef = db.doc('watchparties/' + token);
const topLevelDoc = await topLevelRef.get();
if (topLevelDoc.exists && topLevelDoc.data() && topLevelDoc.data().hostFamilyCode) {
  // Branch (a) — top-level doc with hostFamilyCode stamped. Use directly.
  wpRef = topLevelRef;
  wpDoc = topLevelDoc;
  familyCode = topLevelDoc.data().hostFamilyCode;
} else {
  // Branches (b) and (c) — fall through to legacy nested scan.
  // For (b): the nested scan finds the same wp at families/{f.id}/watchparties/{token}
  // (it was written by the old client to the nested path during the deploy window) and
  // sets familyCode = f.id correctly. wpRef/wpDoc become the nested ref (NOT topLevelRef);
  // the runTransaction below operates on the nested doc. This preserves Phase 27 semantics
  // for the deploy-window edge case AND for genuinely pre-Phase-30 wps.
  // For (c): same fallback — pure pre-Phase-30 wp at the nested path.
  // PRESERVE Phase 27 behavior in both sub-cases.
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

Do NOT modify any other part of rsvpSubmit.js. Do NOT touch the runTransaction block at lines 130-171, the looksLikeWpId function at lines 44-48, or the cors config.

Post-edit: the rest of rsvpSubmit.js's existing logic (familyCode used downstream for wp.guests aggregation, idempotency, push setup) ALL works because `familyCode` is correctly populated by the active branch:
- Branch (a): `familyCode` from `topLevelDoc.data().hostFamilyCode` (post-Phase-30 + properly stamped).
- Branch (b)/(c): `familyCode = f.id` from the nested scan (pre-Phase-30 OR top-level doc missing hostFamilyCode).

The `hostFamilyCode` field is stamped on top-level wp docs by Plan 03's `confirmStartWatchparty` extension AND by Plan 02's wpMigrate CF — so once Plan 03 ships, branch (a) covers all newly-created wps. Branch (b) only matters during the brief Plan-02-to-Plan-03 deploy window OR if a wpMigrate run lands docs without hostFamilyCode.

**Edge-case acceptance:** If neither path resolves a doc (the wp truly does not exist anywhere), the existing `if (!wpRef || !wpDoc) { return { expired: true }; }` returns the same Phase 27 confidentiality response — no leak about whether the token was wrong vs too old.
  </action>
  <verify>
    <automated>node -c C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js &amp;&amp; grep -q "topLevelDoc.exists && topLevelDoc.data() && topLevelDoc.data().hostFamilyCode" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js &amp;&amp; grep -q "Pitfall 5" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js &amp;&amp; ! grep -q "familyCode = topLevelDoc.data().hostFamilyCode || null" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js</automated>
  </verify>
  <acceptance_criteria>
    - `node -c C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` exits 0
    - `grep -q "topLevelDoc.exists" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 0 (top-level branch present)
    - `grep -q "Pitfall 5" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 0 (rationale comment present)
    - `grep -q "hostFamilyCode" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 0 (familyCode derived correctly from top-level doc)
    - `grep -q "Fallback: legacy nested scan" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 0 (PRESERVES the existing nested scan as fallback for pre-Phase-30 wps)
    - The original `for (const f of familiesSnap.docs)` loop is STILL present (in the else branch)
    - The runTransaction block (Phase 27 transactional upsert) is UNCHANGED — `grep -c "db.runTransaction" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 1 (still present, not duplicated, not removed)
    - **B3 fix — null-safe familyCode:** the top-level branch is GATED on `hostFamilyCode` presence — `grep -q "topLevelDoc.exists && topLevelDoc.data() && topLevelDoc.data().hostFamilyCode" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 0
    - **B3 fix — fall-through to nested scan:** when the top-level doc lacks `hostFamilyCode`, the code falls through to the nested-scan loop which sets `familyCode = f.id`. Verify by reading lines surrounding the `else { ... }` branch and confirming the loop populates `familyCode = f.id` (NOT null).
    - **B3 fix — defensive: no path silently sets familyCode = null and proceeds:** `grep -q "familyCode = topLevelDoc.data().hostFamilyCode || null" C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` returns 1 (the original problematic `|| null` fallback MUST be absent — only the gated assignment remains)
    - **B3 fix — downstream familyCode usage is null-safe:** the existing line 178 fallback `else if (wp.hostId && familyCode) { ... db.collection('families').doc(familyCode)... }` already short-circuits when `familyCode` is null (truthy check on `familyCode`); no new null-handling code is required there. Verify the line 178 conditional is UNCHANGED post-edit.
    - **B3 fix — Phase 27 smoke remains green:** `npm run smoke:guest-rsvp` exits 0 (47 assertions PASS — confirms no Phase 27 regression from the rsvpSubmit edit, and that the production-code sentinels still match)
  </acceptance_criteria>
  <done>
    rsvpSubmit.js now performs O(1) top-level lookup first **gated on hostFamilyCode presence** (B3 fix), falls back to legacy scan for backward compat AND for the deploy-window edge case. Phase 27 guest RSVP flow continues to work for ALL wps (pre-Phase-30 nested + post-Phase-30 top-level + deploy-window-orphan). RESEARCH Pitfall 5 closed at code level. Downstream `familyCode` usage at line ~178 is never null-on-truthy-path; existing `else if` short-circuit already handles the truly-missing case.
  </done>
</task>

<task type="auto">
  <name>Task 2.3: Add top-level /watchparties/{wpId} block to firestore.rules</name>
  <files>firestore.rules</files>
  <read_first>
    - firestore.rules (full file — Grep first for `match /watchparties` to locate; specifically read lines 577-610 for the Phase 24 nested block whose Path A/B structure we transplant verbatim to the new top-level block)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Pattern 1: Top-Level Watchparty Collection with memberUids Gate" — exact rules block code)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "firestore.rules" — placement guidance + denylist Phase 30 additions)
    - tests/rules.test.js (full file — to verify what helpers `signedIn()` and `uid()` already exist; they must be defined at the top of firestore.rules)
  </read_first>
  <action>
Add a new top-level `match /watchparties/{wpId}` block to `firestore.rules`. This is a NEW block (does NOT replace the existing nested block at lines 577-610 — the nested block STAYS for backward compat during cache-bust window per RESEARCH Q5).

Insertion location: BEFORE the existing `match /families/{familyCode}` block, at the top-level inside `match /databases/{database}/documents { ... }`. Use Grep to find `match /databases` to locate the wrapping match.

Add this block:

```
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
        'families', 'memberUids'
      ])
    );

  allow delete: if signedIn() && resource.data.hostUid == uid();
}
```

CRITICAL: Do NOT modify the existing nested `/families/{familyCode}/watchparties/{wpId}` block at lines 577-610. It stays IN PLACE (PATTERNS.md note: "After Phase 30 client is live + old cache purged, a follow-up can add `allow read: if false` to the nested block. Do NOT remove it now.").

CRITICAL: Verify both `signedIn()` and `uid()` helper functions exist at the top of firestore.rules (they should — Phase 24+ relies on them). If `uid()` doesn't exist, define it at the top: `function uid() { return request.auth.uid; }`. The Phase 24 nested block uses `attributedWrite(familyCode)` which depends on `isMemberOfFamily`; the new top-level block intentionally does NOT use those helpers — its gate is purely `request.auth.uid in resource.data.memberUids` (cleaner; the canonical pattern per RESEARCH).
  </action>
  <verify>
    <automated>grep -c "match /watchparties/{wpId}" firestore.rules &amp;&amp; grep -q "request.auth.uid in resource.data.memberUids" firestore.rules &amp;&amp; grep -q "'families', 'memberUids'" firestore.rules</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "match /watchparties/{wpId}" firestore.rules` returns 2 (the original nested block + the new top-level block — both must coexist)
    - `grep -q "request.auth.uid in resource.data.memberUids" firestore.rules` returns 0
    - `grep -q "'families', 'memberUids'" firestore.rules` returns 0 (Phase 30 additions to Path B denylist)
    - `grep -q "Phase 30 — Top-level" firestore.rules` returns 0 (rationale comment present)
    - `grep -c "currentTimeMs" firestore.rules` returns AT LEAST 2 (existing nested block + new top-level block; both denylists)
    - The existing nested block IS still present — verify by checking that `attributedWrite(familyCode)` STILL appears in the file (the legacy nested write path) — `grep -q "attributedWrite(familyCode)" firestore.rules` returns 0
    - `signedIn()` is defined or already imported (verify via `grep -q "function signedIn" firestore.rules`)
    - `uid()` is defined or already imported (verify via `grep -q "function uid" firestore.rules` — if missing, the executor adds it at the top of the file)
  </acceptance_criteria>
  <done>
    firestore.rules has a new top-level /watchparties/{wpId} block that satisfies GROUP-30-06 (host-only gate via Path A/B + denylist) and GROUP-30-07 (cross-family wp read denied for non-memberUids). Existing nested block preserved for backward compat. Source-tree firestore.rules updated; production deploy happens in Task 2.5 from queuenight repo.
  </done>
</task>

<task type="auto">
  <name>Task 2.4: Replace 4 PENDING rules-test stubs with real assertSucceeds/assertFails (52 to 56 PASS)</name>
  <files>tests/rules.test.js</files>
  <read_first>
    - tests/rules.test.js (full file — read the test runner harness lines 12-47, the seed function at lines 50-130, the Phase 24 + Phase 27 describe blocks at lines 800-974, AND the cleanup line ~976)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "tests/rules.test.js" — seed pattern + describe block structure)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-01-foundation-roadmap-requirements-indexes-PLAN.md (Task 1.4 part b — see the 4 PENDING describe block scaffold; this task fills in those 4 it() bodies)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (Q2 + Pitfall 2 — explains why query alignment matters even though these tests are doc-level reads)
  </read_first>
  <action>
Two sub-edits:

(a) Add Phase 30 seed to the seed function. Locate the seed function (lines 50-130 area). After the existing Phase 27 seed block (which writes `families/fam1/watchparties/wp_phase27_test`), add:

```
// Phase 30 seed — top-level /watchparties/{wpId} with memberUids for cross-family rule tests.
await db.doc('watchparties/wp_phase30_test').set({
  hostId: 'UID_OWNER',
  hostUid: 'UID_OWNER',
  hostName: 'Test Host',
  hostFamilyCode: 'fam1',
  families: ['fam1'],
  memberUids: ['UID_OWNER', 'UID_MEMBER'],
  crossFamilyMembers: [],
  startAt: now,
  status: 'active',
  participants: { m1: { name: 'Test Host' } },
  reactions: [],
  guests: [],
});
```

The exact UID identifiers (`UID_OWNER`, `UID_MEMBER`, `UID_STRANGER`) MUST match the same string-literal identifiers used in the existing test setup blocks for Phase 24/27 (Grep `tests/rules.test.js` for `UID_OWNER` to confirm — adapt if the existing convention uses a different naming scheme like `OWNER_UID`).

(b) Replace the 4 PENDING it() bodies inside the `Phase 30 Couch Groups rules` describe block. Locate the block (Plan 01 placed it immediately before `await testEnv.cleanup()` at ~line 976). Replace each it() body:

```
await describe('Phase 30 Couch Groups rules', async () => {
  // GROUP-30-07: stranger cannot read top-level wp (not in memberUids)
  await it('#30-01 stranger read top-level wp -> DENIED', async () => {
    await assertFails(stranger.doc('watchparties/wp_phase30_test').get());
  });

  // GROUP-30-07: member in memberUids can read
  await it('#30-02 member in memberUids reads top-level wp -> ALLOWED', async () => {
    await assertSucceeds(member.doc('watchparties/wp_phase30_test').get());
  });

  // GROUP-30-06: non-host cannot write wp.memberUids (Path B denylist blocks)
  await it('#30-03 non-host cannot write wp.memberUids -> DENIED', async () => {
    await assertFails(
      member.doc('watchparties/wp_phase30_test')
        .update({ memberUids: ['UID_OWNER', 'UID_MEMBER', 'UID_STRANGER'] })
    );
  });

  // GROUP-30-06: non-host cannot write wp.families (Path B denylist blocks)
  await it('#30-04 non-host cannot write wp.families -> DENIED', async () => {
    await assertFails(
      member.doc('watchparties/wp_phase30_test')
        .update({ families: ['fam1', 'fam2'] })
    );
  });
});
```

The `member`, `stranger` Firestore client objects MUST already exist in the test setup (they support Phase 24/27). If their UID stamping uses different names than `UID_OWNER`/`UID_MEMBER`/`UID_STRANGER`, the executor adapts — the seed write and assertion identifiers MUST agree.

Update the describe label: change `'Phase 30 Couch Groups rules (PENDING — Plan 30-02 fills assertions)'` to `'Phase 30 Couch Groups rules'` (drop the PENDING marker now that assertions are real).
  </action>
  <verify>
    <automated>cd tests &amp;&amp; npm test 2>&amp;1 | grep -E "(passed|56|FAIL)" | head -20</automated>
  </verify>
  <acceptance_criteria>
    - `cd tests && npm test` exits 0
    - Test output reports 56 passing tests (52 pre-existing + 4 new Phase 30 = 56)
    - `grep -q "watchparties/wp_phase30_test" tests/rules.test.js` returns 0 (seed line present)
    - `grep -c "#30-0[1-4]" tests/rules.test.js` returns 4 (all 4 it() declarations present)
    - `grep -q "PENDING — Plan 30-02 fills assertions" tests/rules.test.js` returns 1 (PENDING marker REMOVED — must NOT match)
    - `grep -c "assertFails\\|assertSucceeds" tests/rules.test.js` increased by AT LEAST 4 vs the pre-edit count (4 new assertions added)
    - All 4 new tests use the seeded `wp_phase30_test` doc (no DETACHED test data)
    - The `await testEnv.cleanup()` line at the end of the file is UNCHANGED (still cleans up after the new Phase 30 block)
  </acceptance_criteria>
  <done>
    Rules tests grow from 52 to 56 PASS. GROUP-30-06 closed at the rules-test layer (#30-03 + #30-04 deny non-host writes to families/memberUids). GROUP-30-07 closed at the rules-test layer (#30-01 strangers denied + #30-02 members allowed). The source-tree firestore.rules is canonically tested; the same rules deploy to production in Task 2.5.
  </done>
</task>

<task type="checkpoint:human-action">
  <name>Task 2.5 [BLOCKING gate]: Cross-repo deploy — indexes + rules + functions FROM queuenight repo + verify index BUILT</name>
  <files>(none — deploy step)</files>
  <read_first>
    - .planning/STATE.md (current cache: couch-v40-sports-feed-fix; this plan does NOT bump cache — Plan 05 owns the bump to couch-v41-couch-groups)
    - C:/Users/nahde/queuenight/firestore.indexes.json (verify Plan 01 Task 1.3 added the COLLECTION_GROUP entry)
    - C:/Users/nahde/queuenight/firestore.rules (sibling-repo copy of source-tree firestore.rules — must mirror BEFORE deploy per the v34 cross-repo deploy ritual in 24-04-SUMMARY.md)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Common Pitfalls" Pitfall 7 — index BUILT vs DECLARED state distinction)
  </read_first>
  <what-built>
    - 2 new CFs in queuenight (addFamilyToWp + wpMigrate) — Task 2.1
    - rsvpSubmit.js Pitfall 5 fix — Task 2.2
    - firestore.rules new top-level /watchparties/{wpId} block — Task 2.3
    - 4 real Phase 30 rules tests passing (52 to 56) — Task 2.4
    - firestore.indexes.json COLLECTION_GROUP entry declared (Plan 01 Task 1.3)
  </what-built>
  <how-to-verify>
    Cross-repo deploy ritual (mirrors Phase 24-04 + Phase 27-05 close-outs):

    Step 1 — Mirror source-tree files to queuenight (since queuenight is the deploy source for rules):
    ```
    cp /c/Users/nahde/claude-projects/couch/firestore.rules /c/Users/nahde/queuenight/firestore.rules
    ```

    Step 2 — From queuenight repo, deploy indexes FIRST (must build before client query goes live in Plan 03):
    ```
    cd /c/Users/nahde/queuenight && firebase deploy --only firestore:indexes --project queuenight-84044
    ```

    Step 3 — Wait for index BUILT state. Run repeatedly until the watchparties memberUids index shows `READY` (NOT `CREATING`):
    ```
    firebase firestore:indexes --project queuenight-84044
    ```
    Look for a row matching `watchparties` collectionGroup with `memberUids` array-contains. State must be `READY`. For an empty/small collection this typically completes in 1-15 minutes; for larger collections it may take longer. Plan 03 is BLOCKED until this is READY (per RESEARCH Pitfall 7 the client `collectionGroup` query silently fails until BUILT).

    Step 4 — Deploy rules:
    ```
    firebase deploy --only firestore:rules --project queuenight-84044
    ```

    Step 5 — Deploy functions:
    ```
    firebase deploy --only functions:addFamilyToWp,functions:wpMigrate,functions:rsvpSubmit --project queuenight-84044
    ```
    (Targeting only the 3 changed CFs avoids redeploying the other ~20 unrelated CFs.)

    Step 6 — Verify CF endpoints exist post-deploy:
    ```
    firebase functions:list --project queuenight-84044 | grep -E "addFamilyToWp|wpMigrate"
    ```
    Both should appear.

    Step 7 — Confirm sw.js cache is UNCHANGED at `couch-v40-sports-feed-fix` (Plan 02 does NOT deploy hosting; Plan 05 owns the cache bump).

    Resume signals:
    - Type `deploy ok` to confirm all 3 surfaces are live AND the index is READY (NOT just CREATING).
    - Type `index still building` if the deploy succeeded but `firebase firestore:indexes` still shows the watchparties memberUids entry as CREATING — Plan 03 is BLOCKED until READY; do not proceed until verified READY.
    - Type `failed: <details>` if any step erred. Common failure modes: stale .firebaserc in queuenight (fix: `firebase use queuenight-84044`), Node engine mismatch in queuenight/functions/package.json (fix: align engines with the installed Node version), CF cold-start error during deploy (fix: re-run; deploy is idempotent).
  </how-to-verify>
  <resume-signal>Type "deploy ok" (with index READY) OR "index still building" OR "failed: ..."</resume-signal>
  <acceptance_criteria>
    - `firebase functions:list --project queuenight-84044 | grep -q "addFamilyToWp"` returns 0 post-deploy
    - `firebase functions:list --project queuenight-84044 | grep -q "wpMigrate"` returns 0 post-deploy
    - `firebase firestore:indexes --project queuenight-84044` lists a watchparties + memberUids entry in state READY (NOT CREATING)
    - Production rules contain the new top-level /watchparties/{wpId} block — verify via Firebase Console -> Firestore -> Rules tab (manual visual check) OR via `firebase firestore:rules:get` if the CLI version supports it
    - Source-tree `firestore.rules` and `C:/Users/nahde/queuenight/firestore.rules` are byte-identical (`diff` returns 0)
    - sw.js CACHE is UNCHANGED — `grep "const CACHE" sw.js` still returns `couch-v40-sports-feed-fix`
    - The user has explicitly confirmed `deploy ok` AND that the index is READY before this task is marked done — Plan 03 will silently fail without it
  </acceptance_criteria>
  <done>
    Cross-repo deploy complete: composite index BUILT, rules LIVE, both new CFs LIVE, rsvpSubmit Pitfall 5 fix LIVE. Plan 03 (client subscription shift) can now ship without silent query failure. Production rules tests will run cleanly because the source-tree rules + the deployed production rules are byte-identical.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted client -> addFamilyToWp CF | Family code + wpId arrive from untrusted client; CF must validate format, family existence, and host-only authorization |
| Untrusted client -> Firestore rules /watchparties/{wpId} | Cross-family read attempts arrive without server mediation; rules predicate is the gate |
| Cross-family member subcollection -> CF (admin-SDK) | Admin SDK bypasses isMemberOfFamily(foreignCode) — only the CF (not direct client) can read the foreign family's members |
| Pre-Phase-30 nested wps -> rsvpSubmit -> guest RSVP flow | The rsvpSubmit branch decision (top-level vs nested) is the trust boundary that preserves Phase 27 behavior post-migration |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-30-01 | Spoofing | addFamilyToWp CF | mitigate | CF performs `wpDoc.data().hostUid !== request.auth.uid` check before any write (Task 2.1 action; verified at line containing `if (!wpDoc.exists || wpDoc.data().hostUid !== request.auth.uid)` in addFamilyToWp.js) |
| T-30-02 | Tampering | firestore.rules /watchparties/{wpId} | mitigate | Path B denylist includes `families` and `memberUids` so non-host members cannot directly mutate them; only the CF (admin-SDK) can write these fields (Task 2.3 action; rules-test #30-03 + #30-04 enforce — Task 2.4) |
| T-30-03 | Spoofing / Information Disclosure | addFamilyToWp CF | mitigate | CF returns identical `'No family with that code.'` error for: malformed code, nonexistent family, valid family but caller-not-host. Bad actor cannot enumerate which family codes exist (mirrors rsvpSubmit confidentiality pattern at line 95). Also, rules deny direct family-doc reads cross-family — only the CF can confirm existence and it does so behind a uniform error string. |
| T-30-04 | Denial of Service | wp doc size + memberUids fan-out | mitigate | Hard ceiling of 8 families enforced in CF (`currentFamilies.length >= 8` throws resource-exhausted; D-08 cap). With ~10 members typical per family, worst-case `memberUids` = 80 UIDs * 30 bytes = ~2.4 KB; full doc size estimate ~32 KB (RESEARCH Q4) — well under 1 MB Firestore limit. |
| T-30-05 | Denial of Service | rsvpSubmit guest RSVP flow regression | mitigate | rsvpSubmit prepended with top-level lookup (Task 2.2); falls back to legacy scan for pre-Phase-30 wps. Phase 27 guest flow continues to work for ALL wps. Rules-tests Phase 27 block (already passing, untouched) confirms no regression. Smoke contract `smoke-guest-rsvp.cjs` still PASS at 47 assertions post-change (Plan 02 does not modify it). |
</threat_model>

<verification>
1. `node -c` parses cleanly for all 3 modified queuenight CF files
2. `cd tests && npm test` reports 56 passing tests (52 baseline + 4 Phase 30)
3. `firebase functions:list --project queuenight-84044` shows `addFamilyToWp` AND `wpMigrate` post-deploy
4. `firebase firestore:indexes --project queuenight-84044` shows the watchparties memberUids index in state READY
5. Source-tree firestore.rules byte-identical to queuenight/firestore.rules (cross-repo mirror)
6. `npm run smoke:guest-rsvp` exits 0 (no Phase 27 regression from rsvpSubmit edit)
7. `npm run smoke:couch-groups` exits 0 (Plan 01 scaffold still passes; Plan 03 will add production-code sentinels)
</verification>

<success_criteria>
- 2 new CFs (addFamilyToWp + wpMigrate) deployed to queuenight-84044 us-central1
- rsvpSubmit.js Pitfall 5 fix deployed (top-level lookup branch added)
- firestore.rules new top-level /watchparties/{wpId} block in source AND deployed
- COLLECTION_GROUP composite index for watchparties memberUids in BUILT state (Pitfall 7)
- 4 real Phase 30 rules-tests passing (52 to 56)
- GROUP-30-06 + GROUP-30-07 satisfied at the rules-test layer
- GROUP-30-01 + GROUP-30-05 partially satisfied (CF supports them; client wiring lands in Plans 03+04)
- ZERO regressions: `npm run smoke` full aggregate exits 0; `cd tests && npm test` exits 0; sw.js CACHE UNCHANGED
- Plan 03 unblocked (client `collectionGroup` query has a deployed index + rules ready to receive it)
</success_criteria>

<output>
After completion, create `.planning/phases/30-couch-groups-affiliate-hooks/30-02-SUMMARY.md` documenting:
- 2 new CF source files in queuenight repo
- rsvpSubmit.js Pitfall 5 fix
- firestore.rules new top-level /watchparties/{wpId} block (with PRESERVED legacy nested block)
- 4 real Phase 30 rules tests (52 to 56 PASS)
- Cross-repo deploy outcome (indexes + rules + functions; index READY-state confirmation)
- requirements_completed: GROUP-30-06, GROUP-30-07 (rules-test-layer); GROUP-30-01 + GROUP-30-05 partial (CF only; client wiring in Plans 03+04)
- Resume signal: Plan 03 ready to begin
</output>
