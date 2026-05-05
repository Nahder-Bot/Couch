---
phase: 27-guest-rsvp
reviewed: 2026-05-03T00:00:00Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - C:/Users/nahde/claude-projects/couch/rsvp.html
  - C:/Users/nahde/claude-projects/couch/js/app.js (Phase 27 surfaces only)
  - C:/Users/nahde/claude-projects/couch/firestore.rules (Phase 27 block)
  - C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js
  - C:/Users/nahde/queuenight/functions/src/rsvpStatus.js
  - C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js
  - C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js
  - C:/Users/nahde/queuenight/functions/src/wpMigrate.js
findings:
  blocker: 4
  high: 2
  medium: 3
  low: 1
  info: 1
  total: 11
status: issues_found
---

# Phase 27: Guest RSVP — Code Review

**Reviewed:** 2026-05-03
**Depth:** deep (cross-repo: couch + queuenight + Phase 30 interaction)
**Files Reviewed:** 6 source files + 1 cross-phase migration helper
**Status:** issues_found — 4 BLOCKERs, 2 HIGH, 3 MEDIUM, 1 LOW, 1 INFO

## Summary

Phase 27 ships clean as a Phase 11 follow-on: rsvpSubmit / rsvpStatus / rsvpRevoke / rsvpReminderTick mesh correctly **for wps that still live at the legacy nested path** `families/{code}/watchparties/{wpId}`. But Phase 30 / Plan 02 (deployed 2026-05-03, today) migrated all wp creation to top-level `/watchparties/{wpId}` via `watchpartyRef = doc(db, 'watchparties', id)` (js/app.js:1939). **Three of the four Phase 27 Cloud Functions and the host-side `openRsvps` reopen path were never updated to look at the top-level path.** Only `rsvpSubmit.js` got the dual-resolution branch. The result: any guest RSVPing to a wp created on or after 2026-05-03 will see "expired" within 30 seconds of a successful RSVP, no host can revoke or close, no guest can attach a push subscription, and no guest will ever receive a reminder push.

This is the dominant story in the review — BLOCKERs B-01 through B-04 are all the same regression class and will all be closed by a single set of edits patching the four file sites. Beyond the Phase 30 cliff, the review surfaces an O(N) family-scan on every 30-second status poll (HIGH), absent rate-limiting on unauth callable CFs (HIGH), and a small set of edge-case races and UX polish gaps.

The smoke tests do not catch any of B-01..B-04 because the smoke harness greps source-code substrings (`rsvpStatus.js` exports a function, etc.) without exercising the Phase 30 top-level path against a migrated wp doc. The 47 passing sentinels confirm shape, not behavior across the migration boundary.

## BLOCKER Issues

### BL-01: rsvpStatus does not resolve top-level wps after Phase 30 → confirmation flips to "expired" within 30s for ALL new wps

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js:39-52`
**Severity:** BLOCKER
**Confidence:** >95%

`rsvpStatus` uses the legacy family-scan only:
```js
const familiesSnap = await db.collection('families').get();
let wpDoc = null;
for (const f of familiesSnap.docs) {
  const candidateRef = db.collection('families').doc(f.id).collection('watchparties').doc(token);
  const candidateDoc = await candidateRef.get();
  if (candidateDoc.exists) { wpDoc = candidateDoc; break; }
}
if (!wpDoc) {
  return { expired: true, revoked: false, closed: false, guestCount: 0 };
}
```

But `confirmStartWatchparty` at js/app.js:11244-11245 writes the new wp via `setDoc(watchpartyRef(id), ...)` and `watchpartyRef(id) = doc(db, 'watchparties', id)` (js/app.js:1939). Top-level only. The nested path scan returns no docs → `expired:true` is returned for every status poll on every post-2026-05-03 wp.

**Repro:** Host creates wp on couchtonight.app today. Share link to a guest. Guest opens /rsvp/<wpId>, RSVPs Going. rsvpSubmit succeeds (it has the Phase 30 dual-resolution branch at rsvpSubmit.js:97-128). renderConfirmation fires. startStatusPoll begins polling at 30s intervals (rsvp.html:219-243). First poll (T+30s): rsvpStatus returns `{expired:true,...}`. rsvp.html:236-239 renderExpired() fires → guest sees "This invite has expired."

**Fix:** Mirror the rsvpSubmit dual-resolution branch.
```js
// At top of handler, replace the family-scan block with:
let wpDoc = null;
const topLevelDoc = await db.doc('watchparties/' + token).get();
if (topLevelDoc.exists && topLevelDoc.data() && topLevelDoc.data().hostFamilyCode) {
  wpDoc = topLevelDoc;
} else {
  const familiesSnap = await db.collection('families').get();
  for (const f of familiesSnap.docs) {
    const candidateRef = db.collection('families').doc(f.id).collection('watchparties').doc(token);
    const candidateDoc = await candidateRef.get();
    if (candidateDoc.exists) { wpDoc = candidateDoc; break; }
  }
}
if (!wpDoc) return { expired: true, revoked: false, closed: false, guestCount: 0 };
```

---

### BL-02: rsvpRevoke does not resolve top-level wps → host kebab "Remove" + "Close RSVPs" + guest push opt-in all throw not-found

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js:67-82`
**Severity:** BLOCKER
**Confidence:** >95%

Same regression as BL-01. Lines 67-82 scan only the legacy nested path:
```js
const familiesSnap = await db.collection('families').get();
let wpRef = null;
let wpDoc = null;
for (const f of familiesSnap.docs) {
  const candidateRef = db.collection('families').doc(f.id).collection('watchparties').doc(token);
  ...
}
if (!wpRef || !wpDoc) {
  throw new HttpsError('not-found', 'Watchparty not found.');
}
```

This breaks all three actions for new wps:
- **action='revoke'** — js/app.js:4480 `window.revokeGuest`. Catch at line 4489-4496 surfaces toast `"Couldn't remove {name}. Try again."`. Host UAT-27-04 will fail.
- **action='close'** — js/app.js:4499 `window.closeRsvps`. Catch at 4511-4514 surfaces toast `"Couldn't close RSVPs. Try again."`. Host UAT-27-05 first half will fail.
- **action='attachPushSub'** — rsvp.html:291-304. The CF throws → fetch returns the error JSON → rsvp.html:298-300 calls `replacePushBlock('rsvp-push-err', ...)`. UAT-27-02 will fail (push opt-in goes straight to error state on every Allow).

**Fix:** Same dual-resolution branch as BL-01, applied at lines 67-82.

---

### BL-03: rsvpReminderTick only enumerates legacy nested wps → guests on top-level wps NEVER receive reminder pushes

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js:79-82`
**Severity:** BLOCKER
**Confidence:** >95%

```js
const families = await db.collection('families').get();
for (const familyDoc of families.docs) {
  const wpSnap = await db.collection('families').doc(familyDoc.id).collection('watchparties').get();
```

The scheduled CF iterates `families/*/watchparties/*` — never visits the new top-level `/watchparties/{wpId}` collection. New wps are entirely invisible to the reminder tick. Member reminders also broken on new wps (Phase 11 regression collateral, not Phase 27-introduced — but Phase 27 owns the guest loop expansion).

This silently invalidates RSVP-27-10 (reminders fire on schedule) AND RSVP-27-11 (dead-sub prune) for the entire post-2026-05-03 wp population. UAT-27-09 + UAT-27-10 will both be blocked from passing.

**Fix:** Add a parallel enumeration of the top-level collection alongside the family-scoped scan. The existing per-family `hostName` lookup (line 106) needs `wp.hostFamilyCode` from the top-level doc to drive the members lookup. Sketch:
```js
// After the existing family-loop, add:
const topLevelSnap = await db.collection('watchparties').get();
for (const doc of topLevelSnap.docs) {
  const wp = doc.data();
  const familyCode = wp && wp.hostFamilyCode;
  if (!familyCode) continue;  // unmigrated/legacy — skip; they're handled by the nested loop
  // ... duplicate the per-wp body, or refactor it into a function called from both loops.
  // hostName resolution at line 106 reuses familyCode from wp.hostFamilyCode here.
}
```

**Watch-out:** the existing nested scan will find wps that were ALSO migrated to top-level by wpMigrate.js (which `set()`s them at top-level WITHOUT deleting the source nested doc — see wpMigrate.js:50). After both scans, the same wp at both paths will get processed twice. De-dup by `doc.id` across both scans before sending pushes, OR change the nested scan to skip wps where a top-level mirror exists.

---

### BL-04: window.openRsvps writes to the WRONG Firestore path → "Open RSVPs" silently fails on all post-Phase-30 wps; rsvpClosed pill never clears

**File:** `C:/Users/nahde/claude-projects/couch/js/app.js:4525`
**Severity:** BLOCKER
**Confidence:** >95%

```js
window.openRsvps = async function(wpId) {
  ...
  const wpRef = doc(db, 'families', state.familyCode, 'watchparties', wpId);
  await updateDoc(wpRef, { rsvpClosed: false });
  flashToast('RSVPs reopened.', { kind: 'success' });
```

This is the symmetric mistake to BL-01..BL-03 on the client side. After Phase 30, wps live at `/watchparties/{wpId}` only. The `updateDoc` here either:
1. Throws "no document to update" (if the nested doc never existed because the wp was created post-Phase-30) — caught at line 4528, host sees toast `"Couldn't reopen RSVPs. Try again."`
2. Or, even worse, `updateDoc` on a non-existent doc actually throws in the Web SDK — but if rules pre-deny, the host sees a permission-denied error in console. Either way, the toast says success or failure depending on which error fires first; the actual top-level `wp.rsvpClosed=true` flag NEVER clears.

The rsvpClosed pill (buildWpClosedPillHtml at js/app.js:11822) reads `wp.rsvpClosed === true` from the live wp snapshot. Since the snapshot subscribes to the top-level doc which was never updated, the pill stays. Host believes RSVPs are reopened (per the optimistic toast on success path 1, OR sees an error and is confused on path 2). New guest tries to RSVP → rsvpSubmit reads top-level `wp.rsvpClosed === true` → returns `{closed:true}` → guest sees "RSVPs are closed for this party."

**Fix:** Change line 4525 to use `watchpartyRef(wpId)`:
```js
const wpRef = watchpartyRef(wpId);
await updateDoc(wpRef, { rsvpClosed: false });
```
This will hit the top-level path that the rest of the codebase uses. Note: this also requires Phase 30's firestore.rules top-level `/watchparties/{wpId}` block to allow non-host-forbidden field writes by the host — verify before patching.

---

## HIGH Issues

### HI-01: Every 30s rsvpStatus poll triggers an O(families) Firestore scan; family count grows linearly with userbase → DoS-prone surface for unauth pollers

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js:40-49` (and rsvpRevoke.js:68-79, rsvpReminderTick.js:79)
**Severity:** HIGH
**Confidence:** >90%

After fixing BL-01..BL-03 to look at top-level FIRST (O(1)), the secondary fallback still does a full `db.collection('families').get()` per request. Every connected guest tab polls rsvpStatus every 30s. With family count F and connected guests G, baseline read ops are F*G/30s. At F=1000 families, G=50 connected guests, that's ~1700 reads/sec from rsvpStatus alone (50 polls/30s × 1000 family doc reads + per-family wp doc gets) — plus the unauth attacker who can simply hammer rsvpStatus with random tokens that pass `looksLikeWpId` and force a full scan per request (no rate limit, see HI-02).

**Repro:** `for i in {1..600}; do curl -s -X POST 'https://us-central1-queuenight-84044.cloudfunctions.net/rsvpStatus' -H 'Content-Type: application/json' -H 'Origin: https://couchtonight.app' --data '{"data":{"token":"AAAAAAAAAAAAA0000000"}}' & done; wait` — this issues 600 simultaneous unauth requests, each forcing a full family-scan (every existing family doc + a per-family wp doc.get). At growth scale this is a DoS vector.

**Fix:** Once BL-01..BL-03 patch top-level lookup as the FIRST resolution step, also remove the legacy fallback after a transition window (Phase 30 wpMigrate has already run; pre-migration wps that haven't been migrated are stale enough to consider expired). If the nested fallback must stay, gate it behind a feature flag or remove from rsvpStatus entirely (highest-frequency caller); keep rsvpSubmit / rsvpRevoke fallbacks for deploy-window edge cases (already commented in rsvpSubmit.js:82-96).

**Compounding factor with HI-02:** an attacker hammering rsvpStatus is amplified by O(families) per request.

---

### HI-02: Zero rate limiting on unauth Cloud Functions rsvpSubmit / rsvpStatus / rsvpRevoke (anti-spam in CONTEXT but never implemented)

**File:** All four CFs in `C:/Users/nahde/queuenight/functions/src/rsvp*.js`
**Severity:** HIGH
**Confidence:** >95%

Searched for `rateLimit|throttle|RateLimiter|rate_limit|rate-limit` across queuenight/functions/src — zero matches. CONTEXT.md mentions "rateLimit on rsvpSubmit, captcha pattern" but neither shipped. The 100-guest soft cap (rsvpSubmit.js:157-159) is a per-wp guardrail, not a rate limit.

Risks under burst (10 RPS for 60s = 600 requests):
1. **Guest cap exhaustion:** attacker spams 100 unique random guestIds against a target wpId → rsvpSubmit fills wp.guests[] up to the 100 cap. Real guests get `{guestCapReached:true}` → can't RSVP. Host has to manually revoke 100 spam entries.
2. **Read amplification via family-scan** (paired with HI-01): each unauth call costs F+1 Firestore reads. 600 reqs × 1000 families = 600K reads in 60s → blows past free-tier and even paid Blaze quotas.
3. **Push spam:** an attacker who learns one valid guestId+token pair can call rsvpRevoke action='attachPushSub' repeatedly with different pushSub values, each one transactionally rewriting wp.guests. With runTransaction contention, they can stall legitimate RSVP writes.

**Fix:** Add a per-token (and ideally per-IP) rate limiter. The Firebase Functions v2 platform doesn't provide one out-of-the-box; common patterns are:
- An in-memory LRU + token-bucket per CF instance (caveat: instances are warm-pooled, not sticky).
- A Firestore-backed rate-limit doc keyed by token+IP+windowStart (pricey: every CF call adds 1 read + 1 write).
- App Check (recaptcha v3) gating on rsvp.html — the cleanest fix; `rsvpSubmit` registers an `enforceAppCheck: true` option in onCall config, rsvp.html attaches the App Check token. App Check is the right Phase 30.x followup.

Pragmatic Phase 27 hotfix: token-bucket in CF process memory keyed by `request.rawRequest.ip + token`, with bucket=10/60s. Drop on overflow with `resource-exhausted`.

**Note:** The CONTEXT comment at rsvpSubmit.js:11-22 names "Tampering / Repudiation / DoS" mitigations and says "Token shape regex rejects malformed tokens BEFORE Firestore read (DoS)." That regex blocks malformed tokens but does not block well-formed-but-invalid tokens that still trigger the family scan. The DoS mitigation as documented does not cover this case.

---

## MEDIUM Issues

### MD-01: Repeat submit by a revoked guest preserves revoked:true silently → user sees fake "See you there" confirmation, then 30s later "Your RSVP was removed by the host"

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js:188-197`
**Severity:** MEDIUM
**Confidence:** >90%

```js
} else {
  // Repeat submit — update response + name + rsvpAt; preserve guestId/pushSub/revoked/expiresAt.
  const prev = guests[existingIdx] || {};
  guests[existingIdx] = Object.assign({}, prev, {
    name: cleanName || prev.name || 'Guest',
    response: response,
    rsvpAt: Date.now()
  });
  resultGuestId = prev.guestId;
}
```

The `Object.assign({}, prev, {...})` correctly preserves `revoked: true` from prev. But the function continues at line 199-207, computes `visible` (which excludes the still-revoked guest), and returns `success: true` with `guestCounts`. The client at rsvp.html:209 calls `renderConfirmation(resp, hostName, counts)` showing "See you there" (yes) / "Noted" (maybe). 30 seconds later, the rsvpStatus polling detects `revoked:true` and flips to evicted state.

The user sees a misleading sequence: (a) RSVP'd successfully → (b) "Your RSVP was removed by the host." This is correct from a server-state perspective but reads like a bug from the user's perspective and creates support burden ("I just RSVP'd!").

**Repro:** Host invites guest, guest RSVPs Going, host kebab → Remove. Guest taps Going again on the same browser (rsvp.html still loaded, or revisits the link). Confirmation page renders "See you there." 30s later: "Your RSVP was removed by the host."

**Fix:** Detect revoked at submit-time and short-circuit:
```js
const existingIdx = guestId ? guests.findIndex(g => g && g.guestId === guestId) : -1;
if (existingIdx !== -1 && guests[existingIdx] && guests[existingIdx].revoked === true) {
  // Don't revive a revoked guest. Return revoked state directly so client renders evicted.
  return { revoked: true };
}
```
And add a `data.result.revoked` branch in rsvp.html submitRsvp around line 186 to call `renderRevoked()`.

---

### MD-02: Race between rsvpRevoke action='attachPushSub' and rsvpReminderTick dead-sub prune can null out a freshly-attached subscription

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js:235-244`
**Severity:** MEDIUM
**Confidence:** >85%

The prune transaction:
```js
await db.runTransaction(async (tx) => {
  const snap = await tx.get(doc.ref);
  ...
  const idx = gs2.findIndex(g => g && g.guestId === gs.guestId);
  if (idx === -1) return;
  gs2[idx] = Object.assign({}, gs2[idx], { pushSub: null });
  tx.update(doc.ref, { guests: gs2 });
});
```

It nulls `pushSub` based on a stale 410/404 from `webpush.sendNotification(gs.pushSub, ...)` (line 228). But by the time the transaction commits, the guest may have re-subscribed via rsvpRevoke action='attachPushSub' (rsvpRevoke.js:103-130) with a NEW endpoint. The runTransaction will read the fresh pushSub but blindly null it, because the prune doesn't compare `gs2[idx].pushSub.endpoint` against the dead `gs.pushSub.endpoint`.

Race window: small but real. A guest who notices a missed reminder and re-opts-in at the same moment as the next reminderTick cycle would lose the new sub.

**Fix:** Compare endpoints before nulling:
```js
if (gs2[idx].pushSub && gs2[idx].pushSub.endpoint === gs.pushSub.endpoint) {
  gs2[idx] = Object.assign({}, gs2[idx], { pushSub: null });
  tx.update(doc.ref, { guests: gs2 });
}
// else: a newer sub has been attached since the failed send; don't clobber.
```

---

### MD-03: `(guest)` collision suffix is case-sensitive on render but compared against lower-cased family member names; multi-byte/whitespace edge cases not covered

**File:** `C:/Users/nahde/claude-projects/couch/js/app.js:12565-12572`
**Severity:** MEDIUM
**Confidence:** >85%

```js
function displayGuestName(rawName, familyMemberNamesSet) {
  const name = rawName || 'Guest';
  const norm = name.trim().toLowerCase();
  if (familyMemberNamesSet && familyMemberNamesSet.has(norm)) {
    return name + ' (guest)';
  }
  return name;
}
```

Comparison is `trim().toLowerCase()`. Edge cases that will silently miss the suffix:
- Family member name `"Sam "` (trailing space) → set contains `"sam"`. Guest name `"sam"` → matches, suffix added. Good.
- Family member name `"Sam"`, guest name `"Sam "` (NBSP) → trim() does NOT strip NBSP → `"sam "` → set has `"sam"` → no match → suffix MISSED. Two "Sam"s on the roster, both look identical.
- Family member name `"José"`, guest name `"jose"` (no accent) → set has `"josé"` → no match → suffix missed despite visual collision.

Privacy/identity impact: a malicious guest who wants to impersonate a family member can submit `"Alex<U+00A0>"` (Alex + NBSP) and bypass the (guest) suffix. UAT-27-06 catches the basic case; this one is real-world more subtle.

**Fix:** Normalize both sides with NFKC + `\s+` collapse:
```js
function normalizeName(n) {
  return (n || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLowerCase();
}
function getFamilyMemberNamesSet() {
  return new Set((state.members || []).map(m => normalizeName(m.name)).filter(Boolean));
}
function displayGuestName(rawName, set) {
  const name = rawName || 'Guest';
  if (set && set.has(normalizeName(name))) return name + ' (guest)';
  return name;
}
```

---

## LOW Issues

### LO-01: rsvp.html does not check guestId-revoked state on cold load — a revoked guest re-opening the link sees the form again, can re-submit (server still preserves revoked, but UX is misleading)

**File:** `C:/Users/nahde/claude-projects/couch/rsvp.html:51-58`
**Severity:** LOW
**Confidence:** >90%

```js
if (!token) {
  renderExpired();
  return;
}
// v1: skip a read-only preview CF — let rsvpSubmit validate the token on tap.
// Render a minimal generic invite card so the form is actionable immediately.
renderInviteForm({ titleName: '', startTime: '', hostName: '', poster: '' });
```

If a revoked guest revisits `/rsvp/<token>` after the host kicks them, the form is rendered again. Tapping a button triggers MD-01 (fake confirmation, then 30s later the eviction flip). Better cold-load UX: if `localStorage[qn_guest_<token>]` is set, immediately call rsvpStatus once on load and render evicted/closed/expired before showing the form.

**Fix:** Insert before `renderInviteForm` at line 58:
```js
if (guestId) {
  // Quick status check before rendering form (saves the user from a fake submit).
  fetch(CF_BASE + '/rsvpStatus', { method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ data: { token, guestId } }) })
  .then(r => r.json()).then(d => {
    if (d && d.result) {
      if (d.result.revoked) { renderRevoked(); return; }
      if (d.result.closed) { renderClosed(); return; }
      if (d.result.expired) { renderExpired(); return; }
    }
    renderInviteForm({ titleName:'', startTime:'', hostName:'', poster:'' });
  }).catch(() => renderInviteForm({ titleName:'', startTime:'', hostName:'', poster:'' }));
} else {
  renderInviteForm({ titleName:'', startTime:'', hostName:'', poster:'' });
}
```

This ALSO requires BL-01 to be fixed first (otherwise every load returns expired:true on top-level wps).

---

## INFO

### IN-01: rsvpRevoke action='attachPushSub' validates `pushSub.endpoint.length < 8` — too lax; legitimate FCM/Mozilla push endpoints are >100 chars

**File:** `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js:60-64`
**Severity:** INFO
**Confidence:** >85%

```js
const pushSubInput = (request.data && request.data.pushSub) || null;
if (!pushSubInput || typeof pushSubInput !== 'object'
    || typeof pushSubInput.endpoint !== 'string' || pushSubInput.endpoint.length < 8) {
  throw new HttpsError('invalid-argument', 'Invalid pushSub object.');
}
```

`pushSub.endpoint.length < 8` permits a literal endpoint string `"http://x"` (8 chars) — clearly not a real push endpoint. Real endpoints from `pushManager.subscribe(...).toJSON()` are URLs like `https://fcm.googleapis.com/fcm/send/<token>` (>100 chars) or `https://updates.push.services.mozilla.com/wpush/v2/<token>` (>100 chars).

Not a security bug (no exploit vector — webpush.sendNotification with a bogus endpoint would just 404 and trigger the prune path), but it's effectively a no-op validation. Tighten to `endpoint.length >= 30 && /^https:\/\//.test(endpoint)` to reject obviously bogus inputs at the CF layer.

---

## Summary Table

| ID | File | Severity | Issue |
|----|------|----------|-------|
| BL-01 | rsvpStatus.js:39-52 | BLOCKER | No top-level wp lookup → every status poll returns expired on post-Phase-30 wps |
| BL-02 | rsvpRevoke.js:67-82 | BLOCKER | No top-level wp lookup → revoke/close/attachPushSub all throw not-found |
| BL-03 | rsvpReminderTick.js:79-82 | BLOCKER | No top-level wp enumeration → guests on new wps never get reminder pushes |
| BL-04 | js/app.js:4525 | BLOCKER | openRsvps writes the wrong Firestore path → rsvpClosed never clears |
| HI-01 | rsvpStatus.js:40-49 | HIGH | O(families) scan per status poll; growth-scale DoS-prone |
| HI-02 | All four CFs | HIGH | Zero rate limiting on unauth callable CFs; CONTEXT names anti-spam, never shipped |
| MD-01 | rsvpSubmit.js:188-197 | MEDIUM | Revoked guest re-submitting sees fake confirmation, then evicted 30s later |
| MD-02 | rsvpReminderTick.js:235-244 | MEDIUM | Dead-sub prune can null out a freshly-attached new subscription |
| MD-03 | js/app.js:12565-12572 | MEDIUM | (guest) suffix bypassable via NBSP / Unicode-normalization edge cases |
| LO-01 | rsvp.html:51-58 | LOW | Cold load doesn't check status — revoked guest sees form, hits MD-01 path |
| IN-01 | rsvpRevoke.js:60-64 | INFO | pushSub.endpoint.length < 8 is too lax |

## Priority Recommendation

**Hotfix scope (ship before any further Phase 27 UAT pass):** BL-01, BL-02, BL-03, BL-04. Single cross-repo deploy. Once shipped, smoke-aggregate + UAT-27-04/05 should pass; UAT-27-09/10 become testable.

**Phase 30.x followup:** HI-01 + HI-02 (rate-limit + App Check) — re-engages once families count grows past pilot scale. Couple with the legacy-nested-fallback removal once Phase 30 migration soak completes.

**Phase 27 polish (low-risk, ship anytime):** MD-01, MD-02, MD-03, LO-01, IN-01.

---

_Reviewed: 2026-05-03_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep (cross-repo, cross-phase Phase 27 + Phase 30)_
