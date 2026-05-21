---
phase: 24-native-video-player
plan: 02
subsystem: video-player
tags: [phase-24, native-video-player, pure-helpers, module-creation, es-module, watchparty, throttle, drm-detection, url-parser, reviews-revision]

# Dependency graph
requires:
  - phase: 22-sports-feed-abstraction
    provides: js/sports-feed.js module-creation precedent (header comment shape, export style, no-top-level-side-effects discipline)
  - phase: 7-watchparty
    provides: wp record schema (Firestore families/{code}/watchparties/{id}) — Plan 02 helpers read t.providers / t.rentProviders / t.buyProviders from existing schema-version 3 shape
provides:
  - js/native-video-player.js — pure-helpers ES module with 7 named exports
  - parseVideoUrl(input) — 5 YouTube shapes + .mp4 detection + protocol allowlist (rejects javascript:/data:/file:/malformed/unknown-host)
  - titleHasNonDrmPath(t) — D-03 detection threshold (false ONLY when ALL stream providers are DRM brands AND no rent/buy paths)
  - makeIntervalBroadcaster(intervalMs, fn) — Pattern 3 leading + trailing edge throttle (last-value semantics for Phase 26 replay anchoring)
  - seekToBroadcastedTime(player, wp, source) — REVIEWS M1 late-join seek for non-hosts (YouTube seekTo + MP4 one-shot loadedmetadata listener fallback; staleness-gated)
  - VIDEO_BROADCAST_INTERVAL_MS = 5000 (D-09 host-only broadcast cadence)
  - STALE_BROADCAST_MAX_MS = 60_000 (REVIEWS C2 — Phase 26 forward-compat staleness window)
  - DRM_FLAT_RATE_PROVIDER_BRANDS — Set of provider name strings (D-03 allowlist; mirrors TMDB_PROVIDER_IDS map at js/app.js:13006)
affects:
  - 24-01 (smoke contract — dynamic-imports this module via await import; REVIEWS H2 fix)
  - 24-03 (UI surface — static imports parseVideoUrl + titleHasNonDrmPath + makeIntervalBroadcaster + seekToBroadcastedTime + VIDEO_BROADCAST_INTERVAL_MS + STALE_BROADCAST_MAX_MS from this module)
  - 26-position-anchored-reactions (will grep VIDEO_BROADCAST_INTERVAL_MS + STALE_BROADCAST_MAX_MS as Phase-26-stable schema anchors)

# Tech tracking
tech-stack:
  added: []  # No new dependencies — pure ES module, browser-native APIs only
  patterns:
    - "Phase 22 module-creation precedent (sibling of js/sports-feed.js)"
    - "Pure-helper ES module — no top-level side effects (no DOM, no network, no Date.now() at import time)"
    - "Leading + trailing edge throttle factory (closure-scoped state, no setInterval)"
    - "One-shot self-removing event listener for late-binding APIs (HTMLVideoElement.loadedmetadata)"

key-files:
  created:
    - js/native-video-player.js (176 lines, 7 named exports)
  modified: []

key-decisions:
  - "Module-level isolation chosen over inline-in-app.js (Phase 22 precedent applied; helper bundle is coherent enough — parser + DRM + throttle + seek + 2 constants — to warrant module-level isolation per RESEARCH §Recommended Project Structure)"
  - "STALE_BROADCAST_MAX_MS exported as a named symbol (not a hardcoded literal in seekToBroadcastedTime body) so Phase 26 + Plan 03 can grep one stable name for replay-anchor staleness decisions (REVIEWS C2 closure)"
  - "seekToBroadcastedTime owns the MP4 one-shot loadedmetadata listener (self-removing) instead of the caller (Plan 03) — keeps the listener-leak class out of app-state vars entirely (sidesteps REVIEWS H5 listener-ref discipline for this code path)"
  - "Module is import-symmetric: Plan 01 dynamic-imports (await import) for smoke testing, Plan 03 static-imports for production wiring — same source of truth, no test-mirror drift (REVIEWS H2 fix)"

patterns-established:
  - "Pattern: pure-helpers ES module sibling to app.js — helper bundle of ≥4 helpers + ≥2 constants warrants module-level isolation (Phase 22 + Phase 24 precedent)"
  - "Pattern: protocol-allowlist URL parser — `if (u.protocol !== 'https:' && u.protocol !== 'http:') return null` BEFORE any host/path inspection (T-24-02-01 mitigation)"
  - "Pattern: bounded character classes only — `/^[A-Za-z0-9_-]{6,}$/` on a single-segment pathname; no nested quantifiers; URL constructor pre-rejects malformed input (T-24-02-04 catastrophic-backtracking mitigation)"
  - "Pattern: defensive-on-missing-data DRM detector — null/missing/empty providers return TRUE (don't hide on incomplete data; rent/buy escape hatch covers Crunchyroll/Shudder edge cases per RESEARCH Pitfall 4)"
  - "Pattern: leading + trailing edge throttle factory — first call fires immediately (UX feedback); subsequent calls within interval queue setTimeout for the LAST value (Phase 26 needs accurate replay anchoring)"

requirements-completed:
  - VID-24-02   # parseVideoUrl helper (5 YouTube shapes + protocol gate)
  - VID-24-04   # MP4 detection in parseVideoUrl
  - VID-24-05   # titleHasNonDrmPath helper (D-03 detection threshold)
  - VID-24-10   # makeIntervalBroadcaster throttle helper
  - VID-24-15   # seekToBroadcastedTime helper (REVIEWS M1 late-join seek)

# Metrics
duration: ~3 min
completed: 2026-05-01
---

# Phase 24 Plan 02: Pure-Helpers ES Module Summary

**`js/native-video-player.js` ships as a 176-line pure-helpers ES module with 7 named exports — parseVideoUrl (5 YT shapes + protocol allowlist), titleHasNonDrmPath (D-03 detection), makeIntervalBroadcaster (Pattern 3 throttle), seekToBroadcastedTime (REVIEWS M1 late-join seek), VIDEO_BROADCAST_INTERVAL_MS, STALE_BROADCAST_MAX_MS, DRM_FLAT_RATE_PROVIDER_BRANDS — locking the contract surface that Plan 01's smoke (dynamic import) and Plan 03's UI wiring (static import) both consume. Phase 22 module-creation precedent applied; REVIEWS H2 (test-mirror drift) + M1 (seek-on-join) + C2 (Phase 26 staleness forward-compat) all closed at this layer.**

## Performance

- **Duration:** ~3 min (160 seconds)
- **Started:** 2026-05-01T03:09:11Z
- **Completed:** 2026-05-01T03:11:51Z
- **Tasks:** 1 (Task 2.1)
- **Files modified:** 0; **Files created:** 1

## Accomplishments

- New ES module `js/native-video-player.js` created (sibling of `js/sports-feed.js`, `js/utils.js`, `js/auth.js`) — 176 lines, 7 named exports
- 35 behavioral assertions passed in inline node-driven verification covering every `must_haves.truths` row from the plan frontmatter:
  - parseVideoUrl: 5 YouTube shapes + 2 MP4 shapes + 7 rejection cases (`empty`, `null`, `not a url`, `javascript:`, `data:`, `file:`, `vimeo.com`)
  - titleHasNonDrmPath: null/missing/all-DRM-no-escape (false)/all-DRM-with-rent (true)/mixed-stream (true)
  - makeIntervalBroadcaster: leading edge fires immediately + trailing setTimeout fires with LAST value (after queue overwrite)
  - seekToBroadcastedTime: YouTube fresh seek (true, args [5, true]) / stale skip / zero-ms skip / null-player skip / null-wp skip / MP4 metadata-ready (currentTime set) / MP4 not-ready (one-shot loadedmetadata listener registered)
  - Constants: VIDEO_BROADCAST_INTERVAL_MS === 5000, STALE_BROADCAST_MAX_MS === 60000, DRM_FLAT_RATE_PROVIDER_BRANDS.size >= 13
- REVIEWS H2 (test-mirror drift) closed at the module layer — Plan 01's smoke can now `await import('../js/native-video-player.js')` directly instead of inlining helper-body mirrors that drift from production
- REVIEWS M1 (seek-on-join) closed in the helper layer — Plan 03 only needs to call `seekToBroadcastedTime(player, wp, source)` after `attachVideoPlayer` initialization for non-hosts; the staleness gate, source dispatch, and MP4 metadata-ready dance are all owned by this helper
- REVIEWS C2 (Phase 26 forward-compat) closed — `STALE_BROADCAST_MAX_MS` is a stable named symbol Phase 26 can grep alongside `VIDEO_BROADCAST_INTERVAL_MS` for replay-anchor decisions
- No top-level side effects (no DOM access, no network, no Date.now() at import time) — verified by clean dynamic import returning all 7 named symbols with correct types and zero side-effect output

## Task Commits

Task was committed atomically:

1. **Task 2.1: Create js/native-video-player.js** — `9c1f511` (feat)

_Plan-close metadata commit will follow this SUMMARY (separate from per-task commits per task_commit_protocol)._

## Files Created/Modified

- `js/native-video-player.js` (created, 176 lines) — pure-helpers ES module: 7 named exports (3 constants + 4 functions); zero imports, zero top-level side effects, browser-`<script type="module">`-loadable; sibling of `js/sports-feed.js`. Header comment + Exports list mirrors Phase 22 shape.

## Decisions Made

- **Module-level isolation chosen over inline-in-app.js.** Phase 22 (`js/sports-feed.js`) is the canonical precedent for "helper bundle coherent enough to warrant a module"; Phase 24's bundle (parser + DRM detector + throttle factory + seek helper + cadence constant + staleness constant) is similarly coherent. Co-locating in `js/app.js` would have fit Phase 21/15.5/18/19/20/23 precedent, but module-level isolation gives Plan 01's smoke a clean dynamic-import surface (REVIEWS H2 fix is mechanical instead of needing `module.exports` shims) and gives Phase 26 named symbols (`VIDEO_BROADCAST_INTERVAL_MS`, `STALE_BROADCAST_MAX_MS`) to grep against rather than scattered inline literals.
- **`STALE_BROADCAST_MAX_MS` is a named export, not an inline literal.** REVIEWS C2 forward-compat closure: Phase 26's replay-anchor decisions need the same staleness window the runtime seek helper uses. Naming it makes drift impossible.
- **`seekToBroadcastedTime` owns its MP4 `loadedmetadata` one-shot listener.** Self-removing handler (the listener calls `removeEventListener` after firing once) keeps this leak class entirely out of `js/app.js`'s module-scope vars — Plan 03's REVIEWS H5 listener-ref discipline only needs to cover the `timeupdate` + `error` listeners on the `<video>` element, not the seek-on-join listener.
- **Module exports `DRM_FLAT_RATE_PROVIDER_BRANDS` as a `Set`, not an `Array`.** O(1) `.has()` lookup inside `titleHasNonDrmPath`'s `.every()` matters when titles surface large `t.providers` arrays from TMDB; defensive coding doesn't pay an O(n²) DRM check.

## Deviations from Plan

None — plan executed exactly as written. The literal module file content block in the plan's `<action>` (≈177 source lines including the closing newline) was committed verbatim with one cosmetic difference: the file ends with a single trailing newline (Unix convention) which `wc -l` counts as 176 lines (the last `}` followed by `\n` is line 176; the next byte is EOF).

No deviation rules invoked. No auth gates. No fix-attempt loops. Single-task plan, single commit, single verification pass.

## Issues Encountered

- **Node `MODULE_TYPELESS_PACKAGE_JSON` warning** when running `node -e "import('./js/native-video-player.js')..."` from CLI. This is a Node CLI quirk (the project's `package.json` lacks `"type": "module"` because Couch is a no-bundler PWA loaded by the browser via `<script type="module">`, not by Node). Warning is benign in production (browser doesn't read `package.json`), benign in CLI verification (the import still succeeds), and out of scope for Plan 02. Plan 01 (smoke contract) may or may not address this — it's their wrapper-script call. Not a regression; matches the existing Couch project posture (no Node module-type declaration; ES modules served directly to browsers).

## User Setup Required

None — no external service configuration, no env vars, no dashboard changes. Pure source-code addition.

## Self-Check

**Files claimed created:**
- `js/native-video-player.js` — FOUND (176 lines, syntactically valid via `node --check`, dynamic-importable with all 7 named exports)
- `.planning/phases/24-native-video-player/24-02-SUMMARY.md` — this file (FOUND post-write)

**Commits claimed:**
- `9c1f511` (Task 2.1) — FOUND in `git log`

## Self-Check: PASSED

## Next Phase Readiness

**Wave 2 unblocked:**
- **Plan 24-01 (smoke contract)** can now `await import('../js/native-video-player.js')` to test the production module directly. The 7 named exports it expects (`parseVideoUrl`, `titleHasNonDrmPath`, `makeIntervalBroadcaster`, `seekToBroadcastedTime`, `VIDEO_BROADCAST_INTERVAL_MS`, `STALE_BROADCAST_MAX_MS`, `DRM_FLAT_RATE_PROVIDER_BRANDS`) all exist with the expected types. Inline node verification already proved 35 behavioral assertions hold; the formal smoke contract Plan 01 ships will be a richer codification of the same surface.
- **Plan 24-03 (UI surface)** can now write `import { parseVideoUrl, titleHasNonDrmPath, makeIntervalBroadcaster, seekToBroadcastedTime, VIDEO_BROADCAST_INTERVAL_MS, STALE_BROADCAST_MAX_MS } from './native-video-player.js';` near `js/app.js:7-14` (alongside the existing `auth.js` / `sports-feed.js` import block). All helper bodies match the contract Plan 03's render branches + lifecycle pair will assume.

**Phase 26 forward-compat:** `STALE_BROADCAST_MAX_MS` and `VIDEO_BROADCAST_INTERVAL_MS` are stable named exports Phase 26 can `grep` for during replay-anchor design.

**No blockers.** Plan 02 ships clean.

---
*Phase: 24-native-video-player*
*Plan: 02 (Wave 1 — pure-helpers foundation)*
*Completed: 2026-05-01*
