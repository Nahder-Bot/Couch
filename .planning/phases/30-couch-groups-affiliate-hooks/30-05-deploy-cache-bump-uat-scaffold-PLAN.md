---
plan: 05
phase: 30
wave: 4
depends_on: [01, 02, 03, 04]
files_modified:
  - sw.js
  - .planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md
files_modified_via_deploy_script:
  - sw.js (CACHE bumped to couch-v41-couch-groups via bash scripts/deploy.sh 41-couch-groups)
requirements: [GROUP-30-01, GROUP-30-02, GROUP-30-03, GROUP-30-04, GROUP-30-05, GROUP-30-06, GROUP-30-07, GROUP-30-08]
autonomous: false
risk: medium
status: ready
gap_closure: false
must_haves:
  truths:
    - "Production hosting deployed via bash scripts/deploy.sh 41-couch-groups; sw.js CACHE in production reads couch-v41-couch-groups"
    - "couchtonight.app curl-verified to serve the new CACHE string post-deploy"
    - "Full smoke aggregate exits 0 BEFORE deploy (12 contracts including smoke-couch-groups.cjs at FLOOR=13)"
    - "Rules tests 56 PASS BEFORE deploy"
    - "30-HUMAN-UAT.md scaffolded with at least 11 device-UAT scripts covering all 8 GROUP-30-* requirements + Pitfall scenarios + the W5 follow-on residual-read-access verification (Script 11; cross-references Plan 04 threat T-30-14)"
    - "wpMigrate CF invoked ONCE post-deploy from a host's signed-in browser (or deferred per checkpoint) to migrate any pre-Phase-30 nested wps to top-level"
  artifacts:
    - path: "sw.js"
      provides: "CACHE bumped to couch-v41-couch-groups (auto-bumped via deploy.sh, NOT hand-edited)"
      contains: "couch-v41-couch-groups"
    - path: ".planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md"
      provides: "10+ device-UAT scripts covering all 8 requirements + 3 critical pitfalls (5/6/7)"
      min_lines: 80
  key_links:
    - from: "deploy.sh 41-couch-groups"
      to: "sw.js CACHE bump + firebase deploy --only hosting"
      via: "scripts/deploy.sh auto-bumps CACHE before deploy + mirrors to queuenight/public/"
      pattern: "couch-v41-couch-groups"
    - from: "30-HUMAN-UAT.md"
      to: "all 8 GROUP-30-* requirements"
      via: "one or more script per requirement; cross-family Family A + Family B device-pair tests"
      pattern: "GROUP-30-0"
---

<objective>
Wave 4 close-out: ship Phase 30 to production. Run the full smoke + rules-test gate one last time, then execute `bash scripts/deploy.sh 41-couch-groups` from couch repo root (auto-bumps sw.js CACHE → `couch-v41-couch-groups` and runs `firebase deploy --only hosting`). Verify the cache string lives at couchtonight.app via curl. Scaffold 30-HUMAN-UAT.md with 10+ device-UAT scripts. Optionally invoke wpMigrate from a signed-in admin browser to backfill any pre-Phase-30 nested wps (or defer per checkpoint decision).

This plan is the final wave of Phase 30. After it lands, the phase is code-complete + production-deployed; the only remaining work is human device-UAT (resume signal `uat passed` → `/gsd-verify-work 30`).

Purpose: Closes the Phase 30 deploy-day gap (Plan 04 shipped client + UI but no cache bump means installed PWAs continue to read the v40 cached shell). Establishes the device-UAT scaffold so the user can run the 10 scripts on their own time and signal completion.

Output: 2 modified files in couch repo + 1 production deploy. The CF deploy already happened in Plan 02 Task 2.5; this plan only handles the hosting + sw.js bump.
</objective>

<execution_context>
@C:/Users/nahde/.claude/get-shit-done/workflows/execute-plan.md
@C:/Users/nahde/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-PATTERNS.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md
@.planning/phases/30-couch-groups-affiliate-hooks/30-04-add-family-affordance-css-flow-PLAN.md
@CLAUDE.md
@sw.js
@scripts/deploy.sh

NOTE: For Phase 30 examples of HUMAN-UAT scaffolds at the right shape, reference .planning/phases/27-guest-rsvp/27-HUMAN-UAT.md (10 scripts, 318+ lines, covers iOS Safari + Android Chrome + privacy footer + name-collision suffix + cache bump verification). Phase 30's UAT scaffold should mirror that structure with Phase 30-specific scenarios.
</context>

<tasks>

<task type="auto">
  <name>Task 5.1: Pre-deploy gate — full smoke aggregate + rules tests must be green</name>
  <files>(none — verification step only)</files>
  <read_first>
    - .planning/STATE.md (current cache: couch-v40-sports-feed-fix; verify nothing has shifted since Plan 04)
    - package.json (full file — verify smoke aggregate runs all 12 contracts including smoke-couch-groups.cjs)
  </read_first>
  <action>
Run the full pre-deploy gate. This catches any regression introduced by Plans 01-04 before the deploy ritual fires.

Execute in this order, halting on any non-zero exit:

```
cd /c/Users/nahde/claude-projects/couch
npm run smoke
```

Expected output: 12 smoke contracts run sequentially; all exit 0. The aggregate ends with `smoke-app-parse: ... passed, 0 failed`. If ANY contract reports failures, STOP and report to the user — the deploy MUST NOT proceed with a red gate.

Then:

```
cd /c/Users/nahde/claude-projects/couch/tests
npm test
```

Expected output: 56 passing tests (52 baseline + 4 Phase 30). If less than 56 passing OR any failures, STOP and report.

If both pass, proceed to Task 5.2.

Defer this task with a STOP if either gate fails. The user must approve a fix-and-retry path before any deploy work runs.
  </action>
  <verify>
    <automated>cd /c/Users/nahde/claude-projects/couch &amp;&amp; npm run smoke &amp;&amp; cd tests &amp;&amp; npm test 2>&amp;1 | grep -E "(passed|56|FAIL)"</automated>
  </verify>
  <acceptance_criteria>
    - `npm run smoke` exits 0 (all 12 contracts green)
    - `cd tests && npm test` exits 0 with EXACTLY 56 passing tests (not 52, not 60 — the count is a tight gate)
    - smoke-couch-groups.cjs reports floor met (production-code count >= 13)
    - smoke-guest-rsvp.cjs reports 47 passing (Phase 27 unchanged regression check — Plan 02 modified rsvpSubmit but the smoke contract validates production-code sentinels which are still present)
    - smoke-app-parse.cjs (the LAST contract in the aggregate) exits 0 — confirms ES module parse integrity for ALL modified JS files in this phase
    - If ANY assertion fails, STOP and surface to user — do NOT proceed to deploy
  </acceptance_criteria>
  <done>
    Full pre-deploy gate green. All 12 smoke contracts pass, all 56 rules tests pass. Plan 05 Task 5.2 (deploy ritual) cleared to fire.
  </done>
</task>

<task type="checkpoint:human-action">
  <name>Task 5.2: Deploy via bash scripts/deploy.sh 41-couch-groups (auto-bumps sw.js + firebase deploy --only hosting)</name>
  <files>sw.js (auto-modified by deploy.sh)</files>
  <read_first>
    - sw.js (current line 8: `const CACHE = 'couch-v40-sports-feed-fix';`)
    - scripts/deploy.sh (full file — verify it accepts a short-tag arg + auto-bumps sw.js CACHE; established Phase 13 / OPS-13-02 pattern)
    - CLAUDE.md (Do/Don't section: bullet "Deploy via `bash scripts/deploy.sh [<short-tag>]` from couch repo root")
  </read_first>
  <what-built>
    - Plan 01 ROADMAP rewrite + REQUIREMENTS registration + indexes.json declaration + smoke + rules-test scaffolds
    - Plan 02 2 new CFs + rsvpSubmit Pitfall 5 fix + firestore.rules top-level block + 4 real rules tests + cross-repo deploy of CFs/rules/indexes
    - Plan 03 client subscription shift + wp doc shape + buildNameCollisionMap + cross-family chip render
    - Plan 04 Bring another couch in UI affordance + 4-state machine + ~140 lines CSS + remove-couch flow
    - Plan 05 Task 5.1 pre-deploy gate (full smoke + rules tests green)
  </what-built>
  <how-to-verify>
    Step 1 — From couch repo root, run the deploy script:
    ```
    cd /c/Users/nahde/claude-projects/couch
    bash scripts/deploy.sh 41-couch-groups
    ```

    The script will:
    - Bump sw.js CACHE from `couch-v40-sports-feed-fix` to `couch-v41-couch-groups`
    - Auto-stamp BUILD_DATE
    - Mirror files to queuenight/public/ (deploy-mirror sibling)
    - Run `firebase deploy --only hosting` against the queuenight/ project
    - Output deploy URL

    Step 2 — Verify the cache string is live at couchtonight.app:
    ```
    curl -s https://couchtonight.app/sw.js | grep "const CACHE"
    ```
    Expected output: `const CACHE = 'couch-v41-couch-groups';`

    Step 3 — Confirm sw.js source matches:
    ```
    grep "const CACHE" /c/Users/nahde/claude-projects/couch/sw.js
    ```
    Expected: same line, `couch-v41-couch-groups`.

    Step 4 — Optionally trigger wpMigrate CF to backfill pre-Phase-30 wps. From a signed-in browser console at https://couchtonight.app/app:
    ```js
    const fn = firebase.functions().httpsCallable('wpMigrate');
    const r = await fn();
    console.log(r.data); // expect { ok:true, copied:N, skipped:M, invalid:0, total:N+M }
    ```
    OR defer this if the user prefers to wait until existing wps naturally archive (25h WP_ARCHIVE_MS window) and let new wps live at top-level natively. Either path is acceptable; document the choice in the resume signal.

    Resume signals:
    - Type `deploy ok` — production live with couch-v41-couch-groups + curl-verified.
    - Type `deploy ok migrate-deferred` — same but wpMigrate not invoked (acceptable; new wps go top-level natively, old nested wps fade out within 25h)
    - Type `deploy ok migrated <N>` — wpMigrate invoked successfully, copied N wps
    - Type `failed: <details>` — deploy failed; investigate and re-run

    Common failure modes:
    - Stale .firebaserc in queuenight/ (fix: `cd /c/Users/nahde/queuenight && firebase use queuenight-84044`)
    - sw.js CACHE bump skipped because the script's regex didn't match (fix: hand-edit sw.js line 8 to `const CACHE = 'couch-v41-couch-groups';` then re-run with `--allow-dirty 41-couch-groups`)
    - Hosting deploy succeeded but cache bump didn't propagate — installed PWAs may continue to read v40 until next online activation; this is normal SW behavior and not a deploy failure
  </how-to-verify>
  <resume-signal>Type "deploy ok" OR "deploy ok migrate-deferred" OR "deploy ok migrated N" OR "failed: ..."</resume-signal>
  <acceptance_criteria>
    - `grep "const CACHE" /c/Users/nahde/claude-projects/couch/sw.js` returns `const CACHE = 'couch-v41-couch-groups';`
    - `curl -s https://couchtonight.app/sw.js | grep "const CACHE"` returns the same string (production live)
    - The user has explicitly typed one of the resume signals above (deploy not silent-succeeded)
    - If migrate-deferred or migrated, the choice is documented for the SUMMARY
  </acceptance_criteria>
  <done>
    Phase 30 LIVE in production at couchtonight.app with cache bumped to couch-v41-couch-groups. All 8 GROUP-30-* requirements at code-complete + deployed status (HUMAN-VERIFY pending UAT).
  </done>
</task>

<task type="auto">
  <name>Task 5.3: Scaffold 30-HUMAN-UAT.md with 10+ device-UAT scripts</name>
  <files>.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md</files>
  <read_first>
    - .planning/phases/27-guest-rsvp/27-HUMAN-UAT.md (full file — exact analog scaffold; 10 scripts, ~318 lines, covers iOS + Android + collision-suffix + cache-bump verification scripts; mirror this structure for Phase 30)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-CONTEXT.md (locked decisions D-04..D-09 — UAT must verify each is honored at the user surface)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-RESEARCH.md (Pitfalls 1, 2, 5, 6, 7 — UAT must verify each pitfall is mitigated end-to-end)
    - .planning/phases/30-couch-groups-affiliate-hooks/30-UI-SPEC.md (Copywriting Contract + Interaction Contracts — UAT scripts assert the locked copy renders verbatim)
  </read_first>
  <action>
Create `.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md`. Follow the structure of `27-HUMAN-UAT.md` (read it as the analog template). Cover at LEAST 10 scripts. The 10 minimum scripts:

1. **Cross-family invite happy path (GROUP-30-01 + GROUP-30-02 + GROUP-30-03)** — Family A host (Device 1) creates a wp, opens the Bring another couch in section, pastes Family B's code, taps Bring them in. Verify: Couch added toast at --good appears; Family B's family-display-name appears in .wp-couches-list. On Device 2 (Family B member, signed in), open Tonight tab; verify the wp banner appears within ~5s. Open the wp on Device 2; verify Family A members visible in roster with real names + avatars.

2. **Soft-cap warning at 5+ families (GROUP-30-05)** — Family A host adds 4 families (uses 4 different test family codes; if test family-codes don't exist, skip with note "needs Family B/C/D/E test accounts"). After the 5th add succeeds, verify section sub-line text changes to *"That's a big couch — are you sure?"* in italic at --warn color.

3. **Hard-cap rejection at 8 families (GROUP-30-05)** — Continue from #2; add families 6, 7, 8. After the 8th add succeeds, verify the input row + Bring them in button HIDE; sub-line changes to *"This couch is full for tonight."* Attempting any further add via console call shows toast `No more room on this couch tonight.`

4. **Cross-family name collision suffix (GROUP-30-04 + Pitfall 6)** — Family A has a member named Sam. Family B also has a member named Sam. Family C has a member named Sam. Host adds Family B then Family C to the wp. Open wp on any device; verify roster shows: Sam (host's family member; no suffix) AND Sam (Smiths) AND Sam (Joneses) — italic Instrument Serif at --ink-dim color.

5. **Within-family collision does NOT trigger suffix (Pitfall 6)** — Family A has TWO members named Sam (rare but possible). Family A host creates a wp WITHOUT inviting any other family. Open the wp; verify roster shows two Sam chips with NO suffix on either (Pitfall 6 same-family suppression).

6. **Host-only invite gate (GROUP-30-06)** — Sign in as a non-host Family A member on Device 2. Open a wp where you are NOT the host. Verify: .wp-couches-list IS visible (D-06 transparency) but the input row + Bring them in button + per-row kebabs are HIDDEN.

7. **Cross-family read denied for stranger (GROUP-30-07)** — Sign in as a member of Family X (a third family NOT invited to the cross-family wp). Open Tonight tab; verify the wp banner does NOT appear in the subscription. Attempt direct URL access (if your app surfaces a per-wp deep link); verify access denied.

8. **Guest RSVP works for top-level wp (Pitfall 5 mitigation)** — From a wp created post-Phase-30 (top-level), copy the rsvp/<token> link. Open in an incognito browser (non-Couch user). Verify: RSVP form loads (NOT the expired error); submit a Yes RSVP; verify wp.guests[] gets the entry on Device 1's host roster.

9. **Cache bump activation (CACHE = couch-v41-couch-groups)** — On a device that had the app cached BEFORE deploy: open the app, observe whether sw.js auto-revalidates and the new CACHE activates. May require closing and reopening the PWA. Verify in DevTools > Application > Service Workers that the active SW source contains `couch-v41-couch-groups`.

10. **Existing wp regression check (GROUP-30-08)** — Find a wp created BEFORE Phase 30 deploy (one of yours from Phase 27 or 26). If you ran wpMigrate, verify it appears in the new top-level subscription with full functionality. If migrate-deferred, verify it remains accessible via direct deep-link (the legacy nested rules block is still in firestore.rules per Plan 02).

11. **Residual read access post-Remove this couch (W5 fix — known v1 limitation; Threat T-30-14 in Plan 04)** — Setup: Family A host invites Family B to a wp; Family B member opens the wp on Device 2 (confirm visible). On Device 1, Family A host clicks the kebab next to Family B in `.wp-couches-list` → confirms "Yes, remove them". Expected immediately: Family B chip disappears from `.wp-couches-list` AND from `.crossFamilyMembers` roster on Device 1's view; toast `Removed the {FamilyName} couch.` appears at --good. Now check Device 2 (Family B member): the wp doc itself remains readable via direct doc fetch until the natural 25h archive (`WP_ARCHIVE_MS`) — their `request.auth.uid` is still in `wp.memberUids[]` per the v1 trade-off documented inline in `onClickRemoveCouch` (Plan 04 Task 4.2) and as Threat **T-30-14: Residual read access — ACCEPT (v1)**. Pass criteria: (a) UI hides the family from roster on Device 1 immediately; (b) Device 2 can STILL open the wp via the direct deep-link or whatever subscription path their client uses, until the natural 25h wp archive; (c) document this as the known v1 limitation — DO NOT mark it as a bug. **If usage signal warrants** in a follow-up phase (e.g., Phase 30.x), a transactional `memberUids` prune can be added; until then, this is the accepted v1 behavior.

**Pitfall reference:** none (this is a v1 known trade-off, not a research pitfall — but it relates to Plan 04 onClickRemoveCouch inline trade-off comment and threat T-30-14)

**Decision reference:** Plan 04 threat model T-30-14 (ACCEPT disposition)

For each script, structure as:

```markdown
### Script N: <Title> (<requirement IDs>)

**Goal:** <what we're verifying>

**Setup:**
- Device 1: <description>
- Device 2: <description>
- Test data: <accounts, family codes>

**Steps:**
1. <step 1>
2. <step 2>
3. ...

**Pass criteria:**
- <observable behavior 1>
- <observable behavior 2>

**Pitfall reference:** <RESEARCH.md Pitfall N> (if applicable)

**Decision reference:** <CONTEXT.md D-NN> (if applicable)
```

Aim for ~80+ lines total. Mirror 27-HUMAN-UAT.md's prose style (direct, second-person voice, observation-anchored).

The file lives at `.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md` regardless of any future directory rename (D-03 defers the rename indefinitely).
  </action>
  <verify>
    <automated>test -f .planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md &amp;&amp; [ "$(grep -c '^### Script' .planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md)" -ge 11 ] &amp;&amp; [ "$(wc -l &lt; .planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md)" -ge 90 ]</automated>
  </verify>
  <acceptance_criteria>
    - File exists at `.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md`
    - `grep -c "^### Script" 30-HUMAN-UAT.md` returns AT LEAST 11 (10 original + 1 W5 follow-on residual-read-access script)
    - File has AT LEAST 90 lines (mirrors Phase 27/26 scaffolds; raised from 80 in revision to accommodate the W5 follow-on script)
    - Every GROUP-30-XX requirement is referenced in at least one script's title or body
    - At least 3 RESEARCH.md Pitfalls referenced (Pitfall 5, 6, 7 minimum)
    - At least 3 CONTEXT.md decisions referenced (D-06, D-08, D-09 minimum)
    - Script 9 (Cache bump activation) explicitly mentions `couch-v41-couch-groups`
    - Script 1 covers cross-family invite end-to-end (the hero path)
    - **W5 fix — Script 11 covers residual read access:** `grep -q "Residual read access" 30-HUMAN-UAT.md` returns 0 AND `grep -q "T-30-14" 30-HUMAN-UAT.md` returns 0 (cross-references the Plan 04 threat T-30-14 by ID for traceability)
    - **W5 fix — Script 11 documents the v1 known limitation:** `grep -q "v1 known limitation" 30-HUMAN-UAT.md` returns 0
  </acceptance_criteria>
  <done>
    30-HUMAN-UAT.md scaffold complete with 10+ device-UAT scripts. User can run on their own time; resume signal `uat passed` triggers `/gsd-verify-work 30`. Phase 30 deliverable ready for HUMAN-VERIFY status.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Source-tree sw.js -> production sw.js | Deploy script is the trust boundary; CACHE bump must propagate or installed PWAs continue serving v40 cached shell |
| wpMigrate invocation -> wp doc backfill | Optional; if invoked, runs as the calling user's signed-in admin client; CF bypasses rules via admin-SDK; idempotent on re-run |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-30-14 | Tampering | sw.js CACHE bump skipped | mitigate | Task 5.2 acceptance criterion verifies `curl -s https://couchtonight.app/sw.js | grep "const CACHE"` returns the new string post-deploy. If mismatched, the executor flags "failed" and re-runs deploy.sh with `--allow-dirty 41-couch-groups` after hand-editing sw.js. |
| T-30-15 | Information Disclosure | wpMigrate exposes wp data | accept | Migration writes top-level wp docs that are then gated by Plan 02 rules (`request.auth.uid in resource.data.memberUids`). The migration itself doesn't surface any data to the migrating user beyond what they already had access to (their own family's wps). |
| T-30-16 | Denial of Service | Production deploy fails mid-flight | mitigate | deploy.sh is idempotent — re-running it is safe. firebase deploy is also idempotent. The user can roll back via `firebase hosting:rollback` from queuenight repo if needed (documented in the resume-signal failure branch). |
</threat_model>

<verification>
1. Pre-deploy gate (Task 5.1): `npm run smoke` exits 0; `cd tests && npm test` exits 0 with 56 passed
2. Post-deploy (Task 5.2):
   - `grep "const CACHE" sw.js` returns `'couch-v41-couch-groups'`
   - `curl -s https://couchtonight.app/sw.js | grep "const CACHE"` returns the same string
   - User explicitly confirms `deploy ok` (or migrate variants)
3. UAT scaffold (Task 5.3): file exists with 10+ scripts, 80+ lines
4. State.md update (handled in 30-05-SUMMARY.md generation): cache value updated, all 8 GROUP-30-* IDs marked `Complete — HUMAN-VERIFY pending`, follow-up entry added for 30-HUMAN-UAT.md
</verification>

<success_criteria>
- Production deploy successful: couchtonight.app serves CACHE = couch-v41-couch-groups
- Pre-deploy gate green: 12 smoke contracts + 56 rules tests
- 30-HUMAN-UAT.md scaffolded with 10+ device-UAT scripts covering all 8 requirements + 3+ pitfalls + 3+ decisions
- Optional: wpMigrate invoked OR explicitly deferred (documented either way)
- Phase 30 marked code-complete + deployed in STATE.md (handled in SUMMARY)
- All 8 GROUP-30-* requirements: status updates from Pending to `Complete — HUMAN-VERIFY pending` in REQUIREMENTS.md (handled in SUMMARY)
- Resume signal: `uat passed` (after device-UAT) → `/gsd-verify-work 30`
</success_criteria>

<output>
After completion, create `.planning/phases/30-couch-groups-affiliate-hooks/30-05-SUMMARY.md` documenting:
- 2 modified files in couch (sw.js auto-bumped + 30-HUMAN-UAT.md scaffold)
- Deploy outcome: cache string + curl-verified live URL + timestamp
- wpMigrate decision (invoked-N OR migrate-deferred) and rationale
- All 8 GROUP-30-* requirements transitioned from Pending to Complete (HUMAN-VERIFY pending)
- Phase 30 phase-close summary: 5 plans across 4 waves, ~N atomic commits across couch + queuenight repos
- Cache version: couch-v41-couch-groups (curl-verified)
- requirements_completed: ALL 8 GROUP-30-01..08
- Resume signal: `uat passed` after running 30-HUMAN-UAT.md scripts → `/gsd-verify-work 30`

ALSO update REQUIREMENTS.md (in Plan 05's commit batch):
- Flip all 8 GROUP-30-* rows from `Pending — Wave N (...)` to `Complete — HUMAN-VERIFY pending (cache: couch-v41-couch-groups; deployed YYYY-MM-DD; smoke FLOOR=13; rules-tests 56 PASS)`

ALSO update STATE.md (in Plan 05's commit batch):
- Update `## sw.js cache version` to `couch-v41-couch-groups` with deploy timestamp
- Add Phase 30 row to "Recent shipped phases" table
- Move "Current Position" to next phase (or v1-commercial-release milestone close, depending on roadmap)
- Add Phase 30 HUMAN-VERIFY follow-up to "Open follow-ups" table

ALSO update ROADMAP.md Progress table row for Phase 30 from `0/5` to `5/5` with `**SHIPPED YYYY-MM-DD**` status text.
</output>
