#!/usr/bin/env node
/**
 * regenerate-icons.cjs — Phase 15.3 deliverable
 *
 * Reads PNG masters from brand/ and generates the full Apple + Google + favicon +
 * maskable + Android adaptive + Android notification icon matrix at the repo root.
 * Idempotent — running it again produces identical bytes from identical inputs.
 *
 * Inputs (must exist in brand/ before running):
 *   brand/mark-master.png        — 1024×1024 SQUARE; leather-C with TV; NO baked rounded corners
 *   brand/logo-master.png        — 3000×1500 (or 2:1 aspect); leather-cushion wordmark
 *   brand/notification-mark.png  — flat white C silhouette on transparent (any size; will downscale)
 *
 * Outputs at repo root (overwrites existing PNGs):
 *   mark-{16,29,32,40,48,58,60,76,80,87,96,120,128,144,152,167,180,192,384,512,1024}.png
 *   mark-maskable-{192,512}.png  (with extra padding for W3C 40% safe-zone)
 *   mark-adaptive-foreground-432.png  (Android adaptive icon foreground, padded)
 *   mark-adaptive-background-432.png  (Android adaptive icon background, solid #14110f)
 *   logo-h{100,200,300}.png  (wordmark variants, height-based, 2:1 aspect preserved)
 *   favicon-{16,32,48}.png  (browser tab icons; link from HTML head)
 *   notification-icon-{24,32,48,72,96}.png  (Android notification strip variants)
 *
 * Usage:
 *   node scripts/regenerate-icons.cjs
 *
 * Dependencies:
 *   sharp (npm install sharp). Already used in Phase 9 / Plan 09-06 marketing pipeline.
 *
 * Phase 15.3 — Pre-staged 2026-05-06; finalized when all three brand/ masters land.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const BRAND_DIR = path.join(REPO_ROOT, 'brand');

const MARK_MASTER = path.join(BRAND_DIR, 'mark-master.png');
const LOGO_MASTER = path.join(BRAND_DIR, 'logo-master.png');
const NOTIFICATION_MARK = path.join(BRAND_DIR, 'notification-mark.png');

// Lazy-load sharp so we can give a helpful error if it's missing.
let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('\nERROR: sharp not installed.\n');
  console.error('Install with: npm install sharp\n');
  console.error('sharp is the image-processing library Phase 9 / Plan 09-06 also uses.\n');
  process.exit(1);
}

// --- Transparency pipeline (Phase 15.3 / 2026-05-27 finalization) ---
//
// The ChatGPT-generated masters (mark-master.png, logo-master.png) have a SOLID
// pure-black backdrop, which on the warm-dark #14110f app bg renders as a visible
// darker rectangle. This pipeline alpha-keys the black backdrop to transparent
// before any downstream resize, so all outputs inherit native transparency and
// the mix-blend-mode: lighten workarounds in css/{app,landing,rsvp}.css can be
// removed. brand/notification-mark.png is already transparent and bypasses this.
//
// Per-pixel rule:
//   sum(R+G+B) <= ALPHA_THRESHOLD*3              -> fully transparent
//   ALPHA_THRESHOLD*3 < sum < (ALPHA_THRESHOLD+ALPHA_FADE)*3  -> linear alpha fade
//   sum >= (ALPHA_THRESHOLD+ALPHA_FADE)*3        -> fully opaque (leather brown)
//
// Threshold tuned (25/30) for the balanced sample in the Phase 15.3 evaluation
// (see brand/samples/_comparison-mark.png + _comparison-logo.png).
const ALPHA_THRESHOLD = 25;
const ALPHA_FADE = 30;

const _transparentCache = new Map();

async function loadTransparent(masterPath) {
  const { data, info } = await sharp(masterPath).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const lo = ALPHA_THRESHOLD * 3;
  const hi = (ALPHA_THRESHOLD + ALPHA_FADE) * 3;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    out[i * 4]     = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    const sum = r + g + b;
    let alpha;
    if (sum <= lo) alpha = 0;
    else if (sum >= hi) alpha = 255;
    else alpha = Math.round(((sum - lo) / (hi - lo)) * 255);
    out[i * 4 + 3] = alpha;
  }
  return { buf: out, width: info.width, height: info.height };
}

// Returns a FRESH sharp instance over the cached transparent buffer for a given master.
// Each call returns a new instance (sharp instances are stream-stateful and can't be
// reused across multiple .toFile() calls). The alpha-key pass itself runs once per
// master via the cache.
async function transparentSharp(masterPath) {
  if (!_transparentCache.has(masterPath)) {
    _transparentCache.set(masterPath, await loadTransparent(masterPath));
  }
  const { buf, width, height } = _transparentCache.get(masterPath);
  return sharp(buf, { raw: { width, height, channels: 4 } });
}

// --- Size matrices (canonical — change here, propagates everywhere) ---

// Apple + Google + favicon mark sizes. Sourced from BRAND.md §1 + APP-STORE-ASSETS-AUDIT-2026-05-06.md.
const MARK_SIZES = [16, 29, 32, 40, 48, 58, 60, 76, 80, 87, 96, 120, 128, 144, 152, 167, 180, 192, 384, 512, 1024];

// Maskable variants — W3C spec is 40% safe-zone (icon centered in 80% of canvas).
// Source mark-master.png already has ~15% padding; we composite onto a larger canvas
// to add the remaining padding so circular masks never clip the C silhouette.
const MASKABLE_SIZES = [192, 512];

// Wordmark heights — width is auto-derived from the source aspect ratio.
const LOGO_HEIGHTS = [100, 200, 300];

// Favicon sizes (browser tab + bookmark — multi-res link from HTML <head>).
const FAVICON_SIZES = [16, 32, 48];

// Notification icon densities (Android density buckets: mdpi 24, hdpi 36, xhdpi 48, xxhdpi 72, xxxhdpi 96).
const NOTIFICATION_SIZES = [24, 32, 48, 72, 96];

// Android adaptive icon — fixed 432×432 per Material Design spec.
const ADAPTIVE_ICON_SIZE = 432;
const ADAPTIVE_BG_COLOR = '#14110f'; // BRAND.md --bg

// --- Validation: ensure masters exist before doing anything ---

function validateMasters() {
  const missing = [];
  for (const [name, p] of [
    ['mark-master.png', MARK_MASTER],
    ['logo-master.png', LOGO_MASTER],
    ['notification-mark.png', NOTIFICATION_MARK],
  ]) {
    if (!fs.existsSync(p)) missing.push(`brand/${name}`);
  }
  if (missing.length > 0) {
    console.error('\nERROR: brand master files missing:\n');
    missing.forEach(m => console.error(`  - ${m}`));
    console.error('\nGenerate them via the prompts in:');
    console.error('  .planning/CHATGPT-LOGO-PROMPTS-2026-05-06.md\n');
    console.error('Then drop the resulting PNGs into the brand/ folder and re-run.\n');
    process.exit(1);
  }
}

// --- Helpers ---

const outPath = (name) => path.join(REPO_ROOT, name);
const log = (line) => console.log(`  ✓ ${line}`);

async function generateMarkSizes() {
  console.log('\nGenerating mark-{N}.png set ...');
  for (const size of MARK_SIZES) {
    const file = `mark-${size}.png`;
    await (await transparentSharp(MARK_MASTER))
      .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(outPath(file));
    log(`${file} (${size}×${size})`);
  }
}

async function generateMaskable() {
  console.log('\nGenerating maskable variants (W3C 40% safe-zone) ...');
  for (const size of MASKABLE_SIZES) {
    const file = `mark-maskable-${size}.png`;
    // Inner content fills 80% of canvas → 10% padding each side
    const inner = Math.round(size * 0.8);
    // Post-Phase-15.3: the inner mark is now transparent, so .extend() (which
    // only fills OUTSIDE the inner image) would leave the C's interior
    // transparent — violating the maskable spec (must be fully opaque). Instead
    // we composite the transparent inner ONTO a solid warm-dark canvas so the
    // transparent areas show the brand bg through, and the whole canvas is opaque.
    const innerBuf = await (await transparentSharp(MARK_MASTER))
      .resize(inner, inner, { fit: 'cover', kernel: 'lanczos3' })
      .png()
      .toBuffer();
    await sharp({
      create: {
        width: size, height: size, channels: 4,
        background: { r: 0x14, g: 0x11, b: 0x0f, alpha: 1 }
      }
    })
      .composite([{ input: innerBuf, gravity: 'center' }])
      .png({ compressionLevel: 9 })
      .toFile(outPath(file));
    log(`${file} (${size}×${size}, ${inner}×${inner} content on opaque warm-dark canvas)`);
  }
}

async function generateAndroidAdaptive() {
  console.log('\nGenerating Android adaptive-icon foreground + background ...');
  // Foreground: mark with 33% safe-zone padding (Android's 108dp-of-432dp safe zone).
  const fgFile = 'mark-adaptive-foreground-432.png';
  const fgInner = Math.round(ADAPTIVE_ICON_SIZE * 0.66);
  const fgPad = Math.round((ADAPTIVE_ICON_SIZE - fgInner) / 2);
  await (await transparentSharp(MARK_MASTER))
    .resize(fgInner, fgInner, { fit: 'cover', kernel: 'lanczos3' })
    .extend({
      top: fgPad, bottom: fgPad, left: fgPad, right: fgPad,
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // transparent foreground bg
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath(fgFile));
  log(`${fgFile} (foreground; ${fgInner}px content + ${fgPad}px transparent padding)`);

  // Background: solid color matching brand backdrop.
  const bgFile = 'mark-adaptive-background-432.png';
  await sharp({
    create: {
      width: ADAPTIVE_ICON_SIZE,
      height: ADAPTIVE_ICON_SIZE,
      channels: 3,
      background: ADAPTIVE_BG_COLOR,
    },
  })
    .png({ compressionLevel: 9 })
    .toFile(outPath(bgFile));
  log(`${bgFile} (solid ${ADAPTIVE_BG_COLOR})`);
}

async function generateLogoSizes() {
  console.log('\nGenerating logo-h{N}.png wordmark variants ...');
  // Detect source aspect ratio so output width is correct even if master isn't exactly 2:1.
  const meta = await (await transparentSharp(LOGO_MASTER)).metadata();
  const aspect = meta.width / meta.height;
  for (const h of LOGO_HEIGHTS) {
    const w = Math.round(h * aspect);
    const file = `logo-h${h}.png`;
    await (await transparentSharp(LOGO_MASTER))
      .resize(w, h, { fit: 'inside', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(outPath(file));
    log(`${file} (${w}×${h}, aspect ${aspect.toFixed(3)})`);
  }
}

async function generateFavicons() {
  console.log('\nGenerating favicon-{N}.png set ...');
  for (const size of FAVICON_SIZES) {
    const file = `favicon-${size}.png`;
    await (await transparentSharp(MARK_MASTER))
      .resize(size, size, { fit: 'cover', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(outPath(file));
    log(`${file} (${size}×${size})`);
  }
  // NOTE: sharp can't write .ico natively. Recommended path is link multiple
  // <link rel="icon" sizes="N×N" href="/favicon-N.png"> in HTML <head> instead
  // of generating a multi-res .ico. The existing favicon.ico in deploy mirror
  // can stay as fallback for legacy browsers.
}

async function generateNotificationIcons() {
  console.log('\nGenerating Android notification icons ...');
  for (const size of NOTIFICATION_SIZES) {
    const file = `notification-icon-${size}.png`;
    await sharp(NOTIFICATION_MARK)
      .resize(size, size, { fit: 'inside', kernel: 'lanczos3' })
      .png({ compressionLevel: 9 })
      .toFile(outPath(file));
    log(`${file} (${size}×${size})`);
  }
}

// --- Main ---

(async () => {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(' Couch — icon regeneration pipeline (Phase 15.3)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  validateMasters();

  console.log('\nMasters validated:');
  log(`brand/mark-master.png`);
  log(`brand/logo-master.png`);
  log(`brand/notification-mark.png`);

  try {
    await generateMarkSizes();
    await generateMaskable();
    await generateAndroidAdaptive();
    await generateLogoSizes();
    await generateFavicons();
    await generateNotificationIcons();

    const totalCount =
      MARK_SIZES.length +
      MASKABLE_SIZES.length +
      2 + // adaptive fg + bg
      LOGO_HEIGHTS.length +
      FAVICON_SIZES.length +
      NOTIFICATION_SIZES.length;

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(` ✓ Regenerated ${totalCount} PNG outputs from 3 masters.`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
    console.log('Next: bash scripts/deploy.sh <tag> mirrors the new PNGs to');
    console.log('deploy-mirror; sw.js CACHE bump invalidates installed PWAs.\n');
  } catch (err) {
    console.error('\nREGENERATION FAILED:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
