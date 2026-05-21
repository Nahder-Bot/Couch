---
phase: 14-decision-ritual-core
mapped: 2026-04-25
input-context: .planning/phases/14-decision-ritual-core/14-CONTEXT.md (12 locked decisions D-01..D-12, 3 reconciled DRs)
input-research: .planning/phases/14-decision-ritual-core/14-RESEARCH.md (file:line citations to existing patterns)
mapper: gsd-pattern-mapper
files-classified: 24 (new symbols / modified surfaces) across 6 source files
analogs-found: 22 / 24 (2 greenfield: SVG sofa renderer, anchored tooltip primitive)
---

# Phase 14 — Decision Ritual Core / Pattern Map

This document tells the planner — for every new code path, modified function, or extended schema in Phase 14 — exactly which existing Couch code to copy from, what to keep verbatim, and what to diverge on. Per CLAUDE.md token rules, all analogs are file:line cited so the planner / executor can `Read(file, offset, limit)` precisely without scanning the 12,656-line `js/app.js`.

Three project-wide rules underpin every assignment:

1. **No bundler / no build step.** Plain ES modules under `js/`, served by Firebase Hosting (CLAUDE.md "Architecture locked for v1"). Patterns below NEVER import a transpilation-dependent helper.
2. **Two-repo split.** Client = `C:\Users\nahde\claude-projects\couch\` (couch repo). Cloud Functions = `C:\Users\nahde\queuenight\` (queuenight repo, sibling). Phase 14 D-12 push code lives in queuenight; everything else lives in couch.
3. **Firestore writes carry attribution.** `writeAttribution()` from `js/utils.js:92` is spread into every payload (Firestore rules require it — see `attributedWrite()` rule helper).

---

## File classification

| New symbol / modified surface | Repo | File | Role | Data flow | Closest analog | Match quality |
|---|---|---|---|---|---|---|
| **D-01: Already-watched filter** | | | | | | |
| `isWatchedByCouch(t, couchMemberIds)` helper | couch | `js/app.js` (new, near `getMyQueueTitles` ~6827) | data primitive (filter helper) | derived-read | `getMyQueueTitles` `js/app.js:6827` | role-match |
| `t.rewatchAllowedBy: { [memberId]: timestamp }` schema field | couch | title docs (`families/{code}/titles/{id}`) | schema extension | n/a | existing `t.queues` map shape (per-member keyed map on title doc) | exact |
| Per-couch-discovery filter wiring (Browse / Spin / Swipe) | couch | `js/app.js` (multiple render sites — planner audits) | UI render filter | derived-read | inline filter at `renderFullQueue` `js/app.js:4587` (`.filter(t => !isHiddenByScope(t))`) | role-match |
| **D-02: Tiered candidate filter** | | | | | | |
| `getTierOneRanked()` aggregator | couch | `js/app.js` (new, near `getGroupNext3` ~6852) | data primitive (aggregator) | derived-read | `getGroupNext3` `js/app.js:6852` + `computeGroupRankMap` `js/app.js:4615` | exact |
| Tier-2 / Tier-3 partitioner | couch | `js/app.js` (new, same area) | data primitive | derived-read | `getGroupNext3` `js/app.js:6852` | role-match |
| Most-restrictive T3 toggle resolver | couch | `js/app.js` (new helper) | helper | request-response | per-member `maxTier` resolution at `js/app.js:4406` | role-match |
| **D-03: Queue polish** | | | | | | |
| Yes→queue toast / inline animation | couch | `js/app.js:12340-12350` (modify `applyVote`) | UI feedback | event-driven | `flashToast` `js/utils.js:18` | exact |
| Queue surfacing in Library tab (polish) | couch | `js/app.js` near `renderFullQueue` ~4586 | UI render | derived-read | `renderFullQueue` `js/app.js:4586` (already exists) | exact |
| Add-tab insertion path verification | couch | `js/app.js` Add-tab handler (planner greps) | data write | request-response | `applyVote` queue-append `js/app.js:12343-12345` | exact |
| **D-04: Tile redesign** | | | | | | |
| "X want it" pill renderer (3 micro-avatars + +N) | couch | `js/app.js:4353` (modify `card(t)`) | UI render | derived-read | yes-count pill `js/app.js:4353` + vote-chips `js/app.js:4423-4428` | exact |
| ▶ Trailer button on tile face | couch | `js/app.js:4480-4483` (`.tc-footer`) | UI render | event-driven | trailer link in action sheet `js/app.js:11886` | exact |
| Vote-button removal from tile face | couch | `js/app.js:4459-4467` (`primaryBtn`) | UI render | n/a | (deletion) | n/a |
| `openTileActionSheet(titleId, e)` | couch | `js/app.js` (new, near `openActionSheet` ~11853) | UI render | event-driven | `openActionSheet` `js/app.js:11853` | exact |
| Wire tile body tap to `openTileActionSheet` | couch | `js/app.js:4469` (modify `card(t)` root onclick) | UI wiring | event-driven | existing `onclick="openDetailModal(...)"` `js/app.js:4469` | exact |
| Detail-modal: surface trailer/providers/synopsis/cast/reviews | couch | `js/app.js` `openDetailModal` (planner greps) | UI render | derived-read | existing detail-modal renderer (planner locates) | role-match |
| Carry-over UAT bug — `.detail-close` `position:fixed` | couch | `css/app.css:1540` | CSS | n/a | **ALREADY APPLIED** at `css/app.css:1540` per current source — planner verifies + closes | exact |
| **D-05: Vote mode in Add tab** | | | | | | |
| "Catch up on votes (N)" CTA | couch | `js/app.js` Add-tab renderer (planner greps) | UI render | derived-read | `queue-empty` empty-state stub `js/app.js:4592` | partial |
| **D-06: Couch SVG visualization** | | | | | | |
| `renderCouchSvg(seatCount)` procedural renderer | couch | `js/app.js` (new) | UI render primitive (greenfield) | derived-read | **NONE** — first inline-SVG in repo. Inline-onclick DOM pattern at `js/app.js:4469`, `4482` is the closest stylistic precedent | greenfield |
| Per-cushion `claimCushion(idx)` handler | couch | `js/app.js` (new) | event-driven UI write | request-response | `applyVote` `js/app.js:12325` (per-member write to title-shaped map) | role-match |
| Overflow `+N` cushion sheet | couch | `js/app.js` (new) | UI render | event-driven | `openActionSheet` `js/app.js:11853` (sheet primitive) | role-match |
| **D-07/D-08: Flow A + Flow B UI** | | | | | | |
| Flow A picker UI (couch viz → ranked list → roster) | couch | `js/app.js` (new render path) | UI render | event-driven | `renderFullQueue` `js/app.js:4586` (list of cards with handlers) | role-match |
| Flow B nominate UI + counter-time decision UI | couch | `js/app.js` (new render path) | UI render | event-driven | existing `openProposeIntent` (Phase 8 entry — see action-sheet wire `js/app.js:11874`) | role-match |
| Counter-nomination chain (3-level cap) | couch | `js/app.js` (new) | client-side state machine | derived-read | client-side match detection at `state.unsubIntents` snapshot `js/app.js:3560-3564` | role-match |
| **D-09: Extend `intents` collection** | | | | | | |
| `flow: 'rank-pick' \| 'nominate'` discriminator + new fields | couch | `js/app.js:1418-1437` (extend `createIntent`) | schema extension + write | request-response | `createIntent` `js/app.js:1400` | exact |
| Firestore rules widening | couch | `firestore.rules:338-386` | schema/rules | n/a | existing `intents` rule block `firestore.rules:338-386` | exact |
| `onIntentCreated` push branch (4 flow types) | queuenight | `functions/index.js:354` (extend) | CF trigger (push fan-out) | event-driven | `onIntentCreated` `functions/index.js:354` | exact |
| `onIntentUpdate` push branch (new state transitions) | queuenight | `functions/index.js:408` (extend) | CF trigger | event-driven | `onIntentUpdate` `functions/index.js:408` | exact |
| Extended `watchpartyTick` intent expiry branch | queuenight | `functions/index.js:494-512` (extend) | CF batch sweep | batch | existing intent expiry branch `functions/index.js:494-512` | exact |
| Auto-convert intent→watchparty at T-15 (Flow B) | queuenight | inside `watchpartyTick` (new branch) | CF batch transform | batch | `watchpartyTick` scheduled→active flip `functions/index.js:454-459` | role-match |
| **D-10: Onboarding tooltips** | | | | | | |
| `state.onboarding.seenTooltips: { [primId]: true }` map | couch | `js/state.js` + Firestore `members/{id}.seenTooltips` | state shape | n/a | `members/{id}.seenOnboarding` flag `js/app.js:11189-11230` | role-match |
| Anchored tooltip primitive (pinned to target el) | couch | `js/utils.js` (new export) | UI primitive (greenfield) | event-driven | `flashToast` `js/utils.js:18` (floating sibling) | greenfield (style-match) |
| 3 per-tooltip gates (couch viz / tile sheet / queue drag) | couch | inline at the 3 render sites | UI gate | derived-read | `maybeShowFirstRunOnboarding` gate pattern `js/app.js:11181-11195` | role-match |
| Changelog v34 entry | couch | `changelog.html:67` (insert above v32) | content | n/a | existing v32 article block `changelog.html:67-78` | exact |
| **D-11: Empty states (5)** | | | | | | |
| 5 empty-state CTAs | couch | various render sites | UI render | n/a | existing `<div class="queue-empty">` `js/app.js:4592` | exact |
| **D-12: 7 new push categories** | | | | | | |
| Add 7 keys to `NOTIFICATION_DEFAULTS` | queuenight | `functions/index.js:74-84` | config map | n/a | existing 8-entry map `functions/index.js:74-84` | exact |
| Add 7 keys to `DEFAULT_NOTIFICATION_PREFS` | couch | `js/app.js:100-110` | config map | n/a | existing 8-entry map `js/app.js:100-110` | exact |
| Add 7 keys to `NOTIFICATION_EVENT_LABELS` | couch | `js/app.js:113-122` | UI copy map | n/a | existing 8-entry map `js/app.js:113-122` | exact |
| (Optional) add aliases to `NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS` | couch | `js/app.js:128-155` | UI alias map | n/a | existing 6-entry alias maps `js/app.js:128-155` | exact |
| 7 new push-call sites in CF triggers | queuenight | `functions/index.js` (new branches in onIntentCreated/onIntentUpdate/watchpartyTick) | CF trigger | event-driven | existing `sendToMembers(..., {eventType: 'intentProposed'})` `functions/index.js:393-402` | exact |

---

## Pattern assignments — concrete excerpts to copy

### 1. `isWatchedByCouch(t, couchMemberIds)` (D-01) — data primitive

**Analog:** `js/app.js:6827` `getMyQueueTitles()`
**Copy verbatim:** the "filter `state.titles` by a per-member predicate over `t.queues[memberId]`" shape. New helper does the same with 4 sources OR'd together.
**Diverge:** check 4 sources per `couchMemberIds`, not 1.

```js
// js/app.js:6827-6832 — analog
function getMyQueueTitles() {
  if (!state.me) return [];
  return state.titles
    .filter(t => !t.watched && t.queues && t.queues[state.me.id] != null)
    .sort((a,b) => a.queues[state.me.id] - b.queues[state.me.id]);
}
```

```js
// NEW — pattern adapted (D-01). Add near getMyQueueTitles ~js/app.js:6827.
// Returns true iff ANY couch member has watched this title via ANY of 4 sources.
// "Watched" sources per D-01:
//   1) Trakt sync flipped t.watched = true (global on title doc, see js/app.js:752 in trakt.ingestSyncData)
//   2) member voted Yes prior — t.votes[memberId] === 'yes'
//   3) member voted No prior — t.votes[memberId] === 'no'
//   4) member manually marked watched — t.watched (same field as source 1; both feed into the global flag)
// Per-title rewatch override: bypass if t.rewatchAllowedBy[memberId] is set today.
function isWatchedByCouch(t, couchMemberIds) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return false;
  // Rewatch override — same-day timestamp on any couch member opts the title back in.
  const dayMs = 24 * 60 * 60 * 1000;
  const recently = (ts) => ts && (Date.now() - ts) < dayMs;
  const allow = t.rewatchAllowedBy || {};
  if (couchMemberIds.some(mid => recently(allow[mid]))) return false;
  // Source 1 + 4 — global watched flag.
  if (t.watched) return true;
  // Sources 2 + 3 — any couch member's vote (yes OR no) counts.
  const votes = t.votes || {};
  return couchMemberIds.some(mid => votes[mid] === 'yes' || votes[mid] === 'no');
}
```

> **Open question for planner** (carried from RESEARCH §6): D-01 says "voted No prior" counts as watched-status. Confirm with user — `votes[mid] === 'no'` literally hides the title from rediscovery, which is opinionated. Above implementation is the literal read.

---

### 2. `getTierOneRanked()` (D-02) — aggregator

**Analog:** `js/app.js:6852` `getGroupNext3()` AND `js/app.js:4615` `computeGroupRankMap()`.
**Copy verbatim:** the iterate-`state.titles` / inspect-`t.queues` / per-member-rank-collect / sort pattern.
**Diverge:** Tier-1 sort is "average of member-queue ranks" (arithmetic mean), NOT the existing "Σ 1/rank" weighted score. Also: Tier-1 ONLY emits titles where EVERY couch member has the title in their queue (intersection, not union).

```js
// js/app.js:6852-6878 — analog (sums 1/rank across ALL queueing members; no intersection requirement)
function getGroupNext3() {
  const scores = new Map();
  const queuedBy = new Map();
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    let total = 0;
    const members = [];
    Object.entries(t.queues).forEach(([mid, rank]) => {
      const m = state.members.find(x => x.id === mid);
      if (!m) return;
      total += 1 / rank;
      members.push(m.name);
    });
    if (total > 0) { scores.set(t.id, total); queuedBy.set(t.id, members); }
  });
  const ranked = Array.from(scores.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([id, score]) => ({ title: state.titles.find(t => t.id === id), score, queuedBy: queuedBy.get(id) }));
  return ranked;
}
```

```js
// NEW — pattern adapted (D-02). Tier-1 = intersection across couchMemberIds; sort by mean rank;
// ties broken by t.rating (TMDB rating numeric).
function getTierOneRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    // Intersection requirement: ALL couch members must queue this title.
    const ranks = couchMemberIds.map(mid => t.queues[mid]);
    if (ranks.some(r => r == null)) return;
    const meanRank = ranks.reduce((a,b) => a + b, 0) / ranks.length;
    out.push({ title: t, meanRank, ratingTie: parseFloat(t.rating) || 0 });
  });
  out.sort((a,b) => (a.meanRank - b.meanRank) || (b.ratingTie - a.ratingTie));
  return out;
}
```

Tier-2 (≥1 member queues it, not everyone) and Tier-3 (only off-couch members queue it) follow the same pattern with different membership predicates. Planner produces 3 small functions or one parameterized helper.

---

### 3. `applyVote` Yes→queue auto-add discoverability (D-03 / Anti-pattern #5)

**Analog:** `js/app.js:12340-12350` (existing applyVote queue-sync block) AND `js/utils.js:18` (`flashToast`).
**Copy verbatim:** the queue-append branch — already shipped.
**Diverge:** add a `flashToast(...)` call when `wasInQueue === false && newVote === 'yes'` so the user sees their queue mutated.

```js
// js/app.js:12340-12350 — existing (DR-2 confirms it's already shipped)
const wasInQueue = queues[memberId] != null;
if (newVote === 'yes') {
  if (!wasInQueue) {
    // Append at end of that member's current queue
    const memberQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[memberId] != null).length;
    queues[memberId] = memberQueueLen + 1;
  }
} else {
  if (wasInQueue) delete queues[memberId];
}
```

```js
// NEW — pattern adapted (D-03 discoverability). Insert a single line right after the queues[memberId] assignment.
// flashToast pattern is already used 30+ times in app.js — see e.g. js/app.js search "flashToast(" — so kind:'info' renders consistently.
if (newVote === 'yes' && !wasInQueue && memberId === state.me?.id) {
  flashToast(`Added "${t.name}" to your queue`, { kind: 'info' });
}
```

Note the `memberId === state.me?.id` guard — only toast when the local user is the actor, not when an onSnapshot reports another member's vote.

---

### 4. "X want it" pill renderer in `card(t)` (D-04)

**Analog:** `js/app.js:4353` (existing yes-count pill — `${yesCount} 👍`) AND `js/app.js:4423-4428` (vote-chips render with avatar-style chips).
**Copy verbatim:** the `metaParts.push(...)` insertion point + the `.filter(Boolean).join('')` chip pattern.
**Diverge:** count by `t.queues` not `t.votes` (per D-04 the pill represents "in queue", not "voted yes" — but per DR-2 those are equivalent today since Yes auto-adds to queue, so the count is the same OR you could literally swap data sources).

```js
// js/app.js:4423-4428 — analog (vote-chip strip with member avatars/names)
const voteChips = state.members.map(m => {
  const v = votes[m.id]; if (!v) return '';
  const cls = v==='yes'?'yes':v==='no'?'no':'seen';
  const sym = v==='yes'?'✓':v==='no'?'✗':'👁';
  return `<span class="tc-vote-chip ${cls}">${sym} ${escapeHtml(m.name)}</span>`;
}).filter(Boolean).join('');
```

```js
// js/app.js:4353 — analog (the yes-count pill being replaced)
else if (!t.watched && yesCount > 0) metaParts.push(`${yesCount} 👍`);
```

```js
// NEW — pattern adapted (D-04). Inserted in card(t) replacing the yesCount pill at js/app.js:4353.
// Renders 3 micro-avatars (initial-letter circles using memberColor() — see js/app.js:11930 for the
// existing `<div class="who-avatar" style="background:${memberColor(c.id)}">${(c.name||'?')[0]}</div>` pattern).
if (!t.watched && t.queues) {
  const queuers = state.members.filter(m => t.queues[m.id] != null);
  if (queuers.length > 0) {
    const visible = queuers.slice(0, 3);
    const overflow = queuers.length - visible.length;
    const avatars = visible.map(m =>
      `<div class="tc-want-avatar" title="${escapeHtml(m.name)}" style="background:${memberColor(m.id)}">${escapeHtml((m.name||'?')[0])}</div>`
    ).join('');
    const overflowChip = overflow > 0 ? `<div class="tc-want-overflow">+${overflow}</div>` : '';
    metaParts.push(
      `<span class="tc-want-pill" aria-label="${queuers.length} ${queuers.length===1?'person wants':'people want'} this">
        <div class="tc-want-avatars">${avatars}${overflowChip}</div>
        <span class="tc-want-label">${queuers.length} want it</span>
      </span>`
    );
  }
}
```

New CSS goes in `css/app.css` near `.tc-vote-chip` (planner greps for that class).

---

### 5. `openTileActionSheet(titleId, e)` (D-04 primary tile tap)

**Analog:** `js/app.js:11853` `window.openActionSheet` (full body lines 11853-11896).
**Copy verbatim:** the entire structure — `state.titles.find` → `items.push(...)` array → `content.innerHTML = ...` → toggle `#action-sheet-bg.on` class. Reuse the exact `.action-sheet-item` / `.action-sheet-divider` / `.action-sheet-title` CSS classes (already styled).
**Diverge:** filter the items array down to just the four D-04 buckets — Watch tonight / Schedule for later / Ask family / Vote. Plus a "Show details" entry that calls existing `openDetailModal(t.id)`.

```js
// js/app.js:11853-11896 — analog (full openActionSheet body)
window.openActionSheet = function(titleId, e) {
  if (e) e.stopPropagation();
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const hasReview = state.me && (t.reviews||{})[state.me.id];
  const scheduled = t.scheduledFor && t.scheduledFor > Date.now() - 3*60*60*1000;
  const commentCount = t.commentCount || 0;
  const content = document.getElementById('action-sheet-content');
  const items = [];
  if (state.me) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openDiary('${titleId}')"><span class="icon">📖</span>Log a watch</button>`);
  if (t.watched && state.me) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openReviewEditor('${titleId}')"><span class="icon">✍</span>${hasReview?'Edit review':'Write review'}</button>`);
  if (!t.watched) items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openScheduleModal('${titleId}')"><span class="icon">📅</span>${scheduled?'Edit schedule':'Schedule'}</button>`);
  if (!t.watched && state.me) {
    const existing = wpForTitle(titleId);
    if (existing) {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyLive('${existing.id}')"><span class="icon">🎬</span>Open watchparty</button>`);
    } else {
      items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyStart('${titleId}')"><span class="icon">🎬</span>Start a watchparty</button>`);
    }
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openProposeIntent('${titleId}')"><span class="icon">📆</span>Propose tonight @ time</button>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();askTheFamily('${titleId}')"><span class="icon">💭</span>Ask the family</button>`);
  }
  // ... (more items — see analog file for the full list) ...
  content.innerHTML = `<div class="action-sheet-title">${t.name}</div>${items.join('')}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};
```

```js
// NEW — pattern adapted (D-04). Add adjacent to openActionSheet ~js/app.js:11853.
// Same shell, narrower item list. The four D-04 buckets in order, with a divider + Show details fallback.
window.openTileActionSheet = function(titleId, e) {
  if (e) e.stopPropagation();
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const content = document.getElementById('action-sheet-content');
  const items = [];
  if (!t.watched && state.me) {
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyStart('${titleId}')"><span class="icon">🎬</span>Watch tonight</button>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openScheduleModal('${titleId}')"><span class="icon">📅</span>Schedule for later</button>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();askTheFamily('${titleId}')"><span class="icon">💭</span>Ask the family</button>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openVoteModal('${titleId}')"><span class="icon">🗳</span>Vote</button>`);
  }
  items.push(`<div class="action-sheet-divider"></div>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openDetailModal('${titleId}')"><span class="icon">ℹ</span>Show details</button>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openActionSheet('${titleId}',event)"><span class="icon">⋯</span>More options</button>`);
  content.innerHTML = `<div class="action-sheet-title">${escapeHtml(t.name)}</div>${items.join('')}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};
```

**Wire-up at `js/app.js:4469`** — swap the existing `onclick="openDetailModal('${t.id}')"` to `onclick="openTileActionSheet('${t.id}',event)"`. Keep the `tabindex` / `aria-label` / `onkeydown` shape verbatim. The ⋯ button at `js/app.js:4482` continues to call the full `openActionSheet`. Detail modal becomes secondary entry from the new sheet.

---

### 6. `renderCouchSvg(seatCount)` (D-06) — greenfield SVG primitive

**Analog:** **NONE** — first inline-SVG render path in the repo. Closest stylistic precedent is the inline-onclick DOM pattern at `js/app.js:4469`, `4482`. Per RESEARCH §4 budget for iOS Safari quirks: viewBox-based scaling, ≥44pt cushion targets, avoid SVG `filter:url(#)`.
**Copy verbatim:** the `onclick="..."` inline-handler pattern from `card(t)` for cushion taps.
**Diverge:** everything else is greenfield. Defer visual treatment to `/gsd-sketch` per CONTEXT D-06 (Anti-pattern #6).

```js
// js/app.js:4469 — analog (inline DOM onclick pattern Couch already uses pervasively)
return `<div class="tc${blockedClass}${vetoedClass}${approvalClass}" role="button" tabindex="0"
  aria-label="${escapeHtml(t.name)}${t.year?', '+escapeHtml(t.year):''}"
  onclick="openDetailModal('${t.id}')"
  onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailModal('${t.id}');}">
```

```js
// NEW — skeleton (D-06). Visual specifics LOCKED FOR /gsd-sketch round; this is shape only.
// seatCount: 2-8 inclusive. If members.length > 7, render 7 cushions + 1 overflow ("+N more").
function renderCouchSvg(seatCount) {
  const seats = Math.max(2, Math.min(8, seatCount));
  const overflow = seatCount > 7 ? (seatCount - 7) : 0;
  // viewBox sized so a single cushion on a 375px iPhone-SE viewport is ≥44pt wide.
  // Cushion array drives both the SVG <g> elements AND the avatar overlay <img> elements
  // (DOM-on-top approach — see RESEARCH §4 iOS caching rationale).
  const cushions = [];
  for (let i = 0; i < seats; i++) {
    const isOverflow = (overflow > 0 && i === seats - 1);
    const handler = isOverflow ? `openCouchOverflowSheet()` : `claimCushion(${i})`;
    cushions.push(`<g class="cushion ${isOverflow?'overflow':''}" tabindex="0" role="button"
      onclick="${handler}"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${handler};}">
      <!-- SVG geometry per /gsd-sketch sign-off -->
    </g>`);
  }
  return `<svg class="couch-svg" viewBox="0 0 800 280" preserveAspectRatio="xMidYMid meet" aria-label="Couch with ${seats} seats">
    ${cushions.join('')}
  </svg>`;
}

window.claimCushion = function(idx) { /* writes to state.couchSeating + Firestore */ };
window.openCouchOverflowSheet = function() { /* reuses #action-sheet-bg primitive */ };
```

---

### 7. Anchored tooltip primitive (D-10) — greenfield UI helper

**Analog:** `js/utils.js:18` `flashToast` — bottom-floating sibling. Tooltip primitive needs to anchor to a target element instead of floating.
**Copy verbatim:** the lazy-create container pattern (`if (!toastContainer) { ...append... }`), the `requestAnimationFrame(() => el.classList.add('on'))` in-transition, the auto-dismiss + 260ms removal.
**Diverge:** position via `target.getBoundingClientRect()`; dismiss-on-tap-anywhere (not auto-timer); single instance at a time (not stacking).

```js
// js/utils.js:18-39 — analog (full flashToast body)
let toastContainer = null;
export function flashToast(message, opts) {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.setAttribute('role', 'status');
    toastContainer.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastContainer);
  }
  const kind = (opts && opts.kind) || 'info';
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + kind;
  toast.textContent = message;
  toastContainer.appendChild(toast);
  while (toastContainer.children.length > 3) toastContainer.removeChild(toastContainer.firstChild);
  requestAnimationFrame(() => toast.classList.add('on'));
  setTimeout(() => {
    toast.classList.remove('on');
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 260);
  }, 3500);
}
```

```js
// NEW — pattern adapted (D-10). Add as new export in js/utils.js.
// Single tooltip at a time. Anchored to target via getBoundingClientRect.
// Dismiss on next tap anywhere (capture phase) so user "interaction" closes it per D-10.
let _activeTooltip = null;
export function showTooltipAt(targetEl, message, opts) {
  if (!targetEl) return;
  hideTooltip();
  const tip = document.createElement('div');
  tip.className = 'coach-tip';
  tip.setAttribute('role', 'tooltip');
  tip.textContent = message;
  document.body.appendChild(tip);
  const rect = targetEl.getBoundingClientRect();
  // Default: pin below target, centered. Caller can pass {placement:'above'} to flip.
  const placement = (opts && opts.placement) || 'below';
  tip.style.position = 'fixed';
  tip.style.left = `${Math.max(8, rect.left + rect.width/2 - 120)}px`;
  tip.style.top  = (placement === 'above') ? `${rect.top - 48}px` : `${rect.bottom + 8}px`;
  requestAnimationFrame(() => tip.classList.add('on'));
  const onDismiss = () => { hideTooltip(); document.removeEventListener('click', onDismiss, true); };
  // Capture-phase listener so the very next interaction closes the tooltip.
  setTimeout(() => document.addEventListener('click', onDismiss, true), 0);
  _activeTooltip = tip;
}
export function hideTooltip() {
  if (!_activeTooltip) return;
  const tip = _activeTooltip; _activeTooltip = null;
  tip.classList.remove('on');
  setTimeout(() => { if (tip.parentNode) tip.parentNode.removeChild(tip); }, 200);
}
```

---

### 8. Per-tooltip gates (D-10) at the 3 render sites

**Analog:** `js/app.js:11181-11195` `maybeShowFirstRunOnboarding` — boot-time Firestore-flag-gated render.
**Copy verbatim:** the read-from-`state.members[me].seenOnboarding` / write-back-via-`updateDoc` pattern.
**Diverge:** read/write a sub-map key `seenTooltips.{primId}` instead of the top-level `seenOnboarding` boolean, AND fire at moment-of-encounter (in render handlers) not at boot.

```js
// js/app.js:11181-11195 + 11225-11232 — analog
function maybeShowFirstRunOnboarding() {
  if (!state.me) return;
  if (state.me.type === 'guest') return;
  const liveMe = (state.members || []).find(m => m.id === state.me.id);
  const seen = (liveMe && liveMe.seenOnboarding === true) || state.me.seenOnboarding === true;
  if (seen) return;
  try { if (localStorage.getItem('qn_onboarded')) return; } catch(e) {}
  showOnboardingStep(1);
}

// Write-back at js/app.js:11225-11232
window.skipOnboarding = async function() {
  hideOnboarding();
  try { localStorage.setItem('qn_onboarded', '1'); } catch(e) {}
  try {
    if (state.me && state.familyCode) {
      await updateDoc(doc(membersRef(), state.me.id), { seenOnboarding: true });
    }
  } catch(e) { console.error('[onboarding] skip write failed', e); }
};
```

```js
// NEW — pattern adapted (D-10). Reusable gate helper called at render points.
async function maybeShowTooltip(primId, targetEl, message, opts) {
  if (!state.me || !targetEl) return;
  if (state.me.type === 'guest') return;
  const liveMe = (state.members || []).find(m => m.id === state.me.id);
  const seenMap = (liveMe && liveMe.seenTooltips) || (state.me.seenTooltips) || {};
  if (seenMap[primId]) return;
  showTooltipAt(targetEl, message, opts);
  try {
    await updateDoc(doc(membersRef(), state.me.id), { [`seenTooltips.${primId}`]: true });
  } catch(e) { console.error('[tooltip] flag write failed', e); }
}

// 3 callsites:
//   - In Tonight tab couch-viz first render: maybeShowTooltip('couchSeating', cushionEl, 'Tap a cushion to seat yourself.', {placement:'above'});
//   - At top of openTileActionSheet (after appending to DOM): maybeShowTooltip('tileActionSheet', sheetEl, 'These are your options for this title.', {placement:'above'});
//   - In renderLibrary when state.filter === 'myqueue' (first row): maybeShowTooltip('queueDragReorder', firstRowEl, 'Drag to reorder your queue.');
```

---

### 9. `createIntent` extension (D-09 reframed per DR-1)

**Analog:** `js/app.js:1400-1442` `createIntent`.
**Copy verbatim:** the entire shell — id generation, expiresAt computation, threshold resolver, `creatorTimeZone` capture, `setDoc(intentRef(id), { ...intent, ...writeAttribution() })`.
**Diverge:** widen `type` validation (or add a sibling `flow` discriminator), branch `expiresAt` per flow (Flow A: 11pm same-day; Flow B: T+4hr), branch the rsvps[me] seed value per flow.

```js
// js/app.js:1400-1442 — analog (full createIntent)
async function createIntent({ type, titleId, proposedStartAt, proposedNote } = {}) {
  if (!state.me || !state.familyCode) return null;
  if (type !== 'tonight_at_time' && type !== 'watch_this_title') throw new Error('bad_intent_type');
  const t = state.titles.find(x => x.id === titleId);
  if (!t) throw new Error('title_not_found');
  const id = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  const expiresAt = type === 'tonight_at_time'
    ? (proposedStartAt || now) + 3 * 60 * 60 * 1000
    : now + 30 * 24 * 60 * 60 * 1000;
  const th = computeIntentThreshold(state.group || {});
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch(e) { return null; }
  })();
  const intent = {
    id, type,
    titleId, titleName: t.name, titlePoster: t.poster || '',
    createdBy: state.me.id,
    createdByName: state.me.name || null,
    createdByUid: (state.auth && state.auth.uid) || null,
    createdAt: now,
    creatorTimeZone,
    rsvps: {
      [state.me.id]: { value: 'yes', at: now, actingUid: (state.auth && state.auth.uid) || null, memberName: state.me.name || null }
    },
    thresholdRule: th.rule,
    status: 'open',
    expiresAt
  };
  if (type === 'tonight_at_time') intent.proposedStartAt = proposedStartAt || null;
  if (proposedNote) intent.proposedNote = proposedNote;
  await setDoc(intentRef(id), { ...intent, ...writeAttribution() });
  return id;
}
```

```js
// NEW — pattern adapted (D-09 + DR-1). Two new flow values: 'rank-pick' (Flow A) and 'nominate' (Flow B).
// Per DR-1 reconciliation: extend the SAME collection. Existing 'tonight_at_time' / 'watch_this_title' rows
// stay valid. Discriminate via the new `flow` field on writes; reads accept both vocabularies.
async function createIntent({ type, flow, titleId, proposedStartAt, proposedNote, expectedCouchMemberIds } = {}) {
  if (!state.me || !state.familyCode) return null;
  // Back-compat: legacy callers pass `type`; new callers pass `flow`. Accept either; prefer flow.
  const flowVal = flow || type;
  const allowed = ['tonight_at_time', 'watch_this_title', 'rank-pick', 'nominate'];
  if (!allowed.includes(flowVal)) throw new Error('bad_intent_flow');
  const t = state.titles.find(x => x.id === titleId);
  if (!t) throw new Error('title_not_found');
  const id = 'i_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  const now = Date.now();
  // Per-flow expiry per D-07 (Flow A: 11pm same-day) and D-08 (Flow B: T+4hr).
  let expiresAt;
  if (flowVal === 'rank-pick') {
    const eod = new Date(); eod.setHours(23, 0, 0, 0);
    expiresAt = eod.getTime();
  } else if (flowVal === 'nominate') {
    expiresAt = (proposedStartAt || now) + 4 * 60 * 60 * 1000;
  } else if (flowVal === 'tonight_at_time') {
    expiresAt = (proposedStartAt || now) + 3 * 60 * 60 * 1000;
  } else {
    expiresAt = now + 30 * 24 * 60 * 60 * 1000;
  }
  const th = computeIntentThreshold(state.group || {});
  const creatorTimeZone = (() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
    catch(e) { return null; }
  })();
  // Per D-09: rsvps[me].state vocabulary differs by flow. Legacy flows use {value:'yes'}; new flows use {state:'in'}.
  const meRsvp = (flowVal === 'rank-pick' || flowVal === 'nominate')
    ? { state: 'in', at: now, actingUid: (state.auth && state.auth.uid) || null, memberName: state.me.name || null }
    : { value: 'yes', at: now, actingUid: (state.auth && state.auth.uid) || null, memberName: state.me.name || null };
  const intent = {
    id,
    type: flowVal,            // legacy field — preserved for back-compat
    flow: flowVal,            // new D-09 discriminator
    titleId, titleName: t.name, titlePoster: t.poster || '',
    createdBy: state.me.id,
    createdByName: state.me.name || null,
    createdByUid: (state.auth && state.auth.uid) || null,
    createdAt: now,
    creatorTimeZone,
    rsvps: { [state.me.id]: meRsvp },
    thresholdRule: th.rule,
    status: 'open',
    expiresAt,
    counterChainDepth: 0   // D-07 cap at 3
  };
  if (flowVal === 'tonight_at_time' || flowVal === 'nominate') intent.proposedStartAt = proposedStartAt || null;
  if (flowVal === 'rank-pick' && Array.isArray(expectedCouchMemberIds)) intent.expectedCouchMemberIds = expectedCouchMemberIds;
  if (proposedNote) intent.proposedNote = proposedNote;
  await setDoc(intentRef(id), { ...intent, ...writeAttribution() });
  return id;
}
```

---

### 10. Firestore rules — extend `intents` block (D-09 / DR-1)

**Analog:** `firestore.rules:338-386` (full existing intents block).
**Copy verbatim:** the read rule, the create rule attribution check, the 4 disjoint update branches, the `delete: if false` policy.
**Diverge:** widen create's allowed `type` set from 2 → 4 values; add a new RSVP branch tolerating `state.in / state.reject / state.drop / state.maybe / counterTitleId / counterTime / note`; widen the cancel/match/convert status enums; add a counter-chain-bump branch.

```javascript
// firestore.rules:338-386 — analog (existing block)
match /intents/{intentId} {
  allow read: if isMemberOfFamily(familyCode);
  allow create: if attributedWrite(familyCode)
    && request.resource.data.status == 'open'
    && (request.resource.data.type == 'tonight_at_time' || request.resource.data.type == 'watch_this_title');
  allow update: if attributedWrite(familyCode) && (
    // (1) RSVP branch — only rsvps map + attribution keys touched
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['rsvps', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    // (2) Cancel branch — only the creator can cancel
    || (
      resource.data.createdByUid == uid()
      && request.resource.data.status == 'cancelled'
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'cancelledAt', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )
    // (3) Match transition — open → matched
    || (
      resource.data.status == 'open'
      && request.resource.data.status == 'matched'
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'matchedAt', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )
    // (4) Convert transition — creator only, matched → converted
    || (
      resource.data.status == 'matched'
      && request.resource.data.status == 'converted'
      && resource.data.createdByUid == uid()
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'convertedTo', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )
  );
  allow delete: if false;
}
```

```javascript
// NEW — pattern extension (D-09 / DR-1). Full block to replace the existing one.
// Keeps all 4 existing branches intact for back-compat with already-shipped Phase 8 intents.
match /intents/{intentId} {
  allow read: if isMemberOfFamily(familyCode);

  // CREATE: widen the type enum to 4 values. Validate counterChainDepth bounded if present.
  allow create: if attributedWrite(familyCode)
    && request.resource.data.status == 'open'
    && (request.resource.data.type == 'tonight_at_time'
        || request.resource.data.type == 'watch_this_title'
        || request.resource.data.type == 'rank-pick'
        || request.resource.data.type == 'nominate')
    && (!('counterChainDepth' in request.resource.data)
        || (request.resource.data.counterChainDepth >= 0 && request.resource.data.counterChainDepth <= 3));

  // UPDATE: 4 existing branches preserved; 1 new branch (counter-nom chain depth bump).
  allow update: if attributedWrite(familyCode) && (
    // (1) RSVP branch — UNCHANGED, but the rsvps[mid] payload SHAPE is now flow-dependent.
    //     Rules don't validate the inner shape (would require per-key rule complexity);
    //     validation is enforced client-side via the createIntent / setIntentRsvp helpers.
    request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['rsvps', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])

    // (2) Cancel branch — UNCHANGED. Widen status target to allow 'expired' as well? NO — sweep CF
    //     uses admin SDK and bypasses rules.
    || (
      resource.data.createdByUid == uid()
      && request.resource.data.status == 'cancelled'
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'cancelledAt', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )

    // (3) Match transition — UNCHANGED. (Flow B uses 'matched' before convert; Flow A may skip directly to converted.)
    || (
      resource.data.status == 'open'
      && request.resource.data.status == 'matched'
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'matchedAt', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )

    // (4) Convert transition — extended. Allow 'open' OR 'matched' → 'converted' (Flow A
    //     converts directly from open at quorum). Add convertedToWpId to allowed keys.
    || (
      (resource.data.status == 'matched' || resource.data.status == 'open')
      && request.resource.data.status == 'converted'
      && resource.data.createdByUid == uid()
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['status', 'convertedTo', 'convertedToWpId', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )

    // (5) NEW — Counter-nom chain depth bump. Any family member can submit a counter,
    //     which atomically updates rsvps[me] AND increments counterChainDepth. Cap at 3 per D-07.6.
    || (
      resource.data.status == 'open'
      && (resource.data.counterChainDepth == null || resource.data.counterChainDepth < 3)
      && request.resource.data.counterChainDepth == (resource.data.counterChainDepth == null ? 1 : resource.data.counterChainDepth + 1)
      && request.resource.data.diff(resource.data).affectedKeys()
           .hasOnly(['rsvps', 'counterChainDepth', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
    )
  );

  allow delete: if false;
}
```

---

### 11. `onIntentCreated` push branches (D-09 + D-12)

**Analog:** `queuenight/functions/index.js:354-403` (full onIntentCreated body).
**Copy verbatim:** the snap.data() + context.params destructure, the senderName fallback, the membersSnap recipient calculation, the `sendToMembers(..., { excludeUid, excludeMemberId, eventType })` shape including the creatorTimeZone-aware time render.
**Diverge:** branch on `intent.flow` (or fall back to `intent.type`) → 4 cases instead of 2. New eventTypes: `flowAPick` (rank-pick), `flowBNominate` (nominate). Existing 'tonight_at_time' + 'watch_this_title' branches preserved verbatim.

```js
// queuenight/functions/index.js:354-403 — analog
exports.onIntentCreated = functions.firestore
  .document('families/{familyCode}/intents/{intentId}')
  .onCreate(async (snap, context) => {
    const intent = snap.data();
    if (!intent) return null;
    const { familyCode, intentId } = context.params;
    const senderName = intent.createdByName || 'A family member';
    let title, body;
    if (intent.type === 'tonight_at_time') {
      title = 'Tonight @ time';
      let when = 'soon';
      if (intent.proposedStartAt) {
        try {
          when = new Date(intent.proposedStartAt).toLocaleTimeString([], {
            hour: 'numeric', minute: '2-digit',
            timeZone: intent.creatorTimeZone || 'UTC'
          });
        } catch (e) {
          when = new Date(intent.proposedStartAt).toLocaleTimeString([], {
            hour: 'numeric', minute: '2-digit', timeZone: 'UTC'
          });
        }
      }
      body = `${senderName} proposed "${intent.titleName}" for ${when}`;
    } else {
      title = 'Asking the family';
      body = `${senderName}: "${intent.titleName}"?`;
    }
    const membersSnap = await db.collection('families').doc(familyCode).collection('members').get();
    const recipientIds = membersSnap.docs.map(d => d.id).filter(id => id !== intent.createdBy);
    if (!recipientIds.length) return null;
    return sendToMembers(familyCode, recipientIds, {
      title, body,
      tag: `intent-${intentId}`,
      url: `/?intent=${intentId}`
    }, {
      excludeUid: intent.createdByUid || null,
      excludeMemberId: intent.createdBy || null,
      eventType: 'intentProposed'
    });
  });
```

```js
// NEW — pattern extension (D-09 + D-12). Branch on flow with D-12 BRAND copy.
// Existing 2 branches preserved. New 2 branches added with flow-specific eventTypes.
exports.onIntentCreated = functions.firestore
  .document('families/{familyCode}/intents/{intentId}')
  .onCreate(async (snap, context) => {
    const intent = snap.data();
    if (!intent) return null;
    const { familyCode, intentId } = context.params;
    const senderName = intent.createdByName || 'A family member';
    const flow = intent.flow || intent.type;
    let title, body, eventType;
    if (flow === 'tonight_at_time') {
      // [unchanged — see analog above]
      eventType = 'intentProposed';
      // ... same time-render block ...
    } else if (flow === 'watch_this_title') {
      title = 'Asking the family';
      body = `${senderName}: "${intent.titleName}"?`;
      eventType = 'intentProposed';
    } else if (flow === 'rank-pick') {
      // D-12 copy: "Dad picked Inception for tonight. In, reject, or drop?"
      title = 'Tonight\'s pick';
      body = `${senderName} picked ${intent.titleName} for tonight. In, reject, or drop?`;
      eventType = 'flowAPick';
    } else if (flow === 'nominate') {
      // D-12 copy: "Sister wants to watch Past Lives at 8pm. Join, counter, or pass?"
      let when = 'soon';
      if (intent.proposedStartAt) {
        try {
          when = new Date(intent.proposedStartAt).toLocaleTimeString([], {
            hour: 'numeric', minute: '2-digit', timeZone: intent.creatorTimeZone || 'UTC'
          });
        } catch (e) { when = 'soon'; }
      }
      title = 'Watch with the couch?';
      body = `${senderName} wants to watch ${intent.titleName} at ${when}. Join, counter, or pass?`;
      eventType = 'flowBNominate';
    }
    const membersSnap = await db.collection('families').doc(familyCode).collection('members').get();
    let recipientIds = membersSnap.docs.map(d => d.id).filter(id => id !== intent.createdBy);
    // Flow A: only push to expectedCouchMemberIds (others didn't claim a cushion).
    if (flow === 'rank-pick' && Array.isArray(intent.expectedCouchMemberIds)) {
      const expected = new Set(intent.expectedCouchMemberIds);
      recipientIds = recipientIds.filter(id => expected.has(id));
    }
    if (!recipientIds.length) return null;
    return sendToMembers(familyCode, recipientIds, {
      title, body,
      tag: `intent-${intentId}`,
      url: `/?intent=${intentId}`
    }, {
      excludeUid: intent.createdByUid || null,
      excludeMemberId: intent.createdBy || null,
      eventType
    });
  });
```

---

### 12. `watchpartyTick` extension (D-09 expiry + Flow B auto-convert)

**Analog:** `queuenight/functions/index.js:435-516` (full watchpartyTick body) and especially the existing intent-expiry branch at lines 494-512.
**Copy verbatim:** the `for (const familyDoc of families.docs)` per-family iteration, the per-doc try/catch, the `await doc.ref.update({ status, ...timestamp })` idempotent-on-status pattern, the counter-bump-and-log shape.
**Diverge:** add 3 new behaviors INSIDE the existing intent loop after the existing expiry branch:
- 'rank-pick' status='open' AND past 11pm → status='expired'
- 'nominate' status='open' AND now >= proposedStartAt - 15min AND any rsvp.state==='in' → status='converted' + create watchparty doc
- 'rank-pick' OR 'nominate' status='open' AND nearing hard-expire (T-30min) → fire `intentExpiring` push

```js
// queuenight/functions/index.js:494-512 — analog (existing intent expiry branch inside watchpartyTick)
let intentsSnap;
try {
  intentsSnap = await db.collection('families').doc(familyDoc.id).collection('intents').get();
} catch (e) { console.warn('intents list failed', familyDoc.id, e.message); continue; }
for (const doc of intentsSnap.docs) {
  const intent = doc.data();
  if (intent.status !== 'open') continue;
  if ((intent.expiresAt || 0) > now) continue;
  try {
    await doc.ref.update({ status: 'expired', expiredAt: now });
    expiredIntents++;
  } catch (e) {
    console.warn('intent expiry failed', familyDoc.id, doc.id, e.message);
    errored++;
  }
}
```

```js
// NEW — pattern extension. Replaces the for-loop body above with a flow-aware branch tree.
// All branches stay idempotent via status re-checks (matches the pattern at functions/index.js:454).
for (const idoc of intentsSnap.docs) {
  const intent = idoc.data();
  if (intent.status !== 'open') continue;
  const flow = intent.flow || intent.type;
  try {
    // Branch A — hard expire (existing behavior + new flows)
    if ((intent.expiresAt || 0) <= now) {
      await idoc.ref.update({ status: 'expired', expiredAt: now });
      expiredIntents++;
      // D-12 push: hard-expire warning was sent earlier (Branch C). On actual expiry, no second push.
      continue;
    }
    // Branch B — Flow B auto-convert at T-15min if any 'in' RSVPs exist.
    if (flow === 'nominate' && intent.proposedStartAt) {
      const minutesBefore = (intent.proposedStartAt - now) / 60000;
      const hasYes = Object.values(intent.rsvps || {}).some(r => r && (r.state === 'in' || r.value === 'yes'));
      if (minutesBefore <= 15 && hasYes) {
        // Create the watchparty doc — minimal shape; lobby flow takes over from here.
        const wpRef = db.collection('families').doc(familyDoc.id).collection('watchparties').doc();
        await wpRef.set({
          status: 'scheduled',
          hostId: intent.createdBy,
          hostUid: intent.createdByUid || null,
          hostName: intent.createdByName || null,
          titleId: intent.titleId,
          startAt: intent.proposedStartAt,
          creatorTimeZone: intent.creatorTimeZone || null,
          createdAt: now,
          convertedFromIntentId: intent.id,
          actingUid: intent.createdByUid || null,
          memberId: intent.createdBy || null,
          memberName: intent.createdByName || null
        });
        await idoc.ref.update({
          status: 'converted',
          convertedToWpId: wpRef.id,
          convertedAt: now
        });
        // D-12 push: 'flowBConvert' — "Past Lives in 15 min — head to the couch."
        // (Use sendToMembers with eventType: 'flowBConvert'.)
        continue;
      }
      // Branch C — T-30min hard-expire warning push (intentExpiring eventType).
      if (minutesBefore <= 30 && minutesBefore > 15 && !intent.warned30) {
        await idoc.ref.update({ warned30: true });
        // Send 'intentExpiring' push to recipients here.
      }
    }
  } catch (e) {
    console.warn('intent tick per-doc failed', familyDoc.id, idoc.id, e.message);
    errored++;
  }
}
```

---

### 13. 7 new push categories — `NOTIFICATION_DEFAULTS` (D-12 / DR-3)

**Analog:** `queuenight/functions/index.js:74-84`.
**Copy verbatim:** the `Object.freeze({...})` shape and per-key boolean assignment.
**Diverge:** add 7 keys, all default `true` per RESEARCH §5 recommendation (these fire only when the user has actively engaged with a flow, so they expect the notification).

```js
// queuenight/functions/index.js:74-84 — analog
const NOTIFICATION_DEFAULTS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  intentProposed: true,
  intentMatched: true
});
```

```js
// NEW — pattern extension (D-12 / DR-3 place 1 of 3).
const NOTIFICATION_DEFAULTS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  // Phase 8
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

---

### 14. 7 new push categories — `DEFAULT_NOTIFICATION_PREFS` (D-12 / DR-3 place 2)

**Analog:** `js/app.js:100-110`.
**Copy verbatim:** identical shape to server map. Keep server + client maps in lockstep — that's the whole point of DR-3.

```js
// js/app.js:100-110 — analog
const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  intentProposed: true,
  intentMatched: true
});
```

```js
// NEW — same 7 keys (must match queuenight/functions/index.js NOTIFICATION_DEFAULTS exactly).
const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  intentProposed: true,
  intentMatched: true,
  // Phase 14
  flowAPick: true,
  flowAVoteOnPick: true,
  flowARejectMajority: true,
  flowBNominate: true,
  flowBCounterTime: true,
  flowBConvert: true,
  intentExpiring: true
});
```

---

### 15. 7 new push categories — UI labels (D-12 / DR-3 place 3)

**Analog:** `js/app.js:113-122` (`NOTIFICATION_EVENT_LABELS`).
**Copy verbatim:** the `{ label, hint }` object shape.
**Diverge:** brand-voice copy per D-12 ("warm, family-tapping-shoulder"). No "Notification:" prefix; no transactional jargon.

```js
// js/app.js:113-122 — analog
const NOTIFICATION_EVENT_LABELS = Object.freeze({
  watchpartyScheduled: { label: 'New watchparty scheduled', hint: 'When someone sets up a watchparty' },
  watchpartyStarting:  { label: 'Watchparty starting',       hint: 'Right when the movie starts' },
  // ...
});
```

```js
// NEW — append 7 D-12 entries.
const NOTIFICATION_EVENT_LABELS = Object.freeze({
  // ... existing 8 ...
  flowAPick:           { label: "Tonight's pick chosen",      hint: "When someone on your couch picks a movie." },
  flowAVoteOnPick:     { label: "Couch voted on your pick",   hint: "When someone responds to a pick you made." },
  flowARejectMajority: { label: "Your pick was passed on",    hint: "When the couch asks you to pick again." },
  flowBNominate:       { label: "Watch with the couch?",      hint: "When someone wants to watch with you at a time." },
  flowBCounterTime:    { label: "Counter-time on your nom",   hint: "When someone counters with a different time." },
  flowBConvert:        { label: "Movie starting in 15 min",   hint: "When your nomination becomes a watchparty." },
  intentExpiring:      { label: "Tonight's pick expiring",    hint: "Heads-up that a tonight intent is about to expire." }
});
```

> **Optional 4th touch** (RESEARCH §5): `NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS` at `js/app.js:128-155` are the Phase-12 friendly-UI alias maps. Per Phase 12 POL-01, the friendly UI is canonical. Planner picks ONE: either add the 7 new keys to all three friendly maps (recommended), OR skip and let them surface only in the legacy Settings list. Do not mix.

---

### 16. Changelog v34 entry (D-10 hybrid component 1)

**Analog:** `changelog.html:67-78` (existing v32 article block).
**Copy verbatim:** the `<article class="release">` shell, the `<header class="release-h">` with version + date + tagline, the `<ul class="release-list">` with `<li><strong>` per highlighted change.
**Diverge:** insert ABOVE v32 (changelog is reverse-chronological); v34 content per D-10 onboarding decision.

```html
<!-- changelog.html:67-78 — analog (existing v32 release entry) -->
<article class="release">
  <header class="release-h">
    <span class="release-version">v32</span>
    <span class="release-date">2026-04-25 · Pre-launch polish</span>
  </header>
  <p class="release-summary">Three small fixes ahead of v1.</p>
  <ul class="release-list">
    <li><strong>Notification preferences:</strong> per-event toggles + quiet hours moved to Account → Your Couch.</li>
    <li><strong>Couch Nights:</strong> Halloween Crawl pack now actually starts with Hocus Pocus.</li>
    <li><strong>About:</strong> version + feedback + this changelog.</li>
  </ul>
</article>
```

```html
<!-- NEW — insert immediately after the changelog-hero <section>, before the v32 article. -->
<article class="release">
  <header class="release-h">
    <span class="release-version">v34</span>
    <span class="release-date">[deploy date] · Decision ritual</span>
  </header>
  <p class="release-summary">A new way to pick what to watch — together.</p>
  <ul class="release-list">
    <li><strong>The couch:</strong> tap a cushion to seat yourself. See who's in.</li>
    <li><strong>Two flows:</strong> rank-pick when you're together, or nominate-and-invite when you're apart.</li>
    <li><strong>Tile redesign:</strong> see who wants what at a glance. Tap the tile for what to do next.</li>
    <li><strong>Your queue:</strong> drag to reorder. Voting Yes adds to the bottom — we'll show you.</li>
  </ul>
</article>
```

---

### 17. Empty states (D-11) — 5 surfaces

**Analog:** `js/app.js:4592` (`<div class="queue-empty">` empty-state stub).
**Copy verbatim:** the `<div class="queue-empty"><span class="emoji">...</span><strong>Title</strong>Body text.</div>` markup shape — already styled.
**Diverge:** every state gets 1-2 CTA buttons (per D-11) so users never hit a dead end. Reuse existing button classes (`.tc-primary`, `.btn`, etc. — planner greps css/app.css for the canonical CTA button class).

```js
// js/app.js:4588-4593 — analog (existing empty-state with two variants — search vs. fresh)
if (!myQueue.length) {
  const hasSearch = !!(state.librarySearchQuery || '').trim();
  el.innerHTML = hasSearch
    ? `<div class="queue-empty"><span class="emoji">🔍</span><strong>Nothing matches</strong>Try a different search.</div>`
    : `<div class="queue-empty"><span class="emoji">🛋️</span><strong>The couch is empty</strong>Vote yes on titles to fill it up. Drag to reorder what's next.</div>`;
  return;
}
```

```js
// NEW — pattern adapted (D-11). Example for state (b) — empty personal queue.
// Each of the 5 D-11 states uses this same shell with state-specific copy + CTAs.
el.innerHTML = `<div class="queue-empty">
  <span class="emoji">🛋️</span>
  <strong>Your queue is empty</strong>
  Vote on a few titles to fill it up.
  <div class="queue-empty-cta">
    <button class="tc-primary" onclick="openVoteMode()">Open Vote mode</button>
  </div>
  <div class="queue-empty-trending">
    ${trendingCarouselHtml(5) /* small carousel of 3-5 trending family titles */}
  </div>
</div>`;
```

The other 4 D-11 states (brand-new family / Flow A no-couch / all-watched / Flow A reject-majority no-#2) follow the same shell, different `<strong>` + CTA buttons. See CONTEXT D-11 table for exact copy.

---

## Shared patterns (cross-cutting)

These apply across multiple Phase 14 plans and should be applied uniformly.

### S1 — Firestore writes always carry attribution

**Source:** `js/utils.js:92` `writeAttribution()`.
**Apply to:** every `setDoc` / `updateDoc` / `addDoc` in Phase 14 client code (createIntent extension, applyVote modification, seenTooltips writes, queue persistence, couch-seating writes, etc.).

```js
// Pattern (used at js/app.js:1440, 4658, 11230, 12352, 12378 — extensive precedent)
await updateDoc(doc(somethingRef(), id), { ...writeAttribution(), ...payload });
```

Firestore rules require this — the `attributedWrite()` rule helper checks for `actingUid` / `memberId` / `memberName` keys. Skip this and the write fails with `permission-denied`.

### S2 — Per-event push gating via `sendToMembers`

**Source:** `queuenight/functions/index.js:92` `sendToMembers(familyCode, memberIds, payload, options)`.
**Apply to:** every new push call in Phase 14 CFs (7 new eventTypes per D-12).

```js
// Always pass eventType; always pass excludeUid + excludeMemberId for self-echo guard.
return sendToMembers(familyCode, recipientIds, {
  title: '...',
  body: '...',
  tag: `intent-${intentId}`,                  // dedupe key — prevents stacked pushes for the same logical event
  url: `/?intent=${intentId}`                 // deep-link payload — sw.js click handler routes to this
}, {
  excludeUid: intent.createdByUid || null,    // server-side self-echo guard
  excludeMemberId: intent.createdBy || null,  // legacy fallback for pre-auth members
  eventType: 'flowAPick'                      // MUST match a key in NOTIFICATION_DEFAULTS — see DR-3
});
```

Without `eventType` the server falls through to `defaultOn=true` (functions/index.js:114-115) and the user toggle is silently ignored.

### S3 — `state.unsubXxx` snapshot pattern for live data

**Source:** `js/app.js:3530-3564` (titles / group / intents subscriptions).
**Apply to:** any new live-sync needed for Phase 14 (Flow A picker live state, Flow B counter-time arrival, couch-seating presence).

```js
// Pattern at js/app.js:3560-3564 — existing intents subscription
state.unsubIntents = onSnapshot(intentsRef(), s => {
  state.intents = s.docs.map(d => d.data());
  if (typeof renderIntentsStrip === 'function') renderIntentsStrip();
  if (typeof maybeEvaluateIntentMatches === 'function') maybeEvaluateIntentMatches(state.intents);
}, e => { qnLog('[intents] snapshot error', e.message); });
```

Phase 14 reuses this exact subscription — the new `flow` values land in the same `state.intents` array. No new subscription needed if you stay within the existing `intents` collection (DR-1 recommendation).

### S4 — Inline `onclick="..."` handler attribution

**Source:** `js/app.js:4469`, `4482`, `4601-4608`, `11862-11893` (pervasive in render helpers).
**Apply to:** all new render output (couch viz cushions, tile action sheet entries, empty-state CTAs, tooltip targets).

Couch's render helpers consistently use inline `onclick="windowFnName('${id}')"` rather than `addEventListener` post-render. Match this — DOM-string-templating approach is the project's chosen idiom (no virtual DOM, no event delegation pattern). Always `event.stopPropagation()` on nested buttons inside parent click targets (e.g. `tc-primary`, `tc-more` at `js/app.js:4466`, `4482`).

### S5 — `flashToast` for user-visible state changes

**Source:** `js/utils.js:18`.
**Apply to:** every Phase 14 mutation the user triggered (Yes→queue auto-add per D-03, claim cushion, submit RSVP, send counter-nom, etc.).

```js
flashToast(`Added "${t.name}" to your queue`, { kind: 'info' });
flashToast('Counter-nomination sent', { kind: 'success' });
flashToast('That couch is full — add another seat?', { kind: 'warn' });
```

### S6 — Two-repo split discipline

Phase 14 modifies BOTH repos:
- **couch repo** (`C:\Users\nahde\claude-projects\couch\`): client code, Firestore rules, changelog, css. ALL Phase 14 work except CFs.
- **queuenight repo** (`C:\Users\nahde\queuenight\`): Cloud Functions (push fan-out, watchpartyTick extension, NOTIFICATION_DEFAULTS).

Per Anti-pattern #2 in CONTEXT (Phase 13 hit this): use worktree-relative paths for couch-side files in worktree-isolated executors; use absolute paths for queuenight-side files. Deploys are separate: `bash scripts/deploy.sh` for couch hosting; `firebase deploy --only functions` from `~/queuenight/` for CFs.

### S7 — Cache bump on user-visible client changes

**Source:** `sw.js` `CACHE` constant; bumped automatically by `bash scripts/deploy.sh <short-tag>` per CLAUDE.md / RUNBOOK §H.
**Apply to:** any Phase 14 deploy that ships client code. Pass a short-tag like `34-decision-ritual` to `deploy.sh` so installed PWAs invalidate.

---

## No analog found (greenfield)

| File / symbol | Role | Why no analog | Planner guidance |
|---|---|---|---|
| `renderCouchSvg(seatCount)` | UI primitive | First inline-SVG render path in repo — no SVG sofa / no per-element-bound SVG anywhere | Defer visuals to `/gsd-sketch` per CONTEXT Anti-pattern #6. Use the inline-onclick DOM idiom from `card(t)` for cushion event binding. Budget for iOS Safari quirks per RESEARCH §4 (viewBox scaling, ≥44pt targets, no `filter:url(#)`). |
| `showTooltipAt(targetEl, msg, opts)` | UI primitive | No existing anchored-tooltip / coachmark pattern (only floating `flashToast`) | Build minimal in `js/utils.js` per the §7 excerpt above. Style-match flashToast (lazy-create, requestAnimationFrame in-transition, 200-260ms fade). |

---

## Carry-over UAT bug status

**CONTEXT line 230:** "Fix candidate: make `.detail-close` `position: fixed` within the modal so it stays accessible regardless of scroll position."

**Pattern-mapper finding:** `css/app.css:1540` already declares `.detail-close{position:fixed;...}` with an explanatory comment at line 1537-1539:

```css
/* fixed (not absolute) so the close button stays visible while the detail view scrolls.
   position:fixed inside a transformed parent would break; detail-modal-bg doesn't transform, so fixed
   pins against the viewport correctly. iOS safe-area inset keeps the button clear of the notch. */
.detail-close{position:fixed;top:calc(var(--s3) + env(safe-area-inset-top, 0px));...}
```

**Planner action required:** verify the carry-over UAT report was filed BEFORE this CSS landed. If yes, close the bug as already-fixed in 14-05 sub-task notes (no code change needed). If the bug was filed AFTER the fix landed (i.e. the fix is incomplete or doesn't apply to the report context — possibly Library/Queue context is rendering detail in a different modal container without `.detail-close`), planner investigates whether a different scroll container is involved. There's also a scoped override at `css/app.css:2373` for `.avatar-picker-modal .detail-close{position:absolute;...}` — confirm this isn't bleeding into Library context.

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\claude-projects\couch\js\app.js` (targeted reads at lines 90-160, 1380-1470, 3520-3610, 4333-4490, 4580-4710, 6820-6880, 11173-11252, 11460-11530, 11853-11935, 12325-12390 — all ranges already cited in RESEARCH.md, re-read once each per pattern-mapper rule)
- `C:\Users\nahde\claude-projects\couch\js\utils.js` (full read, 108 lines)
- `C:\Users\nahde\claude-projects\couch\firestore.rules` (lines 315-390)
- `C:\Users\nahde\claude-projects\couch\css\app.css` (greps for `.detail-close`, full context around line 1540, scoped override at 2373)
- `C:\Users\nahde\claude-projects\couch\changelog.html` (full read, 135 lines)
- `C:\Users\nahde\queuenight\functions\index.js` (lines 60-220, 340-516)

**Files scanned:** 6 files across both repos; ~25 distinct line ranges.
**Pattern extraction date:** 2026-04-25.
**Match coverage:** 22 / 24 (92%). 2 greenfield (couch SVG renderer, anchored tooltip primitive).

**Ready for planning:** PLANNER can now reference exact analog file:line + concrete code excerpts when authoring the 14-01 .. 14-09 plan files. All shared patterns S1-S7 should be applied across the relevant plans.
