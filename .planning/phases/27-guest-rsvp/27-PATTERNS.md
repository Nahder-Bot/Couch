---
phase: 27-guest-rsvp
type: patterns
created: 2026-05-01
status: complete
---

# Phase 27 — Guest RSVP — Pattern Map

**Mapped:** 2026-05-01
**Files analyzed:** 11 (new/modified)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `rsvp.html` | component (standalone page) | request-response + polling | `rsvp.html` itself (extend in place) | exact (self-analog) |
| `css/rsvp.css` | config (styles) | n/a | `css/rsvp.css` itself + `css/app.css` badge/chip rules | exact (self-analog) |
| `app.html` | component (app shell markup) | event-driven | `app.html` existing wp-banner + wp-participant-chip markup | exact (self-analog) |
| `css/app.css` | config (styles) | n/a | `css/app.css` lines 769–772 (`.wp-participant-chip` variants) + lines 2333–2335 (`.chip-badge`, `.badge-guest`) | exact |
| `js/app.js` | controller (feature logic) | event-driven + request-response | `js/app.js` lines 12156–12206 (`renderParticipantTimerStrip`) + lines 6847–6859 (`removeMember`) + lines 4395–4426 (`createGuestInvite` httpsCallable pattern) | exact |
| `queuenight/functions/src/rsvpSubmit.js` | service (CF, unauth onCall) | request-response + CRUD | `rsvpSubmit.js` itself (extend in place) + `inviteGuest.js` (admin SDK, input validation pattern) | exact (self-analog) |
| `queuenight/functions/src/rsvpReminderTick.js` | service (CF, scheduled) | batch + event-driven | `rsvpReminderTick.js` itself (extend in place) + `index.js` lines 282–339 (`sendToMembers` + `webpush.sendNotification`) | exact (self-analog) |
| `queuenight/functions/index.js` | config (CF entry, export) | n/a | `index.js` lines 1627–1632 (existing `sendToMembers` export, new CF export hook) | exact |
| `firestore.rules` | config (security rules) | n/a | `firestore.rules` lines 577–603 (watchparty rules block, admin-SDK bypass note lines 336+) | exact |
| `tests/rules.test.js` | test | CRUD | `tests/rules.test.js` lines 1–248 (custom harness, `describe`/`it`, `seed()`, `assertFails`/`assertSucceeds`) | exact |
| `scripts/smoke-guest-rsvp.cjs` (NEW) | test (smoke) | transform | `scripts/smoke-availability.cjs` (full file — graceful-skip pattern, `eq`/`eqObj`/`eqSet` helpers, QUEUENIGHT_INDEX path) | exact |

---

## Pattern Assignments

---

### `rsvp.html` (standalone page, request-response + polling)

**Analog:** `rsvp.html` itself (self-extension). Every new block appended below or beside existing functions.

**Imports pattern — none (zero-SDK; inline `<script>` IIFE)**

The entire script is one IIFE — no ES module imports. New constants are declared at the top of the IIFE.

**Core pattern — CF_BASE constant and fetch-based CF call** (lines 44, 119–141):
```js
var CF_BASE = 'https://us-central1-queuenight-84044.cloudfunctions.net';

// POST to CF, structured as { data: { ... } } (Firebase onCall wire format)
var r = await fetch(CF_BASE + '/rsvpSubmit', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ data: { token: token, response: resp, name: name } })
});
var data = await r.json();
if (data && data.error) { showError(...); return; }
if (data && data.result && data.result.expired) { renderExpired(); return; }
```

Phase 27 extends this to:
1. Pass `guestId` from `localStorage.getItem('qn_guest_' + token)` (may be null on first submit).
2. On success, stash returned `guestId` in `localStorage.setItem('qn_guest_' + token, data.result.guestId)`.
3. Call `startStatusPoll(token, guestId)` after successful RSVP.

**guestId localStorage pattern — new for Phase 27:**
```js
// Read at top of IIFE (before any submit)
var GUEST_KEY = 'qn_guest_' + token;
var guestId = localStorage.getItem(GUEST_KEY) || null;

// Write after successful RSVP response
if (data.result && data.result.guestId) {
  localStorage.setItem(GUEST_KEY, data.result.guestId);
  guestId = data.result.guestId;
}
```

**renderConfirmation extension pattern** (lines 72–90):
New blocks are appended INSIDE `.rsvp-confirmation` div, ABOVE `.rsvp-install-cta`, by extending the
`renderConfirmation` function's HTML string. Order: eyebrow → title → sub → [count-line] → [push-block] → privacy-footer → install-cta.

**renderExpired as template for renderRevoked / renderClosed** (lines 92–98):
```js
// Existing expired pattern — mirrors new revoked/closed states exactly
function renderExpired() {
  contentEl.innerHTML =
    '<div class="rsvp-expired">' +
      '<div class="rsvp-expired-title"><em>This invite has expired.</em></div>' +
      '<div class="rsvp-expired-sub">Ask the host to send a fresh link.</div>' +
    '</div>';
}
```
`renderRevoked()` and `renderClosed()` follow this verbatim pattern, replacing class names and copy.
After `innerHTML` is set, move focus to the title element (accessibility — see UI-SPEC §1e):
```js
const titleEl = contentEl.querySelector('.rsvp-evicted-title');
if (titleEl) { titleEl.setAttribute('tabindex', '-1'); titleEl.focus(); }
```

**30s polling pattern — new for Phase 27 (RESEARCH Q4):**
```js
function startStatusPoll(token, guestId) {
  setInterval(async () => {
    try {
      const r = await fetch(CF_BASE + '/rsvpStatus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: { token: token, guestId: guestId } })
      });
      const d = await r.json();
      if (d && d.result && d.result.revoked) renderRevoked();
      if (d && d.result && d.result.closed)  renderClosed();
    } catch(e) { /* polling failure is silent — next tick will retry */ }
  }, 30_000);
}
```
Call `startStatusPoll()` immediately after the successful RSVP `localStorage.setItem`.

**Push feature-detect + opt-in pattern — new for Phase 27 (RESEARCH Q1):**
```js
var pushSupported =
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;
```
Render the `.rsvp-push-block` HTML ONLY when `pushSupported === true`. If false, the block is absent
entirely (see UI-SPEC §1c — absence IS the graceful iOS degradation; no fallback copy needed).

**VAPID key constant — new for Phase 27 (RESEARCH Risk 7):**
```js
var VAPID_PUBLIC_KEY = '<value from queuenight/functions/.env VAPID_PUBLIC>';
```
Declare at top of IIFE alongside `CF_BASE`. This key is public-by-design (same posture as TMDB key and Firebase config in app.html).

**Privacy footer injection — new for Phase 27 (D-05):**
The footer must appear in BOTH `renderInviteForm()` and `renderConfirmation()`. In `renderInviteForm()`, append after the `.rsvp-actions` div; in `renderConfirmation()`, append before `.rsvp-install-cta`.
```js
'<p class="rsvp-privacy-footer">' +
  'By tapping going/maybe/no, you agree to our ' +
  '<a href="/privacy" class="rsvp-privacy-link">Privacy Policy</a>.' +
'</p>'
```

**Error handling pattern** (lines 125–141):
```js
// All CF calls: wrap in try/catch, call showError() on network failure,
// check data.error for CF-level errors, check data.result.* for business logic.
try { ... }
catch(e) {
  showError("Couldn't save — try again in a moment.");
  btns.forEach(function(b){ b.disabled = false; });
  btn.classList.remove('tapped');
}
```
Push opt-in errors are NOT shown via `showError()` — they replace the push button inline with a `role="status"` div (see UI-SPEC §1b States B/C/D). This keeps the RSVP surface clean.

**esc() / escapeAttr() helpers** (lines 144–150):
These are already defined at the bottom of the IIFE. All new string interpolation MUST use `esc()` for display content. Push subscription endpoint/keys are never rendered in HTML — no escaping needed there.

---

### `css/rsvp.css` (standalone styles, ~80 lines — extend at bottom)

**Analog:** `css/rsvp.css` itself (self-extension) + `css/app.css` lines 769–772 for chip variant pattern.

**Root token set** (lines 1–17):
All new Phase 27 rules must use these vars — `var(--bg)`, `var(--surface)`, `var(--ink)`, `var(--ink-warm)`,
`var(--ink-dim)`, `var(--accent)`, `var(--border)`, `var(--r-pill)`, `var(--brand-grad)`. rsvp.css
uses **literal px** for sizes (not CSS vars) — match this convention exactly.

**`.rsvp-expired` as pattern for `.rsvp-evicted` and `.rsvp-closed`** (line 53):
```css
.rsvp-expired { text-align: center; padding: 60px 20px; }
.rsvp-expired-title { font-family: 'Instrument Serif', 'Fraunces', serif; font-style: italic; font-size: 22px; color: var(--ink-warm); margin-bottom: 12px; }
.rsvp-expired-sub { font-size: 13px; color: var(--ink-dim); }
```
`.rsvp-evicted` and `.rsvp-closed` copy this block verbatim (same structure, different class names, same CSS values — per UI-SPEC §1e).

**`.rsvp-install-cta` as pattern for `.rsvp-push-btn`** (line 49):
```css
.rsvp-install-cta { display: inline-block; padding: 14px 28px; background: var(--surface); color: var(--ink); border: 1px solid var(--border); border-radius: var(--r-pill); font-weight: 700; text-decoration: none; min-height: 44px; }
.rsvp-install-cta:hover { border-color: rgba(232,160,74,0.45); }
```
`.rsvp-push-btn` mirrors this with `padding: 12px 24px` and `border: 1px solid rgba(232,160,74,0.45)` (accent-tinted) + `font-size: 15px; font-weight: 600; cursor: pointer`.

**`.rsvp-error` pattern for reuse** (line 52):
```css
.rsvp-error { background: rgba(196,69,54,0.10); border: 1px solid rgba(196,69,54,0.40); color: #e99a8e; padding: 12px 16px; border-radius: 8px; margin-bottom: 16px; font-size: 13px; }
```
This existing class is reused for the eviction state's error-surface (UI-SPEC §1e). No new red-tinted class needed.

**New classes to add to rsvp.css (append after line 61 / desktop media query):**
Per UI-SPEC §1a–1e:
- `.rsvp-count-line` — 13px, font-weight 600, `--ink-warm`, `margin-bottom: 20px`, `text-align: center`
- `.rsvp-push-block` — `background: #25201a; border: 1px solid var(--border); border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: center`
- `.rsvp-push-copy` — 15px, `--ink-warm`, `margin-bottom: 12px`
- `.rsvp-push-btn` — mirrors `.rsvp-install-cta` with accent border (see above)
- `.rsvp-push-done`, `.rsvp-push-blocked`, `.rsvp-push-err`, `.rsvp-push-unsupported` — inline state replacements; 13px `--ink-dim` (`.rsvp-push-done` uses 15px Instrument Serif italic `--ink-warm`)
- `.rsvp-privacy-footer` — 11px, `--ink-dim`, `text-align: center`, `margin-bottom: 20px`, `line-height: 1.5`
- `.rsvp-privacy-link` — `color: var(--accent); text-decoration: underline`
- `.rsvp-evicted` — same as `.rsvp-expired` (60px 20px padding, text-align center)
- `.rsvp-evicted-title` — Instrument Serif italic, 22px, `--ink-warm`, `margin-bottom: 12px`
- `.rsvp-evicted-sub` — 13px, `--ink-dim`
- `.rsvp-closed` / `.rsvp-closed-title` / `.rsvp-closed-sub` — same values as `.rsvp-evicted` family (per UI-SPEC §1e: "reuses `.rsvp-expired` style — same visual treatment as expired")

---

### `app.html` (~990 lines — locate watchparty roster region)

**Analog:** `app.html` itself. The markup for the watchparty roster is adjacent to the `.wp-participants-strip`
rendered by `renderParticipantTimerStrip`. No new HTML elements needed in `app.html` itself — guest chips
are injected by JS (as with all existing participant chips). The only `app.html` changes are:
1. Comment hook marking where the guest-count text is appended in `.wp-banner-meta`.
2. Comment hook marking where `.wp-rsvp-closed-pill` is inserted in `.wp-banner-body`.

Both are JS-driven — the markup template lives in `js/app.js` string literals.

---

### `css/app.css` (~2360 lines — append after line 771)

**Analog:** `css/app.css` lines 769–772 (`.wp-participant-chip` variants) and lines 2333–2335 (`.chip-badge.badge-guest`).

**Existing chip variant pattern** (lines 769–772):
```css
.wp-participant-chip{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;background:var(--surface);border:1px solid var(--border);border-radius:100px;flex-shrink:0;transition:opacity var(--t-quick)}
.wp-participant-chip.me{border-color:rgba(232,160,74,0.45);background:linear-gradient(135deg,rgba(232,160,74,0.08),transparent)}
.wp-participant-chip.paused{opacity:0.55}
.wp-participant-chip.joined{opacity:0.7}
```
Phase 27 adds `.wp-participant-chip.guest` and `.wp-participant-chip.guest .wp-participant-av` as the
next two rules in the same block (append after line 771).

**Existing badge pattern** (lines 2333–2335 — NO CHANGES NEEDED):
```css
.chip-badge { font-family: 'Inter', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.04em; padding: 2px 6px; border-radius: 4px; margin-left: 4px; text-transform: uppercase; vertical-align: middle; }
.badge-kid  { background: #f2a365; color: #1f1611; }
.badge-guest{ background: #7cb4a9; color: #0f1f1c; }
```
These classes are used as-is for the `<span class="chip-badge badge-guest">guest</span>` inside every guest chip.

**Existing `.link-btn` pattern for "Close RSVPs" control** (line 2344):
```css
.link-btn { background: transparent; border: none; color: var(--accent); font-family: 'Inter', sans-serif; font-size: 13px; cursor: pointer; padding: 6px 10px; border-radius: 6px; }
.link-btn:hover { background: var(--surface-2); }
```
The "Close RSVPs" affordance uses `.link-btn` as-is (per UI-SPEC §3).

**`.wp-banner-meta` for guest-count append** (line 733):
```css
.wp-banner-meta{font-size:var(--t-meta);color:var(--ink-dim)}
```
The "5 going · 2 guests" count text is appended to the existing `.wp-banner-meta` element via JS —
no new CSS class needed (inherits 13px `--ink-dim` automatically).

**New classes to add to app.css:**
Append after line 771 (in the wp-participant-chip block):
```css
/* Phase 27 — Guest chip variant */
.wp-participant-chip.guest {
  border-color: rgba(124, 180, 169, 0.35); /* badge-guest teal, 35% opacity */
}
.wp-participant-chip.guest .wp-participant-av {
  background: #5a8a84; /* fixed teal avatar for all guests */
}
```
Append in the Phase 5 Plan 07 block (after line 2345) or in a new Phase 27 block:
```css
/* Phase 27 — Guest kebab + closed-RSVPs pill */
.wp-guest-kebab { background: transparent; border: none; color: var(--ink-dim); font-size: 18px; cursor: pointer; min-width: 44px; min-height: 44px; display: grid; place-items: center; }
.wp-guest-kebab:hover { color: var(--ink); }
.wp-rsvp-closed-pill { display: inline-block; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; letter-spacing: 0.10em; text-transform: uppercase; color: var(--ink-dim); background: var(--surface-2); border: 1px solid var(--border); border-radius: 999px; padding: 4px 8px; margin-top: 4px; }
```

---

### `js/app.js` (feature logic — Grep + offset/limit only; NEVER read in full)

**Analog 1 — Guest chip render: `renderParticipantTimerStrip`** (lines 12156–12206):
```js
// Read first: js/app.js offset=12156 limit=51
function renderParticipantTimerStrip(wp) {
  const entries = Object.entries(wp.participants || {});
  if (!entries.length) return '';
  const chips = entries.map(([mid, p]) => {
    const member = state.members.find(m => m.id === mid);
    const name = (member && member.name) || p.name || 'Member';
    const color = (member && member.color) || '#888';
    const initial = (name || '?')[0].toUpperCase();
    // ... statusLabel, chipClass ...
    return `<div class="wp-participant-chip ${chipClass} ${isMe ? 'me' : ''}" data-member-id="${escapeHtml(mid)}">
      <div class="wp-participant-av${teamFlairClass}" style="${avStyle}" aria-hidden="true">${escapeHtml(initial)}</div>
      <div class="wp-participant-info">
        <div class="wp-participant-name">${escapeHtml(name)}...</div>
        <div class="wp-participant-time" data-role="pt-time">${escapeHtml(statusLabel)}</div>
        ${ontimeControl}
      </div>
    </div>`;
  }).join('');
  return `<div class="wp-participants-strip" role="list" aria-label="Watchparty participants">${chips}</div>`;
}
```
Guest chip render mirrors this pattern but:
- Uses `wp.guests || []` (array, not `Object.entries(wp.participants)`)
- Iterates `.map(guest => ...)` over the array
- Uses fixed avatar color `#5a8a84`, adds `class="guest"` modifier
- Applies D-04 name collision check: `familyMemberNames.has(guest.name.trim().toLowerCase()) ? guest.name + ' (guest)' : guest.name`
- Status slot shows response label: `{ yes: 'Going', maybe: 'Maybe', no: 'Not coming', undefined: 'Invited' }[guest.response]`
- Adds kebab button (host-only): `state.me && state.me.id === wp.hostId ? \`<button class="wp-guest-kebab"...\` : ''`
- Appended to the same `.wp-participants-strip` container, AFTER the member chips

`familyMemberNames` Set for collision check:
```js
const familyMemberNames = new Set(
  (state.members || []).map(m => (m.name || '').trim().toLowerCase())
);
```

**Analog 2 — Guest revoke: `removeMember`** (lines 6847–6859):
```js
// Read first: js/app.js offset=6847 limit=13
window.removeMember = async function(id) {
  if (!isCurrentUserParent()) { flashToast('...', { kind: 'warn' }); return; }
  if (!confirm('Remove this family member?')) return;
  try { await deleteDoc(doc(membersRef(), id)); }
  catch(e) { flashToast('Could not remove. Try again.', { kind: 'warn' }); }
};
```
`window.revokeGuest(guestId)` mirrors this pattern:
- Host-only guard: `if (!state.me || state.me.id !== currentWp.hostId) return;`
- No confirm() needed (soft-delete, not data loss — per UI-SPEC §2b)
- Calls `httpsCallable(functions, 'rsvpRevoke')` instead of `deleteDoc`
- On success: `flashToast('Removed.', { kind: 'success' })`
- On failure: `flashToast('Couldn\'t remove ' + name + '. Try again.', { kind: 'warn' })`

**Analog 3 — httpsCallable CF call pattern** (lines 4395–4426):
```js
// Read first: js/app.js offset=4395 limit=32
window.createGuestInvite = async function() {
  try {
    const fn = httpsCallable(functions, 'inviteGuest');
    const r = await fn({ familyCode: state.familyCode, durationMs: duration });
    if (r.data && r.data.ok) {
      flashToast('Invite link ready', { kind: 'success' });
    }
  } catch(e) {
    console.error('[invite-guest]', e);
    const code = e && e.code;
    const msg = (code === 'permission-denied' || code === 'functions/permission-denied')
      ? 'Only the owner can invite guests.'
      : "Couldn't generate invite.";
    flashToast(msg, { kind: 'warn' });
  }
};
```
`window.closeRsvps()` and `window.revokeGuest()` follow the same try/catch + httpsCallable pattern.
Note: `rsvpRevoke` and `rsvpClose` are **unauthenticated onCall** CFs (same as `rsvpSubmit`) but called
from app.html where `functions` IS initialized (Firebase SDK is already present in app.html via `js/firebase.js`).

**Analog 4 — `openGuestMenu` pattern (new function):**
Closest analog is the existing wp-lead-btn popover or any other small anchor popover in app.js. However
the simplest implementation for Phase 27 is a tiny inline menu that appears on kebab click using the
existing `.popover-menu` or custom small `<ul>` positioned absolutely. The planner should check:
```bash
grep -n "popover\|kebab\|data-menu\|openMenu" js/app.js | head -20
```
before writing this function, to find the existing menu-open pattern.

---

### `queuenight/functions/src/rsvpSubmit.js` (CF, unauth onCall — extend in place)

**Analog:** `rsvpSubmit.js` itself (self-extension). The entire existing file is the pattern.

**Existing structure to preserve** (full file, 129 lines):
- Lines 1–46: Module header + `'use strict'` + requires + `admin.initializeApp()` guard + `guestKeyFor` + `looksLikeWpId`
- Lines 47–53: `onCall` export with CORS config (`cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app']`), memory, timeout
- Lines 54–66: Input validation block (`looksLikeWpId`, `response` enum, `cleanName` trim+slice)
- Lines 71–89: Family-scan loop (Firestore read, `token === wpId for v1`)
- Lines 91–101: Expiry + status gate (currently uses hardcoded 6h — **Phase 27 changes to `WP_ARCHIVE_MS`**)
- Lines 103–128: Guest key + participants write + hostName resolution + return

**Phase 27 changes to rsvpSubmit.js:**
1. Add `guestId` to destructured params (line 53, additive):
   ```js
   const { token, response, name, guestId } = (request.data || {});
   ```
2. After expiry gate: add `wp.rsvpClosed` gate:
   ```js
   if (wp.rsvpClosed) return { closed: true };
   ```
3. After guest cap check (new — soft cap at 100):
   ```js
   const currentGuests = wp.guests || [];
   if (!guestId && currentGuests.filter(g => !g.revoked).length >= 100) {
     return { guestCapReached: true };
   }
   ```
4. Replace lines 102–112 (participants map write) with `runTransaction` read-modify-write (RESEARCH Q2):
   ```js
   // runTransaction: upsert guest in wp.guests[] array (D-03 idempotency)
   let mintedGuestId = null;
   await db.runTransaction(async (tx) => {
     const wpSnap = await tx.get(wpRef);
     const guests = (wpSnap.data().guests || []).slice();
     const existingIdx = guestId ? guests.findIndex(g => g.guestId === guestId) : -1;
     const WP_ARCHIVE_MS = 5 * 3600 * 1000; // 5h — matches D-02 / js/constants.js WP_ARCHIVE_MS
     const expiresAt = (wpSnap.data().startAt || Date.now()) + WP_ARCHIVE_MS;
     if (existingIdx === -1) {
       mintedGuestId = require('crypto').randomBytes(16).toString('base64url');
       guests.push({ guestId: mintedGuestId, name: cleanName || 'Guest',
                     response, rsvpAt: Date.now(), expiresAt, pushSub: null });
     } else {
       guests[existingIdx] = { ...guests[existingIdx], response, rsvpAt: Date.now() };
       mintedGuestId = guestId;
     }
     const guestCount = guests.filter(g => !g.revoked).length;
     tx.update(wpRef, { guests, guestCount });
   });
   ```
5. Change return: `return { success: true, hostName, guestId: mintedGuestId }`.
6. Update expiry TTL from `6 * 3600 * 1000` to `WP_ARCHIVE_MS` (same constant used above).

**Error handling pattern** (lines 57–65): All input validation throws `HttpsError('invalid-argument', '...')`. Business-logic non-errors return `{ expired: true }`, `{ closed: true }`, etc. — not throws.

---

### `queuenight/functions/src/rsvpReminderTick.js` (CF, scheduled — extend in place)

**Analog:** `rsvpReminderTick.js` itself (self-extension). RESEARCH.md Q6 provides the exact code.

**Existing structure to preserve** (full file, 183 lines):
- Lines 1–55: Header + constants (`WINDOWS`, `SLOP_MINUTES`, `fmt`)
- Lines 57–72: `onSchedule` export + lazy `sendToMembers` require
- Lines 73–180: Family scan + wp loop + members iteration + atomic-flag-before-send + send loop

**Phase 27 addition — second loop over `wp.guests[]`** (insert AFTER line 138, within the per-wp block, BEFORE `if (!sends.length) continue;`):

```js
// Phase 27 — Guest reminder loop
// Read sendToMembers source: queuenight/functions/index.js offset=282 limit=58
const webpush = require('web-push'); // already initialized via configureWebPush in index.js
const guests = wp.guests || [];
const guestSends = [];
for (const guest of guests) {
  if (!guest || !guest.guestId) continue;
  if (guest.revoked) continue;
  if (!guest.pushSub) continue;

  let resp = 'notResp';
  if (guest.response === 'yes')   resp = 'yes';
  if (guest.response === 'maybe') resp = 'maybe';
  if (guest.response === 'no')    resp = 'no';

  const windows = WINDOWS[resp] || [];
  for (const w of windows) {
    const distance = Math.abs(minutesBefore - w.minutesBefore);
    if (distance > SLOP_MINUTES) continue;
    const alreadySent = reminders[guest.guestId] && reminders[guest.guestId][w.key];
    if (alreadySent) { totalSkipped++; continue; }
    const body = fmt(w.body, { title: titleName, host: hostName, day, time });
    guestSends.push({ guestId: guest.guestId, pushSub: guest.pushSub,
                      title: w.title, body, key: w.key });
    updates[`reminders.${guest.guestId}.${w.key}`] = true;
  }
}
```

**webpush.sendNotification pattern — direct (not via sendToMembers)** — from `index.js` lines 320–336:
```js
// For each guestSend, after the atomic flag update:
for (const gs of guestSends) {
  try {
    const payloadStr = JSON.stringify({
      title: gs.title, body: gs.body,
      tag: `wp-rsvp-guest-${doc.id}-${gs.guestId}-${gs.key}`,
      url: `/rsvp/${doc.id}`
    });
    await webpush.sendNotification(gs.pushSub, payloadStr);
    totalSent++;
  } catch (err) {
    const code = err.statusCode;
    if (code === 410 || code === 404) {
      // Dead sub — prune from wp.guests[i].pushSub via read-modify-write
      // (same runTransaction pattern as rsvpSubmit — RESEARCH Q6 dead-sub pruning)
      try {
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(doc.ref);
          const gs2 = (snap.data().guests || []).slice();
          const idx = gs2.findIndex(g => g.guestId === gs.guestId);
          if (idx !== -1) { gs2[idx] = { ...gs2[idx], pushSub: null }; tx.update(doc.ref, { guests: gs2 }); }
        });
      } catch (pruneErr) { /* non-fatal */ }
    } else {
      console.warn('rsvpReminderTick: guest webpush error', code, err.body);
    }
  }
}
```

NOTE: `webpush` requires initialization before first call. Since `rsvpReminderTick.js` lazy-requires
`sendToMembers` from `index.js` (which calls `configureWebPush()`), the VAPID details are set by the
`index.js` module-load side-effect. If calling `webpush.sendNotification` directly in this file, add:
```js
const webpush = require('web-push'); // top of file
```
and ensure `sendToMembers` is still required first so `configureWebPush()` runs. Alternatively, export a
`configureWebPush` helper from `index.js` and call it explicitly. The lazy-require pattern on line 65–71
already guarantees `index.js` is loaded before any send path executes.

---

### NEW: `queuenight/functions/src/rsvpStatus.js` (new CF — polling endpoint)

**Analog:** `rsvpSubmit.js` (same module type: unauthenticated onCall, same admin SDK pattern, same family-scan pattern).

**Copy from `rsvpSubmit.js`:**
- Lines 24–31: `'use strict'`, requires, `admin.initializeApp()` guard
- Lines 43–50: `onCall` export with same CORS config, `memory: '256MiB'`, `timeoutSeconds: 30`
- Lines 54–89: Input validation (`looksLikeWpId`) + family scan loop (identical)

**Core pattern (simplified — read-only):**
```js
exports.rsvpStatus = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => {
  const { token, guestId } = (request.data || {});
  if (!looksLikeWpId(token)) throw new HttpsError('invalid-argument', 'Invalid token.');

  // Family scan — same pattern as rsvpSubmit.js lines 71–89
  // ... (copy verbatim from rsvpSubmit.js) ...

  const wp = wpDoc.data();
  const now = Date.now();
  const WP_ARCHIVE_MS = 5 * 3600 * 1000;
  if (wp.startAt && now > wp.startAt + WP_ARCHIVE_MS) return { expired: true };
  if (wp.state === 'ended' || wp.status === 'ended') return { expired: true };

  // Guest-specific status (D-07)
  let revoked = false;
  if (guestId) {
    const guest = (wp.guests || []).find(g => g.guestId === guestId);
    if (guest && guest.revoked) revoked = true;
  }
  return {
    revoked,
    closed: !!wp.rsvpClosed,
    guestCount: (wp.guests || []).filter(g => !g.revoked).length
  };
});
```
Wire into `index.js` alongside the other exports:
```js
exports.rsvpStatus = require('./src/rsvpStatus').rsvpStatus;
```

---

### `queuenight/functions/index.js` (CF entry — export wiring only)

**Analog:** `index.js` lines 1627–1632 (existing `rsvpReminderTick` + `sendToMembers` export block):
```js
// Read first: queuenight/functions/index.js offset=1627 limit=6
// rsvpReminderTick lazy-requires sendToMembers from this module — export it below.
// Expose sendToMembers so src/rsvpReminderTick.js can reuse the existing push
// delivery helper (VAPID config, pref gate, quiet-hours gate, dead-sub pruning).
exports.sendToMembers = sendToMembers;
```
Phase 27 adds two lines after the existing exports:
```js
exports.rsvpRevoke  = require('./src/rsvpRevoke').rsvpRevoke;
exports.rsvpStatus  = require('./src/rsvpStatus').rsvpStatus;
```
`rsvpSubmit` is already exported — no change needed to that export.

---

### `firestore.rules` (security rules — comment addition + no rule changes)

**Analog:** `firestore.rules` lines 577–603 (watchparty rules block) and the admin-SDK bypass comment block.

**Watchparty rules block** (lines 577–603):
```
match /watchparties/{wpId} {
  allow read: if isMemberOfFamily(familyCode);
  allow create: if attributedWrite(familyCode);
  allow update: if attributedWrite(familyCode) && (
    // Path A: host-only fields
    // Path B: non-host fields (no touch of currentTimeMs, videoUrl, hostId, etc.)
  );
  allow delete: if isOwner(familyCode) || ...;
}
```
**Phase 27 change:** Admin SDK CF writes bypass these rules entirely (RESEARCH Q2, confirmed). No rule changes are needed for `wp.guests[]` writes. The only change needed is a comment clarifying this:
```
// Phase 27: wp.guests[] + wp.guestCount + wp.rsvpClosed are written by admin-SDK CFs
// (rsvpSubmit, rsvpRevoke, rsvpStatus). Admin SDK bypasses all rules — no client-side
// guest-array mutation is possible via these rules.
```
Insert this comment inside the `match /watchparties/{wpId}` block before `allow read`.

**wp.rsvpClosed client write:** The host sets `wp.rsvpClosed: true` from app.html via a CF call (not a direct client Firestore write). The CF uses admin SDK. If the planner chooses to allow direct client write of `rsvpClosed` (simpler, no extra CF), then Path A (host-only fields) in the existing rules must be extended to include `rsvpClosed` — but this is NOT recommended (prefer CF to maintain consistent state with `guestCount` denorm).

**Client write rejection test (RSVP-27-06):** The `anon` client attempting to write `guests` or `rsvpClosed` to the wp doc will be denied by the existing rules (anon writes to watchparties are denied by `attributedWrite` which requires auth). This is already covered — no new rule needed.

---

### `tests/rules.test.js` (test — extend with Phase 27 describe block)

**Analog:** `tests/rules.test.js` lines 1–248 (full harness, `seed()`, `describe`/`it` pattern, `assertFails`/`assertSucceeds`).

**Harness pattern** (lines 33–47):
```js
// Read first: tests/rules.test.js offset=33 limit=15
async function it(name, fn) {
  try { await fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (err) { console.error(`  ✗ ${name}`); console.error(`      ${err.message}`); failed++; }
}
async function describe(name, fn) {
  console.log(`\n${name}`);
  await fn();
}
```

**Seed pattern** (lines 50–121): New Phase 27 describe block needs a seeded wp doc with `guests: []` and `rsvpClosed: false`. The Phase 24 seed doc (`wp_phase24_test`, line 104) is the model — add `guests: []`, `guestCount: 0`, `rsvpClosed: false` fields to it (or add a second seed doc `wp_phase27_test`).

**Phase 27 describe block to add** (append in the `run()` function after existing describes):
```js
await describe('Phase 27 Guest RSVP rules', async () => {
  await it('#N anon client write to wp.guests → DENIED', async () => {
    await assertFails(
      anon.doc('families/fam1/watchparties/wp_phase27_test')
        .update({ guests: [] })
    );
  });

  await it('#N+1 family member read of wp doc includes guests array → ALLOWED', async () => {
    await assertSucceeds(
      member.doc('families/fam1/watchparties/wp_phase27_test').get()
    );
  });

  await it('#N+2 host (UID_OWNER) can set rsvpClosed via Path A update → ALLOWED', async () => {
    await assertSucceeds(
      owner.doc('families/fam1/watchparties/wp_phase27_test')
        .update({ rsvpClosed: true })
    );
  });

  await it('#N+3 non-host member CANNOT directly write guests field → DENIED', async () => {
    await assertFails(
      member.doc('families/fam1/watchparties/wp_phase27_test')
        .update({ guests: [{ guestId: 'fake', name: 'Hacker' }] })
    );
  });
});
```
Note: `rsvpClosed` is a host-only field (Path A in existing rules allows host to update any field). The
member test (#N+3) relies on the existing Path B guard: `guests` is not in the host-only-locked list, but
since it's not an `attributedWrite` field either (requires auth on the family), the `anon` test (#N) is
the critical one. For authenticated non-host writes, check whether `guests` needs to be added to the
Path B forbidden list — see RESEARCH Q2 note that says "Unauthenticated client CANNOT write `wp.guests`
field directly (rules deny)". The planner should verify the exact rules behavior with the existing
`attributedWrite` check.

---

### `scripts/smoke-guest-rsvp.cjs` (NEW smoke contract)

**Analog:** `scripts/smoke-availability.cjs` (full file, 186 lines — read it completely).

**Module pattern** (lines 1–38):
```js
// Full graceful-skip pattern — copy verbatim, change QUEUENIGHT_INDEX path and
// the exported symbols being required
'use strict';
const fs = require('fs');
const path = require('path');

const QUEUENIGHT_INDEX = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions', 'index.js');

if (!fs.existsSync(QUEUENIGHT_INDEX)) {
  console.log('SKIP: queuenight sibling repo not found at ' + QUEUENIGHT_INDEX);
  process.exit(0);
}

let mod;
try {
  mod = require(QUEUENIGHT_INDEX);
} catch (e) {
  console.error('FAIL: require(...) threw: ' + (e && e.message));
  process.exit(1);
}
```

**Test helper pattern** (lines 43–86): Use the same `eq`/`eqObj` helpers (copy verbatim). Add a `eqArr` helper for array equality if needed.

**Assertions to include** (per RESEARCH.md Wave 0 Gaps):
1. `guestId` format validation — 16-byte base64url produces 22–24 char string matching `/^[A-Za-z0-9_-]{21,24}$/`
2. Name-collision render logic — `(guest)` suffix only when name is in `familyMemberNames` Set
3. Response normalization for reminder cadence — `'yes'` → `'yes'`, `undefined` → `'notResp'`
4. Guest-count helper — counting non-revoked entries from `wp.guests[]`

These are pure helpers exported from `index.js` or computed inline. The planner must decide whether to
export them as named helpers from `index.js` (like `addedBrandsFor`, `buildPushBody` in Phase 18) or
test them via fixture data. Recommend extracting as helpers for testability.

**package.json wiring** (after last `smoke:*` entry, line 17):
```json
"smoke:guest-rsvp": "node scripts/smoke-guest-rsvp.cjs"
```
And add `&& node scripts/smoke-guest-rsvp.cjs` to the `smoke` aggregate (line 8).

---

### `sw.js` (service worker — CACHE bump only)

**Analog:** `sw.js` line 8 (current CACHE value: `couch-v38-async-replay`).

**Pattern** (line 8):
```js
const CACHE = 'couch-v38-async-replay';
```
This is auto-bumped by `bash scripts/deploy.sh <short-tag>` — the planner should specify the deploy
command as `bash scripts/deploy.sh 39-guest-rsvp` and document that this produces `couch-v39-guest-rsvp`
(or whatever the next version number is). Do NOT manually edit this line — the deploy script handles it.

---

## Shared Patterns

### Admin SDK + `runTransaction` for array upsert
**Source:** `queuenight/functions/src/rsvpSubmit.js` (Phase 27 new pattern, templated from RESEARCH Q2)
**Apply to:** `rsvpSubmit.js` (upsert), `rsvpReminderTick.js` (dead-sub prune), `rsvpRevoke.js` (soft-delete)

The critical constraint is that `FieldValue.arrayUnion` cannot update object elements (RESEARCH Q2 Risk 2).
ALL `wp.guests[]` mutations that touch an existing entry must use `runTransaction`:
```js
await db.runTransaction(async (tx) => {
  const snap = await tx.get(wpRef);
  const guests = (snap.data().guests || []).slice(); // shallow copy
  const idx = guests.findIndex(g => g.guestId === guestId);
  if (idx !== -1) {
    guests[idx] = { ...guests[idx], /* mutation fields */ };
    tx.update(wpRef, { guests, guestCount: guests.filter(g => !g.revoked).length });
  }
});
```

### onCall CORS config
**Source:** `queuenight/functions/src/rsvpSubmit.js` lines 47–50
**Apply to:** `rsvpStatus.js` (new), any `rsvpRevoke.js` (new)

All new unauthenticated CFs must use the same CORS allowlist:
```js
cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app']
```

### Token-as-wpId assumption
**Source:** `queuenight/functions/src/rsvpSubmit.js` lines 68–89 (comment + family-scan loop)
**Apply to:** `rsvpStatus.js`, `rsvpRevoke.js`

All RSVP-related CFs look up the wp doc via `db.collection('families').doc(familyCode).collection('watchparties').doc(token)`. Token IS the wpId for v1. There is no separate invite doc for watchparty RSVPs (RESEARCH Q2 Risk 3).

### flashToast + httpsCallable error pattern
**Source:** `js/app.js` lines 4395–4426 (createGuestInvite)
**Apply to:** All new `window.*` functions in app.js that call RSVP CFs

```js
try {
  const fn = httpsCallable(functions, 'rsvpRevoke');
  const r = await fn({ token: wpId, guestId });
  if (r.data && r.data.ok) { flashToast('Removed.', { kind: 'success' }); }
} catch(e) {
  console.error('[rsvp-revoke]', e);
  flashToast("Couldn't remove " + name + ". Try again.", { kind: 'warn' });
}
```

### Smoke graceful-skip pattern
**Source:** `scripts/smoke-availability.cjs` lines 19–26
**Apply to:** `scripts/smoke-guest-rsvp.cjs`

Copy the `QUEUENIGHT_INDEX` path resolution and `fs.existsSync` exit-0 pattern verbatim.

---

## No Analog Found

All files have close analogs. No entries.

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\claude-projects\couch\` (couch repo)
- `C:\Users\nahde\queuenight\functions\` (queuenight sibling repo)

**Files scanned:**
- `rsvp.html` (154 lines — full read)
- `css/rsvp.css` (66 lines — full read)
- `queuenight/functions/src/rsvpSubmit.js` (129 lines — full read)
- `queuenight/functions/src/rsvpReminderTick.js` (183 lines — full read)
- `queuenight/functions/src/inviteGuest.js` (95 lines — full read)
- `queuenight/functions/index.js` (1669 lines — Grep + targeted reads: lines 1–45, 280–339)
- `js/app.js` (~15800 lines — Grep + targeted reads: lines 6510–6529, 6847–6878, 4395–4426, 12156–12215)
- `css/app.css` (~2360 lines — Grep + targeted reads: lines 728–742, 2330–2349)
- `tests/rules.test.js` (targeted read lines 1–248)
- `scripts/smoke-availability.cjs` (186 lines — full read)
- `sw.js` (lines 1–20)
- `firestore.rules` (Grep + targeted read lines 575–610)
- `package.json` (20 lines — full read)

**Pattern extraction date:** 2026-05-01
