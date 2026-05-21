// === Phase 28 — Pick'em pure helpers ===
// Pure helpers consumed by js/app.js for the pick'em surface + by gameResultsTick CF
// (re-implementing scorePick verbatim per CJS/ESM boundary).
//
// Exports:
//   slateOf(games, leagueKey, dayWindow)     — group games into a slate per D-05
//   latestGameInSlate(slate)                 — chronologically-last game (tiebreaker designation)
//   scorePick(pick, finalGame)               — settlement scoring (1 or 0 per D-03)
//   validatePickSelection(pick, game)        — schema validator per pickType (write-time guard)
//   summarizeMemberSeason(picks)             — aggregate picks → leaderboard member row
//   compareMembers(a, b)                     — leaderboard rank ordering (OQ-8 tiebreaker)
//   PICK_TYPE_BY_LEAGUE                      — frozen league → pickType map (D-02)
//   PICK_REMINDER_OFFSET_MS                  — T-15min reminder window (D-06)
//
// No top-level side effects (no DOM, no network, no Date.now() at import time).
// Smoke contract: scripts/smoke-pickem.cjs imports this module directly via
// `await import(pathToFileURL(...).href)` — production-module testing per Phase 24
// REVIEWS H2 fix pattern (no inline-copy drift).
//
// Per CONTEXT.md D-02..D-15 + RESEARCH.md OQ-1..8 + PATTERNS.md `js/pickem.js — NEW`.

// ---- Pick'em constants (D-06) ----
// T-15min push reminder window for any pick whose game.startTime is within this
// offset and the member has not submitted. Mirrors Phase 14 NOTIFICATION cadence
// conventions; pickReminderTick CF (Plan 28-04) uses ±1min slop on top of this.
export const PICK_REMINDER_OFFSET_MS = 15 * 60 * 1000;

// ---- pickType → league mapping (D-02) ----
// Frozen at module load time. Covers all 16 leagues from js/sports-feed.js LEAGUES.
//   team_winner            — US major + college (winner-only, no draws)
//   team_winner_or_draw    — domestic soccer + UCL + MLS (3-way: home/away/draw)
//   f1_podium              — Formula 1 (P1/P2/P3 — Pitfall 6: ALL THREE must match)
//   ufc_winner_method      — UFC (winningFighter + method:KO/SUB/DEC)
export const PICK_TYPE_BY_LEAGUE = Object.freeze({
  // US-major + college: winner-only
  nba: 'team_winner', nfl: 'team_winner', mlb: 'team_winner', nhl: 'team_winner',
  wnba: 'team_winner', ncaaf: 'team_winner', ncaab: 'team_winner',
  // Domestic soccer + UCL + MLS: winner or draw
  epl: 'team_winner_or_draw', laliga: 'team_winner_or_draw',
  bundesliga: 'team_winner_or_draw', seriea: 'team_winner_or_draw',
  ligue1: 'team_winner_or_draw', ucl: 'team_winner_or_draw',
  mls: 'team_winner_or_draw',
  // Motorsport: full podium
  f1: 'f1_podium',
  // MMA: winner + method
  ufc: 'ufc_winner_method'
});

// ---- isoDateOf — UTC YYYY-MM-DD from milliseconds ----
// Slate-grouping primitive. Returns '' on falsy input (defensive — never throws).
// Pure; no Date.now() at import time, only at call time when a number is passed.
function isoDateOf(ms) {
  if (!ms) return '';
  const d = new Date(ms);
  return d.getUTCFullYear() + '-' +
    String(d.getUTCMonth() + 1).padStart(2, '0') + '-' +
    String(d.getUTCDate()).padStart(2, '0');
}

// ---- slateOf: group games per league slate-rule (D-05 + RESEARCH OQ-2) ----
// Returns the subset of `games` belonging to the slate identified by `dayWindow`
// (an ISO YYYY-MM-DD UTC date string).
//
// Per-league grouping rules:
//   F1 / UFC                              — same calendar UTC day as dayWindow
//   Soccer (epl/laliga/bundesliga/seriea/
//           ligue1/mls)                   — same `round` value as games on dayWindow
//                                           (fallback to calendar day if `round` absent)
//   UCL                                   — same `stage` value as games on dayWindow
//                                           (fallback to calendar day if `stage` absent)
//   Default (US-major + college: nba/nfl/
//            mlb/nhl/wnba/ncaaf/ncaab)    — same calendar UTC day as dayWindow
//
// Pure; no side effects. Defensive on empty/non-array input → returns [].
export function slateOf(games, leagueKey, dayWindow) {
  if (!Array.isArray(games) || games.length === 0) return [];
  const SOCCER = ['epl', 'laliga', 'bundesliga', 'seriea', 'ligue1', 'mls'];

  if (leagueKey === 'f1' || leagueKey === 'ufc') {
    return games.filter(g => isoDateOf(g.startTime) === dayWindow);
  }
  if (SOCCER.indexOf(leagueKey) !== -1) {
    const dayGames = games.filter(g => isoDateOf(g.startTime) === dayWindow);
    if (dayGames.length === 0) return [];
    const round = dayGames[0].round;
    if (!round) return dayGames;  // fallback — calendar-day grouping when round missing
    return games.filter(g => g.round === round);
  }
  if (leagueKey === 'ucl') {
    const dayGames = games.filter(g => isoDateOf(g.startTime) === dayWindow);
    if (dayGames.length === 0) return [];
    const stage = dayGames[0].stage;
    if (!stage) return dayGames;  // fallback — calendar-day grouping when stage missing
    return games.filter(g => g.stage === stage);
  }
  // Default: NBA / NFL / MLB / NHL / WNBA / NCAAF / NCAAB — calendar-day UTC grouping
  return games.filter(g => isoDateOf(g.startTime) === dayWindow);
}

// ---- latestGameInSlate: chronologically-last game in slate (D-05 tiebreaker designation) ----
// Returns the game with the maximum startTime from the slate. Returns null on
// empty/non-array input. Pure; defensive — never throws.
//
// Used by D-05 to auto-designate ONE tiebreaker game per slate (the latest game
// gets the optional "predict total points" numeric input on its picker card).
export function latestGameInSlate(slate) {
  if (!Array.isArray(slate) || slate.length === 0) return null;
  let latest = slate[0];
  for (let i = 1; i < slate.length; i++) {
    if ((slate[i].startTime || 0) > (latest.startTime || 0)) latest = slate[i];
  }
  return latest;
}

// ---- scorePick: settlement scoring per pickType (D-02 + D-03) ----
// Returns 1 (correct pick, full point awarded) or 0 (incorrect / not yet
// settleable / malformed). Never throws — wrapped in try/catch mirroring the
// js/native-video-player.js seekToBroadcastedTime defensive style.
//
// Safety: ONLY scores when finalGame.state === 'post'. Pending or in-progress
// games return 0 so the leaderboard never reflects unfinished games.
//
// Pitfall 6 closure: f1_podium requires ALL THREE positions to match.
// Partial podium (e.g., 2-of-3 correct) → 0. Full podium → 1.
//
// CF re-implementation: Plan 28-03 gameResultsTick CF copies this logic
// verbatim (CJS/ESM boundary blocks require()-ing this ES module from the CF).
// The smoke contract tests both consumers against the same fixtures.
export function scorePick(pick, finalGame) {
  if (!pick || !finalGame) return 0;
  if (finalGame.state !== 'post') return 0;  // safety: only score finished games
  try {
    const sel = pick.selection || {};
    switch (pick.pickType) {
      case 'team_winner':
        return sel.winningTeam === finalGame.winningTeam ? 1 : 0;
      case 'team_winner_or_draw':
        return sel.result === finalGame.result ? 1 : 0;
      case 'f1_podium':
        // Pitfall 6: ALL three positions must match
        return (sel.p1 === finalGame.p1
          && sel.p2 === finalGame.p2
          && sel.p3 === finalGame.p3) ? 1 : 0;
      case 'ufc_winner_method':
        return (sel.winningFighter === finalGame.winningFighter
          && sel.method === finalGame.method) ? 1 : 0;
      default:
        return 0;
    }
  } catch (e) {
    return 0;  // never throw — return 0 on malformed input
  }
}

// ---- validatePickSelection: schema validator per pickType (write-time guard) ----
// Returns true if `pick.selection` is a well-formed shape for `pick.pickType`,
// false otherwise. Used at write-time on the client to gate submit, and may
// be used by Plan 28-04 Firestore rule denylist for defense-in-depth.
//
// Per-pickType rules:
//   team_winner         — selection.winningTeam ∈ {'home', 'away'}
//   team_winner_or_draw — selection.result ∈ {'home', 'away', 'draw'}
//   f1_podium           — p1/p2/p3 are all non-empty strings AND distinct
//   ufc_winner_method   — winningFighter is non-empty string;
//                         method ∈ {'KO', 'SUB', 'DEC'}
//
// Pure; never throws. The optional `game` argument is reserved for future
// per-game shape checks (e.g., F1 driver allowlist when D-02 surfaces a
// driver-roster); currently unused.
export function validatePickSelection(pick, game) {
  void game;  // reserved for future per-game shape checks
  if (!pick || !pick.pickType || !pick.selection) return false;
  const sel = pick.selection;
  switch (pick.pickType) {
    case 'team_winner':
      return sel.winningTeam === 'home' || sel.winningTeam === 'away';
    case 'team_winner_or_draw':
      return sel.result === 'home' || sel.result === 'away' || sel.result === 'draw';
    case 'f1_podium':
      return typeof sel.p1 === 'string' && typeof sel.p2 === 'string' && typeof sel.p3 === 'string'
        && !!sel.p1 && !!sel.p2 && !!sel.p3
        && sel.p1 !== sel.p2 && sel.p1 !== sel.p3 && sel.p2 !== sel.p3;  // distinct positions
    case 'ufc_winner_method':
      return typeof sel.winningFighter === 'string' && !!sel.winningFighter
        && (sel.method === 'KO' || sel.method === 'SUB' || sel.method === 'DEC');
    default:
      return false;
  }
}

// ---- summarizeMemberSeason: aggregate picks → leaderboard member row (D-03 + Pitfall 7) ----
// Returns:
//   {
//     pointsTotal,           — sum of pointsAwarded across all settled picks
//     picksTotal,            — count of all picks (any state, including pending)
//     picksSettled,          — count of state==='settled' (correct OR incorrect)
//     picksAutoZeroed,       — count of state==='auto_zeroed' (Pitfall 7: NOT
//                              double-counted in picksSettled)
//     tiebreakerDeltaTotal,  — sum of |tiebreakerTotal - tiebreakerActual| over
//                              tiebreaker-game settled picks (lower = better)
//     tiebreakerCount        — count of tiebreaker-game settled picks
//   }
//
// Pure; defensive — non-array input returns the zero-row.
//
// Pitfall 7 closure: auto_zeroed picks contribute to picksTotal + picksAutoZeroed
// but NOT to picksSettled. The leaderboard render uses both counters separately
// so families can see "Mom: 32-19 in submitted picks, 6 missed".
export function summarizeMemberSeason(picks) {
  let pointsTotal = 0;
  let picksTotal = 0;
  let picksSettled = 0;
  let picksAutoZeroed = 0;
  let tiebreakerDeltaTotal = 0;
  let tiebreakerCount = 0;
  if (!Array.isArray(picks)) {
    return {pointsTotal, picksTotal, picksSettled, picksAutoZeroed, tiebreakerDeltaTotal, tiebreakerCount};
  }
  for (let i = 0; i < picks.length; i++) {
    const pick = picks[i];
    if (!pick) continue;
    picksTotal++;
    if (pick.state === 'settled') {
      picksSettled++;
      pointsTotal += (pick.pointsAwarded || 0);
      if (pick.tiebreakerTotal != null && pick.tiebreakerActual != null) {
        tiebreakerDeltaTotal += Math.abs(pick.tiebreakerTotal - pick.tiebreakerActual);
        tiebreakerCount++;
      }
    } else if (pick.state === 'auto_zeroed') {
      picksAutoZeroed++;
    }
    // state === 'pending' → counted only in picksTotal
  }
  return {pointsTotal, picksTotal, picksSettled, picksAutoZeroed, tiebreakerDeltaTotal, tiebreakerCount};
}

// ---- compareMembers: leaderboard rank ordering (OQ-8 tiebreaker edge cases) ----
// Comparator suitable for Array.prototype.sort. Negative => `a` ranks higher
// (sorts earlier). Positive => `b` ranks higher. Zero => tie stays.
//
// Ordering rules:
//   Primary:   pointsTotal descending — higher points always wins regardless
//              of tiebreaker submission status.
//   Secondary: avgTiebreakerDelta ascending (lower delta = better predictor).
//              Members with tiebreakerCount === 0 get Infinity (lose tied
//              positions to any submitter, per OQ-8 edge case 4).
//              Both Infinity → tie stays (OQ-8 edge case 2).
//   Tertiary:  tie stays (T-1st, T-2nd) — no further tiebreaker per D-05.
//
// Pure; defensive on missing fields (treats undefined as 0 / Infinity).
export function compareMembers(a, b) {
  // Primary: pointsTotal descending
  const aPts = a.pointsTotal || 0;
  const bPts = b.pointsTotal || 0;
  if (bPts !== aPts) return bPts - aPts;

  // Secondary: avgTiebreakerDelta ascending; non-submitters get Infinity.
  const aCount = a.tiebreakerCount || 0;
  const bCount = b.tiebreakerCount || 0;
  const avgA = aCount > 0 ? (a.tiebreakerDeltaTotal || 0) / aCount : Infinity;
  const avgB = bCount > 0 ? (b.tiebreakerDeltaTotal || 0) / bCount : Infinity;
  if (avgA !== avgB) {
    // Both Infinity (covered by avgA===avgB above) → falls through to 0.
    return avgA - avgB;
  }

  // Tertiary: tie stays per D-05 (T-1st, T-2nd render as ties).
  return 0;
}
