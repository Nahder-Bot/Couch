---
status: partial
phase: 31-marketing-refresh
source: [31-HUMAN-UAT.md, 31-01-SUMMARY.md, 31-02-SUMMARY.md, 31-03-SUMMARY.md, 31-04-SUMMARY.md, 31-05-SUMMARY.md]
started: 2026-05-13T22:30:00Z
updated: 2026-05-14T00:38:00Z
deploy_cache: couch-v48-marketing-refresh
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing paused — 4/7 passed (Tests 2,3,4,7), 1 blocker logged out-of-scope (Test 1 → Phase 17),
 2 blocked on real-device / third-party (Tests 5,6). All Phase-31-scoped assertions auto-verified.]

## Tests

### 1. Comparison section renders on iPhone Safari (MARK-31-01)
expected: |
  iPhone Mobile Safari, https://couchtonight.app: 4 comparison blocks stacked vertically below
  the "Why not the other things?" eyebrow, in order JustWatch/Letterboxd/Teleparty/Apple SharePlay.
  4th block heading verbatim "Why not Apple SharePlay, FaceTime, or Microsoft Teams Together?"
  ending "No one's locked out because they're on the wrong device." Warm-dark surface (#1c1814),
  1px border, text selectable on long-press, no horizontal scroll.
result: issue
reported: "Some thing aren't working well. For example when I hit the back key and try to go forward I see this? [screenshot: Firebase Auth 'Unable to process request due to missing initial state. This may happen if browser sessionStorage is inaccessible or accidentally cleared. ... signInWithRedirect in a storage-partitioned browser environment.']. There are also way to many instances where I click something and don't have an easy way to click back or an x to return where I was. It's almost like you are stuck."
severity: blocker
note: |
  Response is cross-cutting and not specific to the comparison section render itself. User
  surfaced two distinct issues during Test 1 prompt — recorded as two separate gaps below.
  Comparison section render specifics remain unverified — needs re-prompt after navigation
  blockers resolved (or explicit pass-through).

### 2. FAQ accordion behavior on iOS Safari + Android Chrome (MARK-31-03)
expected: |
  https://couchtonight.app FAQ section: exactly 7 <details> items, all collapsed by default,
  each with a "+" glyph at right. Tapping any summary expands it; glyph swaps to "−" and changes
  color from var(--ink-dim) to var(--accent) #e8a04a. Tap again to collapse. Run on BOTH iOS
  Safari AND Android Chrome. On iOS: no native disclosure-triangle artifact (must be hidden
  by ::-webkit-details-marker rule). All 7 answer bodies render without escaped HTML entities
  (no visible &apos; etc.). The first question is "Do I need to log in?" — its answer ends with
  "Apple Sign-In is coming with the App Store launch."
result: pass

### 3. FAQ Sentry breadcrumb fires on open with correct question_index (MARK-31-04)
expected: |
  Desktop Chrome/Firefox at https://couchtonight.app with devtools Network tab filtered to
  "sentry" (or ingest.us.sentry.io). Click the 3rd FAQ question ("Which streaming services
  do you support?") then the 7th ("How is this different from Teleparty?"). Two Sentry envelope
  POSTs fire. Each payload contains literals: category "marketing.faq", message "opened",
  and data.question_index — 2 for the 3rd, 6 for the 7th. Closing a <details> does NOT fire
  a breadcrumb (handler gates on `if (!e.target.open) return`).
result: pass
verified_by: claude (Playwright MCP — hooked Sentry.addBreadcrumb directly rather than scraping envelope POSTs because Sentry batches breadcrumbs until next event capture)
evidence: |
  Live couchtonight.app, 2026-05-14:
  - 7 details.faq-item elements present, data-faq-index 0-6, all collapsed by default ✓
  - data-faq-index=2 summary = "Which streaming services do you support?" ✓
  - data-faq-index=6 summary = "How is this different from Teleparty?" ✓
  - Clicking 3rd → breadcrumb {category:"marketing.faq", message:"opened", data:{question_index:2}} ✓
  - Clicking 7th → breadcrumb {category:"marketing.faq", message:"opened", data:{question_index:6}} ✓
  - Closing both → breadcrumb count stays at 2 (handler gates on !e.target.open) ✓

### 4. Screenshot grid renders at 1x and 2x DPR (MARK-31-06)
expected: |
  https://couchtonight.app "See it in use" section: exactly 5 <figure class="screenshot-card">
  elements. Each <img> loads (no broken-image, naturalWidth > 0). Figcaptions read VERBATIM in
  order: "Everyone's on the couch" / "Watch together, hours apart" / "Bring another family in"
  / "Pick up where you left off" / "Pick'em on the big games". Test in Desktop Chrome at 1x
  and 2x DPR — both crisp. On iOS Safari (3x DPR), the 5th (Pick'em) lazy-loads on scroll-into-view
  per loading="lazy". No CLS in devtools Performance tab.
result: pass
verified_by: claude (Playwright MCP)
evidence: |
  Live couchtonight.app, 2026-05-14:
  - figure.screenshot-card count = 5 ✓
  - Figcaptions verbatim (in order): "Everyone's on the couch" / "Watch together, hours apart" /
    "Bring another family in" / "Pick up where you left off" / "Pick'em on the big games" ✓
  - All 5 imgs have loading="lazy" ✓
  - All 5 imgs naturalWidth > 0 and complete=true after scrollIntoView ✓
  - Index 0/3/4 = fresh 1170×2532; Index 1/2 = Phase-9 soft-fallback (watchparty-live.png 660×1434)
    per D-09 documented substitution map ✓
residual_human: |
  Real-device 3x DPR rendering on iOS Safari + devtools Performance CLS measurement still benefit
  from a human spot-check (visual paint quality at 3x DPR is subjective). Headless-verifiable
  portion is complete.

### 5. og.png link-preview via iMessage + Twitter Card Validator (MARK-31-09)
expected: |
  Paste https://couchtonight.app into an iMessage chat with a 2nd-party tester. Preview card shows
  a 1200×630 image with leather-tone background, Couch wordmark, hero text "Decide what to watch
  in 30 seconds. Watch together.", and "couchtonight.app" footer — NOT the old pre-Phase-9
  placeholder. Run Twitter Card Validator at https://cards-dev.twitter.com/validator — confirms
  summary_large_image card type with the same image. Also test https://couchtonight.app/changelog
  and a https://couchtonight.app/rsvp/<token> URL — both scrape OG meta correctly (rsvp.html OG
  block is new in Phase 31; even an invalid token returns correct OG meta because rsvp.html is
  static). No 404 / broken image in any preview surface.
  Note: Apple may cache OG meta up to 7 days — if iMessage shows OLD preview, append ?utm=phase31uat
  to bust their page-URL cache.
result: blocked
blocked_by: third-party
reason: |
  Third-party scrapers (Apple iMessage Link Preview Service, Twitter Card Validator, Facebook
  Sharing Debugger) cannot be programmatically driven from this verifier. Server-side OG meta
  + image asset are auto-verified — third-party rendering still requires human eyes.
verified_by: claude (curl)
evidence: |
  Live couchtonight.app, 2026-05-14:
  - landing.html: og:title/description/image (https://couchtonight.app/og.png?v=2), og:image:width=1200,
    og:image:height=630, twitter:card=summary_large_image — all present ✓
  - changelog.html: full OG + twitter:card/title/description/image stack present, referencing
    og.png?v=2 ✓
  - rsvp.html (curl with arbitrary token "test-token-uat"): OG title "You're invited to a Couch night",
    description "RSVP in seconds. No account needed.", image=og.png?v=2, twitter:card=summary_large_image —
    confirms D-18 cross-page OG sync + new-in-Phase-31 rsvp.html OG block ✓
  - og.png HTTP HEAD: 200 OK, Content-Length=67392 (matches local sha256-anchored asset; D-23 refresh
    landed in production) ✓
residual_human: |
  iMessage Link Preview rendering on a real device, Twitter Card Validator visual confirmation,
  optional Facebook Sharing Debugger. Server side is locked-in correct; only third-party visual
  rendering remains.

### 6. sw.js cache-bumped + installed PWAs pick up new cache (MARK-31-12)
expected: |
  Run: curl -s https://couchtonight.app/sw.js | grep "const CACHE"
  Output is verbatim: const CACHE = 'couch-v48-marketing-refresh';
  Then on iOS (with Couch PWA installed from home screen): open the PWA. Service worker detects
  new cache. Quit + reopen the PWA. The new landing surface (with comparison / features / FAQ
  sections) renders without any manual cache-clear. Repeat on Android Chrome installed PWA.
result: blocked
blocked_by: physical-device
reason: |
  Installed-PWA cache invalidation behavior on real iOS + Android home-screen apps cannot be
  driven from a headless verifier. CACHE constant value is auto-verified.
verified_by: claude (curl)
evidence: |
  Live couchtonight.app, 2026-05-14:
  - curl -s https://couchtonight.app/sw.js | grep "const CACHE" returns verbatim:
    const CACHE = 'couch-v48-marketing-refresh';  ✓
  - Matches D-19 lock + Phase 31 deploy contract.
residual_human: |
  Open the installed Couch PWA on iOS (home-screen icon) + Android Chrome installed PWA: confirm
  one online activation cycle picks up new cache, new landing surface (with comparison/features/FAQ)
  renders without manual cache-clear.

### 7. Desktop ≥ 900px responsive layout — comparison + features 2-col, FAQ stays 1-col (MARK-31-02 + MARK-31-13)
expected: |
  Desktop Chrome at https://couchtonight.app. Resize the window (or Device Mode) to 1024px wide:
  - Comparison section: 4 blocks render in a 2×2 grid (NOT 4 stacked).
  - Features section: 4 feature blocks render in a 2×2 grid (NOT 4 stacked).
  - FAQ section: stays a single vertical column (intentional — reading flow).
  Resize to 800px wide (under the 900px breakpoint):
  - Comparison + features collapse back to single-column.
  No horizontal scroll at any viewport width 320px → 1920px.
result: pass
verified_by: claude (Playwright MCP)
evidence: |
  Live couchtonight.app, 2026-05-14, viewport sweep:
  - 1024px:  compare blocks 4 items in 2 rows × 2 cols (grid-template-columns "474.5px 474.5px") ✓
              feature blocks 4 items in 2 rows × 2 cols (grid-template-columns "468.5px 468.5px") ✓
              faq items 7 items in 7 rows × 1 col ✓
              no horizontal scroll ✓
  - 800px:   compare blocks 4 in 1 col (grid-template-columns "745px"), feature blocks 4 in 1 col
              ("745px"), faq 7 in 1 col ✓
              no horizontal scroll ✓
  - 320px:   no horizontal scroll (scrollWidth=clientWidth=305) ✓
  - 1920px:  compare 2-col ("520px 520px"), features 2-col ("514px 514px"), no horizontal scroll ✓

## Summary

total: 7
passed: 4
issues: 1
pending: 0
skipped: 0
blocked: 2

## Gaps

# Gap 1 — Cross-cutting nav blocker surfaced during Test 1 (Firebase Auth sessionStorage error)
- truth: "Hitting browser back, then forward, returns user to a working couchtonight.app surface (not a Firebase Auth 'missing initial state' error page)"
  status: failed
  reason: |
    User reported: "when I hit the back key and try to go forward I see this?" — screenshot shows
    Firebase Auth error page: "Unable to process request due to missing initial state. This may
    happen if browser sessionStorage is inaccessible or accidentally cleared. Some specific
    scenarios are - 1) Using IDP-Initiated SAML SSO. 2) Using signInWithRedirect in a
    storage-partitioned browser environment." URL: couchtonight.app, iPhone Mobile Safari.
  severity: blocker
  test: 1
  scope: out-of-phase-31 (auth flow lives in app.html / js/app.js; Phase 31 only touched landing.html + sw.js + og.png + marketing/)
  hypothesis: |
    Firebase getRedirectResult() failure post signInWithRedirect — Safari storage partitioning
    or ITP wipes sessionStorage between Google OAuth redirect leg and return-to-app leg. Known
    Firebase + modern Safari interaction. Likely mitigations:
      (a) Migrate to signInWithPopup for Safari user-agents
      (b) Custom auth resolver persisting nonce to indexedDB or localStorage
      (c) Apple Sign-In (already on Phase 17 roadmap for App Store launch) — sidesteps the
          Google-OAuth-redirect dance entirely.
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis

# Gap 2 — Cross-cutting nav UX (missing back / close affordances throughout app)
- truth: "Every navigable surface in the app exposes a visible back arrow OR close X (or other accessible return path) so users never feel stuck"
  status: failed
  reason: |
    User reported: "There are also way to many instances where I click something and don't
    have an easy way to click back or an x to return where I was. It's almost like you are stuck."
  severity: major
  test: 1
  scope: out-of-phase-31 (navigation chrome lives in app.html — Phase 17 / pre-launch polish territory)
  hypothesis: |
    Modal / detail / drill-down screens in app.html are missing back/X affordances, especially
    on iOS where there is no system back button. Likely surfaces to audit:
      - Title detail view, mood-filter screens, watchparty creation flow, intent-RSVP flow,
        family-roster screen, settings, and any redirect-landed states from deep links
        (?invite=, ?claim=).
    Cross-reference with Phase 17 (App Store Launch Readiness — active 2026-05-05) which is
    explicitly the pre-launch polish phase. Likely best as a Phase 17 gap, NOT a Phase 31 fix.
  artifacts: []  # Filled by diagnosis
  missing: []    # Filled by diagnosis
