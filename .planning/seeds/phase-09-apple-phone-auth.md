---
type: seed
target_milestone: v1.0
target_phase: 9
created: 2026-04-21
trigger: "When Phase 9 (Redesign/Brand) scope is being defined"
---

# Deferred from Phase 5: Apple Sign-In + Phone auth

Phase 5 originally scoped four auth providers (Google, Apple, Email link, Phone). At execution time (2026-04-21) the user deferred Apple Sign-In and Phone to Phase 9 to avoid the $99/yr Apple Developer Program cost and SMS budget commitment during v1 family-and-friends validation.

## What to add in Phase 9

**Apple Sign-In (web)**
- Apple Developer Program membership ($99/yr)
- App ID `app.couchtonight` with Sign In with Apple capability
- Services ID `app.couchtonight.web`: Domain `couchtonight.app`, Return URL `https://couchtonight.app/__/auth/handler`
- Domain-association file deployed at `queuenight/public/.well-known/apple-developer-domain-association.txt`
- Fix `queuenight/firebase.json` — `hosting.ignore: ["**/.*"]` currently excludes `.well-known/` from deployment; add an allowlist exception
- Sign In with Apple Key (.p8) pasted into Firebase Auth console
- Wire `signInWithApple` export (already in `js/auth.js` from 05-01) to a UI button

**Phone auth**
- Firebase Auth → Phone provider enabled (SMS budget required)
- reCAPTCHA container already scaffolded in `js/auth.js` (initPhoneCaptcha/sendPhoneCode exports from 05-01)
- Wire phone form to sign-in screen

## Wiring already in place (do NOT redo)
- `js/auth.js` exports `signInWithApple`, `initPhoneCaptcha`, `sendPhoneCode` from 05-01
- `js/firebase.js` re-exports `OAuthProvider`, `RecaptchaVerifier`, `signInWithPhoneNumber` from 05-01
- Phase 5 sign-in screen (05-06) ships with Google + Email-link buttons only; add Apple + Phone buttons here
