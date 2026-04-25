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

- [x] **REFR-01**: Mood filter chip spacing tightened; chip padding reduced; visually denser without sacrificing tap target [Plan 11-01, complete 2026-04-24]
- [x] **REFR-02**: "Whose turn to pick" UI surfaces hidden across Tonight + Family tabs (feature-flag reversible via body class); backend spinnership writes preserved [Plan 11-01, complete 2026-04-24]
- [x] **REFR-03**: "Who's on the couch" card redesigned to a cleaner, denser format (avatar-stack or compact horizontal row — variant locked at plan-phase) [Plan 11-01, complete 2026-04-24]
- [x] **REFR-04**: Add-tab discovery expanded from 4 to a 25-row DISCOVERY_CATALOG organized in 7 buckets (always-on / trending / discovery auto / discovery curated / use-case / theme-of-day / seasonal / personalization-group-aware); 7-10 rows visible per day via per-user-per-day hash-seeded rotation; auto categories + curated lists + Browse-all + pin-up-to-3 + personalization ALL shipped across 11-03a+11-03b [Plans 11-03a + 11-03b, complete 2026-04-24]
- [x] **REFR-05**: Web RSVP route (`/rsvp/<token>`) + Web Share API integration — lightweight HTML+JS RSVP page (no full app shell, no Firebase SDK); schedule modal wires `navigator.share()`; non-members land on RSVP page, convert to push-receiving members on first interaction. Twilio + SMS automation deferred to Milestone 2 per user decision 4. [Plan 11-04, code-complete 2026-04-24; host-triggered "remind unresponsive" button deferred to Plan 11-05 lobby scope]
- [x] **REFR-06**: Asymmetric push reminder cadence keyed to RSVP state (members only) — Yes = 2 touches (T-24h, T-1h); Maybe = 3 touches (T-7d, T-24h, T-1h); Not-responded = 2 (T-48h, T-4h); No = silence. Host-triggered "remind unresponsive" button (push for members, re-share-link for non-members). [Plan 11-04, code-complete 2026-04-24 — auto-cadence shipped via rsvpReminderTick scheduled CF; host-triggered manual remind button deferred to Plan 11-05]
- [x] **REFR-07**: Pre-session lobby upgrade — evolve participant timer strip into a T-15min "green room": who's here, who's en-route, countdown, per-person Ready check, democratic auto-start at T-0 once majority Ready [Plan 11-05, code-complete 2026-04-24; deploy deferred with 11-04 pending Blaze billing confirmation]
- [x] **REFR-08**: Late-joiner "Catch me up" recap — 30-second summary of reactions that fired before they joined. Preserves Couch's per-user reaction-delay moat while eliminating timeline-loss friction. [Plan 11-05, code-complete 2026-04-24]
- [x] **REFR-09**: Post-session loop — auto-prompt 5-star rating + "Add photo to album" + one-tap "Schedule next" using same roster. Converts one party into recurring ritual. [Plan 11-05, code-complete 2026-04-24; Firebase Storage first use — Variant A rules pending deploy + Firebase Console Storage enablement + emulator test matrix]
- [x] **REFR-10**: Dedicated Sports Game Mode — `SportsDataProvider` abstraction (ESPN hidden API primary + BALLDONTLIE stub for v2 swap), game picker modal with 4 league tabs, live score strip (sticky-top, tabular-nums), score-delta polling (adaptive 5s on-play / 15s off-play), play-scoped amplified reactions (4 burst emojis, 3s auto-dismiss), late-joiner sports Catch-me-up variant (score + last 3 plays), team-flair avatar badges (border in team color via runtime CSS custom property), per-user DVR slider writing to participants[mid].dvrOffsetMs AND reusing Phase 7 reactionDelay anchor. [Plan 11-06, code-complete 2026-04-24; deploy deferred — ESPN ToS-gray accepted per threat model; BALLDONTLIE swap path wired for when/if ESPN denies]
- [x] **REFR-11**: Family tab restructured per `11-APPENDIX-TABS-AUDIT.md` — current 6 sections → 5 (Tonight status NEW / Approvals / Members split active vs sub-profiles / Couch history consolidated / Group settings footer). Picker section cut per REFR-02. Couch calendar + ADDs deferred to Phase 12. [Plan 11-02, complete 2026-04-24]
- [x] **REFR-12**: Account tab restructured per `11-APPENDIX-TABS-AUDIT.md` — current 9 flat sections → 3 cognitive clusters (You / Couch-wide / Admin & maintenance). NEW sections (per-event notif prefs detail, data export/delete, theme prefs, about/version+feedback) deferred to Phase 12. [Plan 11-02, complete 2026-04-24]
- [x] **REFR-13**: "Couch Nights" themed ballot packs — 8 curated packs (Studio Ghibli Sunday, Cozy Rainy Night, Halloween Crawl, Date Night Classics, Kids' Room Classics, A24 Night, Oscars Short List, Dad's Action Pantheon) with hero poster + BRAND-voice description + mood token + 10-12 curated TMDB IDs. Add-tab tile row + pack-detail sheet + "Start this pack" seeds ballot + launches Vote mode. [Plan 11-07, complete 2026-04-24]

### Pre-launch polish (Phase 12)

Tight ~1-day patch closing UAT-surfaced gaps from Phase 11 + Phase 6.

- [ ] **POL-01**: Per-event notification preferences UI in Account → YOUR COUCH → Notifications. Master toggle expand/collapse + 6 per-event toggles (watchpartyScheduled, watchpartyStartingNow, intentRsvpRequested, inviteReceived, vetoCapReached, tonightPickChosen) + quiet hours start/end pickers. Writes to `users/{uid}.notificationPrefs` immediately with optimistic UI. Closes Phase 6 PUSH-02 + PUSH-04 runtime UAT loop (server-side enforcement already shipped in functions/index.js).
- [ ] **POL-02**: About / version / feedback / changelog footer in Account ADMIN cluster. Version line ("Couch v{N} — deployed {YYYY-MM-DD}"), mailto feedback link, "What's new" link to `/changelog.html` (NEW standalone page following landing.html posture). Hosting rewrite `/changelog` → `/changelog.html`.
- [ ] **POL-03**: Halloween Crawl pack ID curation — Plan 11-07 used `tmdbId 9532` for "Hocus Pocus" but TMDB resolves it to "Final Destination". Replace with the real Hocus Pocus ID; pass-through verify the other 9 IDs in the pack against their comment labels.
- [ ] **POL-04** (stretch): Other-7-packs curation pass — verify each remaining pack's tmdbIds match their comment labels via TMDB API. Apply fixes where mismatched. Optional: refactor to drop comment labels in favor of a build-time test that asserts title matches, eliminating drift permanently.

### Compliance & Ops Sprint (Phase 13)

Solo-actionable post-v1 hardening sprint locked via /gsd-discuss-phase 13 + /gsd-plan-phase 13 (6 decisions locked 2026-04-25). Not a feature phase — operational hygiene + compliance hardening only.

- [ ] **COMP-13-01**: Self-serve account deletion. A signed-in user can delete their account from Account → ADMIN; soft-delete enters a 14-day grace window during which they can sign back in to cancel; after 14 days a scheduled reaper hard-deletes Firestore (members + votes + queues + watchparty participations + intent rsvps + couch-album doc refs) + Storage (couch-albums photos owned by the uid) + Firebase Auth user record + writes an audit doc. Closes the manual privacy.html "email privacy@couchtonight.app" promise within the 30-day CCPA/GDPR window. Trigger: HTTPS callable + Cloud Scheduler reaper (NOT auth.user().onDelete — firebase-functions v2 has no auth triggers).
- [ ] **OPS-13-02**: BUILD_DATE auto-stamp on deploy. `scripts/deploy.sh` invokes `scripts/stamp-build-date.cjs` automatically before `firebase deploy`, eliminating the "I forgot to bump the date" failure mode that bit Phase 12. Wired via `npm run deploy` + `npm run stamp` shortcuts; documented in RUNBOOK §H. Pitfall 7 dirty-tree guard with `--allow-dirty` escape hatch.
- [ ] **OPS-13-04**: Content-Security-Policy in Report-Only mode. Additive 4th security header in queuenight/firebase.json allow-listing all third-party origins (Firebase + TMDB + Trakt + Google Fonts + Sentry + Cloud Functions). Ships in `Content-Security-Policy-Report-Only` mode for v1 — 2-week observation window — before flipping to enforcement in a later sprint. Existing X-Content-Type-Options + Referrer-Policy + X-Frame-Options preserved verbatim. Updates TECH-DEBT.md TD-4 status.
- [ ] **OPS-13-05**: Sentry error reporting integration. CDN loader script (zero-bundler, public-by-design DSN) added to app.html + landing.html `<head>` with PII-scrubbing `beforeSend` (strips event.user.id (uid) + event.user.email + event.user.username + event.user.ip_address + family-code regex `/\b[a-f0-9]{6}\b/gi` + invite/claim/rsvp tokens in URLs) and Firestore-noise-filtering `beforeBreadcrumb` (Pitfall 5 defense). Vendor: Sentry, NOT Crashlytics — Firebase Crashlytics has no web SDK as of 2026 (firebase-js-sdk#710). Free tier (5K errors/month) sufficient for v1.
- [ ] **OPS-13-06**: GitHub branch protection ruleset. `protect-main` Ruleset on github.com/<owner>/couch with empty bypass list: Restrict deletions + Block force pushes + Require linear history + Require PR (0 reviewers, solo-dev gate) + Require `syntax-check` CI status check from `.github/workflows/ci.yml` + Require conversation resolution. Direct push to main rejected with GH013. Configured via web UI (CONTEXT.md addendum #2 locks the path).
- [ ] **OPS-13-07**: Scheduled Firestore export + restore drill. Cloud Scheduler HTTP job `daily-firestore-export` hits `firestore.googleapis.com/v1/.../databases/(default):exportDocuments` directly (no Pub/Sub + Cloud Function detour). Exports daily to `gs://queuenight-84044-backups/` (us-central1, matches Firestore region) with 30-day lifecycle delete rule + uniform-bucket-level-access. Idempotent setup script `scripts/firestore-export-setup.sh`. Restore drill documented in RUNBOOK §I + setup runbook in §K.

**Deferred to Phase 14:** OPS-13-01 (firebase-functions SDK 4.9.0 → 7.x — TECH-DEBT TD-1; sufficiently risky to deserve its own session).
**Deferred to a later milestone:** OPS-13-03 (Variant-B storage rules tightening — TECH-DEBT TD-2; gated on independent Phase 5 member-uid migration decision).

### Decision Ritual Core (Phase 14)

Scoped via /gsd-discuss-phase 14 (2026-04-25) — 12 user decisions locked (D-01..D-12) + 3 reconciled DRs (DR-1 extend `intents` collection rather than fork, DR-2 polish queue rather than rebuild, DR-3 add 7 push categories in 3 places). Replaces the vote-prominent Tonight tile with a couch-centered, conversation-first ritual. Two parallel flows (group rank-pick when together, solo nominate when apart) backed by the unified `intents` primitive (extended from Phase 8). 13 DECI-* requirements minted at /gsd-plan-phase 14 (2026-04-25).

- [ ] **DECI-14-01**: Strict member-aware "already-watched" filter for the couch's discovery surfaces (Browse / Spin / Swipe). 4 sources count as watched: (1) Trakt sync flipped `t.watched=true`, (2) any member voted Yes, (3) any member voted No, (4) manually marked-watched. Per-title rewatch override via `t.rewatchAllowedBy[memberId]=ts` (same-day) re-enables a single title for the active session. Invitation bypass: filter applies only to MY discovery view — pushes from Flow A/B nominators to me are NEVER filtered (I can join a rewatch). Filter helper `isWatchedByCouch(t, couchMemberIds)` co-located with `getMyQueueTitles` near `js/app.js:6827`. (D-01)
- [ ] **DECI-14-02**: 3-tier candidate filter on the new ranked picker surface. Tier 1 (default visible): titles where EVERY couch member has the title in their personal queue, sorted by mean of member-queue ranks, ties broken by `t.rating`. Tier 2 (default visible, below T1): ≥1 couch member has it in queue. Tier 3 (hidden behind expand): only off-couch members have it in queue ("watching her movie without her"). New `getTierOneRanked(couchMemberIds)` + `getTierTwoRanked` + `getTierThreeRanked` aggregators near `js/app.js:6852`. Most-restrictive-wins T3 toggle hierarchy across account-level / family-level / group-level — ANY level set to "hide T3" wins; "show T3" only takes effect when no level says hide. (D-02)
- [ ] **DECI-14-03**: Polish the existing per-member queue infrastructure (DR-2 reframe — primitive already shipped via `t.queues[memberId]` map at `js/app.js:12340`, drag-reorder at `js/app.js:4664`, persist at `js/app.js:4648`). Phase 14 scope: (a) add discoverability toast on Yes-vote queue auto-add — `flashToast("Added X to your queue")` only when actor is `state.me`; (b) verify Add-tab insertion path actually wires the new title into the actor's personal queue at the bottom (audit + fix if missing); (c) iOS Safari touch-DnD UAT — keep hand-rolled HTML5 DnD if it works, otherwise swap to Sortable.js via CDN. (D-03 reframed per DR-2)
- [ ] **DECI-14-04**: Tile redesign. Tile face: poster + title + year + runtime + new "X want it" pill (3 micro-avatars + "+N" overflow chip computed from `t.queues` membership) + ▶ Trailer button (lazy-loaded on tap, uses existing `trailerKey` field). Vote button REMOVED from tile face. Single tap on tile body opens new `openTileActionSheet(titleId, e)` (4 buckets: Watch tonight / Schedule for later / Ask family / Vote de-emphasized) + secondary entries (Show details / More options falling back to existing `openActionSheet` at `js/app.js:11853`). Detail modal surfaces formerly-hidden items: Trailer, Providers, Synopsis, Cast, Reviews. Includes carry-over UAT bug close-out: verify `.detail-close{position:fixed}` already at `css/app.css:1540` covers the Library/Queue context (or extend if a different scroll container is involved). (D-04)
- [ ] **DECI-14-05**: Vote mode preserved in Add tab as bulk curation surface. "Catch up on votes (N)" CTA renders automatically when ≥10 unvoted family titles exist; tap launches existing `openVoteModal()` swipe flow. Vote mode is a sibling to (not replacement for) the new tile action sheet's "Vote" entry. (D-05)
- [ ] **DECI-14-06**: Couch SVG visualization renderer `renderCouchSvg(seatCount)`. Procedural inline SVG (per-cushion `<g onclick="claimCushion(idx)">`); adaptive seat count 2-8; common case (2-6 members) renders one cushion per member; edge case (7+) renders 7 individual cushions + 1 "+N more" overflow cushion that opens a sheet listing the rest. Empty cushions are "+ add to couch" affordances (tap to seat yourself or invite). iOS PWA budget: viewBox-based scaling with `preserveAspectRatio="xMidYMid meet"`, ≥44pt cushion targets on iPhone-SE width, no `filter:url(#)` (use CSS box-shadow instead), avatars composited as DOM `<img>` overlay positioned over SVG (not as in-SVG `<image href>` due to iOS cross-origin caching quirks). Visual treatment locked at `/gsd-sketch` round prior to execution. (D-06)
- [ ] **DECI-14-07**: Flow A — group rank-pick + push-confirm. (1) Members claim cushions on Couch viz (cushion-tap → `claimCushion(idx)` writes `intents/{id}.expectedCouchMemberIds` once intent created); (2) App shows ranked list per tier; (3) Picker selects a title → roster screen → picker proxy-confirms members "in person" (taps to mark them "in") → only unmarked members get push (`flowAPick` eventType); (4) Push payload allows In / Reject / Drop; (5) Reject-majority auto-prompts picker for #2 from ranked list (1 retry, then expire); rejector can attach counter-nomination via `rsvps[me].counterTitleId` (push to picker as `flowAVoteOnPick`); (6) Counter-chain capped at 3 levels via `counterChainDepth` field (rules-enforced — see DECI-14-09); (7) Quorum to convert intent → watchparty: picker + ≥1 confirmed `state==='in'`; (8) Hard expire 11pm same-day if not converted. (D-07)
- [ ] **DECI-14-08**: Flow B — solo-nominate + invite + counter-time. (1) Member nominates a title with proposed time; (2) Push to other members (`flowBNominate`): join @ proposed time / counter-suggest (later/earlier with note via `rsvps[me].counterTime`) / decline; (3) Counter-time decision belongs to nominator only — UI lets nominator accept / reject / pick-compromise per counter (push to nominator: `flowBCounterTime`); (4) Auto-convert intent → watchparty at T-15min if any `state==='in'` RSVPs exist (CF-driven via `watchpartyTick` extension, see DECI-14-09; push: `flowBConvert`); (5) All-No edge case auto-cancels intent + immediate push to nominator; (6) Hard expire T+4hr past proposed start time. (D-08)
- [ ] **DECI-14-09**: Extend the existing `families/{code}/intents/{intentId}` collection (DR-1 — NOT a new collection). Schema additions: `flow: 'tonight_at_time' | 'watch_this_title' | 'rank-pick' | 'nominate'` discriminator (legacy `type` field preserved verbatim; reads accept both vocabularies; new flows use `flow`); `expectedCouchMemberIds[]` (Flow A); `counterChainDepth` (0-3, rules-capped at 3); `convertedToWpId`; widened `rsvps[mid]` shape — accepts Phase 8 `{value:'yes'|'no'|'maybe'|'later'}` AND new `{state:'in'|'reject'|'drop'|'maybe', counterTime?, counterTitleId?, note?}`; widened `status` enum to include `'converted'`. `firestore.rules:338-386` widened: create accepts 4 types, new update branch (5) for counter-chain bump enforces `counterChainDepth <= 3`, convert branch (4) extended to allow `open → converted` (Flow A) and adds `convertedToWpId` to allowed keys. CF: extend `onIntentCreated` (`queuenight/functions/index.js:354`) and `onIntentUpdate` (`:408`) with flow-aware branches; extend the existing intent expiry sweep inside `watchpartyTick` (`:494-512`) with 3 new behaviors — Flow A 11pm hard-expire, Flow B T-15min auto-convert when any `state==='in'`, T-30min `intentExpiring` warning push. NO new collection, NO new CFs, NO new onSchedule trigger. (D-09 reframed per DR-1)
- [ ] **DECI-14-10**: Hybrid onboarding for the new primitives. (a) Changelog v34 entry inserted into `changelog.html:67` describing the redesign (for users who go looking); (b) 3 in-context, dismiss-on-interaction tooltips at moment of first encounter — `couchSeating` (Tonight tab Couch viz first render), `tileActionSheet` (first tile tap post-update), `queueDragReorder` (first Library tab visit when filter==='myqueue') — anchored to target via new `showTooltipAt(el, msg, opts)` primitive in `js/utils.js`. Per-tooltip gates via `members/{id}.seenTooltips: { [primId]: true }` Firestore sub-map (write via `updateDoc(doc(membersRef(), state.me.id), {[\`seenTooltips.${primId}\`]: true})`); guest members skipped. NO mandatory modal. (D-10)
- [ ] **DECI-14-11**: 5 empty-state surfaces with action-leading CTAs (no dead ends): (a) brand-new family — "Your couch is fresh. What should be the first?" → "Add a title" + "Connect Trakt to import history"; (b) empty personal queue — "Your queue is empty. Vote on a few titles to fill it up." → "Open Vote mode" + 3-5-trending carousel; (c) Flow A entry, no couch — "Who's on the couch tonight? Tap to seat yourself + invite family." → Couch viz with all cushions glowing as +add affordances; (d) all-watched (T1+T2 empty) — "You've seen everything in queue. Revisit a favorite or expand?" → "Show rewatch options" (reveal T3) + "Discover more" → Add tab; (e) Flow A reject-majority no-#2 — "No alternative pick. Try again or anyone nominate?" → "Cancel for tonight" + "Open Flow B". Each uses the existing `<div class="queue-empty">` shell at `js/app.js:4592`. (D-11)
- [ ] **DECI-14-12**: 7 new push notification categories added in THREE places per DR-3 (server defaults + client defaults + client labels) — NOT two. Categories: `flowAPick`, `flowAVoteOnPick`, `flowARejectMajority`, `flowBNominate`, `flowBCounterTime`, `flowBConvert`, `intentExpiring`. All default ON (these fire only when the user has actively engaged with a flow). Place 1: `NOTIFICATION_DEFAULTS` at `queuenight/functions/index.js:74` (server-side gate; missing here = `defaultOn=true` per `hasDefault` check at `:114` and user toggle is silently ignored). Place 2: `DEFAULT_NOTIFICATION_PREFS` at `js/app.js:100` (client merge baseline). Place 3: `NOTIFICATION_EVENT_LABELS` at `js/app.js:113` (BRAND-voice copy per D-12; warm family-tapping-shoulder tone, no "Notification:" prefix, no UTC timestamps). Cadence: critical-immediate for state changes needing user action; contextual-batched (60-90s coalesced digest) for info-only state changes. Quiet hours respected via existing Phase 6 `isInQuietHours` enforcement in `sendToMembers`. (D-12 + DR-3)
- [ ] **DECI-14-13**: `sw.js` CACHE constant bumped to `couch-v34.0-decision-ritual` and deployed (via `bash scripts/deploy.sh 34.0-decision-ritual`) so installed PWAs invalidate and pick up the redesigned tiles + Couch viz + tooltip primitive + new push wiring + extended intents schema. Cross-cutting requirement covering all user-visible changes shipped across DECI-14-01..12. Bump and deploy happen at the end of the phase, NOT per-plan, to avoid CACHE thrash during execution.

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
| REFR-01 | Phase 11 Plan 01 | Complete 2026-04-24 |
| REFR-02 | Phase 11 Plan 01 | Complete 2026-04-24 |
| REFR-03 | Phase 11 Plan 01 | Complete 2026-04-24 |
| REFR-04 | Phase 11 Plans 03a + 03b | Complete 2026-04-24 |
| REFR-05 | Phase 11 Plan 04 | Complete (code) 2026-04-24 |
| REFR-06 | Phase 11 Plan 04 | Complete (code) 2026-04-24 |
| REFR-07 | Phase 11 Plan 05 | Complete (code) 2026-04-24 |
| REFR-08 | Phase 11 Plan 05 | Complete (code) 2026-04-24 |
| REFR-09 | Phase 11 Plan 05 | Complete (code) 2026-04-24 |
| REFR-10 | Phase 11 Plan 06 | Complete (code) 2026-04-24 |
| REFR-11 | Phase 11 Plan 02 | Complete 2026-04-24 |
| REFR-12 | Phase 11 Plan 02 | Complete 2026-04-24 |
| REFR-13 | Phase 11 Plan 07 | Complete (code) 2026-04-24 |
| POL-01 | Phase 12 | Pending |
| POL-02 | Phase 12 | Pending |
| POL-03 | Phase 12 | Pending |
| POL-04 | Phase 12 | Pending (stretch) |
| COMP-13-01 | Phase 13 Plan 01 | Pending |
| OPS-13-02 | Phase 13 Plan 03 | Pending |
| OPS-13-04 | Phase 13 Plan 05 | Pending |
| OPS-13-05 | Phase 13 Plan 02 | Pending |
| OPS-13-06 | Phase 13 Plan 03 | Pending (checkpoint) |
| OPS-13-07 | Phase 13 Plan 04 | Pending (checkpoint) |
| DECI-14-01 | Phase 14 Plan 01 | Pending |
| DECI-14-02 | Phase 14 Plan 03 | Pending |
| DECI-14-03 | Phase 14 Plan 02 | Pending |
| DECI-14-04 | Phase 14 Plan 05 | Pending |
| DECI-14-05 | Phase 14 Plan 05 | Pending |
| DECI-14-06 | Phase 14 Plan 04 | Pending |
| DECI-14-07 | Phase 14 Plan 07 | Pending |
| DECI-14-08 | Phase 14 Plan 08 | Pending |
| DECI-14-09 | Phase 14 Plan 06 | Pending |
| DECI-14-10 | Phase 14 Plan 09 | Pending |
| DECI-14-11 | Phase 14 Plan 09 | Pending |
| DECI-14-12 | Phase 14 Plan 09 | Pending |
| DECI-14-13 | Phase 14 Plan 09 | Pending (cross-cutting deploy step) |

**Coverage:**
- v1 requirements: 88 total (33 complete across Phases 3+4+7+9+11; 55 pending across Phases 5/6/8/12/13/14 + deferred Phase 10)
- Mapped to phases: 88 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-25 — added Phase 14 (Decision Ritual Core) with 13 DECI-14-* items locked via /gsd-discuss-phase 14 (12 user decisions D-01..D-12 + 3 reconciled DRs) and minted at /gsd-plan-phase 14. Prior update 2026-04-25 — added Phase 13 (Compliance & Ops Sprint) with 6 COMP-13-* + OPS-13-* items locked via /gsd-discuss-phase 13 + /gsd-plan-phase 13. Prior update 2026-04-25 — added Phase 12 (Pre-launch polish) with 4 POL-* items repurposing the original parking-lot Phase 12 slot (parking-lot docket archived to seeds/phase-12-original-docket-archive-2026-04-23.md). Prior update 2026-04-24 — added Phase 11 (Feature Refresh & Streamline) with 13 REFR-* items scoped via /gsd-discuss-phase 11 (6 decisions locked 2026-04-23). Prior update 2026-04-20 — roadmap restructure added Auth (5), Push (6), Intent (8), Redesign (9) and pushed Year-in-Review to Phase 10.*
