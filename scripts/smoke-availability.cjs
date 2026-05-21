// Phase 18 / Plan 03 — smoke contract tests for queuenight Phase-18 pure helpers.
// Run: node scripts/smoke-availability.cjs (from couch repo root)
// Exit 0 = pass / skip-when-queuenight-absent; exit 1 = fail.
//
// Validates the D-07 (subscription-bucket diff), D-14 (single-title push body),
// and D-15 (batch push body with 3-title + 3-brand caps) contracts. Mirrors the
// pattern of scripts/smoke-position-transform.cjs and smoke-tonight-matches.cjs
// — pure Node, no Firestore/auth/browser, runs in ~50ms.
//
// Cross-repo require: queuenight/functions/index.js exports the helpers via
// module.exports.addedBrandsFor / .buildPushBody / .normalizeProviderName.
// If the queuenight sibling repo isn't present (fresh clone, dev machine
// mismatch), the smoke prints SKIP and exits 0 — does NOT fail the deploy
// for an environmental absence (per Plan 18-03 graceful-skip contract).
'use strict';
const fs = require('fs');
const path = require('path');

const QUEUENIGHT_INDEX = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions', 'index.js');

if (!fs.existsSync(QUEUENIGHT_INDEX)) {
  console.log('SKIP: queuenight sibling repo not found at ' + QUEUENIGHT_INDEX);
  console.log('      smoke-availability requires queuenight/functions/index.js to exist locally.');
  console.log('      Skipping (exit 0) — this is expected on machines without the queuenight sibling.');
  process.exit(0);
}

let mod;
try {
  // The require resolves the side-effect-free helper exports. Note: queuenight's
  // functions/index.js initializes firebase-admin at the top of the module —
  // this runs `admin.initializeApp()` which logs a warning when called outside
  // a Firebase context, but does NOT throw. We tolerate the warning.
  mod = require(QUEUENIGHT_INDEX);
} catch (e) {
  console.error('FAIL: require(' + QUEUENIGHT_INDEX + ') threw: ' + (e && e.message));
  process.exit(1);
}

const { addedBrandsFor, buildPushBody, normalizeProviderName } = mod;

let fails = 0;

function eq(label, got, want) {
  const ok = got === want;
  if (!ok) {
    console.error('FAIL ' + label + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}

function eqSet(label, gotSet, wantArr) {
  // Compare a Set against an expected array (order-independent).
  if (!(gotSet instanceof Set)) {
    console.error('FAIL ' + label + ': got non-Set ' + JSON.stringify(gotSet));
    fails++;
    return;
  }
  const want = new Set(wantArr);
  if (gotSet.size !== want.size) {
    console.error('FAIL ' + label + ': size mismatch got ' + gotSet.size + ' want ' + want.size);
    fails++;
    return;
  }
  for (const b of want) {
    if (!gotSet.has(b)) {
      console.error('FAIL ' + label + ': missing brand ' + b);
      fails++;
      return;
    }
  }
  console.log('OK   ' + label);
}

function eqObj(label, got, want) {
  const a = JSON.stringify(got);
  const b = JSON.stringify(want);
  if (a !== b) {
    console.error('FAIL ' + label + ':\n  got:  ' + a + '\n  want: ' + b);
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}

// === Helper to build a provider entry like the title-doc shape ===
function P(name) { return { name: name, logo: '' }; }

// ===========================
// addedBrandsFor (D-07)
// ===========================

eqSet('addedBrandsFor empty + empty', addedBrandsFor([], []), []);
eqSet('addedBrandsFor [Netflix] + [Netflix]', addedBrandsFor([P('Netflix')], [P('Netflix')]), []);
eqSet('addedBrandsFor [Netflix] + [Netflix, Max]', addedBrandsFor([P('Netflix')], [P('Netflix'), P('Max')]), ['Max']);
eqSet('addedBrandsFor [] + [Netflix, Max] (cold start)', addedBrandsFor([], [P('Netflix'), P('Max')]), ['Netflix', 'Max']);
eqSet('addedBrandsFor [Max] + [HBO Max] (normalization collapse)', addedBrandsFor([P('Max')], [P('HBO Max')]), []);
eqSet('addedBrandsFor [Netflix, Max] + [Netflix] (D-07 unidirectional)', addedBrandsFor([P('Netflix'), P('Max')], [P('Netflix')]), []);
eqSet('addedBrandsFor [Amazon Prime Video] + [Prime Video] (normalization collapse)', addedBrandsFor([P('Amazon Prime Video')], [P('Prime Video')]), []);
eqSet('addedBrandsFor null + [Netflix]', addedBrandsFor(null, [P('Netflix')]), ['Netflix']);
eqSet('addedBrandsFor undefined + [Max]', addedBrandsFor(undefined, [P('Max')]), ['Max']);

// ===========================
// buildPushBody (D-14 + D-15)
// ===========================

eq('buildPushBody []', buildPushBody([]), null);
eq('buildPushBody null', buildPushBody(null), null);

// D-14 single-title verbatim template
eqObj(
  'buildPushBody single-title (D-14)',
  buildPushBody([{ titleName: 'Dune', brand: 'Max' }]),
  { title: 'Newly watchable', body: 'Dune just hit Max for your household.' }
);

// D-15 2-title batch body
eqObj(
  'buildPushBody 2-title batch (D-15)',
  buildPushBody([
    { titleName: 'Dune', brand: 'Max' },
    { titleName: 'Severance', brand: 'Apple TV+' }
  ]),
  { title: 'Newly watchable', body: '2 titles your couch wants are now watchable: Dune, Severance on Max, Apple TV+' }
);

// D-15 3-title batch body — all surfaced, no '+N more' suffix
eqObj(
  'buildPushBody 3-title batch (no truncation)',
  buildPushBody([
    { titleName: 'A', brand: 'Netflix' },
    { titleName: 'B', brand: 'Netflix' },
    { titleName: 'C', brand: 'Netflix' }
  ]),
  { title: 'Newly watchable', body: '3 titles your couch wants are now watchable: A, B, C on Netflix' }
);

// D-15 5-title batch body — only first 2 surfaced + '+3 more' suffix
eqObj(
  'buildPushBody 5-title batch (3-title cap)',
  buildPushBody([
    { titleName: 'A', brand: 'Netflix' },
    { titleName: 'B', brand: 'Netflix' },
    { titleName: 'C', brand: 'Netflix' },
    { titleName: 'D', brand: 'Netflix' },
    { titleName: 'E', brand: 'Netflix' }
  ]),
  { title: 'Newly watchable', body: '5 titles your couch wants are now watchable: A, B, +3 more on Netflix' }
);

// D-15 6-title batch with 5 distinct brands — brand list capped at 3 with '…'
eqObj(
  'buildPushBody brand-list cap-at-3 + ellipsis',
  buildPushBody([
    { titleName: 'A', brand: 'Netflix' },
    { titleName: 'B', brand: 'Max' },
    { titleName: 'C', brand: 'Hulu' },
    { titleName: 'D', brand: 'Apple TV+' },
    { titleName: 'E', brand: 'Disney+' },
    { titleName: 'F', brand: 'Netflix' }
  ]),
  { title: 'Newly watchable', body: '6 titles your couch wants are now watchable: A, B, +4 more on Netflix, Max, Hulu…' }
);

// ===========================
// normalizeProviderName (sanity subset — full coverage lives couch-side)
// ===========================

eq("normalizeProviderName('Amazon Prime Video')", normalizeProviderName('Amazon Prime Video'), 'Prime Video');
eq("normalizeProviderName('HBO Max')", normalizeProviderName('HBO Max'), 'Max');
eq("normalizeProviderName('Disney Plus')", normalizeProviderName('Disney Plus'), 'Disney+');
eq("normalizeProviderName('Netflix')", normalizeProviderName('Netflix'), 'Netflix');
eq("normalizeProviderName('Unknown Provider')", normalizeProviderName('Unknown Provider'), 'Unknown Provider');
eq("normalizeProviderName(null)", normalizeProviderName(null), null);
eq("normalizeProviderName('')", normalizeProviderName(''), '');

if (fails) {
  console.error('\nFAILED ' + fails + ' assertion(s)');
  process.exit(1);
} else {
  console.log('\nALL ASSERTIONS PASSED (smoke-availability)');
  process.exit(0);
}
