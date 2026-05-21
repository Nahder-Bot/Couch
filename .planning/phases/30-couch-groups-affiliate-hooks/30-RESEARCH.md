# Phase 30: Couch Groups — Research

**Researched:** 2026-05-03
**Domain:** Firestore multi-family aggregation, Firestore security rules (cross-document access, collection group queries), vanilla-JS client-side wp roster render, watchparty doc-size budgeting
**Confidence:** HIGH (Firestore rules patterns verified against official docs; brownfield code verified by direct read)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Phase 30 ships couch groups only. Affiliate referral hooks carved out to future Phase 30.1.
- **D-02** — v1 monetization guardrail does NOT apply to Phase 30 (affiliate fully deferred).
- **D-03** — ROADMAP.md narrative + slug rename pending (first task of plan-phase).
- **D-04** — Cross-family is watchparty-only. Tonight matches, queues, votes, mood tags, push prefs all stay per-family.
- **D-05** — Ad-hoc per-wp via family-code paste. No persistent `couchGroups/{groupId}` entity. Lifetime auto-caps with `WP_ARCHIVE_MS` (~25h post-start).
- **D-06** — Full identity cross-family: cross-family wp members appear in roster with real names + avatars; votes/reactions/RSVPs visible to all wp members.
- **D-07** — Host-only invite authority. No chain-invites, no open-invite tokens.
- **D-08** — Soft cap of 4 families per wp. Client-side guard above 4; server-side hard ceiling (planner picks upper bound; 8 suggested).
- **D-09** — Family-attributed roster only on name collision. `Sam (Smiths)` render-time disambiguation, never stored in Firestore.

### Claude's Discretion

- **Firestore wp-doc location** — stay nested under `families/{code}/watchparties/{wpId}` with rules extension vs migrate to top-level `/watchparties/{wpId}`.
- **Rules extension shape** — exact `firestore.rules` predicate granting cross-family read access.
- **Reaction attribution shape** — `actorFamilyCode` on `wp.reactions[]` rows or derive at render time.
- **CF changes** — whether any new CFs are needed (e.g., `addFamilyToWp`).
- **UI placement** — where the "+ Add a family" affordance lives.
- **Member denormalization strategy** — denormalize cross-family member rows onto wp doc at invite time vs runtime fan-out reads.
- **Migration approach for existing wps** — treat absent `wp.families` as `[hostFamilyCode]`.
- **Kick / remove a cross-family family flow** — host's ability to un-invite Family Y mid-wp.

### Deferred Ideas (OUT OF SCOPE)

- Affiliate referral hooks (Phase 30.1)
- Persistent "couch group" entity
- Open-invite cross-family link
- Per-member individual cross-family invite
- Cross-family Tonight matches / queues / votes
- Family-color tinted avatar palette
- Cross-family family-doc read access
</user_constraints>

---

## Summary

Phase 30 adds cross-family watchparties to Couch: the host can paste another family's code at wp-create (or via wp-edit), and members from that family join the same wp surface with full identity. The technical heart of this phase is a Firestore rules + data-model decision: **where does the cross-family wp document live, and how does a member from Family B get read access to a wp that belongs to Family A?**

The key research finding is that staying nested under `families/{hostCode}/watchparties/{wpId}` is **architecturally broken for cross-family reads**. Firestore security rules can grant document-level read access using `request.auth.uid in resource.data.memberUids` but cannot grant *collection-query* access to documents nested under a parent path the querying user doesn't own. Family B's member runs `watchpartiesRef()` which queries `families/{hostCode}/watchparties` — and `isMemberOfFamily(hostCode)` is `false` for them. The current subscription pattern therefore silently drops cross-family wps from Family B's view entirely.

The correct architectural solution is to **migrate watchparties to a top-level `/watchparties/{wpId}` collection** and use a `memberUids[]` denormalized array field for both rules and client-side `array-contains` queries. This is the canonical Firestore pattern for multi-tenant shared documents [VERIFIED: official Firebase docs + Doug Stevenson's group-permissions article]. It unblocks collection-group queries, makes the rules predicate clean (`request.auth.uid in resource.data.memberUids`), and future-proofs reactions, guests, and replay which all live on the wp doc.

The blast radius of the migration is bounded: existing `families/{code}/watchparties` docs stay where they are; a one-shot backfill CF copies them to the top-level collection with `memberUids` stamps. Phase 24 / 26 / 27 existing wp patterns (hostUid field, Path A/B rules split, guests[] admin-SDK write, rsvpSubmit CF scan) all carry forward cleanly with a `familyCode` field retained on the top-level doc for `rsvpSubmit`'s scan pattern.

**Primary recommendation:** Migrate watchparties to a top-level collection. Add `wp.memberUids: string[]` (all UIDs of all member docs across all families in the wp). Use `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` as the new subscription query. This is the only path that satisfies both rules (document-level read) and queries (collection-level enumeration) for cross-family members.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Family-code validation (cross-family invite) | API / Backend (CF) | — | Family docs are server-side trust boundary; client cannot safely verify another family's code exists without server validation |
| `wp.families[]` write + `wp.memberUids[]` fan-out | API / Backend (CF) | Client-direct-write (fallback) | Atomicity + audit trail; memberUids fan-out must include UIDs from foreign family's members subcollection, which client cannot read |
| Roster render + collision detection | Browser / Client | — | Render-time logic; no Firestore writes; pure client-side `state.members` + cross-family denormalized rows on wp doc |
| Cross-family `(FamilyName)` suffix | Browser / Client | — | Render-time disambiguation per D-09; never stored |
| Firestore `memberUids` rules predicate | Database / Storage | — | Document-level read gate; rules-only change in `firestore.rules` |
| `collectionGroup('watchparties')` subscription | Browser / Client | — | New client query replacing `families/{code}/watchparties` collection query |
| Wp doc migration (existing nested → top-level) | API / Backend (CF) | — | One-shot backfill; admin-SDK bypass for rules on source docs |

---

## Standard Stack

### Couch Groups — Core (Firestore SDK, already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase/firestore` (JS SDK) | already in project (`js/firebase.js`) | `collectionGroup`, `where`, `arrayUnion`, `setDoc`, `updateDoc`, `runTransaction` | Single approved data layer for this project |
| `firebase-functions/v2/https` + `firebase-admin` | already in `queuenight/functions` | New `addFamilyToWp` CF; existing CF pattern (rsvpSubmit precedent) | Cross-repo deploy ritual already established |
| `@firebase/rules-unit-testing` | already in `tests/` | Extend `rules.test.js` for Phase 30 read/write assertions | Existing test infrastructure; 52 passing tests as baseline |

No new npm packages required for this phase. [VERIFIED: direct codebase read]

**Installation:** None — all required SDK methods already imported in `js/firebase.js` and `queuenight/functions/src/*.js`.

**SDK methods needed (verify imports in js/firebase.js):**

```javascript
// collectionGroup is likely not yet imported — add it
import { collectionGroup, where, arrayUnion } from 'firebase/firestore';
```
[ASSUMED — collectionGroup may not be currently imported; verify before plan-phase]

---

## Architecture Patterns

### System Architecture Diagram

```
Host (Family A member) — wp-create form
        |
        | pastes Family B code
        v
[addFamilyToWp CF]
  ├── validates familyCode exists in /families/{code}
  ├── reads /families/{code}/members to get UIDs
  ├── updates /watchparties/{wpId}.families[] (addFamilyToWp)
  ├── updates /watchparties/{wpId}.memberUids[] (arrayUnion all UIDs)
  └── denormalizes member rows onto /watchparties/{wpId}.crossFamilyMembers[]

Firestore /watchparties/{wpId}   <── TOP-LEVEL collection (post-migration)
  ├── hostFamilyCode: "ABC123"
  ├── families: ["ABC123", "XYZ789"]          ← family codes
  ├── memberUids: ["uid1","uid2","uid3","uid4"] ← all UIDs (rules gate + query filter)
  ├── crossFamilyMembers: [                    ← denormalized (Phase 27 guests[] precedent)
  │     { familyCode:"XYZ789", memberId:"m_uid3", name:"Sam", color:"#..." },
  │     ...
  │   ]
  ├── participants: { ... }                    ← unchanged from Phase 7
  ├── guests: [ ... ]                          ← unchanged from Phase 27
  └── reactions: [ ... ]                       ← unchanged from Phase 26

Firestore Rules (simplified):
  match /watchparties/{wpId} {
    allow read: if signedIn() &&
      request.auth.uid in resource.data.memberUids;
    allow create: if signedIn() && ...;   // host-family member
    allow update: if signedIn() && ...;   // Path A (host) / Path B (non-host denylist)
  }

Client subscription (Family B member):
  collectionGroup(db, 'watchparties')
    .where('memberUids', 'array-contains', state.auth.uid)
  → returns all wps from all families where this uid is listed
```

### Recommended Project Structure

```
js/
├── app.js                    # renderWatchpartyLive + renderParticipantTimerStrip extended
├── state.js                  # watchpartiesRef() migrated to collectionGroup query
├── firebase.js               # add collectionGroup import
firestore.rules               # add /watchparties/{wpId} top-level rule block
queuenight/functions/src/
├── addFamilyToWp.js          # NEW CF: validates code, fans out memberUids
├── wpMigrate.js              # ONE-SHOT backfill CF (copy nested → top-level)
tests/
├── rules.test.js             # extend: Phase 30 cross-family read assertions
scripts/
└── smoke-couch-groups.cjs    # NEW smoke contract
```

### Pattern 1: Top-Level Watchparty Collection with memberUids Gate

**What:** All watchparty documents live at `/watchparties/{wpId}`. Every wp doc carries `memberUids: string[]` containing the Firebase Auth UIDs of all members across all families invited to this wp. Firestore rules grant read access when `request.auth.uid in resource.data.memberUids`. Client queries use `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)`.

**When to use:** The only pattern that satisfies both document-level read rules and collection-level enumeration for multi-tenant shared documents in Firestore. [VERIFIED: Firebase official docs on collection group queries; Doug Stevenson pattern article]

**Example (rules):**

```javascript
// firestore.rules — new top-level block
// Source: https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query
// + https://firebase.google.com/docs/firestore/security/rules-query (array-contains + rules alignment)

match /watchparties/{wpId} {
  // READ: any member of any family listed in wp.memberUids
  // 'request.auth.uid in resource.data.memberUids' — valid Firestore rules syntax
  // for List/Array membership check. [VERIFIED: Firebase Talk community thread 2023]
  allow read: if signedIn() && request.auth.uid in resource.data.memberUids;

  // CREATE: only an authenticated user stamping themselves as hostUid (mirrors Phase 24)
  allow create: if signedIn()
    && request.resource.data.hostUid == uid()
    && request.auth.uid in request.resource.data.memberUids;

  // UPDATE: Path A (host) / Path B (non-host denylist) — IDENTICAL to existing nested rule
  // (Phase 24 REVIEWS M2 pattern carries forward verbatim)
  allow update: if signedIn()
    && request.auth.uid in resource.data.memberUids
    && (
      (
        'hostUid' in resource.data
        && resource.data.hostUid == request.auth.uid
      )
      ||
      !request.resource.data.diff(resource.data).affectedKeys().hasAny([
        'currentTimeMs', 'currentTimeUpdatedAt', 'currentTimeSource',
        'durationMs', 'isLiveStream', 'videoUrl', 'videoSource',
        'hostId', 'hostUid', 'hostName', 'families', 'memberUids'
      ])
    );

  allow delete: if signedIn()
    && resource.data.hostUid == uid();
}
```

**Example (client subscription):**

```javascript
// js/app.js — replace watchpartiesRef() onSnapshot with collectionGroup query
// Source: https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query
import { collectionGroup, where, onSnapshot } from 'firebase/firestore';

// New subscription — Phase 30 replaces the families/{code}/watchparties onSnapshot
state.unsubWatchparties = onSnapshot(
  query(
    collectionGroup(db, 'watchparties'),
    where('memberUids', 'array-contains', state.auth.uid)
  ),
  snapshot => {
    state.watchparties = snapshot.docs.map(d => d.data());
    // ... existing auto-archive, flip-scheduled, notify logic unchanged
  }
);
```

**Firestore index required:** Composite index on `memberUids` (array-contains) + `startAt` (desc) for the query. [VERIFIED: Firebase docs state "Collection group queries require a composite index when filtering and ordering."]

### Pattern 2: addFamilyToWp Cloud Function (admin-SDK fan-out)

**What:** When the host adds a family code to a wp, a CF validates the code, reads the foreign family's members subcollection, and atomically updates `wp.families[]`, `wp.memberUids[]`, and `wp.crossFamilyMembers[]` in a single Firestore transaction. No client can write `families` or `memberUids` directly.

**When to use:** Whenever the host-invite action fires (wp-create OR wp-edit). The CF is the trust boundary: it verifies the family code exists and reads foreign family members that the host's client cannot access (family B's members subcollection is gated by `isMemberOfFamily(familyCode)`).

**Why a CF and not client-direct-write:** The host's client can read its OWN family's members but NOT Family B's members subcollection (rule: `allow read: if isMemberOfFamily(familyCode)` — host is not a member of Family B). The CF uses admin-SDK which bypasses rules, reads Family B's members, fans out UIDs, and stamps `memberUids`. [VERIFIED: direct code read of `firestore.rules` and existing CF pattern in `rsvpSubmit.js` and `joinGroup.js`]

**Example (CF shape, pattern mirrors rsvpSubmit.js):**

```javascript
// queuenight/functions/src/addFamilyToWp.js
// Source: mirrors rsvpSubmit.js structure (Phase 27 precedent)
exports.addFamilyToWp = onCall({ region: 'us-central1', cors: [...] }, async (request) => {
  const { wpId, familyCode } = request.data;
  if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required.');
  // Validate family exists
  const familyDoc = await db.doc(`families/${familyCode}`).get();
  if (!familyDoc.exists) throw new HttpsError('not-found', 'Family not found.');
  // Validate caller is host of the wp
  const wpDoc = await db.doc(`watchparties/${wpId}`).get();
  if (!wpDoc.exists || wpDoc.data().hostUid !== request.auth.uid) {
    throw new HttpsError('permission-denied', 'Host only.');
  }
  const wp = wpDoc.data();
  // Soft cap check
  const currentFamilies = wp.families || [];
  if (currentFamilies.length >= 8) throw new HttpsError('resource-exhausted', 'Max families reached.');
  // Read foreign family members (admin SDK bypasses rules)
  const membersSnap = await db.collection(`families/${familyCode}/members`).get();
  const newUids = membersSnap.docs
    .map(d => d.data().uid)
    .filter(uid => uid && typeof uid === 'string');
  const crossFamilyRows = membersSnap.docs.map(d => ({
    familyCode, memberId: d.id, ...pick(d.data(), ['name', 'color', 'avatar'])
  }));
  // Atomic update
  await db.doc(`watchparties/${wpId}`).update({
    families: admin.firestore.FieldValue.arrayUnion(familyCode),
    memberUids: admin.firestore.FieldValue.arrayUnion(...newUids),
    crossFamilyMembers: admin.firestore.FieldValue.arrayUnion(...crossFamilyRows),
  });
  return { ok: true, addedMemberCount: newUids.length };
});
```

### Pattern 3: Render-Time Collision Detection (D-09)

**What:** `renderParticipantTimerStrip(wp)` already has Phase 27 guest-chip logic. Phase 30 extends it with cross-family member chips. Collision detection runs render-time: build a name-frequency map across all participants (members + crossFamilyMembers + guests), then suffix with `(FamilyName)` only when two entries share the same first name.

**When to use:** Always in `renderParticipantTimerStrip`. Never stored in Firestore (mirrors Phase 27 D-04 `(guest)` pattern exactly).

**Example:**

```javascript
// js/app.js — inside renderParticipantTimerStrip(wp)
// Mirrors Phase 27 displayGuestName / getFamilyMemberNamesSet pattern
function buildNameCollisionMap(wp) {
  const nameCounts = {};
  // Count across regular participants, cross-family members, and guests
  const allNames = [
    ...Object.values(wp.participants || {}).map(p => (p.name || '').toLowerCase()),
    ...(wp.crossFamilyMembers || []).map(m => (m.name || '').toLowerCase()),
  ];
  allNames.forEach(n => { nameCounts[n] = (nameCounts[n] || 0) + 1; });
  return nameCounts;
}
// Usage: if (collisionMap[name.toLowerCase()] > 1) displayName += ` (${familyDisplayName})`;
```

### Pattern 4: Existing Wp Migration (nested → top-level)

**What:** Existing `families/{code}/watchparties/{wpId}` docs need to be accessible via the new top-level collection. Strategy: one-shot CF that iterates all families, copies active/recent wp docs to `/watchparties/{wpId}` with `memberUids` stamps derived from the family's current member list, and sets `hostFamilyCode`. Old nested docs can remain (backward compat for old clients) until cache busts; new client reads from top-level only.

**Key insight for migration:** The `rsvpSubmit` CF already scans `families` to find a wp by ID — this existing fan-out pattern confirms the collection migration is feasible. Post-Phase-30, `rsvpSubmit` should be updated to check `/watchparties/{wpId}` directly rather than scanning families.

### Anti-Patterns to Avoid

- **Keeping wps nested under `families/{hostCode}/watchparties` and extending the rules:** The `allow read: if isMemberOfFamily(familyCode)` rule on the parent path (`match /families/{familyCode}`) does NOT cascade to subcollections — subcollections need explicit rules. BUT the bigger problem is the **client query**: Family B member's `watchpartiesRef()` = `collection(db, 'families', state.familyCode, 'watchparties')` — Family B's code, not Family A's. They will never see Family A's wp doc even if rules allow it. This is a **query access** problem, not a rules problem. [VERIFIED: Firebase docs "security rules are not filters" + confirmed by direct code read of `js/app.js:4889`]

- **Iterating families array to call `get()` per family in rules:** Firestore rules do not support loops. Cannot do `families.forEach(code => get(/databases/$(db)/documents/families/$(code)/members/{...}))`. Hard limit of 10 `get()` calls per rule evaluation, and loops are explicitly prohibited. [VERIFIED: Firebase docs "Functions can contain only a single return statement. They cannot execute loops."]

- **Storing family-attributed names in Firestore:** `Sam (Smiths)` is render-time disambiguation per D-09. Do NOT add a `displayName` field to `wp.crossFamilyMembers[]` with the suffix baked in — keeps Firestore data clean and avoids stale suffix if a family later renames.

- **arrayUnion for nested object updates:** `arrayUnion` cannot update existing object elements in arrays (cannot update an element if it already exists — it adds a new duplicate). [VERIFIED: existing Phase 27 code comment in `rsvpSubmit.js` line 126 citing firebase-js-sdk issue #1918] Use `runTransaction` read-modify-write when updating existing `crossFamilyMembers[]` entries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Array membership check in Firestore rules | Custom `isMemberOfFamilies()` loop helper | `request.auth.uid in resource.data.memberUids` | Rules don't support loops; `in` operator works natively on List fields [VERIFIED: Firebase docs] |
| Cross-collection watch query | Multiple parallel `watchpartiesRef()` subscriptions (one per family) | `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` | Single subscription covers all families; parallel subscriptions duplicate snapshot overhead and miss new families added post-subscribe |
| Foreign family member lookup in client | Client reading `families/{otherCode}/members` | `addFamilyToWp` CF + `wp.crossFamilyMembers[]` denormalization | Client cannot read foreign family members (rules gate); CF with admin-SDK is the only clean path |
| Collision suffix stored in Firestore | `wp.crossFamilyMembers[i].displayName = "Sam (Smiths)"` | Render-time collision detection in `renderParticipantTimerStrip` | Phase 27 `(guest)` precedent — pure render logic, zero storage bloat |
| Name-to-family mapping index | Separate Firestore document tracking which family a name belongs to | `wp.crossFamilyMembers[i].familyCode` field + render-time lookup | Already on the denormalized row; no extra read needed |

**Key insight:** Firestore multi-tenant shared documents require the UID allowlist to live ON the document, not in a separate ACL collection. `request.auth.uid in resource.data.memberUids` is the canonical pattern for this problem class.

---

## Runtime State Inventory

> This phase involves a data-model migration (nested watchparties → top-level collection). Answers to all 5 categories are explicit below.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `families/{code}/watchparties/{wpId}` — all existing wp docs in production queuenight-84044. Currently `~N` active wps (unknown count — verify with `db.collectionGroup('watchparties').count()` before migration). | Data migration: one-shot `wpMigrate` CF copies active/recent wps to `/watchparties/{wpId}` with `memberUids` stamps. Old nested docs retained for backward compat during cache-bust window. |
| Live service config | `rsvpSubmit` CF currently scans `families` collection to locate wp by wpId (line 79-96 of `rsvpSubmit.js`). After migration, the scan must check `/watchparties/{wpId}` directly OR maintain a `wpId → familyCode` reverse index. | CF update: update `rsvpSubmit.js` to check top-level `/watchparties/{wpId}` first (O(1) lookup vs O(families) scan). The `familyCode` field on the top-level doc preserves backward compat for any CF logic that needs it. |
| OS-registered state | None — verified by codebase read. No Task Scheduler, pm2, or launchd entries for wp docs. | None |
| Secrets/env vars | None — no env vars reference `families/*/watchparties` paths. Firebase project ID `queuenight-84044` unchanged. | None |
| Build artifacts | `scripts/smoke-app-parse.cjs` — production-code sentinel grep runs against `js/app.js`. The `watchpartiesRef()` sentinel will need updating to reference the new `collectionGroup` call. | Code edit: update smoke sentinels to match new subscription pattern after Plan 30-02 ships. |

---

## Open Questions (Resolved by Research)

### Q1: Stay nested vs migrate to top-level? (Claude's Discretion → RESOLVED)

**Recommendation: Migrate to top-level `/watchparties/{wpId}`.**

Staying nested under `families/{hostCode}/watchparties/{wpId}` is architecturally broken for cross-family reads:

1. Family B member's client subscription queries `families/{familyBCode}/watchparties` — not `families/{familyACode}/watchparties`. Rules don't help here; the client never asks for Family A's subcollection.
2. Even if we added a second `onSnapshot` for each cross-family family code, the client can't enumerate which family codes it's been invited to without a separate query.
3. `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` solves both problems in a single query.

**Migration blast radius is LOW:** `rsvpSubmit.js` already scans all families to find a wp (it expects the nested path). Updating it to check the top-level path first is a 5-line change. The old nested docs can remain (old clients during cache-bust window read from there; new client reads from top-level).

[VERIFIED: direct code read of `js/app.js:4889` (current subscription), `rsvpSubmit.js:79-96` (CF scan), `firestore.rules` (rules structure); Firebase docs on collection group queries]

### Q2: Rules predicate for cross-family read (Claude's Discretion → RESOLVED)

**Use `request.auth.uid in resource.data.memberUids`.**

This is valid Firestore rules syntax — the `in` operator works natively on List (array) fields against a scalar value. [VERIFIED: Firebase Talk thread + Firebase security rules reference confirming `in` operator for List types]

The `memberUids` field is stamped by the `addFamilyToWp` CF at invite time and at wp-create time (host's own family members). The field is in the `update` Path B denylist so non-host members cannot mutate it.

For the collection-group query to work, the rule must also use `{path=**}` wildcard or match the top-level path — top-level `/watchparties/{wpId}` is cleaner and avoids the `{path=**}` catch-all. [CITED: https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query]

### Q3: Reaction attribution `actorFamilyCode` (Claude's Discretion)

**Recommendation: Add `actorFamilyCode` to `wp.reactions[]` rows.**

Phase 26 reaction schema is `{ memberId, memberName, at, runtimePositionMs, runtimeSource, ... }`. Adding `actorFamilyCode` is a small additive field. Why:

- Async-replay rendering needs to know which family's color palette to use for a reaction chip — `renderReaction()` calls `memberColor(r.memberId)` which does `state.members.find(m => m.id === mid)`. For cross-family members, `state.members` only contains the host family's members. Without `actorFamilyCode`, render falls back to a generic color.
- Cross-family member colors are available on `wp.crossFamilyMembers[i].color` (denormalized by CF). The render path needs `actorFamilyCode` to look up the right row.
- Low storage cost: 6-char family code per reaction.

[ASSUMED — renderReaction behavior inferred from code read at js/app.js:12370; verify before finalizing]

### Q4: Member denormalization vs runtime fan-out (Claude's Discretion → RESOLVED)

**Recommendation: Denormalize cross-family member rows onto `wp.crossFamilyMembers[]` at invite time.**

Doc-size budget analysis (D-08 soft cap = 4 families, ~6 members each):

| Field | Size estimate |
|-------|--------------|
| `crossFamilyMembers[]` — 3 families × 6 members × ~200 bytes/row | ~3.6 KB |
| `memberUids[]` — 4 families × 6 members × ~30 bytes/uid | ~720 bytes |
| `wp.guests[]` (Phase 27) — up to 100 guests × ~150 bytes | ~15 KB |
| `wp.reactions[]` (Phase 26) — typical session ~50 reactions × ~200 bytes | ~10 KB |
| Core wp fields (participants, title, timestamps, video) | ~2 KB |
| **Total estimate** | **~32 KB** |

Well under the 1MB Firestore document limit. Runtime fan-out (separate reads per family's members subcollection at render time) would add 3+ separate Firestore `get()` calls on every `onSnapshot` update — worse latency and more read quota cost. Denormalization is the right call.

[VERIFIED: Firestore 1MB limit; ASSUMED: member row size estimate — verify with actual member doc shape]

### Q5: Pre-Phase-30 wp migration (Claude's Discretion → RESOLVED)

**Recommendation: Backward-compat on read; one-shot CF migrates existing wps to top-level.**

The new client subscription (`collectionGroup(...).where('memberUids', 'array-contains', uid)`) naturally excludes old nested wps that haven't been migrated (they lack `memberUids`). Existing family members won't see their historical wps disappear because:

1. The migration CF stamps `memberUids = [all UIDs of that family]` on all wps it copies.
2. The migration scope is "wps created in the last 25h" (anything older is already archived and mostly irrelevant to the Tonight tab). All-time archive migration is optional.

The old nested docs remain in Firestore (no delete). If the user has an old PWA (pre-Phase-30 cache) it reads from the nested collection as before. After cache-bust, the new client reads top-level. The 25h `WP_ARCHIVE_MS` window means migration convergence happens naturally within one day.

### Q6: Cross-repo deploy footprint (Claude's Discretion → RESOLVED)

**This is a cross-repo deploy (both couch + queuenight).**

Changes needed in both repos:
- **couch repo:** `js/firebase.js` (add `collectionGroup` import), `js/app.js` (subscription + render extensions + "+Add a family" UI), `firestore.rules` (new top-level `/watchparties/{wpId}` block + keep existing nested block with `allow read: if false` to block direct nested reads post-migration)
- **queuenight/functions:** New `addFamilyToWp.js` CF + `wpMigrate.js` one-shot CF + update `rsvpSubmit.js` (check top-level first)

Deploy sequence: `firebase deploy --only functions` from queuenight → `bash scripts/deploy.sh 40-couch-groups` from couch.

---

## Common Pitfalls

### Pitfall 1: Client Can't See Cross-Family Wps (Silent Failure)

**What goes wrong:** Family B member opens the app, opens Tonight tab, sees no cross-family wp banner. No error thrown.
**Why it happens:** `watchpartiesRef()` queries `families/{familyBCode}/watchparties` (Family B's own subcollection). Family A's wp never appears.
**How to avoid:** Use the top-level `collectionGroup` subscription pattern. Verify in smoke test that a member whose UID is in `memberUids` can read the doc.
**Warning signs:** UAT — invite Family B, open Family B's client, wp banner absent.

### Pitfall 2: `rules.test.js` Tests Pass But Production Query Fails

**What goes wrong:** `rules.test.js` tests document reads (single-doc `get()`) and passes. But the client uses a **collection query** (`collectionGroup + where`), and Firestore applies the `allow read` predicate differently for queries vs single-doc reads. A query must be able to prove ALL results satisfy the rule without touching the database.
**Why it happens:** `request.auth.uid in resource.data.memberUids` IS valid for queries when paired with an `array-contains` filter on `memberUids` — the filter + rule align (only docs with the uid in `memberUids` are returned). But if you forget the `where('memberUids', 'array-contains', uid)` filter in the client query, Firestore rejects the query entirely.
**How to avoid:** Client query MUST include `where('memberUids', 'array-contains', state.auth.uid)` — this makes the filter align with the rule. Add a smoke sentinel that verifies this filter is present.
**Warning signs:** `FirebaseError: Missing or insufficient permissions` on the `collectionGroup` query.

### Pitfall 3: arrayUnion Duplicates Existing crossFamilyMembers Objects

**What goes wrong:** Host adds Family B, then edits the wp again and adds Family B a second time. `arrayUnion` of object arrays adds a new duplicate row if the object isn't reference-equal.
**Why it happens:** Firestore `arrayUnion` compares by value for primitives but by reference for objects — actually, Firestore compares array element objects by deep equality. However, the CF's timing or re-invocation can produce duplicate rows if not guarded.
**How to avoid:** `addFamilyToWp` CF checks `if (wp.families.includes(familyCode)) return { ok: true, alreadyAdded: true };` before any write. [VERIFIED: `rsvpSubmit.js` idempotency guard precedent at line 120]
**Warning signs:** Roster renders the same person twice.

### Pitfall 4: memberUids Gets Stale When Family B Member Leaves/Joins

**What goes wrong:** After Phase 30 ships, Family B adds a new member. The new member's UID is not in `wp.memberUids` for any cross-family wp. They can't see the wp.
**Why it happens:** `memberUids` was stamped at invite time; it's a snapshot, not a live view.
**How to avoid:** For v1 Phase 30, this is acceptable — cross-family wps last ~25h; a new member joining in the middle of a night is an edge case. Document as a known limitation: `memberUids` reflects Family B's roster at invite time. Phase 30.x can address with a `familyMembersChanged` trigger CF if analytics show it matters.
**Warning signs:** New Family B member can't see ongoing cross-family wp.

### Pitfall 5: rsvpSubmit CF Scan Breaks

**What goes wrong:** Phase 27's `rsvpSubmit` CF scans ALL families to find a wp by its ID. After migration, the wp exists at `/watchparties/{wpId}` (top-level) but NOT in any family's subcollection. The scan returns `wpRef = null` → `{ expired: true }` for all Phase 30+ wps.
**Why it happens:** `rsvpSubmit.js:79-96` scans `families.docs` looking for the wp in subcollections.
**How to avoid:** Update `rsvpSubmit.js` to first try `db.doc('watchparties/' + token).get()` — if found, use that ref. Fall back to the family scan for backward compat with old nested wps. [VERIFIED: direct code read of rsvpSubmit.js]
**Warning signs:** Guest RSVP returns `{ expired: true }` for all new wps after Phase 30 deploy.

### Pitfall 6: Collision Suffix Renders for Same-Family Members

**What goes wrong:** Two members in Family A are both named "Sam". Phase 30 collision logic also matches them against each other, surfacing `Sam (Family A)` for both — but this wasn't needed before cross-family and the suffix is confusing within a single family.
**Why it happens:** Collision detection counts all names across ALL participants without distinguishing within-family from cross-family collisions.
**How to avoid:** Collision suffix should ONLY trigger when the collision spans two different families (i.e., two people with the same name from different `familyCode` values). Within-family name collisions already existed and were handled as-is (members typically have different names within a family). Add a `familyCode` check to the collision detection logic.
**Warning signs:** UAT — family with two members named "Sam" (rare but possible) sees `Sam (Family A)` suffix unexpectedly.

### Pitfall 7: Firestore Composite Index Missing for collectionGroup Query

**What goes wrong:** `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` fails with `The query requires an index`.
**Why it happens:** Array-contains queries on collection groups require a composite exemption index.
**How to avoid:** Create the index in `firestore.indexes.json` BEFORE deploying the new client code. Firebase will provide an error link to create it in the Console if it's missing — but this means the subscription silently fails until the index is manually created.
**Warning signs:** Console error with a Firestore index creation URL. Add index creation to Wave 0 plan.

---

## Code Examples

Verified patterns from official sources and direct codebase read:

### collectionGroup Subscription (Primary Client-Side Pattern)

```javascript
// Source: https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query
// js/app.js — replaces existing watchpartiesRef() onSnapshot
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';

function subscribeWatchparties() {
  if (!state.auth || !state.auth.uid) return;
  state.unsubWatchparties = onSnapshot(
    query(
      collectionGroup(db, 'watchparties'),
      where('memberUids', 'array-contains', state.auth.uid)
    ),
    snapshot => {
      state.watchparties = snapshot.docs.map(d => d.data());
      // ... existing auto-archive, flip-scheduled, notify logic unchanged ...
    },
    err => { qnLog('[watchparties] snapshot error', err.message); }
  );
}
```

### Firestore Rules Array Membership (Cross-Family Read Gate)

```javascript
// Source: Firebase security rules reference + Firebase Talk confirmed pattern
// request.auth.uid in resource.data.memberUids — valid List membership check
match /watchparties/{wpId} {
  allow read: if signedIn() && request.auth.uid in resource.data.memberUids;
}
```

### Smoke Contract Sentinel Pattern (Phase 27 Precedent)

```javascript
// Source: direct codebase read of scripts/smoke-guest-rsvp.cjs (Phase 27 pattern)
// scripts/smoke-couch-groups.cjs — new Phase 30 smoke contract
function buildNameCollisionMap(participants, crossFamilyMembers) {
  const nameCounts = {};
  const allEntries = [
    ...Object.values(participants || {}).map(p => ({ name: p.name, familyCode: null })),
    ...(crossFamilyMembers || []).map(m => ({ name: m.name, familyCode: m.familyCode })),
  ];
  allEntries.forEach(e => {
    const n = (e.name || '').toLowerCase();
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  return nameCounts;
}
// Test: same name across two families → count = 2 → suffix fires
// Test: same name within one family → count = 2 BUT same familyCode → suffix suppressed
```

### WP Doc Shape (Post-Phase-30)

```javascript
// wp doc written by confirmStartWatchparty (js/app.js:11161) — EXTENDED for Phase 30
// Source: direct codebase read js/app.js:11161-11189
{
  id: 'wp_<ts>_<rand>',
  // --- existing fields (unchanged) ---
  titleId, titleName, titlePoster,
  hostId, hostName, hostUid,
  startAt, createdAt, lastActivityAt,
  status: 'active' | 'scheduled' | 'archived' | 'cancelled',
  participants: { [memberId]: { name, joinedAt, rsvpStatus, ... } },
  reactions: [],
  guests: [],           // Phase 27
  videoUrl, videoSource, // Phase 24

  // --- NEW Phase 30 fields ---
  hostFamilyCode: state.familyCode,         // the host's own family code
  families: [hostFamilyCode],               // starts with host's family; CF appends others
  memberUids: [uid1, uid2, ...],            // ALL uids from ALL families (rules gate + query filter)
  crossFamilyMembers: [],                   // denormalized rows from foreign families; empty at create
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Watchparties nested under `families/{code}/watchparties` | Top-level `/watchparties/{wpId}` with `memberUids` array | Phase 30 (this phase) | Enables cross-family read access; single subscription replaces per-family subscription |
| `isMemberOfFamily(familyCode)` read gate | `request.auth.uid in resource.data.memberUids` | Phase 30 | Clean multi-tenant gate without `get()` call overhead |
| `rsvpSubmit` scan-all-families to find wp | Direct lookup at `/watchparties/{wpId}` + fallback scan | Phase 30 | O(1) lookup replaces O(families) scan |

**Deprecated/outdated:**
- `watchpartiesRef()` in `js/app.js:1935` — returns `families/{code}/watchparties` collection ref. After Phase 30, the subscription switches to `collectionGroup`. The helper function itself can stay for backward compat with any code that does direct single-doc writes to `watchpartyRef(id)` — those still work (writes go to top-level; the function just needs the path updated to `doc(db, 'watchparties', id)`).

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `collectionGroup` is not yet imported in `js/firebase.js` | Standard Stack | Low — easy to add; verify before Plan 01 |
| A2 | `actorFamilyCode` is needed in `wp.reactions[]` for cross-family color lookup | Open Question Q3 | Medium — if `renderReaction` uses `state.members` fallback color gracefully, this field can be skipped; verify code path |
| A3 | Cross-family member row is ~200 bytes (for doc-size budget calc) | Open Question Q4 | Low — doc size well under 1MB even at 2x estimate |
| A4 | Existing wps in production number in the hundreds, not thousands | Runtime State Inventory | Low — migration CF scales regardless; only affects migration duration |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Firebase Emulator Suite | `rules.test.js` + new Phase 30 rules tests | Verify | — | Use `firebase emulators:exec` (existing setup in `tests/`) |
| `firebase-admin` SDK in queuenight/functions | `addFamilyToWp` CF + `wpMigrate` CF | Already installed | v11+ (existing) | — |
| Firestore composite index (memberUids array-contains) | collectionGroup subscription | Not yet created | — | Must create in Wave 0 before client code ships |

**Missing dependencies with no fallback:**
- Firestore composite index on `watchparties` collection group for `memberUids` (array-contains). Must be created via `firestore.indexes.json` or Firebase Console as Wave 0 task. Client query silently fails without it.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js CJS scripts (smoke contracts, no test runner) + `@firebase/rules-unit-testing` (rules.test.js) |
| Config file | `tests/package.json` (rules tests); `package.json` at couch root (smoke scripts) |
| Quick run command | `npm run smoke:couch-groups` (new alias, Wave 0 gap) |
| Full suite command | `npm run smoke` (all 12 contracts) + `cd tests && npm test` (rules tests) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GROUP-30-01 | Host can add a family code at wp-create; wp gains `wp.families[]` + `wp.memberUids[]` | smoke (production-code sentinel) | `npm run smoke:couch-groups` | Wave 0 |
| GROUP-30-02 | Family B member sees cross-family wp in their subscription | smoke (collision/render helper) + rules test | `npm run smoke:couch-groups` + `cd tests && npm test` | Wave 0 |
| GROUP-30-03 | Cross-family members render in roster with real names + avatars | smoke (helper behavior assertion) | `npm run smoke:couch-groups` | Wave 0 |
| GROUP-30-04 | Name collision triggers `(FamilyName)` suffix; no collision = no suffix | smoke (helper behavior assertion) | `npm run smoke:couch-groups` | Wave 0 |
| GROUP-30-05 | Soft cap of 4 families: client shows warning above 4; hard ceiling rejects above 8 | smoke (sentinel for cap constant) | `npm run smoke:couch-groups` | Wave 0 |
| GROUP-30-06 | Host-only: non-host cannot add a family to a wp | rules test | `cd tests && npm test` | Wave 0 |
| GROUP-30-07 | Cross-family wp read is denied for users NOT in `memberUids` | rules test | `cd tests && npm test` | Wave 0 |
| GROUP-30-08 | Existing per-family wps still render correctly (no regression) | smoke (regression sentinel in smoke-app-parse.cjs) | `npm run smoke:app-parse` | Exists (extend) |

### Sampling Rate

- **Per task commit:** `npm run smoke:couch-groups` (new quick-run alias)
- **Per wave merge:** `npm run smoke` (full 12-contract suite)
- **Phase gate:** Full suite green + `cd tests && npm test` (rules tests) before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `scripts/smoke-couch-groups.cjs` — covers GROUP-30-01 through GROUP-30-05 + GROUP-30-08; new file
- [ ] `tests/rules.test.js` — extend with Phase 30 `describe` block covering GROUP-30-06 + GROUP-30-07 (cross-family read allow + stranger read deny + host-only addFamily deny)
- [ ] Firestore composite index: add `watchparties` `memberUids` array-contains index to `queuenight/firestore.indexes.json` (or create in Console)
- [ ] `package.json` — add `"smoke:couch-groups": "node scripts/smoke-couch-groups.cjs"` + extend `"smoke"` aggregate

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — Phase 5 auth already ships; Phase 30 doesn't change auth |
| V3 Session Management | no | N/A |
| V4 Access Control | yes | `memberUids` field + rules predicate; host-only write gate; CF validates `request.auth.uid == wp.hostUid` before allowing `addFamilyToWp` |
| V5 Input Validation | yes | `addFamilyToWp` CF: family code regex validation + length bounds (mirrors `looksLikeWpId` in rsvpSubmit.js); soft cap (4 families) + hard ceiling (8) checked server-side |
| V6 Cryptography | no | N/A — no new crypto surface |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Host spoofing: non-host claims to be host and calls `addFamilyToWp` | Spoofing | CF checks `wp.hostUid == request.auth.uid` (server-side); no client-only trust |
| Privilege escalation: Family B member tries to directly write `memberUids` | Tampering | `memberUids` added to Path B denylist in rules; only CF (admin-SDK) can write it |
| Enumeration: bad actor calls `addFamilyToWp` with guessed family codes to enumerate families | Spoofing/Info Disclosure | CF returns same error for "not found" + "not a member" (mirrors `rsvpSubmit` confidentiality pattern at line 95: "don't leak whether token is wrong vs too old") |
| Doc-size bomb: host adds 8 families × 100 members each = 800 UIDs in `memberUids` | Denial of Service | Hard ceiling of 8 families in CF; member cap per family is bounded by existing family UX (~10 members typical); `memberUids` at 800 × 30 bytes = 24 KB — still well under 1MB |
| Guest RSVP broken post-migration | Denial of Service | Update `rsvpSubmit.js` Pitfall 5 fix; add rules test verifying guest RSVP path still works for top-level wps |

---

## Sources

### Primary (HIGH confidence)
- Direct codebase read: `js/app.js:1935` (watchpartiesRef), `js/app.js:11141-11189` (confirmStartWatchparty), `js/app.js:12296-12367` (renderParticipantTimerStrip + Phase 27 guest chips), `firestore.rules` (full file), `js/state.js` (full file), `queuenight/functions/src/rsvpSubmit.js:79-96` (family scan pattern), `tests/rules.test.js` (test infrastructure)
- [Firebase official docs — Collection group queries](https://firebase.google.com/docs/firestore/query-data/queries#collection-group-query)
- [Firebase official docs — Security rules conditions (get/exists limits)](https://firebase.google.com/docs/firestore/security/rules-conditions)
- [Firebase official docs — Securely query data (rules are not filters)](https://firebase.google.com/docs/firestore/security/rules-query)

### Secondary (MEDIUM confidence)
- [Firebase Talk — request.auth.uid in array field confirmed working](https://groups.google.com/g/firebase-talk/c/1rTmJmNyJNQ) — confirms `in` operator on List fields is valid rules syntax
- [Doug Stevenson / Firebase Developers — Group-based permissions for Cloud Firestore](https://medium.com/firebase-developers/patterns-for-security-with-firebase-group-based-permissions-for-cloud-firestore-72859cdec8f6) — confirms `uid in resource.data.admins` list-membership pattern as canonical approach; 10 get() calls per eval limit
- [Firebase official docs — Firestore storage size](https://firebase.google.com/docs/firestore/storage-size) — 1MB document limit verification

### Tertiary (LOW confidence)
- [WebFetch: firebase.google.com/docs/firestore/security/rules-conditions](https://firebase.google.com/docs/firestore/security/rules-conditions) — rules functions cannot contain loops; single return statement only (confirmed restriction on dynamic get() iteration)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new packages; all SDK methods already in project
- Architecture (wp-doc location, rules pattern): HIGH — verified against official Firebase docs + direct codebase read; canonical pattern confirmed
- Pitfalls: HIGH — most derived from verified code read (rsvpSubmit scan, arrayUnion limitation from Phase 27 code comment, rules-are-not-filters from official docs)
- Open Questions: HIGH (Q1, Q4, Q5, Q6) / MEDIUM (Q2 — `in` operator confirmed but not 100% tested in emulator for this exact rules shape) / MEDIUM (Q3 — actorFamilyCode recommendation based on render-path code analysis)

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable Firestore APIs; 30 days)
