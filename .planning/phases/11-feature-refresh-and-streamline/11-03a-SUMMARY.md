---
phase: 11-feature-refresh-and-streamline
plan: 03a
subsystem: discovery
tags: [discovery, rotation, hash-seeded, tmdb, add-tab, auto-rows, day-of-week, seasonal, tdd, prng, refr-04-first-half]

# Dependency graph
requires:
  - phase: 11-feature-refresh-and-streamline/02
    provides: "Clean tab state after Wave 1 restructures (Add tab unchanged but now neighboring cleaner Tonight/Family)"
provides:
  - "js/discovery-engine.js — pure PRNG + catalog rotation module (xmur3 hash + mulberry32 generator + pickDailyRows selector)"
  - "DISCOVERY_CATALOG (25 rows) across 6 buckets: A always-on (2) / B trending (4) / C discovery (4) / D use-case (3) / E day-of-week (7 Mon-Sun) / F seasonal (5 windows)"
  - "Deterministic per-user-per-day hash seed: same (userId, dateKey) always yields identical 7-10 rows; different user or different date yields different rows"
  - "Day-of-week theme injection — E row for current weekday always appears"
  - "Seasonal window injection — year-spanning (Holiday Dec 1 → Jan 1) and same-month (Valentine Feb 1 → 14) windows both correct"
  - "Per-row TMDB cache (addTabCache._discovery) with staggered cold-load fetches (≤10 parallel) + 0 network hits on same-day refreshes"
  - "10 TDD unit tests covering PRNG determinism, row composition invariants, seasonal window edge cases (year-spanning + same-month)"
  - "CSS eyebrow + subtitle + seasonal-chip styles using existing tokens (no new primitives)"
  - "sw.js CACHE bump: couch-v23-11-02-tab-restructures → couch-v24-11-03a-discovery-engine"
affects: [11-03b-curated-browse-all, 11-07-couch-nights-packs]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "xmur3 → mulberry32 PRNG pair for deterministic per-user-per-day rotation (well-known fast non-crypto PRNG; seed reproducibility is the invariant)"
    - "Bucket-bounded pick algorithm: A always-on gets both, B/C/D/F sample from bucket with weights, E is today's weekday"
    - "Hash-seeded selection: seed = xmur3(userId + ':' + dateKey); reused across buckets with small offsets for uncorrelated picks"
    - "Per-row staggered TMDB fetch with existing 40req/10s rate-limit respect — reuses loadTrendingRow cache shape scaled to N rows"
    - "TDD-first module design: pure-function engine keeps it testable without DOM/Firestore mocks"

key-files:
  created:
    - "js/discovery-engine.js (~120 lines — xmur3, mulberry32, pickDailyRows, shouldShowSeasonal, weekdayKey helpers)"
    - "js/discovery-engine.test.js (~131 lines — 10 unit tests run via node --test)"
  modified:
    - "js/constants.js (DISCOVERY_CATALOG array appended — 25 row entries with id/bucket/title/subtitle/category/tmdbFn/seasonalWindow fields)"
    - "js/app.js (imports discovery-engine + new renderAddDiscovery + loadDiscoveryRow functions; initAddTab + renderAddTab wire dynamic container; addFromAddTab cache pool reads _discovery)"
    - "app.html (4 hardcoded row sections — trending/streaming/gems/+unused — consolidated into single #add-discovery-rows container below #add-mood-section)"
    - "css/app.css (3 rules at line 1231: .discover-row-eyebrow, .discover-row-subtitle, .discover-row-eyebrow.seasonal accent treatment)"
    - "sw.js (CACHE bumped)"

key-decisions:
  - "xmur3/mulberry32 PRNG pair chosen over crypto.getRandomValues — determinism is the core invariant; non-crypto is the correct semantic (we want reproducibility, not unpredictability)."
  - "25 rows in v1 (auto-only) — curated C-rows (cult/awards/festivals/director/docs) and personalization G-rows defer to Plan 11-03b per CONTEXT.md D6 accept-all + plan split."
  - "Legacy loadTrendingRow/loadStreamingRow/loadGemsRow preserved (3 refs) — if you manually need them for debug or fallback, they still work. Engine uses them as the TMDB fetch implementations for their respective rows."
  - "4 hardcoded sections consolidated into 1 dynamic container — reduces app.html surface area and lets the engine own row count/order/selection completely."
  - "10 unit tests committed pre-implementation (RED) then engine makes them pass (GREEN) — strict TDD per plan's type: tdd heuristic."
  - "empty-state copy: 'Nothing new here today — check back tomorrow.' (serif italic, matches BRAND.md voice)."

patterns-established:
  - "Deterministic rotation engine pattern: pure PRNG + seed composition from stable user+date key → reproducible daily experience without server state"
  - "TDD for content-rotation modules: test the selection invariants (determinism, bucket composition, edge cases) before writing the selector"
  - "Dynamic container pattern for Add tab: single wrapper, engine-controlled children, legacy loaders preserved for fallback"

requirements-completed: [REFR-04]  # REFR-04 first half — curated C-rows + browse-all + personalization + pinning ship in Plan 11-03b

# Metrics
duration: ~7min (executor agent)
completed: 2026-04-24
---

# Phase 11 Plan 03a Summary

**Discovery rotation engine shipped — xmur3/mulberry32 PRNG with 10 TDD unit tests + 25-row catalog across 6 buckets + deterministic per-user-per-day hash seed producing 7-10 rows with day-of-week + seasonal injection. Add tab now rotates daily without server state.**

## Performance

- **Duration:** ~7 min (executor agent run)
- **Completed:** 2026-04-24
- **Tasks:** 3 implementation + 1 human-verify (approved on automated-only per user direction)
- **Files created:** 2 (discovery-engine.js + discovery-engine.test.js)
- **Files modified:** 5 (constants.js, app.js, app.html, app.css, sw.js)

## Accomplishments

- **PRNG engine** — xmur3 hash + mulberry32 generator, both with provable determinism. 131-line test file + 10 unit tests, all pass via `node --test`.
- **25-row catalog** — DISCOVERY_CATALOG in constants.js: A×2 always-on ("On your streaming", "What your couch is into"), B×4 trending, C×4 discovery (hidden gems, critic picks, new releases, director focus), D×3 use-case (quick watches, long binges, family-safe), E×7 day-of-week (Mon-Sun themed), F×5 seasonal (Halloween Oct / Holiday Dec→Jan / Valentine Feb / Summer Jun-Aug / Awards Jan-Mar).
- **Deterministic rotation** — `pickDailyRows(userId, dateKey, catalog)` returns 7-10 rows; same inputs always yield identical output; different user OR different date yields different output; both A rows always present; current-weekday E row always present; in-window F row appears when applicable.
- **Add tab dynamic container** — 4 hardcoded section IDs collapsed to one `#add-discovery-rows` wrapper; `renderAddDiscovery` + `loadDiscoveryRow` populate with cached TMDB results; empty-row branch shows "Nothing new here today — check back tomorrow.".
- **TMDB rate-limit discipline** — per-row cache (`addTabCache._discovery`) means cold-load is ≤10 staggered fetches, same-day refreshes are 0 network hits.
- **sw.js CACHE bump** — `couch-v23-11-02-tab-restructures` → `couch-v24-11-03a-discovery-engine`.

## Task Commits

1. **Task 1a (RED): discovery-engine.test.js failing tests** — `836004a` (test)
2. **Task 1b (GREEN): discovery-engine.js + catalog + imports** — `314a421` (feat)
3. **Task 2 (WIRE): renderAddDiscovery + loadDiscoveryRow + Add-tab rewire** — `ef9cb97` (feat)
4. **Task 3 (CSS): eyebrow + subtitle + seasonal styles + sw.js bump** — `19cdb0c` (feat)

## Files Created/Modified

- **Created** `js/discovery-engine.js` (~120 lines) — xmur3, mulberry32, pickDailyRows, shouldShowSeasonal, weekdayKey
- **Created** `js/discovery-engine.test.js` (~131 lines) — 10 tests via `node --test`
- `js/constants.js` — DISCOVERY_CATALOG (25 rows × 6 buckets) appended
- `js/app.js` — imports from discovery-engine; renderAddDiscovery (3 refs) + loadDiscoveryRow (3 refs); initAddTab + renderAddTab wire dynamic container; addFromAddTab cache pool includes `_discovery` (5 refs)
- `app.html` — 4 hardcoded section wrappers collapsed into `#add-discovery-rows` placed below `#add-mood-section`
- `css/app.css` — 3 new rules at line 1231: `.discover-row-eyebrow`, `.discover-row-subtitle`, `.discover-row-eyebrow.seasonal` (uses existing `--t-eyebrow` + `--ink-dim` + `--accent` tokens, no raw px/color values)
- `sw.js` — CACHE bumped to `couch-v24-11-03a-discovery-engine`

## Decisions Made

- **Non-crypto PRNG** — xmur3/mulberry32 was picked deliberately because the semantic is "reproducibility," not "unpredictability." crypto.getRandomValues would be incorrect here.
- **TDD-first** — tests committed RED before engine existed; 10/10 pass after GREEN. Enforces pure-function design.
- **Catalog defers curated C-rows to 11-03b** — plan split per CONTEXT.md D6. 11-03a delivers only auto-populatable rows (TMDB-derived). 11-03b will add curator-dependent rows (cult classics, festival picks, etc.) + Browse-all sheet + pin-up-to-3 localStorage.
- **Legacy loaders preserved** — `loadTrendingRow`/`loadStreamingRow`/`loadGemsRow` stay in app.js (3 refs each) because they're the TMDB fetch implementations used by the engine AND they serve as manual-debug fallbacks.
- **Empty-state copy matches BRAND.md voice** — Instrument Serif italic, warm not apologetic.

## Deviations from Plan

None. All 4 tasks executed exactly as plan specified, TDD cycle honored (RED → GREEN → wire → CSS), atomic commits per strategy.

## Issues Encountered

None. Automated gate matrix all green:

- `node --test js/discovery-engine.test.js` — 10/10 pass
- `node --check js/app.js` — 0
- `node --check js/discovery-engine.js` — 0
- `node --check js/constants.js` — 0
- `node --check sw.js` — 0
- Catalog count: 25 (A=2, B=4, C=4, D=3, E=7, F=5 — plan exact)
- All grep acceptance passed (see checkpoint gate summary)
- CSS brace balance: 1290/1290 (was 1286, +4 new balanced rules)
- js/app.js brace balance: 3816/3816 (unchanged structure)

## User Setup Required

None — client-only engine + catalog + cache. No Firebase, no CF, no external API setup.

## Next Phase Readiness

**Plan 11-03b ready** — curated C-rows (cult/awards/festival/director/docs) + 3 personalization G-rows + Browse-all bottom sheet + pin-up-to-3 with localStorage. 11-03b depends on the engine this plan established and extends DISCOVERY_CATALOG rather than replacing it.

**Deferred verification:** 18-item manual walkthrough (engine determinism via console, day-of-week Friday check, seasonal window off-season check, Add tab UI rows, TMDB rate-limit staggering, PWA cache) bundles into end-of-Wave-2 verification gate alongside 11-03b.

---
*Phase: 11-feature-refresh-and-streamline*
*Plan: 03a*
*Completed: 2026-04-24*
