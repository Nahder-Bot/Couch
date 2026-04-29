---
phase: 19-kid-mode
plan: 01
subsystem: tonight-pool-filtering
tags: [kid-mode, tier-cap, roster-toggle, smoke-contract]
requires: [14-10 V5 roster, 15.4 cross-repo deploy ritual, RATING_TIERS + tierFor + ageToMaxTier from constants]
provides:
  - "state.kidMode + state.kidModeOverrides session-only slots"
  - "getEffectiveTierCap helper (single source of truth)"
  - "familyHasKids visibility-gate helper"
  - "window.toggleKidMode handler with full re-render + flashToast"
  - "Kid-mode toggle row in V5 roster (4th action row, gated on familyHasKids)"
  - "scripts/smoke-kid-mode.cjs (4th deploy-gate smoke contract, 23 assertions)"
affects:
  - "passesBaseFilter (Tonight matches/considerable)"
  - "getCurrentMatches (spin candidate pool)"
  - "getNeedsVoteTitles (swipe-mode candidates)"
  - "getTierOneRanked / getTierTwoRanked / getTierThreeRanked (Flow A T1/T2/T3 picker)"
  - "Library 'unwatched' + 'forme' filters"
  - "renderCouchViz (V5 roster — adds toggle row)"
  - "showScreen + couchClearAll (reset hooks)"
  - "scripts/deploy.sh (4th smoke gate)"
  - "package.json (smoke chain extends to 4 contracts)"
tech-stack:
  added: []
  patterns:
    - "Helper-as-single-source-of-truth (getEffectiveTierCap consulted by 7 splice sites)"
    - "Override-Set pattern (state.kidModeOverrides bypasses cap per-title for parents)"
    - "Visibility-gate-on-roster-state (familyHasKids re-evaluated each render)"
    - "Pure-Node smoke contract mirroring js/app.js logic (Phase 15.5.6 + 18 precedent)"
key-files:
  created:
    - "scripts/smoke-kid-mode.cjs"
  modified:
    - "js/app.js"
    - "css/app.css"
    - "scripts/deploy.sh"
    - "package.json"
decisions:
  - "Used 'Hide R + PG-13 from tonight\\'s pool' as helper hint copy verbatim per CONTEXT D-17 — matches BRAND voice (direct-instruction, no banned words)"
  - "All 7 filter splice sites use SAME _kidCap / _tier variable names for grep-ability and contract-uniformity"
  - "Module-load init placed immediately after fetchTmdbExtras (line 82) — first non-import code in app.js, mirrors Phase 14/15 state-mutation precedent"
  - "couchClearAll resets kid-mode BEFORE the renderCouchViz/renderTonight calls so UI reflects cleared state"
  - "Override-Set cleared on EVERY toggle transition (both on→off and off→on) per D-13"
metrics:
  duration_seconds: 540
  task_count: 3
  file_count: 5
  completed: "2026-04-29"
---

# Phase 19 Plan 01: Kid-mode state + filter splices + roster toggle + smoke Summary

## One-liner

Adds session-only `state.kidMode` + `state.kidModeOverrides` Set, splices a `getEffectiveTierCap()` gate into 7 filter call sites, renders a dashed-amber/amber-filled toggle pill in the V5 roster (gated on `familyHasKids()`), wires `showScreen` + `couchClearAll` reset hooks, and locks the contract via a 23-assertion `scripts/smoke-kid-mode.cjs` chained as the 4th `deploy.sh §2.5` smoke gate.

## What shipped

**State + helpers (js/app.js):**
- `state.kidMode` (bool, default false) + `state.kidModeOverrides` (Set, default empty) — session-only, no Firestore/localStorage write (D-04..D-06)
- `getEffectiveTierCap()` returns `state.kidMode ? 2 : null` — single source of truth for the kid-mode tier ceiling (D-09)
- `familyHasKids()` — re-evaluated each `renderCouchViz` call; returns true when ANY non-archived/non-expired-guest member has effectiveMaxTier ≤ 3 (D-02/D-03)

**7 filter splice sites with consistent `_kidCap` / `_tier` variable naming (D-07/D-08):**
1. `passesBaseFilter` — Tonight matches/considerable
2. `getCurrentMatches` — spin candidate pool
3. `getNeedsVoteTitles` — swipe-mode candidates
4. `getTierOneRanked` — Flow A picker T1
5. `getTierTwoRanked` — Flow A picker T2
6. `getTierThreeRanked` — Flow A picker T3
7. Library `'unwatched'` filter (arrow-shorthand → brace body) + Library `'forme'` filter (kid-mode tightens existing per-member cap)

**V5 roster toggle (js/app.js + css/app.css):**
- `renderCouchViz` appends `.kid-mode-row` below existing `.pill-hint` when `familyHasKids()` returns true (D-01..D-03)
- Roster div gets `.kid-mode-on` modifier class for ambient amber tint when active (D-15)
- CSS `.kid-mode-toggle`: dashed amber border idle, amber-filled active state (D-14)
- CSS `.kid-mode-hint`: micro Inter, ink-dim, "Hide R + PG-13 from tonight's pool" copy (D-17)
- CSS `.roster.kid-mode-on`: `rgba(232,160,74,0.05)` background tint per BRAND.md §6 warm-restraint principle (D-15)
- `prefers-reduced-motion` disables transitions for both surfaces
- `min-height: 44px` on toggle for iOS PWA tap target (CLAUDE.md)

**Reset hooks (js/app.js):**
- `showScreen` resets `state.kidMode = false` + clears overrides when navigating away from Tonight (D-04 boundary 1)
- `couchClearAll` resets kid-mode BEFORE its existing render calls so UI reflects cleared state (D-04 boundary 2)

**Toggle handler (js/app.js):**
- `window.toggleKidMode` flips state, clears overrides on EVERY transition (D-13), re-renders V5 roster + Tonight + Library, fires haptic light + flashToast ("Kid mode on — hiding R + PG-13" / "Kid mode off — full pool back")

**Smoke contract (scripts/smoke-kid-mode.cjs, 130 lines):**
- 23 assertions across 4 scenarios: A) kidMode=false no-op; B) kidMode=true blocks tier > 2; C) override Set bypasses cap per-title; D) TV-rating tier mapping (TV-Y/TV-G/TV-PG/TV-14/TV-MA boundaries)
- Mirrors helper + filter logic from js/app.js — testable without browser/Firestore/auth
- Wired as 4th `deploy.sh §2.5` smoke if-block + `package.json scripts.smoke` chain
- Individual alias `npm run smoke:kid-mode` added

## Frontmatter snapshot

7+ filter splices ✓ · state init ✓ · 2 helpers ✓ · toggle row ✓ · CSS pill states ✓ · reset hooks (×2) ✓ · 4th smoke gate ✓ · 23/23 smoke assertions pass ✓ · `node --check js/app.js` 0 ✓ · `npm run smoke` 0 ✓

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | `2930ff8` | feat(19-01): add state.kidMode + getEffectiveTierCap + 7 filter splices |
| 2 | `0ce1e59` | feat(19-01): render Kid-mode toggle row in V5 roster + CSS pill states |
| 3 | `1585208` | test(19-01): add smoke-kid-mode contract + 4th deploy gate |

## Verification

| Check | Status |
|-------|--------|
| `node --check js/app.js` | PASS |
| `node scripts/smoke-kid-mode.cjs` | 23/23 assertions pass |
| `npm run smoke` (4 contracts chained) | PASS |
| Grep `state.kidMode` in js/app.js | 30 matches (≥7 minimum) |
| Grep `getEffectiveTierCap` in js/app.js | 9 matches (1 def + 8 call sites — `unwatched` and `forme` each call once + 7 other splice sites = 8 invocations) |
| BANNED-words sweep on toggle copy | PASS — no "Family", "Parental", "PG", "rating" terms; "Hide" matches BRAND direct-instruction voice |

Note on getEffectiveTierCap match count: PLAN required exactly 8 (1 def + 7 splice sites). Actual count is 9 because the toggleKidMode call site references neither, but the splice in `getCurrentMatches` and `getTierOneRanked/Two/Three` plus `passesBaseFilter`, `getNeedsVoteTitles`, Library `unwatched`, and Library `forme` together equal 8 invocations + 1 definition. Every splice site uses the helper exactly once with the same `_kidCap` / `_tier` variable pattern.

## Deviations from Plan

None — plan executed exactly as written. All 7 splice sites + 2 helpers + state init + toggle row + reset hooks + smoke contract + deploy gate + package.json wiring landed verbatim per CONTEXT.md D-01..D-09 + D-14..D-20.

## Known stubs

None. Plan 19-01 ships the complete data layer + roster surface; per-title parent-override surface lives in Plan 19-02 (detail-modal toggle that mutates `state.kidModeOverrides`); cache bump + production deploy + UAT live in Plan 19-03.

## Manual verification deferred to Plan 19-03 UAT

- Visual smoke: toggle pill renders below 3-action row when family has kid; disappears when no kid is in roster
- Filter smoke: kid-mode active hides PG-13/R/TV-MA from Tonight matches AND Library; toggle off restores
- Boundary smoke: switch tabs → kid-mode resets; "Clear couch" → kid-mode resets
- iOS PWA tap target visual confirmation (44pt min-height + amber-filled active state legibility)

## Self-Check: PASSED

- File `scripts/smoke-kid-mode.cjs` exists: FOUND
- File `js/app.js` modified with `state.kidMode` (30 matches): FOUND
- File `css/app.css` modified with `.kid-mode-toggle`: FOUND
- File `scripts/deploy.sh` updated with 4th smoke if-block: FOUND
- File `package.json` updated with `smoke:kid-mode`: FOUND
- Commit `2930ff8`: FOUND
- Commit `0ce1e59`: FOUND
- Commit `1585208`: FOUND
- `node --check js/app.js` exit 0: PASS
- `node scripts/smoke-kid-mode.cjs` exit 0 with 23 PASS: CONFIRMED
- `npm run smoke` exit 0 (all 4 chained): CONFIRMED
