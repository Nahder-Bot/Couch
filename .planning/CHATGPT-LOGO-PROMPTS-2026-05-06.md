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

## Step 2 — Brand-storytelling app icon (PRIMARY DELIVERABLE) — leather C + glowing TV

> Now generate the canonical Couch app icon: a leather-cushion capital "C" with a glowing TV nested in the C's opening, depicting a couch facing a TV (movie night).
>
> Use the SAME material, lighting, color, and rendering style as the wordmark reference image.
>
> Specifications:
> - Canvas: **EXACTLY 1024×1024 pixels, perfectly SQUARE**
> - **CRITICAL: NO rounded corners on the canvas itself.** The leather backdrop must fill ALL FOUR CORNERS of the square canvas edge-to-edge. iOS and Android apply their own rounded-corner masks to app icons at render time — if I submit an asset that already has rounded corners baked in, the system mask cuts INSIDE those rounded corners and the icon looks pinched. The square output should be ready for system masking.
> - Letter: capital "C", same shape and proportions as the C in the reference wordmark
> - Material: same warm brown leather with visible cream/white stitching at panel seams; same tubular over-stuffed cushion construction
> - Color: match the brown of the reference letters exactly
> - Backdrop: same warm-dark leather background as the reference (deep brown, near-black, photographic — not pure black), filling the entire square canvas
> - Lighting: same soft top-down lighting with subtle rim light, photographic depth, soft cushion shadows on backdrop
> - **TV element:** a small modern flat-screen TV positioned in the C's opening (right side of the C where it "faces" outward), shown in profile/edge-on perspective so it looks like a thin rectangular screen. The TV emits a warm amber/orange glow that softly illuminates the surrounding leather. The TV should be roughly 8-10% of the canvas width — large enough to read at hero sizes but small enough that the C dominates the composition.
> - Composition: C+TV combination centered both horizontally and vertically; the leather backdrop reaches all four canvas corners with NO inset margin or rounded shape; ~15% padding around the C silhouette as safe-zone for adaptive-icon cropping
> - Style: photorealistic 3D render; the C looks like overstuffed leather furniture, the TV looks like a real electronic screen with light source
>
> DO NOT include any other letters, words, text, signatures, watermarks, frames, rounded canvas borders, or decorative elements. DO NOT round the canvas corners — output must be a perfect square with content filling edge-to-edge.

**Save as:** `brand/mark-master.png`

**If the FIRST result has rounded corners baked into the canvas shape:**

> Regenerate with the SAME composition but on a perfectly square canvas — the leather backdrop must fill all four corners of the 1024×1024 square edge-to-edge with NO rounded canvas shape, NO inset margin, NO highlighted edge effect. The image should look like a flat square cropped photograph, not like an already-styled app icon. iOS and Android round the corners themselves; if my source already has rounded corners, the mask cuts inside them and the icon looks pinched. Keep everything else identical: same leather C with glowing TV, same materials, same lighting, same colors. Only fix: square canvas with content reaching all four corners.

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

## Step 4 — Android notification icon (flat silhouette, leather-C proportions)

> Now generate a completely different style of asset — a flat single-color silhouette for use as an Android notification icon.
>
> Specifications:
> - Canvas: **1024×1024 pixels** (high-res for clean downscaling — we'll generate 24/32/48/72/96 variants programmatically), transparent background
> - Subject: capital letter "C", silhouette only — **MUST match the leather C's exact proportions from the wordmark reference image**, NOT a generic font C. Look at where the C's stroke widens vs narrows in the leather original, where the terminus angles are (the cushion-end shapes), how open the C's mouth is — replicate ALL of that as a flat white silhouette. The output should be recognizably "the Couch C," not a stock typographic Helvetica/Arial C.
> - Color: pure white (#FFFFFF), filled solid, no gradients
> - Stroke weight: medium-thick — must remain readable when downscaled to 24×24 pixels
> - **Composition: perfectly axis-aligned (no rotation, no tilt — vertical upright)**, centered both horizontally and vertically, fills ~80% of canvas with ~10% padding each side
> - Style: clean vector-like silhouette, geometric, designed for Android's notification strip
>
> **CRITICAL — what to AVOID:**
> - **NO drop shadow, glow, halo, fringe, soft-blur, or outer shadow of ANY kind.** Pure binary edges (or anti-aliased anti-aliasing for smooth curves only). The transparent background should be 100% transparent in every pixel that isn't part of the C — no faint ring, no haze, no soft falloff.
> - NO leather texture, 3D rendering, stitching, lighting, or backdrop.
> - NO rotation/tilt — the C must be perfectly upright on the canvas.
> - NO other letters, words, text, watermarks, or decorative elements.
>
> **Why this matters:** Android auto-tints notification icons based on theme color. Any shadow/halo will tint along with the C and produce a weird ring around the icon on the notification strip. The icon must be a clean binary mask: opaque white where the C is, fully transparent everywhere else.

**Save as:** `brand/notification-mark.png`

**If the result has a visible halo/shadow, tilted C, or a generic-font letterform:**

> Regenerate with these specific corrections:
> 1. Match the leather C's PROPORTIONS exactly — look at the original wordmark's C and replicate its stroke-weight variation, terminus angles, and mouth opening as a flat silhouette. This is NOT a Helvetica/Arial C.
> 2. ABSOLUTELY no drop shadow, no glow, no halo. Every pixel is either pure white or fully transparent — nothing in between except smooth-curve anti-aliasing.
> 3. Axis-aligned — perfectly vertical, no rotation.
> Keep everything else: 1024×1024, transparent background, pure white fill, ~80% canvas fill.

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
