---
phase: 07-watchparty
plan: 06
subsystem: ui
tags: [watchparty, reactions, render-path, optimistic-ui, wallclock, firestore]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "renderWatchpartyLive + renderReactionsFeed pipeline, setWpMode function, participant doc shape (reactionsMode, startedAt)"
  - phase: 07-watchparty
    provides: "Plan 07-05 creatorTimeZone capture (shipped alongside this deploy)"
provides:
  - "Pre-await optimistic render pattern in setWpMode — hide-reactions toggle gives instant feedback on the tapping device"
  - "renderReactionsFeed modeOverride param — lets callers force a specific render mode regardless of mine.reactionsMode"
  - "Late-joiner / pre-start-creator / re-joiner branch: render 'Ready when you are' prompt ABOVE wallclock-forced reactions backlog"
  - "Closes Gap #2a and Gap #3 from 07-UAT-RESULTS.md"
affects: [07-07-reaction-delay, 07-08-on-time-inference, all future watchparty render-path work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-await optimistic render for local UI preference toggles — mutate state + re-render SYNCHRONOUSLY before awaiting the Firestore write. Distinct from postReaction's post-await echo pattern (which awaits the write first, then mutates + renders). Pre-await used when (a) UX demands instant feel, (b) rollback is trivial (single primitive field + onSnapshot authoritative overwrite within ~1s), (c) failure mode is visually obvious (toggle snaps back, not frozen). 07-07's setReactionDelay will adopt the same shape."
    - "Optional modeOverride param on renderReactionsFeed — default-undefined semantics preserve existing call-site behavior while letting specific branches force 'wallclock' rendering for pre-start participants whose myElapsed == 0 would otherwise hide the entire backlog in the default elapsed filter."
    - "Render-branch narrowing: split a compound `!mine || !mine.startedAt` condition into distinct `!mine` vs `!mine.startedAt` branches when the two semantically different cases need different render trees (un-joined viewer gets the existing footer CTA; joined-but-not-started gets backlog + prompt)."

key-files:
  created: []
  modified:
    - "js/app.js — setWpMode (~7879): pre-await optimistic local mutation + synchronous renderWatchpartyLive() + lastActivityAt bookkeeping. +10 lines."
    - "js/app.js — renderWatchpartyLive body branch (~7624): split !mine || !mine.startedAt into !mine (unchanged) + !mine.startedAt (new wallclock-forced backlog render). +17 lines."
    - "js/app.js — renderReactionsFeed signature (~7703): added optional modeOverride 3rd param, threaded into mode resolution. +3/-1 lines."

key-decisions:
  - "Pre-await optimistic over post-await echo for setWpMode — rationale: mode toggle is a local UI preference that must feel instant like any native UI control; rollback via onSnapshot authoritative write is trivial for a single primitive field."
  - "Un-joined viewer (!mine) branch preserved VERBATIM — the footer's 'Join late' button is the single CTA for that case; adding H2/body copy in the body would create a redundant/conflicting action. Fix scope is the mine && !mine.startedAt case only."
  - "Re-join case (member leaves + re-joins → fresh participant record with no startedAt) gets the same wallclock override automatically — consistent with first-join. Noted in plan's risk_notes Q1 and accepted."
  - "Creator pre-start (host who hasn't tapped Start my timer yet) gets the same branch — they see other early-joiners' reactions wallclock-sorted. Non-spoiling because they haven't started watching. Noted in plan risk_notes Q2 and accepted."
  - "lastActivityAt: Date.now() added to setWpMode's updateDoc payload for consistency with Phase 7 Plan 01's orphan-detection bookkeeping (the D-06 auto-archive threshold source of truth)."

patterns-established:
  - "Pre-await optimistic render: for local UI preference toggles (hide/show, delay, mode), mutate local state + re-render BEFORE awaiting the Firestore write. Reserves post-await echo for semantically-server operations (posting a message, reacting)."
  - "Mode override as an optional param on a render helper — preserves existing call-site ergonomics while giving specific branches the ability to force a render mode orthogonal to the persisted user preference."
  - "When compound conditions render to different DOM shapes, split the branches rather than conditionally weaving sub-blocks — easier to reason about, easier to scope-gate (un-joined branch can be preserved VERBATIM while joined-pre-start branch is rebuilt)."

requirements-completed: [PARTY-03, PARTY-04]

# Metrics
duration: 2min
completed: 2026-04-22
---

# Phase 7 Plan 6: Watchparty Render-Path Gap Closure Summary

**Hide-reactions toggle now gives instant on-device feedback via pre-await optimistic render, and late joiners see the full reaction backlog in wallclock order above a 'Ready when you are' prompt — closing Gaps #2a and #3 from 07-UAT-RESULTS.md.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-04-22T00:24:35Z
- **Completed:** 2026-04-22T00:26:05Z
- **Tasks:** 2 shipped + 1 deferred to /gsd-verify-work (UAT)
- **Files modified:** 1 (js/app.js)

## Accomplishments

- **Gap #2a closed (hide-reactions toggle instant feedback):** `setWpMode` now optimistically mutates `wp.participants[uid].reactionsMode` and calls `renderWatchpartyLive()` synchronously BEFORE the `updateDoc` await. The tapping device sees the feed collapse to the hidden-placeholder immediately — no modal close/reopen required. `lastActivityAt: Date.now()` added to the updateDoc payload for orphan-detection consistency.
- **Gap #3 closed (late-joiner empty-feed):** `renderReactionsFeed` accepts an optional 3rd `modeOverride` param; `renderWatchpartyLive` splits the `!mine || !mine.startedAt` branch so joined-but-not-started participants render the "Ready when you are" prompt ABOVE the participant strip + wallclock-forced reactions feed. Un-joined viewers (`!mine`) remain VERBATIM — footer "Join late" button is still their single CTA.
- **Hosting deploy successful** — `firebase deploy --only hosting` from `queuenight/` shipped 47 files to `queuenight-84044.web.app`. This redeploy also carries Plan 07-05's creatorTimeZone client capture to production, unblocking that plan's Scenario 1 UAT repro.

## Task Commits

1. **Task 1: setWpMode pre-await optimistic render (Gap #2a)** — `674afae` (fix)
2. **Task 2: Late-joiner wallclock override — renderReactionsFeed modeOverride + renderWatchpartyLive branch split (Gap #3)** — `d873e62` (fix)

**Plan metadata:** `<final>` (docs — this file + STATE.md + ROADMAP.md update)

## Files Created/Modified

- `js/app.js` — +30/-3 lines across 3 sites:
  - `window.setWpMode` (~7879): +10 lines (optimistic mutation + synchronous render + `lastActivityAt` payload)
  - `renderWatchpartyLive` body construction (~7624): +17 lines (new `!mine.startedAt` branch with prompt + wallclock-forced feed)
  - `renderReactionsFeed` signature (~7703): +3/-1 lines (optional `modeOverride` param threaded into mode resolution)

## Decisions Made

- **Pre-await optimistic for setWpMode** over post-await echo — mode toggles are local UI preferences requiring instant feel; rollback via onSnapshot authoritative overwrite is trivial for a single primitive field. See plan `risk_notes` for full rationale.
- **Un-joined viewer (!mine) branch preserved verbatim** — the footer's "Join late" button is the correct and only action; no new H2/body copy added to avoid a redundant/conflicting CTA. Fix scope was strictly the `mine && !mine.startedAt` sub-branch.
- **Re-join + creator-pre-start cases** get the same wallclock override automatically (they share the `!mine.startedAt` branch). Both called out in plan `risk_notes` Q1/Q2 and accepted.
- **lastActivityAt: Date.now()** added to setWpMode's updateDoc payload for consistency with the Phase 7 D-06 auto-archive orphan-detection contract.

## Deviations from Plan

None — plan executed exactly as written. All grep acceptance criteria pass on first verification:

- `grep -n "window.setWpMode" js/app.js` → shows optimistic mutation + `renderWatchpartyLive()` call BEFORE the `await updateDoc` (lines 7887-7890)
- `grep -n "lastActivityAt" js/app.js` → 4 hits total (3 pre-existing + 1 new inside setWpMode at line 7894)
- `grep -n "modeOverride" js/app.js` → 3 hits (param decl + comment + mode resolution) — meets `≥2` bar
- `grep -n "renderReactionsFeed(wp, mine, 'wallclock')" js/app.js` → exactly 1 hit (line 7643, the `!mine.startedAt` branch)
- `grep -n "renderReactionsFeed(wp, mine)" js/app.js` → still present at line 7649 (default post-start branch — unchanged 2-arg call)
- `grep -n "Ready when you are" js/app.js` → 2 instances (un-joined branch at line 7629 preserved verbatim + new joined-pre-start branch at line 7639)
- `node --check js/app.js` → OK (syntax clean)

## Issues Encountered

None.

## Authentication Gates

None — `firebase deploy --only hosting` ran cleanly, existing session credentials valid. Deploy output: `+ hosting[queuenight-84044]: release complete` with 47 files uploaded.

## Deferred

- **Task 3 (UAT human-verify — Gaps #2a + #3)** deferred to `/gsd-verify-work 7`. Project pattern is "deploy first, UAT later" (Phases 6 and 8 also deployed-UAT-pending; Plan 07-05 also deferred). UAT reproduction steps, verbatim from plan Task 3:

  **Cache invalidation note:** no manual `?v=` bump needed in `index.html` — Firebase Hosting + PWA service worker handle invalidation on deploy (confirmed by current prod deploys shipping without a version query at `index.html:54` and `:984`).

  1. Copy `index.html`, `css/`, `js/` to `queuenight/public/`, then `firebase deploy --only hosting` from `queuenight/`. **(Already done as part of this plan's shipping step — 2026-04-22T00:26Z.)**
  2. **Gap #2a verification (hide reactions):**
     - Open watchparty live modal on iPhone PWA. Start your timer.
     - Tap "Hide reactions" → feed collapses to "Reactions hidden" placeholder **immediately** (no modal close/reopen).
     - Tap the same button (now "Reactions off") → feed returns.
     - Second device observes the mode change via snapshot (unchanged from today's behavior — regression check).
  3. **Gap #3 verification (late-joiner backlog, joined path):**
     - Device A hosts + starts timer + posts 3 reactions.
     - Device B joins the watchparty (do NOT tap "Start my timer").
     - Device B sees: "Ready when you are" header, then the participant strip (A chipped as "X min in"), then all 3 reactions below in wall-clock order.
     - Device B taps "Start my timer". Feed switches to elapsed mode. See plan risk_notes for expected behavior of the backlog at this moment (backlog vanishes because myElapsed == ~0ms in elapsed filter — this is the known Plan 07-08 follow-up).
  4. **Un-joined viewer regression check (!mine branch unchanged):**
     - Device C is a family member who is NOT a participant in the watchparty. Opens the live-modal view.
     - Sees the ORIGINAL "Ready when you are" placeholder (unchanged copy) AND the footer "Join late" button. Only one CTA (the footer button). No redundant H2/body telling them to "Join the party."
  5. **Regression check (unchanged cases):**
     - Existing active participant (mine.startedAt is set): feed renders via their configured mode, unchanged from today.
     - Pause/resume: still works.
     - Post reaction: still works (postReaction's own post-await echo pattern unchanged).

  **Pass criteria:** both bugs resolved as described. Regression cases unchanged.

  **Resume signal:** `both-pass` with a note on each; or `2a-pass 3-fail: <details>` / `2a-fail 3-pass: <details>` to route the failing piece back for fix. 2a is surgical (one function, pre-await optimistic shape); 3 is two coordinated edits (param threading + branch split). Most likely failure mode for 3 is the un-joined (!mine) branch being accidentally altered — verify it renders EXACTLY the old copy, not the new "Ready when you are" prompt shape for joined-pre-start.

- **Known Plan 07-08 follow-up (not a deviation, pre-called in plan risk_notes):** once a late joiner taps "Start my timer", their reactionsMode defaults to 'elapsed' and `myElapsed` starts at ~0ms → the elapsed filter at ~7700 hides everything they were just seeing in wallclock mode. Backlog vanishes the instant they press Start and only catches up as their own timer advances. Decision deferred to Plan 07-08 (Gap #4 / on-time inference) since the fix overlaps with `effectiveStart = startAt` semantics. Called out here so UAT doesn't flag it as a new regression.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 1 of gap-closure COMPLETE** — both 07-05 (creatorTimeZone/push body) and 07-06 (hide-reactions + late-joiner) now shipped. Wave 2 = 07-07 (reaction delay) can proceed. Wave 3 = 07-08 (on-time inference) follows.
- **Hosting redeploy carried 07-05 client changes to prod** — `creatorTimeZone` field will now be written on new wp docs by any device running the production bundle. This unblocks 07-05's Scenario 1 UAT repro ("11pm EDT push body reads '11:00 PM' not '3:00 AM'").
- **07-05 + 07-06 UAT both deferred to `/gsd-verify-work 7`** — single consolidated UAT pass across both Wave 1 fixes (plus any prior Phase 7 work the verifier wants to re-check).
- **Next plan:** 07-07 (reaction delay, Wave 2) per ROADMAP. Depends on this plan's `modeOverride` pattern being available in renderReactionsFeed.

---
*Phase: 07-watchparty*
*Completed: 2026-04-22*

## Self-Check: PASSED

- `js/app.js` modified — grep verified:
  - `modeOverride`: 3 hits in renderReactionsFeed region (param + comment + mode resolution)
  - `renderReactionsFeed(wp, mine, 'wallclock')`: 1 hit at line 7643
  - `renderReactionsFeed(wp, mine)` (2-arg): still present at line 7649
  - `"Ready when you are"`: 2 hits (un-joined at 7629, joined pre-start at 7639)
  - `lastActivityAt` in setWpMode: new hit at line 7894
- Commits `674afae` + `d873e62` exist in couch repo `git log`
- `node --check js/app.js` → OK (syntax clean)
- Hosting deploy successful: `queuenight-84044.web.app` — 47 files, release complete
- SUMMARY.md written to `.planning/phases/07-watchparty/07-06-SUMMARY.md`
