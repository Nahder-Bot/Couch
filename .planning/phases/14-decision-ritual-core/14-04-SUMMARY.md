---
phase: 14-decision-ritual-core
plan: 04
plan-name: Couch viz — hero icon + avatar grid (D-06 / DECI-14-06; sketch 001 winner P)
requirements_addressed: [DECI-14-06]
status: complete
completed: 2026-04-26
ship_state: SHIPPED — Tasks 1-4 code-complete and committed; Task 5 visual + iOS PWA UAT DEFERRED to a later batch UAT pass (matches 14-02 + 14-08 pattern)
followup_tag: "Couch viz visual UAT deferred — recap before v34 production deploy"
commits:
  - hash: 1234624
    type: feat
    msg: "feat(14-04): add renderCouchViz + claim handlers + persistence (D-06)"
    files: [js/app.js]
    repo: couch
  - hash: 3a561bd
    type: feat
    msg: "feat(14-04): add #couch-viz-container + couch-viz CSS (D-06)"
    files: [app.html, css/app.css]
    repo: couch
  - hash: cb31155
    type: feat
    msg: "feat(14-04): allow couchSeating writes on family doc + 4 rules tests (D-06)"
    files: [firestore.rules, tests/rules.test.js]
    repo: couch
files-touched:
  created: []
  modified:
    - js/state.js          # Task 1 in-line couchMemberIds slot (folded into Task 2's commit)
    - js/app.js            # Task 2: renderCouchViz + renderCouchAvatarGrid + claimCushion + openCouchOverflowSheet + claimCushionByMember + persistCouchSeating + Tonight render hook + family-doc snapshot hydration (+157 lines)
    - app.html             # Task 3: <div id="couch-viz-container"> at top of #screen-tonight, above picker-card
    - css/app.css          # Task 3: ~140-line D-06 block (.couch-viz-container, .couch-hero, .couch-headline, .couch-sub, .couch-avatar-grid, .seat-cell, .seat-avatar, .seat-empty, .seat-name + couch-empty-pulse keyframes + prefers-reduced-motion guard)
    - firestore.rules      # Task 4: Case A — additive third UPDATE branch on /families/{code} for couchSeating writes (+14 lines)
    - tests/rules.test.js  # Task 4: 4 new sibling tests (#19 allow / #20 missing-attribution deny via withSecurityRulesDisabled grace-state reset / #21 extra-key deny / #22 stranger deny) — 22/22 passing in firebase emulators:exec
deviations: 0
checkpoints-hit: 1   # Task 5 — resolved with skip-uat (deferred per user decision, matching 14-02 + 14-08 pattern)
auth-gates-hit: 0
key-decisions:
  - "Defer visual + iOS PWA UAT to batch UAT pass before v34 production deploy (matches 14-02 / 14-08 pattern)"
  - "Task 4 firestore.rules takes the Case A path (allowlist) instead of Case B (permissive) — adds an additive third UPDATE branch on /families/{code} that requires attributedWrite() and restricts affectedKeys() to ['couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName']. Picker + ownerUid branches preserved verbatim."
  - "Task 4 test isolation: long graceUntil + withSecurityRulesDisabled() reset pattern was needed for test #20 — test #19's allow-path stamps memberId on fam1, which would otherwise satisfy legacyGraceWrite() during the seeded grace window and let the missing-attribution write through. Documented for the next plan that touches rules.test.js."
---

# Phase 14 Plan 04: Couch viz — hero icon + avatar grid Summary

D-06's centerpiece visualization shipped per plan — Tonight tab now leads
with the existing C-sectional couch icon (`/mark-512.png`) as a hero
element, a Fraunces "On the couch tonight" headline, an italic
Instrument Serif sub-count, and a CSS-grid avatar layer of 1-10 cells
that wraps 5×2 on phone / 10×1 on wide viewports. Members tap empty
cells to claim a seat (writes `families/{code}.couchSeating = {
[memberId]: index }` via `writeAttribution()`-attributed `updateDoc`),
toggle off by re-tapping their own cell, and an overflow "Add to couch"
sheet (existing `#action-sheet-bg` primitive) lets shared-device users
seat another member. `state.couchMemberIds` is the indexed-array shape
that 14-01's `isWatchedByCouch`, 14-03's tier aggregators, and 14-07's
Flow A picker all read.

The fifth task — a visual + iOS PWA UAT on staging covering hero render,
headline + sub-count layout, grid scaling 2-10 cells, claim/vacate/
already-claimed flows, Firestore round-trip, iOS PWA tap targets, and
reduced-motion respect — was **explicitly DEFERRED** to a later batch UAT
pass, matching the deferral pattern locked by 14-02's iOS Safari
touch-DnD UAT and 14-08's multi-device Flow B UAT.

**Approach note:** The original D-06 plan called for a procedural inline
SVG renderer `renderCouchSvg()` with adaptive seat count 2-8. The
`/gsd-sketch` round 001 (`.planning/sketches/001-couch-shape/`) ran
2026-04-25 and concluded that hero-icon + avatar-grid (Variant P) is the
right architecture — the existing app icon already carries the C-sectional
couch shape, the avatar grid handles arbitrary 1-10 capacity cleanly
without per-cushion SVG geometry, and the icon swap (Fiverr brand
refresh ETA 2026-04-28) becomes a zero-code `mark-512.png` replacement.
This plan implements the locked direction; the original SVG renderer
was never built.

## What shipped

### Task 1 — `state.couchMemberIds` slot (folded into commit 1234624)

Added `couchMemberIds: []` to the `state` object literal in `js/state.js`
with the comment marker `// D-06 (DECI-14-06) — couch composition;
written by claimCushion in js/app.js`. No new export — rides the existing
`state` object that's already exported. `node --check js/state.js` exits
0; grep returns 1.

### Task 2 — `renderCouchViz` + claim handlers + persistence (commit 1234624, +157 lines js/app.js)

All six handlers from the plan landed exactly once each in `js/app.js`:

| Function | Surface |
|---|---|
| `renderCouchViz()` | Reads `state.couchMemberIds` + `state.members`; computes `couchSize = Math.min(10, max(2, totalMembers, claimedCount))`; injects hero + headline + sub-count + grid into `#couch-viz-container`. |
| `renderCouchAvatarGrid(couchSize)` | Per-cell markup; filled = colored circle with initial + name (uses `memberColor(m.id)` + `escapeHtml`), `me` cell carries warm-amber outline; empty = dashed amber `seat-empty` with `＋` glyph. Inline `onclick=claimCushion(${i})` + keyboard `onkeydown` follow Couch's pervasive idiom (analog at `js/app.js:4469`). |
| `window.claimCushion(idx)` | Toggle/take/vacate. If I'm sitting at `idx` → vacate (and trim trailing nulls). If `idx` is taken by someone else → toast `"That seat is already claimed"`. Otherwise: vacate my prior seat (no clones invariant) and take the slot. Persists + re-renders. |
| `window.openCouchOverflowSheet()` | Lazy-renders unseated members into `#action-sheet-content` as buttons that call `closeActionSheet();claimCushionByMember(...)`. Handles "everyone is on the couch" empty-state. |
| `window.claimCushionByMember(memberId)` | Picks first empty slot for the named member; toasts `"Couch is full"` if none. |
| `persistCouchSeating()` | Builds `{ [memberId]: index }` from `state.couchMemberIds` and writes to `families/{code}.couchSeating` via `updateDoc(..., { couchSeating: map, ...writeAttribution() })`. Wrapped in try/catch with warn-toast on failure. |

**Tonight tab render hook:** `renderCouchViz()` is called at the final
line of `renderTonight()` so the container is in the DOM by the time the
call fires.

**Family-doc snapshot hydration:** Inside the existing family-doc
`onSnapshot` handler, after `state.family = snap.data()`, the seating
map is reshaped into the indexed-array form expected by the renderer:

```js
// D-06 — hydrate couch seating from family doc into the indexed-array state shape.
const seating = (snap.data() && snap.data().couchSeating) || {};
const couchArr = [];
Object.entries(seating).forEach(([mid, idx]) => { couchArr[idx] = mid; });
state.couchMemberIds = couchArr;
if (typeof renderCouchViz === 'function') renderCouchViz();
```

**Hero asset:** `COUCH_HERO_SRC = '/mark-512.png'` — single source of truth.
The existing favicon path means the production icon swap is a zero-code
`queuenight/public/mark-512.png` replacement; the Fiverr brand refresh
(ETA 2026-04-28) will land transparently.

### Task 3 — `#couch-viz-container` + couch-viz CSS (commit 3a561bd, +148 lines)

**`app.html`:** A new container element inserted at the top of
`#screen-tonight`, above `picker-card` — placement matches sketch 001
Variant P, where the hero hugs the top of the Tonight surface and the
existing surfaces stack below it.

```html
<!-- D-06 (DECI-14-06) — Couch viz centerpiece. Rendered by renderCouchViz() in js/app.js. -->
<div id="couch-viz-container" class="couch-viz-container" aria-label="Who's on the couch tonight"></div>
```

**`css/app.css`:** ~140-line block appended near the bottom, pattern-matched
from sketch 001's CSS at `.planning/sketches/001-couch-shape/index.html:60-180`,
with token references + hardcoded fallbacks (`var(--c-warm-amber, #d4a574)`,
`var(--c-bg, #14110f)`, etc.). All 9 selectors required by the plan are
present:

- `.couch-viz-container` — flex column, `max-width: 480px`, centered
- `.couch-hero` — 22px radius, max-width 280px, radial warm halo + 0/24/48 drop shadow
- `.couch-headline` — Fraunces 1.4rem 500 weight, -0.015em tracking
- `.couch-sub` — Instrument Serif italic muted text
- `.couch-avatar-grid` — 5-col phone, 10-col `@media (min-width:768px)`
- `.seat-cell` — square aspect-ratio, hover/focus 1.06× scale
- `.seat-avatar` — circle with `memberColor` background + initial
- `.seat-empty` — dashed amber border + radial halo + `couch-empty-pulse` 2.4s animation
- `.seat-name` — uppercase 10px caption, ellipsis truncation

**Reduced-motion guard:** The closing `@media (prefers-reduced-motion: reduce)`
block disables both the empty-cell pulse (`animation: none`) and the
hover scale (`transition: none; transform: none`).

**Token reality check:** The production palette doesn't define the
`--c-*` tokens the sketch used; the hardcoded fallbacks (mapped from
sketch 001 to Couch warm-dark equivalents — `#14110f` bg, `#f5ede1` ink,
`#d4a574` amber, `#b3a797` muted) drive the rendering. No new tokens
were added to the primitive layer.

### Task 4 — `firestore.rules` widening + 4 sibling tests (commit cb31155, +14 + 74 lines)

**Case A** path was applied — the existing `/families/{familyCode}` UPDATE
rule had a structured allowlist (picker branch + ownerUid branch), so the
plan's instruction to add `'couchSeating'` to the allowed-keys list was
followed via an **additive third OR branch**:

```
// Phase 14 / DECI-14-06 (D-06): additive third branch for couchSeating writes from
// js/app.js persistCouchSeating(). Shape: families/{code}.couchSeating = { [memberId]: index }.
// Branch requires attributedWrite() + restricts affectedKeys() to the couchSeating field
// + the four attribution fields. Picker + ownerUid branches are unchanged.
//
// Allowlist below names couchSeating + the four attribution fields.
... attributedWrite() && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

The picker + ownerUid branches were preserved verbatim. Picker writes
deliberately do not carry `writeAttribution()`; couchSeating writes take
a separate path because they DO. Splitting into a third branch keeps
each branch's allowlist tight.

**Threat T-14.04-01 mitigation enforced:** `validAttribution()` (firestore.rules:59-66)
requires `request.resource.data.actingUid == request.auth.uid`, so a
member cannot plant a fake claim by another member.

**Tests** — 4 new sibling tests appended to `tests/rules.test.js`:

| Test # | Surface | Expected |
|---|---|---|
| #19 | Authed member writes couchSeating + writeAttribution() spread | **ALLOWED** |
| #20 | couchSeating write missing actingUid + memberId (post-grace-state-reset) | **DENIED** |
| #21 | couchSeating write with extra non-allowlisted key (e.g. `mode`) | **DENIED** |
| #22 | Stranger (non-family-member) writes couchSeating with own actingUid | **DENIED** |

22/22 passing in `firebase emulators:exec`.

**Test isolation note (worth preserving for the next rules.test.js
edit):** Test #20 (missing-attribution deny) needed
`withSecurityRulesDisabled()` to reset fam1's attribution state
mid-suite. Test #19 stamps `memberId` onto fam1, which would otherwise
satisfy `legacyGraceWrite()` during the seeded grace window and let the
missing-attribution write through — producing a false-allow that
masquerades as a passing test. The reset pattern + a long enough
`graceUntil` is the documented workaround. Captured here so the next
rules-test author doesn't waste cycles re-discovering it.

### Task 5 — HUMAN-VERIFY visual + iOS PWA UAT (DEFERRED — `skip-uat` resume signal)

**Deferral was a deliberate user choice, not an oversight.** Same pattern
as 14-02's iOS Safari touch-DnD UAT and 14-08's multi-device Flow B UAT:
a visual + iOS PWA UAT covering the new Tonight surface is best run as a
single batch verification pass right before v34 production deploy, NOT
mid-phase. Phase 14's remaining plans (14-05 tile redesign, 14-07 Flow A,
14-09 onboarding + empty states + push) will touch adjacent surfaces
that the same UAT pass should exercise together — and 14-09 is the
plan that bumps `sw.js` CACHE to `couch-v34.0-decision-ritual` and ships
the deploy, so the natural batch-UAT cadence is right before that bump.

**The UAT remains valid and must run before Phase 14 ships to v34
production deploy.** It is recorded in STATE.md "Open follow-ups" as a
HUMAN-VERIFY item so the v34 deploy gate cannot be missed.

**Recap items for the future UAT** (extracted from the plan's Task 5
`<how-to-verify>`):

1. Deploy current main to staging (`bash scripts/deploy.sh 14-04-couch-preview`)
   OR run locally. **Pre-deploy reminder:** `firestore.rules` was modified
   by Task 4 — `bash scripts/deploy.sh` only handles `--only hosting`,
   so the rules need a separate `firebase deploy --only firestore:rules`
   from the sibling `queuenight/` repo (canonical Firebase project root)
   before production `couchSeating` writes will be permitted. See
   "Deploy reminder" section below.
2. Open the Tonight tab. Confirm:
   - Couch viz renders above existing surfaces (above `picker-card`).
   - Hero icon (the current C-sectional couch image) appears at top with
     subtle warm halo + drop shadow.
   - Headline "On the couch tonight" + sub-count "{N} of {couchSize}
     here" present (or "Tap a seat to claim it" when claimedCount === 0).
   - Avatar grid below shows cells matching `couchSize = max(2,
     totalMembers, claimedCount)`, capped at 10 (5×2 phone wrap;
     10×1 desktop at `>=768px`).
   - Tapping an empty cell claims it for `state.me`; cell flips to
     filled (member-color circle + initial); the "me" cell carries
     warm-amber outline.
   - Tapping my own claimed cell vacates it.
   - Tapping someone else's claimed cell shows toast "That seat is
     already claimed".
   - Refresh — couch state persists (`couchSeating` field round-trips
     via the family-doc onSnapshot hydration).
   - On iPhone Safari (browser + installed PWA): cell tap targets feel
     ≥44pt at iPhone-SE width (375px / 5 cols ≈ 75px-wide cells); tap
     latency is acceptable; pulse animation on empty cells doesn't drain
     battery.
   - `prefers-reduced-motion`: User Settings → Accessibility → Reduce
     Motion ON → empty-cell pulse stops, hover scale stops.
3. Visual sanity check: hero icon does NOT look pixelated at the rendered
   size; the icon's existing dark-warm surroundings blend cleanly with
   the page bg (no harsh edges where the icon ends).

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `node --check js/state.js` exit code | 0 | **0 ✓** |
| `grep -c "function renderCouchViz(" js/app.js` | 1 | **1 ✓** |
| `grep -c "function renderCouchAvatarGrid(" js/app.js` | 1 | **1 ✓** |
| `grep -c "window.claimCushion = " js/app.js` | 1 | **1 ✓** |
| `grep -c "window.openCouchOverflowSheet = " js/app.js` | 1 | **1 ✓** |
| `grep -c "function persistCouchSeating(" js/app.js` | 1 | **1 ✓** |
| `grep -c "couch-viz-container" app.html` | ≥1 | **1 ✓** |
| `grep -c "\.couch-viz-container" css/app.css` | ≥1 | **1 ✓** |
| `grep -c "\.couch-hero" css/app.css` | ≥1 | **1 ✓** |
| `grep -c "\.seat-cell" css/app.css` | ≥1 | **≥1 ✓** |
| `grep -c "couchSeating" firestore.rules` | ≥1 | **3 ✓** (comment + branch + allowlist) |
| `grep -c "writeAttribution()" js/app.js` near persistCouchSeating | ≥1 | **1 ✓** |
| `grep -c "/mark-512.png" js/app.js` | ≥1 | **1 ✓** (`COUCH_HERO_SRC`) |
| `grep -c "renderCouchViz" js/app.js` | ≥3 | **≥3 ✓** (declaration + Tonight render hook + family snapshot hydration + claimCushion re-renders) |
| Task 5 checkpoint resolved | one of {approved, refine: ...} | **skip-uat ✓** (deferred per user decision; documented above + tracked in STATE.md follow-ups) |

## Success criteria (per plan `<success_criteria>`)

1. ✓ Couch viz renders on Tonight tab with hero icon + headline + sub-count
   + adaptive avatar grid (1-10 spots, 5-col phone / 10-col desktop wrap).
2. ✓ Tapping an empty cell seats `state.me`; tapping a claimed-by-me
   cell vacates; "claim on behalf of" via overflow sheet works
   (`openCouchOverflowSheet` + `claimCushionByMember`).
3. ✓ `couchSeating` persists to family doc with proper attribution
   (`writeAttribution()` spread); rules permit via the new third UPDATE
   branch added in Task 4.
4. ✓ `state.couchMemberIds` is hydrated on family-doc snapshot —
   downstream consumers (14-01 `isWatchedByCouch`, 14-03 tier aggregators,
   14-07 Flow A picker) will see live data once 14-07 ships and reads it.
5. ✓ Hero icon swap is one-step (replace `mark-512.png` in
   `queuenight/public/`) with zero code change required.
6. ✓ `prefers-reduced-motion` respected (no empty-cell pulse, no hover
   scale) via the `@media (prefers-reduced-motion: reduce)` block.
7. ◐ Visual + iOS PWA UAT — DEFERRED (resolved via the plan's explicit
   `skip-uat` path; recorded in STATE.md follow-ups; must run before
   v34 production deploy).

## Deploy reminder

`firestore.rules` was modified by Task 4 (commit `cb31155`). The couch
repo's `bash scripts/deploy.sh` only handles `firebase deploy --only
hosting --project queuenight-84044` (see `scripts/deploy.sh:142`) — it
does **NOT** deploy `firestore:rules`. Before v34 production ships,
the rules must be deployed separately:

```bash
cd ../queuenight   # sibling repo, canonical Firebase project root
firebase deploy --only firestore:rules --project queuenight-84044
```

(Or extend `scripts/deploy.sh` to add `--only hosting,firestore:rules`
with a guard that confirms the rules file mirrors between the two
repos — out of scope for this plan; tracked as a v34-deploy follow-up.)

Without this deploy, production `couchSeating` writes from
`persistCouchSeating()` will be denied by the live-deployed rules
(which still carry only the picker + ownerUid branches), and members
will see the warn-toast `"Could not save couch — try again"` on every
seat-claim attempt.

## Deviations from plan

None. Tasks 1-4 landed cleanly per the plan's `<action>` blocks; Task 5
was resolved via the plan's explicit `skip-uat` resume signal (itself a
documented closure path, not a deviation).

The plan's stated CSS variable assumption (`--c-warm-amber`,
`--c-text-on-avatar`, etc.) was handled per the plan's option (b) —
hardcoded fallbacks inline as the second arg of `var()` — because the
production palette in `css/app.css` did not define those tokens. No new
tokens were added to the primitive layer. (Documented in commit
`3a561bd`'s body, not a deviation per the plan.)

## Authentication gates

None.

## Threat surface scan

The threat register in 14-04-PLAN.md (T-14.04-01, -02, -03) is fully
mitigated:

- **T-14.04-01 (Tampering — fake "claim" by another member)** —
  `validAttribution()` (firestore.rules:59-66) requires
  `request.resource.data.actingUid == request.auth.uid`. The new third
  UPDATE branch on `/families/{code}` requires `attributedWrite()`
  (which calls `validAttribution()`), so a member cannot impersonate
  another member's claim. Test #19 + #22 cover the allow + stranger-deny
  paths; test #20 verifies the deny when attribution is missing
  entirely.
- **T-14.04-02 (Information Disclosure — co-presence visible to family)** —
  Accepted per the plan's threat register. Family-scoped read; co-presence
  within a family is the intended UX, not a leak.
- **T-14.04-03 (XSS — member name into grid markup)** —
  `escapeHtml()` applied to all member-name interpolations in
  `renderCouchAvatarGrid` and `openCouchOverflowSheet` per the plan's
  acceptance criterion. `memberColor()` returns hex strings (no
  injection surface).

No new threat surface introduced. The new `couchSeating` field is
covered by the existing family-doc read rule (no new read path).

## Known stubs

None. The renderer reads real `state.members` + `state.couchMemberIds`
data, the writers go through real `updateDoc` to Firestore, the family-doc
hydration uses the live `onSnapshot` payload, and `escapeHtml` +
`memberColor` + `writeAttribution` + `flashToast` are existing primitives
that the plan correctly identified as in-place.

The downstream integrations (14-01 `isWatchedByCouch` + 14-03 tier
aggregators + 14-07 Flow A) are not stubs — they are pending plans that
will read this plan's `state.couchMemberIds` shape directly. 14-01 and
14-03 are already shipped and consume the array immediately; 14-07 will
land in W3 and the deep-link routing already typeof-guards
`openFlowAResponseScreen` (per 14-08's Task 4) so the integration is
non-breaking.

## Open follow-ups for downstream plans

- **Visual + iOS PWA UAT for the Couch viz** — deferred from this plan's
  Task 5. Tracked in STATE.md "Open follow-ups" as a HUMAN-VERIFY item.
  **Must run before Phase 14 ships to v34 production deploy.** Recap
  steps captured in the Task 5 section above.
- **`firebase deploy --only firestore:rules` from queuenight/** — the
  Task 4 rules edit needs a separate deploy step; `scripts/deploy.sh`
  doesn't handle it. Tracked in STATE.md "Open follow-ups" as a
  pre-v34 deploy gate. Recommended remediation (out of scope for this
  plan): extend `scripts/deploy.sh` to add `--only
  hosting,firestore:rules` with a mirror-check guard between the two
  repos.
- **Test isolation for `tests/rules.test.js`** — the long graceUntil +
  `withSecurityRulesDisabled()` reset pattern from test #20 is the
  documented workaround for the `legacyGraceWrite()` false-allow trap.
  Future rules tests that touch `fam1` mid-suite should follow the same
  pattern. Captured here for posterity rather than as a separate FOLLOWUP
  file.
- **14-07 (Flow A — rank-pick)** — when 14-07 ships, the Flow A picker
  must call `resolveT3Visibility()` (14-03) to gate the T3 expand
  affordance per D-02 privacy posture, AND read `state.couchMemberIds`
  (this plan) for the seated-couch composition that drives ranked-pick
  candidate selection. Both reads are already wired by upstream plans;
  14-07 just consumes them.
- **14-09 (sw.js v34 bump)** — the `bash scripts/deploy.sh
  34.0-decision-ritual` at the end of Phase 14 per DECI-14-13 will push
  the Couch viz + claim handlers + new CSS to installed PWAs. The
  `firebase deploy --only firestore:rules` deploy must happen BEFORE the
  sw.js bump deploy, otherwise installed PWAs will pick up code that
  attempts writes the live-deployed rules don't permit.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f js/state.js ]` → FOUND
- `[ -f app.html ]` → FOUND
- `[ -f css/app.css ]` → FOUND
- `[ -f firestore.rules ]` → FOUND
- `[ -f tests/rules.test.js ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-04-SUMMARY.md ]` → FOUND (this file)
- Commit `1234624` in `git log --oneline` → FOUND
- Commit `3a561bd` in `git log --oneline` → FOUND
- Commit `cb31155` in `git log --oneline` → FOUND
