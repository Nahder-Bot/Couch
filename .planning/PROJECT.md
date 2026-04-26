# Couch

## What This Is

Couch is a PWA for families (and small friend groups) to pick what to watch together — "Who's on the couch tonight?" — turning a 20-minute argument into a 30-second ritual. Members share a family code, the app picks who chooses, and TMDB-backed titles are filtered by everyone's preferences, providers, and moods. Deployed at couchtonight.app via Firebase Hosting; currently used by the author's family and a few invites, tracking toward a commercial release across web, iOS, and Android.

## Core Value

Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.

## Requirements

### Validated

<!-- Shipped and confirmed valuable — inferred from existing single-file app at couchtonight.app. -->

- ✓ **Shared family codes + join flow** — existing
- ✓ **Member profiles with names, ages, avatars** — existing
- ✓ **"Tonight" screen with member-selection ("who's on the couch")** — existing
- ✓ **Spin-picker that chooses whose turn it is** — existing
- ✓ **TMDB-backed catalog with posters, runtimes, ratings, trailers** — existing
- ✓ **Provider availability with stream / rent / buy buckets** — existing
- ✓ **"Hide what I can't watch" paid-services toggle** — existing
- ✓ **Yes / Maybe / No voting per title per member** — existing
- ✓ **Per-member queues (auto-populated from Yes votes on unwatched titles)** — existing
- ✓ **Trakt OAuth sync + import of watch history and ratings** — existing
- ✓ **Mood suggestions auto-derived from TMDB genres + runtime** — existing
- ✓ **Filter bar on Tonight screen (counts visible, collapsible)** — existing
- ✓ **PWA install support (manifest, iOS/Android icons, theme color)** — existing
- ✓ **Firestore real-time sync across devices in a family** — existing
- ✓ **Phase 3 — Mood tags:** inline mood editing in detail view; active-mood row outside collapsible panel; moodsUserEdited guard; MOOD-01 through MOOD-07 — Validated in Phase 3: 2026-04-20
- ✓ **Phase 14 — Decision Ritual Core:** already-watched filter (DECI-14-01), tier aggregators T1/T2/T3 (DECI-14-02), queue polish + Add-tab insertion (DECI-14-03), tile redesign + detail-modal extensions (DECI-14-04/05), V5 couch-viz roster-control (DECI-14-06; sketch 003 V5 — Roster IS the control), Flow A group rank-pick (DECI-14-07), Flow B solo-nominate + counter-time + auto-convert (DECI-14-08), intents collection + 4 push CFs (DECI-14-09), onboarding tooltips + 5 empty states + 7 push categories (DECI-14-10..13). Shipped v34.1-roster-control 2026-04-26 — Validated in Phase 14: 2026-04-26.

### Active

<!-- Scoped, awaiting kickoff. See ROADMAP.md for the authoritative list. -->
- [ ] **Phase 15 — Tracking Layer:** per-watching-group progress (not just per-individual; "watched Invincible S4 with wife + stepson, finished episode 8") + new-season air-date push notifs + live-release scheduling. Couch's differentiation vs Trakt: tracks GROUPS, not just members.
- [ ] **Phase 16 — Calendar Layer:** recurring + multi-future watchparty scheduling ("Wife and daughter watch American Idol every Monday"). New `watchpartySeries` doc primitive + week-view planning surface.
- [ ] **Phase 17 — App Store Launch Readiness:** native wrapper (Capacitor or PWABuilder) for iOS App Store + Google Play; Apple Sign-In wiring; App Store Connect listings + privacy policy + ToS authoring.

### Out of Scope

<!-- Explicit boundaries for this milestone. Revisit at milestone close. -->

- **Modularization / bundler / framework migration** — single-file `index.html` is deliberate for v1 (ease of deploy, iteration speed); post-v1 concern
- **Native rewrites (FlutterFlow, React Native, Swift)** — a FlutterFlow port is planned but lives post-v1; this milestone stays single-file web
- **Monetization wiring (paywall, billing, plan tiers)** — "free, figure out later"; no billing logic in this milestone
- **Public discovery / cross-family social feed** — Couch is family-scoped by design
- **Secrets hardening (moving TMDB key / Firebase config server-side)** — TMDB public API key and Firebase web config are public-by-design and acceptable for this milestone

## Context

**Technical environment:**
- Single `index.html` (~580KB) with inlined CSS and module-script JS, served from Firebase Hosting
- Firestore project `queuenight-84044` backs families, members, titles, votes, queues, watchparty sessions
- TMDB REST v3 for metadata, providers, videos, content ratings (~40 req/10s client rate limit; existing code paces fetches in phases)
- Trakt OAuth flow for watch-history sync, with a Cloud Functions endpoint exchanging auth codes
- PWA: manifest inline (data URL), icons at 16–512px, apple-touch-icon set, theme color `#14110f`

**Prior work / user signal:**
- Phases 1 and 2 already shipped (catalog, voting, basic Tonight flow) — reason this milestone starts at Phase 3
- Active users: the author's family plus a few invites. Feedback loop is direct (lived-in testing)
- Existing design system: "Warm · Cinematic · Lived-in. Restraint is the principle." Fraunces + Instrument Serif + Inter; warm dark palette

**Known in-code constraints:**
- TMDB rate-limiting handled by phased backfill loops in the catalog updater; any new feature pulling TMDB must respect the same budget
- Internal "phase 1/2/3/4" in the code refers to *catalog migration phases*, not product roadmap phases — do not conflate when reading source

## Constraints

- **Tech stack**: Single-file HTML + vanilla JS + Firebase + TMDB + Trakt — locked for v1. No bundlers, no framework, no module splitting.
- **Architecture**: All code stays in `index.html` through v1. Modularization is a post-v1 concern.
- **Deployment**: Firebase Hosting at couchtonight.app. Cloud Functions for Trakt OAuth only.
- **Platform reach**: Web is primary. iOS and Android app stores are commercial-release targets — PWA wrap likely before native rewrite.
- **Users**: Family + a few invites today. No public onboarding funnel this milestone; growth is invite-driven.
- **Monetization**: Free during this milestone. No billing or plan-tier code.
- **Security posture**: TMDB key and Firebase web config are public-by-design; not a concern.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Single-file `index.html` architecture preserved through v1 | Ease of deploy, fast iteration, FlutterFlow port planned post-v1 so modularization now would be wasted work | — Pending |
| TMDB API key and Firebase web config remain client-side | TMDB public API key is designed for client use; Firebase web config is public by design — moving them server-side adds ops cost with no security benefit | — Pending |
| Trakt sync via Cloud Functions OAuth exchange | Trakt requires a server-held secret for the token exchange; Cloud Functions is the smallest surface that fits | ✓ Good |
| Phases 3-6 are the v1 roadmap; phases 1-2 are shipped-and-validated | Product-phase numbering continues from prior work rather than resetting | — Pending |
| Release targets = web + iOS + Android | Commercial release spans all three; PWA-first keeps native decisions deferred | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-20 after Phase 3 (Mood Tags) completion*
