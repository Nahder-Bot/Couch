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

// Suppress unused-import warnings for helpers exposed for Plans 02/03/04 sentinel additions.
void eqObj;
void readIfExists;
void eqContains;
void COUCH_ROOT;
void QN_FUNCTIONS;

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

// === Section 2: production-code sentinels — DEFERRED to Plans 02/03/04 ===
console.log('-- 2. production-code sentinels (Wave 0 placeholder — Plans 02/03/04 fill) --');
console.log('  skip 2.0 placeholder (Wave 0 has no production code yet)');

// === Section 3: floor meta-assertion (Plan 05 raises FLOOR; Wave 0 sets 0) ===
console.log('-- 3. production-code sentinel floor meta-assertion --');
{
  const FLOOR = 0; // Plan 05 raises this to 13 (mirrors smoke-guest-rsvp.cjs pattern)
  const helperBehaviorAssertions = 4; // Section 1 above
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
