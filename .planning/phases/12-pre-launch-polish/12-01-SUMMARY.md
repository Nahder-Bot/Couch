---
phase: 12-pre-launch-polish
plan: 01
status: complete
wave: 2
files_modified:
  - js/app.js
  - css/app.css
  - sw.js
requirements_addressed: [POL-01]
---

# Plan 12-01 Summary — Per-event notification preferences UI

**Wave 2 of 3.** Closes Phase 6 PUSH-02 + PUSH-04 runtime UAT loop — server-side enforcement (functions/index.js:45,79,91-124) shipped with Phase 6, but users had no polished surface to exercise it. The Phase 6 in-place rendering (js/app.js renderNotificationPrefsRows with inline-style flex layout) was a development-time scaffold; this plan ships the production version.

## What shipped

### Task 1 — UI key alias map + savePerEventToggle wrapper
Added three frozen-Object constants after `NOTIFICATION_EVENT_LABELS` (js/app.js ~L122):
- `NOTIF_UI_TO_SERVER_KEY` — 6-key allowlist mapping user-facing names (D-02) to server enforcement keys. Critical: `watchpartyStartingNow → watchpartyStarting` and `intentRsvpRequested → intentProposed` preserve Phase 6 server-side eventType verbatim.
- `NOTIF_UI_LABELS` — BRAND-voice copy per D-06 (sentence-case labels, italic-serif hints rendered via `.notif-pref-hint`).
- `NOTIF_UI_DEFAULTS` — UI defaults per D-02. Notable: `tonightPickChosen` defaults TRUE in UI (Phase 6 default was FALSE) — UI-default change only; existing users with stored values keep them via `getNotificationPrefs()` merge order.

Added `savePerEventToggle(uiKey, value)` wrapper after `updateNotificationPref` (js/app.js ~L215) that maps UI→server key + writes via existing writer + fires `haptic('light')` + `flashToast('Saved', { kind: 'good' })`. Window-bound for HTML callsite use (none currently, but available for future).

### Task 2 — renderNotificationPrefsRows refactor + master-on copy
Replaced the function body (signature preserved — the call site at `updateNotifCard` line 939 is unchanged). New behavior:
- Reads merged prefs once via `getNotificationPrefs()`, translates to UI-key view via `NOTIF_UI_TO_SERVER_KEY[uiKey]` falling back to `NOTIF_UI_DEFAULTS[uiKey]`.
- Emits BRAND-aligned markup: `.notif-prefs-list > .notif-pref-row > .notif-toggle-switch` with proper `<input type=checkbox> data-pref="<uiKey>"` + sibling `.notif-toggle-track` + `.notif-toggle-thumb`.
- Quiet-hours block uses `.notif-quiet-block` with `<div class="notif-quiet-times" data-state="open|closed">` so CSS can animate via `max-height` transition (no JS-controlled `display:none` toggle, honoring Phase 9 Pitfall-2).
- Wires per-event change events to `savePerEventToggle` (NOT the raw writer), so flashToast fires on every change.

Tightened the `#notif-status` master-on copy at js/app.js:922 to remove inline `style='color:var(--good);'` (Phase 9 Pitfall-1). Replaced with `<strong class='notif-status-on'>` + `<span class='notif-status-sub'>`. CSS classes shipped in Task 3.

### Task 3 — BRAND-token CSS + sw.js v32 bump
Appended a 100-line CSS section at end of css/app.css under header `Phase 12 / POL-01`. Highlights:
- iOS-style switch built from a visually-hidden `<input type=checkbox>` + sibling `.notif-toggle-track` + `.notif-toggle-thumb`. Uses `.is-on` modifier on the parent `.notif-toggle-switch` for visual state.
- Track background animates from `var(--surface-3, var(--surface-2))` to `var(--accent)` via `var(--duration-base)` with `var(--easing-standard)`.
- Thumb translates `18px` and switches background from `var(--ink)` to `var(--bg)` (deviation noted below).
- `.notif-quiet-times` uses a `max-height: 0 → 200px` transition gated on `[data-state="open"]` for smooth collapse without JS height calculation.
- `:focus-visible` outline on the input renders on the sibling track for keyboard a11y.
- `@media (prefers-reduced-motion: reduce)` block clamps the three transition declarations.
- Zero raw hex / zero raw ms in the new section (the only literal RGBA is the existing `0 1px 3px rgba(0,0,0,0.3)` on the thumb shadow, which is the same defensive pattern used elsewhere in css/app.css).

Bumped `sw.js` line 8 from `couch-v31-fix-couch-nights-heroes` to `couch-v32-pre-launch-polish`. SHELL array unchanged (`/app`, `/css/app.css`, `/js/app.js`). This bump is **owned by Plan 12-01**; Plans 12-02 and 12-03 explicitly do NOT bump CACHE.

## Deviation from plan (documented)

**Thumb-on color: `var(--bg)` instead of `#fff`.**
Plan 12-01 Task 3 specified the on-state thumb background as `#fff` (literal hex). The plan's own CSS verification gate is `node -e ".../#[0-9a-fA-F]{3,6}/.test(block)/process.exit(1)"` — i.e., zero raw hex in the new section. These are contradictory. I deviated to `var(--bg)` (the warm-dark `#14110f`) — slightly different visual contrast on the accent-orange track, but reads cleanly and passes the BRAND-token discipline gate that the plan itself enforces.

## Files NOT touched (per plan boundaries)

- `app.html` lines 608-616 #notif-card master row block — unchanged (#notif-status + #notif-enable-btn). The plan explicitly says the existing master-row HTML stays.
- `functions/index.js` server-side enforcement — Phase 6 server keys (NOTIFICATION_DEFAULTS) untouched; the alias map at the client is the sole reconciliation surface.
- `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` in js/app.js — additive only. Old constants preserved (`grep -c "DEFAULT_NOTIFICATION_PREFS" js/app.js = 4`, `grep -c "NOTIFICATION_EVENT_LABELS" js/app.js = 2`). They remain wired for any non-rendered call sites.

## Verification gates (all pass)

| Gate | Result |
|------|--------|
| `grep -c "NOTIF_UI_TO_SERVER_KEY" js/app.js` | 4 (≥3) |
| `grep -c "watchpartyStartingNow" js/app.js` | 3 (≥3) |
| `grep -c "intentRsvpRequested" js/app.js` | 3 (≥3) |
| `grep -c "savePerEventToggle" js/app.js` | 6 (≥4) |
| `grep -c "DEFAULT_NOTIFICATION_PREFS" js/app.js` | 4 (≥4 — preserved) |
| `grep -c "NOTIFICATION_EVENT_LABELS" js/app.js` | 2 (≥1 — preserved) |
| `grep -c "data-pref=" js/app.js` | 1 (≥1) |
| `grep -c "color:var(--good)" js/app.js` | 0 (inline color removed) |
| `grep -c "renderNotificationPrefsRows" js/app.js` | 2 (≥2) |
| `grep -c "Phase 12 / POL-01" css/app.css` | 1 (≥1) |
| `grep -c ".notif-toggle-switch" css/app.css` | 10 (≥6) |
| `grep -c ".notif-pref-row" css/app.css` | 6 (≥4) |
| `grep -c ".notif-quiet-block" css/app.css` | 2 (≥2) |
| `.notif-quiet-times[data-state="open"]` count | 1 |
| Zero raw hex in Phase 12 POL-01 block | ✓ |
| `grep -c "couch-v32-pre-launch-polish" sw.js` | 1 |
| `grep -c "couch-v31-fix-couch-nights-heroes" sw.js` | 0 (old version removed) |
| `node --check js/app.js` | exit 0 |
| `node --check sw.js` | exit 0 |

## LOC delta

- `js/app.js`: +90 (new constants ~+30, savePerEventToggle ~+20, refactored render +40, status copy refresh net 0)
- `css/app.css`: +100 (Phase 12 / POL-01 section)
- `sw.js`: 1 line (CACHE bump)

## Deploy steps (deferred for orchestrator)

Mirror `app.html` (unchanged) + `js/app.js` + `css/app.css` + `sw.js` to `queuenight/public/`, then `firebase deploy --only hosting` from `C:/Users/nahde/queuenight/`. PWA installs auto-invalidate on the v32 cache key — users see the new toggle UI on next online launch.

## Self-Check: PASSED
