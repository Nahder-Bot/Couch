# Roadmap: Couch

## Overview

Couch turns "what do you want to watch?" into a 30-second ritual. Phases 1 and 2 shipped pre-GSD (catalog, voting, basic Tonight flow, Trakt sync, PWA, Firestore real-time). This v1 roadmap completes the commercial-release milestone across four remaining product phases: mood-tagged filtering that sharpens the spin, a veto system that protects the ritual from bad picks, synced watchparties that extend the ritual through the movie itself, and an end-of-year recap that reflects the family's viewing year back to them. All work lands in single-file `index.html`; backend stays Firebase Firestore + TMDB + Trakt.

## Milestones

- ✅ **Phases 1-2 (Catalog + Tonight/Voting)** — shipped pre-GSD
- 🚧 **v1 Commercial Release (Phases 3-6)** — in progress

## Phases

**Phase Numbering:**
- Integer phases (3, 4, 5, 6): Planned v1 milestone work — numbering continues from shipped phases 1-2
- Decimal phases (e.g., 3.1): Reserved for urgent insertions

- [x] **Phase 3: Mood Tags** — Members can tag titles with moods and filter the Tonight spin by mood ✓ 2026-04-20
- [ ] **Phase 4: Veto System** — Any member can veto pre- or post-spin and the family sees it instantly
- [ ] **Phase 5: Watchparty** — Synced multi-device playback sessions with real-time reactions
- [ ] **Phase 6: Year-in-Review** — End-of-year recap aggregating mood, veto, and watchparty activity

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

### Phase 5: Watchparty
**Goal**: Once Tonight's pick is chosen, any member can launch a watchparty that syncs play/pause/seek across every family device and lets everyone react in real-time — with sessions that clean themselves up so Firestore doesn't accumulate orphan state.
**Depends on**: Nothing hard; benefits from the existing watchparty banner scaffolding already in `index.html`.
**Requirements**: PARTY-01, PARTY-02, PARTY-03, PARTY-04, PARTY-05, PARTY-06, PARTY-07
**Success Criteria** (what must be TRUE):
  1. A member can start a watchparty from the Tonight's Pick card; other family members see a joinable banner on their device within 2s.
  2. Play, pause, and seek actions from any device propagate to all other connected devices with sub-second drift during steady-state playback.
  3. Members can send reactions during a session; reactions surface on every participating device in real-time.
  4. A session ends cleanly via host-end, all-members-left, or inactivity timeout — with no orphan `watchparty` documents remaining in Firestore after end.
  5. The Tonight screen displays the watchparty banner whenever a session is active for the current family.
**Plans**: 4 plans (TBD — finalized at plan-phase)
**UI hint**: yes

### Phase 6: Year-in-Review
**Goal**: At year-end (or on-demand), each member and the family as a whole can see a recap of their viewing year — titles, runtime, genre and mood distribution, favorites, and shared-watch patterns — packaged in a shareable surface.
**Depends on**: Phase 3 (mood-tag distribution), Phase 4 (veto history for "most-vetoed"), Phase 5 (watchparty activity for "longest watchparty").
**Requirements**: YEAR-01, YEAR-02, YEAR-03, YEAR-04, YEAR-05
**Success Criteria** (what must be TRUE):
  1. A member can open the Year-in-Review surface and see their own watch history for the year aggregated into readable stats.
  2. Per-member stats show titles watched, total runtime, top genres, and mood-tag distribution sourced from Phase 3 data.
  3. Per-member favorites highlight top-rated titles drawn from Yes votes and Trakt ratings.
  4. Family-level stats show most-watched-together, most-vetoed (from Phase 4), and longest watchparty (from Phase 5).
  5. The recap can be shared off-app — at minimum one of: export image, copy link, or save-to-device — without breaking the warm/cinematic design language.
**Plans**: 3 plans (TBD — finalized at plan-phase)
**UI hint**: yes

## Progress

**Execution Order:**
Phases 3, 4, 5 are largely independent and can be executed in any order (or parallelized at the plan level). Phase 6 depends on data produced by all three and should run last.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 2. Tonight + Voting (shipped pre-GSD) | — | Complete | Pre-2026-04-19 |
| 3. Mood Tags | 2/2 | Implementation complete — awaiting /gsd-verify-work | 03-02 complete 2026-04-20 |
| 4. Veto System | 3/3 | Implementation complete — awaiting /gsd-verify-work | 04-03 complete 2026-04-20 |
| 5. Watchparty | 0/4 | Not started | - |
| 6. Year-in-Review | 0/3 | Not started | - |

---
*Roadmap created: 2026-04-19*
*v1 milestone: Commercial Release (Phases 3-6)*
