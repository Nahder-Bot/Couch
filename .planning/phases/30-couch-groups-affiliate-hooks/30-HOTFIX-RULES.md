# Phase 30 — Firestore rules hotfix (CR-05 + CR-06)

**Hotfix date:** 2026-05-03
**Trigger:** Cross-cutting code review of the Phase 30 top-level
`/watchparties/{wpId}` migration surfaced two CRITICAL findings on
the new `allow update` rule.

## Source review findings

### CR-05 (CRITICAL) — top-level wp `update` rule had no `attributedWrite` requirement

The legacy nested rule at `firestore.rules:629` requires
`attributedWrite(familyCode) && (...)` so every wp mutation carries a
valid `actingUid` echo and a regex-anchored `memberId`. The new
top-level rule (post-Phase-30 migration) dropped this requirement
entirely. Audit trail was broken for cross-family writes, and any
future memberId-derived runtime regex (parallel of the title-doc
`actingTupleKey` echo pattern) would have been wide open to RE2
metacharacter injection.

### CR-06 (WARNING, raised to CRITICAL by CR-05 interaction) — Path B denylist too narrow

Path B used a denylist (`!affectedKeys().hasAny([...])`) that only
covered the Phase 24 host-only fields plus the Phase 30
families/memberUids/crossFamilyMembers triple. Once `addFamilyToWp`
widened the trust surface to cross-family members, the denylist no
longer matched the threat model — a guest-family member could
overwrite `participants[host_id]` (defeating Phase 15.5 REQ-7),
`titleName`, `mode`, `status`, `archivedAt`, etc.

## Fix applied

**File:** `firestore.rules` lines 141–199 (the
`match /watchparties/{wpId}` block).

**Edit summary:**

1. **Inlined attributedWrite-equivalent** on the top-level
   `allow update` rule. The `validAttribution()` helper takes a
   `familyCode` argument so it can't be reused on top-level wps that
   span families; the regex-anchor pattern was inlined verbatim
   (`'^m_[A-Za-z0-9_-]+$'` for both `memberId` and the proxy-path
   `managedMemberId`). The legacy nested helper still gates the
   nested rule at line 629; only the top-level rule was changed.

2. **Converted Path B from denylist to allowlist.** New allowlist:
   `[reactions, rsvps, archivedAt, participants, lastActivityAt]`
   plus the four attribution-echo fields (`actingUid`,
   `managedMemberId`, `memberId`, `memberName`). The four echo
   fields are required by the CR-05 fix above, so they MUST appear
   in `affectedKeys()` for any non-host write to land.

**Lines changed:** 141–164 (old) → 141–199 (new). Net +32 lines
(20 lines of inline rationale comments + 12 lines of new rule
condition).

## Rules-test additions

Three new assertions appended to `tests/rules.test.js` in the
`Phase 30 Couch Groups rules` describe block:

| ID         | Scenario                                                                          | Verifies              |
| ---------- | --------------------------------------------------------------------------------- | --------------------- |
| `#30-06`   | non-host writes to `wp.participants` WITHOUT `actingUid` → DENIED                 | CR-05 attribution echo |
| `#30-07`   | non-host writes to `wp.titleName` → DENIED (was previously allowed by denylist)   | CR-06 allowlist        |
| `#30-08`   | non-host writes to `wp.reactions` WITH valid `actingUid`+`memberId` → ALLOWED     | CR-06 regression guard |

## Test outcome

```
60 passing, 0 failing
```

Pre-hotfix baseline: 57 passing.
Post-hotfix: 57 + 3 new = 60 passing.

Run via: `cd tests && npm test`
(uses `firebase emulators:exec --only firestore`).

## Commit SHAs

| Commit    | Subject                                                                                |
| --------- | -------------------------------------------------------------------------------------- |
| `c97b726` | `fix(phase-30): require attribution + allowlist Path B on top-level wp updates (CR-05 + CR-06)` |
| `530f9c4` | `test(phase-30): rules-tests #30-06..08 cover CR-05 attribution + CR-06 allowlist`     |

## Deploy note

`firestore.rules` is the source-of-truth in the couch repo and is
mirrored to the queuenight deploy repo at deploy time. **This
hotfix is NOT deployed yet** — the user controls the deploy ritual
(`bash scripts/deploy.sh <short-tag>` per CLAUDE.md and RUNBOOK §H).

## Follow-up considerations

1. The legacy nested `match /families/{familyCode}/watchparties/{wpId}`
   block at line ~629 still uses a denylist. It's gated by
   `attributedWrite(familyCode)` so the same-family threat model
   covered by Phase 24 still holds — same-family members are mutually
   trusted at the rules layer. No CR-06-equivalent fix is required
   there. When the post-cache-bust window closes and the nested
   block gets `allow read: if false`, this becomes moot.

2. The `participants` field is on the allowlist by necessity (the
   client RSVP path writes it on every member-attended wp). A
   future hardening could narrow to a per-member-keyed inner-map
   isolation pattern (parallel of the title-doc `mutedShows` /
   `progress` HIGH-1 isolation). Not in scope for this hotfix; the
   client-side `state.me.id === wp.hostId` gate plus the Phase 15.5
   REQ-7 ground-truth-from-server pattern provide adequate
   defense-in-depth for now.
