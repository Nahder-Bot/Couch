---
phase: 21-conflict-aware-empty-state
gathered: 2026-04-30
status: ready_for_planning
mode: pre-scoped (Claude wrote CONTEXT.md directly to save the discuss step — mirrors Phase 20 pattern)
---

# Phase 21: Conflict-aware empty state — Context

**Gathered:** 2026-04-30 (pre-scoped at end of v36.4 ship-day burst — Phase 20 + 15.6 + iOS fixes + Twemoji all shipped earlier)
**Status:** Ready for planning
**Pattern:** Mirrors Phase 20 (helper + 1 surface, pure-function shape, smoke-locked behavior).

<domain>
## Phase Boundary

Replace the generic "Nothing's matching" empty state on Tonight (currently fires when titles exist but the matches list is empty due to filtering / vetoes / kid-mode / runtime / provider availability) with a humility-voiced diagnosis answering **"why is nothing picked tonight?"**. Pure helper composes a structured `{ headline, reasons[] }` shape from existing state — vetoes / kid-mode tier cap / mood filter chips / provider intersection / runtime ceiling / yes-vote scan. Surface renders headline + up to 3 reason chips with counts. Mirrors Phase 20's helper-plus-surface shape exactly.

NOT in scope:
- Persistent diagnosis history
- ML / "your couch usually fails on Friday because X" learned recommendations
- Restyling the empty state container itself (no new modal, no new section)
- The brand-new-family all-empty branch (no titles + no vetoes + no considerable) — Phase 21 leaves that copy alone
- Action chips that DO things (e.g. "Reset filters" button) — passive diagnosis only for v1
- Considerable-list empty state — Phase 21 only diagnoses the matches branch
- Other empty surfaces (Library / History / Add tab) — Phase 21 only touches Tonight matches

</domain>

<decisions>
## Implementation Decisions

### Helper contract
- **D-01:** New helper: `diagnoseEmptyMatches(titles, couchMemberIds, filterState)` returns `{ headline: string, reasons: [{ kind, count, copy }, ...] }`.
- **D-02:** Helper lives at module top of `js/app.js` immediately after `buildMatchExplanation` from Phase 20 (mirrors Phase 19 / 20 placement convention).
- **D-03:** Pure function — zero `state.X = ...` assignments. Reads from passed-in args + `state.members` for name lookup (same allowance as Phase 20).
- **D-04:** Detection priority order (helper checks each in turn; once a primary cause is identified, additional reasons are appended up to the cap of 3):
  1. **all-vetoed** — at least one couch-member has `t.vetoes[memberId]` set on every otherwise-eligible title
  2. **kid-mode-filtered** — `state.kidMode === true` AND every title's tier exceeds `getEffectiveTierCap()` (Phase 19 helper)
  3. **tier-filtered** — per-member `m.maxTier` caps exclude all titles (different from kid-mode — this is the always-on per-member age cap)
  4. **mood-filtered** — `state.selectedMoods.length > 0` AND no title carries any selected mood id
  5. **provider-unavailable** — no title has any provider in any couch-member's `m.services[]` intersection
  6. **runtime-filtered** — any active runtime ceiling (e.g. `state.maxRuntimeMins`) excludes all titles
  7. **no-yes-votes** — no couch-member has yes-voted any unwatched title (distinct from "no titles" — handled by D-11 edge)
- **D-05:** `headline` is a single warm/restraint sentence summarising the dominant reason. Examples:
  - `"All 12 titles are out — vetoes + Kid Mode caught most of them."`
  - `"No one's said yes to anything yet."`
  - `"Everything's on services no one subscribes to."`
  - `"Try unchecking a mood — those filters are tight tonight."`
- **D-06:** `reasons[]` returns up to 3 chips, each `{ kind: string, count: number, copy: string }`. Render examples:
  - `{ kind: 'veto',     count: 4, copy: 'Nahder vetoed 4' }` (single-vetoer attribution)
  - `{ kind: 'veto',     count: 7, copy: '7 vetoed across the couch' }` (multi-vetoer)
  - `{ kind: 'kidmode',  count: 6, copy: 'Kid Mode hides 6' }`
  - `{ kind: 'tier',     count: 9, copy: 'Everything’s R / TV-MA' }` (curly apostrophe per BRAND voice)
  - `{ kind: 'mood',     count: 12, copy: 'No matching mood' }`
  - `{ kind: 'provider', count: 12, copy: 'Off Netflix / Hulu / Max' }` (top 3 brands by family-services)
  - `{ kind: 'runtime',  count: 8, copy: '8 are too long' }`
  - `{ kind: 'noyes',    count: 0, copy: 'No yes-votes yet tonight' }`
- **D-07:** Voice respects BRAND.md and Phase 15.4 / 15.5 / 18 / 19 / 20 banned-word sweep: no "buffer", "delay", "queue" (in queue-UX context); no marketing language; no exclamation marks; curly apostrophes (’) in surface text where applicable.
- **D-08:** Cap at 3 reason chips — if more would qualify, keep top 3 by count desc (with priority-order tiebreaker per D-04).

### Surface integration
- **D-09:** Replace existing empty-state branch at `js/app.js:5310` (`Nothing's matching` with the `else: Try adjusting filters, or add more titles.` fallback) with helper-driven HTML.
- **D-10:** Render shape: `<div class="empty"><strong>${headline}</strong><div class="empty-reasons">${chips}</div></div>` where each chip is `<span class="empty-reason-chip">${escapeHtml(copy)}</span>`. Chip row uses dim micro-text register (mirrors `.tc-explanation` from Phase 20 D-08).
- **D-11:** Preserve the all-empty branch at `js/app.js:5304` (`No matches yet` / `Add titles and vote so we have something to watch.`) verbatim — Phase 21 does NOT alter the brand-new-family / fresh-couch zero-state copy.
- **D-12:** Considerable-fallback wording: when matches are empty BUT considerable list has options, the existing copy `"But there are still options below."` is preserved. Helper still runs to populate the chip row diagnosing the matches branch — both can coexist (headline says why nothing's matching; "options below" is a separate hint about the considerable section).

### Out-of-scope guards
- **D-13:** No persistence — diagnosis is computed at render time, not stored.
- **D-14:** No new state slots on `state.X`.
- **D-15:** No Firestore writes.
- **D-16:** Single-repo couch only. NO queuenight changes.
- **D-17:** sw.js CACHE bumps to `couch-v36.5-conflict-aware-empty`.
- **D-18:** No "Reset filters" / "Clear vetoes" / other action affordances in the empty state — passive diagnosis only for v1. Action chips are a future polish phase.

### Smoke contract
- **D-19:** New `scripts/smoke-conflict-aware-empty.cjs` (mirror smoke-decision-explanation.cjs shape — self-contained, no js/ requires, inline `check()` harness). Coverage:
  - Each reason kind (a–g) fires when triggered alone (7 assertions)
  - Mixed-cause priority — when veto + kid-mode + mood all apply, priority order honored (1 assertion)
  - Cap at 3 chips when 4+ reasons trigger (1 assertion)
  - Empty titles array → `"No titles yet"` headline + zero reasons (1 assertion)
  - Empty couchMemberIds → `"No one’s on the couch."` headline + zero reasons (1 assertion)
  - Null / undefined inputs → graceful no-op (returns valid shape, no throw) (1 assertion)
  - Helper does not mutate input arrays (1 assertion — JSON.stringify before/after)
  Total ~12-15 assertions.
- **D-20:** scripts/deploy.sh §2.5 gains a 6th smoke if-block (mirrors Phase 20 / 19 wiring exactly). package.json smoke chain extends to 6 contracts.

### Cross-repo + cache
- **D-21:** Single-repo couch only. NO queuenight changes.
- **D-22:** sw.js CACHE bumps to `couch-v36.5-conflict-aware-empty`.

### Claude's Discretion
- Final phrase punctuation separator in chips (` · ` vs ` | `) — recommend ` · ` for consistency with Phase 20
- Whether to add a `headline-secondary` field for cases where the dominant reason isn't 100% (e.g. "All 12 titles are out — vetoes + Kid Mode caught most of them" splits naturally) — recommend keep it as a single string, helper composes the compound when needed
- Whether to surface the diagnosis in any other empty surface (considerable / Library / History / Add tab) — defer to a later polish phase per D-out-of-scope
- Whether to track Sentry breadcrumb on empty-state render — probably no (read-only surface, no behavior to track; Sentry budget is for errors only per Phase 13 / 15.1 posture)

</decisions>

<specifics>
## Specific Ideas

- Codex pitch verbatim from `.planning/reviews/2026-04-28-feature-audit.md`: when Tonight matches is empty, surface WHY (no overlap / provider unavailable / runtime / rating-filtered) instead of generic "No matches yet". This phase implements that pitch directly.
- Voice consistency with Phase 20: humility-voiced, dim-text chips, italic Instrument Serif headline (matches `.tc-explanation` register from Phase 20 D-08).
- `state.kidMode` from Phase 19 — read directly via the existing `getEffectiveTierCap()` helper; don't duplicate tier logic.
- `state.selectedMoods` from Phase 3 — array of mood ids; intersect against `t.moods` per title.
- `t.vetoes` from Phase 4 — map keyed by memberId to vetoer-name; iterate over couch-member ids to find which vetoes apply.
- `m.services` from Phase 14 — array of provider brand names; intersect with `t.providers[]` (Phase 18 normalizeProviderName helper).
- Considerable-fallback (D-12): the current `Nothing's matching` empty state has TWO sub-cases handled with a ternary — `considerable.length ? 'But there are still options below.' : 'Try adjusting filters, or add more titles.'`. Phase 21 replaces the FALSE branch (`Try adjusting filters...`) with the helper-driven HTML; the TRUE branch (`But there are still options below.`) is preserved as a small hint following the helper output.
- Helper output examples for the smoke contract, derived from D-04 priority + D-05 headline + D-06 chips:
  - **All-vetoed by Nahder:** `headline: "All 4 titles are out — Nahder vetoed every one of them."` + chips: `[{ kind: 'veto', count: 4, copy: 'Nahder vetoed 4' }]`
  - **Kid Mode + extra:** `headline: "Kid Mode’s tight tonight — most titles are over the cap."` + chips: `[{ kind: 'kidmode', count: 6, copy: 'Kid Mode hides 6' }, { kind: 'veto', count: 2, copy: 'Nahder vetoed 2' }]`
  - **Mood + provider:** `headline: "Try unchecking a mood — those filters are tight tonight."` + chips: `[{ kind: 'mood', count: 12, copy: 'No matching mood' }, { kind: 'provider', count: 4, copy: 'Off Netflix / Hulu' }]`

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cross-AI feature audit (this phase's strategic justification)
- `.planning/reviews/2026-04-28-feature-audit.md` § Codex pitch on conflict-aware empty state — the strategic justification

### Phase 20 prior work (the canonical pattern this phase mirrors)
- `.planning/phases/20-decision-explanation/20-CONTEXT.md` — D-01..D-17 governance pattern
- `.planning/phases/20-decision-explanation/20-RESEARCH.md` — Surface Integration Map at line 465 + Smoke Contract Design at line 581 (architectural inspiration)
- `.planning/phases/20-decision-explanation/20-PATTERNS.md` — Pattern Map shape (file-by-file analog citations)
- `.planning/phases/20-decision-explanation/20-01-SUMMARY.md` — helper insertion + smoke contract pattern actually shipped
- `.planning/phases/20-decision-explanation/20-02-SUMMARY.md` — 3-surface integration pattern
- `js/app.js` — `function buildMatchExplanation` at line ~112 (Phase 20 helper — mirror placement style for diagnoseEmptyMatches)
- `scripts/smoke-decision-explanation.cjs` — pattern for the smoke-conflict-aware-empty.cjs new file

### Existing data sources to read in helper
- `js/app.js:5300-5311` — current empty-state code (the integration target)
- `js/app.js` — `function getEffectiveTierCap` (Phase 19, line ~99) — Kid Mode tier resolution
- `js/app.js` — `passesBaseFilter` — filter logic to mirror in diagnosis (already excludes vetoes / watched / no-votes; helper should NOT re-implement, just COUNT what would pass at each stage)
- `js/app.js` — `titleMatchesProviders` + `m.services` intersection logic (mirror for D-04 provider-unavailable check)
- `js/app.js` — `t.votes` / `t.vetoes` / `t.moods` / `t.providers` / `t.runtime` shapes (Phase 4 + 14 + 15 references)
- `js/app.js` — `state.selectedMoods` / `state.kidMode` / `state.couchMemberIds` shapes
- `js/constants.js` — `RATING_TIERS` / `TIER_LABELS` (used in D-06 `'Everything’s R / TV-MA'` chip copy)

### Voice
- `BRAND.md` — warm / restraint / direct
- Phase 20's `20-02-SUMMARY.md` — `.tc-explanation` dim-text micro register (mirror for empty-reason chip rendering)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.couchMemberIds` (Phase 14 V5 roster) — primary couch-member iterator
- `state.members` for name lookup (matching surfaces fan out same way as Phase 20)
- `state.kidMode` + `getEffectiveTierCap()` (Phase 19) — already-shipped tier resolution helper
- `state.selectedMoods` (Phase 3) — mood filter array
- `t.vetoes` keyed by memberId (Phase 4)
- `t.moods` array per title (Phase 3)
- `t.providers` / `m.services` intersection (Phase 18 normalizeProviderName)
- `t.runtime` minutes
- `escapeHtml` from utils.js — for safe member-name interpolation in D-06 single-vetoer chip
- `RATING_TIERS` / `TIER_LABELS` from constants.js — for D-06 tier-filtered chip copy

### Established Patterns
- Pure-function smoke contracts (smoke-tonight-matches / smoke-availability / smoke-kid-mode / smoke-decision-explanation) — add a 6th `smoke-conflict-aware-empty.cjs`
- Italic Instrument Serif voice for "humility" text — Phase 18 "Provider data via TMDB" + Phase 19 parent override link + Phase 20 spin-pick sub-line all use this
- Pure helper at module top (no state mutation) — mirror getEffectiveTierCap (Phase 19) + buildMatchExplanation (Phase 20) location/style
- deploy.sh §2.5 6th smoke if-block — mechanical add mirroring Phase 20 wiring
- sw.js CACHE bump on every user-visible change

### Integration Points
- New helper `diagnoseEmptyMatches(titles, couchMemberIds, filterState)` near other display helpers (immediately after buildMatchExplanation)
- 1 call site for the helper: existing empty-state branch at js/app.js:5310 (`Nothing's matching`)
- New CSS class `.empty-reasons` + `.empty-reason-chip` in css/app.css (dim micro-text register)
- New smoke file scripts/smoke-conflict-aware-empty.cjs
- Wire into scripts/deploy.sh §2.5 (6th if-block) + package.json smoke chain

</code_context>

<deferred>
## Deferred Ideas

- **Action affordances** — "Reset filters" / "Clear vetoes" buttons in the empty state. Phase 21 is passive diagnosis only; action chips are a future polish phase.
- **Other empty surfaces** — Library / History / Add tab / considerable-list. Phase 21 only touches Tonight matches.
- **Sentry breadcrumb on empty-state render** — read-only surface, no behavior to track; Sentry budget is errors-only per Phase 13 / 15.1 posture.
- **Persistent diagnosis history** — "your couch usually fails because X" / Year-in-Review territory.
- **Learned recommendations** — ML/heuristic engine to detect chronic conflict patterns. Out of scope; Phase 21 is pure render-time composition.
- **Internationalization** — copy is English-only. Match the rest of Couch v1.

</deferred>

---

*Phase: 21-conflict-aware-empty-state*
*Context gathered: 2026-04-30 (pre-scoped at end of v36.4 ship-day burst — mirrors Phase 20 pre-scope pattern)*
