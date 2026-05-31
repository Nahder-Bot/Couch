---
phase: 16-calendar-layer
plan: 03
subsystem: backend-cf
tags: [cloud-functions, scheduled-cf, idempotency, materializer, deterministic-id, calendar-layer]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 01
    provides: "watchpartySeries top-level firestore.rules block + composite index (status, nextFireAt) for the materializer query"
  - phase: 16-calendar-layer
    plan: 02
    provides: "computeNextFireAt pure DST-aware helper — required for advancing series.nextFireAt after each materialization"
provides:
  - "watchpartySeriesTick scheduled CF (every 6h) materializing watchpartySeries instances within 24h horizon"
  - "Deterministic wpId pattern: series_{seriesId}_{instanceDateKey} — re-runs are idempotent"
  - "Series advancement via computeNextFireAt() after each materialize+set"
  - "scripts/smoke-series-materializer.cjs — 23 sentinels + FLOOR=20 production-source contract"
  - "scripts/smoke-series-idempotency.cjs — 10 sentinels + FLOOR=9 negative-content contract (NO Date.now / Math.random in wpId)"
affects: [16-04-reminder-push, 16-05-account-tab-list, 16-06-tonight-cta, 16-07-edit-modal, 16-10-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pickReminderTick onSchedule boilerplate reused verbatim — 'every 6 hours' + region us-central1 + timeoutSeconds 240 + memory 256MiB"
    - "Per-doc try/catch tally-counter + summary log (T-16-15 DoS isolation — one bad series doc cannot cascade-fail the tick)"
    - "Deterministic wpId pattern (CAL-16-04) — wpRef.get() existence check before set() — stronger than the picks_reminders sentinel-doc pattern because the dedup target IS the wp doc itself (no race window between check + write)"
    - "Admin-SDK write fires onWatchpartyCreateTopLevel trigger (Phase 30) automatically — no explicit sendToMembers call needed in this CF (RESEARCH Assumption A1)"
    - "Phase 30 wp doc shape preserved — id / titleId / titleName / titlePoster / hostId / hostName / hostUid / creatorTimeZone / startAt / createdAt / lastActivityAt / status / participants{hostId:{...}} / reactions=[] / videoUrl=null / videoSource=null / hostFamilyCode / families[] / memberUids[] / crossFamilyMembers=[] — PLUS Phase 16 back-refs seriesId + seriesInstanceDateKey + attribution echo actingUid + memberId + memberName"
    - "Three-piece wpId sentinel split (A9a/b/c) in smoke contracts — avoids template-literal shell-escape ambiguity per plan-checker WARNING #5 (single-needle `series_${seriesDoc.id}_${instanceDateKey}` could be misread by some grep / linter sentinels; splitting into 3 separate string-includes() checks is unambiguous)"
    - "FLOOR meta-assert (Phase 28 PICK-28-21 / smoke-app-parse.cjs lineage) — materializer FLOOR=20, idempotency FLOOR=9"

key-files:
  created:
    - queuenight/functions/src/watchpartySeriesTick.js
    - scripts/smoke-series-materializer.cjs
    - scripts/smoke-series-idempotency.cjs
  modified:
    - queuenight/functions/index.js

key-decisions:
  - "Schedule 'every 6 hours' (NOT 4h) per CONTEXT D-XX — 24h horizon + 6h tick = each instance gets ~4 chances to materialize before fire, plus the existing-doc short-circuit keeps re-runs idempotent. The 30-min reminder push is owned by watchpartyTick (plan 16-04), not this CF."
  - "Push fan-out delegated to onWatchpartyCreateTopLevel — RESEARCH Assumption A1 (Firebase docs confirm doc-create triggers fire on admin-SDK writes regardless of auth context). No explicit sendToMembers call in this CF. The 'watchparty scheduled' push that members get when a new wp lands in their roster fires for free."
  - "instanceDateKey derived via toLocaleDateString('en-CA', { timeZone: series.timezone || 'UTC' }) — en-CA locale produces ISO 'YYYY-MM-DD' format. Canonical Couch pattern (also used in js/app.js 4+ tz-aware sites). DST-safe because the date key reflects the FAMILY'S calendar day, not UTC's."
  - "Per-series try/catch with tally counters — mirrors pickReminderTick:181-189 pattern. One bad series doc (corrupted timezone, malformed nextFireAt) increments errored++ and continues to the next series. The summary log surfaces in Cloud Logging for observability."
  - "FLOOR values selected at FLOOR=20 (materializer, 23 sentinels) + FLOOR=9 (idempotency, 10 sentinels). Plan 16-04 will bump materializer FLOOR (adds seriesReminder-related sentinels) per the planner's locked sequence."

patterns-established:
  - "Atomic per-task commits across BOTH repos — queuenight commits (dae8376 + 56003df) for CF + export wiring; couch commits (cbafdf3 + 483db1e) for the 2 smoke contracts. Each commit is self-contained and reversible without affecting the other repo."
  - "Smoke contracts run from couch repo root via 3x '..' path math (couch/scripts -> couch -> claude-projects -> ~ -> queuenight/functions/src/) — same convention as Plan 16-02 smoke-series-cadence-compute.cjs and pre-Phase-16 smoke-pickem.cjs cross-repo grep group"
  - "queuenight pre-existing dirty state (firebase.json + firestore.indexes.json from prior session) explicitly NOT staged — preserves prior owner's uncommitted state. Only Phase-16 files touched in our commits."

requirements-completed: [CAL-16-03, CAL-16-04]

# Metrics
duration: 3min
completed: 2026-05-27
---

# Phase 16 Plan 03: watchpartySeriesTick materializer CF + smoke contracts Summary

**Shipped the heart of Phase 16 — the every-6h scheduled CF that materializes a watchparties/{wpId} doc per active series instance with deterministic wpId for idempotency, advances series.nextFireAt via the pure DST-aware helper from 16-02, and delegates the "watchparty scheduled" push fan-out to onWatchpartyCreateTopLevel (Phase 30) for free.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-27T23:56:33Z
- **Completed:** 2026-05-27T23:59:20Z
- **Tasks:** 4 / 4
- **Files created:** 3 (1 cross-repo CF + 2 couch smoke scripts)
- **Files modified:** 1 (queuenight/functions/index.js — 3-line export insert)

## Accomplishments

- **Scheduled materializer CF** at `queuenight/functions/src/watchpartySeriesTick.js` (150 lines). Every 6h, queries `watchpartySeries where status=='active' and nextFireAt<=now+24h orderBy nextFireAt`, then for each result: (a) computes deterministic `wpId = series_${seriesDoc.id}_${instanceDateKey}` using `toLocaleDateString('en-CA', { timeZone: series.timezone || 'UTC' })`; (b) checks `wpRef.get().exists` — if present, `alreadyExisted++` and skip to advancement; if absent, builds the canonical Phase 30 top-level wp shape (id + titleId + titleName + titlePoster + hostId + hostName + hostUid + creatorTimeZone + startAt + createdAt + lastActivityAt + status='scheduled' + participants{createdBy:{...}} + reactions=[] + videoUrl=null + videoSource=null + hostFamilyCode + families[familyCode] + memberUids[] + crossFamilyMembers=[]) PLUS Phase 16 back-refs (seriesId + seriesInstanceDateKey) PLUS attribution echo (actingUid + memberId + memberName), then `wpRef.set(wp)`; (c) advances series doc via `computeNextFireAt(daysOfWeek, timeOfDay, timezone, nextFireAt + 60_000)` and `seriesDoc.ref.update({ nextFireAt: newNextFireAt, lastFiredAt: series.nextFireAt })`. Per-doc try/catch (T-16-15 DoS isolation). Summary tally log (`materialized=X advanced=Y alreadyExisted=Z errored=W`) surfaces in Cloud Logging.
- **Export wiring** at `queuenight/functions/index.js` lines 1939-1940 (3-line insert immediately after `exports.pickReminderTick`): 1 blank + 1 `// Phase 16 / CAL-16-03 — recurring watchparty materializer` comment + 1 `exports.watchpartySeriesTick = require('./src/watchpartySeriesTick').watchpartySeriesTick;`. Verified via `node -e "require('./index.js')"` exits 0 + `typeof idx.watchpartySeriesTick === 'function'`. Wave 9 / plan 16-10 will pick this up via `firebase deploy --only functions`.
- **Materializer smoke contract** at `scripts/smoke-series-materializer.cjs` (90 lines, 23 sentinels + FLOOR=20 meta-assert). Group A (14 — CF structure): onSchedule registration + 6h schedule + region us-central1 + 24h horizon constant + watchpartySeries collection query + active-status filter + nextFireAt-bound filter + orderBy + 3-piece deterministic wpId check (A9a series_ prefix + A9b seriesDoc.id + A9c instanceDateKey) + existence check + seriesId back-ref + seriesInstanceDateKey back-ref + computeNextFireAt require + lastFiredAt update. Group B (2 — export wiring): index.js exports the CF + references `./src/watchpartySeriesTick`. Group C (3 — Firestore infra): firestore.rules has `match /watchpartySeries/{seriesId}` block + firestore.indexes.json has `"collectionGroup": "watchpartySeries"` entry + `"fieldPath": "nextFireAt"` field. Group D (2 — helper prereq): computeNextFireAt module.exports declaration + Intl.DateTimeFormat usage (no luxon). Final: 24/24 PASS (23 sentinels + floor).
- **Idempotency smoke contract** at `scripts/smoke-series-idempotency.cjs` (85 lines, 10 sentinels + FLOOR=9 meta-assert). Group A (5 positive): 3-piece wpId pieces present + timezone hookup + en-CA locale. Group B (2 NEGATIVE — the key safeguard): wpId construction window has NO `Date.now()` and NO `Math.random()`. Group C (3 idempotency contract): wpSnap.exists check + alreadyExisted counter + set() guarded by `!wpSnap.exists` branch. Final: 11/11 PASS (10 sentinels + floor). The negative-content checks (B1+B2) are the critical regression guard: they fail-fast if a future edit introduces `wpId = series_${id}_${Date.now()}` which would create a duplicate wp every tick.
- **Phase 16 smoke gate now at 3 contracts:** smoke-series-cadence-compute.cjs (12 PASS, Plan 16-02) + smoke-series-materializer.cjs (24 PASS, this plan) + smoke-series-idempotency.cjs (11 PASS, this plan) = 47 total Phase-16 sentinels green. Plan 16-04 will extend materializer FLOOR for seriesReminder-related additions.

## Task Commits

Each task was committed atomically in its respective repo:

1. **Task 1: Create watchpartySeriesTick.js scheduled CF** — `dae8376` in queuenight repo (`feat(16-03): add watchpartySeriesTick scheduled CF (materializer + idempotency)`)
2. **Task 2: Register watchpartySeriesTick export in queuenight/functions/index.js** — `56003df` in queuenight repo (`feat(16-03): register watchpartySeriesTick export in functions/index.js`)
3. **Task 3: Create scripts/smoke-series-materializer.cjs production-source contract** — `cbafdf3` in couch repo (`test(16-03): add smoke-series-materializer.cjs production-source contract`)
4. **Task 4: Create scripts/smoke-series-idempotency.cjs deterministic-wpId contract** — `483db1e` in couch repo (`test(16-03): add smoke-series-idempotency.cjs deterministic-wpId contract`)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Files Created/Modified

- **NEW `queuenight/functions/src/watchpartySeriesTick.js`** (150 lines, cross-repo). Pure CJS module exporting `watchpartySeriesTick` onSchedule trigger. Imports admin-sdk + `firebase-functions/v2/scheduler` + `./computeNextFireAt` (the helper from Plan 16-02). Defensive null-guards (`series.nextFireAt typeof number` skip + `Array.isArray(series.memberUids)` fallback). Composite index `(status, nextFireAt)` from Plan 16-01 backs the query.
- **MODIFIED `queuenight/functions/index.js`** (3-line insert at lines 1939-1940). 1 blank + 1 CAL-16-03 comment + 1 require/export line. Net delta: +3 lines (1 file changed, 3 insertions). Untouched: every other export, the NOTIFICATION_DEFAULTS map (plan 16-04 owns the `seriesReminder` lockstep), all 1947 prior lines.
- **NEW `scripts/smoke-series-materializer.cjs`** (90 lines, couch repo). 23 sentinels across 4 groups + FLOOR=20 meta-assert. Uses 3x `..` path math from `__dirname` (couch/scripts/) to walk: couch -> claude-projects -> ~ -> queuenight/functions/src/. Tested at runtime: `--- 24 passed, 0 failed ---`.
- **NEW `scripts/smoke-series-idempotency.cjs`** (85 lines, couch repo). 10 sentinels across 3 groups (5 positive + 2 NEGATIVE + 3 idempotency contract) + FLOOR=9 meta-assert. The `extractWpIdSection()` helper extracts ~10 lines around the `const wpId =` definition for the negative-content checks (B1+B2). Tested at runtime: `--- 11 passed, 0 failed ---`.

## Decisions Made

- **Schedule 'every 6 hours' (NOT 4h or 5min):** per CONTEXT D-XX — 24h horizon + 6h tick = each instance gets ~4 chances to materialize before fire (covers any one missed tick + the existing-doc short-circuit keeps re-runs idempotent). The 30-min reminder push is owned by watchpartyTick (plan 16-04), not this CF. The pickReminderTick "every 5 minutes" cadence applies because it needs tight reminder-window alignment; the materializer doesn't.
- **Push fan-out via onWatchpartyCreateTopLevel (no explicit sendToMembers call):** RESEARCH Assumption A1 — Firebase docs confirm Firestore doc-create triggers fire on admin-SDK writes regardless of auth context. The Phase 30 onWatchpartyCreateTopLevel trigger handles the "watchparty scheduled" push fan-out for every new wp doc (including ones written by this CF). No DR-3 lockstep needed in this plan; Plan 16-04 will add the `seriesReminder` key to all three notification maps in its own commit.
- **instanceDateKey via `toLocaleDateString('en-CA', { timeZone: series.timezone || 'UTC' })`:** en-CA locale produces ISO `YYYY-MM-DD` format. Canonical Couch pattern (4+ existing tz-aware sites in js/app.js + isInQuietHours in queuenight/functions/index.js:50-75 use the same Intl-based approach). DST-safe by construction because the date key reflects the family's calendar day, not UTC's.
- **Three-piece wpId sentinel split (A9a/b/c):** plan-checker WARNING #5 historically called out template-literal shell-escape ambiguity in single-needle sentinels (e.g. `series_${seriesDoc.id}_${instanceDateKey}` could be misread by some shell-quoting paths in CI). Splitting into 3 separate `string.includes()` checks (one for each piece: `series_`, `seriesDoc.id`, `instanceDateKey`) is unambiguous in every shell + JS context. Bumped materializer FLOOR from 18→20 to absorb the split; idempotency FLOOR from 8→9.
- **Per-series try/catch with tally counters (T-16-15 mitigation):** one bad series doc (corrupted timezone, malformed nextFireAt) increments `errored++` and continues to the next series; the summary log surfaces in Cloud Logging. Mirrors pickReminderTick:181-189 pattern exactly. Prevents the cascade-failure threat class where one bad doc crashes the entire tick.
- **NOT staging the pre-existing dirty changes in queuenight (`firebase.json` + `firestore.indexes.json`):** these are from prior unrelated work in a previous session (Plan 16-02 SUMMARY also noted these). Staged only the new files relevant to this plan. The prior owner can handle them later.

## Why No Explicit sendToMembers Call

The CF materializes a wp doc via `wpRef.set(wp)` using the admin SDK. Per Firebase docs (verified by RESEARCH Assumption A1), Firestore doc-create triggers fire on admin-SDK writes regardless of auth context — there is no distinction between client writes and server writes at the trigger layer. The Phase 30 `onWatchpartyCreateTopLevel` trigger (already deployed) handles the "watchparty scheduled" push fan-out for every new top-level wp doc. Therefore:

- **NO** explicit `sendToMembers` call in this CF (would cause duplicate pushes)
- **NO** lazy-require of `sendToMembers` like pickReminderTick has (not needed)
- **YES** the materializer's `wpRef.set(wp)` is the SOLE trigger for the scheduled-watchparty push

The 30-min reminder push (T-30min before `startAt`) is a separate concern owned by `watchpartyTick` and added in plan 16-04 (DR-3 lockstep: extend `watchpartyTick` body + add `seriesReminder` key to `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` + `NOTIFICATION_DEFAULTS` in lockstep).

## Three-Piece wpId Sentinel Rationale

The deterministic wpId line in `watchpartySeriesTick.js:68` reads:

```js
const wpId = `series_${seriesDoc.id}_${instanceDateKey}`;
```

A single sentinel checking the literal substring `series_${seriesDoc.id}_${instanceDateKey}` would be:

1. **Brittle** in shells that try to interpolate `${...}` (e.g. bash double-quoted contexts in plan-checker scripts that escape `$` inconsistently)
2. **Hard to read** — anyone scanning the smoke for "what does this check?" sees a wall of `${}` literals
3. **Coupled** to the exact variable names (`seriesDoc.id`) which could be renamed in a refactor

The three-piece split (`series_` + `seriesDoc.id` + `instanceDateKey` as three independent `.includes()` checks) is:

1. **Shell-safe** — no `${}` in the needle strings
2. **Readable** — each piece has a self-describing label (A9a/b/c)
3. **Refactor-resilient** — if someone renames `seriesDoc.id` to `seriesSnap.id`, A9b fails fast with a clear message instead of the whole sentinel silently mismatching

This rationale also applies to the idempotency smoke's A1a/A1b/A2 trio.

## Path-Math Note

Both new smokes use `path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions', ...)`:

```
C:\Users\nahde\claude-projects\couch\scripts\smoke-X.cjs (__dirname = couch\scripts)
  → .. → C:\Users\nahde\claude-projects\couch
  → .. → C:\Users\nahde\claude-projects
  → .. → C:\Users\nahde\                  (== `~` on Windows)
  → queuenight\functions\src\watchpartySeriesTick.js
```

couch and queuenight are **both children of `~`** — they are NOT siblings of each other in the same parent. This is the same path math used by `scripts/smoke-pickem.cjs` and `scripts/smoke-series-cadence-compute.cjs` from Plan 16-02. Verified at execute time by running both new smokes and confirming exits 0.

## FLOOR Bump History (for plan 16-04's reference)

- **smoke-series-materializer.cjs** FLOOR=20 (this plan). Plan-supplied FLOOR was 20 (after A9 split from 18). Total sentinels: 23. Headroom: 3.
- **smoke-series-idempotency.cjs** FLOOR=9 (this plan). Plan-supplied FLOOR was 9 (after A1 split from 8). Total sentinels: 10. Headroom: 1.

Plan 16-04 Task 3 will bump materializer FLOOR to absorb seriesReminder-related sentinels per the planner's locked sequence.

## Threats Addressed

- **T-16-02 (Tampering — client mutating nextFireAt to fire out-of-cadence)** — MITIGATED via `computeNextFireAt()` call after each materialize/short-circuit. CF re-computes the advanced nextFireAt from `series.daysOfWeek` + `series.timeOfDay` + `series.timezone` (all rules-validated at create time per Plan 16-01) and ignores any client-injected nextFireAt for the next-fire calculation. Worst case: a malicious client sets nextFireAt to a past instant, gets one premature instance, then back to cadence on the next tick.
- **T-16-07 (Idempotency abuse — replaying materializer to double-fire)** — MITIGATED via deterministic `wpId = series_${seriesDoc.id}_${instanceDateKey}` + `wpRef.get().exists` check before `set()`. Re-running the CF for the same series + same instanceDateKey is benign: the second run hits the `alreadyExisted++` branch, advances nextFireAt (idempotent — `computeNextFireAt(..., series.nextFireAt + 60_000)` returns the same value because the inputs are pure), and exits. Smoke-series-idempotency.cjs B1+B2 enforce no Date.now()/Math.random() in the wpId construction window — guards against future regressions.
- **T-16-15 (DoS — one bad series doc crashes entire tick)** — MITIGATED via per-series try/catch + `errored++` counter (mirrors pickReminderTick:181-189). One series with corrupted data (e.g. invalid timezone string) increments `errored` and continues; the summary log surfaces the error count in Cloud Logging.
- **T-16-16 (Information Disclosure — CF accidentally writes a wp with wrong memberUids → unauthorized read)** — MITIGATED via `Array.isArray(series.memberUids) ? series.memberUids : []` defensive copy (no transformation). `series.memberUids` was rules-validated at create time in Plan 16-01 (caller must be in own memberUids); the CF preserves that invariant verbatim. Plus Plan 30 firestore.rules at line 161 gates wp reads on `request.auth.uid in resource.data.memberUids` — defense in depth.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. All 4 tasks' acceptance criteria PASS at every check. All 3 smoke contracts green. queuenight index.js loads cleanly.

### Authentication Gates

None — pure backend work; no auth surface touched.

### Scope Boundary

Adhered strictly:
- Plan scope: 1 new CF file + 1 line added to queuenight index.js + 2 new smoke scripts. That is exactly what shipped.
- Pre-existing dirty state in queuenight (`firebase.json` + `firestore.indexes.json`) NOT staged — same hygiene practice as Plan 16-02 (preserves the prior owner's uncommitted state).
- NO deploys (Wave 9 / plan 16-10's job).
- NO `sw.js` cache bump (this plan is pure backend; no user-visible app-shell change).
- NO touching `NOTIFICATION_DEFAULTS` for `seriesReminder` lockstep (plan 16-04 DR-3 owns that).

## Threat Flags

None — this plan adds exactly the surface the threat model already enumerates. The new CF is a top-level Cloud Function (Cloud Scheduler → onSchedule trigger boundary, trusted per Firebase managed-service). The wp doc writes go through the existing top-level `/watchparties/` rules block from Phase 30 (admin SDK bypasses rules but the doc shape matches what client writes would produce). No new attack surface beyond what CONTEXT/RESEARCH already planned.

## Known Stubs

None. All wp doc fields are populated with real values (or explicit `null` for fields like `hostName` that get resolved per-push by `sendToMembers`'s name-cache, same pattern as pickReminderTick). `titlePoster: ''` and `videoUrl: null` / `videoSource: null` match the canonical Phase 30 wp shape from confirmStartWatchparty (which also omits poster for series-materialized wps — the title detail surface will fetch from TMDB when the wp opens, same as one-off wps).

## Issues Encountered

None.

## User Setup Required

None — pure backend code + smoke contracts. No external service configuration. Wave 9 / plan 16-10 owns the cross-repo deploy (`firebase deploy --only functions` from queuenight/ + `firebase deploy --only firestore:indexes` from couch/) — those steps require user-controlled GCP credentials but are out of scope for THIS plan.

## Next Phase Readiness

- **Plan 16-04 (reminder push extension + DR-3 lockstep):** READY. Will extend `watchpartyTick` body at queuenight/functions/index.js:~1213 with a series-reminder branch (T-30min before `startAt`, idempotency flag on the wp doc) + add `seriesReminder` key to the three notification maps in lockstep. Plan 16-04 Task 3 will bump `smoke-series-materializer.cjs` FLOOR=20 → FLOOR=29 (planner's locked sequence; +2 from this plan's A9 split = was 27 → 29) and add seriesReminder-key lockstep sentinels.
- **Plan 16-05 (Account-tab series list view):** READY. Will subscribe to `db.collection('watchpartySeries').where('familyCode', '==', code).where('status', '==', 'active').orderBy('nextFireAt')` — backed by the second composite index from Plan 16-01.
- **Plan 16-06 (Tonight tab "Schedule a series" CTA + creator surface):** READY. Will write to `db.collection('watchpartySeries')` via the rules-validated client write path from Plan 16-01.
- **Plan 16-10 (Wave 9 close-out / deploy):** READY. The 3 new artifacts to deploy: (1) `queuenight/functions/index.js` + `queuenight/functions/src/watchpartySeriesTick.js` via `firebase deploy --only functions:watchpartySeriesTick` (or whole-bundle deploy); (2) firestore.indexes.json + firestore.rules (from Plan 16-01) via the `bash scripts/deploy.sh --sync-rules <tag>` ritual; (3) sw.js cache bump per RUNBOOK §H.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `queuenight/functions/src/watchpartySeriesTick.js` exists (150 lines) — verified via `Read` tool at execute time.
- File `scripts/smoke-series-materializer.cjs` exists (90 lines) — verified via `Write` tool success + `node` execution at execute time.
- File `scripts/smoke-series-idempotency.cjs` exists (85 lines) — verified via `Write` tool success + `node` execution at execute time.
- File `queuenight/functions/index.js` modified (3-line insert at lines 1939-1940 confirmed via `Read` post-Edit).
- Commit `dae8376` exists in queuenight repo on branch `main` (verified via `git rev-parse --short HEAD` after commit).
- Commit `56003df` exists in queuenight repo on branch `main` (verified via `git rev-parse --short HEAD` after commit).
- Commit `cbafdf3` exists in couch repo on branch `hotfix/phase-30-cross-cutting-wave` (verified via `git rev-parse --short HEAD` after commit).
- Commit `483db1e` exists in couch repo on branch `hotfix/phase-30-cross-cutting-wave` (verified via `git rev-parse --short HEAD` after commit).
- `node scripts/smoke-series-materializer.cjs` exits 0 with `--- 24 passed, 0 failed ---` (verified at execute time).
- `node scripts/smoke-series-idempotency.cjs` exits 0 with `--- 11 passed, 0 failed ---` (verified at execute time).
- `node scripts/smoke-series-cadence-compute.cjs` (Plan 16-02 prereq) still exits 0 with `--- 12 passed, 0 failed ---` (verified at execute time).
- `cd queuenight/functions && node -e "require('./index.js')"` exits 0 with `OK: queuenight index.js loads cleanly` (verified at execute time).
- No file deletions in any of the 4 commits (verified `git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty after each commit).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-27*
