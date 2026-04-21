# Phase 5: Auth + Groups - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the anonymous family-code + local-member model with real authenticated user accounts (Firebase Auth, stable `uid`), optionally password-protected groups, a non-disruptive migration path for every existing family, and a member-type model that supports authed adults, authed older kids (multi-group), parent-managed sub-profiles for young kids without their own email/phone, and time-bounded guest memberships (e.g., a visiting grandparent).

Every Firestore write that previously identified a member by a family-local `m_<ts>_<rand>` id must now carry a resolvable identity: a `uid` for authed members, or an acting `uid` + `managedMemberId` for sub-profile actions. All shipped features (Tonight, Mood, Veto, existing Sports Watchparty) must continue to work end-to-end after migration with no data loss.

**In scope:** Firebase Auth integration (Google + Apple + email link + phone SMS), member-type model (parent/older-kid/sub-profile/guest), one-uid-many-groups + group switcher continuity, owner role + transfer, password-protected groups via Cloud Function gate, migration claim flow with grace window, sub-profile graduation flow, temporary guest invites with expiry, schema migration to dual-write member.id + uid then cut over.

**Out of scope (deferred to other phases):** Push targeting (Phase 6), watchparty identity surfaces (Phase 7), intent-flow notifications (Phase 8), redesign of the auth screens themselves (Phase 9 brand pass — Phase 5 ships functional UI on existing tokens), per-group monetization tiers (post-v1), 2FA / passkey support (post-v1).

</domain>

<decisions>
## Implementation Decisions

### Member-type model (foundational — drives every other decision)

- **D-01:** Three first-class member types coexist:
  1. **Parent** — authed (own uid). Can manage sub-profiles, act-as them, approve content, etc. `isParent: true` flag preserved from today's data model.
  2. **Older kid** — authed (own uid). Builds their own watchlist, votes, etc. Can belong to the family group AND independent friend groups.
  3. **Young kid (sub-profile)** — no auth. Created and managed by a parent. Has its own member doc with `managedBy: <parentUid>` and no uid of its own. Participates fully in Tonight / votes / mood / veto via "act-as" by any device user.
- **D-02:** **Temporary guest** is a separate orthogonal flag (`temporary: true`, `expiresAt: <ts>`) layered on top of any authed member. Used for visiting grandparents, weekend friends. Auto-archives membership at expiry; data preserved for recap.
- **D-03:** Sub-profiles appear in BOTH the Tonight member-picker (anyone on the couch can tap them in) AND the name-pick / `showNameScreen` selector (kid using a parent's phone or a shared tablet can tap themselves in). This preserves today's `joinAsExisting` UX for the youngest users.
- **D-04:** Act-as semantics: **per-action tap** (not a persistent toggle). Tapping a sub-profile chip on Tonight attributes the next vote/veto/mood-tag to that sub-profile, then the device reverts to the signed-in user. Matches physical remote-passing on a couch and prevents accidental mis-attribution.

### Auth providers & sign-in UX

- **D-05:** Phase 5 ships **all four** Firebase Auth providers: Google, Apple, Email link (passwordless), Phone (SMS). Sign-in screen is a stacked button list with Google + Apple primary above the fold; email/phone live in a "More options" expander to keep mobile UX tight.
- **D-06:** All OAuth flows use **redirect, not popup** (popups are blocked in iOS standalone PWA). Researcher to verify Firebase Auth redirect handler works against the existing Firebase Hosting domain + the PWA manifest scope.
- **D-07:** Apple sign-in requires Apple Developer Services ID + cert + return URL configured against `couchtonight.app`. Plan must include the cert/config setup as a discrete task.
- **D-08:** Phone (SMS) requires reCAPTCHA on web; researcher to confirm reCAPTCHA invisible mode works in PWA.
- **D-09:** Gating model: **family-authed device, per-person pick.** A group must have ≥1 signed-in owner (the creator). Any device joined to the group via code is "family-authed" — the name-pick screen shows all authed members, sub-profiles, and active guests, and anyone can tap themselves in without re-auth per session. Older kids using their own phone still sign in once with their own uid.

### Account ↔ groups & guest fallback

- **D-10:** **One uid → many groups is mandatory** (not optional). Older kids will belong to the family + independent friend groups. The existing `savedGroups` localStorage + group-switcher UI is the foundation; extend it to be uid-keyed (synced via Firestore `users/{uid}/groups`) instead of device-local only.
- **D-11:** **Group join via invite link + code (both).** Owner generates a shareable invite link (deep-link with code prefilled into PWA). Recipient opens it, signs in if not already, lands on the group's name-pick screen. Code-only entry (today's flow) remains as the fallback for off-app shares.

  **D-11 addendum (revision 1, 2026-04-20):** For v1, the "permanent" (non-guest) invite-link flow for authed adults is covered by the combination of **D-09 family-authed device** + **code-only share**: any adult receiving the code over SMS/email/AirDrop signs in once, enters the code, and becomes an authed member. A purpose-built permanent-invite-link CF with deep-link + autofilled code is **deferred** (see `<deferred>` section). Planner confirms code-only + D-09 is adequate coverage for AUTH-02's permanent-adult case; guest-temporary invite links (D-12) remain distinct and fully implemented in Phase 5.
- **D-12:** **Temporary guest membership: owner-issued timed invite.** Owner taps "Invite guest" in settings, picks duration (1 day / 1 week / custom / until-revoked), gets a one-time invite link. Guest taps link, signs in with their own account (or opts into code-only mode if they have no account), joins with `temporary: true + expiresAt`. On expiry, member doc archives (votes preserved for recap), guest drops from active roster. Re-invitable.
- **D-13:** **First sign-in landing for older kids:** if the parent-generated invite link carried a sub-profile claim token, new account lands directly in "Is this you, [Kid]?" confirmation — one tap claims the sub-profile, votes/queue/history carry over. Otherwise lands on an empty "Create or join a group" screen with the family code field.

### Migration & claim flow

- **D-14:** **Owner-invites-by-link, member-confirms.** On Phase-5 launch, today's first member of each family becomes the owner (single ownerUid initially). Owner sees a "Claim members" panel listing every existing member name and generates a per-member invite link (deep-link with claim token). Sends to each person via SMS / email / AirDrop / etc. Recipient signs in, taps "I'm [Name]", their uid is written to that member doc. Sub-profiles use the same UI but the parent claims them silently (no link sent).
- **D-15:** **Soft cutover with grace window.** After Phase 5 ships, existing members on existing devices keep working unchanged for a defined grace period (length finalized at plan-phase — propose 30 days). Their member id resolves like today. New writes during this window dual-write member.id + uid (when present). Owner sees a persistent "Claim your members" nudge banner. After grace expires, unclaimed members enter read-only mode (can view but not vote/veto/edit) until claimed.
- **D-16:** **Sub-profile graduation: parent issues claim link from settings.** Parent goes to "Manage [Kid]", taps "Send claim invite", enters kid's email/phone. Kid signs in via that link, confirms "this was my profile", their uid replaces `managedBy` on the member doc. Votes / queue / mood-tags / vetoHistory / watchparty participation all stay on the same member id and become uid-owned. `managedMemberId` field is cleared. Act-as no longer available for that member.

### Password-protected groups & ownership

- **D-17:** **Owner is a new role; parents stay as today.** Family doc gains `ownerUid` (singular). Owner = group creator (or whoever it was transferred to). `isParent` remains a separate per-member flag for content/age controls. Owner has admin powers (set/rotate password, invite/revoke members, manage sub-profiles, end watchparties, transfer ownership). Parents can act-as kids and approve content but can't change group settings unless they're also the owner.
- **D-18:** **Group password: owner-set, hashed in Firestore + Cloud Function gate.** Owner sets/rotates from settings. Password is bcrypt-hashed (NEVER stored plaintext) inside a Cloud Function `setGroupPassword` endpoint, then written to the family doc as `passwordHash + algoVersion`. Joining a password-protected group goes through a Cloud Function `joinGroup` that verifies code + password before issuing the Firestore membership write. Code alone won't grant access. Reset = owner changes password; old password invalidates outstanding unredeemed invites.
- **D-19:** **Ownership transfer allowed.** Settings has "Transfer ownership" — pick any authed member of the group, confirm. Old owner becomes a regular member (parent flag preserved). Covers "I made the group for my parents but want them to actually own it" and the leaving-the-family edge case.

### Schema & write attribution

- **D-20:** Every Firestore write that today references `member.id` must after Phase 5 carry both `actingUid` (the authed user who triggered the write) and (if acting-as) `managedMemberId` (the sub-profile being acted for). During the grace window, writes also carry the legacy `member.id` for backward-compat. Post-grace, `member.id` becomes derivable from uid+managedMemberId only.
- **D-21:** All shipped features (votes, queues, mood-tags, vetoHistory, watchparty participation) must be auditable to the responsible uid even when the action was on behalf of a sub-profile. Self-echo guards (e.g., VETO-03 toast suppression) compare against `actingUid`, not `managedMemberId`.

### Claude's Discretion

- Exact grace-window length (proposing 30 days).
- Sign-in screen visual layout (functional UI on existing design tokens; full polish in Phase 9 redesign).
- Cloud Function region selection — likely match the existing Trakt-OAuth function region.
- Specific bcrypt cost factor for password hashing (researcher to recommend based on Cloud Function cold-start budget).
- Internal naming of the new `js/auth.js` module surface.
- Exactly which existing `state.familyCode`-keyed paths get refactored vs left in place during the grace window.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project state & roadmap
- `.planning/PROJECT.md` — vision, constraints, locked tech stack
- `.planning/REQUIREMENTS.md` lines 33-37 — AUTH-01 through AUTH-05 acceptance criteria
- `.planning/ROADMAP.md` §"Phase 5: Auth + Groups" — phase goal, dependencies, success criteria
- `.planning/STATE.md` — current execution state

### Existing implementation (must not break)
- `js/firebase.js` — Firebase init point; Auth must be added here as a parallel export
- `js/app.js:1225-1327` — current submitFamily / showNameScreen / joinAsNew / joinAsExisting / signOut / leaveFamily flow that the Phase 5 UI must replace cleanly
- `js/app.js:1287` — current `isParent` shadow ownership assignment (first member of family in family mode)
- `js/app.js:1051,1090-1091,3365,4668,7663` and similar — every Firestore path keyed on `state.familyCode` and `state.me.id` that needs to handle the new acting-uid + managedMemberId attribution
- `js/state.js` — state shape (`state.familyCode`, `state.me`, `state.group`); needs new `state.auth` surface

### Trakt OAuth precedent
- The existing Cloud Function used for Trakt OAuth token exchange (in the `queuenight/` deploy repo) is the closest analog for the new `setGroupPassword` and `joinGroup` Cloud Functions. Plan should reference its region, error envelope, and error-handling style for consistency.

### Prior phase context
- `.planning/phases/03-mood-tags/03-CONTEXT.md` — mood-tag data shape that must remain readable post-migration
- `.planning/phases/04-veto-system/04-CONTEXT.md` — vetoHistory subcollection + self-echo guard pattern (VETO-03 toast suppression) that informs the actingUid audit pattern

### External docs (researcher to fetch)
- Firebase Auth web SDK v10.12.0 reference (matches `js/firebase.js` import version) — providers, redirect handlers, custom claims
- Firebase Auth iOS PWA / standalone-mode redirect behavior — known gotchas
- Apple Sign-In Services ID configuration for web (return URLs, cert)
- Firebase reCAPTCHA invisible mode for phone auth in PWA
- Firestore security rules for uid-based authorization with acting-as attribution

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`showNameScreen` + `joinAsExisting`** (`js/app.js:1240-1304`) — the existing "tap an existing member to join" UI is the exact UX pattern the sub-profile picker should reuse. Extend the rendered list to include sub-profiles + active guests.
- **`savedGroups` localStorage + group-switcher UI** — already supports the one-device-many-groups case; needs to upgrade to uid-keyed and Firestore-synced.
- **Trakt Cloud Function** (in the `queuenight/` deploy repo) — proven server-secret pattern; reuse its region, packaging, error envelope for `setGroupPassword` + `joinGroup`.
- **`unsubscribeFromPush` calls in `signOut` / `leaveFamily`** (`js/app.js:1309,1319`) — auth signout flow already handles cleanup hooks; new auth state listener wires into the same lifecycle points.

### Established Patterns
- **All Firestore paths nest under `families/{state.familyCode}/...`** — migration must keep these paths stable while changing how member identity inside them is attributed.
- **Module structure**: `js/firebase.js` (init + exports) → `js/state.js` (mutable state) → `js/utils.js` (helpers) → `js/app.js` (feature logic). New `js/auth.js` belongs alongside `firebase.js` and `state.js`, exporting the auth instance + a small set of high-level helpers (signInWithGoogle, signInWithApple, sendEmailLink, sendPhoneCode, signOut, onAuthStateChanged wrapper).
- **Self-echo guard pattern** from VETO-03 (`v.memberId === (state.me && state.me.id)`) becomes `v.actingUid === state.auth.currentUser?.uid` post-Phase-5; same shape, new field.
- **Module-scoped flag snapshot before clearing** (post-spin veto pattern) — applies to acting-as: snapshot the acting member id BEFORE the write resolves so a fast re-render doesn't mis-attribute.

### Integration Points
- `js/firebase.js` — add Auth instance + provider exports.
- New `js/auth.js` — auth state, sign-in helpers, claim/graduation/transfer flows.
- `js/state.js` — extend `state` with `state.auth`, `state.actingAs` (for per-action act-as), `state.ownerUid`.
- `js/app.js:1225-1327` — replace family-join flow with auth-aware version while preserving the name-pick UX for sub-profiles.
- `js/app.js` ~25+ Firestore write sites — audit and update for actingUid + managedMemberId attribution under a unified helper (probably new `writeAttribution()` util in `js/utils.js`).
- New Cloud Functions in `queuenight/functions/` — `setGroupPassword`, `joinGroup`, `claimMember`, `inviteGuest`, possibly `transferOwnership`.

</code_context>

<specifics>
## Specific Ideas

- "Grandma comes for a week, has access to the family watch party, helps pick movies and shows" — concrete grandparent-guest use case (D-12).
- "Older kids can build their own list and join groups of their friends" — concrete older-kid friend-group use case (D-10).
- "Young kid uses a parent's phone or a tablet" — concrete shared-device sub-profile pick use case (D-03, D-09).
- "I want to give the parents the ability to add young kids but also have the young kids have ability to login similar to today" — locks the dual-entry sub-profile model (D-03).
- "Sub-profiles can be added but people can also click them to add them" — anyone on the couch can add a sub-profile to Tonight, not only the parent (D-03, D-04).

</specifics>

<deferred>
## Deferred Ideas

- **Per-group monetization / plan tiers** — locked Out of Scope at the milestone level (PROJECT.md).
- **2FA / passkey / WebAuthn** — post-v1; Phase 5 ships with the four chosen providers only.
- **Cross-group social discovery** — Out of Scope (Couch is family-scoped by design).
- **Co-owners (multi-owner) model** — single `ownerUid` ships in Phase 5; if real households need it later, add as a focused phase.
- **Auto-claim by email match** — rejected as brittle (parents would have to predict kids' future emails); explicit parent-issued claim link is the path.
- **Hard cutover at first launch** — rejected; soft cutover with grace window is the path.
- **Phone-auth SMS cost monitoring + per-family rate limits** — operational concern, surface in Phase 6 push planning where SMS budgeting is also relevant.
- **Sign-in screen visual polish / branded sign-in surface** — deferred to Phase 9 redesign; Phase 5 ships functional UI on existing design tokens.
- **Permanent (non-guest) invite-link flow with deep-link + autofilled code (revision 1, 2026-04-20).** v1 uses D-09 family-authed device + code-only share; planner confirms adequate coverage for AUTH-02's permanent-adult case. Deferred to a 5.x follow-up if user feedback demands a link-based flow for authed adults. Guest-temporary invite links (D-12) remain in scope.

</deferred>

---

*Phase: 05-auth-groups*
*Context gathered: 2026-04-20*
*Revision 1: 2026-04-20 — D-11 addendum + permanent-invite-link deferred (per plan-checker feedback)*
