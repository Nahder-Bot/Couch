# Phase 17 — App Store Connect paste-ready (Demo Account submission)

**Purpose:** Drop-in values for the App Store Connect "App Review Information" section once the `APLDEMO2605` Review Demo family is seeded via `seed-reviewer-demo-family.js`.

**Status:** Authored 2026-05-14; **seed executed 2026-05-18** under `review-apple@couchtonight.app` via browser-console `seed-reviewer-demo-family.js`. Verified live in Firestore: family `APLDEMO2605` ("Review Demo") owned by review-apple's uid; 3 members (Reviewer/Sam/Riley with isParent + age fields correct); 8 titles (Office / Inception / Stranger Things / Top Gun Maverick / Mandalorian / Spirited Away / Ted Lasso / Grand Budapest Hotel) all with TMDB posters + moods + pre-seeded yes-votes (Reviewer:5, Sam:4, Riley:2 — Spin pulls a real result on first tap once "in" toggle flips). Family auto-loads on reload — `users/{review-apple-uid}/groups/APLDEMO2605` index doc written, so iPhone PWA sign-in lands directly on Tonight tab without code entry. **Ready to paste into App Store Connect.**

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

## 2. Notes for the App Reviewer — paste-ready (3,234 chars)

```text
Hi App Reviewer — thanks for reviewing Couch.

WHAT THE APP IS
Couch is a coordination tool for households deciding what to watch together. It is NOT a streaming service. The user picks what to watch (using votes, mood filters, decision-helper tools) and the actual watching happens in their existing apps (Netflix, Hulu, Max, etc.).

DEMO ACCOUNT (passwordless email-link)
Email: review-apple@couchtonight.app
Family code: APLDEMO2605 (pre-populated — loads automatically after sign-in)

Couch uses passwordless authentication — there is no static password (despite the placeholder value in the Password field above; ASC requires a non-empty value). Sign-in flow:
1. Open the app, tap "Sign in with Email"
2. Enter: review-apple@couchtonight.app
3. A one-time sign-in link is sent to that inbox
4. The inbox is forwarded to the developer; the link is relayed to App Review within minutes during business hours (US Eastern)

If you'd prefer a different sign-in path (Google or phone), please reach out at the support email below and we'll provision one.

PRE-POPULATED FAMILY ("Review Demo")

After sign-in the "Review Demo" family (code APLDEMO2605) loads automatically with:
- 3 members: Reviewer (you, parent), Sam (adult sub-profile), Riley (kid sub-profile, age 9)
- 8 titles pre-loaded: The Office, Inception, Stranger Things, Top Gun: Maverick, The Mandalorian, Spirited Away, Ted Lasso, The Grand Budapest Hotel
- Pre-seeded yes-votes across titles so the Spin picker has a non-empty pool on first tap

If you'd like to start fresh instead, tap Account → Delete account → confirm. Sign in again and you'll be guided through normal first-run onboarding (~2 minutes).

FIVE-MINUTE WALKTHROUGH

1. TONIGHT (decision)
   - The pre-seeded "Review Demo" family loads on the Tonight tab
   - Tap any title to add or change your vote (yes/maybe/no)
   - Tap "Spin" — picks a movie from the yes-voted pool using a fair-rotation algorithm
   - Tap "Veto" on the spin result to re-spin

2. KID MODE (one-toggle age filter)
   - Tap your avatar in the top-right → switch to "Riley" (age 9)
   - The title list filters automatically to age-appropriate content
   - Switch back to "Reviewer" to see the full library again

3. WATCHPARTY (coordination)
   - Tap a title → Schedule watchparty
   - Set a start time and confirm
   - Multi-device experience needs a second sign-in to see end-to-end. The single-device flow demonstrates scheduling, sharing, and the live coordination surface.

4. PICK'EM (sports prediction)
   - Tap the Sports tab
   - Select a game from the schedule (NFL / NBA / EPL pre-loaded)
   - Make a pick (winner, spread). Picks lock at game-start.
   - Pick'em is FREE. No in-app purchases, no real-money wagering, no entry fees, no prizes (other than per-family bragging rights). Per App Store Review Guidelines §5.3.4 this is "Sweepstakes and contests" — no licensing required.

5. ACCOUNT
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
- Crash diagnostics (Sentry) have all PII stripped before send
- Self-serve account deletion: Account → Delete account (immediate, with 30-day backup roll-off)
- NSPrivacyTracking declared as false in PrivacyInfo.xcprivacy

PUSH NOTIFICATIONS
APNs via Firebase Cloud Messaging for: watchparty starting, intent matches, RSVPs, vetoes, friend joining a watchparty. Granular per-event opt-out in Account → Notifications. No marketing or promotional pushes.

THANK YOU
If anything is unclear, please reach out at review-apple@couchtonight.app — replies same-day during US Eastern business hours.
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
