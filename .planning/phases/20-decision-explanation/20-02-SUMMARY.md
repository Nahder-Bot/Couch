---
phase: 20-decision-explanation
plan: "02"
subsystem: ui
tags: [decision-explanation, card, detail-modal, spin-result, considerable-variant, phase-20]
dependency_graph:
  requires:
    - phase: 20-01
      provides: buildMatchExplanation pure helper at js/app.js:112 with 15-assertion smoke contract
  provides:
    - spin-pick result modal shows italic Instrument Serif explanation sub-line (D-07)
    - Tonight match cards show single-line dim-text footer via .tc-explanation (D-08)
    - renderTonight passes considerableVariant flag to considerable.map call site (D-10)
    - Detail modal shows "Why this is in your matches" section gated on getCurrentMatches().some() (D-09)
    - Three new CSS class blocks: .spin-explanation + .tc-explanation + .detail-why-match
  affects:
    - 20-03-PLAN (deploys these surfaces to production + runs device UAT)
tech-stack:
  added: []
  patterns:
    - Additive template-literal injection — build HTML variable before innerHTML assignment, inject via ${varName}
    - opts param pattern on shared render function (card) for caller-context flags (considerableVariant)
    - Conditional section pattern (let html = ''; if (gate) { html = ...; }) matching Phase 19 kidModeOverrideHtml
    - Canonical couch fallback chain: state.couchMemberIds || state.selectedMembers || []
key-files:
  created: []
  modified:
    - js/app.js — 3 surface integrations of buildMatchExplanation; card(t, opts) signature; considerableVariant flag at considerable.map
    - css/app.css — .spin-explanation (italic serif, dim); .tc-explanation (plain dim); .detail-why-match + h4 + -text
key-decisions:
  - "Variable name prefixes use _20 suffix (_spinCouch20, _cardCouch20, _detailCouch20) to distinguish surfaces and avoid any shadowing risk"
  - "whyMatchHtml in renderDetailShell uses typeof getCurrentMatches === 'function' defensive guard matching kidModeOverride pattern"
  - "buildMatchExplanation count in js/app.js is 5 (not 4): line 103 is a JSDoc comment; lines 112/5545/7761/8167 are 1 decl + 3 call sites — plan criterion of 4 was written before seeing the comment line"
  - ".detail-why-match CSS inserted after .detail-section .provider-logo.mine rule to stay within the detail-section rule neighborhood"
requirements-completed: [REQ-20-07, REQ-20-08, REQ-20-09]
duration: ~20min
completed: "2026-04-29"
---

# Phase 20 Plan 02: Decision Explanation — Surface Integrations Summary

**Three buildMatchExplanation call sites wired into spin-pick modal (italic serif sub-line), match-card footer (dim micro-text), and detail modal (conditional "Why this is in your matches" section); considerable variant plumbed via card(t, opts).**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-04-29T00:00:00Z
- **Completed:** 2026-04-29
- **Tasks:** 3 / 3
- **Files modified:** 2

## Accomplishments

- `showSpinResult` injects `_spinExpl20` as italic Instrument Serif `.spin-explanation` div between meta and providers strip — always visible, `.spin-reason` (celebratory amber) preserved as sibling
- `card(t, opts)` accepts `opts.considerableVariant` flag; builds `.tc-explanation` dim-text footer before `.tc-footer`; `renderTonight` passes `{ considerableVariant: true }` only at `considerable.map` call site; all other call sites (matches, vetoedTitles, Library list) unchanged
- `renderDetailShell` builds `whyMatchHtml` after `kidModeOverrideHtml` block, gated on `getCurrentMatches().some(m => m.id === t.id)`; section omitted when title opened from Library, History, or considerable list

## Task Commits

Each task was committed atomically:

1. **Task 1: Spin-pick result modal italic serif sub-line (D-07)** — `783c946` (feat)
2. **Task 2: Tonight match-card dim footer + considerable variant (D-08 + D-10)** — `62bb033` (feat)
3. **Task 3: Detail modal "Why this is in your matches" section (D-09)** — `81113b5` (feat)

## Files Created/Modified

- `js/app.js` — 3 buildMatchExplanation call sites; card(t, opts) signature; considerable.map considerableVariant flag; whyMatchHtml block in renderDetailShell
- `css/app.css` — `.spin-explanation` (italic serif, ink-dim, centered); `.tc-explanation` (plain dim micro-text, no italic/serif); `.detail-why-match` + `.detail-why-match h4` (italic serif, text-transform:none override) + `.detail-why-match-text` (dim plain)

## Decisions Made

- Prefixed all surface-local vars with `_N20` suffix to guarantee no shadowing in their respective function scopes
- Used `typeof getCurrentMatches === 'function'` defensive guard in renderDetailShell (matches Phase 19's `typeof isCurrentUserParent` pattern)
- `.detail-why-match h4` explicitly overrides `text-transform: uppercase` and `letter-spacing: 0.18em` from `.detail-section h4` default rule — required because `renderDetailShell` does not wrap in `.detail-section`
- CSS insertion points: `.spin-explanation` after `.spin-reason`, `.tc-explanation` after `.tc-note.declined`, `.detail-why-match` after `.detail-section .provider-logo.mine`

## Deviations from Plan

None — plan executed exactly as written. All 3 tasks implemented per PLAN.md action blocks. All acceptance criteria passed on first attempt.

**Note on buildMatchExplanation count:** The plan's verification criterion specified "exactly 4" occurrences (`grep -c "buildMatchExplanation(" js/app.js`). The actual count is 5: line 103 is a JSDoc comment (`// buildMatchExplanation(t, couchMemberIds, opts) -> string`) that predates this plan (from Wave 1). The 4 functional occurrences are: line 112 (declaration) + lines 5545 / 7761 / 8167 (3 call sites). Not a defect.

## Issues Encountered

None.

## Known Stubs

None. All 3 surfaces call `buildMatchExplanation` with live state; the helper returns `''` on empty couch or null title, and all 3 template literals gate on the non-empty string before rendering the div. No hardcoded placeholder text anywhere in the touched regions.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. Phase 20 is purely additive read-only display (confirmed per plan threat model T-20-04/05/06). No new threat flags beyond what the plan's threat model already captured.

## Wave 2 Verification Results

All verification gates passed after Task 3:

| Gate | Command | Result |
|------|---------|--------|
| 1 | `node --check js/app.js` | PASS |
| 2 | `grep -c "spin-explanation" js/app.js` | 1 (class name in template literal; `${explHtml}` injection separate) |
| 3 | `grep -c "tc-explanation" js/app.js` | 1 |
| 4 | `grep -c "detail-why-match" js/app.js` | 2 (block + template literal injection) |
| 5 | `grep -c "considerableVariant: true" js/app.js` | 1 (only considerable.map) |
| 6 | `grep -c "^.spin-explanation {" css/app.css` | 1 |
| 7 | `grep -c "^.tc-explanation {" css/app.css` | 1 |
| 8 | `grep -c "^.detail-why-match {" css/app.css` | 1 |
| 9 | `npm run smoke` | 5 contracts green, exit 0 |

## Self-Check

| Item | Status |
|------|--------|
| `js/app.js` — spin-explanation injection present | FOUND |
| `js/app.js` — card(t, opts) signature | FOUND |
| `js/app.js` — cardExplHtml + considerableVariant flag | FOUND |
| `js/app.js` — whyMatchHtml block in renderDetailShell | FOUND |
| `css/app.css` — .spin-explanation class | FOUND |
| `css/app.css` — .tc-explanation class | FOUND |
| `css/app.css` — .detail-why-match + h4 + -text classes | FOUND |
| commit `783c946` (Task 1: spin sub-line) | FOUND |
| commit `62bb033` (Task 2: card footer) | FOUND |
| commit `81113b5` (Task 3: detail section) | FOUND |
| `npm run smoke` exit 0, 5 contracts green | PASS |

## Self-Check: PASSED

## Next Phase Readiness

Plan 03 (Wave 3 deploy) is ready to execute. It will run `bash scripts/deploy.sh 36.2-decision-explanation` to bump sw.js CACHE to `couch-v36.2-decision-explanation`, mirror to queuenight/public/, and deploy to Firebase Hosting (queuenight-84044). Device UAT on couchtonight.app is deferred to Plan 03.

---
*Phase: 20-decision-explanation*
*Completed: 2026-04-29*
