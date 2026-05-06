---
phase: 31-marketing-refresh
gathered: 2026-05-05
status: scoped_awaiting_discuss
mode: scoping-only — full /gsd-discuss-phase 31 chain pending
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

### Claude's Discretion (open at planning time)
- Final FAQ copy: 7 questions vs 5; whether to include legal disclaimer questions
- Whether og.png moves to a refreshed visual entirely or keeps the existing wordmark + refines text overlay
- Whether the comparison section also includes Apple SharePlay / FaceTime SharePlay / Microsoft Teams Together Mode (cross-AI brief Q-5 flags these as missing competitors)
- Whether Pick'em deserves a 5th screenshot or stays as 4-of-5 (depends on launch-positioning Q from cross-AI brief)
- Whether the "What's actually in it" headline should call out "free" again or trust the hero-trust line to carry it
- Sentry breadcrumb on FAQ open (analytics signal for which questions matter most) — recommend yes

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

