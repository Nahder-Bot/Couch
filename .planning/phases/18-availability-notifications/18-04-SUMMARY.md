---
phase: 18-availability-notifications
plan: 04
subsystem: infra
tags: [deploy, sw-cache, cross-repo, firebase, cloud-functions, scheduled-cf, push-notifications, uat]

# Dependency graph
requires:
  - phase: 18-availability-notifications
    provides: Plan 18-01 (queuenight providerRefreshTick CF + helpers + titleAvailable in NOTIFICATION_DEFAULTS), Plan 18-02 (couch client mirror + manual refresh polish), Plan 18-03 (smoke-availability gate wired into deploy.sh)
  - phase: 15.4-integration-polish
    provides: deploy.sh §2.5 smoke-gate scaffold + cross-repo deploy ritual precedent
provides:
  - sw.js CACHE bumped to couch-v36-availability-notifs (live at couchtonight.app)
  - queuenight functions deployed — providerRefreshTick scheduled CF live in us-central1 (v2/scheduled/nodejs22/256MB)
  - couch hosting deployed — Plan 18-02 client mirror + Plan 18-03 smoke gate live at couchtonight.app
  - TMDB_KEY env var added to queuenight/functions/.env (was missing — Rule 2 auto-fix)
  - Cross-repo deploy ordering preserved per RUNBOOK §H + D-21 (queuenight FIRST, couch SECOND)
  - All Plan 18 server + client wiring END-TO-END LIVE pending UAT
affects: [Phase 18 verification (UAT pending), 7-day Sentry soak window, 30-day opt-out analytics]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Public-by-design API key alignment — TMDB_KEY shipped client-side AND server-side from same value (per CLAUDE.md)"
    - "v2 onSchedule auto-creates Cloud Scheduler job at deploy time (no separate gcloud step needed for v2 API)"

key-files:
  created:
    - .planning/phases/18-availability-notifications/18-04-SUMMARY.md
  modified:
    - sw.js (CACHE constant bumped — line 8)
    - C:/Users/nahde/queuenight/functions/.env (added TMDB_KEY — gitignored, deploy-runtime only)

key-decisions:
  - "Auto-fix TMDB_KEY pre-deploy (Rule 2) — public-by-design key, missing env var would short-circuit CF on every tick. Adding before deploy ensures first daily tick has working env-var, not after-the-fact patch."
  - "Plan acceptance noted 46 rules tests as the pre-flight count, but actual suite ran 43 passing — no regression, just count drift since the plan was authored. Documented for transparency."
  - "gcloud CLI not installed locally — UAT 3 manual trigger (Path A) requires either gcloud install OR Firebase Console scheduler-page click OR 24h soak (Path B). Surfaced in checkpoint."
  - "Cross-repo deploy ordering followed (queuenight FIRST at 22:48Z, couch SECOND at 22:50Z) per D-21 — no failure window where new clients show titleAvailable toggle but no CF exists."

patterns-established:
  - "Pre-deploy env-var sanity check — verify all process.env.* vars referenced by new CFs are present in functions/.env before firebase deploy. The Plan 18-04 case-study: Plan 18-01 added process.env.TMDB_KEY references; Plan 18-04 caught + fixed the missing var pre-deploy. Should be a deploy.sh §0.5 gate at some future cleanup."

requirements-completed: [REQ-18-09, REQ-18-10]
# REQ-18-01..REQ-18-08 require UAT confirmation in Task 4 — completion gated on user verification.
# REQ-18-09 (sw.js CACHE bump) + REQ-18-10 (cross-repo deploy ordering) are CODE-COMPLETE here.

# Metrics
duration: 4min
completed: 2026-04-29
---

# Phase 18 Plan 04: Cache Bump + Cross-Repo Deploy + UAT Surface Summary

**Phase 18 fully deployed cross-repo at v36-availability-notifs — providerRefreshTick CF live in us-central1 + couch hosting live at couchtonight.app, UAT pending user verification on real devices.**

## Performance

- **Duration:** 4 min (deploy time dominates — actual code change was 1 line in sw.js)
- **Started:** 2026-04-29T22:46:12Z
- **Completed (Tasks 1-3):** 2026-04-29T22:50:41Z
- **UAT:** Pending (Task 4 checkpoint:human-verify)
- **Tasks:** 3 of 4 complete (Task 4 awaits user UAT)
- **Files modified:** 1 source (sw.js) + 1 deploy-runtime (queuenight/functions/.env)

## Accomplishments

- **Task 1 — sw.js CACHE bump:** `couch-v35.6-integration-polish` → `couch-v36-availability-notifs`. Single-line edit, node --check passes, exactly one CACHE declaration.
- **Task 2 — queuenight functions deploy:** providerRefreshTick **CREATED** in us-central1 (first deploy of Plan 18-01's CF). All 25 other CFs UPDATED successfully — no regressions. titleAvailable now in deployed NOTIFICATION_DEFAULTS server-side, gating sendToMembers eventType-flow per REQ-18-04.
- **Task 3 — couch hosting deploy:** All 3 smoke contracts pass (positionToSeconds + matches/considerable + availability), 43-passing rules emulator suite passes, mirror copied + BUILD_DATE stamped + Sentry DSN guard passed, hosting deploy "Deploy complete!". Live cache + HTTP 200 + real Sentry DSN curl-verified.
- **Cross-repo deploy ordering:** queuenight FIRST (22:48Z) → couch SECOND (22:50Z). No failure window where new clients see titleAvailable toggle without backend CF support (D-21 mitigated).

## Task Commits

Each task was committed atomically (where source changed):

1. **Task 1: Bump sw.js CACHE to couch-v36-availability-notifs** — `adcebfc` (chore)
2. **Task 2: Deploy queuenight functions FIRST** — *deploy event, no source code commit (queuenight Plan 18-01 changes were already committed at d622dc6 from prior plan)*
3. **Task 3: Deploy couch hosting SECOND via scripts/deploy.sh** — *deploy event, no source code commit (sw.js bump committed in Task 1)*
4. **Task 4: UAT** — pending user verification (checkpoint:human-verify)

**Plan metadata:** [pending — final commit after UAT pass OR appended on this final commit]

## Deploy Events

### queuenight functions deploy (Task 2)

**Command:** `cd ~/queuenight && firebase deploy --only functions --project queuenight-84044`

**Result (UTC 2026-04-29T22:48):**
- `functions[providerRefreshTick(us-central1)] Successful create operation` — NEW v2/scheduled/nodejs22/256MB
- 25 other CFs: Successful update operation (no regressions)
- "Deploy complete!"

**functions:list confirmation:**

```
providerRefreshTick   v2   scheduled   us-central1   256   nodejs22
```

Sits alongside the 3 prior production scheduled CFs (accountDeletionReaper, rsvpReminderTick, watchpartyTick) — same v2 schedule architecture.

**Cloud Scheduler job:** Auto-created at deploy time by firebase v2 onSchedule API binding. Cannot be verified via gcloud locally (gcloud CLI not installed on this Windows machine — see Deviation 2). Verifiable via Firebase Console → Functions → providerRefreshTick → Triggers tab.

**Outstanding warnings (non-blocking, deferred):**
- TD-1: firebase-functions SDK 4.9.0 → 5.1.0+ migration warning (deferred to a future plan)

### couch hosting deploy (Task 3)

**Command:** `cd ~/claude-projects/couch && bash scripts/deploy.sh 36-availability-notifs`

**Pipeline result (UTC 2026-04-29T22:50):**

| Stage | Result |
| --- | --- |
| §1 dirty-tree gate | PASS (clean tree) |
| §2 tests/npm test | PASS (43 passing, 0 failing — rules emulator suite) |
| §2 node --check on shipping JS | PASS |
| §2.5 smoke gate (3 contracts) | PASS — `Smoke contracts pass (positionToSeconds + matches/considerable + availability).` |
| §3 mirror existence check | PASS (legacy queuenight/ path used; rename to couch-deploy/ pending) |
| §4 sw.js CACHE bump | NO-OP (`sw.js CACHE already at couch-v36-availability-notifs; skipping bump.` — Task 1 set it) |
| §5 mirror to public/ | PASS (8 root + 3 css + 8 js files copied) |
| §6 BUILD_DATE auto-stamp in mirror | PASS (`Stamped BUILD_DATE -> 2026-04-29 in deploy mirror only`) |
| §7 Sentry DSN placeholder guard | PASS |
| §8 firebase deploy --only hosting | PASS — "Deploy complete!", 61 files uploaded |
| §9 post-deploy curl smoke | PASS (HTTP 200 + `const CACHE = 'couch-v36-availability-notifs';`) |

**Live verification curls (post-deploy):**

```
$ curl -s https://couchtonight.app/sw.js | grep -c "couch-v36-availability-notifs"
1

$ curl -sI https://couchtonight.app/app | head -1
HTTP/1.1 200 OK

$ curl -s https://couchtonight.app/app | grep -oE 'sentry\.io/[0-9]+' | head -1
sentry.io/4511281871454208
```

All three checks pass. couchtonight.app is live at v36-availability-notifs.

## Files Created/Modified

- `sw.js` — CACHE constant bumped (line 8): `couch-v35.6-integration-polish` → `couch-v36-availability-notifs`
- `C:/Users/nahde/queuenight/functions/.env` — added `TMDB_KEY=2ec1f3699afc80f35392f5a674eb9da3` (Rule 2 auto-fix; gitignored, deploy-runtime only — same public-by-design key as couch js/constants.js)
- `.planning/phases/18-availability-notifications/18-04-SUMMARY.md` — this file

## Decisions Made

1. **Auto-fix missing TMDB_KEY (Rule 2):** Plan 18-04 Task 2 step 6 anticipated "TMDB_KEY missing" as a non-blocking flag; Rule 2 elevated it to pre-deploy fix because (a) the key is public-by-design per CLAUDE.md "Don't move TMDB key... server-side" — but it's already client-side public; (b) leaving it missing would mean the first daily tick (and every tick until manually fixed) short-circuits with `[18/providerRefreshTick] TMDB_KEY env var unset — skipping tick`, defeating REQ-18-01..REQ-18-02 silently.

2. **Defer scheduler-job verification to UAT (gcloud unavailable):** gcloud CLI is not installed on this Windows machine. firebase functions:list confirms providerRefreshTick is bound to a scheduled trigger (v2/scheduled), which is sufficient evidence the scheduler job was auto-created. UAT 3 Path A (manual trigger) will need either gcloud install OR Firebase Console scheduler-page click OR 24h Path B soak.

3. **No queuenight commit in this plan:** Plan 18-01's queuenight code changes were already committed at `d622dc6` on `main` per the prior plan's SUMMARY. No queuenight source changes occurred in Plan 18-04 — the `.env` file is gitignored. The two-repo discipline check passes (no uncommitted code-source edits left dangling).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added TMDB_KEY to queuenight/functions/.env**

- **Found during:** Task 2 pre-flight step 6 (env-var presence check)
- **Issue:** queuenight/functions/.env was missing the `TMDB_KEY=` line. Without it, providerRefreshTick CF deploys successfully but every scheduled tick logs `[18/providerRefreshTick] TMDB_KEY env var unset — skipping tick` and returns no-op — defeating REQ-18-01 + REQ-18-02 silently in production.
- **Fix:** Appended `TMDB_KEY=2ec1f3699afc80f35392f5a674eb9da3` to queuenight/functions/.env. Same value as couch/js/constants.js (public-by-design key per CLAUDE.md).
- **Files modified:** C:/Users/nahde/queuenight/functions/.env (gitignored — deploy-runtime baking only)
- **Verification:** `firebase deploy --only functions` output `Loaded environment variables from .env.` confirms the env file was picked up. CF first-tick will now have working TMDB_KEY.
- **Committed in:** Not committed (.env is gitignored) — captured in this SUMMARY for audit trail.

**2. [Note - Documentation drift] Plan stated 46 rules tests, actual suite is 43**

- **Found during:** Task 3 deploy.sh §2 tests/npm test stage
- **Issue:** Plan 18-04 acceptance criteria text references "existing 46 rules tests" (inherited from Plan 18-04 frontmatter); actual current rules.test.js suite reports `43 passing, 0 failing`.
- **Fix:** None needed — the gate is "tests pass," not "exact count." Documenting drift here so future plans don't compound the count error.
- **Verification:** All 43 tests pass with 0 failures, including new test #41-43 that cover Plan 15.4 couchPings rules.
- **Committed in:** N/A (documentation note only)

**3. [Note - Tooling gap] gcloud CLI not installed on local Windows machine**

- **Found during:** Task 2 step 4 verification (gcloud functions describe + scheduler jobs list)
- **Issue:** Plan 18-04 Task 2 step 4 + Task 4 UAT 3 Path A both reference gcloud commands. gcloud is not on PATH on this Windows machine (`which gcloud` → no gcloud).
- **Fix:** Substitute firebase CLI verification (firebase functions:list confirms scheduled binding). For UAT 3 manual trigger, recommend Firebase Console workflow OR gcloud SDK install OR Path B (24h soak).
- **Verification:** firebase functions:list shows `providerRefreshTick   v2   scheduled   us-central1` — sufficient evidence of scheduler binding.
- **Committed in:** N/A (environment note)

---

**Total deviations:** 1 auto-fix (Rule 2 missing critical env var) + 2 documentation/environment notes
**Impact on plan:** Auto-fix necessary for REQ-18-01/02 correctness in production. Documentation/environment notes don't affect execution; surfaced for transparency. No scope creep.

## Issues Encountered

None during the deploy itself. Both deploys ran cleanly first try.

## TMDB_KEY env var status

✅ **Resolved pre-deploy.** `TMDB_KEY=2ec1f3699afc80f35392f5a674eb9da3` now present in queuenight/functions/.env (line 7). Same key as couch/js/constants.js TMDB_KEY. Picked up by firebase v2 onSchedule deploy and baked into runtime config.

## Phase 18 requirement closure status

| ID | Status | Evidence |
| --- | --- | --- |
| REQ-18-01 daily refresh CF | DEPLOYED — UAT pending | providerRefreshTick CREATED in us-central1; needs first-tick verification (manual gcloud trigger OR 24h soak) |
| REQ-18-02 newly-watchable push | DEPLOYED — UAT pending | titleAvailable in NOTIFICATION_DEFAULTS server-side; sendToMembers eventType-gate live; needs real-device push delivery test |
| REQ-18-03 manual refresh affordance | DEPLOYED — UAT pending | Plan 18-02 client changes live: '↻ Refresh availability' label + 'Provider data via TMDB' footnote + flashToast + lastProviderRefreshAt write |
| REQ-18-04 'Newly watchable' Settings toggle | DEPLOYED — UAT pending | Plan 18-02 client mirror live across 5 maps; Plan 18-01 server NOTIFICATION_DEFAULTS live; needs UI render verification on real device |
| REQ-18-05 per-event opt-out suppression | DEPLOYED — UAT pending | Existing eventType-gate at sendToMembers; needs end-to-end opt-out test |
| REQ-18-06 system push (no sender) | DEPLOYED — UAT pending | Self-echo guard logically n/a; needs verification no spurious push to sender |
| REQ-18-07 quiet-hours respected | DEPLOYED — UAT pending | Existing isInQuietHours inherited; UAT 5 optional smoke |
| REQ-18-08 TMDB rate-limit handling | DEPLOYED — UAT pending | 429 detection in providerRefreshTick aborts remainder of tick; verifiable via Sentry soak (no immediate UAT) |
| REQ-18-09 sw.js CACHE bump | ✅ CLOSED | sw.js source bumped (Task 1); live verification: `curl -s https://couchtonight.app/sw.js \| grep CACHE` returns `couch-v36-availability-notifs` |
| REQ-18-10 cross-repo deploy ordering | ✅ CLOSED | queuenight functions deployed at 22:48Z (Task 2); couch hosting deployed at 22:50Z (Task 3); 2-minute window between, ordering preserved |

## Next: UAT (Task 4 — checkpoint:human-verify)

Phase 18 ships END-TO-END pending real-device UAT. See checkpoint message returned to orchestrator for full UAT instructions (Settings UI smoke + manual refresh affordance smoke + simulated CF tick smoke + opt-out smoke).

**Resume signal:** "uat passed" → Phase 18 fully shipped, trigger /gsd-verify-work 18.

If any UAT script fails, paste the failure mode and we triage gap-closure (new plan 18-05) vs. rollback.

## Post-deploy soak commitments

- **7-day Sentry soak** for [18/providerRefreshTick] error breadcrumbs. TMDB 429 spikes past 1 day → reduce per-tick cap from 50.
- **30-day usage analytics** on titleAvailable opt-out rate. If opt-out >30% (RESEARCH risk 2), revisit cadence or threshold per Deferred Ideas.

## Self-Check: PASSED

**Files verified:**
- `C:/Users/nahde/claude-projects/couch/sw.js` line 8 contains the new CACHE — FOUND
- `C:/Users/nahde/claude-projects/couch/.planning/phases/18-availability-notifications/18-04-SUMMARY.md` — FOUND (this file)
- `C:/Users/nahde/queuenight/functions/.env` line 7 contains TMDB_KEY — FOUND

**Commits verified:**
- `adcebfc` (Task 1 sw.js CACHE bump) — FOUND in couch git log

**Live deploys verified:**
- couchtonight.app/sw.js returns `const CACHE = 'couch-v36-availability-notifs';` — VERIFIED
- couchtonight.app/app returns HTTP/1.1 200 OK — VERIFIED
- queuenight functions:list shows `providerRefreshTick v2 scheduled us-central1` — VERIFIED

---
*Phase: 18-availability-notifications*
*Completed (deploy half): 2026-04-29*
*UAT: pending user verification*
