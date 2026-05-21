---
status: partial
phase: 15-tracking-layer
source: [15-VERIFICATION.md]
started: 2026-04-27T05:55:00Z
updated: 2026-04-27T05:55:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Trakt co-watch overlap → S5 modal cross-session decline (REVIEW MEDIUM-9 marquee)
expected: Modal renders with verbatim copy; "Yes, group us" writes `t.tupleProgress[meId,otherId]`; "No, keep separate" writes `families/{code}.coWatchPromptDeclined.{tk}`; second sync of the same pair is SKIPPED by the detector (no re-prompt).
why_human: Requires real Trakt OAuth + paired family members + actual co-watch history within ±3hr. The only surface that proves the cross-plan rules+client coordination (15-01 + 15-07 + 15-08 allowlist extension) actually closes the loop in production.
result: [pending]

### 2. Post-watchparty auto-track confirmation row (D-01)
expected: After a watchparty ends with ≥1 co-watcher, the post-session sub renders "Mark S{N}E{M} for {tupleName}?" Yes/Edit row. "(best guess)" qualifier appears when sourceField === `host-progress-plus-1`. Yes calls `writeTupleProgress(...,'watchparty')` and the tuple shows up in YOUR COUCH'S PROGRESS on the detail modal.
why_human: Requires running an actual watchparty end-to-end (start → join with ≥1 co-watcher → end → openPostSession fires for each actor). Today only Tier 4 (host-progress+1) fires — Tiers 1-3 are future-ready scaffolding for a follow-up wp-schema-extension plan; Sentry breadcrumb category=`tupleAutoTrack` will telemeter which tier wins.
result: [pending]

### 3. Live-release push (D-13/D-14/D-15) actually fires from watchpartyTick CF
expected: Push title "New episode tonight/tomorrow/{Weekday}"; body "{Show} S{N}E{M} — watch with the couch?"; tap opens `/?nominate={titleId}&prefillTime={airTs}`. Subsequent tick within the hour skipped by HIGH-3 throttle (`liveReleaseSweepLastRunAt` cursor not updated). Idempotent — no double-fire on `s{N}e{M}` flag.
why_human: Requires real TV titles with populated `t.nextEpisode.airDate` metadata + ≥2 family members tracking + an FCM device subscription + waiting for the 5-min CF tick. Spot-checks REVIEW HIGH-3 (hourly throttle), HIGH-4 (stale-data skip), LOW/MEDIUM-11 (widened ±26h-23h window), MEDIUM-12 (push body framing) end-to-end on lockscreen.
result: [pending]

### 4. Per-show kill-switch (S6) toggle + HIGH-1 deny path
expected: Tap "Stop notifying me about this show" on a TV detail modal → text flips to "Notifications off · Re-enable"; toggle persists per-member via `writeMutedShow`. Another family member's mute state is independent. Devtools attempt to write `t.mutedShows[someone-else.id]` returns `PERMISSION_DENIED` (HIGH-1 isolation rule).
why_human: Requires UI interaction + multi-account devtools to verify the rule denial path. Code path is wired (`writeMutedShow` + `window.toggleMutedShow` + `cv15HandleDetailModalClick`); the deny-path verification needs an authed multi-account session.
result: [pending]

### 5. S2 detail-modal "YOUR COUCH'S PROGRESS" section + S3 inline rename + MEDIUM-6 placeholder gate
expected: Section renders for a TV title with ≥1 tuple in `t.tupleProgress`. Pencil glyph reveals `<input maxlength=40>` overlay; Enter/blur saves via `setTupleName`; Esc reverts. Italic Instrument Serif placeholder "*name this couch*" renders ONLY when `tupleCustomName(tk) === null` (MEDIUM-6 — even when `tupleDisplayName(tk)` would return a derived fallback like "You (solo)"). Rename re-renders the modal with the new name (MEDIUM-8 optimistic update bridges the ~50-150ms onSnapshot lag).
why_human: Requires populated `t.tupleProgress` data + open modal interaction + detail-modal innerHTML re-render trigger to confirm `cv15AttachDetailModalDelegate` idempotency holds across all 11 attach call sites.
result: [pending]

### 6. S1 Tonight tab "PICK UP WHERE YOU LEFT OFF" widget
expected: Widget renders max 3 rows (Fraunces 17px show name; Inter 15px ink-warm "S{N} · E{M}"; Inter 13px ink-dim tuple-name + relative time; .tc-primary [Continue] CTA). Sorted by per-title most-recent tuple `updatedAt` desc. Tap row body OR Continue button opens `openDetailModal(titleId)`. Widget HIDES ENTIRELY (`style.display='none'` + `innerHTML=''`) when zero tuples exist (UI-SPEC §Discretion Q7). Legacy #continue-section coexists below.
why_human: Requires populated `state.titles` with tupleProgress entries containing `me.id`. Visual placement contract (between #couch-viz-container and #flow-a-entry-container) is structurally verified, but rendering correctness on real data needs human eyes.
result: [pending]

### 7. Phase 14 surfaces no-regression (V5 couch viz, Flow A, Flow B, Settings, member roster)
expected: All Phase 14 features behave identically post-Phase-15 deploy. No console errors on app load. `sw.js` v35.0-tracking-layer activates and refetches the shell on next visit (iOS PWA cache invalidation).
why_human: Visual regression check requires real device rendering (especially iOS PWA cache invalidation). Code-level evidence (renderCouchViz / renderFlowAEntry / renderFlowBEntry / couchInTonight all present and untouched — 45 occurrences across symbols) gives high confidence but a sample app load on real device confirms no runtime regression.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
