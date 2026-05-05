---
phase: 26
slug: position-anchored-reactions-async-replay
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-01
---

# Phase 26 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `26-RESEARCH.md` § Validation Architecture (lines 803-863) + § Phase 26 Smoke Contract Specification Summary (lines 917+).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Bespoke per-phase smoke contracts in CommonJS (`node scripts/smoke-*.cjs`); pattern established in Phase 18+ (8 contracts shipped through Phase 24). No npm test framework per CLAUDE.md no-bundler / no-deps constraint. |
| **Config file** | None — each smoke is self-contained, exits 0 on pass / 1 on fail. Wired into `bash scripts/deploy.sh` §2.5 as a deploy gate. |
| **Quick run command** | `node scripts/smoke-position-anchored-reactions.cjs` (Phase 26 NEW — Wave 0 creates) |
| **Full suite command** | `bash scripts/deploy.sh --dry-run` (runs all 9 smoke contracts incl. Phase 26 — position-transform, tonight-matches, availability, kid-mode, decision-explanation, conflict-aware-empty, sports-feed, native-video-player, position-anchored-reactions) |
| **Estimated runtime** | ~3-5 seconds for the Phase 26 smoke alone (~250 lines of CJS, mostly regex-grep on `js/app.js` + helper-behavior assertions); ~15-20 seconds for the full suite |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-position-anchored-reactions.cjs`
- **After every plan wave:** Run `bash scripts/deploy.sh --dry-run` (full 9-contract suite — ensures no cross-phase regression)
- **Before `/gsd-verify-work 26`:** Full suite must be green; HUMAN-UAT scripts in `26-HUMAN-UAT.md` complete (planner authors after Plan 4 ships)
- **Max feedback latency:** 5 seconds (Phase 26 smoke alone); 20 seconds (full suite)

---

## Per-Task Verification Map

> Task IDs are filled in by the planner. The map below pre-stages requirement IDs (RPLY-26-*) and their verification methods, derived from research § Validation Architecture lines 821-847. Plan/Wave/Task columns become concrete after `/gsd-plan-phase` writes plan files.

| Req ID | Behavior | Test Type | Automated Command (assertion) | File Exists | Status |
|--------|----------|-----------|-------------------------------|-------------|--------|
| RPLY-26-01 | `derivePositionForReaction` returns correct shape across 4 cases (fresh-broadcast, stale-broadcast, no-player, live-stream) | unit (helper-behavior) | smoke #1-#5 | ❌ W0 | ⬜ pending |
| RPLY-26-02 | `STALE_BROADCAST_MAX_MS` import from `js/native-video-player.js` appears in production source | sentinel (regex-grep) | smoke #11 | ❌ W0 | ⬜ pending |
| RPLY-26-03 | `runtimeSource` enum values literal — `'broadcast'`, `'elapsed'`, `'live-stream'`, `'replay'` all appear in production source | sentinel (4 regex-greps) | smoke (extends to 4 enum-value sentinels) | ❌ W0 | ⬜ pending |
| RPLY-26-04 | `wp.status === 'archived'` branch appears in `renderWatchpartyLive` (replay-variant gating) | sentinel | smoke #8 | ❌ W0 | ⬜ pending |
| RPLY-26-05 | Scrubber duration helper picks correct precedence (TMDB → `wp.durationMs` → max observed `runtimePositionMs` → 60min floor) | unit (helper-behavior) | smoke (4 assertions for `getScrubberDurationMs` cases) | ❌ W0 | ⬜ pending |
| RPLY-26-06 | `replayableReactionCount` filter behavior (D-10 hide-empty) | unit | smoke #12, #13 | ❌ W0 | ⬜ pending |
| RPLY-26-07 | `runtimeSource: 'replay'` literal appears at the compound write site (D-05) | sentinel | smoke (regex-grep for `'replay'` in `postReaction` context) | ❌ W0 | ⬜ pending |
| RPLY-26-08 | `mode: 'revisit'` literal appears in ≥2 call sites (Past parties row tap + Past watchparties for title row tap) | sentinel | smoke #9 | ❌ W0 | ⬜ pending |
| RPLY-26-09 | `archivedWatchparties()` invoked + `replayableReactionCount` filter applied in `renderPastParties` | sentinel | smoke (2 regex-greps) | ❌ W0 | ⬜ pending |
| RPLY-26-10 | `replayableReactionCount` helper appears in production source | sentinel | smoke #10 | ❌ W0 | ⬜ pending |
| RPLY-26-11 | `renderPastWatchpartiesForTitle` function defined + invoked in `renderDetailShell` | sentinel | smoke (regex-grep for declaration + call site) | ❌ W0 | ⬜ pending |
| RPLY-26-12 | `renderWatchpartyHistoryForTitle` query narrowed to `activeWatchparties()` | sentinel | smoke (regex-grep for `activeWatchparties()` inside function body) | ❌ W0 | ⬜ pending |
| RPLY-26-13 | `state.activeWatchpartyMode` slot exists in `js/state.js` AND assigned in `openWatchpartyLive` AND cleared in `closeWatchpartyLive` | sentinel (3 regex-greps) | smoke (3 regex-greps) | ❌ W0 | ⬜ pending |
| RPLY-26-14 | Wait Up filter `mine.reactionDelay` IS NOT applied in replay variant (negative match) | sentinel (negative match) | smoke (regex-grep) | ❌ W0 | ⬜ pending |
| RPLY-26-15 | Banner copy strings `REVISITING` AND `together again` appear in production | sentinel (2 regex-greps; whitespace-insensitive) | smoke (2 regex-greps) | ❌ W0 | ⬜ pending |
| RPLY-26-16 | NO `autoplay` attribute / `playerVars.autoplay` in replay-variant production source (negative match) | sentinel (negative match) | smoke (regex-grep — should report 0 matches outside comments) | ❌ W0 | ⬜ pending |
| RPLY-26-17 | Smoke contract ≥13 assertions (UI-SPEC §7 floor) | meta-assertion | smoke self-reports `total assertions: N` and exits 1 if N < 13 | ❌ W0 | ⬜ pending |
| RPLY-26-18 | `sw.js` CACHE bumped to `couch-v38-async-replay` | manual sentinel | grep `sw.js` for `'couch-v38-async-replay'` (auto-bumped at deploy time) | ❌ W0 | ⬜ pending |
| RPLY-26-19 | firestore.rules verification — Phase 24 M2 denylist scope check (`reactions` NOT in denylist) | manual + smoke | smoke (regex-grep `firestore.rules` for the denylist allowlist; assert `reactions` NOT in the list) | ❌ W0 | ⬜ pending |
| RPLY-26-20 | Tonight tab inline link gating — `count > 0` check appears at link render site | sentinel | smoke (regex-grep) | ❌ W0 | ⬜ pending |
| RPLY-26-PAGE | `state.pastPartiesShownCount` slot used + `Show older parties ›` copy appears | sentinel (2 regex-greps) | smoke (2 regex-greps) | ❌ W0 | ⬜ pending |
| RPLY-26-DATE | `friendlyPartyDate` returns correct string for 5 fixture inputs (today, last night, weekday, last weekday, cross-year) | unit (helper-behavior, 5 assertions) | smoke (5 assertions) | ❌ W0 | ⬜ pending |
| RPLY-26-DRIFT | `DRIFT_TOLERANCE_MS = 2000` literal in production | sentinel | smoke (regex-grep) | ❌ W0 | ⬜ pending |
| RPLY-26-SNAP | `step="1000"` (or equivalent) literal in scrubber HTML | sentinel | smoke (regex-grep `wp-replay-scrubber` context) | ❌ W0 | ⬜ pending |

**Total assertion count target:** ≥25 (well above UI-SPEC §7 floor of 13). Planner can prune to the 13-floor minimum or extend; researcher recommends ≥20 for robust coverage.

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · ❌ W0 = Wave 0 will create the test infrastructure*

---

## Wave 0 Requirements

- [ ] `scripts/smoke-position-anchored-reactions.cjs` — covers all RPLY-26-* requirements (NEW file; ~250 lines following `scripts/smoke-native-video-player.cjs` pattern)
- [ ] Smoke wired into `bash scripts/deploy.sh` §2.5 as deploy gate (one-line addition matching Phase 24 / Plan 24-01 wiring)
- [ ] Smoke wired into `package.json` test script if applicable (verify Phase 24 pattern — Plan 24-01 added an entry; mirror it)

*If no other gaps surface during plan-phase: above is the full Wave 0 backlog.*

---

## Manual-Only Verifications

> Per research §11.5 + UI-SPEC §6 (HUMAN-UAT scaffolding pattern, mirrors Phases 18 / 19 / 24). Author full scripts in `26-HUMAN-UAT.md` after Plan 4 ships.

| Behavior | Requirement | Why Manual | Test Instructions (high-level) |
|----------|-------------|------------|-------------------------------|
| Replay-modal entry from Past parties tap | RPLY-26-08, RPLY-26-04 | Visual + interaction — sentinel can prove `mode: 'revisit'` literal exists, but only a human confirms the modal swaps chrome correctly | Open Past parties from Tonight tab; tap any past party row; confirm replay variant of live modal opens with scrubber strip + replay banner |
| Replay-modal entry from title-detail tap | RPLY-26-11, RPLY-26-04 | Visual + interaction — same as above for the title-detail entry path | Open any title detail with ≥1 archived watchparty; tap a "Past watchparties for this title" row; confirm replay modal opens |
| Scrubber drag + reaction fade-in at known position | RPLY-26-05, RPLY-26-DRIFT | Visual feel — drift tolerance ±2s requires human judgement of "felt right" | In a known archived party (e.g., test fixture seeded by user), drag scrubber to a known reaction's `runtimePositionMs`; confirm reaction fades in within 2s window |
| Compound-reaction posts to Firestore at correct position | RPLY-26-07 | Cross-system verification (client → Firestore → re-read) | Post a reaction in replay mode; confirm `wp.reactions[lastIdx].runtimePositionMs` matches viewer's local replay clock at post time; confirm `runtimeSource === 'replay'` |
| Hide-when-empty surfaces (deploy-day silence per D-10 + D-11) | RPLY-26-06, RPLY-26-09 | Per CONTEXT § Specifics — "first-week-after-deploy framing" — Past parties + title-detail "Past watchparties" sections will be empty for existing family on deploy day | Confirm Tonight tab inline link does NOT render when `replayableReactionCount === 0`; confirm title-detail section header does NOT render when no archived parties have replay-able reactions |
| Wait Up disabled in replay (D-09 / Discretion) | RPLY-26-14 | Negative behavior — sentinel proves the filter expression doesn't reference `reactionDelay`, but human confirms reactions don't shift in time when Wait Up is set | Set per-member `reactionDelay` > 0 in normal live mode; switch into replay mode for a past party; confirm reactions appear at their stamped `runtimePositionMs`, NOT delayed |
| Video player renders but does NOT auto-start | RPLY-26-16 | Negative behavior — sentinel proves no `autoplay` attribute, but human confirms the player is rendered + idle | Open replay modal for a past party with `wp.videoUrl` still attached; confirm player surface renders but does not begin playback |
| Drift tolerance ±2s feel | RPLY-26-DRIFT | Subjective UX — sentinel proves the constant exists; human confirms the fade-in feels neither premature nor late | Drag scrubber to known reaction position; observe fade-in timing |
| Scrub-backward preserves shown reactions | replay-mode behavior | Negative behavior — confirm dragging scrubber backward does NOT cause already-shown reactions to disappear | Drag scrubber forward past several reactions; drag back; confirm earlier reactions remain visible (no flicker) |
| Post-deploy `couch-v38-async-replay` CACHE active | RPLY-26-18 | Cross-system verification — installed PWAs must invalidate on next online activation | After deploy, force-reload installed PWA; confirm `caches.keys()` shows `couch-v38-async-replay` and prior cache is purged |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (smoke contract scaffold + deploy.sh wiring)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s (Phase 26 smoke alone)
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills task IDs and gsd-plan-checker passes)

**Approval:** pending — set to `approved YYYY-MM-DD` once gsd-plan-checker returns `## VERIFICATION PASSED` and all RPLY-26-* IDs are bound to plan tasks.
