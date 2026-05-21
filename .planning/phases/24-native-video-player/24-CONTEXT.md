# Phase 24: Native Video Player (iframe + HTML5) — Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Stand up a Couch-native video player surface inside the existing watchparty modal so the title actually plays in Couch (not in a separate app / tab / device). Player exposes `currentTime` and broadcasts it (throttled) to Firestore on the watchparty record so **Phase 26 (position-anchored reactions + async-replay)** can anchor reactions to runtime position. Merges old Phase 24 (iframe player) + old Phase 25 (HTML5 player) into one deploy since both share the embed/URL parser pipeline + the position-broadcast mechanism.

**In scope:**
- One new player surface inside the watchparty live modal (`#wp-live-modal-bg` / `#wp-live-content`)
- Iframe player branch (YouTube only at v2 launch)
- HTML5 `<video>` branch (MP4 only at v2 launch)
- Optional URL field on watchparty creation (`scheduleWatchparty` + `scheduleSportsWatchparty` flows)
- `currentTime` broadcast schema + throttle (cadence chosen by research/planning per "Claude's Discretion" notes below)
- DRM-only-title detection → hide-the-player branch (no player surface rendered)

**Out of scope (deferred to other phases or v2.1+):**
- Twitch / Vimeo iframe support (deferred to v2.1 or later if demand surfaces)
- HLS (.m3u8) / DASH (.mpd) format support (deferred — needs hls.js / dash.js dependency)
- Plex / Jellyfin auth-token URL helpers beyond plain MP4 paste
- Phase 26 reactions runtime indexing (separate phase — depends on this one)
- Voice / video chat in watchparty (v3 — see `seeds/v3-voice-video-chat-watchparty.md`)
- Generic iframe-allowlist / paste-any-embed surface (v3 territory; security review required)

</domain>

<decisions>
## Implementation Decisions

### Source Coverage at v2 Launch

- **D-01:** Iframe player at v2 launch supports **YouTube only**. Existing YouTube iframe pattern at `js/app.js:7838` and `:13667` (trailer embeds) is the reusable scaffold. URL parser must extract video ID from all three YouTube URL shapes (`youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`). Twitch + Vimeo + generic embed allowlist are explicitly deferred (v2.1+ or v3 territory; latter requires security review for iframe sandbox / parent allowlist / CSP).
- **D-02:** HTML5 self-hosted player at v2 launch supports **MP4 only** via native `<video>` tag — paste any URL. No HLS, no DASH, no library deps (per project no-bundler constraint). Plex / Jellyfin work today via their transcoded MP4 outputs (URL with auth token in query string, hits browser as same-origin per Plex's web-share design — user pastes the URL, Couch doesn't manage auth). HLS + DASH explicitly deferred to v2.1+ if user demand surfaces.
- **D-03:** DRM-restricted streaming titles (Netflix / Disney+ / Max / Prime / Apple TV+ — anything that won't iframe due to Widevine / FairPlay) → **hide the player surface entirely**. Watchparty modal renders today's coordination-only shape (no player slot rendered at all). Detection signal: TMDB provider data on the title. No "play it elsewhere" message, no fallback picker. Simplest UX, zero false promises. Phase 26 reactions on these wps still anchor to wall-clock time (today's behavior); they just won't anchor to runtime position.
- **D-04:** URL entry flow = **optional manual paste field on watchparty creation only**. Add a `Video URL (YouTube or .mp4)` field to `scheduleWatchparty` + `scheduleSportsWatchparty` modals. Skipping the field = today's coordination-only behavior (no player surface in the live modal). No mid-party "Attach a video" affordance. No TMDB trailer pre-fill. Validation: parse on submit, soft-reject malformed URLs with inline error. Field stored on the wp record (e.g., `wp.videoUrl` + `wp.videoSource: 'youtube' | 'mp4'`).

### Claude's Discretion

The user opted to leave these areas to research / planning rather than locking them now. Downstream agents have flexibility but should follow the implicit guidance below:

- **`currentTime` broadcast cadence + sync model** — Researcher should pick a Firestore-budget-aware cadence. Default leaning: throttle to **1 write every 5 seconds per active host** (≈720 writes/hour/wp; well under Firestore's 1-write/sec/document limit and below Phase 18's `providerRefreshTick` write budget). Host-only writes (not every member) to keep budget linear. Pause/play state recorded on the wp record but **not actively synced** at v2.0 (everyone pauses independently — adding "host-paused-so-everyone-pauses" coordination is its own UX consideration that warrants its own phase or v2.1 follow-up). Researcher to confirm or revise; planning may surface trade-offs (e.g., 5s vs 10s vs on-pause-only). Phase 26 will inherit whatever cadence ships and design replay UX around it.
- **Player surface placement** — Planning to land on a placement that respects brand restraint (BRAND.md: "Warm · Cinematic · Lived-in. Restraint is the principle.") + the watchparty live-modal as host surface (`renderWatchpartyLive`, app.js:11115). Default leaning: **player slots into top of the live modal, replacing the current `wp-live-poster` + `wp-live-titlename` header** when a video URL is set. Reactions panel + roster + DVR slider stay in the existing positions below. Mobile-first constraint: PWA on iOS Safari — fullscreen behavior is handled by the iframe / `<video>` element's native controls (Couch does NOT add a custom fullscreen orchestrator at v2.0). Reaction overlay floating on top of the player is **deferred to Phase 26** since runtime-position-anchored reactions are a Phase 26 capability.
- **Scope split: bundle iframe + HTML5 or stage them?** — Default leaning: **ship iframe + HTML5-MP4 together in one Phase 24 deploy**. Both share the URL field + storage shape + `currentTime` broadcast mechanism; splitting the deploy doubles the smoke-contract churn. Direct-ship pattern (Phases 21/22/23) is NOT a fit here — Phase 24 introduces a new persistent surface with new schema (`wp.videoUrl` / `wp.videoSource`) and player-state coordination, so formal `/gsd-plan-phase 24 → /gsd-execute-phase 24` chain probably fits better. Planning to confirm or revise.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### v2 milestone scope
- `.planning/seeds/v2-watchparty-sports-milestone.md` — Locked 6-phase v2 plan; defines Phase 24's scope merge (old 24 + 25), inter-phase dependencies (24 → 26 hard ordering), and downstream constraints (Phase 26 needs `currentTime` broadcast).
- `.planning/seeds/phase-async-replay.md` — Sub-request B (re-targeted as Phase 26 anchor scope) describes the runtime-indexed reactions schema that Phase 24's `currentTime` broadcast must support.
- `.planning/phases/22-sports-feed-abstraction/22-SUMMARY.md` lines 100-115 — Original locked 6-phase v2 plan table.
- `.planning/phases/23-live-scoreboard/23-SUMMARY.md` line 58 — Phase 23's "next phase" pointer to Phase 24 with explicit scope statement.

### Project foundations
- `.planning/PROJECT.md` — Vision + brand voice + non-negotiables.
- `couch/CLAUDE.md` — Token-cost rules (don't read app.js in full; grep + offset/limit), no-bundler constraint, public-by-design secrets, sw.js CACHE bump on deploy, deploy via `bash scripts/deploy.sh`. Phase numbering + scope safeguards.
- `.planning/BRAND.md` — Warm · Cinematic · Lived-in. Restraint is the principle. Affects player chrome decisions.
- `.planning/REQUIREMENTS.md` — Existing PARTY-* and REFR-* requirements provide context for watchparty surface area; Phase 24 will likely add new VID-24-* IDs (planner to define).

### Existing code touchpoints (read offsets, not in full — app.js is ~16k lines)
- `js/app.js:7838` — YouTube iframe (trailer detail-section) — REUSABLE pattern for iframe player.
- `js/app.js:13667` — YouTube iframe (other detail-section variant) — second reusable pattern.
- `js/app.js:10695` — `positionToSeconds()` (Phase 15.5 sport-mode position helper) — coordinates with `currentTime` broadcast.
- `js/app.js:10742-10743` — DVR slider event wiring (`oninput="updateDvrReadout(positionToSeconds(this.value))"`, `onchange="setDvrOffset(...)"`) — the existing position-aware UI pattern.
- `js/app.js:11115` — `renderWatchpartyLive()` — host surface where player slots in.
- `js/app.js:10954-10987` — `openWatchpartyLive()` / live-modal-open paths — already gated for sports `mode === 'game'` + legacy `wp.sportEvent` (Phase 23 fix); player surface needs a similar gate on `wp.videoUrl`.
- `app.html:1176-1177` — `#wp-live-modal-bg` / `#wp-live-content` — DOM scaffold for the live modal.
- Watchparty schedule modal (couch flows for `scheduleWatchparty` + `scheduleSportsWatchparty`) — D-04's URL field needs to slot into both. Grep for `schedule-modal-bg` and the existing form-field pattern (e.g., the `dvrTime` slider input added in Phase 15.5).

### Cross-repo (queuenight) — not expected for Phase 24
- No Cloud Function changes anticipated. `currentTime` writes happen client-side directly to Firestore. Existing `firestore.rules` should already cover wp record updates by host (Phase 7 + 5 auth scope). Planner / researcher to verify.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **YouTube iframe pattern (app.js:7838 / :13667)** — Two existing call sites use `<iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe>`. Phase 24 player iframe will follow the same shape but render in the watchparty modal instead of the title-detail modal, and use the wp's `videoUrl` instead of `t.trailerKey`. The `trailer-frame` CSS class likely needs a `wp-video-frame` sibling sized for the live modal.
- **`positionToSeconds()` helper (app.js:10695)** — Phase 15.5 added this for sport-mode DVR slider. Phase 24's `currentTime` broadcast can REPRESENT position the same way (same units, same clamp behavior), giving Phase 26 a unified position semantic across player runtime and DVR offset. Researcher to confirm semantic alignment.
- **Watchparty modal scaffold (`#wp-live-modal-bg` / `#wp-live-content`, app.html:1176-1177)** — Already wired; Phase 24 only adds new render branches inside `renderWatchpartyLive()`.
- **Watchparty schedule modal field pattern** — Phase 15.5 added the DVR slider + Custom… picker. The Video URL field follows the same scaffold.

### Established Patterns
- **wp record schema lives on `families/{code}/watchparties/{id}`** (Firestore) — D-04's `wp.videoUrl` + `wp.videoSource` slot in alongside existing fields (`titleName`, `titlePoster`, `mode`, `sportEvent`, `reactionDelay`, etc.). Existing rules already authorize host writes.
- **Polling gates use `wp.X` flags** — Phase 23 widened the live scoreboard gate to fire when `mode === 'game'` OR `wp.sportEvent`. Phase 24's player gate follows the same pattern: render player when `wp.videoUrl` is set AND title is not DRM-only per TMDB providers.
- **sw.js CACHE bump on every user-visible change** — D-XX in planning will encode a CACHE bump (e.g., `couch-v37-native-video-player`) per CLAUDE.md.
- **smoke contract per phase** — Phases 18+ all add a `scripts/smoke-{phase-name}.cjs` with assertions covering the new helper(s); deploy.sh §2.5 wires it into the gate. Phase 24's smoke likely covers: URL parser (YouTube ID extraction across 3 URL shapes + MP4 detection), DRM-detection helper, `currentTime` throttle helper.

### Integration Points
- **`scheduleWatchparty` + `scheduleSportsWatchparty` flows** — D-04's URL field plugs in here.
- **`renderWatchpartyLive()` (app.js:11115)** — Player surface renders inside this function based on `wp.videoUrl` + DRM-detection.
- **`openWatchpartyLive` / live-modal-open paths (app.js:10954-10987)** — Existing gates that already widened in Phase 23; Phase 24 may extend these for player initialization on modal-open.
- **Firestore wp record write path** — Existing host-write rules cover the new `wp.videoUrl` field. `currentTime` writes will be host-only at the chosen cadence.
- **TMDB provider data on titles** — DRM-detection (D-03) reads from existing `t.providers` / `t.providerBucket` schema (Phase 9 / 18 had provider-bucket work). No new TMDB fetches needed.

</code_context>

<specifics>
## Specific Ideas

The user did not surface any "I want it like X" references during discussion. The four locked decisions (D-01 through D-04) are all concrete enough for planning; downstream agents should not re-ask.

The user did push back on the "Recommended" framing for D-03 (chose "Hide entirely" over "Graceful 'play on elsewhere' message"). That signals a preference for **silent / minimal UX** over **explanatory UX** when faced with a dead-end branch. Planning should mirror this preference: when in doubt between "show a message" vs "hide the surface", prefer hiding for unreachable paths.

</specifics>

<deferred>
## Deferred Ideas

### Scope explicitly deferred from Phase 24

- **Twitch + Vimeo iframe support** — User chose YouTube-only at v2 launch. Add to a v2.1 follow-up phase if YouTube proves insufficient (e.g., sports watchparties want Twitch streams). Note for v2.1 scoping: Twitch needs `parent=couchtonight.app` query param in the iframe URL.
- **HLS (.m3u8) + DASH (.mpd) support** — User chose MP4 only at v2 launch. HLS unlocks "real" Plex / Jellyfin streaming + live-TV servers; defer to v2.1 if demand surfaces. `hls.js` (~250KB minified, ES-module-friendly via CDN) is the canonical lib; fits the no-bundler constraint.
- **Generic iframe-allowlist (paste any embed)** — Out of scope at v2; needs security review (sandbox attrs + parent allowlist + CSP). v3 territory.
- **Mid-party "Attach a video" affordance** — User chose URL-on-creation only. If users want it later, a small UI surface in the live modal can be added in a follow-up (v2.1 polish).
- **TMDB trailer pre-fill** — User chose no auto-suggest. If users want it later, consider it as a low-effort v2.1 polish.
- **DRM "play on elsewhere" message** — User chose to hide the player entirely on DRM titles. The "play on Netflix — reactions still sync here" message option was explicitly rejected.
- **Active host-paused-so-everyone-pauses sync** — Not in Phase 24 scope (default leaning is record state but don't actively sync). If the user wants the orchestrated experience, that's a separate UX phase.
- **Reaction overlay positioned over player** — Phase 26 territory. Phase 24 keeps reactions in their existing position panel.
- **Voice / video chat over the player** — Already deferred to v3 — see `seeds/v3-voice-video-chat-watchparty.md`.

### Reviewed Todos (not folded)

The two pending todos from `.planning/todos/pending/` (`2026-04-27-live-release-push-nominate-deep-link-handler.md`, `2026-04-27-phase-15-ios-ux-fixes.md`) were reviewed but neither relates to Phase 24's player scope. Both stay in the pending queue for future phases.

</deferred>

---

*Phase: 24-native-video-player*
*Context gathered: 2026-04-30*
*Discussion mode: interactive default (one area selected — Source Coverage; other 3 areas left to Claude's Discretion per user direction)*
