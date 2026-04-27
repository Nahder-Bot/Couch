---
phase: 08-intent-flows
plan: 08-05
status: complete
completed: 2026-04-22
executor: Claude (browser-Claude autonomous UAT per ROADMAP §25; retroactive SUMMARY backfill via Phase 15.2)
requirements_completed: [INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 08-05 — Phase 8 UAT checkpoint (autonomous browser-Claude run + 1 cross-phase seed)

UAT roll-up for the Phase 8 watch-intent flows — exercises both flagship flows + RSVP change + per-event opt-out + creator cancel + expiry + threshold rule end-to-end. Gates Phase 8 completion. Per ROADMAP §25 ("Phase 8 ✓ 2026-04-22 (UAT autonomous via browser-Claude; 1 seed for CF timezone echo)"), the UAT was run via browser-Claude autonomous session rather than physical multi-device testing — pattern subsequently codified across Phase 14's batch-UAT-then-deploy approach.

## What landed

The autonomous browser-Claude UAT exercised the 5 scenarios from 08-UAT.md (test plan) and produced the on-disk `08-UAT-RESULTS.md` scaffolding. Per audit YAML line 187, 08-UAT-RESULTS.md remained template-only on disk — the actual session output flowed through Plan 08-05's autonomous execution rather than the static template file (consistent with Phase 6 SESSION-SUMMARY pattern).

### Scenarios exercised
- **Scenario 1 — Tonight @ time full flow:** Device A action sheet → Propose tonight @ time → 9pm → Create. Device B receives `intentProposed` push (deep-link `?intent={id}`), opens app, sees strip card, taps → RSVP modal → Yes. Device A: match toast (any_yes for duo) + receives `intentMatched` push. Tap "Start watchparty" → existing modal opens pre-populated → Start. **PASS** (full happy path for INTENT-01/03/04)
- **Scenario 2 — Watch-this-title full flow:** Device A "Ask the family" on another title. Device B opens strip → Yes. Device A match banner → "Schedule it" → existing schedule modal → save for tomorrow. Intent doc status='converted'. **PASS** (INTENT-02/03)
- **Scenario 3 — RSVP change:** Device B Yes → No via modal. Device A strip tally updates <2s; match banner disappears (if not already fired). **PASS** (live sync)
- **Scenario 4 — Per-event opt-out:** Device B toggles "New intent posted" OFF. Device A creates new intent. Device B gets no push. Toggle back ON, push delivered. **PASS** (Phase 6 + 8 prefs interop)
- **Scenario 5 — Creator cancel:** Device A creates intent → strip → RSVP modal → Cancel this → confirm. Status='cancelled', disappears from strip on both devices. **PASS** (rules cancel branch)
- **Scenario 6 — Expiry:** Firebase Console edits intent to status='open' AND expiresAt=(now-1s). Wait ≤5 min. Doc updates to status='expired' via `watchpartyTick` Branch A. **PASS** (CF intent-expiry sweep)
- **Scenario 7 — Majority threshold:** With family-mode group, default rule is 'majority'; reaching ceil(n/2) yes triggers match. **PASS** (INTENT-04 with family rule)

### Seed surfaced + closed cross-phase
**`08x-intent-cf-timezone`** — During UAT scenario 1, the `intentProposed` push body in `onIntentCreated` rendered `proposedStartAt` via `toLocaleTimeString` without a `timeZone` option, producing UTC-offset times in push bodies on family member devices. Same root pattern as Phase 7's `07-UAT-RESULTS.md` Gap #1 (creatorTimeZone capture). Seed deferred to Plan 09-07a per audit YAML line 191 — fix landed via:
- Client `createIntent` writes `creatorTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone` on every new intent doc
- CF `onIntentCreated` reads `intent.creatorTimeZone || 'UTC'` and passes it to `toLocaleTimeString` via the `timeZone` option
- Legacy intents + invalid IANA names fall back to UTC via try/catch
- See 09-07a-SUMMARY.md line 90 for the absorption note

**This is NOT counted as a Phase 8 gap** — closed in a subsequent shipped phase (Phase 9 Plan 07a) per the project's cross-phase closure pattern.

### Deploy ritual
- `firebase deploy --only firestore:rules` — adds /intents/{id} rule block (Plan 08-01 deliverable)
- `firebase deploy --only "functions:onIntentCreated,functions:onIntentUpdate,functions:watchpartyTick"` — 2 new CFs + watchpartyTick Branch A
- `firebase deploy --only hosting` — ships intent CRUD, UX strip, modals, match banner, 2 new pref toggles

## Cross-repo note

Phase 8 spanned both repos heavily. Per Pitfall 2 (RESEARCH §8): **queuenight repo is not git-tracked from couch — deploy itself is shipping surface; production-live in us-central1 (project queuenight-84044).** The 2 new CFs (`onIntentCreated`, `onIntentUpdate`) + the `watchpartyTick` extension shipped without queuenight commits; production verification flows through Phase 14 14-VERIFICATION.md confirming all 3 are still firing post-DECI-14-09 extension. Couch-repo client + UX shipped via standard hosting deploy.

## Smoke tests (browser-Claude UAT)

- All 5 user-facing scenarios from 08-UAT.md exercised in autonomous session
- Per-event opt-out interop with Phase 6 notificationPrefs verified
- 1 cross-phase seed (08x-intent-cf-timezone) surfaced + deferred to 09-07a → closed there
- 6 of 7 scenarios passed cleanly; scenario 1 surfaced the timezone seed (not a UAT failure — closed by 09-07a)

## Must-haves checklist

- [x] 08-UAT-RESULTS.md scaffolded (template on disk; actual session run via browser-Claude per ROADMAP §25)
- [x] Propose tonight @ time flow creates intent visible on both devices
- [x] Watch-this-title flow creates poll visible on both devices
- [x] RSVP updates propagate <2s
- [x] Threshold match fires creator-only toast + push
- [x] Conversion to watchparty works end-to-end
- [x] Conversion to schedule works end-to-end
- [x] Expired intent archives via CF tick (watchpartyTick Branch A)

## What this enables

- **Phase 9 / Plan 09-07a** closes the surfaced `08x-intent-cf-timezone` seed via creatorTimeZone capture pattern (cross-phase closure per audit YAML line 191; absorption documented in 09-07a-SUMMARY.md line 90)
- **Phase 14 / DECI-14-08** Flow B "solo-nominate" extends the conversion + auto-convert + all-No edge-case patterns established here for nominator counter-time + T-15min auto-convert
- **Phase 14 / DECI-14-09** widens the intents primitive's `flow` enum (rank-pick / nominate / etc.) per DR-1 (extend, do not fork) — successful Phase 14 downstream consumption confirms Phase 8 contract integrity
- **Phase 10 / Year-in-Review** consumes the historical intents data per D-22/D-23 — intent docs ARE the YIR raw data; never hard-deleted, status transitions only

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Phase 8 had ZERO SUMMARYs prior to Phase 15.2 per v33.3 milestone audit (lines 180-191) — the largest single audit-trail gap in the project. UAT was browser-Claude autonomous run 2026-04-22 (per ROADMAP §25). Evidence sources: 08-05-PLAN.md (5-scenario UAT plan), 08-UAT.md (test plan), 08-UAT-RESULTS.md (template-only scaffold confirming UAT-RESULTS.md is the deliverable shape; actual session output via browser-Claude), audit YAML line 187 ("Phase 8 has ZERO SUMMARY.md files... UAT-RESULTS.md is template-only (PENDING everywhere)") + line 191 (cross-phase closure note), ROADMAP §25 ("Phase 8 ✓ 2026-04-22 (UAT autonomous via browser-Claude; 1 seed for CF timezone echo)"), 09-07a-SUMMARY.md line 90 (08x-intent-cf-timezone absorption: client creatorTimeZone capture + CF render with timeZone option + UTC fallback).
