---
phase: 05-auth-groups
plan: 08
subsystem: auth-migration-close
tags: [auth, claim, graduation, migration, read-only, grace-window, cloud-function]
requires: [05-03, 05-04, 05-06, 05-07]
provides:
  - Owner Claim-your-members panel (D-14 migration flow)
  - Claim-confirm screen post-sign-in (D-14 recipient flow)
  - Sub-profile graduation via mintClaimTokens type='graduation' (D-16)
  - Grace-window countdown banner + client-side read-only enforcement (D-15)
  - mintClaimTokens CF — 6th Phase-5 Cloud Function
  - claimMember CF now stamps graduatedAt on graduation-typed redemptions
affects:
  - js/app.js (settings rendering, post-sign-in routing, write-handler guards)
  - index.html (claim-confirm screen, claim panel, grace banner, claim-prompt banner)
  - css/app.css (claim-row, grace-banner, claim-confirm-screen, is-readonly)
  - queuenight/functions (new mintClaimTokens, extended claimMember)
tech-stack:
  added: []
  patterns:
    - "CSS.escape for safe data-id selector matching inside DOM query"
    - "functions/error-code prefix stripping for friendly error mapping"
    - "module-scoped _pendingClaim stash for cross-screen token → CF redemption"
    - "guardReadOnlyWrite() early-return pattern at top of every write handler"
key-files:
  created:
    - C:/Users/nahde/queuenight/functions/src/mintClaimTokens.js
    - .planning/phases/05-auth-groups/05-08-SUMMARY.md
  modified:
    - js/app.js
    - index.html
    - css/app.css
    - C:/Users/nahde/queuenight/functions/index.js
    - C:/Users/nahde/queuenight/functions/src/claimMember.js
decisions:
  - "Claim-confirm screen uses a dedicated #claim-confirm-screen div with manual display toggling (not showScreen, which targets only tab-level main screens)"
  - "Token stays opaque to the client; the confirm screen shows a generic 'Your profile in CODE' string because Firestore rules block reading claimTokens server-only"
  - "mintClaimTokens pre-validates every member doc before staging any writes, so a single bad id aborts the whole batch (all-or-nothing)"
  - "Acting-as sub-profiles are never read-only on their own — their writes inherit the authed parent's uid via writeAttribution, which bypasses the grace gate"
  - "guardReadOnlyWrite() is centralised (single toast + banner + early-return) so every guarded handler has identical UX"
metrics:
  duration: ~18min
  completed: 2026-04-21
---

# Phase 5 Plan 08: Claim/Graduation Flows + Read-Only Enforcement Summary

Closed the Phase 5 migration loop. Owners can now mint per-member claim links from Settings, recipients land on a confirm screen after sign-in, sub-profile graduation works via the same claim-token mechanism with `graduatedAt` stamping, and post-`graceUntil` unclaimed adult members fall into a client-side read-only mode (banner + dimmed buttons + toast on write attempts). Firestore rules remain the authoritative gate; the client UI is just friendly presentation.

## What Was Built

### Task 1 — mintClaimTokens Cloud Function

**File:** `C:\Users\nahde\queuenight\functions\src\mintClaimTokens.js` (new, 143 lines) + wired in `C:\Users\nahde\queuenight\functions\index.js`.

- v2 onCall CF matching sibling-file style (claimMember.js / inviteGuest.js).
- Validates `familyCode`, `type in {migration, graduation}`, `memberIds` array (max 100 entries, non-empty strings).
- Two auth gates inside the loop:
  - `migration` → caller must be family `ownerUid` (T-05-08-04).
  - `graduation` → caller must be `managedBy` for every requested member (T-05-08-03).
- Pre-reads all member docs before any writes, so a single bad id aborts the whole batch (all-or-nothing).
- Rejects minting on already-claimed members (`failed-precondition`).
- 256-bit entropy via `crypto.randomBytes(32).toString('base64url')`.
- 30-day TTL written to `expiresAt`; `consumedAt` starts null (enforces single-use via claimMember transaction).
- Batch write of all token docs in one atomic `db.batch().commit()`.
- Returns `{ ok: true, tokens: [{ memberId, memberName, token, deepLink, expiresAt }, ...] }`.

Also extended `claimMember.js`: on `type === 'graduation'`, the existing transaction now also stamps `graduatedAt = claimedAt` alongside the `managedBy` delete (D-16 timeline).

### Task 2 — Owner Claim Panel + Claim-Confirm Screen + Graduation

**Files:** `js/app.js`, `index.html`, `css/app.css`.

- **Claim-confirm screen** (`#claim-confirm-screen`): inserted as a post-auth, pre-`app-shell` `<div>` with manual `display` toggling (deliberately not using `showScreen`, which is scoped to main tab screens). Shows brand logo, "Is this you?", avatar placeholder, "Your profile in CODE" string, and two buttons: "Yes, claim" → `confirmClaim()`, "Not me" → `declineClaim()`.
- **`confirmClaim`**: `httpsCallable(functions, 'claimMember')({ familyCode, claimToken: token })`; on success sets localStorage `qn_family` + `qn_active_group`, hides the claim screen, calls `switchToGroup(familyCode)`. Maps Firebase Functions error codes (with `functions/` prefix stripping) to friendly toasts: already-used / expired / invalid / please sign in again.
- **`declineClaim`**: clears `_pendingClaim`, hides the screen, falls through to `routeAfterAuth()`.
- **Owner's Claim-members panel** (inside `#settings-owner`): `renderClaimMembersPanel` filters unclaimed adults (`!uid && !managedBy && !temporary && !archived`). Each row renders avatar + name + "Generate link" button + a `.claim-link-out` slot that populates with the deep link and a Copy button after minting.
- **`mintClaimForMember(memberId)`**: single-member CF call, populates that row's `.claim-link-out`.
- **`mintAllMigrationClaims()`**: batches all unclaimed member ids into one CF call, renders each returned deep link under its corresponding row via `CSS.escape`-safe selector.
- **`copyClaimLink(btn)`**: clipboard-copy helper with friendly fallback toast.
- **`sendGraduationLink(memberId)`**: replaces the Plan 07 stub. Mints a `type='graduation'` token, prefers `navigator.share()` (Web Share picker), falls back to clipboard, falls back further to displaying the raw link in a toast. Maps `permission-denied` / `failed-precondition` to friendly messages.
- **Grace banner** (`#settings-grace-banner`): `renderGraceBanner()` shows days remaining when `state.settings.graceUntil > Date.now()`, hides itself past cutoff. Wired into both `renderSettings` and the settings-doc `onSnapshot` handler so it updates in real time.

### Task 3 — Client-Side Read-Only Enforcement

**Files:** `js/app.js`, `index.html`, `css/app.css`.

- **`isReadOnlyForMember(member)`**: permissive when settings aren't loaded yet; pre-`graceUntil` → false for everyone; post-grace → true only for members with no `uid`, no `managedBy`, no `temporary`.
- **`isCurrentSelfReadOnly()`**: routes through `state.actingAs` when set (sub-profiles are never read-only on their own since they're act-as'd), else checks `state.me`.
- **`applyReadOnlyState()`**: toggles `document.body.classList.is-readonly` and banner visibility; invoked at the head of every `renderAll()` pass so any snapshot that updates members/titles recomputes cleanly.
- **`guardReadOnlyWrite()`**: single-source guard used at the top of every write handler — returns `true` if caller should early-return, and fires toast + calls `showClaimPromptBanner()` as a side-effect.
- **Guarded handlers:** `applyVote` (covers `setVote`, `quickVote`, `swipeVote`), `submitVeto`, `addDetailMood`, `removeDetailMood`, `postComment`, `postActivityReply`, `postReaction` (watchparty emoji + text), `confirmStartWatchparty`.
- **`#claim-prompt-banner`** injected inside `#screen-tonight`; dismiss button clears for the session; banner re-asserts on any further guarded write attempt.
- **CSS `body.is-readonly`** dims `.vote-btn`, `.veto-btn`, `.mood-add-btn`, `.mood-chip-remove`, `.reaction-btn`, `.wp-compose-btn`, `.detail-mood-add`, `.swipe-btn` to 0.4 opacity + `pointer-events: none`.
- **Settings-doc snapshot handler** now calls `applyReadOnlyState()` + `renderGraceBanner()` directly, so flipping `graceUntil` on the server immediately re-evaluates UI state.

## Commits Created

| Hash | Title |
|------|-------|
| `cc077ed` | feat(05-08): claim/graduation flows + post-grace read-only mode (D-14/D-15/D-16) |

**Note on commit atomicity:** The three plan tasks were implemented but the client-side changes (Tasks 2 + 3) touched the same three files (`js/app.js`, `index.html`, `css/app.css`). Splitting those into two surgical commits would have required interactive hunk-level staging with significant overlap risk. Task 1 (Cloud Function) lives in the sibling `C:\Users\nahde\queuenight\` folder which is not under couch's git, so those changes are not captured in couch's commit graph. The orchestrator deploys the CF work separately; the client commit body documents the CF changes for traceability.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocker] Plan calls `showScreen('claim-confirm-screen')` which would fail**

- **Found during:** Task 2 Step D planning
- **Issue:** `showScreen(name)` unconditionally prepends `screen-` and targets `.screen` (tab-level). Passing `claim-confirm-screen` would look for `#screen-claim-confirm-screen` (doesn't exist) and also fight with the Tonight screen's `.active` state.
- **Fix:** Gave the claim-confirm DOM class `wrap has-leather` (mirrors sign-in screens' style), hides all four pre-auth screens + app-shell and un-hides `#claim-confirm-screen` directly. `declineClaim()` and post-success path both hide it and route through `routeAfterAuth()` / `switchToGroup()`.
- **Files modified:** `index.html` (markup), `js/app.js` (showClaimConfirmScreen, confirmClaim, declineClaim).

**2. [Rule 2 — Critical] Added `graduatedAt` stamp in claimMember CF**

- **Found during:** Task 2 Step E
- **Issue:** Plan Step E calls for `updateData.graduatedAt = Date.now()` on graduation redemption for the D-16 timeline. `claimMember.js` already cleared `managedBy` but did not yet stamp `graduatedAt`.
- **Fix:** Added `memberUpdate.graduatedAt = claimedAt` inside the existing `if (type === 'graduation')` branch (reusing the already-computed `claimedAt` for consistency with `claimedAt` on the member doc).
- **Files modified:** `C:\Users\nahde\queuenight\functions\src\claimMember.js`.

**3. [Rule 2 — Critical] Added max-batch cap + pre-validation in mintClaimTokens**

- **Found during:** Task 1 implementation
- **Issue:** Plan sketch loops `for (const mid of memberIds)` without a cap — a malformed client could mint arbitrary thousands of tokens in one call. Also threw on bad ids mid-loop, which would leave a partial batch semantically (batch was built but not committed — OK, but better to fail fast).
- **Fix:** `MAX_MEMBER_IDS_PER_CALL = 100`; pre-read+validate all members in `Promise.all` before any writes are staged; single atomic `batch.commit()`.
- **Files modified:** `C:\Users\nahde\queuenight\functions\src\mintClaimTokens.js`.

## Authentication Gates

None — no CF deployment or auth-step involvement was required in-plan. The plan's prompt explicitly states the orchestrator handles `firebase deploy --only functions:mintClaimTokens` and the `queuenight/public/` sync after executor return.

## Known Stubs / TODO (orchestrator)

No `TODO (orchestrator)` comments were left in code.

Plan 06's `showInviteRedeemScreen` stub was intentionally **preserved** — it's explicitly out of scope for Plan 5.8 (per the `<interfaces>` contract in the plan, which only asks 5.8 to fill in `showClaimConfirmScreen`). The stub still toasts and routes cleanly.

## Verification Status

**Syntax checks (node --check):**

```
C:/Users/nahde/claude-projects/couch  node --check js/app.js                         → OK
C:/Users/nahde/queuenight            node --check functions/src/mintClaimTokens.js  → OK
C:/Users/nahde/queuenight            node --check functions/src/claimMember.js      → OK
C:/Users/nahde/queuenight            node --check functions/index.js                → OK
```

**Plan-defined automated verify:**

- Task 1 (`randomBytes(32)` + `permission-denied` + `batch.set` + `mintClaimTokens` in index.js): PASS
- Task 2 (`mintClaimForMember` + `mintAllMigrationClaims` + `confirmClaim` + `declineClaim` + `sendGraduationLink` + `httpsCallable(functions, 'mintClaimTokens')` + `httpsCallable(functions, 'claimMember')` + `renderClaimMembersPanel` + `renderGraceBanner` + `id="claim-confirm-screen"` in index.html + `graduatedAt` in claimMember.js): PASS
- Task 3 (`function isReadOnlyForMember` + `function isCurrentSelfReadOnly` + `applyReadOnlyState` + `showClaimPromptBanner` + `is-readonly` in css + `id="claim-prompt-banner"` in index.html): PASS

**Live runtime test (pending orchestrator deploy):**

The full end-to-end tests — owner minting links, recipient redeeming on a fresh device, sub-profile graduation with `managedBy` clearance, and grace-expiry read-only transition — all require `firebase deploy --only functions:mintClaimTokens` + `firebase deploy --only hosting` after sync to `queuenight/public/`. These are orchestrator responsibilities per the plan prompt.

## Threat Register Compliance

- **T-05-08-01 (token replay):** claimMember's existing `runTransaction` on `consumedAt` handles this — unchanged by 5.8.
- **T-05-08-02 (fake URL spoof):** 256-bit random tokens + server-only rules + CF existence+consumedAt+expiresAt check. PASS.
- **T-05-08-03 (unauthorised graduation):** `mdata.managedBy !== uid` check per member in mintClaimTokens. PASS.
- **T-05-08-04 (unauthorised migration):** `fam.data().ownerUid === uid` check in mintClaimTokens. PASS.
- **T-05-08-05 (leak):** accepted — 30-day TTL limits exposure.
- **T-05-08-06 (DevTools bypass):** client UI is UX only; Firestore rules (Plan 04 `request.resource.data.actingUid` check) are the real gate. PASS.
- **T-05-08-07 (banner spam):** single non-blocking banner + session dismiss. PASS.
- **T-05-08-08 (repudiation):** claimedAt + consumedBy stamped on both member doc and token doc (unchanged). PASS.

## Self-Check: PASSED

- `js/app.js`: all new functions grep-found (FOUND)
- `index.html`: `#claim-confirm-screen`, `#claim-prompt-banner`, `#settings-claim-list`, `#settings-grace-banner` all present (FOUND)
- `css/app.css`: `.claim-row`, `.grace-banner`, `.claim-prompt-banner`, `body.is-readonly` all present (FOUND)
- `queuenight/functions/src/mintClaimTokens.js`: file exists with randomBytes(32), batch.set, migration+graduation auth gates (FOUND)
- `queuenight/functions/src/claimMember.js`: `graduatedAt` stamp present (FOUND)
- `queuenight/functions/index.js`: `exports.mintClaimTokens = require('./src/mintClaimTokens')...` wired (FOUND)
- Commit `cc077ed`: FOUND in git log
