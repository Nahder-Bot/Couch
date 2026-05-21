---
phase: 06-push-notifications
plan: 06-03
status: complete
completed: 2026-04-21
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [PUSH-02]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 06-03 — Per-event-type notification prefs + Settings toggles + server-side enforcement

Give every signed-in user per-event-type opt-in/out control with server-side enforcement. Client writes toggles to `users/{uid}.notificationPrefs`; CF `sendToMembers` receives an `eventType` parameter and skips recipients whose pref for that type is `false`. Closes PUSH-02 granular opt-in. Defaults: 4 events ON (watchpartyScheduled / watchpartyStarting / titleApproval / inviteReceived), 2 events OFF (vetoCapReached / tonightPickChosen) — matches the per-event pattern documented in 06-RESEARCH.md §4 cross-competitor synthesis.

## What landed

### Couch repo (committed)
- **`js/app.js`** — added the foundational client-side push prefs primitives:
  - `const DEFAULT_NOTIFICATION_PREFS = Object.freeze({ ... })` at `:100` defining the 6 event-type defaults (4 ON, 2 OFF). This map is the single source of truth that the server `NOTIFICATION_DEFAULTS` mirrors in lockstep.
  - `const NOTIFICATION_EVENT_LABELS = Object.freeze({ ... })` at `:113` (current line at `:134` post Phase 14 D-12 add) defining UI copy for each toggle (label + hint).
  - `getNotificationPrefs()` helper that returns merged `{ ...DEFAULT_NOTIFICATION_PREFS, ...state.notificationPrefs }`, handling missing Firestore field gracefully.
  - `updateNotificationPref(eventType, value)` helper that writes to `users/{uid}.notificationPrefs.{eventType}` via `updateDoc` dot-path.
  - `startNotificationPrefsSubscription()` — Firestore onSnapshot on `users/{uid}` hydrates `state.notificationPrefs` on auth resolve; re-renders `updateNotifCard()` on change. Hooked into `onAuthStateChangedCouch`.
  - `renderNotificationPrefsRows()` — extends `updateNotifCard` to render the 6 per-event toggle rows + a stubbed quiet-hours row (fully wired in Plan 06-04) once permission is granted AND device is subscribed.
- **`firestore.rules`** — added top-level `match /users/{u} { allow read, write: if request.auth != null && request.auth.uid == u; }` rule so `notificationPrefs` field is reachable per-user (D-08 of 06-CONTEXT).

### queuenight/ repo (deployed; not git-tracked)
- **`functions/index.js`** — `sendToMembers` signature gains a 3rd option `eventType`. Inside the per-member loop, after the excludeUid skip:
  - If `eventType` set and recipient has `memberData.uid`, read `users/{uid}` doc and look up `notificationPrefs[eventType]`
  - Default per the canonical defaults map (`hasDefault` lookup against `NOTIFICATION_DEFAULTS`); skip delivery if the pref is `false`
  - Default-open on read failure (transient Firestore errors don't silently drop pushes — log warn + send)
- **`NOTIFICATION_DEFAULTS` mirror** of the client `DEFAULT_NOTIFICATION_PREFS` map added at functions/index.js:74-96 (later extended through `:103` for Phase 8 + 14 + 15 keys).
- **All 3 existing CF triggers updated** to pass their canonical `eventType`: `onWatchpartyCreate({...,eventType:'watchpartyScheduled'})`, `onWatchpartyUpdate({...,eventType:'watchpartyStarting'})`, `onTitleApproval({...,eventType:'titleApproval'})`.

## Smoke tests

Per Plan 06-03 Task 6 — static verification (prod deploy staged-only at end of autonomous run):

- `node --check queuenight/functions/index.js` — syntax validates ✓
- `grep "sendToMembers(" queuenight/functions/index.js` — every call-site passes the 4-arg form including `eventType` ✓
- `grep -n "DEFAULT_NOTIFICATION_PREFS\|notificationPrefs" js/app.js` — primitive helpers + Settings UI references present ✓
- No changes to `sw.js` — service worker remains the same (prefs server-enforced; client filter is belt-and-braces and not strictly required for v1)
- Client `updateNotifCard` still handles all 4 existing states (granted+subscribed, granted+unsub, denied, default+iOS-install-needed) ✓

Pre-flight runtime verification at 06-UAT-RESULTS recorded "PASS (after fix)" — 6-row toggle list rendered after the subscribe-race fix in commit 9f50b96 + sw.js cache bumped to v14. Future users won't hit the race.

## Must-haves checklist

From `06-03-PLAN.md` `must_haves.truths`:

- [x] `notificationPrefs` schema exists on `users/{uid}` doc with 6 event-type boolean toggles + optional quietHours block (quietHours wired fully in Plan 06-04)
- [x] Defaults applied client-side on first subscribe: `{watchpartyScheduled, watchpartyStarting, titleApproval, inviteReceived}` = true; `{vetoCapReached, tonightPickChosen}` = false
- [x] Settings screen renders a toggle list once permission is granted AND device is subscribed
- [x] Toggling a switch updates `users/{uid}/notificationPrefs.{eventType}` and immediately reflects UI
- [x] `sendToMembers` reads `users/{uid}/notificationPrefs.{eventType}` and skips delivery when false
- [x] A new `eventType` parameter flows through `sendToMembers` so it knows which pref to check
- [x] Firestore rules allow a user to read+write their own `notificationPrefs`; no one else can

## Commits

- `746325f` — `feat(06-03): per-event-type notification prefs + Settings toggles (PUSH-02)`

## Cross-repo note

`queuenight/` repo is not git-tracked from couch (same Pitfall 2 pattern as 06-02). The CF-side `sendToMembers` extension + `NOTIFICATION_DEFAULTS` server mirror + the 3 trigger eventType updates were edited in-place at `C:\Users\nahde\queuenight\functions\index.js` and deployed via `firebase deploy --only functions` per 06-SESSION-SUMMARY. The `match /users/{u}` rule was authored in `couch/firestore.rules` (committed) and synced to `queuenight/firestore.rules` for deploy via `firebase deploy --only firestore:rules`. Production state at `queuenight-84044` us-central1 per 06-UAT-RESULTS pre-flight PASS rows.

## What this enables

- **Plan 06-04** layers quiet-hours UI + 2 new CF triggers (`onInviteCreated`, `onSessionUpdate`) on top of the canonical 4-arg `sendToMembers` send-path (eventType is now the established convention)
- **Phase 8 (Watch-Intent Flows)** extends `NOTIFICATION_DEFAULTS` + `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` with `intentProposed` + `intentMatched` keys without breaking the lockstep — pattern proven here
- **Phase 12 (POL-01)** wires the friendly-UI Settings surface (`NOTIF_UI_TO_SERVER_KEY` map at js/app.js:163, commit b1ab9a9) on top of the primitive established here — server keys unchanged, friendlier UI labels added on top
- **Phase 14 (D-12 / DR-3 7-key add)** + **Phase 15 (newSeasonAirDate)** extend the same 3-place lockstep convention — pattern proven scalable through 16 event types without breaking back-compat
- **PUSH-02 (per-event opt-in)** closes at this plan: signed-in user can opt in to push per-device, with per-event-type granularity, with a clear permission prompt (the existing `notif-card`)

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 06-03 shipped 2026-04-21 (autonomous run; only `06-SESSION-SUMMARY.md` was produced for the merged plan-suite). v33.3 audit YAML line 158 identified the orphan: PUSH-02 evidence reads "Per-event opt-in IS wired (notificationPrefs map at users/{uid}, CF respects)" but `claimed_by_plans: []`. Evidence sources: `06-03-PLAN.md`, `06-SESSION-SUMMARY.md` (commit list + autonomous-run history), `js/app.js:100-262` + `firestore.rules` + `queuenight/functions/index.js:74-145` (production-live state), audit YAML lines 152-158, commit `746325f` in couch repo `git log`. The 06-UAT-RESULTS pre-flight row "6-row toggle list visible" provides runtime proof of the Settings UI.
