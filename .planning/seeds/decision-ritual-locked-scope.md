# Decision ritual rebuild — locked scope (3 phases: Decision Ritual / Tracking / Calendar)

**Captured:** 2026-04-24 (Phase 11 UAT pause)
**Source:** Multi-round conversational scoping with Nahder during Phase 11 post-deploy UAT
**Why this exists:** scope was thoroughly locked but formal phase startup deferred so Phase 11 UAT can finish first

> **⚠️ Phase-number history (2026-04-25):** This scope was originally tagged Phase 13/14/15 per the 2026-04-25 roadmap audit. The Phase 13 slot was subsequently reassigned to "Compliance & Ops Sprint" (account deletion + Sentry + branch protection + CSP + Firestore export, shipped 2026-04-25). **This scope is now planned as Phase 14 (Decision Ritual Core) + Phase 15 (Tracking Layer) + Phase 16 (Calendar Layer).** The phase numbers below are stale; the SCOPE inside is canonical. See ROADMAP.md "Phase-slot history" for the audit trail.

## Phase 14 — Decision ritual core (formerly tagged Phase 13)

**Goal:** Replace the vote-prominent Tonight tile with a couch-centered, conversation-first ritual. Two parallel flows (group-rank-pick when together, solo-nominate when apart) backed by a unified `watchpartyIntent` primitive.

### Locked decisions

- **Already-watched filter:** Strict (any couch member has watched = hide from discovery). Sources: Trakt sync + voted Yes prior + voted No + manually marked. Override: per-title "rewatch this one" tap. **Invitation bypass:** filter applies to MY view (discovery/spin/swipe), not invitations — when someone else nominates a watched title, the watched member still gets the push and can join the rewatch.
- **Tiered candidate filter (3 tiers):**
  - **Tier 1 (default visible):** shows where every couch member has it in their queue
  - **Tier 2 (default visible, below T1):** at least one couch member recommends
  - **Tier 3 (hidden behind expand):** shows that ONLY off-couch members want — "watching her movie without her"
  - **Tier 3 default visibility:** account-level + family-level + group-level toggle (3-tier preference hierarchy — most specific wins)
- **Tier 1 sort:** average of members' personal-queue rankings; ties broken by TMDB/Trakt rating.
- **Per-member queue (NEW PRIMITIVE):** explicit drag-to-reorder. Each family member has their own ordered queue. Adding from Add tab pushes to bottom of personal queue + family library. Drag UI in Library tab or new "My queue" surface.
- **Couch visualization:** SVG sofa graphic with avatar circles seated on cushions; empty cushions are "+ add to couch" affordances. 2-3 mockup variants to sketch via `/gsd-sketch` at plan time.
- **Tile redesign — face content:** poster + title + year + runtime + small "X want it" pill (3 micro-avatars + "+N" if needed) + ▶ Trailer button. **Vote button removed from tile face.**
- **Tile primary action sheet (single tap on tile body):** Watch tonight / Schedule for later / Ask family / Vote (de-emphasized).
- **Hidden-behind-⋯ items now surfaced:** trailer (lazy-loaded), providers, synopsis, cast, reviews.

### Flow A — Group rank-pick + push-confirm

1. Members on couch select themselves (Couch viz + add affordance)
2. App shows ranked list: Tier 1 first (avg-queue-rank, tie-break by rating), Tier 2 below, Tier 3 hidden behind expand
3. Picker selects a title → roster screen → picker proxy-confirms members "in person" (taps to mark them "in") → only unmarked members get push
4. Push payload: vote In / Reject / Drop out
5. **Reject majority:** auto-prompt picker for #2 from ranked list (1 retry, then expire). Any rejector can attach a counter-nomination ("rejected because I want X instead") — counter goes back to picker as sub-prompt.
6. **Quorum to convert intent → watchparty:** picker + ≥1 confirmed In (low bar; Phase 11-05 lobby flow takes over)
7. **Hard expire:** 11pm same-day if not converted

### Flow B — Solo-nominate + invite + counter-time

1. Member nominates a title with proposed time
2. Push to other members: join @ proposed time / counter-suggest (later/earlier with note) / decline
3. **Counter-time:** nominator decides — accepts / rejects / picks compromise per counter (option B)
4. **Auto-convert intent → watchparty:** at T-15min if any Yes RSVPs exist
5. **All-No edge case:** auto-cancel + notify nominator immediately
6. **Hard expire:** T+4hr past proposed start time

### Unified data primitive

Both flows write a `watchpartyIntent` Firestore doc:

```
watchpartyIntents/{intentId}
  flow: 'rank-pick' | 'nominate'
  creatorId: uid
  titleId: string
  proposedStartAt?: timestamp  // Flow B only
  expectedCouchMemberIds: string[]  // Flow A pre-selected couch
  rsvps: { [memberId]: { state: 'in'|'reject'|'drop'|'maybe', counterTime?: ts, note?: string, at: ts } }
  status: 'open' | 'converted' | 'cancelled' | 'expired'
  convertedToWpId?: string
  createdAt: ts
  expiresAt: ts
```

Single onSchedule CF (`watchpartyIntentTick`) handles expiry sweeps + conversion checks.

### Plan list (TBD — finalize at /gsd-plan-phase 14)

Suggested sub-phases the planner may recommend splitting into:

1. **13-01 Already-watched filter** (4 sources + per-title rewatch + invitation bypass)
2. **13-02 Per-member queue primitive** (Firestore field + drag-reorder UI in Library tab)
3. **13-03 Tiered candidate filter** (3 tiers + 3-level preference toggle)
4. **13-04 Couch visualization** (SVG sofa + avatar seats — sketch first via `/gsd-sketch`)
5. **13-05 Tile redesign** (face content + action sheet + vote demotion)
6. **13-06 watchpartyIntent primitive + CF expiry sweeper**
7. **13-07 Flow A** (group-rank-pick + roster proxy-confirm + reject→#2 + counter-nomination)
8. **13-08 Flow B** (solo-nominate + counter-time + nominator-decides)

REFR-* style requirement IDs to mint: probably DECI-01 through DECI-13 or similar. Lock at /gsd-discuss-phase 13.

## Phase 15 — Tracking layer (formerly tagged Phase 14)

**Goal:** Per-watching-group progress (not just per-individual) + new-season notifs + live-release scheduling. Couch's differentiation vs Trakt — tracks GROUPS, not just members.

- Per-arbitrary-subset progress tuples ("watched Invincible S4 with wife + stepson, finished episode 8")
- Push when a tracked show has a new season air date approaching (TMDB season air dates + existing FCM stack)
- "Severance S2E3 airs Friday 9pm — schedule a watchparty?" — auto-prompt 24h before live release; one-tap creates a Flow B nomination

## Phase 16 — Calendar layer (formerly tagged Phase 15)

**Goal:** Recurring + multi-future watchparty scheduling. "Wife and daughter watch American Idol every Monday."

- Recurring watchparty primitive (`watchpartySeries` doc) — title + cadence (weekly Mon @ 8pm) + RSVP roster
- Week-view planning surface (calendar/agenda for family's scheduled + recurring watchparties)
- Edit / pause / cancel series

## What needs to happen before formalizing

- Phase 11 UAT closure
- Phase 10 (Year-in-Review) decision: does YIR ship before Phase 13, or after? YIR depends on Phase 11 data already being collected, so could go either way.
- Optional: `/gsd-sketch` round for couch visualization variants before plan-phase

## Outstanding open questions

(Defer to discuss-phase 13)

- Tier 3 preference toggle hierarchy: account vs family vs group — how do conflicting settings resolve?
- Per-member queue and Yes votes: are they unified (Yes auto-adds to queue), or independent (queue is its own list)?
- Counter-nomination chain depth: can a counter-nomination itself be rejected with counter-counter? Or single-level?
- Couch visualization: how many seats max? What if family > seat count? (Avatar stack overflow?)
- Vote-mode preservation: after demoting Vote from tile face, does Vote mode (swipe) still exist as a separate session? (Probably yes — it's how queues get populated.)

## Click-out UX bug surfaced during this conversation

User noted: "when clicking a show in here it wasn't easy to click out" (referring to title detail modal in Library/Queue context). The ✕ close button scrolls out of view on long detail content. **Fix candidate:** make `.detail-close` position:fixed within the modal so it stays accessible regardless of scroll position. Capture as UAT issue / Phase 13-01 sub-task.

---

*This seed will be promoted to formal phase artifacts via `/gsd-discuss-phase 13` (then 14, 15) once Phase 11 UAT closes.*
