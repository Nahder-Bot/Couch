# Phase 30 Hotfix Wave 2 — CDX-3 & CDX-5 (Backend)

**Date:** 2026-05-03
**Repo:** `C:\Users\nahde\queuenight\` (functions only)
**Scope:** Two HIGH-severity backend bugs identified in Codex review wave 2.
**Deploy status:** NOT DEPLOYED — code committed only. Awaiting user trigger.

---

## CDX-3 — Flow B nominate auto-convert creates legacy nested wps invisible to Phase 30 client

**Severity:** HIGH
**File:** `functions/index.js` lines 1280-1326 (watchpartyTick / Branch B)
**Commit:** `33487db`

### Root cause

When a Flow B nominate intent met the auto-convert criteria
(`minutesBefore <= 15 && minutesBefore > 0 && hasYes`), the CF created a
watchparty doc at the LEGACY nested path
`/families/{familyDoc.id}/watchparties/{wpId}` and OMITTED all Phase 30 fields
(`hostFamilyCode`, `families[]`, `memberUids[]`, `crossFamilyMembers[]`).

Phase 30 client uses
`collectionGroup('watchparties').where('memberUids', 'array-contains', uid)`
— so these auto-converted wps were **completely invisible** to all clients.
The CF runs with admin SDK and bypasses rules, so the write succeeded; the
visibility loss was schema-shape only.

### Fix

1. Migrated wp creation to top-level: `db.collection('watchparties').doc()`.
2. Pre-fetched family members synchronously
   (`families/{fid}/members/*.uid`, filtered Boolean) — mirrors the existing
   pattern at line 1352 (intentExpiring recipient lookup).
3. Stamped four Phase 30 fields on the wp doc:
   - `hostFamilyCode: familyDoc.id`
   - `families: [familyDoc.id]`
   - `memberUids: <member uids array>`
   - `crossFamilyMembers: []`

`crossFamilyMembers` is `[]` because Flow B nominations are single-family at
this point in the lifecycle; cross-family expansion (if any) happens later
via `addFamilyToWp`.

### Verification

- `node -c functions/index.js` → SYNTAX_OK
- Re-read of lines 1280-1326 confirms top-level path + four new fields present
- All other auto-convert behavior (intent flip, push fan-out, optedInIds copy)
  preserved verbatim

---

## CDX-5 — Guest reminder pushes silently fail because VAPID keys aren't set

**Severity:** HIGH
**Files:**
  - `functions/index.js` (configureWebPush export)
  - `functions/src/rsvpReminderTick.js` lines 60-78, 148-247, 285-295
**Commits:**
  - `9dadba4` chore: export configureWebPush from index.js
  - `43004d8` fix(phase-27): VAPID gating

### Root cause

The Phase 27 guest reminder send loop calls `webpush.sendNotification()`
directly (bypassing `sendToMembers`, since guest pushSubs live on
`wp.guests[i].pushSub` not on `members/{pid}.pushSubscriptions`).

The pre-existing comment claimed `require('../index.js')` side-effect-triggered
`configureWebPush()`, but `configureWebPush` is defined at index.js:34 and
only invoked from inside `sendToMembers()` (index.js:289) — never at module
top level. So a wp with NO member sends (only guests) would:

1. Never have VAPID configured (no `sendToMembers` call ever happens).
2. Throw `'Vapid keys must be set'` on every `webpush.sendNotification()`.
3. Have already stamped the reminder flag at line 211 BEFORE the send.

Result: guest reminders permanently marked sent, never delivered. Silent
data loss.

### Fix (split across two commits)

**Commit `9dadba4` — export configureWebPush**

Added `module.exports.configureWebPush = configureWebPush;` after the helper
function definition in index.js (alongside the existing
`addedBrandsFor` / `buildPushBody` exports). No behavior change in this
commit standalone — pure surface expansion.

**Commit `43004d8` — VAPID gating in rsvpReminderTick**

1. Captured `configureWebPush` from the existing `idx = require('../index.js')`
   at the top of the handler.
2. Split reminder-flag accumulation:
   - `updates` — member flags (always committed pre-send, unchanged)
   - `guestUpdates` — guest flags (only merged into `updates` if VAPID OK)
3. Before the pre-send `doc.ref.update(updates)` write:
   - If `guestSends.length > 0`, call `configureWebPush()`.
   - On failure (no env, or function missing), log a warn, leave
     `runGuestSends=false`, do NOT merge `guestUpdates`, and skip the guest
     send loop entirely.
4. Guarded the guest send loop with `if (runGuestSends) for (...)`.

### Critical constraint honored

User specified: **the reminder flag must NOT be set if the guest send fails
because VAPID isn't configured.** Verified by code structure:

- `guestUpdates` is built independently of `updates`.
- `Object.assign(updates, guestUpdates)` happens ONLY inside
  `if (runGuestSends)`.
- `runGuestSends` is set to `false` BEFORE that assignment when VAPID isn't
  ready.

Therefore: when VAPID is missing, neither the flag nor the send happen, and
the next 15-minute tick can retry naturally once env vars are configured.

Member-side `sendToMembers` flow is byte-for-byte unchanged (it calls
`configureWebPush()` internally — that path was already correct).

### Verification

- `node -c functions/index.js` → SYNTAX_OK (after export)
- `node -c functions/src/rsvpReminderTick.js` → SYNTAX_OK (after gating)
- Re-read of lines 148-247 confirms split + gate logic
- Re-read of line 295 confirms `if (runGuestSends) for (...)` wrap

---

## Commit summary

```
43004d8 fix(phase-27): rsvpReminderTick configures VAPID before guest webpush calls (CDX-5)
9dadba4 chore: export configureWebPush from index.js for downstream consumers
33487db fix(phase-30): Flow B nominate auto-convert targets top-level + Phase 30 fields (CDX-3)
```

## Out of scope (per user instructions)

- Did NOT touch `couch` repo files (parallel agents owned `firestore.rules` and `js/app.js`).
- Did NOT deploy.
- Did NOT modify `sendToMembers()` flow for regular members (trusted path).

## Recommended follow-up

1. Verify `functions/.env` has `VAPID_PUBLIC` and `VAPID_PRIVATE` set in the
   target environment before next deploy — the new fix logs a warn but still
   silently skips guest sends if env is missing. (This is preferable to the
   previous behavior of silently marking flags sent, but it's still silent
   from the guest's perspective.) Consider an alerting hook on this warn line.
2. The wave-2 hotfixes for CDX-3 + CDX-5 should ride together with whatever
   the parallel agents produced for the couch repo (rules + app.js fixes) in
   a single deploy/cache-bump cycle.
3. Manual UAT for CDX-3: trigger a Flow B nominate intent at T-15min with
   one yes RSVP, confirm the resulting wp appears in the `watchparties/`
   collection (top-level) AND surfaces in the Phase 30 client list view.
4. Manual UAT for CDX-5: with VAPID env intentionally unset on a staging
   project, schedule a wp with a guest RSVP, wait for the reminder tick,
   and verify (a) no flag is set on `wp.reminders.{guestId}`, (b) the warn
   log line appears, (c) re-running with VAPID restored delivers the push
   on the next tick.
