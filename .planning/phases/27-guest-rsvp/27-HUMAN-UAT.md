---
phase: 27-guest-rsvp
type: human-uat
created: 2026-05-01
status: pending
deploy_cache: couch-v39-guest-rsvp
resume_signal: "uat passed"
---

# Phase 27 — Guest RSVP — Device UAT Scripts

> **Trigger after deploy completes.** Resume signal: `uat passed` → `/gsd-verify-work 27`.
>
> Test on at least: (a) iPhone Safari (non-PWA), (b) Android Chrome, (c) macOS Safari, (d) Desktop Chrome. Two-device tests need one host (signed in to app.html) and one guest (anonymous link tap).

## Pre-flight

- Confirm production cache is `couch-v39-guest-rsvp` via `curl -s https://couchtonight.app/sw.js | grep CACHE`.
- Confirm queuenight functions deployed: `firebase functions:list --project queuenight-84044` shows rsvpStatus + rsvpRevoke alongside existing rsvpSubmit + rsvpReminderTick.
- Pick a test watchparty: host creates a wp scheduled within next 1h. Note the wp's `/rsvp/<token>` link.

## Scripts

### UAT-27-01 — iOS Safari non-PWA: push block absent (RSVP-27-07)

1. On iPhone Safari, open the `/rsvp/<token>` link.
2. Tap "Going". Enter "Test1" as name.
3. Confirmation screen appears with: eyebrow "CONFIRMED", title "See you there.", sub-line, count line, privacy footer, "Pull up a seat" CTA.
4. **Verify**: NO "Get reminded when the party starts?" block is rendered. The graceful absence IS the iOS non-PWA path (D-06).
5. **Verify**: privacy footer link "Privacy Policy" navigates to `/privacy` page when tapped.

PASS / FAIL: ___

### UAT-27-02 — Android Chrome: push opt-in CTA appears + State A on success (RSVP-27-08)

1. On Android Chrome, open the same `/rsvp/<token>` link in a fresh browser tab (incognito to ensure no prior localStorage).
2. Tap "Going". Enter "Test2".
3. **Verify**: confirmation screen shows the "Get reminded when the party starts?" block with "Remind me" button.
4. Tap "Remind me". OS-level permission prompt appears. Allow.
5. **Verify**: button is replaced inline with "*You're on the list.*" (Instrument Serif italic, State A per UI-SPEC §1b).
6. Open browser devtools → Application → Service Workers — confirm `sw.js` is active under scope `/`.

PASS / FAIL: ___

### UAT-27-03 — Permission denied → State B (RSVP-27-08 negative)

1. On any browser where you previously denied notifications for couchtonight.app, open `/rsvp/<token>`.
2. Tap "Maybe", enter name, submit.
3. Tap "Remind me".
4. **Verify**: button is replaced with "Notifications blocked in your browser settings." (State B, Inter 13px ink-dim).

PASS / FAIL: ___

### UAT-27-04 — Two-device revoke flow within 30s (RSVP-27-09)

1. Device A (host): open app.html, navigate to the test watchparty's roster.
2. Device B (guest): open the same `/rsvp/<token>` link, RSVP "Going" as "Charlie".
3. Device A: confirm "Charlie" appears in the participant strip with the apricot guest pill.
4. Device A: tap the kebab on Charlie's chip → menu shows "Remove Charlie" → tap.
5. **Verify** (Device A): toast "Removed." appears; chip disappears from roster.
6. Wait up to 30 seconds.
7. **Verify** (Device B): rsvp.html confirmation flips to evicted state — Instrument Serif italic title "Your RSVP was removed by the host." with sub-line "Reach out to them directly if you think this is a mistake."
8. **Verify**: focus moves to the title element (use VoiceOver / TalkBack to confirm announcement).

PASS / FAIL: ___

### UAT-27-05 — Close RSVPs flow + RSVPs CLOSED pill + secondary close (RSVP-27-15 close path)

1. Device A (host): on the test wp banner, tap "Close RSVPs".
2. **Verify** (Device A): toast "RSVPs closed." appears; "RSVPs CLOSED" pill renders in `.wp-banner-body` (uppercase, Inter 11px, ink-dim, pill shape).
3. **Verify** (Device A): "Close RSVPs" button is replaced by "Open RSVPs".
4. Device B (new guest in another browser): try to RSVP via `/rsvp/<token>`.
5. **Verify** (Device B): submit returns the closed state — title "RSVPs are closed for this party." sub "The host has stopped accepting new RSVPs."
6. Device A: tap "Open RSVPs". Toast "RSVPs reopened." appears; pill disappears.

PASS / FAIL: ___

### UAT-27-06 — Name collision (guest) suffix (D-04, RSVP-27-14)

1. Pre-condition: the host's family has a member named "Sam".
2. Device B: open `/rsvp/<token>` and RSVP "Going" as "Sam".
3. Device A (host): refresh roster.
4. **Verify**: the guest chip shows name "Sam (guest)" + apricot pill. The original family member "Sam" still appears as a normal member chip without the (guest) suffix.

PASS / FAIL: ___

### UAT-27-07 — Aggregate count line on confirmation (D-01)

1. Pre-condition: 3 guests have already RSVP'd "yes" to the wp; 1 has RSVP'd "maybe"; 0 have RSVP'd "no" (or any "no" responses are hidden from the aggregate).
2. Device B: open `/rsvp/<token>` (fresh browser), RSVP "Maybe", name "Test7".
3. **Verify**: confirmation screen shows count line "3 going · 2 maybe" (or whatever counts apply post-this-submit). "no" responses must NOT appear.

PASS / FAIL: ___

### UAT-27-08 — guestId continuity (D-03)

1. Device B: RSVP "Going" as "Test8a".
2. Note the `qn_guest_<token>` localStorage key in devtools.
3. Reopen the same `/rsvp/<token>` URL in same browser; this time RSVP "Maybe" with the SAME name "Test8a".
4. Device A (host): refresh roster. **Verify**: only ONE chip for "Test8a", with response label updated to "Maybe".

PASS / FAIL: ___

### UAT-27-09 — Web push reminder fires on schedule (RSVP-27-10)

1. Pre-condition: a guest with `pushSub` set (UAT-27-02 must have already passed for the test guest).
2. Wait until the wp's `startAt - T-1h` window (or use Firebase Console → Cloud Scheduler → trigger `rsvpReminderTick` manually if available).
3. **Verify**: the test browser receives a system notification with title from `WINDOWS.yes[T-1h].title` and body interpolating the wp's titleName + hostName.

PASS / FAIL (or DEFERRED if no scheduler trigger access): ___

### UAT-27-10 — pushSub=null guests skipped silently (RSVP-27-11)

1. Pre-condition: a guest with `revoked: true` (e.g. UAT-27-04's Charlie) and a guest with `pushSub: null` (e.g. UAT-27-01's Test1 on iOS non-PWA who never opted in).
2. Trigger rsvpReminderTick (or wait for a window).
3. **Verify** (Firebase Functions logs): no error or send-attempt logged for the revoked or null-pushSub guests. The CF logs `totalSkipped` increment but no webpush call attempted.

PASS / FAIL (or DEFERRED if no logs access): ___

## Sign-off

User confirms PASS/FAIL on each script above and replies `uat passed` (or describes failures). On `uat passed`, run `/gsd-verify-work 27`.

## Browser matrix coverage map (RESEARCH Q1)

| Platform | Browser | Covered by | Expected |
|---|---|---|---|
| iOS 16.4+ | Safari (not PWA) | UAT-27-01 | Push block absent |
| iOS 16.4+ | Chrome iOS | UAT-27-01 (re-run on Chrome iOS) | Push block absent (Chrome iOS = WKWebView) |
| Android | Chrome | UAT-27-02 | Push opt-in succeeds |
| macOS Ventura+ | Safari 16+ | UAT-27-02 (run on Mac) | Push opt-in succeeds without install |
| Desktop | Chrome | UAT-27-02 | Push opt-in succeeds |
| Desktop | Firefox | UAT-27-02 (re-run on FF) | Push opt-in succeeds |

## Requirement coverage

This UAT scaffold covers the following Phase 27 requirements (mapped to scripts):

| Requirement ID | Covered by |
|---|---|
| RSVP-27-07 (iOS non-PWA push absent) | UAT-27-01 |
| RSVP-27-08 (Android push opt-in + States A/B) | UAT-27-02, UAT-27-03 |
| RSVP-27-09 (revoke poll within 30s) | UAT-27-04 |
| RSVP-27-10 (T-1h push reminder fires) | UAT-27-09 |
| RSVP-27-11 (pushSub=null skipped silently) | UAT-27-10 |
| RSVP-27-13 (privacy footer link) | UAT-27-01, UAT-27-02 |
| RSVP-27-14 (name collision (guest) suffix) | UAT-27-06 |
| RSVP-27-15 (host kebab remove + close RSVPs) | UAT-27-04, UAT-27-05 |

D-01 (aggregate counts), D-03 (guestId continuity), D-06 (Web push opt-in surface), D-07 (revoke + close flows) all exercised through the scripts above.
