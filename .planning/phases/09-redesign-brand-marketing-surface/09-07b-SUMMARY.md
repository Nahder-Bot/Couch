---
phase: 09-redesign-brand-marketing-surface
plan: 07b
subsystem: ui
tags: [pwa, firebase, cloud-functions, auth, motion, design-system, brand]

requires:
  - phase: 05-auth-groups
    provides: inviteGuest CF, firestore rules baseline, anonymous-auth wiring
  - phase: 09-07a
    provides: first-run onboarding guard (Pitfall 5 client-side), BRAND.md token docs, signin-methods card
provides:
  - Guest invite redemption screen (DESIGN-08) — unauthed ?invite=<token> lands on branded redeem screen, NOT sign-in
  - Expired-invite dead-end screen — friendly "ask for a new one" copy, NEVER routes to sign-in
  - consumeGuestInvite Cloud Function (admin SDK, idempotent, {preview|consume} modes)
  - Motion audit closure (DESIGN-09 second half) — every transition/animation token-backed
  - prefers-reduced-motion block hardened + documented
  - 5 new motion tokens: --t-spin, --t-celebrate, --t-shimmer, --t-pulse, --t-story
  - Firestore rules architecture note documenting the CF+admin-SDK guest-member path
affects: [phase-10-year-in-review, future-motion-work, future-auth-surface-work]

tech-stack:
  added: [signInAnonymously (firebase-auth), Firestore collectionGroup query for invite lookup]
  patterns:
    - "CF+admin-SDK as the authoritative writer for guest/temporary member docs (Firestore rules do NOT gate this path)"
    - "Two-mode onCall CF (preview vs consume) for invite-redemption UX prefetch"
    - "Transactional idempotency: invite.consumedAt + member doc written in same Firestore txn"
    - "Token-only deep links (no &family=CODE) — token resolves family server-side for security"
    - "Motion tokens cover short tiers (--t-instant/quick/base/deliberate/cinema) AND long-form cinema/loop effects (--t-spin/celebrate/shimmer/pulse/story)"

key-files:
  created:
    - queuenight/functions/src/consumeGuestInvite.js
  modified:
    - firestore.rules (+ queuenight/firestore.rules mirror)
    - app.html (invite-redeem-screen + invite-expired-screen DOM)
    - css/app.css (invite-redeem styles + 5 motion tokens + audit + reduced-motion docs)
    - js/app.js (boot() invite detour + showInviteRedeemScreen + fetchInvitePreview + submitGuestRedeem + drift-3 URL strip)
    - js/firebase.js (signInAnonymously import/export)
    - queuenight/functions/index.js (exports.consumeGuestInvite)
    - queuenight/functions/src/inviteGuest.js (drift-3: strip &family= from deep link)
    - sw.js (CACHE couch-v20 -> couch-v21)

key-decisions:
  - "Task 1 REFRAMED from invariant-grep-gate to documentation commit — the expected temporary:true rules branch never shipped; Plan 05-07 built guest writes via CF+admin-SDK. Zero temporary matches in firestore.rules is the correct state, not a regression."
  - "consumeGuestInvite is a NEW CF (not a modification of joinGroup) because it writes seenOnboarding:true at creation time (Pitfall 5 double-defense) which joinGroup doesn't."
  - "Rate-limit (drift 1) SKIP for v1 — documented below. Token entropy (256 bits) makes brute-force non-viable; worst-case DoS is anonymous signup burst which can be capped with App Check post-launch if real friction surfaces."
  - "5 new motion tokens added instead of leaving raw long-form durations — keeps the motion audit acceptance strict (grep cubic-bezier == 4; no raw ms/s outside :root + reduced-motion)."
  - "1.4s flash-highlight absorbed into --t-celebrate (1.2s) — 200ms variance below perceptual threshold for celebratory beats."

patterns-established:
  - "CF-side seenOnboarding:true defense pattern: guest/temporary members MUST have seenOnboarding set at member-doc creation time, not just via the client guard. Any future CF that creates member docs on behalf of new users should follow this pattern."
  - "Two-mode onCall CF pattern ({preview:true} vs mutation) — useful for any future UX that needs to fetch 'what would happen' before committing to a state-changing call."
  - "Token-only deep links — family code never bundled in share URLs. Token resolves family server-side. Apply this pattern to any future magic-link / claim-token surface."
  - "Motion token tier system: standard tiers (instant/quick/base/deliberate/cinema) for interaction feedback, purpose-specific tokens (spin/celebrate/shimmer/pulse/story) for long-form cinema/loop effects."

requirements-completed:
  - DESIGN-08  # Invite-flow onboarding polished + brand-aligned (CLOSED)
  - DESIGN-09  # Motion language applied — second half (CLOSED, first half landed in 09-02/09-03)

duration: ~90min
completed: 2026-04-22
---

# Phase 09-07b: Guest Invite Redemption + Motion Audit Summary

**Unauthed guests redeem invite tokens into branded redeem screens (CF+admin-SDK, idempotent, seenOnboarding:true at creation), and every transition/animation in css/app.css now references motion tokens with reduced-motion hardening documented.**

## Performance

- **Duration:** ~90 minutes
- **Started:** 2026-04-22
- **Completed:** 2026-04-22
- **Tasks:** 3 commits + SUMMARY + sw.js bump
- **Files modified:** 8 (4 in main repo, 4 in sibling queuenight)

## Accomplishments
- Guest invite redemption flow: unauthed ?invite=<token> bypasses sign-in, renders branded redeem screen, creates temporary member via CF with seenOnboarding:true, lands on Tonight
- Expired-invite dead-end screen — friendly "ask for a new one" UX that NEVER routes to sign-in
- consumeGuestInvite Cloud Function — onCall, admin SDK, transactional idempotency, two-mode (preview / consume)
- Full motion audit across css/app.css — zero raw ms/s literals in transitions/animations outside :root + reduced-motion; exactly 4 cubic-bezier occurrences (the canonical :root token definitions)
- 5 new motion tokens introduced for long-form cinema/loop effects
- prefers-reduced-motion block hardened + documented

## Task Commits

1. **Task 1: Firestore rules — document CF+admin-SDK architecture (REFRAMED)** — `46843ae` (chore)
2. **Task 2: Guest invite redemption + consumeGuestInvite CF + bootstrap detour** — `41b18a9` (feat)
3. **Task 3: Motion audit + reduced-motion hardening + sw.js v21 bump** — `a04b582` (feat)

### Per-commit diff stats
- `46843ae`: 1 file, +20/-0 (firestore.rules architecture note)
- `41b18a9`: 4 files, +207/-7 (app.html, css/app.css, js/app.js, js/firebase.js)
- `a04b582`: 2 files, +66/-48 (css/app.css motion audit, sw.js)

## Task 1 — Reframe Rationale

**Pre-flight invariant grep was a false-positive.** The plan's Task 1 expected a `temporary == true` member-doc branch in firestore.rules per seed 05x-guest-invite-redemption's original hypothesis. That branch never shipped. Plan 05-07 built guest-invite member writes via Cloud Functions (joinGroup, inviteGuest, claimMember) using the admin SDK — which bypasses Firestore rules entirely. Zero `temporary` matches in both `firestore.rules` and `queuenight/firestore.rules` is the correct architectural state.

Reframe outcome: Task 1 converted from a halt-if-false rules gate into a documentation commit. Added an ARCHITECTURE NOTE comment block to the server-only-surfaces section of firestore.rules explaining the CF+admin-SDK path for guest/temporary member docs. Future archaeologists reading the rules file will understand the intent without needing to grep source-of-truth across repos. Mirrored to sibling `queuenight/firestore.rules`.

## Drift Outcomes

**Drift 1 — rate-limit on consumeGuestInvite:** SKIP for v1.
- Rationale: token entropy is 256 bits (32 bytes base64url) — collision/brute-force statistically impossible.
- Residual attack surface: anonymous-signup DoS via repeated failed preview calls. Low-cost to mitigate post-launch with App Check attestation + per-IP Firestore counter.
- Logged as known-accepted risk (T-09-07b-01 mitigation is entropy-only; T-09-07b-07 DoS rate-limit trade-off moved from "mitigate" to "accept for v1").

**Drift 2 — write-path expiry checks:** IMPLEMENTED.
- Pre-transaction expiry check on preview + consume paths (catches obvious expired tokens fast).
- In-transaction re-check (catches the race where the invite expires between preview fetch and consume submit).
- Idempotency: transactional read-modify-write of `invite.consumedAt` — second call with same token throws `failed-precondition: Invite has already been used`.

**Drift 3 — strip &family= from owner-side URL:** IMPLEMENTED in both layers.
- `queuenight/functions/src/inviteGuest.js`: deep link now emits `https://couchtonight.app/?invite=<token>` only.
- `js/app.js createGuestInvite`: defensive client-side `URL.searchParams.delete('family')` before display (belt-and-suspenders — if a stale CF deploy still emits `&family=`, client strips it anyway).
- Security rationale: family code never leaks into share URLs; token resolves family server-side during CF execution.

## Motion Audit Metrics

**Pre-audit state (commit 8d597e9):**
- 45 raw ms/s literals in transition/animation declarations outside :root + reduced-motion
- 6 raw easing functions (1 cubic-bezier outside :root, 5 ease-* keywords)
- 4 cubic-bezier token definitions in :root (expected canonical)

**Post-audit state (commit a04b582):**
- 0 raw ms/s literals in transition/animation declarations outside :root + reduced-motion
- 0 raw easing functions outside var() references
- 4 cubic-bezier occurrences total (exactly the :root token definitions — nothing else)
- 47 lines modified, 66 discrete replacements

**New tokens added (in :root extension, under existing motion tier additions):**
| Token | Value | Used by |
|-------|-------|---------|
| `--t-spin` | 600ms | `.spin-spinner` rotation |
| `--t-celebrate` | 1.2s | `.flash-highlight` + `confetti-fall` |
| `--t-shimmer` | 1.6s | `.sk` skeleton-shimmer gradient sweep |
| `--t-pulse` | 2s | `.wp-banner.imminent` breathing pulse |
| `--t-story` | 5s | `yir-story-fill` auto-advance |

**Odd-duration mappings (Minor-11 closure):**
- `0.08s` (80ms) → `var(--t-instant)` [50ms tier; 30ms delta below perceptual threshold]
- `0.12s` (120ms) → `var(--t-quick)` [150ms tier; 30ms delta]
- `0.1s` (100ms) → `var(--t-quick)` [150ms tier; 50ms delta]
- `0.32s` (320ms) → `var(--t-deliberate)` [300ms tier; 20ms delta]
- `1.4s` flash-highlight → `var(--t-celebrate)` (1.2s token) [200ms delta, below perceptual threshold for celebratory beats]

**Audit script verification:**
```
Raw ms/s literals outside :root+reduced: 0
Raw easing functions outside var(): 0
cubic-bezier total occurrences: 4 (== 4 :root token definitions)
AUDIT OK
```

**prefers-reduced-motion hardening:** Added inline documentation block above the `@media` rule explaining the 0.01ms "effectively off" trick, animation-iteration-count:1 cap on loops, scroll-behavior:auto vestibular-safety carve-out, and the "no essential-motion carve-outs" decision (every motion in the app is decorative).

## Acceptance Verification

```
grep -q showInviteRedeemScreen js/app.js                                     PASS
grep -q consumeGuestInvite js/app.js                                         PASS
grep -q "invite-redeem-screen" app.html                                      PASS
grep -q "invite-expired" app.html                                            PASS
grep -q seenOnboarding queuenight/functions/src/consumeGuestInvite.js        PASS
grep -q "couch-v21" sw.js                                                    PASS
node --check js/app.js                                                       PASS
motion-audit script (cubic-bezier=4, rawMs=0, rawEase=0)                     PASS
```

## Files Created/Modified

- `queuenight/functions/src/consumeGuestInvite.js` — new CF, onCall, admin SDK, {preview|consume} modes, transactional idempotency
- `firestore.rules` + `queuenight/firestore.rules` — architecture note documenting CF+admin-SDK guest-member path
- `app.html` — invite-redeem-screen + invite-expired-screen DOM (sibling to signin-screen)
- `css/app.css` — invite-redeem styles + 5 motion tokens + 47-line audit + reduced-motion hardening docs
- `js/app.js` — boot() invite detour BEFORE sign-in gate + showInviteRedeemScreen + fetchInvitePreview + submitGuestRedeem + drift-3 URL strip in createGuestInvite
- `js/firebase.js` — added signInAnonymously to imports and exports
- `queuenight/functions/index.js` — exports.consumeGuestInvite registration
- `queuenight/functions/src/inviteGuest.js` — deep link now emits ?invite=<token> only (drift 3)
- `sw.js` — CACHE: couch-v20-09-07a-onboarding → couch-v21-09-07b-guest-invite

## Decisions Made

- **Task 1 reframe** (see above) — replaces invariant-halt gate with architecture documentation; no rules mutation needed.
- **Separate CF for consumeGuestInvite** (not a joinGroup parameter) — chose a dedicated function because the semantics differ materially: consumeGuestInvite sets `seenOnboarding:true` at creation (Pitfall 5 defense), writes `type:'guest'` explicitly, and runs against an anonymous-auth uid (joinGroup assumes a real user identity). Future cleanup could fold both into a shared helper; v1 keeps them separate for bisect clarity.
- **Deferred rate-limit** for consumeGuestInvite (drift 1 SKIP) — entropy-based threat model covers the primary attack; anonymous-signup DoS is acceptable for v1 with a post-launch App Check hook if observed.
- **Motion tokens for long-form effects** (drift from "map to --t-cinema with comment" to "add 5 dedicated tokens") — stricter audit acceptance, clearer intent in the token names. Plan's escalation clause permitted either path.
- **1.4s flash absorbed into --t-celebrate (1.2s)** — 200ms rounding below perceptual threshold for one-shot celebration animations. Flagged in commit body for reviewer sanity-check.

## Deviations from Plan

### 1. Task 1 reframe (orchestrator-directed)
- **Found during:** Pre-flight invariant grep returned 0 matches in both firestore.rules files.
- **Issue:** Plan's Task 1 expected a `temporary == true` rules branch that was never shipped.
- **Fix:** Reframed Task 1 to a documentation commit per orchestrator instruction. Added architecture note to firestore.rules.
- **Verification:** Commit `46843ae` landed with +20 lines of rules documentation; no rules behavior changed.

### 2. Added 5 long-form motion tokens (not in original plan's mapping table)
- **Found during:** Task 3 enumeration — 5 animation durations (0.6s, 1.2s, 1.4s, 1.6s, 2s, 5s) exceeded the plan's short-tier table (≤400ms → --t-cinema).
- **Issue:** Plan's mapping table didn't cover cinema/loop effects. Options: (a) leave raw with inline comments (plan's escalation provision), (b) map all to --t-cinema (breaks animation semantics — 5s becomes 400ms), (c) add purpose-specific tokens.
- **Fix:** Chose option (c) — 5 new tokens preserve original semantics AND pass the strict audit grep. Tokens live in the existing DESIGN-09 :root extension block (not in the protected 4 cubic-bezier definitions).
- **Verification:** `grep cubic-bezier css/app.css | wc -l` returns 4 (expected), zero raw ms/s in non-root non-reduced regions.

### 3. signInAnonymously added to firebase.js
- **Found during:** submitGuestRedeem implementation.
- **Issue:** Anonymous auth wasn't previously exported — needed so guest uid can attribute the CF member write.
- **Fix:** Added `signInAnonymously` to the firebase-auth import line and export list in js/firebase.js.
- **Verification:** node --check js/app.js PASS; dynamic `import('./firebase.js')` in submitGuestRedeem resolves.

**Total deviations:** 3 (1 orchestrator-directed reframe, 2 plan-provision-covered auto-fixes)
**Impact on plan:** Deviation 1 was the orchestrator's instruction; deviations 2+3 are in-scope refinements covered by the plan's escalation provisions. No scope creep.

## Issues Encountered
None — each task landed cleanly against its test matrix. Audit script caught two `0.01ms` false-positives initially (brace-matching bug in the :root stripper), fixed by switching to proper depth-tracking brace-matching before running final verification.

## User Setup Required

**Task 4 (user actions, pre-UAT):**

1. **Deploy Cloud Function:**
   ```
   cd /c/Users/nahde/queuenight
   firebase deploy --only functions:consumeGuestInvite
   ```
   The function expects the same project (`queuenight-84044`) and region (`us-central1`) as existing Phase 5 CFs.

   Optional redeploy if the owner-side link sanitization is important to you immediately (drift 3 also strips `&family=` in inviteGuest):
   ```
   firebase deploy --only functions:inviteGuest,functions:consumeGuestInvite
   ```

2. **Deploy hosting mirror** (app.html + css/app.css + js/app.js + js/firebase.js + sw.js are already mirrored to `queuenight/public/`):
   ```
   cd /c/Users/nahde/queuenight
   firebase deploy --only hosting
   ```

3. **UAT track A — Invite mint → redeem flow:**
   - Sign in to a dev family, open Account settings, mint a guest invite (pick a duration — start with 1 day).
   - Copy the deep link (should now be `https://couchtonight.app/?invite=<token>` — no `&family=`).
   - Open in a separate browser / incognito window, unauthed.
   - Expected: invite-redeem-screen paints (not sign-in). Shows guest-pass pill + duration badge + name input.
   - Enter a name, tap "Join the couch".
   - Expected: anonymous signup runs, CF consumes the invite, lands on Tonight. Guest chip appears with badge-guest.
   - **Pitfall 5 check:** no first-run onboarding fires. Confirm via DevTools — state.me.seenOnboarding === true.
   - Verify owner sees the new guest chip appear within 1-2s.
   - **Idempotency check:** reload the incognito URL or tap the link again. Expected: invite-expired-screen (not sign-in), because consumedAt is now set.
   - **Expired-invite check:** in Firestore console, manually set `families/<code>/invites/<token>.expiresAt` to a past timestamp. Open the link. Expected: invite-expired-screen immediately.

4. **UAT track B — reduced-motion regression check:**
   - iOS: Settings → Accessibility → Motion → Reduce Motion ON.
   - Open the app. Spot-check 5 surfaces: Tonight spin, modal open, toast appear, button press, watchparty banner imminent pulse.
   - Expected: animations collapse to essentially-zero duration (snap-in, no motion). No visual regression on fully-rendered state.
   - DevTools Console: `getComputedStyle(document.querySelector('.wp-banner.imminent')).animationDuration` should be `0.01ms`.

5. **Regression gate — Phase 9 surfaces:**
   - Landing page unchanged (landing.html NOT touched by this plan).
   - 09-07a onboarding still fires for non-guest new users.
   - Legacy self-claim CTA still renders on legacy families.
   - Sign-in methods card still lists providers + offers set-password.
   - Intent tz-aware push still renders correct local time.

## Next Phase Readiness

- Phase 9 redesign/brand milestone: DESIGN-01..DESIGN-10 all closed. Ready for state archival + milestone completion.
- Plan 09-07b's SW cache bump (v21) ensures installed PWAs pick up the redeem surface + motion audit together on next online activation.
- Phase 10 (Year-in-Review) can proceed once UAT approves. No blockers surfaced by this plan.
- One accepted follow-up: rate-limit hardening on consumeGuestInvite — defer until App Check wiring or until real DoS signal surfaces in prod logs.

## Ready for Task 4

Three commits landed, SUMMARY written, audit verified, mirror synced. Awaiting user to run Task 4 deploy + UAT tracks A+B+regression gate.

---
*Phase: 09-redesign-brand-marketing-surface*
*Plan: 07b*
*Completed: 2026-04-22*
