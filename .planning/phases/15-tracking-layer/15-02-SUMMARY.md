---
phase: 15
plan: 02
subsystem: tracking-layer-primitives
tags: [tracking-layer, js-primitives, firestore-writes, REVIEW-HIGH-2, REVIEW-MEDIUM-6, REVIEW-MEDIUM-8, forward-contract-15-01]
requires:
  - "15-01 firestore.rules (5th UPDATE branch on families/{code} for tupleNames)"
  - "15-01 firestore.rules title-doc UPDATE branch with per-key isolation + actingTupleKey echo contract"
  - "writeAttribution() pattern from js/utils.js:92-107 (already imported)"
  - "deleteField from js/firebase.js (already imported at js/app.js:1)"
provides:
  - "tupleKey(memberIds) — sorted-comma-join encoder with HIGH-2 char-safety guard"
  - "isSafeTupleKey(tk) — defense-in-depth regex /^[A-Za-z0-9_,-]+$/ validator"
  - "tupleProgressFromTitle(t) — read accessor for t.tupleProgress map"
  - "tuplesContainingMember(t, memberId) — cross-show roll-up read for S1 widget + S2 detail-modal"
  - "tupleCustomName(tk) — REVIEW MEDIUM-6 helper returning null when no custom name set"
  - "tupleDisplayName(tk, members) — derived-fallback display resolver per UI-SPEC §Discretion Q3"
  - "writeTupleProgress(titleId, memberIds, season, episode, source) — stamps actingTupleKey per 15-01 forward-contract"
  - "clearTupleProgress(titleId, tupleKeyStr) — stamps actingTupleKey per 15-01 forward-contract"
  - "setTupleName(tupleKeyStr, name) — dotted-path family-doc write with HIGH-2 guard + MEDIUM-8 optimistic local update"
  - "writeMutedShow(titleId, memberId, muted) — per-member dotted-path mutedShows toggle"
  - "state.family.tupleNames hydration via family-doc onSnapshot extension"
affects:
  - "Plan 15-03 (D-01 watchparty-end auto-track + S6 mute-toggle) — consumes writeTupleProgress + writeMutedShow"
  - "Plan 15-04 (S2 detail-modal section + S3 inline rename) — consumes tupleCustomName, tupleDisplayName, setTupleName, clearTupleProgress"
  - "Plan 15-05 (S1 Tonight pickup widget) — consumes tuplesContainingMember + tupleDisplayName"
  - "Plan 15-07 (Trakt overlap accept path / S5 conflict prompt) — consumes writeTupleProgress with source='trakt-overlap'"
tech-stack:
  added:
    - "Tuple-key data primitive (sorted-comma-join encoding deterministic across JS / CF / firestore.rules)"
    - "Defense-in-depth field-path-character validator (HIGH-2 mitigation)"
    - "Optimistic-local-state pattern for cross-snapshot UI continuity (MEDIUM-8)"
    - "actingTupleKey echo field per Plan 15-01 forward-contract (rule-required for tupleProgress writes)"
  patterns:
    - "Sibling-primitive insertion (Phase 14-05 convention) — additive shape t.tupleProgress alongside legacy t.progress"
    - "Clone-as-sibling — tupleKey reader/writer mirrors getMemberProgress/writeMemberProgress at js/app.js:8142/8174"
    - "Family-doc dotted-path write (clone-of-persistCouchInTonight pattern from 14-10) for setTupleName"
    - "writeAttribution() field stamping for rules-enforced per-member isolation (HIGH-1 mitigation surface)"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-02-SUMMARY.md (this file)"
  modified:
    - "js/app.js (270 net insertions across 3 contiguous regions)"
decisions:
  - "Stamped actingTupleKey: <tk> in BOTH writeTupleProgress AND clearTupleProgress payloads — required by the 15-01 firestore.rules title-doc UPDATE branch (lines 391-396); plan must_haves did not mention this contract explicitly, so it was added per the forward-contract block in the executor prompt"
  - "writeMutedShow relies on writeAttribution()'s automatic memberId/managedMemberId stamping for the per-member rule check; no extra echo needed since the rule reads inner-key against managedMemberId-or-memberId payload fields"
  - "Did NOT modify any existing helper signature; all changes are additive (verified via git diff)"
  - "deleteField was already imported at js/app.js:1 (verified via Grep before Task 2 edit) — no import block change needed"
metrics:
  duration_seconds: 360
  duration_minutes: 6
  task_count: 2
  file_count: 1
  completed: "2026-04-27"
---

# Phase 15 Plan 02: Tracking Layer Primitives Summary

**One-liner:** Adds 10 tuple-progress data primitives + 1 family-doc snapshot hydration line to js/app.js — the foundation every downstream Phase 15 surface (S1 widget, S2 detail-modal, S3 rename, S5 overlap prompt, S6 mute toggle, D-01 auto-track, D-06 Trakt overlap) consumes. All writes that touch a tuple key flow through HIGH-2 char-safety guards, and writeTupleProgress/clearTupleProgress stamp the rule-required actingTupleKey echo per the 15-01 forward-contract.

---

## What Shipped

### a) Read helpers block — `js/app.js:8021-8140`

Inserted IMMEDIATELY ABOVE `function getMemberProgress` (now at line 8142) under marker `// === Phase 15 — Tracking Layer (read helpers) ===`:

| Function | Line | Purpose |
|---|---|---|
| `isSafeTupleKey(tk)` | 8032 | REVIEW HIGH-2 — regex `/^[A-Za-z0-9_,-]+$/` defense-in-depth validator |
| `tupleKey(memberIds)` | 8040 | Sorted-comma-join encoder; per-ID validation `/^[A-Za-z0-9_-]+$/`; Sentry breadcrumb on rejection; returns `''` on unsafe input |
| `tupleProgressFromTitle(t)` | 8069 | Returns `t.tupleProgress` map or `{}` |
| `tuplesContainingMember(t, memberId)` | 8077 | Returns `[{tupleKey, prog}, ...]` sorted by `prog.updatedAt` desc |
| `tupleCustomName(tk)` | 8097 | REVIEW MEDIUM-6 — returns user-set string or `null` (NOT empty string, NOT derived fallback) |
| `tupleDisplayName(tk, members)` | 8116 | UI-SPEC §Discretion Q3 fallback rules: `"You (solo)"`, `"<name> and me"`, `"You + N"`, etc. |

### b) Writers block — `js/app.js:8205-8351`

Inserted IMMEDIATELY AFTER `clearMemberProgress` (now ending at line 8200) under marker `// === Phase 15 — Tracking Layer (writers) ===`:

| Function | Line | Notes |
|---|---|---|
| `writeTupleProgress(titleId, memberIds, season, episode, source)` | 8222 | Stamps `actingTupleKey: tk` per 15-01 forward-contract; HIGH-2 gate via `isSafeTupleKey(tk)` |
| `clearTupleProgress(titleId, tupleKeyStr)` | 8250 | Stamps `actingTupleKey: tupleKeyStr` per 15-01 forward-contract; HIGH-2 gate |
| `setTupleName(tupleKeyStr, name)` | 8281 | HIGH-2 gate before dotted-path write; MEDIUM-8 optimistic `state.family.tupleNames[tk] = slot` after success; flashToast verbatim copy on failure |
| `writeMutedShow(titleId, memberId, muted)` | 8336 | Dotted-path `mutedShows.{memberId}` toggle using `deleteField()` for unmute; relies on `writeAttribution()` for rules-enforced per-member isolation |

### c) Family-doc snapshot hydration — `js/app.js:4143-4145`

Inserted 3 lines immediately AFTER `state.couchMemberIds = couchInTonightToMemberIds(...)` (line 4142) and BEFORE `state.selectedMembers = state.couchMemberIds.slice()` (now line 4147):

```javascript
    // === Phase 15 / D-02 — tupleNames hydration ===
    state.family = state.family || {};
    state.family.tupleNames = (d && d.tupleNames) || {};
```

Existing render calls (`renderCouchViz`, `renderFlowAEntry`, `renderPickerCard`, `applyModeLabels`, etc.) already fire on family-doc snapshot, so consumers in 15-04/15-05 will pick up the hydrated `state.family.tupleNames` on the same render tick.

### d) `deleteField` import status

Already imported at `js/app.js:1` alongside `updateDoc`, `doc`, `arrayUnion`, etc. (verified via Grep before Task 2 edit). NO import-block modification was needed.

---

## Forward-Contract Compliance (15-01)

The Plan 15-01 firestore.rules title-doc UPDATE branch (lines 360-426) requires the following from this plan's writers — verified line-by-line against the rule contract:

| Write | Rule contract | Implementation |
|---|---|---|
| `writeTupleProgress` → `t.tupleProgress[tk] = {...}` | Diff must affect exactly one tupleKey AND echo `actingTupleKey: tk` AND echoed key must contain actor memberId/managedMemberId | Line 8244: `await updateDoc(..., { ...writeAttribution(), tupleProgress: prev, actingTupleKey: tk })`. The actor's memberId is in writeAttribution's payload, so the rule's regex `(^\|.*,)<actor>(,.*\|$)` matches because callers always include their own memberId in `memberIds`. |
| `clearTupleProgress` → `delete t.tupleProgress[tk]` | Same as above — diff = 1 inner key (the deleted one), `actingTupleKey` echo required | Line 8266: `await updateDoc(..., { ...writeAttribution(), tupleProgress: prev, actingTupleKey: tupleKeyStr })`. |
| `setTupleName` → `families/{code}.tupleNames[tk] = {...}` | 5th UPDATE branch allowlist `['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName']` | Line 8307: `await updateDoc(..., { [`tupleNames.${tk}`]: slot, ...writeAttribution() })` — only allowlisted fields written. |
| `writeMutedShow` → `t.mutedShows[memberId] = true \| deleteField()` | Inner-map diff `affectedKeys().hasOnly([managedMemberId \|\| memberId])` | Line 8338-8348: `await updateDoc(..., { [`mutedShows.${memberId}`]: ..., ...writeAttribution() })`. Caller passes `memberId === me.id` (per 15-03 design); writeAttribution() stamps `memberId: me.id` (or `managedMemberId: subProfileId` when proxy-acting), so the inner-key `[memberId]` matches the rule check. |

All 4 write paths are rule-compliant by construction. Without the `actingTupleKey` echo on writeTupleProgress/clearTupleProgress, the writes would have been rejected with PERMISSION_DENIED. This was a forward-contract from 15-01 not explicitly mentioned in 15-02's plan must_haves — see Deviations §1.

---

## Note for Plan 15-04

**`tupleCustomName(tk) === null` is the correct gate for the placeholder render** in `renderCv15TupleProgressSection` — NOT `!tupleDisplayName(tk)`. The latter almost never returns falsy because the derived fallback always produces a non-empty string ("You (solo)", "Wife and me", etc.).

Use `tupleCustomName` to distinguish "user has not set a custom name" (render italic `*name this couch*` placeholder) from "user has set a custom name" (render the custom string). Use `tupleDisplayName` when you want the human-readable name regardless of source (custom-OR-derived).

---

## HIGH-2 Character-Safety Regex Reference

| Surface | Regex | Notes |
|---|---|---|
| `isSafeTupleKey(tk)` validator | `/^[A-Za-z0-9_,-]+$/` | Allows the comma separator between sorted member IDs |
| Per-ID validation in `tupleKey()` | `/^[A-Za-z0-9_-]+$/` | NO comma allowed in individual member IDs (would create ambiguous tuple keys) |

Any character outside these ranges (`.`, backtick, `/`, `\`, `$`, `[`, `]`, `#`, etc.) is rejected at write time with a Sentry breadcrumb (category=`tupleNames`).

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Forward-contract from 15-01: writeTupleProgress + clearTupleProgress MUST stamp `actingTupleKey` field**

- **Found during:** Pre-Task-2 firestore.rules inspection (per executor prompt's `<forward_contract_from_15_01>` block)
- **Issue:** The Plan 15-02 must_haves and action-text DID NOT mention the `actingTupleKey` echo field. But the merged 15-01 firestore.rules title-doc UPDATE branch (lines 391-396) REQUIRES this field on every tupleProgress write — without it, all writes are denied with PERMISSION_DENIED. This was a 15-01 deviation (REVIEW HIGH-1 mitigation that the planner couldn't express in the rules expression language without the client-side echo).
- **Fix:** Added `actingTupleKey: tk` to the writeTupleProgress payload (line 8244) and `actingTupleKey: tupleKeyStr` to the clearTupleProgress payload (line 8266). The HIGH-2 isSafeTupleKey() guards earlier in each function ensure the echoed value is rule-compliant.
- **Files modified:** `js/app.js` (writers block lines 8222-8268)
- **Commit:** `0225579`

### Auth gates / Human action

None. Rules + tests + JS edits only; no auth needed during execution.

### Items NOT changed (per scope)

- **No CSS** — Plan 15-04 ships `.cv15-*` styles
- **No HTML** — Plan 15-05 ships the Tonight widget anchor in app.html
- **No CF changes** — Plan 15-06 ships watchpartyTick extension
- **No service-worker bump** — Plan 15-09 ships the v35 cache bump
- **No changes to existing per-individual `getMemberProgress` / `writeMemberProgress` / `clearMemberProgress` / `membersWithProgress`** — kept untouched per "atomic sibling primitive" Phase 14-05 convention; legacy `t.progress[memberId]` shape stays the source for v1 per-individual progress
- **No tests** — rules tests for tupleProgress + mutedShows isolation already shipped in 15-01 (#27-#32)

---

## Verification Evidence

```
$ node --check js/app.js
(silent — exit 0; PASS)

$ grep -c 'function tupleKey(memberIds)' js/app.js                                        → 1 ✓
$ grep -c 'function isSafeTupleKey(tk)' js/app.js                                          → 1 ✓
$ grep -c 'function tupleProgressFromTitle(t)' js/app.js                                   → 1 ✓
$ grep -c 'function tuplesContainingMember(t, memberId)' js/app.js                         → 1 ✓
$ grep -c 'function tupleCustomName(tk)' js/app.js                                         → 1 ✓
$ grep -c 'function tupleDisplayName(tk, members)' js/app.js                               → 1 ✓
$ grep -c 'async function writeTupleProgress(titleId, memberIds, season, episode, source)' → 1 ✓
$ grep -c 'async function clearTupleProgress(titleId, tupleKeyStr)' js/app.js              → 1 ✓
$ grep -c 'async function setTupleName(tupleKeyStr, name)' js/app.js                       → 1 ✓
$ grep -c 'async function writeMutedShow(titleId, memberId, muted)' js/app.js              → 1 ✓
$ grep -c '// === Phase 15 — Tracking Layer (read helpers) ===' js/app.js                  → 1 ✓
$ grep -c '// === Phase 15 — Tracking Layer (writers) ===' js/app.js                       → 1 ✓
$ grep -c 'state.family.tupleNames = (d && d.tupleNames) || {}' js/app.js                  → 1 ✓
$ grep -c 'REVIEW HIGH-2' js/app.js                                                        → 5 ✓ (≥4)
$ grep -c 'REVIEW MEDIUM-6' js/app.js                                                      → 2 ✓ (≥1)
$ grep -c 'REVIEW MEDIUM-8' js/app.js                                                      → 2 ✓ (≥1)
$ grep -c 'TUPLE_KEY_SAFE_RE' js/app.js                                                    → 2 ✓
$ grep -c 'isSafeTupleKey' js/app.js                                                       → 7 ✓ (decl + 6 callers/refs)
$ grep -c "Couldn't save name" js/app.js                                                   → 2 ✓ (rules-fail + HIGH-2-unsafe-key paths in setTupleName)
$ grep -c 'actingTupleKey' js/app.js                                                       → 5 ✓ (writeTupleProgress + clearTupleProgress + 3 doc-comment refs)
```

git diff summary:

```
$ git diff 879c9e3..HEAD -- js/app.js | grep -c "^+"                                       → ~290 (insertions)
$ git diff 879c9e3..HEAD -- js/app.js | grep -c "^-"                                       → 0 baseline lines deleted (existing helpers untouched)
```

Three contiguous regions modified:
1. `js/app.js:4143-4145` — 3-line snapshot hydration (Task 2)
2. `js/app.js:8021-8140` — 120-line read helpers block (Task 1)
3. `js/app.js:8205-8351` — 147-line writers block (Task 2)

---

## Commits (this worktree)

| Hash      | Type | Subject |
|-----------|------|---------|
| `21b4373` | feat | add tuple READ helpers + isSafeTupleKey + tupleCustomName |
| `0225579` | feat | add tuple WRITE helpers + setTupleName + family-doc snapshot hydration |

---

## Self-Check: PASSED

Files exist:
- FOUND: `js/app.js` (modified — 3 contiguous regions)
- FOUND: `.planning/phases/15-tracking-layer/15-02-SUMMARY.md` (this file)

Commits exist:
- FOUND: `21b4373` in `git log --oneline -3`
- FOUND: `0225579` in `git log --oneline -3`

All success criteria from the plan satisfied:

1. ✓ 6 new read helpers as a sibling-primitive block IMMEDIATELY ABOVE getMemberProgress (now at line 8142)
2. ✓ 4 new write helpers as a sibling-primitive block IMMEDIATELY AFTER clearMemberProgress (now ending at line 8200), with HIGH-2 isSafeTupleKey gates on every tuple-key-touching write
3. ✓ setTupleName performs OPTIMISTIC local state update after Firestore updateDoc resolves (REVIEW MEDIUM-8) — line 8316
4. ✓ Family-doc onSnapshot extended with 3 lines (comment + state.family init + tupleNames hydration) immediately after couchMemberIds — lines 4143-4145
5. ✓ Both grep markers present exactly once each
6. ✓ Error toast copy `Couldn't save name — try again` matches UI-SPEC verbatim (em-dash mid-line, sentence case)
7. ✓ tupleCustomName(tk) returns `null` (not derived fallback) when no custom name set — required by REVIEW MEDIUM-6
8. ✓ `node --check js/app.js` exits 0
9. ✓ No existing function signature modified — additions only
10. ✓ Forward-contract from 15-01 honored: writeTupleProgress + clearTupleProgress stamp `actingTupleKey` field (deviation §1)
