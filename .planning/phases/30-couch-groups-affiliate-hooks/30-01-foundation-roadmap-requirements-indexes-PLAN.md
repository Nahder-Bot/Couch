---
plan: 01
phase: 30
wave: 0
depends_on: []
files_modified:
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
  - C:/Users/nahde/queuenight/firestore.indexes.json
  - scripts/smoke-couch-groups.cjs
  - tests/rules.test.js
  - package.json
requirements: [GROUP-30-01, GROUP-30-02, GROUP-30-03, GROUP-30-04, GROUP-30-05, GROUP-30-06, GROUP-30-07, GROUP-30-08]
autonomous: true
risk: low
status: ready
gap_closure: false
must_haves:
  truths:
    - "ROADMAP.md Phase 30 entry reflects groups-only scope (affiliate paragraph removed; pointer to future Phase 30.1)"
    - "REQUIREMENTS.md has all 8 GROUP-30-* IDs registered in the Traceability table"
    - "firestore.indexes.json declares the watchparties memberUids array-contains COLLECTION_GROUP composite index"
    - "scripts/smoke-couch-groups.cjs scaffold exists, runs end-to-end, prints pass/fail summary, exits 0 with stub assertions in place"
    - "tests/rules.test.js has a Phase 30 describe block scaffolded (with .skip or pending it() entries) so Plan 02 can fill in real assertions"
    - "npm run smoke:couch-groups alias works and is appended to the smoke aggregate before smoke-app-parse.cjs"
  artifacts:
    - path: "scripts/smoke-couch-groups.cjs"
      provides: "Phase 30 smoke contract scaffold (helper-behavior + production-code sentinels + floor meta-assertion)"
      min_lines: 80
    - path: ".planning/REQUIREMENTS.md"
      provides: "GROUP-30-01..08 IDs registered in Traceability table (status: Pending)"
      contains: "GROUP-30-01"
    - path: "C:/Users/nahde/queuenight/firestore.indexes.json"
      provides: "COLLECTION_GROUP index entry for watchparties.memberUids array-contains + startAt DESCENDING"
      contains: "COLLECTION_GROUP"
    - path: "package.json"
      provides: "smoke:couch-groups alias + extended smoke aggregate"
      contains: "smoke:couch-groups"
  key_links:
    - from: "package.json scripts.smoke aggregate"
      to: "scripts/smoke-couch-groups.cjs"
      via: "&& node scripts/smoke-couch-groups.cjs"
      pattern: "smoke-couch-groups\\.cjs"
    - from: "scripts/smoke-couch-groups.cjs"
      to: "queuenight/functions/src/addFamilyToWp.js (Plan 02 target)"
      via: "readIfExists + eqContains sentinels (initially MISSING — Plan 02 fills them in)"
      pattern: "readIfExists"
    - from: ".planning/ROADMAP.md Phase 30 entry"
      to: ".planning/REQUIREMENTS.md GROUP-30-* IDs"
      via: "Requirements line lists [GROUP-30-01..08]"
      pattern: "GROUP-30-0"
---

<objective>
Wave 0 foundation for Phase 30 (Couch Groups). Lays the documentation, requirements registration, Firestore index declaration, and test scaffolding that every downstream plan in this phase depends on. ZERO production code changes — this plan writes the gates that Plan 02-05 must pass.

**Critical [BLOCKING] gate:** the firestore.indexes.json composite index entry MUST land in this plan and be deployable in Plan 02. Per RESEARCH.md Pitfall 7, the new client `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` query in Plan 04 silently fails until that index is built — so the index declaration ships in Wave 0, gets deployed in Wave 1 (Plan 02), and is verified live BEFORE Plan 04 ships client code.

Purpose: Honor D-03 (ROADMAP rewrite per CONTEXT.md), establish the 8 phase requirement IDs (GROUP-30-01..08) so the gsd verify-work coverage gate passes downstream, declare the missing composite index, and create the smoke + rules test scaffolds so all later plans only need to add sentinels rather than create files.

Output: 6 modified files (5 in couch repo + 1 in queuenight sibling repo). No CFs deployed in this plan — the indexes.json entry deploys in Plan 02 alongside the new CFs.
</objective>

<execution_context>
@C:/Users/nahde/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/nahde/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md
@CLAUDE.md
@scripts/smoke-guest-rsvp.cjs
@C:/Users/nahde/queuenight/firestore.indexes.json
@package.json

<interfaces>
<!-- Key contracts the executor needs. Extracted from RESEARCH.md + PATTERNS.md. -->
<!-- Use these directly — no codebase exploration needed beyond the @file refs above. -->

Smoke harness pattern (mirror exactly from scripts/smoke-guest-rsvp.cjs lines 27-47, 122-140, 200-215):

```javascript
'use strict';
const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)}`);
  console.error(`     actual:   ${JSON.stringify(actual)}`);
  failed++;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function eqContains(label, fileContent, needle) {
  if (fileContent === null) {
    console.log(`  skip ${label} (file not present in this checkout)`);
    return;
  }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     missing substring: ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

// ... assertions ...

console.log('=================================================');
console.log(`smoke-couch-groups: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
```

Firestore composite index entry shape (RESEARCH.md Pattern 1 + PATTERNS.md `queuenight/firestore.indexes.json` block):

```json
{
  "collectionGroup": "watchparties",
  "queryScope": "COLLECTION_GROUP",
  "fields": [
    { "fieldPath": "memberUids", "arrayConfig": "CONTAINS" },
    { "fieldPath": "startAt", "order": "DESCENDING" }
  ]
}
```

Phase requirement IDs (from RESEARCH.md § "Phase Requirements → Test Map"):

| ID | Behavior |
|----|----------|
| GROUP-30-01 | Host can add a family code at wp-create; wp gains wp.families[] + wp.memberUids[] |
| GROUP-30-02 | Family B member sees cross-family wp in their subscription |
| GROUP-30-03 | Cross-family members render in roster with real names + avatars |
| GROUP-30-04 | Name collision triggers (FamilyName) suffix; no collision = no suffix |
| GROUP-30-05 | Soft cap of 4 families: client warns above 4; hard ceiling rejects above 8 |
| GROUP-30-06 | Host-only: non-host cannot add a family to a wp |
| GROUP-30-07 | Cross-family wp read denied for users NOT in memberUids |
| GROUP-30-08 | Existing per-family wps still render correctly (no regression) |

Rules-test describe block scaffold (mirror tests/rules.test.js lines 937-974 — Phase 27 Guest RSVP describe block):

```javascript
await describe('Phase 30 Couch Groups rules', async () => {
  await it('#30-01 (PENDING) stranger read top-level wp → DENIED', async () => {
    // Plan 02 fills in the assertion. Wave 0 leaves the it() declared so
    // the test runner reports a known-pending count.
    return; // no-op pending; Plan 02 replaces with assertFails(...)
  });
  await it('#30-02 (PENDING) member in memberUids reads top-level wp → ALLOWED', async () => {
    return;
  });
  await it('#30-03 (PENDING) non-host cannot write wp.memberUids → DENIED', async () => {
    return;
  });
  await it('#30-04 (PENDING) non-host cannot write wp.families → DENIED', async () => {
    return;
  });
});
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1.1: Edit ROADMAP.md Phase 30 entry to groups-only scope (D-03)</name>
  <files>.planning/ROADMAP.md</files>
  <read_first>
    - .planning/ROADMAP.md (read lines 520-540 to see current Phase 30 entry verbatim)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md § D-01, D-02, D-03 (the carve-out rationale that this rewrite must reflect)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md § "Summary" (single-paragraph framing for the new Goal)
  </read_first>
  <action>
Edit `.planning/ROADMAP.md` `### Phase 30: Couch groups + affiliate hooks` block (currently at ~line 527) per CONTEXT D-03. Replace the existing block VERBATIM with:

```
### Phase 30: Couch groups
**Goal**: Multi-family "couch groups" — a wp can pull members from N families (soft cap 4 / hard ceiling 8) via host-pasted family code. Cross-family members appear with full identity (real names, votes, reactions, RSVPs) inside the wp roster. Host-only invite authority. No persistent groups entity — wp lifetime auto-caps with WP_ARCHIVE_MS (~25h post-start). Render-time `(FamilyName)` collision suffix only when name collisions span two different families. Watchparties migrate to a top-level Firestore `/watchparties/{wpId}` collection with `memberUids[]` rules gate + `collectionGroup` query. Closes the "two families want a shared Couch" gap.
**Depends on**: Phase 5 (auth + groups primitive), Phase 7 (watchparty primitive), Phase 24 (host-only video URL pattern + Path A/B rules split), Phase 27 (`wp.guests[]` denormalized array precedent + `(guest)` collision-suffix render-time pattern).
**Caveat**: Affiliate referral hooks originally bundled with this phase are CARVED OUT per CONTEXT D-01 to a future **Phase 30.1** with its own discuss/plan cycle. The CLAUDE.md "Don't start monetization / billing / plan-tier work" guardrail does NOT apply to Phase 30 (D-02) because affiliate is fully deferred; the guardrail re-engages at Phase 30.1 scoping.
**Requirements**: [GROUP-30-01, GROUP-30-02, GROUP-30-03, GROUP-30-04, GROUP-30-05, GROUP-30-06, GROUP-30-07, GROUP-30-08] — see REQUIREMENTS.md Traceability + 30-RESEARCH.md § "Phase Requirements → Test Map".
**Plans**: 5 plans
- [ ] 30-01-PLAN.md — Wave 0 foundation: ROADMAP rewrite (this task) + REQUIREMENTS GROUP-30-* registration + firestore.indexes.json composite index + smoke-couch-groups.cjs scaffold + tests/rules.test.js Phase 30 describe scaffold + package.json wiring
- [ ] 30-02-PLAN.md — Wave 1 backend: addFamilyToWp.js CF + wpMigrate.js CF + queuenight/functions/index.js exports + firestore.rules top-level /watchparties/{wpId} block + rsvpSubmit.js top-level lookup + Pitfall 5 fix + Phase 30 rules tests filled in (52 → 56 PASS) + cross-repo deploy of CFs + rules + indexes + verification that the composite index is BUILT before Plan 04 ships
- [ ] 30-03-PLAN.md — Wave 2 client wiring: js/firebase.js collectionGroup + where imports + js/app.js watchpartiesRef rewrite to collectionGroup query + watchpartyRef top-level retarget + confirmStartWatchparty wp doc shape extension (hostFamilyCode + families + memberUids + crossFamilyMembers) + buildNameCollisionMap helper + renderParticipantTimerStrip cross-family chip extension (with Pitfall 6 same-family suppression) + smoke sentinels for all of the above
- [ ] 30-04-PLAN.md — Wave 3 UI affordance: "Bring another couch in" wp-create + wp-edit form section per UI-SPEC + addFamilyToWp callable wiring + soft-cap warning copy at 5+ families + hard-cap hide at 8+ + remove-couch host-only kebab flow + ~140 lines css/app.css for .wp-add-family-* family + smoke sentinels
- [ ] 30-05-PLAN.md — Wave 3 close-out: sw.js CACHE bump → couch-v41-couch-groups via `bash scripts/deploy.sh 41-couch-groups` + smoke FLOOR meta-assertion lock + 30-HUMAN-UAT.md scaffold (10 device-UAT scripts) + cross-repo close-out summary

**UI hint**: medium (extends existing `renderParticipantTimerStrip` + adds new `.wp-add-family-section` to wp-create + wp-edit; brand voice continuity with Phase 27 `(guest)` collision-suffix pattern; ZERO affiliate UI in this phase per D-01 carve-out)
```

Then update the Progress table (~line 542) — add a new row immediately after the existing `| 28. Social pick'em + leaderboards | 2/6 | In Progress|  |` row:

```
| 30. Couch groups | 0/5 | Not started — kickoff via /gsd-plan-phase 30 (this plan) | - |
```

Do NOT rename the slug or directory in this task (CONTEXT D-03 explicitly defers the rename until ROADMAP edit lands AND artifacts are consistent — directory rename is a separate non-Phase-30 follow-up).

Per D-03 the rationale: "Capture as a pre-plan-phase TODO or include as the first task of /gsd-plan-phase 30. Defer the directory rename until ROADMAP edit lands so artifacts stay consistent." This task satisfies the first half (ROADMAP edit); directory rename remains deferred.
  </action>
  <verify>
    <automated>grep -q "^### Phase 30: Couch groups$" .planning/ROADMAP.md &amp;&amp; grep -q "GROUP-30-08" .planning/ROADMAP.md &amp;&amp; ! grep -q "Phase 30: Couch groups + affiliate hooks" .planning/ROADMAP.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^### Phase 30:" .planning/ROADMAP.md` returns 1 (single Phase 30 entry, no duplicate)
    - `grep -q "^### Phase 30: Couch groups$" .planning/ROADMAP.md` returns 0 (new heading, no `+ affiliate hooks`)
    - `grep -q "Phase 30: Couch groups + affiliate hooks" .planning/ROADMAP.md` returns 1 (NOT 0 — the OLD heading must NOT appear)
    - `grep -q "GROUP-30-01" .planning/ROADMAP.md` returns 0 (requirements line is present)
    - `grep -q "GROUP-30-08" .planning/ROADMAP.md` returns 0 (last requirement is present)
    - `grep -q "Phase 30.1" .planning/ROADMAP.md` returns 0 (affiliate carve-out reference present)
    - `grep -q "30-01-PLAN.md" .planning/ROADMAP.md` returns 0 (plan list present)
    - `grep -q "30-05-PLAN.md" .planning/ROADMAP.md` returns 0 (last plan present)
    - `grep -q "| 30. Couch groups | 0/5 | Not started" .planning/ROADMAP.md` returns 0 (Progress table row added)
    - Phase directory `.planning/phases/30-couch-groups-affiliate-hooks/` is NOT renamed (defers per D-03)
  </acceptance_criteria>
  <done>
    ROADMAP.md Phase 30 entry reflects groups-only scope per CONTEXT D-03; affiliate language is explicitly carved out to future Phase 30.1; all 8 GROUP-30-* requirement IDs are listed; 5-plan skeleton matches this Wave 0 plan + Plans 02-05; Progress table has the new row.
  </done>
</task>

<task type="auto">
  <name>Task 1.2: Register GROUP-30-01..08 in REQUIREMENTS.md Traceability table</name>
  <files>.planning/REQUIREMENTS.md</files>
  <read_first>
    - .planning/REQUIREMENTS.md (read lines 295-305 to see Traceability table header + first row format; read lines 380-395 around DECI-14-* rows for an example of how multi-row phase entries look)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md § "Phase Requirements → Test Map" (the source-of-truth for the 8 ID descriptions)
  </read_first>
  <action>
Append 8 new rows to the `## Traceability` table in `.planning/REQUIREMENTS.md`. Insert them at the END of the existing table (after the last current row). Use this exact format (matching the existing table's `| Requirement | Phase | Status |` columns):

```
| GROUP-30-01 | Phase 30 / 30-02 + 30-03 + 30-04 | Pending — Wave 1 (CF + wp doc shape) + Wave 2 (wp doc write extension) + Wave 3 (UI affordance) |
| GROUP-30-02 | Phase 30 / 30-03 | Pending — Wave 2 (collectionGroup subscription with where('memberUids','array-contains',uid)) |
| GROUP-30-03 | Phase 30 / 30-03 | Pending — Wave 2 (renderParticipantTimerStrip cross-family chip extension) |
| GROUP-30-04 | Phase 30 / 30-03 | Pending — Wave 2 (buildNameCollisionMap helper + render-time (FamilyName) suffix; D-09; Pitfall 6 same-family suppression) |
| GROUP-30-05 | Phase 30 / 30-04 | Pending — Wave 3 (client soft-cap warning at 5+ + hard-cap hide at 8+ + addFamilyToWp CF resource-exhausted error matrix) |
| GROUP-30-06 | Phase 30 / 30-02 | Pending — Wave 1 (Path B denylist includes families + memberUids; addFamilyToWp CF host-only check; rules-test #30-03 + #30-04) |
| GROUP-30-07 | Phase 30 / 30-02 | Pending — Wave 1 (firestore.rules top-level /watchparties/{wpId} block: allow read if request.auth.uid in resource.data.memberUids; rules-test #30-01 + #30-02) |
| GROUP-30-08 | Phase 30 / 30-03 | Pending — Wave 2 (smoke-app-parse.cjs regression sentinel: existing per-family render path unchanged; back-compat for pre-Phase-30 wps) |
```

Do NOT modify any other rows. Do NOT modify the table header. Do NOT modify the Coverage block (which appears earlier in the file around line ~341 per STATE.md).
  </action>
  <verify>
    <automated>grep -c "^| GROUP-30-0" .planning/REQUIREMENTS.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "^| GROUP-30-0" .planning/REQUIREMENTS.md` returns 8 (all 8 IDs present)
    - `grep -q "^| GROUP-30-01 | Phase 30 / 30-02" .planning/REQUIREMENTS.md` returns 0
    - `grep -q "^| GROUP-30-08 | Phase 30 / 30-03" .planning/REQUIREMENTS.md` returns 0
    - `grep -q "Pitfall 6 same-family suppression" .planning/REQUIREMENTS.md` returns 0 (D-09 nuance recorded for traceability)
    - All 8 rows have `Pending` status (no `Complete` status leaks in)
    - Table header `| Requirement | Phase | Status |` unchanged
  </acceptance_criteria>
  <done>
    All 8 GROUP-30-* requirement IDs registered in REQUIREMENTS.md Traceability table with status Pending and references to the plans that will close each. Coverage gate downstream of /gsd-verify-work 30 will be satisfiable.
  </done>
</task>

<task type="auto">
  <name>Task 1.3: Add COLLECTION_GROUP composite index for watchparties.memberUids in queuenight firestore.indexes.json</name>
  <files>C:/Users/nahde/queuenight/firestore.indexes.json</files>
  <read_first>
    - C:/Users/nahde/queuenight/firestore.indexes.json (full file — only ~13 lines; verify the existing watchparties COLLECTION index at lines 3-12 to mirror its shape)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md § "Common Pitfalls" Pitfall 7 (the silent-failure mode this index prevents)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md § "queuenight/firestore.indexes.json" block (the exact JSON entry to add)
  </read_first>
  <action>
**[BLOCKING gate]** — This index MUST exist in source AND be deployed to production BEFORE Plan 30-04 ships the client `collectionGroup('watchparties').where('memberUids', 'array-contains', uid)` subscription. Plan 02 owns the deploy step; this task owns the source declaration.

Edit `C:/Users/nahde/queuenight/firestore.indexes.json` (cross-repo path — sibling repo to couch). The file currently is:

```json
{
  "indexes": [
    {
      "collectionGroup": "watchparties",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "titleId", "order": "ASCENDING" },
        { "fieldPath": "startAt", "order": "ASCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

Replace it with:

```json
{
  "indexes": [
    {
      "collectionGroup": "watchparties",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "titleId", "order": "ASCENDING" },
        { "fieldPath": "startAt", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "watchparties",
      "queryScope": "COLLECTION_GROUP",
      "fields": [
        { "fieldPath": "memberUids", "arrayConfig": "CONTAINS" },
        { "fieldPath": "startAt", "order": "DESCENDING" }
      ]
    }
  ],
  "fieldOverrides": []
}
```

**Critical detail (RESEARCH.md Pitfall 7):** The new entry's `queryScope` MUST be `"COLLECTION_GROUP"` (not `"COLLECTION"`). The existing entry stays at `"COLLECTION"` because it's a per-family subcollection scope; the new entry covers the cross-family `collectionGroup('watchparties')` query that Plan 30-03 wires.

**Critical detail:** The `arrayConfig` value MUST be `"CONTAINS"` (not `"ARRAY_CONTAINS"`). This is Firebase's documented field name; mismatched config will be rejected by `firebase deploy --only firestore:indexes`.

Do NOT deploy in this task — Plan 02 owns `firebase deploy --only firestore:indexes` from the queuenight repo.
  </action>
  <verify>
    <automated>node -e "const j=require('C:/Users/nahde/queuenight/firestore.indexes.json'); const m=j.indexes.find(i=>i.collectionGroup==='watchparties'&amp;&amp;i.queryScope==='COLLECTION_GROUP'); if(!m||!m.fields.find(f=>f.fieldPath==='memberUids'&amp;&amp;f.arrayConfig==='CONTAINS')||!m.fields.find(f=>f.fieldPath==='startAt'&amp;&amp;f.order==='DESCENDING')) {console.error('FAIL: index missing or malformed');process.exit(1);} console.log('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `node -e "JSON.parse(require('fs').readFileSync('C:/Users/nahde/queuenight/firestore.indexes.json','utf8'))"` exits 0 (valid JSON)
    - The COLLECTION_GROUP entry exists with collectionGroup="watchparties"
    - The entry's fields[0] is `{fieldPath:"memberUids", arrayConfig:"CONTAINS"}`
    - The entry's fields[1] is `{fieldPath:"startAt", order:"DESCENDING"}`
    - The original COLLECTION entry (titleId + startAt ASCENDING) is UNCHANGED — `grep -q "titleId" C:/Users/nahde/queuenight/firestore.indexes.json` returns 0
    - `grep -q "fieldOverrides" C:/Users/nahde/queuenight/firestore.indexes.json` returns 0 (file structure preserved)
    - File is NOT deployed in this task (Plan 02 deploys)
  </acceptance_criteria>
  <done>
    Composite index source declaration shipped to queuenight/firestore.indexes.json. Plan 02 will deploy via `firebase deploy --only firestore:indexes` from the queuenight repo. Plan 04 client code is BLOCKED on the deploy + build completion (which can take minutes for a fresh index) per RESEARCH.md Pitfall 7.
  </done>
</task>

<task type="auto">
  <name>Task 1.4: Create scripts/smoke-couch-groups.cjs scaffold + tests/rules.test.js Phase 30 describe scaffold + package.json wiring</name>
  <files>scripts/smoke-couch-groups.cjs, tests/rules.test.js, package.json</files>
  <read_first>
    - scripts/smoke-guest-rsvp.cjs (full file — exact harness pattern to mirror; specifically lines 27-47 for eq/eqObj helpers, lines 122-140 for readIfExists/eqContains + path resolution, lines 200-215 for floor meta-assertion + exit pattern)
    - tests/rules.test.js (read lines 937-985 to see the existing Phase 27 describe block + cleanup pattern; this is the structural analog)
    - package.json (full file — only ~22 lines; see existing smoke aliases at lines 9-20 + smoke aggregate at line 8)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md § "scripts/smoke-couch-groups.cjs" + § "tests/rules.test.js" + § "package.json" (the exact patterns to apply)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md § "Validation Architecture" (the 8-row req→test map)
  </read_first>
  <action>
Three sub-edits in this task (all are scaffolding — no real assertions yet; Plans 02-04 fill them in):

**(a) Create `scripts/smoke-couch-groups.cjs`** — new file. Use this exact scaffold:

```javascript
'use strict';
// Phase 30 — Couch Groups smoke contract.
// Wave 0 scaffold: harness + path resolution + 4 helper-behavior assertions for
// buildNameCollisionMap (Plan 03 will replace the inline helper duplicate with a
// require() once buildNameCollisionMap is exported as an ESM-compatible standalone
// — for now, we duplicate the helper here for testability per the smoke pattern).
// Production-code sentinels: NONE in Wave 0 — Plans 02/03/04 add them.
// Floor meta-assertion: Wave 0 sets FLOOR=0 (no production code yet); Plan 05 raises it.

const path = require('path');
const fs = require('fs');

let passed = 0;
let failed = 0;

function eq(label, actual, expected) {
  if (actual === expected) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${JSON.stringify(expected)}`);
  console.error(`     actual:   ${JSON.stringify(actual)}`);
  failed++;
}

function eqObj(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     expected: ${e}`);
  console.error(`     actual:   ${a}`);
  failed++;
}

function readIfExists(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return null; }
}

function eqContains(label, fileContent, needle) {
  if (fileContent === null) {
    console.log(`  skip ${label} (file not present in this checkout)`);
    return;
  }
  if (fileContent.includes(needle)) { console.log(`  ok ${label}`); passed++; return; }
  console.error(`  FAIL ${label}`);
  console.error(`     missing substring: ${JSON.stringify(needle).slice(0, 120)}`);
  failed++;
}

const COUCH_ROOT = path.resolve(__dirname, '..');
const QN_FUNCTIONS = path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions');

console.log('==== Phase 30 Couch Groups — smoke ====');

// === Section 1: buildNameCollisionMap helper-behavior tests (D-09 + Pitfall 6) ===
// Inline duplicate of the helper Plan 03 will add to js/app.js. Mirrors RESEARCH.md
// § "Code Examples / Smoke Contract Sentinel Pattern".
function buildNameCollisionMap(wp) {
  const nameCounts = {};
  Object.values(wp.participants || {}).forEach(p => {
    const n = (p.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  (wp.crossFamilyMembers || []).forEach(m => {
    const n = (m.name || '').trim().toLowerCase();
    if (n) nameCounts[n] = (nameCounts[n] || 0) + 1;
  });
  return nameCounts;
}

console.log('-- 1. buildNameCollisionMap (D-09 cross-family disambiguation) --');
{
  // Cross-family collision: 1 Sam in Family A + 1 Sam in Family B → count = 2
  const wp1 = {
    participants: { m1: { name: 'Sam' } },
    crossFamilyMembers: [{ name: 'Sam', familyCode: 'fam2' }],
  };
  const map1 = buildNameCollisionMap(wp1);
  eq('1.1 cross-family collision: count("sam") === 2', map1['sam'], 2);
  eq('1.2 case-normalized lower: count uses lowercased key', map1['Sam'], undefined);
}
{
  // No collision: distinct names → count = 1 each
  const wp2 = {
    participants: { m1: { name: 'Riley' } },
    crossFamilyMembers: [{ name: 'Sam', familyCode: 'fam2' }],
  };
  const map2 = buildNameCollisionMap(wp2);
  eq('1.3 no collision: count("riley") === 1', map2['riley'], 1);
  eq('1.4 no collision: count("sam") === 1', map2['sam'], 1);
}

// === Section 2: production-code sentinels — DEFERRED to Plans 02/03/04 ===
console.log('-- 2. production-code sentinels (Wave 0 placeholder — Plans 02/03/04 fill) --');
console.log('  skip 2.0 placeholder (Wave 0 has no production code yet)');

// === Section 3: floor meta-assertion (Plan 05 raises FLOOR; Wave 0 sets 0) ===
console.log('-- 3. production-code sentinel floor meta-assertion --');
{
  const FLOOR = 0; // Plan 05 raises this to 13 (mirrors smoke-guest-rsvp.cjs pattern)
  const helperBehaviorAssertions = 4; // Section 1 above
  const productionCodeAssertions = passed - helperBehaviorAssertions;
  if (productionCodeAssertions >= FLOOR) {
    console.log(`  ok 3.1 production-code sentinel floor met (${productionCodeAssertions} >= ${FLOOR})`);
    passed++;
  } else {
    console.error(`  FAIL 3.1 production-code sentinel floor NOT met (${productionCodeAssertions} < ${FLOOR})`);
    failed++;
  }
}

console.log('=================================================');
console.log(`smoke-couch-groups: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
process.exit(0);
```

**(b) Edit `tests/rules.test.js`** — find the Phase 27 describe block (lines 937-974 per PATTERNS.md). Insert a new Phase 30 describe block IMMEDIATELY BEFORE the `await testEnv.cleanup()` line (~line 976). Use the scaffold from the `<interfaces>` block above (4 PENDING it() declarations). Each it() body is a single `return;` for now — Plan 02 replaces with real `assertSucceeds`/`assertFails` calls.

```javascript
await describe('Phase 30 Couch Groups rules (PENDING — Plan 30-02 fills assertions)', async () => {
  await it('#30-01 (PENDING) stranger read top-level wp → DENIED', async () => {
    return; // Plan 30-02 replaces with: await assertFails(stranger.doc('watchparties/wp_phase30_test').get());
  });
  await it('#30-02 (PENDING) member in memberUids reads top-level wp → ALLOWED', async () => {
    return; // Plan 30-02 replaces with: await assertSucceeds(member.doc('watchparties/wp_phase30_test').get());
  });
  await it('#30-03 (PENDING) non-host cannot write wp.memberUids → DENIED', async () => {
    return; // Plan 30-02 replaces with: await assertFails(member.doc('watchparties/wp_phase30_test').update({memberUids:[...]}));
  });
  await it('#30-04 (PENDING) non-host cannot write wp.families → DENIED', async () => {
    return; // Plan 30-02 replaces with: await assertFails(member.doc('watchparties/wp_phase30_test').update({families:[...]}));
  });
});
```

**(c) Edit `package.json`** — two changes:

1. Insert `"smoke:couch-groups": "node scripts/smoke-couch-groups.cjs",` between line 19 (`"smoke:pickem"`) and line 20 (`"smoke:app-parse"`).

2. Extend the smoke aggregate at line 8. Currently it ends with `&& node scripts/smoke-pickem.cjs && node scripts/smoke-app-parse.cjs`. Change it to: `&& node scripts/smoke-pickem.cjs && node scripts/smoke-couch-groups.cjs && node scripts/smoke-app-parse.cjs` — i.e., insert `node scripts/smoke-couch-groups.cjs` AFTER pickem and BEFORE app-parse so app-parse stays last (it validates ES module parse integrity of all modified JS files post-Wave-2).
  </action>
  <verify>
    <automated>node scripts/smoke-couch-groups.cjs &amp;&amp; npm run smoke:couch-groups &amp;&amp; grep -q "Phase 30 Couch Groups rules" tests/rules.test.js &amp;&amp; node -e "const p=require('./package.json'); if(!p.scripts['smoke:couch-groups'])process.exit(1); if(!p.scripts.smoke.includes('smoke-couch-groups.cjs'))process.exit(2); if(!p.scripts.smoke.endsWith('smoke-app-parse.cjs'))process.exit(3); console.log('OK')"</automated>
  </verify>
  <acceptance_criteria>
    - `node scripts/smoke-couch-groups.cjs` exits 0 (scaffold runs end-to-end)
    - `npm run smoke:couch-groups` exits 0 (alias works)
    - Smoke output includes `1.1 cross-family collision: count("sam") === 2 ok`
    - Smoke output includes `3.1 production-code sentinel floor met (0 >= 0) ok`
    - `grep -q "Phase 30 Couch Groups rules" tests/rules.test.js` returns 0
    - `grep -c "#30-0[1-4] (PENDING)" tests/rules.test.js` returns 4
    - `grep -q '"smoke:couch-groups"' package.json` returns 0
    - `grep -q "smoke-couch-groups.cjs && node scripts/smoke-app-parse.cjs" package.json` returns 0 (app-parse stays last in aggregate)
    - `node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"` exits 0 (valid JSON)
    - `cd tests && npm test` still exits 0 (rules tests still pass — the 4 PENDING it()s no-op return; existing 52 tests untouched)
  </acceptance_criteria>
  <done>
    Smoke scaffold runs cleanly with 4 helper-behavior assertions + 1 floor meta-assertion (FLOOR=0); rules-test scaffold has 4 PENDING describes that Plan 02 fills in; package.json wiring lets `npm run smoke` aggregate and `npm run smoke:couch-groups` alias work end-to-end. All Wave 0 gates from RESEARCH.md § "Wave 0 Gaps" satisfied.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| File-system / git → planning artifacts | The 6 modified files are all source-tree (no production deploy). No untrusted input crosses any boundary in this plan. |
| firestore.indexes.json source → Firebase deploy | The composite index entry is source-only in this plan. The deploy boundary opens in Plan 02 (Wave 1). |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-30-01 | Tampering | firestore.indexes.json | accept | Source file is JSON in a sibling repo with no live deploy in this plan. Plan 02 owns the deploy step where the tampering surface opens. Plan 02 verifies the index field shape post-deploy via `firebase firestore:indexes`. |
| T-30-02 | Information Disclosure | REQUIREMENTS.md / ROADMAP.md edits | accept | All edits are public-by-design GSD planning artifacts; no secrets are introduced. The phase requirement IDs reveal nothing not already exposed in 30-CONTEXT.md (committed earlier). |
| T-30-03 | Denial of Service | composite index NOT YET BUILT in production | mitigate | This plan declares the index in source so Plan 02 can deploy it. The deploy itself is the mitigation; Plan 04 (client code) MUST verify the index is BUILT (not just declared) before it ships, per RESEARCH.md Pitfall 7. Plan 02 acceptance criteria includes `firebase firestore:indexes | grep memberUids` post-deploy. |
</threat_model>

<verification>
Wave 0 validates by:
1. `npm run smoke:couch-groups` exits 0 (scaffold green)
2. `cd tests && npm test` still exits 0 (no rules-test regressions; 52 existing tests + 4 PENDING no-op tests = 56 declared, 52 active passing, 4 pending no-op)
3. `node -e "JSON.parse(require('fs').readFileSync('C:/Users/nahde/queuenight/firestore.indexes.json','utf8'))"` exits 0 (valid JSON in sibling repo)
4. ROADMAP.md + REQUIREMENTS.md grep verifications above all pass
5. `npm run smoke` (full aggregate) exits 0 — all 12 contracts green INCLUDING the new smoke-couch-groups.cjs scaffold; smoke-app-parse.cjs continues to be the LAST contract in the chain
</verification>

<success_criteria>
- ROADMAP.md Phase 30 entry rewritten per CONTEXT D-03 (groups-only scope; affiliate carved to Phase 30.1; 5-plan skeleton listed; Progress table row added)
- REQUIREMENTS.md has all 8 GROUP-30-01..08 IDs registered with status Pending
- queuenight/firestore.indexes.json declares the watchparties COLLECTION_GROUP composite index for memberUids array-contains + startAt DESCENDING
- scripts/smoke-couch-groups.cjs exists, runs end-to-end, exits 0 with 5 assertions passing (4 helper-behavior + 1 floor=0 meta)
- tests/rules.test.js Phase 30 describe scaffold has 4 PENDING it() declarations
- package.json has smoke:couch-groups alias + smoke aggregate extended (smoke-app-parse.cjs remains last)
- Plan 02 can begin immediately (all Wave 0 dependencies satisfied)
- ZERO production code modified in this plan (all changes are docs + tests + index source + npm wiring)
</success_criteria>

<output>
After completion, create `.planning/phases/30-couch-groups-affiliate-hooks/30-01-SUMMARY.md` documenting:
- 6 modified files (5 in couch + 1 in queuenight)
- ROADMAP D-03 satisfied (groups-only scope; affiliate → Phase 30.1)
- 8 requirement IDs registered in REQUIREMENTS.md Traceability
- COLLECTION_GROUP composite index declared (deploy in Plan 02)
- Smoke + rules-test scaffolds created with PENDING markers
- All `requirements_completed: []` (Wave 0 ships scaffolds, not behavior)
- Resume signal: Plan 02 ready to begin
</output>
