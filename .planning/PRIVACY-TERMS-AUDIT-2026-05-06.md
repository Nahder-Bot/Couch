# Privacy / Terms Audit (Phase 17 Prep)

*Authored 2026-05-06 during launch-prep autonomous work.*

## Finding

**`privacy.html` and `terms.html` do not exist in the source repo** (`C:\Users\nahde\claude-projects\couch\`).

They are referenced from:
- `landing.html:226` — footer: `<a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a>`
- `app.html:213` (post A-step commit `e49ff34`) — signin footer: `<a href="/privacy.html">Privacy</a> · <a href="/terms.html">Terms</a>`
- `rsvp.html` form — `<a href="/privacy" class="rsvp-privacy-link">Privacy Policy</a>` (different path style — no `.html`)

The links resolve via Firebase Hosting, which serves files from the sibling `couch-deploy` mirror. Whether real content exists there is unknown from this audit (mirror not at the default `../../couch-deploy` path on this machine). For the purpose of Phase 17 prep, treat as **content does not exist or exists only as placeholder.**

## Why this matters for Phase 17

Apple App Review explicitly checks privacy policy + ToS:
- §5.1.1: "Apps that collect user or usage data must secure user consent for the collection." Privacy policy must explain collection.
- App Privacy Nutrition Labels (Privacy Manifest) require declaring every data type collected, every third-party SDK that collects, every reason for collection.
- Google Play Data Safety Form parallels this — same data-collection enumeration.

Privacy policy must enumerate, at minimum:
- **Firebase** (Authentication, Firestore, Functions, Hosting, Cloud Messaging) — collects auth credentials, real-time data, function invocations
- **TMDB** (https://www.themoviedb.org) — REST API, no user-data exchange but the app fetches title metadata; user IP visible to TMDB
- **Trakt** (https://trakt.tv) — OAuth flow, watch history sync, Trakt sees couch user IDs and viewing data when sync is enabled
- **Sentry** (sentry.io) — error tracking, crash reports; PII-strip in `landing.html:67-101` removes uid/email/family-codes/tokens
- **Google Sign-In** (via Firebase Auth) — federated login, Google sees user identity
- **Apple Sign-In** (when added in Phase 17) — federated login with privacy-relay-email option
- **Web push providers** — VAPID keys + Firebase Cloud Messaging; subscription endpoints
- **Couchtonight.app first-party** — family codes, member profiles, votes, queue state, mood tags, watchparty sessions, pick'em picks

ToS must include:
- Apple-required clauses (link to Apple's standard EULA OR custom EULA)
- Google-required clauses (link to Google Play's standard ToS OR custom)
- DMCA + content takedown (TMDB-attributed catalog, user-uploaded photos in post-watchparty albums)
- Acceptable use (no scraping, no API abuse)
- Privacy practices reference back to the privacy policy
- Geographic limitations (US-only catalog availability via TMDB regions)
- Termination clauses
- Indemnification

## Phase 17 work items implied

This audit is the source of these P0 items in `.planning/phases/17-app-store-launch-readiness/17-CONTEXT.md`:

1. **Author privacy.html** (~3-5 hrs once data-collection survey is complete)
2. **Author terms.html** (~3-5 hrs once Apple/Google clause-set is reviewed)
3. **Wire to Firebase Hosting routes** (`/privacy` → `/privacy.html`, `/terms` → `/terms.html`) — already conventionally working per landing.html links + rsvp.html `/privacy` no-extension link
4. **Sync metadata** — privacy.html and terms.html should have OG/Twitter cards for social-share linkability (mirror landing.html / changelog.html pattern)
5. **Privacy Manifest (`PrivacyInfo.xcprivacy`)** — Apple's machine-readable privacy declaration shipping in the iOS bundle. Required for any new app submission since 2024-Q1.
6. **Google Play Data Safety Form** — the same content as Apple's Nutrition Labels but in Google's web UI form. Phase 17 fills both.

## Deferred ideas

- **Cookie banner / consent UI** — Couch doesn't currently use cookies (Firebase Auth uses localStorage, not cookies). Skip unless EU expansion in v2.
- **GDPR-specific export/delete tooling** — Phase 13 (Compliance & Ops) shipped self-serve account deletion. GDPR data-export request flow could be a future phase.

## Recommendation

Treat privacy.html + terms.html authoring as a 1-2 day P0 task within Phase 17 Wave 1 (alongside Apple Developer enrollment, before native wrapper packaging).

---

*Source-of-truth doc for launch positioning: `.planning/LAUNCH-REVIEW-2026-05-05.md`. Phase 17 scope: `.planning/phases/17-app-store-launch-readiness/17-CONTEXT.md`.*
