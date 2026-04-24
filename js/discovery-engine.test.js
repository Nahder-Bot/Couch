// Phase 11 / REFR-04 — Discovery engine unit tests (node built-in test runner)
// Run: node --test js/discovery-engine.test.js
//
// Determinism + composition contract for xmur3/mulberry32/pickDailyRows/isInSeasonalWindow.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { xmur3, mulberry32, pickDailyRows, isInSeasonalWindow } from './discovery-engine.js';
import { DISCOVERY_CATALOG } from './constants.js';

// ---------- 1. xmur3 deterministic ----------
test('xmur3: same input string produces same output across calls', () => {
  const seedA = xmur3('user-A-2026-04-24');
  const seedB = xmur3('user-A-2026-04-24');
  // Both factory fns called once — should return identical first values
  const a1 = seedA();
  const b1 = seedB();
  assert.equal(a1, b1, 'xmur3 first-call output must match for identical input');
  // Subsequent calls also match
  assert.equal(seedA(), seedB(), 'xmur3 subsequent-call output must match');
});

// ---------- 2. mulberry32 deterministic ----------
test('mulberry32: same seed yields same sequence', () => {
  const rngA = mulberry32(12345);
  const rngB = mulberry32(12345);
  for (let i = 0; i < 10; i++) {
    assert.equal(rngA(), rngB(), `mulberry32 step ${i} must match`);
  }
});

// ---------- 3. pickDailyRows deterministic per (userId, dateKey) ----------
test('pickDailyRows: same (userId, dateKey) yields same selection', () => {
  const a = pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  const b = pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  assert.deepEqual(a, b, 'pickDailyRows must be deterministic for identical inputs');
});

// ---------- 4. pickDailyRows differs across users on same date ----------
test('pickDailyRows: different users on same date see different selections', () => {
  const a = pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  const b = pickDailyRows('user-B', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  const c = pickDailyRows('user-C', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  // At least one of (a vs b, a vs c, b vs c) must differ
  const anyDiffer =
    JSON.stringify(a) !== JSON.stringify(b) ||
    JSON.stringify(a) !== JSON.stringify(c) ||
    JSON.stringify(b) !== JSON.stringify(c);
  assert.ok(anyDiffer, 'At least two different users must produce differing selections on same date');
});

// ---------- 5. pickDailyRows differs across dates for same user ----------
test('pickDailyRows: same user on different dates sees different selections', () => {
  const d1 = pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id);
  const d2 = pickDailyRows('user-A', '2026-04-25', DISCOVERY_CATALOG).map(r => r.id);
  const d3 = pickDailyRows('user-A', '2026-04-26', DISCOVERY_CATALOG).map(r => r.id);
  const anyDiffer =
    JSON.stringify(d1) !== JSON.stringify(d2) ||
    JSON.stringify(d1) !== JSON.stringify(d3) ||
    JSON.stringify(d2) !== JSON.stringify(d3);
  assert.ok(anyDiffer, 'At least two dates must produce differing selections for same user');
});

// ---------- 6. pickDailyRows always includes both Bucket A rows ----------
test('pickDailyRows: both Bucket A rows always present', () => {
  const samples = [
    pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG),
    pickDailyRows('user-B', '2026-05-13', DISCOVERY_CATALOG),
    pickDailyRows('user-C', '2026-10-31', DISCOVERY_CATALOG),
    pickDailyRows('user-D', '2026-12-25', DISCOVERY_CATALOG)
  ];
  for (const rows of samples) {
    const ids = rows.map(r => r.id);
    assert.ok(ids.includes('a1-streaming'), 'a1-streaming must be present');
    assert.ok(ids.includes('a2-couch-into'), 'a2-couch-into must be present');
  }
});

// ---------- 7. pickDailyRows includes E row matching current weekday ----------
test('pickDailyRows: day-of-week E row matches weekday of dateKey', () => {
  // 2026-04-24 is a Friday → dayOfWeek 5 → e-fri
  const rows = pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG);
  const eRows = rows.filter(r => r.bucket === 'E');
  assert.equal(eRows.length, 1, 'exactly one E row expected');
  assert.equal(eRows[0].dayOfWeek, 5, 'E row dayOfWeek must be 5 (Friday) for 2026-04-24');

  // 2026-04-23 is a Thursday → dayOfWeek 4 → e-thu
  const rowsThu = pickDailyRows('user-A', '2026-04-23', DISCOVERY_CATALOG);
  const eRowsThu = rowsThu.filter(r => r.bucket === 'E');
  assert.equal(eRowsThu.length, 1);
  assert.equal(eRowsThu[0].dayOfWeek, 4, 'E row dayOfWeek must be 4 (Thursday) for 2026-04-23');
});

// ---------- 8. pickDailyRows total count is 7-10 ----------
test('pickDailyRows: total count is between 7 and 10', () => {
  // sample a handful of (user, date) pairs — none in a seasonal window
  const pairs = [
    ['user-A', '2026-04-24'], // Friday, no seasonal
    ['user-B', '2026-05-13'], // Wednesday, no seasonal
    ['user-C', '2026-04-20'], // Monday, no seasonal
    ['user-D', '2026-04-25'], // Saturday, no seasonal
    ['user-E', '2026-04-26']  // Sunday, no seasonal
  ];
  for (const [u, d] of pairs) {
    const n = pickDailyRows(u, d, DISCOVERY_CATALOG).length;
    assert.ok(n >= 7 && n <= 10, `count ${n} for ${u}/${d} must be in [7,10]`);
  }
});

// ---------- 9. isInSeasonalWindow — year-spanning Holiday window (Dec 1 - Jan 1) ----------
test('isInSeasonalWindow: Holiday window (Dec 1 - Jan 1) spans year boundary', () => {
  const holiday = { monthStart: 12, dayStart: 1, monthEnd: 1, dayEnd: 1 };
  assert.equal(isInSeasonalWindow(new Date('2026-12-15T12:00:00'), holiday), true, 'Dec 15 in window');
  assert.equal(isInSeasonalWindow(new Date('2026-12-01T12:00:00'), holiday), true, 'Dec 1 in window (start)');
  assert.equal(isInSeasonalWindow(new Date('2026-12-31T12:00:00'), holiday), true, 'Dec 31 in window');
  assert.equal(isInSeasonalWindow(new Date('2027-01-01T12:00:00'), holiday), true, 'Jan 1 in window (end)');
  assert.equal(isInSeasonalWindow(new Date('2027-01-02T12:00:00'), holiday), false, 'Jan 2 out of window');
  assert.equal(isInSeasonalWindow(new Date('2026-11-30T12:00:00'), holiday), false, 'Nov 30 out of window');
  assert.equal(isInSeasonalWindow(new Date('2026-06-15T12:00:00'), holiday), false, 'Jun 15 out of window');
});

// ---------- 10. isInSeasonalWindow — same-month Valentine window (Feb 1-14) ----------
test('isInSeasonalWindow: Valentine window (Feb 1-14)', () => {
  const val = { monthStart: 2, dayStart: 1, monthEnd: 2, dayEnd: 14 };
  assert.equal(isInSeasonalWindow(new Date('2026-02-01T12:00:00'), val), true, 'Feb 1 in window');
  assert.equal(isInSeasonalWindow(new Date('2026-02-07T12:00:00'), val), true, 'Feb 7 in window');
  assert.equal(isInSeasonalWindow(new Date('2026-02-14T12:00:00'), val), true, 'Feb 14 in window');
  assert.equal(isInSeasonalWindow(new Date('2026-02-15T12:00:00'), val), false, 'Feb 15 out');
  assert.equal(isInSeasonalWindow(new Date('2026-01-31T12:00:00'), val), false, 'Jan 31 out');
  assert.equal(isInSeasonalWindow(new Date('2026-03-01T12:00:00'), val), false, 'Mar 1 out');
});
