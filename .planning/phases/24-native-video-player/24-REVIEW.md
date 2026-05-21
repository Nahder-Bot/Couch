---
phase: 24-native-video-player
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - C:/Users/nahde/claude-projects/couch/js/app.js (Phase 24 surfaces — attachVideoPlayer, broadcasters, readAndValidateVideoUrl, ensureYouTubeApi)
  - C:/Users/nahde/claude-projects/couch/js/native-video-player.js
  - C:/Users/nahde/claude-projects/couch/firestore.rules (Path A/B from REVIEWS M2)
  - C:/Users/nahde/claude-projects/couch/.planning/phases/24-native-video-player/24-CONTEXT.md
findings:
  blocker: 0
  critical: 1
  warning: 4
  info: 2
  total: 7
status: issues_found
---

# Phase 24: Native Video Player — Code Review

**Reviewed:** 2026-05-03
**Depth:** standard
**Files Reviewed:** 4 source files
**Status:** issues_found — 1 CRITICAL, 4 WARNING, 2 INFO

## Summary

Phase 24 ships green (8/8 smoke + 48/48 rules tests post-M2 tighten + cross-repo deploy 2026-05-01). One Critical bug silently corrupts wp.isLiveStream during the opening 1-3 seconds of every watchparty before player metadata loads — and Phase 26's `derivePositionForReaction` consumes that field, permanently stamping any reactions posted in that window with `runtimeSource: 'live-stream'`, making them invisible to replay forever. Cross-phase data loss class.

Four warnings on tighter UX (mixed-content not blocking, legacy wps locked out by Path A, MP4 Infinity-duration handling, YouTube ID regex too loose). Two info-level deferred items.

## CRITICAL Issues

### CR-24-01: First broadcast samples mark wp.isLiveStream=true on normal videos

**File:** `js/app.js:11665-11673` (YouTube path) and `js/app.js:11696-11697` (MP4 path)
**Severity:** CRITICAL
**Confidence:** >90%

Both broadcasters fire BEFORE the player has finished loading metadata:

- **YouTube:** broadcaster armed inside `onReady`, but `getDuration()` may return 0 until video data is fetched. The 5s sampler immediately triggers a write where `getDuration() <= 0` → falls into else branch → `isLive = true; duration = null`.
- **MP4:** `video.duration` is `NaN` until `loadedmetadata`. The broadcaster ternary returns `null` for duration → `isLive = duration === null` → `true`.

Either way, the FIRST broadcast (before metadata settles) writes `isLiveStream: true` to the wp record. Phase 26's `derivePositionForReaction` reads `wp.isLiveStream === true` and returns `{null, 'live-stream'}` for any reaction posted in that initial window. Those reactions are then permanently invisible to replay (filtered out by `replayableReactionCount` and the replay feed). **Silent data loss on every watchparty's opening seconds.**

The wp.isLiveStream value DOES correct itself once metadata loads (next sample writes `isLiveStream: false`), but reactions stamped in the meantime keep their `runtimeSource: 'live-stream'` value forever.

**Repro:** Host starts a watchparty with a normal MP4 or YouTube video. Within ~1-3 seconds (before player metadata loads), have the host or a participant post a reaction. After the wp archives, open it in replay mode. The early reactions are missing from the feed.

**Fix:** Gate the broadcaster on metadata-ready signals.

**For MP4 — attach the broadcaster inside `loadedmetadata`:**
```js
} else if (wp.videoSource === 'mp4') {
  // ...
  if (isHost) {
    const armBroadcaster = () => {
      if (_wpVideoBroadcaster) return; // idempotent
      _wpVideoBroadcaster = makeIntervalBroadcaster(VIDEO_BROADCAST_INTERVAL_MS, sec => {
        const duration = (typeof video.duration === 'number' && isFinite(video.duration) && video.duration > 0) ? video.duration : null;
        const isLive = duration === null;
        broadcastCurrentTime(wp.id, sec, 'mp4', duration, isLive);
      });
    };
    if (video.readyState >= 1 /* HAVE_METADATA */) armBroadcaster();
    else video.addEventListener('loadedmetadata', armBroadcaster, { once: true });
  }
}
```

**For YouTube — skip samples where `getDuration()` is unknown:**
```js
const dur = _wpYtPlayer.getDuration();
if (!isFinite(dur)) return; // unknown — skip this sample, don't guess live
if (dur > 0) { duration = dur; isLive = false; }
else { isLive = true; duration = null; }  // genuinely live
```

Skipping unknown samples is safer than guessing live.

---

## WARNING Issues

### WR-24-01: Mixed-content warning is non-blocking; submit succeeds with broken playback

**File:** `js/app.js:11184-11188` (in `readAndValidateVideoUrl`)
**Severity:** WARNING
**Confidence:** 90%

REVIEWS C1 surfaces a `flashToast` for HTTP MP4 URLs but `return { ok: true }` proceeds. Wp record persists with `videoUrl: 'http://...'`. When `attachVideoPlayer` later renders `<video src="http://...">`, modern browsers refuse to load HTTP on an HTTPS page entirely — video element shows "no video available" with no playback. User has already created and shared the watchparty.

**Fix (recommended):** Hard-block submit:
```js
if (parsed.source === 'mp4' && parsed.url.startsWith('http://')) {
  return { ok: false, reason: 'mixed-content', hint: 'Use https for MP4 links — http blocks playback on most browsers.' };
}
```

---

### WR-24-02: Path A on legacy wps prevents host writes to host-only fields

**File:** `firestore.rules:629-650` (and the duplicate top-level `/watchparties/{wpId}` rule at 141-167)
**Severity:** WARNING
**Confidence:** 85%

Path A requires `'hostUid' in resource.data && resource.data.hostUid == request.auth.uid`. For legacy wps written before Phase 24 deployed `hostUid` stamping, `'hostUid' in resource.data` is false → Path A fails. Path B blocks any write that touches `currentTimeMs`, `videoUrl`, etc. So a host opening a legacy wp through the Phase 24 client surface and starting playback CANNOT broadcast — every `broadcastCurrentTime` write returns PERMISSION_DENIED.

Going forward, Plan 03 stamps hostUid at all 3 wp creation paths — but any wp created during the v34/v35/v36 cache window persists with no `hostUid` and is permanently broken for player attachment.

**Fix (option a, cheapest):** Accept the incompatibility — document this in REVIEWS M2 / Phase 24 notes. Legacy wps just can't use the player surface.

**Fix (option c, more compat-friendly but +1 `get()` per write):** Loosen Path A:
```
(
  ('hostUid' in resource.data && resource.data.hostUid == request.auth.uid)
  ||
  (!('hostUid' in resource.data) && 'hostId' in resource.data
    && exists(/databases/$(database)/documents/families/$(familyCode)/members/$(resource.data.hostId))
    && get(/databases/$(database)/documents/families/$(familyCode)/members/$(resource.data.hostId)).data.uid == request.auth.uid)
)
```

---

### WR-24-03: `seekToBroadcastedTime` MP4 metadata-ready check is too permissive

**File:** `js/native-video-player.js:155-171`
**Severity:** WARNING
**Confidence:** 90%

The MP4 branch checks `typeof player.duration === 'number' && !isNaN(player.duration)`. But `HTMLMediaElement.duration` returns `NaN` until `loadedmetadata`, and returns `+Infinity` for live streams or unbounded sources. The `!isNaN` check passes for `+Infinity` — and setting `currentTime` on an Infinity-duration source is undefined behavior; some browsers reject it, some clamp to 0. For Plex/Jellyfin transcoded streams reporting `Infinity` duration, the late-join seek silently fails.

`typeof player.duration === 'number'` is also true for NaN, so the explicit `!isNaN` is doing the actual work; the `typeof` check is redundant.

**Fix:**
```js
if (player && isFinite(player.duration) && player.duration > 0) {
  player.currentTime = seconds;
  return true;
}
```

`isFinite()` rejects both `NaN` and `Infinity`. Matches the broadcaster's own duration check at line 11696.

---

### WR-24-04: `parseVideoUrl` accepts YouTube IDs ≥6 chars when canonical IDs are 11

**File:** `js/native-video-player.js:64-74`
**Severity:** WARNING
**Confidence:** 95%

All four YouTube branches use `[A-Za-z0-9_-]{6,}` to match the video ID. Real YouTube video IDs are exactly 11 chars. The `{6,}` lower bound means malformed URLs (`https://youtu.be/abcdef` 6 chars, `https://www.youtube.com/embed/abcdefg` 7 chars) parse as valid `{ source: 'youtube', id: 'abcdef' }` and pass through to `attachVideoPlayer`, which builds `https://www.youtube.com/embed/abcdef`. The iframe loads and shows YouTube's own "Video unavailable" UI — user has already created and shared the watchparty.

**Fix:** Tighten to `{11}`:
```js
const m = u.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})(?:[/?#]|$)/);
// and similarly for /watch?v= and youtu.be
if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return { source: 'youtube', id, url: trimmed };
```

YouTube has used 11-char ids consistently since launch — regression risk is low.

---

## INFO Issues

### IN-24-01: `ensureYouTubeApi` global handler overwrite (REVIEWS L2 carryover)

**File:** `js/app.js:11560`
**Issue:** `window.onYouTubeIframeAPIReady = () => resolve();` overwrites any prior global handler. REVIEWS L2 was acknowledged and noted as deferred risk. No remediation requested — this finding confirms the deferred status is accurate.
**Fix:** Keep deferred. If a future phase adds Twitch+YouTube embeds, switch to a chained-handler pattern.

### IN-24-02: `attachVideoPlayer` async race with rapid close-then-reopen

**File:** `js/app.js:11605-11644`
**Issue:** `_wpRetryClickHandler` set + attached BEFORE the `await ensureYouTubeApi()`. If the modal is closed during the await, `teardownVideoPlayer` runs and clears the handler ref, but the OLD handler is still attached to the OLD `.wp-video-frame` (now removed from DOM since `surface.innerHTML = ''` cleared it). Doesn't leak meaningfully, but the ordering is fragile.
**Fix:** Lower priority — a tag/symbol check on re-entry would harden, but current behavior works.

---

## Summary Table

| ID | Severity | File | One-line |
|----|----------|------|----------|
| CR-24-01 | Critical | js/app.js:11665, 11696 | Pre-metadata broadcasts stamp wp.isLiveStream=true → reactions invisible to replay |
| WR-24-01 | Warning | js/app.js:11184 | Mixed-content HTTP MP4 should hard-block submit |
| WR-24-02 | Warning | firestore.rules:629 | Path A locks legacy hostUid-less wps out of player surface |
| WR-24-03 | Warning | js/native-video-player.js:155 | MP4 seek allows Infinity duration |
| WR-24-04 | Warning | js/native-video-player.js:64 | YouTube ID regex too loose ({6,} instead of {11}) |
| IN-24-01 | Info | js/app.js:11560 | onYouTubeIframeAPIReady overwrite (deferred) |
| IN-24-02 | Info | js/app.js:11605 | attachVideoPlayer async-race fragile ordering |

**Highest priority:** CR-24-01 — pair with Phase 26's CR-26-01/02 in the same fix wave since they all touch the replay correctness contract. After fix, run 24-HUMAN-UAT.md Script 11 (two-device currentTime broadcast) AND 26-HUMAN-UAT.md Script 4 (compound-reaction position) to verify replay sees opening-seconds reactions.
