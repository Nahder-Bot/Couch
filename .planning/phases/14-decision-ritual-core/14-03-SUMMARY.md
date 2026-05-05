---
phase: 14-decision-ritual-core
plan: 03
plan-name: Tiered candidate filter aggregators (D-02)
requirements_addressed: [DECI-14-02]
status: complete
completed: 2026-04-26
commits:
  - hash: ccf600f
    type: feat
    msg: "feat(14-03): add D-02 tier aggregators (T1/T2/T3 + T3 visibility resolver)"
    files: [js/app.js]
files-touched:
  created: []
  modified:
    - js/app.js          # +4 pure functions (T1/T2/T3 aggregators + T3 visibility resolver), +102 lines
deviations: 0
checkpoints-hit: 0
auth-gates-hit: 0
tasks-completed: 1
---

# Phase 14 Plan 03: Tiered candidate filter aggregators Summary

D-02's three-tier candidate filter shipped as a pure data layer: four
new top-level functions (`getTierOneRanked`, `getTierTwoRanked`,
`getTierThreeRanked`, `resolveT3Visibility`) co-located with the
existing `getGroupNext3` analog. All three aggregators consume the
14-01 `isWatchedByCouch` helper before tier-classifying so already-
watched titles never leak into any tier. T3 visibility resolves via
most-restrictive-wins across account/family/group `preferences.showT3`
(privacy-leaning posture matching Phase 13). No UI rendered — that
arrives in 14-07 (Flow A picker).

## What shipped

### `js/app.js` — D-02 tier aggregator block (after `getGroupNext3`, before `renderNext3`)

Inserted as a marked block (`// === D-02 tier aggregators — DECI-14-02 ===`)
beginning at the line immediately following the existing `getGroupNext3`
implementation. After the edit, the four functions occupy roughly
`js/app.js:7006-7106` (102 added lines). Exact insertion site verified
by reading the surrounding region (lines 6920-7009) before editing.

| Function | Sort | Predicate (after isWatchedByCouch exclusion) |
|---|---|---|
| `getTierOneRanked(couchMemberIds)` | asc `meanRank` → desc `rating` | every couch member has `t.queues[mid] != null` |
| `getTierTwoRanked(couchMemberIds)` | desc `couchPresenceCount` → asc `meanPresentRank` → desc `rating` | ≥1 couch presence AND NOT all couch presence |
| `getTierThreeRanked(couchMemberIds)` | asc `meanOffCouchRank` → desc `rating` | zero couch overlap AND ≥1 off-couch presence |
| `resolveT3Visibility()` | (boolean) | `false` iff any of `state.me/family/group.preferences.showT3` is `=== false`; else `true` |

Each emitted record carries the title plus the sort-relevant numeric
fields, so downstream UI in 14-07 can render the explanatory chrome
("3 want it" / "Sara wants it") without re-walking `t.queues`.

### Why these signatures

- **T1 mean (not Σ 1/rank):** D-02 specifies arithmetic mean of member
  queue ranks. The existing `getGroupNext3` uses Σ 1/rank — appropriate
  for "weight more queueing members positively" but inappropriate for
  the intersection contract of T1 where every couch member is required
  to queue. Mean rank gives equal weight to each couch member's
  ordering preference, matching D-02's group-trust framing.
- **T2 sort by `couchPresenceCount` first:** Within T2 (the strict T1
  complement), more couch interest should surface higher than tighter
  individual ranks. A 2-of-3 couch title at mean-rank 4 outranks a
  1-of-3 couch title at mean-rank 1 because the social signal of
  multiple-member overlap is stronger than the individual ranking
  delta. Ascending mean breaks ties within the same presence count.
- **T3 zero-couch-overlap predicate:** Strict zero (not "fewer than
  half") because the privacy framing of T3 — "watching her movie
  without her" — only fires when the target couch member has no stake
  in the title at all. If she queued it, it belongs in T2.
- **resolveT3Visibility "explicit-false-wins":** Per D-02's
  most-restrictive-wins semantics + Phase 13 compliance posture: a
  preference key being `undefined` (no UI yet to set it) falls through
  to default-show. An explicit `false` at any of three levels hides T3.
  This matches how Phase 13 CSP / consent gating defaults to the
  privacy-leaning side when a signal is absent.

## Behavior verification trace

The plan defined 8 behavior tests; this plan ships no formal test
harness (deferred to `/gsd-verify-work`). Manual code-trace
verification per test:

| # | Test | Verifying expression in code |
|---|---|---|
| 1 | `getTierOneRanked([])` → `[]` | `if (!Array.isArray(...) \|\| !couchMemberIds.length) return [];` (line 1 of T1) |
| 2 | `{m1:3, m2:1}` → meanRank 2 | `ranks.reduce((a,b)=>a+b,0)/ranks.length` = (3+1)/2 = 2 |
| 3 | `{m1:1}` only (m2 missing) → excluded | `if (ranks.some(r => r == null)) return;` (intersection guard) |
| 4 | watched title excluded | `if (isWatchedByCouch(t, couchMemberIds)) return;` (every aggregator) |
| 5 | meanRank=2 tie → higher rating sorts first | `out.sort((a,b) => (a.meanRank - b.meanRank) \|\| (b.ratingTie - a.ratingTie))` (descending tie-break) |
| 6 | T2 strict T1 complement | `if (presentRanks.length === 0) return; if (presentRanks.length === couchMemberIds.length) return;` |
| 7 | T3 zero-couch + ≥1 off-couch | `if (couchPresent.length > 0) return; if (offCouchPresent.length === 0) return;` |
| 8 | Tier disjointness | T1 requires `length === couchMemberIds.length`; T2 excludes that case; T3 requires `couchPresent.length === 0` (never overlaps T1 or T2). Disjoint by construction. |

## Untouched code

- **`getGroupNext3`:** NOT modified. It serves the legacy Tonight tab
  "Up next" surfacing (sums 1/rank across ALL queueing members, no
  intersection requirement, returns top 5). The new aggregators
  coexist beside it.
- **`isWatchedByCouch` (14-01):** NOT modified. Called as a
  pre-classification gate inside each tier aggregator.
- **No `window.*` exports:** Per the plan, the aggregators are not
  exported on `window`. They will be called from inline render JS in
  14-07's UI plan, which can read top-level functions without
  window-prefixing — matches the pattern used for `getMyQueueTitles`
  and `getGroupNext3` (neither is window-scoped).

## Verification

```
node --check js/app.js                                          → exit 0
grep -c "function getTierOneRanked("    js/app.js               → 1
grep -c "function getTierTwoRanked("    js/app.js               → 1
grep -c "function getTierThreeRanked("  js/app.js               → 1
grep -c "function resolveT3Visibility(" js/app.js               → 1
grep -c "isWatchedByCouch(t, couchMemberIds)" js/app.js         → 4
       (1 declaration at js/app.js:6930 + 3 aggregator call sites
        at lines 7016/7037/7070 — each tier aggregator calls it)
```

All checks pass. Plan minimum 80 added lines requirement satisfied
(102 added).

## Note for 14-07 executor

The Flow A picker UI (14-07) is the primary downstream consumer of
this plan. Two integration points:

1. **Ranked list rendering:** call
   `getTierOneRanked(state.couchMemberIds)` →
   `getTierTwoRanked(state.couchMemberIds)` →
   `getTierThreeRanked(state.couchMemberIds)` (in that visual order;
   T3 hidden behind expand toggle).
2. **T3 expand toggle existence:** the affordance to reveal T3 must
   itself be gated by `resolveT3Visibility()` returning `true`. When
   any of account/family/group preferences explicitly sets `showT3:
   false`, the expand toggle should not render at all (not just be
   collapsed by default — fully absent so the user can't even discover
   the hidden pile via UI inspection). This is the privacy-leaning
   "watching her movie without her" semantics from D-02.

`state.couchMemberIds` is populated by 14-04's cushion-claim writer.
Until 14-04 ships, callers should use `getCouchOrSelfIds()` (from
14-01) which falls back to `[state.me.id]` — single-member discovery
mode produces a degenerate but correct T1 (titles I personally queue),
empty T2 (no other couch member to be missing), and T3 (titles others
queue without me).

## Threat-model status

Per plan §threat_model:
- **T-14.03-01 (Information Disclosure — T3 leak):** mitigation
  primitive shipped (`resolveT3Visibility`); enforcement is the
  consumer's responsibility — 14-07 acceptance criterion must verify
  the picker UI checks the resolver before rendering the expand
  affordance.
- **T-14.03-02 (Tampering — bad queue ranks):** accepted; `parseFloat`
  on `t.rating` already handles legacy string values; non-numeric
  ranks would NaN the sort but not corrupt security.

No new threat surface introduced. Pure data-layer reads against
in-memory `state.titles` / `state.me` / `state.family` / `state.group`.

## Self-Check: PASSED

Verified post-write:
- File exists at `js/app.js` and contains all 4 new functions exactly once each (greps returned 1/1/1/1).
- `node --check js/app.js` exits 0.
- Commit `ccf600f` exists in git log (`feat(14-03): add D-02 tier aggregators (T1/T2/T3 + T3 visibility resolver)`).
- No file deletions in the commit (`git diff --diff-filter=D HEAD~1 HEAD` returned empty).
- Single-file scope respected (only `js/app.js` modified).
