---
created: 2026-05-26
updated: 2026-05-26
purpose: Durable handoff for next-session resume after multi-angle pre-submit review
status: live (Tier 1 + Tier 2 SHIPPED, Tier 3-4 + Should-fix + screenshots-replace PENDING)
production_cache: couch-v37-listener-recovery (live)
app_version: 37
---

# Couch — Pre-Submit Polish — Continue Here

## Where we are right now

**Production live state:** `couch-v37-listener-recovery` (deployed 2026-05-26, commits `90d4a58` + `59b4334` on `hotfix/phase-30-cross-cutting-wave`). Tier 1 (commits `ba2311c` + `7233f32`) + Tier 2 listener-recovery wiring all live.

**App Store Connect state:**
- iOS App Version 1.0 (Prepare for Submission)
- Build 104 attached + saved
- Description: UFC dropped + NHL added + © symbol added (committed `c4c2f5b`)
- All 5 screenshots uploaded at 1284×2778 (iPhone 6.5" section)
- **NEW: 01-tonight.png re-captured 2026-05-26 with populated state** (4 of 4 watching + Pick CTA visible). Files at `app-store-screenshots/{1320x2868,1290x2796,1284x2778,1242x2688}/01-tonight.png`. **User must re-upload to ASC** to replace the empty-state version.
- "Add for Review" is enabled

**Build 104 verified in TestFlight + Apple Sign-In E2E confirmed on iPhone (TD-12 closed).**

## What just shipped (Tier 1, commit `ba2311c`)

| Fix | File | What |
|---|---|---|
| viewport meta a11y | `app.html:5` | Dropped `maximum-scale=1.0, user-scalable=no` — restored pinch-zoom |
| 7 stale alt texts | `app.html` (×6) + `landing.html` | `"Couch — a film-reel..."` → `"Couch"` |
| 4 broken CSS animations | `css/app.css` lines 485 / 495 / 875 / 1701 | `var(--var(--ease-out))` → `var(--ease-out)` / `var(--ease-cinema)` / `var(--ease-spring)` |
| safe-area-inset-bottom | `css/app.css:601` `.tabbar` | Home-indicator clearance |
| safe-area-inset-top | `css/app.css:617` `.who-mini` | Status-bar clearance |
| invalid `gap:-6px` | `css/app.css:619` | Removed (margin-right:-6px on children does the overlap) |
| duplicate landing screenshot | `landing.html:247` | Removed duplicate watchparty-live.png card |
| favicon.ico missing | repo root | Generated 48×48 from `brand/mark-master.png` |
| sitemap.xml | `sitemap.xml` | `/changelog` → `/changelog.html` + added privacy/terms/support + bumped lastmod |
| cache + APP_VERSION lockstep | `sw.js:8` + `js/constants.js:800` | `couch-v36-presubmit-polish` + APP_VERSION 36 |
| 01-tonight screenshot re-capture | `app-store-screenshots/raw/01-tonight.png` + all 4 device sizes | Populated state (4 of 4 watching + Pick CTA), regenerated via sharp pipeline |

## What's pending (Tier 2-4 + Should-fix)

### Tier 2 — Silent failure mitigation — SHIPPED 2026-05-26 (commit `90d4a58`)

All 6 listeners now route through `snapshotErrorHandler()` from `js/app.js:803`:

| Listener | Line | Wire pattern |
|---|---|---|
| titles      | `js/app.js:5093`  | `snapshotErrorHandler('titles')` as 3rd arg |
| group       | `js/app.js:5128`  | `snapshotErrorHandler('group')` as 3rd arg |
| notif-prefs | `js/app.js:836`   | replaced `qnLog`-only handler |
| settings    | `js/app.js:3601`  | replaced `console.error` |
| activity    | `js/app.js:9218`  | wrapped handler nulls `unsubActivity` then delegates (early-return guard) |
| lists       | `js/app.js:17035` | wrapped handler nulls `unsubLists` then delegates (early-return guard) |

Combined with the pre-existing `intents` (5147) and `watchparties` (5200) handlers from Phase 30 TD-13, all 8 long-lived listeners now have stream-error coverage (qnLog + Sentry breadcrumb + one-time toast per listener-name per session).

Lockstep bumps shipped in same commit: `APP_VERSION 36 → 37`, `sw.js CACHE → couch-v37-listener-recovery` (cache bump captured in follow-up commit `59b4334`).

### Tier 3 — WKWebView prompt fallbacks + Apple in Account (~45 min)

Three fixes:
1. `js/auth.js:112` — replace `window.prompt('Please confirm your email...')` with an in-DOM email-input modal (use existing modal patterns like the phone-code entry). Silent failure on cross-device email-link sign-in in WKWebView (returns null silently).
2. `js/app.js:3965` — same `window.prompt()` issue for password-protected family group join. In-DOM modal pattern.
3. `js/app.js:11823-11827` — dead `failed-precondition` branch (CF now throws `not-found`); update copy.
4. **Account tab Apple Sign-In gap** — find where the Sign-in Methods list is rendered (search for `Sign-in methods` or `Linked ways to sign in`). Currently shows Google / Phone / Email / Password but NOT Apple. Add Apple Sign-In as a linkable method following the same pattern. Per App Store §4.8 spirit since Apple is now offered at sign-in.

### Tier 4 — Marketing polish (~15 min)

- Landing hero subtagline below "Who's on the couch tonight?": `<p class="hero-subtagline"><em>Decide what to watch in 30 seconds. Together.</em></p>` (italic serif voice match)
- ASC prep doc `.planning/phases/17-app-store-launch-readiness/17-APP-STORE-CONNECT-PREP.md` line 87: update sport list to match live ASC (NFL, NBA, NHL, EPL, college basketball, college football, F1)
- `landing.html` FAQ #5 (line ~274): pre-stage the App Store badge OR toggle copy from "Native App Store apps coming" to "iOS app and Android home-screen install"
- Footer: add `press@couchtonight.app` to Namecheap email forwarder list + add footer entry

### Should-fix items (~30-45 min)

- 3 sub-44px touch targets: `.lib-search-clear` (24×24), `.queue-btn` (30×30), `.swipe-header .close` (32×32) — add `min-width:44px;min-height:44px;display:inline-flex;align-items:center;justify-content:center` to each
- 3 modals with nested `role="dialog"` (app.html lines 1025-1026 wait-up-picker, 1061-1062 past-parties, 1100-1101 svc-suggest) — drop role from outer or inner, be consistent
- `.signin-title` H1 (css/app.css:2355) — replace with `<img class="brand-logo" src="/logo-h200.png">` like other entry screens for brand consistency
- `queuenight/functions/src/rsvpSubmit.js:146-157` — cap or remove full `families.get()` scan in fallback branch (current: O(N) per unauth RSVP)
- `queuenight/functions/src/gameResultsTick.js:349` — add `!pickNow.processedFirstAt` guard to `picksSettled` increment to match `picksTotal` pattern
- `queuenight/functions/src/rsvpSubmit.js:237-243` — update `expiresAt` on re-submit (currently retains original)
- `js/auth.js:121-124` — add `flashToast` in catch block for sign-in error (currently console.error only)
- Hardcoded banner colors `#2a1f14` / `#4a3820` / `#c97b5f` at `css/app.css:2477, 2492` — tokenize

## Action items for next session

1. **User uploads new 01-tonight.png** to ASC (replace empty-state version with populated). Files at `app-store-screenshots/1284x2778/01-tonight.png` (or 1320×2868 for 6.9" if also that section).
2. ~~Tier 2: wire snapshotErrorHandler to 6 listeners + bump cache.~~ **SHIPPED 2026-05-26 — commits `90d4a58` + `59b4334`. Production: `couch-v37-listener-recovery`.**
3. **NEXT:** Continue with Tier 3 in fresh session: "Continue Tier 3 from pre-submit review — WKWebView prompt fallbacks + Apple in Account tab" → reads this doc for context.
4. Then Tier 4 + Should-fix in sequence (each can be a fresh session if needed).
5. After all tiers ship + screenshot uploaded → switch ASC Release setting to MANUAL → click Add for Review.

## Synthesis report (durable record of all 75 findings)

See conversation transcript 2026-05-26. Key summary:
- 10 BLOCKER items (Tier 1 = first 8 now SHIPPED; remaining are #B3 prompt fixes, #B4 silent listeners — Tier 2-3)
- 16 SHOULD-FIX items (mostly Tier 4 + Should-fix items above)
- 5 STRENGTH items (don't touch: "Why we built it" backstory, privacy policy, voice consistency, "What's actually in it" restraint, App Reviewer Notes block)

## Resume signal for next session

Reply `continue tier 3` in chat. Fresh Claude session will read this doc and pick up the WKWebView prompt fallbacks + Apple-in-Account work. Production state: `couch-v37-listener-recovery` live, Build 104 in TestFlight, ASC ready for Add-for-Review pending screenshot re-upload + remaining-tiers ship (Tier 3 + Tier 4 + Should-fix).
