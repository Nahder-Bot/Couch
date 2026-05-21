---
seeded: 2026-04-22
target-phase: 8.x (Phase 8 polish — echoes the Phase 7 Plan 05 fix)
trigger: "Phase 8 UAT (2026-04-22) Test 4 static review — spotted onIntentCreated CF renders proposedStartAt via toLocaleTimeString without timeZone option, same bug class as 07-05 (CF timezone push body) but on intent-creation path"
related: [../phases/07-watchparty/07-05-PLAN.md]
---

# Phase 8.x seed — onIntentCreated CF timezone fix

## Problem

`queuenight/functions/index.js:365-367` in `onIntentCreated` renders:

```javascript
const when = intent.proposedStartAt
  ? new Date(intent.proposedStartAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  : 'soon';
body = `${senderName} proposed "${intent.titleName}" for ${when}`;
```

`toLocaleTimeString` without a `timeZone` option runs in the CF server's default
tz (UTC on GCP Cloud Functions). If Nahder (America/New_York) proposes a
tonight-at-time intent for 9 PM EDT, Ashley's push body will read "1:00 AM"
instead of "9:00 PM" — same bug as the Phase 7 Plan 05 watchparty push body
that we shipped a fix for on 2026-04-22.

The Phase 7 fix captured `creatorTimeZone` on watchparty create (client) and
read it in `onWatchpartyCreate` (CF). The intent code path was written in
Phase 8 independently and never received the same treatment.

## Fix shape (identical to 07-05 pattern)

**Client side** (`js/app.js` — inside `createIntent` or wherever the intent
doc is written):
```javascript
const creatorTimeZone = (() => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; }
  catch (e) { return null; }
})();
// ... in the intent object:
creatorTimeZone: creatorTimeZone || null,
```

**CF side** (`queuenight/functions/index.js:365`):
```javascript
const when = intent.proposedStartAt
  ? new Date(intent.proposedStartAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: intent.creatorTimeZone || 'UTC'
    })
  : 'soon';
```

Legacy intents (written before this ships) fall back to UTC render — same
graceful degrade as 07-05's fallback.

## Testable

- Propose `tonight_at_time` intent from a non-UTC browser → push body on a
  second device renders the creator's local time, not UTC-offset
- Inspect new intent docs in Firestore → `creatorTimeZone` field present
- Legacy intents (created before fix) render in UTC (acceptable; they'll
  drain quickly via normal expiresAt lifecycle)

## Notes

- Estimate: ~30 min. Two write sites (client + CF) + one redeploy.
- Safe to pair with any other Phase 8.x work (e.g. guest invite redemption
  from the Phase 5 seed, though unrelated).
- Low urgency — `watch_this_title` intents don't have a time string so this
  only affects `tonight_at_time` type. Users will notice it when the time is
  far from UTC (full offset during DST), less when closer.

## Provenance

Spotted during `/gsd-verify-work 8` Test 4 static-code review of `sendToMembers`
→ traced caller `onIntentCreated` → noticed the toLocaleTimeString without
timeZone option. Same class of bug as 07-05; same fix shape.
