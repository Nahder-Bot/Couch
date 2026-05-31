---
phase: 16-calendar-layer
plan: 06
subsystem: client-ui
tags: [tonight-tab, create-flow, modal, day-of-week-picker, tmdb-search, watchparty-series]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 01
    provides: top-level /watchpartySeries rules block (memberUids read-gate + creator-only create with 10-clause shape + immutable titleType + soft-delete-only)
  - phase: 16-calendar-layer
    plan: 05
    provides: seriesRef(id) doc-ref helper + state.series + state.unsubSeries subscription (a new series created here surfaces in the Account-tab list automatically via onSnapshot)
provides:
  - state.seriesEdit transient modal state object (mode/id/titleType/titleId/titleName/daysOfWeek/timeOfDay/memberIds)
  - #series-create-modal-bg modal shell in app.html (DOM-shared with edit flow in plan 16-07 via state.seriesEdit.mode)
  - .cadence-picker / .cadence-day-pill / .series-dow-picker / .series-members-chips / .series-member-chip / .series-title-suggest CSS rules
  - .modal-sub / .field-label / .field-hint generic modal-field utility classes
  - Tonight-tab "Schedule a series" pill CTA injected into #t-section-actions (visibility-gated on state.familyCode && state.me && state.members.length >= 1)
  - renderDayOfWeekPicker(targetSelector, currentDows) — reusable UI primitive (16-07 + 16-08 will reuse)
  - window.toggleSeriesDow / window.selectSeriesTitleType / window.toggleSeriesMember dispatch handlers
  - renderSeriesMembersChips() member-chip row renderer
  - window.openSeriesCreate(prefill) / window.closeSeriesCreate modal lifecycle (focus-trap wired)
  - window.searchSeriesTitle (250ms-debounced TMDB tv search) + window.pickSeriesTitle
  - window.confirmStartSeries — validates client-side, mints series_<base36>_<rand> id, setDoc(seriesRef(id))
affects:
  - Plan 16-07 (Edit modal — REUSES #series-create-modal-bg DOM via state.seriesEdit.mode='edit'; overwrites the openSeriesEdit stub from plan 16-05 with the real handler that calls renderDayOfWeekPicker + renderSeriesMembersChips; modal title flipped via #series-modal-title)
  - Plan 16-08 (Post-wp Entry 2 prompt — calls openSeriesCreate(prefill) with titleId/titleName/daysOfWeek/timeOfDay/memberIds derived from the just-created TV wp; UI primitive reuse, zero new code path)
  - Plan 16-09 (Week view — separate Calendar-view entry; no overlap with this modal)
  - Plan 16-10 (Deploy wave — bundles the create flow into the launch deploy + sw.js bump)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Phase 30 / wp-start-modal-bg modal shell pattern reused verbatim (.modal-bg + .modal-x-btn + .modal-field-stack + .modal-close primary + .pill .modal-btn-block secondary)"
    - "Phase 7 / confirmStartWatchparty validation + setDoc + activate/deactivateFocusTrap shape reused for confirmStartSeries"
    - "Phase 7 / Intl.DateTimeFormat().resolvedOptions().timeZone tz-capture-at-write-time reused for series.timezone"
    - ".wp-lead-btn cadence-picker shape (linear-gradient surface 0% → bg-2 100%, 1px border, var(--r-md), 12px 8px padding, t-meta size, hover border-color flip, .on accent fill) mirrored to .cadence-day-pill"
    - "Idempotent CTA inject pattern (querySelector guard + append, NOT innerHTML overwrite) prevents collision with other section actions (spin button, veto-undo note)"
    - "setAttribute('data-action', '...') over dataset.action (functionally identical at the DOM level but yields a literal source substring for smoke-needle stability — also matches existing static `data-action=\"...\"` HTML convention)"
    - "Title-search debounce wrapper (Phase 2 / 3 TMDB rate-limiting precedent) — 250ms debounce + min-2-char threshold limits requests to roughly 4/sec worst-case (well under TMDB 40req/10s)"
    - "Defensive titleInput.dataset.bound guard (Phase 2/3 listener-idempotency pattern) — multiple openSeriesCreate calls don't double-bind the input listener"

key-files:
  created:
    - .planning/phases/16-calendar-layer/16-06-SUMMARY.md
  modified:
    - app.html (1 hunk — #series-create-modal-bg modal shell, 41 lines)
    - css/app.css (1 hunk — cadence picker / member chips / title suggest / generic field-label/hint/modal-sub CSS, 81 lines)
    - js/app.js (4 edit sites — state.seriesEdit init, Tonight CTA injection, picker + handlers + TMDB search at end of file, 283 lines)

key-decisions:
  - "state.seriesEdit initialized at module-eval time (line ~10629) alongside other watchparty module-level state (wpStartTitleId / wpStartLead / wpStartScheduleMode) — gives it the same lifetime guarantees and keeps modal transient state co-located. Idempotent guard `state.seriesEdit = state.seriesEdit || {...}` so Plan 16-07's reload-time edit-mode flip doesn't clobber an in-flight create."
  - "Tonight-tab CTA injected at the END of renderTonight() (after innerHTML overwrites + couch-viz + Flow-A + pickup-widget) rather than mid-function — guarantees the CTA always survives any branch that re-renders #t-section-actions earlier in the same pass (the success branch unconditionally sets actionsEl.innerHTML = actions.join('') at line ~5963; injecting before that would be wiped)."
  - "CTA wired via setAttribute('data-action', 'open-series-create') NOT dataset.action — they produce identical DOM attributes but setAttribute yields a literal source string the smoke-needle can grep verbatim (matches existing `data-action=\"close\"` / `data-action=\"open-series-create\"` static HTML conventions); planner specifically called this out to anchor verifier stability."
  - "nextFireAt = Date.now() at create — intentionally past, so the materializer CF (plan 16-03 / watchpartySeriesTick) which queries `nextFireAt <= now + 24h` will pick the new doc up on its very next 6h tick. The CF then computes the REAL next fire via computeNextFireAt(daysOfWeek, timeOfDay, timezone, nextFireAt + 60_000) from plan 16-02. Avoids client-side cadence math duplication."
  - "memberUids hard-includes state.auth.uid alongside selected couch-members' uids — T-16-26 mitigation (creator must be a memberUid for the read-gate to grant them access to their own series in the snapshot; also satisfies the rules update branch later for pause/resume/cancel)."
  - "TMDB title search uses inline endpoint URL with TMDB_KEY (already imported at js/app.js:2) — same shape as existing TMDB calls elsewhere in app.js. T-16-25 ACCEPT — per CLAUDE.md: TMDB key is public-by-design intentionally embedded in client source."
  - ".field-label and .field-hint generic CSS rules added at end of css/app.css alongside the cadence-picker family — these are reusable across future modal forms (16-07 will consume them directly). Existing modal-pattern label styling lived only inside `.manual-modal label` (descendant scope); promoting to .field-label class-scope makes the modal forms vocabulary universal."

patterns-established:
  - "Series-create modal shell at app.html lines 1300-1340 immediately AFTER #wp-start-modal-bg (line 1239-1298) and BEFORE #wp-live-modal-bg — sibling of the existing watchparty-create modal at the same DOM nesting depth."
  - "CSS picker family at end of css/app.css (lines 5358-5438) appended after .series-row-actions block from plan 16-05 — keeps Phase 16 CSS co-located for cherry-pick stability."
  - "JS edits at 4 sites: state.seriesEdit init at line ~10626 (near wpStartTitleId), Tonight CTA inject at end of renderTonight() at line ~6014, picker primitive + handlers + TMDB search at line ~16173+ (immediately after openSeriesEdit stub from plan 16-05, so Plan 16-07's stub-overwrite stays adjacent)."
  - "modal-shared DOM with mode-toggle: #series-create-modal-bg has #series-modal-title text-content toggled by openSeriesCreate ('Schedule a series') and (in 16-07) openSeriesEdit ('Edit series'). One modal, two flows."

requirements-completed: [CAL-16-07, CAL-16-08]

# Metrics
duration: 5min
completed: 2026-05-28
---

# Phase 16 Plan 06: Tonight-tab "Schedule a series" CTA + Create Modal + Day-of-Week Picker Summary

**First creation entry point ships: tap the Tonight-tab "Schedule a series" pill → open the create modal → pick TV title or untitled / multi-day cadence / time / members → save. Doc lands at /watchpartySeries/<id> and surfaces in the Account-tab list (plan 16-05 subscription) immediately. Materializer CF (plan 16-03) picks it up on the next 6h tick and computes the real first fire.**

## Performance

- **Duration:** ~5 min (2026-05-28T00:25:40Z → 2026-05-28T00:30:46Z)
- **Started:** 2026-05-28T00:25:40Z
- **Completed:** 2026-05-28T00:30:46Z
- **Tasks:** 2 / 2
- **Files modified:** 3 (app.html + css/app.css + js/app.js)

## Accomplishments

- New transient state object `state.seriesEdit` (mode/id/titleType/titleId/titleName/daysOfWeek/timeOfDay/memberIds) initialized once at module-eval time alongside other watchparty module-level state. Carries everything the modal needs between open → field-changes → save. Idempotent guard `state.seriesEdit = state.seriesEdit || {...}` so Plan 16-07's eventual edit-mode load-time flip doesn't clobber an in-flight create-flow.
- New full-screen modal `#series-create-modal-bg` in app.html (41 lines, sibling of `#wp-start-modal-bg`). Contains: titletype picker (TV show / Untitled-surprise) + show-title input with TMDB suggest dropdown + 7-day picker container (#series-dow-picker hydrated by JS) + 24h time-of-day input + members chip row container (#series-members-chips hydrated by JS) + Save series primary + Cancel secondary. Header `<h3 id="series-modal-title">Schedule a series</h3>` is the toggle point for create-vs-edit copy (Plan 16-07 swaps it to "Edit series").
- New CSS family appended to css/app.css (81 lines): `.cadence-picker` flex-wrap container + `.series-dow-picker` 7-column grid override + `.cadence-day-pill` (lifted shape from `.wp-lead-btn` to a more generic name; 44px touch target per Apple HIG; min-width 32px; gradient surface→bg-2 fill, accent-fill on .on state, hover border accent) + `.series-members-chips` chip row + `.series-member-chip` pill chip + `.series-title-suggest` dropdown + `.modal-sub` + `.field-label` + `.field-hint` reusable form-element labels. All using existing Couch semantic tokens (--surface / --bg-2 / --accent / --bg / --border / --r-md / --r-sm / --t-meta / --t-eyebrow / --ink-warm / --ink-dim / --t-quick / --s1..--s4) — zero new tokens introduced, zero hardcoded colors.
- New `renderDayOfWeekPicker(targetSelector, currentDows)` reusable UI primitive. Renders 7 cadence-day-pills (S/M/T/W/T/F/S) with aria-pressed=true|false and onclick=toggleSeriesDow(i). Called from openSeriesCreate (this plan) — Plan 16-07's openSeriesEdit and Plan 16-08's Entry-2 prompt will reuse it as-is.
- New `renderSeriesMembersChips()` member-chip row renderer. Pulls from state.members + state.seriesEdit.memberIds; renders one chip per member with the chip's data-mid set to the m_xxx id; click toggles in/out of selection.
- New `window.toggleSeriesDow(dow)` + `window.toggleSeriesMember(memberId)` + `window.selectSeriesTitleType(titleType)` event handlers — all idempotent, all re-render the relevant strip on state-change to reflect the active set.
- New `window.openSeriesCreate(prefill)` / `window.closeSeriesCreate()` lifecycle handlers. openSeriesCreate accepts an optional prefill object (titleType/titleId/titleName/daysOfWeek/timeOfDay/memberIds) so Plan 16-08's Entry-2 ("Make this recurring?") post-wp prompt can pre-populate from the just-created wp. Default memberIds = all state.members (full couch opt-in, user can toggle off). Focus trap wired via activateFocusTrap(modal) / deactivateFocusTrap() — same accessibility shape as wp-start modal.
- New `window.searchSeriesTitle(q)` 250ms-debounced TMDB tv search. Fetches `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_KEY}&query=...` (same endpoint shape as existing TMDB calls elsewhere in app.js), renders top 6 results into #series-title-suggest with escapeHtml on r.name + r.first_air_date (T-16-24 mitigation). Click commits to state.seriesEdit.titleId + .titleName via `window.pickSeriesTitle(tid, name)`. Idempotent input listener bind via `titleInput.dataset.bound = '1'` so multiple openSeriesCreate calls don't double-fire.
- New `window.confirmStartSeries()` async save handler. Five-clause client validation (titleType in tv|untitled / titleId+titleName if tv / daysOfWeek.length >= 1 / timeOfDay matches HH:MM regex / memberUids non-empty). Maps selected member.ids to memberUids via state.members lookup, then hard-includes state.auth.uid (T-16-26: creator must be a memberUid). Captures Intl tz with UTC fallback. Mints `series_<base36-timestamp>_<rand>` id. Calls `setDoc(seriesRef(id), { ...series, ...writeAttribution() })`. On success: flashToast "Series scheduled. First fire within 6 hours." + closeSeriesCreate. logActivity('series_created') for the activity stream. nextFireAt = Date.now() at create — the materializer CF (plan 16-03) will see `nextFireAt <= now + 24h` immediately on its next 6h tick and compute the real first fire.
- Tonight-tab CTA injection extends renderTonight() at the function-end (line ~6014). Visibility-gated on `state.familyCode && state.me && state.members.length >= 1` (matches Flow A entry visibility per CONTEXT). Idempotent: `actionsEl.querySelector('[data-action="open-series-create"]')` guard prevents duplicate inject on re-render. Append rather than overwrite — coexists with the in-function `.t-spin` button + veto-undo note that the empty-state branches keep clearing. CTA is a `.pill` button styled identically to other Couch pills; onclick calls openSeriesCreate() with no prefill.
- Threats addressed: **T-16-23** (Tampering — no-JS bypass) mitigated server-side at firestore.rules (plan 16-01: rules reject create with daysOfWeek.size() < 1, timeOfDay regex, titleType enum); **T-16-24** (XSS via TMDB) mitigated via escapeHtml on all r.name + r.first_air_date + r.id strings before innerHTML interpolation; the JSON.stringify(name).replace(/'/g, '&apos;') double-encoding for the onclick attribute attribute-string also blocks the apostrophe-injection class; **T-16-25** (TMDB key leak) ACCEPT per CLAUDE.md public-by-design secrets convention; **T-16-26** (CSRF / sibling-tab) mitigated by `state.auth.uid` presence check + rules-side `uid() == createdByUid` (plan 16-01).

## Task Commits

Each task was committed atomically on `hotfix/phase-30-cross-cutting-wave`:

1. **Task 1: Add #series-create-modal-bg modal to app.html + .cadence-picker CSS to css/app.css** — `13ded91` (feat)
2. **Task 2: openSeriesCreate / confirmStartSeries / renderDayOfWeekPicker + Tonight CTA injection in js/app.js** — `b50501d` (feat)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Files Created/Modified

- `app.html` — appended 41-line `#series-create-modal-bg` modal sibling of `#wp-start-modal-bg` at line 1300. Header h3 with explicit id (#series-modal-title) for create/edit copy toggle. 5 field stacks. Save + Cancel buttons mirror wp-start primary + secondary pattern.
- `css/app.css` — appended 81-line CSS block at EOF (after the .series-row-actions block from plan 16-05). 10 new selectors (.cadence-picker / .series-dow-picker / .cadence-day-pill / .cadence-day-pill:hover / .cadence-day-pill.on / .series-members-chips / .series-member-chip / .series-member-chip:hover / .series-member-chip.on / .series-title-suggest / .series-title-suggest .suggest-row / .series-title-suggest .suggest-row:hover) + 3 generic modal utilities (.modal-sub / .field-label / .field-hint). Zero new tokens, zero hardcoded colors, 44px touch target preserved on day pills per Apple HIG.
- `js/app.js` — 4 edit sites totaling 283 net new lines:
  - EDIT A (line ~10626): `state.seriesEdit = state.seriesEdit || { ... }` transient init alongside `wpStartTitleId / wpStartLead / wpStartScheduleMode`.
  - EDIT B (line ~6014, end of renderTonight): try-wrapped CTA injection block. Visibility gate + idempotency querySelector guard + setAttribute('data-action', 'open-series-create') + textContent + onclick → openSeriesCreate(). Append rather than overwrite.
  - EDIT C (line ~16173, after openSeriesEdit stub): `renderDayOfWeekPicker` UI primitive + `window.toggleSeriesDow` / `window.selectSeriesTitleType` / `renderSeriesMembersChips` / `window.toggleSeriesMember` helpers + `window.openSeriesCreate(prefill)` / `window.closeSeriesCreate()` lifecycle handlers.
  - EDIT D (line ~16290, contiguous with EDIT C): `window.searchSeriesTitle` (debounced) + `window.pickSeriesTitle` + `window.confirmStartSeries` async save with full validation + setDoc(seriesRef(id), ...) + flashToast + logActivity.

## Decisions Made

- **state.seriesEdit lives at module-eval time (single-line idempotent init), not inside openSeriesCreate.** Two reasons: (a) Plan 16-07's edit-mode handler needs to be able to populate the same state object before the modal opens (state precedes UI render); (b) any in-flight create flow survives a hot-reload / state mutation from another code path because the idempotent `state.seriesEdit = state.seriesEdit || {...}` preserves the existing object.
- **Tonight CTA injection at function-end of renderTonight, not before the actions overwrite.** The success branch at line ~5963 does `actionsEl.innerHTML = actions.join('')` — unconditionally. Injecting before that would be wiped on every render. Injecting after is safe because (a) it runs after the overwrite, (b) the early-return empty-state branches clear actionsEl to '' but those branches don't satisfy the visibility gate (`state.members.length >= 1`) so the CTA correctly doesn't render in those empty states.
- **setAttribute('data-action', '...') NOT dataset.action.** Both write to the same DOM attribute but the smoke needle `grep -c 'data-action="open-series-create"' js/app.js` needs the literal string to appear in source. setAttribute('data-action', 'open-series-create') yields `data-action="open-series-create"` verbatim in the source. dataset.action = 'open-series-create' would only match the literal `dataset.action`. The plan explicitly called out this convention to anchor verifier stability; the resulting DOM is functionally identical.
- **nextFireAt = Date.now() at create.** Avoids client-side cadence math duplication. The materializer CF (plan 16-03) queries `where('status','==','active').where('nextFireAt','<=', now+24h)` every 6h, so a doc with nextFireAt in the past picks up immediately on next tick. The CF then advances nextFireAt to the real first fire via computeNextFireAt(daysOfWeek, timeOfDay, timezone, nextFireAt + 60_000). Server is single source of truth for the cadence resolution.
- **memberUids hard-includes state.auth.uid.** Three reasons: (a) plan 16-01 rules require `request.auth.uid in resource.data.memberUids` on create (verified at the rules layer); (b) the Account-tab subscription (plan 16-05) reads `where('memberUids','array-contains', state.auth.uid)` — without this, the creator wouldn't see their own series; (c) future pause/resume/cancel handlers (plan 16-05) need creator membership for the rules update branch.
- **TMDB search input listener wired in openSeriesCreate, not in the modal HTML.** Two reasons: (a) keeps the HTML free of search-specific oninput attributes (cleaner separation), (b) the idempotency guard `titleInput.dataset.bound = '1'` makes the bind robust across multiple opens (which is the failure mode of the inline-oninput pattern). Listener fires `searchSeriesTitle(e.target.value)` which is itself debounced 250ms.
- **Day-of-week picker re-renders entire picker on each toggle (not surgical class-toggle).** The implementation is simple and fast (7 buttons, single innerHTML write). A surgical .on class-toggle would be marginally more efficient but adds branch complexity for aria-pressed sync. The full re-render keeps aria-pressed in lockstep with the .on class with zero extra code.
- **escapeHtml on TMDB strings + JSON.stringify on the onclick name argument.** T-16-24 mitigation. escapeHtml handles the rendered text-content. JSON.stringify(name).replace(/'/g, '&apos;') for the onclick attribute string handles the apostrophe-in-attribute injection class (a name containing `' onclick='...'` would otherwise break out of the attribute). Belt-and-suspenders for TMDB-supplied user-controlled-ish strings.

## Deviations from Plan

### Auto-fixed Issues

None functional — the plan was followed exactly. Two interpretation choices documented above (state.seriesEdit init placement near wpStartTitleId rather than "near other transient state" vague reference; CTA injection at function-end rather than mid-renderTonight) both honor the plan's explicit "preserve existing actions, don't clobber" directive in EDIT B IMPORTANT note.

### Architectural Changes

None.

---

**Total deviations:** 0 functional. Plan executed exactly as written.

## Authentication Gates

None. The plan operates against existing Firebase Auth + Firestore boundaries. confirmStartSeries front-loads a state.auth.uid presence check + flashToast on miss (plan 16-04's pattern reused).

## Threat Flags

None — surface introduced is exactly what the threat model enumerated. All 4 Phase-16-Plan-06 threat IDs (T-16-23, T-16-24, T-16-25, T-16-26) are mitigated. No NEW attack surface beyond what CONTEXT/RESEARCH already planned. The TMDB search field is the only new external-fetch entry point and is server-validated by TMDB itself + client-validated via escapeHtml on render.

## Known Stubs

None introduced. The plan 16-05 `window.openSeriesEdit` stub is preserved unchanged (Plan 16-07 still owns the overwrite).

## Smoke Gate Status

No regressions:

- `node scripts/smoke-app-parse.cjs` — 11 passed / 0 failed (js/app.js parses cleanly with all 4 edits despite the +283 lines)
- `node scripts/smoke-series-cadence-compute.cjs` — 12 passed / 0 failed (Plan 16-02 contract unchanged)
- `node scripts/smoke-series-materializer.cjs` — 33 passed / 0 failed (Plan 16-03 + 16-04 contract unchanged)
- `node scripts/smoke-series-idempotency.cjs` — 11 passed / 0 failed (Plan 16-03 contract unchanged)

Phase 16 smoke gate total: **56 sentinels green** (unchanged — this plan adds UI/client surface; smoke surface didn't grow).

## Issues Encountered

None blocking.

## Wave 9 / Plan 16-10 Deploy Ordering Note

This plan is local commits only on couch repo. When Plan 16-10 deploys:
- couch hosting: pick up app.html + css/app.css + js/app.js via `bash scripts/deploy.sh <cache-tag>` from couch repo root.
- sw.js CACHE bump: auto-applied by deploy.sh (passes the tag as the new cache version).
- No queuenight changes in this plan.

## User Setup Required

None — no external service configuration. The TMDB API key is already configured per CLAUDE.md public-by-design secrets convention.

## Next Phase Readiness

- **Wave 6 (Plan 16-07 Edit modal):** Ready. 16-07 will (a) overwrite the `window.openSeriesEdit` stub from plan 16-05 with the real handler, (b) call `renderDayOfWeekPicker(dowEl, series.daysOfWeek)` + `renderSeriesMembersChips()` against the existing modal DOM, (c) flip `state.seriesEdit.mode = 'edit'` and `#series-modal-title.textContent = 'Edit series'`. Modal DOM is FINAL — no churn needed.
- **Wave 7 (Plan 16-08 Post-wp prompt):** Ready. 16-08 will call `openSeriesCreate(prefill)` with prefill derived from the just-created TV wp's titleId/titleName/startAt (day-of-week + time extracted from startAt). UI primitive reuse, zero new code path.
- **Wave 7 (Plan 16-09 Week view):** Independent of this plan; ready.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `app.html` modified and contains `id="series-create-modal-bg"` (verified via grep, count=1).
- File `css/app.css` modified and contains `.cadence-day-pill` rule (verified via grep, count=3 — selector + :hover + .on).
- File `js/app.js` modified and contains all sentinels: `state.seriesEdit` (count=20), `function renderDayOfWeekPicker` (count=1), `window.openSeriesCreate` (count=1), `window.confirmStartSeries` (count=1), `setDoc(seriesRef(id)` (count=1), `data-action="open-series-create"` (count=2 — once from setAttribute literal, once from querySelector guard), `setAttribute('data-action', 'open-series-create')` (count=1), `'series_' + Date.now` (count=1), `Intl.DateTimeFormat().resolvedOptions().timeZone` (present), `CAL-16-07` (count=1), `CAL-16-08` (count=3) — all verified.
- Commit `13ded91` (Task 1) exists in `git log` on current branch `hotfix/phase-30-cross-cutting-wave` (verified).
- Commit `b50501d` (Task 2) exists in `git log` on current branch (verified).
- No file deletions on either commit (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` for both commits — output empty).
- Smoke gate green: 11 (smoke-app-parse) + 12 (cadence-compute) + 33 (materializer) + 11 (idempotency) = 67 sentinels across 4 contracts, zero failed.
- No new hardcoded colors (verified by grep against `#[0-9a-fA-F]{3,8}` in the new CSS block: zero matches).
- No new fonts (no @import or font-family literals added).
- No inline styles introduced in app.html (the modal markup uses only class selectors).
- All 4 Task 2 EDIT sites visible in git diff (state.seriesEdit init, Tonight CTA, picker+handlers, TMDB search+confirmStartSeries).
- No deploys triggered; no sw.js bumps applied (deferred to Plan 16-10).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
