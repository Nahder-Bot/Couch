const sharp = require('./node_modules/sharp');
const fs = require('fs');
// Generate a multi-resolution-friendly favicon.ico equivalent. ICO requires special encoding;
// browsers also accept a 32x32 PNG renamed .ico, but proper .ico needs png-to-ico encoding.
// Simplest reliable approach: render at 32x32 from mark-master.png and ALSO add the link rel=icon
// to point at favicon-32.png. For the actual favicon.ico file, render a 48x48 PNG and save with .ico extension —
// most modern browsers accept this.
sharp('../brand/mark-master.png').resize(48, 48, { kernel: 'lanczos3' }).png().toFile('../favicon.ico').then(() => console.log('favicon.ico generated (48x48 PNG-as-ICO)'));
