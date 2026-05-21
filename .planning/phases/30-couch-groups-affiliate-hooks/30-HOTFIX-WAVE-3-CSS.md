# Phase 30 — Hotfix Wave 3 (CSS slice: G-P1-3)

**Date:** 2026-05-03
**Scope:** WCAG 2.1 AA contrast remediation for `--ink-dim` token

## G-P1-3: `--ink-dim` failed WCAG 2.1 AA for normal text

### Problem

`css/app.css` declared `--ink-dim` at `#847868`, with the in-file accessibility
comment block self-documenting that the token only cleared "≥ 4.0:1 (passes AA
only for LARGE text; use sparingly)." This is a real WCAG 2.1 AA failure for
normal-text body copy (which requires ≥ 4.5:1) and shipped despite the
documented warning, because downstream rules adopted `--ink-dim` for body-tier
metadata.

Computed contrast (sRGB relative luminance, WCAG formula) confirmed:

- OLD `#847868` on `--bg #14110f` → **4.358:1** (FAILS AA normal text)

### Fix

Bumped `--ink-dim` warm-grey value to clear 4.5:1 while preserving the
warm-yellow-grey hue family (no dramatic shift toward neutral grey).

- NEW `#928777` on `--bg #14110f` → **5.331:1** (PASSES AA normal text; AAA-LARGE-eligible)

The +14 lift on each channel keeps the warm-dim aesthetic intact: the value
moves slightly up the L axis without rotating hue. Side-by-side, body
metadata reads with the same "recedes-but-legible" feel; readability simply
clears the spec.

Comment block at line 26 was rewritten from:

> --ink-dim (#847868) on --bg → ≥ 4.0:1 (passes AA only for LARGE text; use sparingly)

to:

> --ink-dim (#928777) on --bg → ≥ 4.5:1 (passes WCAG 2.1 AA for normal text — Wave 3 hotfix G-P1-3 lifted from 4.0:1)

### Verification

- `npm run smoke` → 62 passed / 0 failed (groups suite) + 11 passed / 0 failed (parse suite). CSS token change does not affect smoke contracts (smoke gates target JS module structure + DOM hooks, not visual tokens).
- WCAG ratio recomputed via sRGB linearization + relative luminance formula. Result clears the 4.5:1 normal-text threshold with ~18% margin.
- Hue family preserved: warm-yellow-grey lift, no shift toward cool-grey.

### Files touched

- `css/app.css` — line 26 (comment), line 41 (token value)

### Commit

`fix(a11y): lift --ink-dim contrast to 4.5:1 for WCAG 2.1 AA body-text compliance (G-P1-3)`
