---
phase: 27-guest-rsvp
plan: 01
subsystem: cloud-functions
tags:
  - guest-rsvp
  - cloud-functions
  - firestore-transactions
  - admin-sdk
  - rsvp-submit
  - rsvp-status
  - rsvp-revoke
  - cross-repo

# Dependency graph
requires:
  - phase: 11-feature-refresh-and-streamline
    provides: rsvpSubmit Phase 11 baseline (CORS allowlist, family-scan, looksLikeWpId, admin-SDK pattern)
provides:
  - "rsvpSubmit extended to write wp.guests[] via runTransaction (D-01 + D-03 idempotent upsert)"
  - "rsvpSubmit gated on wp.rsvpClosed (D-07 secondary close-RSVPs flag)"
  - "rsvpSubmit 100-guest soft cap (RESEARCH Q5 doc-size guardrail) — bypassed by repeat submits"
  - "rsvpSubmit expiry reconciled to canonical WP_ARCHIVE_MS = 25h (legacy 6h hardcode removed)"
  - "rsvpStatus CF — read-only 30s polling endpoint (revoked/closed/guestCount)"
  - "rsvpRevoke CF — host-only action='revoke'|'close' with server-side host gate"
  - "queuenight/functions/index.js wires both new exports"
affects:
  - 27-02 (Firestore rules + tests for wp.guests[])
  - 27-03 (rsvp.html — calls rsvpSubmit with guestId + 30s polling rsvpStatus)
  - 27-04 (app.html — host roster UI calls rsvpRevoke)
  - 27-05 (rsvpReminderTick guest loop + cross-repo deploy)

# Tech tracking
tech-stack:
  added:
    - "crypto.randomBytes(16).toString('base64url') — guestId minting (already present in inviteGuest pattern)"
    - "db.runTransaction read-modify-write — Firestore array of objects upsert pattern"
  patterns:
    - "Token-as-wpId family-scan (preserved across all three CFs)"
    - "Admin-SDK rules-bypass for unauth onCall writes"
    - "Object.assign({}, prev, mutationFields) for in-place array element update"
    - "wp.guestCount denorm derived from visible.length on every write path"
    - "Idempotent revoke (already-revoked guest = no-op)"
    - "Server-side host gate that falls back gracefully when request.auth.uid is absent"

key-files:
  created:
    - "C:/Users/nahde/queuenight/functions/src/rsvpStatus.js (77 lines)"
    - "C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js (100 lines)"
  modified:
    - "C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js (129 → 192 lines)"
    - "C:/Users/nahde/queuenight/functions/index.js (+4 lines: comment + 2 exports)"

key-decisions:
  - "Server-side host gate is permissive when request.auth.uid is absent (v1 simplicity per RESEARCH Risk 3) — relies on client gate state.me.id === wp.hostId in app.html. Documented as a deferred hardening in rsvpRevoke header comment."
  - "Repeat submits with an existing guestId BYPASS the 100-guest cap — only NEW guests trigger guestCapReached. Captured in must_have truth #5; matches the change-of-mind UX (going → maybe → going)."
  - "Legacy guestKeyFor() helper retained (not deleted) with explanatory comment, to preserve module export shape for any Phase 11 caller still importing it."
  - "rsvpRevoke close path uses plain wpRef.update({rsvpClosed:true}) (no transaction) since it's a single-field flip; revoke path uses runTransaction because it modifies array element + denorm count atomically."

patterns-established:
  - "wp.guests[] upsert via runTransaction: snap → guests.slice() → findIndex(g => g.guestId === id) → push or Object.assign(prev, mutation) → tx.update with {guests, guestCount: visible.length}"
  - "Three-CF mirror module structure: same CORS allowlist, same looksLikeWpId regex, same family-scan loop body, divergent business logic"
  - "guestId regex /^[A-Za-z0-9_-]{20,32}$/ — accepts 22-char base64url output from crypto.randomBytes(16) with margin for variants"

requirements-completed:
  - RSVP-27-01
  - RSVP-27-02
  - RSVP-27-03
  - RSVP-27-04
  - RSVP-27-05
  - RSVP-27-12
  - RSVP-27-15

# Metrics
duration: ~25min
completed: 2026-05-02
---

# Phase 27 Plan 01: Guest RSVP Cloud Functions Summary

**Three Cloud Functions ship the entire server-side surface for Phase 27 — rsvpSubmit (extended) writes wp.guests[] via runTransaction with closed/cap/expiry gates; rsvpStatus polls revoked/closed/guestCount read-only; rsvpRevoke (action=revoke|close) soft-deletes a guest or closes all RSVPs with a server-side host gate.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-05-02T02:13Z (approx)
- **Completed:** 2026-05-02T02:38:09Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (1 modified, 2 created in queuenight/functions/src; 1 modified in queuenight/functions)

## Accomplishments

- `rsvpSubmit` now writes Phase 27 schema atomically: `wp.guests[]` array via `db.runTransaction` read-modify-write upsert, with denormalized `wp.guestCount = visible.length` maintained on every write path.
- Five gates layered correctly in `rsvpSubmit`: token-shape regex → family-scan → wp expiry (`startAt + 25h`) → wp ended-state → `wp.rsvpClosed` flag → 100-guest cap (NEW guests only) → upsert.
- `rsvpStatus` ships as a brand-new unauthenticated read-only onCall CF returning `{revoked, closed, guestCount}` (or `{expired:true,...}` for not-found / archived / ended), suitable for 30s polling from rsvp.html.
- `rsvpRevoke` ships with both action paths in a single CF (extension-ready for Plan 27-05's `'attachPushSub'` branch), idempotent revoke (no-op when guest already revoked), and a server-side host gate that throws `permission-denied` when `request.auth.uid` mismatches `wp.hostUid` (or legacy `wp.hostId`).
- `queuenight/functions/index.js` wires both new exports immediately after the existing rsvpSubmit/rsvpReminderTick/sendToMembers block; final `node -e "require('./functions/index.js')"` confirms `typeof rsvpSubmit/rsvpStatus/rsvpRevoke === 'function'`.

## Task Commits

Each task was committed atomically in the **queuenight** repo:

1. **Task 1.1: Extend rsvpSubmit.js** — `fcb699a` (feat)
   - Add guestId param + regex validation, runTransaction wp.guests[] upsert, WP_ARCHIVE_MS=25h, rsvpClosed gate, 100-guest cap (NEW guests only), extended return shape `{success, hostName, guestId, guestCounts:{yes, maybe}}`.
2. **Task 1.2: Create rsvpStatus.js** — `b28632d` (feat)
   - 77 lines, mirrors rsvpSubmit module structure, read-only (zero `.update(` calls), graceful family-not-found returns `{expired:true, revoked:false, closed:false, guestCount:0}`.
3. **Task 1.3: Create rsvpRevoke.js + wire index.js exports** — `71b41c4` (feat)
   - 100 lines new CF, dual action switch, server-side host gate (auth.uid match against wp.hostUid or legacy wp.hostId), idempotent revoke. index.js gains `exports.rsvpStatus` + `exports.rsvpRevoke` after the existing sendToMembers export.

**Plan metadata commit (couch repo):** This SUMMARY.md, committed as `docs(27-01): plan summary`.

## Files Created/Modified

### Created
- `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js` — 77 lines. Unauth onCall read-only polling endpoint. Same CORS allowlist + looksLikeWpId + family-scan as rsvpSubmit; returns `{revoked, closed, guestCount}` plus `{expired:true,...}` for not-found / archived / ended.
- `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js` — 100 lines. Host-only onCall with `action: 'revoke' | 'close'`. Revoke path uses `db.runTransaction` to soft-delete `wp.guests[i].revoked=true` + maintain `guestCount`. Close path uses single-field `wpRef.update({rsvpClosed:true})`. Server-side host gate: `permission-denied` on `request.auth.uid` mismatch against `wp.hostUid` (or legacy `wp.hostId`).

### Modified
- `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` (was 129 lines → now 192 lines):
  - **EDIT 1 (line 53):** Destructured `guestId` from `request.data`; added regex validation `/^[A-Za-z0-9_-]{20,32}$/`.
  - **EDIT 2 (was line 95):** Replaced legacy hardcoded `6 * 3600 * 1000` expiry check with `const WP_ARCHIVE_MS = 25 * 60 * 60 * 1000` matching canonical `js/app.js:1931`.
  - **EDIT 3 (after expiry/state checks):** Added `wp.rsvpClosed === true` gate returning `{closed:true}`, and 100-guest cap (NEW guests only) returning `{guestCapReached:true}`.
  - **EDIT 4 (was lines 102-112):** Replaced `participants.${guestKey}` write with `db.runTransaction` read-modify-write upsert into `wp.guests[]`. Pushes new entry with `crypto.randomBytes(16).toString('base64url')` guestId on first submit, or `Object.assign({}, prev, {response, name, rsvpAt})` on repeat. Sets `tx.update(wpRef, {guests, guestCount: visible.length})`.
  - **EDIT 5 (was line 127):** Extended return shape to `{success, hostName, guestId, guestCounts:{yes, maybe}}`.
  - Retained legacy `guestKeyFor()` with `// retained for Phase 11 backwards compat` comment.
- `C:/Users/nahde/queuenight/functions/index.js` (+4 lines after the existing `exports.sendToMembers` line): added Phase 27 comment header + `exports.rsvpStatus = require('./src/rsvpStatus').rsvpStatus;` + `exports.rsvpRevoke = require('./src/rsvpRevoke').rsvpRevoke;`. No duplicate `exports.rsvpSubmit` (count remains 1).

## Decisions Made

- **Server-side host gate is opportunistic, not mandatory** — when `request.auth.uid` is absent (e.g., onCall called via fetch without an auth token), the CF accepts the call and relies on the client gate `state.me.id === wp.hostId` in app.html. Per RESEARCH Risk 3, this is documented v1 simplicity. The header comment in rsvpRevoke.js calls out the deferred hardening.
- **Cap exemption for repeat submits is intentional** — must_have truth #5 explicitly says repeat submits from existing guestId always succeed regardless of cap. This means a wp can grow past 100 entries if existing guests change their mind. Acceptable per RESEARCH Q5 (doc-size budget at ~30KB even with 50 push-subscribed guests).
- **Single-CF dual-action design for rsvpRevoke** — chosen over two separate CFs because the action surface is tiny (2 actions, switching to 3 in Plan 27-05 with `'attachPushSub'`) and the family-scan + host-gate logic is identical across actions. Future plans can add new branches without new CF deploys.
- **Close path uses plain update, not transaction** — `wp.rsvpClosed: true` is a single boolean flip; no array consistency concerns. The revoke path requires transaction because `guests[]` array + `guestCount` denorm must update together atomically.

## Deviations from Plan

### Auto-fixed Issues

None of significance. Two minor process notes:

**1. [Process — typo self-correction] Extra `maybeCount` field in EDIT 5 return shape**
- **Found during:** Task 1.1 EDIT 5 self-review (immediately after the edit, before verification)
- **Issue:** Initial Edit call wrote `guestCounts: { yes: yesCount, maybeCount: maybeCount, maybe: maybeCount }` — added a stray `maybeCount` key not in the must_have truth contract.
- **Fix:** Follow-up Edit collapsed it to the spec-exact `{ yes: yesCount, maybe: maybeCount }`.
- **Files modified:** `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js`
- **Verification:** `grep -n "guestCounts: { yes: yesCount, maybe: maybeCount }"` matches.
- **Committed in:** `fcb699a` (final state of Task 1.1 commit; never landed on disk in the broken shape).

---

**Total deviations:** 0 substantive (1 in-flight typo self-corrected before commit).
**Impact on plan:** Plan executed exactly as written. All five EDITs landed in the prescribed order; both new CFs match the supplied skeletons character-for-character.

## Issues Encountered

- The plan's `<verify>` block listed a grep `tx\.update.*guestCount` that doesn't match because `tx.update(wpRef, { guests: guests, guestCount: visible.length })` spans three lines. Verified the equivalent invariant via `grep -n "guestCount: visible\.length"` (matches line 169 of rsvpSubmit.js). No code change needed.
- A pre-existing modification to `C:\Users\nahde\claude-projects\couch\.planning\ROADMAP.md` was present in the couch working tree at start. Per the orchestrator contract (`Do NOT update STATE.md or ROADMAP.md`), it was left untouched.

## User Setup Required

None for this plan. No deploy in 27-01 — Plan 05 owns the cross-repo `firebase deploy --only functions` from `C:\Users\nahde\queuenight\` for all three new/extended CFs.

## Next Phase Readiness

**Ready for parallel Wave-1 plans:**
- **Plan 27-02 (Firestore rules + tests)** can proceed in parallel — admin-SDK CFs already bypass rules; 27-02 only needs to add a deny-test for client writes to `wp.guests`.

**Ready for Wave-2 plans (depend on this Wave-1):**
- **Plan 27-03 (rsvp.html)** can call `rsvpSubmit` with `guestId` and start a 30s polling loop against `rsvpStatus`. Both endpoints are CORS-locked to `couchtonight.app` + `queuenight-84044.web.app`.
- **Plan 27-04 (app.html roster UI)** can call `rsvpRevoke` with `{token, action:'revoke', guestId}` for the kebab "remove" action and `{token, action:'close'}` for the host's "Close RSVPs" link.

**Open observations for Plan 27-05 deploy ritual:**
1. The cross-repo deploy must run from `C:\Users\nahde\queuenight\` (NOT couch). Suggested command: `firebase deploy --only functions:rsvpSubmit,functions:rsvpStatus,functions:rsvpRevoke` to limit blast radius (avoids redeploying unrelated CFs like `accountDeletionReaper` or the Trakt OAuth functions).
2. After deploy, run `gcloud functions describe rsvpStatus --region=us-central1 --project=queuenight-84044` (or equivalent Firebase CLI) to confirm the CORS allowlist landed correctly. The CF spec uses `cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app']` — preflight from any other origin should 403.
3. The `webpush` configuration is already initialized in `index.js` for `rsvpReminderTick` — no VAPID config changes needed for these three CFs (they don't send push directly; that's Plan 27-05's `rsvpReminderTick` extension).

## Self-Check

Verified each completion claim:

**Files exist:**
- `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` — FOUND (192 lines)
- `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js` — FOUND (77 lines)
- `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js` — FOUND (100 lines)
- `C:/Users/nahde/queuenight/functions/index.js` — modified (3 new exports lines)

**Commits exist (queuenight repo):**
- `fcb699a` — feat(27-01): rsvpSubmit writes wp.guests[]... — FOUND in `git log -5`
- `b28632d` — feat(27-01): add rsvpStatus CF... — FOUND
- `71b41c4` — feat(27-01): add rsvpRevoke CF... — FOUND

**Module load smoke (top-level index.js):**
- `rsvpSubmit: function`
- `rsvpStatus: function`
- `rsvpRevoke: function`

**Must-have grep checks (all PASSED):**
- `runTransaction` present in rsvpSubmit.js (line 130) and rsvpRevoke.js (line 81)
- `WP_ARCHIVE_MS = 25 * 60 * 60 * 1000` present in rsvpSubmit.js:104 and rsvpStatus.js:56
- `rsvpClosed === true` present in rsvpSubmit.js:113
- `guestCapReached` present in rsvpSubmit.js:122
- `crypto.randomBytes(16).toString('base64url')` present in rsvpSubmit.js:141
- Legacy `6 * 3600 * 1000` REMOVED from rsvpSubmit.js (no matches)
- Legacy `participants.${guestKey}` write REMOVED from rsvpSubmit.js (no matches)
- `permission-denied` appears 3 times in rsvpRevoke.js (≥2 required)
- `wpRef.update({ rsvpClosed: true })` present in rsvpRevoke.js:76
- `Object.assign(..., { revoked: true })` present in rsvpRevoke.js:91
- `exports.rsvpStatus` present in index.js:1635
- `exports.rsvpRevoke` present in index.js:1636
- `^exports\.rsvpSubmit` count = 1 in index.js (no duplicate)

## Self-Check: PASSED

---
*Phase: 27-guest-rsvp*
*Plan: 01*
*Completed: 2026-05-02*
