---
phase: 24
reviewers: [gemini, codex]
reviewed_at: 2026-04-30T16:04:45Z
plans_reviewed:
  - 24-01-PLAN.md
  - 24-02-PLAN.md
  - 24-03-PLAN.md
  - 24-04-PLAN.md
runtime_skipped: claude (running inside Claude Code per CLAUDE_CODE_ENTRYPOINT=cli — would not be independent)
---

# Cross-AI Plan Review — Phase 24

## Gemini Review

The implementation plans for **Phase 24: Native Video Player** are highly professional, following the established "Nyquist" validation patterns and respecting the project's unique architecture (no-bundler, single-file logic, warm-dark design system). However, a critical architectural conflict between the new player surface and the existing re-rendering logic has been identified.

### 1. Summary
The plans provide a robust foundation, particularly in the "Wave 1" pure helper and smoke contract phase. The use of a standalone module for video logic is a wise decision that mirrors successful past phases. However, the "Wave 2" integration plan (24-03) contains a **blocker-level flaw**: it integrates the player into a rendering function (`renderWatchpartyLive`) that wipes the DOM on every state change. This will cause the video to reset or disappear whenever a reaction is sent or the host broadcasts their time.

### 2. Strengths
*   **Contract-Driven Infrastructure:** Plan 24-01's approach of locking the helper signatures and behaviors with a 24-assertion smoke test before writing a single line of production code is excellent.
*   **Surgical Lifecycle Management:** The `attachVideoPlayer` and `teardownVideoPlayer` pair correctly handles the complexities of third-party API initialization (YouTube) and resource cleanup, including necessary guards for async races during modal closure.
*   **Pragmatic DRM Design:** The "silent dead-end" strategy for DRM titles respects the project's brand principle of "Restraint" and avoids the UX friction of promising features that browser-level security (Widevine) would inevitably block.
*   **Strict Security Defaults:** The URL parser includes a hard protocol allowlist (`http`/`https`), and the render branches utilize multiple layers of XSS protection (`encodeURIComponent` for IDs, `escapeHtml` for URLs).

### 3. Concerns
*   **Critical: Player Reset on Re-render (HIGH):** `renderWatchpartyLive` uses `el.innerHTML = ...` to update the modal on every reaction, timer tick, and watchparty state change. Overwriting `innerHTML` will destroy and recreate the `<iframe>` or `<video>` element, causing the video to reset to 0 or reload constantly. Furthermore, since `attachVideoPlayer` only runs once on modal open, the player will likely vanish entirely after the first re-render.
*   **Missing "Join-at-Current-Time" (MEDIUM):** While the plans implement the *broadcast* of `currentTimeMs`, they lack the logic to *consume* it. When a participant joins a party, the player should automatically seek to the host's last known position. Without this, users will always start at 0:00 and have to coordinate manually.
*   **Mixed Content Dead-ends (MEDIUM):** Many self-hosted Plex/Jellyfin setups use `http:`. Since `couchtonight.app` is `https:`, these will be blocked by the browser. A creation-time warning (e.g., "HTTP links may be blocked") is missing from the validation logic but would significantly reduce user confusion.
*   **Host Sync Loop (LOW):** If the host's device re-renders the coordination UI upon receiving its own broadcasted `currentTimeMs` snapshot from Firestore, it could create a jittery UX or exacerbate the re-render issue mentioned above.

### 4. Suggestions
*   **Persistent Player Surface (js/app.js:11115):** **This is the most important fix.** Modify `app.html` to split `#wp-live-content` into two containers: `#wp-video-surface` (persistent) and `#wp-live-coordination` (re-rendered). Update `renderWatchpartyLive` to only overwrite the coordination surface.
*   **Implement Seek-on-Load (js/app.js: Task 3.4):** Inside `attachVideoPlayer`, add logic to seek the player to `wp.currentTimeMs` immediately after initialization for non-hosts.
*   **Add HTTP Warning (js/app.js: Task 3.2):** In the `confirmStartWatchparty` validation block, if `rawVideoUrl` starts with `http://`, surface a `flashToast` warning: *"Note: Local links (http) may be blocked. Use https if possible."*
*   **Throttle Optimization:** In `makeIntervalBroadcaster`, consider adding a check to only broadcast if the `currentTime` has actually changed (e.g., more than 1 second difference) to save Firestore write quota when the video is paused.

### 5. Risk Assessment (HIGH)
The overall risk is **HIGH** due to the rendering conflict. If Plan 24-03 is executed as written, the video player will fail to maintain playback for more than a few seconds in a live party environment. By refactoring the DOM structure to support a persistent player surface and adding "Seek-on-Join" logic, the risk level will drop to **LOW**, as the core helper logic and architecture are otherwise sound.

---

## Codex Review

## Summary

The Phase 24 plan set is unusually thorough and mostly executable: it has clear wave ordering, locked helper contracts, UI constraints, smoke coverage, deploy/UAT closeout, and explicit Phase 26 schema intent. The main risks are not in the high-level scope, but in integration details: the smoke plan mirrors helper code instead of testing the production module, YouTube `currentTime` support requires more than a plain iframe in many cases, MP4 event cleanup is incomplete, Firestore write authorization is assumed rather than verified, and the Phase 26 schema may be too thin if async replay needs source/type/host metadata later. Overall, this is a good plan, but I would tighten several correctness and security details before execution.

## Strengths

- Clear phase boundary: YouTube-only iframe, MP4-only HTML5, no HLS/DASH/Twitch/Vimeo, no reaction overlay, no pause sync. This avoids the usual "native player" scope explosion.
- Good wave split: smoke/helper scaffolding first, UI/lifecycle second, deploy/UAT last.
- The URL parser contract is conservative: rejects malformed URLs, `javascript:`, `data:`, and unknown hosts.
- The DRM-hide behavior is explicitly tied to user preference and documented as silent by design.
- Host-only 5s broadcast is a reasonable default write budget: about 720 writes/hour/watchparty, assuming only one host client is active.
- iOS `playsinline` is considered for both YouTube and MP4.
- Phase 26 dependency is recognized early, with `currentTimeMs` and `currentTimeUpdatedAt` named as stable fields.
- UAT scripts cover the right things: YouTube, MP4, invalid URL, empty URL, DRM hide, two-device broadcast, Safari/PWA.

## Concerns

- **HIGH: Smoke mirror does not test production code.**
  `24-01` creates a self-contained CJS mirror of helpers rather than importing `js/native-video-player.js`. This can pass while production drifts. The plan says "byte-compatible," but no automated check enforces that.

- **HIGH: YouTube IFrame API may not reliably bind to the iframe as planned.**
  A plain `<iframe id="wp-yt-player" src="...enablejsapi=1">` plus `new YT.Player('wp-yt-player', ...)` can work, but it is timing-sensitive and depends on the API replacing/wrapping the element correctly. If the player is already an iframe, some integrations instead create the player from a div or pass `videoId` to `YT.Player`. This needs explicit verification.

- **HIGH: Error overlay "Try again" is not wired.**
  `renderPlayerErrorOverlay()` renders `<a class="link-like" data-action="retry-video">Try again</a>`, but the plan does not add an event listener or `onclick` that calls `window.reloadWatchpartyPlayer`. The comment says "inline onclick," but the markup does not include one.

- **HIGH: MP4 event listener cleanup is incomplete.**
  `attachVideoPlayer()` adds anonymous `timeupdate` and `error` listeners. `teardownVideoPlayer()` pauses and nulls the element but does not remove listeners. If the modal is reopened repeatedly, this can leak handlers or duplicate broadcasts.

- **MEDIUM: Firestore rules coverage is assumed.**
  Plans repeatedly state existing rules should allow `videoUrl`, `videoSource`, `currentTimeMs`, and `currentTimeUpdatedAt`. Given prior security hardening phases, schema-restricted rules are plausible. This should be verified explicitly before relying on client writes.

- **MEDIUM: Host-only check uses member id, but rules may use auth uid.**
  The client gate `state.me.id === wp.hostId` is useful UX-side, but the actual security boundary is Firestore rules. The plan should confirm whether `hostId` is member id, uid, or both, and whether `writeAttribution()` satisfies rule expectations for partial updates.

- **MEDIUM: `currentTimeMs` alone may be under-specified for Phase 26.**
  Runtime-anchored replay may later need `videoSource`, `durationMs`, `isLive`, `isPaused`, `playbackState`, `hostId`, and maybe `positionSource: 'video' | 'wallClock' | 'sportsDvr'`. The current schema is enough for a rough anchor, but not enough for robust replay semantics.

- **MEDIUM: YouTube live-stream gating at `onReady` may be premature.**
  `getDuration()` can be `0` initially and become finite later after metadata loads. If checked only once, normal videos may accidentally skip broadcast.

- **MEDIUM: Schedule modal has one global `schedule-video-url` id.**
  The plan says duplicate ids are acceptable if only one modal is open. That is fragile. If both DOM nodes exist, `document.getElementById()` returns the first one, possibly the wrong field.

- **MEDIUM: URL parser allows `http:` MP4 URLs.**
  On `https://couchtonight.app`, HTTP MP4s will be blocked as mixed content. The plan accepts this, but the UX will show a late player error instead of a useful submit-time validation. For Plex/Jellyfin users, this may be a common failure mode.

- **LOW: Autoplay policy is not addressed.**
  This is probably acceptable because playback is user-initiated, but UAT should explicitly confirm no code attempts autoplay or assumes autoplay.

- **LOW: `window.onYouTubeIframeAPIReady` overwrite risk.**
  If another part of the app or a future phase uses the YouTube API, assigning the global callback directly can clobber another handler.

- **LOW: Deploy plan conflicts with "autonomous: false."**
  `24-04` marks `autonomous: false` but also says absence-of-objection is approval. That is process-confusing, even if project memory allows deploy autonomy.

## Suggestions

- Replace the mirrored smoke with a production-module smoke where possible.
  In `scripts/smoke-native-video-player.cjs`, dynamically import the ES module instead of duplicating helper bodies:

  ```js
  const m = await import('../js/native-video-player.js');
  const { parseVideoUrl, titleHasNonDrmPath, makeIntervalBroadcaster } = m;
  ```

  Keep only test-only builders in the smoke if needed.

- Add a Firestore rules verification item before `24-03` or inside `24-04`.
  Specifically test that the host can update only:

  ```js
  videoUrl
  videoSource
  currentTimeMs
  currentTimeUpdatedAt
  isPaused // if retained
  ```

  and that non-host members cannot spoof `currentTimeMs`.

- Fix the retry link contract in `24-03 Task 3.4`.
  Either render:

  ```html
  <button type="button" class="link-like" onclick="reloadWatchpartyPlayer()">Try again</button>
  ```

  or better, add delegated click handling for `[data-action="retry-video"]`.

- Store MP4 event handlers so teardown can remove them.
  Add module-scope refs like `_wpVideoTimeHandler` and `_wpVideoErrorHandler`, then remove them in `teardownVideoPlayer()`.

- Make YouTube duration gating resilient.
  Instead of checking `getDuration()` once in `onReady`, sample a few times or gate per sample:

  ```js
  const duration = _wpYtPlayer.getDuration();
  if (duration > 0 && isFinite(duration)) {
    _wpVideoBroadcaster(_wpYtPlayer.getCurrentTime());
  }
  ```

- Consider adding `currentTimeSource` and `durationMs` now for Phase 26 compatibility:

  ```js
  currentTimeMs: number,
  currentTimeUpdatedAt: number,
  currentTimeSource: 'youtube' | 'mp4',
  durationMs: number | null,
  isLiveStream: boolean
  ```

  This avoids Phase 26 having to infer too much from stale or missing data.

- Avoid duplicate `schedule-video-url` ids.
  If sports and movie flows use separate DOM nodes, give them distinct ids or query within the active modal instead of using `document.getElementById()` globally.

- Consider rejecting `http:` MP4 URLs at submit time on production HTTPS.
  If local Plex/Jellyfin HTTP support is important, keep accepting it but show a specific inline warning. Late mixed-content failure is likely confusing.

- Add iframe hardening where compatible with YouTube.
  At minimum, consider `referrerpolicy="strict-origin-when-cross-origin"`. Be careful with `sandbox`; YouTube often needs a permissive enough sandbox to function, so this should be tested rather than guessed.

- Add one acceptance criterion that no non-host client writes `currentTimeMs`.
  Client grep is insufficient; validate with rules tests or emulator if available.

## Risk Assessment

**Overall risk: MEDIUM.**

The phase goal is achievable and the scope is appropriately narrow. The largest risks are integration correctness, not product direction: YouTube API lifecycle, event cleanup, retry wiring, and Firestore write authorization. The 5s broadcast budget is reasonable, and the XSS posture is mostly solid for the constrained YouTube/MP4 surface. Before execution, I would require production-module smoke coverage, explicit rules verification, and a slightly richer Phase 26 schema contract.

---

## Consensus Summary

### Agreed Strengths

Both reviewers converged on:

- **Phase boundary is well-scoped** (YouTube + MP4 only at v2.0; HLS / DASH / Twitch / Vimeo / generic embeds explicitly deferred). Avoids the typical "native player" scope explosion.
- **Wave structure is sound** (smoke + helpers first, UI/lifecycle second, deploy last).
- **URL parser is appropriately defensive** (rejects `javascript:`, `data:`, malformed URLs).
- **DRM-hide-as-silent-dead-end honors brand restraint** and avoids false-promise UX.
- **iOS `playsinline` is acceptance-criteria-gated on both render branches**.
- **Phase 26 forward-compat is named** (`wp.currentTimeMs` + `wp.currentTimeUpdatedAt`), even if Codex flags the schema may be too thin.
- **Contract-driven Wave 1** (smoke locks helper signatures before production code) is solid (Gemini)

### Agreed Concerns (raised by 2+ reviewers — highest priority)

| # | Concern | Severity | Reviewers |
|---|---------|----------|-----------|
| C1 | **Mixed-content HTTP MP4 URLs** (e.g., local Plex/Jellyfin) get late browser block, not submit-time warning. UX confusion. | MEDIUM | Gemini + Codex |
| C2 | **Phase 26 schema may be under-specified** — `currentTimeMs` + `currentTimeUpdatedAt` alone isn't enough; Phase 26 will need `videoSource`, `durationMs`, `isLiveStream`, possibly `positionSource` / `currentTimeSource` | MEDIUM | Codex (explicit) + Gemini (implicit via "join-at-current-time" gap) |

### Reviewer-Exclusive Issues (single-reviewer but actionable)

These were not consensus, but each is a real, actionable concern.

| # | Concern | Severity | Caught by | Notes |
|---|---------|----------|-----------|-------|
| **H1** | **`renderWatchpartyLive` uses `el.innerHTML = ...`** to repaint on every state change. The new player iframe / `<video>` element will be destroyed and recreated on every reaction post, timer tick, or wp record update. Player will reset to 0 (or vanish, since `attachVideoPlayer` only runs once on modal-open). **CATASTROPHIC under normal multi-reaction watchparty use.** | **HIGH (BLOCKER)** | Gemini | Fix: split `#wp-live-content` into persistent `#wp-video-surface` + re-renderable `#wp-live-coordination`. Update `renderWatchpartyLive` to only overwrite the coordination surface. Phase 26 also needs the persistent surface for reaction overlay. |
| **H2** | **Smoke contract mirrors helper code instead of importing the production module.** `24-01` smoke duplicates helper bodies inline; can pass while `js/native-video-player.js` drifts. | HIGH | Codex | Fix: smoke uses `await import('../js/native-video-player.js')` to test the real module. Mirror precedent: existing `scripts/smoke-sports-feed.cjs` for Phase 22. |
| **H3** | **YouTube IFrame API binding pattern in Plan 03 is timing-fragile.** `new YT.Player('wp-yt-player', ...)` on an existing iframe is timing-sensitive; some integrations need a div placeholder + `videoId` instead. | HIGH | Codex | Fix: explicitly verify the binding pattern works (one-shot test or research re-confirm via Context7 / YouTube IFrame API docs); fall back to div-placeholder + videoId pattern if iframe-bind is unreliable. |
| **H4** | **"Try again" link in player error overlay is not wired to an event handler.** Plan 03 Task 3.4 renders `<a class="link-like" data-action="retry-video">Try again</a>` but no listener / `onclick` exists. Clicking does nothing. | HIGH | Codex | Fix: render `<button onclick="reloadWatchpartyPlayer()">` OR add a delegated click listener for `[data-action="retry-video"]` somewhere in the lifecycle. |
| **H5** | **MP4 `<video>` event listeners (`timeupdate`, `error`) are added anonymously and not removed in `teardownVideoPlayer`.** Repeated open/close → handler leak / duplicated broadcasts. | HIGH | Codex | Fix: store handlers as module-scope refs (`_wpVideoTimeHandler` / `_wpVideoErrorHandler`) and `removeEventListener` in teardown. |
| **M1** | **No seek-on-join logic for late participants.** Plans broadcast `currentTimeMs` but participants always start at 0. They have to coordinate manually. | MEDIUM | Gemini | Fix: in `attachVideoPlayer` for non-hosts (where `state.me.id !== wp.hostId`), seek to `wp.currentTimeMs` after initialization. |
| **M2** | **Firestore rules coverage is assumed, not verified.** Phase 15.1 hardened rules with strict field allowlists; new fields may be rejected by current rules. | MEDIUM | Codex | Fix: add rules-test verification in Plan 04 (or a new task in Plan 03) that tests host-write succeeds and non-host-write fails. |
| **M3** | **Duplicate `schedule-video-url` DOM ids** across two modals (`scheduleWatchparty` movie flow + `scheduleSportsWatchparty`). `document.getElementById` returns the first match — wrong field on the wrong modal. | MEDIUM | Codex | Fix: distinct IDs (`schedule-video-url-movie` / `schedule-video-url-sport`) OR `querySelector('.schedule-modal-bg.on .video-url-input')` scoped query. |
| **M4** | **YouTube live-stream gating in `onReady` is premature.** `getDuration()` can return 0 initially before metadata loads, then become finite. Single-shot check would skip broadcast on normal videos. | MEDIUM | Codex | Fix: gate per-sample (`if (duration > 0 && isFinite(duration)) broadcast(...)`) instead of one-time at onReady. |
| **L1** | **Host sync loop risk** — host's broadcasted `currentTimeMs` snapshot from Firestore could trigger UI re-render on host's own device, causing jitter. | LOW | Gemini | Fix: gate broadcaster ingest on `state.me.id !== wp.hostId`. (Mitigated by H1 fix — persistent surface won't re-render on snapshot.) |
| **L2** | **`window.onYouTubeIframeAPIReady` global overwrite risk** if another module uses YT API. | LOW | Codex | Fix: use chained-handler pattern instead of overwriting. |
| **L3** | **Plan 04 `autonomous: false` conflicts with absence-of-objection deploy autonomy** wording. Process confusion only, not behavioral. | LOW | Codex | Fix: clarify in Plan 04 frontmatter that `autonomous: false` means "checkpoint:human-verify before deploy is honored", not "no autonomy at all". |

### Recommendation

Plans passed internal Claude plan-checker but cross-AI review surfaced:

- **1 BLOCKER (H1)** — `renderWatchpartyLive` re-render conflict will catastrophically break the player under normal use. Without the persistent-surface refactor, executing Phase 24 as planned wastes the wave.
- **4 HIGH** — smoke-mirror drift (H2), YT API binding fragility (H3), unwired retry link (H4), MP4 listener leak (H5).
- **4 MEDIUM** — seek-on-join (M1), Firestore rules verification (M2), duplicate DOM IDs (M3), live-stream gating (M4).
- **3 LOW** — host sync loop (L1), YT global overwrite (L2), autonomous-flag wording (L3).
- **2 CONSENSUS MEDIUM** — mixed-content HTTP MP4 (C1), Phase 26 schema thin (C2).

**Strongly recommend `/gsd-plan-phase 24 --reviews`** to revise plans incorporating these findings before `/gsd-execute-phase 24`. The architectural refactor for H1 is the most important change and likely needs to ripple into Plan 03 + UI-SPEC.md (the spec showed the player slotting into the existing modal but didn't address the re-render lifecycle). H2-H5 + M1-M4 are surgical task-level edits the planner can apply in one revision pass.

---

*Cross-AI review run: 2026-04-30 — gemini + codex (claude skipped per CLAUDE_CODE_ENTRYPOINT runtime self-skip rule).*
