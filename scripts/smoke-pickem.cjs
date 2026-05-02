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

  // === Group 5: Cross-repo lockstep (filled by Plan 28-03 — see PICK-28-17) ===
  // === Group 6: sw.js CACHE convention sentinel (filled by Plan 28-06) ===
  // IMPORTANT: assert the cache-naming CONVENTION ("const CACHE = 'couch-v"),
  // NOT a specific literal like "couch-v40-pickem". Literal assertions go stale
  // every subsequent cache bump and break the deploy gate (see scripts/smoke-
  // guest-rsvp.cjs:193-195 for the relaxation done 2026-05-02 after this trap
  // bit production). Pattern:
  //   const swJs = readIfExists(path.join(COUCH_ROOT, 'sw.js'));
  //   eqContains('6.X sw.js CACHE follows couch-v* convention', swJs, "const CACHE = 'couch-v");

  // === Group 7: Floor meta-assertion (locked by Plan 28-06) ===
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
