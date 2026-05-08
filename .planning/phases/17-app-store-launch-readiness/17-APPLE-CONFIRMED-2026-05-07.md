---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous Chrome-driven Apple Developer + App Store Connect setup)
purpose: Capture all locked Apple-side values from tonight's setup so future Phase 17 work has the source of truth in one place
status: confirmed
---

# Phase 17 — Apple Confirmed Values (2026-05-07)

Tonight's autonomous Chrome-driven setup completed the Apple Developer + App Store Connect onboarding through the form-filling stage. Locked values below are now permanent or near-permanent.

## Account

| Field | Value | Source |
|---|---|---|
| Account holder | Nahder Zomorrodian | developer.apple.com |
| Apple Developer Team ID | **49R296FJGF** | developer.apple.com top-right |
| Apple Account email | nahder@yahoo.com (developer account) | Apple Developer iOS app |
| Membership status | Active | App Store Connect dashboard loaded |
| Membership expiration | 2026-05-06 + 1 year (~ May 2027) | per Subscription Confirmed email |
| Cost | $98.99/year (auto-renews) | per Apple receipt |

## Bundle ID (PERMANENT post-publish)

| Field | Value |
|---|---|
| **Bundle ID** | **`app.couchtonight.couch`** (Explicit) |
| Description | Couch Tonight iOS |
| App ID Prefix | 49R296FJGF |
| Platform | iOS, iPadOS, macOS, tvOS, watchOS, visionOS (Apple's default — limit to iOS-only at Xcode signing time) |

### Capabilities enabled
- ✅ Associated Domains
- ✅ Push Notifications
- ✅ Sign In with Apple
- (Other capabilities can be added later via developer.apple.com → Identifiers → edit App ID)

## App Store Connect record

| Field | Value |
|---|---|
| **App Store name** | **Couch Tonight** (reserved) |
| **Apple App ID** (internal Apple ID for the listing) | **`6767413821`** |
| Primary Language | English (U.S.) |
| SKU | `COUCH-TONIGHT-IOS-001` |
| Bundle ID linkage | app.couchtonight.couch |
| Platforms | iOS only |
| User Access | Full Access |
| Listing URL | https://appstoreconnect.apple.com/apps/6767413821/distribution |
| iOS Version | 1.0 (status: Prepare for Submission) |

## Universal Links file (deployed)

`couch/.well-known/apple-app-site-association` (no extension) — populated with confirmed Team ID + Bundle ID per the tonight-locked values:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "49R296FJGF.app.couchtonight.couch",
        "paths": ["/", "/app", "/app/*", "/rsvp/*", "/?invite=*", "/?claim=*"]
      }
    ]
  },
  "webcredentials": {
    "apps": ["49R296FJGF.app.couchtonight.couch"]
  }
}
```

This needs `bash scripts/deploy.sh` to push to production. Then verify:
```
curl -sI https://couchtonight.app/.well-known/apple-app-site-association
```
Expect: 200 with `Content-Type: application/json` (Firebase Hosting serves it; the .well-known/ mirror added in commit `797d29f` covers it automatically).

## What still needs YOU before TestFlight upload

These are blocked on you (per safety rules, I can't enter SSN/banking/agreements):

1. ✅ **Paid Applications Agreement** — Active (May 7, 2026)
2. ✅ **W-9 tax form** — Active (May 7, 2026)
3. ✅ **Banking info** — Wilmington Savings Fund Society FSB (7786) Active
4. **Contact info** — Apple may have auto-set; verify in Business tab if needed

## Autonomous Apple-side fills completed this session (2026-05-07)

After agreements + W-9 + banking landed, Claude autonomously filled:

- ✅ **App Information**: Name "Couch Tonight", Subtitle "Pick what to watch tonight", Bundle ID locked, SKU set, Primary Lang en-US
- ✅ **Categories**: Primary = Entertainment, Secondary = Lifestyle
- ✅ **Content Rights**: "No, app does not contain third-party content"
- ✅ **Age Ratings**: 4+ for 173 countries (A12 Brazil, ALL Korea Republic of)
- ✅ **Pricing**: Free, base US (USD), 175 countries auto-set to $0.00
- ✅ **App Availability**: All 175 countries available on app release
- ✅ **Privacy Policy URL**: https://couchtonight.app/privacy.html
- ✅ **Version 1.0 metadata**:
  - Promotional Text: 91 chars (BRAND.md voice; updatable without resubmit)
  - Description: ~2,820 chars (full restraint-voice description with §4.2 mitigation)
  - Keywords: 98 chars (movie night, family, watch together, etc.)
  - Support URL: https://couchtonight.app/support.html
  - Marketing URL: https://couchtonight.app
  - Copyright: 2026 Couch
  - Version: 1.0

## What still needs YOU (reasoning per item)

| Item | Why blocked on you |
|---|---|
| **App Privacy Nutrition Labels** (the data-collection questionnaire) | Legally binding declarations; Apple checks against actual app behavior; one wrong answer can trigger removal. Use 17-APP-STORE-CONNECT-PREP.md §4 as the answer key — paste each answer after reviewing. ~20-30 min. |
| **Reviewer demo account** | Need to create a real Couch user account for App Reviewers (`review-apple@couchtonight.app` or similar) and pre-populate a test family. Then paste the credentials into App Review Information. |
| **Notes for App Reviewer** | Paste from `17-APP-STORE-CONNECT-PREP.md` §5. Wait until you've created the demo account so credentials are filled in. |
| **Screenshots upload** | Phase 31 dependency. Phase 31 produces the source captures; `scripts/regenerate-store-screenshots.cjs` produces the App Store device matrix. |
| **App Preview video** (optional) | Phase 17 work — record a 15-30s walkthrough of the spin/watchparty/pick'em flow. |
| **Xcode build → Archive → Upload** | macOS required. Open `Couch Tonight.zip` from `~/Downloads/`, work the Wave 1 cleanup checklist in `17-PWABUILDER-FINDINGS-2026-05-07.md`, then Archive + upload to TestFlight. |
| **"Add for Review" submission** | Final step after all of the above. 

## Phase 17 D-decision updates

- **D-29 → CONFIRMED:** Bundle ID locked at `app.couchtonight.couch`. Permanent post-publish.
- **D-31 → PROGRESS:** Xcode-time fixups still pending (Info.plist generic permissions, ATS, etc. per 17-PWABUILDER-FINDINGS-2026-05-07.md). Can't do these without macOS.
- **D-32 → CONFIRMED:** privacy.html + terms.html + support.html deployed. Reviewer demo account creation still pending (`review-apple@couchtonight.app`).
- **D-35 → RESOLVED:** Apple post-payment activation took less than 24 hours from May 6 9:01 PM payment to May 7 AM dashboard access.

## What's irreversible after tonight

- Bundle ID `app.couchtonight.couch` — Cannot change without orphaning future installs
- App Store name "Couch Tonight" — Reserved on this account; can be renamed only before first submission via the App Information form
- Apple App ID 6767413821 — Apple's internal record; can't be re-issued

## What's still freely changeable

- Description, Promo Text, Keywords (updatable any time, even after launch)
- Screenshots (updatable per release)
- Pricing (Free → Paid possible; Paid → Free possible)
- App categories
- Privacy Policy URL / Support URL
- App Reviewer demo credentials

---

*Authored autonomously 2026-05-07. Updates `17-LAUNCH-CHECKLIST.md` Wave 0 + Wave 1 substantially.*
