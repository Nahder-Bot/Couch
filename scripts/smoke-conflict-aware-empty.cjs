// Phase 21 — smoke test for conflict-aware empty-state diagnosis helper.
// Run: node scripts/smoke-conflict-aware-empty.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the helper contract negotiated at /gsd-discuss-phase 21 (D-01..D-12).
// Mirrors diagnoseEmptyMatches from js/app.js so the contract is testable
// without a browser, Firestore, or auth state. Self-contained — does NOT
// require() js/constants.js or js/utils.js (those are ES modules; CJS
// require() throws ERR_REQUIRE_ESM). Inlines minimal deps: stub state.members,
// brand-map, escapeHtml, tierFor, ageToMaxTier, getEffectiveTierCap.
//
// Source contract (must match js/app.js diagnoseEmptyMatches):
//   - empty titles -> { 'No titles yet', [] } (A1)
//   - empty couch -> { "No one's on the couch.", [] } (A2)
//   - null inputs -> graceful no-op (A3, A4)
//   - all-vetoed by single member: headline names them; chip "{Name} vetoed N" (A5)
//   - vetoes by multiple: chip "N vetoed across the couch" (A6)
//   - kid-mode tier cap: chip "Kid Mode hides N" (A7)
//   - per-member tier cap: chip "N over the rating cap" (A8)
//   - mood filter: chip "No matching mood" (A9)
//   - provider unavailable: chip "Off {brand1} / {brand2} / {brand3}" (A10)
//   - no yes-votes: headline "No one's said yes to anything yet." (A11)
//   - mixed-cause priority (veto + kidmode): both chips, veto first (A12)
//   - cap at 3 chips when 4+ reasons trigger (A13)
//   - helper does not mutate input arrays (A14 — JSON before/after compare)

'use strict';

// ---- Stubs / inlined deps ----
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
function escapeHtml(s) { return String(s == null ? '' : s); }
const RATING_TIERS = {
  'G':1,'PG':2,'PG-13':3,'R':4,'NC-17':5,'NR':3,'UR':3,
  'TV-Y':1,'TV-Y7':1,'TV-G':1,'TV-PG':2,'TV-14':3,'TV-MA':5
};
function tierFor(rating) { return RATING_TIERS[rating] || null; }
function ageToMaxTier(age) {
  if (age == null) return 5;
  if (age < 7) return 1;
  if (age < 10) return 2;
  if (age < 13) return 3;
  if (age < 17) return 4;
  return 5;
}

// ---- Mutable state stub (smoke fixtures set state.kidMode + selectedMoods + members per scenario) ----
const state = { kidMode: false, selectedMoods: [], members: [] };
function getEffectiveTierCap() { return state.kidMode ? 2 : null; }

// ---- Mirror of diagnoseEmptyMatches (must match js/app.js declaration) ----
function diagnoseEmptyMatches(titles, couchMemberIds) {
  if (!Array.isArray(titles) || titles.length === 0) {
    return { headline: 'No titles yet', reasons: [] };
  }
  if (!Array.isArray(couchMemberIds) || couchMemberIds.length === 0) {
    return { headline: 'No one’s on the couch.', reasons: [] };
  }
  const vetoesByMember = {};
  let vetoedTotal = 0;
  let kidModeFilteredCount = 0;
  let tierFilteredCount = 0;
  let moodFilteredCount = 0;
  let providerUnavailableCount = 0;
  let yesVotedAny = false;
  let countedTotal = 0;
  const kidCap = getEffectiveTierCap();
  const selectedMoods = Array.isArray(state.selectedMoods) ? state.selectedMoods : [];
  const moodFilterActive = selectedMoods.length > 0;
  const couchServices = new Set();
  let lowestMemberTierCap = null;
  for (const mid of couchMemberIds) {
    const m = state.members.find(x => x.id === mid);
    if (!m) continue;
    if (Array.isArray(m.services)) m.services.forEach(s => couchServices.add(s));
    const memberCap = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age);
    if (memberCap != null && (lowestMemberTierCap == null || memberCap < lowestMemberTierCap)) {
      lowestMemberTierCap = memberCap;
    }
  }
  const hasAnyCouchServices = couchServices.size > 0;
  for (const t of titles) {
    const votes = t.votes || {};
    if (couchMemberIds.some(mid => votes[mid] === 'no' || votes[mid] === 'seen')) continue;
    countedTotal++;
    if (couchMemberIds.some(mid => votes[mid] === 'yes')) yesVotedAny = true;
    const vetoes = t.vetoes || {};
    let titleVetoed = false;
    for (const mid of couchMemberIds) {
      if (vetoes[mid]) { vetoesByMember[mid] = (vetoesByMember[mid] || 0) + 1; titleVetoed = true; }
    }
    if (titleVetoed) { vetoedTotal++; continue; }
    const titleTier = tierFor(t.rating);
    if (lowestMemberTierCap != null && titleTier != null && titleTier > lowestMemberTierCap) {
      tierFilteredCount++; continue;
    }
    if (kidCap != null && titleTier != null && titleTier > kidCap) {
      kidModeFilteredCount++; continue;
    }
    if (moodFilterActive) {
      const titleMoods = Array.isArray(t.moods) ? t.moods : [];
      if (!titleMoods.some(mid => selectedMoods.includes(mid))) {
        moodFilteredCount++; continue;
      }
    }
    if (hasAnyCouchServices) {
      const titleProviders = Array.isArray(t.providers) ? t.providers : [];
      const ok = titleProviders.some(p => {
        const brand = normalizeProviderName(p && p.name);
        return brand && couchServices.has(brand);
      });
      if (!ok) { providerUnavailableCount++; continue; }
    }
  }
  const reasons = [];
  if (vetoedTotal > 0) {
    const vetoers = Object.entries(vetoesByMember).sort((a, b) => b[1] - a[1]);
    if (vetoers.length === 1) {
      const m = state.members.find(x => x.id === vetoers[0][0]);
      const name = m ? m.name : vetoers[0][0];
      reasons.push({ kind: 'veto', count: vetoedTotal, copy: escapeHtml(name) + ' vetoed ' + vetoedTotal });
    } else {
      reasons.push({ kind: 'veto', count: vetoedTotal, copy: vetoedTotal + ' vetoed across the couch' });
    }
  }
  if (kidModeFilteredCount > 0) reasons.push({ kind: 'kidmode', count: kidModeFilteredCount, copy: 'Kid Mode hides ' + kidModeFilteredCount });
  if (tierFilteredCount > 0)    reasons.push({ kind: 'tier',    count: tierFilteredCount,    copy: tierFilteredCount + ' over the rating cap' });
  if (moodFilteredCount > 0)    reasons.push({ kind: 'mood',    count: moodFilteredCount,    copy: 'No matching mood' });
  if (providerUnavailableCount > 0) {
    const topBrands = Array.from(couchServices).slice(0, 3).join(' / ');
    reasons.push({ kind: 'provider', count: providerUnavailableCount, copy: topBrands ? 'Off ' + topBrands : 'No matching service' });
  }
  if (!yesVotedAny && reasons.length === 0) {
    return { headline: 'No one’s said yes to anything yet.', reasons: [] };
  }
  const capped = reasons.slice(0, 3);
  let headline;
  const dominant = capped[0];
  if (!dominant) {
    headline = 'Nothing’s matching tonight.';
  } else if (dominant.kind === 'veto' && capped.length === 1 && Object.keys(vetoesByMember).length === 1) {
    const onlyVetoerId = Object.keys(vetoesByMember)[0];
    const m = state.members.find(x => x.id === onlyVetoerId);
    const name = m ? m.name : onlyVetoerId;
    headline = 'All ' + countedTotal + ' titles are out — ' + escapeHtml(name) + ' vetoed every one of them.';
  } else if (dominant.kind === 'kidmode') {
    headline = 'Kid Mode’s tight tonight — most titles are over the cap.';
  } else if (dominant.kind === 'mood') {
    headline = 'Try unchecking a mood — those filters are tight tonight.';
  } else if (dominant.kind === 'provider') {
    headline = 'Everything’s on services no one subscribes to.';
  } else if (dominant.kind === 'tier') {
    headline = 'Everything’s over the rating cap tonight.';
  } else if (capped.length > 1) {
    headline = 'All ' + countedTotal + ' titles are out — vetoes + filters caught most of them.';
  } else {
    headline = 'Nothing’s matching tonight.';
  }
  return { headline: headline, reasons: capped };
}

// ---- Test harness ----
let passed = 0, failed = 0;
function check(label, actualValue, expected) {
  const actualStr = JSON.stringify(actualValue);
  const expectedStr = JSON.stringify(expected);
  const ok = actualStr === expectedStr;
  if (ok) { passed++; console.log('OK   ' + label); }
  else    { failed++; console.log('FAIL ' + label + '\n     expected: ' + expectedStr + '\n     actual:   ' + actualStr); }
}
function checkPartial(label, actual, predicate) {
  const ok = !!predicate(actual);
  if (ok) { passed++; console.log('OK   ' + label); }
  else    { failed++; console.log('FAIL ' + label + '\n     value:    ' + JSON.stringify(actual)); }
}

// ---- Scenarios ----

console.log('\n-- Scenario A: edge cases (D-11 + D-12) --');
state.members = []; state.kidMode = false; state.selectedMoods = [];
check('A1 empty titles -> "No titles yet" + 0 reasons', diagnoseEmptyMatches([], ['m1']), { headline: 'No titles yet', reasons: [] });
check('A2 empty couch -> "No one’s on the couch." + 0 reasons', diagnoseEmptyMatches([{id:'t1'}], []), { headline: 'No one’s on the couch.', reasons: [] });
check('A3 null titles -> "No titles yet" + 0 reasons', diagnoseEmptyMatches(null, ['m1']), { headline: 'No titles yet', reasons: [] });
check('A4 null couch -> "No one’s on the couch." + 0 reasons', diagnoseEmptyMatches([{id:'t1'}], null), { headline: 'No one’s on the couch.', reasons: [] });

console.log('\n-- Scenario B: vetoes (D-04 priority 1) --');
state.members = [{ id: 'm1', name: 'Nahder' }]; state.kidMode = false; state.selectedMoods = [];
const vetoTitles = [
  { id: 't1', vetoes: { m1: 'Nahder' } },
  { id: 't2', vetoes: { m1: 'Nahder' } },
  { id: 't3', vetoes: { m1: 'Nahder' } },
  { id: 't4', vetoes: { m1: 'Nahder' } }
];
const r5 = diagnoseEmptyMatches(vetoTitles, ['m1']);
checkPartial('A5 single-vetoer headline names them', r5, x => x.headline === 'All 4 titles are out — Nahder vetoed every one of them.' && x.reasons[0].copy === 'Nahder vetoed 4');

state.members = [{ id: 'm1', name: 'Nahder' }, { id: 'm2', name: 'Zoey' }];
const multiVeto = [
  { id: 't1', vetoes: { m1: 'Nahder' } },
  { id: 't2', vetoes: { m2: 'Zoey' } }
];
const r6 = diagnoseEmptyMatches(multiVeto, ['m1', 'm2']);
checkPartial('A6 multi-vetoer chip "N vetoed across the couch"', r6, x => x.reasons[0].copy === '2 vetoed across the couch');

console.log('\n-- Scenario C: kid mode (D-04 priority 2) --');
state.members = [{ id: 'm1', name: 'Parent' }]; state.kidMode = true; state.selectedMoods = [];
const kidTitles = [{ id: 't1', rating: 'R' }, { id: 't2', rating: 'TV-MA' }, { id: 't3', rating: 'PG-13' }];
const r7 = diagnoseEmptyMatches(kidTitles, ['m1']);
checkPartial('A7 kid-mode chip "Kid Mode hides N"', r7, x => x.reasons[0].kind === 'kidmode' && x.reasons[0].copy === 'Kid Mode hides 3' && x.headline === 'Kid Mode’s tight tonight — most titles are over the cap.');

console.log('\n-- Scenario D: per-member tier cap (D-04 priority 3) --');
state.members = [{ id: 'kid', name: 'Zoey', age: 8 }]; state.kidMode = false; state.selectedMoods = [];
const tierTitles = [{ id: 't1', rating: 'R' }, { id: 't2', rating: 'PG-13' }];
const r8 = diagnoseEmptyMatches(tierTitles, ['kid']);
checkPartial('A8 per-member tier-cap chip "N over the rating cap"', r8, x => x.reasons[0].kind === 'tier' && x.reasons[0].copy === '2 over the rating cap');

console.log('\n-- Scenario E: mood filter (D-04 priority 4) --');
state.members = [{ id: 'm1', name: 'Nahder' }]; state.kidMode = false; state.selectedMoods = ['cozy'];
const moodTitles = [{ id: 't1', rating: 'PG', moods: ['action'] }, { id: 't2', rating: 'PG', moods: ['epic'] }];
const r9 = diagnoseEmptyMatches(moodTitles, ['m1']);
checkPartial('A9 mood-filter chip "No matching mood"', r9, x => x.reasons[0].kind === 'mood' && x.reasons[0].copy === 'No matching mood' && x.headline.indexOf('mood') !== -1);

console.log('\n-- Scenario F: provider unavailable (D-04 priority 5) --');
state.members = [{ id: 'm1', name: 'Nahder', services: ['Netflix', 'Hulu'] }]; state.kidMode = false; state.selectedMoods = [];
const provTitles = [{ id: 't1', rating: 'PG', providers: [{ name: 'Max' }] }, { id: 't2', rating: 'PG', providers: [{ name: 'Disney+' }] }];
const r10 = diagnoseEmptyMatches(provTitles, ['m1']);
checkPartial('A10 provider-unavailable chip "Off Netflix / Hulu"', r10, x => x.reasons[0].kind === 'provider' && x.reasons[0].copy === 'Off Netflix / Hulu' && x.headline === 'Everything’s on services no one subscribes to.');

console.log('\n-- Scenario G: no yes-votes (D-04 priority 6) --');
state.members = [{ id: 'm1', name: 'Nahder', services: ['Netflix'] }]; state.kidMode = false; state.selectedMoods = [];
const noYesTitles = [{ id: 't1', rating: 'PG', providers: [{ name: 'Netflix' }], votes: {} }];
const r11 = diagnoseEmptyMatches(noYesTitles, ['m1']);
check('A11 no-yes -> "No one’s said yes to anything yet." + 0 reasons', r11, { headline: 'No one’s said yes to anything yet.', reasons: [] });

console.log('\n-- Scenario H: mixed-cause priority + cap (D-08) --');
state.members = [{ id: 'm1', name: 'Parent' }]; state.kidMode = true; state.selectedMoods = ['cozy'];
const mixedTitles = [
  { id: 't1', rating: 'R', vetoes: { m1: 'Parent' } },         // veto wins (priority 1)
  { id: 't2', rating: 'R' },                                    // kid-mode (priority 2)
  { id: 't3', rating: 'PG', moods: ['action'] }                 // mood (priority 4)
];
const r12 = diagnoseEmptyMatches(mixedTitles, ['m1']);
checkPartial('A12 mixed cause: veto chip first, kidmode second, mood third (priority order)', r12, x => x.reasons.length === 3 && x.reasons[0].kind === 'veto' && x.reasons[1].kind === 'kidmode' && x.reasons[2].kind === 'mood');

state.members = [{ id: 'm1', name: 'Parent', services: ['Netflix'] }, { id: 'kid', name: 'Zoey', age: 8 }];
state.kidMode = true; state.selectedMoods = ['cozy'];
const allReasonsTitles = [
  { id: 't1', rating: 'PG', vetoes: { m1: 'Parent' } },
  { id: 't2', rating: 'R' },                                                        // tier first (per-member kid age 8 -> max 2; R is 4 > 2)
  { id: 't3', rating: 'PG', moods: ['action'] },
  { id: 't4', rating: 'PG', moods: ['cozy'], providers: [{ name: 'Max' }] }
];
const r13 = diagnoseEmptyMatches(allReasonsTitles, ['m1', 'kid']);
checkPartial('A13 cap at 3 chips when 4+ reasons trigger', r13, x => x.reasons.length === 3);

console.log('\n-- Scenario I: input immutability (D-03 purity) --');
state.members = [{ id: 'm1', name: 'Nahder' }]; state.kidMode = false; state.selectedMoods = [];
const inputTitles = [{ id: 't1', rating: 'PG', vetoes: { m1: 'Nahder' } }];
const inputCouch = ['m1'];
const beforeT = JSON.stringify(inputTitles);
const beforeC = JSON.stringify(inputCouch);
diagnoseEmptyMatches(inputTitles, inputCouch);
const afterT = JSON.stringify(inputTitles);
const afterC = JSON.stringify(inputCouch);
checkPartial('A14 helper does not mutate input arrays', null, () => beforeT === afterT && beforeC === afterC);

// ---- Results ----
console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) { console.log('SOME TESTS FAILED'); process.exit(1); }
console.log('All tests passed');
process.exit(0);
