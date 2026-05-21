---
phase: 31-marketing-refresh
plan: 03
subsystem: marketing/og-image
tags: [marketing, og-image, branding, sharp, svg, leather-texture]
requirements: [MARK-31-09, MARK-31-10]
dependency_graph:
  requires:
    - logo-h300.png (Couch wordmark master, embedded as base64 in SVG)
    - .planning/BRAND.md (color tokens + typography + clear-space rules)
    - .planning/phases/31-marketing-refresh/31-CONTEXT.md (D-17, D-23 lock)
  provides:
    - brand/og-source.svg (editable source-of-truth for og.png regeneration)
    - og.png (1200x630 social-share image at repo root)
  affects:
    - Plan 31-04 (consumes og.png; wires OG meta refs in landing.html / changelog.html / rsvp.html with ?v=2 cache-bust + extends deploy.sh mirror loop)
    - Phase 17 (App Store) — same SVG source can re-rasterize at 1024x1024 / 2048x1170 etc.
tech_stack:
  added:
    - sharp (isolated to C:/Users/nahde/AppData/Local/Temp/img-opt — NOT added to repo package.json; CLAUDE.md no-bundlers rule honored)
  patterns:
    - SVG-source-of-truth + sharp PNG render (round-trippable, deterministic)
    - librsvg comment-sanitization (no -- inside <!-- ... --> per strict XML)
    - Self-contained SVG via base64-embedded <image href="data:image/png;base64,...">
key_files:
  created:
    - brand/og-source.svg (287051 bytes / 280 KB — includes 283032-char base64 logo payload)
    - og.png (67392 bytes / 66 KB — 1200x630 PNG palette mode, 8-bit colormap, non-interlaced)
  modified: []
decisions:
  - "Used stop-opacity attributes instead of rgba() in stop-color (librsvg compatibility — Rule 1 fix during Task 1)"
  - "Sanitized 4 XML comments containing '--token-name' references (librsvg strict-XML rejects double-hyphens inside comments — Rule 3 fix during Task 2)"
  - "Embedded logo-h300.png as base64 data URI rather than external href (self-contained SVG — survives third-party scraper fetch contexts)"
  - "Render command uses palette: true + compressionLevel: 9 — produces 66 KB output, 67% under the 200 KB plan ceiling"
metrics:
  duration_seconds: 242
  duration_human: "4m 2s"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 0
  commits: 2
  completed_date: "2026-05-11"
---

# Phase 31 Plan 03: og.png Refresh Summary

**One-liner:** Authored the editable SVG source-of-truth `brand/og-source.svg` and rendered the new 1200×630 `og.png` (66 KB, palette PNG) via sharp — replaces the pre-Phase-9 placeholder with a leather-textured composition carrying the locked D-17 hero copy, Couch wordmark, and footer URL, all driven by a round-trippable single-file source.

## What Shipped

### `brand/og-source.svg` (Task 1, commit `b0a7754`)

A hand-authored 1200×630 SVG containing:

| Layer | Content                                                                                      | Token / spec                                     |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1     | Vertical leather-tone gradient                                                               | `#1c1814` → `#14110f` → `#0e0a07` (--surface → --bg → --bg-deep) |
| 2     | feTurbulence leather-grain noise overlay                                                     | matches `css/landing.css:20` body::before pattern |
| 3     | Radial vignette                                                                              | warm amber center / dark edges                   |
| 4     | Thin amber accent rule (78×3 px, x=120 y=438)                                                | `fill="url(#brand-grad)"` (--brand-grad)         |
| 5     | Couch wordmark, 380×180 at (110, 80)                                                         | base64-embedded `logo-h300.png` (283 K char payload) |
| 6     | Hero clause 1 "Decide what to watch in 30 seconds." at (120, 345)                            | Fraunces 800 / 64px / `#f5ede0` (--ink)          |
| 7     | Hero clause 2 "Watch together." at (120, 420)                                                | Instrument Serif italic / 56px / `#e8a04a` (--accent) |
| 8     | Footer "couchtonight.app" at (1080, 585), text-anchor=end                                    | Inter 500 / 22px / `#c9bca8` (--ink-warm)        |

All font families ship with explicit fallbacks (`'Fraunces','Times New Roman',serif` etc.) so librsvg renders cleanly when Google Fonts is unreachable at render time.

### `og.png` (Task 2, commit `21f5746`)

Rendered from `brand/og-source.svg` via:

```bash
node -e '
const sharp = require("C:/Users/nahde/AppData/Local/Temp/img-opt/node_modules/sharp");
const fs = require("fs");
const svgBuffer = fs.readFileSync("brand/og-source.svg");
sharp(svgBuffer, { density: 144 })
  .resize({ width: 1200, height: 630, fit: "fill" })
  .png({ palette: true, compressionLevel: 9, quality: 80 })
  .toFile("og.png");
'
```

| Spec        | Result                                              |
| ----------- | --------------------------------------------------- |
| Dimensions  | **1200 × 630** (exact; verified via sharp metadata) |
| Format      | PNG, 8-bit colormap (palette mode), non-interlaced  |
| File size   | **67392 bytes** (66 KB) — 67% under the 200 KB plan ceiling |
| Round-trip  | sha256-byte-identical across rm + re-render (D-23 source-of-truth claim verified) |
| Repo dep    | sharp lives in `C:/Users/nahde/AppData/Local/Temp/img-opt` — `package.json` unchanged |

## must_haves Status (from plan frontmatter)

| Truth                                                                        | Status |
| ---------------------------------------------------------------------------- | ------ |
| `brand/og-source.svg` exists at 1200×630 with leather bg + hero text + wordmark | ✓ PASS |
| `og.png` exists at repo root, 1200×630, ≤ 200KB, rendered FROM SVG via sharp    | ✓ PASS (67392 / 204800 bytes; 33% of budget) |
| SVG round-trippable via sharp re-run (no Photoshop/Figma dep)                   | ✓ PASS (sha256 byte-identical regen verified) |
| BRAND.md leather palette honored; no pure white (max --ink #f5ede0)             | ✓ PASS (verified `#14110f`, `#1c1814`, `#0e0a07`, `#e8a04a`, `#f5ede0`, `#c9bca8` all present; no `#fff` / `#ffffff` / `white`) |
| Full visual refresh per D-23 (replaces pre-Phase-9 placeholder)                 | ✓ PASS (new SVG-driven asset; pre-Phase-9 og.png was missing entirely from repo root pre-commit) |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Switched stop-color rgba() to stop-opacity attribute**
- **Found during:** Task 1 (initial Write of `brand/og-source.svg`)
- **Issue:** Plan template used `stop-color="rgba(232,160,74,0.08)"` for the radial vignette. librsvg/sharp's SVG renderer (some versions) does not reliably parse `rgba()` inside `stop-color` — it requires hex/named colors plus a separate `stop-opacity` attribute per the SVG 1.1 spec.
- **Fix:** Rewrote vignette stops to use `stop-color="#e8a04a" stop-opacity="0.08"` (etc.) — semantically equivalent, spec-compliant, librsvg-renders-correctly.
- **Files modified:** `brand/og-source.svg` (defs `<radialGradient id="vignette">` block)
- **Commit:** `b0a7754`

**2. [Rule 3 — Blocking] Sanitized "--" sequences inside XML comments**
- **Found during:** Task 2 (first sharp render attempt)
- **Issue:** sharp threw `glib: XML parse error: Double hyphen within comment`. The plan's SVG template included 4 comments referencing CSS-var token names like `--brand-grad`, `--ink`, `--accent`, `--ink-warm` — the XML 1.0 spec forbids `--` inside `<!-- ... -->`.
- **Fix:** Rewrote the affected comment lines to drop the CSS-var prefix (e.g. "matches brand-grad token in css/landing.css:15" instead of "matches --brand-grad in css/landing.css:15"). Underlying fill values (which use hex codes, not CSS vars) are unaffected.
- **Files modified:** `brand/og-source.svg` (4 comment lines)
- **Commit:** `21f5746`

**3. [Rule 3 — Blocking] Reinstalled sharp at the temp dir**
- **Found during:** Task 2 (first sharp require attempt)
- **Issue:** Pre-existing `C:/Users/nahde/AppData/Local/Temp/img-opt/node_modules/sharp` was a corrupted/partial install — empty `lib/` and `src/`, no `package.json`. Likely truncated from a prior session.
- **Fix:** Removed the `img-opt` dir, re-`npm init -y`, re-`npm install sharp` (no version pin — latest stable from npm registry). Took ~30 s. No repo-level dependency added — install stayed isolated to the system temp dir per CLAUDE.md "no bundlers / build step" + plan §3 sharp-install pattern.
- **Files modified:** none in repo
- **Commit:** none required (out-of-repo fix)

### Auth gates

None — this plan is fully local file authoring + image rasterization.

## Notes for Plan 31-04 (downstream consumer)

Plan 31-04 is the Wave-2 owner of:

1. **OG meta refresh across HTML pages** — update `og:image` URLs to use `?v=2` cache-bust query string per D-discretion item 4 (cache-bust DECISION locked into 31-03 PLAN.md context section):
   - `landing.html:16` — `og:image` → `https://couchtonight.app/og.png?v=2`
   - `landing.html:128` — JSON-LD `image` → same
   - `changelog.html:17` — `og:image` → same
   - `changelog.html:24` — `twitter:image` → same
   - `rsvp.html` — ADD `og:image` meta entirely (currently missing per D-18)

2. **Deploy.sh mirror extension** — the existing mirror loop does NOT copy `og.png` or `brand/`. Plan 31-04 must extend `scripts/deploy.sh` so the new asset propagates to `queuenight/public/og.png` (Firebase Hosting source).

3. **sw.js CACHE bump** — to `couch-v48-marketing-refresh` per D-19, auto-applied via `bash scripts/deploy.sh 48-marketing-refresh`.

4. **Visual smoke (post-deploy)** — manual visual check per Plan 31-03 verification §2: open og.png in viewer, confirm leather bg / wordmark upper-left / two-line hero text / footer URL all present. Twitter Validator + Facebook Sharing Debugger should also be re-scraped post `?v=2`.

## Phase 17 Future-Proofing

The `brand/og-source.svg` source-of-truth is the same vector pipeline Phase 17 (App Store) will reuse for:
- 1024×1024 App Store icon (re-render with `.resize(1024, 1024, { fit: 'cover' })`)
- 2048×1170 Apple feature graphic (re-render with explicit width/height swap)
- 1024×500 Play Store feature graphic
- Any other social/marketing surface that wants the same composition at a different aspect ratio

To swap the design (different copy, different layout, different fonts), edit the SVG and re-run the sharp command — no Photoshop/Figma round-trip required.

## Self-Check: PASSED

**Files claimed to exist:**
- `brand/og-source.svg` → FOUND (287051 bytes / 280 KB)
- `og.png` → FOUND (67392 bytes / 66 KB, 1200×630 PNG)
- `.planning/phases/31-marketing-refresh/31-03-SUMMARY.md` → this file (created via Write tool)

**Commits claimed to exist:**
- `b0a7754` (Task 1 — brand/og-source.svg) → on branch `hotfix/phase-30-cross-cutting-wave`
- `21f5746` (Task 2 — og.png + comment sanitization) → on branch `hotfix/phase-30-cross-cutting-wave`
