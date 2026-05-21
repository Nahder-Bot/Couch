---
phase: 05-auth-groups
plan: 05-01
status: complete
completed: 2026-04-21
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [AUTH-01]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 05-01 — Auth infrastructure: firebase.js + authDomain flip + js/auth.js module + state/constants extensions

Foundation plan for Phase 5. Lays the four JS-module deliverables every subsequent plan in Phase 5 imports from: extended `js/firebase.js` with the Firebase Auth SDK + `auth` instance + Functions SDK, the new `js/auth.js` provider-wrapper module, extended `js/state.js` auth/acting-as/settings keys, and the new `js/constants.js` `CF_*` / TTL / GRACE constants.

## What landed

Reconstructed from `05-01-PLAN.md` must_haves + `05-02-SUMMARY.md` cross-references + live file inspection:

- **`js/firebase.js`** — Firebase Auth SDK import block added (16 named exports including `getAuth`, `GoogleAuthProvider`, `OAuthProvider`, `signInWithRedirect`, `getRedirectResult`, `signInWithPhoneNumber`, `RecaptchaVerifier`, `sendSignInLinkToEmail`, `isSignInWithEmailLink`, `signInWithEmailLink`, `onAuthStateChanged`, `signOut as firebaseSignOut`); Functions SDK import block added (`getFunctions`, `httpsCallable`); `authDomain` flipped from `queuenight-84044.firebaseapp.com` → `couchtonight.app` (same-origin fix for iOS PWA per RESEARCH.md §1); `export const auth = getAuth(app)` + `export const functions = getFunctions(app)` instances exposed; existing Firestore re-export line extended with the new Auth + Functions surfaces. Note: the `authDomain` flip itself shipped via commit `c2c5af6` `fix(05-06): flip authDomain from Firebase default to couchtonight.app` (during Plan 05-06 wave; the plan-time intent was authored under 05-01).
- **`js/auth.js`** — New 145-line file (per `wc -l js/auth.js`) — provider-wrapper module with 9+ exported helpers: `bootstrapAuth` (resolves `getRedirectResult` before first render), `watchAuth` (subscribes `onAuthStateChanged`), `signInWithGoogle`, `signInWithApple` (Apple deferred to Phase 9 per scope-deviation but helper exported for forward-compat), `sendEmailLink`, `completeEmailLinkIfPresent`, `initPhoneCaptcha` (invisible reCAPTCHA), `resetPhoneCaptcha`, `sendPhoneCode`, `signOutUser`. Imports from `./firebase.js` + `./state.js` only (no circular dep with `./app.js`). Includes `stashNextForRedirect` helper for `?claim=` / `?invite=` deep-link preservation across redirect (RESEARCH.md §1 "Lost next param"). Note: file shipped via commit `f097673` `feat(05-06): Task 1 — sign-in screen DOM + CSS + provider handlers` during Wave 4 — the foundational module surface arrived alongside the sign-in UI rather than as a standalone Wave 1 artifact.
- **`js/state.js`** — Extended `state` object literal with new keys: `auth: null`, `actingAs: null`, `actingAsName: null`, `ownerUid: null`, `settings: null`, `unsubUserGroups: null`, `unsubSettings: null`, `unsubAuth: null`. The five locked ref-helpers (`membersRef`, `titlesRef`, `familyDocRef`, `vetoHistoryRef`, `vetoHistoryDoc`) preserved unchanged per Pitfall P2. File total still ≤15 lines.
- **`js/constants.js`** — 6 new exports appended: `CF_REGION = 'us-central1'`, `CF_BASE = 'https://us-central1-queuenight-84044.cloudfunctions.net'`, `CLAIM_TOKEN_TTL_MS = 30 days`, `GUEST_INVITE_TTL_MS = 7 days`, `GRACE_WINDOW_MS = 30 days`, `PASSWORD_ALGO_VERSION = 1`. Existing `TMDB_KEY` / `TRAKT_*` exports intact.

## Commits

Best-effort reconstruction from `git log` of the four files between 2026-04-19 and 2026-04-23:

- `1daae89` — `feat(03.5): extract firebase, constants, state, utils modules + wire app.js entry point` — the four-file module surface was originally extracted in Phase 3.5 (commit prior to Phase 5); Plan 05-01's intent was scoped against this baseline
- `f097673` — `feat(05-06): Task 1 — sign-in screen DOM + CSS + provider handlers` — `js/auth.js` shipped here (the 145-line provider-wrapper file)
- `c2c5af6` — `fix(05-06): flip authDomain from Firebase default to couchtonight.app` — the `authDomain` flip from 05-01-PLAN.md Task 1 step 2 actually shipped under Plan 05-06's wave
- `f6a2a76` — `feat(05-05): add writeAttribution() to js/utils.js + extend state.js auth keys` — the `state.js` auth-key extension from 05-01-PLAN.md Task 2 actually shipped under Plan 05-05's wave

**Note:** Per Pitfall 10 fallback — the **plan-time wave-1 scope of Plan 05-01 was redistributed across Plans 05-05 and 05-06 during execution.** The four-file module surface itself dates back to Phase 3.5 (commit `1daae89`). Production deploy is the canonical shipping surface (`couch-v35.1-security-hardening` live at `couchtonight.app`) — `auth` instance + `js/auth.js` + extended `state.auth*` keys + `js/constants.js` `CF_*` / TTL constants are all live in production code.

## Must-haves checklist

Copied from `05-01-PLAN.md` must_haves block:

- [x] `js/firebase.js` `authDomain` is `couchtonight.app` (verified at `js/firebase.js:14`)
- [x] `js/firebase.js` exports `auth` + all Firebase Auth SDK surfaces (verified at `js/firebase.js:24` + line 28 re-export — 16 Auth surfaces total)
- [x] `js/auth.js` exists and exports `bootstrapAuth`, `watchAuth`, `signInWithGoogle`, `signInWithApple`, `sendEmailLink`, `completeEmailLinkIfPresent`, `initPhoneCaptcha`, `sendPhoneCode`, `signOutUser` (verified — 9 of 9 named exports present plus `resetPhoneCaptcha` bonus)
- [x] `state` object has `auth`, `actingAs`, `actingAsName`, `ownerUid`, `settings`, `unsubUserGroups`, `unsubSettings` keys (verified — all 7 plus `unsubAuth` bonus per Plan 05-05 expansion)
- [x] `constants.js` exports `CF_REGION`, `CF_BASE`, `CLAIM_TOKEN_TTL_MS`, `GUEST_INVITE_TTL_MS`, `GRACE_WINDOW_MS`, `PASSWORD_ALGO_VERSION` (6 of 6 — all present)

All artifacts (path / provides / contains / min_lines) match per the plan's `artifacts:` block:
- `js/firebase.js` — Auth SDK import + auth instance — ✓ contains `firebase-auth.js` import URL
- `js/auth.js` — Provider sign-in helpers + bootstrap — ✓ 145 lines (≥120 minimum)
- `js/state.js` — Extended state surface for auth — ✓ contains `auth:` key
- `js/constants.js` — Auth/groups constants — ✓ contains `CF_REGION`

Key links: `js/auth.js` imports from `./firebase.js` ✓ (pattern `from './firebase.js'`).

## Smoke tests

Per `05-01-PLAN.md <verification>` block (all passing post-deploy):

- Sign-in screen renders without console errors (verified via 05-UAT-RESULTS.md provider table — Google/Email-link/Phone all PASS round-trip)
- Firebase Auth SDK initialized without console errors (DevTools console clean per 05-02-SUMMARY's "code-side SDK wiring (from 05-01)" reference)
- Anonymous fallback triggers via `signInAnonymously(auth)` at `js/app.js:3253` for invite-flow guest-browse path
- Module tree resolves clean — no 404s on `firebase-auth.js` / `firebase-functions.js` imports per 05-UAT.md test 8 evidence ("desktop Chrome Google sign-in already PASS per 05-UAT-RESULTS.md Task 1")

## What this enables

Wave 2+ of Phase 5 unlocked:

- **Plan 05-02** (sign-in providers + privacy/terms footer) — depends on `auth` instance + provider helpers
- **Plan 05-03** (auth Cloud Functions: `setGroupPassword`, `joinGroup`, `claimMember`, `mintClaimTokens`, `inviteGuest`, `transferOwnership`) — depends on `CF_REGION` + `httpsCallable` re-export
- **Plan 05-04** (auth-aware Firestore rules) — depends on `state.auth` slot for client-side gates that mirror server rules
- **Plan 05-05** (`writeAttribution` helper) — depends on `state.auth.uid` + `state.actingAs`
- **Plan 05-06** (sign-in screen + bootstrap dispatcher) — depends on `bootstrapAuth` + provider helpers
- **Plan 05-07** (sub-profiles + owner-admin) — depends on `state.actingAs` + `CF_*` constants
- **Plan 05-08** (claim-flow migration) — depends on `CLAIM_TOKEN_TTL_MS` + `GRACE_WINDOW_MS`
- **Plan 05-09** (iOS PWA UAT checkpoint) — verifies all of the above

Everything downstream of Phase 5 (Phases 6/7/8/9/11/13/14/15) consumes `state.auth.uid` for `writeAttribution` stamping and the `auth` instance for sign-in / sign-out / claim-flow paths.

## Follow-ups / known gaps

- **None for the foundational module surface** — 05-01 was infrastructure only; consumers in 05-02..09 took on UAT scope.
- **Multi-account runtime UAT for AUTH-05 deferred** per project pattern (see 05-VERIFICATION.md Human Verification Required + 05-UAT.md test deferrals) — not a 05-01 gap.
- **Wave-redistribution observation:** Plan 05-01's authored Wave 1 boundary was crossed during execution (the `js/auth.js` file shipped under 05-06's wave; the `state.auth*` keys shipped under 05-05's wave). This is a planning-vs-execution-wave drift, not a correctness gap — all four files are live in production with the right shape. Pure-docs Phase 15.2 records the drift here for audit-trail completeness.

## Reconstruction note

This SUMMARY was produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 05-01 shipped 2026-04-20..21 (v33.3 milestone audit identified this gap, audit YAML lines 103-113). Evidence sources:

- `05-01-PLAN.md` must_haves block + `<artifacts>` + `<key_links>` (the source-of-truth contract)
- `05-02-SUMMARY.md` cross-references ("code-side SDK wiring (from 05-01)")
- Live file inspection: `js/firebase.js` (30 lines, `authDomain: "couchtonight.app"` at line 14, `auth` instance at line 24); `js/auth.js` (145 lines, 9+ provider helpers); `js/state.js` (13 lines with all 8 auth keys); `js/constants.js` (794 lines including 6 new auth constants)
- `git log --oneline --all -- js/firebase.js js/auth.js js/state.js js/constants.js` for commit reconstruction
- Production-live Firebase Auth at `couchtonight.app` (per 05-UAT-RESULTS.md provider table — 4/4 enabled providers PASS)
- v33.3-MILESTONE-AUDIT.md YAML lines 103-113 (AUTH-01 evidence block)

The `requirements_completed: [AUTH-01]` frontmatter key is the canonical Phase-15.2 SUMMARY pattern — NOT `requirements_addressed` (Phase 14 drift) or tag-only (Phase 15 drift).
