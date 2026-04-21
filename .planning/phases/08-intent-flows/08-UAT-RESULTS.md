---
phase: 08-intent-flows
plan: 05
type: uat-results
---

# Phase 8 — Watch-Intent Flows UAT Results

**Scaffolded:** 2026-04-22 (autonomous after plans 08-01..04 landed)
**Tester:** (to fill)
**Devices:** iPhone home-screen PWA + one second device signed in as a different family member

---

## Pre-flight

| Check | Status | Notes |
|---|---|---|
| `firebase deploy --only firestore:rules` | PENDING | Adds /intents/{id} rule block |
| `firebase deploy --only "functions:onIntentCreated,functions:onIntentUpdate,functions:watchpartyTick"` | PENDING | 2 new CFs; watchpartyTick updated with intent-expiry branch |
| `firebase deploy --only hosting` | PENDING | Ships intent CRUD, UX strip, modals, match banner, 2 new pref toggles |
| Open Settings → Notifications → 8 toggle rows now visible (6 from Phase 6 + 2 new: "New intent posted", "Intent matched") | PENDING | Auto-rendered from DEFAULT_NOTIFICATION_PREFS |

---

## Scenarios

| # | Scenario | Result | Latency | Notes |
|---|---|---|---|---|
| 1 | **Tonight @ time — full flow** — Device A: action sheet on unwatched title → 📆 Propose tonight @ time → pick 9 pm → Propose. Device B: receives `intentProposed` push, opens app, sees strip card on Tonight, taps → RSVP modal → Yes. Device A: sees match banner (any-yes rule on duo) + receives `intentMatched` push. Tap "Start watchparty" → existing watchparty modal opens → Start. Live watchparty modal appears. | PENDING | — | Full happy path for INTENT-01/03/04. |
| 2 | **Watch-this-title — full flow** — Device A: "Ask the family" on another title. Device B: opens strip card, taps Yes. Device A: match banner → tap "Schedule it" → existing schedule modal opens → save for tomorrow. Intent doc status=converted. | PENDING | — | INTENT-02/03. |
| 3 | **RSVP change** — Device B RSVPs Yes on an open intent, then changes to No via the modal. Device A strip card tally updates <2s. Device A sees threshold un-met and match banner disappears (if match hadn't fired yet). | PENDING | — | Tests re-RSVP flow + live sync. |
| 4 | **Per-event opt-out** — Device B toggles OFF "New intent posted" in Settings → Notifications. Device A creates a new intent. Device B gets no push. Toggle back ON, new intent pushes. | PENDING | — | Phase 6 + 8 prefs interop. |
| 5 | **Creator cancel** — Device A creates intent → goes to strip → opens RSVP modal → scrolls to bottom → taps "Cancel this" → confirms. Intent status=cancelled, disappears from strip on both devices. | PENDING | — | Tests rules cancel branch. |
| 6 | **Expiry (long-wait or console-forced)** — Firebase Console → edit an intent to have status=open AND expiresAt=(now-1s). Wait ≤5 min. Doc should update to status=expired. | PENDING-OPS | — | Tests watchpartyTick intent-expiry branch. |
| 7 | **Majority threshold** — Bump family member count to ≥5 (add sub-profiles if needed). Settings → confirm rule is 'majority'. Propose an intent; single RSVP does NOT match; reaching ceil(n/2) yes DOES match. | PENDING | — | INTENT-04 with family rule. Optional if family is small. |

---

## Known deferrals (not UAT failures)

- **Rich match-reveal UX** — current match banner is a top-center snackbar. Phase 9 polish for animation/confetti.
- **Cross-family / public polls** — v1 is family-scoped only.
- **Intent history view** — Phase 10 YIR consumes the same data for recap surfaces.
- **Multi-title intents** (pick one of 3) — post-v1 consideration.

---

## Outstanding issues

(to fill during UAT)

---

## Recommendation

**Phase 8 ready for /gsd-verify-work:** PENDING — Scenarios 1 and 2 are the must-pass for the flagship flows. 3-5 validate edge cases. 6 confirms lifecycle cleanup. 7 is optional.

---

## Provenance

Scaffolded 2026-04-22 after autonomous plans 08-01 (foundation + rules), 08-02 (UX), 08-03 (match + convert + expiry), 08-04 (push).
