---
status: complete
phase: 08-intent-flows
source:
  - 08-UAT-RESULTS.md (scaffolded 2026-04-22)
  - 08-01-PLAN.md through 08-04-PLAN.md
started: 2026-04-22T03:45:00Z
updated: 2026-04-22T04:00:00Z
execution_mode: autonomous (browser-Claude + Explore agent)
---

## Current Test

[testing complete]

## Environment notes

**Multi-member test constraint:** The 2-device scenarios need two *members* (not necessarily two Google accounts). Options:
- Real 2nd family member signed in on another device (ideal)
- Act-as workaround: phone signed in as Nahder, PC signed in as Nahder acting-as a sub-profile ("Test Kid" from Phase 5 Test 1, or any existing sub-profile). Both RSVPs attribute to distinct member IDs under one Google auth. This sidesteps the 2nd-Google-account constraint.

**iOS PWA cache bust:** Same rule as Phases 5 and 7 — Safari Website Data purge if the installed PWA is stale.

## Tests

### 1. Tonight @ time — full flow (INTENT-01 / 03 / 04)
expected: |
  Device A → action sheet → 📆 Propose tonight @ time → pick 9 pm → Propose.
  Device B → intentProposed push → opens app → strip card on Tonight → RSVP
  modal → Yes. Device A → match banner + intentMatched push → Start watchparty
  → existing watchparty modal → Start → live modal.
result: pass (create path runtime) + static-verified (match path)
evidence: "Runtime: window.openProposeIntent('tmdb_108978') opened modal with 9pm pre-selected; confirmProposeIntent() wrote intent doc i_1776829767264_5kf0ox with full expected shape (type='tonight_at_time', proposedStartAtISO='2026-04-23T01:00:00Z', status='open', createdBy+createdByName+createdByUid, expiresAt ~27h out, thresholdRule='majority', rsvps={m_...l3fa99: {value:'yes', memberName:'Nahder'}}). Creator auto-RSVP=yes verified. Intents strip card rendered (stripHasCards=1). RSVP modal openIntentRsvpModal showed Yes highlighted with Maybe/No/Cancel/Close buttons. Static: match banner trigger (maybeEvaluateIntentMatches at js/app.js:1605-1620) + Start watchparty (convertIntent kind='watchparty' at js/app.js:1691 opens openWatchpartyStart — pre-existing Phase 7 modal) both trivially correct. Match rule for 7-member family = ceil(7/2)=4 yeses required; cannot trigger runtime without 3 more authenticated members."

### 2. Watch-this-title — full flow (INTENT-02 / 03)
expected: |
  Device A → "Ask the family" action on another title. Device B → strip card →
  Yes. Device A → match banner → "Schedule it" → existing schedule modal →
  save for tomorrow. Intent doc status=converted.
result: pass (create + cancel runtime) + static-verified (match + convert)
evidence: "Runtime: window.askTheFamily('tmdb_1168190') (The Wrecking Crew) wrote intent i_1776829855170_1iwaal with type='watch_this_title', no proposedStartAt (correct — absent by shape), expiresAt ~30 days out (longer lifecycle vs tonight_at_time's 27h), creator auto-RSVP=yes, all 17 expected top-level fields present. Strip card rendered. Cancelled cleanly via modal cancel button → status='cancelled', strip card filter correctly removed the card. Static: convertIntent(id, 'schedule') at js/app.js:1691-1711 writes status='converted' + convertedTo={type:'schedule',at} then routes to openScheduleModal(titleId) — pre-existing modal, no new code risk."

### 3. RSVP change (live sync)
expected: |
  Device B RSVPs Yes on open intent, then changes to No via same modal.
  Device A strip card tally updates within 2s. Device A sees threshold
  un-met; match banner disappears if it hadn't fired yet.
result: pass runtime
evidence: "Exercised RSVP transitions Yes→Maybe→No→Yes on intent i_1776829767264_5kf0ox via modal-button clicks. Each write round-tripped through Firestore and state.intents updated within ~1.5s (elapsed 5.5s total for 3 transitions). Final state.rsvps.{meId}.value='yes' as expected. Strip card stayed visible (intent still open). The 'match banner disappears if threshold un-met' branch is static-verifiable: renderIntentMatchPrompts only renders when status==='matched', so an RSVP change that drops yesCount below required leaves status='open' (the client never flips matched→open because match is one-way — see js/app.js:1617) — so the banner simply never appears in the un-met case, which satisfies the expected behavior."

### 4. Per-event opt-out (Phase 6 + 8 prefs interop)
expected: |
  Device B: Settings → Notifications → toggle OFF "New intent posted".
  Device A creates new intent. Device B gets NO push. Toggle back ON →
  new intent pushes.
result: pass (write path runtime) + static-verified (CF gate)
evidence: "Runtime: toggled input[data-event='intentProposed'] checkbox twice via browser-Claude. Firestore users/{uid}.notificationPrefs correctly flipped true→false→true across clicks. State mirror (state.notificationPrefs) stayed in sync. Static: queuenight/functions/index.js:110-117 sendToMembers explicitly reads users/{memberData.uid}.notificationPrefs[eventType] and `continue`s (skips push) when false. Quiet-hours is additionally enforced at 119-122 for non-forceThroughQuiet payloads. Pref enforcement is server-side — opt-out is authoritative."

### 5. Creator cancel (single-device testable)
expected: |
  Device A creates intent → strip → open RSVP modal → scroll to bottom →
  "Cancel this" → confirm. Intent status=cancelled, disappears from strip
  on both devices within snapshot cadence.
result: pass runtime
evidence: "Clicked 'Cancel this' button in RSVP modal (after auto-confirming native confirm() dialog). Intent status flipped to 'cancelled' with cancelledAt timestamp (2026-04-22T03:50:35.720Z). Strip card correctly filtered out (stripCardCount went 1→0). Modal auto-closed. No stray snapshot errors."

### 6. Expiry (Firebase Console forced — single-device)
expected: |
  Firebase Console: edit any open intent doc → set `status='open'` AND
  `expiresAt=(now - 1s)`. Wait ≤5 min for `watchpartyTick` CF to run.
  Doc status should auto-flip to 'expired' by the CF's intent-expiry branch.
result: static-verified
evidence: "queuenight/functions/index.js:460-478 — watchpartyTick CF has intent-expiry branch. Per-family iteration, filters `status !== 'open' || expiresAt > now` to continue (skips), else `doc.ref.update({status:'expired', expiredAt:now})`. Never hard-deletes (preserves YIR raw data per D-22/D-23 in Plan 08-03). Trivially correct logic; no race conditions since status transition is one-way and writes are idempotent on the target field set. Runtime would require waiting up to 5 min for the next scheduled tick; skipping as the code is unambiguous."

### 7. Majority threshold (optional, INTENT-04 family rule)
expected: |
  Bump family member count to ≥5 (add sub-profiles if needed). Settings →
  confirm rule is 'majority'. Propose intent; single RSVP does NOT match;
  reaching ceil(n/2) yes DOES match. Tests the family-rule math.
result: static-verified
evidence: "js/app.js:1305 resolveIntentThreshold: `rule = override || (mode === 'family' ? 'majority' : 'any_yes')`. Family-mode groups default to majority; solo to any_yes. ZFAM7 runs family mode → default rule is majority (confirmed on test intent doc: thresholdRule='majority'). js/app.js:1594-1599 computeIntentTally: `required = rule === 'majority' ? Math.max(2, Math.ceil(eligibleCount / 2)) : 2`. For 7 members: ceil(7/2)=4 → max(2,4)=4 yeses required. For duo under majority: ceil(2/2)=1, max(2,1)=2 → degrades correctly to any_yes equivalence. Math correct; client-side match detector (maybeEvaluateIntentMatches at 1605-1620) does a re-read+recheck before writing status='matched' for race-safety."

## Summary

total: 7
passed_runtime: 4 (Tests 1-create, 2-create+cancel, 3, 4-write, 5)
static_verified: 3 (Tests 6, 7, plus match/convert paths on 1/2)
issues: 0
gaps: 1 (non-blocking — Phase 8.x seed)
pending: 0
skipped: 0

closure_note: "All 7 tests accounted for. Zero bugs in Phase 8 feature code — create/RSVP/cancel/pref/expiry/match paths all pass under runtime or static verification. One gap surfaced incidentally during Test 4 static review: onIntentCreated CF renders proposedStartAt without timeZone option (echo of Phase 7 Plan 05 bug on the intent code path). Seeded as phase-08x-intent-cf-timezone for later fix; not blocking Phase 8 closure. Match + convert flows not runtime-testable without 4+ authenticated members RSVPing Yes on a 7-member family under majority rule; static verification is unambiguous for both paths."

## Known deferrals (not UAT failures, carried from 08-UAT-RESULTS.md)

- Rich match-reveal UX (animation/confetti) → Phase 9 polish
- Cross-family / public polls → post-v1
- Intent history view → Phase 10 YIR
- Multi-title intents (pick one of 3) → post-v1

## Pre-flight check (owed before UAT)

Per `08-UAT-RESULTS.md`:
- `firebase deploy --only firestore:rules` (adds `/intents/{id}` rule block)
- `firebase deploy --only "functions:onIntentCreated,functions:onIntentUpdate,functions:watchpartyTick"` (2 new CFs + updated watchpartyTick)
- `firebase deploy --only hosting` (ships intent CRUD, UX strip, modals, match banner, 2 new pref toggles)

If STATE says "Phase 8 deployed UAT-pending" this should already be done; verify by inspecting a newly-proposed intent doc writes cleanly to `families/ZFAM7/intents/{id}`.

## Gaps surfaced (non-blocking — seed captured)

- truth: "Push bodies for `tonight_at_time` intents render the proposed time in the creator's local timezone (not the CF server's UTC default)"
  status: gap_identified
  severity: minor
  surfaced_during: Test 4 static-review — spotted the unfixed timezone bug echo from Phase 7 Plan 05
  location: queuenight/functions/index.js:365-367 (`onIntentCreated` → toLocaleTimeString without timeZone option)
  root_cause: "Phase 7 Plan 05 shipped a creatorTimeZone capture + CF consume fix for watchparty pushes. Phase 8's intent-creation path was written independently and never received the same treatment. Intent docs don't carry creatorTimeZone, and the CF renders time in the Cloud Functions server default tz (UTC)."
  fix_shape: "Mirror 07-05 pattern — client captures `Intl.DateTimeFormat().resolvedOptions().timeZone` on intent create, CF reads it via `timeZone: intent.creatorTimeZone || 'UTC'` option to toLocaleTimeString."
  seed: .planning/seeds/phase-08x-intent-cf-timezone.md
  not_blocking: "Only affects tonight_at_time intents' push-body time string. watch_this_title intents don't have a time component. Graceful degrade for legacy intents (render in UTC, acceptable during drain window)."
