---
phase: 14
phase_name: "Decision Ritual Core"
project: "Couch"
generated: "2026-04-26T22:54:34Z"
counts:
  decisions: 12
  lessons: 9
  patterns: 9
  surprises: 7
missing_artifacts: []
---

# Phase 14 Learnings: Decision Ritual Core

## Decisions

### DR-1 reconciliation: extend existing `intents` collection (don't fork a new one)
The researcher caught that Phase 8 already shipped `families/{code}/intents/` with `tonight_at_time` + `watch_this_title` flow types, full CFs, rules, and client UI. Rather than mint a parallel `watchpartyIntents` collection as the original D-09 spec said, Phase 14 extended the existing collection with two new `flow` values (`rank-pick`, `nominate`), reused `onIntentCreated` / `onIntentUpdate` / `watchpartyTick`, and widened the existing rules block.

**Rationale:** One schema, one CF, one rules block. Parallel collections would have created two "intent" concepts, two CF triggers, and rule duplication. The state-enum mismatch (Phase 8 `'yes'/'no'/'maybe'/'later'` vs D-07 `'in'/'reject'/'drop'/'maybe'`) was solved by keying vocabulary off `flow` instead of forking schema.
**Source:** 14-RESEARCH.md (DR-1), 14-CONTEXT.md (D-09), 14-06-SUMMARY.md

---

### DR-2 reconciliation: per-member queue is already shipped — Phase 14 is polish, not primitive build
D-03 was scoped as "build per-member queue primitive" but research found the entire infrastructure (queues map, Yes-auto-add at applyVote, drag-reorder, persist, reindex) already lived in production. Phase 14 reframed 14-02 from "new primitive" to "discoverability toast + Add-tab insertion verify + iOS DnD UAT." Plan title was renamed accordingly.

**Rationale:** Avoid rebuilding shipped infrastructure. The actual gaps were narrow: a silent applyVote queue mutation lacking discoverability and an Add-tab path that didn't seed `queues[state.me.id]`.
**Source:** 14-RESEARCH.md (DR-2), 14-02-SUMMARY.md

---

### DR-3 reconciliation: 7 push categories must be added in THREE places, not two
Original CONTEXT said "add to NOTIFICATION_PREFS_ALLOWLIST + NOTIF_UI_TO_SERVER_KEY." Researcher found NOTIFICATION_PREFS_ALLOWLIST doesn't exist. Real allowlist is `NOTIFICATION_DEFAULTS` (server, queuenight) + `DEFAULT_NOTIFICATION_PREFS` (client) + `NOTIFICATION_EVENT_LABELS` (client labels). Skipping any of the three means pushes either silently default-on regardless of pref or render with no label.

**Rationale:** Without the server-side `NOTIFICATION_DEFAULTS` entry, `sendToMembers` falls back to `defaultOn=true` per `hasDefault` check at functions/index.js:114 — toggle exists in UI but is silently ignored on server.
**Source:** 14-RESEARCH.md (DR-3), 14-09-SUMMARY.md (Tasks 4-5)

---

### DR-3 follow-up override: skip Phase 12 friendly-UI parity for the 7 new toggles
At /gsd-plan-phase 14 the user explicitly overrode the original "mirror in friendly-UI" plan. The 7 new push categories surface ONLY in the legacy `NOTIFICATION_EVENT_LABELS` Settings list — NOT in `NOTIF_UI_TO_SERVER_KEY` / `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` at js/app.js:128-155.

**Rationale:** RESEARCH §5 flagged that mixing the two would produce two Settings screens that disagree. Friendly-UI parity was deferred to a follow-up polish plan that resolves which surface wins before adding keys to both.
**Source:** 14-CONTEXT.md (DR-3 follow-up override), 14-09-SUMMARY.md key-decisions

---

### Sketch 003 V5 ("Roster IS the control") winner pick over V1-V4
After the original 14-04 cushion-grid shipped to prod, UAT exposed three issues: 7-blank-spots clutter on desktop, "I can only click once" non-discoverable vacate UX, and stacked legacy who-card. Sketch 003 produced 5 variants; V5 (each family member as a tappable pill, same gesture for self-claim/proxy-fill/vacate) won. V1-V4 felt cluttered or derivative.

**Rationale:** The cushion-grid metaphor was abstract — "seats" had no real-world referent for "who's watching tonight." Roster pills make the family roster ITSELF the control surface; gesture vocabulary (tap to flip in/out) is uniform across all three actions. No hidden affordances.
**Source:** 14-10-SUMMARY.md (Task 3), .planning/sketches/003-couch-viz-redesign

---

### Path C selected for sendCouchPing (toast + Sentry breadcrumb stub)
Three paths considered for the long-press → ping gesture: (A) generic notifyMember helper, (B) `createIntent({flow:'couch-ping'})` with full CF wiring, (C) toast + Sentry breadcrumb stub. Path C shipped.

**Rationale:** Path A rejected — no generic notify helper exists in the codebase. Path B rejected — would require cross-repo CF additions for a new event type that deserves its own plan. Path C ships the visible UX win (long-press progress + toast) and captures attempted-fire telemetry under `category='couch-ping'` to size demand before committing to the CF work.
**Source:** 14-10-SUMMARY.md (Task 5 key-decisions)

---

### T3 visibility resolver: most-restrictive-wins (privacy-leaning posture)
The 3-tier candidate filter's Tier 3 ("watching her movie without her") visibility resolves across account/family/group `preferences.showT3`. Any explicit `false` at any level hides T3; `undefined` falls through to default-show.

**Rationale:** Privacy-leaning posture matching Phase 13 compliance philosophy. When the toggle is absent (no UI yet), T3 is visible; an explicit "hide" at any layer wins. The expand toggle is fully absent (not just collapsed) when hidden, so users can't discover the hidden pile via UI inspection.
**Source:** 14-CONTEXT.md (D-02), 14-03-SUMMARY.md (resolveT3Visibility)

---

### Multi-device UAT batch deferral pattern (4 + 1 deferrals locked across Phase 14)
14-02 (iOS Safari touch-DnD), 14-04 (couch viz visual + iOS PWA), 14-07 (multi-device Flow A), 14-08 (multi-device Flow B), and 14-09 (tooltip/empty-states/push-toggles UAT) all deferred their HUMAN-VERIFY tasks to a single batch session against production v34.1 rather than running mid-phase.

**Rationale:** Running multi-device UAT mid-phase buys nothing that running it once at deploy time doesn't. Adjacent surfaces (push category prefs, tooltip overlay, empty states) are best exercised together. Each plan documents `skip-uat` as an explicit resume-signal closure path, not an oversight.
**Source:** 14-02 / 14-04 / 14-07 / 14-08 / 14-09 SUMMARY (Task 5 sections); 14-VERIFICATION.md human_verification block

---

### 14-04 cushion-grid surface obsoleted by 14-10 V5 redesign — first downstream-replaces-upstream pattern in this phase
14-04 shipped cushion-grid + couchSeating positional Firestore shape. UAT surfaced 3 design issues. 14-10 (gap-closure plan, frontmatter `gap_closure: true`) ran sketch 003, picked V5, then DELETED the entire 14-04 surface (renderCouchAvatarGrid + claimCushion + persistCouchSeating + COUCH_MAX_SLOTS) and migrated `couchSeating: { [mid]: index }` → `couchInTonight: { [mid]: { in, at, proxyConfirmedBy? } }`.

**Rationale:** The cushion grid couldn't be patched into V5 — the gesture vocabulary (claim/vacate/proxy-fill) needed to be uniform, which required the surface to be the family roster, not pre-rendered seats. Migrating the Firestore shape happened simultaneously because positional indices made no sense in the new surface.
**Source:** 14-10-SUMMARY.md (cross-plan dependency closure), 14-04-SUMMARY.md (status preserved)

---

### Dual-write Firestore migration with backward-compat read for one PWA cache cycle
`persistCouchInTonight` writes BOTH the new canonical `couchInTonight` AND a freshly-built legacy `couchSeating` index map atomically. `couchInTonightFromDoc` reads the new shape with legacy fallback. Migration window ~1-2 weeks; drop both sides after cycle elapses.

**Rationale:** v33/v34.0 PWAs would see stale couch state during rollout if dual-write were skipped. Service worker activation is async — installed PWAs only invalidate on next online activation. Dual-write covers the gap without forcing a hard cache bust.
**Source:** 14-10-SUMMARY.md (Task 1 + migration window note)

---

### Counter-chain depth cap at 3 (D-07.6) — server + client enforcement
Both Flow A counter-nomination and Flow B counter-time chains cap at 3 levels. Enforced server-side via firestore.rules update branch (5) — `counterChainDepth` strictly equals existing+1 or 1, ≤ 3 — and client-side via early-return + UI disable.

**Rationale:** Without a cap, an adversarial pair could ping-pong counters indefinitely. 3 is the friction threshold at which "decide between options on the table" becomes the right UX. At depth 3, the picker UI surfaces "X options on the table — pick one or end nomination" and no further counters are accepted.
**Source:** 14-CONTEXT.md (D-07.6), 14-06-SUMMARY.md (rules branch 5), 14-07-SUMMARY.md (Task 4)

---

### Carry-over UAT bug closed by pre-existing `.detail-close{position:fixed}` (no code change)
The CONTEXT carry-over bug ("✕ scrolls out of view on long detail content") was reported in the Library/Queue context. Plan 14-05 Task 5 found the fix already lived at css/app.css:1540 with explanatory comment block + iOS safe-area-inset compensation. Closed (not deferred) — the global rule covers every entry surface (Library, Tonight, Add tab, Queue) because they all open the same `#detail-modal` with the same `.detail-close` button. Avatar-picker-modal is the only intentional scoped exception.

**Rationale:** Surface analysis showed all reported entry points open the same modal element. No code change needed. Task 3's TMDB community-reviews extension validates the fix against longer body content than the original bug report.
**Source:** 14-05-SUMMARY.md (Task 5)

---

## Lessons

### Adding a new surface without removing the legacy one creates "two stacked surfaces" UX failure (Bug A)
14-04 added the couch viz ABOVE the legacy Phase 11 `.who-card` pill rail without removing or hiding the legacy element. User reported "Still has the who is on the couch below it" during UAT. Fix at 14-10 commit 603ac28: deleted the `.who-card` div from app.html, dropped orphan `applyModeLabels` who-title-label set, deleted renderTonight who-list emitter, rewired sticky who-mini IIFE from `.who-card` → `#couch-viz-container`.

**Lesson:** When introducing a new surface, audit ALL surfaces showing the same data. Search for legacy DOM elements + their CSS + their renderer + any sticky/observer-attached IIFEs that depend on them. Default to deletion (not guarding) because dead code accumulates.
**Source:** 14-UAT.md Gap #1, 14-10-SUMMARY.md (Bug A / Task 6a)

---

### Family-doc onSnapshot didn't re-render dependent CTAs — "stale CTA" class of bug (Bug B)
After a member claimed a seat (purple N rendered, sub-count flipped), the "Find a seat" empty-state CTA card stayed on screen. Root cause: `renderFlowAEntry` was only re-rendered by the intents snapshot subscription, not by the family-doc snapshot that updated `state.couchMemberIds`. The CTA went stale until an unrelated intent write fired.

**Lesson:** When a render function reads from state populated by multiple onSnapshot subscriptions, ALL of those subscriptions must call the renderer. Diagnostic process: trace from "what data does this render read?" → "where is each piece written?" → "where is each renderer called from?" — gaps in the renderer-call matrix are stale-CTA traps.
**Source:** 14-UAT.md Gap #2, 14-10-SUMMARY.md (Bug B / Task 6b + Task 1 fix bundling)

---

### Long-press 700ms timer needed touchcancel handling (caught post-ship in code review)
The V5 long-press gesture wired `mousedown/touchstart` start + `mouseup/mouseleave/touchend` cancel — but missed `touchcancel`. iOS fires touchcancel when scrolling interrupts a touch sequence; without the handler, the timer would fire phantom ping events on incidental swipes.

**Lesson:** Touch event sequences include touchcancel. Any handler set listening on touchstart MUST pair with touchcancel handlers. Documented as a polish post-ship in the v34.1.1-touchcancel-fix cache version (per CLAUDE.md).
**Source:** CLAUDE.md current cache version `couch-v34.1.1-touchcancel-fix`; pattern matches sketch 003 V5 commit 9569c33 long-press handlers

---

### Deprecated state path read by surviving code: who-mini sticky bar referenced orphaned `state.selectedMembers`
After V5 swap removed the cushion grid, the sticky who-mini IIFE still queried the old `.who-card` selector. Without a rewire, the sticky mini bar would silently break. Caught and fixed via Option B (rewire to `#couch-viz-container` instead of delete the IIFE).

**Lesson:** When deleting a surface, grep for ALL selectors / state reads / observer attachments referencing it. Inverse problem from Bug A: there, the legacy code was visible and stacked; here, the legacy code was invisible and broken.
**Source:** 14-10-SUMMARY.md (Task 6a sticky who-mini rewire decision)

---

### Cross-repo deploy ordering matters: queuenight rules MUST deploy before couch hosting
14-04 + 14-09 + 14-10 each documented this gate: without `firebase deploy --only firestore:rules` from queuenight FIRST, installed-PWA users would see permission-denied on every couchSeating/couchInTonight/intent write. Deploy order locked: (1) queuenight functions, (2) queuenight firestore:rules, (3) couch hosting via scripts/deploy.sh.

**Lesson:** Whenever client code generates a write the live rules don't yet permit, you have a deploy-ordering hazard. Plan summaries should explicitly document the deploy dependency. The couch repo's scripts/deploy.sh only runs `--only hosting` — it does NOT cover the queuenight side.
**Source:** 14-04-SUMMARY.md "Deploy reminder", 14-09-SUMMARY.md Task 7 deploy order, 14-10-SUMMARY.md Open follow-ups

---

### Test-isolation finding: long graceUntil + withSecurityRulesDisabled() reset is the legacyGraceWrite false-allow workaround
14-04 Task 4 test #19 stamps `memberId` on fam1, which would otherwise satisfy `legacyGraceWrite()` during the seeded grace window and let the missing-attribution write through (test #20) — producing a false-allow that masquerades as a passing test.

**Lesson:** Firestore rules tests that share family-doc state across test cases need explicit reset between cases that probe attribution branches. Use `withSecurityRulesDisabled()` to reset attribution mid-suite, and seed a graceUntil long enough to cover the deny-path test. Captured as the documented workaround so the next rules-test author doesn't waste cycles re-discovering it.
**Source:** 14-04-SUMMARY.md (Task 4 test isolation note)

---

### Plan-sample corrections needed during execution (3 in 14-07: intentRef, metaBits, isClosed gate)
14-07's plan sample code had three executable bugs caught at execution: (1) wrapped `doc(intentRef(id))` when `intentRef` already returns a doc ref; (2) referenced generic `entry.meanRank` for T2/T3 rows when 14-03 actually returns `meanPresentRank`/`meanOffCouchRank`; (3) missing `isClosed` gate on response screen would re-render stale primary buttons after status flipped to converted/cancelled.

**Lesson:** Plan-sample code is illustrative, not authoritative. The executor must verify each helper signature against the actual codebase before pasting. Three discrete Rule 1/Rule 2 deviations on a single plan suggests the plan-sample needs tighter grounding — or that executor verification is the point of the workflow.
**Source:** 14-07-SUMMARY.md (Deviations 1, 2, 3)

---

### "I can only click once" wasn't a bug — it was a discoverability failure that required redesign, not fix-in-place
UAT Test 5 (vacate own cushion) initially read as a code bug. Inspection found vacate was wired correctly (re-tap own filled cell would vacate). The actual problem was visual signposting — there was no affordance telling the user "tap me again to vacate." Fixed via V5 redesign where the gesture vocabulary is uniform (tap own pill toggles in/out — same gesture as claim).

**Lesson:** Distinguish "code missing" from "discoverability missing." A correctly-wired interaction with no visual affordance reads as broken. Resolution may require a redesign, not a code fix.
**Source:** 14-UAT.md Test 5 + Gap #3, 14-10-SUMMARY.md (Task 3 design rationale)

---

### Sample-code intentRef pattern: `intentRef(id)` returns doc ref, NOT collection ref
The helper at js/app.js:1388 returns a doc ref directly. Wrapping it in `doc(intentRef(...))` (as the plan sample suggested) would error at runtime. 14-08's working af168f1 commit used `intentRef(id)` unwrapped — same pattern 14-07 followed once the bug was caught.

**Lesson:** When the plan sample diverges from a sibling plan's working code, the sibling plan is usually right. Cross-reference before pasting from a plan sample.
**Source:** 14-07-SUMMARY.md (Deviation 1)

---

## Patterns

### Atomic sibling primitive insertion (don't modify the existing primitive)
14-05 Task 2 added `window.openTileActionSheet` IMMEDIATELY ABOVE the existing `window.openActionSheet` at js/app.js:11853. The two sit side-by-side as siblings. The existing primitive is UNCHANGED; the new one reuses the same `#action-sheet-bg` DOM container and `.action-sheet-item` styling.

**Rationale:** Modifying an existing primitive that has multiple call sites risks regressions. Sibling insertion preserves the legacy primitive verbatim while adding the new variant. Greppable comment marker `// === D-04 openTileActionSheet — DECI-14-04 ===` makes the new sibling discoverable.
**Source:** 14-05-SUMMARY.md (Task 2)

---

### Dual-write Firestore migration with backward-compat read
14-10 Task 1: helper `couchInTonightFromDoc(d)` hydrates new shape with legacy `couchSeating` fallback (auto-rebuilds `{ [mid]: { in: true } }` from indexed map when only the old field is present). `persistCouchInTonight` writes both shapes atomically. Migration window ~1-2 weeks; drop after cache cycle elapses.

**Rationale:** Service worker activation is async — installed PWAs only see the new code on next online activation. Dual-write covers the v33/v34.0 PWAs that read the legacy field during the rollout. Backward-compat read covers the inverse case (newly-installed PWA seeing a doc written by a still-legacy peer).
**Source:** 14-10-SUMMARY.md (Task 1 + migration window note)

---

### 3-path option selection with explicit per-path rejection rationale
14-10 Task 5 sendCouchPing: enumerated 3 paths (A: generic notifyMember helper, B: createIntent({flow:'couch-ping'}), C: toast+breadcrumb stub) and documented the rejection reason for each. Path C shipped.

**Rationale:** Decision documents that "ship Path C" without rejecting A and B leave readers wondering whether A or B was actually considered. Per-path rejection rationale answers the "why not the other thing?" follow-up before it's asked.
**Source:** 14-10-SUMMARY.md (Task 5 key-decisions)

---

### 6-stage commit chain for cross-cutting plan + 1 deploy stamp
14-09's 5 atomic couch commits (8a36336, ae7f0c0, fdcb9dc, e572467, 9132144) + 1 uncommitted queuenight edit. 14-10's 8 atomic couch commits (efd2739, 9569c33, 0f45602, 5f17ebc, 603ac28, 860dfea, 81c6700, 320ea81) + 1 uncommitted queuenight edit.

**Rationale:** Each commit is independently revertable, has a single test surface (node --check exits 0), and a single conceptual change. Cross-cutting plans that touch tooltip + empty-states + push categories + sw.js bump in one commit would be hard to audit, hard to revert, and hard to bisect.
**Source:** 14-09-SUMMARY.md commit table, 14-10-SUMMARY.md commit table

---

### `skip-uat` resume signal for batch-UAT deferral
Each plan's Task N HUMAN-VERIFY checkpoint can resolve via `skip-uat` — the plan's `<resume-signal>` block explicitly enumerates this as a valid closure path. SUMMARY records the deferral as a known follow-up + STATE.md tracks the v34 deploy gate. The pattern locked across 14-02/14-04/14-07/14-08/14-09.

**Rationale:** Mid-phase UAT for visual / multi-device behavior buys nothing that pre-deploy batch UAT doesn't. Codifying `skip-uat` as a documented closure path (not an oversight) preserves audit-trail integrity while letting code-complete work move forward.
**Source:** 14-02 / 14-04 / 14-07 / 14-08 / 14-09 SUMMARY (Task 5 sections)

---

### Sketches as design-call resolution mechanism
When UAT Test 3 escalated from a code bug to "rethink streamlined Apple-style," `/gsd-sketch` ran round 003 with 5 variants, user picked V5, and 14-10 executed the V5 build. Sketches resolve "design-direction decision required" UAT issues without forcing a fix-in-place that won't satisfy.

**Rationale:** A code bug has one right answer; a design issue has many possible answers. Sketches let the user pick the answer before code commits. The 14-10 plan was authored AFTER sketch sign-off, so the plan body could reference the V5 sketch by file:line directly (faithful translation).
**Source:** 14-UAT.md Test 3 fix_direction options, .planning/sketches/003-couch-viz-redesign

---

### Cross-repo split with user-side commit pattern when deploy-mirror has no .git on dev machine
queuenight has no .git on the user's machine. Pattern across 14-06, 14-09, 14-10: edit queuenight files in-place, validate with `node --check` + targeted greps, document UNCOMMITTED-queuenight in commit table, track in STATE.md "Two-repo discipline" follow-up. User commits from a queuenight-equipped session before deploy.

**Rationale:** The dev machine doesn't carry the queuenight git repo; another machine / session does. The atomic-commit invariant within the couch repo is preserved; the queuenight side becomes an audit-trail follow-up. Functional behavior unaffected — files were deployed via firebase deploy.
**Source:** 14-06-SUMMARY.md (Deviation 1), 14-09-SUMMARY.md (Deviation 1), 14-10-SUMMARY.md (Deviation 1)

---

### `gap_closure: true` frontmatter to scope `--gaps-only` execution
14-10 plan frontmatter sets `gap_closure: true` + `gap_source: 14-UAT.md (Tests 1, 3, 5, 24 — composite design rethink)`. This signals that the plan is a UAT-driven gap-closure cycle, not a fresh phase plan. SUMMARY counts as the 10th plan (not append-to-existing).

**Rationale:** Gap-closure cycles after deploy are a recurring need. Marking them in frontmatter lets orchestrators differentiate "Phase N planned 9 plans, gap-closure added 1 → final 10" from "Phase N had scope creep." The seed/locked-scope file remains the source of truth for original scope.
**Source:** 14-10-SUMMARY.md (frontmatter)

---

### Tooltip first-render gate via Firestore round-trip + state.onboarding.seenTooltips
14-09 D-10 anchored tooltip pattern: 3 callsites (couchSeating, tileActionSheet, queueDragReorder) wrapped in `maybeShowTooltip(primId, targetEl, message, opts)` that reads `members/{id}.seenTooltips` from live snapshot, returns early if flagged, otherwise shows tooltip + writes the flag via attributedWrite. Guests skip entirely client-side.

**Rationale:** Per-tooltip Firestore flag survives sign-out/sign-in; one-shot per user per primitive. `setTimeout(200)` wrapper at each callsite lets the DOM settle before getBoundingClientRect runs. Capture-phase document-click listener handles dismiss-on-next-tap.
**Source:** 14-09-SUMMARY.md (Tasks 1-2)

---

## Surprises

### Sketch 003 V5 was selected AFTER 4 prior variants — V1-V4 felt cluttered/derivative
The redesign was nontrivial scope addition mid-Phase-14. V1 through V4 explored variations on the cushion-grid metaphor (denser, single-CTA Apple-style, hybrid phone/desktop, filled-only-with-invite). V5 broke the metaphor entirely — make the family roster the control. This was the answer that fit; the prior 4 were close-but-not-quite.

**Source:** .planning/sketches/003-couch-viz-redesign/README.md, 14-UAT.md "Pending design call"

---

### Cushion-grid (14-04 sketch 001 winner P) was completely obsoleted 1 day after shipping by user UAT feedback driving sketch 003
14-04 selected hero-icon + grid (Variant P) from sketch 001 round 2026-04-25, shipped 2026-04-26 morning. UAT exposed three issues same-day. Sketch 003 ran 2026-04-26, V5 selected, 14-10 shipped 2026-04-26. The cushion-grid surface lived in production for less than a day before being deleted.

**Source:** 14-04-SUMMARY.md commits 1234624 + 3a561bd + cb31155 (2026-04-26), 14-10-SUMMARY.md (2026-04-26)

---

### 14-04 + 14-09 SVG `renderCouchSvg()` never built — sketch 001 obsoleted the original D-06 plan BEFORE execution
The original D-06 plan called for procedural inline SVG renderer with adaptive seat count 2-8. Sketch round 001 ran 2026-04-25 and concluded that hero-icon + avatar-grid (Variant P) was the right architecture. The SVG renderer was never built — 14-04 implemented the locked direction from sketch instead. Then 14-10 deleted Variant P entirely.

**Source:** 14-04-SUMMARY.md (Approach note), 14-RESEARCH.md §4 (SVG was greenfield with no existing analog in repo)

---

### queuenight repo had no .git on the dev machine — repeated cross-repo deferral pattern across 14-06, 14-09, 14-10
Three plans hit the same Rule 3 deviation (uncommitted queuenight edits) in the same session. STATE.md tracked "Two-repo discipline" as a recurring follow-up. Resolved 2026-04-26 via separate cleanup; until then, every queuenight-touching plan documented the same workaround.

**Source:** 14-06 / 14-09 / 14-10 SUMMARY (Deviation 1 in each)

---

### Deploy gate cross-repo ordering enforcement was a hard prerequisite — a single mis-order would cause permission-denied at runtime
14-04 Task 4 introduced new firestore.rules that scripts/deploy.sh doesn't deploy. Without `firebase deploy --only firestore:rules` from queuenight FIRST, the new client code would write to fields the live rules don't permit, and every couchSeating/couchInTonight/intent write would fail with permission-denied. Documented as a deploy gate in 14-04, 14-09, 14-10 SUMMARY follow-ups.

**Source:** 14-04-SUMMARY.md "Deploy reminder", 14-09-SUMMARY.md Task 7 (deploy order)

---

### 14-10 added 1 more plan (10 plans) than the 9-plan initial scope — gap closures count as new plans
Phase 14 was scoped at 8-9 plans in CONTEXT.md "suggested plan structure." 9 plans landed at code-complete (14-09 was the close-out plan). Then 14-10 ran as a UAT-driven gap-closure cycle and the final phase manifest counted 10 plans. The frontmatter signal `gap_closure: true` makes the scope addition explicit rather than masking it as scope creep.

**Source:** 14-CONTEXT.md (suggested 8-9 plans), 14-09-SUMMARY.md ("9/9 plans CODE-COMPLETE"), 14-10 frontmatter

---

### Phase 14 represents the largest single phase shipped to date in GSD on this project — 10 plans, 13 requirements, ~25-30 atomic commits across 2 repos, V5 redesign + 4-step UAT closure all in 2 days, 0 blocker anti-patterns + 0 goal-blocking gaps
Cross-repo deploy ritual completed end-to-end, V5 surface verified live by user, dual flows (Flow A + Flow B) + extended intents primitive + 7 push categories + onboarding tooltips + 5 empty states all wired and live. Per-plan deviation count averaged ~1, all auto-fixable per execution rules.

**Source:** 14-VERIFICATION.md final paragraph
