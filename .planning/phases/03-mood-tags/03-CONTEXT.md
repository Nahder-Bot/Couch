# Phase 3: Mood Tags - Context

**Gathered:** 2026-04-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 3 delivers: (1) visibility of mood tags on title detail cards, (2) the ability for any family member to add or remove mood tags on any title directly from the detail view, and (3) an improved Tonight filter bar where active mood filters are visible and removable without opening the filter panel.

Phases 1-2 are shipped. Auto-suggestion of moods (`suggestMoods()`) and the Tonight mood filter chips already exist in code — Phase 3 closes the gaps: detail-view editing and active-filter surfacing.

</domain>

<decisions>
## Implementation Decisions

### Tag Ownership Model
- **D-01:** Mood tags live in the existing shared `title.moods: string[]` Firestore field. No per-member tagging structure needed.
- **D-02:** Any family member can add **or remove** any mood on any title — no ownership restriction. Adding a mood any member didn't set is fine; removing one they did set is also fine.
- **D-03:** Auto-suggested moods (set by `suggestMoods()` during backfill) and user-added moods are stored identically in `moods[]`. No distinction in storage or display.

### Detail View Mood Section
- **D-04:** The mood section lives **below the genre pills, above the overview** — inline with other title metadata.
- **D-05:** Chips are **always-editable** — no separate read/edit mode toggle. Existing mood chips on the title are shown; tapping one removes it. A "+" or empty-state prompt reveals the full MOODS palette to add one. No modal, no toggle — inline interaction.
- **D-06:** All mood chips render identically regardless of origin (auto-suggested vs. user-added). One unified list of chips.

### Active Filter Quick-Clear (MOOD-07)
- **D-07:** When one or more moods are active in the filter, the selected mood chips appear **inline as a second row below the "Mood" filter toggle** — outside the collapsible panel. The panel can stay closed.
- **D-08:** Each inline active-mood chip has an **× button** to remove that individual mood without opening the panel. Tapping the chip icon itself (no ×) is not a removal action.
- **D-09:** The existing count badge on the "Mood" toggle pill (e.g., "Mood 2") stays as-is for the collapsed state. The inline row is the primary clearability surface.

### Claude's Discretion
- Exact styling of the inline active-mood chips (size, padding, font) — follow existing `.mood-chip` pattern from Tonight filter.
- Whether the "+" entry point in the detail view is a chip-shaped affordance or a subtle icon — whichever fits the warm/cinematic design language better.
- Empty-state copy for when a title has no moods yet (e.g., "No moods yet — add one" or a bare "+" chip).
- Whether removing the last mood from a title via the detail view re-runs `suggestMoods()` to repopulate, or leaves it empty until next backfill cycle.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Mood Tags (Phase 3)" — MOOD-01 through MOOD-07 are the acceptance criteria
- `.planning/ROADMAP.md` §"Phase 3: Mood Tags" — success criteria (5 items), UI hint: yes

### Architecture
- `index.html` §`// ===== Mood tags =====` (line ~2914) — MOODS constant, `suggestMoods()`, `moodById()`
- `index.html` §`function renderMoodFilter()` (line ~4873) — existing Tonight filter chips implementation
- `index.html` §`function renderDetailShell(t)` (line ~7022) — detail view template to extend
- `index.html` §`function updateFiltersBar()` (line ~5044) — current active-state badge logic to extend
- `index.html` §`// Phase 1:` catalog backfill (line ~6005) — where `suggestMoods()` runs; new edits must not conflict

No external ADRs or design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `MOODS[]` (10 moods with id/label/icon) — use as-is; no new moods in scope
- `.mood-chip` / `.mood-chip.on` CSS — reuse for detail view chips; already styled for filter use
- `moodById(id)` — use to resolve id → label/icon in detail view
- `suggestMoods(genreIds, runtime)` — already wired to backfill; not called from detail view today
- `updateDoc(doc(titlesRef(), t.id), { moods })` pattern — the write pattern for Firestore mood updates

### Established Patterns
- Firestore writes are per-title under `titlesRef()` — mood adds/removes follow the same atomic `updateDoc` with `arrayUnion` / `arrayRemove`
- `state.titles` is updated optimistically after writes (see `addSimilar()` pattern at line ~7112)
- `renderDetailShell` is called fresh each time the modal opens — update-in-place needs a re-render or targeted DOM update
- The existing `.t-filter-body` collapse pattern is the model for the Tonight filter panel

### Integration Points
- `renderDetailShell(t)` — extend with mood chips section between `.detail-genres` and `.detail-overview`
- `updateFiltersBar()` — extend to render active-mood inline chips below the toggle row
- `renderTonight()` calls `renderMoodFilter()` and `updateFiltersBar()` — mood state changes during Tonight session flow through these
- Firestore `titlesRef()` — mood edits write here; real-time listener propagates to all family devices

</code_context>

<specifics>
## Specific Ideas

No specific references or "I want it like X" moments — open to standard approaches within the existing warm/cinematic design language.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 03-mood-tags*
*Context gathered: 2026-04-19*
