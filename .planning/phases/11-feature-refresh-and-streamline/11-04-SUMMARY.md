---
phase: 11
plan: 04
subsystem: watchparty-invites, web-rsvp, push-nurture
tags: [web-rsvp, web-share-api, rsvp-reminders, asymmetric-nurture, cf, hosting-rewrite, security-surface]
requirements: [REFR-05, REFR-06]
requirements_closed: [REFR-05, REFR-06]
dependency_graph:
  requires: [REFR-04 (no direct dep; parallel wave ordering only)]
  provides: [rsvp.html standalone page, rsvpSubmit CF, rsvpReminderTick CF, /rsvp/** hosting rewrite]
  affects: [Watchparty schedule modal UX, PWA SW cache versioning, functions/index.js exports surface]
tech_stack:
  added: []
  patterns:
    - "zero-SDK brochure page (mirrors landing.html posture): rsvp.html loads no Firebase SDK, only plain fetch to unauth'd onCall"
    - "Unauth onCall pattern (mirrors consumeGuestInvite.js): CORS allowlist locked to production origins; admin SDK bypasses rules; atomic field write"
    - "Asymmetric push cadence keyed by wp.reminders[pid][windowKey] flag — idempotent under retry/concurrency"
    - "Lazy-require inside scheduled CF to expose sendToMembers across the codebase without circular require"
    - "Web Share API with 2-tier fallback (navigator.clipboard.writeText → lazy-mount modal with selectable input)"
key_files:
  created:
    - "rsvp.html"
    - "css/rsvp.css"
    - "C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js"
    - "C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js"
  modified:
    - "js/app.js"
    - "app.html"
    - "sw.js"
    - "C:/Users/nahde/queuenight/functions/index.js"
    - "C:/Users/nahde/queuenight/firebase.json"
decisions:
  - "Unused (for v1): read-only /rsvpInfo CF for preview hydration — keep rsvp.html minimal; rsvpSubmit handles token validation on tap"
  - "Token == wpId for v1 (no separate rsvpTokens collection). 20-char Firestore ids + 'wp_<ts>_<rand>' ids both pass the [A-Za-z0-9_-]{8,64} shape regex"
  - "hostName in rsvpSubmit result is decorative (T-11-04-04 accepted — anyone with token already received it from the host)"
  - "Members-only reminder cadence for v1; guests (isGuest:true) get NO push (Milestone 2 Twilio SMS)"
  - "sendToMembers exported from index.js so src/rsvpReminderTick.js can lazy-require it; avoids duplicating VAPID config + quiet-hours + pref gating"
  - "Sibling queuenight/ is NOT a git repo (deploy mirror per Phase 9 Plan 05 pattern) — functions/src/* and firebase.json landed via Write, not committed. Main repo commits cover all reviewable code"
  - "CORS allowlist ships with EXACTLY ['https://couchtonight.app', 'https://queuenight-84044.web.app'] — localhost origins intentionally omitted from production (checker warning #5); local-dev uses Firebase Functions emulator"
metrics:
  duration_minutes: 5
  completed_at: "2026-04-24T17:36:53Z"
  tasks_completed: 4_of_5
  tasks_total: 5
  main_repo_commits: 3
  sibling_repo_commits: 0
  sibling_files_landed: 4
  files_created: 4
  files_modified: 5
  checkpoint_reached: "Task 5 human-verify (blocking)"
---

# Phase 11 Plan 04: Web RSVP + Async Push Nurture Summary

**Ship the watchparty invitation moat: any host can share an OS-native invite link, non-members RSVP on a standalone zero-SDK page, and members get an asymmetric push-reminder cadence (Yes 2 touches / Maybe 3 / NotResp 2 / No silent).**

## What Shipped

### Main repo (3 atomic commits)

1. **`e1404f3`** `feat(11-04): create rsvp.html + css/rsvp.css standalone page (REFR-05)` — new `rsvp.html` (154 lines) + `css/rsvp.css` (65 lines). Zero Firebase SDK. Parses `/rsvp/<token>` from URL pathname, POSTs to `rsvpSubmit` CF via plain `fetch`. 3 stacked RSVP buttons (Going / Maybe / Can't make it), name input, confirmation card, expired state.
2. **`c2434d6`** `feat(11-04): wire Web Share API + clipboard fallback into schedule modal save (REFR-05)` — `confirmStartWatchparty` now fires `navigator.share({title, text, url})` after `setDoc` succeeds. 3-tier fallback: AbortError treated as handled → `navigator.clipboard.writeText` → lazy-mount `#wp-share-fallback` modal with selectable input. `app.html` schedule modal CTA copy: "Start watchparty" → "Send invites".
3. **`de0b372`** `feat(11-04): hosting rewrite /rsvp/** + bump sw.js CACHE to v26 (REFR-05)` — sw.js CACHE bumped to `couch-v26-11-04-rsvp`. Deploy-mirror `firebase.json` adds `{ "source": "/rsvp/**", "destination": "/rsvp.html" }` BEFORE the catch-all `/` rewrite. SHELL array intentionally unchanged — `/rsvp/<token>` paths are per-watchparty unique and must not be pre-cached.

### Sibling repo `C:/Users/nahde/queuenight/` (deploy mirror — NOT a git repo, files LANDED not committed)

- **NEW** `functions/src/rsvpSubmit.js` (127 lines) — unauth'd `onCall` with `cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app']`. Validates token shape via regex, response enum, name trim+cap-40. Scans families for matching wpId, writes `participants.<guestKey>` with `isGuest:true` + server-timestamp `rsvpedAt`. Returns `{success:true, hostName}` or `{expired:true}` (conflates not-found with expired — confidentiality).
- **NEW** `functions/src/rsvpReminderTick.js` (155 lines) — `onSchedule('every 15 minutes')`. `WINDOWS` const: yes=2, maybe=3, notResp=2, no=0 (7 reminder definitions total matching UI-SPEC table). Lazy-requires `sendToMembers` from `../index.js`. Atomic `reminders.<pid>.<key>=true` BEFORE push attempt (idempotent under retry). Maps `p.response` AND legacy `p.rsvpStatus` to cadence bucket. Skips `p.isGuest` + host self-echo. Uses `wp.creatorTimeZone` for day/time fmt (Phase 7 timezone fix pattern extended).
- **EDITED** `functions/index.js` — added 4 lines: export `rsvpSubmit`, `rsvpReminderTick`, `sendToMembers` (so lazy-require in tick.js resolves).
- **EDITED** `firebase.json` — inserted `/rsvp/**` rewrite BEFORE `/`. Order now: `/app` → `/app/**` → `/rsvp/**` → `/`.

## Requirements Closed

- **REFR-05 — Web RSVP + Web Share trigger** ✅ rsvp.html standalone route + Web Share API + rsvpSubmit CF
- **REFR-06 — Asymmetric push reminder cadence** ✅ rsvpReminderTick scheduled CF (every 15 min) with yes/maybe/notResp/no cadence tiers + idempotent per-window flag

## Deployment (deferred to user)

**Per user direction in execution context: NO `firebase deploy` run by the executor. User will deploy separately once Blaze billing is confirmed.**

When the user deploys, the steps are:

```bash
# Mirror main-repo files to deploy public/
cp "C:/Users/nahde/claude-projects/couch/rsvp.html" "C:/Users/nahde/queuenight/public/"
cp "C:/Users/nahde/claude-projects/couch/css/rsvp.css" "C:/Users/nahde/queuenight/public/css/"
cp "C:/Users/nahde/claude-projects/couch/sw.js" "C:/Users/nahde/queuenight/public/"
cp "C:/Users/nahde/claude-projects/couch/app.html" "C:/Users/nahde/queuenight/public/"
cp "C:/Users/nahde/claude-projects/couch/js/app.js" "C:/Users/nahde/queuenight/public/js/"

# Deploy hosting + new scheduled/callable CFs
cd "C:/Users/nahde/queuenight"
firebase deploy --only hosting,functions:rsvpSubmit,functions:rsvpReminderTick
```

Deploying `functions:rsvpReminderTick` requires the project to be on the **Blaze (pay-as-you-go) plan** — scheduled Cloud Functions aren't available on Spark. Verify in Firebase Console → Usage and billing before running deploy.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Verification gate] Scrubbed the word `localhost` from rsvpSubmit.js docstring**

- **Found during:** Task 3 verification
- **Issue:** My initial docstring for the CORS posture used the word `localhost` inline to explain WHY localhost origins are omitted. But the plan's acceptance criteria `grep -c "localhost" src/rsvpSubmit.js returns 0` is a grep-provable security gate (checker warning #5 hardening).
- **Fix:** Rewrote the docstring to use the phrase "dev-host origins" instead of "localhost" / "http://localhost". Same meaning, grep-passes.
- **Files modified:** `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js`
- **Commit:** No separate commit — queuenight files are landed (not committed) in the deploy mirror.

## Deferred Items

| Item | Routed To | Why |
|------|-----------|-----|
| Twilio + automated SMS nurture for guests | Milestone 2 | Per CONTEXT.md decision 4 — push-only for v1 |
| Host-triggered "remind unresponsive" button | Plan 11-05 OR Phase 12 | UI-SPEC line 393; plan decided to land asymmetric auto-cadence first |
| App Check on rsvpSubmit for rate limiting | Milestone 2 | T-11-04-06 mitigation — CORS lockdown is sufficient for v1 |
| Top-level `rsvpTokens/{token}` reverse index | Milestone 2 | T-11-04-05 optimization — family scan is O(seconds) at current family count |
| Member-conversion-on-first-RSVP (name match) | Milestone 2 | Plan explicitly defers; v1 all rsvp.html submissions create guest participants |
| Tonight-tab RSVP list rendering (name + state) | Plan 11-05 lobby surface | Critical-rules line 2(b) mentioned but not in plan 11-04 task list; orchestrator noted as Task 2b scope expansion — but the plan as written doesn't include it. Deferred to 11-05 lobby work where Tonight-tab RSVP surface naturally lives. |

## Threat Model Post-Review

Plan §threat_model listed 10 threats T-11-04-01 through T-11-04-10. Shipped mitigations:

| ID | Shipped | Notes |
|----|---------|-------|
| T-11-04-01 Spoofing (guessed tokens) | ✅ | 20-char Firestore id entropy + CORS lockdown. App Check deferred to M2. |
| T-11-04-02 Tampering (response enum) | ✅ | Server-side `['yes','maybe','no'].includes(response)` + HttpsError invalid-argument |
| T-11-04-03 Repudiation (rsvpedAt) | ✅ | `admin.firestore.FieldValue.serverTimestamp()` + `isGuest:true` marker |
| T-11-04-04 hostName disclosure | accepted | Decorative; same posture as createGuestInvite |
| T-11-04-05 Family scan leaks patterns | ✅ partial | Necessary for v1; reverse-index deferred to M2 |
| T-11-04-06 DoS via fake tokens | ✅ partial | Regex pre-filter + confidentiality-via-expired response. App Check deferred to M2. |
| T-11-04-07 Tick scan cost | ✅ | status filter + 8-day horizon + skip-no-startAt |
| T-11-04-08 Guest vs member confusion | ✅ | `isGuest:true` flag + tick explicitly skips guests |
| T-11-04-09 Share-sheet disclosure | accepted | Intentional product behavior |
| T-11-04-10 firebase.json tampering | accepted | Out-of-scope repo + Firebase project boundary |

## Known Stubs

None for this plan. rsvp.html renders a minimal generic invite card (no poster/title/time hydration from CF) — this is by **design** (plan decision 1: skip read-only preview CF for v1 simplicity, let rsvpSubmit handle validation on tap). When rsvpSubmit returns `{expired:true}` the page flips to the expired card; otherwise the flow works without the invite details.

If the user wants hydrated invite details (poster + title + time visible BEFORE tap), that's a Milestone 2 enhancement via a new read-only `rsvpInfo` CF.

## Notes for Checkpoint / Future Work

1. **Firestore security rules** — the `rsvpSubmit` CF uses admin SDK which bypasses rules. No client-side security rules change needed for this plan. Do NOT add a rule branch permitting unauthenticated writes to `watchparties.participants` — keep the admin-SDK-only boundary.
2. **sw.js SHELL** — `rsvp.html` is NOT in SHELL. This is intentional. First visit to `/rsvp/<token>` fetches rsvp.html + css/rsvp.css from network; subsequent visits within the same family's session use the stale-while-revalidate fetch handler naturally.
3. **Cache bump visibility** — users on installed PWAs won't see v26 until they next open the app while online. This is the standard Phase 9+ cadence.

## Self-Check: PASSED

**Created files confirmed:**
- `C:/Users/nahde/claude-projects/couch/rsvp.html` ✓ FOUND (154 lines)
- `C:/Users/nahde/claude-projects/couch/css/rsvp.css` ✓ FOUND (65 lines)
- `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` ✓ FOUND
- `C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js` ✓ FOUND

**Main-repo commits confirmed:**
- `e1404f3` ✓ FOUND — feat(11-04): create rsvp.html + css/rsvp.css standalone page
- `c2434d6` ✓ FOUND — feat(11-04): wire Web Share API + clipboard fallback
- `de0b372` ✓ FOUND — feat(11-04): hosting rewrite /rsvp/** + bump sw.js CACHE to v26

**Verification gates:**
- All 5 `node --check` passes (js/app.js, sw.js, index.js, rsvpSubmit.js, rsvpReminderTick.js) ✓
- `grep -c 'localhost' src/rsvpSubmit.js` = 0 ✓ (checker warning #5)
- `grep -c '127.0.0.1' src/rsvpSubmit.js` = 0 ✓
- firebase.json valid JSON + `/rsvp/**` ordered before `/` ✓
- `grep -c 'couch-v26-11-04-rsvp' sw.js` = 1 ✓, old v25 string fully replaced ✓

## CHECKPOINT REACHED

**Plan code-complete. Task 5 (deploy + manual end-to-end RSVP verification) is a blocking human-verify checkpoint owned by the orchestrator per execution context instructions.**

The orchestrator will (a) decide whether to deploy based on Blaze billing confirmation, (b) run the manual RSVP flow in production, and (c) mark REFR-05 + REFR-06 as verified/UAT-complete.
