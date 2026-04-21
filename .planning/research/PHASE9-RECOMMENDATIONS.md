# Phase 9 Recommendations — distilled from the research dive

**For:** `/gsd-discuss-phase 9` when it runs
**Scope:** Phase 9 = Redesign / Brand / Marketing Surface per ROADMAP.md

This file narrows the `SUMMARY.md` broad findings into **concrete Phase 9 inputs**. Use when writing 09-CONTEXT.md.

---

## 1. Name + trademark — DECIDED 2026-04-22

**Decision:** **"Couch Tonight" is the full brand. "Couch" is the FedEx-style organic shorthand.**

This isn't a split-personality brand (which I initially proposed and the user correctly pushed back on — users see `couchtonight.app` in every shared URL). It's a proper two-word identity with a one-word affectionate shorthand that evolves in the wild like FedEx/Coke/Insta.

**Concrete identity:**
- **Legal wordmark:** COUCH TONIGHT (file Classes 9 + 41, add 42 if server-side expands)
- **App Store title:** Couch Tonight
- **Primary domain:** couchtonight.app (unchanged — already live and owned)
- **Defensive domains to grab:** couchtonight.com, couchtonight.tv, couchtonight.co, thecouch.app, getcouch.app, oncouch.app
- **Social handles:** @couchtonight as primary (sweep namechk across 9+ platforms)
- **Logotype:** "Couch Tonight" as primary; "Couch" acceptable as stylized shorthand in constrained spaces (icon, narrow headers)
- **In-app header / product copy:** "Couch" is fine — matches how users will speak about it
- **Marketing headlines:** lead with "Couch Tonight"; casual body copy can drop to "Couch"

**Blocking before Phase 9 branding commits:**
- ~~Paid TESS / Corsearch clearance on COUCH TONIGHT~~ — **DEFERRED 2026-04-22 by user decision.** Trade-off accepted: ~25-30% probability of either USPTO descriptiveness refusal OR incumbent C&D forcing a rename 12-18 months in, with ~$1-2k expected soft cost if it materializes. User rationale: `couchtonight.app` domain was freely available (though noted: domain availability ≠ TM clearance); willingness to absorb rename risk; cost savings of ~$500-1500 preferred; C&D damages escalation probability is <1% so no catastrophic downside.
- Confirm defensive domains + social handles available / acquirable (still recommended — low cost).

**Deferred decision — revisit if/when:**
- Scaling to meaningful paid marketing push (post-friends-and-family stage)
- Press push that would generate public exposure
- Any C&D or refusal letter arrives — at that point, engage IP counsel reactively
- Before spending on physical marketing assets (billboards / print / app-store paid search campaigns)

**Middle-path option still available:** DIY USPTO TEAS filing for COUCH TONIGHT at $350 (no attorney) as low-cost defensive registration. Provides priority date + constructive notice even without paid clearance. If the application is rejected for descriptiveness, $350 is the only loss. User may revisit this when convenient.

**Rationale documented:** the "one-word brand is better" design principle is true in the abstract (Nike/Slack/Uber) but relies on the one-word being **arbitrary AND rare**. "Couch" fails both — it's descriptive of the use case AND common in the category (Couch-to-5K, Couch TV, Couch Movies, CouchTimes all already live). "Couch Tonight" sidesteps both problems while preserving "Couch" as the affectionate shorthand that will evolve organically.

---

## 2. Palette + typography guardrails — fold into design tokens

### Palette expansion

- Keep `#14110f` (warm dark, Reeder-sepia precedent)
- **Add:** bone/cream for light moments (`~#F1E8DA` as starting point)
- **Add:** amber/marquee-gold + low-saturation oxblood for ritual moments
- **Retire:** velvet red `#c54f63` from any text below 18px (fails AA body contrast at 4.3:1). Either brighten to `~#d66478`+ or restrict to ≥20px headings + filled buttons with white text.
- **Avoid:** pure orange (Letterboxd owns it), pure yellow (Mubi owns it)

### Typography guardrails (CSS custom properties to enforce)

```css
--font-display: 'Instrument Serif', 'Fraunces', serif;  /* ≥20px ONLY, italic ≥24px */
--font-ui:      'Inter', system-ui, sans-serif;         /* default below 20px */
--font-mono:    ui-monospace, monospace;                /* metadata (A24 move) — optional addition */
```

Never italic serif below 18px. Italics compound dyslexia-legibility hits.

### Motion policy

- Eased linear cross-fades 300-400ms
- Letterbox-bar reveals for "pick ceremony" moments
- Subtle Ken Burns on poster hero treatments
- **No spring physics** — reads SaaS, not cinema

---

## 3. Archetype refactor — DO IT IN PHASE 9 (structural)

Collapse `family / crew / duo` from user-facing modes into an internal composition tag. User-facing = **one "Couch" concept** with members + profiles + roles.

**Cost:** ~2 plans (schema migration + onboarding rewrite). Touches `PROJECT.md` "Constraints" section.

**Reward:** unblocks solo on-ramp (§4 below). Validates Phase 9 "design system" claim — if the tokens change but the archetype still requires mode-picking at signup, we haven't redesigned the product.

**Migration shape:**
- `family.mode` field retained as internal `family.composition` (derived from member count + roles)
- UI never prompts "which mode?" — shows one path, adapts copy based on composition
- Existing groups grandfathered (composition inferred from current `mode`)

---

## 4. Solo mode on-ramp — scope a dedicated plan (or Phase 9.5)

Solo isn't a Phase 9 polish item; it's a strategic bet. Add to Phase 9 as one plan OR split to Phase 9.5.

**Solo-mode plan tasks:**
- Remove the "must have a family" gate at signup
- Mood-driven recommendations replace voting as primary path for single-user state
- Trakt history import as the "1-tap cold-start rescue" (Couch already has Trakt auth from Phase 5)
- Solo → group upgrade flow with **retroactive-privacy dialog** (P0 invariant — never skip)
  - Dialog options: Share everything / Ratings only / Keep private
  - **Default: Ratings only**

If Phase 9 scope bloats, split this to 9.5 — do not cut the privacy-dialog tasks.

---

## 5. Landing page + marketing surface (DESIGN-03/04/05)

### Positioning one-liner (from thread 06)

Primary: **"End the 'what should we watch?' debate."**
Deck version: **"The decision layer for family movie night."**

### Landing copy hooks (data-backed)

- **Nielsen 2023:** "~10.5 minutes per session picking; 1 in 5 viewers give up entirely." Clean, sourced, visceral.
- **Co-viewing trend:** "86% of families plan to watch more together" (tailwind not fad).
- **Anti-platform-lock framing:** "Works with every streamer you pay for." (Couch's TMDB + provider data is an asset; lean into it.)

### Landing page template

- Long-scroll narrative (Arc pattern)
- Photographic restraint (Mubi pattern) — **real warm-living-room still, NOT a laptop/phone mockup**
- A/B-ready SMS invite CTA at bottom

### App-store screenshots

Reference Criterion Channel + Mubi app screenshots for the "cinema brand in mobile UI" treatment. Hero frame = the pick-moment (post-spin Tonight modal), not feature list.

---

## 6. A11y items to fold into Phase 9 (DESIGN-04)

All five from thread 12 — bake into the redesign rather than retrofitting:

1. **Retire `#c54f63` from <18px text** (see §2 palette)
2. **Serif/italic size enforcement via CSS custom properties** (see §2 typography)
3. **Tap targets ≥44×44** (Apple HIG — 2.5.8 floor is 24×24 but HIG is the product bar)
4. **Reaction markup with `role="img" aria-label="{contextual name}"` + `aria-pressed`** for toggle state
5. **Redundant encoding for all color-signaled states** (watched/unread/hosting). Test via Chrome DevTools > Rendering > Emulate vision deficiencies.

Target: **WCAG 2.2 Level AA** everywhere. Stretch AAA on core reading surfaces (movie titles, chat body). AAA on warm-dark serif-forward brand is not feasible without flattening the aesthetic — don't fight this battle.

---

## 7. Onboarding redesign (DESIGN-07)

### Primary user target

The **most-digital-native parent** (manages family calendar/streaming logins). 60-second setup → SMS link to rest of family.

### Key onboarding moves

- **Empty state's primary CTA = "Invite your family,"** not "Browse movies." Solves chicken-and-egg.
- **Deep-link invites** (`couchtonight.app/join/AB12`) as primary; typed-code only as fallback
- **SMS-first** in the invite picker (60% higher participation, 2× install rate vs text-only)
- **Mood-driven solo preview** for users who land without a group yet (tie to §4)
- Progress indicator visible throughout (not a modal stack)

### Tastefully introduced feature surfaces (per ROADMAP.md DESIGN-07)

Introduce one feature per "session" (not all at once): moods first, veto second, watchparty third on appropriate triggers. Push opt-in comes after first co-watch, not before (per Phase 6 UAT learning: users opt-in when they have someone to be notified BY).

---

## 8. Year-in-Review design pass — set it up in Phase 9

Phase 10 (YIR) depends on Phase 9 brand tokens. Reserve design treatment for:

- **Shareable cards** (Letterboxd Year-in-Movies pattern). OG image sized for Instagram Stories + TikTok aspect ratios.
- **Family-level vs per-member split** (already in YEAR-02 requirement)
- **Warm/cinematic** — don't default to Spotify-Wrapped stylings. Use Mubi/Criterion typography for headlines; Inter for data.

---

## 9. Out-of-scope for Phase 9 (explicit deferral list)

Pulled from research but belongs in later phases or seeds:

- **Teen mode** (thread 09) — separate phase AFTER Phase 9 lands; requires COPPA 2.0 compliance scope
- **Star ratings + short reviews** (thread 07 #1) — new primitive, separate plan or early Phase 10
- **User-curated lists** (thread 07 #2) — separate plan
- **Monetization implementation** (thread 10) — Phase 10+ after family-mode is stable
- **Availability notifications** (thread 02) — requires provider data integration
- **Multi-language UI** — post-v1
- **Native iOS/Android wrap** — post-v1 (PWA → FlutterFlow per PROJECT.md)
- **Always-on friend room + watch-streak** (thread 09 teen hooks) — post-Phase-10 experiments

Each of these gets a seed in `.planning/seeds/`.

---

## 10. Canonical references Phase 9 planner should read

- `SUMMARY.md` in this dir — full synthesis
- `05-design-references.md` — concrete design sources (Mubi, Reeder, Arc, Criterion, A24)
- `08-user-archetypes-and-naming.md` — **critical**; bigger than a polish phase should usually handle, but it's the right moment to do it
- `12-accessibility.md` — all 5 improvements should land in Phase 9 tokens
- `10-monetization.md` — paid-tier scope; informs what NOT to accidentally redesign-into-paywalled
- `13-naming-trademark.md` — gate Phase 9 branding commit on the human-do paid clearance

---

## TL;DR for Phase 9 `/gsd-discuss-phase 9 --auto`

Phase 9 scope should include:
- Design token system (palette + typography + motion + a11y)
- Archetype refactor (family/crew/duo → single Couch container)
- Solo on-ramp (+ retroactive-privacy dialog)
- Landing page + App Store marketing assets
- Onboarding rewrite (deep-link invite-first)
- Brand commit (Couch Tonight, pending paid TM clearance)
- A11y AA baseline

Phase 9 should explicitly defer:
- Teen mode
- Star ratings
- Custom lists
- Monetization implementation
- Availability notifications
- Native wraps
- Multi-language

That's a big Phase 9. Expect ~6-8 plans. If it bloats past 10 plans, split to Phase 9 core + Phase 9.5 solo-on-ramp.
