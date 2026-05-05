# Wave 5A — Phase 27 Deferred Review Hotfixes

**Date:** 2026-05-03
**Repo:** `C:\Users\nahde\queuenight\` (queuenight-only — couch repo untouched)
**Source review:** Phase 27 code review — MD-01, MD-02, MD-03, HI-01, HI-02 (all previously deferred)
**Parallel agents this wave:** couch-repo agent + CR-10 onMemberDelete agent (separate file territories — no conflicts)
**Deploy status:** NOT deployed yet (per task scope — fix-only, no firebase deploy)

---

## Summary

| Finding | Status | Commit | Files |
|---------|--------|--------|-------|
| MD-01 | Fixed | `db263c7` | `functions/src/rsvpSubmit.js` |
| MD-02 | Fixed | `7f2c118` | `functions/src/rsvpReminderTick.js` |
| MD-03 | Fixed | `fc4ef2a` | `functions/src/rsvpSubmit.js` |
| HI-01 | **Deferred** | — | `functions/src/rsvpStatus.js` (no edit) |
| HI-02 | Fixed | `c1d098e` | `functions/src/_rateLimit.js` (new) + `rsvpSubmit.js` + `rsvpStatus.js` + `rsvpRevoke.js` |

4 of 5 fixed; 1 deferred-pending-schema-change (HI-01).

---

## MD-01 — Revoked guest re-submit no longer false-confirms

**Commit:** `db263c7`
**File:** `functions/src/rsvpSubmit.js` (after `currentGuests` declaration; ~line 165)

**Before:** A guest whose RSVP the host had revoked could re-load `rsvp.html` and re-submit. The CF would update the existing revoked row's `response` field and return `success:true` with a "See you there" toast. The next 30s `rsvpStatus` poll would flag `revoked:true` and evict them — a jarring 30-second false-success window.

**After:** After wp lookup, before the runTransaction merge, check if the supplied `guestId` matches a row with `revoked === true`. If yes, throw `HttpsError('failed-precondition', 'This invite was withdrawn — ask the host for a new link.')`. The CF never silently re-adds or updates a revoked guest.

**Verification:** `node -c functions/src/rsvpSubmit.js` clean. Re-read confirmed the gate sits between wp lookup and the runTransaction merge.

---

## MD-02 — Dead-sub prune endpoint-match guard

**Commit:** `7f2c118`
**File:** `functions/src/rsvpReminderTick.js` (lines ~307-344)

**Before:** When `webpush.sendNotification` returned 410/404, the prune transaction blindly nulled `wp.guests[idx].pushSub`. Concurrent with this, `rsvpRevoke action='attachPushSub'` could write a fresh pushSub for the same guest. If the prune ran after the attach, the freshly-attached subscription was silently nullified — guest stops receiving reminders despite a healthy subscription.

**After:** Inside the prune transaction, compare the current endpoint at `gs2[idx].pushSub.endpoint` against the endpoint that just failed (`gs.pushSub.endpoint`). Only null `pushSub` when they match. If they differ (a concurrent attach landed between the failed send and this prune), log `[MD-02] skip prune; endpoint differs for ...` and return without writing. The dead endpoint is already gone from Firestore; the new endpoint is fine.

**Verification:** `node -c` clean. Re-read confirmed the comparison runs inside the transaction (so `gs2[idx].pushSub` reflects latest committed state). `failedEndpoint` is captured before the transaction to avoid closure shadowing.

---

## MD-03 — NFKC normalize + reject empty-after-normalize

**Commit:** `fc4ef2a`
**File:** `functions/src/rsvpSubmit.js` (new helper at top + call site swap)

**Before:** Name validation was `(name || '').toString().trim().slice(0, 40)`. A guest could submit `'Alex<NBSP>'` (or fullwidth/multi-space variants) to bypass the within-family same-name `(guest)` suffix-suppression heuristic — UI rendered as 'Alex' but string-comparison treated the row as a different name and skipped the suffix.

**After:** New `normalizeGuestName(raw)` helper applies `String.prototype.normalize('NFKC')` (folds NBSP→space, fullwidth→ASCII, etc.), collapses whitespace runs to a single space, trims, and slices at 40 chars (preserves the existing length cap — not widened to the spec'd 80, to keep hotfix surface minimal). Empty-after-normalize throws `HttpsError('invalid-argument', 'Tell us your name to RSVP.')` with the user-spec'd message.

**Verification:** `node -c` clean. Re-read confirmed `cleanName = normalizeGuestName(name)` swap-in, helper sits above `exports.rsvpSubmit`.

---

## HI-01 — DEFERRED (pending wp-schema change)

**File:** `functions/src/rsvpStatus.js` (post-Wave-1 BL-01 family-scan fallback at ~line 48)

**Investigation:** Per task instruction, checked whether wp docs stamp an `id` or `wpId` field that a `collectionGroup('watchparties').where('wpId', '==', token)` query could use. Reviewed:

- `functions/src/wpMigrate.js:76-81` — uses `Object.assign({}, wpData, { hostFamilyCode, families, memberUids, crossFamilyMembers })`. Does NOT stamp `id` or `wpId`.
- `functions/index.js:1306-1325` (Flow B nominate auto-convert wp creation) — explicitly enumerated payload fields (`status`, `hostId`, `hostUid`, `titleId`, `startAt`, `hostFamilyCode`, `families`, `memberUids`, `crossFamilyMembers`, etc.). No `id`/`wpId` stamping.
- The collectionGroup approach using `FieldPath.documentId()` matches the FULL doc path (e.g. `watchparties/abc123` vs `families/x/watchparties/abc123` are different paths to the same id), so it can't substitute for a stamped field.

**Decision:** Deferred. Per the task instruction's explicit guidance:

> "If they stamp `id`, use the collectionGroup query. If neither, the simplest correct fix is to keep the family-scan but cap at the first hit (already does). Investigate first by reading 2-3 wp-create sites... If they stamp `id`, use the collectionGroup query. If not, document HI-01 as deferred-pending-wp-schema-change and skip this fix (don't make a half-fix)."

The current family-scan with break-on-first-hit is correct and acceptably fast at the current ~5-10 family count. A real fix requires stamping `wpId: wpRef.id` at every wp-create site (Phase 11 confirmStartWatchparty, Phase 30 client wp creation, Flow B auto-convert in index.js, wpMigrate.js), then a one-shot backfill migration over `families/*/watchparties/*` and `/watchparties/*` to populate the field on existing docs. That's a Phase-30+ schema-evolution task, not a Wave 5A hotfix.

**Future work:** Tracked as HI-01-deferred. When the family count crosses ~50, re-evaluate — the O(N) scan starts to bite.

---

## HI-02 — Per-instance rate limiting on unauth Phase 27 CFs

**Commit:** `c1d098e`
**Files:**
- NEW: `functions/src/_rateLimit.js` (private internal helper — NOT exported from index.js)
- WIRE: `functions/src/rsvpSubmit.js` (top of handler)
- WIRE: `functions/src/rsvpStatus.js` (top of handler)
- WIRE: `functions/src/rsvpRevoke.js` (top of handler)

**Before:** All three Phase 27 unauth callable CFs accepted unlimited requests per source IP. Anyone with a valid wp token (or just a valid token-shape regex match) could trigger thousands of Firestore reads/writes per second.

**After:** New `_rateLimit.js` module exposes `rateLimit(key, max, windowMs)` backed by an in-memory `Map<key, {count, resetAt}>` with opportunistic GC every 5 minutes via an `unref()`'d `setInterval`. Per-instance, per-process — NOT distributed. Sufficient defense-in-depth for 2nd-gen functions where instance count scales under load (an attacker would have to find one instance hot enough to exhaust before a fresh one spins up).

**Per-CF caps:**
| CF | Cap | Window | Rationale |
|----|-----|--------|-----------|
| `rsvpSubmit` | 10 | 60s/IP | Writes; most expensive |
| `rsvpStatus` | 60 | 60s/IP | Poll cadence 30s — 2x normal + headroom |
| `rsvpRevoke` | 30 | 60s/IP | Host actions + guest pushSub attach |

**Throw shape:** `HttpsError('resource-exhausted', 'Too many requests — slow down.')`

**IP source:** `request.rawRequest.headers['x-forwarded-for']`, first comma-separated entry, trimmed; falls back to `'unknown'` if absent.

**Privacy of helper:** NOT added to `functions/index.js` exports — internal-only, no public callable surface.

**Verification:**
- `node -c` clean on all 4 files.
- Smoke-test via `node -e`: confirmed module loads, exports `rateLimit`, allows up to `max`, returns `false` when exhausted, process exits cleanly (unref'd timer doesn't pin the event loop).
- Re-read all three CF handlers — rate-limit gate sits at the very top, before any input validation or Firestore read.

---

## Out-of-scope (untouched per task spec)

- `functions/src/onMemberDelete.js` — CR-10 agent territory.
- Any new file containing `memberLeave` / `memberCleanup` — CR-10 agent territory. Confirmed via `git log --oneline` that CR-10 commits (`1632f38`, `c103d09`) landed concurrently in this branch but touched only those files.
- Couch repo (`C:\Users\nahde\claude-projects\couch\`) — separate parallel agent.
- Firebase deploy — NOT run; task scope was fix-only. User to deploy when ready.

---

## Final commit chain (queuenight `main`)

```
c1d098e feat(security): _rateLimit.js helper + wire into rsvpSubmit/Status/Revoke (HI-02)
c103d09 chore: export onMemberDelete from functions/index.js              [CR-10 agent]
1632f38 feat(security): onMemberDelete CF cleans stale memberUids ...     [CR-10 agent]
7f2c118 fix(phase-27): dead-sub prune checks for concurrent attach race (MD-02)
fc4ef2a fix(phase-27): NFKC-normalize guest names; reject empty after normalize (MD-03)
db263c7 fix(phase-27): rsvpSubmit denies revoked-guest re-submit (MD-01)
```

Working tree clean. 4 fixes shipped, 1 deferred-with-rationale (HI-01).
