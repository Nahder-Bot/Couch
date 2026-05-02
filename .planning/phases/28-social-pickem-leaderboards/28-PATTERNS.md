# Phase 28: Social pick'em + leaderboards — Pattern Map

**Mapped:** 2026-05-02
**Files analyzed:** 12 (4 new + 8 modified)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/pickem.js` (NEW) | ES module / pure helpers | transform | `js/native-video-player.js` | exact (same Phase 24 ES-module split precedent) |
| `js/sports-feed.js` (modified — additive) | ES module / data normalizer | transform | self (3-field additive to `normalizeTsdEvent` return block) | self-reference |
| `js/app.js` — `DEFAULT_NOTIFICATION_PREFS` | client config map | request-response | `js/app.js:330-367` (same map) | self-reference (3-key lockstep extend) |
| `js/app.js` — `NOTIFICATION_EVENT_LABELS` | client config map | request-response | `js/app.js:377-416` (same map) | self-reference (3-key lockstep extend) |
| `js/app.js` — render functions block | client UI / renderer | request-response | `js/app.js:10739` `renderSportsScoreStrip` + `js/app.js:12326` participant chip | role-match |
| `js/app.js` — live-wp modal extension | client UI / renderer | event-driven | `js/app.js:12326-12343` (participant chip render in live-wp modal) | role-match |
| `js/app.js` — Tonight tab inline link | client UI / entry point | request-response | `js/app.js:10739` score strip wiring in live-modal | partial-match |
| `css/app.css` — `.pe-*` class family | stylesheet | n/a | `css/app.css:972-988` `.sports-game-card` / `.sports-game-teams` block | role-match |
| `queuenight/functions/src/gameResultsTick.js` (NEW) | scheduled CF | event-driven | `queuenight/functions/index.js:931` `watchpartyTick` | exact |
| `queuenight/functions/src/pickReminderTick.js` (NEW) | scheduled CF | event-driven | `queuenight/functions/src/rsvpReminderTick.js` | exact |
| `queuenight/functions/index.js` — registration + `NOTIFICATION_DEFAULTS` | CF exports + server config | request-response | `index.js:1628-1629` (rsvpReminderTick registration) + `index.js:74-116` (NOTIFICATION_DEFAULTS map) | self-reference |
| `firestore.rules` — picks / leaderboards / picks_reminders | security rules | request-response | `firestore.rules:577-609` (Phase 24 REVIEWS M2 Path A/B split) | exact |
| `scripts/smoke-pickem.cjs` (NEW) | smoke contract | batch | `scripts/smoke-guest-rsvp.cjs` | exact |
| `scripts/deploy.sh` — §2.5 extension | deploy automation | batch | `scripts/deploy.sh:117-125` (smoke-native-video-player + smoke-position-anchored-reactions if-blocks) | exact |

---

## Pattern Assignments

### `js/pickem.js` — NEW (ES module, pure helpers)

**Analog:** `js/native-video-player.js` (entire file — 177 lines)

**Module header pattern** (`js/native-video-player.js` lines 1-21):
```js
// === Phase 24 — Native video player helpers ===
// Pure helpers consumed by js/app.js for the watchparty live-modal player surface.
// Co-locates: URL parser + DRM detection + throttle helper + seek helper + cadence + staleness.
//
// Exports:
//   VIDEO_BROADCAST_INTERVAL_MS   — host-only currentTime broadcast cadence (5000ms per D-09)
//   ...
//
// No top-level side effects (no DOM, no network, no Date.now() at import time).
// Smoke contract: scripts/smoke-native-video-player.cjs imports this module directly
// (await import('../js/native-video-player.js')) — production-module testing per
// REVIEWS.md H2 fix.
//
// Per CONTEXT.md D-01..D-04 + ...
```

**Phase 28 divergence for module header:** Replace with Phase 28 attribution. Same "No top-level side effects" rule applies. Exported names are `slateOf`, `latestGameInSlate`, `scorePick`, `validatePickSelection`, `summarizeMemberSeason`, `compareMembers`, `PICK_TYPE_BY_LEAGUE`, `PICK_REMINDER_OFFSET_MS` (per CONTEXT D-15).

**Exported constant pattern** (`js/native-video-player.js` lines 25-40):
```js
// ---- Cadence constant (D-09 broadcast cadence) ----
// 5s = 12 writes/min × 60 = 720 writes/hour/wp under Firestore's 1-write/sec/document soft cap.
// Phase 26 inherits this granularity for runtime-anchored reactions (acceptable per RESEARCH Pitfall 7).
export const VIDEO_BROADCAST_INTERVAL_MS = 5000;

// ---- Staleness window for currentTimeUpdatedAt ----
// ...
export const STALE_BROADCAST_MAX_MS = 60_000; // 1 minute

// ---- DRM-flat-rate provider brand allowlist (D-03) ----
// ...
export const DRM_FLAT_RATE_PROVIDER_BRANDS = new Set([...]);
```

**Phase 28 equivalent:** Copy this exact constant-with-comment style:
```js
// ---- Pick'em constants ----
// Phase 28 D-06: T-15min reminder window (in ms).
export const PICK_REMINDER_OFFSET_MS = 15 * 60 * 1000;

// ---- pickType → league mapping (D-02) ----
// team_winner: US major + college. team_winner_or_draw: soccer domestic + UCL/MLS.
// f1_podium: Formula 1. ufc_winner_method: UFC.
export const PICK_TYPE_BY_LEAGUE = Object.freeze({
  nba: 'team_winner', nfl: 'team_winner', mlb: 'team_winner', ...
});
```

**Pure function pattern** (`js/native-video-player.js` lines 53-75 `parseVideoUrl`):
```js
// ---- parseVideoUrl: 5 YouTube shapes + .mp4 + protocol rejection ----
// Returns { source: 'youtube', id, url } | { source: 'mp4', url } | null.
// Pure (no DOM, no network); smoke-testable.
export function parseVideoUrl(input) {
  if (!input || typeof input !== 'string') return null;
  // ... pure logic, no side effects ...
  return null;
}
```

**Phase 28 equivalent for `scorePick`:** Same shape — pure function, smoke-testable, JSDoc comment block, defensive guard at top. Key detail: this function must be importable by both the browser (ES module) and by the smoke contract (CJS via `await import()`).

**Error handling style:** All functions in `native-video-player.js` use try/catch internally where applicable (`seekToBroadcastedTime` lines 149-175) and return null/false on error — never throw. Mirror this for `validatePickSelection` and `scorePick`.

**Smoke-testability requirement (from `native-video-player.js` line 18):**
```
// Smoke contract: scripts/smoke-native-video-player.cjs imports this module directly
// (await import('../js/native-video-player.js')) — production-module testing per
// REVIEWS.md H2 fix.
```
`js/pickem.js` must be importable via `await import('../js/pickem.js')` from the CJS smoke contract.

---

### `js/sports-feed.js` — MODIFIED (additive, 3 fields)

**Analog:** self (lines 76-97 of `normalizeTsdEvent` return block)

**Current return block** (`js/sports-feed.js` lines 76-97):
```js
return {
  id: ev.idEvent || '',
  league: leagueKey,
  source: 'tsd',
  shortName: ev.strEvent || '',
  startTime: startMs,
  homeTeam: ev.strHomeTeam || 'TBD',
  homeAbbrev: ev.strHomeTeamShort || '',
  homeLogo: ev.strHomeTeamBadge || '',
  homeScore: ev.intHomeScore != null && ev.intHomeScore !== '' ? parseInt(ev.intHomeScore, 10) : null,
  awayTeam: ev.strAwayTeam || 'TBD',
  awayAbbrev: ev.strAwayTeamShort || '',
  awayLogo: ev.strAwayTeamBadge || '',
  awayScore: ev.intAwayScore != null && ev.intAwayScore !== '' ? parseInt(ev.intAwayScore, 10) : null,
  venue: ev.strVenue || null,
  broadcast: ev.strTVStation || null,
  statusName: stateRaw,
  statusDetail: ev.strStatus || '',
  isFinal: isFinal,
  isLive: isLive,
  isScheduled: isScheduled
};
```

**Phase 28 additive — append exactly these 3 fields after `isScheduled`** (per RESEARCH OQ-1 + OQ-2):
```js
  // Phase 28 — additive: surface strSeason for pick'em D-11 season tagging.
  // Falls back to calendar year from startMs if TheSportsDB returns null/empty.
  season: ev.strSeason || (startMs ? String(new Date(startMs).getFullYear()) : 'unknown'),
  // Phase 28 — soccer domestic matchday round (intRound); null for non-soccer leagues.
  round: ev.intRound ? String(ev.intRound) : null,
  // Phase 28 — UCL stage label (strStage); null for non-UCL leagues.
  stage: ev.strStage || null,
```

**Smoke impact:** `scripts/smoke-sports-feed.cjs` contains an inline mirror of `normalizeTsdEvent` (lines 37-70). The smoke file MUST be updated to add the same 3 fields to its inline mirror, or the smoke will produce false-pass results (the smoke compares behavior, not field-presence). Add scenario G assertions for `season`/`round`/`stage` fields.

---

### `js/app.js` — `DEFAULT_NOTIFICATION_PREFS` extension (line ~367)

**Analog:** `js/app.js:330-367` (same map — self-reference)

**Existing pattern** (lines 330-367 — the last 3 entries):
```js
const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  // ...
  // Phase 18 / D-12 + D-20 — titleAvailable: daily provider-refresh CF push fan-out.
  // Mirror of queuenight NOTIFICATION_DEFAULTS in Plan 18-01. Default ON: low-volume
  // high-signal channel — fires only when a title in someone's queue becomes newly
  // watchable on a brand they own. Users opt out via Settings if noisy.
  titleAvailable: true
});
```

**Phase 28 insertion — append 3 keys before the closing `})`:**
```js
  // === Phase 28 / D-06 (PICK-28-17) — pick'em push categories (DR-3 three-place add).
  // All default ON: these fire only when the user has actively engaged (submitting
  // a pick IS active engagement per CONTEXT D-06). Must stay in lockstep with
  // queuenight/functions/index.js NOTIFICATION_DEFAULTS (server gate) and
  // NOTIFICATION_EVENT_LABELS below (UI copy).
  pickReminder: true,
  pickResults: true,
  pickemSeasonReset: true,
```

**Lockstep rule:** All 3 keys must appear in EXACTLY the same 3 places simultaneously:
1. `js/app.js` `DEFAULT_NOTIFICATION_PREFS` (client defaults)
2. `js/app.js` `NOTIFICATION_EVENT_LABELS` (UI copy)
3. `queuenight/functions/index.js` `NOTIFICATION_DEFAULTS` (server gate)

The smoke contract (`smoke-pickem.cjs`) grep-asserts all 3 locations.

---

### `js/app.js` — `NOTIFICATION_EVENT_LABELS` extension (line ~415)

**Analog:** `js/app.js:377-416` (same map — self-reference)

**Existing pattern** (lines 410-416 — the last entry):
```js
  // Phase 18 / D-20 — titleAvailable legacy Settings UI label.
  // BRAND-voice copy. NOTE: this surface is mirrored to friendly-UI maps in this
  // plan's Task 2 (D-20 + Phase-15.4 mirror approach)...
  titleAvailable: { label: 'Newly watchable', hint: 'When a title in your queue lands on a service in your pack.' }
});
```

**Phase 28 insertion — append 3 entries before the closing `})`:**
```js
  // Phase 28 / D-06 (PICK-28-17) — pick'em push event labels (DR-3 place 3 of 3).
  // BRAND-voice copy per CONTEXT D-06 Notification copy block.
  // NOTE: NOT mirrored into Phase 12 friendly-UI maps (NOTIF_UI_TO_SERVER_KEY /
  // NOTIF_UI_LABELS) — surfaces only in legacy Settings UI, consistent with Phase 14-18 precedent.
  pickReminder:      { label: 'Game starting soon — make your pick',   hint: 'Heads-up your pick\'em deadline is in 15 minutes.' },
  pickResults:       { label: 'Pick\'em results',                      hint: 'When games you picked finish.' },
  pickemSeasonReset: { label: 'Pick\'em season reset',                 hint: 'When your league\'s season turns over.' },
```

---

### `js/app.js` — new render functions block (after line ~10870)

**Analog:** `js/app.js:10739-10771` `renderSportsScoreStrip` (sports-context renderer in same file region)

**Core render function pattern** (`js/app.js:10742-10771`):
```js
function renderSportsScoreStrip(wp) {
  const sport = (wp && wp.sportEvent) || {};
  // Seed values from wp.lastScore ...
  const score = (wp && wp.lastScore) || { ... };
  const isLive = score.state === 'in';
  const middleText = isLive
    ? `<span class="sports-score-live">LIVE &middot; ${escapeHtml(score.statusDetail || '')}</span>`
    : `<span>${escapeHtml(score.statusDetail || 'Pre-game')}</span>`;
  // ...
  return `<div class="sports-score-strip" id="sports-score-strip-${escapeHtml(wp.id)}">
    ...
  </div>`;
}
```

**Pattern rules to replicate for `renderPickemSurface`, `renderPickerCard`, `renderLeaderboard`, `renderInlineWpPickRow`, `renderPastSeasonsArchive`:**
- Always use `escapeHtml()` on all user-supplied or external strings in template literals
- Return a single HTML string (no DOM manipulation in render function)
- Defensive guards at top: `if (!wp) return ''`
- Import pickem helpers at file top: `import { slateOf, latestGameInSlate, PICK_TYPE_BY_LEAGUE } from './pickem.js'`

**Listener tear-down pattern** (`js/app.js` Phase 26 precedent — per RESEARCH Pitfall 4):
```js
// Store unsubscribe in state to prevent listener leak
state.pickemPicksUnsubscribe = db.collection('families').doc(state.familyCode)
  .collection('picks')
  .where('gameId', 'in', slateGameIds)
  .onSnapshot(snap => { ... });

// In close/unmount function:
if (state.pickemPicksUnsubscribe) {
  state.pickemPicksUnsubscribe();
  state.pickemPicksUnsubscribe = null;
}
```

**team-color / teamAllegiance pre-fill pattern** (`js/app.js:12327-12334`):
```js
// Phase 11 / REFR-10 — Team-flair badge: apply --team-color custom property to
// the avatar inline style when the participant has picked an allegiance.
const teamColor = p.teamColor || null;
const avStyle = teamColor
  ? `background:${color};--team-color:${escapeHtml(teamColor)};`
  : `background:${color};`;
const teamFlairClass = teamColor ? ' has-team-flair' : '';
```

**Phase 28 equivalent for D-09 pre-fill chip border:**
```js
// Read teamAllegiance from participants[state.me.id] in the watchparty OR from
// the member's standing allegiance. Compare against game.homeTeam / game.awayTeam.
const allegiance = (participants[mid] && participants[mid].teamAllegiance) || null;
const isPreFilled = allegiance && (allegiance === game.homeTeam || allegiance === game.awayTeam);
const chipBorderStyle = isPreFilled
  ? `style="--team-color:${escapeHtml(teamColor)};border:2px solid var(--team-color)"`
  : '';
```

---

### `js/app.js` — inline wp pick row extension (inside live-wp modal, ~line 12123)

**Analog:** `js/app.js:10739-10771` `renderSportsScoreStrip` wiring pattern (injected at top of wp-live-body)

**Wiring pattern to replicate:** The inline pick row is injected inside the existing `.wp-live-modal` block, between the participant strip and the reactions area. The render call is conditional on `wp.mode === 'game'`:
```js
// After existing: renderSportsScoreStrip(wp)
// Phase 28 — inline pick row (D-07 / PICK-28-13)
const pickRowHtml = (wp.mode === 'game' && picks.some(p => p.gameId === wp.sportEvent.id))
  ? renderInlineWpPickRow(wp, picks)
  : '';
```

The row disappears at `gameStartTime` (D-07) — check client-side: `if (Date.now() >= wp.sportEvent.startTime) return ''`.

---

### `queuenight/functions/src/gameResultsTick.js` — NEW (scheduled CF)

**Analog:** `queuenight/functions/index.js:931-987` `watchpartyTick`

**Scheduled CF registration pattern** (lines 931-936):
```js
exports.watchpartyTick = onSchedule({
  schedule: 'every 5 minutes',
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  // ...
```

**Phase 28 equivalent:** Copy this exact `onSchedule` shape. `gameResultsTick` uses the same `every 5 minutes` cadence, same region, same memory. Bump `timeoutSeconds` to `240` (settlement may poll TheSportsDB per pending game per family — more I/O than watchpartyTick's pure-Firestore loop).

**Per-family iteration pattern** (lines 941-946):
```js
const families = await db.collection('families').get();
for (const familyDoc of families.docs) {
  let wpSnap;
  try {
    wpSnap = await db.collection('families').doc(familyDoc.id).collection('watchparties').get();
  } catch (e) { console.warn('watchparties list failed', familyDoc.id, e.message); continue; }
  for (const doc of wpSnap.docs) {
    const wp = doc.data();
    try {
      // ... per-doc logic ...
    } catch (e) {
      console.warn('watchpartyTick per-doc failed', familyDoc.id, doc.id, e.message);
      errored++;
    }
  }
```

**Phase 28 equivalent for `gameResultsTick`:**
```js
const families = await db.collection('families').get();
for (const familyDoc of families.docs) {
  let picksSnap;
  try {
    picksSnap = await db.collection('families').doc(familyDoc.id)
      .collection('picks')
      .where('state', '==', 'pending')
      .where('gameStartTime', '<', now)
      .get();
  } catch (e) { console.warn('gameResultsTick picks query failed', familyDoc.id, e.message); continue; }
  for (const pickDoc of picksSnap.docs) {
    const pick = pickDoc.data();
    try {
      if (pick.state === 'settled') continue; // idempotency short-circuit (D-16)
      // ... settlement logic ...
    } catch (e) {
      console.warn('gameResultsTick per-pick failed', familyDoc.id, pickDoc.id, e.message);
      errored++;
    }
  }
}
```

**Transactional leaderboard update pattern** (from `rsvpSubmit.js:130-171` — the Phase 27 `db.runTransaction` analog):
```js
await db.runTransaction(async (tx) => {
  const snap = await tx.get(wpRef);
  if (!snap.exists) throw new HttpsError('not-found', 'Watchparty not found mid-transaction.');
  const data = snap.data() || {};
  // ... read-modify-write ...
  tx.update(wpRef, { ... });
});
```

**Phase 28 equivalent for leaderboard update:**
```js
const lbRef = db.collection('families').doc(familyCode)
  .collection('leaderboards').doc(pick.leagueKey)
  .collection(pick.strSeason).doc('doc'); // OR .doc(`${pick.leagueKey}`) depending on schema
await db.runTransaction(async (tx) => {
  const lbSnap = await tx.get(lbRef);
  const lb = lbSnap.exists ? lbSnap.data() : { members: {}, leagueKey: pick.leagueKey, strSeason: pick.strSeason };
  const memberRow = lb.members[pick.memberId] || { pointsTotal: 0, picksTotal: 0, picksSettled: 0,
    picksAutoZeroed: 0, tiebreakerDeltaTotal: 0, tiebreakerCount: 0 };
  // increment counters per scorePick result ...
  tx.set(lbRef, { ...lb, members: { ...lb.members, [pick.memberId]: memberRow }, updatedAt: now }, { merge: true });
  // settle the pick doc in same transaction:
  tx.update(pickDoc.ref, { state: 'settled', pointsAwarded, settledAt: now });
});
```

**sendToMembers call pattern** (from `rsvpReminderTick.js:190-199`):
```js
if (sendToMembers) {
  await sendToMembers(familyDoc.id, [s.participantId], {
    title: s.title,
    body: s.body,
    tag: `wp-rsvp-reminder-${doc.id}-${s.participantId}-${s.key}`,
    url: `/app?wp=${doc.id}`
  }, {
    excludeMemberId: null,
    eventType: 'rsvpReminder'
  });
}
```

**Phase 28 equivalent:**
```js
if (sendToMembers) {
  await sendToMembers(familyCode, [pick.memberId], {
    title: 'Pick\'em results',
    body: `Your ${leagueLabel(pick.leagueKey)} picks just settled. Tap to see how you did.`,
    tag: `pickem-results-${pick.memberId}-${pick.gameId}`,
    url: '/app?tab=pickem'
  }, {
    excludeMemberId: null,
    eventType: 'pickResults'
  });
}
```

**Module structure to mirror from `rsvpReminderTick.js:24-31`:**
```js
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
```

**Important divergence — `feedFetchScore` import:** `gameResultsTick` needs `fetchScore` from `js/sports-feed.js`. However, `sports-feed.js` is an ES module; `gameResultsTick` is CommonJS. The existing CFs use `node-fetch` directly or a CommonJS wrapper. Verify how Phase 23's score-polling CF accessed TheSportsDB — likely via a direct `https` call mirroring `fetchScore` logic inline. Do NOT `require('../../../couch/js/sports-feed.js')` from a CF (cross-repo CJS/ESM boundary). Re-implement the TSD score call inline in `gameResultsTick.js` as a minimal CommonJS helper copying the `fetchScore` URL construction from `sports-feed.js:148-153`.

---

### `queuenight/functions/src/pickReminderTick.js` — NEW (scheduled CF)

**Analog:** `queuenight/functions/src/rsvpReminderTick.js` (entire file — 259 lines)

**Scheduled registration pattern** (lines 58-63):
```js
exports.rsvpReminderTick = onSchedule({
  schedule: 'every 15 minutes',
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '256MiB'
}, async () => {
  // Lazy-require sendToMembers from index.js ...
  let sendToMembers = null;
  try {
    const idx = require('../index.js');
    sendToMembers = idx.sendToMembers || null;
  } catch (e) {
    console.error('rsvpReminderTick: failed to require sendToMembers', e.message);
  }
```

**Phase 28 equivalent:** Copy exact module boilerplate. Change schedule to `'every 5 minutes'`. Export name: `pickReminderTick`.

**Idempotency flag-before-send pattern** (lines 178-186):
```js
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

**Phase 28 divergence — idempotency document (not a flag on existing doc):** `rsvpReminderTick` stores idempotency as `wp.reminders[guestId][windowKey]` on the watchparty doc. For `pickReminderTick`, the pick doc may NOT exist yet (that's the trigger case). Use the dedicated `picks_reminders/{leagueKey}_{gameId}_{memberId}` collection instead (per RESEARCH OQ-5):
```js
const reminderId = `${leagueKey}_${gameId}_${memberId}`;
const reminderRef = db.collection('picks_reminders').doc(reminderId);
const reminderSnap = await reminderRef.get();
if (reminderSnap.exists) continue; // already sent
// Write idempotency doc BEFORE sending push:
await reminderRef.set({
  sentAt: admin.firestore.FieldValue.serverTimestamp(),
  leagueKey, gameId, memberId,
  expiresAt: gameStartTime + 3600000  // TTL: 1h after game start
});
// ... send push ...
```

**Window detection pattern** (`rsvpReminderTick.js:89-91`):
```js
const minutesBefore = Math.round((wp.startAt - now) / 60000);
// Outside the 8-day horizon (or already started >15 min ago) — skip.
if (minutesBefore < -SLOP_MINUTES || minutesBefore > 8 * 24 * 60) continue;
```

**Phase 28 equivalent for T-15min window:**
```js
const SLOP_MS = 1 * 60 * 1000; // ±1 minute (CF runs every 5 min; slop covers scheduling jitter)
const msUntilStart = game.gameStartTime - now;
const inReminderWindow = msUntilStart >= (PICK_REMINDER_OFFSET_MS - SLOP_MS)
                      && msUntilStart <= (PICK_REMINDER_OFFSET_MS + SLOP_MS);
if (!inReminderWindow) continue;
```

---

### `queuenight/functions/index.js` — `NOTIFICATION_DEFAULTS` extension (line ~115)

**Analog:** `index.js:74-116` (same map — self-reference)

**Existing pattern** (lines 112-116 — last entry):
```js
  // Phase 18 / D-12 + D-20: titleAvailable — daily provider-refresh CF push fan-out.
  // Default ON: this fires only when a title in someone's queue becomes newly
  // watchable on a streaming brand they own. Low-volume, high-signal.
  // Server place 1 of 6 (DR-3 server gate). Client mirror in 5 places per Plan 18-02.
  titleAvailable: true
});
```

**Phase 28 insertion — append 3 keys before closing `})`:**
```js
  // === Phase 28 / D-06 (PICK-28-17) — pick'em push categories (DR-3 server place 1 of 3).
  // All default ON: fire only when user has actively picked (intent-rich engagement signal).
  // Must stay in lockstep with client DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS
  // in js/app.js. Drift caught by scripts/smoke-pickem.cjs cross-repo grep assertions.
  pickReminder: true,
  pickResults: true,
  pickemSeasonReset: true,
```

**CF registration pattern** (lines 1628-1629):
```js
exports.rsvpSubmit = require('./src/rsvpSubmit').rsvpSubmit;
exports.rsvpReminderTick = require('./src/rsvpReminderTick').rsvpReminderTick;
```

**Phase 28 insertion — append after the Phase 27 exports block:**
```js
// Phase 28 / D-16 (PICK-28-14) — pick'em settlement + reminder CFs.
// gameResultsTick: settles pending picks every 5 min + fires pickResults push + updates leaderboard.
// pickReminderTick: fires pickReminder push at T-15min for members with no pick on an upcoming game.
// Both CFs lazy-require sendToMembers from this module (same pattern as rsvpReminderTick).
exports.gameResultsTick = require('./src/gameResultsTick').gameResultsTick;
exports.pickReminderTick = require('./src/pickReminderTick').pickReminderTick;
```

---

### `firestore.rules` — picks, leaderboards, picks_reminders (after line ~610)

**Analog:** `firestore.rules:561-609` Phase 24 REVIEWS M2 Path A/B split on `watchparties/{wpId}`

**Phase 24 M2 split pattern** (lines 577-609):
```
match /watchparties/{wpId} {
  // Phase 27 — wp.guests[] ... Admin SDK bypasses ALL Firestore rules ...
  allow read: if isMemberOfFamily(familyCode);
  allow create: if attributedWrite(familyCode);
  allow update: if attributedWrite(familyCode) && (
    // Path A: caller is the wp host — any field allowed.
    (
      'hostUid' in resource.data
      && resource.data.hostUid == request.auth.uid
    )
    ||
    // Path B: caller is a non-host family member — must NOT touch host-only fields.
    !request.resource.data.diff(resource.data).affectedKeys().hasAny([
      'currentTimeMs',
      'currentTimeUpdatedAt',
      // ... denylist ...
    ])
  );
  allow delete: if isOwner(familyCode) || (isMemberOfFamily(familyCode) && graceActive());
}
```

**Phase 28 equivalent — picks rule** (per RESEARCH OQ-3, using `isMemberOfFamily` + denylist):
```
match /families/{familyCode}/picks/{pickId} {
  // Phase 28 — pick'em picks. Member self-write until gameStartTime (D-04 lock).
  // CF (gameResultsTick, admin SDK) writes state/pointsAwarded/settledAt/tiebreakerDelta
  // and tiebreakerActual — bypasses rules via admin SDK (same as Phase 27 pattern).

  allow read: if isMemberOfFamily(familyCode);

  // CREATE: member must be in family; doc must carry their memberId in m_ format;
  //         gameStartTime must be in the future (pre-lock only);
  //         CF-only fields must start at canonical values.
  allow create: if attributedWrite(familyCode)
    && request.resource.data.memberId is string
    && request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')
    && request.resource.data.gameStartTime is number
    && request.time.toMillis() < request.resource.data.gameStartTime
    && (!('state' in request.resource.data) || request.resource.data.state == 'pending')
    && (!('pointsAwarded' in request.resource.data) || request.resource.data.pointsAwarded == 0);

  // UPDATE: member can edit their own pick before lock; CF-only fields denied (denylist).
  allow update: if attributedWrite(familyCode)
    && resource.data.memberId == request.resource.data.memberId
    && request.time.toMillis() < resource.data.gameStartTime
    && !request.resource.data.diff(resource.data).affectedKeys().hasAny([
         'state', 'pointsAwarded', 'settledAt', 'tiebreakerDelta', 'tiebreakerActual'
       ]);

  allow delete: if false;
}

match /families/{familyCode}/leaderboards/{leagueKey}/{strSeason} {
  // CF-only writes (admin SDK); members can read.
  allow read: if isMemberOfFamily(familyCode);
  allow write: if false;
}

match /picks_reminders/{reminderId} {
  // CF-only idempotency docs for pickReminderTick. Admin SDK only.
  allow read, write: if false;
}
```

**Key pattern: `attributedWrite()` vs raw auth check.** Phase 28 uses `attributedWrite(familyCode)` (same as `watchparties`, `sessions`, `intents`, etc.) rather than a raw `isMemberOfFamily` check — this ensures the `actingUid`, `memberId`, and `updatedAt` attribution fields are stamped correctly. The lock check (`request.time.toMillis() < resource.data.gameStartTime`) is the Phase 28-specific addition.

---

### `scripts/smoke-pickem.cjs` — NEW (11th smoke contract)

**Analog:** `scripts/smoke-guest-rsvp.cjs` (entire file — 213 lines)

**File header pattern** (lines 1-27):
```js
#!/usr/bin/env node
/**
 * smoke-guest-rsvp.cjs — Phase 27 smoke contract (scaffold from Plan 02; extended in Plan 05)
 *
 * Pure-helper assertions for the four behavior families ...
 *
 * This file deliberately avoids requiring queuenight/functions/index.js (which
 * would pull in firebase-functions runtime). Pure helpers are inlined here as
 * verbatim copies of the canonical implementations they verify; if the
 * implementations drift, this smoke fails and forces an explicit re-sync.
 * ...
 */
'use strict';

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  // ...
  failed++;
}
```

**Phase 28 equivalent header:** Copy exactly, substituting Phase 28 attribution and describing the 5 behavior families:
1. `slateOf` + `latestGameInSlate` (slate grouping + tiebreaker designation)
2. `scorePick` (all 4 pick types; partial-match edge cases)
3. `summarizeMemberSeason` + `compareMembers` (OQ-8 tiebreaker arithmetic edge cases)
4. Production-code sentinels (Firestore rules `gameStartTime` check; `state === 'pending'`)
5. Cross-repo lockstep grep for `pickReminder`/`pickResults`/`pickemSeasonReset` in both repos

**Dynamic import pattern for ES module** (mirrors `smoke-native-video-player.cjs`):
The smoke MUST test `js/pickem.js` directly to avoid pure-inline-copy drift. Use `await import()`:
```js
(async () => {
  let pickem;
  try {
    pickem = await import(path.resolve(__dirname, '../js/pickem.js'));
  } catch (e) {
    console.error('FAIL: could not import js/pickem.js:', e.message);
    process.exit(1);
  }
  const { slateOf, latestGameInSlate, scorePick, summarizeMemberSeason, compareMembers, PICK_TYPE_BY_LEAGUE } = pickem;
  // ... assertions ...
})();
```

**Production-code sentinel pattern** (lines 123-139):
```js
const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
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
```

**Cross-repo lockstep sentinel** (from RESEARCH OQ-7):
```js
// --- N. Cross-repo lockstep for 3 push event keys ---
const appJs = readIfExists(path.join(COUCH_ROOT, 'js', 'app.js'));
const fnIdx = readIfExists(path.join(QN_FUNCTIONS, 'index.js'));
for (const key of ['pickReminder', 'pickResults', 'pickemSeasonReset']) {
  eqContains(`lockstep: DEFAULT_NOTIFICATION_PREFS has ${key}`, appJs, `${key}: true`);
  eqContains(`lockstep: NOTIFICATION_EVENT_LABELS has ${key}`, appJs, `${key}:`);
  eqContains(`lockstep: server NOTIFICATION_DEFAULTS has ${key}`, fnIdx, `${key}: true`);
}
```

**Floor meta-assertion pattern** (lines 197-207):
```js
// --- Floor meta-assertion (matches Phase 26 RPLY-26-17 pattern) ---
{
  const FLOOR = 13;
  const productionCodeAssertions = passed - N_HELPER_ASSERTIONS; // N = count of pure-helper assertions
  if (productionCodeAssertions >= FLOOR) {
    console.log(`  ok floor met (${productionCodeAssertions} >= ${FLOOR})`);
    passed++;
  } else {
    console.error(`  FAIL floor NOT met (${productionCodeAssertions} < ${FLOOR})`);
    failed++;
  }
}
```

**Phase 28 note:** RESEARCH §PICK-28-21 specifies floor ≥ 13 production-code sentinel assertions. Helper-behavior assertions cover slateOf/latestGameInSlate/scorePick/summarizeMemberSeason/compareMembers edge cases (~15-20 assertions), sentinel block adds lockstep (9) + Firestore rules (3) + gameResultsTick (2) + sw.js cache bump (1) = 15 sentinels → floor met.

**Exit pattern** (lines 211-213):
```js
console.log(`smoke-guest-rsvp: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
```

---

### `scripts/deploy.sh` — §2.5 extension

**Analog:** `scripts/deploy.sh:117-125` (the last two if-blocks before the echo line)

**Current pattern** (lines 117-125):
```bash
if [ -f scripts/smoke-position-anchored-reactions.cjs ]; then
  node scripts/smoke-position-anchored-reactions.cjs > /dev/null \
    || { echo "ERROR: smoke-position-anchored-reactions failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed + native-video-player + position-anchored-reactions)."
```

**Phase 27 note from RESEARCH:** The smoke-guest-rsvp.cjs if-block was added to `package.json` in Phase 27 Plan 05 but the `deploy.sh` if-block may be missing. Verify before adding Phase 28's block. If Phase 27's block is missing from deploy.sh, add BOTH in sequence.

**Phase 28 insertion — append after smoke-position-anchored-reactions if-block:**
```bash
if [ -f scripts/smoke-guest-rsvp.cjs ]; then
  node scripts/smoke-guest-rsvp.cjs > /dev/null \
    || { echo "ERROR: smoke-guest-rsvp failed -- aborting deploy." >&2; exit 1; }
fi
if [ -f scripts/smoke-pickem.cjs ]; then
  node scripts/smoke-pickem.cjs > /dev/null \
    || { echo "ERROR: smoke-pickem failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed + native-video-player + position-anchored-reactions + guest-rsvp + pickem)."
```

---

### `css/app.css` — `.pe-*` class family (append at end of file)

**Analog:** `css/app.css:972-988` `.sports-game-card` / `.sports-game-teams` / `.sports-game-time` block (same sports-adjacent context)

**Existing pattern** (conceptual — read app.css:972-988 at planning time for exact selectors):
The `.sports-game-card` recipe uses `.tab-list-card` as its base shell (per UI-SPEC Component reuse map). Phase 28 picker cards use the same base shell with `.pe-picker-card` as an extension class.

**Phase 28 `.pe-*` conventions** (per UI-SPEC):
- `.pe-picker-card` — extends `.tab-list-card`; no new border/shadow — inherits from base shell
- `.pe-chip` — winner-team chip; min-height 44px; default `background: var(--surface-2); border: 1px solid var(--border-mid)`
- `.pe-chip.selected` — selected state: `border: 2px solid var(--accent)`
- `.pe-chip.prefilled` — D-09 pre-fill: `border: 2px solid var(--team-color, var(--accent))`
- `.pe-chip.locked` — locked state: `background: var(--surface); color: var(--ink-dim); border-color: var(--ink-faint)`
- `.pe-tiebreaker-input` — 40px height, `background: var(--surface-2)`, `inputmode="numeric"`
- `.pe-prefill-sub` — brand-voice sub-line: `font-family: var(--font-serif); font-style: italic; color: var(--ink-dim); font-size: var(--t-meta)`
- `.pe-leaderboard-row` — min-height 56px, flex layout
- `.pe-rank-pill` — rank cell: `font-family: var(--font-serif); font-style: italic; font-size: var(--t-h2)`
- `.pe-rank-pill.first` — `color: var(--accent)`; `box-shadow: 0 0 0 2px rgba(197,79,99,0.18)`
- `.pe-picks-closed-pill` — extends `.pill.scheduled`; `background: var(--warn); color: var(--bg)`
- Reduced motion override: `@media (prefers-reduced-motion: reduce) { .pe-* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; } }`

**Token constraint:** No new CSS custom properties. Every token reference is from the existing 47-token alias layer in `css/app.css` Layer 1-2 (lines 32-207). DO NOT add `--pe-*` tokens.

---

## Shared Patterns

### 3-Map Notification Lockstep (DR-3 convention from Phase 14 D-12)

**Source:** Phase 14 — applies to every push event key added to the system
**Apply to:** `js/app.js` `DEFAULT_NOTIFICATION_PREFS`, `js/app.js` `NOTIFICATION_EVENT_LABELS`, `queuenight/functions/index.js` `NOTIFICATION_DEFAULTS`

**Rule:** All 3 maps must be updated in the same plan task (not split across tasks) to prevent a partial-deploy lockstep drift window. The smoke contract asserts all 3 simultaneously.

**Exact format to add:**
```
// Client (js/app.js:330):  pickReminder: true,  pickResults: true,  pickemSeasonReset: true
// Client (js/app.js:377):  pickReminder: { label: '...', hint: '...' }, ...
// Server (index.js:74):    pickReminder: true,  pickResults: true,  pickemSeasonReset: true
```

### `attributedWrite()` Pattern (Firestore rules)

**Source:** `firestore.rules` (present throughout the file; see `watchparties/{wpId}` block lines 585-586)
**Apply to:** `families/{code}/picks/{pickId}` create and update rules

```
allow create: if attributedWrite(familyCode) && ...phase28-specific-guards...;
allow update: if attributedWrite(familyCode) && ...phase28-specific-guards...;
```

`attributedWrite(familyCode)` already handles: auth check, family membership check, and `actingUid` stamping. Phase 28 only adds the lock-time check and CF-only denylist on top.

### `sendToMembers` Reuse Pattern

**Source:** `queuenight/functions/index.js:1632` + `rsvpReminderTick.js:66-72`
**Apply to:** Both `gameResultsTick.js` and `pickReminderTick.js`

Both new CFs must lazy-require `sendToMembers` from `../index.js` (same as `rsvpReminderTick`) rather than re-implementing push fan-out. This inherits: FCM subscription lookup, quiet-hours gate, pref gate (`pickReminder: true` check), dead-sub pruning.

```js
let sendToMembers = null;
try {
  const idx = require('../index.js');
  sendToMembers = idx.sendToMembers || null;
} catch (e) {
  console.error('pickReminderTick: failed to require sendToMembers', e.message);
}
```

### Admin SDK Bypass Convention

**Source:** `firestore.rules:577-583` (Phase 27 comment block)
**Apply to:** `gameResultsTick` writes to `families/{code}/picks/{pickId}` (settle fields) and `families/{code}/leaderboards/...`

Admin SDK bypasses Firestore security rules entirely. No rule additions are needed for leaderboard writes or for the CF-side settlement writes on pick docs. The client rules use `allow write: if false` on leaderboards because admin SDK makes that safe.

### ES Module + Smoke Contract Pattern (Phase 24 native-video-player.js precedent)

**Source:** `js/native-video-player.js` + `scripts/smoke-native-video-player.cjs`
**Apply to:** `js/pickem.js` + `scripts/smoke-pickem.cjs`

1. `js/pickem.js` must have no top-level side effects (no DOM, no network, no Date.now() at import time)
2. Every export must be a pure function or frozen constant
3. The smoke contract uses `await import('../js/pickem.js')` to test the production module directly (not an inline copy) — prevents drift between smoke and production
4. The header comment in `js/pickem.js` must mention the smoke contract path explicitly (mirrors line 18 of `native-video-player.js`)

### Per-Doc try/catch in CF Loops

**Source:** `watchpartyTick` lines 984-986
**Apply to:** Both `gameResultsTick` and `pickReminderTick` inner loops

```js
} catch (e) {
  console.warn('gameResultsTick per-pick failed', familyDoc.id, pickDoc.id, e.message);
  errored++;
}
```

One failure must never abort the entire tick. Every per-doc operation is wrapped in try/catch with a warning log and error counter increment.

---

## No Analog Found

All files have analogs. The following files have partial-analogs with documented divergences:

| File | Divergence from Analog |
|------|------------------------|
| `js/pickem.js` | `native-video-player.js` is the structural analog, but `pickem.js` exports game-logic (slateOf, scorePick) rather than media helpers. The `slateOf` function has no equivalent in any existing module — it's a new primitive. |
| `queuenight/functions/src/gameResultsTick.js` | `watchpartyTick` is the structural analog, but `gameResultsTick` adds a TheSportsDB HTTP call (`feedFetchScore` equivalent) and a `db.runTransaction` leaderboard update — two patterns not present in `watchpartyTick`. The transactional pattern comes from `rsvpSubmit.js` (second analog). |
| `queuenight/functions/src/pickReminderTick.js` | `rsvpReminderTick.js` is the closest analog, but idempotency is stored in a dedicated `picks_reminders/{id}` doc (not on the watchparty doc), because the pick doc may not exist yet at T-15min. This is a deliberate divergence. |
| `firestore.rules` — picks rule | `watchparties/{wpId}` Path B denylist is the pattern analog, but Phase 28 adds a time-based lock check (`request.time.toMillis() < resource.data.gameStartTime`) that has no existing equivalent in the rules file. |
| `js/sports-feed.js` `normalizeTsdEvent` | Only additive — no restructuring. The `smoke-sports-feed.cjs` inline mirror must also be updated to add the 3 new fields to the mirrored `normalizeTsdEvent` implementation. |
| `js/app.js` render functions | `renderSportsScoreStrip` shows the sports-context render pattern, but Phase 28 render functions are substantially larger (5 new functions). The `js/native-video-player.js` → `js/app.js` split precedent shows that when a module grows, pure logic moves to an ES module. UI logic stays in `js/app.js`. |

---

## Metadata

**Analog search scope:** `js/`, `queuenight/functions/src/`, `queuenight/functions/index.js`, `firestore.rules`, `scripts/`, `css/app.css`
**Files scanned:** 12 source files read in full or via targeted Grep+Read
**Pattern extraction date:** 2026-05-02

---

## PATTERN MAPPING COMPLETE

**Phase:** 28 - Social pick'em + leaderboards
**Files classified:** 12 (4 new + 8 modified)
**Analogs found:** 12 / 12

### Coverage
- Files with exact analog: 5 (`js/pickem.js` → `native-video-player.js`; `gameResultsTick.js` → `watchpartyTick`; `pickReminderTick.js` → `rsvpReminderTick.js`; `firestore.rules` picks rule → Phase 24 M2 split; `smoke-pickem.cjs` → `smoke-guest-rsvp.cjs`)
- Files with role-match analog: 5 (render functions → `renderSportsScoreStrip`; `.pe-*` CSS → `.sports-game-card`; deploy.sh extension → existing if-blocks; `NOTIFICATION_*` maps → self-reference; index.js exports → existing rsvp exports)
- Files with no analog: 0

### Key Patterns Identified
- **ES module split (Phase 24 precedent):** `js/pickem.js` follows the `js/native-video-player.js` pattern exactly — pure functions, no side effects, CJS-importable via `await import()` for smoke testing
- **watchpartyTick loop shape:** Both new CFs (`gameResultsTick`, `pickReminderTick`) use the families-iteration → per-doc-try/catch → sendToMembers lazy-require pattern verbatim
- **Phase 24 REVIEWS M2 denylist:** `families/{code}/picks/{pickId}` update rule uses `.affectedKeys().hasAny([...denylist...])` identical to `watchparties/{wpId}` Path B, adding only the time-lock check
- **3-map lockstep (Phase 14 D-12):** All 3 push event keys (`pickReminder`, `pickResults`, `pickemSeasonReset`) added to `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` + `NOTIFICATION_DEFAULTS` in one task; smoke-pickem.cjs cross-repo grep asserts all 9 locations
- **smoke-guest-rsvp.cjs scaffold:** `smoke-pickem.cjs` copies the Phase 27 smoke structure exactly — pure-helper assertions first, production-code sentinels second, floor meta-assertion last

### File Created
`C:\Users\nahde\claude-projects\couch\.planning\phases\28-social-pickem-leaderboards\28-PATTERNS.md`

### Ready for Planning
Pattern mapping complete. Planner can now reference analog patterns in PLAN.md files.
