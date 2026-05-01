# Phase 26: Position-anchored reactions + async-replay — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 21 surfaces (19 modifications inside `js/app.js`, plus `js/state.js`, `css/app.css`, `sw.js`, `scripts/deploy.sh`, `package.json`, and one new file `scripts/smoke-position-anchored-reactions.cjs`)
**Analogs found:** 21 / 21

> Single-file no-bundler PWA. The vast majority of "files to create" are NEW functions appended inside `js/app.js`, NOT new module files. The only NEW physical file is `scripts/smoke-position-anchored-reactions.cjs`. The only NEW state slot lives in `js/state.js`. All other work modifies existing files surgically. Per CLAUDE.md, never read `js/app.js` in full — every excerpt below was lifted with `Grep` + `Read(offset, limit)`.

---

## File Classification

| Surface (NEW or MODIFY in `js/app.js` unless noted) | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `derivePositionForReaction(ctx)` (NEW helper) | utility (pure) | transform | `js/native-video-player.js` `seekToBroadcastedTime` (4-state guard helper that reads `wp.currentTimeMs` + `wp.currentTimeUpdatedAt` + `STALE_BROADCAST_MAX_MS`) | exact (Phase 24 sibling — identical staleness gate; pure; smoke-testable) |
| `postReaction` modification (`js/app.js:11932`) | controller (write path) | request-response (Firestore `arrayUnion`) | EXISTING in-place modification; analog is the same function pre-Phase-26 + the `broadcastCurrentTime` write recipe at `js/app.js:11084` for the spread payload pattern | exact (in-place edit) |
| `postBurstReaction` modification (`js/app.js:10672`) | controller (write path) | request-response (Firestore `arrayUnion`) | EXISTING in-place modification; mirror the `postReaction` Phase 26 edit so sports-mode reactions also stamp `runtimePositionMs` + `runtimeSource` | exact (mirror modification) |
| `renderWatchpartyLive` replay-variant branch (`js/app.js:11424`) | component (render) | branch on viewer state | The existing `if (wp.status === 'cancelled')` early-return branch at `js/app.js:11450` (cancelled-mode variant of the same modal; same scaffold reuse) + the `isSport = !!wp.sportEvent` ternary at `:11431` (mode-aware chrome swap inside live modal) | role-match (existing branch-by-mode patterns inside the same render fn) |
| `openWatchpartyLive` modification (`js/app.js:11284`) | controller (lifecycle entry) | request-response | EXISTING in-place modification — extend signature from `(wpId)` to `(wpId, opts)` where `opts.mode === 'revisit'` sets `state.activeWatchpartyMode` before render | exact (in-place edit) |
| `closeWatchpartyLive` modification (`js/app.js:11309`) | controller (lifecycle exit) | event-driven (close) | EXISTING in-place modification — add `state.activeWatchpartyMode = null` after the `state.activeWatchpartyId = null` line at `:11316` | exact (in-place edit) |
| `renderReplayReactionsFeed(wp, localPosMs)` (NEW) | component (render) | filter+sort projection | `renderReactionsFeed(wp, mine, modeOverride)` at `js/app.js:11713` (existing Wait Up filter pattern over `wp.reactions`) | role-match (same DOM target `#wp-reactions-feed`; different selection rule per UI-SPEC §3) |
| `getScrubberDurationMs(wp)` (NEW pure helper) | utility (pure) | precedence transform | The existing TMDB extras precedence at `js/app.js:24-29` (`out.runtime = dd.runtime` for movies, `dd.episode_run_time[0]` for TV) — this same `t.runtime` / `t.episode_run_time` shape is what the new helper reads | role-match (same precedence-style read on the same fields) |
| Replay scrubber strip render (NEW DOM block inside replay branch) | component (render) | event-driven (range input) | `renderDvrSlider` (Phase 11 / Phase 15.5 Wait Up slider) at `js/app.js:10759` — `<input type="range">` with `oninput` for live-update + `onchange` for commit + `<span>` readout sibling | exact (same `<input type="range">` shape; same `oninput`/`onchange` split locked by UI-SPEC §2; mirror this) |
| `replayableReactionCount(wp)` (NEW pure predicate) | utility (pure) | filter+count | `archivedWatchparties()` at `js/app.js:2932` (small one-liner predicate over `state.watchparties` filtered by `wp.status === 'archived'`) | role-match (same neighborhood; same one-liner shape) |
| `friendlyPartyDate(startAt)` (NEW pure helper) | utility (pure) | date-format ladder | `formatStartTime(ts)` at `js/app.js:2999` (existing `Date` → `Today / Tomorrow / Mon Day at h:mm` ladder) | role-match (same `Date()` ladder shape; new ladder per UI-SPEC §Copywriting) |
| `renderPastParties` extension (`js/app.js:12145`) | component (render) | filter+paginate | EXISTING in-place modification; its current 5h-25h `WP_STALE_MS` filter is the analog being replaced (see lines `12150-12154`) | exact (in-place edit) |
| `renderPastWatchpartiesForTitle(t)` (NEW section) | component (render) | filter+sort projection | `renderWatchpartyHistoryForTitle(t)` at `js/app.js:7942` (existing `<h4>Watchparties</h4>` block under `.detail-section`; same DOM recipe; insert after at `:7937`) | exact (the bifurcated sibling — same row recipe family) |
| `renderWatchpartyHistoryForTitle` modification (`js/app.js:7942`) | component (render) | filter narrowing | EXISTING in-place modification — narrow `state.watchparties.filter(wp => wp.titleId === t.id)` at `:7943` to `activeWatchparties().filter(wp => wp.titleId === t.id)` per D-08 bifurcation | exact (in-place edit) |
| `state.activeWatchpartyMode` slot (and possibly `state.replayLocalPositionMs`, `state.pastPartiesShownCount`) | state (session) | per-session memory | `state.activeWatchpartyId` already in `state` object at `js/state.js:7` (existing live-modal session slot, paired one-to-one with the new flag) | exact (sibling slot in the same one-line `state` initializer) |
| `app.html` replay scaffold | component (markup) | static DOM | NO new IDs needed per UI-SPEC §1 — replay variant is a render-time branch inside existing `#wp-live-modal-bg` / `#wp-live-content` (`app.html:1212-1213`); analog is the Phase 24 `#wp-video-surface` insertion at `app.html:1219` (which is the most recent additive change to this scaffold) | exact (no edit expected — only mentioned because UI-SPEC §1 confirms zero new HTML) |
| `css/app.css` replay scrubber + revisit subline + past-watchparties-for-title | config (styles) | declarative | Three analogs — `.wp-dvr-slider` family at `css/app.css:3117-3137` (scrubber recipe), `.wp-live-modal` family at `css/app.css:741-776` (modal scaffold the variant lives inside), `.past-parties-row` family at `css/app.css:4356-4402` (history-row recipe to mirror for title-detail variant) | exact (three established families to reuse verbatim — UI-SPEC §0 explicitly says no new tokens) |
| `scripts/smoke-position-anchored-reactions.cjs` (NEW file, ~250 lines) | test (smoke) | pure helper assertions + production-source sentinels | `scripts/smoke-native-video-player.cjs` (Phase 24 — uses dynamic `await import('../js/native-video-player.js')` for production-module assertions + `fs.readFileSync('js/app.js')` for production-code sentinels — Phase 26 is the 9th smoke and shares the closest pattern) | exact (Phase 24 same-shape — both helpers live inside `js/app.js` consumer, NOT a separate ES module; smoke MIRRORS helper inline per RESEARCH §Standard Stack recommendation) |
| `scripts/deploy.sh` §2.5 addition | config (deploy gate) | declarative | The Phase 24 wiring at `scripts/deploy.sh:117-120` (5-line `if [ -f scripts/smoke-native-video-player.cjs ]; then ... fi` block — Phase 26 mirrors this verbatim with `smoke-position-anchored-reactions.cjs` substituted) | exact (one-line-block paste) |
| `package.json` smoke entry | config (package) | declarative | `package.json` has `smoke:native-video-player` (Phase 24) + the `smoke` aggregate script with `&&`-chained smokes — Phase 26 appends `smoke:replay` (or `smoke:position-anchored-reactions`) and chains it into the aggregate | exact (mirror existing pattern) |
| `sw.js` CACHE bump | config (service worker) | declarative | `sw.js:8` `const CACHE = 'couch-v37-native-video-player'` (Phase 24) — Phase 26 bumps to `couch-v38-async-replay`. Auto-handled by `bash scripts/deploy.sh 38-async-replay` per CLAUDE.md; planner does NOT manually edit | exact (auto-bumped via deploy script) |

---

## Pattern Assignments

### `derivePositionForReaction(ctx)` — NEW helper (utility, transform)

**Analog:** `js/native-video-player.js` `seekToBroadcastedTime(player, wp, source)` (lines 141-176)

**Why this analog:** Identical guard structure — both are pure helpers that branch on `wp.currentTimeMs` + `wp.currentTimeUpdatedAt` + `STALE_BROADCAST_MAX_MS`, return early on missing/stale fields, and have a happy path that uses `Date.now() - updatedAt` as the freshness signal. Phase 26 already imports `STALE_BROADCAST_MAX_MS` from this module (`js/app.js:14`). The new helper is the **read-side mirror** of `seekToBroadcastedTime` (same constant, same staleness check, same guard order).

**Staleness-guard pattern to copy** (`js/native-video-player.js:142-148`):
```javascript
export function seekToBroadcastedTime(player, wp, source) {
  if (!player || !wp || !source) return false;
  const ms = (typeof wp.currentTimeMs === 'number') ? wp.currentTimeMs : 0;
  if (!isFinite(ms) || ms <= 0) return false;
  const updatedAt = (typeof wp.currentTimeUpdatedAt === 'number') ? wp.currentTimeUpdatedAt : 0;
  const age = Date.now() - updatedAt;
  if (!isFinite(age) || age < 0 || age > STALE_BROADCAST_MAX_MS) return false;
  // ...
```

Phase 26 mirror: same `typeof === 'number'` + `isFinite` + age-bounds-check guards, but instead of `return false` on failure, fall through to the `elapsedMs` branch per D-02. RESEARCH §Architecture Patterns Pattern 1 (lines 322-379) ships the full proposed body — copy that structure verbatim and lock the branch order:
1. `ctx.isReplay === true` → `'replay'` (D-05; locked first)
2. `wp.isLiveStream === true` → `null, 'live-stream'` (D-03)
3. broadcast fresh → `currentTimeMs + sinceUpdate, 'broadcast'` (D-01)
4. fallback → `elapsedMs, 'elapsed'` (D-02)

**Where to insert:** Inside `js/app.js` near `postReaction` at line 11932 (RESEARCH §Standard Stack lock — single consumer, ~30 lines, no new module).

---

### `postReaction` modification (controller, request-response)

**Analog:** EXISTING in-place modification at `js/app.js:11932-11954`

**Source code to modify** (`js/app.js:11932-11953`):
```javascript
async function postReaction(payload) {
  if (!state.me || !state.activeWatchpartyId) return;
  if (guardReadOnlyWrite()) return;                // Plan 5.8 D-15: no watchparty reactions from unclaimed post-grace
  const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
  if (!wp) return;
  const mine = myParticipation(wp);
  if (!mine || !mine.startedAt) { alert('Start your timer first.'); return; }
  if (mine.pausedAt) { alert('You are paused. Resume to post.'); return; }
  const elapsedMs = computeElapsed(mine, wp);
  const reaction = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ...writeAttribution(),
    elapsedMs,
    at: Date.now(),
    ...payload
  };
  try {
    await updateDoc(watchpartyRef(wp.id), { reactions: arrayUnion(reaction), lastActivityAt: Date.now(), ...writeAttribution() });
    // Local optimistic refresh — snapshot will overwrite this imminently
    wp.reactions = [...(wp.reactions || []), reaction];
    renderWatchpartyLive();
  } catch(e) { console.error('post reaction failed', e); }
}
```

**Edit (RESEARCH §Architecture Patterns Pattern 1 lines 386-410):** Insert a `derivePositionForReaction({ wp, mine, elapsedMs, isReplay, localReplayPositionMs })` call after the `computeElapsed` line, then spread `runtimePositionMs` and `runtimeSource` into the `reaction` object literal alongside `elapsedMs` and `at`. The `arrayUnion` write path is unchanged. The optimistic local mount and `renderWatchpartyLive()` call stay unchanged.

**Caveat:** Field names `runtimePositionMs` and `runtimeSource` MUST appear as literal keys (not via dynamic spread) because smoke assertions #6 and #7 use regex sentinels to verify they appear in production source.

---

### `postBurstReaction` modification (`js/app.js:10672`)

**Analog:** EXISTING in-place modification — mirror of the `postReaction` Phase 26 edit

**Source code to modify** (`js/app.js:10672-10695`):
```javascript
window.postBurstReaction = async function(wpId, emoji) {
  if (!state.me) return;
  try {
    const reaction = {
      memberId: state.me.id,
      memberName: state.me.name,
      kind: 'emoji',
      emoji,
      at: Date.now(),
      amplified: true
    };
    await updateDoc(watchpartyRef(wpId), {
      reactions: arrayUnion(reaction),
      lastActivityAt: Date.now(),
      ...writeAttribution()
    });
    haptic('success');
    // ...
```

**Edit:** This is the Phase 23 sports-burst write path. Per RESEARCH §Pattern 1 note (line 412), wire `derivePositionForReaction` here too so sports-mode reactions also get `runtimePositionMs` + `runtimeSource`. Note this site does NOT compute `elapsedMs` (sports-mode lacks per-member timer); pass `elapsedMs: 0` and `mine: null` — the helper falls through to either the broadcast path (if `wp.currentTimeMs` is fresh, e.g., for a watchparty with `wp.videoUrl`) or the `elapsed` path (which will record `runtimePositionMs: 0`). Sports watchparties also typically have `wp.isLiveStream === true` (live broadcasts), in which case the helper returns `null, 'live-stream'` per D-03 — exactly the right behavior (live-stream sports stay wall-clock-only).

**Caveat:** This site reads `wpId` (string) and looks up `wp` via `state.watchparties.find` only inside the implicit `arrayUnion` (no local `wp` variable). The edit needs to add `const wp = state.watchparties.find(x => x.id === wpId)` before the `derivePositionForReaction` call.

---

### `renderWatchpartyLive` replay-variant branch (`js/app.js:11424`)

**Analog:** Two existing in-function branch patterns inside `renderWatchpartyLive`:
1. **Cancelled-mode early return** (`js/app.js:11450-11467`) — same scaffold reuse, distinct chrome
2. **`isSport = !!wp.sportEvent` ternary** (`js/app.js:11431-11448`) — mode-aware chrome swap (poster, title format, status copy)

**Source code at the gating call site** (`js/app.js:11431-11489`):
```javascript
const isSport = !!wp.sportEvent;
// Phase 24 — When player is active in #wp-video-surface, hide the redundant
// .wp-live-poster via parent class. Player IS the visual identity.
let headerExtraClass = '';
if (wp.videoUrl && wp.videoSource) {
  const _t = state.titles && state.titles.find(x => x.id === wp.titleId);
  if (titleHasNonDrmPath(_t)) {
    headerExtraClass = ' wp-live-header--has-player';
  }
}
// Header title block — matchup format for sports, regular title otherwise
const liveTitleHtml = isSport
  ? `<div class="wp-live-titlename" ...>${...}</div>`
  : `<div class="wp-live-titlename">${escapeHtml(wp.titleName)}</div>`;
// ...
const statusText = preStart
  ? (isSport ? `Kickoff ${formatStartTime(wp.startAt)}` : `Starts ${formatStartTime(wp.startAt)}`)
  : `Started ${formatStartTime(wp.startAt)}`;
const header = `<div class="wp-live-header${headerExtraClass}">
    ${livePosterHtml}
    <div class="wp-live-titleinfo">
      ${liveTitleHtml}
      <div class="wp-live-status">${statusText}${mine && mine.pausedAt ? ' · <span style="color:var(--accent);">Paused</span>' : ''}</div>
    </div>
    ${mine && mine.startedAt ? `<div class="wp-live-timer" id="wp-live-timer-display">${formatElapsed(computeElapsed(mine, wp))}</div>` : ''}
    <button class="pill icon-only" aria-label="Close watchparty" onclick="closeWatchpartyLive()" style="margin-left:6px;">✕</button>
  </div>`;
```

**Edit pattern (RESEARCH §Architecture Patterns Pattern 2 lines 426-457):** Add `const isReplay = state.activeWatchpartyMode === 'revisit';` early in the function (alongside `isSport`). Then mirror the `isSport ? ... : ...` ternary shape:
- `statusText` becomes `isReplay ? 'REVISITING' : (preStart ? ... : ...)`.
- Add `revisitSubline = isReplay ? `<div class="wp-live-revisit-subline">together again</div>` : ''` and inject inside `.wp-live-titleinfo` after `liveTitleHtml`.
- Add `scrubberStrip = isReplay ? renderReplayScrubber(wp) : ''` and inject above the coordination header.
- The existing `mine && mine.startedAt` timer block at line 11487 becomes `mine && mine.startedAt && !isReplay ? ... : ''` (timer hidden in replay).
- Reactions feed call site swaps `renderReactionsFeed(wp, mine)` → `isReplay ? renderReplayReactionsFeed(wp, state.replayLocalPositionMs || 0) : renderReactionsFeed(wp, mine)`.
- Wait Up chip strip + participants strip call sites get `&& !isReplay` guards.

**Caveat:** Per UI-SPEC §1, the eligibility gate is `wp.status === 'archived'` AND `state.activeWatchpartyMode === 'revisit'`. The render branch checks the flag; the entry-point gate (`openWatchpartyLive` opts.mode handling) should ensure the flag is only set when the wp is archived (otherwise a malicious caller could put a live wp into revisit mode). Smoke assertion #8 will sentinel-check that `wp.status === 'archived'` literal appears inside `renderWatchpartyLive`.

---

### `openWatchpartyLive` modification (`js/app.js:11284`)

**Analog:** EXISTING in-place modification

**Source code to modify** (`js/app.js:11284-11307`):
```javascript
window.openWatchpartyLive = function(wpId) {
  state.activeWatchpartyId = wpId;
  renderWatchpartyLive();
  document.getElementById('wp-live-modal-bg').classList.add('on');
  // Phase 11 / REFR-10 — Game Mode: start score polling + team-flair prompt.
  // Phase 23 — gate widened: ALSO fire for legacy wp.sportEvent watchparties
  // ...
  const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
  if (wp && (wp.mode === 'game' || wp.sportEvent)) {
    startSportsScorePolling(wp);
    if (wp.mode === 'game') {
      const mine = myParticipation(wp);
      maybeShowTeamFlairPicker(wp, mine);
    }
  }
  // Phase 24 / REVIEWS H1 — Attach the persistent video player AFTER coordination paints.
  if (wp && wp.videoUrl) {
    attachVideoPlayer(wp);
  }
};
```

**Edit:** Change signature to `function(wpId, opts)`, add at the top: `const mode = (opts && opts.mode === 'revisit') ? 'revisit' : 'live'; state.activeWatchpartyMode = mode;` BEFORE `renderWatchpartyLive()` so the first paint is mode-correct. The Phase 24 `attachVideoPlayer(wp)` call at `:11304` stays unchanged (per UI-SPEC §6 "render but do NOT auto-start" — and Phase 24's `attachVideoPlayer` does not auto-start; the gate is preserved by NOT adding `playerVars.autoplay`).

**Caveat:** All EXISTING call sites pass `(wpId)` only — the new `opts` parameter is optional, so backward compat is preserved. The two NEW call sites that pass `{ mode: 'revisit' }` are: (a) Past parties row tap (`renderPastParties`), (b) Past watchparties for title row tap (`renderPastWatchpartiesForTitle`). Smoke assertion #9 sentinel-checks that `mode: 'revisit'` literal appears in ≥2 sites.

---

### `closeWatchpartyLive` modification (`js/app.js:11309`)

**Analog:** EXISTING in-place modification

**Source code to modify** (`js/app.js:11309-11317`):
```javascript
window.closeWatchpartyLive = function() {
  // Phase 24 — Tear down the player FIRST so timers/listeners die before
  // anything else clears state. Idempotent if no player is attached.
  teardownVideoPlayer();
  document.getElementById('wp-live-modal-bg').classList.remove('on');
  // Phase 11 / REFR-10 — stop any active score polling loop
  stopSportsScorePolling();
  state.activeWatchpartyId = null;
};
```

**Edit:** Add `state.activeWatchpartyMode = null;` after the `state.activeWatchpartyId = null;` line. Per RESEARCH Pitfall 9 (lines 649-656), failure to clear this flag causes the next live-mode open to render in replay variant. Also clear `state.replayLocalPositionMs = null;` if that slot is used. Smoke assertion will sentinel-check `activeWatchpartyMode = null` (or equivalent) appears inside `closeWatchpartyLive`.

---

### `renderReplayReactionsFeed(wp, localPosMs)` — NEW (component, filter+sort projection)

**Analog:** `renderReactionsFeed(wp, mine, modeOverride)` at `js/app.js:11713-11749`

**Why this analog:** Same DOM target (`#wp-reactions-feed`), same outer `<div class="wp-live-body">` recipe, same `wp.reactions || []` source array. The DIFFERENCE is the selection rule (position-aligned vs Wait Up filtered) and the sort key (`runtimePositionMs` vs implicit insertion order with `r.at` wallclock filter).

**Source code excerpt** (`js/app.js:11713-11749`):
```javascript
function renderReactionsFeed(wp, mine, modeOverride) {
  const mode = modeOverride || mine.reactionsMode || 'elapsed';
  if (mode === 'hidden') {
    return `<div class="wp-live-body" id="wp-reactions-feed"><div class="wp-reactions-hidden">Reactions hidden. ...</div></div>`;
  }
  const myElapsed = computeElapsed(mine, wp);
  const allReactions = wp.reactions || [];
  // Phase 7 Plan 07 (PARTY-04): viewer-side reaction delay. ...
  const delayMs = (mine.reactionDelay || 0) * 1000;
  const nowMs = Date.now();
  const visible = allReactions.filter(r => {
    if (mode === 'wallclock') return true;
    if (r.memberId === state.me.id) return true;
    return (r.at || 0) <= (nowMs - delayMs);
  });
  if (!visible.length) {
    return `<div class="wp-live-body" id="wp-reactions-feed"><div style="text-align:center;color:var(--ink-dim);font-size:var(--t-meta);padding:20px;">Reactions will flow in as people post them.</div></div>`;
  }
  // ...
```

**Pattern to copy:** Same `<div class="wp-live-body" id="wp-reactions-feed">` outer; same empty-state recipe (just swap copy to `<em style="font-family:'Instrument Serif',serif;">Nothing yet at this moment.</em>` per UI-SPEC §3); same `.map(renderReaction).join('')` row body. The replay version (RESEARCH §Code Examples §4 lines 769-783) replaces the Wait Up filter with the position-aligned filter:
```javascript
const visible = all
  .filter(r => r.runtimePositionMs != null)
  .filter(r => r.runtimePositionMs <= (localReplayPositionMs + DRIFT_TOLERANCE_MS))
  .sort((a, b) => a.runtimePositionMs - b.runtimePositionMs);
```

**Caveat:** Per RESEARCH Pitfall 5 (lines 612-619), once-shown reactions persist visible across scrub-backward — implement as session-set, not as filter-on-each-render. Per Pitfall 1 (lines 577-584), the branch on `state.activeWatchpartyMode` happens at the call site inside `renderWatchpartyLive` (NOT inside `renderReactionsFeed`). Per Pitfall 6, drag fires `oninput` for readout only; reactions re-evaluate on `onchange`.

**`DRIFT_TOLERANCE_MS = 2000`** locked per UI-SPEC §2; smoke assertion sentinel-checks the literal.

---

### `getScrubberDurationMs(wp)` — NEW pure helper (utility, precedence transform)

**Analog:** The existing TMDB extras precedence at `js/app.js:24-29` (movie vs TV runtime read)

**Source code excerpt** (`js/app.js:23-29`):
```javascript
async function fetchTmdbExtras(mediaType, tmdbId) {
  const out = { trailerKey: null, rating: null, providers: [], rentProviders: [], buyProviders: [], providersChecked: true, providersSchemaVersion: 3, runtime: null };
  try {
    const dr = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}`);
    const dd = await dr.json();
    if (mediaType === 'movie') out.runtime = dd.runtime || null;
    else out.runtime = (dd.episode_run_time && dd.episode_run_time[0]) || null;
```

**Pattern:** Same field-shape precedence (`t.runtime` for movies, `t.episode_run_time` for TV; both stored as **minutes**, multiply by `60 * 1000` for ms). RESEARCH §Code Examples §3 (lines 726-751) ships the full proposed body — copy verbatim. Lock the 4-step precedence: `t.runtime` (movies) / `t.episode_run_time` (TV) → `wp.durationMs` (Phase 24 broadcast capture) → `Math.max(...positions) + 30000` (cushion) → `60 * 60 * 1000` (60-min floor). UI-SPEC §2 locks this order.

**Caveat:** Phase 24's `wp.durationMs` is the runtime extracted from the host's player via `getDuration()` × 1000 — see `broadcastCurrentTime` at `js/app.js:11084-11097` for the write site. This field is `null` for live streams (per the `isLiveStream` short-circuit at `:11091`); in that case the helper falls through. But replay surface filters live-stream wps out at the list level (D-10 + D-03), so `getScrubberDurationMs` should never be called on a live-stream wp.

---

### Replay scrubber strip render (NEW DOM block inside replay branch)

**Analog:** `renderDvrSlider` (Phase 11 / Phase 15.5 Wait Up slider) at `js/app.js:10759-10767`

**Source code excerpt** (`js/app.js:10759-10767`):
```javascript
return `<div class="wp-dvr-slider">
    <span class="wp-dvr-label">Wait up</span>
    <input type="range" min="0" max="100" value="${initialPos}" step="0.5"
      class="wp-dvr-input"
      oninput="updateDvrReadout(positionToSeconds(this.value))"
      onchange="setDvrOffset('${escapeHtml(wp.id)}', positionToSeconds(this.value))"
      aria-label="${escapeHtml(ariaLabel)}" />
    <span class="wp-dvr-readout" id="wp-dvr-readout">${readoutHtml}</span>
  </div>`;
```

**Pattern to copy:**
- Same `<input type="range">` shape with `min` + `max` + `value` + `step` attributes
- Same `oninput` / `onchange` split (UI-SPEC §2 locks: `oninput` updates readout text + filled-track width only; `onchange` re-evaluates the position-aligned reactions set)
- Same `<span class="wp-..-readout" id="wp-..-readout">` companion element for live position text
- Same `aria-label` recipe with `escapeHtml`

**Phase 26 specifics (per UI-SPEC §2):**
- Container `class="wp-replay-scrubber-strip"` (NEW CSS recipe — see CSS section)
- `min="0" max="${getScrubberDurationMs(wp)}" step="1000"` (1-sec snap per UI-SPEC §2)
- Add `<button class="wp-replay-playpause" onclick="toggleReplayClock()">▶</button>` to the LEFT of the input (Unicode glyph; `▶` U+25B6 paused / `⏸` U+23F8 playing)
- Readout copy: `{m:ss} / {h:mm:ss}` per UI-SPEC §Copywriting (uses `formatElapsed` from `js/app.js:2981` — already exists; can be reused for both current-position and total-duration formatting)
- `aria-label="Move to where you are in the movie"`

**Caveat:** Per UI-SPEC §2 + §Accessibility, the thumb pseudo-element needs vertical hit-area extension for ≥44pt touch target. The Wait Up slider uses 22px thumb + 6px track; replay scrubber uses 28px thumb + 8px track per UI-SPEC §2 (primary interaction, larger). Mirror the Wait Up slider's `::-webkit-slider-thumb` and `::-moz-range-thumb` recipes from `css/app.css:3128-3133`, but bump dimensions per UI-SPEC.

---

### `replayableReactionCount(wp)` — NEW pure predicate (utility, filter+count)

**Analog:** `archivedWatchparties()` at `js/app.js:2932-2935`

**Source code excerpt** (`js/app.js:2919-2936`):
```javascript
function activeWatchparties() {
  const now = Date.now();
  return state.watchparties.filter(wp => {
    if (wp.status === 'archived') return false;
    // ...
    return wp.startAt > now || (now - wp.startAt) < WP_ARCHIVE_MS;
  }).sort((a,b) => a.startAt - b.startAt);
}
function archivedWatchparties() {
  const now = Date.now();
  return state.watchparties.filter(wp => wp.status === 'archived' || (now - wp.startAt) >= WP_ARCHIVE_MS);
}
function wpForTitle(titleId) { return activeWatchparties().find(wp => wp.titleId === titleId && wp.status !== 'cancelled'); }
```

**Pattern:** Same neighborhood (insert immediately after `archivedWatchparties` at line 2935); same one-liner-style predicate; same `.filter` + `.length` count idiom. RESEARCH §Code Examples §1 (lines 679-685) ships the full body:
```javascript
function replayableReactionCount(wp) {
  if (!wp || !Array.isArray(wp.reactions)) return 0;
  return wp.reactions.filter(r =>
    r.runtimePositionMs != null && r.runtimeSource !== 'live-stream'
  ).length;
}
```

**Caveat:** Use `!= null` (loose-equality) NOT `!== null`. Per RESEARCH Pitfall 2 (lines 587-594), pre-Phase-26 reactions have `r.runtimePositionMs === undefined`, and `undefined !== null` evaluates `true` (would falsely include them). The loose-equality form catches BOTH null and undefined. Smoke assertion #13 fixture includes a `{}` reaction to lock this.

---

### `friendlyPartyDate(startAt)` — NEW pure helper (utility, date-format ladder)

**Analog:** `formatStartTime(ts)` at `js/app.js:2999-3008`

**Source code excerpt** (`js/app.js:2999-3008`):
```javascript
function formatStartTime(ts) {
  const d = new Date(ts);
  const today = new Date();
  const isToday = d.toDateString() === today.toDateString();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate()+1);
  const isTomorrow = d.toDateString() === tomorrow.toDateString();
  const timeStr = d.toLocaleTimeString([], {hour:'numeric', minute:'2-digit'});
  if (isToday) return `Today at ${timeStr}`;
  if (isTomorrow) return `Tomorrow at ${timeStr}`;
  return `${d.toLocaleDateString([], {month:'short', day:'numeric'})} at ${timeStr}`;
}
```

**Pattern:** Same `Date()` + ladder shape (early-return per branch); same `toLocaleDateString` for cross-year fallback. RESEARCH §Code Examples §2 (lines 695-713) ships the full body. UI-SPEC §Copywriting locks the new ladder for past parties:
- `< 24h` → `Started {N} hr ago` (existing — preserve)
- `24-48h` → `Last night`
- `< 7d` → `{Weekday}` (e.g., `Tuesday`)
- `7-13d` → `Last {Weekday}`
- `< 1y` → `{Month} {Day}` (e.g., `April 12`)
- cross-year → `{Month} {Day}, {Year}`

**Where to insert:** Near `formatStartTime` (line 2999). RESEARCH §Standard Stack confirms inline placement (no new module — single helper, two consumers: `renderPastParties` row subtitle + `renderPastWatchpartiesForTitle` row subtitle).

**Caveat:** Smoke contract should test the 5 fixture cases per UI-SPEC §Copywriting + RESEARCH §Validation Architecture (line 844): today, last night, weekday, last weekday, cross-year. Use deterministic `Date` fixtures (e.g., a known `Date.now()` mock) since the ladder is time-relative.

---

### `renderPastParties` extension (`js/app.js:12145`)

**Analog:** EXISTING in-place modification

**Source code to modify** (`js/app.js:12145-12187`):
```javascript
function renderPastParties() {
  const el = document.getElementById('past-parties-list');
  if (!el) return;
  const now = Date.now();
  // Use the same WP_STALE_MS boundary as renderWatchpartyBanner — single source of truth.
  const stale = activeWatchparties().filter(wp =>
    wp.status !== 'cancelled' &&
    wp.startAt <= now &&
    (now - wp.startAt) >= WP_STALE_MS
  ).sort((a, b) => b.startAt - a.startAt); // most recent first
  if (!stale.length) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = stale.map(wp => {
    // ...
    const hoursAgo = Math.max(1, Math.floor((now - wp.startAt) / (60 * 60 * 1000)));
    const participantCount = wp.participants ? Object.keys(wp.participants).length : 0;
    // ...
    const actionFn = joined
      ? `openWatchpartyLive('${wpIdSafe}')`
      : `joinWatchparty('${wpIdSafe}')`;
    // ...
    return `<div class="past-parties-row" role="button" tabindex="0"
              onclick="closePastParties();${actionFn}"
              ...>
      <div class="past-parties-poster" style="${posterStyle}"></div>
      <div class="past-parties-body">
        <div class="past-parties-title">${titleNameSafe}</div>
        <div class="past-parties-meta">Started ${hoursAgo} hr ago</div>
        <div class="past-parties-meta">${participantCount} on the couch</div>
      </div>
      <span class="past-parties-row-chevron" aria-hidden="true">›</span>
    </div>`;
  }).join('');
}
```

**Edit (RESEARCH §Architecture Patterns Pattern 3 lines 478-493):**
- Replace the `stale = activeWatchparties().filter(...)` block with `archivedWatchparties().filter(wp => wp.status !== 'cancelled').filter(wp => replayableReactionCount(wp) >= 1).sort(...)`.
- Add pagination via `state.pastPartiesShownCount` (default 20 per UI-SPEC §4) + `.slice(0, shownCount)`.
- Replace the `Started {N} hr ago` line with `friendlyPartyDate(wp.startAt)` per UI-SPEC §Copywriting.
- Add a third `<div class="past-parties-meta">{N} reactions</div>` line (singular `1 reaction` / plural per UI-SPEC §Copywriting).
- Change `actionFn` to ALWAYS use `openWatchpartyLive('${wpIdSafe}', {mode:'revisit'})` (joined check goes away — replay mode is universal regardless of original participation).
- Append `Show older parties ›` row when `allArchived.length > shownCount`.

**Caveat:** Per RESEARCH Pitfall 8 (lines 641-647), the Tonight tab inline link gating `if (count === 0) return ''` MUST be preserved (renamed `staleWps.length` → `allReplayableArchivedCount(state.watchparties)`). The link does NOT render at all when count is 0 — silent UX per UI-SPEC §4. Per Pitfall 10 (lines 660-665), reset `state.pastPartiesShownCount = null` inside `closePastParties` at line 12140 for cleanliness.

---

### `renderPastWatchpartiesForTitle(t)` — NEW section (component, render)

**Analog:** `renderWatchpartyHistoryForTitle(t)` at `js/app.js:7942-7966`

**Source code to mirror** (`js/app.js:7942-7966`):
```javascript
function renderWatchpartyHistoryForTitle(t) {
  const related = state.watchparties.filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt);
  if (!related.length) return '';
  return `<div class="detail-section"><h4>Watchparties</h4>
    <div class="wp-history-list">
      ${related.map(wp => {
        const now = Date.now();
        const isActive = wp.status !== 'archived' && (wp.startAt > now || (now - wp.startAt) < WP_ARCHIVE_MS);
        const count = Object.keys(wp.participants || {}).length;
        const reactionCount = (wp.reactions || []).length;
        const dateStr = formatStartTime(wp.startAt);
        const statusPill = isActive
          ? `<span class="wp-history-pill live">Live</span>`
          : `<span class="wp-history-pill">Archived</span>`;
        return `<div class="wp-history-item" onclick="closeDetailModal();openWatchpartyLive('${wp.id}')">
          <div class="wp-history-info">
            <div class="wp-history-date">${dateStr} ${statusPill}</div>
            <div class="wp-history-meta">${escapeHtml(wp.hostName)} hosted · ${count} ${count===1?'person':'people'} · ${reactionCount} ${reactionCount===1?'reaction':'reactions'}</div>
          </div>
          <div class="wp-history-arrow">›</div>
        </div>`;
      }).join('')}
    </div>
  </div>`;
}
```

**Pattern to copy:**
- Same `<div class="detail-section"><h4>...</h4>` outer recipe (the canonical title-detail section wrapper)
- Same `closeDetailModal();openWatchpartyLive(...)` row tap pattern — but pass `, {mode:'revisit'}` per D-08
- Same `count===1 ? 'person' : 'people'` pluralization idiom for `{N} on the couch` and `{N} reactions`
- Same `escapeHtml(wp.hostName)` defensive escape

**Phase 26 specifics (UI-SPEC §5):**
- Heading text: `<h4>Past watchparties</h4>` (sentence case, distinct from active-only `<h4>Watchparties</h4>`)
- Add italic-serif sub-line: `<p class="detail-section-subline"><em>Catch up on what the family said.</em></p>`
- Row container class: `past-watchparties-for-title-list`
- Row item class: `past-watchparty-row`
- Add poster (48×72) per UI-SPEC §5 — heavier visual treatment than the existing `wp-history-item` which is text-only
- Subtitle line 1: `friendlyPartyDate(wp.startAt)` (NEW helper)
- Subtitle line 2: `${count} on the couch · ${reactionCount} reactions` (single line, middle-dot separator — matches existing `:7959` pattern verbatim)
- `if (!past.length) return ''` short-circuit per RESEARCH Pitfall 7 (lines 632-639) — section hides entirely when empty
- Cap at 10 rows (no in-section pagination per UI-SPEC §5)

**Where to insert call:** `renderDetailShell` at `js/app.js:7837`, immediately after `${renderWatchpartyHistoryForTitle(t)}` at line 7937. So the new section sits BELOW the (now bifurcated) active-only `Watchparties` block.

---

### `renderWatchpartyHistoryForTitle` modification (`js/app.js:7942`) — D-08 bifurcation

**Analog:** EXISTING in-place modification

**Source code to modify** (`js/app.js:7943`):
```javascript
const related = state.watchparties.filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt);
```

**Edit:** Change to `const related = activeWatchparties().filter(wp => wp.titleId === t.id);` per RESEARCH §Pattern 4 (lines 510-515). The `activeWatchparties()` helper already filters out `wp.status === 'archived'` AND archived-by-age (`(now - wp.startAt) >= WP_ARCHIVE_MS`); see source at `js/app.js:2919-2930`. The function returns `[]` (and the early `if (!related.length) return ''` short-circuit fires) when no active wps for this title.

**Caveat:** The status pill at `:7953-7955` is now redundant (every row is by definition active). Per RESEARCH §Pattern 4 note ("planner may simplify"), planner can remove the pill OR keep it for consistency — UI-SPEC §5 doesn't require removal. Smoke assertion will sentinel-check that `activeWatchparties()` literal appears inside this function's body.

---

### `state.activeWatchpartyMode` slot (and possibly `state.replayLocalPositionMs`, `state.pastPartiesShownCount`)

**Analog:** `state.activeWatchpartyId` at `js/state.js:7` (one-line `state` object initializer with all session slots)

**Source code excerpt** (`js/state.js:7`):
```javascript
export let state = { familyCode:null, me:null, members:[], titles:[], selectedMembers:[], couchMemberIds:[], searchResults:[], filter:'all', unsubMembers:null, unsubTitles:null, group:null, groups:[], pendingMode:null, selectedMoods:[], session:null, sessionDate:null, unsubSession:null, watchparties:[], unsubWatchparties:null, activeWatchpartyId:null, watchpartyTick:null, includePaid:false, serviceScope:'mine', librarySearchQuery:'', limitToServices:false, auth:null, actingAs:null, actingAsName:null, ownerUid:null, settings:null, unsubUserGroups:null, unsubSettings:null, unsubAuth:null };
```

**Edit:** Add `activeWatchpartyMode:null` (sibling to existing `activeWatchpartyId:null`). Phase 26 may also need `replayLocalPositionMs:null` (the local replay clock position used by `derivePositionForReaction` ctx for compounding) and `pastPartiesShownCount:null` (the pagination cursor for the Past parties surface). All three are simple single-value slots; same shape as existing slots; add inline.

**Caveat:** The `state` initializer is a single line — preserve the formatting style. Per RESEARCH §Standard Stack ("Existing pattern — every phase that adds session state extends this object"), no module split needed. Smoke assertion will sentinel-check that `activeWatchpartyMode` literal appears in `js/state.js`.

---

### `app.html` — replay scaffold (NO new IDs needed)

**Analog:** Phase 24 `#wp-video-surface` insertion at `app.html:1219` (the most recent additive change to the live modal scaffold)

**Source code excerpt** (`app.html:1212-1224`):
```html
<div class="modal-bg" id="wp-live-modal-bg">
  <div class="modal wp-live-modal" id="wp-live-content">
    <!-- Phase 24 / REVIEWS H1 — Persistent player surface (#wp-video-surface).
         Only touched by attachVideoPlayer / teardownVideoPlayer.
         renderWatchpartyLive MUST NOT touch #wp-video-surface. Empty by default;
         player innerHTML is written here once on attach and stays put across
         reaction/timer/snapshot re-renders. -->
    <div id="wp-video-surface" class="wp-video-surface"></div>
    <!-- Phase 24 / REVIEWS H1 — Re-renderable coordination surface (#wp-live-coordination).
         renderWatchpartyLive writes the existing live-modal HTML (header,
         reactions feed, footer) into #wp-live-coordination. Repaints freely on every state change. -->
    <div id="wp-live-coordination" class="wp-live-coordination"></div>
  </div>
</div>
```

**Pattern:** Per UI-SPEC §1, NO new HTML IDs are needed. The replay scrubber strip + revisit subline + position-aligned reactions feed all render as innerHTML inside the EXISTING `#wp-live-coordination` div via `renderWatchpartyLive`'s replay branch. Zero edits to `app.html`. The scaffold reuse is what D-06 explicitly requires.

**Caveat:** This row in PATTERNS.md is listed only because the orchestrator file list mentioned it. Confirm with planner: zero `app.html` edits expected for Phase 26.

---

### `css/app.css` — replay scrubber + revisit subline + past-watchparties-for-title

**Three analogs (mirror each):**

**1. Scrubber recipe** — `.wp-dvr-slider` family at `css/app.css:3117-3137`:
```css
.wp-dvr-slider{display:flex;align-items:center;gap:var(--s3);
  padding:var(--s3);background:var(--bg-deep);
  border-radius:var(--r-sm);margin-top:var(--s3)}
.wp-dvr-label{font-family:var(--font-sans);font-size:var(--t-meta);
  color:var(--ink-warm);font-weight:600;flex-shrink:0}
.wp-dvr-input{flex:1;height:22px;-webkit-appearance:none;appearance:none;
  background:transparent;outline:none;cursor:pointer}
.wp-dvr-input::-webkit-slider-runnable-track{height:6px;
  background:var(--surface);border-radius:3px}
.wp-dvr-input::-moz-range-track{height:6px;
  background:var(--surface);border-radius:3px}
.wp-dvr-input::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
  width:22px;height:22px;border-radius:50%;background:var(--accent);
  cursor:pointer;margin-top:-8px;
  box-shadow:0 2px 6px rgba(0,0,0,0.3)}
.wp-dvr-input::-moz-range-thumb{width:22px;height:22px;border-radius:50%;
  background:var(--accent);cursor:pointer;border:none;
  box-shadow:0 2px 6px rgba(0,0,0,0.3)}
.wp-dvr-readout{font-family:var(--font-sans);font-size:var(--t-meta);
  color:var(--ink);font-variant-numeric:tabular-nums;
  flex-shrink:0;min-width:80px;text-align:right}
```

**Phase 26 derivative:** `.wp-replay-scrubber-strip` family — identical shape, but bump dimensions per UI-SPEC §2 (28px thumb instead of 22px; 8px track instead of 6px; 56px container min-height; brand-gradient filled-track instead of solid `--accent`). Add the play/pause button as a separate `.wp-replay-playpause` 32×32 square with `--surface-2` background per UI-SPEC §Color.

**2. Modal scaffold** — `.wp-live-modal` family at `css/app.css:741-776` is the surrounding context. Phase 26 adds NO new modal recipe — the scrubber strip + revisit subline render INSIDE the existing modal. The new `.wp-live-revisit-subline` class is one line: `font-family:'Instrument Serif',serif;font-style:italic;color:var(--ink-warm);font-size:var(--t-meta);margin-top:2px;`.

**3. Title-detail row recipe** — `.past-parties-row` family at `css/app.css:4356-4402`:
```css
.past-parties-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid var(--ink-faint, #3a322a);
  cursor: pointer;
  min-height: 96px;
}
.past-parties-row:first-child { border-top: none; }
.past-parties-row:focus { outline: 2px solid var(--accent, #e8a04a); outline-offset: 2px; }
.past-parties-row:hover { background: rgba(232, 160, 74, 0.03); }
.past-parties-poster {
  width: 56px;
  height: 84px;
  border-radius: var(--r-sm, 8px);
  background-size: cover;
  background-position: center;
  background-color: var(--surface-2, #25201a);
  flex-shrink: 0;
}
.past-parties-body { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.past-parties-title { color: var(--ink, #f5ede0); font-size: 15px; font-weight: 400; ... }
.past-parties-meta { color: var(--ink-warm, #c9bca8); font-size: 13px; }
.past-parties-row-chevron { color: var(--ink-faint, ...); flex-shrink: 0; font-size: 16px; }
```

**Phase 26 derivative:** `.past-watchparty-row` family for the title-detail section — same shape, but per UI-SPEC §Spacing dimensions: poster 48×72 (smaller than past-parties surface's 56×84), min-height 72px (smaller than 96px), accent border at 0.18 alpha on poster (per UI-SPEC §Color "Accent reserved for #5"). Subtitle uses `--ink-warm` (NOT `--ink-dim`) per the same contrast precedent locked in `.past-parties-meta` line 4395.

**Caveat:** Per UI-SPEC §3 ("Phase 26 introduces zero new color tokens; reuses existing semantic tokens"), all colors must be existing aliases — no hex literals, no new tokens. Per UI-SPEC §Spacing Scale, all spacing uses existing `--space-*` aliases.

---

### `scripts/smoke-position-anchored-reactions.cjs` — NEW (test, smoke)

**Analog:** `scripts/smoke-native-video-player.cjs` (Phase 24 — most recent smoke; closest data-flow + helper-location pattern)

**Source code excerpt** (`scripts/smoke-native-video-player.cjs:38-119`):
```javascript
'use strict';
const fs = require('fs');
const path = require('path');

let fails = 0;
function eq(label, got, want) {
  const ok = got === want;
  if (!ok) { console.error('FAIL ' + label + ': got ' + JSON.stringify(got) + ' want ' + JSON.stringify(want)); fails++; }
  else { console.log('OK   ' + label); }
}
function truthy(label, got) { /* ... */ }
function falsy(label, got) { /* ... */ }
function deep(label, got, want) { /* ... */ }
function contains(label, haystack, needle) {
  const ok = String(haystack).indexOf(needle) !== -1;
  if (!ok) { console.error('FAIL ' + label + ': "..." does not contain "' + needle + '"'); fails++; }
  else { console.log('OK   ' + label); }
}
function not_contains(label, haystack, needle) { /* ... */ }

(async () => {
  // Production-module import (REVIEWS H2 fix)
  const moduleUrl = require('url').pathToFileURL(path.resolve(__dirname, '..', 'js/native-video-player.js')).href;
  const m = await import(moduleUrl);
  const { parseVideoUrl, /* ... */, STALE_BROADCAST_MAX_MS } = m;
  // ...
```

**Pattern to copy:**
- CommonJS `'use strict'` + `require('fs')` + `require('path')` header
- Same 6 assertion helpers (`eq`, `truthy`, `falsy`, `deep`, `contains`, `not_contains`)
- Same async IIFE wrapper for `await import()` of ES modules
- Same `pathToFileURL(path.resolve(__dirname, '..', 'js/...'))` shape for cross-platform module URL construction
- Same `fs.readFileSync(path.resolve(__dirname, '..', 'js/app.js'), 'utf8')` for production-code sentinels
- Same `if (fails) { ... process.exit(1); } else { ... process.exit(0); }` exit pattern

**Phase 26 specifics:**
- DIFFERENCE from Phase 24: the helper `derivePositionForReaction` lives INSIDE `js/app.js` (NOT a separate ES module). Per RESEARCH §Standard Stack recommendation (lines 173-174), MIRROR the helper inline in the smoke file (matches Phase 20 `smoke-decision-explanation.cjs` pattern at `scripts/smoke-decision-explanation.cjs:42-110`). The smoke runs the inline mirror against fixtures, AND uses `fs.readFileSync` sentinel checks to verify the same shape exists in production source.
- Production-source sentinels (≥6 per RESEARCH §Validation Architecture lines 824-846): `runtimeSource:` literal, `runtimePositionMs` literal, `wp.status === 'archived'` literal in `renderWatchpartyLive`, `mode: 'revisit'` literal in ≥2 sites, `replayableReactionCount` function declaration, `STALE_BROADCAST_MAX_MS` import. Plus negative sentinels: `autoplay` should NOT appear in production (UI-SPEC §6).
- Helper-behavior assertions (≥5): the 4-state hybrid + the `'replay'` compounding case per UI-SPEC §7.
- Replay-list filter assertions (≥2): `replayableReactionCount` predicate behavior on the 4-source enum + pre-Phase-26 `{}` reaction.
- Floor: ≥13 assertions per UI-SPEC §7. Researcher recommends ≥20 for robust coverage.

**Caveat:** Per RESEARCH §Standard Stack table line 174 ("Researcher recommends: mirror inline in smoke"), do NOT pollute global scope with `window.derivePositionForReaction = ...` just for testing. The helper stays a regular `function` inside `js/app.js`; the smoke mirrors its body inline. This matches Phase 20's `buildMatchExplanation` pattern.

---

### `scripts/deploy.sh` §2.5 addition

**Analog:** Phase 24 wiring at `scripts/deploy.sh:117-120`

**Source code excerpt** (`scripts/deploy.sh:113-121`):
```bash
if [ -f scripts/smoke-sports-feed.cjs ]; then
  node scripts/smoke-sports-feed.cjs > /dev/null \
    || { echo "ERROR: smoke-sports-feed failed -- aborting deploy." >&2; exit 1; }
fi
if [ -f scripts/smoke-native-video-player.cjs ]; then
  node scripts/smoke-native-video-player.cjs > /dev/null \
    || { echo "ERROR: smoke-native-video-player failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed + native-video-player)."
```

**Edit:** Append a 4-line `if [ -f ... ]; then ... fi` block immediately after the `smoke-native-video-player.cjs` block (between line 120 and the `echo` at 121). Update the trailing `echo` string to mention the new smoke. Mirror exactly:
```bash
if [ -f scripts/smoke-position-anchored-reactions.cjs ]; then
  node scripts/smoke-position-anchored-reactions.cjs > /dev/null \
    || { echo "ERROR: smoke-position-anchored-reactions failed -- aborting deploy." >&2; exit 1; }
fi
```

**Caveat:** None — direct paste-and-substitute. The deploy gate is the canonical run-on-deploy check; per RESEARCH §Validation Architecture this is the ONLY change needed to wire Phase 26's smoke into the deploy pipeline.

---

### `package.json` smoke entry

**Analog:** Phase 24 entries at `package.json:13` (`smoke:native-video-player`) and the aggregate `smoke` script at line 7

**Source code excerpt** (`package.json`):
```json
"smoke": "node scripts/smoke-position-transform.cjs && node scripts/smoke-tonight-matches.cjs && node scripts/smoke-availability.cjs && node scripts/smoke-kid-mode.cjs && node scripts/smoke-decision-explanation.cjs && node scripts/smoke-conflict-aware-empty.cjs && node scripts/smoke-sports-feed.cjs && node scripts/smoke-native-video-player.cjs",
"smoke:position": "node scripts/smoke-position-transform.cjs",
...
"smoke:native-video-player": "node scripts/smoke-native-video-player.cjs",
"smoke:sports-feed": "node scripts/smoke-sports-feed.cjs"
```

**Edit:** Append `&& node scripts/smoke-position-anchored-reactions.cjs` to the aggregate `smoke` script. Add a new line entry: `"smoke:replay": "node scripts/smoke-position-anchored-reactions.cjs"` (or `smoke:position-anchored-reactions` for verbosity — pick whichever; existing entries use shortened keys).

**Caveat:** The `smoke` aggregate uses `&&` chaining — if any one smoke fails, the rest don't run. Per the deploy gate pattern at `scripts/deploy.sh:89-120`, each smoke is its own `if [ -f ... ]; then` block and they all run regardless. The two are intentionally redundant; both should be updated.

---

### `sw.js` CACHE bump

**Analog:** `sw.js:8` `const CACHE = 'couch-v37-native-video-player';` (Phase 24)

**Source code excerpt** (`sw.js:1-13`):
```javascript
// Couch service worker — drop this in the same folder as app.html + landing.html.
// ...
// Bump CACHE whenever you ship user-visible app changes so installed PWAs invalidate and
// re-fetch the shell. Version naming convention: couch-v{N}-{milestone-or-fix-shorthand}.

const CACHE = 'couch-v37-native-video-player';
// Post-Phase-9 routing: landing.html at /, app.html at /app (via Firebase Hosting rewrites).
const SHELL = ['/app', '/css/app.css', '/js/app.js'];
```

**Pattern:** Per CLAUDE.md ("auto-bumped via `bash scripts/deploy.sh <short-tag>`"), the planner does NOT manually edit `sw.js`. The deploy script does the substitution from a CLI arg. Phase 26 deploy command: `bash scripts/deploy.sh 38-async-replay` → produces `couch-v38-async-replay`.

**Caveat:** RPLY-26-18 (per RESEARCH §Phase Requirements line 114) is a manual-verification gate — after deploy, grep `sw.js` to confirm the CACHE constant landed. No code edit by planner. Smoke could optionally sentinel-check `couch-v38-` prefix in `sw.js` post-deploy.

---

## Shared Patterns

### Production-source sentinel pattern

**Source:** `scripts/smoke-native-video-player.cjs:236-275` (the production-code sentinels block at the bottom)
**Apply to:** All ≥6 sentinel assertions in the new `scripts/smoke-position-anchored-reactions.cjs`

```javascript
let appJs = '';
try {
  appJs = fs.readFileSync(path.resolve(__dirname, '..', 'js/app.js'), 'utf8');
} catch (e) {
  console.warn('NOTE: could not read js/app.js (' + e.message + ') — sentinel checks skipped');
}
if (appJs) {
  contains('js/app.js contains runtimeSource (Phase 26 schema)', appJs, 'runtimeSource');
  contains('js/app.js contains runtimePositionMs (Phase 26 schema)', appJs, 'runtimePositionMs');
  contains('js/app.js contains wp.status === \'archived\' branch in renderWatchpartyLive', appJs, /* ... */);
  // ... 3+ more sentinels
}
```

### Pure helper inline-mirror pattern (for smoke testing)

**Source:** `scripts/smoke-decision-explanation.cjs:42-110` (the `function buildMatchExplanation(...)` mirror inside the smoke file)
**Apply to:** `derivePositionForReaction`, `getScrubberDurationMs`, `replayableReactionCount`, `friendlyPartyDate` — all 4 NEW helpers live inside `js/app.js` and the smoke mirrors their bodies inline rather than `await import()`-ing them

### Optimistic-write + Firestore-arrayUnion pattern

**Source:** `js/app.js:11949-11952` (the `postReaction` write recipe — already established Phase 7 pattern)

```javascript
await updateDoc(watchpartyRef(wp.id), { reactions: arrayUnion(reaction), lastActivityAt: Date.now(), ...writeAttribution() });
// Local optimistic refresh — snapshot will overwrite this imminently
wp.reactions = [...(wp.reactions || []), reaction];
renderWatchpartyLive();
```

**Apply to:** Both `postReaction` (Phase 26 modification) and `postBurstReaction` (Phase 26 modification). The `arrayUnion` write + optimistic local mutation + sync re-render is the canonical reaction-write pattern; Phase 26 adds two fields to the reaction object but preserves the write recipe verbatim.

### Branch-by-mode-flag-inside-render-fn pattern

**Source:** `js/app.js:11431` (`isSport = !!wp.sportEvent`) + `js/app.js:11437` (`isReplay`-equivalent: `if (titleHasNonDrmPath(_t)) headerExtraClass = ' wp-live-header--has-player'`) inside `renderWatchpartyLive`

**Apply to:** The replay-variant branch in `renderWatchpartyLive` — same shape (`const isReplay = state.activeWatchpartyMode === 'revisit'` early in the function; ternaries throughout the body for chrome swaps; `&& !isReplay` guards on the call sites that should be hidden).

### Single-line `state` slot addition pattern

**Source:** `js/state.js:7` (the comma-separated `state` object initializer — every phase adds slots inline)

**Apply to:** The new `activeWatchpartyMode:null` (and possibly `replayLocalPositionMs:null`, `pastPartiesShownCount:null`) slots — append to the existing one-line initializer, sibling to `activeWatchpartyId:null`.

---

## No Analog Found

**None.** Every Phase 26 surface has a strong analog elsewhere in the codebase. The architecture predicted this — Phase 26 is intra-codebase work on top of three already-shipped foundations (Phase 7 reactions, Phase 15.5 Past parties, Phase 24 broadcast schema). RESEARCH §Summary (line 11) explicitly notes "Every architectural decision needed for the planner is already locked … the research surface is small because the design surface is already closed."

---

## Metadata

**Analog search scope:**
- `js/app.js` (~16k lines) — Grep + targeted Read(offset/limit) per CLAUDE.md token-cost rule
- `js/state.js` (14 lines) — full read
- `js/native-video-player.js` (177 lines) — full read
- `css/app.css` — Grep + targeted Read for `.wp-live-modal`, `.wp-dvr-slider`, `.past-parties-*` families
- `app.html` — Grep for live-modal scaffold
- `sw.js` — full read (head)
- `scripts/deploy.sh` — Grep + targeted Read of §2.5 smoke gate
- `package.json` — full read
- All 8 existing `scripts/smoke-*.cjs` files — Glob + targeted Read of `smoke-native-video-player.cjs` (closest analog) + `smoke-decision-explanation.cjs` (inline-mirror analog)

**Files scanned (full read or targeted offsets):** 9 files
**Token budget for `js/app.js`:** held to ~600 lines across 9 targeted reads (vs 16,000-line full read = ~190K tokens) per CLAUDE.md mandate.

**Pattern extraction date:** 2026-05-01
