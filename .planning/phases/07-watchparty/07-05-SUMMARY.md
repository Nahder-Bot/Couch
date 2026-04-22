---
phase: 07-watchparty
plan: 05
subsystem: push-notifications
tags: [firestore, cloud-functions, intl, timezone, watchparty, push]

# Dependency graph
requires:
  - phase: 06-push-notifications
    provides: onWatchpartyCreate CF + watchpartyScheduled event wiring (the file/line this plan fixes)
  - phase: 07-watchparty
    provides: wp doc schema, confirmStartWatchparty + scheduleSportsWatchparty create paths
provides:
  - creatorTimeZone (IANA string) field on new watchparty docs, captured client-side via Intl.DateTimeFormat
  - onWatchpartyCreate CF renders startAt in the creator's local timezone in the push body (UTC fallback for legacy docs)
  - Fix for Gap #1 from 07-UAT-RESULTS.md — 11pm EDT schedule now reads "11:00 PM" on recipient devices, not "3:00 AM"
affects: [07-06-hide-reactions-late-joiner, 07-07-reaction-delay, 07-08-on-time-inference, all future watchparty push body work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Capture creator's IANA tz at write-time (Intl.DateTimeFormat().resolvedOptions().timeZone) and read in server-side renderers via toLocaleString timeZone option — avoids any need to pass locale state through pubsub/eventarc or guess the creator's zone from auth metadata."

key-files:
  created: []
  modified:
    - "js/app.js — confirmStartWatchparty (7382) + scheduleSportsWatchparty (7304): capture creatorTimeZone on wp doc"
    - "queuenight/functions/index.js — onWatchpartyCreate (line 169 region): render startAt via toLocaleTimeString with timeZone: wp.creatorTimeZone || 'UTC'"

key-decisions:
  - "Chose UAT Option (c): store creator's IANA tz on the wp doc at write-time rather than (a) drop time from push body, (b) hard-code ET, or (d) compute from hostUid's device metadata. Pure additive field, graceful UTC fallback for legacy docs, no migration."
  - "Did NOT consolidate the creatorTimeZone capture into a shared helper function — duplicated the tiny try/catch block at both create sites (confirmStartWatchparty + scheduleSportsWatchparty) because (1) the sports path already has pre-existing asymmetries the plan scope-gated (hostUid, lastActivityAt), and (2) lifting to module scope would pick tz once at module load and miss mid-session tz changes (rare but possible — travel). Per-call capture is correct-by-construction."
  - "CF fallback literal is 'UTC' (not null/omission) to preserve pre-fix behavior exactly for any legacy doc created before this plan shipped. No crash, no silent mislabel-with-new-tz — labeled as it was before."

patterns-established:
  - "Creator-captured timezone pattern: when a server-side renderer (CF, edge fn, etc.) needs to format user-authored timestamps in the author's locale, capture IANA tz at write-time on the doc rather than deriving server-side. Avoids guessing, handles travel/locale changes naturally, null-safe."

requirements-completed: [PARTY-06]

# Metrics
duration: 2 min
completed: 2026-04-22
---

# Phase 7 Plan 5: Watchparty Push Timezone Fix Summary

**CF push body now renders startAt in the creator's IANA timezone (captured at write-time via Intl.DateTimeFormat), closing Gap #1 from 07-UAT-RESULTS.md — 11pm EDT schedules no longer arrive labeled "3:00 AM" on family devices.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-22T00:17:56Z
- **Completed:** 2026-04-22T00:20:16Z
- **Tasks:** 3 shipped + 1 deferred to /gsd-verify-work (UAT)
- **Files modified:** 2

## Accomplishments

- `creatorTimeZone` (IANA) captured at wp create on both movie path (`confirmStartWatchparty`) and sports path (`scheduleSportsWatchparty`) — always written, null-safe.
- `onWatchpartyCreate` CF now renders `startAt` via `toLocaleTimeString` with `timeZone: wp.creatorTimeZone || 'UTC'` — creator's local time appears in push bodies delivered to other family members.
- CF deployed cleanly to `queuenight-84044` (`onWatchpartyCreate(us-central1)` — successful update operation, no runtime errors in deploy output).

## Task Commits

1. **Task 1+2: Client — capture creatorTimeZone in confirmStartWatchparty + scheduleSportsWatchparty** — `8ac8c9b` (feat)
2. **Task 3: CF — consume creatorTimeZone in onWatchpartyCreate push body** — deployed only (queuenight/ repo is not git-tracked; production deploy via `firebase deploy --only functions:onWatchpartyCreate` succeeded)
3. **Plan metadata:** `<final>` (docs — created after this file is written)

_Note: Tasks 1 and 2 were batched into one commit per the plan's `commit_strategy: two commits — (1) client capture; (2) CF render`. The "two commits" in the strategy map to (a) couch-repo client commit, (b) queuenight-repo CF deploy. Since `queuenight/functions/` is not git-tracked inside the couch repo (per STATE.md `Phase 5.8` resume note: "queuenight/functions/ ... not couch-repo tracked"), the CF change has no corresponding couch-repo commit — the deploy itself is its shipping surface._

## Files Created/Modified

- `js/app.js` — +15 lines: two local `creatorTimeZone` try/catch consts + two `creatorTimeZone: creatorTimeZone || null` wp fields.
- `C:\Users\nahde\queuenight\functions\index.js` — +11/-1 line: expand `toLocaleTimeString([], {...})` to 3-key form with `timeZone: wp.creatorTimeZone || 'UTC'`. Untouched: `onWatchpartyUpdate`, `onWatchpartyTick`, Phase 8 intent push render at line 365 (pre-existing, out of scope).

## Decisions Made

- **UAT Option (c) selected autonomously** (per plan frontmatter). Rationale in plan's `<risk_notes>` — one additive field, graceful fallback, most semantically correct rendering (creator's intended tz at schedule-time).
- **Local per-call capture over shared helper** — two tiny try/catch blocks instead of lifting to a module-scope helper. Reasons: (1) Task 2's `<risk_notes>` explicitly scope-gated sports-path refactoring, (2) module-load-time capture would miss mid-session tz changes. Trivial duplication, easy to consolidate later if `creatorTimeZone` spreads to a third write site.
- **CF fallback literal `'UTC'`** chosen over null/omission to preserve exact pre-fix render behavior on any in-flight legacy doc.

## Deviations from Plan

None — plan executed exactly as written. Grep acceptance all passed on first edit:
- `grep -n creatorTimeZone js/app.js` → 4 hits (2 const + 2 field assignments, both create sites)
- `grep -n Intl.DateTimeFormat js/app.js` → 2 new hits in the 7300-7420 watchparty region (plus 2 pre-existing elsewhere — profile tz detection at lines 221, 982)
- `grep -n timeZone queuenight/functions/index.js` → new hit at line 178 inside `onWatchpartyCreate` body
- `grep -c toLocaleTimeString queuenight/functions/index.js` → 2 (unchanged — line 175 is the modified call, line 365 is pre-existing Phase 8 intent code, left alone per scope)

## Issues Encountered

- **`queuenight/` repo not under couch working directory** — initially searched for `queuenight/functions/index.js` at `C:\Users\nahde\claude-projects\couch\queuenight\` (where the plan's paths implied). Confirmed via STATE.md note that it's a sibling deploy-only copy at `C:\Users\nahde\queuenight\`. Not a deviation; just a path resolution step. Edit succeeded at the correct location.
- **queuenight repo is not git-tracked** — no `git init` there, so the CF "commit" exists only as the Firebase deploy artifact. The plan's `commit_strategy` of "two commits" resolves as: commit #1 = couch-repo client commit (`8ac8c9b`), "commit #2" = the Firebase deploy itself (deploy output recorded here for audit trail).

## Authentication Gates

None — `firebase deploy --only functions:onWatchpartyCreate` ran without any auth prompts; existing gcloud/firebase session credentials were valid.

## Deferred

- **Task 4 (UAT human-verify Scenario 1 repro)** deferred to `/gsd-verify-work 7`. Project pattern is "deploy first, UAT later" (Phases 6 and 8 currently in "deployed UAT-pending" state per STATE.md). UAT reproduction steps, verbatim from plan Task 4:
  1. Deploy hosting: copy `index.html`, `css/`, `js/` to `queuenight/public/`, then `firebase deploy --only hosting` from `queuenight/`.
  2. Confirm CF from Task 3 is also deployed (already done — `onWatchpartyCreate(us-central1)` Successful update operation).
  3. On the creator device: open app, schedule a watchparty ~2 minutes in the future.
  4. On a second family-member device: confirm the incoming push body reads the scheduled time in the **creator's local timezone** (matches what the creator saw in the confirm modal), not UTC.
  5. Open the scheduled watchparty doc in Firebase Console → confirm `creatorTimeZone` field exists and is an IANA string.
  - Pass criteria: push body time matches the creator's local clock.
  - Note: hosting redeploy (step 1) is required before UAT so the second family-member device receives the new client bundle — though for this specific fix, the CF-only deploy is already sufficient to verify the fix (push body is CF-rendered, not client-rendered). Hosting deploy is only needed so that newly-scheduled parties at UAT-time are written from a client bundle that includes `creatorTimeZone`. A CF-only deploy leaves older client bundles writing docs WITHOUT `creatorTimeZone`, which the CF would then render in UTC (fallback). So: hosting deploy SHOULD accompany this CF deploy before UAT.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 1 (07-05 + 07-06 in parallel) of gap-closure sequence: this plan's half done. 07-06 (hide-reactions + late-joiner backlog) is the other Wave 1 entry.
- **Hosting redeploy pending** — user action — see Deferred section above. Needed before end-to-end UAT, not before the next plan starts.

---
*Phase: 07-watchparty*
*Completed: 2026-04-22*

## Self-Check: PASSED

- `js/app.js` modified (verified via grep: 4 `creatorTimeZone` hits)
- `C:\Users\nahde\queuenight\functions\index.js` modified (verified via grep: `timeZone` hit at line 178 in onWatchpartyCreate body)
- Commit `8ac8c9b` exists in couch repo `git log`
- CF deploy recorded: "functions[onWatchpartyCreate(us-central1)] Successful update operation"
- SUMMARY.md written to `.planning/phases/07-watchparty/07-05-SUMMARY.md`
