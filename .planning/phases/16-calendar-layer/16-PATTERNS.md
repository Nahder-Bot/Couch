---
phase: 16-calendar-layer
mapped: 2026-05-27
mapper: gsd-pattern-mapper
files_analyzed: 14
analogs_found: 14 / 14
input_context: 16-CONTEXT.md (scope-locked 2026-05-27) + 16-RESEARCH.md (HIGH confidence, file:line cited)
project_conventions: CLAUDE.md (js/app.js ~15800 lines — no full reads; no bundler; CACHE bump on user-visible changes)
---

# Phase 16 — Calendar Layer — Pattern Map

## File Classification

| # | Target File (NEW / MODIFIED) | Role | Data Flow | Closest Analog | Match Quality |
|---|------------------------------|------|-----------|----------------|---------------|
| 1 | `queuenight/functions/src/watchpartySeriesTick.js` | scheduled CF | batch (materialize) | `queuenight/functions/src/pickReminderTick.js` | EXACT (own-file scheduled CF, lazy-require sendToMembers, ±slop window pattern) |
| 2 | `queuenight/functions/src/computeNextFireAt.js` | pure helper (CJS) | transform | `queuenight/functions/index.js:50-75` (`isInQuietHours`, Intl-based DST-aware tz) | ROLE-MATCH (DST-aware tz helper using Intl, no library) |
| 3 | `scripts/smoke-series-materializer.cjs` | smoke contract | test (CF integration) | `scripts/smoke-pickem.cjs` (Group 6 — gameResultsTick / pickReminderTick sentinels) | EXACT (production-code sentinel pattern + FLOOR meta-assert) |
| 4 | `scripts/smoke-series-idempotency.cjs` | smoke contract | test (deterministic ID) | `scripts/smoke-pickem.cjs` (Group 5 — cross-repo lockstep grep) | ROLE-MATCH (string-grep production-source assertions) |
| 5 | `scripts/smoke-series-cadence-compute.cjs` | smoke contract | test (pure-helper) | `scripts/smoke-pickem.cjs` (Groups 1-4 — pure-helper dynamic-import assertions) | EXACT (await import pure helper, `eq()` harness) |
| 6 | `firestore.rules` (MODIFIED — add `watchpartySeries` block) | rules | request-response | `firestore.rules:160-264` (top-level `/watchparties/{wpId}`) | EXACT (top-level, memberUids-gated read, signedIn() + uid() helpers) |
| 7 | `queuenight/functions/index.js` (MODIFIED — add export + NOTIFICATION_DEFAULTS key) | CF index registration + push gate | config | `queuenight/functions/index.js:79-128` (NOTIFICATION_DEFAULTS) + `:1937` (`exports.pickReminderTick = require(...)`) | EXACT (drop-in append pattern) |
| 8 | `queuenight/functions/index.js` (MODIFIED — extend `watchpartyTick` top-level loop) | scheduled CF branch | event-driven | `queuenight/functions/src/rsvpReminderTick.js:148-258` (in-doc flag pattern: write flag BEFORE send) | EXACT (in-doc `reminders.X.Y = true` then `sendToMembers`) |
| 9 | `js/constants.js` — N/A (NOT used by Phase 16) | — | — | — | NOT APPLICABLE — see Divergence Note A below |
| 10a | `js/app.js` — `DEFAULT_NOTIFICATION_PREFS` add `seriesReminder` (line 443-487) | constants | config | `js/app.js:484` (`pickReminder: true,`) | EXACT (one-line append + comment block) |
| 10b | `js/app.js` — `NOTIFICATION_EVENT_LABELS` add `seriesReminder` (line 497-543) | constants | config | `js/app.js:540` (`pickReminder: { label: ..., hint: ... }`) | EXACT (one-line append) |
| 10c | `js/app.js` — `renderSeriesListCard()` (new fn ~line 15952 after renderSignInMethodsCard) | render fn | DOM | `js/app.js:15864-15951` (`renderSignInMethodsCard()`) | EXACT (Account-tab `tab-section` card, list rows from array.map) |
| 10d | `js/app.js` — `openSeriesCreate()` + `closeSeriesCreate()` + `confirmStartSeries()` | modal handlers | DOM + Firestore write | `js/app.js:11547-11680` (`confirmStartWatchparty`) | ROLE-MATCH (full-screen modal, validation, `setDoc(... + writeAttribution())`) |
| 10e | `js/app.js` — `openSeriesEdit(seriesId)` + `saveSeriesEdit()` | modal handlers | DOM + Firestore update | mirror of 10d + `updateDoc` analog at `js/app.js:5196` (`updateDoc(watchpartyRef(...), { ...writeAttribution(), status })`) | ROLE-MATCH |
| 10f | `js/app.js` — `renderDayOfWeekPicker(targetSelector, currentDows)` component | render fn (UI primitive) | DOM | `app.html:1236-1243` `.wp-lead-grid` + `.wp-lead-btn` markup | ROLE-MATCH (greenfield UI; pattern lifted from wp lead-time picker) |
| 10g | `js/app.js` — `renderWeekViewModal()` | render fn | DOM | NONE — greenfield; see Divergence Note D | NO ANALOG (use research scaffold) |
| 10h | `js/app.js` — `pauseSeries(id)` / `resumeSeries(id)` / `cancelSeries(id)` handlers | action handlers | Firestore update | `js/app.js:5196` (status-update pattern: `updateDoc(..., {...writeAttribution(), status: 'archived'})`) | EXACT |
| 10i | `js/app.js` — `state.unsubSeries` onSnapshot subscription | state subscription | event (snapshot) | `js/app.js:5178-5198` (`state.unsubWatchparties = onSnapshot(...)` pattern) | EXACT |
| 10j | `js/app.js` — post-wp "Make recurring?" prompt (Entry 2) | DOM injection into existing modal | DOM | `js/app.js:13784-13900+` (`openPostSession(wpId)`) + TV-only gate at `:13807` (`if (t && t.kind === 'TV')`) | EXACT (extend existing modal flow with conditional render) |
| 10k | `js/app.js` — Tonight-tab `t-section-actions` CTA injection | DOM render | DOM | `js/app.js:5774+` (`renderTonight()`) + `app.html:393` `#t-section-actions` empty slot | EXACT (empty slot designed for CTAs) |
| 11a | `app.html` — `#series-list-card` markup (Account tab) | HTML markup | static shell | `app.html:674-678` (`#signin-methods-card`) | EXACT (identical 4-line `.tab-section` wrapper) |
| 11b | `app.html` — `#series-create-modal-bg` markup | HTML markup | modal shell | `app.html:1228-1287` (`#wp-start-modal-bg`) | EXACT (modal-bg + modal-x-btn + modal-field-stack) |
| 11c | `app.html` — `#series-edit-modal-bg` markup | HTML markup | modal shell | `app.html:1228-1287` (`#wp-start-modal-bg`) | EXACT (same shape; DOM-shared with create per RESEARCH §11) |
| 11d | `app.html` — `#week-view-modal-bg` markup | HTML markup | modal shell | `app.html:1289-1302` (`#wp-live-modal-bg` — modal with content container injection target) | ROLE-MATCH (modal shell that gets JS-rendered content) |
| 11e | `app.html` — Tonight-tab CTA in `#t-section-actions` | — | — | already empty slot at `app.html:393` — JS-injected; no static markup needed | N/A |
| 11f | `app.html` — "Make recurring?" tile inside `#wp-post-session-modal-bg` (between line 1322 and 1325) | HTML markup | static (conditionally shown via JS) | `app.html:1320-1322` (`.wp-photo-upload` tile) + `app.html:1325` (`.wp-schedule-next-cta`) | EXACT (sibling tile in same modal) |
| 12 | `css/app.css` — `.series-list-card`, `.series-row`, `.series-create-modal`, `.cadence-picker`, `.cadence-day-pill`, `.week-view`, `.week-day-col`, `.series-edit-modal` | CSS | style | `.wp-lead-btn` at `css/app.css:793-796` (cadence pills) + `.signin-method-row` at `css/app.css:3008-3014` (list rows) + `.tab-section` at `:1171-1186` (card wrapper) | ROLE-MATCH (greenfield; mirror tokens from existing controls) |
| 13 | `tests/rules.test.js` — Phase 16 `describe` block (~10 cases for `watchpartySeries`) | rules test | test | `tests/rules.test.js:1002+` (`describe('Phase 30 Couch Groups rules'...)` for top-level wp) | EXACT (assertSucceeds/assertFails harness, #16-NN naming) |
| 14 | `sw.js` — CACHE bump | config | build | `sw.js:8` (current: `'couch-v42-phase-15.3-transparency'`) | EXACT (one-line bump; auto-handled by `scripts/deploy.sh <short-tag>`) |
| 15 | `firestore.indexes.json` — composite indexes for `watchpartySeries` | config | build | `firestore.indexes.json:2-15` (existing `watchparties` collectionGroup composite) | EXACT (same JSON shape, different collectionGroup) |

## Pattern Assignments

---

### 1. `queuenight/functions/src/watchpartySeriesTick.js` (NEW — scheduled CF, materialize batch)

**Analog:** `queuenight/functions/src/pickReminderTick.js`
**Role match:** EXACT — same own-file structure under `src/`, same `onSchedule` boilerplate, same lazy-require sendToMembers pattern, same per-doc try/catch + tally-counter + summary log.

**Imports + admin init pattern** (`pickReminderTick.js:34-40`):
```js
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```

**Lazy-require sendToMembers pattern** (`pickReminderTick.js:65-74`):
```js
// Lazy-require sendToMembers from index.js (mirrors rsvpReminderTick pattern;
// avoids startup-time circular require). The handler tolerates this being
// null (logs + continues) so a missing export doesn't crash the entire tick.
let sendToMembers = null;
try {
  const idx = require('../index.js');
  sendToMembers = idx.sendToMembers || null;
} catch (e) {
  console.error('pickReminderTick: failed to require sendToMembers', e && e.message);
}
```

**onSchedule handler shell** (`pickReminderTick.js:77-92`):
```js
exports.pickReminderTick = onSchedule({
  schedule: 'every 5 minutes',
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  let scanned = 0, fired = 0, alreadySent = 0, errored = 0;

  let families;
  try {
    families = await db.collection('families').get();
  } catch (e) {
    console.error('pickReminderTick: families list failed', e && e.message);
    return null;
  }
```

**Per-doc try/catch + final summary log** (`pickReminderTick.js:181-189`):
```js
        } catch (e) {
          console.warn('pickReminderTick per-member failed', familyCode, wpDoc.id, member.id, e && e.message);
          errored++;
        }
      }
    }
  }
  console.log(`pickReminderTick: scanned=${scanned} fired=${fired} alreadySent=${alreadySent} errored=${errored}`);
  return null;
});
```

**Divergence notes (Phase 16-specific):**
- D1.1 — **Schedule:** `'every 6 hours'` (NOT 5 min). The materializer's job is to write wp docs 24h ahead, not to scan continuously. CONTEXT confirms 6h; RESEARCH §"Cron cadence decision" defends it.
- D1.2 — **Query target:** Top-level `db.collection('watchpartySeries').where('status', '==', 'active').where('nextFireAt', '<=', horizon).orderBy('nextFireAt')` — NOT a per-family loop. Single composite-index-backed query (see file #15 below for the index).
- D1.3 — **Idempotency:** Deterministic `wpId = 'series_' + seriesId + '_' + instanceDateKey` (see RESEARCH §"Idempotency strategy"). This is STRONGER than the `picks_reminders/{id}` sentinel-doc pattern in pickReminderTick — the dedup target IS the wp doc itself, no race window between check + write. Pattern:
  ```js
  const instanceDateKey = new Date(series.nextFireAt)
    .toLocaleDateString('en-CA', { timeZone: series.timezone || 'UTC' });
  const wpId = `series_${seriesDoc.id}_${instanceDateKey}`;
  const wpRef = db.collection('watchparties').doc(wpId);
  const wpSnap = await wpRef.get();
  if (wpSnap.exists) { alreadyExisted++; }
  else { await wpRef.set({ /* wp shape — see RESEARCH §4 body sketch */ }); materialized++; }
  ```
- D1.4 — **No push send in this CF.** The push fan-out happens automatically via `onWatchpartyCreateTopLevel` (Phase 30 trigger) when the materializer does `wpRef.set()`. The 30-min reminder push lives in `watchpartyTick`'s extension (file #8 below). RESEARCH Assumption A1 — verify at planning that `onWatchpartyCreateTopLevel` fires on admin-SDK writes (Firebase docs confirm doc-create triggers fire regardless of write source).
- D1.5 — **Advance `series.nextFireAt`** after each materialization (or already-existed short-circuit). Call `computeNextFireAt(series.daysOfWeek, series.timeOfDay, series.timezone, series.nextFireAt + 60_000)` and `seriesDoc.ref.update({ nextFireAt: newNextFireAt, lastFiredAt: series.nextFireAt })`. See RESEARCH §"`watchpartySeriesTick` body sketch" for the full body.

**Skeleton for the NEW file** (paste, fill in TODOs):
```js
'use strict';

// === Phase 16 — watchpartySeriesTick scheduled CF (CAL-16-03 + idempotency CAL-16-04) ===
//
// Purpose
// -------
// Every 6 hours, materialize the next instance of each active watchpartySeries
// whose nextFireAt is within the next 24h. Writes a wp doc with a deterministic
// id `series_${seriesId}_${instanceDateKey}` so re-runs are idempotent. Push
// fan-out happens automatically via onWatchpartyCreateTopLevel.
//
// Per .planning/phases/16-calendar-layer/16-CONTEXT.md:
//   - Every 6h (Cron cadence decision §"Cloud Function design")
//   - 24h materialization horizon
//   - Idempotency: deterministic wpId pattern
//
// Composite index required (firestore.indexes.json):
//   watchpartySeries: status ASC + nextFireAt ASC

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const { computeNextFireAt } = require('./computeNextFireAt');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

const SERIES_MATERIALIZE_HORIZON_MS = 24 * 60 * 60 * 1000;

exports.watchpartySeriesTick = onSchedule({
  schedule: 'every 6 hours',
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  const horizon = now + SERIES_MATERIALIZE_HORIZON_MS;
  let materialized = 0, advanced = 0, alreadyExisted = 0, errored = 0;

  let seriesSnap;
  try {
    seriesSnap = await db.collection('watchpartySeries')
      .where('status', '==', 'active')
      .where('nextFireAt', '<=', horizon)
      .orderBy('nextFireAt')
      .get();
  } catch (e) {
    console.error('watchpartySeriesTick: query failed', e && e.message);
    return null;
  }

  for (const seriesDoc of seriesSnap.docs) {
    const series = seriesDoc.data() || {};
    try {
      // TODO: compute instanceDateKey + wpId
      // TODO: check wpRef.get().exists → if so, alreadyExisted++ and skip set()
      // TODO: build wp doc per RESEARCH §4 body sketch (Phase 30 shape + seriesId back-ref)
      // TODO: wpRef.set(wp) — admin SDK bypasses rules
      // TODO: compute newNextFireAt via computeNextFireAt(...)
      // TODO: seriesDoc.ref.update({ nextFireAt: newNextFireAt, lastFiredAt: series.nextFireAt })
    } catch (e) {
      console.warn('watchpartySeriesTick per-series failed', seriesDoc.id, e && e.message);
      errored++;
    }
  }
  console.log(`watchpartySeriesTick: materialized=${materialized} advanced=${advanced} alreadyExisted=${alreadyExisted} errored=${errored}`);
  return null;
});
```

---

### 2. `queuenight/functions/src/computeNextFireAt.js` (NEW — pure helper, transform)

**Analog:** `queuenight/functions/index.js:50-75` (`isInQuietHours` — the only existing DST-aware Intl-based tz computation in the queuenight repo).

**Why this pattern:** RESEARCH §"Timezone handling" (lines 314-380) defends the Intl-based hand-rolled approach over importing luxon. Couch has 4+ existing tz-aware sites using raw Intl (js/app.js:2172, 10821, 11032, 11571 + the queuenight `isInQuietHours`) — one more is fine; no bundler / no new dep.

**Pattern (from `isInQuietHours` — Intl-based parts extraction):**
```js
const parts = new Intl.DateTimeFormat('en-US', {
  timeZone: timezone, weekday: 'short', year: 'numeric',
  month: '2-digit', day: '2-digit', hour: '2-digit',
  minute: '2-digit', hour12: false
}).formatToParts(date);
const weekdayName = parts.find(p => p.type === 'weekday').value;
const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekdayName);
```

**Divergence notes:**
- D2.1 — Pure helper (no admin/onSchedule/db) so `scripts/smoke-series-cadence-compute.cjs` can import it directly. Mirrors how `js/pickem.js` exposes pure helpers consumed by both `scripts/smoke-pickem.cjs` and CFs.
- D2.2 — Module shape MUST be CommonJS (`module.exports = { computeNextFireAt };`) — CF runtime is CJS. Smoke script uses `require()` not dynamic `import()`. (Contrast: `smoke-pickem.cjs` uses `await import()` because `js/pickem.js` is ESM. Phase 16 helper is in queuenight/functions/ which is CJS so straight `require()`.)
- D2.3 — Full algorithm in RESEARCH §"Timezone handling" lines 332-376. Includes the `getTimezoneOffsetForDate(utcMs, timezone)` Intl trick (no library), DST spring-forward + fall-back handling.

**Skeleton:**
```js
'use strict';

// === Phase 16 — computeNextFireAt: DST-aware cadence helper (CAL-16-12) ===
// Pure function — no admin, no Firestore. Importable from:
//   - queuenight/functions/src/watchpartySeriesTick.js (server)
//   - scripts/smoke-series-cadence-compute.cjs (test)
//   - (future) js/app.js via Cloud Function callable or duplicated copy
//
// Why no luxon / no tz library: CLAUDE.md "no bundler" rule + Intl-based
// pattern is verified at queuenight/functions/index.js:50-75 (isInQuietHours).

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * @param {number[]} daysOfWeek  0=Sun .. 6=Sat (e.g. [1,3] for Mon+Wed)
 * @param {string} timeOfDayHHMM 'HH:MM' 24h in series.timezone
 * @param {string} timezone      IANA name (e.g. 'America/Los_Angeles')
 * @param {number} [now]         epoch ms; default Date.now()
 * @returns {number | null}      epoch ms of next fire (or null if daysOfWeek empty)
 */
function computeNextFireAt(daysOfWeek, timeOfDayHHMM, timezone, now) {
  // TODO: see RESEARCH §"Timezone handling" lines 332-376 for the full body
}

function getTimezoneOffsetForDate(utcMs, timezone) {
  // TODO: see RESEARCH §"Timezone handling" lines 367-376 — Intl trick to derive
  // tz offset for a specific instant (DST-correct).
}

module.exports = { computeNextFireAt, getTimezoneOffsetForDate };
```

---

### 3. `scripts/smoke-series-materializer.cjs` (NEW — CF integration smoke)

**Analog:** `scripts/smoke-pickem.cjs` Group 6 (gameResultsTick + pickReminderTick CF sentinels at lines 235-249+).

**Why this analog:** Phase 16 has no Firestore emulator integration test in scope (matches scripts/smoke-*.cjs convention — these are production-source-grep contracts, not runtime integration tests). The pickReminderTick sentinels at `scripts/smoke-pickem.cjs:235-249` are the closest pattern: grep production source for required literal strings + count assertions.

**Imports + harness pattern** (`smoke-pickem.cjs:30-65`):
```js
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)}`);
  console.error(`     actual:   ${JSON.stringify(actual)}`);
  failed++;
}

function eqContains(label, fileContent, needle) {
  if (fileContent === null) {
    console.log(`  skip ${label} (file not present in this checkout)`);
    return;
  }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     missing substring: ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');
```

**Production-code sentinel block** (`smoke-pickem.cjs:241-249`):
```js
const grtPath = path.resolve(QN_FUNCTIONS, 'src', 'gameResultsTick.js');
const prtPath = path.resolve(QN_FUNCTIONS, 'src', 'pickReminderTick.js');
const grt = readIfExists(grtPath);
const prt = readIfExists(prtPath);
const idxJson = readIfExists(path.join(COUCH_ROOT, 'firestore.indexes.json'));
const fnIdx = readIfExists(path.join(QN_FUNCTIONS, 'index.js'));

eqContains('6.A gameResultsTick CF exists + onSchedule registration', grt, 'exports.gameResultsTick = onSchedule');
```

**FLOOR meta-assert** (`smoke-app-parse.cjs:77-83` — every smoke ends with this):
```js
const FLOOR = 6;
if (passed >= FLOOR) {
  console.log(`  ok floor: ${passed} modules parsed (>=${FLOOR})`);
  passed++;
} else {
  console.error(`  FAIL floor: only ${passed} modules parsed (<${FLOOR})`);
  failed++;
}

console.log(`--- ${passed} passed, ${failed} failed ---`);
process.exit(failed === 0 ? 0 : 1);
```

**Divergence notes:**
- D3.1 — Path constants: `WSTICK_PATH = path.resolve(QN_FUNCTIONS, 'src', 'watchpartySeriesTick.js')`.
- D3.2 — Required sentinels: `exports.watchpartySeriesTick = onSchedule`, `schedule: 'every 6 hours'`, `region: 'us-central1'`, `SERIES_MATERIALIZE_HORIZON_MS`, `db.collection('watchpartySeries')`, `where('status', '==', 'active')`, `series_${`/`series_$\{` (deterministic wpId prefix), `seriesId:`, `seriesInstanceDateKey:`.
- D3.3 — Cross-repo: also grep `queuenight/functions/index.js` for `exports.watchpartySeriesTick = require('./src/watchpartySeriesTick')` (export registration sentinel).
- D3.4 — Index sentinel: grep `firestore.indexes.json` for `"collectionGroup": "watchpartySeries"`.
- D3.5 — `watchpartyTick` extension sentinel: grep `queuenight/functions/index.js` for `wp.seriesId &&` and `reminders.seriesReminder.t-30min` (CAL-16-05 in-doc flag pattern).
- D3.6 — `FLOOR = 8` (or higher — count assertions and lock floor after writing tests).

---

### 4. `scripts/smoke-series-idempotency.cjs` (NEW — deterministic-id pattern verifier)

**Analog:** `scripts/smoke-pickem.cjs` Group 5 cross-repo lockstep grep (lines 221-233).

**Cross-repo lockstep grep pattern** (`smoke-pickem.cjs:221-233`):
```js
// === Group 5 — Cross-repo lockstep for 3 pick'em push event keys (PICK-28-17) ===
// 9 assertions = 3 keys × 3 maps. Catches the "added key to client but not
// server" or vice-versa drift before deploy. Mirrors Phase 14 D-12 lockstep
// convention (DR-3 three-place add).
{
  const appJs = readIfExists(path.join(COUCH_ROOT, 'js', 'app.js'));
  const fnIdx = readIfExists(path.join(QN_FUNCTIONS, 'index.js'));
  for (const key of ['pickReminder', 'pickResults', 'pickemSeasonReset']) {
    eqContains(`5.lockstep client DEFAULT_NOTIFICATION_PREFS has ${key}`, appJs, `${key}: true`);
    eqContains(`5.lockstep client NOTIFICATION_EVENT_LABELS has ${key}`, appJs, `${key}:`);
    eqContains(`5.lockstep server NOTIFICATION_DEFAULTS has ${key}`, fnIdx, `${key}: true`);
  }
}
```

**Divergence notes:**
- D4.1 — Phase 16 lockstep is ONE key (`seriesReminder`) × 3 maps = 3 assertions. Mirror the loop with `['seriesReminder']` as the key list.
- D4.2 — ADD an assertion specific to the deterministic-wpId pattern: grep `queuenight/functions/src/watchpartySeriesTick.js` for the literal `series_` prefix string in the wpId construction line (e.g. `eqContains('idemp.A deterministic wpId prefix', wstick, 'series_${seriesDoc.id}_${instanceDateKey}')` — or the template-literal equivalent).
- D4.3 — ADD an assertion that the CF performs a `wpRef.get()` existence check BEFORE `set()`: `eqContains('idemp.B existence check before set', wstick, 'wpSnap.exists')`.
- D4.4 — ADD an assertion that no `Date.now()` or `Math.random()` is used in the wpId construction (would defeat determinism). Use a negative-content check: `if (wstickWpIdLine.includes('Date.now') || wstickWpIdLine.includes('Math.random'))` → FAIL.

---

### 5. `scripts/smoke-series-cadence-compute.cjs` (NEW — pure-helper unit test)

**Analog:** `scripts/smoke-pickem.cjs` Groups 1-4 (pure helper assertions via dynamic import at lines 70-219).

**Dynamic import pattern** (`smoke-pickem.cjs:70-83` — but ESM):
```js
(async () => {
  let pickem;
  try {
    pickem = await import(pathToFileURL(PICKEM_PATH).href);
  } catch (e) {
    console.error('FAIL: could not import js/pickem.js:', e.message);
    process.exit(1);
  }
  const {
    slateOf, latestGameInSlate, scorePick, validatePickSelection,
    summarizeMemberSeason, compareMembers,
    PICK_TYPE_BY_LEAGUE, PICK_REMINDER_OFFSET_MS
  } = pickem;
```

**Pure-helper assertion pattern** (`smoke-pickem.cjs:87-128` — single-game / multi-game / edge cases):
```js
// 1A: NFL Thursday single-game slate
{
  const thu = Date.UTC(2025, 10, 13, 0, 30);  // Nov 13 2025 00:30 UTC
  const slate = slateOf([{startTime: thu, league: 'nfl'}], 'nfl', '2025-11-13');
  eq('1A: NFL Thursday single-game slate length', slate.length, 1);
}
```

**Divergence notes:**
- D5.1 — `computeNextFireAt` is CJS (queuenight/functions/src/ is CJS) so the import is **synchronous `require()`**, NOT `await import()`. Skip the IIFE wrapper. Compare to `smoke-position-transform.cjs` (CJS-only target) for the simpler pattern.
- D5.2 — Required test cases per RESEARCH §"Wave 0 Gaps":
  - Single-day Mon at 20:00 UTC, now=Sun 19:00 UTC → fires Mon 20:00 UTC (next day)
  - Multi-day [Mon, Wed, Fri] at 20:00, now=Tue 10:00 → fires Wed 20:00
  - Same-day already-past: now=Mon 21:00 with daysOfWeek=[1] → fires NEXT Mon (8-day wraparound)
  - **DST spring-forward critical case:** `America/Los_Angeles`, daysOfWeek=[0] (Sun), timeOfDay='02:30', now=`2026-03-08T01:00:00-08:00` → expect 03:30 PDT (2:30 doesn't exist).
  - **DST fall-back:** `America/Los_Angeles`, Sun 01:30, now just before fall-back → fires at the first 01:30 instance (the pre-DST one), not the duplicate.
  - Sun-only with `now = Sun 7:59 PM` → fires same day at 8:00 PM (RESEARCH explicit case).
  - Cross-tz: `Asia/Tokyo` Wed at 21:00, now=Wed 12:00 JST → fires same day 21:00 JST = 12:00 UTC.
- D5.3 — FLOOR for this file: ~8-12 assertions (one per critical case + boundary).

---

### 6. `firestore.rules` (MODIFIED — append `watchpartySeries` block)

**Analog:** `firestore.rules:160-264` (the top-level `/watchparties/{wpId}` block — Phase 30).

**Top-level read rule pattern** (`firestore.rules:161`):
```
allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
```

**Create rule pattern with familyCode + isMemberOfFamily check** (`firestore.rules:198-206`):
```
allow create: if signedIn()
  && request.resource.data.hostUid == uid()
  && request.auth.uid in request.resource.data.memberUids
  && request.resource.data.hostFamilyCode is string
  && request.resource.data.families == [request.resource.data.hostFamilyCode]
  && request.resource.data.crossFamilyMembers is list
  && request.resource.data.crossFamilyMembers.size() == 0
  && exists(/databases/$(database)/documents/families/$(request.resource.data.hostFamilyCode))
  && exists(/databases/$(database)/documents/users/$(uid())/groups/$(request.resource.data.hostFamilyCode));
```

**Update rule with inline attribution (CR-05 pattern) + affectedKeys allowlist (CR-06 pattern)** (`firestore.rules:226-256`):
```
allow update: if signedIn()
  && request.auth.uid in resource.data.memberUids
  && request.resource.data.actingUid == request.auth.uid
  && request.resource.data.memberId is string
  && request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')
  && (
    !('managedMemberId' in request.resource.data)
    || (
      request.resource.data.managedMemberId is string
      && request.resource.data.managedMemberId.matches('^m_[A-Za-z0-9_-]+$')
    )
  )
  && (
    // Path A: host — any field allowed.
    ('hostUid' in resource.data && resource.data.hostUid == request.auth.uid)
    ||
    // Path B: non-host limited to specific safe fields (allowlist).
    request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'reactions', 'rsvps', 'archivedAt', 'participants', 'lastActivityAt',
      'actingUid', 'managedMemberId', 'memberId', 'memberName'
    ])
  );
```

**Delete rule** (`firestore.rules:263`):
```
allow delete: if false;
```

**Helpers in scope** (`firestore.rules:26-32`):
```
function signedIn() { return request.auth != null; }
function uid() { return request.auth.uid; }
```

**Divergence notes for Phase 16 block:**
- D6.1 — `watchpartySeries` does NOT have `hostUid` or `participants` — it has `createdBy` (memberId), `createdByUid`, `memberUids[]`. So Path A guard becomes `resource.data.createdByUid == request.auth.uid` (creator-only).
- D6.2 — Create-time invariants change: require `createdBy is string`, `createdByUid == uid()`, `request.auth.uid in memberUids`, `familyCode` exists in caller's groups index, `status == 'active'`, `daysOfWeek is list && daysOfWeek.size() >= 1 && daysOfWeek.size() <= 7`, `timeOfDay is string && matches('^[0-2][0-9]:[0-5][0-9]$')`, `timezone is string && size() > 0`, `titleType in ['tv', 'untitled']`.
- D6.3 — Update allowlist for non-creator: empty (only creator can edit). For creator: allow `daysOfWeek, timeOfDay, timezone, memberUids, titleId, titleName, status, pausedAt, endedAt, nextFireAt, lastFiredAt` + the 4 attribution fields (`actingUid, managedMemberId, memberId, memberName`).
- D6.4 — **Block titleType change post-create** (CONTEXT requirement): `resource.data.titleType == request.resource.data.titleType` invariant.
- D6.5 — Delete `if false` (soft-delete via `status: 'ended'` — matches CDX-4 / Phase 30 pattern).
- D6.6 — See RESEARCH §"Integration map §6" lines 278-310 for the full sketch.

---

### 7. `queuenight/functions/index.js` (MODIFIED — append export + NOTIFICATION_DEFAULTS key)

**Analog:** `queuenight/functions/index.js:1937` (`exports.pickReminderTick = require('./src/pickReminderTick').pickReminderTick;`) + `:121-128` (PICK-28-17 NOTIFICATION_DEFAULTS append).

**Export registration pattern** (`index.js:1936-1937`):
```js
exports.gameResultsTick = require('./src/gameResultsTick').gameResultsTick;
exports.pickReminderTick = require('./src/pickReminderTick').pickReminderTick;
```

**NOTIFICATION_DEFAULTS append pattern** (`index.js:121-128`):
```js
// === Phase 28 / D-06 (PICK-28-17) — pick'em push categories (DR-3 server place 1 of 3).
// All default ON; intent-rich engagement signal — fires only when the user has
// actively engaged with the pick'em surface (submitted picks, joined a league).
// Lockstep with client DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS in js/app.js.
pickReminder: true,
pickResults: true,
pickemSeasonReset: true
```

**Divergence notes:**
- D7.1 — Add export at line ~1937 (after pickReminderTick):
  ```js
  // Phase 16 / CAL-16-03 — recurring watchparty materializer
  exports.watchpartySeriesTick = require('./src/watchpartySeriesTick').watchpartySeriesTick;
  ```
- D7.2 — Add to `NOTIFICATION_DEFAULTS` Object.freeze block (`index.js:79-128`) — single key, default ON, with DR-3 lockstep comment:
  ```js
  // === Phase 16 / CAL-16-06 — seriesReminder push category (DR-3 server place 1 of 3).
  // Default ON: fires only when the user has actively engaged by creating or
  // being added to a recurring watchparty series. Lockstep with
  // js/app.js DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS.
  seriesReminder: true
  ```
- D7.3 — Add to comma-list correctly — `pickemSeasonReset: true` is currently the last key (no trailing comma). Add comma after `pickemSeasonReset: true`, then the new `seriesReminder` line.

---

### 8. `queuenight/functions/index.js` (MODIFIED — extend `watchpartyTick` top-level loop with seriesReminder branch)

**Analog:** `queuenight/functions/src/rsvpReminderTick.js:148-282` — the in-doc-flag-set-BEFORE-send idempotency pattern.

**Atomic flag-set BEFORE send pattern** (`rsvpReminderTick.js:179, 249-257`):
```js
updates[`reminders.${pid}.${w.key}`] = true;
// ...
// Atomic flag-set BEFORE send to prevent double-send under retry/concurrency.
try {
  await doc.ref.update(updates);
} catch (updateErr) {
  console.error('rsvpReminderTick: failed to set reminder flags', {
    wp: doc.id, err: String(updateErr)
  });
  continue;
}
```

**sendToMembers call site pattern** (`rsvpReminderTick.js:262-272`):
```js
await sendToMembers(familyCode, [s.participantId], {
  title: s.title,
  body: s.body,
  tag: `wp-rsvp-reminder-${doc.id}-${s.participantId}-${s.key}`,
  url: `/app?wp=${doc.id}`
}, {
  excludeMemberId: null,
  eventType: 'rsvpReminder'
});
```

**watchpartyTick TOP-LEVEL loop** (`queuenight/functions/index.js:1161-1205`) — Phase 16 branch goes HERE (inside the top-level wp sweep, NOT the legacy nested loop):
```js
const topLevelWpSnap = await db.collection('watchparties').get();
for (const doc of topLevelWpSnap.docs) {
  const wp = doc.data();
  try {
    if (wp.status === 'scheduled' && (wp.startAt || 0) <= now) {
      // ... flip to active or archive stale ...
    }
    // ... majority-ready early-start ...
    // ... archive empty active ...
    // === PHASE 16 NEW BRANCH GOES HERE — BEFORE the per-doc catch ===
  } catch (e) {
    console.warn('watchpartyTick top-level per-doc failed', doc.id, e.message);
    errored++;
  }
}
```

**Divergence notes:**
- D8.1 — **Site:** Insert inside the **top-level** wp loop at `index.js:1161-1205`, NOT the legacy nested loop at `:1207-1251`. RESEARCH §4 explicit caveat: series-materialized wps live at top-level only.
- D8.2 — Gate on `wp.seriesId && wp.status === 'scheduled' && wp.startAt`. Skip non-series wps.
- D8.3 — Slop window: ±5 min around T-30min (watchpartyTick is every-5-min cadence). `if (minutesBefore <= 35 && minutesBefore >= 25)`.
- D8.4 — In-doc flag: `wp.reminders.seriesReminder['t-30min']`. Write flag BEFORE send (mirror rsvpReminderTick:251).
- D8.5 — `tag: \`series-reminder-${wp.seriesId}-${wp.seriesInstanceDateKey}\`` (deterministic — OS-level notification dedup).
- D8.6 — `eventType: 'seriesReminder'` (the new key from file #7 above).
- D8.7 — Push copy per RESEARCH §3: title `'Couch in 30 min'`, body `\`"${wp.titleName || 'Family movie night'}" — your weekly couch night is coming up.\``.
- D8.8 — Full skeleton in RESEARCH §"30-min reminder push — extend `watchpartyTick`" lines 701-723.

---

### 9. `js/constants.js` — NOT MODIFIED (Divergence Note A)

**Divergence Note A:** Despite the upstream prompt mentioning `js/constants.js`, **all Phase 16 notification-pref constants live in `js/app.js`** (not js/constants.js). Verified by Grep:
- `DEFAULT_NOTIFICATION_PREFS` is at `js/app.js:443` (not in js/constants.js).
- `NOTIFICATION_EVENT_LABELS` is at `js/app.js:497` (not in js/constants.js).

The DR-3 lockstep pattern (Phase 14 / Phase 28 PICK-28-17) confirms all 3 places live in 2 files only: server `queuenight/functions/index.js` + client `js/app.js`. js/constants.js is for TMDB / Trakt / COLORS / moods only.

→ **Action for planner:** Drop js/constants.js from the modified-files list. Replace with the two distinct edit sites in js/app.js (see files 10a + 10b below).

---

### 10a. `js/app.js` — append `seriesReminder: true` to `DEFAULT_NOTIFICATION_PREFS` (line ~487)

**Analog:** `js/app.js:484` (`pickReminder: true,`) — Phase 28 / PICK-28-17 / DR-3 place 2 of 3.

**Pattern** (`js/app.js:480-487`):
```js
// === Phase 28 / D-06 (PICK-28-17) — pick'em push categories (DR-3 client place 1 of 2).
// Mirror of queuenight NOTIFICATION_DEFAULTS — must stay in lockstep. All three
// default ON: pick'em fires only when the user has actively engaged with the
// pick'em surface (submitted picks, joined a league season).
pickReminder: true,
pickResults: true,
pickemSeasonReset: true
```

**Divergence:**
- D10a.1 — Append `seriesReminder: true` after `pickemSeasonReset: true` (last key currently — needs trailing comma added).
- D10a.2 — Add lockstep comment block (mirror `pickReminder` precedent):
  ```js
  // === Phase 16 / CAL-16-06 — seriesReminder push category (DR-3 client place 1 of 2).
  // Mirror of queuenight NOTIFICATION_DEFAULTS. Default ON: fires only when
  // the user has created or been added to a recurring watchparty series.
  seriesReminder: true
  ```

---

### 10b. `js/app.js` — append `seriesReminder` to `NOTIFICATION_EVENT_LABELS` (line ~543)

**Analog:** `js/app.js:540-542` (`pickReminder: { label: ..., hint: ... }`) — Phase 28 / PICK-28-17 / DR-3 place 3 of 3.

**Pattern** (`js/app.js:540-542`):
```js
pickReminder:      { label: 'Game starting soon — make your pick',   hint: "Heads-up your pick'em deadline is in 15 minutes." },
pickResults:       { label: "Pick'em results",                       hint: 'When games you picked finish.' },
pickemSeasonReset: { label: "Pick'em season reset",                  hint: "When your league's season turns over." }
```

**Divergence:**
- D10b.1 — Append after `pickemSeasonReset`. BRAND-voice copy per RESEARCH §3:
  ```js
  seriesReminder: { label: 'Recurring watchparty reminder', hint: 'Heads-up that a series instance is starting in 30 minutes.' }
  ```
- D10b.2 — Friendly-UI parity (`NOTIF_UI_TO_SERVER_KEY` map at `:549`) is **intentionally SKIPPED** per Phase 14-09 DR-3 follow-up override + Phase 28 precedent (see RESEARCH §3 last paragraph). Only the 2 legacy places get touched.

---

### 10c. `js/app.js` — `renderSeriesListCard()` new function (~line 15952, after renderSignInMethodsCard)

**Analog:** `js/app.js:15864-15951` (`renderSignInMethodsCard()`).

**Pattern — section header + visibility gate** (`js/app.js:15864-15870`):
```js
function renderSignInMethodsCard() {
  const card = document.getElementById('signin-methods-card');
  const list = document.getElementById('signin-methods-list');
  if (!card || !list) return;
  // Only render when signed-in (auth present). Hide outright for legacy/unauthed.
  if (!auth || !auth.currentUser) { card.style.display = 'none'; return; }
  card.style.display = '';
```

**Pattern — row HTML build + join** (`js/app.js:15872-15919`):
```js
const rows = [];
rows.push(`
  <div class="signin-method-row">
    <div class="signin-method-icon">G</div>
    <div class="signin-method-body">
      <div class="signin-method-label">Google</div>
      <div class="signin-method-meta">${providers.includes('google.com') ? escapeHtml(auth.currentUser.email || 'Linked') : 'Not linked'}</div>
    </div>
    ${providers.includes('google.com') ? '<span class="signin-method-check" aria-label="Linked">&#10003;</span>' : ''}
  </div>`);
// ... more rows ...
list.innerHTML = rows.join('');
```

**Callsite pattern** (`js/app.js:6711` inside `renderSettings()`):
```js
try { renderSignInMethodsCard(); } catch(e) {}
```

**Divergence notes:**
- D10c.1 — Visibility gate: `if (!state.familyCode) { card.style.display = 'none'; return; }` + `const series = (state.series || []).filter(s => s.status !== 'ended');` + `if (!series.length) { card.style.display = 'none'; return; }`.
- D10c.2 — Per-row markup includes title/cadence-summary/next-fire/last-fire + Pause + Cancel buttons + tap-to-edit handler. Rows are richer than signin-method-row — they have a button row (pause/cancel) and a tap-target. Use `.series-row` CSS class (new) over `.signin-method-row`.
- D10c.3 — Cadence summary helper: format `daysOfWeek` → "Mon + Wed at 8pm". Pure helper, define adjacent.
- D10c.4 — Add callsite in `renderSettings()` at `js/app.js:6711` (next to `renderSignInMethodsCard()`):
  ```js
  try { renderSeriesListCard(); } catch(e) {}
  ```

---

### 10d. `js/app.js` — `openSeriesCreate()` / `closeSeriesCreate()` / `confirmStartSeries()`

**Analog:** `js/app.js:11547-11680` (`confirmStartWatchparty` — modal-driven Firestore-write entry).

**Pattern — auth + family + members guard** (`js/app.js:11548-11557`):
```js
window.confirmStartWatchparty = async function() {
  if (!wpStartTitleId || !state.me) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15
  if (!state.auth || !state.auth.uid) { flashToast('Sign in to start a watchparty.', { kind: 'warn' }); return; }
  if (!Array.isArray(state.members) || state.members.length === 0) {
    flashToast('Loading your couch — try again in a sec.', { kind: 'warn' });
    return;
  }
```

**Pattern — Intl tz capture** (`js/app.js:11571-11574`):
```js
const creatorTimeZone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch (e) { return null; }
})();
```

**Pattern — id mint + memberUids construction** (`js/app.js:11567, 11607-11611`):
```js
const id = 'wp_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
// ...
memberUids: Array.from(new Set([
  (state.auth && state.auth.uid) || null,
  ...((state.members || []).map(m => m && m.uid).filter(Boolean))
])).filter(Boolean),
```

**Pattern — setDoc with writeAttribution** (`js/app.js:11614`):
```js
await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
logActivity('wp_started', { titleName: t.name });
document.getElementById('wp-start-modal-bg').classList.remove('on');
deactivateFocusTrap();
```

**Divergence notes:**
- D10d.1 — Id format: `'series_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8)` (matches doc-id convention in RESEARCH data-model table).
- D10d.2 — `nextFireAt` must be computed CLIENT-SIDE using a parallel `computeNextFireAt` (duplicate the helper inline since js/app.js can't `require()` from the queuenight repo). Alternative: defer to first CF tick — set `nextFireAt: Date.now()` (eligible immediately) and let the CF compute the real next fire on first run. **RECOMMEND the latter** (simpler, single source of truth in CF). Planner to decide.
- D10d.3 — `seriesRef(id)` helper needs to be added to js/app.js (analog: `watchpartyRef(id)` at the same module — collection('watchparties').doc(id), so `seriesRef(id) = doc(db, 'watchpartySeries', id)`).
- D10d.4 — Series doc shape per RESEARCH §"Data model proposal" — `familyCode, createdBy (memberId), createdByUid (auth.uid), createdAt, titleType, titleId?, titleName?, daysOfWeek, timeOfDay, timezone, memberUids, status: 'active', nextFireAt, ...writeAttribution()`.
- D10d.5 — Modal close: `document.getElementById('series-create-modal-bg').classList.remove('on');` + `deactivateFocusTrap();`.

---

### 10e. `js/app.js` — `openSeriesEdit(seriesId)` / `saveSeriesEdit()`

**Analog:** 10d (create handlers) + status-update pattern at `js/app.js:5196`:
```js
try { updateDoc(watchpartyRef(wp.id), { ...writeAttribution(), status: 'archived' }); } catch(e){}
```

**Divergence notes:**
- D10e.1 — DOM shared with create modal per RESEARCH §11. Toggle title-field editability based on `state.seriesEdit.mode = 'edit'` AND `state.seriesEdit.titleType === 'tv'`.
- D10e.2 — On save: recompute `nextFireAt` from new cadence (or set to `Date.now()` and let CF advance — see D10d.2).
- D10e.3 — `updateDoc(seriesRef(id), { daysOfWeek, timeOfDay, timezone, memberUids, titleId?, titleName?, nextFireAt, ...writeAttribution() })`.
- D10e.4 — Per-CONTEXT: titleType cannot change (rule blocks it — D6.4). UI must disable the title-type toggle in edit mode.

---

### 10f. `js/app.js` — `renderDayOfWeekPicker(targetSelector, currentDows)` UI component

**Analog (UI primitive):** `app.html:1236-1243` `.wp-lead-grid` / `.wp-lead-btn` markup pattern; CSS at `css/app.css:793-796`.

**Markup pattern** (`app.html:1236-1243`):
```html
<div class="wp-lead-grid" id="wp-lead-grid">
  <button class="wp-lead-btn" data-lead="0">Now</button>
  <button class="wp-lead-btn" data-lead="5">5 min</button>
  <button class="wp-lead-btn on" data-lead="15">15 min</button>
  <button class="wp-lead-btn" data-lead="30">30 min</button>
  <button class="wp-lead-btn" data-lead="60">1 hour</button>
  <button class="wp-lead-btn" data-lead="schedule">Pick date & time</button>
</div>
```

**CSS** (`css/app.css:793-796`):
```css
.wp-lead-btn{padding:12px 8px;background:linear-gradient(135deg,var(--surface) 0%,var(--bg-2) 100%);border:1px solid var(--border);border-radius:var(--r-md);color:var(--ink);font-family:inherit;font-size:var(--t-meta);cursor:pointer;transition:border-color var(--t-quick)}
.wp-lead-btn:hover{border-color:var(--accent)}
.wp-lead-btn.on{background:var(--accent);color:var(--bg);border-color:var(--accent);font-weight:600}
```

**Divergence notes:**
- D10f.1 — Greenfield component. Render 7 buttons (S/M/T/W/T/F/S) per RESEARCH §9 line 412-421.
- D10f.2 — State sync: toggle `.on` class on click + write back to `state.seriesEdit.daysOfWeek`. Use `data-dow="0"..."6"` attribute (matches `data-lead` pattern).
- D10f.3 — Time-of-day input: `<input type="time" id="series-time-input" class="form-input-block">` (native iOS Safari + Android Chrome support is solid — RESEARCH §9 line 425).
- D10f.4 — CSS classes: `.cadence-picker` (wrapper, mirrors `.wp-lead-grid` 7-col grid) + `.cadence-day-pill` (mirrors `.wp-lead-btn`).

---

### 10g. `js/app.js` — `renderWeekViewModal()` (week-view UI)

**Analog:** NONE — greenfield. RESEARCH §10 "no existing calendar surface in the codebase."

**Divergence Note D — Greenfield component, no existing analog:**
- D10g.1 — RECOMMEND: dedicated modal launched from Account-tab "Calendar view" button (RESEARCH §10 line 432-433).
- D10g.2 — Mobile-first: 1-column day stack on viewport <600px; 7-column grid on tablet/desktop (RESEARCH §10 line 445-449).
- D10g.3 — CSS scaffolding in RESEARCH §10 lines 437-443.
- D10g.4 — Render source: builds 7-day grid from `state.series` (subscribe via 10i) + materialized `state.watchparties` (already subscribed at `js/app.js:5178-5198`).
- D10g.5 — Tap-an-event handler: navigate to wp banner using existing pattern `state.activeWatchpartyId = wpId; showScreen('home'); renderTonight();` (search for the pattern in renderWatchpartyBanner / Tonight tab handlers).

---

### 10h. `js/app.js` — `pauseSeries(id)` / `resumeSeries(id)` / `cancelSeries(id)` handlers

**Analog (status update):** `js/app.js:5196` — status-flip pattern:
```js
try { updateDoc(watchpartyRef(wp.id), { ...writeAttribution(), status: 'archived' }); } catch(e){}
```

**Divergence notes:**
- D10h.1 — `pauseSeries(id)`: `updateDoc(seriesRef(id), { status: 'paused', pausedAt: Date.now(), nextFireAt: null, ...writeAttribution() })`.
- D10h.2 — `resumeSeries(id)`: `updateDoc(seriesRef(id), { status: 'active', pausedAt: null, nextFireAt: <recompute or Date.now()>, ...writeAttribution() })`. Per D10d.2 — set `nextFireAt: Date.now()` and let CF compute on next tick.
- D10h.3 — `cancelSeries(id)`: `updateDoc(seriesRef(id), { status: 'ended', endedAt: Date.now(), nextFireAt: null, ...writeAttribution() })`. Per RESEARCH threat model — historical wp instances created from this series persist (their `seriesId` back-reference still resolves).
- D10h.4 — Wrap each in `if (guardReadOnlyWrite()) return;` per `confirmStartWatchparty:11549` precedent.
- D10h.5 — `flashToast('Series paused.' | 'Series resumed.' | 'Series cancelled.')` post-action.

---

### 10i. `js/app.js` — `state.unsubSeries` onSnapshot subscription

**Analog:** `js/app.js:5178-5198` (`state.unsubWatchparties` onSnapshot subscription).

**Pattern** (`js/app.js:5178-5198`):
```js
if (state.unsubWatchparties) { try { state.unsubWatchparties(); } catch(e){} state.unsubWatchparties = null; }
state.unsubWatchparties = onSnapshot(
  query(
    collectionGroup(db, 'watchparties'),
    where('memberUids', 'array-contains', state.auth.uid)
  ),
  s => {
    state.watchparties = s.docs.map(d => d.data());
    // ... derived re-renders ...
  }
);
```

**Teardown pattern** (`js/app.js:3486` — sign-out cleanup):
```js
if (state.unsubWatchparties) { try { state.unsubWatchparties(); } catch(e) {} state.unsubWatchparties = null; }
```

**Divergence notes:**
- D10i.1 — Subscribe to top-level `watchpartySeries` collection filtered by `memberUids array-contains auth.uid` — mirrors the wp subscription exactly:
  ```js
  state.unsubSeries = onSnapshot(
    query(
      collection(db, 'watchpartySeries'),
      where('memberUids', 'array-contains', state.auth.uid)
    ),
    s => {
      state.series = s.docs.map(d => d.data());
      try { renderSeriesListCard(); } catch(e) {}
    }
  );
  ```
- D10i.2 — Add corresponding teardown at `js/app.js:3486` + `:5178` (sign-out + family-switch cleanup).
- D10i.3 — Add `state.series = []` to initial state object (search for `state.watchparties = []` in js/state.js or js/app.js init).
- D10i.4 — NOT a `collectionGroup` query (Phase 16 is single-collection at top-level) — use `collection(db, 'watchpartySeries')` not `collectionGroup(db, ...)`. This is the only divergence from the wp pattern.

---

### 10j. `js/app.js` — post-wp "Make recurring?" prompt (Entry 2, TV-only)

**Analog:** `js/app.js:13784-13900+` (`openPostSession(wpId)`) + the TV-only gate at `:13807`:
```js
const t = state.titles.find(x => x.id === wp.titleId);
if (t && t.kind === 'TV') {
  // ... TV-only branch ...
}
```

**Divergence notes:**
- D10j.1 — Inject a new conditional render branch in `openPostSession()` between the auto-track tier-resolve block (`:13800-13845`) and the rest of the renderer. Gate: `t.kind === 'TV'` (RESEARCH Assumption A2 — verified at 3+ sites).
- D10j.2 — Pre-fill cadence inference:
  ```js
  const wpDate = new Date(wp.startAt);
  const inferredDow = wpDate.getDay();  // 0-6
  const inferredHM = wpDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: wp.creatorTimeZone || 'UTC' });
  ```
- D10j.3 — DOM: inject a new tile between `app.html:1322` (`.wp-photo-upload`) and `app.html:1325` (`.wp-schedule-next-cta`). See file 11f below.
- D10j.4 — Tap handler: opens series-edit modal in `mode: 'create'` with pre-filled fields, then user confirms (one-tap creates the series).
- D10j.5 — Hide entirely for movies + sports games (`t.kind !== 'TV'`) — DO NOT show the tile.

---

### 10k. `js/app.js` — Tonight-tab `t-section-actions` CTA injection

**Analog:** `js/app.js:5774+` (`renderTonight`) — empty `actionsEl` slot already cleared on every empty-state branch (lines 5804, 5810, 5824).

**Pattern (existing clear sites):**
```js
const actionsEl = document.getElementById('t-section-actions');
// ...
if (actionsEl) actionsEl.innerHTML = '';
```

**Divergence notes:**
- D10k.1 — Inject the CTA into `actionsEl.innerHTML` at the end of the normal-state branch in `renderTonight()` (NOT in the empty-state early-returns). Per RESEARCH §8 line 396-401:
  ```js
  if (actionsEl && state.familyCode && state.me) {
    actionsEl.innerHTML = `<button class="pill" type="button" onclick="openSeriesCreate()">Schedule a series</button>`;
  }
  ```
- D10k.2 — Visibility gate matches Flow A entry: `state.familyCode && state.me && state.couchMemberIds.length >= 1` (RESEARCH §8 — but the simplest version is the 2-condition gate above).
- D10k.3 — No DOM markup needed — `#t-section-actions` already exists at `app.html:393`.

---

### 11a. `app.html` — `#series-list-card` markup (Account tab insert)

**Analog:** `app.html:674-678` (`#signin-methods-card`).

**Pattern (exact lift):**
```html
<div class="tab-section" id="signin-methods-card" style="display:none;">
  <div class="tab-section-h"><span>Sign-in methods</span></div>
  <p class="tab-section-sub">Your linked ways to sign in. Set a password so you can sign in faster on a new device.</p>
  <div id="signin-methods-list" class="tab-list-card"></div>
</div>
```

**Divergence notes:**
- D11a.1 — Insert BETWEEN `app.html:678` (close of `#signin-methods-card`) and `app.html:680` (open of CLUSTER 1 YOU). Per RESEARCH §5 — co-located with sign-in methods.
- D11a.2 — Use exact same `.tab-section` + `.tab-section-h` + `.tab-section-sub` + `.tab-list-card` shape:
  ```html
  <div class="tab-section" id="series-list-card" style="display:none;">
    <div class="tab-section-h"><span>Your series</span></div>
    <p class="tab-section-sub">Recurring watchparties. Pause, edit, or cancel from here.</p>
    <div id="series-list" class="tab-list-card"></div>
    <button class="pill" type="button" onclick="openWeekView()">Calendar view</button>
  </div>
  ```
- D11a.3 — The `Calendar view` button is OPTIONAL — RESEARCH §10 recommends it but planner may decide week-view lives elsewhere.

---

### 11b. `app.html` — `#series-create-modal-bg` markup

**Analog:** `app.html:1228-1287` (`#wp-start-modal-bg`).

**Pattern (skeleton lift)** — see RESEARCH §11 lines 458-471 for the suggested shape. Key structural elements from analog:
- Outer `.modal-bg` div with `id`, `role="dialog"`, `aria-modal="true"`, `aria-label`
- Inner `.modal` div
- `.modal-x-btn` with SVG X icon + `onclick="closeXxx()"`
- `<h3>` title
- `.modal-field-stack` container with `.field` blocks
- `.modal-close` primary action button + `.pill .modal-btn-block` cancel button

**Divergence notes:**
- D11b.1 — Modal contents per CONTEXT: title-or-untitled toggle + cadence picker (`<div class="cadence-picker" id="series-cadence-picker">` populated by `renderDayOfWeekPicker`) + time-of-day picker + members chips + Save + Cancel.
- D11b.2 — DOM-share with edit per RESEARCH §11 line 473-474 — same modal id, mode toggle via `state.seriesEdit.mode = 'create' | 'edit'`. Skip writing a separate `#series-edit-modal-bg` markup block; just hide/show field groups based on mode.

---

### 11c. `app.html` — `#series-edit-modal-bg` markup

**Decision per D11b.2:** SKIP — DOM-shared with create modal. Single `#series-edit-modal-bg` container used for both flows; conditional rendering hides the titleType toggle in edit mode.

---

### 11d. `app.html` — `#week-view-modal-bg` markup

**Analog:** `app.html:1289-1302` (`#wp-live-modal-bg` — modal-bg with content container as JS-render target).

**Pattern (exact lift):**
```html
<div class="modal-bg" id="wp-live-modal-bg" role="dialog" aria-modal="true" aria-label="Live watchparty">
  <div class="modal wp-live-modal" id="wp-live-content">
    <div id="wp-video-surface" class="wp-video-surface"></div>
    <div id="wp-live-coordination" class="wp-live-coordination"></div>
  </div>
</div>
```

**Divergence notes:**
- D11d.1 — Phase 16 version is simpler — just one JS-render target:
  ```html
  <div class="modal-bg" id="week-view-modal-bg" role="dialog" aria-modal="true" aria-label="Week view">
    <div class="modal week-view-modal" id="week-view-content"></div>
  </div>
  ```
- D11d.2 — `renderWeekViewModal()` (file 10g) writes the 7-day grid into `#week-view-content`.

---

### 11f. `app.html` — "Make recurring?" tile inside `#wp-post-session-modal-bg`

**Analog:** `app.html:1320-1322` (`.wp-photo-upload`) + `app.html:1325` (`.wp-schedule-next-cta`) — sibling tiles in the post-session modal.

**Pattern (sibling tile)** (`app.html:1320-1325`):
```html
<div class="wp-photo-upload" id="wp-photo-upload-tile">
  <input type="file" accept="image/jpeg,image/png,image/webp" id="wp-photo-input" style="display:none;" onchange="uploadPostSessionPhoto(event)">
  <button type="button" class="wp-photo-upload-trigger" onclick="document.getElementById('wp-photo-input').click()">Add a couch photo</button>
</div>
<div id="wp-photo-preview" style="display:none;"></div>
<button type="button" class="wp-schedule-next-cta" onclick="openScheduleNext()">Schedule another night</button>
```

**Divergence notes:**
- D11f.1 — Insert NEW tile between `app.html:1324` (`#wp-photo-preview`) and `app.html:1325` (`.wp-schedule-next-cta`):
  ```html
  <!-- Phase 16 / CAL-16-09 — Entry 2: Make recurring? prompt (TV-only).
       Hidden by default; openPostSession() un-hides when t.kind === 'TV' (gate at js/app.js:13807). -->
  <button type="button" class="wp-make-recurring-cta" id="wp-make-recurring-cta" style="display:none;" onclick="openMakeRecurring()">Make this recurring</button>
  ```
- D11f.2 — Default `display:none` — `openPostSession()` un-hides when `t.kind === 'TV'`.
- D11f.3 — Bottom-of-stack placement (above "Schedule another night") matches "less prominent than rate-this-watch / photo / one-off-schedule" hierarchy.

---

### 12. `css/app.css` — `.series-list-card`, `.series-row`, `.cadence-picker`, `.cadence-day-pill`, `.week-view`, `.week-day-col`

**Analogs (composite — multiple existing patterns to mirror):**
- `.wp-lead-btn` at `css/app.css:793-796` — pill button styling (for cadence-day-pill)
- `.signin-method-row` at `css/app.css:3008-3014` — list row styling (for series-row)
- `.tab-section` at `css/app.css:1171-1186` — section card wrapper (already used via 11a markup; no new CSS)

**Divergence notes (greenfield CSS additions):**
- D12.1 — `.cadence-picker` — 7-col grid wrapper, mirror `.wp-lead-grid` structure (search css/app.css for `.wp-lead-grid` rules — currently grid-template-columns: repeat(3, 1fr) for the 6-button wp picker; Phase 16 picker is 7 cols).
- D12.2 — `.cadence-day-pill` — mirror `.wp-lead-btn` rules at `css/app.css:793-796` EXACTLY. Same padding/background/border/color/font/transition. Same `.on` active state — `background: var(--accent); color: var(--bg); font-weight: 600;`.
- D12.3 — `.series-row` — mirror `.signin-method-row` at `css/app.css:3008-3014` (currently flex row with bottom border). Add a button-row affordance for the Pause/Cancel buttons (could be `.cluster` if existing utility class works).
- D12.4 — `.week-view` — greenfield. Use RESEARCH §10 lines 437-443 scaffold:
  ```css
  .series-week-view { display:grid; grid-template-columns: repeat(7, 1fr); gap: var(--s2); }
  .series-week-col { display:flex; flex-direction:column; gap:var(--s1); min-height: 320px; }
  .series-week-col-h { font-family: var(--font-serif); font-size: var(--fs-sm); }
  .series-week-event { background: var(--surface-2); border-radius: var(--r-sm); padding: var(--s1); font-size: var(--fs-xs); }
  .series-week-event.series-instance { border-left: 2px solid var(--accent); }
  .series-week-event.one-off { border-left: 2px solid var(--surface-3); }
  @media (max-width: 599px) {
    .series-week-view { grid-template-columns: 1fr; }  /* 1-column day stack on mobile */
  }
  ```
- D12.5 — `.series-create-modal`, `.series-edit-modal` — modal-specific overrides only if needed. Default `.modal` styling (`css/app.css` existing) should suffice.

---

### 13. `tests/rules.test.js` — Phase 16 describe block

**Analog:** `tests/rules.test.js:1002-1163+` (`describe('Phase 30 Couch Groups rules', ...)` — Phase 30 top-level wp rules tests).

**Describe block opener pattern** (`tests/rules.test.js:1002-1004`):
```js
await describe('Phase 30 Couch Groups rules', async () => {
  // GROUP-30-07: stranger cannot read top-level wp (not in memberUids)
  await it('#30-01 stranger read top-level wp -> DENIED', async () => {
    await assertFails(stranger.doc('watchparties/wp_phase30_test').get());
  });
```

**Member-in-memberUids read pattern** (`tests/rules.test.js:1009-1011`):
```js
await it('#30-02 member in memberUids reads top-level wp -> ALLOWED', async () => {
  await assertSucceeds(member.doc('watchparties/wp_phase30_test').get());
});
```

**Update path denial pattern** (`tests/rules.test.js:1014-1019`):
```js
await it('#30-03 non-host cannot write wp.memberUids -> DENIED', async () => {
  await assertFails(
    member.doc('watchparties/wp_phase30_test')
      .update({ memberUids: ['UID_OWNER', 'UID_MEMBER', 'UID_STRANGER'] })
  );
});
```

**Allowed update with valid attribution pattern** (`tests/rules.test.js:1076-1085`):
```js
await it('#30-08 non-host writes to wp.reactions WITH valid actingUid+memberId -> ALLOWED', async () => {
  await assertSucceeds(
    member.doc('watchparties/wp_phase30_test').update({
      reactions: [{ emoji: 'fire', actingUid: UID_MEMBER, memberId: 'm_UID_MEMBER', actingAt: Date.now() }],
      actingUid: UID_MEMBER,
      memberId: 'm_UID_MEMBER',
      memberName: 'Member',
    })
  );
});
```

**Divergence notes:**
- D13.1 — Add new describe block (`await describe('Phase 16 watchpartySeries rules', async () => {...})`) AFTER the Phase 28 block (`tests/rules.test.js:1420+`). Use `#16-01` through `#16-NN` naming.
- D13.2 — Required cases (matches RESEARCH §"Phase Requirements → Test Map" CAL-16-01 + §"Threat model"):
  - `#16-01` stranger read series → DENIED (not in memberUids)
  - `#16-02` member in memberUids reads series → ALLOWED
  - `#16-03` create with valid shape → ALLOWED
  - `#16-04` create with familyCode user doesn't belong to → DENIED
  - `#16-05` create with empty daysOfWeek → DENIED
  - `#16-06` create with invalid timeOfDay format (e.g. `'25:99'`) → DENIED
  - `#16-07` create with daysOfWeek.size() > 7 → DENIED
  - `#16-08` non-creator update → DENIED
  - `#16-09` creator updates daysOfWeek → ALLOWED
  - `#16-10` creator updates status to 'paused' → ALLOWED
  - `#16-11` creator tries to change titleType → DENIED (titleType immutable post-create)
  - `#16-12` delete → DENIED (soft-delete via status='ended' is the only path)
- D13.3 — Seed function update needed at `tests/rules.test.js:50+` — add `watchpartySeries/series_phase16_test` doc setup (mirror the Phase 30 wp_phase30_test seed pattern). Set `createdBy: 'm_UID_OWNER'`, `createdByUid: UID_OWNER`, `memberUids: [UID_OWNER, UID_MEMBER]`, `familyCode: 'fam1'`, etc.
- D13.4 — Test harness (`it`, `describe`, `assertSucceeds`, `assertFails`) is already in scope — no new imports.

---

### 14. `sw.js` — CACHE bump

**Analog:** `sw.js:8` — current value `'couch-v42-phase-15.3-transparency'`.

**Pattern:**
```js
const CACHE = 'couch-v42-phase-15.3-transparency';
```

**Divergence notes:**
- D14.1 — Bump to `'couch-vXX-phase-16-calendar'` (or whatever Phase 16 short-tag the planner chooses).
- D14.2 — Auto-handled by `scripts/deploy.sh <short-tag>` (CLAUDE.md §Do — `bash scripts/deploy.sh 16-calendar` auto-bumps).
- D14.3 — Note that CLAUDE.md mentions `couch-v47-pickem` but sw.js is the source of truth (RESEARCH Assumption A4 — sw.js wins).

---

### 15. `firestore.indexes.json` — composite indexes for `watchpartySeries`

**Analog:** `firestore.indexes.json:2-15` (existing `watchparties` collectionGroup composite).

**Pattern (exact lift):**
```json
{
  "collectionGroup": "watchparties",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "mode", "order": "ASCENDING" },
    { "fieldPath": "hostFamilyCode", "order": "ASCENDING" }
  ]
}
```

**Divergence notes:**
- D15.1 — Phase 16 needs 1 (possibly 2) new composite indexes — per RESEARCH §"Composite indexes needed":
  - Required (CF query): `watchpartySeries` collectionGroup, fields = `[status ASC, nextFireAt ASC]`
  - Optional (Account-tab list query): `watchpartySeries`, fields = `[familyCode ASC, status ASC, nextFireAt ASC]`
- D15.2 — `queryScope: "COLLECTION"` (NOT `"COLLECTION_GROUP"`) — `watchpartySeries` is single-tier top-level, not nested. Compare to picks composite at `firestore.indexes.json:18-30` which uses `COLLECTION_GROUP` because picks ARE nested under families.
- D15.3 — Deploy via `firebase deploy --only firestore:indexes` BEFORE CF deploy. Indexes take 5-30 min to build per RESEARCH §"Open Questions" #6.

---

## Shared Patterns (cross-cutting)

### Pattern S1 — DR-3 lockstep for new push event-types

**Source:** `js/app.js:480-487` (DEFAULT_NOTIFICATION_PREFS) + `js/app.js:540-542` (NOTIFICATION_EVENT_LABELS) + `queuenight/functions/index.js:121-128` (NOTIFICATION_DEFAULTS).

**Apply to:** Files 7 + 10a + 10b (the `seriesReminder` key MUST appear in all 3 maps in the same commit; smoke contract file 4 enforces this via cross-repo grep).

**Convention origin:** Phase 14 D-12 (`14-RESEARCH.md:48-58`) + Phase 28 PICK-28-17 (live evidence in code).

---

### Pattern S2 — `writeAttribution()` echo on every Firestore mutation

**Source:** `js/app.js:11614` (`setDoc(... { ...wp, ...writeAttribution() })`) — applied at 8+ sites in app.js (search `writeAttribution()`).

**Apply to:** All client-side series mutations (10d create, 10e edit, 10h pause/resume/cancel). The firestore.rules update rule (file 6) requires the 4 attribution fields (`actingUid, managedMemberId, memberId, memberName`) on every write.

---

### Pattern S3 — `if (guardReadOnlyWrite()) return;` pre-mutation gate

**Source:** `js/app.js:11549` (Plan 5.8 D-15 — unclaimed post-grace accounts can't host watchparties).

**Apply to:** 10d (create) + 10e (edit) + 10h (pause/resume/cancel). All Firestore mutations from the client.

---

### Pattern S4 — Lazy-require sendToMembers in scheduled CFs

**Source:** `queuenight/functions/src/pickReminderTick.js:65-74` and `rsvpReminderTick.js:64-78`.

**Apply to:** File 1 (new `watchpartySeriesTick.js`). Standard pattern across all 5 existing scheduled CFs.

---

### Pattern S5 — Cross-repo deploy ordering (Phase 16 specific)

**Source:** RESEARCH §"Runtime State Inventory" + CLAUDE.md §Do (deploy ritual).

**Order:**
1. `firebase deploy --only firestore:indexes` from couch repo (wait 5-30 min for build)
2. `firebase deploy --only functions` from `~/queuenight` (CF deploy)
3. `firebase deploy --only firestore:rules` from couch repo (rules deploy — can be parallel with #2 but conventionally after CF)
4. `bash scripts/deploy.sh 16-calendar` from couch repo (hosting + sw.js auto-bump)

**Apply to:** Wave 3 close-out plan (per RESEARCH §"Recommended Wave Decomposition").

---

## No Analog Found

| Target File | Role | Reason | Fallback |
|-------------|------|--------|----------|
| `js/app.js` — `renderWeekViewModal()` (file 10g) | 7-day calendar grid | RESEARCH §10 explicitly: "No existing calendar surface in the codebase. The past-parties tall-sheet at app.html:1061 is a list, not a grid." | Use RESEARCH §10 CSS scaffolding (lines 437-449) + RESEARCH-recommended mobile-first 1-column-day-stack pattern. Planner: this is the greenfield component — budget extra UX iteration time. |
| `js/app.js` — `renderDayOfWeekPicker()` (file 10f, partial) | multi-select day picker | RESEARCH §9: "No existing day-of-week picker in the codebase (grepped: no matches for dayOfWeek, day-of-week, weekday-pick, cadence-pick)." | Use `.wp-lead-btn` styling pattern (file 10f Divergence) — the closest visual analog is the wp lead-time picker (6 buttons in a 3-col grid). Phase 16 version is 7 buttons in a 7-col grid with `.on` toggle behavior. |

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\claude-projects\couch\` (couch repo): js/app.js (targeted), js/constants.js (verified empty for Phase 16), firestore.rules, firestore.indexes.json, app.html (Tonight tab + Account tab + modal surfaces), css/app.css, sw.js, scripts/smoke-*.cjs, tests/rules.test.js
- `C:\Users\nahde\queuenight\functions\` (cloud functions repo): index.js (NOTIFICATION_DEFAULTS + sendToMembers + watchpartyTick + exports), src/pickReminderTick.js, src/rsvpReminderTick.js (gameResultsTick + onMemberDelete not read — pickReminderTick/rsvpReminderTick are sufficient analogs)

**Files scanned (read-only):** 12
**Strong analogs identified:** 13 (all targets except renderWeekViewModal + renderDayOfWeekPicker — both flagged greenfield)
**Pattern extraction date:** 2026-05-27

**Confidence breakdown:**
- CF patterns (files 1, 2, 8): HIGH — pickReminderTick + rsvpReminderTick are direct templates, in-doc-flag pattern verified at queuenight/functions/src/rsvpReminderTick.js:251.
- Firestore rules (file 6): HIGH — Phase 30 top-level wp rules block at firestore.rules:160-264 is a near-perfect template; helpers (signedIn, uid) already in scope.
- DR-3 lockstep (files 7, 10a, 10b, 4): HIGH — 2 verified precedents (Phase 14 D-12, Phase 28 PICK-28-17) + cross-repo grep already exists in smoke-pickem.cjs:221-233.
- UI render fns (10c, 10d, 10e, 10h, 10i, 10j, 10k): HIGH — renderSignInMethodsCard + confirmStartWatchparty + state.unsubWatchparties + openPostSession are well-trod patterns.
- Greenfield UI (10f cadence picker, 10g week view, 11d week-view markup, 12 CSS subset): MEDIUM — no existing analog; using closest visual primitives (`.wp-lead-btn`) per RESEARCH recommendations.
- Smoke + rules tests (3, 4, 5, 13): HIGH — smoke-pickem.cjs + tests/rules.test.js Phase 28/30 describe blocks are direct templates.

## PATTERN MAPPING COMPLETE
