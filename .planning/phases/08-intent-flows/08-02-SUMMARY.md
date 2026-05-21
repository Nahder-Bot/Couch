---
phase: 08-intent-flows
plan: 08-02
status: complete
completed: 2026-04-22
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [INTENT-01, INTENT-02]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 08-02 — Intent-flow UX (action sheet entries + propose modal + Tonight strip + RSVP modal)

Ships all user-visible surfaces for the intent-flow primitive: title-detail action sheet entries for both flow types, propose-tonight modal with quick-pick times, standing open-intents strip on the Tonight screen, and RSVP modal reachable from the strip. Builds on Plan 08-01's CRUD foundation. INTENT-01 and INTENT-02 acceptance criteria — "a member can start / RSVP" — become true end-to-end after this plan, modulo threshold/match logic which lands in 08-03.

## What landed

### Client (`js/app.js`)
- **Action-sheet entries** added to `openActionSheet` for any unwatched title, gated on `!t.watched && state.me`:
  - 📅 **"Propose tonight @ time"** → opens `#intent-propose-modal-bg` with quick-pick times
  - 💭 **"Ask the family"** → calls `askTheFamily(titleId)` directly (one-tap, no modal)
  - Positioned BEFORE the existing Watchparty entry per D-08 (higher intent = earlier in list)
- **`window.openProposeIntent(titleId, type)`** — opens the propose modal hydrated with title name/poster
- **`confirmProposeIntent()`** — reads chosen time + note + calls `createIntent({type:'tonight_at_time', titleId, proposedStartAt, proposedNote})`
- **`window.askTheFamily(titleId)`** at js/app.js:1754 — one-tap shortcut: `createIntent({type:'watch_this_title', titleId})` + `flashToast('Asked your family')`. No modal, no extra input
- **`renderIntentsStrip()`** — iterates `state.intents.filter(i => i.status === 'open')` sorted by createdAt desc; each card shows poster thumbnail + title + type icon (📅 tonight_at_time / 💭 watch_this_title) + RSVP tally + your-RSVP state. Click routes to `openIntentRsvpModal(intentId)`
- **`openIntentRsvpModal(intentId)`** + **`window.setMyRsvp(intentId, value)`** — RSVP modal renders title + proposed time + per-member tally + buttons (Yes / Maybe / No, plus Later for watch_this_title only). Re-tap-to-unvote pattern per D-09. Reuses existing modal-close pattern (✕ button + tap-outside)

### App shell (`app.html`)
- `<div id="tonight-intents-strip"></div>` at app.html:336-337 (with comment marker "Phase 8: Open intents strip. Populated by renderIntentsStrip() from onSnapshot handler.")
- `#intent-propose-modal-bg` + `#intent-propose-modal-content` at :1170-1171
- `#intent-rsvp-modal-bg` + `#intent-rsvp-modal-content` at :1175-1176

### CSS (`css/app.css`)
- `.intents-strip` warm-palette card styles matching the existing `.wp-banner` pattern from Phase 7
- Modal styles consistent with existing watchparty start modal (lead-time grid pattern)

## Cross-repo note

This plan was couch-repo only — no queuenight changes. Hosting deploy via `firebase deploy --only hosting` from `~/queuenight/public/` mirror per the standard ritual.

## Smoke tests

- `grep -n "intent-propose-modal-bg\|intent-rsvp-modal-bg\|tonight-intents-strip" app.html` → 3 hits confirming all 3 DOM containers present
- `grep -n "askTheFamily\|openProposeIntent\|renderIntentsStrip" js/app.js` → all 3 functions defined; `askTheFamily` at :1754 confirmed
- Existing action-sheet entries (Watchparty, Schedule, Veto) remain unchanged — verified by grep that no existing entries were removed

## Must-haves checklist

- [x] Title-detail action sheet on any unwatched title shows: 📅 "Propose tonight @ time" and 💭 "Ask the family"
- [x] Propose-tonight modal: title + 4 quick-pick times (8pm / 9pm / 10pm / Custom) + Note field + Create button
- [x] Ask-the-family creates a watch_this_title intent directly (no modal)
- [x] Tonight screen renders an open-intents strip when state.intents has open entries
- [x] Strip cards show title + type + RSVP tally ("2 of 3 yes") + your-RSVP state
- [x] Tap a card → opens RSVP modal showing full detail + Yes / Maybe / No (/ Later for poll) buttons
- [x] RSVP buttons call setIntentRsvp; re-tapping the same value clears it
- [x] No regression: existing action-sheet entries (Watchparty, Schedule, Veto) remain

## What this enables

- **Plan 08-03** consumes the live-hydrated state from the strip rendering path for client-side match detection
- **Plan 08-04** push fan-out (`onIntentCreated` CF) lands users back into this UX via deep-link `?intent={id}` routing
- **Phase 14** rank-pick / nominate flows reuse the same DOM pattern (same `#intent-*` modal infrastructure extended with flow-aware screens)

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Phase 8 had ZERO SUMMARYs prior to Phase 15.2 per v33.3 milestone audit (lines 180-191) — the largest single audit-trail gap in the project. UAT was browser-Claude autonomous run 2026-04-22 (per ROADMAP §25). Evidence sources: 08-02-PLAN.md (5-task block + interfaces), 08-CONTEXT.md (D-08/D-09/D-10/D-11 UX decisions), production-live DOM containers at app.html:336-337/:1170-1171/:1175-1176, askTheFamily callsite at js/app.js:1754, audit YAML lines 192-198 (INTENT-02 evidence block).
