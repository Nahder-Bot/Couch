---
phase: 14-decision-ritual-core
plan: 09
plan-name: Onboarding tooltips + 5 empty states + 7 push categories (DR-3) + sw.js v34 CACHE bump (D-10 + D-11 + D-12 + DECI-14-13)
requirements_addressed: [DECI-14-10, DECI-14-11, DECI-14-12, DECI-14-13]
status: code-complete
ship_state: CODE-COMPLETE — Tasks 1-6 shipped across 5 atomic couch commits; Task 7 (CFs+hosting deploy) DEFERRED to a queuenight-equipped session per Phase 14 batch-deploy pattern. queuenight/functions/index.js NOTIFICATION_DEFAULTS edit applied in-place but UNCOMMITTED on this machine (queuenight has no .git here — see deviation 1).
completed: 2026-04-26
followup_tag: "Deploy gate — queuenight CFs first, then bash scripts/deploy.sh 34.0-decision-ritual; also `firebase deploy --only firestore:rules --project queuenight-84044` from queuenight per 14-04 deploy gate"
commits:
  - hash: 8a36336
    type: feat
    msg: "feat(14-09): add D-10 anchored tooltip primitive (DECI-14-10)"
    files: [js/utils.js, css/app.css, js/app.js]
    repo: couch
  - hash: ae7f0c0
    type: feat
    msg: "feat(14-09): add maybeShowTooltip gate + 3 onboarding callsites (DECI-14-10)"
    files: [js/app.js]
    repo: couch
  - hash: fdcb9dc
    type: feat
    msg: "feat(14-09): implement 5 D-11 empty states (DECI-14-11)"
    files: [js/app.js]
    repo: couch
  - hash: e572467
    type: feat
    msg: "feat(14-09): add 7 D-12 push categories — DR-3 three-place add (DECI-14-12)"
    files: [js/app.js]
    repo: couch
  - hash: 9132144
    type: feat
    msg: "feat(14-09): v34 changelog entry + sw.js CACHE bump (DECI-14-13)"
    files: [changelog.html, sw.js]
    repo: couch
  - hash: UNCOMMITTED-queuenight
    type: feat
    msg: "feat(14-09): add 7 D-12 keys to NOTIFICATION_DEFAULTS"
    files: [functions/index.js]
    repo: queuenight
    note: queuenight has no .git on this machine — apply via the user's queuenight-equipped session before deploy. Pattern matches 14-06 deviation 1.
files-touched:
  created: []
  modified:
    - js/utils.js                                      # Task 1: showTooltipAt + hideTooltip exports
    - css/app.css                                      # Task 1: .coach-tip + .queue-empty-cta + .cushion-glow
    - js/app.js                                        # Tasks 1-3, 5: import + maybeShowTooltip + 3 callsites + 5 empty-states + tier opts + DR-3 client maps
    - changelog.html                                   # Task 6: v34 release article above v32
    - sw.js                                            # Task 6: CACHE bumped couch-v33.3-sentry-dsn → couch-v34.0-decision-ritual
    - C:/Users/nahde/queuenight/functions/index.js    # Task 4: NOTIFICATION_DEFAULTS extended with 7 D-12 keys (UNCOMMITTED)
deviations: 1   # Rule 3 (deferred): queuenight commit unable on this machine — same pattern as 14-06 deviation 1
checkpoints-hit: 1   # Task 7 deploy gate — return as `defer-deploy` matching Phase 14 batch-deploy pattern
auth-gates-hit: 0
key-decisions:
  - "DR-3 follow-up override applied (per CONTEXT.md note + /gsd-plan-phase 14 user override 2026-04-25): the 7 new D-12 keys surface ONLY in the legacy NOTIFICATION_EVENT_LABELS Settings UI, NOT mirrored into Phase 12 friendly-UI maps (NOTIF_UI_TO_SERVER_KEY / NOTIF_UI_LABELS / NOTIF_UI_DEFAULTS at js/app.js:128-155). Reason: avoid the dual-Settings-screen collision RESEARCH §5 flagged. Friendly-UI parity captured as a follow-up polish item."
  - "Task 7 deploy DEFERRED — match Phase 14 batch-UAT-and-deploy pattern. Queuenight CFs deploy + couch hosting + firestore:rules deploy bundled with the 4 outstanding multi-device UAT deferrals before v34 ships."
  - "Tier aggregators (getTierOneRanked / TwoRanked / ThreeRanked) widened with optional {includeWatched: true} second arg — backward-compatible — so D-11 (d) all-watched empty state's 'Show rewatch options' CTA can resurface watched titles without forking aggregators or mutating state. state.flowARevealRewatch flag flips on tap, resets on closeFlowAPicker."
  - "D-11 (a) brand-new family empty state inserted BEFORE the existing 'No group yet' branch in renderTonight, since titles==0 is the more general 'fresh family' condition (overrides both members-empty and selectedMembers-empty)."
  - "D-11 (e) reject-majority no-#2 surfaces when (rejectMajority && counterDepth >= 3) in the picker view, replacing the existing 'No more counters' counter-cap banner so the user gets a single CTA cluster (Cancel for tonight + Open Flow B) rather than competing messages."
  - "Default 'End nomination' button suppressed when the reject-exhausted block renders (showRejectExhausted), since 'Cancel for tonight' inside that block already invokes onFlowACancel — no need for a duplicate."
metrics:
  task_count: 6   # 7 minus the deploy checkpoint
  file_count: 6
  duration_min: ~22
---

# Phase 14 Plan 09: Onboarding Tooltips + 5 Empty States + 7 Push Categories + sw.js v34 CACHE Bump Summary

The final cross-cutting plan for Phase 14 ties Decision Ritual Core together
across four streams of work that depended on Plans 14-01..14-08 being in
place: D-10 hybrid onboarding (anchored tooltips + per-tooltip Firestore
gates + changelog v34 entry), D-11 empty states (5 action-leading CTAs
across the new surfaces with no dead ends), D-12 + DR-3 push categories
(7 new keys added in THREE places so 14-06's CF-side eventTypes flow
through user toggles correctly), and D-13 sw.js CACHE bump (so installed
PWAs invalidate on next online activation). Tasks 1-6 are shipped across
5 atomic couch commits + 1 in-place queuenight edit; Task 7 (CFs+hosting
deploy) is **DEFERRED** as a checkpoint to match the Phase 14 batch-UAT-
and-deploy pattern locked across 14-02, 14-04, 14-07, and 14-08.

With this plan code-complete, **9 of Phase 14's 9 plans are now done** —
phase status flips to **CODE-COMPLETE pending v34 deploy + batch UAT**.

## What shipped

### Task 1 — D-10 anchored tooltip primitive (commit 8a36336)

`js/utils.js` extended with `showTooltipAt(targetEl, message, opts)` +
`hideTooltip()` exports adapted from the existing `flashToast` lazy-create
+ requestAnimationFrame + setTimeout-removal pattern. Diverges from
flashToast in three ways: anchored to a target element via
`getBoundingClientRect()` (clamped horizontally so the 240px-max-width tip
stays on-screen on narrow viewports), single instance at a time (not
stacking), and dismiss-on-next-tap-anywhere via a capture-phase document
click listener (not auto-timer). Caller can pass `{placement: 'above'}` to
flip the default below-target positioning.

CSS: `css/app.css` extended with `.coach-tip` (warm-dark surface, amber
border, fade-in transition, z-index 200, pointer-events:none so the tip
itself doesn't capture taps that should dismiss it) + `prefers-reduced-
motion` guard. Plus the D-11 `.queue-empty-cta` flex layout helper and
the D-11 (c) `.cushion-glow` keyframe animation (with @media reduced-
motion override).

`js/app.js`: import statement extended to bring in `showTooltipAt` +
`hideTooltip` from utils.

### Task 2 — maybeShowTooltip gate + 3 callsites (commit ae7f0c0)

`maybeShowTooltip(primId, targetEl, message, opts)` helper added near
`maybeShowFirstRunOnboarding` (~js/app.js:12244). Reads
`members/{id}.seenTooltips` from the live `state.members` snapshot
(falling back to `state.me.seenTooltips` for first-render bootstrapping),
returns early if the primId is already flagged, calls `showTooltipAt`
with the supplied opts, then writes
`{[`seenTooltips.${primId}`]: true, ...writeAttribution()}` via
`updateDoc` so the next render skips. Guests
(`state.me.type === 'guest'`) skip entirely client-side (no Firestore
write).

**firestore.rules audit:** the `members/{memberId}` update branch at
`queuenight/firestore.rules:192-202` is permissive — any field-write by
self / owner / parent passes — so `seenTooltips.{primId}` writes go
through unchanged. No rules change needed; documented inline.

3 callsites wired:

1. **Couch viz first render** — `renderCouchViz` fires
   `couchSeating` tip on the first `.seat-cell.empty` cushion with
   placement above. Gated `setTimeout(200)` so the DOM settles before
   `getBoundingClientRect` runs.
2. **Tile action sheet first open** — `openTileActionSheet` fires
   `tileActionSheet` tip on `#action-sheet-content` with placement above
   (also `setTimeout(200)`).
3. **Library queue first render** — `renderFullQueue` fires
   `queueDragReorder` tip on the first `.full-queue-row` (default below
   placement, `setTimeout(200)`).

Each callsite is a one-shot — once the Firestore flag writes, subsequent
renders skip.

### Task 3 — 5 D-11 empty states (commit fdcb9dc)

All 5 surfaces from CONTEXT.md D-11 table implemented with verbatim copy
+ action-leading CTAs:

- **(a) Brand-new family / nothing watched** — `renderTonight` adds an
  early-return when `state.titles.length === 0 && state.familyCode`.
  Copy: "Your couch is fresh / Nothing in queue yet. What should be the
  first?" CTAs: `showScreen('add')` (Add tab) + `trakt.connect()`
  (Trakt history import). Inserted BEFORE the existing "No group yet"
  branch since titles==0 is the more general fresh-family condition.
- **(b) Empty personal queue** — `renderFullQueue` extended with the
  D-11 copy ("Your queue is empty / Vote on a few titles to fill it
  up.") + "Open Vote mode" CTA wired to `openSwipeMode()` (the
  canonical Vote-mode entry per 12-02 SUMMARY).
- **(c) Flow A entry / no couch** — `renderFlowAEntry` previously
  returned empty when `couchSize < 1`; now surfaces the D-11 copy
  ("Who's on the couch tonight? / Tap to seat yourself + invite
  family.") + "Find a seat" CTA scrolling the couch viz into view, AND
  applies the `cushion-glow` class to all `.seat-cell.empty` in the
  live couch viz so empty cushions pulse warm-amber. Animation respects
  `prefers-reduced-motion` (CSS @media guard).
- **(d) All-watched (T1+T2 empty)** — `renderFlowAPickerScreen` empty
  state expanded from "No candidates left" to the full D-11 copy
  ("You've seen everything in queue / Revisit a favorite or expand
  discovery?") + 2 CTAs: "Show rewatch options" → `onFlowAShowRewatch
  Options()` flips `state.flowARevealRewatch=true` and re-renders;
  "Discover more" → `closeFlowAPicker()` then `showScreen('add')`. The
  3 tier aggregators (`getTierOneRanked` / `getTierTwoRanked` /
  `getTierThreeRanked`) gained an optional second arg
  `opts.includeWatched` — when true, both `t.watched` and
  `isWatchedByCouch` filters are bypassed so already-watched titles
  resurface for rewatch. State flag resets on `closeFlowAPicker` so a
  fresh open starts back in the default exclude-watched view.
- **(e) Reject-majority retry exhausted** — `renderFlowAResponseScreen`
  picker view extended to surface a new `showRejectExhausted` block
  when `rejectMajority && counterDepth >= 3 && !isClosed`. Copy: "🎲
  No alternative pick / Try again or anyone nominate?" CTAs: "Cancel
  for tonight" → `onFlowACancel()`; "Open Flow B" → closes the picker
  and calls `openFlowBNominate(intent.titleId)` so the user can
  solo-nominate the same title via Flow B. Replaces (not stacks with)
  the existing counter-cap banner to avoid competing messages, and
  suppresses the default "End nomination" footer button since the
  in-block "Cancel for tonight" already invokes onFlowACancel.

All 5 surfaces use the existing `.queue-empty` shell + the new
`.queue-empty-cta` flex layout helper (Task 1 CSS).

### Task 4 — 7 D-12 push categories in NOTIFICATION_DEFAULTS (queuenight)

`C:/Users/nahde/queuenight/functions/index.js` `NOTIFICATION_DEFAULTS`
`Object.freeze` extended with the 7 D-12 keys (`flowAPick`,
`flowAVoteOnPick`, `flowARejectMajority`, `flowBNominate`,
`flowBCounterTime`, `flowBConvert`, `intentExpiring`), all default `true`
per RESEARCH §5 (these fire only when the user has actively engaged with
a flow, so they expect the notification). Inline comment marker
`// === D-12 Phase 14 push categories — DECI-14-12 ===` added immediately
above the new block. Existing 8 keys preserved verbatim. Syntax check
passes (`node --check`).

**Deviation 1 (Rule 3 deferred):** queuenight has no `.git` on this
machine — same pattern as 14-06's deviation 1. The edit applied
in-place; the user must commit it on a queuenight-equipped session
before the Task 7 deploy. The change is recorded in this SUMMARY and
in the Task 7 checkpoint payload.

### Task 5 — 7 D-12 push categories in DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS (commit e572467)

DR-3 places 2 + 3:

- `DEFAULT_NOTIFICATION_PREFS` at `js/app.js:100` — 7 keys appended,
  all default `true`, mirroring the queuenight server map exactly.
- `NOTIFICATION_EVENT_LABELS` at `js/app.js:113` — 7 entries appended
  with BRAND-voice copy verbatim from CONTEXT.md D-12 push table:

  | Key | Label | Hint |
  |-----|-------|------|
  | flowAPick | "Tonight's pick chosen" | "When someone on your couch picks a movie." |
  | flowAVoteOnPick | "Couch voted on your pick" | "When someone responds to a pick you made." |
  | flowARejectMajority | "Your pick was passed on" | "When the couch asks you to pick again." |
  | flowBNominate | "Watch with the couch?" | "When someone wants to watch with you at a time." |
  | flowBCounterTime | "Counter-time on your nom" | "When someone counters with a different time." |
  | flowBConvert | "Movie starting in 15 min" | "When your nomination becomes a watchparty." |
  | intentExpiring | "Tonight's pick expiring" | "Heads-up that a tonight intent is about to expire." |

**DR-3 follow-up override applied** (per CONTEXT.md note added 2026-04-25
at /gsd-plan-phase 14 + the executor-context reminder): the Phase 12
friendly-UI maps at `js/app.js:128-155`
(`NOTIF_UI_TO_SERVER_KEY` / `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS`) are
**NOT** updated in this plan. The 7 new D-12 keys surface ONLY in the
legacy NOTIFICATION_EVENT_LABELS Settings UI to avoid the
dual-Settings-screen collision RESEARCH §5 flagged. Friendly-UI parity
captured as a follow-up polish item — see "Open follow-ups" below.

Inline comment block above NOTIFICATION_EVENT_LABELS documents the
override decision so the next maintainer doesn't re-litigate it.

### Task 6 — v34 changelog entry + sw.js CACHE bump (commit 9132144)

`changelog.html`: new `<article class="release">` for v34 inserted
IMMEDIATELY ABOVE the existing v32 article (changelog is
reverse-chronological). Tagline: "A new way to pick what to watch —
together." 4 highlight items: The couch / Two flows / Tile redesign /
Your queue. Copy follows BRAND voice per PATTERNS §16. Deploy date is a
placeholder `[deploy date YYYY-MM-DD]` to be replaced when Task 7
executes (or in a follow-up changelog-only deploy).

`sw.js`: `CACHE` constant bumped from `couch-v33.3-sentry-dsn` to
`couch-v34.0-decision-ritual` so installed PWAs invalidate on next
online activation. `node --check sw.js` passes. The `bash
scripts/deploy.sh 34.0-decision-ritual` pipeline auto-bumps when a tag
is passed; pre-setting the value here is safe — the script is
idempotent.

### Task 7 — DEFERRED deploy gate (CHECKPOINT)

**Status: DEFERRED** (not "deployed", not "deploy-failed" — explicitly
deferred per user `defer-deploy` resume signal 2026-04-26.) This is a
deliberate deferral matching the established Phase 14 pattern of bundling
all multi-device UAT + the cross-repo deploy into a single batch
pre-v34-production-deploy session (locked across 14-02, 14-04, 14-07,
14-08, and now 14-09 as the 5th deferral).

The deploy ritual itself remains valid and MUST run before Phase 14 ships
to v34 production. Deploy order (for the future session, copy-pasteable):

1. `cd ~/queuenight && git add functions/index.js && git commit -m "feat(14-06+14-09): extend intents CFs + add D-12 push categories" && firebase deploy --only functions`
   — server-side `NOTIFICATION_DEFAULTS` learns the 7 D-12 keys and
   14-06's `onIntentCreated` / `onIntentUpdate` / `watchpartyTick`
   branches go live. **Required FIRST** so by the time hosting flips,
   the CFs already understand the new event types and intent flows.
2. `cd ~/queuenight && firebase deploy --only firestore:rules --project queuenight-84044`
   — per the 14-04 Task 4 deploy gate; without this, `couchSeating`
   writes from `persistCouchSeating()` will be denied by the rules
   currently live in production.
3. `cd ~/claude-projects/couch && bash scripts/deploy.sh 34.0-decision-ritual`
   — auto-bumps `sw.js` CACHE if not already set (it IS — committed
   9132144), mirrors couch repo into `queuenight/public/`, runs
   `firebase deploy --only hosting`. Installed PWAs invalidate on next
   online activation and pick up the redesigned tiles + Couch viz +
   tooltip primitive + new push wiring + extended intents schema.
4. **Smoke test cross-flow:** claim a couch seat → trigger Flow A picker
   → trigger tile action sheet → trigger Flow B nominate. Verify each
   surface renders + persists + (where applicable) push delivers.
5. Edit `changelog.html` to replace the `[deploy date YYYY-MM-DD]`
   placeholder with the actual deploy date and re-run `bash
   scripts/deploy.sh 34.0.1-changelog-date` (tiny patch deploy — clean
   release notes for users browsing /about → changelog).

**Tag:** v34 cross-repo deploy ritual deferred — bundle with batch UAT.

## Cross-plan dependency closure

This plan closes the loop on every prior 14-* plan:

- **14-01** (`isWatchedByCouch`) → consumed by `getTierOneRanked` /
  `TwoRanked` / `ThreeRanked` aggregators which now honor an
  `opts.includeWatched` opt-out (Task 3 D-11 (d)).
- **14-04** (Couch viz `renderCouchViz`) → tooltip target #1 `couchSeating`
  fires once per user on first empty cushion render. Cushion-glow
  affordance (D-11 (c)) attaches to live couch viz seat-cell.empty
  elements when Flow A entry surfaces a no-couch state.
- **14-05** (`openTileActionSheet`) → tooltip target #2 `tileActionSheet`
  fires once per user on first action-sheet open.
- **14-06** (CFs + 7 new eventType strings) → the 7 keys are NOW backed
  by client + server defaults so user toggles take effect (DR-3 closed).
  Until Task 7 deploys queuenight CFs, the legacy fallback at
  `queuenight/functions/index.js:114-115` (defaultOn=true when
  hasDefault=false) keeps the new categories firing — this plan removes
  the silent default-on by writing the key explicitly.
- **14-07** (Flow A) → empty states (d) and (e) live in
  `renderFlowAPickerScreen` and `renderFlowAResponseScreen`. The
  reject-majority retry-exhausted state hands off the same titleId to
  `openFlowBNominate`, so a user can solo-nominate via Flow B from a
  failed Flow A — closing the discoverability gap between the two
  parallel flows.
- **14-08** (Flow B) → reachable from the new D-11 (e) "Open Flow B" CTA
  AND from the openTileActionSheet "Ask family" entry (already wired in
  14-05). 4 of its push event types (`flowBNominate` / `flowBCounterTime`
  / `flowBConvert` / `intentExpiring`) are now in DEFAULT_NOTIFICATION_PREFS.

## Phase 14 closure rollup

| Plan | Requirement(s) | Status | Commit(s) |
|------|----------------|--------|-----------|
| 14-01 | DECI-14-01 | Complete | (per 14-01-SUMMARY) |
| 14-02 | DECI-14-03 | Complete UAT-DEFERRED | 2e1ca4b + 2b670d2 |
| 14-03 | DECI-14-02 | Complete | ccf600f |
| 14-04 | DECI-14-06 | Complete UAT-DEFERRED | 1234624 + 3a561bd + cb31155 |
| 14-05 | DECI-14-04 + DECI-14-05 | Complete | f90155d + d1762e1 + 09db482 + 6d630c4 |
| 14-06 | DECI-14-09 | Complete | 3c6b4b9 + 9a09872 (queuenight uncommitted) |
| 14-07 | DECI-14-07 | Complete UAT-DEFERRED | d97a81e |
| 14-08 | DECI-14-08 | Complete UAT-DEFERRED | af168f1 |
| 14-09 | DECI-14-10 + DECI-14-11 + DECI-14-12 + DECI-14-13 | Code-complete deploy-DEFERRED | 8a36336 + ae7f0c0 + fdcb9dc + e572467 + 9132144 |

**Phase 14 — Decision Ritual Core: 9/9 plans CODE-COMPLETE 2026-04-26.**
**Phase status: COMPLETE pending v34 deploy + batch UAT.** 13 DECI-14-*
requirements all addressed (1 still PENDING — DECI-14-01 / Plan 14-01 —
status preserved as found in REQUIREMENTS.md).

## Open follow-ups

| Type | Item | Where |
|------|------|-------|
| Deploy gate | **Task 7 deferred** — the cross-repo deploy ritual must run before v34 ships. Order: (1) `firebase deploy --only functions` from `~/queuenight` (so server-side NOTIFICATION_DEFAULTS knows the 7 D-12 keys + 14-06's onIntentCreated/onIntentUpdate/watchpartyTick branches are live); (2) `firebase deploy --only firestore:rules --project queuenight-84044` from `~/queuenight` (per 14-04 Task 4 deploy gate — couchSeating writes will be denied without it); (3) `bash scripts/deploy.sh 34.0-decision-ritual` from couch repo (auto-bumps sw.js CACHE if not already set, mirrors to queuenight/public/, runs firebase deploy --only hosting). After deploy, edit `changelog.html` to replace `[deploy date YYYY-MM-DD]` with the actual deploy date and re-run `bash scripts/deploy.sh 34.0.1-changelog-date` (optional but recommended for clean release notes). | This SUMMARY + 14-04-SUMMARY.md deploy gate |
| Two-repo discipline | **queuenight commit pending** — `C:/Users/nahde/queuenight/functions/index.js` NOTIFICATION_DEFAULTS edit applied in-place but uncommitted on this machine. Same pattern as 14-06 deviation 1. User must `cd ~/queuenight && git add functions/index.js && git commit -m "feat(14-09): add 7 D-12 push categories to NOTIFICATION_DEFAULTS"` from a queuenight-equipped session before deploy. | This SUMMARY deviations |
| Polish backlog | **DR-3 friendly-UI parity** — the 7 new D-12 keys surface ONLY in the legacy NOTIFICATION_EVENT_LABELS Settings UI per the DR-3 follow-up override. Phase 12 friendly-UI maps (`NOTIF_UI_TO_SERVER_KEY` / `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` at js/app.js:128-155) need a follow-up polish plan to mirror them in. RESEARCH §5 flagged the dual-Settings-screen collision risk; a future polish plan must resolve which Settings surface wins (legacy vs friendly-UI) before adding the keys to friendly-UI. | This SUMMARY DR-3 override note |
| HUMAN-VERIFY | **Tooltip UAT** — verify the 3 D-10 tooltips fire once and only once per user: (a) Couch viz first render after a fresh sign-in shows "Tap a cushion to seat yourself."; (b) first tile tap shows "These are your options for this title."; (c) first Library tab visit with filter==myqueue shows "Drag to reorder your queue."; (d) on second login, none of the three re-fire (Firestore flag wrote correctly). Bundle into the existing v34 batch UAT pass. | This SUMMARY |
| HUMAN-VERIFY | **Empty-states UAT** — visit each of the 5 D-11 surfaces in a controlled session and verify: (a) brand-new family with 0 titles shows "Your couch is fresh"; (b) empty personal queue shows "Your queue is empty"; (c) Flow A with 0 cushions claimed shows "Who's on the couch tonight?" with cushion-glow pulse animation; (d) all-watched picker shows "You've seen everything in queue" + "Show rewatch options" reveals watched titles correctly; (e) Flow A reject-majority + counter-cap shows "No alternative pick" with both CTAs functional + Open Flow B hands off the titleId. Bundle into the v34 batch UAT pass. | This SUMMARY |
| HUMAN-VERIFY | **Push toggle UAT** — visit Settings notifications, verify the 7 new D-12 toggles render with the BRAND-voice labels + hints from Task 5; toggle one off, trigger the corresponding intent flow, confirm push does NOT arrive. | This SUMMARY |

## Self-Check

Verifications run prior to writing this SUMMARY (per executor protocol):

**Files exist:**
- `js/utils.js` (showTooltipAt + hideTooltip exports) — FOUND
- `css/app.css` (.coach-tip + .queue-empty-cta + .cushion-glow) — FOUND
- `js/app.js` (maybeShowTooltip + 3 callsites + 5 empty states + 2 client maps) — FOUND
- `changelog.html` (v34 article above v32) — FOUND
- `sw.js` (CACHE = couch-v34.0-decision-ritual) — FOUND
- `C:/Users/nahde/queuenight/functions/index.js` (7 keys in NOTIFICATION_DEFAULTS) — FOUND (uncommitted)

**Commits exist (couch repo):**
- 8a36336 — FOUND
- ae7f0c0 — FOUND
- fdcb9dc — FOUND
- e572467 — FOUND
- 9132144 — FOUND
- queuenight: UNCOMMITTED on this machine — documented as deviation 1

**Verification block (from PLAN):**
- node --check js/utils.js — exit 0 ✓
- node --check js/app.js — exit 0 ✓
- node --check sw.js — exit 0 ✓
- node --check C:/Users/nahde/queuenight/functions/index.js — exit 0 ✓
- grep "export function showTooltipAt" js/utils.js — 1 ✓
- grep "maybeShowTooltip" js/app.js — 8 (≥4) ✓
- grep "seenTooltips" js/app.js — 5 (≥2) ✓
- grep "Your couch is fresh" js/app.js — 1 ✓
- grep "Your queue is empty" js/app.js — 1 ✓
- grep "Who's on the couch tonight" js/app.js — 4 (≥1; 3 pre-existing + 1 new) ✓
- grep "seen everything in queue" js/app.js — 1 ✓
- grep "No alternative pick" js/app.js — 2 (1 comment + 1 rendered) ✓
- grep "flowAPick: true" queuenight/functions/index.js — 1 ✓
- grep "flowAPick: true" js/app.js — 1 ✓
- grep "Tonight's pick chosen" js/app.js — 2 (flowAPick + tonightPickChosen — both legitimate) ✓
- grep "v34" changelog.html — 1 ✓
- grep "couch-v34" sw.js — 1 ✓

## Self-Check: PASSED
