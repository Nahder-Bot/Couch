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
 *      state === 'pending' guard; CACHE = couch-v40-pickem)
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
void pathToFileURL;
void eqContains;
void QN_FUNCTIONS;
void PICKEM_PATH;

(async () => {
  // === Group 1-3: Pure-helper assertions (filled by Plan 28-02) ===
  // === Group 4: Production-code sentinels (filled by Plans 28-03 + 04 + 05) ===
  // === Group 5: Cross-repo lockstep (filled by Plan 28-03 — see PICK-28-17) ===
  // === Group 6: sw.js CACHE bump sentinel (filled by Plan 28-06) ===

  // Wave 0 PLACEHOLDER: prove the harness runs.
  eq('scaffold: smoke-pickem.cjs harness runs', true, true);

  // === Group 7: Floor meta-assertion (locked by Plan 28-06) ===
  // Wave 0 placeholder — will tighten to FLOOR=13 in Plan 28-06 after
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
