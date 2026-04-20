# Phase 4: Veto System - Research

**Researched:** 2026-04-20
**Domain:** Firestore real-time sync, vanilla ES-module JS, existing veto-feature extension
**Confidence:** HIGH

## Summary

Phase 4 is predominantly an **extension** of already-shipped infrastructure, not a greenfield build. Pre-spin veto (VETO-01) is fully wired today; `openVetoModal` / `submitVeto` / `unveto` exist in `js/app.js:5238-5284`, `isVetoed()` gates the candidate pool in `getCurrentMatches()` at `js/app.js:2010`, and `.tc-note.veto` + the "Vetoed tonight" divider already render. The gaps are: (1) the Veto button surface on the spin-result modal (post-spin entry — VETO-02), (2) auto re-spin invocation, (3) fairness gating via a new `session.spinnerId` field (VETO-06), (4) a new `vetoHistory` subcollection for Year-in-Review consumption (VETO-05), (5) the real-time toast + "spinning again…" shimmer polish (VETO-03), and (6) bumping the daily cap from 1 to 2.

All the shapes, write patterns, listeners, and rendering paths already exist. The only new Firestore touch is a subcollection at `families/{familyId}/vetoHistory/{autoId}`, and the only new schema field on the session doc is `spinnerId` (optionally `spinnerAt`). No new external APIs, no bundler changes, no TMDB calls added.

**Primary recommendation:** Treat this as surgical extension work. Do **not** rewrite `submitVeto` or `spinPick` — augment them. The three highest-risk landmines are (a) optimistic state vs. onSnapshot re-render flicker on the vetoer's device, (b) the fairness-rule exception for the auto re-spin (it must not disable itself), and (c) ensuring `unveto()` also deletes from `vetoHistory` inside the same session window per D-11.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Re-spin Flow (VETO-02)**
- **D-01:** Submitting a post-spin veto auto-triggers `spinPick()` immediately — no "spin again" button tap required. Exempt from fairness-rule disable.
- **D-02:** Re-spin reuses full flicker + confetti sequence.
- **D-03:** Vetoed titles stay out of pool for the entire session (continue `isVetoed()` filter).
- **D-04:** If a veto empties the candidate pool, progressively relax filters (drop mood filter first, then other non-essential filters). Empty state only after all relaxations fail.

**Fairness Rule (VETO-06)**
- **D-05:** "Spinner" = whoever last tapped the Spin button. Tracked as `session.spinnerId`. NOT the Picker rotation.
- **D-06:** After veto, "Spin again" button disabled on vetoer's device with tooltip "Someone else spins this one." Other devices see it enabled. Auto re-spin in D-01 is exempt.
- **D-07:** Fairness blocks ONLY the immediately-next spin. Once that spin lands, rule clears.
- **D-08:** Solo member (`state.selectedMembers.length === 1`): fairness waived. Log it; don't block.

**Persistence + Daily Cap (VETO-05)**
- **D-09:** New Firestore subcollection: `families/{familyId}/vetoHistory/{vetoId}` with `{titleId, titleName, memberId, memberName, comment, at, sessionDate}`.
- **D-10:** On submit, write to BOTH `session.vetoes` (existing) AND `vetoHistory` (new) in the same operation.
- **D-11:** Undo allowed within same session only. `unveto()` deletes both the session entry AND the corresponding `vetoHistory` doc. After midnight, history is immutable.
- **D-12:** Daily cap: 1 → 2 vetoes/member/day. Message at 2nd-used: "you've used both vetoes tonight".

**Real-Time Surfacing (VETO-03)**
- **D-13:** Warm toast ("Sam passed on Inception — spinning again…") + existing `logActivity('vetoed', …)` feed entry. No full-screen interstitial.
- **D-14:** During auto re-spin, all devices show a brief "spinning again…" shimmer on the spin result card; spin modal stays open through the transition.

**Veto Entry Points**
- **D-15:** Veto button lives in TWO places only:
  - Spin result modal (new, prominent) — VETO-02 surface
  - Title detail modal (existing) — VETO-01 surface
  - NOT on candidate card list (no long-press / X-icon).

**Veto Reason (VETO-04)**
- **D-16:** Keep existing optional text input (max 200 chars). No preset quick-chips.

### Claude's Discretion
- Exact toast copy, timing, dismissal behavior — follow existing `flashToast()` patterns.
- Whether `state.session.spinnerId` is stored on the session doc or per-session field — planner decides based on schema fit.
- Exact filter-relaxation order beyond "mood first" — planner decides.
- Disabled-state styling of Spin button on vetoer's device — follow existing disabled conventions.
- Whether to include `sessionDate` (for Year-in-Review grouping) or just `at` (ms epoch) in `vetoHistory` docs.
- Whether daily-cap message wording changes or just the count.

### Deferred Ideas (OUT OF SCOPE)
- Candidate-card quick veto (long-press / X-icon on list cards).
- Full-screen "VETOED BY SAM" interstitial.
- Preset quick-chip reasons ("seen it", "too long").
- Rotating round-robin of spin rights based on veto history.
- Fairness rule applied to Picker rotation.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VETO-01 | Pre-spin veto removes title from pool | **Already wired.** `isVetoed()` (app.js:1061) is applied in `passesBaseFilter()` (app.js:2010). No new work needed; confirm regression on extension. |
| VETO-02 | Post-spin veto triggers re-spin | **New wiring.** Add Veto button to `showSpinResult()` (app.js:4440-4475); `submitVeto()` (app.js:5259) conditionally calls `spinPick()` when invoked from post-spin path. |
| VETO-03 | All devices see real-time who-vetoed | **Partial.** `state.session.vetoes` already propagates via `subscribeSession` onSnapshot (app.js:1487-1494). Add `flashToast()` trigger inside the session listener when a new veto appears, plus "spinning again…" shimmer via `.sk` class swap during re-spin transition. |
| VETO-04 | Veto carries optional reason | **Already wired.** `#veto-comment` textarea in `index.html:650`; 200-char slice in `submitVeto` (app.js:5261). No change. |
| VETO-05 | Vetoes recorded per-member for Year-in-Review | **New subcollection.** Add `vetoHistoryRef()` in `js/state.js`; `addDoc(vetoHistoryRef(), entry)` alongside existing `setDoc(sessionRef(), …)` in `submitVeto`. Extend `unveto()` to `deleteDoc` the matching history entry within same session. |
| VETO-06 | Vetoer can't be the re-spinner same session | **New field + guard.** Write `spinnerId: state.me.id` inside `spinPick()` manual invocations. In UI render path for Spin button, disable if `state.session.spinnerId === state.me.id` AND the user is also the most recent vetoer AND `state.selectedMembers.length > 1` (D-08 waiver). Auto re-spin from `submitVeto()` bypasses the guard. Rule clears when next spin lands (write new `spinnerId` or clear flag in `showSpinResult` / `spinPick`). |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Veto write (session + history) | Firestore (DB) | Client (optimistic state) | Existing `setDoc(sessionRef(), …, { merge: true })` pattern; `addDoc` for new subcollection |
| Real-time veto propagation | Firestore onSnapshot | Client render | Existing `subscribeSession` already rebroadcasts the doc on every mutation |
| Auto re-spin trigger | Client | — | `spinPick()` is a `window.*` function; caller invokes directly after `setDoc` resolves |
| Fairness gate | Client | Firestore field | `spinnerId` persisted on session doc so all devices can see who spun; Spin button render checks `session.spinnerId === state.me.id` |
| Toast / shimmer | Client DOM | — | Pure UI, triggered inside the session listener's diff |
| Veto history (Year-in-Review source) | Firestore subcollection | — | Survives midnight session reset; queryable for YEAR-04 aggregation |
| Filter relaxation on empty pool | Client | — | `getCurrentMatches()` extension; progressive filter-drop before declaring empty |

## Standard Stack

No new dependencies. Phase 4 uses only libraries already loaded.

### Core (already in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Firebase JS SDK (Firestore) | 10.12.0 | Real-time DB, session + history writes | `[VERIFIED: js/firebase.js:1-2]` — Already imported; `addDoc`, `deleteDoc`, `setDoc`, `onSnapshot`, `collection`, `doc` all re-exported and available. |

### Firebase Firestore modular API — confirmed available exports

From `js/firebase.js:17`: `doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField` — **all of these are already imported and usable in `js/app.js`.** No new imports needed for Phase 4.

### No alternatives to consider
The project explicitly forbids a bundler (`CLAUDE.md`: "no webpack/vite/rollup") and forbids moving secrets server-side. Phase 4 introduces nothing that would motivate either change.

## Codebase Analogs (primary research artifact)

The planner should use these as exact patterns to mirror:

### 1. Session doc write (D-10 existing half)
**Location:** `js/app.js:5269`
```js
await setDoc(sessionRef(), { vetoes: { [vetoTitleId]: entry } }, { merge: true });
```
Extend with second write in sequence (history):
```js
await setDoc(sessionRef(), { vetoes: { [vetoTitleId]: entry } }, { merge: true });
await addDoc(vetoHistoryRef(), { ...entry, titleId: vetoTitleId, titleName, sessionDate: todayKey() });
```
`addDoc` auto-generates the doc id; capture its `.id` if we want to store a back-reference on the session entry for `unveto()`'s deletion path.

### 2. Session listener + propagation (VETO-03 real-time)
**Location:** `js/app.js:1487-1494`
```js
state.unsubSession = onSnapshot(sessionRef(state.sessionDate), s => {
  state.session = s.exists() ? s.data() : { vetoes: {} };
  renderTonight();
}, e => {});
```
This already covers the new `spinnerId` field and any veto mutation. **No new listener needed.** To add the real-time toast (D-13), diff the incoming `vetoes` against the previous `state.session.vetoes` inside this callback and `flashToast()` any newly-added entry whose `memberId !== state.me.id` (don't toast your own vetoes).

### 3. Activity feed write (already wired for veto)
**Location:** `js/app.js:5270` + `js/app.js:4580-4599`
```js
logActivity('vetoed', { titleName: (state.titles.find(x => x.id === vetoTitleId) || {}).name || 'a title' });
```
Rendering already exists at `app.js:4653`:
```js
else if (a.kind === 'vetoed') text = `<strong>${safeActor}</strong> passed on ${titleLink} for tonight`;
```

### 4. Toast pattern (D-13)
**Location:** `js/utils.js:16-37`
`flashToast(message, opts)` — auto-dismisses after 3.5s, stacks up to 3, `kind: 'info' | 'warn'`. Copy: "Sam passed on Inception — spinning again…" → `flashToast('Sam passed on Inception — spinning again…', { kind: 'info' })`.

### 5. Spin orchestration (D-02 re-spin)
**Location:** `js/app.js:4393-4438`
`window.spinPick()` is idempotent and self-contained: reads `getCurrentMatches()`, does flicker, lands on winner. Calling it a second time from `submitVeto()` just runs the full sequence again. Already referenced by existing `🎲 Spin again` button at `app.js:4472`.

### 6. Spin result render (D-15 entry point)
**Location:** `js/app.js:4440-4475`
The `.spin-actions` block at `app.js:4470-4474` is the anchor for the new Veto button. Per UI-SPEC, insert after `.spin-reroll`, before `.spin-cancel`, full width, `background: var(--bad)`.

### 7. Member identification pattern
`state.me` = `{ id, name, … }`. Every write uses `state.me.id` + `state.me.name`. Veto history `memberId`/`memberName` follow the same convention already used in `submitVeto` (app.js:5263-5264).

### 8. Daily cap guard (D-12 from 1 → 2)
**Location:** `js/app.js:5242-5247`
```js
const existing = myVetoToday();
if (existing) { alert(`You already used your veto tonight…`); return; }
```
Change `myVetoToday()` (app.js:1053-1060) to return a **count** or an array, and the guard in `openVetoModal` to check `>= 2` with the updated warm-tone message. Note the existing `"alert()"` calls — planner may want to upgrade to `flashToast({kind:'warn'})` for tone consistency (Claude's discretion per D-12 wording).

### 9. Day rollover (D-11 immutability boundary)
**Location:** `js/app.js:1487-1494` + `js/app.js:1496-1505`
`subscribeSession` uses `todayKey()` which is re-computed at midnight via `scheduleMidnightRefresh`. A yesterday veto's `vetoHistory` doc survives this rollover (different parent collection, not scoped to session doc). `unveto()` must check `state.sessionDate === vetoHistoryEntry.sessionDate` before attempting deletion to enforce D-11 ("same session only").

### 10. ASVS V5 gate pattern (for window functions)
**Location:** `js/app.js:1963, 2133` (existing `moodById` gates from Phase 3)
Any new `window.*` function that accepts an id from an `onclick` attribute must validate the id against a known-good set before mutating state. For veto, the existing `submitVeto` already uses the locally-scoped `vetoTitleId` (set by `openVetoModal`), so the gate is already enforced. If a planner adds a new `window.vetoFromSpinResult(titleId)` that takes a titleId from inline HTML, it MUST gate: `if (!state.titles.find(x => x.id === titleId)) return;`.

## Firestore Schema Extension

### `session.vetoes` (existing — no breaking change)
```
families/{familyCode}/sessions/{YYYY-MM-DD}
  vetoes: {
    [titleId]: {
      memberId: string,
      memberName: string,
      comment: string,          // up to 200 chars
      at: number,               // Date.now()
      historyDocId: string      // NEW: back-ref for unveto() deletion path (Claude's discretion)
    }
  },
  spinnerId: string,            // NEW: who last tapped Spin (D-05)
  spinnerAt: number             // NEW: Date.now() — enables "spin landed, clear fairness" logic
```

### `vetoHistory` (new subcollection)
```
families/{familyCode}/vetoHistory/{autoId}
  titleId: string,
  titleName: string,
  memberId: string,
  memberName: string,
  comment: string,
  at: number,                   // ms epoch
  sessionDate: string           // "YYYY-MM-DD" — for Year-in-Review grouping
```
**Rationale for sessionDate:** enables YEAR-04 "most-vetoed per family per year" aggregation without a compound range query on `at`. Also gates D-11's "same-session undo" rule without requiring clock math on the client.

**New helper in `js/state.js`:**
```js
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
```

### `spinnerId` placement decision (Claude's discretion)
**Recommendation:** Put on the session doc (not a separate field). It naturally expires at midnight with the rest of session state. `setDoc(sessionRef(), { spinnerId: state.me.id, spinnerAt: Date.now() }, { merge: true })` at the top of `spinPick()`. On `showSpinResult(pick)`, optionally clear the field (since the spin has landed and fairness per D-07 is resolved) or leave it — client render can check `session.spinnerAt` age vs. the most recent veto `at` to determine whether fairness is currently live.

**Simplest render logic for D-06 + D-07:**
```js
// On vetoer's device, disable Spin button if my veto is newer than the latest spin.
const myVetoes = Object.values(getVetoes()).filter(v => v.memberId === state.me.id);
const lastMyVetoAt = myVetoes.reduce((m, v) => Math.max(m, v.at), 0);
const fairnessLocked = lastMyVetoAt > (state.session?.spinnerAt || 0)
                    && state.selectedMembers.length > 1; // D-08 waiver
```

## Undo Window / Pending State Implementation

**Note:** CONTEXT.md does NOT introduce a client-side undo window timer. Re-reading the decisions confirms:
- D-01: auto re-spin is **immediate** on submit — no hold window.
- D-11: "Undo" is the existing `unveto()` function (rewrite of vetoes without key + delete history doc). Works as long as session is current.

There is **no setTimeout undo buffer** to implement. The "Undo veto" UX surface (per UI-SPEC) is a button that calls `unveto()` directly while the session is live. The planner should NOT implement a staged/pending optimistic write pattern for the veto itself.

The only transitional state in this phase is D-14's "spinning again…" shimmer — that's pure DOM class swap on the spin result poster (`.sk` skeleton class applied for ~400ms between veto submit and flicker start), not a deferred commit.

## Real-Time Propagation Confirmation

**Verified:** The existing `subscribeSession` listener (`js/app.js:1487-1494`) covers the session doc that all Phase 4 writes mutate. No new `onSnapshot` needed for:
- `session.vetoes[*]` (existing) — covered
- `session.spinnerId` (new) — same doc, same listener
- `session.spinnerAt` (new) — same doc, same listener

A **new** `onSnapshot` IS needed if we want live-surfacing of vetoHistory on the Year-in-Review page — but per the phase boundary, Phase 4 only **writes** to `vetoHistory`; Phase 6 consumes it. Do not add a listener in this phase.

Activity feed propagation for the veto entry is already handled by the existing `activity` subcollection listener (not shown above but used by `logActivity`).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notification | Custom DOM injection | `flashToast()` from `js/utils.js` | Already handles stacking cap, auto-dismiss, aria-live |
| Haptic feedback | Custom vibration API calls | `haptic('light' \| 'success')` from `js/utils.js` | Graceful no-op on unsupported devices |
| HTML escaping in inline render | `String.replace()` chains | `escapeHtml()` from `js/utils.js` | Already XSS-safe |
| Firestore field deletion in `unveto()` | Raw `deleteField()` | Existing pattern: rewrite `vetoes` object without the key (app.js:5280-5282) | Proven pattern, no sentinel-import risk |
| Midnight rollover | Custom timer | `scheduleMidnightRefresh()` (app.js:1496) already handles re-subscribe | Already reset-tested through Phase 3 |
| Shimmer animation | Custom keyframes | `.sk` CSS class already defined in `css/app.css` | Used by skeleton loaders across the app |
| Activity log write | `addDoc(activityRef(), …)` directly | `logActivity(kind, data)` (app.js:4580) | Includes opportunistic `trimActivity()` cleanup |
| Date key for session | `new Date().toISOString()` | `todayKey()` (app.js:1046-1050) | Matches the format used in `sessionRef()` paths |

## Common Pitfalls

### Pitfall 1: Auto re-spin races the session write
**What goes wrong:** If `spinPick()` is called before `setDoc(sessionRef(), …)` resolves, `getCurrentMatches()` still includes the just-vetoed title because `state.session` hasn't been updated by the listener yet.
**Why:** `submitVeto` uses `await setDoc(…)`, which completes the network write, but the local `state.session` only updates when the onSnapshot callback fires (which can be a frame or two later).
**How to avoid:** Optimistically update `state.session.vetoes[vetoTitleId] = entry` **before** calling `spinPick()`. The subsequent onSnapshot callback will harmlessly re-set the same data.
**Warning sign:** Re-spin occasionally picks the same title that was just vetoed.

### Pitfall 2: Fairness rule self-locks after the auto re-spin
**What goes wrong:** If `spinPick()` writes `spinnerId: state.me.id` unconditionally (including during auto re-spin), the vetoer becomes the new spinner and nothing blocks them from another Spin → fairness rule is effectively disabled.
**Why:** D-01 + D-06 intersect: auto re-spin must not claim spinnership.
**How to avoid:** Add a boolean parameter to `spinPick({ auto: true })` that skips the `spinnerId` write when the call originates from `submitVeto`. Or: write `spinnerId = null` for auto re-spins so the next manual tap claims it.
**Warning sign:** After a post-spin veto, the vetoer can tap Spin again immediately.

### Pitfall 3: Solo-member case blocks the only member
**What goes wrong:** A 1-person-selected session: the lone member vetoes, then fairness rule disables their Spin button → they can't continue.
**Why:** D-08 waiver must be enforced at the render-time check, not just documented.
**How to avoid:** In the fairness check, always include `state.selectedMembers.length > 1` as a gate. Also log a debug line per D-08 ("solo session; fairness waived") to make the waiver visible during manual QA.
**Warning sign:** Solo user reports "Spin button stuck after veto."

### Pitfall 4: Empty pool infinite loop
**What goes wrong:** Vetoer vetoes the last title; auto re-spin finds `matches.length === 0` and `spinPick()` early-returns silently (app.js:4395), modal closes or hangs. D-04 says relax filters progressively before giving up.
**How to avoid:** Before calling `spinPick()` inside `submitVeto`, check `getCurrentMatches().length`. If 0, relax `state.selectedMoods = []` first, re-check. If still 0, drop provider-scope filter or limit-to-services. Only then show the empty state copy from UI-SPEC: "Nothing left to spin — try clearing some filters".
**Warning sign:** Spin modal freezes on an empty flicker frame.

### Pitfall 5: Undoing a veto from a prior session
**What goes wrong:** `unveto()` is called at 12:05am on a veto logged at 11:58pm. `state.sessionDate` now points to a new session doc (empty), so `setDoc(sessionRef(), { vetoes: {} })` on the new session overwrites nothing meaningful but might confuse. Meanwhile, the `vetoHistory` doc from the prior session would be deleted per the naive implementation — violating D-11.
**How to avoid:** In `unveto()`, compare the veto entry's `at` timestamp with the current `sessionDate` boundary. If they don't match, refuse the delete (or surface a warn toast: "this veto is locked").
**Warning sign:** Year-in-Review missing vetoes because post-midnight undos silently deleted history.

### Pitfall 6: Simultaneous vetoes from two members
**What goes wrong:** Two members veto different titles in the same second. `setDoc(sessionRef(), { vetoes: { [titleA]: entryA } }, { merge: true })` and `setDoc(sessionRef(), { vetoes: { [titleB]: entryB } }, { merge: true })` — **merge IS key-level, not field-level-within-map**, so the second write can clobber `vetoes[titleA]` depending on Firestore merge semantics.
**How to avoid:** Use `{ merge: true }` with **dotted field paths** to mutate a single sub-key: `updateDoc(sessionRef(), { [`vetoes.${titleId}`]: entry })`. This is atomic at the map-key level and won't clobber other keys. `updateDoc` is already imported.
**Warning sign:** One veto disappears when two members veto at the same time.
**Reference:** Firestore docs — `updateDoc` with dotted paths vs. `setDoc({merge})` with nested maps. `[CITED: firebase.google.com/docs/firestore/manage-data/add-data]`

### Pitfall 7: Vetoing during the flicker animation
**What goes wrong:** User taps Veto on a previous spin result, then `spinPick()` is called while a prior flicker is still running (old `setTimeout` loop from the earlier spin).
**How to avoid:** The existing `spinPick()` overwrites `content.innerHTML` on entry (app.js:4419), which detaches the old flicker DOM. The stale `setTimeout` still fires but its `flickerEl` reference is now orphaned — harmless. Verify by rapid-vetoing during manual QA.
**Warning sign:** Double-flicker or ghost poster flash during re-spin.

### Pitfall 8: Mood filter interaction (Phase 3 coupling)
**What goes wrong:** After a veto empties the pool AND mood filter is active, D-04 says drop mood first. But the mood filter is `state.selectedMoods` — a client-side filter. Clearing it on all devices isn't desirable (only this spin should relax). Clearing it only locally creates a drift between the vetoer's device and other devices' views.
**How to avoid:** Relaxation is *per-spin-attempt*, not a state mutation. Inside `spinPick()` (or a new `spinWithRelaxation()` helper), compute matches with current filters → if empty, re-compute with `selectedMoods = []` *just for this call* (don't write to `state`) → pick from the relaxed set. This keeps other devices' filter UI intact.
**Warning sign:** A family member's mood filter chips mysteriously clear.

## Code Examples

### Extended `submitVeto` (post-spin aware)
```js
// Source: derived from js/app.js:5259 + D-01, D-10
window.submitVeto = async function(opts = {}) {
  if (!vetoTitleId || !state.me) return;
  const comment = document.getElementById('veto-comment').value.trim().slice(0, 200);
  const t = state.titles.find(x => x.id === vetoTitleId);
  const titleName = t?.name || 'a title';
  const entry = {
    memberId: state.me.id,
    memberName: state.me.name,
    comment: comment || '',
    at: Date.now()
  };
  try {
    // Atomic per-key write — avoids clobbering a concurrent veto (Pitfall 6)
    await updateDoc(sessionRef(), { [`vetoes.${vetoTitleId}`]: entry });
    // History write — survives midnight rollover
    const histRef = await addDoc(vetoHistoryRef(), {
      ...entry,
      titleId: vetoTitleId,
      titleName,
      sessionDate: todayKey()
    });
    // Optimistic local update so getCurrentMatches() excludes the title before the listener fires
    state.session = state.session || { vetoes: {} };
    state.session.vetoes = { ...(state.session.vetoes || {}), [vetoTitleId]: { ...entry, historyDocId: histRef.id } };
    logActivity('vetoed', { titleName });
    closeVetoModal();
    // D-01: if invoked from spin result, trigger auto re-spin (bypasses fairness per D-06)
    if (opts.fromSpinResult) {
      // D-14: shimmer before flicker
      showRespinShimmer();
      setTimeout(() => spinPick({ auto: true }), 400);
    }
  } catch(e) { flashToast('Could not save veto: ' + e.message, { kind: 'warn' }); }
};
```

### Fairness-aware `spinPick`
```js
// Source: derived from js/app.js:4393 + D-05, D-06, D-07
window.spinPick = function(opts = {}) {
  // D-06: manual spins claim spinnership; auto re-spins do not
  if (!opts.auto && state.me) {
    setDoc(sessionRef(), { spinnerId: state.me.id, spinnerAt: Date.now() }, { merge: true });
  }
  // D-04: progressive relaxation (inline, not a state mutation)
  let matches = getCurrentMatches();
  let relaxed = null;
  if (!matches.length && state.selectedMoods.length) {
    const savedMoods = state.selectedMoods;
    state.selectedMoods = [];
    matches = getCurrentMatches();
    state.selectedMoods = savedMoods;
    relaxed = 'mood';
  }
  if (!matches.length) {
    // UI-SPEC empty state
    showEmptyPoolMessage();
    return;
  }
  if (relaxed) flashToast(`Relaxed ${relaxed} filter for this spin.`, { kind: 'info' });
  // …existing flicker + landing logic…
};
```

### Fairness render check
```js
// In the Tonight render path, around the Spin button emit
function isFairnessLocked() {
  if (!state.me || !state.session) return false;
  if ((state.selectedMembers || []).length <= 1) return false; // D-08 waiver
  const myVetoes = Object.values(state.session.vetoes || {})
    .filter(v => v.memberId === state.me.id);
  if (!myVetoes.length) return false;
  const latestVeto = myVetoes.reduce((m, v) => Math.max(m, v.at || 0), 0);
  const lastSpinAt = state.session.spinnerAt || 0;
  return latestVeto > lastSpinAt; // my veto is newer than the last spin → I'm fairness-locked
}
```

### Real-time toast diff inside session listener
```js
// Source: extend js/app.js:1487-1494
let prevVetoKeys = new Set();
state.unsubSession = onSnapshot(sessionRef(state.sessionDate), s => {
  const incoming = s.exists() ? s.data() : { vetoes: {} };
  const incomingVetoes = incoming.vetoes || {};
  // Detect new vetoes that aren't mine (D-13)
  for (const titleId of Object.keys(incomingVetoes)) {
    if (!prevVetoKeys.has(titleId)) {
      const v = incomingVetoes[titleId];
      if (v.memberId !== state.me?.id) {
        const t = state.titles.find(x => x.id === titleId);
        flashToast(`${v.memberName} passed on ${t?.name || 'a title'} — spinning again…`, { kind: 'info' });
      }
    }
  }
  prevVetoKeys = new Set(Object.keys(incomingVetoes));
  state.session = incoming;
  renderTonight();
}, e => {});
```

## UI Integration Points

| UI Surface | Current Anchor | Phase 4 Change |
|-----------|----------------|----------------|
| Spin result modal actions | `js/app.js:4470-4474` (`.spin-actions` block) | Insert Veto button `<button class="spin-veto" onclick="openVetoModal('${t.id}', {fromSpinResult:true})">Pass on this</button>` between `.spin-reroll` and `.spin-cancel`. Veto button styles per UI-SPEC (`background: var(--bad)`). |
| Title detail modal | Existing — opened via `openVetoModal(titleId)` from action sheet (`js/app.js:7374`) | No change. |
| Tonight section Spin button | `js/app.js:2057` (`actions.push('<button class="t-spin" onclick="spinPick()">🎲 Spin</button>')`) | Wrap emit with fairness check; when locked, render disabled variant + tooltip copy from UI-SPEC. |
| Vetoed-tonight divider | `js/app.js:2066-2071` | Optional count badge per UI-SPEC component inventory (Claude's discretion). |
| Per-card `.tc-note.veto` | `js/app.js:2229` | No change — already renders. |
| Activity feed 'vetoed' | `js/app.js:4653` | No change. |
| Toast container | `flashToast()` — auto-managed | No new DOM. |
| "Spinning again…" shimmer | `.spin-result-poster` element inside spin modal | Swap to `<div class="sk spin-result-poster">` for ~400ms between submit and flicker start. |
| Veto modal (`#veto-modal-bg`) | `index.html:643-650` | No HTML change. `openVetoModal` signature may accept an opts object; submit button `onclick="submitVeto()"` → planner may pass an inline arg if storing the spin-result context on a module variable is preferred. |
| Daily-cap warn copy | Inside veto modal (`#veto-modal-meta` or near submit button) | When `myVetoesToday() >= 1` but `< 2`: no change. When `>= 2`: replace description with "you've used both vetoes tonight" and disable submit (per UI-SPEC interaction states). |

## Undo Veto Surface (existing, clarified)

`unveto(titleId)` (app.js:5274) currently only rewrites the session doc. Phase 4 extension:

```js
window.unveto = async function(titleId) {
  if (!state.me) return;
  const v = getVetoes()[titleId];
  if (!v || v.memberId !== state.me.id) return;
  try {
    const current = { ...getVetoes() };
    delete current[titleId];
    await setDoc(sessionRef(), { vetoes: current });
    // D-11: delete the corresponding history doc (same-session only)
    if (v.historyDocId) {
      await deleteDoc(vetoHistoryDoc(v.historyDocId));
    }
  } catch(e) { flashToast('Could not undo veto.', { kind: 'warn' }); }
};
```

Where the "Undo veto" button renders is unchanged from today (if it's a card-level surface) — planner to confirm with UI-SPEC and existing DOM emits.

## Testing Strategy

**No test harness in this repo** — all verification is manual. The planner's success criteria must be demonstrable via:

### Sequence 1 — Pre-spin veto (VETO-01 regression)
1. Two browser tabs as two family members. Tab A opens a title's detail modal, taps "Pass on it".
2. **Expected:** Title disappears from Tonight candidate list on BOTH tabs within 2s. `.tc-note.veto` renders under the vetoed-tonight divider.

### Sequence 2 — Post-spin veto auto re-spin (VETO-02, VETO-03)
1. Tab A taps Spin, lands on Title X. Tab A taps the new "Pass on this" button in the spin result.
2. **Expected:**
   - Tab A: spin modal transitions to "spinning again…" shimmer (~400ms), then new flicker, lands on Title Y (not X).
   - Tab B: toast "A passed on Title X — spinning again…" appears; spin modal on Tab B (if open) also shimmers + re-lands.
   - Activity feed on both tabs shows the 'vetoed' entry.

### Sequence 3 — Fairness rule (VETO-06)
1. Tab A spins → lands. Tab B vetoes the result (auto re-spin fires per D-01).
2. After the auto re-spin lands: Tab B's Spin button is **disabled** with tooltip "Someone else spins this one." Tab A's Spin button is **enabled**.
3. Tab A taps Spin → new spin lands. **Now both tabs see Spin enabled** (D-07: rule cleared).

### Sequence 4 — Solo waiver (D-08)
1. Single member selected. Member vetoes a post-spin pick.
2. **Expected:** Auto re-spin fires, and Spin button remains enabled for solo member (fairness waived).

### Sequence 5 — Daily cap (D-12)
1. Member vetoes title A. Member tries to veto title B — allowed (2nd veto).
2. Member tries to veto title C — blocked with "you've used both vetoes tonight".

### Sequence 6 — Undo within session (D-11)
1. Member vetoes title A. Taps "Undo veto".
2. **Expected:** Title A returns to pool on all devices. `vetoHistory` doc is deleted (verify via Firebase console).

### Sequence 7 — Undo across midnight (D-11 immutability)
1. Veto logged at 11:58pm. At 12:01am, attempt undo.
2. **Expected:** Undo refuses (new session already active); `vetoHistory` doc persists. History is immutable.

### Sequence 8 — Empty pool relaxation (D-04)
1. Filter to a mood with only 1 candidate title. Veto that title.
2. **Expected:** Auto re-spin relaxes mood filter, picks from broader pool, shows info toast "Relaxed mood filter for this spin."

### Sequence 9 — Concurrent veto (Pitfall 6 regression)
1. Tab A and Tab B veto different titles within ~1 second.
2. **Expected:** Both vetoes persist (no clobber) because of `updateDoc` with dotted field paths.

### Sequence 10 — Vetoed title excluded from re-spin pool (D-03)
1. Veto title X. Spin again (manually). Repeat 5 times.
2. **Expected:** Title X never re-appears in any flicker or landing result.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Firestore SDK (modular) | All Firestore writes | ✓ | 10.12.0 (gstatic CDN) | — `[VERIFIED: js/firebase.js:1]` |
| TMDB API | Not used by Phase 4 | n/a | — | — |
| Trakt API | Not used by Phase 4 | n/a | — | — |
| Firebase Hosting | Deploy target | ✓ | — | — |

No missing dependencies. Phase 4 is self-contained within existing client stack.

## Validation Architecture

> `.planning/config.json` was not explicitly read in this research pass; assuming nyquist_validation default (enabled). However, this project has **no automated test framework** — all validation is manual multi-tab Firestore demonstration. The section below documents what exists.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | None (manual QA via Firestore multi-tab) |
| Config file | None |
| Quick run command | n/a — manual browser test |
| Full suite command | n/a — see Testing Strategy sequences 1-10 |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VETO-01 | Pre-spin pool exclusion | manual | n/a | — (Sequence 1 above) |
| VETO-02 | Post-spin auto re-spin | manual | n/a | — (Sequence 2) |
| VETO-03 | Real-time cross-device surface | manual | n/a | — (Sequence 2, 3) |
| VETO-04 | Optional reason captured + rendered | manual | n/a | — (Sequence 1 verify comment in `.tc-note.veto`) |
| VETO-05 | `vetoHistory` subcollection persists | manual (+ Firebase console check) | n/a | — (Sequence 6 inverse: verify doc exists before undo) |
| VETO-06 | Vetoer blocked from re-spin | manual | n/a | — (Sequence 3) |

### Sampling Rate
- **Per task commit:** Run the relevant sequence from the list above against two incognito tabs at `http://localhost:<port>` (or deployed preview).
- **Per plan completion:** Run Sequences 1-3 minimum.
- **Phase gate:** All 10 sequences demonstrable on mobile Safari (primary surface).

### Wave 0 Gaps
- None — the project has no test scaffolding to build on and the architecture decision (single-file, no bundler) precludes adding one without violating CLAUDE.md constraints.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Firebase project is family-code-scoped; no user auth gates in this phase |
| V3 Session Management | no | Session = per-day Firestore doc; not auth session |
| V4 Access Control | partial | Firestore rules assumed to enforce family-scoped reads/writes (not modified in this phase) |
| V5 Input Validation | **yes** | `openVetoModal(titleId)`: already gated by `state.titles.find` lookup (implicit). `submitVeto`: `.slice(0, 200)` caps reason. Any new `window.*` function taking an onclick-passed id MUST validate against a known set per the Phase 3 `moodById` gate pattern (established project convention — see `js/app.js:1963, 2133`). |
| V6 Cryptography | no | No new secrets, no new crypto surfaces |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via veto comment | Tampering | `escapeHtml()` already applied in `.tc-note.veto` render (`js/app.js:2229`) — continue to use for any new render surfaces (toast uses `.textContent` which is safe by default per `flashToast` implementation at `utils.js:27`) |
| Cross-family veto injection | Elevation of Privilege | Firestore security rules (not modified) scope reads/writes to `families/{familyCode}/*` by family code knowledge; out of scope for Phase 4 |
| Veto doc id injection via onclick | Injection | Any `window.vetoFrom*(titleId)` function must validate `state.titles.find(x => x.id === titleId)` before mutating — mirrors Phase 3 `moodById` ASVS V5 gate |
| Concurrent write clobber | Tampering (data integrity) | Use `updateDoc` with dotted field paths instead of `setDoc({merge:true})` with nested maps (Pitfall 6) |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single-file `index.html` (pre-Phase 3.5) | Modular ES modules split across `index.html` + `css/app.css` + `js/*.js` | 2026 (Phase 3.5 refactor) | All new JS goes in existing modules; no new top-level files needed for this phase. `js/app.js` remains the catch-all for feature logic |
| 1 veto/member/day cap | 2/day (D-12) | This phase | Middle-ground UX; still prevents spam |
| Session-only veto storage | Session + `vetoHistory` subcollection (D-09, D-10) | This phase | Enables YEAR-04 aggregation without midnight-archive choreography |
| Spinner = Picker rotation | Spinner = whoever last tapped Spin (D-05) | This phase | Decouples fairness from the opt-in Picker feature (which may be disabled per-family) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `updateDoc(ref, { 'vetoes.titleId': entry })` correctly merges at the map-key level without clobbering sibling keys | Pitfall 6, Code Example `submitVeto` | If wrong, concurrent vetoes could still clobber. Verify with a 2-tab concurrent veto test in Sequence 9. `[CITED: firebase.google.com/docs/firestore/manage-data/add-data]` — standard Firestore behavior, but confirm against 10.12.0 modular SDK exact semantics. |
| A2 | `state.selectedMembers.length === 1` is the correct solo-waiver predicate (D-08) | Fairness render check | If the discretion around "selected" vs "all family" matters, solo waiver might misfire. Confirm in discuss or test with a 2-member family where only 1 is selected. |
| A3 | The onSnapshot diff for real-time toasts uses a module-scoped `prevVetoKeys` set across re-subscriptions | Code Example real-time toast | If `subscribeSession` is called again on midnight refresh, the stale set could emit spurious toasts. Reset on re-subscription. |
| A4 | `addDoc(vetoHistoryRef(), …)` succeeds without explicit Firestore security rule updates | Firestore Schema Extension | If rules deny writes to a new subcollection path, all veto submits will fail silently. Planner should include "verify Firestore rules permit writes to `families/{familyCode}/vetoHistory/*`" as a first-task precondition. |
| A5 | `getCurrentMatches()` relaxation can happen inline inside `spinPick` by temporarily mutating `state.selectedMoods` without triggering an unwanted render | Code Example fairness-aware `spinPick` | If `state` mutations cue a render pipeline, this could briefly flash the UI. Alternative: factor `getCurrentMatches()` to accept an override options bag. |
| A6 | The "fairness clears on next spin landed" rule (D-07) is implementable as a timestamp comparison (`latestVeto > lastSpinAt`) | Fairness render check | If fairness must clear exactly on the *landed* event (not on spin *initiation*), `spinnerAt` should be written in `showSpinResult` instead of at the top of `spinPick`. Planner to choose. |

**If this table is empty:** It isn't — six assumptions flagged for user/planner confirmation.

## Open Questions (RESOLVED)

1. **Should `spinnerId` be written on spin initiation or on spin-landed?**
   - What we know: D-07 says fairness clears once "that spin lands." Writing at initiation is simpler; writing at landing aligns better with the spec.
   - RESOLVED: Write at **landing** (inside `showSpinResult`) — this makes `spinnerAt` the timestamp of a completed spin, which is exactly what the fairness check compares against.

2. **Does `unveto()` need a confirmation step?**
   - What we know: UI-SPEC says single-tap, no confirmation, "reversible within session."
   - RESOLVED: Follow UI-SPEC. No confirmation.

3. **Should the "relaxed filter" toast be suppressed during an auto re-spin to avoid toast-stacking?**
   - What we know: D-13 already emits a toast for the veto event. D-04 relaxation could add a 2nd toast.
   - RESOLVED: Merge messages: "Sam passed on X — spinning again (mood filter relaxed)". Claude's discretion per copy rules.

4. **Does the existing `myVetoToday()` need renaming once cap is 2?**
   - What we know: Returns first match. D-12 allows 2.
   - RESOLVED: Introduce `myVetoesToday()` (plural) returning an array; keep `myVetoToday()` as a compat alias that returns `arr[0]` or null. Planner to choose pace of rename.

## Project Constraints (from CLAUDE.md)

- **No bundler / build step** — all new code goes in existing ES modules, served as-is by Firebase Hosting.
- **Do not move TMDB key or Firebase config server-side** — public-by-design.
- **Do not start monetization work** — out of scope.
- **Token cost:** `js/app.js` is ~8100 lines; never read in full. This research used grep + offset-Read only.
- **TMDB rate limit ~40 req/10s** — n/a to this phase (no new TMDB calls).
- **Firestore schema per-family nesting** — new `vetoHistory` subcollection follows the convention (`families/{code}/vetoHistory/*`).
- **Design system:** Fraunces + Instrument Serif + Inter; warm dark palette. Veto surfaces use `--bad` for destructive, `--accent` for warnings. Specified in `04-UI-SPEC.md`.
- **Mobile Safari PWA is primary surface** — 44px touch targets, no hover-only interactions, test on iOS home-screen install.
- **Deploy:** Copy `index.html`, `css/`, `js/` to `queuenight/public/` then `firebase deploy`.
- **GSD roadmap:** Phase numbers start at 3 intentionally. Do not renumber.

## Sources

### Primary (HIGH confidence)
- `js/app.js:1045-1061, 1487-1505, 2000-2080, 2220-2230, 4327-4475, 4575-4599, 4645-4668, 5238-5284` — all verified via direct Read
- `js/firebase.js:1-17` — full read, confirms available imports
- `js/state.js:1-7` — full read, confirms current refs
- `js/utils.js:1-73` — full read, confirms `flashToast`, `haptic`, `escapeHtml`
- `index.html:643-650` — verified veto modal DOM
- `.planning/phases/04-veto-system/04-CONTEXT.md` — authoritative decisions
- `.planning/phases/04-veto-system/04-UI-SPEC.md` — authoritative visual contract
- `.planning/REQUIREMENTS.md` — VETO-01..06 definitions
- `CLAUDE.md` — project constraints

### Secondary (MEDIUM confidence)
- Firebase Firestore modular SDK semantics for `updateDoc` with dotted field paths vs. `setDoc({merge:true})` with nested maps — assumption A1 `[CITED: firebase.google.com/docs/firestore/manage-data/add-data]`, not independently verified in this pass.

### Tertiary (LOW confidence)
- None — every claim is traceable to a read file or a CONTEXT.md decision.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all deps already loaded, imports verified in `firebase.js`
- Architecture: HIGH — pattern derived from existing session + activity implementations
- Pitfalls: MEDIUM-HIGH — 8 landmines identified; A1 (updateDoc dotted-path merge) would benefit from an explicit empirical check
- Firestore schema: HIGH — mirrors existing family-scoped subcollection pattern

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (30 days — stable stack, no fast-moving deps)

## RESEARCH COMPLETE
