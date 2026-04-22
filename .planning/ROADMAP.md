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
- [ ] **Phase 5: Auth + Groups** — Real member accounts, password-protected groups, and a migration path off the family-code-only model
- [ ] **Phase 6: Push Notifications** — Research-first: real push (not just local) for watchparty starts, vetoes, invites, and other event surfaces
- [ ] **Phase 7: Watchparty** — Synced multi-device watch sessions with real-time reactions, now identity- and push-aware (was Phase 5 pre-restructure)
- [ ] **Phase 8: Watch-Intent Flows** — Two parallel branches: "who's watching tonight at X time" (time-bound RSVP) and "who wants to watch this title" (content-bound interest poll)
- [ ] **Phase 9: Redesign / Brand / Marketing Surface** — Full visual identity (logo, icon, palette, typography), UI refresh against a polished design system, plus landing page + app-store-style marketing surface
- [ ] **Phase 10: Year-in-Review** — End-of-year recap aggregating mood, veto, watchparty, and intent-flow activity (was Phase 6 pre-restructure)

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
- [ ] 07-06-PLAN.md — GAP: setWpMode optimistic re-render + late-joiner wallclock backlog override (fixes UAT Issues #2a + #3) (PARTY-03, PARTY-04)
- [ ] 07-07-PLAN.md — GAP: reaction-delay feature — viewer-side elapsed-filter shift + UI chips + participant field (closes UAT Issue #2b net-new) (PARTY-04)
- [ ] 07-08-PLAN.md — GAP: on-time inference + late-joiner "I started on time" override — effectiveStartFor helper + claimStartedOnTime persist + participant-strip chip affordance (closes UAT Issue #4) (PARTY-03)
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
**Plans**: TBD — likely 4-6 plans (identity, design-system audit, UI refresh, landing, marketing assets, onboarding)
**UI hint**: yes (this IS the UI phase)

### Phase 10: Year-in-Review
**Goal**: At year-end (or on-demand), each member and the family as a whole can see a recap of their viewing year — titles, runtime, genre and mood distribution, favorites, shared-watch patterns, intent-flow "most-anticipated," and veto/watchparty highlights — packaged in a shareable surface that lands on the final Phase 9 brand.
**Depends on**: Phase 3 (mood-tag distribution), Phase 4 (veto history), Phase 7 (watchparty activity), Phase 8 (intent flows for "most-anticipated"), Phase 9 (final brand tokens for shareables).
**Requirements**: YEAR-01, YEAR-02, YEAR-03, YEAR-04, YEAR-05 (IDs unchanged; YEAR-04 expanded in /gsd-discuss-phase 10 to include intent-flow stats)
**Success Criteria** (what must be TRUE):
  1. A member can open the Year-in-Review surface and see their own watch history for the year aggregated into readable stats.
  2. Per-member stats show titles watched, total runtime, top genres, and mood-tag distribution sourced from Phase 3 data.
  3. Per-member favorites highlight top-rated titles drawn from Yes votes and Trakt ratings.
  4. Family-level stats show most-watched-together, most-vetoed (from Phase 4), longest watchparty (from Phase 7), and most-anticipated-but-never-watched (from Phase 8 intent data).
  5. The recap can be shared off-app — at minimum one of: export image, copy link, or save-to-device — rendered against Phase 9's finalized brand without breaking the warm/cinematic design language.
**Plans**: 3 plans (TBD — finalized at plan-phase)
**UI hint**: yes

## Progress

**Execution Order:**
Phases 5 (Auth) and 6 (Push) are sequential foundation work — 6 depends on 5 for `uid` targeting. Phase 7 (Watchparty) and Phase 8 (Intent) both depend on 5+6 but can run in either order or in parallel. Phase 9 (Redesign) must run after all feature phases so the design system covers the final surface area. Phase 10 (Year-in-Review) depends on data from 3/4/7/8 and brand tokens from 9, so it runs last.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 2. Tonight + Voting (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 3. Mood Tags | 2/2 | Implementation complete — awaiting /gsd-verify-work | 03-02 complete 2026-04-20 |
| 4. Veto System | 3/3 | Implementation complete — awaiting /gsd-verify-work | 04-03 complete 2026-04-20 |
| 5. Auth + Groups | 0/? | Not started | - |
| 6. Push Notifications | 0/? | Not started | - |
| 7. Watchparty | 5/8 | Gap-closure in progress (07-05 shipped + deployed, UAT deferred; 07-06..07-08 pending) | 07-05 deployed 2026-04-22 |
| 8. Watch-Intent Flows | 0/? | Not started | - |
| 9. Redesign / Brand / Marketing | 0/? | Not started | - |
| 10. Year-in-Review | 0/3 | Not started | - |

---
*Roadmap created: 2026-04-19*
*Restructured: 2026-04-20 (inserted Auth/Push/Intent/Redesign; pushed Year-in-Review to Phase 10)*
*Gap-closure plans added: 2026-04-21 (07-05..07-08 closing UAT Issues #1-#4)*
*v1 milestone: Commercial Release (Phases 3-10)*
