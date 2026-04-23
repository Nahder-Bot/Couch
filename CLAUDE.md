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
- **Service worker:** `sw.js` at repo root (added in the post-09-05 audit). Bump `CACHE` const on every user-visible app change so installed PWAs invalidate on next online activation. Current version: `couch-v19-phase9-rename`.
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
- ✓ Deploy by mirroring to `queuenight/public/` then `firebase deploy --only hosting`. Full file set: `app.html`, `landing.html`, `404.html`, `robots.txt`, `sitemap.xml`, `sw.js`, `css/`, `js/`. Cloud Functions deploy separately: `firebase deploy --only functions` from the sibling repo.
- ✓ When you ship a user-visible change that affects the app shell, bump `CACHE` in `sw.js` (current: `couch-v19-phase9-rename` → next: `couch-v20-{short-tag}`) so installed PWAs invalidate their cache on next online activation. Skipping this step is why iOS cache-bust procedure was previously needed for UATs.
- ✗ Don't introduce a bundler or build step — no webpack/vite/rollup
- ✗ Don't move TMDB key / Firebase config server-side
- ✗ Don't start monetization / billing / plan-tier work (explicitly Out of Scope)
- ✗ Don't renumber the product phases — GSD roadmap starts at Phase 3 on purpose
