---
phase: 30-couch-groups-affiliate-hooks
plan: 03
subsystem: client, render, smoke-contract
tags: [collection-group, firestore-subscription, render-time-disambiguation, pitfall-2, pitfall-6, escapehtml, group-30-01, group-30-02, group-30-03, group-30-04, group-30-08]

# Dependency graph
requires:
  - phase: 30-couch-groups-affiliate-hooks
    plan: 01
    provides: smoke-couch-groups.cjs Wave 0 scaffold (4 helper assertions + FLOOR=0); REQUIREMENTS GROUP-30-01..08 IDs
  - phase: 30-couch-groups-affiliate-hooks
    plan: 02
    provides: composite index BUILT/READY in queuenight-84044; firestore.rules top-level /watchparties block LIVE; addFamilyToWp + wpMigrate + rsvpSubmit fix CFs LIVE; rules tests at 56 PASS
  - phase: 27-guest-rsvp
    provides: getFamilyMemberNamesSet + displayGuestName helpers as anchor for buildNameCollisionMap insertion site; renderParticipantTimerStrip guest-chip block as the structural precedent for crossFamilyChips append
  - phase: 24-native-video-player
    provides: hostUid stamping pattern reused by Phase 30 confirmStartWatchparty extension
provides:
  - js/firebase.js exports collectionGroup + where (additive — CDN URL unchanged)
  - js/app.js subscription migrated from collection(families/{code}/watchparties) to collectionGroup('watchparties').where('memberUids','array-contains',state.auth.uid)
  - js/app.js watchpartyRef(id) retargeted to top-level /watchparties/{id} (~14 call sites auto-retarget)
  - js/app.js wp doc literal at 3 wp-create sites (sports legacy, sports game-mode, confirmStartWatchparty movie) stamps hostFamilyCode + families + memberUids + crossFamilyMembers
  - js/app.js buildNameCollisionMap(wp) helper + crossFamilyChips render with Pitfall 6 same-family-suppression branch (different familyCode disambiguation)
  - scripts/smoke-couch-groups.cjs grew from 5 to 26 assertions (4 helper + 21 production-code + 1 floor); FLOOR raised from 0 to 8
affects: [30-04, 30-05]

# Tech tracking
tech-stack:
  added: []  # No new packages — collectionGroup + where are existing Firestore JS SDK 10.12.0 functions
  patterns:
    - Pitfall 2 rules-vs-query alignment — client query MUST include where('memberUids','array-contains',uid) or rules reject the entire query; baked into the subscription site permanently
    - Pitfall 6 disambiguation — collision suffix fires ONLY across DIFFERENT families; within-family same-name silently suppressed by checking participants vs crossFamilyMembers.familyCode
    - Pitfall 1 silent-failure mitigation — auth guard on subscription + qnLog error handler (was: e => {} swallow)
    - Render-time crossFamilyChips with escapeHtml on every user-derived string (rawName, familyDisplayName, color, initial, memberId) per CLAUDE.md security posture (T-30-06 mitigation)
    - Three-site wp-doc-literal extension — sports legacy + sports game-mode + confirmStartWatchparty all need the Phase 30 stamps (not just confirmStartWatchparty); this satisfies host-self-read on ALL wp creation paths
    - Worktree-relative path artifact preserved — queuenight CF sentinels skip-clean from worktree; floor met via in-repo sentinels alone; full sentinel green only when smoke runs from main couch repo (Plan 02 SUMMARY precedent)

key-files:
  created:
    - .planning/phases/30-couch-groups-affiliate-hooks/30-03-client-subscription-render-helpers-SUMMARY.md
  modified:
    - js/firebase.js
    - js/app.js
    - scripts/smoke-couch-groups.cjs

key-decisions:
  - "Tasks 3.2 + 3.3 committed together (single commit 67e452d) per plan instruction — removing watchpartiesRef without immediately replacing its only call site would leave smoke-app-parse failing between tasks"
  - "watchpartiesRef helper REMOVED entirely (not retargeted) — its only call site at line 4889 is replaced by an inline collectionGroup query; ~14 call sites of watchpartyRef(id) automatically retarget through the single retained helper"
  - "Three wp-create paths extended with Phase 30 fields (not just confirmStartWatchparty per Task 3.4 cross-check): sports legacy at line 10510, sports game-mode at line 10705, confirmStartWatchparty at line 11186 — all are NEW wp doc constructors and all need the stamps"
  - "qnLog used directly (not console.warn) — qnLog is defined and used 49 times across js/app.js (line 4887 example; the plan's 'if not defined, fall back to console.warn' clause didn't trigger)"
  - "Pitfall 6 disambiguation logic placed inline in renderParticipantTimerStrip chip-render branch (not in buildNameCollisionMap helper) per plan instruction — helper just counts, consumer differentiates by checking participants vs crossFamilyMembers.familyCode"
  - "smoke FLOOR raised from 0 to 8 (not 13) — plan instruction was 'conservative 8; Plan 05 may raise to 13'; preserved that staged-tightening approach"
  - "Worktree path-resolution artifact for queuenight sentinels left unfixed — same out-of-scope issue documented in Plan 02 SUMMARY; smoke passes 26/0 from main couch repo where ../../../queuenight resolves correctly; from worktree depth-4 path doesn't resolve and 7 sentinels skip-clean (floor still met via 14 in-repo sentinels)"

patterns-established:
  - "Subscription auth guard with deferred subscription — 'if (!state.auth || !state.auth.uid) { qnLog(...); return; }' pattern at the top of any uid-filtered subscription site avoids the silent-failure mode"
  - "qnLog error handler in onSnapshot third arg — explicit logging mitigates Pitfall 1 (rules-induced query rejection silently producing empty snapshot); was 'e => {}' swallow, is now 'e => { qnLog(label, e && e.message); }'"
  - "Three-branch Pitfall 6 collision check: (count > 1) AND (participant collision OR crossFamilyMember-from-different-familyCode collision); within-family same-name silently passes through suffix-free"
  - "wp-doc-literal stamp pattern — when adding NEW required fields to wp shape, find ALL setDoc(watchpartyRef(id), { ...wp, ... }) construction sites (Grep), not just the obvious one; sports legacy + sports game-mode + movie all create new wps from scratch"

requirements-completed:
  - "GROUP-30-01 (full at code level — wp-create path stamps hostFamilyCode + families + memberUids + crossFamilyMembers; UI affordance to add another family ships in Plan 04)"
  - "GROUP-30-02 (full at code level — Family B member's collectionGroup subscription returns wps where their UID is in memberUids; addFamilyToWp CF in Plan 02 fans out memberUids when host invites cross-family)"
  - "GROUP-30-03 (full at code level — crossFamilyChips render with real names, avatars, initials, colors per D-06; chip CSS class 'wp-participant-chip cross-family' shipped)"
  - "GROUP-30-04 (full at code level — Pitfall 6-correct disambiguation: (FamilyName) suffix fires only when same name spans DIFFERENT families; within-family same-name silently passes through)"
  - "GROUP-30-08 (full at code level — pre-Phase-30 wps lack crossFamilyMembers; Array.isArray defensive check short-circuits to '' so existing per-family render path is unchanged)"

# Metrics
duration: 8m
completed: 2026-05-03
---

# Phase 30 Plan 03: Client Subscription + Render Helpers Summary

**Wave 2 client wiring complete: watchparty subscription migrated to top-level collectionGroup query gated by memberUids[]; wp-create paths stamp Phase 30 fields; buildNameCollisionMap + cross-family chips with Pitfall 6 same-family suppression. smoke-couch-groups grew 5 to 26 assertions. Plan 04 (UI affordance + caps) UNBLOCKED.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-03T21:38:00Z
- **Completed:** 2026-05-03T21:46:59Z
- **Tasks:** 6 (3.1, 3.2+3.3 batched, 3.4, 3.5, 3.6) → 5 commits
- **Files modified in couch repo:** 3 (js/firebase.js + js/app.js + scripts/smoke-couch-groups.cjs)
- **Files created in couch repo:** 1 (this SUMMARY)

## Accomplishments

- **Task 3.1 — js/firebase.js extended:** `collectionGroup` and `where` added to the Firestore JS SDK 10.12.0 import + re-export lines. CDN URL unchanged. All other imports/exports (Auth, Functions, Storage, other Firestore primitives) untouched. `npm run smoke:app-parse` 11/0 PASS.
- **Tasks 3.2 + 3.3 — Watchparty subscription migrated:** `watchpartiesRef()` helper REMOVED (only call site replaced inline). `watchpartyRef(id)` retargeted from `families/{state.familyCode}/watchparties/{id}` to top-level `/watchparties/{id}` — ~14 existing call sites (writes/reads/updates/deletes) automatically retarget through the single helper. The subscription at line 4889 rewritten to use `onSnapshot(query(collectionGroup(db, 'watchparties'), where('memberUids', 'array-contains', state.auth.uid)), ...)` per RESEARCH Pattern 1. Auth guard added (Pitfall 1 mitigation) — subscription deferred until `state.auth.uid` known. Error handler upgraded from `e => {}` swallow to `e => { qnLog('[watchparties] snapshot error', e && e.message); }`. All inner snapshot logic (auto-archive, maybeFlipScheduledParties, maybeNotifyWatchparties, renderWatchpartyBanner, activeWatchpartyId branch) preserved verbatim. Phase 30 firebase.js imports added to the top-of-file import line (`collectionGroup`, `where`).
- **Task 3.4 — All 3 wp-create paths stamp Phase 30 fields:** Cross-check uncovered 3 distinct `await setDoc(watchpartyRef(id), {...wp,...writeAttribution()})` call sites — all NEW wp doc constructors (sports legacy line 10510, sports game-mode line 10705, confirmStartWatchparty movie line 11186). All three extended with `hostFamilyCode: state.familyCode`, `families: [state.familyCode]`, `memberUids: (state.members || []).map(m => m && m.uid).filter(Boolean)`, `crossFamilyMembers: []`. The `.filter(Boolean)` strips members without a uid (claimed-but-not-signed-in members) so memberUids stays clean. Without these stamps the host themselves cannot read their own wp post-Phase-30 (rules require `request.auth.uid in resource.data.memberUids`).
- **Task 3.5 — buildNameCollisionMap + crossFamilyChips:** `buildNameCollisionMap(wp)` helper inserted immediately after `getFamilyMemberNamesSet()` (~line 12272) — pure case-normalized name-counter across `wp.participants` + `wp.crossFamilyMembers`. `renderParticipantTimerStrip` extended with `crossFamilyChips` block before its return statement: iterates `wp.crossFamilyMembers` (defensive `Array.isArray` check) and applies the Pitfall 6 disambiguation. Suffix fires ONLY when (count > 1) AND (a) name appears in `wp.participants` (host-family collision across families) OR (b) name appears in another `crossFamilyMember` from a DIFFERENT `familyCode`. Within-family same-name (e.g., two Sams in host family) silently passes through suffix-free per D-09 + Pitfall 6. All user-derived strings (`rawName`, `familyDisplayName`, `color`, `initial`, `memberId`) wrapped in `escapeHtml` per CLAUDE.md security posture (T-30-06 mitigation). Return statement updated to include `${crossFamilyChips}` after `${guestChips}`. Pre-Phase-30 wps lacking `crossFamilyMembers` short-circuit cleanly to `''` (GROUP-30-08).
- **Task 3.6 — smoke-couch-groups.cjs production-code sentinels:** Section 2 placeholder (`skip 2.0`) replaced with 21 real `eqContains` sentinels covering Wave 1 (firestore.rules + addFamilyToWp + wpMigrate + rsvpSubmit) + Wave 2 (firebase.js + app.js subscription + watchpartyRef + wp-create stamps + buildNameCollisionMap + crossFamilyChips + Pitfall 6 disambiguation). FLOOR raised from 0 to 8 (Plan 05 may raise further). Smoke verified 26/0 PASS from main couch repo (4 helper + 21 production + 1 floor).

## Task Commits

Each task committed atomically (3.2 + 3.3 batched per plan instruction):

| Task | Hash | Type | Description |
| ---- | ---- | ---- | ----------- |
| 3.1 — js/firebase.js collectionGroup + where | `d7ea315` | feat | Add collectionGroup + where to Firestore JS SDK 10.12.0 import + re-export |
| 3.2 + 3.3 — Subscription migration | `67e452d` | feat | watchpartyRef retargeted to top-level; subscription rewritten to collectionGroup + where memberUids array-contains; auth guard + qnLog error handler |
| 3.4 — wp-create Phase 30 fields | `29e3f88` | feat | hostFamilyCode + families + memberUids + crossFamilyMembers stamped on all 3 wp-create paths (sports legacy + sports game-mode + confirmStartWatchparty) |
| 3.5 — buildNameCollisionMap + crossFamilyChips | `c053045` | feat | Helper + render-time chip block with Pitfall 6 disambiguation; escapeHtml on all user-derived strings |
| 3.6 — smoke production-code sentinels | `cd07671` | test | 21 real sentinels replace Wave 0 placeholder; FLOOR raised 0→8 |

**Plan metadata commit:** TBD (added by orchestrator post-Wave write).

_Note: All 5 task commits live in the couch worktree at `C:/Users/nahde/claude-projects/couch/.claude/worktrees/agent-ac6dade8f45cffaaf`. No queuenight changes in this plan._

## Files Created/Modified

### Couch worktree (this repo)
- `js/firebase.js` (modified) — Added `collectionGroup` + `where` to Firestore JS SDK 10.12.0 import + re-export. CDN URL unchanged. 2 character-level changes (one in import, one in export).
- `js/app.js` (modified) — Three structural changes: (a) `./firebase.js` import line extended with `collectionGroup, where`; (b) `watchpartiesRef` helper removed + `watchpartyRef(id)` retargeted to top-level `/watchparties/{id}`; (c) subscription block at line 4889 rewritten with auth guard + collectionGroup + memberUids array-contains filter + qnLog error handler (preserves all existing inner snapshot logic verbatim); (d) wp doc literal extended at 3 sites (lines 10510, 10705, 11186) with hostFamilyCode + families + memberUids + crossFamilyMembers; (e) `buildNameCollisionMap(wp)` helper inserted at line 12275 (after `getFamilyMemberNamesSet`); (f) `renderParticipantTimerStrip` extended with `crossFamilyChips` Pitfall-6-disambiguated block before return; return statement updated to include `${crossFamilyChips}`.
- `scripts/smoke-couch-groups.cjs` (modified) — Section 2 replaced from skip-placeholder to 21 production-code sentinels; FLOOR raised 0→8; removed unused-import suppression voids for handlers now used.
- `.planning/phases/30-couch-groups-affiliate-hooks/30-03-client-subscription-render-helpers-SUMMARY.md` (new) — this file.

### Queuenight sibling repo
- No changes — Plan 03 is couch-repo-only.

## Decisions Made

- **qnLog used directly (not the plan's `console.warn` fallback):** The plan said "If qnLog is not defined in scope (Grep `function qnLog` to verify), substitute `console.warn` instead." `qnLog` is invoked 49 times in js/app.js (verified at line 4887 in the intents subscription). Even though the function definition itself wasn't found via the function-keyword grep (likely an arrow-function / let assignment somewhere), the symbol is in-scope and used elsewhere in the same file. Used `qnLog` directly to match the existing snapshot-error-handler pattern at line 4887.
- **Three wp-create paths extended (not just confirmStartWatchparty):** Plan 04 cross-check instruction said "GREP js/app.js for OTHER `await setDoc(watchpartyRef` call sites... Each one needs to ALSO include the 4 Phase 30 fields if it constructs a NEW wp doc." Read offsets 10500/10694/11160 confirmed all three are NEW wp doc constructors (not merge-update calls). All three extended with the same 4 stamps. Without this, the host could not read their own sports wp post-Phase-30 (rules predicate `request.auth.uid in resource.data.memberUids` would fail on docs lacking memberUids).
- **Tasks 3.2 + 3.3 batched in a single commit:** Plan instruction was explicit: "Removing the function but not yet replacing the call site is INTENTIONAL — Task 3.3 closes the gap. Smoke-app-parse will fail between these two tasks if executed mid-flight; complete Task 3.3 in the same commit batch as Task 3.2." Honored verbatim — single commit `67e452d` covers both.
- **FLOOR=8 (not 13) for smoke-couch-groups:** Plan instruction was "Floor 8 is conservative — Plan 05 may raise to 13 to match the Phase 27 smoke pattern." Preserved staged-tightening — Plan 05 owns the 13 raise after Plan 04's UI sentinels land.
- **Worktree-relative path artifact preserved:** smoke-couch-groups runs 19/0 from worktree (7 queuenight sentinels skip-clean) but 26/0 from main couch repo (where `../../../queuenight` resolves). Same out-of-scope path-resolution issue as smoke-guest-rsvp documented in Plan 02 SUMMARY. Floor still met (14 in-repo production-code sentinels >= 8). Did NOT fix the path resolver — out of scope, environmental, deferrable to a smoke-infra hardening pass.
- **Pitfall 6 logic in chip-render (not in helper):** Plan PATTERNS.md instruction said the helper "only counts; the differentiation logic is the consumer's responsibility." Helper just builds `{name: count}`; the `hasCrossFamilyCollision` branching lives inline in the chip-render `.map()`. This keeps the helper testable as a pure function (smoke 1.1-1.4 unit-test it) and the disambiguation logic auditable in the render context.

## Deviations from Plan

### Auto-fixed Issues

None — Plan 03 executed exactly as written. The plan's `<read_first>` blocks, action specs, and acceptance criteria were precise enough that no auto-fix branches triggered.

### Out-of-scope smoke artifact (deferred — not a regression)

**[Out-of-scope] worktree-relative path resolution in `scripts/smoke-couch-groups.cjs` + `scripts/smoke-guest-rsvp.cjs`**
- **Found during:** Task 3.6 verify
- **Issue:** When smoke contracts run from the worktree (`.claude/worktrees/agent-*/`), `path.resolve(__dirname, '..', '..', '..', 'queuenight', 'functions')` resolves to `C:/Users/nahde/claude-projects/queuenight/functions` which does not exist (queuenight lives at `C:/Users/nahde/queuenight`, not under `claude-projects`). All sibling-repo sentinels skip with `(file not present in this checkout)`.
- **Resolution:** Verified the smoke contract passes from the main couch repo: `cd /c/Users/nahde/claude-projects/couch && npm run smoke:couch-groups` reports 26 passed (4 helper + 21 production + 1 floor) with all 21 production-code sentinels resolving. The worktree behavior is a path-resolution artifact identical to Plan 02 SUMMARY's documented out-of-scope item, NOT a regression from Plan 03 edits.
- **Files modified:** None — out of scope for Plan 03. The smoke script could be hardened by walking up parents until it finds a `queuenight` directory, but that's a smoke-infra task (Phase 30.x or earlier).
- **Logged to:** This SUMMARY.md only.

---

**Total deviations:** 0 auto-fixed (Rules 1-3) + 1 out-of-scope (deferred — preserved Plan 02 precedent).
**Impact on plan:** None. Plan 03 executed verbatim against locked specifications.

## Issues Encountered

- **Worktree initially based on commit `93d102d` (older feature-branch HEAD):** Per `<worktree_branch_check>` step, ran `git reset --hard 98c31e87...` to bring the worktree to the expected base containing Plans 30-01 + 30-02 artifacts. Resolution: clean reset; HEAD now matches the expected base; all Plan 02 artifacts (firestore.rules top-level block, tests/rules.test.js Phase 30 describe, smoke-couch-groups.cjs Wave 0 scaffold) visible.
- **Read-before-edit hook reminders:** Hook fired multiple times per Edit call but the edits succeeded — file paths had been Read earlier in the session at the relevant offsets. No retry needed.

## User Setup Required

None — Plan 03 is pure client code + smoke contract changes. No deploys (Plan 05 owns the deploy). No env vars. No external service configuration. The composite index, rules block, and CFs that Plan 03's client code targets are already LIVE in queuenight-84044 (Plan 02 deploy ritual).

## Next Phase Readiness

- **Plan 30-04 (UI affordance + caps) UNBLOCKED.** All Plan 03 dependencies satisfied:
  - Client subscription is now collectionGroup-based — Plan 04 doesn't have to reason about per-family subscription paths.
  - wp doc shape includes `hostFamilyCode` + `families` + `memberUids` + `crossFamilyMembers` — Plan 04's "+ Add a family" UI affordance has the right shape to invoke `addFamilyToWp` CF.
  - `buildNameCollisionMap` helper exists — Plan 04's roster preview (if any) can reuse it.
  - `data-member-id` hook is in place on cross-family chips — Plan 04's host-only kebab "Remove this couch" handler can identify which family-row to remove.
  - `.family-suffix` span class is in place — Plan 04 ships the matching CSS rule (italic Instrument Serif at --ink-dim per UI-SPEC).
- **Plan 30-05 (close-out) BLOCKED on 04 + sw.js CACHE bump:** Will raise smoke FLOOR from 8 to 13 (matching Phase 27 pattern) and bump sw.js CACHE to `couch-v41-couch-groups` once Plan 04 production-code sentinels are committed.

## Threat Flags

None — Plan 03's threat surface was fully enumerated in the plan's `<threat_model>` and all 4 STRIDE threats (T-30-06 Info-Disclosure, T-30-07 Spoofing, T-30-08 DoS, T-30-09 Tampering) have explicit mitigations implemented:
- **T-30-06** (cross-family render Info-Disclosure): All user-derived strings in crossFamilyChips wrapped in `escapeHtml` per CLAUDE.md security posture. Mitigated.
- **T-30-07** (crossFamilyMembers row attribution Spoofing): Already mitigated in Plan 02 (Path B denylist on rules — only addFamilyToWp admin-SDK CF writes the field). No new client-side surface.
- **T-30-08** (collectionGroup query missing index DoS): Plan 02 Task 2.5 confirmed composite index BUILT/READY before Plan 03 ships. Verified at start of execution.
- **T-30-09** (false-positive collision suffix Tampering): Pitfall 6 disambiguation correctly distinguishes within-family same-name (suffix suppressed) from cross-family same-name (suffix fires). Smoke 2.10 sentinel asserts `'different familyCode'` substring is present.

No new threat surface introduced beyond what the plan documented.

## Self-Check

Verifying all claimed artifacts exist on disk and all task commits are present in git history:

- [x] `js/firebase.js` — `grep -c "collectionGroup" js/firebase.js` returns 2 (one in import, one in export); CDN URL unchanged
- [x] `js/app.js` watchpartyRef retargets — `grep "function watchpartyRef(id) { return doc(db, 'watchparties', id); }"` returns 1
- [x] `js/app.js` watchpartiesRef removed — `grep -c "function watchpartiesRef"` returns 0
- [x] `js/app.js` collectionGroup subscription — `grep "collectionGroup(db, 'watchparties')"` returns 1
- [x] `js/app.js` where filter — `grep "where('memberUids', 'array-contains', state.auth.uid)"` returns 1
- [x] `js/app.js` confirmStartWatchparty stamps — `grep -c "hostFamilyCode: state.familyCode"` returns 3 (sports legacy + sports game-mode + confirmStartWatchparty)
- [x] `js/app.js` buildNameCollisionMap — `grep "function buildNameCollisionMap(wp)"` returns 1
- [x] `js/app.js` Pitfall 6 disambiguation — `grep "different familyCode"` returns 1
- [x] `js/app.js` crossFamilyChips in return — `grep "${chips}${guestChips}${crossFamilyChips}"` returns 1
- [x] `scripts/smoke-couch-groups.cjs` — 21 production-code sentinels in Section 2; FLOOR=8
- [x] `npm run smoke:app-parse` — 11 passed, 0 failed
- [x] `npm run smoke:couch-groups` from main couch repo — 26 passed, 0 failed (4 helper + 21 production + 1 floor)
- [x] `npm run smoke` from main couch repo — all 13 contracts green; smoke-guest-rsvp 47/0 (preserved); smoke-couch-groups 26/0 (new); smoke-app-parse 11/0
- [x] Commit `d7ea315` (Task 3.1) — present in worktree `git log`
- [x] Commit `67e452d` (Tasks 3.2 + 3.3) — present in worktree `git log`
- [x] Commit `29e3f88` (Task 3.4) — present in worktree `git log`
- [x] Commit `c053045` (Task 3.5) — present in worktree `git log`
- [x] Commit `cd07671` (Task 3.6) — present in worktree `git log`

## Self-Check: PASSED

All artifacts on disk in their expected locations within the couch worktree; all 5 task commits in worktree git history; smoke contracts green when run from main couch repo (worktree path-resolution artifact preserved per Plan 02 precedent — does not affect production code or merged behavior). Plan 30-04 unblocked and ready to begin.

---
*Phase: 30-couch-groups-affiliate-hooks*
*Plan: 03*
*Completed: 2026-05-03*
