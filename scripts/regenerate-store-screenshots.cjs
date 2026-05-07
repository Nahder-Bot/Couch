#!/usr/bin/env node
/**
 * regenerate-store-screenshots.cjs — Phase 17 / Wave 2 deliverable
 *
 * Generates App Store + Google Play screenshots from a single highest-resolution
 * source set. Per Phase 17 CONTEXT D-06: "capture at 1320×2868 once, sharp-downscale
 * to the rest" — saves ~3 hours vs. capturing on each device.
 *
 * Inputs (place source captures in marketing-source/):
 *   marketing-source/<surface-name>.png   — captured at 1320×2868 (iPhone 16/15/14/13
 *                                            Pro Max; the largest Apple-required size).
 *                                            5 surfaces per Phase 31 / Plan 31-02:
 *                                              tonight-hero
 *                                              watchparty-live
 *                                              couch-groups
 *                                              wait-up
 *                                              pickem
 *
 * Outputs:
 *   app-store-assets/iphone-6.9/<name>.png  → 1320×2868 (REQUIRED for App Store since 2024)
 *   app-store-assets/iphone-6.7/<name>.png  → 1290×2796 (accepted)
 *   app-store-assets/iphone-6.5/<name>.png  → 1242×2688 (legacy, accepted)
 *   play-store-assets/phone/<name>.png       → 1170×2532 (Play accepts a wide range; this matches Phase 31 output)
 *   marketing/<name>.png                     → 1170×2532 (drop-in for landing.html screenshot grid)
 *
 * App Store iPad (required only if iPad is in v1 scope per CONTEXT D-09 open question):
 *   app-store-assets/ipad-13/<name>.png     → 2064×2752 (required if iPad supported)
 *
 * If a source image is smaller than a target (e.g. 1170×2532 → Apple 1320×2868):
 *   - Fails fast with an error. App Review may reject visibly upscaled screenshots.
 *   - Re-capture at 1320×2868 to populate iPhone-6.9 outputs.
 *
 * Usage:
 *   node scripts/regenerate-store-screenshots.cjs
 *   node scripts/regenerate-store-screenshots.cjs --skip-ipad      (default — iPad off per CONTEXT)
 *   node scripts/regenerate-store-screenshots.cjs --include-ipad   (enable iPad outputs)
 *   node scripts/regenerate-store-screenshots.cjs --source <dir>   (override source dir)
 *
 * Phase 17 / Wave 2 — Pre-staged 2026-05-07.
 */

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const INCLUDE_IPAD = args.includes('--include-ipad');
const sourceDirArg = args.indexOf('--source');
const SOURCE_DIR = sourceDirArg !== -1 && args[sourceDirArg + 1]
  ? path.resolve(REPO_ROOT, args[sourceDirArg + 1])
  : path.join(REPO_ROOT, 'marketing-source');

let sharp;
try {
  sharp = require('sharp');
} catch (err) {
  console.error('\nERROR: sharp not installed.\n');
  console.error('Install with: npm install sharp\n');
  console.error('sharp is the image-processing library Phase 15.3 + Phase 9 also use.\n');
  process.exit(1);
}

// Target matrix. Each entry: {name, dir, width, height, required, notes}
const TARGETS = [
  // App Store iPhone — Apple's 2024 spec: 6.9" required for new submissions.
  { name: 'iphone-6.9', dir: 'app-store-assets/iphone-6.9', width: 1320, height: 2868, required: true, notes: 'iPhone 16/15/14/13 Pro Max — REQUIRED by Apple App Store' },
  { name: 'iphone-6.7', dir: 'app-store-assets/iphone-6.7', width: 1290, height: 2796, required: false, notes: 'iPhone XS Max, 15/14 Plus — accepted' },
  { name: 'iphone-6.5', dir: 'app-store-assets/iphone-6.5', width: 1242, height: 2688, required: false, notes: 'iPhone XS Max, 11 Pro Max — legacy, accepted' },
  // Play Store + landing.html
  { name: 'play-phone', dir: 'play-store-assets/phone', width: 1170, height: 2532, required: true, notes: 'Google Play phone — accepts wide range; this matches Phase 31 output' },
  { name: 'marketing', dir: 'marketing', width: 1170, height: 2532, required: true, notes: 'landing.html screenshot grid — same as Play phone' },
];

if (INCLUDE_IPAD) {
  TARGETS.push({
    name: 'ipad-13',
    dir: 'app-store-assets/ipad-13',
    width: 2064,
    height: 2752,
    required: true,
    notes: 'iPad Pro M4/M2 — REQUIRED if iPad supported (per Apple 2024 spec)',
  });
}

async function processOne(sourceFile) {
  const baseName = path.basename(sourceFile, '.png');
  console.log(`\n=== ${baseName} ===`);

  const sourceMeta = await sharp(sourceFile).metadata();
  console.log(`  Source: ${sourceMeta.width}×${sourceMeta.height}`);

  for (const target of TARGETS) {
    const outDir = path.join(REPO_ROOT, target.dir);
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, `${baseName}.png`);

    if (sourceMeta.width < target.width || sourceMeta.height < target.height) {
      const msg = `  SKIP ${target.name} (${target.width}×${target.height}) — source is smaller; would upscale + visibly soften. Re-capture at ${TARGETS[0].width}×${TARGETS[0].height} to enable.`;
      if (target.required) {
        console.error(msg + ' [REQUIRED]');
      } else {
        console.warn(msg);
      }
      continue;
    }

    // Use 'cover' fit + center to handle aspect-ratio differences (rare — most
    // mobile screenshots match 9:19.5 within rounding). For exact-aspect sources,
    // sharp.resize defaults to preserving aspect; cover crops to fill if needed.
    await sharp(sourceFile)
      .resize(target.width, target.height, {
        fit: 'cover',
        position: 'center',
        kernel: sharp.kernel.lanczos3, // sharper downscale than default
      })
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outPath);

    console.log(`  ✓ ${target.name.padEnd(12)} ${target.width}×${target.height} → ${path.relative(REPO_ROOT, outPath)}`);
  }
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) {
    console.error(`\nERROR: Source directory not found: ${SOURCE_DIR}\n`);
    console.error('Capture screenshots at 1320×2868 (or larger) and place in:');
    console.error(`  ${SOURCE_DIR}/`);
    console.error('\nExpected filenames (one per Phase 31 surface):');
    console.error('  tonight-hero.png');
    console.error('  watchparty-live.png');
    console.error('  couch-groups.png');
    console.error('  wait-up.png');
    console.error('  pickem.png');
    console.error('\nCapture with iOS Simulator (xcrun simctl), real device screenshot, or browser dev-tools device emulation set to iPhone 16 Pro Max.\n');
    process.exit(1);
  }

  const pngs = fs.readdirSync(SOURCE_DIR).filter(f => f.toLowerCase().endsWith('.png'));
  if (pngs.length === 0) {
    console.error(`\nERROR: No PNG files found in ${SOURCE_DIR}\n`);
    process.exit(1);
  }

  console.log(`Source: ${path.relative(REPO_ROOT, SOURCE_DIR)}`);
  console.log(`Found: ${pngs.length} screenshot${pngs.length === 1 ? '' : 's'}`);
  console.log(`Targets: ${TARGETS.length} sizes${INCLUDE_IPAD ? ' (iPad enabled)' : ' (iPad off — pass --include-ipad to enable)'}`);

  for (const png of pngs) {
    await processOne(path.join(SOURCE_DIR, png));
  }

  console.log('\n=== Done ===');
  console.log('Next:');
  console.log('  • Verify outputs in app-store-assets/ and play-store-assets/');
  console.log('  • Add to git: git add app-store-assets/ play-store-assets/ marketing/');
  console.log('  • For App Store Connect: drag-drop iphone-6.9/*.png + iphone-6.7/*.png into the listing');
  console.log('  • For Play Console: drag-drop play-store-assets/phone/*.png into the listing');
  console.log('  • marketing/*.png lands automatically (landing.html <img> tags already reference these paths)\n');
}

main().catch(err => {
  console.error('\nERROR:', err.message);
  process.exit(1);
});
