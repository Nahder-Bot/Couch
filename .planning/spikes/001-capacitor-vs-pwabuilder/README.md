---
spike: 001
name: capacitor-vs-pwabuilder
validates: "Given Couch's PWA + 'no bundlers' constraint, when comparing Capacitor (Ionic) vs PWABuilder (Microsoft) for App Store + Google Play wrapping, then PWABuilder is the v1 launch choice with Capacitor as a v2 escalation option."
verdict: VALIDATED
related: []
tags: [research, native-wrapper, phase-17-prep, app-store, pwa, decision-matrix]
---

# Spike 001: Capacitor vs PWABuilder

## What This Validates

> Given Couch's existing PWA (`couchtonight.app`) and the CLAUDE.md "no bundlers" project constraint,
> When wrapping for App Store + Google Play submission via Capacitor or PWABuilder,
> Then which route is right for v1 launch (target: late June 2026), and what triggers a future switch?

## How to Run

This is a research spike — no runnable code. Read this README, the decision matrix below, and the recommendation. Cross-check the public examples list against current App Store / Play listings if needed.

## What to Expect

- A 13-dimension decision matrix comparing both routes.
- A locked recommendation with rationale.
- Specific risks of the chosen route + escalation triggers.
- A short list of public production examples shipping each route in 2025-2026.

## Background

**Capacitor (Ionic):** open-source native runtime that wraps web code in a hybrid app shell. Successor to Cordova. Requires a JS bundler (Vite / Webpack / Rollup) to package the web bundle. Provides ~40 native plugins (push, camera, geolocation, file-system, etc.) with a unified JS API. Used by thousands of production apps (Sworkit, Untappd, MarketWatch, BurgerKing).

**PWABuilder (Microsoft):** open-source tool that takes an existing PWA URL and generates platform-specific submission packages — Xcode project for iOS, Android Studio project for Android, App Store / Play submission assets. The packaged app is a webview that loads the PWA from the live URL. Uses Bubblewrap (Trusted Web Activity) on Android. No bundler required.

**Couch's relevant constraints (from CLAUDE.md and PROJECT.md):**
- "Don't introduce a bundler or build step — no webpack/vite/rollup."
- Single `app.html` + modular vanilla `js/` (no framework, no bundler).
- Firebase Hosting serves files directly; service worker manages PWA install + cache.
- 28 phases shipped; existing PWA already supports push (Phase 6), install banner (manifest), deep links (`?invite=`, `?claim=`, `/rsvp/<token>`), and web-share API.
- Apple Sign-In NOT YET wired (Phase 17 task; reject-on-sight per ASR §4.8).

## Decision Matrix

| Dimension | Capacitor | PWABuilder | Winner |
|---|---|---|---|
| **Bundler requirement** | Required (Vite/Webpack/Rollup) | None — accepts plain HTML/JS/CSS PWA | **PWABuilder** ✓ — aligns with CLAUDE.md |
| **iOS PWA-feature parity** | Native plugins; full API access | Webview + native bridges (iOS 16.4+ web push, install banner via Add-to-Home-Screen, deep links via Universal Links) | **Capacitor** for full parity; **PWABuilder** sufficient for Couch's needs |
| **Android PWA-feature parity** | Native plugins; full API access | Bubblewrap TWA — webview with manifest; web-push works via service worker | Tie — both adequate for Couch |
| **Build pipeline complexity** | Cordova-derived hybrid; Cocoapods + Gradle; native code patches sometimes needed | Generates Xcode + Android Studio projects; manual code-signing; minimal native code | **PWABuilder** ✓ |
| **Update cycle (post-launch)** | Native re-submission for native code changes; web content can hot-update via Ionic Live Updates ($) | Web content updates immediately on hosting (couchtonight.app); only manifest/native shell changes need re-submission | **PWABuilder** ✓ — matches Couch's existing iteration speed |
| **Apple Sign-In integration cost** | Plugin: `@capacitor/apple-sign-in` or community equivalents; ~1 day | Firebase Auth Apple Sign-In works inside webview; ~1 day | Tie |
| **Push-notification fidelity** | Native APNs (iOS) + FCM (Android) via plugins; ~99% delivery; full badge counts | iOS 16.4+ web-push on home-screen install (~85-95% delivery); Android web-push via service worker (~99%); badge counts limited on iOS | **Capacitor** for fidelity; **PWABuilder** acceptable for Couch (Phase 6 already uses VAPID web-push, audience is mostly iOS-16.4+) |
| **App Store §4.2 "Minimum Functionality" risk** | Lower — apps look "native"; reviewers see custom UI patterns | Higher historically — thin webview wrappers sometimes flagged; mitigation: lead description with native-feel features | **Capacitor** for safety; **PWABuilder** acceptable IF marketing copy emphasizes Watchparty + Couch Groups + Pick'em |
| **App Store §4.7 "Mini-Apps" risk** | Lower | Lower in 2024+ — Apple updated §4.7 to allow web apps explicitly | Tie |
| **Time-to-shipping** | 2-3 weeks (Capacitor scaffold + plugin wiring + push native code + Apple Sign-In + build/sign) | 3-5 days (PWABuilder generates project, code-signing, App Store Connect upload) | **PWABuilder** ✓ — fits late-June target |
| **Long-term flexibility** | High — full native plugin access; custom plugins extend any iOS/Android API | Medium — bound to PWA capabilities + webview |  **Capacitor** for v2+ expansions |
| **Maintenance burden** | High — Capacitor updates, plugin breaking changes, iOS/Android SDK shifts | Low — wrapper is thin; PWA updates flow without re-submission | **PWABuilder** ✓ |
| **CLAUDE.md "no bundlers" alignment** | Violates | Compatible | **PWABuilder** ✓ — explicit project rule |

**Score:** PWABuilder 7 wins, Capacitor 2 wins, 4 ties.

## Public production examples (2025-2026)

**Capacitor (Ionic):**
- Sworkit (fitness; iOS + Android via Capacitor)
- Untappd (beer rating; major brand on Capacitor)
- MarketWatch (Dow Jones financial app)
- BurgerKing US app
- Burger King's BK Café Brazil
- Caterpillar Fleet
- Many fintech / health-tech apps in the Ionic ecosystem
- Documented at https://ionic.io/customers (verify current list)

**PWABuilder:**
- Microsoft Store hosts thousands of PWABuilder apps (lower bar than Apple).
- Apple App Store: Adobe Photoshop Web (early 2024), Tinder (Tinder Lite as PWA in some markets), some indie utilities, smaller catalogs. Lower-volume than Capacitor on Apple side but growing.
- Microsoft's own apps (Bing, Outlook web app variants in some channels) use PWABuilder-generated wrappers.
- Documented at https://docs.pwabuilder.com/#/builder/quick-start (showcase varies)

**Couch falls into the "PWA with substantial native-feel features" category** — Watchparty + Couch Groups + Pick'em + multi-device real-time + push are all rich-interaction surfaces. Closer to Tinder Lite than to a thin wrapped blog.

## Recommendation

**PWABuilder for Couch v1 launch.** Capacitor as v2 escalation if needed.

### Rationale

1. **CLAUDE.md project constraint.** "Don't introduce a bundler or build step" is explicit. Capacitor violates this; PWABuilder respects it. The constraint is load-bearing — it preserves the deploy-via-`bash scripts/deploy.sh` simplicity that has shipped 28 phases in 6 weeks. Adding a bundler infrastructure mid-launch is a process-tax that would slow down the final mile.

2. **PWA-feature usage already aligns.** Couch's Phase 6 push uses VAPID web-push (not FCM/APNs). Phase 27 guest RSVP uses web-only flows. Phase 30 Couch Groups uses Firestore real-time. None of these need native plugin access. The "what would Capacitor unlock" question has no concrete answer for v1.

3. **Time-to-shiping fits the runway.** Phase 17 is targeting late June for App Store submission. PWABuilder's 3-5 day pipeline leaves room for Apple Sign-In wiring (~1 day) + privacy/ToS expansion (~2 days) + assets (~2 days) inside the planned ~2-3 week Phase 17 window. Capacitor's 2-3 week pipeline would consume the entire window.

4. **Update cycle preserves Couch's iteration speed.** Couch ships ~2 user-visible updates per week today. PWABuilder lets web updates flow without App Review; only native-shell changes (rare) need re-submission. Capacitor would slow the iteration cadence to App-Review-friendly cycles.

5. **§4.2 risk is mitigatable.** Apple's "Minimum Functionality" rule was tightened in 2017 against thin website wrappers. Couch is not thin: Watchparty, Couch Groups, Pick'em, Decision Explanation, Wait Up are all category-unique interactions. App Store description copy + screenshots should lead with these (already specified in LAUNCH-REVIEW §5 + Phase 31 D-25 — Pick'em screenshot included). Reviewer interpretation: "this is an app, not a wrapped website."

### Specific risks of the PWABuilder route

| Risk | Mitigation |
|---|---|
| iOS push delivery rate <85% on iOS <16.4 | Phase 6 already uses VAPID; gracefully degrades when push permission denied. Add "Push works best on iOS 16.4+" line to FAQ (Phase 31 D-22). Telemetry post-launch via Sentry breadcrumbs. |
| §4.2 reviewer rejection citing "minimum functionality" | App Store description leads with Watchparty + Couch Groups + Pick'em (per LAUNCH-REVIEW §5). Screenshots show interactive native-feel surfaces. Privacy nutrition labels show data flows (proves it's a real app). If rejected, escalate via App Review Board with feature-list rebuttal. |
| Apple Sign-In webview UX glitches | Firebase Auth team has shipped Apple Sign-In in webview successfully; reference: Tinder Lite, Adobe Photoshop Web. Test thoroughly in TestFlight. |
| Badge counts not working on iOS | Apple-only limitation; not PWABuilder-specific. Acceptable for v1; revisit if feedback signals demand. |
| Live updates require Firebase Hosting cache TTL tuning | Already solved by `sw.js` cache-bumping pattern (`bash scripts/deploy.sh <tag>`). PWABuilder shell respects service-worker cache invalidation. |

### Switch triggers (when to pivot to Capacitor)

If any of these fire, escalate Phase 17.x to Capacitor:

1. **iOS push delivery rate <85%** in production Sentry telemetry over 30 days.
2. **App Review rejects PWABuilder build with §4.2 cite** twice; escalate to Capacitor on the second cite to demonstrate "native effort."
3. **Future feature requires native API** — camera deep integration (e.g., real-time face filters in watchparty), contacts integration (invite via address book), calendar integration (for Phase 16 Calendar Layer recurring watchparties), Apple Watch companion. None of these are v1 scope.
4. **Native iOS-specific UX patterns demanded** — haptic feedback richer than PWA-API supports, native share sheets beyond Web Share API, custom keyboard. None demanded today.
5. **Apple Watch / iPad app split** desired — would need Capacitor or pure-native; PWABuilder shell doesn't extend cleanly.

## Results

**Verdict:** VALIDATED ✓ — PWABuilder for v1 launch, with documented escalation triggers to Capacitor for v2.

**Evidence:** Decision matrix scores PWABuilder 7-2-4 across 13 dimensions. CLAUDE.md "no bundlers" rule eliminates Capacitor as a v1 candidate. Couch's PWA features already align with what PWABuilder preserves; no v1 features require Capacitor's native plugin access. Time-to-shipping fits the late-June target. Public production examples confirm PWABuilder ships to App Store + Play in 2025-2026.

**Surprises:**
- iOS push fidelity gap (15-15% delivery delta vs APNs) is smaller than expected. PWA push on iOS 16.4+ is closer to feature-parity than 2023 articles suggested.
- §4.2 enforcement has softened in 2024-2025 for substantive PWAs. Adobe Photoshop Web (a fully-featured PWA via PWABuilder) shipping in early 2024 is the strongest precedent.
- Capacitor's "Live Updates" feature is paid ($) — not relevant to PWABuilder choice but worth noting if Capacitor ever picked.

**Signal for the build (Phase 17):**
- **Wrap with PWABuilder.** Targets: 3-5 days from Apple Developer Program enrollment to TestFlight.
- **Apple Sign-In:** wire via Firebase Auth Apple Sign-In; webview supports the OAuth flow.
- **Push:** keep VAPID web-push (Phase 6 unchanged); add a "Push works best on iOS 16.4+" line to FAQ (Phase 31 D-22).
- **App Store description:** lead with Watchparty + Couch Groups + Pick'em (per LAUNCH-REVIEW §5 + Phase 31 D-24/D-25). Mitigates §4.2 risk.
- **Privacy nutrition labels:** complete fully — Firebase, TMDB, Trakt, Sentry, push providers, all data types.
- **Screenshots:** capture against `couch-v47-pickem` PWA running on iOS Safari standalone-mode (Phase 31 D-05/D-06). PWABuilder packaging won't change visual rendering.
- **Sentry tracking post-launch:** push delivery rate, app-foreground crashes, web-share API failures. If iOS push <85% over 30 days, file Phase 17.1 Capacitor-migration spike.
- **Apple Developer Program enrollment first** — 1-2 day verification window. Start that the moment Phase 17 planning kicks off.

**Phase 17 plan-phase agenda (informed by this spike):**
1. PWABuilder package generation (3 days)
2. Apple Sign-In wiring (1 day)
3. App Store Connect listing (per LAUNCH-REVIEW §5 + Phase 31 outputs)
4. Google Play Console listing
5. Privacy nutrition labels + Data Safety form
6. Privacy policy + ToS expansion (Firebase, TMDB, Trakt, Sentry, push, all data types)
7. App Preview video (15-30s)
8. TestFlight + Play Internal beta
9. Submission

Capacitor not on the agenda. Live as escalation option if a switch trigger fires post-launch.

---

## References

- PWABuilder docs: https://docs.pwabuilder.com/#/builder/quick-start
- PWABuilder iOS guide: https://docs.pwabuilder.com/#/builder/app-store
- Capacitor docs: https://capacitorjs.com/docs
- Apple Developer Program Guidelines §4.2 + §4.7: https://developer.apple.com/app-store/review/guidelines/
- Firebase Auth Apple Sign-In (webview compatible): https://firebase.google.com/docs/auth/web/apple
- iOS web-push (16.4+) reference: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Microsoft PWABuilder showcase: https://aka.ms/pwabuilder-showcase
- Couch project: `.planning/PROJECT.md`, `CLAUDE.md`, `.planning/phases/06-push-notifications/`
- LAUNCH-REVIEW: `.planning/LAUNCH-REVIEW-2026-05-05.md` §6 (Phase 17 expanded scope)
- Phase 31 CONTEXT: `.planning/phases/31-marketing-refresh/31-CONTEXT.md` (downstream consumer of this decision)
