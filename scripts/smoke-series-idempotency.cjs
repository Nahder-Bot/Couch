'use strict';

// === Phase 16 / CAL-16-04 — smoke contract for deterministic-wpId idempotency ===
// Focused test: the materializer wpId construction MUST NOT contain Date.now()
// or Math.random() — otherwise re-runs would create duplicate wp docs and fire
// duplicate "watchparty scheduled" pushes. Negative-content assertion pattern.
//
// Pattern lifted from scripts/smoke-pickem.cjs Group 5 (lines 221-233) — cross-repo grep.
//
// Path resolution: couch is at `~/claude-projects/couch/`, queuenight is at `~/queuenight/`.
// Both are children of `~` (NOT siblings of each other's parents).
// Path math: 3x `..` walks from couch/scripts/X.cjs → couch → claude-projects → home (`~`),
// then into queuenight/functions/. Verified at planning time.

const fs = require('fs');
const path = require('path');

const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

let passed = 0;
let failed = 0;

function eqContains(label, fileContent, needle) {
  if (fileContent === null) { console.log(`  skip ${label}`); return; }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}: missing substring ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}

function eqAbsent(label, fileContent, badNeedle) {
  if (fileContent === null) { console.log(`  skip ${label}`); return; }
  if (!fileContent.includes(badNeedle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}: forbidden substring present ${JSON.stringify(badNeedle).slice(0, 120)}`);
  failed++;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function extractWpIdSection(content) {
  // Extract the ~10 lines around the `const wpId = ...` definition.
  if (!content) return '';
  const idx = content.indexOf('const wpId =');
  if (idx < 0) return '';
  // Get from 5 lines before to 5 lines after
  const before = content.lastIndexOf('\n', Math.max(0, idx - 200));
  const after = content.indexOf('\n', idx + 200);
  return content.slice(Math.max(before, 0), after > 0 ? after : content.length);
}

const wstick = readIfExists(path.resolve(QN_FUNCTIONS, 'src', 'watchpartySeriesTick.js'));
const wpIdSection = extractWpIdSection(wstick);

// === Group A: Positive — deterministic shape present (3-piece check) ===
// Split into 3 substring checks (avoids template-literal shell-escape ambiguity that
// single-needle approaches risk — see plan-checker WARNING #5 history).
eqContains('A1a wpId construction has series_ prefix piece', wstick, 'series_');
eqContains('A1b wpId construction interpolates seriesDoc.id piece', wstick, 'seriesDoc.id');
eqContains('A2 wpId includes instanceDateKey', wstick, 'instanceDateKey');
eqContains('A3 wpId derived from series.nextFireAt + series.timezone', wstick, "{ timeZone: series.timezone || 'UTC' }");
eqContains('A4 en-CA locale (ISO YYYY-MM-DD) used for date key', wstick, "toLocaleDateString('en-CA'");

// === Group B: Negative — wpId construction is PURE (no time/random) ===
// We check the ~10 lines around the wpId definition for forbidden tokens.
eqAbsent('B1 wpId construction has NO Date.now()', wpIdSection, 'Date.now()');
eqAbsent('B2 wpId construction has NO Math.random()', wpIdSection, 'Math.random()');

// === Group C: Idempotency contract — existence check + benign set ===
eqContains('C1 existence check via wpSnap.exists', wstick, 'wpSnap.exists');
eqContains('C2 alreadyExisted counter present (observable on re-run)', wstick, 'alreadyExisted++');
eqContains('C3 set() guarded by !wpSnap.exists branch', wstick, 'if (!wpSnap.exists)');

// === FLOOR meta-assert ===
const FLOOR = 9;
if (passed >= FLOOR) {
  console.log(`  ok floor: ${passed} sentinels matched (>=${FLOOR})`);
  passed++;
} else {
  console.error(`  FAIL floor: only ${passed} sentinels matched (<${FLOOR})`);
  failed++;
}

console.log(`--- ${passed} passed, ${failed} failed ---`);
process.exit(failed === 0 ? 0 : 1);
