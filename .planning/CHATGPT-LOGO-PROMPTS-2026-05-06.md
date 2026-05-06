# ChatGPT Prompts — Couch Brand Asset Generation

*Authored 2026-05-06. For producing the leather-cushion brand assets via ChatGPT image generation (DALL-E / GPT Image).*

These prompts run in order in a **single ChatGPT conversation** so the visual reference set in Step 1 carries through every subsequent generation.

---

## Step 1 — Set the visual reference

**Action:** Upload the canonical wordmark image: `OneDrive/Pictures/Couch Logo!.png` (the Photopea-cleaned version with C aligned to o bottom, no white background).

**Message:**

> I'm using this image as the canonical brand reference for an app called Couch. It's a 3D photorealistic render of leather-cushion letterforms — warm brown leather with cream-colored stitching at panel seams, tubular over-stuffed cushion construction, set on a warm-dark leather backdrop. Every following request should match this image's exact material, lighting, color palette, and rendering style. Confirm you can see the reference and describe back to me the key visual elements you'll need to preserve.

Wait for confirmation. Correct any misreadings before continuing.

---

## Step 2 — Standalone C app icon (PRIMARY DELIVERABLE)

> Now generate a standalone capital letter "C" using the EXACT same material, lighting, color, and rendering style as the reference image.
>
> Specifications:
> - Canvas: **1024×1024 pixels**, square
> - Letter: capital "C", same shape and proportions as the C in the reference wordmark
> - Material: same warm brown leather with visible cream/white stitching at panel seams; same tubular over-stuffed cushion construction
> - Color: match the brown of the reference letters exactly
> - Backdrop: same warm-dark leather background as the reference (deep brown, near-black, photographic — not pure black)
> - Lighting: same soft top-down lighting with subtle rim light, photographic depth, soft cushion shadows on backdrop
> - Composition: C is centered both horizontally and vertically; the C should fill roughly 70% of the canvas height/width, leaving ~15% padding on all sides as safe-zone for app-icon cropping
> - Style: photorealistic 3D render, looks like a piece of overstuffed leather furniture
>
> DO NOT include any other letters, words, text, signatures, watermarks, frames, or graphical elements — just the standalone leather C on the dark backdrop. The output should look like a square cropped extract of the reference image showing only the C with proper safe-zone padding.

**Save as:** `brand/mark-master.png`

---

## Step 3 — High-resolution wordmark master

> Now recreate the full reference wordmark at higher resolution.
>
> Specifications:
> - Canvas: **3000×1500 pixels** (2:1 aspect ratio)
> - Word: "Couch" — capital C followed by lowercase "ouch", exactly as in the reference
> - Material, lighting, color, backdrop, stitching, cushion construction: 100% identical to the reference image
> - Letterforms: identical proportions, identical letter spacing, identical alignment (C bottom aligned with o bottom)
> - Composition: wordmark centered horizontally; vertical position matches the reference (slightly above center)
> - Resolution: cleaner detail throughout, especially the leather texture and stitching
>
> This is a higher-resolution master of the same wordmark — no creative changes, just sharper rendering. DO NOT change any letterforms, spacing, materials, or colors. DO NOT add any text, watermarks, or other elements.

**Note:** If DALL-E can't hit exactly 3000×1500, accept 1792×1024 (closest 2:1-ish) and crop/upscale in Photopea.

**Save as:** `brand/logo-master.png`

---

## Step 4 — Android notification icon (flat silhouette, different style)

> Now generate a completely different style of asset — a flat single-color silhouette for use as an Android notification icon.
>
> Specifications:
> - Canvas: **96×96 pixels**, transparent background
> - Subject: capital letter "C", silhouette only — same proportions as the reference C but rendered FLAT (no 3D, no leather texture, no stitching, no lighting, no shadow)
> - Color: pure white (#FFFFFF), filled solid, no gradients
> - Stroke weight: medium-thick — must remain readable when downscaled to 24×24 pixels
> - Style: clean vector-like silhouette, geometric, designed for Android's notification strip where colored/textured icons can't be rendered
>
> This is for Android system notifications which require flat white-on-transparent. DO NOT include any leather texture, 3D rendering, stitching, or backdrop. DO NOT add other letters or elements.

**Save as:** `brand/notification-mark.png`

---

## Iteration cheat sheet

| Failure mode | Correction prompt |
|---|---|
| C looks redesigned / not the reference shape | "The C should be the same rounded letterform as the reference, not redesigned. Match the reference C's proportions exactly." |
| Backdrop is pure black, not leather | "The backdrop should be photographic warm-dark leather as in the reference, not flat black." |
| Stitching wrong color or missing | "Stitching should be cream/off-white, visible along all panel seams, matching the reference." |
| Letter too small or too large | "The C should fill ~70% of the canvas with ~15% padding on all sides." |
| Added unwanted decorative elements | "Remove all decorative elements — just the C on the dark backdrop, nothing else." |
| Material looks plastic instead of leather | "The material should look like real overstuffed leather, with subtle natural creases and the same matte sheen as the reference. Not plastic, not vinyl." |
| Letter floats too high or low | "Center the C both horizontally AND vertically in the canvas." |

---

## After generation

Place the three masters at:
- `brand/logo-master.png` — Step 3 output (high-res wordmark)
- `brand/mark-master.png` — Step 2 output (1024×1024 standalone C)
- `brand/notification-mark.png` — Step 4 output (96×96 flat silhouette)

Then run `/gsd-discuss-phase 15.3 --auto` → `/gsd-plan-phase 15.3` → `/gsd-execute-phase 15.3` to produce the sharp downscale pipeline and the full Apple + Google + favicon + maskable icon matrix.

---

*Source-of-truth for brand identity: `.planning/BRAND.md` §1. Phase 15.3 scope: `.planning/ROADMAP.md` line ~267.*
