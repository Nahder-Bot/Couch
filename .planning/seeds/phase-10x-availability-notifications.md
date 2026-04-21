---
seeded: 2026-04-22
target-phase: 10.x
trigger: "Research thread 02 identified 'availability notifications' (JustWatch pattern) as the highest-value new capability Couch could add"
---

# Phase 10.x seed — Availability notifications

## What it is

When a title on a member's Yes-queue or watchlist becomes available on a streaming service the family pays for, push a notification:

> "Dune just hit Max for your household."

## Why it matters

- **Thread 02 ranking:** highest-value new capability
- **Phase 6 infrastructure already ready:** new `eventType: 'titleAvailable'` added to notificationPrefs + new CF trigger
- **Brand fit:** low-volume, high-signal pushes. Doesn't break "warm restraint" principle.

## Prerequisite — provider-data audit

**BEFORE planning this phase, audit Couch's current availability data source:**
- Does Couch currently pull TMDB provider availability? If yes — scheduled CF watches for changes; push on diff.
- If no — needs new provider integration (JustWatch API? Watchmode? Manual scraping is unwise).

This audit determines whether the feature is a small plan (1-2 hours) or a new provider integration (6-10 hours).

## UX sketch

- New `titleAvailable` toggle in Settings → Notifications (joins the 8 existing eventTypes from Phase 6)
- Default: ON
- Scoped to: titles on any family member's Yes-queue OR explicit watchlist
- Batched if multiple titles become available the same day (daily digest at user-preferred hour, respecting quiet-hours from Phase 6)

## Data model additions

```
titles/{titleId}.availabilityHistory: [{ provider, availableSince, availableUntil }]  // Phase 1-2 catalog may already have this — audit
```

## CF trigger shape

```js
exports.onTitleAvailabilityChange = functions.firestore
  .document('families/{familyCode}/titles/{titleId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    // Diff provider lists — was it newly added to a family-subscribed service?
    ...
    // For each affected member with it on their Yes-queue: sendToMembers([memberId], ..., { eventType: 'titleAvailable' })
  });
```

## Success criteria

- Member with "Dune" on Yes-queue receives push when it lands on their family's active streaming service
- No push when title leaves a service (keep it positive-signal only in v1)
- Quiet hours + per-event opt-out work via existing Phase 6 machinery

## Estimate

- If provider-data already in Couch: ~2 hours
- If needs new provider integration: ~8 hours (API key + rate-limit budget + CF schedule + data-model extension)
