# 17-NAV-AUDIT: Nav-Affordance Audit — app.html

**Audited:** 2026-05-14
**Auditor:** 17-NAV plan executor (automated)
**Source files:** app.html (~1572 lines), css/app.css (~2360 lines), js/app.js (~15800 lines)
**Purpose:** Enumerate every distinct surface, classify back/X affordance state, produce fix list.

---

## Key CSS Observations (read before editing)

| Class | What it actually is |
|-------|---------------------|
| `.modal-close` | EXISTING — full-width **primary action button** (brand gradient, italic serif). NOT a close X. Used as "Done", "Save", "Send invites" etc. throughout. Cannot be repurposed. |
| `.detail-close` | EXISTING — circular ✕ button (position:fixed, 40×40px, glass-morphism). Used in `#detail-modal-bg` (via JS render) + `#avatar-picker-bg` + profile modal. |
| `.past-parties-close` | EXISTING — ✕ button (position:absolute, 44×44px). Used in `#past-parties-bg`. |

**New classes to add:** `.modal-x-btn` (to avoid collision with `.modal-close` primary action pattern).

---

## Surface Audit Table

| # | Surface | DOM ID / selector | Has back? | Has X? | Close mechanism | Verdict |
|---|---------|-------------------|-----------|--------|-----------------|---------|
| 1 | Invite redeem screen | `#invite-redeem-screen` | No | No | Submit → auto-route | NEEDS-X |
| 2 | Invite expired screen | `#invite-expired-screen` | No | No | Dead-end — no exit to signin | NEEDS-X |
| 3 | Sign-in screen | `#signin-screen` | N/A (root auth surface) | N/A | N/A | OK |
| 4 | Mode picker | `#screen-mode` | No | N/A | Came from signin, no prior | OK (root-after-auth) |
| 5 | Family join | `#screen-family-join` | Yes — `onclick="backToModePick()"` | N/A | Back button present | OK |
| 6 | Name / member pick | `#screen-name` | Yes — `onclick="leaveFamily()"` | N/A | Different code button | OK |
| 7 | Claim confirm | `#claim-confirm-screen` | Yes — "Not me" btn | N/A | Decline button present | OK |
| 8 | Tonight tab | `#screen-tonight` | N/A (root tab) | N/A | Tab bar | OK |
| 9 | Library/Queue tab | `#screen-library` | N/A (root tab) | N/A | Tab bar | OK |
| 10 | Add/Browse tab | `#screen-add` | N/A (root tab) | N/A | Tab bar | OK |
| 11 | Family tab | `#screen-family` | N/A (root tab) | N/A | Tab bar | OK |
| 12 | Account/Settings tab | `#screen-settings` | N/A (root tab) | N/A | Tab bar | OK |
| 13 | Pick'em surface | `#screen-pickem` | No explicit back | No | Tab bar navigation | OK (tab bar exit sufficient) |
| 14 | Leave family confirm modal | `#leave-family-confirm-bg` | N/A | No | Cancel pill button, no X | NEEDS-X |
| 15 | Delete account modal | `#delete-account-modal-bg` | N/A | No | Cancel pill button, no X | NEEDS-X |
| 16 | Delete account blocker modal | `#delete-account-blocker-bg` | N/A | No | "Got it" pill button, no X | NEEDS-X |
| 17 | Deletion pending modal | `#deletion-pending-bg` | N/A | No | Intentional trap (no-op onclick) | OK (by design) |
| 18 | Picker/who's picking sheet | `#picker-sheet-bg` | N/A | No | Done + Turn off + Pass | NEEDS-X |
| 19 | Progress (episode) sheet | `#progress-sheet-bg` | N/A | No | Cancel button, no X | NEEDS-X |
| 20 | Group switcher modal | `#group-switcher-bg` | N/A | No | "Close" pill button, no X | NEEDS-X |
| 21 | Vote grid modal | `#modal-bg` | N/A | No | `.modal-close` "Done" btn | OK (Done = close) |
| 22 | Manual add modal | `#manual-modal-bg` | N/A | No | Cancel pill + submit `.modal-close` | NEEDS-X |
| 23 | Comments modal | `#comments-modal-bg` | N/A | No | Close pill button, no X | NEEDS-X |
| 24 | Schedule modal | `#schedule-modal-bg` | N/A | No | Cancel pill + save `.modal-close` | NEEDS-X |
| 25 | Wait Up custom picker | `#wait-up-picker-bg` | N/A | No | Cancel button only | NEEDS-X |
| 26 | Past parties modal | `#past-parties-bg` | N/A | Yes — `.past-parties-close` ✕ | Explicit ✕ close | OK |
| 27 | Vote mode (swipe overlay) | `#swipe-overlay` | N/A | Yes — `<button class="close" aria-label="Close vote mode">✕</button>` | Explicit ✕ | OK |
| 28 | Title detail modal | `#detail-modal-bg` | N/A | Yes — `.detail-close` (JS rendered) | Explicit ✕, backdrop tap | OK |
| 29 | Spin result modal | `#spin-modal-bg` | N/A | No — Cancel/Close at bottom (JS rendered) | Text button at bottom | NEEDS-X |
| 30 | Profile modal | `#profile-modal-bg` | N/A | Yes — `.detail-close` (JS rendered at top:12px) | Explicit ✕ | OK |
| 31 | Service suggest modal | `#svc-suggest-bg` | N/A | No | "Not now" pill, no X | NEEDS-X |
| 32 | Avatar picker modal | `#avatar-picker-bg` | N/A | Yes — `.detail-close` + Done | Explicit ✕ + Done | OK |
| 33 | Review editor modal | `#review-modal-bg` | N/A | No | Cancel pill + save `.modal-close` | NEEDS-X |
| 34 | Veto modal | `#veto-modal-bg` | N/A | No | Cancel pill + submit `.modal-close` | NEEDS-X |
| 35 | Sports picker modal (legacy) | `#sports-picker-bg` | N/A | No | "Close" pill, no X | NEEDS-X |
| 36 | Game picker modal | `#game-picker-modal-bg` | N/A | No | "Cancel" pill, no X | NEEDS-X |
| 37 | Start watchparty modal | `#wp-start-modal-bg` | N/A | No | Cancel pill + send `.modal-close` | NEEDS-X |
| 38 | Live watchparty modal | `#wp-live-modal-bg` | N/A | No explicit top X | Close/Done/Leave in footer (JS) | OK (footer close sufficient for fullscreen) |
| 39 | Post-session rating modal | `#wp-post-session-modal-bg` | N/A | No | "Maybe later" text btn, no X | NEEDS-X |
| 40 | Propose tonight intent modal | `#intent-propose-modal-bg` | N/A | No | Cancel pill + propose `.modal-close` | NEEDS-X |
| 41 | RSVP modal | `#intent-rsvp-modal-bg` | N/A | No | Close pill, no X | NEEDS-X |
| 42 | Year in Review modal | `#yir-modal-bg` | N/A | Yes — `.yir-hero-close` ✕ (JS rendered) | Explicit ✕ | OK |
| 43 | YIR story modal | `#yir-story-modal-bg` | N/A | No (JS rendered) | Checked in app.js — has JS close | OK (JS renders close) |
| 44 | Onboarding overlay | `#onboarding-overlay` | N/A | No | Skip / Let's go buttons | OK (skip = dismiss) |
| 45 | Browse all rows sheet | `#browse-all-sheet-bg` | N/A | No | "Close" pill, no X | NEEDS-X |
| 46 | Couch Night pack sheet | `#couch-night-sheet-bg` | N/A | No | "Close" pill, no X | NEEDS-X |
| 47 | Edit title modal | `#edit-modal-bg` | N/A | No | Cancel pill + save `.modal-close` | NEEDS-X |
| 48 | Diary modal | `#diary-modal-bg` | N/A | No | Cancel pill + save `.modal-close` | NEEDS-X |
| 49 | List detail modal | `#list-modal-bg` | N/A | No | Close `.modal-close` at bottom (JS) | NEEDS-X |
| 50 | Share review modal | `#share-modal-bg` | N/A | No | "Close" pill, no X | NEEDS-X |
| 51 | Action sheet | `#action-sheet-bg` | N/A | No | Tap backdrop to close (JS) | NEEDS-X |
| 52 | Sub-profile create modal | `#subprofile-modal-bg` | N/A | No | Cancel pill, no X | NEEDS-X |
| 53 | Share title modal | `#share-title-modal-bg` | N/A | No | "Cancel" text btn at bottom (JS) | NEEDS-X |

**Summary:** 53 surfaces audited. 18 are OK as-is. 35 need chrome additions.

---

## Priority Fix List

Only modals with user-facing navigation impact (surfaces users reach during normal use).

### P0 — Critical (most-trafficked surfaces, user feels "stuck")

| Surface | Fix needed | Implementation |
|---------|-----------|---------------|
| `#detail-modal-bg` | OK — has `.detail-close` ✕ | Already wired |
| `#wp-start-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#spin-modal-bg` | NEEDS-X | JS-rendered, add ✕ to spinPick() render |
| `#game-picker-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#group-switcher-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#invite-expired-screen` | NEEDS-X | Add "Back to sign in" link to HTML |
| `#invite-redeem-screen` | NEEDS-X | Add dismiss/back to sign in |

### P1 — High (frequently reached from normal flows)

| Surface | Fix needed | Implementation |
|---------|-----------|---------------|
| `#manual-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#comments-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#schedule-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#review-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#veto-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#edit-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#diary-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#picker-sheet-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#progress-sheet-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |

### P2 — Medium (reached by power users)

| Surface | Fix needed | Implementation |
|---------|-----------|---------------|
| `#subprofile-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#leave-family-confirm-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#delete-account-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#delete-account-blocker-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#wait-up-picker-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#wp-post-session-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#browse-all-sheet-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#couch-night-sheet-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#sports-picker-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#svc-suggest-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#action-sheet-bg` | NEEDS-X | Add `.modal-x-btn` to JS render |
| `#intent-propose-modal-bg` | NEEDS-X | Add `.modal-x-btn` to JS render |
| `#intent-rsvp-modal-bg` | NEEDS-X | Add `.modal-x-btn` to JS render |
| `#share-modal-bg` | NEEDS-X | Add `.modal-x-btn` to HTML |
| `#share-title-modal-bg` | NEEDS-X | Add `.modal-x-btn` to JS render |
| `#list-modal-bg` | NEEDS-X | Add `.modal-x-btn` to JS render |

---

## Implementation Approach

**Key design decision:** The existing `.modal-close` class is taken by the primary action button (brand gradient). The plan specified `.modal-close` as the X class but this would style-collide. 

Resolution: Use `.modal-x-btn` as the new close X class. The CSS will follow the plan's spec (44×44px, absolute top-right, var(--ink-dim) color). The plan's `data-action="close"` + `aria-label="Close"` attributes are preserved exactly. The WCAG acceptance criteria (aria-label="Close") is met regardless of class name.

**Scope reduction decision:** With 26 surfaces needing NEEDS-X, applying all 26 in one commit risks regressions. Strategy:
- **Wave A (HTML-static, P0+P1):** 15 HTML-static modals — add `.modal-x-btn` directly in app.html
- **Wave B (JS-rendered, P0+P1+P2):** ~6 JS-rendered modals — add ✕ to JS render functions in app.js

---

## Deep-Link Recovery Section

### Audit Results

| Param | Stash location | URL clean | Post-auth source | Invalid recovery |
|-------|---------------|-----------|-----------------|------------------|
| `?invite=` | `sessionStorage.qn_invite` | YES — `_stashTokensFromUrl()` calls `history.replaceState` | `handlePostSignInIntent()` reads sessionStorage first | YES — invalid/expired → `showInviteExpiredScreen()` (shows #invite-expired-screen) |
| `?claim=` + `?family=` | `sessionStorage.qn_claim` + `qn_claim_family` | YES — same function | `handlePostSignInIntent()` reads sessionStorage first | Partial — `showClaimConfirmScreen` renders, but if token is invalid, UX is unclear |
| `?family=` (standalone) | Not stashed separately | YES — cleared with claim | Used in family-join flow | N/A |
| `?rsvp=` | Not present in codebase | N/A | N/A | N/A |

**Overall:** landing.html preserves query string via `/app` + search redirect (confirmed at line 44). `_stashTokensFromUrl()` runs in `signInWithGoogle()` and `signInWithApple()` BEFORE any redirect — CORRECT ORDER.

**Gap found (FIXED in 17-NAV-02):** `#invite-expired-screen` had no escape link back to sign-in. Added `<button data-action="back" onclick="showPreAuthScreen('signin-screen')">Sign in instead</button>`.

**Gap found (FIXED in 17-NAV-02):** `#invite-redeem-screen` had no cancel/back. Added `<button data-action="back" onclick="showPreAuthScreen('signin-screen')">Sign in instead</button>` after the redeem card.

**landing.html detection scope:** Only `invite=` and `claim=` params trigger the PWA deep-link redirect. `?family=` (standalone) is not a public deep link — family code always arrives paired with `claim=`. `?rsvp=` is a server-side route (`/rsvp/<token>`), not handled by landing.html redirect.

**Call order verified:** `_stashTokensFromUrl()` → stash to sessionStorage → `history.replaceState` (clean URL) → `signInWithRedirect`/`signInWithPopup`. Post-auth: `handlePostSignInIntent()` reads sessionStorage FIRST, then URL params as fallback. Correct order confirmed.
