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
- ✓ **Phase 3 — Mood tags:** inline mood editing in detail view; active-mood row outside collapsible panel; moodsUserEdited guard; MOOD-01 through MOOD-07 — Validated 2026-04-20.
- ✓ **Phase 4 — Veto System:** pre/post-spin vetoes (VETO-01..06) with real-time multi-device sync, fairness rule preventing vetoer-becomes-spinner — Validated 2026-04-20.
- ✓ **Phase 5 — Auth + Groups:** Firebase Auth (Google + Email-link + Phone) + 6 Cloud Functions (setGroupPassword + joinGroup + claimMember + mintClaimTokens + inviteGuest + transferOwnership) live in us-central1; uid-stamped writes; auth-aware Firestore rules — Validated 2026-04-22 (15.2 backfilled VERIFICATION.md).
- ✓ **Phase 6 — Push Notifications:** web-push delivery, per-event opt-in via notificationPrefs, quiet hours, self-echo guard — Validated 2026-04-21.
- ✓ **Phase 7 — Watchparty:** live shared session + reactions (emoji + text) + participant strip + sport/movie modes + per-receiver render filter (later extended by 15.5 Wait Up) — Validated 2026-04-22.
- ✓ **Phase 8 — Watch-Intent Flows:** schedule-watch + interest-per-title + 4 push CFs for matched intents — Validated 2026-04-22.
- ✓ **Phase 9 — Redesign / Brand / Marketing:** 47-token semantic alias layer (1840 var(--…) uses), inline-style purge (119→36), desktop responsive, landing page at /, BRAND.md (185 lines). DESIGN-02..10 closed; DESIGN-01 (SVG logo) deferred to Phase 15.3 — Validated 2026-04-24 (passed_partial).
- ✓ **Phase 11 — Feature refresh & streamline:** 8 plans / 13 REFR-* requirements; photo upload, Couch history, member-archived state, queue polish — Validated 2026-04-24.
- ✓ **Phase 12 — Pre-launch polish:** POL-01..04 (notification prefs UI, about+changelog, pack curation); 8/8 smoke tests — Validated 2026-04-25.
- ✓ **Phase 13 — Compliance & Ops Sprint:** self-serve account deletion (4 CFs), BUILD_DATE auto-stamp, CSP Report-Only, Sentry, GitHub branch protection — Validated 2026-04-25.
- ✓ **Phase 14 — Decision Ritual Core:** already-watched filter (DECI-14-01), tier aggregators T1/T2/T3 (DECI-14-02), queue polish + Add-tab insertion (DECI-14-03), tile redesign + detail-modal extensions (DECI-14-04/05), V5 couch-viz roster-control (DECI-14-06), Flow A group rank-pick (DECI-14-07), Flow B solo-nominate + counter-time + auto-convert (DECI-14-08), intents collection + 4 push CFs (DECI-14-09), onboarding tooltips + 5 empty states + 7 push categories (DECI-14-10..13). Shipped v34.1-roster-control 2026-04-26 — Validated 2026-04-26.
- ✓ **Phase 15 — Tracking Layer:** per-watching-group progress (vs Trakt's per-individual), tuple primitive ("Nahder + Ashley"), tuple WRITE/READ helpers, S6 mute, S3 inline-rename, S5 Trakt opt-in disclosure, S1 cross-show pickup widget, new-season air-date push, live-release scheduling — Validated 2026-04-27.
- ✓ **Phase 15.1 — Security Hardening:** closed F-OPEN-01 HIGH (`t.progress[X].source` forgeable), WR-02 HIGH (regex injection), F-OPEN-02 MEDIUM (`tupleNames` write-scope), WR-03 MEDIUM (rules-test coverage). 38 rules-tests passing — Validated 2026-04-27.
- ✓ **Phase 15.2 — Audit-trail backfill + project hygiene:** 5 retroactive VERIFICATION.md files (Phases 5/6/7/8/9), 10 missing SUMMARYs backfilled, REQUIREMENTS.md traceability refresh (Coverage 81%) — Validated 2026-04-27.
- ✓ **Phase 15.4 — Integration polish — push fan-out + Settings parity:** F-W-1 sendCouchPing real-fan-out via new onCouchPingFire CF (was UX lie since 14-10) + D-3 9-key friendly-UI Settings parity. POL-01 partial → satisfied — Validated 2026-04-29.
- ✓ **Phase 15.5 — Wait Up flex:** 0-24hr reaction-delay range via storage-layer 86400 clamp + sport-mode slider step ramp via positionToSeconds + movie-mode 8-chip ladder + Custom… picker bottom sheet + cross-repo CF reaction-content stripping per receiver + Tonight 5h cutoff + Past parties tall-sheet — Validated 2026-04-28.
- ✓ **Phase 18 — Availability Notifications:** daily-cadence scheduled `providerRefreshTick` CF watches t.providers[] for queued unwatched titles, fans out push to family members whose m.services intersects newly-added brands. "Dune just hit Max for your household." Manual "↻ Refresh availability" affordance + "Provider data via TMDB" attribution — Validated 2026-04-29.

### Active

<!-- Scoped, awaiting kickoff. See ROADMAP.md for the authoritative list. -->
- [ ] **Phase 15.3 — DESIGN-01 SVG logo + wordmark:** closes the only genuinely unsatisfied requirement from v33.3 audit (canonical SVG source never produced; PNGs wired to manifest but rebuild-from-source impossible). 3-task production phase. Per cross-AI review 2026-04-28: deferred until App Store work is imminent.
- [ ] **Phase 16 — Calendar Layer:** recurring + multi-future watchparty scheduling ("Wife and daughter watch American Idol every Monday"). Per cross-AI review 2026-04-28: defer until usage signal proves recurring scheduling is felt-pain (calendars are expensive UX; families already have calendars).
- [ ] **Phase 17 — App Store Launch Readiness:** native wrapper (Capacitor/PWABuilder) for iOS App Store + Google Play; Apple Sign-In ($99/yr Apple Developer Program); App Store Connect listings + privacy policy + ToS authoring. Per user 2026-04-29: deferred to next milestone (this milestone stays PWA-only).

### Backlog (cross-AI flagged 2026-04-28; ranked by Tier)

- [ ] **Kid mode / age-gating** (Tier 2 — flagged by Gemini + Codex independently as P0 for the "family" brand): global "Kids on the couch" toggle that filters Tonight to G/PG; parent-approved pools; bedtime/runtime limits. Today the per-member age-tier rating cap exists but no global mode.
- [ ] **Decision explanation** (Tier 2 — Codex): "why did the spin pick this?" — small explanation layer ("Ashley + Nahder said yes, on Hulu, 112 min") to reduce distrust on the matches/spin surface.
- [ ] **Conflict-aware empty state** (Tier 2 — Codex): when Tonight matches is empty, surface WHY (no overlap / provider unavailable / runtime / rating-filtered) instead of generic "No matches yet".
- [ ] **Custom lists as family memory** (Tier 2 — Codex): "Dad's picks", "Holiday queue", "Movies the kids can watch". Reframed from Letterboxd feature to family-memory primitive.
- [ ] **Async-replay** (Tier 3 — natural follow-on to 15.5 if Wait Up earns its keep): "Red Wedding" use case — feel original group's reactions days/weeks/years later. Risk: emotionally creepy if reactions appear out of context.
- [ ] **Solo mode on-ramp** (Tier 3 — both AIs say defer): 50% addressable market expansion, but plural-brand dilution risk.
- [ ] **Phase 10 — Year-in-Review** (Tier 3 — already deferred): needs accumulated history + audience to feel substantive. Revisit at v1 milestone close + ~3 months usage data.

### Out of Scope

<!-- Explicit boundaries for this milestone. Revisit at milestone close. -->

- **Modularization / bundler / framework migration** — single-file `index.html` is deliberate for v1 (ease of deploy, iteration speed); post-v1 concern
- **Native rewrites (FlutterFlow, React Native, Swift)** — a FlutterFlow port is planned but lives post-v1; this milestone stays single-file web
- **Monetization wiring (paywall, billing, plan tiers)** — "free, figure out later"; no billing logic in this milestone
- **Public discovery / cross-family social feed** — Couch is family-scoped by design
- **Secrets hardening (moving TMDB key / Firebase config server-side)** — TMDB public API key and Firebase web config are public-by-design and acceptable for this milestone

## Context

**Technical environment:**
- Two HTML surfaces (post-09-05): `app.html` (~990 lines, PWA app shell at `/app`) and `landing.html` (~160 lines, marketing page at `/`); modular `js/` (~16k lines in `js/app.js` post-15.5; firebase + constants + state + utils as siblings); `css/app.css` (~2360 lines) and `css/landing.css` (~86 lines). Service worker at `sw.js`. Served from Firebase Hosting via deploy-mirror sibling repo (`couch-deploy/`, formerly `queuenight/`)
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
*Last updated: 2026-04-29 — refreshed after a 9-day burst (Phases 4 / 5 / 6 / 7 / 8 / 9 / 11 / 12 / 13 / 14 / 15 / 15.1 / 15.2 / 15.4 / 15.5 / 18 all shipped to production). Backlog populated from cross-AI feature audit 2026-04-28 (Gemini + Codex). v1 milestone now sits at 14/16 phases shipped (100% of currently-scoped plans complete); 15.3 / 16 / 17 remain scoped-but-deferred per stated priorities.*
