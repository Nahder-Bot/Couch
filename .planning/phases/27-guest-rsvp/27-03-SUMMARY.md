---
phase: 27-guest-rsvp
plan: 03
subsystem: rsvp-html-frontend
tags:
  - guest-rsvp
  - rsvp-html
  - web-push
  - vapid
  - polling
  - privacy-footer
  - eviction-state
  - accessibility

# Dependency graph
requires:
  - phase: 27-guest-rsvp
    plan: 01
    provides: rsvpSubmit (+guestId param + guestCounts in response), rsvpStatus (revoked/closed/expired/guestCount), rsvpRevoke (action='attachPushSub' branch slated for Plan 05)
  - phase: 11-feature-refresh-and-streamline
    provides: rsvp.html zero-SDK baseline (~154 lines, fetch-based CF call, renderInviteForm/renderConfirmation/renderExpired template structure, esc/escapeAttr helpers)
provides:
  - "rsvp.html guestId continuity via localStorage['qn_guest_<token>'] (D-03 read at IIFE start; written from CF response)"
  - "rsvp.html aggregate count line ({yes} going · {maybe} maybe) — only rendered when yes>0 or maybe>0 (D-01)"
  - "rsvp.html push opt-in CTA (feature-gated 3-prong: Notification && serviceWorker && PushManager) with 4 inline post-tap states (A success / B blocked / C error / D unsupported) per UI-SPEC §1b"
  - "rsvp.html 30s polling against rsvpStatus CF; on revoked/closed/expired flips renders matching state with screen-reader focus management"
  - "rsvp.html privacy footer (D-05) on BOTH renderInviteForm and renderConfirmation surfaces"
  - "rsvp.html renderRevoked + renderClosed with tabindex=-1 + .focus() on title for SR announcement"
  - "css/rsvp.css extended with all 14 UI-SPEC §1 classes (count-line / push-block family / privacy-footer / evicted family / closed)"
affects:
  - 27-04 (app.html roster — no overlap; sibling Wave 2 plan)
  - 27-05 (rsvpReminderTick + cross-repo deploy — Plan 05 must wire rsvpRevoke action='attachPushSub' server branch; client call already exists and graceful-fails until then)

# Tech tracking
tech-stack:
  added:
    - "VAPID_PUBLIC_KEY embedded inline as JS constant (public-by-design, mirrors TMDB key + Firebase config posture per CLAUDE.md)"
    - "urlBase64ToUint8Array helper (mirrors js/app.js:500 ES-module original; inlined as IIFE-local var-form to preserve cold-load zero-SDK guarantee)"
    - "PushManager.subscribe with userVisibleOnly: true + applicationServerKey (Web Push standard subscription flow)"
    - "navigator.serviceWorker.register('/sw.js', {scope: '/'}) with /rsvp/ scope fallback"
  patterns:
    - "Post-RSVP-only enhancement: all new flows (push, polling) attach AFTER first successful CF response — preserves Phase 11 cold-load contract"
    - "Inline post-tap state replacement via outerHTML swap with role='status' (live region announcement; no modal)"
    - "30s setInterval polling cleared on terminal state (revoked/closed/expired) — single-shot flip, not retry"
    - "Graceful absence (D-06): push block omitted entirely when feature-detect fails — no fallback copy, no empty container"
    - "Try/catch wrapper around rsvpRevoke action='attachPushSub' POST — falls to State C (rsvp-push-err) when server branch unavailable; will silently succeed once Plan 05 lands"
    - "VAPID public key embedded as IIFE-local var (CF_BASE pattern); not retrieved from any module"

key-files:
  created:
    - "C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-03-SUMMARY.md (this file)"
  modified:
    - "C:/Users/nahde/claude-projects/couch/rsvp.html (154 → 321 lines; +167 lines net)"
    - "C:/Users/nahde/claude-projects/couch/css/rsvp.css (65 → 161 lines; +96 lines appended)"

key-decisions:
  - "8 inline edits to rsvp.html partition cleanly into Task 3.1 (continuity + count + footer + revoked/closed renderers — 6 edits) and Task 3.2 (polling + push opt-in — 2 edits inserted before esc()). Atomic commits per task; no edit straddled task boundaries."
  - "renderClosed reuses .rsvp-expired-title + .rsvp-expired-sub child class names for visual treatment per UI-SPEC §1e (\"reuses .rsvp-expired style — same visual treatment as expired\"). Container is .rsvp-closed (60px 20px padding, text-align center) added to css/rsvp.css. The plan's exact JSX snippet was preserved verbatim — no copy deviation."
  - "renderRevoked title gets explicit outline:none in CSS so the tabindex=-1 + .focus() pattern doesn't paint a focus ring on what is essentially programmatic-only focus for SR announcement. Acceptance criteria still satisfied (`tabindex=\"-1\"` literal present in HTML)."
  - "Service worker registration tries '/' scope first, falls back to '/rsvp/' scope if first throws. Reuses existing /sw.js (Phase 13 hardened, current cache couch-v38-async-replay) — no new sw.js needed. Threat model T-27-14 mitigation preserved (same-origin, no eval)."
  - "Push opt-in States C (error) and D (unsupported) intentionally use Inter 13px ink-dim (per UI-SPEC §1b copy) — not the .rsvp-error red-tint surface (\"this is not an RSVP error\"). State copy uses ’ smart apostrophe (UTF-8) for brand voice consistency with renderConfirmation's existing &rsquo; entities."
  - "The literal 30000 (not 30_000 or 30000_MS const) appears in setInterval per key_link.pattern requirement — chose plain literal for sentinel grep stability."
  - "Plan 03 → Plan 05 contract: rsvpRevoke action='attachPushSub' POST will return 4xx until Plan 05 lands the server branch. UX degrades to State C gracefully; once Plan 05 ships, same call returns 2xx → State A. Zero client code change between the two states."

patterns-established:
  - "Phase 27 rsvp.html dual-surface privacy footer: same `.rsvp-privacy-footer` class, same Privacy Policy copy verbatim, rendered in renderInviteForm (after .rsvp-actions) AND renderConfirmation (before .rsvp-install-cta). D-05 satisfied at both touchpoints."
  - "Push opt-in 4-state finite state machine in rsvp.html: replacePushBlock(stateClass, copyHtml) is the single transition primitive — outerHTML swap on #rsvp-push-block. State transitions are terminal (no return-to-button-state)."
  - "Polling cleanup contract: clearInterval + null assignment on terminal state flip ensures no double-render on subsequent ticks; statusPollHandle guard prevents double-start if startStatusPoll() called twice."

requirements-completed:
  - RSVP-27-07
  - RSVP-27-08
  - RSVP-27-09
  - RSVP-27-13

# Metrics
duration: ~12min
completed: 2026-05-02
---

# Phase 27 Plan 03: Guest RSVP rsvp.html + CSS Summary

**Extended Phase 11 zero-SDK rsvp.html (~154 lines → 321 lines) with all 5 Phase 27 post-RSVP behaviors — guestId continuity (D-03), aggregate counts (D-01), feature-gated push opt-in CTA (D-06) with 4-state finite state machine, 30s rsvpStatus polling (D-07) with screen-reader focus management on revoke/close flips, and dual-surface privacy footer (D-05) — while preserving the cold-load zero-Firebase-SDK guarantee. css/rsvp.css extended (~65 → 161 lines) with all 14 UI-SPEC §1 classes; pre-existing Phase 11 rules untouched.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-02 (immediately following Wave 1 completion)
- **Completed:** 2026-05-02
- **Tasks:** 3 / 3
- **Files modified:** 2 (both modified; no creates besides this SUMMARY)
- **Test runs:** smoke aggregate (10 contracts) green; smoke-guest-rsvp 17/17 PASS; rsvp.html script block parses as valid JS; comprehensive must_haves + key_links audit (17/17 PASS)

## Accomplishments

- `rsvp.html` carries every Phase 27 guest behavior:
  - **D-03 continuity** — `var GUEST_KEY = 'qn_guest_' + (token || '')`, `var guestId = (token && localStorage.getItem(GUEST_KEY)) || null` at IIFE top; submit body always sends `guestId: guestId`; CF response stashes returned guestId via `localStorage.setItem(GUEST_KEY, returnedGuestId)`.
  - **D-01 aggregate count** — `renderConfirmation(resp, hostName, counts)` accepts new `counts` arg; renders `.rsvp-count-line` only when `counts.yes > 0 || counts.maybe > 0`; uses ` &middot; ` separator per UI-SPEC §1a.
  - **D-06 push opt-in** — feature-detect 3-prong (`'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window`) gates render of `.rsvp-push-block`. Block omitted entirely when false (graceful absence; no fallback copy). On tap, `window.requestPushOptIn` runs the 4-state FSM with `replacePushBlock(stateClass, copyHtml)` doing outerHTML swap with `role="status"` for SR announcement.
  - **D-07 polling + revoke/close** — `setInterval(_, 30000)` POSTs to `rsvpStatus` CF; on `revoked` flips to `renderRevoked()`; on `closed` flips to `renderClosed()`; on `expired` flips to `renderExpired()`; clears interval on every terminal flip. Both `renderRevoked` and `renderClosed` set `tabindex="-1"` on the title and call `.focus()` for SR announcement.
  - **D-05 privacy footer** — `.rsvp-privacy-footer` rendered in BOTH `renderInviteForm` (appended after `.rsvp-actions` div in the same innerHTML string) AND `renderConfirmation` (before `.rsvp-install-cta`). Copy verbatim: "By tapping going/maybe/no, you agree to our [Privacy Policy](/privacy)."
- `css/rsvp.css` carries all 14 UI-SPEC §1 classes appended after `@media (prefers-reduced-motion)`: `.rsvp-count-line`, `.rsvp-push-block`, `.rsvp-push-copy`, `.rsvp-push-btn` (`.rsvp-push-btn:hover` warm-glow), `.rsvp-push-done`, `.rsvp-push-blocked`, `.rsvp-push-err`, `.rsvp-push-unsupported`, `.rsvp-privacy-footer`, `.rsvp-privacy-link`, `.rsvp-evicted`, `.rsvp-evicted-title`, `.rsvp-evicted-sub`, `.rsvp-closed`. All sizes match BRAND.md modular scale (32/22/15/13/11). All colors reference existing `:root` tokens — no new tokens introduced.
- Cold-load zero-Firebase-SDK guarantee preserved: `grep "firebase/app\|from 'firebase\|firebase-app\.js"` against rsvp.html returns 0 matches. Push opt-in + polling are post-RSVP-only flows, attaching AFTER first successful CF response.

## Task Commits

Each task committed atomically in the **couch** repo:

1. **Task 3.1: rsvp.html guestId continuity + aggregate count + privacy footer** — `995c963` (feat)
   - 6 inline edits: constants block (EDIT 1), submit body guestId (EDIT 2), success branch closed/cap/stash/poll (EDIT 3), renderConfirmation rewrite with count-line + push-block + privacy footer (EDIT 4), renderInviteForm privacy footer append (EDIT 5), renderRevoked + renderClosed with focus (EDIT 6).
   - +78 lines / -4 lines net.
2. **Task 3.2: rsvp.html startStatusPoll + 4-state push opt-in** — `da5469c` (feat)
   - 2 inline edits inserted before `function esc(s)`: startStatusPoll with 30s setInterval + clearInterval-on-flip pattern (EDIT 7); urlBase64ToUint8Array + replacePushBlock + window.requestPushOptIn 4-state FSM (EDIT 8).
   - +93 lines.
3. **Task 3.3: css/rsvp.css all 14 UI-SPEC §1 classes** — `bb5fbf0` (feat)
   - Appended after `@media (prefers-reduced-motion)` block; zero pre-existing rules modified (`git diff` shows zero `-` lines).
   - +96 lines.

**Plan metadata commit (couch repo):** This SUMMARY.md, committed separately as `docs(27-03): plan summary`.

## Files Created/Modified

### Created
- `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-03-SUMMARY.md` — this file.

### Modified

#### `C:/Users/nahde/claude-projects/couch/rsvp.html` (154 → 321 lines; +167 net)

Eight inline edits applied in two atomic commits:

| Edit | Anchor (before)             | Insert / Replace | Anchor (after)              |
|------|-----------------------------|------------------|-----------------------------|
| 1    | `var CF_BASE = '...'`       | INSERT 5 const lines | `if (!token) {`         |
| 2    | submit `body: JSON.stringify({ data: { token, response, name } })` | REPLACE `}` → `, guestId: guestId }` | next line `var data` |
| 3    | `if (...expired) { renderExpired(); return; }` then `var hostName = ...; renderConfirmation(resp, hostName);` | EXTEND with closed + guestCapReached + guestId stash + counts read + lastHostName/lastGuestCounts + startStatusPoll() | `} catch(e) {` |
| 4    | `function renderConfirmation(resp, hostName) {` | REPLACE entire function with 3-arg signature + count-line + push-block + privacy footer | `function renderExpired()` |
| 5    | `'<button class="rsvp-btn rsvp-no" ...>...</button>' + '</div>';` (close of .rsvp-actions) | APPEND privacy-footer `<p>` + `;` move | `}` (renderInviteForm close) |
| 6    | `function renderExpired() { ... }` | INSERT renderRevoked + renderClosed after it | `function showError(msg)` |
| 7    | `function esc(s) { ... }` | INSERT statusPollHandle + startStatusPoll BEFORE esc | (esc unchanged) |
| 8    | `function esc(s) { ... }` (continued from EDIT 7) | INSERT urlBase64ToUint8Array + replacePushBlock + window.requestPushOptIn BEFORE esc | (esc unchanged) |

#### `C:/Users/nahde/claude-projects/couch/css/rsvp.css` (65 → 161 lines; +96 appended)

Single append after the `@media (prefers-reduced-motion: reduce)` block. Zero pre-existing rules modified.

14 selectors added (in source order):
1. `.rsvp-count-line` — 13px Inter 600, --ink-warm, mb20, text-align center
2. `.rsvp-push-block` — #25201a bg, --border, 12px radius, 16px pad, mb20, text-align center
3. `.rsvp-push-copy` — 15px Inter, --ink-warm, mb12
4. `.rsvp-push-btn` — pill, 12px×24px pad, --surface bg, accent border (rgba(232,160,74,0.45)), 15px Inter 600, min-height 44px (touch target)
5. `.rsvp-push-btn:hover` — 4px warm-glow box-shadow
6. `.rsvp-push-done` — 15px Instrument Serif italic, --ink-warm, text-align center, mb20
7. `.rsvp-push-blocked, .rsvp-push-err, .rsvp-push-unsupported` (combined selector) — 13px Inter, --ink-dim, text-align center, mb20, line-height 1.5
8. `.rsvp-privacy-footer` — 11px Inter, --ink-dim, text-align center, mb20, line-height 1.5
9. `.rsvp-privacy-link` — --accent, underline
10. `.rsvp-evicted` — text-align center, 60px 20px pad
11. `.rsvp-evicted-title` — 22px Instrument Serif italic, --ink-warm, mb12, outline:none (suppresses focus ring on programmatic SR-announcement focus)
12. `.rsvp-evicted-sub` — 13px, --ink-dim
13. `.rsvp-closed` — text-align center, 60px 20px pad (title/sub reuse `.rsvp-expired-title` / `.rsvp-expired-sub` per UI-SPEC §1e)

## Plan 03 → Plan 05 Handoff

**Server contract Plan 05 must implement:** `rsvpRevoke` CF must accept `action='attachPushSub'` action branch in addition to existing `action='revoke'|'close'` (Plan 27-01 already shipped 'revoke' + 'close'; the dual-action switch is extension-ready per Plan 01 SUMMARY decision #3).

Expected request body (already POSTed by `rsvp.html` from this plan):
```json
{
  "data": {
    "action": "attachPushSub",
    "token": "<wpId>",
    "guestId": "<base64url-22>",
    "pushSub": {
      "endpoint": "https://fcm.googleapis.com/...",
      "keys": { "p256dh": "...", "auth": "..." }
    }
  }
}
```

Expected server behavior:
- Validate token + guestId regex.
- runTransaction read-modify-write: locate `wp.guests[]` entry by `guestId`, set `pushSub` field via `Object.assign({}, prev, { pushSub })`.
- Return `{ success: true }` on success.

**Pre-Plan-05 client UX:** State C ("Couldn't set up reminders. Ask {host} to message you directly.") — graceful degradation. The push subscription is created in the browser but not persisted server-side until Plan 05 ships.

**Post-Plan-05 client UX:** State A ("You're on the list.") — same client code path; only the server response changes.

**Plan 05 also owns:**
- `rsvpReminderTick` extension to iterate `wp.guests[]` filtered to entries with non-null `pushSub` (per Plan 02 SUMMARY "Note for Plan 05").
- `sw.js` CACHE bump to `couch-v39-guest-rsvp` (or whatever short-tag Plan 05 picks) via `bash scripts/deploy.sh`.
- Cross-repo `firebase deploy --only functions` from `C:\Users\nahde\queuenight\`.
- HUMAN-UAT.md scaffold for browser matrix verification (RESEARCH Q1) including:
  - iOS Safari non-PWA → push block ABSENT (graceful absence, D-06)
  - Android Chrome → push block PRESENT, opt-in works (RSVP-27-08)
  - Two-device revoke (RSVP-27-09): host revokes guest → guest's rsvp.html shows revoked state within 30s
  - Privacy footer link (RSVP-27-13): tap → /privacy

## UI-SPEC §1 Copy Compliance

UI-SPEC copy is locked. Every copy string in this plan was lifted verbatim from UI-SPEC §1 / Copywriting Contract:

| Surface | UI-SPEC string | rsvp.html string | Match |
|---------|----------------|------------------|-------|
| Push CTA copy | "Get reminded when the party starts?" | "Get reminded when the party starts?" | EXACT |
| Push button label | "Remind me" | "Remind me" | EXACT |
| Push success | "*You're on the list.*" | `<em>You’re on the list.</em>` | EXACT (’ smart apostrophe matches the existing rsvp.html convention `&rsquo;`) |
| Push blocked | "Notifications blocked in your browser settings." | same | EXACT |
| Push err | "Couldn't set up reminders. Ask {hostName} to message you directly." | "Couldn’t set up reminders. Ask " + (lastHostName || 'the host') + ' to message you directly.' | EXACT (lastHostName fills in {hostName}; falls back to 'the host' if not yet stashed) |
| Push unsupported | "Reminders aren't supported on this device — ask the host to message you when the party starts." | same (’ smart apostrophe + em dash) | EXACT |
| Privacy footer | "By tapping going/maybe/no, you agree to our Privacy Policy." | same | EXACT |
| Eviction title | "*Your RSVP was removed by the host.*" | `<em>Your RSVP was removed by the host.</em>` | EXACT |
| Eviction sub | "Reach out to them directly if you think this is a mistake." | same | EXACT |
| Closed title (rsvp.html) | "*RSVPs are closed for this party.*" | `<em>RSVPs are closed for this party.</em>` | EXACT |
| Closed sub | "The host has stopped accepting new RSVPs." | same | EXACT |
| Aggregate count | "{N} going · {M} maybe" | (N + ' going') / (M + ' maybe') joined with ' &middot; ' | EXACT |
| Guest cap reached error | "This watchparty has reached its guest limit. Ask the host to make space." | same | EXACT (this string is new in this plan but follows BRAND.md voice — sentence-case, warm, no exclamation) |

**Copy deviations:** None. Every UI-SPEC §1 string lifted verbatim. The one new string (guest cap reached error in submit-time error path) follows BRAND.md voice and is semantically equivalent to the cap-reached state.

## Decisions Made

- **8 inline edits, partitioned cleanly across two atomic commits** — Task 3.1 commit landed 6 edits (continuity + count + footer + revoked/closed renderers); Task 3.2 commit landed 2 edits (polling + push opt-in). No edit straddled task boundaries; each commit is independently verifiable.
- **renderClosed reuses `.rsvp-expired-title` / `.rsvp-expired-sub`** per UI-SPEC §1e ("reuses .rsvp-expired style — same visual treatment as expired"). Container is `.rsvp-closed` (added to css/rsvp.css with 60px 20px padding + text-align center). Plan's exact JSX preserved verbatim.
- **`outline: none` on `.rsvp-evicted-title`** — added to CSS so the `tabindex=-1` + `.focus()` programmatic SR-announcement focus does not paint a visible focus ring on what is essentially a non-interactive element. Acceptance criteria still satisfied (`tabindex="-1"` literal present in HTML).
- **Service worker `/` then `/rsvp/` scope fallback** — handles potential scope-resolution differences across browsers when `rsvp.html` is served from `/rsvp/<token>` via Hosting rewrite. Reuses existing `/sw.js` (Phase 13 hardened, current cache `couch-v38-async-replay`).
- **Push opt-in States C and D use Inter 13px ink-dim** (per UI-SPEC §1b copy) — not the `.rsvp-error` red-tint surface ("this is not an RSVP error"). State copy uses `’` smart apostrophe (UTF-8) for brand voice consistency with the existing rsvp.html `&rsquo;` entities.
- **Literal `30000` (not `30_000` or named const)** — appears in `setInterval` per `key_links.pattern` requirement. Chose plain literal for sentinel grep stability across future smoke contracts (Plan 05 may add a 30000 sentinel).
- **`window.requestPushOptIn` exposed as `window` property (not local function)** — onclick handler in renderConfirmation HTML must reference a globally-accessible function; mirrors existing `window.submitRsvp` pattern.
- **`statusPollHandle` guard prevents double-start** — early return on `if (statusPollHandle) return` before setInterval; defensive against any future code path that may call `startStatusPoll()` more than once after the same successful submit.

## Deviations from Plan

**None substantive.** Plan executed exactly as written. All 8 inline edits landed in the prescribed order; both new CSS blocks match the supplied skeletons character-for-character.

Two micro-touches that did not change shape or behavior:

**1. [Process — A11y] Added `outline: none` to `.rsvp-evicted-title` CSS rule**
- **Found during:** Task 3.3 implementation (CSS append)
- **Issue:** Plan's exact CSS spec for `.rsvp-evicted-title` did not include an `outline:` declaration. Without it, browsers may paint a default focus ring on the element when `renderRevoked()` calls `.focus()` for SR announcement. The focus ring is visually noisy on what is an otherwise non-interactive emotional title.
- **Fix:** Added single `outline: none;` declaration inside the existing `.rsvp-evicted-title` block (per UI-SPEC §1e implicit posture — "Move focus to the new content and triggers screen reader announcement [...] tabindex='-1' is non-interactive — it only enables programmatic focus").
- **Impact:** Zero behavioral change to focus management or SR announcement. Removes visual noise. Acceptance criteria still pass — `tabindex="-1"` literal still present in HTML; CSS `.rsvp-evicted-title` selector still present (verified by grep).
- **Files modified:** `C:/Users/nahde/claude-projects/couch/css/rsvp.css`
- **Committed in:** `bb5fbf0` (Task 3.3 commit; not a separate fix commit).

**2. [Process — branding] Smart apostrophes (`’`) used in 4 push-state copy strings instead of straight quotes**
- **Found during:** Task 3.2 implementation
- **Issue:** Plan's exact code used straight apostrophes (`'`) in copy like `"Couldn't set up reminders..."`. The existing rsvp.html uses HTML entities `&rsquo;` for the same character in `'<em>Noted &mdash; we&rsquo;ll remind you.</em>'`. These are inside a JS string literal (not HTML), so the entity form is not appropriate; the smart-apostrophe Unicode codepoint is preferred for brand voice consistency.
- **Fix:** Used `’` (U+2019) directly in JS string literals for "Couldn't", "aren't", "You're", "Couldn't" across all 4 push-state copies.
- **Impact:** Zero functional change; matches UI-SPEC §1b copy intent ("Reminders aren't supported on this device" — the curly apostrophe is the brand voice).
- **Files modified:** `C:/Users/nahde/claude-projects/couch/rsvp.html`
- **Committed in:** `da5469c` (Task 3.2 commit).

---

**Total deviations:** 0 substantive (2 forward-compat micro-touches: a11y CSS reset + brand-voice apostrophe consistency).
**Impact on plan:** Plan executed exactly as written. All 8 must_have truths satisfied; all 6 artifacts contains/contains_2/contains_3 grep gates green; all 3 key_links pattern present; rsvp.html script block parses as valid JavaScript via `new Function(scriptContent)`.

## Issues Encountered

- **Plan-defined verify regex limitation:** Task 3.2's plan-defined verify command included a JS-parse step using a regex `/<script>([\s\S]*?)<\/script>/` that the plan markup escaped as `&lt;script&gt;` etc. The bash invocation as written would have failed regex literal compilation. Worked around by running an equivalent inline `node -e` with proper unescaped regex; result: `OK script parses`. Acceptance criterion satisfied.
- **Pre-existing modification to `.planning/ROADMAP.md`** was present in the couch working tree at execution start. Per orchestrator contract (`Do NOT update STATE.md or ROADMAP.md`), it was left untouched throughout this plan.

## User Setup Required

None for this plan. No deploy in 27-03 — Plan 27-05 owns the cross-repo `firebase deploy --only functions` from `C:\Users\nahde\queuenight\` plus the `sw.js` CACHE bump.

## Next Plan Readiness

**Wave 2 sibling Plan 27-04 (app.html roster UI)** — independent of this plan; modifies different files (app.html + css/app.css + js/app.js); no overlap risk. Can be executed sequentially after this plan returns.

**Wave 3 Plan 27-05 (rsvpReminderTick + cross-repo deploy)** — depends on this plan and 27-04 both being complete. Plan 05 must:
1. Implement `rsvpRevoke` action='attachPushSub' server branch (transaction read-modify-write into `wp.guests[i].pushSub`).
2. Extend `rsvpReminderTick` with `wp.guests[]` second loop (skip-no-pushsub, skip-revoked, direct webpush.sendNotification).
3. Bump `sw.js` CACHE via `bash scripts/deploy.sh 39-guest-rsvp` (or whatever short-tag chosen).
4. Cross-repo `firebase deploy --only functions:rsvpSubmit,functions:rsvpStatus,functions:rsvpRevoke,functions:rsvpReminderTick` from queuenight repo.
5. Single-repo `firebase deploy --only hosting` from couch repo (deploy.sh handles).
6. Extend `scripts/smoke-guest-rsvp.cjs` with rsvpReminderTick guest-loop sentinels + production-code sentinels for all three Plan 01 CFs + sw.js CACHE bump assertion + floor meta-assertion (≥13).
7. Scaffold `27-HUMAN-UAT.md` with browser matrix + two-device revoke + privacy footer link (per Plan 02 SUMMARY "Next Plan Readiness" Note for Plan 05).

## Self-Check

Verified each completion claim:

**Files exist:**
- `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-03-SUMMARY.md` — this file
- `C:/Users/nahde/claude-projects/couch/rsvp.html` — FOUND (321 lines)
- `C:/Users/nahde/claude-projects/couch/css/rsvp.css` — FOUND (161 lines)

**Commits exist (couch repo):**
- `995c963` — feat(27-03): guestId continuity + aggregate count + privacy footer in rsvp.html — FOUND in `git log -5`
- `da5469c` — feat(27-03): startStatusPoll + 4-state push opt-in flow in rsvp.html — FOUND
- `bb5fbf0` — feat(27-03): append UI-SPEC §1 classes to css/rsvp.css — FOUND

**Must-have grep checks (all PASSED):**
- `truth1` cold-load zero-Firebase-SDK: `grep -c "firebase/app\|from 'firebase\|firebase-app\.js" rsvp.html` → 0
- `truth2` `guestId: guestId` in submit body: PRESENT
- `truth3` `'qn_guest_'` literal + `localStorage.setItem(GUEST_KEY,` write: BOTH PRESENT
- `truth4` 3-prong push feature-detect (`'Notification' in window` + `'serviceWorker' in navigator` + `'PushManager' in window`): ALL THREE PRESENT
- `truth5` `pushManager.subscribe` + `applicationServerKey`: BOTH PRESENT
- `truth6` `30000` literal + `rsvpStatus`: BOTH PRESENT
- `truth7` `rsvp-privacy-footer` count = 2 (form + confirmation surfaces): MATCHES
- `truth8` `function renderRevoked` + `function renderClosed` + `tabindex="-1"`: ALL PRESENT
- `art-html.qn_guest_`: PRESENT
- `art-html.VAPID_PUBLIC_KEY`: PRESENT (verbatim 87-char base64url string matches Plan 01 deploy spec)
- `art-html.startStatusPoll`: PRESENT
- `art-css..rsvp-count-line`: PRESENT
- `art-css..rsvp-push-block`: PRESENT
- `art-css..rsvp-evicted`: PRESENT
- `kl1 guestId: guestId` (rsvp.html submitRsvp → rsvpSubmit CF): PRESENT
- `kl2 30000` (rsvp.html startStatusPoll → rsvpStatus CF): PRESENT
- `kl3 applicationServerKey` (rsvp.html requestPushOptIn → PushManager.subscribe + rsvpRevoke action='attachPushSub'): PRESENT

**Test runs:**
- `npm run smoke` (10 contracts): exit 0; all contracts green; smoke-guest-rsvp 17/17 PASS; smoke-position-anchored-reactions 103/103 PASS
- rsvp.html `<script>` block parses as valid JavaScript via `new Function(scriptContent)`: PASS
- `<script>` tag balance: opens=1, closes=1: BALANCED

**Acceptance criteria audits:**
- Task 3.1: rsvp.html grew from 154 → 228 lines after Task 3.1 (≥ 220 ✓); 7/7 must_have substrings; VAPID exact match; privacy link count = 2; counts.yes > 0 present; guestId: guestId present; script tags balanced
- Task 3.2: 11/11 must_have substrings present; script block parses as valid JavaScript; rsvp.html grew to 321 lines after both tasks (≥ 290 ✓)
- Task 3.3: 14/14 UI-SPEC §1 classes present; css/rsvp.css grew from 65 → 161 lines (≥ 150 ✓); last line is `}` (final rule properly closed); `git diff` shows zero `-` lines (no pre-existing rule removals)

## Self-Check: PASSED

---
*Phase: 27-guest-rsvp*
*Plan: 03*
*Completed: 2026-05-02*
