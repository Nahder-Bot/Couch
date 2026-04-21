---
phase: 06-push-notifications
plan: 05
type: uat-results
---

# Phase 6 — Push Notifications UAT Results

**Scaffolded:** 2026-04-21 (autonomous session)
**Started:** 2026-04-22 (iPhone PWA, Nahder)
**Tester:** Nahder (nahderz@gmail.com)
**Devices:**
- Required: physical iPhone running iOS 16.4+ with couchtonight.app installed via Safari → Share → Add to Home Screen
- Recommended: second device (Android Chrome or a spouse/kid's iPhone) to fire events that push to the tester
- Optional: Android physical device for Android-path verification

**Environment:** `couchtonight.app` via Firebase Hosting — requires the autonomous-session deploy batch to be applied first (see SESSION-SUMMARY.md for the deploy commands).

---

## Pre-flight

| Check | Status | Notes |
|---|---|---|
| `firebase deploy --only functions:onInviteCreated,onSessionUpdate,onWatchpartyCreate,onWatchpartyUpdate,onTitleApproval` ran successfully | **PASS** | Deployed 2026-04-22. 2 creates (onInviteCreated, onSessionUpdate) + 3 updates. |
| `firebase deploy --only firestore:rules` ran successfully | **PASS** | Deployed 2026-04-22. `match /users/{u}` live. |
| `firebase deploy --only hosting` ran successfully | **PASS** | Deployed 2026-04-22 (initial + two cache-bump redeploys: v13 Phase 6 wiring, v14 subscribe race fix). |
| Open couchtonight.app → sign in → Settings → Notifications card appears | **PASS** | Card renders. Account tab > Notifications. |
| Tap "Turn on" → browser permission prompt appears → grant → "✓ This device is on" + 6-row toggle list visible | **PASS (after fix)** | First attempt on iPhone landed in "Permission granted but not subscribed" — a race between updateNotifCard() and subscribeToPush() in enableNotifications. Tapping Resubscribe fixed it; the 6 toggles + Quiet hours row rendered correctly. Race fixed permanently in commit `9f50b96` + sw.js bumped to v14. Future users won't hit this. |

---

## Scenario results (Plan 06-05 tasks)

| # | Scenario | Result | Latency | Notes |
|---|---|---|---|---|
| 1 | **iOS standalone PWA — cross-device push (flagship)** — second device schedules a watchparty via "Now" (status=active at create), iPhone receives push within ~5s | **PASS** (adapted) | ~few sec | 2026-04-22. Second device (incognito with separate Firebase user as different family member) tapped ⋯ on a title card → Start watchparty → Now → Start. iPhone PWA (backgrounded) received "New watchparty" push, tap opened into the app. End-to-end proven: VAPID subscribe → Firestore write → onWatchpartyCreate trigger → sendToMembers with eventType=watchpartyScheduled + self-echo guard → web-push → APNs-bridge → iOS 16.4+ standalone PWA delivery → service worker showNotification → notificationclick deep-link. **Adaptation note:** original plan tested onWatchpartyUpdate (status→active transition). Execute-time discovery: current codebase has no scheduled→active transition mechanism (no cron CF, no client timer), so onWatchpartyUpdate is effectively dead code in practice. Tested the onWatchpartyCreate path instead, which covers the same stack layers. scheduled→active gap seeded as Phase 7 watchparty-lifecycle work. |
| 2 | **Self-echo guard** — actor does NOT receive push for their own action | **PASS** | — | 2026-04-22. iPhone scheduled a watchparty itself; iPhone received no push (other family members did). Confirms excludeUid + excludeMemberId guard in sendToMembers works end-to-end (06-02 + 06-03 wiring). Only the watchparty-create path exercised; titleApproval + inviteReceived self-echo paths inferred to work via the same code path but not individually verified. |
| 3 | **Per-event opt-out** — toggle "Watchparty scheduled" OFF → second device schedules a watchparty → no push arrives; toggle back ON → next watchparty does push | PENDING | — | Tests PUSH-02. Relies on users/{uid}.notificationPrefs server-side enforcement from 06-03. |
| 4 | **Quiet hours** — enable quiet hours spanning current time ±5min → second device schedules non-RSVP watchparty → no push (inside quiet window); second device flips the watchparty to active AFTER you RSVP → push DOES arrive (forceThroughQuiet override). Disable quiet hours after. | PENDING | — | Tests PUSH-04. Relies on isInQuietHours + forceThroughQuiet from 06-04. |
| 5 | **Invite received** — from second device, send the tester an in-app guest invite or claim-member invite → push arrives on tester's iPhone titled "Invite from [sender]" | PENDING | — | Tests onInviteCreated from 06-04. Only fires when invite doc carries `recipientUid`. |
| 6 | **Veto cap** — from a second family device, veto 3 picks in a single tonight-session → group owner's device receives "Tonight is stuck" push (cap fires on crossing 3) | PENDING | — | Tests onSessionUpdate veto-cap branch from 06-04. Owner must have opted into `vetoCapReached` in Settings first (defaults OFF). |
| 7 | **Android delivery (nice-to-have)** — same flagship test on Android Chrome PWA | PENDING-HARDWARE | — | Acceptable to mark PENDING-HARDWARE if no Android device available. Web-push standard support on Android is mature. |

---

## Known stubs / deferrals (not UAT failures)

1. **`tonightPickChosen` event** — intentionally NOT wired to a CF trigger in Phase 6. The existing session schema has no `pickedTitleId` transition; accepting a spin creates a watchparty doc which `onWatchpartyCreate` already pushes for. The pref toggle exists in Settings but has no effect until Phase 7/8 introduces a pickFinalizedAt signal. Not testable this phase.
2. **Apple Sign-In interaction** — Apple Sign-In is deferred to Phase 9 (per Phase 5 seed). Push works with any signed-in user; tester should verify with Google sign-in rather than Apple.
3. **Family-level quiet hours** — per-user only in v1 per CONTEXT.md `<deferred>`. Each family member sets their own quiet range.

---

## Outstanding issues

(to fill during UAT)

---

## Recommendation

**Phase 6 ready for /gsd-verify-work:** PENDING — will be YES when scenarios 1-6 are PASS and scenario 7 is PASS or PENDING-HARDWARE (acceptable).

Suggested order on the iPhone:
1. Pre-flight checks (verify deploy + subscribe flow works)
2. Scenario 1 flagship — if this fails, most others will too
3. Scenario 3 per-event — 1 minute each way
4. Scenario 2 self-echo — 2 minutes across event types
5. Scenario 5 invite — needs second account
6. Scenario 4 quiet hours — requires ~10 min elapsed for the window
7. Scenario 6 veto cap — needs coordination with second device
8. Scenario 7 Android — optional

---

## Provenance

Scaffolded 2026-04-21 by Claude autonomous session. Hands-on UAT deferred to the tester's next iOS session. Update this file in place and commit per scenario (`docs(06-05): UAT results — scenario N PASS`). Plan 06-05 accepts `uat-results-committed` resume signal once all non-deferred scenarios are PASS or explicitly PENDING-HARDWARE.
