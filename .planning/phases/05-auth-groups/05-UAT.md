---
status: complete
phase: 05-auth-groups
source:
  - 05-UAT-RESULTS.md
  - 05-07-SUMMARY.md
  - 05-08-SUMMARY.md
started: 2026-04-22T02:45:00Z
updated: 2026-04-22T03:30:00Z
carry_over_from: 05-UAT-RESULTS.md (4 PASS / 7 PENDING / Apple deferred)
---

## Current Test

[testing complete]

## Environment note

**iOS PWA cache invalidation required before any hands-on on installed PWA.** Same rule as Phase 7: Safari Website Data → delete couchtonight.app → reopen PWA. For PC Chrome, Ctrl+Shift+R works. Incognito bypasses SW entirely.

**Tests below are scoped to Phase 5 pending items only.** 4 scenarios already PASS in 05-UAT-RESULTS.md (Google/Email-link/Phone/Sign-out) and are not re-tested. Apple Sign-In is explicitly deferred to Phase 9 per scope binding — not in this test list.

**Legacy family-ownership repair (2026-04-22):** Prior to running Test 2, UAT surfaced that families/ZFAM7 lacked the `ownerUid` field (doc created 2026-04-08, before Phase 5 planned ownership). Client-side `updateDoc` with Nahder's uid was rules-denied (`permission-denied` — existing rules have a catch-22 for legacy docs without `ownerUid`). Repaired via Firebase Console write: stamped `ownerUid = "jpTjwFzWiHaOalIr6OkD81p9ngn2"` on families/ZFAM7. This unblocked the "Group admin" settings panel (gated on `state.auth.uid === state.ownerUid` at js/app.js:2557). Captured as follow-up seed `.planning/seeds/phase-05x-legacy-family-ownership-migration.md` — long-term fix is a user-initiated "Claim ownership" CTA + rules branch for self-claim when ownerUid is missing. Incidental finding: at least one other family (FILMCLUB) exists in prod; ownership status unverified — widens the seed's scope.

## Tests

### 1. Sub-profile act-as (Plan 05-07, PARTY-01)
expected: |
  Create sub-profile "Test Kid" in Kids & sub-profiles settings. Tap its chip on
  Tonight to act-as. Cast one mood vote. Firestore session doc carries
  `managedMemberId` = Test Kid's id. Tap own chip to revert. Next vote clears back
  to self (D-04 per-action reversion).
result: pass

### 2. Password-protected join (Plan 05-07)
expected: |
  On your owner account, open group settings → set a password on ZFAM7. From a
  second browser context (incognito + second Google account, OR sign out and use
  a different identity), attempt to join ZFAM7. First try wrong password → join
  rejected. Retry with correct password → joinGroup CF accepts, member added.
result: blocked
blocked_by: prior-phase
reason: "No second Google identity available this session. CF (setGroupPassword / joinGroup with password) + UI (Group admin → Group password input) both deployed per Plan 05-07 SUMMARY. Deferred pending availability of a second test account."

### 3. Guest invite + expiry (Plan 05-07)
expected: |
  From owner account Settings, generate a guest invite link with 1-day expiry.
  Redeem the link on a second browser — joins as guest member. Back on owner,
  manually expire the member (or wait). Guest member chip filters out of the
  Tonight view; their identity no longer resolves for writes.
result: fail_scope_deferred
reason: "Owner-side mint shipped (Plan 05-07: createGuestInvite CF + UI + copy button all working — link was generated cleanly). Recipient-side redeem is a stub that routes to sign-in per 05-08-SUMMARY.md line 139: 'Plan 06 showInviteRedeemScreen stub was intentionally preserved — explicitly out of scope for Plan 5.8.' User confirmed this during UAT: clicking the link in incognito routed to Google/email/phone sign-in instead of a guest-join screen. Not a bug per plan contract — known-deferred. Captured as follow-up seed."
severity: major
seed: .planning/seeds/phase-05x-guest-invite-redemption.md
next_step: "Ship the seed's consumeGuestInvite CF + showInviteRedeemScreen client flow. Pair with the account-linking seed's sign-in-screen UX polish (phase-05x-account-linking.md item #7) for a coordinated auth-UX sprint."

### 4. Sports Watchparty regression (post-writeAttribution migration)
expected: |
  Start a Sports watchparty from your phone. Join from PC incognito. Send
  reactions from both. All reactions appear real-time on both devices (gated by
  the Phase 7 fix ce3c507 — passive propagation now working). Core goal: confirm
  the 11-write writeAttribution migration (commit 874c145) didn't regress
  sports-specific write paths.
result: static-verified
evidence: "All 17 watchparty-doc write sites in js/app.js spread writeAttribution(): 3128 (archive), 3232-3236 (scheduled-to-active flip), 7403 (confirmStartWatchparty setDoc), 7465 (scheduleSportsWatchparty setDoc), 7499 (join wp update), 7947 (postReaction reactions-arrayUnion), 7966-7970 (pause resume), 7975-7978 (pause), 7996-8000 (setWpMode), 8021-8025 (setReactionDelay), 8053-8057 (claimStartedOnTime), 8071, 8073 (leave), 8086 (cancel), 8114-8117 (startMyWatchpartyTimer). Zero writes missing attribution. Sports create path (7465) has identical shape to movie create path (7403) — no sports-specific code-divergence regression risk."
rationale: "Runtime re-verification would require creating a new watchparty doc which fires onWatchpartyCreate CF → push notifications to all ZFAM7 members. Shared-state side effects on real family devices not worth re-running when the migration is purely a spread pattern that's trivially verifiable via grep. If runtime doubt surfaces later, the existing Apr-21 post-migration 'everything works so far' informal pass in 05-UAT-RESULTS.md and the Phase 7 reactions UAT already exercised movie-path writes."

### 5. Migration claim — AUTH-04 (Plan 05-08)
expected: |
  In Firestore Console: pick a legacy member doc in families/ZFAM7/members/ that
  has no `uid` field (or create a test one). From owner settings, generate a
  claim link for that member. Redeem the link on a second Google account (PC
  incognito with a fresh sign-in works). Confirm: (a) the member doc now has
  `uid` stamped to the claiming Google uid, (b) their prior vote history is
  preserved (grep `memberId` in session docs — still points to same member),
  (c) claiming account lands on Tonight inside ZFAM7 bound to that member.
result: static-verified
runtime_blocked_by: prior-phase (no second Google account available)
evidence: "queuenight/functions/mintClaimTokens.js:46-151 onCall CF — accepts {familyCode, memberIds, type}, validates type='migration'|'graduation', randomBytes(32) tokens, owner-only gate (82-85), atomic batch write. queuenight/functions/claimMember.js:33-105 onCall CF — runTransaction with consumedAt single-use check (59), expiry validation (62), atomic uid+claimedAt stamp (78-79), graduation branch clears managedBy + stamps graduatedAt (83-86), writes users/{uid}/groups/{code} index (97-101). Both CFs exported from queuenight/functions/index.js:604-609. Client: js/app.js:2037-2065 handlePostSignInIntent reads ?claim= param + sessionStorage, routes to showClaimConfirmScreen; 2167-2185 shows confirm screen; 2189-2225 confirmClaim calls claimMember CF with full error-mapping. index.html:147-165 #claim-confirm-screen div present. Data integrity: member doc shape preserved — prior vote history stays intact because claim only stamps uid, no memberId rewrite anywhere."

### 6. Graduation — D-16 (Plan 05-08)
expected: |
  Create a sub-profile "Grad Kid" under your account. From Kids & sub-profiles
  settings, tap its row and generate a graduation link. Redeem on a THIRD
  account (second incognito session, different Google identity). Confirm: (a)
  `managedBy` cleared on the member doc, (b) `uid` stamped, (c) `graduatedAt`
  timestamp present, (d) new account lands on Tonight as Grad Kid — no longer
  a managed sub-profile.
result: static-verified
runtime_blocked_by: prior-phase (no third Google account available)
evidence: "Sub-profile creation from 05-07: js/app.js:2450 openCreateSubProfile, 2462-2488 createSubProfile writes {managedBy: state.auth.uid, NO uid}. Graduation UI: #subprofile-list rendered by js/app.js:2489-2501 renderSubProfileList, each row has 'Send claim link' → sendGraduationLink (js/app.js:2505-2548). sendGraduationLink validates managedBy === state.auth.uid (2510-2512), calls mintClaimTokens CF with type='graduation' (2516), Web Share API preferred + clipboard fallback, error-maps permission-denied + failed-precondition. claimMember CF graduation branch (claimMember.js:83-86): deletes managedBy, stamps graduatedAt=claimedAt atomically. memberId unchanged — history preserved. mintClaimTokens validates parent-child relationship (T-05-08-03: managedBy !== uid check at claimMember.js:107)."

### 7. Grace-window cutoff (AUTH / D-15)
expected: |
  In Firebase Console: temporarily set `families/ZFAM7/settings/auth.graceUntil`
  to a past timestamp (e.g. yesterday). Refresh the app on a device signed in
  as an unclaimed legacy member (you may need to sign in with a fresh identity
  that's bound to an unclaimed member). Confirm: (a) read-only banner appears,
  (b) vote/veto buttons disabled, (c) Firestore rules reject any legacy-only
  writes. RESTORE graceUntil to the original value when done.
result: static-verified
runtime_blocked_by: prior-phase (requires an unclaimed-legacy identity to drive the UI path)
evidence: "Client helpers: js/app.js:2673-2682 isReadOnlyForMember(member, settings) — returns true when graceUntil<now && !member.uid && !member.managedBy && !member.temporary; 2688-2694 isCurrentSelfReadOnly routes via state.actingAs. applyReadOnlyState at js/app.js:2709-2717 toggles body.is-readonly + #claim-prompt-banner visibility; called on every renderAll (3413, 4449). guardReadOnlyWrite at 2721-2726 is the write-path gate — integrated into applyVote (1397), submitVeto (7041), addDetailMood/removeDetailMood (6009), postComment (5096), postActivityReply (6476), postReaction (7932), confirmStartWatchparty (7425), askTheFamily (1377), openProposeIntent (1397) — 10+ write paths. renderGraceBanner at 2729-2740 shows days-remaining, wired into settings snapshot (2033). Rules-side: firestore.rules:48-79 graceActive() checks settings/auth.graceUntil > request.time.toMillis(); legacyGraceWrite allows {memberId, memberName} without actingUid only during grace (70-74); post-grace, validAttribution enforces actingUid==uid() (61) blocking unclaimed members. CSS css/app.css:2096-2103 dims vote/veto/mood-add buttons under body.is-readonly (opacity:0.4, pointer-events:none)."

### 8. iOS standalone PWA round-trip (Google sign-in)
expected: |
  On your iPhone: remove couchtonight.app from home screen if installed. In
  Safari, open couchtonight.app → Share → Add to Home Screen. Launch the PWA
  from the home screen icon (standalone mode). Sign in with Google via the
  popup/redirect flow. Confirm: (a) redirect returns to the installed PWA
  without breaking out to mobile Safari, (b) lands on Tonight in ZFAM7, (c)
  session persists after force-closing and reopening the PWA. This is the
  iOS-standalone historical-gotcha check flagged in 05-UAT-RESULTS.md.
result: skipped
reason: "User declined the physical-device test this session. Desktop Chrome Google sign-in already PASS per 05-UAT-RESULTS.md Task 1. The iOS-standalone gotcha is specifically a Firebase popup/redirect behavior check inside home-screen-launched PWA — not a code correctness gap. Already noted as 'still owed for Phase 5 sign-off' in 05-UAT-RESULTS.md line 59; preserving that outstanding status here."
next_step: "Run on next iOS device session — single round-trip on Google sign-in from installed PWA is sufficient to verify. No new plans needed; this is pure UAT execution owed."

## Summary

total: 8
passed: 1
static_verified: 4
blocked: 1
fail_scope_deferred: 1
skipped: 1
issues: 0
pending: 0

closure_note: "All 8 tests accounted for. Zero code bugs found — 1 runtime pass (sub-profile act-as), 4 static-verified (Sports WP regression, migration claim, graduation, grace-window), 1 blocked (password-protected join, needs 2nd Google account), 1 fail-scope-deferred (guest invite redeem — seed captured), 1 skipped (iOS standalone PWA — noted as still-owed). Phase 5 closes code-complete. Residual runtime UAT items are environmental (multi-account setup, iPhone session) not code blockers."

## Gaps

- truth: "A recipient clicking a mint'd guest invite link lands on a guest-join screen (not the sign-in screen) and can join the family as a temporary member within one click of entering their name"
  status: fail_scope_deferred
  reason: "Recipient-side redemption (showInviteRedeemScreen) was explicitly preserved as a stub per 05-08-SUMMARY.md line 139. User UAT confirmed: link redemption routes to sign-in screen. Owner-side mint works."
  severity: major
  test: 3
  seed: .planning/seeds/phase-05x-guest-invite-redemption.md
  scope: "Blocks any actual use of guest invites in prod. Doesn't block Phase 5 closure because the deferral was a conscious plan-scope decision, but does mean the invite-link feature is mint-only v1."

- truth: "Sign-in landing screen surfaces a clear 'Sign in' vs 'Create account' distinction so returning users don't experience a sign-up-style flow every time they onboard a new device"
  status: gap_observed
  reason: "Informal feedback during UAT on 2026-04-22: user noted the landing experience feels like re-creating an account each time they approach it with a fresh browser/device, even though Firebase auto-detects returning users. Pure UX/microcopy polish — no auth-logic bug."
  severity: minor
  surfaced_during: test 3 discussion
  seed: .planning/seeds/phase-05x-account-linking.md (item #7 — sign-in-screen UX split)

## Carry-over from 05-UAT-RESULTS.md (already PASS — not re-tested)

- Google provider round-trip (multi-session, fresh incognito) ✓
- Email link round-trip (Gmail web → couchtonight.app) ✓
- Phone (SMS) round-trip with E.164 auto-normalization ✓
- Sign-out + teardown ✓
- Vote + veto + self-echo (informal pass after writeAttribution migration) ✓
- Mood tags cross-device (implicit pass) ✓

## Explicitly deferred (not in scope for this UAT)

- Apple Sign-In → Phase 9 (`.planning/seeds/phase-09-apple-signin.md`)
- Email deliverability (spam folder) → Phase 9 polish
- Phone + Google account linking (`linkWithCredential` affordance) → Phase 9 polish
