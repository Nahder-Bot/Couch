---
phase: 31-marketing-refresh
gathered: 2026-05-05; refined 2026-05-06 via /gsd-discuss-phase 31 --auto (single-pass)
status: ready_for_planning
mode: --auto recommended defaults locked into D-22..D-27; ready for /gsd-plan-phase 31
source_doc: .planning/LAUNCH-REVIEW-2026-05-05.md
---

# Phase 31: Marketing refresh — Context

**Gathered:** 2026-05-05 (during launch-readiness review session; precedes /gsd-discuss-phase 31)
**Status:** Scoped, awaiting formal /gsd-discuss-phase 31 chain
**Source-of-truth doc:** `.planning/LAUNCH-REVIEW-2026-05-05.md` (10 sections; covers positioning, file-specific fixes, App Store listing structure, sequencing)

<domain>
## Phase Boundary

Close the visibility gap between the shipped product (28 phases / live cache `couch-v47-pickem`) and the public marketing surface (frozen at Phase 9, April 2026). This phase ships *before* Phase 17 (App Store Launch Readiness) so Phase 17 has fresh assets to package for Apple + Google submissions.

**Already shipped as A-step preliminary work** (commit `e49ff34`, single-repo couch-only, no cache bump yet):
- Changelog catch-up across 11 release entries (v36 → v47-pickem)
- App-shell signin: value-promise subtag + privacy/terms link in footer
- Landing: secondary CTA repurposed to `#how` anchor; `.paths` section gains `id="how"`; audience grid trimmed from 5 cards to 3 (Family/Crew/Duo); `.hero-trust` line added below hero CTA
- Minimal CSS additions: `.signin-subtag` (app.css) + `.hero-trust` (landing.css)

**Phase 31 in-scope** (work that needs formal planning):
1. **"What makes Couch different" comparison section** on landing — explicit comparative blocks vs JustWatch/Reelgood, Letterboxd/Trakt, Teleparty/Scener/Plex. Voice: factual, not hostile.
2. **"What's actually in it" features section** on landing — 4 feature blocks for Wait Up, Couch Groups, Pickup-where-you-left-off, Pick'em + Leaderboards. Each = headline + 2-line elaboration.
3. **FAQ section** before footer — 5–7 scannable Q&As covering log-in, guest access, streaming services, cost, devices, data, vs-Teleparty differentiation.
4. **5–6 fresh screenshots** captured against `couch-v47-pickem` build:
   - `tonight-couch-viz.png` — Tonight tab with V5 couch viz hero + roster
   - `watchparty-wait-up.png` — Watchparty live with Wait Up slider visible
   - `couch-groups-roster.png` — Multi-family watchparty roster with `(FamilyName)` chips
   - `tonight-pickup.png` — Pick-up-where-you-left-off widget
   - `decision-explanation.png` — Match-card with "Why this is in your matches"
   - *(optional)* `pickem-leaderboard.png` — Pick'em surface with leaderboard
5. **og.png refresh** (1200×630) matching new positioning; replaces existing pre-Phase-9 placeholder
6. **landing.html screenshot block** updated to reference new images + alt text
7. **css/landing.css** styling for new comparison + features + FAQ blocks (likely reuses existing tokens; minimal new rules)

**Out of scope** (deferred):
- Phase 17 work (App Store listing copy, native wrapper, Apple Sign-In) — separate phase
- Privacy.html / terms.html content authoring — Phase 17's responsibility (they enumerate Firebase, TMDB, Trakt, Sentry, push providers)
- App Preview video (15-30s) — Phase 17 / Apple-only requirement
- Marketing analytics instrumentation (heatmap, A/B, conversion tracking) — post-launch concern
- Brand pivot to "Couch Tonight" App Store name — Phase 17 decision (Phase 31 keeps "Couch" wordmark)
- Capacitor vs PWABuilder spike — Phase 17 prep
- Solo mode positioning — deferred per cross-AI 2026-04-28
- New Phase 15.3 (DESIGN-01 SVG logo) — cosmetic, doesn't block launch

</domain>

<decisions>
## Implementation Decisions

### Section ordering on landing.html (top-to-bottom)
- **D-01:** New section sequence: hero → why-we-built-it → about → **NEW comparison** → paths → **NEW features** → audience → screenshots → **NEW faq** → install → footer. Keeps the emotional opener (why) before the comparative claim.
- **D-02:** "Comparison" section eyebrow: `Why not [other thing]?` framing. 3 blocks. Voice: factual, not hostile.
- **D-03:** "Features" section eyebrow: `What's actually in it`. 4 blocks (Wait Up + Couch Groups + Pickup + Pick'em). Each = `<h3>` headline + `<p>` 2-line elaboration. No icons (reduce noise).
- **D-04:** "FAQ" section: `<details><summary>` accordion pattern (zero-JS, native HTML). Each Q expands inline. Style minimal — single-line summary, ~3-line answer.

### Screenshot capture
- **D-05:** Capture device: iPhone 14 Pro (1170×2532), single device for visual coherence. Real PWA install on couchtonight.app at cache `couch-v47-pickem` (or whatever's live at capture time).
- **D-06:** Roster state: author's family with at least one kid avatar (so V5 couch viz reads as "real") + Kid Mode toggle visible.
- **D-07:** Lighting / appearance: dark mode (the only mode); ensure no notification banners or sensitive Trakt history visible. Scrub anything that leaks PII.
- **D-08:** Optimization: `sharp` per Phase 9 / Plan 09-06 precedent — quality 80, mozjpeg, output to `marketing/`. Same pipeline as previous run.
- **D-09:** Original screenshots in `marketing/` (tonight-hero.png through intent-rsvp.png) — KEEP as fallback / archive. Move to `marketing/archive-phase-9/` subfolder. New images at `marketing/` root with new filenames per source-of-truth doc.

### Comparison section voice
- **D-10:** Structure each block as `<h3>Why not <competitor cluster>?</h3>` + 2-line answer. Avoid naming version-specific products that may rebrand or shutter (e.g., name "Teleparty / Scener" not "Watch2Gether 2024").
- **D-11:** Tone calibration: factual differentiation, not hostile dunking. "They tell you where to stream. We help everyone agree on what." NOT "JustWatch is useless without Couch."
- **D-12:** Couple-tested copy lines (per LAUNCH-REVIEW §3 fix 2):
  - vs JustWatch / Reelgood: *"They tell you where to stream. We help everyone agree on what."*
  - vs Letterboxd / Trakt: *"They're solo cinephile journals. Couch is built for the people watching with you tonight."*
  - vs Teleparty / Scener / Plex: *"They sync your screen with friends. Couch handles deciding, watching, AND remembering — without making everyone install a Chrome extension."*

### Features section voice
- **D-13:** Each feature block: 1 headline + 2-line elaboration. NO marketing-ese. Concrete behavior, not feeling.
- **D-14:** Couple-tested copy lines (per LAUNCH-REVIEW §3 fix 3):
  - Wait Up: *"Reactions land at the same moment in the show, even if one of you started 90 minutes late. Or yesterday."*
  - Couch Groups: *"Multi-family watchparties without a group chat. Cousins three states away can join your Sunday-night Severance ritual."*
  - Pickup: *"We track every 'watching group' — Mom + the eldest watch Severance, both parents watch Lupin. The home screen tells you which couch left off where."*
  - Pick'em: *"Pick winners across NFL, NBA, MLB, NHL, soccer leagues, F1. Live scores. Reaction-amplified scoring plays. Friend leaderboard."*

### FAQ content
- **D-15:** 7 Q&As covering: log-in / Grandma / streaming services / cost / devices / data / vs-Teleparty. Per LAUNCH-REVIEW §3 fix 6.
- **D-16:** Voice rule: each answer ≤ 2 sentences. No marketing-ese. "Free." not "Available at no cost during our launch promotion."

### og.png refresh
- **D-17:** New og.png 1200×630, leather-textured background per BRAND.md, hero text *"Decide what to watch in 30 seconds. Watch together."* + Couch wordmark. Source SVG kept under `brand/og-source.svg` for future regeneration.
- **D-18:** Twitter card metadata in landing.html + changelog.html + rsvp.html updated to match new og.png URL (cache-bust may be needed via `?v=N` query string).

### Cache bump + deploy
- **D-19:** sw.js CACHE bump to `couch-v48-marketing-refresh` (continues integer + decimal sequence past v47-pickem). Auto-applied by `bash scripts/deploy.sh 48-marketing-refresh`.
- **D-20:** Single-repo couch-only deploy. NO queuenight changes. NO firestore.rules changes. (Mirrors Phase 19 / 21 / direct-ship pattern — no backend impact.)
- **D-21:** Smoke gate: existing 13 contracts must remain green. No NEW smoke contract for marketing copy (smoke is for behavior, not strings).

### Locked via --auto (recommended defaults selected 2026-05-06)
- **D-22:** FAQ at 7 questions per LAUNCH-REVIEW §3 fix 6 — log-in / Grandma / streaming services / cost / devices / data / vs-Teleparty. No legal-disclaimer questions (those belong on `/privacy` + `/terms`).
- **D-23:** og.png moves to a refreshed visual entirely (not text overlay refinement). New 1200×630 leather-textured background per BRAND.md, hero text *"Decide what to watch in 30 seconds. Watch together."* + Couch wordmark. Source SVG kept under `brand/og-source.svg` for future regeneration.
- **D-24:** Comparison section adds **a fourth block** for Apple SharePlay / FaceTime SharePlay / Microsoft Teams Together Mode — *"They're built into one ecosystem (Apple's, Microsoft's). Couch works across iPhone + Android + browser. No one's locked out because they're on the wrong device."* Cross-AI brief §5 Q12 flagged these as missing; closing the gap pre-emptively.
- **D-25:** Pick'em becomes the **5th screenshot** (`pickem-leaderboard.png`). Pick'em is a launch-defining differentiator per LAUNCH-REVIEW §1 visibility-gap table; surfacing it on landing matches the §5 4-beat hierarchy (Decide / Watch together / Remember / Make it a competition).
- **D-26:** "What's actually in it" headline does NOT repeat "free" — the `.hero-trust` line beneath the hero CTA already carries that trust signal. Repetition would dilute. Keep features section heading as plain *"What's actually in it"*.
- **D-27:** Sentry breadcrumb on FAQ open. Each `<details>` toggle fires a custom Sentry breadcrumb `marketing.faq.opened` with payload `{ question_index }`. Analytics signal for which questions matter most — informs Phase 17 App Store description ordering.

### Still Claude's Discretion (final-call at planning time)
- Whether the comparison section's 4th block (D-24) is added as a parallel `<h3>` or as a single denser line at the end of the existing 3-block list. Plan-phase decides based on visual rhythm.
- Exact CSS class names for the new comparison/features/FAQ sections (likely `.compare-*` / `.feature-block` / `.faq-*`).
- Whether to add `loading="lazy"` to the Pick'em screenshot (5th = below-fold default-load probability is high).
- Whether the og.png cache-bust uses `?v=2` query string or filename versioning (`og-2026-05.png`).

</decisions>

<specifics>
## Specific Ideas

- **Visual reference:** Stripe and Linear marketing pages — sparse, one big idea per scroll, restrained typography. NOT Notion / Slack (too crowded).
- **Copy voice:** matches BRAND.md "warm restraint." Comparative claims use factual-not-hostile register. The "what's actually in it" section is where the loud-about-behaviors / restrained-about-feelings rule from LAUNCH-REVIEW §2 lives — concrete behaviors, no hyperbole.
- **Signal:** Phase 31 is the last marketing-only phase before Phase 17 (App Store). Marketing doesn't change post-Phase-17 except for App Store screenshots (separate asset set per device size). Get this right once.
- **Risk hedge:** screenshot capture is the highest-friction sub-task. Schedule it for a window when the family roster is in a "good" state (no test data leaking through). If screenshots slip, ship the copy + comparison + FAQ first — those don't depend on captured images.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth doc (this phase's strategic justification)
- `.planning/LAUNCH-REVIEW-2026-05-05.md` — full review with corrections log, file-specific fixes, sequencing

### Existing landing surface
- `landing.html` — current marketing front door (~234 lines)
- `css/landing.css` — landing-specific styles (~88 lines after A-step)
- `marketing/` — current screenshot asset folder (5 PNGs from Phase 9 / Plan 09-06)
- `og.png` — current OG image (pre-Phase-9 placeholder per landing.html OG meta tag)

### Already-shipped A-step preliminary commits
- `e49ff34 docs(launch): A-step bounded marketing refresh + launch-readiness review` — changelog + signin polish + audience trim + free/private trust + #how anchor + LAUNCH-REVIEW doc

### BRAND.md
- `.planning/BRAND.md` — voice rules + DO/DON'T copy patterns. Phase 31 must respect every rule (especially §6 voice guide + §8 do/don't gallery).

### Phase 9 marketing precedent
- `.planning/phases/09-redesign-brand-marketing-surface/09-06-SUMMARY.md` — original screenshot capture pipeline (sharp + landing-css phone-frame styling)

### Cross-AI review (when /gsd-review fires)
- `.planning/CROSS-AI-BRIEF-2026-05-05.md` — structured second-opinion questions to pressure-test the marketing positioning + comparison-matrix accuracy

### Phase 17 dependency
- Phase 17 (App Store Launch Readiness) is the immediate downstream consumer of Phase 31's assets. Native wrapper screenshots may need different aspect ratios per device-size matrix; Phase 17 plans capture against the wrapper, not the PWA. Phase 31 captures the PWA reference set.

</canonical_refs>

## Success Criteria (what must be TRUE at /gsd-verify-work 31)

1. landing.html includes a **comparison section** with 3 named-competitor-cluster blocks (vs JustWatch/Reelgood, vs Letterboxd/Trakt, vs Teleparty/Scener/Plex) with voice-correct factual copy.
2. landing.html includes a **features section** with 4 feature blocks (Wait Up, Couch Groups, Pickup, Pick'em) using the LAUNCH-REVIEW §3 copy lines.
3. landing.html includes an **FAQ section** with 5–7 Q&As using `<details>` accordion pattern.
4. **5–6 new screenshots** captured against `couch-v47-pickem` build (or whatever's live at capture time) live in `marketing/` and are referenced from landing.html.
5. **og.png refreshed** (1200×630) matches new positioning; OG metadata in landing.html / changelog.html / rsvp.html points to it (with cache-bust query string if needed).
6. sw.js CACHE bumped to `couch-v48-marketing-refresh` (or successor); curl-verified live at couchtonight.app post-deploy.
7. Existing 13 smoke contracts stay green; no new smoke contract introduced (marketing-copy doesn't need smoke).
8. Phase 31 device-UAT scaffolded in `31-HUMAN-UAT.md` with 5–7 scripts covering: comparison section render on iPhone Safari standalone PWA / FAQ accordion behavior on iOS + Android / screenshot block render at 1x and 2x DPR / og.png hits when shared via iMessage + Twitter / etc.

## Suggested Plan Count

5 plans across 3-4 waves:
- 31-01: Landing copy block additions (comparison + features + FAQ) — pure HTML/CSS, no JS
- 31-02: Screenshot capture pipeline (run sharp, place in `marketing/`, archive Phase-9 set)
- 31-03: og.png refresh + cross-page metadata sync
- 31-04: sw.js cache bump + deploy + curl verification + 31-HUMAN-UAT.md scaffold
- 31-05: (optional) /gsd-verify-work 31 + REQUIREMENTS.md traceability backfill

Estimated runway: ~1 week dev-time + screenshot capture window dependency.

<code_context>
## Existing Code Insights

### Reusable Assets
- **`landing.html` section pattern** — every section uses `<section class="<name>"><h2>...</h2>...</section>` with consistent `border-top: 1px solid var(--border)` + `padding: 40px 0`. New comparison/features/FAQ sections follow the same skeleton.
- **`css/landing.css` token set** — `--bg`, `--surface`, `--ink`, `--ink-warm`, `--ink-dim`, `--accent`, `--accent-2`, `--velvet`, `--brand-grad`, `--ease-cinema`, `--r-md`, `--r-lg`, `--r-pill` are all defined at the top of `:root`. New rules reuse these — no new tokens needed (per D-21 acceptance criterion).
- **`.audience-card` + `.path-card` + `.install-card`** — three existing card patterns. Comparison section can lean on `.path-card` (background + border + padding-24 + rounded), features section can use a flatter variant (border-top dividers, no card chrome) for visual contrast.
- **`<details>/<summary>` for FAQ** — native HTML accordion, zero-JS. Style precedent in `app.html` `.signin-more` element (`css/app.css:2319`).
- **`marketing/` folder** — existing 5 PNGs from Phase 9 / Plan 09-06 capture pipeline (`tonight-hero.png`, `watchparty-live.png`, `mood-filter.png`, `title-detail.png`, `intent-rsvp.png`). Move to `marketing/archive-phase-9/` per D-09 before capturing new set.
- **`sharp` capture pipeline** — Phase 9 / Plan 09-06 produces optimized JPEGs from raw PNG; `mozjpeg` quality 80. Replicate verbatim for the new set.

### Established Patterns
- **Single source-of-truth deploy** — `bash scripts/deploy.sh <short-tag>` auto-bumps `sw.js` CACHE constant, mirrors source to `queuenight/public/`, runs `firebase deploy --only hosting`. Phase 31 deploy follows same pattern: `bash scripts/deploy.sh 48-marketing-refresh`.
- **No bundler / framework / build step** — landing.html is hand-edited HTML. No npm-side preprocessor for the new comparison + features + FAQ blocks.
- **Restraint-first design** — BRAND.md §1: "Brand moments get theatrical treatment; everything else recedes." New marketing copy is restrained-loud (concrete behaviors), not feeling-loud (hyperbole).
- **OG metadata trio** — `og:title` + `og:description` + `og:image` set on `landing.html` (lines 13–17), `changelog.html` (lines 13–24), `rsvp.html` (none currently — gap to fill in Phase 31). Each refresh updates all three pages in lockstep (D-18).
- **Sentry breadcrumb pattern** — `Sentry.addBreadcrumb({ category: '<area>', message: '<event>', data: { ... } })` per `landing.html:78-100` PII-strip block. D-27 uses this surface.

### Integration Points
- **Phase 17 dependency** — Phase 17 (App Store) consumes Phase 31's screenshots, og.png, and copy. Phase 31 must finish before Phase 17 packaging starts.
- **A-step preliminary commits already merged** — `e49ff34` shipped 11 of the planned changes (changelog catchup v36→v47, signin polish, audience trim, free/private trust, secondary CTA #how anchor, /privacy + /terms in signin footer). Phase 31 picks up at the comparison-section / features-section / FAQ / screenshots / og.png remainder.
- **`changelog.html` SEO surface** — A-step extended through v47-pickem. Phase 31 ensures landing references match (changelog cited in FAQ if relevant).

</code_context>

<deferred>
## Deferred Ideas

These came up during scoping or in the LAUNCH-REVIEW but belong to other phases. Captured here so they don't get lost.

### Phase 17 (App Store Launch Readiness)
- Privacy.html + terms.html content authoring — must enumerate Firebase, TMDB, Trakt, Sentry, push providers, all data types per Apple's Privacy Nutrition Labels + Google's Data Safety form. Phase 31 only links to these pages; Phase 17 writes them.
- App Preview video (15–30s) for App Store / Play listing — separate asset class, separate capture rig (screen recording with audio overlay).
- Brand pivot to "Couch Tonight" App Store name — ASO collision with furniture apps + Couchsurfing argues for the longer string; Phase 17 makes the call.
- Capacitor vs PWABuilder native-wrapper choice — separate `/gsd-spike` (running 2026-05-06 as Step 3 of the launch-prep sequence).
- Apple Sign-In wiring — App Review reject-on-sight per ASR §4.8 since Couch ships Google + Email-link + Phone today. Belongs in Phase 17, not Phase 31.

### Post-launch (signal-driven)
- Marketing analytics instrumentation — heatmap, A/B test framework, conversion-funnel tracking. Currently zero instrumentation beyond Sentry + the new D-27 FAQ-open breadcrumb. Post-launch when usage data justifies the operational cost.
- Solo mode on-ramp — deferred per cross-AI 2026-04-28; plural-brand dilution risk. Re-evaluate ~3 months post-launch with audience signal.
- Year-in-Review (Phase 10) — already deferred; Phase 31 doesn't surface it. Revisit at v1 milestone close + ~3 months usage data.
- "Couples" / "Friends" / "Clubs" / "Teams" audience-card re-additions — A-step trimmed to Family/Crew/Duo. If usage signal supports a broader audience, re-add cards in a future marketing-refresh phase. Don't scope creep here.

### Reviewed Todos (not folded)
None — todo.match-phase 31 returned 0 matches against the 2 pending todos. Future phases may surface relevant ones.

</deferred>

---

*Phase: 31-marketing-refresh*
*Context gathered: 2026-05-05; refined 2026-05-06 via /gsd-discuss-phase 31 --auto*

