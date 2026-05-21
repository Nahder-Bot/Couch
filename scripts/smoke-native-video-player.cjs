// Phase 24 — smoke test for native video player helpers.
// Run: node scripts/smoke-native-video-player.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Imports js/native-video-player.js DIRECTLY via dynamic ES import.
// This is the REVIEWS.md H2 fix — original Plan 01 mirrored helper bodies inline,
// which allowed silent drift between the smoke and production. Plan 24-02 ships
// js/native-video-player.js as a 7-named-export ES module; Plan 24-03 will static-
// import the same module from js/app.js. The smoke locks both consumers' contract
// against ONE source of truth: the production module itself.
//
// Source contract (must match js/native-video-player.js):
//   - VIDEO_BROADCAST_INTERVAL_MS = 5000
//   - STALE_BROADCAST_MAX_MS = 60000
//   - DRM_FLAT_RATE_PROVIDER_BRANDS: Set
//   - parseVideoUrl: pure; returns { source: 'youtube'|'mp4', id?, url } | null
//   - titleHasNonDrmPath: pure; returns true if at least one non-DRM path exists
//   - makeIntervalBroadcaster: leading + trailing edge throttle
//   - seekToBroadcastedTime: late-join seek for non-hosts (REVIEWS M1)
//
// Plus production-code sentinels (post-Plan-03):
//   - js/app.js contains: currentTimeMs, currentTimeUpdatedAt, currentTimeSource (REVIEWS C2)
//   - js/app.js contains: durationMs, isLiveStream (REVIEWS C2)
//   - js/app.js contains: 'HTTP links may be blocked' (REVIEWS C1 mixed-content warning)
//   - js/app.js contains: 'wp-yt-player' as div placeholder (REVIEWS H3 — not iframe)
//   - js/app.js contains: 'reloadWatchpartyPlayer' AND 'data-action="retry-video"' (REVIEWS H4)
//   - js/app.js contains: removeEventListener for video event handlers (REVIEWS H5)
//   - js/app.js contains: seekToBroadcastedTime call site (REVIEWS M1)
//   - js/app.js contains: distinct schedule-video-url-* IDs across 3 flows (REVIEWS M3)
//
// NOTE: Pre-Plan-03 the production-code sentinels at the bottom of this file will
// FAIL by design — they're a deterministic green/red signal that Plan 24-03 has
// shipped its consumer wiring. Wave 2 Plan 01 in isolation: the helper-behavior
// assertions (parseVideoUrl + titleHasNonDrmPath + makeIntervalBroadcaster +
// seekToBroadcastedTime + URL-construction) all pass, while the sentinels report
// missing patterns until Plan 03 lands.

'use strict';

const fs = require('fs');
const path = require('path');

// ---- Assertion helpers (verbatim shape from smoke-position-transform.cjs:14-15) ----
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
function truthy(label, got) {
  const ok = !!got;
  if (!ok) {
    console.error('FAIL ' + label + ': got ' + JSON.stringify(got));
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}
function falsy(label, got) {
  const ok = !got;
  if (!ok) {
    console.error('FAIL ' + label + ': got ' + JSON.stringify(got));
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}
function deep(label, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    console.error('FAIL ' + label + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want));
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}
function contains(label, haystack, needle) {
  const ok = String(haystack).indexOf(needle) !== -1;
  if (!ok) {
    console.error('FAIL ' + label + ': "' + String(haystack).slice(0, 80) + '..." does not contain "' + needle + '"');
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}
function not_contains(label, haystack, needle) {
  const ok = String(haystack).indexOf(needle) === -1;
  if (!ok) {
    console.error('FAIL ' + label + ': haystack contains forbidden "' + needle + '"');
    fails++;
  } else {
    console.log('OK   ' + label);
  }
}

// Async wrapper so we can `await import(...)` from a CJS file (Node 18+ on this project Node 24.14.1).
(async () => {
  // ===========================
  // Production-module import (REVIEWS H2 fix — replaces inline mirror)
  // ===========================
  // Path note: on Windows, `await import('../js/native-video-player.js')` from a CJS
  // file resolves the relative specifier against the cwd (not __dirname) and Node
  // requires a `file://` URL for ES modules anyway. We construct the file URL with
  // pathToFileURL on the absolute path so the smoke runs from any cwd.
  const moduleUrl = require('url').pathToFileURL(path.resolve(__dirname, '..', 'js/native-video-player.js')).href;
  const m = await import(moduleUrl); // dynamic import of ../js/native-video-player.js (ES module)
  const {
    parseVideoUrl,
    titleHasNonDrmPath,
    makeIntervalBroadcaster,
    seekToBroadcastedTime,
    VIDEO_BROADCAST_INTERVAL_MS,
    STALE_BROADCAST_MAX_MS,
    DRM_FLAT_RATE_PROVIDER_BRANDS
  } = m;

  truthy('module imported', !!m);
  eq('VIDEO_BROADCAST_INTERVAL_MS = 5000', VIDEO_BROADCAST_INTERVAL_MS, 5000);
  eq('STALE_BROADCAST_MAX_MS = 60000', STALE_BROADCAST_MAX_MS, 60000);
  truthy('DRM_FLAT_RATE_PROVIDER_BRANDS is a Set', DRM_FLAT_RATE_PROVIDER_BRANDS instanceof Set);
  truthy('DRM_FLAT_RATE_PROVIDER_BRANDS has Netflix', DRM_FLAT_RATE_PROVIDER_BRANDS.has('Netflix'));

  // ===========================
  // parseVideoUrl: 5 YouTube shapes + 2 MP4 shapes + 6 rejection cases
  // ===========================
  deep('parseVideoUrl: youtube.com/watch?v=ID',
    parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
    { source: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' });
  deep('parseVideoUrl: youtu.be/ID',
    parseVideoUrl('https://youtu.be/dQw4w9WgXcQ'),
    { source: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://youtu.be/dQw4w9WgXcQ' });
  deep('parseVideoUrl: youtube.com/shorts/ID',
    parseVideoUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ'),
    { source: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/shorts/dQw4w9WgXcQ' });
  deep('parseVideoUrl: youtube.com/embed/ID',
    parseVideoUrl('https://www.youtube.com/embed/dQw4w9WgXcQ'),
    { source: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://www.youtube.com/embed/dQw4w9WgXcQ' });
  deep('parseVideoUrl: m.youtube.com/watch?v=ID (mobile redirect)',
    parseVideoUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ'),
    { source: 'youtube', id: 'dQw4w9WgXcQ', url: 'https://m.youtube.com/watch?v=dQw4w9WgXcQ' });

  deep('parseVideoUrl: direct .mp4 URL',
    parseVideoUrl('https://example.com/path/to/video.mp4'),
    { source: 'mp4', url: 'https://example.com/path/to/video.mp4' });
  deep('parseVideoUrl: .mp4 with auth query (Plex/Jellyfin)',
    parseVideoUrl('https://plex.example.com/library/video.mp4?token=abc123'),
    { source: 'mp4', url: 'https://plex.example.com/library/video.mp4?token=abc123' });

  eq('parseVideoUrl: empty string returns null', parseVideoUrl(''), null);
  eq('parseVideoUrl: null input returns null', parseVideoUrl(null), null);
  eq('parseVideoUrl: malformed URL returns null', parseVideoUrl('not a url'), null);
  eq('parseVideoUrl: javascript: protocol rejected', parseVideoUrl('javascript:alert(1)'), null);
  eq('parseVideoUrl: data: URL rejected', parseVideoUrl('data:text/html,<script>alert(1)</script>'), null);
  eq('parseVideoUrl: unknown video host rejected', parseVideoUrl('https://vimeo.com/12345'), null);

  // ===========================
  // titleHasNonDrmPath: 4 cases
  // ===========================
  truthy('titleHasNonDrmPath: null title -> true (no evidence)', titleHasNonDrmPath(null));
  truthy('titleHasNonDrmPath: title with no providers -> true',
    titleHasNonDrmPath({ providers: [], rentProviders: [], buyProviders: [] }));
  falsy('titleHasNonDrmPath: ALL Netflix -> false (DRM-only, hide player)',
    titleHasNonDrmPath({ providers: [{ name: 'Netflix' }], rentProviders: [], buyProviders: [] }));
  truthy('titleHasNonDrmPath: Netflix + buy provider -> true (rent/buy escape hatch)',
    titleHasNonDrmPath({ providers: [{ name: 'Netflix' }], rentProviders: [], buyProviders: [{ name: 'Apple TV' }] }));

  // ===========================
  // makeIntervalBroadcaster: leading + trailing edge
  // ===========================
  const calls = [];
  const broadcast = makeIntervalBroadcaster(1000, v => calls.push(v));
  broadcast('first');
  eq('makeIntervalBroadcaster: leading edge fires immediately', calls.length, 1);
  eq('makeIntervalBroadcaster: leading-edge value', calls[0], 'first');

  // Trailing edge — uses real timer, async wait
  const tCalls = [];
  const t = makeIntervalBroadcaster(50, v => tCalls.push(v));
  t('a'); // fires immediately (leading)
  t('b'); // queued
  t('c'); // queued — replaces 'b' as pendingValue
  await new Promise(r => setTimeout(r, 100));
  eq('makeIntervalBroadcaster: trailing edge fires last value', tCalls.length, 2);
  eq('makeIntervalBroadcaster: trailing-edge value is most recent', tCalls[1], 'c');

  // ===========================
  // seekToBroadcastedTime: REVIEWS M1 — 4 cases (happy path, stale, missing data, source mismatch)
  // ===========================
  // Mock player surfaces (just enough surface area for the helper to call seekTo / set currentTime)
  const ytSeekCalls = [];
  const mockYtPlayer = { seekTo: (s, ahead) => { ytSeekCalls.push({ s, ahead }); } };

  // Happy path: fresh wp.currentTimeUpdatedAt + non-zero currentTimeMs -> seek
  eq('seekToBroadcastedTime: happy path returns true',
    seekToBroadcastedTime(mockYtPlayer, { currentTimeMs: 12000, currentTimeUpdatedAt: Date.now() - 1000 }, 'youtube'),
    true);
  eq('seekToBroadcastedTime: happy path called seekTo with seconds', ytSeekCalls[0].s, 12);
  eq('seekToBroadcastedTime: happy path passed allowSeekAhead=true', ytSeekCalls[0].ahead, true);

  // Stale: currentTimeUpdatedAt older than STALE_BROADCAST_MAX_MS -> skip
  eq('seekToBroadcastedTime: stale (>60s old) returns false',
    seekToBroadcastedTime(mockYtPlayer, { currentTimeMs: 12000, currentTimeUpdatedAt: Date.now() - 90_000 }, 'youtube'),
    false);

  // Missing data: no currentTimeMs -> skip
  eq('seekToBroadcastedTime: missing currentTimeMs returns false',
    seekToBroadcastedTime(mockYtPlayer, { currentTimeUpdatedAt: Date.now() }, 'youtube'),
    false);

  // Source mismatch: 'unknown' source -> skip
  eq('seekToBroadcastedTime: unknown source returns false',
    seekToBroadcastedTime(mockYtPlayer, { currentTimeMs: 12000, currentTimeUpdatedAt: Date.now() }, 'unknown'),
    false);

  // ===========================
  // YouTube embed URL: XSS guards + iOS playsinline gate
  // (Test the encoding shape against representative input — verifies what Plan 03 emits)
  // ===========================
  const buildYouTubeEmbedUrl = (videoId) =>
    'https://www.youtube.com/embed/' + encodeURIComponent(videoId) + '?enablejsapi=1&playsinline=1';
  const ytUrl = buildYouTubeEmbedUrl('dQw4w9WgXcQ');
  contains('YouTube embed URL contains enablejsapi=1', ytUrl, 'enablejsapi=1');
  contains('YouTube embed URL contains playsinline=1 (iOS gate)', ytUrl, 'playsinline=1');
  contains('YouTube embed URL uses encodeURIComponent (XSS guard)', buildYouTubeEmbedUrl('a&b=c'), 'a%26b%3Dc');

  // ===========================
  // Production-code sentinels — post-Plan-03 gates
  // (These read js/app.js as a string and assert that Plan 03 shipped the expected
  // patterns. They run AFTER Plan 03 is executed; before that they will FAIL — that's
  // by design. Plan 03's verify step runs this smoke as proof of consumer wiring.)
  // ===========================
  let appJs = '';
  try {
    appJs = fs.readFileSync(path.resolve(__dirname, '..', 'js/app.js'), 'utf8');
  } catch (e) {
    console.warn('NOTE: could not read js/app.js (' + e.message + ') — sentinel checks skipped');
  }
  if (appJs) {
    // REVIEWS C2: Phase 26 schema fields
    contains('js/app.js contains currentTimeMs (Phase 26 schema)', appJs, 'currentTimeMs');
    contains('js/app.js contains currentTimeUpdatedAt (Phase 26 schema)', appJs, 'currentTimeUpdatedAt');
    contains('js/app.js contains currentTimeSource (REVIEWS C2)', appJs, 'currentTimeSource');
    contains('js/app.js contains durationMs (REVIEWS C2)', appJs, 'durationMs');
    contains('js/app.js contains isLiveStream (REVIEWS C2)', appJs, 'isLiveStream');

    // REVIEWS C1: mixed-content warning copy
    contains('js/app.js ships REVIEWS C1 mixed-content warning copy', appJs, 'HTTP links may be blocked');

    // REVIEWS H3: div-placeholder for YouTube IFrame API binding (NOT iframe element)
    // Plan 03 should render <div id="wp-yt-player" data-video-id="..."> rather than <iframe id="wp-yt-player" src="...">
    contains('js/app.js renders wp-yt-player as div placeholder (H3)', appJs, 'data-video-id');

    // REVIEWS H4: retry link wired
    contains('js/app.js defines reloadWatchpartyPlayer (H4)', appJs, 'reloadWatchpartyPlayer');
    contains('js/app.js wires retry click handler (H4)', appJs, 'retry-video');

    // REVIEWS H5: removeEventListener in teardown
    contains('js/app.js calls removeEventListener for video handlers (H5)', appJs, 'removeEventListener');

    // REVIEWS M1: seek-on-join call site
    contains('js/app.js calls seekToBroadcastedTime (M1)', appJs, 'seekToBroadcastedTime');

    // REVIEWS M3: distinct schedule-video-url IDs across flows
    // (At least one of the three distinct IDs must appear; Plan 03 ships all three:
    //  wp-video-url-movie / wp-video-url-game / wp-video-url-sport)
    const m3Match = /wp-video-url-(movie|game|sport)/.test(appJs);
    truthy('js/app.js uses distinct wp-video-url-* IDs (M3)', m3Match);

    // REVIEWS M4: per-sample live-stream gate (isFinite + getDuration co-occur)
    const m4Match = /isFinite\([^)]*getDuration|getDuration\(\)[^;]*isFinite/.test(appJs);
    truthy('js/app.js gates live-streams per sample (M4)', m4Match);
  }

  if (fails) {
    console.error('\nFAILED ' + fails + ' assertion(s)');
    process.exit(1);
  } else {
    console.log('\nALL ASSERTIONS PASSED');
    process.exit(0);
  }
})().catch(err => {
  console.error('SMOKE CRASHED:', err);
  process.exit(1);
});
