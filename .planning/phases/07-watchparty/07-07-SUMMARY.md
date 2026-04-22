---
phase: 07-watchparty
plan: 07
subsystem: ui
tags: [watchparty, reactions, reaction-delay, optimistic-ui, firestore, viewer-side-filter]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "renderReactionsFeed with modeOverride param (07-06), pre-await optimistic render pattern established in setWpMode (07-06)"
  - phase: 07-watchparty
    provides: "participant doc shape + reactionsMode field (07-03 baseline, 07-06 consumer)"
provides:
  - "window.setReactionDelay persist fn — 4th fn in the setWpMode cluster (setWpMode / toggleWpPause / leaveWatchparty / setReactionDelay). Adopts 07-06's pre-await optimistic shape verbatim."
  - "reactionDelay:int field on participant records — 0 = off, default for all new + legacy docs via (mine.reactionDelay || 0) graceful-degrade predicate"
  - "Viewer-side elapsed-mode filter shift with poster-self bypass — renderReactionsFeed now subtracts delayMs from myElapsed for all non-self reactions"
  - "4-preset UI chip row in renderWatchpartyFooter — Off / 5s / 15s / 30s, visible only in elapsed mode"
  - "CSS .wp-delay + .wp-delay-row — modifier classes on existing .wp-control-btn base"
  - "Closes 07-UAT-RESULTS.md Issue #2b (net-new feature, no prior UI / state field / filter logic)"
affects: [07-08-on-time-inference, all future watchparty render-path work]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pre-await optimistic reused for 2nd time (setReactionDelay + setWpMode) — confirms the pattern as the canonical shape for local UI preference toggles on Firestore-backed primitives. Distinct from postReaction's post-await echo."
    - "Poster-self bypass via r.memberId === state.me.id — memberId is the pinned attribution field written by writeAttribution (js/utils.js:100) and spread into reactions via postReaction (js/app.js:~7820). Use verbatim for any future render-time filter that needs to exempt the poster."
    - "Elapsed-mode-only UI control: .wp-delay-row conditionally hidden via inline style based on mode === 'elapsed'. Wallclock and hidden modes don't expose the control since it has no effect there."
    - "Defensive clamp on persist fn: Math.max(0, Math.min(60, parseInt(seconds, 10) || 0)) — UI only offers discrete presets (0/5/15/30) but console callers are gated defensively."

key-files:
  created: []
  modified:
    - "js/app.js — 3 participant write sites (scheduleSportsWatchparty 7357-7364, confirmStartWatchparty 7419-7426, joinWatchparty 7455-7461): added reactionDelay: 0. +3 lines."
    - "js/app.js — renderReactionsFeed (~7711-7732): added delayMs calc + poster-self bypass + delay-shifted elapsed predicate. +10/-1 lines."
    - "js/app.js — renderWatchpartyFooter (~7796-7816): added currentDelay / delayPresets / delayChips computation + .wp-delay-row markup with mode-gated display. +14 lines."
    - "js/app.js — new window.setReactionDelay (~7947-7970), placed immediately after setWpMode: pre-await optimistic mutation + sync render + updateDoc with lastActivityAt bookkeeping. +24 lines."
    - "css/app.css — new .wp-delay-row / .wp-delay-label / .wp-control-btn.wp-delay rules (lines 712-715). +4 lines."

key-decisions:
  - "Viewer-side delay over poster-side — planner autonomous call per plan objective. Stated use-case is 'spoiler protection for me'; viewer-side matches the mental model, keeps the implementation trivial (pure render filter), and leaves poster-side as a cleanly-stackable future feature if product ever asks."
  - "Pre-await optimistic for setReactionDelay (2nd adoption of the 07-06 pattern) — same rationale as setWpMode: instant chip highlight matters for UX, rollback via onSnapshot is trivial for a single primitive field. Explicitly NOT the postReaction post-await echo."
  - "Poster-self bypass verbatim: r.memberId === state.me.id, no grep / hedge. Confirmed from writeAttribution (js/utils.js:100) + postReaction spread (js/app.js:~7820). You always see your own reactions instantly regardless of your delay setting."
  - "Delay semantics clamp [0, 60] — defensive bound; UI only offers 0/5/15/30 presets but console caller discipline isn't guaranteed."
  - "Delay row hidden (display:none) in wallclock and hidden modes — control is inert there by design; hiding prevents confusing chip taps that do nothing."
  - "Graceful degrade via (mine.reactionDelay || 0) — legacy participant docs without the field behave identically to freshly-created ones set to 0. No schema migration needed."
  - "lastActivityAt: Date.now() on the persist write — consistent with setWpMode + Phase 7 D-06 orphan-detection bookkeeping contract."
  - "Single commit per plan commit_strategy — feature is cohesive; splitting UI / state / filter / persist would ship broken half-states (chip with no effect, filter with no UI, etc.)."

patterns-established:
  - "Reaction-time viewer-side filters go in renderReactionsFeed after mode resolution, with poster-self bypass via r.memberId === state.me.id. Same shape will generalize if additional viewer-side filters are added (e.g. per-reactor mute, kid-mode content gate)."
  - "Participant record field additions: default to a non-null zero-ish value at ALL create sites (3 today: scheduleSportsWatchparty / confirmStartWatchparty / joinWatchparty) + predicate-read with (|| 0) or (|| default) so legacy docs degrade gracefully without a migration."
  - "UI control for a mode-scoped feature: gate visibility via inline style={display} rather than rendering then hiding via CSS — keeps the DOM clean and avoids stale click-handlers on hidden elements."

requirements-completed: [PARTY-04]

# Metrics
duration: 4min
completed: 2026-04-21
---

# Phase 7 Plan 7: Reaction-Delay Feature Summary

**Net-new viewer-side reaction-delay control — 4 preset chips (Off / 5s / 15s / 30s) in the watchparty live footer, persisted to Firestore as participants.{uid}.reactionDelay (seconds), shifting the elapsed-mode render filter backward by delay*1000 for all non-self reactions. Closes 07-UAT-RESULTS.md Issue #2b.**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-04-21 (auto-mode spawn)
- **Completed:** 2026-04-21
- **Tasks:** 4 code tasks shipped + 1 UAT deferred to /gsd-verify-work 7
- **Files modified:** 2 (js/app.js, css/app.css)
- **Commits:** 1 feature commit (per plan commit_strategy — cohesive net-new feature)

## Accomplishments

- **Issue #2b closed (reaction-delay net-new build).** UAT reported "toggled reaction-delay and saw no change" — technically correct since no UI / state field / filter existed prior to this plan. All 4 surfaces now ship as a cohesive unit:
  - **UI:** 4 preset chips in .wp-delay-row below the existing controls row (Off / 5s / 15s / 30s). Chip highlights instantly on tap via the pre-await optimistic pattern. Row hidden when mode is 'wallclock' or 'hidden' since delay is an elapsed-mode concept.
  - **State:** reactionDelay:int field added to participant shape at all 3 create sites (scheduleSportsWatchparty, confirmStartWatchparty, joinWatchparty). Default 0; legacy participant records without the field behave identically via (mine.reactionDelay || 0) graceful-degrade predicate.
  - **Persist:** window.setReactionDelay(seconds) — adopts 07-06's pre-await optimistic shape verbatim (mutate wp.participants[uid].reactionDelay + synchronous renderWatchpartyLive() BEFORE await updateDoc). Clamped [0, 60] defensively. lastActivityAt:Date.now() on the payload for Phase 7 D-06 orphan-detection consistency.
  - **Filter:** renderReactionsFeed elapsed-mode predicate now subtracts delayMs = (mine.reactionDelay || 0) * 1000 from myElapsed for non-self reactions. Poster-self bypass via r.memberId === state.me.id so you always see your own reactions immediately regardless of your delay setting. Wallclock mode unchanged (shows everything as-posted by design). Hidden mode unchanged (nothing renders regardless).
- **Hosting deploy successful** — `firebase deploy --only hosting` from `queuenight/` shipped 47 files to `queuenight-84044.web.app`, release complete.

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1-4 | All 4 code tasks (per plan commit_strategy: single commit — cohesive feature) | `d3fe64a` | feat |

Plan commit_strategy rationale (from frontmatter): "single commit — this is a cohesive net-new feature. UI + state field + persist fn + filter shift are one unit; splitting them leaves half-ships that break the UX." Honored verbatim.

## Files Created/Modified

- **js/app.js — +51/-1 lines across 5 sites:**
  - `scheduleSportsWatchparty` participants literal (~7363): +1 line (`reactionDelay: 0,`)
  - `confirmStartWatchparty` participants literal (~7425): +1 line (`reactionDelay: 0,`)
  - `joinWatchparty` update literal (~7461): +1 line (`reactionDelay: 0,`)
  - `renderReactionsFeed` filter (~7711-7732): +10/-1 lines (delayMs calc + poster-self bypass + shifted predicate)
  - `renderWatchpartyFooter` controls block (~7796-7816): +14 lines (currentDelay / delayPresets / delayChips / .wp-delay-row markup)
  - `window.setReactionDelay` new fn (~7947-7970): +24 lines
- **css/app.css — +4 lines (after .wp-control-btn.danger at line 711):** .wp-delay-row / .wp-delay-label / .wp-control-btn.wp-delay

## Decisions Made

- **Viewer-side delay over poster-side** — planner autonomous call per plan objective. Stated user use-case is "don't spoil an upcoming moment for me." Viewer-side matches the mental model exactly (each viewer picks their own comfort window, independent of others) and is dramatically simpler (pure render-filter shift, no poster-side timeout/CF scheduled-write, no cross-viewer timestamp coordination). If poster-side is ever requested as a distinct feature, it stacks cleanly on a different dimension.
- **Pre-await optimistic for setReactionDelay (2nd adoption of 07-06's pattern)** — same rationale as setWpMode: mode-ish toggles need zero-latency feel, rollback via onSnapshot authoritative overwrite is trivial for a single primitive field. Distinct from postReaction's post-await echo (which awaits the write first, then mutates wp.reactions).
- **Poster-self bypass: r.memberId === state.me.id** — verbatim, no grep, no hedge. memberId is the canonical attribution field written by writeAttribution (js/utils.js:100) and spread into reactions via postReaction (js/app.js:~7820). Exactly one functional hit in the new predicate.
- **Preset values 0 / 5 / 15 / 30** — planner discretion. 30s is long enough to feel useful for "I'm a couple minutes behind" without being absurd. Revisit based on UAT ergonomics if needed.
- **Delay row hidden in wallclock + hidden modes** — control is inert there by design. Hiding via inline `style="display:none"` prevents confusing chip taps that do nothing.
- **Single commit per plan commit_strategy** — feature ships as a cohesive unit. Splitting UI / state / filter / persist would leave half-ships that break the UX (chip with no filter = no effect; filter with no UI = dead code; UI without persist = doesn't survive reload).

## Deviations from Plan

None — plan executed exactly as written. All grep acceptance criteria pass:

- `grep -n "reactionDelay" js/app.js` → 8 hits (required ≥5). 3 create sites + 1 setReactionDelay mutation + 1 updateDoc payload key + 1 renderReactionsFeed delayMs read + 1 renderWatchpartyFooter currentDelay read + 1 comment reference.
- `grep -n "setReactionDelay" js/app.js` → 3 hits (required ≥2). Comment + `window.setReactionDelay = async function` + UI onclick in the chip loop.
- `grep -n "wp-delay" css/app.css` → 4 hits (required ≥2). Comment + .wp-delay-row + .wp-delay-label + .wp-control-btn.wp-delay.
- `grep -n "delayMs" js/app.js` → 3 hits (required ≥2). Assignment + comment + predicate use.
- `grep -n "r.memberId === state.me.id" js/app.js` → 1 functional hit in the poster-self bypass predicate (grep also shows a doc comment containing the same string; the predicate itself is exactly 1).
- `node --check js/app.js` → OK (syntax clean).

## Issues Encountered

None.

## Authentication Gates

None — `firebase deploy --only hosting` ran cleanly, existing session credentials valid. Deploy output: `+ hosting[queuenight-84044]: release complete` with 47 files uploaded.

## Deferred

- **Task 5 (UAT human-verify — reaction-delay behavioral check)** deferred to `/gsd-verify-work 7` per project pattern (07-05, 07-06 also deferred their UAT to the same verifier run). UAT reproduction steps, verbatim from plan Task 5:

  **Cache invalidation note:** no manual `?v=` bump needed in `index.html` — Firebase Hosting + PWA service worker handle invalidation on deploy.

  1. Copy `index.html`, `css/`, `js/` to `queuenight/public/`, `firebase deploy --only hosting`. **(Already done as part of this plan's shipping step — d3fe64a deploy release complete 2026-04-21.)**
  2. Two devices A + B both joined to the same watchparty + both started their timers (timer alignment within ~1-2s is fine — this is advisory-per-member, not host-broadcast).
  3. **Baseline (delay off):** A posts 🎉 → B sees it within ~2s. Confirms no-regression on reaction plumbing.
  4. **Delay = 15s on B:** B taps the 15s preset chip → chip highlights with `.on` state **instantly**. A posts 😱. B's feed should NOT show it yet. Wait 15 seconds — it appears. (Approximate; Firestore snapshot cadence gives ± ~1s.)
  5. **Poster-self exemption:** B posts ❤️ while still at 15s delay. B sees their own reaction appear immediately (not delayed — `r.memberId === state.me.id` bypass). A sees it immediately (A has delay=0).
  6. **Back to 0:** B taps Off → A's subsequent reactions arrive immediately again.
  7. **Wallclock mode interaction:** B switches to Real-time. Delay row should hide. A's reactions come through in real time regardless of delay setting. Switch back to Elapsed → delay row reappears, respects the persisted value.
  8. **Hidden mode interaction:** B switches to Hide reactions. Nothing renders regardless. Switch back. Delay still respected.

  **Pass criteria:** all 8 sub-checks above behave as described.

  **Resume signal:**
  - `delay-pass` with brief notes.
  - `fail: <which sub-check>` — routing: check (3) = reaction-plumbing regression (unlikely; 07-03 is stable), check (4) = filter math wrong (walk through the renderReactionsFeed predicate with the posted reaction's elapsedMs and the viewer's myElapsed), check (5) = poster-self check broken (predicate is pinned `r.memberId === state.me.id` — if failing, verify postReaction still spreads writeAttribution and state.me.id is truthy at render time), check (7) = delay-row hide condition not wired.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- **Wave 2 of gap-closure COMPLETE** — 07-07 (reaction delay) shipped + deployed. Wave 3 = 07-08 (on-time inference) can now proceed. Per plan risk_notes, 07-08 declares `depends_on: [07-06, 07-07]` for strict sequencing — setReactionDelay lands first, then 07-08's claimStartedOnTime inserts adjacent to it in the ~7900 cluster, avoiding merge conflicts.
- **Wave 2 UAT rolls up with 07-05 + 07-06 UAT** into a single `/gsd-verify-work 7` pass — consistent with the project's "deploy first, UAT later" pattern.
- **No new tech-stack additions** — feature is pure JS + CSS, no new libraries or infrastructure.
- **Schema impact:** Firestore participant docs gain one optional integer field (reactionDelay). No new trust boundary; STRIDE register unchanged per plan risk_notes.
- **Next plan:** 07-08 (on-time inference, Wave 3) per ROADMAP.

---
*Phase: 07-watchparty*
*Completed: 2026-04-21*

## Self-Check: PASSED

- `js/app.js` modified — grep verified:
  - `reactionDelay` at lines 7363, 7425, 7461 (3 create sites) + 7717, 7724 (renderReactionsFeed) + 7801 (renderWatchpartyFooter) + 7960, 7965 (setReactionDelay) = 8 hits
  - `setReactionDelay` at lines 7807 (UI onclick in chip loop) + 7947 (comment) + 7954 (definition) = 3 hits
  - `delayMs` at lines 7717 (comment), 7724 (assignment), 7731 (predicate) = 3 hits
  - `r.memberId === state.me.id` at line 7729 (functional predicate); line 7720 is the doc comment describing it
- `css/app.css` modified — grep verified: `wp-delay` at lines 712 (comment), 713 (.wp-delay-row), 714 (.wp-delay-label), 715 (.wp-control-btn.wp-delay) = 4 hits
- Commit `d3fe64a` exists in couch repo `git log`
- `node --check js/app.js` → OK (syntax clean)
- Hosting deploy successful: `queuenight-84044.web.app` — 47 files, release complete
- SUMMARY.md written to `.planning/phases/07-watchparty/07-07-SUMMARY.md`
