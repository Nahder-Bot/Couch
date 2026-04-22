---
status: complete
phase: 07-watchparty
source:
  - 07-05-SUMMARY.md
  - 07-06-SUMMARY.md
  - 07-07-SUMMARY.md
  - 07-08-SUMMARY.md
started: 2026-04-22T00:50:00Z
updated: 2026-04-22T02:15:00Z
---

## Current Test

[testing complete]

## Environment note

**iOS PWA cache invalidation required before UAT.** Hosting deploys do not auto-invalidate installed PWAs on iOS. Cache bust procedure: iPhone Settings → Safari → Advanced → Website Data → delete couchtonight.app → reopen PWA. This was required to unblock Test 1 (see below). Assume same bust is required any time new hosting deploys need to be verified on the physical device.

## Tests

### 1. CF timezone push body (Gap #1 closure — 07-05)
expected: |
  From device A (creator), schedule a watchparty ~2 min in the future. On device B,
  the incoming `watchpartyScheduled` push body reads the scheduled time in the
  creator's local timezone — not UTC. Firestore doc has `creatorTimeZone` IANA field.
result: pass
note: "Initial FAIL was environmental (stale iOS PWA service-worker cache on creator device — Hosting had the new bundle but the installed PWA was serving cached app.js). Resolved by iPhone Settings → Safari → Website Data → delete couchtonight.app → reopen PWA. Re-verified 9:27 PM EDT: new doc has creatorTimeZone='America/New_York' (matches browser IANA zone). CF onWatchpartyCreate v11 fired successfully (1 execution, 768ms, status ok). Code fix is live end-to-end."

### 2. Hide-reactions live toggle (Gap #2a closure — 07-06)
expected: |
  In an active watchparty live modal on iPhone PWA: tap "Hide reactions". Feed
  collapses to the "Reactions hidden" placeholder IMMEDIATELY — no modal close/reopen
  needed. Tap the same button (now "Reactions off") → feed returns.
result: pass
note: "Toggle behavior verified — Gap #2a closed. BUT during this test user observed a separate issue: reactions posted from phone did not appear on the PC receiver in real time; only after the PC user took a local action (typed/posted) did they see the prior reaction. Tested with and without reaction delay — same symptom. Filed as cross-cutting gap (see Gaps section)."

### 3. Late-joiner reaction backlog (Gap #3 closure — 07-06)
expected: |
  Device A hosts + starts timer + posts 3 reactions. Device B joins the watchparty
  (does NOT tap "Start my timer"). B sees: "Ready when you are" header + participant
  strip (with A chipped as "X min in") + all 3 reactions below in wall-clock order.
result: static-verified
evidence: "js/app.js:7665-7675 renderWatchpartyLive has distinct `mine && !mine.startedAt` branch that renders Ready-when-you-are + renderParticipantTimerStrip(wp) + renderReactionsFeed(wp, mine, 'wallclock') 3-arg modeOverride form. js/app.js:7735-7766 renderReactionsFeed accepts modeOverride param, line 7739 const mode = modeOverride || mine.reactionsMode || 'elapsed', line 7756 `if (mode === 'wallclock') return true;` bypasses elapsed filter."

### 4. Regression — un-joined viewer branch unchanged (07-06)
expected: |
  Device C is a family member but NOT a participant. Opens the live-modal view.
  Sees the ORIGINAL "Ready when you are" placeholder (unchanged copy) plus the
  footer "Join late" button. Only one CTA. No redundant body text telling them to
  "Join the party." This confirms the !mine branch wasn't accidentally altered.
result: static-verified
evidence: "js/app.js:7656-7664 `!mine` branch contains original copy verbatim (Ready when you are + Start the movie on your device body + participant list). js/app.js:7688, 7700 Footer 'Join late' button is sole CTA. No new body copy or secondary CTA introduced — branch boundary correctly split from the joined-pre-start sub-branch."

### 5. Reaction-delay feature (Gap #2b closure — 07-07)
expected: |
  Two devices A + B both joined + both started timers. Device B taps the 15s preset
  chip in the delay row → chip highlights `.on` instantly. A posts 😱 — B's feed does
  NOT show it for ~15s, then it appears. B posts ❤️ — B sees their own reaction
  IMMEDIATELY (poster-self exemption). A sees it immediately (A has delay=0).
result: static-verified
evidence: "Participant create: js/app.js:7454, 7490, 7392 `reactionDelay: 0` at all 3 write sites. Filter: js/app.js:7753-7760 delayMs + poster-self exempt via `r.memberId === state.me.id`. Persist fn: js/app.js:7999-8015 window.setReactionDelay with pre-await optimistic shape. UI: js/app.js:7843-7866 chips with 0/5/15/30s presets. CSS: css/app.css:712-715 .wp-delay-row / .wp-delay-label / .wp-control-btn.wp-delay. NOTE: real-time delivery reliability blocked by passive-update lag gap."

### 6. Reaction-delay mode interactions (07-07)
expected: |
  On device B: switch to Real-time mode → delay row HIDES. Switch to Hide reactions
  → nothing renders. Switch back to Elapsed → delay row reappears with the previously
  persisted value (e.g. 15s still highlighted).
result: static-verified
evidence: "js/app.js:7854 delay row display gated on `(mode === 'elapsed') ? 'flex' : 'none'`. js/app.js:7850-7851 chip `.on` class assigned when preset matches persisted mine.reactionDelay || 0. js/app.js:7756-7757 wallclock mode bypass. js/app.js:7740-7741 hidden mode short-circuits with placeholder."

### 7. Default on-time inference (Gap #4 part 1 — 07-08)
expected: |
  Device B joins an active party within the 60s grace window after startAt (or joins
  pre-start). Both devices tap "Start my timer" when they press play. B's chip in
  the participant strip shows elapsed anchored to `startAt`, NOT to when B tapped
  Start. So a chip 3s after startAt reads "just started" computed from startAt, and
  a chip 2 min after startAt reads "~2 min in" even if B tapped Start only 30s ago.
result: static-verified
evidence: "js/app.js:1739 ONTIME_GRACE_MS = 60*1000. js/app.js:1746-1755 effectiveStartFor(participant, wp) 3-case logic (override → inference → startedAt fallback → null). js/app.js:1762-1773 computeElapsed 2-arg form calls effectiveStartFor. All 7 call sites migrated: 3173, 3196, 7553, 7640, 7743, 7787, 7926. Sanity check: joinedAt=startAt+30s → returns startAt ✓; joinedAt=startAt+120s → returns startedAt ✓."

### 8. Late-joiner manual override (Gap #4 part 2 — 07-08)
expected: |
  Device D joins at startAt + 5 minutes (outside grace). D's chip reads "Just
  started" and D sees an "I started on time" affordance on their OWN chip.
  D taps it → chip's elapsed jumps to ~5 min + badge now reads "On time ✓".
  Other devices see D's chip update via snapshot. D taps "On time ✓" → reverts
  to joinedAt anchor, chip back to fresh elapsed.
result: static-verified
evidence: "js/app.js:8029-8047 window.claimStartedOnTime(wpId, opts) with pre-await optimistic shape + opts.toggleOff revert to null. js/app.js:7797-7805 UI injects on own chip only (isMe guard) — 'I started on time' button when isLate && !hasOverride, 'On time ✓' badge when hasOverride. css/app.css:717-720 .wp-ontime-claim + .wp-ontime-revert. js/app.js:7798 isLate = p.joinedAt > wp.startAt + ONTIME_GRACE_MS. NOTE: cross-device snapshot broadcast (other devices seeing D's chip update) blocked by passive-update lag gap."

## Summary

total: 8
passed: 2
static_verified: 6
issues: 0
deferred: 1 (desktop responsive layout → Phase 9)
pending: 0
skipped: 0

All 8 tests accounted for. All Phase 7 gap-closure behaviors (Gaps #1, #2a, #2b, #3, #4) verified — either via runtime UAT or static code review backed by the deployed-bundle grep confirmation. One cross-cutting runtime bug surfaced and fixed in-session (passive-update lag → commits `14e959a` + `ce3c507`). One pre-existing UX issue (desktop responsive layout) deferred to Phase 9 as out-of-scope.

## Gaps

- truth: "Newly-created watchparty docs write creatorTimeZone (IANA string from Intl.DateTimeFormat().resolvedOptions().timeZone) alongside startAt, always present (null-safe)"
  status: resolved
  resolution: "Environmental blocker (stale iOS PWA service-worker cache). Code fix was live on Hosting; the creator's installed PWA was running a cached pre-v11 bundle. Cleared via iPhone Settings → Safari → Website Data → delete couchtonight.app → reopen PWA. Re-verified 2026-04-21 21:27 EDT with fresh doc containing creatorTimeZone='America/New_York'."
  severity: blocker
  test: 1
  evidence:
    - "CF onWatchpartyCreate v11 deployed 2026-04-21 20:20 EDT"
    - "Hosting latest release 2026-04-21 20:41 EDT — deployed bundle in queuenight/public/js/app.js contains `creatorTimeZone` at lines 7359, 7370, 7431, 7443 (verified via grep)"
    - "Pre-cache-bust post-v11 doc wp_1776820486488_it6g9u (9:14:46 PM EDT): missing creatorTimeZone — stale PWA bundle"
    - "Post-cache-bust new doc (9:27 PM EDT): creatorTimeZone='America/New_York' present ✓"
  note_for_future: "iOS PWA installs do NOT auto-invalidate on Hosting deploys. Any time a UAT verifies a hosting-shipped change on the installed PWA, bust Safari Website Data first. Captured as an environment note at top of this file."

- truth: "New reactions posted by any participant propagate to all other joined devices' reaction feeds in real time (onSnapshot → renderReactionsFeed on receive)"
  status: resolved
  reason: "User observed during Test 2: reactions posted from iPhone PWA did not appear on PC (Chrome) receiver in real time. Only after the PC user took a local action did they see the prior reaction. Reproduced with and without reaction delay."
  severity: major
  test: 2 (surfaced during; not the tested behavior)
  root_cause: "js/app.js:3121-3139 — the watchparties onSnapshot handler updates state.watchparties and calls renderWatchpartyBanner() ONLY. It does NOT call renderWatchpartyLive() when state.activeWatchpartyId is set. The code comment at the handler says 'Full re-render still runs from the watchparties onSnapshot when participant state / reactions change' — but the actual call is missing. This is a pre-existing bug, not introduced by 07-06/07/08 — masked before because prior UAT always had users actively tapping things (which triggers explicit-action re-render paths like setWpMode, setReactionDelay, claimStartedOnTime, postReaction). The passive-observer case only surfaces now that we have proper multi-device UAT."
  fix_location: "js/app.js:~3138 — after the existing renderWatchpartyBanner() call in the snapshot handler, add: `if (state.activeWatchpartyId) renderWatchpartyLive();`"
  evidence:
    - "js/app.js:3121-3139 snapshot handler updates state + renderWatchpartyBanner only"
    - "Comment at handler claims full re-render happens from snapshot but no such call exists"
    - "renderWatchpartyLive() only invoked from: setWpMode, setReactionDelay, claimStartedOnTime, postReaction, initial modal open — never from snapshot"
    - "updateWatchpartyLiveTick (js/app.js:3164-3206) runs every 1s but only updates timer/countdown/chips — does NOT re-render reactions feed"
    - "Bug is cross-cutting — affects passive observation of reactions AND of cross-device snapshot updates for chip states (Test 8's 'other devices see D's chip update via snapshot' requirement)"
  scope: "Impacts Tests 2, 3, 5, 7, 8 runtime behavior (all passive-update paths). Static verification of those tests' code is clean; runtime propagation is the missing piece."
  fix_risk: "LOW — 1-line add, guarded by state.activeWatchpartyId. Calls the same renderWatchpartyLive that explicit actions already call. No new code path, just closes an existing gap between snapshot intent and snapshot execution."
  fix_applied: "Two commits required — initial hypothesis was incomplete. (1) commit 14e959a — added `if (state.activeWatchpartyId) renderWatchpartyLive();` to watchparties onSnapshot handler at js/app.js:~3138. Necessary but not sufficient; snapshot re-render was firing but reactions still filtered out. (2) commit ce3c507 — renderReactionsFeed filter switched from elapsed-based to wall-clock-based comparison at js/app.js:7757-7773. Old predicate `r.elapsedMs <= myElapsed - delayMs` compared poster-anchored elapsedMs against viewer-anchored myElapsed; when anchors differ (late joiner without 07-08 override or any participants who started timers at different wall-clock moments), comparison is in incompatible coordinate spaces and rejects reactions. New predicate `r.at <= Date.now() - delayMs` uses r.at (wall-clock ms timestamp written at post time, line ~7935); synced-viewing case is mathematically identical, cross-anchor case degrades gracefully. Final re-verify 2026-04-21 22:30 EDT: user confirmed passive propagation works — reactions from phone appear on PC within ~1s of post, no local action required."

- truth: "Watchparty live modal renders responsively on desktop viewports (laptop/PC Chrome), scaling layout to full width instead of a narrow mobile column with hard-to-tap controls"
  status: deferred
  reason: "User screenshot (PC Chrome incognito, desktop viewport) shows live modal constrained to ~mobile width in the middle of a wide desktop browser window. Pause/Hide reactions/Real-time/Done control row is squeezed; reaction grid is cramped; some buttons effectively unclickable. Product is designed mobile-first per PROJECT.md — desktop is a secondary surface."
  severity: minor
  test: 2 (surfaced during, not the tested behavior)
  scope: "Cross-cutting UX issue on desktop/PC Chrome. Does not affect mobile Safari PWA (the primary surface). Likely missing or incomplete @media queries for wider viewports OR a max-width cap applied unconditionally."
  next_step: "Not a Phase 7 concern — belongs to Phase 9 (Redesign / Brand) where full desktop responsive pass is in scope. Capture here as a known deferred issue so Phase 9 picks it up. Do NOT attempt fix in this phase."
  note: "Pre-existing, not introduced by Phase 7 plans. Phase 7 plans 07-06/07/08 only added DOM nodes inside the existing modal container; layout container sizing is owned by earlier phases."
