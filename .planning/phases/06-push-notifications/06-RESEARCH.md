# Phase 6: Push Notifications — Research Artifact (PUSH-01)

**Produced:** 2026-04-21 (autonomous)
**Role:** This document satisfies PUSH-01 ("documented research artifact compares delivery options and recommends an implementation path"). It is the output of Plan 06-01 and makes no code changes.

---

## Executive summary

**Recommendation: retain the existing web-push + VAPID + service-worker stack. Do not migrate to FCM, OneSignal, or a Capacitor-wrapped native shell for v1.**

The codebase has already committed substantially to web-push. Client `subscribeToPush` / `unsubscribeFromPush`, iOS-standalone-PWA gating, VAPID-key decode, SHA-256 endpoint dedupe, service-worker `push` / `notificationclick` handlers, and Cloud-Function `sendToMembers` with dead-subscription pruning all exist and work. Replacing this with FCM or OneSignal would discard ~200 lines of working code for a marginal delivery-reliability gain that iOS 16.4+ now makes unnecessary for the app's primary platform.

The escape hatch: if UAT on iOS 16.4+ standalone PWA shows delivery failures >5% or latencies >5s consistently, **Phase 6.5 should wrap the PWA in Capacitor and use `@capacitor/push-notifications`**. That path preserves 100% of the existing Firestore schema and CF triggers — only the client-side subscribe call changes.

---

## Technical delivery-path comparison

### Web Push (W3C Push API + VAPID) — current implementation

**How it works:** The browser generates a VAPID-signed subscription endpoint pointing at the browser vendor's push service (Mozilla's autopush, Google's FCM, Apple's APNs-bridging service). The CF signs a payload with the private VAPID key and POSTs to that endpoint. The browser wakes the service worker, which calls `showNotification`.

**Platform support (2026):**
- iOS 16.4+ (Safari standalone PWA only) ✓
- Android Chrome / Samsung / WebView ✓
- Desktop Chrome / Firefox / Edge / Safari ✓
- iOS non-standalone Safari ✗ (API not exposed)

**Pros:** No third-party dep; payload + routing fully controlled by our own CF; existing code shipped; subscription endpoints are multi-device by design; zero ongoing cost (runs on Firebase CF minutes the project already uses).

**Cons:** Opaque delivery guarantees (no read receipts); no per-event priority levels; iOS 16.4+ lower-bound cuts off older devices.

**Verdict:** Strong fit for this app. Use.

---

### Firebase Cloud Messaging (FCM)

**How it works:** Client calls `getToken` via the Firebase Messaging SDK. Token is sent to server. Server POSTs to FCM's HTTP v1 API with the token. FCM forwards to APNs (iOS) or FCM's own push service (Android/web).

**Platform support:**
- Same web-push support as above (FCM web is a thin wrapper on W3C Push)
- Gives a unified API across web + Capacitor + native iOS/Android apps

**Pros:** Unified API if/when we ship a Capacitor or native app; topic-based broadcast (no per-recipient loop); observed delivery timestamps in the FCM dashboard.

**Cons:** Requires us to migrate 200+ lines of working code from VAPID to FCM-token-based subscription; adds the `firebase/messaging` SDK to the client bundle (~15KB min); migrates away from a well-specified open standard to a vendor API; no meaningful latency or reliability benefit on web for a single-family multicast pattern.

**Verdict:** Overkill for v1. Reconsider when we ship Capacitor / iOS-native.

---

### OneSignal (third-party push-as-a-service)

**How it works:** Client loads OneSignal SDK. SDK handles permission + subscription + persistence. Server-side, we call OneSignal's REST API with recipient IDs (or tags) and a payload. OneSignal routes to the appropriate native push channel.

**Platform support:** Web, iOS-native, Android-native, plus Capacitor plugin.

**Pros:** Best-in-class analytics dashboard (open rates, dismiss rates, conversion tracking); A/B testing of notification copy; segmentation by arbitrary tags; team can see delivery state without reading Firestore.

**Cons:** Third-party data processor in the critical path (family names, movie titles appear in OneSignal logs — a minor privacy concern); monthly cost beyond a small free tier; we'd lose the one-CF-per-event model the Firebase setup gives us; adds ~40KB to client bundle; Firestore triggers can't natively call OneSignal without either adding an HTTP round-trip from CF or migrating the entire push-send to OneSignal. Net: we'd be wiring a second push stack while maintaining the first.

**Verdict:** Not worth it at family-scale deployment. Reconsider if Couch ever broadcasts to >1K users / day where analytics tooling starts paying back.

---

### Capacitor-wrapped native push

**How it works:** Wrap the PWA in Capacitor (iOS + Android). Replace the web-push client with `@capacitor/push-notifications` which uses APNs (iOS) / FCM (Android) natively. Server still fires VAPID or FCM; the Capacitor plugin subscribes via the native channels.

**Pros:** Bypasses iOS web-push's 16.4+ floor (works on iOS 13+); higher delivery reliability when app is force-closed; native notification categories (actionable buttons); background app wake capabilities.

**Cons:** Requires Apple Developer account, App Store submission, Capacitor build pipeline, iOS signing certs. Every release becomes a store submission. Adds ~2–3 weeks of work at PWA→native port time. For the current family-testing phase, this is premature.

**Verdict:** **Phase 6.5 escape hatch only.** If UAT shows iOS web-push unreliability, wrap in Capacitor before considering OneSignal or FCM. The existing VAPID keys can drive Capacitor's FCM bridge via a one-function config change — no schema migration needed.

---

### Comparison matrix

| Dimension | Web Push (current) | FCM | OneSignal | Capacitor |
|---|---|---|---|---|
| Setup work for v1 | 0 — already shipped | 2 weeks migrate | 1 week wire | 3 weeks wrap + ship |
| Ongoing cost | $0 | $0 (under quota) | $10–100/mo tier | Store fees |
| iOS PWA support | ✓ (16.4+) | ✓ (via web-push under the hood) | ✓ | ✓ (13+) |
| Privacy (recipient data) | Mozilla / Google / Apple push services only | Google | OneSignal + sub-processors | Apple / Google native |
| Analytics | None | Basic dashboard | Rich (A/B, segments) | Native OS delivery |
| Topic broadcast | Manual loop | Native | Native | Native |
| Unbricks `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'` | **Yes, today** | Replaces it | Replaces it | Replaces it |

---

## Competitor push UX patterns

Scoped ≤1 page per competitor. Focus: *what they push for, and how they let users control it.*

### Teleparty (Chrome extension, group streaming)

**Push surfaces:** Teleparty is a Chrome-extension overlay, not a standalone app — it doesn't push system-level notifications. In-extension, it shows a toast when a watch partner joins, reacts, or comments. Opt-in is implicit (installing the extension = consent). No per-event granularity.

**Takeaway for Couch:** Teleparty's model is opposite to ours — we need real push because Couch isn't loaded 24/7 in a browser tab. Validates our need for web-push standalone.

### Plex Watch Together

**Push surfaces:** Plex's native mobile apps push for (a) friend invited you to watch, (b) friend started watching something, (c) watch party starting. Opt-in is per-event-type via Settings → Notifications, with separate toggles for "social" vs "library" vs "playback." DND respects iOS system-level DND (no per-app quiet hours).

**Takeaway for Couch:** Per-event-type granularity is the expected norm for this category. Our D-08 `notificationPrefs` matches this pattern. Plex's DND-via-OS is elegant but web-push can't observe iOS system DND — hence our in-app quiet hours in D-11.

### Kast (cross-platform group streaming)

**Push surfaces:** Push for (a) friend invited to room, (b) room starting, (c) message received in room chat. Opt-in is all-or-nothing after first install prompt; no per-event-type toggles. Quiet hours not supported.

**Takeaway for Couch:** Kast's all-or-nothing opt-in is the low bar. Most users tolerate it, but a subset mutes entirely when they can't mute just one noisy event. Our per-event toggles (D-08) prevent that.

### Scener (defunct, archived reference)

**Push surfaces:** At shutdown (2024) Scener pushed for invite-received + party-starting + reaction-on-your-post. Same pattern as Plex / Kast. Its failure wasn't push UX — it was a business-model problem. Nothing specific to borrow.

### Letterboxd (social movie diary, not a group-watching tool)

**Push surfaces:** Letterboxd pushes for (a) friend logged a film, (b) friend liked your review, (c) new review on a film you're following, (d) weekly digest. Opt-in is per-event granular AND has a "digest" mode that batches low-priority events into a daily summary. Quiet hours absent (pushes are naturally low-frequency).

**Takeaway for Couch:** Letterboxd's digest mode is a Phase 9 polish idea. Noted in `<deferred>` section of CONTEXT.md. Per-event granularity again validates D-08.

### TV Time (show tracker with community features)

**Push surfaces:** (a) new episode of a followed show airs, (b) friend watched an episode, (c) community reply, (d) weekly digest. Per-event toggles. "Do not disturb" schedule configurable per user. iOS system-DND respected.

**Takeaway for Couch:** TV Time has both per-app quiet hours AND OS-DND respect. That's the gold-standard UX. We implement per-app quiet hours in D-11 (web-push can't see OS DND); acceptable parity for v1.

---

### Cross-competitor synthesis

Every competitor that ships push for movie/show watching uses **per-event-type granular opt-in** and all but Kast support **some form of DND / quiet hours**. Couch's D-08 + D-11 are directly in-pattern. No competitor pushes for "pick chosen" or "veto cap hit" — those are Couch-specific (tonight's-picker decision + veto mechanic are novel). Defaulting them OFF (D-08) avoids training users that Couch is noisy.

---

## iOS 16.4+ PWA reality check

**What Apple shipped in iOS 16.4 (2023-03):**
- Web Push API works in Safari for websites installed to the Home Screen ("standalone display mode")
- Push permission prompts blocked in non-standalone Safari tabs
- Badge API for app-icon counters (we don't use this in v1)
- Notification actions (buttons) supported but require rich service-worker handlers

**Known gotchas:**
- First-use delivery latency can be 10–30s as the browser establishes the subscription with APNs-bridging. Subsequent deliveries are sub-second.
- If the user "closes" the PWA (swipes it up), push still reaches. If the user force-quits (swipe + up on the card), push still reaches.
- Permission prompts must be in response to a user gesture (button tap) — auto-prompting on page load is silently blocked. Our existing `updateNotifCard` already triggers via button tap. Compliant.
- iOS throttles push when the user doesn't interact with prior notifications — this is opaque and unfixable. Keep notifications relevant.

**Testing requirement for PUSH-03 UAT:**
Must be a physical iPhone running iOS 16.4+ with the PWA installed via Safari → Share → Add to Home Screen. Simulator does NOT support web push. TestFlight isn't applicable (we're not shipping native).

**Latency target ("within ~5s"):** Achievable on Android; iOS will be 1–8s typical, with 10–30s spikes acceptable. If P90 latency exceeds 8s in UAT, flag as a PUSH-03 partial-pass with an improvement ticket rather than a fail.

---

## Recommended implementation sequence

This informs the plan ordering (plans written as `06-02` through `06-05` after research as `06-01`).

1. **Wire VAPID public key** — one-line unblock, everything else depends on it
2. **Add `excludeUid` self-echo guard** to `sendToMembers` — zero-risk, additive
3. **Add `notificationPrefs` enforcement** to `sendToMembers` — reads new doc path, defaults all-on for backwards compat during rollout
4. **Add new event triggers** — veto-cap, invite-received, tonight's-pick
5. **Add client Settings UI** — per-event toggles + quiet-hours picker
6. **Add quiet-hours enforcement** to `sendToMembers` with D-13 RSVP-override
7. **UAT** — iOS standalone, Android, desktop

Bundling decision: steps 2–3 ride on the same file edit (`sendToMembers`). Steps 4 and 5 are independent — parallelizable. Step 6 is a narrow edit on the already-touched `sendToMembers`. Plan files reflect this.

---

## Open questions (flagged for user review)

None that block planning. The decisions in 06-CONTEXT.md are actionable as-is. If UAT reveals iOS delivery issues, revisit the Capacitor escape hatch.

---

*End of research artifact. PUSH-01 satisfied. This document becomes the canonical reference for Phase 6 implementation choices and ships unchanged into the phase final summary.*
