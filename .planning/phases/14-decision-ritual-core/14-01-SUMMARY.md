---
phase: 14-decision-ritual-core
plan: 01
plan-name: Already-watched filter (D-01)
requirements_addressed: [DECI-14-01]
status: complete
completed: 2026-04-25
commits:
  - hash: 8ddb347
    type: feat
    msg: "feat(14-01): add isWatchedByCouch + setRewatchAllowed helpers (D-01)"
    files: [js/app.js, js/state.js]
  - hash: 5a9ea75
    type: docs
    msg: "docs(14-01): document rewatchAllowedBy permitted by existing title rule (D-01)"
    files: [firestore.rules]
files-touched:
  created: []
  modified:
    - js/app.js          # +helpers + 6 discovery filter wraps
    - js/state.js        # +couchMemberIds slot
    - firestore.rules    # +Case B documenting comment
deviations: 1   # minor positional deviation (helper insertion site), surfaced below
checkpoints-hit: 0
auth-gates-hit: 0
---

# Phase 14 Plan 01: Already-watched filter Summary

D-01's strict, member-aware "already-watched" filter shipped: a single
client-side `isWatchedByCouch(t, couchMemberIds)` helper now sits at the
foundation of every couch-discovery render path, OR'ing the four
watched-status sources (Trakt sync, voted Yes, voted No, manual mark)
across the active couch with a same-day per-title rewatch override.
firestore.rules permit the new `t.rewatchAllowedBy` map without
modification because the existing /titles/{titleId} update rule has no
affectedKeys() allowlist (Case B).

## What shipped

### `js/app.js` — D-01 helpers (after `reindexMyQueue`, before `getGroupNext3`)

Three new functions inserted as a marked block (`// === D-01 helpers — DECI-14-01 ===`):

- **`isWatchedByCouch(t, couchMemberIds)`** — client-side-only filter
  predicate. Returns `true` iff any couch member has the title flagged
  via any of D-01's 4 sources, with the per-title rewatch override
  bypass applied first (24h same-day window). Comment block at the
  helper definition explicitly states "CFs MUST NOT call this" to
  preserve the D-01 invitation bypass.
- **`getCouchOrSelfIds()`** — small private helper that resolves
  `state.couchMemberIds` with a `[state.me.id]` fallback when no couch
  has been claimed yet (i.e., until 14-04's cushion-claim writer ships
  the populate path). Matches D-01's documented single-member discovery
  default.
- **`setRewatchAllowed(titleId, memberId)`** — async writer that stamps
  `t.rewatchAllowedBy.{memberId} = Date.now()` via `updateDoc` with
  `writeAttribution()` spread, plus a `flashToast` on success/failure.
  Exposed on `window` for action-sheet handlers added by 14-04 / 14-05.

### `js/app.js` — discovery filter integration (6 callsites)

| File:line (approx) | Function                | Surface                | Substitution                                                    |
|---|---|---|---|
| `js/app.js:6831`     | `getMyQueueTitles`      | Library "My Queue"     | `!t.watched` → `!isWatchedByCouch(t, couch)`                    |
| `js/app.js:5790`     | `getNeedsVoteTitles`    | Swipe / Vote mode      | `if (t.watched) return false` → `if (isWatchedByCouch(...))`    |
| `js/app.js:6614`     | `getCurrentMatches`     | Spin candidate pool    | `if (t.watched) return false` → `if (isWatchedByCouch(...))`    |
| `js/app.js:6862`     | `getGroupNext3`         | Group "Up next"        | `if (t.watched) return` → `if (isWatchedByCouch(...)) return`   |
| `js/app.js:4191`     | `passesBaseFilter` (in `renderTonight`) | Tonight tab matches + considerable | `if (t.watched) return false` → `if (isWatchedByCouch(...))` |
| `js/app.js:4506,4514` | `renderLibrary` `unwatched` + `forme` filter branches | Library tab | `!t.watched` → `!isWatchedByCouch(t, couchForLib)` |

(Line numbers approximate — exact line shifted by the helper insertion;
re-grep `isWatchedByCouch(` to enumerate.)

The `'watched'`, `'myrequests'`, `'inprogress'`, `'toprated'`,
`'scheduled'`, `'recent'` Library filters were intentionally LEFT
UNTOUCHED — these are status-driven archive/utility views, not discovery
surfaces, and need to surface their full scope regardless of watch
state.

### `js/state.js` — couch slot declaration

Added `couchMemberIds: []` to the `state` object initializer with a
comment block noting:
- The slot is owned/written by Plan 14-04 (couch viz cushion-claim
  writer).
- 14-01 declares the slot only so `isWatchedByCouch()` has a stable
  place to read.
- Until 14-04 ships, callers fall back to `[state.me.id]` per D-01
  default.

### `firestore.rules` — Case B documenting comment

The existing `/families/{familyCode}/titles/{titleId}` update rule
(line ~277) is **`allow create, update: if attributedWrite(familyCode);`**
— permissive, with no `hasOnly([...])` affectedKeys allowlist. So the
new `t.rewatchAllowedBy: { [memberId]: timestamp }` field is already
accepted by an attributed family-member write without rule modification
(mirrors the existing permissive surface for `t.queues` / `t.votes` /
`t.ratings` / `t.progress` / `t.diary` per-member-keyed maps).

Rather than touch the rule itself (Case A would have only applied if
there were a hasOnly allowlist to extend), the plan's Case B path adds
a `// Phase 14 / DECI-14-01 (D-01)` comment block above the rule so the
next reader knows:

1. Why the new field doesn't appear explicitly in any allowlist.
2. Where to add it if/when the rule is ever tightened to a hasOnly
   allowlist (e.g. as part of a future hardening pass).

Verified the file parses cleanly via the Firebase emulator:
```
cd tests/ && node -e "require('fs').copyFileSync('../firestore.rules','firestore.rules')" \
  && firebase emulators:exec --only firestore --project queuenight-84044 "echo rules-parsed-ok"
# → "rules-parsed-ok" + exit 0; no parse errors, no warnings.
```

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `grep -c "function isWatchedByCouch(" js/app.js` | 1 | **1 ✓** |
| `grep -c "function setRewatchAllowed(" js/app.js` | 1 | **1 ✓** |
| `grep -c "state.couchMemberIds" js/app.js` | ≥2 | **8 ✓** (initializer + 7 callsites) |
| `grep -c "rewatchAllowedBy" firestore.rules` | ≥1 | **2 ✓** (comment block + body) |
| Spot-check: zero `isWatchedByCouch` refs in queuenight/functions/index.js | 0 refs | **invariant by construction** — only edited js/app.js + js/state.js + firestore.rules; queuenight/ is the sibling repo and was not touched. |
| All 4 D-01 sources visible in helper body | yes | **yes ✓** — `t.watched`, `votes[mid] === 'yes'`, `votes[mid] === 'no'`, `t.rewatchAllowedBy` all present |

## Success criteria (per plan `<success_criteria>`)

1. ✓ `isWatchedByCouch(t, couchMemberIds)` exists in js/app.js and OR's
   the 4 sources correctly with rewatch override bypass.
2. ✓ `setRewatchAllowed(titleId, memberId)` writes the override map with
   proper `writeAttribution()` spread and surfaces a `flashToast` on
   both success and failure paths.
3. ✓ At least one (in fact, six) discovery render paths in js/app.js
   consume `isWatchedByCouch` to filter candidates — Library queue,
   Library `unwatched`, Library `forme`, Tonight matches+considerable,
   Spin candidate pool, Swipe candidate pool, group "up next" aggregator.
4. ✓ firestore.rules permits the new `rewatchAllowedBy` field on title
   updates via the existing permissive update rule (Case B applied);
   documenting comment added.
5. ✓ Invitation bypass invariant holds: zero references to
   `isWatchedByCouch` in queuenight/functions/index.js (this plan never
   touched queuenight/ at all per two-repo discipline).

## Deviations from plan

### 1. [Rule N/A — Plan-allowed positional choice] Helper insertion site

- **Found during:** Task 1 — locating the insertion point.
- **Plan said:** "Insert IMMEDIATELY AFTER `getMyQueueTitles` (and
  BEFORE `getGroupNext3`)."
- **What's actually there:** `getMyQueueTitles` (lines 6827-6832),
  `reindexMyQueue` (lines 6834-6847), then `getGroupNext3` (line 6852).
  `reindexMyQueue` is the queue's persist-renumber companion that lives
  between the two.
- **Choice made:** Inserted the D-01 helper block AFTER `reindexMyQueue`
  and BEFORE `getGroupNext3` — preserves the queue-helper cluster
  (getMyQueueTitles + reindexMyQueue belong together) while still
  satisfying both literal plan constraints (after getMyQueueTitles, AND
  before getGroupNext3).
- **Impact:** Cosmetic only. Same effective slot for grep / future
  navigation. Helper marker `// === D-01 helpers — DECI-14-01 ===` makes
  the block discoverable regardless of relative position.
- **Files modified:** js/app.js
- **Commit:** 8ddb347

No bug-fixes (Rule 1), no missing-functionality additions (Rule 2), no
architectural escalations (Rule 4) were needed. The plan was
well-specified and the codebase analogs landed cleanly.

## Authentication gates

None.

## Threat surface scan

No new threat surface introduced beyond what the plan's `<threat_model>`
already enumerates (T-14.01-01..03). The `setRewatchAllowed` writer goes
through the existing `attributedWrite()` rule with `writeAttribution()`
spread — the actor identity is enforced by the same path as every other
title-doc update, and the new field is a per-member-keyed timestamp map
of bounded size (one entry per couch member, max ~10 per family per
T-14.01-03's accepted disposition).

## Known stubs

None. The helpers are wired into all six discovery surfaces; nothing
returns mocked or empty data downstream of the changes.

## Open follow-ups for downstream plans

- **14-04 (Couch viz)** — owns the `state.couchMemberIds` writer.
  Until 14-04 ships its cushion-claim path, every D-01 callsite falls
  back to `[state.me.id]` (single-member discovery). On a couch with 2+
  members, that means a member who hasn't been "seated" via 14-04 won't
  contribute their watch history to the filter — by design, since 14-04
  is the source of truth for "who's actually on the couch tonight."
- **14-04 / 14-05 (Action sheet)** — owns the "Rewatch this one" action
  sheet item that calls `window.setRewatchAllowed(titleId, memberId)`.
  Helper is exposed on `window` and ready to wire.
- **Spin and Tonight** — these surfaces use `state.selectedMembers` as
  the pre-14-04 couch identity (the actively-selected "who's
  watching" chips), with `state.couchMemberIds` taking precedence when
  populated. This means 14-04's writer should set `couchMemberIds` to
  the seated members, NOT to the same value as `selectedMembers`,
  unless those concepts merge in the redesign — flag for 14-04 planner.
- **Library and other discovery surfaces** — these use the strict
  `getCouchOrSelfIds()` (couch OR self only — not selectedMembers).
  Once 14-04 lands, this becomes the canonical "active couch" everywhere.
- **Rule-test coverage** — tests/rules.test.js has zero existing
  title-write tests, so we deliberately did NOT scaffold one for the
  rewatchAllowedBy path (per plan). When a future plan does add the
  first title-write test, include a sibling case for
  `rewatchAllowedBy.{mid}: ts + writeAttribution()` to prevent silent
  regressions if the title rule is later tightened to an allowlist.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f js/state.js ]` → FOUND
- `[ -f firestore.rules ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-01-SUMMARY.md ]` → FOUND (this file)
- Commit `8ddb347` in `git log --oneline` → FOUND
- Commit `5a9ea75` in `git log --oneline` → FOUND
