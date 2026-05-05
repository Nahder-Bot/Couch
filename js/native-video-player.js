// === Phase 24 — Native video player helpers ===
// Pure helpers consumed by js/app.js for the watchparty live-modal player surface.
// Co-locates: URL parser + DRM detection + throttle helper + seek helper + cadence + staleness.
//
// Exports:
//   VIDEO_BROADCAST_INTERVAL_MS   — host-only currentTime broadcast cadence (5000ms per D-09)
//   STALE_BROADCAST_MAX_MS        — max age of wp.currentTimeUpdatedAt before we ignore it (60000ms)
//   DRM_FLAT_RATE_PROVIDER_BRANDS — Set of provider name strings that imply DRM-only
//   parseVideoUrl(input)          — { source: 'youtube'|'mp4', id?, url } | null
//   titleHasNonDrmPath(t)         — true if title has at least one non-DRM path
//   makeIntervalBroadcaster(ms,fn) — leading + trailing edge throttle (Pattern 3)
//   seekToBroadcastedTime(player, wp, source) — late-join seek for non-hosts (REVIEWS M1)
//
// No top-level side effects (no DOM, no network, no Date.now() at import time).
// Smoke contract: scripts/smoke-native-video-player.cjs imports this module directly
// (await import('../js/native-video-player.js')) — production-module testing per
// REVIEWS.md H2 fix.
//
// Per CONTEXT.md D-01..D-04 + RESEARCH §Code Examples §3-§5 + UI-SPEC §Layout Contracts
// + REVIEWS.md M1 (seek-on-join) + C2 (Phase 26 schema forward-compat).

// ---- Cadence constant (D-09 broadcast cadence) ----
// 5s = 12 writes/min × 60 = 720 writes/hour/wp under Firestore's 1-write/sec/document soft cap.
// Phase 26 inherits this granularity for runtime-anchored reactions (acceptable per RESEARCH Pitfall 7).
export const VIDEO_BROADCAST_INTERVAL_MS = 5000;

// ---- Staleness window for currentTimeUpdatedAt ----
// Late-joining non-host seeks to wp.currentTimeMs ONLY if the host updated it within this window.
// Beyond this, the host probably went idle (paused, closed laptop, etc.) — better to start at 0
// than to seek to a stale position. Phase 26 uses the same threshold for replay-anchor decisions.
export const STALE_BROADCAST_MAX_MS = 60_000; // 1 minute

// ---- DRM-flat-rate provider brand allowlist (D-03) ----
// Mirrors the brand strings Couch's TMDB_PROVIDER_IDS map at js/app.js:13006 already uses.
// Adding a brand here = "this provider is DRM-only on its flat-rate tier; rent/buy still allowed".
export const DRM_FLAT_RATE_PROVIDER_BRANDS = new Set([
  'Netflix', 'Disney Plus', 'Max', 'HBO Max', 'Amazon Prime Video',
  'Amazon Prime Video with Ads', 'Apple TV Plus', 'Apple TV+',
  'Paramount Plus', 'Paramount+', 'Hulu', 'Peacock', 'Peacock Premium'
]);

// ---- parseVideoUrl: 5 YouTube shapes + .mp4 + protocol rejection ----
// Returns { source: 'youtube', id, url } | { source: 'mp4', url } | null.
// Pure (no DOM, no network); smoke-testable.
// Recognized YouTube shapes (D-01):
//   1. https://www.youtube.com/watch?v=ID
//   2. https://youtu.be/ID
//   3. https://www.youtube.com/shorts/ID
//   4. https://www.youtube.com/embed/ID
//   5. https://m.youtube.com/watch?v=ID  (mobile redirect target)
// MP4 detection (D-02): pathname ends in .mp4 (case-insensitive). Query string allowed (Plex/Jellyfin).
// Protocol gate: refuses anything that isn't http: or https: (rejects javascript:, data:, file:).
export function parseVideoUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  let u;
  try { u = new URL(trimmed); } catch (e) { return null; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (host === 'youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      // Real YouTube IDs are exactly 11 chars; tighter than the prior {6,}
      // floor which accepted spoofed/mangled IDs (REVIEWS WR-24-04).
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { source: 'youtube', id, url: trimmed };
    }
    const m = u.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
    if (m) return { source: 'youtube', id: m[1], url: trimmed };
  }
  if (host === 'youtu.be') {
    const m = u.pathname.match(/^\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
    if (m) return { source: 'youtube', id: m[1], url: trimmed };
  }
  if (/\.mp4$/i.test(u.pathname)) return { source: 'mp4', url: trimmed };
  return null;
}

// ---- titleHasNonDrmPath: D-03 detection threshold ----
// Returns true when at least ONE non-DRM path exists. False ONLY when ALL stream providers
// are flat-rate DRM brands AND no rent/buy providers exist.
// Defensive on missing data — assume non-DRM (don't hide on incomplete data per RESEARCH Pitfall 4).
// Reads existing schema at js/app.js:16 (out.providers / rentProviders / buyProviders, schemaVersion 3).
export function titleHasNonDrmPath(t) {
  if (!t) return true;
  const stream = Array.isArray(t.providers) ? t.providers : [];
  const rent   = Array.isArray(t.rentProviders) ? t.rentProviders : [];
  const buy    = Array.isArray(t.buyProviders) ? t.buyProviders : [];
  if (rent.length > 0 || buy.length > 0) return true;
  if (stream.length === 0) return true;
  const allDrm = stream.every(p => DRM_FLAT_RATE_PROVIDER_BRANDS.has(p.name));
  return !allDrm;
}

// ---- makeIntervalBroadcaster: Pattern 3 throttle ----
// Leading + trailing edge throttle. First call fires fn() immediately (good UX feedback);
// subsequent calls within intervalMs queue a setTimeout for the LAST value (so the last
// pre-pause/pre-end value lands in storage — Phase 26 needs accurate replay anchoring).
// Pure factory; no setInterval; closure-scoped state.
export function makeIntervalBroadcaster(intervalMs, fn) {
  let lastWriteAt = 0;
  let pendingValue;
  let pendingTimer = null;
  return function broadcast(value) {
    pendingValue = value;
    const now = Date.now();
    const sinceLast = now - lastWriteAt;
    if (sinceLast >= intervalMs) {
      lastWriteAt = now;
      fn(pendingValue);
      pendingValue = undefined;
      return;
    }
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        lastWriteAt = Date.now();
        fn(pendingValue);
        pendingValue = undefined;
        pendingTimer = null;
      }, intervalMs - sinceLast);
    }
  };
}

// ---- seekToBroadcastedTime (REVIEWS M1: late-join seek) ----
// For non-host participants who join after the host started playing, seek the player
// to wp.currentTimeMs (converted to seconds) so they enter at the host's current position
// rather than always starting at 0.
//
// Args:
//   player — the runtime player object. For 'youtube': YT.Player instance with seekTo(seconds, allowSeekAhead).
//            For 'mp4': HTMLVideoElement with currentTime setter.
//   wp     — the watchparty record. Reads wp.currentTimeMs (number, ms) + wp.currentTimeUpdatedAt (number, ms-since-epoch).
//   source — 'youtube' | 'mp4' (must match wp.videoSource).
//
// Skip cases (return false without seeking):
//   - wp missing currentTimeMs or it's <= 0
//   - wp.currentTimeUpdatedAt is older than STALE_BROADCAST_MAX_MS (host went idle)
//   - source mismatch (defensive — caller should already gate)
//   - player API surface missing
//
// Returns true if a seek was attempted, false otherwise.
export function seekToBroadcastedTime(player, wp, source) {
  if (!player || !wp || !source) return false;
  const ms = (typeof wp.currentTimeMs === 'number') ? wp.currentTimeMs : 0;
  if (!isFinite(ms) || ms <= 0) return false;
  const updatedAt = (typeof wp.currentTimeUpdatedAt === 'number') ? wp.currentTimeUpdatedAt : 0;
  const age = Date.now() - updatedAt;
  if (!isFinite(age) || age < 0 || age > STALE_BROADCAST_MAX_MS) return false;
  const seconds = ms / 1000;
  try {
    if (source === 'youtube') {
      if (typeof player.seekTo === 'function') { player.seekTo(seconds, true); return true; }
      return false;
    }
    if (source === 'mp4') {
      // HTMLVideoElement.currentTime is a setter; only valid after metadata loads.
      // Caller is responsible for waiting for 'loadedmetadata' (Plan 03 wires this).
      // isFinite() rejects NaN and ±Infinity; HLS/live streams report Infinity duration
      // and seeking to a position on those is undefined behavior (REVIEWS WR-24-03).
      if (player && isFinite(player.duration) && player.duration > 0) {
        player.currentTime = seconds;
        return true;
      }
      // If metadata isn't ready yet, set a one-shot listener on loadedmetadata.
      if (player && typeof player.addEventListener === 'function') {
        const handler = () => {
          try { player.currentTime = seconds; } catch (e) { /* ignore */ }
          player.removeEventListener('loadedmetadata', handler);
        };
        player.addEventListener('loadedmetadata', handler);
        return true;
      }
      return false;
    }
    return false;
  } catch (e) {
    return false;
  }
}
