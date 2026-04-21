# Design References — Phase 9 (Couch Redesign / Brand / Marketing)

**Principle:** Warm · Cinematic · Lived-in. Restraint is the principle.
**Researched:** 2026-04-21
**Confidence:** MEDIUM overall (typography/brand writeups well-sourced; motion observations partly inferred from design writeups rather than direct product teardown)

---

## Cinema-brand apps

**Mubi** — Curated cinema streamer; gold-standard "cinema is art, not content" brand.
*Borrow:* Seven-dot logo discipline (single mark carries everything), generous black negative space, poster-as-hero layouts, typographic quiet on film detail pages. LL Riforma does almost all the work — restraint is the structure.
Link: <https://the-brandidentity.com/project/mubi-by-spin> · <https://fontsinuse.com/uses/51030/mubi-identity>

**Criterion Channel** — Collection-first streamer.
*Borrow:* Collection thumbnails as the primary visual unit; the cover art earns the surface, chrome stays invisible. Let movie artwork be loud; let UI be quiet.
Link: <https://monicasarmiento.com/criterion> · <https://www.content-technologist.com/streaming-ux-ui-criterion-mubi-kanopy/>

**A24 (a24films.com / shop)** — Didone-influenced wordmark, NB International + NB International Mono body. Mid-century-nods-to-modern.
*Borrow:* Mono accent type for metadata (runtime, year, notes) against a softer display serif for titles; the shop's editorial photography density is a useful reference for merchandising "tonight's pick."
Link: <https://www.grandarmy.com/projects/a24/> · <https://fontsinuse.com/uses/53928/a24-website>

**Letterboxd** — Social film discovery; design system renamed "Action!" in 2025 redesign.
*Borrow:* Their orange-on-deep-navy accent logic shows warmth works on a cooler dark base; their "bold, cinematic, quirky" tone proves restraint isn't the only path — but the cautionary tale (gray sprawl, too many type styles pre-2025) is exactly what we want to avoid.
Link: <https://letterboxd.com/about/brand/> · <https://ixd.prattsi.org/2025/05/letterboxd-disassembled-creating-a-design-system-for-movie-review-site-letterboxd/>

---

## Warm-dark apps

**Reeder (Silvio Rizzi)** — RSS reader whose dark theme is explicitly *a dark sepia*, not a true black.
*Borrow:* This is the closest public reference to our `#14110f` instinct. Warmth in the dark (paper tones under the blacks) reads as "lived-in." Avoid OLED-pure-black for the core theme; reserve it for an optional "late-night" variant.
Link: <https://9to5mac.com/2019/03/12/reeder-4-public-beta-dark-mode-icloud-more/> · <https://www.macstories.net/news/reeder-2-1-released-with-themes-reading-list-support-fixes/>

**Things 3 (Cultured Code)** — Not dark, but the canonical "restraint as a brand" app.
*Borrow:* No themes, no configurability, whitespace as luxury, Dynamic Type support as quality signal. Copy the *philosophy*: the product is opinionated about aesthetics on the user's behalf.
Link: <https://culturedcode.com/things/features/> · <https://culturedcode.com/things/blog/2023/09/things-big-and-small/>

**Arc (Browser Company)** — Not warm-dark per se, but benchmark for "warm human-centered" instead of "utilitarian-tech."
*Borrow:* Their landing page rhythm (long scrolls, loop video, restrained palette with one saturated accent) is the structural template worth imitating for couchtonight.app marketing.
Link: <https://www.lapa.ninja/post/arc/>

---

## Serif-forward in UI

**NYT (digital)** — Cheltenham / Imperial / NYT Karnak in product, not just print. Proof that serifs survive at 14px in long lists. *Borrow:* serif for titles + clean sans for metadata is a safe, durable hierarchy.
Link: <https://fontsinuse.com/tags/758/the-new-york-times>

**Instrument Serif in the wild** — Open-sourced by Instrument; widely used on indie/startup landing surfaces (Lapa Ninja catalogs 14+ examples). Predominantly landing-page use, occasionally product; rarely at body sizes.
*Borrow:* Keep Instrument Serif as display/editorial only (H1, hero taglines, "Tonight" titles). Don't try to push it to 13px.
Link: <https://www.lapa.ninja/typeface/instrument-serif/> · <https://github.com/Instrument/instrument-serif>

**Fraunces in the wild** — Cooper/Windsor-inspired soft serif with Softness + Wonk axes. Used in editorial/indie apps for warmth.
*Borrow:* Tune the optical-size axis per size, and *use Softness modestly* — high Wonk/Softness reads twee. For Couch's "cinematic but not dated," keep Wonk off and lean on the display optical sizes for hero titles only.
Link: <https://fontsinuse.com/typefaces/121631/fraunces> · <https://undercase.xyz/fonts/fraunces>

---

## Cozy / vibe movement

**Finch, Structured, Opal** — "Soft energy" apps. Pastel/warm palettes, rounded geometry, personification (Finch's pet, Opal's mascot).
*Borrow:* Warmth via *illustration moments* (an empty-state drawing; a small hand-drawn flourish around "Tonight") not via more chrome. Don't adopt their pastel palette — too sweet for cinema.
Link: <https://apps.apple.com/us/app/oasis-lights/id6499230536>

---

## Family / group apps with brand

**Marco Polo** — 2023 rebrand focused on the "beach ball" logo, warm joyful wordmark, family-first positioning.
*Borrow:* Their value prop "help people feel close" is almost exactly Couch's. Their brand refresh writeup is the single most useful reference for how to talk about Couch to families.
Link: <https://www.marcopolo.me/stories/marco-polo-has-a-new-look/>

**Geneva (group chat)** — Thoughtful typography, circular avatars, warm editorial tone. (Limited public design writeup.)
*Borrow:* Avatar stacks ("who's watching tonight") as a first-class UI primitive.

---

## Landing pages

**Mubi / A24 / Arc** — Three variants of premium-but-approachable:
- **Mubi:** film still as hero, minimal copy, let curation speak.
- **A24:** dense editorial grid, merchandise + films coexist.
- **Arc:** long-scroll narrative with looping product video anchors.

For couchtonight.app: Arc's structural rhythm + Mubi's restraint + one strong photographic still (a real-looking warm living room, NOT a screenshot laptop mockup).

---

## Answers to the specific questions

- **Cinematic motion without overwrought:** slow fades (300-500ms), cross-dissolves between poster hero states, subtle parallax on poster stills, letterbox-bar reveals on modal open. Avoid spring-bounce; prefer eased linear (feels like film, not SaaS).
- **Fraunces/Instrument Serif in production UI:** almost entirely display/landing, rarely body. Safe zone: 24px+. Below that, pair with Inter.
- **Palettes beyond warm-dark that read "curated cinema":** (1) deep oxblood + bone (Criterion), (2) near-black + single saturated accent (Mubi yellow; Letterboxd orange), (3) warm sepia-black + cream (Reeder), (4) theater-curtain burgundy at very low saturation.
- **App icon / marketing / hierarchy pattern:** single wordmark or initial on warm dark; poster art as primary marketing visual (not screenshots); hierarchy = serif display / sans body / mono metadata.
- **"Ritual" feeling nailed by:** Mubi's "Film of the Day" (daily ritual framing), Criterion's "Tonight's Feature" surfacing. Both treat selection as ceremony, not search.

---

## Visual direction recommendations for Phase 9

1. **Palette:** Keep `#14110f` as base. Add a bone/cream (`~#F1E8DA`) and one saturated accent (amber/marquee-gold, *not* orange — Letterboxd owns orange). Reserve a deeper oxblood as a secondary accent for ritual moments (Tonight reveal, "we picked" states).
2. **Typography:** Fraunces (display, 32px+, Wonk OFF, Softness low) for hero/ritual moments. Instrument Serif (24-40px) for editorial titles. Inter for everything ≤20px. Consider a mono (JetBrains Mono or IBM Plex Mono) for metadata — this is the A24 move.
3. **Motion:** 300-400ms cross-fades; letterbox-bar reveal on "Tonight" selection; no spring physics; poster Ken Burns on idle.
4. **Imagery:** Poster art IS the UI. Chrome disappears. First-party photography for marketing (warm living room, not a laptop mockup).
5. **Icon:** Single serif glyph (lowercase "c" in Fraunces display on the warm-dark base) or a marquee-dot reference. Avoid gradients; avoid glass.
6. **Restraint rules:** One accent color visible per screen. One display type per screen. One motion metaphor per interaction. If it wouldn't fit in Things 3 / Mubi / Reeder's design review, cut it.
7. **Landing page:** Arc's long-scroll structure + Mubi-level photo restraint + one looping hero video of an actual living-room/TV scene. Tagline in Fraunces; body in Inter; metadata in mono.

---

## Sources

- [MUBI by SPIN — The Brand Identity](https://the-brandidentity.com/project/mubi-by-spin)
- [MUBI identity — Fonts In Use](https://fontsinuse.com/uses/51030/mubi-identity)
- [Criterion Channel redesign — Monica Sarmiento](https://monicasarmiento.com/criterion)
- [Streaming UX comparison — Content Technologist](https://www.content-technologist.com/streaming-ux-ui-criterion-mubi-kanopy/)
- [A24 — GrandArmy case study](https://www.grandarmy.com/projects/a24/)
- [A24 website — Fonts In Use](https://fontsinuse.com/uses/53928/a24-website)
- [Letterboxd brand](https://letterboxd.com/about/brand/)
- [Letterboxd "Action!" design system — IXD@Pratt 2025](https://ixd.prattsi.org/2025/05/letterboxd-disassembled-creating-a-design-system-for-movie-review-site-letterboxd/)
- [Reeder 4 — 9to5Mac](https://9to5mac.com/2019/03/12/reeder-4-public-beta-dark-mode-icloud-more/)
- [Reeder 2.1 themes — MacStories](https://www.macstories.net/news/reeder-2-1-released-with-themes-reading-list-support-fixes/)
- [Things — Cultured Code](https://culturedcode.com/things/features/)
- [Arc landing page inspiration — Lapa Ninja](https://www.lapa.ninja/post/arc/)
- [Fraunces — Undercase Type](https://undercase.xyz/fonts/fraunces)
- [Fraunces in use](https://fontsinuse.com/typefaces/121631/fraunces)
- [Instrument Serif — GitHub](https://github.com/Instrument/instrument-serif)
- [Instrument Serif landing pages — Lapa Ninja](https://www.lapa.ninja/typeface/instrument-serif/)
- [Marco Polo rebrand](https://www.marcopolo.me/stories/marco-polo-has-a-new-look/)
- [NYT typography — Fonts In Use](https://fontsinuse.com/tags/758/the-new-york-times)
