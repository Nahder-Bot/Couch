---
seeded: 2026-04-22
target-phase: 9.x (alongside or immediately after Phase 9 Redesign)
trigger: "Research thread 08 Q2 found solo is viable as an on-ramp, not a destination; thread 06 confirmed ~50% expansion of addressable market"
---

# Phase 9.x seed — Solo mode on-ramp

## Why this may or may not be Phase 9

- **Best case:** solo mode fits inside Phase 9 as one plan — the redesign already touches archetype refactor, onboarding, signup flow. Adding solo removes the "must have family" gate during the same touch.
- **Split case:** if Phase 9 scope bloats past 10 plans, solo splits to 9.5 — do NOT cut the retroactive-privacy dialog tasks, those are P0.

## Core decision (research thread 08 Q2/Q3)

**YES to solo — as on-ramp, not destination.** Letterboxd (17M→26M, solo-first) + TV Time (70% solo trackers) prove the model.

**YES to solo → group upgrade flow.** But one-way ONLY — invite my people INTO my Couch. Never bidirectional Couch merging (merging two existing Couches is out of scope for v1).

## P0 invariant — retroactive privacy

**Critical:** when a solo user invites family, their existing watch history was private. The invite acceptance must trigger a **share-level dialog**:

- Share everything (history + ratings + reviews visible to family)
- **Ratings only** (scores visible, private viewing history invisible) — **DEFAULT**
- Keep private (join family for forward-only; historical data stays solo-scoped)

**Precedent:** Letterboxd's "Between Us" feature shipped specifically because they DIDN'T design this in. Painful retroactive migration.

## Solo-specific surface

- Mood-driven recommendations replace the voting layer as primary path
- Trakt history import on signup (Couch already has auth wired from Phase 5) — kills cold-start in one tap
- Solo user's Tonight screen: single-member picker disabled; mood + streamer-filter drive the spin
- "Invite someone" CTA always visible but never blocking

## Data model notes

- `family.composition` inferred from member count: 1 = solo, 2 = duo, 3-4 = crew, 5+ = family (per thread 08 Q1 archetype refactor recommendation)
- `member.privacyLevel` added: `'full' | 'ratings-only' | 'private'` — default `ratings-only`
- Historical data (votes, ratings, watchparty participation pre-invite) respects `privacyLevel` in family views

## Success criteria

- New user can sign up without entering a family code
- Mood + Trakt sync give a meaningful Tonight experience solo
- Solo → group upgrade preserves solo data per privacy choice
- No privacy leak: a solo user's pre-invite data is never visible to family unless explicitly shared

## Estimate

~6-8 hours including UAT. The privacy-dialog is 2 hours; the Trakt-import-on-signup is 2 hours; the mood-first solo Tonight is 2 hours; onboarding-without-code is 2 hours.

## Why not defer to v2

Solo on-ramp roughly DOUBLES addressable market per research. Losing that during v1 commercial launch is a major miss. Ship inside v1 window even if it pushes Phase 10 YIR back.
