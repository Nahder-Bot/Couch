---
phase: 14-decision-ritual-core
plan: 07
type: execute
wave: 3
depends_on: [14-01, 14-03, 14-04, 14-06]
files_modified:
  - js/app.js
  - css/app.css
autonomous: false
requirements_addressed: [DECI-14-07]
must_haves:
  truths:
    - "Tonight tab surfaces a 'Pick a movie' CTA when state.couchMemberIds has ≥1 entry; tap opens the Flow A picker UI."
    - "Picker UI renders the 3-tier ranked list (T1 + T2; T3 hidden behind expand toggle gated by resolveT3Visibility) using getTierOneRanked / getTierTwoRanked / getTierThreeRanked from 14-03."
    - "Picker selects a title → roster screen showing all couch members with proxy-confirm taps; tapping a member marks them 'in' (writes rsvps[mid] = {state:'in', proxyConfirmedBy: state.me.id}) and excludes them from the push fan-out."
    - "On 'Send picks' from roster screen: createIntent({flow:'rank-pick', titleId, expectedCouchMemberIds: state.couchMemberIds}) is called; remaining unconfirmed members get the flowAPick push (delivered by 14-06's onIntentCreated CF)."
    - "Per-recipient response UI (when a flowAPick push lands): 3 buttons — In / Reject / Drop. Selecting Reject can attach a counter-nomination via a sub-flow (pick a different title from the same ranked list)."
    - "Reject-majority detection: client subscribes to the intent doc via state.unsubIntents (existing); when count of state==='reject' rsvps reaches majority of expectedCouchMemberIds, picker UI surfaces a #2 prompt: 'Pick another title' (re-renders ranked list excluding the rejected one); 1 retry then expire."
    - "Counter-nomination submission writes rsvps[me] = {state:'reject', counterTitleId} AND atomically increments counterChainDepth (bounded ≤ 3 by rules from 14-06); at counterChainDepth === 3 the picker UI surfaces 'X options on the table — pick one or end nomination' and disables further counter inputs."
    - "Conversion at quorum (picker + ≥1 in): UI shows 'Convert to watchparty' button on picker screen; tap writes intent.status='converted' + creates watchparty doc via existing watchparty-start flow (or by setting status only and letting the lobby flow take over per Phase 11-05)."
  artifacts:
    - path: "js/app.js"
      provides: "Flow A picker entry CTA + picker UI render + roster proxy-confirm + reject/counter handlers + #2 retry logic + convert handler"
      contains: "openFlowAPicker"
      min_lines_added: 250
    - path: "css/app.css"
      provides: "Flow A picker, roster, response, counter-chain UI styling"
      contains: ".flow-a-picker"
      min_lines_added: 100
  key_links:
    - from: "Tonight tab Flow A entry CTA"
      to: "openFlowAPicker()"
      via: "button onclick"
      pattern: "openFlowAPicker\\("
    - from: "Picker title selection"
      to: "createIntent({flow:'rank-pick',...}) from 14-06"
      via: "function call"
      pattern: "createIntent\\(\\{\\s*flow:\\s*['\"]rank-pick"
    - from: "Reject-majority + counter-chain detection"
      to: "state.unsubIntents snapshot listener (existing)"
      via: "client-side state observation"
      pattern: "state\\.unsubIntents"
---

<objective>
Implement Flow A — group rank-pick + push-confirm — per D-07. Picker UI launched from Tonight tab with couch claimed; tier-ordered ranked list (T1/T2/T3); roster screen with proxy-confirm + send-picks; per-recipient response UI (In/Reject/Drop) with counter-nomination affordance; reject-majority retry (1 retry then expire); counter-chain capped at 3 levels; quorum-based convert to watchparty.

Purpose: Flow A is the first of two parallel decision flows that constitute the new ritual. It captures the "we're together on the couch RIGHT NOW, who's picking?" UX with a low-friction pick-confirm-go loop. The proxy-confirm step is the critical UX innovation — instead of pushing everyone in person on the same couch (annoying), the picker taps to mark them "in" and only people not on the couch get pushes.

Output: One large interconnected UI module: openFlowAPicker entry, renderPickerList (consumes 14-03 aggregators), renderRosterScreen, sendPicks handler (calls createIntent from 14-06), per-recipient response UI, counter-nomination sub-flow, reject-majority detection (subscribes to state.intents), convert handler. CSS for the new screens.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 3 (depends on Waves 1+2). Hard depends on:
- 14-01 (isWatchedByCouch — already-watched filter)
- 14-03 (getTierOneRanked + getTierTwoRanked + getTierThreeRanked + resolveT3Visibility)
- 14-04 (state.couchMemberIds — populated by claim-cushion)
- 14-06 (createIntent with flow:'rank-pick' + onIntentCreated flowAPick push + onIntentUpdate counter-chain handlers + watchpartyTick T-30min warning)

**Two-repo discipline:** Couch-side only — repo-relative paths.

**No primitive build:** the Firestore primitive is owned by 14-06; this plan is UI + thin client logic only. All state changes go through `createIntent` and `setIntentRsvp` (existing or extended in 14-06).
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
**Tier aggregators (from 14-03)** — `getTierOneRanked(couchMemberIds) → [{title, meanRank, ratingTie}]`; same shape for T2 and T3 with extra fields. Sorted ascending by mean rank.

**Couch composition (from 14-04)** — `state.couchMemberIds: string[]` populated by claimCushion, hydrated from family-doc `couchSeating` field on snapshot.

**Intent helpers (from 14-06)** — `createIntent({flow, titleId, expectedCouchMemberIds, ...}) → intentId`. Existing intents subscription `state.unsubIntents = onSnapshot(intentsRef(), ...)` at js/app.js:3560-3564 hydrates `state.intents = [...]`.

**Existing setIntentRsvp** (Phase 8) — likely at js/app.js near intent helpers; signature `setIntentRsvp(intentId, value, opts)`. Phase 14 needs the new state vocab ('in', 'reject', 'drop') accepted; if the existing function only accepts 'yes'/'no'/'maybe'/'later', extend it OR add a sibling `setIntentRsvpFlowAB` that writes the new shape.

**Existing action-sheet primitive** at js/app.js:11853 — usable for the response UI (3 In/Reject/Drop buttons).

**Existing watchparty start flow** — search for `openWatchpartyStart` (referenced in tile action sheet). The convert step calls this OR mirrors its behavior to create the watchparty doc.

**Existing inline-handler idiom** — `onclick="windowFn('${id}')"`. Match for all new buttons in this plan.

**resolveT3Visibility() from 14-03** — returns boolean; T3 expand toggle UI must read this and skip rendering the toggle when false.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add Flow A entry CTA to Tonight tab + openFlowAPicker entry function</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js — Grep for `function renderTonight` or `tab === 'tonight'` to locate the Tonight render path
    - js/app.js (after 14-04) — confirm rerenderCouchViz hook + state.couchMemberIds availability
    - js/app.js (after 14-03) — confirm getTierOneRanked + getTierTwoRanked + getTierThreeRanked + resolveT3Visibility helpers exist
  </read_first>
  <action>
1. Locate the Tonight tab render path. After `rerenderCouchViz()` is called (added in 14-04), inject the Flow A entry CTA into a new container.

2. Add this composable HTML right after the couch viz container (in app.html OR via dynamic innerHTML in the render function — match existing render strategy):

```html
<div id="flow-a-entry-container" class="flow-a-entry-container"></div>
```

3. In js/app.js, add a render function called from the Tonight render path:

```js
// === D-07 Flow A entry — DECI-14-07 ===
function renderFlowAEntry() {
  const container = document.getElementById('flow-a-entry-container');
  if (!container) return;
  const couchSize = (state.couchMemberIds || []).filter(Boolean).length;
  if (couchSize < 1) {
    container.innerHTML = ''; // no couch claimed yet — couch viz drives that affordance
    return;
  }
  // Check whether an open Flow A intent already exists for this couch.
  const openFlowA = (state.intents || []).find(i =>
    (i.flow === 'rank-pick' || i.type === 'rank-pick') && i.status === 'open'
  );
  if (openFlowA) {
    container.innerHTML = `<div class="flow-a-active">
      <div class="flow-a-active-h">Picking happening</div>
      <p class="flow-a-active-body">A pick is in progress. Watching for responses…</p>
      <button class="tc-primary" type="button" onclick="openFlowAResponseScreen('${openFlowA.id}')">Open</button>
    </div>`;
    return;
  }
  container.innerHTML = `<div class="flow-a-entry">
    <div class="flow-a-entry-h">Pick a movie for the couch</div>
    <p class="flow-a-entry-body">${couchSize} ${couchSize === 1 ? 'person is' : 'people are'} on the couch. Pick from your shared queue.</p>
    <button class="tc-primary" type="button" onclick="openFlowAPicker()">Open picker</button>
  </div>`;
}

window.openFlowAPicker = function() {
  if (!state.me) { flashToast('Sign in to pick', { kind: 'warn' }); return; }
  const couch = (state.couchMemberIds || []).filter(Boolean);
  if (!couch.length) { flashToast('Claim a seat on the couch first', { kind: 'warn' }); return; }
  renderFlowAPickerScreen(); // Task 2
};
```

4. Wire `renderFlowAEntry()` into the Tonight render path AND into the state.unsubIntents snapshot handler (so the entry CTA flips between "Open picker" and "Picking happening" reactively when a Flow A intent opens or closes).

5. CSS additions to css/app.css:

```css
/* === D-07 Flow A entry CTA — DECI-14-07 === */
.flow-a-entry, .flow-a-active {
  background: var(--c-bg-elevated, #1f1a16);
  padding: var(--s3);
  border-radius: var(--r-lg, 12px);
  margin: var(--s4) 0;
  border: 1px solid var(--c-warm-amber, #d4a574);
}
.flow-a-entry-h, .flow-a-active-h {
  font-family: var(--font-serif, 'Instrument Serif', serif);
  font-size: 22px;
  color: var(--c-text-strong, #e8dcc4);
}
.flow-a-entry-body, .flow-a-active-body {
  color: var(--c-text-body, #c4b89e);
  margin: var(--s2) 0 var(--s3);
}
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "window.openFlowAPicker" js/app.js && grep -c "flow-a-entry" css/app.css</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - renderFlowAEntry called from Tonight render path AND state.unsubIntents handler.
    - openFlowAPicker entry function defined and window-scoped.
    - CSS rules for .flow-a-entry + .flow-a-active present.
    - Entry CTA only renders when couch has ≥1 claimed member.
    - When a Flow A intent is open, entry CTA flips to "Picking happening" + Open button.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Implement Flow A picker UI — tier-ranked list with T3 expand toggle</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js (after 14-03) — getTierOneRanked / getTierTwoRanked / getTierThreeRanked / resolveT3Visibility signatures
    - js/app.js — existing modal patterns (search `modal-bg` for the canonical full-screen modal class)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md S4 (inline onclick attribution)
  </read_first>
  <action>
1. Add a full-screen modal-style picker UI rendered into a new container `<div id="flow-a-picker-modal">` (added to app.html OR created on-demand via `document.createElement`).

2. Add to js/app.js:

```js
function renderFlowAPickerScreen() {
  // Lazy-create the modal container if absent.
  let modal = document.getElementById('flow-a-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-a-picker-modal';
    modal.className = 'modal-bg flow-a-picker-modal';
    document.body.appendChild(modal);
  }
  const couch = (state.couchMemberIds || []).filter(Boolean);
  const t1 = getTierOneRanked(couch);
  const t2 = getTierTwoRanked(couch);
  const t3 = getTierThreeRanked(couch);
  const showT3 = resolveT3Visibility();

  const renderRow = (entry, tier) => {
    const t = entry.title;
    return `<div class="flow-a-row" role="button" tabindex="0"
      onclick="onFlowAPickerSelect('${t.id}')"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();onFlowAPickerSelect('${t.id}');}">
      <div class="flow-a-row-poster" style="background-image:url('${escapeHtml(t.poster || '')}')"></div>
      <div class="flow-a-row-meta">
        <div class="flow-a-row-name">${escapeHtml(t.name || '')}</div>
        <div class="flow-a-row-tier">Tier ${tier}${entry.meanRank != null ? ` · mean rank ${entry.meanRank.toFixed(1)}` : ''}${entry.couchPresenceCount != null ? ` · ${entry.couchPresenceCount} couch member${entry.couchPresenceCount === 1 ? '' : 's'}` : ''}</div>
      </div>
    </div>`;
  };

  const t1Html = t1.length ? `<section class="flow-a-section">
    <h3 class="flow-a-section-h">Tier 1 — everyone wants this</h3>
    ${t1.slice(0, 10).map(e => renderRow(e, 1)).join('')}
  </section>` : '';

  const t2Html = t2.length ? `<section class="flow-a-section">
    <h3 class="flow-a-section-h">Tier 2 — some couch interest</h3>
    ${t2.slice(0, 10).map(e => renderRow(e, 2)).join('')}
  </section>` : '';

  const t3Html = (showT3 && t3.length) ? `<section class="flow-a-section flow-a-section-t3" data-expanded="false">
    <button class="flow-a-t3-toggle" type="button" onclick="onFlowAToggleT3(this)">Show off-couch picks (${t3.length})</button>
    <div class="flow-a-t3-body" hidden>
      <p class="flow-a-t3-warn">Watching titles only off-couch members want.</p>
      ${t3.slice(0, 10).map(e => renderRow(e, 3)).join('')}
    </div>
  </section>` : '';

  const emptyState = (!t1.length && !t2.length && !(showT3 && t3.length))
    ? `<div class="queue-empty">
        <span class="emoji">🛋️</span>
        <strong>No candidates left</strong>
        Everyone on the couch has watched everything in queue. Add titles or expand rewatch options.
      </div>`
    : '';

  modal.innerHTML = `<div class="modal-content flow-a-picker-content">
    <header class="flow-a-picker-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close picker">✕</button>
      <h2>Pick a movie</h2>
      <p>Tap a title to send it to the couch.</p>
    </header>
    <div class="flow-a-picker-body">
      ${t1Html}
      ${t2Html}
      ${t3Html}
      ${emptyState}
    </div>
  </div>`;
  modal.classList.add('on');
}

window.onFlowAToggleT3 = function(btn) {
  const section = btn.closest('.flow-a-section-t3');
  if (!section) return;
  const body = section.querySelector('.flow-a-t3-body');
  if (!body) return;
  const expanded = section.dataset.expanded === 'true';
  section.dataset.expanded = expanded ? 'false' : 'true';
  body.hidden = expanded;
  btn.textContent = expanded ? `Show off-couch picks` : `Hide off-couch picks`;
};

window.closeFlowAPicker = function() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (modal) modal.classList.remove('on');
};

window.onFlowAPickerSelect = function(titleId) {
  // Stash the picked title and advance to roster screen (Task 3).
  state.flowAPickerTitleId = titleId;
  renderFlowARosterScreen();
};
```

3. CSS additions:

```css
/* === D-07 Flow A picker — DECI-14-07 === */
.flow-a-picker-modal { display: none; }
.flow-a-picker-modal.on { display: flex; }
.flow-a-picker-content {
  width: min(720px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--s4);
}
.flow-a-section { margin-bottom: var(--s4); }
.flow-a-section-h {
  font-family: var(--font-serif, 'Instrument Serif', serif);
  font-size: 18px;
  margin: 0 0 var(--s2);
  color: var(--c-text-strong, #e8dcc4);
}
.flow-a-row {
  display: flex;
  align-items: center;
  gap: var(--s3);
  padding: var(--s2);
  border-radius: var(--r-md, 8px);
  cursor: pointer;
  transition: background-color var(--t-shimmer, 200ms) var(--ease-out, ease-out);
}
.flow-a-row:hover, .flow-a-row:focus-visible {
  background: var(--c-bg-elevated, #1f1a16);
}
.flow-a-row-poster {
  width: 60px; height: 90px;
  background-size: cover;
  background-position: center;
  border-radius: var(--r-sm, 4px);
  flex-shrink: 0;
}
.flow-a-row-name { font-weight: 600; color: var(--c-text-strong, #e8dcc4); }
.flow-a-row-tier { font-size: 13px; color: var(--c-text-dim, #8a7d6e); margin-top: 2px; }
.flow-a-t3-toggle {
  appearance: none;
  background: transparent;
  border: 1px dashed var(--c-text-dim, #8a7d6e);
  color: var(--c-text-dim, #8a7d6e);
  padding: var(--s2) var(--s3);
  border-radius: var(--r-md, 8px);
  cursor: pointer;
  width: 100%;
  text-align: left;
}
.flow-a-t3-warn {
  font-size: 12px;
  color: var(--c-text-dim, #8a7d6e);
  font-style: italic;
  margin: var(--s2) 0;
}
.modal-bg { /* shared modal-bg already exists; if not, add: */
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.6);
  z-index: 100;
  align-items: flex-start;
  justify-content: center;
  padding: var(--s4);
}
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "function renderFlowAPickerScreen" js/app.js && grep -c "resolveT3Visibility()" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - Picker UI renders T1, T2, T3 (gated on resolveT3Visibility) sections.
    - T3 toggle expand/collapse works; default collapsed.
    - Empty state renders when all 3 tiers empty.
    - Title selection advances to roster screen (Task 3).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Roster screen — proxy-confirm, send-picks, createIntent call</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js (after 14-06) — createIntent signature accepting flow + expectedCouchMemberIds
    - js/app.js — existing memberColor + escapeHtml helpers
  </read_first>
  <action>
1. Add to js/app.js:

```js
function renderFlowARosterScreen() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (!modal) return;
  const couch = (state.couchMemberIds || []).filter(Boolean);
  const t = state.titles.find(x => x.id === state.flowAPickerTitleId);
  if (!t) { closeFlowAPicker(); flashToast('Title no longer available', { kind: 'warn' }); return; }

  // state.flowAProxyConfirmed: Set of memberIds the picker has confirmed in-person.
  if (!state.flowAProxyConfirmed) state.flowAProxyConfirmed = new Set();

  const couchMembers = couch.map(mid => (state.members || []).find(m => m.id === mid)).filter(Boolean);

  const memberRows = couchMembers.map(m => {
    const isMe = state.me && m.id === state.me.id;
    const confirmed = isMe || state.flowAProxyConfirmed.has(m.id);
    return `<button class="flow-a-roster-member ${confirmed ? 'confirmed' : ''}" type="button"
      onclick="onFlowAToggleConfirm('${m.id}')"
      ${isMe ? 'disabled aria-label="You — auto-in"' : ''}>
      <div class="flow-a-roster-avatar" style="background:${memberColor(m.id)}">${escapeHtml((m.name||'?')[0].toUpperCase())}</div>
      <span class="flow-a-roster-name">${escapeHtml(m.name || 'Member')}${isMe ? ' (you)' : ''}</span>
      <span class="flow-a-roster-status">${confirmed ? '✓ in' : 'tap to mark in-person'}</span>
    </button>`;
  }).join('');

  const unconfirmedCount = couchMembers.filter(m => {
    const isMe = state.me && m.id === state.me.id;
    return !isMe && !state.flowAProxyConfirmed.has(m.id);
  }).length;

  modal.innerHTML = `<div class="modal-content flow-a-roster-content">
    <header class="flow-a-roster-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t.name)}</h2>
      <p>Mark members already in-person; the rest get a push.</p>
    </header>
    <div class="flow-a-roster-list">${memberRows}</div>
    <footer class="flow-a-roster-footer">
      <button class="tc-secondary" type="button" onclick="renderFlowAPickerScreen()">Back</button>
      <button class="tc-primary" type="button" onclick="onFlowASendPicks()">
        Send picks${unconfirmedCount > 0 ? ` (${unconfirmedCount} push${unconfirmedCount === 1 ? '' : 'es'})` : ''}
      </button>
    </footer>
  </div>`;
}

window.onFlowAToggleConfirm = function(memberId) {
  if (!state.flowAProxyConfirmed) state.flowAProxyConfirmed = new Set();
  if (state.me && memberId === state.me.id) return; // self always confirmed
  if (state.flowAProxyConfirmed.has(memberId)) {
    state.flowAProxyConfirmed.delete(memberId);
  } else {
    state.flowAProxyConfirmed.add(memberId);
  }
  renderFlowARosterScreen(); // re-render
};

window.onFlowASendPicks = async function() {
  const titleId = state.flowAPickerTitleId;
  const couch = (state.couchMemberIds || []).filter(Boolean);
  if (!titleId || !couch.length) return;

  // Compute who needs a push: couch members minus picker minus proxy-confirmed.
  const expected = couch.slice(); // expectedCouchMemberIds = the full couch
  // Those NOT getting a push (proxy-confirmed in-person) get rsvps[mid] = {state:'in', proxyConfirmedBy: state.me.id}
  // pre-seeded via the createIntent call; the CF push fan-out filter (added in 14-06 task 3 as
  // expectedCouchMemberIds intersection) needs an additional skip for already-'in' rsvps.
  // Actual implementation: createIntent seeds rsvps[me] only; we follow up with setIntentRsvp for proxy-confirms.

  let intentId;
  try {
    intentId = await createIntent({
      flow: 'rank-pick',
      titleId,
      expectedCouchMemberIds: expected
    });
  } catch (e) {
    console.error('[flowA] createIntent failed', e);
    flashToast('Could not send picks — try again', { kind: 'warn' });
    return;
  }

  // Pre-seed proxy-confirmed members' rsvps so they're not pushed.
  // setIntentRsvp signature: (intentId, value, opts) — adapt per existing function or call updateDoc directly.
  for (const mid of state.flowAProxyConfirmed) {
    try {
      await updateDoc(doc(intentRef(intentId)), {
        [`rsvps.${mid}`]: {
          state: 'in',
          proxyConfirmedBy: state.me.id,
          at: Date.now(),
          actingUid: (state.auth && state.auth.uid) || null,
          memberName: (state.members.find(m => m.id === mid) || {}).name || null
        },
        ...writeAttribution()
      });
    } catch (e) {
      console.warn('[flowA] proxy-confirm seed failed for', mid, e);
    }
  }

  // Reset proxy state.
  state.flowAProxyConfirmed = new Set();
  state.flowAPickerTitleId = null;

  flashToast('Picks sent. Watching for responses…', { kind: 'success' });
  closeFlowAPicker();
  // Open response screen so the picker can watch live progress.
  setTimeout(() => openFlowAResponseScreen(intentId), 100);
};
```

Note: `intentRef` is a Phase 8 helper at js/app.js:1387 — confirms `intentRef(intentId)` exists; if signature differs (e.g. `intentRef()` returns the collection ref, not a doc ref), use `doc(intentRef(), intentId)` instead.

2. CSS additions:

```css
/* === D-07 Flow A roster — DECI-14-07 === */
.flow-a-roster-content {
  width: min(560px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: var(--s4);
}
.flow-a-roster-list { display: flex; flex-direction: column; gap: var(--s2); margin: var(--s3) 0; }
.flow-a-roster-member {
  appearance: none;
  background: var(--c-bg-elevated, #1f1a16);
  border: 1px solid transparent;
  padding: var(--s3);
  border-radius: var(--r-md, 8px);
  display: flex;
  align-items: center;
  gap: var(--s3);
  cursor: pointer;
  text-align: left;
  width: 100%;
}
.flow-a-roster-member.confirmed {
  border-color: var(--c-warm-amber, #d4a574);
  background: var(--c-bg-elevated, #1f1a16);
}
.flow-a-roster-member:disabled { opacity: 0.7; cursor: default; }
.flow-a-roster-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: var(--c-text-on-avatar, #fff);
  font-weight: 700;
}
.flow-a-roster-name { flex: 1; color: var(--c-text-strong, #e8dcc4); }
.flow-a-roster-status { font-size: 12px; color: var(--c-text-dim, #8a7d6e); }
.flow-a-roster-footer {
  display: flex;
  gap: var(--s2);
  justify-content: space-between;
  margin-top: var(--s4);
}
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "renderFlowARosterScreen" js/app.js && grep -c "createIntent\\(\\{[^}]*flow:[^}]*['\"]rank-pick" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - Roster screen lists couch members with proxy-confirm taps.
    - State.me always confirmed (auto-in).
    - Send Picks calls createIntent with flow:'rank-pick' + expectedCouchMemberIds.
    - Proxy-confirmed members get rsvps[mid] = {state:'in', proxyConfirmedBy} pre-seeded so they don't get pushed.
    - Send Picks transitions to response screen for the picker.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Response screen + Reject-majority detection + Counter-nomination sub-flow + Convert handler</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js — existing intent state.unsubIntents listener at js/app.js:3560-3564
    - js/app.js (after 14-06) — counterChainDepth field semantics (cap at 3)
  </read_first>
  <action>
1. Add to js/app.js:

```js
window.openFlowAResponseScreen = function(intentId) {
  // Render the live-state response screen for this intent.
  // For non-pickers: shows In/Reject/Drop buttons; tapping Reject opens counter-nomination sub-flow.
  // For picker: shows live tally + reject-majority handling + #2 prompt + convert button.
  let modal = document.getElementById('flow-a-picker-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-a-picker-modal';
    modal.className = 'modal-bg flow-a-picker-modal';
    document.body.appendChild(modal);
  }
  state.flowAOpenIntentId = intentId;
  renderFlowAResponseScreen();
  modal.classList.add('on');
};

function renderFlowAResponseScreen() {
  const modal = document.getElementById('flow-a-picker-modal');
  if (!modal) return;
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowAPicker(); return; }
  const t = state.titles.find(x => x.id === intent.titleId);
  const isPicker = intent.createdBy === (state.me && state.me.id);
  const myRsvp = (intent.rsvps || {})[state.me && state.me.id];

  // Tallies
  const expected = intent.expectedCouchMemberIds || [];
  const ins = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'in').length;
  const rejects = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'reject').length;
  const drops = expected.filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'drop').length;
  const rejectMajority = rejects > expected.length / 2;
  const counterDepth = intent.counterChainDepth || 0;

  // PICKER VIEW
  if (isPicker) {
    const canConvert = ins >= 1; // quorum: picker + ≥1 in
    const showCounterCap = counterDepth >= 3;
    modal.innerHTML = `<div class="modal-content flow-a-response-content">
      <header class="flow-a-response-h">
        <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
        <h2>${escapeHtml(t ? t.name : 'Pick')}</h2>
        <p>Live tally — ${ins} in · ${rejects} reject · ${drops} drop · counter chain ${counterDepth}/3</p>
      </header>
      <div class="flow-a-response-body">
        ${rejectMajority && counterDepth < 3 ? `<div class="flow-a-rejected-cta">
          <strong>Reject majority hit.</strong>
          <p>Pick another title (1 retry then expire).</p>
          <button class="tc-primary" type="button" onclick="onFlowARetryPick()">Pick #2</button>
        </div>` : ''}
        ${showCounterCap ? `<div class="flow-a-counter-cap">
          <strong>${counterDepth} options on the table.</strong>
          <p>No more counters. Pick one or end nomination.</p>
        </div>` : ''}
        ${canConvert ? `<button class="tc-primary" type="button" onclick="onFlowAConvert()">Start watchparty (${ins} in)</button>` : ''}
        <button class="tc-secondary" type="button" onclick="onFlowACancel()">End nomination</button>
      </div>
    </div>`;
    return;
  }

  // RECIPIENT VIEW
  const responded = !!myRsvp;
  modal.innerHTML = `<div class="modal-content flow-a-response-content">
    <header class="flow-a-response-h">
      <button class="modal-close" type="button" onclick="closeFlowAPicker()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t ? t.name : 'Pick')}</h2>
      <p>${escapeHtml(intent.createdByName || 'Picker')} picked this for the couch.</p>
    </header>
    <div class="flow-a-response-body">
      ${responded ? `<div class="flow-a-already">You said: ${myRsvp.state || myRsvp.value}</div>` : ''}
      <button class="tc-primary" type="button" onclick="onFlowARespond('in')">In</button>
      <button class="tc-secondary" type="button" onclick="onFlowAOpenCounterSubflow()">Reject + counter</button>
      <button class="tc-secondary" type="button" onclick="onFlowARespond('reject')">Reject</button>
      <button class="tc-secondary" type="button" onclick="onFlowARespond('drop')">Drop</button>
    </div>
  </div>`;
}

// Re-render the response screen on every intents snapshot tick (live tally updates).
function maybeRerenderFlowAResponse() {
  if (state.flowAOpenIntentId) renderFlowAResponseScreen();
}

window.onFlowARespond = async function(stateValue) {
  const intentId = state.flowAOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${state.me.id}`]: {
        state: stateValue,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast(`Recorded: ${stateValue}`, { kind: 'success' });
  } catch (e) {
    console.error('[flowA] respond failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowAOpenCounterSubflow = function() {
  // Counter-nomination: open a mini picker reusing the same tier-ranked list.
  // User selects a different title; on confirm, write rsvps[me].counterTitleId AND increment counterChainDepth.
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counterDepth = intent.counterChainDepth || 0;
  if (counterDepth >= 3) {
    flashToast('Counter chain full — pick from current options', { kind: 'warn' });
    return;
  }
  // Stash the active intent and re-render picker for counter-nom selection.
  state.flowACounterFor = intentId;
  state.flowAPickerTitleId = null;
  renderFlowAPickerScreen(); // reuse picker UI; onFlowAPickerSelect (Task 2) checks flowACounterFor and routes accordingly
  // NOTE: extend onFlowAPickerSelect (Task 2) to check `if (state.flowACounterFor) { submitCounterNom(titleId); return; }`
};

async function submitCounterNom(titleId) {
  const intentId = state.flowACounterFor;
  if (!intentId || !state.me) return;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const newDepth = (intent.counterChainDepth || 0) + 1;
  if (newDepth > 3) { flashToast('Counter chain cap reached', { kind: 'warn' }); return; }
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${state.me.id}`]: {
        state: 'reject',
        counterTitleId: titleId,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      counterChainDepth: newDepth,
      ...writeAttribution()
    });
    flashToast('Counter-nomination sent', { kind: 'success' });
    state.flowACounterFor = null;
    closeFlowAPicker();
    setTimeout(() => openFlowAResponseScreen(intentId), 100);
  } catch (e) {
    console.error('[flowA] counter-nom failed', e);
    flashToast('Could not send counter-nomination', { kind: 'warn' });
  }
}
```

3. **CRITICAL — extend onFlowAPickerSelect from Task 2**: at the top of that function, add:
```js
if (state.flowACounterFor) {
  submitCounterNom(titleId);
  return;
}
```

4. **Add the convert handler**:

```js
window.onFlowAConvert = async function() {
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent || !state.me) return;
  // Quorum check (UI-side; server-side enforced by createdByUid match in rules).
  const ins = (intent.expectedCouchMemberIds || []).filter(mid => ((intent.rsvps || {})[mid] || {}).state === 'in').length;
  if (ins < 1) { flashToast('Need ≥1 confirmed in', { kind: 'warn' }); return; }
  // Create watchparty doc — reuse openWatchpartyStart pattern OR do inline.
  // Inline (since openWatchpartyStart opens UI; we want the wp doc only here).
  try {
    const wpRef = await addDoc(watchpartiesRef(), {
      status: 'scheduled',
      hostId: state.me.id,
      hostUid: (state.auth && state.auth.uid) || null,
      hostName: state.me.name || null,
      titleId: intent.titleId,
      startAt: Date.now() + 5 * 60 * 1000, // 5min from now (lobby flow takes over)
      createdAt: Date.now(),
      convertedFromIntentId: intent.id,
      ...writeAttribution()
    });
    await updateDoc(doc(intentRef(intentId)), {
      status: 'converted',
      convertedToWpId: wpRef.id,
      convertedTo: wpRef.id, // back-compat
      ...writeAttribution()
    });
    flashToast('Converted to watchparty — heading there', { kind: 'success' });
    closeFlowAPicker();
    if (typeof openWatchpartyLive === 'function') openWatchpartyLive(wpRef.id);
  } catch (e) {
    console.error('[flowA] convert failed', e);
    flashToast('Convert failed — try again', { kind: 'warn' });
  }
};

window.onFlowACancel = async function() {
  const intentId = state.flowAOpenIntentId;
  if (!intentId) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      ...writeAttribution()
    });
    state.flowAOpenIntentId = null;
    closeFlowAPicker();
    flashToast('Nomination ended', { kind: 'info' });
  } catch (e) {
    console.error('[flowA] cancel failed', e);
  }
};

window.onFlowARetryPick = function() {
  // Open the picker again, EXCLUDING the rejected title from the candidate list.
  // Implementation: stash the current intent's titleId in state.flowARejectedTitles for the next picker render.
  const intentId = state.flowAOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  if (!state.flowARejectedTitles) state.flowARejectedTitles = new Set();
  state.flowARejectedTitles.add(intent.titleId);
  // Cancel the current intent (reject-majority retry pattern: 1 retry, then expire).
  // Mark it converted/cancelled and start a new intent with the next pick.
  // Per D-07: "1 retry, then expire" — we hand the picker back to the picker screen with the
  // rejected title excluded; if they pick again and that gets rejected, the second intent expires
  // naturally at 11pm (no third retry surfaced).
  state.flowACounterFor = null;
  // Go back to picker.
  closeFlowAPicker();
  setTimeout(() => openFlowAPicker(), 100);
};
```

5. **Wire the live re-render** into state.unsubIntents handler. After `state.intents = s.docs.map(d => d.data());` add:
```js
if (typeof maybeRerenderFlowAResponse === 'function') maybeRerenderFlowAResponse();
if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
```

6. **Extend renderFlowAPickerScreen to filter out rejected titles** (from the retry path): in Task 2's render, filter each tier's array to exclude `state.flowARejectedTitles?.has(entry.title.id)`.

7. CSS additions:

```css
/* === D-07 Flow A response — DECI-14-07 === */
.flow-a-response-content { width: min(520px, 100%); padding: var(--s4); }
.flow-a-rejected-cta, .flow-a-counter-cap, .flow-a-already {
  padding: var(--s3);
  background: var(--c-bg-elevated, #1f1a16);
  border-radius: var(--r-md, 8px);
  margin: var(--s2) 0;
}
.flow-a-rejected-cta { border: 1px solid var(--c-warning, #d97757); }
.flow-a-counter-cap { border: 1px solid var(--c-text-dim, #8a7d6e); }
.flow-a-response-body { display: flex; flex-direction: column; gap: var(--s2); margin-top: var(--s3); }
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "submitCounterNom" js/app.js && grep -c "counterChainDepth" js/app.js && grep -c "convertedFromIntentId" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - Response screen renders picker view (live tally + reject-majority CTA + counter-cap notice + convert button) and recipient view (In/Reject/Drop + counter sub-flow).
    - Counter-nomination sub-flow reuses picker UI; submitCounterNom increments counterChainDepth (capped at 3 client-side; rules enforce server-side per 14-06).
    - At counterChainDepth === 3, picker UI surfaces "options on the table" message + disables further counters.
    - Convert handler creates watchparty doc + flips intent.status='converted' with convertedToWpId.
    - Reject-majority retry: state.flowARejectedTitles excludes the rejected title from next picker render; intent #2 cancels intent #1.
    - Live re-render via state.unsubIntents snapshot tick.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: HUMAN-VERIFY — Flow A end-to-end on staging (multi-device)</name>
  <what-built>
    Full Flow A picker → roster → push fan-out → recipient response → reject-majority retry → counter-nomination chain → convert flow.
  </what-built>
  <how-to-verify>
    1. Deploy CFs (queuenight) + hosting (couch) to staging.
    2. Sign in on Device A as Picker; sign in on Device B as Recipient (different couch member).
    3. On Device A: claim a cushion on the Couch viz. Confirm Flow A entry CTA appears.
    4. Tap "Open picker". Confirm tier-ranked list appears (T1/T2/T3 with T3 collapsed).
    5. Pick a title → roster screen → tap to mark Device B as in-person OR leave unconfirmed → Send Picks.
    6. On Device B: wait for push. Confirm push body matches D-12 copy ("X picked Y for tonight. In, reject, or drop?"). Tap to open response screen. Tap "Reject + counter" → mini-picker → pick a different title → submit. Confirm counter-nomination push back to Device A.
    7. On Device A: response screen now shows counter chain depth = 1, Device B's reject + counter visible. Pick #2 (or end nomination).
    8. Repeat reject-majority scenario: get majority of recipients to reject; confirm the "Pick #2" CTA surfaces; pick #2; confirm #1 intent goes cancelled; #2 intent goes open.
    9. Run quorum convert: get ≥1 in; tap "Start watchparty"; confirm watchparty doc created + lobby flow opens.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "passed" — Flow A works end-to-end multi-device. SUMMARY records pass.
    - "failed: <details>" — describe the failure. Open follow-up notes for executor.
    - "skip-uat" — defer multi-device UAT to the consolidated /gsd-verify-work pass.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → intent doc rsvp writes | Each rsvp write attributed; rules enforce attribution + counter-chain cap |
| client → watchparty doc creation (convert step) | Convert callable from any couch member — should be picker-only; rules enforce createdByUid match for the convert update |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.07-01 | Tampering | A non-picker writes intent.status='converted' to skip the convert ceremony | mitigate | Rule branch 4 (extended in 14-06 Task 2) requires resource.data.createdByUid == uid() — only picker can convert |
| T-14.07-02 | Spoofing | A member writes rsvps[someoneElse.id] | mitigate | attributedWrite() rule helper enforces actor identity matches rsvps[me] only (existing Phase 5 attribution) |
| T-14.07-03 | DoS | Rapid counter-nomination floods | mitigate | counterChainDepth cap at 3 (server-rule) + client-side disable at depth 3 (Task 4 acceptance criterion) |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "window.openFlowAPicker" js/app.js` → 1.
- `grep -c "function renderFlowAPickerScreen" js/app.js` → 1.
- `grep -c "function renderFlowARosterScreen" js/app.js` → 1.
- `grep -c "function renderFlowAResponseScreen" js/app.js` → 1.
- `grep -c "submitCounterNom" js/app.js` → ≥1.
- `grep -c "createIntent\\(\\{[^}]*flow:[^}]*['\"]rank-pick" js/app.js` → ≥1.
- `grep -c "counterChainDepth" js/app.js` → ≥2 (read in render + write in submitCounterNom).
- `grep -c "convertedFromIntentId" js/app.js` → ≥1 (in onFlowAConvert).
- `grep -c "resolveT3Visibility" js/app.js` → ≥2 (declaration in 14-03 + consumer in 14-07).
- Task 5 checkpoint resolved.
</verification>

<success_criteria>
1. Flow A entry CTA renders on Tonight tab when couch claimed; flips reactively to "Picking happening" when a Flow A intent is open.
2. Picker UI renders T1/T2/T3 sections; T3 expand toggle gated by resolveT3Visibility; selecting a title advances to roster.
3. Roster screen supports proxy-confirm taps; Send Picks creates the rank-pick intent + pre-seeds confirmed members; remaining members get the flowAPick push (delivered by 14-06 CF).
4. Recipient response UI offers In/Reject/Drop; counter-nomination sub-flow reuses picker UI and increments counterChainDepth; cap at 3 enforced both client-side (UI disable) and server-side (rules).
5. Reject-majority detection surfaces #2 prompt to picker; rejected title excluded from next picker render; 1 retry then expire.
6. Convert handler creates watchparty doc + flips intent.status='converted' + opens lobby (Phase 11-05 takes over).
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-07-SUMMARY.md` documenting:
- Insertion file:line for all 5 new functions + 6 new window handlers.
- state.unsubIntents handler extension site.
- Cross-plan dependency reads documented (14-03 aggregators, 14-04 couch, 14-06 createIntent + counterChainDepth + rules + CFs).
- Task 5 multi-device UAT resolution.
</output>
