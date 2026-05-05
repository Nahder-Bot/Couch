---
phase: 24-native-video-player
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 18/18 must-haves verified (code-level); 11 device-UAT scripts pending
overrides_applied: 0
re_verification: false
human_verification:
  - test: "Schedule wp with YouTube link (movie flow) — wp-video-url-movie field accepts URL + persists videoUrl/videoSource on wp record"
    expected: "wp persists; modal closes; wp appears in upcoming list"
    why_human: "Real iPhone PWA interaction with wp-start modal cannot be programmatically verified"
  - test: "YouTube branch — player div renders inside #wp-video-surface (persistent), .wp-live-poster hidden, YT IFrame API replaces div"
    expected: "Player visible inside live modal; H1 persistent surface honored"
    why_human: "Visual rendering + YT IFrame API timing requires real device + real network"
  - test: "iOS playsinline — YouTube plays inline (no fullscreen yank on tap)"
    expected: "Video plays in-modal; no native iOS fullscreen takeover"
    why_human: "iOS Safari fullscreen behavior is platform-specific; cannot test outside real iOS device"
  - test: "REVIEWS H1 verification — player survives reactions + timer ticks (no reset)"
    expected: "Player keeps playing through 5+ reaction posts and timer ticks; never resets to 0:00"
    why_human: "Multi-event live behavior requires real watchparty + real human input cadence"
  - test: "Schedule wp with .mp4 link (game-picker flow) — wp-video-url-game field"
    expected: "wp persists with videoSource='mp4' on game wp record"
    why_human: "Real device interaction with game-picker modal"
  - test: "MP4 plays inline on iOS (no fullscreen yank); native iOS controls visible"
    expected: "Video plays inline; native controls; no fullscreen takeover"
    why_human: "iOS HTML5 <video> playsinline behavior is device-specific"
  - test: "REVIEWS M1 verification — late-join seek for non-host (two-phone test)"
    expected: "Phone B's player starts at ~30s position (host's broadcast), NOT 0:00"
    why_human: "Requires two-device coordination + real Firestore propagation + real seekToBroadcastedTime call"
  - test: "DRM-hide branch — silent dead-end on Netflix-only title"
    expected: "Modal renders WITHOUT player surface; no error copy; #wp-video-surface empty"
    why_human: "Requires real Netflix-only TMDB title in family library"
  - test: "Invalid URL — .field-invalid red border + inline error copy + modal stays open"
    expected: "Border red; inline error 'That link doesn't look like YouTube or an .mp4 file...'"
    why_human: "Visual border + error copy rendering needs real device"
  - test: "REVIEWS C1 verification — HTTP MP4 mixed-content warning toast"
    expected: "Toast: 'Note: HTTP links may be blocked by the browser. Use https if available.'"
    why_human: "flashToast visual surface + duration on real device"
  - test: "Two-device REVIEWS C2 schema verification — Firestore Console check"
    expected: "wp record contains currentTimeMs + currentTimeUpdatedAt + currentTimeSource + durationMs + isLiveStream"
    why_human: "Firestore Console inspection of live wp record post-broadcast requires real session"
---

# Phase 24: Native Video Player Verification Report

**Phase Goal:** Stand up a Couch-native player surface so watchparties can actually play the title together. Locked v2.0 scope (D-01..D-04): YouTube only for iframe branch + MP4 only for HTML5 `<video>` branch. DRM-restricted titles silently hide player surface. Optional manual URL field on watchparty schedule modals only. Player exposes currentTime and broadcasts to Firestore — 5s host-only writes with extended schema {currentTimeMs, currentTimeUpdatedAt, currentTimeSource, durationMs, isLiveStream} — so Phase 26 can anchor to runtime position.

**Verified:** 2026-05-01
**Status:** human_needed (code-shipped + production-deployed; awaiting real-device UAT)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                       | Status     | Evidence                                                                                                 |
| --- | ----------------------------------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1   | Module js/native-video-player.js exists with 7 named exports (no top-level side effects, no DOM)            | VERIFIED   | 176 lines; smoke `module imported` + `VIDEO_BROADCAST_INTERVAL_MS = 5000` + `STALE_BROADCAST_MAX_MS = 60000` + `DRM_FLAT_RATE_PROVIDER_BRANDS is a Set` all OK |
| 2   | parseVideoUrl handles 5 YouTube shapes + 2 MP4 shapes + 6 rejection cases (incl javascript:/data:)          | VERIFIED   | 13 smoke assertions all OK in `scripts/smoke-native-video-player.cjs` run                                |
| 3   | titleHasNonDrmPath returns false ONLY when ALL stream providers are DRM brands AND no rent/buy paths        | VERIFIED   | 4 smoke assertions all OK                                                                                |
| 4   | makeIntervalBroadcaster fires leading edge + trailing edge with last value                                  | VERIFIED   | 4 smoke assertions OK; 50ms interval + 100ms wait test passes                                            |
| 5   | seekToBroadcastedTime seeks YT/MP4 players (skips on stale/missing/source-mismatch)                         | VERIFIED   | 5 smoke assertions OK (happy path + stale + missing + unknown source)                                    |
| 6   | Smoke contract imports production module via dynamic ES import (REVIEWS H2 fix — no inline mirror)          | VERIFIED   | scripts/smoke-native-video-player.cjs:109-110 uses `pathToFileURL(...).href` + `await import(moduleUrl)` |
| 7   | js/app.js statically imports the 6 needed exports from './native-video-player.js'                           | VERIFIED   | js/app.js:8-15 — exact import block landed                                                               |
| 8   | DOM scaffold split (REVIEWS H1) — #wp-video-surface (persistent) + #wp-live-coordination (re-renderable)    | VERIFIED   | app.html:1219 (#wp-video-surface) + 1223 (#wp-live-coordination)                                         |
| 9   | Three distinct flow-prefixed schedule-modal IDs (REVIEWS M3): wp-video-url-{movie,game,sport}               | VERIFIED   | app.html lines 1120/1155/1195 each ship a distinct id                                                    |
| 10  | js/app.js renders YT branch as `<div id="wp-yt-player" data-video-id="...">` (REVIEWS H3 div-placeholder)   | VERIFIED   | smoke sentinel `js/app.js renders wp-yt-player as div placeholder (H3)` OK                               |
| 11  | js/app.js defines reloadWatchpartyPlayer + wires `[data-action="retry-video"]` (REVIEWS H4)                 | VERIFIED   | smoke sentinels `reloadWatchpartyPlayer (H4)` + `retry click handler (H4)` both OK                       |
| 12  | js/app.js teardown calls removeEventListener for stored handler refs (REVIEWS H5)                           | VERIFIED   | smoke sentinel `removeEventListener for video handlers (H5)` OK; 35 occurrences of lifecycle symbols     |
| 13  | js/app.js calls seekToBroadcastedTime (REVIEWS M1)                                                          | VERIFIED   | smoke sentinel `seekToBroadcastedTime (M1)` OK                                                           |
| 14  | js/app.js gates live-streams per sample (REVIEWS M4): isFinite + getDuration co-occur                       | VERIFIED   | js/app.js:11179 `isFinite(_wpYtPlayer.getDuration()) && _wpYtPlayer.getDuration() > 0`                   |
| 15  | js/app.js writes Phase 26 extended schema (REVIEWS C2): 5 fields per broadcast                              | VERIFIED   | smoke sentinels for currentTimeMs / currentTimeUpdatedAt / currentTimeSource / durationMs / isLiveStream all OK |
| 16  | js/app.js ships REVIEWS C1 mixed-content warning copy 'HTTP links may be blocked'                           | VERIFIED   | smoke sentinel OK                                                                                        |
| 17  | sw.js CACHE = 'couch-v37-native-video-player' (local + production curl-verified)                            | VERIFIED   | sw.js:8 + curl https://couchtonight.app/sw.js returns same string                                        |
| 18  | Firestore rules (REVIEWS M2) tightened: host-only Path A + 10-field denylist Path B; rules-tests added      | VERIFIED   | firestore.rules:561-600 contains hostUid guard + 10-field denylist; tests/rules.test.js:838-908 ships 5 wp tests |

**Score:** 18/18 truths verified at code level

### Required Artifacts

| Artifact                                                              | Expected                                                                          | Status     | Details                                                                                                       |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `js/native-video-player.js`                                           | Pure-helpers ES module, 7 named exports, ≥130 lines                               | VERIFIED   | 176 lines; node --check OK; dynamic-import returns all 7 expected exports with correct types                  |
| `scripts/smoke-native-video-player.cjs`                               | Production-module import via dynamic ES import; ≥28 assertions                    | VERIFIED   | 288 lines; 46 OK / 0 FAIL; 35 helper-behavior + 11 production-code sentinels all green                        |
| `js/app.js` (consumer wiring)                                         | Module import + 3-flow validation + lifecycle pair + broadcast + retry overlay   | VERIFIED   | Static import at line 8-15; 35 occurrences of attach/teardown/broadcast/seek/render/read symbols              |
| `app.html` (DOM scaffold)                                             | 3 schedule modal URL fields + #wp-video-surface + #wp-live-coordination siblings  | VERIFIED   | All 5 distinct IDs (wp-video-url-{movie,game,sport} + wp-video-surface + wp-live-coordination) at expected lines |
| `css/app.css`                                                         | Persistent surface + frame + field-help/error/invalid + .wp-video-error rules     | VERIFIED   | Per Plan 03 SUMMARY: all 8 rule-blocks shipped; commit 44d55a7                                                |
| `sw.js`                                                               | CACHE = 'couch-v37-native-video-player'                                           | VERIFIED   | Local sw.js:8 + production curl both return the same string                                                   |
| `tests/rules.test.js`                                                 | 5 new wp rules tests under 'Phase 24 — watchparty video fields (REVIEWS M2)'      | VERIFIED   | tests/rules.test.js:838+ ships #wp1..#wp5 + seed for wp_phase24_test                                          |
| `firestore.rules`                                                     | Host-only Path A + 10-field denylist Path B for wp updates                        | VERIFIED   | firestore.rules:561-600 contains hostUid in resource.data guard + denylist on currentTimeMs/UpdatedAt/Source/durationMs/isLiveStream/videoUrl/videoSource/hostId/hostUid/hostName |
| `.planning/phases/24-native-video-player/24-HUMAN-UAT.md`             | Device-UAT tracker, ≥80 lines, 11 scripts, REVIEWS H1/M1/C1/C2 verification scripts | VERIFIED | 82 lines; 11 numbered scripts; cache_version + deploy_ts in frontmatter; resume signal `uat passed`           |

### Key Link Verification

| From                                                  | To                                                       | Via                                                              | Status   | Details                                                                              |
| ----------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------ |
| scripts/smoke-native-video-player.cjs                 | js/native-video-player.js                                | dynamic ES import via pathToFileURL                              | WIRED    | Smoke runs green end-to-end; module import is the first assertion                    |
| js/app.js                                             | js/native-video-player.js                                | static `import { ... } from './native-video-player.js'`          | WIRED    | Line 8-15 imports 6 named symbols                                                    |
| package.json scripts.smoke chain                      | scripts/smoke-native-video-player.cjs                    | 8th `&&` clause + smoke:native-video-player alphabetical alias   | WIRED    | `npm run smoke:native-video-player` exits 0                                          |
| scripts/deploy.sh §2.5                                | scripts/smoke-native-video-player.cjs                    | 8th `if [ -f ... ]` block + recap echo extension                 | WIRED    | Per 24-01 SUMMARY: `bash -n scripts/deploy.sh` exits 0; deploy ran green             |
| Production curl https://couchtonight.app/sw.js        | Service worker CACHE = 'couch-v37-native-video-player'   | curl-verified at 2026-05-01T03:47:39Z                            | WIRED    | Re-verified during this run: cache string returned matches expected                  |
| confirmStartWatchparty (movie flow)                   | wp.videoUrl + wp.videoSource fields                      | readAndValidateVideoUrl('movie') → setDoc                        | WIRED    | Per 24-03 SUMMARY: js/app.js:10908 + wp record extension at ~10932                   |
| confirmGamePicker (game flow)                         | wp.videoUrl + wp.videoSource fields                      | readAndValidateVideoUrl('game') → setDoc                         | WIRED    | Per 24-03 SUMMARY: js/app.js:10423 + wp record extension at ~10465                   |
| scheduleSportsWatchparty (sport flow)                 | wp.videoUrl + wp.videoSource fields                      | readAndValidateVideoUrl('sport') → setDoc                        | WIRED    | Per 24-03 SUMMARY: js/app.js:10231 + wp record extension at ~10277                   |
| openWatchpartyLive                                    | attachVideoPlayer (after coordination paint)             | window.openWatchpartyLive appends attachVideoPlayer call         | WIRED    | Per 24-03 SUMMARY: js/app.js:11284-11308                                             |
| closeWatchpartyLive                                   | teardownVideoPlayer (FIRST, before stopSportsScorePolling) | window.closeWatchpartyLive line 1                              | WIRED    | Per 24-03 SUMMARY: js/app.js:11309 — `teardownVideoPlayer()` is first line           |
| renderWatchpartyLive                                  | #wp-live-coordination only (REVIEWS H1)                  | `getElementById('wp-live-coordination')` (was 'wp-live-content') | WIRED    | Per 24-03 SUMMARY: js/app.js:11424 — verified no DOM accesses to #wp-video-surface  |
| broadcastCurrentTime                                  | Firestore wp record with extended schema                 | updateDoc with 5 schema fields + writeAttribution               | WIRED    | Per 24-03 SUMMARY: js/app.js:11084                                                   |
| renderPlayerErrorOverlay                              | window.reloadWatchpartyPlayer via [data-action='retry-video'] | delegated click handler on .wp-video-frame                  | WIRED    | Per 24-03 SUMMARY: js/app.js:11107 (factory) + 11277 (window fn)                     |
| seekToBroadcastedTime call sites                      | non-host player init for both YT + MP4 branches          | inside attachVideoPlayer onReady (YT) + immediate (MP4)         | WIRED    | Smoke sentinel + per 24-03 SUMMARY                                                   |
| firestore.rules host-only branch                      | tests/rules.test.js #wp3 assertion                       | assertFails on non-host currentTimeMs write                      | WIRED    | Outcome 2 confirmed; post-tighten 48 passing / 0 failing per 24-04 SUMMARY           |

### Behavioral Spot-Checks

| Behavior                                                              | Command                                                              | Result                                                | Status   |
| --------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------- | -------- |
| Smoke contract exits 0 with all assertions green                     | `npm run smoke:native-video-player`                                  | 46 OK / 0 FAIL; "ALL ASSERTIONS PASSED"               | PASS     |
| Module imports + exports correctly                                    | `node --check js/native-video-player.js`                             | exit 0                                                | PASS     |
| App.js syntax valid                                                   | `node --check js/app.js`                                             | exit 0                                                | PASS     |
| Service worker syntax valid                                           | `node --check sw.js`                                                 | exit 0                                                | PASS     |
| Production deploy live with new cache                                 | `curl -fsSL https://couchtonight.app/sw.js \| grep "const CACHE"`    | `const CACHE = 'couch-v37-native-video-player';`      | PASS     |
| All key consumer symbols present in js/app.js                         | grep count of attach/teardown/broadcast/seek/read/render symbols     | 35 occurrences                                        | PASS     |
| REVIEWS M4 inline isFinite + getDuration co-occur                     | grep `isFinite([^)]*getDuration\|getDuration()[^;]*isFinite`         | 1 match at js/app.js:11179                            | PASS     |
| Firestore rules contain host-only field denylist                      | grep `currentTimeMs\|hostUid` in firestore.rules                     | 14 matches in lines 561-600 spanning the new branch   | PASS     |
| Rules-tests contain Phase 24 wp coverage                              | grep `wp_phase24_test\|Phase 24 — watchparty video fields`           | Multiple matches at tests/rules.test.js:104, 838, 848 | PASS     |
| Three distinct schedule-modal URL field IDs in app.html               | grep `wp-video-url-(movie\|game\|sport)`                             | All 3 distinct IDs found at lines 1120/1155/1195      | PASS     |
| DOM scaffold split present in app.html                                | grep `wp-video-surface\|wp-live-coordination`                        | Both div siblings at lines 1219 + 1223                | PASS     |

### Requirements Coverage

All 18 VID-24-* requirements from REQUIREMENTS.md verified as **Complete** with traceability commit hashes:

| Requirement | Source Plan | Description                                              | Status   | Evidence                                                                                                  |
| ----------- | ----------- | -------------------------------------------------------- | -------- | --------------------------------------------------------------------------------------------------------- |
| VID-24-01   | 24-03       | YouTube iframe player branch (div-placeholder per H3)    | SATISFIED | js/app.js:11119 attachVideoPlayer YT branch; commit 90de0ad                                              |
| VID-24-02   | 24-02       | parseVideoUrl helper (5 YT shapes + protocol gate)       | SATISFIED | js/native-video-player.js parseVideoUrl; commit 9c1f511; smoke 13 assertions OK                          |
| VID-24-03   | 24-03       | HTML5 `<video>` MP4 branch with playsinline              | SATISFIED | js/app.js:11119 attachVideoPlayer MP4 branch; commit 90de0ad                                             |
| VID-24-04   | 24-02       | parseVideoUrl MP4 detection                              | SATISFIED | `if (/\.mp4$/i.test(u.pathname))` at js/native-video-player.js:73; commit 9c1f511                        |
| VID-24-05   | 24-02 + 24-03 | titleHasNonDrmPath helper + render-gate wiring         | SATISFIED | js/native-video-player.js:82 helper + js/app.js:11119/11434-11440 gates; commits 9c1f511 + f58f186 + 90de0ad |
| VID-24-06   | 24-03       | wp-video-url-movie field + readAndValidateVideoUrl       | SATISFIED | app.html:1195 + js/app.js:10908; commits 44d55a7 + c6de53e                                               |
| VID-24-07   | 24-03       | wp-video-url-game + wp-video-url-sport (M3 distinct IDs) | SATISFIED | app.html:1120 + 1155; js/app.js:10423 + 10231; commits 44d55a7 + c6de53e                                  |
| VID-24-08   | 24-03       | wp.videoUrl + wp.videoSource on wp record at creation    | SATISFIED | All 3 flows persist videoUrl + videoSource; commit c6de53e                                                |
| VID-24-09   | 24-02 + 24-03 | Host-only currentTime broadcast at 5s cadence          | SATISFIED | js/app.js:11084 broadcastCurrentTime; VIDEO_BROADCAST_INTERVAL_MS = 5000; commits 9c1f511 + 90de0ad      |
| VID-24-10   | 24-02       | makeIntervalBroadcaster throttle helper                  | SATISFIED | js/native-video-player.js:98; smoke 4 assertions OK; commit 9c1f511                                       |
| VID-24-11   | 24-03       | iOS playsinline both branches                            | SATISFIED | YT playerVars + `<video playsinline>`; commit 90de0ad                                                     |
| VID-24-12   | 24-01       | Smoke contract (≥28 assertions, production-module import) | SATISFIED | scripts/smoke-native-video-player.cjs 288 lines, 46 assertions; commits 0a0e3e8 + 2fb5ae0                |
| VID-24-13   | 24-04       | sw.js CACHE bumped to couch-v37-native-video-player      | SATISFIED | sw.js:8 + production curl-verified; commit 897e9ec                                                        |
| VID-24-14   | 24-03       | renderPlayerErrorOverlay + delegated retry click (H4)    | SATISFIED | js/app.js:11261 + 11107 + 11277; commit 90de0ad                                                           |
| VID-24-15   | 24-02 + 24-03 | seekToBroadcastedTime helper + call sites              | SATISFIED | js/native-video-player.js:141 + js/app.js attach onReady; commits 9c1f511 + 90de0ad                      |
| VID-24-16   | 24-03       | DOM scaffold split (REVIEWS H1)                          | SATISFIED | app.html:1219 + 1223; renderer retargets coordination at js/app.js:11424; commits 44d55a7 + f58f186     |
| VID-24-17   | 24-03       | HTTP MP4 mixed-content warning toast (C1)                | SATISFIED | js/app.js:10871 readAndValidateVideoUrl flashToast on http:// MP4; commit c6de53e                         |
| VID-24-18   | 24-04       | Firestore rules verification + tightening (M2)           | SATISFIED | tests/rules.test.js 5 new tests + firestore.rules host-only branch; 48 passing / 0 failing; commit a2fd4b0 |

**Coverage:** 18/18 requirements satisfied at source-tree level. VID-24-18 has a follow-up: cross-repo Firestore rules deploy is a separate user-initiated ritual (queuenight/ mirror) — defense-in-depth follow-up; client-gate remains primary defense.

### REVIEWS Coverage Closure (Cross-AI Review — 14 findings)

| Finding | Severity | Closed by         | State                                                   |
| ------- | -------- | ----------------- | ------------------------------------------------------- |
| H1      | HIGH     | Plan 03           | RESOLVED (DOM split + renderer retarget)                |
| H2      | HIGH     | Plan 01           | RESOLVED (production-module dynamic import)             |
| H3      | HIGH     | Plan 03           | RESOLVED (div-placeholder + videoId binding)            |
| H4      | HIGH     | Plan 03           | RESOLVED (delegated click handler + reload fn)          |
| H5      | HIGH     | Plan 03           | RESOLVED (module-scope handler refs + removeEventListener) |
| M1      | MEDIUM   | Plan 02 + 03      | RESOLVED (helper + call sites)                          |
| M2      | MEDIUM   | Plan 04           | RESOLVED at source-tree (cross-repo rules deploy pending) |
| M3      | MEDIUM   | Plan 03           | RESOLVED (3 distinct flow IDs)                          |
| M4      | MEDIUM   | Plan 03           | RESOLVED (per-sample isFinite + getDuration)            |
| C1      | MEDIUM   | Plan 03           | RESOLVED (flashToast on http:// MP4)                    |
| C2      | MEDIUM   | Plan 02 + 03      | RESOLVED (5-field broadcast)                            |
| L1      | LOW      | Plan 03 (auto)    | AUTO-MITIGATED (H1 fix dissolved L1)                    |
| L2      | LOW      | Plan 03 (noted)   | NOTED — deferred; no other YT API consumer              |
| L3      | LOW      | Plan 04           | RESOLVED (frontmatter clarified; checkpoint-as-emit)    |

**14 of 14 findings addressed.** 12 resolved end-to-end at code level; 1 resolved-pending-cross-repo-deploy (M2 — production rules deploy is user-initiated); 1 noted as deferred risk (L2).

### Anti-Patterns Found

None blocking. The "Issues Encountered" sections of plan SUMMARYs document the benign `MODULE_TYPELESS_PACKAGE_JSON` Node warning during smoke runs (consistent across Phase 22+24 smokes; out of scope for Phase 24).

### Human Verification Required

11 device-UAT scripts pending in `.planning/phases/24-native-video-player/24-HUMAN-UAT.md`:

#### 1. Schedule wp with YouTube link (movie flow)
- **Test:** Open Couch → tap a movie title → Start a watchparty; paste YT URL into wp-video-url-movie; tap Send invites
- **Expected:** wp persists with videoUrl + videoSource='youtube'; modal closes
- **Why human:** Real iPhone PWA interaction with wp-start modal cannot be programmatically verified

#### 2. Open watchparty live modal — YouTube branch loads inline
- **Test:** Tap wp in upcoming list at start time; wait for modal to slide up
- **Expected:** Player div renders inside #wp-video-surface (REVIEWS H1); YT IFrame API replaces div with iframe
- **Why human:** Visual rendering + YT IFrame API timing requires real device + real network

#### 3. YouTube plays inline on iOS (no fullscreen yank)
- **Test:** Tap YouTube play button
- **Expected:** Video plays inline; no native iOS fullscreen takeover
- **Why human:** iOS Safari fullscreen behavior is platform-specific

#### 4. REVIEWS H1 verification — player survives reactions + timer ticks
- **Test:** While video playing, tap reaction emojis 5+ times; wait through timer ticks
- **Expected:** Player keeps playing; never resets to 0:00; audio uninterrupted
- **Why human:** Multi-event live behavior requires real watchparty + human input cadence

#### 5. Schedule wp with .mp4 link (game-picker flow — REVIEWS M3)
- **Test:** Game Mode picker → paste .mp4 URL into wp-video-url-game → tap Use this game
- **Expected:** wp persists with videoUrl + videoSource='mp4' on game wp record
- **Why human:** Real device interaction with game-picker modal

#### 6. MP4 plays inline on iOS (no fullscreen yank)
- **Test:** Tap `<video>` play button
- **Expected:** Video plays inline; native iOS controls visible; no fullscreen takeover
- **Why human:** iOS HTML5 `<video>` playsinline behavior is device-specific

#### 7. REVIEWS M1 verification — late-join seek for non-host (two-phone test)
- **Test:** Phone A plays video for ~30s; Phone B opens live modal
- **Expected:** Phone B's player starts at ~30s position, NOT 0:00
- **Why human:** Two-device coordination + real Firestore propagation + seekToBroadcastedTime call sequencing

#### 8. DRM-hide branch — silent dead-end
- **Test:** Open Netflix-only title (no rent/buy) → Start wp with YT URL pasted → open live modal
- **Expected:** Modal renders WITHOUT player surface; no error copy; #wp-video-surface empty
- **Why human:** Requires real Netflix-only TMDB title in family library

#### 9. Invalid URL — submit-blocked inline error
- **Test:** Paste 'not-a-url-at-all' → tap Send invites
- **Expected:** Border red (.field-invalid); inline error copy; modal stays open
- **Why human:** Visual border + error copy rendering needs real device

#### 10. REVIEWS C1 verification — HTTP MP4 mixed-content warning toast
- **Test:** Paste `http://192.168.1.20:32400/library/parts/123/file.mp4` → tap Send invites
- **Expected:** Modal closes AND non-blocking toast: "Note: HTTP links may be blocked by the browser. Use https if available."
- **Why human:** flashToast visual surface + duration on real device

#### 11. Two-device REVIEWS C2 schema verification
- **Test:** Phone A host plays video; Phone B participant reloads after ~10s; check Firestore Console for extended schema
- **Expected:** wp record contains currentTimeMs + currentTimeUpdatedAt + currentTimeSource + durationMs + isLiveStream
- **Why human:** Firestore Console inspection of live wp record post-broadcast requires real session

### Gaps Summary

**No code-level gaps.** Phase 24 is shipped end-to-end at couchtonight.app on cache `couch-v37-native-video-player` (production curl-verified at 2026-05-01T03:47:39Z). All 18 VID-24-* requirements are Complete with traceability commit hashes. All 14 cross-AI REVIEWS findings are addressed (12 resolved, 1 resolved-pending-cross-repo-deploy [M2], 1 noted-deferred [L2]). Smoke contract green (46 OK / 0 FAIL) with 35 helper-behavior + 11 production-code sentinels.

**Two follow-ups expected per phase plan, neither blocks code-shipped phase status:**

1. **Cross-repo Firestore rules deploy (REVIEWS M2 production-side closure):** `firestore.rules` was tightened in source-tree (host-only Path A + 10-field denylist Path B), 48 passing / 0 failing. Production rules deploy is intentionally non-automated per Couch's cross-repo posture — user-initiated via `cd ~/queuenight && cp ~/couch/firestore.rules . && firebase deploy --only firestore:rules --project queuenight-84044`. Until then, source-tree rules differ from production rules; client gate (`state.me.id === wp.hostId`) is the primary defense and continues to hold. Defense-in-depth follow-up; recommended within 7 days.

2. **Real-device UAT (24-HUMAN-UAT.md, 11 scripts):** Per GSD convention for deployed phases, HUMAN-UAT.md presence is `passed` with carry-over — but per the verifier directive, this report sets status to `human_needed` because the 11 scripts cover the only verification dimensions the verifier cannot resolve via codebase inspection (visual rendering, iOS fullscreen behavior, two-device coordination, DRM-only TMDB title library check, Firestore Console post-broadcast inspection, real-time reaction-storm + player-survival behavior). Resume signal: reply `uat passed` → triggers `/gsd-verify-work 24` to close.

---

_Verified: 2026-05-01_
_Verifier: Claude (gsd-verifier)_
