---
phase: 20-decision-explanation
verified: 2026-04-29T00:00:00Z
status: human_needed
score: 13/13 must-haves verified at code level
overrides_applied: 0
human_verification:
  - test: "Surface 1 — Spin-pick result modal: italic Instrument Serif sub-line visible between meta and providers strip (UAT-1)"
    expected: "Explanation text in italic serif font, dim color, between year/kind/runtime meta and providers strip; .spin-reason '✨ A couch favorite' still present below it"
    why_human: "Font rendering and color token visual correctness cannot be verified programmatically; requires real browser on real device to confirm Instrument Serif loads and --ink-dim vs --accent color difference is visible"
  - test: "Surface 2 — Tonight match-card dim footer: plain sans-serif dim text on every match card, above action buttons (UAT-2)"
    expected: "Single-line dim micro-text footer on every match card, plain sans-serif (NOT italic, NOT serif), positioned between vote-strip and tc-footer action row"
    why_human: "Visual font distinction (plain sans vs italic serif) and per-card presence across a real tonight list requires device rendering"
  - test: "Surface 3 — Considerable variant voter phrase: 'Some of you said yes' for 1-of-N (UAT-3)"
    expected: "Considerable cards with exactly 1 yes-voter show 'Some of you said yes'; multi-voter shows name-pair or count format"
    why_human: "Requires a real family with considerable titles (at least one title where exactly 1 couch member voted yes and couch is not unanimous); skippable if no such data exists since smoke A15 regression-locks it"
  - test: "Surface 4 — Detail modal 'Why this is in your matches' section: visible for matches, absent for Library (UAT-4)"
    expected: "Italic serif h4 'Why this is in your matches' + dim plain p text appears when detail modal opened from Tonight matches; section absent when same title opened from Library tab"
    why_human: "The gate condition getCurrentMatches().some(m => m.id === t.id) depends on runtime state — whether a title is actually in the current couch's matches list — which requires a live family session to test the gate both ways"
  - test: "Voice / brand check on rendered UI strings (UAT-5)"
    expected: "No exclamation marks, no marketing language, no banned words in rendered explanation strings"
    why_human: "Static analysis on the code strings is clean (verified below), but the provider phrase uses normalizeProviderName which could produce unusual brand names from TMDB data not covered by the inline brand map; also member names could contain edge characters requiring visual confirmation of escapeHtml correctness"
---

# Phase 20: Decision Explanation Verification Report

**Phase Goal:** Add a humility-voiced explanation layer that answers "why did it pick this?" via a pure helper `buildMatchExplanation(t, couchMemberIds, opts = {})` surfaced on 3 read-only places (spin-pick result modal, tonight matches list, detail modal). Builds from existing data — yes-voters, provider-service intersection, runtime. No new data, no persistence, no Firestore writes. Single-repo couch only. sw.js CACHE bumps to `couch-v36.2-decision-explanation`.
**Verified:** 2026-04-29T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SC-1: `buildMatchExplanation` declared at module top after `getEffectiveTierCap`, zero state mutations | VERIFIED | `js/app.js:112` — `function buildMatchExplanation(t, couchMemberIds, opts) {` immediately after `getEffectiveTierCap` closes at line 99; awk state-mutation scan returns 0 |
| 2 | SC-2: Voter phrase covers 1/2-of-2/2-of-3+/3+ cases; considerable variant uses "Some of you said yes" | VERIFIED | Smoke A3-A6 + A15 all pass; 2-of-N fix at `js/app.js:129` uses `yesVoters.length === 2 && yesVoters.length === couchMemberIds.length` per D-03 planning deviation |
| 3 | SC-3: Provider phrase prefers intersection brand; fallback "Streaming on {first}"; omitted when empty | VERIFIED | Smoke A7-A9 all pass (15/15 exit 0); `js/app.js:142-160` implements intersection logic |
| 4 | SC-4: Runtime ≥60min as `"{H} hr {M} min"` or `"{H} hr"`; else `"{M} min"`; skipped when null or 0 | VERIFIED | Smoke A10-A14 all pass; `js/app.js:162-172` implements runtime guard `t.runtime != null && t.runtime > 0` |
| 5 | SC-5: Output capped at 3 phrases joined with ` · `; drop priority voters > provider > runtime | VERIFIED | Smoke A13-A14 pass; `js/app.js:175` — `phrases.slice(0, 3).join(' · ')` |
| 6 | SC-6: Considerable variant uses "Some of you said yes" for 1-of-N when `opts.considerableVariant === true` | VERIFIED | Smoke A15 passes; `js/app.js:123-125` implements the branch |
| 7 | SC-7: `showSpinResult` renders `.spin-explanation` italic Instrument Serif sub-line; CSS class exists with correct tokens | VERIFIED | `js/app.js:8168` — `const explHtml = _spinExpl20 ? '<div class="spin-explanation">...' : ''`; `js/app.js:8173` — `${explHtml}` between meta and provHtml; `css/app.css:1652-1661` — `.spin-explanation` with `font-family: var(--font-serif); font-style: italic; color: var(--ink-dim)` |
| 8 | SC-8: `card(t, opts)` renders `.tc-explanation` dim-text footer; CSS plain (no italic/serif); only `considerable.map` passes `{considerableVariant: true}`; other call sites unchanged | VERIFIED | `js/app.js:5374` — `function card(t, opts) {`; `js/app.js:5546` — `const cardExplHtml`; `js/app.js:5559` — `${cardExplHtml}`; `js/app.js:5299` — `considerable.map(t => card(t, { considerableVariant: true }))`; `js/app.js:5288` — `vetoedTitles.map(t => card(t))`; `js/app.js:5308` — `matches.map(t => card(t))`; `js/app.js:5689` — `list.map(t => card(t))`; `css/app.css:1509-1514` — `.tc-explanation` has no `font-style: italic`, no `var(--font-serif)` |
| 9 | SC-9: `renderDetailShell` shows "Why this is in your matches" section only when `t.id` in matches; gate uses `getCurrentMatches().some(m => m.id === t.id)`; CSS classes exist | VERIFIED | `js/app.js:7757-7768` — gate via `(typeof getCurrentMatches === 'function') ? getCurrentMatches() : []` then `.some(m => m.id === t.id)`; `js/app.js:7764` — `<h4>Why this is in your matches</h4>`; `css/app.css:1581, 1586, 1596` — `.detail-why-match`, `.detail-why-match h4`, `.detail-why-match-text` all defined |
| 10 | SC-10: Voice/brand check — no exclamation marks, no marketing language, no banned words in helper strings | VERIFIED | All output strings in `js/app.js:112-176` scanned: `'Some of you said yes'`, `'said yes'`, `'All of you said yes'`, `' of you said yes'`, `'Available on '`, `'Streaming on '`, `' hr '`, `' min'`, `' · '` — none contain `!`, `buffer`, `delay`, `queue` (queue-UX context), or marketing language; h4 text `Why this is in your matches` also clean |
| 11 | SC-11: `npm run smoke` exits 0 with all 5 contracts green | VERIFIED | Ran locally — all 5 contracts pass: positionToSeconds (17 assertions) + matches/considerable (29 assertions) + availability (23 assertions) + kid-mode (23 assertions) + decision-explanation (15 assertions); exit 0 |
| 12 | SC-12: `sw.js` CACHE exactly equals `couch-v36.2-decision-explanation`; old `couch-v36.1-kid-mode` absent | VERIFIED | `sw.js:8` — `const CACHE = 'couch-v36.2-decision-explanation';`; `grep -c "couch-v36.1-kid-mode" sw.js` returns 0; `grep -c "couch-v36.2-decision-explanation" sw.js` returns 1 |
| 13 | SC-13: No persistence — zero `setDoc/updateDoc/addDoc` in Phase 20 regions; zero new `state.X =` top-level state slots | VERIFIED | State-mutation scan on helper body (lines 112-176) returns 0; scan on 3 surface regions (lines 5541-5547, 7752-7768, 8165-8169) returns 0; no new module-level `const` declarations from Phase 20 (helper uses only local vars with `_20` suffix); pre-existing 141 Firestore write calls in file are unchanged |

**Score:** 13/13 truths verified at code level

### Deferred Items

None — all 13 success criteria are addressed in Phase 20. No items deferred to later phases.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `js/app.js` | `buildMatchExplanation` pure helper | VERIFIED | Line 112; function body lines 112-176 |
| `scripts/smoke-decision-explanation.cjs` | 15-assertion smoke contract | VERIFIED | Exists; runs in ~50ms; all 15 assertions pass; exit 0 |
| `scripts/deploy.sh` | 5th smoke if-block in §2.5 | VERIFIED | Lines 105-108; error label `smoke-decision-explanation failed -- aborting deploy.`; echo at line 109 mentions `decision-explanation` |
| `package.json` | `smoke:decision-explanation` entry + extended chain | VERIFIED | `smoke` chain has 5 contracts ending in `&& node scripts/smoke-decision-explanation.cjs`; `smoke:decision-explanation` key present |
| `css/app.css` | `.spin-explanation`, `.tc-explanation`, `.detail-why-match` + sub-rules | VERIFIED | Lines 1652, 1509, 1581/1586/1596 respectively |
| `sw.js` | CACHE = `couch-v36.2-decision-explanation` | VERIFIED | Line 8 |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `showSpinResult` (~line 8165) | `buildMatchExplanation` | `_spinExpl20` + `${explHtml}` injection | WIRED | `js/app.js:8167-8173` — called with live `state.couchMemberIds \|\| state.selectedMembers \|\| []`; result conditionally rendered |
| `card(t, opts)` (~line 5374) | `buildMatchExplanation` | `_cardExpl20` + `${cardExplHtml}` injection | WIRED | `js/app.js:5543-5559` — called with live couch state; `opts.considerableVariant` piped through |
| `renderDetailShell(t)` (~line 7752) | `buildMatchExplanation` | `whyMatchHtml` conditional injection | WIRED | `js/app.js:7756-7780` — gated on `getCurrentMatches().some(m => m.id === t.id)` |
| `renderTonight considerable.map` | `card(t, opts)` | `{ considerableVariant: true }` flag | WIRED | `js/app.js:5299` — only considerable.map passes the flag; all other call sites pass no opts |
| `package.json smoke chain` | `scripts/smoke-decision-explanation.cjs` | `&& node scripts/smoke-decision-explanation.cjs` | WIRED | package.json line 8 |
| `scripts/deploy.sh §2.5` | `scripts/smoke-decision-explanation.cjs` | `if [ -f scripts/smoke-decision-explanation.cjs ]` gate | WIRED | deploy.sh lines 105-108 |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `showSpinResult` | `_spinCouch20` | `state.couchMemberIds \|\| state.selectedMembers \|\| []` (runtime Firestore listener) | Yes — live couch membership | FLOWING |
| `card(t, opts)` | `_cardCouch20` | `state.couchMemberIds \|\| state.selectedMembers \|\| []` | Yes — same live state | FLOWING |
| `renderDetailShell` | `_detailCouch20` | `state.couchMemberIds \|\| state.selectedMembers \|\| []` | Yes | FLOWING |
| All surfaces | `t.votes`, `t.providers`, `t.runtime` | Title document from Firestore (pre-existing data) | Yes — from title docs | FLOWING |
| `renderDetailShell` gate | `_detailMatches20` | `getCurrentMatches()` — computes from runtime state | Yes — live match list | FLOWING |

All data flows through live state. Helper returns `''` gracefully when couch is empty or title is null (defensive guard at line 113).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Smoke contract A1-A15 (all cases) | `node scripts/smoke-decision-explanation.cjs` | 15 passed, 0 failed; exit 0 | PASS |
| Full 5-contract chain | `npm run smoke` | All 5 contracts green; exit 0 | PASS |
| Syntax validity | `node --check js/app.js` | Exit 0 | PASS |
| sw.js CACHE string | `grep -c "couch-v36.2-decision-explanation" sw.js` | 1 | PASS |
| Old cache absent | `grep -c "couch-v36.1-kid-mode" sw.js` | 0 | PASS |
| buildMatchExplanation count | `grep -c "buildMatchExplanation(" js/app.js` | 5 (1 JSDoc comment line 103 + 1 declaration line 112 + 3 call sites) | PASS |
| State mutation in helper | awk scan lines 112-176 | 0 mutations | PASS |
| considerableVariant only at considerable.map | `grep -c "considerableVariant: true" js/app.js` | 1 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| REQ-20-01 | 20-01-PLAN | Pure helper, no state mutation | SATISFIED | `js/app.js:112`; mutation scan = 0 |
| REQ-20-02 | 20-01-PLAN | Voter phrase 1/2/3+/all cases | SATISFIED | Smoke A3-A6 pass |
| REQ-20-03 | 20-01-PLAN | Provider phrase intersection/fallback/omit | SATISFIED | Smoke A7-A9 pass |
| REQ-20-04 | 20-01-PLAN | Runtime formatting ≥60/else/null/0 | SATISFIED | Smoke A10-A14 pass |
| REQ-20-05 | 20-01-PLAN | 3-phrase cap + ` · ` separator | SATISFIED | Smoke A13-A14 pass |
| REQ-20-06 | 20-01-PLAN | Considerable variant 1-of-N | SATISFIED | Smoke A15 pass |
| REQ-20-07 | 20-02-PLAN | Spin-pick italic serif sub-line | SATISFIED (code-level) | `js/app.js:8165-8173`; `css/app.css:1652-1661`; device UAT pending |
| REQ-20-08 | 20-02-PLAN | Match card dim-text footer | SATISFIED (code-level) | `js/app.js:5541-5559`; `css/app.css:1509-1514`; device UAT pending |
| REQ-20-09 | 20-02-PLAN | Detail modal "Why this is in your matches" gated | SATISFIED (code-level) | `js/app.js:7752-7780`; `css/app.css:1581-1601`; device UAT pending |
| REQ-20-10 | 20-03-PLAN | sw.js CACHE = `couch-v36.2-decision-explanation` | SATISFIED | `sw.js:8`; old cache absent |
| REQ-20-11 | 20-01-PLAN, 20-03-PLAN | Smoke contract wired into deploy.sh + npm run smoke exits 0 | SATISFIED | `npm run smoke` exit 0; `deploy.sh:105-108` |

**REQUIREMENTS.md update pending:** REQ-20-01 through REQ-20-11 do not yet appear in `.planning/REQUIREMENTS.md`. This is expected for a new-REQ phase — plans declare coverage in frontmatter, REQUIREMENTS.md update is a separate housekeeping task. Not a gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `js/app.js` | 103 | JSDoc comment contains `buildMatchExplanation(t, couchMemberIds, opts) -> string` — matches grep for `buildMatchExplanation(` | INFO | Causes `grep -c "buildMatchExplanation("` to return 5 instead of 4 (1 JSDoc + 1 decl + 3 call sites). Plan 02 acceptance criterion specified "exactly 4" but SUMMARY documents this known deviation correctly. Not a defect — JSDoc comment is intentional documentation. |

No blocker or warning anti-patterns found. No stub placeholders, no hardcoded empty data, no TODO/FIXME in touched regions.

### Human Verification Required

#### 1. Spin-pick Result Modal — Italic Serif Sub-line (UAT-1)

**Test:** From a real device on couchtonight.app, with at least 2 couch members and a title voted yes by both, tap Spin. When the result modal appears, look between the meta line (year · kind · runtime) and the providers strip.
**Expected:** A new sub-line appears in italic Instrument Serif font, dim color (not warm amber), reading something like "Nahder + Zoey said yes · Available on Hulu · 1 hr 38 min". The existing "✨ A couch favorite" `.spin-reason` line remains present below it.
**Why human:** Font rendering (Instrument Serif vs Inter), color token visual correctness (--ink-dim vs --accent), and the coexistence of both lines require a live browser render on a physical device.

#### 2. Tonight Match Cards — Dim Footer (UAT-2)

**Test:** Close the spin modal, scroll the Tonight matches list, inspect every match card.
**Expected:** Each match card shows a single-line dim micro-text footer immediately above the action-button row. Font is plain sans-serif (NOT italic, NOT serif). Color is dim.
**Why human:** Font style distinction (plain vs italic) and verification that every card in the live list renders the footer requires device rendering with real family data.

#### 3. Considerable Variant — "Some of you said yes" (UAT-3, skippable)

**Test:** Scroll to the "Worth considering" section. For each card with exactly 1 yes-voter, check the footer text.
**Expected:** Footer reads "Some of you said yes" (not the member's name). Multi-voter cards show name-pair or count format.
**Why human:** Requires a family session with considerable titles (at least 1 yes-voter but not unanimous). The smoke A15 regression-locks the behavior if device data is unavailable — this is skippable.

#### 4. Detail Modal — Conditional Section Gate (UAT-4)

**Test:** (a) Tap a match card, open detail modal, scroll to find the "Why this is in your matches" section. (b) Close, open the same title from the Library tab's detail modal. Scroll through.
**Expected:** Section (italic serif h4 + dim plain p) visible when opened from matches. Section absent when opened from Library.
**Why human:** The gate `getCurrentMatches().some(m => m.id === t.id)` depends on runtime state — a real family session is required to test both the true and false paths of the gate condition in a live browser.

#### 5. Voice / Brand Check — Rendered Strings on Device (UAT-5)

**Test:** On any of the rendered explanation strings in UAT-1 through UAT-4, scan for exclamation marks, marketing language, or banned words.
**Expected:** All explanation strings are plain, direct, warm/restraint voice. No "!", no "amazing", no "buffer/delay/queue".
**Why human:** Code-level string scan is clean (verified above). However, provider names from TMDB that do not hit the normalizeProviderName whitelist could produce unusual brand output in the live app that the smoke (using a fixed brand map) would not detect.

### Gaps Summary

No code-level gaps. All 13 ROADMAP success criteria are satisfied by the implementation as written. The `human_needed` status reflects the established Couch project pattern for visual/rendering UAT items (same pattern as Phases 18, 19, 15.4, 15.5): code-level acceptance is granted; device walkthrough items are documented in `20-HUMAN-UAT.md` for the user's iPhone session.

The only non-blocking item noted: REQUIREMENTS.md has not yet been updated to formally record REQ-20-01 through REQ-20-11. This is documentation debt, not a phase-blocking gap.

---

_Verified: 2026-04-29T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
