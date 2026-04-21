# Phase 5: Auth + Groups — Pattern Map

**Mapped:** 2026-04-20
**Files analyzed:** 9 new/modified (7 in this repo + 2 flagged as sibling-repo)
**Analogs found:** 7 / 7 (in-repo)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| NEW `js/auth.js` | service / module surface | OAuth redirect + request-response | `js/app.js:207-274` (`trakt` OAuth object) + `js/firebase.js` (module init shape) | exact (OAuth flow) + exact (module shape) |
| MOD `js/firebase.js` | config / init | n/a | itself (extend in place) | self |
| MOD `js/state.js` | state container | n/a | itself (extend the single `state` object literal) | self |
| MOD `js/utils.js` — add `writeAttribution()` | utility | transform (payload shaping) | `js/app.js:5355-5391` (`submitVeto` → `baseEntry`) + module-scoped `vetoFromSpinResult` snapshot pattern (`app.js:5332, 5343, 5353, 5382`) | role-match (payload builder) + exact (snapshot-then-clear) |
| MOD `js/app.js` — replace `submitFamily`/`showNameScreen`/`joinAsNew`/`joinAsExisting`/`signOut`/`leaveFamily` (lines 1225-1327) | controller / flow | request-response (OAuth return → UI route) | current `app.js:1225-1327` (the flow being replaced) + Trakt `handleAuthCode` (`app.js:235-274`) | exact (UX preserved) + role-match (post-redirect handler) |
| MOD `js/app.js` — update ~25 write sites for attribution | write plumbing | request-response | 4 primary sites: `app.js:4802, 5361, 6095, 7587` — all share identical `{ memberId: state.me.id, memberName: state.me.name, … }` shape | exact |
| MOD `js/app.js` — update self-echo guards | comparator | pub-sub filter | `app.js:1058, 1077, 1531` (`v.memberId === state.me.id`) | exact |
| MOD `js/app.js` — upgrade `savedGroups` to uid-keyed + Firestore-synced | store | CRUD + sync | `app.js:1174-1202` (`loadSavedGroups`/`upsertSavedGroup`/`removeSavedGroup`) + `app.js:1492-1510` (`renderGroupSwitcher`) | exact |
| MOD `js/constants.js` | config | n/a | itself (append new constants like existing `TRAKT_*`) | self |
| NEW firestore.rules | security | — | (no in-repo analog — use RESEARCH.md §5) | no analog |
| NEW `settings/auth` Firestore doc | bootstrap data | — | (no in-repo analog) | no analog |
| NEW CF `setGroupPassword`, `joinGroup`, `claimMember`, `inviteGuest`, `transferOwnership` | sibling repo `queuenight/functions/` | request-response | existing `traktExchange` / `traktRefresh` / `traktDisconnect` (URL shape in `js/constants.js:5-7`) — **not in this repo**, contents unread | role-match (region + envelope precedent only) |

---

## Pattern Assignments

### NEW `js/auth.js` (service, OAuth redirect + request-response)

**Primary shape analog:** the Trakt OAuth object in `js/app.js:207-274`. Same idea (provider redirect + token return + Firestore member-doc write) but Firebase Auth SDK handles the token exchange — our module is thinner.

**Module-export shape analog:** `js/firebase.js` (tiny init-plus-re-exports file). Mirror it.

#### Imports pattern — copy shape from `js/firebase.js:1-2, 17`

```js
// js/firebase.js (existing)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, doc, setDoc, onSnapshot, updateDoc, collection, getDocs, deleteDoc, getDoc, query, orderBy, addDoc, arrayUnion, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
```

New `js/auth.js` mirrors this (one CDN import line per SDK surface, then re-exports). Per RESEARCH.md §1, add to `js/firebase.js` first (auth instance), then `js/auth.js` imports `auth` from `./firebase.js`.

**Anchor for adding the import in `js/firebase.js`:** append a new `import { getAuth, … } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";` block immediately after line 2, then `export const auth = getAuth(app);` immediately after the existing `export const db = getFirestore(app);` on line 16.

#### OAuth redirect pattern — copy from `js/app.js:207-231` (Trakt connect)

```js
// js/app.js:210-231 — Trakt OAuth kickoff
connect() {
  if (!traktIsConfigured()) { flashToast('Trakt is not configured on this deployment.', { kind: 'warn' }); return; }
  const state = Math.random().toString(36).slice(2, 12);
  try { sessionStorage.setItem('qn_trakt_state', state); } catch(e) {}
  const url = 'https://trakt.tv/oauth/authorize?' + new URLSearchParams({
    response_type: 'code', client_id: TRAKT_CLIENT_ID,
    redirect_uri: TRAKT_REDIRECT_URI, state: state
  }).toString();
  const popup = window.open(url, 'trakt-auth', 'width=520,height=720');
  if (!popup) { window.location.href = url; }   // popup-blocked fallback
},
```

**What to copy:**
- `sessionStorage.setItem('qn_trakt_state', state)` before redirect → Phase 5 uses same mechanism to preserve claim-token query params across `signInWithRedirect` (RESEARCH.md §1 "Lost `next` param after redirect" mitigation).
- `flashToast(..., { kind: 'warn' })` for the config-missing case — re-use for "Sign in didn't complete — tap here" iOS standalone retry.

**What DIFFERS:** Phase 5 never uses popups (D-06 locked). Always `signInWithRedirect(auth, provider)` — no popup-blocked fallback needed.

#### Post-redirect handler pattern — copy from `js/app.js:235-274` (Trakt `handleAuthCode`)

```js
// js/app.js:235-274 — after redirect, on app re-entry
async handleAuthCode(code) {
  if (!state.me || !state.familyCode) {
    flashToast('Please sign in before connecting Trakt.', { kind: 'warn' });
    return;
  }
  try {
    const r = await fetch(TRAKT_EXCHANGE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || ('exchange_failed_' + r.status));
    }
    const tokens = await r.json();
    // ... persist to member doc ...
    await updateDoc(doc(membersRef(), state.me.id), { trakt: traktData });
    flashToast('Trakt connected', { kind: 'success' });
    haptic('success');
    if (typeof renderSettings === 'function') renderSettings();
  } catch (e) {
    qnLog('[Trakt] exchange failed', e);
    flashToast('Couldn\'t connect to Trakt. Try again?', { kind: 'warn' });
  }
},
```

**What to copy for `bootstrapAuth()` in `js/auth.js`:**
- try/await pattern with `qnLog(..., e)` + `flashToast(..., { kind: 'warn' })` on failure.
- `haptic('success')` + `flashToast(..., { kind: 'success' })` on success.
- Guard block at top (`if (!state.me || !state.familyCode) return;`) — mirror with claim-token presence check.
- Conditional `renderSettings()` re-call — mirror by calling whatever screen router drives the sign-in UI.

#### Callable Function wrapper — copy fetch shape above

The Trakt pattern uses `fetch(url, { method: 'POST', headers, body: JSON.stringify(...) })`. Phase 5 Cloud Functions are `onCall` (Callable), so they invoke via `httpsCallable(functions, 'setGroupPassword')({...})` (Firebase SDK). Error envelope differs — HttpsError is auto-marshaled. But the try/catch + flashToast UX is identical.

---

### MOD `js/firebase.js` (config / init, self)

**Current file (full):** `js/firebase.js:1-18` — already read above.

#### Edit pattern

1. **Append import** after line 2 — new `firebase-auth.js` import block (see RESEARCH.md §1 for the exact list of exports).
2. **Swap `authDomain`** on line 7: `"queuenight-84044.firebaseapp.com"` → `"couchtonight.app"`. Per RESEARCH.md §1 and P10, this is safe (no pre-Phase-5 authed users to invalidate).
3. **Append `export const auth = getAuth(app);`** after line 16.
4. **Append re-exports** of all the auth surface names to the existing re-export list on line 17 (same barrel style).

**Do NOT restructure the file.** Keep the single-line re-export style. Keep `firebaseConfig` embedded in source (CLAUDE.md: "Public-by-design secrets").

---

### MOD `js/state.js` (state container, self)

**Current file (full):** `js/state.js:1-9` — read above.

#### Edit pattern

Append three keys to the single object literal on line 3:

```js
export let state = {
  // ... existing keys ...
  auth: null,          // Firebase User object (or null). Mirrors auth.currentUser for sync reads.
  actingAs: null,      // Sub-profile memberId snapshot for per-action tap (D-04). Cleared inside writeAttribution().
  actingAsName: null,  // Paired display name for the sub-profile (see writeAttribution).
  ownerUid: null,      // Cached from family doc snapshot for owner-gate UI (D-17).
  settings: null       // { graceUntil, mode } from /settings/auth snapshot (RESEARCH.md §8).
};
```

**Do NOT add new exported helpers here.** The five `…Ref()` helpers (lines 5-9) stay untouched — Pitfall P2 (RESEARCH.md §10) explicitly locks their signature. All new Firestore paths (`users/{uid}/groups/…`, `families/{code}/claimTokens/…`, `families/{code}/invites/…`, `/settings/auth`) get ad-hoc `doc()`/`collection()` calls at the call site, exactly like the existing code does for `activityRef`/`sessionRef`/`watchpartyRef`.

---

### MOD `js/utils.js` — add `writeAttribution()` helper (utility, transform)

**Analog 1 — payload-builder shape:** `js/app.js:5355-5391` (`submitVeto`). Every Firestore write currently constructs a `baseEntry` object literal inline:

```js
// js/app.js:5360-5365
const baseEntry = {
  memberId: state.me.id,
  memberName: state.me.name,
  comment: comment || '',
  at: Date.now()
};
```

**Analog 2 — snapshot-then-clear pattern:** `js/app.js:5332, 5343, 5353, 5382` (`vetoFromSpinResult` module-scoped flag, captured into `wasFromSpin` before `closeVetoModal()` clears it):

```js
// js/app.js:5332, 5343, 5353
let vetoFromSpinResult = false;              // module-scoped flag
// ...
vetoFromSpinResult = !!(opts && opts.fromSpinResult);  // set on open
// ...
vetoFromSpinResult = false;                  // cleared on close

// js/app.js:5382-5387 — snapshot BEFORE the clearing re-render
const wasFromSpin = vetoFromSpinResult;
closeVetoModal();   // <-- this nulls the module flag
if (wasFromSpin) {
  showRespinShimmer();
  setTimeout(() => { if (window.spinPick) window.spinPick({ auto: true }); }, 400);
}
```

**New `writeAttribution()` combines both:**
- Builds the payload fragment (like `baseEntry`).
- Reads `state.actingAs` into a local variable FIRST (snapshot), then clears `state.actingAs = null` before returning — matching VETO-03 semantics so a fast re-render can't mis-attribute.
- Canonical form provided in RESEARCH.md §10 P1 — copy verbatim.

**Imports pattern** — `js/utils.js` currently imports nothing. Add one import:

```js
import { state } from './state.js';
```

Place it at the top of the file. All other functions in `js/utils.js` are pure and stay pure; only `writeAttribution()` touches state.

---

### MOD `js/app.js` — replace sign-in/join/sign-out flow (controller, request-response)

**Analog — UX to preserve:** `js/app.js:1225-1327` (the code being replaced). Specifically:

#### `submitFamily` pattern (lines 1225-1238) — what to keep

```js
// js/app.js:1225-1238
window.submitFamily = async function() {
  const code = normalizeCode(document.getElementById('family-input').value);
  if (!code || code.length < 3) { alert('Please enter at least 3 letters or numbers.'); return; }
  state.familyCode = code;
  let existing = null;
  try { const snap = await getDoc(familyDocRef()); if (snap.exists()) existing = snap.data(); } catch(e){}
  const mode = existing?.mode || state.pendingMode || 'family';
  const docPayload = existing ? { code, mode } : { code, mode, createdAt: Date.now() };
  try { await setDoc(familyDocRef(), docPayload, { merge: true }); } catch(e){}
  state.group = { code, mode, name: existing?.name || code };
  localStorage.setItem('qn_family', code);
  localStorage.setItem('qn_active_group', code);
  await showNameScreen();
};
```

**What to keep:** the 3-letter-min validation, the `existing ? ... : { ..., createdAt: Date.now() }` branch, `setDoc(..., { merge: true })`, localStorage cache writes, `await showNameScreen()`. **What changes:** password-protected groups route through the `joinGroup` Callable Function instead of client-side `setDoc`; the Callable writes the member doc server-side (RESEARCH.md §4 `joinGroup`), then client updates local state and proceeds to `showNameScreen`.

#### `showNameScreen` + `joinAsExisting` pattern (lines 1240-1304) — what to extend

```js
// js/app.js:1252-1265 — the reusable chip-list rendering
const snap = await getDocs(membersRef());
const existing = snap.docs.map(d => d.data());
const el = document.getElementById('existing-members-list');
if (existing.length > 0) {
  document.getElementById('existing-members').style.display = 'block';
  el.innerHTML = existing.map(m => `
    <button class="join-chip" onclick="joinAsExisting('${m.id}','${m.name.replace(/'/g,"\\'")}')">
      <div class="who-avatar" style="background:${m.color}">${avatarContent(m)}</div><div>${m.name}</div>
    </button>`).join('');
} else {
  document.getElementById('existing-members').style.display = 'none';
}
```

**What to keep:** the chip-list rendering, `avatarContent()` call, `join-chip` class. **What to extend (D-03):** the `existing` array must include sub-profiles and active (unexpired) guests. Filter logic:

```js
const now = Date.now();
const visible = existing.filter(m =>
  !m.archived &&
  (!m.temporary || (m.expiresAt && m.expiresAt > now))
);
```

Sub-profiles automatically show because they live in the same `members/` subcollection (D-01). New chip decoration: add a small "kid" badge for `m.managedBy` members and a "guest" badge for `m.temporary`.

#### `isParent` shadow-ownership pattern (line 1287) — what to keep + extend

```js
// js/app.js:1273-1289 — first-member-is-parent
let isFirstMember = false;
try {
  const snap = await getDocs(membersRef());
  const existing = snap.docs.map(d => d.data()).find(m => m.name.toLowerCase() === name.toLowerCase());
  if (existing) { joinAsExisting(existing.id, existing.name); return; }
  isFirstMember = snap.empty;
} catch(e) { console.error(e); }
// ...
if (isFirstMember && currentMode() === 'family') {
  member.isParent = true;
}
```

Per RESEARCH.md P3: extend this block to ALSO write `ownerUid: uid` on the family doc when `isFirstMember`. Use a Firestore batch write so both writes succeed atomically. Do NOT remove the `isParent` assignment — D-17 locks `isParent` and `ownerUid` as orthogonal flags.

#### `signOut` / `leaveFamily` cleanup hook pattern (lines 1306-1327)

```js
// js/app.js:1306-1314 — signOut cleanup
window.signOut = async function() {
  try { await Promise.race([unsubscribeFromPush(), new Promise(r => setTimeout(r, 1500))]); } catch(e) {}
  localStorage.removeItem('qn_me');
  if (state.unsubMembers) state.unsubMembers();
  if (state.unsubTitles) state.unsubTitles();
  location.reload();
};
```

**What to keep:** the `Promise.race([unsubscribeFromPush(), timeout(1500)])` idiom, localStorage cleanup, unsub calls, `location.reload()`. **What to add (RESEARCH.md P4):** call `firebaseSignOut(auth)` before the reload. And hook the same cleanup body into the `onAuthStateChanged(null)` listener so token-revoke-from-elsewhere fires the same teardown. Don't delete the button-handler body — let both paths run; the second is a no-op when state is already torn down.

---

### MOD `js/app.js` — ~25 Firestore write sites (write plumbing, request-response)

**Exact analog — the 4 primary sites, all identical shape:**

```js
// js/app.js:4802 — activity reply
const reply = { memberId: state.me.id, memberName: state.me.name, text, ts: Date.now() };

// js/app.js:5360-5365 — veto submit (baseEntry)
const baseEntry = {
  memberId: state.me.id, memberName: state.me.name,
  comment: comment || '', at: Date.now()
};

// js/app.js:6093-6100 — watchparty reaction
const reaction = {
  id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
  memberId: state.me.id, memberName: state.me.name,
  elapsedMs, at: Date.now(), ...payload
};

// js/app.js:7585-7592 — diary entry
const entry = {
  id: 'd_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
  memberId: state.me.id, memberName: state.me.name,
  date: dateStr, stars: diaryStars, ...
};
```

**Transformation — copy from RESEARCH.md §10 P1:**

```js
// BEFORE
{ memberId: state.me.id, memberName: state.me.name, ...rest }

// AFTER
{ ...writeAttribution(), ...rest }
```

`writeAttribution()` returns `{ actingUid, managedMemberId?, memberId, memberName }` all in one — the two legacy keys (`memberId`, `memberName`) remain for grace-window dual-write (D-20). Single-line edit per site.

**Search strategy for finding all 25+ sites:** `Grep("memberId: state\\.me\\.id", path="js/app.js")` — already enumerated four primaries; remaining sites are: activity feed logs (`logActivity`), mood-tag writes, watchparty reactions (multiple shapes), post-replay reactions, vetoHistory subcollection doc (inherits from `baseEntry` spread), diary entries. Plan task: grep + visit each, apply the transformation.

---

### MOD `js/app.js` — self-echo guards (comparator, pub-sub filter)

**Exact analog — the VETO-03 toast-suppression guard:**

```js
// js/app.js:1531 — the canonical self-echo guard
if (!v || v.memberId === (state.me && state.me.id)) continue;
```

```js
// js/app.js:1058 — my-vetoes filter
if (vetoes[titleId].memberId === state.me.id) out.push({ titleId, ...vetoes[titleId] });

// js/app.js:1077 — latest-mine timestamp scan
if (v && v.memberId === state.me.id) { ... }
```

**Transformation — per D-21:** replace `state.me.id` with `state.auth?.currentUser?.uid` when comparing to the NEW `actingUid` field; keep the old comparison during grace for records written before migration:

```js
// AFTER (Phase 5) — compare against actingUid, fallback to legacy memberId during grace
const myUid = state.auth?.currentUser?.uid;
const isMine = (v.actingUid && v.actingUid === myUid) ||
               (v.memberId && v.memberId === state.me?.id);
if (!v || isMine) continue;
```

Every `=== state.me.id` or `!== state.me.id` site that runs against incoming snapshot data (not local construction) needs the dual check. Sites that reference `state.me.id` for LOCAL lookups (`state.members.find(x => x.id === state.me.id)` at lines 296, 335, 365, 405, 970, …) do NOT change — those are local-identity reads, not self-echo.

**Grep to enumerate:** `Grep("state\\.me\\.id", path="js/app.js")`. Planner classifies each hit as "self-echo guard against remote write" vs "local identity lookup."

---

### MOD `js/app.js` — upgrade `savedGroups` to uid-keyed + Firestore-synced (store, CRUD + sync)

**Exact analog — lines 1174-1202, reusable as the cache layer:**

```js
// js/app.js:1174-1202 — savedGroups localStorage CRUD
function loadSavedGroups() {
  try {
    const raw = localStorage.getItem('qn_groups');
    if (raw) return JSON.parse(raw);
  } catch(e){}
  // Migration: if old qn_family exists, seed as first group
  const old = localStorage.getItem('qn_family');
  if (old) {
    let me = null;
    try { me = JSON.parse(localStorage.getItem('qn_me')||'null'); } catch(e){}
    const seed = [{ code: old, name: old, mode: 'family', myMemberId: me?.id||null, myMemberName: me?.name||null }];
    localStorage.setItem('qn_groups', JSON.stringify(seed));
    localStorage.setItem('qn_active_group', old);
    return seed;
  }
  return [];
}
function saveGroups() { localStorage.setItem('qn_groups', JSON.stringify(state.groups||[])); }
function upsertSavedGroup(entry) { /* merges by code */ }
function removeSavedGroup(code) { /* filters by code */ }
```

**Transformation (RESEARCH.md §7):**
- `loadSavedGroups()` STAYS as the instant-paint cache (called at boot before Firestore subscribes).
- On `onAuthStateChanged(user)` fire, start a new `onSnapshot(collection(db, 'users', user.uid, 'groups'))` subscription.
- On every snapshot, transform docs → `state.groups` array → call `saveGroups()` to rewrite localStorage cache.
- `upsertSavedGroup()` also performs `setDoc(doc(db, 'users', uid, 'groups', entry.code), entry, { merge: true })` for authed users.
- `removeSavedGroup()` also performs `deleteDoc(doc(db, 'users', uid, 'groups', code))`.
- The one-time migration block (lines 1179-1188 reading `qn_family`) STAYS — becomes the "localStorage → Firestore" seed for first-sign-in (RESEARCH.md §7 "Migration of existing `savedGroups`").

**Group-switcher UI analog (lines 1492-1510):** no change to the rendering; the data source (`loadSavedGroups()`) is still called. Only the underlying store changes.

---

### MOD `js/constants.js` (config, self)

**Current file conventions** — `js/constants.js:1-8`:

```js
export const TMDB_KEY = '2ec1f3699afc80f35392f5a674eb9da3';

// ====== TRAKT OAUTH CONFIGURATION ======
export const TRAKT_CLIENT_ID = '...';
export const TRAKT_EXCHANGE_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktExchange';
export const TRAKT_REFRESH_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktRefresh';
export const TRAKT_DISCONNECT_URL = 'https://us-central1-queuenight-84044.cloudfunctions.net/traktDisconnect';
export const TRAKT_REDIRECT_URI = 'https://queuenight-84044.web.app/trakt-callback.html';
```

**What to copy:** the section-comment banner style (`// ====== AUTH CONFIGURATION ======`), the `us-central1-queuenight-84044.cloudfunctions.net/<name>` URL template (confirms RESEARCH.md A1 region assumption), the `traktIsConfigured()` guard-function pattern (lines 10-14) if the new code needs a similar "is callable URL configured" check.

**New constants to add (based on CONTEXT.md + RESEARCH.md):**

```js
// ====== AUTH / GROUPS CONFIGURATION ======
export const CF_REGION = 'us-central1';
export const CF_BASE = 'https://us-central1-queuenight-84044.cloudfunctions.net';
// Claim + invite TTLs (RESEARCH.md §6, Open Question 6)
export const CLAIM_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days
export const GUEST_INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;  // 7 days default
export const GRACE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;     // D-15, 30 days
export const PASSWORD_ALGO_VERSION = 1;  // bump when cost factor rotates
```

**Anchor for import in `js/app.js`:** extend the existing import block at `js/app.js:2` (already enumerates every `constants.js` export individually — follow that convention).

---

### NEW `js/auth-ui.js` (or inline extensions to app.js render layer)

**Decision to delegate to planner:** CLAUDE.md locks the module split. The existing pattern is "all feature logic lives in `js/app.js`"; only infrastructure-shaped files get their own module (`firebase.js`, `state.js`, `utils.js`, `constants.js`). Sign-in screen rendering is feature logic → **belongs in `js/app.js`**, not a new file. Plan should extend `showNameScreen` et al. inline.

If the planner prefers a fresh module for testability, `js/auth.js` can export screen-rendering helpers (`renderSignInScreen`, `renderClaimPanel`) as additional functions — same module, keeps the file tree flat.

---

## Shared Patterns

### `flashToast` + `haptic` for all async UI feedback

**Source:** `js/utils.js:14-37` (`flashToast`), `js/utils.js:5-12` (`haptic`).
**Apply to:** every Phase 5 user-facing async op (sign-in success/failure, claim redeem, password set, invite generate, ownership transfer).

```js
// Standard success pattern — from js/app.js:263-264
flashToast('Trakt connected', { kind: 'success' });
haptic('success');

// Standard warn pattern — from js/app.js:272
flashToast("Couldn't connect to Trakt. Try again?", { kind: 'warn' });
```

### `try { ... } catch(e) { flashToast(..., { kind: 'warn' }); }` around every Firestore / CF call

**Source:** pervasive throughout `js/app.js` — e.g., `app.js:5366-5390` (`submitVeto`), `app.js:240-273` (Trakt `handleAuthCode`).
**Apply to:** every `httpsCallable` invocation for the five new CFs and every `setDoc`/`updateDoc`/`deleteDoc` in the new flows.

### `Promise.race([cleanup(), timeout(1500)])` for non-blocking cleanup

**Source:** `js/app.js:1309, 1319, 1335` (signOut / leaveFamily / openAddGroup all use this exact pattern).
**Apply to:** the new `onAuthStateChanged(null)` handler — unsubscribing push must not block auth state transition.

```js
try { await Promise.race([unsubscribeFromPush(), new Promise(r => setTimeout(r, 1500))]); } catch(e) {}
```

### Module-scoped flag snapshot-then-clear (VETO-03 precedent)

**Source:** `js/app.js:5332, 5343, 5353, 5382` (`vetoFromSpinResult`).
**Apply to:** `state.actingAs` clearing inside `writeAttribution()`. Snapshot into local `actingAsSubProfile` FIRST, then clear `state.actingAs = null`, then return the payload. The write itself can resolve asynchronously and a re-render can happen mid-flight — the snapshot ensures the payload is correct.

### Public-by-design client secrets

**Source:** `js/firebase.js:4-13` (Firebase web config inline), `js/constants.js:1` (TMDB key inline).
**Apply to:** `authDomain` swap stays in `js/firebase.js` source (not env vars). New Firebase Auth provider keys (Apple Services ID etc.) live server-side in Firebase Auth console — not in `js/` at all. No secret surfaces added to the client bundle.

### Firestore path under `families/{state.familyCode}/…`

**Source:** `js/state.js:5-9` (the five ref helpers).
**Apply to:** new subcollections `claimTokens`, `invites` live under `families/{code}/…`. Do not add new top-level collection paths from the client (CF does those: `users/{uid}/groups/{code}` and `settings/auth`).

### Snapshot-subscribe lifecycle: `if (state.unsubX) state.unsubX(); state.unsubX = onSnapshot(...)`

**Source:** `js/app.js:1311-1313` (signOut tears down `unsubMembers`/`unsubTitles`); the subscribe counterparts use `state.unsubMembers = onSnapshot(membersRef(), ...)` elsewhere in `app.js`.
**Apply to:** the new `users/{uid}/groups` subscription AND the new `settings/auth` subscription. Add matching `state.unsubUserGroups` + `state.unsubSettings` slots on the `state` object (state.js). Tear down inside `onAuthStateChanged(null)` + `signOut` + `leaveFamily`.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `firestore.rules` | security | — | No rules file exists in repo today (rules live in Firebase console). Planner must bootstrap the file. Pattern template is in RESEARCH.md §5. |
| `/settings/auth` Firestore doc | bootstrap data | — | No analog settings doc pattern in this codebase. Use the shape in RESEARCH.md §8 directly. |
| CF `setGroupPassword`/`joinGroup`/`claimMember`/`inviteGuest`/`transferOwnership` | sibling repo `queuenight/functions/` | request-response | **Flagged: sibling repo not in this working directory.** Researcher did not read the Trakt functions source. Planner's first plan task must `ls queuenight/functions/` in the sibling repo to confirm region/runtime/packaging (RESEARCH.md A1, A3, Open Q 2) BEFORE writing the five new CFs. The URL template in `js/constants.js:5-7` is the only in-repo hint. |
| `js/auth-ui.js` (if adopted as a separate file) | component | — | No module in this repo has the "UI-only helpers" shape — all UI lives inline in `js/app.js`. Recommend against new module; put auth screens in `app.js` alongside existing `showNameScreen`. |

---

## Import Anchors — where new imports land in existing modules

| Existing module | Insert-after line | New import line |
|---|---|---|
| `js/firebase.js` | line 2 | `import { getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, signOut as firebaseSignOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";` |
| `js/firebase.js` | line 16 | `export const auth = getAuth(app);` |
| `js/firebase.js` | line 17 (extend existing export list) | add `getAuth, GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult, signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, firebaseSignOut` to the re-export list |
| `js/utils.js` | line 1 (new first line) | `import { state } from './state.js';` |
| `js/app.js` | line 2 (extend existing `./constants.js` import) | add `CF_REGION, CF_BASE, CLAIM_TOKEN_TTL_MS, GUEST_INVITE_TTL_MS, GRACE_WINDOW_MS, PASSWORD_ALGO_VERSION` to the destructuring list |
| `js/app.js` | line 3 or 4 (near existing `from './firebase.js'` import) | `import { auth, signInWithRedirect, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, firebaseSignOut, ... } from './firebase.js';` OR `import * as authApi from './auth.js';` |
| `js/app.js` | line 3 or 4 | `import { writeAttribution } from './utils.js';` (extend existing utils import if present) |

---

## Metadata

**Analog search scope:** `js/` (all 5 files) + targeted reads of `js/app.js` lines 207-305, 1170-1360, 1488-1535, 4795-4810, 5325-5395, 6085-6105, 7580-7600 + grep enumerations across full `js/app.js`.
**Files scanned (full):** `js/firebase.js`, `js/state.js`, `js/utils.js`, `js/constants.js`, `CLAUDE.md`, `.planning/phases/05-auth-groups/05-CONTEXT.md`, `.planning/phases/05-auth-groups/05-RESEARCH.md`.
**Files scanned (targeted sections of large file):** `js/app.js` (~275 lines total read out of ~8100).
**Pattern extraction date:** 2026-04-20
