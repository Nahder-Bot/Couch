# Phase 30 — Hotfix Wave 3 Frontend Summary

**Date:** 2026-05-03
**Branch:** `hotfix/phase-30-cross-cutting-wave`
**Scope:** Cross-AI peer review (Codex + Gemini) frontend findings against `js/app.js`
**Smoke status:** 13 contracts, all passing

## Findings addressed

| ID      | Severity | Status     | Commit    | Files                |
| ------- | -------- | ---------- | --------- | -------------------- |
| CDX-6   | High     | Fixed      | `9c89282` | `js/app.js`          |
| CDX-7   | High     | Fixed      | `781ee68` | `js/app.js`          |
| G-P0-1  | P0       | Fixed      | `982e23f` | `js/app.js`          |
| G-P1-1  | P1       | Fixed      | `57d1f33` | `js/app.js`          |
| G-P1-2  | P1       | Deferred   | —         | (out of scope)       |
| G-P1-4  | P1       | Fixed      | `bdb0f3d` | `js/app.js`          |

5 fixes committed. 1 deferred with rationale.

---

## CDX-6 — Sign-out doesn't clear watchpartyTick + traktHeartbeat intervals

**Commit:** `9c89282 fix(auth): clear watchpartyTick + traktHeartbeat intervals on sign-out (CDX-6)`

**Issue:** The Wave 1 hotfix (`fa16e68`) added watchparty / session / group subscription teardown to the `onAuthStateChangedCouch(null)` cleanup branch, but missed two recurring intervals that `startSync()` reassigns:

- `state.watchpartyTick` — 1-second interval (set at ~4996) that fires `maybeFlipScheduledParties`, `renderWatchpartyBanner`, `maybeNotifyWatchparties`, and live-modal updates
- `state._traktHeartbeat` — 15-minute interval (set at ~5206) that calls `trakt.sync()` when tab is foregrounded

Both kept firing on the pre-auth screen until a fresh sign-in clobbered them via reassignment. Worst case: signed-out + Trakt-connected user sat on the sign-in screen burning Trakt API budget every 15 min, plus a 1Hz tick over zero watchparties.

**Fix:** Append both teardowns to the sign-out branch right after the `unsubLists`/`unsubActivity` block:

```js
if (state.watchpartyTick) { try { clearInterval(state.watchpartyTick); } catch(e){} state.watchpartyTick = null; }
if (state._traktHeartbeat) { try { clearInterval(state._traktHeartbeat); } catch(e){} state._traktHeartbeat = null; }
```

Variable shape inspection: both are on `state.` (not module-scoped), confirmed by the assignment sites at lines 4996 and 5207.

**Verification:** `node --check js/app.js` passes. `smoke-app-parse` confirms ES module parse contract.

---

## CDX-7 — Non-host clients spam denied status:'active' writes

**Commit:** `781ee68 fix(phase-30): maybeFlipScheduledParties host-only gate prevents permission-denied spam (CDX-7)`

**Issue:** After CR-06 hardened firestore.rules Path B (status writes are host-only via `hasOnly` allowlist + host check), the 1-second `watchpartyTick` calls `maybeFlipScheduledParties(state.watchparties)` for **every** signed-in client. Each non-host client's tick attempts the `status: 'active'` write, which the rule now denies. Result: every member of a watchparty fires a `PERMISSION_DENIED` write at 1Hz from `startAt` until the host's flip lands (or the CF safety net fires later).

**Fix:** Add a host-only gate at the top of the per-watchparty loop in `maybeFlipScheduledParties`, mirroring the Phase 30 / MED-3 host-only archive flip pattern at line 4967:

```js
for (const wp of parties) {
  if (wp.status !== 'scheduled') continue;
  if ((wp.startAt || 0) > now) continue;
  if ((now - (wp.startAt || 0)) > 6 * 60 * 60 * 1000) continue;
  // CDX-7 — host-only gate
  if (!state.me || wp.hostId !== state.me.id) continue;
  // ... existing getDoc + updateDoc logic ...
}
```

Non-host clients now passively observe the flip via the next snapshot — same UX, zero permission-denied noise. The CF safety net at deploy-mirror still covers the no-online-host edge case.

**Verification:** `node --check js/app.js` passes. `smoke-couch-groups` 62/62 passing (covers Phase 30 wp invariants).

---

## G-P0-1 — Recaptcha SDK error message could leak to UI

**Commit:** `982e23f fix(auth): sanitize Firebase Auth SDK errors before surfacing to toast (G-P0-1)`

**Issue:** Gemini flagged the risk that raw Firebase Auth SDK strings (e.g. "RecaptchaVerifier must bind to a CLICKABLE element", "auth/argument-error: ...") could surface to UI via toasts that pass `e.message` straight through. Audit of the four signin handlers (Google, Email, Phone-send, Phone-verify) showed they currently use generic catch toasts ("Couldn't start Google sign-in", "Couldn't send code", etc.) — so the leak is theoretical on current code, but:

1. Generic toasts hide actionable info (e.g. "too-many-requests" vs "invalid-phone-number" — different user remedies)
2. A future regression that passes `e.message` to flashToast would leak SDK strings
3. The auth.js init catch (line 99) only console.errors the RecaptchaVerifier failure; if `signInWithPhoneNumber` itself throws the SDK clickable-element error, it propagates up

**Fix:** Add `authErrorToast(e, fallback)` helper that maps known Firebase Auth error codes to brand-voice copy:

| Code | Copy |
| --- | --- |
| `auth/invalid-phone-number` | "That phone number doesn't look right — try again." |
| `auth/missing-phone-number` | "Add your phone number to send a code." |
| `auth/too-many-requests` | "Too many tries. Take a breath, then try again in a minute." |
| `auth/code-expired` | "That code expired. Tap to send a fresh one." |
| `auth/invalid-verification-code` | "Hmm, that code didn't match. Try again." |
| `auth/invalid-verification-id` | "That session expired — request a fresh code." |
| `auth/network-request-failed` | "Connection trouble. Check your wifi and try again." |
| `auth/popup-blocked` | "Your browser blocked the sign-in window. Try again?" |
| `auth/cancelled-popup-request` | "Sign-in cancelled. Try again?" |
| `auth/user-disabled` | "This account is disabled. Reach out to support." |
| `auth/operation-not-allowed` | "That sign-in method is disabled right now." |
| `auth/invalid-email` | "That email doesn't look right — try again." |
| `auth/quota-exceeded` | "SMS quota hit for now. Try again in a bit." |
| (unmapped or no code) | caller-supplied `fallback` || "Sign-in hit a snag — give it another shot." |

Helper `flashToast`s only curated map values or the caller's fallback — **never** `e.message`. Wired into all four signin handlers (`handleSigninGoogle`, `handleSigninEmail`, `handleSigninPhoneSend`, `handleSigninPhoneVerify`).

**Verification:** `node --check js/app.js` passes. Defense-in-depth — even if a future caller drops in `flashToast(e.message)`, the hardened helper makes that the wrong path.

---

## G-P1-1 — Robotic error toasts

**Commit:** `57d1f33 fix(copy): warmer error toasts — Counter chain full / Sign in first / Name required (G-P1-1)`

**Issue:** Brand voice is "warm · cinematic · lived-in. Restraint is the principle." Three error strings read as flat system alerts.

**Fix:** Soften copy across 8 call sites:

| Original | New | Sites |
| --- | --- | --- |
| `'Counter chain full'` | `"Whoa, slow down — that's a lot of taps."` | 1 (line 2630) |
| `'Counter chain full — pick from current options'` | `"Whoa, slow down — pick from the current options."` | 1 (line 17861→17899) |
| `'Sign in first'` (flashToast) | `'Sign in to do that.'` | 3 (lines 4102, 4157, 4604) |
| `'Sign in first.'` (alert) | `'Sign in to do that.'` | 2 (lines 7377, 15317) |
| `'Name required'` (sub-profile create) | `'We need a name to put on the couch.'` | 1 (line 4116) |

**Out of scope:** `alert('Name required.')` at line 10226 is in the edit-title (movie title) flow, not a person-on-the-couch context. The "We need a name to put on the couch" copy doesn't fit there. Left as-is.

**Verification:** `node --check js/app.js` passes. `grep` confirms zero remaining occurrences of the three original strings in app.js.

---

## G-P1-2 — Service filter elevation — DEFERRED

**Status:** Deferred. No commit.

**Issue:** Gemini reported that the "Only what I can watch" toggle is "buried inside the Mood filter menu" and should be promoted to a primary chip on the Tonight tab.

**Investigation:**
- `app.html:353-356` shows the toggle (`#t-limit-toggle`, `#t-limit-checkbox`, `<span>Only what I can watch</span>`) is **already** a sibling of the Mood toggle button inside `.t-filters`, not nested inside `#t-filter-body` (which holds the mood picker).
- Structure (app.html:348-364):
  ```
  .t-filters
    .t-filter-toggle  (Mood button)       <-- collapses .t-filter-body
    .t-paid-toggle#t-limit-toggle  (Only what I can watch)   <-- ALWAYS VISIBLE
    .t-paid-toggle#t-paid-toggle   (+ Rent / Buy)
    .t-filter-body  (mood picker, hidden by default)
  ```
- The "Only what I can watch" checkbox is **already elevated** to the same level as the Mood toggle; it's not buried.

**Conclusion:** Gemini's review appears to have misread the DOM structure. The toggle is already at the level Gemini recommended. Any further structural elevation (e.g., chip-strip styling, moving above the strip) would require app.html and css/app.css changes — both explicitly out of scope for this agent (parallel agents own those surfaces). **Deferred with this rationale.**

**Recommendation for human follow-up:** If this finding is still felt to be valid after looking at the live UI, the user-facing complaint is likely visual hierarchy (the checkbox visually reads as secondary to the Mood button) rather than DOM nesting. That's a CSS/styling question for the parallel CSS agent's territory.

---

## G-P1-4 — Guest redemption warmth

**Commit:** `bdb0f3d fix(copy): guest redemption invokes brand voice (G-P1-4)`

**Issue:** The success toast on `submitGuestRedeem` was a flat `'Welcome to the couch'`. Brand voice asks for warmth.

**Fix:** Soften to "Pull up a seat, {firstName}. The couch is waiting." — short, evocative, on-voice. Falls back to "Pull up a seat. The couch is waiting." when memberName is missing.

```js
const _guestFirst = String(d.memberName || guestName || '').split(/\s+/)[0];
flashToast(_guestFirst ? `Pull up a seat, ${_guestFirst}. The couch is waiting.` : 'Pull up a seat. The couch is waiting.', { kind: 'success' });
```

**Why not `{ownerName}` per the suggested template?** The unauth invite preview intentionally does NOT surface the family/owner name (T-09-07b-02 hardening — prevents harvesting family names via invite token enumeration). The data isn't available client-side at this point in the flow. We lean on the data we DO have (the guest's own name from the `consumeGuestInvite` response).

**Out of scope — rsvp.html:** A separate guest redemption surface lives in `rsvp.html` (Phase 27 guest RSVP). Per fix instructions, that file is owned by a parallel agent. Recommended follow-up for that agent: mirror this voice ("Pull up a seat, {name}. The couch is waiting.") in `rsvp.html` for consistency across both redemption surfaces.

**Verification:** `node --check js/app.js` passes. `smoke-guest-rsvp` 47/47 passing (covers Phase 27 helper contracts).

---

## Smoke results

```
smoke-position-transform     — passed
smoke-tonight-matches        — passed
smoke-availability           — passed
smoke-kid-mode               — passed
smoke-decision-explanation   — passed
smoke-conflict-aware-empty   — passed
smoke-sports-feed            — passed
smoke-native-video-player    — passed
smoke-position-anchored-reactions — passed
smoke-guest-rsvp             — 47 passed, 0 failed
smoke-pickem                 — 26 passed, 0 failed
smoke-couch-groups           — 62 passed, 0 failed
smoke-app-parse              — 11 passed, 0 failed
```

13 contracts, 0 regressions.

---

## Files modified

- `js/app.js` — 5 fixes across CDX-6, CDX-7, G-P0-1, G-P1-1, G-P1-4

## Files NOT touched (per scope guard)

- `firestore.rules` — parallel rules agent
- `app.html` — parallel HTML agent (already shows uncommitted modifications from that agent)
- `css/app.css` — parallel CSS agent
- `js/auth.js` — no changes needed; the leak vector is in caller catch blocks (app.js), not in auth.js itself which already console.errors without toasting
- `sw.js` — deploy script auto-bumps CACHE
- `rsvp.html` — parallel agent territory; voice mirror documented in G-P1-4 follow-up note
- `tests/rules.test.js` — parallel rules test agent

## Follow-ups for human / next wave

1. **G-P1-2 service-filter visual hierarchy:** if user still feels the toggle is under-emphasized, that's a CSS sizing/weight question for the CSS agent — not a DOM-nesting question.
2. **rsvp.html voice mirror:** add the same "Pull up a seat, {name}. The couch is waiting." copy to the rsvp.html redemption success path so both guest surfaces feel consistent.
3. **`alert('Name required.')` at app.js:10226:** consider softening to a flashToast (rather than browser alert) in a future copy pass — the current alert is jarring for an edit-title flow but the right copy is context-specific (it's a movie title, not a person), so deferred from this scope.
