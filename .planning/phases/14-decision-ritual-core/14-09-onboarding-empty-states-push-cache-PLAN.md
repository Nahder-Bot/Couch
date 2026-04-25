---
phase: 14-decision-ritual-core
plan: 09
type: execute
wave: 4
depends_on: [14-04, 14-05, 14-06, 14-07, 14-08]
files_modified:
  - js/app.js
  - js/utils.js
  - css/app.css
  - changelog.html
  - sw.js
  - C:\Users\nahde\queuenight\functions\index.js
autonomous: false
requirements_addressed: [DECI-14-10, DECI-14-11, DECI-14-12, DECI-14-13]
must_haves:
  truths:
    - "showTooltipAt(targetEl, message, opts) primitive exported from js/utils.js: anchored to target via getBoundingClientRect; dismiss-on-tap-anywhere; single instance at a time; fade-in via requestAnimationFrame + 200-260ms removal."
    - "members/{id}.seenTooltips Firestore subdocument map gates 3 tooltips: couchSeating (Couch viz first render), tileActionSheet (first openTileActionSheet call), queueDragReorder (first Library tab visit when filter==='myqueue'). Each fires once per user via maybeShowTooltip(primId, targetEl, message, opts) helper. Guest members skipped."
    - "5 D-11 empty-state surfaces implemented: (a) brand-new family, (b) empty personal queue, (c) Flow A no couch, (d) all-watched (T1+T2 empty), (e) Flow A reject-majority no #2. Each uses existing .queue-empty shell + 1-2 CTAs."
    - "7 new push categories added in THREE places per DR-3: NOTIFICATION_DEFAULTS at queuenight/functions/index.js:74 (server gate), DEFAULT_NOTIFICATION_PREFS at js/app.js:100 (client merge baseline), NOTIFICATION_EVENT_LABELS at js/app.js:113 (BRAND-voice copy). 7 keys: flowAPick, flowAVoteOnPick, flowARejectMajority, flowBNominate, flowBCounterTime, flowBConvert, intentExpiring. All default ON."
    - "changelog.html v34 entry inserted ABOVE existing v32 entry (reverse-chronological); copy follows BRAND voice: 'A new way to pick what to watch — together.'"
    - "sw.js CACHE constant bumped to 'couch-v34.0-decision-ritual'; deploy via `bash scripts/deploy.sh 34.0-decision-ritual` (per CLAUDE.md / RUNBOOK §H)."
  artifacts:
    - path: "js/utils.js"
      provides: "showTooltipAt + hideTooltip exports"
      contains: "showTooltipAt"
    - path: "js/app.js"
      provides: "maybeShowTooltip gate + 3 tooltip callsites + 5 empty-state surfaces"
      contains: "maybeShowTooltip"
    - path: "C:\\Users\\nahde\\queuenight\\functions\\index.js"
      provides: "7 keys appended to NOTIFICATION_DEFAULTS"
      contains: "flowAPick: true"
    - path: "js/app.js (DEFAULT_NOTIFICATION_PREFS)"
      provides: "7 keys appended to client defaults"
      contains: "flowBConvert: true"
    - path: "js/app.js (NOTIFICATION_EVENT_LABELS)"
      provides: "7 keys appended with BRAND-voice copy"
      contains: "Tonight's pick chosen"
    - path: "changelog.html"
      provides: "v34 release article"
      contains: "v34"
    - path: "sw.js"
      provides: "CACHE bumped to v34"
      contains: "couch-v34"
  key_links:
    - from: "Couch viz first render in 14-04"
      to: "maybeShowTooltip('couchSeating', cushionEl, 'Tap a cushion to seat yourself.', {placement:'above'})"
      via: "function call inserted in rerenderCouchViz"
      pattern: "maybeShowTooltip\\('couchSeating'"
    - from: "openTileActionSheet from 14-05"
      to: "maybeShowTooltip('tileActionSheet', sheetEl, 'These are your options for this title.', ...)"
      via: "function call inserted at end of openTileActionSheet"
      pattern: "maybeShowTooltip\\('tileActionSheet'"
    - from: "renderLibrary myqueue branch"
      to: "maybeShowTooltip('queueDragReorder', firstRowEl, 'Drag to reorder your queue.', ...)"
      via: "function call inserted in render"
      pattern: "maybeShowTooltip\\('queueDragReorder'"
---

<objective>
Final cross-cutting plan that ties Phase 14 together. Four streams of work that depend on Plans 1-8 being in place:

1. **D-10 hybrid onboarding** — anchored tooltip primitive + 3 per-tooltip gates + changelog v34 entry.
2. **D-11 empty states** — 5 action-leading CTAs across the new surfaces (Couch viz, queue, Flow A flows, all-watched, reject-majority).
3. **D-12 + DR-3 push categories** — 7 new keys added in THREE places (server defaults, client defaults, client labels) so the eventTypes wired by 14-06 actually flow through user toggles correctly.
4. **D-13 CACHE bump + deploy** — bump sw.js CACHE to `couch-v34.0-decision-ritual` so installed PWAs invalidate on next online activation.

Purpose: Without this plan, Phase 14 ships in a half-state — push toggles silently no-op (DR-3 issue), users can't discover new primitives without modal-overlay onboarding (which D-10 explicitly rejects), empty states create dead-ends that frustrate, and installed PWAs serve stale shells until manual cache-clear. This plan closes all four.

Output: New showTooltipAt primitive in js/utils.js, 3 tooltip callsites + 5 empty-state surfaces in js/app.js, 7 new push category keys added in three maps, changelog v34 article, sw.js CACHE bump.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 4 (final integration). Hard depends on:
- 14-04 (Couch viz render — tooltip target #1)
- 14-05 (openTileActionSheet — tooltip target #2)
- 14-06 (CFs already use the 7 new eventType strings — this plan adds the matching defaults so toggles work)
- 14-07 + 14-08 (empty states (c) and (e) live in Flow A surfaces)

**Two-repo discipline (CRITICAL):** Modifies BOTH repos. The NOTIFICATION_DEFAULTS edit is in queuenight/functions/index.js (absolute path). Everything else is couch-side.

**Deploy order at end of phase (Task 7):** Deploy queuenight functions FIRST (`firebase deploy --only functions` from `~/queuenight/`), then deploy couch hosting (`bash scripts/deploy.sh 34.0-decision-ritual` from couch repo). This ensures the server-side 7-key map is live before the client UI starts surfacing toggle controls for those keys.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md
@.planning/BRAND.md

<interfaces>
**Existing flashToast** at js/utils.js:18-39 — the analog for showTooltipAt's lazy-create + requestAnimationFrame + setTimeout-removal pattern. Code excerpt in PATTERNS.md §7.

**Existing Phase 9 onboarding** at js/app.js:11181 (`maybeShowFirstRunOnboarding`) — the gate-pattern analog for maybeShowTooltip.

**Existing seenOnboarding write** at js/app.js:11230 (`updateDoc(doc(membersRef(), state.me.id), { seenOnboarding: true });`) — adapted to write `[\`seenTooltips.${primId}\`]: true`.

**Existing NOTIFICATION_DEFAULTS** at queuenight/functions/index.js:74-84:
```js
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

**Existing DEFAULT_NOTIFICATION_PREFS** at js/app.js:100-110 — same 8 keys, mirrored for client UI defaults.

**Existing NOTIFICATION_EVENT_LABELS** at js/app.js:113-122 — `{ label, hint }` shape per key.

**Existing Phase 12 friendly-UI maps** at js/app.js:128-155 (`NOTIF_UI_TO_SERVER_KEY`, `NOTIF_UI_LABELS`, `NOTIF_UI_DEFAULTS`) — NOT updated in this plan per CONTEXT.md "DR-3 follow-up override" (user decision at /gsd-plan-phase 14). 7 new keys surface only in the legacy NOTIFICATION_EVENT_LABELS Settings UI to avoid the dual-Settings-screen collision RESEARCH §5 flagged. Friendly-UI parity captured as follow-up polish item.

**Existing changelog.html v32 article** at changelog.html:67 — copy template per PATTERNS.md §16.

**Existing sw.js CACHE** — `couch-v33.3-sentry-dsn` per STATE.md. New CACHE: `couch-v34.0-decision-ritual`. The `bash scripts/deploy.sh <short-tag>` pipeline auto-bumps when a tag is passed.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add showTooltipAt + hideTooltip primitive to js/utils.js</name>
  <files>js/utils.js</files>
  <read_first>
    - js/utils.js (full file, 108 lines per RESEARCH §metadata) — find flashToast as analog
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §7 (concrete excerpt — copy verbatim)
  </read_first>
  <action>
1. Read js/utils.js in full.

2. Append to the bottom (after flashToast):

```js
// === D-10 anchored tooltip primitive — DECI-14-10 ===
// Anchored to a target element via getBoundingClientRect.
// Single instance at a time. Dismiss on next tap anywhere (capture phase).
// CSS class .coach-tip styled in css/app.css.
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
  const placement = (opts && opts.placement) || 'below';
  tip.style.position = 'fixed';
  tip.style.left = `${Math.max(8, Math.min(window.innerWidth - 248, rect.left + rect.width/2 - 120))}px`;
  tip.style.top  = (placement === 'above') ? `${Math.max(8, rect.top - 48)}px` : `${rect.bottom + 8}px`;
  requestAnimationFrame(() => tip.classList.add('on'));
  const onDismiss = () => { hideTooltip(); document.removeEventListener('click', onDismiss, true); };
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

3. **Append CSS to css/app.css**:

```css
/* === D-10 coach-tip — DECI-14-10 === */
.coach-tip {
  position: fixed;
  max-width: 240px;
  padding: var(--s2) var(--s3);
  background: var(--c-bg-deep, #14110f);
  color: var(--c-text-strong, #e8dcc4);
  border: 1px solid var(--c-warm-amber, #d4a574);
  border-radius: var(--r-md, 8px);
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.5);
  opacity: 0;
  transform: translateY(-4px);
  transition: opacity var(--t-shimmer, 200ms) var(--ease-out, ease-out), transform var(--t-shimmer, 200ms) var(--ease-out, ease-out);
  z-index: 200;
  pointer-events: none;
}
.coach-tip.on {
  opacity: 1;
  transform: translateY(0);
}
@media (prefers-reduced-motion: reduce) {
  .coach-tip { transition: none; transform: none; }
}
```

4. Verify js/app.js imports flashToast from js/utils.js — add `showTooltipAt, hideTooltip` to the same import statement.
  </action>
  <verify>
    <automated>node --check js/utils.js && grep -c "export function showTooltipAt" js/utils.js && grep -c "\\.coach-tip" css/app.css</automated>
    Expect: passes.
  </verify>
  <done>
    - showTooltipAt + hideTooltip exported from js/utils.js.
    - .coach-tip CSS rules present with prefers-reduced-motion guard.
    - js/app.js imports both helpers.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add maybeShowTooltip gate + 3 tooltip callsites in js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 11181-11240 (maybeShowFirstRunOnboarding gate-pattern analog)
    - js/app.js (after 14-04) — rerenderCouchViz function (callsite #1)
    - js/app.js (after 14-05) — window.openTileActionSheet (callsite #2)
    - js/app.js — renderLibrary / state.filter === 'myqueue' branch (callsite #3)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §8 (concrete excerpt)
  </read_first>
  <action>
1. Add `maybeShowTooltip` helper near the existing onboarding gates (around js/app.js:11200):

```js
// === D-10 maybeShowTooltip gate — DECI-14-10 ===
// One-shot tooltip gated on members/{id}.seenTooltips.{primId}; writes the flag on display.
async function maybeShowTooltip(primId, targetEl, message, opts) {
  if (!state.me || !targetEl) return;
  if (state.me.type === 'guest') return; // guests skip
  const liveMe = (state.members || []).find(m => m.id === state.me.id);
  const seenMap = (liveMe && liveMe.seenTooltips) || (state.me.seenTooltips) || {};
  if (seenMap[primId]) return;
  showTooltipAt(targetEl, message, opts);
  try {
    await updateDoc(doc(membersRef(), state.me.id), {
      [`seenTooltips.${primId}`]: true,
      ...writeAttribution()
    });
  } catch (e) {
    console.error('[tooltip] flag write failed', e);
  }
}
```

2. **Callsite 1 — Couch viz first render.** In `rerenderCouchViz` (added in 14-04 Task 2), AFTER setting innerHTML:

```js
// D-10 tooltip on first Couch viz render.
const firstCushion = container.querySelector('.cushion:not(.claimed)');
if (firstCushion && typeof maybeShowTooltip === 'function') {
  // Use setTimeout to let the DOM settle before computing rect.
  setTimeout(() => maybeShowTooltip('couchSeating', firstCushion, 'Tap a cushion to seat yourself.', {placement: 'above'}), 200);
}
```

3. **Callsite 2 — first openTileActionSheet call.** In `window.openTileActionSheet` (added in 14-05 Task 2), AFTER setting `content.innerHTML`:

```js
// D-10 tooltip on first tile-action-sheet open.
setTimeout(() => {
  const sheetEl = document.getElementById('action-sheet-content');
  if (sheetEl && typeof maybeShowTooltip === 'function') {
    maybeShowTooltip('tileActionSheet', sheetEl, 'These are your options for this title.', {placement: 'above'});
  }
}, 200);
```

4. **Callsite 3 — Library tab queue first render.** In renderLibrary at the myqueue branch (search `state.filter === 'myqueue'`), AFTER the queue rows are rendered:

```js
// D-10 tooltip on first Library queue render.
setTimeout(() => {
  const firstRow = el.querySelector('.full-queue-row');
  if (firstRow && typeof maybeShowTooltip === 'function') {
    maybeShowTooltip('queueDragReorder', firstRow, 'Drag to reorder your queue.');
  }
}, 200);
```

5. **firestore.rules audit:** the `members/{id}` update path may need to permit `seenTooltips` map writes. Grep for `match /members/{memberId}` and audit. If allowlist exists, add `'seenTooltips'`. If permissive, document with comment marker. (Same pattern as 14-01 Task 2.)
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "maybeShowTooltip" js/app.js && grep -c "seenTooltips" js/app.js</automated>
    Expect: maybeShowTooltip ≥4 (definition + 3 callsites); seenTooltips ≥2 (read + write).
  </verify>
  <done>
    - maybeShowTooltip helper defined; reads members/{id}.seenTooltips; writes flag on display.
    - 3 callsites wired (Couch viz, tile action sheet, Library queue).
    - Guest members skipped.
    - firestore.rules updated or documented for seenTooltips field permission.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Implement 5 D-11 empty states</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 4585-4610 (existing .queue-empty empty-state stub)
    - .planning/phases/14-decision-ritual-core/14-CONTEXT.md D-11 table (5 states + copy + CTAs)
    - js/app.js — render paths for the 5 surfaces (Tonight tab brand-new family, Library queue empty, Flow A no-couch state, Flow A all-watched, Flow A reject-majority no-#2)
  </read_first>
  <action>
1. **State (a) — brand-new family, nothing watched.** Surface: Tonight tab when state.titles is empty AND state.familyCode exists. Add to renderTonight render path:

```js
// D-11 (a) — brand-new family
if ((state.titles || []).length === 0 && state.familyCode) {
  return el.innerHTML = `<div class="queue-empty">
    <span class="emoji">🛋️</span>
    <strong>Your couch is fresh</strong>
    Nothing in queue yet. What should be the first?
    <div class="queue-empty-cta">
      <button class="tc-primary" type="button" onclick="setTab('add')">Add a title</button>
      <button class="tc-secondary" type="button" onclick="openTraktConnect()">Connect Trakt to import history</button>
    </div>
  </div>`;
}
```

   Verify `setTab` and `openTraktConnect` exist in scope (search). If signatures differ, adapt the calls.

2. **State (b) — empty personal queue.** Already exists at js/app.js:4587-4593 with simpler copy. EXTEND it with the D-11 CTA shape:

```js
// D-11 (b) — empty personal queue (extends existing stub)
if (!myQueue.length) {
  const hasSearch = !!(state.librarySearchQuery || '').trim();
  if (hasSearch) {
    el.innerHTML = `<div class="queue-empty"><span class="emoji">🔍</span><strong>Nothing matches</strong>Try a different search.</div>`;
    return;
  }
  el.innerHTML = `<div class="queue-empty">
    <span class="emoji">🛋️</span>
    <strong>Your queue is empty</strong>
    Vote on a few titles to fill it up.
    <div class="queue-empty-cta">
      <button class="tc-primary" type="button" onclick="openVoteModal()">Open Vote mode</button>
    </div>
  </div>`;
  return;
}
```

3. **State (c) — Flow A entry, no couch yet.** This is handled by the Couch viz itself (every empty cushion is a "+ add to couch" affordance per 14-04). The D-11 copy applies to the case where the user opens Flow A picker without claiming a cushion. Adapt openFlowAPicker (from 14-07 Task 1):

```js
// 14-07 Task 1's openFlowAPicker already shows a flashToast warning. Extend with a glowing-cushion mode.
// In renderFlowAEntry, when couchSize === 0 (no claimed cushions):
if (couchSize === 0) {
  container.innerHTML = `<div class="flow-a-no-couch queue-empty">
    <span class="emoji">🛋️</span>
    <strong>Who's on the couch tonight?</strong>
    Tap to seat yourself + invite family.
    <div class="queue-empty-cta">
      <button class="tc-primary" type="button" onclick="document.getElementById('couch-viz-container')?.scrollIntoView({behavior:'smooth',block:'center'})">Find a seat</button>
    </div>
  </div>`;
  // Optionally add a CSS class to all cushions to make them glow.
  document.querySelectorAll('.couch-svg .cushion:not(.claimed)').forEach(g => g.classList.add('cushion-glow'));
  return;
}
```

   Add CSS for `.cushion-glow` to css/app.css:
```css
.couch-svg .cushion-glow .cushion-rect {
  animation: cushion-glow-pulse var(--t-pulse, 1500ms) ease-in-out infinite;
}
@keyframes cushion-glow-pulse {
  0%, 100% { stroke: var(--c-cushion-stroke, #4a3d33); }
  50% { stroke: var(--c-warm-amber, #d4a574); }
}
@media (prefers-reduced-motion: reduce) {
  .couch-svg .cushion-glow .cushion-rect { animation: none; }
}
```

4. **State (d) — all-watched (T1+T2 empty).** In renderFlowAPickerScreen (from 14-07 Task 2), the existing empty-state already triggers when all 3 tiers are empty. EXTEND it with the D-11 copy + 2 CTAs:

```js
// 14-07 Task 2 line replacing the current emptyState string:
const emptyState = (!t1.length && !t2.length && !(showT3 && t3.length))
  ? `<div class="queue-empty">
      <span class="emoji">🛋️</span>
      <strong>You've seen everything in queue</strong>
      Revisit a favorite or expand discovery?
      <div class="queue-empty-cta">
        <button class="tc-primary" type="button" onclick="onFlowAShowRewatchOptions()">Show rewatch options</button>
        <button class="tc-secondary" type="button" onclick="closeFlowAPicker();setTab('add')">Discover more</button>
      </div>
    </div>`
  : '';
```

   Add `window.onFlowAShowRewatchOptions = function() { /* toggle T3 expand AND/OR show all titles ignoring isWatchedByCouch */ };` — implementation detail: temporarily bypass isWatchedByCouch by passing `state.couchMemberIds = []` to the aggregators OR add a `{includeWatched: true}` flag.

5. **State (e) — Flow A reject-majority no #2.** In renderFlowAResponseScreen (from 14-07 Task 4) picker view, when rejectMajority AND counterDepth >= 3 (or after the 1-retry expires), surface this state:

```js
// In picker view of renderFlowAResponseScreen, when retry path is exhausted:
${rejectMajority && (counterDepth >= 3) ? `<div class="queue-empty">
  <span class="emoji">🎲</span>
  <strong>No alternative pick</strong>
  Try again or anyone nominate?
  <div class="queue-empty-cta">
    <button class="tc-secondary" type="button" onclick="onFlowACancel()">Cancel for tonight</button>
    <button class="tc-primary" type="button" onclick="closeFlowAPicker();openFlowBNominate(state.intents.find(i => i.id === state.flowAOpenIntentId)?.titleId)">Open Flow B</button>
  </div>
</div>` : ''}
```

6. CSS: ensure `.queue-empty-cta` has flex layout (likely already does):
```css
.queue-empty-cta {
  display: flex;
  flex-direction: column;
  gap: var(--s2);
  margin-top: var(--s3);
  align-items: stretch;
}
.queue-empty-cta .tc-primary, .queue-empty-cta .tc-secondary {
  /* inherit existing button styling */
}
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "Your couch is fresh" js/app.js && grep -c "Your queue is empty" js/app.js && grep -c "Who's on the couch tonight" js/app.js && grep -c "seen everything in queue" js/app.js && grep -c "No alternative pick" js/app.js</automated>
    Expect: all ≥1.
  </verify>
  <done>
    - All 5 D-11 empty-state surfaces implemented with verbatim copy from CONTEXT.md.
    - Each empty state has 1-2 action-leading CTAs.
    - State (c) cushion-glow animation respects prefers-reduced-motion.
    - State (d) reveal-rewatch handler implemented.
    - State (e) Flow A→Flow B handoff implemented.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Add 7 push categories to NOTIFICATION_DEFAULTS (queuenight functions)</name>
  <files>C:\Users\nahde\queuenight\functions\index.js</files>
  <read_first>
    - C:\Users\nahde\queuenight\functions\index.js lines 60-90 (existing NOTIFICATION_DEFAULTS)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §13 (concrete diff)
  </read_first>
  <action>
1. **Use absolute path `C:\Users\nahde\queuenight\functions\index.js`** per S6 two-repo discipline. Locate `NOTIFICATION_DEFAULTS` at line 74-84.

2. Replace the Object.freeze with the extended version from PATTERNS.md §13 (verbatim):

```js
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

3. Add a comment marker `// === D-12 Phase 14 push categories — DECI-14-12 ===` immediately above the Phase 14 keys block.

4. Run `node --check C:/Users/nahde/queuenight/functions/index.js` to verify syntax.
  </action>
  <verify>
    <automated>node --check C:/Users/nahde/queuenight/functions/index.js && grep -cE "(flowAPick|flowAVoteOnPick|flowARejectMajority|flowBNominate|flowBCounterTime|flowBConvert|intentExpiring): true" C:/Users/nahde/queuenight/functions/index.js</automated>
    Expect: all 7 keys present (count ≥7 across the file; allowing for usage in branches too).
  </verify>
  <done>
    - 7 new keys appended to NOTIFICATION_DEFAULTS, all default true.
    - Existing 8 keys preserved verbatim.
    - File syntax check passes.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 5: Add 7 push categories to DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS (client side)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 100-110 (DEFAULT_NOTIFICATION_PREFS)
    - js/app.js lines 113-125 (NOTIFICATION_EVENT_LABELS)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §14 + §15 (concrete diffs)
    - .planning/phases/14-decision-ritual-core/14-CONTEXT.md D-12 push copy table (BRAND voice)
  </read_first>
  <action>
1. **DEFAULT_NOTIFICATION_PREFS** at js/app.js:100-110 — replace with extended version from PATTERNS.md §14 (verbatim, mirrors server map):

```js
const DEFAULT_NOTIFICATION_PREFS = Object.freeze({
  watchpartyScheduled: true,
  watchpartyStarting: true,
  titleApproval: true,
  inviteReceived: true,
  vetoCapReached: false,
  tonightPickChosen: false,
  intentProposed: true,
  intentMatched: true,
  // Phase 14 — DECI-14-12
  flowAPick: true,
  flowAVoteOnPick: true,
  flowARejectMajority: true,
  flowBNominate: true,
  flowBCounterTime: true,
  flowBConvert: true,
  intentExpiring: true
});
```

2. **NOTIFICATION_EVENT_LABELS** at js/app.js:113-125 — append 7 entries with BRAND-voice copy per PATTERNS.md §15:

```js
const NOTIFICATION_EVENT_LABELS = Object.freeze({
  // ... existing 8 entries preserved verbatim ...
  // Phase 14 — DECI-14-12 (BRAND-voice copy per D-12)
  flowAPick:           { label: "Tonight's pick chosen",      hint: "When someone on your couch picks a movie." },
  flowAVoteOnPick:     { label: "Couch voted on your pick",   hint: "When someone responds to a pick you made." },
  flowARejectMajority: { label: "Your pick was passed on",    hint: "When the couch asks you to pick again." },
  flowBNominate:       { label: "Watch with the couch?",      hint: "When someone wants to watch with you at a time." },
  flowBCounterTime:    { label: "Counter-time on your nom",   hint: "When someone counters with a different time." },
  flowBConvert:        { label: "Movie starting in 15 min",   hint: "When your nomination becomes a watchparty." },
  intentExpiring:      { label: "Tonight's pick expiring",    hint: "Heads-up that a tonight intent is about to expire." }
});
```

3. **Friendly-UI maps decision (CONFIRMED OVERRIDE 2026-04-25 at /gsd-plan-phase 14):** D-12's "mirroring Phase 12 POL-01 UI pattern" clause is OVERRIDDEN by user decision — see CONTEXT.md "DR-3 follow-up override" note at the bottom of the DR-3 reconciled callout. The Phase 12 friendly-UI maps (`NOTIF_UI_TO_SERVER_KEY`, `NOTIF_UI_LABELS`, `NOTIF_UI_DEFAULTS` at js/app.js:128-155) are NOT updated in this plan. The 7 new D-12 keys surface ONLY in the legacy `NOTIFICATION_EVENT_LABELS` Settings UI. Reason: RESEARCH §5 closing warning ("mixing the two will produce two settings screens that disagree") + risk of double-rendering toggles. Document in SUMMARY: "v34 D-12 push toggles surface in legacy Settings list only; Phase 12 friendly-UI parity captured as follow-up polish item per CONTEXT DR-3 override."

4. Run `node --check js/app.js`.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "flowAPick: true" js/app.js && grep -c "flowAPick:" js/app.js && grep -c "Tonight's pick chosen" js/app.js</automated>
    Expect: ≥1 each (DEFAULT pref + EVENT_LABELS entry).
  </verify>
  <done>
    - DEFAULT_NOTIFICATION_PREFS includes all 7 D-12 keys with default true.
    - NOTIFICATION_EVENT_LABELS includes all 7 D-12 keys with BRAND-voice copy verbatim.
    - Existing 8 entries preserved verbatim in both maps.
    - SUMMARY documents the friendly-UI maps deferral decision.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 6: Add v34 changelog entry + bump sw.js CACHE</name>
  <files>changelog.html, sw.js</files>
  <read_first>
    - changelog.html (full file, ~135 lines per RESEARCH metadata)
    - sw.js (head ~15 lines for CACHE constant)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §16 (changelog entry template)
  </read_first>
  <action>
1. **changelog.html** — locate the changelog-hero section + the existing v32 article block at line 67 (per PATTERNS.md §16). Insert IMMEDIATELY ABOVE the v32 article (changelog is reverse-chronological):

```html
<article class="release">
  <header class="release-h">
    <span class="release-version">v34</span>
    <span class="release-date">[deploy date YYYY-MM-DD] · Decision ritual</span>
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

   Replace `[deploy date YYYY-MM-DD]` with the actual deploy date at deploy time (Task 7).

2. **sw.js CACHE bump** — locate the CACHE constant (likely near the top of sw.js, around line 3-10). Change from `couch-v33.3-sentry-dsn` to `couch-v34.0-decision-ritual`. Note: Per CLAUDE.md / RUNBOOK §H, `bash scripts/deploy.sh 34.0-decision-ritual` auto-bumps sw.js CACHE. If using the deploy script, this is automatic; if editing manually, ensure the new CACHE string is exactly `couch-v34.0-decision-ritual`.

3. Run `node --check sw.js` to verify syntax (sw.js is JS).
  </action>
  <verify>
    <automated>grep -c "v34" changelog.html && grep -c "couch-v34" sw.js && node --check sw.js</automated>
    Expect: changelog has v34; sw.js CACHE bumped; sw.js parses.
  </verify>
  <done>
    - changelog.html v34 article inserted ABOVE v32 article in reverse-chronological order.
    - sw.js CACHE constant === 'couch-v34.0-decision-ritual'.
    - sw.js parses with node --check.
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 7: HUMAN-ACTION — Deploy CFs first, then couch hosting</name>
  <what-built>
    Plans 14-01..14-09 are code-complete. Final deploy ritual must respect order: queuenight CFs FIRST (so server-side NOTIFICATION_DEFAULTS knows the 7 new keys + onIntentCreated/onIntentUpdate/watchpartyTick branches are live), THEN couch hosting (so client UI starts surfacing toggle controls + writing rank-pick/nominate intents against a CF that knows how to handle them).
  </what-built>
  <how-to-verify>
    Per CLAUDE.md / RUNBOOK §H, deploy is a SCRIPTED action — Claude has user permission per `feedback_deploy_autonomy.md` (Couch project specifically). Execute in order:

    1. **Deploy CFs from queuenight repo:**
       ```bash
       cd C:/Users/nahde/queuenight
       firebase deploy --only functions
       ```
       Verify in Firebase Console: 4 CFs live in us-central1 with the Phase 14 changes (onIntentCreated, onIntentUpdate, watchpartyTick, sendToMembers). Check function logs for any startup errors.

    2. **Deploy couch hosting + rules:**
       ```bash
       cd C:/Users/nahde/claude-projects/couch
       bash scripts/deploy.sh 34.0-decision-ritual
       ```
       The script auto-bumps sw.js CACHE (if not already set in Task 6), stamps BUILD_DATE, mirrors to queuenight/public/, and runs `firebase deploy --only hosting`. Verify post-deploy: visit https://couchtonight.app — DevTools → Application → Service Workers → confirm new CACHE name is loaded.

    3. **Smoke test:** sign in to couchtonight.app, claim a couch seat, open Flow A picker, verify tier-ranked list renders. Open a tile → action sheet shows new D-04 buckets + "Watch with the couch?" entry. Tap "Watch with the couch?" → Flow B nominate UI opens.

    4. **Update changelog v34 deploy date:** edit changelog.html and replace `[deploy date YYYY-MM-DD]` with the actual deploy date. Re-run `bash scripts/deploy.sh 34.0.1-changelog-date` to push the dated changelog. (Optional but recommended for clean release notes.)

    5. **Close PR / commit:** stage all phase 14 files, commit with `feat(14): Decision Ritual Core — couch viz + 2 flows + extended intents + push (DECI-14-01..13)`, and push.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "deployed" — both repos deployed; smoke tests pass. SUMMARY records deploy timestamps + cache version.
    - "deploy-failed: <details>" — describe failure mode. Roll back if necessary (firebase hosting:rollback, firebase functions:delete + redeploy from previous tag).
    - "deferred" — defer deploy to a separate session. SUMMARY records the deferral; phase remains code-complete pending deploy.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → members/{id}.seenTooltips | New per-user-per-primitive flag map; member-doc update rule must permit |
| Cloud Function NOTIFICATION_DEFAULTS map | Server-side gate — keys here become user-toggleable; missing keys fall through to default-on (Pitfall #5 in CONTEXT) |
| sw.js CACHE constant | Bumping invalidates installed PWAs — required for any user-visible client change |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.09-01 | Tampering | A member writes seenTooltips for another member | mitigate | members/{id} update rule scoped to actor identity (Phase 5 attribution) |
| T-14.09-02 | Information Disclosure | Push toggle exists in UI but server ignores → user thinks they opted out but pushes still flow | mitigate | DR-3's 3-place add ensures NOTIFICATION_DEFAULTS knows the keys; sendToMembers reads prefs against this map (functions/index.js:114) |
| T-14.09-03 | Stale UI | Installed PWA serves v33.3 shell after v34 deploy | mitigate | sw.js CACHE bump triggers re-fetch on next online activation |
</threat_model>

<verification>
- `node --check js/utils.js` → exit 0.
- `node --check js/app.js` → exit 0.
- `node --check sw.js` → exit 0.
- `node --check C:/Users/nahde/queuenight/functions/index.js` → exit 0.
- `grep -c "export function showTooltipAt" js/utils.js` → 1.
- `grep -c "maybeShowTooltip" js/app.js` → ≥4 (definition + 3 callsites).
- `grep -c "seenTooltips" js/app.js` → ≥2.
- `grep -c "Your couch is fresh" js/app.js` → 1.
- `grep -c "Your queue is empty" js/app.js` → 1.
- `grep -c "Who's on the couch tonight" js/app.js` → 1.
- `grep -c "seen everything in queue" js/app.js` → 1.
- `grep -c "No alternative pick" js/app.js` → 1.
- `grep -c "flowAPick: true" C:/Users/nahde/queuenight/functions/index.js` → 1.
- `grep -c "flowAPick: true" js/app.js` → 1.
- `grep -c "Tonight's pick chosen" js/app.js` → 1.
- `grep -c "v34" changelog.html` → ≥1.
- `grep -c "couch-v34" sw.js` → 1.
- All 7 D-12 keys present in NOTIFICATION_DEFAULTS, DEFAULT_NOTIFICATION_PREFS, NOTIFICATION_EVENT_LABELS.
- Task 7 deploy resolved.
</verification>

<success_criteria>
1. showTooltipAt + hideTooltip exported from js/utils.js with .coach-tip CSS.
2. 3 anchored tooltips fire once per user (Couch viz / tile action sheet / Library queue).
3. 5 D-11 empty states implemented with action-leading CTAs (no dead ends).
4. 7 D-12 push categories present in all 3 maps (NOTIFICATION_DEFAULTS server, DEFAULT_NOTIFICATION_PREFS client, NOTIFICATION_EVENT_LABELS client labels).
5. changelog.html v34 entry inserted reverse-chronologically.
6. sw.js CACHE bumped to couch-v34.0-decision-ritual.
7. Deploy executed in correct order (CFs first, then hosting) with smoke tests passing.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md` documenting:
- Insertion file:line for showTooltipAt + maybeShowTooltip + 3 callsites + 5 empty states.
- Friendly-UI maps deferral decision (DR-3 optional fourth touch).
- Deploy timestamps + verified CACHE version.
- Cross-plan dependency closure: 14-06 push eventTypes are now backed by client + server defaults; 14-04 + 14-05 + 14-07 + 14-08 surfaces all show new tooltips/empty-states/push toggles.
- Phase 14 closure rollup: 13 DECI-* requirements, 9 plans, X commits, deployed at couch-v34.0-decision-ritual.
</output>
