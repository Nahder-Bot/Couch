---
phase: 09-redesign-brand-marketing-surface
plan: 02
subsystem: ui
tags: [design-tokens, css-custom-properties, typography, motion, wcag]

# Dependency graph
requires:
  - phase: 09-redesign-brand-marketing-surface
    provides: "Plan 09-01 (identity pipeline) — partial-complete (vectorize-defer); token work is independent of logo assets so 09-02 proceeded unblocked"
provides:
  - "3-tier token hierarchy in css/app.css :root: primitive (preserved) → semantic aliases (new) → component-scoped (declared in future plans)"
  - "Semantic color aliases: --color-surface-*, --color-ink-*, --color-accent-*, --color-feedback-*, --color-border-* (18 tokens)"
  - "Semantic spacing aliases: --space-inline-*, --space-stack-*, --space-section, --space-page (9 tokens)"
  - "Semantic typography aliases: --text-display-*, --text-heading-*, --text-body-*, --text-eyebrow, --text-micro (8 tokens)"
  - "Font-family role tokens: --font-display (Fraunces), --font-serif (Instrument Serif), --font-sans (Inter) — closes DESIGN-03 token prereq for plan 09-03"
  - "5-tier motion duration ladder: --t-instant (50ms) + --t-quick (150ms preserved) + --t-base (220ms preserved) + --t-deliberate (300ms) + --t-cinema (400ms preserved)"
  - "4-token easing palette: --ease-out + --ease-cinema (preserved) + --ease-standard + --ease-spring (new)"
  - "Semantic motion aliases: --duration-instant/fast/base/deliberate/cinema, --easing-standard/out/cinema/spring"
  - "Reconciled palette drift: css/app.css --bg is now #14110f (matches manifest + theme-color + CLAUDE.md canon)"
  - "WCAG-AA contrast reference comment block in :root header for --ink / --ink-warm / --ink-dim / --ink-faint on --bg"
affects: [09-03-inline-style-purge, 09-04-desktop-responsive, 09-05-landing-page, 09-07a-onboarding, 09-07b-motion-audit, 10-year-in-review]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "3-tier token hierarchy (primitive → semantic → component) in a single :root block"
    - "Semantic aliases var() into primitives rather than duplicating raw values — single source of truth preserved"
    - "Font-family tokens by role (display/serif/sans) so future class rules reference typeface intent not string literal"
    - "Motion tier ladder (instant/quick/base/deliberate/cinema) + 4-token easing palette — complete semantic motion vocabulary"

key-files:
  created: []
  modified:
    - "css/app.css — :root block extended from ~90 lines to ~172 lines with semantic-alias + motion + font-family + WCAG header documentation"

key-decisions:
  - "Preserve ALL existing primitive short names (--bg, --s4, --accent, --t-body, etc.). Zero renames. Semantic aliases layer on top via var() chain."
  - "Keep font-family tokens as distinct role-based trio (--font-display/serif/sans) rather than one monolithic stack so plan 09-03 classes reference role, not font list."
  - "Skip @property typed-token declarations (research-recommended deferral). Native CSS custom properties suffice for v1; no cascade-layer complexity."
  - "WCAG-AA contrast notes are research-derived approximate values. Formal WebAIM audit deferred to plan 09-07a (BRAND.md)."
  - "Split into 3 atomic commits (reconcile / alias-layer / docs) per plan commit_strategy so future bisect can narrow blame precisely if a downstream token-alias regression surfaces."

patterns-established:
  - "Token layering convention: Layer 1 primitives (raw values) → Layer 2 semantic aliases (intent-by-role via var() chain) → Layer 3 component tokens (declared inside component selectors, NOT :root) — adoption happens in 09-03+"
  - "Font-family role token naming: --font-{role} where role is display/serif/sans, not --font-{family-name}. Future class rules reference the role."
  - "Motion vocabulary: duration + easing tokens both have primitive + semantic alias forms; downstream rules can pick either tier based on how much intent they want to express"

requirements-completed: [DESIGN-02, DESIGN-03, DESIGN-09]

# Metrics
duration: ~2.5min
completed: 2026-04-22
---

# Phase 9 Plan 2: Token Canonicalization Summary

**3-tier token hierarchy (primitive + semantic + component) added to css/app.css :root with font-family role tokens, extended motion ladder, and reconciled --bg palette drift — zero runtime behavior change, all existing var() references preserved.**

## Performance

- **Duration:** ~2.5 min
- **Started:** 2026-04-22T05:43:19Z
- **Completed:** 2026-04-22T05:45:44Z
- **Tasks:** 3
- **Files modified:** 1 (css/app.css) + 1 deploy mirror (queuenight/public/css/app.css)

## Accomplishments

- **Palette drift eliminated:** css/app.css:7 `--bg:#14110d` → `--bg:#14110f` now matches manifest inline URL + meta theme-color + CLAUDE.md canonical spec. Browser tab chrome, iOS status bar, and web content background all render against identical color now.
- **Semantic alias layer:** 44 new tokens (--color-*, --space-*, --text-*, --duration-*, --easing-*, --font-*) var() into preserved primitives — downstream rules can express intent ("--color-ink-primary") rather than value ("--ink").
- **Motion ladder complete:** 5-tier duration ladder (--t-instant/quick/base/deliberate/cinema at 50/150/220/300/400 ms) + 4-token easing palette (--ease-out + --ease-cinema preserved + --ease-standard + --ease-spring added).
- **Font-family role tokens:** --font-display (Fraunces), --font-serif (Instrument Serif), --font-sans (Inter) — closes DESIGN-03 token prerequisite. Plan 09-03's inline-style purge can now migrate typeface declarations to tokens instead of repeating the string literals.
- **3-tier hierarchy documentation:** :root header extended with Layer 1/2/3 explanation + WCAG-AA contrast reference for --ink family on --bg.
- **Deployed to production:** queuenight-84044.web.app — 47 files, release complete.

## Task Commits

Each task committed atomically per plan commit_strategy:

1. **Task 1: Reconcile --bg palette drift (#14110d → #14110f)** — `790e5cf` (fix)
2. **Task 2: Add 3-tier semantic alias layer + motion token additions + font-family tokens** — `5ad9ea3` (feat)
3. **Task 3: Document 3-tier hierarchy in :root header comment + WCAG contrast notes** — `0d7262a` (docs)

_Plan metadata commit follows after SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md updates._

## Files Created/Modified

- `css/app.css` — :root block extended from ~90 lines to ~172 lines. Added semantic-alias layer (18 color + 9 spacing + 8 typography + 3 font-family + 9 motion-alias tokens), motion additions (--t-instant, --t-deliberate, --ease-standard, --ease-spring), and header docstring documenting the 3-tier system + WCAG-AA contrast notes. All existing primitive tokens and backward-compat aliases preserved verbatim. No rule bodies outside :root touched.
- `C:/Users/nahde/queuenight/public/css/app.css` — sibling deploy mirror; copied verbatim from source after Task 3 commit, then `firebase deploy --only hosting` succeeded.

## Decisions Made

- **Preserve every existing primitive name** (--bg, --s4, --accent, --t-body, --ease-out, etc.). Zero renames. All 2000+ existing `var(--primitive)` references in css/app.css rules continue to resolve identically. Semantic aliases var() INTO primitives (second resolution layer) — additive by design.
- **Font-family tokens added as distinct role-based trio** (--font-display / --font-serif / --font-sans) per Minor-8 checker feedback. Plan 09-03's new classes (.page-tagline / .text-fraunces / .text-serif-italic) will reference `font-family: var(--font-display)` instead of repeating `'Fraunces', serif`.
- **Skip @property typed declarations** per research recommendation. Pure CSS custom properties handle the cascade. Zero build-step complexity added — stays consistent with project's no-bundler invariant.
- **3-commit structure** keeps git bisect blame narrow: fix commit touches 1 character, feat commit adds alias lines (additive, no rule changes), docs commit modifies comments only. Any future token-alias regression can be isolated to exactly one of the three commits.
- **WCAG-AA contrast values are approximate** (research-derived from palette). Formal WebAIM audit with screenshots belongs in plan 09-07a (BRAND.md); this commit documents directional guidance so component authors know which ink tokens are safe for body copy vs decorative use.

## Deviations from Plan

None — plan executed exactly as written. Three tasks landed as specified in their plan bodies, with the exact token block and comment text from the plan's <action> sections. Verification greps + Node one-liner all passed on first run. No Rule 1/2/3 auto-fixes triggered; no Rule 4 architectural decisions surfaced.

## Issues Encountered

None. Three deterministic mechanical edits on a single file.

One non-issue observation: PreToolUse hooks emitted `READ-BEFORE-EDIT REMINDER` messages on Edit calls 2 and 3. The file had already been read in-session (lines 1-100 covered the edit region), and the edits succeeded. Hook warnings are non-blocking; continued per runtime's reported success.

## User Setup Required

None — no external service configuration required. Purely CSS-layer work.

## Verification Results

End-of-plan grep acceptance (all PASS):

| Check | Expected | Actual |
|-------|----------|--------|
| `#14110d` count | 0 | 0 |
| `#14110f` count | ≥ 1 | 12 |
| `--color-surface-base` | ≥ 1 | 1 |
| `--space-inline-md` | ≥ 1 | 1 |
| `--duration-deliberate` | ≥ 1 | 1 |
| `--t-instant` | ≥ 1 | 2 |
| `--ease-spring` | ≥ 1 | 2 |
| `--font-display` | ≥ 1 | 2 |
| `--font-serif` | ≥ 1 | 2 |
| `--font-sans` | ≥ 1 | 2 |
| Primitive `var(--bg)` preserved | ≥ 74 (baseline) | 75 (+1 from new alias) |
| Primitive `var(--s4)` preserved | ≥ 84 (baseline) | 85 (+1 from new alias) |
| Primitive `var(--accent)` preserved | ≥ 155 (baseline) | 156 (+1 from new alias) |
| Primitive `var(--t-body)` preserved | ≥ baseline | 77 |
| Primitive `var(--ease-out)` preserved | ≥ baseline | 2 |
| `:root{` count | exactly 1 | 1 |
| Node var() resolve check | ok | "ok: all required tokens present" |

Deploy:
- Copied source → queuenight/public/css/app.css (diff -q: IDENTICAL)
- `firebase deploy --only hosting`: 47 files uploaded, release complete, hosting URL queuenight-84044.web.app

Visual smoke: No visible change expected since aliases resolve to identical computed values and the single 1-character hex swap is a ~1% luminance delta (imperceptible). Primary user will confirm on next visit.

## Next Phase Readiness

- **Plan 09-03 (Inline-Style Purge) UNBLOCKED:** New classes (.page-tagline, .text-fraunces, .text-serif-italic) can now reference `var(--font-display)` / `var(--font-serif)` / `var(--font-sans)` instead of repeating typeface strings. Semantic color + spacing + typography aliases available for replacement of inline style= attributes.
- **Plan 09-04 (Desktop Responsive) UNBLOCKED:** Layer 3 component-token pattern documented in :root header comment; .phone-shell wrapper + @media 900px block can declare component-scoped tokens like `--wp-modal-max-width` on specific selectors without polluting :root.
- **Plan 09-07b (Motion Audit) UNBLOCKED:** 5-tier duration + 4-token easing vocabulary now complete; motion audit can replace raw millisecond values in rule bodies with semantic `var(--duration-*)` / `var(--easing-*)` references.

### Threat Flags

None introduced. This is a pure token-layer refactor; zero new endpoints, auth paths, file access patterns, or schema surfaces. Threat register T-09-02-01 through T-09-02-05 dispositions held (all either `mitigate` with verify-time checks that PASSED, or `accept` with documented rationale).

### Known Stubs

None. No placeholder text, empty data, or TODO markers introduced.

## Self-Check: PASSED

- css/app.css modified (verified: 179674 chars, 12 `#14110f` matches, 1 `:root{` block, all required semantic + font-family + motion tokens present)
- Three task commits on master: 790e5cf, 5ad9ea3, 0d7262a (verified via `git log --oneline` — see Task Commits section)
- Deploy mirror at C:/Users/nahde/queuenight/public/css/app.css identical to source (verified via `diff -q`)
- Firebase hosting deploy complete (release finalized for queuenight-84044.web.app)

---
*Phase: 09-redesign-brand-marketing-surface*
*Completed: 2026-04-22*
