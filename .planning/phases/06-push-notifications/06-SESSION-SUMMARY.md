---
phase: 06-push-notifications
type: session-summary
session: autonomous-2026-04-21
---

# Phase 6 — Autonomous Session Summary

**Session:** 2026-04-21 overnight autonomous run
**Scope approved:** Phase 6 Push Notifications full GSD flow (discuss → plan → execute), stage-only (no prod deploy), Phase 5.x fallback
**Operator:** Claude Opus 4.7 (1M context)

---

## TL;DR

Phase 6 ships **code-complete** stage-only. 9 commits on master from `bef75be` → HEAD. Ready for your approval + a three-step deploy batch before you can run device UAT.

No prod deploys happened this session (per auto-mode constraint).

---

## What shipped (9 commits on `couch/master`)

```
<HEAD>   docs(seeds): recategorize Phase 9 auth-polish seeds → Phase 5.x
66d3828  docs(06-05): scaffold UAT-RESULTS.md — 7 scenarios all PENDING
e3caa4a  feat(06-04): quiet-hours UI + helper, onInviteCreated + onSessionUpdate (PUSH-04)
746325f  feat(06-03): per-event-type notification prefs + Settings toggles (PUSH-02)
a425257  feat(06-02): wire VAPID public key + self-echo guard on sendToMembers
<plan suite commit>  docs(06): plan suite — RESEARCH + 5 plan files
1d16d32  docs(06): CONTEXT.md — Phase 6 Push Notifications decisions (auto)
<pre-session>  docs(05-09): update STATE.md post-deploy
<pre-session>  chore(tests): add rules-tests lockfile
```

### Phase 6 artifacts now in repo

- `.planning/phases/06-push-notifications/06-CONTEXT.md` — 21 locked decisions
- `.planning/phases/06-push-notifications/06-RESEARCH.md` — PUSH-01 artifact (web-push retained, competitor analysis for 6 apps)
- `.planning/phases/06-push-notifications/06-01-PLAN.md` through `06-05-PLAN.md` — 5 plan files
- `.planning/phases/06-push-notifications/06-UAT-RESULTS.md` — scaffolded with 7 PENDING scenarios
- `.planning/seeds/phase-05x-account-linking.md` — recategorized from phase-09
- `.planning/seeds/phase-05x-apple-signin.md` — recategorized from phase-09

### Code changes (3 files in couch repo, staged-only changes in queuenight/)

**Couch repo (committed):**
- `js/constants.js` — added `VAPID_PUBLIC_KEY` export with the real public key from `queuenight/functions/.env`
- `js/app.js` — removed `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'` placeholder + its guard; added `DEFAULT_NOTIFICATION_PREFS`, `NOTIFICATION_EVENT_LABELS`, `getNotificationPrefs()`, `updateNotificationPref()`, `updateQuietHours()`, `startNotificationPrefsSubscription()`, `renderNotificationPrefsRows()`; extended `updateNotifCard` to render per-event toggle list + quiet-hours picker when subscribed; hooked prefs subscription into `onAuthStateChangedCouch`
- `firestore.rules` — added top-level `match /users/{u}` rule (self-read/write) so `notificationPrefs` field is accessible

**queuenight/ (staged only — NOT git-tracked, synced via `cp`):**
- `queuenight/public/js/app.js` + `queuenight/public/js/constants.js` — synced from couch
- `queuenight/firestore.rules` — synced from couch
- `queuenight/functions/index.js` — extended:
  - `sendToMembers` signature with `{excludeUid, excludeMemberId, eventType}` options
  - New `isInQuietHours(qh)` helper with Intl-based tz + wrap-around
  - Prefs + quiet-hours + self-echo checks inside the send loop
  - 2 new triggers: `onInviteCreated`, `onSessionUpdate` (veto-cap branch only)
  - Updated 3 existing triggers to pass `eventType` + actor exclusion
  - `NOTIFICATION_DEFAULTS` mirror of the client map
- Function exports went from 12 to 14

---

## Deploy batch awaiting your approval

**Run these three commands (in order) from `C:\Users\nahde\queuenight`:**

```bash
# 1. Firestore rules (adds match /users/{u} for notificationPrefs access)
firebase deploy --only firestore:rules --project queuenight-84044

# 2. Cloud Functions (new: onInviteCreated, onSessionUpdate; updated: onWatchpartyCreate, onWatchpartyUpdate, onTitleApproval)
firebase deploy --only "functions:onInviteCreated,functions:onSessionUpdate,functions:onWatchpartyCreate,functions:onWatchpartyUpdate,functions:onTitleApproval" --project queuenight-84044

# 3. Hosting (VAPID wiring + per-event toggle UI + quiet-hours UI)
firebase deploy --only hosting --project queuenight-84044
```

Each is idempotent — re-running skips unchanged. Expected total time: ~3–5 minutes.

**Rollback:** git reset `couch/` back to `bef75be` (session start), `cp` the prior sw.js/index.js back into queuenight if you've already deployed, redeploy. The changes are additive and non-destructive to existing data, so a rollback shouldn't need any Firestore schema adjustment.

---

## Scope deviations from the written plan (flagging for your review)

### 1. `tonightPickChosen` event not wired on the CF side

**What the plan said:** Plan 06-04 was to add an `onSessionUpdate` branch that pushes when a tonight's-pick is chosen (transition on `pickedTitleId` from falsy → truthy with `spinnerId` set).

**What I found:** The existing session doc schema has no `pickedTitleId` field. The "pick accepted" flow is `acceptSpin → openScheduleModal → watchparty doc created`, and the watchparty creation already pushes under `watchpartyScheduled`. Adding a `tonightPickChosen` trigger on the session doc would fire on `spinnerId` writes (too early — the spin hasn't been accepted yet) or double-push with the existing watchparty trigger.

**What I did:** Skipped the CF trigger entirely with an inline comment explaining. The client-side pref toggle still exists in Settings but has no effect (defaults OFF so it's a harmless placeholder). Documented in the UAT-RESULTS stubs section and the Plan 06-04 commit message.

**Unblocks:** future Phase 7/8 which may introduce an explicit `pickFinalizedAt` field.

### 2. `vetoCapReached` interpretation

**What the plan said:** "Notify the group owner that tonight's selection is stuck" when `vetoCount` crosses a threshold.

**What I found:** The session doc has no `vetoCount` field. It has a `vetoes` MAP keyed by titleId.

**What I did:** Implemented the trigger using `Object.keys(vetoes).length` as the cap-check. Threshold set to 3 (sensible mid-point between Phase 4's per-member cap of 2 and "stuck-enough to warrant owner intervention"). Fires once on transition from <3 to ≥3. Inline comment explains the interpretation.

**Recommendation:** If the cap number is wrong, it's a one-line change in `queuenight/functions/index.js` — the `VETO_CAP_FAMILY` constant.

### 3. Account-linking implementation skipped

**What I considered doing:** Implementing the account-linking UI + helpers from the seed as Phase 5.x polish work.

**What I chose instead:** Expanded the seed (now `phase-05x-account-linking.md`) with file maps, error cases, and implementation phasing. **Reason:** implementing untested auth code without device UAT is higher-risk than the push work (which extended already-proven scaffolding). The seed is pickup-ready for a focused 3-hour session.

### 4. Apple Sign-In implementation skipped

**Reason:** Requires $99/yr Apple Developer Program purchase. Not an autonomous-mode call. Seed expanded (`phase-05x-apple-signin.md`) with the exact Apple/Firebase config steps needed.

---

## UAT you'll run when you wake up (in order)

1. **Approve and run the 3 deploy commands above.**
2. **Smoke-test:** open couchtonight.app → sign in → Settings → Notifications. You should see the card with "Turn on" (if you haven't already enabled). If already enabled, the card now shows 6 event-type toggles + a Quiet hours section. The toggles should reflect your current prefs (defaults: 4 on, 2 off).
3. **iOS flagship (Plan 06-05 Scenario 1):** physical iPhone 16.4+ as home-screen PWA → enable → ask spouse/kid device to schedule a watchparty 2min out → wait for status→active → confirm push arrives within ~5s.
4. **Update `.planning/phases/06-push-notifications/06-UAT-RESULTS.md`** in-place with PASS/FAIL per scenario as you verify. Commit per scenario (`docs(06-05): UAT results — scenario N PASS`).

---

## Known honest caveats

1. **Server code is untested in this session** — I wrote it, syntax-checked with `node --check`, but never ran it against real Firestore. Device UAT will exercise it for the first time.
2. **Client prefs UI is untested** — the toggle list renders inside `updateNotifCard` which only fires when the permission flow reaches the "granted + subscribed" branch. If your family member hasn't hit that branch, they won't see toggles (correct behavior, but worth mentioning).
3. **iOS PWA push is inherently flaky in the first ~minute after subscribe** — first push can take 10–30s to go through as APNs-bridging warms up. Subsequent pushes are sub-second. Don't treat the first push latency as a PUSH-03 failure.
4. **`forceThroughQuiet` on watchparty-starting is global** — every recipient gets the push during quiet hours, not just those who RSVP'd. Simpler implementation; if you want strict RSVP-only override, adjust in `queuenight/functions/index.js` onWatchpartyUpdate (split recipients into RSVP'd vs not, pass two different payloads).

---

## What's next after Phase 6 device UAT passes

1. Run `/gsd-verify-work` on Phase 6.
2. Run `/gsd-verify-work` on Phase 5 (still pending from your earlier session).
3. Pick up `.planning/seeds/phase-05x-account-linking.md` as a focused session (~3 hours including UAT).
4. Decide when to invest in Apple Developer + `.planning/seeds/phase-05x-apple-signin.md`.
5. Then Phase 7 Watchparty planning (depends on Phase 6's push infra, now ready).

---

## Commit trail

All 9 commits have full `Co-Authored-By` attribution. Atomic per plan as per your GSD discipline. Master branch is clean; working tree is clean.

---

*Session ran from ~8:30pm to wake-up. No interruptions. Phase 6 code-complete; UAT awaits your hands.*
