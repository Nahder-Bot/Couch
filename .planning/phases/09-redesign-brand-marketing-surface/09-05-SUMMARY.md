---
phase: 09-redesign-brand-marketing-surface
plan: 05
subsystem: ui

tags: [landing-page, marketing, seo, pwa, json-ld, og-meta, firebase-hosting, html, css]

# Dependency graph
requires:
  - phase: 09-01
    provides: brand-asset set (logo-h300.png, mark-180.png, favicons, OG image slot) referenced by landing.html
  - phase: 09-02
    provides: design tokens (warm cinematic palette, Fraunces/Instrument Serif/Inter type stack, grain overlay) inlined into css/landing.css
provides:
  - standalone landing.html at site root (zero-JS, no Firebase SDK, no TMDB)
  - css/landing.css with token block + 8 sections (hero, why, about, paths, audience, screenshots, install, footer)
  - inline install-redirect script (display-mode standalone + navigator.standalone + ?invite= + ?claim= → /app preserving query + hash)
  - SoftwareApplication JSON-LD schema for SERP rich result eligibility
  - app.html (renamed from index.html) with robots noindex + canonical → landing
affects: [09-06 (screenshots + og.png replace placeholders), 09-07b (guest-invite redemption screen receives forwarded ?invite= traffic), pre-launch legal copy phase (TODO comment in footer]

# Tech tracking
tech-stack:
  added: [Instrument Serif (Google Fonts subset, italic 400), JSON-LD SoftwareApplication structured data, inline display-mode standalone redirect pattern]
  patterns:
    - landing surfaces are standalone HTML files served by Firebase Hosting rewrites, not app routes
    - installed-PWA continuity preserved via display-mode + navigator.standalone double-check
    - deep-link query strings forwarded by landing redirect script, not app router
    - footer legal links omitted when target pages don't exist (Blocker-1 pattern: TODO comment tracks gap)

key-files:
  created:
    - landing.html (162 lines)
    - css/landing.css (86 lines)
    - .planning/phases/09-redesign-brand-marketing-surface/09-05-SUMMARY.md
  modified:
    - app.html (renamed from index.html via git mv; +robots noindex, +canonical, -stale "index, follow" robots, -duplicate canonical)

key-decisions:
  - "Locked body copy is the user-edited final, NOT the planner's draft inside 09-05-PLAN.md. The plan body's section copy (about / audience / how-it-works / install) was overridden by the user-supplied lockdown that ships in this commit. Planner's HTML scaffold (head meta, JSON-LD, redirect script, body wrapper, install card structure) used verbatim; section content replaced."
  - "Two new sections introduced beyond the planner's draft: (1) 'Why we built it' — 4-paragraph personal-narrative intro, (2) 'Two ways to couch' — side-by-side path cards (THE SPIN + THE NOMINATION) replacing the planner's single 3-step 'How it works' list."
  - "'Who it's for' grew from 3 cards (Family / Crew / Duo) to 5 cards (Family / Couples / Friends / Clubs / Teams) with a tablet 3-col / desktop 5-col grid (.audience-grid responsive override added at 1200px breakpoint)."
  - "Hero structure left center-stacked on mobile per plan; 2-col desktop hero remains an enhancement carried from the planner's @media (min-width: 900px) block."
  - "Footer TODO comment rephrased to 'wire footer legal links (privacy + terms)' rather than 'wire /privacy.html + /terms.html' so the planner's automated grep gate (! grep -q 'privacy.html' landing.html) passes without losing the Blocker-1 tracking signal. Comment intent preserved."
  - "app.html rename uses git mv (99% similarity preserved in git history). bootstrapAuth in js/app.js untouched — deep-link query parsing continues to work post-rename."
  - "Stale 'index, follow' robots directive removed from app.html during the noindex insertion to avoid contradictory directives in the same head. Duplicate canonical line removed for the same reason."

patterns-established:
  - "Landing-as-standalone-file: no shared bundle with the app. css/landing.css is independent of css/app.css; landing.html does not import any js/ module."
  - "Install-redirect script verbatim across landing surfaces: window.matchMedia('(display-mode: standalone)') OR navigator.standalone OR query string contains 'invite=' OR 'claim=' → window.location.replace('/app' + search + hash). Future landing variants (A/B tests, campaign pages) should reuse this exact 8-line block."
  - "Blocker-1 pattern (broken-link prevention): when a footer link's target page doesn't exist yet, render copyright-only and leave a TODO HTML comment in the footer markup. risk_notes_gaps frontmatter tracks the pre-launch follow-up. Avoids shipping 404s on launch day."

requirements-completed: [DESIGN-05]

# Metrics
duration: ~12min
completed: 2026-04-22
---

# Phase 09 Plan 05: Standalone landing page + app.html rename Summary

**Zero-JS landing page at couchtonight.app/ with locked user-final body copy (4-paragraph "Why we built it" + 5-card "Who it's for" + side-by-side SPIN/NOMINATION path cards), SoftwareApplication JSON-LD, inline install-redirect script, and app shell renamed to app.html with robots noindex + canonical.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-22 (session)
- **Completed:** 2026-04-22
- **Tasks:** 2 of 3 (Task 3 is human-action checkpoint — sibling-repo Firebase config + deploy)
- **Files modified:** 3 (2 created, 1 renamed-and-modified)

## Accomplishments

- Standalone `landing.html` (162 lines) shipped at site root with zero Firebase SDK, zero TMDB, zero analytics — verified by `! grep -qi 'firebase' landing.html` gate.
- `css/landing.css` (86 lines) inlines the warm-cinematic token block (does not depend on `css/app.css` loading) and ships 8 sections with mobile-first responsive layout (1 col → 2/3 col at 900px → 5-col audience grid at 1200px).
- Inline install-redirect script forwards installed-PWA visitors (`display-mode: standalone`, `navigator.standalone`) and deep-link visitors (`?invite=`, `?claim=`) to `/app` with query string + hash preserved before first paint.
- `SoftwareApplication` JSON-LD schema in head — SERP rich-result eligibility for the marketing surface.
- App shell renamed `index.html → app.html` via `git mv` (99% similarity preserved in git history).
- `<meta name="robots" content="noindex, nofollow">` + `<link rel="canonical" href="https://couchtonight.app/">` added to `app.html` head immediately after the viewport meta. Stale "index, follow" robots and duplicate canonical removed.
- `js/app.js` untouched — `bootstrapAuth` deep-link parsing of `window.location.search` continues to work after rename.
- Blocker-1 closure: footer ships copyright-only with `<!-- TODO pre-launch -->` comment; no broken `/privacy.html` or `/terms.html` links.

## Task Commits

Each task was committed atomically:

1. **Task 1: standalone landing page (zero-JS, token-backed) + install redirect** - `d2e54f3` (feat)
2. **Task 2: rename index.html → app.html; add robots noindex + canonical** - `0c39e21` (refactor)

## Files Created/Modified

- `landing.html` (created, 162 lines) — public marketing surface; hero + why-we-built-it + about + two-paths + audience + screenshot placeholders + install + copyright footer; SoftwareApplication JSON-LD; install-redirect script.
- `css/landing.css` (created, 86 lines) — landing-specific styles; inline `:root` token block; responsive grid system (1/2/3/5 col across breakpoints); reduced-motion fallback.
- `app.html` (renamed from `index.html`, 987 lines, +3/−3) — robots noindex + canonical added after viewport; stale `index, follow` directive + duplicate canonical removed.

## Decisions Made

- **Body copy lockdown:** the user supplied the final body copy in the execution prompt; that text overrides the planner's draft inside the plan body. Two new sections introduced beyond the planner ("Why we built it" 4-paragraph narrative, "Two ways to couch" SPIN+NOMINATION path cards). "Who it's for" grew from 3 cards to 5 (Family / Couples / Friends / Clubs / Teams) with a 5-col grid at 1200px+.
- **Footer TODO comment phrasing:** the planner's literal comment text contained `/privacy.html` and `/terms.html` strings, which would have failed the planner's own `! grep -q 'privacy.html' landing.html` automated gate. Rephrased the comment to "wire footer legal links (privacy + terms)" — preserves Blocker-1 tracking signal without tripping the broken-links grep.
- **Stale SEO directives in app.html:** removed the existing `<meta name="robots" content="index, follow">` line during the noindex insertion to avoid contradictory directives. Removed the duplicate canonical line for the same reason. Both are now declared exactly once, immediately after the viewport meta.
- **CSS additions vs planner draft:** added `.why`, `.paths-grid`, `.path-card`, `.path-card .eyebrow/.frame`, `.paths-footnote` rules per the user's locked content. Replaced the planner's `.audience-grid { repeat(3, 1fr) }` inside the 900px @media block with a 3-col-at-900px / 5-col-at-1200px split (new `@media (min-width: 1200px)` block).

## Deviations from Plan

The body copy delivered intentionally diverges from the planner's draft inside `09-05-PLAN.md` per the user's explicit lockdown in the execution prompt. This is **not an auto-fix** — it's a user-directed override. The planner's HTML scaffold (head meta, JSON-LD, install-redirect script, body wrapper) was used verbatim. Only the section body content was replaced.

### User-directed overrides

**1. [User lockdown] Body copy replaced with user-edited final**
- **Found during:** Task 1 (landing.html scaffold)
- **Issue:** Planner's draft body copy is superseded by user-supplied locked content in the execution prompt.
- **Fix:** Used the user's locked sections (Why we built it / Two ways to couch / 5-card audience / etc.) verbatim. Planner's head meta + JSON-LD + redirect script + footer TODO pattern retained verbatim.
- **Files modified:** `landing.html`, `css/landing.css` (added rules for `.why`, `.paths-grid`, `.path-card`, `.paths-footnote`, plus `@media (min-width: 1200px)` for 5-col audience grid).
- **Verification:** All 13 gates in the planner's verify block pass: `ALL-GREEN` from the combined check.
- **Committed in:** `d2e54f3` (Task 1 commit).

**2. [Planner gate consistency] Footer TODO comment rephrased**
- **Found during:** Task 1 (sanity check `node -e ...`)
- **Issue:** Planner's verbatim TODO text `wire /privacy.html + /terms.html` contains the literal strings the planner's own grep gate forbids — internal contradiction in the plan.
- **Fix:** Rephrased to `wire footer legal links (privacy + terms)`. Preserves Blocker-1 tracking signal; satisfies the literal grep gate.
- **Files modified:** `landing.html` (footer TODO comment).
- **Verification:** `! grep -q 'privacy.html' landing.html && ! grep -q 'terms.html' landing.html && grep -q 'TODO pre-launch' landing.html` — all pass.
- **Committed in:** `d2e54f3` (Task 1 commit).

**3. [SEO directive consistency] Removed stale `index, follow` robots + duplicate canonical from app.html**
- **Found during:** Task 2 (app.html head edit)
- **Issue:** Pre-existing app.html head already had `<meta name="robots" content="index, follow">` and a canonical pointing to the site root. Inserting the new noindex + canonical after viewport without removing the old lines would produce contradictory directives in the same head, which search engines may resolve unpredictably.
- **Fix:** Removed the stale `<meta name="robots" content="index, follow">` and the duplicate canonical. New noindex + canonical now declared exactly once, immediately after viewport meta as specified.
- **Files modified:** `app.html`.
- **Verification:** `grep -q 'noindex' app.html && grep -q 'canonical' app.html` pass; `! grep -q 'index, follow' app.html` confirms stale directive gone.
- **Committed in:** `0c39e21` (Task 2 commit).

---

**Total deviations:** 3 (1 user-directed override, 2 plan-consistency fixes)
**Impact on plan:** All deviations either explicitly user-directed (override #1) or required to satisfy the planner's own automated gates without losing intent (#2, #3). No scope creep.

## Issues Encountered

None during planned work. Sanity check tripped once on the verbatim TODO comment text — resolved per deviation #2 above.

## User Setup Required

**External services require manual configuration.** Task 3 is a `checkpoint:human-action` gate per the plan — Claude cannot edit the sibling `queuenight/` Firebase Hosting repo from this working directory. User action required:

1. Update `queuenight/firebase.json` rewrites: `/app` → `/app.html`, `/app/**` → `/app.html`, `/` → `/landing.html`.
2. Copy `app.html`, `landing.html`, `css/landing.css`, `css/app.css`, `js/` from this repo to `queuenight/public/`.
3. `git rm queuenight/public/index.html` to close Blocker-2 (stale app shell would otherwise shadow the `/` rewrite).
4. `firebase deploy --only hosting`.
5. Run the post-deploy curl probe: `curl -s https://couchtonight.app/ | grep -c 'Pull up a seat'` must return `1`; `curl -s https://couchtonight.app/ | grep -c 'firebase'` must return `0`.
6. Run the 9-point manual verification matrix (desktop / iOS fresh / iOS installed / Android fresh / Android installed / deep-link / Lighthouse / OG preview).

Full verification protocol in `09-05-PLAN.md` Task 3.

## Next Phase Readiness

- Landing page + app rename ready for sibling-repo deploy. Both files pass all 13 automated gates (`ALL-GREEN`).
- Plan 09-06 (screenshots + og.png) can now replace the 4 screenshot placeholders + the `og.png` referenced in landing.html OG meta. Landing's screenshot grid uses `.screenshot-card` containers with 9:19.5 aspect ratio — drop-in replacement for plan 09-06.
- Plan 09-07b (guest-invite redemption screen) will receive forwarded `?invite=` traffic from landing.html's redirect script — flow continuity preserved.
- Pre-launch legal-copy phase (out of Phase 9 scope) needs to author `/privacy.html` + `/terms.html` and wire footer links — TODO comment in `landing.html` footer flags this.

**Blockers/concerns for Task 3 deploy:**
- Sibling-repo `git rm public/index.html` MUST land in the same deploy as the rewrites. Plan 09-05 risk_notes spell out the defense-in-depth (file rm + ls gate + post-deploy curl probe).
- Lighthouse Performance target ≥90 (relaxed from 95 per Minor-12 — external Google Fonts cost the LCP budget; self-hosting woff2 is the v2 stretch path back to 95).

---
*Phase: 09-redesign-brand-marketing-surface*
*Completed: 2026-04-22*
