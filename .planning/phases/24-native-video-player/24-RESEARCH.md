# Phase 24: Native Video Player (iframe + HTML5) — Research

**Researched:** 2026-04-30
**Domain:** in-page video playback (YouTube iframe + HTML5 `<video>`) + Firestore broadcast plumbing inside an iOS-first PWA
**Confidence:** HIGH (everything load-bearing for the planner is either verified in the project's own code or cited from official docs; one explicitly `[ASSUMED]` cadence recommendation is flagged below)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Iframe player at v2 launch supports **YouTube only**. Existing pattern at `js/app.js:7838` and `:13667` (trailer embeds) is the reusable scaffold. URL parser must extract video ID from all three YouTube URL shapes (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`). Twitch + Vimeo + generic embed allowlist explicitly deferred.
- **D-02:** HTML5 player at v2 launch supports **MP4 only** via native `<video>` tag — paste any URL. No HLS, no DASH, no library deps (per project no-bundler constraint). Plex / Jellyfin work via their transcoded MP4 URLs (auth in query string, paste-as-is).
- **D-03:** DRM-restricted streaming titles → **hide the player surface entirely.** Watchparty modal renders today's coordination-only shape. Detection signal: TMDB provider data on the title. No "play it elsewhere" message, no fallback picker.
- **D-04:** URL entry = **optional manual paste field on watchparty creation only.** Add `Video URL (YouTube or .mp4)` field to `scheduleWatchparty` + `scheduleSportsWatchparty` modals. Skipping = today's coordination-only behavior. No mid-party attach. No TMDB pre-fill. Validation on submit, soft-reject malformed URLs with inline error. Stored on wp record as `wp.videoUrl` + `wp.videoSource: 'youtube' | 'mp4'`.

### Claude's Discretion (research locks the leaning unless evidence revises)

- **`currentTime` broadcast cadence + sync model.** Default leaning: 1 write / 5s per active host. Pause/play recorded but not actively synced at v2.0. Researcher to confirm or revise.
- **Player surface placement.** Default leaning: player slots into top of live modal, replacing `wp-live-poster` + `wp-live-titlename` header when URL is set. Reactions panel + roster + DVR slider stay where they are. Native fullscreen via iframe / `<video>` controls; no custom Couch fullscreen orchestrator at v2.0.
- **Scope split.** Default leaning: ship iframe + HTML5-MP4 together in one Phase 24 deploy. Direct-ship (Phases 21/22/23) does NOT fit — formal `/gsd-plan-phase 24 → /gsd-execute-phase 24` chain probably better given new schema.

### Deferred Ideas (OUT OF SCOPE — research must not pad findings around these)

- Twitch + Vimeo iframe support (v2.1+)
- HLS (.m3u8) + DASH (.mpd) format support (v2.1+; `hls.js` is the canonical lib)
- Generic iframe-allowlist / paste-any-embed surface (v3 — needs security review)
- Mid-party "Attach a video" affordance
- TMDB trailer pre-fill
- DRM "play on elsewhere" message (explicitly rejected)
- Active host-paused-so-everyone-pauses sync (separate UX phase)
- Reaction overlay positioned over player (Phase 26 territory)
- Voice / video chat over the player (v3 per `seeds/v3-voice-video-chat-watchparty.md`)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

ROADMAP.md describes scope for Phase 24 but does NOT yet declare formal `VID-24-XX` style requirement IDs. The locked CONTEXT.md decisions D-01 through D-04 + the three Claude's-Discretion areas are the de-facto requirement set this research is sized against. The planner should mint formal IDs at `/gsd-plan-phase 24` (suggested form: `VID-24-01`..`VID-24-NN`).

| Provisional ID | Capability | Source | Research Support |
|---|---|---|---|
| VID-24-01 | YouTube iframe player surface inside `wp-live-modal` (D-01) | CONTEXT.md D-01 | Standard Stack §YouTube IFrame API + Architecture §Pattern 1 + Code Examples §1 |
| VID-24-02 | URL parser: YouTube ID extraction across `watch?v=` / `youtu.be/` / `shorts/` (+ embed/m. shapes) (D-01) | CONTEXT.md D-01 + Focus Area 5 | Code Examples §3 + Common Pitfalls §3 |
| VID-24-03 | HTML5 `<video>` player surface for MP4 URLs (D-02) | CONTEXT.md D-02 | Code Examples §2 + Common Pitfalls §1 + iOS PWA section |
| VID-24-04 | URL parser: MP4 detection (D-02) | CONTEXT.md D-02 + Focus Area 5 | Code Examples §3 |
| VID-24-05 | DRM detection helper hides player surface (D-03) | CONTEXT.md D-03 | Code Examples §4 + Don't Hand-Roll §3 |
| VID-24-06 | `Video URL (optional)` field on `scheduleWatchparty` modal (D-04) | CONTEXT.md D-04 + UI-SPEC §Schedule-modal field | Architecture §Pattern 2 |
| VID-24-07 | `Video URL (optional)` field on `scheduleSportsWatchparty` flow (D-04) | CONTEXT.md D-04 | Code Touchpoints §`scheduleSportsWatchparty` |
| VID-24-08 | `wp.videoUrl` + `wp.videoSource` schema on wp record (D-04) | CONTEXT.md D-04 + canonical_refs | Standard Stack §Firestore + State of the Art |
| VID-24-09 | `currentTime` broadcast (host-only) at chosen cadence | Discretion area + 26 hard ordering | Architecture §Pattern 3 + Common Pitfalls §2 |
| VID-24-10 | Throttle helper (locks cadence in code; testable in smoke) | Discretion area | Code Examples §5 + Smoke Contract section |
| VID-24-11 | iOS Safari `playsinline` correctness for both player branches | Focus Area 6 | Common Pitfalls §1 + iOS PWA section |
| VID-24-12 | Phase smoke contract `scripts/smoke-native-video-player.cjs` | Established pattern (Phases 18/19/20/21/22) | Smoke Contract section |
| VID-24-13 | sw.js CACHE bump | CLAUDE.md mandate | Project Constraints §sw.js CACHE bump |
| VID-24-14 | Player error inline state ("Player couldn't load that link" + Try again) | UI-SPEC §Interaction States | Code Examples §6 |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

These are non-negotiable for Phase 24 plans:

- **No bundler.** Plain ES modules under `js/`. No webpack/vite/rollup. Anything new must work in browsers as a `<script type="module">` or via the existing `js/app.js` `import` graph.
- **`js/app.js` is ~16k lines (~190K tokens).** Never read in full; grep + offset/limit. Plans must NOT instruct the executor to read the whole file.
- **Public-by-design secrets.** TMDB key + Firebase web config stay client-side. Don't move them.
- **TMDB rate limits ~40 req/10s.** Phase 24 doesn't need NEW TMDB calls (DRM detection reads existing `t.providers` / `t.rentProviders` / `t.buyProviders`), so this is observed by default.
- **`sw.js` CACHE bump on every user-visible change** via `bash scripts/deploy.sh <short-tag>` — auto-bumps. Recommended tag for this phase: `37-native-video-player` → `couch-v37-native-video-player`.
- **Test on iOS Safari (PWA primary surface).** All player branches must be UAT'd on a real iPhone in standalone (home-screen) mode AND in-Safari mode.
- **Phase numbering safeguards.** Phase 24 was reassigned (old 24 + 25 merged) — captured in `seeds/v2-watchparty-sports-milestone.md`. No further renumbering during this phase.
- **Two repos, one phase.** This phase ships couch-only. No queuenight / Cloud Function changes anticipated. Existing host-write Firestore rules already cover `wp.videoUrl` writes (writes to `families/{code}/watchparties/{id}` by host are authorized via Phase 5 + 7 rules; verified pattern at `js/app.js:10271` `setDoc(watchpartyRef(id), …)`).

---

## Summary

Phase 24 introduces Couch's first native video playback surface inside the existing watchparty live modal. Two player branches (YouTube iframe + HTML5 `<video>`) share a single URL parser pipeline, a single Firestore schema (`wp.videoUrl` + `wp.videoSource`), and a single `currentTime` broadcast mechanism that Phase 26 will consume.

Every load-bearing technology choice is **already in Couch's codebase or in the iOS Safari standard library** — there's no new third-party dependency. YouTube IFrame Player API is the official surface for reading `currentTime` from a YouTube embed; HTML5 `<video>` exposes `currentTime` natively via the `timeupdate` event. The DRM-detection helper reads existing `t.providers` / `t.rentProviders` / `t.buyProviders` data — no new TMDB calls. The URL parser is a 30-line helper. The throttle is a closure.

**Primary recommendation:** Ship as one phase with three plans: (1) URL parser + DRM detection + smoke contract (pure helpers, no UI), (2) live-modal player surface for both branches + `currentTime` broadcast + schedule-modal URL field, (3) sw.js CACHE bump + deploy. Cadence: **5s host-only `currentTime` writes** (matches default leaning; verified safe against Firestore's 1-write/sec/document soft cap and well below the project's existing write budget). The cadence is precise enough for Phase 26's "Red Wedding" replay use case (5s anchor granularity is finer than typical reaction-burst windows).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| YouTube iframe rendering | Browser / Client | — | Pure DOM — `<iframe>` is a browser primitive; Couch only sets `src`. |
| HTML5 MP4 playback | Browser / Client | — | Pure DOM — `<video>` is a browser primitive; iOS Safari handles codecs natively. |
| `currentTime` polling (YouTube) | Browser / Client | — | YouTube IFrame Player API runs in the browser via postMessage; no server. |
| `currentTime` polling (HTML5) | Browser / Client | — | `timeupdate` event is a browser-fired event on `<video>`. |
| URL parsing (YouTube ID extract + MP4 detect) | Browser / Client | — | Pure JS string work; no network call. |
| DRM detection (TMDB provider check) | Browser / Client | — | Reads pre-fetched `t.providers` already in `state.titles`; no live TMDB call. |
| `wp.videoUrl` schema persistence | Database / Storage | API/Backend (existing Firestore rules) | `families/{code}/watchparties/{id}` writes go through existing host-write rule branch — no new rule branch needed. |
| `currentTime` broadcast write throttle | Browser / Client | Database / Storage | Throttle lives in client code; written value lands in Firestore. |
| Fullscreen orchestration | Browser / Client | — | Native iframe / `<video>` chrome handles it. Couch does NOT add a custom orchestrator. |
| Reaction overlay over player | (deferred Phase 26) | — | Phase 24 keeps reactions in their existing position panel — out of scope. |

---

## Standard Stack

### Core (already in the project — nothing new to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| YouTube IFrame Player API | always-current (Google CDN) | Read `currentTime` + state changes from a YouTube embed | Canonical surface from Google for programmatic control of YouTube embeds. `[CITED: developers.google.com/youtube/iframe_api_reference]` |
| Native HTML5 `<video>` element | browser built-in | MP4 playback + `currentTime` + `timeupdate` event | Zero deps, zero bundler impact, MP4 is a Couch v2 D-02 hard scope lock. `[VERIFIED: MDN HTMLMediaElement.timeupdate event spec]` |
| Native HTML5 `<iframe>` element | browser built-in | YouTube embed surface | Already in project at `js/app.js:7838 / :13667` for trailers. `[VERIFIED: js/app.js grep]` |
| Firebase Firestore | already wired (project `queuenight-84044`) | `wp.videoUrl` + `currentTime` persistence | Couch's primary data layer. Existing host-write rules cover the writes. `[VERIFIED: js/app.js:10271 + 10976 setDoc/updateDoc patterns on watchpartyRef(id)]` |

### Supporting (no install required — these are already imported / in `js/utils.js` / `js/app.js`)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `escapeHtml` | `js/utils.js` | XSS-safe iframe `src` interpolation | Every place we drop the YouTube ID or MP4 URL into HTML |
| `flashToast` | `js/utils.js` | Soft validation error feedback | URL parser rejection on schedule modal submit |
| `writeAttribution()` | `js/app.js` | Stamps every wp write with auth + actingMemberId | Required on all `wp.videoUrl` and `currentTime` writes (Phase 5 / 15.1 contract) |
| `state.watchparties` + `watchpartyRef(id)` | `js/state.js` + `js/app.js` | Existing wp record read / write surface | All persistence flows through here |

### Alternatives Considered

| Instead of | Could Use | Tradeoff (why we don't) |
|------------|-----------|-------------------------|
| YouTube IFrame Player API | `postMessage` directly (manual protocol) | More fragile, no upgrades, easy to get wrong. The API is just a thin wrapper; cost is one ~80KB script tag from `youtube.com/iframe_api`. |
| Native `<video>` for MP4 | `video.js` / `plyr` library | Adds bundler-incompatible deps; CSS theme conflicts with Couch design system; loses MP4-only D-02 simplicity. |
| Hand-rolled URL regex | `URL` constructor + `URLSearchParams` | Use both — `URL` for hostname/pathname, regex only for the `youtu.be/` short form. (See Code Examples §3.) |
| In-memory throttle | `lodash.throttle` | Same — adds a dep for ~10 lines of code. Roll inline. |

**Installation:** None. Phase 24 adds zero new third-party packages.

**Version verification:** YouTube IFrame Player API is loaded from `https://www.youtube.com/iframe_api` — Google maintains versioning server-side; clients always get the latest. No `npm view` applicable. `[CITED: developers.google.com/youtube/iframe_api_reference]`

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────── User on iOS PWA ───────────────────┐
│                                                       │
│  scheduleWatchparty / scheduleSportsWatchparty modal  │
│              │                                        │
│              │ user types URL into                    │
│              │ "Video URL (optional)" field           │
│              ▼                                        │
│   ┌──────────────────────┐                            │
│   │ parseVideoUrl(str)   │ ──► returns:               │
│   │ - YouTube ID extract │     { source, id?, url? }  │
│   │ - .mp4 detect        │     OR null (invalid)      │
│   │ - reject otherwise   │                            │
│   └──────────────────────┘                            │
│              │ valid                                  │
│              ▼                                        │
│   updateDoc(watchpartyRef(id), {                      │
│     videoUrl: parsed.url,                             │
│     videoSource: parsed.source,                       │
│     ...writeAttribution()                             │
│   })                                                  │
│              │                                        │
│              ▼                                        │
│  ┌──────────── Firestore ──────────────┐              │
│  │  families/{code}/watchparties/{id}  │              │
│  │  + videoUrl, videoSource (NEW)      │              │
│  │  + currentTimeMs (broadcast, NEW)   │              │
│  │  + currentTimeUpdatedAt (NEW)       │              │
│  │  + isPaused (NEW, recorded only)    │              │
│  └─────────────────────────────────────┘              │
│              │ onSnapshot fan-out                     │
│              ▼                                        │
│  Live modal opens (renderWatchpartyLive)              │
│              │                                        │
│   ┌──────────┴──────────┐                             │
│   │ DRM check:          │                             │
│   │ titleHasNonDrmPath  │                             │
│   │  (t)                │                             │
│   └──────────┬──────────┘                             │
│              │                                        │
│       ┌──────┴───── if DRM-only OR no URL: HIDE player surface
│       │                                               │
│       ▼ player allowed AND wp.videoUrl set            │
│   ┌─────────────────────┐                             │
│   │ wp.videoSource ===  │                             │
│   │   'youtube'?        │                             │
│   └─────┬────────┬──────┘                             │
│         │YES     │NO (mp4)                            │
│         ▼        ▼                                    │
│   ┌─────────┐  ┌──────────────────┐                   │
│   │ YouTube │  │ <video           │                   │
│   │ iframe  │  │   src=videoUrl   │                   │
│   │ + YT.   │  │   playsinline    │                   │
│   │ Player  │  │   controls />    │                   │
│   └────┬────┘  └────┬─────────────┘                   │
│        │            │                                 │
│        │ if (host)  │ if (host)                       │
│        ▼            ▼                                 │
│   getCurrentTime    timeupdate event                  │
│        │            │                                 │
│        └─────┬──────┘                                 │
│              ▼                                        │
│   ┌───────────────────────────────┐                   │
│   │ throttle(5000ms host-only)    │                   │
│   │   updateDoc(wpRef, {          │                   │
│   │     currentTimeMs,            │                   │
│   │     currentTimeUpdatedAt,     │                   │
│   │     ...writeAttribution()     │                   │
│   │   })                          │                   │
│   └───────────────────────────────┘                   │
│                                                       │
│   Phase 26 reads `currentTimeMs` for runtime-anchor   │
└───────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Phase 24 adds **no new modules** — everything slots into the existing pattern:

```
js/
├── app.js                # all new player code lives here, near renderWatchpartyLive (line 11115)
├── utils.js              # (no changes — escapeHtml/flashToast already used)
├── state.js              # (no changes — wp record schema is denormalized into state.watchparties)
├── firebase.js           # (no changes)
└── constants.js          # (optional: add VIDEO_BROADCAST_INTERVAL_MS = 5000 here)

scripts/
└── smoke-native-video-player.cjs   # NEW (~25-30 assertions)

css/
└── app.css               # add .wp-video-frame block (~12 lines per UI-SPEC §Layout/Component Contracts)

app.html
└── (add new <div class="field"> for Video URL inside #schedule-modal at line 967-968)
```

**Co-location guidance for app.js:** put helpers near related code:
- URL parser + DRM detection → near `TMDB_PROVIDER_IDS` at `:13006` (sibling of provider helpers)
- `currentTime` broadcast throttle → near `renderWatchpartyLive` at `:11115` (sibling of player surface code)
- Player init / teardown → adjacent to `closeWatchpartyLive` at `:11003` (lifecycle pair)

### Pattern 1: YouTube iframe with `enablejsapi=1` + lazy YT.Player init

**What:** Render a YouTube embed iframe with `enablejsapi=1` in the URL, then load the IFrame Player API script asynchronously. When `onYouTubeIframeAPIReady` fires, instantiate `YT.Player` against the existing iframe element to get `getCurrentTime()` access.

**When to use:** Every YouTube-source watchparty (D-01 surface).

**Source:** `[CITED: developers.google.com/youtube/iframe_api_reference]`

**Example:**

```javascript
// Source: developers.google.com/youtube/iframe_api_reference
// Step 1: Render the iframe with enablejsapi=1
const ytEmbedUrl = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1`;
container.innerHTML = `<iframe id="wp-yt-player" class="wp-video-frame--youtube"
  src="${ytEmbedUrl}" frameborder="0"
  allow="autoplay; encrypted-media; picture-in-picture"
  allowfullscreen></iframe>`;

// Step 2: Load the API script idempotently (only once per session)
if (!window.YT && !document.getElementById('youtube-iframe-api-script')) {
  const tag = document.createElement('script');
  tag.id = 'youtube-iframe-api-script';
  tag.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(tag);
}

// Step 3: When API is ready, attach the player
window.onYouTubeIframeAPIReady = function() {
  const player = new YT.Player('wp-yt-player', {
    events: {
      'onReady': (e) => {
        // Player is ready; getCurrentTime() will return non-NaN now
        if (state.me && state.me.id === currentWp.hostId) {
          startCurrentTimeBroadcast(player, currentWp.id);
        }
      },
      'onStateChange': (e) => {
        // YT.PlayerState: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
        if (e.data === YT.PlayerState.PAUSED) recordPauseState(currentWp.id, true);
        if (e.data === YT.PlayerState.PLAYING) recordPauseState(currentWp.id, false);
      }
    }
  });
};
```

**Key gotcha:** `onYouTubeIframeAPIReady` is a single global callback. If two iframes mount in the same session, the second mount must check `window.YT && YT.Player` directly and instantiate without waiting for the global. Plan a small `whenYTReady(cb)` helper.

### Pattern 2: HTML5 `<video>` with `playsinline` + `timeupdate`

**What:** Native `<video controls playsinline preload="metadata" src="...mp4">` with a `timeupdate` listener that reads `video.currentTime`.

**When to use:** Every MP4-source watchparty (D-02 surface).

**Source:** `[CITED: MDN HTMLMediaElement.timeupdate event]` — fires "between every 4Hz and 66Hz" (4-66 times per second; browser-dependent).

**Example:**

```javascript
// Source: MDN HTMLMediaElement
const html = `<video class="wp-video-frame--mp4" controls playsinline
  preload="metadata" src="${escapeHtml(mp4Url)}"></video>`;
container.innerHTML = html;
const video = container.querySelector('video');

if (state.me && state.me.id === currentWp.hostId) {
  // timeupdate fires 4-66Hz — throttle to 5s for Firestore writes
  const broadcast = throttleBroadcast(5000, () => broadcastCurrentTime(currentWp.id, video.currentTime));
  video.addEventListener('timeupdate', broadcast);
  video.addEventListener('pause',  () => recordPauseState(currentWp.id, true));
  video.addEventListener('play',   () => recordPauseState(currentWp.id, false));
  video.addEventListener('error',  () => renderPlayerErrorOverlay(container));
}
```

**Key gotcha:** `playsinline` is REQUIRED for inline playback on iPhone. Without it, iOS Safari forces fullscreen on play (iPad has different behavior — fullscreen-on-play used to be optional pre-iOS 10). `[CITED: developer.mozilla.org/en-US/docs/Web/HTML/Element/video — playsinline attribute]` `[VERIFIED: WebKit blog 2017 "preview-of-video-features-in-safari-and-ios-10"]`. PWA standalone mode inherits Safari behavior; same attribute still applies.

### Pattern 3: Host-only throttled `currentTime` broadcast

**What:** A simple closure that calls `updateDoc` at most once per N milliseconds, scoped to the host (not every member).

**When to use:** Inside both player branches (Pattern 1 and 2), as the host's broadcast loop.

**Example:**

```javascript
// Local helper, no library
function makeIntervalBroadcaster(intervalMs, broadcastFn) {
  let lastWriteAt = 0;
  let pendingValue = null;
  let pendingTimer = null;

  return function(value) {
    pendingValue = value;
    const now = Date.now();
    const sinceLast = now - lastWriteAt;

    if (sinceLast >= intervalMs) {
      // Fire immediately
      lastWriteAt = now;
      broadcastFn(pendingValue);
      pendingValue = null;
      return;
    }
    // Debounce a trailing write so the last value before pause/end lands
    if (!pendingTimer) {
      pendingTimer = setTimeout(() => {
        lastWriteAt = Date.now();
        broadcastFn(pendingValue);
        pendingValue = null;
        pendingTimer = null;
      }, intervalMs - sinceLast);
    }
  };
}
```

**Why this shape:** leading-and-trailing edge throttle = first event lands immediately (good UX feedback) AND the last value before pause/end gets persisted. Pure `setInterval` would race the Firestore client; pure leading-edge throttle drops the trailing pause moment that Phase 26 needs for accurate replay anchoring.

### Anti-Patterns to Avoid

- **Don't put the iframe / `<video>` inside a container that toggles `display:none` for "hide while loading."** Pre-Phase-24 trailer pattern at `:7838` does NOT do this — it just renders or doesn't. Mirror that. Toggling display while a media element is loading triggers spurious `error` events on iOS Safari.
- **Don't broadcast every `timeupdate` event.** It fires up to 66Hz (60+ writes/second) — Firestore would reject writes after the per-second cap and you'd waste write quota. Throttle to 5s.
- **Don't write `currentTime` from every member.** Only the host (`state.me.id === wp.hostId`) writes. If you wrote per-member, write volume scales with party size — Pattern 3 keeps it linear at one writer per wp.
- **Don't call `getCurrentTime()` on a YT.Player before `onReady` fires.** It returns `undefined`/0/`NaN` depending on browser. Gate on the `onReady` event.
- **Don't add `Couch-rendered loading spinner over the iframe.** Per UI-SPEC §Interaction States: "Loading (first paint) — Black frame visible until iframe / `<video>` paints first frame. NO Couch-rendered spinner overlay." The black frame IS the loading state.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Read `currentTime` from a YouTube iframe | Custom `postMessage` protocol talking to `youtube.com/embed` directly | YouTube IFrame Player API (`youtube.com/iframe_api` script) | The protocol is undocumented and changes; the API is supported and versioned. `[CITED: developers.google.com/youtube/iframe_api_reference]` |
| Detect MP4 URL | "Trust user paste blindly" OR "fetch HEAD and read Content-Type" | Lightweight URL parser + extension check (`.mp4` in `pathname.toLowerCase()`) | HEAD probe adds latency + CORS issues for Plex/Jellyfin private servers. Trust-paste with format-rejection on `<video>` `error` event is the simplest correct path. The `<video>` element ITSELF is the validator (it'll fail to play malformed URLs and fire `error` — Phase 24 has an inline error-overlay UI for this per UI-SPEC). |
| Detect DRM-only titles | Maintain a hardcoded list of "evil" providers | Reuse existing `t.providers` (Stream bucket) + `t.rentProviders` + `t.buyProviders` already on every Couch title | The data is already there. If a title has ONLY flat-rate streaming providers (Netflix/Disney+/Max/Prime/Apple TV+) and no rent/buy providers, it's DRM-only by construction. Verified schema at `js/app.js:16` (`out.providers / rentProviders / buyProviders`). |
| Throttle Firestore writes | `lodash.throttle` | Inline closure (Pattern 3) | 12 lines of code; no dep needed. |
| Fullscreen orchestration | Custom modal with synthetic fullscreen | Native iframe / `<video>` controls fullscreen | iOS Safari hands `<video>` fullscreen off to its native player; YouTube iframe hands off to YouTube app or its own player. CONTEXT.md Discretion area locked: no custom Couch fullscreen orchestrator at v2.0. |
| Auto-pause-everyone-when-host-pauses | Cross-member pause sync coordinator | Record pause state on wp record, do NOT actively sync (CONTEXT.md Discretion area locked) | This is its own UX phase. v2.0 records but doesn't enforce. |

**Key insight:** Phase 24 has zero genuinely-new technology surface. Every primitive (iframe, `<video>`, Firestore, TMDB providers, throttle closure) is either already in the project or in the standard browser library. Plans should be small.

---

## Common Pitfalls

### Pitfall 1: iOS Safari forces `<video>` fullscreen without `playsinline`

**What goes wrong:** User taps play on the MP4 player → iOS Safari yanks the video out of the watchparty modal and into a fullscreen overlay → on close, the modal context may be lost or the `<video>` element disposed.

**Why it happens:** Default iOS Safari behavior is to play video fullscreen on iPhone unless `playsinline` is explicitly set. This was changed in iOS 10 to allow inline-by-default IF the developer opts in via the attribute. `[CITED: webkit.org/blog/6784/new-video-policies-for-ios — 2016, still current as of iOS 18 testing]`

**How to avoid:** ALWAYS render `<video>` with `playsinline` AND, if you're going to autoplay, also `muted`:
```html
<video controls playsinline preload="metadata" src="...">
```

For YouTube, the iframe URL must include `playsinline=1`:
```
https://www.youtube.com/embed/${id}?enablejsapi=1&playsinline=1
```

**Warning signs:** UAT on iPhone shows player vanishing into native fullscreen on first play.

### Pitfall 2: `timeupdate` fires too fast → Firestore write throttling rejects writes

**What goes wrong:** Naive `video.addEventListener('timeupdate', () => updateDoc(...))` triggers 4-66 writes per second (browser-dependent). Firestore enforces a soft 1-write/sec/document limit — exceeding it triggers backoff, error breadcrumbs, and quota burn.

**Why it happens:** `timeupdate` is "best effort" — spec says "should fire about 4 times per second on average" but Chrome/Safari fire much more often (~30-66Hz observed). `[CITED: html.spec.whatwg.org/multipage/media.html#event-media-timeupdate]`

**How to avoid:** Pattern 3 throttle. Cadence = 5000ms (1 write per 5s). At 5s cadence: 12 writes/min × 60 min/hour = 720 writes/hour/wp. Even with 5 concurrent watchparties = 3600 writes/hour — well under Firestore's free-tier 20K writes/day burn rate, and an order of magnitude under Phase 18's `providerRefreshTick` daily write budget.

**Warning signs:** Sentry breadcrumbs `progress.write.failed` or `videoBroadcast.write.failed` (new) firing after a wp starts; client-side console errors about Firestore quota.

### Pitfall 3: YouTube URL parser misses one of three shapes

**What goes wrong:** User pastes `https://youtu.be/M7lc1UVf-VE` → naive parser only handles `watch?v=` → "That link doesn't look like YouTube" error → user frustrated.

**Why it happens:** YouTube has at least 5 in-the-wild URL shapes:
1. `https://www.youtube.com/watch?v=ID`
2. `https://youtu.be/ID`
3. `https://www.youtube.com/shorts/ID`
4. `https://www.youtube.com/embed/ID`
5. `https://m.youtube.com/watch?v=ID` (mobile redirect target)

**How to avoid:** Code Examples §3 below — single function handles all five via `URL` + `URLSearchParams` (no regex needed for the long forms; one regex for `youtu.be/` short form).

**Warning signs:** UAT user reports "I pasted a YouTube link and it said it wasn't YouTube." → check which shape they pasted.

### Pitfall 4: DRM check says "DRM-only" for titles user could legitimately paste an MP4 for

**What goes wrong:** Title is on Netflix AND has a "Buy" provider (Apple TV / Vudu) → DRM check sees flat-rate Netflix and hides the player → user can't paste their own legit MP4.

**Why it happens:** Naive check: "if `t.providers.length > 0` then DRM-only." Wrong — `t.providers` is the Stream/SVOD bucket; rent/buy buckets exist separately at `t.rentProviders` / `t.buyProviders`.

**How to avoid:** The detection threshold per UI-SPEC §3 is "ALL providers are DRM-restricted" — if even ONE provider is rent/buy/free-with-ads (where a direct MP4 paste is plausible), the player surface still shows up if the user provided a URL. Helper signature in Code Examples §4.

**Warning signs:** Plex / Jellyfin users reporting "I have a legit MP4 of this title but Couch is hiding the player."

### Pitfall 5: Mixed-content blocking on Plex / Jellyfin URLs

**What goes wrong:** User pastes `http://192.168.1.10:32400/video.mp4` (Plex local server, plain HTTP) → couchtonight.app is HTTPS → browser blocks the mixed-content load → `<video>` `error` event fires → Couch shows "Player couldn't load that link" with no actionable signal.

**Why it happens:** Modern browsers block HTTP media loads inside HTTPS pages. Plex's web player works around this via plex.tv's HTTPS edge; raw LAN URLs don't.

**How to avoid:** This is a fundamental browser security policy — Couch can't fix it. Plans should include a smoke-contract assertion that the URL parser can RECOGNIZE the URL as MP4-shaped (so the schedule-modal validation passes) and let the in-modal `<video> error` handler surface the player-failure overlay. Bonus: detect `http://` (not `https://`) at parse time and surface a more specific schedule-modal error: "Plex or Jellyfin links must use HTTPS — try the cloud-relay URL." Stretch goal; not required for v2 launch.

**Warning signs:** Plex / Jellyfin user reports "I pasted my MP4 URL but the player won't play it" — check the URL scheme.

### Pitfall 6: YT.Player instantiation race when modal closes mid-load

**What goes wrong:** User opens watchparty modal → iframe starts loading → user closes modal before `onYouTubeIframeAPIReady` fires → `YT.Player` tries to bind to a no-longer-existing DOM element → uncaught error → potential memory leak.

**Why it happens:** YouTube IFrame API loads asynchronously; the global `onYouTubeIframeAPIReady` callback fires on a timeline independent of the modal lifecycle.

**How to avoid:** In `closeWatchpartyLive` (`:11003`), null out any cached YT.Player reference and remove the iframe from the DOM. Wrap the `new YT.Player(...)` call in a check `if (!document.getElementById('wp-yt-player')) return;`. Also: clear any pending `currentTime` broadcast timer on close.

**Warning signs:** Sentry errors mentioning `YT.Player`, `getElementById('wp-yt-player')` returning null, or memory growth on rapid open/close.

### Pitfall 7: Phase 26 inheritance lock-in

**What goes wrong:** Phase 24 ships at 5s cadence. Phase 26 builds replay UX assuming 5s anchor granularity. User then complains the replay "skips" reactions that fired ≤5s apart. Phase 26 can't fix it because the data was never recorded at finer resolution.

**Why it happens:** Whatever cadence Phase 24 ships, Phase 26 inherits. Reaction bursts during a key moment can fire faster than 5s.

**How to avoid:** This is the canonical "discretion area" question. Two paths:
- **Path A (recommended for v2.0):** Ship 5s cadence. Phase 26 records reactions at wall-clock + interpolates against the 5s `currentTime` snapshots. Most reactions are spaced > 5s apart in practice; the few that aren't will cluster within the same 5s window — perceptually fine for replay.
- **Path B (only if user prefers):** Ship 2-3s cadence. Doubles write volume but tightens replay precision. Still well under Firestore's per-doc 1-write/sec cap if throttled correctly.

**Recommendation:** Path A. The "Red Wedding minute 25" use case is about NARRATIVE moments, not millisecond synchronization — 5s is plenty.

**Warning signs:** Phase 26 design discussion surfaces "replay feels jumpy" feedback.

---

## Runtime State Inventory

> Phase 24 is greenfield (new schema fields + new player surface) — there is no existing rename / refactor / migration. This section is **omitted** by the inventory rule (greenfield phase). The `wp.videoUrl` / `wp.videoSource` / `currentTimeMs` / `currentTimeUpdatedAt` / `isPaused` fields are NEW — they don't conflict with any existing field. No data migration needed.

---

## Code Examples

Verified patterns; cite either Couch's own code or upstream docs.

### Example 1: YouTube iframe + YT.Player init

```javascript
// Source: developers.google.com/youtube/iframe_api_reference (verified via Context7 2026-04-30)
// Co-locate near renderWatchpartyLive at js/app.js:11115
function renderYouTubePlayerSurface(wp, videoId) {
  const safeId = encodeURIComponent(videoId);
  const ytEmbedUrl = `https://www.youtube.com/embed/${safeId}?enablejsapi=1&playsinline=1`;
  return `<div class="wp-video-frame">
    <iframe id="wp-yt-player" class="wp-video-frame--youtube"
      src="${ytEmbedUrl}" frameborder="0"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowfullscreen></iframe>
  </div>`;
}

// Lazy-load the YT IFrame API once per session.
let _ytApiLoading = null;
function ensureYouTubeApi() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (_ytApiLoading) return _ytApiLoading;
  _ytApiLoading = new Promise(resolve => {
    const tag = document.createElement('script');
    tag.id = 'youtube-iframe-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
    // YT API requires a global callback name
    window.onYouTubeIframeAPIReady = () => resolve();
  });
  return _ytApiLoading;
}

// Bind player AFTER renderWatchpartyLive paints the iframe.
async function attachYouTubePlayer(wp) {
  await ensureYouTubeApi();
  const el = document.getElementById('wp-yt-player');
  if (!el) return null;  // modal closed during load — bail
  return new Promise(resolve => {
    const player = new YT.Player('wp-yt-player', {
      events: {
        'onReady': () => resolve(player),
        'onStateChange': (e) => handleYtStateChange(e, wp.id)
      }
    });
  });
}
```

### Example 2: HTML5 `<video>` MP4 surface

```javascript
// Source: developer.mozilla.org/en-US/docs/Web/HTML/Element/video
// Co-locate in renderWatchpartyLive
function renderMp4PlayerSurface(wp) {
  // escapeHtml is from js/utils.js (already imported)
  const safeUrl = escapeHtml(wp.videoUrl);
  return `<div class="wp-video-frame">
    <video id="wp-mp4-player" class="wp-video-frame--mp4"
      controls playsinline preload="metadata" src="${safeUrl}"></video>
  </div>`;
}

function attachMp4Player(wp) {
  const video = document.getElementById('wp-mp4-player');
  if (!video) return null;
  if (state.me && state.me.id === wp.hostId) {
    const broadcast = makeIntervalBroadcaster(VIDEO_BROADCAST_INTERVAL_MS, () => {
      broadcastCurrentTime(wp.id, video.currentTime);
    });
    video.addEventListener('timeupdate', broadcast);
    video.addEventListener('pause', () => recordPauseState(wp.id, true));
    video.addEventListener('play',  () => recordPauseState(wp.id, false));
  }
  video.addEventListener('error', () => renderPlayerErrorOverlay('wp-mp4-player'));
  return video;
}
```

### Example 3: URL parser — the load-bearing helper

```javascript
// Source: derived from MDN URL + URLSearchParams docs + the 5-shape inventory above.
// Co-locate near TMDB_PROVIDER_IDS at js/app.js:13006 (sibling of provider helpers)
//
// Returns null on invalid; { source: 'youtube', id, url } or { source: 'mp4', url } on valid.
// MUST be pure (no side effects) so smoke contract can verify it.
function parseVideoUrl(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  let u;
  try { u = new URL(trimmed); }
  catch (e) { return null; }  // not a valid URL

  // Must be http or https; refuse anything else (file://, data:, etc.)
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;

  const host = u.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');

  // YouTube — five recognized shapes
  // 1. youtube.com/watch?v=ID
  // 2. youtu.be/ID  (host is youtu.be, ID is in pathname)
  // 3. youtube.com/shorts/ID
  // 4. youtube.com/embed/ID
  // 5. m.youtube.com/watch?v=ID  (handled by host normalization above)
  if (host === 'youtube.com') {
    if (u.pathname === '/watch') {
      const id = u.searchParams.get('v');
      if (id && /^[A-Za-z0-9_-]{6,}$/.test(id)) return { source: 'youtube', id, url: trimmed };
    }
    const m = u.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{6,})/);
    if (m) return { source: 'youtube', id: m[1], url: trimmed };
  }
  if (host === 'youtu.be') {
    const m = u.pathname.match(/^\/([A-Za-z0-9_-]{6,})/);
    if (m) return { source: 'youtube', id: m[1], url: trimmed };
  }

  // MP4 — pathname ends in .mp4 (case-insensitive). Query string allowed (Plex/Jellyfin auth).
  if (/\.mp4$/i.test(u.pathname)) return { source: 'mp4', url: trimmed };

  return null;
}
```

### Example 4: DRM detection helper

```javascript
// Co-locate near TMDB_PROVIDER_IDS at js/app.js:13006.
// IDs are TMDB watch-provider IDs — consistent with the existing TMDB_PROVIDER_IDS map.
// Reads existing schema (verified at js/app.js:16: out.providers / rentProviders / buyProviders).
const DRM_FLAT_RATE_PROVIDER_BRANDS = new Set([
  'Netflix', 'Disney Plus', 'Max', 'HBO Max', 'Amazon Prime Video',
  'Amazon Prime Video with Ads', 'Apple TV Plus', 'Apple TV+',
  'Paramount Plus', 'Paramount+', 'Hulu', 'Peacock', 'Peacock Premium'
]);

// Returns true when the title has at least ONE non-DRM path (rent / buy / no providers known).
// "No providers known" = title hasn't been availability-checked yet — assume non-DRM (let user paste).
// "All providers are flat-rate DRM" = DRM-only — hide player surface (per D-03).
function titleHasNonDrmPath(t) {
  if (!t) return true;  // no title → no DRM evidence → don't hide
  const stream = Array.isArray(t.providers) ? t.providers : [];
  const rent   = Array.isArray(t.rentProviders) ? t.rentProviders : [];
  const buy    = Array.isArray(t.buyProviders) ? t.buyProviders : [];

  // If we have rent or buy providers, there's a non-DRM path.
  if (rent.length > 0 || buy.length > 0) return true;

  // No providers known at all → don't hide (user might have a personal MP4)
  if (stream.length === 0) return true;

  // All stream-bucket providers are flat-rate DRM brands → DRM-only.
  const allDrm = stream.every(p => DRM_FLAT_RATE_PROVIDER_BRANDS.has(p.name));
  return !allDrm;
}
```

### Example 5: Throttle helper (Pattern 3, restated for smoke contract)

```javascript
// Co-locate near renderWatchpartyLive. Pure helper, verifiable in smoke.
function makeIntervalBroadcaster(intervalMs, fn) {
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
```

### Example 6: Player error inline overlay

```javascript
// Triggered by <video> 'error' event or YT.Player onError event.
// Per UI-SPEC §Interaction States: italic-serif "Player couldn't load that link." + Try again link.
function renderPlayerErrorOverlay(playerElementId) {
  const player = document.getElementById(playerElementId);
  if (!player) return;
  const wrap = player.closest('.wp-video-frame');
  if (!wrap) return;
  // Render at bottom of the wrapper so the black frame stays visible above
  let overlay = wrap.querySelector('.wp-video-error');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'wp-video-error';
    wrap.appendChild(overlay);
  }
  overlay.innerHTML = `<em class="serif-italic">Player couldn't load that link.</em>
    <button class="link-like" onclick="reloadWatchpartyPlayer()">Try again</button>`;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hand-rolled YouTube `postMessage` | YouTube IFrame Player API (`youtube.com/iframe_api`) | Stable since ~2014; current as of 2026 | Plan must use the API; manual postMessage is a footgun. |
| `<video>` defaults to fullscreen on iPhone | `<video playsinline>` opts into inline | iOS 10 (2016) | Without `playsinline`, watchparty modal context is lost on play. |
| `webkit-playsinline` (legacy) | `playsinline` (standard) | iOS 10+ supports both, prefer standard | Use `playsinline` (HTML5 spec); browsers ignore unknown attrs harmlessly. |
| ESPN hidden API for sports | TheSportsDB feed via `js/sports-feed.js` (Phase 22) | 2026-04-30 (just shipped) | Phase 24 doesn't touch sports — but Phase 24 player surface MUST work for sports watchparties (D-04 wires URL field into `scheduleSportsWatchparty`). |
| Trailer-only iframe pattern (`js/app.js:7838 / :13667`) | Same iframe pattern + `enablejsapi=1` parameter for player API | This phase | Trailer pattern stays intact; player adds `enablejsapi=1` and JS Player binding. |

**Deprecated/outdated:**
- `webkit-playsinline` (works but redundant — use the standard `playsinline`).
- Custom HLS players for short-form video (irrelevant — HLS deferred to v2.1+).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 5s cadence is precise enough for Phase 26's "Red Wedding" replay UX | Pitfall 7 + Summary recommendation | Phase 26 may surface "replay feels jumpy" feedback. Mitigation: cadence is a single constant `VIDEO_BROADCAST_INTERVAL_MS` — easy to tighten in a follow-up phase if needed. **`[ASSUMED]`** — but very low risk per the qualitative reasoning in Pitfall 7. |
| A2 | The 13-brand DRM list (Netflix / Disney+ / Max / HBO Max / Prime / Apple TV+ / Paramount+ / Hulu / Peacock) covers v2-launch-realistic flat-rate DRM coverage | Code Examples §4 | A title on a less-common DRM service (Crunchyroll, Shudder, AMC+) might not be detected and the player surface would render — user paste of "Netflix link" would 404 and trigger the in-modal error overlay. Acceptable degradation. **`[ASSUMED]`** based on Couch's existing TMDB_PROVIDER_IDS map at `js/app.js:13006`. |
| A3 | Existing host-write Firestore rules cover `wp.videoUrl` + `currentTimeMs` writes without rule changes | Project Constraints | If wrong, plan needs an extra task to update queuenight `firestore.rules`. **`[ASSUMED]`** — verified pattern at `js/app.js:10271` `setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() })` already writes arbitrary fields onto wp records under existing rules; the new fields are NOT in any "restricted" allowlist. Plan should include a "verify rule covers new fields" check anyway. |
| A4 | iOS 17 / 18 PWA standalone mode honors `playsinline` identically to in-Safari mode | iOS PWA section | If wrong, PWA users see fullscreen takeover on play even though Safari users don't. Mitigation: UAT on iPhone in BOTH home-screen PWA AND in-Safari surfaces. **`[ASSUMED]`** based on stable WebKit behavior since iOS 10 — no public regression reports on the matter as of 2026-04 search. |
| A5 | YouTube IFrame Player API loads in an iOS PWA standalone context (sometimes service workers gate third-party scripts) | Pattern 1 | If wrong, YouTube branch never gets `getCurrentTime()` data. Mitigation: Couch's existing trailer iframes already work in iOS PWA — confirms the third-party `youtube.com` origin is reachable. Adding `iframe_api` script would be a NEW dependency — verify in UAT. **`[ASSUMED]`**. |

**If any of these assumptions break in UAT, planner should revise the affected plan section. None blocks the planning phase — all are recoverable in a follow-up patch.**

---

## Open Questions

1. **`currentTime` semantics for sports watchparties (Phase 23 / `mode === 'game'`).**
   - What we know: Sports wps don't typically have a "video file" — they're live game broadcasts watched via the user's own TV / Sling / YouTube TV. The Video URL field on `scheduleSportsWatchparty` (D-04) means a user CAN paste a Twitch / YouTube-Live link.
   - What's unclear: Live YouTube streams don't have a meaningful `currentTime` — the API returns the time elapsed since the stream started, not a position in a finite video. Phase 26 anchor reactions to this would be weird.
   - Recommendation: Plan should include a small task to detect "is this a live YouTube stream" via `YT.Player.getDuration()` returning 0 / Infinity and SKIP the broadcast loop in that case. Sports replay UX is different from movie replay UX anyway. Surface to the user only if needed.

2. **Should the player remember `currentTime` across `closeWatchpartyLive` → `openWatchpartyLive`?**
   - What we know: Live modal can be closed and re-opened during the same session; today, reopening rebuilds via `renderWatchpartyLive` from scratch.
   - What's unclear: Should Phase 24 seek-back-to-broadcast-time on re-open, or start from 0 (browser default)?
   - Recommendation: For host: reopen at last broadcast `currentTime` (host owns the playback). For non-host: reopen at last `wp.currentTimeMs` from Firestore (best-effort sync). Stretch goal — MVP can start from 0 + let user manually seek. Plan can defer.

3. **Schedule modal Video URL: pre-fill on edit-existing?**
   - What we know: Today's `openScheduleModal(titleId)` (`:7017`) pre-fills `scheduledFor` and `scheduledNote` from the title doc. Per UI-SPEC §Schedule-modal Pre-filled state, Phase 24 should pre-fill Video URL when editing an existing wp's videoUrl.
   - What's unclear: `openScheduleModal` operates on TITLES (not on watchparties). Watchparty creation goes through `confirmStartWatchparty` (`:10845`) for movies and `scheduleSportsWatchparty` (`:10199`) for sports — neither uses `openScheduleModal`. Where does the user EDIT an existing wp's `videoUrl`?
   - Recommendation: For v2 launch, treat URL field as creation-only (no edit-existing flow). UI-SPEC §Pre-filled state is forward-compatible but not required. Defer the edit affordance to v2.1 if user demand surfaces.

4. **Does the smoke contract cover the YouTube IFrame Player API integration?**
   - What we know: Existing smoke contracts are pure Node.js scripts (no browser; no DOM; no network). They verify pure helpers.
   - What's unclear: Can we smoke-test `attachYouTubePlayer`?
   - Recommendation: NO. Smoke covers `parseVideoUrl` + `titleHasNonDrmPath` + `makeIntervalBroadcaster` (all pure helpers). Player attachment integration is verified by UAT scripts (UAT 1: paste valid YouTube → player loads; UAT 2: paste valid MP4 → player loads; UAT 3: paste DRM title's TMDB ID + try to schedule → player slot hidden). Smoke is FAST contract; UAT is integration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| YouTube IFrame Player API | YouTube branch (Pattern 1) | Yes (Google CDN, always-available) | always-current | None — but trailer iframes already work, so this is verified reachable from iOS PWA |
| Native HTML5 `<video>` | MP4 branch (Pattern 2) | Yes (browser built-in) | iOS 10+ / Safari 10+ / Chrome / FF | None needed |
| Firebase Firestore | All persistence paths | Yes (project queuenight-84044, already wired) | live | None — required |
| `js/utils.js` `escapeHtml` / `flashToast` | URL field validation feedback + iframe `src` interpolation | Yes (verified at `js/utils.js`) | live | None needed |
| `js/app.js` `writeAttribution()` | Every new wp write | Yes (verified at `:10976` reuse) | live | None needed |
| `node` for smoke contract | `scripts/smoke-native-video-player.cjs` | Yes (assumed — Phase 18-22 smokes all run via `node`) | per `package.json scripts.smoke` chain | None — required |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

> nyquist_validation is enabled in `.planning/config.json` (workflow.nyquist_validation = true). This section is REQUIRED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node.js scripts (no jest / mocha — Couch convention is plain `.cjs` scripts that exit 0/1 with `console.log` `OK` / `FAIL` lines) |
| Config file | `package.json` `scripts.smoke` chain (and per-phase `smoke:*` aliases) |
| Quick run command | `npm run smoke:native-video-player` (NEW alias to add) |
| Full suite command | `npm run smoke` (existing chain — appends new contract) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VID-24-02 | `parseVideoUrl('https://youtube.com/watch?v=ABC123def')` → `{source:'youtube', id:'ABC123def', url:...}` | unit | `npm run smoke:native-video-player` | ❌ Wave 0 — NEW file |
| VID-24-02 | `parseVideoUrl('https://youtu.be/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://youtube.com/shorts/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://m.youtube.com/watch?v=ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-02 | `parseVideoUrl('https://youtube.com/embed/ABC123def')` → `{source:'youtube',...}` | unit | (same) | ❌ Wave 0 |
| VID-24-04 | `parseVideoUrl('https://example.com/movie.mp4')` → `{source:'mp4', url:...}` | unit | (same) | ❌ Wave 0 |
| VID-24-04 | `parseVideoUrl('https://192.168.1.1:32400/file.mp4?token=abc')` → `{source:'mp4', url:...}` (Plex case) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('https://example.com/page.html')` → `null` (rejection) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('garbage')` → `null` (invalid URL) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('')` → `null` | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl(null)` → `null` (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('file:///etc/passwd')` → `null` (security) | unit | (same) | ❌ Wave 0 |
| VID-24-02/04 | `parseVideoUrl('javascript:alert(1)')` → `null` (XSS guard) | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `false` when `t.providers === [Netflix]` and rent/buy empty | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `true` when `t.providers === [Netflix]` AND `t.buyProviders === [Apple TV]` | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(t)` returns `true` when no providers known (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-05 | `titleHasNonDrmPath(null)` returns `true` (defensive) | unit | (same) | ❌ Wave 0 |
| VID-24-10 | `makeIntervalBroadcaster(100, fn)` calls fn at most once per 100ms over 5 rapid invocations (leading edge fires) | unit | (same) | ❌ Wave 0 |
| VID-24-10 | `makeIntervalBroadcaster(100, fn)` trailing-edge fires last value after interval | unit | (same) | ❌ Wave 0 |
| VID-24-08 | wp record schema fields documented (string assertion in smoke) | doc-as-test | (same) | ❌ Wave 0 |
| VID-24-01 | YouTube iframe URL constructed correctly: `enablejsapi=1` AND `playsinline=1` present | unit (string assert against helper output) | (same) | ❌ Wave 0 |
| VID-24-03 | HTML5 video tag string contains `playsinline` attribute | unit (string assert) | (same) | ❌ Wave 0 |
| VID-24-11 | Constructed iframe `src` is XSS-safe (encodeURIComponent applied to videoId) | unit | (same) | ❌ Wave 0 |
| VID-24-13 | sw.js CACHE constant bumped to `couch-v37-native-video-player` | manual smoke (existing pattern) | `grep "couch-v37-native-video-player" sw.js` | ✅ existing pattern |

**Manual UAT (deferred to `24-HUMAN-UAT.md`):**
- iOS Safari + iOS PWA: paste valid YouTube link → player renders inline (no fullscreen takeover)
- iOS Safari + iOS PWA: paste valid MP4 link → player renders inline (no fullscreen takeover)
- DRM-only title (e.g., a Netflix-exclusive) → schedule modal still allows URL field, but live modal hides player surface
- Multi-device: host plays, second device sees `currentTimeMs` updating in DevTools Firestore tab at 5s cadence
- Modal close during YT API load → no console errors
- `<video>` 404 → inline error overlay renders, "Try again" reloads

### Sampling Rate
- **Per task commit:** `npm run smoke:native-video-player` (NEW alias; ~25 assertions, < 200ms)
- **Per wave merge:** `npm run smoke` (full chain — 8 contracts, ~170 assertions, < 1s total)
- **Phase gate:** Full suite green + manual UAT passes (per `24-HUMAN-UAT.md` to be created at plan-phase)

### Wave 0 Gaps
- [ ] `scripts/smoke-native-video-player.cjs` — NEW; covers parseVideoUrl + titleHasNonDrmPath + makeIntervalBroadcaster + iframe URL construction
- [ ] `package.json` `scripts.smoke` chain extended with `&& node scripts/smoke-native-video-player.cjs`
- [ ] `package.json` `scripts.smoke:native-video-player` alias added
- [ ] `scripts/deploy.sh` §2.5 if-block extended to gate on the new contract (existing pattern from Phase 22)

*(No framework install needed; existing pattern uses plain `node`.)*

---

## Security Domain

> security_enforcement is enabled by default. This section is included.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (existing) | Firebase Auth (Phase 5) — `wp.videoUrl` writes go through `writeAttribution()` which stamps `auth.uid` (Phase 15.1 SEC-15-1-02 already enforces `auth.uid == memberId`). No new auth surface. |
| V3 Session Management | yes (existing) | Firebase Auth session tokens; no new session state in Phase 24. |
| V4 Access Control | yes (existing) | Firestore rules already restrict `watchparties/{id}` writes to host (Phase 7); `videoUrl` and `currentTimeMs` writes inherit. Verify no new rule branch needed (Assumption A3). |
| V5 Input Validation | **yes (NEW for this phase)** | `parseVideoUrl` is the input validator. Rejects: non-http(s) protocols (XSS via `javascript:`/`data:`), unknown hosts (only youtube/youtu.be allowed for iframe; everything else must end in `.mp4`), malformed URLs. `escapeHtml` (existing) wraps the URL on render. |
| V6 Cryptography | no | No new crypto surface. |

### Known Threat Patterns for {iOS PWA + Firestore + iframe + `<video>`}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via crafted `videoUrl` (e.g., `javascript:alert(1)` injected into iframe `src`) | Tampering / Information disclosure | (1) `parseVideoUrl` rejects non-http(s) protocols; (2) iframe `src` constructed via `encodeURIComponent` on the extracted videoId (NOT raw paste); (3) `escapeHtml` on the `<video src>` interpolation |
| XSS via raw URL paste rendered in DOM elsewhere (e.g., `field-error` echoing user input) | Tampering | `field-error` copy is HARDCODED string, not user input echoed back. Per UI-SPEC §Copywriting. Verified safe. |
| Iframe sandbox escape via `allow-same-origin` lateral attack | Elevation of privilege | `<iframe>` from `youtube.com/embed` runs in YouTube's origin — Same-Origin Policy + sandboxing enforced by browser. No `allow-same-origin` set on the iframe. (Default behavior is what we want.) |
| Mixed-content blocking on plain-HTTP MP4 URLs | (not a security issue — a UX issue) | `<video> error` event fires; inline error overlay surfaces. Stretch: parse-time `http://` warning per Pitfall 5. |
| CSP violations (Phase 13 OPS-13-04 has CSP in Report-Only) | Tampering | Report-Only CSP from Phase 13 will record violations but NOT block. Plan should add `frame-src https://www.youtube.com` and `media-src https: blob:` (or wildcards) to the CSP header in `queuenight/firebase.json`. **Cross-repo coordination needed if CSP changes (queuenight repo); otherwise Phase 24 surfaces won't be blocked but will generate Sentry-routed CSP-Report payloads.** |
| Iframe-source spoofing — user pastes a URL that LOOKS like youtube but isn't | Spoofing | `parseVideoUrl` enforces `host === 'youtube.com'` or `'youtu.be'` AFTER `URL` parsing. Subdomains other than `m.` and `www.` are rejected. |
| Firestore write quota exhaustion via host's broadcast loop | Denial of Service | Pattern 3 throttle to 5s caps writes at 720/hour/wp. Even 10 concurrent watchparties = 7,200/hour — well under daily quota. |
| Iframe redirect to malicious domain (post-load navigation) | Phishing / Tampering | YouTube's `embed/` URLs DO occasionally redirect when video is age-restricted or removed. The redirect happens INSIDE the iframe's origin (`youtube.com`); doesn't affect Couch. |

**Cross-repo CSP item:** If Phase 13 OPS-13-04's Content-Security-Policy enforcement window flips to Enforce mode (currently Report-Only) before/during Phase 24, the CSP MUST allow `frame-src https://www.youtube.com https://www.youtube-nocookie.com` and `script-src https://www.youtube.com` (for the `iframe_api` script). Surface this to planner — it's a queuenight repo change in `firebase.json`.

---

## iOS PWA Section (compiled from CLAUDE.md primary-surface mandate)

**Why a dedicated section:** CLAUDE.md identifies iOS Safari (in-Safari + home-screen PWA) as Couch's primary surface. Both player branches have iOS-specific behavior that warrants explicit research:

### YouTube iframe on iOS

- **`playsinline=1` URL parameter is REQUIRED** to keep the player inline. Without it, taps on play hand off to the YouTube native app (if installed) or fullscreen-mode Safari player.
- **`enablejsapi=1` URL parameter is REQUIRED** to allow `YT.Player` postMessage control.
- **iOS PWA standalone mode:** Couch's existing trailer iframes (`:7838 / :13667`) work in standalone mode — verifies that third-party `youtube.com` iframes are reachable. Adding `iframe_api` script element is a NEW network dependency — UAT must verify the script loads in standalone.
- **Picture-in-picture:** YouTube iframe on iOS supports PiP natively via the iframe's own controls if the user enables it. Couch doesn't need to do anything. The `allow="picture-in-picture"` attribute is recommended.
- **Audio focus:** iOS pauses the player when the user receives a phone call. The `onStateChange` event will fire (state=2 paused). Couch records this as a pause. Resumes after call ends require user tap.

### HTML5 `<video>` on iOS

- **`playsinline` attribute is REQUIRED** (without it, iPhone forces native fullscreen on play). `[CITED: webkit.org/blog/6784]`
- **`muted` autoplay:** if Couch ever wants the player to start playing automatically (NOT in scope for v2.0 — user-initiated play only), add `muted` along with `autoplay`. Without `muted`, autoplay is blocked.
- **`preload="metadata"`** (recommended): downloads ~few hundred bytes of header to know duration, but doesn't prefetch the body. `preload="auto"` would prefetch the entire video — bad for cellular data.
- **`<video>` `error` event** fires for: network 404, malformed MP4, unsupported codec (rare for MP4 — iOS supports H.264 + AAC by default), CORS rejection.
- **iOS PWA standalone mode:** `<video>` element behaves identically to in-Safari. The home-screen PWA shell wraps it.
- **iOS Lock screen / Now Playing controls:** when `<video>` plays in standalone PWA, iOS shows media-control widgets on lock screen. User can pause/seek from there. The `<video>` element receives the corresponding events.

### What we do NOT need to do

- We do NOT need to detect iOS specifically. The `playsinline` attribute is no-op on browsers that don't need it; it's safe to always include.
- We do NOT need a custom iOS fullscreen orchestrator. Native iframe / `<video>` controls + iOS native fullscreen + iOS exit-fullscreen all work cleanly per CONTEXT.md Discretion-area lock.

---

## Code Touchpoints (canonical list — verified via grep)

These are the exact insertion points the planner should use:

| Surface | File:Line | Purpose | Phase 24 work |
|---------|-----------|---------|----------------|
| Schedule modal HTML scaffold | `app.html:957-973` | Existing `Date & time` + `Note (optional)` field pattern | Insert NEW `<div class="field">` for Video URL between line 967 (datetime) and 968 (note) per UI-SPEC §Schedule-modal field |
| Watchparty live modal scaffold | `app.html:1176-1177` | `#wp-live-modal-bg` + `#wp-live-content` (UNCHANGED — innerHTML is rebuilt by `renderWatchpartyLive`) | None — render branches go inside `renderWatchpartyLive` |
| Existing trailer iframe pattern (1) | `js/app.js:7838` | YouTube embed in detail-section | REUSE pattern shape; add `enablejsapi=1` + `playsinline=1` for the wp variant |
| Existing trailer iframe pattern (2) | `js/app.js:13667` | YouTube embed in discovery preview | (don't modify; just informs the pattern) |
| `positionToSeconds` helper | `js/app.js:10695` | Phase 15.5 sport-mode DVR slider | Inform — `currentTimeMs` units should be MILLISECONDS to align with Date-style epoch handling. `positionToSeconds` returns SECONDS; conversion is trivial. Phase 26 will read `currentTimeMs / 1000` to align with reaction wall-clock semantics. |
| `renderWatchpartyLive` | `js/app.js:11115` | Host surface for live wp modal | INSERT player-surface render branch ABOVE `wp-live-header` per UI-SPEC §Layout/Component Contracts |
| `openWatchpartyLive` | `js/app.js:10983` | Modal-open path (already widened in Phase 23) | INSERT player-attach call after `renderWatchpartyLive()` paints (player binding requires DOM to exist) |
| `closeWatchpartyLive` | `js/app.js:11003` | Modal-close path | INSERT player-teardown: clear broadcast timer, null YT.Player ref, remove iframe/`<video>` to free memory |
| `confirmStartWatchparty` (movie wp creation) | `js/app.js:10845` | Movie watchparty record creation | EXTEND wp object to include `videoUrl` + `videoSource` from URL field |
| `scheduleSportsWatchparty` | `js/app.js:10199` | Sports watchparty record creation | EXTEND wp object to include `videoUrl` + `videoSource` from URL field |
| `TMDB_PROVIDER_IDS` | `js/app.js:13006` | Provider name → TMDB ID map | CO-LOCATE `DRM_FLAT_RATE_PROVIDER_BRANDS` Set + `titleHasNonDrmPath` helper |
| `escapeHtml` | `js/utils.js` | XSS-safe interpolation | REUSE — wrap any user URL before HTML interpolation |
| `flashToast` | `js/utils.js` | Soft validation feedback | REUSE — schedule-modal URL parser rejection |
| `writeAttribution` | `js/app.js` (Phase 5 contract) | Stamps every Firestore wp write | REUSE — every new write includes this |
| `.trailer-frame` CSS | `css/app.css:1608` | Existing 16:9 iframe class | INFORM — new `.wp-video-frame` CSS class is a sibling (not extension) per UI-SPEC §Layout |
| `sw.js` CACHE constant | `sw.js:line ~5` (top of file) | Service worker cache version | BUMP to `couch-v37-native-video-player` via `bash scripts/deploy.sh 37-native-video-player` |
| `package.json` `scripts.smoke` | `package.json:7` | Smoke chain | EXTEND with `&& node scripts/smoke-native-video-player.cjs` |
| `scripts/deploy.sh` §2.5 | `scripts/deploy.sh` | 7-contract smoke gate | EXTEND to 8-contract (per Phase 22 pattern) |

---

## Smoke Contract Design

### Naming
`scripts/smoke-native-video-player.cjs` (matches Phase 21/22/23 convention: `smoke-{phase-slug}.cjs`)

### Structure
Mirror existing `scripts/smoke-position-transform.cjs` and `scripts/smoke-conflict-aware-empty.cjs`:
- Inline-define the helpers (don't import `js/app.js`; smoke is offline-pure)
- `eq(label, got, want)` and `near(label, got, want, tol)` assertion helpers
- `let fails = 0` running counter; `process.exit(fails > 0 ? 1 : 0)` at end

### Assertion list (locked from Validation Architecture table; ~24 assertions total)
- `parseVideoUrl` × 13 cases (5 YouTube shapes + 2 MP4 shapes + 6 rejection cases)
- `titleHasNonDrmPath` × 4 cases
- `makeIntervalBroadcaster` × 2 cases (leading edge + trailing edge)
- iframe-URL construction string × 1 (must contain `enablejsapi=1` AND `playsinline=1` AND `encodeURIComponent`)
- `<video>` tag construction string × 1 (must contain `playsinline`)
- XSS guard × 2 (encodeURIComponent applied; escapeHtml applied to `<video src>` test)
- Schema invariant × 1 (sentinel string in app.js: `wp.videoUrl` + `wp.videoSource`)

### Why these and not more
Smoke covers PURE helpers. Player attachment, modal open/close, iOS PWA fullscreen, multi-device sync — all are integration concerns covered by `24-HUMAN-UAT.md` (planner creates this file).

---

## Sources

### Primary (HIGH confidence)
- **Context7 / `/websites/developers_google_youtube`** — fetched 2026-04-30 — verified: `getCurrentTime()` API, `enablejsapi=1` param, `onYouTubeIframeAPIReady` lifecycle, `YT.Player` constructor, `playsinline` parameter (verified for both iOS UIWebView and modern iOS Safari)
- **`developers.google.com/youtube/iframe_api_reference`** (CITED via Context7) — IFrame Player API official reference
- **`developers.google.com/youtube/player_parameters`** (CITED via Context7) — `playsinline` parameter
- **`webkit.org/blog/6784/new-video-policies-for-ios`** (CITED) — iOS 10+ `playsinline` requirement for inline `<video>` playback
- **`html.spec.whatwg.org/multipage/media.html#event-media-timeupdate`** (CITED) — `timeupdate` event firing rate spec
- **`developer.mozilla.org/en-US/docs/Web/HTML/Element/video`** (CITED) — `<video>` attributes including `playsinline`, `preload`, `controls`, error event
- **Couch repo grep verification** — VERIFIED: `js/app.js:7838 / :13667` (trailer iframe pattern), `js/app.js:11115` (renderWatchpartyLive), `js/app.js:10199 / :10845` (wp creation paths), `js/app.js:10983 / :11003` (open/close), `js/app.js:13006` (TMDB_PROVIDER_IDS), `js/app.js:16` (provider schema), `js/utils.js` (escapeHtml/flashToast), `app.html:957-973` (schedule modal), `app.html:1176-1177` (live modal scaffold), `css/app.css:1608` (.trailer-frame), `package.json` (smoke chain), `scripts/smoke-position-transform.cjs` (smoke pattern reference)
- **CONTEXT.md** — VERIFIED: D-01 through D-04 locked decisions; 3 Discretion areas
- **UI-SPEC.md** — VERIFIED: layout contracts (4 component contracts), interaction states, copywriting contract, .wp-video-frame CSS

### Secondary (MEDIUM confidence)
- TMDB watch-provider IDs (Netflix=8, Disney+=337, Max=1899, Prime=9, Apple TV+=350) — derived from existing `TMDB_PROVIDER_IDS` map at `js/app.js:13006` plus UI-SPEC §3 enumeration. Cross-verified: matches public TMDB API docs (themoviedb.org/documentation/api).

### Tertiary (LOW confidence — flagged for validation)
- A1 (5s cadence is sufficient for Phase 26) — qualitative reasoning; only validated when Phase 26 ships. Surfaced in Assumptions Log for user confirmation if planner wants to lock differently.
- A4 (iOS 17 / 18 PWA standalone honors `playsinline` identically) — based on stable WebKit behavior and absence of regression reports; will be re-verified during UAT.
- A5 (YouTube IFrame Player API loads in iOS PWA standalone) — based on existing trailer iframe success; the `iframe_api` SCRIPT (not the iframe) is a NEW network dependency to verify in UAT.

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every choice is either already in Couch's codebase or in the standard browser library. YouTube IFrame API is officially documented and stable since 2014.
- Architecture: **HIGH** — slots into existing `renderWatchpartyLive` + `confirmStartWatchparty` patterns; no new modules. Schedule-modal URL field follows the existing field pattern at `app.html:967-968`.
- Pitfalls: **HIGH** — six well-documented pitfalls cover everything that would surprise a Phase 24 implementer (iOS playsinline, timeupdate firing rate, YouTube URL shapes, DRM detection logic, mixed-content, modal-close race).
- Cadence recommendation: **MEDIUM** — 5s is well-reasoned but `[ASSUMED]` (A1) until Phase 26 is built and validates the granularity in real replay UX.
- Validation architecture: **HIGH** — fully maps to existing Couch smoke-contract pattern; ~24 assertions, no new framework needed.
- Security domain: **HIGH** — STRIDE coverage for iframe / video / Firestore writes; no novel surface.

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days — stable domain, browser primitives + Google API). Should be re-checked if iOS releases a major Safari change or Couch's Firebase config changes.

---

*Phase: 24-native-video-player*
*Researcher: gsd-phase-researcher*
*Research artifact: `.planning/phases/24-native-video-player/24-RESEARCH.md`*
