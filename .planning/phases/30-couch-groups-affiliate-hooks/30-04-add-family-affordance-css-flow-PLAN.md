---
plan: 04
phase: 30
wave: 3
depends_on: [01, 02, 03]
files_modified:
  - app.html
  - js/app.js
  - css/app.css
  - scripts/smoke-couch-groups.cjs
requirements: [GROUP-30-01, GROUP-30-05]
autonomous: true
risk: medium
status: ready
gap_closure: false
must_haves:
  truths:
    - "wp-create modal (#wp-start-modal) renders the Bring another couch in section: heading + sub-line + family-code input + Bring them in submit button"
    - "Section is rendered ONLY when state.me.id === wp.hostId — non-host members never see input or submit"
    - "Non-host members STILL see the Couches in this party list (read-only roster of currently-added families) — D-06 transparency"
    - "Submit button calls addFamilyToWp callable with {wpId, familyCode}; success toast at --good with Couch added; error toast at --warn with the matched copy from UI-SPEC error matrix"
    - "Soft-cap warning: at 5+ families the section heading sub-line text changes to Thats a big couch — are you sure? per CONTEXT D-08 + UI-SPEC"
    - "Hard-cap: at 8+ families the input + submit hide; section heading sub-line changes to This couch is full for tonight."
    - "Host-only kebab on each cross-family row: Remove this couch action with confirmation modal"
    - "css/app.css gains ~140 lines of .wp-add-family-* + .wp-couches-list + .family-suffix selectors using existing semantic tokens (no new tokens introduced)"
    - "All copy strings match UI-SPEC Copywriting Contract verbatim"
    - "**B1 fix (revision):** Soft-cap warning fires at familyCount >= 5 (above 4 per CONTEXT D-08) — never at 4"
    - "**B2 fix (revision):** Bring another couch in affordance is delivered on BOTH wp-create modal AND wp-edit lobby surface; same renderAddFamilySection helper drives both via an idSuffix parameter"
    - "**W5 fix (revision):** Residual read access after Remove this couch is documented as T-30-14 (ACCEPT v1) — removed family UIDs remain in wp.memberUids[] until 25h archive; UAT-30-11 in Plan 05 verifies this known limitation"
  artifacts:
    - path: "app.html"
      provides: "DOM hook for the .wp-add-family-section inside #wp-start-modal-bg"
      contains: "wp-add-family-section"
    - path: "js/app.js"
      provides: "renderAddFamilySection helper + onClickAddFamily handler + onClickRemoveCouch handler + addFamilyToWp callable wiring"
      contains: "renderAddFamilySection"
    - path: "css/app.css"
      provides: "Phase 30 CSS family: .wp-add-family-section, .wp-add-family-input-row, .wp-couches-list, .wp-couches-row, .family-suffix"
      contains: ".wp-add-family-section"
    - path: "scripts/smoke-couch-groups.cjs"
      provides: "+5 production-code sentinels for the UI affordance + cap copy + remove-couch flow"
      contains: "wp-add-family-section"
  key_links:
    - from: "Bring them in submit button"
      to: "addFamilyToWp callable in queuenight"
      via: "httpsCallable(functions, 'addFamilyToWp')({wpId, familyCode})"
      pattern: "httpsCallable.*addFamilyToWp"
    - from: ".wp-add-family-section"
      to: "render-time host-only gate"
      via: "if (state.me.id === wp.hostId) renderAddFamilySection(wp)"
      pattern: "state.me.id === wp.hostId"
    - from: "Remove this couch kebab"
      to: "addFamilyToWp callable does NOT support removal"
      via: "Plan 04 introduces removeFamilyFromWp client-direct write OR defers to a second CF (planner picks below)"
      pattern: "removeFamilyFromWp|wp-couches-remove"
---

<objective>
Wave 3 UI affordance: ship the Bring another couch in form section in the wp-create modal (and a parallel surface in the wp-edit menu), wire it to the addFamilyToWp callable from Plan 02, surface the soft-cap warning copy at 5+ families and the hard-cap hide at 8+ per CONTEXT D-08 + UI-SPEC, and add the host-only Remove this couch flow per UI-SPEC § Component Inventory.

Also ships ~140 lines of CSS for the new .wp-add-family-* family using existing BRAND.md semantic tokens (no new tokens introduced).

Purpose: Closes GROUP-30-01 end-to-end at the user-facing surface (host can add a family from the wp surface, not just from a console call). Closes GROUP-30-05 (soft-cap + hard-cap copy + behavior). Without this plan, Plan 03 ships the data wiring but no human can invoke it.

Output: 4 modified files in couch repo. No deploy in this plan — Plan 05 ships the cache bump + production deploy.

Decision the planner locks for the executor: the Remove this couch flow is a CLIENT-DIRECT WRITE in this plan (host removes a family from wp.families[] + wp.memberUids[] + wp.crossFamilyMembers[] via a transaction), NOT a new CF. Rationale: writes to families/memberUids are in Path B denylist (Plan 02 firestore.rules), so non-host attempts deny correctly; HOST writes pass via Path A (host can write any field). This avoids a new CF for a v1-edge-case flow. If the host-direct-write transaction proves too brittle in UAT, Phase 30.x can introduce a removeFamilyFromWp CF.
</objective>

<execution_context>
@C:/Users/nahde/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/nahde/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-03-client-subscription-render-helpers-PLAN.md
@CLAUDE.md
@app.html
@js/firebase.js
@scripts/smoke-couch-groups.cjs

NOTE: js/app.js is ~16K lines. Use Grep to locate insertion points; do NOT read in full. css/app.css is ~2360 lines — Grep for `.wp-participant-chip` or `.wp-participants-strip` to find the existing chip recipe at ~line 769.
</context>

<tasks>

<task type="auto">
  <name>Task 4.1: Add #wp-add-family-section DOM hook to app.html inside #wp-start-modal-bg</name>
  <files>app.html</files>
  <read_first>
    - app.html (full file is ~990 lines; Grep first for `wp-start-modal` to locate the existing wp-create modal block; Read offset=N-10 limit=80 around the Grep hit to see the existing form layout)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (sections "Component Inventory" + "Interaction Contracts" + "Copywriting Contract" — exact DOM + copy contracts)
  </read_first>
  <action>
Locate the wp-create modal in app.html. Grep for `wp-start-modal` returns the modal `<div>` block. The modal contains existing form fields (title selection, schedule controls, member checkboxes, etc.) ending in a primary submit button.

INSERT a new section BEFORE the existing primary submit button (the Start watchparty button). Use this exact HTML block:

```html
<!-- Phase 30 — Bring another couch in section. Render-time host-only gate
     handled in js/app.js renderAddFamilySection — non-host gets entire section
     hidden via .hidden class toggled in render. -->
<section class="wp-add-family-section" id="wp-add-family-section" aria-labelledby="wp-add-family-heading">
  <h3 class="wp-add-family-heading" id="wp-add-family-heading">Bring another couch in</h3>
  <p class="wp-add-family-subline" id="wp-add-family-subline"><em>Pull up another family for tonight.</em></p>
  <div class="wp-couches-list" id="wp-couches-list" role="list" aria-label="Families in this watchparty"></div>
  <div class="wp-add-family-input-row" id="wp-add-family-input-row">
    <input type="text" id="wp-add-family-input"
           class="wp-add-family-input"
           placeholder="Paste their family code"
           inputmode="text"
           autocapitalize="characters"
           autocomplete="off"
           autocorrect="off"
           spellcheck="false"
           aria-label="Other family's code">
    <button type="button" id="wp-add-family-submit" class="wp-add-family-submit btn">Bring them in</button>
  </div>
  <p class="wp-add-family-help"><em>They'll see their crew show up in this watchparty's couch.</em></p>
</section>
```

Critical:
- The section sits BEFORE the existing Start watchparty submit button so the form flow reads: title -> schedule -> members -> bring another couch (optional) -> Start.
- aria-label uses "Other family's code" per UI-SPEC § Accessibility.
- inputmode="text" + autocapitalize="characters" mirror Phase 5 family-join input pattern.
- The `<em>` wrapping the sub-line + help text is intentional — italic Instrument Serif rendering is via the .wp-add-family-subline + .wp-add-family-help CSS rules added in Task 4.4 (Per UI-SPEC accessibility note: NOT wrapped in `<em>` for the cross-family chip suffix; HERE the `<em>` is fine because it's a sub-heading sub-line, not a roster name with a screen-reader emphasis concern).
- The .hidden toggle for non-host gating happens in JS (Task 4.2), not in HTML.
  </action>
  <verify>
    <automated>grep -q "wp-add-family-section" app.html &amp;&amp; grep -q "Bring another couch in" app.html &amp;&amp; grep -q 'placeholder="Paste their family code"' app.html &amp;&amp; grep -q 'aria-label="Other family' app.html</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "wp-add-family-section" app.html` returns 0
    - `grep -q "Bring another couch in" app.html` returns 0 (heading copy locked from UI-SPEC)
    - `grep -q "Pull up another family for tonight." app.html` returns 0 (sub-line copy locked from UI-SPEC)
    - `grep -q "Paste their family code" app.html` returns 0 (placeholder locked from UI-SPEC)
    - `grep -q "Bring them in" app.html` returns 0 (submit button copy locked from UI-SPEC)
    - `grep -q 'aria-label="Other family' app.html` returns 0 (a11y label present)
    - `grep -q 'autocapitalize="characters"' app.html` returns 0 (matches Phase 5 family-join input pattern per UI-SPEC)
    - The section sits AFTER member checkbox section and BEFORE the existing primary Start watchparty submit button — verify by visually reading the surrounding HTML
    - app.html validates as HTML — open in browser and confirm no parse errors visible in DevTools
  </acceptance_criteria>
  <done>
    DOM hooks for the Bring another couch in section land in #wp-start-modal-bg. Plan 04 Task 4.2 wires render gating + handlers; Task 4.4 styles it. The section is currently invisible at runtime until Task 4.2 ships the renderAddFamilySection JS.
  </done>
</task>

<task type="auto">
  <name>Task 4.2: Implement renderAddFamilySection + onClickAddFamily + cap copy + remove-couch flow in js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js (Grep for `function openWpStartModal` or `confirmStartWatchparty` to locate the modal-open path; Read offset around the modal-show site to see how Phase 27 + earlier wp-create wiring renders into the modal; Grep for `httpsCallable` to confirm the existing callable wiring pattern from Phase 27 rsvp* CFs)
    - js/firebase.js (verify httpsCallable + functions are exported — they are at lines 4 + 25 + 29)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (sections "Copywriting Contract" + "Interaction Contracts / State machines" — locked strings + 4-state machine for the Add a family affordance)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md (sections "js/app.js" Modification point 5 — UI affordance placement + the existing flashToast precedent)
  </read_first>
  <action>
Add a new helper `renderAddFamilySection(wp)` and 2 click-handlers (`onClickAddFamily`, `onClickRemoveCouch`) to js/app.js. Insert location: pick a logical spot near the existing wp-create modal open code — Grep for `confirmStartWatchparty` (line ~11141) and add the new function group AFTER it (~line 11200) but BEFORE the next function definition.

Helper implementation:

```
// === Phase 30 — Bring another couch in affordance ===
// Render gating per UI-SPEC: host-only — non-host members see ZERO of the input/submit
// or kebab affordances; they DO still see .wp-couches-list (D-06 transparency).

function renderAddFamilySection(wp) {
  const section = document.getElementById('wp-add-family-section');
  if (!section) return;

  const isHost = !!(wp && state.me && state.me.id === wp.hostId);
  const families = (wp && Array.isArray(wp.families)) ? wp.families : [];
  const familyCount = families.length;

  // === Sub-line copy state machine per UI-SPEC ===
  const subline = document.getElementById('wp-add-family-subline');
  const inputRow = document.getElementById('wp-add-family-input-row');
  const helpLine = section.querySelector('.wp-add-family-help');

  if (familyCount >= 8) {
    // Hard cap reached — hide input + show closed sub-line.
    if (subline) subline.innerHTML = '<em>This couch is full for tonight.</em>';
    if (inputRow) inputRow.style.display = 'none';
    if (helpLine) helpLine.style.display = 'none';
  } else if (familyCount >= 5) {
    // Soft cap warning at 5+ families (above 4) per CONTEXT D-08 + UI-SPEC Copywriting Contract — input still visible, sub-line warns.
    if (subline) {
      subline.innerHTML = '<em>That\'s a big couch — are you sure?</em>';
      subline.classList.add('wp-add-family-subline-warn');
    }
    if (inputRow) inputRow.style.display = isHost ? 'flex' : 'none';
    if (helpLine) helpLine.style.display = isHost ? 'block' : 'none';
  } else {
    if (subline) {
      subline.innerHTML = '<em>Pull up another family for tonight.</em>';
      subline.classList.remove('wp-add-family-subline-warn');
    }
    if (inputRow) inputRow.style.display = isHost ? 'flex' : 'none';
    if (helpLine) helpLine.style.display = isHost ? 'block' : 'none';
  }

  // === .wp-couches-list — render one row per family entry ===
  // Row 1: own family with (your couch) suffix per UI-SPEC.
  // Subsequent rows: foreign families with optional Remove this couch kebab (host-only).
  const list = document.getElementById('wp-couches-list');
  if (list) {
    if (familyCount === 0) {
      list.innerHTML = '<p class="wp-couches-empty"><strong>Just your couch tonight</strong><br><em>Add another family to share the watchparty.</em></p>';
    } else {
      const ownCode = wp.hostFamilyCode || state.familyCode;
      const ownDisplayName = (state.family && state.family.displayName) || (state.family && state.family.name) || ownCode;
      const ownRow = `<div class="wp-couches-row own" role="listitem" data-family-code="${escapeHtml(ownCode)}">
        <span class="wp-couches-row-label">${escapeHtml(ownDisplayName)} <span class="muted">(your couch)</span></span>
      </div>`;
      const foreignFamilies = families.filter(c => c !== ownCode);
      const foreignRows = foreignFamilies.map(code => {
        const member = (wp.crossFamilyMembers || []).find(m => m && m.familyCode === code);
        const fdn = (member && member.familyDisplayName) || code;
        const kebab = isHost
          ? `<button type="button" class="wp-couches-remove" data-family-code="${escapeHtml(code)}" aria-label="Remove ${escapeHtml(fdn)} couch">&#8942;</button>`
          : '';
        return `<div class="wp-couches-row foreign" role="listitem" data-family-code="${escapeHtml(code)}">
          <span class="wp-couches-row-label">${escapeHtml(fdn)}</span>${kebab}
        </div>`;
      }).join('');
      list.innerHTML = ownRow + foreignRows;
    }
  }

  // === Wire the submit button + remove kebabs (only when host) ===
  if (!isHost) {
    section.classList.add('non-host-view');
    return;
  }
  section.classList.remove('non-host-view');

  const submitBtn = document.getElementById('wp-add-family-submit');
  if (submitBtn) {
    submitBtn.onclick = () => onClickAddFamily(wp);
  }

  // Wire each kebab.
  const kebabs = list ? list.querySelectorAll('.wp-couches-remove') : [];
  kebabs.forEach(btn => {
    btn.onclick = (ev) => {
      ev.stopPropagation();
      const code = btn.getAttribute('data-family-code');
      onClickRemoveCouch(wp, code);
    };
  });
}

// === addFamilyToWp callable wiring + 4-state machine per UI-SPEC ===
async function onClickAddFamily(wp) {
  const input = document.getElementById('wp-add-family-input');
  const submitBtn = document.getElementById('wp-add-family-submit');
  if (!input || !submitBtn) return;
  const familyCode = (input.value || '').trim();
  if (!familyCode) return;

  // STATE: validating
  submitBtn.disabled = true;
  input.disabled = true;
  const origLabel = submitBtn.textContent;
  submitBtn.textContent = 'Bringing them in…';

  try {
    const callable = httpsCallable(functions, 'addFamilyToWp');
    const result = await callable({ wpId: wp.id, familyCode });
    const data = (result && result.data) || {};

    if (data.alreadyAdded) {
      // STATE: idempotent — informational toast, not warn
      flashToast(`The ${data.familyDisplayName || familyCode} couch is already here.`, 'info');
    } else if (data.ok) {
      // STATE: success
      flashToast('Couch added', 'good');
      input.value = '';
    } else {
      flashToast('Something went wrong adding that couch.', 'warn');
    }
  } catch (err) {
    // STATE: error — map to UI-SPEC error matrix
    const code = err && err.code;
    const msg = err && err.message;
    if (code === 'functions/not-found') {
      flashToast('No family with that code. Double-check the spelling.', 'warn');
    } else if (code === 'functions/permission-denied') {
      flashToast('Only the host can add families to this watchparty.', 'warn');
    } else if (code === 'functions/resource-exhausted') {
      flashToast('No more room on this couch tonight.', 'warn');
    } else if (code === 'functions/failed-precondition') {
      // W4 fix (revision): zero-member family — addFamilyToWp CF throws this when the
      // family exists but has no qualifying members yet (no docs with a string `uid` field).
      // Brand-voice toast matches the warm/playful UI-SPEC § Copywriting Contract.
      flashToast("That family hasn't added any members yet — ask them to invite people first.", 'warn');
    } else if (code === 'functions/unauthenticated') {
      flashToast('Sign in to add a family.', 'warn');
    } else {
      flashToast(`Couldn't add that couch (${msg || 'unknown error'}).`, 'warn');
    }
  } finally {
    submitBtn.disabled = false;
    input.disabled = false;
    submitBtn.textContent = origLabel;
  }
}

// === Remove this couch — host-direct write per planner decision in objective ===
async function onClickRemoveCouch(wp, removeFamilyCode) {
  if (!wp || !removeFamilyCode) return;
  const member = (wp.crossFamilyMembers || []).find(m => m && m.familyCode === removeFamilyCode);
  const fdn = (member && member.familyDisplayName) || removeFamilyCode;

  const confirmed = confirm(`Remove the ${fdn} couch?\n\nTheir crew will lose access to this watchparty. They can be added back the same way.`);
  if (!confirmed) return;

  // Host-direct write to wp.families[] / wp.memberUids[] / wp.crossFamilyMembers[].
  // Path A in firestore.rules permits any-field write for the host (Plan 02).
  try {
    const ref = watchpartyRef(wp.id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      flashToast('Watchparty not found.', 'warn');
      return;
    }
    const cur = snap.data();
    const newFamilies = (cur.families || []).filter(c => c !== removeFamilyCode);
    const removedRows = (cur.crossFamilyMembers || []).filter(r => r && r.familyCode === removeFamilyCode);
    const removedUids = removedRows.map(r => r.memberId).filter(Boolean);
    // memberUids: drop UIDs only if no OTHER family in the wp also includes them (rare edge — skip cross-family-member-overlap detection in v1; just drop any uid that appears in the removed family's member set).
    // Read removed family's actual member uids server-side via members subcollection.
    // To avoid a second admin-required read, derive removed UIDs from crossFamilyMembers rows:
    const removedMemberUids = removedRows.map(r => r.memberId).filter(Boolean);
    // crossFamilyMembers rows store memberId from foreign-family member doc. The wp.memberUids
    // field stores Firebase Auth uids (different value). For safety in v1 we keep memberUids
    // unchanged — the removed family loses ROSTER visibility (their chips disappear from
    // crossFamilyMembers) but their UIDs remain in memberUids until the wp archives at 25h.
    // Trade-off: their client may still see the wp doc in their subscription until the next
    // memberUids cleanup pass. Acceptable for v1 — the wp surface is mostly dormant for them.
    const newCrossFamily = (cur.crossFamilyMembers || []).filter(r => r && r.familyCode !== removeFamilyCode);

    await updateDoc(ref, {
      families: newFamilies,
      crossFamilyMembers: newCrossFamily,
      lastActivityAt: Date.now(),
    });
    flashToast(`Removed the ${fdn} couch.`, 'good');
  } catch (err) {
    flashToast(`Couldn't remove that couch (${(err && err.message) || 'unknown error'}).`, 'warn');
  }
}
```

CRITICAL CALL-WIRING: renderAddFamilySection MUST be called whenever the wp-create modal opens AND whenever the wp doc updates (snapshot callback). Find the existing modal-open path (Grep `openWpStartModal` or similar; if not found, find where the modal CSS class is toggled visible) and add a call to `renderAddFamilySection(wp)` there. Also wire it into the existing snapshot callback so the section re-renders on wp update (the existing `state.unsubWatchparties` snapshot callback at line 4889 area — find the activeWatchpartyId branch and add renderAddFamilySection(currentWp) after the existing render calls).

Verify imports: `httpsCallable` and `functions` are imported from './firebase.js' — Grep the existing import line to confirm. `getDoc` and `updateDoc` are also already imported.

Note the v1 trade-off in onClickRemoveCouch: removed family's UIDs remain in memberUids (their roster chips disappear immediately, but their subscription continues to see the wp until natural archive). This is documented inline as acceptable for v1 (W5 fix — disposition recorded in this plan's threat model as **T-30-14: Residual read access after Remove this couch — ACCEPT (v1)**). Plan 05's HUMAN-UAT.md scaffold includes UAT-30-11 specifically verifying this known limitation. Phase 30.x could add a memberUids prune pass if usage signal warrants.
  </action>
  <verify>
    <automated>grep -q "function renderAddFamilySection" js/app.js &amp;&amp; grep -q "function onClickAddFamily" js/app.js &amp;&amp; grep -q "function onClickRemoveCouch" js/app.js &amp;&amp; grep -q "httpsCallable(functions, 'addFamilyToWp')" js/app.js &amp;&amp; npm run smoke:app-parse</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "function renderAddFamilySection" js/app.js` returns 0
    - `grep -q "function onClickAddFamily" js/app.js` returns 0
    - `grep -q "function onClickRemoveCouch" js/app.js` returns 0
    - `grep -q "httpsCallable(functions, 'addFamilyToWp')" js/app.js` returns 0
    - `grep -q "That's a big couch" js/app.js` returns 0 (soft-cap copy locked from UI-SPEC)
    - `grep -q "This couch is full for tonight" js/app.js` returns 0 (hard-cap copy locked from UI-SPEC)
    - `grep -q "Couch added" js/app.js` returns 0 (success toast copy locked from UI-SPEC)
    - `grep -q "No family with that code" js/app.js` returns 0 (error matrix copy locked from UI-SPEC)
    - `grep -q "is already here" js/app.js` returns 0 (idempotency copy locked from UI-SPEC)
    - `grep -q "(your couch)" js/app.js` returns 0 (own-family suffix locked from UI-SPEC)
    - `grep -q "renderAddFamilySection(wp)" js/app.js` returns AT LEAST 2 (one in wp-create modal-open, one in snapshot callback) — call sites wire the helper into the lifecycle. **Note:** Task 4.3 adds a third call site in renderWatchpartyLive for the wp-edit surface; final count after Task 4.3 will be AT LEAST 3 (re-verified in Task 4.5 smoke sentinels).
    - `grep -q "state.me.id === wp.hostId" js/app.js` returns 0 (host-only render gate present)
    - `npm run smoke:app-parse` exits 0
    - Surface gracefully degrades when wp.families or wp.crossFamilyMembers is undefined (Array.isArray guard returns false → familyCount=0 → empty state renders)
    - **B1 fix — soft-cap threshold (CONTEXT D-08 + UI-SPEC):** `grep -q "familyCount >= 5" js/app.js` returns 0 (soft-cap branch fires at 5+ families, NOT 4)
    - **B1 fix — soft-cap threshold (CONTEXT D-08 + UI-SPEC):** `grep -c "familyCount >= 4" js/app.js` returns 0 (no leftover `>= 4` soft-cap branch — the only ceiling check is `>= 8` for hard cap)
  </acceptance_criteria>
  <done>
    Bring another couch in section is fully functional client-side: renders, host-gates, calls addFamilyToWp callable on submit, shows soft-cap (5+) + hard-cap (8+) copy correctly per CONTEXT D-08, supports host-only Remove this couch flow with confirmation. GROUP-30-01 closed end-to-end at the user surface; GROUP-30-05 closed at the client surface (server hard cap from Plan 02 backs it up).
  </done>
</task>

<task type="auto">
  <name>Task 4.3: Wire renderAddFamilySection into the wp-edit surface (renderWatchpartyLive lobby)</name>
  <files>js/app.js, app.html</files>
  <read_first>
    - js/app.js (Grep for `function renderWatchpartyLive` to locate the lobby render at line ~11909; specifically read the wp-lobby-card block at lines 12024-12034 to see where the host-only post-creation UI lives — this is the "wp-edit menu" surface per UI-SPEC § Component Inventory)
    - js/app.js (Grep for `renderAddFamilySection(wp)` to locate the existing call sites added in Task 4.2 — wp-create modal-open + snapshot callback)
    - app.html (no static hook needed in app.html for the wp-edit surface — the wp-live modal at #wp-live-modal-bg / #wp-live-coordination is rebuilt by renderWatchpartyLive on every render, so the hook is INJECTED into the lobby HTML string, not a pre-existing DOM element)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (Component Inventory line 169 — `.wp-add-family-section` lives in BOTH wp-create lobby + wp-edit menu)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md (D-05: cross-family wps form at wp-create OR via wp-edit affordance — the host can add families AFTER creation, not just at create-time)
    - .planning/ROADMAP.md (Phase 30 skeleton from Plan 01 Task 1.1 — affordance MUST be live in BOTH wp-create AND wp-edit per the Plan 04 objective)
  </read_first>
  <action>
**B2 fix — wp-edit surface delivery.** Plan 04 objective + UI-SPEC Component Inventory + ROADMAP all specify the affordance lives in BOTH wp-create AND the wp-edit menu (the host's post-creation view of the wp). Tasks 4.1 + 4.2 ship the wp-create surface only; this task closes the gap by injecting the same `wp-add-family-section` DOM hook into the wp-lobby-card rendered by renderWatchpartyLive AND wiring renderAddFamilySection(wp) into the lobby render path.

The "wp-edit menu" per UI-SPEC § Component Inventory is the host's post-creation view of an existing wp — that is, the wp lobby card rendered by renderWatchpartyLive (js/app.js:11909) into #wp-live-coordination. Unlike the wp-create modal (a static HTML block in app.html), the wp lobby is FULLY REBUILT by renderWatchpartyLive on every snapshot tick, so the DOM hook MUST be injected into the lobby HTML string (not added as a static hook in app.html).

Two sub-edits:

**(a) Inject the `#wp-add-family-section-lobby` hook into the wp-lobby-card HTML string.**

Locate the lobby HTML template literal at js/app.js:12024-12034 (`const lobbyHtml = ` followed by `<div class="wp-lobby-card">...` template). Add a new `<section>` block AFTER the existing `<div class="wp-lobby-actions">` block but BEFORE the closing `</div>` of `.wp-lobby-card`. The exact HTML to add inside the template literal (use template-literal escaping for `${}` interpolations as needed):

```
${isHost ? `
      <section class="wp-add-family-section" id="wp-add-family-section-lobby" aria-labelledby="wp-add-family-heading-lobby">
        <h3 class="wp-add-family-heading" id="wp-add-family-heading-lobby">Bring another couch in</h3>
        <p class="wp-add-family-subline" id="wp-add-family-subline-lobby"><em>Pull up another family for tonight.</em></p>
        <div class="wp-couches-list" id="wp-couches-list-lobby" role="list" aria-label="Families in this watchparty"></div>
        <div class="wp-add-family-input-row" id="wp-add-family-input-row-lobby">
          <input type="text" id="wp-add-family-input-lobby"
                 class="wp-add-family-input"
                 placeholder="Paste their family code"
                 inputmode="text"
                 autocapitalize="characters"
                 autocomplete="off"
                 autocorrect="off"
                 spellcheck="false"
                 aria-label="Other family's code">
          <button type="button" id="wp-add-family-submit-lobby" class="wp-add-family-submit btn">Bring them in</button>
        </div>
        <p class="wp-add-family-help"><em>They'll see their crew show up in this watchparty's couch.</em></p>
      </section>
    ` : ''}
```

**(b) Generalize renderAddFamilySection(wp, idSuffix='') to support both contexts.**

The Task 4.2 implementation of renderAddFamilySection uses hardcoded element IDs (`wp-add-family-section`, `wp-add-family-input`, `wp-add-family-submit`, `wp-couches-list`, etc.). The lobby surface uses the same selectors with a `-lobby` suffix. Refactor renderAddFamilySection to accept an optional `idSuffix` parameter (default `''`) and append it to all element IDs:

```
// OLD: function renderAddFamilySection(wp) { ... document.getElementById('wp-add-family-section') ... }
// NEW: function renderAddFamilySection(wp, idSuffix) {
//   const suffix = idSuffix || '';
//   const section = document.getElementById('wp-add-family-section' + suffix);
//   ...
//   const subline = document.getElementById('wp-add-family-subline' + suffix);
//   const inputRow = document.getElementById('wp-add-family-input-row' + suffix);
//   const list = document.getElementById('wp-couches-list' + suffix);
//   const submitBtn = document.getElementById('wp-add-family-submit' + suffix);
//   const input = document.getElementById('wp-add-family-input' + suffix);
//   const helpLine = section ? section.querySelector('.wp-add-family-help') : null;
//   ... rest of body unchanged (state-machine, host-only branching, kebab wiring all preserved)
// }
```

Also generalize onClickAddFamily(wp, idSuffix='') so the input lookup matches the calling context. Update the wp-create call site originally added in Task 4.2 to pass `renderAddFamilySection(wp, '')` (no-op default; equivalent to the original behavior — the existing call sites continue to work).

**(c) Add the wp-edit call site in renderWatchpartyLive.**

Locate the post-render hook for the lobby branch in renderWatchpartyLive (after `el.innerHTML = ...` writes the lobby HTML to #wp-live-coordination). Add the new call AFTER the innerHTML write. Search for the closing tag of the function or for `el.innerHTML` writes inside the lobby branch; the safest spot is at the end of the renderWatchpartyLive function body (just before the final closing `}`) so the call always fires after the latest innerHTML write — the helper internally no-ops if the `#wp-add-family-section-lobby` element doesn't exist (non-lobby branches: archived/cancelled/preStart/etc.):

```
// Phase 30 — wire the Bring another couch in lobby surface (host-only; the lobby HTML
// only includes the section when isHost, and renderAddFamilySection internally no-ops when
// the DOM element is missing — safe to call unconditionally on every renderWatchpartyLive tick).
if (typeof renderAddFamilySection === 'function') {
  renderAddFamilySection(wp, '-lobby');
}
```

**Notes:**
- The same `renderAddFamilySection` function is reused for both surfaces. The `idSuffix` parameter is the only difference. ZERO logic duplication.
- Host-only render gate: the lobby template uses `${isHost ? \`...\` : ''}` so non-hosts don't even see the section element on the lobby surface (per UI-SPEC § Interaction Contracts: "render-time gate, not a styling gate"). For non-hosts on the lobby surface, the read-only `.wp-couches-list` (D-06 transparency) is delivered separately by Plan 03 in renderParticipantTimerStrip.
- Soft-cap (5+) per B1, hard-cap (8+), and remove-couch flows all carry forward verbatim into the wp-edit surface — same code path, same copy strings.
- The wp-create static hook in app.html (Task 4.1) and the wp-edit dynamic hook (this task) never coexist on screen: the wp-create modal is dismissed before wp-live opens, so duplicate-ID concerns don't arise at runtime. The element IDs are nonetheless distinct (`wp-add-family-section` vs `wp-add-family-section-lobby`) for defensive a11y.
  </action>
  <verify>
    <automated>grep -q "wp-add-family-section-lobby" js/app.js &amp;&amp; grep -q "renderAddFamilySection(wp, '-lobby')" js/app.js &amp;&amp; grep -q "function renderAddFamilySection(wp, idSuffix" js/app.js &amp;&amp; npm run smoke:app-parse</automated>
  </verify>
  <acceptance_criteria>
    - **B2 fix — wp-edit surface in lobby HTML:** `grep -q "wp-add-family-section-lobby" js/app.js` returns 0 (lobby DOM hook injected into renderWatchpartyLive template literal)
    - **B2 fix — wp-edit call site:** `grep -c "renderAddFamilySection" js/app.js` returns AT LEAST 4 — function definition (1) + wp-create modal-open call site (1) + snapshot callback call site (1) + wp-lobby render call site (1)
    - **B2 fix — call site invocations:** `grep -c "renderAddFamilySection(wp" js/app.js` returns AT LEAST 3 — three actual invocations (wp-create modal-open, snapshot callback, lobby render)
    - **B2 fix — generalized helper signature:** `grep -q "function renderAddFamilySection(wp, idSuffix" js/app.js` returns 0
    - **B2 fix — lobby call uses '-lobby' suffix:** `grep -q "renderAddFamilySection(wp, '-lobby')" js/app.js` returns 0
    - app.html is UNCHANGED in this task (no new static hook for the lobby; the lobby hook is dynamic in the renderWatchpartyLive template literal). Verify: `grep -c "wp-add-family-section" app.html` returns 1 (only the wp-create hook from Task 4.1)
    - wp-create static hook from Task 4.1 STILL present: `grep -q 'id="wp-add-family-section"' app.html` returns 0
    - Lobby template literal contains the host-only conditional guard for the new section: `grep -q "wp-add-family-section-lobby" js/app.js` returns 0 AND the surrounding template uses `${isHost ?` to gate it — verify by reading js/app.js around the wp-lobby-card block
    - Sub-line, input row, list, submit, and input selectors all have lobby variants present: `grep -q "wp-add-family-input-row-lobby" js/app.js` returns 0; `grep -q "wp-couches-list-lobby" js/app.js` returns 0; `grep -q "wp-add-family-submit-lobby" js/app.js` returns 0; `grep -q "wp-add-family-input-lobby" js/app.js` returns 0; `grep -q "wp-add-family-subline-lobby" js/app.js` returns 0
    - `npm run smoke:app-parse` exits 0 (no parse regression from the lobby template literal injection)
    - The same renderAddFamilySection function handles both contexts — ZERO logic duplication. Verify only ONE function declaration: `grep -c "function renderAddFamilySection" js/app.js` returns 1
  </acceptance_criteria>
  <done>
    The Bring another couch in affordance is now delivered on BOTH wp-create AND wp-edit (lobby) surfaces. Same renderAddFamilySection helper drives both — only the idSuffix changes. Host-only gate, soft-cap (5+), hard-cap (8+), and remove-couch flows all carry forward verbatim. Plan 04 objective + UI-SPEC Component Inventory + ROADMAP skeleton requirement satisfied. B2 closed.
  </done>
</task>

<task type="auto">
  <name>Task 4.4: Add Phase 30 CSS family to css/app.css (~140 lines using existing semantic tokens)</name>
  <files>css/app.css</files>
  <read_first>
    - css/app.css (Grep first for `.wp-participants-strip` to locate the existing chip recipe at ~line 769; Read offset=765 limit=30 to see the exact CSS pattern Phase 30 chips reuse)
    - css/app.css (Grep for `.wp-` selectors to scan the existing watchparty CSS family naming conventions)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (sections "Color" + "Spacing Scale" + "Typography" + "Component Inventory" — locked semantic tokens + class names)
  </read_first>
  <action>
Append a new Phase 30 CSS block to the end of css/app.css. The block should use ONLY existing semantic tokens (var(--bg), var(--surface), var(--surface-2), var(--ink), var(--ink-warm), var(--ink-dim), var(--accent), var(--good), var(--warn), var(--bad), var(--border), var(--space-*), var(--t-*), var(--font-*), var(--duration-*), var(--easing-*)). Do NOT introduce any new color tokens or sizing tokens.

Use this CSS (~140 lines):

```css
/* === Phase 30 — Couch groups: Bring another couch in affordance + cross-family chip suffix === */

.wp-add-family-section {
  margin-top: var(--space-stack-lg);
  padding-top: var(--space-stack-md);
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: var(--space-stack-sm);
}

.wp-add-family-heading {
  font-family: var(--font-display);
  font-size: var(--t-h3);
  font-weight: 600;
  line-height: 1.25;
  color: var(--ink);
  margin: 0;
}

.wp-add-family-subline {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--t-h3);
  line-height: 1.4;
  color: var(--ink-warm);
  margin: 0;
  transition: color var(--duration-base) var(--easing-standard);
}

.wp-add-family-subline-warn {
  color: var(--warn);
}

.wp-couches-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-stack-sm);
}

.wp-couches-empty {
  font-family: var(--font-sans);
  font-size: var(--t-body);
  color: var(--ink-warm);
  margin: 0;
}

.wp-couches-empty strong {
  font-family: var(--font-display);
  font-weight: 600;
  color: var(--ink);
  display: block;
  margin-bottom: var(--space-inline-xs);
}

.wp-couches-empty em {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-warm);
}

.wp-couches-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--space-inline-sm) var(--space-inline-md);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  min-height: 44px;
}

.wp-couches-row.own .wp-couches-row-label .muted {
  color: var(--ink-dim);
  font-size: 0.92em;
}

.wp-couches-row-label {
  font-family: var(--font-sans);
  font-size: var(--t-body);
  color: var(--ink);
}

.wp-couches-remove {
  background: transparent;
  border: none;
  color: var(--ink-dim);
  font-size: 18px;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wp-couches-remove:hover {
  background: var(--surface);
  color: var(--ink);
}

.wp-add-family-input-row {
  display: flex;
  gap: var(--space-inline-md);
  align-items: stretch;
}

.wp-add-family-input {
  flex: 1;
  min-width: 0;
  font-family: var(--font-sans);
  font-size: var(--t-body);
  padding: var(--space-inline-sm) var(--space-inline-md);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--ink);
  text-transform: uppercase;
}

.wp-add-family-input::placeholder {
  color: var(--ink-dim);
  text-transform: none;
}

.wp-add-family-submit {
  font-family: var(--font-sans);
  font-size: var(--t-body);
  font-weight: 600;
  padding: var(--space-inline-sm) var(--space-inline-lg);
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--ink);
  cursor: pointer;
  white-space: nowrap;
  min-height: 44px;
}

.wp-add-family-submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.wp-add-family-submit:hover:not(:disabled) {
  background: var(--surface);
}

.wp-add-family-help {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--t-meta);
  color: var(--ink-dim);
  margin: 0;
}

/* Cross-family chip in renderParticipantTimerStrip (Plan 03 Task 3.5 added the chip + .family-suffix span) */
.wp-participant-chip.cross-family {
  /* Reuses the existing .wp-participant-chip recipe verbatim — only the data-source differs. */
}

.family-suffix {
  font-family: var(--font-serif);
  font-style: italic;
  color: var(--ink-dim);
  font-weight: 400;
  margin-left: var(--space-inline-xs);
}

/* Mobile-first: input row stacks below 600px viewport per UI-SPEC */
@media (max-width: 599px) {
  .wp-add-family-input-row {
    flex-direction: column;
  }
  .wp-add-family-submit {
    width: 100%;
  }
}

/* prefers-reduced-motion guard for the soft-cap sub-line color transition */
@media (prefers-reduced-motion: reduce) {
  .wp-add-family-subline {
    transition: none;
  }
}

/* === END Phase 30 === */
```

Critical:
- ZERO new color tokens introduced — every `var(--xxx)` reference exists in the existing semantic alias layer.
- 44px minimum tap target on .wp-couches-row and .wp-add-family-submit per UI-SPEC accessibility note.
- Mobile-first stack at 600px breakpoint per UI-SPEC.
- prefers-reduced-motion guard per BRAND § 5.
- The `.wp-participant-chip.cross-family` selector is a noop (empty body) — Plan 03 chip uses inline-style background:${color} for the avatar; the chip class is just a hook for future styling if needed.
  </action>
  <verify>
    <automated>grep -c "Phase 30 — Couch groups" css/app.css &amp;&amp; grep -q ".wp-add-family-section" css/app.css &amp;&amp; grep -q ".family-suffix" css/app.css &amp;&amp; grep -q "@media (max-width: 599px)" css/app.css</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "Phase 30 — Couch groups" css/app.css` returns 0 (block marker present)
    - `grep -c "\\.wp-add-family-" css/app.css` returns AT LEAST 7 (selectors: -section, -heading, -subline, -subline-warn, -input-row, -input, -submit, -help)
    - `grep -q "\\.wp-couches-list" css/app.css` returns 0
    - `grep -q "\\.wp-couches-row" css/app.css` returns 0
    - `grep -q "\\.wp-couches-remove" css/app.css` returns 0
    - `grep -q "\\.family-suffix" css/app.css` returns 0
    - `grep -q "@media (max-width: 599px)" css/app.css` returns 0 (mobile breakpoint present)
    - `grep -q "@media (prefers-reduced-motion: reduce)" css/app.css` returns AT LEAST 1 (the new guard added)
    - ZERO new color tokens introduced — verify by grep `grep -E "(#[0-9a-fA-F]{3,6})|(rgba?\\()" css/app.css` count BEFORE vs AFTER edit; counts should match (no inline color literals added in the new block)
    - `grep -E "var\\(--accent" css/app.css` count is UNCHANGED in the new block (no new accent burn per UI-SPEC § Color)
    - 44px minimum tap target — `grep -q "min-height: 44px" css/app.css` returns AT LEAST 2 (.wp-couches-row + .wp-add-family-submit)
  </acceptance_criteria>
  <done>
    ~140 lines of Phase 30 CSS appended to css/app.css using only existing semantic tokens. Mobile-first responsive at 600px. 44px tap targets. Reduced-motion guard. Family-suffix italic Instrument Serif at --ink-dim per D-09 visual contract. ZERO new design tokens introduced.
  </done>
</task>

<task type="auto">
  <name>Task 4.5: Extend smoke-couch-groups.cjs with UI affordance + cap copy + remove-flow sentinels</name>
  <files>scripts/smoke-couch-groups.cjs</files>
  <read_first>
    - scripts/smoke-couch-groups.cjs (full file — Plan 03 Task 3.6 left it at 21 production-code sentinels with FLOOR=8; this task extends both)
  </read_first>
  <action>
Append a new sub-section to the production-code sentinel section in scripts/smoke-couch-groups.cjs. After the last existing sentinel (2.21 wpMigrate idempotency), add:

```
// === Wave 3 — UI affordance + cap copy + remove flow sentinels ===
const appHtmlSrc = readIfExists(path.join(COUCH_ROOT, 'app.html'));
const appCssSrc = readIfExists(path.join(COUCH_ROOT, 'css', 'app.css'));

// 2.22 — DOM hook
eqContains('2.22 app.html has wp-add-family-section DOM hook', appHtmlSrc, 'wp-add-family-section');
eqContains('2.23 app.html section heading copy locked', appHtmlSrc, 'Bring another couch in');
eqContains('2.24 app.html input placeholder copy locked', appHtmlSrc, 'Paste their family code');
eqContains('2.25 app.html submit button copy locked', appHtmlSrc, 'Bring them in');

// 2.26 — JS handlers
eqContains('2.26 app.js declares renderAddFamilySection', appJsSrc, 'function renderAddFamilySection');
eqContains('2.27 app.js declares onClickAddFamily', appJsSrc, 'function onClickAddFamily');
eqContains('2.28 app.js declares onClickRemoveCouch', appJsSrc, 'function onClickRemoveCouch');
eqContains('2.29 app.js wires httpsCallable(functions, addFamilyToWp)', appJsSrc, "httpsCallable(functions, 'addFamilyToWp')");
eqContains('2.30 app.js host-only render gate', appJsSrc, 'state.me.id === wp.hostId');

// 2.31 — Cap copy strings (D-08)
eqContains('2.31 app.js soft-cap copy: That\'s a big couch — are you sure?', appJsSrc, "That's a big couch");
eqContains('2.32 app.js hard-cap copy: This couch is full for tonight', appJsSrc, 'This couch is full for tonight');

// 2.33 — Error matrix copy
eqContains('2.33 app.js no-family error copy', appJsSrc, 'No family with that code. Double-check the spelling.');
eqContains('2.34 app.js host-only error copy', appJsSrc, 'Only the host can add families');
eqContains('2.35 app.js no-more-room error copy', appJsSrc, 'No more room on this couch tonight.');

// 2.36 — Success + idempotent toasts
eqContains('2.36 app.js success toast: Couch added', appJsSrc, "'Couch added'");
eqContains('2.37 app.js idempotent toast: is already here', appJsSrc, 'is already here');

// 2.38 — CSS new selectors
eqContains('2.38 css/app.css declares .wp-add-family-section', appCssSrc, '.wp-add-family-section');
eqContains('2.39 css/app.css declares .family-suffix', appCssSrc, '.family-suffix');
eqContains('2.40 css/app.css declares mobile breakpoint', appCssSrc, '@media (max-width: 599px)');

// 2.41 — Remove-couch flow
eqContains('2.41 app.js remove-couch confirm modal copy', appJsSrc, 'Their crew will lose access to this watchparty');

// === Wave 3 — B1 fix: soft-cap threshold ===
// Per CONTEXT D-08 + UI-SPEC Copywriting Contract — soft-cap warning triggers at 5+ families (above 4), NOT at 4.
eqContains('2.42 app.js soft-cap threshold is >=5 (B1 fix)', appJsSrc, 'familyCount >= 5');
// Defensive: ensure no leftover >=4 soft-cap branch (the only ceiling check is >=8 hard cap).
eq('2.43 app.js no leftover familyCount >= 4 soft-cap branch (B1 fix)', (appJsSrc.match(/familyCount >= 4/g) || []).length, 0);

// === Wave 3 — B2 fix: wp-edit (lobby) surface delivery ===
// Per Plan 04 objective + UI-SPEC § Component Inventory + ROADMAP skeleton — affordance must live in BOTH wp-create AND wp-edit (lobby).
eqContains('2.44 app.js lobby DOM hook wp-add-family-section-lobby (B2 fix)', appJsSrc, 'wp-add-family-section-lobby');
eqContains('2.45 app.js generalized renderAddFamilySection signature with idSuffix (B2 fix)', appJsSrc, 'function renderAddFamilySection(wp, idSuffix');
eqContains('2.46 app.js lobby call site uses -lobby suffix (B2 fix)', appJsSrc, "renderAddFamilySection(wp, '-lobby')");
// Floor for renderAddFamilySection occurrences: function decl (1) + wp-create call (1) + snapshot call (1) + lobby call (1) >= 4.
eq('2.47 app.js renderAddFamilySection occurrences >= 4 (decl + 3 call sites)', (appJsSrc.match(/renderAddFamilySection/g) || []).length >= 4, true);

// === Wave 3 — W4 fix: zero-member family guard error matrix copy (Plan 02 CF + Plan 04 UI) ===
// addFamilyToWp CF throws failed-precondition for zero-member families; UI surfaces a warm, brand-voice toast.
eqContains('2.48 app.js failed-precondition toast for zero-member family (W4 fix)', appJsSrc, "hasn't added any members yet");

```

Also raise the FLOOR in section 3 from 8 to 16 (mirroring the Phase 27 smoke pattern but bumped to cover the B1+B2+W4 sentinels added in this revision):

Change `const FLOOR = 8;` to `const FLOOR = 16;`.
  </action>
  <verify>
    <automated>npm run smoke:couch-groups</automated>
  </verify>
  <acceptance_criteria>
    - `npm run smoke:couch-groups` exits 0
    - Smoke output passes ALL 27 new sentinels (2.22 through 2.48; 20 original + 7 revision-added for B1/B2/W4)
    - Floor meta-assertion shows `production-code sentinel floor met (48 >= 16)` (or similar, depending on count: 21 from Plan 03 + 27 from Plan 04 = 48 production-code assertions)
    - `npm run smoke` (full aggregate) exits 0
    - `cd tests && npm test` still exits 0 (rules tests still 56 PASS)
    - `grep -c "eqContains" scripts/smoke-couch-groups.cjs` returns AT LEAST 46 (21 + 25 string-based; the 2 numeric `eq` checks at 2.43 + 2.47 are separate)
    - `grep -q "const FLOOR = 16" scripts/smoke-couch-groups.cjs` returns 0
    - **B1 sentinel:** `grep -q "familyCount >= 5" scripts/smoke-couch-groups.cjs` returns 0
    - **B2 sentinel:** `grep -q "wp-add-family-section-lobby" scripts/smoke-couch-groups.cjs` returns 0
    - **W4 sentinel:** `grep -q "hasn't added any members yet" scripts/smoke-couch-groups.cjs` returns 0
  </acceptance_criteria>
  <done>
    Smoke production-code sentinel coverage extended to all UI affordance + cap copy + error matrix + remove flow + B1 (soft-cap threshold) + B2 (wp-edit surface) + W4 (zero-member guard) surfaces. FLOOR raised to 16. GROUP-30-01 + GROUP-30-05 fully codified at the smoke layer including revision fixes.
  </done></task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted user input -> addFamilyToWp callable | Input bound at client level (length + characters via UI-SPEC autocapitalize); CF re-validates per Plan 02 (looksLikeFamilyCode) |
| Host-direct write to wp.families/crossFamilyMembers (Path A in rules) | Plan 02 firestore.rules permits any-field write for the host (Path A); non-host writes blocked by Path B denylist; the v1 Remove this couch flow relies on this Path A access |
| Toast error message -> user | Error messages MUST NOT leak internal details (CF returns neutral 'No family with that code.' regardless of whether the code is malformed, doesn't exist, or the family is private) — Plan 02 enforces this server-side; Plan 04 surfaces it client-side per UI-SPEC error matrix |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-30-10 | Information Disclosure | Family-code enumeration via UI | mitigate | UI-SPEC error matrix maps all CF error codes to neutral copy (`No family with that code. Double-check the spelling.`); the server (Plan 02) returns identical errors regardless of malformed/nonexistent/not-host states |
| T-30-11 | Tampering | Non-host attempts Remove this couch via DOM tampering | mitigate | Render-time gate (`if (!isHost) section.classList.add('non-host-view'); return;`) prevents handler binding for non-hosts; even if a non-host bypasses gate via DevTools, the Path B denylist in firestore.rules blocks the write server-side |
| T-30-12 | Denial of Service | Spam clicks on Bring them in | mitigate | The 4-state machine sets submitBtn.disabled = true during validating; click coalescing prevents duplicate CF calls; the CF idempotency guard (Plan 02) makes duplicate calls safe |
| T-30-13 | Cross-Site Scripting | Family display name rendered without escape | mitigate | All user-derived strings in renderAddFamilySection wrapped in escapeHtml(); .innerHTML assignments only use escaped content |
| T-30-14 | Information Disclosure | Residual read access after Remove this couch (W5 fix — disposition documented) | accept | Removed family's UIDs remain in `wp.memberUids[]` (v1 trade-off — see Pitfall 4 acceptance and the inline comment in onClickRemoveCouch). Removed members retain Firestore read access until natural 25h archive (`WP_ARCHIVE_MS`). UI hides the family from the .wp-couches-list and .crossFamilyMembers roster immediately, but the `request.auth.uid in resource.data.memberUids` rule gate stays open. **Disposition: ACCEPT (v1).** Mitigation deferred to Phase 30.x if usage signal warrants a memberUids prune (e.g., post-remove transactional UID cleanup or a scheduled reaper). UAT script in Plan 05 (UAT-30-11) explicitly documents and verifies this v1 known limitation. |
</threat_model>

<verification>
1. `npm run smoke:app-parse` exits 0 after every js/app.js + app.html + css/app.css edit (parse integrity)
2. `npm run smoke:couch-groups` exits 0 with FLOOR=16 satisfied (production-code assertions >= 16; raised from 13 to cover B1+B2+W4 revision sentinels)
3. `npm run smoke` (full 12-contract aggregate) exits 0 — no other smoke regressed
4. `cd tests && npm test` exits 0 (still 56 PASS from Plan 02; this plan touches no rules)
5. Visual sanity (manual): open app.html in browser, navigate to wp-create flow, confirm:
   - Section "Bring another couch in" appears for host (state.me.id === wp.hostId)
   - Section is HIDDEN for non-host (read .wp-couches-list visible but no input/kebab)
   - At wp.families.length === 4 sub-line still shows "Pull up another family for tonight." (B1 fix — soft cap is at 5+, NOT 4)
   - At wp.families.length === 5 (after addFamily fires once more), sub-line swaps to "That's a big couch — are you sure?" and gets warn color (B1 fix — threshold now `familyCount >= 5`)
   - At wp.families.length === 8 the input row hides; sub-line shows "This couch is full for tonight."
   - Mobile viewport (resize to 599px width): input row stacks vertically
</verification>

<success_criteria>
- app.html has #wp-add-family-section DOM hook with locked copy
- js/app.js has renderAddFamilySection + onClickAddFamily + onClickRemoveCouch with full 4-state machine + error matrix from UI-SPEC + soft/hard-cap branching
- css/app.css has Phase 30 selector family using only existing semantic tokens
- scripts/smoke-couch-groups.cjs at 48+ production-code assertions, FLOOR=16 (raised from 13 in revision to cover B1+B2+W4 sentinels)
- GROUP-30-01 + GROUP-30-05 fully closed at user-facing surface
- ZERO new design tokens introduced (BRAND.md token discipline preserved)
- ZERO regressions: full smoke aggregate green; rules tests 56 PASS
- Plan 05 unblocked (only deploy + cache bump + UAT scaffold remain)
</success_criteria>

<output>
After completion, create `.planning/phases/30-couch-groups-affiliate-hooks/30-04-SUMMARY.md` documenting:
- 4 modified files in couch repo
- Bring another couch in section live in wp-create modal (host-gated)
- 4-state machine (idle/validating/success/error) with locked UI-SPEC copy
- Soft-cap warning at 5+ families; hard-cap hide at 8+
- Remove this couch host-only flow (client-direct Path A write; v1 trade-off documented)
- ~140 lines of Phase 30 CSS using only existing semantic tokens
- smoke-couch-groups.cjs at 48+ production-code assertions, FLOOR=16
- requirements_completed: GROUP-30-01 (full surface), GROUP-30-05 (full surface)
- Resume signal: Plan 05 ready to begin (deploy + UAT scaffold)
</output>
