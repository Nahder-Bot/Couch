---
plan: 03
phase: 30
wave: 2
depends_on: [01, 02]
files_modified:
  - js/firebase.js
  - js/app.js
  - scripts/smoke-couch-groups.cjs
requirements: [GROUP-30-01, GROUP-30-02, GROUP-30-03, GROUP-30-04, GROUP-30-08]
autonomous: true
risk: high
status: ready
gap_closure: false
must_haves:
  truths:
    - "js/firebase.js imports + re-exports collectionGroup AND where from the Firebase JS SDK"
    - "js/app.js watchpartyRef(id) returns doc(db, 'watchparties', id) — top-level, NOT families/{code}/watchparties/{id}"
    - "js/app.js subscribeWatchparties uses query(collectionGroup(db, 'watchparties'), where('memberUids', 'array-contains', state.auth.uid))"
    - "js/app.js confirmStartWatchparty wp doc literal includes hostFamilyCode + families: [hostFamilyCode] + memberUids: [hostFamilyMemberUids] + crossFamilyMembers: []"
    - "js/app.js has buildNameCollisionMap(wp) helper that maps lowercased name -> count across participants + crossFamilyMembers"
    - "js/app.js renderParticipantTimerStrip appends crossFamilyChips with render-time (FamilyName) suffix ONLY when collision spans different families (Pitfall 6 same-family suppression)"
    - "All edits preserve back-compat for pre-Phase-30 wps that lack memberUids (existing per-family render path unchanged) — GROUP-30-08 regression-safe"
    - "smoke-couch-groups.cjs FLOOR raised from 0 to >=8 with production-code sentinels for the 4 above behaviors"
  artifacts:
    - path: "js/firebase.js"
      provides: "collectionGroup + where SDK functions imported and re-exported"
      contains: "collectionGroup"
    - path: "js/app.js"
      provides: "Top-level subscription + extended wp doc shape + buildNameCollisionMap + cross-family chip render"
      contains: "buildNameCollisionMap"
    - path: "scripts/smoke-couch-groups.cjs"
      provides: "Production-code sentinels for all 4 client-side Phase 30 behaviors + raised FLOOR"
      contains: "buildNameCollisionMap"
  key_links:
    - from: "js/app.js subscribeWatchparties"
      to: "Firestore /watchparties/{wpId} top-level collection"
      via: "collectionGroup query with where memberUids array-contains uid"
      pattern: "collectionGroup\\(db, 'watchparties'\\)"
    - from: "js/app.js renderParticipantTimerStrip"
      to: "wp.crossFamilyMembers[]"
      via: "appended chips with collision-aware suffix"
      pattern: "crossFamilyChips"
    - from: "js/app.js buildNameCollisionMap"
      to: "wp.participants + wp.crossFamilyMembers"
      via: "two passes building lowercased name-count map"
      pattern: "nameCounts\\["
---

<objective>
Wave 2 client wiring: shift the watchparty subscription from per-family `families/{code}/watchparties` to the top-level `collectionGroup('watchparties')` query gated by `memberUids array-contains` (RESEARCH Pattern 1). Extend the wp doc shape at `confirmStartWatchparty` to stamp `hostFamilyCode` + `families` + `memberUids` + `crossFamilyMembers`. Add the `buildNameCollisionMap` helper (D-09 + Pitfall 6). Extend `renderParticipantTimerStrip` with cross-family member chips that get the render-time `(FamilyName)` suffix ONLY when collisions span DIFFERENT families.

This is the highest-risk plan in Phase 30 because it modifies the watchparty subscription path that ALL Phase 7/24/26/27 features depend on. Smoke regressions in any of those phases would surface here.

Purpose: Make Family B members see Family A's wp in their Tonight tab when added by host (closes the GROUP-30-02 silent-failure mode); make cross-family rosters render with full identity per D-06 (GROUP-30-03); guard the collision-suffix from the within-family false-positive (GROUP-30-04 + Pitfall 6); and keep pre-Phase-30 wps rendering correctly via back-compat (GROUP-30-08).

Output: 3 modified files in couch repo. No deploy in this plan — Plan 04 ships the UI affordance and Plan 05 deploys the bundle.

CRITICAL DEPENDENCY: This plan is BLOCKED on Plan 02 Task 2.5 confirming the composite index is in BUILT/READY state. If the executor finds the index still CREATING per `firebase firestore:indexes`, STOP and surface to the user rather than ship client code that will silently fail.
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
@.planning/phases/30-couch-groups-affiliate-hooks/30-02-cf-rules-rsvpsubmit-fix-deploy-PLAN.md
@CLAUDE.md
@js/firebase.js
@js/state.js

NOTE: js/app.js is ~16K lines. NEVER read in full. Use Grep first to locate each modification point, then Read with offset+limit. The exact target line numbers are in PATTERNS.md (which the executor should read before each js/app.js edit).
</context>

<tasks>

<task type="auto">
  <name>Task 3.1: Add collectionGroup + where to js/firebase.js imports + re-exports</name>
  <files>js/firebase.js</files>
  <read_first>
    - js/firebase.js (full file — only ~31 lines; see line 2 import + line 27 re-export)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "js/firebase.js" — exact additive change pattern)
  </read_first>
  <action>
Two edits to `js/firebase.js`:

(a) Line 2 currently reads:
```
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```
Replace with (added `collectionGroup, where` at the end of the imports list):
```
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch, collectionGroup, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

(b) Line 27 currently reads:
```
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch };
```
Replace with (added `collectionGroup, where` at the end of the export list):
```
export { doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField, writeBatch, collectionGroup, where };
```

Do NOT modify any other line in this file.

The CDN URL `https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js` is unchanged. `collectionGroup` and `where` are standard Firestore functions at SDK 10.12.0 (verified per RESEARCH.md Standard Stack table).
  </action>
  <verify>
    <automated>grep -q "import.*collectionGroup.*where.*firebase-firestore" js/firebase.js &amp;&amp; grep -q "^export.*collectionGroup.*where.*}.;" js/firebase.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "collectionGroup" js/firebase.js` returns 2 (one in import, one in export)
    - `grep -c "where" js/firebase.js` returns 2 (one in import, one in export — note: must NOT match `where` substrings in random comments; the grep should be on lines containing both `collectionGroup` and `where`)
    - The CDN URL is UNCHANGED — `grep -q "firebasejs/10.12.0/firebase-firestore.js" js/firebase.js` returns 0
    - Auth/Functions/Storage import/export blocks at lines 3-4 + 9 + 28-30 UNCHANGED
    - File parses cleanly — verify by running `npm run smoke:app-parse` (which validates ES module parse integrity of all modified JS files); exits 0
  </acceptance_criteria>
  <done>
    js/firebase.js exports collectionGroup + where, ready for import in js/app.js Task 3.3. No regressions to other Firestore functions. File still parses as a valid ES module.
  </done>
</task>

<task type="auto">
  <name>Task 3.2: Replace watchpartiesRef + watchpartyRef with top-level helpers in js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js (Grep first for `function watchpartiesRef` to confirm line 1935; Read offset=1925 limit=20 to see both helpers + surrounding context)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "js/app.js" Modification point 1 — exact replacement pattern)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Anti-Patterns to Avoid" — explains WHY watchpartiesRef goes away in favor of inline collectionGroup query)
  </read_first>
  <action>
Locate js/app.js lines 1935-1936. They currently read:
```
function watchpartiesRef() { return collection(db, 'families', state.familyCode, 'watchparties'); }
function watchpartyRef(id) { return doc(db, 'families', state.familyCode, 'watchparties', id); }
```

Replace both lines with:
```
// Phase 30 — watchparties migrated from families/{code}/watchparties to top-level
// /watchparties/{wpId}. watchpartyRef now points at top-level for single-doc writes.
// watchpartiesRef helper is REMOVED — the subscription uses inline collectionGroup query
// (see subscribeWatchparties at the original onSnapshot site for the new query shape).
function watchpartyRef(id) { return doc(db, 'watchparties', id); }
```

Critical:
- All ~14 call sites of `watchpartyRef(id)` (Grep `watchpartyRef\\(` returns ~14 matches per the codebase scan) AUTOMATICALLY get retargeted because they all call through this single helper. No need to edit each call site individually.
- The `watchpartiesRef()` function is REMOVED. The single call site at line 4889 (Grep `watchpartiesRef\\(\\)` returns 1 match) will be replaced in Task 3.3 with an inline collectionGroup query. Removing the function but not yet replacing the call site is INTENTIONAL — Task 3.3 closes the gap. Smoke-app-parse will fail between these two tasks if executed mid-flight; complete Task 3.3 in the same commit batch as Task 3.2.
  </action>
  <verify>
    <automated>grep -c "function watchpartiesRef" js/app.js &amp;&amp; grep -q "function watchpartyRef.id. { return doc.db, 'watchparties', id" js/app.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "function watchpartiesRef" js/app.js` returns 0 (helper REMOVED)
    - `grep -q "function watchpartyRef(id) { return doc(db, 'watchparties', id); }" js/app.js` returns 0 (top-level retarget present)
    - `grep -c "watchpartyRef(" js/app.js` returns at least 14 (all existing call sites preserved; they automatically retarget through the single helper)
    - `grep -q "collection(db, 'families', state.familyCode, 'watchparties')" js/app.js` returns 1 (NOT 0 — the legacy nested-collection helper string is GONE; if any other call site still uses this string literal, it must be migrated separately)
    - `grep -q "Phase 30 — watchparties migrated" js/app.js` returns 0 (rationale comment present)
  </acceptance_criteria>
  <done>
    watchpartyRef now points at top-level /watchparties/{id}. ~14 existing call sites (writes, gets, updates, deletes) automatically retarget. watchpartiesRef function removed; Task 3.3 will replace its only call site with an inline collectionGroup query.
  </done>
</task>

<task type="auto">
  <name>Task 3.3: Rewrite watchparty subscription to collectionGroup + where memberUids array-contains uid</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js (Grep first for `state.unsubWatchparties = onSnapshot.watchpartiesRef` to confirm line 4889; Read offset=4880 limit=40 to see the full subscription block + surrounding teardown code)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "js/app.js" Modification point 1 — exact replacement subscription block)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (sections "Pattern 1" + "Common Pitfalls" Pitfall 1 (silent failure mode) + Pitfall 2 (rules-vs-query alignment))
  </read_first>
  <action>
Locate the subscription block at js/app.js line 4889. It currently looks like:
```
state.unsubWatchparties = onSnapshot(watchpartiesRef(), s => {
  state.watchparties = s.docs.map(d => d.data());
  // Auto-archive any that have passed the 25h window...
  ...
}, e => {});
```

Replace the FIRST argument of `onSnapshot` (the `watchpartiesRef()` call) with the new `collectionGroup` query. Specifically:

(a) Add a guard at the top of the subscription block: `if (!state.auth || !state.auth.uid) { qnLog('[watchparties] no auth.uid, skipping subscription'); return; }`

(b) Replace `watchpartiesRef()` (the first arg of onSnapshot) with `query(collectionGroup(db, 'watchparties'), where('memberUids', 'array-contains', state.auth.uid))`.

(c) Improve the error handler: change `e => {}` to `e => { qnLog('[watchparties] snapshot error', e && e.message); }` so silent failures (Pitfall 1) at least log to console.

The full replacement subscription block (only the structural lines around the snapshot — preserve ALL the existing s.docs / auto-archive / maybeFlipScheduledParties / maybeNotifyWatchparties / renderWatchpartyBanner / activeWatchpartyId logic VERBATIM):

```
// Phase 30 — collectionGroup query replaces families/{code}/watchparties subscription.
// where('memberUids', 'array-contains', uid) MUST be present or rules reject the query
// per RESEARCH Pitfall 2 (rules-vs-query alignment requirement).
if (!state.auth || !state.auth.uid) {
  qnLog('[watchparties] no auth.uid yet — subscription deferred');
  return;
}
state.unsubWatchparties = onSnapshot(
  query(
    collectionGroup(db, 'watchparties'),
    where('memberUids', 'array-contains', state.auth.uid)
  ),
  s => {
    state.watchparties = s.docs.map(d => d.data());
    // ... all the existing auto-archive + flip-scheduled + notify + render logic UNCHANGED ...
  },
  e => { qnLog('[watchparties] snapshot error', e && e.message); }
);
```

The executor must preserve the EXACT existing logic inside the success callback — only replace the subscription source and add the auth guard + improved error handler. If qnLog is not defined in scope (Grep `function qnLog` to verify), substitute `console.warn` instead.

Verify imports: `collectionGroup` and `where` and `query` must all be imported in js/app.js. `query` is already imported (Grep `import.*query` confirms). `collectionGroup` and `where` need to be added to the existing `import { ... } from './firebase.js'` line. Use Grep to find the existing firebase.js import line at the top of js/app.js (likely near line 1-30), and append `, collectionGroup, where` to its destructured list.
  </action>
  <verify>
    <automated>grep -q "collectionGroup(db, 'watchparties')" js/app.js &amp;&amp; grep -q "where('memberUids', 'array-contains', state.auth.uid)" js/app.js &amp;&amp; grep -q "import.*collectionGroup.*from.*firebase" js/app.js &amp;&amp; npm run smoke:app-parse</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "collectionGroup(db, 'watchparties')" js/app.js` returns 0
    - `grep -q "where('memberUids', 'array-contains', state.auth.uid)" js/app.js` returns 0 (the alignment-with-rules filter required by Pitfall 2)
    - `grep -q "watchpartiesRef()" js/app.js` returns 1 (NOT 0 — the legacy call site is REPLACED; no other call sites should remain)
    - The js/app.js firebase.js import line includes `collectionGroup` and `where` — `grep -q "from.*firebase\\.js" js/app.js` finds the import line; `grep -E "import.*\\{[^}]*collectionGroup[^}]*\\}.*firebase" js/app.js` matches
    - `npm run smoke:app-parse` exits 0 (ES module still parses; `collectionGroup` resolves)
    - All the existing inner logic (Auto-archive comment, maybeFlipScheduledParties, maybeNotifyWatchparties, renderWatchpartyBanner, state.activeWatchpartyId branch) is PRESERVED — `grep -c "maybeFlipScheduledParties" js/app.js` returns AT LEAST 1, same as pre-edit count
    - `grep -q "no auth.uid" js/app.js` returns 0 (auth guard present)
    - `grep -q "snapshot error" js/app.js` returns 0 (improved error handler logs)
  </acceptance_criteria>
  <done>
    Watchparty subscription now uses collectionGroup + where memberUids array-contains uid; aligns with rules per Pitfall 2; logs snapshot errors instead of swallowing (Pitfall 1 mitigation); guards on missing auth. GROUP-30-02 satisfied at code level (Family B sees Family A wp once memberUids is fanned by addFamilyToWp CF).
  </done>
</task>

<task type="auto">
  <name>Task 3.4: Extend confirmStartWatchparty wp doc literal with Phase 30 fields (hostFamilyCode + families + memberUids + crossFamilyMembers)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js (Grep first for `function confirmStartWatchparty` to confirm line ~11141; Read offset=11135 limit=60 to see the full wp object literal + the `await setDoc(watchpartyRef(id), ...)` call at the end)
    - js/state.js (full file — verify state.familyCode + state.members access patterns)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "js/app.js" Modification point 2 — exact extension pattern)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Code Examples / WP Doc Shape" — the canonical post-Phase-30 wp shape)
  </read_first>
  <action>
Locate `confirmStartWatchparty` at js/app.js (~line 11141). The function constructs a `const wp = { ... }` object literal with fields: id, titleId, titleName, titlePoster, hostId, hostName, hostUid, creatorTimeZone, startAt, createdAt, lastActivityAt, status, participants, reactions, videoUrl, videoSource (per PATTERNS.md the literal spans lines 11161-11187).

Add 4 new fields to the wp literal AFTER the `videoSource` field (or wherever the literal currently ends — verify by reading the actual current state). Use these EXACT field names + values:

```
  // === Phase 30 — Couch groups fields ===
  hostFamilyCode: state.familyCode,
  families: [state.familyCode],
  memberUids: (state.members || []).map(m => m && m.uid).filter(Boolean),
  crossFamilyMembers: [],
```

Critical correctness requirements:
- `hostFamilyCode` MUST be `state.familyCode` (a string) — used by rsvpSubmit's Pitfall 5 fix branch to derive familyCode from top-level docs.
- `families` MUST start with the host's own family code as a single-element array. The addFamilyToWp CF (Plan 02) appends to this via `arrayUnion` when host invites another family.
- `memberUids` MUST stamp the host family's current member UIDs at create time. Without this stamp, the host themselves cannot read their own wp (rules require `request.auth.uid in resource.data.memberUids`). The filter `.filter(Boolean)` strips members without a uid (claimed-but-not-signed-in members).
- `crossFamilyMembers` is an empty array at create time. The addFamilyToWp CF appends rows when host invites another family.

The `await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() })` call at line 11189 needs NO change — `watchpartyRef(id)` automatically points at top-level after Task 3.2.

Cross-check: GREP `js/app.js` for OTHER `await setDoc(watchpartyRef` call sites (lines 10514, 10708 also write wp docs per the watchpartyRef call list above). Each one needs to ALSO include the 4 Phase 30 fields if it constructs a NEW wp doc. Read each context (offset=N-10 limit=40) to determine: if the call writes a NEW wp doc (not just updates an existing one), it MUST include the 4 fields. If it updates an existing wp doc with `setDoc(... , {merge: true})` semantics, the extension may not be needed.

Specifically check:
- Line 10514: Read offset=10500 limit=40. If it constructs a wp from scratch, extend the same way.
- Line 10708: Read offset=10694 limit=40. Same check.
- Line 11189: confirmStartWatchparty (this task's primary target).

For line 10514 / 10708 if they also construct new wps from scratch, extend with the same 4 fields per Phase 30 doc-shape contract. If they only update an existing wp, no change needed.
  </action>
  <verify>
    <automated>grep -c "hostFamilyCode: state.familyCode" js/app.js &amp;&amp; grep -q "memberUids: .state.members" js/app.js &amp;&amp; grep -q "crossFamilyMembers: \\[\\]" js/app.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "hostFamilyCode: state.familyCode" js/app.js` returns AT LEAST 1 (confirmStartWatchparty extended) — may be 2 or 3 if 10514/10708 also construct new wps
    - `grep -q "families: \\[state.familyCode\\]" js/app.js` returns 0
    - `grep -q "memberUids:" js/app.js` returns 0
    - `grep -q "crossFamilyMembers: \\[\\]" js/app.js` returns 0
    - The host can self-read their own wp post-Phase-30: `state.auth.uid` is a member of `state.members.map(m=>m.uid)`, so memberUids includes their UID, so the rules predicate `request.auth.uid in resource.data.memberUids` is true.
    - `npm run smoke:app-parse` exits 0
    - Phase 30 marker comment present: `grep -q "Phase 30 — Couch groups fields" js/app.js` returns 0
  </acceptance_criteria>
  <done>
    All wp creation paths (confirmStartWatchparty + any other discovered new-wp constructors) stamp hostFamilyCode + families + memberUids + crossFamilyMembers. Host can self-read own wp. addFamilyToWp CF (Plan 02) can fan-out to expand memberUids when host invites cross-family. GROUP-30-01 satisfied at code level for the wp-create path; UI affordance lands in Plan 04.
  </done>
</task>

<task type="auto">
  <name>Task 3.5: Add buildNameCollisionMap helper + extend renderParticipantTimerStrip with cross-family chips (Pitfall 6 same-family suppression)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js (Grep first for `function getFamilyMemberNamesSet` to confirm line 12272; Read offset=12270 limit=10 to see it; Grep for `function renderParticipantTimerStrip` to confirm line 12296; Read offset=12290 limit=80 to see the full function including the Phase 27 guest-chip block at lines 12345-12367)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "js/app.js" Modification points 3 + 4 — buildNameCollisionMap insertion point + renderParticipantTimerStrip extension pattern)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (section "Pattern 3: Render-Time Collision Detection" + Pitfall 6 — same-family suppression rule)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (sections "Color" + "Roster collision suffix" + "Component Inventory" — visual contract for cross-family chips)
  </read_first>
  <action>
Two sub-edits to js/app.js:

(a) INSERT buildNameCollisionMap helper. Locate `function getFamilyMemberNamesSet()` at line 12272. Insert the new helper IMMEDIATELY AFTER that function (before line 12276 `function displayGuestName`):

```
// Phase 30 — D-09 render-time collision detection across families.
// Returns { lowercased-name: count } for collision detection.
// CRITICAL Pitfall 6: only cross-family collisions trigger the (FamilyName) suffix.
// Within-family same-name collisions (rare but possible) must NOT trigger the suffix.
// The Pitfall 6 logic lives in the chip-render branch in renderParticipantTimerStrip
// (which checks crossFamilyMembers[i].familyCode against the host family); this helper
// only counts; the differentiation logic is the consumer's responsibility.
function buildNameCollisionMap(wp) {
  const nameCounts = {};
  Object.values(wp.participants || {}).forEach(p => {
    const n = (p.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  (wp.crossFamilyMembers || []).forEach(m => {
    const n = (m.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  return nameCounts;
}
```

(b) EXTEND renderParticipantTimerStrip with cross-family chips. Locate the function at line 12296. The current return statement at line 12367 is:
```
return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}</div>`;
```

INSERT a new block immediately BEFORE the return statement (after the existing `guestChips = visibleGuests.map(...).join('')` block ends around line 12366). The block builds `crossFamilyChips` and the return statement gets updated to include it:

```
// === Phase 30 — append cross-family member chips ===
// Pitfall 6 critical: collision suffix fires ONLY when the same name appears in TWO
// DIFFERENT families. Same name within one family must NOT trigger the suffix.
const collisionMap = buildNameCollisionMap(wp);
const crossFamilyChips = (Array.isArray(wp.crossFamilyMembers) ? wp.crossFamilyMembers : []).map(m => {
  const rawName = (m.name || 'Member').toString();
  const norm = rawName.trim().toLowerCase();
  // Pitfall 6: collision must span DIFFERENT families. Check that the name appears
  // both in this family AND somewhere else (participants OR a different crossFamily entry).
  // Implementation: if collisionMap shows count > 1 AND there's at least one entry in
  // wp.participants with the same name OR a crossFamilyMember from a DIFFERENT familyCode
  // with the same name, suffix fires.
  let hasCrossFamilyCollision = false;
  if ((collisionMap[norm] || 0) > 1) {
    // Check participants (always considered "host family" / current viewer's family)
    const inParticipants = Object.values(wp.participants || {}).some(p => (p.name || '').trim().toLowerCase() === norm);
    if (inParticipants) {
      hasCrossFamilyCollision = true;
    } else {
      // No participant collision — check for collision with a crossFamilyMember from a DIFFERENT familyCode
      const otherFamilyMatches = (wp.crossFamilyMembers || []).filter(other =>
        other.familyCode !== m.familyCode && (other.name || '').trim().toLowerCase() === norm
      );
      if (otherFamilyMatches.length > 0) hasCrossFamilyCollision = true;
    }
  }
  const familyDisplayName = m.familyDisplayName || m.familyCode || '';
  const displayName = hasCrossFamilyCollision
    ? `${escapeHtml(rawName)} <span class="family-suffix">(${escapeHtml(familyDisplayName)})</span>`
    : escapeHtml(rawName);
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

Then change the return statement from:
```
return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}</div>`;
```
to:
```
return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}${guestChips}${crossFamilyChips}</div>`;
```

Critical:
- The .family-suffix span class is NEW — Plan 04 adds the CSS rule for italic Instrument Serif at --ink-dim.
- `escapeHtml` is already a defined utility (Phase 27 uses it; verify with Grep). All user-derived strings (rawName, familyDisplayName, color, initial) MUST be escaped.
- `data-member-id` enables Plan 04's host-only kebab "Remove this couch" handler to identify which family-row to remove.
- `wp.crossFamilyMembers` is empty for ALL pre-Phase-30 wps (the field doesn't exist on those docs) — `Array.isArray(...) ? ... : []` short-circuits cleanly to `crossFamilyChips = ''`. GROUP-30-08 (regression-safe) satisfied.

Pitfall 6 nuance — re-read the inline logic carefully. The simple rule "count > 1 means collision" is INSUFFICIENT because two members named Sam in the SAME family would also produce count = 2 and falsely trigger the suffix. The implementation above splits collision detection into two branches: (a) cross-family member's name matches a participant (host family) → real cross-family collision, suffix fires; (b) cross-family member's name matches another crossFamilyMember from a DIFFERENT familyCode → real cross-family collision, suffix fires. Within-family same-name (e.g. host family has 2 Sams in participants) is silent here because we never check or render suffix on participants chips (only on crossFamily chips). This satisfies Pitfall 6 + D-09.
  </action>
  <verify>
    <automated>grep -q "function buildNameCollisionMap" js/app.js &amp;&amp; grep -q "crossFamilyChips" js/app.js &amp;&amp; grep -q "wp-participant-chip cross-family" js/app.js &amp;&amp; grep -q "Pitfall 6 critical" js/app.js &amp;&amp; npm run smoke:app-parse</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "function buildNameCollisionMap" js/app.js` returns 0
    - `grep -c "crossFamilyChips" js/app.js` returns AT LEAST 2 (one declaration + one in return statement)
    - `grep -q "wp-participant-chip cross-family" js/app.js` returns 0 (chip CSS class present)
    - `grep -q "data-member-id" js/app.js` returns 0 (handler hook present)
    - `grep -q "family-suffix" js/app.js` returns 0 (collision span class present)
    - `grep -q "Pitfall 6 critical" js/app.js` returns 0 (rationale comment present)
    - `grep -q "different familyCode" js/app.js` returns 0 (Pitfall 6 disambiguation logic present)
    - The return statement now includes ${crossFamilyChips}: `grep -q "wp-participants-strip.*role=.listitem.*Watchparty participants...chips...guestChips...crossFamilyChips" js/app.js` returns 0 (or simpler `grep -q '${chips}${guestChips}${crossFamilyChips}' js/app.js`)
    - `npm run smoke:app-parse` exits 0
    - All escapeHtml calls present — `grep -c "escapeHtml(rawName)\\|escapeHtml(familyDisplayName)\\|escapeHtml(color)\\|escapeHtml(initial)\\|escapeHtml(m.memberId" js/app.js` returns AT LEAST 4 in the new block alone
  </acceptance_criteria>
  <done>
    buildNameCollisionMap helper added; renderParticipantTimerStrip extends with cross-family chips that get the (FamilyName) suffix only on real cross-family collisions per D-09 + Pitfall 6 (same-family same-name does NOT trigger suffix). All user-derived strings escaped per CLAUDE.md security posture. GROUP-30-03 + GROUP-30-04 satisfied at code level.
  </done>
</task>

<task type="auto">
  <name>Task 3.6: Replace smoke-couch-groups.cjs PRODUCTION-CODE SENTINELS section + raise FLOOR</name>
  <files>scripts/smoke-couch-groups.cjs</files>
  <read_first>
    - scripts/smoke-couch-groups.cjs (full file — Plan 01 Task 1.4 created this scaffold; the production-code sentinels section is currently a "Wave 0 placeholder")
    - scripts/smoke-guest-rsvp.cjs (read lines 143-200 — see how Phase 27 sentinels point at js/app.js + cross-repo CF files via readIfExists + eqContains)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (section "scripts/smoke-couch-groups.cjs" — production-code sentinel target list)
  </read_first>
  <action>
Edit `scripts/smoke-couch-groups.cjs`. Replace the placeholder section 2 (currently logs `skip 2.0 placeholder`) with REAL production-code sentinels. Also raise the FLOOR from 0 to 8.

Replace the section 2 + section 3 of the smoke script with:

```
// === Section 2: production-code sentinels (Wave 2 — js/app.js + js/firebase.js + queuenight CFs) ===
console.log('-- 2. production-code sentinels (Wave 2 client + Wave 1 CFs) --');

const appJsSrc = readIfExists(path.join(COUCH_ROOT, 'js', 'app.js'));
const firebaseJsSrc = readIfExists(path.join(COUCH_ROOT, 'js', 'firebase.js'));
const rulesSrc = readIfExists(path.join(COUCH_ROOT, 'firestore.rules'));
const addFamilyToWpSrc = readIfExists(path.join(QN_FUNCTIONS, 'src', 'addFamilyToWp.js'));
const wpMigrateSrc = readIfExists(path.join(QN_FUNCTIONS, 'src', 'wpMigrate.js'));
const rsvpSubmitSrc = readIfExists(path.join(QN_FUNCTIONS, 'src', 'rsvpSubmit.js'));

// 2.1 — js/firebase.js exports collectionGroup + where
eqContains('2.1 firebase.js imports collectionGroup', firebaseJsSrc, 'collectionGroup');
eqContains('2.2 firebase.js imports where', firebaseJsSrc, 'where');

// 2.3 — js/app.js subscribes via collectionGroup with the Pitfall 2-aligned filter
eqContains('2.3 app.js uses collectionGroup(db, watchparties) subscription', appJsSrc, "collectionGroup(db, 'watchparties')");
eqContains('2.4 app.js uses where(memberUids, array-contains, state.auth.uid)', appJsSrc, "where('memberUids', 'array-contains', state.auth.uid)");

// 2.5 — js/app.js watchpartyRef retargets to top-level
eqContains('2.5 app.js watchpartyRef points at top-level /watchparties/', appJsSrc, "function watchpartyRef(id) { return doc(db, 'watchparties', id); }");

// 2.6 — confirmStartWatchparty stamps Phase 30 fields
eqContains('2.6 app.js confirmStartWatchparty stamps hostFamilyCode', appJsSrc, 'hostFamilyCode: state.familyCode');
eqContains('2.7 app.js stamps memberUids on wp create', appJsSrc, "memberUids: (state.members || []).map(m => m && m.uid).filter(Boolean)");
eqContains('2.8 app.js stamps crossFamilyMembers: [] on wp create', appJsSrc, 'crossFamilyMembers: []');

// 2.9 — buildNameCollisionMap + Pitfall 6 disambiguation
eqContains('2.9 app.js declares buildNameCollisionMap', appJsSrc, 'function buildNameCollisionMap(wp)');
eqContains('2.10 app.js Pitfall 6 disambiguation: different familyCode check', appJsSrc, 'different familyCode');
eqContains('2.11 app.js renderParticipantTimerStrip appends crossFamilyChips', appJsSrc, '${chips}${guestChips}${crossFamilyChips}');

// 2.12 — firestore.rules new top-level block
eqContains('2.12 firestore.rules has top-level /watchparties/{wpId} block', rulesSrc, 'match /watchparties/{wpId}');
eqContains('2.13 firestore.rules read gate uses request.auth.uid in resource.data.memberUids', rulesSrc, 'request.auth.uid in resource.data.memberUids');
eqContains('2.14 firestore.rules Path B denylist includes families and memberUids', rulesSrc, "'families', 'memberUids'");

// 2.15 — addFamilyToWp CF host-only + idempotency + hard cap
eqContains('2.15 addFamilyToWp CF has host-only check', addFamilyToWpSrc, 'wpDoc.data().hostUid !== request.auth.uid');
eqContains('2.16 addFamilyToWp CF has idempotency guard', addFamilyToWpSrc, 'currentFamilies.includes(familyCode)');
eqContains('2.17 addFamilyToWp CF has hard cap of 8 families', addFamilyToWpSrc, 'currentFamilies.length >= 8');
eqContains('2.18 addFamilyToWp CF uses neutral confidentiality error string', addFamilyToWpSrc, "'No family with that code.'");

// 2.19 — rsvpSubmit Pitfall 5 fix
eqContains('2.19 rsvpSubmit prepended top-level lookup (Pitfall 5)', rsvpSubmitSrc, 'topLevelDoc.exists');
eqContains('2.20 rsvpSubmit preserves legacy nested scan as fallback', rsvpSubmitSrc, 'Fallback: legacy nested scan');

// 2.21 — wpMigrate idempotency
eqContains('2.21 wpMigrate has idempotency guard via existing.data().memberUids check', wpMigrateSrc, 'existing.data().memberUids');

// === Section 3: floor meta-assertion (Plan 05 may raise this further) ===
console.log('-- 3. production-code sentinel floor meta-assertion --');
{
  const FLOOR = 8;
  // Helper-behavior assertions in Section 1 (above) = 4
  const helperBehaviorAssertions = 4;
  const productionCodeAssertions = passed - helperBehaviorAssertions;
  if (productionCodeAssertions >= FLOOR) {
    console.log(`  ok 3.1 production-code sentinel floor met (${productionCodeAssertions} >= ${FLOOR})`);
    passed++;
  } else {
    console.error(`  FAIL 3.1 production-code sentinel floor NOT met (${productionCodeAssertions} < ${FLOOR})`);
    failed++;
  }
}
```

The number of production-code sentinels above is 21 (2.1 through 2.21). Floor 8 is conservative — Plan 05 may raise to 13 to match the Phase 27 smoke pattern.

If any sentinel needle string differs slightly from what the executor actually wrote in Tasks 3.1-3.5 (e.g. variable naming drift), the executor must adjust the needle to match the actual production code, NOT the other way around. The needle is the assertion; the production code is the truth.
  </action>
  <verify>
    <automated>npm run smoke:couch-groups</automated>
  </verify>
  <acceptance_criteria>
    - `npm run smoke:couch-groups` exits 0
    - Smoke output reports AT LEAST 25 passing assertions (4 helper-behavior + 21 production-code + 1 floor meta = 26 minimum if everything green)
    - The floor meta-assertion line `production-code sentinel floor met (21 >= 8)` (or equivalent depending on actual count) appears in output
    - `npm run smoke` (full aggregate) exits 0 — no other smoke contracts regressed
    - `cd tests && npm test` still exits 0 (Plan 02 left 56 rules tests passing; Plan 03 doesn't touch tests)
    - The smoke output for Section 2 has ZERO `skip` lines (all source files exist post-Plans 01-03)
  </acceptance_criteria>
  <done>
    smoke-couch-groups.cjs grew from 5 assertions (Wave 0 scaffold) to 26+ assertions (4 helper + 21 production-code + 1 floor). All Phase 30 client + CF + rules surfaces are covered at the smoke layer. GROUP-30-01 through GROUP-30-04 + GROUP-30-08 + (echo of GROUP-30-06/07) all codified. Plan 05's deploy gate has its smoke contract ready.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted snapshot data -> client render | wp.crossFamilyMembers comes from CF-stamped data (admin-SDK trust); but render still escapeHtml all user-derived strings (defense-in-depth XSS guard) |
| Subscription query -> Firestore rules predicate | Client query MUST include `where memberUids array-contains uid` to align with rules per Pitfall 2; otherwise Firestore rejects entire query |
| Pre-Phase-30 wps without memberUids -> client subscription | New collectionGroup query EXCLUDES old nested wps (they live at families/{code}/watchparties); GROUP-30-08 backward-compat handled via wpMigrate CF (Plan 02) which copies them to top-level with memberUids stamped |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-30-06 | Information Disclosure | Cross-family member render | mitigate | All user-derived strings (rawName, familyDisplayName, color, initial, memberId) wrapped in `escapeHtml()` per CLAUDE.md security posture and Phase 27 chip-render precedent at js/app.js:12361 |
| T-30-07 | Spoofing | wp.crossFamilyMembers row attribution | mitigate | crossFamilyMembers is in Path B denylist (Plan 02 firestore.rules) — non-host clients cannot directly mutate it; only addFamilyToWp CF (admin-SDK) writes the field |
| T-30-08 | Denial of Service | collectionGroup query missing index | mitigate | Plan 02 Task 2.5 [BLOCKING gate] confirms the composite index is in BUILT/READY state before Plan 03 ships. If the executor finds the index still CREATING when running Plan 03, STOP and surface to user. |
| T-30-09 | Tampering | False-positive collision suffix on within-family same-name | mitigate | Pitfall 6 disambiguation: collision suffix only fires when name matches across DIFFERENT families. Within-family same-name (rare) leaves the chip un-suffixed. Smoke 2.10 sentinel asserts this branch is present. |
</threat_model>

<verification>
1. `npm run smoke:app-parse` exits 0 after every js/app.js + js/firebase.js edit (ES module parse integrity)
2. `npm run smoke:couch-groups` exits 0 with at least 26 passing assertions
3. `npm run smoke` (full 12-contract aggregate) exits 0 — Phase 27 smoke (smoke-guest-rsvp.cjs) MUST stay at 47 passed (Pitfall 5 fix in Plan 02 + the rsvpSubmit consumer pathway both unchanged at the smoke level)
4. `cd tests && npm test` still exits 0 (rules tests still 56 PASS from Plan 02)
5. Manual sanity: open js/app.js to the new buildNameCollisionMap function and visually confirm the Pitfall 6 disambiguation branch is intact (the 2.10 smoke sentinel only checks the substring "different familyCode" — visual review confirms the LOGIC matches the substring)
</verification>

<success_criteria>
- js/firebase.js imports + re-exports collectionGroup + where
- js/app.js watchpartyRef retargets to top-level /watchparties/{id}
- js/app.js subscribes via collectionGroup + where memberUids array-contains uid (Pitfall 2 alignment)
- js/app.js confirmStartWatchparty stamps hostFamilyCode + families + memberUids + crossFamilyMembers
- js/app.js has buildNameCollisionMap helper
- js/app.js renderParticipantTimerStrip appends cross-family chips with Pitfall 6-correct collision-suffix logic
- scripts/smoke-couch-groups.cjs has 21 production-code sentinels + FLOOR=8 meta-assertion
- GROUP-30-01 + GROUP-30-02 + GROUP-30-03 + GROUP-30-04 + GROUP-30-08 all closed at code level
- ZERO regressions: full smoke aggregate green; rules tests still 56 PASS
- Plan 04 unblocked (the wp doc has the right shape and the renderer handles the new fields; Plan 04 only adds the host-side UI affordance to invoke addFamilyToWp)
</success_criteria>

<output>
After completion, create `.planning/phases/30-couch-groups-affiliate-hooks/30-03-SUMMARY.md` documenting:
- 3 modified files in couch repo
- watchparty subscription migrated to collectionGroup + memberUids array-contains gate
- wp doc shape extended with 4 Phase 30 fields
- buildNameCollisionMap + Pitfall 6 same-family suppression
- crossFamilyChips render with collision-aware suffix
- smoke-couch-groups.cjs at 26+ passing (4 helper + 21 production + 1 floor)
- requirements_completed: GROUP-30-01 (wp create path; UI in Plan 04), GROUP-30-02, GROUP-30-03, GROUP-30-04, GROUP-30-08
- Resume signal: Plan 04 ready to begin (UI affordance only)
</output>
