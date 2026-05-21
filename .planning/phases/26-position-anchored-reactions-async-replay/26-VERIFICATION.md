---
phase: 26-position-anchored-reactions-async-replay
verified: 2026-05-01T19:15:00Z
status: human_needed
score: 24/24 must-haves verified at code level
overrides_applied: 0
re_verification: null
human_verification:
  - test: "Script 1 — Replay-modal entry from Past parties tap"
    expected: "Tonight tab inline link tap opens Past parties modal; row tap closes that modal and opens live-watchparty modal in REVISITING variant (scrubber strip + 'together again' sub-line; no live-mode timer/Wait Up/participants)"
    why_human: "Visual chrome verification + multi-modal navigation flow on iOS PWA"
  - test: "Script 2 — Replay-modal entry from title-detail tap"
    expected: "Title-detail view shows 'Past watchparties' section with italic-serif 'Catch up on what the family said.' sub-line when family has ≥1 archived wp w/ replay-able reactions for that title; row tap enters replay variant; section absent for never-watched titles"
    why_human: "Visual + hide-when-empty (D-10) requires real Firestore state on device"
  - test: "Script 3 — Scrubber drag + reaction fade-in at known position"
    expected: "Dragging scrubber thumb to a known reaction's runtimePositionMs causes the reaction to fade in within ±2s drift window"
    why_human: "Drag-feel + animation timing only verifiable on real touch device"
  - test: "Script 4 — Compound-reaction posts to Firestore at correct position"
    expected: "Posting a reaction in replay mode stamps runtimeSource: 'replay' + runtimePositionMs equal to local clock position; second device viewing same wp at that position sees the new reaction (recursive family memory contract D-05)"
    why_human: "Two-device Firestore round-trip verification"
  - test: "Script 5 — Hide-when-empty surfaces / deploy-day silence"
    expected: "Pre-Phase-26 wps absent from Past parties surface; Tonight inline link absent for existing family on deploy day; title-detail Past watchparties section silent for legacy titles"
    why_human: "First-week-after-deploy framing requires real production data"
  - test: "Script 6 — Wait Up disabled in replay"
    expected: "Wait Up chip strip + slider hidden in replay variant; reaction fade-in not delayed by mine.reactionDelay even when set in live mode"
    why_human: "Cross-mode behavior with persistent state across sessions"
  - test: "Script 7 — Video player renders but does NOT auto-start"
    expected: "On entry to replay variant of a wp with attached videoUrl, player surface renders idle (YouTube embed shows thumbnail + play overlay; MP4 shows poster frame); user-initiated play works"
    why_human: "Audio/playback verification only meaningful on a real device"
  - test: "Script 8 — Drift tolerance ±2s feel"
    expected: "Subjective: scrubber drag near a reaction's runtimePositionMs feels neither premature nor late; ±2s tolerance lands as 'natural' for family-memory framing"
    why_human: "Subjective UX feel"
  - test: "Script 9 — Scrub-backward preserves shown reactions"
    expected: "Once a reaction has appeared in the visible window during a session, scrubbing backward does not unmount it (UI-SPEC §3 additive lock — Pitfall 5)"
    why_human: "Session-set persistence + DOM mount lifecycle on real device"
  - test: "Script 10 — Post-deploy couch-v38-async-replay CACHE active"
    expected: "Force-reloaded PWA shows new cache version; older couch-v37-native-video-player cache purged from Cache Storage"
    why_human: "PWA install + service-worker activate cycle on real iOS device"
---

# Phase 26: Position-anchored Reactions + Async-replay — Verification Report

**Phase Goal:** Reactions become runtime-indexed (capture runtimePositionMs alongside the existing serverTimestamp) so a later viewer can "replay" the original group's reactions aligned to *their* playback position. Hero use case: "Red Wedding" — watch a show the next day at minute 25, see what the group said when they were at minute 25, so you feel like you were part of it. Schema-level change + rejoin/replay UX flow on top.

**Verified:** 2026-05-01T19:15:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                              | Status     | Evidence                                                                                                                                                                              |
| -- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Every new reaction stamps `runtimePositionMs` + `runtimeSource` via `derivePositionForReaction` at both `postReaction` + `postBurstReaction` write sites (D-01..D-05 hybrid) | ✓ VERIFIED | `js/app.js:12336` declares `derivePositionForReaction`; smoke "postReaction body invokes derivePositionForReaction" + "postBurstReaction body invokes derivePositionForReaction" both green |
| 2  | `replayableReactionCount(wp)` correctly filters: rejects pre-Phase-26 (undefined) AND live-stream (null); accepts broadcast/elapsed/replay sources | ✓ VERIFIED | `js/app.js:2939`; smoke "replayableReactionCount mixed (broadcast+elapsed+live-stream+pre-Phase-26) returns 2" + "accepts replay-sourced reactions (D-05)" both green |
| 3  | `state.activeWatchpartyMode` + `replayLocalPositionMs` + `pastPartiesShownCount` slots exist in `js/state.js` initializer | ✓ VERIFIED | `js/state.js:7` contains all three slots inline; smoke "js/state.js declares activeWatchpartyMode slot (RPLY-26-13 part 1)" + 2 sibling slot sentinels green |
| 4  | `openWatchpartyLive(wpId, { mode: 'revisit' })` sets `state.activeWatchpartyMode='revisit'` before first render; `closeWatchpartyLive` clears both flag + `replayLocalPositionMs` (Pitfall 9) | ✓ VERIFIED | `js/app.js:11429` + `:11457`; smoke "openWatchpartyLive assigns state.activeWatchpartyMode" + "closeWatchpartyLive clears state.activeWatchpartyMode" + Pitfall 9 sentinel all green |
| 5  | `renderWatchpartyLive` replay branch gated on `state.activeWatchpartyMode === 'revisit' && wp.status === 'archived'`; emits `REVISITING` eyebrow + `together again` italic-serif sub-line + scrubber strip; hides Wait Up + participants + live timer | ✓ VERIFIED | Smoke RPLY-26-04 part 1+2 green; "Revisiting" + "together again" literal sentinels both green |
| 6  | `getScrubberDurationMs(wp)` precedence: TMDB t.runtime → t.episode_run_time → wp.durationMs → max observed runtimePositionMs+30s cushion → 60min floor | ✓ VERIFIED | `js/app.js:3072`; 5 helper-behavior smoke assertions all green |
| 7  | `renderReplayScrubber` emits `<input type="range" step="1000" ...>` with locked ARIA labels; play/pause button uses ▶/⏸ glyph + `Start watching from here`/`Pause where you are` aria-labels | ✓ VERIFIED | `js/app.js:11602`; smoke RPLY-26-SNAP + 2 ARIA literal sentinels green |
| 8  | NO `autoplay` literal in `js/app.js` outside comments (RPLY-26-16 negative sentinel — player renders but does NOT auto-start) | ✓ VERIFIED | Smoke "js/app.js has ZERO autoplay literals outside comments (RPLY-26-16 negative sentinel)" green |
| 9  | `DRIFT_TOLERANCE_MS = 2000` declared at module scope; used in both `renderReplayReactionsFeed` selection rule AND `_replayClockTick` crossing-detection | ✓ VERIFIED | `js/app.js:11583`; smoke "js/app.js declares const DRIFT_TOLERANCE_MS = 2000 (RPLY-26-DRIFT)" green |
| 10 | `renderReplayReactionsFeed` selection rule: skip if runtimePositionMs == null; show within +DRIFT_TOLERANCE_MS window; sort ascending; persistence Set across scrub-backward (Pitfall 5) | ✓ VERIFIED | `js/app.js:11760`; 5 helper-behavior smoke assertions + 4 production-code sentinels green |
| 11 | `renderReplayReactionsFeed` body does NOT reference `reactionDelay` (Wait Up off in replay — RPLY-26-14 negative sentinel) | ✓ VERIFIED | Smoke "renderReplayReactionsFeed body does NOT reference reactionDelay" green |
| 12 | Local replay clock: `toggleReplayClock` real impl with rAF + Date.now() deltas (tab-blur correct); `onReplayScrubberInput` readout-only (no re-mount, Pitfall 6); `onReplayScrubberChange` re-renders feed at drag-end | ✓ VERIFIED | `js/app.js:11703-11758`; smoke "has window.toggleReplayClock real impl" + "_replayClockTick rAF loop" + "Pause where you are" aria-label sentinels all green |
| 13 | `renderPastParties` query expanded to all-time-paginated `archivedWatchparties()` filtered by `replayableReactionCount(wp) >= 1`; `Show older parties ›` row appears when `allArchived.length > shownCount`; `PAST_PARTIES_PAGE_SIZE = 20` D-09 lock | ✓ VERIFIED | `js/app.js:12604`; smoke 4 sentinels green (archivedWatchparties + replayableReactionCount filter + state.pastPartiesShownCount slice + Show older parties + page size 20) |
| 14 | `renderPastParties` row tap calls `openWatchpartyLive(wpId, { mode: 'revisit' })` AND `renderPastWatchpartiesForTitle` row tap also uses `mode: 'revisit'` (D-08 dual entry — ≥2 call sites) | ✓ VERIFIED | Grep counted 2 occurrences of `mode: 'revisit'` literal; smoke "mode: 'revisit' literal in ≥2 call sites (RPLY-26-08)" green |
| 15 | `renderWatchpartyHistoryForTitle` query narrowed to `activeWatchparties().filter(wp => wp.titleId === t.id)` (D-08 bifurcation — RPLY-26-12) | ✓ VERIFIED | Smoke "renderWatchpartyHistoryForTitle narrowed to activeWatchparties() (RPLY-26-12)" green |
| 16 | `renderPastWatchpartiesForTitle(t)` defined; invoked in `renderDetailShell` immediately after the bifurcated history call; section heading `Past watchparties` + sub-line `Catch up on what the family said.` literals present | ✓ VERIFIED | `js/app.js:8057`; smoke 4 sentinels green (declaration + invocation + h4 heading + sub-line literal) |
| 17 | `friendlyPartyDate(startAt)` 6-tier date-format ladder: today / Last night / Weekday / Last + Weekday / Month Day / Month Day, Year | ✓ VERIFIED | `js/app.js:3046`; 5 helper-behavior smoke assertions (5 fixture cases) green |
| 18 | `allReplayableArchivedCount(allWatchparties)` filters archived wps by replayableReactionCount ≥ 1; used to gate Tonight inline-link `Past parties (N) ›` (RPLY-26-20 — replaces Phase 15.5 staleWps.length count source) | ✓ VERIFIED | `js/app.js:2949`; smoke "Tonight inline link uses allReplayableArchivedCount" + 2 helper-behavior assertions all green |
| 19 | `closePastParties` resets `state.pastPartiesShownCount = null` (Pitfall 10 — pagination cursor between sessions) | ✓ VERIFIED | Smoke "closePastParties resets state.pastPartiesShownCount to null (Pitfall 10)" green |
| 20 | CSS additions: `.wp-replay-scrubber-strip`, `.wp-replay-playpause`, `.wp-replay-scrubber-input`, `.wp-replay-scrubber-readout`, `.wp-live-revisit-subline`, `.past-watchparty-row` family, `.past-parties-show-older` | ✓ VERIFIED | 7 CSS class smoke sentinels all green |
| 21 | `firestore.rules` UNTOUCHED in Phase 26 (D-07 single-repo couch-only deploy); `reactions` NOT in `affectedKeys().hasAny([...])` denylist; Phase 24 M2 `currentTimeMs` denylist still present (sanity) | ✓ VERIFIED | `git log --oneline -- firestore.rules` shows last commit `a2fd4b0` (Phase 24 / REVIEWS M2); 0 Phase 26 commits touched it; smoke RPLY-26-19 + sanity assertion both green |
| 22 | Smoke contract `scripts/smoke-position-anchored-reactions.cjs` ships ≥40 assertions with floor meta-assertion (RPLY-26-17 — fails gate when total < 13) | ✓ VERIFIED | Local run: **103 assertions, 0 failures**; "Phase 26 smoke meets UI-SPEC §7 floor (>=13 assertions) (RPLY-26-17) — total=102" green; floor self-assertion counts as 1 |
| 23 | Smoke wired into `bash scripts/deploy.sh` §2.5 deploy gate AND `npm run smoke` aggregate (9-contract chain) | ✓ VERIFIED | `scripts/deploy.sh:121-125` runs the smoke + extends recap echo; `package.json:8` smoke aggregate ends with `... && node scripts/smoke-position-anchored-reactions.cjs`; `package.json:16` `smoke:replay` alias present; `npm run smoke` exits 0 |
| 24 | Production deploy: `sw.js` line 8 reads `const CACHE = 'couch-v38-async-replay';` AND production `https://couchtonight.app/sw.js` returns the same cache name | ✓ VERIFIED | Local: `sw.js:8` = `const CACHE = 'couch-v38-async-replay';`; curl: production response body contains `const CACHE = 'couch-v38-async-replay';`; commit `d9336cf` 2026-05-01 |

**Score:** 24/24 truths verified at code level

### Per-Plan Verification

| Plan  | Scope                                                                                          | Status     | Smoke Assertion Contribution | Commits                                       |
| ----- | ---------------------------------------------------------------------------------------------- | ---------- | --------------------------- | --------------------------------------------- |
| 26-01 | State slots + helpers + write-site integration + smoke scaffold + deploy.sh/package.json wiring | ✓ VERIFIED | 33 assertions               | dd06cec, 29dacbf, 0e77105, 149e035, 3a4c757   |
| 26-02 | Replay-modal chrome (openWatchpartyLive opts + closeWatchpartyLive clear + renderWatchpartyLive replay branch + scrubber strip + getScrubberDurationMs + REVISITING/together-again + ~122 lines CSS) | ✓ VERIFIED | +26 (= 59 cumulative)       | e8407cc, f3acb78, d72bd7c, 08b6ba7, aa285c7   |
| 26-03 | DRIFT_TOLERANCE_MS const + renderReplayReactionsFeed real impl + rAF clock + scrubber handlers | ✓ VERIFIED | +15 (= 74 cumulative)       | f63d5cb, ebe65af, 0795978, 82d3be9            |
| 26-04 | Past parties expansion + Tonight gating + title-detail bifurcation + Past watchparties section + ~57 lines CSS | ✓ VERIFIED | +28 (= 102 cumulative)      | 374ca87, 36e9600, adb2378, 8f6894b            |
| 26-05 | Smoke floor meta-assertion + 26-HUMAN-UAT.md scaffold (10 scripts, 318 lines) + production deploy via `bash scripts/deploy.sh 38-async-replay` + STATE.md/ROADMAP.md/REQUIREMENTS.md updates | ✓ VERIFIED | +1 floor meta (= 103 total) | 01f31cc, df1752b, d9336cf, c47a0e7            |

### Per-Requirement Traceability (RPLY-26-*)

All 24 requirement IDs from REQUIREMENTS.md `### RPLY-26-*` block (lines 241-267).

| Requirement ID  | Source Plan      | Description                                                              | Status       | Evidence                                                                                                |
| --------------- | ---------------- | ------------------------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------- |
| RPLY-26-01      | 26-01            | derivePositionForReaction 4-state hybrid                                 | ✓ SATISFIED  | `js/app.js:12336`; 5 helper-behavior smoke assertions cover all branches                                |
| RPLY-26-02      | 26-01            | STALE_BROADCAST_MAX_MS named-imported from native-video-player.js        | ✓ SATISFIED  | `js/app.js:14`; smoke RPLY-26-02 sentinel green                                                         |
| RPLY-26-03      | 26-01            | runtimeSource enum closure (4 literals: broadcast/elapsed/live-stream/replay) | ✓ SATISFIED | All 4 literal smoke sentinels green                                                                     |
| RPLY-26-04      | 26-02            | Replay-modal variant gated on activeWatchpartyMode='revisit' AND wp.status='archived' | ✓ SATISFIED | Smoke "renderWatchpartyLive contains isReplay flag" + "wp.status === 'archived' eligibility gate" green |
| RPLY-26-05      | 26-02            | getScrubberDurationMs 5-tier precedence                                  | ✓ SATISFIED  | `js/app.js:3072`; 5 helper-behavior smoke assertions green                                              |
| RPLY-26-06      | 26-03            | Replay reactions feed selection rule (skip null + drift window + ascending sort) | ✓ SATISFIED | 4 helper-behavior + 4 production-code smoke sentinels green                                             |
| RPLY-26-07      | 26-01            | Replay-mode reactions COMPOUND with runtimeSource: 'replay' at postReaction | ✓ SATISFIED | Smoke "postReaction body contains runtimePositionMs literal key" + "runtimeSource: 'replay'" green      |
| RPLY-26-08      | 26-04            | mode: 'revisit' in ≥2 openWatchpartyLive call sites (D-08 dual entry)     | ✓ SATISFIED  | Grep returned 2 occurrences; smoke ≥2 sentinel green                                                    |
| RPLY-26-09      | 26-04            | renderPastParties query expansion to all-time-paginated archived w/ replay-able | ✓ SATISFIED | Smoke "renderPastParties uses archivedWatchparties()" + "applies replayableReactionCount filter" green  |
| RPLY-26-10      | 26-01            | replayableReactionCount predicate                                        | ✓ SATISFIED  | `js/app.js:2939`; 4 helper-behavior smoke assertions green                                              |
| RPLY-26-11      | 26-04            | renderPastWatchpartiesForTitle defined + invoked in renderDetailShell    | ✓ SATISFIED  | Smoke 4 sentinels green                                                                                 |
| RPLY-26-12      | 26-04            | renderWatchpartyHistoryForTitle bifurcation to activeWatchparties()      | ✓ SATISFIED  | Smoke RPLY-26-12 sentinel green                                                                         |
| RPLY-26-13      | 26-01 + 26-02    | state.activeWatchpartyMode slot (init + open assign + close clear)       | ✓ SATISFIED  | 3 smoke sentinels green (state.js slot + open assign + close clear)                                     |
| RPLY-26-14      | 26-03            | Wait Up filter NOT applied in replay (negative sentinel)                 | ✓ SATISFIED  | Smoke negative-match sentinel green                                                                     |
| RPLY-26-15      | 26-02            | REVISITING eyebrow + together again sub-line literals                    | ✓ SATISFIED  | Both literal smoke sentinels green                                                                      |
| RPLY-26-16      | 26-02            | NO autoplay outside comments (negative sentinel)                         | ✓ SATISFIED  | Smoke RPLY-26-16 negative sentinel green (comment-strip + 0 autoplay matches)                            |
| RPLY-26-17      | 26-05            | Smoke contract ≥13 assertions (floor meta-assertion)                     | ✓ SATISFIED  | Floor meta-assertion green at total=102 (well above 13); total now 103 with self-count                  |
| RPLY-26-18      | 26-05            | sw.js CACHE bumped to couch-v38-async-replay                             | ✓ SATISFIED  | Local sw.js + production curl both return `couch-v38-async-replay`; commit d9336cf                      |
| RPLY-26-19      | 26-01            | firestore.rules: reactions NOT in denylist; currentTimeMs denylist intact | ✓ SATISFIED | Smoke 2 sentinels green; firestore.rules last commit a2fd4b0 (Phase 24)                                 |
| RPLY-26-20      | 26-04            | Tonight inline link gates on allReplayableArchivedCount > 0              | ✓ SATISFIED  | Smoke "Tonight inline link uses allReplayableArchivedCount" green                                       |
| RPLY-26-PAGE    | 26-04            | Past parties pagination (state.pastPartiesShownCount + Show older)        | ✓ SATISFIED  | Smoke 3 sentinels green (slice cursor + copy + page size 20)                                            |
| RPLY-26-DATE    | 26-04            | friendlyPartyDate ladder (5 cases)                                       | ✓ SATISFIED  | 5 helper-behavior smoke assertions green                                                                |
| RPLY-26-DRIFT   | 26-03            | DRIFT_TOLERANCE_MS = 2000 literal                                        | ✓ SATISFIED  | Smoke "declares const DRIFT_TOLERANCE_MS = 2000" green                                                  |
| RPLY-26-SNAP    | 26-02            | Scrubber input step="1000" literal                                       | ✓ SATISFIED  | Smoke "renderReplayScrubber emits step=\"1000\" (RPLY-26-SNAP)" green                                   |

**Coverage:** 24/24 RPLY-26-* IDs codified; 0 orphaned. REQUIREMENTS.md traceability table (lines 438-461) lists all 24 IDs as Complete with commit hashes.

### Required Artifacts

| Artifact                                                | Expected                                                                  | Status     | Details                                                                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------- |
| `js/state.js`                                           | 3 new session slots                                                       | ✓ VERIFIED | Line 7 contains `activeWatchpartyMode:null, replayLocalPositionMs:null, pastPartiesShownCount:null` inline    |
| `js/app.js`                                             | helpers + write-site integration + replay UI + entry surfaces             | ✓ VERIFIED | All 13 declarations grep-confirmed: derivePositionForReaction:12336, replayableReactionCount:2939, allReplayableArchivedCount:2949, friendlyPartyDate:3046, getScrubberDurationMs:3072, renderPastWatchpartiesForTitle:8057, openWatchpartyLive:11429, closeWatchpartyLive:11457, DRIFT_TOLERANCE_MS:11583, renderReplayScrubber:11602, toggleReplayClock:11703, onReplayScrubberInput:11725, onReplayScrubberChange:11736, renderReplayReactionsFeed:11760, PAST_PARTIES_PAGE_SIZE:12604 |
| `css/app.css`                                           | Phase 26 chrome (scrubber + replay banner + past-watchparty + show-older) | ✓ VERIFIED | 7 CSS class sentinels green                                                                                   |
| `sw.js`                                                 | CACHE = couch-v38-async-replay                                            | ✓ VERIFIED | Line 8; production curl-verified                                                                              |
| `scripts/smoke-position-anchored-reactions.cjs`         | ≥40 assertions, exit 0                                                    | ✓ VERIFIED | 103 assertions, 0 failures; floor meta-assertion green                                                        |
| `scripts/deploy.sh`                                     | 9th smoke wired into §2.5 gate                                            | ✓ VERIFIED | Lines 121-125 + recap echo line 125                                                                           |
| `package.json`                                          | smoke aggregate + smoke:replay alias                                      | ✓ VERIFIED | Line 8 aggregate + line 16 alias                                                                              |
| `firestore.rules`                                       | UNTOUCHED (D-07 single-repo proof)                                        | ✓ VERIFIED | Last commit a2fd4b0 (Phase 24); zero Phase 26 commits                                                         |
| `.planning/phases/26-.../26-HUMAN-UAT.md`               | ≥10 device-UAT scripts, ≥80 lines                                         | ✓ VERIFIED | 318 lines, 10 scripts, frontmatter `deployed: 2026-05-01` + `cache: couch-v38-async-replay` + resume signal `uat passed` |

### Behavioral Spot-Checks

| Behavior                                          | Command                                                                  | Result                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Status |
| ------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Phase 26 smoke contract exits 0 with ≥40 assertions | `node scripts/smoke-position-anchored-reactions.cjs`                     | `Total assertions: 103; Failures: 0` / `Phase 26 smoke PASSED.`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | ✓ PASS |
| 9-contract npm smoke aggregate exits 0            | `npm run smoke`                                                          | All 9 contracts pass; final line `Phase 26 smoke PASSED.`; exit code 0                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | ✓ PASS |
| Local sw.js cache name                            | `grep "^const CACHE" sw.js`                                              | `const CACHE = 'couch-v38-async-replay';`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✓ PASS |
| Production sw.js cache name                       | `curl -fsSL https://couchtonight.app/sw.js \| grep "^const CACHE"`        | `const CACHE = 'couch-v38-async-replay';`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | ✓ PASS |
| firestore.rules untouched in Phase 26             | `git log --oneline -- firestore.rules`                                   | Last commit `a2fd4b0 feat(24-04): Firestore rules-tests + tighten wp host-only fields (REVIEWS M2)`; no Phase 26 entries                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | ✓ PASS |
| HUMAN-UAT script count                            | `grep -c "^### Script " 26-HUMAN-UAT.md`                                 | 10 (matches 10-script scaffold lock)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ✓ PASS |

### Anti-Patterns Found

None found in code-level scan. The smoke gate enforces these continuously:
- Negative `autoplay` outside-comments check (RPLY-26-16)
- Negative `reactionDelay` reference inside renderReplayReactionsFeed body (RPLY-26-14)
- Floor meta-assertion (RPLY-26-17) — gate fails if total drops below 13

### Execution Deviation (informational only — does NOT affect verification)

During Plan 03 execution, an executor accidentally invoked `bash scripts/deploy.sh --dry-run` (the script has no `--dry-run` flag), which triggered a real deploy with malformed cache name `couch-v--dry-run`. The executor self-recovered by re-deploying with the previous Phase 24 cache (`couch-v37-native-video-player`). Plan 26-05 then deployed cleanly to `couch-v38-async-replay`.

**Final state confirmed correct:**
- Local `sw.js:8` = `const CACHE = 'couch-v38-async-replay';`
- Production `https://couchtonight.app/sw.js` = `const CACHE = 'couch-v38-async-replay';`
- Phase 26 commit chain in couch repo is clean — no `couch-v--dry-run` artifact in current sources
- The deviation lived only on the production CDN and was overwritten by the correct Plan 26-05 deploy

No verification gap from this deviation.

### Human Verification Required

Phase 26 ships device-UI changes (replay-variant modal, scrubber, Past parties pagination, title-detail past section) that automated checks cannot fully validate. The smoke contract verifies the production-source contract; only a real-device sweep proves the experience lands.

10 device-UAT scripts in `26-HUMAN-UAT.md` (318 lines, awaiting `uat passed` resume signal):

1. **Script 1 — Replay-modal entry from Past parties tap** (RPLY-26-08, 04)
2. **Script 2 — Replay-modal entry from title-detail tap** (RPLY-26-11, 04)
3. **Script 3 — Scrubber drag + reaction fade-in at known position** (RPLY-26-05, DRIFT)
4. **Script 4 — Compound-reaction posts to Firestore at correct position** (RPLY-26-07; D-05 recursive family memory)
5. **Script 5 — Hide-when-empty surfaces / deploy-day silence** (RPLY-26-06, 09, 20)
6. **Script 6 — Wait Up disabled in replay** (RPLY-26-14)
7. **Script 7 — Video player renders but does NOT auto-start** (RPLY-26-16)
8. **Script 8 — Drift tolerance ±2s feel** (RPLY-26-DRIFT)
9. **Script 9 — Scrub-backward preserves shown reactions** (UI-SPEC §3 persistence)
10. **Script 10 — Post-deploy couch-v38-async-replay CACHE active** (RPLY-26-18)

Each script ships title + What to test + Setup + Steps + Expected + Pass criterion + Resume signal in `26-HUMAN-UAT.md`. Final sign-off: reply `uat passed` → trigger `/gsd-verify-work 26`.

### Gaps Summary

**Zero code-level gaps.** All 24 must-haves verified end-to-end:
- Schema additions live (runtimePositionMs + runtimeSource at both write sites)
- Replay variant chrome shipped (REVISITING + together again + scrubber + hidden Wait Up/timer/participants)
- Replay-feed render with locked selection rule + persistence Set + drift tolerance
- Local clock with rAF + Date.now() deltas + glyph/aria-label flip
- Compound-write contract (D-05) end-to-end (postReaction reads activeWatchpartyMode + replayLocalPositionMs)
- Past parties surface reshaped (all-time + paginated + replay-mode entry)
- Title-detail bifurcated (active-only + new Past watchparties section + Catch up sub-line)
- Tonight inline link gating refactored (allReplayableArchivedCount source)
- Helpers (friendlyPartyDate, allReplayableArchivedCount, getScrubberDurationMs)
- 103-assertion smoke contract with floor meta-assertion
- Production deployed: `couch-v38-async-replay` curl-verified at couchtonight.app
- D-07 single-repo couch-only deploy proof (firestore.rules untouched)

The only outstanding work is real-device UAT (Scripts 1-10 in `26-HUMAN-UAT.md`). This is the expected close-out shape for Phase 26 — mirrors Phase 18/19/20/24.

---

_Verified: 2026-05-01T19:15:00Z_
_Verifier: Claude (gsd-verifier)_
