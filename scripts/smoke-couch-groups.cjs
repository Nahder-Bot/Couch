'use strict';
// Phase 30 — Couch Groups smoke contract.
// Wave 0 scaffold: harness + path resolution + 4 helper-behavior assertions for
// buildNameCollisionMap (Plan 03 will replace the inline helper duplicate with a
// require() once buildNameCollisionMap is exported as an ESM-compatible standalone
// — for now, we duplicate the helper here for testability per the smoke pattern).
// Production-code sentinels: NONE in Wave 0 — Plans 02/03/04 add them.
// Floor meta-assertion: Wave 0 sets FLOOR=0 (no production code yet); Plan 05 raises it.

const path = require('path');
const fs = require('fs');

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

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

// Suppress unused-import warnings for helpers not yet referenced in this wave.
void eqObj;

console.log('==== Phase 30 Couch Groups — smoke ====');

// === Section 1: buildNameCollisionMap helper-behavior tests (D-09 + Pitfall 6) ===
// Inline duplicate of the helper Plan 03 will add to js/app.js. Mirrors RESEARCH.md
// § "Code Examples / Smoke Contract Sentinel Pattern".
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

console.log('-- 1. buildNameCollisionMap (D-09 cross-family disambiguation) --');
{
  // Cross-family collision: 1 Sam in Family A + 1 Sam in Family B → count = 2
  const wp1 = {
    participants: { m1: { name: 'Sam' } },
    crossFamilyMembers: [{ name: 'Sam', familyCode: 'fam2' }],
  };
  const map1 = buildNameCollisionMap(wp1);
  eq('1.1 cross-family collision: count("sam") === 2', map1['sam'], 2);
  eq('1.2 case-normalized lower: count uses lowercased key', map1['Sam'], undefined);
}
{
  // No collision: distinct names → count = 1 each
  const wp2 = {
    participants: { m1: { name: 'Riley' } },
    crossFamilyMembers: [{ name: 'Sam', familyCode: 'fam2' }],
  };
  const map2 = buildNameCollisionMap(wp2);
  eq('1.3 no collision: count("riley") === 1', map2['riley'], 1);
  eq('1.4 no collision: count("sam") === 1', map2['sam'], 1);
}

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

console.log('=================================================');
console.log(`smoke-couch-groups: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
