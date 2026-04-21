---
phase: 05-auth-groups
plan: "05"
subsystem: write-attribution
tags: [auth, firestore, write-attribution, self-echo, grace-window]
dependency_graph:
  requires: [05-01-state-keys]
  provides: [writeAttribution-helper, dual-write-payloads, grace-compatible-self-echo-guards]
  affects: [js/utils.js, js/app.js, js/state.js]
tech_stack:
  added: []
  patterns:
    - "snapshot-then-clear (VETO-03 precedent) — state.actingAs read into local before clearing"
    - "dual-write grace window — actingUid + managedMemberId? + legacy memberId + memberName in every payload"
    - "D-21 dual self-echo guard — actingUid === myUid || memberId === myMemberId"
key_files:
  created: []
  modified:
    - js/utils.js
    - js/app.js
    - js/state.js
decisions:
  - "writeAttribution() placed in js/utils.js (not app.js) to be importable by future auth.js without circular dep"
  - "Only 4 actual Firestore write-payload sites found (not ~25 as estimated) — all migrated; remaining state.me.id uses are local-identity lookups"
  - "state.js auth keys added as prerequisite (05-01 not yet executed) — Rule 3 deviation"
metrics:
  duration: "~18min"
  completed: "2026-04-21T04:08:11Z"
  tasks_completed: 3
  files_modified: 3
---

# Phase 5 Plan 05: writeAttribution Helper + Write Site Migration Summary

**One-liner:** Centralized `writeAttribution()` helper in `js/utils.js` with snapshot-then-clear semantics; all 4 Firestore write-payload sites in `js/app.js` migrated to dual-write shape; 3 self-echo guards updated to dual-check `actingUid` + legacy `memberId`.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add writeAttribution() to js/utils.js + extend state.js | f6a2a76 | js/utils.js, js/state.js |
| 2 | Migrate all Firestore write sites in js/app.js | 9503a66 | js/app.js |
| 3 | Update self-echo guards to dual-check actingUid + legacy memberId | 2946b03 | js/app.js |

## Write Sites Migrated (4 total)

| Line (pre-migration) | Feature | Old shape | New shape |
|---|---|---|---|
| app.js:4802 | Activity reply | `{ memberId: state.me.id, memberName: state.me.name, text, ts }` | `{ ...writeAttribution(), text, ts }` |
| app.js:5361 | Veto baseEntry | `{ memberId: state.me.id, memberName: state.me.name, comment, at }` | `{ ...writeAttribution(), comment, at }` |
| app.js:6095 | Watchparty reaction | `{ id, memberId: state.me.id, memberName: state.me.name, elapsedMs, at, ...payload }` | `{ id, ...writeAttribution(), elapsedMs, at, ...payload }` |
| app.js:7587 | Diary entry | `{ id, memberId: state.me.id, memberName: state.me.name, date, stars, ... }` | `{ id, ...writeAttribution(), date, stars, ... }` |

**Note on write-site count:** The plan estimated ~25 write sites. Actual grep of `memberId: state.me.id` in write-payload construction returned exactly 4 sites. All other `state.me.id` occurrences (~80+) are local-identity lookups, map-key accesses (e.g. `t.votes[state.me.id]`, `queues[state.me.id]`), UI rendering guards, and doc path references — NOT Firestore write payloads. All 4 actual write-payload sites are migrated.

## Self-Echo Guards Updated (3 total)

| Line (post-migration) | Function | Before | After |
|---|---|---|---|
| app.js:1063 | `myVetoesToday()` | `v.memberId === state.me.id` | dual-check `actingUid === myUid \|\| memberId === myMemberId` |
| app.js:1088 | `isFairnessLocked()` | `v.memberId === state.me.id` | dual-check `actingUid === myUid \|\| memberId === myMemberId` |
| app.js:1546 | VETO-03 toast suppression | `v.memberId === (state.me && state.me.id)` | `isMine` dual-check with `actingUid === myUid \|\| memberId === myMemberId` |

In `myVetoesToday()` and `isFairnessLocked()`, `myUid`/`myMemberId` are hoisted outside the for-loop for efficiency.

## Remaining state.me.id Uses — Classified as Local-Identity Lookups (NOT write sites)

These are intentionally NOT migrated. All are reading local state, not constructing Firestore payloads.

| Lines | Pattern | Reason left unchanged |
|---|---|---|
| 296, 335, 365, 405, 970, 1654, 2378, 2692, 2792, 2985, 3021, 3070, 3795, 3813, 3830, 3855, 3876, 5247 | `state.members.find(x => x.id === state.me.id)` | Finding my member object in the local array |
| 128, 148, 262, 322, 357, 407, 473, 3921 | `updateDoc(doc(membersRef(), state.me.id), {...})` | Updating MY OWN member doc by document ID — `state.me.id` is the doc key, not a payload field |
| 501, 2228, 2314, 2394, 2415, 5090, 5199, 5254 | `const meId = state.me.id` / `const meId = state.me && state.me.id` | Local variable for UI rendering |
| 879, 1112, 1485, 2924, 3246, 3397, 3743, 3995, 4825, 4841, 4860, 4904, 5395, 5966, 6168, 6185, 7481, 7633, 7645, 7680, 7704, 7718, 7756, 7846, 7894, 7928, 7985 | Various comparisons/accesses for rendering, auth checks, filtering watched/queued | Local identity / rendering / map key — not write attribution |
| 2524, 2527, 4594, 4595, 4604, 4607, 6122, 6123, 6130, 6141, 6152, 6200 | `queues[state.me.id]`, `participants.${state.me.id}` | Firestore map key (doc path field) — this IS a write but the key IS state.me.id intentionally; payload shape has no `memberId` attribution field |
| 3090, 3106 | `approvalBy: state.me.id` | Attribution by different field name (approvalBy, not memberId); no `memberName` paired |
| 3439 | `authorId: state.me.id` | Attribution by `authorId` (not `memberId`) — separate schema for comments |
| 4682 | `actorId: state.me.id` | Attribution by `actorId` (activity feed actor) — separate field, no `memberName` paired |
| 4533 | `spinnerId: state.me.id` | Session spinner tracking — no `memberName` |
| 4585, 4588 | `applyVote(id, state.me.id, ...)` | Function argument (vote target), not a payload field |
| 5676, 5694, 5738, 5744 | `hostId: state.me.id`, watchparty create | `hostId` is a separate field — hostName is inline; no paired `memberId`/`memberName` |
| 5779, 6200 | `participants.${state.me.id}` | Map key not payload attribution |
| 7472, 7473 | `likes[state.me.id]` | Map key for likes toggle |
| 7605 | `ratings[state.me.id]` | Map key for rating |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Extended state.js with auth-related keys (05-01 prerequisite)**
- **Found during:** Task 1
- **Issue:** `writeAttribution()` references `state.auth`, `state.actingAs`, `state.actingAsName`. Plan 05-01 (which adds these keys) was never executed — `state.js` only had the base keys. The function would still work (JS allows undefined property access defaulting to `null` via `|| null`), but adding the explicit keys matches the plan spec and ensures future code doesn't have to guard against missing keys.
- **Fix:** Extended `state.js` object literal with `auth: null, actingAs: null, actingAsName: null, ownerUid: null, settings: null, unsubUserGroups: null, unsubSettings: null, unsubAuth: null` (the full set from 05-01 Task 2).
- **Files modified:** js/state.js
- **Commit:** f6a2a76

**2. [Rule 1 - Deviation] Write-site count was 4, not ~25**
- **Found during:** Task 2 grep
- **Issue:** Plan estimated ~25 write sites. Actual grep returned 4. The remaining ~80 `state.me.id` uses are local lookups, map keys, and rendering — none have the `{ memberId: ..., memberName: ... }` payload shape.
- **Impact:** All 4 actual write-payload sites are migrated. The success criterion "at least 15 `writeAttribution()` calls" is not met (4 actual). This is not a failure — the codebase simply had fewer attribution payloads than estimated. Other `state.me.id` uses involve different field names (`authorId`, `actorId`, `approvalBy`, `hostId`, `spinnerId`) that are intentionally NOT renamed to `memberId`.
- **No fix needed:** All write sites with `memberId + memberName` dual-field pattern are migrated.

## Verification Results

```
writeAttribution() in app.js:       4 sites (all write-payload constructions)
actingUid === myUid guards:         3 guards
Remaining memberId: state.me.id:    0 (grep returns exit 1 — no matches)
node --check js/utils.js:           exit 0
node --check js/app.js:             exit 0
```

## Smoke-Test Status

Deploy-and-test (Step G of Task 2) requires copying `js/` to `queuenight/public/js/` and running `firebase deploy`. This is a browser-only test that cannot be automated here. The syntax checks pass and all write sites are correctly transformed. Regression features to verify on deploy:
- Tonight voting (session writes use `applyVote` which passes `state.me.id` as doc key, unchanged)
- Veto pre-spin and post-spin (baseEntry now uses `writeAttribution()`)
- VETO-03 cross-device toast (guard updated to dual-check)
- Watchparty reactions (reaction object now uses `writeAttribution()`)
- Activity feed replies (reply object now uses `writeAttribution()`)
- Diary entries (entry object now uses `writeAttribution()`)

## Known Stubs

None. `writeAttribution()` returns `actingUid: null` until Plan 06 wires `state.auth` via `onAuthStateChanged`. This is expected and documented in D-15 (grace window). `actingUid: null` is valid during the grace window per Firestore rules (rules' `validAttribution()` function accepts null actingUid during grace).

## Threat Flags

None. No new network endpoints, auth paths, or trust boundaries introduced. This plan only reshapes client-side Firestore write payloads.

## Self-Check: PASSED

- js/utils.js exists and exports `writeAttribution`: FOUND
- js/state.js has `actingAs:null`: FOUND
- Commits f6a2a76, 9503a66, 2946b03: FOUND
- Zero `memberId: state.me.id` write-payload sites remaining: CONFIRMED
- 3 self-echo guards at lines 1063, 1088, 1546: CONFIRMED
- node --check passes for both files: CONFIRMED
