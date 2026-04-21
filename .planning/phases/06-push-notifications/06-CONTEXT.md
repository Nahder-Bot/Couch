# Phase 6: Push Notifications - Context

**Gathered:** 2026-04-21 (autonomous session, `/gsd-discuss-phase 6 --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship real web-push notifications for events that genuinely benefit from them, built on the **substantial client + server scaffolding that already exists in the repo** (see `<scaffolding_already_in_place>` below). Phase 6 is primarily **finishing and polishing** rather than greenfield: add the missing event triggers, wire the unset VAPID public key, add per-event granularity + quiet hours + self-echo guard on top of the existing subscribe/permission/service-worker plumbing, and produce the research artifact + UAT proof-of-delivery demanded by PUSH-01 / PUSH-03.

**In scope:** Finish VAPID wiring (unset `VAPID_PUBLIC_KEY` constant), new Cloud-Function triggers for invite-received + veto-cap-hit + tonight's-pick-chosen, self-echo guard inside `sendToMembers`, per-event-type opt-in toggles in Settings, per-user quiet-hours / DND with server-side enforcement, competitor/tech research artifact (PUSH-01), iOS + Android + desktop PWA UAT (PUSH-03).

**Out of scope (deferred):**
- Capacitor-wrapped native push / FCM migration — web-push decision confirmed by existing infra investment; revisit only if iOS 16.4+ reality blocks PUSH-03
- Family-level quiet-hours (per-user only in v1)
- Push for Phase 7 watchparty-progress / Phase 8 intent-flow matches — those surfaces don't exist yet; stubs only
- Title-approval push polish — existing `onTitleApproval` CF works; leave as-is unless UAT finds a bug
- Notification batching / digest mode — Phase 9 polish
- Android-specific channel / category customization — web-push baseline is sufficient for v1
- Apple Sign-In unblock for push (push works with any auth provider; not gated on Apple)

</domain>

<scaffolding_already_in_place>
## What's Already Shipped (from Phases 1–5 and pre-GSD work)

**Downstream agents: read this before proposing new infra.** Phase 6 builds on substantial existing work — proposing a fresh architecture would duplicate shipped code.

### Client (`js/app.js`)
- `subscribeToPush()` (lines 110–142) — handles permission check, VAPID key decode, `pushManager.subscribe`, writes subscription to `families/{code}/members/{id}.pushSubscriptions.{endpointHash}`
- `unsubscribeFromPush()` (lines 144–164) — removes Firestore entry + browser subscription via `deleteField`
- `isThisDeviceSubscribed()` (lines 790–797) — device-level subscribe state check
- `isIosNeedsInstall()` (lines 799–808) — detects iOS non-PWA-standalone, used to gate prompt
- `notif` object (lines ~755–785) — in-session Notification fallback (used when app is open but tab hidden)
- `updateNotifCard()` (lines 812+) — full Settings UI flow covering granted/denied/default/iOS-needs-install states, with "Turn on" / "Resubscribe" / "Blocked" button states
- `urlBase64ToUint8Array` helper (lines 96–106) — VAPID key decode
- `hashString` (lines 167–171) — SHA-256 → 32-char hex, used for endpoint dedupe key
- Notification-click message listener (lines 175–194) — deep-links to `/?wp=<id>` for watchparty pushes

### Service Worker (`queuenight/public/sw.js`)
- `push` event handler (line 67) — receives CF payloads, calls `showNotification`
- `notificationclick` handler (line 87) — focuses/opens the PWA on tap, posts `qn-notification-click` message to client for deep-link routing

### Cloud Functions (`queuenight/functions/index.js`)
- `configureWebPush()` — sets VAPID details from `.env` (VAPID_PUBLIC/PRIVATE/SUBJECT already populated)
- `sendToMembers(familyCode, memberIds, payload)` — the canonical send function:
  - Reads `pushSubscriptions` map off member doc
  - Calls `webpush.sendNotification` per endpoint
  - Prunes dead subscriptions on 410/404
- Existing triggers:
  - `onWatchpartyCreate` — notifies all members except host of new watchparty
  - `onWatchpartyUpdate` — notifies RSVP'd members when status flips to `active`
  - `onTitleApproval` — notifies requester on approve/decline

### Data model
- `families/{code}/members/{id}.pushSubscriptions` — map keyed by `endpointHash`, value = `{ endpoint, keys, ua, updatedAt }`
- Multi-device supported (one member can have N endpoint entries)
- Dead-sub pruning already implemented server-side

### What's broken / missing
- **VAPID_PUBLIC_KEY is the string `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'`** at `js/app.js:96`. `subscribeToPush` bails early on this. **This is the single highest-leverage fix in Phase 6 — one-line change unblocks everything.**
- No self-echo guard in `sendToMembers` — if the actor is a family member, they receive their own push
- No per-event-type granularity — all 3 event types are all-or-nothing off the single `pushSubscriptions` map
- No quiet-hours / DND state read by `sendToMembers`
- No CF triggers for: veto-cap-hit, invite-received, tonight's-pick-chosen
- No research artifact (PUSH-01 explicit deliverable)
- No UAT proof-of-delivery on iOS standalone PWA (PUSH-03 explicit AC)

</scaffolding_already_in_place>

<decisions>
## Implementation Decisions

### Foundation — reuse, don't rewrite

- **D-01:** **Reuse the existing web-push stack.** VAPID + subscribe + permission flow + service-worker handlers are all shipped and functional. Phase 6 does NOT migrate to FCM, OneSignal, or Capacitor. The research spike (PUSH-01) documents this decision as post-hoc rationalization — the code-base already voted.

- **D-02:** **Wire VAPID_PUBLIC_KEY as the very first task.** Move the public-key constant from `js/app.js` into `js/constants.js` (the existing public-by-design config home per CLAUDE.md) and populate with the value from `queuenight/functions/.env` (`BGwhEJGIKjf4MSd4vyZA6uegbKhiG5kkxoAD2o1WUfxYmcm5cUmSjc0z05d-r7meS1gmKOT0f0Sn4zXQwhriRHg`). Public keys are safe client-side by design. Private key stays in CF `.env`. This single change unblocks the entire existing subscribe flow.

### Event coverage in v1

- **D-03:** **Ship real push for events whose source surfaces already exist today:**
  1. **Watchparty scheduled** — existing `onWatchpartyCreate` (no change needed beyond self-echo)
  2. **Watchparty starting** — existing `onWatchpartyUpdate` on status→active (PUSH-03 acceptance event)
  3. **Title approval response** — existing `onTitleApproval` (no change needed beyond self-echo)
  4. **Invite received** (new) — fires when a new member doc is created OR when a guest invite link is minted that points to a uid-resolvable recipient. Source: Plan 05-07 guest-invite CF (`inviteGuest`). Trigger either via CF return value or an `onCreate` on a new `invites/{token}` subcollection.
  5. **Veto cap reached** (new) — fires when a session doc's `vetoCount` hits the per-session cap (from Phase 4 VETO-04). Notifies the owner that tonight's selection is stuck. Source: Firestore trigger on session doc `onUpdate` watching the `vetoCount` increment.
  6. **Tonight's pick chosen** (new) — fires when the session's `spinnerId` + `pickedTitleId` are committed. Notifies opted-in members who weren't the spinner. Source: Firestore trigger on session doc `onUpdate`.

- **D-04:** **Stub (don't ship) events whose source surfaces don't exist:**
  - Intent-flow match (Phase 8) — add commented-out trigger scaffolding only
  - Watchparty-progress / host-is-catching-up (Phase 7 refinement) — not in scope

- **D-05:** **Every new trigger uses `sendToMembers` as the single canonical send path.** No one-off `webpush.sendNotification` calls outside it. Keeps the self-echo guard + quiet-hours enforcement + dead-sub pruning centralized.

### Self-echo guard (PUSH-05)

- **D-06:** **Self-echo guard lives inside `sendToMembers`, not per-trigger.** `sendToMembers(familyCode, memberIds, payload, { excludeUid })` gets a new `excludeUid` option. Implementation: before iterating subscriptions, resolve each member's `uid` from the member doc and skip if equal to `excludeUid`. Every trigger passes `excludeUid: actor.uid` (reading from the Firestore doc that triggered it — e.g., `wp.hostUid`, `veto.actingUid`, `session.spinnerUid`).
- **D-07:** **Legacy member.id equality as secondary guard** — during Phase 5's grace window, actors may write with `memberId` only (no `uid` yet claimed). Accept `excludeMemberId` as a fallback parameter. Same pattern as Phase 5's `writeAttribution` dual-check (commit 874c145).

### Per-event-type granularity (PUSH-02)

- **D-08:** **Settings schema: per-user `notificationPrefs` map** stored at `users/{uid}/notificationPrefs`:
  ```
  {
    watchpartyScheduled: true,   // defaults on
    watchpartyStarting: true,    // defaults on — this is the flagship event
    titleApproval: true,         // defaults on — parent ↔ kid
    inviteReceived: true,        // defaults on
    vetoCapReached: false,       // defaults OFF — owner-only, opt-in
    tonightPickChosen: false,    // defaults OFF — could be noisy
    quietHours: { start: "22:00", end: "08:00", enabled: false }
  }
  ```
- **D-09:** **Settings UI: replace the single "Turn on" button with a toggle list once permission is granted.** The existing `notif-card` remains for the permission prompt; once granted + subscribed, the card expands to show per-event toggles + a quiet-hours row. Visual pattern follows the existing Account-settings card style from Phase 5 (see `js/app.js:renderSettings`).
- **D-10:** **Server-side enforcement is authoritative.** Client toggles are hints only. `sendToMembers` reads `users/{uid}/notificationPrefs.{eventType}` — if `false`, skip that subscription. Belt + braces: client also filters incoming `push` events against the prefs in the service worker (for the narrow case where CF prefs read is stale).

### Quiet hours (PUSH-04)

- **D-11:** **Per-user daily range, not per-family.** User picks start/end in their own timezone (auto-detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`, stored alongside the range). Enforced at `sendToMembers` time using the recipient's stored timezone.
- **D-12:** **Enforcement: silent drop, not queue-for-later.** Suppressed pushes are NOT queued. Rationale: watchparty-starting and tonight's-pick-chosen are time-sensitive — delivering them 8 hours late is actively bad UX. Title-approval and invite-received could in principle be queued, but cross-event queueing adds complexity out of proportion with value. v1 drops; Phase 9 may revisit.
- **D-13:** **Override: `forceThroughQuiet` payload flag.** Watchparty-starting *within* the user's quiet hours when the user has themselves RSVP'd to that watchparty bypasses quiet hours. The implicit consent of RSVPing overrides the DND default. No other override paths in v1.

### iOS PWA reality (PUSH-03)

- **D-14:** **iOS 16.4+ home-screen PWA is the supported iOS surface.** Non-standalone Safari tabs on iOS don't get the prompt (existing `isIosNeedsInstall()` gate already handles this). Research spike (PUSH-01) documents this constraint plus the "Add to Home Screen" UX nudge.
- **D-15:** **Android (Chrome / WebView) is code-complete without special casing.** Standard web-push flow works. UAT marks Android as "code-complete, device-verify-pending" same pattern as Phase 5's UAT-RESULTS.md.
- **D-16:** **Desktop is nice-to-have, not a gate.** The app is mobile-first; desktop push works as a side effect of the same code. Not listed as a UAT acceptance criterion — just confirm it doesn't break.

### Research spike (PUSH-01)

- **D-17:** **Scope: ≤1 page each on 6 competitors** (Teleparty, Plex Watch Together, Kast, Scener, Letterboxd, TV Time). Per competitor: platforms supported, event types pushed, opt-in UX pattern, per-event granularity (y/n), quiet-hours support (y/n). Focus on *what couch-picking apps push for*, not full feature matrices.
- **D-18:** **Plus 1 page technical:** web-push vs FCM vs OneSignal against iOS-PWA reality. Explicit conclusion: web-push chosen (reuses existing infra); FCM and OneSignal noted as escape hatches if iOS 16.4+ delivery is unreliable in UAT.
- **D-19:** **Delivered as `06-RESEARCH.md` inside the phase directory.** Not a separate plan — research is Plan 06-01 whose output file IS the artifact. No code commits from Plan 06-01.

### Self-echo and quiet-hours interaction with Phase 5 identity

- **D-20:** **Read actor uid from the writeAttribution fields** already written in Phase 5 (`actingUid`, `memberId`). Triggers get the attribution "for free" from the Firestore doc that triggered them. No new attribution schema.
- **D-21:** **Sub-profile action → parent gets pushed? NO.** When a parent acts-as a sub-profile (D-04 in Phase 5 CONTEXT), the action's `actingUid` is the parent. Self-echo guard on `actingUid` correctly suppresses push to the parent. Other family members still get the push correctly.

### Claude's Discretion

- Exact timezone-handling library (Intl.DateTimeFormat is stdlib; no extra dep likely needed)
- Specific toggle visual pattern (matches existing Settings card style)
- Whether `notificationPrefs` lives on `users/{uid}` or `families/{code}/members/{id}` (planner to decide — user doc is more portable across families, member doc is colocated with existing subscription map)
- Whether to re-deploy VAPID_PUBLIC as a build-time inline or runtime Firestore read (recommend constants.js inline — public key, zero risk, matches TMDB_KEY pattern)
- Plan count and granularity (likely 5: research, VAPID+self-echo, per-event UX, new CF triggers, UAT)
- Whether to seed quiet-hours server-side enforcement as a helper shared with future Phase 8 intent-flow pushes

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/ROADMAP.md` — Phase 6 goal, dependencies, success criteria
- `.planning/REQUIREMENTS.md` — PUSH-01 through PUSH-05 acceptance criteria
- `.planning/PROJECT.md` — constraints (no bundler, single-file through v1, public-by-design secrets)
- `.planning/phases/05-auth-groups/05-CONTEXT.md` — Phase 5 identity decisions (D-20 writeAttribution, D-21 self-echo pattern)
- `.planning/phases/05-auth-groups/05-UAT-RESULTS.md` — pattern for UAT doc (Phase 6 UAT follows same structure)
- `CLAUDE.md` — architecture + conventions + TMDB rate-limit pattern (reuse for any TMDB calls)
- `js/app.js:96-194, 755-860` — existing push client code (subscribe, notif, updateNotifCard)
- `queuenight/public/sw.js:67-104` — service-worker push + click handlers
- `queuenight/functions/index.js:19-140` — existing CF triggers + sendToMembers helper
- `queuenight/functions/.env` — VAPID public key source (already populated)

No external design doc / ADR exists for Phase 6 — this CONTEXT.md is the design contract.

</canonical_refs>

<deferred>
## Deferred to Later Phases

- **Capacitor / native-wrapped push** — revisit only if iOS PWA delivery fails UAT (Phase 6.5 escape hatch)
- **FCM topic-based broadcast** — Phase 7+ if watchparty scales beyond single-family groups
- **Notification batching / digest mode** — Phase 9 polish
- **Family-level quiet hours** — Phase 9 if user feedback surfaces a need
- **Rich notifications with images** — service worker supports `icon` but not custom layouts; Phase 9 polish
- **Push analytics / delivery telemetry** — useful but adds infra surface; Phase 10 if Year-in-Review ever wants "most-pushed" stats
- **Phase 8 intent-flow match events** — Phase 8 will add the hook calling into the Phase 6 infrastructure

</deferred>

<assumptions>
## Assumptions to Flag

1. **VAPID keys in `.env` are the real ones, not test keys.** Verified by value match against a standard VAPID pubkey format. If they're test keys, UAT will fail and we swap.
2. **iOS 16.4+ is the installed-base minimum for the family testing device.** Sign-off on PUSH-03 assumes the tester's phone is 16.4+.
3. **`actingUid` is consistently written** post-Phase 5 writeAttribution migration (commit 874c145). If there's still a write site that doesn't carry `actingUid`, self-echo will fail silently for that event. Researcher/planner should grep for any remaining direct writes bypassing `writeAttribution`.
4. **Firestore CF triggers fire within ~1s** of the triggering write in practice. If cold-start pushes to 10s+, PUSH-03's "within ~5s" is breached and we look at min-instance configuration.
5. **Service worker is registered on every page load** (standard PWA behavior) — existing `sw.js` is at root, served from queuenight/public/. Re-registration on new deploys is automatic.

</assumptions>

---

*CONTEXT gathered autonomously 2026-04-21. User asleep; defaults picked from strong code-base signals and Phase 5 prior decisions. User may redirect any D-NN on return.*
