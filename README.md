# Couch

A PWA that helps families decide what to watch — turning *"what do you want to watch?"* into a 30-second ritual everyone on the couch trusts.

Live: [https://couchtonight.app](https://couchtonight.app)

## What it is

- **Web app + installable PWA** at `/app`. Single HTML shell + ES-module JS, no bundler.
- **Marketing landing** at `/`. Zero-JS brochure page.
- **RSVP web route** at `/rsvp/<token>`. Lightweight, no app shell — non-members can RSVP without installing.
- **Changelog** at `/changelog`. Static history of releases.

Backend is Firebase (Firestore + Cloud Functions + Hosting + Storage + Auth) on project `queuenight-84044`. Movie metadata via TMDB. Optional watch-history sync via Trakt.

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend | Vanilla ES modules, no bundler, no framework |
| CSS | Single file with semantic-token design system (47 tokens, 3 layers) |
| Backend | Firebase Firestore (real-time family sync) |
| Auth | Firebase Auth (email + Google + phone) |
| Cloud Functions | Node.js 22 (2nd gen), us-central1 |
| Hosting | Firebase Hosting (custom domain via couchtonight.app) |
| 3rd-party data | TMDB REST v3, Trakt API |
| PWA | Service worker (sw.js), inline manifest, custom icons |

## Repository structure

```
.
├── app.html              # PWA app shell — all in-app screens
├── landing.html          # Marketing page at /
├── rsvp.html             # Zero-SDK RSVP page at /rsvp/<token>
├── changelog.html        # Static release history
├── 404.html              # Fallback page
├── sw.js                 # Service worker (offline shell + push)
├── robots.txt, sitemap.xml
├── css/
│   ├── app.css           # Main app stylesheet (~2900 lines, design tokens)
│   └── landing.css       # Landing page only
├── js/
│   ├── app.js            # All app feature logic (~10K lines)
│   ├── firebase.js       # Firebase init + exports
│   ├── constants.js      # TMDB key, packs data, RATING_TIERS, etc.
│   ├── state.js          # App state container
│   ├── utils.js          # escapeHtml, flashToast, haptic
│   └── discovery-engine.js
├── tests/                # Firestore rules tests (Firebase Emulator)
├── scripts/
│   └── stamp-build-date.cjs
├── firestore.rules       # Firestore security rules
└── .planning/            # Planning artifacts (GSD methodology)
    ├── PROJECT.md
    ├── ROADMAP.md
    ├── REQUIREMENTS.md
    ├── STATE.md
    ├── BRAND.md
    ├── LAUNCH-READINESS.md
    ├── TECH-DEBT.md
    └── phases/           # Per-phase plans + summaries + verifications
```

## Local development

There's no build step. Just open `app.html` in a browser, or serve the directory:

```bash
npx http-server .
```

For testing Firestore rules, use the Firebase Emulator:

```bash
cd tests
npm install
npm test
```

## Deploy

The `couchtonight.app` deploy mirror lives in a separate sibling directory (`../queuenight/`) outside this repo. It's not part of this codebase but contains:

- `public/` — the static files mirrored from this repo
- `functions/` — Cloud Function source
- `firebase.json`, `firestore.rules`, `storage.rules`

Deploy: mirror modified files to `queuenight/public/`, then:

```bash
cd ../queuenight
firebase deploy --only hosting --project queuenight-84044
```

For Cloud Functions or Storage rules:

```bash
firebase deploy --only "functions,storage" --project queuenight-84044
```

Bump `BUILD_DATE` and the `sw.js` `CACHE` constant before each release; the script `scripts/stamp-build-date.cjs` handles `BUILD_DATE` automatically:

```bash
node scripts/stamp-build-date.cjs
```

## Project methodology

Couch development follows **GSD (Get Shit Done)** — a structured planning + execution workflow with phase-by-phase requirements traceability. See `.planning/` for:

- `PROJECT.md` — product context + key decisions
- `ROADMAP.md` — phase-by-phase plan with success criteria
- `STATE.md` — current state + recent activity (the resume file)
- `phases/<NN>-<slug>/` — per-phase CONTEXT, plans, summaries, verifications

## Conventions

- **No bundler.** Don't add webpack/vite/rollup.
- **Public-by-design secrets.** TMDB API key + Firebase web config are in client source intentionally.
- **Mobile-first.** iOS Safari is the primary surface — test PWA install flow.
- **Atomic commits.** Each plan ships its own commit; commits include trace info to plan files.
- **Bump sw.js CACHE** on every user-visible change so installed PWAs invalidate.

## License

All rights reserved (for now). Open-sourcing TBD post-launch.
