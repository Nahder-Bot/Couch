---
phase: 14-decision-ritual-core
researched: 2026-04-25
domain: Firestore lifecycle primitives + DOM-driven UI redesign + push-notification fan-out
confidence: HIGH (existing Couch patterns are the primary source; almost all claims are file:line verified)
researcher: gsd-phase-researcher
input-context: .planning/phases/14-decision-ritual-core/14-CONTEXT.md (12 locked decisions D-01..D-12)
---

# Phase 14 — Decision Ritual Core / Research

## DECISION-RECONCILE callouts (planner: address before minting requirements)

Three of the 12 locked decisions conflict with existing shipped behavior. None invalidates the decision; each requires the planner to either widen the scope, tighten the migration story, or rename a primitive to avoid collision. Surface these to the user at /gsd-plan-phase 14 review, before any DECI-* requirement is locked.

### DR-1 — D-09 collides with the existing Phase 8 `intents` collection

D-09 specifies a NEW Firestore subcollection `watchpartyIntents/{intentId}` with a fresh schema (flow / creatorId / titleId / proposedStartAt / expectedCouchMemberIds / rsvps / status / convertedToWpId / counterChainDepth). But Phase 8 already shipped a sibling primitive at `families/{code}/intents/{id}` covering two flow types (`tonight_at_time` + `watch_this_title`) with overlapping but not identical fields:

- **Existing collection path:** `families/{familyCode}/intents/{intentId}` — declared at js/app.js:1387 (`function intentsRef()`); rules at firestore.rules:338-364; CF triggers `onIntentCreated` (queuenight/functions/index.js:354) and `onIntentUpdate` (index.js:408); expiry sweep already wired into `watchpartyTick` at index.js:494-512.
- **Existing fields** (per js/app.js:1418-1437 `createIntent`): `id, type, titleId, titleName, titlePoster, createdBy, createdByName, createdByUid, createdAt, creatorTimeZone, rsvps{[memberId]:{value,at,actingUid,memberName}}, thresholdRule, status('open'|'matched'|'expired'|'cancelled'|'converted'), expiresAt, proposedStartAt?, proposedNote?`.
- **D-09's proposed fields** add: `flow:'rank-pick'|'nominate'`, `expectedCouchMemberIds[]`, `counterChainDepth`, `convertedToWpId`, `rsvps[].state` (different shape — has 'in'|'reject'|'drop'|'maybe' instead of 'yes'|'no'|'maybe'|'later'), `rsvps[].counterTime`, `rsvps[].counterTitleId`.

**Three viable resolutions for the planner:**

1. **Extend the existing `intents` collection** with new `flow` field + new rsvp `state` enum + counter-chain fields. Pro: one schema, one CF, one rules block. Con: the existing 'yes'/'no'/'maybe'/'later' rsvp values diverge from D-07's 'in'/'reject'/'drop'/'maybe' — would need a migration of in-flight intents OR a `flow`-keyed branch in renderers/CFs.
2. **Add a separate `watchpartyIntents` collection** as D-09 literally says. Pro: clean break, no schema migration risk. Con: two parallel intent primitives in the codebase; new firestore.rules block; new CF triggers; risk of UI confusion (two "intent" concepts).
3. **Rename the existing collection to `flowBIntents` (or migrate it into Phase 14's new schema as the `nominate` flow)** since Flow B's behavior (D-08: nominate title + propose time + member RSVPs + auto-convert at T-15) is essentially what `intents/type=tonight_at_time` already does. Then mint `watchpartyIntents` with both flows. Pro: zero parallel concepts. Con: data migration of any open Phase 8 intents in production.

**Recommendation:** Option 1 (extend) — lowest risk, preserves shipped Phase 8 behavior, and the `flow` discriminator is exactly the kind of polymorphism D-09 calls for. The 'state' enum mismatch is solvable by accepting both vocabularies on read and normalizing internally; new writes use the D-07/D-08 vocabulary keyed by `flow`.

### DR-2 — D-03's "per-member queue primitive" is already shipped

D-03 declares the per-member queue is a NEW primitive. It isn't — the per-member queue and Yes-vote unification both already work in production:

- Schema: each title has a `queues: { [memberId]: rank }` map ON THE TITLE DOC (not a separate subcollection). Reader: `getMyQueueTitles()` at js/app.js:6827.
- Yes-vote unification (D-03's Q2 resolution) is **already implemented** at js/app.js:12340-12350 in `applyVote`: when a member votes Yes, if the title isn't already in their queue, it appends at the bottom of their personal queue. When the vote flips to No or is cleared, it removes from queue. This is exactly D-03's stated behavior.
- Drag-to-reorder is **already implemented** at js/app.js:4664 (`attachQueueDragReorder`), with persist at js/app.js:4648 (`persistQueueOrder`) and reindex at js/app.js:6834 (`reindexMyQueue`). Surfaces in Library tab when `state.filter === 'myqueue'` (js/app.js:4495).

**What D-03 actually adds** (and what the planner should focus on):
- Tier 1 sort uses "average of member-queue ranks" — needs a new aggregator function (existing `getGroupNext3` at js/app.js:6852 uses a *different* weighted score: `1/rank` summed across members, not arithmetic mean of ranks). Planner: add `getTierOneRanked()` or extend `getGroupNext3` with a sort-mode param.
- Discoverability for the Yes→queue auto-add (Anti-pattern #5 in CONTEXT): existing applyVote silently mutates queues; users may not realize their Yes vote re-ordered their queue. Plan should add a toast or inline animation.
- "Adding from Add tab pushes to bottom of personal queue + family library" — verify this is wired (Add-tab path may currently only append to family library without queue insertion). Planner search target: any addDoc to titlesRef inside Add-tab handlers.

**Net:** D-03 is a polish + tier-sort addition, not a primitive build. The plan title "Per-member queue primitive" is misleading — recommend renaming to "Per-member queue surfacing + tier-1 ranked aggregation" at /gsd-plan-phase 14.

### DR-3 — Phase 12 NOTIF_UI_TO_SERVER_KEY map is for UI-key aliasing, not the allowlist

CONTEXT.md research-target #5 says "the seven new push categories must be added to the server-side `NOTIFICATION_PREFS_ALLOWLIST` AND the client-side UI list `NOTIF_UI_TO_SERVER_KEY`." There is no `NOTIFICATION_PREFS_ALLOWLIST` constant in either repo (verified by grep across js/ and queuenight/functions/). The actual allowlist is `NOTIFICATION_DEFAULTS` in queuenight/functions/index.js:74-84 (server-side) and `DEFAULT_NOTIFICATION_PREFS` in js/app.js:100-110 (client-side). `NOTIF_UI_TO_SERVER_KEY` (js/app.js:128-135) is a separate concept: it maps Phase-12 friendly UI keys onto the original Phase-6 server keys for legacy compatibility — it does NOT gate which event types are accepted.

Planner: the seven new D-12 categories must be added in **three** places, not two:

1. `DEFAULT_NOTIFICATION_PREFS` at js/app.js:100 — controls UI default + which keys `getNotificationPrefs()` will return.
2. `NOTIFICATION_DEFAULTS` at queuenight/functions/index.js:74 — controls which event types the `sendToMembers(..., {eventType})` call will read prefs for. **If a new eventType is missing here, `sendToMembers` falls back to `defaultOn=true` per the `hasDefault` check at index.js:114** — pushes will go through but with a constant "default true" regardless of user pref. Net effect: the user toggle exists in UI but is ignored on the server. Adding to this map is mandatory.
3. `NOTIFICATION_EVENT_LABELS` at js/app.js:113 — controls Settings-screen UI render. Without this, the toggle has no label.

Optional fourth touch: `NOTIF_UI_TO_SERVER_KEY` (js/app.js:128) and `NOTIF_UI_LABELS` (js/app.js:139) — only relevant if the new categories are added to the Phase 12 friendly-UI list rather than the legacy server-keyed Settings list. Planner should pick one and stick to it; mixing the two will produce two settings screens that disagree.

---

## 1. Existing `watchparty` Firestore schema + CF patterns

### What's there

- **Schema location:** `families/{familyCode}/watchparties/{wpId}` — declared at js/app.js:1380 (`watchpartiesRef()`).
- **Lifecycle states (3, not 4):** `scheduled` → `active` → `archived`. NO 'lobby' or 'ended' states — Phase 11's Lobby-flow is rendered as a UI sub-state of `scheduled` (status stays 'scheduled' until startAt; "lobby" is just the last-30s window). Reference: queuenight/functions/index.js:454 (scheduled→active flip) and index.js:480 (active+empty+stale→archived flip).
- **Watchparty doc fields** (inferred from CF at functions/index.js:155-194 + index.js:200-234): `status, hostId, hostUid, hostName, titleId, startAt, startedAt, lastActivityAt, creatorTimeZone, archivedAt, archivedReason, participants:{[memberId]:{ready,...}}`.
- **Push fan-out CFs:** `onWatchpartyCreate` at functions/index.js:153 (notify everyone except host on schedule), `onWatchpartyUpdate` at index.js:198 (notify all RSVPs on status flip to 'active', forces through quiet hours), and the safety-net sweeper `watchpartyTick` at index.js:435 (every-5-min onSchedule trigger that handles late flips, stale-archive, empty-active-archive, AND piggybacks intent expiry).

### Reusable CF helpers (mostly ALL reusable for watchpartyIntent)

| Helper | Location | Reusable for D-09? |
|---|---|---|
| `sendToMembers(familyCode, memberIds, payload, options)` | functions/index.js:92 | ✅ YES — handles VAPID config, dead-sub pruning, eventType pref gate, quiet-hours gate, excludeUid/excludeMemberId self-echo guard. The seven new D-12 eventTypes plug straight into the `eventType` option. |
| `isInQuietHours(qh)` | functions/index.js:45 | ✅ YES — already invoked inside sendToMembers; new categories inherit. |
| `NOTIFICATION_DEFAULTS` map | functions/index.js:74 | ⚠️ MUST ADD seven D-12 keys (see DR-3). |
| `configureWebPush()` | functions/index.js:29 | ✅ YES — VAPID env-var loader; module-scoped, reused across all triggers. |
| Per-doc try/catch around `doc.ref.update` | functions/index.js:454-490 (watchpartyTick body) | ✅ Pattern reusable for `watchpartyIntentTick` — copy the per-family iteration + per-doc error handle pattern verbatim. |
| Already-deployed intent sweep at index.js:494-512 | functions/index.js:494 | ⚠️ ALREADY HANDLES INTENT EXPIRY for the existing `intents` collection. If DR-1 resolution is "extend existing collection" (recommended), this sweep needs to extend to handle the new lifecycle states ('rank-pick' counter-chain expiry + auto-convert at T-15 + reject-majority retry). If DR-1 resolution is "new collection", a parallel sweeper inside the same `watchpartyTick` is the cleanest add (one CF, multiple branches per family iteration). |

### Watchparty UI patterns to reuse for intent UI

- `state.unsubWatchparties` + onSnapshot pattern at js/app.js:3566-3600 — sets up a real-time listener on the family's watchparties subcollection; `maybeFlipScheduledParties` (js/app.js:3580) fires client-side flips as a complement to the CF safety net. Mirror this with `state.unsubWatchpartyIntents` for D-09.
- `maybeNotifyWatchparties` at js/app.js:3582 — local-tab notification dispatch for users with the app open in the background. Mirror for intent state changes (e.g., reject-majority hits, counter-time arrives).

### What to add

- New CF: `watchpartyIntentTick` (or extend existing watchpartyTick branch — recommended per CONTEXT D-09 cadence comment "matches existing watchpartyTick pattern"). Responsibilities: hard-expire at 11pm same-day (Flow A) or T+4hr (Flow B), auto-convert intent→watchparty at T-15min if any Yes RSVPs (Flow B), promote reject-majority retry (Flow A).
- New CF triggers (or extension of existing onIntentCreated/onIntentUpdate per DR-1): seven new eventTypes mapped to D-12 push templates.
- firestore.rules block — if new collection per DR-1 Option 2; otherwise extend existing /intents/{intentId} block at firestore.rules:338-364 to allow new fields + new status transitions ('open' → 'open' for counter-chain depth increments).

### Open question

- D-09 specifies `counterChainDepth: number` (cap at 3) — but Flow B's counter-time mechanic (D-08.3) is also a counter, and CONTEXT.md doesn't explicitly cap Flow B counter-time depth. Planner should clarify: does the 3-level cap apply only to Flow A counter-nomination, or to both flows? Recommend cap-both for symmetry.

---

## 2. Existing tile rendering

### What's there

- **Tile factory:** `function card(t)` at js/app.js:4333 (line 4333 is the function declaration; full body extends to line 4486). Returns an HTML string for one title tile. Returned markup uses the `.tc` (title-card) CSS namespace. Called from `renderLibrary` (js/app.js:4488), the Tonight tab (search via `renderTonight` at js/app.js:4124), and elsewhere via state.titles iteration.
- **Tile face content** (js/app.js:4470-4485):
  - `.tc-poster` — backdrop poster with fallback letter
  - `.tc-name` — badges + ratingPill + escaped title text
  - `.tc-meta` — year · runtime · stars/yes-count · TV progress pill · TV status badge · mood dots
  - `.tc-providers` — up to 4 streaming logos + Rent/Buy paid pill (js/app.js:4368-4398)
  - notes block (scheduled, blocked, veto, approval) (js/app.js:4419-4456)
  - `.tc-vote-strip` — per-member vote chips (✓✗👁) (js/app.js:4423-4428)
  - `.tc-footer` containing `.tc-primary` (Vote button — D-04 demotes this) and `.tc-more` (⋯ → openActionSheet) (js/app.js:4480-4483)
- **Tile primary action:** clicking the body of `.tc` opens detail modal via `onclick="openDetailModal('${t.id}')"` (js/app.js:4469). The Vote button explicitly stops propagation. The ⋯ button calls `openActionSheet(titleId, event)` at js/app.js:4482.
- **Action sheet:** rendered by `window.openActionSheet` at js/app.js:11853. Existing items (read at js/app.js:11860-11894):
  - Log a watch / Edit-or-Write review (watched titles)
  - Schedule (unwatched)
  - Open watchparty / Start a watchparty (existing intents/watchparty branching)
  - **Propose tonight @ time** (already exists; calls `openProposeIntent`)
  - **Ask the family** (already exists; calls `askTheFamily`)
  - Undo veto / Not tonight
  - Watch trailer / Comments / Add to list / Share
  - Mark watched-or-unwatched / Edit details / Remove
- DOM container: `<div id="action-sheet-bg">` + `<div id="action-sheet-content">` toggled with `.on` class. CSS: `.action-sheet-item` exists in css/app.css (verified — see Q1 result above).

### What's reusable for D-04

- **The action sheet primitive ALREADY EXISTS.** D-04's "tile primary action sheet (single tap on tile body)" can repurpose `openActionSheet`. Currently the action sheet opens via the ⋯ button (more-options); D-04 promotes it to be the primary tile body tap target instead of going to detail modal. This is a 2-line wiring change at js/app.js:4469: swap `openDetailModal` for a new `openTileActionSheet` that filters items down to the four D-04 buckets (Watch tonight / Schedule / Ask family / Vote), with "Show details" demoted to a secondary entry.
- The detail modal (`openDetailModal`) becomes the home for "Hidden-behind-⋯ items now surfaced": Trailer (lazy-loaded), Providers, Synopsis, Cast, Reviews. Detail-modal renderer location: search target — grep `function openDetailModal` and `function renderDetail` (not located in this research session — recommend planner search).
- `.tc` CSS class hierarchy (css/app.css — search `.tc-name`, `.tc-poster`, etc. — not exhaustively read this session) is the single point of style ownership for tiles. D-04's "X want it" pill + 3 micro-avatars + +N overflow chip is a new render path inside `card(t)` plus new CSS rules under `.tc-want-pill` (or similar).

### What to add

- **New "X want it" pill renderer:** consume `t.queues` (already exists) — count members with this title in their queue, render 3 micro-avatars (member doc has `avatarUrl` or initials fallback) + "+N" if count > 3. Insert into the meta block, replacing or supplementing the existing `${yesCount} 👍` pill at js/app.js:4353.
- **Trailer button on tile face** — D-04 surfaces a ▶ button. The trailerKey field already exists on title docs (referenced at js/app.js:11886).
- **Vote button removal from tile face** — delete the `primaryBtn` Vote case at js/app.js:4466. Vote moves to action sheet (already an option there per js/app.js:11862-11891 includes Mark watched + ratings — Vote slots in alongside).

### Open question

- The carry-over UAT bug ("when clicking a show in here it wasn't easy to click out — ✕ scrolls out of view") affects the detail modal, not the action sheet. CONTEXT capture says fix candidate is `position:fixed` on `.detail-close`. Planner: assign as 14-05 sub-task or split into a follow-up — both reasonable.

---

## 3. Drag-reorder libraries

### What's there

- **Hand-rolled HTML5 drag-and-drop is already shipped.** `attachQueueDragReorder(container, myQueue)` at js/app.js:4664-4705 attaches dragstart/dragend/dragover/dragleave/drop handlers per `.full-queue-row`. Works in Library tab when filter='myqueue'.
- Persistence flow: `persistQueueOrder(reordered)` at js/app.js:4648-4661 → batch-updates each title's `queues[memberId]` rank.
- Visual styling: `.full-queue-row.dragging`, `.drag-over-top`, `.drag-over-bottom` (CSS classes referenced at js/app.js:4669, 4674, 4681).

### What's reusable

- The whole pattern is reusable as-is. D-03's drag-reorder requirement is **fully implemented in production** (DR-2). Planner needs to verify it works on iOS Safari (HTML5 DnD has historical iOS issues — confirm with UAT) and decide whether to consume it as-is or upgrade.

### Library evaluation (per CONTEXT research target)

| Option | Pro | Con | Recommendation |
|---|---|---|---|
| **Keep hand-rolled HTML5 DnD** (current) | Already shipped, zero deps, zero bundle cost, matches Couch's vanilla-JS posture per CLAUDE.md | iOS Safari historically flaky for HTML5 DnD on touch — may already be silently broken on the primary surface. Need UAT on iOS PWA before committing. | **Default position: keep, but UAT-test on iOS first.** If iOS-broken, pick option 2. |
| `interact.js` | Battle-tested, touch-first, supports drag + resize + gestures, no jQuery, ~30KB minified | Adds a runtime dep (loaded via `<script src>` since no bundler), slightly larger surface than needed | Use IF iOS UAT fails. Load via `<script>` tag in app.html, no module wrapper needed. |
| Sortable.js | Industry standard, ~25KB minified, native touch support | Adds dep + similar tradeoff to interact.js; no clear advantage | Equal alternative to interact.js if interact's touch handling underperforms. |
| Pure pointer-events rewrite | Modern API, full touch support, no deps | Engineering cost; no advantage over a tested library | Skip unless we hit a specific failure mode. |

**Recommendation for D-03:** Verify current implementation on iOS Safari at /gsd-sketch UAT. If it works, no library change needed. If broken, port to **Sortable.js** (slightly cleaner API than interact.js and tighter focus on the actual problem: list reordering). Load via `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js">` in app.html — Couch already loads external scripts (Firebase SDK) this way.

### Open question

- Does the current HTML5 DnD work on iOS Safari? Not verified this session — recommend explicit UAT step at sketch round.

---

## 4. SVG sofa rendering approaches

### What's there

- No existing sofa/couch SVG asset in the repo (grepped svg/sofa/couch/cushion across files — only matches are markdown docs and the `🛋️` emoji at js/app.js:4592 in the empty-queue placeholder).
- app.html and landing.html contain only minimal SVG (icon set referenced via PWA manifest; no large inline SVG patterns).
- No existing inline SVG event-binding pattern in the codebase to reuse.

### What's reusable

- Nothing direct. This is a green-field render path. Couch's general DOM-event pattern (`onclick="..."` inline handlers, e.g. js/app.js:4469, 4482) translates fine to SVG: `<g class="cushion" onclick="claimCushion(0)">...</g>`.

### What to add

- **Inline SVG is the right call** for D-06. Per-cushion event binding requires per-element DOM handles, which is trivial with inline `<svg><g onclick=...>` but impossible with `<img src="couch.svg">` (the image is opaque to JS). Confirmed.
- iOS PWA gotchas to budget for:
  - **Touch-target sizing:** Apple HIG requires min 44×44pt tappable areas. Cushion `<g>` elements need to be at least that size on the smallest supported viewport (iPhone SE width ~375px → cushions need at least ~12% of viewport width per cushion at 8 cushions max).
  - **SVG scaling:** use `viewBox` + `preserveAspectRatio="xMidYMid meet"` to scale predictably across viewports; avoid hardcoded pixel dimensions on `<svg>` itself.
  - **Avatar circle compositing:** stamping `<image>` (raster avatar URLs) inside SVG works but iOS Safari has occasional caching quirks for cross-origin SVG `<image>` href — load avatars as base64 data URLs OR position absolute-DOM `<img>` elements over the SVG positioned via CSS grid/transform. Recommend the latter (DOM-on-top) for simpler caching + accessibility.
  - **No filter:url(#...) effects on iOS PWA WebKit before iOS 17.** D-06 SVG should avoid SVG filter primitives; rely on CSS box-shadow/filter for any glow.
- Adaptive seat count (D-06 cap at 8): planner should pre-compute `viewBox` width per seat-count or build the SVG procedurally in JS at render time. The latter is simpler — `renderCouchSvg(seatCount)` returns a DocumentFragment with N cushions + 1 overflow if N > 7.

### Open question

- Is avatar composited in-SVG or as a CSS-positioned overlay? Defer to /gsd-sketch round (D-06 is sketch-driven design).

---

## 5. Phase 6 notifPrefs allowlist

### What's there

- **Server-side defaults map:** `NOTIFICATION_DEFAULTS` at queuenight/functions/index.js:74-84. Currently 8 keys: watchpartyScheduled, watchpartyStarting, titleApproval, inviteReceived, vetoCapReached, tonightPickChosen, intentProposed, intentMatched.
- **Server-side enforcement:** `sendToMembers()` at functions/index.js:92, eventType handling at lines 110-126. The block:
  ```
  if (eventType && memberData.uid) {
    const userSnap = await db.collection('users').doc(memberData.uid).get();
    const prefs = (userSnap.exists && userSnap.data().notificationPrefs) || {};
    const hasDefault = Object.prototype.hasOwnProperty.call(NOTIFICATION_DEFAULTS, eventType);
    const defaultOn = hasDefault ? NOTIFICATION_DEFAULTS[eventType] : true;
    const prefValue = (prefs[eventType] === undefined) ? defaultOn : !!prefs[eventType];
    if (!prefValue) continue;
    ...
  }
  ```
  Note: when `hasDefault === false`, `defaultOn === true` — so unknown eventTypes default-send. Adding a new eventType to NOTIFICATION_DEFAULTS is what makes it user-toggleable.
- **Client-side defaults:** `DEFAULT_NOTIFICATION_PREFS` at js/app.js:100-110 — same 8 keys, used by `getNotificationPrefs()` at js/app.js:225 and `updateNotificationPref()` at js/app.js:230.
- **Client-side UI labels:** `NOTIFICATION_EVENT_LABELS` at js/app.js:113-122.
- **Phase 12 friendly-UI alias map:** `NOTIF_UI_TO_SERVER_KEY` at js/app.js:128-135 maps 6 UI-keys onto Phase-6 server keys for legacy compat. Used at js/app.js:1043 in the Settings UI render branch.
- **Phase 12 friendly-UI labels:** `NOTIF_UI_LABELS` at js/app.js:139-146.
- **Phase 12 friendly-UI defaults:** `NOTIF_UI_DEFAULTS` at js/app.js:148-155.

### What's reusable

The whole infrastructure. Add the seven D-12 categories to:
1. **`NOTIFICATION_DEFAULTS`** at functions/index.js:74 — server-side gate.
2. **`DEFAULT_NOTIFICATION_PREFS`** at js/app.js:100 — client-side merge baseline.
3. **`NOTIFICATION_EVENT_LABELS`** at js/app.js:113 — Settings-screen labels and hints.

Choose ONE of these UI patterns:
- A) Add to legacy Settings list only — cleanest, but won't appear in Phase 12 friendly UI.
- B) Add to BOTH Phase 12 friendly UI (`NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS` at js/app.js:128-155) and the legacy list — appears in both UIs. Recommended: pick one Settings UI surface and stick with it. Per Phase 12 POL-01 the friendly UI is the canonical one.

### Exact diff shape

**Server (queuenight/functions/index.js:74-84) — append seven keys:**

```js
const NOTIFICATION_DEFAULTS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  intentProposed: true,
  intentMatched: true,
  // Phase 14 — Decision Ritual Core (D-12)
  flowAPick: true,
  flowAVoteOnPick: true,
  flowARejectMajority: true,
  flowBNominate: true,
  flowBCounterTime: true,
  flowBConvert: true,
  intentExpiring: true
});
```

**Client (js/app.js:100-110) — same seven keys with same defaults.** Add NOTIFICATION_EVENT_LABELS entries at js/app.js:113 with D-12 copy + hints.

### Open question

- D-12 doesn't specify per-category defaults (on or off). Recommend all seven default ON (these are critical state-change pushes the user has acted to opt into by participating in a flow). User can toggle individual categories off after first irritation.

---

## 6. Trakt sync history

### What's there

- **OAuth flow:** `trakt.openAuth()` at js/app.js:367 → popup → trakt-callback.html → `trakt.handleAuthCode()` at js/app.js ~388 → CF `traktExchange` at queuenight/functions/index.js:545 swaps code for tokens → tokens stored at members/{id}.trakt = { username, accessToken, refreshToken, expiresAt, connectedAt } (js/app.js:411-419).
- **Token refresh:** `trakt.tokenIfFresh()` at js/app.js:454 — auto-refreshes if expiry < 7 days away via CF `traktRefresh` (functions/index.js:593).
- **Sync function:** `trakt.sync(opts)` at js/app.js:596-651. Pulls four Trakt endpoints in sequence:
  - `/users/me/watched/shows?extended=full` (js/app.js:611)
  - `/users/me/watched/movies?extended=full` (js/app.js:613)
  - `/users/me/watchlist?extended=full` (js/app.js:615)
  - `/sync/ratings?extended=full` (js/app.js:618)
- **Ingest:** `trakt.ingestSyncData()` at js/app.js:657-770ish. Writes:
  - For watched movies: sets `t.watched = true` + `t.watchedAt` directly on the title doc (js/app.js:752-755). NOT a per-member cache — the title is "watched" globally for the family. This is the existing source of truth.
  - For watched shows: writes per-member progress at `t.progress[meId] = { season, episode, updatedAt, source:'trakt' }` (js/app.js:705-714). Does NOT flip t.watched.
  - For ratings: writes `t.ratings[meId] = { score, updatedAt }`.
- **Sync cadence:** triggered manually via Settings button (js/app.js:5016 Sync now button) and automatically on connect (js/app.js:426) and on app start if user is connected (js/app.js:3797, 3803).
- **Stamp:** `members/{id}.trakt.lastSyncedAt` updated after each sync (js/app.js:630-632).

### What's reusable for D-01 (already-watched filter)

D-01 specifies four sources of "watched" status: Trakt sync + voted Yes prior + voted No prior + manually marked-watched.

- **Source 1 (Trakt):** ALREADY consumed implicitly. When Trakt sync flips `t.watched = true` on a title doc (js/app.js:752), any downstream filter like `t => !t.watched` honors it. D-01 does not need a separate Trakt API call at filter time. **No rate-limit concern at family scale.**
- **Source 2-3 (voted Yes/No prior):** vote state lives at `t.votes[memberId]`. D-01 filter logic: any couch member has `votes[memberId] === 'yes'` OR `votes[memberId] === 'no'` (i.e., they've taken a stance, which D-01 says counts as "watched-status known").
- **Source 4 (manually marked-watched):** flipped by `toggleWatched` (search target — recommend planner grep `toggleWatched` and `watched: true` writes for completeness; one likely site is the action sheet "Mark watched" item at js/app.js:11891).

### What to add

- **Couch-level filter helper:** `isWatchedByCouch(title, couchMemberIds)` returning true if any of the four sources fire for any member in `couchMemberIds`. Single function, easy to unit-test.
- **Per-title rewatch override:** add `t.rewatchAllowedBy: { [memberId]: timestamp }` to opt back in for one session. Filter respects: if any couch member has set rewatchAllowedBy with a recent timestamp (same-day), bypass the watched filter.
- **Invitation bypass:** D-01 says the filter applies to MY discovery view, not to invitations. Implication: the watchpartyIntent push fan-out (CF) does NOT respect this filter — pushes go to all members regardless of their watched status. Already true: existing `sendToMembers` doesn't read `t.watched`. No change needed in CFs; only the Tonight/Add/Spin client renderers must filter.

### Open question

- D-01 says "voted Yes prior + voted No prior" both count as watched-status. Is that literal? A "no" vote means "I don't want this", which usually doesn't imply "I've seen it" — many users vote No on titles they haven't watched. Recommend planner clarify with user: should "voted No" alone hide a title from rediscovery, or only "voted No AND marked watched"? Possibility: this is the user's intentional opinionation ("if you've already engaged with the title in any way, it stops cluttering discovery") — but worth confirming.

---

## 7. Cross-cutting onboarding state

### What's there — TWO existing onboarding paths

1. **Pre-Phase-9 feature tour:** `maybeStartOnboarding()` at js/app.js:11466. Gated on `localStorage.getItem('qn_onboarded')` (line 11468). 3-step modal-based seed-picker UX. Started from `bootApp` at js/app.js:3781.
2. **Phase 9 brand onboarding (REFR-09a / DESIGN-07):** `maybeShowFirstRunOnboarding()` at js/app.js:11181. Gated on Firestore `members/{id}.seenOnboarding === true` (read at js/app.js:11189; written at js/app.js:11230, 11240; also bootstrapped server-side by `consumeGuestInvite` per js/app.js:11177 comment). Three-step DOM overlay (`onboarding-overlay`) hidden via `hideOnboarding()` at js/app.js:11209.

### What's reusable for D-10 (hybrid onboarding)

Neither existing path matches D-10's "in-context tooltips at moment of first encounter" pattern. Both existing paths are full-screen modal/overlay UX — D-10 explicitly rejects modals.

- **Reusable concept:** the per-flag dirty-write pattern (set `members/{id}.seenOnboarding=true` at js/app.js:11230) is the right precedent. Extend with a sub-map: `members/{id}.seenTooltips: { couchSeating: true, tileActionSheet: true, queueDragReorder: true }`.
- **Reusable boot-gate pattern:** `bootApp` at js/app.js:3781 calls `maybeStartOnboarding()`; another callsite at js/app.js:3524 fires `maybeShowFirstRunOnboarding()`. Add a third boot-time call OR (cleaner) install the tooltip checks at the moment-of-encounter render points, not at boot.

### What to add

- **`state.onboarding.seen.*` flag map.** Recommend a new state field `state.onboarding.seenTooltips` mirroring the Firestore subdocument pattern, hydrated at boot from `members/{id}.seenTooltips`. Three flag keys per D-10:
  - `couchSeating` — tooltip on Couch viz first-load post-update.
  - `tileActionSheet` — tooltip on first tile tap post-update.
  - `queueDragReorder` — tooltip on first Library tab visit post-update.
- **Tooltip primitive.** No existing tooltip pattern in code (grep returned no matches for tooltip/coachmark/introTip). Build a minimal one: a small absolutely-positioned div anchored to a target element via getBoundingClientRect, with a fade-in animation, dismiss-on-tap-anywhere, and a single-line copy. Mirrors flashToast (already exists per js/utils.js — used heavily) but pinned to a target rather than floating bottom.
- **Per-tooltip gates** at the relevant render points:
  - In Tonight tab Couch viz first render after auth: check `state.onboarding.seenTooltips.couchSeating`; if false, show tooltip + write the flag.
  - In `card(t)` onclick handler before opening action sheet: same pattern with `tileActionSheet`.
  - In `renderLibrary` when `state.filter === 'myqueue'`: same pattern with `queueDragReorder`.
- **NO mandatory modal** per D-10. The Phase 9 first-run overlay (js/app.js:11181) stays as-is for new users; D-10 tooltips are additive layer for existing users post-Phase-14 deploy.
- **Changelog entry (D-10 hybrid component 1)** at changelog.html — add a `v34 — Decision Ritual` entry. The page already exists (Phase 12 / POL-01 referenced in CONTEXT). Read changelog.html before editing to understand the existing entry format.

### Open question

- Does the changelog have an "auto-show on update detected" mechanism, or is it discoverable-only? Not verified this session. If the latter, D-10's "hybrid" leans heavily on the in-context tooltips for actual user reach — the changelog is a backstop, not a primary onboarding channel. Planner: confirm changelog discoverability (linked from Settings? footer? floating callout on cache-bump?) before relying on it.

---

## Summary table — what to build vs what to reuse

| Decision | Build new | Reuse existing |
|---|---|---|
| D-01 already-watched filter | `isWatchedByCouch()` helper, `t.rewatchAllowedBy` field | Trakt sync writes (no separate API calls), `t.watched` field, `t.votes` map |
| D-02 tiered candidate filter | Tier 1 ranked aggregator (`getTierOneRanked()`), 3-level toggle hierarchy resolver | `t.queues` map, `getMyQueueTitles()` pattern (js/app.js:6827) |
| D-03 per-member queue | Yes→queue auto-add discoverability (toast/animation), tier-1 sort, Add-tab insertion path verification | Whole queue infrastructure — already shipped (DR-2): queues map at js/app.js:12340, drag-reorder at js/app.js:4664, persist at js/app.js:4648, reindex at js/app.js:6834 |
| D-04 tile redesign | "X want it" pill + micro-avatars, ▶ trailer button on tile face, vote-button removal, primary-tap-→-action-sheet wiring | `card(t)` at js/app.js:4333, `openActionSheet` at js/app.js:11853, action-sheet DOM, .tc CSS namespace |
| D-05 vote mode in Add tab | "Catch up on votes (N)" CTA + entry-point | Existing vote modal flow (`openVoteModal`) |
| D-06 couch SVG visualization | Procedural SVG renderer (`renderCouchSvg(seatCount)`), per-cushion handlers, +N overflow cushion | None (greenfield) |
| D-07 Flow A rank-pick | Picker UI, roster proxy-confirm, reject→#2 retry, counter-nomination chain (3-level cap) | watchparty CF patterns, `sendToMembers`, intent-doc shape (DR-1 extension) |
| D-08 Flow B nominate | Counter-time decision UI, auto-convert at T-15, all-No edge case | Flow B = existing `tonight_at_time` intent + `proposedStartAt` (already shipped); auto-convert is the new behavior |
| D-09 watchpartyIntent primitive | New fields per DR-1 resolution | Existing `intents` collection (DR-1), `watchpartyTick` CF pattern, intent expiry sweep at functions/index.js:494 |
| D-10 hybrid onboarding | Tooltip primitive, three per-tooltip gates, `state.onboarding.seenTooltips` map, changelog v34 entry | Phase 9 onboarding flag pattern (members.seenOnboarding) |
| D-11 empty states | 5 empty-state surfaces with CTAs | Existing empty-state stub at js/app.js:4592 (`<div class="queue-empty">`) |
| D-12 push categories | 7 D-12 entries in 3 maps (DR-3), CF triggers for new state changes | `NOTIFICATION_DEFAULTS` map, `DEFAULT_NOTIFICATION_PREFS` map, `NOTIFICATION_EVENT_LABELS` map, `sendToMembers` |

---

## Carry-over UAT bug (from CONTEXT)

> "When clicking a show in here it wasn't easy to click out — ✕ scrolls out of view on long detail content."

Fix candidate: `position: fixed` on `.detail-close` (CSS class lives in css/app.css — search target for planner). Single-line CSS change. Recommend assigning to plan 14-05 (tile redesign, since it touches detail-modal surface area anyway) — splitting it as a Phase 9 follow-up risks losing it.

---

## Confidence breakdown

- **Existing watchparty / intent / queue / tile / Trakt patterns:** HIGH — every claim is file:line cited from the actual repo.
- **iOS Safari HTML5-DnD behavior:** MEDIUM — known historical issue but not verified for THIS implementation in THIS session; recommend explicit UAT step.
- **Changelog discoverability for D-10:** LOW — not verified this session; flagged as open question.
- **Phase 8 intent ↔ Phase 14 watchpartyIntent reconciliation (DR-1):** HIGH risk-flag, but the resolution path is HIGH confidence (extending the existing collection is straightforward).
- **D-01 "voted No counts as watched" interpretation:** LOW — likely needs user confirmation at /gsd-plan-phase 14 review; default assumption is literal but worth flagging.

## Open questions for planner / discuss-phase

1. DR-1 resolution: extend existing `intents` collection vs. mint new `watchpartyIntents`? (Recommend: extend.)
2. DR-2: Plan 14-02 title is misleading; rename to reflect that the primitive is shipped and we're adding tier-sort + discoverability polish.
3. D-01 interpretation: does "voted No prior" actually count as a watched-status source, or only "voted No AND marked watched"?
4. iOS Safari HTML5 DnD: does the existing `attachQueueDragReorder` actually work on the primary surface? UAT before committing to "no library needed".
5. Changelog discoverability: how do users find changelog.html post-update? Tooltip? Callout on cache-bump? Settings-only?
6. D-12 default-on/off: do all seven new push categories default ON, or are some opt-in?
7. Counter-chain depth cap: D-07 caps Flow A at 3 levels; does D-08's counter-time also cap at 3?

## Files researched (citation index)

- `.planning/phases/14-decision-ritual-core/14-CONTEXT.md` — full read
- `.planning/seeds/decision-ritual-locked-scope.md` — full read
- `.planning/PROJECT.md` — full read
- `./CLAUDE.md` — full read
- `js/app.js` — targeted reads at lines 90-160, 367-426, 595-770, 1387-1460, 4333-4500, 4587-4710, 6820-6870, 11173-11250, 11460-11520, 11853-11900, 12325-12370 (full file is ~12,656 lines per `wc -l`)
- `queuenight/functions/index.js` — full read (696 lines)
- `firestore.rules` — targeted read at lines 315-365 (collection-rules block for watchparties + intents)
- `css/app.css` — targeted grep + read at lines 1280-1306 (onboarding-modal CSS confirms existing pattern)
- `sw.js` — head 15 lines (cache version + shell pre-cache)

## Files NOT exhaustively read this session (recommended planner search targets)

- `js/utils.js` — flashToast, escapeHtml definitions (small file, safe to read in full)
- `js/constants.js` — full content of TMDB_KEY, RATING_TIERS, MOODS (read freely per CLAUDE.md)
- `js/state.js` — 9 lines, read in full
- `app.html` — full DOM scaffold (990 lines per CLAUDE.md, safe to read)
- `changelog.html` — page exists; read before editing for D-10 v34 entry (not located this session)
- `css/app.css` `.tc-*` and `.action-sheet-*` rules — full styling for tile + sheet (large file ~3051 lines, grep + offset/limit per CLAUDE.md)
- `firestore.rules` lines 1-315 — auth helpers (`isMemberOfFamily`, `attributedWrite`, `graceActive`, `uid()`, `isOwner`) — needed for D-09 rules block
- `openDetailModal` / `renderDetail` callsite — needed for D-04 detail-view surfacing of trailer/providers/synopsis/cast/reviews and the carry-over UAT bug fix
- `toggleWatched` callsite — needed for D-01 source 4 enumeration
- Add-tab handlers — needed for DR-2 verification of "Adding from Add tab pushes to bottom of personal queue"
