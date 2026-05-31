---
phase: 16-calendar-layer
researched: 2026-05-27
domain: Recurring-watchparty primitive + scheduled materializer CF + week-view UI + Account-tab series management
confidence: HIGH (file:line citations across couch + queuenight repos; scope is locked, integration surfaces all already shipped)
researcher: gsd-phase-researcher
input-context: .planning/phases/16-calendar-layer/16-CONTEXT.md (scope locked 2026-05-27; full original seed scope, NOT MVP-only)
launch_blocking: true (Add-for-Review held until ships)
---

# Phase 16 — Calendar Layer / Research

## Summary

Phase 16 adds **recurring + multi-future watchparty scheduling** on top of the shipped Phase 7/14/30 watchparty infrastructure. The data primitive is a new top-level `watchpartySeries/{seriesId}` doc; a new scheduled CF (`watchpartySeriesTick`) materializes each upcoming series instance into a `watchparties/{wpId}` doc inside a 24h horizon; reminders ride the existing Phase 6/12 push stack with one new event-type key (`seriesReminder`) added in lockstep across three places (DR-3 pattern, Phase 14 precedent). UI work splits across (a) Tonight-tab "Schedule a series" entry, (b) post-wp "Make recurring?" prompt (TV-only) bolted into the existing Phase 11 wp-post-session modal, (c) new Account-tab "Your series" section co-located with sign-in methods, (d) week-view surface (location decided in plan; recommend Account-tab "Calendar view" sub-screen), (e) in-place edit modal mirroring the existing wp-start modal pattern.

**Risk profile is LOW.** Every integration surface this phase needs is shipped and load-bearing: the Phase 30 top-level `watchparties` collection with `memberUids[]` + `families[]` + `hostFamilyCode` (used at js/app.js:11602-11611 for the canonical wp create shape), the per-event `NOTIFICATION_DEFAULTS` server gate (queuenight/functions/index.js:79-128), the per-family `watchpartyTick` scheduled CF pattern (queuenight/functions/index.js:1144 — 5-min cadence with per-doc try/catch + status re-check idempotency), and the sibling `pickReminderTick` / `rsvpReminderTick` files which are direct templates for how `watchpartySeriesTick` should be structured. No new third-party libs needed; no Firestore rules pattern that isn't already in use.

**Primary recommendation:** Mirror the **pickReminderTick** file structure verbatim for `watchpartySeriesTick.js` (own file under `queuenight/functions/src/`, lazy-require sendToMembers, `onSchedule({ schedule: 'every 5 minutes', region: 'us-central1', memory: '256MiB' })`, doc-existence idempotency check). For the data model, place `watchpartySeries/{seriesId}` at **top-level** (not nested under families/) to match the Phase 30 architecture and enable a single `collectionGroup`-equivalent scan in the CF — the same shape change Phase 30 made for `watchparties` collection. Use `memberUids[]` for read gating (same pattern as top-level wps).

## User Constraints (from CONTEXT.md)

### Locked Decisions (treat as immutable)

- **Data primitive:** `watchpartySeries/{seriesId}` with fields per CONTEXT.md §"Data primitive" — `familyCode, createdBy, createdAt, titleType ('tv'|'untitled'), titleId?, titleName?, daysOfWeek (number[] 0-6), timeOfDay (HH:MM 24h local), timezone (IANA), memberUids[], status ('active'|'paused'|'ended'), lastFiredAt?, nextFireAt, endedAt?, pausedAt?`.
- **Materializer CF:** `watchpartySeriesTick` — cron every 6h (or every 4h "if push reminder timing requires it — pin during planning"). For each active series with `nextFireAt - now < 24h`: instantiate `watchparties/{wpId}` doc, send standard wp-starting push, advance `nextFireAt` to next eligible day, stamp `lastFiredAt`.
- **TWO entry points BOTH ship in v1:**
  - **Entry 1 — Tonight tab "Schedule a series" button** (full creator surface).
  - **Entry 2 — Post-wp "Make recurring?" prompt** ONLY for TV titles (`media_type === 'tv'` / `t.kind === 'TV'`); pre-fills day-of-week + time from the wp's startAt.
- **Cadence picker:** multi-day weekly only. Checkboxes Sun-Sat + time-of-day picker. **Out of scope for v1:** daily-only, monthly, biweekly, custom-interval.
- **Series list view:** new section in **Account tab** (co-located with sign-in methods + notification prefs). Renders title/cadence/next-fire/last-fire/Pause-Cancel + tap-to-edit.
- **Week-view UI:** Location TBD at planning (3 candidates listed in CONTEXT.md; planner picks). Renders 7-day grid + nav + tap instance → detail.
- **In-place edit:** modal pattern matching existing wp-edit. Editable: title (only if `titleType === 'tv'`), daysOfWeek, timeOfDay, memberUids. Cannot change titleType once set. On save: recompute `nextFireAt`. Already-materialized future instances within the 24h window — leave them; series.nextFireAt advances past them.
- **Reminder push:** 30 min before each instance's `startAt`. Reuses Phase 6 infra. New event-type: `seriesReminder`.
- **Pause / Cancel:** Pause clears `nextFireAt`, status='paused', resumable. Cancel sets status='ended' + `endedAt`, removed from active list. Historical wp instances from cancelled series persist (their `seriesId` back-reference still resolves).

### Claude's Discretion

- Week-view UI location (3 candidates documented; planner picks).
- Multi-event-per-day stacking UX (compact rows vs full cards).
- Cross-week nav (swipe gesture vs explicit buttons).
- Mobile-first responsive treatment for week view.
- Recommended wave decomposition (CONTEXT.md offers 8-plan suggestion; planner refines).
- Whether `watchpartySeries` lives at top-level or nested under families/ (this RESEARCH recommends **top-level** for Phase 30 alignment; planner may overrule).
- Whether the materializer skips `watchpartyIntent` and writes wps directly (this RESEARCH recommends **direct wp write**, no intent doc — the intent abstraction exists for RSVP-prior-to-commit; series instances are already committed by virtue of the series existing).

### Deferred Ideas (OUT OF SCOPE — do not plan)

- Daily / monthly / biweekly / custom-interval cadences.
- Holiday/skip handling (no "skip next instance" UX).
- Series-level RSVP (instances use existing per-wp RSVP).
- Auto-end on N consecutive skipped instances.
- "You missed a fire" notification.
- Calendar export (.ics, Google Cal integration).

## Phase Requirements

> The planner will mint the canonical IDs at `/gsd-plan-phase 16` time. The proposed `CAL-16-*` numbering below matches the existing PUSH-XX, REFR-XX, PARTY-XX, KID-19-XX, RSVP-27-XX, PICK-28-XX pattern.

| Proposed ID | Description | Research Support |
|----|-------------|------------------|
| CAL-16-01 | `watchpartySeries/{seriesId}` Firestore primitive (top-level) with the locked field schema | §"Data model proposal" + §"Integration map" §3 (Phase 30 collection-shape precedent) |
| CAL-16-02 | firestore.rules block for `watchpartySeries` — create/read/update/delete branches with `memberUids`-gated read + creator-only mutations | §"Firestore rules" — pattern lifted from top-level wps block at firestore.rules:160-264 |
| CAL-16-03 | `watchpartySeriesTick` scheduled CF — materialize instances + advance nextFireAt + send creation push | §"Cloud Function design" — direct mirror of pickReminderTick |
| CAL-16-04 | Idempotency: each series-fired wp gets a deterministic `wpId` of shape `series_{seriesId}_{instanceDateKey}` so re-runs of the materializer detect "already materialized" via doc-existence check | §"Idempotency strategy" |
| CAL-16-05 | `seriesReminder` 30-min-before push fired by extending `watchpartyTick` (or by a new branch in `watchpartySeriesTick`) | §"Cloud Function design" — Phase 14 precedent for "extend existing tick rather than add new" |
| CAL-16-06 | `seriesReminder` event-type added in lockstep to 3 places (DR-3 pattern): `NOTIFICATION_DEFAULTS` (queuenight/functions/index.js:79), `DEFAULT_NOTIFICATION_PREFS` (js/app.js:443), `NOTIFICATION_EVENT_LABELS` (js/app.js:497) | §"Integration map" §3 — Phase 14 DR-3 + Phase 28 PICK-28-17 precedent |
| CAL-16-07 | Cadence picker UI component — multi-day-of-week checkbox set + time-of-day picker | §"UI scaffolding" §3 (greenfield — no existing day-of-week picker in codebase) |
| CAL-16-08 | Entry 1: "Schedule a series" CTA on Tonight tab + full creator modal | §"UI scaffolding" §1 |
| CAL-16-09 | Entry 2: "Make recurring?" prompt bolted into existing `#wp-post-session-modal-bg` modal (app.html:1307), TV-only gate via `t.kind === 'TV'` check at js/app.js:13807 precedent | §"UI scaffolding" §2 |
| CAL-16-10 | Account-tab "Your series" section — new `<div class="tab-section" id="series-list-card">` following `#signin-methods-card` pattern at app.html:674; renderer follows `renderSignInMethodsCard()` shape at js/app.js:15864 | §"UI scaffolding" §4 |
| CAL-16-11 | Week-view surface (location TBD by planner) — 7-day grid, time slots, multi-event stacking | §"UI scaffolding" §5 |
| CAL-16-12 | In-place edit modal — recompute `nextFireAt` from new cadence on save | §"UI scaffolding" §6 |
| CAL-16-13 | Pause / Resume / Cancel actions on series list rows | §"UI scaffolding" §4 |
| CAL-16-14 | sw.js CACHE bump + cross-repo deploy ritual (CFs from queuenight FIRST, then couch hosting) | §"Project Constraints" |
| CAL-16-15 | Composite index for `watchpartySeries` `where('status','==','active') orderBy('nextFireAt')` query the materializer uses | §"Cloud Function design" — REVIEWS Amendment 5 / HIGH-3 precedent (composite indexes for collectionGroup queries) |

## Project Constraints (from CLAUDE.md)

- **js/app.js token cost:** ~15800 lines (~190K tokens). NEVER read in full. Use Grep + Read(offset, limit).
- **No bundler.** Single-HTML app shell (app.html) + ES modules in js/. No webpack/vite/rollup additions.
- **Firebase Hosting + Firestore + Cloud Functions** (queuenight repo). Region `us-central1`. Project `queuenight-84044`. Blaze billing enabled.
- **Brand:** Fraunces + Instrument Serif + Inter. Warm dark palette `#14110f`. "Restraint is the principle." No animations beyond canonical motion tokens (`--t-spin`, `--t-celebrate`, etc.).
- **sw.js CACHE bump:** Every user-visible change must bump `CACHE` in sw.js (currently `couch-v42-phase-15.3-transparency` per sw.js:8; CLAUDE.md mentions `couch-v47-pickem` — sw.js is source of truth). Auto-bumped via `bash scripts/deploy.sh <short-tag>`.
- **Cross-repo deploy ritual** (when CFs change): deploy CFs from queuenight FIRST (`firebase deploy --only functions` from `~/queuenight/`), then couch hosting (`bash scripts/deploy.sh <tag>` from couch repo). This phase WILL touch CFs.
- **Public-by-design secrets:** TMDB key + Firebase web config are intentionally client-embedded. VAPID public key same. Do NOT "fix" these.
- **Test on mobile Safari** — PWA + iOS home-screen is the primary surface.
- **Requirements naming convention:** PUSH-XX / REFR-XX / PARTY-XX / KID-19-XX / RSVP-27-XX / PICK-28-XX. Phase 16 should use `CAL-16-XX`.
- **Plan-slot safeguard:** seeds/decision-ritual-locked-scope.md is the originating seed for this phase scope. Do not reassign Phase 16 to other scope.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `watchpartySeries` schema definition + lifecycle | Database (Firestore) | API (Cloud Functions) | Schema enforced by firestore.rules; lifecycle transitions (active → paused → ended) gated client-side with rule-level validation |
| Series instance materialization | Cloud Function (scheduled) | Database | `onSchedule` CF runs server-side every 6h; writes new `watchparties/{wpId}` docs via admin SDK (bypasses rules) |
| 30-min reminder push | Cloud Function (scheduled) | — | Reuses existing scheduled-CF pattern; same place where `watchpartyTick` already lives at queuenight/functions/index.js:1144 |
| Series creation UI (Entry 1) | Browser / Client (PWA) | — | Modal in app.html shell; renderer in js/app.js writes directly to Firestore via attributedWrite |
| Post-wp "Make recurring?" prompt (Entry 2) | Browser / Client | — | Bolts into the existing Phase 11 wp-post-session modal flow (app.html:1307 / js/app.js:13784 openPostSession) |
| Series list view (Account tab) | Browser / Client | Database (onSnapshot) | New section in Account screen; subscribes to family's series collection via onSnapshot for real-time pause/cancel reflection |
| Week-view UI | Browser / Client | Database | Pure render pass; reads from cached `state.series[]` + materialized wp instances; no server work |
| In-place edit | Browser / Client | Database | updateDoc on the series doc + recompute nextFireAt client-side; rules accept the diff |
| Pause / Cancel actions | Browser / Client | Database | Simple status updateDoc; rules accept creator-only OR member-only writes |
| `seriesReminder` push enforcement | Cloud Function | Database (user prefs read) | Same flow as every other event-type push — `sendToMembers(..., {eventType: 'seriesReminder'})` reads `users/{uid}.notificationPrefs.seriesReminder` and gates |

## Integration Map (with file:line citations)

### 1. `watchparties` top-level collection (Phase 30) — canonical wp doc shape

The materializer CF writes to `watchparties/{wpId}`. Reference shape from **js/app.js:11575-11612** (`confirmStartWatchparty`):

```js
const wp = {
  id,                         // 'wp_' + Date.now() + '_' + random — for series, use deterministic ID instead (see §Idempotency)
  titleId, titleName, titlePoster,  // from series.titleId / series.titleName for titleType=='tv'; null for 'untitled'
  hostId: state.me.id,        // series.createdBy (the series creator is the wp host)
  hostName: state.me.name,
  hostUid: state.auth.uid,
  creatorTimeZone,            // series.timezone (IANA)
  startAt,                    // series.nextFireAt
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  status: 'scheduled',        // future-dated; watchpartyTick flips to 'active' at startAt
  participants: {
    [hostId]: { name, joinedAt, rsvpStatus: 'in', reactionsMode: 'elapsed', reactionDelay: 0, pausedOffset: 0 }
  },
  reactions: [],
  videoUrl: null, videoSource: null,
  // === Phase 30 — Couch groups fields ===
  hostFamilyCode: state.familyCode,
  families: [state.familyCode],
  memberUids: [/* uids of series.memberUids */],
  crossFamilyMembers: [],
  // === Phase 16 NEW: back-reference for "Part of {seriesName} series" badge ===
  seriesId: series.id,
  seriesInstanceDateKey: 'YYYY-MM-DD'  // deterministic per fire — idempotency key
};
```

The CF writes via admin SDK (bypasses firestore.rules; the top-level wp create rule at firestore.rules:198-206 is for client-creates only and would actually reject this write because the actor isn't a real auth.uid — only admin SDK can write `seriesId` back-references).

**Existing top-level wp create rule** (firestore.rules:160-264) defines five locked invariants the CF write should satisfy for parity:
- `hostUid` set
- `auth.uid in memberUids` — CF doesn't have auth.uid, but admin write bypass means this isn't enforced for series-materialized wps
- `families == [hostFamilyCode]`
- `crossFamilyMembers.size() == 0`
- `hostFamilyCode` family doc exists

For Phase 16, set the same shape so that downstream Phase 30 collectionGroup queries (`collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` at js/app.js:5125) pick up materialized wps the same as client-created ones.

### 2. `watchpartyIntents` (Phase 14 / DR-1) — DO NOT use for series instances

The materializer should **skip the intent doc** and write straight to `watchparties/{wpId}`. Rationale:

- Intents exist to capture "I want to watch X" *before* commitment, with RSVP gates that decide whether the intent converts. A series instance is already committed (the user committed when they created the series), so the intent abstraction adds zero value.
- Writing an intent first would require the materializer to either (a) wait for RSVPs (defeats the point of recurring), or (b) auto-convert immediately (so why have the intent doc at all?).
- The existing Phase 14 Flow B auto-convert at T-15min (queuenight/functions/index.js:1285-1357) IS the intent → wp pipeline for one-off nominations. Series doesn't need to replicate it.

**Implication for the planner:** the materializer CF body is small — it writes one new doc to `watchparties/{wpId}` and one updateDoc to `watchpartySeries/{seriesId}` per fire. No intent doc, no RSVP coordination.

### 3. Push notification infrastructure (Phase 6 + 12 + DR-3 lockstep)

Three-place lockstep is the codebase convention for adding a new push event-type. Pattern documented at the **Phase 14 DR-3 callout** (14-RESEARCH.md:48-58) and applied at Phase 28 PICK-28-17 (file evidence: queuenight/functions/index.js:121-128 + js/app.js:480-487 + js/app.js:536-543).

For Phase 16, add `seriesReminder` to:

1. **queuenight/functions/index.js:79-128** — append `seriesReminder: true` to `NOTIFICATION_DEFAULTS`. Without this, `sendToMembers()` falls back to `defaultOn=true` per the `hasDefault` check at index.js:320-321 — pushes go through but the per-user toggle is ignored on the server.
2. **js/app.js:443-487** — append `seriesReminder: true` to `DEFAULT_NOTIFICATION_PREFS`. Controls UI default + which keys `getNotificationPrefs()` returns.
3. **js/app.js:497-543** — append `seriesReminder: { label: 'Recurring watchparty reminder', hint: 'Heads-up that a series instance is starting in 30 minutes.' }` to `NOTIFICATION_EVENT_LABELS`. Without this the toggle has no label in Settings.

**Default ON or OFF?** Phase 14 convention (RESEARCH §5) was "default ON for state-change pushes the user has actively opted into by engaging with the flow." Series reminders fire only because the user created the series, so default ON aligns with that.

**Friendly-UI parity (Phase 12 / NOTIF_UI_TO_SERVER_KEY at js/app.js:549):** the Phase 14 / 15 / 18 / 28 precedent (see js/app.js:493-496 comment block) is to **skip** adding to the friendly-UI maps because the dual-Settings-screen collision is unresolved (TD-8 follow-up). Phase 16 should follow that precedent — only add to the legacy 3 places.

**Push body copy (BRAND voice, friend-voice, no banned words — Phase 14 D-12 convention):**
- Title: `"Couch in 30 min"` (warm, declarative)
- Body: `"\"{titleName}\" — your weekly couch night is coming up."` (or for untitled series: `"Family movie night — couch in 30 min."`)

**`sendToMembers` call site** for the materializer (queuenight/functions/index.js:298-355):
```js
await sendToMembers(familyCode, series.memberUids, {
  title: 'Couch in 30 min',
  body: `"${series.titleName || 'Family movie night'}" — your weekly couch night is coming up.`,
  tag: `series-reminder-${seriesId}-${instanceDateKey}`,
  url: `/app?wp=${wpId}`
}, { eventType: 'seriesReminder' });
```

`tag` must be deterministic per (series, instance) to prevent OS-level notification stacking duplicates if the CF fires twice.

### 4. Cloud Scheduler / onSchedule patterns — direct templates

Five existing scheduled CFs in the codebase. Phase 16 should mirror **pickReminderTick** most closely (own-file structure under `queuenight/functions/src/`).

| CF | File | Schedule | Memory | Idempotency mechanism | Verdict for Phase 16 |
|----|------|---------|--------|------------------------|----------------------|
| `watchpartyTick` | queuenight/functions/index.js:1144 | every 5 min | 256MiB | Status re-checks on every iteration (`if wp.status === 'scheduled'`) | Pattern reusable. CONSIDER extending this tick to do series materialization, but RECOMMEND a separate file for cleaner ownership (see below) |
| `providerRefreshTick` | queuenight/functions/index.js:1626 | (cron declared in file) | 256MiB | TMDB rate-limit abort sentinel | Not directly applicable — different problem |
| `pickReminderTick` | queuenight/functions/src/pickReminderTick.js | every 5 min | 256MiB | Firestore idempotency doc at `picks_reminders/{leagueKey}_{gameId}_{memberId}` — written BEFORE the push call | **Direct template for `watchpartySeriesTick`.** Own file, lazy-require sendToMembers, idempotency-doc pattern |
| `rsvpReminderTick` | queuenight/functions/src/rsvpReminderTick.js | every 15 min | 256MiB | In-doc flag map `wp.reminders[participantId][windowKey] = true` written BEFORE send | Pattern reusable for the 30-min reminder push (store flag on the materialized wp doc, NOT on the series doc) |
| `gameResultsTick` | queuenight/functions/src/gameResultsTick.js | every 5 min | (per file) | `pick.processedFirstAt` sentinel + per-leaderboard transaction | Not directly applicable |

**Recommendation for Phase 16 CF structure:**
- New file: `queuenight/functions/src/watchpartySeriesTick.js` — owns materialization (every 6h per CONTEXT, or every 4h — see §"Open questions").
- Extend existing `watchpartyTick` (queuenight/functions/index.js:1144) with one new branch for the 30-min reminder push, mirroring the Phase 14 intent expiry branch added at queuenight/functions/index.js:1269-1418. **Rationale:** the reminder push depends on materialized wp docs (not series docs); `watchpartyTick` already iterates wp docs every 5 min; adding a branch costs almost nothing vs a separate every-5-min CF.

Boilerplate for the new file (lift verbatim from pickReminderTick.js:34-82):

```js
'use strict';
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const SERIES_MATERIALIZE_HORIZON_MS = 24 * 60 * 60 * 1000;  // 24h per CONTEXT

let sendToMembers = null;
try {
  const idx = require('../index.js');
  sendToMembers = idx.sendToMembers || null;
} catch (e) {
  console.error('watchpartySeriesTick: failed to require sendToMembers', e && e.message);
}

exports.watchpartySeriesTick = onSchedule({
  schedule: 'every 6 hours',
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '256MiB'
}, async () => {
  // ... per §"Cloud Function design" body below
});
```

Don't forget to wire the export at queuenight/functions/index.js (mirror line 1937):
```js
exports.watchpartySeriesTick = require('./src/watchpartySeriesTick').watchpartySeriesTick;
```

### 5. Account tab "section" pattern — exact precedent

The Account tab (app.html:660-742) is divided into 3 clusters: YOU, YOUR COUCH, ADMIN. The new "Your series" section should live at the **start of the YOUR COUCH cluster**, just above "Streaming services" (app.html:698) — series scheduling sits next to the integration / notification controls thematically.

**Section pattern** (lifted from `#signin-methods-card` at app.html:674-678):
```html
<div class="tab-section" id="series-list-card" style="display:none;">
  <div class="tab-section-h"><span>Your series</span></div>
  <p class="tab-section-sub">Recurring watchparties. Pause, edit, or cancel from here.</p>
  <div id="series-list" class="tab-list-card"></div>
</div>
```

**Renderer pattern** (mirror `renderSignInMethodsCard` at js/app.js:15864-15951):
```js
function renderSeriesList() {
  const card = document.getElementById('series-list-card');
  const list = document.getElementById('series-list');
  if (!card || !list) return;
  const series = (state.series || []).filter(s => s.status !== 'ended');
  if (!series.length) { card.style.display = 'none'; return; }
  card.style.display = '';
  list.innerHTML = series.map(renderSeriesRow).join('');
}
```

Call from `renderSettings()` (js/app.js — search target; see also js/app.js:6711 `renderSignInMethodsCard` callsite for the pattern).

### 6. firestore.rules conventions

The Phase 30 top-level wp rules block at firestore.rules:160-264 is the direct template. Schema for Phase 16's `watchpartySeries`:

**Recommendation: top-level collection, member-uid read gating.** Rationale:
- Aligns with Phase 30 architecture (collection-shape future direction).
- Single-doc reads from any device (no need to know the familyCode path).
- Future cross-family series ("our blended family's Tuesday movie night") can use `families[]` + `memberUids[]` analogously to wps without a migration.

Sketch:
```
match /watchpartySeries/{seriesId} {
  // READ: any member listed in series.memberUids
  allow read: if signedIn() && request.auth.uid in resource.data.memberUids;

  // CREATE: creator must be in own memberUids; familyCode is set + creator is in that family
  allow create: if signedIn()
    && request.resource.data.createdBy == uid()
    && request.auth.uid in request.resource.data.memberUids
    && request.resource.data.familyCode is string
    && exists(/databases/$(database)/documents/users/$(uid())/groups/$(request.resource.data.familyCode))
    && request.resource.data.status == 'active'
    && request.resource.data.daysOfWeek is list
    && request.resource.data.timeOfDay is string
    && request.resource.data.timezone is string;

  // UPDATE: creator can edit cadence/title/members + change status (pause/resume/cancel)
  //         CF (admin SDK) bypasses rules for nextFireAt / lastFiredAt advancement
  allow update: if signedIn()
    && resource.data.createdBy == uid()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([
      'daysOfWeek', 'timeOfDay', 'timezone', 'memberUids',
      'titleId', 'titleName',  // only if titleType === 'tv' (cannot change titleType once set)
      'status', 'pausedAt', 'endedAt', 'nextFireAt',
      'actingUid', 'managedMemberId', 'memberId', 'memberName'
    ])
    // Prevent titleType change post-create
    && resource.data.titleType == request.resource.data.titleType;

  // DELETE: denied — use status='ended' for soft-delete; historical wp instances back-reference seriesId
  allow delete: if false;
}
```

**Auth helper reuse:** `signedIn()` at firestore.rules:26, `uid()` at firestore.rules:30. No need to define new helpers.

### 7. Timezone handling

Existing pattern at js/app.js:2172-2175, 11571-11574 (and 3 other sites for sports wps):
```js
const creatorTimeZone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch (e) { return null; }
})();
```

**For Phase 16:** stamp `series.timezone` at create time using exactly this pattern. The materializer CF must compute `nextFireAt` as a UTC ms timestamp by combining:
- The series's `daysOfWeek` + `timeOfDay` (e.g., `Monday 8:00 PM`)
- The series's `timezone` (e.g., `'America/Los_Angeles'`)
- The current calendar date

**Concrete computation pattern** (must be implemented carefully — DST is the landmine):

```js
function computeNextFireAt(daysOfWeek, timeOfDayHHMM, timezone, now = Date.now()) {
  const [hh, mm] = timeOfDayHHMM.split(':').map(Number);
  // Walk forward 1 day at a time from `now`, in the family's tz, until we hit a
  // weekday that's in daysOfWeek. Compute the wall-clock time for that day at
  // (hh:mm) in `timezone`, then convert to UTC ms. Skip same-day if the time has
  // already passed today.
  for (let dayOffset = 0; dayOffset < 8; dayOffset++) {
    const candidate = new Date(now + dayOffset * 24 * 60 * 60 * 1000);
    // Get the day-of-week IN THE FAMILY'S TZ (NOT UTC). Use Intl.DateTimeFormat.
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(candidate);
    const weekdayName = parts.find(p => p.type === 'weekday').value;
    const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(weekdayName);
    if (!daysOfWeek.includes(dow)) continue;
    // Construct an ISO timestamp string in the family's tz and parse it back
    // (this is the DST-correct way to map wall-clock → UTC ms in JS without
    // a tz library — the Intl trick).
    const y = parts.find(p => p.type === 'year').value;
    const mo = parts.find(p => p.type === 'month').value;
    const d = parts.find(p => p.type === 'day').value;
    // Build a fake UTC date for hh:mm on YMD, then ask: "in `timezone`, what's
    // the offset right now?" Adjust by the offset.
    const utcGuess = Date.UTC(+y, +mo - 1, +d, hh, mm);
    const tzOffset = getTimezoneOffsetForDate(utcGuess, timezone);  // helper — Intl-based
    const fireAt = utcGuess - tzOffset;
    if (fireAt > now) return fireAt;
    // else: same-day but past — fall through to next day
  }
  return null;  // should never happen with daysOfWeek non-empty + 8-day window
}
```

**The `tzOffset` helper is the gotcha.** No standard JS API gives "offset of timezone X at instant T." The pattern that works:
```js
function getTimezoneOffsetForDate(utcMs, timezone) {
  const date = new Date(utcMs);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(date);
  // Reconstruct what the wall-clock says in that tz, compare to UTC parts, derive offset
  // ... (see https://stackoverflow.com/a/68593283 — well-tested pattern)
}
```

**Alternative:** require a tz library (luxon ~70KB) — but that violates CLAUDE.md "no bundler" rule and adds runtime dep. **Recommendation: use the Intl-based hand-rolled helper.** Couch has 4 existing tz-aware sites that all use raw Intl successfully (js/app.js:2172, 10821, 11032, 11571 + queuenight/functions/index.js:50-75 `isInQuietHours`). One more is fine.

**DST behavior:** the algorithm above is DST-correct because it computes the offset *for the candidate date*, not a fixed offset. A series scheduled "Monday at 8pm America/Los_Angeles" will fire at the correct wall-clock 8pm whether DST is in effect or not. Verified pattern matches `isInQuietHours` at queuenight/functions/index.js:50.

### 8. Tonight tab affordances — where the "Schedule a series" CTA goes

Tonight tab structure (app.html:340-420):
1. `#cv15-pickup-container` — pick-up-where-you-left-off widget
2. `#flow-a-entry-container` — Flow A "Pick a movie for the couch" CTA (renderer at js/app.js:17715)
3. `#picker-card` — whose-turn-to-pick rotation
4. `#wp-banner-tonight` — active watchparty banner
5. `#tonight-intents-strip` — open intents (Phase 8)
6. `#t-filters` — mood + paid filters
7. `#t-section / #matches-list` — Tonight's picks
8. `#t-section-actions` — CTAs slot (currently empty)
9. `#upnext-section`, `#continue-section`, `#next3-section`, `#activity-section`

**Recommendation:** drop the "Schedule a series" CTA into the existing `#t-section-actions` slot at app.html:393 — it's already designed as the "below-matches" CTA area and is currently unused. The renderer would conditionally inject:
```js
const actions = document.getElementById('t-section-actions');
actions.innerHTML = `<button class="pill" type="button" onclick="openSeriesCreate()">Schedule a series</button>`;
```

Render this from `renderTonight()` at js/app.js:5774 conditional on `state.familyCode && state.me` (same guards as Flow A entry).

**Alternative considered:** add the CTA in `renderFlowAEntry()` (js/app.js:17715) as a secondary action next to "Open picker." Rejected because Flow A is one-off-pick-tonight; series is a different mental model and shouldn't share that surface.

### 9. Multi-day cadence picker UX — greenfield

**No existing day-of-week picker in the codebase** (grepped: no matches for `dayOfWeek`, `day-of-week`, `weekday-pick`, `cadence-pick`). Build from scratch.

Recommended CSS class names matching the design system (Fraunces serif headers, warm-dark, `--accent` amber for active state — pattern lifted from `.wp-lead-btn` at app.html:1237-1242 which is the most analogous control):

```html
<div class="series-dow-picker" role="group" aria-label="Days of the week">
  <button class="series-dow-btn" data-dow="0" aria-pressed="false">S</button>
  <button class="series-dow-btn" data-dow="1" aria-pressed="false">M</button>
  <button class="series-dow-btn" data-dow="2" aria-pressed="false">T</button>
  <button class="series-dow-btn" data-dow="3" aria-pressed="false">W</button>
  <button class="series-dow-btn" data-dow="4" aria-pressed="false">T</button>
  <button class="series-dow-btn" data-dow="5" aria-pressed="false">F</button>
  <button class="series-dow-btn" data-dow="6" aria-pressed="false">S</button>
</div>
```

Match `.wp-lead-btn` styling (round pill, active state via `.on` class, warm-dark fill, amber accent on active). CSS additions in css/app.css around the existing `.wp-lead-btn` rules (search target — planner: grep `.wp-lead-btn` in css/app.css).

**Time-of-day picker:** reuse `<input type="datetime-local">` pattern from app.html:1247 `#wp-schedule-input` — but for series we only need the time portion. Use `<input type="time" id="series-time-input" class="form-input-block">` — native iOS Safari + Android Chrome support is solid.

### 10. Week-view UI patterns — greenfield, propose location decision

No existing calendar surface in the codebase. The past-parties tall-sheet (app.html:1061 per CONTEXT mention) is a list, not a grid. Three location candidates per CONTEXT, recommended order:

**Recommendation: dedicated week-view modal launched from Account-tab "Calendar view" button.**

Pros: doesn't bloat the Tonight tab; doesn't require a 5th bottom-tab; Account tab is the natural home for "series management" + "calendar view" (both about looking forward at scheduled couch time); modal pattern is well-trod in this codebase.

CSS scaffolding (greenfield — no precedent):
```css
.series-week-view { display:grid; grid-template-columns: repeat(7, 1fr); gap: var(--s2); }
.series-week-col { display:flex; flex-direction:column; gap:var(--s1); min-height: 320px; }
.series-week-col-h { font-family: var(--font-serif); font-size: var(--fs-sm); }
.series-week-event { background: var(--surface-2); border-radius: var(--r-sm); padding: var(--s1); font-size: var(--fs-xs); }
.series-week-event.series-instance { border-left: 2px solid var(--accent); }
.series-week-event.one-off { border-left: 2px solid var(--surface-3); }
```

**Mobile-first constraint:** 7-column grid is brutal on a 375px-wide iPhone SE viewport (~53px per column). Two acceptable patterns:
1. **Stack to a 1-column day-by-day list on viewport <600px** — show one day at a time, swipe left/right to navigate. Cleaner on mobile, sacrifices the "see the whole week at once" affordance.
2. **Compact-row stacking** — keep 7 columns but make each event a single-line pill ("8pm · Idol"). Tap expands to full card.

**Recommendation: pattern 1 (1-column day view on mobile, 7-column grid on tablet/desktop).** The desktop pattern is rare for couch's primary surface (mobile Safari PWA), but the responsive layer at css/app.css line ~2330 already supports `@media (min-width: 900px)` desktop styling.

**Multi-event stacking within a day:** compact rows (`.series-week-event` one-liners) with tap-to-expand into the existing tonight wp banner pattern (`#wp-banner-tonight`) for full detail. Avoids modal-within-modal complexity.

### 11. In-place edit modal — mirror existing wp-start

The `#wp-start-modal-bg` at app.html:1228 is the closest precedent (full-screen modal, modal-x close button, `<button class="modal-close">Send invites</button>` action). Mirror that shape for `#series-edit-modal-bg`:

```html
<div class="modal-bg" id="series-edit-modal-bg" role="dialog" aria-modal="true" aria-label="Edit series">
  <div class="modal">
    <button type="button" class="modal-x-btn" data-action="close" aria-label="Close" onclick="closeSeriesEdit()">...</button>
    <h3>Edit your series</h3>
    <div class="modal-field-stack">
      <!-- title field (TV only — hidden when titleType !== 'tv') -->
      <!-- daysOfWeek picker -->
      <!-- timeOfDay picker -->
      <!-- members chips -->
      <button class="modal-close" onclick="saveSeriesEdit()">Save changes</button>
      <button class="pill modal-btn-block" onclick="closeSeriesEdit()">Cancel</button>
    </div>
  </div>
</div>
```

The create modal (Entry 1) and edit modal can share the same DOM container — just toggle whether the title field is editable based on context (always editable on create; conditional on edit per the "titleType locked once set" rule).

### 12. Idempotency / replay safety for materializer

**The deterministic-wp-id pattern** is the strongest idempotency:

```js
const instanceDateKey = new Date(nextFireAt)
  .toLocaleDateString('en-CA', { timeZone: series.timezone });  // 'YYYY-MM-DD' in family tz
const wpId = `series_${seriesId}_${instanceDateKey}`;

const wpRef = db.collection('watchparties').doc(wpId);
const wpSnap = await wpRef.get();
if (wpSnap.exists) {
  // Already materialized — short-circuit; just advance series.nextFireAt if needed
  return;
}
await wpRef.set({ /* wp doc */ });
```

This is **stronger than the pickReminderTick `picks_reminders/{...}` sentinel pattern** because the deduplication target IS the wp doc itself — there's no race window between "check sentinel" and "write wp." If two CF invocations both call `set()` with the same ID, Firestore's last-write-wins behavior is benign: both writes produce the same doc state (the materializer is pure given a `seriesId + nextFireAt` input).

**Canonical idempotency-doc pattern in this codebase:**
- `picks_reminders/{leagueKey}_{gameId}_{memberId}` — pickReminderTick at queuenight/functions/src/pickReminderTick.js:153-167 (written BEFORE the push)
- `wp.reminders[participantId][windowKey]` flag — rsvpReminderTick at queuenight/functions/src/rsvpReminderTick.js:179, 217 (written BEFORE the push)
- `intent.warned30 = true` — Phase 14 intent expiry at queuenight/functions/index.js:1361-1378 (written BEFORE the push)
- `wp.startedAt || now` — watchpartyTick at queuenight/functions/index.js:1171, 1184, 1221 (status re-check + status-fence pattern)
- `pick.processedFirstAt` — gameResultsTick (transaction-scoped sentinel)

**Verdict for Phase 16:** Use the deterministic-wp-id pattern (strongest). The 30-min reminder push should use the `wp.reminders` in-doc flag pattern (mirror rsvpReminderTick) — set `wp.reminders.seriesReminder.t-30min = true` atomically before calling `sendToMembers`.

## Runtime State Inventory

> Phase 16 is **greenfield** (creates new primitive, no rename / refactor / migration of existing data). The standard runtime-state checklist applies vacuously, but documented here for completeness.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — Phase 16 introduces a NEW `watchpartySeries` collection. No existing collection is being renamed or restructured. | None |
| Live service config | None — no n8n / Tailscale / Cloudflare / Datadog config affected. | None |
| OS-registered state | None — no Windows Task Scheduler / pm2 / launchd / systemd registrations. | None |
| Secrets/env vars | None new — reuses existing VAPID + TMDB env vars at queuenight/functions/.env. | None |
| Build artifacts | None — no compiled binaries, no pip egg-info, no Docker image tag changes. New CF file in `queuenight/functions/src/` is picked up via Node `require()` at deploy time. | None |

**The single runtime-relevant deploy ordering:** CFs from queuenight MUST deploy before couch hosting, because the client code (js/app.js) will reference event-type `seriesReminder` in `DEFAULT_NOTIFICATION_PREFS` — if the server-side `NOTIFICATION_DEFAULTS` doesn't have the key yet, pushes go through with `defaultOn=true` (no harm), but for cleanliness keep ordering: queuenight `firebase deploy --only functions` FIRST, then couch `bash scripts/deploy.sh <tag>` SECOND.

## Data model proposal (Firestore shape)

### `watchpartySeries/{seriesId}` — top-level

Locked schema from CONTEXT.md, with `seriesId` doc-id convention added:

| Field | Type | Required | Notes |
|-------|------|---------|-------|
| `id` | string | yes | Same as doc ID. Convention: `series_<base36-timestamp>_<random>` mirroring `wp_` IDs at js/app.js:11567 |
| `familyCode` | string | yes | The hosting family. Single-family in v1 (no cross-family series). Future-proofed: schema allows expansion |
| `createdBy` | string (memberId) | yes | `state.me.id` at create time. Only this member can edit/pause/cancel via rules |
| `createdByUid` | string \| null | yes | Stored for auth-bypass paths (admin SDK CF write of nextFireAt advancement) |
| `createdAt` | number (ms) | yes | `Date.now()` at create |
| `titleType` | `'tv' \| 'untitled'` | yes | Immutable after create — rules enforce |
| `titleId` | string \| undefined | iff `titleType==='tv'` | TMDB ID. Editable via the edit modal |
| `titleName` | string \| undefined | iff `titleType==='tv'` | Denormalized for list rendering. Edited when `titleId` changes |
| `daysOfWeek` | number[] | yes | 0=Sun..6=Sat. Must be non-empty array of unique values in 0-6 |
| `timeOfDay` | string | yes | `'HH:MM'` 24h local in family tz. Validated client + server (rules `matches('^[0-2][0-9]:[0-5][0-9]$')`) |
| `timezone` | string | yes | IANA name (`'America/Los_Angeles'`). Captured via `Intl.DateTimeFormat().resolvedOptions().timeZone` at create time |
| `memberUids` | string[] | yes | Recipients of fire push + reminder push + read-gate for rules. Includes `createdByUid` |
| `status` | `'active' \| 'paused' \| 'ended'` | yes | Active is default. Pause clears `nextFireAt`. End is soft-delete |
| `lastFiredAt` | number (ms) \| undefined | no | Set by CF on each materialization |
| `nextFireAt` | number (ms) \| null | yes when active; null when paused | Computed from cadence. Advanced by CF after each fire |
| `endedAt` | number (ms) \| undefined | iff `status==='ended'` | Stamped on Cancel action |
| `pausedAt` | number (ms) \| undefined | iff `status==='paused'` | Stamped on Pause action |
| `actingUid`, `memberId`, `memberName`, `managedMemberId?` | attribution echo | yes | Standard writeAttribution payload — required for rules (firestore.rules:69-82 validAttribution) |

### `watchparties/{wpId}` — additions (back-references)

When the materializer creates an instance, the wp doc gets two NEW fields (additive, no migration of existing wps needed):

| Field | Type | Notes |
|-------|------|-------|
| `seriesId` | string | Back-reference to the originating series. Enables "Part of {seriesName}" badge in wp UI |
| `seriesInstanceDateKey` | string | `'YYYY-MM-DD'` in family tz — same key used in deterministic `wpId` |

Rules update: the top-level `watchparties` create allow list (firestore.rules:198-206) is client-only; CF writes via admin SDK bypass it. No rule change needed for `seriesId` / `seriesInstanceDateKey` to be writable.

### Composite indexes needed

In `firestore.indexes.json` (currently 1 composite + 1 fieldOverride per file read):

```json
{
  "collectionGroup": "watchpartySeries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "nextFireAt", "order": "ASCENDING" }
  ]
}
```

The CF query: `db.collection('watchpartySeries').where('status', '==', 'active').where('nextFireAt', '<', now + 24h).orderBy('nextFireAt')`. Without the composite index this fails in production (REVIEWS Amendment 5 / HIGH-3 precedent at firestore.indexes.json:3-15).

Deploy via `firebase deploy --only firestore:indexes` from the couch repo root.

Also useful (for the Account-tab list view rendering active series sorted by next-fire):

```json
{
  "collectionGroup": "watchpartySeries",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "familyCode", "order": "ASCENDING" },
    { "fieldPath": "status", "order": "ASCENDING" },
    { "fieldPath": "nextFireAt", "order": "ASCENDING" }
  ]
}
```

## Cloud Function design

### `watchpartySeriesTick.js` body sketch

```js
exports.watchpartySeriesTick = onSchedule({
  schedule: 'every 6 hours',
  region: 'us-central1',
  timeoutSeconds: 240,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  const horizon = now + 24 * 60 * 60 * 1000;
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
    const series = seriesDoc.data();
    try {
      // Compute deterministic wpId
      const instanceDateKey = new Date(series.nextFireAt)
        .toLocaleDateString('en-CA', { timeZone: series.timezone || 'UTC' });
      const wpId = `series_${seriesDoc.id}_${instanceDateKey}`;

      const wpRef = db.collection('watchparties').doc(wpId);
      const wpSnap = await wpRef.get();
      if (!wpSnap.exists) {
        // Materialize the wp doc (admin SDK write — bypasses rules)
        await wpRef.set({
          id: wpId,
          titleId: series.titleId || null,
          titleName: series.titleName || (series.titleType === 'untitled' ? 'Family movie night' : null),
          titlePoster: '',
          hostId: series.createdBy,
          hostName: null,  // resolved per push send
          hostUid: series.createdByUid,
          creatorTimeZone: series.timezone,
          startAt: series.nextFireAt,
          createdAt: now,
          lastActivityAt: now,
          status: 'scheduled',
          participants: {
            [series.createdBy]: {
              name: null, joinedAt: now, rsvpStatus: 'in',
              reactionsMode: 'elapsed', reactionDelay: 0, pausedOffset: 0
            }
          },
          reactions: [],
          videoUrl: null, videoSource: null,
          hostFamilyCode: series.familyCode,
          families: [series.familyCode],
          memberUids: series.memberUids,
          crossFamilyMembers: [],
          // Phase 16 back-references
          seriesId: seriesDoc.id,
          seriesInstanceDateKey: instanceDateKey,
          // Attribution echo (mirrors writeAttribution() shape)
          actingUid: series.createdByUid,
          memberId: series.createdBy,
          memberName: null
        });
        materialized++;

        // Send the "watchparty scheduled" push (reuses existing onWatchpartyCreate would
        // fire — BUT that trigger is on the nested path, not top-level. The top-level
        // equivalent is onWatchpartyCreateTopLevel at queuenight/functions/index.js:542.
        // Verify whether onWatchpartyCreateTopLevel fires on admin-SDK writes — Firestore
        // doc-create triggers DO fire on admin writes (no auth context distinction).
        // So we get the push fan-out FOR FREE — no explicit sendToMembers needed here.
      } else {
        alreadyExisted++;
      }

      // Advance nextFireAt regardless of materialization (idempotent: re-running this
      // for the same series in the same 6h window yields the same advanced value).
      const newNextFireAt = computeNextFireAt(
        series.daysOfWeek,
        series.timeOfDay,
        series.timezone,
        series.nextFireAt + 60_000   // start search from just past the just-materialized fire
      );
      await seriesDoc.ref.update({
        nextFireAt: newNextFireAt,
        lastFiredAt: series.nextFireAt
      });
      advanced++;
    } catch (e) {
      console.warn('watchpartySeriesTick per-series failed', seriesDoc.id, e && e.message);
      errored++;
    }
  }
  console.log(`watchpartySeriesTick: materialized=${materialized} advanced=${advanced} alreadyExisted=${alreadyExisted} errored=${errored}`);
  return null;
});
```

### 30-min reminder push — extend `watchpartyTick`

Add a new branch inside the existing per-family wp loop at queuenight/functions/index.js:1213 (BEFORE the intents block that starts at line 1269). Pattern mirrors the rsvpReminderTick approach: idempotency flag stamped on the wp doc BEFORE the push fires.

```js
// === Phase 16 — series reminder push (30 min before startAt) ===
// Mirrors rsvpReminderTick pattern: flag on wp doc set BEFORE push to defeat double-fire.
if (wp.seriesId && wp.status === 'scheduled' && wp.startAt) {
  const minutesBefore = (wp.startAt - now) / 60000;
  // SLOP: tick runs every 5 min, so ±5 min around T-30min catches us.
  if (minutesBefore <= 35 && minutesBefore >= 25) {
    const alreadyFired = wp.reminders && wp.reminders.seriesReminder && wp.reminders.seriesReminder['t-30min'];
    if (!alreadyFired) {
      try {
        await doc.ref.update({ 'reminders.seriesReminder.t-30min': true });
        await sendToMembers(familyDoc.id, wp.memberUids || [], {
          title: 'Couch in 30 min',
          body: `"${wp.titleName || 'Family movie night'}" — your weekly couch night is coming up.`,
          tag: `series-reminder-${wp.seriesId}-${wp.seriesInstanceDateKey}`,
          url: `/app?wp=${doc.id}`
        }, { eventType: 'seriesReminder' });
      } catch (e) {
        console.warn('series reminder failed', familyDoc.id, doc.id, e.message);
      }
    }
  }
}
```

**Note:** `watchpartyTick` runs every 5 minutes (queuenight/functions/index.js:1145), so the ±5 min slop window around T-30min reliably catches each instance exactly once.

**Caveat to verify at planning:** the existing `watchpartyTick` per-family loop iterates ONLY nested `families/{code}/watchparties/{wpId}` (line 1211). Phase 30 added a separate top-level wp loop at line 1162 (BEFORE the family loop). The series-materialized wps live at top-level — so the reminder branch must go inside the **top-level loop** (around line 1189), NOT the legacy nested loop. The planner should double-check this; the diff is small.

### Cron cadence decision: 6h or 4h?

CONTEXT.md says "every 6h (every 4h if push reminder timing requires it — pin during planning)."

**Recommendation: 6h.** The materializer just creates wp docs within a 24h horizon — the wp doc exists 18+ hours before its `startAt`, plenty of time for the every-5-min `watchpartyTick` to discover it and fire the T-30min reminder. 4h would only matter if the materializer were also responsible for the reminder push, but per design the reminder is a separate concern (extends `watchpartyTick`).

**Edge case to handle:** a series created 23h before its first fire. The series doc's `nextFireAt` is < 24h out, so the NEXT `watchpartySeriesTick` run will materialize it. Worst case: created 5h59m before tick, tick fires, materialization is on schedule. Created 4h59m before tick: still materializes in the next tick. **Boundary OK.**

## UI scaffolding plan

### 1. Tonight tab "Schedule a series" CTA

- DOM: append `<button class="pill" onclick="openSeriesCreate()">Schedule a series</button>` to `#t-section-actions` (app.html:393) from inside `renderTonight()` (js/app.js:5774).
- Visibility gate: only show when `state.familyCode && state.me && state.couchMemberIds.length >= 1` (mirrors Flow A entry visibility).
- Tap behavior: opens `#series-create-modal-bg` (new full-screen modal mirroring `#wp-start-modal-bg` shape).

### 2. Post-wp "Make recurring?" prompt (Entry 2 — TV-only)

- Bolt into existing `#wp-post-session-modal-bg` (app.html:1307) — insert a new conditional CTA between the "Add a couch photo" tile (app.html:1320-1322) and "Schedule another night" CTA (app.html:1325).
- Conditional render in `openPostSession(wpId)` at js/app.js:13784: gate on `t.kind === 'TV'` (pattern at js/app.js:13807 uses this exact check); HIDE for movies + sports games.
- Pre-fill cadence picker with day-of-week + time inferred from `wp.startAt` in `wp.creatorTimeZone`:
  - `daysOfWeek = [new Date(wp.startAt).getDay()]` (single-day initial selection)
  - `timeOfDay = '20:00'` (or whatever the wp.startAt rounds to in the family tz)
- Tap "Make recurring" → opens series-edit modal pre-populated with above values + `titleId = wp.titleId`, `titleType = 'tv'`. User can refine before save.

### 3. Cadence picker component (used by create + edit + Entry 2 prompt)

- Reusable function: `renderDayOfWeekPicker(targetSelector, currentDows)` returns HTML for 7 day buttons.
- State sync: toggle `.on` class on click + write back to `state.seriesEdit.daysOfWeek`.
- Visual: see §"Multi-day cadence picker UX" above for HTML + CSS scaffolding.

### 4. Account-tab "Your series" section

- DOM: insert `#series-list-card` between `#signin-methods-card` (app.html:674-678) and the YOU cluster opener (app.html:681). Adjust per "co-located with sign-in methods" requirement.
- Renderer: `renderSeriesList()` mirrors `renderSignInMethodsCard()` at js/app.js:15864.
- Per-row markup: title (or "{cadence summary}"), cadence pills, next-fire date, last-fire date, Pause/Cancel buttons, tap-to-edit.
- onSnapshot subscription: add `state.unsubSeries` modeled on `state.unsubWatchparties` pattern. Subscribe to `collection('watchpartySeries').where('familyCode', '==', state.familyCode)`. Re-render on every snapshot.

### 5. Week-view modal

- DOM: new `<div class="modal-bg" id="week-view-modal-bg">` with `#week-view-content` container.
- Trigger: "Calendar view" button at top of Account-tab `#series-list-card`.
- Renderer: builds 7-day grid from `state.series` + materialized wp instances (from `state.watchparties` already subscribed).
- Mobile: single-day stack with prev/next nav; desktop: 7-column grid.
- Tap an event row → reuse existing wp banner navigation: `state.activeWatchpartyId = wpId; showScreen('home'); renderTonight();` (pattern at js/app.js — search target).

### 6. In-place edit modal

- DOM: `#series-edit-modal-bg` mirroring `#wp-start-modal-bg`.
- Shared between create + edit flows (DOM reuse via state flag `state.seriesEdit.mode = 'create' | 'edit'`).
- Save handler: `saveSeriesEdit()` writes via `updateDoc(seriesRef(id), { daysOfWeek, timeOfDay, ..., nextFireAt: computeNextFireAt(...), ...writeAttribution() })`.
- After save: re-render Account-tab series list + flashToast "Series updated."

## Cadence + timezone handling

See §"Integration map §7 — Timezone handling" for the canonical pattern.

**Three timezone hazards to flag for the planner:**

1. **DST transition during a fire window.** Series scheduled "Sun 2:30 AM America/Los_Angeles" on the second Sunday of March: 2:30 AM doesn't exist (clocks jump 2:00 → 3:00). The `computeNextFireAt` helper above will resolve to 3:30 AM via Intl's DST-aware offset calculation. Document this in the wave's smoke contract.

2. **User changes family timezone after creating a series.** Out of scope for v1 (no UX to change family timezone), but if it happens via Firestore admin console, the series fires at the new tz wall-clock. Acceptable behavior — note in §"Open questions."

3. **memberUids includes a user in a different tz than the series.** The fire time is in `series.timezone` (family tz). A remote member sees the push at their local equivalent of that family-tz instant. Acceptable — push fan-out time is the canonical "couch moment."

## Idempotency strategy

See §"Integration map §12 — Idempotency / replay safety for materializer."

**Three layers of replay safety:**

1. **Deterministic wpId** (`series_{seriesId}_{instanceDateKey}`) — re-running the materializer for the same series instance produces the same wpId; `set()` is benign because the input is pure.
2. **`series.nextFireAt` advancement** — the next tick after a successful materialization sees the new `nextFireAt` value, so the same instance isn't re-materialized.
3. **Reminder push flag** (`wp.reminders.seriesReminder.t-30min`) — set BEFORE `sendToMembers()` call. If the CF dies between flag-set and push-fire, the push is lost (not duplicated). Net effect: at-most-once for reminders, exactly-once for materializations.

## Threat model touchpoints

| Threat | STRIDE | Mitigation |
|--------|--------|-----------|
| Member A creates a series that targets Member B without B's consent | Tampering | `memberUids` is set at create time by `createdBy`. Anyone in the family can be added; this is consistent with how existing wps work (`confirmStartWatchparty` adds all family members per js/app.js:11607-11611). Per-user `seriesReminder` notification pref + per-user wp ignore are the user's escape hatches. Same trust model as existing watchparties — no new attack surface. |
| Series-fired push spam (CF runs amok, fires every tick) | Tampering / DoS | Deterministic wpId + status re-check + nextFireAt advancement prevent multi-fire. Per-doc try/catch ensures one bad series doesn't cascade. |
| Cross-family series injection (signed-in attacker creates a series with `familyCode: 'someone-elses-code'`) | Tampering | Rules at proposed `watchpartySeries` create branch require `exists(.../users/$(uid())/groups/$(familyCode))` — same pattern as the Phase 30 top-level wp create rule (firestore.rules:205-206). Attacker can't claim a familyCode they're not in. |
| Series-fired wp visibility leak (a member not in `memberUids` reads the wp doc) | Information Disclosure | Top-level wp read rule (firestore.rules:161) requires `auth.uid in resource.data.memberUids`. Series-materialized wps inherit this — read is gated. |
| Series doc edit by non-creator | Tampering | Update rule restricts to `resource.data.createdBy == uid()`. Other members can't tamper. |
| Reminder push leak (member toggled off but still gets reminder) | Information Disclosure | `sendToMembers(..., { eventType: 'seriesReminder' })` reads `users/{uid}.notificationPrefs.seriesReminder` and gates per-user (queuenight/functions/index.js:316-323). Standard infra; no new bypass. |
| Stale `memberUids` after a member leaves the family | Information Disclosure | Phase 30 `onMemberDelete` CF (queuenight/functions/src/onMemberDelete.js) cleans up stale memberUids on wp docs. Phase 16 should add `watchpartySeries` to that CF's cleanup scope — single-file diff. |

**Applicable ASVS categories:**

| ASVS | Applies | Control |
|------|---------|---------|
| V2 Authentication | yes | Firebase Auth (existing) |
| V3 Session Management | no | (PWA — no custom sessions) |
| V4 Access Control | yes | Firestore rules per §"Integration map §6" |
| V5 Input Validation | yes | Client-side: `daysOfWeek` non-empty + values in 0-6; `timeOfDay` matches HH:MM regex; `timezone` non-empty. Rules echo the regex check |
| V6 Cryptography | no | (no new crypto — VAPID reused) |

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node-based smoke scripts (`scripts/smoke-*.cjs`) — no Jest / Mocha. Pattern at `scripts/smoke-tonight-matches.cjs`, `scripts/smoke-availability.cjs`, etc. |
| Config file | none — each `scripts/smoke-*.cjs` is self-contained, executes via `node scripts/smoke-<name>.cjs` |
| Quick run command | `node scripts/smoke-app-parse.cjs` (verifies js/app.js parses cleanly — fastest signal) |
| Full suite command | `for f in scripts/smoke-*.cjs; do node "$f"; done` (no test runner orchestration; each script returns exit 0 on pass) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAL-16-01 | `watchpartySeries` doc round-trips through Firestore rules with valid + invalid shapes | unit (rules) | `npm test --prefix queuenight/functions` (tests/rules.test.js pattern) | ❌ Wave 0 — extend tests/rules.test.js with `#16-NN` cases |
| CAL-16-03 | `watchpartySeriesTick` materializes exactly one wp per series per 24h horizon under varying cadences | integration | `node scripts/smoke-series-materializer.cjs` | ❌ Wave 0 — NEW smoke script |
| CAL-16-04 | Deterministic wpId prevents double-materialization across two consecutive CF runs | integration | `node scripts/smoke-series-idempotency.cjs` | ❌ Wave 0 — NEW smoke script |
| CAL-16-05 | 30-min reminder push fires once per instance (±5min slop verified) | integration | extend `node scripts/smoke-series-materializer.cjs` to assert reminder flag set once | ❌ Wave 0 |
| CAL-16-07 | Cadence picker produces valid `daysOfWeek` array | unit | `node scripts/smoke-app-parse.cjs` (parse-clean check) + manual UAT | ✅ smoke-app-parse exists; manual UAT needed |
| CAL-16-08 | Tonight-tab CTA appears + opens series-create modal | manual UAT | n/a | ❌ Phase 16 HUMAN-UAT.md |
| CAL-16-09 | Post-wp prompt appears for TV titles ONLY | manual UAT | n/a | ❌ Phase 16 HUMAN-UAT.md |
| CAL-16-10 | Account-tab "Your series" section renders + pause/cancel work | manual UAT | n/a | ❌ Phase 16 HUMAN-UAT.md |
| CAL-16-11 | Week-view 7-day grid renders + cross-week nav works | manual UAT | n/a | ❌ Phase 16 HUMAN-UAT.md |
| CAL-16-12 | In-place edit recomputes `nextFireAt` correctly post-cadence-change | unit | `node scripts/smoke-series-cadence-compute.cjs` (pure computeNextFireAt() function unit test) | ❌ Wave 0 — NEW smoke script |
| CAL-16-14 | sw.js CACHE bumped + deploy.sh ran cleanly | gate | `bash scripts/deploy.sh <tag>` exit 0 | ✅ scripts/deploy.sh exists |
| CAL-16-15 | Composite index deployed | gate | `firebase deploy --only firestore:indexes` from couch repo root | ✅ infra exists |

### Sampling Rate

- **Per task commit:** `node scripts/smoke-app-parse.cjs` (~ 1s — verifies js/app.js parses with the new edits)
- **Per wave merge:** `for f in scripts/smoke-*.cjs; do node "$f"; done` + `npm test --prefix queuenight/functions` (rules tests)
- **Phase gate:** Full smoke suite + manual HUMAN-UAT.md walkthrough on iOS PWA + at least one materializer fire observed in production logs

### Wave 0 Gaps

- [ ] `scripts/smoke-series-materializer.cjs` — boots an emulated Firestore, seeds 5 series with varying cadences (single-day, multi-day, Sun-only across DST boundary, paused, ended), runs `watchpartySeriesTick` body twice, asserts (a) one wp per active series materialized, (b) `nextFireAt` advanced correctly, (c) re-run yields zero new wps.
- [ ] `scripts/smoke-series-idempotency.cjs` — focused test for the deterministic wpId pattern. Runs materializer twice on the same series; asserts wpId is identical, set() is benign.
- [ ] `scripts/smoke-series-cadence-compute.cjs` — pure-function unit test for `computeNextFireAt(daysOfWeek, timeOfDay, timezone, now)`. Critical cases: single-day, multi-day, current-day-already-past, DST spring-forward (March), DST fall-back (November), Sun-only with `now = Sun 7:59 PM` → fires same day at 8:00.
- [ ] `tests/rules.test.js` additions: `#16-01` through `#16-NN` covering create/read/update/delete rules for `watchpartySeries`.
- [ ] `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` — scaffolded by the planner. Cover: create series via Entry 1, create via Entry 2 prompt (TV-only verified), edit cadence, pause, resume, cancel, week-view render on mobile + desktop, 30-min reminder push received.

**Sampling strategy for the materializer (per CONTEXT.md prompt for multi-instance test families):**
- 3 test families seeded:
  - Fam-1 (UTC): 2 series — single-day Mon, 3-day MWF
  - Fam-2 (America/Los_Angeles): 3 series — Sun-only (DST stress), 7-day everyday, paused
  - Fam-3 (Asia/Tokyo): 1 series — Wed at 21:00 + ended series in same family (verifies status filter)
- Run materializer with `now = 2026-03-08T10:00:00Z` (the day before US DST spring-forward) to assert Sun-only series fires correctly on the DST-affected Sunday.
- Run materializer with `now = 2026-03-10T10:00:00Z` (day after spring-forward) to assert subsequent fires correctly advance past DST.

## Open Questions

1. **Cron cadence — 6h or 4h?** RESEARCH recommendation: 6h (see §"Cloud Function design"). Confirm at planning.
2. **Week-view location.** 3 candidates: Tonight-tab sub-view, Account-tab "Calendar view" button, new dedicated tab. RESEARCH recommendation: Account-tab "Calendar view" button → modal. Planner to confirm.
3. **Stale `memberUids` cleanup.** Does the existing `onMemberDelete` CF (queuenight/functions/src/onMemberDelete.js) need extension to also clean `watchpartySeries.memberUids`? Recommend: yes, mirror the wp pattern. Single-file diff.
4. **"Untitled" series push body copy.** "Family movie night" is a placeholder. Worth a quick brand-voice pass at planning time vs CONTEXT D-12 push copy table convention.
5. **Account-tab section placement.** CONTEXT says "co-located with Sign-in methods + notification prefs." Recommend: top of YOUR COUCH cluster (above Streaming services). Planner to confirm — could also live in YOU cluster.
6. **Composite index deploy ordering.** Composite indexes take 5-30 min to build in production. Recommend: deploy indexes FIRST (`firebase deploy --only firestore:indexes`), wait for build, then deploy CFs + hosting. Add to RUNBOOK.md as part of the Phase 16 ship checklist.
7. **DST behavior for already-materialized instances.** If a series fired at "Mon 8pm PST" before DST and the next fire computes to "Mon 8pm PDT" (1h earlier UTC), the user perceives consistent wall-clock 8pm. Confirm acceptable + document in HUMAN-UAT.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase project `queuenight-84044` (Firestore + Cloud Functions + Hosting) | All work | ✓ | Blaze billing | — |
| Node 22 (functions runtime) | `watchpartySeriesTick.js` deploy | ✓ | per queuenight/functions/package.json:6 | — |
| `firebase-admin` ^12 | CF Firestore writes | ✓ | per queuenight/functions/package.json:15 | — |
| `firebase-functions` ^4.6 (`onSchedule` from `v2/scheduler`) | New CF | ✓ | per queuenight/functions/package.json:17; verified at queuenight/functions/index.js:20 + pickReminderTick.js:36 | — |
| Intl API (timezone-aware DateTimeFormat) | `computeNextFireAt` + isInQuietHours | ✓ | Node 22 + all browsers Safari 10+ | — |
| Cloud Scheduler (auto-provisioned by `onSchedule`) | `watchpartySeriesTick` cron | ✓ | Firebase auto-enables; cost $0.10/job/month after first 3 free | — |
| `web-push` ^3.6.7 | Reuse for reminder pushes | ✓ | per queuenight/functions/package.json:18 | — |
| TMDB metadata (for series title resolution at create) | Entry 1 + Entry 2 prompt | ✓ | TMDB key in js/constants.js (public-by-design) | — |

**Missing dependencies with no fallback:** none.

**Missing dependencies with fallback:** none.

## Architectural Decision Summary (for planner)

| Decision | Recommendation | Rationale |
|----------|----------------|-----------|
| Top-level vs nested collection | **Top-level `watchpartySeries`** | Aligns with Phase 30; simpler CF query; future-proof for cross-family series |
| Materializer file location | **New file `queuenight/functions/src/watchpartySeriesTick.js`** | Mirrors pickReminderTick structure; clean ownership; easier to test |
| Reminder push site | **Extend `watchpartyTick`** (existing CF), not new CF | Cheap — already iterates wp docs every 5 min; one new branch |
| Skip intent doc for series instances | **Yes, write straight to wp** | Intent is for pre-commit RSVP; series is already committed |
| Idempotency mechanism | **Deterministic wpId** (`series_{seriesId}_{instanceDateKey}`) | Stronger than sentinel-doc pattern; race-free |
| Cron cadence | **Every 6 hours** | Sufficient given 24h materialization horizon + every-5-min reminder tick |
| Push event-type | **`seriesReminder`** — added to 3 places in lockstep | Phase 14 DR-3 / Phase 28 PICK-28-17 precedent |
| Day-of-week picker UX | **Hand-rolled, S-M-T-W-T-F-S buttons** | No existing picker; matches `.wp-lead-btn` styling |
| Week-view location | **Modal launched from Account-tab "Calendar view" button** | Doesn't bloat Tonight; consistent with "series management" home |
| Mobile week-view layout | **1-column day stack <600px, 7-column grid ≥600px** | iPhone SE 375px is brutal for 7 columns |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The Phase 30 `onWatchpartyCreateTopLevel` trigger fires on admin-SDK writes (so the materializer doesn't need to manually fire the "watchparty scheduled" push) | Cloud Function design §"`watchpartySeriesTick` body sketch" | LOW — Firestore doc-create triggers fire regardless of write source per Firebase docs. Verify at planning time by checking trigger source at queuenight/functions/index.js:542. If wrong, add an explicit `sendToMembers(..., { eventType: 'watchpartyScheduled' })` call after the wp `.set()`. |
| A2 | `t.kind === 'TV'` is the canonical "is this a TV show" check throughout the codebase | UI scaffolding §2 (Entry 2 gate) | LOW — verified at js/app.js:13807, 8231, 7172 (3+ sites). Pattern is stable. |
| A3 | The post-wp `openPostSession()` modal at js/app.js:13784 receives the wp object via `state.titles.find(...)` lookup (with `t.kind` accessible) | UI scaffolding §2 | LOW — pattern at js/app.js:13807 (`if (t && t.kind === 'TV')`) confirms the t lookup is already there. |
| A4 | The current `sw.js` CACHE value is `couch-v42-phase-15.3-transparency` (verified) NOT `couch-v47-pickem` (CLAUDE.md claim) | Project Constraints | LOW — sw.js is source of truth. CLAUDE.md may be stale; treat sw.js as canonical. Planner: confirm at execute time. |
| A5 | Cloud Scheduler / `onSchedule` cron `'every 6 hours'` string syntax is supported (vs Unix cron `'0 */6 * * *'`) | Cloud Function design | LOW — verified `'every 5 minutes'` and `'every 15 minutes'` and `'every 6 hours'` all work per Firebase docs + multiple existing CFs use the friendly syntax. |
| A6 | `series.memberUids` populated at create time with all family member uids (mirroring `confirmStartWatchparty` js/app.js:11607-11611) is the right default | Data model proposal | MEDIUM — Some families may want a SUBSET of members on a recurring series ("just me and my wife watch American Idol"). RECOMMEND the create modal include a "members" multi-select chip row that defaults to all family members but can be edited. This is also editable post-create per the locked scope. |
| A7 | The materializer running every 6h with a 24h horizon catches all instances correctly with no edge-case "missed fires" | Cloud Function design | LOW — 24h / 6h = 4 ticks worth of cushion. A series that fires at exactly the wrong moment (between two ticks) still has 3 more chances to materialize before its `startAt`. Verified by walking through the boundary math. |

**All `[ASSUMED]` items above are low-risk and verifiable at planning time. None requires user confirmation before proceeding.**

## Recommended Wave Decomposition

Refines CONTEXT.md's 8-plan suggestion. **The data primitive (16-01) and materializer CF (16-03) must land before any UI work** because the UI subscribes to `watchpartySeries` snapshots. Everything else can parallelize.

### Wave 1 — Foundation (sequential)

- **16-01** — `watchpartySeries` Firestore primitive + rules + composite indexes
- **16-02** — `watchpartySeriesTick` CF (new file) + extend `watchpartyTick` with 30-min reminder branch
- **16-03** — `seriesReminder` event-type wired in 3 places (DR-3 lockstep)

### Wave 2 — UI parallel (can ship in any order after Wave 1)

- **16-04** — Cadence picker reusable component
- **16-05** — Entry 1: Tonight-tab "Schedule a series" CTA + create modal
- **16-06** — Account-tab "Your series" section + pause/cancel actions
- **16-07** — In-place edit modal
- **16-08** — Entry 2: Post-wp "Make recurring?" prompt (TV-only)

### Wave 3 — Polish + close-out

- **16-09** — Week-view modal (Account-tab "Calendar view" button)
- **16-10** — Wave close-out: smoke contract, HUMAN-UAT.md, sw.js bump, cross-repo deploy ritual, RUNBOOK.md updates

**Estimated effort:** 2-3 sessions per CONTEXT. Wave 1 is the riskiest (data + CF) and likely the longest single session. Wave 2 can split across two sessions with parallel work. Wave 3 is a half-session polish + ship.

## Sources

### Primary (HIGH confidence)
- `.planning/phases/16-calendar-layer/16-CONTEXT.md` — scope-locked authoritative spec
- `.planning/seeds/decision-ritual-locked-scope.md` — originating seed (Phase 16 section, 3 lines)
- `.planning/phases/14-decision-ritual-core/14-RESEARCH.md` — DR-1 (intent collection extension pattern) + DR-3 (3-place lockstep for push event-types) precedents
- `CLAUDE.md` — project conventions, token-cost rules, deploy ritual
- `firestore.rules` — auth helpers, top-level wps block (firestore.rules:160-264), intents block (firestore.rules:825-899)
- `firestore.indexes.json` — composite index patterns
- `app.html` — tonight tab DOM (340-420), wp-start modal (1228-1287), wp-post-session modal (1307-1328), Account tab (660-742)
- `js/app.js` — surgical reads: 443-543 (NOTIFICATION_DEFAULTS + LABELS), 2160-2240 (intent creation), 5774-5900 (renderTonight), 11540-11630 (confirmStartWatchparty wp doc shape), 13780-13920 (post-session modal flow), 15860-15960 (renderSignInMethodsCard section pattern), 17712-17800 (Flow A entry CTA pattern)
- `sw.js` — CACHE bump convention
- `queuenight/functions/index.js` — `NOTIFICATION_DEFAULTS` (79-128), `sendToMembers` (298-355), `watchpartyTick` (1144-1418), Phase 14 intent CF extensions (1269-1418), all exports (~1900-1944)
- `queuenight/functions/src/pickReminderTick.js` — direct template for `watchpartySeriesTick`
- `queuenight/functions/src/rsvpReminderTick.js` — reminder push pattern with in-doc flag idempotency
- `queuenight/functions/src/gameResultsTick.js` — `onSchedule` boilerplate, `processedFirstAt` sentinel pattern
- `queuenight/functions/package.json` — dep versions, Node runtime
- `scripts/deploy.sh` (head 20 lines) — deploy ritual / CACHE bump auto-stamp

### Secondary (MEDIUM confidence)
- None — all integration facts are file:line-cited from the actual repos. No web searches needed; this is brownfield integration work.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Data model: HIGH — schema is fully locked; field types match existing patterns
- CF design: HIGH — direct mirror of pickReminderTick + rsvpReminderTick; both shipped and verified in production
- Push infrastructure integration: HIGH — Phase 14 DR-3 + Phase 28 PICK-28-17 + Phase 18 titleAvailable are 3 verified precedents for the 3-place lockstep
- UI scaffolding: HIGH for entry points + Account-tab section (well-established patterns); MEDIUM for week-view (greenfield, needs sketch iteration during execution)
- Timezone handling: HIGH — Intl-based DST-aware computation is verified pattern at queuenight/functions/index.js:50-75 (`isInQuietHours`) and 4 client sites
- Idempotency: HIGH — deterministic-id pattern is stronger than sentinel-doc; rsvpReminderTick pattern reusable for reminders
- Threat model: HIGH — Phase 30 cross-cutting review (CDX-1 through CDX-6) closed all the relevant attack vectors for top-level wp docs; series doc inherits the same shape

**Research date:** 2026-05-27
**Valid until:** 2026-06-27 (30 days — codebase moves fast; re-verify if Phase 17 ships first and changes the wp doc shape or push infra)
