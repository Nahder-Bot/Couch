---
phase: 30-couch-groups-affiliate-hooks
hotfix: backend
applied_at: 2026-05-03
repo: queuenight (sibling)
findings_addressed: 8
findings_deferred: 3
status: applied_pending_deploy
---

# Phase 30 — Backend Hotfix Summary

**Class:** Hotfix (production cliff). Couch is live; Phase 30 (deployed 2026-05-03) migrated client wp writes to top-level `/watchparties/{wpId}` but only `rsvpSubmit.js` got the dual-resolution branch. Push notifications and guest RSVP for any wp created on/after 2026-05-03 are broken until these CFs deploy.

**Repo:** All edits land in `C:\Users\nahde\queuenight\` (Cloud Functions sibling repo). Couch repo untouched in this hotfix pass.

**Deploy command (when user is ready):**
```
cd C:\Users\nahde\queuenight && firebase deploy --only functions
```

**Pre-deploy:** Configure `ADMIN_UIDS` in `C:\Users\nahde\queuenight\functions\.env` as a comma-separated list of host UIDs allowed to invoke `wpMigrate`. Without this set, all `wpMigrate` calls return `permission-denied` (intentional — see CR-02 below).

---

## Findings Fixed

| Finding | File:Line | Commit | Notes |
|---------|-----------|--------|-------|
| **CR-01** (Phase 27 BL-04 family + Phase 30 push cliff) — watchparty triggers + watchpartyTick blind to top-level path | `functions/index.js:25` (v2 import), `functions/index.js:482-738` (new triggers + helper), `functions/index.js:935-985` (top-level sweep in watchpartyTick) | `6892489` | Adds v2 onDocumentCreated/onDocumentUpdated triggers on `/watchparties/{wpId}` that fan out per-family across `wp.families[]`. Preserves Phase 15.5 REQ-7 strip-body + REQ-8 per-receiver isolation. Legacy v1 nested triggers retained for pre-Phase-30 wps still living at the nested path. watchpartyTick gets a top-level sweep before the family loop (same flip-scheduled→active / archive-stale logic). |
| **BL-01** — rsvpStatus returns expired:true for all post-Phase-30 wps | `functions/src/rsvpStatus.js:39-58` | `cb89dc5` | Try top-level `db.doc('watchparties/' + token).get()` FIRST, fall back to legacy family-scan. Mirrors rsvpSubmit.js dual-resolution. |
| **BL-02** — rsvpRevoke throws not-found on revoke/close/attachPushSub | `functions/src/rsvpRevoke.js:67-91` | `3f3eb4d` | Same dual-resolution branch as BL-01. |
| **BL-03** — rsvpReminderTick never visits top-level wps | `functions/src/rsvpReminderTick.js:79-113` | `499d29c` | Build deduplicated `wpStream` covering both top-level (via `db.collection('watchparties')`) and legacy nested. Top-level pass sets a `processedTopLevelIds` set; nested pass skips ids already processed to avoid double-firing when `wpMigrate` left a nested twin behind (no-delete by design). |
| **CR-02** (= HIGH-2) — wpMigrate callable by any signed-in user (DoS amp + overwrite race) | `functions/src/wpMigrate.js:18-31` | `c7e9ede` | Added `ADMIN_UIDS` env-driven allowlist gate. Throws `permission-denied` for non-admin auth, `unauthenticated` for missing auth. |
| **HIGH-3** — wpMigrate produces permanently-unreadable wps when family has 0 authed members | `functions/src/wpMigrate.js:65-74` | `c7e9ede` | W4-style guard: skip migration when computed `memberUids.length === 0`. Counted in new `skippedNoMembers` return field. console.warn for ops debugging. |
| **MED-2** — wpMigrate `bulkWriter.set` overwrites concurrent writes (no merge) | `functions/src/wpMigrate.js:80-86` | `c7e9ede` | Added `{ merge: true }` option to `bulkWriter.set` so host edits during migration window aren't clobbered. |
| **HIGH-4** — `addFamilyToWp` `failed-precondition` toast leaks family-code existence | `functions/src/addFamilyToWp.js:73-83` | `8f2f9e9` | Collapsed zero-member case into the same neutral `not-found / 'No family with that code.'` copy used at lines 35, 41. Internal `console.warn` preserved for ops debugging. Closes the family-code existence oracle (P02-T-30-03 confidentiality). |
| **LOW-2** — `addFamilyToWp` read-check-write race (host on 2 devices → 9 families instead of 8) | `functions/src/addFamilyToWp.js:99-130` | `8f2f9e9` | Wrapped wp re-read + idempotency check + cap check + `tx.update` in `db.runTransaction`. Foreign-family member-roster read stays outside the tx (Firestore txs can't read after start; foreign roster is independent). |

---

## Findings Deferred (NOT addressed in this hotfix — flagged for follow-up)

| Finding | Reason | Plan |
|---------|--------|------|
| **HI-02** (Phase 27) — Zero rate limiting on unauth Cloud Functions (rsvpSubmit / rsvpStatus / rsvpRevoke) | Per user direction: defer to follow-up phase. Hotfix scope is the production cliff only. | Phase 30.x or Phase 31. Cleanest fix: App Check (recaptcha v3) gating on rsvp.html with `enforceAppCheck: true` on each onCall. Pragmatic alternative: Firestore-backed rate-limit doc keyed by token+IP+window. |
| **CR-10** (Phase 30) — memberUids cleanup CF for ex-members | Per user direction: defer to Phase 30.x. | Adds a triggered CF on `families/{code}/members/{id}` onDelete that removes the ex-member's uid from all wp.memberUids[] in their family. |
| **CR-12** (Phase 30) — cross-repo deploy ordering documentation | Per user direction: defer (separate doc PR later). | Adds a RUNBOOK section enumerating which repo deploys first when CF + client share a contract change. |

---

## Operational Notes

**ADMIN_UIDS env var (CR-02 fix):** Before redeploying, the operator must populate `C:\Users\nahde\queuenight\functions\.env` with a line like:
```
ADMIN_UIDS=uid1,uid2,uid3
```
Use the operator's own Firebase Auth UID (look up in the Firebase Console → Authentication → Users tab). Without this var set, every wpMigrate call will return `permission-denied`. Empty/missing var = effectively disables wpMigrate entirely (which is the safer default for a callable that touches all watchparties project-wide).

**Migration-window double-firing (BL-03 watch-out):** `wpMigrate` copies nested → top-level WITHOUT deleting the source nested doc. This means after migration, the same wp exists at TWO paths. The new BL-03 fix in rsvpReminderTick handles this by deduplicating via `processedTopLevelIds`. If a future cleanup CF starts deleting nested twins (CR-10 follow-up territory), the dedup logic stays correct (Set still works on whatever ids it sees).

**Legacy nested triggers preserved (CR-01):** The legacy v1 `onWatchpartyCreate` / `onWatchpartyUpdate` at `families/{familyCode}/watchparties/{wpId}` are unchanged. They continue to fire for any pre-Phase-30 wp still living at the nested path. New wps (Phase 30 client → top-level) trigger the new `onWatchpartyCreateTopLevel` / `onWatchpartyUpdateTopLevel`. Both paths can coexist indefinitely. When the migration soak completes (couch-v40 retired from active use per `firestore.rules:138-140` comment), the nested triggers can be deleted in a future phase.

**Verification (deferred to user):** Once deployed, smoke test:
1. Host creates a wp → all family members get the "New watchparty" push (verifies onWatchpartyCreateTopLevel fan-out).
2. Status → active → all participants get "Watchparty starting" push (verifies onWatchpartyUpdateTopLevel Branch 1).
3. Reaction posted → live receivers get full body, Wait Up receivers get strip body (verifies REQ-7 / REQ-8 preservation in the new trigger).
4. Guest RSVPs to a new wp → 30s status poll returns non-expired (verifies BL-01).
5. Host kebab → Remove guest → toast shows "Removed" not "Couldn't remove" (verifies BL-02).
6. Host adds family code → 8-family cap holds under concurrent calls (verifies LOW-2 transaction).
7. Admin runs wpMigrate after configuring ADMIN_UIDS → succeeds; non-admin call returns permission-denied (verifies CR-02).

---

_Applied: 2026-05-03_
_By: Claude (gsd-code-fixer) — Opus 4.7 (1M context)_
_Repo: C:\Users\nahde\queuenight (sibling Cloud Functions repo)_
_Couch repo: untouched_
