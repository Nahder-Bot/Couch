---
phase: 24-native-video-player
created: 2026-04-30
cache_version: couch-v37-native-video-player
deploy_ts: 2026-05-01T03:47:39Z
status: partial
total_scripts: 11
results: pending
reviews_addressed: H1, H2, H3, H4, H5, M1, M2, M3, M4, C1, C2 (L1 mitigated by H1; L2 noted; L3 frontmatter clarified)
---

# Phase 24 — Native Video Player — HUMAN-UAT

> Real-device UAT tracker. Resume signal `uat passed` → trigger `/gsd-verify-work 24`.

## Test environment

- Two iPhones (or one iPhone + one Android, but iPhone is the primary surface per CLAUDE.md)
- One device runs in iOS Safari (in-tab); the other in PWA standalone (home-screen icon)
- Both signed into the SAME Couch family
- Pre-test cache flush: long-press the home-screen icon → Remove App → reinstall, OR Settings → Safari → Clear History
- After flush, reload couchtonight.app/app — confirm active SW = `couch-v37-native-video-player` (DevTools → Application → Service Workers, or check `navigator.serviceWorker.controller` console output)

## UAT scripts

| # | Script | Branch | Pre-condition | Steps | Expected | Status |
|---|---|---|---|---|---|---|
| 1 | Schedule wp with YouTube link (movie flow) | YouTube | Open Couch → tap a movie title → Start a watchparty | (a) tap "Start a watchparty" (b) set timing (c) paste a YouTube URL e.g. `https://www.youtube.com/watch?v=dQw4w9WgXcQ` into "Video URL (optional)" — note the field id is `wp-video-url-movie` (REVIEWS M3) (d) tap Send invites | wp persists with videoUrl + videoSource='youtube'; modal closes; wp appears in upcoming list | ⬜ pending |
| 2 | Open watchparty live modal — YouTube branch loads inline | YouTube | Script 1's wp is at start time | (a) tap the wp in upcoming list (b) wait for modal to slide up | Player div renders inside `#wp-video-surface` (persistent surface — REVIEWS H1); YouTube IFrame API replaces the div with its own iframe (REVIEWS H3 binding pattern); .wp-live-poster is HIDDEN; YouTube poster thumbnail visible inside the iframe | ⬜ pending |
| 3 | YouTube plays inline on iOS (no fullscreen yank) | YouTube | Script 2 modal open | (a) tap the YouTube play button | Video plays INLINE in the modal — does NOT yank to native iOS fullscreen on tap | ⬜ pending |
| 4 | **REVIEWS H1 verification** — player survives reactions | YouTube | Script 3 video playing | (a) while video is playing, tap reaction emojis 5+ times in a row (b) wait through a timer tick (every 1s the live-modal repaints the timer) (c) observe the player | Player KEEPS PLAYING through every reaction post and timer tick. Video does NOT reset to 0:00. Audio uninterrupted. (Pre-fix: this was catastrophic — the player would reset on every reaction.) | ⬜ pending |
| 5 | Schedule wp with .mp4 link (game-picker flow — REVIEWS M3) | MP4 | Open Couch → Game Mode picker → pick a league | (a) "Tonight's game" picker open (b) paste a public .mp4 URL e.g. `https://download.samplelib.com/mp4/sample-5s.mp4` into "Video URL (optional)" — note the field id is `wp-video-url-game` (REVIEWS M3) (c) tap "Use this game" | wp persists with videoUrl + videoSource='mp4' on the game wp record | ⬜ pending |
| 6 | MP4 plays inline on iOS (no fullscreen yank) | MP4 | Script 5's wp open | (a) tap the `<video>` play button | Video plays inline. Native iOS controls visible. No fullscreen takeover | ⬜ pending |
| 7 | **REVIEWS M1 verification** — late-join seek for non-host | YouTube or MP4 | Two-phone test: phone A is host playing for ~30s (player at ~30s position); phone B is a non-host who has NOT yet joined the live modal | (a) Phone A starts playing the video; let it run 30s. (b) Phone B taps the wp in upcoming list to open the live modal | Phone B's player starts at ~30s position, NOT 0:00. Within ~5s of phone A's last broadcast. Confirms seekToBroadcastedTime helper fires for non-hosts on player init. | ⬜ pending |
| 8 | DRM-hide branch — silent dead-end | DRM | Open Couch → a Netflix-only title (no rent/buy provider) → Start a wp with a YouTube URL pasted | Open the wp's live modal | Modal renders WITHOUT the player surface — looks byte-for-byte like today's coordination-only modal. No "we couldn't show the player" copy. Reactions panel + roster + footer all unchanged. `#wp-video-surface` is empty (CSS rule `.wp-video-surface:empty{display:none}` collapses it). | ⬜ pending |
| 9 | Invalid URL — submit-blocked inline error | Validation | Open wp-start modal | (a) paste `not-a-url-at-all` (b) tap Send invites | Input border turns red (.field-invalid); inline error reads "That link doesn't look like YouTube or an .mp4 file. Skip it or try another."; modal does NOT close | ⬜ pending |
| 10 | **REVIEWS C1 verification** — HTTP MP4 mixed-content warning | MP4 | Open wp-start modal | (a) paste `http://192.168.1.20:32400/library/parts/123/file.mp4` (typical Plex LAN URL) (b) tap Send invites | Modal closes (NOT blocked — http:// is valid syntax) AND a non-blocking warning toast appears: "Note: HTTP links may be blocked by the browser. Use https if available." | ⬜ pending |
| 11 | Two-device currentTime broadcast (REVIEWS C2 schema) | Broadcast | Two-phone test: phone A is host, phone B is participant. Both join the same wp from Script 1 or 5 | (a) phone A plays the video (b) phone B reloads after ~10s (c) check Firestore Console at families/{code}/watchparties/{wpId} for the extended schema | wp record contains: currentTimeMs (number, ms), currentTimeUpdatedAt (number, ms-since-epoch), currentTimeSource ('youtube' or 'mp4'), durationMs (number or null), isLiveStream (boolean). Phase 26 will consume these fields without migration. | ⬜ pending |

## Player error overlay (non-blocking polish UAT — REVIEWS H4)

- Pasting a 404 .mp4 URL should surface the inline italic-serif "Player couldn't load that link." + Try again link. **Tap the Try again link** — it should re-issue the load (REVIEWS H4 fix wires the previously-decorative link). Pre-fix: tap did nothing.

## Resume protocol

- Mark each script ⬜ pending → ✅ pass → ❌ fail with notes
- On full pass: reply `uat passed` → Claude triggers `/gsd-verify-work 24` automatically
- On any fail: reply with the script number + observation; Claude triages

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Notes

- Per CONTEXT.md `<specifics>`: silent UX on DRM-hide branch is BY DESIGN, not a bug. Do NOT add explanatory copy.
- YouTube live-stream URLs (e.g. `youtube.com/watch?v=<live-id>`): currentTime broadcast is GATED OFF per-sample at runtime (REVIEWS M4 — isFinite + getDuration > 0 check inside the broadcaster callback). Acceptable; documented.
- Plex / Jellyfin HTTP URLs surface a non-blocking submit-time warning (REVIEWS C1). User can still proceed — some setups work.
- **REVIEWS L1 (host sync loop):** Mitigated by REVIEWS H1 — the persistent #wp-video-surface is immune to coordination re-renders, including those triggered by host's own Firestore snapshot.
- **REVIEWS L2 (YT global overwrite):** Noted as deferred risk. Couch has no other YT API consumer in 2026-04. If a future phase adds one, switch to chained-handler pattern.
- **REVIEWS M2 (rules verification):** Plan 04 Task 4.2 added 5 rules-tests covering host-can / non-host-cannot for currentTime fields. firestore.rules WAS tightened with a host-only branch — production rules deploy is a separate cross-repo ritual (see 24-04-SUMMARY.md "Cross-repo rules deploy reminder"). Until production rules are deployed, the existing client gate (`state.me.id === wp.hostId` in Plan 03 Task 3.4) is the only barrier — but client gating remains the primary defense even after rules deploy.
- **REVIEWS H4 (retry link):** Player error overlay's Try-again link is now functional via delegated click handler on `[data-action="retry-video"]`. Pre-fix it was decorative.
- **REVIEWS H3 (YT.Player binding):** YouTube branch renders `<div id="wp-yt-player" data-video-id="...">` placeholder; YouTube IFrame API replaces the div with its own iframe (more reliable than binding to a pre-existing iframe).
- **REVIEWS H5 (MP4 listener cleanup):** Module-scope handler refs (`_wpVideoTimeHandler`, `_wpVideoErrorHandler`, `_wpRetryClickHandler`) are removed via `removeEventListener` in `teardownVideoPlayer()` — no listener leaks across modal open/close cycles.
- **REVIEWS M3 (distinct schedule-modal IDs):** Three distinct flow-prefixed input IDs: `wp-video-url-movie`, `wp-video-url-game`, `wp-video-url-sport`. Validation reads via `'wp-video-url-' + flow` template.
- **REVIEWS C2 (Phase 26 schema):** Each broadcast writes 5 fields — `currentTimeMs`, `currentTimeUpdatedAt`, `currentTimeSource`, `durationMs`, `isLiveStream`. Phase 26 forward-compatible.
- **Cache version:** active SW post-deploy is `couch-v37-native-video-player`. Bump path: v36.7-live-scoreboard (Phase 23) → v37-native-video-player (Phase 24).

## Gaps

(none surfaced as of scaffold creation; populated as UAT progresses)

---

*Phase: 24-native-video-player*
*HUMAN-UAT scaffolded: 2026-04-30 (deploy 2026-05-01T03:47:39Z to couchtonight.app)*
*Cache version: couch-v37-native-video-player*
