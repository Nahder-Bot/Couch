---
phase: 26-position-anchored-reactions-async-replay
plan: 02
subsystem: watchparty-replay-chrome
tags: [watchparty, replay-mode, ui-render, css, smoke-contract]

# Dependency graph
requires:
  - phase: 26-position-anchored-reactions-async-replay
    plan: 01
    provides: state.activeWatchpartyMode + state.replayLocalPositionMs slots ready to write; derivePositionForReaction 'replay' enum branch wired but inert
  - phase: 24-native-video-player
    provides: #wp-live-coordination + #wp-video-surface H1 split; attachVideoPlayer lifecycle preserved unchanged
  - phase: 07-watchparty
    provides: renderWatchpartyLive scaffold + .wp-live-* class family
provides:
  - openWatchpartyLive(wpId, opts) extended signature — opts.mode === 'revisit' sets state.activeWatchpartyMode='revisit' BEFORE first render
  - closeWatchpartyLive flag-clear — clears state.activeWatchpartyMode AND state.replayLocalPositionMs on close
  - getScrubberDurationMs(wp) helper — 5-tier precedence (TMDB t.runtime → t.episode_run_time → wp.durationMs → max observed runtimePositionMs + 30s → 60-min floor)
  - renderReplayScrubber(wp) helper — emits .wp-replay-scrubber-strip with 28px thumb, step="1000" 1-sec snap, locked ARIA + copy
  - formatScrubberTime(ms) helper — h:mm:ss / mm:ss readout formatter
  - isReplay branch in renderWatchpartyLive gated on state.activeWatchpartyMode === 'revisit' && wp.status === 'archived'
  - 'Revisiting' eyebrow + 'together again' italic-serif sub-line in replay variant
  - !isReplay guards on participants strip, Wait Up DVR slider, catch-me-up card, live-mode timer, paused indicator
  - .wp-replay-scrubber-strip / .wp-replay-playpause / .wp-replay-scrubber-input / .wp-replay-scrubber-readout / .wp-live-revisit-subline CSS family (~122 lines in css/app.css)
  - window stubs for toggleReplayClock + onReplayScrubberInput/Change + renderReplayReactionsFeed (Plan 03 replaces with real implementations)
affects: [26-03-replay-feed-and-clock, 26-04-past-parties-expansion]

# Tech tracking
tech-stack:
  added: []  # No new libraries; all changes are vanilla-JS additions inside existing modules
  patterns:
    - "Replay-variant gating via two-level flag: state.activeWatchpartyMode === 'revisit' AND wp.status === 'archived' must BOTH be true (defensive — flipping the state slot in DevTools on a live wp falls through to live chrome)"
    - "Mode flag set BEFORE renderWatchpartyLive() so first paint is mode-correct (no flicker from live → replay variant)"
    - "Window stubs for inline-handler globals (toggleReplayClock + onReplayScrubberInput/Change + renderReplayReactionsFeed) defined as no-ops if not already a function — Plan 03 replaces with real implementations without ReferenceError window between Plan 02 ship and Plan 03 ship"
    - "CSS class family mirrors .wp-dvr-slider track + thumb recipe from css/app.css:3117-3137; scaled per UI-SPEC §2 (28px thumb / 8px track vs DVR 6px/22px)"

key-files:
  created: []
  modified:
    - js/app.js (~140 net lines added: 1 new helper getScrubberDurationMs, 1 new render fn renderReplayScrubber, 1 new helper formatScrubberTime, 4 window stubs, openWatchpartyLive signature + assignment, closeWatchpartyLive 2-line clear, renderWatchpartyLive isReplay branch + 6 ternary guards + scrubberStrip prefix to el.innerHTML)
    - css/app.css (~122 lines appended at end of file — 5 new class selectors, prefers-reduced-motion guard)
    - scripts/smoke-position-anchored-reactions.cjs (96 lines added — 1 inline-mirror helper, 5 helper-behavior assertions, 9 production-code sentinels, 1 negative sentinel, 5 CSS sentinels)

key-decisions:
  - "Window-scope stubs (rather than feature-flag guards) for the inline-handler globals — clean ReferenceError-free shipping between Plan 02 and Plan 03; Plan 03's first task is to replace each stub. Pattern is a 'temporary scaffolding' marker, not a permanent indirection."
  - "Replay-variant feed area shows italic-serif 'Replay feed lands in Plan 03.' placeholder until Plan 03 ships. Only visible to a developer who manually opens an archived wp via console (`openWatchpartyLive('wp-id', {mode:'revisit'})`) since Plan 04 wires the real entry-point row taps. Family users will never see this state in production."
  - "scrubberStrip emits ABOVE the .wp-live-header inside #wp-live-coordination, NOT inside #wp-video-surface — preserves the Phase 24 H1 split invariant (player iframe never re-mounts on coordination re-render)"
  - "Defensive isReplay gate: even if state.activeWatchpartyMode === 'revisit' was somehow forged on a non-archived wp via DevTools, the render branch falls back to live-mode chrome (T-26-06 STRIDE mitigation)"
  - "RPLY-26-16 negative sentinel as smoke assertion (rather than just acceptance criterion grep) — codifies 'no autoplay anywhere outside comments' so any future regression triggers smoke failure"

patterns-established:
  - "Plan 03 will REPLACE the four window stubs (toggleReplayClock + onReplayScrubberInput/Change + renderReplayReactionsFeed) with real local-clock + position-aligned feed implementations — same window slots, no new render-call rewiring needed"
  - "Plan 04 will add the Past parties row tap → openWatchpartyLive(wpId, {mode:'revisit'}) wiring; chrome already exists waiting for the entry-point"

requirements-completed: [RPLY-26-04, RPLY-26-05, RPLY-26-13, RPLY-26-15, RPLY-26-16, RPLY-26-SNAP]

# Metrics
duration: ~12min
completed: 2026-05-01
---

# Phase 26 Plan 02: Replay-Modal Chrome Summary

**Replay-variant of the live modal — scrubber strip, REVISITING eyebrow, 'together again' italic-serif sub-line, hidden Wait Up + participants + live-mode timer — gated on state.activeWatchpartyMode === 'revisit' && wp.status === 'archived'. Window stubs for the inline-handler globals so Plan 03 can drop in real implementations without a ReferenceError window. Live-mode behavior unchanged.**

## Performance

- **Duration:** ~12 min
- **Tasks:** 4 (all atomic-committed)
- **Files modified:** 3 (0 new, 3 edited)

## Accomplishments

- `openWatchpartyLive(wpId, opts)` extended signature — `opts.mode === 'revisit'` sets `state.activeWatchpartyMode = 'revisit'` BEFORE the first `renderWatchpartyLive()` call so the first paint is mode-correct (no flicker). Default `'live'` preserves backward compat for every single-arg call site (Phase 11 / 14 / 15.5 entry points all unchanged)
- `closeWatchpartyLive` clears both `state.activeWatchpartyMode` AND `state.replayLocalPositionMs` after the existing `state.activeWatchpartyId = null` line. RESEARCH Pitfall 9 closed at code level: next live-mode open can no longer render in replay variant
- `getScrubberDurationMs(wp)` returns ms per the locked 5-tier precedence: TMDB `t.runtime` (movies, minutes) → `t.episode_run_time` (TV, minutes) → `wp.durationMs` (Phase 24 host getDuration() × 1000) → max observed `runtimePositionMs` + 30s cushion → 60-min floor (3,600,000 ms)
- `renderReplayScrubber(wp)` emits the `.wp-replay-scrubber-strip` container with 28px range thumb on `--accent`, 8px track, `step="1000"` (RPLY-26-SNAP 1-sec snap), locked ARIA labels (`Move to where you are in the movie` / `Start watching from here`), and a tabular-nums readout span. Inline `oninput` / `onchange` / `onclick` attrs target window-scope stubs that Plan 03 will replace
- `formatScrubberTime(ms)` h:mm:ss / mm:ss formatter for the readout (mirrors the existing live-mode `formatElapsed` shape, adapted for hours-aware output since replay durations can run 2-3hr movie-length)
- `renderWatchpartyLive` gains the `isReplay` branch + 6 chrome-delta ternaries: `'Revisiting'` statusText (CSS `text-transform: uppercase` displays it as `REVISITING`), `'together again'` italic-serif sub-line under the title, `!isReplay` guards on `wp-live-timer`, paused indicator, participant strip, catch-me-up card, DVR slider, and reactions feed (swapped to `window.renderReplayReactionsFeed` when `isReplay`)
- `scrubberStrip` is prefixed to `el.innerHTML` ABOVE the header — emits inside `#wp-live-coordination`, never touches `#wp-video-surface` (preserves Phase 24 H1 split invariant; player iframe survives the variant render)
- ~122 lines of Phase 26 CSS appended to `css/app.css` — 5 new class selectors (`.wp-replay-scrubber-strip`, `.wp-replay-playpause`, `.wp-replay-scrubber-input`, `.wp-replay-scrubber-readout`, `.wp-live-revisit-subline`) + WebKit/Moz pseudo-element rules + `@media (prefers-reduced-motion)` guard. Zero new color tokens
- Smoke contract extended from 33 to 59 assertions (+26 new) — exits 0 in <5s; all Plan 02 RPLY-26-* IDs sentinel-checked: RPLY-26-04 (isReplay flag + archived gate), RPLY-26-05 (getScrubberDurationMs precedence — 5 helper-behavior cases), RPLY-26-13 parts 2+3 (open assignment + close clear), RPLY-26-15 (Revisiting + together again copy), RPLY-26-16 (zero autoplay outside comments — negative sentinel), RPLY-26-SNAP (step="1000")

## Task Commits

Each task was committed atomically:

1. **Task 2.1: Extend openWatchpartyLive(opts) + closeWatchpartyLive flag-clear** — `e8407cc` (feat)
2. **Task 2.2: Add replay-variant chrome to renderWatchpartyLive (getScrubberDurationMs + renderReplayScrubber + isReplay branch + 6 chrome-delta ternaries + window stubs)** — `f3acb78` (feat)
3. **Task 2.3: Add Phase 26 replay-variant CSS family** — `d72bd7c` (feat)
4. **Task 2.4: Extend smoke contract with Plan 02 assertions** — `08b6ba7` (test)

**Plan metadata commit:** pending (final commit at the end of this plan).

## Files Created/Modified

- `js/app.js` — ~140 net lines added across 5 edit zones:
  - **Helper insertion (line ~3019):** `getScrubberDurationMs(wp)` immediately after `formatStartTime()` body close — neighborhood matches the formatting-helper cluster
  - **Helper insertion (line ~11483, before `renderWatchpartyLive`):** `formatScrubberTime`, `renderReplayScrubber`, and 4 window stubs (`toggleReplayClock`, `onReplayScrubberInput`, `onReplayScrubberChange`, `renderReplayReactionsFeed`)
  - **Edit zone (line ~11307, openWatchpartyLive):** signature extended to `(wpId, opts)`; `state.activeWatchpartyMode = (opts && opts.mode === 'revisit') ? 'revisit' : 'live'` inserted BEFORE `renderWatchpartyLive()`
  - **Edit zone (line ~11332, closeWatchpartyLive):** 2-line append clearing `state.activeWatchpartyMode` and `state.replayLocalPositionMs` after the existing `state.activeWatchpartyId = null` line
  - **Edit zone (line ~11550-11770, renderWatchpartyLive body):** `const isArchived = wp.status === 'archived'` + `const isReplay = state.activeWatchpartyMode === 'revisit' && isArchived` flags; `statusText` ternary wrapped with `isReplay ? 'Revisiting' : (...)`; `<div class="wp-live-revisit-subline">together again</div>` slot added; `&& !isReplay` guards on paused indicator + wp-live-timer + participant strip + catch-me-up + DVR slider; reactions feed swapped to `window.renderReplayReactionsFeed` when isReplay; `scrubberStrip` prefixed to `el.innerHTML`
- `css/app.css` — 122 lines appended at end of file (after the Phase 15.5 / Plan 06 END marker) under a `===== Phase 26 — Position-anchored reactions + async-replay (replay variant chrome) =====` header. 5 class selectors + WebKit/Moz pseudo-elements + `@media (prefers-reduced-motion)` guard
- `scripts/smoke-position-anchored-reactions.cjs` — 96 lines added: 1 inline-mirror helper (`getScrubberDurationMs_smoke`), 5 helper-behavior assertions (precedence chain), 9 production-code sentinels (renderWatchpartyLive isReplay flag, archived gate, openWatchpartyLive assignment, closeWatchpartyLive 2 clears, Revisiting + together again copy, step="1000", scrubber + playpause aria-labels, function declarations), 1 negative sentinel (zero autoplay outside comments), 5 CSS sentinels (all 5 class names present in css/app.css)

## Decisions Made

- **Window-scope stubs over feature-flag guards:** The inline-handler globals (`toggleReplayClock` + `onReplayScrubberInput`/`Change` + `renderReplayReactionsFeed`) are defined as `if (typeof window.X !== 'function') { window.X = function() { /* Plan 03 implements */ }; }` no-ops at module load. Plan 03's first task is to assign each window slot to the real implementation. This avoids a ReferenceError window between Plan 02 ship and Plan 03 ship; the if-guard means Plan 03's real assignment wins on next module load (PWAs reload via sw.js cache bump on Plan 26-05 deploy)
- **Replay-feed placeholder is intentionally visible-but-narrow:** Plan 02 ships an italic-serif "Replay feed lands in Plan 03." placeholder. Only visible to a developer manually opening an archived wp via console (`openWatchpartyLive('wp-id', {mode:'revisit'})`) since Plan 04 wires the real entry-point row taps. Family users will never see this state in production. Documented in this SUMMARY for verifier awareness
- **Defensive isReplay gate:** Two-condition check (`state.activeWatchpartyMode === 'revisit' && isArchived`) ensures DevTools-flipping the state flag on a live wp falls back to live chrome — closes T-26-06 STRIDE register threat without adding any user-facing affordance
- **`scrubberStrip` placement above header:** Per UI-SPEC §1 DOM placement diagram, the scrubber sits above `.wp-live-header` inside `#wp-live-coordination` (NOT inside `#wp-video-surface`). The Phase 24 H1 split is preserved verbatim — `attachVideoPlayer(wp)` call in `openWatchpartyLive` is unchanged
- **CSS append at file end (vs insert near `.wp-dvr-slider`):** Appending preserves the file's existing chronology (each phase's additions land at end with a clear delimiter) and avoids churn in the existing 4408-line file. The `=== Phase 15.5 / Plan 06 — END ===` and `/* === Phase 26 — END === */` markers bracket the new block

## Deviations from Plan

None - plan executed exactly as written.

The plan's Task 2.2 Edit C step 6 referenced `renderWaitUpChips` as an example function name — actual current source uses `renderDvrSlider` (sport-mode only) for the Wait Up surface. The implementation correctly guards `renderDvrSlider` with `&& !isReplay` per the plan's intent (Wait Up irrelevant in replay per CONTEXT 'Claude's discretion' guidance — viewer is choosing their own moment via the scrubber). No `renderWaitUpChips` function exists; the plan's example name was illustrative.

## Smoke Output

```
Total assertions: 59; Failures: 0
Phase 26 smoke PASSED.
```

Breakdown:
- 11 Plan 01 helper-behavior assertions (4-state hybrid + replay branch + defensive defaults + replayableReactionCount predicate)
- 5 Plan 02 helper-behavior assertions (getScrubberDurationMs precedence — TMDB movie / TV / wp.durationMs / max-observed / 60-min floor)
- 19 Plan 01 production-code sentinels (RPLY-26-01..03/07/10/13(part 1)/19)
- 9 Plan 02 production-code sentinels (RPLY-26-04/13(parts 2+3)/15/SNAP/05/declarations)
- 1 Plan 02 negative sentinel (RPLY-26-16 — zero autoplay outside comments)
- 5 Plan 02 CSS sentinels (5 class names in css/app.css)
- 3 Plan 01 firestore.rules sanity checks (RPLY-26-19 + Phase 24 M2 currentTime denylist)
- 6 Plan 01 + 0 Plan 02 supporting truthy assertions (function declaration discoveries)

## RPLY-26-* Coverage at the Smoke Layer

| ID | Status | Where |
|---|---|---|
| RPLY-26-04 | ✓ Smoke-codified | `renderWatchpartyLive contains isReplay flag (RPLY-26-04 part 1)` + `renderWatchpartyLive contains wp.status === "archived" eligibility gate (RPLY-26-04 part 2)` |
| RPLY-26-05 | ✓ Smoke-codified | 5 helper-behavior assertions for the locked precedence + `js/app.js declares function getScrubberDurationMs (RPLY-26-05)` declaration sentinel |
| RPLY-26-13 | ✓ Smoke-codified (full) | Part 1 (slot exists) was Plan 01; Plan 02 closes parts 2 (open assigns) + 3 (close clears + replayLocalPositionMs cleared per Pitfall 9) |
| RPLY-26-15 | ✓ Smoke-codified | `js/app.js contains "Revisiting" banner eyebrow source string (RPLY-26-15 part 1)` + `js/app.js contains "together again" italic-serif sub-line literal (RPLY-26-15 part 2)` |
| RPLY-26-16 | ✓ Smoke-codified (negative) | `js/app.js has ZERO autoplay literals outside comments (RPLY-26-16 negative sentinel)` — strips `/* */` and `//` comments before checking |
| RPLY-26-SNAP | ✓ Smoke-codified | `renderReplayScrubber emits step="1000" (RPLY-26-SNAP)` |

## Next Plan Readiness

- **Plan 03 (replay-feed render + local clock + compound-write)** can ASSUME:
  - `state.activeWatchpartyMode` is set/cleared correctly by the lifecycle pair (open/close)
  - `state.replayLocalPositionMs` slot is cleared on close — Plan 03 just writes it on tick
  - `isReplay` branch in `renderWatchpartyLive` exists; Plan 03 adds nothing to the render branch — only swaps the 4 window stubs (`toggleReplayClock`, `onReplayScrubberInput`, `onReplayScrubberChange`, `renderReplayReactionsFeed`) for real implementations
  - `getScrubberDurationMs(wp)` is callable; the WebKit `--scrubber-pct` CSS var exists waiting for Plan 03 to write it dynamically
  - `formatScrubberTime(ms)` is reusable for the live readout updates in Plan 03's clock-tick
  - Smoke contract exists; Plan 03 just appends new assertions for the clock + compound-write surfaces
- **Plan 03's first task to add:** Replace the 4 window stubs with real implementations; smoke must continue passing (the existing stub-presence sentinels will keep working since `if (typeof window.X !== 'function')` guard means Plan 03's real assignment is itself a function, satisfying the check)
- **No UI is visible to family users yet** — Plan 04 wires the entry-point row taps. A developer can manually trigger via console: `openWatchpartyLive('archived-wp-id', {mode:'revisit'})` to see the replay variant chrome (with the "Replay feed lands in Plan 03." placeholder until Plan 03 ships)

## Known Stubs

The following stubs ship with Plan 02 — they are intentional, documented, and will be replaced by Plan 03's real implementations. Each stub allows the Plan 02 chrome to render without ReferenceError so the visual surface is testable end-to-end before Plan 03's clock + compound-write logic lands.

| Stub | File | Reason | Resolved by |
|------|------|--------|-------------|
| `window.toggleReplayClock` | `js/app.js` (~line 11533) | No-op for play/pause button onclick — Plan 03 implements local clock toggle | Plan 26-03 |
| `window.onReplayScrubberInput` | `js/app.js` (~line 11536) | No-op for scrubber oninput — Plan 03 implements live readout sync + feed-position update | Plan 26-03 |
| `window.onReplayScrubberChange` | `js/app.js` (~line 11539) | No-op for scrubber onchange — Plan 03 implements drag-end position commit | Plan 26-03 |
| `window.renderReplayReactionsFeed` | `js/app.js` (~line 11542) | Returns italic-serif "Replay feed lands in Plan 03." placeholder — Plan 03 implements position-aligned reaction subset render | Plan 26-03 |

These stubs are NOT user-visible in production: Plan 04 wires the real entry-point row taps, so until both Plan 03 + Plan 04 ship, no family user has a path to trigger this code path.

## User Setup Required

None — no external service configuration; no deploy in this plan (Plan 26-05 owns the deploy + CACHE bump).

## Self-Check: PASSED

- ✓ FOUND: js/app.js (5 edit zones; node --check pass)
- ✓ FOUND: css/app.css (122 lines appended; node fs read pass)
- ✓ FOUND: scripts/smoke-position-anchored-reactions.cjs (96 lines added; smoke exits 0)
- ✓ FOUND: e8407cc (Task 2.1 commit)
- ✓ FOUND: f3acb78 (Task 2.2 commit)
- ✓ FOUND: d72bd7c (Task 2.3 commit)
- ✓ FOUND: 08b6ba7 (Task 2.4 commit)
- ✓ Smoke: Total assertions: 59; Failures: 0
- ✓ Smoke: 33 (Plan 01) + 26 (Plan 02) ≥ 39 threshold from plan must_haves
- ✓ npm run smoke:replay exits 0
- ✓ All must_haves.truths verified at code level
- ✓ All must_haves.artifacts present with required `contains:` substrings
- ✓ All must_haves.key_links patterns grep-find on the live codebase

---
*Phase: 26-position-anchored-reactions-async-replay*
*Completed: 2026-05-01*
