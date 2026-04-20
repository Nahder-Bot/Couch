# Couch — Claude working notes

> This project uses **GSD (Get Shit Done)** for structured planning and execution.
> Planning artifacts live in `.planning/`. Always read the current state before proposing changes.

## Project context

**What it is:** PWA for families to pick what to watch together. "Who's on the couch tonight?" Deployed at couchtonight.app via Firebase Hosting.

**Full context:** `.planning/PROJECT.md` (read first)
**Active scope:** `.planning/REQUIREMENTS.md` — 25 v1 requirements across 4 phases
**Phase structure:** `.planning/ROADMAP.md` — Phase 3-6 (Phases 1-2 shipped pre-GSD)
**Current state:** `.planning/STATE.md`

## Architecture (locked for v1)

- **Modular JS (Phase 3.5+):** code is split across `index.html` (HTML shell, ~820 lines) + `css/app.css` + `js/` ES modules. Entry point is `js/app.js`. No bundler — Firebase Hosting serves files directly.
  - `js/firebase.js` — Firebase init, exports `db` + Firestore functions
  - `js/constants.js` — TMDB_KEY, Trakt config, COLORS, RATING_TIERS, MOODS, etc.
  - `js/state.js` — `state` object, `titlesRef`, `membersRef`, `familyDocRef`
  - `js/utils.js` — `escapeHtml`, `haptic`, `flashToast`, poster helpers
  - `js/app.js` — all feature logic (~8100 lines); imports from the above
- **Backend:** Firebase Firestore (project `queuenight-84044`) for real-time family sync; Cloud Functions only for the Trakt OAuth token exchange.
- **Third-party data:** TMDB REST v3 for metadata/providers; Trakt API for watch-history sync.
- **Delivery:** Firebase Hosting (deploy via `queuenight/` repo). PWA manifest + iOS/Android icon set already wired.

## ⚠ Token cost — read only what you need

`js/app.js` is ~8100 lines (~100K tokens). **Never read it in full.**
- `Grep` to locate a function first, then `Read(file, offset=N, limit=50)`
- `index.html` is now ~820 lines (HTML only) — safe to read in full
- `css/app.css`, `js/firebase.js`, `js/constants.js`, `js/state.js`, `js/utils.js` are all small (<200 lines) — read freely

## Conventions when editing JS modules

- **Catalog migration "phases":** code comments reference internal `Phase 1 / 2 / 3 / 4` — these are **TMDB catalog backfill stages**, not product roadmap phases. Do not conflate with the GSD product phases (3 Mood Tags, 4 Veto, 5 Watchparty, 6 Year-in-Review).
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
- ✓ Deploy by copying `index.html`, `css/`, `js/` to `queuenight/public/` then `firebase deploy`
- ✗ Don't introduce a bundler or build step — no webpack/vite/rollup
- ✗ Don't move TMDB key / Firebase config server-side
- ✗ Don't start monetization / billing / plan-tier work (explicitly Out of Scope)
- ✗ Don't renumber the product phases — GSD roadmap starts at Phase 3 on purpose
