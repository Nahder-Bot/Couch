# Phase 30 — Hotfix Wave 5B (frontend polish pass)

**Date:** 2026-05-03
**Scope:** Five frontend improvements deferred from Wave 3 (G-P0-2 keyboard half + Gemini P2 polish items).
**Out of scope (intentionally):** `firestore.rules`, `queuenight` repo, `sw.js` CACHE bump, deploy. Other parallel agents and the verify+deploy step have those.

---

## Summary

| # | Fix | Outcome | Commit |
|---|---|---|---|
| 1 | Modal focus-trap helper (G-P0-2 part 2) | **APPLIED** — helper + 11 wire-up sites across 6 modals | `f2d1f08` |
| 2 | Hero alt text (Gemini P2) | **APPLIED** — landing + 6 surfaces in app.html | `4154a06` |
| 3 | Tagline consistency (Gemini P2) | **DEFERRED** — only 1 user-facing slip found (below the 3+ threshold to fix) | — |
| 4 | Tap-target audit (Gemini P2) | **APPLIED** — `.who-mini-edit` + `.link-btn` lifted to 44px min hit area | `1f65cc3` |
| 5 | iOS PWA Add-to-Home-Screen nudge (Gemini P2) | **APPLIED** — JS helper + CSS, wired into `showApp()` | `08612bf` |

Net: **4 applied, 1 deferred-by-design.** Full `npm run smoke` (13 scripts, 11 + 47 + 26 + 62 + … cases) passes after every commit.

---

## Fix 1 — Modal focus-trap helper (G-P0-2 part 2) — APPLIED

**Commit:** `f2d1f08` — `feat(a11y): keyboard focus trap on high-traffic modals (G-P0-2 part 2)`
**Files:** `js/app.js`

### What was added

Two module-scope helpers near the top of `js/app.js` (lines ~95–150, just before the Phase 19 kid-mode block):

- `activateFocusTrap(modalEl)` — collects focusable descendants, attaches a `keydown` Tab handler that wraps shift+tab from first → last and tab from last → first. Re-queries focusables on each Tab so dynamic modal contents (form fields, lists, late-attached players) stay in scope. Stores `previouslyFocused` (the trigger element) and the handler reference in module-scope `_activeFocusTrap`. Single-trap-at-a-time invariant: opening a second trap deactivates the first defensively. Moves focus into the modal on open via `first.focus()` (try/catch wrapped so a hidden-element focus throw never blocks rendering).
- `deactivateFocusTrap()` — removes the keydown listener, restores focus to `previouslyFocused` (try/catch wrapped), and nulls `_activeFocusTrap`.

### Wired into 6 modals

Per the Wave 3 follow-up list (highest traffic, destructive, form-heavy):

| Modal | Open sites | Close sites |
|---|---|---|
| `wp-live-modal-bg` (watchparty live) | 6 | 1 (`closeWatchpartyLive`) |
| `wp-start-modal-bg` (watchparty create) | 1 (`openWatchpartyStart`) | 2 (`closeWatchpartyStart` + the in-flight close inside the wp-create success path) |
| `comments-modal-bg` (per-title comments) | 1 (`openCommentsModal`) | 1 (`closeCommentsModal`) |
| `leave-family-confirm-bg` (destructive) | 1 (`confirmLeaveFamily`) | 2 (`closeLeaveFamilyConfirm` + `performLeaveFamily`) |
| `delete-account-modal-bg` (destructive) | 1 (`openDeleteAccountConfirm` eligible-branch) | 2 (`closeDeleteAccountModal` + `performDeleteAccount` close path) |
| `delete-account-blocker-bg` (destructive precondition) | 1 (`openDeleteAccountConfirm` ineligible-branch) | 1 (`closeDeleteAccountBlocker`) |

The `wp-live-modal-bg` open paths cover all six places the modal can be raised:
1. Canonical `openWatchpartyLive(wpId, opts)` (the standard entry from any wp pill)
2. `startWatchparty(titleId)` "existing wp" shortcut (when an active wp for the title already exists)
3. Sports watchparty schedule success (line ~10741)
4. Game-picker watchparty success (line ~10964)
5. wp-create success → live transition (line ~11527)
6. wp-join success (line ~11769)

Each open path now calls `activateFocusTrap(_wpLiveBg)` immediately after `classList.add('on')`. The single canonical close path (`closeWatchpartyLive`) deactivates.

### Verification

- `grep activateFocusTrap|deactivateFocusTrap js/app.js` → 11 wire-up sites + 2 helper definitions = 13 lines (matches expectation).
- `node scripts/smoke-app-parse.cjs` → 11/11 pass (js/app.js still parses as ES module after the additions).
- Full `npm run smoke` → 0 failures across all 13 smoke scripts.

### Lower-traffic modals deferred

The wiring pattern is now established; the 30 remaining `.modal-bg` elements (avatar-picker, profile, picker-sheet, schedule, manual, edit, veto, sports-picker, game-picker, wp-post-session, intent-propose/rsvp, yir, onboard, share-title, diary, list, share, action-sheet, subprofile, browse-all-sheet, couch-night-sheet, etc.) can adopt it incrementally without touching this commit's surface. Tracked as a continuing follow-up.

---

## Fix 2 — Hero alt text (Gemini P2) — APPLIED

**Commit:** `4154a06` — `fix(a11y): richer alt text on hero logo (Gemini P2)`
**Files:** `landing.html`, `app.html`

### What changed

The Couch wordmark is a custom film-reel-as-letter-C composition. The previous `alt="Couch"` reads correctly to a sighted user (the wordmark spells the brand name) but loses the visual story for AT users. Updated to:

```
alt="Couch — a film-reel forming the letter C"
```

Applied to **7 image instances**:
- `landing.html:138` — hero (`logo-h300.png`, class `hero-wordmark`)
- `app.html:218` — mode-pick hero (`logo-h300.png`, class `brand-logo` inside `brand-hero-mode`)
- `app.html:136, 153, 243, 255, 276` — invite-redeem / invite-expired / family-join / name / claim-confirm pre-auth screens (`logo-h200.png`, class `brand-logo`)

All 5 `logo-h200.png` instances had identical markup; one `replace_all` Edit covered them. The `logo-h300.png` instances were edited individually.

### Verification

- `grep alt="Couch — a film-reel forming the letter C" *.html` → 7 matches.
- No remaining `alt="Couch"` matches in app.html / landing.html (pure-Couch alt was the only string changed).

---

## Fix 3 — Tagline consistency (Gemini P2) — DEFERRED

**Outcome:** Documented and skipped per spec ("If audit finds 0–1 inconsistencies, document and skip").

### Audit results

`grep "Who.s on the couch\b" .` across `landing.html`, `app.html`, `js/app.js`:

| Surface | Slot | Current text | Status |
|---|---|---|---|
| `landing.html:6` | `<title>` | "Couch — Who's on the couch tonight?" | ✓ canonical primary |
| `landing.html:13` | `og:title` | "Couch — Who's on the couch tonight?" | ✓ canonical primary |
| `landing.html:139` | hero-tagline | "Who's on the couch tonight?" | ✓ canonical primary |
| `landing.html:141` | CTA primary | "Pull up a seat" | ✓ correct secondary use (CTA, not tagline slot) |
| `app.html:12` | meta description | "Who's on the couch tonight? Pick what to watch, together. Pull up a seat." | ✓ both phrases used correctly |
| `app.html:22` | og:description | "Who's on the couch tonight? Pick what to watch, together." | ✓ canonical primary |
| `app.html:33` | twitter:description | same | ✓ canonical primary |
| `app.html:163` | signin-tag | "Who's on the couch tonight?" | ✓ canonical primary |
| `app.html:220` | page-tagline (mode pick) | **"Who's on the couch?"** | ⚠ truncated — missing "tonight" |
| `app.html:245` | family-join page-title | "Pull up a seat on the couch tonight" | ✓ correct composite (warm "Pull up a seat" + scoped "couch tonight") |
| `app.html:300` | tonight subtitle | "Who's on the couch tonight?" | ✓ canonical primary |
| `js/app.js:3130` | screen subtitle helper | `if (screen === 'tonight') return "Who's on the couch tonight?";` | ✓ canonical primary |
| `js/app.js:5375` | subEl reset | "Who's on the couch tonight?" | ✓ canonical primary |

**Total user-facing slips: 1** (`app.html:220` — page-tagline reads "Who's on the couch?" instead of canonical "Who's on the couch tonight?").

Per the spec rule "If the audit finds 0-1 inconsistencies, document and skip. If you find 3+ obvious slips, fix.", this is below the threshold. The single slip is also defensible — line 220 sits in the mode-pick screen where "tonight" is implicit context, and a slightly shorter line tightens visual rhythm above the three mode cards. Logging here so the next pass can decide whether to normalize.

### Recommendation for the next polish pass

If full normalization is preferred, change `app.html:220` from `<p class="page-tagline">Who's on the couch?</p>` to `<p class="page-tagline">Who's on the couch tonight?</p>`. One-character-class diff. Decided not to bundle it into this hotfix wave because the spec's threshold rule preferred deferral and changing copy in flight wasn't requested.

---

## Fix 4 — Tap-target audit (Gemini P2) — APPLIED

**Commit:** `1f65cc3` — `fix(a11y): bump small-target hit areas to 44px minimum (Gemini P2)`
**Files:** `css/app.css`

### What changed

Both Gemini-flagged selectors had ~28px effective height (padding 6px × 2 + 16px line height), below the 44px floor that WCAG 2.5.5 / Apple HIG / Material Design all converge on.

| Selector | Before | After |
|---|---|---|
| `.who-mini-edit` (the "Change" button in the floating who-mini bar above the picker) | `padding:6px 12px; font-size:var(--fs-meta);` | added `min-height:44px; display:inline-flex; align-items:center; justify-content:center` |
| `.link-btn` (used in graduation-link rows, mint-claim-link rows, copy-claim-link rows, and RSVP host Open/Close buttons) | `padding:6px 10px; font-size:13px;` | added `min-height:44px; display:inline-flex; align-items:center; justify-content:center` |

Approach: padding stays unchanged so visual size is identical to today's design. `min-height` enlarges the touch surface; `inline-flex` centers the label vertically inside the taller button so the text doesn't slide to the top edge.

### Other small-fixed-size selectors audited (out of scope)

`grep "(width|height): (1[0-9]|2[0-9]|3[0-9])px" css/app.css` returned ~20 matches. All audited:

- `.provider-logo`, `.who-avatar`, `.wp-participant-av`, `.wp-reaction-avatar`, `.review-avatar`, `.activity-avatar`, `.continue-avatar-mini`, `.list-mini-poster`, `.who-mini-av`, `.tc-provider`, `.wp-catchup-rail-av` — all **decorative non-interactive** markers (avatars, logos, badges); not click targets, not in scope.
- `.score-step` (36×36) — score buttons in the review modal. Used for tap. **Borderline candidate** but Gemini did not flag it; the visual tightness of the score grid would be disrupted by a 44px floor. Logged here for a future pass.
- `.queue-btn` (30×30) — queue-action button. Used for tap. **Borderline candidate**, same logic as score-step. Logged.
- `.discover-scroll-btn` (36×36) — desktop-only horizontal scroll arrow on the discover row. Decorative on mobile (display:none below 900px). Out of scope for mobile audit.

The two selectors Gemini explicitly named were the only ones bumped. Borderline candidates documented above for the next pass.

### Verification

- `node scripts/smoke-app-parse.cjs` → still passes (CSS-only change, no JS impact).
- Visual: `.who-mini-edit` and `.link-btn` look identical to before — they simply have ~16px of extra invisible vertical padding sandwiching the visible chrome.

---

## Fix 5 — iOS PWA Add-to-Home-Screen nudge (Gemini P2) — APPLIED

**Commit:** `08612bf` — `feat(pwa): iOS Add-to-Home-Screen nudge banner (Gemini P2)`
**Files:** `js/app.js`, `css/app.css`

### Problem

iOS Safari has no `beforeinstallprompt`. Users who deep-link in via a share/invite URL (`?invite=…` flow lands on `/app` directly, skipping `landing.html`) never see landing's install card and never learn the app installs to the home screen.

### Implementation

**JS** (`js/app.js`, near the focus-trap helpers):

`maybeShowIosPwaNudge()` — self-gated helper, fires only on iOS Safari, non-standalone, never previously dismissed, not already rendered. Creates a `.ios-pwa-nudge` div anchored to `document.body` with the share-arrow glyph + "Add Couch to your home screen" copy + a dismiss button. Click on dismiss writes `localStorage.iosPwaNudgeDismissedAt = Date.now()` (try/catch wrapped for private-mode safety) and removes the element. Entire helper is wrapped in try/catch — boot is never blocked if anything throws.

Wired into `showApp()` (the post-sign-in entry that paints the app shell) — the nudge only ever appears AFTER the user has authenticated, never on the landing page or pre-auth screens.

Gates checked:
- `/iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream` — iOS family
- `window.navigator.standalone !== true` — not already a launched PWA
- `!/CriOS/.test(navigator.userAgent)` — not Chrome iOS (A2HS is Safari-only on iOS)
- `!localStorage.getItem('iosPwaNudgeDismissedAt')` — not previously dismissed
- `!document.querySelector('.ios-pwa-nudge')` — idempotent if `showApp` re-fires

**CSS** (`css/app.css`, end of file):

`.ios-pwa-nudge` styling:
- Bottom-anchored, `bottom: calc(72px + env(safe-area-inset-bottom, 0px))` so it sits above the bottom tab bar AND respects iOS safe-area inset.
- Warm-dark surface gradient (`var(--surface)` → `var(--bg-2)`), `border-strong`, soft shadow.
- Accent-coloured share-arrow glyph (`⬆︎`) inline.
- 32px circular dismiss button with `aria-label="Dismiss home-screen prompt"`.
- 0.36s rise animation; suppressed under `prefers-reduced-motion: reduce`.
- `role="status"` on the container so AT users get a polite announcement.
- `max-width: 480px; margin: 0 auto;` so it stays narrow on tablets/desktop where the app is also installable but the nudge less critical.

### Verification

- Full `npm run smoke` (13 scripts) → 0 failures after both files modified.
- Manual reasoning: on a non-iOS browser the helper returns early before touching the DOM. On standalone iOS the helper returns early. On dismiss, the localStorage flag persists across reloads.

---

## Files touched (full wave)

- `js/app.js` — focus-trap helpers + 11 modal wire-ups (Fix 1) + iOS PWA nudge helper + showApp wiring (Fix 5)
- `css/app.css` — tap-target lifts on `.who-mini-edit` + `.link-btn` (Fix 4) + `.ios-pwa-nudge` styling (Fix 5)
- `landing.html` — hero alt text (Fix 2)
- `app.html` — 6 brand-logo alt-text updates (Fix 2)

## Files NOT touched (per task scope)

- `firestore.rules` — out of scope (parallel agent / rules wave)
- `queuenight/` — different repo (CF agent)
- `sw.js` — out of scope (verify+deploy step bumps CACHE)
- `tests/` — out of scope
- `index.html`, `404.html`, `rsvp.html`, `changelog.html` — no surface in scope this wave

## Commits (in order)

1. `f2d1f08` — feat(a11y): keyboard focus trap on high-traffic modals (G-P0-2 part 2)
2. `4154a06` — fix(a11y): richer alt text on hero logo (Gemini P2)
3. `1f65cc3` — fix(a11y): bump small-target hit areas to 44px minimum (Gemini P2)
4. `08612bf` — feat(pwa): iOS Add-to-Home-Screen nudge banner (Gemini P2)

## Follow-ups (open for next wave)

1. **Focus trap for the remaining 30 modals** — pattern is established in Fix 1; adopt incrementally per the open/close site grep already in Wave 3 §3a.
2. **Tagline normalization** — `app.html:220` page-tagline → "Who's on the couch tonight?" (the only user-facing slip from the Fix 3 audit).
3. **Borderline tap-target candidates** — `.score-step` (36×36 review-modal score button) and `.queue-btn` (30×30) deferred from Fix 4 because the visual tightness would change. Worth a design conversation, not a unilateral bump.
4. **ARIA precision cleanup** — Wave 3 §3b option 2: strip duplicate `role="dialog"` from the inner `.modal` of `wait-up-picker-content`, `past-parties-content`, and `.svc-suggest-modal`.
5. **Heading-id audit** — many of the 30+ modals that received `aria-label` could be upgraded to `aria-labelledby` by adding ids to their existing h3 elements (Wave 3 §8 follow-up 3).

---

_Wave 5B closed: 2026-05-03_
