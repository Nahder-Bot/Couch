// One-shot: resize/optimize 3 desktop-emulated captures to 1170 wide for marketing/
const sharp = require('C:/Users/nahde/AppData/Local/Temp/img-opt/node_modules/sharp');
const fs = require('fs');
const path = require('path');
const RAW = 'C:/Users/nahde/claude-projects/phase-31-raw';
const REPO = 'C:/Users/nahde/claude-projects/couch';

const targets = [
  { src: 'tonight-couch-viz.png',   dst: 'marketing/tonight-couch-viz.png' },
  { src: 'tonight-pickup.png',      dst: 'marketing/tonight-pickup.png' },
  { src: 'pickem-leaderboard.png',  dst: 'marketing/pickem-leaderboard.png' },
];

(async () => {
  for (const t of targets) {
    const srcPath = path.join(RAW, t.src);
    if (!fs.existsSync(srcPath)) { console.warn('SKIP missing:', srcPath); continue; }
    const inMeta = await sharp(srcPath).metadata();
    const dstAbs = path.join(REPO, t.dst);
    await sharp(srcPath)
      .resize({ width: 1170, kernel: 'lanczos3' })
      .png({ palette: true, compressionLevel: 9, quality: 85 })
      .toFile(dstAbs);
    const outMeta = await sharp(dstAbs).metadata();
    const outStat = fs.statSync(dstAbs);
    console.log(t.dst, '->', outMeta.width + 'x' + outMeta.height, Math.round(outStat.size / 1024) + 'KB', '(in: ' + inMeta.width + 'x' + inMeta.height + ')');
  }
})();
