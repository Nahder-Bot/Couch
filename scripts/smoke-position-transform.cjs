// Phase 15.5 Plan 02 — smoke test for positionToSeconds / secondsToPosition.
// Run: node scripts/smoke-position-transform.cjs
// Exit 0 = pass; exit 1 = fail.
const WAIT_UP_BANDS = Object.freeze([
  { pStart: 0,  pEnd: 7,   sStart: 0,    sEnd: 60,    step: 5   },
  { pStart: 7,  pEnd: 22,  sStart: 60,   sEnd: 300,   step: 15  },
  { pStart: 22, pEnd: 47,  sStart: 300,  sEnd: 1800,  step: 60  },
  { pStart: 47, pEnd: 67,  sStart: 1800, sEnd: 7200,  step: 300 },
  { pStart: 67, pEnd: 100, sStart: 7200, sEnd: 86400, step: 900 }
]);
function positionToSeconds(p){const r=parseFloat(p);if(!isFinite(r))return 0;const x=Math.max(0,Math.min(100,r));const b=WAIT_UP_BANDS.find(z=>x<=z.pEnd)||WAIT_UP_BANDS[WAIT_UP_BANDS.length-1];const f=(b.pEnd-b.pStart)>0?(x-b.pStart)/(b.pEnd-b.pStart):0;const s=b.sStart+f*(b.sEnd-b.sStart);return Math.max(0,Math.min(86400,Math.round(s/b.step)*b.step));}
function secondsToPosition(s){const r=parseInt(s,10);if(!isFinite(r))return 0;const x=Math.max(0,Math.min(86400,r));const b=WAIT_UP_BANDS.find(z=>x<=z.sEnd)||WAIT_UP_BANDS[WAIT_UP_BANDS.length-1];const f=(b.sEnd-b.sStart)>0?(x-b.sStart)/(b.sEnd-b.sStart):0;return b.pStart+f*(b.pEnd-b.pStart);}
let fails = 0;
function eq(label, got, want) { const ok = got === want; if (!ok) { console.error('FAIL ' + label + ': got ' + got + ' want ' + want); fails++; } else { console.log('OK   ' + label + ': ' + got); } }
function near(label, got, want, tol) { const ok = Math.abs(got - want) <= tol; if (!ok) { console.error('FAIL ' + label + ': got ' + got + ' want ~' + want + ' (tol ' + tol + ')'); fails++; } else { console.log('OK   ' + label + ': ' + got + ' ~ ' + want); } }
eq('positionToSeconds(0)', positionToSeconds(0), 0);
eq('positionToSeconds(100)', positionToSeconds(100), 86400);
eq('positionToSeconds(7)', positionToSeconds(7), 60);
eq('positionToSeconds(22)', positionToSeconds(22), 300);
eq('positionToSeconds(47)', positionToSeconds(47), 1800);
eq('positionToSeconds(67)', positionToSeconds(67), 7200);
eq('secondsToPosition(0)', secondsToPosition(0), 0);
eq('secondsToPosition(86400)', secondsToPosition(86400), 100);
near('round-trip pos=7', secondsToPosition(positionToSeconds(7)), 7, 1);
near('round-trip pos=22', secondsToPosition(positionToSeconds(22)), 22, 1);
near('round-trip pos=47', secondsToPosition(positionToSeconds(47)), 47, 1);
near('round-trip pos=67', secondsToPosition(positionToSeconds(67)), 67, 1);
eq('positionToSeconds(NaN)', positionToSeconds(NaN), 0);
eq("positionToSeconds('garbage')", positionToSeconds('garbage'), 0);
eq('positionToSeconds(-5)', positionToSeconds(-5), 0);
eq('positionToSeconds(150)', positionToSeconds(150), 86400);
// Snap invariant: every position 0..100 step 0.5 produces a multiple of band.step.
let snapFails = 0;
for (let p = 0; p <= 100; p += 0.5) {
  const s = positionToSeconds(p);
  const band = WAIT_UP_BANDS.find(b => p <= b.pEnd) || WAIT_UP_BANDS[WAIT_UP_BANDS.length - 1];
  if (s % band.step !== 0) { snapFails++; if (snapFails < 3) console.error('FAIL snap: p=' + p + ' s=' + s + ' step=' + band.step); }
}
eq('snap invariant', snapFails, 0);
if (fails) { console.error('\nFAILED ' + fails + ' assertion(s)'); process.exit(1); } else { console.log('\nALL ASSERTIONS PASSED'); process.exit(0); }
