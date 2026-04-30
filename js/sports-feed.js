// === Phase 22 — Sports data abstraction ===
// Replaces ESPN hidden API (ToS-gray per Phase 11 RESEARCH §4 — App Store §2.3 + 5.1.5
// reject apps using undocumented APIs) with legitimate sources:
//
//   - TheSportsDB (free tier API key '1' for v1; Patreon $14/yr unlocks live data
//     and faster updates — bump TSD_API_KEY when subscribed)
//   - BALLDONTLIE NBA-only supplement for realtime NBA scores (post-launch)
//
// Exports:
//   LEAGUES               — catalog of supported leagues (15+ globally)
//   fetchSchedule(key,d)  — next N days of games for a league
//   fetchScore(id,key)    — live score for a single game (15s cached bucket)
//   leagueLabel(key)      — human-readable league name
//   leagueEmoji(key)      — sport emoji for UI chips
//
// Cache strategy (matches Phase 7+ ESPN cache pattern):
//   - schedule cache: 5min TTL per (league, daysAhead)
//   - score cache: 15s bucket per gameId (100 viewers of same game = 1 fetch / 15s)

const TSD_API_KEY = '1'; // free test key — bump to Patreon key when $14/yr sub active
const TSD_BASE = 'https://www.thesportsdb.com/api/v1/json/' + TSD_API_KEY + '/';

// League catalog. TheSportsDB league IDs verified via all_leagues.php endpoint.
// Add new leagues here — UI picker auto-discovers from this map.
export const LEAGUES = {
  // === US major leagues ===
  nba:        { id: 4387, label: 'NBA',                sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  nfl:        { id: 4391, label: 'NFL',                sportName: 'American Football',  emoji: '\u{1F3C8}', source: 'tsd' },
  mlb:        { id: 4424, label: 'MLB',                sportName: 'Baseball',           emoji: '⚾',     source: 'tsd' },
  nhl:        { id: 4380, label: 'NHL',                sportName: 'Ice Hockey',         emoji: '\u{1F3D2}', source: 'tsd' },
  wnba:       { id: 4516, label: 'WNBA',               sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  // === College ===
  ncaaf:      { id: 4479, label: 'NCAAF',              sportName: 'American Football',  emoji: '\u{1F3C8}', source: 'tsd' },
  ncaab:      { id: 4607, label: 'NCAAB',              sportName: 'Basketball',         emoji: '\u{1F3C0}', source: 'tsd' },
  // === Global soccer ===
  epl:        { id: 4328, label: 'English Premier League', sportName: 'Soccer',         emoji: '⚽',     source: 'tsd' },
  laliga:     { id: 4335, label: 'Spanish La Liga',    sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  bundesliga: { id: 4331, label: 'German Bundesliga',  sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  seriea:     { id: 4332, label: 'Italian Serie A',    sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  ligue1:     { id: 4334, label: 'French Ligue 1',     sportName: 'Soccer',             emoji: '⚽',     source: 'tsd' },
  ucl:        { id: 4480, label: 'UEFA Champions League', sportName: 'Soccer',          emoji: '⚽',     source: 'tsd' },
  mls:        { id: 4346, label: 'American Major League Soccer', sportName: 'Soccer',   emoji: '⚽',     source: 'tsd' },
  // === Motorsport + fighting ===
  f1:         { id: 4370, label: 'Formula 1',          sportName: 'Motorsport',         emoji: '\u{1F3CE}', source: 'tsd' },
  ufc:        { id: 4443, label: 'UFC',                sportName: 'Fighting',           emoji: '\u{1F94A}', source: 'tsd' }
};

// In-memory caches (per page load — service worker layer handles HTTP-level caching too)
const scheduleCache = {};
const scoreCache = {};
const SCHEDULE_TTL_MS = 5 * 60 * 1000;
const SCORE_BUCKET_MS = 15 * 1000;

function bucketKey(id, bucketMs) {
  return id + '-' + Math.floor(Date.now() / bucketMs);
}

// Format a Date as YYYY-MM-DD for TheSportsDB eventsday.php
function isoDate(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// Normalize a TheSportsDB event into Couch's canonical Game shape.
// Compatible with parseEspnEvent shape so existing UI render code works unchanged.
export function normalizeTsdEvent(ev, leagueKey) {
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
    isScheduled: isScheduled
  };
}

// Fetch the next N days of schedule for a league.
// Returns array of normalized Game objects sorted by startTime ascending.
// daysAhead defaults to 7 (matches existing ESPN behavior).
export async function fetchSchedule(leagueKey, daysAhead) {
  if (typeof daysAhead !== 'number') daysAhead = 7;
  const league = LEAGUES[leagueKey];
  if (!league) return [];
  const cacheKey = leagueKey + '-' + daysAhead;
  const cached = scheduleCache[cacheKey];
  if (cached && Date.now() - cached.fetchedAt < SCHEDULE_TTL_MS) {
    return cached.games;
  }
  if (league.source === 'tsd') {
    const today = new Date();
    const fetches = [];
    for (let i = 0; i < daysAhead; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const url = TSD_BASE + 'eventsday.php?d=' + isoDate(d) + '&l=' + encodeURIComponent(league.label);
      fetches.push(fetch(url).then(function(r) { return r.json(); }).catch(function() { return null; }));
    }
    const results = await Promise.all(fetches);
    const games = [];
    results.forEach(function(data) {
      if (data && Array.isArray(data.events)) {
        data.events.forEach(function(ev) {
          const g = normalizeTsdEvent(ev, leagueKey);
          if (g) games.push(g);
        });
      }
    });
    games.sort(function(a, b) { return (a.startTime || 0) - (b.startTime || 0); });
    scheduleCache[cacheKey] = { fetchedAt: Date.now(), games: games };
    return games;
  }
  return [];
}

// Fetch live score for a single game. Cached per 15s bucket so 100 simultaneous
// viewers of the same game = 1 fetch / 15s.
// Returns Score object or null. Score shape is compatible with the existing
// SportsDataProvider.getScore contract used by watchparty live tick.
export async function fetchScore(gameId, leagueKey) {
  const key = bucketKey(gameId, SCORE_BUCKET_MS);
  if (scoreCache[key]) return scoreCache[key];
  const league = LEAGUES[leagueKey];
  if (!league) return null;
  if (league.source === 'tsd') {
    try {
      const url = TSD_BASE + 'lookupevent.php?id=' + encodeURIComponent(gameId);
      const r = await fetch(url);
      const d = await r.json();
      const ev = (d && Array.isArray(d.events) && d.events[0]) || null;
      const g = normalizeTsdEvent(ev, leagueKey);
      if (g) {
        const score = {
          gameId: gameId,
          homeScore: g.homeScore != null ? g.homeScore : 0,
          awayScore: g.awayScore != null ? g.awayScore : 0,
          homeAbbr: g.homeAbbrev,
          awayAbbr: g.awayAbbrev,
          homeTeam: g.homeTeam,
          awayTeam: g.awayTeam,
          period: 0,
          clock: '',
          state: g.isLive ? 'in' : (g.isFinal ? 'post' : 'pre'),
          statusDetail: g.statusDetail,
          ts: Date.now()
        };
        scoreCache[key] = score;
        return score;
      }
    } catch(e) {
      return null;
    }
  }
  return null;
}

// === League catalog accessors ===
export function leagueLabel(leagueKey) {
  return (LEAGUES[leagueKey] && LEAGUES[leagueKey].label) || (leagueKey || '').toUpperCase();
}
export function leagueEmoji(leagueKey) {
  return (LEAGUES[leagueKey] && LEAGUES[leagueKey].emoji) || '\u{1F3AE}';
}

// List all league keys ordered by US-major → college → soccer → other.
// UI picker uses this to render tabs in a sensible order.
export function leagueKeys() {
  return ['nba','nfl','mlb','nhl','wnba','ncaaf','ncaab','epl','laliga','bundesliga','seriea','ligue1','ucl','mls','f1','ufc'];
}
