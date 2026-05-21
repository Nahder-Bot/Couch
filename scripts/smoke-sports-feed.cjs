// Phase 22 — smoke test for sports-feed abstraction (TheSportsDB + BALLDONTLIE).
// Run: node scripts/smoke-sports-feed.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the contract for js/sports-feed.js. Self-contained mirror of the league
// catalog + normalizer (no js/ requires; ES module CJS-incompat per smoke pattern).
//
// Source contract (must match js/sports-feed.js):
//   - LEAGUES contains 16 keys (4 US-major + 2 college + 7 soccer + 1 WNBA + F1 + UFC)
//   - Each league has id, label, sportName, emoji, source
//   - normalizeTsdEvent maps TheSportsDB event JSON to canonical Game shape
//   - state detection: live / final / scheduled flags from strStatus

'use strict';

// ---- Inline mirror of LEAGUES catalog (must match sports-feed.js) ----
const LEAGUES = {
  nba:        { id: 4387, label: 'NBA',                          sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  nfl:        { id: 4391, label: 'NFL',                          sportName: 'American Football',  emoji: '\u{1F3C8}', source: 'tsd' },
  mlb:        { id: 4424, label: 'MLB',                          sportName: 'Baseball',           emoji: '⚾',     source: 'tsd' },
  nhl:        { id: 4380, label: 'NHL',                          sportName: 'Ice Hockey',         emoji: '\u{1F3D2}', source: 'tsd' },
  wnba:       { id: 4516, label: 'WNBA',                         sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  ncaaf:      { id: 4479, label: 'NCAAF',                        sportName: 'American Football',  emoji: '\u{1F3C8}', source: 'tsd' },
  ncaab:      { id: 4607, label: 'NCAAB',                        sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  epl:        { id: 4328, label: 'English Premier League',       sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  laliga:     { id: 4335, label: 'Spanish La Liga',              sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  bundesliga: { id: 4331, label: 'German Bundesliga',            sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  seriea:     { id: 4332, label: 'Italian Serie A',              sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  ligue1:     { id: 4334, label: 'French Ligue 1',               sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  ucl:        { id: 4480, label: 'UEFA Champions League',        sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  mls:        { id: 4346, label: 'American Major League Soccer', sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  f1:         { id: 4370, label: 'Formula 1',                    sportName: 'Motorsport',         emoji: '\u{1F3CE}', source: 'tsd' },
  ufc:        { id: 4443, label: 'UFC',                          sportName: 'Fighting',           emoji: '\u{1F94A}', source: 'tsd' }
};

// ---- Mirror of normalizeTsdEvent (must match sports-feed.js) ----
function normalizeTsdEvent(ev, leagueKey) {
  if (!ev) return null;
  const startMs = ev.strTimestamp ? Date.parse(ev.strTimestamp) : null;
  const stateRaw = (ev.strStatus || '').toLowerCase().trim();
  let isLive = false, isFinal = false, isScheduled = true;
  if (stateRaw.indexOf('progress') !== -1 || stateRaw.indexOf('live') !== -1 || stateRaw === 'in play' || stateRaw === '1h' || stateRaw === '2h' || stateRaw === 'ht') {
    isLive = true; isScheduled = false;
  }
  if (stateRaw.indexOf('finished') !== -1 || stateRaw === 'ft' || stateRaw === 'aet' || stateRaw === 'pen' || stateRaw === 'match finished' || stateRaw.indexOf('final') !== -1) {
    isFinal = true; isScheduled = false;
  }
  return {
    id: ev.idEvent || '',
    league: leagueKey,
    source: 'tsd',
    shortName: ev.strEvent || '',
    startTime: startMs,
    homeTeam: ev.strHomeTeam || 'TBD',
    homeAbbrev: ev.strHomeTeamShort || '',
    homeLogo: ev.strHomeTeamBadge || '',
    homeScore: ev.intHomeScore != null && ev.intHomeScore !== '' ? parseInt(ev.intHomeScore, 10) : null,
    awayTeam: ev.strAwayTeam || 'TBD',
    awayAbbrev: ev.strAwayTeamShort || '',
    awayLogo: ev.strAwayTeamBadge || '',
    awayScore: ev.intAwayScore != null && ev.intAwayScore !== '' ? parseInt(ev.intAwayScore, 10) : null,
    venue: ev.strVenue || null,
    broadcast: ev.strTVStation || null,
    statusName: stateRaw,
    statusDetail: ev.strStatus || '',
    isFinal: isFinal,
    isLive: isLive,
    isScheduled: isScheduled,
    // Phase 28 — additive: surface strSeason for pick'em D-11 season tagging.
    // Falls back to calendar year from startMs if TheSportsDB returns null/empty.
    season: ev.strSeason || (startMs ? String(new Date(startMs).getFullYear()) : 'unknown'),
    // Phase 28 — soccer domestic matchday round (intRound); null for non-soccer leagues.
    round: ev.intRound ? String(ev.intRound) : null,
    // Phase 28 — UCL stage label (strStage); null for non-UCL leagues.
    stage: ev.strStage || null
  };
}

// ---- Test harness ----
let passed = 0, failed = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passed++; console.log('OK   ' + label); }
  else    { failed++; console.log('FAIL ' + label + '\n     expected: ' + JSON.stringify(expected) + '\n     actual:   ' + JSON.stringify(actual)); }
}
function checkPartial(label, actual, predicate) {
  const ok = !!predicate(actual);
  if (ok) { passed++; console.log('OK   ' + label); }
  else    { failed++; console.log('FAIL ' + label + '\n     value:    ' + JSON.stringify(actual)); }
}

// ---- Scenarios ----

console.log('\n-- Scenario A: League catalog ---');
check('A1 LEAGUES has 16 entries', Object.keys(LEAGUES).length, 16);
check('A2 NBA league id is 4387', LEAGUES.nba.id, 4387);
check('A3 EPL league id is 4328', LEAGUES.epl.id, 4328);
check('A4 F1 league id is 4370', LEAGUES.f1.id, 4370);
check('A5 UFC league id is 4443', LEAGUES.ufc.id, 4443);
checkPartial('A6 every league has source tsd', LEAGUES, x => Object.values(x).every(l => l.source === 'tsd'));
checkPartial('A7 every league has label + emoji + sportName', LEAGUES, x => Object.values(x).every(l => l.label && l.emoji && l.sportName));
checkPartial('A8 7 soccer leagues present', LEAGUES, x => Object.values(x).filter(l => l.sportName === 'Soccer').length === 7);

console.log('\n-- Scenario B: normalizeTsdEvent — basic mapping ---');
const evScheduled = {
  idEvent: '1234567',
  strEvent: 'Lakers vs Celtics',
  strTimestamp: '2026-05-15T19:30:00',
  strHomeTeam: 'Boston Celtics',
  strHomeTeamShort: 'BOS',
  strHomeTeamBadge: 'https://example.com/bos.png',
  strAwayTeam: 'Los Angeles Lakers',
  strAwayTeamShort: 'LAL',
  strAwayTeamBadge: 'https://example.com/lal.png',
  intHomeScore: null,
  intAwayScore: null,
  strVenue: 'TD Garden',
  strTVStation: 'TNT',
  strStatus: 'Not Started'
};
const r1 = normalizeTsdEvent(evScheduled, 'nba');
checkPartial('B1 scheduled event has correct id + teams', r1, x => x.id === '1234567' && x.homeTeam === 'Boston Celtics' && x.awayTeam === 'Los Angeles Lakers');
checkPartial('B2 scheduled event has source tsd + league nba', r1, x => x.source === 'tsd' && x.league === 'nba');
checkPartial('B3 scheduled event has isScheduled=true / isLive=false / isFinal=false', r1, x => x.isScheduled === true && x.isLive === false && x.isFinal === false);
checkPartial('B4 scheduled event has venue + broadcast', r1, x => x.venue === 'TD Garden' && x.broadcast === 'TNT');
checkPartial('B5 scheduled event has null scores', r1, x => x.homeScore === null && x.awayScore === null);

console.log('\n-- Scenario C: normalizeTsdEvent — live state detection ---');
const evLive = Object.assign({}, evScheduled, { strStatus: 'In Progress', intHomeScore: '67', intAwayScore: '64' });
const r2 = normalizeTsdEvent(evLive, 'nba');
checkPartial('C1 live event isLive=true / isScheduled=false', r2, x => x.isLive === true && x.isScheduled === false && x.isFinal === false);
checkPartial('C2 live event scores parsed as integers', r2, x => x.homeScore === 67 && x.awayScore === 64 && typeof x.homeScore === 'number');
const evLiveSoccer = Object.assign({}, evScheduled, { strStatus: '1H', intHomeScore: '1', intAwayScore: '0' });
const r3 = normalizeTsdEvent(evLiveSoccer, 'epl');
checkPartial('C3 soccer 1H status detected as live', r3, x => x.isLive === true);
const evLiveHT = Object.assign({}, evScheduled, { strStatus: 'HT' });
const r4 = normalizeTsdEvent(evLiveHT, 'epl');
checkPartial('C4 soccer HT (halftime) status detected as live', r4, x => x.isLive === true);

console.log('\n-- Scenario D: normalizeTsdEvent — final state detection ---');
const evFinal = Object.assign({}, evScheduled, { strStatus: 'Match Finished', intHomeScore: '102', intAwayScore: '98' });
const r5 = normalizeTsdEvent(evFinal, 'nba');
checkPartial('D1 finished event isFinal=true / isLive=false / isScheduled=false', r5, x => x.isFinal === true && x.isLive === false && x.isScheduled === false);
const evFT = Object.assign({}, evScheduled, { strStatus: 'FT', intHomeScore: '2', intAwayScore: '1' });
const r6 = normalizeTsdEvent(evFT, 'epl');
checkPartial('D2 soccer FT (full time) status detected as final', r6, x => x.isFinal === true);

console.log('\n-- Scenario E: normalizeTsdEvent — edge cases ---');
check('E1 null event returns null', normalizeTsdEvent(null, 'nba'), null);
const evMissingFields = { idEvent: 'x' };
const r7 = normalizeTsdEvent(evMissingFields, 'nba');
checkPartial('E2 minimal event returns valid Game with TBD teams + null startTime', r7, x => x.id === 'x' && x.homeTeam === 'TBD' && x.awayTeam === 'TBD' && x.startTime === null && x.isScheduled === true);
const evEmptyScores = Object.assign({}, evScheduled, { intHomeScore: '', intAwayScore: '' });
const r8 = normalizeTsdEvent(evEmptyScores, 'nba');
checkPartial('E3 empty-string scores treated as null', r8, x => x.homeScore === null && x.awayScore === null);
const evZeroScores = Object.assign({}, evScheduled, { intHomeScore: '0', intAwayScore: '0' });
const r9 = normalizeTsdEvent(evZeroScores, 'nba');
checkPartial('E4 zero scores parsed as 0 (not null) — lockable for "0-0 at the start of game" rendering', r9, x => x.homeScore === 0 && x.awayScore === 0);

console.log('\n-- Scenario F: normalizeTsdEvent — case insensitive status ---');
const evMixedCase = Object.assign({}, evScheduled, { strStatus: 'IN PROGRESS' });
const r10 = normalizeTsdEvent(evMixedCase, 'nba');
checkPartial('F1 uppercase status normalised', r10, x => x.isLive === true);
const evLowerFinal = Object.assign({}, evScheduled, { strStatus: 'final' });
const r11 = normalizeTsdEvent(evLowerFinal, 'nba');
checkPartial('F2 lowercase final detected', r11, x => x.isFinal === true);

console.log('\n-- Scenario G: Phase 28 additive fields season/round/stage (PICK-28-01) ---');
// G1: NBA-style with strSeason populated + intRound + empty strStage
{
  const out = normalizeTsdEvent({
    idEvent: 'g1', strEvent: 'Lakers @ Bucks',
    strHomeTeam: 'Bucks', strAwayTeam: 'Lakers',
    strTimestamp: '2025-11-15T01:00:00+00:00',
    strSeason: '2025-2026', intRound: '8', strStage: ''
  }, 'nba');
  check('G1.1 season populated from strSeason', out.season, '2025-2026');
  check('G1.2 round populated from intRound (string)', out.round, '8');
  check('G1.3 stage null when strStage empty', out.stage, null);
}
// G2: F1 fallback ladder — strSeason null, fall back to calendar year from startMs
{
  const out = normalizeTsdEvent({
    idEvent: 'g2', strEvent: 'Race',
    strTimestamp: '2025-11-15T13:00:00+00:00',
    strSeason: null, intRound: null, strStage: null
  }, 'f1');
  check('G2.1 season fallback to calendar year when strSeason null', out.season, '2025');
  check('G2.2 round null when intRound null', out.round, null);
  check('G2.3 stage null when strStage null', out.stage, null);
}
// G3: UCL with strStage populated
{
  const out = normalizeTsdEvent({
    idEvent: 'g3', strEvent: 'PSG v Real',
    strTimestamp: '2025-11-15T20:00:00+00:00',
    strSeason: '2025-2026', strStage: 'Round of 16 First Leg'
  }, 'ucl');
  check('G3.1 stage populated from strStage for UCL', out.stage, 'Round of 16 First Leg');
}
// G4: No startMs AND no strSeason → 'unknown' (per Pitfall 1 fallback ladder bottom)
{
  const out = normalizeTsdEvent({ idEvent: 'g4', strEvent: 'X', strTimestamp: '' }, 'mlb');
  check('G4.1 season=unknown when no startMs and no strSeason', out.season, 'unknown');
}

// ---- Results ----
console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed ===');
if (failed > 0) { console.log('SOME TESTS FAILED'); process.exit(1); }
console.log('All tests passed');
process.exit(0);
