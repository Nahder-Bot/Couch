---
seeded: 2026-04-21
target-phase: 5.x (Phase 5 polish — NOT Phase 9 which is Redesign/Brand)
recategorized-from: phase-09-apple-signin.md
trigger: "Phase 5 UAT (2026-04-21) — Apple Sign-In deferred to avoid $99/yr Apple Developer Program during v1 family-and-friends validation"
related: [phase-05x-account-linking.md]
---

# Phase 5.x seed — Apple Sign-In enablement

> **Recategorization note (2026-04-21, autonomous session):** Originally seeded as `phase-09-apple-signin.md`. Phase 9 per ROADMAP is Redesign/Brand/Marketing, not auth polish. Apple Sign-In is a Phase 5 scope carve-out, not a redesign task.

## Why deferred from Phase 5

Phase 5 originally scoped four auth providers (Google, Apple, Email link, Phone). At execution time (2026-04-21) the user deferred **Apple Sign-In only** to avoid the $99/yr Apple Developer Program cost during v1 family-and-friends validation. Phone was kept in Phase 5; Facebook was considered and skipped.

Apple Sign-In implementation code is 80% in place — `signInWithApple` is already exported from `js/auth.js` (05-01) using the `OAuthProvider('apple.com')` pattern. The gaps are **external configuration + UI surfacing**, not implementation.

## What's needed (mostly external + config)

### Apple Developer side (paid, $99/yr)

- Apple Developer Program membership
- App ID `app.couchtonight` with Sign In with Apple capability enabled
- Services ID `app.couchtonight.web` configured:
  - Domain: `couchtonight.app`
  - Return URL: `https://couchtonight.app/__/auth/handler`
- Sign In with Apple Key (.p8) generated — this private key pastes into Firebase Auth console under Apple provider

### Couch repo side

- Domain-association file deployed at `queuenight/public/.well-known/apple-developer-domain-association.txt` (provided by Apple when configuring the Services ID)
- `queuenight/firebase.json` fix: `hosting.ignore: ["**/.*"]` currently excludes `.well-known/` from deploy. Add an allowlist exception:
  ```json
  "ignore": ["**/.*", "!**/.well-known/**"]
  ```

### Firebase Console side

- Paste the .p8 key + Team ID + Key ID + Services ID into Firebase Auth → Apple provider → save
- Enable the Apple provider

### Client UI

- Surface the existing `signInWithApple` button in the sign-in screen DOM. Currently the sign-in screen ships with Google + Email-link + Phone only. Add:
  ```html
  <button class="pill accent large" onclick="handleSigninApple()">
    <svg class="apple-logo" ...></svg> Continue with Apple
  </button>
  ```
  with a matching `window.handleSigninApple` handler calling the exported `signInWithApple()`.

## Wiring already in place (do NOT redo)

- `js/auth.js:46` exports `signInWithApple`
- `js/firebase.js:3` imports `OAuthProvider`; re-exported at line 22
- Phase 5 sign-in screen DOM (05-06) has the layout for a vertically-stacked button list — the Apple row just needs to be added alongside Google

## Related: Google OAuth app verification (separate but adjacent)

Phase 5 OAuth consent screen ships in **Testing** publishing status. Works for ≤100 manually-added test users. Strangers signing in get an "unverified app" warning.

To graduate to **In production** (clean consent screen, unlimited users):
- Verify `couchtonight.app` ownership in Google Search Console (DNS TXT record or HTML verification file at domain root)
- Write a privacy policy, deploy at `https://couchtonight.app/privacy`, link from `index.html` footer
- Write a terms of service, deploy at `https://couchtonight.app/terms`, link from footer
  - Note: `queuenight/public/privacy.html` and `terms.html` already exist — verify they're current
- Submit for verification in Google Cloud → Auth Platform → Verification Center (1–4 weeks, may request screencast)
- Flip Testing → In production in the Audience panel

## Ordering

These two sub-seeds should ship together or Apple Sign-In in isolation:
1. **Apple Sign-In enablement** (this seed) — unblocks the 4th provider
2. **OAuth app verification** — unblocks public-launch sign-up funnel

## Success criteria

- Apple button on sign-in screen round-trips a real sign-in on iOS standalone PWA
- Firebase user doc populated with the user's Apple-provided name (captured on first sign-in)
- No regression on Google / Email / Phone providers
- Flips the DEFERRED row in `.planning/phases/05-auth-groups/05-UAT-RESULTS.md` to PASS

## Estimate

~4 hours spread across a week: 1hr Apple Developer setup, 1hr Firebase console + key generation, 1hr code surfacing + privacy/terms pages, 1hr device UAT. The wait-time on Apple's own review is the longest pole.
