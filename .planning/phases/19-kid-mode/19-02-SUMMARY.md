---
phase: 19-kid-mode
plan: 02
subsystem: detail-modal-parent-override
tags: [kid-mode, parent-override, detail-modal, sentry-breadcrumb, brand-restraint]
requires:
  - "19-01 (state.kidMode + state.kidModeOverrides Set + getEffectiveTierCap helper)"
  - "isCurrentUserParent helper (js/app.js:6242)"
  - "RATING_TIERS + tierFor from constants.js"
  - "renderDetailShell (js/app.js — detail-modal HTML template)"
  - "closeDetailModal + flashToast + renderTonight + renderLibrary"
provides:
  - "Per-title parent override surface inside renderDetailShell (3-condition gate: kidMode + tier > 2 + isCurrentUserParent)"
  - "window.kidModeOverrideTitle handler (Set mutation + Sentry breadcrumb + modal close + Tonight/Library re-render)"
  - "Defense-in-depth parent gate inside the handler (rejects DevTools invocations by non-parents)"
  - "Already-overridden quiet-hint state ('Showing this for tonight (kid-mode override)')"
  - ".kid-mode-override-link / .kid-mode-override-row / .kid-mode-override-active CSS rules"
affects:
  - "renderDetailShell return-template body (js/app.js:7653-7676)"
  - "Detail-modal handler cluster (js/app.js after window.addSimilar)"
  - "css/app.css Phase 19 section (after the prefers-reduced-motion block from 19-01)"
tech-stack:
  added: []
  patterns:
    - "Conditional render via empty-string ternary (matches existing `${state.me ? ... : ''}` precedent at js/app.js:7662)"
    - "Defense-in-depth gate (render-side AND handler-side parent check)"
    - "Sentry breadcrumb wrapped in try/catch (analytics never blocks UX)"
    - "Already-overridden state surfaces a quiet hint instead of re-clickable link (idempotent UX)"
    - "BRAND.md warm-restraint: italic-serif dim link, modest accent, no theatrical wash"
key-files:
  created: []
  modified:
    - "js/app.js"
    - "css/app.css"
decisions:
  - "Splice anchor: AFTER `${state.me ? \"+ Add to list\" : ''}` and BEFORE `${renderTvProgressSection(t)}` — adjacent to the user's primary CTA, contextually grouped with Add-to-list"
  - "Per CONTEXT.md plan note: chosen line 7662 (post-Add-to-list) over line 7657 (post-title) and line 7661 (post-overview) — the primary-CTA-adjacent placement keeps the override discoverable but visually subordinate to the title/overview"
  - "Added `escapeHtml(t.id)` defensive wrap in the onclick attribute (matches existing template-literal pattern even though title IDs are TMDB-style ASCII — defense in depth)"
  - "Override copy: 'Show this anyway for tonight' (verbatim D-10)"
  - "Confirmation toast: 'Showing this for tonight' (mirrors override copy, present-tense)"
  - "Already-overridden hint: 'Showing this for tonight (kid-mode override)' — explicit '(kid-mode override)' suffix distinguishes it from the toast and clarifies why this title is visible despite the cap"
  - "Defense-in-depth message: 'Only parents can do this' — direct-instruction voice per BRAND.md, no banned words"
  - "Sentry breadcrumb data: { titleId, rating, by: state.me.id } — enables the 'kids excluded but parents watch anyway' frequency signal recommended in CONTEXT.md"
  - "CSS .kid-mode-override-link uses --font-serif italic + --t-meta + --ink-warm with --accent underline — dim by default per BRAND warm-restraint, warms to --accent on hover/focus"
  - "Added prefers-reduced-motion override for .kid-mode-override-link transition (parity with 19-01's pattern even though the transition is duration-fast / 150ms)"
metrics:
  duration_seconds: 360
  task_count: 1
  file_count: 2
  completed: "2026-04-29"
---

# Phase 19 Plan 02: Per-title parent override on detail modal Summary

## One-liner

Splices a "Show this anyway for tonight" italic-serif link into `renderDetailShell` (gated on state.kidMode + tier > 2 + isCurrentUserParent), wires `window.kidModeOverrideTitle` to add the titleId to state.kidModeOverrides Set + write a Sentry `kid-mode-override` breadcrumb + close the modal + re-render Tonight/Library, with defense-in-depth parent check + already-overridden quiet-hint state.

## What shipped

**renderDetailShell (js/app.js:7652-7676):**
- New `kidModeOverrideHtml` compute block before the return-template (reuses existing `tier` variable from line 7607)
- 3-condition gate: `state.kidMode && tier !== null && tier > 2 && isCurrentUserParent()` (D-10..D-12)
- Two render branches:
  - **Not-yet-overridden** → `<a class="kid-mode-override-link" onclick="kidModeOverrideTitle(...)">Show this anyway for tonight</a>` (verbatim D-10 copy)
  - **Already-overridden** (`state.kidModeOverrides.has(t.id)`) → quiet `<p class="kid-mode-override-active">Showing this for tonight (kid-mode override)</p>` hint (no re-clickable link)
- Splice point: between the `${state.me ? "+ Add to list" : ''}` line and `${renderTvProgressSection(t)}` line

**window.kidModeOverrideTitle handler (js/app.js, after window.addSimilar):**
- Defense-in-depth parent check (calls isCurrentUserParent — refuses DevTools invocations by non-parents, "Only parents can do this" toast)
- Lazy-initializes `state.kidModeOverrides` to `new Set()` if missing or non-Set (defensive — already initialized at module load by 19-01)
- `state.kidModeOverrides.add(titleId)` (D-11)
- Sentry breadcrumb: category='kid-mode-override', message=`parent override applied for ${titleId}`, level='info', data={titleId, rating, by: state.me.id} — wrapped in try/catch so analytics never blocks UX
- `flashToast('Showing this for tonight', { kind: 'info' })` confirmation
- `closeDetailModal()` — close so re-rendered Tonight is visible
- `renderTonight()` + `renderLibrary()` — refresh both consumer surfaces (filter pipeline picks up override per 19-01 splices)

**css/app.css (after prefers-reduced-motion block from 19-01):**
- New Phase 19 / D-10..D-12 section
- `.kid-mode-override-row` — margin + left-align
- `.kid-mode-override-link` — Instrument Serif italic + --t-meta + --ink-warm + --accent underline; warms to --accent + --accent-deep on hover/focus-visible (BRAND warm-restraint)
- `.kid-mode-override-active` — same italic-serif styling but --accent-deep + opacity 0.85 (recedes — this is just a status hint, not interactive)
- `@media (prefers-reduced-motion: reduce)` clamps transition

## Frontmatter snapshot

3-condition render gate ✓ · already-overridden hint ✓ · handler with parent gate + Sentry + flashToast + close + re-render ✓ · CSS dim italic + accent hover ✓ · prefers-reduced-motion respected ✓ · `node --check js/app.js` 0 ✓ · `npm run smoke` (4 contracts) 0 ✓

## Commits

| Task | Commit  | Description |
|------|---------|-------------|
| 1    | `3e3b7d4` | feat(19-02): per-title parent override on detail modal |

## Verification

| Check | Status |
|-------|--------|
| `node --check js/app.js` | PASS |
| `node scripts/smoke-kid-mode.cjs` | 23/23 (no regression) |
| `npm run smoke` (4 contracts: position + tonight + availability + kid-mode) | PASS |
| Grep `kidModeOverrideTitle` in js/app.js | 2 matches (1 def + 1 onclick reference) ✓ ≥2 spec |
| Grep `kid-mode-override` in css/app.css | 6 matches (.kid-mode-override-row, .kid-mode-override-link, .kid-mode-override-link:hover/focus-visible, .kid-mode-override-active, prefers-reduced-motion override) ✓ ≥3 spec |
| BANNED-words sweep on new copy | PASS — "Show this anyway for tonight" (verbatim D-10), "Showing this for tonight" (toast + already-overridden), "Only parents can do this" (defense-in-depth). No "Family", "Parental", "PG", "rating" terms in user-visible copy. "kid-mode override" appears only in the active-state subtitle as the explicit system-label disambiguation, which is the established Phase 19 group-agnostic vocabulary |

## Deviations from Plan

**Minor — line-number drift between plan and source:** PLAN.md cited `renderDetailShell` at js/app.js:7532 (with splice anchors at lines 7580-7602). Actual current line is 7605 (renderDetailShell function start), with splice anchors at 7653-7676. The structural content is identical to what the plan describes — only the line numbers shifted (likely from the post-15.1 / Phase 18 splices). All splice anchors in the plan are described by surrounding-code identity ("AFTER `${state.me ? \"+ Add to list\" : ''}`"), not by line number, so no semantic deviation. Documented here for future-Claude line-number traceability.

**Minor — added `escapeHtml(t.id)` defensive wrap on the onclick attribute** (Rule 2: critical-functionality). The plan template was `kidModeOverrideTitle('${t.id}')` — but TMDB IDs use the format `tmdb_movie_12345` and external IDs (Trakt, IMDB) could theoretically contain quotes or HTML-special chars. The other window-handler onclicks in renderDetailShell already use `escapeHtml` (e.g., line 7592 `removeDetailMood('${escapeHtml(t.id)}','${escapeHtml(id)}')`) — added the wrap for consistency + defense-in-depth. No functional impact on TMDB-format IDs. Not a Rule-1 bug fix because no current title ID format triggers the issue, but it's a Rule-2 critical-correctness pre-emption per CLAUDE.md security posture.

**Minor — added prefers-reduced-motion override for .kid-mode-override-link** (parity with 19-01's pattern). The transition is `--duration-fast` (150ms color-only) — under the threshold where reduced-motion-conscious users would notice — but kept the override for surface-uniformity with 19-01's `.kid-mode-toggle` block.

## Known stubs

None. Plan ships the complete parent-override surface; no stubs, no TODOs, no placeholder data flowing to UI. The Tonight/Library re-renders consume Plan 19-01's filter-pipeline override-Set check (`!state.kidModeOverrides.has(t.id)`) which is already wired in 7 splice sites and exercised by the 23-assertion smoke contract.

## Manual verification deferred to Plan 19-03 UAT

- Visual smoke: parent + kid-mode active + open R-rated detail → "Show this anyway for tonight" link visible directly below the "+ Add to list" button
- Tap smoke: tap link → modal closes, flashToast confirms, title appears in Tonight matches; re-open detail → "Showing this for tonight (kid-mode override)" appears instead
- Non-parent smoke: sign in as non-parent member + activate kid-mode + open R-rated detail → link does NOT appear
- Toggle-clear smoke: parent toggles kid-mode off + back on → override Set clears (per 19-01 toggleKidMode), link re-appears on R-rated detail
- DevTools smoke: open console + invoke `window.kidModeOverrideTitle('any-id')` as a non-parent → "Only parents can do this" toast (defense-in-depth)
- Sentry breadcrumb smoke: trigger override + flush Sentry session → category='kid-mode-override' breadcrumb visible in Sentry inspector with titleId/rating/by data

## Self-Check: PASSED

- File `js/app.js` modified with `kidModeOverrideTitle` (2 matches): FOUND
- File `css/app.css` modified with `kid-mode-override` (6 matches): FOUND
- Commit `3e3b7d4`: FOUND (`git log --oneline | grep 3e3b7d4` → matches)
- `node --check js/app.js` exit 0: CONFIRMED
- `node scripts/smoke-kid-mode.cjs` exit 0 with 23 PASS: CONFIRMED
- `npm run smoke` exit 0 (all 4 contracts chained): CONFIRMED
- Override link copy "Show this anyway for tonight" verbatim D-10: CONFIRMED
- Already-overridden hint "Showing this for tonight (kid-mode override)" present: CONFIRMED
- Sentry breadcrumb category 'kid-mode-override' present: CONFIRMED
- isCurrentUserParent defense-in-depth gate present in handler: CONFIRMED
