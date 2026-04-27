---
created: 2026-04-27T11:46:11.351Z
title: Phase 15 security hardening pass
area: planning
files:
  - js/app.js:8407 (writeMemberProgress — pre-existing scope gap)
  - js/app.js:951-994 (cv15 trakt overlap detector — trusts forgeable progress.source)
  - firestore.rules:181-200 (5th UPDATE branch — needs nested-key participant check)
  - firestore.rules:357-432 (title-doc UPDATE branches — actingTupleKey regex injection)
  - firestore.rules:validAttribution (needs memberId == auth.uid check)
  - tests/rules.test.js (add #33-#35 for coWatchPromptDeclined + memberId injection deny paths)
  - .planning/phases/15-tracking-layer/15-SECURITY.md (audit findings)
  - .planning/phases/15-tracking-layer/15-REVIEW.md (WR-02 evidence)
---

## Problem

Phase 15 holistic review (2026-04-27) surfaced 4 security findings — 2 HIGH, 2 MEDIUM — that need a dedicated hardening pass to fix correctly. Inline patching during Phase 15 close-out wasn't appropriate because the fixes touch multiple call sites + need new test coverage. The first three are stand-alone exploit paths; the fourth is the test gap that compounds them.

**F-OPEN-01 (HIGH) — `t.progress[X].source` forgeable, Trakt overlap detector trusts it.**
`writeMemberProgress` at `js/app.js:8407` writes the entire `progress` map under `attributedWrite()`. Phase 15 rules added per-member isolation only for `tupleProgress` / `mutedShows` / `liveReleaseFiredFor` — `progress` falls under the permissive baseline. Any authed family member can write `t.progress.<other_id> = {source:'trakt', lastWatchedAt:Date.now(), season:..., episode:...}`. The new `trakt.detectAndPromptCoWatchOverlap` (`js/app.js:951-994`) trusts `progressMap[otherId].source === 'trakt'` as authentic origin and queues a co-watch prompt. Victim taps Yes → `writeTupleProgress` rule passes (victim's id IS in tupleKey) → phantom co-watched tuple persisted. Pollutes S1/S2/S6 surfaces and the live-release subscriber set. **Pre-existing scope gap; Phase 15 amplifies impact** by treating `source` as a trust signal in a new UX flow.

**WR-02 (HIGH) — actingTupleKey regex-injection bypass.**
`firestore.rules:397-404` — the HIGH-1 mitigation builds a runtime regex from `request.resource.data.memberId`, but `validAttribution()` validates only `actingUid`, NOT that `memberId` corresponds to `auth.uid`. An authenticated family member can pass `memberId: '.*'` (or other RE2 meta-chars) and bypass per-tuple isolation, fabricating progress for tuples they're not part of. Same trust pattern in the mutedShows `hasOnly([memberId])` check allows silencing other members' notifications via forged `memberId`.

**F-OPEN-02 (MEDIUM) — `tupleNames` not write-scoped to tuple participants.**
The 5th UPDATE branch `firestore.rules:181-200` allowlists `tupleNames` writes but does NOT peek into nested `tupleNames.<tupleKey>` keys. `setTupleName` (`js/app.js:8517`) does no participant check. Any family member can write `tupleNames.m_alice,m_bob = {name:"<inappropriate>"}` and Alice+Bob will see it on their tuple in the S2 detail-modal section + S1 Tonight widget. `escapeHtml` + 40-char cap mean no XSS / no payload-overflow — purely a content-trust / griefing vector. The `setBy` field records the truth but isn't surfaced in UI.

**WR-03 (MEDIUM) — No rules-test coverage for `coWatchPromptDeclined` path.**
`tests/rules.test.js` Phase 15 tests #23-#32 cover tupleNames + title-doc isolation but NOT the decline-persistence path. Combined with the source/queuenight rules-file drift that was just fixed in 15.0.1 (WR-01), the cross-session decline UX was unvalidated end-to-end. Adding tests now hardens against future regression.

## Solution

Create `Phase 15.1 — Security Hardening` (or fold into a broader Phase 5 hardening if scoped wider). Use `/gsd-plan-phase 15.1` (or `/gsd-discuss-phase 15.1` first if scope decisions needed).

**Plan outline:**

1. **Per-member isolation on `t.progress` map** (F-OPEN-01 fix):
   - Mirror the `mutedShows` rule pattern: `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['progress.<actingMemberId>'])` — restrict each writer to their own progress slot
   - Convert `writeMemberProgress` (and Trakt sync writers) to dotted-path writes: `progress.${meId}` not `progress` map replacement
   - Touches: manual rate flow, post-watchparty progress, Trakt sync ingest

2. **Anchor `memberId` regex + cross-validate against auth** (WR-02 fix):
   - Add `request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')` precondition before any rule branch consumes `memberId`
   - In `validAttribution()`, add: `request.resource.data.memberId == request.auth.uid OR request.resource.data.memberId == managedMemberId(request.auth.uid)`

3. **Nested-key participant check on tupleNames** (F-OPEN-02 fix):
   - Either: extend the 5th UPDATE branch to peek inside `tupleNames.<tk>` and verify `actingMemberId in tk.split(',')` (rule-side enforcement)
   - OR: cheap interim — hide pencil glyph in `renderCv15TupleProgressSection` when `state.me.id ∉ tk.split(',')` (~10 lines client-only, closes casual griefing)
   - Recommend BOTH: client hide for UX, rule enforcement for actual security

4. **Add rules tests #33-#35** (WR-03 fix):
   - #33: authed member writes own coWatchPromptDeclined tuple → ALLOWED
   - #34: authed member writes coWatchPromptDeclined for tuple they're NOT in → DENIED (depends on whether F-OPEN-02 fix lands; if not, this test should fail and surface the gap)
   - #35: forged memberId regex injection (`memberId: '.*'`) writing tupleProgress → DENIED
   - Plus regression tests for any rule branches changed by 1-3 above

5. **Surface `setBy` in tuple rename UI** (defense-in-depth for F-OPEN-02):
   - Show "Renamed by {memberName}" subtle attribution beside the tuple name on hover/tap
   - Turns silent vandalism into attributable action

**Reference docs:**
- `.planning/phases/15-tracking-layer/15-SECURITY.md` — full audit with 11 findings (9 closed, 2 open)
- `.planning/phases/15-tracking-layer/15-REVIEW.md` — code review with WR-01..WR-04
- `.planning/phases/15-tracking-layer/15-VERIFICATION.md` — what's known good
- BRAND.md "Phase numbering + scope safeguards" — check seeds/ before claiming phase 15.1 slot

**Estimated effort:** Medium plan (~3-5 plans). Heavy on rules + tests; light on UI changes (just the pencil-hide + setBy surfacing).

**Priority:** HIGH — F-OPEN-01 is exploitable today and Phase 15's Trakt overlap detector turned a passive trust gap into an active UX vector. Should ship before the v33.3 milestone closes.
