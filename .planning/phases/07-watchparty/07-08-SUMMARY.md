---
phase: 07-watchparty
plan: 08
subsystem: ui
tags: [watchparty, on-time-inference, effective-start, elapsed-anchor, optimistic-ui, firestore, gap-closure]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "renderWatchpartyLive render pipeline + renderParticipantTimerStrip chip surface (07-03 baseline, 07-06 late-joiner branch consumer)"
  - phase: 07-watchparty
    provides: "setReactionDelay persist fn in the ~7950 cluster (07-07) — claimStartedOnTime inserts immediately after it so the two plans do not conflict"
provides:
  - "ONTIME_GRACE_MS = 60s constant + effectiveStartFor(participant, wp) helper — 3-case cascade resolving the correct elapsed-time anchor (explicit override → on-time inference → startedAt fallback)"
  - "computeElapsed 2-arg signature (participant, wp) — all 7 call sites migrated; NO default for wp so a missed call site becomes an obvious anchor regression instead of silent wrong-anchor"
  - "window.claimStartedOnTime persist fn — 5th fn in the watchparty cluster (setWpMode / toggleWpPause / leaveWatchparty / setReactionDelay / claimStartedOnTime), adopts 07-06's pre-await optimistic shape verbatim"
  - "Contextual on-time control on OWN participant chip — 'I started on time' claim button when late+no-override, 'On time ✓' revert badge when override set, nothing otherwise (default inference is invisible)"
  - "CSS .wp-ontime-claim + .wp-ontime-revert — secondary-affordance styling (subtle, does not compete with .wp-control-btn primary weight)"
  - "Closes 07-UAT-RESULTS.md Issue #4 (pre-start / on-time anchor gap) — final gap in the 07-05/06/07/08 gap-closure wave"
affects: [all future watchparty elapsed-time consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-await optimistic adopted for 3rd time (setWpMode 07-06 → setReactionDelay 07-07 → claimStartedOnTime 07-08) — confirms this as the canonical shape for local UI preference toggles on Firestore-backed primitives. Mutate local state + synchronous render BEFORE await updateDoc; rollback via onSnapshot authoritative overwrite for a single primitive field."
    - "3-case cascade for derived state: explicit-override → default-inference → base-case fallback. Keeps the common case (most joiners are pre-start or within grace) handled with zero state writes while preserving a deterministic escape hatch (manual override) for the edge case."
    - "Contextual UI control: rendered only when (isMe && isLate && !hasOverride) OR (isMe && hasOverride). Invisible when irrelevant (pre-start joiners with passive inference, non-me chips, late joiners post-override-then-revert with joinedAt anchor active). Matches 07-07's mode-scoped hide-when-inert pattern."
    - "Grace window for on-time inference (ONTIME_GRACE_MS=60s): a single tunable constant at module top. Balances 'too short (legit on-time users mis-anchored)' vs 'too long (90s-late user surprised by on-time treatment)'."

key-files:
  created: []
  modified:
    - "js/app.js — ~1735-1780 (helpers): +ONTIME_GRACE_MS constant + effectiveStartFor helper + computeElapsed signature change. +29/-8 lines."
    - "js/app.js — 7 computeElapsed call sites updated to 2-arg form (3173, 3196, 7553, 7640, 7743, 7787, 7910). +7/-7 lines (1:1 swap)."
    - "js/app.js — renderParticipantTimerStrip (~7785-7810): inject contextual on-time control on OWN chip. +17 lines."
    - "js/app.js — new window.claimStartedOnTime (~8029-8048): pre-await optimistic persist fn placed immediately after setReactionDelay. +32 lines."
    - "css/app.css — new .wp-ontime-claim + .wp-ontime-revert rules (lines 717-720) + hover states. +5 lines."

key-decisions:
  - "NO default value for wp in computeElapsed signature — plan's explicit instruction. Missing 2nd arg is a bug, not a backward-compat fallback. Post-edit grep enforces all 8 sites are 2-arg."
  - "Two commits per plan commit_strategy — (1) default on-time inference as a clean passive improvement (no UI), (2) manual override UI + persist fn as a reviewable feature unit. Respected verbatim from frontmatter."
  - "Pre-await optimistic for claimStartedOnTime (3rd adoption of 07-06 pattern) — same rationale as setWpMode and setReactionDelay. Explicitly NOT postReaction's post-await echo."
  - "ONTIME_GRACE_MS = 60s — matches plan risk_notes planner discretion. Single tuning point at module top; revisit based on UAT ergonomics."
  - "Control placement on own participant chip only (isMe branch) — contextual, visible only when actionable. Alternative (footer row) would be less discoverable and crowd the already-full footer with delay chips + mode toggles."
  - "hasOverride check via typeof p.effectiveStartAt === 'number' — excludes null (revert sentinel) and undefined (never-set). The helper cascades to default inference for null/undefined, which is the correct behavior."
  - "isLate check uses joinedAt (RSVP gesture timestamp), not startedAt — a user who joined pre-start but hasn't tapped Start my timer is NOT late; they're a pre-start joiner who gets default inference anchored to startAt automatically."
  - "lastActivityAt: Date.now() on the persist write — consistent with setWpMode + setReactionDelay + Phase 7 D-06 orphan-detection bookkeeping contract."

patterns-established:
  - "Elapsed-anchor resolution via 3-case cascade (override → inference → fallback) in a single helper — future elapsed-anchor tweaks (different grace windows per wp type, host-broadcast anchor, etc.) layer into the same helper without touching call sites."
  - "Signature changes with no default — 'if you missed a call site, we want a loud failure, not a silent wrong result.' Complements post-edit grep as the safeguard for cascading edits."
  - "Contextual per-user chip controls: inject into renderParticipantTimerStrip's per-chip map, gated on isMe + state predicates. Same pattern will generalize for any future 'only-my-chip' affordance (mute self, set per-user color, etc.)."

requirements-completed: [PARTY-03]

# Metrics
duration: 3min
completed: 2026-04-22
---

# Phase 7 Plan 8: On-Time Inference + Manual Override Summary

**Watchparty elapsed-time now auto-anchors pre-start and on-time joiners to `wp.startAt` via a 60s-grace inference helper, and late joiners get a one-tap "I started on time" override on their own participant chip — closing the final gap (#4) from 07-UAT-RESULTS.md and completing the Phase 7 gap-closure wave.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-22T00:38:43Z
- **Completed:** 2026-04-22T00:41:32Z
- **Tasks:** 4 code tasks shipped + 1 UAT deferred to /gsd-verify-work 7
- **Files modified:** 2 (js/app.js, css/app.css)
- **Commits:** 2 feature commits (per plan commit_strategy — split default inference from manual override)

## Accomplishments

- **Issue #4 closed (on-time anchor for watchparty elapsed time).** Two sub-features delivered as separate commits:
  - **Commit 1 (default on-time inference, passive — no UI, no Firestore write):**
    - `ONTIME_GRACE_MS = 60 * 1000` constant at module top (single tuning point).
    - `effectiveStartFor(participant, wp)` helper — 3-case cascade: (a) explicit `effectiveStartAt` override wins; (b) `joinedAt <= wp.startAt + grace` → return `wp.startAt` (on-time inference); (c) fall back to `participant.startedAt`; (d) null when no timer started.
    - `computeElapsed` signature changed from `(participant)` to `(participant, wp)`. NO default for `wp` — by design: any missed call site becomes an obvious anchor regression, not a silent wrong-anchor. All 7 call sites migrated to 2-arg form (enumerated in plan Task 2 table — 3173, 3196, 7553, 7640, 7743, 7787, 7910).
    - Sports watchparties benefit transparently: kickoff time = `wp.startAt`, so fans joining within the grace window auto-anchor to kickoff.
  - **Commit 2 (manual override UI + persist fn):**
    - `window.claimStartedOnTime(wpId, opts)` — adopts 07-06's pre-await optimistic shape verbatim (mutate `mine.effectiveStartAt` + synchronous `renderWatchpartyLive()` BEFORE `await updateDoc`). Toggle semantic: `opts.toggleOff === true` reverts to `null` (cascades back to default inference). Placed immediately after `setReactionDelay` in the persist-fn cluster — cluster order is now `setWpMode` → `toggleWpPause` → `setWpMode` mode (07-06) → `setReactionDelay` (07-07) → `claimStartedOnTime` (07-08) → `leaveWatchparty`.
    - `renderParticipantTimerStrip` injects a contextual on-time control on the OWN chip only (`isMe === true`): `I started on time` button when `isLate && !hasOverride`, `On time ✓` revert badge when `hasOverride`, nothing otherwise. Non-me chips + pre-start / on-time joiners see nothing — default inference is invisible by design.
    - CSS: `.wp-ontime-claim` (neutral subtle underlined text-link feel) + `.wp-ontime-revert` (soft accent-tint pill with checkmark). Both ≥32px min-height for mobile tap target. Secondary-affordance styled — deliberately does not compete with `.wp-control-btn` primary weight.
- **Hosting deploy successful** — `firebase deploy --only hosting` from `C:/Users/nahde/queuenight/` shipped 47 files to `queuenight-84044.web.app`, release complete.

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1, 2 | Default on-time inference (helper + signature + 7 call sites) | `3be3575` | feat |
| 3, 4 | Manual override (persist fn + UI + CSS) | `28e3622` | feat |

Plan commit_strategy (from frontmatter): "two commits — (1) default on-time inference (passive, no new UI); (2) manual 'I started on time' override UI + persist fn." Honored verbatim.

## Files Created/Modified

- **js/app.js — +85/-15 lines:**
  - `ONTIME_GRACE_MS` constant + `effectiveStartFor` helper (~1739-1755): +17 lines
  - `computeElapsed` signature + body rewrite (~1762-1775): +12/-8 lines
  - 7 call sites updated to 2-arg form (3173, 3196, 7553, 7640, 7743, 7787, 7910): +7/-7 lines net (1:1 swap)
  - `renderParticipantTimerStrip` contextual on-time control (~7790-7809): +17 lines
  - `window.claimStartedOnTime` persist fn (~8017-8048): +32 lines
- **css/app.css — +5 lines (after `.wp-control-btn.wp-delay` at line 715):** `.wp-ontime-claim`, `.wp-ontime-claim:hover`, `.wp-ontime-revert`, `.wp-ontime-revert:hover`, plus comment.

## Decisions Made

- **Two commits over one, per plan commit_strategy.** Default inference is a clean passive improvement that ships fine on its own (no UI, no state writes); manual override is a reviewable UI + persist feature unit. Splitting clarifies the diff for reviewers.
- **NO default `wp = undefined` in computeElapsed signature.** Explicit plan instruction: a missed call site becomes an obvious anchor regression instead of silent wrong-anchor. Grep after the edit enumerates all 8 hits (1 def + 7 2-arg calls); zero 1-arg stragglers.
- **Pre-await optimistic for claimStartedOnTime (3rd adoption of 07-06's pattern).** Same rationale as setWpMode + setReactionDelay: override toggle is a local UI preference where zero-latency feel matters and rollback is trivial via onSnapshot authoritative overwrite for a single primitive field. Explicitly NOT postReaction's post-await echo pattern.
- **ONTIME_GRACE_MS = 60s** per plan risk_notes planner discretion. Single tuning point at module top; revisit from UAT ergonomics.
- **Control placement on OWN participant chip only.** Contextual, visible only when actionable. Alternative (footer row) would be less discoverable and crowd the already-full footer (delay chips + mode toggles + pause/done).
- **hasOverride check via `typeof p.effectiveStartAt === 'number'`** excludes both null (revert sentinel) and undefined (never-set). The helper cascades to default inference for null/undefined — correct behavior.
- **isLate check uses joinedAt, not startedAt.** A user who joined pre-start but hasn't tapped "Start my timer" is NOT late; they're a pre-start joiner who gets default inference anchored to startAt automatically. Using startedAt would false-positive them and show an unneeded override button.
- **Control placement inside `.wp-participant-info`** (not after it) so the chip keeps consistent height and the button aligns with the time label vertically.
- **lastActivityAt: Date.now() on the persist write** — consistent with setWpMode + setReactionDelay + Phase 7 D-06 orphan-detection bookkeeping contract.

## Deviations from Plan

None — plan executed exactly as written. All grep acceptance criteria pass on first verification:

- `grep -n "effectiveStartFor" js/app.js` → 2 hits (def at 1746 + usage at 1764 inside `computeElapsed`). Required ≥2 ✓
- `grep -n "effectiveStartAt" js/app.js` → 5 hits (helper read 1748, UI comment 7795, UI hasOverride branch 7799, persist mutation 8038, updateDoc key 8042). Required ≥4 ✓
- `grep -n "claimStartedOnTime" js/app.js` → 3 hits (def 8029 + 2 UI onclick handlers 7801 and 7803). Required ≥3 ✓
- `grep -n "ONTIME_GRACE_MS" js/app.js` → 3 hits (const 1739 + helper usage 1750 + UI isLate check 7798). Required ≥2 ✓
- `grep -n "computeElapsed(" js/app.js` → 8 hits (1 definition at 1762 + 7 2-arg calls at 3173, 3196, 7553, 7640, 7743, 7787, 7910). **Zero 1-arg stragglers.** Required exactly 8 ✓
- `grep -n "wp-ontime" js/app.js` → 2 hits (7801 revert class + 7803 claim class). Required ≥2 ✓
- `grep -n "wp-ontime" css/app.css` → 4 hits (.wp-ontime-claim + hover + .wp-ontime-revert + hover). Required ≥2 ✓
- `node --check js/app.js` → OK (syntax clean)

## Issues Encountered

None.

## Authentication Gates

None — `firebase deploy --only hosting` ran cleanly; existing session credentials valid. Deploy output: `+ hosting[queuenight-84044]: release complete` with 47 files uploaded.

## Deferred

- **Task 5 (UAT human-verify — on-time inference + override + reaction-delay interaction)** deferred to `/gsd-verify-work 7` per project pattern (07-05, 07-06, 07-07 all deferred their UAT to the same verifier run). UAT reproduction steps, verbatim from plan Task 5:

  **Cache invalidation note:** no manual `?v=` bump needed in `index.html` — Firebase Hosting + PWA service worker handle invalidation on deploy.

  1. Copy `index.html`, `css/`, `js/` to `queuenight/public/`, `firebase deploy --only hosting`. **(Already done as part of this plan's shipping step — commits `3be3575` + `28e3622` deploy release complete 2026-04-22.)**
  2. **Default on-time inference (pre-start joiner):**
     - From device A, schedule a party 2 min out.
     - Device B joins immediately (while still in `scheduled` state). This captures joinedAt ≤ startAt.
     - Wait for flip to active.
     - Both devices tap Start my timer when they "press play."
     - Both chips in the strip should show elapsed anchored to startAt, not to when they tapped Start my timer. (A "Just started" chip at T=startAt+3s should read computed from startAt — not from the +3s startedAt.)
  3. **Grace window:**
     - Device C joins at startAt + 30 seconds (within the 60s grace). They should also be treated as on-time — chip reads elapsed from startAt.
  4. **Late joiner without override:**
     - Device D joins at startAt + 5 minutes. Their chip reads "Just started" immediately on joining (anchored to joinedAt).
     - Their own chip shows the "I started on time" affordance.
  5. **Late joiner with override:**
     - Device D taps "I started on time."
     - Chip's elapsed jumps to ~5 min. Badge now reads "On time ✓".
     - Other devices (A/B/C) see D's chip update via snapshot — D is now chipped at ~5 min in, not "Just started".
  6. **Revert:**
     - Device D taps "On time ✓" badge → reverts to joinedAt anchor. Chip back to fresh elapsed.
  7. **Reaction-delay interaction (cross-check with 07-07):**
     - With effectiveStartAt set, reaction-delay from 07-07 should shift AGAINST the effective-start-anchored elapsed. Post a reaction from device A at A's elapsed = 1 min. Device D (override set, 5 min in from startAt) with delay=0 sees the reaction immediately. Device D with delay=30s still sees it immediately because D's effective elapsed (5 min) >> 1 min even after the 30s shift.
     - Set device D delay = 30s AND revert override (back to joinedAt anchor). Now D's elapsed ≈ 0. The 30s delay means reactions posted at elapsed < -30s don't render — but A's reaction is at elapsed = 1 min from startAt which is way before D's effective now → reaction doesn't render until D's elapsed catches up. Verify.

  **Pass criteria:** all 7 sub-checks pass as described. No regression on 07-06 backlog (a device joining late with no override should still see the wallclock backlog above "Ready when you are"). No regression on 07-07 reaction-delay (delay shifts still behave correctly, just against a different anchor).

  **Resume signal:**
  - `ontime-pass` with notes.
  - `fail: <sub-check>` — routing:
    - (2) failing = inference branch in effectiveStartFor wrong (walk through with joinedAt=startAt-5s, grace=60s → should hit inference branch)
    - (4) failing = isLate computation wrong in the strip (check operand ordering)
    - (5) failing = claimStartedOnTime not writing correctly; inspect Firestore doc for effectiveStartAt field post-tap
    - (6) failing = toggleOff branch in claimStartedOnTime not setting null (FieldValue.delete() vs explicit null — we use null)
    - (7) failing = computeElapsed not receiving wp at one of the 7 call sites (most likely one of 3173, 3196, 7553, 7640 if wp-scope resolution was skipped); re-grep `computeElapsed(` and check every hit is 2-arg

- **Known mixed-anchor reaction-delay edge case** (explicitly pre-called in plan risk_notes, NOT in scope here): after 07-08 ships effectiveStartAt, a reaction's `elapsedMs` is set by postReaction at time-of-post using the POSTER's anchor (via `computeElapsed(mine, wp)` which resolves through the poster's effectiveStartFor). The viewer's `myElapsed` uses the VIEWER's anchor. If the two participants have different anchors, the 07-07 delay filter compares `r.elapsedMs` (poster-anchored) against `myElapsed - delayMs` (viewer-anchored) — incompatible coordinate spaces. In rare mixed-anchor cases this surfaces reactions earlier or later than expected. NOT BLOCKING: the 60s grace + default inference means most participants share the startAt anchor naturally; the mismatch window is narrow. Suggested future work: at render time, normalize `r.elapsedMs` into `wp.startAt`-anchored coordinates before comparing to `myElapsed`. Track as a follow-up plan candidate.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Phase 7 gap-closure Wave 3 COMPLETE — Phase 7 is now fully gap-closed** (07-05, 07-06, 07-07, 07-08 all shipped + deployed). The only remaining Phase 7 item is consolidated UAT via `/gsd-verify-work 7`.
- **Hosting redeploy carried all 4 gap-closure plans to prod** — prior 07-05/06/07 UAT scenarios can now be re-verified on the same production bundle.
- **No new tech-stack additions** — pure JS + CSS, no new libraries or infrastructure.
- **Schema impact:** Firestore participant docs gain one optional number field (`effectiveStartAt`). No new trust boundary; STRIDE register unchanged per plan risk_notes. Helper cascades gracefully on legacy docs without the field (falls through to default inference or startedAt).
- **Next plan:** Phase 8 UAT + Phase 5/6/7 verifier rollup via `/gsd-verify-work 7` (and potentially `/gsd-verify-work 5`, `/gsd-verify-work 6`). No new plans queued in Phase 7 — gap closure complete.

---
*Phase: 07-watchparty*
*Completed: 2026-04-22*

## Self-Check: PASSED

- `js/app.js` modified — grep verified:
  - `computeElapsed(`: 8 hits (1 def + 7 2-arg calls; zero 1-arg stragglers)
  - `effectiveStartFor`: 2 hits (def 1746 + usage in computeElapsed 1764)
  - `effectiveStartAt`: 5 hits (helper 1748, UI comment 7795, UI branch 7799, persist mutation 8038, updateDoc key 8042)
  - `claimStartedOnTime`: 3 hits (def 8029 + 2 UI onclick handlers 7801/7803)
  - `ONTIME_GRACE_MS`: 3 hits (const 1739, helper 1750, UI isLate 7798)
  - `wp-ontime`: 2 hits (7801 revert class, 7803 claim class)
- `css/app.css` modified — grep verified: `wp-ontime` at lines 717 (.wp-ontime-claim), 718 (:hover), 719 (.wp-ontime-revert), 720 (:hover) = 4 hits
- Commits `3be3575` + `28e3622` exist in couch repo `git log`
- `node --check js/app.js` → OK (syntax clean)
- Hosting deploy successful: `queuenight-84044.web.app` — 47 files, release complete
- SUMMARY.md written to `.planning/phases/07-watchparty/07-08-SUMMARY.md`
