# Archived seeds — resolved by shipped code

These seeds describe bugs or features that have since been addressed. Kept for audit trail in case a regression brings them back as concerns.

| File | Resolution evidence |
|------|---------------------|
| `phase-05x-legacy-family-ownership-migration.md` | Hotfixed manually 2026-04-22 (single-user); ownerUid stamped + checked at `js/app.js:3126,3555` |
| `phase-07-watchparty-lifecycle-transitions.md` | Status transitions added in CF `watchpartyTick` (`queuenight/functions/index.js:666,682,687-691`) |
| `phase-08x-intent-cf-timezone.md` | Fixed in `onIntentCreated` CF — uses `timeZone: intent.creatorTimeZone \|\| 'UTC'` (`functions/index.js:394`) |
| `phase-10x-star-ratings-reviews.md` | Star ratings live across diary/YIR/detail-modal (`js/app.js:6889,7921,13357,13575`); TMDB community reviews shipped in Phase 14-05 |

Archived 2026-04-26 during `/gsd-review-backlog` audit.
