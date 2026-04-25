---
phase: 14-decision-ritual-core
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - js/app.js
  - firestore.rules
autonomous: true
requirements_addressed: [DECI-14-01]
must_haves:
  truths:
    - "isWatchedByCouch(t, couchMemberIds) returns TRUE iff ANY couch member has the title flagged via any of the 4 sources (Trakt-flipped t.watched, voted Yes, voted No, manually marked) AND no member has a same-day rewatch override."
    - "Per-title rewatch override: writing t.rewatchAllowedBy[memberId] = Date.now() bypasses the filter for that title for the next 24h."
    - "Filter is applied to MY discovery surfaces (Browse / Spin / Swipe candidate pools); NOT applied to push fan-out paths in queuenight/functions/index.js (invitation bypass — D-01)."
    - "Firestore rules accept the new t.rewatchAllowedBy map shape on title doc updates (no permission-denied)."
  artifacts:
    - path: "js/app.js"
      provides: "isWatchedByCouch helper + setRewatchAllowed writer + filter integration in discovery render paths"
      contains: "function isWatchedByCouch("
      min_lines_added: 60
    - path: "firestore.rules"
      provides: "rewatchAllowedBy map permitted on title updates"
      contains: "rewatchAllowedBy"
  key_links:
    - from: "discovery render paths in js/app.js (Browse / Spin / Swipe filter callsites)"
      to: "isWatchedByCouch(t, state.couchMemberIds || [state.me.id])"
      via: "Array.prototype.filter predicate"
      pattern: "isWatchedByCouch\\("
    - from: "Cushion-claim writer in 14-04 (couch viz) — future plan"
      to: "state.couchMemberIds (provided by 14-04 once couch is claimed)"
      via: "shared state"
      pattern: "state\\.couchMemberIds"
---

<objective>
Implement Phase 14's strict, member-aware "already-watched" filter per D-01 with a per-title rewatch override and an invitation bypass. This is the foundation that the tiered candidate filter (14-03) and Flow A picker (14-07) consume to compute the ranked list of un-watched titles for the active couch.

Purpose: D-01 is the single helper that the entire decision ritual relies on to decide what's a candidate. Phase 14's whole "couch-centered" UX falls apart if the filter leaks already-watched titles into discovery (annoying) or if it accidentally hides invitation pushes from family members (rude). Both failure modes must be prevented by the filter shape itself, not by per-callsite discipline.

Output: New `isWatchedByCouch(t, couchMemberIds)` helper and `setRewatchAllowed(titleId, memberId)` writer in js/app.js, integration into the existing discovery render paths, firestore.rules tolerance for the new map, and a small test harness to prove the 4 sources OR'd correctly.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 1 (foundations). No upstream dependencies. This plan unblocks 14-03 (tiered candidate filter consumes isWatchedByCouch) and 14-07 (Flow A picker consumes the tier-1 ranked list).

**Two-repo discipline:** Couch-side files only — uses repo-relative paths.
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md

<interfaces>
<!-- Existing analogs the executor MUST read before writing the new helper. Don't re-derive from scratch. -->

**Existing per-member queue read pattern** (`js/app.js:6827-6832`):
```js
function getMyQueueTitles() {
  if (!state.me) return [];
  return state.titles
    .filter(t => !t.watched && t.queues && t.queues[state.me.id] != null)
    .sort((a,b) => a.queues[state.me.id] - b.queues[state.me.id]);
}
```

**Existing per-member-keyed map shape on title docs** — `t.queues = { [memberId]: rank }` (per js/app.js:12340-12350). The new `t.rewatchAllowedBy = { [memberId]: timestamp }` mirrors this exact shape.

**Trakt sync writes** at js/app.js:752-755 set `t.watched = true` directly on the title doc when a movie is marked watched in Trakt. Source 1 of D-01 is satisfied automatically by reading `t.watched`.

**Vote state** lives at `t.votes = { [memberId]: 'yes' | 'no' | 'maybe' | null }` (per the vote-chip render at js/app.js:4423-4428). Sources 2 + 3 of D-01 read `votes[mid] === 'yes' || votes[mid] === 'no'`.

**Manually marked-watched** (Source 4) is the same `t.watched` global flag flipped by the action sheet "Mark watched" item at approximately js/app.js:11891. No separate per-member field; it merges into Source 1.

**Existing firestore.rules attribution helper** — `attributedWrite(familyCode)` is required on every write that touches a title doc; the new `setRewatchAllowed` writer must spread `writeAttribution()` into the payload per S1 in 14-PATTERNS.md.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add isWatchedByCouch helper + setRewatchAllowed writer to js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 6820-6880 (analog: existing getMyQueueTitles + getGroupNext3)
    - js/app.js lines 12325-12390 (analog: applyVote — pattern for per-member-keyed map writes on title docs)
    - js/app.js lines 740-770 (analog: trakt.ingestSyncData watched-flip site — confirms Source 1 lives at t.watched, not t.watchedBy[mid])
    - js/app.js lines 4400-4470 (analog: vote-chip render — confirms vote enum 'yes'|'no'|'maybe' on t.votes[mid])
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §1 (concrete code excerpt for isWatchedByCouch — copy verbatim)
  </read_first>
  <action>
1. Locate `getMyQueueTitles` near js/app.js:6827 (use `Grep` for `function getMyQueueTitles` then `Read(file, offset=6820, limit=20)`).

2. Insert the new helpers IMMEDIATELY AFTER `getMyQueueTitles` (and BEFORE `getGroupNext3`) — copy this verbatim from PATTERNS.md §1, preserving every comment:

```js
// D-01 (DECI-14-01) — strict member-aware "already-watched" filter for couch discovery surfaces.
// Returns true iff ANY couch member has the title flagged via ANY of 4 sources:
//   1) Trakt sync flipped t.watched = true (global on title doc; see trakt.ingestSyncData ~js/app.js:752)
//   2) member voted Yes prior — t.votes[memberId] === 'yes'
//   3) member voted No prior — t.votes[memberId] === 'no'
//   4) member manually marked watched — same t.watched global flag (Source 1 + 4 collapsed)
// Per-title rewatch override: same-day t.rewatchAllowedBy[memberId] timestamp opts the title back in.
// Per D-01 invitation bypass: this filter is applied to MY discovery surfaces ONLY (Browse/Spin/Swipe).
// CFs (push fan-out) MUST NOT call this — pushes go through regardless of watched status.
function isWatchedByCouch(t, couchMemberIds) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return false;
  // Rewatch override — same-day timestamp on any couch member opts the title back in.
  const dayMs = 24 * 60 * 60 * 1000;
  const recently = (ts) => ts && (Date.now() - ts) < dayMs;
  const allow = t.rewatchAllowedBy || {};
  if (couchMemberIds.some(mid => recently(allow[mid]))) return false;
  // Source 1 + 4 — global watched flag covers Trakt sync AND manual mark-watched.
  if (t.watched) return true;
  // Sources 2 + 3 — any couch member's prior vote (yes OR no) counts as "watched-status known".
  // Per D-01 literal read: voting No on a title still hides it from rediscovery (intentional opinionation).
  const votes = t.votes || {};
  return couchMemberIds.some(mid => votes[mid] === 'yes' || votes[mid] === 'no');
}

// D-01 — Per-title rewatch override writer. Stamps t.rewatchAllowedBy[memberId] = now.
// Triggered by the "Rewatch this one" action sheet item (added in 14-04 or 14-05).
async function setRewatchAllowed(titleId, memberId) {
  if (!titleId || !memberId || !state.familyCode) return;
  try {
    const ref = doc(titlesRef(), titleId);
    await updateDoc(ref, {
      [`rewatchAllowedBy.${memberId}`]: Date.now(),
      ...writeAttribution()
    });
    flashToast('Rewatch enabled for tonight', { kind: 'info' });
  } catch (e) {
    console.error('[rewatch] write failed', e);
    flashToast('Could not enable rewatch — try again', { kind: 'warn' });
  }
}
window.setRewatchAllowed = setRewatchAllowed;
```

3. Verify imports at the top of js/app.js cover `doc`, `updateDoc`, `titlesRef`, `writeAttribution`, `flashToast`. If any are missing in the existing import surface, add to the existing import statement (don't create a new one). Do NOT introduce a build step.

4. Add a one-line comment marker `// === D-01 helpers — DECI-14-01 ===` immediately above the inserted block so future grep finds it.

5. **Discovery filter integration audit** — grep for the call sites that render Browse, Spin, Swipe candidate pools. Likely targets (not exhaustive — verify each):
   - `renderTonight` (search `function renderTonight` in js/app.js — Tonight tab spin candidate pool)
   - `renderLibrary` near js/app.js:4488 (Library tab title list)
   - any spin/swipe candidate selector — search for `state.titles.filter` to enumerate

   For each render path that produces a candidate pool for the LOCAL user's discovery (NOT for push payloads, NOT for global title list reads), wrap the existing filter with `isWatchedByCouch`. Example pattern:

```js
// BEFORE (analog, e.g. existing Spin candidate filter):
const candidates = state.titles.filter(t => !t.watched && /* mood/veto/etc filters */);

// AFTER:
const couch = (state.couchMemberIds && state.couchMemberIds.length)
  ? state.couchMemberIds
  : (state.me ? [state.me.id] : []);
const candidates = state.titles.filter(t =>
  !isWatchedByCouch(t, couch) && /* mood/veto/etc filters preserved verbatim */
);
```

Note `state.couchMemberIds` is populated by 14-04 (couch viz). If it's empty (no couch claimed yet), default to `[state.me.id]` — matches D-01 single-member discovery behavior.

   **Anti-pattern guard:** do NOT touch any code path inside `queuenight/functions/index.js` — invitation bypass per D-01 means push fan-out NEVER consults this filter. Confirm the filter is applied only on the client-side discovery render paths.

6. Add a small `state.couchMemberIds = []` initializer in js/state.js (read first; if it already exists, skip). The 14-04 plan owns the writer; this plan just declares the slot.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "function isWatchedByCouch(" js/app.js</automated>
    Expect: `node --check` passes (no syntax errors); grep returns `1` (helper defined exactly once).
  </verify>
  <done>
    - js/app.js contains `function isWatchedByCouch(` exactly once.
    - js/app.js contains `function setRewatchAllowed(` AND `window.setRewatchAllowed = setRewatchAllowed;` exactly once each.
    - js/app.js contains `state.couchMemberIds` referenced at ≥1 discovery filter call site.
    - All 4 sources are checked in the helper body (verifiable: grep `t.watched`, `votes[mid] === 'yes'`, `votes[mid] === 'no'`, `t.rewatchAllowedBy` all present in the `isWatchedByCouch` function body).
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto">
  <name>Task 2: Widen firestore.rules to permit t.rewatchAllowedBy on title updates</name>
  <files>firestore.rules</files>
  <read_first>
    - firestore.rules full file (read in chunks if needed; line 315-365 is intents block, but title-doc rules are elsewhere — grep for `match /titles/{titleId}` first)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md S1 (writeAttribution requirement)
  </read_first>
  <action>
1. Grep firestore.rules for `match /titles/{titleId}` to locate the existing title-doc rule block. Read the surrounding context (the create + update rules + their `affectedKeys()` constraints).

2. Determine whether title updates are currently rule-restricted to a specific affectedKeys allowlist or a broader catch-all. Two cases:

   **Case A — Existing title-doc update rule uses a `hasOnly([...])` allowlist:** add `'rewatchAllowedBy'` to the existing list AND add a value-shape check that the new field is a map with timestamp values. Example diff shape:

```javascript
// BEFORE (analog — actual list will differ):
allow update: if attributedWrite(familyCode)
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['queues','votes','watched','watchedAt','progress','ratings','reviews', /* etc */, 'actingUid','managedMemberId','memberId','memberName']);

// AFTER:
allow update: if attributedWrite(familyCode)
  && request.resource.data.diff(resource.data).affectedKeys()
       .hasOnly(['queues','votes','watched','watchedAt','progress','ratings','reviews', /* etc preserved verbatim */, 'rewatchAllowedBy','actingUid','managedMemberId','memberId','memberName']);
```

   **Case B — Existing title-doc update rule is permissive (no hasOnly):** no change needed. Document this in a `// D-01: rewatchAllowedBy permitted by existing permissive update rule` comment above the rule block so the next reader doesn't get confused about why this plan didn't touch the file.

3. Run the existing firestore-rules unit tests (`npm test --prefix tests` or equivalent — check tests/rules.test.js for the actual command). If the test suite has a "title write succeeds with allowed keys" test, add a sibling case proving that a write of `rewatchAllowedBy.{mid}: ts + writeAttribution()` succeeds. If no such test exists, this step is a no-op (do NOT scaffold a whole rules test suite in this plan — out of scope).

4. Verify `node --check` does not apply to .rules files — instead use the Firebase emulator dry-run if available (`firebase emulators:exec --only firestore "echo ok"` succeeds = rules parse). If Firebase CLI not available, defer dry-run to deploy time and document in the SUMMARY.
  </action>
  <verify>
    <automated>grep -c "rewatchAllowedBy" firestore.rules</automated>
    Expect: ≥1 (Case A: allowlist mention; Case B: comment marker mention).
  </verify>
  <done>
    - firestore.rules either explicitly permits `rewatchAllowedBy` in the title-doc update affectedKeys allowlist, OR carries a comment documenting that the existing permissive rule already covers it.
    - If tests/rules.test.js exists and has title-write tests, a new test case covers the rewatchAllowedBy write path.
    - The file parses (no Firebase emulator CLI errors if available; otherwise defer to deploy-time validation).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → Firestore | Untrusted member writes flow through firestore.rules; the new rewatchAllowedBy map widens the title-doc update surface |
| client discovery render → user view | Filter must NEVER mask an invitation push path (D-01 invitation bypass) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.01-01 | Tampering | rewatchAllowedBy map writes | mitigate | Rule allowlist gates affectedKeys; writeAttribution() spread enforces actor identity per existing attributedWrite() helper |
| T-14.01-02 | Information Disclosure | Filter accidentally applied to push fan-out (would silently swallow invitations) | mitigate | Helper is client-side-only; queuenight/functions/index.js NEVER imports it. Acceptance criteria explicitly verify this. Code comment at the helper definition states "CFs MUST NOT call this." |
| T-14.01-03 | Denial of Service | Rewatch override map grows unbounded over time | accept | Map keyed by memberId (max ~10/family); each entry is a single timestamp; total bytes <1KB even at extreme membership |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "function isWatchedByCouch(" js/app.js` → 1.
- `grep -c "function setRewatchAllowed(" js/app.js` → 1.
- `grep -c "state.couchMemberIds" js/app.js` → ≥2 (initializer + ≥1 discovery filter callsite).
- `grep -c "rewatchAllowedBy" firestore.rules` → ≥1.
- Spot-check: NO occurrences of `isWatchedByCouch` in queuenight/functions/index.js (invitation bypass invariant).
</verification>

<success_criteria>
1. `isWatchedByCouch(t, couchMemberIds)` exists in js/app.js and OR's the 4 sources correctly with rewatch override bypass.
2. `setRewatchAllowed(titleId, memberId)` writes the override map with proper attribution and surfaces a flashToast.
3. At least one discovery render path in js/app.js consumes `isWatchedByCouch` to filter candidates.
4. firestore.rules permits the new `rewatchAllowedBy` field on title updates (either via allowlist extension OR documented permissive coverage).
5. Invitation bypass invariant holds: zero references to `isWatchedByCouch` in queuenight/functions/index.js.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-01-SUMMARY.md` documenting:
- Which discovery render paths were wrapped (file:line list).
- Which firestore.rules case applied (A or B) and what was changed.
- Any rule-test additions.
- Open follow-ups for downstream plans (notably 14-04's writer for state.couchMemberIds).
</output>
