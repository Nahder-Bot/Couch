---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous consolidation of all Phase 17 prep docs)
purpose: Single navigable ledger of every checkpoint, ordered, with owner + status, so launch day isn't a scavenger hunt
related: 17-CONTEXT.md, 17-PWABUILDER-FINDINGS-2026-05-07.md, 17-PLAY-CONSOLE-PREP.md, 17-APP-STORE-CONNECT-PREP.md, 17-DEVICE-VERIFICATION-FINDINGS-2026-05-07.md
---

# Phase 17 — Launch checklist

Combines every TODO scattered across the supplemental docs into one ordered list. Status updated 2026-05-07.

**Legend:**
- ✅ Done
- 🟡 In progress / partial
- ⬜ Not started
- 🔒 Blocked on external (Apple/Google/legal/other person)
- 👤 You
- 🤖 Claude (can do autonomously)

---

## Wave 0 — Foundation (in progress)

### Apple side

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 1 | Apple Developer Program payment | ✅ | 👤 | $98.99 charged 2026-05-06 |
| 2 | Apple identity verification | ✅ | 👤+Apple | Active per `17-APPLE-CONFIRMED-2026-05-07.md`; activation took <24h |
| 3 | Apple ID name matches government photo ID | ✅ | 👤 | Implicit — verification cleared |
| 4 | App Store Connect dashboard accessible | ✅ | Apple | Loaded 2026-05-07; Team ID `49R296FJGF` |

### Google side

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 5 | Google Play Console enrollment payment | 🟡 | 👤 | $25 one-time. Account name "Couch App" exists. |
| 6 | Google Play device verification (real Android phone, not Bark Phone — see 17-DEVICE-VERIFICATION-FINDINGS-2026-05-07.md) | ⬜🔒 | 👤 | Bark Phone Device Owner blocks 2nd account. Need unmanaged Android. |
| 7 | DUNS Number (only if going Organization route — Personal doesn't need this) | n/a | 👤 | Skip if Individual; Phase 17 D-08 plan |

### Production code (already shipped tonight)

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 8 | Externalize PWA manifest (data: → /manifest.json) | ✅ | 🤖 | Commit `38bd385`; CSP-compatible |
| 9 | Mirror manifest.json + .well-known/ + *.png in deploy.sh | ✅ | 🤖 | Commits `8b2341b` + `33924c6` + `797d29f` |
| 10 | Bump sw.js cache to couch-v48-manifest-extract | ✅ | 🤖 | Commit `6e32718` |
| 11 | Manifest reference on landing.html (iOS A2HS works from marketing page) | ✅ | 🤖 | Commit `797d29f` |
| 12 | Manifest `id` field + categories | ✅ | 🤖 | PWABuilder validation 0 red |

### Authoring (already shipped tonight)

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 13 | privacy.html — full draft, restraint voice | ✅ | 🤖 | Commit `797d29f`. Live at /privacy.html. |
| 14 | terms.html — Apple/Google clauses, DMCA, NY governing law | ✅ | 🤖 | Commit `797d29f`. Live at /terms.html. |
| 15 | support.html — FAQ + contact + status | ✅ | 🤖 | Commit `67dd764`. Live at /support.html. |
| 16 | .well-known/assetlinks.json (TWA Digital Asset Links) | ✅ | 🤖 | Commit `797d29f`. Local-keystore SHA256 — regen post-Play-App-Signing. |
| 17 | Pre-staged Play Console submission pack | ✅ | 🤖 | `17-PLAY-CONSOLE-PREP.md` |
| 18 | Pre-staged App Store Connect submission pack | ✅ | 🤖 | `17-APP-STORE-CONNECT-PREP.md` |
| 19 | PrivacyInfo.xcprivacy (Apple required since iOS 17) | ✅ | 🤖 | `.planning/phases/17-app-store-launch-readiness/PrivacyInfo.xcprivacy` |
| 20 | apple-app-site-association template (Universal Links) | ✅ | 🤖 | Template — needs Team ID + Bundle ID at Wave 1 |

---

## Wave 0.5 — Pre-Wave-1 ops (your turn, can do anytime)

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 21 | Backup Android signing.keystore + password to 1Password | ⬜ | 👤 | **CRITICAL.** From `~/Downloads/Couch - Google Play package.zip`. Lose this = lose Play Store update continuity. |
| 22 | DNS forwarding for support@/security@/dmca@/**review-apple@**couchtonight.app | ✅ | 👤+🤖 | Done 2026-05-08 via Namecheap email forwarding (NS = `dns{1,2}.registrar-servers.com`, MX = `eforward{1-5}.registrar-servers.com`). 4 forwards added in Namecheap UI; test email landed in nahderz@gmail.com within 5 sec. |
| 23 | Legal review of privacy.html + terms.html (recommended) | ⬜ | 👤 | Drafts are professional but launch-grade legal eyes are wise |
| 24 | Lock final Bundle ID at /gsd-discuss-phase 17 | ✅ | 👤+🤖 | Locked at `app.couchtonight.couch` per `17-APPLE-CONFIRMED-2026-05-07.md`. Permanent post-publish. |
| 25 | Find a real unmanaged Android device for verification | ⬜🔒 | 👤 | Borrow / Samsung Guest Mode / used Pixel — see 17-DEVICE-VERIFICATION-FINDINGS-2026-05-07.md |

---

## Wave 1 — Native build setup (after Apple + Google verifications complete)

### iOS — open `Couch Tonight.zip` in Xcode (macOS required)

Per `17-PWABUILDER-FINDINGS-2026-05-07.md` Wave 1 cleanup checklist:

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 26 | Replace stub `GoogleService-Info.plist` with real Firebase iOS config | 🟡 | 👤+🤖 | Done autonomously 2026-05-11: Firebase iOS app registered (App ID `1:928451125383:ios:4ce434c2037bb93a1c1822`, bundle `app.couchtonight.couch`); real plist downloaded to `.planning/phases/17-app-store-launch-readiness/GoogleService-Info.plist`. **User step**: drag into Xcode at `Couch Tonight/GoogleService-Info.plist` per `17-XCODE-PATCHES-2026-05-11.md` §6. |
| 27 | Set `CFBundleIdentifier` to final locked value | ⬜ | 👤 | After #24 lock |
| 28 | Change `LSApplicationCategoryType` → `public.app-category.entertainment` | ⬜ | 👤 | Was `public.app-category.productivity` — wrong category |
| 29 | Remove `NSAllowsArbitraryLoads: true` (ATS disabled) | ⬜ | 👤 | App Review may flag; couchtonight.app is HTTPS-only anyway |
| 30 | Replace generic permission strings (NSCameraUsageDescription etc.) — Apple WILL reject "Capture Video by user request" | ⬜ | 👤 | Either replace with specific reason or delete the keys if feature unused |
| 31 | Validate `UIBackgroundModes` matches actual needs | ⬜ | 👤 | Currently `processing` + `remote-notification`; remove `processing` if not used |
| 32 | Wire Apple Sign-In capability (Signing & Capabilities → +Capability → Sign in with Apple) | ⬜ | 👤 | Phase 17 D-02. Required by §4.8. ~1 day. |
| 33 | Configure code-signing — Xcode automatic signing per CONTEXT D-19 | ⬜ | 👤 | Pulls cert from your Apple Developer account |
| 34 | Add `PrivacyInfo.xcprivacy` to Xcode project at `Couch Tonight/PrivacyInfo.xcprivacy` | ⬜ | 👤 | Already drafted; right-click "Couch Tonight" group → Add Files |
| 35 | Author `apple-app-site-association` from template, deploy to `.well-known/` | ✅ | 🤖 | Authored 2026-05-07 + deployed; Content-Type fixed to `application/json` via `firebase.json` headers rule (this session). Curl-verified at https://couchtonight.app/.well-known/apple-app-site-association. |
| 36 | Wire Apple Sign-In in `js/firebase.js` — `OAuthProvider('apple.com')` + signin button above Google per Apple HIG | ✅ source-side | 🤖 | Done 2026-05-11 commit `46c7013`. `signInWithApple` was already in js/auth.js; this commit added: `<button id=signin-apple>` (above Google per HIG) in app.html with inline Apple-logo SVG, `handleSigninApple` in js/app.js mirroring Google handler with sanitized error toast, `.provider-apple` in css/app.css (black bg per HIG). **Still pending #32**: Xcode-side capability flip (Signing & Capabilities → +Capability → Sign in with Apple) before TestFlight upload — source wiring is inert until that lands. |

### Android — open Google Play Console after device verification (#6) complete

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 37 | Create app in Play Console — name "Couch Tonight", default lang en-US, free, app (not game) | ⬜ | 👤 | `17-PLAY-CONSOLE-PREP.md` §1 |
| 38 | Enable Google Play App Signing | ⬜ | 👤 | Recommended path. Google holds production key; PWABuilder keystore becomes upload-only. |
| 39 | Upload `Couch Tonight.aab` to Internal Testing track | ⬜ | 👤 | From `~/Downloads/Couch - Google Play package.zip` |
| 40 | Regenerate `.well-known/assetlinks.json` with Play App Signing's SHA256 | ⬜ | 👤+🤖 | Play Console → Setup → App Signing → SHA-256. Edit `couch/.well-known/assetlinks.json`, deploy. |
| 41 | Fill Store Listing — paste from `17-PLAY-CONSOLE-PREP.md` §2 | ⬜ | 👤 | Most fields are direct paste-targets |
| 42 | Fill Data Safety form — paste from `17-PLAY-CONSOLE-PREP.md` §3 | ⬜ | 👤 | All 14 categories pre-answered |
| 43 | Complete Content Rating questionnaire — answers in `17-PLAY-CONSOLE-PREP.md` §4 | ⬜ | 👤 | Expected: Everyone (E) / PEGI 3 |
| 44 | Set up Reviewer demo account (`play-review@couchtonight.app`) | ⬜ | 👤 | Pre-populate via Couch sign-in flow on production |
| 45 | Configure Pricing & Distribution — Free, all countries, no ads, no IAP | ⬜ | 👤 | `17-PLAY-CONSOLE-PREP.md` §6 |

---

## Wave 2 — Asset packaging (depends on Wave 1 + Phase 31)

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 46 | Phase 31 (Marketing refresh) ships 5 PWA screenshots | ⬜ | 👤+🤖 | Phase 31 plans 01-05 already drafted; awaiting execute go-ahead |
| 47 | Phase 31 ships refreshed og.png (feature graphic source) | ⬜ | 👤+🤖 | Phase 31 Plan 03 |
| 48 | Phase 31 ships refreshed landing copy | ⬜ | 👤+🤖 | Phase 31 Plan 01 |
| 49 | Generate Apple icon matrix (full size set from `mark-1024.png` via sharp) | ✅ | 🤖 | Phase 15.3 already shipped — `regenerate-icons.cjs` |
| 50 | Generate Android adaptive icons (432×432 fg + bg) | ✅ | 🤖 | Phase 15.3 already shipped |
| 51 | Capture App Store screenshots — multi-device dimensions via sharp pipeline | ⬜ | 🤖 | Phase 17 D-06: capture at 1320×2868 once, downscale to 1290×2796 + 1242×2688 + 1242×2208 |
| 52 | App Preview video (15-30s walkthrough, vertical) | ⬜ | 👤 | CONTEXT specifics §"Visual reference for App Preview video" |

---

## Wave 3 — Submission

### iOS

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 53 | Create App record in App Store Connect | ✅ | 👤 | Apple App ID `6767413821`; SKU `COUCH-TONIGHT-IOS-001` (autonomous fill 2026-05-07) |
| 54 | Reserve "Couch Tonight" name | ✅ | 👤 | Reserved 2026-05-07 |
| 55 | Agree to Paid Apps Agreement (gates ALL submissions, even free) | ✅ | 👤 | Paid Apps + W-9 + banking (Wilmington Savings Fund Society FSB 7786) all Active 2026-05-07 |
| 56 | Fill App Information — paste from `17-APP-STORE-CONNECT-PREP.md` §1 | ✅ | 👤+🤖 | Autonomous fill 2026-05-07: Name, Subtitle, Bundle ID, SKU, Categories (Entertainment + Lifestyle), Content Rights, Age Rating 4+ for 173 countries |
| 57 | Fill App Store Listing — paste from §3 | ✅ | 👤+🤖 | Autonomous fill 2026-05-07: Promo Text, Description (~2,820 chars), Keywords, Support URL, Marketing URL, Copyright, Privacy Policy URL, Pricing (Free, 175 countries) |
| 58 | Fill App Privacy Nutrition Labels — answers in §4 | ✅ | 👤 | Published 2026-05-08; 11 data types declared, all linked/not-linked + tracking=No verified this session. Minor under-claim: Name/Email/Phone/User ID list only `App Functionality` not also `Account Management`; conservative, not a blocker. |
| 59 | Set up Reviewer demo account (`review-apple@couchtonight.app`) | ✅ (no prepop needed) | 👤 | Email forwarding done (#22). Pivoted away from pre-populating a demo family — Notes-for-Reviewer §5 now self-contained, reviewer creates own family during onboarding. Two earlier attempts (REVIEWAPPLE collision + CCHDEMO2026 join silent-fail) led to this pivot. (Optional follow-up: pre-populate later with a unique code; see §5 "Optional follow-up".) |
| 60 | Paste Notes for Reviewer | ⬜ | 👤 | `17-APP-STORE-CONNECT-PREP.md` §5 (rewritten 2026-05-08 for passwordless email-link + reviewer-creates-own-family flow) includes §4.2 mitigation + Pick'em §5.3.4 analysis + 5-min walkthrough + 2-min first-run setup guide |
| 61 | Xcode → Archive → Validate → Upload to TestFlight | ⬜ | 👤 | First TestFlight build from Xcode after Wave 1 cleanup |
| 62 | TestFlight beta — 5-7 day minimum | ⬜ | 👤 | Per CONTEXT D-20 |
| 63 | Submit for App Review | ⬜ | 👤 | Phased Release enabled per CONTEXT D-24 |
| 64 | App Review approval (typically 1-3 days median) | ⬜🔒 | Apple | |

### Android

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 65 | Run Pre-launch Report (auto on Internal Testing upload) | ⬜ | Google | Free; ~30 min auto-test |
| 66 | Run Firebase Test Lab Robo test on the .apk | ⬜ | 👤+🤖 | Free tier; uses queuenight-84044 Firebase project |
| 67 | Real-device install + UAT (TWA renders without browser chrome, push works) | ⬜ | 👤 | Once Android device sorted |
| 68 | Promote to Closed Testing — invite 5-10 testers | ⬜ | 👤 | 1-7 day Google review |
| 69 | Promote to Open Testing (optional intermediate) | ⬜ | 👤 | |
| 70 | Promote to Production with Staged Rollout 1% → 100% over 7 days | ⬜ | 👤 | Per CONTEXT D-24 |
| 71 | Google Play Review approval (typically 1-7 days median) | ⬜🔒 | Google | |

---

## Wave 4 — Post-launch monitoring (Phase 17 D-27)

| # | Task | Status | Owner | Notes |
|---|---|---|---|---|
| 72 | Monitor Sentry for first 24h post-rollout (iOS-specific crashes) | ⬜ | 👤 | https://sentry.io |
| 73 | Track iOS push delivery rate (target ≥85%) | ⬜ | 👤 | 30-day switch-trigger evaluation per spike 001 |
| 74 | Track Apple Sign-In success rate (target ≥95%) | ⬜ | 👤 | |
| 75 | Track app-foreground crash rate (target <0.1% sessions) | ⬜ | 👤 | |
| 76 | Track §4.2-related App Review interactions | ⬜ | 👤 | App Store Connect notification logs |

---

## Standing pitfalls

Things to remember throughout the launch:

1. **Bundle ID is permanent post-publish.** Lock it carefully at Wave 1 (#24).
2. **Apple ID name = government photo ID name.** Mismatch = 5-10 day enrollment delay.
3. **Don't tap "Enroll Now" twice.** Duplicate $99 charges + verification confusion.
4. **Android signing keystore is irreplaceable** without Play App Signing reset flow. Backup BEFORE first upload (#21).
5. **PWABuilder iOS package has loose Info.plist defaults.** Address all of #28-31 before TestFlight upload or Apple WILL flag.
6. **§4.2 ("Minimum Functionality") is the single biggest reject risk for PWA wrappers.** Mitigation is in `17-APP-STORE-CONNECT-PREP.md` §5 Notes for Reviewer — make sure you ship that exact reviewer-notes paragraph.
7. **assetlinks.json regen after Play App Signing assignment** (#40) is what makes the Android TWA render WITHOUT the Chrome address bar. Until then, the address bar shows.

---

## "What can I do RIGHT NOW" (today, while waiting on verifications)

| Task | Time |
|---|---|
| #21 — Back up Android keystore to 1Password | 5 min |
| #22 — Cloudflare email routing for support@/security@/dmca@couchtonight.app | 30 min |
| #6 — Find an unmanaged Android phone (text family/friends) | varies |
| Inspect `~/Downloads/Couch Tonight.zip` (extract, browse Xcode project structure even without macOS) | 10 min |
| Read `17-PWABUILDER-FINDINGS-2026-05-07.md` Wave 1 cleanup checklist | 5 min |

---

## Tonight's autonomous work delta

Before tonight's session: Phase 17 was a 17-CONTEXT.md scoped phase awaiting `/gsd-discuss-phase 17`.

After tonight's session:
- **11 commits** on `hotfix/phase-30-cross-cutting-wave`
- **4 production bugs** caught + fixed via PWABuilder dry-run
- **3 production deploys** (manifest.json + privacy/terms/assetlinks + support.html)
- **7 Phase 17 supplemental docs** (~1,700 lines pre-staged answers, manifests, checklists)
- **2 PWABuilder packages** downloaded + inspected (iOS Xcode project + Android signed .aab/.apk)
- **8 new D-decisions** (D-28..D-35) queued for next `/gsd-discuss-phase 17`

The form-filling stage of submission should now take minutes per platform instead of hours, once verifications activate.

---

*Authored 2026-05-07. Update as Wave 1+ completes.*
