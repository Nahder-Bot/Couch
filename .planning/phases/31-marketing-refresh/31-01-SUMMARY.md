---
phase: 31-marketing-refresh
plan: 01
subsystem: marketing
tags: [marketing, landing, html, css, sentry, faq, comparison, features]
requires: []
provides:
  - landing.html: 4-block "Why not …?" comparison section + 4-block "What's actually in it" features section + 7-question FAQ accordion + Sentry breadcrumb wiring on FAQ open
  - css/landing.css: .compare-* / .feature-block / .faq-* styling using only pre-existing :root tokens
affects:
  - landing.html (337 lines, +103 from 234)
  - css/landing.css (135 lines, +38 from 97)
tech-stack:
  added: []
  patterns:
    - native <details>/<summary> accordion (zero JS framework, replicates css/app.css:2320 .signin-more precedent)
    - defensive Sentry guard (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) — canonical pattern from js/app.js
    - +/− glyph swap as accordion marker (restraint-first per BRAND.md §1, no rotating chevron)
    - derived rgba of --accent for .faq-item[open] highlight (allowed under D-21; no new named tokens)
key-files:
  created: []
  modified:
    - landing.html
    - css/landing.css
decisions:
  - Honored D-01 section ordering: hero → why → about → compare → paths → features → audience → screenshots → faq → install → footer
  - Honored D-21 zero-new-tokens rule: token count stayed at 14
  - Honored D-26 "What's actually in it" plain heading (no "free" repetition — .hero-trust already carries that signal)
  - Honored D-27 Sentry breadcrumb on FAQ open with category=marketing.faq, message=opened, data.question_index
  - Comparison 4th block (D-24) added as a parallel <h3> alongside the other three for visual rhythm consistency, NOT as a denser tail line
metrics:
  duration: ~10 minutes
  completed: 2026-05-11
  tasks: 2
  files: 2
  commits: 2
---

# Phase 31 Plan 01: Landing copy block additions Summary

Closed 3 of the 8 success criteria from `31-CONTEXT.md` (criteria 1 comparison, 2 features, 3 FAQ) by appending a 4-block comparison section, a 4-block features section, and a 7-question native-`<details>` FAQ to `landing.html` — plus an inline Sentry-breadcrumb script on FAQ open — and ~38 lines of CSS to `css/landing.css` using only the 14 existing `:root` tokens.

## What shipped

### Comparison section (4 blocks, after .about, before .paths)

Verbatim headlines:
1. **Why not JustWatch or Reelgood?**
2. **Why not Letterboxd or Trakt?**
3. **Why not Teleparty, Scener, or Plex?**
4. **Why not Apple SharePlay, FaceTime, or Microsoft Teams Together?** (D-24 — closes the cross-AI brief §5 Q12 gap)

Voice: factual differentiation, not hostile dunking (D-11). Eyebrow: "Why not the other things?".

### Features section (4 blocks, after .paths, before .audience)

Plain heading **"What's actually in it"** (D-26 — does NOT repeat "free"; the `.hero-trust` line under the hero CTA already carries that signal).

Verbatim headlines:
1. **Wait Up — watch together when you can't be in the same room**
2. **Couch Groups — bring another family in**
3. **Pick up where you left off**
4. **Pick'em on the big games**

Each block = `<h3>` + `<p>` 2-line elaboration, no icons (D-03 reduce noise).

### FAQ section (7 questions, after .screenshots, before .install)

Native `<details>`/`<summary>` accordion (D-04 — zero JS framework). Verbatim summary lines:
1. **Do I need to log in?**
2. **Does Grandma need an account?**
3. **Which streaming services do you support?**
4. **Does it cost?**
5. **What devices does it work on?**
6. **What happens to my data?**
7. **How is this different from Teleparty?**

Order matches D-22 / LAUNCH-REVIEW §3 fix 6.

### Sentry breadcrumb wiring (D-27)

Inline `<script>` block immediately after `</main>` (before `</body>`). Iterates `.faq-item` nodes, attaches `toggle` listeners, fires only on open with the canonical defensive guard:

```js
if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
  Sentry.addBreadcrumb({
    category: 'marketing.faq',
    message: 'opened',
    data: { question_index: <0..6> }
  });
}
```

Phase 17 will use this signal to order the App Store description FAQ by interest.

### CSS rules appended (css/landing.css)

- `.compare-eyebrow` / `.compare-grid` / `.compare-block` — leans on `.path-card` density (surface bg + border + r-md, padding 24).
- `.feature-list` / `.feature-block` — flatter divider-only style (`border-top: 1px solid var(--border)`) so visual weight differs from comparison cards.
- `.faq-list` / `.faq-item` / `.faq-item summary` / `.faq-item summary::after` — native marker hidden via `::-webkit-details-marker { display: none; }`; custom `+` (closed) / `−` (open) glyph; `.faq-item[open]` highlights with derived `rgba(232,160,74,0.30)` of `--accent`.
- `@media (min-width: 900px)` — `.compare-grid` and `.feature-list` go to 2-column; `.feature-block:nth-child(2)` border-top reset for new top row.

## Must-haves verification

| Truth | Status |
|---|---|
| 4-block comparison between .about and .paths | PASS — section order verified via `grep -n '<section class='` returns hero/why/about/compare/paths/features/audience/screenshots/faq/install |
| 4-block features between .paths and .audience (NOT after audience) | PASS — same grep confirms ordering |
| 7-question FAQ between .screenshots and .install using `<details>`/`<summary>` | PASS — 7 `<details class="faq-item"` matches |
| FAQ open fires `Sentry.addBreadcrumb({ category: 'marketing.faq', message: 'opened', data: { question_index } })` | PASS — script block present after `</main>` with canonical defensive guard |
| New sections render against existing :root tokens — no new var() declarations in :root | PASS — `grep -E '^\s*--[a-z-]+:' css/landing.css \| wc -l` returns 14 (unchanged from pre-edit) |

| Artifact contains_all | landing.html | css/landing.css |
|---|---|---|
| All 13 landing.html literals | PASS (counts: 1/1/1/1/1/1/1/1/1/7/7/1/2) | n/a |
| All 3 css/landing.css literals | n/a | PASS (counts: 7/6/10 — substring matches) |

## Confirmation: zero new :root tokens

Token count before plan: 14 (`--bg`, `--bg-deep`, `--surface`, `--ink`, `--ink-warm`, `--ink-dim`, `--accent`, `--accent-2`, `--velvet`, `--border`, `--r-md`, `--r-lg`, `--r-pill`, `--brand-grad`, `--ease-cinema` — note `--ease-cinema` is the 15th entry but `--brand-grad` and `--ease-cinema` are both at the bottom; the grep above counts 14 lines matching the `^  --` pattern in `:root`).

Token count after plan: 14. Verified via `grep -E '^\s*--[a-z-]+:' css/landing.css | wc -l` returning 14.

The single use of a literal hex/rgba inside the new CSS block is `rgba(232,160,74,0.30)` at `.faq-item[open]`. This is a **derived rgba of the existing `--accent: #e8a04a`** — explicitly allowed by D-21 ("derived rgba of existing tokens are allowed; new named tokens are not"). Keeping it inline avoids introducing an `--accent-faint` variable that would only be used in one place.

## Sentry breadcrumb manual verification

The breadcrumb wiring is in `landing.html` at lines 313-336. Manual devtools verification (Network tab → filter `sentry`, tap an FAQ item) is part of Plan 31-04's deploy-then-curl smoke step, not Plan 31-01's scope. Plan 31-01 verifies only that the source code emits the canonical breadcrumb pattern — confirmed via:

- `grep -c "category: 'marketing.faq'" landing.html` → 1
- `grep -c 'typeof Sentry !==' landing.html` → 1
- `grep -c 'data-faq-index=' landing.html` → 7 (one per `<details>`)

## Commits

| Hash | Message |
|---|---|
| `fc13ab5` | feat(31-01): add comparison + features + FAQ sections to landing.html |
| `437488b` | feat(31-01): add .compare / .feature-block / .faq CSS rules to landing.css |

## Deviations from plan

**None.** Plan executed exactly as written. All locked copy lines (D-12 / D-14 / D-15 / D-22 / D-24 / D-26) shipped verbatim. All structural decisions (D-01 ordering, D-04 native details, D-21 zero new tokens, D-27 Sentry guard pattern) honored.

Two small notes on Claude's discretion calls flagged in 31-CONTEXT.md:

1. **D-24 fourth comparison block placement** — Plan was explicit it should be a parallel `<h3>` block, and that's what shipped. (Visual rhythm: 4 cards on a 2-col desktop grid land as 2x2, which is calmer than 3+1 trailing line.)
2. **`loading="lazy"` on Pick'em screenshot** — Out of scope for Plan 31-01 (no new screenshots added; this plan ships copy + CSS only). Belongs to Plan 31-02 when the new screenshot set is captured and wired into `<figure class="screenshot-card">`.

## File deltas

- `landing.html`: 234 → 337 lines (+103 inserted, 0 deleted, 0 existing sections modified)
- `css/landing.css`: 97 → 135 lines (+38 appended, 0 existing rules modified)

## Self-Check: PASSED

- `landing.html` exists at expected path: FOUND
- `css/landing.css` exists at expected path: FOUND
- Commit `fc13ab5` exists: FOUND
- Commit `437488b` exists: FOUND
- All 13 `must_haves.artifacts[0].contains_all` literals present in `landing.html`: FOUND
- All 3 `must_haves.artifacts[1].contains_all` literals present in `css/landing.css`: FOUND
- Zero new `:root` tokens added: CONFIRMED (token count 14 → 14)
- Zero exclamation marks in new sections (BRAND.md voice rule): CONFIRMED via `sed -n '163,286p' landing.html | grep -c '!'` returning 0
