# Phase 4: Veto System - Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 3 (1 new helper in state.js, 2 modified — app.js, css/app.css)
**Analogs found:** 3 / 3 (100% — pure extension phase)

## Scope Reminder

Phase 4 is **surgical extension work**, not greenfield. Every new feature has an in-file analog already shipped. The planner's job is to mirror existing patterns inside the same functions, not invent new files.

## File Classification

| File | Role | Data Flow | Closest Analog | Match Quality |
|------|------|-----------|----------------|---------------|
| `js/state.js` (modify — add `vetoHistoryRef`, `vetoHistoryDoc`) | utility / Firestore ref helper | CRUD ref-builder | existing `membersRef()`/`titlesRef()`/`familyDocRef()` in same file | **exact** (pure copy-paste of collection/doc pattern) |
| `js/app.js` (modify — extend `submitVeto`, `unveto`, `spinPick`, `showSpinResult`, `subscribeSession`, `openVetoModal`, `myVetoToday`, plus Tonight render for fairness-disabled Spin button + relaxation helper) | controller / feature logic | event-driven + real-time pub-sub | existing sibling functions in same module (`submitVeto`, `logActivity`, `subscribeSession`) | **exact** (extend in place) |
| `css/app.css` (modify — add `.spin-veto` button + fairness-disabled Spin state + optional `.t-vetoed-divider` count badge) | style | — | existing `.spin-accept`, `.spin-reroll`, `.spin-cancel`, `.progress-stepper-btn:disabled`, `.sk` | **exact** |

**No new files.** Per CLAUDE.md: "no bundler or build step", and per RESEARCH.md §State of the Art: all new JS goes in existing modules.

## Pattern Assignments

### `js/state.js` — add `vetoHistoryRef()` + `vetoHistoryDoc(id)`

**Analog:** `js/state.js:5-7` (existing `membersRef`, `titlesRef`, `familyDocRef` in the same file).

**Pattern to copy** (js/state.js:5-7):
```js
export function membersRef() { return collection(db, 'families', state.familyCode, 'members'); }
export function titlesRef() { return collection(db, 'families', state.familyCode, 'titles'); }
export function familyDocRef() { return doc(db, 'families', state.familyCode); }
```

**New additions (mirror verbatim):**
```js
export function vetoHistoryRef() { return collection(db, 'families', state.familyCode, 'vetoHistory'); }
export function vetoHistoryDoc(id) { return doc(db, 'families', state.familyCode, 'vetoHistory', id); }
```

Then import both in `js/app.js` alongside the existing state-helper imports. `collection` and `doc` are already re-exported from `js/firebase.js:17` — no new firebase imports.

---

### `js/app.js` — extend `submitVeto` (app.js:5259-5273)

**Analog:** `submitVeto` itself + `logActivity` (app.js:4580-4599) for the `addDoc` pattern.

**Existing write pattern** (app.js:5269):
```js
await setDoc(sessionRef(), { vetoes: { [vetoTitleId]: entry } }, { merge: true });
logActivity('vetoed', { titleName: (state.titles.find(x => x.id === vetoTitleId) || {}).name || 'a title' });
closeVetoModal();
```

**Existing `addDoc` to subcollection pattern** (app.js:4588-4594 — `logActivity`):
```js
await addDoc(activityRef(), {
  kind,
  actorId: state.me.id,
  actorName: state.me.name,
  ts: Date.now(),
  ...payload
});
```

**Pattern to extend with** (per D-09, D-10, Pitfall 6):
- Swap `setDoc({ vetoes: {...} }, { merge: true })` for `updateDoc(sessionRef(), { ['vetoes.' + vetoTitleId]: entry })` — dotted field path avoids concurrent-veto clobber (RESEARCH Pitfall 6).
- Add `addDoc(vetoHistoryRef(), { ...entry, titleId, titleName, sessionDate: todayKey() })` immediately after — mirrors `logActivity`'s addDoc call.
- Capture returned `histRef.id` and store it on the session entry as `historyDocId` for `unveto()` deletion path.
- Optimistically update `state.session.vetoes` before invoking `spinPick({ auto: true })` (Pitfall 1).
- Accept `opts = { fromSpinResult: bool }`; if true, call `spinPick({ auto: true })` after ~400ms shimmer (D-01, D-14).
- Upgrade `alert(…)` error to `flashToast(msg, { kind: 'warn' })` — matches D-12 warm-tone convention.

---

### `js/app.js` — extend `unveto` (app.js:5274-5284)

**Analog:** existing `unveto` itself.

**Existing delete pattern** (app.js:5278-5282):
```js
const current = { ...getVetoes() };
delete current[titleId];
await setDoc(sessionRef(), { vetoes: current });
```

**Pattern to extend with** (D-11):
- After the session rewrite, `if (v.historyDocId) await deleteDoc(vetoHistoryDoc(v.historyDocId));` — mirrors the existing Firestore-delete style (no `deleteField` sentinel).
- Gate on `state.sessionDate === v.sessionDate` (or compare `v.at` to session boundary) — refuse cross-midnight undo and `flashToast('this veto is locked', { kind: 'warn' })`. `deleteDoc` already imported via `js/firebase.js:17`.

---

### `js/app.js` — extend `spinPick` (app.js:4393-4438) for fairness + relaxation

**Analog:** `spinPick` itself — it is self-contained and idempotent (RESEARCH §Codebase Analogs #5).

**Existing entry logic** (app.js:4394-4395):
```js
const matches = getCurrentMatches();
if (!matches.length) return;
```

**Pattern to extend with:**
- Add `opts = {}` parameter; default `auto: false`.
- If `!opts.auto && state.me`: `setDoc(sessionRef(), { spinnerId: state.me.id, spinnerAt: Date.now() }, { merge: true })` — mirrors the existing `setDoc(sessionRef(), …, { merge: true })` write pattern at app.js:5269.
- For D-04 relaxation: **do not mutate `state.selectedMoods` permanently**. Save → clear → recompute → restore. Per RESEARCH Pitfall 8 and Assumption A5 — inline-temporarily-mutate approach, no state render triggered. If still empty after mood drop, open a standard empty-state inside the spin modal using existing `content.innerHTML =` pattern from app.js:4419-4422.
- If relaxation fired, `flashToast('Relaxed mood filter for this spin.', { kind: 'info' })` — matches existing `flashToast` usage convention.

**Open question per RESEARCH §Open Questions #1:** decide whether `spinnerAt` is written at spin initiation (top of `spinPick`) or at landing (inside `showSpinResult`). Planner recommendation: landing.

---

### `js/app.js` — extend `showSpinResult` (app.js:4440-4475)

**Analog:** the `.spin-actions` block at app.js:4470-4474.

**Existing actions emission** (app.js:4470-4474):
```js
<div class="spin-actions">
  <button class="spin-accept" onclick="acceptSpin('${t.id}')">Watch this tonight</button>
  <button class="spin-reroll" onclick="spinPick()">🎲 Spin again</button>
  <button class="spin-cancel" onclick="closeSpinModal()">Cancel</button>
</div>
```

**Pattern to extend with** (D-15, UI-SPEC §Component Inventory):
- Insert between `.spin-reroll` and `.spin-cancel`:
```js
<button class="spin-veto" onclick="openVetoModal('${t.id}', { fromSpinResult: true })">Pass on it</button>
```
- If the `spinnerAt`-on-landing approach is chosen, write it here: `setDoc(sessionRef(), { spinnerAt: Date.now() }, { merge: true })`.
- All `${t.…}` interpolation already uses `escapeHtml` — continue the pattern (`t.id` is a known Firestore id, safe as an attribute value).

---

### `js/app.js` — extend `openVetoModal` (app.js:5240-5254) — accept opts + bump cap to 2

**Analog:** `openVetoModal` itself + the `myVetoToday()` helper at app.js:1053-1060.

**Existing cap guard** (app.js:5242-5247):
```js
const existing = myVetoToday();
if (existing) {
  const t = state.titles.find(x => x.id === existing.titleId);
  alert(`You already used your veto tonight${t?` on ${t.name}`:''}. Vetoes reset at midnight or when someone logs a watch.`);
  return;
}
```

**Pattern to extend with** (D-12):
- Introduce `myVetoesToday()` (plural) returning an array — mirror the iteration shape already in `myVetoToday`:
  ```js
  function myVetoesToday() {
    if (!state.me) return [];
    const vetoes = getVetoes();
    return Object.entries(vetoes)
      .filter(([, v]) => v.memberId === state.me.id)
      .map(([titleId, v]) => ({ titleId, ...v }));
  }
  ```
- Keep `myVetoToday()` as a compat alias returning `arr[0] || null` (per RESEARCH §Open Questions #4) — callers at app.js:2059 (Tonight section) continue to work.
- Change cap gate to `if (myVetoesToday().length >= 2)` with copy "you've used both vetoes tonight" (UI-SPEC Copywriting). Upgrade `alert` → `flashToast(msg, { kind: 'warn' })` for tone.
- Accept `opts = {}`; stash `opts.fromSpinResult` in a module-scoped variable (same shape as existing `let vetoTitleId = null`) so `submitVeto()` can read it.

---

### `js/app.js` — extend `subscribeSession` (app.js:1487-1494) for real-time toast

**Analog:** the subscription itself — already re-renders on every session mutation.

**Existing pattern** (app.js:1487-1494):
```js
function subscribeSession() {
  if (state.unsubSession) { state.unsubSession(); state.unsubSession = null; }
  state.sessionDate = todayKey();
  state.unsubSession = onSnapshot(sessionRef(state.sessionDate), s => {
    state.session = s.exists() ? s.data() : { vetoes: {} };
    renderTonight();
  }, e => {});
}
```

**Pattern to extend with** (D-13 + RESEARCH §Code Examples real-time toast):
- Before the `state.session = …` assignment, diff the incoming `vetoes` keys against the previous `state.session.vetoes`. For each newly-added key whose `memberId !== state.me?.id`, `flashToast(\`${v.memberName} passed on ${titleName} — spinning again…\`, { kind: 'info' })`.
- Reset the diff set inside `subscribeSession` (per Assumption A3 — midnight re-subscribe must not leak stale keys).
- No new `onSnapshot` needed — `spinnerId`/`spinnerAt` ride the same session doc (RESEARCH §Real-Time Propagation Confirmation).

---

### `js/app.js` — Tonight Spin button fairness gate (app.js:2057)

**Analog:** the inline action-button emission already at line 2057.

**Existing emission** (app.js:2057):
```js
actions.push(`<button class="t-spin" onclick="spinPick()">🎲 Spin</button>`);
```

**Pattern to extend with** (D-06, D-07, D-08):
- Compute `isFairnessLocked()` (pure client function, no writes) per RESEARCH §Code Examples — compares `max(my veto.at) > state.session.spinnerAt` AND `state.selectedMembers.length > 1`.
- When locked, emit `<button class="t-spin disabled" disabled title="Someone else spins this one">🎲 Spin</button>`. Mirror `.progress-stepper-btn:disabled` visual pattern from existing CSS (UI-SPEC §Interaction States).

---

### `css/app.css` — new `.spin-veto` + fairness-disabled Spin state

**Analog:** existing `.spin-accept`, `.spin-reroll`, `.spin-cancel`, `.progress-stepper-btn:disabled` (all cited in UI-SPEC §Pre-Population Sources).

**Pattern to copy** (from UI-SPEC §Interaction States):
```css
.spin-veto {
  background: var(--bad);
  color: white;
  border-radius: 12px;
  padding: 14px;
  font-weight: 700;
}
.spin-veto:active { transform: scale(0.98); }
.spin-veto:disabled { opacity: 0.45; cursor: not-allowed; pointer-events: none; }

.t-spin.disabled { opacity: 0.45; cursor: not-allowed; }
```

---

## Shared Patterns (cross-cutting; applied across the changes above)

### Real-time propagation via onSnapshot
**Source:** `js/app.js:1487-1494` (`subscribeSession`).
**Apply to:** All veto writes — they land on the session doc (or activity subcollection), which is already subscribed. Optimistic local mutation before the listener re-broadcasts is the established pattern for latency (RESEARCH Pitfall 1).

### Firestore write with merge
**Source:** `js/app.js:5269` + `js/app.js:4588` (`addDoc(activityRef(), …)`).
**Apply to:** `submitVeto` (updateDoc + addDoc), `spinPick` (setDoc for spinner fields).
**Rule:** Use `updateDoc(ref, { 'map.key': value })` with dotted paths when mutating ONE key inside a map (Pitfall 6). Use `setDoc({merge:true})` when writing top-level fields like `spinnerId`/`spinnerAt`.

### Warm toast as user-facing signal
**Source:** `js/utils.js:16-37` (`flashToast`).
**Apply to:** D-13 real-time cross-device toast, D-04 relaxation notice, D-11 cross-midnight undo refusal, D-12 cap-exceeded warning. Replaces native `alert()` calls throughout the veto code path for tone consistency.

### `window.*` + ASVS V5 gate for onclick ids
**Source:** `js/app.js:1963` (`if (!moodById(id)) return;`).
**Apply to:** Any new/modified `window.*` function that takes an id from an inline `onclick` attribute. Since `openVetoModal(titleId, opts)` will accept `titleId` from `showSpinResult`'s template, it MUST validate: `if (!state.titles.find(x => x.id === titleId)) return;` before mutating. Same for any other new id-taking function.

### Day-rollover boundary for immutable history
**Source:** `js/app.js:1496-1505` (`scheduleMidnightRefresh`) + `js/app.js:1487-1494`.
**Apply to:** `unveto()` — reject deletion if `v.sessionDate !== state.sessionDate`. `vetoHistory` lives outside the session doc so midnight refresh cannot clobber it (RESEARCH §Code Context).

### HTML escaping on any new render surface
**Source:** `js/utils.js:1-4` (`escapeHtml`) + usage at app.js:2229 and app.js:4466.
**Apply to:** Any new string-interpolated render (new `.spin-veto` title name already via `t.id` attribute — safe; any new toast copy uses `.textContent` inside `flashToast` — safe). No raw member-supplied strings should enter `innerHTML` without `escapeHtml`.

## No Analog Found

None. Every Phase 4 surface has a direct in-repo analog.

## Landmines the Planner Must Respect

Lifted from RESEARCH.md §Common Pitfalls — include these as explicit task-level notes in plans:

1. **Optimistic `state.session.vetoes` update before `spinPick({auto:true})`** — else re-spin can re-pick the vetoed title (Pitfall 1).
2. **`spinPick({auto:true})` must NOT write `spinnerId`** — else the vetoer self-unlocks fairness (Pitfall 2).
3. **Solo waiver** — `state.selectedMembers.length > 1` must gate the fairness check (Pitfall 3).
4. **Empty pool → relax filters inline** — do NOT mutate `state.selectedMoods` persistently (Pitfall 4, 8).
5. **Cross-midnight undo refuses** — compare `v.sessionDate` to `state.sessionDate` (Pitfall 5).
6. **Concurrent veto must use `updateDoc` dotted paths, not `setDoc({merge:true})` with nested map** (Pitfall 6).

## Metadata

**Analog search scope:** `js/app.js` (grep-scoped to veto/spin/session/activity regions), `js/state.js`, `js/firebase.js`, `js/utils.js`, `css/app.css` (via UI-SPEC extractions).
**Files scanned:** 5
**Token-cost compliance:** `js/app.js` read only via targeted `offset`/`limit` windows per CLAUDE.md.
**Pattern extraction date:** 2026-04-20

## PATTERN MAPPING COMPLETE
