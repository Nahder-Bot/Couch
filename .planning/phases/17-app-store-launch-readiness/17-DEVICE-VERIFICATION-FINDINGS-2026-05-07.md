---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous, during Apple Developer pending verification + Google Play device-verification block)
purpose: Capture the unexpected platform-level enrollment gates encountered during launch prep so future projects don't re-discover them
status: information / decision-pending
---

# Phase 17 — Platform device-verification findings

Found mid-flight on 2026-05-07: BOTH Apple and Google now require physical-device steps during developer enrollment that aren't disclosed in the public enrollment docs until you hit them.

## Apple side

**What we found:** Subscription Confirmed email arrived immediately on payment ($98.99 × Apple Developer Program), but Apple Developer iOS app + App Store Connect both showed enrollment as **pending** until Apple completes identity verification (1-2 business days typical, sometimes minutes, sometimes longer).

The pending state isn't blocking — payment IS confirmed, identity check IS in flight. But if you assumed payment = enrollment, you'd be confused for a day.

**Status as of authoring:** awaiting Apple confirmation. User has yet to verify status at appstoreconnect.apple.com.

## Google side

**What we found:** Google Play Console has a hard verification gate added in 2023 that requires a real Android mobile device + the Google Play Console mobile app. NOT satisfied by:
- Firebase Test Lab cloud devices (Google's own data-center devices) ❌
- Android Studio emulator ⚠ (Play Protect detects → may pass or may fail; ~50/50)
- Cloud device farms (BrowserStack, AWS Device Farm, etc.) ❌
- Amazon Fire tablets (Fire OS = Android fork without Google Play Services by default; sideload exists but ~60-70% pass rate, may take 30 min) ⚠

**Tested and failed:** Bark Phone (Samsung Galaxy A-series with Bark parental monitoring). Bark uses Android's Device Owner API to lock Google account additions at the OS level. Even with parent-side approval through the Bark dashboard, you cannot add a second Google account to the device. Couldn't run the verification flow.

**Untested but viable:**
- Borrow any unmanaged Android phone from a family member or friend (5 min, ~99% success)
- Old Android phone in a drawer (no SIM needed, just WiFi)
- Buy a cheap used Android (Pixel 7a $120-160 used; Walmart Onn 8" tablet $60-80 new)
- Samsung Guest Mode on the Bark Phone (creates an isolated user profile that bypasses Bark's Device Owner policies — Samsung removed this from some newer A-series models, so YMMV)

## Why this matters for Phase 17 plan-time

The Phase 17 CONTEXT D-07 originally noted Apple Developer enrollment as a Wave 0 task with "1-2 day verification window." It did NOT note:
- The same applies to Google
- BOTH require physical-device gates that block desktop-only paths
- Plan-Wave-0 should explicitly include "secure access to a real Android device" as a precondition, not assume it

## Implications for sequencing

If Android device access is delayed, Phase 17 has two valid paths:

**Path A — iOS-only first launch (sequential):**
1. Apple verification completes
2. iOS Wave 1-3 ships first
3. Public TestFlight → App Store
4. Android device access secured later (any time)
5. Google Play Console verified
6. Android Wave 1-3 ships as a follow-up release ~1-2 weeks behind iOS

**Path B — Both platforms simultaneously (the original CONTEXT plan):**
- Requires Android device access by the time TestFlight ships, which is ~1-2 weeks out
- Plenty of runway to secure a device

**Recommendation:** Don't let Android device-search block Apple-side execution. Apple flow can proceed in parallel without Android access at all.

## What was pre-staged tonight while resolving the device-search

Created `.planning/phases/17-app-store-launch-readiness/17-PLAY-CONSOLE-PREP.md` with:
- Listing copy (title 13 char, short desc 72 char, full desc ~3100 char) — ready to paste
- Full Data Safety form answers covering all 14 data-type categories
- Content Rating questionnaire pre-filled answers (expected outcome: Everyone / PEGI 3)
- App Access setup notes for Play Reviewer demo account
- Post-upload TODO (assetlinks.json regen with Play App Signing fingerprint, keystore backup)

Created `.planning/phases/17-app-store-launch-readiness/PrivacyInfo.xcprivacy` — Apple's required machine-readable privacy declaration (since iOS 17 / 2024-Q1). Drop into Xcode project at `Couch Tonight/PrivacyInfo.xcprivacy`. Drafted from PWAShell Swift source inspection (FileManager + URLSession + UIApplication) + privacy.html data flows.

## D-decisions to fold into 17-CONTEXT at next /gsd-discuss-phase 17

- **D-33:** Google Play device verification — Bark Phone blocked due to Device Owner API. Alternative paths documented; final method TBD when device secured.
- **D-34:** iOS Privacy Manifest authored from PWAShell wrapper API usage. Reasons declared: NSPrivacyAccessedAPICategoryFileTimestamp (C617.1 — within own app) + NSPrivacyAccessedAPICategoryUserDefaults (CA92.1 — own app/group only). Updates needed if WebView wrapper changes file/UserDefaults usage.
- **D-35:** Apple post-payment activation typically 1-2 business days. Don't assume payment = active. Check appstoreconnect.apple.com for source-of-truth status.

---

*Authored autonomously 2026-05-07. Reflects findings through tonight's session. Update at next physical-device acquisition or as Apple verification progresses.*
