---
status: partial
phase: 18-availability-notifications
source: [18-04-PLAN.md, 18-04-SUMMARY.md]
started: 2026-04-29T22:50:00Z
updated: 2026-04-29T22:50:00Z
---

## Current Test

[awaiting human testing — code shipped + cross-repo deploy live; UAT requires real-device verification + CF tick]

## Tests

### 1. SW + cache version (Device A only, ~30s)
expected:
- Hard-reload `https://couchtonight.app/app` (or force-quit + reopen iPhone PWA)
- DevTools → Application → Service Workers OR JS console `caches.keys()` shows `couch-v36-availability-notifs`
result: [pending]

### 2. Settings UI — "Newly watchable" toggle (Device A)
expected:
- Account → notifications shows new toggle:
  - Label: "Newly watchable" (verbatim)
  - Hint: "When a title in your queue lands on a service in your pack." (verbatim)
  - Default: ON
- Toggle OFF → reload Settings → still OFF (Firestore round-trip persisted)
- Toggle ON to leave defaults
result: [pending]

### 3. Manual refresh affordance (Device A)
expected:
- Tap any TMDB-sourced tile (id starts with tmdb_) → detail modal opens
- Below "Where to watch" provider strip:
  - Button "↻ Refresh availability" renders (verbatim label)
  - Below button: italic + low-opacity footnote "Provider data via TMDB"
- Tap button → flashToast "Availability refreshed." within ~1-2s
- Modal re-renders with fresh providers
- (Optional) Firebase Console → Firestore → families/{code}/titles/{id} → t.lastProviderRefreshAt is a recent epoch
result: [pending]

### 4. Simulated CF tick + push delivery (real-device dependent)
expected:
- Manual trigger via Firebase Console → Functions → providerRefreshTick → "Run now"
  OR gcloud: `gcloud scheduler jobs run firebase-schedule-providerRefreshTick-us-central1 --project queuenight-84044 --location us-central1`
- CF logs show `[18/providerRefreshTick] tick complete` with non-zero processed count
- To force a real push delivery (TMDB provider changes happen organically at 24-72h cadence; first tick may not produce):
  a. Firestore → manually remove one brand from a queued title's t.providers (e.g. remove Max from Dune)
  b. Trigger CF again
  c. CF re-fetches from TMDB, detects brand "added back", pushes to family members with Max in m.services
  d. Push body matches D-14 verbatim: "Dune just hit Max for your household."
  e. Multi-title batches match D-15: "{N} titles your couch wants are now watchable: ..."
result: [pending]

### 5. Opt-out push suppression (Device A)
expected:
- Toggle "Newly watchable" OFF in Settings
- Repeat manual CF trigger from UAT 4 for a title where Device A's member would otherwise receive a push
- Device A does NOT receive a push (server-side sendToMembers eventType-gate suppresses when notificationPrefs.titleAvailable === false)
- Toggle ON to restore
result: [pending]

### 6. Quiet hours smoke (optional)
expected:
- If quiet hours configured to include current time, trigger CF tick → no push arrives in quiet window
- Outside quiet window → push arrives (Phase 6 behavior preserved)
result: [pending]

### 7. 24h post-deploy soak (informational)
expected:
- Within 24h of 2026-04-29 22:50Z deploy, monitor:
  - Sentry for unexpected breadcrumb spikes related to Phase 18 (providerRefreshTick markers)
  - queuenight CF logs (`gcloud functions logs read providerRefreshTick --project queuenight-84044 --region us-central1 --limit 50`) for surge in TMDB fetch failures or sendToMembers errors
  - 429 backoff frequency — should be rare at current scale
- Persistent spike past 1h triggers investigation
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
