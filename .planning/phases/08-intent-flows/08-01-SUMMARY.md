---
phase: 08-intent-flows
plan: 08-01
status: complete
completed: 2026-04-22
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [INTENT-01, INTENT-02]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 08-01 — Intent-flows schema + Firestore rules + CRUD helpers

Foundational data layer for the intent-flow primitive: Firestore subcollection path, security rules, CRUD helpers, and live `state.intents` hydration via onSnapshot. No UX surfaces yet — this plan is pure foundation that every subsequent Phase 8 plan (and downstream Phase 14) builds on. Atomically committable.

## What landed

### Client (`js/app.js`)
- `intentsRef()` returns `families/{state.familyCode}/intents` collection ref (verified at js/app.js:1632)
- `intentRef(id)` doc-ref helper for individual intent reads/writes
- `createIntent({type, titleId, proposedStartAt, proposedNote})` writes a new intent doc with:
  - Phase 5 `writeAttribution()` stamp on every write
  - Creator's implicit yes RSVP per D-06 (creator is always counted in numerator + denominator for majority math)
  - Type discrimination: `'tonight_at_time'` (proposedStartAt + 3h expiry) or `'watch_this_title'` (createdAt + 30d expiry)
  - `thresholdRule` resolved at create time from family.mode + family.intentThreshold override per D-04/D-05
- `setIntentRsvp(intentId, value)` writes `rsvps.{memberId}` updateDoc with writeAttribution; allowed values `['yes','no','maybe','later']`
- `cancelIntent(intentId)` creator-only updateDoc to `status: 'cancelled', cancelledAt`
- `computeIntentThreshold(group)` returns `{rule}` resolving to `'majority'` for family-mode + `'any_yes'` for duo/crew, with per-family override support
- `state.unsubIntents = onSnapshot(intentsRef(), …)` hydrates `state.intents` (verified at js/app.js:4381); typeof-guarded callbacks safely no-op pre-08-02 surfaces

### Firestore rules (`queuenight/firestore.rules`)
- New rule block `match /families/{familyCode}/intents/{intentId}` (currently at queuenight/firestore.rules:581 — Phase 14 widened these for `flow` enum + counterChainDepth ≤3 + open→converted; this plan shipped the original Phase 8 rule shape)
- `allow read: if isMemberOfFamily(familyCode)`
- `allow create:` family member only; creator must be self; `request.resource.data.status == 'open'`
- `allow update:` 3 disjoint branches via `diff().affectedKeys().hasOnly()`:
  - **RSVP branch** — any family member writes their own `rsvps[memberId]` slot (with writeAttribution fields)
  - **Cancel branch** — creator-only flips to `status='cancelled', cancelledAt`
  - **Match transition branch** — any family member can flip `open → matched, matchedAt` (covers client-side match detection from Plan 08-03)
- `allow delete: if false` — never hard-delete; archive via status transition only (D-23)
- Reuses existing `isMemberOfFamily` + `memberIdOf` helpers from Phase 5 Plan 04

### Sign-out teardown
- `state.unsubIntents` torn down in `onAuthStateChangedCouch` sign-out branch alongside other unsub teardowns; `state.intents` cleared

## Cross-repo note

This plan touched `queuenight/firestore.rules` for the new intents rule block. Per Pitfall 2 (RESEARCH §8): **queuenight repo is not git-tracked from couch — deploy itself is shipping surface; production-live in us-central1 (project queuenight-84044).** The rules are confirmed live in production via Phase 14's downstream verification (14-VERIFICATION.md cites the same rule block widened for DECI-14-09). The couch-repo audit trail captures the client side (js/app.js); the queuenight side has no commit reference, but the deployed `firebase deploy --only firestore:rules` from the user's `~/queuenight` directory shipped the rule.

## Smoke tests

- `grep -n intentsRef js/app.js` → 1 hit at :1632 (helper definition) + downstream callsites
- `grep -n createIntent js/app.js` → definition at :1651 (Phase 14 extension preserves Phase 8 contract via DR-1) + multi-callsite
- `grep -n state.unsubIntents js/app.js` → onSnapshot subscription wire-up + sign-out teardown both present
- Rules block at queuenight/firestore.rules:581 confirmed via `grep -n "/intents/" queuenight/firestore.rules`

## Must-haves checklist

- [x] `intentsRef()` helper returns `families/{code}/intents` collection
- [x] `createIntent({type, titleId, proposedStartAt?, proposedNote?})` writes a new doc with writeAttribution + creator's implicit yes RSVP
- [x] `setIntentRsvp(intentId, value)` writes `rsvps.{memberId}` updateDoc with writeAttribution
- [x] `cancelIntent(intentId)` creator-only updateDoc to status='cancelled'
- [x] `state.unsubIntents` onSnapshot hydrates `state.intents`
- [x] Firestore rules allow create/read for family members; write limited: RSVP writes target writer's own memberId; status writes limited to creator (cancel) + special match-transition check
- [x] `computeIntentThreshold(family)` returns `{rule, requiredYes}` based on family.mode + family.intentThreshold override

## What this enables

- **Plan 08-02** ships UX surfaces (action sheet entries + propose modal + Tonight strip + RSVP modal) on top of the CRUD helpers landed here
- **Plan 08-03** consumes the live-hydrated `state.intents` for client-side match detection + adds CF intent-expiry sweep
- **Plan 08-04** wires push fan-out triggers (`onIntentCreated` + `onIntentUpdate`) on the same Firestore path
- **Phase 14 / Plan 14-06 (DECI-14-09)** extends `createIntent` to accept 4 flow values (`rank-pick` / `nominate` / etc.) per DR-1 (extend, do not fork) — successful Phase 14 downstream consumption is itself evidence that the Phase 8 contract held up

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Phase 8 had ZERO SUMMARYs prior to Phase 15.2 per v33.3 milestone audit (lines 180-191) — the largest single audit-trail gap in the project. Evidence sources: 08-01-PLAN.md (must-haves checklist + interfaces block), 08-CONTEXT.md (D-01..D-23 locked decisions), production-live `intentsRef` + `state.unsubIntents` at js/app.js:1632/:4381, queuenight/firestore.rules:581 (Phase 14-widened rule block — Phase 8 origin preserved), audit YAML line 184-191 (INTENT-01 evidence block), Phase 14 14-VERIFICATION.md downstream-consumption evidence.
