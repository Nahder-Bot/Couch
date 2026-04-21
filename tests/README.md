# Firestore Rules Tests

Single-file Node script that validates `firestore.rules` against the Firestore emulator using `@firebase/rules-unit-testing`. This is the **only** automated test harness in the Couch repo (project has a single-file HTML constraint; no broader test runner).

## Requirements

- Node 18+
- Java 21+ (Firebase emulator)
- `firebase-tools` (global)

## Run

```bash
cd tests
npm install
npm test
```

`npm test` copies `../firestore.rules` to `tests/firestore.rules`, starts the Firestore emulator on port 8080, runs `rules.test.js` against it, then shuts the emulator down. Exit code 0 means all scenarios passed.

## What's covered

14 scenarios from Phase 5 Plan 05-04 Task 2:

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Authed member writes session with `actingUid == self` | ALLOWED |
| 2 | Authed parent writes session with `managedMemberId == kid_sub` | ALLOWED |
| 3 | Random authed uid (non-member) writes session | DENIED |
| 4 | Legacy `{memberId}` write during grace | ALLOWED |
| 5 | Same legacy write after grace expires | DENIED |
| 6 | Unauthenticated write to family subcollection | DENIED |
| 7 | Client read of `claimTokens` | DENIED |
| 8 | Client UPDATE on `/families/fam1` (passwordHash forgery) | DENIED |
| 9 | Authed user CREATEs `/families/fam2` with `ownerUid: self` | ALLOWED |
| 10 | Authed user CREATEs with DIFFERENT `ownerUid` | DENIED |
| 11 | Branch B: existing member creates sub-profile (`managedBy: self`, no `uid`) | ALLOWED |
| 12 | Branch B negative: member forges `managedBy` of other uid | DENIED |
| 13 | Branch C: existing member adds self-uid member doc | ALLOWED |
| 14 | Branch C negative: stranger uid tries to self-add to a group | DENIED |

## When to run

- Before any `firebase deploy --only firestore:rules`
- When modifying `firestore.rules`
- When adding new rule-gated features
