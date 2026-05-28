---
phase: 16-calendar-layer
plan: 07
subsystem: client-ui
tags: [edit-modal, watchparty-series, dom-share, stub-override, mode-toggle]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 01
    provides: top-level /watchpartySeries rules update branch (allowlist + titleType immutability + createdByUid==auth.uid)
  - phase: 16-calendar-layer
    plan: 05
    provides: openSeriesEdit STUB (overwritten by this plan) + Edit button onclick in renderSeriesListCard row markup (consumed unchanged) + seriesRef(id) helper + state.series subscription
  - phase: 16-calendar-layer
    plan: 06
    provides: #series-create-modal-bg DOM shell (reused as edit surface via mode toggle) + state.seriesEdit transient state + renderDayOfWeekPicker + renderSeriesMembersChips + openSeriesCreate(prefill) + closeSeriesCreate lifecycle + #series-modal-title / #series-titletype-picker / #series-field-title / #series-time-input id-anchors
provides:
  - window.openSeriesEdit(seriesId) REAL handler — overrides the plan-16-05 stub via unconditional later-in-file reassignment (load-order win, automated load-order assertion green)
  - window.saveSeriesEdit() async update handler — validates + builds allowlisted update payload + updateDoc(seriesRef(id), …) + nextFireAt=Date.now() reset for CF re-materialization
  - closeSeriesCreate edit-mode reset wrapper (re-enable titletype pills + restore Save button text/onclick + reset state.seriesEdit.mode to 'create')
affects:
  - Plan 16-08 (post-wp Entry-2 "Make recurring?" prompt — orthogonal; uses openSeriesCreate(prefill) not openSeriesEdit; mode reset on closeSeriesCreate guarantees Entry-2 next-open lands in create flow correctly even after a recent edit-modal close)
  - Plan 16-09 (Week view — orthogonal; week-grid event tap may open series edit modal via openSeriesEdit; ready)
  - Plan 16-10 (Deploy wave — bundles this handler into the launch deploy + sw.js bump)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "DOM-share + mode-toggle modal pattern — single #series-create-modal-bg, state.seriesEdit.mode='create'|'edit' branches the title + Save button + titletype-picker disabled state at open time; closeSeriesCreate restores on close so the next open is mode-correct regardless of which mode preceded"
    - "Stub-override via load order — plan 16-05 EDIT G shipped defensive `if (typeof window.openSeriesEdit !== 'function')` stub; this plan's UNCONDITIONAL `window.openSeriesEdit = function(seriesId) { ... }` assignment lives LATER in the file (idx 803000 vs stub idx 795471), so module-load order guarantees the real handler wins via plain reassignment — no re-define-detection branching needed"
    - "Allowlist-update pattern — `updateDoc(seriesRef(ed.id), { daysOfWeek, timeOfDay, timezone, memberUids, nextFireAt, ...writeAttribution() })` mirrors Plan 16-05 lifecycle handlers (pause/resume/cancel updateDoc shape); titleId/titleName conditionally included when titleType==='tv'; titleType NEVER in the update payload (rules-enforced immutable invariant — T-16-09)"
    - "nextFireAt=Date.now() reset on edit — server-CF-as-source-of-truth pattern reused from plan 16-06 confirmStartSeries; per CONTEXT 'On save: recompute nextFireAt from new cadence' deferred to the materializer CF (plan 16-03) on the next 6h tick rather than client-side cadence math duplication"
    - "Creator-gate defense-in-depth — client-side `series.createdByUid !== state.auth.uid` early-return with friendly flashToast PLUS server-side rules update branch `resource.data.createdByUid == request.auth.uid` from plan 16-01 (T-16-27 mitigation)"
    - "Edit-mode UI reset on close — closeSeriesCreate wrapper re-enables titletype pills (disabled=false + style cleanup) + restores Save button text/onclick + resets state.seriesEdit.mode to 'create' so the next openSeriesCreate (whether direct Tonight-tab CTA or plan 16-08 Entry-2 prompt) lands in create flow correctly (T-16-29 mitigation)"

key-files:
  created:
    - .planning/phases/16-calendar-layer/16-07-SUMMARY.md
  modified:
    - js/app.js (1 hunk — +156 lines; closeSeriesCreate body augmented + 2 new top-level functions appended)

key-decisions:
  - "EDIT B + EDIT C merged into a single contiguous block to keep all CAL-16-12 surface adjacent — augmented closeSeriesCreate sits IMMEDIATELY before the new openSeriesEdit + saveSeriesEdit handlers; one contiguous +156 line insert simpler to review than two scattered hunks. Plan ordering preserved at the logical level (close-reset wraps the existing close; new handlers append after)."
  - "Edit-mode title-field visibility branches on titleType: 'tv' shows the field (titleId/titleName ARE editable per CONTEXT — `Editable fields: Title (only if titleType === 'tv'; can't change titleType once set)`), 'untitled' hides it (no title to change). This is exactly what plan EDIT B specified."
  - "saveSeriesEdit re-reads timeOfDay from #series-time-input rather than trusting state.seriesEdit.timeOfDay alone — mirrors confirmStartSeries pattern from plan 16-06 (user may change the time without re-syncing state via a synthetic event)."
  - "closeSeriesCreate edit-mode reset always runs (regardless of current mode) — re-enables titletype pills even when closing the create modal. Cheap idempotent no-op when in create mode; eliminates a stale-state class of bugs where any path that leaves the modal in edit mode (Cancel button, X button, ESC key, blur) restores defaults."

patterns-established:
  - "openSeriesEdit defines memberUids→memberIds back-mapping via state.members lookup: `.filter(m => m.uid && series.memberUids.includes(m.uid)).map(m => m.id)`. This is the inverse of plan 16-06 confirmStartSeries memberIds→memberUids forward-mapping; both live ~150 lines apart in the same modal-handler section for greppability."
  - "Three early-return gates in openSeriesEdit: (1) series not found in state.series (snapshot-race protection), (2) createdByUid mismatch (T-16-27 creator-only), (3) status==='ended' (terminal-state protection). Each emits a tailored flashToast and returns silently — no modal opens. Mirrors Plan 16-05 lifecycle-handler early-return shape."
  - "Save button rewiring in openSeriesEdit (saveBtn.onclick = saveSeriesEdit) replaces the static HTML onclick=\"confirmStartSeries()\" from plan 16-06 app.html line 1335. The HTML onclick remains the create-flow default; openSeriesEdit dynamically overrides for the edit-flow duration; closeSeriesCreate restores the create-flow default. Round-trip safe."

requirements-completed: [CAL-16-12]

# Metrics
duration: 2min
completed: 2026-05-28
---

# Phase 16 Plan 07: In-Place Edit Modal Summary

**The Edit button on the Account-tab series list (markup shipped in plan 16-05) now opens a fully-functional pre-filled edit surface that reuses the create modal's DOM via a `state.seriesEdit.mode` toggle. Save → `updateDoc(seriesRef(id), …)` with `nextFireAt=Date.now()` so the materializer CF (plan 16-03) recomputes the real next fire on its next 6h tick. The plan-16-05 stub is overridden via plain reassignment at module load (real handler appended later in js/app.js — load-order assertion green).**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-28T00:37:37Z
- **Completed:** 2026-05-28T00:39:36Z
- **Tasks:** 1 / 1
- **Files modified:** 1 (js/app.js)

## Accomplishments

- New `window.openSeriesEdit(seriesId)` REAL handler (~60 lines) — unconditional assignment appended AFTER plan-16-05 stub in source order, so module-load order guarantees the real handler wins via plain reassignment. Three early-return gates: series-not-found, createdByUid-mismatch (T-16-27), status==='ended'. On success: maps memberUids→memberIds via state.members lookup → calls openSeriesCreate(prefill) → flips state.seriesEdit.mode='edit' + id=seriesId → swaps modal title text to 'Edit series' → disables titletype-picker pills + applies visual disabled styling (opacity 0.5, cursor not-allowed) → hides #series-field-title only when titleType==='untitled' (TV titles stay editable) → rewires Save button onclick to saveSeriesEdit + flips textContent to 'Save changes'.
- New `window.saveSeriesEdit()` async update handler (~55 lines). Validates: titleId+titleName-if-tv / daysOfWeek≥1 / HH:MM regex / non-empty memberUids. Always includes state.auth.uid in memberUids (T-16-26 invariant — creator must be a memberUid for rules update branch). Captures fresh Intl timezone with UTC fallback. Builds allowlisted update payload: daysOfWeek (sorted) + timeOfDay + timezone + memberUids + nextFireAt=Date.now() (server CF computes real next fire on next 6h tick — single source of truth) + writeAttribution() spread. titleId/titleName conditionally included when titleType==='tv'. titleType NEVER in payload — rules-enforced immutable invariant. `updateDoc(seriesRef(ed.id), update)` + logActivity('series_edited') + flashToast 'Series updated. Next fire recomputes within 6 hours.' + closeSeriesCreate (shared close resets DOM via wrapper).
- Augmented `closeSeriesCreate` (+18 lines wrapping existing 3-line body). Re-enables #series-titletype-picker pills (disabled=false + style cleanup) + restores #series-create-modal-bg .modal-close Save button text to 'Save series' + rewires its onclick to confirmStartSeries + resets state.seriesEdit.mode to 'create'. Runs unconditionally on every close — cheap idempotent no-op when in create mode; eliminates stale-edit-state leak class for any close path (X button, Cancel button, ESC key, blur). T-16-29 mitigation.
- Plan-16-05 stub OVERRIDDEN at load order: real `window.openSeriesEdit = function(seriesId)` at idx 803000 > defensive stub `if (typeof window.openSeriesEdit !== 'function')` at idx 795471. Verified by automated load-order assertion in the plan's verify script (exits 0). Module evaluation: stub assigns first (window.openSeriesEdit becomes the stub fn); real handler then plain-reassigns (window.openSeriesEdit becomes the real fn). No re-define detection, no guard branching, no hot-reload special-casing needed.
- Threats mitigated: **T-16-09** (Tampering — client bypasses UI lock to PATCH titleType) defense-in-depth via UI titletype-picker disabled + rules `resource.data.titleType == request.resource.data.titleType` server-side enforcement; **T-16-27** (Elevation — non-creator opens edit modal) client createdByUid check + rules update branch `resource.data.createdByUid == request.auth.uid`; **T-16-28** (Race — already-materialized future wp not re-materialized after edit) ACCEPT per CONTEXT "leave already-materialized future wp instances; series.nextFireAt advances past them"; **T-16-29** (UI confusion — stale edit-mode state leaks into create) closeSeriesCreate wrapper resets all 4 surfaces (titletype pills + Save text + Save onclick + state.seriesEdit.mode).

## Task Commits

1. **Task 1: openSeriesEdit + saveSeriesEdit handlers + closeSeriesCreate edit-mode reset wrapper** — `1d3a1a0` (feat)

## Files Created/Modified

- `js/app.js` — single `+156 line` hunk at line ~16323 (the existing `window.closeSeriesCreate` function and following). EDIT C (closeSeriesCreate body augmented from 3 lines → 18 lines, adds 4-surface reset: titletype pills + Save button text + Save button onclick + state.seriesEdit.mode='create') then EDIT B (new openSeriesEdit at +60 lines + new saveSeriesEdit at +55 lines) — both contiguous so all CAL-16-12 surface is adjacent for greppability. EDIT A (verify Edit button in row markup) was a NO-OP check — plan 16-05 already shipped the button at line 16110 of renderSeriesListCard.

## Decisions Made

- **EDIT B + EDIT C merged into one contiguous insert** for review-clarity: closeSeriesCreate reset wrapper sits immediately BEFORE the new openSeriesEdit + saveSeriesEdit handlers, all under a single CAL-16-12 section comment. One contiguous diff hunk is simpler to read than two scattered ones; plan structural intent preserved (close-reset wraps existing close, new handlers append after).
- **closeSeriesCreate reset always runs (regardless of current mode).** Defensive idempotent restoration — cheaper than mode-branching. Re-enables titletype pills + restores Save button defaults + resets state.seriesEdit.mode='create' on every single close (X button, Cancel button, ESC via deactivateFocusTrap, blur). Eliminates a stale-state bug class entirely (any future code path that leaves the modal in edit mode lands back in create-mode defaults next open). T-16-29 mitigation is therefore by construction, not by remembering-to-call.
- **Title-field visibility only hides when titleType==='untitled'.** Per CONTEXT § In-place edit: "Editable fields: Title (only if titleType === 'tv'; can't change titleType once set — would be a recreate)". For TV series the field stays visible (titleId/titleName ARE editable via the existing TMDB search wired by plan 16-06). For untitled series the field hides (no title to change). titleType picker itself is disabled in both modes — that's the immutable invariant per T-16-09.
- **saveSeriesEdit reads timeOfDay from #series-time-input rather than state.seriesEdit.timeOfDay alone** — mirrors confirmStartSeries from plan 16-06 (user may change the time via the native HTML5 time input without firing a state-sync event). The DOM is the source of truth at save-time.
- **memberUids hard-includes state.auth.uid alongside selected couch-members' uids** — T-16-26 invariant inherited from plan 16-06 confirmStartSeries; satisfies rules update-branch eligibility + Account-tab subscription read-gate (the creator must be a memberUid to keep seeing their own series after edit).
- **No row-markup change in renderSeriesListCard.** Plan 16-05 shipped the Edit button onclick="openSeriesEdit('${safeId}')" as final markup. Plan 16-07 only ships the handler. Account-tab markup is therefore FINAL after Wave 4 — zero churn risk.

## Deviations from Plan

### Auto-fixed Issues

None functional. The plan was followed exactly. Two minor predicate-vs-pattern mismatches in the plan's acceptance-criteria grep counts (inherited from plan 16-05 precedent — see below); functional intent verified at the load-order + sentinel layer.

**1. [Rule 1 - Acceptance-criterion drift] `state.seriesEdit.mode = 'create'` grep count expected ≥2, observed 1**
- **Found during:** Task 1 verification.
- **Issue:** Plan acceptance criterion stated `grep -c "state.seriesEdit.mode = 'create'" js/app.js` returns at least 2 (init + reset on close). Actual count after the edit: 1 (the reset on close). The init in plan 16-06 (state.seriesEdit at module-eval line 10654) and in openSeriesCreate (line 16283) BOTH use object-literal form `mode: 'create',` — neither matches the assignment-form pattern `state.seriesEdit.mode = 'create'`. Only the new reset on close (line 16342 of the post-edit file) matches the exact assignment-form pattern.
- **Fix:** Accepted the predicate-vs-pattern mismatch as inherent to the plan's grep heuristic. Functional intent (init + reset) is fully satisfied — verified by reading the 3 places where mode becomes 'create' (1 module-eval init + 1 openSeriesCreate object-literal reset + 1 closeSeriesCreate assignment-form reset). Plan's verify script uses `s.includes(...)` (boolean) which passes on all 11 sentinels including `state.seriesEdit.mode = 'create'`. No code change applied. Identical to plan 16-05 documented Rule-1 acceptance-count drift precedent.
- **Files modified:** None.
- **Committed in:** N/A — documented here for audit trail.

**2. [Rule 1 - Acceptance-criterion drift] `openSeriesEdit('` grep count expected ≥2, observed 1**
- **Found during:** Task 1 EDIT A (Edit button verification step).
- **Issue:** Plan acceptance criterion + EDIT A grep step stated `grep -c "openSeriesEdit('" js/app.js` returns at least 2 (the stub log message + Edit button in renderSeriesListCard). Actual count after the edit: 1 (only the row-markup Edit button at line 16110). The plan-16-05 stub's console.log uses the literal text `'openSeriesEdit stub (plan 16-05) — real handler ships in plan 16-07'` — no `openSeriesEdit(` substring (the function name is followed by a space, not a parenthesis). So `openSeriesEdit('` only matches the row-markup onclick attribute.
- **Fix:** Accepted the predicate-vs-pattern mismatch. The plan's EDIT A check "Expected: at least 2 hits" was the heuristic; the actual functional check is "Edit button is present in renderSeriesListCard row markup". Verified by reading line 16110 directly — `onclick="openSeriesEdit('${safeId}')"` is the row-markup ternary's active branch. Plan EDIT A explicitly says "no edit needed in this step" if verification passes; Edit-button-present condition holds. No code change applied.
- **Files modified:** None.
- **Committed in:** N/A — documented here for audit trail.

### Architectural Changes

None.

---

**Total deviations:** 0 functional, 2 documented acceptance-grep predicate drifts (both inherited from plan 16-05's identical precedent — neither has a code-level fix; both are predicate-vs-pattern mismatches where the functional intent is met).

## Authentication Gates

None. This plan adds client-side update logic against the existing Phase 16 rules-validated /watchpartySeries collection. No auth flow changes; state.auth.uid presence check + state.me check front-load saveSeriesEdit as defensive gates (mirror confirmStartSeries pattern from plan 16-06).

## Threat Flags

None — surface introduced is exactly what the threat model enumerated. All 4 Phase-16-Plan-07 threat IDs (T-16-09, T-16-27, T-16-28, T-16-29) are mitigated. The 1 NEW client-side surface (saveSeriesEdit updateDoc call) is server-validated by firestore.rules update branch from plan 16-01 (allowlist diff + titleType immutability + createdByUid==auth.uid). No NEW unmitigated attack surface.

## Known Stubs

None introduced. The plan-16-05 `window.openSeriesEdit` stub is now OVERRIDDEN (not deleted — its `if (typeof ... !== 'function')` guard still sits earlier in the file, runs first, assigns the stub, then the real handler later overwrites via plain reassignment). The stub sentinel `openSeriesEdit stub (plan 16-05)` still appears in the source (twice — once in comment, once in console.log) for audit-trail continuity but is functionally inert at runtime because the later assignment wins.

## Smoke Gate Status

No regressions:

- `node scripts/smoke-app-parse.cjs` — **11 passed / 0 failed** (js/app.js parses cleanly with +156 lines)
- `node scripts/smoke-series-cadence-compute.cjs` — **12 passed / 0 failed** (Plan 16-02 contract unchanged)
- `node scripts/smoke-series-materializer.cjs` — **33 passed / 0 failed** (Plan 16-03 + 16-04 contract unchanged)
- `node scripts/smoke-series-idempotency.cjs` — **11 passed / 0 failed** (Plan 16-03 contract unchanged)

Phase 16 smoke gate total: **56 sentinels green** (unchanged — this plan adds 1 new top-level update handler; smoke surface didn't grow).

Plan-supplied automated verify script (load-order assertion + 11-sentinel checks): all 11 sentinels green + real handler at idx 803000 > stub at idx 795471 (load-order assertion green).

## Issues Encountered

None blocking. 2 documented predicate-vs-pattern acceptance-grep drifts (both inherited from plan 16-05 precedent; functional intent satisfied at the load-order + sentinel + smoke layer).

## Wave 9 / Plan 16-10 Deploy Ordering Note

This plan is local commits only on couch repo. When Plan 16-10 deploys:
- couch hosting: pick up js/app.js via `bash scripts/deploy.sh <cache-tag>` from couch repo root.
- sw.js CACHE bump: auto-applied by deploy.sh (passes the tag as the new cache version).
- No queuenight changes in this plan.

## User Setup Required

None — no external service configuration. Edit modal operates against the existing Firebase /watchpartySeries collection (rules + index already deployed per plan 16-01).

## Next Phase Readiness

- **Wave 7 (Plan 16-08 Post-wp Entry-2 prompt):** Ready. 16-08 will call `openSeriesCreate(prefill)` with prefill derived from a just-created TV wp. Orthogonal to this plan — no overlap. The closeSeriesCreate reset wrapper guarantees Entry-2 next-open lands in create flow correctly even after a recent edit-modal close.
- **Wave 7 (Plan 16-09 Week view):** Ready. 16-09 may route week-grid event taps to openSeriesEdit; this plan's real handler is ready.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- File `js/app.js` modified and contains all 11 sentinels from the plan's verify script: `window.openSeriesEdit = function(seriesId)` ✓, `window.saveSeriesEdit` ✓, `state.seriesEdit.mode = 'edit'` ✓, `btn.disabled = true` ✓ (7 occurrences — the new edit-mode disable + 6 pre-existing in other handlers), `updateDoc(seriesRef(ed.id)` ✓, `onclick="openSeriesEdit('` ✓ (Edit button row-markup from plan 16-05), `CAL-16-12` ✓ (2 occurrences — closeSeriesCreate reset block + openSeriesEdit handler block), `nextFireAt: Date.now()` ✓, `series.createdByUid !== (state.auth` ✓, `state.seriesEdit.mode = 'create'` ✓ (1 occurrence — the new reset on close), `openSeriesEdit stub (plan 16-05)` ✓ (stub sentinel still present for audit-trail continuity).
- Load-order assertion green: real `window.openSeriesEdit = function(seriesId)` at idx 803000 > defensive stub `openSeriesEdit stub (plan 16-05)` at idx 795471 — verified by automated assertion in plan's verify script.
- Commit `1d3a1a0` (Task 1) exists in `git log` on current branch `hotfix/phase-30-cross-cutting-wave` (verified).
- No file deletions (verified via `git diff --diff-filter=D --name-only HEAD~1 HEAD` — output empty).
- No untracked files (verified via `git status --short` — clean).
- Smoke gate green: 11 + 12 + 33 + 11 = 67 sentinels across smoke-app-parse + 3 Phase-16 smokes (zero failed).
- No row-markup changes in renderSeriesListCard (plan 16-05 ships final markup — verified via plan's EDIT A check; Edit button at line 16110 unchanged).
- No app.html changes (Edit modal reuses existing #series-create-modal-bg from plan 16-06 — verified via `git status --short` shows only js/app.js).
- No css/app.css changes (no new styling needed — disabled state uses inline opacity/cursor — verified via `git status --short` shows only js/app.js).
- No deploys triggered; no sw.js bumps applied (deferred to Plan 16-10).
- 2 documented predicate-vs-pattern acceptance-grep drifts (state.seriesEdit.mode = 'create' count, openSeriesEdit(' count) — both inherited from plan 16-05 precedent; functional intent satisfied.

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
