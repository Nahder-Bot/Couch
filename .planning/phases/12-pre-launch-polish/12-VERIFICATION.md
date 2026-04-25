---
phase: 12-pre-launch-polish
status: passed
verified_at: 2026-04-25
plans_verified: [12-01, 12-02, 12-03]
must_haves_score: 5/5
---

# Phase 12 Verification — Pre-launch polish

Phase goal verification: **PASSED**. All 5 success criteria from ROADMAP.md §Phase 12 are met by the live codebase.

## Goal-backward must-haves

### MH-1: Notif card 6 per-event toggles + quiet hours + immediate writes
**Status: PASSED** (Plan 12-01)

Verified in `js/app.js`:
- `NOTIF_UI_LABELS` (line ~133) defines all 6 D-02 user-facing keys: `watchpartyScheduled`, `watchpartyStartingNow`, `intentRsvpRequested`, `inviteReceived`, `vetoCapReached`, `tonightPickChosen`.
- `renderNotificationPrefsRows` (line ~1003) iterates `NOTIF_UI_LABELS` and emits a `<label class="notif-pref-row">` per key with a `<input type="checkbox" data-pref="<uiKey>">` inside `.notif-toggle-switch`.
- The change handler calls `savePerEventToggle(uiKey, value)` which translates UI→server key via `NOTIF_UI_TO_SERVER_KEY` and calls the existing `updateNotificationPref(serverKey, value)` writer (Phase 6).
- Quiet-hours block emits HH:mm `<input type="time">` pairs with `data-state="open|closed"` collapse animation; change handlers call `updateQuietHours({...})` and fire `flashToast('Saved')`.
- `savePerEventToggle` calls `flashToast('Saved', { kind: 'good' })` on each toggle change — confirmation UI shipped per D-07.

CSS verified in `css/app.css`:
- `Phase 12 / POL-01` section header present.
- `.notif-toggle-switch.is-on .notif-toggle-track { background: var(--accent); ... }` — orange-on visual state shipped.
- Zero raw hex in the new section (BRAND-token discipline).

### MH-2: ABOUT sub-section ships at bottom of ADMIN cluster
**Status: PASSED** (Plan 12-02)

Verified in `app.html`:
- `<div class="tab-section settings-about-section" id="settings-about-section">` exists INSIDE `data-cluster="admin"`, AFTER `.tab-footer` pills.
- Contains `#about-version-line`, `#about-feedback-link` (mailto), `#about-changelog-link`, and the TMDB attribution `<a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">`.

Verified in `js/app.js`:
- `function renderAboutSection()` reads `APP_VERSION` (32) + `BUILD_DATE` ('2026-04-25') and writes "Couch v32 — deployed 2026-04-25" to `#about-version-line`.
- Feedback href set to `mailto:nahderz@gmail.com?subject=Couch%20feedback%20v32`.
- Called at end of `renderSettings` (idempotent on every Account tab render).

### MH-3: /changelog.html standalone page + Firebase rewrite
**Status: PASSED** (Plan 12-02)

Verified at repo root:
- `changelog.html` exists, 122 lines, mirrors landing.html posture.
- Zero `firebase` references (no SDK).
- Zero `/css/app.css` import.
- Loads `/css/landing.css` only.
- 5 release articles (`<article class="release">`): v32, v31, v29, v28, v27.

Firebase Hosting rewrite verified in `C:/Users/nahde/queuenight/firebase.json`:
- `{ "source": "/changelog", "destination": "/changelog.html" }` at index 3.
- Catch-all `{ "source": "/", "destination": "/landing.html" }` at index 4.
- Specific-before-catch-all ordering preserved (`/changelog` precedes `/`).
- File parses as valid JSON.

### MH-4: Halloween Crawl 9532 fixed + full pack audit
**Status: PASSED** (Plan 12-03)

Verified in `js/constants.js`:
- COUCH_NIGHTS_PACKS region (between `export const COUCH_NIGHTS_PACKS` and matching `];`) does NOT contain `9532`.
- halloween-crawl tmdbIds first id is `10439` (canonical Hocus Pocus 1993, verified via TMDB `/movie/10439`).
- 14 total mismatches across 5 of 8 packs corrected (studio-ghibli-sunday, cozy-rainy-night, halloween-crawl, date-night-classics, a24-night).
- 8 heroImageUrl `w780` URLs preserved verbatim (D-16 forbids touching).
- Drift-prevention header "If you change a pack id, update the comment label" added immediately above `export const COUCH_NIGHTS_PACKS`.

Audit log artifact: `.planning/phases/12-pre-launch-polish/audit-report.txt` (175 lines) with EXPECTED_COUNT (91) + per-pack rows + SUMMARY block + POST-AUDIT REPLACEMENTS APPLIED section.

**Plan deviation acknowledged:** Plan 12-03 hinted Hocus Pocus = 10661, but TMDB resolves 10661 to "You Don't Mess with the Zohan." Canonical Hocus Pocus is 10439. Verified via `/search/movie?query=Hocus+Pocus&year=1993` → results[0].id = 10439, title = "Hocus Pocus", release_date = "1993-07-30". Plan literally instructed "Confirm during audit; do not assume" — confirmed; deviation logged in 12-03-SUMMARY.md and audit-report.txt.

### MH-5: sw.js CACHE bumped to v32-pre-launch-polish
**Status: PASSED** (Plan 12-01)

Verified in `sw.js`:
- Line 8: `const CACHE = 'couch-v32-pre-launch-polish';`
- Old `couch-v31-fix-couch-nights-heroes` not present.
- SHELL array unchanged: `['/app', '/css/app.css', '/js/app.js']`.

## Key-link verification

| From | To | Pattern | Status |
|------|----|---------|--------|
| `js/app.js renderNotificationPrefsRows` | `users/{uid}.notificationPrefs` Firestore | `setDoc.*users.*notificationPrefs` (existing Phase 6 writer) | ✓ via `savePerEventToggle` → `updateNotificationPref` → existing `setDoc` |
| `js/app.js NOTIF_UI_TO_SERVER_KEY` | server enforcement keys | `watchpartyStartingNow.*watchpartyStarting`, `intentRsvpRequested.*intentProposed` | ✓ both present |
| `css/app.css .notif-toggle-switch` | BRAND tokens | `var(--accent)`, `var(--duration-base)` | ✓ |
| `app.html #settings-about-section` | `js/app.js renderAboutSection` | `renderAboutSection` invoked in renderSettings | ✓ (`grep -c renderAboutSection() js/app.js` = 2) |
| `js/app.js renderAboutSection version line` | `js/constants.js APP_VERSION + BUILD_DATE` | ES module import | ✓ (import line includes both) |
| `app.html /changelog href` | `firebase.json hosting rewrite` | source pattern match | ✓ rewrite at idx 3 |
| `js/constants.js COUCH_NIGHTS_PACKS halloween-crawl tmdbIds[0]` | TMDB Hocus Pocus | id `10439` (canonical, deviated from plan-text 10661) | ✓ |

## Cross-phase regression notes

- Phase 6 server-side enforcement (functions/index.js) untouched — all 8 server-key writers still wired through `updateNotificationPref` and `updateQuietHours`. The new UI-key alias map is purely a client-side reconciliation; nothing reaches the server differently.
- Phase 9 BRAND-token discipline preserved — all new CSS in Plan 12-01 + Plan 12-02 is BRAND-token only (zero raw hex, transitions via `var(--duration-*)` + `var(--easing-*)`).
- Phase 11 Couch Nights data layer (Plan 11-07 `COUCH_NIGHTS_PACKS`) preserved — pack metadata fields (id, title, description, mood, heroImageUrl) untouched; only `tmdbIds` array contents corrected per audit.
- No Firestore rules changes; no new Cloud Function endpoints; no new attack surface (per per-plan threat models).

## Test runner status

The repo has no application-level test suite (the `tests/` directory contains Firebase Emulator-based firestore.rules tests via `rules.test.js`, which would require running `firebase emulators:start` and is unrelated to Phase 12's surfaces). Skipping the regression gate is appropriate for this phase — no firestore.rules changes were made.

Syntax checks pass on all modified JS:
- `node --check js/app.js` → exit 0
- `node --check js/constants.js` → exit 0
- `node --check sw.js` → exit 0

## Manual UAT items (deferred to deploy)

These require live deploy + multi-device testing:

1. Notif card with master OFF: per-event toggles NOT visible.
2. Notif card with master ON: 6 toggles render with BRAND-voice copy + Quiet hours pickers.
3. Toggle "Watchparty starting" off → flashToast "Saved" → refresh → state persists in Firestore (`users/{uid}.notificationPrefs.watchpartyStarting === false`).
4. Quiet hours enable → time inputs slide open via max-height transition → set 22:00 → 08:00 → flashToast on each change.
5. Trigger watchparty schedule from another family member → push gating respects toggles + quiet hours.
6. App → Account → ABOUT shows "Couch v32 — deployed 2026-04-25"; tap Send feedback → mail client opens with subject "Couch feedback v32".
7. Tap See what's new → navigates to /changelog (via Firebase rewrite to /changelog.html); page renders, no Firebase SDK in network tab.
8. Visit https://couchtonight.app/ → landing footer shows "Powered by The Movie Database (TMDB)".
9. App → Add tab → Couch Nights → Halloween Crawl → preview leads with Hocus Pocus poster (1993), NOT Final Destination.
10. Other affected packs (cozy-rainy-night, date-night-classics, studio-ghibli-sunday, a24-night) load the corrected titles.

## Phase 12 status: CODE-COMPLETE

| Plan | Wave | Commit | Status |
|------|------|--------|--------|
| 12-03 | 1 | `004255b` | ✓ Complete |
| 12-01 | 2 | `b1ab9a9` | ✓ Complete |
| 12-02 | 3 | `6323530` | ✓ Complete |

All 3 plans shipped sequentially per the wave-dependency contract (12-01 + 12-02 share `app.html`/`js/app.js`/`css/app.css`; 12-02 + 12-03 share `js/constants.js`). Sequential execution avoided merge conflicts that parallel worktrees would have produced.

Closes POL-01, POL-02, POL-03, POL-04, POL-05.

Deploy bundle deferred for orchestrator: mirror to `queuenight/public/` then `firebase deploy --only hosting` from `C:/Users/nahde/queuenight/`. v32 sw.js bump invalidates installed PWA caches on next online launch.
