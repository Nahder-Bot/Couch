---
phase: 21-conflict-aware-empty-state
status: shipped
shipped: 2026-04-30
mode: direct-ship (no formal /gsd-plan-phase chain — pivoted to inline implementation per user redirect)
verifier_method: code-level acceptance + smoke contract green + live curl verification
---

# Phase 21: Conflict-aware empty state — Summary

**Shipped:** 2026-04-30 — `couch-v36.5-conflict-aware-empty` live on couchtonight.app

## What was delivered

When Tonight matches list is empty BUT titles exist (filtered out by vetoes / kid-mode / per-member tier cap / mood filter / provider intersection), the helper now diagnoses why and renders a structured headline + up to 3 reason chips. Replaces the prior generic "Nothing's matching" / "Try adjusting filters, or add more titles." copy.

**Detection priority order** (per CONTEXT.md D-04):
1. All-vetoed (single-vetoer attribution: "Nahder vetoed every one of them")
2. Kid Mode tier cap
3. Per-member age tier cap
4. Mood filter
5. Provider intersection (chip lists top 3 brands the couch subscribes to)
6. No yes-votes (special headline + zero chips)

**Edges:** empty titles → "No titles yet" + 0 chips. Empty couch → "No one's on the couch." + 0 chips. Null inputs → graceful no-op. Brand-new-family all-empty branch (`No matches yet`) preserved verbatim per D-11.

## Key files

### Created
- `js/app.js` — `function diagnoseEmptyMatches` at line ~178 (after `buildMatchExplanation` from Phase 20). Pure function, no state mutation, ~110 lines. Reads from passed-in `titles` + `couchMemberIds` + `state.kidMode` + `state.selectedMoods` + `state.members` + helpers (`tierFor`, `ageToMaxTier`, `normalizeProviderName`, `getEffectiveTierCap`, `escapeHtml`).
- `scripts/smoke-conflict-aware-empty.cjs` — 14 assertions A1-A14 covering edges, all 6 detection branches, mixed-cause priority, 3-chip cap, input immutability. Self-contained mirror (no js/ requires).

### Modified
- `js/app.js:5310` — replaced empty-state branch in `renderTonight` with helper-driven HTML (headline + chips + considerable-fallback hint preserved).
- `css/app.css` — added `.empty-conflict-aware`, `.empty-reasons`, `.empty-reason-chip`, `.empty-consider-hint` (dim micro-text register matching Phase 20 D-08).
- `scripts/deploy.sh` §2.5 — added 6th smoke if-block + updated echo line.
- `package.json` — extended `smoke` chain to 6 contracts + new `smoke:conflict-aware-empty` entry.
- `sw.js` — CACHE bumped from `couch-v36.4-twemoji-pickers` to `couch-v36.5-conflict-aware-empty` (D-22).

## Commits (5 atomic on main)

1. `7336c0f` — feat: add diagnoseEmptyMatches helper + wire conflict-aware empty state into renderTonight
2. `19bdee4` — test: add smoke-conflict-aware-empty (14 assertions A1-A14)
3. `0549f20` — chore: wire smoke-conflict-aware-empty into deploy.sh + package.json (6th contract)
4. `f8e049b` — style(css): add .empty-conflict-aware + .empty-reasons + .empty-reason-chip
5. `d46a9c7` — chore: bump sw.js CACHE to couch-v36.5-conflict-aware-empty

## Verification

- **Smoke gate:** all 6 contracts green (`npm run smoke` exits 0; ~121 total assertions across position-transform + tonight-matches + availability + kid-mode + decision-explanation + conflict-aware-empty).
- **Syntax gate:** `node --check js/app.js` passes.
- **Live deploy:** `bash scripts/deploy.sh 36.5-conflict-aware-empty` exits 0 with full smoke-gate pre-flight; firebase release complete.
- **Live curl verification:**
  - `https://couchtonight.app/sw.js` → `const CACHE = 'couch-v36.5-conflict-aware-empty';`
  - `https://couchtonight.app/js/app.js` contains `function diagnoseEmptyMatches` (1 match)
  - `https://couchtonight.app/css/app.css` contains `empty-conflict-aware` + `empty-reason-chip` (2 matches)
  - `https://couchtonight.app/` returns HTTP 200

## CONTEXT.md decision coverage

All 22 decisions from `21-CONTEXT.md` honored at code level:

| Decision | Coverage |
|----------|----------|
| D-01 Helper signature `diagnoseEmptyMatches(titles, couchMemberIds)` returning `{ headline, reasons[] }` | ✓ js/app.js |
| D-02 Module-top placement after `buildMatchExplanation` | ✓ js/app.js:178 |
| D-03 Pure function (no state mutation) | ✓ smoke A14 verifies input immutability |
| D-04 Priority order 1-6 (veto → kidmode → tier → mood → provider → no-yes-votes) | ✓ js/app.js + smoke A12 |
| D-05 Headline copy variants per dominant cause | ✓ 7 distinct headline strings |
| D-06 Chip copy variants per kind | ✓ 6 distinct chip copy strings |
| D-07 BRAND voice + curly apostrophes | ✓ all `'` rendered as `’` (U+2019); no exclamation marks; no banned words |
| D-08 Cap at 3 chips | ✓ smoke A13 verifies cap |
| D-09 Surface integration in renderTonight | ✓ js/app.js:5310 region replaced |
| D-10 Render shape: `<div class="empty empty-conflict-aware"><strong>{headline}</strong><div class="empty-reasons">{chips}</div></div>` | ✓ matches CSS class names |
| D-11 Preserve all-empty branch | ✓ js/app.js:5304 unchanged |
| D-12 Considerable-fallback hint preserved | ✓ rendered as `.empty-consider-hint` after the helper output |
| D-13 No persistence | ✓ render-time only |
| D-14 No new state slots | ✓ no new `state.X = ...` introduced |
| D-15 No Firestore writes | ✓ pure render-time composition |
| D-16/D-21 Single-repo couch only | ✓ no queuenight changes |
| D-17/D-22 sw.js CACHE = `couch-v36.5-conflict-aware-empty` | ✓ live verified |
| D-18 No action affordances (passive diagnosis only for v1) | ✓ no buttons in helper output |
| D-19 Smoke contract coverage | ✓ 14 assertions covering all D-04 reason kinds + edges + immutability |
| D-20 deploy.sh §2.5 + package.json wiring | ✓ 6th smoke if-block + chain extension |

## Process deviation note

This phase **deviated from the standard GSD chain** (CONTEXT.md → discuss → plan → verify → execute → complete). Sequence followed:

1. CONTEXT.md pre-scoped (Phase 20 pattern) — committed as `3c595b4`
2. `/gsd-plan-phase 21 --auto --chain --skip-research` invoked — initialized but interrupted before planner spawned
3. **User redirected** to direct implementation: "I thought you were handling the conflict aware empty state"
4. Auto-chain flag cleared; pivoted to direct ship via inline edits + smoke + commit + deploy
5. CONTEXT.md remained valid as the working spec (treated as PRD-equivalent)
6. No PLAN.md / planner agent / plan-checker / verifier subagent spawned

This `21-SUMMARY.md` is the audit-trail closure for the direct ship — captures what landed, where, and how it maps back to the CONTEXT.md decisions. Future cleanup phases (mirroring Phase 15.6 pattern) can backfill `REQ-21-XX` traceability rows in `REQUIREMENTS.md` if formal traceability is needed; for now the CONTEXT.md decisions + this SUMMARY suffice as the audit trail.

## Pending (deferred per CONTEXT.md `<deferred>`)

- **Action affordances** — "Reset filters" / "Clear vetoes" buttons in the empty state. Passive diagnosis only for v1.
- **Other empty surfaces** — Library / History / Add tab / considerable-list. Phase 21 only touches Tonight matches.
- **Sentry breadcrumb on empty-state render** — read-only surface, no behavior to track.
- **Persistent diagnosis history** — Year-in-Review territory.
- **REQ-21-XX in REQUIREMENTS.md** — documentation debt; defer to a future audit-trail backfill phase mirroring 15.6.
- **Device UAT** — automated smoke + browser-snapshot verifies code; visual confirmation on real iPhone is at user's pace per the 4-day in-person UAT freeze.

---

*Phase: 21-conflict-aware-empty-state*
*Shipped: 2026-04-30 via direct implementation (5 atomic commits 7336c0f → d46a9c7)*
