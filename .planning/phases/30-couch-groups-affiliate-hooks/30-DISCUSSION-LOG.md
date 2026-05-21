# Phase 30: Couch groups + affiliate hooks — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `30-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-02
**Phase:** 30-couch-groups-affiliate-hooks
**Areas discussed:** Scope shape + monetization guardrail, Groups feature scope (data model surfaced as Claude's Discretion)

---

## Selection — Initial gray areas

| Option | Description | Selected |
|--------|-------------|----------|
| Scope shape + monetization guardrail | Meta-question first: do groups + affiliate ship together or split? Plus confirm affiliate stays passive. | ✓ |
| Groups data model | How multi-family aggregation sits on top of `families/{code}`. | (deferred to Claude's Discretion after D-05 collapsed the question) |
| Groups feature scope | Which Couch features become cross-family? | ✓ (re-surfaced after D-01 reshaped scope) |
| Affiliate partners + disclosure UX | Partner programs + FTC disclosure framing. | (carved out to future Phase 30.1 per D-01) |

**User's choice:** Scope shape + monetization guardrail (single area initially); after D-01 split affiliate out, surfaced data model + feature scope as the now-relevant remaining areas (user picked "Surface both: data model + feature scope" — recommended).

---

## Area 1 — Scope shape + monetization guardrail

### Question 1.1 — Phase shape

| Option | Description | Selected |
|--------|-------------|----------|
| Split: 30 = groups, 30.1 = affiliate later | Decouple. Groups ships first; affiliate inserts as 30.1 (decimal-phase precedent). Each ships at own cadence. | ✓ |
| Keep merged: single Phase 30 deploy | Ship both in one deploy as currently scoped. Bigger atomic deploy; matches v2 milestone merged-old-Phase-N+N+1 pattern. | |
| Drop affiliate from Phase 30 — groups only this milestone | Re-scope to groups only; affiliate goes to parking lot for future milestone or v3. | |
| Drop groups, ship affiliate only | Inverse: affiliate-only Phase 30. Loses the seed's "amortize attribution with multi-family" framing. | |

**User's choice:** Split: 30 = groups, 30.1 = affiliate later (recommended)
**Notes:** This carves affiliate fully out of the current phase. Phase 30's monetization-guardrail confirmation becomes moot (no monetization touch in this phase); it re-engages when 30.1 is scoped. Captured as **D-01 / D-02 / D-03** in CONTEXT.md.

---

## Area 1.5 — Continuation prompt

### Question 1.5.1 — Surface remaining gray areas?

| Option | Description | Selected |
|--------|-------------|----------|
| Surface both: data model + feature scope | Continue with the two now-relevant gray areas. CONTEXT will have actionable decisions. | ✓ |
| Surface data model only | Discuss Firestore-shape question; defer feature-scope to plan-phase. | |
| Surface feature scope only | Discuss WHICH features go cross-family; let planner pick data model. | |
| Stop here, write CONTEXT.md as-is | Capture only D-01..D-03; let planner ask data-model + feature-scope questions during plan-phase. | |

**User's choice:** Surface both (recommended)

---

## Area 2 — Groups feature scope

### Question 2.1 — Group scope

| Option | Description | Selected |
|--------|-------------|----------|
| Watchparty-only | Couch groups are wp-scoped; per-family features stay siloed. Smallest blast radius; matches "multi-household watchparty" hero use case; mostly additive. | ✓ |
| Tonight + watchparty cross-family, queue/votes per-family | Decision moment shared (Tonight matches aggregate); queue/votes private. Middle ground. | |
| All features cross-family (full group as superset of family) | Highest user value AND highest blast radius. Crosses privacy/intent line on shared queues. | |
| Standalone 'group sessions' tab — ephemeral, no household features | Separate tab; existing per-family features unchanged. Discord-watch-party shape. | |

**User's choice:** Watchparty-only (recommended)
**Notes:** Captured as **D-04** in CONTEXT.md. Rationale: hero use cases all read as event-shaped; crosses no privacy line; smallest data-model lift.

### Question 2.2 — Group form

| Option | Description | Selected |
|--------|-------------|----------|
| Ad-hoc per-wp via family-code paste | Host pastes another family's code at wp-create. No persistent group entity. Lifetime auto-caps with wp archive. | ✓ |
| Persistent saved couch groups | Saved set of families re-usable across wps. New top-level entity with leave/kick/disband lifecycle. | |
| Both — persistent + ad-hoc | Most flexible; biggest UI surface; user-confusion risk. | |
| Per-member invite, no family-level concept | Per-person flexibility; loses 'two families together' framing; overlaps with Phase 27 guest RSVP. | |

**User's choice:** Ad-hoc per-wp via family-code paste (recommended)
**Notes:** Captured as **D-05** in CONTEXT.md. Collapses the data-model question — no `couchGroups` collection needed; just a `wp.families: [code1, code2]` array on the existing wp doc. Phase 5 CFs not touched.

### Question 2.3 — Visibility

| Option | Description | Selected |
|--------|-------------|----------|
| Full identity — names, votes, reactions, RSVPs all shared | Real names + avatars; votes/reactions/RSVPs visible across families. Family-level data outside wp stays per-family. | ✓ |
| Names + reactions visible, votes private to each family | Vote-aggregation logic must filter by wp-family-of-origin. No clear user value. | |
| Anonymous-by-default, opt-in to share names | Heavy privacy posture. Probably overkill for friend-group product. | |
| Family-attributed labels (e.g., 'Sam (Smiths)') | Always-attributed disambiguation. Light-touch privacy. | |

**User's choice:** Full identity (recommended)
**Notes:** Captured as **D-06** in CONTEXT.md.

### Question 2.4 — Invite authority

| Option | Description | Selected |
|--------|-------------|----------|
| Host only | Sole inviter. Mirrors Phase 24/27 host-only patterns. | ✓ |
| Any wp participant can invite | Open invite. Risks chaos; loses host control. | |
| Host + any owner of an already-invited family | Chain-invite tree. Premature complexity. | |
| Host + optional 'open invite' link | Default host-only with mintable open-invite token. | |

**User's choice:** Host only (recommended)
**Notes:** Captured as **D-07** in CONTEXT.md.

### Question 2.5 — Family cap

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cap of 4 families | Up to 4 per wp. Hero-use-case-fit. Soft = client-side guard message + server-side hard ceiling. | ✓ |
| 2 families only — strict pair-bond | Simplest mental model; turns away legit 3-way friend groups. | |
| Unlimited (capped only by wp doc size) | Hard to communicate; rare doc-blow risk. | |
| Soft cap of 8 families — 'big couch' allowance | Bigger than v1 use cases warrant. | |

**User's choice:** Soft cap of 4 families (recommended)
**Notes:** Captured as **D-08** in CONTEXT.md.

### Question 2.6 — Roster format

| Option | Description | Selected |
|--------|-------------|----------|
| Family-attributed only on collision | Default 'Sam'; collision triggers 'Sam (Smiths)'. Mirrors Phase 27 D-04 `(guest)` pattern. | ✓ |
| Always family-attributed in cross-family wps | Crystal-clear identity at cost of formality. Heavy in 2-family wps. | |
| Family-color tinted avatar/border | Visual disambiguation; new design token. | |
| Just first names always | Risks confusion on collision. | |

**User's choice:** Family-attributed only on collision (recommended)
**Notes:** Captured as **D-09** in CONTEXT.md.

---

## Closing — Done?

### Question — Ready for context?

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | 9 decisions enough for planner. Open questions flow into RESEARCH.md / PLAN.md. | ✓ |
| Surface kick / remove cross-family member flow | One quick question on host un-invite mid-wp. | (deferred to Claude's Discretion in CONTEXT.md) |
| Surface UI placement of '+ Add a family' affordance | UI gray area; could be planner discretion. | (deferred to Claude's Discretion in CONTEXT.md) |
| Surface a different gray area | Free-text prompt for unnamed area. | |

**User's choice:** Ready for context (recommended)

---

## Claude's Discretion (no user gray areas to log)

These were surfaced as honest blind spots / planner-territory decisions in CONTEXT.md but NOT asked as user-facing questions in this discuss pass:

- Firestore wp-doc location (top-level vs nested)
- Rules extension predicate for cross-family wp read access
- Reaction attribution shape (`actorFamilyCode` field?)
- New CF need (e.g., `addFamilyToWp` admin-SDK)
- UI placement of "+ Add a family" affordance
- Member denormalization strategy (write-side fan-out vs runtime read fan-out)
- Migration approach for pre-Phase-30 wps
- Family-color palette (only relevant if D-09 evolves)
- Kick / remove cross-family member or family flow

## Deferred Ideas (logged in CONTEXT.md § Deferred Ideas)

- Affiliate referral hooks → future Phase 30.1
- Persistent "couch group" entity (per D-05)
- Open-invite cross-family link (per D-07)
- Per-member individual cross-family invite
- Cross-family Tonight matches / queues / votes (per D-04)
- Family-color tinted avatar palette (per D-09)
- Cross-family family-doc read access
