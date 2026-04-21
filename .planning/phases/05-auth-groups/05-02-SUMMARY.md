---
phase: 05-auth-groups
plan: 02
status: complete
completed: 2026-04-21
executor: orchestrator-inline
---

# Plan 05-02 — Auth provider + custom-domain setup

External Firebase / Google Cloud / Namecheap console configuration to make `couchtonight.app` function as the Firebase Auth redirect domain, with Google + Email-link + Phone providers enabled. Executed inline (not via subagent) because the bulk of the work is user-driven console configuration; the code-side deliverables grew beyond the original plan scope to cover Google OAuth verification prerequisites (domain ownership + privacy policy + footer) surfaced during execution.

## Scope deviation (recorded at execution time)

Original plan scoped four auth providers (Google, Apple, Email-link, Phone). At execution the user:
- **Deferred Apple Sign-In to Phase 9** to avoid the $99/yr Apple Developer Program cost during v1 family-and-friends validation. Seed planted at `.planning/seeds/phase-09-apple-signin.md`.
- **Considered and skipped Facebook** — low ROI at family scale and would have been a scope addition (no wiring in 05-01).
- **Kept Phone auth in 05-02** after briefly deferring it, on the basis that code wiring was already landed in 05-01 and SMS abuse mitigation is handled by Firebase's Phone Number Verification product (production environment configured with US-only region allowlist).

Plan 05-06 (sign-in screen, Wave 4) now needs Google + Email-link + Phone buttons only; Apple button is deferred.

## What landed

### Firebase Console (project `queuenight-84044`)
- Authentication → Settings → **Authorized Domains**: added `couchtonight.app`
- Authentication → Sign-in method: enabled **Google** (support email set to `nahderz@gmail.com`, public-facing project name retained), **Email/Password** + nested **Email link (passwordless)**, **Phone**
- Phone Number Verification (new product): production environment configured with region allowlist to reduce SMS abuse risk

### Google Cloud Console (same project)
- APIs & Services → Credentials → OAuth 2.0 web client: added `https://couchtonight.app/__/auth/handler` to **Authorized redirect URIs** (and `https://couchtonight.app` to Authorized JavaScript origins)
- Google Auth Platform → **Branding**: app name "Couch", support email, logo (`mark-128.png`), Authorized domains (`couchtonight.app`, `queuenight-84044.firebaseapp.com`), developer contact
- Google Auth Platform → **Audience**: publishing status kept as **Testing** for v1 (≤100 test users manually added); production graduation deferred to Phase 9 launch-polish

### Google Search Console
- Verified ownership of `https://couchtonight.app` via HTML file method (`google80a6f5552365d51b.html` deployed at site root)
- This unblocks the Phase 9 path to graduate the OAuth consent screen to In-production status

### Namecheap
- Free email forwarding configured at DNS via Namecheap BasicDNS (MX records `eforward1-5.registrar-servers.com` already live)
- Aliases: `privacy@couchtonight.app` and `hello@couchtonight.app` → forward to `nahderz@gmail.com`
- Destination verified

### Repo code changes (committed)
- `index.html` — added `<footer class="legal-footer">` with Privacy / Terms links; hidden under `@media (display-mode:standalone)` so PWA users don't see it
- `css/app.css` — `.legal-footer` styles using existing design tokens (`--ink-faint`, `--ink-dim`), 10px uppercase, non-blocking `pointer-events` on the container
- `.planning/seeds/phase-09-apple-signin.md` — seed for deferred Apple work + OAuth verification launch polish

### Deploy-repo changes (at `C:\Users\nahde\queuenight\`; not git-tracked)
- `public/google80a6f5552365d51b.html` — Google Search Console verification file
- `public/privacy.html` — minimal privacy policy matching Couch brand (Fraunces + Instrument Serif + Inter, warm dark palette). Covers what Couch actually collects (Google/email/phone auth identifiers, group/vote data, optional Trakt integration), subprocessors (Firebase, TMDB, Trakt), mailing list opt-in language, COPPA-aligned child sub-profile model, account deletion at `privacy@couchtonight.app`.
- `public/terms.html` — minimal terms of use in plain language. Acceptable use, content ownership, service availability caveats, liability, termination.
- `public/index.html` + `public/css/app.css` — synced from couch source with the new footer
- Deployed via `firebase deploy --only hosting` from `C:\Users\nahde\queuenight`

## Smoke tests (run from orchestrator)

- `GET https://couchtonight.app/google80a6f5552365d51b.html` → 200, correct verification string
- `GET https://couchtonight.app/privacy.html` → 200
- `GET https://couchtonight.app/terms.html` → 200
- `curl https://couchtonight.app/ | grep '/privacy.html'` → footer link present (required by Google's branding verification scraper)
- `nslookup -q=MX couchtonight.app 8.8.8.8` → five `eforward*.registrar-servers.com` records live (Namecheap forwarding active)

## Must-haves

Original (reduced scope; Apple N/A):
- [x] `couchtonight.app` is in Firebase Auth Authorized Domains
- [x] Google, Email-link, and Phone providers are enabled in the Firebase console (Apple intentionally deferred)
- [N/A] Apple domain-association file (deferred to Phase 9)
- [x] `queuenight/firebase.json` does NOT rewrite `/__/auth/**` or `/.well-known/**` into the SPA — verified: `firebase.json` has no rewrites at all, only `public: "public"` and `ignore: ["firebase.json", "**/.*", "**/node_modules/**"]`. *Note for Phase 9:* the `"**/.*"` pattern blocks `.well-known/` from deploying — will need an allowlist exception when Apple Sign-In is revived.

Added during execution:
- [x] Google Search Console domain ownership verified
- [x] Privacy policy + terms pages deployed and linked from home page (blocks OAuth branding verification otherwise)
- [x] Namecheap email forwarding active for `privacy@` and `hello@`

## Commits

- `c5c73f3` — docs(05-02): defer Apple + Phone auth to Phase 9, shrink 05-02 scope
- `7398e54` — docs(05-02): un-defer Phone auth back into Phase 5 — only Apple deferred
- `3de2fe0` — docs(05-02): capture Google OAuth verification as Phase 9 launch-polish
- `b3ab0cf` — feat(05-02): add legal footer + privacy/terms pages for Google OAuth verification

## Follow-ups for Phase 9 (captured in seed)

1. Apple Sign-In: App ID, Services ID, domain-association file, `.p8` key, firebase.json `.well-known` allowlist
2. OAuth consent screen: flip publishing status from Testing → In production after privacy policy is reviewed and branding verification is submitted

## What this enables

Wave 2 (Plans 05-03 and 05-04) can now run: auth infrastructure exists, providers are enabled, custom domain is authorized for redirect, and both the code-side SDK wiring (from 05-01) and the console-side plumbing (from 05-02) are in place. CF callers from 05-03 can assume `req.auth` will be populated for signed-in users; Firestore rules from 05-04 can trust Firebase Auth-issued ID tokens.
