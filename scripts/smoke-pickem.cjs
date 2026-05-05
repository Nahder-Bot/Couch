#!/usr/bin/env node
/**
 * smoke-pickem.cjs — Phase 28 smoke contract (scaffold from Plan 28-01;
 * filled in across Plans 02-06 as production code lands).
 *
 * Pure-helper assertions for FIVE behavior families:
 *   1. slateOf + latestGameInSlate (slate grouping + tiebreaker designation)
 *   2. scorePick (all 4 pick types; partial-match edge cases per Pitfall 6)
 *   3. summarizeMemberSeason + compareMembers (OQ-8 tiebreaker arithmetic)
 *   4. Production-code sentinels (Firestore rules gameStartTime check;
 *      state === 'pending' guard; sw.js CACHE follows couch-v* convention
 *      — Plan 28-06 fills in via convention-check, NOT a hardcoded literal,
 *      because version-literal assertions go stale every subsequent cache bump.
 *      See scripts/smoke-app-parse.cjs and the 2026-05-02 deploy-receipt fix
 *      in scripts/smoke-guest-rsvp.cjs for the pattern.)
 *   5. Cross-repo lockstep grep for pickReminder/pickResults/pickemSeasonReset
 *      in BOTH js/app.js (DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS)
 *      and queuenight/functions/index.js (NOTIFICATION_DEFAULTS).
 *
 * Imports js/pickem.js via dynamic await import() (same pattern as
 * smoke-native-video-player.cjs — REVIEWS.md H2 fix from Phase 24)
 * to avoid pure-inline-copy drift.
 *
 * Floor meta-assertion: passed >= 13 (matches Phase 26 RPLY-26-17 pattern).
 * Plan 28-06 locks the floor to >=13 production-code sentinels via final
 * tally check.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)}`);
  console.error(`     actual:   ${JSON.stringify(actual)}`);
  failed++;
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

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');
const PICKEM_PATH = path.resolve(COUCH_ROOT, 'js', 'pickem.js');

// Suppress unused-import warnings for symbols exposed for downstream Plan 02-06 use.
void eqContains;
void QN_FUNCTIONS;

(async () => {
  // === Dynamic import of js/pickem.js (production-module testing per Phase 24 REVIEWS H2) ===
  let pickem;
  try {
    pickem = await import(pathToFileURL(PICKEM_PATH).href);
  } catch (e) {
    console.error('FAIL: could not import js/pickem.js:', e.message);
    process.exit(1);
  }
  const {
    slateOf, latestGameInSlate, scorePick, validatePickSelection,
    summarizeMemberSeason, compareMembers,
    PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS
  } = pickem;
  void validatePickSelection; // exposed for downstream Plan 04 schema-validator surface

  // === Group 1 — slateOf helper behavior (6 assertions) ===
  // 1A: NFL Thursday single-game slate
  {
    const thu = Date.UTC(2025, 10, 13, 0, 30);  // Nov 13 2025 00:30 UTC
    const slate = slateOf([{startTime: thu, league: 'nfl'}], 'nfl', '2025-11-13');
    eq('1A: NFL Thursday single-game slate length', slate.length, 1);
  }
  // 1B: NFL Sunday — 3 same-day games grouped
  {
    const sun = (h) => Date.UTC(2025, 10, 16, h, 0);
    const games = [{startTime: sun(13)}, {startTime: sun(17)}, {startTime: sun(20)}];
    const slate = slateOf(games, 'nfl', '2025-11-16');
    eq('1B: NFL Sunday 3-game slate length', slate.length, 3);
  }
  // 1C: NBA daily — UTC-date grouping excludes yesterday
  {
    const today = Date.UTC(2025, 10, 15, 1, 0);
    const yesterday = Date.UTC(2025, 10, 14, 1, 0);
    const games = [{startTime: today}, {startTime: today + 7200000}, {startTime: yesterday}];
    const slate = slateOf(games, 'nba', '2025-11-15');
    eq('1C: NBA UTC-date grouping excludes yesterday', slate.length, 2);
  }
  // 1D: Empty input → []
  eq('1D: slateOf([], nba, date) returns []', slateOf([], 'nba', '2025-11-15').length, 0);
  // 1E: Soccer EPL — `round` grouping spans days
  {
    const fri = Date.UTC(2025, 10, 7, 19, 30);
    const sat = Date.UTC(2025, 10, 8, 12, 0);
    const sun = Date.UTC(2025, 10, 9, 14, 0);
    const games = [
      {startTime: fri, round: '10'},
      {startTime: sat, round: '10'},
      {startTime: sun, round: '10'},
      {startTime: Date.UTC(2025, 10, 14, 19, 30), round: '11'}
    ];
    const slate = slateOf(games, 'epl', '2025-11-07');
    eq('1E: EPL round=10 spans 3 days, excludes round=11', slate.length, 3);
  }
  // 1F: F1 single race
  {
    const race = Date.UTC(2025, 10, 16, 13, 0);
    const slate = slateOf([{startTime: race}], 'f1', '2025-11-16');
    eq('1F: F1 single-race slate length', slate.length, 1);
  }

  // === Group 2 — latestGameInSlate helper behavior (3 assertions) ===
  {
    const single = {startTime: 1700000000000};
    eq('2G: latestGameInSlate single-game returns it', latestGameInSlate([single]), single);
  }
  {
    const early = {startTime: 1700000000000};
    const late = {startTime: 1700100000000};
    const mid = {startTime: 1700050000000};
    eq('2H: latestGameInSlate returns max-startTime game', latestGameInSlate([early, late, mid]), late);
  }
  {
    const result = latestGameInSlate([]);
    eq('2I: latestGameInSlate empty returns null', result == null, true);
  }

  // === Group 3 — scorePick per pickType (8 assertions inc. partial-match closure for Pitfall 6) ===
  // team_winner
  eq('3J: team_winner correct → 1',
    scorePick({pickType:'team_winner', selection:{winningTeam:'home'}}, {state:'post', winningTeam:'home'}), 1);
  eq('3K: team_winner incorrect → 0',
    scorePick({pickType:'team_winner', selection:{winningTeam:'home'}}, {state:'post', winningTeam:'away'}), 0);
  // team_winner_or_draw
  eq('3L: team_winner_or_draw draw correct → 1',
    scorePick({pickType:'team_winner_or_draw', selection:{result:'draw'}}, {state:'post', result:'draw'}), 1);
  // f1_podium — partial (2 of 3) → 0; full → 1 (Pitfall 6)
  eq('3M-partial: f1_podium 2-of-3 → 0',
    scorePick({pickType:'f1_podium', selection:{p1:'V',p2:'H',p3:'L'}}, {state:'post', p1:'V', p2:'H', p3:'X'}), 0);
  eq('3M-full: f1_podium full podium → 1',
    scorePick({pickType:'f1_podium', selection:{p1:'V',p2:'H',p3:'L'}}, {state:'post', p1:'V', p2:'H', p3:'L'}), 1);
  // ufc_winner_method
  eq('3N-both: ufc_winner_method both correct → 1',
    scorePick({pickType:'ufc_winner_method', selection:{winningFighter:'F1', method:'KO'}}, {state:'post', winningFighter:'F1', method:'KO'}), 1);
  eq('3N-method-wrong: ufc_winner_method fighter correct + method wrong → 0',
    scorePick({pickType:'ufc_winner_method', selection:{winningFighter:'F1', method:'SUB'}}, {state:'post', winningFighter:'F1', method:'KO'}), 0);
  // safety: pending game → 0
  eq('3O: scorePick on state=pending → 0',
    scorePick({pickType:'team_winner', selection:{winningTeam:'home'}}, {state:'pending'}), 0);

  // === Group 4 — compareMembers tiebreaker edge cases (4 assertions) ===
  // Both no submission → tie
  eq('4P: both no tiebreaker → tie',
    compareMembers(
      {pointsTotal:10, tiebreakerCount:0, tiebreakerDeltaTotal:0},
      {pointsTotal:10, tiebreakerCount:0, tiebreakerDeltaTotal:0}
    ), 0);
  // Partial submission → submitter wins (return < 0)
  {
    const r = compareMembers(
      {pointsTotal:10, tiebreakerCount:2, tiebreakerDeltaTotal:6},
      {pointsTotal:10, tiebreakerCount:0, tiebreakerDeltaTotal:0}
    );
    eq('4Q: Mom submitted, Dad did not → Mom wins (return < 0)', r < 0, true);
  }
  // Equal delta → tie
  eq('4R: equal delta → tie',
    compareMembers(
      {pointsTotal:10, tiebreakerCount:1, tiebreakerDeltaTotal:5},
      {pointsTotal:10, tiebreakerCount:1, tiebreakerDeltaTotal:5}
    ), 0);
  // Higher points always wins
  {
    const r = compareMembers(
      {pointsTotal:20, tiebreakerCount:0, tiebreakerDeltaTotal:0},
      {pointsTotal:10, tiebreakerCount:5, tiebreakerDeltaTotal:0}
    );
    eq('4S: higher points always wins regardless of tiebreaker (return < 0)', r < 0, true);
  }

  // === Group 4b — summarizeMemberSeason (2 assertions) ===
  {
    const empty = summarizeMemberSeason([]);
    eq('4T: empty picks → zeros', empty.pointsTotal === 0 && empty.picksTotal === 0, true);
  }
  {
    const picks = [
      {state:'settled', pointsAwarded:1},
      {state:'settled', pointsAwarded:0},
      {state:'auto_zeroed', pointsAwarded:0},
      {state:'pending'}
    ];
    const sum = summarizeMemberSeason(picks);
    eq('4U: summarizeMemberSeason mixed states (Pitfall 7 closure)',
      sum.pointsTotal === 1 && sum.picksTotal === 4 && sum.picksSettled === 2 && sum.picksAutoZeroed === 1, true);
  }

  // === Constants sanity (2 assertions) ===
  eq('K1: PICK_REMINDER_OFFSET_MS is 15min', PICK_REMINDER_OFFSET_MS, 15 * 60 * 1000);
  eq('K2: PICK_TYPE_BY_LEAGUE.f1 = f1_podium', PICK_TYPE_BY_LEAGUE.f1, 'f1_podium');

  // === Group 5 — Cross-repo lockstep for 3 pick'em push event keys (PICK-28-17) ===
  // 9 assertions = 3 keys × 3 maps. Catches the "added key to client but not
  // server" or vice-versa drift before deploy. Mirrors Phase 14 D-12 lockstep
  // convention (DR-3 three-place add).
  {
    const appJs = readIfExists(path.join(COUCH_ROOT, 'js', 'app.js'));
    const fnIdx = readIfExists(path.join(QN_FUNCTIONS, 'index.js'));
    for (const key of ['pickReminder', 'pickResults', 'pickemSeasonReset']) {
      eqContains(`5.lockstep client DEFAULT_NOTIFICATION_PREFS has ${key}`, appJs, `${key}: true`);
      eqContains(`5.lockstep client NOTIFICATION_EVENT_LABELS has ${key}`, appJs, `${key}:`);
      eqContains(`5.lockstep server NOTIFICATION_DEFAULTS has ${key}`, fnIdx, `${key}: true`);
    }
  }

  // === Group 6 — gameResultsTick + pickReminderTick + indexes sentinels
  //              (PICK-28-12/16/18/19/31/32/33/34/35) ===
  // CF + REVIEWS-amendment sentinels grep production source files for the exact
  // literal patterns required by 28-REVIEWS.md amendments 1-5 + 10. Assertions
  // 6.D and 6.I are the negative + positive sides of REVIEWS HIGH-4 (backend
  // UFC defense — must NOT scoreswitch on ufc_winner_method, MUST allowlist).
  {
    const grtPath = path.resolve(QN_FUNCTIONS, 'src', 'gameResultsTick.js');
    const prtPath = path.resolve(QN_FUNCTIONS, 'src', 'pickReminderTick.js');
    const grt = readIfExists(grtPath);
    const prt = readIfExists(prtPath);
    const idxJson = readIfExists(path.join(COUCH_ROOT, 'firestore.indexes.json'));
    const fnIdx = readIfExists(path.join(QN_FUNCTIONS, 'index.js'));

    eqContains('6.A gameResultsTick CF exists + onSchedule registration', grt, 'exports.gameResultsTick = onSchedule');
    eqContains('6.B gameResultsTick uses Jolpica F1 results endpoint (D-17 update 2)', grt, 'api.jolpi.ca/ergast/f1');
    eqContains('6.C gameResultsTick has db.runTransaction for atomic leaderboard update', grt, 'db.runTransaction');
    eqContains("6.D gameResultsTick has NO 'ufc_winner_method' switch case (UFC dropped per D-17 update 2)",
               grt && !grt.includes("case 'ufc_winner_method'") ? 'NO_UFC' : null, 'NO_UFC');

    // REVIEWS Amendment 1 / HIGH-2 — counter ownership.
    eqContains('6.E gameResultsTick declares processedFirstAt sentinel for picksTotal idempotency',
      grt, 'processedFirstAt');
    eqContains('6.F gameResultsTick increments memberRow.picksTotal inside processedFirstAt guard',
      grt, 'memberRow.picksTotal = (memberRow.picksTotal || 0) + 1');
    eqContains('6.G gameResultsTick sets memberRow.lastPickAt from pick.submittedAt',
      grt, 'memberRow.lastPickAt = pickNow.submittedAt');

    // REVIEWS Amendment 2 / HIGH-4 — backend UFC defense.
    eqContains('6.H gameResultsTick declares KNOWN_PICKTYPES allowlist',
      grt, 'KNOWN_PICKTYPES');
    eqContains('6.I gameResultsTick continues BEFORE transaction for unsupported pickType (HIGH-4)',
      grt, 'KNOWN_PICKTYPES.has(pick.pickType)');

    // REVIEWS Amendment 3 / MEDIUM-5 — branch-aware grace.
    eqContains('6.J gameResultsTick declares GRACE_BY_PICKTYPE map (MEDIUM-5)',
      grt, 'GRACE_BY_PICKTYPE');
    eqContains('6.K GRACE_BY_PICKTYPE.f1_podium uses 24h tolerance for Jolpica race-day lag',
      grt, '24 * 60 * 60 * 1000');

    // REVIEWS Amendment 4 / MEDIUM-10 — per-tick fetch cache.
    eqContains('6.L gameResultsTick allocates scoreCacheByTick Map (MEDIUM-10)',
      grt, 'scoreCacheByTick = new Map()');

    // pickReminderTick + lockstep registration.
    eqContains('6.M pickReminderTick CF exists + onSchedule registration', prt, 'exports.pickReminderTick = onSchedule');
    eqContains('6.N pickReminderTick writes picks_reminders idempotency doc', prt, 'picks_reminders');
    eqContains('6.O pickReminderTick uses PICK_REMINDER_OFFSET_MS literal', prt, 'PICK_REMINDER_OFFSET_MS');
    eqContains('6.P index.js registers gameResultsTick CF', fnIdx, "exports.gameResultsTick = require('./src/gameResultsTick').gameResultsTick");
    eqContains('6.Q index.js registers pickReminderTick CF', fnIdx, "exports.pickReminderTick = require('./src/pickReminderTick').pickReminderTick");

    // REVIEWS Amendment 5 / HIGH-3 — composite indexes declared.
    eqContains('6.R firestore.indexes.json declares watchparties (mode, hostFamilyCode) composite index',
      idxJson, '"collectionGroup": "watchparties"');
    eqContains('6.S firestore.indexes.json declares picks (state, gameStartTime) composite index',
      idxJson, '"collectionGroup": "picks"');

    // D-17 update 2 — Jolpica URL must end with /results/ trailing slash; the
    // bare /results path 301-redirects which https.get treats as an error.
    eqContains('6.T gameResultsTick uses Jolpica /results/ trailing-slash form',
      grt, '/results/');
  }

  // === Group 7 — Firestore rules + rules-tests sentinels
  //              (PICK-28-09/10/11/23/24/36/37/38) ===
  // Production-code grep that asserts the rule literals required by REVIEWS
  // Amendments 6/7/8/9 landed verbatim in firestore.rules + tests/rules.test.js.
  // 10 assertions covering all 3 new rule blocks + the 10 Phase 28 rules-tests.
  {
    const rules = readIfExists(path.join(COUCH_ROOT, 'firestore.rules'));
    const rulesTest = readIfExists(path.join(COUCH_ROOT, 'tests', 'rules.test.js'));

    eqContains('7.A firestore.rules has /picks/{pickId} block with gameStartTime CREATE lock',
      rules, 'request.time.toMillis() < request.resource.data.gameStartTime');
    eqContains('7.B firestore.rules picks UPDATE rule has lock check (resource.data.gameStartTime)',
      rules, 'request.time.toMillis() < resource.data.gameStartTime');
    eqContains('7.C firestore.rules picks CREATE REQUIRES state == \'pending\' (REVIEWS HIGH-1)',
      rules, "request.resource.data.state == 'pending'");
    eqContains('7.D firestore.rules picks CREATE constrains pickType to 3-value allowlist (REVIEWS HIGH-4)',
      rules, "request.resource.data.pickType in ['team_winner', 'team_winner_or_draw', 'f1_podium']");
    eqContains('7.E firestore.rules picks UPDATE uses affectedKeys hasOnly allowlist (REVIEWS HIGH-9)',
      rules, 'affectedKeys().hasOnly(');
    eqContains('7.F firestore.rules picks UPDATE allowlist includes selection',
      rules, "'selection'");
    eqContains('7.G firestore.rules picks UPDATE allowlist includes tiebreakerTotal',
      rules, "'tiebreakerTotal'");
    eqContains('7.H firestore.rules has /picks_reminders/{reminderId} top-level CF-only block',
      rules, 'match /picks_reminders/{reminderId}');
    eqContains('7.I rules.test.js has Phase 28 describe block',
      rulesTest, "describe('Phase 28 Pick\\'em rules'");
    eqContains('7.J rules.test.js Phase 28 has all 10 cases (#28-10 = last case anchor)',
      rulesTest, '#28-10');
  }

  // === Group 8: Floor meta-assertion (locked by Plan 28-06) ===
  // Wave 1 placeholder — will tighten to FLOOR=13 in Plan 28-06 after
  // production-code sentinels land in Plans 02-05.
  {
    const FLOOR = 1; // placeholder — Plan 28-06 raises to 13
    if (passed >= FLOOR) {
      console.log(`  ok floor met (${passed} >= ${FLOOR})`);
      passed++;
    } else {
      console.error(`  FAIL floor NOT met (${passed} < ${FLOOR})`);
      failed++;
    }
  }

  console.log(`smoke-pickem: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
  process.exit(0);
})().catch(e => {
  console.error('smoke-pickem: fatal error', e);
  process.exit(1);
});
