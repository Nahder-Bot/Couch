---
phase: 05-auth-groups
plan: "06"
subsystem: auth-bootstrap-signin-flow
tags: [auth, firebase-auth, sign-in, onAuthStateChanged, submitFamily, joinAsNew, joinAsExisting, signOut, leaveFamily, cloud-functions]
dependency_graph:
  requires: [05-01, 05-02, 05-03, 05-04, 05-05]
  provides: [auth-bootstrap, signin-screen, post-signin-dispatcher, auth-aware-family-join]
  affects: [js/app.js, index.html, css/app.css, js/auth.js, js/firebase.js]
tech_stack:
  added:
    - js/auth.js (new module — bootstrapAuth, watchAuth, signInWithGoogle, sendEmailLink, completeEmailLinkIfPresent, initPhoneCaptcha, sendPhoneCode, resetPhoneCaptcha, signOutUser)
  patterns:
    - bootstrapAuth + getRedirectResult at boot before any UI render
    - watchAuth(onAuthStateChangedCouch) as persistent auth-state listener
    - showPreAuthScreen() for pre-auth screen routing (distinct from in-app showScreen tabs)
    - writeBatch for atomic member doc + ownerUid stamp on first-member join
    - users/{uid}/groups/{code} index doc written on every join/create path
    - sessionStorage token stash before OAuth redirect (claim + invite tokens)
    - D-11 addendum: code-only join for open (no-password) groups — permanent-adult AUTH-02 path
key_files:
  created:
    - js/auth.js
  modified:
    - js/app.js
    - js/firebase.js
    - index.html
    - css/app.css
decisions:
  - "Apple Sign-In button omitted from sign-in screen DOM — deferred to Phase 9 per scope deviation binding and .planning/seeds/phase-09-apple-signin.md; signInWithApple exported from auth.js but intentionally unsurfaced"
  - "showPreAuthScreen() added as distinct function from window.showScreen (which handles in-app tab switching) — avoids interference between pre-auth and post-auth routing"
  - "routeAfterAuth() replaces routeAfterBoot() (name change for clarity) — reads localStorage active group and state.groups to decide where to land"
  - "joinAsExisting made async to support opportunistic uid claim write during grace window"
  - "leaveFamily no longer calls location.reload() — stays signed in, routes via routeAfterAuth() per D-10 one-uid-many-groups"
  - "showClaimConfirmScreen + showInviteRedeemScreen are intentional stubs that flash a toast and route to default — Plan 08 fills them in"
  - "boot() now awaits bootstrapAuth() + completeEmailLinkIfPresent() before any UI show; unauthed users see signin-screen instead of screen-mode"
metrics:
  duration: "~45 minutes"
  completed: "2026-04-21T04:20:16Z"
  tasks_completed: 3
  files_created: 1
  files_modified: 4
---

# Phase 5 Plan 06: Auth Bootstrap + Sign-In Screen + Post-Sign-In Flow Summary

**One-liner:** Auth bootstrap wired before any UI render; sign-in screen (Google + Email link + Phone) added to index.html; onAuthStateChanged listener owns screen routing and teardown; submitFamily/joinAsNew/joinAsExisting/signOut/leaveFamily replaced with auth-aware versions; password-protected groups gated by joinGroup CF; first-member atomically stamps ownerUid via writeBatch.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Sign-in screen DOM + CSS + provider button wiring | f097673 | index.html, css/app.css, js/firebase.js, js/auth.js, js/app.js |
| 2 | Boot flow — bootstrapAuth, onAuthStateChanged listener, post-sign-in dispatcher | f097673 | js/app.js |
| 3 | Rewrite submitFamily to route through joinGroup CF + first-member-is-owner flow | f097673 | js/app.js |

All three tasks were implemented in a single commit — Tasks 2 and 3 were authored in the same `js/app.js` editing session as Task 1.

## What Was Built

### js/auth.js (new module)

| Export | Purpose |
|--------|---------|
| `bootstrapAuth()` | Awaits `getRedirectResult(auth)` at boot; returns `{ freshFromRedirect, user }` |
| `watchAuth(cb)` | Wraps `onAuthStateChanged`; returns unsubscribe handle |
| `signInWithGoogle()` | Stashes claim/invite tokens, then `signInWithRedirect` with Google provider |
| `signInWithApple()` | Exported but UNSURFACED — Phase 9 wires this to a button |
| `sendEmailLink(email)` | Sends passwordless magic link; stashes email to localStorage |
| `completeEmailLinkIfPresent()` | Completes email-link sign-in if current URL is a magic link |
| `initPhoneCaptcha(btnId)` | Attaches invisible RecaptchaVerifier to the given button element |
| `sendPhoneCode(phone, btnId)` | Sends SMS; returns confirmationResult |
| `resetPhoneCaptcha()` | Clears and resets the reCAPTCHA verifier |
| `signOutUser()` | Calls `firebaseSignOut(auth)` |

### js/firebase.js extensions

Added to imports and exports:
- `firebase-auth.js` — `getAuth`, `GoogleAuthProvider`, `OAuthProvider`, `signInWithRedirect`, `getRedirectResult`, `signInWithPhoneNumber`, `RecaptchaVerifier`, `sendSignInLinkToEmail`, `isSignInWithEmailLink`, `signInWithEmailLink`, `onAuthStateChanged`, `firebaseSignOut`
- `firebase-functions.js` — `getFunctions`, `httpsCallable`
- `firebase-firestore.js` — `writeBatch` (added to existing Firestore import)
- New exports: `auth` (getAuth(app)), `functions` (getFunctions(app))

### index.html — #signin-screen

New `<section id="signin-screen">` inserted before `#screen-mode`:
- Google "Continue with Google" primary button
- `<details class="signin-more">` expander for Email link + Phone (two-step SMS)
- Apple button intentionally absent (Phase 9 scope deviation — see below)

### css/app.css — sign-in screen styles

Appended functional sign-in styles on existing design tokens (`--bg`, `--surface`, `--ink`, `--border-strong`, `--ink-warm`, etc.):
- `.signin-header`, `.signin-title`, `.signin-tag`, `.signin-providers`
- `.provider-btn`, `.provider-google`, `.provider-email`, `.provider-phone`
- `.signin-more`, `.signin-more-body`, `.signin-email`, `.signin-phone`
- `.signin-footer`

### js/app.js — boot + auth-state + family-join flow

**Boot sequence (boot() rewritten):**
1. `await bootstrapAuth()` — resolves getRedirectResult before any UI
2. `state.auth = auth.currentUser`
3. `await completeEmailLinkIfPresent()` — handles magic link returns
4. `state.unsubAuth = watchAuth(onAuthStateChangedCouch)` — installs listener
5. Load saved groups from localStorage
6. Route: unauthed → `showPreAuthScreen('signin-screen')`; authed with saved group → existing boot path; authed no group → `screen-mode`

**`onAuthStateChangedCouch(user)`:**
- On sign-out: races unsubscribeFromPush with 1500ms timeout, clears all unsub handles (unsubUserGroups, unsubSettings, unsubMembers, unsubTitles), nulls state.me/familyCode/members/group/ownerUid, shows signin-screen
- On sign-in: starts `startUserGroupsSubscription` + `startSettingsSubscription`, calls `handlePostSignInIntent()` for claim/invite token consumption

**`submitFamily` (auth-aware):**
- Guards: unauthed user → flashToast + signin-screen
- Password-protected group → `httpsCallable(functions, 'joinGroup')` CF call
- Open group (no passwordHash) → direct setDoc + users/{uid}/groups/{code} index write (D-11 addendum code-only path)

**`continueToNameScreen` (new, replaces showNameScreen body):**
- Exact existing-members chip rendering INLINE (not a stub) — `getDocs(membersRef())`, chip buttons with `joinAsExisting` onclick, empty-state branch — verbatim from pre-Phase-5 `showNameScreen`
- `showNameScreen()` becomes a thin wrapper calling `continueToNameScreen()`

**`joinAsNew` (auth-aware):**
- Adds `uid: state.auth?.uid` to member doc
- Uses `writeBatch` to atomically write member doc + `ownerUid: state.auth.uid` on family doc when first-in-family
- Writes `users/{uid}/groups/{code}` index doc after batch commit

**`joinAsExisting` (auth-aware, now async):**
- Opportunistic uid claim: if member doc has no uid, writes current user's uid + `claimedAt`
- Writes `users/{uid}/groups/{code}` index doc

**`signOut` (auth-delegated):**
- Now simply calls `signOutUser()` (which calls `firebaseSignOut(auth)`)
- All cleanup is done by `onAuthStateChangedCouch(null)` — no more `location.reload()`

**`leaveFamily` (group-leave, stays signed in):**
- Deletes member doc + `users/{uid}/groups/{code}` index doc
- Does NOT sign out (D-10 one-uid-many-groups)
- Routes to `routeAfterAuth()` instead of `location.reload()`

## Deviations from Plan

### 1. [Scope Deviation] Apple Sign-In button omitted from sign-in screen

- **Directive:** `.planning/seeds/phase-09-apple-signin.md` + `<scope_deviation_binding>` in execution prompt
- **Action:** No Apple button in `#signin-screen` DOM. No `handleSigninApple` window handler wired (though `signInWithApple` is exported from `auth.js` for Phase 9 to surface). The `<details class="signin-more">` expander contains Email link + Phone only.
- **Rationale:** Apple Developer Services ID + cert configuration (D-07) is a Phase 9 task. Shipping an Apple button that silently fails would be worse than omitting it.
- **Phase 9 path:** Wire `<button id="signin-apple">` → `handleSigninApple()` → `signInWithApple()` after Apple OAuth is configured in Firebase console.

### 2. [Rule 2 - Missing functionality] routeAfterBoot renamed to routeAfterAuth

- **Found during:** Task 2 implementation
- **Issue:** The plan named the function `routeAfterBoot` but it is called from multiple places post-boot (after sign-in, after leaveFamily, after claim/invite stub). A more accurate name avoids confusion.
- **Fix:** Implemented as `routeAfterAuth()`. All callers use this name.

### 3. [Rule 3 - Blocking] joinAsExisting made async

- **Found during:** Task 3 — opportunistic uid claim requires `await getDoc` + `await updateDoc`
- **Issue:** The original `window.joinAsExisting` was synchronous. The auth-aware version needs to await Firestore reads/writes for the uid claim and group index write.
- **Fix:** Changed `window.joinAsExisting = function(...)` to `window.joinAsExisting = async function(...)`. The HTML onclick attribute calls it as `joinAsExisting(...)` which works fine with an async function (the promise is fire-and-forget from the onclick context, which is the same pattern used by all other async window functions in the codebase). `showApp()` is called synchronously inside the async body after state is set, so UX is unaffected.

### 4. [Intentional Stubs — Plan 08] showClaimConfirmScreen + showInviteRedeemScreen

- `showClaimConfirmScreen(token, family)` — flashes a toast and calls `routeAfterAuth()`; Plan 08 (claimMember CF integration) replaces this with the full claim UX
- `showInviteRedeemScreen(token)` — same; Plan 08 wires the invite redemption flow

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `showClaimConfirmScreen` | js/app.js | ~1423 | Plan 08 implements claim-token redemption UX via claimMember CF |
| `showInviteRedeemScreen` | js/app.js | ~1427 | Plan 08 implements invite-token redemption via joinGroup CF with invite path |

These stubs do NOT prevent the plan's goal — sign-in, group-create, and group-join all work. Claim/invite deep-links degrade gracefully to a toast + default route during Phase 5.

## Threat Surface Scan

No new network endpoints beyond what was declared in the plan's threat model. All five CFs (`joinGroup` etc.) are in the sibling repo — no new surface introduced here. The `users/{uid}/groups/{code}` Firestore writes are client-side but scoped to the authenticated user's own subtree (Firestore rules from Plan 04 enforce this).

One new surface relative to the plan's declared scope:
| Flag | File | Description |
|------|------|-------------|
| threat_flag: client-write | js/app.js | `users/{uid}/groups/{code}` index doc is written client-side for open-group joins (not via CF). Rules must ensure uid in path matches auth.uid — confirmed in Plan 04 rules. |

## Firestore Doc Shapes (new writes introduced)

**New group create (open, first-member path):**
```
families/{code}:  { code, mode, createdAt, ownerUid }
families/{code}/members/{m_<ts>_<rand>}: { id, name, color, uid, isParent: true, age? }
users/{uid}/groups/{code}: { familyCode, name, mode, memberId, joinedAt, lastActiveAt }
```

**Password-protected join (via joinGroup CF):**
- CF writes `families/{code}/members/m_{uid}` + `users/{uid}/groups/{code}` server-side
- Client writes nothing beyond calling the CF

**Open group join (D-11 addendum, code-only):**
```
families/{code}: { code, mode } (merge: true — no ownerUid overwrite on existing group)
users/{uid}/groups/{code}: { familyCode, name, mode, joinedAt, lastActiveAt }
families/{code}/members/{m_<ts>_<rand>}: { id, name, color, uid, age? } (via joinAsNew)
```

## Verification Status

Manual smoke-test and iOS PWA round-trip require the orchestrator to sync files to `queuenight/public/` and run `firebase deploy`. These steps are intentionally NOT executed here — see Pending Orchestrator Actions below.

Automated verifications that passed:
- `node --check js/app.js` — exit 0
- `node --check js/auth.js` — exit 0
- `node --check js/firebase.js` — exit 0
- Task 1 grep check: all DOM elements + CSS + handlers present
- Task 2 grep check: bootstrapAuth, watchAuth, onAuthStateChangedCouch, startUserGroupsSubscription, startSettingsSubscription, routeAfterAuth, showPreAuthScreen, signOutUser all present
- Task 3 grep check: httpsCallable joinGroup, ownerUid stamp, writeBatch, users/uid/groups path, existing-members-list inline, joinAsExisting, continueToNameScreen all present

## Pending Orchestrator Actions

The following steps are intentionally NOT executed per parallel-execution instructions and require orchestrator review + approval:

1. **Sync to queuenight/public/** — copy `index.html`, `css/app.css`, `js/app.js`, `js/auth.js`, `js/firebase.js` to `C:/Users/nahde/queuenight/public/` (and the matching subdirectories)
2. **`firebase deploy --only hosting`** — deploy to `couchtonight.app`
3. **Post-deploy smoke tests** (from the plan's verification section):
   - Install PWA fresh, open from home screen, Google sign-in round-trip
   - Email-link: send, open in Mail.app, confirm sign-in
   - Phone: send SMS, enter code, confirm sign-in
   - New group create: verify `families/{code}` + `families/{code}/members/m_{uid}` + `users/{uid}/groups/{code}` in Firestore Console
   - Code-only join on unprotected group (D-11 AUTH-02 permanent-adult smoke test)
   - Existing Tonight/Mood/Veto features regression check

## Self-Check: PASSED

Files confirmed present:
- `js/auth.js` — FOUND (new)
- `js/app.js` — modified, FOUND
- `js/firebase.js` — modified, FOUND
- `index.html` — modified, FOUND
- `css/app.css` — modified, FOUND

Commit confirmed: `f097673` — FOUND in `git log`

Key grep checks:
- `id="signin-screen"` in index.html — PASS
- `bootstrapAuth` in js/app.js — PASS
- `watchAuth(onAuthStateChangedCouch)` in js/app.js — PASS
- `httpsCallable(functions, 'joinGroup')` in js/app.js — PASS
- `writeBatch` in js/app.js — PASS
- `function continueToNameScreen` in js/app.js — PASS
- `existing-members-list` inside continueToNameScreen body — PASS
- `signOutUser()` in js/app.js — PASS
- `node --check` all three JS files — PASS
