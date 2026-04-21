---
type: seed
target_milestone: v1.0
target_phase: 9
created: 2026-04-21
trigger: "When Phase 9 (Redesign/Brand) scope is being defined"
---

# Deferred from Phase 5: Apple Sign-In

Phase 5 originally scoped four auth providers (Google, Apple, Email link, Phone). At execution time (2026-04-21) the user deferred **Apple Sign-In only** to Phase 9 to avoid the $99/yr Apple Developer Program cost during v1 family-and-friends validation. Phone was kept in Phase 5; Facebook was considered and skipped.

## What to add in Phase 9

**Apple Sign-In (web)**
- Apple Developer Program membership ($99/yr)
- App ID `app.couchtonight` with Sign In with Apple capability
- Services ID `app.couchtonight.web`: Domain `couchtonight.app`, Return URL `https://couchtonight.app/__/auth/handler`
- Domain-association file deployed at `queuenight/public/.well-known/apple-developer-domain-association.txt`
- Fix `queuenight/firebase.json` — `hosting.ignore: ["**/.*"]` currently excludes `.well-known/` from deployment; add an allowlist exception
- Sign In with Apple Key (.p8) pasted into Firebase Auth console
- Wire `signInWithApple` export (already in `js/auth.js` from 05-01) to a UI button in the sign-in screen

## Wiring already in place (do NOT redo)
- `js/auth.js` exports `signInWithApple` from 05-01
- `js/firebase.js` re-exports `OAuthProvider` from 05-01
- Phase 5 sign-in screen (05-06) ships with Google + Email-link + Phone buttons only; add Apple button here

## Also deferred from Phase 5: Google OAuth app verification + public launch polish

Phase 5 OAuth consent screen ships in **Testing** publishing status. Works for ≤100 manually-added test users (Audience panel in Google Auth Platform). Strangers signing in get an "unverified app" warning.

To graduate to **In production** (clean consent screen, unlimited users):
- Verify `couchtonight.app` ownership in Google Search Console (DNS TXT record or HTML verification file hosted at the domain root — Firebase Hosting can serve the HTML file)
- Write a privacy policy, deploy at `https://couchtonight.app/privacy`, link it from the footer of `index.html`
- Write a terms of service, deploy at `https://couchtonight.app/terms`, link from footer
- Submit for verification in Google Cloud → Auth Platform → Verification Center (can take 1-4 weeks; Google may request screencast walking through OAuth flow + requested scopes)
- Flip publishing status from Testing → In production in the Audience panel
