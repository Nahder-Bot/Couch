---
phase: 07-watchparty
plan: 04
subsystem: watchparty-uat-checkpoint
tags: [uat, checkpoint, watchparty, gap-closure, push-flagship]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "Plan 07-01 lifecycle + watchpartyTick CF — UAT Scenarios 1, 7, 8 verify the state machine"
  - phase: 07-watchparty
    provides: "Plan 07-02 Tonight CTA + banner — UAT Scenarios 2 + 3"
  - phase: 07-watchparty
    provides: "Plan 07-03 reaction palette + participant strip — UAT Scenarios 4, 5, 6"
  - phase: 06-push-notifications
    provides: "onWatchpartyUpdate CF + watchpartyStarting event — UAT Scenario 1 closes the Phase 6 push loop"
provides:
  - "07-UAT-RESULTS.md scaffolded then evolved through 8/8 PASS final state — the deliverable artifact"
  - "4 gap-closure plans seeded (07-05 timezone-push-body, 07-06 hide-reactions + late-joiner backlog, 07-07 reaction-delay, 07-08 on-time inference)"
  - "1 deferred-to-Phase-9 seed (banner dismiss + async-replay watchparty mode)"
  - "2 in-session cross-cutting fixes: passive-update lag (commit 14e959a) + wallclock-filter migration (commit ce3c507)"
affects: [07-05, 07-06, 07-07, 07-08, 09-04 desktop responsive layer (closes Phase 7 deferred gap)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "UAT checkpoint as gap-closure seed source: physical-device session surfaces issues that become numbered gap-closure plans within the same phase, not deferred to later phases. 4 of 5 surfaced issues became Plans 07-05..08; only the 5th (async-replay) deferred per scope."
    - "iOS PWA cache invalidation environment note (Settings to Safari to Advanced to Website Data) — captured at top of UAT-RESULTS.md as durable knowledge for future hosting-deploy UATs on installed PWAs."

key-files:
  created:
    - ".planning/phases/07-watchparty/07-UAT-RESULTS.md (scaffolded by commit 2136aae as PENDING; evolved through gap-closure to final 8/8 PASS state)"
  modified: []

key-decisions:
  - "8-scenario UAT plan covers flagship (scheduled to active flip + watchpartyStarting push) + 7 secondary scenarios. Scenario 1 is non-substitutable — the Phase 6 push loop only closes if a real client schedules a real party that the lifecycle flips to active."
  - "Issues #1-#4 routed to gap-closure plans within Phase 7 (07-05..08) rather than deferred — the 4 issues are Phase 7 closure-quality concerns, not future-phase enhancements. Issue #5 (async-replay) is genuinely a future-phase feature, seeded as phase-9x-async-replay.md."
  - "Two cross-cutting bugs surfaced + closed in-session (passive-update lag, wallclock-filter migration) rather than seeded as plans — both were 1-line fixes with low risk + immediate UAT visibility. Direct commit pattern preserved velocity without sacrificing audit trail."
  - "Scenarios 7+8 (orphan archive) accepted as code+health-verified rather than full behavioral end-to-end — branch logic confirmed at exact line numbers in queuenight/functions/index.js + production CF tick health (8 consecutive ticks, 0 errors) gives high confidence without authorizing prod-doc mutation. Upgrade path: organic occurrence or user-authorized Path A test."

patterns-established:
  - "Phase-internal gap-closure pattern: UAT checkpoints discover issues that are addressed within the same phase via numbered follow-on plans (07-05..08), not punted to gap-closure-as-a-future-phase."
  - "Surfaced-and-fixed-in-session pattern for low-risk cross-cutting bugs — when a UAT bug fix is a 1-line change with immediate verifiability, the commit lands during the UAT session rather than being deferred to a separate plan."
  - "Code+health verification as a path to PASS: when prod-mutation is required for behavioral end-to-end (Scenarios 7+8 require editing a Firestore doc to trigger archive), branch-logic + CF-health confirmation suffices to mark PASS with the upgrade path documented."

requirements_completed: [PARTY-02, PARTY-03, PARTY-04, PARTY-05, PARTY-06, PARTY-07]
verifier_method: retroactive_backfill_phase_15.2

# Metrics
duration: ~1 day (UAT run 2026-04-21 evening + diagnostic + in-session fixes)
completed: 2026-04-22
---

# Plan 07-04 — Phase 7 UAT Checkpoint

**Hands-on UAT of Phase 7 against couchtonight.app on iPhone PWA + second-device family member. Flagship Scenario 1 (scheduled to active flip + watchpartyStarting push) PASS at <5s — closes the Phase 6 push loop. 8/8 scenarios accounted-for in final state (6 hands-on PASS + 2 code+health verified). 5 issues surfaced; 4 routed to numbered gap-closure plans 07-05..08 within Phase 7; 1 deferred to phase-9x-async-replay seed. 2 cross-cutting bugs surfaced and fixed in-session (commits 14e959a + ce3c507).**

## What landed

- **07-UAT-RESULTS.md scaffolded** (commit `2136aae`, status PENDING) at the start of the UAT session, then progressively updated as scenarios were run. Final commit `bdc2ae3` flipped the status to complete with 8/8 PASS / static-verified.
- **Pre-flight verification:** `firebase deploy --only functions:watchpartyTick` deployed cleanly + observed ticking every 5 min (10 families scanned, 0 errors). `firebase deploy --only hosting` confirmed via Scenarios 2/4/5/6. Settings -> Notifications -> Watchparty starting toggle ON for Scenario 1.
- **Scenarios 1-6** run hands-on on iPhone PWA + second device 2026-04-21 evening. All PASS. Scenarios 7-8 (orphan archive) accepted as code+health verified per branch-logic confirmation + CF tick health.
- **5 issues surfaced** during UAT, documented in 07-UAT-RESULTS.md "Outstanding issues" section:
  1. **Issue #1** — Watchparty scheduled-time display off by ~4 hours on non-creator account (UTC vs creator-tz); root cause confirmed at `queuenight/functions/index.js:169`. Routed to Plan **07-05** (creatorTimeZone capture).
  2. **Issue #2a** — Hide-reactions toggle persisted but live modal not re-rendered until close+reopen. Routed to Plan **07-06** (pre-await optimistic render).
  3. **Issue #2b** — Reaction-delay feature did not exist. Routed to Plan **07-07** (viewer-side delay net-new build).
  4. **Issue #3** — Late-joiner empty reaction backlog (render-gate short-circuit at `js/app.js:7609` `!mine || !mine.startedAt` branch). Routed to Plan **07-06** (modeOverride wallclock-forced render).
  5. **Issue #4** — Default on-time inference + manual late-joiner override missing. Routed to Plan **07-08** (effectiveStartFor + claimStartedOnTime).
  6. **Issue #5** — Banner dismiss + async-replay watchparty mode (feature request). **Deferred** to `seeds/phase-9x-async-replay.md`; out of scope for Phase 7.
- **In-session cross-cutting fixes:**
  - **commit `14e959a`** — `fix(07): wire renderWatchpartyLive into watchparties onSnapshot` — closed passive-update lag where reactions posted from one device didn't appear on the receiver until the receiver took a local action.
  - **commit `ce3c507`** — `fix(07): renderReactionsFeed filter uses wall-clock time, not mixed-anchor elapsed` — closed cross-anchor coordinate-space bug where reactions posted by one participant could be filtered out by viewers with a different effectiveStart anchor.
- **Phase 7 closure commit** `bdc2ae3` (`test(07): complete Phase 7 UAT — 8/8 accounted, 2 in-session fixes`) flipped UAT-RESULTS.md to `status: complete` after gap-closure plans 07-05..08 shipped.

## Commits

- **`2136aae`** — `docs(07-04): scaffold UAT-RESULTS.md — 8 scenarios PENDING` (initial scaffold at UAT start)
- **`996268e`** — `test(07): complete Phase 7 UAT — 8/8 PASS, 4 gaps + 1 seed` (UAT run completion + issues catalogued)
- **`371b2ff`** — `diag(07): confirm root causes for UAT gaps #1-#3 via parallel code-explorer` (diagnostic phase that fed plans 07-05..08)
- **`ac65a99`** — `state(07): Phase 7 UAT complete-with-gaps — route to /gsd-plan-phase 7 --gaps`
- **`14e959a`** — `fix(07): wire renderWatchpartyLive into watchparties onSnapshot` (in-session passive-update fix)
- **`ce3c507`** — `fix(07): renderReactionsFeed filter uses wall-clock time, not mixed-anchor elapsed` (in-session wallclock-filter fix)
- **`bdc2ae3`** — `test(07): complete Phase 7 UAT — 8/8 accounted, 2 in-session fixes` (Phase 7 close)
- **`ff90403`** — `state(07): Phase 7 COMPLETE — mark closed in STATE + ROADMAP`

## Smoke tests

UAT scenarios run on physical hardware; full per-scenario detail in 07-UAT-RESULTS.md. Final state:

- **Total scenarios:** 8
- **PASS (hands-on):** 6 (Scenarios 1-6)
- **PASS (code+health verified):** 2 (Scenarios 7-8 — orphan archive branches)
- **Issues surfaced:** 5 (4 routed to gap-closure plans 07-05..08; 1 deferred to phase-9x seed)
- **In-session fixes:** 2 cross-cutting (commits 14e959a + ce3c507)
- **Deferred:** 1 (desktop responsive layout — closed by Plan 09-04 commit `f4297ee`)

## Must-haves checklist

- [x] 07-UAT-RESULTS.md exists with per-scenario PASS/FAIL
- [x] Scheduled to active flip verified: schedule a party 2 min out, status flips and watchpartyStarting push arrives
- [x] Tonight banner verified live on iPhone + second device
- [x] Reactions verified <2s cross-device
- [x] Orphan prevention verified: scheduled to stale archives after 6h (code+health verified path; behavioral upgrade path documented)
- [x] PARTY-06 — session ends cleanly on all participants leaving (covered by Scenario 8 empty-active-timeout branch + Plan 07-01 `watchpartyTick` CF orphan branches)

## What this enables

- **Phase 7 gap-closure waves (07-05..08):** This UAT was the seeding event for the 4 gap-closure plans. Issue #1 -> 07-05; Issue #2a + #3 -> 07-06; Issue #2b -> 07-07; Issue #4 -> 07-08.
- **Phase 6 closure:** Flagship Scenario 1 PASS confirms the watchpartyStarting push delivery contract end-to-end. Phase 6's UAT was previously blocked because no client wrote the scheduled-to-active transition; Plan 07-01 fixed that and this UAT verified it.
- **Phase 9 backlog seed:** Issue #5 (banner dismiss + async-replay) explicitly seeded as `seeds/phase-9x-async-replay.md`; Phase 9 desktop responsive layer (Plan 09-04 commit `f4297ee`) closed the deferred desktop-modal-responsiveness gap.
- **Cross-phase pattern formalized:** UAT-internal gap-closure (numbered follow-on plans) vs cross-phase deferral (seed file). The pattern recurred in Phase 14 (which followed the same shape with its own gap-closure plans).
- **STATE.md updates:** the full Phase 7 lifecycle landed as `state(07): gap-closure plans verified` -> `state(07): Phase 7 COMPLETE` -> `docs(07): STATE.md post-deploy — Phase 7 live on couchtonight.app`.

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 07-04 shipped 2026-04-22 — only the 4 gap-closure plans (07-05..08) got proper SUMMARYs at the time. The v33.3 milestone audit YAML (`.planning/v33.3-MILESTONE-AUDIT.md` lines 51-102) identified the gap as "PARTY-02..07: orphaned/partial — 07-04-SUMMARY.md absent for the UAT checkpoint." Evidence sources used for this reconstruction:

- `07-04-PLAN.md` (5-task UAT plan structure with checkpoint:human-verify gates + resume-signals)
- `07-UAT-RESULTS.md` (the deliverable — full per-scenario detail with results, root-cause analyses, gap routing)
- `07-UAT.md` (phase-level UAT test plan referenced from VERIFICATION.md)
- Existing 07-05/06/07/08-SUMMARYs (reference back to which Issue # they closed; cross-validates the gap-routing claims here)
- Git log for the Phase 7 close window 2026-04-21 to 2026-04-22 (`git log --oneline --all --since=2026-04-21 --until=2026-04-23`) — exact commits enumerated above
- Production-live state at couchtonight.app (Phase 7 is shipped; sw.js cache versions progressed past v34.1)
- v33.3 audit YAML evidence blocks for PARTY-02..PARTY-07 (lines 61-102)

UAT was status `complete` at the time of original 2026-04-22 close-out (per 07-UAT-RESULTS.md frontmatter); SUMMARY just was never authored. This retroactive SUMMARY adds the canonical `requirements_completed:` frontmatter key per Pitfall 5 of the 15.2-RESEARCH.

---

_Phase: 07-watchparty_
_Plan: 04_
_Completed: 2026-04-22_
_Reconstructed: 2026-04-27 by Phase 15.2-03 (retroactive_backfill_phase_15.2)_
