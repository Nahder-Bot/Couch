---
phase: 16-calendar-layer
plan: 08
subsystem: client-ui
tags: [watchparty, post-session, recurring-prompt, tv-only-gate, cadence-inference, series-create-prefill]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 06
    provides: window.openSeriesCreate(prefill) modal lifecycle accepting {titleType, titleId, titleName, daysOfWeek, timeOfDay, memberIds} — this plan calls it with cadence inferred from wp.startAt
  - phase: 11-feature-refresh-and-streamline
    plan: 05
    provides: #wp-post-session-modal-bg modal shell + window.openPostSession(wpId) lifecycle — this plan bolts in a new tile + injects a toggle block before the modal opens
provides:
  - "#wp-make-recurring-cta button inside #wp-post-session-modal-bg (display:none default; sibling of #wp-schedule-next-cta)"
  - "window.openMakeRecurring(wpId) — TV-only series-create-with-prefill handler; infers dow + HH:MM from wp.startAt in wp.creatorTimeZone via Intl.DateTimeFormat"
  - "TV-only visibility gate inside openPostSession — runs unconditionally on every open, sets display + onclick only when t.kind === 'TV' && wp.titleId"
affects:
  - "Plan 16-10 (Deploy wave) — bundles the tile + handler into the launch deploy + sw.js bump. No queuenight changes from this plan."

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Intl.DateTimeFormat formatToParts() for tz-aware dow + HH:MM extraction (same pattern Phase 15 used for live-release scheduling and Phase 7 used for wp creatorTimeZone capture)"
    - "openSeriesCreate(prefill) reuse from plan 16-06 — zero new code path; prefill object shape was designed in 16-06 specifically to support this Entry 2 flow"
    - "Toggle-on-every-open visibility pattern — runs unconditionally inside openPostSession so non-TV wps explicitly hide the tile + clear its onclick (T-16-30 mitigation; matches openPostSession's existing reset pattern for .wp-rating-star + #wp-rating-confirm + #wp-photo-preview + #wp-photo-upload-tile)"
    - "Defensive try/catch around Intl computation with fallback defaults (Sun + 20:00) — T-16-31 mitigation; user reviews + edits the cadence in the series-create modal before confirmStartSeries runs (which validates server-side via firestore.rules from plan 16-01)"
    - "Pre-close the source modal before opening the destination modal — prevents z-index stacking. Same pattern Phase 7 used for wp-start → wp-live transition."

key-files:
  created:
    - .planning/phases/16-calendar-layer/16-08-SUMMARY.md
  modified:
    - app.html (1 hunk — #wp-make-recurring-cta tile + Phase 16 comment, 3 lines)
    - js/app.js (2 edit sites — openMakeRecurring handler after saveSeriesEdit + TV-only toggle block inside openPostSession, 80 lines net new)

key-decisions:
  - "Toggle block runs unconditionally on EVERY openPostSession call (not just inside an existing TV branch) — explicitly sets display:none + onclick=null for non-TV. The existing openPostSession already has a t.kind === 'TV' branch at line 13890 for the tuple auto-track logic, but that branch is gated on wpParticipants.length >= 1 AND tier-resolution success — too narrow. We need the toggle to run on every open so the tile is correctly hidden after a non-TV wp (movies, sports, untitled) clears any prior visibility. T-16-30 mitigation."
  - "tz fallback uses Intl.DateTimeFormat().resolvedOptions().timeZone wrapped in try/catch with 'UTC' default — same shape as confirmStartSeries (plan 16-06) and saveSeriesEdit (plan 16-07). Keeps the timezone-capture vocabulary consistent across the Phase 16 surface."
  - "openMakeRecurring handler placed immediately after window.saveSeriesEdit (line 16483) — keeps all Phase 16 client handlers co-located in source for cherry-pick stability. Plan 16-07's saveSeriesEdit was the previous bottom edit; this plan extends downward from there."
  - "Toggle block placed AFTER all the rating/photo reset DOM operations but BEFORE bg.classList.add('on') — runs while the modal is still hidden, so the visibility flip happens before paint. No flash-of-stale-state risk."
  - "memberIds back-resolved from wp.memberUids via state.members (filter m.uid in wp.memberUids → map to m.id) — required because the wp's persistent schema stores UIDs but the series-create modal's member-chip state keys on member.id (m_xxx). This mirrors plan 16-06's openSeriesCreate(prefill) which already accepts memberIds in that shape."
  - "Onclick wired DYNAMICALLY in JS (recurringTile.onclick = function() { openMakeRecurring(wpId); }) NOT statically in HTML — required because the openPostSession handler needs to capture the wpId at open-time. Same lifecycle pattern as the #wp-photo-input change-listener which is hardcoded but reads from _postSessionWpId at call time."
  - "Tile copy: 'Make this recurring' (not 'Make this recurring?' with a question mark) — matches the imperative-action voice of the sibling buttons in the modal ('Add a couch photo' / 'Schedule another night' / 'Maybe later'). The prompt context is established by the modal's existing 'That's a wrap.' header."

patterns-established:
  - "Tile inserted between #wp-photo-preview and .wp-schedule-next-cta at app.html line 1376 — visual sibling of Schedule-another-night, semantic continuation of the post-session action surface. Both tiles emit transition flows (one to a new wp instance, one to a series doc)."
  - "Toggle block inserted at js/app.js line 13964 (immediately before bg.classList.add('on')) — guarantees the visibility flip happens before paint. Inside the same try/catch boundary as the existing reset logic for adjacent fields."

requirements-completed: [CAL-16-09]

# Metrics
duration: 1.5min
completed: 2026-05-28
---

# Phase 16 Plan 08: TV-Only "Make This Recurring" Post-Session Prompt Summary

**Entry 2 ships: after a TV-show one-off watchparty ends, the post-session modal surfaces a "Make this recurring" tile. Tap → opens the series-create modal pre-filled with cadence (day-of-week + HH:MM) inferred from the wp's startAt in its creator timezone, plus the title, memberIds, and titleType. User can refine before confirming. Movies, sports games, and untitled wps never see the tile.**

## Performance

- **Duration:** ~1.5 min (2026-05-28T00:45:02Z → 2026-05-28T00:46:30Z)
- **Started:** 2026-05-28T00:45:02Z
- **Completed:** 2026-05-28T00:46:30Z
- **Tasks:** 1 / 1
- **Files modified:** 2 (app.html + js/app.js)

## Accomplishments

- New HTML tile `#wp-make-recurring-cta` (3 lines including Phase 16 comment) inside `#wp-post-session-modal-bg` at app.html line 1377. Default `style="display:none;"` — visibility is owned exclusively by the JS toggle block inside openPostSession. Sibling of the existing `.wp-schedule-next-cta` and `.wp-post-session-skip` buttons; positioned BETWEEN the photo-preview slot and the Schedule-another-night CTA to preserve visual hierarchy (recurring is a heavier commitment than scheduling one more night, so it sits closer to the modal's content stack).
- New `window.openMakeRecurring(wpId)` handler in js/app.js, placed immediately after `window.saveSeriesEdit` (plan 16-07) so all Phase 16 series-handler code stays co-located. Behavior:
  1. **Guards:** wpId presence → wp lookup → titleId presence → title lookup → t.kind === 'TV' check. Each guard issues a flashToast warn on miss and returns. Movies, sports games, untitled wps cannot proceed past the guards.
  2. **Cadence inference:** Intl.DateTimeFormat('en-US', {timeZone, weekday: 'short'}).formatToParts(new Date(wp.startAt)) → weekday short-name → indexed against ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'] for dow. Second Intl call with {hour: '2-digit', minute: '2-digit', hour12: false} → 'HH:MM' string. Both wrapped in a try/catch with fallback dow=0 + timeOfDay='20:00' on Intl failure (malformed wp.startAt).
  3. **Timezone resolution:** wp.creatorTimeZone if present, else Intl.DateTimeFormat().resolvedOptions().timeZone with UTC fallback. Same fallback chain as confirmStartSeries + saveSeriesEdit.
  4. **memberIds back-resolution:** filter state.members for m.uid present in wp.memberUids, map to m.id. Series-create modal keys member-chips on m.id (not uid), so this back-resolve is required.
  5. **Source-modal close:** post-session modal-bg gets `.on` class removed before opening the series-create modal. Prevents z-index stacking.
  6. **Destination-modal open:** `openSeriesCreate({titleType: 'tv', titleId, titleName, daysOfWeek: [dow], timeOfDay, memberIds})` — passes the full prefill object that plan 16-06's openSeriesCreate signature was designed for.
- New TV-only visibility toggle block inside openPostSession at line 13964 (immediately before `bg.classList.add('on')`). Runs unconditionally on every openPostSession call. Behavior: lookup the tile DOM → lookup the title via wp.titleId → if t.kind === 'TV' && wp.titleId, set display:block + bind onclick=openMakeRecurring(wpId); otherwise set display:none + clear onclick. Wrapped in try/catch with console.warn fallback so a failure here can't break the rest of the post-session open path. T-16-30 mitigation: explicit hide on non-TV ensures the tile doesn't leak visibility across multiple post-session opens.
- Threats addressed:
  - **T-16-30 (UI confusion — tile leaks visible across opens):** mitigate. Toggle block runs unconditionally on every openPostSession call; explicitly sets display:none + onclick=null for any non-TV wp.
  - **T-16-31 (Tampering — malformed wp.startAt produces bogus cadence prefill):** mitigate. try/catch around Intl computation with fallback dow=0 + timeOfDay='20:00'. User reviews + edits in series-create modal before confirmStartSeries (which validates server-side via firestore.rules from plan 16-01).
  - **T-16-32 (Information Disclosure — non-host sees recurring CTA for a wp they don't host):** accept per locked scope. All wp memberUids see post-session modal already; series creation respects memberUids gating (series's memberUids inherits from wp.memberUids). Documented in plan threat model; no code changes required.
- ASVS L1: V5 Input Validation ✓ (defensive try/catch + fallback defaults; final validation server-side via firestore.rules from plan 16-01).

## Task Commits

Each task was committed atomically on `hotfix/phase-30-cross-cutting-wave`:

1. **Task 1: Add #wp-make-recurring-cta tile to app.html + openMakeRecurring handler + TV-only gate in openPostSession** — `3cc6fbb` (feat)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Files Created/Modified

- `app.html` — 3 lines net new at line 1377 (between `#wp-photo-preview` slot at 1376 and `.wp-schedule-next-cta` button which was at 1377, now at 1380). New `<button id="wp-make-recurring-cta" style="display:none;">Make this recurring</button>` preceded by a 2-line `<!-- Phase 16 / CAL-16-09 -->` comment.
- `js/app.js` — 80 lines net new across 2 edit sites:
  - **EDIT A (line ~13964, inside openPostSession):** 17-line TV-only toggle block + Phase 16 CAL-16-09 comment. Runs unconditionally on every open; show/hide gated on `t.kind === 'TV' && wp.titleId`.
  - **EDIT B (line ~16489, after saveSeriesEdit):** 63-line `window.openMakeRecurring(wpId)` handler. Guards → Intl tz infer → memberIds back-resolve → source-modal close → openSeriesCreate(prefill).

## Decisions Made

- **Toggle block runs unconditionally on every openPostSession call, NOT just inside the existing t.kind === 'TV' branch at line 13890.** That existing branch is the tuple auto-track gate, which is itself gated on wpParticipants.length >= 1 AND resolveAutoTrackEpisode returning a value. Too narrow — a TV wp with no participants OR one where tier-resolution fails would skip the branch and never run a tile-visibility update. Worse, the tile would inherit visibility from a prior open (e.g., a TV wp opened first, then a movie wp opened second). The toggle MUST run every time. T-16-30 mitigation.
- **Toggle placed AFTER all the rating/photo reset DOM operations but BEFORE bg.classList.add('on').** Two reasons: (a) keeps it in the same "reset DOM before showing modal" phase as the existing star-row reset / photo-preview clear / photo-upload-tile reset — semantically consistent; (b) the visibility flip happens before paint, so users never see a flash-of-stale-state.
- **Onclick wired DYNAMICALLY in JS, not statically in HTML.** The handler needs to capture the wpId at open-time. Could not use a static `onclick="openMakeRecurring(?)"` in HTML because we don't know wpId until openPostSession fires. Pattern matches the `wp-photo-input` change-listener which is hardcoded but reads from module-level `_postSessionWpId` at call time. Choosing dynamic wiring over module-level state for openMakeRecurring is cleaner because: (a) one fewer module-level variable to track; (b) closure-captures wpId explicitly, so a second openPostSession call automatically rebinds with the new wpId.
- **Defensive try/catch around Intl with Sun + 20:00 fallback.** T-16-31 mitigation. Real-world wp.startAt values come from Date.now() at creation, so malformed values are vanishingly rare — but a defensive fallback is cheap and prevents one bad value from blocking the whole flow. The user reviews + edits the prefilled cadence in the series-create modal before confirmStartSeries runs anyway, so the fallback values are functionally low-stakes.
- **memberIds back-resolution from wp.memberUids via state.members (uid → id mapping).** wp persistent schema stores memberUids (Firebase Auth uids), but the series-create modal's member-chip state uses memberIds (m_xxx synthetic ids). Same back-resolve pattern openSeriesEdit (plan 16-07) uses on load. The mapping is lossy in one direction (a uid without a matching m.uid in state.members is dropped silently) — acceptable because (a) it only matters when a wp survives the family roster being edited mid-flight, and (b) the user can re-add anyone in the modal before saving.
- **Pre-close the source modal before opening the destination modal.** Removes `.on` class from `#wp-post-session-modal-bg` before openSeriesCreate runs. Same pattern Phase 7 used for wp-start → wp-live transitions. Prevents z-index stacking + ensures the focus-trap inside openSeriesCreate is the active one.
- **Tile copy 'Make this recurring' (imperative, no question mark).** Matches the voice of sibling buttons in the modal (Add a couch photo / Schedule another night / Maybe later). The "?" question framing was the colloquial in CONTEXT but the actual button is an action, not a question. The "is this a recurring thing?" question context is established by the parent modal's "That's a wrap." header copy.
- **Tile positioned BETWEEN photo-preview and Schedule-another-night.** Not at the top of the action stack (above Add-a-photo) because recurring is a heavier commitment + lower-frequency action. Not at the bottom (below Maybe-later) because Maybe-later is the dismiss path. Mid-stack matches expected click-targets and visual weight.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Defensive coding] tz fallback wrapped in IIFE with try/catch instead of inline `||` fallback**

- **Found during:** Task 1 EDIT B implementation
- **Issue:** Plan listed `const tz = wp.creatorTimeZone || (Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC')` — but `Intl.DateTimeFormat().resolvedOptions().timeZone` can throw in some sandboxed environments (very rare, but the existing plan-16-06 + plan-16-07 code wrapped it in try/catch).
- **Fix:** Wrapped the Intl call in an IIFE with try/catch + UTC fallback, matching the pattern in confirmStartSeries (plan 16-06) and saveSeriesEdit (plan 16-07).
- **Files modified:** js/app.js (openMakeRecurring handler — tz computation lines)
- **Commit:** 3cc6fbb (part of Task 1; not split into its own commit because it's a stylistic consistency tweak inside a larger handler)

No functional behavior changed — the fallback chain still resolves to 'UTC' on the worst case, the only difference is the try/catch placement. Keeps the Phase 16 surface vocabulary consistent across all 3 tz-capture sites (confirmStartSeries / saveSeriesEdit / openMakeRecurring).

### Architectural Changes

None.

---

**Total deviations:** 1 cosmetic (try/catch placement), 0 functional. Plan executed as written modulo a 3-line consistency tweak.

## Authentication Gates

None. Operates against the existing watchparties + titles state; no new external service or auth boundary introduced. openSeriesCreate / confirmStartSeries are the ultimate write paths and they already validate `state.auth.uid` (from plan 16-06).

## Threat Flags

None — surface introduced is exactly what the threat model enumerated. All 3 Phase-16-Plan-08 threat IDs (T-16-30, T-16-31, T-16-32) are mitigated/accepted per the plan's threat register. No NEW attack surface beyond what CONTEXT/RESEARCH planned.

## Known Stubs

None introduced. The plan completes a feature end-to-end: user taps the tile → series-create modal opens with prefill → user confirms → existing confirmStartSeries (plan 16-06) writes the series doc → materializer CF (plan 16-03) picks it up on next 6h tick. No half-wired UI surfaces.

## Smoke Gate Status

No regressions:

- `node scripts/smoke-app-parse.cjs` — 11 passed / 0 failed (js/app.js parses cleanly with both edits)
- `node scripts/smoke-series-cadence-compute.cjs` — 12 passed / 0 failed (Plan 16-02 contract unchanged)
- `node scripts/smoke-series-idempotency.cjs` — 11 passed / 0 failed (Plan 16-03 contract unchanged)
- `node scripts/smoke-series-materializer.cjs` — 33 passed / 0 failed (Plan 16-03 + 16-04 contract unchanged)

Phase 16 smoke gate total: **56 sentinels green** (unchanged — this plan adds UI/client-handler surface; the smoke contracts didn't grow because Plan 16-10 will own the deploy-wave smoke).

## Issues Encountered

None blocking. One layout consideration during EDIT 2b placement: openPostSession has an existing `t.kind === 'TV'` branch at line 13890 used for tuple auto-track. That branch is too narrow (gated on wpParticipants.length >= 1 + tier-resolution success) to host the tile-visibility toggle — it would leave the tile in a stale state on non-TV wps or on TV wps with no participants. Resolved by placing the toggle at line 13964 (immediately before the modal opens) where it runs unconditionally and self-handles the show/hide decision.

## Wave 9 / Plan 16-10 Deploy Ordering Note

This plan is local commits only on couch repo. When Plan 16-10 deploys:
- couch hosting: pick up app.html + js/app.js via `bash scripts/deploy.sh <cache-tag>` from couch repo root.
- sw.js CACHE bump: auto-applied by deploy.sh (passes the tag as the new cache version).
- No queuenight changes in this plan.

## User Setup Required

None — no external service configuration. The tile is a pure client-side affordance over the existing post-session modal + series-create modal.

## Next Phase Readiness

- **Wave 8 (final smoke + UAT scaffold):** Ready. The full Entry 2 flow is wired end-to-end and ready for device UAT — finish a TV wp → expect tile; finish a movie wp → expect no tile; finish a sports game → expect no tile; tap tile → series-create modal pre-fills with inferred Mon/Tue/etc + HH:MM matching the wp's startAt in family tz; confirm → series doc lands in /watchpartySeries; series surfaces in Account-tab list (plan 16-05).
- **Wave 9 (Plan 16-10 deploy):** Ready. No remaining plans depend on this code path.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `app.html` modified and contains `id="wp-make-recurring-cta"` (verified via grep, count=1).
- File `app.html` contains `CAL-16-09` (verified via grep, count=1).
- File `app.html` contains the default-hidden state `id="wp-make-recurring-cta" style="display:none;"` (verified via grep, count=1).
- File `js/app.js` modified and contains all sentinels:
  - `window.openMakeRecurring` (count=1)
  - `t.kind !== 'TV'` (count=12 — pre-existing pattern, includes the new guard at line ~16498)
  - `wp-make-recurring-cta` (count=1 — the toggle's getElementById)
  - `CAL-16-09` (count=2 — toggle-block comment + handler comment)
- Inline sentinel verifier (`node -e ...`) from plan exits 0 with `OK: 16-08 sentinels present in app.html + js/app.js`.
- Commit `3cc6fbb` (Task 1) exists in `git log` on current branch `hotfix/phase-30-cross-cutting-wave` (verified).
- No file deletions on the commit (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` — output empty).
- Smoke gate green: 11 (smoke-app-parse) + 12 (cadence-compute) + 11 (idempotency) + 33 (materializer) = 67 sentinels across 4 contracts, zero failed.
- No inline styles introduced beyond the intentional `style="display:none;"` on the tile (matches the existing #wp-rating-confirm and #wp-photo-preview siblings in the same modal).
- No new hardcoded colors, no new fonts, no new tokens.
- No deploys triggered; no sw.js bumps applied (deferred to Plan 16-10).
- Both EDIT sites visible in git diff (toggle in openPostSession at line 13964; handler after saveSeriesEdit at line 16489).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
