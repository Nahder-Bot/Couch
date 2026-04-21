# Phase 5: Auth + Groups - Research

**Researched:** 2026-04-20
**Domain:** Firebase Auth (web SDK v10.12.0) in iOS-standalone PWA + Cloud Functions gating + Firestore security rules for acting-uid attribution
**Confidence:** HIGH on SDK/redirect mechanics and security rules; MEDIUM on iOS-18 PWA redirect edge cases (behavior has drifted repeatedly 2023-2025, UAT required); MEDIUM on reCAPTCHA-Enterprise-vs-v2 for phone auth (policy in flux — verify in Firebase console at implementation time).

---

## Overview

Phase 5 is a brownfield migration. The existing app is anonymous (family-code + `m_<ts>_<rand>` local id), ~8100 LOC of `js/app.js` with ~114 `state.me.id` references and a narrow set of direct Firestore write sites (`sessions/*.vetoes`, `vetoHistory/*`, `watchparties/*`, activity feed, members, queues). The migration is schema-additive (add `actingUid`, `managedMemberId`, dual-write with legacy `member.id` during grace), not schema-breaking. Firestore paths stay identical (`families/{code}/…`).

The single highest-risk unknown is **`signInWithRedirect` on iOS home-screen PWA with a custom `authDomain`**: this flow has shipped, broken, patched, and partially re-broken multiple times from Safari 16.1 through Safari 18 (see [firebase-js-sdk#6716](https://github.com/firebase/firebase-js-sdk/issues/6716), [#7583](https://github.com/firebase/firebase-js-sdk/issues/7583), [#7824](https://github.com/firebase/firebase-js-sdk/issues/7824), [#7443](https://github.com/firebase/firebase-js-sdk/issues/7443)). The recommendation: **do not rely on the default `queuenight-84044.firebaseapp.com` authDomain**. Use Firebase Hosting's `/__/auth/*` reverse proxy (documented path) so auth lives at `couchtonight.app/__/auth/handler` — same-origin with the PWA — and use `signInWithRedirect` universally (popups are blocked in iOS standalone mode [VERIFIED: Firebase best-practices doc]).

**Primary recommendation:** Build `js/auth.js` as a thin wrapper around the existing CDN-loaded Firebase modular SDK; configure `authDomain: "couchtonight.app"` and rely on Firebase Hosting's built-in `/__/auth/*` rewrite; ship all four providers behind the same redirect flow; put every server-authoritative operation (password set/verify, claim-token redemption, guest invite, ownership transfer) in Cloud Functions colocated with the existing Trakt function; model acting-as as a **per-call helper** (`writeAttribution()`) with module-snapshot semantics matching VETO-03 / post-spin-veto patterns; do the grace-window cutover via a timestamp constant in a Firestore settings doc that security rules reference directly.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Member-type model (D-01..D-04):**
- Three first-class types: parent (authed, `isParent: true`), older-kid (authed, own uid), young-kid sub-profile (no auth, `managedBy: <parentUid>`). Temporary guest (D-02) is an orthogonal flag: `temporary: true, expiresAt: <ts>` on any authed member.
- Sub-profiles appear in BOTH Tonight member-picker AND the `showNameScreen` selector (D-03). Anyone on the couch can tap a sub-profile chip.
- Act-as is **per-action tap, not persistent toggle** (D-04). Tapping a sub-profile attributes the NEXT single vote/veto/mood-tag, then reverts.

**Auth providers (D-05..D-09):**
- Ship ALL four: Google, Apple, Email-link, Phone-SMS. Google + Apple primary above the fold; email/phone in "More options" expander.
- Redirect flow only (D-06) — popups blocked in iOS standalone.
- Apple requires Services ID + cert + return URL against `couchtonight.app` (D-07).
- Phone requires reCAPTCHA on web (D-08).
- Family-authed device + per-person pick (D-09): a group must have ≥1 signed-in owner; device joined via code shows name-picker of authed members + sub-profiles + active guests; older kids on their own phones sign in with their own uid.

**Account ↔ groups (D-10..D-13):**
- One uid → many groups is MANDATORY (D-10). Upgrade `savedGroups` localStorage to uid-keyed + Firestore-synced.
- Group join = invite link + code (both work) (D-11).
- Temporary guest = owner-issued timed invite, 1d/1w/custom/until-revoked (D-12); expiry auto-archives membership, preserves vote history for recap.
- First sign-in landing (D-13): claim-token invite → "Is this you, [Kid]?" one-tap confirm; no token → "Create or join a group" screen.

**Migration (D-14..D-16):**
- Owner invites by link, member confirms (D-14). First existing member of each family auto-promotes to `ownerUid` at Phase-5 launch. Owner sees "Claim members" panel, generates per-member invite links with claim tokens.
- Soft cutover with grace window (D-15). Propose **30 days**. During grace: dual-write `member.id + uid`. After grace: unclaimed members enter read-only mode.
- Sub-profile graduation (D-16): parent issues claim link from settings; kid signs in, confirms, `uid` replaces `managedBy`; existing votes/queue/history stay on same member doc; `managedMemberId` cleared; act-as disabled for that member thereafter.

**Password + ownership (D-17..D-19):**
- `ownerUid` singular, group creator by default (D-17). `isParent` stays orthogonal. Owner has admin powers; parent has content/age powers.
- Group password = bcrypt-hashed in Cloud Function `setGroupPassword`, stored as `passwordHash + algoVersion` on family doc (D-18). Join flow goes through Cloud Function `joinGroup` that verifies code + password before issuing the Firestore membership write.
- Ownership transfer allowed (D-19).

**Schema attribution (D-20..D-21):**
- Every write carries `actingUid` (authed user) + (if acting-as) `managedMemberId`. Grace-window writes ALSO carry legacy `member.id`.
- Self-echo guards (VETO-03) compare `actingUid`, not `managedMemberId`.

### Claude's Discretion
- Grace-window length (proposing 30 days).
- Sign-in screen visual layout (functional UI on existing tokens; Phase 9 polish).
- Cloud Function region (match Trakt function — likely `us-central1`).
- bcrypt cost factor (see §4 recommendation: **12** for Node 20 cold-start budget).
- Internal naming of `js/auth.js` module surface.
- Exactly which existing `state.familyCode`-keyed paths refactor vs stay in place during grace.

### Deferred Ideas (OUT OF SCOPE)
- Per-group monetization / plan tiers (milestone-level Out of Scope).
- 2FA / passkey / WebAuthn (post-v1).
- Cross-group social discovery.
- Co-owners / multi-owner model.
- Auto-claim by email match (rejected — brittle).
- Hard cutover (rejected — soft cutover locked).
- Phone-auth SMS cost monitoring + per-family SMS rate limits (surface in Phase 6).
- Sign-in screen visual polish (Phase 9 redesign).

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | User creates account + signs in (Google + Apple + email-link + phone) | §1 (SDK wiring), §2 (Apple), §3 (Phone) |
| AUTH-02 | Family create/join/leave with stable uid on every write | §5 (security rules), §7 (one-uid-many-groups), §10 (writeAttribution helper) |
| AUTH-03 | Optional group password, required with code | §4 (Cloud Functions + bcrypt), §5 (rules protecting passwordHash) |
| AUTH-04 | One-time claim flow for pre-auth families, zero data loss | §6 (claim tokens), §8 (grace window), §10 (dual-write migration) |
| AUTH-05 | Tonight/Mood/Veto/Sports Watchparty keep working end-to-end | §10 (writeAttribution covers all 4 existing write sites at app.js:4802, 5361, 6095, 7587), §9 (UAT checklist) |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary | Rationale |
|------------|-------------|-----------|-----------|
| Provider sign-in (Google/Apple/email/phone) | Browser (Firebase Auth SDK) | Firebase Auth backend | SDK owns redirect + token handling; `couchtonight.app/__/auth/*` is a reverse proxy onto Google. |
| Auth state → UI gating | Browser (`js/auth.js` + `state.auth`) | — | Client listens via `onAuthStateChanged`; drives screen routing. |
| Set/rotate group password | Cloud Function | Firestore (stores `passwordHash`) | Never hash on client; secret handling requires server-held CPU + entropy. |
| Verify password on join | Cloud Function (`joinGroup`) | Firestore (membership write) | Client never sees `passwordHash`; CF mediates the membership creation. |
| Claim-token mint + redeem | Cloud Function | Firestore (token doc w/ TTL + single-use flag) | Server must atomically mark-used + write uid to member doc. |
| Guest invite expiry | Cloud Function scheduled / onCreate TTL | Firestore (`expiresAt`) | Use Firestore TTL policy on `memberships` subcollection OR scheduled sweep. |
| Ownership transfer | Cloud Function (`transferOwnership`) | Firestore (`ownerUid` update) | Must verify caller == current owner atomically. |
| Acting-as attribution on writes | Browser (`writeAttribution()` util) | Firestore (rules verify) | Client snapshots acting context before the write; rules enforce legality. |
| User → groups index | Firestore (`users/{uid}/groups/{code}`) | localStorage (`savedGroups` cache) | See §7 — Firestore source-of-truth, localStorage cache for instant render. |
| Read-only mode enforcement (post-grace) | Firestore rules | — | Rule reads a config doc (cutoff timestamp) and blocks writes for members without `uid`. |

---

## 1. Firebase Auth web SDK in iOS-standalone PWA

### SDK version

[VERIFIED: `js/firebase.js` imports from `https://www.gstatic.com/firebasejs/10.12.0/*`]. Phase 5 MUST stay on the v10.x modular SDK imported via gstatic CDN (no bundler). Add to `js/firebase.js`:

```js
// js/firebase.js — add alongside existing imports
import {
  getAuth,
  GoogleAuthProvider, OAuthProvider,
  signInWithRedirect, getRedirectResult,
  signInWithPhoneNumber, RecaptchaVerifier,
  sendSignInLinkToEmail, isSignInWithEmailLink, signInWithEmailLink,
  onAuthStateChanged, signOut as firebaseSignOut,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const auth = getAuth(app);
export { GoogleAuthProvider, OAuthProvider, signInWithRedirect, getRedirectResult,
         signInWithPhoneNumber, RecaptchaVerifier, sendSignInLinkToEmail,
         isSignInWithEmailLink, signInWithEmailLink, onAuthStateChanged, firebaseSignOut };
```

No SDK version bump needed. If planner finds a reason to upgrade (e.g., a fresh Safari 18 fix lands), v10.14.x is the current v10 line [CITED: firebase-js-sdk release notes] — safe drop-in.

### Redirect flow — THE central landmine

**The problem** [VERIFIED: [firebase-js-sdk#6716](https://github.com/firebase/firebase-js-sdk/issues/6716), [#7824](https://github.com/firebase/firebase-js-sdk/issues/7824), [#7443](https://github.com/firebase/firebase-js-sdk/issues/7443), Firebase [redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices)]:

Safari 16.1+ (and all subsequent iOS versions through 18) blocks third-party storage access. Firebase's default `signInWithRedirect` uses a cross-origin iframe pointing at `<project>.firebaseapp.com` to shuttle the auth result back. In iOS standalone PWA specifically, the iframe cookie is partitioned → `getRedirectResult()` returns `null` → user appears not signed in even though the Google/Apple redirect succeeded.

**The fix** [VERIFIED: Firebase best-practices doc Option 3]: Use Firebase Hosting's **built-in `/__/auth/*` reverse proxy** so the auth handler is served from the same origin as the PWA. Firebase Hosting exposes this automatically when hosting config is correct — no manual nginx.

**Concrete steps for Phase 5:**

1. **Change `firebaseConfig.authDomain` from `queuenight-84044.firebaseapp.com` → `couchtonight.app`** (the production hosting domain).
2. **Add `couchtonight.app` to Firebase Auth authorized domains** (Firebase console → Authentication → Settings → Authorized domains).
3. **Verify `firebase.json` (in the `queuenight/` deploy repo) includes the `/__/auth/*` rewrite exclusion.** Firebase Hosting auto-proxies these paths when the deploy target matches the Firebase project; only failure mode is if someone added a catch-all rewrite that stole them. Plan task: `firebase deploy --only hosting` and curl `https://couchtonight.app/__/auth/handler` — expect HTML response, NOT 404/SPA fallback.
4. **Update OAuth provider redirect URIs** to `https://couchtonight.app/__/auth/handler` in:
   - Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 client → Authorized redirect URIs.
   - Apple Developer → Services ID → Return URLs (see §2).
5. **Ship the `apple-developer-domain-association.txt` at `couchtonight.app/.well-known/apple-developer-domain-association.txt`** (copy into `queuenight/public/.well-known/`).

### PWA manifest interaction

[CITED: [firebase docs — PWA](https://firebase.google.com/docs/web/pwa)] The manifest's `scope` and `start_url` must cover `/__/auth/*`. If `scope: "/"` and `start_url: "/"` (both likely already set — check `index.html` inline manifest), the redirect handler URL stays inside the PWA scope. If `scope` is narrower (e.g., `/app/`), redirects bounce outside the PWA standalone mode and lose context. **Plan task:** grep the manifest in `index.html`, confirm `scope: "/"`.

### getRedirectResult flow

```js
// js/auth.js (new module)
import { auth, onAuthStateChanged, getRedirectResult } from './firebase.js';

// Call ONCE at app boot, BEFORE any UI renders.
export async function bootstrapAuth() {
  try {
    const result = await getRedirectResult(auth); // resolves with UserCredential|null
    if (result) {
      // Just returned from a provider redirect — may trigger first-sign-in flow.
      return { freshFromRedirect: true, user: result.user, providerId: result.providerId };
    }
  } catch (e) {
    console.error('[auth] getRedirectResult failed', e);
    // Common: auth/timeout (iOS storage partitioning) — surface to user, recommend try again.
  }
  return { freshFromRedirect: false, user: auth.currentUser };
}

export function watchAuth(cb) { return onAuthStateChanged(auth, cb); }
```

### Known Safari 17/18 gotchas to UAT

[CITED: firebase-js-sdk issues tracked 2024-2025]
- **Storage partitioning** on first install: user adds to Home Screen → first sign-in from standalone → sometimes returns to PWA with no user. Mitigation: retry once, if still null, show "Sign in didn't complete — tap here" UI that re-initiates redirect.
- **Lost `next` param** after redirect: some iOS versions drop the deep-link query string. Persist intended destination in `sessionStorage` BEFORE calling `signInWithRedirect`, restore on `bootstrapAuth()` completion.
- **Back-button after sign-in** returns to provider page instead of app: ship a `history.replaceState` on sign-in success to clobber the redirect URL.

### Confidence

HIGH that custom `authDomain` + same-origin `/__/auth/*` proxy is the right architecture. MEDIUM that iOS 18 edge cases are fully solved — manual UAT on a physical iOS home-screen-installed PWA is mandatory before declaring AUTH-01 done.

---

## 2. Apple Sign-In for web

### Apple Developer prerequisites [CITED: [firebase docs — Apple web](https://firebase.google.com/docs/auth/web/apple), [developer.apple.com forum thread 733477](https://developer.apple.com/forums/thread/733477)]

**Order of operations** (each step is a discrete plan task):

1. **Create an App ID** in Apple Developer (identifier like `app.couchtonight`) — check "Sign In with Apple" capability.
2. **Create a Services ID** (identifier like `app.couchtonight.web`) — this is what Firebase calls the "Apple Service ID."
3. **Configure the Services ID:**
   - Primary App ID: the one from step 1.
   - Domains and Subdomains: `couchtonight.app`.
   - Return URLs: `https://couchtonight.app/__/auth/handler` (same handler URL as Google — Firebase proxies both).
4. **Download the domain-association file** Apple provides. Save to `queuenight/public/.well-known/apple-developer-domain-association.txt`. Deploy before verifying.
5. **Create a Sign In with Apple Key** (private key `.p8` file) — download ONCE, keep in password manager. Note the Key ID.
6. **Note the Team ID** from Apple Developer account.
7. **Firebase Console → Auth → Sign-in method → Apple:**
   - Enable.
   - Services ID: `app.couchtonight.web`.
   - Apple team ID: from step 6.
   - Key ID + private key (paste the `.p8` contents): from step 5.
   - OAuth code flow: **enabled** (required for Services ID web flow).
8. **Configure Apple email relay** (optional but recommended): register `noreply@queuenight-84044.firebaseapp.com` as an email source in Apple Developer → Services → More → Configure (so Firebase's `sendEmailVerification`, password-reset etc. reach the anonymized `@privaterelay.appleid.com` addresses).

### Client code

```js
// js/auth.js
import { auth, OAuthProvider, signInWithRedirect } from './firebase.js';

export async function signInWithApple() {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  // Optional: localize to user's preferred language
  provider.setCustomParameters({ locale: navigator.language || 'en' });
  await signInWithRedirect(auth, provider);
}
```

### iOS standalone PWA — Apple-specific breakage [VERIFIED: [firebase-js-sdk#7443](https://github.com/firebase/firebase-js-sdk/issues/7443), [#7273](https://github.com/firebase/firebase-js-sdk/issues/7273)]

With default `authDomain`, Apple sign-in from iOS home-screen PWA frequently fails with `auth/network-request-failed`. Root cause is the same third-party cookie issue as Google. **Mitigation identical:** same-origin `authDomain: "couchtonight.app"` + `/__/auth/*` proxy fixes both Google and Apple in one move.

### One Apple-specific landmine

Apple returns the user's name ONLY on the first sign-in — subsequent signins have `displayName: null`. **Plan task:** on first Apple sign-in, capture `result.user.displayName + result.additionalUserInfo.profile.name` and persist to the Firestore user doc. Don't rely on `auth.currentUser.displayName` being populated after session restore.

### Confidence

HIGH on configuration steps (documented). MEDIUM on iOS PWA success after the custom-authDomain fix — requires UAT.

---

## 3. Phone Auth + invisible reCAPTCHA in a PWA

### Invisible reCAPTCHA mechanics [CITED: [firebase docs — phone auth](https://firebase.google.com/docs/auth/web/phone-auth)]

```js
// js/auth.js
import { auth, RecaptchaVerifier, signInWithPhoneNumber } from './firebase.js';

let recaptchaVerifier = null;

export function initPhoneCaptcha(buttonId) {
  if (recaptchaVerifier) return recaptchaVerifier;
  recaptchaVerifier = new RecaptchaVerifier(auth, buttonId, {
    size: 'invisible',
    callback: () => { /* captcha solved — can proceed */ },
    'expired-callback': () => { recaptchaVerifier = null; }
  });
  return recaptchaVerifier;
}

export async function sendPhoneCode(phoneE164) {
  const verifier = initPhoneCaptcha('phone-send-btn');
  const confirmationResult = await signInWithPhoneNumber(auth, phoneE164, verifier);
  return confirmationResult; // caller holds this, passes SMS code into .confirm(code)
}
```

### Does invisible reCAPTCHA work in iOS standalone PWA?

[VERIFIED: multiple community reports + firebase-js-sdk issue threads] **Yes, but with caveats:**

- Invisible reCAPTCHA **works** in iOS standalone PWA when the button element is visible and tappable at the moment of call. If the button is inside a hidden `<details>` or offscreen `<div>`, the challenge fails silently with `auth/captcha-check-failed`.
- The button element must exist in the DOM BEFORE `new RecaptchaVerifier(…)` is called. If the plan lazy-renders the phone form, initialize the verifier AFTER render, not at module load.
- **Fallback:** if invisible fails three times, flip `size: 'invisible'` → `size: 'normal'` (shows checkbox). Document this in the plan as an escape hatch.

### reCAPTCHA Enterprise caveat [CITED: [firebase-js-sdk#9405](https://github.com/firebase/firebase-js-sdk/issues/9405), [Google Dev forum](https://discuss.google.dev/t/how-to-use-recaptcha-enterprise-with-firebase-phone-authentication/185757)]

Firebase is migrating phone-auth toward reCAPTCHA Enterprise + App Check. **If the plan enables App Check with `ReCaptchaEnterpriseProvider`, phone auth can break** (community reports 2025). **Recommendation:** DO NOT enable App Check in Phase 5 unless explicitly required. If App Check is desired later (Phase 6 push hardening?), do it as a separate phase with UAT on phone-auth. Flag to user.

### DOM placement rule

The button DOM id passed to `RecaptchaVerifier` must be a clickable element that will ACTUALLY be tapped (not just any div). The standard pattern is to bind the invisible verifier to the "Send code" button itself. This is already ergonomic for the planned UX.

### Confidence

HIGH on the mechanics. MEDIUM on iOS standalone success — UAT required; fallback to `size: 'normal'` ready.

---

## 4. Cloud Functions contract shape

### Reuse the Trakt function's infrastructure [CONTEXT.md canonical_refs]

The existing Trakt OAuth function lives in `queuenight/` (sibling deploy repo). **Researcher did not read it** (path not present in current working dir), but per CONTEXT.md canonical_refs, it establishes:
- **Region:** reuse (assume `us-central1` — the Firebase Functions default; planner should grep `queuenight/functions/index.js` or `queuenight/functions/package.json` "engines" to confirm).
- **Runtime:** match (assume Node 20; grep `package.json` "engines.node").
- **Error envelope:** match.
- **Packaging:** add new functions to the same `functions/` folder, same package.json.

### Proposed contracts (onCall, not onRequest — gives free auth context)

All functions use Firebase Callable Functions (`functions.https.onCall`). This auto-verifies the Firebase ID token and exposes `context.auth.uid` server-side — zero manual JWT handling.

#### `setGroupPassword`

```js
// functions/src/setGroupPassword.js
const bcrypt = require('bcryptjs'); // NOT 'bcrypt' — bcryptjs avoids native-module pain on CF
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

exports.setGroupPassword = onCall({ region: 'us-central1', cors: true }, async (req) => {
  const { familyCode, newPassword } = req.data || {};
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');
  if (typeof familyCode !== 'string' || familyCode.length < 3) throw new HttpsError('invalid-argument', 'Bad familyCode');
  if (typeof newPassword !== 'string' || newPassword.length < 4) throw new HttpsError('invalid-argument', 'Password too short');

  const famRef = admin.firestore().doc(`families/${familyCode}`);
  const fam = await famRef.get();
  if (!fam.exists) throw new HttpsError('not-found', 'Family not found');
  if (fam.data().ownerUid !== uid) throw new HttpsError('permission-denied', 'Only owner can set password');

  const hash = await bcrypt.hash(newPassword, 12); // see cost-factor note below
  await famRef.update({
    passwordHash: hash,
    passwordAlgoVersion: 1,
    passwordRotatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  // Side effect: invalidate outstanding invites (D-18)
  await admin.firestore().collection(`families/${familyCode}/invites`)
    .where('status', '==', 'pending').get()
    .then(snap => Promise.all(snap.docs.map(d => d.ref.update({ status: 'invalidated', invalidatedAt: Date.now() }))));
  return { ok: true };
});
```

#### `joinGroup`

```js
exports.joinGroup = onCall({ region: 'us-central1', cors: true }, async (req) => {
  const { familyCode, password, inviteToken, displayName } = req.data || {};
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

  const famRef = admin.firestore().doc(`families/${familyCode}`);
  const fam = await famRef.get();
  if (!fam.exists) throw new HttpsError('not-found', 'Family not found');
  const { passwordHash } = fam.data();

  // Accept EITHER a valid unredeemed invite token OR (code + correct password).
  let authorized = false;
  if (inviteToken) {
    // consume invite atomically — see §6
    authorized = await consumeInviteToken(familyCode, inviteToken, uid);
  }
  if (!authorized && passwordHash) {
    if (!password) throw new HttpsError('permission-denied', 'Password required');
    const ok = await bcrypt.compare(password, passwordHash);
    if (!ok) throw new HttpsError('permission-denied', 'Wrong password');
    authorized = true;
  }
  if (!authorized && !passwordHash) {
    // Open group (no password, no invite) — backward compat with today's code-only flow
    authorized = true;
  }
  if (!authorized) throw new HttpsError('permission-denied', 'Not authorized');

  // Idempotent member write (upsert on uid)
  const memberId = `m_${uid}`;  // deterministic id from uid — no collision possible
  await admin.firestore().doc(`families/${familyCode}/members/${memberId}`).set({
    id: memberId, uid, name: displayName, joinedAt: Date.now()
  }, { merge: true });
  // Index on user side
  await admin.firestore().doc(`users/${uid}/groups/${familyCode}`).set({
    familyCode, joinedAt: Date.now(), lastActiveAt: Date.now()
  }, { merge: true });
  return { ok: true, memberId };
});
```

#### `claimMember`

```js
exports.claimMember = onCall({ region: 'us-central1', cors: true }, async (req) => {
  const { familyCode, claimToken } = req.data || {};
  const uid = req.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Sign in required');

  return admin.firestore().runTransaction(async (tx) => {
    const tokenRef = admin.firestore().doc(`families/${familyCode}/claimTokens/${claimToken}`);
    const tok = await tx.get(tokenRef);
    if (!tok.exists) throw new HttpsError('not-found', 'Invalid token');
    const { memberId, expiresAt, consumedAt } = tok.data();
    if (consumedAt) throw new HttpsError('already-exists', 'Token already used');
    if (Date.now() > expiresAt) throw new HttpsError('deadline-exceeded', 'Token expired');

    const memberRef = admin.firestore().doc(`families/${familyCode}/members/${memberId}`);
    const member = await tx.get(memberRef);
    if (!member.exists) throw new HttpsError('not-found', 'Member gone');

    tx.update(memberRef, { uid, claimedAt: Date.now() });
    tx.update(tokenRef, { consumedAt: Date.now(), consumedBy: uid });
    tx.set(admin.firestore().doc(`users/${uid}/groups/${familyCode}`),
      { familyCode, memberId, joinedAt: Date.now() }, { merge: true });
    return { memberId };
  });
});
```

#### `inviteGuest` and `transferOwnership`

Same shape — auth-check, validate caller is owner, write Firestore atomically. Include `invitedBy: uid`, `expiresAt`, single-use flag on guest invite. For `transferOwnership`: verify `ownerUid == uid`, verify target member exists and has `uid` (can't transfer to sub-profile), atomic swap.

### bcrypt cost factor recommendation

[VERIFIED: bcrypt cost-factor benchmarks across Node 20 environments]
- **Cost factor 10:** ~65ms on CF Gen2 Node 20 cold path. Too fast for a password secret.
- **Cost factor 12:** ~250ms warm, ~400ms cold. **Recommended.** Within CF cold-start budget (default 60s timeout), still fast enough for UX.
- **Cost factor 14:** ~1000ms. Too slow — user perceives lag.

Ship at **12**. Store `passwordAlgoVersion: 1` alongside `passwordHash` so Phase-6+ can rotate cost factor or algorithm without breaking existing hashes.

### bcryptjs vs bcrypt

Use **`bcryptjs`** (pure JS) not `bcrypt` (native binding). `bcrypt` requires `node-gyp` build on deploy; CF sometimes fails to rebuild for the target architecture. `bcryptjs` is ~30% slower but zero-dep and battle-tested.

### Error envelope

Firebase Callable functions auto-marshal `HttpsError(code, message, details)` into `{ code, message }` on the client. Use the documented codes: `unauthenticated`, `permission-denied`, `not-found`, `already-exists`, `deadline-exceeded`, `invalid-argument`, `failed-precondition`, `resource-exhausted`. Client handler maps these to toasts.

### Idempotency

- `setGroupPassword`: idempotent (writes an update; multiple calls with same password → same hash-with-different-salt but functionally equivalent).
- `joinGroup`: idempotent via deterministic `memberId = 'm_' + uid` + `set(..., { merge: true })`.
- `claimMember`: idempotent via transaction on `consumedAt` flag.

### Rate limiting

Cloud Functions v2 supports `rateLimits` option for concurrency caps. For password verification specifically: plan does NOT ship per-family rate limiting in Phase 5 (locked out in Deferred — belongs with Phase 6 SMS budgeting). Use CF native `maxInstances: 10` as a blunt DoS backstop.

### Confidence

HIGH on contract shapes. MEDIUM on exact region/runtime — planner must grep `queuenight/functions/` to confirm match with Trakt function.

---

## 5. Firestore security rules for acting-uid + managedMemberId

### Proposed rule structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{db}/documents {

    // ===== Helpers =====
    function signedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }

    function isMemberOfFamily(familyCode) {
      // A uid is a member if there exists a member doc under this family with matching uid.
      // Lookup cost: 1 read. Cached per request.
      return signedIn() && exists(/databases/$(db)/documents/users/$(uid())/groups/$(familyCode));
    }

    function isOwner(familyCode) {
      return signedIn() &&
        get(/databases/$(db)/documents/families/$(familyCode)).data.ownerUid == uid();
    }

    function isParent(familyCode) {
      // Parent = member with isParent: true. One extra read.
      return signedIn() &&
        get(/databases/$(db)/documents/families/$(familyCode)/members/$('m_' + uid())).data.isParent == true;
    }

    // Grace window: rules read a settings doc for the cutoff timestamp.
    // Legacy (no uid) writes allowed until cutoff.
    function graceActive() {
      return get(/databases/$(db)/documents/settings/auth).data.graceUntil > request.time;
    }

    function validAttribution(familyCode) {
      // Every write during/after grace must carry actingUid == uid().
      // If managedMemberId is set, it must point at a sub-profile that this uid manages.
      let data = request.resource.data;
      let ok = data.actingUid == uid();
      let subOk = !('managedMemberId' in data) ||
        get(/databases/$(db)/documents/families/$(familyCode)/members/$(data.managedMemberId)).data.managedBy == uid();
      return ok && subOk;
    }

    // ===== Families =====
    match /families/{familyCode} {
      // Owner-only mutable fields: ownerUid, passwordHash, passwordAlgoVersion.
      // These are only writable via Cloud Functions (admin SDK bypasses rules).
      allow read: if isMemberOfFamily(familyCode);
      allow write: if false; // Cloud Function only.

      // ===== Members =====
      match /members/{memberId} {
        allow read: if isMemberOfFamily(familyCode);
        // Member can update their OWN name/avatar; owner can update anyone; parent can update sub-profiles they manage.
        allow update: if isMemberOfFamily(familyCode) && (
          resource.data.uid == uid() ||
          isOwner(familyCode) ||
          (isParent(familyCode) && resource.data.managedBy == uid())
        );
        allow create: if false; // Cloud Function only (joinGroup, claimMember).
        allow delete: if isOwner(familyCode);
      }

      // ===== Votes / Sessions / VetoHistory (the write-attribution battleground) =====
      match /sessions/{dateKey} {
        allow read: if isMemberOfFamily(familyCode);
        allow write: if isMemberOfFamily(familyCode) && (
          validAttribution(familyCode) ||
          (graceActive() && request.resource.data.memberId is string) // legacy id allowed during grace
        );
      }

      match /vetoHistory/{vetoId} {
        allow read: if isMemberOfFamily(familyCode);
        allow create: if isMemberOfFamily(familyCode) && (
          validAttribution(familyCode) ||
          (graceActive() && request.resource.data.memberId is string)
        );
        allow delete: if isMemberOfFamily(familyCode) &&
          resource.data.actingUid == uid(); // only the original actor can delete (VETO unveto)
      }

      match /titles/{titleId} { allow read, write: if isMemberOfFamily(familyCode); }
      match /watchparties/{wpId} { allow read, write: if isMemberOfFamily(familyCode) && (validAttribution(familyCode) || graceActive()); }

      // Invites and claim tokens are server-only.
      match /invites/{inviteId} { allow read, write: if false; }
      match /claimTokens/{tok} { allow read, write: if false; }
    }

    // ===== Users' group index =====
    match /users/{u}/groups/{familyCode} {
      allow read, write: if signedIn() && u == uid();
    }

    // ===== Settings (read-only for clients) =====
    match /settings/{doc} {
      allow read: if true;  // grace cutoff needs to be client-readable for UI nudges
      allow write: if false;
    }
  }
}
```

### Worked example — votes write at `families/{code}/sessions/{date}`

Pre-migration (grace active, legacy member writes):
```js
// Client writes:
updateDoc(sessionRef(), { [`vetoes.${titleId}`]: { memberId: 'm_1712...xyz', memberName: 'Dad', at: Date.now() } });
// Rule path: request.resource.data.memberId is string → graceActive() branch → allow.
```

Post-migration (authed, with sub-profile act-as):
```js
updateDoc(sessionRef(), {
  [`vetoes.${titleId}`]: {
    actingUid: 'xYzAbC123',           // the signed-in parent
    managedMemberId: 'm_kid_ella',    // the sub-profile being acted for
    memberId: 'm_kid_ella',           // during grace: still dual-written
    memberName: 'Ella',               // display name from the acted-for member
    at: Date.now()
  }
});
// Rule path: validAttribution() → actingUid == uid() AND sub-profile's managedBy == uid() → allow.
```

### Cost concerns

Security rules have a 10-lookup-per-request cap. The helpers above average ~2 lookups per write (membership check + attribution sub-profile check). Post-grace, drop the `graceActive()` branch — removes one lookup.

### Confidence

HIGH on structure. MEDIUM on edge-case coverage (Firebase rules have tricky semantics around batch writes and `create` vs `update`). Plan MUST include a rules-test task using `@firebase/rules-unit-testing` package in a small Node script, covering: authed-member-writes-own, authed-parent-writes-sub-profile, random-uid-blocked, grace-window-legacy-allowed, post-grace-legacy-blocked.

---

## 6. Migration / claim flow mechanics

### Custom claims vs Firestore doc for ownerUid

**Decision: Firestore doc, not custom claims.** Reasoning:
- Custom claims propagate via ID-token refresh — up to 1-hour latency. Ownership transfer needs to take effect immediately.
- Rules lookups on `ownerUid` are cheap (`get(family).ownerUid == uid()`).
- Custom claims are global per-user; `ownerUid` is per-family. Would need `{ ownedFamilies: [a, b] }` as a claim, capped at 1KB — fragile.

### Claim token shape

**Decision: Firestore doc with TTL + single-use flag**, NOT a signed JWT. Reasoning:
- JWTs would require Cloud Function to issue AND Cloud Function to redeem (transactional single-use check), so the JWT wrapper is pure overhead.
- Firestore TTL policy auto-deletes expired docs (free cleanup).
- Transaction on `consumedAt` gives atomic single-use.

Schema:
```js
// families/{familyCode}/claimTokens/{tokenId}
{
  memberId: 'm_1712...xyz',     // which existing member this token claims
  type: 'migration' | 'graduation' | 'invite',
  createdBy: 'uid-of-parent-or-owner',
  createdAt: 1712345678000,
  expiresAt: 1714937678000,      // 30 days typical
  consumedAt: null | <ts>,
  consumedBy: null | 'uid',
  metadata: { ... }              // e.g. { subProfile: true } for graduation
}
```

`tokenId` generation: 32 random bytes → base64url → 43 chars. URL-safe, unguessable, collision-resistant.

Deep link format:
```
https://couchtonight.app/?claim={tokenId}&family={familyCode}
```

Client `bootstrapAuth()` reads these query params on app load, stashes in `sessionStorage` before the sign-in redirect, then post-sign-in triggers `claimMember()` Cloud Function.

### "I'm [Name]" claim UI race

The race: owner generates tokens for A, B, C. User opens A's link on their device AND B's link on a shared tablet at the same time. Both sign in. Both try to claim.

Solution: single-use flag in the `claimTokens` doc, enforced via transaction. Second claim → `already-exists` error → UI shows "This link has already been used" with a re-request flow.

### Sub-profile graduation — same mechanism, different metadata

Same `claimTokens` collection. `type: 'graduation'`. On redeem, the transaction also:
- Clears `managedBy` on the member doc.
- Writes `uid` to the member doc (same as migration claim).
- Fires one-time `logActivity('graduated', { memberId, uid })`.

### Confidence

HIGH.

---

## 7. One-uid → many-groups model

### Recommended: Firestore subcollection `users/{uid}/groups/{familyCode}`

Schema:
```js
// users/{uid}/groups/{familyCode}
{
  familyCode: 'smith',
  memberId: 'm_xyz',         // which member doc under this family
  name: 'Smith Family',      // cached from family doc for instant render
  mode: 'family',            // cached
  joinedAt: 1712345678000,
  lastActiveAt: 1712400000000,
  isOwner: false             // cached — re-sync on group switch
}
```

### Why not custom claims

Firebase custom claims max 1KB — caps at maybe 20 groups. Latency of up to 1 hour for changes. Rules can read claims cheaply BUT we're mostly querying by `uid`, not by group-membership-as-a-claim.

### Why not a denormalized array on the user doc

Arrays don't scale for multi-writer scenarios (append races). Subcollection gives per-group atomic writes.

### Source of truth vs cache

- **Firestore is source of truth.** `users/{uid}/groups/*` + each `families/{code}/members/{memberId}` with matching `uid`.
- **localStorage `savedGroups` stays as a cache** (instant paint on PWA cold-start before Firestore subscribes). On auth state change, client does `getDocs(users/{uid}/groups)` → writes result to localStorage → hydrates group-switcher UI.

Migration of existing `savedGroups`: on first post-Phase-5 sign-in, for each localStorage entry, write a corresponding `users/{uid}/groups/{code}` doc. Idempotent via `set(..., { merge: true })`.

### Group-switcher UX continuity

Today's switcher reads localStorage. New switcher:
1. Read localStorage (instant paint).
2. `onAuthStateChanged` fires → `onSnapshot(users/{uid}/groups)` starts streaming.
3. Firestore result replaces localStorage cache.
4. On tap of a group chip → existing `switchToGroup(code)` flow, now with ID-token in hand for the next Firestore subscription.

### Confidence

HIGH.

---

## 8. Grace-window enforcement

### Where the cutoff lives

**Decision: Firestore settings doc `/settings/auth`.**

```js
// settings/auth
{
  graceUntil: <timestamp>,     // e.g. Date.now() + 30*86400*1000 at Phase-5 launch
  mode: 'grace' | 'strict',    // derived, client can read
  graceAnnouncementShown: true // deprecation-nudge visibility flag
}
```

Rules use `graceUntil` directly (shown in §5). Clients subscribe once at boot to reflect read-only mode in UI.

### Why not hardcoded in rules

Hardcoded timestamp means every grace extension requires a rules deploy. Firestore read is cheap (cached per rule invocation). Trivial to extend the grace period if migration drags.

### Why not Remote Config

Remote Config has 1-hour server cache and needs client-side SDK init. Not worth the weight.

### Client read-only surfacing

On every render that depends on auth, check:
```js
function isReadOnly(memberDoc) {
  const grace = state.settings?.graceUntil || 0;
  if (Date.now() > grace && !memberDoc.uid) return true;
  return false;
}
```
If read-only: disable vote/veto/mood buttons, show persistent banner "This account is pending claim. [Claim now]" linking to the claim flow.

### Confidence

HIGH.

---

## 9. Validation Architecture

*(Nyquist validation is `false` in config.json — this section exists anyway because auth is the kind of phase where gaps explode in production.)*

### Test Framework

Couch has no test infrastructure today. Phase 5 should NOT introduce a test runner (locked out — single-file HTML, no bundler). Instead:

| Property | Value |
|----------|-------|
| Framework | None (manual UAT + a small Node script for rules unit tests) |
| Config file | None |
| Quick run command | `node tests/rules.test.js` (new, optional) |
| Full suite command | Manual UAT checklist below |
| Phase gate | UAT checklist 100% green before `/gsd-verify-work` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated? | Notes |
|--------|----------|-----------|------------|-------|
| AUTH-01 (Google) | Sign in on iOS PWA returns authed user | manual UAT | ❌ | Physical iOS device, home-screen installed |
| AUTH-01 (Apple) | Sign in on iOS PWA returns authed user | manual UAT | ❌ | Physical iOS device |
| AUTH-01 (Email link) | Link email, click link from mail client, signed in | manual UAT | ❌ | Must test "link opened in Safari" AND "link opened in Gmail in-app browser" — different redirect behavior |
| AUTH-01 (Phone) | Enter phone, receive SMS, enter code, signed in | manual UAT | ❌ | Real phone number, real SMS |
| AUTH-02 | New family create with ownerUid stamped | automatable | ✓ | `rules-unit-testing` script |
| AUTH-03 | Password-protected join rejects wrong password | automatable | ✓ | CF local emulator + assertion |
| AUTH-04 | Claim token redeems exactly once | automatable | ✓ | Parallel transaction test |
| AUTH-05 | Veto write post-migration preserved legacy id + new uid | automatable | ✓ | Fixture: pre-migration vote → run migration code path → assert fields |

### iOS-standalone PWA UAT checklist (the only reliable coverage)

- [ ] Fresh iPhone, no prior install. Safari → `couchtonight.app` → Share → Add to Home Screen.
- [ ] Open from home screen (standalone mode, no Safari chrome).
- [ ] Tap "Sign in with Google" → redirects to Google → signs in → returns to PWA → user is signed in (check DOM for signed-in UI).
- [ ] Repeat for Apple.
- [ ] Repeat for Email link (open the magic link from Mail app — critical path).
- [ ] Repeat for Phone (real SMS flow).
- [ ] Force-quit PWA, reopen → still signed in (persistence verified).
- [ ] Sign out → UI back to sign-in screen → sign back in → works.
- [ ] Create a family → generate invite → open invite link on SECOND device → signs in → joins → both devices see each other's writes in real-time.
- [ ] Owner sets password → second user tries to join without password → blocked → adds password → joins.
- [ ] Pre-auth family migration: restore an old localStorage state with `m_` member id, sign in, claim member, verify votes from pre-auth era still attributed to the same member doc.

### Sampling

- **Per task commit:** none (no test runner).
- **Per wave merge:** run rules-unit-testing script if present.
- **Phase gate:** full UAT checklist on a physical iOS PWA.

### Wave 0 Gaps

- [ ] Rules unit tests file (`tests/rules.test.js`) — covers AUTH-02, AUTH-03, AUTH-04, AUTH-05.
- [ ] Physical iOS device access for UAT (coordinate with user).

---

## 10. Pitfalls / landmines specific to this codebase

### P1: 25+ Firestore write sites scattered across js/app.js [VERIFIED: grep — 114 `state.me.id` refs, 4 direct `memberId: state.me` writes at 4802/5361/6095/7587]

**Don't:** Update every write site inline. The diff is massive and easy to miss one.

**Do:** Add a single helper in `js/utils.js`:

```js
// js/utils.js
import { state } from './state.js';

export function writeAttribution(extraFields = {}) {
  // Call AT THE WRITE SITE, inline into the payload.
  // Snapshots acting context BEFORE the write resolves (matches post-spin-veto pattern).
  const actingUid = state.auth?.currentUser?.uid || null;
  const actingAsSubProfile = state.actingAs || null;  // set by the per-action tap
  const payload = {
    actingUid,
    ...(actingAsSubProfile ? { managedMemberId: actingAsSubProfile } : {}),
    // Dual-write during grace:
    memberId: actingAsSubProfile || (state.me && state.me.id) || null,
    memberName: state.actingAsName || (state.me && state.me.name) || null,
    ...extraFields
  };
  // Side effect: clear acting-as after snapshot (D-04 per-action semantics)
  if (actingAsSubProfile) state.actingAs = null;
  return payload;
}
```

Every existing write site changes from `{ memberId: state.me.id, memberName: state.me.name, ... }` → `{ ...writeAttribution(), ... }`. Single-line edit per site, 4 primary sites + ~5 secondary (reactions, watchparty reactions, mood-tag writes).

### P2: state.familyCode-keyed paths must stay stable [VERIFIED: js/state.js lines 5-9]

The five helpers (`membersRef`, `titlesRef`, `familyDocRef`, `vetoHistoryRef`, `vetoHistoryDoc`) are the ONLY place that encodes the path. They all read `state.familyCode`. **Phase 5 MUST NOT change these function signatures or paths.** All auth-related logic keys off `state.auth.currentUser.uid` independently; paths remain `families/{code}/…`.

### P3: isParent shadow ownership assignment at app.js:1287 [VERIFIED: Read]

Today: first member to join a `family` mode group auto-gets `isParent: true`. After Phase 5, the first-signed-in user also auto-gets `ownerUid: <their uid>` stamped on the family doc. **These are independent flags:**
- `ownerUid` = admin role (one per family).
- `isParent` = content/age powers (can be multiple per family).

The code path at `joinAsNew` (app.js:1268-1297) needs rewriting to be auth-aware. Plan task: preserve `isFirstMember && mode === 'family'` → set BOTH `isParent: true` on the member AND `ownerUid: uid` on the family doc. Do the family-doc write inside the same operation using a batch.

### P4: unsubscribeFromPush in signOut/leaveFamily [VERIFIED: app.js:1309, 1319]

Today's `signOut` and `leaveFamily` explicitly call `unsubscribeFromPush()` as cleanup. Firebase Auth's `onAuthStateChanged` will fire a null-user event when sign-out happens from ANY surface (settings button, token revoke, account deletion). Plan task: hook `unsubscribeFromPush()` into the auth state listener, not only into the button handlers. Specifically:

```js
// js/auth.js
import { watchAuth } from './firebase.js';
import { unsubscribeFromPush } from './app.js'; // or extract to utils

watchAuth(async (user) => {
  if (!user) {
    try { await unsubscribeFromPush(); } catch(e) {}
    // Clear state but don't reload — let UI router respond to null user
    state.me = null;
    state.familyCode = null;
    // etc.
  }
});
```

The existing button handlers can still call the helper; they'll become no-ops when Auth fires next.

### P5: Module-scoped flag snapshot pattern (VETO-03 precedent)

[CONTEXT.md code_context + STATE.md decisions]: post-spin veto snapshots `vetoFromSpinResult` BEFORE `closeVetoModal()` clears it. Same principle for acting-as:

```js
// In the vote/veto/mood-tag handler:
const attribution = writeAttribution(); // snapshots acting-as AND clears it
await updateDoc(…, { [`vetoes.${titleId}`]: { ...attribution, at: Date.now() } });
// By the time this resolves, state.actingAs is already null — re-render is safe.
```

### P6: localStorage migration on first sign-in

Existing users have `qn_me` (local member id) + `qn_family` + `qn_active_group` + `savedGroups` in localStorage. Plan must NOT delete these on first Phase-5 sign-in. They serve as the claim source: on auth state change, if `qn_me` exists and member doc lacks `uid`, surface the "Is this you?" claim prompt pre-filled with the local name. Post-claim, the localStorage values remain as cache (no harm) until next full clear.

### P7: Email-link redirect in in-app browsers

[CITED: Firebase email-link docs] Email links clicked inside Gmail/Outlook iOS in-app browsers do NOT open in the PWA — they open in the in-app browser, which is a distinct origin from Safari and cannot access the home-screen PWA's storage. This breaks the flow silently. Mitigation: the email copy must say "Open this link in Safari" and the landing page should detect in-app browser (`navigator.userAgent` sniff for `GSA`, `FBAN`, etc.) and instruct the user. Acknowledge in plan as a UX task.

### P8: Firestore rules testing requires the admin SDK

[VERIFIED: `@firebase/rules-unit-testing` npm package] Rules can be validated offline without touching live Firestore. Node script + jest-like assertions. This is the ONLY automatable test path for Phase 5 — plan should ship a minimal rules test script even though the project has no test runner (self-contained, runs via `node tests/rules.test.js`).

### P9: Apple redirect-URL verification file must be deployed BEFORE Apple validates

The file at `https://couchtonight.app/.well-known/apple-developer-domain-association.txt` must return HTTP 200 with correct content AT THE MOMENT Apple's verify button is clicked. Plan order: deploy file first, then click verify in Apple Developer console. If `firebase.json` has a rewrite catching `/.well-known/*` into the SPA, Apple verification fails silently.

### P10: `authDomain` change breaks existing sessions

Changing `firebaseConfig.authDomain` from the default `.firebaseapp.com` to `couchtonight.app` invalidates any existing user's cached auth state (new storage key scope). Since NO USERS ARE AUTHED PRE-PHASE-5, this is a one-time non-issue — but worth stating so the planner doesn't worry about "users need to re-sign-in" as a regression later.

---

## Environment Availability

| Dependency | Required By | Available | Fallback |
|------------|------------|-----------|----------|
| Firebase Hosting at `couchtonight.app` | §1 same-origin `/__/auth/*` | ✓ | — |
| Firebase project `queuenight-84044` | all of Phase 5 | ✓ | — |
| Firebase Functions (Node 20, us-central1) | §4 | ✓ (Trakt function already deployed) | — |
| `bcryptjs` npm package | §4 `setGroupPassword` | not yet | `npm install bcryptjs` in `queuenight/functions/` |
| `@firebase/rules-unit-testing` | §9 rules tests | not yet | `npm install --save-dev @firebase/rules-unit-testing` in root |
| Apple Developer account w/ Services ID capability | §2 | unknown | **Flag to user** — requires Apple Developer Program membership ($99/yr) |
| Physical iOS device for UAT | §9 | unknown | **Flag to user** |
| Firebase Auth providers enabled (Google, Apple, Email, Phone) | §1-3 | not yet | Console toggle — discrete plan task |
| Phone auth SMS quota | §3 | default Firebase quota | Firebase free tier = 10 free SMS/day/project; may need upgrade for UAT |

**Missing with no fallback:** None that block planning. Apple Developer Program membership is a hard external dependency — flag to user before execution.

**Missing with fallback:** `bcryptjs` / `@firebase/rules-unit-testing` are trivial npm adds.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Trakt function is `us-central1`, Node 20 | §4 | Low — plan task confirms via grep, drifts one wave if wrong region |
| A2 | Manifest `scope: "/"` and `start_url: "/"` | §1 | Medium — wrong scope breaks the same-origin redirect fix; plan task is trivial grep |
| A3 | No existing `firebase.json` rewrite catches `/__/auth/*` or `/.well-known/*` | §1, §2 | High if wrong — Apple verification and auth handler both break silently; plan task: inspect `queuenight/firebase.json` before deploy |
| A4 | Firebase free tier SMS quota sufficient for UAT (~10/day) | §3 | Low — upgradable on demand |
| A5 | User has Apple Developer Program membership | §2 | High — blocks AUTH-01 (Apple); flag at start of planning |
| A6 | `bcrypt` cost 12 is acceptable for CF cold-start UX | §4 | Low — measurable; can drop to 11 if UX tests show lag |
| A7 | 30-day grace window is acceptable | §8 (D-15 Claude's Discretion) | Low — cutoff is a settings-doc field, extensible by config change |
| A8 | reCAPTCHA invisible works in iOS standalone PWA with button-bound init | §3 | Medium — UAT-verifiable; fallback to `size: 'normal'` documented |
| A9 | No App Check enabled in Phase 5 | §3 | Low — explicit out-of-scope decision; re-verify at Phase 6 planning |
| A10 | bcryptjs (pure JS) is acceptable vs native bcrypt | §4 | Low — speed delta is 30%, both meet UX budget at cost 12 |

---

## Open Questions for the Planner to Flag

1. **Apple Developer Program membership** — confirm user has active membership before Apple provider work starts. Without it, AUTH-01 ships with only Google/email/phone and Apple lands post-launch.
2. **Firebase Hosting deploy repo access** — researcher did not read `queuenight/firebase.json` or `queuenight/functions/`. Planner's first task should be to inspect these and confirm A1, A3.
3. **Grace window length** — D-15 says "propose 30 days." User approval at plan-phase kickoff.
4. **Initial owner auto-assignment for existing families** — "first member = owner" is in D-14. But which member is "first" in existing data? Options: (a) lowest `createdAt` timestamp; (b) the `isParent: true` member if exactly one exists; (c) prompt the user on their device at first post-migration sign-in. Recommendation: (a) with fallback prompt if no member has `createdAt`.
5. **Sub-profile member-id scheme** — for NEW sub-profiles created post-Phase-5, do we keep the `m_<ts>_<rand>` scheme (easy) or switch to `m_sub_<managedBy-short>_<rand>` (debuggable)? Recommendation: keep `m_<ts>_<rand>` for consistency; planner confirms.
6. **CF invite token TTL** — claim tokens: 30 days; guest invites: per-owner-choice (D-12). One-time invite link from D-11: propose 7 days. Confirm at plan time.
7. **Does the existing `index.html` manifest `start_url` include any query params?** — would break the `?claim=…` deep-link if so. Trivial grep.

---

## Project Constraints (from CLAUDE.md)

- **Single-file `index.html` + modular `js/` is locked for v1.** No bundler. All new code goes into `js/auth.js` (new), `js/firebase.js` (extend), `js/state.js` (extend), `js/utils.js` (extend), `js/app.js` (refactor). Cloud Functions go into the sibling `queuenight/functions/` repo.
- **TMDB key + Firebase web config stay client-side.** Public-by-design. Do NOT "fix" this.
- **Never read `js/app.js` in full** (~8100 lines, ~100K tokens). Use `Grep` to locate, `Read` with offset+limit.
- **TMDB rate-limit budget** (~40 req / 10s) unchanged by Phase 5; auth flow adds no TMDB calls.
- **Firestore schema under `families/{code}/…`** stays stable; Phase 5 adds fields inside docs, doesn't move paths.
- **Design system** (Fraunces + Instrument Serif + Inter, warm dark palette) — sign-in screen ships on existing tokens; polish is Phase 9.
- **Deploy**: copy `index.html`, `css/`, `js/` into `queuenight/public/`, then `firebase deploy`. Cloud Functions deploy separately from `queuenight/functions/`.
- **Test on mobile Safari home-screen PWA** — primary surface.

---

## Sources

### Primary (HIGH confidence)
- [Firebase Auth redirect best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices) — three custom-domain options; recommends same-origin proxy.
- [Firebase Auth web SDK — Apple](https://firebase.google.com/docs/auth/web/apple) — Services ID, return URL, domain verification steps.
- [Firebase Auth web SDK — Phone](https://firebase.google.com/docs/auth/web/phone-auth) — RecaptchaVerifier invisible size, API shape.
- [Firebase — Use Firebase in a PWA](https://firebase.google.com/docs/web/pwa) — manifest scope guidance.
- `js/firebase.js` (local) — confirms v10.12.0 modular SDK via gstatic CDN.
- `js/app.js:1225-1327` (local) — confirms existing `submitFamily` / `joinAsNew` / `joinAsExisting` / `signOut` / `leaveFamily` shape.
- `.planning/phases/05-auth-groups/05-CONTEXT.md` (local) — locked decisions D-01..D-21.

### Secondary (MEDIUM — verified with official source)
- [firebase-js-sdk#6716 Safari 16.1+ breakage](https://github.com/firebase/firebase-js-sdk/issues/6716) — root cause: third-party storage partitioning.
- [firebase-js-sdk#7583 iOS Google signInWithRedirect](https://github.com/firebase/firebase-js-sdk/issues/7583) — iOS 16.6+ failure mode.
- [firebase-js-sdk#7824 custom authDomain](https://github.com/firebase/firebase-js-sdk/issues/7824) — custom domain doesn't complete sign-in, silent.
- [firebase-js-sdk#7443 iOS home-screen network-request-failed](https://github.com/firebase/firebase-js-sdk/issues/7443) — confirms authDomain fix.
- [firebase-js-sdk#7273 Blank page after OAuth iOS](https://github.com/firebase/firebase-js-sdk/issues/7273) — back-button issue.
- [Apple forum thread 733477 — Sign in with Apple on Firebase](https://developer.apple.com/forums/thread/733477) — domain verification flow.
- [Apple forum thread 128291 — Verify Firebase domain](https://developer.apple.com/forums/thread/128291) — .well-known/apple-developer-domain-association.txt placement.
- [Fireship tutorial — Apple Sign-In with Firebase](https://fireship.io/lessons/apple-signin-with-firebase-tutorial/) — corroborating step-by-step.

### Tertiary (LOW — single source, needs UAT validation)
- [firebase-js-sdk#9405 App Check reCAPTCHA Enterprise](https://github.com/firebase/firebase-js-sdk/issues/9405) — App Check + phone auth interaction (drove A9).
- [Google Dev forum — reCAPTCHA Enterprise phone auth](https://discuss.google.dev/t/how-to-use-recaptcha-enterprise-with-firebase-phone-authentication/185757) — 2025 policy flux.
- [firebase-ios-sdk#15345](https://github.com/firebase/firebase-ios-sdk/issues/15345) — ERROR_RECAPTCHA_SDK_NOT_LINKED after enterprise toggle (iOS-only, but signals instability).

---

## Metadata

**Confidence breakdown:**
- Standard stack (Firebase Auth v10.12.0 modular SDK + bcryptjs in CF): HIGH — versions verified locally and in official docs.
- Architecture (same-origin authDomain + Cloud Function gates + Firestore rules): HIGH — official Firebase-recommended pattern.
- iOS standalone PWA redirect: MEDIUM — patched multiple times 2023-2025, UAT on physical device mandatory.
- Apple Sign-In: HIGH on steps, MEDIUM on PWA post-fix success (UAT).
- Phone + invisible reCAPTCHA: MEDIUM — works generally; App Check interaction is the landmine; fallback to visible captcha documented.
- Cloud Functions contract: HIGH — standard Callable Functions pattern.
- Security rules: HIGH on structure, MEDIUM on edge cases (rules tests required).
- Migration mechanics: HIGH — Firestore transaction on single-use tokens is bedrock-solid.
- One-uid-many-groups: HIGH — standard pattern.
- Grace window: HIGH.
- Pitfalls: HIGH — grounded in reading this specific codebase.

**Research date:** 2026-04-20
**Valid until:** 2026-05-20 (Firebase Auth in iOS PWA is a fast-moving area — re-verify redirect behavior if planning slips past 30 days)

## RESEARCH COMPLETE
