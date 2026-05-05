---
phase: 07-watchparty
plan: 02
subsystem: watchparty-discoverability
tags: [tonight-tab, spin-result, banner, watchparty, ux, css]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "Plan 07-01 lifecycle state machine — banner relies on accurate scheduled→active flip + onSnapshot wp doc states"
  - phase: 07-watchparty
    provides: "Existing openWatchpartyStart(titleId) + openWatchpartyLive(wpId) modals + wpForTitle(titleId) helper"
provides:
  - "Spin-result modal 'Watch together' CTA — opens watchparty start flow pre-populated with the picked title"
  - "Tonight tab live-watchparty banner — shows imminent (<30 min) or active wp with title + host + Join button"
  - "Per-session sessionStorage dismiss — banner reappears on next app open (no nag)"
affects: [07-03-reactions-palette, 07-06-render-path-gap]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-session dismiss pattern via sessionStorage flag — gives users a 'not now' affordance without permanent suppression. Banner re-evaluates on every onSnapshot tick + page render."
    - "Most-imminent-wins selection: when multiple parties are concurrent, banner shows the first by startAt; others remain accessible via title cards / activity feeds (D-12 in 07-CONTEXT.md)."
    - "Reuse existing modals over new surface — 'Watch together' CTA routes into the existing openWatchpartyStart / openWatchpartyLive flows rather than introducing a new banner-specific modal."

key-files:
  created: []
  modified:
    - "js/app.js — window.spinStartWatchparty(titleId), renderTonightBanner, window.dismissWpBanner"
    - "index.html — <div id='tonight-wp-banner' class='tonight-wp-banner' style='display:none;'></div> on Tonight screen container (later renamed to app.html in commit 0c39e21 post-09-05)"
    - "css/app.css — .tonight-wp-banner / -content / -icon / -body / -title / -meta + .banner-dismiss + .spin-watchtogether (warm-cinematic palette per design system)"

key-decisions:
  - "Reuse existing watchparty modals (D-08 in 07-CONTEXT.md) — no new surface area; spinStartWatchparty(titleId) routes to openWatchpartyLive(existing.id) if a party already exists for the picked title, else openWatchpartyStart(titleId). Mirrors the ⋯ action-sheet behavior."
  - "Per-session dismiss (D-11) — sessionStorage flag clears on app close/reopen. Avoids nagging while preserving rediscovery."
  - "Most-imminent-only display (D-12) — multiple concurrent parties surface only the first by startAt. v1 will rarely have multiple live parties; additional ones remain accessible via title cards. Revisit if real-world usage shows demand."
  - "Discoverability is the primary motivation — the ⋯ action-sheet 'Start a watchparty' path persists unchanged for users who already know the gesture; CTA + banner are additive."

patterns-established:
  - "Spin-result CTA pattern: post-pick modal grows action buttons that route into adjacent feature flows without becoming a hub. 'Watch together' joins 'Watch this tonight' / 'Pass on it' / 'Spin again' as a peer."
  - "Live-state banner pattern on Tonight tab: most-imminent-active filter + sessionStorage dismiss + Join CTA. Reusable shape for future banner-driven flows (e.g., Phase 8 watch-intent banners)."

requirements_completed: [PARTY-01, PARTY-07]
verifier_method: retroactive_backfill_phase_15.2

# Metrics
duration: ~unknown (autonomous run; commit febdc8a follows 6a8d473 closely)
completed: 2026-04-22
---

# Plan 07-02 — Tonight's Pick "Watch together" CTA + Live Watchparty Banner

**PARTY-01: Spin-result modal gains a "🎬 Watch together" button that opens the watchparty start flow for the picked title (or routes to an existing party if one's already live for that title). PARTY-07: Tonight tab shows a banner whenever a watchparty is active or imminent (<30 min out), with title + host + Join button. Per-session dismissible via sessionStorage.**

## What landed

- **Spin-result CTA:** New `<button class="spin-watchtogether" onclick="spinStartWatchparty('${t.id}')">🎬 Watch together</button>` added to the `.spin-actions` block (~js/app.js:5608 region). `window.spinStartWatchparty(titleId)` closes the spin modal then routes:
  - If `wpForTitle(titleId)` returns an active party → `openWatchpartyLive(existing.id)`
  - Else → `openWatchpartyStart(titleId)` (pre-populates the start modal with the picked title)
- **Tonight banner DOM:** `<div id="tonight-wp-banner" class="tonight-wp-banner" style="display:none;"></div>` added near top of Tonight screen container. Empty-default; no layout disruption when no banner is needed. (Note: post-09-05 the file was renamed `index.html` → `app.html` per commit `0c39e21` — the banner element migrated unchanged.)
- **`renderTonightBanner()`:** Filters `state.watchparties` for active OR scheduled-and-within-30-min-of-startAt. Sorts by startAt. Picks `[0]`. Renders title + host + status/time + Join button + ✕ dismiss. Shows "Live now" for active or "Starts in N min" / "Starting now" for scheduled. Respects `sessionStorage.wpBannerDismissed`. Called from (a) the existing Tonight render function, (b) the existing `state.unsubWatchparties` onSnapshot handler.
- **`window.dismissWpBanner()`:** Sets `sessionStorage.wpBannerDismissed = '1'` + hides element. Reappears on next app open.
- **CSS:** `.tonight-wp-banner` styled as elevated card against warm palette (`#14110f` bg, subtle border, 12px radius, padding). `.tonight-wp-banner-content` flex row. `.banner-dismiss` subtle top-right ✕. `.spin-watchtogether` styled consistent with `.spin-accept` but with secondary tone — primary visual primacy stays with "Watch this tonight."

## Commits

- **`febdc8a`** — `feat(07-02): spin-result "Watch together" CTA (PARTY-01)`

## Smoke tests

What was tested at the static + UAT level:

1. `grep "openWatchpartyStart\|openWatchpartyLive" js/app.js` — existing call-sites intact (regression-safe)
2. Tonight spin still works end-to-end (spin → pick → accept → existing schedule flow unchanged)
3. ⋯ action-sheet 'Start a watchparty' button still present (~js/app.js:8617 per Plan 07-02)
4. UAT Scenario 2 (PASS): on iPhone, Spin → pick lands → "🎬 Watch together" CTA → start modal opens pre-populated → tap Now → Start → live modal opens
5. UAT Scenario 3 (PASS): from second device start a watchparty → on iPhone Tonight tab banner renders title + host + Join → tap Join → live modal opens

## Must-haves checklist

- [x] Tonight's Pick card (post-spin result modal) has a "Watch together" button that opens openWatchpartyStart for the picked title
- [x] If a watchparty already exists for the picked title, the CTA reads "Open watchparty" (effective behavior — `openWatchpartyLive` is opened directly) and routes to openWatchpartyLive
- [x] Tonight screen shows a banner when a watchparty is active or imminent (<30 min until startAt)
- [x] Banner displays title + host + status/time + Join button
- [x] Banner dismisses per-session via sessionStorage; reappears on next app open
- [x] Multiple concurrent parties: banner shows the first-by-startAt; others accessible via their title cards
- [x] No regression on existing ⋯ action-sheet 'Start a watchparty' path

## What this enables

- **Discoverability:** The most common "I want to start a watchparty" gesture — post-spin, on the picked title — now has a primary affordance instead of being buried in ⋯.
- **Reverse discoverability:** Users opening the app while another family member has a party live get the banner — they can join without finding the title card or knowing the URL.
- **Plan 07-03:** Reactions polish + participant timer build on the live-modal flow that the CTA + banner now feed traffic into.
- **Plan 07-04 UAT (Scenarios 2+3):** Both passed end-to-end on iPhone + second device, validating the discoverability hypothesis.

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 07-02 shipped 2026-04-22 — only the 4 gap-closure plans (07-05..08) got proper SUMMARYs at the time. The v33.3 milestone audit YAML (`.planning/v33.3-MILESTONE-AUDIT.md` lines 51-102) identified the gap as "PARTY-01 + PARTY-07: orphaned — 07-02-SUMMARY.md absent." Evidence sources used for this reconstruction:

- `07-02-PLAN.md` (must_haves checklist + interfaces sketch with exact CTA + banner code shapes)
- `07-CONTEXT.md` (locked decisions D-08, D-09, D-10, D-11, D-12 for CTA behavior + banner UX)
- `07-04-UAT-RESULTS.md` Scenarios 2 + 3 (both PASS — CTA opens start modal pre-populated; banner shows live party + Join routes correctly)
- Production-live state at couchtonight.app/app (Tonight tab banner element + spin-actions CTA visible in production bundle)
- v33.3 audit YAML evidence blocks for PARTY-01 + PARTY-07 (lines 51-58, 75-81)

---

_Phase: 07-watchparty_
_Plan: 02_
_Completed: 2026-04-22_
_Reconstructed: 2026-04-27 by Phase 15.2-03 (retroactive_backfill_phase_15.2)_
