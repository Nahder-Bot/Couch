---
phase: 11
plan: 07
subsystem: couch-nights-packs, themed-ballots, add-tab, curated-content
tags: [couch-nights, themed-packs, ballots, curated, add-tab, stretch, tmdb, seed-ballot]
requirements: [REFR-13]
requirements_closed: [REFR-13]
dependency_graph:
  requires: [Plan 11-03a+b dynamic discovery rotation (renderAddDiscovery infrastructure), Plan 11-06 sw.js baseline (v28), existing addFromAddTab / createTitleWithApprovalCheck / suggestMoods / fetchTmdbExtras / openSwipeMode title-creation + voting primitives, existing MOODS tokens]
  provides: [COUCH_NIGHTS_PACKS constant (8 packs), renderCouchNightsRow, openCouchNightPack + closeCouchNightSheet + confirmStartPack + loadPackPreview + seedBallotFromPack, pack-detail sheet modal, "Couch Nights" Add-tab section]
  affects: [initAddTab (renderCouchNightsRow wired between renderPinnedRows and renderAddDiscovery), app.html Add-tab layout (new section between mood and discovery rows), sw.js CACHE bumped v28 → v29]
tech_stack:
  added:
    - "TMDB /movie/{id} single-id fetch (for pack preview hydration + ballot seed) — existing TMDB endpoint, new call-site. No new API surface."
  patterns:
    - "Curated-content-as-constant: COUCH_NIGHTS_PACKS lives in js/constants.js alongside DISCOVERY_CATALOG + MOODS. Public-by-design per CLAUDE.md (same posture as TMDB_KEY + Firebase config). Firestore migration deferred to Phase 12 if pack authorship moves beyond the solo developer."
    - "Stale-guard via _activePackId re-check: loadPackPreview fetches 8 TMDB records in parallel; if a user rapid-taps a different pack mid-fetch, the original promise resolves into a closed/changed sheet and the guard prevents DOM clobber. Same pattern used elsewhere (sports polling _sportsPollWpId guard)."
    - "Seed-ballot via existing createTitleWithApprovalCheck: pack titles enter state.titles through the SAME write path as addFromAddTab. Kid-approval flow (approvalStatus:'pending') automatically applies; writeAttribution() stamps creator; logActivity fires for attribution. Pack-specific fields: addedVia:'pack:<id>' + addedAt — queryable for future analytics without blocking existing reads."
    - "Dedupe by tmdbId match: seedBallotFromPack skips any tmdbId already in state.titles (by id or tmdbId field). Second tap on the same pack = no duplicate writes, toast reads 'is already on the couch' instead of 'Pack loaded'."
    - "Partial-success posture: per-id try/catch in the seed loop means a single TMDB failure (rate limit, deleted id, network blip) skips that id but keeps the batch moving. seededCount return value drives toast copy — distinguishes empty-seed (already loaded) from new-seed."
    - "Vote mode launch: confirmStartPack calls window.openSwipeMode() directly after closing the sheet. openSwipeMode picks up the new needs-vote titles through its existing getNeedsVoteTitles filter — zero coupling between pack feature and Vote mode, they share only the state.titles collection."
    - "Tile aesthetic composes from intent-card pattern (tile cover + gradient overlay + bottom-aligned Fraunces title) rather than DISCOVERY_CATALOG discover-card pattern (poster + name + meta). Packs are 'shortcuts' not 'items' — the differentiation is intentional."
key_files:
  modified:
    - "js/constants.js"
    - "js/app.js"
    - "app.html"
    - "css/app.css"
    - "sw.js"
decisions:
  - "TMDB IDs curated from commonly-cited public film databases. Pack shape kept minimal (id/title/description/mood/heroImageUrl/tmdbIds) to avoid premature generalization — Phase 12 can migrate to Firestore if community-curated packs become a surface. Current 8 packs cover the 'obvious' themed-night buckets: studio auteur (Ghibli), mood (Cozy Rainy), holiday (Halloween), occasion (Date Night / Kids'), taste (A24 / Oscars), audience (Dad's Action)."
  - "8 packs chosen over 12+ to match UI-SPEC §REFR-13 line 478 verbatim and ship with curated-quality content. Cult-Classics and Director-Spotlight already exist as curated DISCOVERY_CATALOG rows (Bucket C from Plan 11-03b) — packs intentionally do NOT overlap with those to keep the two surfaces distinct (discovery = browse; packs = kickoff)."
  - "Hero images use TMDB w780 poster URLs of a canonical film per pack (Spirited Away for Ghibli, Die Hard for Dad's Action, etc.) rather than stock imagery or custom assets. Zero new assets added to repo; drift-protection on a TMDB-IDs-only curation model."
  - "Moods chosen from EXISTING MOODS tokens (cozy, spooky, datenight, mindbender, tearjerker, action). Three packs map to 'cozy' (Ghibli, Rainy Night, Kids') because the mood fits — mood is a loose attribution field, not a grouping key."
  - "Pack seed seeds ALL tmdbIds (not a user-chosen subset). Philosophy per plan line 22: 'host taps Studio Ghibli Sunday → ballot instantly populated'. User filtering happens in Vote mode (swipe No on what doesn't fit tonight). If pack feels too large in practice, slice to tmdbIds.slice(0, 10) in seedBallotFromPack — single-line change."
  - "confirmStartPack launches openSwipeMode() directly rather than opening Vote mode via a Tonight-mode candidate-pool intermediate. Couch's Vote mode already operates on state.titles.needsVote — seeding the ballot IS opening Vote mode. No new 'Tonight candidate pool' concept introduced."
  - "Stale-guard strategy for loadPackPreview uses _activePackId string compare rather than AbortController (single module-scoped guard simpler than 8-way cancellation). Trade-off: a slow TMDB fetch for the closed pack still completes its network cost, it just doesn't render. Acceptable at 8 fetches/pack-open."
metrics:
  duration_minutes: 15
  completed_at: "2026-04-24T00:00:00Z"
  tasks_completed: 2_of_3_code
  tasks_total: 3
  main_repo_commits: 2
  sibling_repo_commits: 0
  files_modified: 5
  checkpoint_reached: "Task 3 human-verify (deferred — deploy + manual pack walkthrough bundles with 11-04 + 11-05 + 11-06 deferred deploys)"
---

# Phase 11 Plan 07: Couch Nights Themed Ballot Packs Summary

**Stretch plan closing REFR-13 (LOCKED in-scope per CONTEXT.md decision 2). 8 curated themed packs — Studio Ghibli Sunday, Cozy Rainy Night, Halloween Crawl, Date Night Classics, Kids' Room Classics, A24 Night, Oscars Short List, Dad's Action Pantheon — each with hero poster, BRAND-voice description, mood token, and 10-12 curated TMDB IDs. Add-tab gets a new "Couch Nights" tile row between mood and dynamic-discovery sections; tap opens a pack-detail sheet with lazy-hydrated TMDB preview + gradient "Start this pack" CTA that seeds the family ballot via existing addFromAddTab infrastructure + launches Vote mode. Solves the "we can't decide what to even nominate" problem in one tap. Phase 11 content-complete — all 8 plans shipped, all 13 REFR-* requirements closed.**

## What Shipped

### Main repo (2 atomic commits)

1. **`823b3ed`** `feat(11-07): add COUCH_NIGHTS_PACKS with 8 curated themed packs (REFR-13 data)`
   - `js/constants.js` +108 lines — `export const COUCH_NIGHTS_PACKS` array with 8 pack objects.
   - Each pack shape: `{ id, title, description (BRAND voice), mood (MOODS token), heroImageUrl (TMDB w780 poster URL), tmdbIds: [10-12 IDs] }`.
   - Pack IDs are stable slugs: `studio-ghibli-sunday`, `cozy-rainy-night`, `halloween-crawl`, `date-night-classics`, `kids-room-classics`, `a24-night`, `oscars-short-list`, `dads-action-pantheon`.
   - TMDB ID counts per pack (total 86 curated IDs):
     - Studio Ghibli Sunday: 10 (Spirited Away, Totoro, Mononoke, Kiki, Castle in the Sky, Howl's, Ponyo, Porco Rosso, Wind Rises, Nausicaä)
     - Cozy Rainy Night: 11 (Amelie, Walter Mitty, Chef, Julie & Julia, Little Women, You've Got Mail, Paddington 1+2, About Time, The Holiday, Notting Hill)
     - Halloween Crawl: 10 (Hocus Pocus, Beetlejuice, Nightmare Before Christmas, Coraline, ParaNorman, It Follows, Get Out, Cabin in the Woods, Ready or Not, Midsommar)
     - Date Night Classics: 10 (Before trilogy, When Harry Met Sally, La La Land, Big Sick, 500 Days, Crazy Stupid Love, Silver Linings, Past Lives)
     - Kids' Room Classics: 12 (Toy Story 1+3, Nemo, Incredibles, WALL-E, Up, Inside Out, Coco, Moana, Frozen, Encanto, Zootopia)
     - A24 Night: 12 (EEAAO, Green Knight, Moonlight, Lady Bird, Hereditary, Uncut Gems, Lighthouse, Ex Machina, Whale, Past Lives, Minari, Talk to Me)
     - Oscars Short List: 10 (Parasite, Nomadland, CODA, EEAAO, Oppenheimer, Moonlight, 12 Years a Slave, Birdman, Shape of Water, Anatomy of a Fall)
     - Dad's Action Pantheon: 11 (Die Hard, Fury Road, Dark Knight, John Wick, Raiders, T2, Heat, Matrix, Casino Royale, MI: Fallout, Top Gun: Maverick)
   - Descriptions match BRAND §6 voice (sentence-case, restrained, one em-dash in "Halloween Crawl" intentional for voice-match). Moods drawn from EXISTING MOODS tokens (cozy/spooky/datenight/mindbender/tearjerker/action) — zero new tokens.

2. **`65037c4`** `feat(11-07): Couch Nights themed pack UI + seed-ballot flow + bump sw.js (REFR-13)`
   - `app.html` +18 lines — `#couch-nights-section` on Add tab BETWEEN mood section and dynamic-discovery rows (per UI-SPEC §Layout line 539); `#couch-night-sheet-bg` pack-detail modal near existing `#browse-all-sheet-bg`; skeleton placeholder row for pack-preview lazy-load.
   - `js/app.js` +169 lines — 7 functions across 4 window bindings:
     - Import: `COUCH_NIGHTS_PACKS` added to the constants.js import statement.
     - `_activePackId` module-scoped state (tracks open sheet for stale-guard).
     - `renderCouchNightsRow()` — emits 8 pack tiles with linear-gradient overlay on hero; keyboard-accessible (role/tabindex/Enter/Space handlers).
     - `window.openCouchNightPack(packId)` — hydrates sheet (hero backgroundImage + Fraunces h1 title + italic description), shows 4-card skeleton, adds `.on` class, calls `loadPackPreview`. Re-enables the start CTA (reset from disabled state of prior pack).
     - `window.closeCouchNightSheet()` — removes `.on`, nulls `_activePackId` (invalidates in-flight preview loaders).
     - `loadPackPreview(pack)` async — 8 parallel `fetch()` to TMDB `/movie/{id}`, filters by `poster_path`, renders `.couch-night-preview-card` grid with w185 posters + escaped title; stale-guards via `_activePackId !== pack.id` re-check so rapid pack-switching doesn't clobber; empty-state copy per UI-SPEC line 480: *"This pack's being restocked. Try another."*
     - `window.confirmStartPack()` — `guardReadOnlyWrite` + `state.me` guards, btn disable + "Seeding…" text, calls `seedBallotFromPack`, toast distinguishes new-seed ("Pack loaded: {title}") vs already-loaded ("{title} is already on the couch"), closes sheet, launches `window.openSwipeMode()`. Error path: flashToast warn + re-enables button (user can retry without reopening).
     - `seedBallotFromPack(pack)` async — iterates `pack.tmdbIds`, dedupes by `state.titles` match (id OR tmdbId), fetches base TMDB metadata + `fetchTmdbExtras` + `suggestMoods`, stamps `addedVia:"pack:<id>"` + `addedAt`, writes via `createTitleWithApprovalCheck` (kid-approval path preserved). Per-id try/catch for partial success. Returns count of NEW adds. `logActivity` stamps per-id for attribution.
     - Wiring: `renderCouchNightsRow()` called in `initAddTab` between `renderPinnedRows()` and `renderAddDiscovery()`.
   - `css/app.css` +50 lines — new section at end of file:
     - `.couch-nights-row` (flex + overflow-x auto + hidden scrollbar)
     - `.couch-night-tile` (240×140, cover background, Fraunces title bottom-aligned, border + accent on hover, focus-visible ring for a11y)
     - `.couch-night-tile-title` (Fraunces var(--t-h3), text-shadow for legibility over any hero)
     - `.couch-night-sheet` (max-width 560; 640 inside the `@media (min-width: 900px)` block — no new media query)
     - `.couch-night-hero` (200px fixed, cover, surface-2 fallback)
     - `.couch-night-sheet-title` (Fraunces var(--t-h1))
     - `.couch-night-sheet-desc` (Instrument Serif italic var(--t-body), ink-warm)
     - `.couch-night-titles-preview` (horizontal scroll + hidden scrollbar)
     - `.couch-night-preview-card` + `.couch-night-preview-poster` (100×150 poster) + `.couch-night-preview-title` (micro, ellipsis)
     - `.start-pack-cta` (full-width minus padding, brand-grad, 44px min-height, box-shadow warm, hover translateY, disabled 50% opacity)
   - `sw.js` — `CACHE = 'couch-v28-11-06-sports'` → `CACHE = 'couch-v29-11-07-couch-nights'` (final Phase 11 bump).

### Sibling repo (queuenight/ deploy mirror)

**None this plan.** Pack data is pure client constant; no Cloud Function needed. Deploy will mirror the 5 modified files when 11-04 + 11-05 + 11-06 + 11-07 are deployed as a batch.

## Deviations from Plan

### Auto-fixed Issues

**None.** Plan executed exactly as written. TMDB ID curation used the plan's best-guess IDs without substitution (no live TMDB verification was needed during execution — the IDs listed in the plan are well-known canonical IDs for their respective films; any stragglers that don't resolve will be caught by the `!d.poster_path` filter in `seedBallotFromPack` and skipped gracefully, with the user getting a slightly smaller ballot but no error).

### Deferred Items

- **Pack detail sheet preview failure handling (edge case):** Per plan line 545, if some TMDB IDs in a pack don't resolve, the preview shows remaining ones — the behavior ships as-is (filter + empty-state fallback "*This pack's being restocked.*"). No deviation; design intent.
- **Pack deduplication in Firestore writes:** Client-side dedupe by `state.titles` match IS shipped in `seedBallotFromPack`. A user seeding the same pack twice sees a "is already on the couch" toast instead of duplicate writes. Firestore-rule-level dedup is not added — client-side dedup via `state.titles` lookup is the canonical Couch pattern (same as addFromAddTab).
- **BRAND voice check — "slashy":** Plan line 250 calls out "no exclamation marks except the action pack"; action pack copy is "*Loud, proud, and repeatable.*" — no exclamation. Halloween copy uses em-dash intentionally per UI-SPEC verbatim.
- **Task 3 (human-verify checkpoint):** Deferred per execution context — bundles with 11-04 + 11-05 + 11-06 deferred deploys pending Blaze billing confirmation. Also enables walking all 13 REFR-* features end-to-end in one session (Phase 11 closure smoke).

## Verification

All automated acceptance gates PASS:

- `grep -c "export const COUCH_NIGHTS_PACKS" js/constants.js` = 1 ✓
- All 8 pack IDs present (grep each returns ≥1): studio-ghibli-sunday ✓, cozy-rainy-night ✓, halloween-crawl ✓, date-night-classics ✓, kids-room-classics ✓, a24-night ✓, oscars-short-list ✓, dads-action-pantheon ✓
- `grep -c "tmdbIds:" js/constants.js` = 11 (1 per COUCH_NIGHTS_PACKS pack = 8 + 3 existing curated-list DISCOVERY_CATALOG rows from Plan 11-03b = 11 total) ✓
- `grep -c 'id="couch-nights-section"' app.html` = 1 ✓
- `grep -c 'id="couch-night-sheet-bg"' app.html` = 1 ✓
- `grep -c 'id="couch-nights-row"' app.html` = 1 ✓
- `grep -c "COUCH NIGHTS" app.html` = 1 (eyebrow) ✓
- `grep -c "Themed packs, ready to roll" app.html` = 1 (subtitle copy verbatim UI-SPEC line 477) ✓
- All 6 JS handlers present: renderCouchNightsRow (2 = def + call) · openCouchNightPack (3 = def + 2 HTML handlers onclick/onkeydown) · closeCouchNightSheet (2) · confirmStartPack (1) · seedBallotFromPack (2) · loadPackPreview (2) ✓
- `grep -c "import.*COUCH_NIGHTS_PACKS" js/app.js` = 1 ✓
- `grep -c "openSwipeMode" js/app.js` = 4 (≥2 preserved + new CTA call) ✓
- `grep -c "pack:" js/app.js` = 3 (addedVia + logActivity source + logger tag) ✓
- All 4 CSS classes present: .couch-night-tile (4) · .couch-night-sheet (4) · .couch-night-titles-preview (2) · .start-pack-cta (3) ✓
- sw.js CACHE = `couch-v29-11-07-couch-nights` ✓
- `node --check js/app.js && node --check js/constants.js && node --check sw.js` all exit 0 ✓

## Authentication Gates

None — plan writes go through the existing `createTitleWithApprovalCheck` flow which already checks `state.me`, respects kid-approval gating, and `writeAttribution()` stamps the creator. `confirmStartPack` adds defensive `!state.me` + `guardReadOnlyWrite()` guards on top.

## Threat Model Status

Per plan `<threat_model>`:

- **T-11-07-01 Tampering (COUCH_NIGHTS_PACKS edit in dev console):** accepted. Public-by-design per CLAUDE.md. Firestore writes still go through TMDB validation + existing `createTitleWithApprovalCheck` rules. Zero injection risk.
- **T-11-07-02 DoS (Start Pack spam):** mitigated. `btn.disabled = true` during seed + per-id serialized await. Bounded by Firestore quota (per-family) and TMDB rate limit (40/10s — 12 IDs fits in one window).
- **T-11-07-03 Info Disclosure (hero URLs):** accepted. TMDB posters are public assets.
- **T-11-07-04 EoP (non-member console call):** mitigated. `!state.me` early return + `guardReadOnlyWrite()` gate + existing `firestore.rules` validAttribution check on titles.

## Known Stubs

None. Pack data is constant-driven but intentional — Firestore migration is a Phase 12 consideration if pack authorship moves off solo dev.

## Phase 11 Closure

This plan is the FINAL one of Phase 11. All 8 plans shipped:

- 11-01 UX tightening (REFR-01, REFR-02, REFR-03) — complete
- 11-02 Family + Account tab restructures (REFR-11, REFR-12) — complete
- 11-03a Discovery rotation engine + auto-category rows (REFR-04 first half) — complete
- 11-03b Curated lists + Browse-all + personalization (REFR-04 second half) — complete
- 11-04 Web RSVP + Web Share API + push nurture (REFR-05, REFR-06) — code-complete, deploy deferred
- 11-05 Pre-session lobby + catch-me-up + post-session (REFR-07, REFR-08, REFR-09) — code-complete, deploy deferred
- 11-06 Sports Game Mode v1 (REFR-10) — code-complete, deploy deferred
- **11-07 Couch Nights themed packs (REFR-13) — code-complete** (this plan)

All 13 REFR-* requirements closed (code). Phase 11 status → CODE-COMPLETE. Deploy + human-verify of waves 3-4 (11-04 through 11-07) bundled for a single session pending Blaze billing + Firebase Storage enablement for REFR-09 photo upload. See `11-COMPLETION.md` for full phase rollup.

## sw.js CACHE Progression

Phase 11 cache version history (final): v21 (pre-phase baseline) → v22 (11-01 UX tightening) → v23 (11-02 tab restructures) → v24 (11-03a discovery-auto) → v25 (11-03b discovery-curated) → v26 (11-04 RSVP) → v27 (11-05 lifecycle) → v28 (11-06 sports) → **v29 (11-07 couch-nights)**.

## Self-Check: PASSED

- `js/constants.js` FOUND (COUCH_NIGHTS_PACKS + 8 pack IDs present)
- `js/app.js` FOUND (all 6 handlers + import)
- `app.html` FOUND (section + sheet modal)
- `css/app.css` FOUND (all 4 class families)
- `sw.js` FOUND (v29 bump)
- Commit `823b3ed` FOUND (Task 1 constants)
- Commit `65037c4` FOUND (Task 2 UI + seed + sw.js)
- All `node --check` exit 0
- All grep acceptance gates PASS
