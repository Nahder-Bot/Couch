---
phase: 30-couch-groups-affiliate-hooks
type: context
created: 2026-05-02
updated: 2026-05-02
status: ready-for-research
authored_via: /gsd-discuss-phase 30
gray_areas_discussed: 2
decisions_locked: 9
scope_change: split — affiliate hooks carved out to future Phase 30.1
---

# Phase 30 — Couch groups (+ affiliate hooks → 30.1) — CONTEXT

## Domain boundary

Multi-family **"couch groups"** — ad-hoc cross-family watchparties where two-or-more families share a single wp surface (dorm pals, friend group, multi-household watchparties). Scoped narrowly to watchparty-level cross-family aggregation; per-family features (Tonight matches, queues, votes, mood tags, push prefs) stay siloed.

**Affiliate referral hooks (originally part of Phase 30) are CARVED OUT to a future Phase 30.1.** That work has its own gray-area cluster (partner programs, FTC disclosure UX, brand voice) and ships under its own discuss/plan cycle when the user is ready to engage with v2 monetization signaling.

**In scope:**
- A wp can pull members from N families (soft cap 4) via host-pasted family code
- Cross-family members appear with full identity (real names, votes, reactions, RSVPs) inside the wp roster
- Roster disambiguation when name collisions occur (`Sam (Smiths)` style)
- Lifetime auto-caps with existing wp archive (`WP_ARCHIVE_MS`, ~5h post-start)
- Host-only invite authority — mirrors Phase 24 / 27 host-only patterns

**Out of scope (explicitly):**
- Persistent "couch group" entity (no `couchGroups/{groupId}` collection)
- Cross-family Tonight matches, queues, votes, mood tags, push prefs (per-family stays per-family)
- Per-member individual cross-family invite (family-code is the unit, not the person)
- Affiliate referral hooks of any kind (Phase 30.1)
- Monetization, billing, plan tiers (v1 CLAUDE.md guardrail; affiliate posture re-engages at 30.1)
- Family-doc read-access cross-family (only the wp doc opens up; family/{code} stays private)

## Carrying forward (already shipped)

- **`families/{code}` scope anchor** (`js/state.js:11`) — `familyDocRef = doc(db, 'families', state.familyCode)`; existing scope unchanged, cross-family reads layer on top of this
- **Phase 5 auth + groups CFs** — `joinGroup` / `claimMember` / `inviteGuest` / `transferOwnership` exist but are NOT touched by Phase 30 per D-05 (no persistent groups entity)
- **Phase 24 host-only video URL pattern** — `firestore.rules /watchparties/{wpId}` host-only Path A + non-host Path B with 10-field denylist; Phase 30 extends READ side, leaves write rule composed
- **Phase 26 reaction schema** — `wp.reactions[]` with `runtimePositionMs` + `runtimeSource` enum; cross-family reactions inherit cleanly with no Phase 30 changes
- **Phase 27 `wp.guests[]` denormalized array** — precedent pattern for denormalizing cross-family member rows on the wp doc (see Claude's Discretion: member denormalization)
- **Phase 27 `(guest)` collision-suffix render-time disambiguation** (D-04) — exact pattern to mirror for D-09 family-suffix on collision
- **Cross-repo deploy ritual** — `couch` (hosting + client) + `queuenight/functions` (Cloud Functions) — Phase 30 follows this rhythm if any new CFs land
- **sw.js CACHE convention** — auto-bumped via `bash scripts/deploy.sh <short-tag>`; Phase 30 short-tag candidate `40-couch-groups`

## Decisions

### D-01 — Scope split: groups now, affiliate as Phase 30.1

Phase 30 ships couch groups only. Affiliate referral hooks (originally bundled under "merged from old Phase 30 + 31" in `seeds/v2-watchparty-sports-milestone.md`) carve out to a future Phase 30.1, following the decimal-phase precedent (15.1 / 15.2 / 15.3 / 15.4 / 15.5 / 15.6).

**Why:** The seed merged groups + affiliate on a speculative *attribution-amortizes-with-multi-family-scope* argument, not a *user-facing-coupling* one. The two features serve completely different jobs (social surface vs monetization signaling) and have orthogonal gray areas. Splitting lets each ship at its own readiness cadence and avoids one half blocking the other.

### D-02 — v1 monetization guardrail does NOT apply to Phase 30

Because affiliate is fully deferred to 30.1, Phase 30 has zero monetization touch. The CLAUDE.md "Don't start monetization / billing / plan-tier work" Out-of-Scope flag re-engages when 30.1 is scoped. ROADMAP Phase 30's "MUST surface this constraint" requirement is satisfied by carving affiliate out entirely.

### D-03 — ROADMAP.md narrative + slug rename pending

Current ROADMAP.md Phase 30 entry says "Multi-family 'couch groups' ... plus affiliate referral hooks." After this CONTEXT.md is committed, ROADMAP.md should be edited to reflect the groups-only scope (drop the affiliate paragraph; reframe the affiliate-tied gray-area bullets as "see future Phase 30.1" or remove). The phase slug `couch-groups-affiliate-hooks` should also be renamed to `couch-groups`; the phase directory `.planning/phases/30-couch-groups-affiliate-hooks/` would need to rename in parallel.

**Action:** Capture as a pre-plan-phase TODO or include as the first task of `/gsd-plan-phase 30`. Defer the directory rename until ROADMAP edit lands so artifacts stay consistent.

### D-04 — Cross-family is watchparty-only

Couch groups are watchparty-scoped. A wp can pull members from multiple families. **Tonight matches, queues, votes, mood tags, and push prefs all stay per-family** with no aggregation across the cross-family link.

**Why:** The hero use cases in the ROADMAP narrative (dorm pals, friend group, multi-household watchparties) all read as event-shaped ("we're watching together this Friday"), not household-shaped ("we share a Tonight queue every night"). Friend groups don't share queues; they share movie nights. This also gives the smallest blast radius — no cross-family aggregation logic on Tonight match computation, no privacy/intent line crossed by aggregating votes across families (your friend's wife's "Yes" vote should NOT unlock a title in your queue).

### D-05 — Ad-hoc per-wp via family-code paste; no persistent groups entity

Cross-family wps form at wp-create (or wp-edit) by the host pasting another family's code into a "+ Add a family" input. The wp gains those members for this wp only. **No persistent `couchGroups/{groupId}` entity.** Lifetime auto-caps with the existing wp archive cycle (`WP_ARCHIVE_MS`, ~5h post-start).

**Why:** Today the family code IS the social primitive in Couch — pasting it stays inside the user's existing mental model. A persistent "couch group" entity would introduce a second-order primitive users have to learn (extra brand surface, extra UI surface, leave/kick/disband lifecycle). Ad-hoc has a natural lifetime cap with wp archive; no separate cleanup flow needed. Phase 5's existing CFs don't get touched.

**Data shape implication:** the cross-family link is an additive field on the wp doc — likely `wp.families: [code1, code2, ...]` — not a new collection.

### D-06 — Full identity cross-family

Cross-family wp members appear in roster with real display names + avatars; votes / reactions / RSVPs are visible to everyone in the wp. Family-level data outside the wp (queues, mood tags, household members not in this wp) stays per-family.

**Why:** Matches the "two families watching together" mental model. Simplest implementation — wp doc carries cross-family member rows verbatim. If you're sharing your family code, you already trust each other; anonymous-by-default (or per-family vote-tally siloing) is overkill for a friend-group product and adds aggregation logic without obvious user value.

### D-07 — Host-only invite authority

The wp host (creator) is the sole inviter — they enter the other family's code at wp-create or via a wp-edit affordance. **No chain-invites, no open-invite tokens** (deferred — see Deferred Ideas).

**Why:** Mirrors existing host-only patterns: Phase 24 host-only video URL set, Phase 27 host-only RSVP close, Phase 14 V5 host-only roster control. Simplest authorization gate. Mirrors how a real-life host invites people to their place.

### D-08 — Soft cap of 4 families per wp

Up to 4 families can join a single cross-family wp. Implemented as: client-side guard message ("That's a big couch — are you sure?") above 4, server-side hard ceiling rejection above some upper bound (planner picks; suggest 8 as the absolute ceiling for Firestore 1MB doc-size safety).

**Why:** 4 families covers the hero use cases (dorm pals 2-3, multi-household friend group 3-4) comfortably. Soft cap keeps the door open for legitimate edge cases (extended-family Thanksgiving) while signaling that 5+ is unusual. Hard cap protects the wp doc from blowing through Firestore's 1MB limit when stacked with Phase 27 guests + Phase 26 reactions + Phase 24 position broadcasts + cross-family member denormalization.

### D-09 — Family-attributed roster only on name collision

Default roster render: just first names ("Sam"). When two families both have a "Sam" in the same wp, render becomes "Sam (Smiths)" / "Sam (Joneses)" — disambiguation only when needed.

**Why:** Mirrors Phase 27 D-04 `(guest)` pattern (render-time disambiguation on collision, never stored in Firestore). Brand-voice friendly; minimal visual chrome. Users from same family don't see formal-feeling family attribution unless real ambiguity exists. Storage stays `wp.members[].name = "Sam"`; render adds the `(Smiths)` suffix when the renderer detects a collision against members from other families in `wp.families[]`.

### Claude's Discretion

These belong to RESEARCH.md / PLAN.md, not CONTEXT.md:

- **Firestore wp-doc location** — top-level `/watchparties/{wpId}` (clean cross-family read; major migration of all existing wps) vs stay nested under `/families/{code}/watchparties/{wpId}` (rules extension allows read-access to members of any family in `wp.families[]`; minimal migration). Researcher decides; planner picks.
- **Rules extension shape** — exact `firestore.rules` predicate granting read access to a wp doc when `request.auth.uid` is a member of any family in `wp.families[]`. Includes: composition with the existing host-only Phase 24 video write rule (`hostUid` predicate + 10-field denylist), Phase 27 admin-SDK bypass for `rsvpSubmit`, Phase 14 host-only V5 roster control rule.
- **Reaction attribution shape** — whether `wp.reactions[]` rows store `actorFamilyCode` (future-proofing for analytics, async-replay edge cases) or whether actor's family code is derivable from `actorId` + a member-lookup walk. Phase 26's `runtimePositionMs` + `runtimeSource` schema is unaffected either way.
- **CF changes** — whether any new Cloud Functions are needed (e.g., `addFamilyToWp` admin-SDK function for transactional roster aggregation) or whether this is rules-only + client-direct-write.
- **UI placement** — where the "+ Add a family" affordance lives (wp-create form / wp-edit menu / both / contextual in V5 roster strip).
- **Member denormalization strategy** — fetch each family's members at wp-render time (separate Firestore reads per family) vs denormalize cross-family member rows onto the wp doc at invite time (write-side fan-out, faster reads, harder to keep in sync). Trade-off depends on member-count typical vs Firestore doc-size budget.
- **Migration approach for existing wps** — `wp.families` defaults to `[hostFamilyCode]` (or absent → implicitly the host's family) for all pre-Phase-30 wps. Backfill not strictly needed if rules + render code treat absence as `[hostFamilyCode]`.
- **Family-color palette** — only relevant if disambiguation evolves to color-tinted avatars (D-09 currently uses text suffix). Not in scope unless feature-scope grows.
- **Kick / remove a cross-family member or family flow** — host's ability to un-invite Family Y mid-wp. Likely mirrors Phase 27 D-07 soft-delete (`wp.families[i].revoked: true` or rebuild `wp.families[]` array minus the removed code). Planner can lock the shape; not surfaced as a user-visible decision in this discuss pass.

## Specifics

- **"+ Add a family" affordance copy** should match the warm/cinematic brand voice — likely "Add another family" or "Bring another couch in" rather than the more transactional "Add family code." Planner picks the exact phrasing per `BRAND.md` tone.
- **Soft cap warning copy** should preserve the playful brand voice ("That's a big couch — are you sure?") rather than a clinical "You've reached the family limit."
- **Cross-family roster visual reinforcement** — when name-collision suffix renders ("Sam (Smiths)"), avoid heavy chrome; italic-Instrument-Serif suffix at dim-text contrast probably reads softer than badge-pill treatment. Planner / UI-spec decides.
- **The seed's "amortize attribution" argument** for merging groups + affiliate is *speculative monetization economics*, not a user-coupling argument. The split (D-01) honors the user-facing reality that these are two unrelated features.

## Canonical refs

**Downstream agents MUST read these before planning or implementing.**

### Phase 30 scope + history
- `.planning/ROADMAP.md` § Phase 30 — current narrative (will need update per D-03 to drop affiliate paragraph)
- `.planning/seeds/v2-watchparty-sports-milestone.md` § Phase 30 + § "Inter-phase ordering constraints" (Phase 30 is independent of 24/26/27/28)
- `.planning/PROJECT.md` § Constraints — single-file architecture for v1, public-by-design API keys, Out-of-Scope monetization
- `.planning/REQUIREMENTS.md` — Phase 30 GROUP-30-* IDs to be assigned during /gsd-research-phase 30 → /gsd-plan-phase 30

### Existing watchparty primitive (load-bearing for D-04, D-05, D-06)
- `js/state.js:11` — `familyDocRef = doc(db, 'families', state.familyCode)` (existing scope anchor)
- `js/app.js` `renderWatchpartyLive` — current wp render path (will need cross-family roster awareness)
- `js/app.js` `renderParticipantTimerStrip` — Phase 27 added guest chips; Phase 30 extends with cross-family member chips + collision-suffix logic
- `firestore.rules` `/watchparties/{wpId}` block — Phase 24 added host-only `currentTimeMs` write rule + 10-field denylist; Phase 30 extends READ side

### Existing host-only patterns (load-bearing for D-07)
- `.planning/phases/24-native-video-player/24-CONTEXT.md` — Phase 24 host-only video URL pattern
- `.planning/phases/27-guest-rsvp/27-CONTEXT.md` § D-07 — Phase 27 host-only RSVP close + soft-delete pattern
- `.planning/phases/14-decision-ritual-core/` — Phase 14 V5 host-only roster control

### Phase 5 auth + groups (existing CFs that Phase 30 will likely NOT touch)
- `queuenight/functions/src/joinGroup.js` — existing CF; not touched per D-05 (no persistent group entity)
- `queuenight/functions/src/claimMember.js` / `inviteGuest.js` / `transferOwnership.js` — existing Phase 5 CFs

### Phase 26 / 27 interactions
- `.planning/phases/26-position-anchored-reactions-async-replay/26-CONTEXT.md` — Phase 26 reaction schema; cross-family reactions inherit `runtimePositionMs` / `runtimeSource` cleanly with no Phase 30 changes
- `.planning/phases/27-guest-rsvp/27-CONTEXT.md` § D-04 — `(guest)` collision-suffix pattern (mirrored in D-09)
- `js/native-video-player.js` (Phase 24) — host-only currentTime broadcast; cross-family wp host stays the original family's host

### Project posture / deploy
- `CLAUDE.md` § Architecture — `app.html` (~990 lines), `js/app.js` (~16K lines, never read in full), single-file v1 constraint, sw.js CACHE convention, `bash scripts/deploy.sh <short-tag>`
- `CLAUDE.md` § Do / Don't — "Don't start monetization / billing / plan-tier work" guardrail (re-engages at Phase 30.1 — see D-02)
- `.planning/STATE.md` — current cache `couch-v39-guest-rsvp`; Phase 30 will bump to `couch-v40-couch-groups` (or planner-chosen short-tag)

## Open questions for researcher

1. **Firestore wp-doc location (Claude's Discretion):** Stay nested under `/families/{code}/watchparties/{wpId}` with rules extension, OR migrate to top-level `/watchparties/{wpId}`? Investigate: blast-radius of migrating ~existing wp docs vs the rules-extension complexity, and whether nested-with-rules-extension actually works under multi-family read access (Firestore rules can predicate on doc field but the parent path is `/families/X/...` so the user must be able to read X first — which they may NOT be if X isn't their family). This may force the top-level migration. Confirm before plan-phase.
2. **Rules predicate for cross-family wp read access:** Exact predicate that grants read when `request.auth.uid` is a member of any family in `wp.families[]`. Will likely require `getAfter` / `get` calls on each family doc — confirm the rules-tests pattern from `tests/rules.test.js` for multi-doc-read predicates.
3. **Reaction attribution `actorFamilyCode`:** Worth adding to the schema or derivable? Investigate Phase 26 reaction-render path to see if family-of-actor info is needed at render or only at write.
4. **Member denormalization vs runtime fan-out:** Confirm the wp doc 1MB budget headroom assuming 4 families × ~6 members + Phase 27 guests + Phase 26 reactions + Phase 24 position broadcasts. If tight, runtime fan-out is the only safe path.
5. **Pre-Phase-30 wp migration:** Confirm rules + render treat absent `wp.families` as `[hostFamilyCode]`. If clean, no backfill needed. If render code paths assume the field exists, backfill via one-shot CF.
6. **Cross-repo deploy footprint:** Likely client-only (couch repo) + rules update (cross-repo). Confirm whether any new CFs are warranted — `addFamilyToWp` admin-SDK CF could simplify rules + provide audit trail, but may be overkill for a client-direct-write pattern.

## Folded todos

(none — no pending todos matched Phase 30 scope on this pass)

## Deferred Ideas

- **Affiliate referral hooks** — original Phase 30 second-half scope; carved out to future Phase 30.1 (D-01, D-03). Surface gray areas: partner programs (JustWatch / Amazon Associates / TMDB-only-no-affiliate / mixed), FTC disclosure UX (settings toggle / per-link badge / once-and-done banner / privacy-page-only), brand-voice tightrope ("still free" vs "we earn a cut"). Capture in `seeds/phase-30.1-affiliate-hooks.md` or via `/gsd-add-phase 30.1` when scoping.
- **Persistent "couch group" entity** — saved set of families that can be re-used across wps (saved-friends list, leave/kick/disband lifecycle). Deferred per D-05; revisit if usage signal emerges that families repeatedly paste the same other-family-codes (analytics signal: same `wp.families` pair across N wps within X days).
- **Open-invite cross-family link** — Phase 27-style minted invite token that any family can claim into a wp. Deferred per D-07; `seeds/phase-30x-open-invite-link.md` if user later wants this.
- **Per-member individual cross-family invite (not family-level)** — invite specific members from another family without bringing the whole household. Deferred; conceptually overlaps with Phase 27 (guest RSVP). Could be a Phase 30.x extension if family-level invite proves too coarse.
- **Cross-family Tonight matches / queues / votes** — full superset behavior. Deferred per D-04; not in v2 scope. Would need privacy-model rework (your friend's vote unlocking your queue crosses an intent line).
- **Family-color tinted avatar palette** — visual disambiguation alternative to text suffix. Deferred per D-09; revisit if collision-suffix proves too text-heavy in dense wps.
- **Cross-family family-doc read access** — currently `families/{code}` scope is private; Phase 30 only opens wp-doc read access cross-family, NOT family-doc read access. If a use case emerges (e.g., "list of all friends-of-friends"), that's a separate phase with its own privacy model.

## Next steps

1. Update `.planning/ROADMAP.md` Phase 30 entry to reflect groups-only scope per D-03 (drop affiliate paragraph or reframe under future Phase 30.1).
2. Run `/gsd-research-phase 30` to investigate the 6 open questions above and produce RESEARCH.md.
3. Or skip directly to `/gsd-plan-phase 30` — it auto-runs research → pattern-mapping → planning → plan-check in sequence, and the planner will surface the rules / doc-location / migration questions as part of plan creation.

---

*Phase: 30-couch-groups-affiliate-hooks*
*Context gathered: 2026-05-02*
