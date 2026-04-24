# Requirements: Couch

**Defined:** 2026-04-19
**Core Value:** Turn "what do you want to watch?" from a 20-minute argument into a 30-second ritual that everyone on the couch trusts.

> **Brownfield note:** Phases 1 and 2 shipped prior to GSD adoption. Their capabilities are captured under **Validated** in PROJECT.md. This file scopes **v1 Requirements** to Phase 3-6 work (the remaining milestone toward commercial release).

## v1 Requirements

### Mood Tags (Phase 3)

- [x] **MOOD-01**: User can view automatically-suggested moods on a title (derived from TMDB genres + runtime)
- [x] **MOOD-02**: User can add a personal mood tag to a title from the title's detail view
- [x] **MOOD-03**: User can remove a personal mood tag they previously added
- [x] **MOOD-04**: Mood tags added by any member in a family are visible to all members on that title
- [x] **MOOD-05**: Tonight screen shows a mood filter control in the filter bar
- [x] **MOOD-06**: Selecting one or more moods in the filter narrows the candidate pool for the spin
- [x] **MOOD-07**: Active mood filters are visible and easily clearable without opening the filter panel

### Veto System (Phase 4)

- [x] **VETO-01**: Any member can veto a title before the spin, removing it from the candidate pool for that session
- [x] **VETO-02**: Any member can veto the spin result after it's picked, triggering a re-spin from the remaining pool
- [x] **VETO-03**: When a veto happens, all devices in the family see it in real-time with who vetoed
- [x] **VETO-04**: Veto can carry an optional reason (short text) so the family has context
- [x] **VETO-05**: Vetoes are recorded per-member so they can surface in Year-in-Review
- [x] **VETO-06**: A member who vetoed a title cannot be the one to re-spin it for that same session (fairness rule)

### Auth + Groups (Phase 5)

Skeleton — refined in /gsd-discuss-phase 5.

- [ ] **AUTH-01**: A user can create an account and sign in (provider TBD in discuss — likely Firebase Auth with Google + Apple + email link)
- [ ] **AUTH-02**: A family can be created, joined, or left by a signed-in user; every Firestore member write carries a stable `uid`
- [ ] **AUTH-03**: A family owner can optionally set a password on the group; joining a password-protected group requires the password in addition to any invite code
- [ ] **AUTH-04**: Existing families (created pre-auth with code-only + local member profiles) can complete a one-time claim flow that links each current member to a real account with zero data loss
- [ ] **AUTH-05**: All existing features (Tonight, Mood, Veto, existing Sports Watchparty) continue to work end-to-end after the auth migration

### Push Notifications (Phase 6)

Skeleton — refined in /gsd-discuss-phase 6. Starts with a research spike comparing web-push vs Capacitor-wrapped vs FCM/OneSignal against iOS-first PWA reality and competitor patterns (Teleparty, Plex, Kast, Scener, Letterboxd, TV Time).

- [ ] **PUSH-01**: A documented research artifact compares delivery options and recommends an implementation path
- [ ] **PUSH-02**: A signed-in user can opt in to push on each device they use, with per-event-type granularity and a clear permission prompt
- [ ] **PUSH-03**: At least one event (watchparty-starting) delivers a real push within ~5s on iOS (home-screen PWA) and Android
- [ ] **PUSH-04**: Quiet-hours / do-not-disturb state suppresses push per user and per family
- [ ] **PUSH-05**: Self-echo guard — a user never receives push for their own action (same pattern as VETO-03)

### Watchparty (Phase 7)

- [ ] **PARTY-01**: A member can start a watchparty session from the "Tonight's Pick" card once a title is chosen
- [ ] **PARTY-02**: Other members in the family can join an active watchparty session from their own device; a push invite reaches those opted in
- [x] **PARTY-03**: Play, pause, and seek signals sync across connected devices (sync model — advisory per-member timer vs host-broadcast vs consensus — decided in /gsd-discuss-phase 7) ✓ 2026-04-22 (advisory per-member timer with on-time inference + manual override — Plans 07-03 + 07-08)
- [ ] **PARTY-04**: Members can send reactions (emoji or preset set) during the session
- [ ] **PARTY-05**: Reactions surface on all devices in the session in real-time
- [ ] **PARTY-06**: Session ends gracefully — host-ended, all-members-left, or timeout — with no orphan sessions in Firestore
- [ ] **PARTY-07**: The Tonight screen shows a watchparty banner when a session is active (scaffolding already exists in the code)

### Watch-Intent Flows (Phase 8)

Skeleton — refined in /gsd-discuss-phase 8. Splits the current "who wants to watch" primitive into two first-class flows.

- [ ] **INTENT-01**: A member can start a "Tonight @ time" flow with an optional scheduled time; other members see it and RSVP yes/no/maybe
- [ ] **INTENT-02**: A member can start a "Watch-this-title" interest poll on any title; other members see it and mark Yes/No/Later without time commitment
- [ ] **INTENT-03**: A positive match (threshold-defined per group size) surfaces as a prompt that can auto-schedule a Tonight (for interest polls) or auto-launch a Watchparty (for Tonight @ time flows)
- [ ] **INTENT-04**: Thresholds are group-size-aware — duos need any-yes; families default to majority (configurable per family)
- [ ] **INTENT-05**: Both flows cleanly expire or convert; no orphan docs remain in Firestore (same pattern as VETO/PARTY cleanup)
- [ ] **INTENT-06**: Intent activity is recorded per-member in a shape consumable by Phase 10 Year-in-Review ("most-anticipated," "most-wanted-never-watched")

### Redesign / Brand / Marketing Surface (Phase 9)

Skeleton — refined in /gsd-discuss-phase 9. Covers visual identity + full UI refresh + landing page + marketing assets + onboarding polish.

- [ ] **DESIGN-01**: Final logo + app icon set + favicon shipped in the repo; wired to manifest, head, and iOS/Android home-screen icons
- [x] **DESIGN-02**: Warm dark palette audited and canonicalized into design tokens (colors, type, spacing, motion, radius) ✓ Phase 9 Plan 02 (2026-04-22)
- [x] **DESIGN-03**: Typography tokens (Fraunces + Instrument Serif + Inter) applied consistently across every screen; no one-off inline font declarations for brand-critical surfaces ✓ Plan 02 token layer (2026-04-22) + Plan 03 inline-style purge (2026-04-22) — 83 brand-critical inline declarations migrated to 53 token-backed classes; zero inline Fraunces/Instrument Serif remain
- [x] **DESIGN-04**: Every existing in-app screen (Tonight, Title Detail, Members, Settings, Watchparty, Mood filter, Veto modals) re-rendered against the canonical token system ✓ Plan 03 tokenized brand-critical surfaces + Plan 04 desktop responsive layer (2026-04-22) — `.phone-shell` wrapper + single `@media (min-width: 900px)` block; Phase 7 UAT deferred watchparty-modal gap closed (`.wp-live-modal` 520→800px on desktop)
- [x] **DESIGN-05**: A landing page exists at `couchtonight.app` root — mobile-first, warm cinematic, explains what Couch is and drives to install / signup ✓ Plan 05 (2026-04-22) — landing.html (162 lines) at /, app.html at /app via Firebase Hosting rewrites; JSON-LD SoftwareApplication schema; install-redirect for standalone + ?invite=/?claim= deep links; user-locked copy with "Why we built it" blended-family hook + "Two ways to couch" SPIN/NOMINATION sections + 5-card audience grid; deployed to couchtonight.app, all 7 automated post-deploy gates green
- [x] **DESIGN-06**: App-Store-ready marketing asset set (hero screenshot, feature screenshots, icon variants, promo graphics) produced and stored alongside the landing page ✓ Plan 06 (2026-04-23) — 5 iPhone screenshots captured by user, optimized via sharp, wired to landing.html with CSS phone-frame treatment (border-radius + warm-amber drop shadow + figcaption overlay); deployed to couchtonight.app. og.png deferred to ship with wordmark redesign per user decision. Long-term: refresh screenshots when product surfaces evolve (tracked in Phase 12 docket).
- [x] **DESIGN-07**: First-run onboarding polished to match the redesign and introduces feature surfaces tastefully (moods, veto, watchparty, push opt-in, intent flows) ✓ Plan 07a (2026-04-23) — 3-step overlay (couch silhouette / spin-pick-veto / 4-grid feature tour), guest-skip Pitfall 5 defense, seenOnboarding gate, "Replay intro" in Settings; deployed to couchtonight.app
- [x] **DESIGN-08**: Invite-flow onboarding (when a new user accepts an invite to an existing family) polished and brand-aligned ✓ Plan 07b (2026-04-24) — `?invite=<token>` bootstrap detour, branded redeem screen + expired dead-end, `consumeGuestInvite` CF (admin-SDK, idempotent), `seenOnboarding:true` on guest creation (Pitfall 5 paired with 09-07a), defense-in-depth `&family=` URL strip (server emits token-only + client sanitizes); deployed to couchtonight.app
- [x] **DESIGN-09**: Motion language defined and applied — micro-interactions (toast, modal open, spin flicker, veto shimmer, watchparty state transitions) all use the canonical easing + duration tokens ✓ Plan 02 token layer (2026-04-22) + Plan 07b motion audit (2026-04-24) — 47 lines normalized / 66 replacements / 5 new motion tokens (`--t-spin`, `--t-celebrate`, `--t-shimmer`, `--t-pulse`, `--t-story`); zero raw ms or cubic-bezier in rule bodies; prefers-reduced-motion block hardened
- [x] **DESIGN-10**: Brand-system documentation captured in `.planning/` for future-phase reference (token cheatsheet, do/don't, voice guide) ✓ Plan 07a (2026-04-23) — `.planning/BRAND.md` 185 lines / 1497 words; 8 sections (identity, color tokens with WebAIM contrast, typography, spacing+radius+shadow, motion catalog, voice guide, screen patterns, do/don't gallery)

### Year-in-Review (Phase 10)

- [ ] **YEAR-01**: End-of-year recap page aggregates each member's watch history for the year
- [ ] **YEAR-02**: Per-member stats include titles watched, total runtime, top genres, and mood distribution
- [ ] **YEAR-03**: Per-member "favorites" section highlights top-rated titles (from Yes votes + Trakt ratings)
- [ ] **YEAR-04**: Family-level stats include most-watched-together, most-vetoed, longest watchparty, and most-anticipated-but-never-watched (from Phase 8 intent data)
- [ ] **YEAR-05**: Recap has a shareable surface (export image, copy-link, or save-to-device) — rendered against Phase 9 brand tokens

### Feature Refresh & Streamline (Phase 11)

Scoped via /gsd-discuss-phase 11 (2026-04-23); 6 user decisions locked; RESEARCH.md + CONTEXT.md + 3 appendices (CATEGORIES, SMS-OPTIONS, TABS-AUDIT) complete. Two parallel tracks: declutter + streamline (REFR-01/02/03, REFR-11/12) and moat-expansion (REFR-04, REFR-05/06, REFR-07/08/09, REFR-10, REFR-13).

- [ ] **REFR-01**: Mood filter chip spacing tightened; chip padding reduced; visually denser without sacrificing tap target
- [ ] **REFR-02**: "Whose turn to pick" UI surfaces hidden across Tonight + Family tabs (feature-flag reversible via body class); backend spinnership writes preserved
- [ ] **REFR-03**: "Who's on the couch" card redesigned to a cleaner, denser format (avatar-stack or compact horizontal row — variant locked at plan-phase)
- [ ] **REFR-04**: Add-tab discovery expanded from 4 to a 35-row catalog organized in 6 buckets (always-on / trending / discovery / use-case / theme-of-the-day / seasonal / group-aware); 8-10 rows visible per day via per-user-per-day hash-seeded rotation; auto-categories only in v1 (curated lists + Browse-all + pinning + personalization ship in plan 11-03b)
- [x] **REFR-05**: Web RSVP route (`/rsvp/<token>`) + Web Share API integration — lightweight HTML+JS RSVP page (no full app shell, no Firebase SDK); schedule modal wires `navigator.share()`; non-members land on RSVP page, convert to push-receiving members on first interaction. Twilio + SMS automation deferred to Milestone 2 per user decision 4. [Plan 11-04, code-complete 2026-04-24; host-triggered "remind unresponsive" button deferred to Plan 11-05 lobby scope]
- [x] **REFR-06**: Asymmetric push reminder cadence keyed to RSVP state (members only) — Yes = 2 touches (T-24h, T-1h); Maybe = 3 touches (T-7d, T-24h, T-1h); Not-responded = 2 (T-48h, T-4h); No = silence. Host-triggered "remind unresponsive" button (push for members, re-share-link for non-members). [Plan 11-04, code-complete 2026-04-24 — auto-cadence shipped via rsvpReminderTick scheduled CF; host-triggered manual remind button deferred to Plan 11-05]
- [ ] **REFR-07**: Pre-session lobby upgrade — evolve participant timer strip into a T-15min "green room": who's here, who's en-route, countdown, per-person Ready check, democratic auto-start at T-0 once majority Ready
- [ ] **REFR-08**: Late-joiner "Catch me up" recap — 30-second summary of reactions that fired before they joined. Preserves Couch's per-user reaction-delay moat while eliminating timeline-loss friction.
- [ ] **REFR-09**: Post-session loop — auto-prompt 5-star rating + "Add photo to album" + one-tap "Schedule next" using same roster. Converts one party into recurring ritual.
- [ ] **REFR-10**: Dedicated Sports Game Mode — `SportsDataProvider` abstraction (ESPN hidden API + BALLDONTLIE), game picker, live score strip always visible, kickoff countdown + auto-transition, play-scoped amplified reactions (score-delta polling), late-joiner "current score + last 3 plays" card, team-flair avatar badges, per-user "I'm N seconds behind" DVR slider
- [ ] **REFR-11**: Family tab restructured per `11-APPENDIX-TABS-AUDIT.md` — current 6 sections → 5 (Tonight status NEW / Approvals / Members split active vs sub-profiles / Couch history consolidated / Group settings footer). Picker section cut per REFR-02. Couch calendar + ADDs deferred to Phase 12.
- [ ] **REFR-12**: Account tab restructured per `11-APPENDIX-TABS-AUDIT.md` — current 9 flat sections → 3 cognitive clusters (You / Couch-wide / Admin & maintenance). NEW sections (per-event notif prefs detail, data export/delete, theme prefs, about/version+feedback) deferred to Phase 12.
- [ ] **REFR-13** (stretch, may defer to Phase 12): "Couch Nights" themed ballot packs — Studio Ghibli, Cozy Rainy Sunday, Halloween Crawl, Date Night Picks, etc. Pre-loaded ballots the host taps once to kick off a themed session.

## v2 Requirements

Deferred to post-v1. Tracked but not in current roadmap.

### Modularization

- **MOD-01**: Split `index.html` into bundled modules with a build step
- **MOD-02**: FlutterFlow port of the app for native distribution

### Monetization

- **PAY-01**: Plan tiers (free / paid) with feature gating
- **PAY-02**: Billing integration and subscription management
- **PAY-03**: Per-family account ownership and plan assignment

### Social / Public

- **SOC-01**: Public discovery surface (browse other families' public lists)
- **SOC-02**: Cross-family sharing (recommend a title to another family)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modularization / bundler / framework migration | Single-file `index.html` is deliberate for v1 — ease of deploy, iteration speed; deferred to v2 |
| Native rewrites (FlutterFlow, React Native, Swift) | FlutterFlow port planned post-v1; this milestone stays single-file web |
| Monetization wiring (paywall, billing, plan tiers) | "Free, figure out later" — no billing logic in this milestone |
| Public discovery / cross-family social feed | Couch is family-scoped by design for v1 |
| Moving TMDB key / Firebase config server-side | Public-by-design; no security benefit, adds ops cost |
| Public onboarding funnel / landing conversion work | Invite-driven growth through v1 |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| MOOD-01 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-02 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-03 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-04 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-05 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-06 | Phase 3 | Complete ✓ 2026-04-20 |
| MOOD-07 | Phase 3 | Complete ✓ 2026-04-20 |
| VETO-01 | Phase 4 | Complete ✓ 2026-04-20 (04-01) |
| VETO-02 | Phase 4 | Complete ✓ 2026-04-20 (04-02) |
| VETO-03 | Phase 4 | Complete ✓ 2026-04-20 (04-03) |
| VETO-04 | Phase 4 | Complete ✓ 2026-04-20 (04-01) |
| VETO-05 | Phase 4 | Complete ✓ 2026-04-20 (04-01) |
| VETO-06 | Phase 4 | Complete ✓ 2026-04-20 (04-02) |
| AUTH-01 | Phase 5 | Pending |
| AUTH-02 | Phase 5 | Pending |
| AUTH-03 | Phase 5 | Pending |
| AUTH-04 | Phase 5 | Pending |
| AUTH-05 | Phase 5 | Pending |
| PUSH-01 | Phase 6 | Pending |
| PUSH-02 | Phase 6 | Pending |
| PUSH-03 | Phase 6 | Pending |
| PUSH-04 | Phase 6 | Pending |
| PUSH-05 | Phase 6 | Pending |
| PARTY-01 | Phase 7 | Pending |
| PARTY-02 | Phase 7 | Pending |
| PARTY-03 | Phase 7 | Complete (07-03 + 07-08) |
| PARTY-04 | Phase 7 | Pending |
| PARTY-05 | Phase 7 | Pending |
| PARTY-06 | Phase 7 | Pending |
| PARTY-07 | Phase 7 | Pending |
| INTENT-01 | Phase 8 | Pending |
| INTENT-02 | Phase 8 | Pending |
| INTENT-03 | Phase 8 | Pending |
| INTENT-04 | Phase 8 | Pending |
| INTENT-05 | Phase 8 | Pending |
| INTENT-06 | Phase 8 | Pending |
| DESIGN-01 | Phase 9 | Pending |
| DESIGN-02 | Phase 9 | Complete |
| DESIGN-03 | Phase 9 | Complete |
| DESIGN-04 | Phase 9 | Complete |
| DESIGN-05 | Phase 9 | Complete |
| DESIGN-06 | Phase 9 | Complete |
| DESIGN-07 | Phase 9 | Complete |
| DESIGN-08 | Phase 9 | Complete |
| DESIGN-09 | Phase 9 | Complete |
| DESIGN-10 | Phase 9 | Complete |
| YEAR-01 | Phase 10 | Pending |
| YEAR-02 | Phase 10 | Pending |
| YEAR-03 | Phase 10 | Pending |
| YEAR-04 | Phase 10 | Pending |
| YEAR-05 | Phase 10 | Pending |
| REFR-01 | Phase 11 | Pending |
| REFR-02 | Phase 11 | Pending |
| REFR-03 | Phase 11 | Pending |
| REFR-04 | Phase 11 | Pending |
| REFR-05 | Phase 11 Plan 04 | Complete (code) 2026-04-24 |
| REFR-06 | Phase 11 Plan 04 | Complete (code) 2026-04-24 |
| REFR-07 | Phase 11 | Pending |
| REFR-08 | Phase 11 | Pending |
| REFR-09 | Phase 11 | Pending |
| REFR-10 | Phase 11 | Pending |
| REFR-11 | Phase 11 | Pending |
| REFR-12 | Phase 11 | Pending |
| REFR-13 | Phase 11 | Pending (stretch — may defer to Phase 12) |

**Coverage:**
- v1 requirements: 65 total (21 complete across Phases 3+4+7+9; 44 pending across Phases 5/6/7/8/9/10/11)
- Mapped to phases: 65 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-24 — added Phase 11 (Feature Refresh & Streamline) with 13 REFR-* items scoped via /gsd-discuss-phase 11 (6 decisions locked 2026-04-23). Prior update 2026-04-20 — roadmap restructure added Auth (5), Push (6), Intent (8), Redesign (9) and pushed Year-in-Review to Phase 10.*
