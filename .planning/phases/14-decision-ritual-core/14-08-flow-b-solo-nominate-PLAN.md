---
phase: 14-decision-ritual-core
plan: 08
type: execute
wave: 2
depends_on: [14-06]
files_modified:
  - js/app.js
  - css/app.css
autonomous: false
requirements_addressed: [DECI-14-08]
must_haves:
  truths:
    - "Tile action sheet (or detail modal) surfaces 'Watch with the couch?' (Flow B nominate) entry; tap opens nominate UI with title, time picker, optional note."
    - "Submit nominate calls createIntent({flow:'nominate', titleId, proposedStartAt, proposedNote}); CF onIntentCreated (from 14-06) fires flowBNominate push to all family members minus creator."
    - "Recipient UI: 3 buttons — Join @ proposed time / Counter-suggest (later/earlier with note) / Decline. Counter writes rsvps[me] = {state:'maybe', counterTime, note} AND atomically increments counterChainDepth (capped at 3 by rules from 14-06)."
    - "Nominator UI on counter received: shows the counter inline with 3 buttons — Accept counter (move proposedStartAt to counterTime) / Reject (keep current proposedStartAt; counter ignored) / Pick compromise (open time picker prefilled between original and counter)."
    - "Auto-convert at T-15min: handled by watchpartyTick CF in 14-06 (NOT this plan). Client UI surfaces 'Auto-converting in N min' indicator on the active nominate intent."
    - "All-No edge case: when count of state==='reject' OR value==='no' rsvps reaches 100% of recipients (no Yes votes possible), client triggers a manual cancel (writes status='cancelled', cancelledAt, cancelReason='all-no')."
    - "Hard expire at T+4hr past proposedStartAt is enforced by watchpartyTick CF (14-06); client UI surfaces 'Expires in N hr' indicator."
  artifacts:
    - path: "js/app.js"
      provides: "Flow B entry from tile action sheet + nominate UI + recipient response UI + counter-time decision UI + auto-convert indicator"
      contains: "openFlowBNominate"
      min_lines_added: 220
    - path: "css/app.css"
      provides: ".flow-b-nominate, .flow-b-counter, .flow-b-indicator styling"
      contains: ".flow-b-nominate"
      min_lines_added: 60
  key_links:
    - from: "Tile action sheet 'Watch with the couch?' entry (rewires existing 'Propose tonight @ time' OR adds sibling)"
      to: "openFlowBNominate(titleId)"
      via: "action-sheet item onclick"
      pattern: "openFlowBNominate\\("
    - from: "Nominate submission"
      to: "createIntent({flow:'nominate', titleId, proposedStartAt}) from 14-06"
      via: "function call"
      pattern: "createIntent\\(\\{\\s*flow:\\s*['\"]nominate"
---

<objective>
Implement Flow B — solo-nominate + invite + counter-time — per D-08. Member nominates a title with proposed time → push to other family members → recipient can join, counter-suggest, or decline → nominator decides per counter (accept / reject / pick compromise) → CF auto-converts to watchparty at T-15min if any Yes RSVPs exist → all-No edge case auto-cancels → hard expire at T+4hr.

Purpose: Flow B is the second of the two parallel flows. It captures the "I'm not on the couch with you, but want to watch this with you at 8pm" UX. Together with Flow A, Flow B replaces the old vote-prominent Tonight tile with two purpose-fit decision rituals. Flow B is conceptually adjacent to Phase 8's existing 'tonight_at_time' intent BUT D-08 specifies new behavior (counter-time decision belongs to nominator, auto-convert at T-15min, all-No auto-cancel) that doesn't match Phase 8's match-threshold logic — hence the new `flow:'nominate'` discriminator.

Output: Nominate UI launched from tile action sheet, recipient response UI (join / counter / decline), nominator counter-decision UI, auto-convert indicator, all-No detection + auto-cancel.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 3 (depends on Wave 1). Hard depends on:
- 14-06 (createIntent with flow:'nominate' + onIntentCreated flowBNominate push + onIntentUpdate flowBCounterTime push + watchpartyTick auto-convert at T-15min + T-30min warning)

**Two-repo discipline:** Couch-side only — repo-relative paths.

**Less interconnected than 14-07** because Flow B doesn't have a "couch" composition step (it's solo-nominate). UI is more linear.
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
**createIntent (from 14-06)** — accepts `{flow:'nominate', titleId, proposedStartAt, proposedNote}`. Returns intentId. Server-side: onIntentCreated fires flowBNominate push to all family members minus creator (14-06 Task 3).

**Existing tile action sheet** at js/app.js:11862-11891 includes "Propose tonight @ time" → calls `openProposeIntent`. D-08 is conceptually adjacent — could either (a) extend openProposeIntent with a flow toggle OR (b) add a sibling `openFlowBNominate` entry. Option B is cleaner per Anti-pattern #7 (don't conflate primitives).

**Existing intent state.unsubIntents listener** at js/app.js:3560-3564 — same one used by Flow A. Re-renders Flow B UI on snapshot tick (Task 4 wiring).

**Existing watchparty doc creation** path — referenced for auto-convert (handled CF-side per 14-06 Task 5). Client doesn't create the watchparty for Flow B; CF does at T-15min auto-convert.

**escapeHtml + memberColor + flashToast** — same helpers as Flow A.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add 'Watch with the couch?' entry to tile action sheet + openFlowBNominate UI</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js lines 11853-11900 (existing openActionSheet body — see existing Propose entry at js/app.js:11874)
    - js/app.js (after 14-05 Task 2) — openTileActionSheet shape
    - .planning/phases/14-decision-ritual-core/14-CONTEXT.md D-08 + D-12 push copy table
  </read_first>
  <action>
1. **Extend openTileActionSheet** (added in 14-05 Task 2) — add a new entry between "Schedule for later" and "Ask family":

```js
// D-08 (DECI-14-08) — Flow B solo-nominate entry on tile action sheet.
items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openFlowBNominate('${titleId}')"><span class="icon">📣</span>Watch with the couch?</button>`);
```

2. **Also extend the existing openActionSheet** (the full sheet at js/app.js:11853) — add the same entry. Either alongside the existing "Propose tonight @ time" entry OR by replacing it with the new flow-aware entry. Recommend ADDITION (not replacement) so legacy Phase 8 'tonight_at_time' flow stays accessible.

3. Add openFlowBNominate UI:

```js
// === D-08 Flow B nominate — DECI-14-08 ===
window.openFlowBNominate = function(titleId) {
  if (!state.me) { flashToast('Sign in to nominate', { kind: 'warn' }); return; }
  const t = state.titles.find(x => x.id === titleId);
  if (!t) { flashToast('Title not found', { kind: 'warn' }); return; }
  state.flowBNominateTitleId = titleId;
  renderFlowBNominateScreen();
};

function renderFlowBNominateScreen() {
  let modal = document.getElementById('flow-b-nominate-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-nominate-modal';
    modal.className = 'modal-bg flow-b-nominate-modal';
    document.body.appendChild(modal);
  }
  const titleId = state.flowBNominateTitleId;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) { closeFlowBNominate(); return; }

  // Default proposed time: 8pm tonight (or now+1hr if it's already past 8pm).
  const now = new Date();
  const defaultDate = new Date(now);
  defaultDate.setHours(20, 0, 0, 0);
  if (defaultDate.getTime() <= now.getTime()) {
    defaultDate.setTime(now.getTime() + 60 * 60 * 1000);
  }
  // ISO datetime-local format (YYYY-MM-DDTHH:MM).
  const pad = (n) => String(n).padStart(2, '0');
  const defaultLocal = `${defaultDate.getFullYear()}-${pad(defaultDate.getMonth()+1)}-${pad(defaultDate.getDate())}T${pad(defaultDate.getHours())}:${pad(defaultDate.getMinutes())}`;

  modal.innerHTML = `<div class="modal-content flow-b-nominate-content">
    <header class="flow-b-nominate-h">
      <button class="modal-close" type="button" onclick="closeFlowBNominate()" aria-label="Close">✕</button>
      <h2>Nominate ${escapeHtml(t.name)}</h2>
      <p>Pick a time. Family members can join, counter, or pass.</p>
    </header>
    <form class="flow-b-nominate-form" onsubmit="event.preventDefault();onFlowBSubmitNominate();">
      <label class="flow-b-label">
        <span class="flow-b-label-text">Proposed start time</span>
        <input type="datetime-local" id="flow-b-time-input" class="flow-b-time-input" value="${defaultLocal}" required />
      </label>
      <label class="flow-b-label">
        <span class="flow-b-label-text">Note (optional)</span>
        <textarea id="flow-b-note-input" class="flow-b-note-input" maxlength="200" placeholder="e.g. After dinner. BYO popcorn."></textarea>
      </label>
      <div class="flow-b-nominate-footer">
        <button class="tc-secondary" type="button" onclick="closeFlowBNominate()">Cancel</button>
        <button class="tc-primary" type="submit">Send nomination</button>
      </div>
    </form>
  </div>`;
  modal.classList.add('on');
}

window.closeFlowBNominate = function() {
  const modal = document.getElementById('flow-b-nominate-modal');
  if (modal) modal.classList.remove('on');
  state.flowBNominateTitleId = null;
};

window.onFlowBSubmitNominate = async function() {
  const titleId = state.flowBNominateTitleId;
  if (!titleId) return;
  const timeInput = document.getElementById('flow-b-time-input');
  const noteInput = document.getElementById('flow-b-note-input');
  if (!timeInput || !timeInput.value) {
    flashToast('Pick a time', { kind: 'warn' });
    return;
  }
  const proposedStartAt = new Date(timeInput.value).getTime();
  if (!isFinite(proposedStartAt) || proposedStartAt < Date.now() - 60000) {
    flashToast('Pick a future time', { kind: 'warn' });
    return;
  }
  const proposedNote = noteInput && noteInput.value ? noteInput.value.trim().slice(0, 200) : null;
  let intentId;
  try {
    intentId = await createIntent({
      flow: 'nominate',
      titleId,
      proposedStartAt,
      proposedNote: proposedNote || undefined
    });
  } catch (e) {
    console.error('[flowB] createIntent failed', e);
    flashToast('Could not send nomination — try again', { kind: 'warn' });
    return;
  }
  flashToast('Nomination sent', { kind: 'success' });
  closeFlowBNominate();
  // Open response screen so the nominator can watch live progress.
  setTimeout(() => openFlowBStatusScreen(intentId), 100);
};
```

4. CSS:

```css
/* === D-08 Flow B nominate — DECI-14-08 === */
.flow-b-nominate-content { width: min(520px, 100%); padding: var(--s4); }
.flow-b-nominate-form { display: flex; flex-direction: column; gap: var(--s3); margin-top: var(--s3); }
.flow-b-label { display: flex; flex-direction: column; gap: var(--s1); }
.flow-b-label-text { color: var(--c-text-strong, #e8dcc4); font-weight: 600; }
.flow-b-time-input, .flow-b-note-input {
  background: var(--c-bg-elevated, #1f1a16);
  color: var(--c-text-strong, #e8dcc4);
  border: 1px solid var(--c-border, #4a3d33);
  border-radius: var(--r-md, 8px);
  padding: var(--s2);
  font-family: var(--font-body, Inter, sans-serif);
  font-size: 16px; /* >=16px to suppress iOS zoom-on-focus */
}
.flow-b-note-input { min-height: 80px; resize: vertical; }
.flow-b-nominate-footer { display: flex; justify-content: space-between; gap: var(--s2); margin-top: var(--s3); }
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "window.openFlowBNominate" js/app.js && grep -c "createIntent\\(\\{[^}]*flow:[^}]*['\"]nominate" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - "Watch with the couch?" entry present in BOTH openTileActionSheet AND openActionSheet.
    - openFlowBNominate UI lazy-creates modal with title + time picker + note field.
    - Submit calls createIntent with flow:'nominate' + proposedStartAt + proposedNote.
    - On success, transitions to status screen for the nominator (Task 3).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Recipient response UI — Join / Counter-suggest / Decline</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js (after 14-06) — counterChainDepth field semantics + intentRef helper
    - js/app.js — existing intent rsvp write patterns (Phase 8)
  </read_first>
  <action>
1. Add to js/app.js:

```js
window.openFlowBResponseScreen = function(intentId) {
  let modal = document.getElementById('flow-b-response-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-response-modal';
    modal.className = 'modal-bg flow-b-response-modal';
    document.body.appendChild(modal);
  }
  state.flowBOpenIntentId = intentId;
  renderFlowBResponseScreen();
  modal.classList.add('on');
};

function renderFlowBResponseScreen() {
  const modal = document.getElementById('flow-b-response-modal');
  if (!modal) return;
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowBResponse(); return; }
  const t = state.titles.find(x => x.id === intent.titleId);
  const isNominator = intent.createdBy === (state.me && state.me.id);
  if (isNominator) {
    // Nominator status screen — handled by Task 3.
    return openFlowBStatusScreen(intentId);
  }

  const myRsvp = (intent.rsvps || {})[state.me && state.me.id];
  const responded = !!myRsvp;
  const proposedTime = intent.proposedStartAt
    ? new Date(intent.proposedStartAt).toLocaleString([], {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
        timeZone: intent.creatorTimeZone || undefined
      })
    : 'soon';

  modal.innerHTML = `<div class="modal-content flow-b-response-content">
    <header class="flow-b-response-h">
      <button class="modal-close" type="button" onclick="closeFlowBResponse()" aria-label="Close">✕</button>
      <h2>${escapeHtml(intent.createdByName || 'Family member')} wants to watch ${escapeHtml(t ? t.name : '')}</h2>
      <p>Proposed time: <strong>${escapeHtml(proposedTime)}</strong></p>
      ${intent.proposedNote ? `<p class="flow-b-note">"${escapeHtml(intent.proposedNote)}"</p>` : ''}
    </header>
    <div class="flow-b-response-body">
      ${responded ? `<div class="flow-b-already">You said: ${escapeHtml(myRsvp.state || myRsvp.value || '?')}</div>` : ''}
      <button class="tc-primary" type="button" onclick="onFlowBRespondJoin()">Join @ proposed time</button>
      <button class="tc-secondary" type="button" onclick="onFlowBOpenCounterTime()">Counter-suggest a different time</button>
      <button class="tc-secondary" type="button" onclick="onFlowBRespondDecline()">Decline</button>
    </div>
  </div>`;
}

window.closeFlowBResponse = function() {
  const modal = document.getElementById('flow-b-response-modal');
  if (modal) modal.classList.remove('on');
  state.flowBOpenIntentId = null;
};

window.onFlowBRespondJoin = async function() {
  const intentId = state.flowBOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${state.me.id}`]: {
        state: 'in',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast('You\'re in. Watching for confirmation.', { kind: 'success' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] join failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowBRespondDecline = async function() {
  const intentId = state.flowBOpenIntentId;
  if (!intentId || !state.me) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${state.me.id}`]: {
        state: 'reject',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast('Declined.', { kind: 'info' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] decline failed', e);
    flashToast('Could not record response', { kind: 'warn' });
  }
};

window.onFlowBOpenCounterTime = function() {
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counterDepth = intent.counterChainDepth || 0;
  if (counterDepth >= 3) {
    flashToast('Counter chain full', { kind: 'warn' });
    return;
  }
  // Render counter-time picker.
  const modal = document.getElementById('flow-b-response-modal');
  if (!modal) return;
  // Default counter time: original + 1hr.
  const original = intent.proposedStartAt || Date.now();
  const counterDefault = new Date(original + 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const counterDefaultLocal = `${counterDefault.getFullYear()}-${pad(counterDefault.getMonth()+1)}-${pad(counterDefault.getDate())}T${pad(counterDefault.getHours())}:${pad(counterDefault.getMinutes())}`;

  modal.innerHTML = `<div class="modal-content flow-b-counter-content">
    <header class="flow-b-counter-h">
      <button class="modal-close" type="button" onclick="closeFlowBResponse()" aria-label="Close">✕</button>
      <h2>Counter-suggest a time</h2>
      <p>Nominator decides whether to accept your counter.</p>
    </header>
    <form class="flow-b-counter-form" onsubmit="event.preventDefault();onFlowBSubmitCounterTime();">
      <label class="flow-b-label">
        <span class="flow-b-label-text">Your suggested time</span>
        <input type="datetime-local" id="flow-b-counter-time-input" class="flow-b-time-input" value="${counterDefaultLocal}" required />
      </label>
      <label class="flow-b-label">
        <span class="flow-b-label-text">Note (optional)</span>
        <textarea id="flow-b-counter-note-input" class="flow-b-note-input" maxlength="200" placeholder="e.g. After kids' bedtime."></textarea>
      </label>
      <div class="flow-b-counter-footer">
        <button class="tc-secondary" type="button" onclick="renderFlowBResponseScreen()">Back</button>
        <button class="tc-primary" type="submit">Send counter</button>
      </div>
    </form>
  </div>`;
};

window.onFlowBSubmitCounterTime = async function() {
  const intentId = state.flowBOpenIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent || !state.me) return;
  const newDepth = (intent.counterChainDepth || 0) + 1;
  if (newDepth > 3) { flashToast('Counter chain cap reached', { kind: 'warn' }); return; }
  const ti = document.getElementById('flow-b-counter-time-input');
  const ni = document.getElementById('flow-b-counter-note-input');
  if (!ti || !ti.value) { flashToast('Pick a counter time', { kind: 'warn' }); return; }
  const counterTime = new Date(ti.value).getTime();
  if (!isFinite(counterTime) || counterTime < Date.now() - 60000) { flashToast('Pick a future time', { kind: 'warn' }); return; }
  const note = ni && ni.value ? ni.value.trim().slice(0, 200) : null;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${state.me.id}`]: {
        state: 'maybe',
        counterTime,
        note: note || null,
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      counterChainDepth: newDepth,
      ...writeAttribution()
    });
    flashToast('Counter sent', { kind: 'success' });
    closeFlowBResponse();
  } catch (e) {
    console.error('[flowB] counter failed', e);
    flashToast('Could not send counter', { kind: 'warn' });
  }
};
```

2. CSS:

```css
/* === D-08 Flow B response — DECI-14-08 === */
.flow-b-response-content, .flow-b-counter-content { width: min(520px, 100%); padding: var(--s4); }
.flow-b-response-body { display: flex; flex-direction: column; gap: var(--s2); margin-top: var(--s3); }
.flow-b-already, .flow-b-note {
  padding: var(--s2);
  background: var(--c-bg-elevated, #1f1a16);
  border-radius: var(--r-md, 8px);
}
.flow-b-counter-form { display: flex; flex-direction: column; gap: var(--s3); margin-top: var(--s3); }
.flow-b-counter-footer { display: flex; justify-content: space-between; gap: var(--s2); margin-top: var(--s3); }
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "window.onFlowBRespondJoin" js/app.js && grep -c "window.onFlowBOpenCounterTime" js/app.js && grep -c "counterChainDepth" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - Recipient response UI offers 3 buttons: Join @ proposed / Counter-suggest / Decline.
    - Counter-time picker enforces future time + 200-char note limit.
    - Counter submission writes rsvps[me] = {state:'maybe', counterTime, note} + atomically increments counterChainDepth.
    - Counter-cap enforced client-side (depth 3 blocked) AND server-side (rules from 14-06).
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Nominator status screen — counter-decision UI + auto-convert indicator + all-No detection</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js (after Tasks 1-2) — flow B intent state shape + state.unsubIntents listener
  </read_first>
  <action>
1. Add to js/app.js:

```js
window.openFlowBStatusScreen = function(intentId) {
  let modal = document.getElementById('flow-b-status-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'flow-b-status-modal';
    modal.className = 'modal-bg flow-b-status-modal';
    document.body.appendChild(modal);
  }
  state.flowBStatusIntentId = intentId;
  renderFlowBStatusScreen();
  modal.classList.add('on');
};

function renderFlowBStatusScreen() {
  const modal = document.getElementById('flow-b-status-modal');
  if (!modal) return;
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) { closeFlowBStatus(); return; }
  if (intent.status !== 'open') {
    // Auto-close on convert / cancel / expire.
    setTimeout(() => closeFlowBStatus(), 1500);
  }
  const t = state.titles.find(x => x.id === intent.titleId);

  const rsvps = intent.rsvps || {};
  const ins = Object.entries(rsvps).filter(([mid, r]) => (r.state === 'in' || r.value === 'yes') && mid !== intent.createdBy);
  const counters = Object.entries(rsvps).filter(([mid, r]) => r.state === 'maybe' && r.counterTime);
  const declines = Object.entries(rsvps).filter(([mid, r]) => r.state === 'reject' || r.value === 'no');

  // Recipient count (everyone except creator)
  const recipientCount = (state.members || []).filter(m => m.id !== intent.createdBy).length;
  const totalResponded = ins.length + counters.length + declines.length;
  const allNo = recipientCount > 0 && declines.length === recipientCount && ins.length === 0;

  // Auto-convert countdown
  const minutesToStart = intent.proposedStartAt ? Math.round((intent.proposedStartAt - Date.now()) / 60000) : null;
  const willAutoConvert = ins.length > 0 && minutesToStart != null && minutesToStart > 0 && minutesToStart <= 30;

  const counterRows = counters.map(([mid, r]) => {
    const m = (state.members || []).find(x => x.id === mid);
    const counterFmt = new Date(r.counterTime).toLocaleString([], {
      weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
    });
    return `<div class="flow-b-counter-row">
      <div class="flow-b-counter-row-meta">
        <strong>${escapeHtml(m ? m.name : 'Member')}</strong> countered with <strong>${escapeHtml(counterFmt)}</strong>
        ${r.note ? `<p class="flow-b-note-inline">"${escapeHtml(r.note)}"</p>` : ''}
      </div>
      <div class="flow-b-counter-row-actions">
        <button class="tc-primary" type="button" onclick="onFlowBAcceptCounter('${mid}')">Accept</button>
        <button class="tc-secondary" type="button" onclick="onFlowBRejectCounter('${mid}')">Reject</button>
        <button class="tc-secondary" type="button" onclick="onFlowBOpenCompromiseTimePicker('${mid}')">Compromise</button>
      </div>
    </div>`;
  }).join('');

  modal.innerHTML = `<div class="modal-content flow-b-status-content">
    <header class="flow-b-status-h">
      <button class="modal-close" type="button" onclick="closeFlowBStatus()" aria-label="Close">✕</button>
      <h2>${escapeHtml(t ? t.name : 'Nomination')}</h2>
      <p>Status: <strong>${escapeHtml(intent.status)}</strong> · ${ins.length} in · ${counters.length} counter · ${declines.length} declined of ${recipientCount} family</p>
    </header>
    <div class="flow-b-status-body">
      ${willAutoConvert ? `<div class="flow-b-indicator flow-b-converting">⏱ Auto-converting to watchparty in ${Math.max(0, minutesToStart - 15)} min (T-15)</div>` : ''}
      ${allNo ? `<div class="flow-b-indicator flow-b-allno">All recipients declined. <button class="tc-secondary" type="button" onclick="onFlowBAutoCancel()">Cancel nomination</button></div>` : ''}
      ${counterRows ? `<section class="flow-b-counter-list">
        <h3 class="flow-b-section-h">Counter-time suggestions (${counters.length})</h3>
        ${counterRows}
      </section>` : ''}
      <button class="tc-secondary" type="button" onclick="onFlowBStatusCancel()">End nomination</button>
    </div>
  </div>`;
}

window.closeFlowBStatus = function() {
  const modal = document.getElementById('flow-b-status-modal');
  if (modal) modal.classList.remove('on');
  state.flowBStatusIntentId = null;
};

function maybeRerenderFlowBStatus() {
  if (state.flowBStatusIntentId) renderFlowBStatusScreen();
  if (state.flowBOpenIntentId) renderFlowBResponseScreen();
}

// Nominator counter decisions.
window.onFlowBAcceptCounter = async function(memberId) {
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counter = (intent.rsvps || {})[memberId];
  if (!counter || !counter.counterTime) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      proposedStartAt: counter.counterTime,
      proposedNote: counter.note || intent.proposedNote || null,
      // Update nominator's own rsvp to clear any stale state.
      [`rsvps.${state.me.id}`]: {
        state: 'in',
        at: Date.now(),
        actingUid: (state.auth && state.auth.uid) || null,
        memberName: state.me.name || null
      },
      ...writeAttribution()
    });
    flashToast(`Time updated. ${(state.members.find(m => m.id === memberId) || {}).name || 'Counter'} accepted.`, { kind: 'success' });
  } catch (e) {
    console.error('[flowB] accept counter failed', e);
    flashToast('Could not accept counter', { kind: 'warn' });
  }
};

window.onFlowBRejectCounter = async function(memberId) {
  // Reject: clear the counter; counter-er can re-respond.
  // Note: this just zeroes out their rsvp to nudge them; it doesn't reject the intent itself.
  const intentId = state.flowBStatusIntentId;
  if (!intentId) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      [`rsvps.${memberId}`]: { state: 'maybe', at: Date.now(), actingUid: state.me.id, memberName: (state.members.find(m => m.id === memberId) || {}).name || null, note: 'counter rejected by nominator' },
      ...writeAttribution()
    });
    flashToast('Counter rejected', { kind: 'info' });
  } catch (e) {
    console.error('[flowB] reject counter failed', e);
  }
};

window.onFlowBOpenCompromiseTimePicker = function(memberId) {
  const intentId = state.flowBStatusIntentId;
  const intent = (state.intents || []).find(i => i.id === intentId);
  if (!intent) return;
  const counter = (intent.rsvps || {})[memberId];
  if (!counter || !counter.counterTime) return;
  // Compromise = midpoint of original proposedStartAt and counterTime.
  const compromise = Math.round((intent.proposedStartAt + counter.counterTime) / 2);
  const cd = new Date(compromise);
  const pad = (n) => String(n).padStart(2, '0');
  const compromiseLocal = `${cd.getFullYear()}-${pad(cd.getMonth()+1)}-${pad(cd.getDate())}T${pad(cd.getHours())}:${pad(cd.getMinutes())}`;
  // Open a small inline prompt — browser prompt() works for solo dev simplicity (D-08 doesn't specify).
  const userInput = window.prompt(`Compromise time (suggested midpoint pre-filled):\nFormat: YYYY-MM-DDTHH:MM`, compromiseLocal);
  if (!userInput) return;
  const finalTime = new Date(userInput).getTime();
  if (!isFinite(finalTime) || finalTime < Date.now()) { flashToast('Pick a future time', { kind: 'warn' }); return; }
  updateDoc(doc(intentRef(intentId)), {
    proposedStartAt: finalTime,
    ...writeAttribution()
  }).then(() => {
    flashToast('Compromise time set', { kind: 'success' });
  }).catch(e => {
    console.error('[flowB] compromise failed', e);
    flashToast('Could not set time', { kind: 'warn' });
  });
};

window.onFlowBStatusCancel = async function() {
  const intentId = state.flowBStatusIntentId;
  if (!intentId) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      ...writeAttribution()
    });
    closeFlowBStatus();
    flashToast('Nomination ended', { kind: 'info' });
  } catch (e) {
    console.error('[flowB] cancel failed', e);
  }
};

window.onFlowBAutoCancel = async function() {
  const intentId = state.flowBStatusIntentId;
  if (!intentId) return;
  try {
    await updateDoc(doc(intentRef(intentId)), {
      status: 'cancelled',
      cancelledAt: Date.now(),
      cancelReason: 'all-no',
      ...writeAttribution()
    });
    flashToast('All declined — nomination cancelled', { kind: 'info' });
    closeFlowBStatus();
  } catch (e) {
    console.error('[flowB] auto-cancel failed', e);
  }
};
```

2. **Wire `maybeRerenderFlowBStatus()` into the state.unsubIntents handler.** Add to the snapshot handler (already extended in 14-07 Task 4):
```js
if (typeof maybeRerenderFlowBStatus === 'function') maybeRerenderFlowBStatus();
```

3. CSS:

```css
/* === D-08 Flow B status — DECI-14-08 === */
.flow-b-status-content { width: min(680px, 100%); max-height: 90vh; overflow-y: auto; padding: var(--s4); }
.flow-b-indicator {
  padding: var(--s3);
  border-radius: var(--r-md, 8px);
  margin: var(--s2) 0;
}
.flow-b-converting { background: var(--c-bg-elevated, #1f1a16); border: 1px solid var(--c-warm-amber, #d4a574); }
.flow-b-allno { background: var(--c-bg-elevated, #1f1a16); border: 1px solid var(--c-warning, #d97757); display: flex; align-items: center; justify-content: space-between; gap: var(--s2); }
.flow-b-counter-list { margin: var(--s3) 0; }
.flow-b-counter-row {
  padding: var(--s3);
  background: var(--c-bg-elevated, #1f1a16);
  border-radius: var(--r-md, 8px);
  margin-bottom: var(--s2);
}
.flow-b-counter-row-meta { color: var(--c-text-strong, #e8dcc4); }
.flow-b-counter-row-actions { display: flex; gap: var(--s2); margin-top: var(--s2); }
.flow-b-note-inline { color: var(--c-text-body, #c4b89e); font-style: italic; margin: var(--s2) 0 0; }
.flow-b-section-h { font-family: var(--font-serif, 'Instrument Serif', serif); font-size: 18px; color: var(--c-text-strong, #e8dcc4); }
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "window.onFlowBAcceptCounter" js/app.js && grep -c "cancelReason" js/app.js && grep -c "Auto-converting" js/app.js</automated>
    Expect: all checks pass.
  </verify>
  <done>
    - Status screen shows live tally, auto-convert countdown indicator (when willAutoConvert), all-No banner with auto-cancel button.
    - Counter rows render with 3 actions (Accept / Reject / Compromise).
    - Accept Counter updates proposedStartAt and proposedNote atomically.
    - Compromise opens prompt prefilled with midpoint timestamp.
    - All-No detection triggers auto-cancel CTA when 100% declines + 0 ins.
    - Status screen re-renders on state.unsubIntents tick.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Wire opening Flow B response screen from intent push deep-link OR snapshot detection</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js — existing intents subscription; existing push deep-link handler (search `?intent=`)
  </read_first>
  <action>
1. **Push deep-link handler:** the existing CFs (14-06) include `url: \`/?intent=${intentId}\`` in push payloads. The existing app boot likely parses `?intent=` from URL search. Locate that handler (search `?intent=` or `searchParams.get('intent')`).

2. Extend the existing handler to route Flow B nominate intents to openFlowBResponseScreen (and Flow A rank-pick intents to openFlowAResponseScreen). Approximate shape:

```js
// Locate the existing onload / after-auth code that reads ?intent= and adapt.
function maybeOpenIntentFromDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const intentId = params.get('intent');
  if (!intentId) return;
  // Remove the param so refresh doesn't re-trigger.
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete('intent');
    window.history.replaceState({}, '', url.toString());
  } catch(e){}
  // Wait for intents subscription to hydrate.
  const tryOpen = () => {
    const intent = (state.intents || []).find(i => i.id === intentId);
    if (!intent) {
      setTimeout(tryOpen, 500);
      return;
    }
    const flow = intent.flow || intent.type;
    if (flow === 'rank-pick') {
      if (typeof openFlowAResponseScreen === 'function') openFlowAResponseScreen(intentId);
    } else if (flow === 'nominate') {
      if (intent.createdBy === (state.me && state.me.id)) {
        if (typeof openFlowBStatusScreen === 'function') openFlowBStatusScreen(intentId);
      } else {
        if (typeof openFlowBResponseScreen === 'function') openFlowBResponseScreen(intentId);
      }
    }
    // Legacy intents (tonight_at_time / watch_this_title) — let existing handler take over.
  };
  tryOpen();
}
```

3. Wire `maybeOpenIntentFromDeepLink()` into the existing post-auth boot path (likely adjacent to other deep-link handlers).
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "maybeOpenIntentFromDeepLink" js/app.js</automated>
    Expect: passes.
  </verify>
  <done>
    - Deep-link handler routes intent IDs to the correct screen based on flow.
    - Flow B nominator → status screen; Flow B recipient → response screen.
    - Flow A → response screen (if present from 14-07).
    - Legacy Phase 8 intents fall through to existing handler.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: HUMAN-VERIFY — Flow B end-to-end on staging (multi-device)</name>
  <what-built>
    Full Flow B nominate → push → recipient response → counter-time → nominator counter-decision → auto-convert at T-15min flow.
  </what-built>
  <how-to-verify>
    1. Deploy CFs (queuenight) + hosting (couch) to staging. Sign in on Device A and Device B as different family members.
    2. Device A: tap a tile → "Watch with the couch?" → set time to NOW+20min → submit. Status screen opens.
    3. Device B: receive push (≤5s on iOS). Body matches D-12: "X wants to watch Y at Z. Join, counter, or pass?"
    4. Device B: tap push → response screen opens. Tap "Counter-suggest" → set NOW+30min → send. Counter chain depth = 1.
    5. Device A: status screen updates live → counter row appears with Accept/Reject/Compromise buttons. Tap Accept → proposedStartAt updates to NOW+30min.
    6. Device B: tap "Join @ proposed time" → ins count = 1 on Device A.
    7. Wait ~15min (or temporarily set proposedStartAt to NOW+5min). At T-15min, watchpartyTick CF fires (5min cadence) and creates the watchparty doc → flowBConvert push lands on Device B → intent status flips to 'converted' → Device A status screen auto-closes.
    8. All-No edge case: nominate again, set time NOW+30min, both other devices Decline → all-No banner appears on nominator screen → tap "Cancel nomination" → status flips to 'cancelled' with cancelReason 'all-no'.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "passed"
    - "failed: <details>"
    - "skip-uat"
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → intent rsvp writes | Each rsvp write attributed; rules enforce attribution + counter-chain cap |
| client → intent proposedStartAt update (Accept Counter) | Only nominator can update; rules enforce createdByUid match |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.08-01 | Spoofing | A non-nominator updates proposedStartAt | mitigate | Convert/update branches in firestore.rules require createdByUid match; reject branch (5) only allows rsvps + counterChainDepth keys |
| T-14.08-02 | DoS | Rapid counter-time submissions flood the chain | mitigate | counterChainDepth cap at 3 (server-side rule) + client-side disable at depth 3 |
| T-14.08-03 | Tampering | Compromise time set to past timestamp | mitigate | Client-side validation (Task 3); server-side proposedStartAt has no rule constraint, but watchpartyTick auto-convert won't fire for past timestamps (minutesBefore <= 15 AND > 0 check) |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "window.openFlowBNominate" js/app.js` → 1.
- `grep -c "function renderFlowBNominateScreen" js/app.js` → 1.
- `grep -c "function renderFlowBResponseScreen" js/app.js` → 1.
- `grep -c "function renderFlowBStatusScreen" js/app.js` → 1.
- `grep -c "createIntent\\(\\{[^}]*flow:[^}]*['\"]nominate" js/app.js` → ≥1.
- `grep -c "cancelReason: 'all-no'" js/app.js` → ≥1 OR `grep -c "all-no" js/app.js` → ≥1.
- `grep -c "Auto-converting" js/app.js` → ≥1.
- Task 5 multi-device UAT resolved.
</verification>

<success_criteria>
1. "Watch with the couch?" entry present in tile action sheet (and full action sheet for back-compat).
2. Nominate UI accepts title + datetime-local time + 200-char note; submit creates Flow B intent.
3. Recipient UI offers Join / Counter-suggest / Decline; counter writes rsvps[me] + counterChainDepth bump.
4. Nominator status screen surfaces live tally, auto-convert indicator, all-No detection, counter rows with Accept/Reject/Compromise actions.
5. Deep-link from push correctly routes to nominator's status screen (creator) OR recipient's response screen (others).
6. Auto-convert at T-15min handled by watchpartyTick CF (14-06); UI surfaces countdown indicator.
7. All-No edge case auto-cancel writes cancelReason='all-no' with audit trail.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-08-SUMMARY.md` documenting:
- Insertion file:line for all 4 new render functions + 11 new window handlers.
- state.unsubIntents handler extension for maybeRerenderFlowBStatus.
- Deep-link handler extension site.
- Cross-plan dependency reads documented (14-06 createIntent + counterChainDepth + auto-convert CF).
- Task 5 multi-device UAT resolution.
</output>
