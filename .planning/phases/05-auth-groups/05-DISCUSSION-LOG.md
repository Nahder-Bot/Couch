# Phase 5: Auth + Groups - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 05-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 5-auth-groups
**Areas discussed:** Auth providers & sign-in UX, Account ↔ groups & guest fallback, Migration & claim flow, Password-protected groups & ownership

---

## Auth providers & sign-in UX

### Q1 — Sign-in providers (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Google | Firebase GoogleAuthProvider via redirect (popup blocked in iOS standalone PWA). Lowest friction. | ✓ |
| Apple | Firebase 'apple.com' OAuthProvider via redirect. Required for native iOS submission; private relay email fits privacy-wary teens. | ✓ |
| Email link (passwordless) | sendSignInLinkToEmail. No password to remember; needs mail deliverability + handle-link route. | ✓ |
| Phone (SMS) | Firebase PhoneAuthProvider. For older kids with phone but no email; reCAPTCHA required on web; SMS cost. | ✓ |

**User's choice:** All four.
**Notes:** User wants to cater to the widest possible household — adults with Google/Apple, older kids with school email (link) or phone-only (SMS). Sign-in screen will stack Google+Apple primary, email/phone in "More options" expander to keep mobile UX tight.

### Q2 — Sub-profile model (clarified after user expanded the kid-participation requirement)

| Option | Description | Selected |
|--------|-------------|----------|
| Parent creates & acts-as | Sub-profile lives under managing parent; parent acts on behalf. Graduates to own account later. | ✓ (extended) |
| Shared 'Kids' pseudo-member | Single 'Kids' member any parent acts as. Loses per-kid taste data. | |
| Legacy code-join for kids | Kids join exactly like today, no auth. Permanent unauth surface. | |

**User's choice:** Parent creates & acts-as **+ kids can also pick themselves on shared device** (extended via the user's clarification — "young kids can login similar to today in case they want to use a parent's phone or a tablet").
**Notes:** Sub-profiles appear on BOTH the Tonight member-picker AND the name-pick screen. Anyone on the couch can tap a sub-profile in (not only the managing parent). Graduation flow exists. Temporary guest membership added as a separate concept (grandma for a week).

### Q3 — Act-as stickiness

| Option | Description | Selected |
|--------|-------------|----------|
| Per-action tap | Tap kid's chip → next vote/veto attributed to them, then revert. Matches remote-passing. | ✓ |
| Persistent 'Acting as' toggle | Tap once, stay in mode until tap out. Easy to forget. | |
| Both (mode when solo, tap when together) | Persistent on profile-picker, per-tap on Tonight. Most flexible, more UI. | |

**User's choice:** Per-action tap.

### Q4 — Auth gating

| Option | Description | Selected |
|--------|-------------|----------|
| Family-authed device, per-person pick | Group needs ≥1 signed-in owner; devices joined via code stay 'family-authed'; anyone picks themselves without re-auth per session. | ✓ |
| Strict per-user auth | Every person must be signed in on their device. Kills shared-tablet flow. | |
| Auth-lazy | Auth optional; uid only required for push/watchparty. Permanent dual code paths. | |

**User's choice:** Family-authed device, per-person pick.

---

## Account ↔ Groups & guest fallback

### Q1 — Group join discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Invite link + code | Owner generates deep-link with code prefilled; falls back to typed code. | ✓ |
| Code-only (today's flow, authed) | Keep today's code box; user must be signed in first. | |
| Code + optional link | Both surfaces coexist. | |

**User's choice:** Invite link + code (code remains as fallback).

### Q2 — Temporary guest mechanic (grandma for a week)

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-issued timed invite | Owner picks duration, generates one-time link. Guest joins with `temporary: true + expiresAt`. Auto-archives at expiry. | ✓ |
| Owner manually adds + removes | No auto-expiry. Owner has to remember to clean up. | |
| Self-join expiring pass | Time-limited URL anyone can use. Easiest, weakest access control. | |

**User's choice:** Owner-issued timed invite.

### Q3 — Older kid first-sign-in landing

| Option | Description | Selected |
|--------|-------------|----------|
| Land in claim flow if family invited them | Parent invite carries claim token; new account lands on "Is this you, [Kid]?" one-tap claim. | ✓ |
| Always empty state | New uid always starts at zero groups. | |
| Auto-claim by email match | Auto-merge if parent stored kid's future email. Brittle. | |

**User's choice:** Land in claim flow if family invited them.

---

## Migration & claim flow

### Q1 — Claim initiation for existing members

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-invites-by-link, member-confirms | Owner generates per-member invite links; recipient signs in + taps "I'm [Name]". Strongest control, lowest spoofing risk. | ✓ |
| Self-claim by name + family code | Anyone signed in picks "I'm Dad". Sibling could grab wrong identity. | |
| Self-claim, owner-approves | Self-claim + owner-approval queue. Safer, more steps. | |

**User's choice:** Owner-invites-by-link, member-confirms.

### Q2 — Migration cutover

| Option | Description | Selected |
|--------|-------------|----------|
| Soft cutover with grace | Existing devices keep working unchanged for N days; new writes dual-write. After grace, unclaimed members go read-only. Zero forced disruption. | ✓ |
| Hard cutover at first launch | Force claim flow before any other action. Brittle if mid-Tonight when update lands. | |
| Indefinite dual-mode | Old code-only + new authed coexist forever. Permanent dual code paths. | |

**User's choice:** Soft cutover with grace.

### Q3 — Sub-profile graduation to real account

| Option | Description | Selected |
|--------|-------------|----------|
| Parent issues claim link from settings | Parent enters kid's email/phone, sends invite. Kid signs in, confirms, uid replaces managedBy. Votes/queue/history all carry over by stable member id. | ✓ |
| Kid signs up independently then requests merge | Kid creates account, finds family, requests merge. Parent approves. | |
| Both | Either path works. More UI surface. | |

**User's choice:** Parent issues claim link from settings.

---

## Password-protected groups & ownership

### Q1 — Owner role vs existing isParent flag

| Option | Description | Selected |
|--------|-------------|----------|
| Owner is a new role; parents stay as today | Family doc gains `ownerUid`; isParent stays as content-controls flag. Clear separation. | ✓ |
| Owner = isParent (collapsed) | Anyone with isParent has owner powers. Loses 'one runs the group' clarity. | |
| Owner + co-owners + parents (three tiers) | ownerUid + coOwnerUids[]. Most flexible, more UI. | |

**User's choice:** Owner is a new role; parents stay as today.

### Q2 — Group password mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Owner-set, hashed in Firestore + Cloud Function gate | bcrypt-hashed via setGroupPassword Cloud Function. joinGroup function verifies code+password before issuing membership write. | ✓ |
| Code IS the password (no separate field) | Drop the password concept; long codes + rate-limit. Loses lock-back-down use case. | |
| Per-invite tokens, no global password | Single-use/expiring tokens. Strongest security, biggest behavior change. | |

**User's choice:** Owner-set, hashed in Firestore + Cloud Function gate.

### Q3 — Ownership transferability

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — owner picks any member, confirms | Settings has 'Transfer ownership'. Old owner becomes regular member. | ✓ |
| No — owner permanent until group deleted | Cleaner; misowned groups must be rebuilt. | |
| Yes, but only to another isParent member | Prevents accidental hand-off to a kid; less flexible. | |

**User's choice:** Yes — owner picks any member, confirms.

---

## Claude's Discretion

- Grace-window length (proposing 30 days, finalize at plan-phase)
- Sign-in screen visual layout (functional UI on existing tokens; full polish in Phase 9)
- Cloud Function region (match existing Trakt OAuth function)
- bcrypt cost factor (researcher to recommend based on cold-start budget)
- Internal naming inside `js/auth.js`
- Which `state.familyCode`-keyed paths are refactored vs left in place during grace

## Deferred Ideas

- Per-group monetization / plan tiers (Out of Scope at milestone level)
- 2FA / passkey / WebAuthn (post-v1)
- Cross-group social discovery (Out of Scope, family-scoped by design)
- Co-owners (multi-owner) model (single ownerUid in Phase 5; revisit if needed)
- Auto-claim by email match (rejected as brittle)
- Hard cutover (rejected; soft cutover wins)
- Phone-auth SMS cost monitoring / per-family rate limits (surface in Phase 6 ops planning)
- Sign-in screen visual polish (deferred to Phase 9 redesign)
