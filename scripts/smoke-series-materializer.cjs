'use strict';

// === Phase 16 / CAL-16-03 — smoke contract for watchpartySeriesTick CF ===
// Production-code sentinel contract — verifies the CF file exists with the
// required structure, schedule, query shape, and back-references.
// Pattern lifted from scripts/smoke-pickem.cjs Group 6 (lines 235-249).
//
// Path resolution: couch is at `~/claude-projects/couch/`, queuenight is at `~/queuenight/`.
// Both are children of `~` (NOT siblings of each other's parents).
// Path math: 3x `..` walks from couch/scripts/X.cjs → couch → claude-projects → home (`~`),
// then into queuenight/functions/. Verified at planning time.

const fs = require('fs');
const path = require('path');

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

let passed = 0;
let failed = 0;

function eqContains(label, fileContent, needle) {
  if (fileContent === null) { console.log(`  skip ${label} (file not present in this checkout)`); return; }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     missing substring: ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

const wstickPath = path.resolve(QN_FUNCTIONS, 'src', 'watchpartySeriesTick.js');
const helperPath = path.resolve(QN_FUNCTIONS, 'src', 'computeNextFireAt.js');
const fnIdxPath = path.resolve(QN_FUNCTIONS, 'index.js');
const indexesJsonPath = path.resolve(COUCH_ROOT, 'firestore.indexes.json');
const rulesPath = path.resolve(COUCH_ROOT, 'firestore.rules');

const wstick = readIfExists(wstickPath);
const helper = readIfExists(helperPath);
const fnIdx = readIfExists(fnIdxPath);
const idxJson = readIfExists(indexesJsonPath);
const rules = readIfExists(rulesPath);

// === Group A: watchpartySeriesTick.js structure ===
eqContains('A1 CF file exists + onSchedule registration', wstick, 'exports.watchpartySeriesTick = onSchedule');
eqContains('A2 schedule is every 6 hours per CONTEXT', wstick, "schedule: 'every 6 hours'");
eqContains('A3 region us-central1', wstick, "region: 'us-central1'");
eqContains('A4 24h horizon constant', wstick, 'SERIES_MATERIALIZE_HORIZON_MS');
eqContains('A5 query targets watchpartySeries collection', wstick, "db.collection('watchpartySeries')");
eqContains('A6 query filters active status', wstick, "where('status', '==', 'active')");
eqContains('A7 query bounds by nextFireAt horizon', wstick, "where('nextFireAt'");
eqContains('A8 query ordered by nextFireAt', wstick, "orderBy('nextFireAt')");
// A9 split into three substring checks for deterministic wpId — avoids template-literal shell-escape
// ambiguity that single-needle approaches risk (see plan-checker WARNING #5 history).
eqContains('A9a deterministic wpId has series_ prefix (CAL-16-04 piece 1/3)', wstick, 'series_');
eqContains('A9b deterministic wpId interpolates seriesDoc.id (CAL-16-04 piece 2/3)', wstick, 'seriesDoc.id');
eqContains('A9c deterministic wpId interpolates instanceDateKey (CAL-16-04 piece 3/3)', wstick, 'instanceDateKey');
eqContains('A10 existence-check before set (CAL-16-04)', wstick, 'wpSnap.exists');
eqContains('A11 wp doc carries seriesId back-reference', wstick, 'seriesId: seriesDoc.id');
eqContains('A12 wp doc carries seriesInstanceDateKey back-reference', wstick, 'seriesInstanceDateKey');
eqContains('A13 advancement via computeNextFireAt helper', wstick, "require('./computeNextFireAt')");
eqContains('A14 nextFireAt + lastFiredAt updated on series doc', wstick, "lastFiredAt: series.nextFireAt");

// === Group B: index.js export wiring ===
eqContains('B1 watchpartySeriesTick exported from index.js', fnIdx, 'exports.watchpartySeriesTick = require');
eqContains('B2 export references the src/ path', fnIdx, "require('./src/watchpartySeriesTick')");

// === Group C: Firestore infrastructure (rules + indexes) ===
eqContains('C1 firestore.rules has watchpartySeries match block', rules, 'match /watchpartySeries/{seriesId}');
eqContains('C2 firestore.indexes.json has watchpartySeries composite', idxJson, '"collectionGroup": "watchpartySeries"');
eqContains('C3 status+nextFireAt index field set', idxJson, '"fieldPath": "nextFireAt"');

// === Group D: cadence helper present (plan 16-02 prereq) ===
eqContains('D1 computeNextFireAt helper exists', helper, 'module.exports = { computeNextFireAt');
eqContains('D2 helper uses Intl (DST-safe, no luxon)', helper, 'Intl.DateTimeFormat');

// === Group E: DR-3 lockstep for seriesReminder (CAL-16-06) ===
// 1 key x 3 maps = 3 assertions. Catches "added key to client but not server" drift.
const appJs = readIfExists(path.resolve(COUCH_ROOT, 'js', 'app.js'));
eqContains('E1 client DEFAULT_NOTIFICATION_PREFS has seriesReminder (DR-3 lockstep)', appJs, 'seriesReminder: true');
eqContains('E2 client NOTIFICATION_EVENT_LABELS has seriesReminder label (DR-3 lockstep)', appJs, "seriesReminder:");
eqContains('E3 server NOTIFICATION_DEFAULTS has seriesReminder (DR-3 lockstep)', fnIdx, 'seriesReminder: true');

// === Group F: 30-min reminder push branch in watchpartyTick (CAL-16-05) ===
eqContains('F1 watchpartyTick has reminder branch gate on wp.seriesId', fnIdx, 'wp.seriesId && wp.status');
eqContains('F2 reminder branch uses +/-5min slop around T-30min', fnIdx, 'minutesBefore <= 35 && minutesBefore >= 25');
eqContains('F3 in-doc flag set BEFORE send (rsvpReminderTick pattern)', fnIdx, "'reminders.seriesReminder.t-30min': true");
eqContains('F4 push body title is Couch in 30 min', fnIdx, "title: 'Couch in 30 min'");
eqContains('F5 push tag is deterministic per (series, instance)', fnIdx, 'series-reminder-${wp.seriesId}-${wp.seriesInstanceDateKey}');
eqContains('F6 push uses eventType seriesReminder for per-user gating', fnIdx, "eventType: 'seriesReminder'");

// === FLOOR meta-assert ===
const FLOOR = 29;
if (passed >= FLOOR) {
  console.log(`  ok floor: ${passed} sentinels matched (>=${FLOOR})`);
  passed++;
} else {
  console.error(`  FAIL floor: only ${passed} sentinels matched (<${FLOOR})`);
  failed++;
}

console.log(`--- ${passed} passed, ${failed} failed ---`);
process.exit(failed === 0 ? 0 : 1);
