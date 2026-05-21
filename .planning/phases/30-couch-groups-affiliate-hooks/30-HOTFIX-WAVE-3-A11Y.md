# Phase 30 — Hotfix Wave 3 A11Y (G-P0-2)

**Date:** 2026-05-03
**Scope:** `app.html` only (Part 1 — ARIA attributes on every `.modal-bg` element)
**Out of scope (intentionally):** `js/app.js` (parallel agent territory), `css/app.css`, `firestore.rules`, `queuenight` repo, `sw.js`, `tests/`. Focus-trap helper deferred to follow-up (see §3).

## 1. Problem (from G-P0-2)

`app.html` had 39 `<div class="modal-bg" id="...">` elements (verified via `grep -nE 'class="modal-bg"' app.html`), and **none** had `role="dialog"` or `aria-modal="true"` on the outer wrapper. Three modals (`wait-up-picker-bg`, `past-parties-bg`, `svc-suggest-bg`) had the attributes on their **inner** `.modal` surface only — assistive tech still had to infer the dialog boundary from the wrapper, which is the element that actually traps the visual focus.

Two screen-reader symptoms:
1. **No "dialog" announcement** when a modal opens — VoiceOver / TalkBack / NVDA treat the open modal as ordinary in-flow content. User has no audible cue they entered a modal.
2. **No accessible name** for the modal — even when the modal contains a heading, screen readers don't tie the heading to the wrapper, so the dialog announces as "dialog" with no title, or worse, as nothing at all.

## 2. Fix applied

Added `role="dialog"`, `aria-modal="true"`, and either `aria-labelledby="<existing-heading-id>"` or `aria-label="<short label>"` to **all 39** `.modal-bg` wrapper divs.

**Verification queries:**
- `grep -nE 'class="modal-bg"' app.html` → 39 matches (unchanged count)
- Negative lookahead `'class="modal-bg"(?![^>]*role="dialog")'` → **0 matches** (every modal-bg now has role=dialog)
- `npm run smoke` → 100% pass (smoke-app-parse: 11/11; full suite: 0 failures across all 13 smoke scripts)

**Per-modal label-source mapping:**

| # | id | Label strategy | Label source |
|---|---|---|---|
| 1 | `leave-family-confirm-bg` | aria-label | "Leave this group" |
| 2 | `delete-account-modal-bg` | aria-label | "Delete account confirmation" |
| 3 | `delete-account-blocker-bg` | aria-label | "Transfer ownership before deleting account" |
| 4 | `deletion-pending-bg` | aria-label | "Account scheduled for deletion" |
| 5 | `picker-sheet-bg` | aria-label | "Who's picking" |
| 6 | `progress-sheet-bg` | aria-labelledby | `#progress-sheet-title` (existing) |
| 7 | `group-switcher-bg` | aria-label | "Group switcher" |
| 8 | `modal-bg` (vote) | aria-labelledby | `#modal-title` (existing) |
| 9 | `manual-modal-bg` | aria-label | "Add a title" |
| 10 | `comments-modal-bg` | aria-labelledby | `#comments-modal-title` (existing) |
| 11 | `schedule-modal-bg` | aria-labelledby | `#schedule-modal-title` (existing) |
| 12 | `wait-up-picker-bg` | aria-labelledby | `#wait-up-picker-title` (existing — also on inner) |
| 13 | `past-parties-bg` | aria-labelledby | `#past-parties-title` (existing — also on inner) |
| 14 | `detail-modal-bg` | aria-label | "Title details" (content rendered dynamically) |
| 15 | `spin-modal-bg` | aria-label | "Spin to pick" (content dynamic) |
| 16 | `profile-modal-bg` | aria-label | "Member profile" (content dynamic) |
| 17 | `svc-suggest-bg` | aria-labelledby | `#svc-suggest-title` (existing — also on inner) |
| 18 | `avatar-picker-bg` | aria-label | "Choose your avatar" |
| 19 | `review-modal-bg` | aria-labelledby | `#review-modal-title` (existing) |
| 20 | `veto-modal-bg` | aria-label | "Veto for tonight" |
| 21 | `sports-picker-bg` | aria-label | "Pick a game" |
| 22 | `game-picker-modal-bg` | aria-label | "Tonight's game" |
| 23 | `wp-start-modal-bg` | aria-label | "Start a watchparty" |
| 24 | `wp-live-modal-bg` | aria-label | "Live watchparty" (content rendered dynamically) |
| 25 | `wp-post-session-modal-bg` | aria-label | "Rate this watch" |
| 26 | `intent-propose-modal-bg` | aria-label | "Propose tonight at a time" (content dynamic) |
| 27 | `intent-rsvp-modal-bg` | aria-label | "RSVP to tonight" (content dynamic) |
| 28 | `yir-modal-bg` | aria-label | "Year in review" (content dynamic) |
| 29 | `yir-story-modal-bg` | aria-label | "Year in review story" (content dynamic) |
| 30 | `onboard-modal-bg` | aria-label | "Onboarding" (content dynamic) |
| 31 | `share-title-modal-bg` | aria-label | "Share title" (content dynamic) |
| 32 | `edit-modal-bg` | aria-label | "Edit title" |
| 33 | `diary-modal-bg` | aria-labelledby | `#diary-modal-title` (existing) |
| 34 | `list-modal-bg` | aria-label | "List details" (content dynamic) |
| 35 | `share-modal-bg` | aria-label | "Share review" |
| 36 | `action-sheet-bg` | aria-label | "Actions" (content dynamic) |
| 37 | `subprofile-modal-bg` | aria-label | "Add a sub-profile" |
| 38 | `browse-all-sheet-bg` | aria-label | "Browse all rows" |
| 39 | `couch-night-sheet-bg` | aria-labelledby | `#couch-night-sheet-title` (existing) |

**Strategy rationale:**
- **`aria-labelledby` preferred** when the modal has a static heading element with an existing id. Eight modals already had labelled headings (`#modal-title`, `#progress-sheet-title`, `#comments-modal-title`, `#schedule-modal-title`, `#wait-up-picker-title`, `#past-parties-title`, `#svc-suggest-title`, `#review-modal-title`, `#diary-modal-title`, `#couch-night-sheet-title`).
- **`aria-label` used** when the modal heading lacks an id, OR when the modal body is rendered dynamically by JS (no static h3 in the HTML to point at). Adding new ids to existing h3 elements was avoided to keep diff minimal and to dodge any styling/JS selectors that might already key on the absence of an id.

## 3. NOT fixed in this wave (deliberate deferrals)

### 3a. Focus trap — recommended follow-up

The aria attributes alone close the screen-reader-discovery gap (the most critical part of G-P0-2). They do **not** trap keyboard focus inside the modal. A user pressing Tab inside an open modal can still walk focus into the underlying app shell, which (a) confuses screen-reader users about modal boundaries and (b) lets sighted keyboard users interact with elements they can't see.

**Why deferred:** A focus trap requires a small JS helper (~25 lines) attached at modal-open / detached at modal-close. The parallel agent owns `js/app.js`; modifying it concurrently risks merge conflicts. This should land as a separate commit after this wave.

**Recommended pseudo-code (for the follow-up — DO NOT IMPLEMENT IN THIS COMMIT):**

```js
// js/a11y-focus-trap.js (new tiny module — exports two helpers)
const FOCUSABLE = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

let _trap = null;          // { modalEl, prevFocus, keyHandler }

export function trapFocus(modalEl) {
  releaseFocus(); // safety: only one trap active at a time
  const prevFocus = document.activeElement;
  const keyHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusables = modalEl.querySelectorAll(FOCUSABLE);
    if (!focusables.length) { e.preventDefault(); return; }
    const first = focusables[0];
    const last  = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      last.focus(); e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus(); e.preventDefault();
    }
  };
  modalEl.addEventListener('keydown', keyHandler);
  // Move focus into the modal on open
  const firstFocusable = modalEl.querySelector(FOCUSABLE);
  if (firstFocusable) firstFocusable.focus();
  _trap = { modalEl, prevFocus, keyHandler };
}

export function releaseFocus() {
  if (!_trap) return;
  _trap.modalEl.removeEventListener('keydown', _trap.keyHandler);
  if (_trap.prevFocus && typeof _trap.prevFocus.focus === 'function') {
    _trap.prevFocus.focus(); // restore focus to the trigger element
  }
  _trap = null;
}
```

**Wire-up pattern (for follow-up):**
- In every existing `openXxxModal()` / `showSheet()` style helper in `js/app.js`, after toggling the modal visible: `trapFocus(document.getElementById('xxx-modal-bg'))`.
- In every matching `closeXxxModal()`: `releaseFocus()` before hiding.
- Hook `Escape` key to call the close handler (most modals don't have this either — also a follow-up).

**Modals that most need the trap (sighted keyboard users can hit Tab and escape):**
- `wp-live-modal-bg`, `wp-start-modal-bg`, `game-picker-modal-bg`, `sports-picker-bg` — long, form-heavy
- `delete-account-modal-bg`, `leave-family-confirm-bg` — destructive (focus escape lets user confirm with Enter while focus is on the wrong button)
- `manual-modal-bg`, `edit-modal-bg`, `review-modal-bg`, `diary-modal-bg` — text inputs + multi-button footers

### 3b. ARIA precision concern (logged, not blocking)

Per ARIA authoring practice, `role="dialog"` should ideally sit on the **dialog surface itself** (`.modal` inner div), not the backdrop wrapper. The G-P0-2 instruction specified the wrapper, and three modals (`wait-up-picker-bg`, `past-parties-bg`, `svc-suggest-bg`) already had `role="dialog"` + `aria-modal="true"` on the **inner** `.modal` element from earlier work. After this fix, those three have the attributes on **both** wrapper and inner — technically a duplicate dialog announcement, though most screen readers de-dupe nested same-role announcements.

**Mitigation options for follow-up (pick one):**
1. **Move all to inner** (`.modal`), strip from `.modal-bg` wrappers — most ARIA-correct, highest churn.
2. **Strip the inner duplicates** (3 modals) — keeps wrapper as the dialog, minimal churn.
3. **Leave as-is** — works in practice; live with the cosmetic duplication.

Recommendation: option 2 in the same follow-up commit as the focus trap, since both touch modal-open/close concerns.

### 3c. Existing `<div id="onboarding-overlay">` (line 1434)

This is a separate full-viewport overlay (NOT a `.modal-bg` element — different class), and it **already** has `role="dialog"`, `aria-modal="true"`, `aria-labelledby="onboarding-step-title"`. Untouched by this wave. Confirmed correct.

## 4. Files touched

- `app.html` — 39 `.modal-bg` elements modified (one attribute set added per element; no other content changed)

## 5. Files NOT touched (per task scope)

- `js/app.js` — parallel agent territory; focus-trap is a follow-up
- `css/app.css` — no styling changes needed; ARIA does not affect CSS
- `firestore.rules`, `queuenight/`, `sw.js`, `tests/` — out of scope

## 6. Verification

- `grep -nE 'class="modal-bg"' app.html` → 39 matches
- Negative lookahead `class="modal-bg"(?![^>]*role="dialog")` → 0 matches
- `npm run smoke` → all 13 smoke scripts pass, 0 failures (including `smoke-app-parse`)
- Manual diff review: each `.modal-bg` line gained exactly `role="dialog" aria-modal="true"` plus one of `aria-labelledby="..."` or `aria-label="..."`. No surrounding markup altered.

## 7. Commit

`fix(a11y): aria-modal + role=dialog + labelledby on all .modal-bg elements (G-P0-2)`

## 8. Follow-ups (open for next wave)

1. **Focus trap helper** — add `js/a11y-focus-trap.js` (per §3a pseudo-code), wire into every `openXxx()` / `closeXxx()` pair in `js/app.js`, hook Escape key. Highest-priority modals listed in §3a.
2. **ARIA precision cleanup** — strip duplicate `role="dialog"` from inner `.modal` of `wait-up-picker-content`, `past-parties-content`, and the inner `.svc-suggest-modal` (per §3b option 2).
3. **Heading id audit** — the 30+ modals that received `aria-label` could be upgraded to `aria-labelledby` by adding ids to their existing h3 elements. Cosmetic but more semantic.
