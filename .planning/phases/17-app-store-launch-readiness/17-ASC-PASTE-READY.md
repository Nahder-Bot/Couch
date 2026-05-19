# Phase 17 — App Store Connect paste-ready (Demo Account submission)

**Purpose:** Drop-in values for the App Store Connect "App Review Information" section once the `APLDEMO2605` Review Demo family is seeded via `seed-reviewer-demo-family.js`.

**Status:** Authored 2026-05-14; **seed executed 2026-05-18** under `review-apple@couchtonight.app` via browser-console `seed-reviewer-demo-family.js`. Verified live in Firestore: family `APLDEMO2605` ("Review Demo") owned by review-apple's uid; 3 members (Reviewer/Sam/Riley with isParent + age fields correct); 8 titles (Office / Inception / Stranger Things / Top Gun Maverick / Mandalorian / Spirited Away / Ted Lasso / Grand Budapest Hotel) all with TMDB posters + moods + pre-seeded yes-votes (Reviewer:5, Sam:4, Riley:2 — Spin pulls a real result on first tap once "in" toggle flips). Family auto-loads on reload — `users/{review-apple-uid}/groups/APLDEMO2605` index doc written, so iPhone PWA sign-in lands directly on Tonight tab without code entry. **2026-05-18 update:** ASC App Review Information SAVED via Chrome MCP — Sign-In Required toggled ON, demoAccountName + demoAccountPassword filled, Notes body §2 below replaced (Save button transitioned to disabled = server-side accepted). Original 4,603-char body rejected by ASC ("This field is too long" — 603 over 4,000-char limit; doc's earlier "3,234 chars" comment was stale); trimmed PRIVACY + PUSH sections and re-saved at **3,614 chars (3,645 bytes UTF-8)**. **Live in production.**

---

## 1. Structured fields (App Store Connect → My App → App Information → App Review Information)

| Field | Value | Notes |
|---|---|---|
| **Sign-In Required** | Yes | Couch requires sign-in for every flow |
| **Demo Account — Username** | `review-apple@couchtonight.app` | Paste exactly. Lowercase. |
| **Demo Account — Password** | `Passwordless-See-Notes-2026` | Sentinel value. Couch is passwordless (email-link only); ASC requires a non-empty value in this field. Reviewer sees this string AND the Notes body explanation, so confusion is minimal. |
| **Contact First Name** | `Nahder` | Per developer account |
| **Contact Last Name** | (as on developer account) | |
| **Contact Phone** | (as on developer account) | |
| **Contact Email** | `nahderz@gmail.com` | Or your preferred review-contact address |
| **Notes (App Review)** | See §2 below | ~3,200 chars; fits in 4,000-char field |
| **Attachment** | None | |

---

## 2. Notes for the App Reviewer — paste-ready (3,614 chars / 3,645 bytes UTF-8 — fits the 4,000-char ASC limit with 386 chars headroom)

> This is the version that landed in ASC on 2026-05-18 (Save accepted). The earlier 4,603-char draft was rejected with "This field is too long" — PRIVACY + PUSH sections compressed to fit. Privacy policy URL + Privacy Nutrition Labels already convey the cut details to App Review.

```text
Hi App Reviewer — thanks for reviewing Couch.

WHAT THE APP IS
Couch is a coordination tool for households deciding what to watch together. It is NOT a streaming service — users pick a title (votes, mood filters, decision-helpers) and watch in their existing apps (Netflix, Hulu, Max, etc.).

DEMO ACCOUNT (passwordless email-link)
Email: review-apple@couchtonight.app
Family code: APLDEMO2605 (pre-populated — loads automatically after sign-in)

Couch uses passwordless authentication — no static password (the Password field above holds a placeholder; ASC requires non-empty). Sign-in flow:
1. Open the app, tap "Sign in with Email"
2. Enter: review-apple@couchtonight.app
3. A one-time sign-in link is sent to that inbox
4. The inbox is forwarded to the developer; the link is relayed to App Review within minutes during US Eastern business hours

If you'd prefer Google or phone sign-in, please reach out at the support email below and we'll provision one.

PRE-POPULATED FAMILY ("Review Demo")
After sign-in the "Review Demo" family (APLDEMO2605) auto-loads with:
- 3 members: Reviewer (you, parent), Sam (adult sub-profile), Riley (kid sub-profile, age 9)
- 8 titles: The Office, Inception, Stranger Things, Top Gun: Maverick, The Mandalorian, Spirited Away, Ted Lasso, The Grand Budapest Hotel
- Pre-seeded yes-votes so Spin has a non-empty pool on first tap

To start fresh: Account → Delete account → confirm; sign in again to see normal onboarding (~2 min).

FIVE-MINUTE WALKTHROUGH

1. TONIGHT (decision)
   - "Review Demo" family loads on the Tonight tab
   - Tap any title to vote yes/maybe/no
   - Tap "Spin" — picks from the yes-voted pool (fair-rotation)
   - Tap "Veto" on the spin result to re-spin

2. KID MODE (one-toggle age filter)
   - Tap avatar (top-right) → switch to "Riley" (age 9)
   - Titles auto-filter to age-appropriate content
   - Switch back to "Reviewer" for full library

3. WATCHPARTY (coordination)
   - Tap title → Schedule watchparty → confirm start time
   - Multi-device flow needs a second sign-in; single-device demonstrates scheduling + sharing + live coordination surface

4. PICK'EM (sports prediction)
   - Sports tab → select game (NFL/NBA/EPL pre-loaded) → pick winner/spread
   - Picks lock at game-start
   - Pick'em is FREE: no IAP, no real-money wagering, no entry fees, no prizes. Per §5.3.4 "Sweepstakes and contests" — no licensing required.

5. ACCOUNT
   - Notifications: per-event push toggles
   - Delete account: self-serve, immediate, GDPR-compliant

WHY THIS IS A NATIVE APP (§4.2)
Couch's category-unique interactive surfaces: Watchparty (real-time multi-device reactions with "Wait Up" time-shift + late-joiner catch-me-up); Couch Groups (cross-family identity); Pick'em (per-family leaderboard); Decision Explanation (humility-voiced "why this pick" overlay); Kid Mode (age-tier filter).

These are NOT static catalog browsing. Couch is built via PWABuilder (Microsoft's open-source iOS wrapper) so it runs in WKWebView, but the interactive surfaces above fill an interactive native app per §4.2 (Minimum Functionality).

PRIVACY + PUSH
Policy: https://couchtonight.app/privacy.html. We don't track users across other apps/websites; NSPrivacyTracking=false in PrivacyInfo.xcprivacy. Sentry strips PII. Self-serve account deletion in-app.

Push via APNs + Firebase Cloud Messaging for: watchparty starting, intent matches, RSVPs, vetoes, friend joining a watchparty. Granular per-event opt-outs. No marketing/promotional pushes.

THANK YOU
If anything is unclear: review-apple@couchtonight.app — replies same-day during US Eastern business hours.
```

---

## 3. Path-A vs Path-B execution

**Path A — Claude drives ASC via Chrome MCP** (preferred if Chrome MCP permission gate resolved):
1. Claude navigates to https://appstoreconnect.apple.com/apps/6767413821/distribution
2. Scrolls to "App Review Information"
3. Pastes Username + Password + Notes from §1 and §2 above
4. Hits Save

**Path B — User drives ASC manually** (fallback if Chrome MCP still failing):
1. Open https://appstoreconnect.apple.com/apps/6767413821/distribution in your browser
2. Scroll to "App Review Information"
3. Paste:
   - **Username:** `review-apple@couchtonight.app`
   - **Password:** `Passwordless-See-Notes-2026`
   - **Notes:** the entire text block from §2 above (everything between the triple-backticks)
4. Click Save at top right
5. Reply here when done — Claude will commit the §5 + STATE.md updates

---

## 4. Post-submission commits (Claude will handle once ASC is saved)

- Update §5 of `17-APP-STORE-CONNECT-PREP.md` with the locked `APLDEMO2605` family code under DEMO ACCOUNT line
- Update STATE.md with new Last Activity entry noting reviewer demo account complete
- Update `.continue-here.md` to drop the "Reviewer demo account" line from Remaining Work — Apple-side blockers reduce to Xcode + Screenshots + final submission
