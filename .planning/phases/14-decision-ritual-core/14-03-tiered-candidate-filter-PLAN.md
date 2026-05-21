---
phase: 14-decision-ritual-core
plan: 03
type: execute
wave: 2
depends_on: [14-01, 14-02]
files_modified:
  - js/app.js
autonomous: true
requirements_addressed: [DECI-14-02]
must_haves:
  truths:
    - "getTierOneRanked(couchMemberIds) returns titles where EVERY couch member has the title in their queues map (intersection, not union); excludes titles where isWatchedByCouch returns true; sorted ascending by mean of member-queue ranks; ties broken descending by t.rating."
    - "getTierTwoRanked(couchMemberIds) returns titles where ≥1 couch member queues it AND NOT every couch member queues it (i.e. T2 is the strict complement of T1 within 'has any couch-member queue presence')."
    - "getTierThreeRanked(couchMemberIds) returns titles where ONLY off-couch members queue it (zero couch-member queue overlap, ≥1 off-couch queue overlap)."
    - "resolveT3Visibility() implements most-restrictive-wins across 3 levels: account-level (state.me.preferences?.showT3) + family-level (state.family?.preferences?.showT3) + group-level (state.group?.preferences?.showT3). ANY level set to false (hide) wins; true (show) only takes effect when no level says false."
    - "All 3 tier aggregators use isWatchedByCouch(t, couchMemberIds) from 14-01 to exclude already-watched titles before returning."
  artifacts:
    - path: "js/app.js"
      provides: "getTierOneRanked + getTierTwoRanked + getTierThreeRanked + resolveT3Visibility helpers, co-located with getGroupNext3"
      contains: "function getTierOneRanked("
      min_lines_added: 80
  key_links:
    - from: "Flow A picker UI in 14-07 (downstream consumer)"
      to: "getTierOneRanked(state.couchMemberIds), getTierTwoRanked(...), getTierThreeRanked(...)"
      via: "direct function call"
      pattern: "getTierOneRanked\\("
    - from: "T3 expand toggle in 14-07 (downstream)"
      to: "resolveT3Visibility()"
      via: "boolean read at render time"
      pattern: "resolveT3Visibility\\("
---

<objective>
Build the 3-tier candidate filter aggregators per D-02. Tier 1 = titles every couch member queues (intersection), sorted by mean queue rank, ties by rating. Tier 2 = titles ≥1 couch member queues but not all. Tier 3 = titles only off-couch members queue. T3 default visibility resolved by most-restrictive-wins across account/family/group preferences.

Purpose: 14-07 (Flow A picker) is the primary consumer — when the picker selects from the ranked list, the order MUST be T1 (every-member queue, mean rank) → T2 (some-member queue) → T3 hidden behind expand. Without this plan, the picker has no candidate ranking. Also: T3 privacy hierarchy ("watching her movie without her") encodes a real social dynamic — most-restrictive-wins matches Phase 13 compliance posture.

Output: Three pure aggregator functions + one boolean resolver, co-located with the existing getGroupNext3 near js/app.js:6852. Each aggregator is small (≤25 lines) and unit-testable in isolation. No UI rendered in this plan — UI consumers come in 14-07.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 2 (depends on Wave 1 helpers). Hard depends on:
- 14-01 for `isWatchedByCouch(t, couchMemberIds)` — every aggregator excludes already-watched titles before tier-classifying.
- 14-02 for confidence that queue ranks are correctly populated (Add-tab insertion verified, Yes-vote auto-add discoverable).

**Two-repo discipline:** Couch-side only — repo-relative paths.

**This plan ships ZERO UI** — pure data layer. UI comes in 14-07. This separation lets 14-07 ship multiple UI iterations against a stable data API without redoing the math.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md

<interfaces>
**Existing analog — getGroupNext3** at js/app.js:6852-6878. Sums 1/rank across ALL queueing members (no intersection requirement, no tier classification):
```js
function getGroupNext3() {
  const scores = new Map();
  const queuedBy = new Map();
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    let total = 0;
    const members = [];
    Object.entries(t.queues).forEach(([mid, rank]) => {
      const m = state.members.find(x => x.id === mid);
      if (!m) return;
      total += 1 / rank;
      members.push(m.name);
    });
    if (total > 0) { scores.set(t.id, total); queuedBy.set(t.id, members); }
  });
  const ranked = Array.from(scores.entries())
    .sort((a,b) => b[1] - a[1])
    .slice(0,5)
    .map(([id, score]) => ({ title: state.titles.find(t => t.id === id), score, queuedBy: queuedBy.get(id) }));
  return ranked;
}
```

**Existing isWatchedByCouch** at js/app.js (added in 14-01) — call signature `isWatchedByCouch(t, couchMemberIds)` returns boolean.

**Title-doc rating field** — `t.rating` (numeric, TMDB-derived; may be string in some legacy docs — `parseFloat(t.rating) || 0` handles both safely).

**Preference object shape** — D-02 requires checking 3 levels. Existing patterns:
- `state.me?.preferences?.*` (account-level — likely a member-doc nested map)
- `state.family?.preferences?.*` (family-level — likely on the family doc)
- `state.group?.preferences?.*` (group-level — likely on the group doc; group is a member-of-family with sub-profile semantics per Phase 5)

The actual paths may vary; the resolveT3Visibility helper greps for these reads at write time and adapts to the real shape. If any preference key doesn't exist yet (no UI to set it), it reads as `undefined` which falls through correctly to the most-restrictive-wins default of `true` (show). The semantics: explicit `false` at ANY level wins; `undefined` everywhere → default-show.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Add getTierOneRanked + getTierTwoRanked + getTierThreeRanked aggregators to js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 6820-6890 (analog: getMyQueueTitles + getGroupNext3 — same code region the new aggregators slot into)
    - js/app.js (after 14-01) for the isWatchedByCouch helper signature
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §2 (concrete code excerpt for getTierOneRanked — copy verbatim)
  </read_first>
  <behavior>
    - Test 1: getTierOneRanked([]) returns [] (empty couch).
    - Test 2: getTierOneRanked([m1, m2]) where title T has queues {m1: 3, m2: 1} → returns [{title: T, meanRank: 2, ratingTie: t.rating}]; sort ascending by meanRank.
    - Test 3: getTierOneRanked([m1, m2]) where title T has queues {m1: 1} only (m2 missing) → T excluded (intersection requirement).
    - Test 4: getTierOneRanked respects isWatchedByCouch — title flagged watched is excluded.
    - Test 5: Tie-break — two titles both with meanRank=2.0; the one with higher t.rating sorts first (descending tie-break).
    - Test 6: getTierTwoRanked returns titles where ≥1 couch member queues AND NOT all couch members queue (strict T1 complement within "any couch queue presence").
    - Test 7: getTierThreeRanked returns titles where zero couch members queue AND ≥1 off-couch member queues.
    - Test 8: All three tiers are disjoint — no title appears in multiple tiers simultaneously.
  </behavior>
  <action>
1. Locate `getGroupNext3` at js/app.js:6852 (Grep + Read with offset/limit per CLAUDE.md token rules).

2. Insert the new tier aggregators IMMEDIATELY after `getGroupNext3`. Copy this verbatim from PATTERNS.md §2 + extensions:

```js
// D-02 (DECI-14-02) — Tier 1: titles where EVERY couch member has the title in their queue.
// Sort: ascending mean of member-queue ranks; tie-break descending t.rating.
// Excludes titles where isWatchedByCouch returns true (consumes 14-01 helper).
function getTierOneRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    // Intersection requirement: ALL couch members must have a rank for this title.
    const ranks = couchMemberIds.map(mid => t.queues[mid]);
    if (ranks.some(r => r == null)) return;
    const meanRank = ranks.reduce((a,b) => a + b, 0) / ranks.length;
    out.push({ title: t, meanRank, ratingTie: parseFloat(t.rating) || 0 });
  });
  out.sort((a,b) => (a.meanRank - b.meanRank) || (b.ratingTie - a.ratingTie));
  return out;
}

// D-02 — Tier 2: titles where ≥1 couch member queues it BUT NOT every couch member.
// Strict complement of T1 within the "any couch presence" set. Sort: descending count of couch
// members queueing it (more couch interest first), then ascending mean of present members' ranks,
// then descending rating.
function getTierTwoRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    const presentRanks = couchMemberIds
      .map(mid => t.queues[mid])
      .filter(r => r != null);
    // Must have ≥1 couch presence AND NOT all (else it's T1).
    if (presentRanks.length === 0) return;
    if (presentRanks.length === couchMemberIds.length) return;
    const meanPresentRank = presentRanks.reduce((a,b) => a + b, 0) / presentRanks.length;
    out.push({
      title: t,
      couchPresenceCount: presentRanks.length,
      meanPresentRank,
      ratingTie: parseFloat(t.rating) || 0
    });
  });
  out.sort((a,b) =>
    (b.couchPresenceCount - a.couchPresenceCount) ||
    (a.meanPresentRank - b.meanPresentRank) ||
    (b.ratingTie - a.ratingTie)
  );
  return out;
}

// D-02 — Tier 3: titles where ZERO couch members queue it BUT ≥1 off-couch member does.
// "Watching her movie without her." Hidden behind expand by default; visibility resolved by
// resolveT3Visibility() (account/family/group most-restrictive-wins).
function getTierThreeRanked(couchMemberIds) {
  if (!Array.isArray(couchMemberIds) || !couchMemberIds.length) return [];
  const couchSet = new Set(couchMemberIds);
  const out = [];
  state.titles.forEach(t => {
    if (t.watched) return;
    if (!t.queues) return;
    if (isWatchedByCouch(t, couchMemberIds)) return;
    const queueingMids = Object.keys(t.queues);
    if (!queueingMids.length) return;
    // Zero couch overlap, ≥1 off-couch presence.
    const offCouchPresent = queueingMids.filter(mid => !couchSet.has(mid));
    const couchPresent = queueingMids.filter(mid => couchSet.has(mid));
    if (couchPresent.length > 0) return;
    if (offCouchPresent.length === 0) return;
    const meanOffCouchRank = offCouchPresent
      .map(mid => t.queues[mid])
      .reduce((a,b) => a + b, 0) / offCouchPresent.length;
    out.push({
      title: t,
      offCouchMemberIds: offCouchPresent,
      meanOffCouchRank,
      ratingTie: parseFloat(t.rating) || 0
    });
  });
  out.sort((a,b) => (a.meanOffCouchRank - b.meanOffCouchRank) || (b.ratingTie - a.ratingTie));
  return out;
}

// D-02 — T3 visibility resolver: most-restrictive-wins across 3 levels.
// account-level: state.me.preferences?.showT3
// family-level:  state.family?.preferences?.showT3
// group-level:   state.group?.preferences?.showT3
// Semantics: ANY level === false → hide; true at all checked levels OR undefined → show.
// Default (no preferences set anywhere): SHOW (T3 expand toggle reveals; this resolver only
// gates the EXISTENCE of the expand toggle UI on an explicit hide).
function resolveT3Visibility() {
  const accountPref = state.me && state.me.preferences ? state.me.preferences.showT3 : undefined;
  const familyPref  = state.family && state.family.preferences ? state.family.preferences.showT3 : undefined;
  const groupPref   = state.group && state.group.preferences ? state.group.preferences.showT3 : undefined;
  // Most-restrictive-wins: any explicit false hides T3.
  if (accountPref === false || familyPref === false || groupPref === false) return false;
  return true;
}
```

3. Verify these helpers are NOT exported via `window.*` — they're called from inline render JS in 14-07's UI plan, but the inline-script call sites can read top-level functions without window-prefixing (matches the pattern used for getMyQueueTitles and getGroupNext3 — neither is window-scoped).

4. Add a comment header line `// === D-02 tier aggregators — DECI-14-02 ===` immediately above getTierOneRanked for grep traceability.

5. Do NOT modify getGroupNext3 — it serves a different purpose (Tonight tab "next 3" surfacing) and stays as-is.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -cE "function (getTierOneRanked|getTierTwoRanked|getTierThreeRanked|resolveT3Visibility)\\(" js/app.js</automated>
    Expect: `node --check` exits 0; grep returns `4`.
  </verify>
  <done>
    - js/app.js contains all 4 new functions exactly once each.
    - getTierOneRanked enforces intersection (every couch member must queue).
    - getTierTwoRanked enforces strict complement (≥1 couch presence AND NOT all couch).
    - getTierThreeRanked enforces zero-couch-overlap + ≥1-off-couch.
    - resolveT3Visibility implements explicit-false-wins logic.
    - All 3 aggregators call isWatchedByCouch(t, couchMemberIds).
    - `node --check js/app.js` exits 0.
    - Behavior tests above can be derived by manual code-trace (no formal test harness in this plan; defer to /gsd-verify-work for end-to-end).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Pure data layer (no Firestore writes, no DOM mutation) | This plan is read-only computation against state — no boundary crossed |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.03-01 | Information Disclosure | T3 leaks "watching her movie without her" titles to a couch that explicitly hid T3 | mitigate | resolveT3Visibility() most-restrictive-wins; UI consumer in 14-07 must check this resolver before rendering the expand toggle (acceptance criterion in 14-07) |
| T-14.03-02 | Tampering | A malicious queues map shape (e.g. negative ranks) corrupts mean calculations | accept | parseFloat / numeric-coercion handles non-numeric values gracefully; bad data only affects display ordering, not security |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "function getTierOneRanked(" js/app.js` → 1.
- `grep -c "function getTierTwoRanked(" js/app.js` → 1.
- `grep -c "function getTierThreeRanked(" js/app.js` → 1.
- `grep -c "function resolveT3Visibility(" js/app.js` → 1.
- `grep -c "isWatchedByCouch(t, couchMemberIds)" js/app.js` → ≥3 (each tier aggregator calls it).
</verification>

<success_criteria>
1. Four new pure functions exist in js/app.js and are call-discoverable from inline render JS in 14-07.
2. Tier classifications are disjoint — no title falls into more than one tier for a given couchMemberIds set.
3. T3 visibility resolver implements most-restrictive-wins as specified by D-02 (privacy-leaning posture).
4. All aggregators consume isWatchedByCouch from 14-01 — already-watched titles never leak into any tier.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-03-SUMMARY.md` documenting:
- Exact insertion line for the 4 new functions.
- Behavior verification trace (which test cases the implementation satisfies by inspection).
- Confirmation that getGroupNext3 was NOT modified.
- Note for 14-07 executor: T3 expand toggle UI must read resolveT3Visibility() to decide whether to render the expand affordance.
</output>
