// Phase 15.5.6 — smoke test for Tonight tab matches + considerable filters.
// Run: node scripts/smoke-tonight-matches.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks in the matches/considerable rules negotiated 2026-04-28 after the
// v35.5.1 → v35.5.5 deploy ping-pong. Mirrors the filter logic from js/app.js
// (renderTonight + isWatchedByCouch) so the contract is testable without a
// browser, Firestore, or auth state.
//
// Source contract (must match js/app.js):
//   isWatchedByCouch (line ~7916):
//     - rewatchAllowedBy[mid] within 24h → false (rewatch override)
//     - t.watched === true → true
//     - any couch member said 'no' or 'seen' → true
//     - else → false
//   matches (line ~5052):
//     - passesBaseFilter passes
//     - at least one couch member said 'yes'
//     - no off-couch member said 'yes'
//   considerable (line ~5078):
//     - passesBaseFilter passes
//     - not in matches (so couch yes + off-couch yes routes here)
//     - at least one couch member said 'yes'

const COUCH = ['nahder', 'zoey']; // Two-person couch (Nahder = me, Zoey = partner)
const OFF_COUCH = ['ashley', 'brody', 'arianna', 'eliie', 'brynlee'];

// ---- Mirror of js/app.js filter logic ----

function isWatchedByCouch(t, couchMemberIds) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return false;
  const dayMs = 24 * 60 * 60 * 1000;
  const recently = (ts) => ts && (Date.now() - ts) < dayMs;
  const allow = t.rewatchAllowedBy || {};
  if (couchMemberIds.some(mid => recently(allow[mid]))) return false;
  if (t.watched) return true;
  const votes = t.votes || {};
  return couchMemberIds.some(mid => votes[mid] === 'no' || votes[mid] === 'seen');
}

function passesBaseFilter(t, couch) {
  // Smoke-test simplified passesBaseFilter: skip provider/mood/tier/veto/scope/approval
  // checks since they're orthogonal to the matches/considerable rules under test.
  if (isWatchedByCouch(t, couch)) return false;
  return true;
}

function getMatches(titles, selectedMembers) {
  const couchSet = new Set(selectedMembers);
  return titles.filter(t => {
    if (!passesBaseFilter(t, selectedMembers)) return false;
    const votes = t.votes || {};
    for (const mid in votes) {
      if (votes[mid] === 'yes' && !couchSet.has(mid)) return false;
    }
    return selectedMembers.some(mid => votes[mid] === 'yes');
  });
}

function getConsiderable(titles, selectedMembers) {
  const matches = getMatches(titles, selectedMembers);
  const matchIds = new Set(matches.map(t => t.id));
  return titles.filter(t => {
    if (!passesBaseFilter(t, selectedMembers)) return false;
    if (matchIds.has(t.id)) return false;
    const votes = t.votes || {};
    return selectedMembers.some(mid => votes[mid] === 'yes');
  });
}

// ---- Test harness ----

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

function inMatches(t, couch, label) {
  const m = getMatches([t], couch);
  check(label + ' [matches]', m.length === 1, true);
}
function notInMatches(t, couch, label) {
  const m = getMatches([t], couch);
  check(label + ' [matches]', m.length === 0, true);
}
function inConsiderable(t, couch, label) {
  const c = getConsiderable([t], couch);
  check(label + ' [considerable]', c.length === 1, true);
}
function notInConsiderable(t, couch, label) {
  const c = getConsiderable([t], couch);
  check(label + ' [considerable]', c.length === 0, true);
}

// ---- Test cases ----

console.log('--- Phase 15.5.5 matches/considerable rule contract ---');
console.log(`couch = [${COUCH.join(', ')}], off-couch = [${OFF_COUCH.join(', ')}]`);
console.log('');

// Case 1: All couch yes + no off-couch yes → matches ✓
const t1 = { id: 't1', votes: { nahder: 'yes', zoey: 'yes' } };
inMatches(t1, COUCH, 'all couch yes, zero off-couch yes');
notInConsiderable(t1, COUCH, 'all couch yes, zero off-couch yes');

// Case 2: Some couch yes, some couch abstain, no off-couch yes → matches ✓
// (per user spec "if someone didn't vote yet too bad for them")
const t2 = { id: 't2', votes: { nahder: 'yes' } }; // zoey abstained
inMatches(t2, COUCH, 'one couch yes, one couch abstain, zero off-couch yes');
notInConsiderable(t2, COUCH, 'one couch yes, one couch abstain, zero off-couch yes');

// Case 3: Couch yes + off-couch yes → considerable (off-couch yes routes out of matches)
const t3 = { id: 't3', votes: { nahder: 'yes', ashley: 'yes' } };
notInMatches(t3, COUCH, 'couch yes + off-couch yes');
inConsiderable(t3, COUCH, 'couch yes + off-couch yes');

// Case 4: All couch yes + off-couch yes → considerable (Mario / Anaconda / Traitors pattern)
const t4 = { id: 't4', votes: { nahder: 'yes', zoey: 'yes', ashley: 'yes', brody: 'yes' } };
notInMatches(t4, COUCH, 'all couch yes + multiple off-couch yes');
inConsiderable(t4, COUCH, 'all couch yes + multiple off-couch yes');

// Case 5: Couch member said NO → hidden entirely (passesBaseFilter rejects)
const t5 = { id: 't5', votes: { nahder: 'yes', zoey: 'no' } };
notInMatches(t5, COUCH, 'couch said no → hidden');
notInConsiderable(t5, COUCH, 'couch said no → hidden');

// Case 6: Couch member said SEEN → hidden entirely
const t6 = { id: 't6', votes: { nahder: 'yes', zoey: 'seen' } };
notInMatches(t6, COUCH, 'couch said seen → hidden');
notInConsiderable(t6, COUCH, 'couch said seen → hidden');

// Case 7: Only off-couch yes (no couch interest) → hidden
const t7 = { id: 't7', votes: { ashley: 'yes', brody: 'yes' } };
notInMatches(t7, COUCH, 'only off-couch yes → hidden');
notInConsiderable(t7, COUCH, 'only off-couch yes → hidden');

// Case 8: t.watched = true → hidden entirely (Trakt sync or manual mark)
const t8 = { id: 't8', watched: true, votes: { nahder: 'yes', zoey: 'yes' } };
notInMatches(t8, COUCH, 't.watched=true → hidden');
notInConsiderable(t8, COUCH, 't.watched=true → hidden');

// Case 9: Empty votes → hidden
const t9 = { id: 't9', votes: {} };
notInMatches(t9, COUCH, 'no votes → hidden');
notInConsiderable(t9, COUCH, 'no votes → hidden');

// Case 10: Off-couch said no — should NOT disqualify (per user spec — off-couch no doesn't matter)
const t10 = { id: 't10', votes: { nahder: 'yes', zoey: 'yes', ashley: 'no' } };
inMatches(t10, COUCH, 'all couch yes + off-couch no does not disqualify');

// Case 11: Off-couch said seen — should NOT disqualify (only couch seen does)
const t11 = { id: 't11', votes: { nahder: 'yes', zoey: 'yes', ashley: 'seen' } };
inMatches(t11, COUCH, 'all couch yes + off-couch seen does not disqualify');

// Case 12: rewatchAllowedBy override — recent timestamp on couch member opts back in
const t12 = {
  id: 't12',
  watched: true,
  votes: { nahder: 'yes', zoey: 'yes' },
  rewatchAllowedBy: { nahder: Date.now() - 1000 } // 1 second ago
};
inMatches(t12, COUCH, 'rewatch override on couch member overrides watched flag');

// Case 13: rewatchAllowedBy stale (>24h ago) — does NOT override
const t13 = {
  id: 't13',
  watched: true,
  votes: { nahder: 'yes', zoey: 'yes' },
  rewatchAllowedBy: { nahder: Date.now() - 25 * 60 * 60 * 1000 } // 25h ago
};
notInMatches(t13, COUCH, 'stale rewatch (>24h) does NOT override watched');

// Case 14: Solo couch (1 member) — same rules apply
const SOLO = ['nahder'];
const t14 = { id: 't14', votes: { nahder: 'yes' } };
inMatches(t14, SOLO, 'solo couch + that member yes → matches');

// Case 15: Solo couch + off-couch yes → considerable
const t15 = { id: 't15', votes: { nahder: 'yes', ashley: 'yes' } };
notInMatches(t15, SOLO, 'solo couch + off-couch yes → not matches');
inConsiderable(t15, SOLO, 'solo couch + off-couch yes → considerable');

// Case 16: Empty couch (defensive) — no matches at all
const t16 = { id: 't16', votes: { nahder: 'yes', zoey: 'yes' } };
notInMatches(t16, [], 'empty couch → no matches');
notInConsiderable(t16, [], 'empty couch → no considerable');

// Case 17: Bulk filter — multiple titles in one pass, ensure routing is correct
const bulkTitles = [
  { id: 'bulk-a', votes: { nahder: 'yes', zoey: 'yes' } },                       // matches
  { id: 'bulk-b', votes: { nahder: 'yes' } },                                     // matches (zoey abstain)
  { id: 'bulk-c', votes: { nahder: 'yes', ashley: 'yes' } },                      // considerable
  { id: 'bulk-d', votes: { ashley: 'yes' } },                                     // hidden
  { id: 'bulk-e', votes: { nahder: 'yes', zoey: 'no' } },                         // hidden
  { id: 'bulk-f', watched: true, votes: { nahder: 'yes', zoey: 'yes' } },         // hidden
];
const bulkMatches = getMatches(bulkTitles, COUCH).map(t => t.id).sort();
const bulkConsiderable = getConsiderable(bulkTitles, COUCH).map(t => t.id).sort();
check('bulk routing matches', JSON.stringify(bulkMatches), JSON.stringify(['bulk-a', 'bulk-b']));
check('bulk routing considerable', JSON.stringify(bulkConsiderable), JSON.stringify(['bulk-c']));

console.log('');
if (failed === 0) {
  console.log(`ALL ${passed} ASSERTIONS PASSED`);
  process.exit(0);
} else {
  console.error(`${failed} of ${passed + failed} ASSERTIONS FAILED`);
  process.exit(1);
}
