# Phase 20: Decision Explanation — Pattern Map

**Mapped:** 2026-04-29
**Files analyzed:** 5 (2 new, 3 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `js/app.js` (helper insertion at ~line 100) | helper / pure function | transform | `js/app.js:93-99` `getEffectiveTierCap` | exact |
| `js/app.js` (spin-pick surface, ~line 8062) | template injection | request-response | `js/app.js:8062-8074` existing `content.innerHTML` block | exact |
| `js/app.js` (card() surface, ~line 5464) | template injection | request-response | `js/app.js:5464-5481` existing `card()` return | exact |
| `js/app.js` (renderDetailShell surface, ~line 7667) | template injection | request-response | `js/app.js:7653-7677` `kidModeOverrideHtml` block + return | exact |
| `scripts/smoke-decision-explanation.cjs` | smoke contract | batch / transform | `scripts/smoke-kid-mode.cjs` | exact |
| `scripts/deploy.sh` (§2.5 5th block) | build script | batch | `scripts/deploy.sh:101-105` `smoke-kid-mode` if-block | exact |
| `package.json` (smoke chain) | config | — | `package.json:8-12` existing smoke entries | exact |
| `sw.js` (CACHE bump) | cache marker | — | `sw.js:8` current CACHE line | exact |

---

## Pattern Assignments

### `js/app.js` — Helper insertion at module top (~line 100, after `getEffectiveTierCap`)

**Analog:** `js/app.js:93-99` (`getEffectiveTierCap`)

**Module-top pure helper pattern** (lines 93-99):
```javascript
// === Phase 19 / D-09 — single source of truth for kid-mode tier ceiling ===
// Returns 2 (TIER_PG) when state.kidMode is active, else null (no cap from
// kid-mode; existing per-member tier-cap logic still runs). Cheap helper
// called inside 7 filter functions — keep it pure + branch-free.
function getEffectiveTierCap() {
  return state.kidMode ? 2 : null;
}
```

**Translation guide:**
- Copy the `=== Phase N / D-NN — ... ===` comment block header verbatim (adapt phase + decision refs)
- Function declaration goes on the very next line after `getEffectiveTierCap`'s closing brace (line 99)
- Function body uses `state.members` (module-scoped in app.js — fine for runtime; smoke must pass `members` as argument instead)
- No `return` of a DOM element — returns a plain string
- `escapeHtml` is already in scope (imported from `js/utils.js`); `normalizeProviderName` is already in scope (imported from `js/constants.js`)

**Anti-patterns to avoid:**
- Do NOT read `state.couchMemberIds` inside the helper — helper receives `couchMemberIds` as parameter to stay pure and testable
- Do NOT guard against `state.members` being null inside the helper; graceful fallback is: if `state.members.find(...)` returns undefined, fall back to the raw member id string
- Do NOT use `.spin-reason` class — that class uses `color:var(--accent)` (celebratory orange), which is the wrong register for informational text

---

### `js/app.js` — Spin-pick integration (Surface 1, D-07) at `showSpinResult` (~line 8062)

**Analog:** `js/app.js:8062-8074` (current `content.innerHTML` assignment)

**Existing innerHTML block** (lines 8062-8074):
```javascript
content.innerHTML = `${confettiHtml}
    <div class="spin-result-poster" style="background-image:url('${t.poster||''}')"></div>
    <div class="spin-result-name">${escapeHtml(t.name)}</div>
    <div class="spin-result-meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}${t.runtime?' · '+t.runtime+'m':''}</div>
    ${provHtml}
    <div class="spin-reason">✨ ${escapeHtml(pick.reason || 'A couch favorite')}</div>
    <div class="spin-actions">
      <button class="spin-accept" onclick="acceptSpin('${t.id}')">Watch this tonight</button>
      <button class="spin-watchtogether" onclick="spinStartWatchparty('${t.id}')">🎬 Watch together</button>
      <button class="spin-reroll" onclick="spinPick()">🎲 Spin again</button>
      <button class="spin-veto" onclick="openVetoModal('${t.id}', {fromSpinResult: true})">Pass on it</button>
      <button class="spin-cancel" onclick="closeSpinModal()">Cancel</button>
    </div>`;
```

**Translation guide:**
- Build `explHtml` variable BEFORE `content.innerHTML = ...` (same pattern as how `provHtml` is built earlier in `showSpinResult`)
- Insert `${explHtml}` between `.spin-result-meta` and `${provHtml}` (the explanation sits between the meta facts and the providers strip)
- Couch source: `state.couchMemberIds || state.selectedMembers || []`
- Leave `.spin-reason` div unchanged — it is a separate celebratory layer, not replaced by the explanation

**Code shape to add (before the innerHTML assignment):**
```javascript
const couch = state.couchMemberIds || state.selectedMembers || [];
const explanation = buildMatchExplanation(t, couch);
const explHtml = explanation
  ? `<div class="spin-explanation">${explanation}</div>`
  : '';
```

**CSS addition** (add near `.spin-reason` at `css/app.css:1612`):
```css
.spin-explanation {
  font-size: var(--t-meta);
  font-style: italic;
  font-family: var(--font-serif);
  color: var(--ink-dim);
  margin-bottom: 10px;
}
```

**Anti-patterns to avoid:**
- Do NOT reuse `.spin-reason` class — it applies `color:var(--accent)` (warm orange celebratory); explanation needs `--ink-dim`
- Do NOT replace `pick.reason` / `.spin-reason` — D-07 adds a sibling line, not a replacement
- Do NOT use `state.selectedMembers` alone — always the `|| state.couchMemberIds` fallback chain

---

### `js/app.js` — Card() integration (Surface 2, D-08) at `function card(t)` (~line 5297)

**Analog:** `js/app.js:5464-5481` (card return template literal, `.tc-body` structure)

**Existing `.tc-body` tail structure** (lines 5469-5481):
```javascript
      ${scheduledNote}
      ${blockedNote}
      ${vetoNote}
      ${approvalNote}
      ${voteChips && !isPending && !isDeclined ? `<div class="tc-vote-strip">${voteChips}</div>` : ''}
      <div class="tc-footer">
        ${primaryBtn}
        ${trailerBtnHtml}
        <button class="tc-more" aria-label="More options" onclick="openActionSheet('${t.id}',event)" title="More">⋯</button>
      </div>
    </div>
  </div>`;
```

**Translation guide:**
- Add an optional `opts` second parameter to `card(t)`: `function card(t, opts)` where `opts = {}` by default
- Build `cardExplHtml` variable before the return statement, using `opts.considerableVariant` to determine D-10 variant
- Insert `${cardExplHtml}` immediately before `<div class="tc-footer">` — that is, after the `voteChips` strip line
- Couch source resolved from `card()`'s caller context: pass through as `opts.couch` OR use `state.couchMemberIds || state.selectedMembers || []` inside card()
- D-10 variant: when `opts.considerableVariant === true`, pass the flag through to `buildMatchExplanation` so the 1-voter case reads "Some of you said yes" instead of the member's name

**Code shape to add (before the return statement):**
```javascript
const cardCouch = (opts && opts.couch) || state.couchMemberIds || state.selectedMembers || [];
const cardExpl = buildMatchExplanation(t, cardCouch, { considerableVariant: !!(opts && opts.considerableVariant) });
const cardExplHtml = cardExpl
  ? `<div class="tc-explanation">${cardExpl}</div>`
  : '';
```

**CSS addition** (add near `.tc-note` rules):
```css
.tc-explanation {
  font-size: var(--t-micro);
  color: var(--ink-dim);
  margin: var(--s1) 0 var(--s2);
  line-height: 1.4;
}
```

**Anti-patterns to avoid:**
- Do NOT call `getCurrentMatches()` from inside `card()` — `renderTonight` already has `matches` and `considerable` arrays in scope; use the `opts.considerableVariant` flag passed from the caller
- Do NOT apply italic/Instrument Serif on the card footer — D-08 calls for dim-text only (informational, not theatrical). Italic serif is D-07 (spin) and D-09 (detail modal) only
- Do NOT forget to update the `renderTonight` caller sites: `matches.map(t => card(t))` and `considerable.map(t => card(t, { considerableVariant: true }))`

---

### `js/app.js` — Detail modal integration (Surface 3, D-09) at `renderDetailShell(t)` (~line 7605)

**Analog:** `js/app.js:7653-7677` (`kidModeOverrideHtml` computation + return block)

**Existing Phase 19 conditional section pattern** (lines 7653-7677):
```javascript
  // Phase 19 / D-10..D-12 — Per-title parent override.
  let kidModeOverrideHtml = '';
  if (state.kidMode && tier !== null && tier > 2 && typeof isCurrentUserParent === 'function' && isCurrentUserParent()) {
    if (state.kidModeOverrides && state.kidModeOverrides.has && state.kidModeOverrides.has(t.id)) {
      kidModeOverrideHtml = `<p class="kid-mode-override-active">Showing this for tonight (kid-mode override)</p>`;
    } else {
      kidModeOverrideHtml = `<p class="kid-mode-override-row"><a href="#" class="kid-mode-override-link" onclick="kidModeOverrideTitle('${escapeHtml(t.id)}'); return false;">Show this anyway for tonight</a></p>`;
    }
  }
  return `<div class="detail-backdrop" ...>
  <div class="detail-body">
    ...
    ${kidModeOverrideHtml}
    ${renderTvProgressSection(t)}
```

**Translation guide:**
- Mirror the `let whyMatchHtml = ''; if (...) { whyMatchHtml = \`...\`; }` pattern exactly
- Insert the Phase 20 block immediately after the `kidModeOverrideHtml` block (after line 7665)
- Gate condition: `getCurrentMatches().some(m => m.id === t.id)` — section is omitted for considerable-only titles per Open Question #1 resolution (D-09 says "matches list" only)
- Guard the `getCurrentMatches` call: `(typeof getCurrentMatches === 'function') ? getCurrentMatches() : []`
- Style: italic Instrument Serif `h4` heading + dim `p` for the phrase — matches `kid-mode-override-link` aesthetic register (css/app.css:3675)
- Insert `${whyMatchHtml}` in the template literal between `${kidModeOverrideHtml}` and `${renderTvProgressSection(t)}`

**Code shape to add (after kidModeOverrideHtml block, before return):**
```javascript
  let whyMatchHtml = '';
  const currentMatches = (typeof getCurrentMatches === 'function') ? getCurrentMatches() : [];
  const isInMatches = currentMatches.some(m => m.id === t.id);
  if (isInMatches) {
    const couch = state.couchMemberIds || state.selectedMembers || [];
    const whyStr = buildMatchExplanation(t, couch);
    if (whyStr) {
      whyMatchHtml = `<div class="detail-why-match">
        <h4>Why this is in your matches</h4>
        <p class="detail-why-match-text">${whyStr}</p>
      </div>`;
    }
  }
```

**CSS addition** (add near `.detail-section` rules):
```css
.detail-why-match {
  padding: var(--s3) 0 var(--s2);
  border-top: 1px solid var(--border);
}
.detail-why-match h4 {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--t-body);
  font-weight: 400;
  color: var(--ink);
  margin: 0 0 var(--s2);
}
.detail-why-match-text {
  font-size: var(--t-meta);
  color: var(--ink-dim);
  margin: 0;
  line-height: 1.5;
}
```

**Anti-patterns to avoid:**
- Do NOT show the section for considerable (non-match) titles — D-09 explicitly gates on "t.id in matches list"
- Do NOT use inline `opacity:0.6` style (Phase 18's `detail-prov-attribution` shortcut) — use semantic CSS class for maintainability
- Do NOT use `font-style:italic` on the `p.detail-why-match-text` — only the `h4` heading gets italic serif; the phrase text is plain dim

---

### `scripts/smoke-decision-explanation.cjs` — New smoke contract

**Analog:** `scripts/smoke-kid-mode.cjs` (lines 1-119, read in full)

**File header pattern** (lines 1-21 of smoke-kid-mode.cjs):
```javascript
// Phase 19 — smoke test for kid-mode tier-cap behavior.
// Run: node scripts/smoke-kid-mode.cjs
// Exit 0 = pass; exit 1 = fail.
//
// Locks the kid-mode gate negotiated at /gsd-discuss-phase 19 (D-07..D-09).
// Mirrors the helper + filter logic from js/app.js so the contract is
// testable without a browser, Firestore, or auth state.
```

**Test harness pattern** (lines 51-62 of smoke-kid-mode.cjs):
```javascript
let passed = 0;
let failed = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    console.log(`OK   ${label}: ${actual}`);
    passed++;
  } else {
    console.error(`FAIL ${label}: got ${actual}, expected ${expected}`);
    failed++;
  }
}
```

**Inline mirror pattern** (lines 24-29 of smoke-kid-mode.cjs — inlining RATING_TIERS from constants.js):
```javascript
// ---- Mirror of js/constants.js RATING_TIERS + tierFor ----
const RATING_TIERS = {
  'G':1,'PG':2,'PG-13':3,'R':4,'NC-17':5,'NR':3,'UR':3,
  'TV-Y':1,'TV-Y7':1,'TV-G':1,'TV-PG':2,'TV-14':3,'TV-MA':5
};
function tierFor(rating) { return RATING_TIERS[rating] || null; }
```

**Result tail pattern** (lines 118-119 of smoke-kid-mode.cjs):
```javascript
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
```

**Translation guide:**
- Copy the header comment verbatim, adapt phase ref (19 → 20) and decision refs (D-07..D-09 → D-01..D-06 + D-10)
- Use `'use strict';` on line 1 (before comments) matching smoke-kid-mode.cjs convention
- Inline a minimal brand-normalization map (Netflix, Max, Prime Video, Hulu, Disney+ — covers the 5 assertion brands): `const BRAND_MAP = { 'Netflix': 'Netflix', 'Max': 'Max', 'HBO Max': 'Max', 'Hulu': 'Hulu', 'Amazon Prime Video': 'Prime Video', 'Disney+': 'Disney+' }; function normalizeProviderName(name) { return BRAND_MAP[name] || name || null; }`
- Mirror `buildMatchExplanation(t, couchMemberIds, members, opts)` inline — the smoke version takes an explicit `members` array (4th position) instead of reading `state.members`; caller passes the `opts` object for the considerable variant flag
- Copy `check()` harness verbatim
- Implement all 15 assertions (A1–A15) per RESEARCH.md §Smoke Contract Design assertion table
- Copy result tail verbatim

**Anti-patterns to avoid:**
- Do NOT `require()` or `import` from `js/constants.js` or `js/utils.js` — they are ES modules; CJS `require()` on them throws `ERR_REQUIRE_ESM`. Inline the brand map and a local `escapeHtml = s => String(s)` stub
- Do NOT add a `module.exports` tail-shim to `js/constants.js` — it would break the ES module
- Do NOT cross-require from the smoke-availability.cjs pattern (which does a cross-repo `require`) — this smoke is fully self-contained like smoke-kid-mode.cjs

---

### `scripts/deploy.sh` — §2.5 5th smoke if-block

**Analog:** `scripts/deploy.sh:101-105` (the smoke-kid-mode block + echo line)

**Exact analog block** (lines 101-105):
```bash
if [ -f scripts/smoke-kid-mode.cjs ]; then
  node scripts/smoke-kid-mode.cjs > /dev/null \
    || { echo "ERROR: smoke-kid-mode failed -- aborting deploy." >&2; exit 1; }
fi
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode)."
```

**Translation guide:**
- Copy the `if [ -f ... ]; then node ... > /dev/null || { echo "ERROR: ... failed -- aborting deploy." >&2; exit 1; }; fi` block verbatim, substituting `smoke-kid-mode.cjs` → `smoke-decision-explanation.cjs` and the error label
- Insert the new if-block immediately after line 104 (the `fi` that closes the smoke-kid-mode block), before line 105 (the echo line)
- Update the echo line on line 105 to append `+ decision-explanation`: `echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation)."`
- The echo update replaces line 105 entirely — do not add a second echo

**Anti-patterns to avoid:**
- Do NOT use `node scripts/smoke-decision-explanation.cjs 2>&1` — the other smoke blocks redirect stdout only (`> /dev/null`), not stderr; match the exact redirection pattern
- Do NOT add the new block after the echo line — it must be inside the §2.5 smoke gate section, before the echo confirmation

---

### `package.json` — smoke chain extension

**Analog:** `package.json:8-12` (existing smoke entries)

**Exact analog block** (lines 6-13):
```json
"scripts": {
  "deploy": "bash scripts/deploy.sh",
  "stamp": "node scripts/stamp-build-date.cjs",
  "smoke": "node scripts/smoke-position-transform.cjs && node scripts/smoke-tonight-matches.cjs && node scripts/smoke-availability.cjs && node scripts/smoke-kid-mode.cjs",
  "smoke:position": "node scripts/smoke-position-transform.cjs",
  "smoke:tonight": "node scripts/smoke-tonight-matches.cjs",
  "smoke:availability": "node scripts/smoke-availability.cjs",
  "smoke:kid-mode": "node scripts/smoke-kid-mode.cjs"
}
```

**Translation guide:**
- Append `&& node scripts/smoke-decision-explanation.cjs` to the end of the `"smoke"` value string (after `smoke-kid-mode.cjs`)
- Add a new entry `"smoke:decision-explanation": "node scripts/smoke-decision-explanation.cjs"` at the end of the scripts block, after `"smoke:kid-mode"`
- Keep all existing entries unchanged

**Anti-patterns to avoid:**
- Do NOT reorder existing chain entries
- Do NOT add a trailing comma after the last scripts entry (JSON does not allow trailing commas)

---

### `sw.js` — CACHE bump

**Analog:** `sw.js:8` (current CACHE line)

**Exact analog line** (line 8):
```javascript
const CACHE = 'couch-v36.1-kid-mode';
```

**Translation guide:**
- Replace the string value only: `'couch-v36.1-kid-mode'` → `'couch-v36.2-decision-explanation'` (per D-17)
- This change will be handled automatically by `deploy.sh` when called with the tag `36.2-decision-explanation`; the planner may choose to write the line directly as part of the task or rely on the deploy.sh tag mechanism

**Anti-patterns to avoid:**
- Do NOT change anything else in `sw.js`
- Do NOT increment the major version segment (36.x not 37.x)

---

## Shared Patterns

### escapeHtml — member name safety
**Source:** `js/utils.js:3` (imported into app.js module scope)
**Apply to:** `buildMatchExplanation` wherever member names are interpolated into the output string
```javascript
// Already in scope in app.js — call escapeHtml(m.name) for every name interpolation.
// In smoke contract: inline a no-op stub: const escapeHtml = s => String(s);
// (smoke fixture data uses safe ASCII names — no real HTML risk in tests)
```

### Instrument Serif italic — humility/informational text register
**Source:** `css/app.css:3675` (`.kid-mode-override-link`), `css/app.css:1612` (`.spin-reason`)
**Apply to:** spin-pick explanation div (`.spin-explanation`) and detail modal section heading (`.detail-why-match h4`)
- Class rule: `font-family: var(--font-serif); font-style: italic;`
- NOT applied to the card footer (D-08) — that is plain dim text only

### `--ink-dim` for informational / secondary text
**Source:** `css/app.css:41` — `#847868`
**Apply to:** `.spin-explanation`, `.tc-explanation`, `.detail-why-match-text`
- This token is the established pattern for "recedes into background" text
- Contrast with `var(--accent)` used by `.spin-reason` for celebratory text

### Couch member ID resolution
**Source:** `js/app.js:5105` (verified `state.couchMemberIds`)
**Apply to:** All three `buildMatchExplanation` call sites
```javascript
// Always use this fallback chain at every call site:
const couch = state.couchMemberIds || state.selectedMembers || [];
```

### `node --check` gate
**Source:** `scripts/deploy.sh:78-81`
**Apply to:** `js/app.js` (already in the glob `js/*.js`) — no new file action needed; the helper and injections in app.js are automatically covered by the existing `node --check` loop

---

## No Analog Found

All files have close analogs. No entries in this section.

---

## Metadata

**Analog search scope:** `js/app.js` (targeted grep + offset/limit reads), `scripts/smoke-kid-mode.cjs` (full read), `scripts/deploy.sh` (full read), `package.json` (full read), `sw.js` (full read)
**Files scanned:** 5
**Pattern extraction date:** 2026-04-29
