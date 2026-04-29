// Phase 19 — smoke test for kid-mode tier-cap behavior.
// Run: node scripts/smoke-kid-mode.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the kid-mode gate negotiated at /gsd-discuss-phase 19 (D-07..D-09).
// Mirrors the helper + filter logic from js/app.js so the contract is
// testable without a browser, Firestore, or auth state.
//
// Source contract (must match js/app.js):
//   getEffectiveTierCap (helper, ~module scope):
//     - state.kidMode ? 2 : null
//   passesBaseFilter (Tonight matches, ~line 5092):
//     - existing per-member tier cap runs first
//     - then kid-mode gate: when getEffectiveTierCap() !== null AND
//       tierFor(rating) > cap AND !state.kidModeOverrides.has(t.id) → false
//     - vetoed/watched/provider checks run BEFORE this gate (D-18..D-20)
//
// Same gate pattern is spliced into 6 other call sites (getCurrentMatches,
// getNeedsVoteTitles, getTierOneRanked/Two/Three, Library 'unwatched' / 'forme').
// All 7 share this contract — testing one validates the rest.

'use strict';

// ---- Mirror of js/constants.js RATING_TIERS + tierFor ----
const RATING_TIERS = {
  'G':1,'PG':2,'PG-13':3,'R':4,'NC-17':5,'NR':3,'UR':3,
  'TV-Y':1,'TV-Y7':1,'TV-G':1,'TV-PG':2,'TV-14':3,'TV-MA':5
};
function tierFor(rating) { return RATING_TIERS[rating] || null; }

// ---- Mirror of state slot ----
let state = { kidMode: false, kidModeOverrides: new Set() };

// ---- Mirror of getEffectiveTierCap (single source of truth) ----
function getEffectiveTierCap() {
  return state.kidMode ? 2 : null;
}

// ---- Mirror of the kid-mode gate (the one body spliced 7 times in js/app.js) ----
// Returns true if the title PASSES the gate (i.e., not blocked by kid-mode).
function passesKidModeGate(t) {
  const cap = getEffectiveTierCap();
  if (cap === null) return true;
  const tier = tierFor(t.rating);
  if (tier === null) return true;
  if (tier > cap && !state.kidModeOverrides.has(t.id)) return false;
  return true;
}

// ---- Test harness (mirror smoke-tonight-matches.cjs pattern) ----
let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`OK   ${label}: ${actual}`);
    passed++;
  } else {
    console.error(`FAIL ${label}: got ${actual}, expected ${expected}`);
    failed++;
  }
}

// ---- Test fixtures ----
const titlePG = { id: 'pg-title', rating: 'PG' };          // tier 2
const titlePG13 = { id: 'pg13-title', rating: 'PG-13' };   // tier 3
const titleR = { id: 'r-title', rating: 'R' };             // tier 4
const titleTVMA = { id: 'tvma-title', rating: 'TV-MA' };   // tier 5
const titleNoRating = { id: 'unrated-title', rating: null };

// ---- Tests ----

// Scenario A: kidMode=false (default) — gate is a no-op
console.log('\n-- Scenario A: kidMode=false (no-op) --');
state.kidMode = false;
state.kidModeOverrides = new Set();
check('A1 PG passes when kidMode off', passesKidModeGate(titlePG), true);
check('A2 PG-13 passes when kidMode off', passesKidModeGate(titlePG13), true);
check('A3 R passes when kidMode off', passesKidModeGate(titleR), true);
check('A4 TV-MA passes when kidMode off', passesKidModeGate(titleTVMA), true);
check('A5 Unrated passes when kidMode off', passesKidModeGate(titleNoRating), true);
check('A6 getEffectiveTierCap returns null when kidMode off', getEffectiveTierCap(), null);

// Scenario B: kidMode=true — tier > 2 blocked
console.log('\n-- Scenario B: kidMode=true (PG-13+ blocked) --');
state.kidMode = true;
state.kidModeOverrides = new Set();
check('B1 G passes when kidMode on', passesKidModeGate({ id: 'g', rating: 'G' }), true);
check('B2 PG passes when kidMode on (tier=2 = cap)', passesKidModeGate(titlePG), true);
check('B3 PG-13 BLOCKED when kidMode on', passesKidModeGate(titlePG13), false);
check('B4 R BLOCKED when kidMode on', passesKidModeGate(titleR), false);
check('B5 TV-MA BLOCKED when kidMode on', passesKidModeGate(titleTVMA), false);
check('B6 Unrated passes when kidMode on (tierFor returns null)', passesKidModeGate(titleNoRating), true);
check('B7 getEffectiveTierCap returns 2 when kidMode on', getEffectiveTierCap(), 2);

// Scenario C: kidMode=true with parent override — bypass cap
console.log('\n-- Scenario C: kidMode=true + override (bypass) --');
state.kidMode = true;
state.kidModeOverrides = new Set(['pg13-title']);
check('C1 PG-13 PASSES with override (was blocked in B3)', passesKidModeGate(titlePG13), true);
check('C2 R still blocked (no override for r-title)', passesKidModeGate(titleR), false);
state.kidModeOverrides = new Set(['pg13-title', 'r-title']);
check('C3 R PASSES with override (multiple titles in Set)', passesKidModeGate(titleR), true);
check('C4 PG-13 still passes (still in Set)', passesKidModeGate(titlePG13), true);
check('C5 TV-MA still blocked (not in override Set)', passesKidModeGate(titleTVMA), false);

// Scenario D: TV ratings respect tier mapping
console.log('\n-- Scenario D: TV-rating tier mapping --');
state.kidMode = true;
state.kidModeOverrides = new Set();
check('D1 TV-Y passes (tier 1)', passesKidModeGate({ id: 'tvy', rating: 'TV-Y' }), true);
check('D2 TV-G passes (tier 1)', passesKidModeGate({ id: 'tvg', rating: 'TV-G' }), true);
check('D3 TV-PG passes (tier 2 = cap)', passesKidModeGate({ id: 'tvpg', rating: 'TV-PG' }), true);
check('D4 TV-14 BLOCKED (tier 3)', passesKidModeGate({ id: 'tv14', rating: 'TV-14' }), false);
check('D5 TV-MA BLOCKED (tier 5)', passesKidModeGate({ id: 'tvma', rating: 'TV-MA' }), false);

// ---- Result ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
