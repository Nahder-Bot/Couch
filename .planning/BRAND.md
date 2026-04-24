# Couch — Brand System v1

*Canonical brand-system documentation. Authored 09-07a (Phase 9 / DESIGN-10).*
*Audience: future-Claude sessions + the user. Under 1500 words by design.*

> **Tone:** Warm · Cinematic · Lived-in. **Restraint is the principle.**
> Brand moments get theatrical treatment; everything else recedes.

---

## 1. Identity

Couch is the movie-night app for families. The identity tells that story: a film-reel "C" fused with "ouch" set in italic display serif, over a warm leather backdrop. The logo is a single asset — `logo-h300.png` / `logo-h200.png` — not reconstructed from type.

- **Primary wordmark:** `logo-h300.png` (brand hero moments), `logo-h200.png` (hero-large entry screens).
- **Mark only:** `mark-512.png` down to `mark-16.png` — PWA + favicon set. Apple-touch-icon at 180/152/144/128.
- **Maskable variants** ship with the W3C 40 % safe-zone. Installed PWA on Android + iOS home-screen get the full mark.
- **Clear-space rule:** at least one "C-counter" height on every side. Never set inside a colored rectangle; leather texture carries the lift.
- **Source + regeneration:** raw SVGs live in `brand/`. On any re-cut, regenerate the full PNG size set + theme-color stays `#14110f`.

**iOS PWA cache-bust** (REQUIRED after icon/logo changes): delete the PWA → Safari Settings → Advanced → Website Data → clear couchtonight.app → reinstall. Manifest caches otherwise linger.

---

## 2. Color tokens

Full primitive list lives in `css/app.css` `:root`. Semantic aliases in the `--color-*` layer beneath. Prefer semantic tokens when meaning is clear; reach for primitives for one-off theatrical moments.

**Foundation (warm dark):**
- `--bg #14110f` — app background.
- `--bg-deep #0e0a07` — sunken wells.
- `--surface #1c1814` / `--surface-2 #25201a` / `--surface-3 #2f2820` — raised cards.

**Ink (text — never pure white):**
- `--ink #f5ede0` — primary text, on `--bg` measured at **≥ 14 : 1** (AAA normal).
- `--ink-warm #c9bca8` — secondary text, **≥ 8.5 : 1** (AA + AAA).
- `--ink-dim #847868` — muted meta, **~4.0 : 1** (AA large text only).
- `--ink-faint #5a4f43` — decorative divider ink, **~2.3 : 1** (NEVER for readable text).

**Accent (used sparingly):**
- `--accent #e8a04a` — amber, the brand voice.
- `--accent-2 #d97757` — terracotta, gradient midpoint.
- `--accent-deep #b8793a` — pressed states, shadowed seams.
- `--velvet #8b3a4e` / `--velvet-glow #c54f63` — rare celebratory moments (brand gradient terminus).

**Semantic state:** `--good #7fb069` · `--warn #d4a76a` · `--bad #c44536`.

**Brand gradient (ONE recipe):** `linear-gradient(135deg, #e8a04a 0%, #d97757 50%, #c54f63 100%)`. Reserved for primary CTAs on entry screens and the brand hero. Never on body text.

Verify any new text/bg combination with `webaim.org/resources/contrastchecker/` before shipping.

---

## 3. Typography

Three typefaces, role-mapped via semantic font-family tokens (DESIGN-03).

| Token | Typeface | Used for |
|---|---|---|
| `--font-display` | Fraunces | Section headings + large title display |
| `--font-serif` | Instrument Serif (italic fallback Fraunces) | Brand taglines, inline emphasis, page-tagline class |
| `--font-sans` | Inter | Body, UI labels, buttons, metadata |

**Scale (modular ~1.2 ratio):**
- `--t-hero 56px` / `--t-h1 32px` / `--t-h2 22px` / `--t-h3 17px`
- `--t-body 15px` / `--t-meta 13px` / `--t-eyebrow 11px` / `--t-micro 10px`

**Anti-pattern:** do NOT mix Fraunces and Instrument Serif in the same visual section. Fraunces carries display weight; Instrument Serif carries italicized brand voice. Pick one per section, hold the line.

**Inline emphasis** goes in `<em>` wrapped by the `page-tagline` class or a serif italic span — never hand-coded font-family strings. Plan 09-03 purged inline `font-family:'Instrument Serif'` from the tree.

---

## 4. Spacing + radius + shadow

**Spacing (semantic — "what this space is FOR"):**
- `--space-inline-xs` 4px / `-sm` 8px / `-md` 12px / `-lg` 16px — gaps between tight inline items
- `--space-stack-sm` 12px / `-md` 20px / `-lg` 28px — vertical rhythm between stacked elements
- `--space-section` 40px — between major sections
- `--space-page` 56px — page-level breathing (hero → content)

**Radius:**
- `--r-sm 8px` — small inputs, single-line rows.
- `--r-md 14px` — cards, modals, primary CTAs.
- `--r-lg 20px` — hero surfaces, featured moments.
- `--r-pill 999px` — pills, chips, avatars.

**Shadow (importance hierarchy — most things flat; shadow = importance):**
- `--shadow-rest none` — default.
- `--shadow-soft 0 4px 16px rgba(0,0,0,0.25)` — cards hovering a step.
- `--shadow-lifted 0 12px 36px rgba(0,0,0,0.45)` — modals, overlays.
- `--shadow-warm 0 4px 24px rgba(232,160,74,0.20)` — brand CTA glow, exactly once per screen.

---

## 5. Motion

Five duration tiers + four easings (DESIGN-09). Catalog below; the raw-literal audit sweeping `css/app.css` for leftover `150ms`/`300ms` is scoped to **09-07b**.

| Token | Value | Used for |
|---|---|---|
| `--duration-instant` | 50ms | Hover / active feedback, focus outline flash |
| `--duration-fast` | 150ms | Button press scale, mood chip toggle, micro hover |
| `--duration-base` | 220ms | Modal backdrop fade, tab switch, standard state change |
| `--duration-deliberate` | 300ms | Modal sheet slide-up, screen change, onboarding step fade |
| `--duration-cinema` | 400ms | Spin reveal, veto shimmer, watchparty banner pulse, YiR ceremony |

| Easing | Curve | Intended use |
|---|---|---|
| `--easing-standard` | `cubic-bezier(0.4, 0, 0.2, 1)` | Material-standard — general UI transitions |
| `--easing-out` | `cubic-bezier(0.2, 0.8, 0.2, 1)` | Decelerating UI — entrance animations |
| `--easing-cinema` | `cubic-bezier(0.32, 0.72, 0, 1)` | Theatrical moments — hero reveals, spin, modals |
| `--easing-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Subtle overshoot — celebratory moments ONLY (toast success, YiR confetti) |

**Reduced-motion contract:** `@media (prefers-reduced-motion: reduce)` clamps all animations to 0.01ms. Always honor — don't retrofit individual overrides.

---

## 6. Voice guide

**Core tone:** *Warm · Cinematic · Lived-in. Restraint is the principle.*

**Voice rules:**
- Speak like a friend handing you the remote. Not a product manager.
- Italicized brand voice lines carry meaning — never decoration.
- No exclamation marks except celebratory moments (YiR, watchparty start, first match).
- Sentence-case buttons. Never ALL-CAPS except eyebrows (`text-transform: uppercase` in CSS, not in the source string).
- No em-dashes dangling at line-end. Let commas + full stops carry rhythm.

**Do / Don't copy:**
- DO: "Who's on the couch tonight?" · DON'T: "Select household members."
- DO: "Pull up a seat." · DON'T: "Sign up to continue."
- DO: "Not tonight?" · DON'T: "Vote DOWN on this selection."
- DO: "One yes is enough." · DON'T: "Sufficient affirmations detected."
- DO: "Everyone voted — here's tonight's match." · DON'T: "All users completed voting."
- DO: "Couch turns *'what do you want to watch?'* into a 30-second ritual." · DON'T: "Couch streamlines selection."
- DO: *"Pick what to watch, together."* · DON'T: "Collaborative content platform."
- DO: "Claim ownership of this group" · DON'T: "Initiate admin transfer."
- DO: "Set a password for faster sign-in" · DON'T: "Configure auth credentials."
- DO: "Spin." · DON'T: "Randomly select from eligible candidates."

---

## 7. Screen patterns (3-tier)

Every screen falls into one of three layout tiers. Respect the tier; don't mix.

1. **Entry screen / hero** — full-viewport, centered, leather-textured (`.wrap.has-leather`). Brand logo top, tagline italic serif, primary CTA brand-gradient, secondary `.alt` flat. Examples: `#signin-screen`, `#screen-mode`, `#screen-family-join`, `#screen-name`, `#onboarding-overlay` (Plan 09-07a).

2. **Tab-sections** — inside `#app-shell` screens (`#screen-tonight`, `#screen-library`, `#screen-family`, `#screen-settings`). Hero eyebrow + possessive serif title (`.tab-hero` / `.tab-hero-title`) followed by `.tab-section` blocks. Cards use `.tab-list-card` / `.tab-accent-card` / `.tab-section-h`. Consistent rhythm via `--space-section`.

3. **Modals** — `.modal` centered over `.modal-bg`. Sub-variants: `.wp-live-modal` (watchparty), `.detail-modal` (title deep), `.yir-modal` (Year in Review ceremony), `.spin-modal` (reveal), `.avatar-picker-modal`, `.schedule-modal`. Backdrop fades at `--duration-base`; sheet slides at `--duration-deliberate`.

Desktop (≥900px) widens `.phone-shell` + modals via `@media` block in plan 09-04. Mobile-first; iOS standalone PWA stays the primary surface.

---

## 8. Do / Don't gallery

- DO: `padding: var(--space-stack-md);` · DON'T: `padding: 20px;`
- DO: `color: var(--color-ink-secondary);` · DON'T: `color: #c9bca8;`
- DO: `font-family: var(--font-serif); font-style: italic;` · DON'T: `font-family: 'Instrument Serif', serif; font-style: italic;` (inline)
- DO: class `.page-tagline` · DON'T: inline style `font-family:'Instrument Serif';font-style:italic;font-size:17px`
- DO: `transition: opacity var(--duration-base) var(--easing-out);` · DON'T: `transition: opacity 220ms cubic-bezier(0.2,0.8,0.2,1);`
- DO: `box-shadow: var(--shadow-warm);` on the ONE primary CTA per screen · DON'T: warm-shadow on every pill.
- DO: `.onboarding-skip` equal visual weight to `.onboarding-primary` · DON'T: bury Skip as 10px grey link-text.
- DO: one gradient instance per screen (`--brand-grad` on primary CTA) · DON'T: gradient tabbar + gradient CTA + gradient hero in one view.
- DO: `em` inside serif italic tagline for accent color · DON'T: hard-coded `<span style="color:#e8a04a">`.
- DO: Use `.tab-accent-card` for ONE promoted item per tab (YiR on Settings, Approvals on Family) · DON'T: turn every card into an accent card.

---

## 9. Refresh cadence

Update this doc whenever:
- Tokens change in `css/app.css` `:root` (add/rename/retire).
- Brand assets regenerate (logo cut, mark cut, favicon set).
- Voice guide drifts — new copy patterns emerge or old ones retire.
- Motion catalog gains/loses a tier (rare).

Tie BRAND.md refreshes to `brand/` SVG recuts so the visual + written truths stay in lockstep. Phase 10 Year-in-Review ceremony renders against these tokens; downstream phases depend on this doc as the canonical reference.

---

*End of BRAND.md v1. Authored Plan 09-07a, Phase 9 closure.*
