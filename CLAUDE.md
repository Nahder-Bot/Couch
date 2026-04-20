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

- **Single file:** all code lives in `index.html` (~580KB, CSS + module-script JS inlined). Do not propose modularization, bundlers, or framework migration — those are explicitly Out of Scope.
- **Backend:** Firebase Firestore (project `queuenight-84044`) for real-time family sync; Cloud Functions only for the Trakt OAuth token exchange.
- **Third-party data:** TMDB REST v3 for metadata/providers; Trakt API for watch-history sync.
- **Delivery:** Firebase Hosting. PWA manifest + iOS/Android icon set already wired.

## ⚠ CRITICAL — index.html is 580KB (~145K tokens)

**NEVER read index.html in full.** Always use targeted reads:
- `Read(file, offset=N, limit=50)` — read only the lines you need
- `Grep` to locate a function or pattern first, then read ±30 lines around it
- GSD plan files embed exact line numbers and code snippets — use those, don't re-read the file to verify them

A single full read of index.html costs as much as the entire rest of a phase's context. If you catch yourself about to `Read("index.html")` with no offset, stop and use Grep first.

## Conventions when editing `index.html`

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
- ✓ Preserve single-file architecture through v1
- ✓ Write atomic Firestore updates; respect existing per-family nesting
- ✓ Test on mobile Safari (PWA + iOS home-screen use is the primary surface)
- ✗ Don't split `index.html` into modules or introduce a bundler
- ✗ Don't move TMDB key / Firebase config server-side
- ✗ Don't start monetization / billing / plan-tier work (explicitly Out of Scope)
- ✗ Don't renumber the product phases — GSD roadmap starts at Phase 3 on purpose
