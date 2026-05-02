#!/usr/bin/env node
/**
 * smoke-app-parse.cjs — ES module parse contract for the app shell modules.
 *
 * Why this exists: 2026-04-30 to 2026-05-02, a 1-paren mismatch in
 * js/app.js:10343 (introduced by commit 3fd3f15b sports league refactor)
 * shipped to production through TWO subsequent phase deploys (v38, v39)
 * because no smoke contract parsed js/app.js as an ES module. Users hitting
 * couchtonight.app/app saw only static Privacy/Terms because every dynamic
 * import('/js/app.js') threw SyntaxError: Unexpected token ';' before any
 * screen rendered. Detected and fixed in couch-v40-app-parse-fix; this
 * contract closes the gap.
 *
 * What it does: spawns `node --input-type=module --check` against each
 * top-level ES module that the app shell imports. Any SyntaxError aborts
 * the deploy gate. Fast (~250ms per module on dev box).
 *
 * Floor meta-assertion: passed >= 6 (matches Phase 26 / 27 / 28 pattern).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

let passed = 0;
let failed = 0;

const COUCH_ROOT = path.resolve(__dirname, '..');
const JS_DIR = path.resolve(COUCH_ROOT, 'js');

// Curated list — these are the modules dynamically imported by the app shell.
// Test files (*.test.js) and build helpers are intentionally excluded.
const ES_MODULES = [
  'app.js',
  'firebase.js',
  'state.js',
  'constants.js',
  'utils.js',
  'sports-feed.js',
  'native-video-player.js',
  'pickem.js',
  'auth.js',
  'discovery-engine.js',
];

function checkModule(relPath) {
  const fullPath = path.join(JS_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`  skip js/${relPath} (not present in this checkout)`);
    return;
  }
  const src = fs.readFileSync(fullPath, 'utf8');
  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--check'],
    { input: src, encoding: 'utf8', timeout: 30000 }
  );
  if (result.status === 0) {
    console.log(`  ok js/${relPath} parses as ES module`);
    passed++;
  } else {
    const stderr = (result.stderr || '').trim();
    // Node's --check error format: first line is "[stdin]:LINE", second is the
    // failing source line, third is the caret, fourth+ is the SyntaxError. Surface
    // enough detail to debug without dumping the whole stack.
    const lines = stderr.split('\n').slice(0, 6);
    console.error(`  FAIL js/${relPath} parse error`);
    for (const ln of lines) console.error(`     ${ln}`);
    failed++;
  }
}

console.log('--- smoke-app-parse: ES module parse contract ---');
for (const m of ES_MODULES) checkModule(m);

const FLOOR = 6;
if (passed >= FLOOR) {
  console.log(`  ok floor: ${passed} modules parsed (>=${FLOOR})`);
  passed++;
} else {
  console.error(`  FAIL floor: only ${passed} modules parsed (<${FLOOR})`);
  failed++;
}

console.log(`--- ${passed} passed, ${failed} failed ---`);
process.exit(failed === 0 ? 0 : 1);
