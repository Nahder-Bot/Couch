---
phase: 05-auth-groups
plan: 07
subsystem: auth-groups
tags: [auth, sub-profiles, guest-invite, owner-admin, act-as, D-01, D-03, D-04, D-12, D-18, D-19]
requires: [05-03, 05-04, 05-05, 05-06]
provides:
  - sub-profile-create-ui
  - act-as-per-action-tap
  - owner-admin-panel
  - guest-invite-link-generator
  - password-rotation-ui
  - ownership-transfer-ui
affects:
  - js/app.js
  - index.html
  - css/app.css
tech-stack:
  added: []  # All deps already wired via js/firebase.js (httpsCallable + functions exports)
  patterns:
    - "Per-action act-as tap (D-04): set state.actingAs + state.actingAsName on chip tap, writeAttribution snapshot-then-clears on the next write"
    - "Owner panel gated on state.ownerUid === state.auth.uid, kept fresh via the existing state.unsubGroup family-doc snapshot"
    - "Sub-profile member doc shape: { managedBy: parentUid, NO uid field } — rules (Plan 04) branch on this"
    - "Guest member filter: !m.archived && (!m.temporary || m.expiresAt > Date.now()) — applied identically in name-screen and Tonight who-list"
key-files:
  created:
    - .planning/phases/05-auth-groups/05-07-SUMMARY.md
  modified:
    - js/app.js               # +216 lines task 1, +108 lines task 2
    - index.html              # +44 lines (owner section + sub-profile section + modal)
    - css/app.css             # +27 lines (badges + settings-row + subprofile-row + act-as-active)
decisions:
  - "Empty password is NOT supported by the deployed setGroupPassword CF (min 4 chars). UI guards client-side with a min-length toast; the 'leave blank to remove' promise in the original plan draft is dropped. Removal would require a dedicated CF."
  - "Transfer-target dropdown filters to members with m.uid AND !m.temporary AND not self — matches the CF's failed-precondition check so the user never gets to click 'Transfer' on an ineligible option."
  - "Sub-profile chip on Tonight uses a dashed accent border to distinguish 'tap to act as' from 'tap to toggle' (D-04 semantic split). Authed-member chips still behave as before (toggleMember)."
  - "Copy button for the guest invite link uses a data-link attribute + copyGuestLink handler instead of inline string interpolation, so links with single-quotes/apostrophes don't break the attribute."
metrics:
  duration_min: ~35
  tasks_completed: 2
  commits: 2
  completed: 2026-04-21
---

# Phase 05 Plan 07: Member types + owner admin Summary

**One-liner:** Ships the full member-type model on top of the auth foundations — sub-profile create + per-action act-as (D-01/D-03/D-04), owner-only password rotation, timed guest invites, and ownership transfer (D-18/D-19).

## What was built

### Task 1 — Sub-profile CRUD + act-as (commit `3ab102c`)

**Account settings gets a new "Kids & sub-profiles" section** with an "Add a kid" button that opens a modal (name + avatar color picker). Submitting writes a member doc with `{ id, name, color, managedBy: state.auth.uid, createdAt, isParent: false }` — crucially **no `uid` field**, which is what Firestore rules key on to distinguish sub-profiles from authed members.

**`renderSubProfileList()`** renders a roster inside the settings section, each row with the member's avatar, name, and a "Send claim link" button stubbed for Plan 08 (shows a coming-soon toast; TODO comment in code flags orchestrator to wire `mintClaimTokens` CF when 08 lands).

**Name-screen chip list** (`continueToNameScreen`) now filters `existing = existingRaw.filter(m => !m.archived && (!m.temporary || m.expiresAt > now))` and each chip can carry `<span class="chip-badge badge-kid">kid</span>` or `badge-guest`. Sub-profiles and active guests both show in the list so a kid on a shared tablet or a guest redeeming a link can tap themselves in via the existing `joinAsExisting` path (per D-03).

**Tonight who-list** (`renderTonight`) uses the same filter and renders sub-profile chips with a distinct `sub-profile` class (dashed accent border) and **different click handler**: `tapActAsSubProfile(id, name)` sets `state.actingAs + state.actingAsName`, flashes a confirmation toast, and adds an `act-as-active` outline to the chip. The next `writeAttribution()` call (vote / veto / mood-tag) picks up `managedMemberId` via the snapshot-then-clear semantics already in `js/utils.js` — one write, then auto-reverts to parent attribution (D-04 per-action).

### Task 2 — Owner admin panel (commit `900ebad`)

**Owner-only `#settings-owner` section** in Account, hidden by default via `display:none` and revealed by `renderOwnerSettings()` when `state.auth.uid === state.ownerUid`. Three controls:

| Control | Handler | CF called | Notes |
|---------|---------|-----------|-------|
| Group password (min 4 chars) | `submitGroupPassword` | `setGroupPassword` | bcrypt-hashes server-side; client mirrors the >=4 validation before the network trip |
| Invite a guest (1d / 1w / 30d) | `createGuestInvite` | `inviteGuest` | Returns `{ deepLink, inviteToken, expiresAt }`; UI renders the link + a Copy button |
| Transfer ownership | `transferOwnershipTo` | `transferOwnership` | Target dropdown filtered to authed non-self members only; `confirm()` guard before call |

**Live-sync**: the existing `state.unsubGroup` snapshot on `familyDocRef()` (previously tracked only mode/picker/name) now also keeps `state.ownerUid` + `group.passwordProtected` fresh AND calls `renderOwnerSettings()` on every tick. Net effect: right after a transfer CF succeeds, the old owner's admin panel disappears and the new owner's appears — no refresh, no custom second subscription. Clean extension of one existing listener.

## Member doc shapes (Firestore)

| Type | Required fields | Distinguishing field |
|------|-----------------|----------------------|
| Authed adult | `id, name, color, uid, [isParent], [age]` | `uid` present |
| Sub-profile | `id, name, color, managedBy, createdAt, isParent: false` | `managedBy` present, **no `uid`** |
| Guest | `id, name, color, uid, temporary: true, expiresAt: <ts>, invitedBy: <ownerUid>` | `temporary: true` (written by `joinGroup` CF when consuming a `metadata.temporary` invite) |

The owner's admin panel and the Tonight/name-screen filters use these fields as the only branching signal — no separate "type" enum.

## UX calibration

- **Badges**: `#f2a365` apricot for kid, `#7cb4a9` sage for guest — both from the existing warm palette, Inter 10px/600 uppercase. Render at the right edge of the name string with `margin-left: 4px`, vertical-align middle.
- **Act-as visual state**: dashed border on idle sub-profile chip (communicates "different interaction"), `2px solid #f2a365` outline + 12% apricot glow on the chip that was just tapped. Clears on next render or on explicit re-tap elsewhere.
- **Guest durations**: 1 day / 1 week / 30 days — within the CF's 90-day MAX_DURATION_MS hard cap. No custom duration input in v1 (would need min/max validation UI; defer if requested).
- **Copy affordance**: the Copy button uses `data-link` + handler instead of inline interpolation — safer against edge-case tokens and easier to style.

## Key integration points honored

- `writeAttribution()` snapshot-then-clear contract preserved. `tapActAsSubProfile` only sets the state flag; `writeAttribution()` does the rest — no duplicated logic.
- Sub-profile create uses `setDoc(doc(membersRef(), memberId), sub)` (single atomic write; no stale id collisions) with `managedBy: state.auth.uid` exactly matching the rule's `managedBy == request.auth.uid` check.
- Group switcher untouched — the Firestore-synced `startUserGroupsSubscription` from Plan 06 continues to drive `state.groups` and `renderGroupSwitcher`. Plan 07 success-criteria item on "group switcher uses users/{uid}/groups" was already satisfied; no changes needed.
- `renderSettings()` now calls `renderSubProfileList()` + `renderOwnerSettings()` inside `try/catch` blocks so a missing DOM node can't take down the whole settings tab.

## VETO-03 cross-device toast suppression

VETO-03 (post-veto snack-bar toast suppression on the device that vetoed) runs off `v.memberId === (state.me && state.me.id)` in the session snapshot listener. When a parent acts-as a sub-profile, `writeAttribution` sets `memberId: <sub-profile id>` on the veto payload — NOT the parent's `state.me.id`. Consequence: the parent's device WILL see the veto toast for their own act-as action. This is arguably correct (the device's human user is the parent, the sub-profile is a pointer, and the toast announces "Ella vetoed X" which is useful feedback), but note: it diverges from the "suppress echo on the vetoing device" rule if interpreted strictly. Not changed in this plan — flagging for Plan 08 / verification review.

## Deviations from Plan

### Rule 2 / 3 auto-fixes applied inline

**1. [Rule 2 — correctness] Empty password rejection.** The plan's Step B used `if (pw && pw.length < 4)` — allowing empty submissions through to the CF, which throws `invalid-argument` with a less-friendly default message. Changed to `if (!pw || pw.length < 4)` and dropped the "Leave blank to remove" copy from the settings hint. Removing a password isn't actually supported by the deployed CF; documenting so the orchestrator doesn't get a support ticket about it.

**2. [Rule 3 — blocking] Renderer wiring.** Plan mentioned "Call renderOwnerSettings() from wherever the settings screen opens/refreshes" without naming the hook. Extended `renderSettings()` (the existing per-tick settings re-render) with `try { renderSubProfileList() } catch {}` + `try { renderOwnerSettings() } catch {}` so both panels stay in sync with state changes through `renderAll()`.

**3. [Rule 3 — blocking] Copy button contract.** Plan inlined the link into the onclick string. That breaks if the token contains single quotes or if the family code needs escaping. Refactored to a `data-link` attribute + `copyGuestLink(btn)` handler so the copy path is quote-safe.

**4. [Rule 3 — blocking] state.unsubFamilyDoc redundancy.** Plan Step C proposed adding a NEW `state.unsubFamilyDoc` + `startFamilyDocSubscription()` function. But `state.unsubGroup` already subscribes to `familyDocRef()` at js/app.js:1976 (to keep picker/mode fresh). Extending it is cleaner than running two listeners on the same doc. Did that; `state.unsubFamilyDoc` is not introduced. State shape in `js/state.js` unchanged.

**5. [Rule 3 — blocking] Chip-selector mismatch.** Plan's visual-hint query was `.member-chip[data-id]` — but the actual DOM uses `.who-chip` (Tonight) and `.join-chip` (name-screen). Updated selectors to `.who-chip.act-as-active` / `.who-chip[data-sub-id]` to match.

### Things NOT done (deferred / out of scope)

- **Graduation / claim-link mint** — Plan 08 explicit. Left a stub `sendGraduationLink` that flashes a coming-soon toast and a `// TODO (orchestrator)` comment pointing at `mintClaimTokens`.
- **Password REMOVAL UI** — Would need a new CF or CF param support for blank; out of scope.
- **Custom guest duration input** — UX unclear (min/max validation, preset vs slider?). Three presets cover v1.
- **Guest-redemption inviteRedeemScreen wiring** — the owner-side flow (this plan) mints the invite; the guest-side redemption is still the stub at `showInviteRedeemScreen` from Plan 06 (which just routes to auth). Plan 08 owns the redeem path.

### Auth gates

None encountered. All edits were local-file operations; no CF / Firebase Auth interactions needed during execution (the deployed CFs were called through stable `httpsCallable` wrappers only, no runtime).

## TODOs for orchestrator

1. **Deploy**: rsync `index.html`, `css/`, `js/` to `queuenight/public/` and `firebase deploy --only hosting`.
2. **Smoke test on mobile Safari (primary surface)** — the four flows in the plan's `<verification>` block: create sub-profile → act-as vote → owner password → owner transfer.
3. **Plan 08 backlog**: wire `sendGraduationLink` → `mintClaimTokens` CF (stub in js/app.js:~1760 has TODO comment).
4. **VETO-03 + act-as interaction** — verify on test device whether the "parent sees a toast for their own acting-as veto" is expected UX or needs a follow-up tweak.

## Self-Check: PASSED

- Task 1 automated verify: `grep -q openCreateSubProfile/createSubProfile/managedBy: state.auth.uid/tapActAsSubProfile/state.actingAs = memberId/badge-kid/badge-guest/act-as-active/subprofile-modal` — OK
- Task 2 automated verify: `grep -q submitGroupPassword/createGuestInvite/transferOwnershipTo/httpsCallable(functions, 'setGroupPassword')/httpsCallable(functions, 'inviteGuest')/httpsCallable(functions, 'transferOwnership')/renderOwnerSettings/id="settings-owner"` — OK
- `node --check js/app.js` — SYNTAX_OK (after each edit)
- Commits in `git log`: `3ab102c` (task 1) and `900ebad` (task 2) — both present
