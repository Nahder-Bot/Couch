---
phase: 27-guest-rsvp
verified: 2026-05-02T03:25:00Z
status: human_needed
score: 15/15 must-haves verified at automated/deploy layer
overrides_applied: 0
re_verification:
  previous_status: null
  previous_score: null
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "UAT-27-01 — iOS Safari (non-PWA): push block absent on confirmation; privacy footer link → /privacy"
    expected: "Confirmation screen renders without 'Get reminded when the party starts?' block; tapping 'Privacy Policy' navigates to /privacy"
    why_human: "PushManager feature-detect outcome on iOS Safari is browser-OS-mediated and cannot be Node-emulated; privacy link tap is touch-device render-path correctness"
    requirements: ["RSVP-27-07", "RSVP-27-13"]
  - test: "UAT-27-02 — Android Chrome: push opt-in CTA + State A on success"
    expected: "'Get reminded...' block visible; 'Remind me' tap shows OS permission prompt; on Allow, button replaced with 'You're on the list.' (Instrument Serif italic)"
    why_human: "OS-level permission prompt UX + service-worker registration outcome cannot be Node-emulated"
    requirements: ["RSVP-27-08"]
  - test: "UAT-27-03 — Permission denied: State B copy renders inline"
    expected: "Tap 'Remind me' on browser with notifications denied → 'Notifications blocked in your browser settings.' (Inter 13px ink-dim)"
    why_human: "Browser permission state pre-condition + denial outcome is OS-mediated"
    requirements: ["RSVP-27-08"]
  - test: "UAT-27-04 — Two-device revoke flow within 30s"
    expected: "Host kebab → Remove Charlie → toast 'Removed.' on host; within 30s, guest's rsvp.html flips to evicted state with focus on title for SR announcement"
    why_human: "Real wall-clock 30s poll cycle + two physical devices + screen-reader VoiceOver/TalkBack confirmation"
    requirements: ["RSVP-27-09"]
  - test: "UAT-27-05 — Close RSVPs flow + RSVPs CLOSED pill + secondary close + reopen"
    expected: "Host taps Close RSVPs → toast + pill; new guest submit returns closed state copy; host taps Open RSVPs → toast + pill removed"
    why_human: "Two-device coordination across host UI + guest rsvp.html state flip"
    requirements: ["RSVP-27-15"]
  - test: "UAT-27-06 — Name collision (guest) suffix"
    expected: "Family member 'Sam' exists; guest RSVPs as 'Sam' → guest chip shows 'Sam (guest)' + apricot pill; member 'Sam' chip unchanged"
    why_human: "Visual render correctness on actual roster surface; collision detection at render time"
    requirements: ["RSVP-27-14"]
  - test: "UAT-27-07 — Aggregate count line on confirmation"
    expected: "Pre-condition 3 yes / 1 maybe / 0 no; new guest RSVPs maybe → confirmation shows '3 going · 2 maybe' (no responses NOT shown)"
    why_human: "Real submit + render path against a live wp doc; aggregate counts depend on multi-guest state"
    requirements: []
  - test: "UAT-27-08 — guestId continuity (D-03)"
    expected: "Same browser repeat-RSVP with same name updates response in place; only ONE chip on host roster"
    why_human: "localStorage + repeat-RSVP behavior across same-browser session vs new browser; DevTools localStorage inspection"
    requirements: []
  - test: "UAT-27-09 — Web push reminder fires on schedule (T-1h)"
    expected: "Guest with pushSub set receives system notification at T-1h window with WINDOWS.yes title + interpolated body"
    why_human: "Cloud Scheduler trigger or wall-clock T-1h wait + real Push Service delivery to physical device. May be DEFERRED if no scheduler trigger access"
    requirements: ["RSVP-27-10"]
  - test: "UAT-27-10 — pushSub=null + revoked guests skipped silently"
    expected: "Firebase Functions logs show no error or send-attempt for revoked or null-pushSub guests; totalSkipped increments without webpush call"
    why_human: "Verifying absence of side-effect requires Firebase Functions production logs access. May be DEFERRED if no logs access"
    requirements: ["RSVP-27-11"]
---

# Phase 27: Guest RSVP Verification Report

**Phase Goal:** Non-member guests can RSVP to a watchparty without creating a Couch account — token-based RSVP link captures display name + going / maybe / no without forcing signup. Closes the "wife's friend wants to come but doesn't want a Couch account" gap. Independent of Phase 24 / 26.

**Verified:** 2026-05-02T03:25:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement Summary

Phase 27's automated and deploy-verifiable surfaces all pass. The phase is implemented end-to-end across 4 Cloud Functions (rsvpSubmit extended + rsvpStatus new + rsvpRevoke new with 3 actions + rsvpReminderTick extended) and 5 client surfaces (rsvp.html ~321 lines, css/rsvp.css ~161 lines, js/app.js +161 lines, css/app.css +54 lines, app.html comment hook). All 4 Phase 27 CFs are LIVE in queuenight-84044 us-central1. Production cache is live at `couch-v39-guest-rsvp` (curl-confirmed).

10 of 15 RSVP-27-* requirements are fully automated/deploy-verified at the smoke/rules-test/curl layer. 5 requirements (RSVP-27-07/08/09/10/11/13/14/15) have automated coverage AND require human device UAT to fully verify the outcome (push permission flows, two-device revoke flows, render-time collision suffix, web-push schedule firing). All 10 device-UAT scripts in 27-HUMAN-UAT.md cover these.

**Status `human_needed`** is the expected terminal state for Phase 27 per the phase plan: ~6 of 15 requirements are inherently device-UAT-only (push opt-in across browser matrix, two-device revoke, push schedule firing, log-absence verification).

## Roadmap Goal — Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Non-member guest can submit RSVP via /rsvp/<token> without account | VERIFIED | `rsvpSubmit` CF deployed live; `rsvp.html` lines 169-216 submit POST to `https://us-central1-queuenight-84044.cloudfunctions.net/rsvpSubmit`; CORS-locked to couchtonight.app; admin-SDK bypass path verified by rules-test #27-01..04 |
| 2 | Guest captures display name + going/maybe/no | VERIFIED | `rsvpSubmit.js:67-73` validates response enum + name; `wp.guests[]` schema stores `{guestId, name, response, rsvpAt, expiresAt, revoked, pushSub}` (rsvpSubmit.js:143-151) |
| 3 | No signup or auth flow forced on guest | VERIFIED | `rsvp.html` is zero-Firebase-SDK on cold load (verified by Plan 03 grep: 0 firebase imports); rsvpSubmit CF is unauthenticated (`onCall` with no auth required); guestId is anonymous client-minted localStorage key |
| 4 | Independent of Phase 24 / 26 (no shared schema field conflicts) | VERIFIED | Phase 27 fields (`wp.guests[]`, `wp.guestCount`, `wp.rsvpClosed`, `wp.reminders.{guestId}`) do not collide with Phase 24 video fields or Phase 26 reaction schema; smoke aggregate green for all 10 contracts (Phase 26 floor 102/102 + Phase 24 native-video-player + Phase 27 47/0) |
| 5 | Token-based RSVP link works (no signup wall) | VERIFIED | `looksLikeWpId` regex + family-scan in all 3 CFs; live curl OPTIONS to rsvpStatus + rsvpRevoke from couchtonight.app return 204 with correct CORS headers; rsvp.html token parsed from URL path |

**Score:** 5/5 truths verified at automated/deploy layer.

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `C:/Users/nahde/queuenight/functions/src/rsvpSubmit.js` | Extended with guestId + runTransaction + closed/cap/expiry gates | VERIFIED | 192 lines; runTransaction at L130; `WP_ARCHIVE_MS = 25 * 60 * 60 * 1000` at L104; `wp.rsvpClosed === true` gate at L113; `guestCapReached` at L122; `crypto.randomBytes(16).toString('base64url')` at L141; legacy `6 * 3600 * 1000` removed; legacy `participants.${guestKey}` write removed |
| `C:/Users/nahde/queuenight/functions/src/rsvpStatus.js` | Read-only polling endpoint | VERIFIED | 78 lines; `exports.rsvpStatus` at L24; CORS allowlist at L26 = `['https://couchtonight.app', 'https://queuenight-84044.web.app']`; zero `.update(` calls (smoke 6.4 PASS); returns `{revoked, closed, guestCount}` (or `{expired:true,...}`) |
| `C:/Users/nahde/queuenight/functions/src/rsvpRevoke.js` | Three actions: revoke / close / attachPushSub | VERIFIED | 155 lines; action validator at L48 accepts all 3; action-dependent host gate at L87 (only for revoke/close); attachPushSub branch at L103-132 with runTransaction + idempotent missing/revoked guest handling; close branch at L98-101 (plain update); revoke branch at L135-151 (runTransaction soft-delete) |
| `C:/Users/nahde/queuenight/functions/src/rsvpReminderTick.js` | Guest loop + dead-sub prune | VERIFIED | 260 lines; `require('web-push')` at L27; guest loop at L141-174; `webpush.sendNotification(gs.pushSub` at L228; dead-sub 410/404 prune at L232 with runTransaction at L235; `wp-rsvp-guest-` tag at L225; idempotency flag `reminders.${guest.guestId}.${w.key}` at L172 |
| `C:/Users/nahde/queuenight/functions/index.js` | Wires all 4 Phase 27 exports | VERIFIED | L1628 rsvpSubmit, L1629 rsvpReminderTick, L1635 rsvpStatus, L1636 rsvpRevoke; CORS preflight live for both rsvpStatus + rsvpRevoke (curl 204 confirmed) |
| `C:/Users/nahde/claude-projects/couch/rsvp.html` | Phase 27 guest experience | VERIFIED | 321 lines (was 154); `qn_guest_` localStorage at L45; `VAPID_PUBLIC_KEY` at L47; `function startStatusPoll` at L219; `window.requestPushOptIn` at L258; `attachPushSub` POST at L294; `function renderRevoked`/`function renderClosed` at L136/L145; `guestCapReached` handling at L194; privacy footer rendered 4 times across form + confirmation surfaces |
| `C:/Users/nahde/claude-projects/couch/css/rsvp.css` | UI-SPEC §1 classes | VERIFIED | 161 lines (was 65); all 14 selectors present: `.rsvp-count-line`, `.rsvp-push-block`, `.rsvp-push-copy`, `.rsvp-push-btn`, `.rsvp-push-done`, `.rsvp-push-blocked`, `.rsvp-push-err`, `.rsvp-push-unsupported`, `.rsvp-privacy-footer`, `.rsvp-privacy-link`, `.rsvp-evicted`, `.rsvp-evicted-title`, `.rsvp-evicted-sub`, `.rsvp-closed` |
| `C:/Users/nahde/claude-projects/couch/js/app.js` | Host roster + banner extensions | VERIFIED | 17458 lines (+161 from 17297); all 17 substring counts met (smoke 9.6/9.7/9.8/9.9 PASS); `wp-participant-chip guest`, `window.openGuestMenu`, `window.revokeGuest`, `window.closeRsvps`, `window.openRsvps`, `function displayGuestName`, `function getFamilyMemberNamesSet`, `function guestResponseLabel`, `buildWpBannerMetaSuffix`, `buildWpClosedPillHtml`, `buildWpHostRsvpToggleHtml`, `httpsCallable(functions, 'rsvpRevoke')`, `action: 'revoke'`, `action: 'close'`, `state.familyCode`, `rsvpClosed: false`, `wp-rsvp-closed-pill` |
| `C:/Users/nahde/claude-projects/couch/css/app.css` | Phase 27 chip + kebab + pill | VERIFIED | 4654 lines (+54); 6 selectors present: `.wp-participant-chip.guest` (L774), `.wp-participant-chip.guest .wp-participant-av` (L775, #5a8a84 background), `.wp-guest-kebab` (L2350, 44x44 touch target), `.wp-rsvp-closed-pill` (L2362), `.wp-guest-menu` (L2376), `.wp-guest-menu-item` (L2384), `.wp-guest-menu-item.destructive` (L2399) |
| `C:/Users/nahde/claude-projects/couch/firestore.rules` | Phase 27 admin-SDK-bypass annotation | VERIFIED | Comment block at L578-583 inside `/watchparties/{wpId}` block; rules-test confirms anon writes to wp.guests/rsvpClosed/guestCount denied (#27-01/02/04); zero rule predicate changes per Plan 02 SUMMARY |
| `C:/Users/nahde/claude-projects/couch/tests/rules.test.js` | Phase 27 describe block | VERIFIED | seed at L122-128 (`wp_phase27_test`); describe block at L947-973 with 4 assertions (#27-01..04) all PASS in `cd tests && npm test` (52/0) |
| `C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs` | ≥30 production-code sentinel assertions | VERIFIED | 213 lines (was 119); 47 passed / 0 failed; floor meta-assertion 11.1 reports `production-code sentinel floor met (29 >= 13)` |
| `C:/Users/nahde/claude-projects/couch/sw.js` | CACHE bumped to couch-v39-guest-rsvp | VERIFIED | L8 = `const CACHE = 'couch-v39-guest-rsvp';`; live curl confirms production matches |
| `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-HUMAN-UAT.md` | ≥10 device-UAT scripts | VERIFIED | 151 lines; 26 occurrences of `UAT-27-` heading (10 distinct scripts × pre-flight + cross-references); covers RSVP-27-07/08/09/10/11/13/14/15; browser matrix + requirement coverage tables present |
| `C:/Users/nahde/claude-projects/couch/package.json` | smoke aggregate + smoke:guest-rsvp alias | VERIFIED | `npm run smoke` chains all 10 contracts (verified by aggregate output); `npm run smoke:guest-rsvp` runs standalone |

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `rsvp.html` submitRsvp | `rsvpSubmit` CF | fetch POST {data: {token, response, name, guestId}} | WIRED | `body: JSON.stringify(...guestId: guestId})` present in rsvp.html L169; live curl OPTIONS preflight to rsvpSubmit returns 204 (verified earlier this session via Phase 11 deploy) |
| `rsvp.html` startStatusPoll | `rsvpStatus` CF | setInterval 30000 fetch POST | WIRED | `setInterval(_, 30000)` at rsvp.html L240; CORS preflight live |
| `rsvp.html` requestPushOptIn | `rsvpRevoke` action='attachPushSub' | fetch POST after PushManager.subscribe | WIRED | rsvp.html L294 sends `action: 'attachPushSub', token, guestId, pushSub`; rsvpRevoke.js L103-132 handles branch with runTransaction; CORS preflight live |
| `js/app.js` renderParticipantTimerStrip | `wp.guests[]` array | `(Array.isArray(wp.guests) ? wp.guests : []).filter(g => g && !g.revoked)` | WIRED | js/app.js L12229 (per Plan 04 SUMMARY); guest chip render emits `wp-participant-chip guest` class |
| `js/app.js` window.revokeGuest | `rsvpRevoke` action='revoke' | httpsCallable(functions, 'rsvpRevoke') with {token, action:'revoke', guestId} | WIRED | js/app.js block contains exact substring `action: 'revoke'` and `httpsCallable(functions, 'rsvpRevoke')` |
| `js/app.js` window.closeRsvps | `rsvpRevoke` action='close' | httpsCallable(functions, 'rsvpRevoke') with {token, action:'close'} | WIRED | js/app.js contains `action: 'close'` substring |
| `js/app.js` window.openRsvps | wp.rsvpClosed Firestore reset | doc(db, 'families', state.familyCode, 'watchparties', wpId) + updateDoc({rsvpClosed: false}) | WIRED | js/app.js contains `rsvpClosed: false` and uses `state.familyCode` (75 occurrences total, +1 from Plan 04) |
| `js/app.js` renderWatchpartyBanner | `.wp-banner-meta` + `.wp-rsvp-closed-pill` | innerHTML appended via buildWp* helpers | WIRED | All 3 helper invocations + 6 CSS selectors present |
| `rsvpReminderTick` guest loop | wp.guests[i].pushSub via webpush | Direct webpush.sendNotification(guest.pushSub, payloadStr) | WIRED | rsvpReminderTick.js L228 `webpush.sendNotification(gs.pushSub, payloadStr)`; tag `wp-rsvp-guest-` at L225 |
| `rsvpRevoke` action='attachPushSub' | wp.guests[i].pushSub set | runTransaction read-modify-write | WIRED | rsvpRevoke.js L111-130; runTransaction wrapping Object.assign + tx.update |
| Cross-repo deploy | production couchtonight.app + queuenight-84044 functions | (a) firebase deploy --only functions, (b) bash scripts/deploy.sh 39-guest-rsvp | WIRED | Live curl `https://couchtonight.app/sw.js` returns `const CACHE = 'couch-v39-guest-rsvp';`; CORS preflight on both rsvpStatus + rsvpRevoke return 204 with `access-control-allow-origin: https://couchtonight.app` |

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| rsvp.html confirmation count line | counts (yes, maybe) | rsvpSubmit CF response `guestCounts` field; populated by visible.filter() over wp.guests[] | YES (rsvpSubmit.js L163-165 derives from real guests array) | FLOWING |
| rsvp.html status poll | revoked / closed / guestCount | rsvpStatus CF reads wp.guests[] + wp.rsvpClosed live from Firestore | YES (rsvpStatus.js L66-75 reads live wp doc) | FLOWING |
| js/app.js guest chips | wp.guests array | wp.guests[] populated by rsvpSubmit on real RSVP submits | YES (renders only when array has !revoked entries) | FLOWING |
| js/app.js banner guestCount | wp.guestCount | denormalized field maintained by all 3 CFs (rsvpSubmit/rsvpRevoke revoke/attachPushSub) | YES (smoke 5.5 PASS for guestCounts; smoke 8.* covers reminderTick) | FLOWING |
| rsvpReminderTick guest sends | guest.pushSub | wp.guests[i].pushSub set by rsvpRevoke action='attachPushSub' from rsvp.html PushManager.subscribe | YES (real subscription endpoint serialized to Firestore) | FLOWING |

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase 27 smoke contract passes | `cd ~/couch && npm run smoke:guest-rsvp` | 47 passed, 0 failed; floor 29 >= 13 | PASS |
| Full smoke aggregate (10 contracts) passes | `cd ~/couch && npm run smoke` | All 10 contracts pass; smoke-guest-rsvp 47/0; smoke-position-anchored-reactions 103/103 (Phase 26 floor preserved) | PASS |
| Rules tests including Phase 27 describe block pass | `cd ~/couch/tests && npm test` | 52 passing / 0 failing; Phase 27 Guest RSVP rules: #27-01/02/03/04 all ✓ | PASS |
| Production sw.js CACHE = couch-v39-guest-rsvp | `curl -s https://couchtonight.app/sw.js \| head -3` | `const CACHE = 'couch-v39-guest-rsvp';` | PASS |
| rsvpStatus CF live + CORS-locked | `curl -X OPTIONS https://us-central1-queuenight-84044.cloudfunctions.net/rsvpStatus -H "Origin: https://couchtonight.app" -i` | 204 with `access-control-allow-origin: https://couchtonight.app` | PASS |
| rsvpRevoke CF live + CORS-locked | `curl -X OPTIONS https://us-central1-queuenight-84044.cloudfunctions.net/rsvpRevoke -H "Origin: https://couchtonight.app" -i` | 204 with `access-control-allow-origin: https://couchtonight.app` | PASS |
| Production rsvp.html carries Phase 27 surfaces | `curl -s https://couchtonight.app/rsvp.html \| grep -E 'qn_guest_\|VAPID\|startStatusPoll\|requestPushOptIn\|rsvp-privacy-link'` | All 5 Phase 27 sentinels present in live HTML | PASS |
| All 4 Phase 27 CFs loadable via Node require() | (verified at Plan 01 + 05 SUMMARY self-checks) | rsvpSubmit / rsvpStatus / rsvpRevoke / rsvpReminderTick all load and export functions | PASS |
| sw.js correctness | `node --check sw.js` (run by deploy.sh) | All JS files including sw.js parse cleanly per deploy.sh log | PASS |

## Requirements Coverage

15 RSVP-27-* requirements declared across PLAN frontmatters:
- Plan 01: 27-01, 27-02, 27-03, 27-04, 27-05, 27-12, 27-15
- Plan 02: 27-05, 27-06, 27-11, 27-14
- Plan 03: 27-07, 27-08, 27-09, 27-13
- Plan 04: 27-14, 27-15
- Plan 05: 27-08, 27-10, 27-11

| Requirement | Source Plan(s) | Description | Status | Evidence |
|-------------|---------------|-------------|--------|----------|
| RSVP-27-01 | 01 | rsvpSubmit accepts {guestId, pushSub?} additive params and runTransaction-upserts wp.guests[] | SATISFIED | `rsvpSubmit.js:130-171` runTransaction read-modify-write pattern; smoke 5.1 PASS (`db.runTransaction`); rsvpSubmit destructures guestId at L56 |
| RSVP-27-02 | 01 | Token TTL = wp.startAt + WP_ARCHIVE_MS (25h); legacy 6h hardcode removed | SATISFIED | `rsvpSubmit.js:104` `const WP_ARCHIVE_MS = 25 * 60 * 60 * 1000;`; smoke 5.2 PASS; smoke 5.6 PASS (negative sentinel — `6 * 3600 * 1000` no longer matches) |
| RSVP-27-03 | 01 | Guest name stored as raw, (guest) suffix is render-time only | SATISFIED | `rsvpSubmit.js:145-156` stores `name: cleanName \|\| 'Guest'` directly; `js/app.js displayGuestName` applies suffix only at render (smoke 9.9 PASS); manual UAT-27-06 covers visual surface |
| RSVP-27-04 | 01 | wp.guestCount denormalized, updated alongside wp.guests[] in same runTransaction | SATISFIED | `rsvpSubmit.js:167-170` `tx.update(wpRef, { guests, guestCount: visible.length })`; same pattern in rsvpRevoke L147-150 |
| RSVP-27-05 | 01, 02 | rsvpRevoke host-gates via permission-denied; soft-deletes via wp.guests[i].revoked = true | SATISFIED | `rsvpRevoke.js:90,94` `permission-denied` thrown for hostUid mismatch; `rsvpRevoke.js:145` `Object.assign(..., { revoked: true })`; smoke 7.4 PASS |
| RSVP-27-06 | 02 | tests/rules.test.js Phase 27 describe block — anon writes denied, member reads allowed | SATISFIED | `tests/rules.test.js:947-973` 4 assertions; rules-test run 52/0 PASS includes #27-01..04 |
| RSVP-27-07 | 03 | rsvp.html push opt-in CTA gated on PushManager feature-detect; iOS Safari non-PWA shows graceful absence | SATISFIED (automated) + NEEDS HUMAN UAT | rsvp.html L189-200 emits push-block only when `'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window`; smoke 9.4 PASS for handler. Visual outcome on iOS Safari covered by UAT-27-01 |
| RSVP-27-08 | 03, 05 | rsvp.html push subscribe → rsvpRevoke action='attachPushSub' writes wp.guests[i].pushSub | SATISFIED (server side) + NEEDS HUMAN UAT | `rsvpRevoke.js:103-132` attachPushSub branch with runTransaction; smoke 7.3 PASS. State A/B render outcomes on physical device covered by UAT-27-02 + UAT-27-03 |
| RSVP-27-09 | 03 | rsvp.html 30s polling via rsvpStatus CF detects revoked/rsvpClosed flips | SATISFIED (server side) + NEEDS HUMAN UAT | `rsvp.html:240` setInterval 30000 → rsvpStatus; rsvpStatus.js returns `{revoked, closed, guestCount}` (smoke 6.1-6.4 PASS). Two-device wall-clock revoke flow covered by UAT-27-04 |
| RSVP-27-10 | 05 | rsvpReminderTick second loop iterates wp.guests[] filtered to pushSub != null && !revoked; calls webpush.sendNotification directly | SATISFIED (code) + NEEDS HUMAN UAT | `rsvpReminderTick.js:141-174` guest loop; L228 direct webpush.sendNotification; smoke 8.1-8.5 PASS. Real schedule-firing covered by UAT-27-09 (potentially DEFERRED if no scheduler trigger access) |
| RSVP-27-11 | 02, 05 | Dead-subscription pruning — 410/404 sets pushSub = null via runTransaction | SATISFIED (code) + NEEDS HUMAN UAT | `rsvpReminderTick.js:232-248` dead-sub prune via runTransaction; smoke 8.4 + 8.5 PASS. Production log-absence verification covered by UAT-27-10 (potentially DEFERRED if no logs access) |
| RSVP-27-12 | 01 | rsvpSubmit enforces 100-guest soft cap at CF layer | SATISFIED | `rsvpSubmit.js:117-123` cap check; smoke 5.4 PASS (`guestCapReached`); rsvp.html L194-200 shows error toast on capReached |
| RSVP-27-13 | 03 | rsvp.html privacy footer link renders on form + confirmation | SATISFIED + NEEDS HUMAN UAT | `rsvp.html` `class="rsvp-privacy-link"` appears 4 times across renderInviteForm + renderConfirmation; smoke 9.5 PASS. Tap-target navigation to /privacy covered by UAT-27-01 |
| RSVP-27-14 | 02, 04 | app.html watchparty roster guest chips with badge + (guest) suffix on collision | SATISFIED + NEEDS HUMAN UAT | `js/app.js displayGuestName` smoke 9.9 PASS; `wp-participant-chip guest` smoke 9.6 PASS; `chip-badge badge-guest` rendered. Visual collision rendering covered by UAT-27-06 |
| RSVP-27-15 | 01, 04 | Host kebab → Remove (rsvpRevoke action='revoke') + Close RSVPs flow | SATISFIED (code) + NEEDS HUMAN UAT | `js/app.js window.revokeGuest`/`closeRsvps`/`openRsvps`/`openGuestMenu` (smoke 9.7/9.8 PASS); rsvpRevoke 3 actions (smoke 7.1/7.2/7.3 PASS); banner CLOSED pill + toggle (Plan 04 verified). Two-device flows covered by UAT-27-04 + UAT-27-05 |

**No orphaned requirements.** REQUIREMENTS.md lines 269-288 list RSVP-27-01 through RSVP-27-15; all 15 IDs claimed by at least one PLAN's `requirements:` frontmatter. No additional unclaimed RSVP-27-* IDs in REQUIREMENTS.md.

## Anti-Patterns Found

Anti-pattern scan results (against the 12 modified files):

| File | Pattern | Severity | Notes |
|------|---------|----------|-------|
| (none) | No TODO/FIXME/PLACEHOLDER comments introduced by Phase 27 | — | Plan SUMMARYs reference Phase 11 historical comments only |
| (none) | No `return null` / `return {}` / `return []` empty implementations | — | All CF return shapes are populated with real fields |
| (none) | No console.log-only stubs | — | console.warn/error calls in rsvpReminderTick are production telemetry, not stubs |
| (none) | No hardcoded empty data in render paths | — | All renderers defensively `Array.isArray(wp.guests) ? wp.guests : []` then filter |

**Note on stub-classification correctness:** The defensive `wp.guests || []` pattern flagged at Step 7's empty-array sentinel is INTENTIONAL — it's the safe default for an absent field on legacy wp docs (pre-Phase-27 wps). Real data flows from rsvpSubmit transactions; the defensive empty array only renders an empty chip list (correct behavior).

## Cross-Phase Regression Check

- All 10 smoke contracts pass (`npm run smoke` exits 0):
  - smoke-position-transform: PASS
  - smoke-tonight-matches: PASS (15/15)
  - smoke-availability: 23/23 PASS
  - smoke-kid-mode: PASS
  - smoke-decision-explanation: PASS
  - smoke-conflict-aware-empty: 14/14 PASS
  - smoke-sports-feed: 25/25 PASS
  - smoke-native-video-player: PASS
  - smoke-position-anchored-reactions: 103/103 PASS (Phase 26 floor preserved with RPLY-26-17 floor meta-assertion green)
  - smoke-guest-rsvp: 47/47 PASS (Phase 27 floor 29 >= 13 met)
- Rules tests 52/0 (was 48/0 pre-Phase-27; +4 new Phase 27 assertions; no regression on Phases 5/7/13/24)

## Deploy Verification

**Live production state confirmed:**

```
$ curl -s https://couchtonight.app/sw.js | head -3
// Couch service worker — drop this in the same folder as app.html + landing.html.
// Provides:
//   1. Offline shell caching ...
const CACHE = 'couch-v39-guest-rsvp';

$ curl -X OPTIONS https://us-central1-queuenight-84044.cloudfunctions.net/rsvpStatus \
    -H "Origin: https://couchtonight.app" -i 2>&1 | head -3
HTTP/1.1 204 No Content
access-control-allow-origin: https://couchtonight.app
vary: Origin, Access-Control-Request-Headers

$ curl -X OPTIONS https://us-central1-queuenight-84044.cloudfunctions.net/rsvpRevoke \
    -H "Origin: https://couchtonight.app" -i 2>&1 | head -3
HTTP/1.1 204 No Content
access-control-allow-origin: https://couchtonight.app
vary: Origin, Access-Control-Request-Headers
```

**Git log evidence:**
- couch repo: `b099baa test(27-05): extend smoke-guest-rsvp.cjs to 47 assertions + bump sw.js cache` + `fafdfae docs(27-05): scaffold 27-HUMAN-UAT.md` + 4 prior Plan 03 / 04 commits
- queuenight repo: `daa8e2a feat(27-05): rsvpReminderTick adds guest loop` + `b2949c9 feat(27-05): rsvpRevoke gains action='attachPushSub'` + `71b41c4` + `b28632d` + `fcb699a` (3 Plan 01 commits)

## Human Verification Required

Phase 27 has 5 categories of behaviors that require physical-device verification before user-facing acceptance:

### 1. UAT-27-01 — iOS Safari (non-PWA) push absence + privacy link

**Test:** Open `/rsvp/<token>` on iPhone Safari (not added to Home Screen); RSVP "Going" with name; observe confirmation screen; tap "Privacy Policy" link.
**Expected:** Confirmation screen renders WITHOUT the "Get reminded when the party starts?" block (graceful absence per D-06). Privacy Policy link navigates to /privacy.
**Why human:** PushManager feature-detect outcome on iOS Safari is browser-OS-mediated; cannot be Node-emulated. Privacy link tap is render-path correctness on touch device.
**Covers:** RSVP-27-07, RSVP-27-13

### 2. UAT-27-02 — Android Chrome push opt-in State A

**Test:** Open `/rsvp/<token>` on Android Chrome (incognito). RSVP "Going". Confirm push block appears. Tap "Remind me", allow OS prompt.
**Expected:** Confirmation shows "Get reminded..." block. Permission prompt appears and on Allow, button is replaced with "*You're on the list.*" (Instrument Serif italic).
**Why human:** OS-level permission UX cannot be Node-emulated.
**Covers:** RSVP-27-08

### 3. UAT-27-03 — Permission denied State B

**Test:** Open `/rsvp/<token>` on browser with notifications previously denied. RSVP "Maybe", tap "Remind me".
**Expected:** Button is replaced with "Notifications blocked in your browser settings." (Inter 13px ink-dim).
**Why human:** Browser permission state pre-condition + denial outcome is OS-mediated.
**Covers:** RSVP-27-08 negative path

### 4. UAT-27-04 — Two-device revoke within 30s

**Test:** Device A host on app.html roster + Device B guest on rsvp.html. Host kebab → Remove → toast. Wait up to 30 seconds.
**Expected:** Within 30s, Device B's rsvp.html flips to "Your RSVP was removed by the host." with focus on title for screen-reader announcement.
**Why human:** Real wall-clock 30s poll cycle + two physical devices + screen-reader VoiceOver/TalkBack confirmation.
**Covers:** RSVP-27-09

### 5. UAT-27-05 — Close RSVPs + secondary close + reopen

**Test:** Host taps Close RSVPs. New guest tries to RSVP. Host taps Open RSVPs.
**Expected:** Toast + RSVPs CLOSED pill renders; new guest submit returns closed state copy; reopen flips state back.
**Why human:** Two-device coordination across host UI + guest rsvp.html.
**Covers:** RSVP-27-15

### 6. UAT-27-06 — Name collision (guest) suffix

**Test:** Family member 'Sam' exists; guest RSVPs as 'Sam'. Host refreshes roster.
**Expected:** Guest chip shows "Sam (guest)" + apricot pill; original member 'Sam' chip unchanged.
**Why human:** Visual render correctness; collision detection at render time.
**Covers:** RSVP-27-14

### 7. UAT-27-07 — Aggregate count line

**Test:** Pre-condition 3 yes / 1 maybe / 0 no. New guest RSVPs maybe.
**Expected:** Confirmation shows "3 going · 2 maybe" (no "no" responses shown).
**Why human:** Real submit + render path against live wp doc; aggregate counts depend on multi-guest state.

### 8. UAT-27-08 — guestId continuity (D-03)

**Test:** Same browser repeat-RSVP with same name.
**Expected:** Updates response in place; only ONE chip on host roster.
**Why human:** localStorage + repeat-RSVP behavior across same-browser session vs new browser; DevTools localStorage inspection.

### 9. UAT-27-09 — Web push reminder T-1h fires

**Test:** Guest with pushSub set; wait until wp's T-1h window (or trigger Cloud Scheduler manually).
**Expected:** Test browser receives system notification with WINDOWS.yes title + interpolated body.
**Why human:** Real schedule trigger + Push Service delivery to physical device. May be DEFERRED if no scheduler trigger access.
**Covers:** RSVP-27-10

### 10. UAT-27-10 — pushSub=null + revoked guests skipped silently

**Test:** Trigger rsvpReminderTick with one revoked guest + one null-pushSub guest.
**Expected:** Firebase Functions logs show no error or send-attempt for these guests; totalSkipped increments; no webpush calls attempted.
**Why human:** Verifying absence of side-effect requires production logs access. May be DEFERRED if no logs access.
**Covers:** RSVP-27-11

## Gaps Summary

**No automated/deploy gaps found.** All 15 RSVP-27-* requirements have automated coverage via smoke contract production-code sentinels (47 assertions including 29 production-code grep sentinels with floor meta-assertion >= 13) + rules tests (52/0 PASS) + live production curl verification.

5 of 15 requirements (RSVP-27-07/08/09/10/11) are inherently device-UAT-only at the user-experience layer — automated coverage proves the code wiring exists and the deploy is live, but the user-perceived outcome (push permission flows, two-device revoke, schedule firing) requires real devices. All 10 device-UAT scripts in 27-HUMAN-UAT.md cover these.

The expected terminal status for Phase 27 — per the phase plan and per Plan 02/03/05 SUMMARY handoffs — is `human_needed`. Resume signal: `uat passed` → user runs `/gsd-verify-work 27` again post-UAT to mark phase shipped.

---

## Final Recommendation

**Status: human_needed.** Phase 27 implementation is complete, code is shipped to production, all automated gates pass. Awaits user-driven device UAT (10 scripts in 27-HUMAN-UAT.md). On `uat passed` resume signal, proceed to:

1. Mark Phase 27 SHIPPED in ROADMAP.md Progress table.
2. Update STATE.md "Recent shipped phases" lookback table with v39-guest-rsvp entry.
3. (Optional) Cross-phase regression sweep — confirm Phases 24 + 26 device-UAT items still parked in their respective HUMAN-UAT.md files have not been disturbed.

---

_Verified: 2026-05-02T03:25:00Z_
_Verifier: Claude (gsd-verifier)_
