---
phase: 11-feature-refresh-and-streamline
plan: 03b
subsystem: discovery
tags: [discovery, curated-lists, browse-all, personalization, pinning, localstorage, refr-04-second-half]

# Dependency graph
requires:
  - phase: 11-feature-refresh-and-streamline/03a
    provides: "Discovery engine (xmur3/mulberry32) + DISCOVERY_CATALOG 25 rows + pickDailyRows + renderAddDiscovery + loadDiscoveryRow wiring"
provides:
  - "Catalog extended 25 -> 33 rows: +5 curated C-rows (cult-classics / award-winners / festival-favorites / director-spotlight / docs-that-punch) + 3 personalization G-rows (want-list / because-you-watched / top-genres)"
  - "5 new loader source-types: tmdb-curated-list (hand-picked IDs), tmdb-director-rotating (inline xmur3 seed on row.id + today), group-want-list / group-similar-to-recent / group-top-genre-discover (derived from votes/Trakt/titles)"
  - "Browse-all bottom sheet modal — lists all 33 rows grouped by 7 buckets with pin toggle per row"
  - "Pin-up-to-3 with localStorage key couch-pinned-rows-{userId}, PIN_CAP=3 enforced on read + write (T-11-03b-02 tamper defense)"
  - "Pinned rows render ABOVE daily rotation in #pinned-rows container; toast + haptic feedback on pin/unpin/cap"
  - "sw.js CACHE bump: couch-v24-11-03a-discovery-engine -> couch-v25-11-03b-discovery-curated"
affects: [11-07-couch-nights-packs, phase-12-personalization-expansion]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hand-curated TMDB ID lists for cult/festival rows — not algorithmic; list maintained in constants.js"
    - "Director rotation: person ID array + inline xmur3(row.id, todayKey()) selector — same person all day, rotates daily"
    - "Genre name -> TMDB id inline map for g7-top-genres aggregation (state.titles[].genres stores names not ids)"
    - "Pin state as localStorage scoped to userId — family-safe (each member has own pins), tamper-resilient (cap enforced on read)"
    - "Pinned loader staggering: 200ms apart to respect TMDB rate-limit when 3 pins cold-load simultaneously"
    - "Graceful empty-state for personalization rows: Instrument Serif italic 'Nothing new here today — check back tomorrow.' when user has no votes/watch history"

key-files:
  created: []
  modified:
    - "js/constants.js (+8 catalog entries with tmdbIds arrays, directorIds array, sourceType values)"
    - "js/app.js (+5 loadDiscoveryRow source-type branches, Browse-all open/close, togglePinRow, renderPinnedRows, localStorage helpers, initAddTab re-sequencing)"
    - "app.html (#pinned-rows container, #add-browse-all-trigger pill, #browse-all-sheet-bg modal)"
    - "css/app.css (.add-browse-all-btn, .browse-all-sheet + children, .pin-toggle + :hover + .pinned, .pinned-section eyebrow)"
    - "sw.js (CACHE bump)"

key-decisions:
  - "5 new C-rows over the appendix's 7-target — stops at shippable content density; remaining 2 can land in Phase 12 if user demand surfaces."
  - "Hand-picked TMDB IDs (23 for cult, 22 for festival) rather than algorithmic — quality curation was the whole point of C-rows per CONTEXT.md D6."
  - "Director rotation uses inline xmur3 (not the engine's helper) to keep the selection scoped to today without polluting the global day rotation seed."
  - "G-rows gracefully empty on cold-start — no 'Loading...' deception. User sees 'Nothing new here today' and understands why."
  - "PIN_CAP=3 enforced at both read and write — even if a user tampers with localStorage manually, the render path truncates to 3 before use."
  - "Browse-all sheet max-width 540 (plan B) instead of full-bleed — keeps parity with existing modal widths (schedule modal 480, manual modal 560); full-bleed would clash."

patterns-established:
  - "Curated-list catalog rows: sourceType tmdb-curated-list + tmdbIds array in constants.js + case branch in loadDiscoveryRow"
  - "Personalization row derivation: sourceType group-* + inline aggregation from state (votes/intents/titles) + empty-state fallback"
  - "Pin-to-top with localStorage: user-scoped key + cap-at-read defense + render above daily rotation"

requirements-completed: [REFR-04]  # Closes REFR-04 jointly with 11-03a — second half (curated + browse-all + pinning) shipped here

# Metrics
duration: ~6min (executor agent)
completed: 2026-04-24
---

# Phase 11 Plan 03b Summary

**Discovery catalog expanded 25 -> 33 rows with 5 curated C-rows + 3 personalization G-rows; Browse-all sheet + pin-up-to-3 localStorage favorites; REFR-04 fully closed.**

## Performance

- **Duration:** ~6 min (executor agent run)
- **Completed:** 2026-04-24
- **Tasks:** 2 automated + 1 human-verify checkpoint (approved on automated-only)
- **Files modified:** 5 (constants.js, app.js, app.html, app.css, sw.js)

## Accomplishments

- **+5 curated C-rows** — `c2-cult-classics` (23 hand-picked TMDB IDs: Donnie Darko / Big Lebowski / Pulp Fiction / Matrix / Shining / Inception / Dark Knight etc.), `c4-award-winners` (TMDB keyword 209714 + vote_avg 7.5), `c5-festival-favorites` (22 Palme/Sundance/TIFF/Venice IDs: Parasite / Anatomy of a Fall / Nomadland / Green Book / Joker etc.), `c6-director-spotlight` (10 director person IDs: Wes Anderson / Bong Joon-ho / Greta Gerwig / Denis Villeneuve / Nolan / Scorsese / Tarantino / Kubrick / Spike Lee / Coens — rotates daily via xmur3), `c8-docs-that-punch` (genre 99 + 7.5+ rating + 200+ votes).
- **+3 personalization G-rows** — `g1-want-list`, `g3-because-you-watched`, `g7-top-genres`. All degrade gracefully to empty-state on cold-start (no votes/watch history).
- **Browse-all sheet** — `#browse-all-sheet-bg` modal triggered by `#add-browse-all-trigger` pill. Lists all 33 rows grouped by 7 buckets (Always-on / Trending / Discovery / Use-case / Theme of the day / Seasonal / Personalization).
- **Pin-up-to-3 favorites** — `PIN_CAP = 3`, localStorage key `couch-pinned-rows-{userId}`, cap enforced on read + write (T-11-03b-02 tamper defense). Pinned rows render in `#pinned-rows` container above the daily rotation. Toast + haptic on pin/unpin/cap.
- **5 new loadDiscoveryRow source-types** — `tmdb-curated-list`, `tmdb-director-rotating`, `group-want-list`, `group-similar-to-recent`, `group-top-genre-discover`.
- **sw.js CACHE bump** — `couch-v24-11-03a-discovery-engine` -> `couch-v25-11-03b-discovery-curated`.

## Task Commits

1. **Task 1: Extend DISCOVERY_CATALOG + loaders** — `91926ae` (feat)
2. **Task 2: Browse-all + pinning + sw.js bump** — `ba913ca` (feat)

## Files Created/Modified

- `js/constants.js` — +8 catalog entries with `tmdbIds` arrays (C2, C5), `directorIds` array (C6), `sourceType` values; DISCOVERY_CATALOG.length = 33 (A=2, B=4, C=9, D=3, E=7, F=5, G=3).
- `js/app.js` — +5 source-type branches in `loadDiscoveryRow`; new `openBrowseAllSheet` / `closeBrowseAllSheet` / `togglePinRow` / `renderPinnedRows` / `PIN_CAP = 3` / localStorage helpers; `initAddTab` re-sequenced to call `renderPinnedRows()` before `renderAddDiscovery()`.
- `app.html` — `#pinned-rows` container above `#add-discovery-rows`, `#add-browse-all-trigger` pill button, `#browse-all-sheet-bg` modal.
- `css/app.css` — `.add-browse-all-btn` (44px min-height, `--r-pill`), `.browse-all-sheet` (max-width 540px, max-height 85vh), `.browse-all-bucket-group/h`, `.browse-all-row-tile`, `.pin-toggle` (44x44 circle, fills `--accent` when `.pinned`), `.pinned-section` eyebrow in `--accent`.
- `sw.js` — CACHE bumped.

## Decisions Made

- **5 new C-rows over appendix's 7-target** — stops at shippable content density; remaining 2 can land in Phase 12 if user feedback asks for them.
- **Hand-picked TMDB IDs** (23 cult, 22 festival) rather than algorithmic — quality curation was the whole point of C-rows per CONTEXT.md D6.
- **Director rotation uses inline xmur3** (not the engine's helper) to keep the selection scoped to today without polluting the global day rotation seed.
- **G-rows gracefully empty on cold-start** — no "Loading..." deception. User sees "Nothing new here today" and understands why.
- **PIN_CAP=3 enforced at both read and write** — even if a user tampers with localStorage, the render path truncates to 3 before use (T-11-03b-02 tamper defense).
- **Browse-all sheet max-width 540** matches existing modal width scale (schedule 480, manual 560); full-bleed would clash.

## Deviations from Plan

None. Commit count 2 (vs plan's commit_strategy mention of 3) is explicitly allowed: `"sw.js CACHE bump bundled with commit 2 final"` per the plan's own strategy section. Two atomic commits per intended user-visible deploy unit.

## Issues Encountered

None. Automated matrix all green:

- 31 grep acceptance patterns — all match (see checkpoint gate summary)
- `node --check js/app.js` exits 0
- `node --check js/constants.js` exits 0
- `node --check sw.js` exits 0
- `node --test js/discovery-engine.test.js` — 10/10 pass (regression check — engine unchanged)
- DISCOVERY_CATALOG.length = 33 (A=2 B=4 C=9 D=3 E=7 F=5 G=3)
- CSS brace balance preserved

## User Setup Required

None — client-only work. No CF, no Firebase product enablement, no external API keys.

## Next Phase Readiness

**Wave 2 complete.** REFR-04 fully closed (11-03a engine + 11-03b curated/browse/pin). `sw.js` at v25. Main tree clean.

**Ready for Wave 3** — 11-04 web RSVP route + Web Share API + rsvpSubmit unauth onCall CF + rsvpReminderTick scheduled CF + hosting rewrite.

**Wave 3 external setup user will need:**
- Firebase Blaze plan confirmation (scheduled CFs require billing)
- Firebase Console — enable Storage product (for Plan 11-05's post-session photo upload)
- storage.rules variant decision (A pre-Phase-5 vs B post-Phase-5) — Plan 11-05 Task 0 inspector picks automatically

**Deferred verification:** Combined Wave 2 manual walkthrough (19 items: engine determinism console checks + Add tab UI + curated TMDB ID smoke + Browse-all modal + pin flow + personalization empty-state + PWA cache) recommended before Wave 3 lands on Cloud Function surface area.

---
*Phase: 11-feature-refresh-and-streamline*
*Plan: 03b*
*Completed: 2026-04-24*
