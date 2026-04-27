# Roadmap: Couch

## Overview

Couch turns "what do you want to watch?" into a 30-second ritual. Phases 1 and 2 shipped pre-GSD (catalog, voting, basic Tonight flow, Trakt sync, PWA, Firestore real-time). This v1 roadmap completes the commercial-release milestone across the remaining product phases: mood-tagged filtering, a veto system, member-level auth + password-protected groups, push notifications, synced watchparties, dual watch-intent flows (Tonight at a time + interest-per-title), a full redesign/branding pass, and an end-of-year recap. All work lands in modular `js/` + single `index.html` shell; backend stays Firebase Firestore + TMDB + Trakt (Cloud Functions expand for auth + push delivery).

**Roadmap restructure (2026-04-20):** After Phase 4 completion, the user decided to insert foundational capabilities (auth, push, intent flows) before Watchparty and push Year-in-Review to the end behind a dedicated Redesign phase. Old Phase 5 (Watchparty) → new Phase 7; old Phase 6 (Year-in-Review) → new Phase 10. Requirement IDs (PARTY-*, YEAR-*) are stable and did not renumber.

## Milestones

- ✅ **Phases 1-2 (Catalog + Tonight/Voting)** — shipped pre-GSD
- 🚧 **v1 Commercial Release (Phases 3-10)** — in progress; user wants full product polish before public launch

## Phases

**Phase Numbering:**
- Integer phases: Planned v1 milestone work — numbering continues from shipped phases 1-2
- Decimal phases (e.g., 3.5): Reserved for urgent insertions already executed

- [x] **Phase 3: Mood Tags** — Members can tag titles with moods and filter the Tonight spin by mood ✓ 2026-04-20
- [x] **Phase 4: Veto System** — Any member can veto pre- or post-spin and the family sees it instantly ✓ 2026-04-20
- [x] **Phase 5: Auth + Groups** — Real member accounts, password-protected groups, and a migration path off the family-code-only model ✓ 2026-04-22 (code-complete; multi-account runtime UAT items deferred as environmental, 3 seeds captured)
- [ ] **Phase 6: Push Notifications** — Research-first: real push (not just local) for watchparty starts, vetoes, invites, and other event surfaces
- [x] **Phase 7: Watchparty** — Synced multi-device watch sessions with real-time reactions, now identity- and push-aware (was Phase 5 pre-restructure) ✓ 2026-04-22
- [x] **Phase 8: Watch-Intent Flows** — Two parallel branches: "who's watching tonight at X time" (time-bound RSVP) and "who wants to watch this title" (content-bound interest poll) ✓ 2026-04-22 (UAT autonomous via browser-Claude; 1 seed for CF timezone echo)
- [ ] **Phase 9: Redesign / Brand / Marketing Surface** — Full visual identity (logo, icon, palette, typography), UI refresh against a polished design system, plus landing page + app-store-style marketing surface
- [⏸] **Phase 10: Year-in-Review** — DEFERRED 2026-04-25 (revisit post-launch — needs accumulated watch history + audience to feel substantive). End-of-year recap aggregating mood, veto, watchparty, and intent-flow activity (was Phase 6 pre-restructure)
- [x] **Phase 11: Feature refresh & streamline** — Post-Phase-9 declutter + moat-expansion pass: UX tightening, Family+Account tab restructures, discovery row expansion, watchparty lifecycle (web RSVP + lobby + catch-me-up + post-session loop), dedicated Sports Game Mode, Couch Nights themed packs ✓ Code-complete 2026-04-24 (Waves 1+2 deployed same day). Waves 3+4 DEPLOYED 2026-04-25 — Cloud Functions rsvpSubmit/rsvpReminderTick/watchpartyTick live in us-central1, storage.rules released, /rsvp/<token> route live, sw.js v32 serving, post-session photo upload to couch-albums/ working. Multi-device human-verify (lobby/catch-me-up/post-session/sports) deferred to next session.
- [x] **Phase 12: Pre-launch polish** — Per-event notif prefs UI (closes Phase 6 UAT loop) + about/version/feedback/changelog footer + Couch Nights pack ID curation pass. Tight ~1-day patch ahead of any larger phase. ✓ SHIPPED 2026-04-25 (3 plans + verification + bug-fix in 6 commits 004255b/b1ab9a9/6323530/7a52440/4adc1aa/69953ea + production deploy; 14 pack IDs corrected, 8/8 smoke tests pass on couchtonight.app).

## Phase Details

### Phase 3: Mood Tags
**Goal**: A family can narrow Tonight's spin to a mood that fits the room — "cozy," "action," "short" — using tags anyone can apply, auto-suggestions when nobody has, and a filter surface that feels native to the existing Tonight flow.
**Depends on**: Nothing (builds on shipped Phase 1-2 catalog + Tonight flow)
**Requirements**: MOOD-01, MOOD-02, MOOD-03, MOOD-04, MOOD-05, MOOD-06, MOOD-07
**Success Criteria** (what must be TRUE):
  1. A member can open any title's detail view and see auto-suggested moods derived from TMDB genres + runtime.
  2. A member can add a personal mood tag to a title and another member sees it on that title within Firestore real-time latency (<2s).
  3. A member can remove a mood tag they added, and it disappears for all family members.
  4. The Tonight filter bar shows a mood control; selecting moods narrows the spin candidate pool and the active moods are visible + clearable without reopening the panel.
  5. Spinning with active mood filters only picks from titles matching at least one selected mood.
**Plans**: 2 plans
Plans:
- [x] 03-01-PLAN.md — Detail-view mood editing: render moods between genre pills and overview; add/remove via inline chips and palette; autoBackfill moodsUserEdited guard (MOOD-01, MOOD-02, MOOD-03, MOOD-04)
- [x] 03-02-PLAN.md — Tonight active-mood inline row: × clear per chip outside the collapsible panel; MOOD-05/06 regression-confirmed (MOOD-05, MOOD-06, MOOD-07)
**UI hint**: yes

### Phase 4: Veto System
**Goal**: Any member can reject a pick — before the spin (removing a title from the pool) or after (triggering a re-spin) — with the veto propagating in real-time, carrying optional context, and respecting a fairness rule so the vetoer doesn't control the replacement.
**Depends on**: Nothing (independent of Phase 3; operates on the shared Tonight session state)
**Requirements**: VETO-01, VETO-02, VETO-03, VETO-04, VETO-05, VETO-06
**Success Criteria** (what must be TRUE):
  1. A member can veto a title pre-spin and it disappears from the candidate pool on all connected devices within 2s.
  2. A member can veto the spin result post-spin and the system picks a new title from the remaining pool within 2s on all connected devices.
  3. Every veto event surfaces who vetoed (and the optional reason, if provided) to all family members in real-time.
  4. The member who just vetoed is not selected as the re-spinner for that same session.
  5. Vetoes persist per-member to Firestore in a shape consumable by the Phase 6 recap.
**Plans**: 3 plans
Plans:
- [x] 04-01-PLAN.md — Firestore foundation: vetoHistory subcollection, updateDoc dotted-path writes, myVetoesToday + cap=2, unveto same-session gate (VETO-01, VETO-04, VETO-05)
- [x] 04-02-PLAN.md — Post-spin veto UX + auto re-spin + fairness gate + D-04 mood-filter relaxation; .spin-veto + .t-spin.disabled CSS (VETO-02, VETO-06)
- [x] 04-03-PLAN.md — Real-time veto toast + cross-device shimmer via subscribeSession diff (VETO-03)
**UI hint**: yes

### Phase 5: Auth + Groups
**Goal**: Replace the anonymous family-code model with real member accounts plus optional password-protected groups, and provide a non-disruptive migration path for existing families. This unlocks device-independent identity, push targeting, invite flows, and downstream monetization.
**Depends on**: Nothing hard; all subsequent phases (Push, Watchparty, Intent, Year-in-Review) depend on this.
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05 (details refined in /gsd-discuss-phase 5)
**Success Criteria** (what must be TRUE):
  1. A new user can create an account, sign in, and be associated with a family (or a new family they create).
  2. A family owner can optionally set a password on the group; joining that group then requires the password in addition to any invite code.
  3. An existing family (pre-auth) can complete a one-time claim flow so each current member name gets linked to a real account without data loss.
  4. All Firestore writes that previously identified a member by a family-local `id` now carry a stable `uid` from the auth layer.
  5. Existing features (Tonight, Mood, Veto, existing Sports Watchparty) continue to work end-to-end after migration.
**Plans**: 9 plans
Plans:
- [ ] 05-01-PLAN.md — Auth infrastructure: firebase.js + authDomain flip + js/auth.js module + state/constants extensions (AUTH-01)
- [ ] 05-02-PLAN.md — External service config checkpoint: Apple Developer + Firebase console + hosting /__/auth passthrough (AUTH-01)
- [ ] 05-03-PLAN.md — Cloud Functions scaffold: setGroupPassword, joinGroup, claimMember, inviteGuest, transferOwnership in sibling queuenight/ repo (AUTH-02, AUTH-03, AUTH-04)
- [ ] 05-04-PLAN.md — Firestore security rules + /settings/auth bootstrap + rules unit tests (AUTH-02, AUTH-03, AUTH-04, AUTH-05)
- [ ] 05-05-PLAN.md — writeAttribution utility + migrate ~25 Firestore write sites + self-echo guard updates (AUTH-02, AUTH-05)
- [ ] 05-06-PLAN.md — Sign-in screen UI + bootstrapAuth + onAuthStateChanged + replace submitFamily flow (AUTH-01, AUTH-02)
- [x] 05-07-PLAN.md — Member-type model: sub-profiles + act-as + guest invites + owner password/transfer + group switcher sync (AUTH-02, AUTH-03)
- [ ] 05-08-PLAN.md — Migration claim flow + sub-profile graduation + mintClaimTokens CF + grace-window enforcement (AUTH-04, AUTH-05)
- [ ] 05-09-PLAN.md — iOS PWA UAT checkpoint: all providers + feature regression + migration scenarios (AUTH-05)
**UI hint**: yes

### Phase 6: Push Notifications
**Goal**: Deliver real push notifications for events that genuinely benefit from them (watchparty starting, invite received, tonight's pick chosen, veto cap hit, intent match reached) — starting with a research spike comparing web push vs native-wrapped delivery against iOS/Android/desktop PWA constraints and how competitors (Teleparty, Plex, Kast, Scener, Letterboxd, TV Time) handle it.
**Depends on**: Phase 5 (requires stable `uid` to target notifications)
**Requirements**: PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05 (details refined in /gsd-discuss-phase 6; includes an explicit research/spike sub-phase)
**Success Criteria** (what must be TRUE):
  1. A documented research artifact compares web-push, Capacitor-wrapped push, and FCM/OneSignal options against the app's iOS-first PWA reality — recommendation adopted.
  2. A signed-in user can opt in to push on each device they use, per-event-type, with a clear permission prompt.
  3. At least one event (watchparty-starting) delivers a real push within ~5s on iOS (home-screen PWA) and Android.
  4. A muted / do-not-disturb state respects per-user and per-family quiet hours.
  5. No push is sent to a user for their own action (self-echo guard, same pattern as VETO-03).
**Plans**: TBD — starts with a research spike
**UI hint**: partial (settings + permission flow)

### Phase 7: Watchparty
**Goal**: Once a Tonight's pick is chosen (or a title-intent match lands — see Phase 8), any member can launch a watchparty that tracks per-member elapsed time across every family device, lets everyone react in real-time, and pushes invites to those who haven't joined. Builds on the Sports watchparty scaffolding already in `js/app.js`, now generalized and auth/push-aware.
**Depends on**: Phase 5 (identity) and Phase 6 (push invites). Benefits from the existing watchparty banner scaffolding in `index.html`.
**Requirements**: PARTY-01, PARTY-02, PARTY-03, PARTY-04, PARTY-05, PARTY-06, PARTY-07 (IDs unchanged; PARTY-03 sync model refined in /gsd-discuss-phase 7)
**Success Criteria** (what must be TRUE):
  1. A member can start a watchparty from the Tonight's Pick card; other family members see a joinable banner on their device within 2s AND receive a push if opted in.
  2. Play/pause/seek signals (interpretation TBD in discuss — advisory per-member timer vs host-broadcast state vs consensus) sync across devices with sub-second drift during steady-state.
  3. Members can send reactions during a session; reactions surface on every participating device in real-time.
  4. A session ends cleanly via host-end, all-members-left, or inactivity timeout — with no orphan `watchparty` documents remaining in Firestore after end.
  5. The Tonight screen displays the watchparty banner whenever a session is active for the current family.
**Plans**: 8 plans (4 original + 4 gap-closure from UAT 2026-04-21)
Plans:
- [x] 07-01-PLAN.md — Watchparty lifecycle state machine: scheduled→active flip + watchpartyTick CF + lastActivityAt bookkeeping (PARTY-06)
- [x] 07-02-PLAN.md — Tonight's Pick "Watch together" CTA + live watchparty banner on Tonight screen (PARTY-01, PARTY-07)
- [x] 07-03-PLAN.md — Reaction palette (8 emoji + picker) + advisory per-member timer strip (PARTY-03, PARTY-04, PARTY-05)
- [x] 07-04-PLAN.md — Phase 7 UAT checkpoint: 8/8 PASS, 4 gap-closure issues surfaced (PARTY-02, PARTY-03, PARTY-04, PARTY-05, PARTY-06, PARTY-07)
- [x] 07-05-PLAN.md — GAP: creatorTimeZone capture + CF push-body tz render (fixes UAT Issue #1 — timezone display offset on watchpartyScheduled push) (PARTY-06) ✓ 2026-04-22
- [x] 07-06-PLAN.md — GAP: setWpMode optimistic re-render + late-joiner wallclock backlog override (fixes UAT Issues #2a + #3) (PARTY-03, PARTY-04) ✓ 2026-04-22
- [x] 07-07-PLAN.md — GAP: reaction-delay feature — viewer-side elapsed-filter shift + UI chips + participant field (closes UAT Issue #2b net-new) (PARTY-04) ✓ 2026-04-21
- [x] 07-08-PLAN.md — GAP: on-time inference + late-joiner "I started on time" override — effectiveStartFor helper + claimStartedOnTime persist + participant-strip chip affordance (closes UAT Issue #4) (PARTY-03) ✓ 2026-04-22
**UI hint**: yes

### Phase 8: Watch-Intent Flows
**Goal**: Split Couch's "who wants to watch?" primitive into two first-class flows: (a) **Tonight @ time** — time-bound RSVP for a specific movie/show at a specific time tonight-ish, and (b) **Watch-this-title** — content-bound interest poll that doesn't require a time commitment. Both supported for solo, duo, and family group sizes, with group-appropriate threshold rules (e.g., any-yes for duo, majority for family).
**Depends on**: Phase 5 (identity) and Phase 6 (push for intent-match notifications). Reuses Mood (Phase 3) and Veto (Phase 4) filters where applicable.
**Requirements**: INTENT-01, INTENT-02, INTENT-03, INTENT-04, INTENT-05, INTENT-06 (details refined in /gsd-discuss-phase 8)
**Success Criteria** (what must be TRUE):
  1. A member can start a "Tonight @ time" flow with an optional scheduled time; other members see it and RSVP.
  2. A member can start a "Watch-this-title" interest poll on any title; other members see it and mark Yes/No/Later.
  3. A positive match (threshold-defined per group size) surfaces as a prompt that can auto-schedule a Tonight or auto-launch a Watchparty depending on flow type.
  4. Group-size-aware thresholds apply: duos need any-yes; families use majority (configurable).
  5. Both flows cleanly end, expire, or convert without leaving orphan docs in Firestore — same pattern as VETO-01/PARTY-06.
**Plans**: TBD — finalized at plan-phase
**UI hint**: yes

### Phase 9: Redesign / Brand / Marketing Surface
**Goal**: Do a full visual and brand pass before launch: nail the logo + app icon + marketing favicon, audit and refine the warm dark palette, refine typography token usage, rebuild every screen against a finalized design system, add a proper landing page at `couchtonight.app` root plus App-Store-style screenshot marketing, and polish onboarding to match. Last phase before Year-in-Review so that YIR's shareable surfaces render against the final brand.
**Depends on**: All feature phases (3-8). Must happen before Year-in-Review so shareable recap cards land on final-brand design tokens.
**Requirements**: DESIGN-01 through DESIGN-10 (details refined in /gsd-discuss-phase 9; covers visual identity, UI refresh, marketing surface, onboarding polish, launch assets)
**Success Criteria** (what must be TRUE):
  1. Final logo, app icon set, and favicon ship in the repo and are wired to manifest + all head assets.
  2. Every in-app screen renders against a canonical design-token system (colors, type, spacing, motion) with zero one-off inline styles for brand-critical surfaces.
  3. A landing page at `couchtonight.app` root exists, explaining what Couch is, who it's for, and driving to install/signup — mobile-first, warm cinematic design language.
  4. An App-Store-ready marketing asset set (hero screenshots, feature screenshots, iconography) is produced and stored alongside the landing page.
  5. Onboarding (first-run + invite-flow) is polished to match the redesign and includes tastefully-introduced feature surfaces (moods, veto, watchparty, push opt-in).
**Plans**: 8 plans (revised 2026-04-21 — checker revision 1 split 09-07 into 09-07a + 09-07b for context + blast-radius reasons)
Plans:
- [ ] 09-01-PLAN.md — Identity pipeline: canonical SVG logo + wordmark sources + regenerated PNG icon set + maskable variant (40% safe-zone) + iOS cache-bust verification (DESIGN-01)
- [x] 09-02-PLAN.md — Token canonicalization: 3-tier hierarchy (primitive + semantic + motion extensions + font-family tokens) + palette drift reconcile + WCAG contrast notes (DESIGN-02, DESIGN-03, DESIGN-09 first half)
- [x] 09-03-PLAN.md — Inline-style purge: 119 style= attrs reduced to 36 (residuals are JS-controlled display:none toggles per Pitfall-2 defense), 53 token-backed classes, 7-class dynamic-className census preserved verbatim, 3 atomic commits (DESIGN-03 closes; DESIGN-04 first half)
- [x] 09-04-PLAN.md — Desktop responsive layer: .phone-shell wrapper + single @media (min-width:900px) block + watchparty-modal expansion closes Phase 7 UAT gap + tabbar clearance probe (DESIGN-04 second half) — 2 atomic commits, all 14 @media selectors pre-flight-verified, zero stale pruned
- [x] 09-05-PLAN.md — Landing page: standalone landing.html at /, app.html at /app, zero-JS install redirect, JSON-LD + OG meta, Firebase Hosting rewrites, stale public/index.html removed, deployed to couchtonight.app — 2 atomic commits + 1 prod deploy, all 7 post-deploy automated gates green (DESIGN-05 closes)
- [x] 09-06-PLAN.md — Marketing assets: 5 iPhone screenshots (tonight-hero/watchparty-live/mood-filter/title-detail/intent-rsvp) captured + optimized via sharp + wired to landing with CSS phone-frame treatment + deployed to couchtonight.app. og.png deferred to ship with wordmark redesign. Refresh tracked in Phase 12 docket. (DESIGN-06)
- [x] 09-07a-PLAN.md — Brand-facing polish: first-run onboarding (DESIGN-07), BRAND.md (DESIGN-10), intent CF timezone fix; absorbs 3 seeds (05x account-linking 6+7, 05x legacy-family-ownership, 08x intent-cf-timezone) — 3 atomic commits + production deploy of hosting + firestore.rules + onIntentCreated CF (2026-04-23)
- [x] 09-07b-PLAN.md — Guest-auth + motion: firestore.rules architecture documentation (Task 1 reframed — invariant gate was false-positive; CF+admin-SDK bypasses rules), guest invite redemption + consumeGuestInvite CF (DESIGN-08), motion audit (DESIGN-09 second half); absorbed 05x guest-invite-redemption seed — 3 atomic commits + production deploy of hosting + functions:consumeGuestInvite + functions:inviteGuest (2026-04-24)
**UI hint**: yes (this IS the UI phase)

### Phase 10: Year-in-Review — **DEFERRED** (paused 2026-04-25, revisit post-launch)
> User judgment 2026-04-25: "Makes more sense once the app has had some success." YIR depends on accumulated watch history per family + audience to recap *for*; both are thin pre-launch. UI surfaces (`#settings-yir-section` + `#yir-modal-bg` etc.) are already hidden in production via `state.family.yirReady` gate from Plan 11-02 — no code changes needed to "hide" YIR; flag stays false. Partial implementation in `js/app.js` (`openYearInReview` / `renderYearInReview` / `shareYearInReview`) is unreachable through UI, kept dormant for the eventual return. CONTEXT.md preserved at `.planning/phases/10-year-in-review/10-CONTEXT.md` as the working document for revisit.

**Goal**: At year-end (or on-demand), each member and the family as a whole can see a recap of their viewing year — titles, runtime, genre and mood distribution, favorites, shared-watch patterns, intent-flow "most-anticipated," and veto/watchparty highlights — packaged in a shareable surface that lands on the final Phase 9 brand.
**Depends on**: Phase 3 (mood-tag distribution), Phase 4 (veto history), Phase 7 (watchparty activity), Phase 8 (intent flows for "most-anticipated"), Phase 9 (final brand tokens for shareables).
**Requirements**: YEAR-01, YEAR-02, YEAR-03, YEAR-04, YEAR-05 (IDs unchanged; YEAR-04 expanded in /gsd-discuss-phase 10 to include intent-flow stats)
**Success Criteria** (what must be TRUE):
  1. A member can open the Year-in-Review surface and see their own watch history for the year aggregated into readable stats.
  2. Per-member stats show titles watched, total runtime, top genres, and mood-tag distribution sourced from Phase 3 data.
  3. Per-member favorites highlight top-rated titles drawn from Yes votes and Trakt ratings.
  4. Family-level stats show most-watched-together, most-vetoed (from Phase 4), longest watchparty (from Phase 7), and most-anticipated-but-never-watched (from Phase 8 intent data).
  5. The recap can be shared off-app — at minimum one of: export image, copy link, or save-to-device — rendered against Phase 9's finalized brand without breaking the warm/cinematic design language.
**Plans**: 3 plans (TBD — finalized at plan-phase). Also: the YIR marketing screenshot from Phase 9 plan 09-06 was deferred to Phase 10 (Major-6 checker closure) — rerun the marketing-screenshot-plan.md pipeline once YIR UI surfaces ship.
**UI hint**: yes

### Phase 12: Pre-launch polish
**Goal**: Three small, independent fixes that close gaps surfaced during Phase 11 UAT and Phase 6 push closure: (1) per-event notification preferences UI in Account → YOUR COUCH → Notifications so users can exercise the prefs that Phase 6 already enforces server-side; (2) About / version / feedback / changelog footer in ADMIN cluster (cheap, high-trust); (3) Couch Nights pack ID curation pass (Plan 11-07 had `tmdbId 9532` for "Hocus Pocus" but it actually resolves to "Final Destination" — verify all 8 packs).
**Depends on**: Phase 6 (notif pref server-side enforcement) + Phase 11 (Account tab cluster structure + Couch Nights pack data).
**Requirements**: POL-01 (per-event notif prefs UI), POL-02 (about/version/feedback), POL-03 (Halloween Crawl curation), POL-04 (other-7-packs curation, stretch).
**Success Criteria** (what must be TRUE):
  1. Notif card in Account → YOUR COUCH expands to show 6 per-event toggles (watchpartyScheduled, watchpartyStartingNow, intentRsvpRequested, inviteReceived, vetoCapReached, tonightPickChosen) + quiet hours start/end pickers; toggle changes write to `users/{uid}.notificationPrefs` immediately with optimistic UI.
  2. About sub-section ships at the bottom of ADMIN & MAINTENANCE cluster: version line ("Couch v{N} — deployed {YYYY-MM-DD}"), mailto feedback link, "What's new" link to `/changelog.html`.
  3. `/changelog.html` standalone page exists (mirror of landing.html posture: no app shell, no Firebase SDK), lists last 5-10 releases with one-line user-facing summaries, served via Firebase Hosting rewrite `/changelog` → `/changelog.html`.
  4. Halloween Crawl `tmdbId 9532` swapped for the real Hocus Pocus ID; full audit pass on all 8 packs verifying first ID's title matches the comment label; mismatches fixed.
  5. sw.js CACHE bumped (likely v32-pre-launch-polish) so installed PWAs invalidate.
**Plans**: 3 plans
Plans:
- [x] 12-01-PLAN.md — Per-event notification preferences UI in #notif-card: 6 toggles + quiet hours + BRAND-aligned switch primitive + sw.js CACHE v32-pre-launch-polish bump (POL-01) ✓ b1ab9a9
- [x] 12-02-PLAN.md — ABOUT sub-section in ADMIN cluster: version + mailto feedback + /changelog.html standalone page + Firebase Hosting rewrite + TMDB attribution on landing.html footer (POL-02 / D-19 bundled) ✓ 6323530
- [x] 12-03-PLAN.md — Couch Nights TMDB id curation pass: audit all 8 packs against TMDB API, swap Halloween Crawl 9532 → 10439 Hocus Pocus (canonical id; plan-text 10661 was wrong, deviation documented), 14 total mismatches across 5 packs corrected, drift-prevention header (POL-03, POL-04) ✓ 004255b
**UI hint**: yes (Account tab notif card expansion + new ABOUT sub-section)

### Phase 11: Feature refresh & streamline
**Goal**: Take Couch from "functional PWA with post-Phase-9 brand refresh" to "decision ritual product that nobody else ships." Two parallel tracks: (1) declutter + streamline the in-app surfaces the user flagged as too busy / too prominent / too dated, plus a coherent Family + Account tab restructure, and (2) feature-expand the moat — what competitive research identified as Couch's unmet differentiation: Web RSVP route + Web Share API nurture, pre-session lobby, late-joiner catch-me-up recap, post-session loop, dedicated Sports Game Mode, themed "Couch Nights" packs.
**Depends on**: Phase 9 (design tokens, landing page, app.html + sw.js live). Phase 10 (YIR) independent — can ship before, after, or in parallel.
**Requirements**: REFR-01, REFR-02, REFR-03, REFR-04, REFR-05, REFR-06, REFR-07, REFR-08, REFR-09, REFR-10, REFR-11, REFR-12, REFR-13 (13 items, 6 user decisions locked 2026-04-23 in 11-CONTEXT.md)
**Success Criteria** (what must be TRUE):
  1. UX tightening ships: mood chip spacing tightened, "whose turn to pick" surfaces hidden (feature-flag reversible, backend writes preserved), "who's on the couch" card redesigned to a denser format.
  2. Family tab regroups 6 sections → 5 (Tonight status NEW, Approvals, Members split active vs sub-profiles, Couch history consolidated, Group settings footer); Account tab regroups 9 sections → 3 cognitive clusters (You, Couch-wide, Admin & maintenance). No feature removal — pure reorganization.
  3. Add-tab discovery expands from 4 rows to an 8-10 rows/day hash-seeded rotation over a 35-row catalog (6 buckets: always-on / trending / discovery / use-case / theme-of-the-day / seasonal / group-aware); auto-categories in v1 (curated lists + Browse-all + personalization in 11-03b).
  4. Watchparty lifecycle is end-to-end: `/rsvp/<token>` web route serves a lightweight HTML+JS RSVP page (no full app shell), Web Share API integration in schedule modal, member-conversion-on-first-RSVP, asymmetric push reminder cadence per RSVP state (members only; SMS nurture deferred to Milestone 2), pre-session lobby with Ready check + democratic auto-start at T-0, late-joiner catch-me-up 30s recap, post-session 5-star rating + photo + schedule-next.
  5. Dedicated Sports Game Mode ships: `SportsDataProvider` abstraction (ESPN + BALLDONTLIE), game picker, live score strip, kickoff countdown + auto-transition, play-scoped amplified reactions, late-joiner "current score + last 3 plays" card, team-flair avatar badges, per-user DVR offset slider.
**Plans**: 8 plans across 4 waves — finalized 2026-04-24 via /gsd-plan-phase 11
Plans:
- [x] 11-01-PLAN.md — UX tightening: mood chip spacing, picker-hide feature flag, who-card redesign (REFR-01, REFR-02, REFR-03) [complete 2026-04-24]
- [x] 11-02-PLAN.md — Family + Account tab restructures (REFR-11, REFR-12) [complete 2026-04-24]
- [x] 11-03a-PLAN.md — Discovery rotation engine + auto-category rows (REFR-04 first half) [complete 2026-04-24]
- [x] 11-03b-PLAN.md — Curated lists + Browse-all + personalization (REFR-04 second half) [complete 2026-04-24]
- [x] 11-04-PLAN.md — Web RSVP route + Web Share API + async push nurture (REFR-05, REFR-06) [complete 2026-04-24; deploy deferred pending Blaze billing confirmation]
- [x] 11-05-PLAN.md — Pre-session lobby + late-joiner catch-me-up + post-session loop (REFR-07, REFR-08, REFR-09) [complete 2026-04-24; deploy deferred with 11-04 pending Blaze billing + Firebase Storage enablement]
- [x] 11-06-PLAN.md — Sports Game Mode v1: SportsDataProvider, game picker, score strip, play-scoped reactions, DVR slider (REFR-10) [complete 2026-04-24; deploy deferred — ESPN ToS-gray accepted per threat model; BALLDONTLIE swap stub in place]
- [x] 11-07-PLAN.md — Couch Nights themed ballot packs (REFR-13) [complete 2026-04-24; 8 packs with curated TMDB IDs + pack-detail sheet + seed-ballot Vote-mode launcher; deploy deferred with 11-04+11-05+11-06 batch]
**UI hint**: yes (heavy UI touches; UI-SPEC.md to be generated via /gsd-ui-phase 11 before planning)

### Phase 13: Compliance & Ops Sprint
**Goal**: Operational hygiene + compliance hardening sprint after v1 ships. Five items: self-serve account deletion (closes the manual privacy.html promise), Sentry error reporting (so prod errors are visible without user complaint), BUILD_DATE auto-stamp + GitHub branch protection (small ops + future-proofing), scheduled daily Firestore export (~30-day rollback window for accidental data loss), and Content-Security-Policy in Report-Only mode (defense-in-depth + 2-week observation window before enforcement). Not a feature phase — no new product surfaces.
**Depends on**: Phase 5 (auth — required for COMP-01 to bind soft-delete to a uid), Phase 11 (storage rules + couch-albums path schema — required for the deletion reaper's storage sweep), Phase 12 (BUILD_DATE constant + ABOUT version line consumes the auto-stamp), and operationally inherits from all prior phases.
**Requirements**: COMP-13-01 (self-serve account deletion), OPS-13-02 (BUILD_DATE auto-stamp), OPS-13-04 (CSP report-only), OPS-13-05 (Sentry), OPS-13-06 (GitHub branch protection), OPS-13-07 (scheduled Firestore export). Deferred to Phase 14: OPS-13-01 (firebase-functions SDK 4→7 — TD-1 stays open). Deferred to a later milestone: OPS-13-03 (Variant-B storage rules — TD-2 gated on Phase 5 member-uid migration).
**Success Criteria** (what must be TRUE):
  1. A signed-in user can delete their account from Account → ADMIN; soft-delete enters a 14-day grace window during which they can cancel; after 14 days the scheduled reaper hard-deletes Firestore + Storage + Auth and writes an audit doc.
  2. Uncaught JS errors and unhandled promise rejections from app.html + landing.html are reported to Sentry with PII (email, family codes, tokens) scrubbed by `beforeSend`.
  3. Direct push to main on github.com/<owner>/couch is rejected by the `protect-main` ruleset; PRs require the `syntax-check` CI job to pass; force-push and deletion are blocked.
  4. `scripts/deploy.sh` runs end-to-end: tests + node --check + BUILD_DATE auto-stamp + optional sw.js CACHE bump + mirror + firebase deploy + smoke test.
  5. A Cloud Scheduler job `daily-firestore-export` exports Firestore daily to `gs://queuenight-84044-backups/` (us-central1) with a 30-day lifecycle delete rule + uniform-bucket-level-access.
  6. couchtonight.app/* responses include `Content-Security-Policy-Report-Only` header allow-listing all third-party origins (Firebase + TMDB + Trakt + Google Fonts + Sentry + Cloud Functions); existing X-Content-Type-Options + Referrer-Policy + X-Frame-Options preserved verbatim.
**Plans**: 5 plans across 3 waves
Plans:
- [x] 13-01-PLAN.md — COMP-01 self-serve account deletion: 4 new CFs (requestAccountDeletion + cancelAccountDeletion + checkAccountDeleteEligibility + accountDeletionReaper) in queuenight/functions/src/ + Account → ADMIN delete button + typed-DELETE modal + ownership-blocker modal + sign-in soft-delete detour + sw.js CACHE bump (COMP-13-01) [Wave 1] — code-complete 2026-04-25 (ccd3eec/4fc49ee/6665648)
- [x] 13-02-PLAN.md — OPS-05 Sentry integration: CDN loader + sentryOnLoad config in app.html + landing.html with PII-scrubbing beforeSend + Firestore noise-filtering beforeBreadcrumb + sw.js bump (OPS-13-05) [Wave 2 — depends on 13-01 for sw.js + app.html merge order] — code-complete 2026-04-25 (19f9f6a/7b9aa5e/bd2890f/e4f2c89); DSN placeholder aligns with deploy.sh MEDIUM-5 guard
- [x] 13-03-PLAN.md — OPS-02 BUILD_DATE auto-stamp + OPS-06 GitHub branch protection bundle: scripts/deploy.sh + npm run deploy/stamp shortcuts + RUNBOOK §H §J §L + protect-main ruleset checkpoint (OPS-13-02, OPS-13-06) [Wave 1 — parallel with 13-01; no file overlap] — code-complete 2026-04-25 (7df42a2/45a9da7/cc8b784); HUMAN-VERIFY: GitHub ruleset config + optional QUEUENIGHT_PATH env
- [x] 13-04-PLAN.md — OPS-07 scheduled Firestore export: scripts/firestore-export-setup.sh idempotent gcloud setup + RUNBOOK §I §K (restore drill + setup runbook) + manual smoke-test checkpoint (OPS-13-07) [Wave 3 — depends on 13-03 for RUNBOOK merge order] — code-complete 2026-04-25 (4813bf2/69a9ed0); HUMAN-VERIFY: gcloud auth + run scripts/firestore-export-setup.sh
- [x] 13-05-PLAN.md — OPS-04 CSP report-only header: additive 4th header in queuenight/firebase.json + sw.js bump + TECH-DEBT.md TD-4 status update (OPS-13-04) [Wave 3 — depends on 13-01+13-02 for sw.js merge order] — code-complete 2026-04-25 (5149c7d/2a8ceed); CSP includes Sentry CDN+ingest + queuenight CFs + worker-src blob:
**UI hint**: minimal — only COMP-01 ships a user-visible button + 3 modals; everything else is ops/infra/headers. `--skip-ui` was passed at planning time per orchestrator context.

### Phase 15.2: Audit-trail backfill + project hygiene
**Goal**: Close the verification-artifact debt surfaced by the v33.3 milestone audit. Backfill `VERIFICATION.md` for Phases 5-9 (code shipped per integration check; audit trail thinned during the Auth/Push/Watchparty/Intent/Redesign sprint), backfill missing plan `SUMMARY.md` files, refresh REQUIREMENTS.md traceability table to reflect deployed state, and reconcile the milestone-label drift across init/STATE/ROADMAP/config sources. Not a feature phase — pure documentation/audit-trail closure. Inserted as decimal phase post-v33.3 milestone audit (mirrors 03.5 + 15.1 precedent), NOT a slot reassignment.
**Depends on**: Nothing — pure planning-doc work; references existing PLANs + commits + production code as evidence.
**Requirements**: Closes orphan gaps for AUTH-01..05, PUSH-01..05, PARTY-01/02/05/07, INTENT-01..06, DESIGN-02..10 (32 requirements; DESIGN-01 deferred to Phase 15.3). Closes partial-status gaps for POL-01..04, COMP-13-01, OPS-13-04/05/07, DECI-14-01, TRACK-15-01..14 (verification-status partials, 19 requirements).
**Success Criteria** (what must be TRUE):
  1. `05-VERIFICATION.md`, `06-VERIFICATION.md`, `07-VERIFICATION.md`, `08-VERIFICATION.md`, `09-VERIFICATION.md` all exist and document satisfied REQ-IDs with code-evidence references (per integration check F-W-3/4/5/6).
  2. Missing SUMMARYs backfilled from existing artifacts (commits, code locations): `05-01-SUMMARY.md`, `07-01..04-SUMMARY.md`, `08-01..05-SUMMARY.md`. (`09-01-SUMMARY.md` deferred to Phase 15.3 since it depends on producing the SVG source.)
  3. `REQUIREMENTS.md` traceability table flips ~28 stale "Pending" rows to "Complete" with phase + commit references; coverage count refreshed.
  4. `ROADMAP.md` Progress table entries for Phases 5/9 updated from "Not started" to reflect actual SHIPPED state.
  5. Milestone label normalized: pick canonical name (recommend `v1-commercial-release`) and update `STATE.md` milestone field + ensure init tool reads it consistently.
  6. `CLAUDE.md` token-budget note updated for `js/app.js` (15757 lines, not ~10200).
**Plans**: 7 plans across 3 waves — finalized 2026-04-27 via /gsd-plan-phase 15.2 (research + planner + plan-checker pipeline)
Plans:
- [ ] 15.2-01-PLAN.md — Phase 5 backfill: 05-VERIFICATION.md + 05-01-SUMMARY.md + 05-09-SUMMARY.md (AUTH-01..05) [Wave 1]
- [ ] 15.2-02-PLAN.md — Phase 6 backfill: 06-VERIFICATION.md + 5 plan SUMMARYs 06-01..05 (PUSH-01..05) [Wave 1]
- [ ] 15.2-03-PLAN.md — Phase 7 backfill: 07-VERIFICATION.md + 4 plan SUMMARYs 07-01..04 (PARTY-01/02/05/07 orphaned + PARTY-03/04/06 partial-traced) [Wave 1]
- [ ] 15.2-04-PLAN.md — Phase 8 backfill: 08-VERIFICATION.md + 5 plan SUMMARYs 08-01..05 (INTENT-01..06; largest single audit-trail gap pre-15.2) [Wave 1]
- [ ] 15.2-05-PLAN.md — Phase 9 backfill: 09-VERIFICATION.md only (DESIGN-02..10 SATISFIED; DESIGN-01 documented as UNSATISFIED with forward-pointer to Phase 15.3; 09-01-SUMMARY.md OUT OF SCOPE) [Wave 1]
- [ ] 15.2-06-PLAN.md — REQUIREMENTS.md + ROADMAP.md refresh: 28 traceability rows flipped Pending→Complete + inline checkboxes + Coverage line 59→87 + Progress table for Phases 5/6/7/8/9 + Plans-list reconciliation for Phases 5/6/8 (POL-01..04 + COMP-13-01 + OPS-13-04/05/07 + DECI-14-01 + cross-cuts orphan REQ flips from 15.2-01..05) [Wave 2 — ROADMAP.md file-overlap with 15.2-07]
- [ ] 15.2-07-PLAN.md — Hygiene pass: STATE.md milestone-label normalization (v35.1-security-hardening → v1-commercial-release; new sw_cache_version field) + ROADMAP narrative milestone refs + CLAUDE.md token-budget refresh for js/app.js (15757 lines, was ~10200; uses wc -l ONLY — never full Read) [Wave 3 — depends on 15.2-06 for ROADMAP.md merge order]
**UI hint**: none — pure documentation phase

### Phase 15.3: DESIGN-01 — canonical SVG logo + wordmark sources
**Goal**: Produce the canonical SVG source-of-truth for the Couch logo + wordmark that should have shipped in Plan 09-01 but was skipped (PNG icon set was wired to manifest, but no SVG sources exist for re-export, marketing assets, or future native icon-set regeneration). Closes the only genuinely unsatisfied requirement from the v33.3 milestone audit. Inserted as decimal phase post-v33.3 milestone audit (mirrors 03.5 + 15.1 precedent), NOT a slot reassignment.
**Depends on**: Existing PNG icon set at repo root (`mark-{16,32,..,512}.png`, `apple-touch-icon`) as the visual reference. Phase 9 design tokens (warm dark palette, Fraunces + Instrument Serif typography).
**Requirements**: DESIGN-01.
**Success Criteria** (what must be TRUE):
  1. Canonical `logo.svg` source produced at viable repo path (e.g., `assets/brand/logo.svg`); vector-correct rendering of the existing PNG mark.
  2. `wordmark.svg` produced for marketing surfaces (landing page, marketing screenshots, og.png eventually).
  3. Existing PNG icon set regenerated FROM the SVG (verifies SVG is true source-of-truth + invalidates any PNG drift).
  4. `09-01-SUMMARY.md` written documenting the deliverable + linking SVG path + regeneration command.
  5. DESIGN-01 status flipped to Complete in REQUIREMENTS.md traceability table.
**Plans**: TBD — finalized at `/gsd-plan-phase 15.3`
**UI hint**: yes (visual / brand assets)

### Phase 15.4: Integration polish — push fan-out + Settings parity
**Goal**: Close the 2 user-impacting FLAGS surfaced by the v33.3 integration check: (F-W-1) `sendCouchPing` toasts "Push sent to {name}" without actually firing any push, breaking the Couch viz V5 roster proxy promise (DECI-14-06); (D-3) friendly-UI Settings screen at `js/app.js:128-155` is missing 8 push toggles (7 D-12 keys + `newSeasonAirDate`) that the legacy `NOTIFICATION_EVENT_LABELS` Settings screen exposes — DR-3 dual-Settings-screen collision risk leaves POL-01 partial. Inserted as decimal phase post-v33.3 milestone audit (mirrors 03.5 + 15.1 precedent), NOT a slot reassignment.
**Depends on**: Phase 14 (couch viz V5 + DECI-14-12 push key catalog), Phase 12 (POL-01 friendly-UI Settings surface), Phase 6 (push delivery infrastructure). Cross-repo: queuenight `functions/index.js` `NOTIFICATION_DEFAULTS` + `onIntentCreated` fan-out branches.
**Requirements**: Closes F-W-1 affecting DECI-14-06 + DECI-14-12; closes D-3 affecting POL-01 (full satisfaction) + DECI-14-12 + TRACK-15-09/10/11 parity.
**Success Criteria** (what must be TRUE):
  1. `sendCouchPing` is wired to a real push delivery path: either (a) add `couchPing` event type to queuenight `NOTIFICATION_DEFAULTS` + `NOTIFICATION_EVENT_LABELS` + new fan-out branch in `onIntentCreated` (or dedicated CF) + client subscription handler, OR (b) update UI copy to remove the misleading "Push sent" toast lie if push fan-out is deferred. Decision documented at `/gsd-plan-phase`.
  2. Friendly-UI Settings parity reached: either mirror 8 push keys (7 D-12 + `newSeasonAirDate`) into `NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS`, OR pick one Settings surface (legacy vs friendly) and remove the other to eliminate DR-3 collision. Decision documented at `/gsd-plan-phase`.
  3. POL-01 status flipped from partial to satisfied in audit re-run.
  4. `sw.js` CACHE bumped (likely `couch-v35.2-integration-polish` or similar) so installed PWAs invalidate on activation.
  5. Cross-repo deploy ritual followed per RUNBOOK §H + (if F-W-1 path A taken) `firebase deploy --only functions` from queuenight before couch hosting deploy.
**Plans**: TBD — finalized at `/gsd-plan-phase 15.4`
**UI hint**: yes (Settings surface) + minimal (Couch viz copy only if F-W-1 path B)


## Progress

**Execution Order:**
Phases 5 (Auth) and 6 (Push) are sequential foundation work — 6 depends on 5 for `uid` targeting. Phase 7 (Watchparty) and Phase 8 (Intent) both depend on 5+6 but can run in either order or in parallel. Phase 9 (Redesign) must run after all feature phases so the design system covers the final surface area. Phase 10 (Year-in-Review) depends on data from 3/4/7/8 and brand tokens from 9. Phase 11 (Feature refresh & streamline) slots after Phase 9 and is independent of Phase 10 — can ship before, after, or in parallel with YIR.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 2. Tonight + Voting (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 3. Mood Tags | 2/2 | Implementation complete — awaiting /gsd-verify-work | 03-02 complete 2026-04-20 |
| 4. Veto System | 3/3 | Implementation complete — awaiting /gsd-verify-work | 04-03 complete 2026-04-20 |
| 5. Auth + Groups | 0/? | Not started | - |
| 6. Push Notifications | 0/? | Not started | - |
| 7. Watchparty | 8/8 | Implementation complete — all gap-closure deployed; awaiting consolidated /gsd-verify-work 7 UAT | 07-08 deployed 2026-04-22 |
| 8. Watch-Intent Flows | 0/? | Not started | - |
| 9. Redesign / Brand / Marketing | 0/8 | Not started (planning revision 1 complete 2026-04-21 — split 09-07 into 09-07a + 09-07b) | - |
| 10. Year-in-Review | 0/3 | Not started | - |
| 11. Feature refresh & streamline | 8/8 | **CODE-COMPLETE** — All 8 plans shipped, all 13 REFR-* closed. W1 11-01 + 11-02 deployed; W2 11-03a + 11-03b deployed; W3 11-04 + 11-05 code-complete (deploy deferred); W4 11-06 + 11-07 code-complete (deploy bundled with W3). See 11-COMPLETION.md for phase rollup | 11-07 code 2026-04-24 |
| 12. Pre-launch polish | 3/3 | **SHIPPED** 2026-04-25 — POL-01 + POL-02 + POL-03/04 all deployed; 8/8 smoke tests pass | 12-03 deployed 2026-04-25 |
| 13. Compliance & Ops Sprint | 5/5 | **SHIPPED** 2026-04-25 — Code-side complete; 3/4 HUMAN-VERIFY items live in production: ✓ Sentry account+DSN+couchtonight.app deploy (couch-v33.3-sentry-dsn); ✓ branch protection on main (legacy product, repo flipped public per RUNBOOK §L); ✓ 4 Cloud Functions live in us-central1 (requestAccountDeletion + cancel + check + reaper). PR #1 squash-merged db03573. firestore:indexes deploy returned "not necessary" (auto-managed single-field index covers query — TD-7). REMAINING (gcloud-only, user-side): scripts/firestore-export-setup.sh against queuenight-84044. | shipped 2026-04-25 |
| 14. Decision Ritual Core | 10/10 | **SHIPPED 2026-04-26 — v34.1-roster-control deployed to couchtonight.app; queuenight firestore:rules + functions deployed; user-confirmed via 'approved-deploy' after V5 4-step UAT (visual + multi-device proxy + downstream contract regression). 5 deferred multi-device UAT items tracked in 14-UAT.md (44 of 50 tests pending physical-device verification — non-blocking, batch UAT pattern matching Phases 12/13).** Original This completes the Phase 14 wave structure (W1+W2+W3+W4 all shipped; cross-cutting Plan 14-09 closes the loop). 14-01 (already-watched filter, D-01 / DECI-14-01) + 14-02 (queue polish + Add-tab insertion + iOS DnD UAT, D-03 / DECI-14-03) + 14-06 (extend intents collection + CFs, D-09 / DECI-14-09) shipped 2026-04-25; 14-03 (tier aggregators T1/T2/T3 + T3 visibility resolver, D-02 / DECI-14-02) + 14-04 (Couch viz hero-icon + avatar-grid per sketch 001 winner P, D-06 / DECI-14-06) + 14-05 (tile redesign + Vote-mode preservation + carry-over UAT bug closure, D-04 + D-05 / DECI-14-04 + DECI-14-05) + 14-07 (Flow A group rank-pick + push-confirm UI, D-07 / DECI-14-07) + 14-08 (Flow B solo-nominate + counter-time + auto-convert + all-No edge, D-08 / DECI-14-08) + 14-09 (onboarding tooltips + 5 empty states + 7 push categories + sw.js v34 CACHE bump, D-10 + D-11 + D-12 + D-13 / DECI-14-10..13) shipped 2026-04-26 (14-09 = 5 atomic couch commits 8a36336 + ae7f0c0 + fdcb9dc + e572467 + 9132144 + queuenight uncommitted). **14-02 Task 3 iOS Safari touch-DnD UAT + 14-04 Task 5 visual + iOS PWA Couch viz UAT + 14-07 Task 5 multi-device Flow A UAT + 14-08 Task 5 multi-device Flow B UAT + 14-09 tooltip/empty-state/push UAT all DEFERRED** to batch UAT pass — all must run before v34 production deploy. **DEPLOY GATE for v34** is now CROSS-REPO ORDERED: (1) `firebase deploy --only functions` from `~/queuenight` (server-side NOTIFICATION_DEFAULTS knows the 7 D-12 keys + 14-06's CF branches live); (2) `firebase deploy --only firestore:rules --project queuenight-84044` from `~/queuenight` (per 14-04 Task 4 — couchSeating writes denied without it); (3) `bash scripts/deploy.sh 34.0-decision-ritual` from couch repo (auto-bumps sw.js CACHE if not already set, mirrors to queuenight/public/, runs firebase deploy --only hosting). After deploy, edit `changelog.html` to replace `[deploy date YYYY-MM-DD]` placeholder. **Originally tagged Phase 13 — see Phase-slot history below.** | shipped 2026-04-26 |
| 15. Tracking Layer | 8/8 | Complete    | 2026-04-27 |
| 15.1. Security Hardening | 3/3 | **CLOSED-OUT 2026-04-27** — Inserted post-Phase-15 audit. Closed 4 findings: F-OPEN-01 HIGH (`t.progress[X].source` forgeable — Trakt-overlap trust break) + WR-02 HIGH (regex injection via attacker-controlled `memberId`) + F-OPEN-02 MEDIUM (`tupleNames` not write-scoped to participants) + WR-03 MEDIUM (no rules-test coverage for `coWatchPromptDeclined`). Five SEC-15-1-* requirements all shipped in 3 plans across 3 waves: 15.1-01 (writer prep — dotted-path conversion + actingTupleKey stamping + pencil-glyph hide + setBy attribution), 15.1-02 (rules tightening — validAttribution() anchor + 4th title-doc sub-rule + replaced 5th family-doc branch + 6 new tests #33-#38), 15.1-03 (close-out — REVERSED cross-repo deploy ritual: HOSTING FIRST, then RULES — couch-v35.1-security-hardening live at couchtonight.app + queuenight-84044 rules updated). All 38 tests green; source/mirror parity verified. **Inserted as decimal phase (mirrors 03.5 precedent), NOT a slot reassignment.** | 2026-04-27 |
| 15.2. Audit-trail backfill + project hygiene | 0/? | **SCOPED, awaiting kickoff** — Closes 32 orphaned + 19 partial requirements from v33.3 milestone audit. Pure documentation phase: 5 missing VERIFICATION.md files (Phases 5/6/7/8/9), 10 missing SUMMARYs, REQUIREMENTS.md traceability refresh (~28 stale rows), ROADMAP Progress table sync (Phases 5/9 rows), milestone-label normalization (init/STATE/ROADMAP), CLAUDE.md token-budget update (js/app.js 15757 lines). **Inserted as decimal phase post-v33.3 milestone audit (mirrors 03.5 + 15.1 precedent), NOT a slot reassignment.** Audit: `.planning/v33.3-MILESTONE-AUDIT.md` (commit 001b259). | - |
| 15.3. DESIGN-01 — canonical SVG logo + wordmark | 0/? | **SCOPED, awaiting kickoff** — Closes the only genuinely unsatisfied requirement from v33.3 milestone audit (canonical SVG source never produced; PNGs wired to manifest but rebuild-from-source impossible). 3-task production phase: SVG logo + wordmark sources, PNG regen pipeline FROM SVG, 09-01-SUMMARY backfill. **Inserted as decimal phase post-v33.3 milestone audit, NOT a slot reassignment.** | - |
| 15.4. Integration polish — push fan-out + Settings parity | 0/? | **SCOPED, awaiting kickoff** — Closes 2 user-impacting FLAGS from v33.3 integration check: F-W-1 (`sendCouchPing` fake fan-out — UX lie at js/app.js:14174-14191; affects DECI-14-06 + DECI-14-12) + D-3 (friendly-UI Settings missing 8 push keys — DR-3 collision risk; POL-01 partial). Cross-repo: queuenight functions + couch client + sw.js bump. **Inserted as decimal phase post-v33.3 milestone audit, NOT a slot reassignment.** | - |
| 16. Calendar Layer | 0/? | **SCOPED, awaiting kickoff** — recurring + multi-future watchparty scheduling ("Wife and daughter watch American Idol every Monday"). New `watchpartySeries` doc primitive + week-view planning surface + edit/pause/cancel. Scope in `.planning/seeds/decision-ritual-locked-scope.md` Phase-16 section. **Originally tagged Phase 15.** | - |
| 17. App Store Launch Readiness | 0/? | **SCOPED, awaiting kickoff** — native wrapper (Capacitor or PWABuilder) for iOS App Store + Google Play; Apple Sign-In wiring (gated on $99/yr Apple Developer account); App Store Connect listings + categories + age rating + App Privacy declarations; privacy policy + ToS authoring. Scope notes in `.planning/seeds/phase-roadmap-2026-04-25-audit.md`. **NEW PROPOSAL** from 2026-04-25 audit (was originally suggested as Phase 16 in the audit; renumbered to 17 after Phase 13 slot reassignment.) | - |

---

## Phase-slot history (audit trail)

This section records phase-number reassignments to prevent scoped-but-unstarted work from being silently displaced. **When reassigning a phase number, append a row here AND update `.planning/seeds/` filenames if they reference the old number.**

| Date | Slot | What was originally there | What it became | Where the old scope lives now |
|------|------|---------------------------|----------------|------------------------------|
| 2026-04-25 | Phase 13 | Decision Ritual Core (8 plans, locked 2026-04-24) | Compliance & Ops Sprint (account deletion + Sentry + branch protection + CSP + Firestore export) | Decision Ritual scope moved to Phase 14; full content in `.planning/seeds/decision-ritual-locked-scope.md` (renamed from `phase-13-14-15-decision-ritual-locked-scope.md` to drop misleading phase numbers from the filename) |
| 2026-04-25 | Phase 14 | Tracking Layer (per-group progress) per 2026-04-24 scope | (still scoped; renumbered, not reassigned) | `.planning/seeds/decision-ritual-locked-scope.md` Phase-15 section |
| 2026-04-25 | Phase 15 | Calendar Layer (recurring watchparties) per 2026-04-24 scope | (still scoped; renumbered, not reassigned) | `.planning/seeds/decision-ritual-locked-scope.md` Phase-16 section |

**Convention:** seed-file names should describe CONTENT, not phase numbers (e.g. `decision-ritual-locked-scope.md`, NOT `phase-13-14-15-decision-ritual.md`). The active ROADMAP maps phase number → seed file; the seed file does not claim a phase number it might lose.

---
*Roadmap created: 2026-04-19*
*Restructured: 2026-04-20 (inserted Auth/Push/Intent/Redesign; pushed Year-in-Review to Phase 10)*
*Gap-closure plans added: 2026-04-21 (07-05..07-08 closing UAT Issues #1-#4)*
*Phase 9 plan split: 2026-04-21 (checker revision 1 split 09-07 into 09-07a + 09-07b for context + blast-radius reasons)*
*Phase 11 added: 2026-04-24 (post-Phase-9 polish + moat expansion; 8 plans / 13 REFR-* requirements; scoped via /gsd-discuss-phase 11 with 6 decisions locked)*
*Phase 13 added: 2026-04-25 (post-launch hardening sprint; 5 plans / 6 OPS-13-* + COMP-13-* requirements; planned via /gsd-plan-phase 13 with research + patterns + 6 locked decisions)*
*Phase 14/15/16/17 recovered: 2026-04-25 (Phase 13 slot reassignment to Compliance & Ops displaced the Decision Ritual / Tracking / Calendar scope; recovered to Phase 14/15/16; App Store readiness moved from audit-Phase-16 to Phase 17. Phase-slot history section added to make future reassignments visible.)*
*Phase 15 planned: 2026-04-26 (Tracking Layer — per-group progress + new-season pushes + live-release scheduling; 8 plans across 7 waves; 14 TRACK-15-* requirements; 16 D-XX decisions locked via /gsd-discuss-phase 15; researcher + UI-spec + patterns produced before /gsd-plan-phase 15. Cross-repo deploy ordering rules → indexes → CFs → app encoded in 15-08 close-out.)*
*Phase 15.1 inserted: 2026-04-27 (Security Hardening — closes 2 HIGH + 2 MEDIUM open findings from Phase 15 holistic security audit + code review. Decimal-phase insertion mirrors 03.5 precedent — not a slot reassignment. Scope sourced from `.planning/todos/pending/2026-04-27-phase-15-security-hardening-pass.md`; planning kicked off via /gsd-plan-phase 15.1.)*

*Phase 15.1 closed-out: 2026-04-27 (Security Hardening — 3 plans across 3 waves shipped in 1 deploy day. SEC-15-1-01..05 all Complete; closes F-OPEN-01 HIGH + WR-02 HIGH + F-OPEN-02 MEDIUM + WR-03 MEDIUM from the Phase 15 holistic audit. Cross-repo deploy ordering REVERSED from Phase 15: hosting first → rules second per RESEARCH §Q6. 38 rules-unit tests pass; source/mirror parity enforced. Production live: couch-v35.1-security-hardening at couchtonight.app + tightened rules on queuenight-84044.)*

*Phase 15.2 / 15.3 / 15.4 inserted: 2026-04-27 (v33.3 milestone audit gap closure — 15.2 verification-artifact backfill (Phases 5-9 missing VERIFICATION.md + 10 missing SUMMARYs + REQUIREMENTS.md/ROADMAP/CLAUDE.md docs refresh + milestone-label normalization), 15.3 DESIGN-01 canonical SVG logo + wordmark production (closes the only genuinely unsatisfied requirement), 15.4 integration-FLAG fixes (F-W-1 sendCouchPing real push fan-out + D-3 friendly-UI Settings parity → POL-01 fully satisfied). Decimal-phase insertion mirrors 03.5 + 15.1 precedent — NOT slot reassignments; Phase 16 Calendar Layer + Phase 17 App Store Readiness scope preserved. **Phase 15.5 Nyquist back-fill DEFERRED** — accepting Nyquist tooling tech-debt for v1; framework will apply going forward only. Audit report: `.planning/v33.3-MILESTONE-AUDIT.md` committed as 001b259; integration check inline in audit YAML frontmatter.)*
*v1 milestone: Commercial Release (Phases 3-11)*
