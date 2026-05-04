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
// 2.7 — Post CR-09 (Phase 30 cross-cutting hotfix): memberUids construction must include
// the host's own uid defensively (Set-dedup) so wp create works even if state.members hasn't
// synced. Verify the new defensive pattern is present.
eqContains('2.7 app.js stamps memberUids on wp create (CR-09 defensive)', appJsSrc, 'Array.from(new Set([');
eqContains('2.7b app.js memberUids includes host uid even pre-state.members-sync (CR-09)', appJsSrc, "(state.members || []).map(m => m && m.uid).filter(Boolean)");
eqContains('2.8 app.js stamps crossFamilyMembers: [] on wp create', appJsSrc, 'crossFamilyMembers: []');

// 2.9 — buildNameCollisionMap + Pitfall 6 disambiguation
eqContains('2.9 app.js declares buildNameCollisionMap', appJsSrc, 'function buildNameCollisionMap(wp)');
eqContains('2.10 app.js Pitfall 6 disambiguation: different familyCode check', appJsSrc, 'different familyCode');
eqContains('2.11 app.js renderParticipantTimerStrip appends crossFamilyChips', appJsSrc, '${chips}${guestChips}${crossFamilyChips}');

// 2.12 — firestore.rules new top-level block
eqContains('2.12 firestore.rules has top-level /watchparties/{wpId} block', rulesSrc, 'match /watchparties/{wpId}');
eqContains('2.13 firestore.rules read gate uses request.auth.uid in resource.data.memberUids', rulesSrc, 'request.auth.uid in resource.data.memberUids');
// 2.14 — Path B converted from denylist → allowlist (Phase 30 cross-cutting hotfix CR-06).
// Verify Path B uses hasOnly([...]) and includes 'reactions' as a canary safe field.
eqContains('2.14 firestore.rules Path B uses hasOnly allowlist (CR-06)', rulesSrc, 'affectedKeys().hasOnly([');
eqContains('2.14b firestore.rules Path B allowlist includes reactions', rulesSrc, "'reactions',");
// 2.14c — CR-05 attribution echo required on every wp update (cross-cutting hotfix).
eqContains('2.14c firestore.rules requires actingUid echo on top-level wp update (CR-05)', rulesSrc, 'request.resource.data.actingUid == request.auth.uid');
eqContains('2.14d firestore.rules requires memberId regex anchor on top-level wp update (CR-05)', rulesSrc, "request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')");

// 2.15 — addFamilyToWp CF host-only + idempotency + hard cap.
// Post-LOW-2 the host check moved inside a runTransaction (variable renamed wpDoc→wpSnap/wpDocPre).
// The check substring is the host-uid equality; tolerate both pre-tx and tx-internal variable names.
eqContains('2.15 addFamilyToWp CF has host-only check', addFamilyToWpSrc, '.data().hostUid !== request.auth.uid');
eqContains('2.16 addFamilyToWp CF has idempotency guard', addFamilyToWpSrc, 'currentFamilies.includes(familyCode)');
eqContains('2.17 addFamilyToWp CF has hard cap of 8 families', addFamilyToWpSrc, 'currentFamilies.length >= 8');
eqContains('2.18 addFamilyToWp CF uses neutral confidentiality error string', addFamilyToWpSrc, "'No family with that code.'");
// 2.18b — HIGH-4 (Phase 30 hotfix): failed-precondition oracle folded into not-found.
// Verify the legacy "no members yet" copy is GONE so cross-family enumeration is consistent.
const hasFailedPreconditionOracle = addFamilyToWpSrc.includes("hasn't added any members yet");
if (hasFailedPreconditionOracle) {
  console.log('  FAIL 2.18b addFamilyToWp still leaks family-existence via failed-precondition copy (HIGH-4)');
  failed++;
} else {
  console.log("  ok 2.18b addFamilyToWp folded failed-precondition into not-found (HIGH-4)");
  passed++;
}
// 2.18c — LOW-2 (Phase 30 hotfix): family-cap check inside runTransaction.
eqContains('2.18c addFamilyToWp wraps cap check in runTransaction (LOW-2)', addFamilyToWpSrc, 'runTransaction');
// 2.18d — CR-02/HIGH-2 (cross-cutting hotfix): wpMigrate gated on admin allowlist.
eqContains('2.18d wpMigrate gated on ADMIN_UIDS allowlist (CR-02)', wpMigrateSrc, 'ADMIN_UIDS');
// 2.18e — MED-2 (Phase 30 hotfix): wpMigrate uses { merge: true } to avoid clobber.
eqContains('2.18e wpMigrate bulkWriter uses merge:true (MED-2)', wpMigrateSrc, 'merge: true');
// 2.18f — HIGH-3 (Phase 30 hotfix): wpMigrate skips zero-member families.
eqContains('2.18f wpMigrate guards against empty memberUids (HIGH-3)', wpMigrateSrc, 'memberUids.length === 0');

// 2.19 — rsvpSubmit Pitfall 5 fix
eqContains('2.19 rsvpSubmit prepended top-level lookup (Pitfall 5)', rsvpSubmitSrc, 'topLevelDoc.exists');
eqContains('2.20 rsvpSubmit preserves legacy nested scan as fallback', rsvpSubmitSrc, 'Fallback: legacy nested scan');

// 2.21 — wpMigrate idempotency
eqContains('2.21 wpMigrate has idempotency guard via existing.data().memberUids check', wpMigrateSrc, 'existing.data().memberUids');

// === Wave 3 — UI affordance + cap copy + remove flow sentinels ===
const appHtmlSrc = readIfExists(path.join(COUCH_ROOT, 'app.html'));
const appCssSrc = readIfExists(path.join(COUCH_ROOT, 'css', 'app.css'));

// 2.22 — DOM hook
eqContains('2.22 app.html has wp-add-family-section DOM hook', appHtmlSrc, 'wp-add-family-section');
eqContains('2.23 app.html section heading copy locked', appHtmlSrc, 'Bring another couch in');
eqContains('2.24 app.html input placeholder copy locked', appHtmlSrc, 'Paste their family code');
eqContains('2.25 app.html submit button copy locked', appHtmlSrc, 'Bring them in');

// 2.26 — JS handlers
eqContains('2.26 app.js declares renderAddFamilySection', appJsSrc, 'function renderAddFamilySection');
eqContains('2.27 app.js declares onClickAddFamily', appJsSrc, 'function onClickAddFamily');
eqContains('2.28 app.js declares onClickRemoveCouch', appJsSrc, 'function onClickRemoveCouch');
eqContains('2.29 app.js wires httpsCallable(functions, addFamilyToWp)', appJsSrc, "httpsCallable(functions, 'addFamilyToWp')");
eqContains('2.30 app.js host-only render gate', appJsSrc, 'state.me.id === wp.hostId');

// 2.31 — Cap copy strings (D-08)
eqContains("2.31 app.js soft-cap copy: That's a big couch — are you sure?", appJsSrc, "That's a big couch");
eqContains('2.32 app.js hard-cap copy: This couch is full for tonight', appJsSrc, 'This couch is full for tonight');

// 2.33 — Error matrix copy
eqContains('2.33 app.js no-family error copy', appJsSrc, 'No family with that code. Double-check the spelling.');
eqContains('2.34 app.js host-only error copy', appJsSrc, 'Only the host can add families');
eqContains('2.35 app.js no-more-room error copy', appJsSrc, 'No more room on this couch tonight.');

// 2.36 — Success + idempotent toasts
eqContains('2.36 app.js success toast: Couch added', appJsSrc, "'Couch added'");
eqContains('2.37 app.js idempotent toast: is already here', appJsSrc, 'is already here');

// 2.38 — CSS new selectors
eqContains('2.38 css/app.css declares .wp-add-family-section', appCssSrc, '.wp-add-family-section');
eqContains('2.39 css/app.css declares .family-suffix', appCssSrc, '.family-suffix');
eqContains('2.40 css/app.css declares mobile breakpoint', appCssSrc, '@media (max-width: 599px)');

// 2.41 — Remove-couch flow
eqContains('2.41 app.js remove-couch confirm modal copy', appJsSrc, 'Their crew will lose access to this watchparty');

// === Wave 3 — B1 fix: soft-cap threshold ===
// Per CONTEXT D-08 + UI-SPEC Copywriting Contract — soft-cap warning triggers at 5+ families (above 4), NOT at 4.
eqContains('2.42 app.js soft-cap threshold is >=5 (B1 fix)', appJsSrc, 'familyCount >= 5');
// Defensive: ensure no leftover >=4 soft-cap branch (the only ceiling check is >=8 hard cap).
eq('2.43 app.js no leftover familyCount >= 4 soft-cap branch (B1 fix)', (appJsSrc.match(/familyCount >= 4/g) || []).length, 0);

// === Wave 3 — B2 fix: wp-edit (lobby) surface delivery ===
// Per Plan 04 objective + UI-SPEC § Component Inventory + ROADMAP skeleton — affordance must live in BOTH wp-create AND wp-edit (lobby).
eqContains('2.44 app.js lobby DOM hook wp-add-family-section-lobby (B2 fix)', appJsSrc, 'wp-add-family-section-lobby');
eqContains('2.45 app.js generalized renderAddFamilySection signature with idSuffix (B2 fix)', appJsSrc, 'function renderAddFamilySection(wp, idSuffix');
eqContains('2.46 app.js lobby call site uses -lobby suffix (B2 fix)', appJsSrc, "renderAddFamilySection(wp, '-lobby')");
// Floor for renderAddFamilySection occurrences: function decl (1) + wp-create call (1) + snapshot call (1) + lobby call (1) >= 4.
eq('2.47 app.js renderAddFamilySection occurrences >= 4 (decl + 3 call sites)', (appJsSrc.match(/renderAddFamilySection/g) || []).length >= 4, true);

// === Wave 3 — W4 fix: zero-member family guard error matrix copy (Plan 02 CF + Plan 04 UI) ===
// addFamilyToWp CF throws failed-precondition for zero-member families; UI surfaces a warm, brand-voice toast.
eqContains('2.48 app.js failed-precondition toast for zero-member family (W4 fix)', appJsSrc, "hasn't added any members yet");

// === Section 3: floor meta-assertion (Plan 05 may raise this further) ===
console.log('-- 3. production-code sentinel floor meta-assertion --');
{
  const FLOOR = 16;
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
