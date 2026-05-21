---
phase: 26-position-anchored-reactions-async-replay
plan: 04
subsystem: watchparty-replay-entry-surfaces
tags: [past-parties, title-detail, pagination, friendly-date, smoke-contract]

# Dependency graph
requires:
  - phase: 26-position-anchored-reactions-async-replay
    plan: 01
    provides: replayableReactionCount(wp) helper + state.pastPartiesShownCount slot ready to write
  - phase: 26-position-anchored-reactions-async-replay
    plan: 02
    provides: openWatchpartyLive(wpId, opts) accepts {mode:'revisit'} signal
  - phase: 26-position-anchored-reactions-async-replay
    plan: 03
    provides: replay-variant of live modal fully functional end-to-end when entered (DRIFT_TOLERANCE_MS const + real renderReplayReactionsFeed + rAF clock + scrubber handlers + compound-write)
  - phase: 15.5-wait-up-flex
    provides: Past parties inline link surface (D-04) + closePastParties + renderPastParties scaffold + .past-parties-row CSS family
  - phase: 07-watchparty
    provides: renderWatchpartyHistoryForTitle (active+archived all-titles version) + .wp-history-item CSS
provides:
  - friendlyPartyDate(startAt) helper — friend-voice date ladder (5 cases) per UI-SPEC §Copywriting (RPLY-26-DATE)
  - allReplayableArchivedCount(allWatchparties) helper — Tonight inline-link gating count source (RPLY-26-20)
  - renderPastParties: query expanded from 5h-25h WP_STALE_MS window to all-time-paginated archived parties with replayable filter (RPLY-26-09); row tap calls openWatchpartyLive(wpId, {mode:'revisit'}) — replay-mode entry from Past parties surface (RPLY-26-08 part 1); pagination Show older parties › row (RPLY-26-PAGE)
  - renderWatchpartyHistoryForTitle bifurcated to active-only (RPLY-26-12, D-08)
  - renderPastWatchpartiesForTitle(t) NEW function inserted into renderDetailShell after the bifurcated active-only call; renders only when pastReplayableForTitle(t.id).length > 0 — silent UX hide-when-empty per D-10 (RPLY-26-11); row tap calls openWatchpartyLive(wpId, {mode:'revisit'}) — replay-mode entry from title-detail (RPLY-26-08 part 2)
  - closePastParties pagination cursor reset state.pastPartiesShownCount = null (Pitfall 10)
  - .past-watchparty-row family CSS for the title-detail section (~50 lines) + .past-parties-show-older pagination row
  - smoke contract Plan 04 extension (74 → 102 assertions; +28 new)
affects: [26-05-deploy]

# Tech tracking
tech-stack:
  added: []  # No new libraries; vanilla-JS additions inside existing modules
  patterns:
    - "Friend-voice date ladder hardcoded English (RESEARCH Open Q#4: Couch is English-only at v2) — 6-tier branch returning 'Started N hr ago' / 'Last night' / weekday / 'Last + weekday' / 'Month Day' / 'Month Day, Year'"
    - "Past parties query expansion: archivedWatchparties() + replayableReactionCount(wp) >= 1 filter, sorted most-recent-first; client-side pagination with state.pastPartiesShownCount cursor + PAST_PARTIES_PAGE_SIZE=20 (D-09 lock); cursor cleared on close per Pitfall 10"
    - "Title-detail bifurcation (D-08): renderWatchpartyHistoryForTitle = active-only + renderPastWatchpartiesForTitle = archived-with-replayable. Two distinct sections, each hide-when-empty per D-10. Title-detail row tap prefixes closeDetailModal() before openWatchpartyLive call (different from Past parties surface which uses closePastParties() prefix)"
    - "Universal replay-mode entry: every row tap on Past parties surface uses {mode:'revisit'} regardless of original participation (D-08 dual-entry — first user-facing replay entry points). Old joined ? open : join ternary in renderPastParties is gone since replay mode is universal regardless of whether viewer was originally on the couch"
    - "Tonight inline-link gating refactor: count source switched from Phase 15.5 staleWps.length to allReplayableArchivedCount(state.watchparties); preserves hide-when-zero gating (D-10 silent UX); first-week-after-deploy framing — count is 0 for existing families on Phase 26 deploy day until new wps with Phase 26 schema get archived (D-11 + D-10 combination)"

key-files:
  created: []
  modified:
    - js/app.js (~140 net lines added: 2 new helpers (friendlyPartyDate + allReplayableArchivedCount), 1 new render function (renderPastWatchpartiesForTitle), 4 EXISTING functions modified (renderPastParties full rewrite, renderWatchpartyBanner Tonight inline-link block gating refactor, renderWatchpartyHistoryForTitle 1-line query bifurcation, renderDetailShell template-literal addition), closePastParties cursor-reset addition)
    - css/app.css (~57 lines appended at end of Phase 26 block: .past-watchparties-for-title-list + .past-watchparty-row family (poster 48×72 with --accent border at 0.18 alpha, min-height 72px) + .past-parties-show-older pagination row)
    - scripts/smoke-position-anchored-reactions.cjs (127 lines added: 2 inline-mirror helpers (friendlyPartyDate_smoke + allReplayableArchivedCount_smoke), 7 helper-behavior assertions, 18 production-code sentinels, 3 CSS sentinels)

key-decisions:
  - "Universal replay-mode entry on Past parties (no joined-or-not branching): the OLD `joined ? openWatchpartyLive(...) : joinWatchparty(...)` ternary is gone because replay mode is universal regardless of whether the viewer was originally on the couch — they're revisiting an archived party, not joining a live one (UI-SPEC §4 lock, D-08 contract)"
  - "Comment-only WP_STALE_MS reference inside renderPastParties body retained as documentation of what the query transitioned away from. Acceptance criterion target was the actual filter logic (no longer using WP_STALE_MS), not zero textual occurrences. Helps future readers understand the Phase 26 reshape"
  - "renderWatchpartyHistoryForTitle status pill remnant kept (the isActive ternary that produces Live vs Archived labels). UI-SPEC §5 explicitly allows 'planner may simplify' for the bifurcated active-only function but a minimal-diff approach preserves the existing visual without functional impact (every row in the active-only path is by definition active, so the pill always reads Live; harmless but cleaner left alone for next-pass refactor)"
  - "renderPastWatchpartiesForTitle uses inline style attribute for the italic-serif sub-line rather than a new .detail-section-subline class. UI-SPEC §5 specifies the sub-line copy lock + italic Instrument Serif treatment — making it inline preserves the Plan 04 minimal-CSS-diff target while still matching the spec verbatim. Future polish phase could extract into a shared class if other sections gain similar sub-lines"
  - "PAST_PARTIES_PAGE_SIZE=20 lives as a function-local const inside renderPastParties (not a module-level constant) per D-09 lock — page size is a single-call-site constant; promoting it to module-level adds noise without future reuse benefit. The pagination affordance's onclick handler reads the same magic number (template-literal interpolation) — both kept consistent at 20"

patterns-established:
  - "Plan 05 (final wave) can ASSUME: ALL user-facing entry surfaces are functional. Past parties row tap → replay variant; title-detail Past watchparties row tap → replay variant. No console-only invocations needed. Plan 05's only remaining work: sw.js CACHE bump to couch-v38-async-replay + RPLY-26-17 smoke floor count assertion + HUMAN-UAT scaffold + cross-repo deploy ritual"
  - "Visual UAT path post-deploy: a host posts Phase 26 reactions during a live wp → wp auto-archives (or host archives) → viewer opens wp via Past parties row tap → replay variant scrubber drag → reactions fade in at runtime positions. End-to-end family memory loop now testable on real devices once Plan 05 ships the cache bump"

requirements-completed: [RPLY-26-08, RPLY-26-09, RPLY-26-11, RPLY-26-12, RPLY-26-20, RPLY-26-PAGE, RPLY-26-DATE]

# Metrics
duration: ~9min
completed: 2026-05-01
---

# Phase 26 Plan 04: Past Parties Expansion + Title-Detail Bifurcation + Entry Surfaces Summary

**The user-facing entry pieces of Phase 26 — extended Phase 15.5's Past parties surface from 5h-25h-window to all-time-paginated, gated the Tonight inline link on `allReplayableArchivedCount > 0`, bifurcated the title-detail Watchparties section into active-only + a new Past watchparties section, shipped the friendly-date helper + pagination cursor + Pitfall 10 cleanup. After this plan, the only way to OPEN a wp in replay mode is no longer console-only — both D-08 dual-entry surfaces (Past parties row tap + title-detail row tap) call `openWatchpartyLive(wpId, {mode:'revisit'})` directly.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-01T18:13:00Z
- **Completed:** 2026-05-01T18:22:00Z
- **Tasks:** 3 (all atomic-committed)
- **Files modified:** 3 (0 new, 3 edited)
- **Smoke assertions:** 74 → 102 (+28)

## Accomplishments

- `friendlyPartyDate(startAt)` returns the locked date-format ladder for the 6 cases per UI-SPEC §Copywriting: `< 24h` → `Started N hr ago` (preserved from Phase 15.5); `24-48h` → `Last night`; `< 7d` → `{Weekday}`; `7-13d` → `Last {Weekday}`; `< 1y same year` → `{Month} {Day}`; cross-year → `{Month} {Day}, {Year}`. Hardcoded English per RESEARCH Open Q#4.
- `allReplayableArchivedCount(allWatchparties)` returns the count of archived watchparties whose `replayableReactionCount(wp) >= 1`. Replaces Phase 15.5's `staleWps.length` count source for Tonight inline-link gating (RPLY-26-20). First-week-after-deploy framing: count is 0 for existing families on Phase 26 deploy day because D-11 (no backfill) + D-10 (hide replayable-empty) combination filters out all pre-Phase-26 archived parties.
- `renderPastParties` query expanded from 5h-25h `WP_STALE_MS` window to `archivedWatchparties()` filtered by `replayableReactionCount(wp) >= 1` (RPLY-26-09). Universal replay-mode entry per D-08: every row tap calls `openWatchpartyLive(wpId, {mode:'revisit'})` regardless of whether the viewer was originally on the couch — replay mode is universal. Old `joined ? open : join` ternary gone. Subtitle line 1 uses `friendlyPartyDate(wp.startAt)`; subtitle line 3 added `{N} reactions` (singular: `1 reaction`).
- `renderPastParties` pagination per UI-SPEC §4: `PAST_PARTIES_PAGE_SIZE = 20` (D-09 lock); slice cursor `state.pastPartiesShownCount || PAST_PARTIES_PAGE_SIZE`; `Show older parties ›` row appears when `allArchived.length > shownCount`; tap increments `state.pastPartiesShownCount` by `PAST_PARTIES_PAGE_SIZE` and re-renders. Loading state and "End of history" copy intentionally omitted per UI-SPEC §4 (no end-of-history copy when all pages loaded).
- `closePastParties()` resets `state.pastPartiesShownCount = null` per Pitfall 10 (pagination cursor reset between sessions).
- `renderWatchpartyBanner` Tonight tab inline link gating refactored: count source switched from `staleWps.length` to `allReplayableArchivedCount(state.watchparties)`; the link renders only when `pastReplayableCount > 0` (preserves Phase 15.5's hide-when-zero pattern with the new count source). The `staleWps` variable computed earlier in the function (line ~11396) is unchanged — it's still used by the freshWps/staleWps split for the banner-vs-past-parties UX boundary; Plan 04 only changes what the inline link reads.
- `renderWatchpartyHistoryForTitle` query narrowed to `activeWatchparties().filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt)` per RPLY-26-12 / D-08 bifurcation. The status pill code (`isActive` ternary producing Live/Archived) is now redundant in practice but retained for minimal diff per UI-SPEC §5 ("planner may simplify" not mandatory).
- `renderPastWatchpartiesForTitle(t)` NEW function returns empty string when `archivedWatchparties().filter(wp => wp.titleId === t.id).filter(wp => replayableReactionCount(wp) >= 1)` is empty (D-10 silent UX hide-when-empty per Pitfall 7). When non-empty, returns the section structure per UI-SPEC §5: heading `Past watchparties` (sentence case, distinct from active `Watchparties`); italic Instrument Serif sub-line `Catch up on what the family said.`; up to 10 rows sorted most-recent-first; row tap → `closeDetailModal();openWatchpartyLive('${wpId}', { mode: 'revisit' })` (RPLY-26-08 part 2 — D-08 second entry point).
- `renderDetailShell` invokes `renderPastWatchpartiesForTitle(t)` immediately after `renderWatchpartyHistoryForTitle(t)` and before `loadingHtml` per RPLY-26-11 part 2.
- `css/app.css` — ~57 lines appended for the Phase 26 / Plan 04 block: `.past-watchparties-for-title-list` flex container; `.past-watchparty-row` family (poster 48×72 with `--accent` border at 0.18 alpha per Accent reserved-for #5; min-height 72px; hover/focus states); `.past-watchparty-poster` / `.past-watchparty-body` / `.past-watchparty-title` / `.past-watchparty-meta` / `.past-watchparty-chevron`; `.past-parties-show-older` pagination row (44px min-height + center-aligned + accent focus outline). Zero new color tokens.
- `scripts/smoke-position-anchored-reactions.cjs` extended from 74 to 102 assertions (+28 new) — exits 0 in <5s; all Plan 04 RPLY-26-* IDs sentinel-checked: RPLY-26-DATE (5 friendlyPartyDate ladder cases + helper declaration), RPLY-26-20 (allReplayableArchivedCount helper-behavior + Tonight gating sentinel + helper declaration), RPLY-26-09 (renderPastParties query expansion 3-part sentinel set), RPLY-26-PAGE (state.pastPartiesShownCount slice + Show older parties copy + PAST_PARTIES_PAGE_SIZE=20 D-09 lock), RPLY-26-12 (renderWatchpartyHistoryForTitle bifurcation), RPLY-26-11 (renderPastWatchpartiesForTitle declaration + invocation + heading + sub-line), RPLY-26-08 (mode:'revisit' literal in ≥2 call sites — D-08 dual entry verified), Pitfall 10 (closePastParties cursor reset). Plus 3 CSS sentinels.

## Task Commits

Each task was committed atomically:

1. **Task 4.1: Add friendlyPartyDate + allReplayableArchivedCount helpers; refactor renderPastParties (query + pagination + row template); add closePastParties cursor reset** — `374ca87` (feat)
2. **Task 4.2: Refactor Tonight inline-link gating; bifurcate renderWatchpartyHistoryForTitle; add renderPastWatchpartiesForTitle + invocation in renderDetailShell; ship Phase 26 / Plan 04 CSS** — `36e9600` (feat)
3. **Task 4.3: Extend smoke contract with Plan 04 assertions (102 total)** — `adb2378` (test)

**Plan metadata commit:** pending (final commit at the end of this plan).

## Files Created/Modified

- `js/app.js` — ~140 net lines added across 5 edit zones:
  - **Edit zone 1 (line ~3019):** `friendlyPartyDate(startAt)` helper inserted immediately after `formatStartTime(ts)` body close — formatting-helper cluster neighborhood. 30-line function with 6-tier branch
  - **Edit zone 2 (line ~2945):** `allReplayableArchivedCount(allWatchparties)` helper inserted immediately after `replayableReactionCount(wp)` (Plan 01's analog one-liner) — shares the same 'is this replayable?' semantics with the per-wp helper but rolls up across the whole list
  - **Edit zone 3 (line ~11470, renderWatchpartyBanner):** Tonight inline-link block refactored — `const pastReplayableCount = allReplayableArchivedCount(state.watchparties)` line added; 4 substitutions of `staleWps.length` → `pastReplayableCount`; comment swapped from `// Phase 15.5 / D-04 + REQ-10 ...` to `// Phase 26 / RPLY-26-20 ...`
  - **Edit zone 4 (line ~7980, renderWatchpartyHistoryForTitle):** 1-line query bifurcation — `state.watchparties.filter(wp => wp.titleId === t.id).sort(...)` becomes `activeWatchparties().filter(wp => wp.titleId === t.id).sort(...)` plus a 2-line Phase 26 / RPLY-26-12 comment annotation. Rest of function body unchanged
  - **Edit zone 5 (line ~8004, renderPastWatchpartiesForTitle NEW + line ~7975 renderDetailShell template literal):** new ~45-line function `renderPastWatchpartiesForTitle(t)` defined immediately after `renderWatchpartyHistoryForTitle` close. Then 1-line addition to `renderDetailShell` template literal: `${renderPastWatchpartiesForTitle(t)}` between `${renderWatchpartyHistoryForTitle(t)}` and `${loadingHtml}`
  - **Edit zone 6 (line ~12565, renderPastParties full rewrite + closePastParties cursor reset):** entire `renderPastParties` body replaced with the new query + pagination + universal-revisit-mode-entry shape. Then 2-line append inside `closePastParties` for Pitfall 10 cursor reset
- `css/app.css` — ~57 lines appended at end of Phase 26 block (between `/* === Phase 26 — END === */` markers; new `/* ===== Phase 26 / Plan 04 ===== */` sub-block before the existing END marker). 7 class selectors covering the title-detail row family + the pagination row + reduced-motion-friendly hover states
- `scripts/smoke-position-anchored-reactions.cjs` — 127 lines added before the `// ===== Final report =====` block: 2 inline-mirror helpers (`friendlyPartyDate_smoke` + `allReplayableArchivedCount_smoke`), 7 helper-behavior assertions, 18 production-code sentinels, 3 CSS sentinels. Total grew from 74 to 102 assertions

## Decisions Made

- **Universal replay-mode entry on Past parties (no joined-or-not branching):** The OLD `joined ? openWatchpartyLive(...) : joinWatchparty(...)` ternary in `renderPastParties` row construction is gone — every row uses `openWatchpartyLive('${wpIdSafe}', { mode: 'revisit' })` regardless of whether the viewer was originally on the couch. Justification: archived parties are revisits, not joins. UI-SPEC §4 lock + D-08 dual-entry contract.
- **Comment-only `WP_STALE_MS` reference retained inside `renderPastParties`:** The acceptance criterion `grep -A 20 ... | grep WP_STALE_MS` returned 1 match — but it's inside the `// Phase 26 / RPLY-26-09 — switch query from 5h-25h WP_STALE_MS window ...` documentation comment, NOT in the filter logic. The substantive criterion (filter no longer USES `WP_STALE_MS`) is satisfied. Comment helps future readers understand the Phase 26 reshape.
- **Status pill remnant in `renderWatchpartyHistoryForTitle`:** UI-SPEC §5 says "planner may simplify" the bifurcated active-only function. Plan 04 keeps the `isActive` ternary + Live/Archived pill code intact for minimal diff — every row in the active-only path is by definition active, so the pill always renders Live; harmless but cleaner left alone for a future-pass refactor (UI-SPEC contract honored: simplification was optional, not mandatory).
- **Inline-style sub-line in `renderPastWatchpartiesForTitle` (vs new CSS class):** UI-SPEC §5 locks the sub-line copy + italic Instrument Serif treatment. Plan 04 uses inline `style="..."` to preserve the minimal-CSS-diff target (~57 line-budget for the title-detail family + pagination row was the plan's CSS scope). A future polish phase could extract into a shared `.detail-section-subline` class if other sections gain similar sub-lines.
- **`PAST_PARTIES_PAGE_SIZE=20` as function-local const (not module-level):** Per D-09 lock, the page size is a single-call-site constant. Promoting to module-level adds noise without future reuse benefit. The pagination affordance's onclick handler reads the same magic number via template-literal interpolation — both kept consistent at 20.

## Deviations from Plan

None - plan executed exactly as written.

The only judgment call was choosing to retain the comment-only `WP_STALE_MS` reference (annotating what the query transitioned away from) rather than scrubbing it for grep-purity. The acceptance criterion targets the filter logic, which is satisfied (uses `archivedWatchparties()`, not `WP_STALE_MS`).

## Issues Encountered

- **Smoke output one minor warning (pre-existing, benign):** `MODULE_TYPELESS_PACKAGE_JSON — Reparsing as ES module because module syntax was detected.` Same warning Plans 01 + 02 + 03 surfaced; the project intentionally has no `"type": "module"` in package.json (single-file no-bundler architecture per CLAUDE.md). Smoke still passes; warning is consistent across all 9 contracts.

## Smoke Output

```
Total assertions: 102; Failures: 0
Phase 26 smoke PASSED.
```

Breakdown:
- 74 carried-forward assertions (Plans 01 + 02 + 03)
- 7 Plan 04 helper-behavior assertions:
  - 5 `friendlyPartyDate` ladder cases (5h ago → "Started 5 hr ago"; 36h ago → "Last night"; 4d ago → weekday name; 10d ago → "Last + weekday"; 400d ago → "Month Day, Year")
  - 2 `allReplayableArchivedCount` cases (empty list → 0; mixed-fixture → 1)
- 18 Plan 04 production-code sentinels:
  - 2 helper declarations (`friendlyPartyDate` + `allReplayableArchivedCount`)
  - 1 Tonight gating refactor sentinel (`allReplayableArchivedCount(state.watchparties)` literal)
  - 6 `renderPastParties` body sentinels (`archivedWatchparties()` + `replayableReactionCount(wp) >= 1` + `friendlyPartyDate(wp.startAt)` + `state.pastPartiesShownCount` + "Show older parties" copy + `PAST_PARTIES_PAGE_SIZE = 20`)
  - 1 `renderPastParties` neighborhood sentinel (function exists)
  - 1 `renderWatchpartyHistoryForTitle` bifurcation sentinel (`activeWatchparties().filter(wp => wp.titleId === t.id`)
  - 1 `renderWatchpartyHistoryForTitle` neighborhood sentinel (function exists)
  - 4 `renderPastWatchpartiesForTitle` sentinels (declaration + `renderDetailShell` invocation + `<h4>Past watchparties</h4>` heading + `Catch up on what the family said.` sub-line)
  - 1 RPLY-26-08 dual-entry sentinel (`mode: 'revisit'` literal count ≥ 2)
  - 1 closePastParties Pitfall 10 sentinel (cursor reset to null)
- 3 Plan 04 CSS sentinels (`.past-watchparty-row` + `.past-watchparty-poster` + `.past-parties-show-older`)

Final assertion count: 102 (exceeds the ≥80 floor specified in plan success criteria; was 74 + ≥6 new in must_haves; achieved 74 + 28).

## RPLY-26-* Coverage at the Smoke Layer

| ID | Status | Where |
|---|---|---|
| RPLY-26-08 | ✓ Smoke-codified (full) | `js/app.js contains "mode: 'revisit'" literal in ≥2 call sites (RPLY-26-08)` — count check confirms BOTH renderPastParties row template AND renderPastWatchpartiesForTitle row template emit the literal (D-08 dual-entry verified) |
| RPLY-26-09 | ✓ Smoke-codified (full) | 3 production-code sentinels for the renderPastParties query expansion: `archivedWatchparties()` + `replayableReactionCount(wp) >= 1` + filter chain |
| RPLY-26-11 | ✓ Smoke-codified (full) | 4 sentinels: declaration + renderDetailShell invocation + `<h4>Past watchparties</h4>` heading + `Catch up on what the family said.` sub-line |
| RPLY-26-12 | ✓ Smoke-codified | `renderWatchpartyHistoryForTitle narrowed to activeWatchparties() (RPLY-26-12)` body-slice regex |
| RPLY-26-20 | ✓ Smoke-codified | 2 helper-behavior assertions for `allReplayableArchivedCount` + 1 production-code sentinel for the Tonight inline-link refactor + helper declaration sentinel |
| RPLY-26-PAGE | ✓ Smoke-codified | 3 production-code sentinels: `state.pastPartiesShownCount` slice cursor + `Show older parties` copy + `PAST_PARTIES_PAGE_SIZE = 20` D-09 lock |
| RPLY-26-DATE | ✓ Smoke-codified (full) | 5 helper-behavior assertions for the friendly-date ladder (today/Last night/weekday/Last+weekday/cross-year) + 1 production-code sentinel for the helper declaration + 1 wiring sentinel (`renderPastParties uses friendlyPartyDate for row date line`) |

## RPLY-26-* Audit Trail

Plan-by-plan codification breakdown (per plan output instruction):

- **Plan 01:** 7 IDs codified (RPLY-26-01, 02, 03, 07, 10, 13, 19)
- **Plan 02:** 6 IDs codified (RPLY-26-04, 05, 13 parts 2+3, 15, 16, SNAP)
- **Plan 03:** 3 IDs codified (RPLY-26-06, 14, DRIFT)
- **Plan 04 (this plan):** 7 IDs codified (RPLY-26-08, 09, 11, 12, 20, PAGE, DATE)
- **Plan 05 (final):** 2 IDs scoped (RPLY-26-17 smoke floor count + RPLY-26-18 CACHE bump at deploy)

**Coverage progress: 7 + 6 + 3 + 7 = 23 IDs codified after Plan 04; remaining 2 IDs (RPLY-26-17 + RPLY-26-18) for Plan 05.**

Note: Of the 24 RPLY-26-* IDs across the phase, only RPLY-26-17 (smoke floor count assertion) and RPLY-26-18 (CACHE bump at deploy) remain for Plan 05. After Plan 05 ships, all 24 IDs are in production.

## Compound-Write Contract (D-05) End-to-End Reachability

Plans 01-03 wired the compound-write side-channel; Plan 04 makes it REACHABLE for family users:

1. **Plan 01:** `postReaction` calls `derivePositionForReaction({wp, mine, elapsedMs, isReplay: state.activeWatchpartyMode === 'revisit', localReplayPositionMs: state.replayLocalPositionMs})` and stamps `runtimePositionMs` + `runtimeSource` literal keys on the reaction object
2. **Plan 02:** `state.activeWatchpartyMode` is set to 'revisit' in `openWatchpartyLive` when `opts.mode === 'revisit'`; cleared on `closeWatchpartyLive`
3. **Plan 03:** `state.replayLocalPositionMs` is non-null while the modal is open in revisit mode (rAF clock + scrubber drop both write it)
4. **Plan 04 (this plan):** TWO user-facing entry surfaces now call `openWatchpartyLive(wpId, {mode:'revisit'})`:
   - Past parties row tap (Tonight tab → tap `Past parties (N) ›` inline link → tap any row in the modal that opens) — RPLY-26-08 part 1
   - Title-detail Past watchparties row tap (open detail modal for any title → tap any row in the new section if it renders) — RPLY-26-08 part 2

**Result:** A family member opening an archived wp via either entry surface enters the replay variant of the live modal with the local clock + scrubber + position-aligned reactions feed all functional. Posting a reaction in this state stamps `runtimeSource: 'replay'` + `runtimePositionMs: state.replayLocalPositionMs` on `wp.reactions[]`. Future replayers see this new reaction at the same position. Recursive family memory grows.

## Production Status

- **Live cache version on couchtonight.app:** `couch-v37-native-video-player` (UNCHANGED — Plan 26-05 owns the proper Phase 26 cache bump to `couch-v38-async-replay`). No deploy in this plan ritual per plan frontmatter.
- **Plan 04 source code is NOT yet deployed.** The Phase 26 replay surface code (Plans 01-03) was deployed to couchtonight.app as a transient side-effect of Plan 03's deploy.sh `--dry-run` mishandling that Plan 03 auto-fixed (see 26-03-SUMMARY.md Deviations §1). However, Plan 04's specific changes (Past parties query expansion, title-detail bifurcation, new CSS) are local-only. They will go live with Plan 26-05's deploy + cache bump ritual.
- **No accidental deploy:** Per plan frontmatter and STATE.md note, `bash scripts/deploy.sh` was NOT invoked during this plan's execution. The acceptance-criterion suggesting `bash scripts/deploy.sh --dry-run` is not supported by the script (Plan 03 auto-fixed Rule 1) — Plan 04 verified the gate path via `npm run smoke && npm run smoke:replay` which exits 0 cleanly.

## Next Plan Readiness

- **Plan 05 (final wave — deploy + sw.js CACHE bump + HUMAN-UAT scaffold + smoke floor lock)** can ASSUME:
  - All user-facing entry surfaces are functional. Past parties row tap → replay variant; title-detail Past watchparties row tap → replay variant. No console-only invocations needed.
  - All 22 of 24 RPLY-26-* IDs are codified at the smoke layer. Only RPLY-26-17 (smoke floor count assertion ≥80 — currently at 102, well above floor) and RPLY-26-18 (CACHE bump to `couch-v38-async-replay` at deploy) remain.
  - Visual UAT path is now possible end-to-end on a real wp:
    1. Host posts Phase 26 reactions during a live wp (Plans 01-03 functional)
    2. wp auto-archives (or host archives manually)
    3. Viewer opens wp via Past parties row tap on Tonight tab (Plan 04 entry point)
    4. Replay variant opens with scrubber + position-aligned reactions feed (Plans 02-03)
    5. Viewer drags scrubber → reactions fade in at runtime positions (Plan 03 selection rule + drift window)
    6. Viewer presses play → rAF clock advances → reactions cross drift threshold (Plan 03 local clock)
    7. Viewer posts a reaction in replay → it's stamped `runtimeSource: 'replay'` + `runtimePositionMs: state.replayLocalPositionMs` (Plan 01 compound-write)
    8. Future replayer (or original viewer) reopens → sees the new reaction land at the same moment (recursive family memory)
- **Plan 05's first task to add:** Update `sw.js` CACHE to `couch-v38-async-replay` (RPLY-26-18); add smoke floor count assertion `total >= 80` (RPLY-26-17, currently 102 so floor easily satisfied); deploy via `bash scripts/deploy.sh 38-async-replay` (single-repo couch-only); HUMAN-UAT scaffold per Phase 24 / 18 / 19 / 20 precedent.

## User Setup Required

None — no external service configuration; no deploy in this plan ritual (Plan 26-05 owns the deploy + sw.js CACHE bump). Source-tree sw.js still reads `couch-v37-native-video-player`; live couchtonight.app still serves the same cache value. Plan 26-05 will bump both in the same commit as part of the deploy ritual.

## Self-Check: PASSED

- ✓ FOUND: js/app.js (5 edit zones; node --check pass)
- ✓ FOUND: css/app.css (~57 lines appended; node fs read pass)
- ✓ FOUND: scripts/smoke-position-anchored-reactions.cjs (127 lines added; smoke exits 0 with 102 total)
- ✓ FOUND: 374ca87 (Task 4.1 commit)
- ✓ FOUND: 36e9600 (Task 4.2 commit)
- ✓ FOUND: adb2378 (Task 4.3 commit)
- ✓ Smoke: Total assertions: 102; Failures: 0
- ✓ Smoke: 102 ≥ 80 floor from plan success criteria
- ✓ npm run smoke exits 0 (all 9 contracts green)
- ✓ All must_haves.truths verified at code level
- ✓ All must_haves.artifacts present with required `contains:` substrings (`function friendlyPartyDate` in js/app.js; css ≥40 lines (57 added); `friendlyPartyDate` in smoke)
- ✓ All must_haves.key_links patterns grep-find on the live codebase (archivedWatchparties + replayableReactionCount + mode:'revisit' in renderPastParties; allReplayableArchivedCount Tonight gating; renderPastWatchpartiesForTitle invocation in renderDetailShell; activeWatchparties in renderWatchpartyHistoryForTitle)
- ✓ sw.js still reads `couch-v37-native-video-player` (no accidental cache bump — Plan 26-05 owns)

---
*Phase: 26-position-anchored-reactions-async-replay*
*Completed: 2026-05-01*
