---
phase: 30
slug: couch-groups-affiliate-hooks
hotfix_wave: 2
finding_id: CDX-1
severity: critical
created: 2026-05-03
status: fixed
---

# Phase 30 — Hotfix Wave 2: CDX-1 (cross-family wp-create injection)

## Finding (cross-AI peer review, 2026-05-03)

The top-level `/watchparties/{wpId}` `allow create` rule (firestore.rules:144-146 pre-fix) required only:

```
allow create: if signedIn()
  && request.resource.data.hostUid == uid()
  && request.auth.uid in request.resource.data.memberUids;
```

**No check** that the creator actually belonged to the claimed `hostFamilyCode`. **No bound** on the initial `families[]` array. **No bound** on `crossFamilyMembers[]`.

### Attack surface

A signed-in user could call `doc('watchparties/{newWpId}').set(...)` claiming arbitrary `hostFamilyCode: 'someone-elses-family-code'` and `families: ['fam-A', 'fam-B', 'fam-C', ...]` (any list they wanted), as long as their own UID was in `memberUids`. The `onWatchpartyCreateTopLevel` Cloud Function (`queuenight/functions/index.js:~505`) then fanned out push notifications to every member of every family in `wp.families[]`:

- **Cross-family push spam** — attacker stuffs N family codes into `families[]`, every member of every named family receives a push for a wp they were never invited to.
- **Spoofed-watchparty injection** — attacker creates a wp claiming `hostFamilyCode: 'victim-family'`, the wp shows up in any subscription that lands on the doc, the victim family has no idea where it came from.

## Fix

Tightened the create rule to enforce the actual creation invariants of `addFamilyToWp`'s admin-SDK fan-out path. **At CREATE time**:

1. **`hostFamilyCode is string`** — defensive type guard before `exists()` derefs the value.
2. **`families == [hostFamilyCode]`** — single-element list at create; cross-family expansion happens later via the `addFamilyToWp` admin-SDK Cloud Function, NOT at client create.
3. **`crossFamilyMembers.size() == 0`** — denormalized cross-family roster is admin-SDK-only writable.
4. **`exists(/families/{hostFamilyCode})`** — no orphan-wp injection against unallocated codes.
5. **`exists(/users/{uid()}/groups/{hostFamilyCode})`** — creator is a member of the claimed host family. Reuses the existing per-user index that `isMemberOfFamily()` reads. (Cannot reuse the helper directly: it derives `familyCode` from the path-match wildcard, but `/watchparties/{wpId}` has no familyCode in the path — the rule reads it off `request.resource.data.hostFamilyCode` instead.)

### Rule diff

**Before** (`firestore.rules:144-146`):
```
allow create: if signedIn()
  && request.resource.data.hostUid == uid()
  && request.auth.uid in request.resource.data.memberUids;
```

**After** (`firestore.rules:179-187`):
```
allow create: if signedIn()
  && request.resource.data.hostUid == uid()
  && request.auth.uid in request.resource.data.memberUids
  && request.resource.data.hostFamilyCode is string
  && request.resource.data.families == [request.resource.data.hostFamilyCode]
  && request.resource.data.crossFamilyMembers is list
  && request.resource.data.crossFamilyMembers.size() == 0
  && exists(/databases/$(database)/documents/families/$(request.resource.data.hostFamilyCode))
  && exists(/databases/$(database)/documents/users/$(uid())/groups/$(request.resource.data.hostFamilyCode));
```

(Plus a multi-line comment block at lines 144-178 documenting the threat model and the rationale for each clause.)

## Test additions (`tests/rules.test.js`)

Five new assertions in the Phase 30 Couch Groups describe block, continuing from #30-20:

| Test ID | Scenario | Expected |
|---------|----------|----------|
| #30-21 | User creates wp with `hostFamilyCode != their family` | DENIED — the `exists(/users/{uid}/groups/{hostFamilyCode})` membership check fails |
| #30-22 | User creates wp with extra `families[]` beyond `[hostFamilyCode]` | DENIED — `families == [hostFamilyCode]` rejects |
| #30-23 | User creates wp with non-empty `crossFamilyMembers[]` at create | DENIED — `crossFamilyMembers.size() == 0` rejects |
| #30-24 | User creates wp with `hostFamilyCode` pointing to nonexistent family | DENIED — `exists(/families/{hostFamilyCode})` rejects |
| #30-25 | Host creates wp with `hostFamilyCode == their family` + `families == [hostFamilyCode]` + empty `crossFamilyMembers` | **ALLOWED** — regression guard for legitimate happy-path creation |

#30-25 is the critical regression guard. Without it, an over-tightened rule could break wp creation entirely; the test ensures the legitimate path through `confirmStartWatchparty` and `scheduleSportsWatchparty` continues to work.

## Verification

`cd tests && npm test` against the Firestore emulator: **77 passing, 0 failing.**

Pre-fix baseline: 72 tests. New CDX-1 tests: 5 (#30-21..25). Final: 77.

```
Phase 30 Couch Groups rules
  ✓ #30-01 stranger read top-level wp -> DENIED
  ...
  ✓ #30-20 stranger deletes top-level wp -> DENIED
  ✓ #30-21 user creates wp with hostFamilyCode != their family -> DENIED (CDX-1)
  ✓ #30-22 user creates wp with extra families[] beyond hostFamilyCode -> DENIED (CDX-1)
  ✓ #30-23 user creates wp with non-empty crossFamilyMembers[] at create time -> DENIED (CDX-1)
  ✓ #30-24 user creates wp with hostFamilyCode pointing to nonexistent family -> DENIED (CDX-1)
  ✓ #30-25 host creates wp with hostFamilyCode == their family + families==[hostFamilyCode] + empty crossFamilyMembers -> ALLOWED (CDX-1 regression guard)

77 passing, 0 failing
```

## Commits (couch repo)

| Commit | Files | Description |
|--------|-------|-------------|
| `0d6822c` | `firestore.rules` | `fix(security): require creator belongs to hostFamilyCode + families==[hostFamilyCode] at wp create (CDX-1)` |
| `599bad9` | `tests/rules.test.js` | `test(phase-30): rules-tests #30-21..25 cover cross-family injection vector (CDX-1)` |

## Out of scope (not touched by this hotfix)

- **Production deploy.** User controls deploy cadence. Rule fix lives in source-of-truth `couch/firestore.rules`; the queuenight repo mirror + `firebase deploy --only firestore:rules` to queuenight-84044 are the user's call.
- **`sw.js` CACHE bump.** `scripts/deploy.sh` auto-bumps at deploy time; this hotfix is rules-only and does not affect the PWA app shell.
- **`js/app.js`, `queuenight/functions/index.js`.** Other parallel fixer agents own those. This wave's scope was firestore.rules + tests/rules.test.js only.
- **The `addFamilyToWp` CF and `onWatchpartyCreateTopLevel` CF.** Already audited under P02-T-30-01 (host-only check) and accepted as the trusted boundary that performs cross-family expansion. CDX-1's fix re-aligns the client-side create rule with that admin-SDK-only contract.

## Threat-register update suggestion (optional follow-up)

Consider appending a row to `30-SECURITY.md` Threat Register:

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| CDX-1 | Spoofing / DoS | firestore.rules /watchparties/{wpId} create rule | mitigate | Tightened allow-create to enforce families==[hostFamilyCode] + empty crossFamilyMembers + creator-is-member exists(). Tests #30-21..25 cover the four denial paths + happy-path regression guard. couch a/0d6822c (rule), couch a/599bad9 (tests). 77/0 rules-tests post-fix. | closed |

(This file lives at `.planning/phases/30-couch-groups-affiliate-hooks/30-HOTFIX-WAVE-2-CDX-1.md` and is the canonical artifact for the wave-2 fix; the threat-register edit is a separate follow-up if the user wants the audit trail consolidated in `30-SECURITY.md`.)

---

*Fixed: 2026-05-03*
*Fixer: Claude Opus 4.7 (1M context)*
*Wave: 2*
