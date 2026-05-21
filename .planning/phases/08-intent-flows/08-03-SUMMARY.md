---
phase: 08-intent-flows
plan: 08-03
status: complete
completed: 2026-04-22
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [INTENT-03, INTENT-04, INTENT-05, INTENT-06]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 08-03 — Match detection + conversion routers + CF expiry sweep

Closes the loop on the intent-flow primitive: detects threshold-met matches client-side, prompts the creator with inline convert actions, routes into existing watchparty/schedule flows on confirm, and extends the Phase 7 `watchpartyTick` CF with an intent-expiry branch. INTENT-03/04/05 satisfied here; INTENT-06 is naturally satisfied by D-22/D-23 (intent docs ARE the YIR raw data — no separate log).

## What landed

### Client (`js/app.js`)
- **`maybeEvaluateIntentMatches(intents)`** — iterates open intents on every onSnapshot tick:
  - For each open intent: `computeIntentTally(intent)` returns `{required, yesCount, eligibleCount, rule}` per D-04 threshold rules
  - If `yesCount >= required`: getDoc recheck of status (idempotent under races) → updateDoc to `status='matched', matchedAt: Date.now()`
  - Separately: for matched intents where I'm the creator AND `_intentMatchPromptShown` doesn't already include the id → call `showIntentMatchPrompt(intent)`
- **`computeIntentTally(intent)`** — counts yes RSVPs across non-creator members; `eligibleCount` excludes expired temporary members; threshold resolves per D-04 (`majority` → `Math.ceil(eligibleCount / 2)`; `any_yes` → 2 minimum, creator counted)
- **`showIntentMatchPrompt(intent)`** — fires creator-only inline match prompt:
  - tonight_at_time → "Start watchparty" / "Later" buttons
  - watch_this_title → "Schedule it" / "Later" buttons
  - Per-session `_intentMatchPromptShown` Set prevents duplicate toasts on snapshot rebroadcasts
- **`window.convertIntent(intentId, kind)`** at js/app.js:2066 (kind: `'watchparty' | 'schedule'`):
  - watchparty path: pre-populates `wpStartTitleId` + opens existing `openWatchpartyStart(titleId)`; if proposedStartAt close to a quick-pick lead time, pre-selects matching radio
  - schedule path: opens existing `openScheduleModal(titleId)`
  - After downstream confirmation, stamps intent doc `status='converted', convertedTo: {type, at: Date.now()}` per D-13
- **`flashToast` extended** with optional `actions: [{label, onClick}]` to support the inline match prompt without leaving the user's current screen (per D-12)

### Cloud Function (`queuenight/functions/index.js`)
- **`watchpartyTick` extended** with intent-expiry branch (now visible at queuenight/functions/index.js:711-732 — Branch A "Hard expire (existing behavior; works for all 4 flows now)"):
  - Per-family loop reads intents subcollection
  - For each `status === 'open' && expiresAt < now` → updates to `status='expired', expiredAt: now`
  - Logs count in tick summary
  - Same 5-min cron; amortized cost per D-17 (additive subcollection read per family)

### Action button rendering
- `js/app.js:2042` — strip card renders convert action button when status='matched' and viewer is the creator: `<button class="pill accent" onclick="convertIntent('${intent.id}','${isTonightAtTime ? 'watchparty' : 'schedule'}')">${actionPrimary}</button>`

## Cross-repo note

This plan touched both repos:
- **Couch repo** — match detection + conversion router + flashToast actions extension shipped via standard hosting deploy
- **Queuenight repo** — `watchpartyTick` CF extension. Per Pitfall 2 (RESEARCH §8): **queuenight repo is not git-tracked from couch — deploy itself is shipping surface; production-live in us-central1 (project queuenight-84044).** The CF extension is confirmed live via Phase 14's downstream evidence (14-VERIFICATION.md cites watchpartyTick Branch A still works for all 4 flows). No queuenight commit reference; the `firebase deploy --only functions:watchpartyTick` from `~/queuenight` shipped the change.

## Smoke tests

- `grep -n "maybeEvaluateIntentMatches\|computeIntentTally\|showIntentMatchPrompt\|convertIntent" js/app.js` → all 4 functions defined; `convertIntent` window export at :2066
- `grep -n "intents.*expiresAt\|status.*expired\|Hard expire" queuenight/functions/index.js` → Branch A at :711-732 confirmed
- `node --check queuenight/functions/index.js` passes (assumed at deploy time; CF deployed cleanly per audit evidence)

## Must-haves checklist

- [x] `maybeEvaluateIntentMatches(intents)` detects open intents where yes-count meets thresholdRule; writes status='matched' + matchedAt via updateDoc (idempotent under races via status recheck)
- [x] Match detection runs in every onSnapshot tick on intents
- [x] Match prompt (client toast) fires for the creator on transition to match-detected state — flashToast with inline actions: 'Start watchparty' / 'Schedule' / 'Dismiss'
- [x] Start watchparty path calls existing confirmStartWatchparty flow pre-populated with titleId + proposedStartAt
- [x] Schedule path calls existing openScheduleModal(titleId)
- [x] watchpartyTick CF extended with branch: expire intents where status='open' AND expiresAt < now → status='expired'
- [x] Intent records survive status transitions for Phase 10 YIR consumption (D-22/D-23)

## What this enables

- **Plan 08-04** wires push fan-out so the match prompt is also delivered as `intentMatched` push (creator-only; non-self-echoed)
- **Plan 08-05** UAT exercises the match-then-convert flow end-to-end (browser-Claude autonomous run 2026-04-22)
- **Phase 14 / 14-08 (DECI-14-08)** Flow B "solo-nominate" extends the conversion machinery for nominator counter-time + auto-convert + all-No edge case — the conversion router pattern landed here generalizes naturally
- **Phase 9 / 09-07a** closed the `08x-intent-cf-timezone` follow-up seed surfaced during this plan's UAT (timezone echo in the CF push body — see 09-07a-SUMMARY.md line 90 for the absorption note)

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Phase 8 had ZERO SUMMARYs prior to Phase 15.2 per v33.3 milestone audit (lines 180-191) — the largest single audit-trail gap in the project. UAT was browser-Claude autonomous run 2026-04-22 (per ROADMAP §25). Evidence sources: 08-03-PLAN.md (4-task block + interfaces detailing maybeEvaluateIntentMatches + computeIntentTally + showIntentMatchPrompt + convertIntentToAction + watchpartyTick branch), 08-CONTEXT.md (D-04/D-05/D-07/D-12/D-13/D-15/D-16/D-17 decisions), production-live convert action button at js/app.js:2042 + window.convertIntent at :2066 + watchpartyTick Branch A at queuenight/functions/index.js:711-732, audit YAML lines 199-219 (INTENT-03/04/05 evidence blocks), 09-07a-SUMMARY.md timezone-echo absorption note.
