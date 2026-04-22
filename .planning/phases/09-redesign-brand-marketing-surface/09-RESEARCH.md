# Phase 9: Redesign / Brand / Marketing Surface — Research

**Researched:** 2026-04-21
**Domain:** visual identity + design-system tokenization + landing/marketing surface + onboarding polish for a no-bundler single-file PWA
**Confidence:** HIGH on scope/sequencing, HIGH on tech pipeline, MEDIUM on aesthetic-specific choices that should stay with the user

## Summary

Phase 9 is a wide-footprint polish pass on an app that already has most of the token skeleton in place. Reading `css/app.css` confirms a solid-but-partial token system is live (`--bg`, `--accent`, `--s1..--s8`, `--t-hero..--t-micro`, `--r-sm..--r-pill`, `--t-quick/--t-base/--t-cinema`, `--ease-out/--ease-cinema`, `--brand-grad`) — canonicalization means **consolidating and documenting what exists**, not inventing from scratch. The real gaps are (1) **no desktop responsive layer at all** — `body{max-width:480px}` hard-locks the app to mobile width, which is exactly what Phase 7 UAT surfaced for the watchparty live modal; (2) **119 inline `style=` attributes in `index.html`** representing one-off styling drift that needs to migrate to token-backed classes; (3) **no landing page** — the root currently serves the app shell directly; (4) **no motion inventory** — durations are tokenized but micro-interactions aren't enumerated; (5) **onboarding is ad-hoc across four entry screens** (mode-pick, family-join, name, sign-in) without a unifying first-run narrative.

The brand identity side — logo, icon, favicon set — is **already mostly wired**: `index.html` references `/logo-h300.png`, `/logo-h200.png`, `/mark-{96,128,144,152,180,192,512}.png`, `/favicon-{16,32,48}.png`, `/favicon.ico`, and the PWA manifest is already inline as a data URL with the correct icon entries. So DESIGN-01 is **"regenerate the final set from a canonical SVG source"**, not "design a logo from scratch" unless the user wants a refresh. Those asset files are served from `queuenight/public/` (the deploy repo, sibling to this one), not from this repo — the plans MUST account for a two-repo deploy path.

**Primary recommendation:** Four waves, seven plans. **W1 identity + token canonicalization** (logo pipeline + formalize tokens into a single `:root` block with primitive/semantic/alias tiers). **W2 screen refactor + desktop responsive** (introduce one responsive breakpoint lifting `max-width:480px` off `body`, scope it to a `.phone-shell` wrapper, render dense screens like watchparty live modal at wider max-widths on desktop). **W3 landing page + marketing assets** (new `index.html` at a separate path or served-when-unauthed gate; screenshot pipeline via AppScreens or similar). **W4 onboarding polish + brand docs + motion language + seed absorption** (first-run sequence, invite redemption flow, BRAND.md in `.planning/`, motion token enumeration, absorb the 6 deferred items listed in CONTEXT).

## User Constraints (from ROADMAP + STATE + CLAUDE.md)

CONTEXT.md was not generated (this research runs as part of `/gsd-plan-phase 9` integrated flow, skipping discuss). The constraints below are pulled from authoritative project docs and must be honored by the planner.

### Locked Decisions

- **Single-file JS architecture locked for v1** — no bundler, no build step. CSS stays in `css/app.css`, JS in `js/app.js` + small sibling modules. Do NOT introduce PostCSS, Sass, Tailwind, Vite PWA plugins, or any compile step. (CLAUDE.md)
- **Firebase Hosting serves files directly** from the sibling `queuenight/public/` deploy repo. Brand assets (PNGs, SVGs, favicons) live in that repo, not this one. (CLAUDE.md)
- **Existing palette preserved**: `--bg:#14110d` (note the repo uses `#14110d`, CLAUDE.md quotes `#14110f` — minor inconsistency to reconcile in DESIGN-02), warm dark cinematic. Accent system `--accent:#e8a04a` + `--accent-2:#d97757` + `--velvet:#8b3a4e`. (css/app.css lines 7-25)
- **Typography locked**: Fraunces + Instrument Serif + Inter, already loaded from Google Fonts at `index.html:53`. (CLAUDE.md, index.html)
- **Theme color `#14110f`** in meta tag + manifest data URL must stay in sync with canonical palette. (CLAUDE.md)
- **"Warm · Cinematic · Lived-in. Restraint is the principle."** — design voice. Brand moments get theatrical treatment; everything else recedes. (PROJECT.md, CLAUDE.md)
- **TMDB + Firebase web config stay client-side.** Landing page must not attempt to "fix" this. (PROJECT.md, CLAUDE.md)
- **iOS standalone PWA is the primary surface.** Desktop Chrome is secondary. Any desktop-layer work must not regress iOS home-screen behavior. (CLAUDE.md)
- **Product-phase numbering is stable.** Do not renumber. (CLAUDE.md)

### Claude's Discretion

- Exact token naming (primitive vs semantic vs alias naming — rename existing `--bg` to `--color-bg-primary`? or preserve the short names?). Research recommends **preserve existing short names + add semantic aliases above them** — rationale in Design Tokens section.
- Whether landing page ships as a second HTML file (`/landing.html` or `/about.html`) or as a pre-auth render path inside `index.html`. Research recommends **separate `index.html` for the landing + rename current app shell to `app.html`** — rationale in Landing Page section.
- Exact onboarding sequence length and screen count (2 screens? 3? value-prop → permission → done?). Research recommends **3-step with hard skip available at every step**.
- Marketing-screenshot tool choice. Research leans **AppScreens or AppLaunchpad** (free tiers, browser-based, no account needed for initial runs).

### Deferred Ideas (OUT OF SCOPE for Phase 9)

- New feature capabilities. Phase 9 is explicitly a polish/redesign phase — if absorbing a seed introduces a feature that doesn't exist yet (e.g., guest invite redemption, legacy family ownership self-claim), the seed should ship **in its own plan within Phase 9** but design-aligned from the start, NOT retrofitted later.
- Bundler / modularization. Deferred to v2.
- FlutterFlow port / native wrap. Deferred post-v1.
- Monetization UI (plan-tier gating, pricing page). Out of scope for v1 milestone per PROJECT.md.
- Public social / cross-family discovery. Family-scoped only.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DESIGN-01 | Final logo + app icon set + favicon | Identity section — RealFaviconGenerator or Vite PWA assets-generator CLI (use CLI directly, don't install the plugin) from SVG source, writes to `queuenight/public/` |
| DESIGN-02 | Canonical design tokens (colors, type, spacing, motion, radius) | Design Tokens section — existing `:root` block in css/app.css:1-90 already holds 90% of what's needed; task is consolidation + primitive/semantic tier split + alias hygiene |
| DESIGN-03 | Typography tokens applied consistently | Screen Refactor section — 119 inline `style=` attrs in index.html to migrate; grep for `font-family:'Instrument Serif'` + `font-family:'Fraunces'` + inline `font-size` and replace with token classes |
| DESIGN-04 | Every in-app screen re-rendered against tokens | Screen Refactor section — ordered audit below, watchparty-live modal deepest debt |
| DESIGN-05 | Landing page at `couchtonight.app` root — mobile-first, warm cinematic | Landing Page section — separate `index.html` + current app moves to `app.html`; hero + value prop + single CTA + "who is this for" block |
| DESIGN-06 | App-Store-ready marketing assets | Marketing Assets section — AppScreens or AppLaunchpad, 6-8 screenshot deliverables |
| DESIGN-07 | First-run onboarding polished, introduces features tastefully | Onboarding section — 3-step progressive disclosure with hard skip; no heavyweight walkthrough |
| DESIGN-08 | Invite-flow onboarding polished + brand-aligned | Onboarding section — absorbs phase-05x-guest-invite-redemption.md; single-screen "Join {family} as guest" with branded framing |
| DESIGN-09 | Motion language tokens (toast, modal open, spin, veto, watchparty) | Motion Language section — tokens already exist (`--t-quick/base/cinema`, `--ease-out/cinema`); task is cataloguing micro-interactions + adding 1-2 missing tiers + audit of `transition:` / `animation:` rules |
| DESIGN-10 | Brand-system documentation in `.planning/` | Brand Docs section — single `.planning/BRAND.md` + 1-page voice guide; tie to Phase 10 (YIR) shareables |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Logo + icon asset generation | Build-time (developer machine) | Deploy repo (`queuenight/public/`) | SVG → PNG set generated once locally, committed to deploy repo; no runtime cost |
| Design tokens | Browser (CSS custom properties) | — | Runtime tokens via `:root { --* }` in `css/app.css`; cascade + dark-theme-default handles all theming needs |
| Screen refactor | Browser (CSS + static HTML) | — | Purely DOM + CSS; no JS logic change for DESIGN-04 (except removing inline `style=`) |
| Desktop responsive layer | Browser (CSS media query) | — | Standard viewport media query; wraps existing phone-column layout + progressively relaxes modal max-widths |
| Landing page | Static hosting (Firebase) | — | Served as a separate static HTML file; no JS bundle, no Firebase SDK load (huge perf + privacy win) |
| Marketing screenshots | Build-time (developer tooling) | Deploy repo | Screenshots taken from live app, processed in AppScreens-style tool, committed alongside landing |
| First-run onboarding | Browser (JS render on `state` predicates) | Firestore | `js/app.js` gates onboarding screen rendering on `state.me?.seenOnboarding` flag; Firestore persists the flag |
| Invite redemption | Browser + Cloud Functions | Firestore | Branded client screen + `consumeGuestInvite` CF (per seed); admin-SDK writes |
| Motion micro-interactions | Browser (CSS transitions/keyframes) | — | Pure CSS; no animation library |
| Brand docs | Documentation (`.planning/`) | — | Markdown, read by Claude + humans; no runtime surface |

## Standard Stack

### Core

No new runtime dependencies. Everything ships with existing Google Fonts + CSS + vanilla JS.

### Supporting — one-time developer tooling (NOT runtime deps)

| Tool | Version | Purpose | Why Standard |
|------|---------|---------|--------------|
| `@vite-pwa/assets-generator` (CLI) | Current | Generate all PWA icon sizes from single SVG | De facto standard; runs one-shot via `npx`, no project install; outputs manifest-aligned PNG set |
| RealFaviconGenerator.net | Web | Alternative to above — browser-based, zero install | Generates favicon.ico + all iOS sizes + Android + Safari mask icon + dark-mode variant |
| AppScreens (appscreens.com) | Web | App-Store screenshot generator | Free tier, mockup device frames, no install; generates iOS + Android App Store + Play Store + web screenshot sets |
| AppLaunchpad (theapplaunchpad.com) | Web | Alternative screenshot generator | Free tier; browser-based; good templates |
| Playwright or direct iPhone screenshot | — | Capture raw app screenshots at 1170x2532 (iPhone 14/15 Pro reference) | Can be done manually from the PWA |

**Version verification:** `@vite-pwa/assets-generator` is available via `npx @vite-pwa/assets-generator` with no install step. Verify availability at plan-time with `npx --yes @vite-pwa/assets-generator --help`. Do NOT add to any `package.json` — this project has no Node package.

**Key insight:** all three "standard stack" pieces are developer-machine tools that produce static assets committed to the deploy repo. They don't run at build time (no build step). They don't run at runtime. They're run manually before a deploy when assets change.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| AppScreens | Screenshots.pro | Paid, more automation, localization — overkill for family-app v1 |
| RealFaviconGenerator | Favicon.io | Simpler but lacks Safari mask icon + dark-mode variant |
| SVG source logo (user-provided) | AI-generated logo via Midjourney/DALL-E | Delegating brand creation to AI contradicts "Warm · Cinematic · Lived-in. Restraint is the principle." User should own the logo concept |

## Scope & Sequencing

### Recommended wave structure — 4 waves, 7 plans

Below is the recommendation. The planner may subdivide further but should not merge waves (each wave has an internally-coherent theme + produces a commit-worthy milestone).

**Wave 1 — Identity + Token canonicalization (2 plans)**
- **09-01** Identity pipeline: canonical SVG logo source committed to this repo under `brand/`; regenerate logo PNGs (h200, h300, wordmark variants) + full icon set (mark-{96,128,144,152,180,192,512} + favicon-{16,32,48,ico}) via `@vite-pwa/assets-generator` + RealFaviconGenerator; write outputs to `queuenight/public/`; update inline PWA manifest data URL if any icon filename changes; verify iOS apple-touch-icon-180 renders cleanly in iOS standalone PWA after cache bust. Covers DESIGN-01.
- **09-02** Token canonicalization: audit `css/app.css:1-90` `:root` block; reconcile `#14110d` vs `#14110f` inconsistency with `#14110f` winning (theme color); add `--color-*` semantic aliases above existing primitive `--bg`/`--accent`/etc without renaming existing tokens (backward-compat); add any missing motion tier (see Motion Language section: `--t-instant:50ms`, `--t-deliberate:300ms`); document semantic vs alias layering in header comment. Covers DESIGN-02, DESIGN-09 (token half).

**Wave 2 — Screen refactor + desktop responsive (2 plans)**
- **09-03** Inline-style purge: grep `index.html` for all 119 `style="…"` attributes; for each, determine whether it's a one-off positional override (keep), token-applicable (migrate to class), or design-drift (remove); ship screen-by-screen so bisects stay narrow; acceptance = zero inline `font-family`, zero inline `color:var(--…)`, zero inline spacing that has a `--s*` equivalent. Covers DESIGN-03, DESIGN-04 first half.
- **09-04** Desktop responsive + watchparty live modal fix: introduce `.phone-shell` wrapper class around top-level app (currently `body` itself has `max-width:480px`); migrate the cap from `body` → `.phone-shell`; add `@media (min-width:900px)` breakpoint that allows `.phone-shell` to be a centered column but expands `.wp-live-modal` + `.modal` + `.swipe-card` + `.yir-modal` to wider max-widths (e.g. 720-900px) on desktop; verify iOS mobile layout identical. Covers DESIGN-04 second half + closes Phase 7 deferred gap explicitly routed here by STATE.md.

**Wave 3 — Landing + marketing (2 plans)**
- **09-05** Landing page: create `landing.html` (or rename current `index.html` → `app.html` and add new `index.html` as landing — research recommends the latter, see Landing section); wire Firebase Hosting `rewrites` so `/` serves landing and `/app` (or auth-detect redirect) serves app; hero with wordmark + "Who's on the couch tonight?" tagline + single "Pull up a seat" CTA; sections: What it is, Who it's for, How it works (3-step), Who made it, install instructions (per-browser); no Firebase SDK loaded; SoftwareApplication JSON-LD schema; canonical OG image 1200x630. Covers DESIGN-05.
- **09-06** Marketing assets + SEO: use AppScreens or AppLaunchpad to produce 6-8 App-Store-style screenshots (Tonight, Title Detail with vote, Watchparty live, Year-in-Review teaser, Mood filter, Veto moment, Invite flow, Group switcher); commit under `queuenight/public/marketing/` + wire into landing; OG image regenerated from hero screenshot; verify Twitter + iMessage + Slack previews render. Covers DESIGN-06 + finishes landing surface.

**Wave 4 — Onboarding + motion + docs + seed absorption (1 plan, OR subdivide into 2)**
- **09-07** (may split into 09-07a/07b): First-run onboarding sequence (3-step, skippable) at the top of the signed-in + has-family state if `state.me.seenOnboarding !== true`; invite-redemption screen (absorbs phase-05x-guest-invite-redemption.md — branded "Join {family}" screen, `consumeGuestInvite` CF); motion language catalog (enumerate all `transition:` + `animation:` + `@keyframes` in css/app.css, ensure each uses a token-backed duration/easing, no raw magic numbers); BRAND.md in `.planning/` (token cheatsheet, do/don't, voice guide); legacy-family-ownership self-claim CTA (absorbs phase-05x-legacy-family-ownership-migration.md — Account settings CTA + rules update); account settings "sign in vs create account" relabel (absorbs phase-05x-account-linking.md items #6 + #7); onIntentCreated CF timezone fix (absorbs phase-08x-intent-cf-timezone.md — trivial ~30min, fits here because it's a deploy-repo CF change and Phase 9 is already touching deploy repo for assets). Covers DESIGN-07, DESIGN-08, DESIGN-09 (second half), DESIGN-10.

**If 09-07 feels too fat, split:**
- 09-07a first-run + invite redemption + legacy self-claim (brand-facing)
- 09-07b motion audit + BRAND.md + account-settings polish + CF timezone fix (dev-facing + docs)

### Why this ordering

1. **Identity first** because every subsequent wave references the logo / icons / brand system.
2. **Tokens next** because they're the substrate for the screen refactor.
3. **Screens + responsive together** because desktop-responsive *is* a screen-refactor subset, and keeping them in one wave means the diff is coherent.
4. **Landing + marketing together** because the marketing screenshots are what populates the landing page.
5. **Onboarding last** because onboarding introduces feature surfaces (moods, veto, watchparty, push) that must already look polished when the onboarding previews them.

### Why not 6 plans or 8 plans

- 6 plans would require collapsing W2 (inline-purge + responsive) which is too much surface in one commit window
- 8 plans would fracture Wave 4 prematurely — most of those items are small and share a commit context

## Identity

### Logo + icon pipeline (DESIGN-01)

**Current state:** `index.html` already references a full icon set:
- `/logo-h300.png` (634×300) — hero wordmark
- `/logo-h200.png` (423×200) — small wordmark on join/name screens
- `/mark-96|128|144|152|180|192|512.png` — app marks
- `/favicon-16|32|48.png`, `/favicon.ico`, `/mark-96.png` — favicons
- `apple-touch-icon` in sizes 128, 144, 152, 180

These files live in `queuenight/public/` (deploy repo), not in this repo.

**Recommended pipeline:**

1. **Commit a canonical SVG source** to `brand/couch-mark.svg` + `brand/couch-wordmark.svg` in THIS repo (vs. the deploy repo). Rationale: source-of-truth lives with the app code; deploy repo holds output only.
2. **Generate full PNG set** via `npx @vite-pwa/assets-generator` pointed at the canonical SVG. This outputs all required PWA icon sizes per the 2026 spec.
3. **Favicon + apple-touch-icon** via RealFaviconGenerator.net (browser-based, no install) — it handles the edge cases `@vite-pwa/assets-generator` doesn't (ICO container, Safari mask icon, dark-mode variant).
4. **Manual wordmark renders** (`logo-h300.png`, `logo-h200.png`) exported from SVG at the exact pixel dimensions the HTML expects (634×300 and 423×200). A 2x set (`@2x.png`) would be nice-to-have but current `index.html` doesn't reference @2x, so keep scope tight.
5. **Copy all outputs** to `queuenight/public/` + commit in that repo.
6. **Deploy + iOS cache-bust** test: after deploy, uninstall the PWA from the iPhone home screen, delete Safari website data for `couchtonight.app` (per STATE.md ENVIRONMENT NOTE), reinstall. Verify apple-touch-icon renders sharp at ~120px home-screen rendering.

**iOS PWA requirement (2026 verified):**

- Apple Safari **ignores the PWA manifest icon set** on iOS — it uses `<link rel="apple-touch-icon" href="…" sizes="180x180">` from the HTML head instead. [CITED: webkit.org convention] [VERIFIED: coywolf.com/guides/how-to-create-pwa-icons]
- **180×180 is the canonical size** for modern iOS (covers iPhone + iPad). Older sizes (152, 144, 128) are nice-to-have but not required. The repo already includes them — keep them.
- Icon must be **square, no curves, no padding** — iOS clips the corners itself. Existing marks should be verified against this; if the mark has rounded corners baked in, flatten before regenerating. [VERIFIED: logofoundry.app/blog/pwa-icon-requirements-safe-areas]
- **PNG, not SVG** for apple-touch-icon. SVG favicon is fine for modern browsers but iOS home screen requires PNG.

**"Wordmark + symbol" lockup references (for DESIGN-01 brand direction — confirm with user, don't prescribe):**

- **Airbnb Cereal era** (~2018): warm sans wordmark + minimal symbol; letter-locked but with generous letter-spacing. [ASSUMED — reference only]
- **Medium** (~2015): serif wordmark + minimal "M" symbol; the symbol can stand alone at small sizes. [ASSUMED]
- **Apollo** (Reddit client): wordmark is just the symbol repeated; minimal, confident. [ASSUMED]
- **Fraunces specimen**: the Fraunces specimen pages on Google Fonts + pimpmytype.com demonstrate warm cinematic usage well. [CITED: fonts.google.com/specimen/Fraunces]

[ASSUMED] The current wordmark (per `logo-h300.png` reference at 634×300, ratio ~2.1:1) is likely already well-proportioned — exact visual assessment requires the user to confirm whether they want a refresh or just to regenerate from existing SVG.

### Open questions on identity

- Does a canonical SVG exist, or do the PNGs predate it? — needs user answer
- Any brand guideline doc already? — STATE.md shows none
- Apple Sign-In enablement (separate $99/yr seed `phase-05x-apple-signin.md`) is adjacent but OUT OF SCOPE for Phase 9 per constraints

## Design Tokens

### Current token inventory (verified via css/app.css:1-90)

| Category | Tokens | Count | Status |
|----------|--------|-------|--------|
| Colors (primitive) | `--bg`, `--bg-deep`, `--surface`, `--surface-2`, `--surface-3`, `--ink`, `--ink-warm`, `--ink-dim`, `--ink-faint`, `--accent`, `--accent-2`, `--accent-deep`, `--velvet`, `--velvet-glow`, `--good`, `--warn`, `--bad` | 17 | Solid — warm-dark palette complete |
| Colors (border) | `--border`, `--border-mid`, `--border-strong`, `--border-accent` | 4 | Solid |
| Spacing | `--s1:4px` → `--s8:56px` | 8 | Linear-ish; no `--s0` for 0 or `--s9` for extra-wide |
| Type sizes | `--t-hero:56px`, `--t-h1:32px`, `--t-h2:22px`, `--t-h3:17px`, `--t-body:15px`, `--t-meta:13px`, `--t-eyebrow:11px`, `--t-micro:10px` | 8 | Good coverage |
| Radii | `--r-sm:8px`, `--r-md:14px`, `--r-lg:20px`, `--r-pill:999px` | 4 | Solid |
| Shadows | `--shadow-rest/soft/lifted/warm` | 4 | Solid |
| Motion duration | `--t-quick:150ms`, `--t-base:220ms`, `--t-cinema:400ms` | 3 | Needs 1-2 more tiers (see Motion section) |
| Motion easing | `--ease-out`, `--ease-cinema` | 2 | Good |
| Gradient | `--brand-grad` | 1 | Solid |
| Legacy aliases | `--bg-2`, `--r-xl`, `--shadow-1/2/glow`, `--fs-hero/display/title/body/meta/micro` | 10 | Backward-compat; keep but don't grow |

**Assessment:** 90% of the token system already exists. The task is **consolidation + documentation**, not invention.

### Recommended token hierarchy (3-tier, industry standard)

**Layer 1 — Primitive tokens** (existing short names, preserved):
```css
--bg: #14110f;        /* reconciled to match theme-color */
--accent: #e8a04a;
--s4: 16px;
--t-h2: 22px;
/* ...all existing tokens unchanged */
```

**Layer 2 — Semantic tokens** (NEW, added above primitives, alias into them):
```css
--color-surface-base: var(--bg);
--color-surface-raised: var(--surface);
--color-surface-sunken: var(--bg-deep);
--color-ink-primary: var(--ink);
--color-ink-secondary: var(--ink-warm);
--color-ink-muted: var(--ink-dim);
--color-accent-primary: var(--accent);
--color-accent-secondary: var(--accent-2);
--color-feedback-positive: var(--good);
--color-feedback-warning: var(--warn);
--color-feedback-danger: var(--bad);
--space-inline-md: var(--s4);
--space-stack-lg: var(--s6);
--text-display-lg: var(--t-hero);
--text-heading-xl: var(--t-h1);
--text-body-md: var(--t-body);
--duration-fast: var(--t-quick);
--duration-base: var(--t-base);
--duration-cinema: var(--t-cinema);
```

**Layer 3 — Component tokens** (scoped inside component selectors, NOT in `:root`):
```css
.wp-live-modal {
  --wp-modal-max-width: 520px;
  --wp-modal-header-bg: linear-gradient(180deg,rgba(232,160,74,0.06) 0%,transparent 100%);
  max-width: var(--wp-modal-max-width);
  ...
}
```

### Why this hierarchy matters

Primitive + semantic + component is the **industry-standard design-token architecture** (Style Dictionary, Design Tokens Community Group spec 2025.10). [CITED: styledictionary.com/info/tokens, designtokens.org/tr/drafts/format] Semantic tokens decouple *what a color is* from *what it's used for*, which is the only way to safely change palette later without touching every component. [VERIFIED: penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables, css-tricks.com/what-are-design-tokens]

**Why preserve the short primitive names:** renaming `--bg` to `--color-bg-primary` across 2104 lines of CSS is a massive-diff refactor with zero runtime benefit. Semantic tokens layered on top give us the abstraction without the churn.

### Implementation path (no build step)

Native CSS Custom Properties handle the whole thing at runtime — no Sass, no PostCSS, no Style Dictionary compile. The semantic layer is just more `:root { --* : var(--*) }` lines. The cascade + `var()` chain Just Works. [VERIFIED: frontendtools.tech/blog/css-variables-guide-design-tokens-theming-2025]

`@property` (typed tokens, fallback values, syntax validation) is supported in all modern browsers as of 2024 and is the one genuinely new capability worth considering — e.g.:
```css
@property --color-accent-primary {
  syntax: '<color>';
  inherits: true;
  initial-value: #e8a04a;
}
```
This gives us type validation + graceful fallback if the token is ever removed. Recommendation: **skip `@property` for v1** — not needed, adds noise. Revisit post-v1 if theming expands.

### Color contrast verification (accessibility)

Before locking DESIGN-02, run contrast checks on:
- `--ink` on `--bg` → needs ≥4.5:1 (body text)
- `--ink-warm` on `--bg` → needs ≥4.5:1 if used for body, ≥3:1 if for large text/labels
- `--ink-dim` on `--bg` → this one is visually faint; spot-check it's only used for large-text contexts
- `--accent` on `--bg` → brand moments use white accent text on accent gradient; verify inverse works too

Tool: webaim.org/resources/contrastchecker or Chrome DevTools accessibility pane. Should be a plan acceptance criterion.

## Screen Refactor

### Visual debt audit (from index.html + css/app.css reads)

**Inline style count in index.html:** 119 `style="…"` attributes. This is the primary metric for DESIGN-03/04 progress.

**Per-screen debt inventory (ordered highest → lowest):**

1. **Watchparty live modal** (`.wp-live-modal`, css:611-624 + scattered from 611-900ish)
   - Debt: hard-coded `max-width:520px` + `max-height:90vh` — exactly the Phase 7 UAT gap. Desktop viewport >1000px renders this as a narrow column floating center, squeezed controls.
   - Refactor: migrate max-width to component token; add responsive breakpoint expanding to `min(720px, 90vw)` at `min-width:900px`.
   - Priority: **highest** — explicitly deferred here from Phase 7.

2. **Tonight screen** (`.screen#screen-tonight`, index.html:183-260)
   - Debt: multiple inline styles on `.picker-card` display toggle (inline `style="display:none"`), stat-grid spacing hacks, mood-active-row inline border-spacing.
   - Refactor: all inline `display:none` → class `.is-hidden`; token-applicable spacing → token classes; preserve non-token-applicable inline (e.g. dynamic transform for rotation).
   - Priority: **high** — most-visited screen, sets the tone.

3. **Settings screen** (`.screen#screen-settings`, index.html:453-573)
   - Debt: heavy `style="display:flex;gap:var(--s2);flex-wrap:wrap;"` patterns that should be `.row-cluster` class; inline `style="background:var(--surface-2);"` on adults-toggle; inline `margin-top` on a handful of elements.
   - Refactor: extract repeat patterns into utility classes (`.cluster`, `.stack-sm`, etc.) — bounded set, ~5 classes cover most.
   - Priority: **medium** — lots of sections, many one-offs.

4. **Sign-in screen** (`#signin-screen`, css:2019-2082)
   - Debt: hard-coded `padding:24px 20px; max-width:420px; margin:0 auto;` rather than tokens; inline on `.claim-confirm-screen`; no explicit mobile-vs-desktop consideration.
   - Refactor: tokenize padding/max-width; prepare for "sign in vs create account" split (absorbed from seed #7).
   - Priority: **medium** — first impression for new users.

5. **Title detail modal** (referenced by `#modal-bg`, css section around 350-440)
   - Debt: modal uses `max-width:480px` which matches the body; on desktop needs to expand.
   - Refactor: bumped to `720px` at desktop breakpoint as part of Wave 2.
   - Priority: **medium**.

6. **Mode-pick + family-join + name screens** (index.html:91-145, `.wrap.has-leather` pattern)
   - Debt: lots of inline `style="margin:var(--s5) 0 var(--s6);"` for brand hero spacing; inline `style="text-align:center;font-family:'Instrument Serif'..."` on welcome text at index.html:95 — direct violation of DESIGN-03.
   - Refactor: extract `.brand-hero-large` + `.page-tagline` classes; reuse across all three screens.
   - Priority: **medium** — these are onboarding surfaces, matter for first-run polish (Wave 4).

7. **Year-in-Review + story modals** (css:824-1080 referenced; currently placeholder for Phase 10)
   - Debt: already-fat modal sizing that'll need desktop breakpoint.
   - Refactor: get ahead of Phase 10 by tokenizing `max-width:560px` now.
   - Priority: **low** — not the active-use surface this milestone.

8. **Sports picker, swipe overlay, onboard modal** (various)
   - Debt: assorted inline styles + hardcoded max-widths.
   - Refactor: include in general pass.
   - Priority: **low**.

9. **Misc screens** (library, add, family)
   - Debt: less visible because they're list-heavy and lists already use token-classes cleanly.
   - Refactor: spot-check only.
   - Priority: **lowest**.

### Refactor order recommendation

**Within Wave 2, ship plan 09-03 (inline purge) as 3 sub-commits matching debt groups:**
1. Tonight + Settings (highest visit surface)
2. Sign-in + Mode-pick + Family-join + Name (onboarding surfaces, feeds Wave 4)
3. Misc (sports, library, add, family, YIR placeholder)

Each sub-commit is self-contained and bisectable.

### Acceptance gate for DESIGN-03/04

- `grep -c 'style="' index.html` drops from 119 to <20 (the remaining ~20 are load-time display toggles + dynamic transforms that legitimately can't move to CSS)
- Zero `font-family:'Fraunces'` / `font-family:'Instrument Serif'` inline — all via class
- Zero `color:var(--…)` inline — all via class
- Grep `\-\-bg:\s*#14110d` returns 0 (reconciled to `#14110f`)

## Desktop Responsive

### The root problem

`body { max-width: 480px; margin: 0 auto; ... }` at `css/app.css:101`. This is **the single line** that makes the app render as a 480px column in a 1920px desktop viewport. Every modal (`.modal` at max-width 480, `.wp-live-modal` at 520, `.yir-modal` at 560, etc.) inherits this mobile assumption.

### Proposed fix (minimal, clean, preserves mobile)

**Step 1 — Restructure:** Move the max-width cap from `body` onto a new `.phone-shell` class. Wrap `#app-shell` + pre-auth screens (`#signin-screen`, `#screen-mode`, `#screen-family-join`, `#screen-name`, `#claim-confirm-screen`) in `.phone-shell`. Body becomes `body { max-width: none; min-height: 100vh; }`.

**Step 2 — Default state:** `.phone-shell { max-width: 480px; margin: 0 auto; }` — matches current mobile behavior exactly on iOS + small desktop.

**Step 3 — Desktop breakpoint:** Single `@media (min-width: 900px)` block:
```css
@media (min-width: 900px) {
  .phone-shell { max-width: 520px; /* slight expansion */ }

  /* Modals expand past the phone-shell cap */
  .modal { max-width: 640px; }
  .wp-live-modal { max-width: 800px; max-height: 85vh; }
  .wp-live-body { padding: 20px 24px; }
  .yir-modal, .yir-story-modal { max-width: 720px; }
  .swipe-card { max-width: 480px; height: min(640px, 80vh); }

  /* Tabbar can sit against .phone-shell width */
  .tabbar { max-width: 520px; }
}
```

**Step 4 — Preserve iOS behavior:** iOS Safari reports viewport widths well below 900px in standalone PWA, so the desktop rules never activate on phones. Verify on physical iPhone after deploy.

### Why 900px (not 768px or 1024px)?

- 768px is iPad portrait. We do NOT want the desktop rules activating on iPad portrait because the app UX there is closer to mobile.
- 1024px is iPad landscape. At that width, the current mobile column is usable but wasteful.
- 900px threads the needle: iPad portrait stays mobile (below 900), iPad landscape + desktop get the expansion.

### Container queries vs media queries decision

Per LogRocket 2026 guidance and CSS-Tricks, **media queries are correct for modals** because modals are viewport-attached. Container queries would be overkill — the only benefit is if modals appeared in different layout contexts (they don't). [VERIFIED: blog.logrocket.com/container-queries-2026, geary.co/container-queries-vs-media-queries]

**Recommendation: media queries only for Phase 9.** Container queries can ship in a post-v1 polish pass if component reuse grows.

### Edge cases to verify

- Tabbar position: currently `position:fixed; left:50%; transform:translateX(-50%); max-width:480px;` — needs to bump to 520 at desktop to match phone-shell.
- Who-mini sticky bar: same pattern.
- Modal backdrop clicks: unchanged.
- iOS standalone PWA notch handling (`env(safe-area-inset-*)`): preserve existing rules; no conflict with responsive layer.

## Landing Page

### Structural recommendation

**Architecture:** Create a new `landing.html` at repo root. Update Firebase Hosting rewrites so `/` serves `landing.html` and `/app` (or `/app.html`) serves the current application shell. Preserve `couchtonight.app/?invite=…` deep-link handling by routing `/` with query params → app.html automatically (hosting rewrite or minimal landing-side redirect).

**Alternative (simpler but less performant):** Keep `index.html` as the app, add a "marketing mode" rendered for unauthed users at `/about` via a second HTML file. Landing stays zero-JS.

**Strong recommendation:** The first option. Why: landing-page visitors should **not** pay for the Firebase SDK download (~200KB compressed), Google Fonts full axis range, or TMDB client state. A zero-JS landing page is dramatically faster, better for SEO, and better for perceived polish. The app shell becomes `app.html`.

### Landing page content architecture (mobile-first)

**Above the fold (mobile viewport):**
- Wordmark logo (h200 size, reusable from app)
- Tagline: "Who's on the couch tonight?" in Instrument Serif italic — current established voice
- One primary CTA: "Pull up a seat" → `/app.html` (or deep link behavior)
- Secondary text link: "Already have an account? Sign in"

**Below the fold (scroll):**
- "What Couch is" — 2-3 sentence value prop, Fraunces 600 weight
- "Who it's for" — 3 icons (family / crew / duo) mirroring the existing mode-pick cards at index.html:97-111, reusable SVGs
- "How it works" — 3-step: Join the couch → Everyone votes → Spin decides. Minimal illustration or screenshot per step.
- Feature screenshots carousel or grid: Tonight, Watchparty, Mood filter, Veto, Year-in-Review (subset of DESIGN-06 assets)
- "Install on your home screen" — per-browser instructions block (iOS Safari: Share → Add to Home Screen / Android Chrome: Install app banner / Desktop Chrome: address-bar install icon). [CITED: MDN PWA install UX]
- Quiet footer: © Couch + links to privacy + terms (already exist at `/privacy.html` + `/terms.html` per account-linking seed)

### SEO baseline (landing page only — app.html stays `noindex`)

Current meta in `index.html` is already solid (canonical, description, OG, Twitter cards, site_name, og:image 1200x630). Port these to `landing.html` unchanged. Add:

- **JSON-LD structured data** (inline `<script type="application/ld+json">`):
  ```json
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Couch",
    "applicationCategory": "EntertainmentApplication",
    "operatingSystem": "Web, iOS, Android",
    "description": "A movie-night app for families and friends to pick what to watch together.",
    "url": "https://couchtonight.app/",
    "image": "https://couchtonight.app/og.png",
    "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
  }
  ```
  [VERIFIED: developers.google.com/search/docs/appearance/structured-data/software-app] — do NOT add `aggregateRating` or `review` without real data (Google penalty risk). [VERIFIED: ranksightai.com/blog/software-app-schema-guide-2025]

- **App shell meta:** set `<meta name="robots" content="noindex, nofollow">` on `app.html` so search engines only index the landing page.

- **OG image:** current 1200×630 spec unchanged; regenerate to match new brand assets. Aspect ratio 1.91:1 remains standard in 2026. [VERIFIED: myogimage.com/blog/og-image-size-meta-tags-complete-guide]

- **Sitemap.xml** (optional): trivial one-URL sitemap at `/sitemap.xml`. Not required but useful for indexing signal.

### Design language for landing

**Warm cinematic + restraint** maps to:
- Hero: wordmark + tagline + CTA ONLY. Resist the urge to add feature bullets above the fold — per 2026 hero research, too many CTAs kills conversion (266% drop in some studies). [VERIFIED: landingpageflow.com]
- Below-fold sections use generous vertical spacing (--s7/--s8), full-bleed subtle gradients (`--brand-grad` at 10-15% opacity for section backgrounds)
- Motion: minimal. Hero fade-in (300ms `--ease-cinema`), scroll-reveal for below-fold (reduced-motion respected).
- Zero carousels with autoplay. Zero parallax. Zero popups. These contradict "Restraint is the principle."
- Desktop: hero can be 2-column (copy left, screenshot right), but single-column mobile-first is the primary target.

### Install-instructions block — important UX choice

**Do not ship a "Install App" button.** The PWA install UX varies across browsers and lying about it erodes trust. Instead:
- Show platform-detected instructions (iOS Safari → screenshot of Share sheet + "Add to Home Screen"; Android Chrome → "Tap the menu → Install app"; Desktop Chrome → "Click the install icon in the address bar").
- On iOS Safari specifically, when the user opens the landing page in-browser (not standalone), show a small iOS install prompt banner styled in-brand. Dismissible, appears once per session.
- For users already in the installed PWA, the landing page should auto-redirect to the app (JS-free, via `display-mode: standalone` media query + a meta refresh trick OR a tiny inline script).

## Marketing Assets

### Deliverables list

6 required + 2 optional, per App Store conventions and DESIGN-06:

| # | Asset | Dimensions | Purpose |
|---|-------|------------|---------|
| 1 | Hero screenshot — Tonight screen with visible picker + posters | 1170×2532 (iPhone 14/15 Pro reference) | App store hero + landing hero |
| 2 | Feature — Watchparty live with reactions | 1170×2532 | Shows the signature social feature |
| 3 | Feature — Mood filter active with results narrowed | 1170×2532 | Shows the Phase 3 differentiator |
| 4 | Feature — Title detail with vote grid | 1170×2532 | Shows the voting primitive |
| 5 | Feature — Year-in-Review teaser card | 1170×2532 | Shows Phase 10 deliverable (even if stub) |
| 6 | Feature — Intent flow / "Tonight at time" RSVP card | 1170×2532 | Shows Phase 8 differentiator |
| 7 (optional) | Desktop view of Watchparty live modal | 2560×1440 | Post-09-04 responsive proof |
| 8 (optional) | Invite flow — "Join the couch" redemption screen | 1170×2532 | Conversion-focused |

### Production pipeline (recommended, zero-install)

1. **Capture raw screenshots** from a real iPhone 14/15 Pro running the PWA standalone. (Or simulate in Chrome DevTools device mode at 1170×2532, but real-device captures are higher fidelity.)
2. **Crop / clean** (remove status bar timestamps, battery indicators) via any image editor or in AppScreens.
3. **Frame + caption** in **AppScreens** (appscreens.com) or **AppLaunchpad** (theapplaunchpad.com). Both are free-tier, browser-based, no account needed for initial exports. They add device frame + optional marketing copy overlay + export at App Store resolutions.
4. **Export** as PNG, 72 DPI (App Store minimum) or 144 DPI (Retina-ready).
5. **Commit** to `queuenight/public/marketing/`; wire into landing page's feature grid.
6. **Generate OG image** (1200×630) by composing the hero screenshot onto a branded background in the same tool or a one-off Figma/Canva template if the user has access.

### Tool choice rationale

[VERIFIED: neoads.tech/blog/best-appstore-screenshots-generator] AppScreens + AppLaunchpad lead free-tier offerings; Screenshots.pro leads paid with localization (overkill for v1). App Mockup is a buy-once alternative if the user wants a non-subscription model. Recommendation: **start with AppScreens free tier**, escalate only if needed.

### "Don't hand-roll" warning

Do NOT hand-build screenshot templates in HTML/CSS and screenshot them with Playwright. It's tempting (keeps everything in-repo, reproducible) but the tradeoff is weeks of CSS tuning to match what AppScreens does in 10 minutes. Save the hand-rolled approach for v2 if branded asset production becomes a recurring need.

## Onboarding

### First-run onboarding (DESIGN-07)

**Current state:** No first-run sequence exists. Users land on sign-in → family-join → name → Tonight, each screen rendering its own header. No unified introduction.

**Recommended shape: 3-step progressive disclosure with hard skip**

Trigger: signed-in + has-family + `state.me.seenOnboarding !== true`. Render as a full-screen overlay (NOT a walkthrough with tooltips on existing UI — tooltips are fragile and contradict "restraint").

**Step 1 — "What Couch does"** (15 seconds)
- Hero illustration or minimal animation (couch silhouette + poster falling in)
- Copy: "Couch turns 'what do you want to watch?' into a 30-second ritual."
- 2 buttons: "Show me how" / "Skip intro"

**Step 2 — "How picking works"** (20 seconds)
- Illustration of spin → pick → veto → re-spin flow (static; minimal motion)
- Copy: "Everyone on the couch picks. One person spins. Anyone can veto."
- 2 buttons: "Got it" / "Skip intro"

**Step 3 — "What makes it yours"** (15 seconds)
- Teases moods + watchparty + intent + notifications in a 4-grid icon row
- Copy: "Tag moods. Watch together from different rooms. Schedule movie nights. Get a ping when it starts."
- 1 primary button: "Let's go" → sets `seenOnboarding: true`, lands on Tonight.

**Key principles:**
- **Hard Skip on every step** — not buried, not styled as secondary. "Skip intro" is on every screen equal weight to primary.
- **No forced permission prompts** — push-notification opt-in lives in Settings, not here. [CITED: Nielsen Norman Group progressive disclosure guidance]
- **Dismissible forever** — once seen, never shown again. Admin "replay intro" in Settings → Account.
- **Mobile-first** — vertical stack; illustration top, copy middle, buttons bottom.
- **Use existing tokens** — all copy in Instrument Serif italic for taglines, Inter 400 for body, Inter 600 for buttons. Backgrounds use `--surface` with `.has-leather` texture.

### Why progressive disclosure, not walkthrough

Per 2026 UX research (Pendo, NN/G, IxDF): walkthroughs with tooltip sequences are high-friction, often skipped, and break when UI shifts. Progressive disclosure — revealing features inline when the user reaches them — has higher completion rates and lower abandonment. [VERIFIED: nngroup.com/articles/progressive-disclosure, ixdf.org/literature/topics/progressive-disclosure]

For Couch specifically: moods introduce themselves when the user opens Tonight (the mood filter is visible); veto introduces itself when the user taps a spin result (the veto button is visible); watchparty introduces itself when a title is picked (the Watch together CTA appears). **The 3-step onboarding's job is to set expectations about the overall product; individual features teach themselves.**

### Invite-flow onboarding (DESIGN-08)

**Current state:** Per `phase-05x-guest-invite-redemption.md`, the invite link routes a guest to the sign-in screen instead of a branded redemption flow. This is a known gap.

**Recommended shape: Single-screen redemption**

1. Guest clicks `couchtonight.app/?invite=<token>&family=<code>` (or just `?invite=<token>` per seed's security note — family code shouldn't be in unauth URL)
2. `bootstrapAuth` detects `?invite=` BEFORE sign-in gate, routes to `showInviteRedeemScreen(token)` directly
3. Screen renders:
   - Wordmark (small, top)
   - Brand hero section: "Join {family name}" with family name pre-fetched via a public-read `invites/{token}` query
   - Duration badge: "Your guest pass: 1 week" (from invite doc)
   - Single input: "Your name" (Inter 400 placeholder)
   - One CTA: "Join the couch"
   - Fine print: "Guest access expires in X days. You can vote, react, and join watchparties."
4. On submit: `consumeGuestInvite` CF creates anonymous auth session + temporary member doc, lands on Tonight with guest badge visible.
5. Expired-invite dead-end: friendly "This invite has expired — ask {owner} for a new one." NOT the sign-in screen.

**Implementation notes:**
- Reuse `.wrap.has-leather` pattern from existing join screens
- Badge color: `--accent-2` (apricot) with sage green glow for "guest" distinction
- Respects all constraints from the existing seed (CF admin SDK, anonymous auth, temporary: true member, expiresAt)

## Motion Language

### Current motion token inventory

```css
--t-quick: 150ms;
--t-base: 220ms;
--t-cinema: 400ms;
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-cinema: cubic-bezier(0.32, 0.72, 0, 1);
```

Plus `@media (prefers-reduced-motion: reduce)` block at css:95 (verify its contents — should reduce durations to 0ms or near-0).

### Recommended additions

**Duration tiers (add two):**
```css
--t-instant: 50ms;   /* purely visual feedback — hover state, active press, focus outline */
--t-deliberate: 300ms; /* transitions between major states — modal open, screen change mid-ground */
```

Final ladder: 50 → 150 → 220 → 300 → 400. Five tiers cover every context. [VERIFIED: m1.material.io/motion/duration-easing] Material Design's research supports ~50ms for touch feedback, 100-200ms for small transitions, 200-300ms for moderate transitions, 300-400ms for large scene changes.

**Easing additions:**
```css
--ease-standard: cubic-bezier(0.4, 0, 0.2, 1);   /* "material standard" — for general UI transitions */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* subtle overshoot — for celebratory moments only */
```

Total easing palette: `--ease-out` (existing), `--ease-cinema` (existing), `--ease-standard` (new), `--ease-spring` (new, use sparingly).

### Canonical micro-interaction catalog (DESIGN-09 deliverable)

Every motion in the app should be enumerated and mapped to tokens. Sample:

| Interaction | Where | Duration | Easing | Token mapping |
|-------------|-------|----------|--------|---------------|
| Toast slide-in | `.flash-toast` | 220ms | `--ease-out` | `--t-base` + `--ease-out` |
| Modal backdrop fade | `.modal-bg` | 150ms | `--ease-standard` | `--t-quick` + `--ease-standard` |
| Modal sheet slide-up | `.modal` | 300ms | `--ease-cinema` | `--t-deliberate` + `--ease-cinema` |
| Spin result flicker | `.t-spin` keyframe | 400ms | `--ease-cinema` | `--t-cinema` + `--ease-cinema` |
| Veto shimmer | `.veto-shimmer` | 400ms | `--ease-cinema` | `--t-cinema` + `--ease-cinema` |
| Watchparty banner pulse | `#wp-banner-tonight` | 220ms | `--ease-standard` | `--t-base` + `--ease-standard` |
| Button press | all `button:active` | 50ms | `--ease-out` | `--t-instant` + `--ease-out` |
| Mood chip toggle | `.mood-chip` | 150ms | `--ease-out` | `--t-quick` + `--ease-out` |
| Who-mini slide-down | `.who-mini` | 220ms | `--ease-out` | `--t-base` + `--ease-out` |
| Swipe card swipe | `.swipe-card` | 300ms | `--ease-cinema` | `--t-deliberate` + `--ease-cinema` |
| Hover lift | buttons, cards | 150ms | `--ease-standard` | `--t-quick` + `--ease-standard` |

This table lives in BRAND.md and acts as the audit checklist for DESIGN-09.

### Motion acceptance gate

- All `transition:` + `animation:` rules in css/app.css reference a duration token (no raw `150ms`, `200ms`, `300ms` literals except in reduced-motion overrides)
- All easing functions reference a token (no raw `ease`, `ease-in-out`, `cubic-bezier(…)` literals)
- `prefers-reduced-motion` block reduces every non-essential motion to ≤50ms or removes the transition entirely

## Brand Docs

### Recommended deliverable: `.planning/BRAND.md`

Single markdown file. Format modeled after GitLab Pajamas design-system docs + Radix UI documentation style (pragmatic, example-heavy, not a pitch deck). [VERIFIED: design.gitlab.com/product-foundations/design-tokens-using, designtokens.org/tr/drafts/format]

### Structure

1. **Identity** — logo usage, sizing, clear-space rules, do/don't pairing
2. **Color tokens** — primitive + semantic tables; contrast verification results; when to use each
3. **Typography tokens** — Fraunces vs Instrument Serif vs Inter usage matrix (display / headline / body / UI / voice)
4. **Spacing + radius + shadow tokens** — one-line per token with example pixel value + intended use
5. **Motion tokens** — the canonical micro-interaction catalog from the Motion section above
6. **Voice guide** — tone ("Warm · Cinematic · Lived-in. Restraint is the principle."); 10-15 example phrases (do: "Pull up a seat." / don't: "Click here to get started!"); UI copy rules (no exclamation marks except celebratory moments; italics for brand-voice taglines; sentence-case buttons, not Title-Case)
7. **Screen patterns** — the 3-tier screen pattern (hero + tab-sections + modals) with class-name references
8. **Do / don't gallery** — 8-10 visual examples showing tasteful vs drift (e.g., do: token-spaced card; don't: inline `margin:17px`)

Keep it **≤1500 words + 1-2 screenshots per section**. Long brand guides go unread — the target audience is future-Claude and the user himself.

### Typography usage matrix (sample — lives in BRAND.md)

| Context | Font | Weight | Size token | Notes |
|---------|------|--------|-----------|-------|
| Hero display (landing) | Fraunces | 800 | `--t-hero` (56px) | Rare; brand moments only |
| Tagline / voice callout | Instrument Serif italic | 400 | `--t-h3` (17px) | The "restraint is the principle" voice |
| Screen title (h1) | Fraunces | 600 | `--t-h1` (32px) | Page-level headers |
| Section heading (h2) | Instrument Serif italic | 400 | `--t-h2` (22px) | Within-screen sections |
| Sub-heading (h3) | Fraunces | 600 | `--t-h3` (17px) | Title Detail, Settings rows |
| Body | Inter | 400 | `--t-body` (15px) | All paragraphs |
| UI label / button | Inter | 500-600 | `--t-body` or `--t-meta` | Form labels, button text |
| Metadata | Inter | 400 | `--t-meta` (13px) | Timestamps, subtitles |
| Eyebrow | Inter | 600 uppercase, letter-spacing 0.12em | `--t-eyebrow` (11px) | Section prefixes |
| Micro | Inter | 400 | `--t-micro` (10px) | Captions, rare use |

**Rule of thumb:** Fraunces for confident weight (brand + display + section titles). Instrument Serif italic for voice (taglines + editorial asides). Inter for everything else (body, UI, metadata). [VERIFIED: maxibestof.one/typefaces/fraunces/pairing/inter, typewolf.com/fraunces]

**Anti-pattern:** Mixing Fraunces + Instrument Serif within the same section (e.g., Fraunces h2 + Instrument Serif subhead). They read as competing voices. Pick one per section.

## Seed absorption map

Six items accumulated this session per STATE.md. Phase 9 absorbs them as follows:

| Seed | Absorb into Phase 9? | Where | Rationale |
|------|---------------------|-------|-----------|
| `phase-05x-account-linking.md` items #6 + #7 (set-password, sign-in-vs-create UX split) | **YES** | Wave 4 (09-07), Account settings + sign-in screen polish | Pure UX polish, directly touches surfaces Phase 9 is already redesigning. Items #1-5 (provider linking) stay Phase 5.x standalone |
| `phase-05x-apple-signin.md` | **NO** | Stays standalone Phase 5.x | $99/yr dev-account cost + external config; not a redesign task |
| `phase-05x-guest-invite-redemption.md` | **YES** | Wave 4 (09-07), DESIGN-08 invite-flow onboarding | The screen IS the onboarding surface Phase 9 needs to polish; fixing it branded-from-start is cleaner than retrofit |
| `phase-05x-legacy-family-ownership-migration.md` | **YES** | Wave 4 (09-07), Account settings CTA + rules update | Account settings is already getting a visual pass; adding the self-claim CTA here lands it once, in-brand |
| `phase-07-watchparty-lifecycle-transitions.md` | **NO** | Stays Phase 7.x standalone | Behavioral/backend work (scheduled→active flip), not a redesign task. Out of scope |
| `phase-08x-intent-cf-timezone.md` | **YES, opportunistically** | Wave 4 (09-07), ~30 min trivial CF fix | Phase 9 is already touching the deploy repo for asset generation + marketing assets; bundling this small CF fix into one deploy saves a deploy cycle |

**Desktop responsive gap (Phase 7 UAT deferred here):** **YES, explicitly** — Wave 2, plan 09-04. Already called out in STATE.md as routed to Phase 9.

## Runtime State Inventory

Phase 9 is a redesign — mostly code/config changes. But a few runtime-state considerations apply:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no renames, no collection changes. `state.me.seenOnboarding` is a new field to ADD (not rename), so no migration. Legacy users will default to `undefined` which triggers the first-run sequence once (feature, not a bug). | Code edit only — add `seenOnboarding: true` set on complete or skip. |
| Live service config | **Firebase Hosting** rewrites config in `queuenight/firebase.json` must add `/` → `landing.html` + `/app` → `app.html` rewrites. Currently serves `index.html` for all routes. | Hosting config edit in sibling repo |
| OS-registered state | **PWA installed icons** cache on iOS home screen. After logo regenerates, installed iOS PWAs won't auto-update the icon. User must delete + reinstall. | Document in BRAND.md + STATE.md: "After icon change, existing PWA users need to reinstall to see new icon" |
| Secrets/env vars | None — Phase 9 doesn't touch secrets | None |
| Build artifacts | No bundler, so no build artifacts in this repo. BUT: the sibling `queuenight/public/` contains generated PNG files. After icon regen, old PNGs need to be overwritten (watch for stale 180×180 icons lingering). | Process step: before deploy, verify all PNG timestamps are recent + commit hash matches icon pipeline run |

## Common Pitfalls

### Pitfall 1: iOS PWA icon cache
**What goes wrong:** After deploying new icons, the installed iOS PWA continues showing the old icon. User thinks the icon didn't ship.
**Why:** iOS caches apple-touch-icon at install time. Neither Hosting deploys nor Safari cache-clears invalidate it.
**How to avoid:** Include a documented cache-bust procedure in BRAND.md: (1) Delete PWA from home screen, (2) Safari → Advanced → Website Data → delete couchtonight.app, (3) Reopen in Safari, (4) Re-add to Home Screen.
**Warning signs:** Deploy completes, new icon shown in browser, but old icon on home screen.

### Pitfall 2: Inline-style purge breaks dynamic UI
**What goes wrong:** Migrating `style="display:none"` → `.is-hidden` seems safe, but JS that uses `.style.display = 'block'` inline breaks if the CSS uses `!important` on the class.
**Why:** Specificity. `.is-hidden { display: none !important }` wins over inline JS.
**How to avoid:** Use class-based toggle via `.classList.toggle('is-hidden')`, not inline style mutation. Audit js/app.js for `.style.display =` patterns before the purge + migrate to classList.
**Warning signs:** A modal opens but shows nothing / a toast appears invisible after refactor.

### Pitfall 3: Desktop breakpoint regression on iPad portrait
**What goes wrong:** Set breakpoint at 768px → iPad portrait gets desktop rules → layout breaks.
**Why:** iPad portrait is 768px. 900px threshold avoids it.
**How to avoid:** Use 900px (or higher), not 768px. Test in Safari responsive design mode on iPad Air + iPad Pro.
**Warning signs:** Modals render too wide on iPad portrait, navigation wraps oddly.

### Pitfall 4: Landing page tries to use app state
**What goes wrong:** Landing page developer reaches for "check if user is signed in" to redirect. Pulls in Firebase SDK (200KB) → landing page is slow.
**Why:** Habit. Temptation to personalize.
**How to avoid:** Landing page is zero-JS OR uses `display-mode: standalone` media query trick to auto-redirect installed-PWA users. Do NOT load Firebase SDK. Do NOT load Google Fonts full axis range — use only what the landing needs (probably just Fraunces 400/600/800 + Inter 400/500/600).
**Warning signs:** Landing page Lighthouse performance score below 95.

### Pitfall 5: Onboarding + deep link collision
**What goes wrong:** Guest clicks `couchtonight.app/?invite=<token>` → lands → first-run onboarding forces 3 screens BEFORE invite redemption → guest bails.
**Why:** `state.me.seenOnboarding` check happens after sign-in. Guest sign-in via `consumeGuestInvite` creates a member with no `seenOnboarding` → onboarding fires on their first Tonight render.
**How to avoid:** Guests should skip first-run onboarding. Gate onboarding on `state.me.type !== 'guest' && !state.me.seenOnboarding`. Or set `seenOnboarding: true` at guest-creation time in CF.
**Warning signs:** Guest sees 3-step intro immediately after joining.

### Pitfall 6: Font-family inline-style purge misses Instrument Serif usages
**What goes wrong:** Grep for `font-family:'Fraunces'` inline catches 20 cases; grep for `font-family:'Instrument Serif'` inline catches 5; total says 25 but visual audit reveals more.
**Why:** Some inline styles use `font-family: 'Instrument Serif', 'Fraunces', serif` with the fallback chain — grepping just for primary font misses these. `font-style:italic` inline is an adjacent smell worth grepping.
**How to avoid:** Multi-grep: `font-family`, `font-style`, and `font-size` inline. Acceptance criteria uses the count from all three.

## Code Examples

### Example 1: Semantic token layer (add to css/app.css :root)

```css
:root {
  /* === Layer 1: primitives (existing, preserved) === */
  --bg: #14110f;
  --surface: #1c1814;
  --ink: #f5ede0;
  --accent: #e8a04a;
  /* ... all 50+ existing primitive tokens ... */

  /* === Layer 2: semantic aliases (NEW) === */
  --color-surface-base: var(--bg);
  --color-surface-raised: var(--surface);
  --color-ink-primary: var(--ink);
  --color-ink-secondary: var(--ink-warm);
  --color-accent-primary: var(--accent);
  --duration-fast: var(--t-quick);
  --duration-base: var(--t-base);
  --duration-cinema: var(--t-cinema);
  --easing-standard: var(--ease-out);
  --easing-cinematic: var(--ease-cinema);
}
```

### Example 2: Desktop breakpoint (add to css/app.css)

```css
/* ==========================================================================
   Desktop responsive — Phase 9 / DESIGN-04
   Phone-column layout stays the default. At ≥900px, modals expand.
   iOS standalone PWA never hits this breakpoint (viewport <900).
   ========================================================================== */
@media (min-width: 900px) {
  .phone-shell { max-width: 520px; }
  .tabbar { max-width: 520px; }
  .who-mini { max-width: 520px; }

  .modal { max-width: 640px; }
  .wp-live-modal { max-width: 800px; max-height: 85vh; }
  .yir-modal, .yir-story-modal { max-width: 720px; }
  .avatar-picker-modal { max-width: 540px; }
  .manual-modal { max-width: 560px; }
  .schedule-modal { max-width: 480px; }

  .wp-live-header { padding: 20px 24px; }
  .wp-live-body { padding: 20px 24px; }
  .wp-live-footer { padding: 18px 24px 20px; }
}
```

### Example 3: SoftwareApplication JSON-LD (landing.html head)

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Couch",
  "alternateName": "Couch Tonight",
  "applicationCategory": "EntertainmentApplication",
  "operatingSystem": "Web, iOS, Android",
  "description": "Couch turns 'what do you want to watch?' into a 30-second ritual everyone on the couch trusts.",
  "url": "https://couchtonight.app/",
  "image": "https://couchtonight.app/og.png",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "USD"
  }
}
</script>
```

### Example 4: First-run onboarding gate (js/app.js)

```javascript
// After auth + family bootstrap, before rendering Tonight:
function maybeShowFirstRunOnboarding() {
  if (!state.me) return;
  if (state.me.type === 'guest') return;        // skip for guests
  if (state.me.seenOnboarding === true) return; // skip for returning
  showOnboardingStep(1);
}

async function completeOnboarding() {
  hideOnboarding();
  await updateDoc(doc(membersRef, state.me.id), { seenOnboarding: true });
}
```

### Example 5: Landing page zero-JS install-redirect trick

```html
<!-- Top of landing.html — auto-redirect installed PWA users to the app -->
<script>
  // If running as standalone PWA, user has it installed — send them to the app
  if (window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true) {
    window.location.replace('/app.html' + window.location.search);
  }
</script>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Sass variables + compile step | CSS custom properties at runtime | Mature ~2020, standard ~2023 | No build step needed; runtime theming; better for no-bundler projects |
| Media queries for everything | Media queries for viewport + container queries for components | Container queries supported across browsers 2023 | Component reusability; modals still use media queries (correct) |
| Single big flat token list | Primitive + semantic + component 3-tier | Design Tokens Community Group format stabilized 2024-2025 | Decouples "what a color is" from "what it's used for" |
| apple-touch-icon at 6 sizes | apple-touch-icon at 180×180 only | iOS 7+ era (~2013-2014), reconfirmed 2025 | One file instead of six; preserve legacy sizes only for <iOS 12 support |
| Separate favicon.ico only | favicon.ico + SVG favicon + PWA manifest PNGs + Safari mask icon + dark-mode variant | ~2021-2023 | Consistent rendering across browsers + dark mode |
| Static OG image | OG image 1200×630 with JSON-LD structured data | Schema.org SoftwareApplication rich results 2024-2025 | Rich previews in iMessage/Slack/Twitter + Google rich results |
| Walkthrough tooltips for onboarding | Progressive disclosure + inline feature intro | Nielsen Norman research 2015+, reconfirmed 2024-2026 | Lower abandonment, less fragile, less annoying |

**Deprecated/outdated (avoid):**
- Manifest `icons` with `purpose: "maskable"` inline-embedded base64 images — fine but breaks easily; prefer real file URLs as the current repo does
- Multiple viewport breakpoints without container queries — overkill for a single-column app; one desktop breakpoint at 900px is enough
- `theme-color` meta tag per-page — dark-mode variant is supported in 2024+ browsers but the app is dark-only, so single `#14110f` is correct

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | User already owns the logo concept — Phase 9 regenerates assets from existing SVG, does not design a new logo | Identity | If user wants a ground-up brand refresh, Wave 1 scope doubles and a designer/brand-dev cycle is needed |
| A2 | `#14110f` is the authoritative theme color (CLAUDE.md) and the `#14110d` in css/app.css:7 is a minor drift to reconcile | Design Tokens | Low — either value is aesthetically indistinguishable; reconcile to one |
| A3 | Airbnb Cereal, Medium, Apollo are appropriate warm-cinematic brand references | Identity | Low — references only; user confirms direction |
| A4 | Guests should skip first-run onboarding | Onboarding | Low — easy to toggle; product decision |
| A5 | Landing page should be a separate HTML file (not a pre-auth render in existing index.html) | Landing | Medium — the app.html rename requires Firebase Hosting rewrite config + deep-link regression test |
| A6 | 900px is the correct desktop breakpoint threshold | Desktop Responsive | Low — iPad Portrait is a well-known 768px edge case; 900px is the conservative choice |
| A7 | No Figma license assumed — AppScreens/AppLaunchpad browser-based tools are acceptable | Marketing Assets | Low — if user has Figma, better fidelity is possible but tool is fungible |
| A8 | `state.me.seenOnboarding` is an acceptable new field (no schema migration needed for existing members) | Onboarding | Low — existing members get `undefined` which triggers onboarding once; reset path in Settings handles UX |
| A9 | Motion tokens can be expanded (add `--t-instant`, `--t-deliberate`, `--ease-standard`, `--ease-spring`) without breaking existing rules | Motion Language | Low — additions, not changes |
| A10 | Existing BRAND.md does not exist (STATE.md shows none referenced; .planning/ ls confirms only PROJECT/REQUIREMENTS/ROADMAP/STATE + subdirs) | Brand Docs | Zero — verified |
| A11 | 119 inline `style=` is the right target for "eliminate most design drift" (grep count verified) | Screen Refactor | Low — count is verified but not all 119 will migrate (some are load-time display toggles) |
| A12 | Seed `phase-08x-intent-cf-timezone.md` is ~30min and deploy-shares with Wave 4 | Seed absorption | Low — seed explicitly says ~30 min |

## Open Questions

1. **Does a canonical SVG logo source exist?**
   - What we know: PNG set exists in deploy repo; SVG not verified in this repo
   - What's unclear: whether there's a Figma/Illustrator source outside either repo
   - Recommendation: **user confirms at plan-phase**; if no SVG, Wave 1 plan 09-01 includes a sub-task to derive SVG from the existing PNG via a one-time vectorization (or accept PNG re-export and defer SVG)

2. **Is the user refreshing the wordmark concept, or just regenerating assets?**
   - Recommendation: **user confirms at plan-phase**; default assumption = regenerate only

3. **Does the user have Figma access?** (Affects marketing-asset tool choice)
   - Recommendation: **user confirms**; default = browser-based free tools

4. **Should the landing page include a blog / changelog / what's-new section?**
   - Recommendation: NO for v1; add if organic interest materializes post-launch

5. **Install-prompt UX: custom banner, browser-default, or both?**
   - Recommendation: **both** — browser-default for Chrome/Edge, custom in-brand banner for iOS Safari (since iOS has no install-prompt API)

6. **Should first-run onboarding reset on each device, or be per-account?**
   - Recommendation: per-account (Firestore-persisted on the member doc) — if reset per-device, users see it on every phone switch which is annoying

7. **What does "App-Store-ready" concretely mean when there's no App Store listing yet?**
   - Recommendation: interpret as "we'd have these if we submitted tomorrow"; produce iOS App Store + Google Play + web-card variants even though only the web version is live

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | `npx @vite-pwa/assets-generator` for icon generation | ? | ? | RealFaviconGenerator.net (browser) |
| npm/npx | Icon generation CLI | ? | ? | Browser tools |
| Modern browser (Chrome/Firefox) | AppScreens, AppLaunchpad, RealFaviconGenerator, WebAIM contrast checker | YES (implicit) | — | — |
| Canonical SVG editor (Inkscape, Illustrator, Figma) | Logo SVG maintenance | ? | ? | Manual PNG export from existing assets; SVG handoff if user has a designer |
| Access to `queuenight/public/` sibling repo | Deploy all assets + landing + CF changes | YES (implied by existing deploys) | — | N/A — blocking if missing |
| iOS device (iPhone) | Physical PWA icon + responsive layout UAT | YES (implied by Phase 5/7 UAT history) | — | Chrome DevTools device mode (degraded) |
| Physical or simulated desktop Chrome | Desktop responsive UAT | YES (implied) | — | N/A |

**Verify at plan-time:** `node --version` + `npx --version` to confirm Node is installed. If not, Wave 1 plan 09-01 uses RealFaviconGenerator.net exclusively (browser-only path).

**Missing dependencies with no fallback:** None — all paths have a browser-based alternative.

## Project Constraints (from CLAUDE.md)

- **Single-file JS architecture locked for v1:** No bundler, no build step, no webpack/vite/rollup. Plans must not introduce any compile step.
- **Firebase Hosting serves files directly** from sibling `queuenight/public/` repo. Asset deploys are two-repo operations.
- **Do not move TMDB key / Firebase config server-side:** out of scope.
- **Do not start monetization / billing / plan-tier work:** explicitly out of scope.
- **Do not renumber product phases:** Phase 9 stays Phase 9.
- **Read `.planning/PROJECT.md` and `.planning/ROADMAP.md` before proposing work:** ✓ done during research.
- **Write atomic Firestore updates; respect existing per-family nesting:** applies to onboarding state + invite redemption.
- **Test on mobile Safari (PWA + iOS home-screen use is primary surface):** applies to every plan in Phase 9.
- **Deploy by copying index.html, css/, js/ to queuenight/public/ then firebase deploy:** standard op.

## Sources

### Primary (HIGH confidence)
- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `CLAUDE.md` — project ground truth
- `css/app.css` — token + layout inventory (2104 lines read in part)
- `index.html` — screen + modal structure (986 lines read in part)
- `.planning/seeds/phase-05x-*.md`, `phase-07-*.md`, `phase-08x-*.md` — deferred items context
- [Google Fonts — Fraunces](https://fonts.google.com/specimen/Fraunces) — typography reference
- [W3C Design Tokens Format Module 2025.10](https://www.designtokens.org/tr/drafts/format/) — token hierarchy standard
- [MDN — Define your app icons (PWA)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons) — icon spec
- [Google — SoftwareApplication schema](https://developers.google.com/search/docs/appearance/structured-data/software-app) — structured data spec

### Secondary (MEDIUM confidence, verified with primary)
- [LogRocket — Container queries in 2026](https://blog.logrocket.com/container-queries-2026/) — container vs media query decision
- [Nielsen Norman Group — Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/) — onboarding UX research
- [Material Design 1 — Duration & easing](https://m1.material.io/motion/duration-easing.html) — motion tier baselines
- [CSS-Tricks — What are design tokens?](https://css-tricks.com/what-are-design-tokens/) — token concepts
- [Penpot blog — Developer's guide to design tokens](https://penpot.app/blog/the-developers-guide-to-design-tokens-and-css-variables/) — CSS custom properties at runtime
- [Typewolf — Fraunces](https://www.typewolf.com/fraunces) — type pairing examples
- [Coywolf — PWA icons across platforms](https://coywolf.com/guides/how-to-create-pwa-icons-that-look-correct-on-all-platforms-and-devices/) — iOS apple-touch-icon behavior
- [LogoFoundry — PWA icon safe areas](https://logofoundry.app/blog/pwa-icon-requirements-safe-areas) — icon padding/shape rules
- [Imagcon — PWA icon sizes 2026](https://imagcon.app/pwa-icon-sizes/) — current size matrix
- [AppScreens](https://appscreens.com/), [AppLaunchpad](https://theapplaunchpad.com/) — screenshot tooling
- [myogimage.com — OG image size guide 2026](https://myogimage.com/blog/og-image-size-meta-tags-complete-guide) — 1200×630 canonical
- [LandingPageFlow — CTA placement 2026](https://www.landingpageflow.com/post/best-cta-placement-strategies-for-landing-pages) — hero CTA research
- [RealFaviconGenerator](https://realfavicongenerator.net) — icon pipeline
- [Vite PWA assets-generator](https://vite-pwa-org.netlify.app/assets-generator/) — SVG→icon CLI

### Tertiary (LOW confidence — reference only, not load-bearing)
- Specific typography pairing references (Airbnb, Medium, Apollo) are training-data assumptions flagged as [ASSUMED] in-line; user should validate brand direction rather than inherit these
- Exact duration-tier values (50/150/220/300/400) are partially inherited from Material Design + partially chosen by feel; Motion Language section flags these for iteration

## Metadata

**Confidence breakdown:**
- Scope + sequencing: HIGH — based on verified inventory of existing code + seed list
- Token hierarchy: HIGH — industry-standard pattern + existing tokens cover 90%
- Desktop responsive fix: HIGH — root cause identified (single line), fix is minimal
- Landing page architecture: MEDIUM-HIGH — strong precedent for separate HTML file; user may prefer single-file
- Marketing asset pipeline: MEDIUM — tools verified but user's exact tool preference unknown
- Onboarding shape: MEDIUM — 3-step with skip is backed by NN/G research but exact copy/illustrations need design iteration
- Motion language: MEDIUM — tiers backed by Material Design but project-specific tuning may differ
- Brand docs format: HIGH — standard deliverable

**Research date:** 2026-04-21
**Valid until:** 2026-05-21 (30 days — stable domain, unlikely to shift in a month)

## Recommended plan count + wave structure

**4 waves, 7 plans (split one if needed → 8):**

- **W1 Identity + Tokens** (2 plans): 09-01 Identity pipeline, 09-02 Token canonicalization
- **W2 Screens + Responsive** (2 plans): 09-03 Inline-style purge, 09-04 Desktop responsive + watchparty modal fix
- **W3 Landing + Marketing** (2 plans): 09-05 Landing page, 09-06 Marketing assets + SEO
- **W4 Onboarding + Motion + Docs + Seed Absorption** (1 plan, split into 2 if fat): 09-07 First-run + invite redemption + motion audit + BRAND.md + polish-item absorption

Each wave produces an independently-deployable milestone. Inter-wave dependencies are one-way (W1 → W2 → W3 → W4), so no parallel execution within waves is needed, but tasks within a plan can parallelize where the planner sees fit.
