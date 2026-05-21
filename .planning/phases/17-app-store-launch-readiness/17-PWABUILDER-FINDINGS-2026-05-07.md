---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous PWABuilder dry-run + privacy/terms authoring session)
status: supplement (does not replace 17-CONTEXT.md; augments with concrete dry-run findings)
related: 17-CONTEXT.md, PRIVACY-TERMS-AUDIT-2026-05-06.md, APP-STORE-ASSETS-AUDIT-2026-05-06.md, spikes/001-capacitor-vs-pwabuilder/README.md
---

# Phase 17 — PWABuilder dry-run findings + privacy/terms launch

A pre-Phase-17-execute autonomous session ran PWABuilder against `https://couchtonight.app/app`, generated iOS + Android packages, inspected them, and authored the privacy/terms surfaces. Captures everything found so a future planner doesn't re-discover.

## Production bugs caught + fixed (4)

These would have hit App Review or Play Console regardless of when Phase 17 fired.

| # | Bug | Symptom | Fix | Commit |
|---|-----|---------|-----|--------|
| 1 | Inline `data:application/manifest+json;...` URL in `app.html:47` | PWABuilder + most third-party tools timeout on data: URL manifests; iOS Safari A2HS may degrade | Extract to `/manifest.json` real file | `38bd385` |
| 2 | CSP `manifest-src 'self'` directive blocks data: URL manifest | Currently Report-Only; would have killed manifest loading on enforce-flip per Phase 13 OPS plan | Same fix — `/manifest.json` is same-origin | `38bd385` |
| 3 | `scripts/deploy.sh` mirror loop missing `manifest.json` | Deployed manifest 404'd in production | Add to file allowlist | `8b2341b` |
| 4 | `scripts/deploy.sh` mirror loop missing all root-level PNG icons | Phase 15.3-regenerated icons (mark-maskable-*, mark-adaptive-*, mark-1024) silently 404'ing for ~6 days | Add `cp -v *.png` glob mirror | `33924c6` |

Plus auto-bump to `couch-v48-manifest-extract` (`6e32718`) and the gitignore for PWABuilder spike artifacts (`fc60321`).

## Files added / changed for launch prep

| File | Status | Purpose |
|------|--------|---------|
| `manifest.json` | NEW | Externalized PWA manifest with `id`, `categories`, maskable + adaptive icons |
| `landing.html` | EDIT | `<link rel="manifest">` added so iOS A2HS works from the marketing page |
| `privacy.html` | NEW | Full privacy policy enumerating Firebase / TMDB / Trakt / Sentry / push providers + Apple/Google sign-in. Restraint voice. Awaiting legal review pre-launch. |
| `terms.html` | NEW | Full ToS with Apple App Store + Google Play boilerplate clauses, DMCA, governing law (NY). Awaiting legal review pre-launch. |
| `.well-known/assetlinks.json` | NEW | Digital Asset Links for Android TWA verification (uses local-keystore SHA256; **regen needed post-Play-App-Signing**) |
| `rsvp.html` | EDIT | `/privacy` → `/privacy.html` (canonical path; pre-existing 404) |
| `scripts/deploy.sh` | EDIT | Mirror loop now covers privacy/terms HTML + .well-known/ + all root *.png |
| `.gitignore` | EDIT | Block PWABuilder spike inspections from committing keystore + GoogleService-Info |

All committed to `hotfix/phase-30-cross-cutting-wave`. Live at `couchtonight.app`.

## PWABuilder report card — final state

URL: https://www.pwabuilder.com/reportcard?site=https://couchtonight.app/app

| Severity | Count | Items |
|----------|-------|-------|
| 🔴 Red (blockers) | 0 | — |
| 🟡 Yellow (warnings) | 2 | Service worker false-positive (`sw.js` exists); screenshots missing (Phase 31 produces) |
| 🔵 Blue (info) | 7 | `prefer_related_applications`, native app IDs, IARC rating, etc. — post-launch refinements |
| ⚡ Lightning (good) | 10 | Manifest valid, icons valid, HTTPS, scope correct, etc. |

`Package For Stores` button is unblocked and produces real packages.

## iOS package — what PWABuilder generated

Wrapper: **PWAShell** (Microsoft, open-source Swift WKWebView). Real Xcode workspace using CocoaPods.

### Bundle settings (Info.plist + Entitlements)

| Setting | Generated | Notes for Xcode-time fixup |
|---------|-----------|---------------------------|
| `CFBundleDisplayName` | "Couch Tonight" | ✓ correct |
| `CFBundleIdentifier` | `app.couchtonight` (from PWABuilder field) | Bundle ID is **near-permanent** post-publish. Lock convention before TestFlight: `app.couchtonight` works; `app.couchtonight.couch` is more conventional. |
| `LSApplicationCategoryType` | `public.app-category.productivity` | **Should be** `public.app-category.entertainment` |
| `NSAllowsArbitraryLoads` | `true` (ATS disabled) | **Remove** — couchtonight.app is HTTPS-only, ATS should be on. App Review may flag. |
| `NSCameraUsageDescription` | "Capture Video by user request" | **App Review will reject.** Replace with specific reason or delete the key if camera unused. |
| `NSMicrophoneUsageDescription` | "Capture Audio by user request" | Same — replace or delete |
| `NSLocationWhenInUseUsageDescription` | "Track current location by user request" | Same — replace or delete |
| `WKAppBoundDomains` | `couchtonight.app/app` | ✓ good — locks the WebView origin |
| `aps-environment` (entitlement) | `production` | ✓ push-ready |
| `applinks:couchtonight.app` (entitlement) | present | ✓ Universal Links ready (will need apple-app-site-association file at `/.well-known/apple-app-site-association` to actually work — TODO) |
| `webcredentials:couchtonight.app` (entitlement) | present | ✓ Password AutoFill ready |
| `ITSAppUsesNonExemptEncryption` | `false` | ✓ correct (Couch uses no proprietary encryption) |
| `BGTaskSchedulerPermittedIdentifiers` | `$(PRODUCT_BUNDLE_IDENTIFIER)` | Validate background task usage matches Couch's actual needs |
| `UIBackgroundModes` | `["processing", "remote-notification"]` | App Review may ask why background processing is needed — be ready to justify or remove |

### CRITICAL: GoogleService-Info.plist is a stub

The bundled `GoogleService-Info.plist` is a placeholder with all-zeros values + `BUNDLE_ID: com.microsoft.pwabuilder-ios`. **Must be replaced** before TestFlight build with a real `GoogleService-Info.plist` downloaded from Firebase Console:

1. https://console.firebase.google.com/project/queuenight-84044/settings/general
2. Under "Your apps" → Add app → iOS
3. Bundle ID: match what you set in Xcode (`app.couchtonight` or your final lock)
4. Download `GoogleService-Info.plist`, drop into Xcode project at `Couch Tonight/GoogleService-Info.plist`

Without this, Firebase Auth + Cloud Messaging won't work on the iOS native app.

### Apple-Sign-In TODO (Phase 17 D-02)

The bundled package does NOT wire Apple Sign-In. Follow CONTEXT D-02:
- Add `OAuthProvider('apple.com')` to `js/firebase.js`
- Surface in `app.html` signin section above Google Sign-In (per Apple HIG)
- ~1 day work per spike 001 estimate

## Android package — what PWABuilder generated

Wrapper: **Bubblewrap** (Google official TWA generator). Outputs:
- `Couch Tonight.aab` — App Bundle for Play Store upload
- `Couch Tonight.apk` — signed APK for sideload testing
- `signing.keystore` + `signing-key-info.txt` — local Java keystore + cleartext password
- `assetlinks.json` — Digital Asset Links file
- `Readme.html` — redirects to docs.pwabuilder.com

### Package settings

| Setting | Generated | Notes |
|---------|-----------|-------|
| Package ID | `app.couchtonight.twa` | Conventional `.twa` suffix marks Trusted Web Activity |
| App name | "Couch Tonight" | App drawer + Play Store listing |
| Short name | "Couch" | Launcher label |
| Source URL | `https://couchtonight.app/app` | TWA target |

### CRITICAL: keystore safekeeping

`signing-key-info.txt` and `signing.keystore` together are the **only thing** Google Play uses to verify update packages for `app.couchtonight.twa`. If lost:
- Cannot ship updates to existing installs
- Reset path requires Google's Play App Signing reset flow + 60-day waiting period

**Recommended:** upload both files to 1Password or your password manager. Treat the keystore password (`NNRjkUsX6p6k`) as the most sensitive credential associated with the project.

**Alternative:** when you upload the .aab to Play Console for the first time, **enable Google Play App Signing**. Google then generates and holds the production signing key; the local PWABuilder keystore becomes only the upload key (still important to keep, but losing it triggers a different recovery flow that's faster).

### Digital Asset Links (assetlinks.json)

For the TWA to render WITHOUT the Chrome address bar showing at the top of the app, Google Chrome verifies that `https://couchtonight.app/.well-known/assetlinks.json` lists the SHA256 fingerprint of the Android app's signing cert.

Tonight, the local-keystore fingerprint is deployed at `https://couchtonight.app/.well-known/assetlinks.json`. **This will need to be replaced** with Google Play App Signing's fingerprint after the first Play Console upload (Play Console → Setup → App signing → Show certificate → SHA-256 cert fingerprint). Until that swap, the .apk built from the local keystore would verify, but a Play-distributed .aab would NOT (the address bar would show).

## Phase 17 plan implications

### Wave 0 unchanged
- 17-01: Apple Developer Program enrollment ($99/yr, 1-2 day verification)
- 17-02: privacy.html + terms.html ✅ **AUTHORED 2026-05-07** — pre-launch legal review still recommended
- (Now-discoverable bugs: extract manifest, fix deploy.sh — ✅ shipped tonight)

### Wave 1 cleanup vs PWABuilder defaults
Concrete Xcode-time tasks (move from "open Xcode and figure out" to a checklist):

1. Replace `GoogleService-Info.plist` with real Firebase iOS app config
2. Set `CFBundleIdentifier` to final locked value (was `app.couchtonight` in dry-run)
3. Change `LSApplicationCategoryType` → `public.app-category.entertainment`
4. Remove `NSAllowsArbitraryLoads: true`
5. Replace generic permission descriptions OR remove unused permission keys (camera/mic/location)
6. Validate `UIBackgroundModes` matches actual needs
7. Wire Apple Sign-In capability in Xcode (Signing & Capabilities → +Capability → Sign in with Apple)
8. Configure code-signing (Xcode automatic signing per CONTEXT D-19)
9. Add `apple-app-site-association` file at `/.well-known/apple-app-site-association` for Universal Links to actually function

### Wave 1 cleanup for Android
1. Open `.aab` to validate package contents in `bundletool` or Android Studio
2. Test the `.apk` on a real Android device (sideload) to confirm TWA renders without address bar (locally-keystore-verified)
3. After first Play Console upload, regen `/.well-known/assetlinks.json` with Play App Signing's fingerprint, redeploy
4. Back up `signing.keystore` + password to 1Password BEFORE Play Console upload

### New CONTEXT decisions to fold in

- **D-28:** PWA manifest extracted from inline data: URL to `/manifest.json` real file (2026-05-07). Live in production. CSP-compatible. PWABuilder validation: 0 blockers.
- **D-29:** Bundle ID convention — final lock TBD at Wave 1 planning. PWABuilder dry-run used `app.couchtonight`. Conventional alternatives: `app.couchtonight.couch` or `app.couchtonight.ios`. Decision is near-permanent post-publish.
- **D-30:** Android signing key — PWABuilder local keystore is dry-run only. Production uses Google Play App Signing (Google holds the key). assetlinks.json must be regen'd post-first-upload with Play's SHA256.
- **D-31:** iOS Info.plist + Entitlements need Xcode-time fixups per checklist above. PWABuilder defaults are loose; App Review will flag at least the generic permission descriptions and may flag ATS-disabled.
- **D-32:** privacy.html + terms.html drafted using restraint voice + factual to actual data flows. Legal review recommended before submission. Apple/Google boilerplate clauses included. Contact email `support@couchtonight.app` (DNS forwarding TBD).

## Outstanding TODOs from this session (not handled tonight)

- **Email forwarding for `support@couchtonight.app` + `security@couchtonight.app` + `dmca@couchtonight.app`** — DNS MX records or Cloudflare email routing. Privacy/terms reference these.
- **Firebase Hosting `cleanUrls: true`** — would let `/privacy` and `/terms` (no extension) resolve to the .html files. Currently 404s. Lives in deploy-mirror `firebase.json`. Not blocking but cleaner for sharing.
- **OG metadata for privacy.html + terms.html** — already present in the `<head>`, but the `og:image` points to `/og.png` (the marketing one). Could author dedicated images later.
- **Apple App Site Association file** at `/.well-known/apple-app-site-association` — needed for Universal Links to actually work. Format: JSON with appID + paths. Phase 17 Wave 1 task.
- **`apple-touch-startup-image`** for the iOS Safari A2HS launch screen — not strictly needed but nicer UX.
- **Legal review of privacy/terms drafts** — recommended before App Store submission.

## Local artifacts

- Inspected packages live at `~/Downloads/Couch Tonight.zip` + `~/Downloads/Couch - Google Play package.zip`
- Unzipped at `.planning/spikes/002-pwabuilder-package-inspect/` (gitignored — contains keystore + cleartext password)

---

*Authored autonomously 2026-05-07 during launch-prep continuation work after `/gsd-progress` chain. All commits on `hotfix/phase-30-cross-cutting-wave`. PWABuilder report card revalidated post-fixes: 0 red blockers, Package For Stores active.*
