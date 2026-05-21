# Couch — Brand Asset Masters

Canonical PNG master sources for the Couch brand identity. Phase 15.3's `scripts/regenerate-icons.sh` (forthcoming) consumes these masters via `sharp` to produce the full Apple + Google + favicon + maskable icon matrix deterministically. Do not hand-edit downscaled PNGs — re-run the regeneration script instead.

## Files (drop here when ready)

| File | Dimensions | Source | Used for |
|---|---|---|---|
| `logo-master.png` | 3000×1500 (2:1 aspect) | ChatGPT regeneration of the leather-cushion "Couch" wordmark per `.planning/CHATGPT-LOGO-PROMPTS-2026-05-06.md` Step 3 | High-resolution wordmark — downscaled to `logo-h300.png` (634×300) + `logo-h200.png` (423×200) + `logo-h100.png` for hero contexts |
| `mark-master.png` | 1024×1024 SQUARE | ChatGPT — leather-cushion capital "C" with glowing TV nested in C's opening (canonical brand-storytelling icon: couch facing TV); NO baked-in rounded corners (iOS/Android apply their own corner masks at render time) | Apple App Store marketing icon + iOS device icon set + Google Play hi-res icon + favicon set + maskable variants |
| `notification-mark.png` | 96×96 with transparency | ChatGPT — flat white silhouette of the C ONLY (no TV; no leather texture; no 3D), pure `#FFFFFF` on transparent background | Android system notification strip (which can't render color or texture) |
| `og-source.svg` | (vector source) | Optional — Phase 31 D-17 deliverable | Source for `og.png` 1200×630 social-share card |

## Source-of-truth references

- `.planning/BRAND.md` §1 — canonical identity description (refreshed 2026-05-06 to leather-cushion direction)
- `.planning/CHATGPT-LOGO-PROMPTS-2026-05-06.md` — copy-pasteable ChatGPT prompts that produce these masters
- `.planning/APP-STORE-ASSETS-AUDIT-2026-05-06.md` — full Apple + Google asset matrix this folder feeds into
- `.planning/ROADMAP.md` Phase 15.3 — formal scope + success criteria

## Critical: NO baked-in rounded corners on `mark-master.png`

Apple's iOS and Google's Android apply their own rounded-square (or circular) masks to app icons at render time. If `mark-master.png` already has rounded corners baked into the image, the system mask cuts INSIDE those rounded corners — the icon looks pinched/inset on device. The master must be a perfect SQUARE 1024×1024 with content filling all four corners. The leather backdrop should reach the canvas edges.

The same rule applies to `mark-{16..1024}.png` downscaled outputs — sharp preserves the source's square shape, no additional masking applied.

## Deployment

`scripts/deploy.sh` mirrors source files to the sibling `couch-deploy` repo at `${COUCH_DEPLOY_PATH:-../../couch-deploy}/public/`. The mirror loop should include `brand/*.png` so masters travel to deploy when needed (Phase 31 / Plan 31-04 extends this loop).

## Regeneration command (Phase 15.3 deliverable)

After Phase 15.3 ships:

```bash
bash scripts/regenerate-icons.sh
```

Reads `brand/logo-master.png` + `brand/mark-master.png` + `brand/notification-mark.png` and overwrites the downscaled set (`mark-{N}.png` + `logo-h{N}.png` + `favicon.ico` + `mark-maskable-{N}.png`) at the repo root. Idempotent — running it again produces identical bytes.

---

*This README scaffolded 2026-05-06 ahead of asset generation. Drop the three master files in here, then trigger `/gsd-discuss-phase 15.3 --auto` to begin the formal Phase 15.3 chain.*
