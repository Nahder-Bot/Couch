---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous pre-staging during Apple verification + Android device-search)
purpose: Copy-paste-ready answers for Google Play Console listing, Data Safety form, and Content Rating questionnaire
related: 17-CONTEXT.md, 17-PWABUILDER-FINDINGS-2026-05-07.md, ../../privacy.html, ../../terms.html
---

# Phase 17 — Google Play Console submission prep

Drafted from `privacy.html` (live at https://couchtonight.app/privacy.html) and `BRAND.md` voice rules. Use these as direct paste-targets when you reach each Play Console form.

---

## 1. App details

| Field | Value |
|---|---|
| App name | `Couch Tonight` |
| Default language | `English (United States) – en-US` |
| App or game | App |
| Free or paid | Free |
| Contains ads | No |

**Bundle / Package name (from PWABuilder dry-run):** `app.couchtonight.twa`
**Important:** This is permanent for the lifetime of the listing. If you want a different convention (e.g. `app.couchtonight.couch`), regenerate the package via PWABuilder BEFORE first upload.

---

## 2. Store listing

### App icon
- Source: `mark-1024.png` (the leather-cushion C with TV — Phase 15.3 deliverable)
- Path on disk: `couch/mark-1024.png`
- Already mirrors to deploy via `*.png` glob (committed `33924c6`)
- Format: 1024×1024 PNG, 32-bit, alpha channel allowed but Play prefers full square (no transparency around the icon edge)

### Feature graphic
**Required**: 1024×500 PNG/JPG. **Status: NOT YET PRODUCED.** Phase 31 dependency (`og-source.svg` will become canonical source). For Internal Testing track upload, you can use a temporary placeholder; Play allows updating before promoting to Production.

### Screenshots
- Phone: minimum 2, maximum 8, dimension between 320-3840 px on long side, max 16:9 aspect
- 7-inch tablet: optional but boosts listing
- 10-inch tablet: optional but boosts listing
- Phase 31 produces 5 screenshots at 1170×2532 — those work for the phone slot directly

### Title (max 30 chars)
```
Couch Tonight
```
(13 chars — fits well under limit)

### Short description (max 80 chars)
**Recommended:**
```
Pick what to watch tonight, together. Free, no ads, your couch is yours.
```
(72 chars)

**Alternates:**
- `Decide what to watch in 30 seconds. Together. Free, no ads.` (60 chars)
- `Movie night, decided. Pick together in 30 seconds — free, no ads.` (65 chars)

### Full description (max 4000 chars)

```
Couch turns "what do you want to watch?" into a 30-second ritual everyone on the couch trusts.

Five people, three streaming services, two opinions on tone, one person already half-asleep. "What do you want to watch?" isn't a preference question — it's a coordination puzzle. Couch gives it two answers: vote together when nobody's decided, or drop a pick when one person already has one. Either way, tonight gets decided in 30 seconds, not 30 minutes.

TWO WAYS TO COUCH

The Spin — Everyone's home. Nobody's picked.
• Join the couch. Share a code. Everyone shows up.
• Everyone votes. Yes / maybe / no on the night's lineup. Takes 90 seconds.
• Spin decides. One spin, fair pick. Hate it? Veto. The wheel goes again.

The Nomination — One person has a pick. Others decide in.
• Drop your pick. "I'm starting Blade Runner at 9pm."
• Everyone RSVPs. In / maybe / can't. See who's joining in real time.
• Couch calls it. Majority turns it into a watchparty. Everyone gets a heads-up when it's starting.

WHAT'S IN IT

Watchparty — Everyone watches together, even from different rooms or different houses. Reactions in real time. "Wait Up" delays so spoilers stay sealed for whoever's behind. Pick up where you left off. Get caught up automatically.

Couch Groups — Pull members from up to four families into one watchparty. Cross-family identity preserved. No passwords, no signups for guests.

Mood Filter — "Cozy," "action," "short" — narrow tonight's matches to the room you've actually got.

Veto — Anyone can reject a pick. Before the spin (drops it from the pool) or after (re-spin). Fairness rules so the vetoer doesn't control the replacement.

Pick'em — Predict winners on the big games. Per-family leaderboard tracks accuracy across the season. NFL, NBA, EPL, college, F1, UFC, and more.

Kid Mode — One toggle hides anything above a chosen age tier from tonight's matches. Filters mood, runtime, providers, and ratings.

Decision Explanation — Tap any pick to see exactly why it surfaced. "Mom and Sam said yes • on Hulu • 1h 38m." No black-box recommender.

WHO IT'S FOR

Family — Mixed ages, kid-safe filtering, everyone on the couch tonight.
Crew — Friends who pile onto the couch. Film clubs, group chats, scheduled nights.
Duo — Just the two of you. Date nights, shared queue, one yes is enough.

WHAT'S NOT IN IT

No ads. No paywalls. No subscriptions. We don't sell, share, or rent your data — not to advertisers, not to data brokers, not to anyone. We don't track you across other apps or websites. We don't use your photos or messages to train AI. The only third parties involved are the ones needed to run the app (Google Cloud for backend, TMDB for movie data, optional Trakt sync, Sentry for crash diagnostics with your identity stripped before send). All disclosed in our privacy policy.

Couch is a coordination tool, not a streaming service. We help you decide what to watch and show where titles are available. The actual watching happens in your existing apps.

Powered by The Movie Database (TMDB).
```

(~3100 chars — comfortable margin under 4000)

### App category
- **Category**: Entertainment
- **Tags**: Movies & TV, Family, Streaming guide

### Contact email (REQUIRED)
```
support@couchtonight.app
```
**TODO before submission**: confirm DNS forwarding from `support@couchtonight.app` → `nahderz@gmail.com` (or wherever you want support email to land). Cloudflare email routing is the cheapest path; Google Workspace if you want a real mailbox.

### Website (optional but recommended)
```
https://couchtonight.app
```

### Privacy policy URL (REQUIRED)
```
https://couchtonight.app/privacy.html
```

---

## 3. Data Safety form

This is Google's structured questionnaire about what data the app collects, processes, and shares. **Honesty matters** — Play Protect spot-checks code and listing claims; mismatches trigger takedowns.

### Section: Does your app collect or share any of the required user data types?
**Answer: Yes**

### Section: Is all of the user data collected by your app encrypted in transit?
**Answer: Yes** (Couch uses HTTPS for all transport; Firestore SDK uses TLS)

### Section: Do you provide a way for users to request that their data is deleted?
**Answer: Yes**
**Where users find this:** Account → Delete account (self-serve, immediate)

### Section: Has your app been independently validated against a global security standard?
**Answer: No** (skip — not blocking, only for security-program-certified apps)

### Section: Data types collected — answer for each category:

#### Personal info
| Data type | Collected? | Shared? | Optional/Required | Purpose | Notes |
|---|---|---|---|---|---|
| Name | YES | NO | Required | App functionality, Account management | Display name visible to family members |
| Email address | YES | NO | Required | App functionality, Account management | For sign-in + account recovery |
| User IDs | YES | NO | Required | App functionality | Firebase uid; never shared off-platform |
| Address | NO | — | — | — | — |
| Phone number | YES (optional) | NO | Optional | App functionality, Account management | Only if user chooses phone sign-in |
| Race and ethnicity | NO | — | — | — | — |
| Political or religious beliefs | NO | — | — | — | — |
| Sexual orientation | NO | — | — | — | — |
| Other personal info | NO | — | — | — | — |

#### Financial info
ALL: NO

#### Health and fitness
ALL: NO

#### Messages
| Data type | Collected? | Notes |
|---|---|---|
| Emails | NO | — |
| SMS or MMS | NO | — |
| Other in-app messages | YES | Watchparty reactions + chat-bubble messages — visible to family members only, never shared off-platform. Required for app functionality. |

#### Photos and videos
| Data type | Collected? | Shared? | Optional/Required | Purpose | Notes |
|---|---|---|---|---|---|
| Photos | YES | NO | Optional | App functionality | Post-watchparty albums, family-scoped |
| Videos | NO | — | — | — | — |

#### Audio files
ALL: NO

#### Files and docs
ALL: NO

#### Calendar
ALL: NO

#### Contacts
ALL: NO

#### App activity
| Data type | Collected? | Shared? | Optional/Required | Purpose | Notes |
|---|---|---|---|---|---|
| App interactions | YES | NO | Required | App functionality, Analytics | Votes, queue items, watchparty events — internal only |
| In-app search history | NO | — | — | — | — |
| Installed apps | NO | — | — | — | — |
| Other user-generated content | YES | NO | Required | App functionality | Mood tags, vetoes, RSVPs, pick'em picks |
| Other actions | NO | — | — | — | — |

#### Web browsing
ALL: NO

#### App info and performance
| Data type | Collected? | Shared? | Optional/Required | Purpose | Notes |
|---|---|---|---|---|---|
| Crash logs | YES | NO | Required | App functionality | Sent to Sentry with PII stripped (uid/email/family-codes/tokens removed before send) |
| Diagnostics | YES | NO | Required | App functionality | Sentry breadcrumbs (Firestore noise dropped, URLs sanitized) |
| Other app performance data | NO | — | — | — | — |

#### Device or other IDs
| Data type | Collected? | Shared? | Optional/Required | Purpose | Notes |
|---|---|---|---|---|---|
| Device or other IDs | YES | NO | Required | App functionality | Firebase Cloud Messaging push token; tied to user uid for delivery |

### Section: Data processing principles
- **Data is collected only as needed for app functionality**: ✓
- **Users can request deletion**: ✓ (Account → Delete account)
- **Data is encrypted in transit**: ✓
- **No data is sold to third parties**: ✓

### Section: Third-party SDKs
For each SDK that processes user data, declare. Couch uses:
- **Firebase Authentication** — Google Cloud (data processor) — handles sign-in
- **Firebase Firestore** — Google Cloud (data processor) — primary database
- **Firebase Cloud Messaging** — Google Cloud + Apple/Google (delivery) — push notifications
- **Sentry** — Sentry.io (data processor) — error reporting (PII stripped)
- **TMDB API** — themoviedb.org (data processor) — movie/TV metadata, IP-only
- **Trakt API** (optional) — trakt.tv — watch history sync, only if user connects

---

## 4. Content Rating questionnaire (IARC)

Google routes through IARC (International Age Rating Coalition). Answer the following truthfully — Couch's expected outcome is **"Everyone"** (E) / PEGI 3 / USK 0.

### Category: App
**Q: Does the app contain violence?**
- All variants (cartoon, fantasy, realistic, gory, sexual): **NO**

**Q: Does the app contain sexual content or nudity?**
- All variants: **NO**

**Q: Does the app contain profanity or crude humor?**
- All variants: **NO** (chat is family-scoped + user-generated only — Couch itself ships no profanity)

**Q: Does the app reference or depict alcohol, tobacco, or drugs?**
- All variants: **NO**

**Q: Does the app contain gambling?**
- Real-money gambling: **NO**
- Simulated gambling: **NO** (Pick'em is free, no purchases, no real-money — see CONTEXT D-13 §5.3.4 analysis)

**Q: Does the app contain user-generated content?**
- **YES** — watchparty reactions, post-watchparty album photos, RSVPs, pick'em picks, mood tags, custom title additions

**Q: Does user-generated content include text or photo sharing between users?**
- **YES** — chat in watchparty, photos in albums (both family-scoped, NOT publicly visible)

**Q: Does the app share user location with other users?**
- **NO** — Couch never collects or transmits location

**Q: Does the app allow users to interact or exchange info with strangers?**
- **NO** — interaction is family-scoped only (you must have the family code to join). No public discovery, no public profiles, no friend-of-friend.

**Q: Does the app share user-generated content publicly outside the app?**
- **NO** — all content stays inside the app, scoped to families

**Q: Does the app handle digital purchases?**
- **NO** — Couch is free; no IAP, no subscriptions

**Q: Does the app reference real-world political content, controversial topics, or news?**
- **NO**

**Q: Does the app contain horror or fear-inducing content?**
- **NO**

**Q: Does the app provide unrestricted access to internet content?**
- **NO** — Couch links out to streaming services and TMDB title pages, but does not include a generic web browser

### Expected rating
- **IARC**: 3+
- **ESRB (US)**: Everyone (E)
- **PEGI (EU)**: 3
- **USK (Germany)**: 0
- **Apple App Store equivalent** (separate questionnaire, but same answers): **4+**

---

## 5. App Access (Reviewer demo account)

Google Play Reviewers will need a way to actually USE the app. Provide:

```
Username: apple-review@couchtonight.app
(but use a real account — Google Reviewers will sign in)
```

**Better setup:**
1. Create a dedicated demo Couch account: `play-review@couchtonight.app` (set up via the Couch sign-in flow on production)
2. Pre-populate it with a test family that has 3 members + 5-10 titles + 1 sample watchparty + 1 pick'em prediction
3. Add credentials to "Test login credentials" field in Play Console

Notes for Reviewer should explain:
- "This app coordinates movie/show selection for households. Sign in with the demo account; you'll land in a pre-populated test family."
- "To test core flow: tap Tonight → Spin → vote yes/no → see picker result"
- "To test watchparty: pick a title → Schedule watchparty → invite a family member → confirm join flow"
- "Pick'em is sports-mode only; tap the sports tab to see the leaderboard"

---

## 6. Pricing & distribution

| Setting | Value |
|---|---|
| Price | Free |
| Countries | All available — except countries on US OFAC sanctions list (Play handles this automatically via "All countries" minus restricted) |
| Designed for families | NO (Couch is general-audience, not Play Family-policy program) |
| Contains ads | NO |
| In-app purchases | NO |
| App content for kids | Mixed audiences (general use) |

---

## 7. Pre-launch configuration

Before promoting to Production:
- ✅ Internal Testing track upload first (instant, no review)
- ✅ Run Pre-launch report (automatic on upload)
- ✅ Run Firebase Test Lab Robo test (Option 2 — already-available since Couch uses queuenight-84044 Firebase project)
- ⏳ Closed Testing (1-7 day Google review) — invite 5-10 testers
- ⏳ Open Testing (small review) — optional intermediate step
- ⏳ Production with Staged Rollout 1% → 100% over 7 days (per CONTEXT D-24)

---

## 8. Post-upload TODO

Once the .aab is uploaded to Internal Testing:

1. **Regenerate `assetlinks.json`** with Google Play App Signing's SHA256 fingerprint
   - Play Console → Setup → App Signing → SHA-256 cert fingerprint → copy
   - Edit `couch/.well-known/assetlinks.json` → replace `CC:C7:54:...:BB` with Play's fingerprint
   - Run `bash scripts/deploy.sh` → verify `https://couchtonight.app/.well-known/assetlinks.json` reflects new fingerprint
   - This is what makes the TWA render WITHOUT the Chrome address bar at the top

2. **Backup keystore** to 1Password (was `signing.keystore` + `signing-key-info.txt` from PWABuilder zip) — even with Play App Signing, the upload key still matters

3. **Verify TWA on real device** (when Android device sorted)
   - Sideload `Couch Tonight.apk` from PWABuilder zip
   - Confirm app opens fullscreen, no Chrome address bar
   - Confirm push notifications arrive
   - Confirm sign-in with Google works

---

*Authored 2026-05-07 during autonomous launch-prep continuation. All copy reflects BRAND.md voice + factual to deployed `couchtonight.app/app` behavior. Legal review of privacy/terms still recommended pre-Production-rollout.*
