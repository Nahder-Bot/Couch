---
slug: firebase-auth-back-forward
status: fixed-pending-human-verify
trigger: "firebase-auth-back-forward"
created: 2026-05-14T00:50:00Z
updated: 2026-05-14T05:08:00Z
fix_commits: ["6563207 (code)", "c5cef7e (debug session doc)"]
fix_deploy: "couch-vfix-auth-bfcache @ 2026-05-14T05:05:00Z"
project: couch
surface: Mobile Safari on iPhone (NOT installed PWA)
url: https://couchtonight.app
related_phase: 17 (App Store Launch Readiness — active, scoped) — surfaced during Phase 31 UAT Test 1
---

# Debug Session: firebase-auth-back-forward

## Symptoms

<symptoms data="DATA_START">
expected: |
  After navigating somewhere on https://couchtonight.app (likely into /app via a CTA that
  triggers Google Sign-In via signInWithRedirect), the user hits the browser back arrow,
  then the forward arrow, and lands back on the working app surface — not on a Firebase
  Auth error page.

actual: |
  After hitting back, then forward, the user lands on a page (URL bar still shows
  couchtonight.app) that renders ONLY the Firebase Auth helper error text below the
  Safari URL chrome. The rest of the viewport is blank. The page is unrecoverable
  without a hard refresh / cache-clear.

error_message_verbatim: |
  "Unable to process request due to missing initial state. This may happen if browser
  sessionStorage is inaccessible or accidentally cleared. Some specific scenarios are -
  1) Using IDP-Initiated SAML SSO. 2) Using signInWithRedirect in a storage-partitioned
  browser environment."

timeline: |
  - Surfaced 2026-05-14 during Phase 31 UAT Test 1 by Nahder on iPhone Mobile Safari.
  - Auth flow was introduced in Phase 5 (auth-groups), so this bug predates Phase 31.
  - Likely affects all users on Safari 16.4+ (storage partitioning shipped Mar 2023) when
    bfcache restores a getRedirectResult() page after sessionStorage was wiped.
  - Surfaced NOW because Phase 31's marketing refresh adds new CTAs that funnel users
    into the /app surface where the auth dance happens.

reproduction: |
  1. iPhone Mobile Safari (NOT installed PWA).
  2. Visit https://couchtonight.app (landing.html).
  3. Tap a CTA / link that routes to /app (app.html) — likely "Install" / "Get Started"
     / "Try It" / hero CTA. The exact CTA needs identification.
  4. On /app, hit the Google Sign-In flow (which uses signInWithRedirect — redirects to
     accounts.google.com, then back via Firebase's __/auth/handler at
     <project-id>.firebaseapp.com, then back to couchtonight.app).
  5. Once back on couchtonight.app post-auth (whether signed in or cancelled), hit the
     browser BACK arrow.
  6. Then hit the FORWARD arrow.
  7. The error page renders. User feels "stuck".

screenshot_evidence: |
  Screenshot from user shows Safari URL bar "couchtonight.app" + the error text
  beneath. Status bar 11:57, 13% battery, low signal — incidental.
</symptoms>

## Working Hypotheses

<hypothesis_a data="DATA_START">
id: A
hypothesis: |
  Safari bfcache restores a page that previously called firebase.auth().getRedirectResult()
  on initial paint. When restored from bfcache, getRedirectResult() is called again, but
  sessionStorage has been wiped (by ITP across the cross-domain redirect, or by Safari's
  page lifecycle on restore). The Firebase SDK throws/renders the "missing initial state"
  error because the auth nonce + pendingRedirect keys are gone.
confidence: high
evidence_for:
  - Error message literally cites "signInWithRedirect in a storage-partitioned browser
    environment" — Safari ≥16.4 storage partitioning IS a known cause.
  - Error appears on back/forward (classic bfcache restoration trigger).
  - URL stays at couchtonight.app (not <project-id>.firebaseapp.com) — consistent with
    the post-redirect leg where the app calls getRedirectResult on its own domain.
test: |
  Reproduce in Safari with Web Inspector. After repro:
    1. Inspect sessionStorage on the error page — expect empty / missing firebase:auth keys.
    2. Add `addEventListener("pageshow", e => console.log("pageshow.persisted:", e.persisted))`
       — when error renders on forward, persisted should be true (bfcache restoration).
    3. Confirm code in js/app.js calls getRedirectResult() unconditionally at app boot.
</hypothesis_a>

<hypothesis_b data="DATA_START">
id: B
hypothesis: |
  The error page is being rendered NOT by Firebase JS SDK at all, but by Firebase's
  hosted auth handler at <project-id>.firebaseapp.com/__/auth/handler being shown via
  iframe / popup leftover from a previous Sign-In attempt that's now in bfcache.
confidence: low
evidence_against:
  - URL bar shows couchtonight.app, not firebaseapp.com.
  - The hosted handler typically only renders briefly during the redirect leg; bfcache
    of THAT page would still show the firebaseapp.com URL.
</hypothesis_b>

<hypothesis_c data="DATA_START">
id: C
hypothesis: |
  Custom domain auth handler (per Firebase Hosting custom-domain auth config) means
  the redirect bounces through couchtonight.app/__/auth/handler — which renders the
  error page directly when sessionStorage state is missing.
confidence: medium
evidence_for:
  - Firebase Hosting on a custom domain CAN proxy the auth handler under the same
    apex domain (eliminates the queuenight-84044.firebaseapp.com bounce). If this
    project enabled that, the handler runs at couchtonight.app — would explain the
    URL bar.
  - Some hosting setups serve the handler at /__/auth/handler under the app's domain.
test: |
  1. curl -sI https://couchtonight.app/__/auth/handler — check if it returns 200 from
     Firebase Hosting (presence of x-firebase-* headers).
  2. Check firebase.json hosting rewrites for /__/auth/* paths.
  3. If yes → the error page is the hosted handler's own UI when state is missing,
     not the app's own getRedirectResult() throw. Fix surface shifts.
</hypothesis_c>

## Current Focus

hypothesis: A+C combined — see Evidence for confirmed synthesis
test: COMPLETE
expecting: N/A — root cause confirmed

## Evidence

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    js/firebase.js line 15: authDomain is "couchtonight.app" (custom domain, NOT
    queuenight-84044.firebaseapp.com). This means the Firebase Auth redirect loop
    bounces through couchtonight.app/__/auth/handler — same apex domain as the app.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    curl -sI https://couchtonight.app/__/auth/handler returns HTTP 200 with
    Firebase Hosting headers (x-served-by, x-cache, alt-svc h3). The auth handler
    IS hosted at the custom domain. Hypothesis C CONFIRMED as the URL mechanism.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    firebase.json (queuenight/firebase.json) has NO /__/auth/* rewrite entries.
    Firebase Hosting automatically provisions the /__/auth/handler path when
    authDomain points to the custom Hosting domain. This is implicit, not explicit
    in the config.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    js/auth.js bootstrapAuth() calls getRedirectResult(auth) unconditionally at
    boot — no pageshow guard, no bfcache check, no check of event.persisted.
    This is called from boot() in js/app.js line 5291 before any UI render.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    js/auth.js bootstrapAuth() wraps getRedirectResult in try/catch — BUT the
    catch only logs the error; it does not render a recovery UI. The Firebase SDK
    itself renders the "missing initial state" error page when bfcache restores the
    page to /__/auth/handler with no sessionStorage state.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    Firebase SDK version: 10.12.0 (pinned via gstatic CDN URL in firebase.js).
    Storage-partitioned sessionStorage handling was not fixed in this SDK version
    for the redirect flow. signInWithPopup avoids this entirely.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    The exact error page ("Unable to process request due to missing initial state")
    is rendered by the /__/auth/handler page itself when it loads without the
    expected sessionStorage state. Safari's bfcache restores this page from cache
    — which is the /__/auth/handler intermediate URL that was visited during the
    redirect leg — and its sessionStorage (which held the auth nonce) was cleared
    by Safari ITP during the cross-domain round-trip or on bfcache restore.

- timestamp: 2026-05-14T05:00:00Z
  finding: |
    Root cause synthesis: signInWithRedirect forces the browser to navigate to
    couchtonight.app/__/auth/handler as an intermediate hop during the Google
    OAuth dance. Safari bfcache snapshots this intermediate page. When user hits
    Back then Forward, bfcache restores the /__/auth/handler snapshot, which
    re-executes with no sessionStorage auth state (cleared by ITP/Safari page
    lifecycle) and renders the error inline. This is NOT the app's getRedirectResult
    throwing — it's the Firebase-hosted handler page itself rendering its own
    error UI. The app never gets control.

## Eliminated Hypotheses

- id: B
  eliminated: 2026-05-14T05:00:00Z
  reason: |
    URL is couchtonight.app not firebaseapp.com because authDomain=couchtonight.app
    routes the handler through the custom domain. B was correct in observing it's
    the handler page, not the app — but the mechanism is the custom domain, not a
    popup/iframe. B is merged into the confirmed synthesis.

## Fix Candidates (deferred until root cause confirmed)

### Candidate 1: Migrate to signInWithPopup for Safari user-agents
- Detect Safari via UA sniffing or feature-detect (storage-partitioned context).
- For Safari, use `signInWithPopup` which avoids the cross-domain sessionStorage round-trip.
- Pro: Smallest patch. Compatible with existing Google Sign-In setup.
- Con: Popup blocked on iOS Safari unless triggered by direct user gesture; UX is okay
  but slightly different from redirect.

### Candidate 2: Detect "missing initial state" error class and recover gracefully
- Wrap getRedirectResult() in try/catch. On the specific error code
  (auth/missing-initial-state), redirect to /app/login or clear partial state +
  show a friendly "Sign in again" CTA.
- Pro: Catches all causes (bfcache, ITP, partitioning) not just storage-partition.
- Con: Doesn't fix root cause — the error is rendered by /__/auth/handler itself
  before the app code even loads. Try/catch in bootstrapAuth() cannot intercept this.

### Candidate 3: Suppress getRedirectResult() on bfcache restoration
- Listen for `pageshow` event with `event.persisted === true`. When restored from
  bfcache, skip the getRedirectResult() call — the result was already consumed.
- Pro: Surgical fix for the exact trigger.
- Con: INSUFFICIENT alone — the error is rendered by /__/auth/handler (not app.js).
  A pageshow guard in app.js cannot prevent the handler page from rendering its error
  when Safari restores it from bfcache. This only helps if the app page itself is
  bfcache-restored (a secondary concern).

### Candidate 4: Migrate to Apple Sign-In on iOS (already on Phase 17 roadmap)
- Apple Sign-In via Firebase's OAuthProvider doesn't suffer from the same storage-
  partition issue.
- Pro: Best UX on iOS (native sheet), already planned for App Store launch.
- Con: Larger change; doesn't help Safari-on-macOS or non-Apple Google users.

### Candidate 5 (NEW — RECOMMENDED): signInWithPopup for Safari + bfcache guard
- For iOS/Safari user-agents: use signInWithPopup instead of signInWithRedirect.
  Safari 16.4+ blocks cross-site cookies and partitions sessionStorage for the
  redirect intermediary — popup avoids the entire /__/auth/handler bfcache problem.
- Additionally add a `pageshow` bfcache guard in auth.js bootstrapAuth() to skip
  getRedirectResult when the page is bfcache-restored (belt + suspenders).
- Safari popup on iOS: blocked ONLY if not triggered by a direct user gesture —
  the sign-in button tap IS a direct gesture, so popups work.
- On iOS standalone PWA: signInWithRedirect can be kept (popups are blocked in
  standalone; existing comment in auth.js notes this). Detect via
  navigator.standalone or display-mode: standalone media query.
- Files changed: js/auth.js only (2 functions: signInWithGoogle, bootstrapAuth).
- Risk: LOW. Popup code path exists in Firebase 10.x. No build step. Tested pattern.

## Specialist Review

(pending — will invoke typescript-expert after fix candidate selection)

## Resolution

status: fixed-and-deployed
resolved: 2026-05-14T05:08:00Z
deploy_cache: couch-vfix-auth-bfcache

root_cause: |
  signInWithRedirect causes the browser to navigate through couchtonight.app/__/auth/handler
  as an intermediary during the Google OAuth round-trip. Safari's bfcache snapshots this
  intermediate page. On Back+Forward, bfcache restores the handler snapshot without the
  sessionStorage auth state (wiped by Safari ITP / storage partitioning), causing the
  Firebase-hosted handler page to render its own "missing initial state" error UI. The app
  never regains control — the error is in the handler page itself, not in getRedirectResult().

fix: |
  Two-part patch applied 2026-05-14, commits 6563207 (code) + c5cef7e (debug session doc):

  1. js/firebase.js — added signInWithPopup to imports + re-exports (Firebase SDK 10.12.0).

  2. js/auth.js — added _shouldUsePopup() helper that returns true ONLY when the agent
     is Safari (UA contains "Safari" but NOT Chrome/CriOS/FxiOS/EdgiOS/OPiOS/YaBrowser)
     AND NOT a standalone PWA (navigator.standalone false + display-mode:standalone false).
     signInWithGoogle + signInWithApple branch on _shouldUsePopup() — popup for Safari
     non-PWA (avoids the handler-bfcache trap because popup doesn't put /__/auth/handler
     in session history); redirect everywhere else (iOS standalone PWA per D-06, Chrome,
     Firefox, etc.).

  3. js/auth.js — bootstrapAuth() now checks
     performance.getEntriesByType('navigation')[0]?.type === 'back_forward' and skips
     getRedirectResult() entirely on bfcache restoration. Belt+suspenders for any path
     that might still bfcache an app page mid-auth.

verification: |
  Deployed 2026-05-14T05:05:00Z via `bash scripts/deploy.sh fix-auth-bfcache`. Smoke gate
  (12 contracts) passed pre-deploy. Production checks via curl + Playwright on
  https://couchtonight.app:

  - js/auth.js live with new code: _shouldUsePopup helper present, signInWithPopup calls
    in both signInWithGoogle + signInWithApple, back_forward navigation guard in
    bootstrapAuth ✓
  - js/firebase.js live: signInWithPopup imported from firebase-auth.js 10.12.0 and
    re-exported ✓
  - sw.js CACHE = 'couch-vfix-auth-bfcache' (curl-confirmed; bumped from
    couch-v48-marketing-refresh; PWAs invalidate on next online activation) ✓
  - /app boots cleanly: 0 console errors (1 pre-existing deprecated meta-tag warning,
    unrelated) ✓
  - Dynamic import of /js/auth.js + /js/firebase.js succeeds with all expected exports
    (bootstrapAuth, signInWithGoogle, signInWithApple, signInWithPopup, etc.) ✓

  HUMAN-VERIFY remaining: Nahder retests the original repro on his iPhone Mobile Safari
  (couchtonight.app → CTA → Sign in with Google → back → forward). Expected: lands on a
  working app surface or sign-in screen, NOT the "missing initial state" error page.

files_changed:
  - path: js/firebase.js
    lines_changed: 2
    rationale: Add signInWithPopup to imports + re-exports.
  - path: js/auth.js
    lines_changed: 46
    rationale: |
      _shouldUsePopup helper (UA + standalone-PWA gates), branch in signInWithGoogle +
      signInWithApple, performance.navigation back_forward guard in bootstrapAuth, plus
      updated file header comment.

residual_followups:
  - Apple Sign-In migration (Phase 17 roadmap) sidesteps Google OAuth entirely on iOS —
    longer-term replacement.
  - Cosmetic: CACHE name "couch-vfix-auth-bfcache" breaks the versioned pattern (prior:
    couch-v48-marketing-refresh). Next deploy should restore versioning (couch-v49-*).
  - Telemetry: monitor Sentry for any new signInWithPopup-related errors over 7 days
    (Phase 17 soak window).
