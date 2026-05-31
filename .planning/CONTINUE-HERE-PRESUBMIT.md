---
created: 2026-05-26
updated: 2026-05-27
purpose: Durable handoff for next-session resume after multi-angle pre-submit review
status: live (pre-submit polish all SHIPPED + interim mark-blend-fix v41 + Phase 15.3 transparent-PNG pipeline v42). LAUNCH PATH UPDATED 2026-05-27: Nahder elected to ship Phase 16 (Calendar Layer) BEFORE App Store submission. Add-for-Review held until Phase 16 ships.
production_cache: couch-v42-phase-15.3-transparency (live)
app_version: 42
cf_deploys: rsvpSubmit, gameResultsTick (queuenight commit 5125bf1, deployed 2026-05-26)
phase_15_3: SHIPPED 2026-05-27 — couch commits a17d7cb + 3d27e29. Transparent-PNG pipeline replaces all mix-blend-mode workarounds across css/{app,landing,rsvp}.css. scripts/regenerate-icons.cjs is now the canonical regen tool (alpha-keys black backdrop, produces 36 PNG outputs from 3 masters).
phase_16: LAUNCH-BLOCKING — Calendar Layer. **PLANNED 2026-05-27** — 10 PLAN.md files across 9 waves, gsd-plan-checker PASSED iter 2/3 (0 blockers, 6 warnings + 1 info all closed without regression). Full scope in .planning/phases/16-calendar-layer/16-CONTEXT.md; integration map in 16-RESEARCH.md; per-file analogs in 16-PATTERNS.md; per-task validation in 16-VALIDATION.md (nyquist_compliant: true). 15 CAL-16-* IDs minted (REQUIREMENTS.md backfill scheduled in Plan 16-10). Estimated 2-3 sessions execution. **RESUME: /clear then /gsd-execute-phase 16** in a fresh session.
---

# Couch — Pre-Submit Polish — Continue Here

## Where we are right now

**Production live state:** `couch-v40-shouldfix-web` (deployed 2026-05-26, commits `4ba31c8` + `df63206` on `hotfix/phase-30-cross-cutting-wave`). Tier 1 (commits `ba2311c` + `7233f32`) + Tier 2 (`90d4a58` + `59b4334`) + Tier 3 (`7fb83fe` + `116060c`) + Tier 4 (`0aea675` + `6160ad0`) + Should-fix web (`4ba31c8` + `df63206`) all live on hosting. Should-fix CFs (`rsvpSubmit`, `gameResultsTick`) deployed from queuenight repo commit `5125bf1` via `firebase deploy --only functions:rsvpSubmit,functions:gameResultsTick`.

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

### Tier 3 — WKWebView prompt fallbacks + Apple in Account — SHIPPED 2026-05-26 (commit `7fb83fe`)

iOS WKWebView (PWABuilder wrapper) has no UIAlertController bridge, so `window.prompt()` returns `null` instantly — three flows were silently dead in the wrapper. Added a generic in-DOM `promptInDom()` helper in `js/utils.js` (Promise-returning, reuses existing `.modal-bg`/`.modal`/`.modal-x-btn`/`.modal-actions-row`/`.pill` CSS — no new styles) and rewired each call site.

| Fix | Line | What |
|---|---|---|
| `js/auth.js:112` | email-link cross-device confirm | `await promptInDom({ inputType: 'email', ... })` |
| `js/app.js:3963` | password-protected family-group join | `await promptInDom({ inputType: 'password', ... })` |
| `js/app.js:3009` | Flow B compromise time picker (**bonus — not in handoff**) | `await promptInDom({ inputType: 'datetime-local', ... })` — also a real UX upgrade vs plain-text prompt parsing |
| `js/app.js:11825-11829` | dead `functions/failed-precondition` branch | **deleted** (CF security-collapsed it into `not-found` per HIGH-4 / P02-T-30-03 — keeping aligned copy would risk re-introducing the family-code-existence oracle leak via a future refactor) |
| `js/app.js:~15868` | Apple row in `renderSignInMethodsCard` | Inline SVG Apple-logo + `providers.includes('apple.com')` check, slotted between Google and Phone for §4.8 spirit parity |

Lockstep bumps shipped in same commit: `APP_VERSION 37 → 38`, `sw.js CACHE → couch-v38-wkwebview-prompts` (cache bump captured in follow-up commit `116060c`).

Live-prod verification via Chrome MCP: all 5 fixes confirmed in deployed source (cache name, APP_VERSION, BUILD_DATE stamp, `promptInDom` export/import, Apple SVG path, removed dead branch).

### Tier 4 — Marketing polish — SHIPPED 2026-05-26 (commit `0aea675`)

| Item | File | Result |
|---|---|---|
| Hero subtagline | `landing.html:143` + `css/landing.css:31-32` | New `.hero-subtagline` rule (16px italic Instrument Serif, ink-dim) below the existing tagline. `.hero-tagline` bottom margin shrunk 32→10 so the new line absorbs into the hero rhythm; subtagline's own 28px bottom margin preserves the original tagline-to-CTA gap of 38px. |
| ASC sport list | `.planning/phases/17-app-store-launch-readiness/17-APP-STORE-CONNECT-PREP.md:87` | Dropped UFC, added NHL, split "college" → "college basketball, college football", dropped "and more". Now matches the live ASC description committed in Tier 1 (`c4c2f5b`). |
| FAQ #5 copy | `landing.html:273` | "Web today. iOS app and Android home-screen install — pull up a seat from any device." Removes the now-misleading "Native App Store apps coming" — iOS native is the only App Store target per roadmap; Android stays PWA. |
| Press footer | `landing.html:306` | `mailto:press@couchtonight.app` added to `.landing-legal` row alongside Privacy/Terms/Support. Footer-only — not mirrored to `app.html`'s legal-footer (intentionally lean for in-app users). |

Lockstep bumps shipped in same commit: `APP_VERSION 38 → 39`, `sw.js CACHE → couch-v39-marketing-polish` (cache bump captured in follow-up commit `6160ad0`).

**Press mailto prereq — user action:** the `press@couchtonight.app` mailto will bounce until a Namecheap email forwarder (`press@` → `nahderz@gmail.com` or similar) is created. Claude can't touch Namecheap DNS; flag if not yet configured and either remove the footer entry or point at an existing inbox.

Live-prod verification via Chrome MCP: hero subtagline rendered, FAQ #5 updated, Press mailto present, `.hero-subtagline` CSS rule shipped.

### Should-fix items — ALL SHIPPED 2026-05-26

**Web batch (commit `4ba31c8` on couch, cache `couch-v40-shouldfix-web`):**

| Item | File | Result |
|---|---|---|
| Touch targets 24px → 44px min | `css/app.css:1542` `.lib-search-clear` | min-width/min-height 44px + inline-flex centering |
| Touch targets 32px → 44px min | `css/app.css:1589` `.swipe-header .close` | min-width/min-height 44px + inline-flex centering |
| Touch targets 30px → 44px min | `css/app.css:1844` `.queue-btn` | min-width/min-height 44px + inline-flex centering |
| Nested role="dialog" eliminated | `app.html:1026,1062,1101` (wait-up-picker, past-parties, svc-suggest inner panels) | Dropped role/aria-modal/aria-labelledby from inner — outer .modal-bg keeps the role per codebase convention |
| Signin-title H1 → brand logo | `app.html:164` + `css/app.css:2355` | H1 replaced with `<img class="brand-logo">` in same `.brand.large.brand-hero-large` wrapper used by other 6 entry screens. Orphaned `.signin-title` CSS rule removed. |
| Auth sign-in error toast | `js/auth.js` catch block (post-Tier-3 line ~135) | `flashToast` added on email-link sign-in failure ("Sign-in link is invalid or expired..."); was console.error only. `flashToast` added to existing utils.js import. |
| Tokenize hardcoded banner colors | `css/app.css` :root + `:2477` + `:2492` | 3 new tokens added in dedicated banner group (`--banner-bg-warm` / `--banner-border-mute` / `--banner-border-prompt`). Zero visual change — token values exactly match prior hex literals. |

**CF batch (commit `5125bf1` on queuenight, deployed via `firebase deploy --only functions:rsvpSubmit,functions:gameResultsTick`):**

| Item | File | Result |
|---|---|---|
| rsvpSubmit O(N) fallback cap | `functions/src/rsvpSubmit.js:146` | Added `.limit(50)` to `families.get()` in the legacy nested-path resolution. Phase 30 is months old so genuinely-legacy wps are all past the 25h archive window and return `{expired:true}` anyway — cap bounds worst-case fan-out (~5s ceiling) without changing semantics for typical accounts. |
| rsvpSubmit expiresAt re-submit | `functions/src/rsvpSubmit.js:237` | `expiresAt` now refreshed from current tx `expiresAt` on re-submit. Old behavior preserved the original, going stale if the host postponed wp.startAt — guests' rows would then expire before the wp itself. |
| gameResultsTick picksSettled guard | `functions/src/gameResultsTick.js:349` | `picksSettled` increment moved inside the existing `if (!pickNow.processedFirstAt)` guard to match picksTotal/lastPickAt pattern. Eliminates double-count on tick retry of already-processed picks. |

**Flagged for follow-up (NOT shipped):** `pointsTotal` at `gameResultsTick.js:348` has the same retry-double-count vulnerability that picksSettled HAD. The Should-fix handoff was scoped to picksSettled only, but pointsTotal is the user-visible leaderboard score and arguably matters more. Worth a separate look — would need to confirm tick retry behavior + transaction semantics before extending the guard.

Lockstep bumps shipped in same web commit: `APP_VERSION 39 → 40`, `sw.js CACHE → couch-v40-shouldfix-web` (cache bump captured in follow-up commit `df63206`).

## Action items for next session

**All engineering work is DONE.** Two user-side gates remain before Add for Review:

1. **User uploads new 01-tonight.png** to ASC (replace empty-state version with populated). Files at `app-store-screenshots/1284x2778/01-tonight.png` (or 1320×2868 for 6.9" if also that section).
2. **User creates Namecheap email forwarder** for `press@couchtonight.app` → existing inbox (footer mailto is live, will bounce until forwarder exists).

Shipped tier log (chronological):

3. ~~Tier 2: wire snapshotErrorHandler to 6 listeners + bump cache.~~ **SHIPPED 2026-05-26 — commits `90d4a58` + `59b4334`. Production: `couch-v37-listener-recovery`.**
4. ~~Tier 3: WKWebView prompt fallbacks + Apple in Account + dead-branch cleanup.~~ **SHIPPED 2026-05-26 — commits `7fb83fe` + `116060c`. Production: `couch-v38-wkwebview-prompts`.** (Bonus: Flow B compromise time picker also rewired — was a 3rd WKWebView prompt the original audit missed.)
5. ~~Tier 4: marketing polish (hero subtagline + FAQ #5 + footer + ASC sport list).~~ **SHIPPED 2026-05-26 — commits `0aea675` + `6160ad0`. Production: `couch-v39-marketing-polish`.**
6. ~~Should-fix: 5 web items + 3 CF items.~~ **SHIPPED 2026-05-26 — couch commit `4ba31c8` + `df63206` (production: `couch-v40-shouldfix-web`); queuenight commit `5125bf1` (rsvpSubmit + gameResultsTick CFs deployed scoped via `--only functions:rsvpSubmit,functions:gameResultsTick`).**

**Final step (user action):** After the screenshot is uploaded + press@ forwarder is created → switch ASC Release setting to MANUAL → click Add for Review.

## Synthesis report (durable record of all 75 findings)

See conversation transcript 2026-05-26. Key summary:
- 10 BLOCKER items (Tier 1 = first 8 now SHIPPED; remaining are #B3 prompt fixes, #B4 silent listeners — Tier 2-3)
- 16 SHOULD-FIX items (mostly Tier 4 + Should-fix items above)
- 5 STRENGTH items (don't touch: "Why we built it" backstory, privacy policy, voice consistency, "What's actually in it" restraint, App Reviewer Notes block)

## Resume signal for next session

**All four tiers + Should-fix are SHIPPED.** No engineering pickup required. If App Store review surfaces blockers, open a fresh session with the rejection notes; otherwise the next-session signal is post-launch (App Store approval received → switch to monitoring + post-launch backlog).

Production state: `couch-v40-shouldfix-web` live on hosting; `rsvpSubmit` + `gameResultsTick` CFs updated; Build 104 in TestFlight. **Submission gating items remaining (both user-side, no Claude work needed):** (a) screenshot re-upload (01-tonight.png populated version from `app-store-screenshots/1284x2778/01-tonight.png`), (b) Namecheap email forwarder for `press@couchtonight.app`. After both: switch ASC Release to MANUAL → Add for Review.
