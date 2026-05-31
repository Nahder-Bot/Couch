---
phase: 31-marketing-refresh
type: human-uat-scripts
created: 2026-05-13
status: pending
deploy_cache: couch-v48-marketing-refresh
resume_signal: "uat passed"
---

# Phase 31 — Marketing refresh — Device UAT

> Real-device verification scripts for the Phase 31 production deploy `couch-v48-marketing-refresh`.
> Resume signal after pass: reply `uat passed` in the chat to trigger `/gsd-verify-work 31`.

## Pre-flight

- Device A: iOS Safari (NOT the installed PWA — landing.html is the marketing surface, viewed from a stock browser). Open https://couchtonight.app in Mobile Safari, NOT from the home-screen app.
- Device B: Android Chrome (stock browser, https://couchtonight.app).
- Device C: Desktop Chrome or Firefox (≥ 1200px viewport for the desktop responsive layer at landing.css:80-93).
- Cache check from any browser: `curl -s https://couchtonight.app/sw.js | grep CACHE`
  Expected: `const CACHE = 'couch-v48-marketing-refresh';`
- Confirm `https://couchtonight.app/og.png?v=2` returns HTTP 200 with content-type image/png (curl -I).
- Confirm `https://couchtonight.app/marketing/tonight-couch-viz.png` returns HTTP 200 (proves Plan 31-02 + Plan 31-04 deploy.sh extension landed correctly).
- Confirm `https://couchtonight.app/brand/og-source.svg` returns HTTP 200 (sanity — proves brand/ mirror ran).
- Per D-21: existing 13 smoke contracts must remain green. The deploy itself enforces this via deploy.sh §2.5 smoke gate; if deploy succeeded, smoke is green.

## Scripts

### Script 1: Comparison section renders on iPhone Safari (MARK-31-01)

**Goal:** Verify the new 4-block comparison section renders correctly on a real iPhone in Mobile Safari, with Apple SharePlay block reading verbatim.

**Setup:**
- Device A (iOS Safari, NOT PWA).
- Visit https://couchtonight.app in Mobile Safari.

**Steps:**
1. Scroll past the hero / why / about sections.
2. Locate the comparison section eyebrow `Why not the other things?`.
3. Verify 4 blocks render in this order: JustWatch/Reelgood → Letterboxd/Trakt → Teleparty/Scener/Plex → Apple SharePlay/FaceTime/Microsoft Teams Together.
4. Tap-and-hold each block's `<h3>` and confirm copy is selectable (a11y check — proves no `user-select: none` leaked).
5. Verify each block uses the warm-dark surface tone (`var(--surface)` = #1c1814) with subtle 1px border.

**Pass criteria:**
- All 4 comparison blocks visible and stacked vertically (mobile single column).
- Apple SharePlay block (4th) reads exactly: `Why not Apple SharePlay, FaceTime, or Microsoft Teams Together?` followed by the body copy ending `No one's locked out because they're on the wrong device.`
- No visual layout shift / horizontal scroll / cut-off text.

**Decision reference:** D-02 (eyebrow), D-10/D-11/D-12 (voice), D-24 (4th block), D-21 (no new tokens — surface bg is var(--surface)).

---

### Script 2: FAQ accordion behavior on iOS + Android (MARK-31-03)

**Goal:** Verify the 7-question FAQ accordion expands/collapses cleanly on both iOS Safari and Android Chrome, with the `+` → `−` glyph swap honoring restraint-first design.

**Setup:**
- Device A (iOS Safari) AND Device B (Android Chrome). Run this script twice — once per device.
- Visit https://couchtonight.app and scroll to the FAQ section (between screenshots and install).

**Steps:**
1. Locate the FAQ section heading `FAQ`.
2. Verify exactly 7 `<details>` items, all collapsed by default, each showing a `+` glyph at right.
3. Tap `Do I need to log in?` (first question).
4. Verify the `<details>` expands, revealing the answer exactly `Yes. Apple, Google, email-link, or phone — pick one.` (the original "Apple Sign-In is coming with the App Store launch." qualifier was dropped 2026-05-26 commit `ca42fb5` — TD-12 close — once Apple Sign-In shipped to production).
5. Verify the marker glyph swaps from `+` to `−` and the marker color shifts from var(--ink-dim) to var(--accent) #e8a04a.
6. Tap the same summary again to collapse.
7. Tap each remaining 6 summaries in order: Grandma → streaming services → cost → devices → data → vs-Teleparty.
8. On iOS specifically: confirm no native iOS disclosure-triangle artifact appears (the `::-webkit-details-marker { display: none; }` rule from css/landing.css must hide it).

**Pass criteria:**
- All 7 FAQ items toggle open/closed cleanly on both devices.
- `+` → `−` glyph swap fires on every open.
- Color shift on marker (ink-dim → accent) fires on every open.
- No native disclosure-triangle visible on iOS Safari.
- All 7 answer copy lines render correctly (no escaped HTML entities visible like `&apos;`).

**Decision reference:** D-04 (zero-JS `<details>` accordion), D-15/D-16/D-22 (7 questions, ≤ 2 sentence answers).

---

### Script 3: FAQ Sentry breadcrumb fires on open (MARK-31-04)

**Goal:** Verify D-27 breadcrumb wiring — every FAQ open fires `marketing.faq.opened` with the correct `question_index`.

**Setup:**
- Device C (Desktop Chrome or Firefox; need devtools).
- Open https://couchtonight.app in a fresh tab.
- Open devtools → Network tab → filter to `sentry` (or `ingest.us.sentry.io`).
- Optional: also open Sentry dashboard at `sentry.io/organizations/couch/issues/?project=4511281871454208` filtered to "this minute" to see breadcrumbs land on the server side.

**Steps:**
1. Scroll to the FAQ section.
2. Click the 3rd question (`Which streaming services do you support?`) → expected `data.question_index: 2`.
3. Click the 7th question (`How is this different from Teleparty?`) → expected `data.question_index: 6`.
4. In Network tab, find the Sentry envelope POSTs (typically `/api/4511281871454208/envelope/` endpoint).
5. Inspect the request payload — should contain a breadcrumb with `category: marketing.faq`, `message: opened`, `data: { question_index: 2 }` (and another for question_index 6).

**Pass criteria:**
- 2 Sentry envelope POSTs fire (one per FAQ open).
- Each payload contains the literal strings `marketing.faq` AND `opened` AND `question_index`.
- The `question_index` values match the data-faq-index attributes from landing.html (0-indexed: 2 for the 3rd, 6 for the 7th).
- Closing a `<details>` does NOT fire a breadcrumb (the script gates on `if (!e.target.open) return;`).

**Decision reference:** D-27 (Sentry breadcrumb on FAQ open). Defensive guard `typeof Sentry !== 'undefined'` per canonical pattern.

---

### Script 4: New screenshot grid renders at 1x and 2x DPR (MARK-31-06)

**Goal:** Verify the 5 new screenshots from Plan 31-02 load correctly at both 1x and 2x device pixel ratios with no broken-image icons.

**Setup:**
- Device A (iOS Safari, 3x DPR) AND Device C (Desktop Chrome with devtools' Device Mode emulating 1x DPR + 2x DPR).
- Visit https://couchtonight.app and scroll to the `See it in use` section.

**Steps:**
1. Verify exactly 5 `<figure class="screenshot-card">` elements in the grid (DOM-inspect).
2. Verify each `<img>` loads (no broken-image placeholder, naturalWidth > 0 in devtools).
3. Verify the figcaption strings read: `Everyone's on the couch` / `Watch together, hours apart` / `Bring another family in` / `Pick up where you left off` / `Pick'em on the big games`.
4. On Desktop Chrome, switch DPR to 1x → confirm images still render crisply (1170-wide source has plenty of resolution headroom).
5. Switch DPR to 2x → confirm same.
6. On iOS Safari (3x DPR), confirm the Pick'em screenshot (5th, below-fold default lazy-load) appears after scrolling into view — proves `loading="lazy"` is honored.

**Pass criteria:**
- 5 images render with no broken-image artifacts on both devices.
- All 5 figcaption strings present verbatim.
- Pick'em image lazy-loads on scroll-into-view (iOS Safari + Mobile Chrome both honor `loading="lazy"`).
- No CLS (Cumulative Layout Shift) from the screenshot grid — verifiable in devtools Performance tab.

**Decision reference:** D-05 (1170×2532 capture), D-25 (Pick'em as 5th).

---

### Script 5: og.png link-preview renders when shared via iMessage + Twitter (MARK-31-09)

**Goal:** Verify the new 1200×630 og.png renders correctly in third-party link-preview scrapers (Apple iMessage Link Preview Service, Twitter card validator).

**Setup:**
- Device A (iOS, with iMessage active to a 2nd-party tester contact).
- Twitter Card Validator: https://cards-dev.twitter.com/validator (or the Sentry-side equivalent if the validator is offline).
- Facebook Sharing Debugger: https://developers.facebook.com/tools/debug/ (optional — confirms general OG fetch).

**Steps:**
1. iMessage: paste `https://couchtonight.app` into a chat with a 2nd-party tester. Wait for the link to expand.
2. Verify the iMessage preview card shows: 1200×630 image with leather-tone background + Couch wordmark + hero text "Decide what to watch in 30 seconds. Watch together." + couchtonight.app footer.
3. Twitter Card Validator: paste `https://couchtonight.app` and click `Preview card`. Confirm `summary_large_image` card type and the same 1200×630 image renders.
4. Repeat for `https://couchtonight.app/changelog` (changelog OG points at same og.png?v=2).
5. Repeat for a real `https://couchtonight.app/rsvp/<test-token>` link (rsvp OG meta is new in Phase 31). Note: test rsvp token must be valid for the rsvp-rendering server-side path to return 200, but the OG meta lives in rsvp.html which is served statically before any token-validation runs — so even an invalid-token URL should return correct OG meta.

**Pass criteria:**
- iMessage link preview renders the new og.png (NOT the old pre-Phase-9 placeholder image).
- Twitter Card Validator confirms `summary_large_image` + 1200×630 + correct image.
- rsvp.html OG meta scrapes correctly (proves the new meta block from Task 1 above is reachable).
- No 404 / broken-image in any preview surface.

**Decision reference:** D-17 (og.png recipe), D-18 (cross-page OG sync), D-23 (full visual refresh).

---

### Script 6: sw.js cache-bumped to couch-v48-marketing-refresh (MARK-31-12)

**Goal:** Verify the live cache string is the new D-19 version after deploy.

**Setup:**
- Any device with curl OR browser devtools.

**Steps:**
1. Run: `curl -s https://couchtonight.app/sw.js | grep "const CACHE"`.
2. Expected output: `const CACHE = 'couch-v48-marketing-refresh';`
3. On Device A (iOS PWA): open the installed Couch PWA. The service worker should detect the new cache version and trigger an update.
4. Force a refresh by quitting + reopening the PWA (iOS) or hard-refreshing (Android Chrome).
5. Verify the new landing.html (with comparison/features/FAQ sections) is served when you visit `/`.

**Pass criteria:**
- curl returns the literal string `couch-v48-marketing-refresh`.
- Installed PWAs on iOS + Android pick up the new cache after one online activation cycle.
- New landing surface renders without manual cache-clear steps.

**Decision reference:** D-19 (cache name), D-20 (single-repo deploy).

---

### Script 7: Comparison/features/FAQ render at desktop ≥ 900px (MARK-31-02 + MARK-31-13)

**Goal:** Verify the desktop responsive layer kicks in at ≥ 900px viewport, switching comparison + features grids to 2-column layout per the new `@media (min-width: 900px)` block in css/landing.css.

**Setup:**
- Device C (Desktop Chrome or Firefox).
- Resize the browser to exactly 1024px wide (or use Device Mode to set "Responsive" with 1024×768).

**Steps:**
1. Visit https://couchtonight.app at 1024px viewport.
2. Verify the comparison section's 4 blocks render in a 2×2 grid (NOT 4 stacked).
3. Verify the features section's 4 feature blocks render in a 2×2 grid (NOT 4 stacked).
4. Verify the FAQ section remains a single vertical column even at desktop width (FAQ has no 900px override — by design, since reading flow benefits from single-column).
5. Resize to 800px wide (under the 900px breakpoint) and verify the comparison + features grids collapse back to single-column.

**Pass criteria:**
- Comparison: 2 cols at ≥ 900px, 1 col below.
- Features: 2 cols at ≥ 900px, 1 col below.
- FAQ: always 1 col (intentional per restraint-first design).
- No horizontal scroll at any width from 320px to 1920px.

**Decision reference:** D-21 (no new tokens — responsive via existing @media pattern), CONTEXT specifics §1 (Stripe/Linear-sparse).

---

## Pass-completion ritual

Once all 7 scripts pass on at least 2 of 3 devices (iOS + Android minimum; Desktop optional but recommended for Scripts 3 and 7), reply `uat passed` to trigger `/gsd-verify-work 31`.

If any script fails:
- Capture screenshot of the failure.
- File details under "Open follow-ups" in `.planning/STATE.md` with format `[31-UAT-Script-N] <one-line summary>`.
- Reply `uat failed: <Script N>: <one-line>` to chat. Claude will spawn a follow-up gap-closure plan via `/gsd-plan-phase 31 --gaps`.

## Acknowledged limitations

- iMessage Link Preview Service is opaque: Apple may cache a previously-seen URL's OG meta for up to 7 days. If iMessage shows the OLD preview, share a fresh URL with a query string like `?utm=phase31uat` to bypass Apple's cache. The `?v=2` on og.png itself bypasses CDN cache for the IMAGE; the page-URL cache is separate.
- Twitter Card Validator is intermittently down — if the validator UI is broken, fall back to posting to a private Twitter account and inspecting the rendered tweet.
- Sentry breadcrumb verification (Script 3) requires an environment where Sentry is reachable — corporate proxies or VPNs may block `js.sentry-cdn.com`. If breadcrumbs don't appear, verify the user's network can reach Sentry first.
