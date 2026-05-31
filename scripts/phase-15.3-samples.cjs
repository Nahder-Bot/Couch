#!/usr/bin/env node
/**
 * Phase 15.3 — sample generator for evaluating SVG/transparent-PNG approaches.
 *
 * Produces side-by-side deliverables from brand/{mark,logo}-master.png:
 *   1. Sharp-based transparent-background PNG (alpha-keyed black backdrop -> transparent)
 *   2. Potrace vector trace at 3 thresholds (low / mid / high) for shape-tracing comparison
 *
 * All outputs land in brand/samples/ for visual review.
 *
 * NOTE: Throwaway evaluation script — does not ship to prod, not wired into deploy.sh.
 * Once user picks an approach, this gets replaced by scripts/regenerate-icons.sh
 * (the canonical Phase 15.3 deliverable per brand/README.md).
 */

'use strict';

const sharp = require('sharp');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

const REPO = path.resolve(__dirname, '..');
const SAMPLES = path.join(REPO, 'brand', 'samples');

async function transparentBgFrom(masterPath, outName, { threshold = 25, fadeRange = 30 } = {}) {
  // Read raw RGB pixels, write RGBA with alpha keyed to per-pixel darkness:
  //   - sum(R+G+B) below threshold*3 -> fully transparent
  //   - between threshold and threshold+fadeRange -> linear fade
  //   - above -> fully opaque
  // This preserves the brown leather pixels while erasing the pure-black backdrop.
  const img = sharp(masterPath);
  const meta = await img.metadata();
  const { data, info } = await img.removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  const lo = threshold * 3;
  const hi = (threshold + fadeRange) * 3;
  let transparentCount = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    out[i * 4]     = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    const sum = r + g + b;
    let alpha;
    if (sum <= lo)        { alpha = 0; transparentCount++; }
    else if (sum >= hi)   { alpha = 255; }
    else                  { alpha = Math.round(((sum - lo) / (hi - lo)) * 255); }
    out[i * 4 + 3] = alpha;
  }
  const outPath = path.join(SAMPLES, outName);
  await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
  const pctTransparent = ((transparentCount / (info.width * info.height)) * 100).toFixed(1);
  console.log(`  transparent-bg:  ${outName}  (${info.width}x${info.height}, ${pctTransparent}% bg keyed)`);
}

function traceVector(masterPath, outName, { threshold, color, background }) {
  return new Promise((resolve, reject) => {
    potrace.trace(masterPath, { threshold, color, background, optTolerance: 0.4 }, (err, svg) => {
      if (err) return reject(err);
      const outPath = path.join(SAMPLES, outName);
      fs.writeFileSync(outPath, svg);
      const sizeKb = (svg.length / 1024).toFixed(1);
      console.log(`  vector-trace:    ${outName}  (threshold=${threshold}, ${sizeKb} KB)`);
      resolve();
    });
  });
}

async function main() {
  if (!fs.existsSync(SAMPLES)) fs.mkdirSync(SAMPLES, { recursive: true });

  console.log('=== mark-master.png ===');
  const markMaster = path.join(REPO, 'brand', 'mark-master.png');

  await transparentBgFrom(markMaster, 'mark-transparent-strict.png',  { threshold: 15, fadeRange: 15 });
  await transparentBgFrom(markMaster, 'mark-transparent-balanced.png', { threshold: 25, fadeRange: 30 });
  await transparentBgFrom(markMaster, 'mark-transparent-soft.png',     { threshold: 40, fadeRange: 50 });

  // Potrace traces — three threshold levels to find the right cut between bg and leather brown.
  // Defaults: color is the foreground fill, background is the canvas. Foreground here is what we want
  // to KEEP (the C silhouette); background is what becomes invisible.
  await traceVector(markMaster, 'mark-traced-tight.svg',   { threshold: 60,  color: '#8b4513', background: 'transparent' });
  await traceVector(markMaster, 'mark-traced-medium.svg',  { threshold: 100, color: '#8b4513', background: 'transparent' });
  await traceVector(markMaster, 'mark-traced-loose.svg',   { threshold: 140, color: '#8b4513', background: 'transparent' });

  console.log('\n=== logo-master.png (wordmark) ===');
  const logoMaster = path.join(REPO, 'brand', 'logo-master.png');

  await transparentBgFrom(logoMaster, 'logo-transparent-strict.png',   { threshold: 15, fadeRange: 15 });
  await transparentBgFrom(logoMaster, 'logo-transparent-balanced.png', { threshold: 25, fadeRange: 30 });
  await transparentBgFrom(logoMaster, 'logo-transparent-soft.png',     { threshold: 40, fadeRange: 50 });

  await traceVector(logoMaster, 'logo-traced-tight.svg',   { threshold: 60,  color: '#8b4513', background: 'transparent' });
  await traceVector(logoMaster, 'logo-traced-medium.svg',  { threshold: 100, color: '#8b4513', background: 'transparent' });
  await traceVector(logoMaster, 'logo-traced-loose.svg',   { threshold: 140, color: '#8b4513', background: 'transparent' });

  console.log('\nDone. Samples in brand/samples/. Open them against a dark backdrop to compare.');
}

main().catch(e => { console.error(e); process.exit(1); });
