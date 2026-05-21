// Phase 20 — smoke test for decision-explanation phrase builder.
// Run: node scripts/smoke-decision-explanation.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the helper contract negotiated at /gsd-discuss-phase 20 (D-01..D-06 + D-10).
// Mirrors buildMatchExplanation from js/app.js so the contract is testable
// without a browser, Firestore, or auth state. Self-contained — does NOT
// require() js/constants.js or js/utils.js (those are ES modules; CJS
// require() throws ERR_REQUIRE_ESM). Inlines minimal brand-map + escapeHtml stub.
//
// Source contract (must match js/app.js buildMatchExplanation):
//   - returns '' on null title or empty couch (A1, A2)
//   - voter phrase: 1 / 2 / 3+/all-of cases (A3-A6) per D-03
//   - considerable variant: 1-voter case reads "Some of you said yes" (A15) per D-10
//   - provider phrase: couch-services intersection preferred; else "Streaming on {firstBrand}" (A7-A9) per D-04
//   - runtime: ">=60 min" -> "{H} hr {M} min" (or "{H} hr" when M==0); else "{M} min"; null/0 skipped (A10-A12) per D-05
//   - 3-phrase cap with voters > provider > runtime drop priority (A13-A14) per D-06
//   - phrase separator: ' · ' (space-middle-dot-space)

'use strict';

// ---- Inline brand-map mirror (subset of js/constants.js normalizeProviderName) ----
// Cannot require() the ES module — same constraint as smoke-kid-mode.cjs inlining RATING_TIERS.
const BRAND_MAP = {
  'Netflix': 'Netflix',
  'Max': 'Max',
  'HBO Max': 'Max',
  'Hulu': 'Hulu',
  'Amazon Prime Video': 'Prime Video',
  'Prime Video': 'Prime Video',
  'Disney+': 'Disney+',
  'Disney Plus': 'Disney+'
};
function normalizeProviderName(name) {
  if (!name) return null;
  return BRAND_MAP[name] || name;
}

// ---- Inline escapeHtml stub (smoke fixtures use safe ASCII names) ----
function escapeHtml(s) { return String(s == null ? '' : s); }

// ---- Mirror of buildMatchExplanation (must match js/app.js declaration) ----
// Note: smoke version takes `members` as 4th positional arg (instead of reading
// state.members) so it stays pure. Production helper reads state.members directly.
function buildMatchExplanation(t, couchMemberIds, members, opts) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return '';
  const votes = t.votes || {};
  const considerableVariant = !!(opts && opts.considerableVariant);
  const phrases = [];

  const yesVoters = couchMemberIds.filter(mid => votes[mid] === 'yes');
  if (yesVoters.length > 0) {
    let votersPhrase;
    if (yesVoters.length === 1) {
      if (considerableVariant) {
        votersPhrase = 'Some of you said yes';
      } else {
        const m = members.find(x => x.id === yesVoters[0]);
        votersPhrase = escapeHtml(m ? m.name : yesVoters[0]) + ' said yes';
      }
    } else if (yesVoters.length === 2 && yesVoters.length === couchMemberIds.length) {
      const n1 = members.find(x => x.id === yesVoters[0]);
      const n2 = members.find(x => x.id === yesVoters[1]);
      votersPhrase = escapeHtml(n1 ? n1.name : yesVoters[0]) + ' + ' + escapeHtml(n2 ? n2.name : yesVoters[1]) + ' said yes';
    } else if (yesVoters.length === couchMemberIds.length) {
      votersPhrase = 'All of you said yes';
    } else {
      votersPhrase = yesVoters.length + ' of you said yes';
    }
    phrases.push(votersPhrase);
  }

  const providers = Array.isArray(t.providers) ? t.providers : [];
  if (providers.length) {
    const couchServices = new Set();
    for (const mid of couchMemberIds) {
      const m = members.find(x => x.id === mid);
      if (m && Array.isArray(m.services)) m.services.forEach(s => couchServices.add(s));
    }
    let matchedBrand = null;
    for (const p of providers) {
      const brand = normalizeProviderName(p && p.name);
      if (brand && couchServices.has(brand)) { matchedBrand = brand; break; }
    }
    if (matchedBrand) {
      phrases.push('Available on ' + matchedBrand);
    } else {
      const firstBrand = normalizeProviderName(providers[0] && providers[0].name);
      if (firstBrand) phrases.push('Streaming on ' + firstBrand);
    }
  }

  if (t.runtime != null && t.runtime > 0) {
    const mins = t.runtime;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      phrases.push(m === 0 ? (h + ' hr') : (h + ' hr ' + m + ' min'));
    } else {
      phrases.push(mins + ' min');
    }
  }

  return phrases.slice(0, 3).join(' · ');
}

// ---- Test harness (mirror smoke-kid-mode.cjs pattern) ----
let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`OK   ${label}: ${JSON.stringify(actual)}`);
    passed++;
  } else {
    console.error(`FAIL ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

// ---- Test fixtures ----
const members = [
  { id: 'm1', name: 'Nahder', services: ['Netflix', 'Hulu'] },
  { id: 'm2', name: 'Zoey',   services: ['Hulu', 'Disney+'] },
  { id: 'm3', name: 'Ashley', services: ['Netflix'] }
];
const couch2 = ['m1', 'm2'];
const couch3 = ['m1', 'm2', 'm3'];

// ---- Tests ----
console.log('\n-- Scenario A: Empty / null inputs --');
check('A1 Empty couch -> empty string', buildMatchExplanation({ id: 't1', votes: { m1: 'yes' } }, [], members), '');
check('A2 Null title -> empty string', buildMatchExplanation(null, couch2, members), '');

console.log('\n-- Scenario B: Voter phrase variants (D-03) --');
check('A3 1 yes-voter -> "{Name} said yes"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' } }, couch2, members),
  'Nahder said yes');
check('A4 2 yes-voters -> "{N1} + {N2} said yes"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes', m2: 'yes' } }, couch2, members),
  'Nahder + Zoey said yes');
check('A5 2-of-3 (>2 couch, <full) -> "{count} of you said yes"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes', m2: 'yes' } }, couch3, members),
  '2 of you said yes');
check('A6 All-of-couch (3==3) -> "All of you said yes"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes', m2: 'yes', m3: 'yes' } }, couch3, members),
  'All of you said yes');

console.log('\n-- Scenario C: Provider phrase (D-04) --');
check('A7 Provider intersection (Netflix in m1.services) -> "Available on Netflix"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, providers: [{ name: 'Netflix' }] }, couch2, members),
  'Nahder said yes · Available on Netflix');
check('A8 No intersection (Max not in any couch services) -> "Streaming on Max" fallback',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, providers: [{ name: 'HBO Max' }] }, couch2, members),
  'Nahder said yes · Streaming on Max');
check('A9 Empty providers -> provider phrase omitted',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, providers: [] }, couch2, members),
  'Nahder said yes');

console.log('\n-- Scenario D: Runtime phrase (D-05) --');
check('A10 165 min -> "2 hr 45 min"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, runtime: 165 }, couch2, members),
  'Nahder said yes · 2 hr 45 min');
check('A11 42 min -> "42 min"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, runtime: 42 }, couch2, members),
  'Nahder said yes · 42 min');
check('A12 null runtime -> phrase omitted',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, runtime: null }, couch2, members),
  'Nahder said yes');

console.log('\n-- Scenario E: 3-phrase cap + priority (D-02 + D-06) --');
check('A13 All 3 phrases -> joined with " · "',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes', m2: 'yes' }, providers: [{ name: 'Hulu' }], runtime: 98 }, couch2, members),
  'Nahder + Zoey said yes · Available on Hulu · 1 hr 38 min');
check('A14 Cap at 3 — extra phrases would be dropped (verify 60-min boundary "1 hr" formatting too)',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' }, providers: [{ name: 'Netflix' }], runtime: 60 }, couch2, members),
  'Nahder said yes · Available on Netflix · 1 hr');

console.log('\n-- Scenario F: Considerable variant (D-10) --');
check('A15 1-voter + considerableVariant=true -> "Some of you said yes"',
  buildMatchExplanation({ id: 't', votes: { m1: 'yes' } }, couch3, members, { considerableVariant: true }),
  'Some of you said yes');

// ---- Result ----
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
if (failed === 0) console.log('All tests passed');
process.exit(failed > 0 ? 1 : 0);
