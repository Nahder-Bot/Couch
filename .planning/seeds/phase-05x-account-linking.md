---
seeded: 2026-04-21
target-phase: 5.x (Phase 5 polish — NOT Phase 9 which is Redesign/Brand)
recategorized-from: phase-09-account-linking.md
trigger: "Phase 5 UAT (2026-04-21) showed Google + Phone sign-in create separate Firebase uids"
related: [phase-05x-apple-signin.md]
---

# Phase 5.x seed — Multi-provider account linking

> **Recategorization note (2026-04-21, autonomous session):** Originally seeded as `phase-09-account-linking.md`. Phase 9 per ROADMAP is Redesign/Brand/Marketing, not auth polish. This belongs under Phase 5 as a 5.x polish task because it closes a bug the Phase 5 UAT exposed. Keeping it labeled `phase-05x-*` keeps it in the Phase 5 scope without blocking Phase 5 closure.

## Observation

Phase 5 UAT surfaced a Firebase Auth default: signing in with Google and later with phone (or email link) produces **two separate Firebase users** with distinct `uid` values. Each gets its own `users/{uid}/groups/{code}` index and, if they join the same family, both point at the same `memberId` from two sibling accounts.

Functional: works. UX: "I have two accounts" rather than "one account, two sign-in methods."

## Desired behavior

From Account settings → a new "Sign-in methods" section:
- List of currently-linked providers with status badges ("Google ✓", "Phone: +1 •••5678 ✓")
- "Add another way to sign in" affordance → picks provider type → runs link flow → merges into current Firebase user
- "Remove" button per provider (except the last one — always keep ≥1)

## Implementation scope (v1 polish)

**Ship first (narrow, low-risk):**
1. **Link phone to an existing Google account** — uses `linkWithCredential` + existing `sendPhoneCode` pattern. No redirect complexity. The most common case hit in UAT.
2. **Show linked-providers list** — `auth.currentUser.providerData` is a stable API.
3. **Unlink** — `unlink(auth.currentUser, providerId)`. Idempotent.

**Ship second (wider, more testing needed):**
4. Link Google to an existing phone account — requires `linkWithRedirect(auth.currentUser, new GoogleAuthProvider())`. `bootstrapAuth` needs to distinguish "returning from link redirect" vs "returning from sign-in redirect" via a sessionStorage flag set before redirect.
5. Link email-link to existing account — requires a full round-trip (send link, user taps, app calls `linkWithCredential` with EmailAuthProvider credential instead of signing in with it).

**Deferred:**
- Cross-uid data migration (merging two existing Firebase users' group memberships is explicitly out of scope — Firebase provides no safe automated path)
- Linking Apple to existing account (Apple Sign-In itself is phase-05x-apple-signin)

## File map (for the focused session)

- `js/firebase.js` — add imports/re-exports for `linkWithCredential`, `unlink`, `PhoneAuthProvider`, `EmailAuthProvider`
- `js/auth.js` — add `sendPhoneLinkCode`, `confirmPhoneLink`, `getLinkedProviders`, `unlinkProvider` helpers
- `js/app.js` — new `renderSignInMethodsCard()` called from `renderSettings()`; new modal for "Add phone number" flow mirroring existing phone-signin pattern
- `index.html` — new `<div id="signin-methods-card">` section in the Account tab

## Error cases to handle

- `auth/provider-already-linked` — idempotent; show "Already linked"
- `auth/credential-already-in-use` — the credential belongs to another Firebase user. Message: "That number is already signed in as a different Couch account. Sign in with it directly, or remove it from the other account first." No auto-merge.
- `auth/requires-recent-login` — re-auth prompt before linking sensitive credentials
- Last-provider unlink — block with message "Add another sign-in method before removing this one"

## Success criteria

- A signed-in Google user can add a phone number via Account settings; after sign-out, signing in with that phone reaches the same Firestore uid (not a new one)
- No duplicate member docs are ever created by the link path
- Unlinking a provider succeeds and next sign-in via that provider starts a fresh account
- The UI clearly shows which providers are linked and handles the "last provider" edge case

## Estimate

~3 focused hours including device UAT: 1hr code (helpers + card + modal), 1hr integration testing, 1hr iOS PWA verify.
