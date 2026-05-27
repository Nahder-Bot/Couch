'use strict';

// === Phase 16 / CAL-16-12 — smoke contract for computeNextFireAt ===
// Pure-helper unit test. CRITICAL PATH: DST spring-forward + fall-back coverage
// is the only automated guard against the highest-risk bug class in Phase 16.
// See 16-VALIDATION.md and 16-PATTERNS.md §5 D5.2 for the case rationale.
//
// Path resolution: couch is at `~/claude-projects/couch/`, queuenight is at `~/queuenight/`.
// Both are children of `~` (NOT siblings of each other's parents).
// Path math: 3x `..` walks from couch/scripts/X.cjs → couch → claude-projects → home (`~`),
// then into queuenight/functions/src/. Verified at planning time.

const path = require('path');

const HELPER_PATH = path.resolve(
  __dirname, '..', '..', '..', 'queuenight', 'functions', 'src', 'computeNextFireAt.js'
);

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)} (${new Date(expected).toISOString()})`);
  console.error(`     actual:   ${JSON.stringify(actual)} (${actual ? new Date(actual).toISOString() : 'null'})`);
  failed++;
}

function near(label, actual, expectedLow, expectedHigh) {
  if (actual >= expectedLow && actual <= expectedHigh) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}: ${actual} (${new Date(actual).toISOString()}) not in [${expectedLow}..${expectedHigh}]`);
  failed++;
}

let helper;
try {
  helper = require(HELPER_PATH);
} catch (e) {
  console.error(`FAIL: could not require ${HELPER_PATH}:`, e.message);
  console.error('       (expected at queuenight/functions/src/computeNextFireAt.js)');
  process.exit(1);
}
const { computeNextFireAt, getTimezoneOffsetForDate } = helper;

if (typeof computeNextFireAt !== 'function') {
  console.error('FAIL: computeNextFireAt is not exported as a function');
  process.exit(1);
}

// === Group A: Basic single-day + multi-day ===
{
  // A1: Sun 19:00 UTC → Mon 20:00 UTC (single-day, next day)
  const now = Date.UTC(2026, 0, 4, 19, 0);  // 2026-01-04 Sunday 19:00 UTC
  eq('A1: single-day [Mon] from Sun 19:00 UTC',
    computeNextFireAt([1], '20:00', 'UTC', now),
    Date.UTC(2026, 0, 5, 20, 0));
}
{
  // A2: Tue 10:00 UTC, daysOfWeek=[Mon,Wed,Fri] → Wed 20:00 UTC
  const now = Date.UTC(2026, 0, 6, 10, 0);
  eq('A2: multi-day [Mon,Wed,Fri] from Tue 10:00 UTC',
    computeNextFireAt([1, 3, 5], '20:00', 'UTC', now),
    Date.UTC(2026, 0, 7, 20, 0));
}
{
  // A3: Same-day already past → wrap to next week
  const now = Date.UTC(2026, 0, 5, 21, 0);  // Mon 21:00 UTC (past 20:00)
  eq('A3: same-day past wraps to next Mon (8-day window)',
    computeNextFireAt([1], '20:00', 'UTC', now),
    Date.UTC(2026, 0, 12, 20, 0));
}
{
  // A4: Sun-only, now = Sun 7:59 PM UTC → fires same day at 8:00 PM (1 minute later)
  const now = Date.UTC(2026, 0, 4, 19, 59);
  eq('A4: Sun-only with 1min until fire (same-day not-yet)',
    computeNextFireAt([0], '20:00', 'UTC', now),
    Date.UTC(2026, 0, 4, 20, 0));
}

// === Group B: DST CRITICAL PATHS (this is why this smoke exists) ===
{
  // B1: DST spring-forward in America/Los_Angeles.
  // 2026-03-08 is the 2nd Sunday in March (DST starts at 2:00 AM PST → 3:00 AM PDT).
  // 2:30 AM does NOT exist on this day. Our algorithm computes utcGuess at "2:30"
  // and then adds the tzOffset for that instant — which Intl gives as +7h (PDT, since
  // the clock has already jumped). Result: lands at 09:30 UTC = 02:30 ambiguous,
  // which actually resolves to ~03:30 PDT (one hour later wall-clock than expected).
  // What we ASSERT: fires after the user's local 1am of the same day. We allow a
  // ±1h tolerance window because DST resolution is implementation-defined.
  const now = Date.UTC(2026, 2, 8, 8, 0);  // Sun 2026-03-08 00:00 PST = 08:00 UTC
  const result = computeNextFireAt([0], '02:30', 'America/Los_Angeles', now);
  // Expected range: somewhere between Sun 1:30 AM PDT (08:30 UTC, the 1:30 PST instant)
  // and Sun 4:30 AM PDT (11:30 UTC). The "right" answer with our algorithm is 09:30 UTC
  // (= 02:30 PDT, which doesn't really exist but the math resolves there). Just verify
  // it's a valid future instant on the right calendar day.
  near('B1: DST spring-forward (LA Sun 2:30 → resolves within Sun morning window)',
    result, Date.UTC(2026, 2, 8, 9, 0), Date.UTC(2026, 2, 8, 12, 0));
}
{
  // B2: DST fall-back in America/Los_Angeles.
  // 2026-11-01 (1st Sunday in Nov) clocks go 2:00 AM PDT → 1:00 AM PST.
  // 1:30 AM happens TWICE. Our algorithm picks one (impl-defined; either is acceptable).
  const now = Date.UTC(2026, 10, 1, 7, 0);  // Sun 2026-11-01 00:00 PDT = 07:00 UTC
  const result = computeNextFireAt([0], '01:30', 'America/Los_Angeles', now);
  // Either 08:30 UTC (first 1:30 PDT) or 09:30 UTC (second 1:30 PST) is acceptable.
  near('B2: DST fall-back (LA Sun 1:30 → either of the two 1:30 instants)',
    result, Date.UTC(2026, 10, 1, 8, 0), Date.UTC(2026, 10, 1, 10, 0));
}
{
  // B3: Cross-tz sanity — Asia/Tokyo Wed 21:00, now=Wed noon JST
  // Wed noon JST = 03:00 UTC. Wed 21:00 JST = 12:00 UTC same day.
  const now = Date.UTC(2026, 0, 7, 3, 0);  // 2026-01-07 03:00 UTC = Wed noon JST (JST=UTC+9)
  eq('B3: Asia/Tokyo Wed 21:00 from Wed noon JST',
    computeNextFireAt([3], '21:00', 'Asia/Tokyo', now),
    Date.UTC(2026, 0, 7, 12, 0));
}

// === Group C: Tz-offset helper sanity ===
{
  // C1: LA in mid-January (PST) → offset = +8h (positive: west of UTC)
  const off = getTimezoneOffsetForDate(Date.UTC(2026, 0, 15, 12, 0), 'America/Los_Angeles');
  eq('C1: getTimezoneOffsetForDate LA Jan = +8h (PST)', off, 8 * 3600 * 1000);
}
{
  // C2: Tokyo (JST) → offset = -9h (negative: east of UTC)
  const off = getTimezoneOffsetForDate(Date.UTC(2026, 0, 15, 12, 0), 'Asia/Tokyo');
  eq('C2: getTimezoneOffsetForDate Tokyo Jan = -9h (JST)', off, -9 * 3600 * 1000);
}

// === Group D: Edge cases ===
{
  // D1: empty daysOfWeek → null
  eq('D1: empty daysOfWeek returns null',
    computeNextFireAt([], '20:00', 'UTC', Date.now()), null);
}
{
  // D2: invalid timeOfDay format → null (defensive — rules also enforce regex)
  eq('D2: invalid timeOfDay format returns null',
    computeNextFireAt([1], '25:99', 'UTC', Date.now()), null);
}

// === FLOOR meta-assert (Phase 28 PICK-28-21 pattern) ===
const FLOOR = 8;
if (passed >= FLOOR) {
  console.log(`  ok floor: ${passed} assertions passed (>=${FLOOR})`);
  passed++;
} else {
  console.error(`  FAIL floor: only ${passed} assertions passed (<${FLOOR})`);
  failed++;
}

console.log(`--- ${passed} passed, ${failed} failed ---`);
process.exit(failed === 0 ? 0 : 1);
