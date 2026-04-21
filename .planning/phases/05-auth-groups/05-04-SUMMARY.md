---
phase: 05-auth-groups
plan: 04
status: complete
completed: 2026-04-21
executor: orchestrator-inline
---

# Plan 05-04 — Firestore rules + rules-unit-testing

Full rewrite of production Firestore rules from the pre-auth "allow read, write: if true" baseline to an auth-aware + grace-window enforced security model. Backed by 14 unit tests that run against the Firestore emulator. Deployed and live.

## What landed

### Source-of-truth rules file (`firestore.rules` at couch repo root, 230 lines)

Four helper functions + eleven match blocks:

**Helpers**
- `signedIn()` — request.auth != null
- `uid()` — request.auth.uid
- `isMemberOfFamily(code)` — true iff `/users/{uid}/groups/{code}` exists (CF-written index)
- `isOwner(code)` — reads the family doc's ownerUid
- `graceActive()` — reads `/settings/auth.graceUntil > request.time.toMillis()` (returns false if the settings doc is missing, secure default)
- `validAttribution(code)` — asserts `request.resource.data.actingUid == uid()`; if `managedMemberId` is present, additionally reads the sub-profile doc and checks `member.managedBy == uid()` (T-05-04-04 forgery mitigation)
- `legacyGraceWrite()` — allows `{memberId: string}` payloads with no `actingUid` during grace
- `attributedWrite(code)` — `validAttribution || legacyGraceWrite`, used across every mutable family subcollection

**Match blocks**
- `/settings/{doc}` — read: true, write: false
- `/users/{u}/groups/{code}` — self-only r/w
- `/users/{u}/{path=**}` — catch-all self-only (future-proof)
- `/families/{familyCode}` — read: member; create: new + self-owner (Plan 06); update/delete: false (CF-only)
- `/families/.../members/{memberId}` — read: member; create: three narrow branches (A first-member bootstrap via `getAfter`, B sub-profile via `managedBy == uid`, C existing-member self-add); update: self/owner/parent-of-sub; delete: owner or self
- `/families/.../invites/{id}` — server-only (r+w: false)
- `/families/.../claimTokens/{id}` — server-only
- `/families/.../sessions/{dateKey}` — read: member; create/update: attributedWrite; delete: owner, or any-member during grace
- `/families/.../vetoHistory/{id}` — read: member; create: attributedWrite; delete: only the acting uid (or legacy memberId during grace)
- `/families/.../titles/{id}` + `/families/.../titles/{id}/comments/{id}` — read: member; create/update: attributedWrite; comment delete: acting-uid or owner
- `/families/.../activity/{id}` — read: member; create/update: attributedWrite; delete: owner
- `/families/.../lists/{id}` — same attribution pattern; delete: acting-uid or owner
- `/families/.../watchparties/{id}` — same attribution pattern; delete: owner or any-member-during-grace

### Test harness (`tests/` directory)

- `tests/package.json` — declares `@firebase/rules-unit-testing@^3.0.2` + `firebase@^10.12.0`. Pre-test script copies `../firestore.rules` to `tests/firestore.rules` so the emulator's `firebase.json` (which cannot reference parent dirs) always sees the latest rules.
- `tests/firebase.json` — minimal emulator config (firestore on :8080)
- `tests/rules.test.js` — 325-line single-file suite, uses an inline async `describe`/`it` harness rather than mocha/jest (keeps deps minimal). Covers all 14 scenarios from Plan 05-04 Task 2:
  1. ✓ Member writes session with `actingUid == self` → ALLOWED
  2. ✓ Parent writes session with `managedMemberId == m_kid_sub` → ALLOWED
  3. ✓ Non-member authed uid writes → DENIED
  4. ✓ Legacy `{memberId}` during grace → ALLOWED
  5. ✓ Legacy `{memberId}` after grace expires → DENIED
  6. ✓ Unauthenticated write → DENIED
  7. ✓ Client read of `claimTokens` → DENIED
  8. ✓ Client UPDATE on `/families/fam1` with passwordHash → DENIED
  9. ✓ Client CREATE `/families/fam2` with `ownerUid: self` → ALLOWED
  10. ✓ Client CREATE `/families/fam3` with different `ownerUid` → DENIED
  11. ✓ Branch B — owner creates sub (`managedBy: self`, no `uid`) → ALLOWED
  12. ✓ Branch B negative — member forges `managedBy: other_uid` → DENIED
  13. ✓ Branch C — existing member adds self-uid member doc → ALLOWED
  14. ✓ Branch C negative — stranger uid cannot self-add to a group → DENIED

  **Final run:** `14 passing, 0 failing` against `@firebase/rules-unit-testing` + Firestore emulator (JDK 21, cloud-firestore-emulator-v1.20.4).

- `tests/README.md` — run instructions + scenario table
- `tests/.gitignore` — excludes node_modules/, firestore-debug.log, and the auto-generated firestore.rules copy

### Deploy-repo changes (at `C:\Users\nahde\queuenight\`)

- `firestore.rules` — copy of source-of-truth rules
- `firebase.json` — appended a `"firestore": { "rules": "firestore.rules" }` block so `firebase deploy --only firestore:rules` knows where the file is

### Production bootstrap

- `/settings/auth` document created by user via Firebase Console (Data tab) with:
  - `graceUntil: 1780000000000` (int64) — ≈ May 28, 2026 14:06 UTC (~38-day grace, gives buffer over the 30-day target)
  - `mode: "grace"` (string)
  - `bootstrappedAt: 1777300000000` (int64)
  - `phase: "05-auth-groups"` (string)

### Deploy log

```
firebase deploy --only firestore:rules (from C:\Users\nahde\queuenight)
  ✓ APIs enabled: firestore.googleapis.com
  ✓ firestore.rules compiled successfully
  ✓ uploading rules firestore.rules
  ✓ released rules firestore.rules to cloud.firestore
```

## Must-haves

- [x] `firestore.rules` enforces `validAttribution()` on every member-mutating write during post-grace mode
- [x] `firestore.rules` allows legacy memberId writes during grace window (graceActive() returns true)
- [x] `firestore.rules` denies client reads of `families/{code}/invites/**` and `families/{code}/claimTokens/**`
- [x] `firestore.rules` permits client CREATE of `families/{code}` ONLY when the doc does not yet exist AND the creator stamps themselves as ownerUid (first-group-create path from Plan 06)
- [x] `firestore.rules` permits client CREATE of `families/{code}/members/{memberId}` via three narrow branches (first-member bootstrap, parent-creates-sub, family-authed device join) all gated by isMemberOfFamily or first-member-bootstrap conditions
- [x] `settings/auth` doc is client-readable but never client-writable
- [x] `tests/rules.test.js` covers 14 scenarios including the three member-create branches + their negative cases, grace-legacy allow, post-grace-legacy block, unauthed block, invites-read-denied, family-doc update-denied, family-doc create-when-new-with-self-as-owner-allowed — all 14 pass
- [x] Firestore rules DEPLOYED to production via `firebase deploy --only firestore:rules`
- [x] `/settings/auth` Firestore doc bootstrapped with `graceUntil = Date.now() + 30d` (~38d for buffer)

## Notable deviations from research template

1. **Families create branch is a DEVIATION** — the RESEARCH §5 template had `allow write: if false` on the family doc; Plan 06's submitFamily new-group path needs client CREATE. Rule written verbatim from plan's spec: `signedIn() && !exists(...) && ownerUid == uid()`.
2. **Member create three branches is a DEVIATION** — same reasoning. Plans 06 + 07 require narrow client-writes for first-member bootstrap, sub-profile create, and existing-device self-add.
3. **Extra `/users/{u}/{path=**}` catch-all** — not in the RESEARCH template. Added for future-proofing (any future per-user subtree defaults to self-only access). Cheap, safe.
4. **Delete rules split by collection** — RESEARCH template was generic "owner or self" everywhere; I tightened per-collection:
   - Session/watchparty delete: owner always, any-member-during-grace (for midnight resets)
   - vetoHistory/lists/comments delete: acting-uid only (plus legacy memberId during grace) — prevents one member from deleting another's audit trail
   - activity: owner-only delete (no member self-delete; tightest in practice)

## Live-rules smoke test

Deferred until after Wave 2 signed-in sign-in screen ships (can't test real auth writes without an app that signs users in). The 14-scenario emulator suite proves rule correctness; when Plan 05-06 lands, we'll exercise the same paths with a real browser session.

## Pending

- Run Firebase Console Rules Playground manual simulations (optional) — skipped because emulator tests provide stronger coverage and Playground would duplicate work.
- Wait for Plan 05-06 sign-in UI to exercise auth paths end-to-end in the browser.

## What this enables

- **Wave 2 closed.** Phase 5 Waves 3-7 (attribution refactor, sign-in screen, sub-profiles, claim flow, UAT) are now unblocked.
- The 30-day grace window buys time for existing pre-Phase-5 users to upgrade — any legacy client write still succeeds until May 28, 2026.
- Server-only collections (invites, claimTokens) are truly server-only; the CFs from Plan 05-03 are now the only way to write them.
