---
seeded: 2026-04-21
target-phase: 09
trigger: "UAT of phone provider showed Google + phone create separate uids by default"
related: [phase-09-apple-signin.md]
---

# Phase 9 seed — Multi-provider account linking

## Observation

Phase 5 UAT surfaced a predictable but worth-flagging Firebase Auth default: signing in with Google and later with phone (or email link) produces **two separate Firebase users** with distinct `uid` values. Each gets its own `users/{uid}/groups/{code}` index and, if they join the same family, ends up with the same `memberId` referenced from two sibling accounts.

It works — but the user experience is "I have two accounts" rather than "I have one account with two ways to sign in."

## Desired behavior

From Account settings, signed-in user sees "Link phone number" / "Link email". Tapping it calls `linkWithCredential` to fold the second provider into the current Firebase user. All `users/{uid}/groups` entries stay on the primary uid; the second provider just becomes another sign-in path to it.

## Implementation sketch

- New Account-settings block: "Sign-in methods" with one row per linked provider and a "+ Add another way to sign in" affordance.
- Calls `linkWithPhoneNumber` / `linkWithRedirect(new GoogleAuthProvider())` depending on what's being linked.
- Handle `auth/provider-already-linked` (idempotent — no-op) and `auth/credential-already-in-use` (point user at sign-in + manual merge flow — out of scope for v1 polish).
- Show linked-provider badges in the settings row (e.g. "Google ✓", "Phone: +1 •••5678 ✓").

## Non-goals

- Cross-uid data migration (collapsing two existing Firebase users' group memberships) is NOT in scope. This is purely additive linking for users who sign in once and later want a second path.
- No change to existing sign-in screens — linking happens post-auth from settings.

## Success

- A signed-in user can add a phone number to their Google account; after sign-out, signing in with that number reaches the same Firestore uid (not a new one).
- No duplicate member docs are ever created by the link path.
