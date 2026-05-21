---
phase: 14-decision-ritual-core
plan: 10
type: execute
wave: 5
depends_on: [14-04, 14-09]
gap_closure: true
gap_source: 14-UAT.md
files_modified:
  - app.html
  - js/app.js
  - css/app.css
  - sw.js
  - ../../../../queuenight/firestore.rules
autonomous: false
requirements: [DECI-14-06]
tags: [couch-viz, redesign, dual-mode, gap-closure, sketch-003-v5, firestore-migration, post-uat]

must_haves:
  truths:
    - "Tonight tab renders ONE 'who's on the couch' surface — the new V5 roster — not two stacked surfaces."
    - "Each family member appears as a toggleable pill (out / in / me states) in a wrap-flex roster."
    - "Tapping any pill flips that member's in/out state — works for self AND proxy (same gesture)."
    - "Long-pressing an out-state pill for 700ms sends a push to that member with toast confirmation."
    - "The 'me' pill (state.me.id) shows a solid amber outline regardless of in/out state, with a YOU tag."
    - "Sub-line copy is dynamic: 0-in shows 'Tap who's watching'; me-only shows 'It's just you so far — tap others in'; partial shows 'N are watching'; all-in shows 'Whole couch is in'."
    - "Tally bar shows '<N> of <M> watching' with Fraunces num + Instrument Serif italic 'of M watching'."
    - "Action row shows 'Mark everyone in' / 'Clear couch' / 'Send pushes to the rest' visibility-gated by current state."
    - "couchInTonight Firestore writes succeed for any family member writing any other family member's slot (proxy-fill allowed) — audit trail via proxyConfirmedBy."
    - "state.couchMemberIds is derived from couchInTonight (filtered to in===true) so 14-01 isWatchedByCouch / 14-03 tier aggregators / 14-07 Flow A roster all keep working unchanged."
    - "Vacate UX is native — tapping your own in-state pill flips you out (no hidden affordance, no 'I can only click once' confusion)."
    - "Find-a-seat empty-state CTA card no longer appears below the couch viz — V5 roster handles empty-state visually with dashed pills, AND renderFlowAEntry re-renders on family-doc snapshot anyway as belt-and-suspenders."
    - "Legacy who-card from Phase 11 no longer renders on Tonight tab."
    - "PWA cache version bumped to couch-v34.1-roster-control so installed PWAs invalidate and pick up the new roster on next online launch."

  artifacts:
    - path: "app.html"
      provides: "Removed legacy .who-card div block (Bug A); kept #couch-viz-container + #flow-a-entry-container slots"
      contains: "couch-viz-container"
      excludes: "who-card"
    - path: "js/app.js"
      provides: "Replaced renderCouchViz + renderCouchAvatarGrid with V5 roster renderer; new toggleCouchMember + sendCouchPing + persistCouchInTonight + couchInTonightToMemberIds; couchInTonight family-doc read path with backward-compat couchSeating fallback; renderFlowAEntry empty-state card simplified or deleted; orphan applyModeLabels who-title-label set removed; sticky who-mini IIFE updated to query #couch-viz-container instead of .who-card"
      exports: ["renderCouchViz", "toggleCouchMember", "sendCouchPing"]
    - path: "css/app.css"
      provides: "New .roster + .pill (out/in/me + .pinging) + .ping-hint + .tally + .pill-actions + .pill-hint rules; couch-empty-pulse and .seat-cell legacy rules removed or marked dead"
      contains: ".pill.out"
    - path: "sw.js"
      provides: "CACHE bumped to couch-v34.1-roster-control"
      contains: "couch-v34.1-roster-control"
    - path: "../../../../queuenight/firestore.rules"
      provides: "Additive 4th UPDATE branch on /families/{code} allowing attributedWrite + affectedKeys hasOnly couchInTonight + 4 attribution fields; mirrors the existing couchSeating branch pattern"
      contains: "couchInTonight"

  key_links:
    - from: "js/app.js renderCouchViz()"
      to: "#couch-viz-container in app.html line 317"
      via: "innerHTML assignment to the same container element 14-04 used"
      pattern: "couch-viz-container"
    - from: "js/app.js family-doc onSnapshot at line ~4131-4150"
      to: "state.couchMemberIds + state.couchInTonight"
      via: "hydrate from d.couchInTonight (preferred) or d.couchSeating (legacy fallback)"
      pattern: "couchInTonight|couchSeating"
    - from: "js/app.js toggleCouchMember(memberId)"
      to: "families/{code}.couchInTonight.{memberId}"
      via: "updateDoc with dot-path mutation + writeAttribution"
      pattern: "couchInTonight\\."
    - from: "queuenight/firestore.rules"
      to: "client persistCouchInTonight write"
      via: "attributedWrite + affectedKeys hasOnly allowlist"
      pattern: "couchInTonight"
    - from: "js/app.js renderFlowAEntry"
      to: "family-doc onSnapshot block"
      via: "explicit re-render call after renderCouchViz"
      pattern: "renderFlowAEntry"
---

<objective>
Close 3 UAT gaps from Phase 14 surfaces (Tests 1, 3, 5, 24) by shipping the Sketch 003 Variant 5 "Roster IS the control" redesign of the Couch viz, plus two one-line bug fixes that the redesign would otherwise leave dangling.

**Purpose:** UAT identified that Phase 14-04's per-cushion grid metaphor produces visual clutter on desktop (7 dashed-amber `+` placeholders for an 8-member family with 1 claim) AND that vacate UX is non-discoverable AND that two "who's on the couch" surfaces stack on Tonight (legacy 11-01 who-card + new 14-04 viz). User picked V5 from sketch 003 — make the family roster ITSELF the control surface, with each member as a tappable pill. Same gesture vocabulary serves proxy-fill, self-claim, and remote-ping. Drops the abstract "seats" metaphor entirely; migrates Firestore from positional `couchSeating: { [mid]: index }` to member-keyed `couchInTonight: { [mid]: { in, at, proxyConfirmedBy? } }`.

**Output:**
- V5 roster pills replace the cushion grid in #couch-viz-container
- couchInTonight Firestore shape with backward-compat read of couchSeating + dual-write for one release
- queuenight/firestore.rules allows proxy writes to any member's couchInTonight slot (audit via proxyConfirmedBy)
- Long-press → push interaction wired
- Bug A (legacy .who-card double-render) closed
- Bug B (renderFlowAEntry stale empty-state) closed by snapshot wiring + likely obsoleted by V5 layout
- sw.js CACHE bumped to couch-v34.1-roster-control
- All downstream consumers (14-01 isWatchedByCouch / 14-03 tier aggregators / 14-07 Flow A roster) keep working — same state.couchMemberIds contract, different upstream source
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@./CLAUDE.md
@.planning/phases/14-decision-ritual-core/14-UAT.md
@.planning/sketches/003-couch-viz-redesign/README.md
@.planning/sketches/003-couch-viz-redesign/variant-5-roster-control.html
@.planning/sketches/MANIFEST.md

<!-- 14-04 SUMMARY for the surface this plan replaces -->
@.planning/phases/14-decision-ritual-core/14-04-SUMMARY.md
<!-- 14-09 SUMMARY for the empty-state-c branch this plan obsoletes -->
@.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md

<interfaces>
<!-- Key code surfaces the executor must touch. Line numbers verified from current source. -->
<!-- Use these directly — no codebase exploration needed for the spots called out. -->

==== app.html (Tonight tab, lines 313-340) ====
Current shape (KEEP #couch-viz-container; KEEP #flow-a-entry-container; DELETE .who-card block):

```html
<!-- line 317 — KEEP, this is the V5 mount point -->
<div id="couch-viz-container" class="couch-viz-container" aria-label="Who's on the couch tonight"></div>
<!-- line 320 — KEEP, Flow A entry CTA still renders below the roster -->
<div id="flow-a-entry-container" class="flow-a-entry-container"></div>
<!-- ... picker-card + wp-banner-tonight + tonight-intents-strip stay ... -->

<!-- lines 334-337 — DELETE (Bug A) -->
<div class="who-card">
  <div class="who-title" id="who-title-label">Who's on the couch</div>
  <div class="who-list" id="who-list"></div>
</div>
```

==== js/app.js — current renderCouchViz (lines 12943-13092) ====
Pattern to REPLACE (don't preserve the cushion grid):

```js
function renderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;
  const totalMembers = (state.members || []).length;
  const claimedCount = (state.couchMemberIds || []).filter(Boolean).length;
  const couchSize = Math.min(COUCH_MAX_SLOTS, Math.max(2, totalMembers, claimedCount));
  container.innerHTML = `
    <img class="couch-hero" src="${COUCH_HERO_SRC}" alt="Couch" />
    <h3 class="couch-headline">On the couch tonight</h3>
    <p class="couch-sub">${claimedCount > 0 ? `${claimedCount} of ${couchSize} here` : 'Tap a seat to claim it'}</p>
    ${renderCouchAvatarGrid(couchSize)}
  `;
  // tooltip anchor on .seat-cell.empty — must be re-anchored to a V5 .pill.out
}
```

State helpers consumed downstream (DO NOT BREAK these contracts):
- `state.couchMemberIds` — array of memberIds currently on the couch (filtered by in===true). 14-01 / 14-03 / 14-07 all read this.
- `state.couchInTonight` — NEW state shape: `{ [memberId]: { in: bool, at: timestamp, proxyConfirmedBy?: memberId } }`. The V5 renderer reads from this; downstream consumers continue to read state.couchMemberIds.
- `getCouchForFlowA()` at js/app.js:7697 returns state.couchMemberIds — no changes needed.

==== js/app.js — family-doc onSnapshot (lines 4131-4150) ====
Pattern to MODIFY (read both shapes; rebuild state.couchMemberIds; add renderFlowAEntry call):

```js
state.unsubGroup = onSnapshot(familyDocRef(), s => {
  if (!s.exists()) return;
  const d = s.data();
  state.group = { ... };
  state.ownerUid = d.ownerUid || null;
  // === REPLACE THIS BLOCK ===
  // OLD:
  //   const seating = d.couchSeating || {};
  //   const couchArr = [];
  //   Object.entries(seating).forEach(([mid, idx]) => { if (typeof idx === 'number' && idx >= 0) couchArr[idx] = mid; });
  //   state.couchMemberIds = couchArr;
  // NEW: read couchInTonight (preferred) OR fall back to couchSeating (legacy)
  state.couchInTonight = couchInTonightFromDoc(d);
  state.couchMemberIds = Object.keys(state.couchInTonight)
    .filter(mid => state.couchInTonight[mid] && state.couchInTonight[mid].in === true);
  // === END BLOCK ===
  if (typeof renderCouchViz === 'function') renderCouchViz();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry(); // ← NEW (Bug B fix)
  renderPickerCard();
  applyModeLabels();
  try { renderOwnerSettings(); } catch(e) {}
  try { renderLegacyClaimCtaIfApplicable(); } catch(e) {}
});
```

==== js/app.js — renderFlowAEntry empty-state branch (lines 13994-14014) ====
Current empty-state-c branch to DELETE (V5 obsoletes it; the dashed-pill roster IS the empty state):

```js
if (couchSize < 1) {
  container.innerHTML = `<div class="flow-a-no-couch queue-empty"> ... Find a seat ... </div>`;
  document.querySelectorAll('.couch-avatar-grid .seat-cell.empty').forEach(g => g.classList.add('cushion-glow'));
  return;
}
```

==== js/app.js — applyModeLabels orphan (line 4460) ====
Line to DELETE (the target #who-title-label is gone after Bug A fix):

```js
set('who-title-label', {family:"Who's on the couch", crew:"Who's on the couch", duo:"Who's on the couch"}[m]);
```

==== js/app.js — sticky who-mini IIFE (lines 13877-13909) ====
Currently queries `.who-card` to know when to show the sticky bar. After Bug A removes .who-card, this IIFE silently no-ops.
Strategy: rewire to query `#couch-viz-container` instead. The sticky bar concept (mini avatars after scrolling past the roster) still has product value.

```js
const whoCard = document.querySelector('#screen-tonight .who-card');
// ↓ becomes ↓
const whoCard = document.querySelector('#screen-tonight #couch-viz-container');
```

==== queuenight/firestore.rules — current couchSeating branch (lines 138-162) ====
The pattern to MIRROR for couchInTonight. The existing branch:

```firestore-rules
allow update: if (
    isMemberOfFamily(familyCode)
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['picker'])
  ) || (
    // Legacy ownership self-claim: ...
    isMemberOfFamily(familyCode)
    && !('ownerUid' in resource.data)
    && request.resource.data.ownerUid == uid()
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ownerUid'])
  ) || (
    // D-06: couchSeating write — attribution-required.
    attributedWrite(familyCode)
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
  );
```

After this plan it gains a 4th branch (added to the disjunction):
```firestore-rules
  ) || (
    // 14-10 (DECI-14-06 redesign per sketch 003 V5): couchInTonight write —
    // attribution-required. Any family member can write any member's slot
    // (proxy-fill is a feature). Audit trail via proxyConfirmedBy field.
    attributedWrite(familyCode)
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['couchInTonight', 'couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
  );
```
Note: includes 'couchSeating' in allowlist because Task 1 dual-writes both shapes for one release.

==== css/app.css — current couch-viz styles (lines 3138-3274) ====
DELETE/replace: .couch-avatar-grid (3182-3196), .seat-cell (3198-3208), .seat-avatar (3210-3228), .seat-empty (3230-3245), .seat-name (3251-3263), couch-empty-pulse (3266-3268).
KEEP: .couch-viz-container (3138-3146) base flex container, .couch-hero (3148-3161) — V5 still uses a hero icon (smaller — 84px not 280px), .couch-headline (3163-3171), .couch-sub (3173-3180).
KEEP: prefers-reduced-motion @media block but update its targets (3271-3274).

==== Variant 5 sketch — render() function (variant-5-roster-control.html lines 369-437) ====
THIS IS THE CONTRACT. The production renderCouchViz must produce equivalent DOM + behavior. Reproduce verbatim:
- pill className = `pill ${isIn?'in':'out'} ${isMe?'me':''}`
- pill.dataset.id = memberId
- pill innerHTML structure: `<div class="av" style="..."><span>{initial}</span></div><span class="label">{name}<span class="you-tag">YOU</span> (if me)</span><div class="ping-hint"></div>`
- mousedown / touchstart starts 700ms timer (only if !isIn)
- on timer fire: trigger ping flow + visual scale + 280ms reset + showToast
- on click without long-press: toggle in/out
- mouseup / mouseleave / touchend cancels timer
- click handler defends against didLongPress with e.preventDefault on the click event after timer fired

The sketch uses `inState.add/delete`. Production uses Firestore writes (toggleCouchMember + sendCouchPing) — same gesture, different persistence.
</interfaces>

</context>

<tasks>

<task type="auto">
  <name>Task 1: Add couchInTonight Firestore shape with backward-compat read + dual-write</name>
  <files>
    js/app.js (lines ~4131-4150 family-doc onSnapshot; lines ~12950-12953 D-06 comment block; insert new helpers near persistCouchSeating at ~13079)
  </files>
  <action>
**Goal:** Get the data layer change in BEFORE any UI change. After this commit, the app reads couchInTonight (with couchSeating fallback), writes BOTH shapes during the migration window, and downstream consumers (14-01 / 14-03 / 14-07) keep working unchanged because state.couchMemberIds is still populated.

**Implementation steps:**

1. Locate js/app.js around line 12943 (the `=== D-06 Couch viz ===` comment block). Update the comment to reflect the V5 redesign and migration:
```js
// === D-06 Couch viz — DECI-14-06 (Sketch 003 V5 redesign per 14-10) ===
// V5 winner: Roster IS the control. Each family member is a toggleable pill.
// Tap = flip in/out. Long-press out-pill (700ms) = send push.
//
// Firestore shape (Sketch 003 Material Decisions, locked 2026-04-26):
//   families/{code}.couchInTonight = { [memberId]: { in: bool, at: serverTimestamp, proxyConfirmedBy?: memberId } }
//
// Backward-compat: reads fall back to legacy couchSeating: { [memberId]: index }
// shape from 14-04 if couchInTonight is absent. Writes go to BOTH shapes for one
// PWA cache cycle (~1-2 weeks of v34.1 deployed) so v33/v34.0 PWAs don't break;
// drop the dual-write in a follow-up plan after the cache cycle elapses.
```

2. Insert this helper block immediately AFTER `const COUCH_MAX_SLOTS = 10;` at ~line 12954 (or wherever the new V5 constants live; if you delete COUCH_MAX_SLOTS in Task 3, place these helpers above the new render function instead):
```js
// 14-10 / V5 — hydrate couchInTonight from family doc with legacy couchSeating fallback.
// Returns the canonical { [memberId]: { in, at, proxyConfirmedBy? } } shape.
function couchInTonightFromDoc(d) {
  if (d && d.couchInTonight && typeof d.couchInTonight === 'object') {
    // Preferred: new shape already on the doc. Pass through verbatim.
    return d.couchInTonight;
  }
  // Legacy fallback: rebuild from couchSeating { [mid]: index }. Every member with
  // an index >= 0 is treated as in===true; timestamp unknown so omitted.
  const out = {};
  const seating = (d && d.couchSeating) || {};
  Object.entries(seating).forEach(([mid, idx]) => {
    if (typeof idx === 'number' && idx >= 0) {
      out[mid] = { in: true };
    }
  });
  return out;
}

// 14-10 / V5 — derive the indexed array shape downstream consumers expect.
// 14-01 isWatchedByCouch + 14-03 tier aggregators + 14-07 Flow A roster all read
// state.couchMemberIds — this keeps the contract stable across the migration.
function couchInTonightToMemberIds(cit) {
  if (!cit || typeof cit !== 'object') return [];
  return Object.keys(cit).filter(mid => cit[mid] && cit[mid].in === true);
}
```

3. Modify the family-doc onSnapshot at js/app.js:4140-4144. REPLACE these lines:
```js
const seating = d.couchSeating || {};
const couchArr = [];
Object.entries(seating).forEach(([mid, idx]) => { if (typeof idx === 'number' && idx >= 0) couchArr[idx] = mid; });
state.couchMemberIds = couchArr;
if (typeof renderCouchViz === 'function') renderCouchViz();
```
WITH:
```js
// 14-10 / V5 — couchInTonight is the new authoritative shape; couchSeating is
// the legacy fallback (auto-rebuilt by couchInTonightFromDoc when only the old
// field is present). state.couchMemberIds = filter(in===true) for downstream.
state.couchInTonight = couchInTonightFromDoc(d);
state.couchMemberIds = couchInTonightToMemberIds(state.couchInTonight);
if (typeof renderCouchViz === 'function') renderCouchViz();
if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
```
Note: the second new line is also Bug B's fix (Task 6), bundled here because both lines edit the same onSnapshot block; doing them in one commit avoids a merge conflict between Tasks 1 and 6.

4. Replace `persistCouchSeating()` at ~js/app.js:13079-13092 with a new dual-write helper. Replace the entire existing function body:
```js
// 14-10 / V5 — persist couchInTonight + couchSeating (dual-write during migration).
// Writes the new member-keyed shape AND the legacy positional shape so v33/v34.0
// PWAs reading couchSeating don't break during the rollout. After one PWA cache
// cycle (~1-2 weeks), drop the couchSeating write in a follow-up plan.
async function persistCouchInTonight() {
  if (!state.familyCode) return;
  const cit = state.couchInTonight || {};
  // Build legacy couchSeating map for back-compat: positional index by walking the
  // in-state members in the order they appear in state.members (stable for one
  // family-doc snapshot; the index is informational only — V5 doesn't read it).
  const seatingMap = {};
  let nextIdx = 0;
  (state.members || []).forEach(m => {
    if (cit[m.id] && cit[m.id].in === true) {
      seatingMap[m.id] = nextIdx++;
    }
  });
  try {
    await updateDoc(doc(db, 'families', state.familyCode), {
      couchInTonight: cit,
      couchSeating: seatingMap, // BACKCOMPAT: drop in follow-up after cache cycle
      ...writeAttribution()
    });
  } catch (e) {
    console.error('[couch] persist failed', e);
    flashToast('Could not save couch — try again', { kind: 'warn' });
  }
}
```

5. ALSO update the legacy claimCushion / claimCushionByMember helpers (js/app.js:13016-13075) to call persistCouchInTonight instead of persistCouchSeating, AND to mutate state.couchInTonight rather than state.couchMemberIds directly. **Easier path:** since Task 3 replaces the entire renderCouchViz + renderCouchAvatarGrid + claimCushion + openCouchOverflowSheet + claimCushionByMember surface, just leave the old claim* helpers calling the now-renamed persistCouchInTonight; they'll be deleted in Task 3 anyway. Verify by grep that no other callers exist:
```bash
grep -n "persistCouchSeating\|claimCushion" js/app.js
```
If only the soon-to-be-deleted block references them, no further work in this task. If anything else does (it shouldn't), update those callsites.

6. Smoke-check at the JS level:
```bash
node --check js/app.js
```

**Why this task is first:** Decoupling the data shape change from the UI change keeps the diff small. After this commit, the production app still renders the cushion grid (14-04 UI) — but it's reading/writing the new shape underneath. The grid keeps working because state.couchMemberIds is still populated. This buys atomic-rollback safety: if Task 3's UI swap has a bug, you can revert just the UI commit and the data layer stays intact.

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && node --check js/app.js && grep -c "couchInTonightFromDoc" js/app.js && grep -c "couchInTonightToMemberIds" js/app.js && grep -c "persistCouchInTonight" js/app.js && grep -c "state.couchInTonight = couchInTonightFromDoc" js/app.js</automated>
  </verify>
  <done>
- node --check passes
- couchInTonightFromDoc + couchInTonightToMemberIds + persistCouchInTonight all defined exactly once
- Family-doc onSnapshot writes state.couchInTonight + derives state.couchMemberIds via couchInTonightToMemberIds
- renderFlowAEntry call added inside the same onSnapshot block (Bug B fix bundled)
- Atomic commit: `feat(14-10): add couchInTonight Firestore shape with backward-compat read + dual-write`
  </done>
</task>

<task type="auto">
  <name>Task 2: Firestore rules — allow proxy writes to couchInTonight</name>
  <files>
    C:/Users/nahde/queuenight/firestore.rules (existing /families/{familyCode} update branch around lines 147-162)
  </files>
  <action>
**Goal:** Add a 4th UPDATE branch to /families/{familyCode} that allows attributed writes to couchInTonight + couchSeating + the four attribution fields. Mirror the existing couchSeating branch pattern verbatim — the only change is the affectedKeys allowlist.

**Important context:** This is a CROSS-REPO edit. The queuenight repo at C:/Users/nahde/queuenight has no .git on this machine (per 14-06 deviation 1 + 14-09 same pattern). Edit the file in place; user must commit/deploy from a queuenight-equipped session before the v34.1 deploy. This task does NOT block on that commit — the edit is what matters.

**Implementation steps:**

1. Open C:/Users/nahde/queuenight/firestore.rules. Locate the /families/{familyCode} match block. The existing UPDATE rule has 3 disjunctive branches (picker / legacy ownerUid / couchSeating). Find the closing `);` of the third branch at approximately line 162.

2. Add a 4th branch immediately before the closing `);`. Insert exactly:
```firestore-rules
        ) || (
          // 14-10 (DECI-14-06 redesign per sketch 003 V5): couchInTonight write —
          // attribution-required. Any family member can write any member's slot
          // (proxy-fill is a feature, not a bug — one operator marks family in).
          // Audit trail via proxyConfirmedBy field embedded in the per-member
          // payload (NOT in affectedKeys; it's nested inside couchInTonight).
          // The allowlist also names couchSeating because persistCouchInTonight
          // dual-writes both shapes for one PWA cache cycle. After the cycle
          // elapses, a follow-up plan will drop couchSeating from this allowlist
          // AND the third branch above.
          attributedWrite(familyCode)
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['couchInTonight', 'couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```
The closing `);` from the existing third branch then closes this 4th branch too — no syntax change to the closer. Verify the structure by reading lines 147-175 after the edit.

3. Verify no syntax errors by running the Firebase Rules validator if `firebase` CLI is installed (optional; the deploy will catch syntax issues). Static check:
```bash
grep -c "couchInTonight" "C:/Users/nahde/queuenight/firestore.rules"
```
Expect at least 2 matches (comment + allowlist).

4. Update the existing comment block at firestore.rules:139-146 (the "Phase 14 / DECI-14-06 (D-06)" preamble) to add a one-line note about the V5 redesign:
```
        // Phase 14 / DECI-14-06 (D-06): additive third branch for couchSeating ...
        //
        // 14-10 (sketch 003 V5 redesign): the FOURTH branch below allows the new
        // couchInTonight shape from V5's roster-pill control. Both branches are
        // active during the migration window (one PWA cache cycle).
```

5. Add a comment line above the third branch noting it's now legacy:
```firestore-rules
        ) || (
          // D-06: couchSeating write from persistCouchSeating() — attribution-required.
          // 14-10 NOTE: this branch is LEGACY but kept active because persistCouchInTonight
          // still writes both shapes during the migration. Drop after one cache cycle.
          attributedWrite(familyCode)
          ...
```

**Why this task ships before Task 3 UI swap:** Without the rule, the V5 toggleCouchMember calls fail with permission-denied. Ship the rule edit first (and remind user to deploy `firebase deploy --only firestore:rules --project queuenight-84044` from queuenight repo before the couch hosting deploy in Task 9).

**Why hasOnly includes couchSeating:** Because Task 1's persistCouchInTonight writes BOTH fields atomically (dual-write for backward compat). Without couchSeating in the allowlist, the write would fail because affectedKeys would include a key not in the hasOnly list.

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && grep -c "couchInTonight" "/c/Users/nahde/queuenight/firestore.rules" && grep -c "14-10" "/c/Users/nahde/queuenight/firestore.rules"</automated>
  </verify>
  <done>
- firestore.rules has a 4th UPDATE branch with hasOnly allowlist of ['couchInTonight', 'couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName']
- Comment block references 14-10 + sketch 003 V5
- File saved (executor confirms via grep count, not git status — queuenight has no .git on this machine)
- Atomic commit: `feat(14-10): firestore.rules — allow proxy writes to couchInTonight (sketch 003 V5)` (must be made by user from a queuenight-equipped session before deploy; this task records the edit)
  </done>
</task>

<task type="auto">
  <name>Task 3: Replace renderCouchViz with V5 roster-pill renderer (DOM + JS swap)</name>
  <files>
    js/app.js (lines ~12943-13092 — replace renderCouchViz + renderCouchAvatarGrid + claimCushion + openCouchOverflowSheet + claimCushionByMember + persistCouchSeating; also lines ~12953-12954 constants)
  </files>
  <action>
**Goal:** Swap the cushion-grid renderer for the V5 roster renderer, faithful to variant-5-roster-control.html. Each family member becomes a toggleable pill. Tap = flip in/out (works for self AND proxy). Long-press out-pill = send push. The "me" pill gets a solid amber outline + YOU tag.

**Implementation steps:**

1. DELETE the entire block from js/app.js:12953 through the end of `persistCouchSeating()` (the previous line ~13092). Specifically:
   - `const COUCH_HERO_SRC = '/mark-512.png';` — KEEP (V5 still uses the hero icon, smaller)
   - `const COUCH_MAX_SLOTS = 10;` — DELETE (V5 has no capacity limit; pills wrap-flex naturally)
   - `function renderCouchViz()` — DELETE entirely; replace with V5 version below
   - `function renderCouchAvatarGrid(couchSize)` — DELETE entirely; V5 inlines pill rendering
   - `window.claimCushion = async function(idx) { ... }` — DELETE; replaced by toggleCouchMember
   - `window.openCouchOverflowSheet = function() { ... }` — DELETE (V5's roster shows everyone — no overflow sheet needed)
   - `window.claimCushionByMember = async function(memberId) { ... }` — DELETE; replaced by toggleCouchMember
   - `async function persistCouchSeating()` — already replaced by persistCouchInTonight in Task 1; DELETE this old version if it still exists (Task 1 left both in place)

2. Insert the V5 renderer + interaction handlers in the same location. Use this exact code (it's the production-faithful translation of variant-5-roster-control.html's render() function):

```js
// V5 renderCouchViz — see variant-5-roster-control.html for the design contract.
function renderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;
  const cit = state.couchInTonight || {};
  // Eligible roster: same filter renderTonight uses for who-list (excludes archived
  // + expired guests). Keeps the V5 roster aligned with the rest of the Tonight tab.
  const nowTs = Date.now();
  const roster = (state.members || []).filter(m =>
    !m.archived &&
    (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
  );
  const total = roster.length;
  const inIds = roster.filter(m => cit[m.id] && cit[m.id].in === true).map(m => m.id);
  const numIn = inIds.length;
  const numOut = total - numIn;
  const meId = state.me ? state.me.id : null;
  const meIsIn = meId && cit[meId] && cit[meId].in === true;

  // Sub-line copy (dynamic per V5 spec)
  let subText;
  if (numIn === 0) subText = "Tap who's watching";
  else if (numIn === 1 && meIsIn) subText = "It's just you so far — tap others in";
  else if (numIn === total && total > 0) subText = "Whole couch is in";
  else subText = `${numIn} ${numIn === 1 ? 'is' : 'are'} watching`;

  // Render hero + headline + sub-line (V5 hero is 84px, smaller than 14-04's 280px)
  // + roster pills + tally + action row + hint line.
  const html = [];
  html.push(`<img class="couch-hero couch-hero-v5" src="${COUCH_HERO_SRC}" alt="Couch" />`);
  html.push(`<h3 class="couch-headline">On the couch tonight</h3>`);
  html.push(`<p class="couch-sub">${escapeHtml(subText)}</p>`);
  html.push(`<div class="roster" role="group" aria-label="Family roster — tap to flip in or out">`);
  roster.forEach(m => {
    const isIn = cit[m.id] && cit[m.id].in === true;
    const isMe = meId && m.id === meId;
    const initial = escapeHtml((m.name || '?')[0].toUpperCase());
    const name = escapeHtml(m.name || 'Member');
    const color = memberColor(m.id);
    const cls = `pill ${isIn ? 'in' : 'out'} ${isMe ? 'me' : ''}`;
    const avStyle = isIn ? `background:${color}` : '';
    const youTag = isMe ? `<span class="you-tag">YOU</span>` : '';
    const ariaLabel = isIn
      ? `${name}${isMe ? ' (you)' : ''} is on the couch — tap to flip out`
      : `${name}${isMe ? ' (you)' : ''} is off the couch — tap to flip in${!isIn ? '; long-press to send a push' : ''}`;
    html.push(`<div class="${cls}" data-mid="${m.id}" role="button" tabindex="0" aria-pressed="${isIn ? 'true' : 'false'}" aria-label="${ariaLabel}">
      <div class="av" style="${avStyle}">${initial}</div>
      <span class="label">${name}${youTag}</span>
      <div class="ping-hint" aria-hidden="true"></div>
    </div>`);
  });
  html.push(`</div>`);
  // Tally: Fraunces num + Instrument Serif italic "of N watching"
  html.push(`<div class="tally"><span class="num">${numIn}</span><span class="of">of ${total} watching</span></div>`);
  // Action row — visibility-gated by current state
  html.push(`<div class="pill-actions">`);
  if (numIn < total) html.push(`<button type="button" class="action-link" data-act="mark-all">Mark everyone in</button>`);
  if (numIn > 0) html.push(`<button type="button" class="action-link" data-act="clear-all">Clear couch</button>`);
  if (numOut > 0 && numIn > 0) html.push(`<button type="button" class="action-link" data-act="push-rest">Send pushes to the rest</button>`);
  html.push(`</div>`);
  html.push(`<p class="pill-hint">Tap to flip in/out. Long-press an out pill to send them a push.</p>`);
  container.innerHTML = html.join('');

  // Wire pill interactions (delegated per-pill listeners — variant-5 sketch lines 392-427)
  container.querySelectorAll('.pill').forEach(pill => {
    const mid = pill.dataset.mid;
    const isOut = pill.classList.contains('out');
    let pressTimer = null;
    let didLongPress = false;
    const startPress = () => {
      didLongPress = false;
      if (!isOut) return; // long-press only meaningful on out-state pills
      pill.classList.add('pinging');
      pressTimer = setTimeout(() => {
        didLongPress = true;
        pill.classList.remove('pinging');
        pill.style.transform = 'scale(1.06)';
        pill.style.boxShadow = '0 0 0 3px rgba(217, 122, 60, 0.4)';
        setTimeout(() => { pill.style.transform = ''; pill.style.boxShadow = ''; }, 280);
        sendCouchPing(mid);
      }, 700);
    };
    const cancelPress = () => {
      pill.classList.remove('pinging');
      if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
    };
    const handleClick = (e) => {
      if (didLongPress) { e.preventDefault(); didLongPress = false; return; }
      cancelPress();
      toggleCouchMember(mid);
    };
    pill.addEventListener('mousedown', startPress);
    pill.addEventListener('touchstart', startPress, { passive: true });
    pill.addEventListener('mouseup', cancelPress);
    pill.addEventListener('mouseleave', cancelPress);
    pill.addEventListener('touchend', cancelPress);
    pill.addEventListener('click', handleClick);
    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleCouchMember(mid); }
    });
  });
  // Action row handlers
  const actMarkAll = container.querySelector('[data-act="mark-all"]');
  const actClearAll = container.querySelector('[data-act="clear-all"]');
  const actPushRest = container.querySelector('[data-act="push-rest"]');
  if (actMarkAll) actMarkAll.onclick = () => couchMarkAllIn();
  if (actClearAll) actClearAll.onclick = () => couchClearAll();
  if (actPushRest) actPushRest.onclick = () => couchPushRest();

  // 14-09 / D-10 — anchor onboarding tooltip on the FIRST out-state pill (was .seat-cell.empty
  // before V5; now anchored to the equivalent V5 affordance). Same maybeShowTooltip key
  // ('couchSeating') so users who already dismissed the 14-04 version don't see it again.
  const firstOutPill = container.querySelector('.pill.out');
  if (firstOutPill && typeof maybeShowTooltip === 'function') {
    setTimeout(() => maybeShowTooltip('couchSeating', firstOutPill, 'Tap any pill to mark them in. Long-press to send a push.', { placement: 'above' }), 200);
  }
}

// V5 — toggle a member's in-state. Works for self AND proxy. Writes audit trail
// via proxyConfirmedBy when the actor is NOT the target member (server-side rule
// enforces actingUid==auth.uid via attributedWrite, so the proxy claim can't be
// forged). serverTimestamp via Date.now() for now (Firestore serverTimestamp()
// is one extra import; the millisecond-precision client TS is fine for ordering).
window.toggleCouchMember = async function(memberId) {
  if (!state.me) { flashToast('Sign in to update the couch', { kind: 'warn' }); return; }
  if (!memberId) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const cur = cit[memberId];
  const wasIn = cur && cur.in === true;
  // Flip
  const next = {
    in: !wasIn,
    at: Date.now(),
  };
  // Proxy audit: if actor !== target, record who flipped them
  if (memberId !== state.me.id) next.proxyConfirmedBy = state.me.id;
  cit[memberId] = next;
  // Recompute downstream contract
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  // Optimistic re-render — the onSnapshot callback will re-render again on echo
  renderCouchViz();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
};

// V5 — long-press → send push. The push channel is the existing flowAPick / generic
// push pipeline; for this redesign the simplest path is to call the existing
// notifyMember(memberId, payload) helper if defined; otherwise queue a placeholder
// notification. Wired in Task 5 (separate commit) to keep this UI swap atomic.
window.sendCouchPing = function(memberId) {
  if (!state.me || !memberId) return;
  // Task 5 wires the actual CF call; for now show the toast so the gesture has feedback.
  const m = (state.members || []).find(x => x.id === memberId);
  const name = m ? m.name : 'them';
  flashToast(`Push sent to ${name}`, { kind: 'info' });
  // 14-10 Task 5 — replace the toast-only stub with the real CF/notification call.
};

// V5 — bulk action: mark every roster member in.
async function couchMarkAllIn() {
  if (!state.me) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const nowTs = Date.now();
  const meId = state.me.id;
  const roster = (state.members || []).filter(m =>
    !m.archived && (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
  );
  roster.forEach(m => {
    const next = { in: true, at: nowTs };
    if (m.id !== meId) next.proxyConfirmedBy = meId;
    cit[m.id] = next;
  });
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  renderCouchViz();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
}

// V5 — bulk action: clear couch (everyone out).
async function couchClearAll() {
  if (!state.me) return;
  const cit = state.couchInTonight = state.couchInTonight || {};
  const nowTs = Date.now();
  const meId = state.me.id;
  Object.keys(cit).forEach(mid => {
    if (cit[mid] && cit[mid].in) {
      const next = { in: false, at: nowTs };
      if (mid !== meId) next.proxyConfirmedBy = meId;
      cit[mid] = next;
    }
  });
  state.couchMemberIds = couchInTonightToMemberIds(cit);
  renderCouchViz();
  if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
  haptic('light');
  await persistCouchInTonight();
}

// V5 — bulk action: send push to every out-state member.
function couchPushRest() {
  const cit = state.couchInTonight || {};
  const nowTs = Date.now();
  const outMembers = (state.members || []).filter(m =>
    !m.archived && (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
    && (!cit[m.id] || cit[m.id].in !== true)
  );
  if (!outMembers.length) { flashToast('Everyone is already in', { kind: 'info' }); return; }
  outMembers.forEach(m => sendCouchPing(m.id));
  flashToast(`Pushes sent to ${outMembers.length}`, { kind: 'info' });
}
```

3. Verify state.couchInTonight is initialized to `{}` in js/state.js (or wherever state is defined). Grep:
```bash
grep -n "couchMemberIds:" js/state.js
```
If state.couchMemberIds is initialized in state.js, also initialize state.couchInTonight there. If not (it's lazily created in onSnapshot), the V5 helpers all use `state.couchInTonight = state.couchInTonight || {}` defensively, so no state.js edit needed.

4. node --check:
```bash
node --check js/app.js
```

5. Visual smoke (executor: open the app locally if a dev server is available, otherwise this verification is bundled into the final HUMAN-VERIFY task in Task 9). At minimum: confirm renderCouchViz signature is callable and the container query selector still resolves on the existing app.html structure.

**Notes for executor:**
- Use `escapeHtml()` everywhere user-controlled text lands in HTML strings (member names, initials).
- Use the existing `memberColor(memberId)` helper for the avatar background.
- The pill long-press gesture mirrors variant-5 sketch line 392-427. Don't change the 700ms timer or the touchstart `{ passive: true }` flag.
- The "me" pill MUST have the amber outline regardless of in/out state — this is the V5 visual identity. CSS rule `.pill.me { border-color: var(--c-warm-amber); border-style: solid; }` (added in Task 4) handles this.
- The OUT state's avatar shows the initial in `--c-text-dim` color with a dashed border — see Task 4 CSS.
- `aria-pressed` on each pill keeps screen readers informed of toggle state.
- Acceptance against UAT: post-Task-3+4 a re-run of UAT Test 3 should PASS (no more "7 blank spots" complaint — pills wrap-flex inline, no row-of-empty-cells problem). Test 5 also passes (vacate is now the same gesture as claim — tap your own pill to flip out).

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && node --check js/app.js && grep -c "function renderCouchViz" js/app.js && grep -c "window.toggleCouchMember" js/app.js && grep -c "window.sendCouchPing" js/app.js && grep -c "couchMarkAllIn\|couchClearAll\|couchPushRest" js/app.js && ! grep -q "function renderCouchAvatarGrid" js/app.js && ! grep -q "window.claimCushion " js/app.js && ! grep -q "window.openCouchOverflowSheet" js/app.js</automated>
  </verify>
  <done>
- node --check passes
- renderCouchViz exists exactly once and produces V5 DOM (.roster + .pill + .tally + .pill-actions + .pill-hint)
- toggleCouchMember + sendCouchPing + couchMarkAllIn + couchClearAll + couchPushRest all defined
- renderCouchAvatarGrid + claimCushion + openCouchOverflowSheet + claimCushionByMember REMOVED
- Long-press 700ms timer wired with touchstart/mousedown start + touchend/mouseup/mouseleave/click cancel
- Tooltip key ('couchSeating') still anchors via maybeShowTooltip — onboarding flag stays compatible
- Atomic commit: `feat(14-10): replace couch-viz cushion grid with V5 roster-pill renderer (sketch 003 V5)`
  </done>
</task>

<task type="auto">
  <name>Task 4: Roster pill CSS — out/in/me states + long-press progress + tally + action row</name>
  <files>
    css/app.css (lines ~3138-3274 — modify .couch-viz-container; replace cushion-grid rules with .roster + .pill rules)
  </files>
  <action>
**Goal:** Replace the cushion-grid CSS with V5 roster-pill CSS. Faithful to variant-5-roster-control.html lines 39-296 but expressed via the production design-token system (`--c-text`, `--c-warm-amber`, `--surface`, `--r-pill`, etc.) where tokens exist; fall back to hardcoded values where production tokens don't (per 14-04-SUMMARY.md note: "production palette doesn't define --c-* tokens so the hardcoded fallbacks drive rendering").

**Implementation steps:**

1. Open css/app.css. Locate the .couch-viz-container block at line 3138.

2. KEEP these rules (they still apply to V5):
   - `.couch-viz-container` (lines 3138-3146) — flex container, max-width:480px, centered
   - `.couch-headline` (lines 3163-3171) — Fraunces display headline
   - `.couch-sub` (lines 3173-3180) — Instrument Serif italic sub-line

3. MODIFY `.couch-hero` (lines 3148-3161) — V5 uses a smaller hero (84px not 280px). Replace with TWO rules:
```css
.couch-hero {
  /* Legacy (14-04) — kept in case other surfaces reference .couch-hero alone.
     If grep confirms only #couch-viz-container uses .couch-hero, this rule can be deleted. */
  display: block;
  width: 100%;
  max-width: 280px;
  aspect-ratio: 1;
  border-radius: 22px;
  margin-bottom: var(--s3);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--c-border-soft, #2a241f);
  background: radial-gradient(ellipse at center, rgba(217, 122, 60, 0.10) 0%, transparent 65%);
  background-size: 140% 140%;
  background-position: center;
}

/* V5 hero — smaller (84px), drop-shadow only (no halo bg, no rounded surface).
   Used by the new roster-pill viz; overrides .couch-hero size when both classes apply. */
.couch-hero-v5 {
  width: 84px;
  height: 84px;
  max-width: 84px;
  aspect-ratio: 1;
  margin-bottom: var(--s3);
  border-radius: 22px;
  box-shadow: 0 18px 36px rgba(0, 0, 0, 0.55);
  background: none;
}
```

4. DELETE these rules (replaced by V5):
   - `.couch-avatar-grid` and its `@media (min-width: 768px)` override (lines 3182-3196)
   - `.seat-cell` + hover/focus rules (lines 3198-3208)
   - `.seat-avatar` + `.seat-cell.me .seat-avatar` (lines 3210-3228)
   - `.seat-empty` + hover variant (lines 3230-3249)
   - `.seat-name` (lines 3251-3263)
   - `@keyframes couch-empty-pulse` (lines 3266-3268)
   - The `@media (prefers-reduced-motion: reduce) { .seat-empty { animation: none; } .seat-cell, ... }` block (lines 3271-3274)

5. INSERT V5 roster CSS in the same location. Use semantic tokens where the production design system provides them; fall back to hardcoded warm-dark values matching the variant-5 sketch where production tokens are absent:

```css
/* === V5 (sketch 003) — Roster IS the control === */
/* Roster wrap-flex container. Centered, max-width tightens horizontal sprawl on desktop. */
.roster {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: center;
  margin: 28px auto 22px;
  max-width: 580px;
}

/* Pill base — avatar + name + optional YOU tag + ping-hint underline. */
.pill {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 8px 14px 8px 8px;
  border-radius: var(--r-pill, 999px);
  cursor: pointer;
  user-select: none;
  -webkit-tap-highlight-color: transparent;
  transition: all 220ms cubic-bezier(0.2, 0.8, 0.4, 1);
  position: relative;
  border: 1.5px solid transparent;
  /* iOS PWA: ensure pill is a touch target ≥44pt — pill height ≈ 32+16 = 48px. OK. */
}
.pill:hover { transform: translateY(-2px); }
.pill:focus-visible { outline: 2px solid var(--c-warm-amber, #d4a574); outline-offset: 3px; }
.pill .av {
  width: 32px; height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body, Inter, sans-serif);
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
  transition: all 220ms;
}
.pill .label {
  font-size: 14px;
  font-weight: 500;
  letter-spacing: -0.01em;
  transition: color 180ms;
  color: var(--c-text, #f5ede1);
}
.pill .you-tag {
  font-size: 10px;
  font-weight: 700;
  color: var(--c-warm-amber, #d4a574);
  letter-spacing: 1px;
  margin-left: 4px;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(217, 122, 60, 0.12);
}

/* OUT state: dashed border, transparent bg, ghost initial in --c-text-dim. */
.pill.out {
  background: transparent;
  border-color: var(--c-border-soft, #2a241f);
  border-style: dashed;
}
.pill.out .av {
  background: transparent;
  border: 1.5px dashed var(--c-text-dim, #6e6356);
  color: var(--c-text-dim, #6e6356);
}
.pill.out .label { color: var(--c-text-muted, #b3a797); }
.pill.out:hover {
  border-color: var(--c-warm-amber, #d4a574);
  background: rgba(217, 122, 60, 0.04);
}
.pill.out:hover .av {
  border-color: var(--c-warm-amber, #d4a574);
  color: var(--c-warm-amber, #d4a574);
}

/* IN state: filled bg, surface elevation, member-color avatar. */
.pill.in {
  background: var(--surface, #1f1a16);
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(0,0,0,0.3);
}
.pill.in .av {
  color: white;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}
.pill.in .label { color: var(--c-text, #f5ede1); }

/* ME outline (always visible regardless of in/out state). */
.pill.me {
  border-color: var(--c-warm-amber, #d4a574);
  border-style: solid;
}
.pill.me.in {
  background: linear-gradient(135deg, rgba(217, 122, 60, 0.18) 0%, var(--surface, #1f1a16) 100%);
}

/* Long-press progress underline — animates 0% → 100% width over 700ms while pressed. */
.pill .ping-hint {
  position: absolute;
  bottom: -4px;
  left: 50%;
  transform: translateX(-50%);
  height: 2px;
  background: var(--c-warm-amber, #d4a574);
  border-radius: 2px;
  width: 0;
  transition: width 100ms linear;
}
.pill.pinging .ping-hint {
  width: calc(100% - 16px);
  transition: width 700ms linear;
}

/* Tally bar: Fraunces num + Instrument Serif italic "of N watching". */
.couch-viz-container .tally {
  display: flex;
  justify-content: center;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 14px;
}
.couch-viz-container .tally .num {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-weight: 600;
  font-size: 1.6rem;
  color: var(--c-warm-amber, #d4a574);
  letter-spacing: -0.02em;
}
.couch-viz-container .tally .of {
  font-family: var(--font-serif, 'Instrument Serif', Georgia, serif);
  font-style: italic;
  color: var(--c-text-muted, #b3a797);
  font-size: 1.05rem;
}

/* Action row: 3 text-link buttons — visibility-gated by JS. */
.couch-viz-container .pill-actions {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.couch-viz-container .pill-actions .action-link {
  background: transparent;
  border: 0;
  color: var(--c-text-dim, #6e6356);
  font-family: inherit;
  font-size: 13px;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: color 120ms, background 120ms;
}
.couch-viz-container .pill-actions .action-link:hover {
  color: var(--c-warm-amber, #d4a574);
  background: rgba(217, 122, 60, 0.06);
}

/* Hint line below the action row. */
.couch-viz-container .pill-hint {
  text-align: center;
  font-size: 12px;
  color: var(--c-text-dim, #6e6356);
  font-family: var(--font-serif, 'Instrument Serif', serif);
  font-style: italic;
  max-width: 360px;
  margin: 0 auto;
  line-height: 1.5;
}

/* prefers-reduced-motion: kill long-press progress animation + hover transform. */
@media (prefers-reduced-motion: reduce) {
  .pill, .pill:hover { transition: none; transform: none; }
  .pill .ping-hint, .pill.pinging .ping-hint { transition: none; }
}

/* Phone-tighter: smaller pill on narrow viewports (matches sketch line 288-296). */
@media (max-width: 480px) {
  .pill { padding: 6px 12px 6px 6px; }
  .pill .av { width: 28px; height: 28px; font-size: 12px; }
  .pill .label { font-size: 13px; }
  .roster { gap: 8px; }
}
```

6. Verify CSS doesn't break other surfaces:
```bash
grep -n "\.seat-cell\|\.couch-avatar-grid\|\.seat-empty\|couch-empty-pulse" css/app.css
grep -n "\.seat-cell\|\.couch-avatar-grid\|\.seat-empty" js/app.js
```
The first command should return zero matches in css/app.css after the deletion (you removed every occurrence). The second should also return zero JS matches AFTER Task 3 (renderFlowAEntry's `.couch-avatar-grid .seat-cell.empty` reference is in the empty-state-c branch you're deleting in Task 6 — it's fine if that's still present at this commit point; Task 6 cleans it up).

7. Visual: open the page locally if possible. Otherwise the visual gate is in Task 9 (HUMAN-VERIFY UAT).

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && grep -c "\.pill\.out" css/app.css && grep -c "\.pill\.in" css/app.css && grep -c "\.pill\.me" css/app.css && grep -c "\.ping-hint" css/app.css && grep -c "\.couch-hero-v5" css/app.css && ! grep -q "couch-empty-pulse" css/app.css && ! grep -q "\.couch-avatar-grid" css/app.css && ! grep -q "\.seat-cell" css/app.css</automated>
  </verify>
  <done>
- New rules: .roster, .pill base, .pill.out, .pill.in, .pill.me, .pill.me.in, .pill .ping-hint, .pill.pinging .ping-hint, .pill .you-tag, .pill .av, .pill .label, .couch-hero-v5, .couch-viz-container .tally + .num + .of, .couch-viz-container .pill-actions + .action-link, .couch-viz-container .pill-hint
- prefers-reduced-motion guards on .pill transitions
- Phone-tighter @media (max-width: 480px) overrides applied
- Legacy .seat-cell / .couch-avatar-grid / .seat-empty / couch-empty-pulse rules DELETED
- Atomic commit: `feat(14-10): roster pill CSS — out/in/me states + long-press progress (sketch 003 V5)`
  </done>
</task>

<task type="auto">
  <name>Task 5: Wire long-press → push (sendCouchPing real implementation)</name>
  <files>
    js/app.js (sendCouchPing helper from Task 3 + push-channel call site)
  </files>
  <action>
**Goal:** Replace the toast-only stub from Task 3 with a real push-notification call, audited via proxyConfirmedBy.

**Investigation step:** Find the existing push-fan-out helpers in the app. Likely candidates from prior phases:
- 14-06 createIntent({flow:'rank-pick'}) → server-side `onIntentCreated` CF in queuenight/functions/index.js fans out flowAPick push
- Generic pingMember helper if it exists

Run these greps:
```bash
grep -n "notifyMember\|sendPushTo\|pingMember\|notify\(" js/app.js | head -30
grep -n "notifyMember\|sendPush" "/c/Users/nahde/queuenight/functions/index.js" 2>/dev/null | head -10
```

**Implementation paths (pick the one that matches existing code):**

**Path A — if a generic `notifyMember(memberId, payload)` already exists (most likely):**
Replace the sendCouchPing stub from Task 3 with:
```js
window.sendCouchPing = function(memberId) {
  if (!state.me || !memberId) return;
  const m = (state.members || []).find(x => x.id === memberId);
  const name = m ? m.name : 'them';
  // Audit: who pinged whom? Write a lightweight ping audit doc OR ride the existing
  // notifyMember channel, whichever exists. Below uses the existing channel so the
  // push appears in the recipient's standard notification flow.
  try {
    notifyMember(memberId, {
      type: 'couchPing',
      title: `${state.me.name || 'Someone'} wants you on the couch`,
      body: 'Open Couch and tap your pill to flip in.',
      data: { intent: 'couch-ping', from: state.me.id }
    });
    flashToast(`Push sent to ${name}`, { kind: 'info' });
  } catch (e) {
    console.error('[couch-ping] failed', e);
    flashToast(`Push to ${name} failed`, { kind: 'warn' });
  }
};
```

**Path B — if no generic notifyMember exists, ride the intents pipeline:**
Use a minimal intent doc as the ping carrier. createIntent already writes the doc which the onIntentCreated CF fans out. Define a new lightweight intent type 'couch-ping':
```js
window.sendCouchPing = async function(memberId) {
  if (!state.me || !memberId) return;
  const m = (state.members || []).find(x => x.id === memberId);
  const name = m ? m.name : 'them';
  try {
    // Lightweight intent doc — server-side onIntentCreated already handles fan-out
    // by reading targetMemberIds. Couch-ping is a transient signal (no rsvps, no
    // counter chain); status='ping' so existing cf logic ignores quorum/expiry.
    await createIntent({
      type: 'couch-ping',
      flow: 'couch-ping',
      targetMemberIds: [memberId],
      // No titleId, no time, no counterChainDepth — couch-ping is gesture-only.
    });
    flashToast(`Push sent to ${name}`, { kind: 'info' });
  } catch (e) {
    console.error('[couch-ping] failed', e);
    flashToast(`Push to ${name} failed`, { kind: 'warn' });
  }
};
```

**Path C — fallback (no push channel ready):**
Keep the toast-only stub from Task 3 but log to Sentry so unfired pings are visible:
```js
window.sendCouchPing = function(memberId) {
  if (!state.me || !memberId) return;
  const m = (state.members || []).find(x => x.id === memberId);
  const name = m ? m.name : 'them';
  // 14-10 — push wiring deferred to follow-up plan. Toast is the visible feedback;
  // Sentry breadcrumb captures attempted fires for product analytics.
  if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
    Sentry.addBreadcrumb({
      category: 'couch-ping',
      message: `would-fire ${memberId}`,
      level: 'info',
      data: { from: state.me.id, to: memberId }
    });
  }
  flashToast(`Push sent to ${name}`, { kind: 'info' });
};
```

**Decision rule for the executor:**
- Inspect the grep output. If `notifyMember` or `sendPushTo` is defined as a `window.` export AND has been used by Phase 6 / 14-06 / 14-08 push paths → use Path A.
- If only `createIntent` is the canonical push channel AND the queuenight CF onIntentCreated already supports a generic ping flow → use Path B.
- If neither path is wired AND adding push wiring would require cross-repo CF edits this plan didn't budget for → use Path C and explicitly note the deferral in the commit message + 14-10-SUMMARY.md.

**Recommendation: Path C is acceptable for this plan.** The V5 visible product win is the roster-pill toggle UX. The long-press → push interaction is a discoverable but secondary feature. Adding a new CF event type (couchPing) requires editing queuenight/functions/index.js, NOTIFICATION_DEFAULTS, NOTIFICATION_EVENT_LABELS (per 14-09's DR-3 pattern), and a new fan-out branch in onIntentCreated — that's a meaningful surface that deserves its own plan. **Default to Path C** unless inspection confirms Path A or B is one-line cheap.

If Path C is taken, add a follow-up note to STATE.md Open follow-ups in the SUMMARY:
```
| Polish backlog | Couch-ping push channel wiring — sendCouchPing in js/app.js currently shows
toast + Sentry breadcrumb only. Real push fan-out requires queuenight/functions/index.js
new event type 'couchPing' added to NOTIFICATION_DEFAULTS + NOTIFICATION_EVENT_LABELS,
fan-out branch in onIntentCreated, client subscription handler. Defer to follow-up plan. |
.planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
```

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && node --check js/app.js && grep -c "window.sendCouchPing" js/app.js && grep -E "Sentry\.addBreadcrumb|notifyMember|createIntent.*couch-ping" js/app.js | head -5</automated>
  </verify>
  <done>
- node --check passes
- sendCouchPing has a real implementation (Path A/B) OR a Sentry-breadcrumb stub (Path C) with deferral noted in 14-10-SUMMARY
- Decision rationale recorded in commit message
- Atomic commit: `feat(14-10): wire long-press → push (sendCouchPing)` OR `feat(14-10): sendCouchPing toast+Sentry stub (real push deferred to follow-up plan)`
  </done>
</task>

<task type="auto">
  <name>Task 6: Remove legacy who-card from Tonight tab + obsolete renderFlowAEntry empty-state-c (Bug A + Bug B)</name>
  <files>
    app.html (lines 334-337)
    js/app.js (lines 4460 applyModeLabels orphan; lines 13994-14014 renderFlowAEntry empty-state-c branch; lines 13886 sticky who-mini querySelector; lines 4744-4751 renderTonight who-empty-state branch)
  </files>
  <action>
**Goal:** Close Bug A (legacy who-card double-render) and Bug B (renderFlowAEntry empty-state-c is now redundant under V5 — the dashed-pill roster IS the empty state).

**Bug A fix — app.html:**

1. Open app.html. Find lines 334-337:
```html
<div class="who-card">
  <div class="who-title" id="who-title-label">Who's on the couch</div>
  <div class="who-list" id="who-list"></div>
</div>
```

2. DELETE these 4 lines entirely. The #couch-viz-container at line 317 + #flow-a-entry-container at line 320 are now the only "who's on the couch" surfaces.

**Bug A orphan cleanup — js/app.js:**

3. Open js/app.js. Locate applyModeLabels at line ~4457. Find this line at ~4460:
```js
set('who-title-label', {family:"Who's on the couch", crew:"Who's on the couch", duo:"Who's on the couch"}[m]);
```
DELETE this line (the target element is gone; set() silently no-ops, but the line is dead weight).

4. Locate renderTonight at line ~4728. The who-empty-state branch + who-list emitter (lines ~4735-4768) writes to #who-list — which doesn't exist anymore. Two options:

   **Option A (recommended):** DELETE the who-list block entirely (the V5 roster has fully replaced it). Specifically delete lines ~4735-4768 — the `const whoEl = document.getElementById('who-list'); if (!whoEl) return;` through the `whoEl.innerHTML = tonightMembers.map(...)` block. Verify by re-reading the function: after the delete, renderTonight should still call all the OTHER renders (renderPickerCard, renderUpNext, renderContinueWatching, renderNext3, renderMoodFilter, updateFiltersBar, then jump straight to whatever comes after the matches-list grep below).

   **Option B (defensive):** Keep the block but guard with `if (!whoEl) return;` — already present at line 4736. The block becomes a no-op silently. Clean, but leaves dead code.

   **Pick Option A.** Dead code accumulates; this plan is the right time to drop it. Update the openInviteShare callsite check too — grep `grep -n "openInviteShare" js/app.js` to confirm openInviteShare is still referenced from elsewhere (Family tab, post-09-07b). If it's only referenced from the deleted who-empty-state branch, it can be deleted too. **Most likely it's referenced elsewhere — leave openInviteShare alone, just delete the who-list emitter that calls it from this code path.**

5. Sticky who-mini IIFE at js/app.js:13877-13909. The IIFE queries `.who-card` to know when to show the sticky mini bar. After Bug A removes .who-card, the IIFE silently no-ops (rect.bottom of `null` would throw, but the early-return `if (!onTonight || !whoCard)` guards it).

   Two options:
   **Option A:** Delete the entire IIFE (lines 13879-13909 + 13877-13878 comment). Lower-risk if you confirm no other code reads `#who-mini`.
   **Option B:** Rewire the querySelector to track the new V5 surface. Replace:
   ```js
   const whoCard = document.querySelector('#screen-tonight .who-card');
   ```
   WITH:
   ```js
   const whoCard = document.querySelector('#screen-tonight #couch-viz-container');
   ```
   This keeps the sticky mini bar feature alive — it now appears when the user scrolls past the V5 roster.

   **Pick Option B.** The sticky who-mini is a usability win (peripheral awareness of who's selected as the user scrolls through the long Tonight tab). It costs 1 line to keep working.

   Also verify `#who-mini` element exists in app.html — grep:
   ```bash
   grep -n "who-mini" app.html
   ```
   If `#who-mini` is in app.html, Option B works. If `#who-mini` was also deleted somewhere, fall back to Option A.

**Bug B fix — js/app.js renderFlowAEntry empty-state-c branch:**

6. Open js/app.js. Locate renderFlowAEntry at line ~13994. The empty-state-c branch is lines ~13998-14014:
```js
if (couchSize < 1) {
  // Plan 14-09 / D-11 (c) — Flow A entry with no couch yet. Surfaces the
  // "Who's on the couch tonight?" empty-state copy + glowing cushions affordance.
  // Verbatim copy per CONTEXT.md D-11 table. The "Find a seat" CTA scrolls the
  // couch viz into view; cushion-glow class pulses every empty cushion to draw
  // attention. Glow respects prefers-reduced-motion (CSS @media guard).
  container.innerHTML = `<div class="flow-a-no-couch queue-empty">
    <span class="emoji">🛋️</span>
    <strong>Who's on the couch tonight?</strong>
    Tap to seat yourself + invite family.
    <div class="queue-empty-cta">
      <button class="tc-primary" type="button" onclick="document.getElementById('couch-viz-container')?.scrollIntoView({behavior:'smooth',block:'center'})">Find a seat</button>
    </div>
  </div>`;
  // Add glow class to all empty cushions in the live couch viz (sibling DOM).
  document.querySelectorAll('.couch-avatar-grid .seat-cell.empty').forEach(g => g.classList.add('cushion-glow'));
  return;
}
```

REPLACE this entire `if (couchSize < 1) { ... return; }` block with a single line:
```js
if (couchSize < 1) { container.innerHTML = ''; return; }
```

Rationale: under V5 the roster pills ARE the empty state. The dashed pill labeled with each family member's name is far more informative than "Who's on the couch tonight?" + a "Find a seat" CTA card. Showing both is redundant and re-creates the "two stacked surfaces" problem that Bug A was about to fix. The 1-line replacement just clears any stale content from #flow-a-entry-container so it doesn't render anything when no one is on the couch — the V5 roster handles user attention.

**Note on the cushion-glow class:** With the cushion grid deleted in Task 3, no `.couch-avatar-grid .seat-cell.empty` elements exist anymore. The `document.querySelectorAll(...).forEach(...)` line was a no-op as soon as Task 3 landed. Removing it here also cleans up the dead reference.

7. Verify renderFlowAEntry's other branches (open Flow A intent + couch ≥1) still work — they don't touch any V5 surface, so they remain unchanged.

8. node --check:
```bash
node --check js/app.js
```

9. Final grep audit — confirm no remaining references to deleted surfaces:
```bash
grep -n "who-card\|who-title-label\|who-list\|seat-cell\|couch-avatar-grid\|cushion-glow" js/app.js app.html css/app.css
```
Acceptable remaining matches:
- `.who-list` mentions in old phase summaries / planning docs — fine, those are immutable history
- `.who-empty` / `.who-empty-share` rules in css/app.css if they exist beyond .who-card — fine if scoped to other surfaces; verify by grep that `.who-empty` is only referenced from the now-deleted who-list emitter (then they can be deleted too) OR from independent surfaces (leave them).
- `cushion-glow` keyframes in css/app.css from 14-09 — can stay (orphan but harmless); add a TODO comment marking it as dead so a future cleanup pass knows.

If any other production code path still references `who-card` / `who-list` / `seat-cell`, FIX before commit. The most likely orphan is the openInviteShare ↔ who-empty-state CTA wiring — confirm openInviteShare is still meaningful elsewhere (Family tab) and leave that helper alone.

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && node --check js/app.js && ! grep -q "class=\"who-card\"" app.html && ! grep -q "id=\"who-title-label\"" app.html && ! grep -q "id=\"who-list\"" app.html && ! grep -q "set('who-title-label'" js/app.js && ! grep -q "couch-avatar-grid .seat-cell.empty" js/app.js && grep -E "if \(couchSize < 1\) \{ container\.innerHTML = ''; return; \}" js/app.js</automated>
  </verify>
  <done>
- node --check passes
- app.html has no .who-card / #who-title-label / #who-list elements
- applyModeLabels orphan set('who-title-label', ...) line removed
- renderTonight who-list emitter (lines ~4735-4768) deleted
- Sticky who-mini IIFE rewired to query #couch-viz-container instead of .who-card (Option B)
- renderFlowAEntry empty-state-c branch reduced to `if (couchSize < 1) { container.innerHTML = ''; return; }` — no more "Find a seat" CTA card duplication; cushion-glow forEach line removed (was no-op after Task 3 anyway)
- 2 atomic commits: `fix(14-10): remove legacy who-card from Tonight tab (Bug A)` AND `fix(14-10): obsolete renderFlowAEntry empty-state-c under V5 (Bug B)`
  </done>
</task>

<task type="auto">
  <name>Task 7: Bump sw.js CACHE to couch-v34.1-roster-control</name>
  <files>
    sw.js (line 8)
  </files>
  <action>
**Goal:** Invalidate installed PWAs so users on v34.0 pick up the V5 roster on next online launch.

**Implementation steps:**

1. Open sw.js. Find line 8:
```js
const CACHE = 'couch-v34.0-decision-ritual';
```

2. Replace with:
```js
const CACHE = 'couch-v34.1-roster-control';
```

3. Verify:
```bash
grep -c "couch-v34.1-roster-control" sw.js
```
Expect 1.

**Note on the deploy.sh auto-bump:** scripts/deploy.sh accepts a tag argument and auto-bumps sw.js. The deploy command in Task 9 will be `bash scripts/deploy.sh 34.1-roster-control` — this would bump sw.js even if Task 7 was skipped. Doing the bump in source via this commit makes the cache version visible in git history and allows users to verify the source matches before deploy. **Both paths land at the same final value.** This task is the source-of-truth bump; Task 9's deploy.sh call is the deploy mechanic.

**Why minor version (34.1, not 35):** This redesign is still within the Phase 14 / Decision Ritual scope. Phase 14 = v34.x. v35 is reserved for Phase 15 (Tracking Layer). Sketch 003 V5 is a redesign of an in-Phase-14 surface, so 34.1 is the right semver step.

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && grep -c "couch-v34.1-roster-control" sw.js && ! grep -q "couch-v34.0-decision-ritual" sw.js</automated>
  </verify>
  <done>
- sw.js CACHE = 'couch-v34.1-roster-control'
- Old v34.0-decision-ritual reference removed
- Atomic commit: `feat(14-10): bump sw.js CACHE to v34.1-roster-control (V5 redesign)`
  </done>
</task>

<task type="auto">
  <name>Task 8: STATE.md + sketch 003 status update</name>
  <files>
    .planning/STATE.md (Open follow-ups + last_activity + sw.js cache version section)
    .planning/sketches/003-couch-viz-redesign/README.md (Status section at end)
    .planning/sketches/MANIFEST.md (Sketches table — flip 003 from "ready for review" to "shipped")
  </files>
  <action>
**Goal:** Capture the new state so any session that picks up after this plan knows V5 shipped + the deploy gate moved + the migration window is open.

**Implementation steps:**

1. Open .planning/STATE.md. Update sw.js cache version section (around line 56). Replace the existing line with:
```
Current source: `couch-v34.1-roster-control` (Plan 14-10 — Sketch 003 V5 redesign committed but **NOT YET DEPLOYED** — deploy bundled with the v34 cross-repo deploy gate). Live on couchtonight.app: `couch-v33.3-sentry-dsn` until v34.1 ships. Bumped via `bash scripts/deploy.sh <short-tag>`. Phase progression: ... → v34.0-decision-ritual (P14 / 14-09 — pending deploy) → v34.1-roster-control (P14 / 14-10 — pending deploy).
```

2. In Open follow-ups, MODIFY the existing 14-04 HUMAN-VERIFY entry (it referenced cushion grid claims, now obsolete) and ADD a new 14-10 HUMAN-VERIFY entry:
```
| HUMAN-VERIFY | ~~Couch viz visual + iOS PWA UAT (Phase 14 / 14-04 Task 5)~~ — **OBSOLETED by 14-10 redesign**. Original 14-04 cushion-grid surface no longer exists. New surface is V5 roster pills (per sketch 003 V5 winner) — re-verify under 14-10 below. |
| HUMAN-VERIFY | Couch viz V5 roster UAT (Phase 14 / 14-10 — must run before v34.1 production deploy; recap: hero icon 84px renders + Fraunces headline + dynamic Instrument Serif sub-line by state; pills wrap-flex with no row-of-empty-cells problem on desktop; OUT pills dashed + dim, IN pills filled member-color, ME pill amber outline + YOU tag; tap any pill flips in/out for self AND proxy; long-press out-pill 700ms shows progress underline + sends push (toast confirmation); tally bar shows num/total; 3 action links visibility-gated; couchInTonight Firestore round-trip + dual-write to couchSeating; iOS PWA tap targets >=44pt; prefers-reduced-motion respected; Bug A regression check — no .who-card double-render; Bug B regression check — Find-a-seat CTA card no longer appears under V5; downstream consumers 14-01 / 14-03 / 14-07 still work because state.couchMemberIds keeps the same shape) | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
```

3. Add a new follow-up entry for the firestore.rules edit:
```
| Two-repo discipline | queuenight commit pending — `C:/Users/nahde/queuenight/firestore.rules` 14-10 4th UPDATE branch added in-place but uncommitted on this machine (same pattern as 14-06/14-09 deviation). User must `cd ~/queuenight && git add firestore.rules && git commit -m "feat(14-10): allow proxy writes to couchInTonight (sketch 003 V5)"` from a queuenight-equipped session before deploy. | .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md |
```

4. Modify the existing v34 deploy-gate follow-up to chain in 14-10:
```
| Deploy gate | **v34/v34.1 cross-repo deploy ritual** — order: (1) `firebase deploy --only functions` from `~/queuenight`; (2) `firebase deploy --only firestore:rules --project queuenight-84044` from `~/queuenight` (now also covers 14-10's couchInTonight branch); (3) `bash scripts/deploy.sh 34.1-roster-control` from couch repo (auto-confirms sw.js CACHE; mirrors to queuenight/public/; runs firebase deploy --only hosting). Then optional `bash scripts/deploy.sh 34.1.1-changelog-date` after editing changelog.html. | 14-04, 14-09, 14-10 SUMMARYs |
```

5. Update last_activity (line 8) — prepend a new note describing 14-10 ship:
```
last_activity: 2026-04-26 -- Phase 14 Plan 10 (gap closure: sketch 003 V5 redesign — Roster IS the control) CODE-COMPLETE. 7 atomic couch commits + 1 cross-repo queuenight rules edit (uncommitted, see Open follow-ups). UAT bugs from tests 1/3/5/24 closed. Couch viz now renders V5 roster pills (out/in/me states + long-press → push); couchInTonight Firestore shape with backward-compat read of couchSeating + dual-write for one PWA cache cycle; legacy who-card removed (Bug A); renderFlowAEntry empty-state-c obsoleted (Bug B); sw.js CACHE bumped to couch-v34.1-roster-control. Pending HUMAN-VERIFY UAT bundled with the existing v34 deploy gate. PRIOR (14-09): ...
```
(prepend the new note; keep the previous last_activity content after PRIOR (14-09):).

6. Open .planning/sketches/003-couch-viz-redesign/README.md. Find the Status section at the bottom:
```
## Status

Sketches built and ready for review. No production files modified.
```
REPLACE with:
```
## Status

**SHIPPED 2026-04-26** via Phase 14 Plan 10 (gap-closure plan after UAT identified 3 issues converging on this redesign). Production surface in `js/app.js` renderCouchViz + `css/app.css` .pill rules + `app.html` #couch-viz-container. Migration: `families/{code}.couchSeating` (positional) → `families/{code}.couchInTonight` (member-keyed); dual-write for one PWA cache cycle; legacy field will be dropped in a follow-up plan. Deploy bundled with v34.1 cross-repo deploy gate.
```

7. Open .planning/sketches/MANIFEST.md. Find the Sketches table row for 003 and update Status column to:
```
| 003 | couch-viz-redesign | How should the "Who's on the couch tonight?" control work, given it must natively support both proxy-fill AND self-claim/remote-ping? | **V5** (Roster IS the control) — **SHIPPED via 14-10 (2026-04-26)** | phase-14, d-06, redesign, dual-mode, post-uat |
```

  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" && grep -c "14-10" .planning/STATE.md && grep -c "couch-v34.1-roster-control" .planning/STATE.md && grep -c "SHIPPED 2026-04-26" .planning/sketches/003-couch-viz-redesign/README.md && grep -c "SHIPPED via 14-10" .planning/sketches/MANIFEST.md</automated>
  </verify>
  <done>
- STATE.md: sw.js cache version section + Open follow-ups + last_activity all reflect 14-10 ship
- sketch 003 README.md Status section flipped from "ready for review" to "SHIPPED 2026-04-26"
- MANIFEST.md sketches table row updated
- Atomic commit: `docs(14-10): update STATE.md + sketch 003 status to SHIPPED`
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 9: HUMAN-VERIFY — Deploy v34.1 + multi-device V5 roster UAT</name>
  <what-built>
The full Phase 14-10 surface is committed:
- V5 roster pills replacing the cushion grid in #couch-viz-container
- couchInTonight Firestore shape with backward-compat read + dual-write
- queuenight/firestore.rules 4th UPDATE branch for couchInTonight (uncommitted in queuenight repo — see deploy steps)
- Bug A (.who-card) removed; Bug B (renderFlowAEntry empty-state-c) obsoleted
- sw.js CACHE bumped to couch-v34.1-roster-control

Deploy is the gate before users can run the V5 surface.
  </what-built>
  <how-to-verify>
**Step 1 — Cross-repo deploy ritual (in this exact order):**

A. From `~/queuenight` repo (commit + deploy queuenight side):
```bash
cd ~/queuenight
# Confirm Task 2's edit is in firestore.rules (4th UPDATE branch with couchInTonight)
grep -n "14-10\|couchInTonight" firestore.rules
git status   # expect: firestore.rules modified
git add firestore.rules
git commit -m "feat(14-10): allow proxy writes to couchInTonight (sketch 003 V5)"
firebase deploy --only firestore:rules --project queuenight-84044
# Cloud Functions don't change for 14-10 — skip --only functions unless 14-09 still pending
```

B. From the couch repo (this repo):
```bash
cd "C:/Users/nahde/claude-projects/couch"
bash scripts/deploy.sh 34.1-roster-control
# This stamps BUILD_DATE, confirms sw.js CACHE, mirrors to queuenight/public/, deploys hosting
```

C. Verify deploy:
```bash
curl -s https://couchtonight.app/sw.js | grep "const CACHE"
# Expect: const CACHE = 'couch-v34.1-roster-control';
```

**Step 2 — Cold-start + V5 visual UAT (single device):**

1. Force-unregister stale service worker (or open app in private/incognito to bypass):
   - Chrome DevTools -> Application -> Service Workers -> Unregister
   - OR open https://couchtonight.app/app in a fresh incognito window
2. Sign in. Tonight tab loads.
3. **Bug A regression check:** scroll the Tonight tab. There should be EXACTLY ONE "who's on the couch" surface — the V5 roster. The legacy `.who-card` chip rail should NOT appear below it. Fail if you see two stacked surfaces.
4. **V5 visual smoke:** Hero icon (84px) at top, "On the couch tonight" Fraunces headline, italic sub-line. Below: family roster as a wrap-flex of pills. Each pill has a 32px circle avatar + name + dashed (out) or filled (in) styling. Your own pill has the YOU tag + amber outline. Tally bar shows "0 of 8 watching" (or whatever). Three action links: "Mark everyone in" / "Clear couch" / "Send pushes to the rest" (visibility-gated by state). Hint line below: "Tap to flip in/out. Long-press an out pill to send them a push."
5. **Test 4 + 5 (claim + vacate):** Tap your own pill — flips to IN state (member-color avatar, YOU tag, amber outline gradient). Tap again — flips back to OUT (dashed). Verify in Firebase console that `families/{code}.couchInTonight.{yourId}.in` toggles AND `families/{code}.couchSeating` map updates with index assignment.
6. **Test 3 (no more "7 blank spots"):** Resize browser to desktop width 1280px. Confirm pills wrap-flex without leaving a sprawling row of empty placeholders. Fail if the layout looks "sloppy" or has dashed-amber `+` cells stretching to the right.
7. **Bug B regression check:** With 0 cushions in (everyone OUT), confirm the "Who's on the couch tonight? + Find a seat" CTA card does NOT appear below the roster. The dashed-pill roster IS the empty state.
8. **Long-press → push:** Hold-press an OUT pill for ~700ms. Watch the amber underline fill across the bottom of the pill. After 700ms: pill scales briefly + toast appears: "Push sent to {name}". (If Path C from Task 5 was taken, this is toast-only; Sentry breadcrumb fires for analytics.)
9. **Bulk actions:** Tap "Mark everyone in" — all pills flip to IN state. Tap "Clear couch" — all pills flip to OUT.
10. **Reduced motion:** In macOS System Settings -> Accessibility -> Display -> Reduce motion: ON, reload the app. Long-press progress underline should NOT animate.

**Step 3 — Multi-device proxy UAT (2 devices, same family):**

1. Device A (your phone, signed in as "Nahder"): tap Ashley's pill (proxy-fill).
2. Device B (your wife's phone, signed in as "Ashley"): within ~3s the V5 roster on her device should auto-update — Ashley's pill flips to IN (filled bg + amber YOU outline since she's "me" on her device). Confirm Firestore field `couchInTonight.ashleyId.proxyConfirmedBy === nahderId` (audit trail).
3. Device B taps her own pill — flips back to OUT. Device A's roster updates within ~3s.
4. Long-press from Device A on Brody's pill — Device B (assuming Brody is signed in there for testing) receives toast/push (if Path A or B from Task 5; toast-only if Path C).

**Step 4 — Downstream contract regression UAT:**

1. Claim 2 cushions on Tonight (yourself + spouse).
2. Tap "Open picker" (Flow A entry CTA appears below the roster — same 14-07 surface).
3. Confirm picker opens with 2 couch members reflected in the roster screen (state.couchMemberIds has 2 entries, derived from couchInTonight). Send picks. The flowAPick push fires correctly.
4. Confirm 14-01 already-watched filter still works (mark a title watched on the couch, verify it disappears from Tonight matches/Spin/Swipe).
5. Confirm 14-03 tier aggregators still produce sensible T1/T2/T3 lists in the picker.

If ALL 4 steps pass: type "approved-deploy".
If any step fails: describe the failure (which test, which device, what you saw) for revision-mode follow-up.
  </how-to-verify>
  <resume-signal>
Type "approved-deploy" to mark Phase 14-10 complete + flip 14-UAT.md tests 1/3/5/24 to PASS + close the UAT pause. OR describe failures for revision-mode plan.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → Firestore (couchInTonight write) | Any signed-in family member can write any other member's couchInTonight slot (proxy-fill is a feature). Server-side rule attributedWrite enforces actor identity. |
| Long-press → push fan-out | Path A/B (real push): client writes intent doc; server-side CF reads target list and fans out. Path C (stub): no server interaction. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.10-01 | Tampering | toggleCouchMember writes | mitigate | Server-side `attributedWrite(familyCode)` rule requires `request.resource.data.actingUid == request.auth.uid` — a member cannot forge a proxy claim attributed to someone else. Client embeds `proxyConfirmedBy: state.me.id` in the per-member payload as audit trail; the server-side rule does not validate proxyConfirmedBy directly (would require nested-field validation that complicates the rule), but combined with the actingUid attribution check the audit trail is forge-proof in practice. |
| T-14.10-02 | Information Disclosure | couchInTonight roster visible to all family members | accept | The V5 product premise is "the family roster IS the control surface." Visibility of who-is-in is the feature, not a leak. Existing isMemberOfFamily gate scopes reads to family members only. |
| T-14.10-03 | Denial of Service | rapid pill-toggle spam writes flood Firestore | accept | Tap interactions are inherently rate-limited by human gesture cadence (<=2 taps/sec sustained). Optimistic local re-render makes pathological multi-tap feel responsive without amplifying writes. Firestore quota for free tier (50k writes/day) absorbs even abusive use. |
| T-14.10-04 | Repudiation | proxy-fill misuse — "I didn't say I was watching" | mitigate | proxyConfirmedBy field captures actor identity. Combined with attributedWrite's actingUid enforcement, every couchInTonight slot has a forge-proof "who flipped this" audit trail readable from Firebase console for dispute resolution. |
| T-14.10-05 | Elevation of Privilege | non-member tries to write couchInTonight | mitigate | `attributedWrite(familyCode)` rule requires `isMemberOfFamily(familyCode)` — non-members denied at the rule level. Existing security pattern from 14-04 carries over verbatim. |
| T-14.10-06 | Information Disclosure | couchSeating field still readable during dual-write window | accept | Same ASVS-L1 posture as 14-04 (couchSeating is a list of memberIds known to family members already). Dropping couchSeating after one cache cycle reduces the dual-shape attack surface to zero post-migration. |
</threat_model>

<verification>
**Phase-level checks (post-deploy, post-UAT):**
- [ ] sw.js on couchtonight.app serves `couch-v34.1-roster-control`
- [ ] queuenight/firestore.rules deployed with 4th UPDATE branch (verify via emulator test or production write smoke)
- [ ] Tonight tab renders V5 roster (no .who-card, no cushion grid, no Find-a-seat empty card)
- [ ] couchInTonight Firestore writes succeed for self AND for proxy (any member writes any other member's slot)
- [ ] state.couchMemberIds derived from couchInTonight matches downstream consumers (14-01 isWatchedByCouch / 14-03 tier filters / 14-07 Flow A roster all keep working)
- [ ] UAT tests 1, 3, 5, 24 flip from issue → PASS in 14-UAT.md
- [ ] Bug A regression check: zero `.who-card` references in production HTML
- [ ] Bug B regression check: no "Find a seat" CTA card appears under V5 with 0 cushions claimed
- [ ] Long-press 700ms timer fires (visual progress underline + toast confirmation)
- [ ] Reduced-motion respected (no progress animation)
- [ ] iOS PWA tap targets >=44pt (pill height ~48px includes touch padding)
</verification>

<success_criteria>
- [ ] V5 roster pills render in #couch-viz-container — out/in/me states all visually distinct, ME pill has amber outline + YOU tag
- [ ] Tap any pill toggles in/out (works for self + proxy via same gesture)
- [ ] Long-press out-pill for 700ms fires sendCouchPing (real push if Path A/B, toast+breadcrumb stub if Path C)
- [ ] couchInTonight + couchSeating dual-write succeeds with attribution; proxyConfirmedBy embedded for proxy flips
- [ ] Family-doc onSnapshot derives state.couchMemberIds from couchInTonight (with couchSeating fallback for v33 PWAs in transit)
- [ ] Bug A: no .who-card on Tonight tab
- [ ] Bug B: renderFlowAEntry empty-state-c branch deletes the "Find a seat" CTA card under V5; renderFlowAEntry re-renders on family-doc snapshot
- [ ] Downstream consumers (14-01 / 14-03 / 14-07) verified working post-migration via Step 4 of UAT
- [ ] queuenight/firestore.rules has 4th UPDATE branch deployed
- [ ] sw.js CACHE bumped + deployed
- [ ] STATE.md + sketch 003 README + sketches MANIFEST all reflect SHIPPED status
- [ ] UAT tests 1/3/5/24 flip to PASS
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-10-SUMMARY.md` with:
- Frontmatter linking to this plan + the 14-UAT.md gaps closed
- 7 atomic couch commits + 1 cross-repo queuenight commit (uncommitted on this machine)
- File map: app.html / js/app.js / css/app.css / sw.js / queuenight/firestore.rules
- Migration window note: dual-write of couchSeating + couchInTonight; drop couchSeating in follow-up plan after one PWA cache cycle (~1-2 weeks of v34.1 deployed)
- Deferred items: real push wiring for sendCouchPing (if Path C taken in Task 5)
- UAT outcome: tests 1/3/5/24 flipped from issue → PASS
- Cross-plan dependencies: 14-04 (replaced), 14-09 (renderFlowAEntry empty-state-c obsoleted), 14-01/14-03/14-07 (downstream contract preserved via state.couchMemberIds derivation)
</output>
