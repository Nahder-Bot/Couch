# Sketch Manifest

## Design Direction

Phase 14 (Decision Ritual Core) sketches. Anchored to Couch's existing brand: warm-dark cinematic palette (`#14110f` base), Fraunces display + Instrument Serif accents + Inter sans, "Warm · Cinematic · Lived-in. Restraint is the principle." Brand moments get theatrical treatment; everything else recedes.

Sketches explore the central object on the Tonight tab — the visualization that shows who's on the couch tonight + lets members tap to claim a seat. Capacity target: 8-10 family members.

**Outcome (sketch 001):** After exploring 9 hand-coded SVG variants across 5 paradigms, the winning direction is to **use Couch's existing app icon as a hero/brand element + render a clean avatar grid below.** Splits brand-art (the icon) from functional UI (the grid), mirroring Netflix profile selector / Disney+ GroupWatch / Zoom gallery patterns. Drops the original D-06 ambition to procedurally generate an inline-SVG sofa.

## Reference Points

- **Couch brand spec:** `./CLAUDE.md` (Fraunces + Instrument Serif + Inter; warm dark palette; brand moments theatrical, otherwise recede)
- **Phase 14 design contract:** `.planning/phases/14-decision-ritual-core/14-CONTEXT.md` D-06 (couch viz, adaptive 2-8 cushions, overflow at 8)
- **Phase 14 research:** `.planning/phases/14-decision-ritual-core/14-RESEARCH.md` §4 (SVG sofa rendering approaches, iOS Safari constraints, viewBox guidance)

## Material Decisions

| Decision | Direction | Locked at |
|----------|-----------|-----------|
| Avatar style | Circle portraits (initial-letter fallback per `memberColor()`) | Sketch 001 intake |
| Brand hero | Reuse existing app icon (`/mark-512.png` in production) instead of hand-drawing a new sofa | Sketch 001 winner (P) |
| Functional UI pattern | 5×2 avatar grid with empty-slot ＋ glow (per Netflix / Disney+ / Zoom precedent) | Sketch 001 winner (P) |
| Capacity | 1-10 members native, no overflow cushion needed | Sketch 001 winner (P) |
| Production icon swap | Reference `/mark-512.png` directly — auto-propagates when icon updates | Sketch 001 winner (P) |

## Sketches

| # | Name | Design Question | Winner | Tags |
|---|------|----------------|--------|------|
| 001 | couch-shape | What visual best represents 'who's on the couch tonight' for up to 10 members in Couch's warm-dark brand? | **P** (Hero icon + avatar grid) | phase-14, d-06, hero-icon, avatar-grid |
| 002 | couch-wordmark | How should the existing C-icon combine with a wordmark to form a complete brand lockup? | ⏸ **Superseded by Fiverr brand design** (Standard $85, ETA 2026-04-28) | brand, wordmark, lockup, superseded |

## Pending External Deliverables

| Item | Source | ETA | Status | Action when delivered |
|------|--------|-----|--------|------------------------|
| Brand identity (icon + wordmark + lockup + source files) | Fiverr Standard ($85) | 2026-04-28 | In flight | Replace `app-icon.png` in sketch 001 + production `mark-*.png` set in `queuenight/public/`; capture wordmark spec into project brand docs |
