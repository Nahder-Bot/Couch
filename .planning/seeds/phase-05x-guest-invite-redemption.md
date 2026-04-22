---
seeded: 2026-04-22
target-phase: 5.x (Phase 5 polish — unshipped recipient-side of guest invites)
trigger: "Phase 5 UAT (2026-04-22) Test 3 — guest invite link redemption routes to sign-in screen instead of letting recipient join as a guest"
related: [phase-05x-account-linking.md]
---

# Phase 5.x seed — Guest invite redemption flow

## Problem

Plan 05-07 shipped the **owner side** of guest invites end-to-end:
- `createGuestInvite` / `inviteGuest` CF exists and mints valid tokens
- Owner-settings UI generates the link + clipboard-copy button + preset durations (1d / 1w / 30d)
- Firestore `invites/{token}` docs are written with `expiresAt` and `familyCode`

The **recipient side** is a known-deferred stub. Per `05-08-SUMMARY.md` line 139:
> "Plan 06's `showInviteRedeemScreen` stub was intentionally preserved — it's explicitly out of scope for Plan 5.8. The stub still toasts and routes cleanly."

**Observed during UAT on 2026-04-22:** User clicked a valid guest invite link in incognito → app routed to the Google/email/phone sign-in screen instead of a guest-redemption flow. The invite link is functionally inert today.

## Desired behavior

Clicking a `couchtonight.app/?invite=<token>&family=<code>` link should:

1. Skip the regular sign-in screen (or at minimum, de-emphasize it).
2. Show a branded "Join <family> as a guest" screen: family name, duration badge, "Your name" input.
3. On submit: create an anonymous Firebase auth session (`signInAnonymously`) under the hood OR skip Firebase auth entirely if rules allow unauthed member creation with a valid invite token.
4. Call a new `consumeGuestInvite` CF that:
   - Validates the token against `invites/{token}` (exists, not expired, not already consumed)
   - Creates a `temporary: true` member doc in the family with `expiresAt` from the invite
   - Marks the invite consumed (or deletes it)
   - Returns `{ familyCode, memberId, memberName }`
5. Land recipient on Tonight as the new guest member. Their chip shows with `badge-guest` apricot/sage pill.
6. Session persists for the guest's lifetime (invite expiry), then auto-reverts them to sign-in screen once expired.

## Implementation shape

**CF (queuenight/functions/):**
- `consumeGuestInvite.js` — onCall, input `{ token, guestName }`, output `{ familyCode, memberId, memberName }`. Uses admin SDK to bypass rules. Idempotent: if called twice with same token, second call errors with `failed-precondition: already-consumed`.

**Client (js/app.js):**
- `showInviteRedeemScreen(token)` — replace the stub. Render the branded guest-join screen. Pre-fill family name from invite doc (or from `?family=` URL param). Name input with placeholder "Your name" and a single "Join" button.
- `submitGuestRedeem()` — calls CF, stashes `{ memberId, familyCode, temporary: true, expiresAt }` in `state.groups`, switches to the family, lands on Tonight.
- Guard: if token is expired or missing, show a friendly "This invite link has expired. Ask <owner> for a new one." screen (do NOT route to sign-in — this is a dead end for the guest).

**Rules (firestore.rules):**
- Already handles `temporary: true` members per Plan 05-07's member-doc shape. Verify the consumeGuestInvite CF's admin-SDK writes pass cleanly.
- Consider: does the guest need `auth.uid` for any subsequent writes (votes, reactions)? If yes, must `signInAnonymously` before the CF call so the guest has a uid to attribute writes to. Likely yes — existing `writeAttribution()` pattern requires `actingUid`.

**URL handling:**
- Current: `handlePostSignInIntent` reads `?invite=` only after sign-in (line 2037 in js/app.js).
- New: `bootstrapAuth` should detect `?invite=` BEFORE sign-in gate and route to `showInviteRedeemScreen` directly, bypassing the sign-in screen entirely. Stash the token in sessionStorage in case the user reloads mid-flow.

## Expiry enforcement

Guest members already have `expiresAt` on the member doc. Enforcement should happen at:
- **Chip-list render** (`continueToNameScreen` at `js/app.js:56`): already filters `!m.temporary || m.expiresAt > now`. Good — passive expiry.
- **Write path** (votes, reactions, etc.): add `expiresAt` check to the guest's member doc before attribution. If expired, block the write with a user-facing "Your guest access has expired" toast.
- **Scheduled CF** (optional): daily cron that archives expired guest members so they're not even fetched. Nice-to-have, not required for v1.

## Security considerations

- Invite tokens MUST be cryptographically random (32+ bytes, URL-safe base64). Already handled by `inviteGuest` CF.
- Rate-limit `consumeGuestInvite` per-IP at the CF level (App Check or a simple Firestore counter) to prevent token-enumeration attacks.
- `invites/{token}` doc should NOT be readable by non-members. Rules should lock reads to admin SDK only.
- Consider: does the guest-join URL expose the family code publicly? If a family code is sensitive (e.g. password-protected), bundling it in an unauthenticated URL leaks the code to anyone who intercepts the link. Mitigation: require the invite token alone to resolve the family — don't bundle `?family=` at all. Owner-side code can stop appending it.

## Success criteria

- Owner generates invite link → recipient clicks in incognito (any browser) → lands on "Join as guest" screen directly, no sign-in prompt
- Recipient enters name → submits → appears as guest chip on Tonight within 1s
- Owner sees guest chip appear in member list with `badge-guest` pill and expiry indicator
- Manual expiry (owner taps "remove" OR `expiresAt` passes) → chip filters out within 1 snapshot cycle; guest's subsequent writes rejected with clear toast
- Expired invite link shows friendly dead-end screen, does NOT route to sign-in

## Estimate

~3 hours focused: 1hr CF (`consumeGuestInvite` with admin SDK + idempotency), 1hr client (redeem screen + bootstrap routing + state wiring), 1hr UAT (mint → redeem → expire → regression-check all three).

## Notes

- Current UAT marks this area as "PENDING hands-on" in `05-UAT-RESULTS.md` and "FAIL scope-deferred" in the new `05-UAT.md`. Both flag the gap, this seed captures the fix.
- Phase 5 can still close without this — mint-only is shipped, redeem is explicitly polish. But if the product is going to onboard actual guests before Phase 9, this needs to ship first.
- Pair with `phase-05x-account-linking.md` seed for a broader auth-UX polish sprint.
