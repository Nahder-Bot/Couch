# Phase 24: Native Video Player (iframe + HTML5) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `24-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 24-native-video-player
**Areas discussed:** Source coverage at v2 launch
**Areas left to Claude's Discretion (user direction):** currentTime broadcast cadence + sync model, player surface placement, scope split (iframe + HTML5 bundle vs stage)

---

## Pre-discussion: Gray Area Selection

User was presented with 4 candidate gray areas via multiSelect AskUserQuestion. User selected **only "Source coverage at v2 launch"** — the other 3 (cadence + sync, surface placement, scope split) were left to Claude's discretion. CONTEXT.md captures default leanings for those under `## Claude's Discretion`.

| Gray area | Description | Selected |
|-----------|-------------|----------|
| Source coverage at v2 launch | YouTube? Twitch? Vimeo? +HTML5 self-hosted MP4? +HLS? DRM handling? | ✓ |
| `currentTime` broadcast cadence + sync model | Per-second / 5s / on-pause / host-only-vs-everyone / pause-sync? | (deferred to discretion) |
| Player surface placement | Inline modal / fullscreen overlay / separate page; reaction overlay vs side | (deferred to discretion) |
| Scope split: bundle iframe + HTML5 or stage them | One Phase 24 deploy or v2.0 iframe → v2.1 HTML5? | (deferred to discretion) |

---

## Source Coverage at v2 Launch

### Q1: Iframe-embeddable sources at v2 launch — which to support?

| Option | Description | Selected |
|--------|-------------|----------|
| YouTube (Recommended) | Existing trailer iframe pattern reusable; largest content surface; trivial parser. | ✓ |
| Twitch | Live + VODs; sports/esports watchparty value; needs parent-domain whitelist. | |
| Vimeo | Niche family-friendly; smaller content surface. | |
| Generic embed allowlist | Maximum flexibility but security/abuse vector — v3 territory. | |

**User's choice:** YouTube only.
**Rationale captured:** Reuses existing trailer-iframe pattern (`js/app.js:7838` and `:13667`); largest content surface; ships fastest. Other sources deferred to v2.1+ or v3.

---

### Q2: HTML5 self-hosted video formats at v2 launch — which to support?

| Option | Description | Selected |
|--------|-------------|----------|
| MP4 only — paste any URL (Recommended) | Native HTML5 `<video>` handles MP4; no library; ships fastest. | ✓ |
| MP4 + HLS (.m3u8) | Adds Plex/Jellyfin direct-stream + live-TV servers; needs `hls.js` (~250KB). | |
| MP4 + HLS + DASH (.mpd) | DASH rare in personal-server land; adds complexity for marginal coverage. | |
| Skip HTML5 entirely (iframe-only at v2.0) | Defer all self-hosted to v2.1; ships v2.0 even faster but loses Plex/Jellyfin. | |

**User's choice:** MP4 only.
**Rationale captured:** Native `<video>` tag handles MP4 directly with no library dep; covers Plex/Jellyfin transcoded MP4 outputs; respects no-bundler constraint. HLS + DASH explicitly deferred to v2.1+ if demand surfaces.

---

### Q3: DRM-restricted streaming titles — how should the player handle them?

| Option | Description | Selected |
|--------|-------------|----------|
| Graceful 'play on — elsewhere' message (Recommended) | Soft message in player slot reminding reactions still sync. | |
| Hide the player surface entirely on DRM titles | Watchparty modal renders today's coordination-only shape; no player slot at all. | ✓ |
| Show a placeholder 'pick another source' picker | Player slot becomes a paste-fallback-URL input; most flexible, most UX surface. | |

**User's choice:** Hide the player surface entirely on DRM titles.
**Rationale captured:** Simplest UX, no surfaces saying "unsupported", zero false promises. Phase 26 reactions on these wps still anchor to wall-clock time (today's behavior); they just won't anchor to runtime position.
**Pattern signal:** User pushed back on the "Recommended" choice — preference for silent/minimal UX over explanatory UX on dead-end branches. Captured in `## Specifics` of CONTEXT.md.

---

### Q4: How does a user attach a video URL to a watchparty?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual paste field on watchparty creation — optional (Recommended) | Optional field on schedule modals; skipping = today's coordination-only behavior. | ✓ |
| Manual paste + 'Add later' affordance on the live watchparty | Lets host paste mid-party; more forgiving, more UI surface. | |
| Auto-suggest from TMDB when title has a YouTube trailer | Pre-fill URL with `t.trailerKey` if available; user can override. | |
| Manual paste + 'Add later' + TMDB trailer pre-fill (all three) | Maximum flexibility; most UI surface, most code paths. | |

**User's choice:** Manual paste field on watchparty creation only.
**Rationale captured:** Optional `Video URL (YouTube or .mp4)` field on `scheduleWatchparty` + `scheduleSportsWatchparty` modals. Skipping = today's coordination-only behavior. No mid-party attach affordance, no TMDB pre-fill — minimal UI surface, ships in 1 plan.

---

## Claude's Discretion (areas user opted not to discuss)

These areas were presented as gray areas but the user chose not to dive in, leaving them for downstream researcher / planner. Default leanings captured in CONTEXT.md `## Claude's Discretion`:

- **`currentTime` broadcast cadence + sync model** — Default lean: 5s host-only writes (~720 writes/hour/wp); pause/play recorded but not actively synced. Researcher to confirm.
- **Player surface placement** — Default lean: player replaces `wp-live-poster` + `wp-live-titlename` header inside the live modal when URL is set. Native fullscreen via iframe / `<video>` element controls (no custom Couch fullscreen orchestrator at v2.0). Reaction overlay deferred to Phase 26.
- **Scope split** — Default lean: ship iframe + HTML5-MP4 together in one Phase 24 deploy via formal `/gsd-plan-phase 24 → /gsd-execute-phase 24` chain (NOT direct-ship — new schema + new persistent surface).

---

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Twitch + Vimeo iframe support (v2.1 if demand)
- HLS / DASH support (v2.1 — `hls.js` is the canonical lib)
- Generic iframe-allowlist (v3; security review required)
- Mid-party "Attach a video" affordance (v2.1 polish)
- TMDB trailer pre-fill (v2.1 polish)
- DRM "play on elsewhere" message (explicitly rejected by user — pattern: prefer hiding over messaging)
- Active host-paused-so-everyone-pauses sync (separate UX phase if user wants it)
- Reaction overlay positioned over player (Phase 26 territory)
- Voice / video chat over the player (v3 — `seeds/v3-voice-video-chat-watchparty.md`)
