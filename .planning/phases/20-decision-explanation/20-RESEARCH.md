# Phase 20: Decision Explanation — Research

**Researched:** 2026-04-29
**Domain:** Pure-function helper + 3 read-only HTML surface integrations in js/app.js
**Confidence:** HIGH (all findings verified against live source code)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Helper contract**
- D-01: New helper `buildMatchExplanation(title, couchMemberIds)` returns a string.
- D-02: Output format: dot-separated phrases, ≤ 3 phrases. Examples: "Nahder + Zoey said yes · Available on Max · 165 min" / "Both of you said yes · Hulu · 1 hr 38 min" / "Nahder said yes · Streaming on Netflix".
- D-03: Voters phrase: 1 voter → `"{Name} said yes"` / 2 voters → `"{Name1} + {Name2} said yes"` / 3+ voters → `"All of you said yes"` when count == couch.length else `"{count} of you said yes"`.
- D-04: Provider phrase: first brand in `t.providers[]` that intersects ANY couch member's `m.services[]`; fallback `"Streaming on {firstProvider}"` if no intersection but providers exist; omit if no providers.
- D-05: Runtime phrase: `"{H} hr {M} min"` if ≥ 60 min, else `"{M} min"`. Skip if `t.runtime` is null.
- D-06: Cap at 3 phrases; drop priority on overflow: voters > provider > runtime.

**Surface integrations**
- D-07: Spin-pick result modal — italic Instrument Serif sub-line below title name. Always visible.
- D-08: Tonight matches list — small dim-text footer on each match card. Always visible.
- D-09: Detail modal — "Why this is in your matches" section, only when t.id is in current matches list. Omit otherwise.
- D-10: Considerable list — same helper but voter phrase reads `"Some of you said yes"` for 1-of-N.

**Voice**
- D-11: Per BRAND.md: warm, restraint, direct. No marketing language, no exclamation marks. Italic Instrument Serif on spin-pick + detail-modal placements.
- D-12: Banned words: no "buffer", "delay", "queue" (in queue-UX context). "Available", "streaming", "said yes" are fine.

**Out-of-scope guards**
- D-13: No persistence — render-time only.
- D-14: No new state slots on `state.X`.
- D-15: No Firestore writes.
- D-16: Single-repo couch only. NO queuenight changes.
- D-17: sw.js CACHE bumps to `couch-v36.2-decision-explanation`.

### Claude's Discretion
- Final phrase punctuation separator (· character)
- Whether to add smoke contract `scripts/smoke-decision-explanation.cjs` (recommend YES)
- Whether to add Sentry breadcrumb on detail-modal section (probably no — read-only)
- Whether to A/B test always-visible vs tap-to-reveal on match card footer (defer)

### Deferred Ideas (OUT OF SCOPE)
- Persistent decision history (Year-in-Review territory)
- ML / learned recommendations
- Provider-availability confidence beyond Phase 18's "via TMDB" attribution
- Surface restyling beyond text addition (no new modals, no new sections beyond detail-modal "Why this is in your matches")
- Tap-to-expand decision detail
</user_constraints>

---

## Summary

Phase 20 is an intentionally small, pure-additive pass. A single new pure helper `buildMatchExplanation(t, couchMemberIds)` composes a ≤3-phrase dot-separated string from data that already lives on every title object (`t.votes`, `t.providers`, `t.runtime`) and every member object (`m.services`, `m.name`). No Firestore writes, no state slots, no new modals.

The helper surfaces in three read-only integration sites: the spin-pick result modal (`showSpinResult`, line ~8033), the Tonight matches card renderer (`function card(t)`, line ~5297), and the detail modal shell (`renderDetailShell`, line ~7605). The considerable-list cards are a 4th optional call site using a variant voter phrase per D-10.

The smoke contract pattern is well-established: three prior contracts (smoke-tonight-matches.cjs, smoke-availability.cjs, smoke-kid-mode.cjs) each mirror the pure logic from js/app.js in vanilla Node.js. Phase 20 follows smoke-kid-mode.cjs most closely — self-contained helper logic, no cross-repo require, pure function at module top. The smoke contract wires into deploy.sh §2.5 as a 5th `if [ -f ... ]` block and into `package.json` smoke script chain.

**Primary recommendation:** Write `buildMatchExplanation` near `getEffectiveTierCap` (line ~97 in app.js — the established module-top pure helper location), mirror its style exactly. The function takes the title object `t` (not just `title`) to match the D-01 signature parameter name chosen in CONTEXT.md (`title, couchMemberIds`) — note the CONTEXT.md signature uses `title` as first param name; the function body should treat it as the title doc `t`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `buildMatchExplanation` helper | Frontend (js/app.js module top) | — | Pure function, render-time only, reads from already-loaded state; no server involvement |
| Voter name lookup | Frontend (state.members) | — | `state.members` is already loaded at render time; helper receives `couchMemberIds` and looks up names from callers' access to `state.members` |
| Provider intersection | Frontend (t.providers + m.services) | — | Both data shapes already on the client from Firestore subscribe; no new fetch needed |
| Runtime formatting | Frontend (t.runtime) | — | Local integer field, no external data |
| Spin-pick result surface | Frontend (showSpinResult, ~line 8033) | — | Inline HTML injection into `#spin-modal-content` |
| Tonight match card surface | Frontend (function card(t), ~line 5297) | — | Inline HTML via template literal in `card()` |
| Detail modal surface | Frontend (renderDetailShell, ~line 7605) | — | Conditional section in existing detail template |
| Smoke contract | Node.js CLI (scripts/) | — | Pure-function mirror pattern, no Firestore/auth/browser |

---

## Standard Stack

No new libraries. Phase 20 is zero-dependency: plain ES module JavaScript already loaded, existing design tokens, existing CSS classes.

### Reused Assets (verified in source)
| Asset | Location | Purpose in Phase 20 |
|-------|----------|---------------------|
| `normalizeProviderName` | `js/constants.js:41` [VERIFIED] | Brand-normalize `t.providers[i].name` for D-04 intersection |
| `escapeHtml` | `js/utils.js:3` [VERIFIED] | Safe HTML interpolation of member names in output string |
| `state.members` | `js/state.js` (imported in app.js) | Name lookup for voter phrase |
| `state.couchMemberIds` | `js/app.js:5105` [VERIFIED] | Canonical couch composition (V5 source of truth) |
| `t.votes` | Title doc field | Yes-voter enumeration |
| `t.providers[]` | Title doc field (Phase 18 shape) | Provider brand extraction |
| `m.services[]` | Member doc field | Provider intersection per member |
| `t.runtime` | Title doc field | Runtime phrase input |
| `--font-serif` CSS var | `css/app.css:177` [VERIFIED] → `'Instrument Serif', 'Fraunces', serif` | Italic serif style for D-07 + D-09 placements |
| `--ink-dim` CSS token | `css/app.css:41` [VERIFIED] → `#847868` | Dim text color for D-08 card footer |
| `.spin-reason` CSS class | `css/app.css:1612` [VERIFIED] | Existing italic serif style in spin modal — reusable for D-07 |
| `var(--font-serif)` + `font-style:italic` inline | `css/app.css:3675` (kid-mode-override-link) [VERIFIED] | Pattern for Instrument Serif italic inline on detail modal (D-09) |
| `detail-prov-attribution` div pattern | `js/app.js:7641` [VERIFIED] | Precedent for italic attribution text in detail modal |

---

## Architecture Patterns

### System Architecture Diagram

```
state.titles (Firestore subscribe)
    │ t.votes, t.providers, t.runtime
    │
    ▼
buildMatchExplanation(t, couchMemberIds)        ← pure helper, module top ~line 97
    │ reads: t.votes, state.members (name lookup),
    │        t.providers, m.services, t.runtime
    │        normalizeProviderName (constants.js)
    │
    │ returns: "Nahder + Zoey said yes · Available on Max · 165 min"
    │
    ├─── Surface 1: showSpinResult (~line 8033)
    │         inject below .spin-result-name, above .spin-reason
    │         style: reuse .spin-reason (italic serif, --accent) OR new class
    │
    ├─── Surface 2: function card(t) (~line 5297)
    │         inject as dim footer div inside .tc-body, before .tc-footer
    │         style: inline font-size:var(--t-micro); color:var(--ink-dim)
    │
    ├─── Surface 3: renderDetailShell(t) (~line 7605)
    │         inject conditional section after kidModeOverrideHtml block
    │         condition: t.id in getCurrentMatches().map(x=>x.id)
    │         style: detail-section h4 + italic serif sub-line
    │
    └─── Surface 4 (optional, D-10): considerable cards via card(t)
              same card() path but caller passes considerableVariant=true flag
              OR check whether t.id is in considerable list vs matches list

scripts/smoke-decision-explanation.cjs
    │ pure Node.js — no Firestore/auth/browser
    │ mirrors buildMatchExplanation logic inline
    │ ~12-15 assertions
    │
    ▼
scripts/deploy.sh §2.5  ←  5th smoke if-block
package.json "smoke" script  ←  && node scripts/smoke-decision-explanation.cjs appended
```

### Recommended Project Structure (no new files except smoke contract)

```
js/
└── app.js           # buildMatchExplanation added near line 97 (module top, after getEffectiveTierCap)
                     # 3 integration sites modified: showSpinResult, card(), renderDetailShell

scripts/
└── smoke-decision-explanation.cjs    # NEW — 5th smoke contract

scripts/deploy.sh    # Add 5th if-block in §2.5 (mirror smoke-kid-mode pattern exactly)
package.json         # Extend "smoke" script + add "smoke:decision-explanation" entry
sw.js                # CACHE bump to couch-v36.2-decision-explanation (auto via deploy.sh tag)
```

### Pattern 1: Pure Helper at Module Top (mirror getEffectiveTierCap)

`getEffectiveTierCap` at line 97 establishes the module-top pure helper convention: [VERIFIED: js/app.js:93-99]

```javascript
// Source: js/app.js:93-99 (getEffectiveTierCap — Phase 19 pure helper model)
// === Phase 19 / D-09 — single source of truth for kid-mode tier ceiling ===
// Returns 2 (TIER_PG) when state.kidMode is active, else null (no cap from
// kid-mode; existing per-member tier-cap logic still runs). Cheap helper
// called inside 7 filter functions — keep it pure + branch-free.
function getEffectiveTierCap() {
  return state.kidMode ? 2 : null;
}
```

`buildMatchExplanation` follows this style: leading phase-comment block, pure function, no state mutation.

### Pattern 2: Helper Signature + Full Skeleton

```javascript
// === Phase 20 / D-01..D-06 — Decision explanation phrase builder ===
// Pure helper — no state mutation, no Firestore writes, render-time only.
// buildMatchExplanation(t, couchMemberIds) → string
//   t              — title document (needs: t.votes, t.providers, t.runtime)
//   couchMemberIds — array of member ids currently on the couch
// Returns a ≤3-phrase dot-separated string. Returns '' when couch is empty.
function buildMatchExplanation(t, couchMemberIds) {
  if (!t || !Array.isArray(couchMemberIds) || !couchMemberIds.length) return '';
  const votes = t.votes || {};
  const phrases = [];

  // D-03: Voters phrase — who on the couch said yes
  const yesVoters = couchMemberIds.filter(mid => votes[mid] === 'yes');
  if (yesVoters.length > 0) {
    let votersPhrase;
    if (yesVoters.length === 1) {
      const m = state.members.find(x => x.id === yesVoters[0]);
      votersPhrase = escapeHtml(m ? m.name : yesVoters[0]) + ' said yes';
    } else if (yesVoters.length === 2) {
      const n1 = state.members.find(x => x.id === yesVoters[0]);
      const n2 = state.members.find(x => x.id === yesVoters[1]);
      votersPhrase = escapeHtml(n1 ? n1.name : yesVoters[0]) + ' + ' + escapeHtml(n2 ? n2.name : yesVoters[1]) + ' said yes';
    } else if (yesVoters.length === couchMemberIds.length) {
      votersPhrase = 'All of you said yes';
    } else {
      votersPhrase = yesVoters.length + ' of you said yes';
    }
    phrases.push(votersPhrase);
  }

  // D-04: Provider phrase — intersect t.providers with any couch member's services
  const providers = Array.isArray(t.providers) ? t.providers : [];
  if (providers.length) {
    // Build union of all couch members' services
    const couchServices = new Set();
    for (const mid of couchMemberIds) {
      const m = state.members.find(x => x.id === mid);
      if (m && Array.isArray(m.services)) m.services.forEach(s => couchServices.add(s));
    }
    // Find first provider brand that intersects couchServices
    let matchedBrand = null;
    for (const p of providers) {
      const brand = normalizeProviderName(p.name);
      if (brand && couchServices.has(brand)) { matchedBrand = brand; break; }
    }
    if (matchedBrand) {
      phrases.push('Available on ' + matchedBrand);
    } else {
      // Fallback: first normalized brand (D-04)
      const firstBrand = normalizeProviderName(providers[0].name);
      if (firstBrand) phrases.push('Streaming on ' + firstBrand);
    }
  }

  // D-05: Runtime phrase
  if (t.runtime != null) {
    const mins = t.runtime;
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      phrases.push(h + ' hr' + (m ? ' ' + m + ' min' : ''));
    } else {
      phrases.push(mins + ' min');
    }
  }

  // D-06: Cap at 3 phrases (voters > provider > runtime — already in priority order)
  return phrases.slice(0, 3).join(' · ');
}
```

**Note on considerable variant (D-10):** The cleanest approach is a `variant` parameter or a separate call passing a modified voter phrase. Recommended: add an optional `opts` third param `{ considerableVariant: false }`. When `considerableVariant: true`, replace the 1-voter case (`"{Name} said yes"`) with `"Some of you said yes"`. See Risks section for the ambiguity on whether D-10 applies only to cards or also to detail modal.

### Pattern 3: Spin Result Integration (Surface 1 — D-07)

Injection site is `showSpinResult` at line ~8062, immediately after `spin-result-name` div: [VERIFIED: js/app.js:8062-8074]

```javascript
// Source: js/app.js:8062-8074 (current showSpinResult innerHTML — insertion point shown)
content.innerHTML = `${confettiHtml}
  <div class="spin-result-poster" style="background-image:url('${t.poster||''}')"></div>
  <div class="spin-result-name">${escapeHtml(t.name)}</div>
  <div class="spin-result-meta">${escapeHtml(t.year||'')} · ${escapeHtml(t.kind||'')}${t.runtime?' · '+t.runtime+'m':''}</div>
  ${provHtml}
  <div class="spin-reason">✨ ${escapeHtml(pick.reason || 'A couch favorite')}</div>   ← existing .spin-reason
  ...`;
```

**D-07 insertion:** Add explanation div between `.spin-result-meta` and the providers strip. The `.spin-reason` class (css/app.css:1612) already provides `font-style:italic; font-family:'Instrument Serif','Fraunces',serif; color:var(--accent)` — but the explanation should use a softer `--ink-dim` color (it is informational, not celebratory). Recommend a new `spin-explanation` class or inline style:

```javascript
// After spin-result-meta, before provHtml:
const explanation = buildMatchExplanation(t, state.couchMemberIds || state.selectedMembers || []);
const explHtml = explanation
  ? `<div class="spin-explanation">${explanation}</div>`
  : '';
// In innerHTML: insert ${explHtml} between spin-result-meta and ${provHtml}
```

CSS addition (css/app.css — near .spin-reason):
```css
.spin-explanation {
  font-size: var(--t-meta);
  font-style: italic;
  font-family: var(--font-serif);
  color: var(--ink-dim);
  margin-bottom: 10px;
}
```

### Pattern 4: Match Card Integration (Surface 2 — D-08)

Injection site is `function card(t)` at line ~5464, inside `.tc-body`, after existing notes, before `.tc-footer`: [VERIFIED: js/app.js:5464-5481]

```javascript
// Source: js/app.js:5464-5481 (current card() return — .tc-body structure)
return `<div class="tc..." ...>
  <div class="tc-poster" ...></div>
  <div class="tc-body">
    <div class="tc-name">...</div>
    <div class="tc-meta">...</div>
    ${providersHtml}
    ${scheduledNote}
    ${blockedNote}
    ${vetoNote}
    ${approvalNote}
    ${voteChips && !isPending && !isDeclined ? `<div class="tc-vote-strip">${voteChips}</div>` : ''}
    <div class="tc-footer">...</div>    ← insert explanation BEFORE this footer
  </div>
</div>`;
```

**D-08 insertion:** Add explanation line immediately before `<div class="tc-footer">`:

```javascript
const couch = state.couchMemberIds || state.selectedMembers || [];
const cardExpl = buildMatchExplanation(t, couch);
const cardExplHtml = cardExpl
  ? `<div class="tc-explanation">${cardExpl}</div>`
  : '';
// In template literal: insert ${cardExplHtml} before <div class="tc-footer">
```

CSS addition (near `.tc-note` rules):
```css
.tc-explanation {
  font-size: var(--t-micro);
  color: var(--ink-dim);
  margin: var(--s1) 0 var(--s2);
  line-height: 1.4;
}
```

**Note on considerable variant (D-10):** The `card()` function is shared by matches AND considerable list. D-10 says the considerable variant uses `"Some of you said yes"` instead of the 1-voter-name form. The caller site (`renderTonight`) renders both via `card(t)`. Detection approach: `card()` currently cannot tell whether it's rendering a match vs considerable card without additional context. Two options: (a) pass an optional `opts` param to `card()` e.g. `card(t, { considerable: true })`, or (b) call `buildMatchExplanation` with a variant flag inside the template map in `renderTonight`. Option (b) is cleaner since `renderTonight` already has the `matches` and `considerable` arrays in scope. See Risks §1 for detail.

### Pattern 5: Detail Modal Integration (Surface 3 — D-09)

Injection site is `renderDetailShell(t)` at line ~7667, inside `.detail-body`. Best insertion point: after `kidModeOverrideHtml` (line ~7677), before `renderTvProgressSection`: [VERIFIED: js/app.js:7667-7689]

```javascript
// Source: js/app.js:7667-7689 (renderDetailShell return block — insertion window)
return `<div class="detail-backdrop" ...>...</div>
  <div class="detail-body">
    <div class="detail-name">...</div>
    <div class="detail-meta">...</div>
    ...
    ${kidModeOverrideHtml}         ← Phase 19 added this
    ${/* NEW: Phase 20 'Why this is in your matches' section goes here */}
    ${renderTvProgressSection(t)}
    ${trailerHtml}
    ...
  </div>`;
```

**D-09 insertion:** Build the section conditionally:

```javascript
// Inside renderDetailShell(t), after the kidModeOverrideHtml computation:
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
// Then insert ${whyMatchHtml} in the template literal
```

CSS addition (near detail-section rules):
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

**Pattern precedent:** Phase 18 `providerAttribution` (line 7641) uses `font-style:italic;opacity:0.6;` inline on a dim text line — the same aesthetic register. Phase 19 `kidModeOverrideHtml` uses `.kid-mode-override-link` with `font-family:var(--font-serif);font-style:italic;font-size:var(--t-meta);color:var(--ink-warm)` — similar Instrument Serif italic placement. Both confirm the "detail-modal humanizing text" pattern. [VERIFIED: js/app.js:7641, 7663-7664; css/app.css:3675-3699]

### Pattern 6: Smoke Contract Design (scripts/smoke-decision-explanation.cjs)

Follows `smoke-kid-mode.cjs` pattern exactly:
- Self-contained — no cross-repo require (unlike smoke-availability.cjs which requires queuenight)
- Mirrors `buildMatchExplanation` logic inline
- `'use strict'` + simple `check(label, actual, expected)` harness
- Exit 0 = pass, exit 1 = fail

```javascript
// scripts/smoke-decision-explanation.cjs — recommended structure
'use strict';

// ---- Mirror of normalizeProviderName (simplified subset for smoke) ----
// OR: require-shimming from js/constants.js if it exports via module.exports
// Recommend: inline the 5 most-used brand normalizations to keep smoke pure.

// ---- Mirror of buildMatchExplanation logic ----
function buildMatchExplanation(t, couchMemberIds, members, opts) {
  // inline the same logic as js/app.js version
}

// ---- Test harness (identical to smoke-kid-mode.cjs) ----
let passed = 0; let failed = 0;
function check(label, actual, expected) { ... }

// ---- Test cases covering all D-02..D-06 + D-10 scenarios ----
```

**Constants.js module shim note:** `normalizeProviderName` is an ES module export (`export function`). CJS smoke scripts cannot `require()` it directly. Smoke contracts have two options: (a) inline the brand-normalization map (5-10 entries is sufficient for smoke purposes), or (b) add a `module.exports` tail shim to `js/constants.js`. Option (a) is strongly preferred — it avoids modifying constants.js, matches the smoke-kid-mode pattern (which inlined `RATING_TIERS` + `tierFor`), and keeps the smoke completely self-contained.

### deploy.sh §2.5 Wiring (5th smoke block)

```bash
# Mirror exactly from smoke-kid-mode.cjs block (lines 101-104):
if [ -f scripts/smoke-decision-explanation.cjs ]; then
  node scripts/smoke-decision-explanation.cjs > /dev/null \
    || { echo "ERROR: smoke-decision-explanation failed -- aborting deploy." >&2; exit 1; }
fi
```

Also update the `echo` confirmation at line 105:
```bash
echo "Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation)."
```

### Anti-Patterns to Avoid

- **Reading `state.selectedMembers` directly in `buildMatchExplanation`:** The V5 source of truth is `state.couchMemberIds`. Always pass couch as a parameter to keep the function pure (testable in smoke without mocking state). Call sites resolve `state.couchMemberIds || state.selectedMembers || []` before calling.
- **Putting member name lookup inside the pure helper:** The helper receives `couchMemberIds` (array of IDs). It MUST still be able to look up names from `state.members` — but since `state` is module-scoped in app.js, this is fine at the call site. In the smoke contract, pass a `members` array argument instead of relying on `state`.
- **Using `.spin-reason` class for the spin-pick explanation:** `.spin-reason` uses `color:var(--accent)` (warm orange) which conveys celebration. The explanation should use `--ink-dim` to read as informational, not promotional.
- **Calling `getCurrentMatches()` inside card():** `renderTonight()` already has `matches` and `considerable` in scope. Pass the needed context to the explanation call rather than recomputing from within `card()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Brand name normalization | Custom brand-string cleaning | `normalizeProviderName` from `js/constants.js:41` | Already handles 20+ provider name variants including "HBO Max"→"Max", "Amazon Prime Video"→"Prime Video" |
| HTML escaping member names | Manual replace | `escapeHtml` from `js/utils.js:3` | Members can have names with `<>&'"` characters |
| Provider intersection logic | New couch-services aggregation | Mirror `titleMatchesProviders` pattern at `js/app.js:4877` | Union of all members' services is already the standard; member services are already normalized |

---

## Surface Integration Map

| Surface | Function | Approx Line | Insertion Approach | Couch ID Source |
|---------|----------|-------------|-------------------|-----------------|
| Spin-pick result | `showSpinResult(pick, meta)` | ~8033 (verified) | Template literal — add `explHtml` between `.spin-result-meta` and `provHtml` | `state.couchMemberIds \|\| state.selectedMembers` |
| Tonight matches card | `function card(t)` | ~5297 (verified) | Template literal — add `cardExplHtml` before `.tc-footer`; considerable variant via caller flag | `state.couchMemberIds \|\| state.selectedMembers` (resolved in renderTonight scope) |
| Detail modal | `renderDetailShell(t)` | ~7605 (verified) | Conditional section after `kidModeOverrideHtml` block; gate on `getCurrentMatches().some(m => m.id === t.id)` | `state.couchMemberIds \|\| state.selectedMembers` |
| Considerable cards (optional, D-10) | `function card(t)` | ~5297 (same as above) | Same `card()` function; considerable variant flag distinguishes phrase | Same as match cards |

---

## Common Pitfalls

### Pitfall 1: `card()` can't distinguish match vs considerable

**What goes wrong:** `card()` is called for both matches and considerable lists in `renderTonight`. D-10 requires the considerable variant to say `"Some of you said yes"` for single-voter case. Without context, `card()` can't know which list it's in.

**Why it happens:** `card()` is a shared tile renderer — it doesn't receive list-membership context.

**How to avoid:** Two clean options:
1. **Preferred:** Add an optional second parameter to `card()` — `function card(t, opts)` where `opts = { considerableVariant: false }`. In `renderTonight`, call `considerable.map(t => card(t, { considerableVariant: true }))` and `matches.map(t => card(t))`. The `buildMatchExplanation` call inside `card()` passes the variant flag through.
2. **Alternative:** Move explanation rendering out of `card()` entirely and inject it in the `renderTonight` map. This avoids touching `card()`'s signature but duplicates insertion logic.

**Warning signs:** If D-10 considerable cards show `"{Name} said yes"` instead of `"Some of you said yes"`, the variant flag wasn't passed.

### Pitfall 2: `state.couchMemberIds` may be empty on first render

**What goes wrong:** During initial app load, `state.couchMemberIds` is set asynchronously when the `couchInTonight` Firestore listener fires. If `renderDetailShell` is called before that listener resolves, `couchMemberIds` is empty and `buildMatchExplanation` returns `''`.

**Why it happens:** Detail modal can be opened before Tonight tab has fully initialized.

**How to avoid:** The fallback `state.couchMemberIds || state.selectedMembers || []` is already the established pattern (verified at js/app.js:5105). The explanation section silently omits when couch is empty — this is the desired behavior (D-09 gate naturally returns false if `isInMatches` is false with empty couch).

### Pitfall 3: `normalizeProviderName` is an ES module export — CJS smoke can't require it

**What goes wrong:** `js/constants.js` uses `export function normalizeProviderName`. CJS `require()` on an ES module throws `ERR_REQUIRE_ESM`.

**Why it happens:** All `js/*.js` files are ES modules (no `package.json` "type":"module" in the repo root, but imports confirm ES syntax). The smoke scripts are CJS (`.cjs` extension).

**How to avoid:** Inline the brand map in the smoke contract (same pattern as smoke-kid-mode.cjs inlining `RATING_TIERS`). Do NOT add a `module.exports` tail-shim to constants.js — it would break the ES module.

**Warning signs:** `TypeError [ERR_REQUIRE_ESM]` when running `node scripts/smoke-decision-explanation.cjs`.

### Pitfall 4: `showSpinResult` uses `state.selectedMembers` not `state.couchMemberIds`

**What goes wrong:** `showSpinResult` doesn't currently reference `couchMemberIds`. If the explanation call uses only `state.selectedMembers`, it may not match the actual couch composition for families using the V5 roster.

**Why it happens:** `state.selectedMembers` is kept in sync with `state.couchMemberIds` via `state.selectedMembers = state.couchMemberIds.slice()` (line 4466 verified), but the fallback chain is needed for robustness.

**How to avoid:** Use `state.couchMemberIds || state.selectedMembers || []` consistently in all three integration sites.

### Pitfall 5: Runtime phrase when runtime is 0 or very small

**What goes wrong:** `t.runtime` could theoretically be 0 (bad TMDB data) or a value like 5 mins. D-05 says skip if `t.runtime` is `null`, but doesn't address 0.

**How to avoid:** Guard: `if (t.runtime != null && t.runtime > 0)`. A 0-minute runtime is bad data and should be treated as null.

---

## Code Examples

### How `t.votes` encodes yes-voters (verified)

```javascript
// Source: js/app.js:5153-5162 (matches computation inside renderTonight)
const matches = state.titles.filter(t => {
  if (!passesBaseFilter(t)) return false;
  const votes = t.votes || {};
  for (const mid in votes) {
    if (votes[mid] === 'yes' && !couchSet.has(mid)) return false;
  }
  return state.selectedMembers.some(mid => votes[mid] === 'yes');
});
```

`t.votes` is keyed by member id, value is `'yes'` | `'no'` | `'seen'`. Missing key = abstain.

### How provider intersection currently works (verified)

```javascript
// Source: js/app.js:4869-4891 (titleMatchesProviders)
const activeServices = new Set();
state.members.forEach(m => {
  if (Array.isArray(m.services)) m.services.forEach(s => activeServices.add(s));
});
const subBrands = new Set((t.providers || []).map(p => normalizeProviderName(p.name)));
for (const svc of activeServices) {
  if (subBrands.has(svc)) return true;
}
```

D-04 narrows this: only couch members' services (not all family members). Iterate `couchMemberIds` instead of `state.members`.

### Phase 19 `getEffectiveTierCap` — model for buildMatchExplanation placement (verified)

```javascript
// Source: js/app.js:93-99
// === Phase 19 / D-09 — single source of truth for kid-mode tier ceiling ===
function getEffectiveTierCap() {
  return state.kidMode ? 2 : null;
}
```

`buildMatchExplanation` should be defined immediately below this, with the same comment-header style.

### Detail modal italic serif — Phase 18 precedent (verified)

```javascript
// Source: js/app.js:7641 (renderDetailShell — Phase 18 "Provider data via TMDB" attribution)
const providerAttribution = `<div class="detail-prov-attribution" style="margin-top:var(--s1);font-size:var(--t-micro);font-style:italic;opacity:0.6;">Provider data via TMDB</div>`;
```

Phase 20's detail modal section uses the same italic serif register but with semantic HTML (`h4` + `p`) rather than inline opacity, matching the `detail-section` pattern convention.

---

## Smoke Contract Design

**File:** `scripts/smoke-decision-explanation.cjs`
**Model:** `smoke-kid-mode.cjs` (self-contained, no cross-repo require, inline logic mirror)
**Target assertions:** 12-15

### Recommended assertion set (maps to D-02..D-06 + D-10)

| # | Test Case | Asserts |
|---|-----------|---------|
| A1 | Empty couch array | Returns `''` |
| A2 | Null title | Returns `''` |
| A3 | 1 yes-voter, no providers, no runtime | `"Nahder said yes"` |
| A4 | 2 yes-voters, no providers, no runtime | `"Nahder + Zoey said yes"` |
| A5 | 3+ yes-voters, count < couch.length | `"2 of you said yes"` |
| A6 | All couch members yes-voted (count == couch.length, ≥3) | `"All of you said yes"` |
| A7 | Provider intersection: t.providers has Netflix, member has Netflix in services | `"Available on Netflix"` suffix |
| A8 | Provider no intersection: t.providers has Max, member has Netflix | `"Streaming on Max"` fallback |
| A9 | No providers at all | Provider phrase omitted |
| A10 | Runtime ≥ 60 min | `"2 hr 45 min"` |
| A11 | Runtime < 60 min | `"42 min"` |
| A12 | Runtime null | Runtime phrase omitted |
| A13 | All 3 phrases → returns all 3 joined with ` · ` | Full 3-phrase string |
| A14 | 3-phrase cap — runtime drop on overflow | 3 phrases max, runtime dropped |
| A15 | Considerable variant: 1 yes-voter + `considerableVariant: true` | `"Some of you said yes"` (not name) |

### Smoke require strategy

Inline the brand normalization map for the 2-3 brands used in assertions (Netflix, Max, Prime Video). Do NOT require `js/constants.js`. Mirror the `smoke-kid-mode.cjs` pattern of inlining `RATING_TIERS` + `tierFor`.

---

## Runtime State Inventory

**This is a pure-additive, greenfield phase within an existing codebase.** No renames, no refactors. Step 2.5 is SKIPPED.

No stored data requires migration. No live service config changes (single-repo, no queuenight changes per D-16). No OS-registered state. No secrets/env vars affected. No build artifacts invalidated (no compiled/installed code; sw.js CACHE bump is the only artifact update, handled by deploy.sh tag).

---

## Environment Availability

All dependencies are already in the deployed environment. No new installs required.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (for smoke) | `smoke-decision-explanation.cjs` | Yes | Already used by existing 4 smoke contracts | — |
| `js/constants.js` (`normalizeProviderName`) | Helper logic | Yes | Exists at `js/constants.js:41` | Inline brand map in smoke (CJS can't require ES modules) |
| `js/utils.js` (`escapeHtml`) | Safe name interpolation | Yes | Exists at `js/utils.js:3` | — |
| `state.members` | Name lookup at runtime | Yes | Always populated by Firestore subscriber | Graceful: show member ID if member not found |
| `state.couchMemberIds` | Couch composition | Yes | Set by couchInTonight listener | Fallback: `state.selectedMembers \|\| []` |

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node.js plain (no test runner) — matches existing smoke contracts |
| Config file | None — `'use strict'` + `check()` harness inline |
| Quick run command | `node scripts/smoke-decision-explanation.cjs` |
| Full suite command | `npm run smoke` (chains all 5 smoke contracts) |

### Phase Requirements → Test Map

Phase 20 is NEW-REQ territory. Suggested REQ-20-XX traceability rows (planner owns final wording):

| REQ-ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| REQ-20-01 | `buildMatchExplanation` is a pure function at module top of js/app.js — no state mutation, returns string | unit | `node scripts/smoke-decision-explanation.cjs` (A1-A15) | ❌ Wave 0 |
| REQ-20-02 | Voter phrase generation covers 1/2/3+ cases per D-03 | unit | smoke A3-A6 | ❌ Wave 0 |
| REQ-20-03 | Provider phrase uses couch-service intersection + fallback per D-04 | unit | smoke A7-A9 | ❌ Wave 0 |
| REQ-20-04 | Runtime phrase formats ≥60min correctly; skips null per D-05 | unit | smoke A10-A12 | ❌ Wave 0 |
| REQ-20-05 | Phrase cap ≤ 3 with voters > provider > runtime priority (D-06) | unit | smoke A13-A14 | ❌ Wave 0 |
| REQ-20-06 | Considerable variant uses `"Some of you said yes"` for 1-of-N (D-10) | unit | smoke A15 | ❌ Wave 0 |
| REQ-20-07 | Spin-pick result modal shows explanation as italic serif sub-line (D-07) | smoke (DOM) | `node --check js/app.js` + manual UAT | ❌ Wave 0 |
| REQ-20-08 | Tonight matches card shows explanation dim footer (D-08); considerable uses variant | smoke (DOM) | Manual UAT | ❌ Wave 0 |
| REQ-20-09 | Detail modal "Why this is in your matches" section visible in matches, absent elsewhere (D-09) | smoke (DOM) | Manual UAT | ❌ Wave 0 |
| REQ-20-10 | sw.js CACHE = `couch-v36.2-decision-explanation` (D-17) | smoke (curl) | `curl -s https://couchtonight.app/sw.js \| grep CACHE` | ❌ Wave 0 |
| REQ-20-11 | `npm run smoke` passes all 5 contracts including new decision-explanation contract (D-17-implied) | integration | `npm run smoke` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `node scripts/smoke-decision-explanation.cjs`
- **Per wave merge:** `npm run smoke` (all 5 contracts)
- **Phase gate:** Full suite green + `node --check js/app.js` before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `scripts/smoke-decision-explanation.cjs` — covers REQ-20-01 through REQ-20-06
- [ ] `scripts/deploy.sh` — 5th if-block in §2.5 and updated echo line
- [ ] `package.json` — `smoke:decision-explanation` entry + extended `smoke` chain

---

## Security Domain

Phase 20 is purely additive read-only display text. No new data entry, no new Firestore paths, no new auth surfaces.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | — |
| V3 Session Management | No | — |
| V4 Access Control | No | — |
| V5 Input Validation | Minimal | `escapeHtml()` from utils.js for member names interpolated into HTML (already standard) |
| V6 Cryptography | No | — |

**Known threat pattern:** Member names are user-supplied strings. The voter phrase interpolates them directly into innerHTML. `escapeHtml()` is mandatory and already established practice in this codebase (verified: js/app.js:5422, 5439, etc.).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `spin-reason` div showing `"✨ A couch favorite"` (generic affinity text) | Phase 20 replaces/supplements with real voter + provider + runtime data | Phase 20 | Users see actual reasons, not synthetic text |
| No explanation on match cards | Phase 20 adds dim footer line | Phase 20 | "Reduces distrust" per Codex pitch |
| Detail modal shows provider info only in "Where to watch" section | Phase 20 adds a dedicated "Why this is in your matches" section | Phase 20 | Surfaces the social layer (who voted) alongside the availability layer |

**Deprecated/outdated:**
- The `pick.reason` field (currently populated by `scoreTitle()` scoring): The existing `.spin-reason` div shows `pick.reason || 'A couch favorite'`. Phase 20's explanation is independent of `pick.reason` — it adds a separate sub-line. The `.spin-reason` line can remain unchanged unless D-07 explicitly replaces it (CONTEXT.md says "below the picked title's name" which is already where spin-result-meta sits — not clearly the same position as the existing spin-reason). Recommend keeping `.spin-reason` as-is and adding `buildMatchExplanation` output as a separate sibling div between meta and providers.

---

## Open Questions

1. **D-10 considerable variant scope: cards only, or detail modal too?**
   - What we know: D-10 says "Same explanation but voters phrase reads `'Some of you said yes'` for the 1-of-N case." It specifies "list surface" but doesn't mention the detail modal.
   - What's unclear: If a user opens the detail modal for a considerable (not a match) title, should the "Why this is in your matches" section use the considerable variant phrase, or be omitted entirely?
   - Recommendation: Omit the detail modal section for considerable titles (D-09 says section only renders when `t.id is currently in matches list`). The considerable variant is only for card footers.

2. **Does `buildMatchExplanation` receive the full title doc `t` or just selected fields?**
   - What we know: CONTEXT.md D-01 says `buildMatchExplanation(title, couchMemberIds)` — first param is `title` not `t`.
   - What's unclear: Whether `title` is the full title doc or a projection.
   - Recommendation: Accept the full title doc `t` (call it `t` internally). All call sites in app.js have the full title object available. Smoke tests construct minimal title objects with only the needed fields.

3. **Should the explanation appear on the considerable section header too?**
   - What we know: D-08 says match cards get the footer. D-10 says considerable cards get a variant. The considerable section header currently reads "At least one of you picked these — couch isn't unanimous."
   - What's unclear: Whether the per-card considerable footer is redundant given the section-level copy already sets context.
   - Recommendation: Add per-card footer on considerable cards per D-10. The section header is generic context; the per-card explanation adds specific detail (who voted, which service, runtime) that has real signal.

4. **`pick.reason` vs `buildMatchExplanation` in spin modal — which is primary?**
   - What we know: Current `.spin-reason` div shows `"✨ A couch favorite"` from `pick.reason`. D-07 adds an explanation sub-line. CONTEXT.md says "below the picked title's name."
   - What's unclear: Whether the explanation replaces `.spin-reason` or sits alongside it.
   - Recommendation: Keep `.spin-reason` (it has celebration ✨ and scoring context) and add the explanation as a separate dim italic line between `.spin-result-meta` and `.spin-result-providers`. The two serve different registers: `.spin-reason` = celebratory/affinity; explanation = factual summary.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `state.couchMemberIds` is the correct source of couch composition in all 3 integration sites | Surface Integration Map | Low — fallback chain `couchMemberIds \|\| selectedMembers \|\| []` is defensive; verified at js/app.js:5105 |
| A2 | `normalizeProviderName` in the smoke should be inlined (not required from constants.js) | Smoke Contract Design | Low — the alternative (module.exports tail-shim) would work but modifies a shared file |
| A3 | Detail modal "Why this is in your matches" should only fire for matches (not considerable) | Open Questions #1 | Medium — D-09 wording supports this but D-10 creates ambiguity |
| A4 | `.spin-reason` line should be preserved and the explanation added as a sibling | Open Questions #4 | Low — additive approach; `.spin-reason` can be removed in follow-up if desired |

---

## Sources

### Primary (HIGH confidence)

- `js/app.js` — verified via Grep + offset/limit reads at specific line numbers listed throughout. Functions confirmed: `getEffectiveTierCap` (line 97), `renderDetailShell` (line 7605), `showSpinResult` (line 8033), `function card(t)` (line 5297), `renderTonight` (line 5062), `passesBaseFilter` (line 5116), `titleMatchesProviders` (line 4869)
- `js/constants.js:41` — `normalizeProviderName` export confirmed
- `js/utils.js:3` — `escapeHtml` export confirmed
- `css/app.css` — `.spin-reason` (line 1612), `.spin-result-name` (line 1604), `--ink-dim` (line 41), `.kid-mode-override-link` (line 3675), `--font-serif` (line 177) all verified
- `scripts/smoke-kid-mode.cjs` — read in full; confirms self-contained inline-logic pattern
- `scripts/smoke-availability.cjs` — read in full; confirms cross-repo-require + graceful-skip pattern (NOT the model for Phase 20)
- `scripts/smoke-tonight-matches.cjs` — read in full; confirms inline filter mirror pattern
- `scripts/deploy.sh` — §2.5 verified (lines 83-105); 4 existing smoke if-blocks documented
- `package.json` — verified smoke script chain

### Secondary (MEDIUM confidence)

- `CLAUDE.md` — project conventions (token-cost rules, design system, deployment pattern) read in full
- `.planning/CONTEXT.md Phase 20` — D-01 through D-17 + Claude's Discretion + Deferred, read in full
- `.planning/ROADMAP.md Phase 20` — success criteria verified at lines 369-390

### Tertiary (LOW confidence — none)

All claims are verified against live source code. No unverified WebSearch findings used.

---

## Metadata

**Confidence breakdown:**
- Helper signature and logic: HIGH — all data shapes verified in live source
- Integration sites (exact lines): HIGH — verified via Grep + Read
- Smoke contract pattern: HIGH — 3 prior contracts read in full
- CSS styling pattern: HIGH — design tokens and class patterns verified
- Open questions: MEDIUM — require planner to resolve before Wave 1

**Research date:** 2026-04-29
**Valid until:** 2026-06-01 (stable codebase; only invalidated if js/app.js integration sites shift dramatically)
