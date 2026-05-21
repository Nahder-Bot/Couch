---
sketch: 001
name: couch-shape
question: "What visual best represents 'who's on the couch tonight' for up to 10 members in Couch's warm-dark brand?"
winner: "P"
tags: [phase-14, d-06, tonight-tab, hero-icon, avatar-grid, brown]
phase: 14-decision-ritual-core
locked-decisions: [D-06]
---

# Sketch 001: Couch Shape

## Outcome — Winner: Variant P (Hero icon + avatar grid) ★

After exploring 9 hand-coded SVG variants across 5 paradigms (front-view leather A/B/C → overhead C-sectional D/E/F → plump illustrated G/H/J → big U-pit + whole room K/L → movie-night POV + room-fixed M/N → hero+grid P / stylized flat Q), the winning direction is:

**Use Couch's existing app icon as a hero/brand element + render "On the couch tonight" as a clean avatar grid below.**

This honors the constraint that hand-coded SVG can't match the photographic/3D-rendered quality of the app icon. Splits brand-art (the icon, designer/AI made) from functional UI (the avatar grid, code-driven). Mirrors what Netflix profile selector / Disney+ GroupWatch / Zoom gallery already do.

## Design Question

What visual treatment best represents "who's on the couch tonight" — a recognizable, fun, inviting representation that scales to 8-10 family members — given Couch's warm-dark brand and the existing app icon as the brand vocabulary?

## Direction (final)

- **Hero element:** existing app icon (`app-icon.png` in this folder; production = `/mark-512.png`)
- **Functional element:** 5×2 avatar grid (filled = seated member with name, empty = dashed amber circle with ＋ that pulses)
- **Brand alignment:** Couch warm-dark palette (`#14110f` base), Fraunces display + Inter sans, "warm · cinematic · lived-in. Restraint is the principle."
- **Scales to:** 1-10 members natively; grid wraps cleanly on phone; no overflow cushion needed.

## Icon swap (when you update the app icon)

The sketch references the icon by simple filename:

```html
<img src="app-icon.png" alt="Couch app icon" />
```

To preview a new icon in this sketch:
1. Replace `app-icon.png` in this folder (`.planning/sketches/001-couch-shape/`) with the new file
2. Reload the sketch HTML — the hero updates immediately

**For the production Tonight tab implementation (Phase 14 plan-04):** reference the production icon path (`/mark-512.png`) directly. Updating your real app icon (which already lives at `queuenight/public/mark-{N}.png`) will auto-propagate to the Tonight tab visualization with zero code change. No swap step needed in production.

## How to View

```
open .planning/sketches/001-couch-shape/index.html
```

Or open the self-contained version on Desktop:

```
C:\Users\nahde\OneDrive\Desktop\couch-sketch\sketch-INTERACTIVE.html
```

## Active Variants

- **P: Hero icon + avatar grid ★ (winner)** — App icon as hero card, "On the couch tonight" headline + sub-count, 5×2 avatar grid below. Empty slots = dashed amber circle with ＋, pulse animation. Filled slots = colored circle + name beneath. Tap any empty slot to claim.
- **Q: Stylized flat couch (alternate)** — Hand-drawn flat couch illustration (front-elevation, single brown fill, bold strokes, cream catch-light). 3 cushions on couch + chip row below for "+N on the floor / chairs" overflow. Kept available as a fallback if hero-icon-as-PNG ever feels static.

## Superseded Directions (preserved in git history)

- **A/B/C** — Front-view leather couches (chesterfield / mid-century / banquette). Looked too photoreal; my SVG fidelity didn't match expectation.
- **D/E/F** — Overhead C-sectional, three styles. Didn't read as a couch in pure top-down.
- **G/H/J** — Plump cartoon front-view + plump overhead. Couldn't scale beyond 3 cushions for 8-10 capacity.
- **K/L** — Big U-pit (3/4 isometric) + whole room. K's perspective failed; L had orientation problems (cushions facing away from TV).
- **M/N** — Movie-night POV + whole room with orientation fixed. Closer but still "developer art" quality.

## Implementation Notes (for Phase 14 plan-04)

This sketch supersedes the original D-06 plan to build a procedural inline-SVG `renderCouchSvg(seatCount)`. The actual implementation should be:

1. **Hero icon element** at top of Tonight tab — `<img src="/mark-512.png">` with `border-radius`, `box-shadow`, `aspect-ratio:1`, max-width ~280px on phone
2. **Headline** "On the couch tonight" + dynamic sub-count "Tap an empty seat to join · {N} of {couchSize} here"
3. **Avatar grid** — CSS Grid 5×2 (or wrap-on-mobile), each cell is either:
   - Filled: `<div class="seat-avatar">` colored by `memberColor()` + initial; name beneath
   - Empty: `<div class="seat-empty">＋</div>` with dashed border + pulse animation, `onclick=claimCushion(idx)`
4. **Update `js/app.js` `renderCouchViz()`** (new function) instead of the planned `renderCouchSvg()` — no SVG path generation needed.
5. **Touch targets** — Each grid cell ≥44×44pt at iPhone-SE width (375px ÷ 5 cols = 75px wide; meets HIG).
6. **Adaptive seat count** — D-06's 2-8 cap can become 2-10 since the grid handles it natively.

This significantly simplifies plan 14-04 — removes inline SVG complexity, removes per-cushion event binding pattern, removes iOS SVG-image caching concerns. The hero asset reuses production-pipeline icons.

## Status

✓ Winner locked: P (Hero icon + avatar grid). Alternate Q kept available.
✓ Icon swap point documented (replace `app-icon.png` in this folder)
✓ Phase 14 plan-04 should be revised to drop the procedural SVG renderer in favor of the hero-icon + avatar-grid pattern.
