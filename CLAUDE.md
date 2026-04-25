# Couch — Claude working notes

> This project uses **GSD (Get Shit Done)** for structured planning and execution.
> Planning artifacts live in `.planning/`. Always read the current state before proposing changes.

## Project context

**What it is:** PWA for families to pick what to watch together. "Who's on the couch tonight?" Deployed at couchtonight.app via Firebase Hosting.

**Full context:** `.planning/PROJECT.md` (read first)
**Active scope:** `.planning/REQUIREMENTS.md` — 51 v1 requirements across 8 GSD phases
**Phase structure:** `.planning/ROADMAP.md` — Phase 3-10 (Phases 1-2 shipped pre-GSD; Phases 3, 4, 5, 7, 8 COMPLETE; Phase 6 UAT partial; Phase 9 in progress; Phase 10 pending)
**Current state:** `.planning/STATE.md`

**Post-Phase 9 routing (live at couchtonight.app):** `/` serves `landing.html` (marketing page, zero-JS), `/app` serves `app.html` (PWA app shell). Firebase Hosting rewrites in `queuenight/firebase.json`. Deep links (`?invite=`, `?claim=`) arrive at `/`, landing's inline redirect forwards them to `/app` preserving query string.

## Architecture (locked for v1)

- **Two HTML surfaces (Post-09-05):** `app.html` (~990 lines, the PWA app shell — all in-app screens) and `landing.html` (~160 lines, the marketing page at `/`). Both at repo root. The pre-Phase-9 `index.html` was renamed to `app.html` in commit `0c39e21`.
- **Modular JS (Phase 3.5+):** code is split across `app.html` (HTML shell) + `css/app.css` + `js/` ES modules. Entry point is `js/app.js`. No bundler — Firebase Hosting serves files directly.
  - `js/firebase.js` — Firebase init, exports `db` + Firestore functions
  - `js/constants.js` — TMDB_KEY, Trakt config, COLORS, RATING_TIERS, MOODS, etc.
  - `js/state.js` — `state` object, `titlesRef`, `membersRef`, `familyDocRef`
  - `js/utils.js` — `escapeHtml`, `haptic`, `flashToast`, poster helpers
  - `js/app.js` — all feature logic (~10200 lines); imports from the above
- **CSS:** `css/app.css` (~2360 lines; warm-dark design system, 47-token semantic alias layer from 09-02, Phase 9/DESIGN-03 utility classes ~line 2210, desktop `@media (min-width:900px)` block ~line 2330) + `css/landing.css` (~86 lines; standalone for the marketing page).
- **Service worker:** `sw.js` at repo root (added in the post-09-05 audit). Bump `CACHE` const on every user-visible app change so installed PWAs invalidate on next online activation. Current version: `couch-v33.3-sentry-dsn` (auto-bumped via `bash scripts/deploy.sh <short-tag>`; see RUNBOOK §H).
- **Backend:** Firebase Firestore (project `queuenight-84044`) for real-time family sync; Cloud Functions in sibling `queuenight/functions/` for push notifications (watchparty + intent + veto) and Trakt OAuth token exchange.
- **Third-party data:** TMDB REST v3 for metadata/providers; Trakt API for watch-history sync.
- **Delivery:** Firebase Hosting (deploy via sibling `queuenight/public/` mirror). PWA manifest inline as data URL in app.html. iOS/Android icon set wired.

## ⚠ Token cost — read only what you need

`js/app.js` is ~10200 lines (~120K tokens). **Never read it in full.**
- `Grep` to locate a function first, then `Read(file, offset=N, limit=50)`
- `app.html` is ~990 lines (HTML only) — safe to read in full if needed
- `landing.html` (~160 lines), `css/landing.css` (~86 lines), `sw.js` (~105 lines), `404.html`, `robots.txt`, `sitemap.xml` — all tiny, read freely
- `css/app.css` is ~2360 lines; prefer Grep + offset/limit over full Read
- `js/firebase.js`, `js/constants.js`, `js/state.js`, `js/utils.js` — all small (<200 lines), read freely

## Conventions when editing JS modules

- **Catalog migration "phases":** code comments reference internal `Phase 1 / 2 / 3 / 4` — these are **TMDB catalog backfill stages**, not product roadmap phases. Do not conflate with the GSD product phases (3 Mood Tags, 4 Veto, 5 Auth+Groups, 6 Push, 7 Watchparty, 8 Watch-Intent Flows, 9 Redesign/Brand, 10 Year-in-Review).
- **TMDB rate limits:** ~40 requests / 10 seconds. Any new TMDB-dependent feature must budget for this — existing code uses phased backfill loops. Respect the pattern.
- **Firestore schema:** families, members, titles, votes, queues, and watchparty sessions live under the family doc. New data shapes should follow the same per-family nesting.
- **Design system:** Fraunces + Instrument Serif + Inter; warm dark palette (`#14110f` theme color). "Warm · Cinematic · Lived-in. Restraint is the principle." Brand moments get theatrical treatment; everything else recedes.
- **Public-by-design secrets:** TMDB API key and Firebase web config are embedded in client source intentionally. Do not "fix" this.

## Phase numbering + scope safeguards

- **Before reassigning a phase number's scope, check `.planning/seeds/` for any locked scope referencing that number.** When the user says "let's do Phase N" or "make Phase N about X," grep `.planning/seeds/` for phase-number mentions FIRST and surface what would be displaced. Confirm with user before promoting new content into the slot.
- **Seed-file naming convention:** describe CONTENT, not phase numbers (e.g. `decision-ritual-locked-scope.md`, NOT `phase-13-14-15-decision-ritual.md`). The active ROADMAP.md maps phase number → seed file; the seed file should never claim a phase number it might lose.
- **When a phase slot IS reassigned**, append a row to ROADMAP.md's "Phase-slot history" section recording (date, slot, original scope, new scope, where the displaced scope now lives) and rename any seed files whose names reference the old number.
- This convention exists because on 2026-04-25 the Phase 13 slot was reassigned from "Decision Ritual Core" to "Compliance & Ops Sprint" without an audit-trail entry, and the displaced scope was nearly forgotten. See ROADMAP.md "Phase-slot history" for the full incident.

## GSD workflow reminders

- Run `/gsd-progress` to see where we are before doing anything
- Run `/gsd-plan-phase N` to plan Phase N (researcher + planner + plan-checker)
- Run `/gsd-execute-phase N` to execute an approved plan
- Run `/gsd-verify-work` to confirm a phase delivered its success criteria
- Each workflow commits atomically — artifacts survive context loss
- Config is in `.planning/config.json`: YOLO mode, standard granularity, parallel execution, git tracking on, research + plan check + verifier all enabled, balanced model profile

## Do / Don't

- ✓ Read `.planning/PROJECT.md` and `.planning/ROADMAP.md` before proposing work
- ✓ Write atomic Firestore updates; respect existing per-family nesting
- ✓ Test on mobile Safari (PWA + iOS home-screen use is the primary surface)
- ✓ Deploy via `bash scripts/deploy.sh [<short-tag>]` from couch repo root (Phase 13 / OPS-13-02). Script handles BUILD_DATE auto-stamp + optional `sw.js` CACHE bump + Sentry DSN guard + mirror to `queuenight/public/` + `firebase deploy --only hosting`. Cloud Functions deploy separately: `firebase deploy --only functions` from the sibling `queuenight/` repo. See RUNBOOK §H for the canonical deploy walkthrough.
- ✓ When you ship a user-visible change that affects the app shell, bump `CACHE` in `sw.js` (auto-bumped if you pass a short-tag arg to `deploy.sh`, e.g. `bash scripts/deploy.sh 33.4-fix`). Skipping this step is why iOS cache-bust procedure was previously needed for UATs.
- ✗ Don't introduce a bundler or build step — no webpack/vite/rollup
- ✗ Don't move TMDB key / Firebase config server-side
- ✗ Don't start monetization / billing / plan-tier work (explicitly Out of Scope)
- ✗ Don't renumber the product phases — GSD roadmap starts at Phase 3 on purpose
