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

### Watchparty (Phase 5)

- [ ] **PARTY-01**: A member can start a watchparty session from the "Tonight's Pick" card once a title is chosen
- [ ] **PARTY-02**: Other members in the family can join an active watchparty session from their own device
- [ ] **PARTY-03**: Play, pause, and seek events sync across all connected devices with minimal lag
- [ ] **PARTY-04**: Members can send reactions (emoji or preset set) during the session
- [ ] **PARTY-05**: Reactions surface on all devices in the session in real-time
- [ ] **PARTY-06**: Session ends gracefully — host-ended, all-members-left, or timeout — with no orphan sessions in Firestore
- [ ] **PARTY-07**: The Tonight screen shows a watchparty banner when a session is active (scaffolding already exists in the code)

### Year-in-Review (Phase 6)

- [ ] **YEAR-01**: End-of-year recap page aggregates each member's watch history for the year
- [ ] **YEAR-02**: Per-member stats include titles watched, total runtime, top genres, and mood distribution
- [ ] **YEAR-03**: Per-member "favorites" section highlights top-rated titles (from Yes votes + Trakt ratings)
- [ ] **YEAR-04**: Family-level stats include most-watched-together, most-vetoed, longest watchparty
- [ ] **YEAR-05**: Recap has a shareable surface (export image, copy-link, or save-to-device)

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
| PARTY-01 | Phase 5 | Pending |
| PARTY-02 | Phase 5 | Pending |
| PARTY-03 | Phase 5 | Pending |
| PARTY-04 | Phase 5 | Pending |
| PARTY-05 | Phase 5 | Pending |
| PARTY-06 | Phase 5 | Pending |
| PARTY-07 | Phase 5 | Pending |
| YEAR-01 | Phase 6 | Pending |
| YEAR-02 | Phase 6 | Pending |
| YEAR-03 | Phase 6 | Pending |
| YEAR-04 | Phase 6 | Pending |
| YEAR-05 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25 ✓
- Unmapped: 0

---
*Requirements defined: 2026-04-19*
*Last updated: 2026-04-19 after roadmap creation (traceability populated)*
