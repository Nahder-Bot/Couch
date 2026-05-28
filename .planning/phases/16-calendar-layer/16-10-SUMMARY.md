---
phase: 16-calendar-layer
plan: 10
subsystem: infra
tags: [deploy, smoke-gate, firestore-rules-tests, sw-cache, requirements-traceability, cross-repo-deploy]

# Dependency graph
requires:
  - phase: 16-calendar-layer / 16-01..16-09
    provides: "All Phase 16 source: firestore.rules + indexes (16-01); computeNextFireAt helper (16-02); watchpartySeriesTick CF + idempotency smoke (16-03); seriesReminder push + DR-3 (16-04); Account-tab list + lifecycle (16-05); Tonight CTA + create modal + DoW picker (16-06); in-place edit modal (16-07); Entry 2 post-wp tile (16-08); week-view modal (16-09)"
provides:
  - "12 emulator rules tests for /watchpartySeries (#16-01..#16-12) added to tests/rules.test.js"
  - "3 Phase 16 smoke contracts registered in scripts/deploy.sh §2.5 catch-up gate (smoke-series-cadence-compute + smoke-series-materializer + smoke-series-idempotency)"
  - "sw.js CACHE bumped to couch-v16-calendar (auto-bumped via bash scripts/deploy.sh 16-calendar at deploy time; pre-deploy belt-and-suspenders source value was couch-v49-phase-16-calendar)"
  - "16-HUMAN-UAT.md scaffold with 7 device-UAT scripts (6 mandatory + 1 informational DST)"
  - "REQUIREMENTS.md CAL-16-* block with 15 IDs + 15 traceability rows + Coverage refresh 249→264 total"
  - "Cross-repo deploy executed: indexes → CFs → rules → hosting; watchpartySeriesTick now live + watchpartyTick updated with reminder branch"
affects: [Phase 17 (App-Store launch readiness — now unblocked pending user-side ASC screenshot + Namecheap press@ gates), all future phases (smoke gate now 15 contracts, includes Phase 16 sentinels)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave-9 close-out canonical structure: rules tests + smoke registration + sw.js bump + HUMAN-UAT scaffold + REQUIREMENTS block + cross-repo deploy (mirrors Phase 28 + Phase 31 close-outs)"
    - "Pending → Complete deferral convention for REQUIREMENTS.md status flips (per Phase 15.6 + 31-05 precedent; future audit-trail backfill handles flip)"

key-files:
  created:
    - ".planning/phases/16-calendar-layer/16-HUMAN-UAT.md"
    - ".planning/phases/16-calendar-layer/16-10-SUMMARY.md"
  modified:
    - "tests/rules.test.js"
    - "scripts/deploy.sh"
    - "sw.js"
    - ".planning/REQUIREMENTS.md"

key-decisions:
  - "Picked sw.js CACHE pre-deploy value couch-v49-phase-16-calendar (next-sequential after v48-marketing-refresh from Phase 31). Auto-bump on bash scripts/deploy.sh 16-calendar OVERRODE it to couch-v16-calendar at deploy time — manual edit was belt-and-suspenders."
  - "Skipped use of --sync-rules flag because indexes-sync needed manual hand-mirroring (deploy.sh has rules-sync flag but no indexes-sync). Ran indexes deploy from queuenight directly after manual cp."
  - "watchpartySeriesTick deployed as v2 nodejs22 scheduled function (us-central1, 256MiB, every 6 hours per Plan 16-03). Successful CREATE op — first deployment of this CF."
  - "Rules + indexes sourced from couch repo, deployed from queuenight (mirror has firebase.json). Auto-mirror commit in queuenight: chore(rules+indexes): auto-mirror couch Phase 16 ..."

patterns-established:
  - "Phase 16 smoke contracts registered BEFORE smoke-app-parse (foundation gate stays LAST) — preserves existing ordering convention from Phase 28 + 27 + 26"
  - "12 rules-test cases (#16-01..#16-12) cover all 4 rules branches with READ (2) + CREATE (5) + UPDATE (4) + DELETE (1) sub-branches"

requirements-completed: [CAL-16-14]

# Metrics
duration: 24min
completed: 2026-05-28
---

# Phase 16 / Plan 10: Calendar Layer Close-out Summary

**Phase 16 SHIPPED to production: 12 rules tests + 3 smoke contracts + 15 CAL-16-* requirements + 7 HUMAN-UAT scripts + full cross-repo deploy (indexes/CFs/rules/hosting); watchpartySeriesTick CF live; sw.js CACHE = couch-v16-calendar at couchtonight.app**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-05-28T01:00:00Z (approx)
- **Completed:** 2026-05-28T01:24:00Z (approx)
- **Tasks:** 4/4
- **Files modified:** 5 (4 modified + 1 created)
- **Commits (couch):** 4 atomic task commits + 1 deploy auto-bump = 5 total
- **Commits (queuenight):** 1 (rules + indexes + firebase mirror)

## Accomplishments

- **Phase 16 SHIPPED end-to-end to production.** All 9 prior plans' code is now live at couchtonight.app behind cache `couch-v16-calendar`. Add-for-Review is unblocked pending the 2 user-side gates (ASC screenshot re-upload + Namecheap press@ forwarder).
- **watchpartySeriesTick CF deployed** (CREATE operation — first deploy) — every-6h cron live, materializing wp instances from active series within 24h horizon.
- **watchpartyTick CF updated** with seriesReminder push branch (T-30min ±5min slop, in-doc flag BEFORE sendToMembers).
- **2 composite indexes for watchpartySeries** deployed (status+nextFireAt, familyCode+status+nextFireAt — both COLLECTION scope).
- **firestore.rules updated** with /watchpartySeries/{seriesId} match block (4 branches; 12 emulator tests prove correctness).
- **Smoke gate grew 12 → 15 contracts** (smoke-series-cadence-compute / smoke-series-materializer / smoke-series-idempotency registered in §2.5 before smoke-app-parse foundation gate).
- **15 CAL-16-* requirements traced** in REQUIREMENTS.md with implementing-plan + commit-hash citations.
- **16-HUMAN-UAT.md scaffold** with 7 scripts for post-deploy device verification.

## Task Commits

Each task was committed atomically on `hotfix/phase-30-cross-cutting-wave` (couch):

1. **Task 1: Add Phase 16 watchpartySeries rules describe block to tests/rules.test.js** — `9c74c61` (test)
   - 12 emulator tests #16-01..#16-12 covering all 4 rules branches; full suite 100/0 pass.
2. **Task 2: Register Phase 16 smoke contracts + scaffold 16-HUMAN-UAT.md + bump sw.js CACHE** — `c267b36` (feat)
   - 3 smoke contracts registered before smoke-app-parse in §2.5; sw.js → `couch-v49-phase-16-calendar` (pre-deploy belt-and-suspenders); 16-HUMAN-UAT.md created with 7 scripts.
3. **Task 3: Add CAL-16-* requirement block to REQUIREMENTS.md** — `4ef5274` (docs)
   - 15 CAL-16-01..15 IDs + 15 traceability rows + Coverage line 249→264 total + Pending → Complete deferral note.
4. **Task 4: Cross-repo deploy ritual (post-deploy CACHE auto-bump commit)** — `eb9f7c2` (chore)
   - sw.js CACHE auto-bumped by deploy.sh from `couch-v49-phase-16-calendar` → `couch-v16-calendar` at deploy time.

Cross-repo deploy commits (queuenight `main`):

- `1563992` chore(rules+indexes): auto-mirror couch Phase 16 firestore.rules + firestore.indexes.json + firebase.json from Plan 16-10 deploy

## CACHE version reconciliation

Per plan WARNING #3 (locked source-of-truth at deploy time):

- **(a)** Value from `grep CACHE sw.js` BEFORE edit: `couch-v42-phase-15.3-transparency` (this hotfix branch was behind main; main branch had v48-marketing-refresh from Phase 31)
- **(b)** Most-recent shipped tag from `git log --all --oneline | grep -iE 'couch-v[0-9]+'`: `couch-v48-marketing-refresh` (Phase 31 commit `e302e50`, mainline tip)
- **(c)** MEMORY/STATE reference: MEMORY records `couch-v42-phase-15.3-transparency` (stale — pre-Phase-31); STATE.md says "current cache: `couch-v47-pickem`" (also stale; mentions Phase 28). Both stale because Phase 31 shipped via main branch after MEMORY/STATE entries were last updated.
- **(d)** Chosen NEW value committed to sw.js: `couch-v49-phase-16-calendar` (next-sequential after v48; phase tag retained per convention)
- **(e)** Final live value after `bash scripts/deploy.sh 16-calendar` auto-bump: `couch-v16-calendar` (per Task 4 deploy; format = `couch-v{short-tag}`)
- **(f)** Post-deploy curl verification: `curl -s https://couchtonight.app/sw.js | grep CACHE` returns `const CACHE = 'couch-v16-calendar';` ✓

## Deploy ritual outcome

| Step | Command | Outcome |
|------|---------|---------|
| 1 | `firebase deploy --only firestore:indexes` (from queuenight after couch→queuenight indexes mirror) | ✅ Deploy complete. 2 new composite indexes for watchpartySeries created. Build async in Firebase console (may BUILDING for 5-30 min; T-16-36 disposition: first 6h tick may FAILED_PRECONDITION, next succeeds). |
| 2 | `firebase deploy --only functions` (from queuenight) | ✅ Deploy complete. `watchpartySeriesTick(us-central1)` Successful CREATE; `watchpartyTick(us-central1)` Successful UPDATE (reminder branch added); all 37+ other functions updated. |
| 3 | `firebase deploy --only firestore:rules` (from queuenight after couch→queuenight rules mirror) | ✅ Deploy complete. Rules compiled successfully; /watchpartySeries/{seriesId} block now active. |
| 4 | `bash scripts/deploy.sh 16-calendar` (from couch) | ✅ Smoke gate (15 contracts) pass; rules-mirror in sync (already mirrored manually in step 3); sw.js auto-bumped to `couch-v16-calendar`; 118 files uploaded; hosting release complete. Post-deploy curl confirms cache live. |

## Files Created/Modified

- `tests/rules.test.js` — Added `series_phase16_test` seed in seed() + `Phase 16 watchpartySeries rules` describe block with 12 cases after Phase 28 (lines ~1540+)
- `scripts/deploy.sh` — Inserted 3 smoke contract blocks (smoke-series-cadence-compute / smoke-series-materializer / smoke-series-idempotency) between smoke-pickem and smoke-app-parse (foundation gate stays LAST); updated pass-message enumeration
- `sw.js` — CACHE pre-deploy: `couch-v42-phase-15.3-transparency` → `couch-v49-phase-16-calendar` (Task 2). CACHE post-deploy (auto-bump by deploy.sh): `couch-v16-calendar` (Task 4 chore commit).
- `.planning/REQUIREMENTS.md` — Added `### CAL-16-* — Calendar Layer / Recurring Watchparties (Phase 16)` section after MARK-31-14 with 15 IDs; added 15 traceability table rows; added new Coverage refreshed 2026-05-28 entry; bumped mapped-to-phases 249 → 264
- `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` — NEW. 7 scripts (6 mandatory + 1 informational DST). Pre-flight checklist with curl + functions-list + composite-index BUILT verification.

## Decisions Made

- **CACHE pre-deploy value `couch-v49-phase-16-calendar`** chosen as next-sequential after `couch-v48-marketing-refresh` (Phase 31 mainline tip, current `couch-v42-phase-15.3-transparency` source value was a STALE branch artifact — main has shipped past it). Belt-and-suspenders only; deploy.sh auto-bump on short-tag `16-calendar` overrode to `couch-v16-calendar` per Couch deploy convention.
- **Indexes mirror done manually** (cp couch/firestore.indexes.json queuenight/firestore.indexes.json) because deploy.sh has `--sync-rules` flag but no `--sync-indexes` equivalent. Rules-mirror went through the in-flag path naturally because mirror was already in sync after step 3's manual cp + deploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual indexes mirror (couch → queuenight) before indexes deploy**
- **Found during:** Task 4 step 1
- **Issue:** Plan said `cd ~/claude-projects/couch && firebase deploy --only firestore:indexes`, but couch repo has no `firebase.json` — Firebase CLI errored with "Not in a Firebase app directory". The actual deploy target is queuenight (the mirror), which holds `firebase.json` + `firestore.indexes.json`. Indexes in queuenight were also stale (no Phase 16 entries).
- **Fix:** `cp /c/Users/nahde/claude-projects/couch/firestore.indexes.json /c/Users/nahde/queuenight/firestore.indexes.json` then `firebase deploy --only firestore:indexes` from queuenight directory. Committed mirror in queuenight as `chore(rules+indexes): auto-mirror couch Phase 16 ...`.
- **Files modified:** /c/Users/nahde/queuenight/firestore.indexes.json (queuenight commit `1563992`)
- **Verification:** Firebase deploy completed; 2 new composite indexes registered.
- **Committed in:** queuenight `1563992`

**2. [Rule 3 - Blocking] Manual rules mirror (couch → queuenight) before rules deploy**
- **Found during:** Task 4 step 3
- **Issue:** Same mirror-vs-source-of-truth pattern as #1. Plan's `cd ~/claude-projects/couch && firebase deploy --only firestore:rules` errored — couch has no firebase.json. Rules in queuenight were stale (no Phase 16 /watchpartySeries block).
- **Fix:** `cp /c/Users/nahde/claude-projects/couch/firestore.rules /c/Users/nahde/queuenight/firestore.rules` then `firebase deploy --only firestore:rules` from queuenight directory. Committed in same queuenight mirror commit as #1.
- **Files modified:** /c/Users/nahde/queuenight/firestore.rules (queuenight commit `1563992`)
- **Verification:** Rules compiled + released successfully.
- **Committed in:** queuenight `1563992`

---

**Total deviations:** 2 auto-fixed (both Rule 3 - Blocking, repo-architecture-aware).
**Impact on plan:** Both deviations were boilerplate adjustments to match couch + queuenight repo architecture (couch is source-of-truth; queuenight is deploy mirror with firebase.json). The plan's prose treated couch as a Firebase app directly, but the codebase pattern (per CLAUDE.md + Phase 28 + Phase 31 close-outs) routes firestore deploys through queuenight. No scope creep, no architectural changes.

## Issues Encountered

- **Branch context note:** Running on `hotfix/phase-30-cross-cutting-wave` branch (per orchestrator), not main. Pre-edit `grep CACHE sw.js` on this branch returned `couch-v42-phase-15.3-transparency` (Phase-15.3 era), but `git log --all --oneline` showed main has shipped past to `couch-v48-marketing-refresh` (Phase 31). Auto-bump on deploy.sh consults source sw.js for the bump-vs-skip logic (`grep -q "const CACHE = '${CACHE_NEW}';" sw.js`), so the pre-deploy manual value being older than main caused no problem — auto-bump overwrote with `couch-v16-calendar` cleanly.

## Threats Mitigated

Per plan threat model:

- **T-16-36 (DoS, composite index still BUILDING when CF runs)** — Accepted disposition. Documented in 16-HUMAN-UAT.md pre-flight checklist (`FAILED_PRECONDITION` on first tick acceptable; next 6h tick succeeds once BUILT).
- **T-16-37 (Tampering, partial deploy: CFs ship but rules don't)** — Mitigated via ordering: indexes → CFs → rules → hosting. Each step a separate command; rules-deploy was tiny + retryable.
- **T-16-38 (Information Disclosure, rules tests fail in production due to env diff vs emulator)** — Mitigated. 12 emulator tests pass against same firestore.rules text that ships to production. Phase 30 precedent for emulator parity.

## User Setup Required

**Post-deploy device UAT.** See `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` for 6 mandatory scripts (Entry 1 create / Entry 2 create / edit cadence / pause-resume-cancel / week-view mobile+desktop / 30-min reminder push) + 1 informational DST script.

Resume signal: `uat passed` → run `/gsd-verify-work 16`.

Then, the launch-blocking checklist also includes 2 user-side gates (per MEMORY):
1. ASC screenshot re-upload
2. Namecheap press@ forwarder

After Phase 16 is shipped + uat passed + 2 user-side gates: **Add for Review** in App Store Connect is unblocked.

## REQUIREMENTS.md Pending → Complete deferral

Per Task 3 acceptance criteria + plan output spec: all 15 CAL-16-01..15 are marked **Pending** in REQUIREMENTS.md even though shipped to production. The Pending → Complete status flip is **DEFERRED to a future audit-trail backfill phase** mirroring Phase 15.6 + Phase 31-05 precedent. This is an intentional convention, NOT an oversight. `/gsd-verify-work 16` will confirm shipped-in-production behavior; the audit-trail backfill is a separate work item per the established convention.

## Next Phase Readiness

- Phase 16 code-complete + shipped to production. 9/10 → 10/10 plans complete.
- Phase 17 (App Store launch readiness) **UNBLOCKED** pending the 2 user-side gates (ASC screenshot + Namecheap press@) plus the device UAT walkthrough.
- Smoke gate now has 15 contracts (all green); future deploys carry Phase 16 sentinels automatically.
- Cache version `couch-v16-calendar` live at couchtonight.app; iOS PWAs invalidate + re-fetch shell on next online activation.
- Branch note: this work was on `hotfix/phase-30-cross-cutting-wave`. When this branch lands on main, the close-out applies to main's lineage. STATE.md update will reflect 10/10 plans complete + Phase 16 SHIPPED (status `complete pending verify`).

## Self-Check: PASSED

- ✓ `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` exists
- ✓ `.planning/phases/16-calendar-layer/16-10-SUMMARY.md` (this file) exists
- ✓ Task 1 commit `9c74c61` exists in git log
- ✓ Task 2 commit `c267b36` exists in git log
- ✓ Task 3 commit `4ef5274` exists in git log
- ✓ Task 4 chore commit `eb9f7c2` exists in git log
- ✓ queuenight mirror commit `1563992` exists in queuenight git log
- ✓ All 12 #16-* rules tests pass (full suite 100/0)
- ✓ All 3 Phase 16 smoke contracts pass
- ✓ Live cache verified: `curl -s https://couchtonight.app/sw.js | grep CACHE` returns `couch-v16-calendar`
- ✓ watchpartySeriesTick listed in `firebase functions:list` output

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
