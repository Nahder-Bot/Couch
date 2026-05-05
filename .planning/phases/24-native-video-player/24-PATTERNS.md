# Phase 24: Native Video Player — Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 9 new/modified
**Analogs found:** 9 / 9

> Pattern map for the Couch-native video player surface. Every new file or edit point has a concrete in-repo analog with file path + line range + extracted excerpt. Planner consumes this directly into per-plan `<read_first>` and `<acceptance_criteria>` blocks.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `js/video-player.js` *(NEW module — optional split; see "Module-creation precedent" below)* | service / utility | transform + event-driven | `js/sports-feed.js` (Phase 22) | exact (module creation precedent) |
| `js/app.js` — URL parser + DRM helper insertion (~line 13006 area) | utility (pure helpers) | transform | `TMDB_PROVIDER_IDS` map @ `js/app.js:13006` + `mapTmdbItem` @ `:13016` | exact (sibling helper co-location) |
| `js/app.js` — `renderWatchpartyLive` player-surface branch (~line 11115) | component / view-render | request-response | existing trailer iframe @ `js/app.js:7838` + `:13667` + `renderWatchpartyLive` body @ `:11115-11147` | exact (same render function, same iframe shape) |
| `js/app.js` — `openWatchpartyLive` / `closeWatchpartyLive` player attach + teardown (`:10983` / `:11003`) | controller / lifecycle | event-driven | Phase 23 sports-polling lifecycle @ `js/app.js:10987-11008` (`startSportsScorePolling` / `stopSportsScorePolling`) | exact (open-attach / close-teardown pair) |
| `js/app.js` — `confirmStartWatchparty` wp-record extension (`:10845-10887`) | controller | CRUD (create) | existing wp record build @ `js/app.js:10861-10887` (`{ id, titleId, titleName, ..., reactions: [] } → setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() })`) | exact (same write site) |
| `js/app.js` — `scheduleSportsWatchparty` wp-record extension (`:10199-10289`) | controller | CRUD (create) | existing wp record build @ `js/app.js:10246-10271` | exact (same write site, sports parallel) |
| `js/app.js` — `currentTime` broadcast throttle + Firestore write (host-only) | service | streaming + pub-sub | `updateDoc(watchpartyRef(id), { ...writeAttribution(), ... })` pattern at `js/app.js:1067/1109/1370` (titles) + `setDoc(watchpartyRef(id), …)` @ `:10271/10887` (wp record) | role-match (same write surface, new throttle wrapper) |
| `app.html` — schedule-modal Video URL field (line 967-968 area) | component (DOM scaffold) | request-response (form) | existing `Date & time` + `Note (optional)` fields @ `app.html:967-968` | exact (insert one more `.field` block in the same modal) |
| `css/app.css` — `.wp-video-frame` + `.field-help` + `.field-error` + `.field-invalid` rules | config (style sheet) | n/a | `.trailer-frame` @ `css/app.css:1608` + `.schedule-modal .field` @ `:675-689` + `.wp-live-modal` family @ `:737-773` | exact (sibling class to `.trailer-frame`, drop-in to `.schedule-modal` family) |
| `scripts/smoke-native-video-player.cjs` *(NEW)* | test (smoke contract) | batch / pure | `scripts/smoke-position-transform.cjs` (Phase 15.5) + `scripts/smoke-sports-feed.cjs` (Phase 22) + `scripts/smoke-conflict-aware-empty.cjs` (Phase 21) | exact (canonical CJS smoke pattern) |
| `scripts/deploy.sh` §2.5 — 8th smoke-gate `if`-block | config (CI gate) | batch | existing 7 smoke `if`-blocks @ `scripts/deploy.sh:89-117` | exact (clone the last block; rename file + log line) |
| `package.json` — `scripts.smoke` chain extension + `scripts.smoke:native-video-player` alias | config | batch | existing `smoke:sports-feed` alias + chain @ `package.json:8,15` | exact (one-line additions) |
| `sw.js` — CACHE constant bump | config | n/a | `const CACHE = 'couch-v36.7-live-scoreboard';` @ `sw.js:8` | exact (single string edit, auto-bumped via `deploy.sh <tag>`) |

---

## Pattern Assignments

### `js/video-player.js` — NEW module *(optional split — see Module-creation precedent below)*

**Analog:** `js/sports-feed.js` (Phase 22 module-creation precedent)

> NOTE on splitting: RESEARCH §"Recommended Project Structure" (line 222-241) recommends keeping all new player code inside `js/app.js` near the existing co-location anchors (`renderWatchpartyLive` @ :11115, `TMDB_PROVIDER_IDS` @ :13006, `closeWatchpartyLive` @ :11003). This keeps the diff minimal and matches the established "everything that touches a wp record lives in app.js" pattern. **HOWEVER** the planner may elect to split `parseVideoUrl` + `titleHasNonDrmPath` + `makeIntervalBroadcaster` into a new ES module `js/video-player.js` to mirror Phase 22's `sports-feed.js` precedent and unlock a richer smoke-contract surface (smoke can `require()` the file via a Node-friendly export shim). The pattern below applies to either choice — the smoke contract assertions are identical, the only difference is whether the helpers live in `js/app.js` or `js/video-player.js`.

**Module shape (excerpt from `js/sports-feed.js:1-50`):**

```javascript
// === Phase 22 — Sports data abstraction ===
// Replaces ESPN hidden API (ToS-gray per Phase 11 RESEARCH §4 — App Store §2.3 + 5.1.5
// reject apps using undocumented APIs) with legitimate sources:
// ...
// Exports:
//   LEAGUES               — catalog of supported leagues (15+ globally)
//   fetchSchedule(key,d)  — next N days of games for a league
//   ...

const TSD_API_KEY = '1';
const TSD_BASE = 'https://www.thesportsdb.com/api/v1/json/' + TSD_API_KEY + '/';

export const LEAGUES = { /* ... */ };

export function normalizeTsdEvent(ev, leagueKey) { /* ... */ }
export async function fetchSchedule(leagueKey, daysAhead) { /* ... */ }
// ...
```

**Static-import call site precedent** (excerpt from `js/app.js:7`):

```javascript
import { LEAGUES as SPORTS_FEED_LEAGUES, fetchSchedule as feedFetchSchedule, fetchScore as feedFetchScore, leagueKeys as feedLeagueKeys } from './sports-feed.js';
```

**Convention to copy:**
- File header comment block: phase number + scope sentence + Exports list + cache/throttle strategy note
- ES module `export const NAME = ...` for tables/maps, `export function name(...) { ... }` for helpers
- No top-level side effects (no DOM access, no network call); pure on import — required so the smoke contract doesn't need a browser
- Static `import { ... } from './video-player.js';` near top of `js/app.js` (line 7-14 area, alongside auth.js / sports-feed.js)
- No bundler — file MUST be valid ES module loaded by browser directly via `<script type="module">` graph

---

### `js/app.js` — URL parser + DRM detection helpers (insertion @ ~line 13006)

**Analog:** existing `TMDB_PROVIDER_IDS` map + `mapTmdbItem` helper at `js/app.js:13005-13024`

**Co-location pattern** (from `js/app.js:13005-13016`):

```javascript
// TMDB provider IDs for the services we commonly show
const TMDB_PROVIDER_IDS = {
  'Netflix': 8, 'Amazon Prime Video': 9, 'Amazon Prime Video with Ads': 9,
  'Disney Plus': 337, 'Hulu': 15, 'Max': 1899, 'HBO Max': 384,
  'Apple TV Plus': 350, 'Apple TV+': 350, 'Paramount Plus': 531, 'Paramount+': 531,
  'Peacock': 386, 'Peacock Premium': 386
};
const addTabCache = { trending: null, streaming: null, gems: null, mood: {} };
const ADD_CACHE_TTL = 60 * 60 * 1000;
let currentAddMood = null;

function mapTmdbItem(x, typeOverride) {
  const type = typeOverride || x.media_type || 'movie';
  return {
    id: 'tmdb_' + x.id,
    /* ... */
  };
}
```

**Provider-schema reuse anchor** (from `js/app.js:16` — verified in CONTEXT.md Code-Insights):

```javascript
const out = { trailerKey: null, rating: null, providers: [], rentProviders: [], buyProviders: [], providersChecked: true, providersSchemaVersion: 3, runtime: null };
```

**Pattern to copy (per RESEARCH §Code Examples 3 + 4):**
- Place `parseVideoUrl(input)` and `titleHasNonDrmPath(t)` directly above or below `TMDB_PROVIDER_IDS` (sibling helpers, single conceptual neighborhood: "provider-aware video utilities")
- Both helpers MUST be pure (no `state.*` reads, no DOM, no network, no `Date.now()`) → smoke-testable
- `parseVideoUrl` returns `{ source: 'youtube', id, url } | { source: 'mp4', url } | null`
- `titleHasNonDrmPath` reads from existing `t.providers` / `t.rentProviders` / `t.buyProviders` schema; defensive `null`/missing → `true` (don't hide on incomplete data)
- Add a new `const DRM_FLAT_RATE_PROVIDER_BRANDS = new Set([...])` table sibling to `TMDB_PROVIDER_IDS`

---

### `js/app.js` — `renderWatchpartyLive` player-surface render branch (@ :11115)

**Analog (1):** existing trailer iframe construction at `js/app.js:7838`:

```javascript
const trailerHtml = t.trailerKey ? `<div class="detail-section"><iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe></div>` : '';
```

**Analog (2):** sister trailer iframe at `js/app.js:13667`:

```javascript
const trailerHtml = (!loading && t.trailerKey)
  ? `<div class="detail-section"><h4>Trailer</h4><iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe></div>`
  : '';
```

**Analog (3):** `renderWatchpartyLive` header structure at `js/app.js:11115-11138`:

```javascript
function renderWatchpartyLive() {
  const el = document.getElementById('wp-live-content');
  if (!el) return;
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) { el.innerHTML = '<div style="padding:24px;">Watchparty not found.</div>'; return; }
  const isSport = !!wp.sportEvent;
  // Header title block — matchup format for sports, regular title otherwise
  const liveTitleHtml = isSport
    ? `<div class="wp-live-titlename" style="font-family:'Instrument Serif','Fraunces',serif;font-style:italic;">${escapeHtml(wp.sportEvent.awayTeam || 'Away')} <span style="...">at</span> ${escapeHtml(wp.sportEvent.homeTeam || 'Home')}</div>`
    : `<div class="wp-live-titlename">${escapeHtml(wp.titleName)}</div>`;
  const livePosterHtml = isSport
    ? `<div class="wp-live-poster" style="...">${wp.sportEvent.leagueEmoji || '🎮'}</div>`
    : `<div class="wp-live-poster" style="background-image:url('${wp.titlePoster||''}')"></div>`;
  // ... cancelled-state branch ...
  el.innerHTML = `<div class="wp-live-header">
    ${livePosterHtml}
    <div class="wp-live-titleinfo">
      ${liveTitleHtml}
      ...
```

**Pattern to copy (per UI-SPEC §Layout/Component Contracts §1):**
- Compute a single `playerHtml` string above the `el.innerHTML = …` assignment, gated on `wp.videoUrl && titleHasNonDrmPath(t)` (where `t = state.titles.find(x => x.id === wp.titleId)`)
- YouTube branch: `<iframe id="wp-yt-player" class="wp-video-frame--youtube" src="https://www.youtube.com/embed/${encodeURIComponent(videoId)}?enablejsapi=1&playsinline=1" frameborder="0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>` wrapped in `<div class="wp-video-frame">…</div>`
- MP4 branch: `<video id="wp-mp4-player" class="wp-video-frame--mp4" controls playsinline preload="metadata" src="${escapeHtml(wp.videoUrl)}"></video>` wrapped in `<div class="wp-video-frame">…</div>`
- Insert `${playerHtml}` BEFORE `<div class="wp-live-header">…</div>` in the existing `el.innerHTML` template literal (UI-SPEC: player is the FIRST child of `.wp-live-modal` so border-radius:24px-24px-0-0 falls on the player; existing header drops `.wp-live-poster` via parent class `.wp-live-header--has-player` when player is present)
- Reuse existing `escapeHtml` (already imported on line 5) and the same `encodeURIComponent` shape as the trailer-frame analog
- DO NOT render anything (zero DOM contribution) when `!wp.videoUrl || !titleHasNonDrmPath(t)` → mirrors UI-SPEC §3 "DRM-hide branch (the silent dead-end)"

---

### `js/app.js` — `openWatchpartyLive` / `closeWatchpartyLive` player attach + teardown

**Analog:** Phase 23 sports-polling lifecycle pair at `js/app.js:10983-11008`:

```javascript
window.openWatchpartyLive = function(wpId) {
  state.activeWatchpartyId = wpId;
  renderWatchpartyLive();
  document.getElementById('wp-live-modal-bg').classList.add('on');
  // Phase 11 / REFR-10 — Game Mode: start score polling + team-flair prompt.
  // Phase 23 — gate widened: ALSO fire for legacy wp.sportEvent watchparties
  // (created via scheduleSportsWatchparty before mode='game' was the canonical
  // marker). Closes the "scoreboard renders but never updates" gap on legacy
  // sports wps. team-flair picker stays gated on mode='game' since the legacy
  // flow predates that surface.
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (wp && (wp.mode === 'game' || wp.sportEvent)) {
    startSportsScorePolling(wp);
    if (wp.mode === 'game') {
      const mine = myParticipation(wp);
      maybeShowTeamFlairPicker(wp, mine);
    }
  }
};

window.closeWatchpartyLive = function() {
  document.getElementById('wp-live-modal-bg').classList.remove('on');
  // Phase 11 / REFR-10 — stop any active score polling loop
  stopSportsScorePolling();
  state.activeWatchpartyId = null;
};
```

**Pattern to copy (per RESEARCH Pitfall 6 + Touchpoints):**
- After `renderWatchpartyLive()` paints (DOM exists), inside `openWatchpartyLive`, gate on `if (wp && wp.videoUrl && titleHasNonDrmPath(t))` and call new `attachVideoPlayer(wp)` (which dispatches to `attachYouTubePlayer(wp)` or `attachMp4Player(wp)` per `wp.videoSource`)
- Inside `closeWatchpartyLive`, call new `teardownVideoPlayer()` BEFORE `stopSportsScorePolling()` — this clears the throttled broadcast timer, nulls any cached `YT.Player` ref, removes the iframe/`<video>` from DOM
- Mirror the Phase 23 widened-gate comment style: short paragraph above the new call referencing Phase 24 + the gate condition + Phase 26 dependency
- Lifecycle pair: `attach…` mirror of `start…`, `teardown…` mirror of `stop…`

---

### `js/app.js` — `confirmStartWatchparty` wp-record extension (movie creation, @ :10845)

**Analog:** existing wp record build at `js/app.js:10861-10887`:

```javascript
const wp = {
  id,
  titleId: wpStartTitleId,
  titleName: t.name,
  titlePoster: t.poster || '',
  hostId: state.me.id,
  hostName: state.me.name,
  hostUid: (state.auth && state.auth.uid) || null,
  creatorTimeZone: creatorTimeZone || null,
  startAt,
  createdAt: Date.now(),
  lastActivityAt: Date.now(),
  status: startAt <= Date.now() ? 'active' : 'scheduled',
  participants: { [state.me.id]: { /* ... */ } },
  reactions: []
};
try {
  await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
  logActivity('wp_started', { titleName: t.name });
  document.getElementById('wp-start-modal-bg').classList.remove('on');
  state.activeWatchpartyId = id;
  // ...
```

**`writeAttribution` import anchor** (from `js/app.js:5`):

```javascript
import { escapeHtml, haptic, flashToast, ..., writeAttribution, ... } from './utils.js';
```

**Pattern to copy:**
- Add new fields to the `wp = { ... }` object literal (alongside `participants` / `reactions`):
  ```javascript
  videoUrl: parsedUrl ? parsedUrl.url : null,
  videoSource: parsedUrl ? parsedUrl.source : null,  // 'youtube' | 'mp4' | null
  ```
- Read `parsedUrl` from `parseVideoUrl(document.getElementById('schedule-video-url').value)` BEFORE the `wp` object literal is built (validation timing per UI-SPEC §Schedule-modal "Validating (on submit)")
- On `parsedUrl === null && rawValue !== ''` → block submit, render `.field-invalid` + `.field-error` text on the input (per UI-SPEC §"Submit-blocked"); `flashToast` is NOT used here (inline-error preferred to maintain modal context)
- Empty value → silent skip (`videoUrl: null`, `videoSource: null`); modal proceeds normally
- The existing `setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() })` write authorizes the new fields under existing host-write rules (Assumption A3 in RESEARCH); no rule changes needed

---

### `js/app.js` — `scheduleSportsWatchparty` wp-record extension (sports creation, @ :10199)

**Analog:** parallel wp record build at `js/app.js:10246-10271`:

```javascript
const wp = {
  id,
  // ... sportEvent fields ...
  hostId: state.me.id,
  hostName: state.me.name,
  startAt: game.startTime,
  // ...
  participants: {
    [state.me.id]: {
      name: state.me.name,
      joinedAt: Date.now(),
      rsvpStatus: 'in',
      reactionsMode: 'elapsed',
      reactionDelay: 0,
      pausedOffset: 0
    }
  },
  reactions: []
};
try {
  await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
  logActivity('wp_started', { titleName: matchupLabel });
  closeSportsPicker();
  flashToast('Game scheduled', { kind: 'success' });
  // ...
```

**Pattern to copy:**
- Identical to `confirmStartWatchparty` — same field additions (`videoUrl`, `videoSource`), same parser call, same submit-block error pattern
- Read URL field value from the same `#schedule-video-url` DOM input (the field appears in BOTH schedule modals — UI-SPEC §3 "Schedule-modal Video URL field" applies to both creation flows)
- Sports caveat per RESEARCH Open Question 1: live-stream YouTube URLs have meaningless `currentTime` — the player still renders but the broadcast loop should skip writes when `YT.Player.getDuration()` returns 0/Infinity. Implement as a runtime gate inside the broadcast attach, NOT as a creation-time validation rule (creation MUST allow live-stream paste).

---

### `js/app.js` — `currentTime` broadcast (host-only throttle + Firestore write)

**Analog (write surface):** existing `setDoc(watchpartyRef(id), { ...writeAttribution(), … })` pattern at `js/app.js:10271` and `:10887`:

```javascript
await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
```

**Analog (`updateDoc` partial-write):** title-update pattern at `js/app.js:1067` / `:1109` / `:1370`:

```javascript
await updateDoc(doc(titlesRef(), existing.id), { ...writeAttribution(), ...update });
```

**Pattern to copy (per RESEARCH §Architecture Pattern 3 + Code Example 5):**
- New helper `makeIntervalBroadcaster(intervalMs, fn)` — pure inline closure, no `setInterval` (event-driven, leading-edge + trailing-edge throttle)
- New helper `broadcastCurrentTime(wpId, currentTimeMs)` calls `updateDoc(watchpartyRef(wpId), { currentTimeMs, currentTimeUpdatedAt: Date.now(), ...writeAttribution() })`
- `attachYouTubePlayer(wp)` and `attachMp4Player(wp)` wire the broadcaster ONLY when `state.me && state.me.id === wp.hostId` (host-only — RESEARCH Pattern 3)
- Cadence constant: `const VIDEO_BROADCAST_INTERVAL_MS = 5000;` colocated near `renderWatchpartyLive` (or in `js/constants.js` if planner prefers — both are valid per RESEARCH §Recommended Project Structure)
- Existing host-write Firestore rules cover the new fields without rule changes (Assumption A3 — verified by the existing pattern that already writes arbitrary fields onto wp records)

---

### `app.html` — schedule-modal Video URL field (insert @ line 967-968)

**Analog:** existing `Date & time` + `Note (optional)` fields at `app.html:967-968`:

```html
<div class="field"><label>Date & time</label><input type="datetime-local" id="schedule-datetime"></div>
<div class="field"><label>Note (optional)</label><textarea id="schedule-note" placeholder="Anything to remember?"></textarea></div>
```

**Pattern to copy (per UI-SPEC §Layout/Component Contracts §2):**
- Insert a new `<div class="field">…</div>` between the existing two `.field` rows (BETWEEN `Date & time` and `Note (optional)` per UI-SPEC §Spacing Scale)
- Field shape (verbatim from UI-SPEC §2):
  ```html
  <div class="field">
    <label for="schedule-video-url">Video URL (optional)</label>
    <input type="url" inputmode="url" id="schedule-video-url"
      placeholder="YouTube link or .mp4 URL"
      autocomplete="off" spellcheck="false" />
    <div class="field-help" id="schedule-video-url-help">
      Paste a YouTube link or a direct .mp4 URL. We'll play it together.
    </div>
    <div class="field-error" id="schedule-video-url-error" role="alert" hidden>
      That link doesn't look like YouTube or an .mp4 file. Skip it or try another.
    </div>
  </div>
  ```
- Single insertion serves both `confirmStartWatchparty` AND `scheduleSportsWatchparty` (both flows reach the same `#schedule-modal-bg` scaffold; sports flow may use a separate modal — planner verifies)
- Match-Quality note: the existing two `.field` rows already use the exact `.field` + `<label>` + `<input>` pattern Phase 24 needs; this is a literal copy-paste with new IDs + 2 new helper divs

---

### `css/app.css` — `.wp-video-frame` + `.field-help` + `.field-error` + `.field-invalid` rules

**Analog (1):** existing `.trailer-frame` at `css/app.css:1608`:

```css
.trailer-frame{width:100%;aspect-ratio:16/9;border-radius:var(--r-md);border:none;background:#000;margin-bottom:var(--s2)}
```

**Analog (2):** existing `.schedule-modal .field` family at `css/app.css:675-689`:

```css
.schedule-modal .field{margin-bottom:var(--s4)}
.schedule-modal label{font-size:var(--t-eyebrow);color:var(--ink-warm);
  text-transform:uppercase;letter-spacing:0.14em;font-weight:600;
  display:block;margin-bottom:var(--s2)}
.schedule-modal input,.schedule-modal textarea{width:100%;
  background:var(--bg);border:1px solid var(--border-mid);color:var(--ink);
  padding:var(--s3) var(--s4);border-radius:var(--r-md);
  font-family:inherit;font-size:var(--t-body);
  transition:border-color var(--t-quick)}
.schedule-modal input:focus,.schedule-modal textarea:focus{
  border-color:var(--accent);outline:none}
```

**Analog (3):** existing `.wp-live-modal` family at `css/app.css:737-773` (live-modal context the player slots into):

```css
.wp-live-modal{max-width:520px;padding:0;overflow:hidden;max-height:90vh;display:flex;flex-direction:column}
.wp-live-header{padding:18px;border-bottom:1px solid var(--border-strong);display:flex;align-items:center;gap:14px;flex-shrink:0;background:linear-gradient(180deg,rgba(232,160,74,0.06) 0%,transparent 100%)}
```

**Pattern to copy (per UI-SPEC §Layout §1 + §2):**
- `.wp-video-frame` is a **sibling class** to `.trailer-frame` (NOT an extension or override). Two contexts, two radius semantics — don't over-DRY. Insert near `.trailer-frame` (line 1608) OR within the `.wp-live-*` family (line 737-773) — planner picks whichever location keeps the diff readable.
- `.wp-video-frame` rule shape (verbatim from UI-SPEC §1):
  ```css
  .wp-video-frame{width:100%;aspect-ratio:16/9;background:#000;
    border-radius:0;overflow:hidden;position:relative;flex-shrink:0}
  .wp-video-frame iframe,.wp-video-frame video{width:100%;height:100%;border:none;display:block}
  .wp-live-modal > .wp-video-frame:first-child{border-radius:24px 24px 0 0}
  ```
- `.field-help` + `.field-error` + `.field-invalid` rule shape (verbatim from UI-SPEC §2):
  ```css
  .field-help{font-family:var(--font-sans);font-size:var(--t-meta);font-weight:400;
    color:var(--ink-dim);margin-top:4px;line-height:1.4}
  .field-error{font-family:var(--font-sans);font-size:var(--t-meta);font-weight:400;
    color:var(--ink-warm);margin-top:6px;line-height:1.4}
  .schedule-modal input.field-invalid{border-color:var(--bad)}
  ```
- Insert these inside the `/* Schedule modal */` block (around line 675-689) so the cascade resolves correctly with adjacent `.schedule-modal input` rules
- Reuse existing tokens: `--t-meta`, `--ink-dim`, `--ink-warm`, `--bad`, `--font-sans`, `--r-md`, `--s2/3/4` — NO new tokens introduced (UI-SPEC §Color, §Spacing Scale)

---

### `scripts/smoke-native-video-player.cjs` — NEW smoke contract

**Analog (1):** `scripts/smoke-position-transform.cjs` (Phase 15.5 — first phase to introduce the canonical pattern):

```javascript
// Phase 15.5 Plan 02 — smoke test for positionToSeconds / secondsToPosition.
// Run: node scripts/smoke-position-transform.cjs
// Exit 0 = pass; exit 1 = fail.
const WAIT_UP_BANDS = Object.freeze([ /* ... */ ]);
function positionToSeconds(p) { /* inlined helper */ }
function secondsToPosition(s) { /* inlined helper */ }
let fails = 0;
function eq(label, got, want) { const ok = got === want; if (!ok) { console.error('FAIL ' + label + ': got ' + got + ' want ' + want); fails++; } else { console.log('OK   ' + label + ': ' + got); } }
function near(label, got, want, tol) { const ok = Math.abs(got - want) <= tol; if (!ok) { console.error('FAIL ' + label + ': got ' + got + ' want ~' + want + ' (tol ' + tol + ')'); fails++; } else { console.log('OK   ' + label + ': ' + got + ' ~ ' + want); } }
eq('positionToSeconds(0)', positionToSeconds(0), 0);
// ... ~25 assertions ...
if (fails) { console.error('\nFAILED ' + fails + ' assertion(s)'); process.exit(1); } else { console.log('\nALL ASSERTIONS PASSED'); process.exit(0); }
```

**Analog (2):** `scripts/smoke-sports-feed.cjs` (Phase 22 — module-mirror smoke pattern when helpers live in their own ES module):

```javascript
// Phase 22 — smoke test for sports-feed abstraction (TheSportsDB + BALLDONTLIE).
// Run: node scripts/smoke-sports-feed.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the contract for js/sports-feed.js. Self-contained mirror of the league
// catalog + normalizer (no js/ requires; ES module CJS-incompat per smoke pattern).
//
// Source contract (must match js/sports-feed.js):
//   - LEAGUES contains 16 keys ...
//   - normalizeTsdEvent maps TheSportsDB event JSON to canonical Game shape ...

'use strict';

// ---- Inline mirror of LEAGUES catalog (must match sports-feed.js) ----
const LEAGUES = { /* ... */ };

// ---- Mirror of normalizeTsdEvent (must match sports-feed.js) ----
function normalizeTsdEvent(ev, leagueKey) { /* ... */ }
```

**Analog (3):** `scripts/smoke-conflict-aware-empty.cjs` (Phase 21 — pattern when helpers live in `js/app.js` and need bigger stub set):

```javascript
// Phase 21 — smoke test for conflict-aware empty-state diagnosis helper.
// Run: node scripts/smoke-conflict-aware-empty.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the helper contract negotiated at /gsd-discuss-phase 21 (D-01..D-12).
// Mirrors diagnoseEmptyMatches from js/app.js so the contract is testable
// without a browser, Firestore, or auth state. Self-contained — does NOT
// require() js/constants.js or js/utils.js (those are ES modules; CJS
// require() throws ERR_REQUIRE_ESM). Inlines minimal deps...

'use strict';

// ---- Stubs / inlined deps ----
const BRAND_MAP = { /* ... */ };
function normalizeProviderName(name) { /* ... */ }
function escapeHtml(s) { return String(s == null ? '' : s); }
```

**Pattern to copy (per RESEARCH §Smoke Contract Design):**
- File header: phase number + scope sentence + "Run: node scripts/smoke-native-video-player.cjs" + "Exit 0/1" + "Locks the contract for parseVideoUrl + titleHasNonDrmPath + makeIntervalBroadcaster + iframe URL construction"
- `'use strict';`
- Inline-mirror the helpers (don't `require()` `js/app.js` — ES modules + heavy import graph break in CJS context). For `js/video-player.js` split path: still inline-mirror; the smoke contract is a literal "the helper contract is THIS shape" lock, not an integration test.
- Define `eq(label, got, want)` and `near(label, got, want, tol)` assertion helpers verbatim from `smoke-position-transform.cjs:14-15`
- `let fails = 0;` running counter; `process.exit(fails > 0 ? 1 : 0)` at end
- ~24 assertions per RESEARCH §Validation Architecture table:
  - `parseVideoUrl` × 13 cases (5 YouTube shapes + 2 MP4 shapes + 6 rejection cases)
  - `titleHasNonDrmPath` × 4 cases
  - `makeIntervalBroadcaster` × 2 cases (leading + trailing edge)
  - iframe URL string × 1 (must contain `enablejsapi=1` AND `playsinline=1`)
  - `<video>` tag string × 1 (must contain `playsinline`)
  - XSS guard × 2 (encodeURIComponent + escapeHtml applied)
  - Schema sentinel × 1 (string assert that `js/app.js` contains `videoUrl` and `videoSource` field names)

---

### `scripts/deploy.sh` §2.5 — 8th smoke-gate `if`-block

**Analog:** existing 7 smoke `if`-blocks at `scripts/deploy.sh:89-117`:

```bash
if [ -f scripts/smoke-position-transform.cjs ]; then
  node scripts/smoke-position-transform.cjs > /dev/null \
    || { echo "ERROR: smoke-position-transform failed -- aborting deploy." >&2; exit 1; }
fi
if [ -f scripts/smoke-tonight-matches.cjs ]; then
  node scripts/smoke-tonight-matches.cjs > /dev/null \
    || { echo "ERROR: smoke-tonight-matches failed -- aborting deploy." >&2; exit 1; }
fi
# ... 5 more identical blocks ...
if [ -f scripts/smoke-sports-feed.cjs ]; then
  node scripts/smoke-sports-feed.cjs > /dev/null \
    || { echo "ERROR: smoke-sports-feed failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed)."
```

**Pattern to copy:**
- Insert a NEW 8th `if`-block AFTER the `smoke-sports-feed.cjs` block (line 116):
  ```bash
  if [ -f scripts/smoke-native-video-player.cjs ]; then
    node scripts/smoke-native-video-player.cjs > /dev/null \
      || { echo "ERROR: smoke-native-video-player failed -- aborting deploy." >&2; exit 1; }
  fi
  ```
- Append `+ native-video-player` to the recap `echo "Smoke contracts pass (...)"` line at `:117`
- Block exists / file-not-exist → silent skip (`[ -f ... ]` guard) — matches the existing safety pattern that lets older branches pass when a future smoke is missing

---

### `package.json` — `scripts.smoke` chain extension + alias

**Analog:** existing chain + alias at `package.json:8,15`:

```json
"smoke": "node scripts/smoke-position-transform.cjs && node scripts/smoke-tonight-matches.cjs && node scripts/smoke-availability.cjs && node scripts/smoke-kid-mode.cjs && node scripts/smoke-decision-explanation.cjs && node scripts/smoke-conflict-aware-empty.cjs && node scripts/smoke-sports-feed.cjs",
"smoke:sports-feed": "node scripts/smoke-sports-feed.cjs"
```

**Pattern to copy:**
- Append ` && node scripts/smoke-native-video-player.cjs` to the end of the `"smoke"` chain string
- Add a new alias line: `"smoke:native-video-player": "node scripts/smoke-native-video-player.cjs"` (alphabetically near `smoke:sports-feed`)
- Two-line edit; no other JSON changes

---

### `sw.js` — CACHE constant bump

**Analog:** current line at `sw.js:8`:

```javascript
const CACHE = 'couch-v36.7-live-scoreboard';
```

**Auto-bump pattern** (from `scripts/deploy.sh:128-137`):

```bash
if [ -n "$TAG" ]; then
  CACHE_NEW="couch-v${TAG}"
  if grep -q "const CACHE = '${CACHE_NEW}';" sw.js; then
    echo "sw.js CACHE already at ${CACHE_NEW}; skipping bump."
  else
    sed -i.bak -E "s|const CACHE = '[^']+';|const CACHE = '${CACHE_NEW}';|" sw.js
    rm -f sw.js.bak
    echo "Bumped sw.js CACHE -> ${CACHE_NEW}"
  fi
fi
```

**Pattern to copy:**
- Single-line edit: `const CACHE = 'couch-v36.7-live-scoreboard';` → `const CACHE = 'couch-v37-native-video-player';` (per RESEARCH §Project Constraints, `couch-v37-native-video-player` is the recommended tag)
- Preferred path: invoke `bash scripts/deploy.sh 37-native-video-player` — the script auto-bumps the line in source (so `node --check` coverage stays consistent + commit captures it). Manual edit is the fallback when not deploying immediately.
- Per CLAUDE.md: bump is REQUIRED for any user-visible app shell change. Phase 24 introduces a new player surface → user-visible → bump REQUIRED.

---

## Shared Patterns

### Authentication / Authorization (existing — Phase 5 + 7 contract)

**Source:** `js/utils.js` `writeAttribution()` (imported at `js/app.js:5`)
**Apply to:** EVERY new Firestore write touching the wp record (`videoUrl`, `videoSource`, `currentTimeMs`, `currentTimeUpdatedAt`, `isPaused`)

**Excerpt** (call-site shape from `js/app.js:10271`):

```javascript
await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
```

**Convention:** every `setDoc` / `updateDoc` against `watchpartyRef(...)` MUST spread `...writeAttribution()` LAST so the auth/actingMember stamp lands on the document. Existing host-write Firestore rules authorize the new fields via the existing `auth.uid == hostUid` branch — no rule change needed (RESEARCH Assumption A3).

### XSS-safe interpolation

**Source:** `js/utils.js` `escapeHtml` (imported at `js/app.js:5`) + `encodeURIComponent` (browser global)
**Apply to:** every player-surface render call site

**Excerpt** (existing trailer iframe pattern, `js/app.js:7838`):

```javascript
`<iframe class="trailer-frame" src="https://www.youtube.com/embed/${encodeURIComponent(t.trailerKey)}" allowfullscreen></iframe>`
```

**Convention:**
- YouTube iframe `src`: wrap the EXTRACTED video ID (not the raw user-paste) in `encodeURIComponent(...)`. Raw user-paste never reaches the iframe `src`.
- `<video src>`: wrap the validated `wp.videoUrl` in `escapeHtml(...)`. The URL was already validated by `parseVideoUrl` (https-only, mp4-extension-only) so the `escapeHtml` is defense-in-depth, not the primary barrier.
- Per UI-SPEC §Registry Safety: `parseVideoUrl` rejects non-http(s) protocols at parse time — `javascript:` / `data:` / `file://` URLs are rejected before they ever reach the DOM.

### Error handling (inline, not modal)

**Source:** UI-SPEC §Interaction States + RESEARCH §Code Example 6
**Apply to:** YouTube `onError` event + `<video>` `error` event

**Excerpt** (per UI-SPEC §Player surface "Error" state):

```javascript
function renderPlayerErrorOverlay(playerElementId) {
  const player = document.getElementById(playerElementId);
  if (!player) return;
  const wrap = player.closest('.wp-video-frame');
  if (!wrap) return;
  let overlay = wrap.querySelector('.wp-video-error');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'wp-video-error';
    wrap.appendChild(overlay);
  }
  overlay.innerHTML = `<em class="serif-italic">Player couldn't load that link.</em>
    <button class="link-like" onclick="reloadWatchpartyPlayer()">Try again</button>`;
}
```

**Convention:** NEVER `alert(...)`. Inline overlay at the bottom of the player wrapper. Italic-serif `<em>` + `.link-like` retry button. Existing `.link-like` class at `css/app.css:~2250` — reuse, don't redefine.

### Validation (input parsers, on-submit)

**Source:** RESEARCH §Code Example 3 (`parseVideoUrl`)
**Apply to:** schedule-modal Save / Send-invites click handler in BOTH `confirmStartWatchparty` AND `scheduleSportsWatchparty`

**Convention:**
- Validation timing = ON SUBMIT, not on blur (UI-SPEC §Schedule-modal field "Validating" state — typing is forgiving, submit is the gate)
- Parser returns `null` on invalid → toggle `.field-invalid` on the input + unhide `.field-error` div + cancel submit
- Parser returns `{ source, id?, url }` on valid → strip the `.field-invalid` class + persist to wp record
- Empty value → silent valid (skip → today's coordination-only behavior)

---

## No Analog Found

No files in this phase are without an analog. Every new file or insertion point has a concrete in-repo precedent (Phase 22 module creation, Phase 21/22 smoke contract, Phase 15.5 schedule-modal field insertion, Phase 23 lifecycle-pair widening, existing trailer iframe + `.trailer-frame` CSS).

---

## Module-Creation Precedent (Decision Point for Planner)

**The choice:** Phase 24 helpers (`parseVideoUrl`, `titleHasNonDrmPath`, `makeIntervalBroadcaster`, plus YouTube/MP4 attach functions) can live in EITHER `js/app.js` (co-located near the existing call-site anchors) OR a NEW `js/video-player.js` module (Phase 22 precedent).

**Phase 22 precedent:** `js/sports-feed.js` was created as a standalone module because the ESPN-replacement involved a large coherent unit of code (league catalog + 4 fetch helpers + normalizer) that benefited from module-level isolation. Imported via `import { LEAGUES as SPORTS_FEED_LEAGUES, ... } from './sports-feed.js';` at `js/app.js:7`.

**Phase 21 / 15.5 / 18 / 19 / 20 / 23 precedent:** ALL recent phases except Phase 22 added their helpers DIRECTLY into `js/app.js` (co-located near related code). The Phase 21 `diagnoseEmptyMatches`, the Phase 15.5 `positionToSeconds`, the Phase 18 `providerRefreshTick`, etc. — all live inline in `js/app.js`.

**Recommendation for planner:**
- If Phase 24 ships ALL helpers (parser + DRM detection + throttle + YouTube attach + MP4 attach + error overlay + teardown + broadcast write) as ONE coherent unit → factor as `js/video-player.js` (matches Phase 22 cohesion threshold)
- If Phase 24 ships ONLY the pure helpers (parser + DRM detection + throttle) coherently and the impure attach/teardown calls live in `js/app.js` → keep everything inline (matches Phase 21/15.5/18/19/20/23 precedent)
- Smoke contract is identical either way (mirror the helper contract; don't `require()`)

Either choice is consistent with the codebase. **The planner's call.** Both paths are pre-validated above.

---

## Metadata

**Analog search scope:** `js/app.js`, `js/sports-feed.js`, `js/utils.js`, `app.html`, `css/app.css`, `sw.js`, `scripts/deploy.sh`, `scripts/smoke-position-transform.cjs`, `scripts/smoke-sports-feed.cjs`, `scripts/smoke-conflict-aware-empty.cjs`, `package.json`
**Files scanned:** 11
**Pattern extraction date:** 2026-04-30
**Token-cost compliance:** All `js/app.js` reads used `offset` + `limit` per CLAUDE.md "never read in full" mandate; only relevant 20-40-line windows loaded into context. No `js/app.js` re-reads.
**Phase:** 24-native-video-player
**Mapper:** gsd-pattern-mapper
