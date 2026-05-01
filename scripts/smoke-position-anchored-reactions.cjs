'use strict';
// Phase 26 — Position-anchored reactions + async-replay smoke contract.
// Pattern follows scripts/smoke-native-video-player.cjs (dynamic import for the one
// helper module STALE_BROADCAST_MAX_MS) + scripts/smoke-decision-explanation.cjs
// (inline mirror for the helpers that live inside js/app.js as ES module).
//
// INCREMENTAL: Plan 01 ships ~18 assertions; Plans 02-05 each append their own
// (target ≥25 total per UI-SPEC §7 floor of 13 + researcher recommendation ≥25).

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let fails = 0;
let total = 0;

function pass(label) { console.log('OK   ' + label); total++; }
function failMsg(label, msg) { console.error('FAIL ' + label + ': ' + msg); fails++; total++; }
function eq(label, got, want) {
  if (got === want) pass(label);
  else failMsg(label, 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}
function within(label, got, target, tol) {
  if (typeof got === 'number' && Math.abs(got - target) <= tol) pass(label);
  else failMsg(label, 'got ' + got + ' not within ±' + tol + ' of ' + target);
}
function truthy(label, got) {
  if (got) pass(label);
  else failMsg(label, 'got falsy: ' + JSON.stringify(got));
}
function falsy(label, got) {
  if (!got) pass(label);
  else failMsg(label, 'got truthy: ' + JSON.stringify(got));
}
function deep(label, got, want) {
  if (JSON.stringify(got) === JSON.stringify(want)) pass(label);
  else failMsg(label, 'got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
}
function contains(label, hay, needle) {
  if (String(hay).indexOf(needle) !== -1) pass(label);
  else failMsg(label, 'haystack does not contain "' + needle + '"');
}
function notContains(label, hay, needle) {
  if (String(hay).indexOf(needle) === -1) pass(label);
  else failMsg(label, 'haystack unexpectedly contains "' + needle + '"');
}

(async () => {
  // ---- Import STALE_BROADCAST_MAX_MS from the Phase 24 ES module (D-02 dependency) ----
  const moduleUrl = pathToFileURL(path.resolve(__dirname, '..', 'js/native-video-player.js')).href;
  const m = await import(moduleUrl);
  const STALE_BROADCAST_MAX_MS = m.STALE_BROADCAST_MAX_MS;
  eq('STALE_BROADCAST_MAX_MS exported from js/native-video-player.js', typeof STALE_BROADCAST_MAX_MS, 'number');
  truthy('STALE_BROADCAST_MAX_MS is positive finite', STALE_BROADCAST_MAX_MS > 0 && isFinite(STALE_BROADCAST_MAX_MS));

  // ---- Inline mirror of derivePositionForReaction (must match js/app.js verbatim) ----
  // If you edit the body in js/app.js, edit it here too. The production-code sentinels
  // below catch divergence at the regex level; this inline mirror catches behavior drift.
  function derivePositionForReaction(ctx) {
    const wp = ctx && ctx.wp ? ctx.wp : {};
    if (ctx && ctx.isReplay === true) {
      const pos = (typeof ctx.localReplayPositionMs === 'number' && isFinite(ctx.localReplayPositionMs))
        ? Math.max(0, Math.round(ctx.localReplayPositionMs))
        : 0;
      return { runtimePositionMs: pos, runtimeSource: 'replay' };
    }
    if (wp.isLiveStream === true) {
      return { runtimePositionMs: null, runtimeSource: 'live-stream' };
    }
    const ct = (typeof wp.currentTimeMs === 'number' && isFinite(wp.currentTimeMs)) ? wp.currentTimeMs : null;
    const ctUpdatedAt = (typeof wp.currentTimeUpdatedAt === 'number' && isFinite(wp.currentTimeUpdatedAt))
      ? wp.currentTimeUpdatedAt : null;
    if (ct !== null && ctUpdatedAt !== null) {
      const sinceUpdate = Date.now() - ctUpdatedAt;
      if (sinceUpdate >= 0 && sinceUpdate < STALE_BROADCAST_MAX_MS) {
        return {
          runtimePositionMs: Math.max(0, Math.round(ct + sinceUpdate)),
          runtimeSource: 'broadcast'
        };
      }
    }
    const elapsed = (ctx && typeof ctx.elapsedMs === 'number' && isFinite(ctx.elapsedMs)) ? ctx.elapsedMs : 0;
    return { runtimePositionMs: Math.max(0, Math.round(elapsed)), runtimeSource: 'elapsed' };
  }

  // ---- Inline mirror of replayableReactionCount ----
  function replayableReactionCount(wp) {
    if (!wp || !Array.isArray(wp.reactions)) return 0;
    return wp.reactions.filter(r =>
      r.runtimePositionMs != null && r.runtimeSource !== 'live-stream'
    ).length;
  }

  // ---- Plan 02 — Inline mirror of getScrubberDurationMs (must match js/app.js verbatim) ----
  // Smoke uses an injectable `state` arg since the helper reads global state.titles in production.
  function getScrubberDurationMs_smoke(wp, fakeState) {
    const t = fakeState && fakeState.titles && fakeState.titles.find(x => x.id === wp.titleId);
    if (t) {
      if (typeof t.runtime === 'number' && t.runtime > 0) return t.runtime * 60 * 1000;
      if (typeof t.episode_run_time === 'number' && t.episode_run_time > 0) return t.episode_run_time * 60 * 1000;
    }
    if (typeof wp.durationMs === 'number' && wp.durationMs > 0) return wp.durationMs;
    const positions = (wp.reactions || [])
      .map(r => r.runtimePositionMs)
      .filter(p => typeof p === 'number' && p > 0);
    if (positions.length > 0) return Math.max(...positions) + 30000;
    return 60 * 60 * 1000;
  }

  // ===== Helper-behavior assertions (RPLY-26-01, 02, 03, 06, 10) =====

  // RPLY-26-01 case 1: live-stream branch
  deep('derivePositionForReaction live-stream branch (D-03)',
    derivePositionForReaction({ wp: { isLiveStream: true } }),
    { runtimePositionMs: null, runtimeSource: 'live-stream' });

  // RPLY-26-01 case 2: fresh-broadcast branch
  const freshResult = derivePositionForReaction({
    wp: { currentTimeMs: 1500000, currentTimeUpdatedAt: Date.now() - 1000, isLiveStream: false }
  });
  eq('derivePositionForReaction fresh-broadcast runtimeSource', freshResult.runtimeSource, 'broadcast');
  within('derivePositionForReaction fresh-broadcast runtimePositionMs (~1501000 ±200)', freshResult.runtimePositionMs, 1501000, 200);

  // RPLY-26-01 case 3: stale-broadcast → elapsed fallback (D-02)
  deep('derivePositionForReaction stale-broadcast → elapsed fallback (D-02)',
    derivePositionForReaction({
      wp: { currentTimeMs: 1500000, currentTimeUpdatedAt: Date.now() - (STALE_BROADCAST_MAX_MS + 1000), isLiveStream: false },
      elapsedMs: 60000
    }),
    { runtimePositionMs: 60000, runtimeSource: 'elapsed' });

  // RPLY-26-01 case 4: no-broadcast → elapsed fallback
  deep('derivePositionForReaction no-broadcast → elapsed fallback',
    derivePositionForReaction({ wp: {}, elapsedMs: 30000 }),
    { runtimePositionMs: 30000, runtimeSource: 'elapsed' });

  // RPLY-26-01 case 5: replay-mode override (D-05) — branch 1 highest priority
  deep('derivePositionForReaction replay-mode override (D-05)',
    derivePositionForReaction({ wp: {}, isReplay: true, localReplayPositionMs: 750000 }),
    { runtimePositionMs: 750000, runtimeSource: 'replay' });

  // Defensive default (RESEARCH Assumption A11): isReplay=true with no localReplayPositionMs → 0
  deep('derivePositionForReaction replay-mode defensive 0 default (A11)',
    derivePositionForReaction({ wp: {}, isReplay: true }),
    { runtimePositionMs: 0, runtimeSource: 'replay' });

  // RPLY-26-10 — replayableReactionCount predicate
  eq('replayableReactionCount empty/no-reactions returns 0',
    replayableReactionCount({}), 0);
  eq('replayableReactionCount live-stream-only returns 0',
    replayableReactionCount({ reactions: [{ runtimePositionMs: null, runtimeSource: 'live-stream' }] }), 0);
  eq('replayableReactionCount mixed (broadcast+elapsed+live-stream+pre-Phase-26) returns 2',
    replayableReactionCount({ reactions: [
      { runtimePositionMs: 1000, runtimeSource: 'broadcast' },
      { runtimePositionMs: 2000, runtimeSource: 'elapsed' },
      { runtimePositionMs: null, runtimeSource: 'live-stream' },
      { /* pre-Phase-26: no runtime fields */ }
    ] }), 2);
  eq('replayableReactionCount accepts replay-sourced reactions (D-05)',
    replayableReactionCount({ reactions: [{ runtimePositionMs: 5000, runtimeSource: 'replay' }] }), 1);

  // ===== Plan 02 helper-behavior assertions (RPLY-26-05 — getScrubberDurationMs precedence) =====
  eq('getScrubberDurationMs movie t.runtime -> 142x60x1000',
    getScrubberDurationMs_smoke({ titleId: 'm1' }, { titles: [{ id: 'm1', runtime: 142 }] }), 8520000);
  eq('getScrubberDurationMs TV t.episode_run_time -> 30x60x1000',
    getScrubberDurationMs_smoke({ titleId: 't1' }, { titles: [{ id: 't1', episode_run_time: 30 }] }), 1800000);
  eq('getScrubberDurationMs falls back to wp.durationMs when no title match',
    getScrubberDurationMs_smoke({ titleId: 'unknown', durationMs: 7200000 }, { titles: [] }), 7200000);
  eq('getScrubberDurationMs falls back to max observed + 30s cushion',
    getScrubberDurationMs_smoke({ titleId: 'x', reactions: [{ runtimePositionMs: 1500000 }] }, { titles: [] }), 1530000);
  eq('getScrubberDurationMs final 60-min floor when nothing else available',
    getScrubberDurationMs_smoke({}, { titles: [] }), 3600000);

  // ===== Production-code sentinels (read js/app.js + js/state.js + firestore.rules) =====
  let appJs = '';
  try {
    appJs = fs.readFileSync(path.resolve(__dirname, '..', 'js/app.js'), 'utf8');
  } catch (e) {
    failMsg('read js/app.js for production sentinels', e.message);
  }

  let stateJs = '';
  try {
    stateJs = fs.readFileSync(path.resolve(__dirname, '..', 'js/state.js'), 'utf8');
  } catch (e) {
    failMsg('read js/state.js for state-slot sentinels', e.message);
  }

  if (appJs) {
    // RPLY-26-02: STALE_BROADCAST_MAX_MS imported from js/native-video-player.js
    truthy('js/app.js imports STALE_BROADCAST_MAX_MS from native-video-player.js (RPLY-26-02)',
      /STALE_BROADCAST_MAX_MS[^;]*from\s*['"]\.\/native-video-player\.js['"]/.test(appJs));

    // RPLY-26-03: all 4 enum values appear as literals
    contains('js/app.js contains runtimeSource literal "broadcast" (RPLY-26-03)', appJs, "runtimeSource: 'broadcast'");
    contains('js/app.js contains runtimeSource literal "elapsed" (RPLY-26-03)', appJs, "runtimeSource: 'elapsed'");
    contains('js/app.js contains runtimeSource literal "live-stream" (RPLY-26-03)', appJs, "runtimeSource: 'live-stream'");
    contains('js/app.js contains runtimeSource literal "replay" (RPLY-26-03 + RPLY-26-07)', appJs, "runtimeSource: 'replay'");

    // RPLY-26-10: replayableReactionCount helper present
    truthy('js/app.js declares function replayableReactionCount (RPLY-26-10)',
      /function\s+replayableReactionCount\s*\(/.test(appJs));

    // RPLY-26-01: derivePositionForReaction helper present
    truthy('js/app.js declares function derivePositionForReaction (RPLY-26-01)',
      /function\s+derivePositionForReaction\s*\(/.test(appJs));

    // RPLY-26-07: postReaction integration site has the literal field keys
    const postReactionIdx = appJs.indexOf('async function postReaction');
    truthy('js/app.js has postReaction definition', postReactionIdx > -1);
    if (postReactionIdx > -1) {
      const postSection = appJs.slice(postReactionIdx, postReactionIdx + 1500);
      contains('postReaction body contains runtimePositionMs literal key', postSection, 'runtimePositionMs');
      contains('postReaction body contains runtimeSource literal key', postSection, 'runtimeSource');
      truthy('postReaction body invokes derivePositionForReaction (RPLY-26-01 wiring)',
        /derivePositionForReaction\s*\(/.test(postSection));
    }

    // postBurstReaction integration site (Phase 23 sports — also wired per Pattern 1 note)
    const postBurstIdx = appJs.indexOf('window.postBurstReaction');
    truthy('js/app.js has window.postBurstReaction definition', postBurstIdx > -1);
    if (postBurstIdx > -1) {
      const burstSection = appJs.slice(postBurstIdx, postBurstIdx + 1500);
      contains('postBurstReaction body contains runtimePositionMs literal key', burstSection, 'runtimePositionMs');
      contains('postBurstReaction body contains runtimeSource literal key', burstSection, 'runtimeSource');
      truthy('postBurstReaction body invokes derivePositionForReaction (RPLY-26-01 wiring)',
        /derivePositionForReaction\s*\(/.test(burstSection));
    }

    // ===== Plan 02 production-code sentinels =====

    // RPLY-26-04: replay-variant gating literals appear in renderWatchpartyLive context
    const renderIdx = appJs.indexOf('function renderWatchpartyLive');
    truthy('js/app.js has renderWatchpartyLive declaration', renderIdx > -1);
    if (renderIdx > -1) {
      const renderSection = appJs.slice(renderIdx, renderIdx + 6000);
      truthy('renderWatchpartyLive contains isReplay flag (RPLY-26-04 part 1)',
        /const\s+isReplay\s*=\s*state\.activeWatchpartyMode\s*===\s*['"]revisit['"]/.test(renderSection));
      truthy('renderWatchpartyLive contains wp.status === "archived" eligibility gate (RPLY-26-04 part 2)',
        /wp\.status\s*===\s*['"]archived['"]/.test(renderSection));
    }

    // RPLY-26-13 part 2: openWatchpartyLive assigns activeWatchpartyMode
    const openIdx = appJs.indexOf('window.openWatchpartyLive');
    truthy('js/app.js has window.openWatchpartyLive', openIdx > -1);
    if (openIdx > -1) {
      const openSection = appJs.slice(openIdx, openIdx + 800);
      truthy('openWatchpartyLive assigns state.activeWatchpartyMode (RPLY-26-13 part 2)',
        /state\.activeWatchpartyMode\s*=\s*\(opts\s*&&\s*opts\.mode\s*===\s*['"]revisit['"]\)/.test(openSection));
    }

    // RPLY-26-13 part 3: closeWatchpartyLive clears activeWatchpartyMode
    const closeIdx = appJs.indexOf('window.closeWatchpartyLive');
    truthy('js/app.js has window.closeWatchpartyLive', closeIdx > -1);
    if (closeIdx > -1) {
      const closeSection = appJs.slice(closeIdx, closeIdx + 800);
      truthy('closeWatchpartyLive clears state.activeWatchpartyMode (RPLY-26-13 part 3)',
        /state\.activeWatchpartyMode\s*=\s*null/.test(closeSection));
      truthy('closeWatchpartyLive clears state.replayLocalPositionMs (Pitfall 9)',
        /state\.replayLocalPositionMs\s*=\s*null/.test(closeSection));
    }

    // RPLY-26-15: banner copy literals
    contains('js/app.js contains "Revisiting" banner eyebrow source string (RPLY-26-15 part 1)', appJs, "'Revisiting'");
    contains('js/app.js contains "together again" italic-serif sub-line literal (RPLY-26-15 part 2)', appJs, 'together again');

    // RPLY-26-SNAP: scrubber 1-sec snap
    truthy('renderReplayScrubber emits step="1000" (RPLY-26-SNAP)',
      /<input[^>]*step=['"]1000['"]/.test(appJs));
    contains('renderReplayScrubber emits aria-label "Move to where you are in the movie"', appJs, 'Move to where you are in the movie');
    contains('renderReplayScrubber play/pause aria-label "Start watching from here"', appJs, 'Start watching from here');

    // RPLY-26-05 helper present
    truthy('js/app.js declares function getScrubberDurationMs (RPLY-26-05)',
      /function\s+getScrubberDurationMs\s*\(/.test(appJs));
    truthy('js/app.js declares function renderReplayScrubber',
      /function\s+renderReplayScrubber\s*\(/.test(appJs));

    // RPLY-26-16: NO autoplay attribute / playerVars.autoplay outside comments (negative sentinel)
    // Strip /* */ block comments and // line comments before checking.
    const stripped = appJs.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*\n/g, '\n');
    const autoplayHits = stripped.match(/autoplay/gi) || [];
    eq('js/app.js has ZERO autoplay literals outside comments (RPLY-26-16 negative sentinel)', autoplayHits.length, 0);
  }

  // ===== Plan 02 CSS sentinels =====
  let cssApp = '';
  try {
    cssApp = fs.readFileSync(path.resolve(__dirname, '..', 'css/app.css'), 'utf8');
  } catch (e) { failMsg('read css/app.css for Phase 26 CSS sentinels', e.message); }
  if (cssApp) {
    contains('css/app.css contains .wp-replay-scrubber-strip class', cssApp, '.wp-replay-scrubber-strip');
    contains('css/app.css contains .wp-replay-playpause class', cssApp, '.wp-replay-playpause');
    contains('css/app.css contains .wp-replay-scrubber-input class', cssApp, '.wp-replay-scrubber-input');
    contains('css/app.css contains .wp-replay-scrubber-readout class', cssApp, '.wp-replay-scrubber-readout');
    contains('css/app.css contains .wp-live-revisit-subline class', cssApp, '.wp-live-revisit-subline');
  }

  if (stateJs) {
    // RPLY-26-13 (Plan 01 portion): activeWatchpartyMode slot exists in js/state.js
    truthy('js/state.js declares activeWatchpartyMode slot (RPLY-26-13 part 1)',
      /activeWatchpartyMode\s*:\s*null/.test(stateJs));
    truthy('js/state.js declares replayLocalPositionMs slot',
      /replayLocalPositionMs\s*:\s*null/.test(stateJs));
    truthy('js/state.js declares pastPartiesShownCount slot (RPLY-26-PAGE part 1)',
      /pastPartiesShownCount\s*:\s*null/.test(stateJs));
  }

  // RPLY-26-19: firestore.rules — confirm 'reactions' is NOT in the Phase 24 M2 currentTime denylist
  let rules = '';
  try {
    rules = fs.readFileSync(path.resolve(__dirname, '..', 'firestore.rules'), 'utf8');
  } catch (e) { /* optional — report as soft fail */ }
  if (rules) {
    // The denylist appears in an affectedKeys().hasAny([...]) clause inside the wp update Path B.
    // Pull out the bracketed list(s) following hasAny( and confirm 'reactions' (with quotes) is NOT inside.
    const hasAnyMatches = rules.match(/affectedKeys\(\)\.hasAny\(\s*\[[^\]]*\]/g) || [];
    let reactionsInDenylist = false;
    for (const clause of hasAnyMatches) {
      if (/['"]reactions['"]/.test(clause)) { reactionsInDenylist = true; break; }
    }
    falsy('firestore.rules: reactions NOT in wp.update affectedKeys denylist (RPLY-26-19; D-07 single-repo deploy)', reactionsInDenylist);
    // Sanity: at least one currentTime-bearing denylist exists (proves we found Phase 24 M2 block)
    let hasCurrentTimeDenylist = false;
    for (const clause of hasAnyMatches) {
      if (/['"]currentTimeMs['"]/.test(clause)) { hasCurrentTimeDenylist = true; break; }
    }
    truthy('firestore.rules: Phase 24 M2 currentTime denylist still present (sanity for RPLY-26-19)', hasCurrentTimeDenylist);
  }

  // ===== Final report =====
  console.log('---');
  console.log('Total assertions: ' + total + '; Failures: ' + fails);
  // RPLY-26-17 floor — Plan 05 will tighten this to ≥13; Plan 01 reports current count.
  if (fails) {
    console.error('Phase 26 smoke FAILED — see ' + fails + ' assertion failure(s) above.');
    process.exit(1);
  } else {
    console.log('Phase 26 smoke PASSED.');
    process.exit(0);
  }
})().catch(err => {
  console.error('Phase 26 smoke CRASHED:', err);
  process.exit(2);
});
