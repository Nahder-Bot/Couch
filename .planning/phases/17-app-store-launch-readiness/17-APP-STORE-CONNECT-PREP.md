---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous pre-staging during Apple Developer pending verification)
purpose: Copy-paste-ready answers for App Store Connect listing, App Privacy Nutrition Labels, and App Review submission
related: 17-CONTEXT.md, 17-PWABUILDER-FINDINGS-2026-05-07.md, 17-PLAY-CONSOLE-PREP.md, ../../privacy.html, ../../terms.html
---

# Phase 17 — Apple App Store Connect submission prep

Drafted from `privacy.html` data flows + `BRAND.md` voice rules + Phase 17 CONTEXT D-03..D-26 decisions. Use these as direct paste-targets when you reach each App Store Connect form after Apple activates your developer account.

---

## 1. App Information

| Field | Value | Notes |
|---|---|---|
| **Name** | `Couch Tonight` | 13 chars (limit 30). Per CONTEXT D-03. |
| **Bundle ID** | TBD at Wave 1 | PWABuilder dry-run: `app.couchtonight`. Lock final at /gsd-discuss-phase 17. Once published — permanent. |
| **SKU** | `COUCH-TONIGHT-IOS-001` | Internal identifier; never visible to users. Any string works. |
| **Primary Language** | English (U.S.) | Per CONTEXT scope (en-US only for v1) |
| **Subtitle** | `Pick what to watch tonight` | 26 chars (limit 30). Per CONTEXT D-04 alternate "Movie night, decided." also acceptable. |
| **Category — Primary** | Entertainment | |
| **Category — Secondary** | Lifestyle | |
| **Content Rights** | Does not contain third-party content | (TMDB attribution is metadata, not video — App Store distinguishes) |
| **Age Rating** | 4+ | (See section 5 below for questionnaire pre-fills) |

---

## 2. Pricing and Availability

| Field | Value |
|---|---|
| **Price** | Free |
| **Availability** | All countries — except those on US OFAC sanctions list (Apple handles automatically) |
| **Pre-Orders** | No |
| **Volume Purchase Program** | No (free apps don't apply) |
| **Educational Discount** | No |

---

## 3. App Store Listing

### App Icon (1024×1024)
- Source: `couch/mark-1024.png` (Phase 15.3 deliverable — leather-cushion C with TV)
- Already in production via `*.png` glob mirror (commit `33924c6`)
- iOS App Store requires NO transparency, NO rounded corners (Apple applies its own corner mask). Verify mark-1024.png is full-square.

### Promotional Text (170 chars max — UPDATABLE without resubmitting)
**Recommended:**
```
Decide what to watch in 30 seconds. Together. Free, no ads, your couch isn't anyone's data.
```
(91 chars — leaves room for seasonal updates like "+ now with Pick'em for the playoffs")

### Description (4000 chars max — Apple's voice constraint is more conservative than Play; lead with concrete behaviors)

```
Couch turns "what do you want to watch?" into a 30-second ritual everyone on the couch trusts.

Five people, three streaming services, two opinions on tone, one person already half-asleep. "What do you want to watch?" isn't a preference question — it's a coordination puzzle. Couch gives it two answers: vote together when nobody's decided, or drop a pick when one person already has one. Either way, tonight gets decided in 30 seconds, not 30 minutes.


TWO WAYS TO COUCH

The Spin — Everyone's home. Nobody's picked.
- Join the couch. Share a code. Everyone shows up.
- Everyone votes. Yes / maybe / no on the night's lineup. Takes 90 seconds.
- Spin decides. One spin, fair pick. Hate it? Veto. The wheel goes again.

The Nomination — One person has a pick. Others decide in.
- Drop your pick. "I'm starting Blade Runner at 9pm."
- Everyone RSVPs. In / maybe / can't. See who's joining in real time.
- Couch calls it. Majority turns it into a watchparty. Everyone gets a heads-up when it's starting.


WHAT'S IN IT

Watchparty — Everyone watches together, even from different rooms or different houses. Reactions in real time. "Wait Up" delays so spoilers stay sealed for whoever's behind. Pick up where you left off. Get caught up automatically.

Couch Groups — Pull members from up to four families into one watchparty. Cross-family identity preserved. No passwords, no signups for guests.

Mood Filter — "Cozy," "action," "short" — narrow tonight's matches to the room you've actually got.

Veto — Anyone can reject a pick. Before the spin (drops it from the pool) or after (re-spin). Fairness rules so the vetoer doesn't control the replacement.

Pick'em — Predict winners on the big games. Per-family leaderboard tracks accuracy across the season. NFL, NBA, EPL, college, F1, UFC, and more. Free, no real-money wagering.

Kid Mode — One toggle hides anything above a chosen age tier from tonight's matches. Filters mood, runtime, providers, and ratings.

Decision Explanation — Tap any pick to see exactly why it surfaced. "Mom and Sam said yes - on Hulu - 1h 38m." No black-box recommender.


WHO IT'S FOR

Family — Mixed ages, kid-safe filtering, everyone on the couch tonight.
Crew — Friends who pile onto the couch. Film clubs, group chats, scheduled nights.
Duo — Just the two of you. Date nights, shared queue, one yes is enough.


WHAT'S NOT IN IT

No ads. No paywalls. No subscriptions. We don't sell, share, or rent your data. We don't track you across other apps. We don't use your photos or messages to train AI.

Couch is a coordination tool, not a streaming service. We help you decide what to watch and show where titles are available. The actual watching happens in your existing apps.

Powered by The Movie Database (TMDB). This product uses the TMDB API but is not endorsed or certified by TMDB.
```

(~3000 chars)

### Keywords (100 chars max — comma-separated, hidden from users)
```
movie night,family,watch together,picker,what to watch,streaming,household,pickem,couch,roulette
```
(98 chars — packed)

**ASO note:** keywords inherit from your app name + subtitle, so don't repeat "couch tonight." Per Phase 17 CONTEXT "Open questions for /gsd-discuss-phase 17" #5 — final ASO strategy still TBD; this is a starting set.

### Support URL
```
https://couchtonight.app/support
```
**Status:** TODO — `/support` doesn't exist yet. Easiest path: redirect to a `mailto:support@couchtonight.app` page OR create `support.html` with a contact form. App Review accepts both.

### Marketing URL (optional)
```
https://couchtonight.app
```

### Privacy Policy URL (REQUIRED)
```
https://couchtonight.app/privacy.html
```

### Copyright
```
© 2026 Couch
```

---

## 4. App Privacy Nutrition Labels

This is Apple's structured questionnaire — same content as Play's Data Safety form but in App Store Connect's UI. Mirrors `PrivacyInfo.xcprivacy` (which Apple validates separately).

### Q: Do you or your third-party partners collect any data from this app?
**Answer: Yes**

### Data types — answer for each Apple category:

#### Contact Info
- **Name** — Yes, collected, **linked to user**, not used for tracking, purpose: App Functionality + Account Management
- **Email Address** — Yes, collected, linked, not for tracking, purpose: App Functionality + Account Management
- **Phone Number** — Yes, collected (only if user picks phone sign-in), linked, not for tracking, purpose: App Functionality + Account Management
- **Physical Address** — No

#### Health and Fitness
ALL: No

#### Financial Info
ALL: No

#### Location
ALL: No (Couch never collects location — this is a frequent App Reviewer probe)

#### Sensitive Info
ALL: No

#### Contacts
ALL: No

#### User Content
- **Photos or Videos** — Yes, collected (post-watchparty albums, optional), linked, not for tracking, purpose: App Functionality
- **Audio Data** — No
- **Gameplay Content** — No
- **Customer Support** — No (Couch has no in-app support chat)
- **Other User Content** — Yes, collected (votes, queues, watchparty reactions, RSVPs, mood tags, pick'em picks, family chat messages), linked, not for tracking, purpose: App Functionality

#### Browsing History
ALL: No (Couch is not a web browser; trakt sync is opt-in and scoped to OUR app, not browsing-history-style)

#### Search History
ALL: No

#### Identifiers
- **User ID** — Yes (Firebase uid), linked, not for tracking, purpose: App Functionality + Account Management
- **Device ID** — Yes (FCM push token), linked, not for tracking, purpose: App Functionality

#### Purchases
ALL: No (Couch is free, no IAP)

#### Usage Data
- **Product Interaction** — Yes (taps, votes, watchparty events), linked, not for tracking, purpose: App Functionality + Analytics
- **Advertising Data** — No
- **Other Usage Data** — No

#### Diagnostics
- **Crash Data** — Yes, **NOT linked** (PII stripped before send to Sentry), not for tracking, purpose: App Functionality
- **Performance Data** — Yes, NOT linked, not for tracking, purpose: App Functionality
- **Other Diagnostic Data** — Yes, NOT linked, not for tracking, purpose: App Functionality

#### Other Data
ALL: No

### Q: Do you use this data to track users across apps and websites owned by other companies?
**Answer: No** — Couch does not track. (This sets `NSPrivacyTracking: false` in PrivacyInfo.xcprivacy.)

### Q: Are users able to choose whether to provide some of this data?
**Answer: Yes** for optional fields (photos in albums, phone number if they pick a different sign-in method, Trakt connection)

---

## 5. App Review Information

### Notes for the App Reviewer

```
Hi App Reviewer — thanks for reviewing Couch.

WHAT THE APP IS
Couch is a coordination tool for households deciding what to watch together. It is NOT a streaming service. The user picks what to watch (using votes, mood filters, decision-helper tools) and the actual watching happens in their existing apps (Netflix, Hulu, Max, etc.).

DEMO ACCOUNT
Email: review-apple@couchtonight.app
Password: [SET AT SUBMISSION TIME]

This account is pre-loaded into a test family with 3 members and 8 sample titles. You'll land on the Tonight screen.

FIVE-MINUTE WALKTHROUGH

1. TONIGHT (decision)
   - Tap any title to vote yes/maybe/no.
   - Tap "Spin" — picks a movie from the yes-voted titles using a fair-rotation algorithm.
   - Tap "Veto" on the spin result to re-spin.

2. WATCHPARTY (coordination)
   - Tap a title → Schedule watchparty
   - Set a start time, send the invite
   - Demo family members will auto-RSVP within ~30 seconds (this is a test family; real users RSVP themselves)

3. PICK'EM (sports prediction)
   - Tap the Sports tab
   - Select a game from the schedule (NFL/NBA/EPL pre-loaded)
   - Make a pick (winner, spread). Picks lock at game-start.
   - Note: Pick'em is FREE. There are no in-app purchases, no real-money wagering, no entry fees, and no prizes (other than per-family bragging rights). Per App Store Review Guidelines §5.3.4, this is "Sweepstakes and contests" — no licensing required.

4. ACCOUNT
   - Account → Notifications: granular per-event push toggles
   - Account → Delete account: self-serve account deletion (immediate, GDPR-compliant)

WHY THIS IS A NATIVE APP (NOT A REPACKAGED WEBSITE — §4.2)

Couch's category-unique interactive surfaces are:
- Watchparty — real-time multi-device reactions, time-shifted via "Wait Up", late-joiner catch-me-up
- Couch Groups — cross-family identity in a single coordination space
- Pick'em — per-family leaderboard with per-game prediction UI
- Decision Explanation — humility-voiced "why this pick" overlay
- Kid Mode — one-toggle age-tier content filter

These are NOT static catalog browsing. The app is built using PWABuilder (Microsoft's open-source iOS wrapper) so the experience runs in WKWebView, but the interactive surfaces above fill an interactive native app per §4.2 (Minimum Functionality).

PRIVACY + DATA HANDLING
- Privacy policy: https://couchtonight.app/privacy.html
- We collect only what's needed for app functionality (account credentials, family-scoped activity, push tokens)
- We don't track users across other apps or websites
- Crash diagnostics (Sentry) have all PII stripped before send (uid, email, family codes, tokens redacted)
- Self-serve account deletion: Account → Delete account (immediate, with 30-day backup roll-off)
- NSPrivacyTracking declared as false in PrivacyInfo.xcprivacy

PUSH NOTIFICATIONS
We use APNs via Firebase Cloud Messaging for: watchparty starting, intent matches, RSVPs, vetoes, friend joining a watchparty. Granular per-event opt-out in Account → Notifications. No marketing or promotional pushes.

THANK YOU
If anything is unclear, please reach out at review-apple@couchtonight.app and I'll respond same-day.
```

### Demo Account
- **Username:** `review-apple@couchtonight.app`
- **Password:** [generate at submission, store in 1Password]
- **Setup:** create the account on production via the Couch sign-in flow, then pre-populate it with a sample family by joining a test family (use the Account → Join family flow with a code you reserve). Reviewer will see a populated experience, not an empty new-user state.

### Contact Info for Apple
- **First Name:** Nahder
- **Last Name:** [as on developer account]
- **Phone:** [as on developer account]
- **Email:** [your usual email — apple may contact for review questions]

---

## 6. Build & Version

| Field | Value |
|---|---|
| **Version** | `1.0.0` |
| **Build Number** | Auto-incremented by Xcode (`CFBundleVersion`) — typical first build is `1` |
| **Encryption Declaration** | App uses standard encryption (HTTPS only) — exempt under encryption laws (`ITSAppUsesNonExemptEncryption: false` already set in PWABuilder Info.plist ✓) |

---

## 7. Phased Release & Rollout

Per CONTEXT D-24:
- Enable **Phased Release** for first version (default 7-day 1% → 100%)
- Release immediately upon approval — yes
- Manual release after approval — defer if you want to coordinate with marketing or social posts

---

## 8. Post-submission TODO

When App Review approves:
1. Verify the App Store listing displays correctly on iOS Safari (App Store preview link)
2. Verify Universal Links work — open `https://couchtonight.app/?invite=<test-code>` in iMessage on a device with Couch installed; should open the app, not Safari
3. Verify deep-link `?invite=` parameter is preserved through the cold-launch flow (test on real device)
4. Monitor Sentry for first 24h post-rollout for any iOS-specific crashes (CONTEXT D-27)
5. Monitor Apple Sign-In success rate ≥ 95% (CONTEXT D-27 + spike 001 switch trigger)

---

*Authored 2026-05-07 during autonomous launch-prep. Mirrors privacy.html exactly. Update when ASO keyword strategy locks at /gsd-discuss-phase 17. Legal review of privacy/terms recommended pre-submission.*
