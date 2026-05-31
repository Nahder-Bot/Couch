#!/usr/bin/env node
/**
 * Phase 15.3 — comparison composite for user evaluation.
 *
 * Builds a single side-by-side PNG per master file showing:
 *   [original PNG] [transparent PNG on #14110f] [traced SVG on #14110f]
 *
 * Compositing on the actual app bg color (--bg = #14110f) lets the user
 * see what each option will ACTUALLY look like in production, instead of
 * the misleading checkerboard view default image viewers use for alpha.
 */

'use strict';

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SAMPLES = path.join(REPO, 'brand', 'samples');
const BG_HEX = '#14110f';  // matches --bg in css/app.css :root

async function rasterizeSvg(svgPath, width, height) {
  return sharp(fs.readFileSync(svgPath), { density: 300 })
    .resize(width, height, { fit: 'inside', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
}

async function compositeOnBg(buf, width, height) {
  return sharp({
    create: {
      width, height,
      channels: 4,
      background: { r: 0x14, g: 0x11, b: 0x0f, alpha: 1 }
    }
  })
    .composite([{ input: buf, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function buildComparison(baseName, masterFile, transparentFile, tracedFile, displayW) {
  console.log(`\n=== ${baseName} comparison ===`);
  const masterMeta = await sharp(masterFile).metadata();
  // Scale each tile to fit a reasonable preview size while preserving aspect
  const aspect = masterMeta.height / masterMeta.width;
  const tileW = displayW;
  const tileH = Math.round(tileW * aspect);

  // 1. Original master rendered as-is (its own black bg is fine for visual comparison)
  const original = await sharp(masterFile).resize(tileW, tileH, { fit: 'inside' }).png().toBuffer();

  // 2. Transparent PNG composited on #14110f
  const transparentBuf = await sharp(transparentFile).resize(tileW, tileH, { fit: 'inside' }).png().toBuffer();
  const transparentOnBg = await compositeOnBg(transparentBuf, tileW, tileH);

  // 3. Traced SVG rasterized then composited on #14110f
  const tracedRaster = await rasterizeSvg(tracedFile, tileW, tileH);
  const tracedOnBg = await compositeOnBg(tracedRaster, tileW, tileH);

  // Stitch them horizontally with a 16px gap
  const gap = 16;
  const labelH = 28;
  const stripW = tileW * 3 + gap * 2;
  const stripH = tileH + labelH;
  const labelSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${stripW}" height="${labelH}">
    <style>text{font-family:Inter,sans-serif;font-size:13px;fill:#c9bca8;font-weight:600;letter-spacing:0.03em}</style>
    <rect width="100%" height="100%" fill="#14110f"/>
    <text x="${tileW / 2}"          y="18" text-anchor="middle">ORIGINAL (black bg, current bug)</text>
    <text x="${tileW + gap + tileW / 2}" y="18" text-anchor="middle">TRANSPARENT PNG on app bg #14110f</text>
    <text x="${(tileW + gap) * 2 + tileW / 2}" y="18" text-anchor="middle">VECTOR TRACE on app bg #14110f</text>
  </svg>`;
  const labelBuf = await sharp(Buffer.from(labelSvg)).png().toBuffer();

  const composite = await sharp({
    create: {
      width: stripW, height: stripH, channels: 4,
      background: { r: 0x14, g: 0x11, b: 0x0f, alpha: 1 }
    }
  })
    .composite([
      { input: labelBuf, top: 0, left: 0 },
      { input: original,        top: labelH, left: 0 },
      { input: transparentOnBg, top: labelH, left: tileW + gap },
      { input: tracedOnBg,      top: labelH, left: (tileW + gap) * 2 }
    ])
    .png()
    .toFile(path.join(SAMPLES, `_comparison-${baseName}.png`));

  console.log(`  -> brand/samples/_comparison-${baseName}.png  (${stripW}x${stripH})`);
}

async function main() {
  // For each master, build comparisons using the BALANCED transparent + MEDIUM trace
  // (the most likely-shipping variants from the wider sweep in phase-15.3-samples.cjs).
  await buildComparison('mark',
    path.join(REPO, 'brand', 'mark-master.png'),
    path.join(SAMPLES, 'mark-transparent-balanced.png'),
    path.join(SAMPLES, 'mark-traced-medium.svg'),
    400
  );
  await buildComparison('logo',
    path.join(REPO, 'brand', 'logo-master.png'),
    path.join(SAMPLES, 'logo-transparent-balanced.png'),
    path.join(SAMPLES, 'logo-traced-medium.svg'),
    560
  );
}

main().catch(e => { console.error(e); process.exit(1); });
