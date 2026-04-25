#!/usr/bin/env node
// Phase 12+ build-date auto-stamp.
//
// Updates BUILD_DATE in js/constants.js to today's date (YYYY-MM-DD, UTC).
// Run BEFORE every production deploy to ensure the Account → ABOUT version line
// reads correctly: "Couch v{N} — deployed {today}".
//
// Usage:
//   node scripts/stamp-build-date.cjs
//
// Exits 0 if updated or already current; non-zero on parse error.

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CONSTANTS = path.join(REPO_ROOT, 'js', 'constants.js');

const today = new Date().toISOString().slice(0, 10); // UTC YYYY-MM-DD
const src = fs.readFileSync(CONSTANTS, 'utf8');

const re = /export const BUILD_DATE\s*=\s*'(\d{4}-\d{2}-\d{2})';/;
const match = src.match(re);
if (!match) {
  console.error('ERROR: Could not find BUILD_DATE export in js/constants.js');
  process.exit(1);
}

if (match[1] === today) {
  console.log(`BUILD_DATE already current (${today}) — no change.`);
  process.exit(0);
}

const next = src.replace(re, `export const BUILD_DATE = '${today}';`);
fs.writeFileSync(CONSTANTS, next, 'utf8');
console.log(`BUILD_DATE: ${match[1]} → ${today}`);
