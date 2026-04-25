---
phase: 12-pre-launch-polish
plan: 02
status: complete
wave: 3
files_modified:
  - js/constants.js
  - app.html
  - js/app.js
  - css/app.css
  - landing.html
  - css/landing.css
  - C:/Users/nahde/queuenight/firebase.json
files_created:
  - changelog.html
requirements_addressed: [POL-02, POL-05]
---

# Plan 12-02 Summary — About / version / feedback / changelog + TMDB attribution

**Wave 3 of 3.** Final wave of Phase 12. Cheap, high-signal user-trust polish per D-09..D-12 + TMDB ToS compliance per D-19.

## What shipped

### Task 1 — APP_VERSION + BUILD_DATE constants + ABOUT section markup + handler
- `js/constants.js`: appended `APP_VERSION = 32` + `BUILD_DATE = '2026-04-25'` after `COUCH_NIGHTS_PACKS` (after the Plan 12-03 drift-prevention header — no collision).
- `js/app.js` line 2 import: added `APP_VERSION, BUILD_DATE` to the existing destructured import.
- `app.html`: appended `<div class="tab-section settings-about-section" id="settings-about-section">` AFTER `.tab-footer`, BEFORE the closing `</div>` of `data-cluster="admin"`. Markup includes:
  - "ABOUT" eyebrow (small dim caps via existing `.tab-section-h`)
  - Version line `<p class="about-version" id="about-version-line">—</p>` (populated at render time)
  - Link row: Send feedback (mailto), separator, See what's new (/changelog)
  - TMDB attribution: italic-serif `<em>Powered by <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer">The Movie Database (TMDB)</a></em>`
- `js/app.js`: added `renderAboutSection()` function after `renderSettings`. Idempotent — populates `versionEl.textContent = "Couch v${v} — deployed ${d}"`, sets feedbackEl.href with `encodeURIComponent("Couch feedback v${v}")` subject, sets changelogEl.href to `/changelog`. Window-bound for any future external callsite. Called at end of `renderSettings` via `try { renderAboutSection(); } catch(e) {}` — safe to call before identity strip wires.

### Task 2 — Token-backed CSS for ABOUT + landing.html TMDB attribution
- `css/app.css`: appended `Phase 12 / POL-02` section after the Plan 12-01 POL-01 block. Token-backed throughout — `.settings-about-section` margin/padding via `var(--space-section)` + `var(--space-stack-md)` + `var(--border)`; `.about-version` font-family via `var(--font-sans)`; `.about-link` color via `var(--accent)` with hover/focus underline transition; `.about-attribution` italic serif via `var(--font-serif)`. Zero raw hex.
- `landing.html`: replaced the `.landing-footer` block to add `<p class="landing-tmdb-attr"><em>Powered by The Movie Database (TMDB)</em></p>` AFTER the existing `<p>© Couch</p>` (preserved verbatim).
- `css/landing.css`: appended 3 lines after `.landing-footer` selector defining `.landing-tmdb-attr` with Instrument Serif italic, `var(--ink-dim)` color, hover transitions to `var(--accent)`.

### Task 3 — /changelog.html standalone page + Firebase Hosting rewrite
- `changelog.html` NEW at repo root (`C:/Users/nahde/claude-projects/couch/changelog.html`). 122 lines. Posture mirrors `landing.html`: zero Firebase SDK, zero `/css/app.css` import, no `/js/app.js` ref. Loads `/css/landing.css` + a small `<style>` block with page-local rules. 5 release entries (v32, v31, v29, v28, v27) — each in `<article class="release">` with `release-version` + `release-date` + `release-summary` + `release-list`. SEO: canonical to `https://couchtonight.app/changelog`, `robots: index,follow`.
- `C:/Users/nahde/queuenight/firebase.json`: inserted `{ "source": "/changelog", "destination": "/changelog.html" }` at index 3, BEFORE the catch-all `/` rewrite at index 4. Verified via JSON-parse + index ordering check.

## Files NOT touched (per plan boundaries)

- `sw.js` — Plan 12-01 owns the v32 CACHE bump. **Verified post-commit** by `git diff --name-only HEAD~1 HEAD -- sw.js` returning empty for the Plan 12-02 commit.
- All other constants in `js/constants.js` — APP_VERSION + BUILD_DATE are additive; the curated `COUCH_NIGHTS_PACKS` from Plan 12-03 (Wave 1) is preserved verbatim.

## Verification gates (all pass)

| Gate | Result |
|------|--------|
| `grep -c "export const APP_VERSION = 32" js/constants.js` | 1 |
| `grep -c "export const BUILD_DATE" js/constants.js` | 1 |
| Import line includes APP_VERSION + BUILD_DATE | ✓ |
| `id="settings-about-section"` count in app.html | 1 |
| `about-feedback-link` in app.html | 1 |
| `about-changelog-link` in app.html | 1 |
| `themoviedb.org` in app.html | 1 (≥1) |
| `function renderAboutSection` in js/app.js | 1 |
| `renderAboutSection()` call sites | 2 (≥2) |
| `Couch feedback v` literal in js/app.js | 1 |
| `Phase 12 / POL-02` header in css/app.css | 1 |
| `.settings-about-section` rules | 2 (≥2) |
| `.about-attribution` rules | 3 (≥2) |
| `.about-link` rules | 4 (≥3) |
| Zero raw hex in Phase 12 POL-02 CSS block | ✓ |
| `themoviedb.org` in landing.html | 1 |
| `rel="noopener noreferrer"` in landing.html | 1 (≥1) |
| `landing-tmdb-attr` in landing.html | 1 |
| `landing-tmdb-attr` in css/landing.css | 3 (≥1) |
| `© Couch` preserved in landing.html | 1 |
| changelog.html exists | ✓ |
| `<title>Couch — Changelog</title>` | 1 |
| `firebase` refs in changelog.html | 0 (no SDK) |
| `/css/app.css` refs in changelog.html | 0 |
| `/js/app.js` refs in changelog.html | 0 |
| `<article class="release">` blocks | 5 |
| `release-version` count | 6 (≥5) |
| Literal `v32` in changelog.html | 1+ |
| `/changelog` rewrite in firebase.json | 1 |
| `/changelog` rewrite index < `/` rewrite index | 3 < 4 ✓ |
| firebase.json valid JSON | ✓ |
| `node --check js/app.js` | exit 0 |
| `node --check js/constants.js` | exit 0 |

## LOC delta

- `js/constants.js`: +8 (APP_VERSION + BUILD_DATE block)
- `app.html`: +14 (ABOUT sub-section markup)
- `js/app.js`: +3 import + ~+25 renderAboutSection function + 1 line call site = ~+30
- `css/app.css`: ~+50 (Phase 12 / POL-02 section)
- `landing.html`: +1 (TMDB attribution paragraph)
- `css/landing.css`: +3 (.landing-tmdb-attr rules)
- `changelog.html`: NEW, 122 lines
- `queuenight/firebase.json`: +1 line (rewrite)

## Deviations from plan

None substantive. The plan's verify gate `grep -c "10661" js/constants.js` from Plan 12-03 was already addressed in 12-03-SUMMARY.md as a planning defect — Plan 12-02 doesn't reference 10661 directly. The drift-prevention comment from Plan 12-03 is positioned ABOVE `export const COUCH_NIGHTS_PACKS`, while Plan 12-02 appends APP_VERSION + BUILD_DATE BELOW the closing `];` of the array — the two edits don't collide and both committed cleanly across the 12-03 → 12-01 → 12-02 sequential wave order.

## Deploy steps (deferred for orchestrator)

Mirror to `C:/Users/nahde/queuenight/public/`:
- `app.html` (modified — ABOUT section)
- `js/constants.js` (modified — APP_VERSION + BUILD_DATE)
- `js/app.js` (modified — import + renderAboutSection)
- `css/app.css` (modified — Phase 12 / POL-02 CSS section)
- `css/landing.css` (modified — .landing-tmdb-attr rules)
- `landing.html` (modified — footer TMDB attribution)
- `changelog.html` (NEW — copy to queuenight/public/changelog.html)

`firebase.json` is already updated in the sibling repo (no mirror needed — Firebase CLI reads it from `C:/Users/nahde/queuenight/`).

Then `firebase deploy --only hosting` from `C:/Users/nahde/queuenight/`. v32 sw.js bump (Plan 12-01) handles PWA cache invalidation; combined with hosting-side `Cache-Control: no-cache, max-age=0, must-revalidate` on `**/*.html`, the changelog page is fresh on first visit.

## Future durability note (deferred)

Future BUILD_DATE bumps require a manual `js/constants.js` edit per release. A small Phase 13 follow-up could auto-stamp from `git log -1 --format=%cs HEAD` at deploy time (or via a npm/firebase pre-deploy hook). Captured for backlog, not in this phase's scope.

## Self-Check: PASSED
