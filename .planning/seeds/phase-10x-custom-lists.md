---
seeded: 2026-04-22
target-phase: 10.x
trigger: "Research thread 07 ranked user-curated lists as #2 missing feature; thread 02 (adjacent tools) validated Letterboxd list pattern as high-user-value"
---

# Phase 10.x seed — User-curated lists

## Scope

Per-member and per-family custom lists with titles + optional descriptions.

Examples:
- **Personal lists:** "Rainy Sunday," "Dad-safe horror," "Oscar catch-up"
- **Family lists:** "Holiday traditions," "Kids-approved," "We want to rewatch"

## Why it matters

- Auto-queues (Couch's current Yes-vote-based queue) are passive; **curated lists are expressive**
- Letterboxd's core feature — proven pattern for media apps
- Family-scope lists become a keepsake; per-member lists serve the solo use case (post-Phase-9 solo mode)

## Data model sketch

```
families/{code}/lists/{listId} = {
  title, description,
  ownerMemberId (null = family-owned),
  titleIds: [ordered array],
  createdAt, updatedAt
}
```

## UX touchpoints

- New "Lists" section on Account tab + per-member profile
- "Add to list" from any title's action sheet
- Lists appear as filters in Tonight spin ("Tonight from: Rainy Sunday")
- Watchparty start from a list

## Success criteria

- Member can create, rename, reorder, delete own lists
- Family member can create family-owned lists (collaborative)
- Lists convert to Tonight filters
- No data loss on list rename/delete

## Estimate

~4-5 hours including UAT. Builds on existing title doc + member attribution.
