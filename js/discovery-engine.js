// Phase 11 / REFR-04 — Discovery engine
// Pure, deterministic, dependency-free rotation engine for the Add tab.
// Given a (userId, dateKey, catalog) triple, returns 7-10 row descriptors
// stable within a single day per user but different across users + days.
//
// PRNG: xmur3 (string-seeded 32-bit hash) → mulberry32 ([0,1) stream).
// Selection: Bucket A always-on (2) + one B (weekday/weekend-aware) + 2-3 C
// + 1-2 D (preferredDays-weighted) + E matching today's weekday + optional F
// when the current date sits inside a seasonal window.

// ---------- PRNGs ----------

// xmur3 — string → 32-bit seed factory. Call the returned fn to pull seeds.
export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

// mulberry32 — seeded PRNG returning [0, 1). 32-bit state.
export function mulberry32(seed) {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- Seasonal window check ----------
// win = { monthStart, dayStart, monthEnd, dayEnd }. Months are 1-12 (calendar).
// Year-spanning windows (e.g. Dec 1 - Jan 1) are supported when monthEnd < monthStart.
export function isInSeasonalWindow(date, win) {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  if (win.monthEnd < win.monthStart) {
    // Year-spanning: inclusive on both ends
    if (m > win.monthStart) return true;
    if (m === win.monthStart && d >= win.dayStart) return true;
    if (m < win.monthEnd) return true;
    if (m === win.monthEnd && d <= win.dayEnd) return true;
    return false;
  }
  if (m < win.monthStart || m > win.monthEnd) return false;
  if (m === win.monthStart && d < win.dayStart) return false;
  if (m === win.monthEnd && d > win.dayEnd) return false;
  return true;
}

// ---------- Daily picker ----------
// Returns 7-10 row descriptors from `catalog` seeded by (userId, dateKey).
// Composition:
//   2 Bucket A (always) + 1 Bucket B (weekday/weekend-aware fallback)
//   + 2-3 Bucket C + 1-2 Bucket D (preferredDays filter) + 1 Bucket E (match weekday)
//   + 0-1 Bucket F (only when active seasonal window).
export function pickDailyRows(userId, dateKey, catalog) {
  const seedFn = xmur3(`${userId}-${dateKey}`);
  const rng = mulberry32(seedFn());
  // Anchor at midday to avoid UTC/DST edge-case flips on the weekday calc.
  const date = new Date(dateKey + 'T12:00:00');
  const dayOfWeek = date.getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

  const out = [];

  // Bucket A — always on, both rows
  out.push(...catalog.filter(r => r.bucket === 'A'));

  // Bucket B — 1 per day, prefer weekday/weekend-tagged rows
  const bRows = catalog.filter(r => r.bucket === 'B');
  const bPreferred = bRows.filter(r => isWeekend ? r.weekendOnly : r.weekdayOnly);
  const bPool = bPreferred.length ? bPreferred : bRows;
  if (bPool.length) out.push(bPool[Math.floor(rng() * bPool.length)]);

  // Bucket C — 2 or 3 random (seeded) discovery rows
  const cRows = catalog.filter(r => r.bucket === 'C');
  const shuffledC = shuffle(cRows, rng);
  out.push(...shuffledC.slice(0, 2 + Math.floor(rng() * 2)));

  // Bucket D — 1 or 2 use-case rows; prefer rows whose preferredDays include today
  const dRows = catalog.filter(r => r.bucket === 'D');
  const dPreferred = dRows.filter(r => r.preferredDays && r.preferredDays.includes(dayOfWeek));
  const dPool = dPreferred.length ? dPreferred : dRows;
  const shuffledD = shuffle(dPool, rng);
  out.push(...shuffledD.slice(0, 1 + Math.floor(rng() * 2)));

  // Bucket E — exactly 1, matches today's weekday
  const eRow = catalog.find(r => r.bucket === 'E' && r.dayOfWeek === dayOfWeek);
  if (eRow) out.push(eRow);

  // Bucket F — 0 or 1, only when a seasonal window is currently active
  const fActive = catalog.filter(r =>
    r.bucket === 'F' && r.seasonalWindow && isInSeasonalWindow(date, r.seasonalWindow)
  );
  if (fActive.length) out.push(fActive[Math.floor(rng() * fActive.length)]);

  return out;
}

// Deterministic Fisher-Yates shuffle using a provided RNG.
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
