# Phase 10: Year-in-Review - Context

**Gathered:** 2026-04-25
**Status:** Ready for planning (auto-defaults proposed; user reviews at /gsd-plan-phase 10 — defaults can be flipped before research kicks off)
**Mode:** `--auto` (Claude proposed defaults from ROADMAP scope + Phase 11 UAT findings + BRAND.md voice — no full discussion loop run)

<domain>
## Phase Boundary

Each member and the family as a whole can see a recap of their viewing year aggregated from Phase 3 mood data, Phase 4 veto history, Phase 7 watchparty activity, Phase 8 intent flows, and Trakt watch history — packaged in a shareable surface that lands on Phase 9's finalized brand. Source: ROADMAP.md Phase 10. Closes 5 success criteria + REQ-IDs YEAR-01 through YEAR-05.

This phase ships the *aggregation + presentation + sharing* layer. It does NOT add new tracking primitives — those exist already from prior phases. (Phase 14 ships the per-group progress tracking that would extend YIR's "most-watched-together" stat to subset-level granularity — out of scope for v1 YIR.)

</domain>

<decisions>
## Implementation Decisions

### Visual format

- **D-01:** **Story-card format (Spotify Wrapped-style)** — vertical-swipe deck of single-stat hero cards. Each card is one stat with brand-cinematic treatment (large serif numbers, italic accents, theatrical color blocks). Native to mobile-first reality, naturally shareable as individual cards.
- **D-02:** Long single-page scroll explicitly REJECTED — too easy to bounce, harder to share, doesn't suit Couch's brand-moment voice from BRAND.md.
- **D-03:** Card count target: 8–10 cards per recap. Caps complexity, fits attention.
- **D-04:** Card categories (in suggested order): Hero greeting / Total runtime / Top genres / Mood distribution / Top member-favorites / Family-favorites / Most-watched-together / Most-vetoed / Longest watchparty / Most-anticipated-but-never-watched / Closing card with share CTA.

### Time scope + trigger

- **D-05:** **Calendar year** (Jan 1 – Dec 31). Simplest mental model, matches "Year-in-Review" naming. The first run for any family covers a partial year with an honest caveat card ("Your couch joined us in {month}").
- **D-06:** **Trigger: always-available year-round + year-end push promo.** Once a family has data for the current year, the YIR section in Account tab unlocks. December 26 push notification surfaces a "Your year on the couch is ready" promo. No locking to year-end only.
- **D-07:** YIR section in Account tab (`#settings-yir-section`, currently hidden behind `state.family.yirReady === false` per Plan 11-02) flips to visible when a family has ≥10 watched titles in the current calendar year. Threshold prevents under-data feel.

### Generation strategy

- **D-08:** **Triggered-once on first view, cached to family doc** — when user first opens YIR for a given year, compute aggregations client-side from existing Firestore data + Trakt history, write the snapshot to `family.yirStats[{year}] = {...}`, reuse on subsequent visits. Subsequent visits read the cache; an explicit "Refresh stats" button forces recompute.
- **D-09:** Stats schema (in `family.yirStats[year]`):
  ```
  {
    generatedAt: timestamp,
    year: 2026,
    totalRuntime: minutes,
    titlesWatchedCount: int,
    topGenres: [{name, count}],
    moodDistribution: [{moodId, count, percentage}],
    perMember: { [memberId]: { titlesWatched, totalRuntime, topGenres, topMoods, favorites: [titleIds], topRated: [{titleId, rating}] } },
    familyFavorites: [{titleId, yesCount, avgRating}],
    mostWatchedTogether: [{titleId, watchedByMemberIds[]}],
    mostVetoed: [{titleId, vetoCount, vetoers[]}],
    longestWatchparty: { wpId, durationMs, titleId, participants[] },
    mostAnticipatedNotWatched: [{titleId, intentRsvpYesCount}],
    partialYearNote: 'Your couch joined us in {month}' | null
  }
  ```
- **D-10:** Cloud Function NOT required for v1. All aggregation runs client-side in `js/yir.js` module. Falls back gracefully if user has no Trakt connection.
- **D-11:** Recompute on demand only — no auto-refresh. New data in the year doesn't update cached snapshot until user taps "Refresh stats." Acceptable for a once-a-year surface.

### Trakt history depth

- **D-12:** Pull last 365 days from Trakt for any member who has Trakt connected. Existing Trakt sync (Phase 1-2 era + Phase 5 expansion) feeds member-level watch history — extend the existing fetcher to accept a date range filter.
- **D-13:** Members without Trakt: stats degrade to Couch-only data (Yes votes + watchparty participation + manual marks). Show small footer note "Connect Trakt for fuller stats" linking to Account → YOUR COUCH → Integrations.

### Sharing surface

- **D-14:** **Per-card native share with client-rendered image.** Each story card has a "Share" button → canvas renders the card to a 1080×1920 PNG → `navigator.share({ files: [pngBlob] })` on mobile, fallback to download-to-device on desktop. Image includes Couch wordmark + couchtonight.app footer.
- **D-15:** Privacy default: family-level family-shareable. Per-member personal cards (Top member-favorites, etc.) require an opt-in toggle "Make my personal stats shareable" — default OFF. Stays internal-only otherwise (visible to family members but not in shared-image output).
- **D-16:** No "share whole reel" v1 — share is per-card. Phase 12 could add a multi-card video reel if there's appetite.

### Visual + animation

- **D-17:** Each card uses the BRAND.md cinematic vocabulary — large serif (`--font-display`), italic accents (`--font-serif`), warm gradient backgrounds tied to per-card hero token (one of `--accent / --good / --velvet / --bad-soft / brand-grad`).
- **D-18:** Card transitions use motion tokens from Phase 9 plan 02: `--t-cinema` (400ms) entry/exit per card, `--ease-cinema` curve. Reduced-motion respects existing global `prefers-reduced-motion` rule.
- **D-19:** Hero card opens with brief story-card flicker animation (3-frame, 600ms) reusing the spin-result `spin-land` keyframe to thematically tie YIR to the existing decision ritual.

### Edge cases + footer copy

- **D-20:** Empty data: if family hits the YIR surface with <10 watched titles in the year, show a single "Couch is just getting started — come back at year-end" card. Surface stays available but trimmed.
- **D-21:** Voice copy follows BRAND.md — sentence case, italic for taglines. Sample: "You spent **84 hours** on the couch this year. Worth it." / "Cozy was your most-tagged mood — *no surprise*." / "*The most-vetoed title:* Fast X. The family has standards."
- **D-22:** Each card has an italic micro-footer crediting the data source where relevant ("From your Trakt history" / "From family Yes votes" / "From watchparty sessions") — transparency, no mystery numbers.

### Claude's Discretion

- Exact animation curves per card type — implementer picks within the motion vocabulary
- Specific gradient color choices per stat card — implementer picks from `--accent / --good / --velvet / --bad-soft` per stat sentiment
- Card order within the 8-10 spec — D-04 suggests an order; planner can reshuffle for narrative arc
- Trakt date-range fetcher implementation — extend existing module however cleanest

</decisions>

<specifics>
## Specific Ideas

- **Spotify Wrapped is the design north-star** for visual format (story cards, hero stats, shareable per-card). Couch's voice is more "lived-in cinema" than Spotify's "kinetic pop" — calmer, warmer, more theatrical-restraint per BRAND.md.
- **Yelp Year in Review** also worth borrowing from for the "you'd never know unless someone told you" stat moments (e.g. "Your most-vetoed mood was 'tearjerker' — Mom's been holding back the tears, apparently").
- **Letterboxd Year in Review** has a shareable per-list format with brand poster grids — relevant for the "top genres" or "favorites" cards.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Brand + design system
- `.planning/BRAND.md` — voice guide + token reference + screen patterns
- `css/app.css` :root block — Phase 9 token system (47-token semantic alias layer + motion vocabulary)
- `.planning/phases/09-redesign-brand-marketing-surface/09-02-SUMMARY.md` — token system rationale

### Requirements + roadmap
- `.planning/REQUIREMENTS.md` §Year-in-Review (Phase 10) — YEAR-01..YEAR-05 verbatim
- `.planning/ROADMAP.md` §Phase 10 — goal + dependencies + success criteria

### Upstream data sources
- Phase 3 mood tagging — moods stored on title docs as `moods: string[]`, per-member overlay via `memberMoods[memberId]`
- Phase 4 veto system — `families/{fc}/vetoHistory/{vetoId}` subcollection per Plan 04-01 SUMMARY
- Phase 7 watchparty — `families/{fc}/watchparties/{wpId}` with `participants{} reactions[] startAt endAt`
- Phase 8 intent flows — `families/{fc}/intents/{intentId}` with `rsvps{}` per Plan 08 SUMMARY
- Phase 11 watchpartyIntents (when shipped) — additional source for "most-anticipated"
- Trakt sync — existing `js/trakt.js` (or wherever the sync lives) — extend to accept date-range param

### Account tab integration point
- Plan 11-02 — `#settings-yir-section` wrapper around existing yir-eyebrow card, currently hidden via `state.family.yirReady === false`. Phase 10 flip the gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Modal-bg / .modal pattern** — Phase 9 standardized modal shell. YIR could use this for the story-card surface (full-screen modal with vertical-swipe between cards).
- **Spin-land keyframe** in css/app.css — reusable for hero-card flicker entry per D-19.
- **`flashToast`** in js/utils.js — for "Stats refreshed" confirmation.
- **`navigator.share`** integration shipped in Plan 11-04 (`confirmStartWatchparty` Web Share path) — same pattern for per-card share.
- **Canvas resize utility** shipped in Plan 11-05 (post-session photo upload) — adapted for card → PNG render.
- **Trakt fetch helpers** — existing module needs date-range param added.
- **`family.yirReady` flag** — already in Firestore schema (set false by default since Plan 11-02 hide).
- **Brand gradient** `--brand-grad` — primary CTA + closing-card hero treatment.

### Patterns to Honor
- BRAND.md voice (sentence-case, italic taglines, cinematic restraint)
- CACHE bump in sw.js on every user-visible change (continues v32+ progression)
- TMDB rate-limit discipline (40req/10s) — YIR aggregation should not flood TMDB
- Public-by-design secrets (TMDB key + Firebase config stay client-side; do NOT move to server)
- Deploy via mirror to `queuenight/public/` then `firebase deploy --only hosting`
- Per-Phase-9 Pitfall-2 — don't migrate JS-controlled `display:none` toggles to `.is-hidden` if `js/app.js` writes `.style.display` on those IDs

### Out-of-Scope Reminders (from PROJECT.md / CLAUDE.md)
- No bundler / no build step
- No native-rewrite work
- No monetization wiring
- No public discovery / cross-family social feed
- No moving secrets server-side

</code_context>

<deferred>
## Deferred Ideas

- **Multi-card video reel for whole-recap sharing** — Phase 12 if there's appetite (Spotify Wrapped does this)
- **Shareable web URL** (e.g. `couchtonight.app/recap/{familyCode}/{year}`) — Phase 12+. Privacy implications: would need explicit family-owner publish toggle.
- **Per-watching-group stats** ("you watched Invincible with wife + stepson") — depends on Phase 14 tracking layer
- **Recurring series stats** ("American Idol Mondays — 23 episodes")  — depends on Phase 15 calendar layer
- **Push notifications around a friend's recap landing** — depends on richer cross-family social model (not v1 scope)
- **Audio narration / soundtrack** — Spotify-Wrapped style musical accompaniment. Cute but heavy lift.
- **AI-generated personalized insights** — "you watched 30% more comedies than last year" requires year-over-year retention. v2.
- **Comparative stats vs other Couch families** — privacy + cross-family data plumbing not in v1.
- **Editable/customizable card order** — power-user feature; default order suffices for v1.

</deferred>

<plan_hints>
## Hints for /gsd-plan-phase 10

Suggested 3-plan split (planner finalizes):

- **Plan 10-01** — `js/yir.js` aggregation module + Firestore schema for `family.yirStats[year]` + Trakt date-range fetcher extension (engine layer). Tests: unit tests for each aggregator (totalRuntime, topGenres, moodDistribution, etc.) using fixture Firestore data.
- **Plan 10-02** — Story-card UI (HTML + CSS + JS render layer) — full-screen modal with vertical-swipe deck, 8-10 card types, brand vocabulary, motion + reduced-motion treatment. Wires `state.family.yirReady` flip when threshold (≥10 watched titles) hit.
- **Plan 10-03** — Per-card native-share with canvas → PNG render + opt-in privacy toggle for personal stats + Dec 26 push promo CF + sw.js CACHE bump.

The 3-plan split aligns with ROADMAP's "3 plans (TBD — finalized at plan-phase)" estimate.

**Wave structure:**
- W1: 10-01 (engine — no UI dep)
- W2: 10-02 (UI — depends on 10-01 schema)
- W3: 10-03 (sharing + push + cache bump — depends on 10-02 UI complete)

Sequential, no parallelization wins.

**Threat model surfaces** (for plan-checker):
- Per-member privacy: shareable image generation must respect D-15 opt-in flag — verify no leaked personal stats in family-shared cards
- Trakt API: date-range fetcher should respect Trakt rate limits (existing module pattern)
- Canvas-rendered images: ensure no XSS via member name interpolation (escapeHtml before rendering text)
- Firestore writes for `family.yirStats[year]`: write rules already cover `family.*` patterns; verify no schema escape

**No deferred discussion needed** unless you want to flip:
- D-01 visual format (story cards) → if you'd rather a single long page or carousel
- D-08 generation strategy (cache-on-first-view) → if you'd rather always-live-compute or CF-precompute
- D-15 privacy default (personal stats opt-in) → if you'd rather opt-out

If those three feel right, /gsd-plan-phase 10 can run with these defaults locked.

</plan_hints>

---

*Phase: 10-year-in-review*
*Context gathered: 2026-04-25 via auto-mode default proposal (no full discussion loop run); user can override any decision before /gsd-plan-phase 10*
