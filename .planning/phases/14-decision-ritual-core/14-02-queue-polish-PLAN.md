---
phase: 14-decision-ritual-core
plan: 02
type: execute
wave: 1
depends_on: []
files_modified:
  - js/app.js
autonomous: false
requirements_addressed: [DECI-14-03]
must_haves:
  truths:
    - "When the LOCAL user (state.me) votes Yes on a title that wasn't previously in their queue, a flashToast surfaces 'Added \"<title>\" to your queue' immediately after the queues[memberId] write."
    - "Toast does NOT fire when another member's Yes vote arrives via onSnapshot (memberId !== state.me.id) — prevents toast spam from family members' background activity."
    - "Adding a title from the Add tab handler appends the title to bottom of state.me's personal queue (queues[state.me.id] = currentQueueLength + 1) AT THE SAME TIME it adds to the family library — verified end-to-end (audit may reveal it already works; if not, fix it)."
    - "iOS Safari touch-DnD UAT decision documented: either keep hand-rolled HTML5 DnD at js/app.js:4664 (works on iOS Safari) OR swap to Sortable.js loaded via CDN <script> tag in app.html (graceful upgrade)."
    - "Existing queue infrastructure (queues map, drag-reorder, persistQueueOrder, reindexMyQueue) is NOT rebuilt — this plan polishes the polish surface only (DR-2 reframe)."
  artifacts:
    - path: "js/app.js"
      provides: "applyVote toast extension + Add-tab queue insertion fix (if needed)"
      contains: "Added \\\""
      min_lines_added: 4
  key_links:
    - from: "js/app.js applyVote ~12340 Yes branch"
      to: "flashToast(`Added \"${t.name}\" to your queue`)"
      via: "single line conditional after queues[memberId] assignment"
      pattern: "flashToast\\(`Added \""
    - from: "Add-tab handler (planner-greps the actual function)"
      to: "queues[state.me.id] write at title-doc create time"
      via: "addDoc/setDoc payload includes queues field OR follow-up updateDoc"
      pattern: "queues:\\s*\\{"
---

<objective>
Polish the existing per-member queue infrastructure per DR-2 reframe of D-03. The queue primitive is ALREADY shipped in production (queues map at js/app.js:12340-12350, drag-reorder at js/app.js:4664, persistQueueOrder at js/app.js:4648, reindexMyQueue at js/app.js:6834 — DR-2 confirmed all this). Phase 14 does NOT rebuild — it adds three small polish items that close the discoverability + correctness gaps the researcher flagged.

Purpose: Three concrete gaps. (1) Yes-vote auto-adds to queue silently — users may not realize their vote re-ordered their personal queue (Anti-pattern #5 in CONTEXT). One-line flashToast fixes that. (2) The researcher couldn't confirm Add-tab insertion path actually wires the new title into the actor's queue — this plan audits and fixes if missing. (3) iOS Safari has historical HTML5 DnD touch issues — this plan UATs the existing implementation and either confirms it works or swaps in Sortable.js.

Output: One-line toast in applyVote (Task 1), Add-tab insertion path verified end-to-end with code fix if a gap exists (Task 2), and a checkpoint:human-verify confirming iOS Safari DnD works on the primary surface (Task 3).
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 1 (foundations). No upstream dependencies. This plan unblocks 14-03 (tiered candidate filter relies on queue ranks being correctly populated by Add-tab + Yes-vote paths) and the entire decision ritual UX (queue is the primary input to tier-1 sort).

**Two-repo discipline:** Couch-side files only — repo-relative paths. This plan does NOT modify queuenight/.

**DR-2 reframe critical:** the plan title "Per-member queue primitive" was misleading. This plan title is "queue polish + Add-tab insertion verify + iOS DnD UAT". Do NOT build a new primitive. Do NOT replace existing queue functions.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md

<interfaces>
**Existing applyVote queue-sync block** at js/app.js:12340-12350 (DR-2 confirmed — already shipped):
```js
const wasInQueue = queues[memberId] != null;
if (newVote === 'yes') {
  if (!wasInQueue) {
    // Append at end of that member's current queue
    const memberQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[memberId] != null).length;
    queues[memberId] = memberQueueLen + 1;
  }
} else {
  if (wasInQueue) delete queues[memberId];
}
```

**Existing flashToast** at js/utils.js:18 — already imported into js/app.js as evidenced by 30+ existing call sites (`grep "flashToast(" js/app.js | wc -l`). No new import needed.

**Existing drag-reorder primitive** at js/app.js:4664 (`attachQueueDragReorder`), persist at js/app.js:4648 (`persistQueueOrder`), reindex at js/app.js:6834 (`reindexMyQueue`). Surfaces in Library tab when `state.filter === 'myqueue'` (js/app.js:4495).

**Add-tab handlers** — researcher flagged this as unverified. The Add tab is where titles get newly added to the family library. The likely entry point is search for `addToFamily`, `addTitle`, or `addDoc(titlesRef()` in js/app.js. The contract: when a title is newly added to the family library by state.me, the resulting title doc MUST include `queues: { [state.me.id]: <bottom-rank> }` so the new title automatically lives in the adder's personal queue at the bottom — D-03 explicitly says "Adding from Add tab pushes to bottom of personal queue + family library."
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add Yes-vote queue-add discoverability toast in applyVote</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 12325-12390 (applyVote full body — find the queues[memberId] = memberQueueLen + 1 line)
    - js/utils.js lines 1-50 (flashToast signature + kind enum)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §3 (concrete excerpt)
  </read_first>
  <action>
1. Locate the applyVote queue-sync block at approximately js/app.js:12340-12350. The existing block looks like:
```js
const wasInQueue = queues[memberId] != null;
if (newVote === 'yes') {
  if (!wasInQueue) {
    const memberQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[memberId] != null).length;
    queues[memberId] = memberQueueLen + 1;
  }
} else {
  if (wasInQueue) delete queues[memberId];
}
```

2. Insert this single-line block IMMEDIATELY after the closing brace of the `if (newVote === 'yes')` branch (i.e. after `queues[memberId] = memberQueueLen + 1;` but still inside the outer write block, before the `else` branch):

```js
// D-03 (DECI-14-03 / Anti-pattern #5) — surface the silent queue mutation to the actor.
// Guard: only toast when the local user is the actor; onSnapshot-driven updates from other
// members' votes would otherwise spam the local UI with toasts about their queue changes.
if (newVote === 'yes' && !wasInQueue && memberId === (state.me && state.me.id)) {
  flashToast(`Added "${t.name}" to your queue`, { kind: 'info' });
}
```

3. Confirm the `t` variable is in scope at that line (it should be — applyVote receives the title doc). If the title-doc reference is named differently in the existing code (e.g. `title` instead of `t`), use the actual local variable name verbatim. Do NOT rename anything.

4. Do NOT add a parallel toast for the No → remove-from-queue branch — D-03 only specifies discoverability for the Yes auto-add path. No-vote queue removal is intentional and not surprising; toasting it would feel chatty.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "Added \\\"" js/app.js</automated>
    Expect: `node --check` exits 0; grep returns ≥1 (the new toast literal).
  </verify>
  <done>
    - js/app.js contains the literal `flashToast(\`Added "${t.name}" to your queue\`, { kind: 'info' });` exactly once, inside applyVote, guarded by the actor-identity check.
    - The toast does NOT fire on No votes.
    - The toast does NOT fire when memberId !== state.me.id (verified by reading the guard condition).
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Audit + fix Add-tab insertion path (verify D-03 'pushes to bottom of personal queue' invariant)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js — grep for `addDoc(titlesRef()` and `setDoc(doc(titlesRef()` to enumerate ALL title-creation call sites
    - js/app.js — grep for `addToFamily`, `addTitle`, `tab === 'add'` to locate Add-tab handlers
    - js/app.js lines 12340-12355 (applyVote queue-append shape — same shape MUST appear in Add-tab create path)
    - .planning/phases/14-decision-ritual-core/14-RESEARCH.md §2 + DR-2 (researcher's audit notes)
  </read_first>
  <action>
1. **Enumerate title-creation call sites.** Run grep for ALL of:
   - `addDoc(titlesRef()`
   - `setDoc(doc(titlesRef()`
   - `addDoc(collection(db,` (catches lower-level writes that bypass titlesRef helper)
   Each match is a candidate Add-tab insertion site. Capture file:line for each in the SUMMARY.

2. **For each candidate site**, determine:
   - Is it triggered by user action in the Add tab? (vs. bulk import, Trakt sync, seed pack expand, etc.)
   - Does the payload include a `queues: { [state.me.id]: <rank> }` field?

   The existing payload likely DOES include core fields (id, name, poster, addedBy, addedAt) but the researcher flagged uncertainty about queue insertion at create time.

3. **If ANY user-Add-tab path is missing the queues field**, fix it. Insertion shape:

```js
// D-03 (DECI-14-03) — Add-tab insertion: new title lives in the adder's queue at the bottom.
// Compute bottom rank as: count of state.me's existing queue length + 1.
const myQueueLen = state.titles.filter(x => !x.watched && x.queues && x.queues[state.me.id] != null).length;
const queuesPayload = state.me ? { [state.me.id]: myQueueLen + 1 } : {};

await addDoc(titlesRef(), {
  /* existing payload preserved verbatim */,
  queues: queuesPayload,
  ...writeAttribution()
});
```

   IF the existing payload already creates the title without `queues`, AND a follow-up `applyVote('yes')` is called immediately after creation (some Add flows seed a Yes vote on add), the existing queue-add branch in applyVote (Task 1's analog block) would handle insertion. In that case, the audit conclusion is "Add tab insertion works via the Yes-on-add path — no fix needed." Document this in the SUMMARY with file:line evidence.

4. **If NO user-Add-tab path exists** that newly adds a title doc (e.g. all add flows route through a CF or a seed-pack expander), document this as a no-op finding and confirm via grep + read that the seed-pack expander DOES populate queues OR that the audit concluded the Add-tab insertion is already correct via the Yes-on-add path.

5. **Optional bulk-import paths (Trakt sync, Couch Nights pack expand, seed paths) MUST NOT be modified** — D-03 specifies "Adding from Add tab" only; bulk imports populating other members' queues would be a privacy regression.

6. Add a comment marker `// === D-03 Add-tab insertion (DECI-14-03) ===` at any modified call site so the audit trail is greppable.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -nE "addDoc\\(titlesRef\\(\\)|setDoc\\(doc\\(titlesRef\\(\\)" js/app.js | head -20</automated>
    Expect: `node --check` exits 0; grep returns the enumeration of all title-creation sites for SUMMARY.md documentation.
  </verify>
  <done>
    - SUMMARY.md (Task 4 output) enumerates every title-creation call site with one of these dispositions: (a) "modified to insert queues[state.me.id] at bottom" with diff, OR (b) "already correct via Yes-on-add follow-up" with file:line evidence, OR (c) "bulk import — intentionally not modified."
    - At least one user-Add-tab path provably lands new titles in state.me's queue at the bottom (either by direct payload OR by Yes-on-add path).
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: HUMAN-VERIFY — iOS Safari HTML5 touch-DnD on Library queue</name>
  <what-built>
    Tasks 1+2 ship the toast + Add-tab insertion fix. Task 3 closes the open question from RESEARCH §3 / DR-2: does the existing hand-rolled HTML5 DnD at js/app.js:4664 (`attachQueueDragReorder`) actually work on the primary surface (iOS Safari PWA)? If yes, no library swap needed. If no, plan a follow-up to load Sortable.js via CDN.
  </what-built>
  <how-to-verify>
    1. Deploy current main to staging (or test on local Firebase emulator if Library tab is reachable).
    2. Open the deployed URL on an iPhone using Safari (NOT installed PWA — start in browser to test the touch handler in its primary environment).
    3. Sign in. Navigate to the Library tab. Set the filter to `myqueue` (the drag-reorder UI is gated on this filter — js/app.js:4495).
    4. With ≥3 titles in the queue, attempt to drag a title from position 3 to position 1 using touch-only.
    5. Expected: title visibly moves; on release, persist (refresh page should show the new order).
    6. Now repeat steps 3-5 with the app installed as a home-screen PWA. iOS Safari behavior in standalone PWA mode is sometimes different from Safari browser mode.
    7. Note ANY of these failure modes:
       - Drag never starts on touch (long-press required vs. immediate drag — the HTML5 DnD spec says immediate; iOS may require long-press).
       - Drag visual is broken (no ghost element, item disappears mid-drag).
       - Drop position computed wrong (always inserts at bottom regardless of release position).
       - Persisted order doesn't match visual order on refresh.

    Decide: PASS (existing implementation works on iOS Safari + iOS PWA) OR FAIL (one or more failure modes — document which).
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "passed" — implementation works on iOS Safari PWA. SUMMARY.md records the pass; no library swap; Task 3 closes.
    - "failed: <description>" — implementation broken on iOS. SUMMARY.md records the failure mode and a follow-up plan is opened (Sortable.js via CDN — load `<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js">` in app.html, replace `attachQueueDragReorder` body with Sortable bindings against the same .full-queue-row class). The follow-up itself is OUT OF SCOPE for this plan — capture as a 14-02-FOLLOWUP.md note for the orchestrator.
    - "skip-uat" — defer iOS UAT to a later session. SUMMARY.md records the deferral as a known gap; Task 3 closes with conditional approval.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Snapshot listener → local UI | Toast logic must guard actor identity to avoid spamming the local user with toasts about other members' actions |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.02-01 | Information Disclosure | Toast leaking other members' vote actions to the local user | mitigate | Actor-identity guard: `memberId === state.me.id` short-circuits toast for non-actor cases (Task 1 acceptance criterion) |
| T-14.02-02 | Tampering | Add-tab insertion writing to queues[someoneElse.id] | mitigate | Add-tab insertion writes ONLY to state.me's queue slot — no foreign memberId writes (Task 2 acceptance criterion) |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "Added \\\"" js/app.js` → ≥1.
- `grep -c "memberId === (state.me && state.me.id)" js/app.js` → ≥1 (toast actor guard).
- Task 2 SUMMARY enumerates every title-creation call site with disposition.
- Task 3 checkpoint resolved with one of {passed, failed, skip-uat}; SUMMARY records the resolution.
</verification>

<success_criteria>
1. applyVote surfaces a flashToast for state.me's Yes-vote queue auto-add; does NOT toast for other members' votes.
2. Add-tab insertion path verified end-to-end: new titles land in state.me's queue at the bottom (either via direct payload OR via Yes-on-add follow-up).
3. iOS Safari touch-DnD UAT resolved (passed / failed-with-follow-up / explicit deferral).
4. Existing queue infrastructure (queues map, attachQueueDragReorder, persistQueueOrder, reindexMyQueue) NOT rebuilt — DR-2 polish-only invariant holds.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-02-SUMMARY.md` documenting:
- Exact file:line of the toast insertion in applyVote.
- Add-tab call-site enumeration with per-site disposition.
- iOS DnD UAT resolution + (if failed) follow-up plan stub.
- Confirmation that no existing queue function was rebuilt.
</output>
