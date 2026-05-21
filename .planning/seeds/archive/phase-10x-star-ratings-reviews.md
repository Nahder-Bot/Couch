---
seeded: 2026-04-22
target-phase: 10.x (between Phase 9 redesign landing and Phase 10 YIR)
trigger: "Research dive thread 07 (feature gap) flagged star/half-star ratings + short review text as the #1 missing Letterboxd primitive"
related: [phase-10x-custom-lists.md]
---

# Phase 10.x seed — Star ratings + short reviews

## Why this isn't Phase 9

Phase 9 is the Redesign/Brand/Marketing phase. Adding a new votes-adjacent primitive during a design pass dilutes both scopes. But star ratings are the single highest-leverage feature gap per the research (thread 07) — ship right after Phase 9 lands, ideally as foundation for Phase 10 YIR.

## Scope

- **Star rating:** 1-5 stars with half-star support (Letterboxd pattern). Per member per title.
- **Short review text:** 280-char max, optional. Visible to family members only (no public feed — family-scoped by design).
- **Rating aggregation:** family average displayed alongside TMDB rating.
- **YIR-ready:** ratings + reviews become Phase 10 raw data (alongside existing votes, vetoes, watchparties, intents).

## Why this matters

- **Yes/Maybe/No feels thin for retained users** — Couch accrues data but doesn't reflect taste back. Ratings turn the app into a keepsake.
- **TV Time's "emotion ratings"** (cozy/cried/everyone-loved) could be a lighter variant IF the 5-star feels too analytical for the warm/cinematic brand. Propose both options at discuss-phase time.

## Data model sketch

```
families/{code}/titles/{titleId}.ratings.{memberId} = {
  stars: 0.5..5.0,
  review: string | null,
  at: Date,
  actingUid: uid
}
```

## Success criteria

- Member can rate any watched title; half-stars work on touch
- Family-average rating displayed alongside TMDB score on title detail
- Ratings + reviews flow into Phase 10 YIR without schema churn
- No public review feed (family-scoped only)

## Estimate

~3-4 hours including UAT. Small primitive, large compound effect.
