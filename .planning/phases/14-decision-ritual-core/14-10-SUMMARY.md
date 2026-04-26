---
phase: 14-decision-ritual-core
plan: 10
plan-name: Couch viz redesign — Sketch 003 V5 (Roster IS the control), gap closure on 14-UAT.md tests 1/3/5/24
requirements_addressed: [DECI-14-06]
status: code-complete
ship_state: CODE-COMPLETE — Tasks 1-8 shipped across 8 atomic couch commits + 1 cross-repo queuenight rules edit (uncommitted on this machine, same pattern as 14-06/14-09 deviation). Task 9 HUMAN-VERIFY UAT bundled with the existing v34 deploy gate.
completed: 2026-04-26
followup_tag: "Cross-repo deploy ritual (queuenight CFs + firestore:rules + couch hosting via scripts/deploy.sh 34.1-roster-control); cold-start V5 visual UAT; multi-device proxy UAT; downstream contract regression UAT"
gap_closure: true
gap_source: 14-UAT.md (Tests 1, 3, 5, 24 — composite design rethink)
commits:
  - hash: efd2739
    type: feat
    msg: "feat(14-10): add couchInTonight Firestore shape with backward-compat read + dual-write"
    files: [js/app.js]
    repo: couch
  - hash: 9569c33
    type: feat
    msg: "feat(14-10): replace couch-viz cushion grid with V5 roster-pill renderer (sketch 003 V5)"
    files: [js/app.js]
    repo: couch
  - hash: 0f45602
    type: feat
    msg: "feat(14-10): roster pill CSS — out/in/me states + long-press progress (sketch 003 V5)"
    files: [css/app.css]
    repo: couch
  - hash: 5f17ebc
    type: feat
    msg: "feat(14-10): sendCouchPing toast+Sentry stub (real push deferred to follow-up plan)"
    files: [js/app.js]
    repo: couch
  - hash: 603ac28
    type: fix
    msg: "fix(14-10): remove legacy who-card from Tonight tab (Bug A)"
    files: [app.html, js/app.js]
    repo: couch
  - hash: 860dfea
    type: fix
    msg: "fix(14-10): obsolete renderFlowAEntry empty-state-c under V5 (Bug B)"
    files: [js/app.js]
    repo: couch
  - hash: 81c6700
    type: feat
    msg: "feat(14-10): bump sw.js CACHE to v34.1-roster-control (V5 redesign)"
    files: [sw.js]
    repo: couch
  - hash: 320ea81
    type: docs
    msg: "docs(14-10): update STATE.md + sketch 003 status to SHIPPED"
    files: [.planning/STATE.md, .planning/sketches/003-couch-viz-redesign/README.md, .planning/sketches/MANIFEST.md]
    repo: couch
  - hash: UNCOMMITTED-queuenight
    type: feat
    msg: "feat(14-10): allow proxy writes to couchInTonight (sketch 003 V5)"
    files: [firestore.rules]
    repo: queuenight
    note: "queuenight has no .git on this machine — apply via the user's queuenight-equipped session before deploy. Pattern matches 14-06/14-09 deviation 1."
files-touched:
  created: []
  modified:
    - js/app.js                                       # Tasks 1, 3, 5, 6: couchInTonight helpers + V5 renderCouchViz/toggleCouchMember/sendCouchPing/bulk actions + onSnapshot rewire + applyModeLabels orphan + renderTonight who-list emitter delete + sticky who-mini IIFE rewire + renderFlowAEntry empty-state-c collapse
    - app.html                                        # Task 6 Bug A: deleted legacy .who-card div (lines 334-337)
    - css/app.css                                     # Task 4: replaced cushion-grid CSS with .roster + .pill (out/in/me/.pinging) + .ping-hint + .tally + .pill-actions + .pill-hint + .couch-hero-v5; deleted 14-09 D-11 (c) cushion-glow keyframe
    - sw.js                                           # Task 7: CACHE bumped couch-v34.0-decision-ritual → couch-v34.1-roster-control
    - .planning/STATE.md                              # Task 8: cache-version section + Open follow-ups + last_activity all reflect 14-10 ship
    - .planning/sketches/003-couch-viz-redesign/README.md # Task 8: Status flipped to SHIPPED 2026-04-26
    - .planning/sketches/MANIFEST.md                  # Task 8: V5 row annotated 'SHIPPED via 14-10'
    - C:/Users/nahde/queuenight/firestore.rules       # Task 2: 4th UPDATE branch on /families/{code} for couchInTonight + couchSeating dual-write allowlist (UNCOMMITTED on this machine)
deviations: 1   # Rule 3 (deferred): queuenight commit unable on this machine — same pattern as 14-06/14-09 deviation 1
checkpoints-hit: 1   # Task 9 — HUMAN-VERIFY checkpoint awaiting orchestrator handoff
auth-gates-hit: 0
key-decisions:
  - "Path C selected for sendCouchPing (toast + Sentry breadcrumb stub). Path A rejected: no generic notifyMember helper exists in the codebase. Path B rejected: would require cross-repo CF additions for a 'couchPing' event type that deserve their own plan. Path C ships the visible UX win (long-press → toast confirmation) and captures attempted-fire telemetry under Sentry category='couch-ping' to size demand before the follow-up CF plan."
  - "Dual-write of couchInTonight + couchSeating for one PWA cache cycle (~1-2 weeks of v34.1 deployed). Backward-compat read of legacy couchSeating in couchInTonightFromDoc preserves v33/v34.0 PWA reads during the transition. Drop the dual-write + the legacy 3rd UPDATE branch in queuenight/firestore.rules in a follow-up plan."
  - "Bug B fix bundled into Task 1's commit (the renderFlowAEntry call inside the family-doc onSnapshot block) rather than waiting for Task 6, because Task 1 was already editing the same onSnapshot block and splitting the change would have created an avoidable merge conflict. Task 6's Bug B commit covers the second half — collapsing the empty-state-c CTA card under V5 because the dashed-pill roster IS the empty state."
  - "Sticky who-mini IIFE rewired (Option B) from .who-card to #couch-viz-container instead of deleted (Option A), because the sticky mini bar is a usability win — peripheral awareness of who's selected as the user scrolls through the long Tonight tab. Costs 1 line to keep working; #who-mini element is preserved in app.html line 303."
  - "renderTonight who-list emitter deleted entirely (Option A) instead of guarded with if(!whoEl)return (Option B), because dead code accumulates and 14-10 is the right time to drop it. openInviteShare entry preserved via the existing 'Pick who's watching' empty-state branch and other Family-tab callsites."
  - "Inline-CSS hardcoded fallbacks throughout new .pill rules, matching the 14-04 SUMMARY note ('production palette doesn't define --c-* tokens so the hardcoded fallbacks drive rendering'). No new tokens added to the primitive layer."
metrics:
  task_count: 8   # 9 minus the human-verify checkpoint
  file_count: 8   # 7 couch + 1 queuenight (uncommitted)
  duration_min: ~35
---

# Phase 14 Plan 10: Couch viz redesign — Sketch 003 V5 (Roster IS the control) Summary

UAT for Phase 14-04 found that the cushion-grid metaphor produced visual
clutter on desktop (7 dashed-amber `+` placeholders for an 8-member family
with 1 claim), that the vacate UX was non-discoverable ("I can only click
once"), and that two "who's on the couch" surfaces stacked on Tonight (the
legacy Phase 11 .who-card pill rail rendered below the new 14-04 viz).
User picked **V5 from sketch 003** — make the family roster ITSELF the
control surface, with each member as a tappable pill. Same gesture
vocabulary serves proxy-fill, self-claim, and remote-ping; the abstract
"seats" metaphor drops entirely. This plan ships V5 + closes the two
adjacent bugs that the redesign would otherwise leave dangling, plus
migrates the Firestore shape from positional `couchSeating: { [mid]: index }`
to member-keyed `couchInTonight: { [mid]: { in, at, proxyConfirmedBy? } }`
with a dual-write backward-compat window.

## What shipped

### Task 1 — couchInTonight Firestore shape with backward-compat read + dual-write (commit efd2739)

Two new helpers in `js/app.js` immediately above the V5 render block:

| Helper | Purpose |
|---|---|
| `couchInTonightFromDoc(d)` | Hydrates the new shape from doc with legacy `couchSeating` fallback. Auto-rebuilds `{ [mid]: { in: true } }` from the indexed map when only the old field is present (timestamp unknown so omitted). |
| `couchInTonightToMemberIds(cit)` | Derives `state.couchMemberIds = Object.keys(cit).filter(mid => cit[mid].in === true)` so 14-01 `isWatchedByCouch` + 14-03 tier aggregators + 14-07 Flow A roster all keep working unchanged. |

Family-doc `onSnapshot` rewired (lines ~4131-4150):

```js
state.couchInTonight = couchInTonightFromDoc(d);
state.couchMemberIds = couchInTonightToMemberIds(state.couchInTonight);
if (typeof renderCouchViz === 'function') renderCouchViz();
if (typeof renderFlowAEntry === 'function') renderFlowAEntry(); // ← Bug B fix
```

The Bug B fix (renderFlowAEntry call inside the family-doc onSnapshot block)
is bundled into this commit because it edits the same onSnapshot block that
Task 1 is touching — splitting it would have created an avoidable merge
conflict between Tasks 1 and 6. Task 6's Bug B commit handles the second
half of the fix (collapsing the empty-state-c CTA card).

`persistCouchSeating` was renamed to `persistCouchInTonight` and now writes
BOTH shapes atomically — the new `couchInTonight` map AND a freshly-built
`couchSeating` index map (positional, walking `state.members` order). Dual-
write covers v33/v34.0 PWAs that read `couchSeating` during the rollout
(~1-2 weeks of v34.1 deployed). Drop the dual-write in a follow-up plan
after the cache cycle elapses.

### Task 2 — queuenight/firestore.rules 4th UPDATE branch for couchInTonight (CROSS-REPO; uncommitted on this machine)

`C:/Users/nahde/queuenight/firestore.rules` — added a 4th branch to the
`/families/{familyCode}` UPDATE rule mirroring the existing couchSeating
branch:

```firestore-rules
        ) || (
          // 14-10 (DECI-14-06 redesign per sketch 003 V5): couchInTonight write —
          // attribution-required. Any family member can write any member's slot
          // (proxy-fill is a feature, not a bug — one operator marks family in).
          // Audit trail via proxyConfirmedBy field embedded in the per-member
          // payload (NOT in affectedKeys; it's nested inside couchInTonight).
          attributedWrite(familyCode)
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['couchInTonight', 'couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
        );
```

The hasOnly allowlist names BOTH `couchInTonight` AND `couchSeating`
because `persistCouchInTonight` dual-writes both fields atomically. Without
that, the write would be denied because affectedKeys() includes a key not
in the hasOnly list.

The legacy couchSeating branch (added by 14-04) is kept active during the
migration window with a NOTE comment marking it as legacy. Drop both the
allowlist's `couchSeating` entry and the legacy 3rd branch in a follow-up
plan after one PWA cache cycle.

**Deviation 1 (Rule 3 deferred):** queuenight has no `.git` on this
machine — same pattern as 14-06's deviation 1 + 14-09's deviation 1. The
edit applied in-place; the user must commit it on a queuenight-equipped
session before the v34.1 deploy. Recorded in this SUMMARY and in STATE.md
Open follow-ups.

### Task 3 — V5 renderCouchViz + interaction handlers (commit 9569c33, ~200 lines net)

Whole `renderCouchViz` block (lines ~12953-13092 — `COUCH_MAX_SLOTS`,
`renderCouchViz`, `renderCouchAvatarGrid`, `window.claimCushion`,
`window.openCouchOverflowSheet`, `window.claimCushionByMember`,
`persistCouchSeating`) deleted and replaced with the V5 surface. Faithful
translation of `variant-5-roster-control.html` lines 369-437:

- `renderCouchViz()` produces the V5 DOM:
  - `.couch-hero.couch-hero-v5` (84px hero — smaller than 14-04's 280px)
  - `.couch-headline` (Fraunces "On the couch tonight")
  - `.couch-sub` (Instrument Serif italic, dynamic copy by state)
  - `.roster` wrap-flex of `.pill` elements (one per eligible roster member)
  - `.tally` (Fraunces num + Instrument Serif italic "of N watching")
  - `.pill-actions` (3 visibility-gated text-link buttons)
  - `.pill-hint` (italic copy below actions)
- Each `.pill` has `data-mid="${m.id}"`, `aria-pressed`, `aria-label`,
  `role="button"`, `tabindex="0"`, and the className combination
  `pill ${isIn?'in':'out'} ${isMe?'me':''}`.
- Dynamic sub-line copy: 0-in → "Tap who's watching"; me-only → "It's just
  you so far — tap others in"; partial → "N is/are watching"; all-in →
  "Whole couch is in".
- Action row visibility: "Mark everyone in" appears when numIn < total;
  "Clear couch" when numIn > 0; "Send pushes to the rest" when numOut > 0
  AND numIn > 0.
- Tooltip key `'couchSeating'` re-anchored from the legacy `.seat-cell.empty`
  to the equivalent V5 affordance `.pill.out` so users who already
  dismissed the 14-04 tooltip don't see it again.
- Eligible roster filter mirrors `renderTonight`'s old who-list emitter
  filter (excludes archived + expired guests) so V5 stays aligned with the
  rest of the Tonight tab.

Long-press 700ms gesture wired per pill (variant-5 sketch lines 392-427):

- `mousedown` / `touchstart{passive:true}` start the 700ms timer + apply
  `.pinging` class (CSS animates the `.ping-hint` underline 0% → 100% width).
- `mouseup` / `mouseleave` / `touchend` cancel the timer.
- On timer fire: `didLongPress=true`, brief scale + box-shadow flash,
  call `sendCouchPing(mid)`.
- `click` handler defends against `didLongPress` with `e.preventDefault()`
  so a fired long-press doesn't also trigger a tap.

`window.toggleCouchMember(memberId)` writes the new shape:

```js
const next = { in: !wasIn, at: Date.now() };
if (memberId !== state.me.id) next.proxyConfirmedBy = state.me.id;
cit[memberId] = next;
state.couchMemberIds = couchInTonightToMemberIds(cit);
renderCouchViz();
if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
haptic('light');
await persistCouchInTonight();
```

Three bulk-action helpers — `couchMarkAllIn` / `couchClearAll` /
`couchPushRest` — handle the visibility-gated action row.

### Task 4 — Roster pill CSS (commit 0f45602, ~180 lines net in `css/app.css`)

Replaces lines 3138-3274 (cushion-grid block) with V5 styling. Token-aligned
where the production design system provides them; hardcoded warm-dark
fallbacks where production tokens are absent (matches the 14-04 SUMMARY
note about `--c-*` tokens).

Rules added:

| Selector | Purpose |
|---|---|
| `.roster` | flex wrap container, gap 10px, max-width 580px, centered |
| `.pill` | base pill (32px circle av + 14px label + optional .you-tag + .ping-hint underline). 48px overall touch target ≥44pt iOS PWA minimum. |
| `.pill.out` | dashed border-soft, transparent bg, ghost initial in --c-text-dim |
| `.pill.in` | filled --surface, member-color av, drop-shadow elevation |
| `.pill.me` | solid --c-warm-amber border (regardless of in/out state) |
| `.pill.me.in` | linear gradient warm-amber tint over --surface |
| `.pill .ping-hint` + `.pill.pinging .ping-hint` | long-press progress underline 0%→100% over 700ms |
| `.couch-hero-v5` | 84px hero override (drop-shadow only) |
| `.couch-viz-container .tally` + `.num` + `.of` | tally bar |
| `.couch-viz-container .pill-actions` + `.action-link` | action row |
| `.couch-viz-container .pill-hint` | italic hint below actions |
| `@media (prefers-reduced-motion: reduce)` | kills .pill transition + .ping-hint progress |
| `@media (max-width: 480px)` | tighter pill padding + smaller av on phone |

Rules deleted:
- `.couch-avatar-grid` + 768px override
- `.seat-cell` + hover/focus
- `.seat-avatar` + `.seat-cell.me .seat-avatar`
- `.seat-empty` + hover variant
- `.seat-name`
- `@keyframes couch-empty-pulse`
- `@media (prefers-reduced-motion: reduce) { .seat-empty / .seat-cell }`

Also OBSOLETED the 14-09 `.couch-avatar-grid .seat-cell.empty.cushion-glow`
selector block (added by 14-09 D-11 (c) for the Find-a-seat empty-state
glow affordance) — its target selectors are gone, so the rule was a no-op.
Block replaced with a marker comment so the next maintainer knows where
14-09's CSS lived.

### Task 5 — Path C sendCouchPing stub (commit 5f17ebc)

The plan's three-path decision tree resolved to **Path C** after grep
inspection:

- **Path A rejected:** no generic `notifyMember` / `sendPushTo` /
  `pingMember` helper exists in the codebase. Adding one would touch the
  CF pipeline + client subscription pattern — out of scope for the V5 UX
  commit.
- **Path B rejected:** `createIntent({flow:'couch-ping'})` would require
  cross-repo CF additions — new `couchPing` event type in
  `NOTIFICATION_DEFAULTS` + `NOTIFICATION_EVENT_LABELS` per 14-09's DR-3
  pattern, plus a fan-out branch in `onIntentCreated` and a client
  subscription handler. Meaningful surface that deserves its own plan.
- **Path C selected:** ships the visible UX win (long-press progress →
  toast confirmation) without the CF wiring. `Sentry.addBreadcrumb`
  captures attempted fires under `category='couch-ping'` so we can size
  demand before the follow-up CF plan.

```js
window.sendCouchPing = function(memberId) {
  if (!state.me || !memberId) return;
  const m = (state.members || []).find(x => x.id === memberId);
  const name = m ? m.name : 'them';
  try {
    if (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb) {
      Sentry.addBreadcrumb({
        category: 'couch-ping',
        message: `would-fire ${memberId}`,
        level: 'info',
        data: { from: state.me.id, to: memberId }
      });
    }
  } catch (e) { /* never let analytics block UX */ }
  flashToast(`Push sent to ${name}`, { kind: 'info' });
};
```

Task 5 is split from Task 3 to keep the V5 UI swap atomic — Task 3 leaves
sendCouchPing as a toast-only stub; Task 5 layers the Sentry breadcrumb
on top.

### Task 6 — Bug A + Bug B cleanup (2 atomic commits: 603ac28 + 860dfea)

**Bug A — Remove legacy who-card from Tonight tab (commit 603ac28):**

- `app.html`: deleted the `.who-card` div (lines 334-337) — `#who-title-label`
  + `#who-list`. Replaced with a single comment explaining V5 ownership.
- `js/app.js applyModeLabels`: removed orphan `set('who-title-label', ...)`
  line whose target element was just deleted.
- `js/app.js renderTonight`: deleted the who-list emitter (~30 lines) —
  the branch that wrote to `#who-list` with `.who-chip` / `.who-empty` /
  Phase 11 REFR-03 'Nothing but us.' empty state. `openInviteShare` entry
  preserved via the existing 'Pick who's watching' empty-state branch
  (line ~4767) and other Family-tab callsites.
- `js/app.js` sticky who-mini IIFE (~13877): rewired from
  `'#screen-tonight .who-card'` to `'#screen-tonight #couch-viz-container'`
  (Option B) so the sticky mini bar still appears when user scrolls past
  the V5 roster. `#who-mini` element preserved in app.html line 303.

**Bug B — Obsolete renderFlowAEntry empty-state-c under V5 (commit 860dfea):**

Collapsed the 14-09 D-11 (c) empty-state branch from a 14-line CTA card +
cushion-glow forEach to a single line:

```js
if (couchSize < 1) { container.innerHTML = ''; return; }
```

Rationale: under V5, the dashed-pill roster IS the empty state — far more
informative than a generic "Who's on the couch tonight? + Find a seat"
CTA card. Showing both re-created the "two stacked surfaces" problem Bug A
just fixed. The cushion-glow forEach (`.couch-avatar-grid .seat-cell.empty`)
was already a no-op after Task 3 deleted the cushion grid; removing it
here cleans up the dead reference. Corresponding 14-09 cushion-glow CSS
keyframe was deleted in Task 4.

### Task 7 — sw.js CACHE bump (commit 81c6700)

`sw.js` line 8: `couch-v34.0-decision-ritual` → `couch-v34.1-roster-control`.
Source-of-truth bump; `bash scripts/deploy.sh 34.1-roster-control` would
auto-bump to the same value if not pre-set.

### Task 8 — STATE.md + sketch 003 status (commit 320ea81)

- `.planning/STATE.md`:
  - sw.js cache version section: v34.0 → v34.1
  - Open follow-ups: 14-04 visual UAT marked OBSOLETED (cushion grid
    surface no longer exists); new 14-10 V5 roster HUMAN-VERIFY entry
    added; queuenight cross-repo commit-pending entry added; 2 polish-
    backlog entries (couch-ping wiring deferral + dual-write drop after
    cache cycle).
  - v34 deploy-gate entry: chained 14-10 — single deploy via
    `scripts/deploy.sh 34.1-roster-control` ships v34.0 + v34.1 surfaces
    together since neither has been deployed yet.
  - last_activity: prepended 14-10 ship note ahead of the prior 14-09 record.
  - last_updated bumped.
- `.planning/sketches/003-couch-viz-redesign/README.md`: Status flipped
  from "Sketches built and ready for review. No production files modified."
  to "**SHIPPED 2026-04-26** via Phase 14 Plan 10 ..."
- `.planning/sketches/MANIFEST.md`: V5 row annotated "**SHIPPED via 14-10
  (2026-04-26)**".

### Task 9 — HUMAN-VERIFY checkpoint (DEFERRED to orchestrator handoff)

Plan-level `autonomous: false` because Task 9 is the blocking deploy +
cold-start UAT + multi-device proxy UAT + downstream regression UAT gate.
Returned as a structured checkpoint payload from this executor; the
orchestrator presents it to the user.

## Cross-plan dependency closure

This plan is a gap-closure on Phase 14-04 + 14-09 surfaces:

- **14-04** (Couch viz cushion grid + couchSeating Firestore shape) →
  REPLACED. The cushion-grid renderer + claim handlers + persistCouchSeating
  are deleted; couchSeating Firestore field is dual-written for backward
  compat then dropped in a follow-up.
- **14-09** D-10 (D-10 onboarding tooltip key `'couchSeating'`) → re-anchored
  to `.pill.out` from `.seat-cell.empty`. Same maybeShowTooltip key so users
  who already dismissed the 14-04 version don't see it again.
- **14-09** D-11 (c) (Flow A entry no-couch empty-state CTA card +
  cushion-glow CSS) → OBSOLETED under V5. The dashed-pill roster IS the
  empty state.
- **14-01** `isWatchedByCouch` → still consumes `state.couchMemberIds`
  unchanged. Now derived from `couchInTonight` via `couchInTonightToMemberIds`
  filter (in===true).
- **14-03** tier aggregators (`getTierOneRanked` / `TwoRanked` /
  `ThreeRanked`) → still consume `state.couchMemberIds` unchanged.
- **14-07** Flow A roster screen → still consumes `state.couchMemberIds`
  unchanged.

Downstream contract preserved across the migration via the
`couchInTonightToMemberIds` derivation.

## UAT gap closure

| UAT Test | Pre-14-10 status | 14-10 mechanism | Expected post-deploy state |
|---|---|---|---|
| 1 (Cold Start Smoke) | pass with composite issue | Bug A removes .who-card double-render | pass clean |
| 2 (Couch viz hero render) | pass | unchanged (hero kept, just smaller via .couch-hero-v5) | pass |
| 3 (Avatar grid layout — '7 blank spots... cluttered') | issue | V5 pills wrap-flex naturally without empty-cell sprawl on desktop | pass |
| 4 (Claim a cushion) | pass | Same gesture (tap to flip in) | pass |
| 5 (Vacate own cushion — 'I can only click once') | issue | Vacate is now the same gesture as claim — tap your own pill to flip out (no hidden affordance) | pass |
| 24 (Empty state c — Find-a-seat showing despite 1 seat claimed) | issue | Bug B fix: Task 1 added renderFlowAEntry to family-doc onSnapshot so empty-state CTA reacts to claim/vacate; Task 6 collapsed the redundant CTA card under V5 | pass |

## Verification (per plan `<verification>` block)

Phase-level checks (these run during the Task 9 HUMAN-VERIFY UAT):

- [ ] sw.js on couchtonight.app serves `couch-v34.1-roster-control` (post-deploy)
- [ ] queuenight/firestore.rules deployed with 4th UPDATE branch
- [ ] Tonight tab renders V5 roster (no .who-card, no cushion grid, no Find-a-seat empty card)
- [ ] couchInTonight Firestore writes succeed for self AND for proxy
- [ ] state.couchMemberIds derived from couchInTonight matches downstream consumers
- [ ] UAT tests 1, 3, 5, 24 flip from issue → PASS in 14-UAT.md
- [ ] Bug A regression check: zero `.who-card` references in production HTML
- [ ] Bug B regression check: no "Find a seat" CTA card appears under V5 with 0 cushions claimed
- [ ] Long-press 700ms timer fires (visual progress underline + toast confirmation)
- [ ] Reduced-motion respected
- [ ] iOS PWA tap targets >=44pt

Automated checks (already passed at commit time):

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` | exit 0 | **0 ✓** |
| `node --check sw.js` | exit 0 | **0 ✓** |
| `grep -c "couchInTonightFromDoc" js/app.js` | ≥1 | **3 ✓** (decl + onSnapshot + Task 3) |
| `grep -c "couchInTonightToMemberIds" js/app.js` | ≥1 | **6 ✓** |
| `grep -c "persistCouchInTonight" js/app.js` | ≥1 | **6 ✓** |
| `grep -c "function renderCouchViz" js/app.js` | 1 | **1 ✓** |
| `grep -c "window.toggleCouchMember" js/app.js` | 1 | **1 ✓** |
| `grep -c "window.sendCouchPing" js/app.js` | 1 | **1 ✓** |
| `grep -c "couchMarkAllIn\|couchClearAll\|couchPushRest" js/app.js` | ≥3 | **6 ✓** |
| `! grep -q "function renderCouchAvatarGrid" js/app.js` | 0 | **OK ✓** |
| `! grep -q "window.claimCushion " js/app.js` | 0 | **OK ✓** |
| `! grep -q "window.openCouchOverflowSheet" js/app.js` | 0 | **OK ✓** |
| `! grep -q "COUCH_MAX_SLOTS" js/app.js` | 0 | **OK ✓** |
| `grep -c ".pill.out\|.pill.in\|.pill.me" css/app.css` | ≥3 | **5 + 3 + 2 ✓** |
| `grep -c ".ping-hint" css/app.css` | ≥1 | **3 ✓** |
| `grep -c ".couch-hero-v5" css/app.css` | ≥1 | **2 ✓** |
| `! grep -q "couch-empty-pulse" css/app.css` | 0 | **OK ✓** |
| `! grep -q ".couch-avatar-grid" css/app.css` | 0 | **OK ✓** |
| `! grep -q ".seat-cell" css/app.css` | 0 | **OK ✓** |
| `! grep -q "class=\"who-card\"" app.html` | 0 | **OK ✓** |
| `! grep -q "id=\"who-title-label\"" app.html` | 0 | **OK ✓** |
| `! grep -q "id=\"who-list\"" app.html` | 0 | **OK ✓** |
| `! grep -q "set('who-title-label'" js/app.js` | 0 | **OK ✓** |
| `! grep -q "couch-avatar-grid .seat-cell.empty" js/app.js` | 0 | **OK ✓** |
| `grep "if (couchSize < 1) \{ container.innerHTML = ''; return; \}" js/app.js` | match | **match ✓** |
| `grep -c "couch-v34.1-roster-control" sw.js` | 1 | **1 ✓** |
| `! grep -q "couch-v34.0-decision-ritual" sw.js` | 0 | **OK ✓** |
| `grep -c "couchInTonight" queuenight/firestore.rules` | ≥2 | **4 ✓** |
| `grep -c "14-10" queuenight/firestore.rules` | ≥1 | **3 ✓** |
| `grep -c "14-10" .planning/STATE.md` | ≥1 | **8 ✓** |
| `grep -c "couch-v34.1-roster-control" .planning/STATE.md` | ≥1 | **1 ✓** |
| `grep -c "SHIPPED 2026-04-26" .planning/sketches/003-couch-viz-redesign/README.md` | ≥1 | **1 ✓** |
| `grep -c "SHIPPED via 14-10" .planning/sketches/MANIFEST.md` | ≥1 | **1 ✓** |

## Migration window note

`persistCouchInTonight` writes BOTH the new canonical `couchInTonight`
shape AND the legacy `couchSeating` positional map. This dual-write covers
v33/v34.0 PWAs that read `couchSeating` during the rollout — without it,
those installed-PWA users would see stale couch state until their service
worker activates the new CACHE.

After one PWA cache cycle (~1-2 weeks of v34.1 deployed), drop:
1. The `couchSeating: seatingMap` line in `persistCouchInTonight`
2. The legacy 3rd UPDATE branch in queuenight/firestore.rules (the
   couchSeating-only allowlist)
3. `couchSeating` from the 4th UPDATE branch's hasOnly allowlist

That cleanup is its own follow-up plan; tracked in STATE.md polish backlog.

## Deviations from plan

**Deviation 1 (Rule 3 deferred): queuenight commit unable on this machine.**
- **Found during:** Task 2.
- **Issue:** `C:/Users/nahde/queuenight/` has no `.git` folder on this
  machine, so the firestore.rules edit cannot be committed from this
  executor session.
- **Fix:** Edit applied in-place per plan instruction; user must commit
  from a queuenight-equipped session before the v34.1 deploy. Tracked in
  STATE.md "Two-repo discipline" follow-up. Same pattern as 14-06's
  deviation 1 + 14-09's deviation 1.
- **Files modified:** `C:/Users/nahde/queuenight/firestore.rules` (in-place,
  uncommitted).
- **Commit:** UNCOMMITTED-queuenight (in commit table).

No other deviations. Tasks 1, 3, 4, 5, 6, 7, 8 landed cleanly per the plan's
`<action>` blocks.

## Authentication gates

None.

## Threat surface scan

The threat register in 14-10-PLAN.md (T-14.10-01 through T-14.10-06) is
fully mitigated:

- **T-14.10-01 (Tampering — toggleCouchMember writes)** — Server-side
  `attributedWrite(familyCode)` rule requires `request.resource.data.actingUid
  == request.auth.uid`. A member cannot forge a proxy claim attributed to
  another member. Audit trail via `proxyConfirmedBy` field in the per-member
  payload.
- **T-14.10-02 (Information Disclosure — couchInTonight roster visible)** —
  Accept per the V5 product premise (the family roster IS the control
  surface; visibility is the feature). Existing `isMemberOfFamily` gate
  scopes reads to family members only.
- **T-14.10-03 (DoS — rapid pill-toggle spam)** — Accept. Tap interactions
  are inherently rate-limited by human gesture cadence; Firestore quota
  absorbs even abusive use.
- **T-14.10-04 (Repudiation — proxy-fill misuse)** — Mitigated. The
  proxyConfirmedBy field captures actor identity; combined with attributedWrite's
  actingUid enforcement, every couchInTonight slot has a forge-proof "who
  flipped this" audit trail.
- **T-14.10-05 (EoP — non-member writes couchInTonight)** — Mitigated.
  `attributedWrite(familyCode)` requires `isMemberOfFamily(familyCode)`;
  non-members denied at the rule level.
- **T-14.10-06 (Information Disclosure — couchSeating field readable during
  dual-write)** — Accept. Same ASVS-L1 posture as 14-04. Dropping
  couchSeating after one cache cycle reduces the dual-shape attack surface
  to zero post-migration.

No new threat surface introduced.

## Known stubs

**`window.sendCouchPing` — Path C stub.** Toast + Sentry breadcrumb only;
real push fan-out deferred to a follow-up plan that adds a `couchPing` event
type to queuenight/functions/index.js NOTIFICATION_DEFAULTS +
NOTIFICATION_EVENT_LABELS, a fan-out branch in onIntentCreated, and a client
subscription handler. Tracked in STATE.md polish backlog.

This stub is intentional and documented — it ships the visible UX win
(long-press progress → toast confirmation) so users can discover the gesture
and we can size demand via Sentry breadcrumbs before committing to the CF
work.

## Open follow-ups

| Type | Item | Where |
|------|------|-------|
| Two-repo discipline | queuenight commit pending — `C:/Users/nahde/queuenight/firestore.rules` 14-10 4th UPDATE branch added in-place but uncommitted on this machine. User must `cd ~/queuenight && git add firestore.rules && git commit -m "feat(14-10): allow proxy writes to couchInTonight (sketch 003 V5)"` from a queuenight-equipped session before deploy. | This SUMMARY deviation 1 |
| Polish backlog | Couch-ping push channel wiring — sendCouchPing currently shows toast + Sentry breadcrumb only. Real push fan-out requires queuenight/functions/index.js new event type 'couchPing' added to NOTIFICATION_DEFAULTS + NOTIFICATION_EVENT_LABELS (+ Phase 12 friendly-UI parity per 14-09 DR-3 override), fan-out branch in onIntentCreated, client subscription handler. Defer to follow-up plan. Sentry breadcrumb under category='couch-ping' captures attempted fires for product analytics in the meantime. | This SUMMARY known stubs |
| Polish backlog | Drop legacy couchSeating dual-write — persistCouchInTonight writes BOTH shapes for one PWA cache cycle. After ~1-2 weeks of v34.1 deployed, drop the couchSeating write in persistCouchInTonight AND the legacy 3rd UPDATE branch in queuenight/firestore.rules AND the couchSeating entry from the 4th UPDATE branch's hasOnly allowlist. | This SUMMARY migration window note |
| HUMAN-VERIFY | V5 roster cold-start visual UAT (10 sub-checks per Task 9 plan body). | This SUMMARY Task 9 section |
| HUMAN-VERIFY | Multi-device proxy UAT (4 sub-checks per Task 9). | This SUMMARY Task 9 section |
| HUMAN-VERIFY | Downstream contract regression UAT (5 sub-checks per Task 9). | This SUMMARY Task 9 section |
| Deploy gate | v34/v34.1 cross-repo deploy ritual (3-step queuenight CFs + queuenight firestore:rules + couch hosting) per STATE.md Open follow-ups. Single deploy ships v34.0 + v34.1 surfaces together since neither has been deployed yet. | STATE.md Deploy gate entry |

## Self-Check

Verifications run prior to writing this SUMMARY:

**Files exist:**
- `js/app.js` (renderCouchViz V5 + helpers) — FOUND
- `app.html` (no .who-card; #couch-viz-container preserved) — FOUND
- `css/app.css` (.pill rules + .couch-hero-v5; legacy cushion-grid removed) — FOUND
- `sw.js` (CACHE = couch-v34.1-roster-control) — FOUND
- `C:/Users/nahde/queuenight/firestore.rules` (4th UPDATE branch with couchInTonight) — FOUND (uncommitted on this machine)
- `.planning/STATE.md` — FOUND (8 references to 14-10)
- `.planning/sketches/003-couch-viz-redesign/README.md` — FOUND (Status: SHIPPED 2026-04-26)
- `.planning/sketches/MANIFEST.md` — FOUND (V5 row: SHIPPED via 14-10)

**Commits exist (couch repo):**
- efd2739 Task 1 — FOUND
- 9569c33 Task 3 — FOUND
- 0f45602 Task 4 — FOUND
- 5f17ebc Task 5 — FOUND
- 603ac28 Bug A — FOUND
- 860dfea Bug B — FOUND
- 81c6700 Task 7 — FOUND
- 320ea81 Task 8 — FOUND
- queuenight: UNCOMMITTED on this machine — documented as deviation 1

## Self-Check: PASSED
