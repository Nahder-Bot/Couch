---
phase: 27-guest-rsvp
type: research
created: 2026-05-01
status: complete
---

# Phase 27: Guest RSVP — Research

**Researched:** 2026-05-01
**Domain:** Token-based RSVP for non-member guests — Firestore array schema, admin-SDK CF migration, web push on iOS, document size budget
**Confidence:** HIGH (all six open questions resolved from direct code inspection + official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01** — Guest schema = `wp.guests[]` array on watchparty doc + `wp.guestCount` denorm. RSVP-signal-only surface. No `members[].temporary`.
- **D-02** — Token TTL = `wp.startAt + WP_ARCHIVE_MS`.
- **D-03** — Identity continuity = `localStorage` key `qn_guest_<token>` storing a minted `guestId`.
- **D-04** — Name collision = `(guest)` suffix at render time only; storage unchanged.
- **D-05** — Privacy = one-line footer link to existing `/privacy` page.
- **D-06** — Web push opt-in on rsvp.html post-RSVP. iOS limitation (must install PWA) is acceptable for v1. Render graceful "Push not supported on this device" state. Reminder cadence matches member cadence.
- **D-07** — Revoke = soft-delete `wp.guests[i].revoked: true`. Secondary `wp.rsvpClosed: true` flag to close all RSVPs.

### Claude's Discretion
- Where the "remove" control lives in the roster UI (long-press / kebab, mirror member-remove pattern).
- `guestId` format — 16-byte URL-safe base64.
- `wp.guests[]` count cap — CF-level rate limiting, optional soft cap of ~50.
- Web push subscription storage shape (`wp.guests[i].pushSub` as FCM sub object directly).
- `rsvpClosed: true` vs deleting invite doc (research recommends `rsvpClosed: true`).
- Listener strategy on rsvp.html — research recommends 30s polling over Firestore SDK for cold-load.

### Deferred Ideas (OUT OF SCOPE)
- Guest post-archive replay reactions (Phase 26 territory).
- Guest-to-member conversion (Phase 5x territory).
- Multi-wp guest session (Phase 27.x or later).
- Email-based reminders.
- Calendar invite (.ics file) on RSVP.
</user_constraints>

---

## Summary

Phase 27 builds on a fully-functional Phase 11 RSVP surface (`rsvp.html` + `rsvpSubmit` CF + `rsvpReminderTick` CF). The critical schema difference is that **Phase 11 currently writes guests into `wp.participants.{guestKey}` (a map), while Phase 27 requires a new `wp.guests[]` array** — these are different data structures and the migration is additive (old participant-map entries remain valid; Phase 27 CF logic writes to the new array and ignores old `participants` map entries for guests). All CF writes use the admin SDK, which bypasses Firestore rules entirely — no rules changes are needed to enable `wp.guests[]` writes.

iOS web push remains PWA-install-gated with no workaround. Chrome on iOS, Chrome on Android, and all desktop browsers work without install. The fallback "Push not supported" render path is essential and should be the first-render assumption for anonymous link openers. Document-size analysis confirms the `wp.guests[]` array with 50 guests and full push subscriptions adds approximately 29KB to the wp doc — well within the 1MB limit even with 200+ Phase 26 reactions present.

The `rsvpReminderTick` CF currently iterates `wp.participants` and skips entries with `isGuest: true`. Phase 27 adds a parallel loop over `wp.guests[]` filtering for entries with `pushSub` set. The idempotency pattern (`wp.reminders[guestId][windowKey]`) is already used for member participant IDs and will work identically for guest IDs with no redesign.

**Primary recommendation:** Keep `rsvp.html` zero-SDK for cold load. Add the Firestore listener post-RSVP via dynamic `<script>` injection (defer SDK weight until user has already engaged). Use `wp.rsvpClosed: true` flag (not invite-doc deletion) for the secondary close-RSVPs control.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|---|---|---|---|
| RSVP form submission | `rsvp.html` client | `rsvpSubmit` CF | Unauthenticated form submit; CF does token validation + atomic write |
| Guest identity continuity | `rsvp.html` client (localStorage) | — | D-03: guestId minted and persisted client-side per-token |
| Guest schema write | `rsvpSubmit` CF (admin SDK) | — | Admin SDK bypasses rules; all guest state lives on wp doc |
| Real-time eviction detection | `rsvp.html` client (post-RSVP listener) | — | Lazy-loaded Firestore listener injected after first RSVP tap |
| Push subscription capture | `rsvp.html` client | `rsvpSubmit` CF (stores sub) | Browser PushManager → CF stores on `wp.guests[].pushSub` |
| Push reminder dispatch | `rsvpReminderTick` CF (scheduled) | — | Extends existing member-reminder loop to iterate `wp.guests[]` |
| Guest revocation | app.html host UI | `rsvpRevoke` CF (or rsvpSubmit extended) | Host tap → CF soft-deletes `wp.guests[i].revoked: true` |
| Close-RSVPs control | app.html host UI | `rsvpSubmit` CF (gate on rsvpClosed) | Sets `wp.rsvpClosed: true`; rsvpSubmit checks this flag on each call |
| Name-collision render | app.html member roster + rsvp.html confirmation | — | D-04: render-time suffix only; no storage impact |
| Privacy disclosure | `rsvp.html` footer | — | D-05: static one-liner link |

---

## Open Question Investigations

### Q1 — iOS Safari Web Push Reality Check

**Findings:**

iOS 16.4+ introduced web push support, but it requires the site to be added to the Home Screen as a PWA first. This is a hard platform constraint that applies to ALL browsers on iOS — Chrome iOS, Firefox iOS, Edge iOS all use the same WKWebView rendering engine and share the same PWA install requirement. There is no way to get web push on iOS without the Add to Home Screen step. [VERIFIED: webkit.org/blog/13878]

The install-friction path on iOS:
1. User opens RSVP link in Safari.
2. To receive push: user must tap Share → "Add to Home Screen" → confirm → open from home screen → only then can the app call `Notification.requestPermission()`.
3. For a one-shot guest following an iMessage link, this 5-step flow will have very low completion rate. The vast majority of iOS guests will see the "Push not supported on this device" state.

**Non-iOS platforms (no install required):**
- Android Chrome: web push works immediately from the browser, no install needed. [VERIFIED: web search + official docs]
- Desktop Safari 16+: web push works without install (macOS Ventura+, Safari 16+). [VERIFIED: webkit.org/blog/13878]
- Desktop Chrome/Firefox/Edge: standard web push, no install needed.

**Render strategy for "Push not supported":**

The `Notification` API and `PushManager` are the reliable feature-detect gates:

```js
const pushSupported =
  'Notification' in window &&
  'serviceWorker' in navigator &&
  'PushManager' in window;
```

On iOS Safari (non-PWA), `PushManager` is absent. The opt-in CTA should:
- Default to showing "Get reminded when the party starts?" button.
- After tap: check `pushSupported`. If false → show "Push reminders aren't available in this browser. Ask {hostName} to message you directly." inline, no error state.
- If true → call `Notification.requestPermission()`. On `'denied'` → similar inline message.

**Recommendation:** Treat iOS non-PWA as the expected path for most iPhone guests. The "Push not supported" state is the primary path, not a fallback. Design the confirmation screen to be complete and satisfying without push — push opt-in is an enhancement, not the default CTA.

---

### Q2 — Firestore Rules for `wp.guests[]` Writes

**Findings:**

The `rsvpSubmit` CF (and all CFs in queuenight/functions) use the Firebase Admin SDK initialized via `admin.initializeApp()`. Admin SDK writes bypass Firestore security rules entirely — this is a Firebase platform guarantee, not project-specific configuration. [VERIFIED: firebase.google.com/docs/firestore/security/get-started — "Server client libraries ... bypass all Cloud Firestore Security Rules"]

The existing `firestore.rules` watchparty block (Phase 24 tightening) grants:
- `allow create: if attributedWrite(familyCode)` — members only
- `allow update: if attributedWrite(familyCode) && (Path A: host-only fields || Path B: non-host allowed fields)`

Neither the create nor the update rules mention `wp.guests[]`. This is not a problem: the `rsvpSubmit` and new `rsvpRevoke` CFs use admin SDK → rules are not evaluated → `wp.guests[]` array writes succeed unconditionally. [VERIFIED: direct inspection of `queuenight/functions/src/rsvpSubmit.js` lines 30-32 + `rsvpReminderTick.js` lines 28-30 — both call `admin.initializeApp()`]

**ArrayUnion / ArrayRemove gotcha with object elements:**

`FieldValue.arrayUnion()` and `FieldValue.arrayRemove()` work with objects, but removal requires **exact deep-equal matching** of the entire object. This makes `arrayRemove()` unusable for updating existing guest entries (e.g., changing `response`, setting `revoked: true`, or adding `pushSub`). [VERIFIED: firebase/firebase-js-sdk issue #1918 + Firestore official docs]

**Implication for Phase 27 CF writes:**

All `wp.guests[]` mutations that modify an existing guest entry require **read-modify-write** using `transaction()` or `runTransaction()`:

```js
// Pattern: read-modify-write for guest upsert (used by rsvpSubmit for repeat submits)
await db.runTransaction(async (tx) => {
  const wpSnap = await tx.get(wpRef);
  const guests = (wpSnap.data().guests || []);
  const idx = guests.findIndex(g => g.guestId === guestId);
  if (idx === -1) {
    guests.push({ guestId, name, response, rsvpAt: Date.now(), expiresAt, pushSub: null });
  } else {
    guests[idx] = { ...guests[idx], response, rsvpAt: Date.now() };
  }
  tx.update(wpRef, { guests, guestCount: guests.filter(g => !g.revoked).length });
});
```

**New guest append** (first RSVP, no prior entry) CAN use `FieldValue.arrayUnion()` since the element is new:

```js
// Safe for first RSVP only — no matching element exists yet
await wpRef.update({
  guests: admin.firestore.FieldValue.arrayUnion({ guestId, name, response, ... })
});
```

But because `rsvpSubmit` must handle both first and repeat submits (D-03 continuity), a transaction is always required for correctness. The additional Firestore read cost is one read per rsvpSubmit call — acceptable given the low frequency of RSVP submissions.

**Soft-delete (`revoked: true`) is a modify-in-place operation** — requires read-modify-write. This is the same pattern.

**`wp.rsvpClosed: true` vs deleting invite doc:**

Recommendation: use `wp.rsvpClosed: true` flag on the watchparty doc. Reasons:
1. The RSVP token IS the `wpId` in Phase 11 (line 68 of `rsvpSubmit.js`: "token === wpId for v1"). There is no separate invite doc for watchparty RSVPs (unlike Phase 5x family guest invites which have `families/{code}/invites/{token}`). Deleting a non-existent doc would be a no-op.
2. `wp.rsvpClosed: true` is a single atomic field on the wp doc already being read by `rsvpSubmit`. Zero extra reads.
3. Preserves the audit trail — the watchparty doc exists and the RSVP-closed state is visible to the host.

`rsvpSubmit` checks the flag at the top of its validation block and returns `{ closed: true }` if set.

---

### Q3 — `rsvpSubmit` CF Backward Compatibility

**Current CF signature (Phase 11):**

```js
const { token, response, name } = (request.data || {});
```

Writes to: `participants.{guestKey}` where `guestKey = 'guest_' + sha256(wpId + '-' + lowercased-name).slice(0,16)`. [VERIFIED: rsvpSubmit.js lines 35-39, 102-112]

**The schema transition:**

Phase 27 introduces `wp.guests[]` array and `guestId` (D-01, D-03). The existing `participants.{guestKey}` entries from Phase 11 are **not removed** — they are legacy data that Phase 7's party-page renders via `wp.participants`. Phase 27 guests go into `wp.guests[]` only. The `rsvpReminderTick` CF loops over `wp.participants` for members (skipping `isGuest: true`) — the legacy guest entries in `participants` are already being skipped (line 117: `if (p.isGuest) continue;`).

**Additive parameter migration (additive, no breaking change):**

```js
// Phase 27 extended signature — fully backward compatible
const { token, response, name, guestId } = (request.data || {});
```

Logic:
1. If `guestId` is present → it came from `localStorage.getItem('qn_guest_' + token)` in the client. This is a repeat submit. Read-modify-write the `wp.guests[]` array at the matching `guestId` index.
2. If `guestId` is absent (first submit or localStorage cleared) → mint a new `guestId` on the server, write a new entry to `wp.guests[]`, return `guestId` in the response body so the client can store it.

**Backward compat guarantee:**
- Old rsvp.html clients (Phase 11 body without `guestId`) still work: `guestId` is `undefined`, CF mints one, writes to `wp.guests[]`, returns `guestId`. Old behavior (writing `participants.{guestKey}`) is **removed** — Phase 27 replaces that write path. Any in-flight rsvp.html still on v1 logic will write a new guest entry to `wp.guests[]` correctly.
- The `renderConfirmation` callback can receive `guestId` in the CF response and stash it in `localStorage['qn_guest_' + token]`.

**CORS**: no change needed — origins already locked to `couchtonight.app` + `queuenight-84044.web.app`.

**Token expiry check**: The current CF checks `startAt + 6h` as a hardcoded TTL (line 95). Phase 27 changes this to use `D-02: wp.startAt + WP_ARCHIVE_MS`. Verify `WP_ARCHIVE_MS` is accessible in the CF context or hardcode the constant (currently ~18,000,000ms = 5h).

---

### Q4 — rsvp.html Bundle Size Budget

**Current state (Phase 11):**

`rsvp.html` is 154 lines, zero Firebase SDK, calls the `rsvpSubmit` CF via `fetch()`. The Firestore listener for D-07 real-time eviction (detecting `revoked: true` on the guest's own entry) was noted as a future enhancement in the Phase 11 CONTEXT.

**Adding a Firestore SDK listener — what does it cost?**

The Firebase JS SDK v10 (modular) with only `initializeApp` + `getFirestore` + `onSnapshot` is approximately:
- `firebase/app`: ~20KB gzipped
- `firebase/firestore`: ~85–100KB gzipped

Total cold-load addition: ~100–120KB gzipped. Parse time on a mid-range mobile: ~150–300ms. This violates the "zero-SDK" cold-load contract that is core to the Phase 11 posture. [ASSUMED — based on Firebase SDK size knowledge; exact figure may vary by tree-shaking effectiveness]

**30s polling fallback:**

A 30s `setInterval` polling via `fetch()` to a lightweight `getWpStatus` CF:
- Zero cold-load weight (fetch is native)
- Acceptable UX: guest's revoke is surfaced within 30s
- The CF call costs ~1 Firestore read per 30s per connected guest — negligible

**Recommendation: keep rsvp.html zero-SDK on cold load; use 30s polling post-RSVP.**

Implementation approach (preserves the Phase 11 contract):
1. On cold load: serve existing zero-SDK page as-is.
2. After the first successful RSVP response from the CF (user has engaged), start a polling interval:
   ```js
   // Post-RSVP only — lazy-start
   startStatusPoll(token, guestId);
   function startStatusPoll(token, guestId) {
     setInterval(async () => {
       const r = await fetch(CF_BASE + '/rsvpStatus', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ data: { token, guestId } })
       });
       const d = await r.json();
       if (d && d.result && d.result.revoked) renderRevoked();
       if (d && d.result && d.result.closed)  renderClosed();
     }, 30_000);
   }
   ```
3. A new lightweight `rsvpStatus` CF (or extend `rsvpSubmit` with a `{action: 'status'}` parameter) returns `{ revoked, closed, response, guestCount }`.

**Alternative (document the tradeoff explicitly for planner):** If a Firestore listener is desired for push-subscription opt-in (which needs a real-time `pushSub` callback), a tiny dynamic-import approach keeps cold load clean:

```js
// Injected post-RSVP: the SDK weight loads only after user taps
const script = document.createElement('script');
script.type = 'module';
script.textContent = `
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-app.js';
  import { getFirestore, doc, onSnapshot } from 'https://www.gstatic.com/firebasejs/10.x.x/firebase-firestore.js';
  // ... listener code ...
`;
document.head.appendChild(script);
```

However, this adds complexity for uncertain gain. The 30s polling approach is simpler, has no SDK dependency, and covers the D-07 real-time eviction requirement acceptably. **Planner should use polling.**

---

### Q5 — `wp.guests[]` Array Growth + Doc Size Budget

**Document size math:**

Per-guest entry WITHOUT pushSub (base shape):
- Field names: `guestId`(8+1) + `name`(5+1) + `response`(9+1) + `rsvpAt`(7+1) + `expiresAt`(9+1) + `revoked`(7+1) = 51 bytes
- Values: guestId base64 ~23 bytes + name avg ~10 bytes + response "maybe" 6 bytes + rsvpAt timestamp 8 bytes + expiresAt timestamp 8 bytes + revoked bool 1 byte = 56 bytes
- Map overhead: 32 bytes
- **Per guest (no push): ~139 bytes**

Per-guest `pushSub` object addition:
- `endpoint` URL: ~200 bytes (varies by push service, e.g. `https://fcm.googleapis.com/fcm/send/...` ~180–220 chars)
- `keys.p256dh`: base64-encoded 65 bytes → ~88 chars
- `keys.auth`: base64-encoded 16 bytes → ~24 chars
- Field name overhead: `pushSub`(8+1) + `endpoint`(9+1) + `keys`(5+1) + `p256dh`(7+1) + `auth`(5+1) = 39 bytes
- Value bytes: 200+88+24 = 312 bytes
- Nested map overhead: 32 (keys map) + 32 (pushSub map) = 64 bytes
- **pushSub addition: ~415 bytes per guest**
- **Per guest WITH push: ~554 bytes**

50 guests all with push subs: 50 × 554 = **27,700 bytes (~27KB)**

Other wp doc fields at scale:
- Phase 26 reactions array (200 reactions × ~270 bytes each, including `runtimePositionMs` + `runtimeSource`): ~54,000 bytes (~54KB) [ASSUMED based on Phase 26 schema additions]
- `wp.reminders` map for 50 guests × 3 windows × (guestId ~23 bytes + windowKey ~4 bytes) = ~3,900 bytes (~4KB)
- `wp.participants` map (legacy + members, ~10 entries × ~150 bytes): ~1,500 bytes
- Other scalar fields (titleName, hostName, hostId, startAt, status, etc.): ~600 bytes

**Total estimate (50 guests with push + 200 reactions):**
27.7KB + 54KB + 4KB + 1.5KB + 0.6KB = **~88KB** — well within the 1MB limit.

**When would this approach become risky?**

A watchparty with 200+ guests OR an extremely active reaction session with 1000+ reactions (at 270 bytes each = 270KB reactions alone) could push the doc toward the limit. With 200 guests all with push subs: 200 × 554 = ~111KB guests + 270KB reactions = 381KB — still safe.

**Verdict:** For a family watchparty product, 50 guests is already a very large party. Even at 200 guests with 1000 reactions (pathological case), the doc stays under 500KB. **No sub-collection fallback needed for v1.** Recommend adding a server-side cap of 100 guests per wp in `rsvpSubmit` as a soft guardrail with a `{ guestCapReached: true }` error response. [CITED: firebase.google.com/docs/firestore/storage-size]

---

### Q6 — `rsvpReminderTick` Scope Expansion

**Current CF structure:**

The CF iterates `wp.participants` (an object/map) and uses:
```js
if (p.isGuest) continue;  // skips old Phase 11 guest entries
if (pid === wp.hostId) continue; // skips host self-reminders
```
Idempotency: `wp.reminders[pid][w.key] = true` set before send. Uses `sendToMembers(familyCode, [pid], ...)` which reads `members/{pid}.pushSubscriptions`. [VERIFIED: rsvpReminderTick.js lines 115-136]

**What Phase 27 needs:**

After the existing `participants` loop, add a second loop over `wp.guests[]`:

```js
const guests = wp.guests || [];
for (const guest of guests) {
  if (!guest || !guest.guestId) continue;
  if (guest.revoked) continue;           // kicked guests get no reminders
  if (!guest.pushSub) continue;          // no push sub = no reminders

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
    sends.push({ guestId: guest.guestId, pushSub: guest.pushSub, title: w.title, body, key: w.key });
    updates[`reminders.${guest.guestId}.${w.key}`] = true;
  }
}
```

Guest pushes are sent directly via `webpush.sendNotification(guest.pushSub, payload)` rather than through `sendToMembers` (which reads from the `members` subcollection). The `sendToMembers` helper is member-doc-centric; for guests, the push sub lives on the wp doc itself, so the CF calls `webpush` directly.

**No redesign needed.** The existing `WINDOWS` cadence definition, `SLOP_MINUTES` constant, `fmt()` helper, idempotency flag pattern, atomic-flag-before-send pattern, and `doc.ref.update(updates)` call all work identically for guest entries. The only new code is the second loop and the direct `webpush.sendNotification(guest.pushSub, ...)` call path.

**Dead subscription pruning for guests:**

When `webpush.sendNotification` returns 410/404 for a guest's push sub, the sub should be removed from `wp.guests[i].pushSub`. This requires a read-modify-write on the wp doc (same array-update pattern as Q2). Add to the existing dead-sub cleanup logic at the end of the guests loop.

**Timeout budget:** The CF has `timeoutSeconds: 240`. Adding 50 guests to an existing family scan adds at most 50 × 1 webpush call. At ~100ms per webpush call, that's ~5 additional seconds — well within the 240s limit.

---

## Validation Architecture

### Test Framework

| Property | Value |
|---|---|
| Framework | `@firebase/rules-unit-testing` v3.0.2 + custom `it/describe` harness |
| Config file | `tests/firebase.json` + `tests/package.json` (existing) |
| Quick run command | `cd tests && npm test` (runs Firestore emulator + rules.test.js) |
| Full suite command | `cd tests && npm test` + `npm run smoke` (from couch root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| RSVP-27-01 | CF writes new guest to `wp.guests[]` on first submit | rules-test + CF unit | `cd tests && npm test` | Wave 0 |
| RSVP-27-02 | CF updates existing guest entry (same guestId, repeat submit) | CF unit (transaction path) | Smoke or manual CF test | Wave 0 |
| RSVP-27-03 | CF rejects submit when `wp.rsvpClosed: true` | CF unit | Smoke | Wave 0 |
| RSVP-27-04 | Token expiry gate uses `wp.startAt + WP_ARCHIVE_MS` (not 6h hardcode) | CF unit | Smoke | Wave 0 |
| RSVP-27-05 | Firestore rules: admin-SDK writes to `wp.guests[]` succeed (bypass rules) | n/a — admin SDK bypasses | N/A — guaranteed | N/A |
| RSVP-27-06 | Firestore rules: client write to `wp.guests[]` fails (unauthorized field) | rules-test | `cd tests && npm test` | Wave 0 |
| RSVP-27-07 | rsvp.html: "Push not supported" state renders when `PushManager` absent | browser manual UAT | iOS Safari (non-PWA) | Manual |
| RSVP-27-08 | rsvp.html: push opt-in CTA appears post-RSVP when push is available | browser manual UAT | Android Chrome | Manual |
| RSVP-27-09 | 30s poll: guest sees "revoked" state within one poll cycle | manual UAT | Two-device session | Manual |
| RSVP-27-10 | rsvpReminderTick: guest with pushSub=yes gets reminder at T-1h | CF unit / emulator | Manual CF invocation | Manual |
| RSVP-27-11 | rsvpReminderTick: guest with pushSub=null is skipped silently | CF unit | Smoke | Wave 0 |
| RSVP-27-12 | Doc-size guardrail: CF rejects >100 guests per wp | CF unit | Smoke | Wave 0 |
| RSVP-27-13 | rsvp.html footer: privacy link navigates to `/privacy` | browser manual UAT | Any browser | Manual |
| RSVP-27-14 | app.html roster: guest chip renders with `(guest)` suffix only when name collides | smoke sentinel | `npm run smoke:guest-rsvp` | Wave 0 |
| RSVP-27-15 | Host remove → `revoked: true` soft-delete on wp.guests[i] | rules-test + manual UAT | `cd tests && npm test` | Wave 0 |

### Browser-Matrix Manual UAT for Web Push

| Platform | Browser | Push Without Install | Expected Result |
|---|---|---|---|
| iOS 16.4+ | Safari (not PWA) | No | "Push not supported" state renders |
| iOS 16.4+ | Safari (PWA, added to Home Screen) | Yes | Permission prompt shown |
| iOS 16.4+ | Chrome | No | "Push not supported" state renders (Chrome iOS = WKWebView, same restriction) |
| Android | Chrome | Yes | Permission prompt shown immediately |
| macOS Ventura+ | Safari 16+ | Yes | Permission prompt shown without install |
| Desktop | Chrome | Yes | Permission prompt shown without install |
| Desktop | Firefox | Yes | Permission prompt shown without install |

### Wave 0 Gaps

- [ ] `tests/rules.test.js` — add describe block "Phase 27 Guest RSVP rules" covering:
  - Unauthenticated client CANNOT write `wp.guests` field directly (rules deny)
  - Host (UID_OWNER) can update `wp.rsvpClosed: true` (Path A host write)
  - Family member can read wp doc including guests array
- [ ] `scripts/smoke-guest-rsvp.cjs` — new smoke contract; covers:
  - Name-collision render logic (`(guest)` suffix detection helper)
  - `guestId` mint format validation
  - Response normalization for reminder cadence
  - Guest-count helper (counting non-revoked entries)
- [ ] Wire `smoke:guest-rsvp` into `npm run smoke` aggregate in `package.json`

---

## Recommended Build Sequence

### Wave 1 — Schema + CF Foundation
1. Extend `rsvpSubmit` CF: add `guestId` parameter, read-modify-write transaction, return `guestId` in response, check `rsvpClosed` gate, cap at 100 guests.
2. Update `rsvp.html`: store returned `guestId` in `localStorage['qn_guest_<token>']`; send `guestId` on repeat submits; add privacy footer (D-05).
3. Add `wp.rsvpClosed: true` check to `rsvpSubmit`.
4. Add Firestore rules test for Wave 1 (client write to `wp.guests` denied; rules test).

### Wave 2 — Push Opt-In on rsvp.html
1. Post-RSVP: render push opt-in CTA with `pushSupported` feature-detect guard.
2. On opt-in: call `Notification.requestPermission()`, then `PushManager.subscribe()` with VAPID key, send pushSub to CF via a new `rsvpPushSubscribe` endpoint (or extend `rsvpSubmit` with `{action: 'subscribePush', pushSub}`).
3. CF writes `pushSub` to `wp.guests[i].pushSub` (read-modify-write transaction).
4. Add "Push not supported on this device" render path for iOS non-PWA.
5. Add 30s polling loop post-RSVP (checks revoked/closed status via `rsvpStatus` CF or extended `rsvpSubmit`).

### Wave 3 — `rsvpReminderTick` Guest Loop
1. Add second loop over `wp.guests[]` in `rsvpReminderTick`.
2. Direct `webpush.sendNotification(guest.pushSub, payload)` path.
3. Dead-sub pruning for guest push subs (read-modify-write on wp doc).
4. Smoke test: `rsvpReminderTick` correctly skips guests without pushSub, skips revoked guests.

### Wave 4 — Host Controls + app.html Roster
1. app.html guest chip rendering with `badge-guest` pill, `(guest)` suffix logic (D-04).
2. Host "remove" control (long-press or kebab, mirroring member-remove pattern per Claude's discretion).
3. `rsvpRevoke` CF (or extend `rsvpSubmit` with `{action: 'revoke', guestId}`) → sets `wp.guests[i].revoked: true` via read-modify-write.
4. "Close RSVPs" host control → sets `wp.rsvpClosed: true`.
5. `wp.guestCount` denorm update on all write paths.

### Wave 5 — Validation + Deploy
1. `smoke-guest-rsvp.cjs` new smoke contract.
2. Extend `tests/rules.test.js` with Phase 27 guest-rules describe block.
3. `sw.js` CACHE bump via `bash scripts/deploy.sh 39-guest-rsvp`.
4. Cross-repo Firestore rules deploy if rules changed (currently no Phase 27 rules changes needed — admin SDK bypass covers all CF paths).
5. HUMAN-UAT.md scaffold (browser matrix, two-device revoke flow, iOS push-not-supported state).

---

## Risk Notes

### Risk 1 — iOS Push Silent Failure (HIGH impact, expected)
Most iPhone guests following an iMessage/SMS link will see the "Push not supported" state. This is expected per D-06 but must be handled gracefully at the UI layer. The confirmation screen should be satisfying and complete without push. The "Get reminded when the party starts?" CTA should only appear when `pushSupported` is true — avoid showing a button that immediately errors on iOS.

**Mitigation:** Feature-detect `'PushManager' in window` before rendering the push CTA at all. iOS guests see a clean confirmation screen, not a broken push flow.

### Risk 2 — ArrayUnion/ArrayRemove Unusable for Object Updates
As documented in Q2, any update to an existing `wp.guests[]` entry requires a `runTransaction()` read-modify-write. If the planner assigns array writes without the transaction pattern, repeat submits will append duplicate entries rather than updating the existing one.

**Mitigation:** The `rsvpSubmit` CF MUST always use `runTransaction()`. Wave 1 implementation must use this pattern from the start.

### Risk 3 — Token = wpId Assumption (CRITICAL to preserve)
The Phase 11 RSVP system uses the watchparty's Firestore document ID directly as the RSVP token (rsvpSubmit.js line 68: "token === wpId for v1"). Phase 27 inherits this assumption. Any Phase 27 code that assumes a separate invite/token document exists will fail silently. The `rsvpClosed` flag must live on the wp doc, not on a token doc.

**Mitigation:** Documented clearly in Q2 and Q3. All CF logic reads the wp doc via `db.collection('families').doc(familyCode).collection('watchparties').doc(token)`.

### Risk 4 — Phase 11 `participants.{guestKey}` Legacy Data
Phase 11 wrote guests into `wp.participants.{guestKey}` with `isGuest: true`. Phase 27 writes to `wp.guests[]`. Live watchparties at the time of Phase 27 deployment may have `participants` entries with `isGuest: true` from old RSVPs. These are harmless (the `rsvpReminderTick` already skips them) but should not be confused with the new `wp.guests[]` entries. The app.html roster render must only display from `wp.guests[]` for Phase 27 guest chips, not from `wp.participants` with `isGuest: true`.

**Mitigation:** Clearly separate the data paths in CF and client code. No migration needed — old participant-map guest entries are quietly ignored.

### Risk 5 — rsvpSubmit CF Performance (family scan on every RSVP)
The current `rsvpSubmit` scans ALL families to find the wp doc by wpId (lines 75-87). This is a documented "v1 simplicity" trade-off. For Phase 27, this scan runs on every RSVP submit AND on every status-poll call. For a family product with <100 families, this is acceptable. For a scaled deployment, it would need the "top-level `rsvpTokens/{token}` reverse index" noted in the CF comment (line 70).

**Mitigation:** No action needed for Phase 27 scope. Flag in plan as a known tech debt item for Milestone 2.

### Risk 6 — Polling vs Real-Time for Eviction Latency
The 30s polling approach means a revoked guest stays on their confirmation screen for up to 30 seconds after the host kicks them. This is acceptable for the use case (host rarely needs to immediately evict mid-RSVP), but if the planner wants real-time eviction, the Firestore SDK injection approach described in Q4 is available at the cost of cold-load weight.

**Mitigation:** Document the 30s window clearly in HUMAN-UAT.md so testers know to wait one full poll cycle before asserting the revoked state.

### Risk 7 — VAPID Key Availability on rsvp.html
The push subscription requires a VAPID public key. In the main app, this comes from `js/firebase.js` or is embedded in `app.html`. `rsvp.html` has no Firebase SDK — the VAPID public key must be hardcoded directly in `rsvp.html` as a constant (same approach as `CF_BASE`). This key is public by design (it's in the `web-push` VAPID setup and is sent to the browser push service).

**Mitigation:** Embed VAPID_PUBLIC_KEY as a constant in rsvp.html inline script. Retrieve the current value from queuenight/functions/index.js where `webpush.setVapidDetails(subj, pub, priv)` is called.

---

## References

### Primary (HIGH confidence — verified from source)
- `queuenight/functions/src/rsvpSubmit.js` — full read; current CF signature, guestKeyFor, token=wpId assumption, CORS config
- `queuenight/functions/src/rsvpReminderTick.js` — full read; participants loop, isGuest skip, WINDOWS cadence, idempotency pattern
- `queuenight/functions/index.js` lines 270–340 — `sendToMembers` implementation, `webpush.sendNotification` call pattern, dead-sub pruning
- `rsvp.html` — full read; 154 lines, zero-SDK, fetch-based submit, CF_BASE constant
- `css/rsvp.css` — full read; standalone CSS, no app.css dependency
- `firestore.rules` — full read; admin-SDK bypass architecture note (lines 327–345), watchparties rule (lines 577–602)
- `tests/rules.test.js` — lines 1–130; existing harness structure, seed pattern, @firebase/rules-unit-testing v3

### Secondary (MEDIUM confidence — official docs + verified search)
- [webkit.org/blog/13878 — Web Push for Web Apps on iOS and iPadOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/) — iOS 16.4+ PWA install requirement
- [firebase.google.com/docs/firestore/storage-size](https://firebase.google.com/docs/firestore/storage-size) — document size calculation formula
- [firebase/firebase-js-sdk issue #1918](https://github.com/firebase/firebase-js-sdk/issues/1918) — ArrayUnion/ArrayRemove exact-match requirement for objects
- [firebase.google.com/docs/firestore/security/get-started](https://firebase.google.com/docs/firestore/security/get-started) — admin SDK bypasses rules

### Tertiary (LOW confidence — search only)
- web-push subscription object size: endpoint ~200 bytes, p256dh base64-encoded 88 chars, auth base64-encoded 24 chars [multiple search results consistent]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | Firebase JS SDK v10 (modular) with Firestore onSnapshot = ~100–120KB gzipped cold-load | Q4 bundle size | If SDK is smaller than estimated (some CDN versions tree-shake heavily), the SDK-on-first-engage approach becomes more attractive. Doesn't change the recommendation (polling is still simpler). |
| A2 | Phase 26 reactions: ~200 reactions × ~270 bytes = ~54KB contribution to wp doc | Q5 doc-size | If reaction objects are significantly larger (e.g., base64-encoded thumbnail), doc size increases. At 500 bytes per reaction, still only 100KB for 200 reactions. Risk remains LOW. |
| A3 | WP_ARCHIVE_MS is ~18,000,000ms (5h post-start) as used elsewhere in the codebase | Q3 TTL check | If the constant has changed since Phase 11, the TTL logic will be wrong. Planner should grep for WP_ARCHIVE_MS in js/constants.js before hardcoding. |

---

## Open Questions

1. **VAPID public key location:** Where exactly is the VAPID public key stored in the queuenight functions config? It's passed to `webpush.setVapidDetails()` in `index.js` but likely loaded from environment variables. The planner must identify the public key (safe to embed) vs. private key (must stay in Functions config).

2. **WP_ARCHIVE_MS value:** Confirm current value of `WP_ARCHIVE_MS` in `js/constants.js` before coding the TTL check in `rsvpSubmit`. The current CF uses a hardcoded `6 * 3600 * 1000` (6h) that contradicts D-02's "startAt + WP_ARCHIVE_MS" intent.

3. **Host remove UI placement:** Claude's Discretion per CONTEXT.md. Planner picks exact placement (kebab vs long-press on guest chip). Recommend checking Phase 5 member-remove pattern for consistency.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|---|---|---|---|---|
| Firebase Emulator (Firestore) | rules-test suite | Assumed available | Firebase CLI version in path | Cannot run rules tests without emulator — check `firebase --version` |
| `@firebase/rules-unit-testing` v3 | `tests/rules.test.js` | Yes (installed in `tests/node_modules`) | ^3.0.2 | n/a |
| `web-push` npm package | rsvpReminderTick direct webpush calls | Yes | ^3.6.7 (in queuenight/functions/package.json) | n/a |
| VAPID keys | rsvp.html push subscription | In queuenight Functions config | — | Must retrieve from queuenight/.env or Firebase Functions config |

---

## Metadata

**Confidence breakdown:**
- Open questions (Q1-Q6): HIGH — all resolved from direct code inspection + official docs
- CF migration plan: HIGH — based on direct read of rsvpSubmit.js source
- iOS web push landscape: HIGH — verified from official WebKit blog
- Document size math: MEDIUM — calculated from official Firestore storage docs + reasonable assumptions about reaction sizes
- Build sequence: MEDIUM — logical ordering based on dependencies, planner may reorder

**Research date:** 2026-05-01
**Valid until:** 2026-08-01 (Firebase API surface is stable; iOS web push requirements unlikely to change in 3 months)
