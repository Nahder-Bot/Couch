---
status: human_needed
phase: 14-decision-ritual-core
verified_at: 2026-04-26T20:45:00Z
score: 13/13 must-haves code-verified
overrides_applied: 0
human_verification:
  - test: "iOS Safari touch-DnD on Library queue (14-02 Task 3)"
    expected: "Long-press + drag a queue row reorders it on installed iOS Safari PWA; new order persists across refresh"
    why_human: "Touch-DnD behavior on iOS Safari + iOS PWA standalone mode requires physical device"
  - test: "Multi-device Flow A end-to-end (14-07 Task 5)"
    expected: "2-device session: picker on A claims couch + sends rank-pick → recipient on B receives flowAPick push within ~5s on iOS PWA → response In/Reject/Drop/Counter flows → counterChainDepth caps at 3 → reject-majority surfaces Pick #2 → quorum convert creates watchparty + opens Phase 11-05 lobby"
    why_human: "Multi-device push delivery, real-time rsvps live tally + Phase 11-05 lobby handoff require 2 devices + Firebase production CFs + real iOS PWA"
  - test: "Multi-device Flow B end-to-end (14-08 Task 5)"
    expected: "2-device session: nominator on A submits Flow B nominate → recipient on B receives flowBNominate push → counter-time chain → nominator accept/reject/compromise → T-15min auto-convert via watchpartyTick CF → flowBConvert push → lobby; all-No edge case auto-cancels with cancelReason='all-no'; ?intent= deep-link routing"
    why_human: "Multi-device push delivery + 5-min CF cadence + iOS PWA push activation require physical devices; T-15min auto-convert requires waiting"
  - test: "Tooltip + 5 empty-states + 7 push toggles UAT (14-09)"
    expected: "3 D-10 tooltips fire once per user (couchSeating + tileActionSheet + queueDragReorder), don't re-fire on second login. 5 D-11 empty states render correctly per CONTEXT.md table. 7 D-12 push toggles render in Settings with BRAND-voice copy; toggling one off suppresses the corresponding push."
    why_human: "Visual UI behavior + Firestore seenTooltips round-trip + push toggle effect on real push delivery require physical device + production CFs + multi-session"
  - test: "v34.1 cold-start V5 visual + iOS PWA tap-target UAT (cross-cuts 14-04 + 14-10)"
    expected: "Already-passed by user via approved-deploy 4-step UAT on production 2026-04-26 (Tests 1, 3, 5, 24 in 14-UAT.md flipped to pass). Remaining 14-UAT.md tests 6-23 + 25-50 pending against the now-live V5 + Flow A + Flow B + onboarding surface"
    why_human: "44 individual UAT tests in 14-UAT.md require physical multi-device sessions + iOS PWA + Firestore round-trips + push delivery"
---

# Phase 14: Decision Ritual Core — Verification Report

**Phase Goal:** Replace the vote-prominent Tonight tile with a couch-centered, conversation-first ritual: already-watched filter, queue polish, tier aggregators, couch viz (now V5 roster-control per gap-closure 14-10), tile redesign, intents collection extension, Flow A (rank-pick), Flow B (solo-nominate), onboarding/empty-states/push, and v34/v34.1 production deploy.

**Verified:** 2026-04-26T20:45:00Z
**Status:** human_needed
**Re-verification:** No — initial verification (post-14-10 V5 redesign + production deploy)

## Goal Achievement

### Observable Truths (Roadmap Success Criteria + Plan must-haves)

The phase ROADMAP entry doesn't list explicit Success Criteria; the 13 DECI-14-* requirements + the 10 plan must_haves provide the verification contract. Goal-backward: "Did Phase 14 deliver the Decision Ritual Core — couch-centered control surface + dual flows (rank-pick + nominate) + onboarding/empty-states/push + v34.1 in production?"

| #   | Truth (DECI-14-* requirement) | Status | Evidence |
| --- | ----------------------------- | ------ | -------- |
| 1   | DECI-14-01 — `isWatchedByCouch(t, couchMemberIds)` strict 4-source filter + per-title rewatch override + invitation bypass | ✓ VERIFIED | `js/app.js:7647` `function isWatchedByCouch(t, couchMemberIds)` + `js/app.js:7672` `setRewatchAllowed`; firestore.rules permissive (Case B); 6 discovery callsites wired (per 14-01-SUMMARY); zero refs in queuenight CFs (invitation bypass invariant) |
| 2   | DECI-14-02 — 3-tier candidate filter T1/T2/T3 + most-restrictive-wins T3 visibility resolver | ✓ VERIFIED | `js/app.js:7727` getTierOneRanked + `:7752` getTierTwoRanked + `:7785` getTierThreeRanked + `:7822` resolveT3Visibility; aggregators consume isWatchedByCouch; T3 toggle gated by resolveT3Visibility in `renderFlowAPickerScreen` (14-07) |
| 3   | DECI-14-03 — Per-member queue polish: Yes-vote toast + Add-tab insertion + iOS DnD UAT | ✓ CODE / ⏳ HUMAN-UAT | applyVote toast at js/app.js (commit 2e1ca4b); 4 user-Add call sites pass `addToMyQueue:true` (commit 2b670d2). **iOS Safari touch-DnD UAT deferred** — see human_verification |
| 4   | DECI-14-04 — Tile redesign (X-want-it pill + Trailer btn + body→openTileActionSheet + 4 buckets + detail-modal cast/reviews) | ✓ VERIFIED | `js/app.js:13226` `window.openTileActionSheet` (sibling to existing openActionSheet at 11853); X-want-it pill + ▶ Trailer btn in card(t); detail modal lazy-fetches TMDB reviews; carry-over UAT bug CLOSED via pre-existing `.detail-close{position:fixed}` at css/app.css:1540 |
| 5   | DECI-14-05 — Vote-mode preserved in Add tab via "Catch up on votes (N)" CTA | ✓ VERIFIED | Conditional CTA renders when unvotedCount ≥10; tap launches existing openVoteModal; `.add-catchup-cta` at css/app.css:3490 |
| 6   | DECI-14-06 — Couch viz on Tonight tab (originally hero+grid, **REPLACED** by V5 roster per 14-10 sketch 003) | ✓ VERIFIED (V5 surface) | `js/app.js:12957` `function renderCouchViz` emits V5 roster; `:13079` `window.toggleCouchMember`; `:13190` `persistCouchInTonight` dual-writes new + legacy fields. **V5 surface deployed v34.1-roster-control to couchtonight.app + queuenight firestore:rules 4th UPDATE branch live**. **User confirmed via approved-deploy 4-step UAT 2026-04-26** (Tests 1/3/5/24 flipped to pass). Original 14-04 cushion-grid must_haves OBSOLETED by 14-10 — same underlying user goal achieved (show who's on couch, allow claim/vacate) |
| 7   | DECI-14-07 — Flow A: group rank-pick + push-confirm + counter-chain + reject-majority retry + quorum convert | ✓ CODE / ⏳ HUMAN-UAT | `js/app.js:14149` openFlowAPicker + `:14160` renderFlowAPickerScreen + `:14303` renderFlowARosterScreen + `:14431` renderFlowAResponseScreen; submitCounterNom + counterChainDepth bumps; createIntent({flow:'rank-pick'}) wired to 14-06 CFs. **Multi-device UAT deferred** — see human_verification |
| 8   | DECI-14-08 — Flow B: solo-nominate + counter-time + nominator counter-decision + auto-convert + all-No | ✓ CODE / ⏳ HUMAN-UAT | `js/app.js:1874` openFlowBNominate + `:1882` renderFlowBNominateScreen + `:1983` renderFlowBResponseScreen + `:2159` renderFlowBStatusScreen + `:2347` maybeOpenIntentFromDeepLink; cancelReason='all-no'; Auto-converting indicator. **Multi-device UAT deferred** — see human_verification |
| 9   | DECI-14-09 — Extend intents collection (DR-1) with 4 flow values + counterChainDepth ≤3 + open→converted + flow-aware CFs | ✓ VERIFIED | createIntent extended with `flow` arg + 4 enum values; `firestore.rules` widened (rank-pick + nominate + counter-chain branch 5 + open→converted); `queuenight/functions/index.js` onIntentCreated branches on flow (`flowAPick`/`flowBNominate`); onIntentUpdate fires `flowAVoteOnPick`/`flowBCounterTime`/`flowARejectMajority`; watchpartyTick has Branch B auto-convert + Branch C T-30min warning + warned30 idempotency flag; **CFs deployed to production** per UAT session-blocker resolution + approved-deploy signal |
| 10  | DECI-14-10 — Hybrid onboarding: changelog v34 entry + 3 anchored tooltips with seenTooltips Firestore gate | ✓ CODE / ⏳ HUMAN-UAT | `js/utils.js` exports showTooltipAt + hideTooltip; `js/app.js:12294` maybeShowTooltip; 3 callsites (couchSeating in renderCouchViz / tileActionSheet in openTileActionSheet / queueDragReorder in renderFullQueue); `changelog.html:67` v34 article above v32 (deploy date placeholder remains `[deploy date YYYY-MM-DD]` — minor follow-up). **Tooltip first-render + non-replay UAT deferred** — see human_verification |
| 11  | DECI-14-11 — 5 D-11 empty states (a/b/c/d/e) with action-leading CTAs | ✓ CODE / ⏳ HUMAN-UAT | All 5 surfaces verified by grep: "Your couch is fresh" (js/app.js:4750), "Your queue is empty" (:5239), "Who's on the couch tonight?" (:2491/:4525 — V5 roster IS the empty state per 14-10 Bug B), "seen everything in queue" (:14230), "No alternative pick" (:14474). **Visual/behavioral UAT deferred** — see human_verification |
| 12  | DECI-14-12 — 7 push categories in 3 places (server defaults + client defaults + client labels) per DR-3 | ✓ VERIFIED | `queuenight/functions/index.js:89-95` NOTIFICATION_DEFAULTS includes all 7 keys; `js/app.js:114-120` DEFAULT_NOTIFICATION_PREFS mirror; `js/app.js:141-147` NOTIFICATION_EVENT_LABELS with BRAND-voice copy; CFs deployed (UAT confirms 11 Flow A/B push-type references in production queuenight/functions/index.js); friendly-UI parity deferred per DR-3 follow-up override (documented polish backlog) |
| 13  | DECI-14-13 — sw.js CACHE bumped + v34 deployed | ✓ VERIFIED | `sw.js:8` `CACHE = 'couch-v34.1-roster-control'` (V5 redesign supersedes original v34.0-decision-ritual); couchtonight.app/sw.js serves v34.1 (per 14-UAT.md session-blocker resolution); cross-repo deploy ritual completed 2026-04-26 via approved-deploy signal |

**Score:** 13/13 truths code-verified; 5 are CODE-COMPLETE pending physical-device HUMAN-UAT (deferred per phase pattern; see human_verification section)

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `js/app.js` (foundations) | isWatchedByCouch, setRewatchAllowed, T1/T2/T3 aggregators, resolveT3Visibility | ✓ VERIFIED | 7 functions present at js/app.js:7647-7822; consumed by 6 discovery callsites + Flow A picker |
| `js/app.js` (V5 couch viz) | renderCouchViz V5 + couchInTonightFromDoc + couchInTonightToMemberIds + persistCouchInTonight + toggleCouchMember + sendCouchPing + couchMarkAllIn/ClearAll/PushRest | ✓ VERIFIED | All 9 functions/handlers at js/app.js:12928-13190; legacy 14-04 renderCouchAvatarGrid + claimCushion + COUCH_MAX_SLOTS deleted (per 14-10 SUMMARY verification table) |
| `js/app.js` (Flow A) | openFlowAPicker, renderFlowAPickerScreen, renderFlowARosterScreen, renderFlowAResponseScreen + 9 handlers | ✓ VERIFIED | All 4 functions present at :14149/:14160/:14303/:14431; submitCounterNom + onFlowAConvert + onFlowARetryPick + onFlowARespond all present |
| `js/app.js` (Flow B) | openFlowBNominate, renderFlowBNominateScreen, renderFlowBResponseScreen, renderFlowBStatusScreen + maybeOpenIntentFromDeepLink + 11 handlers | ✓ VERIFIED | All 4 functions present at :1874/:1882/:1983/:2159; deep-link routing at :2347; counter/accept/reject/compromise/auto-cancel handlers wired |
| `js/app.js` (Tile + onboarding) | openTileActionSheet sibling primitive + maybeShowTooltip gate + 3 callsites | ✓ VERIFIED | window.openTileActionSheet at :13226; maybeShowTooltip at :12294; existing window.openActionSheet at :11853 unchanged (sibling-only insert) |
| `js/app.js` (createIntent extension) | 4 flow values + counterChainDepth + expectedCouchMemberIds | ✓ VERIFIED | grep counterChainDepth in js/app.js → 10+ refs; rank-pick/nominate enum widened; back-compat with legacy `type` preserved |
| `js/app.js` (push category maps) | DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS with 7 D-12 keys | ✓ VERIFIED | DEFAULT_NOTIFICATION_PREFS at :100, EVENT_LABELS at :131; all 7 keys present with BRAND-voice copy |
| `js/utils.js` | showTooltipAt + hideTooltip exports + .coach-tip class | ✓ VERIFIED | Exports present (per 14-09 SUMMARY); `.coach-tip` CSS at css/app.css:3699 with `.on` state at :3716 + reduced-motion guard at :3721 |
| `app.html` | #couch-viz-container + #flow-a-entry-container; legacy .who-card REMOVED | ✓ VERIFIED | grep `who-card` in app.html → 1 match (a comment marker explaining removal at line 334) — actual `<div class="who-card">` block deleted by 14-10 commit 603ac28 |
| `css/app.css` | V5 .pill rules (out/in/me + .pinging/.ping-hint) + .roster + .couch-hero-v5 + .tc-want-pill + .add-catchup-cta + .flow-a-entry + .flow-b-nominate-content + .coach-tip | ✓ VERIFIED | `.pill.out` at :3256, `.pill.in` at :3277, `.pill.me` at :3289, `.couch-hero-v5` at :3167, `.roster` at :3199, `.ping-hint` at :3298, `.tc-want-pill` at :3389, `.add-catchup-cta` at :3490, `.flow-a-entry` at :3531, `.flow-b-nominate-content` at :3062, `.coach-tip` at :3699; reduced-motion guards at :3375 + :3721 |
| `sw.js` | CACHE = couch-v34.1-roster-control | ✓ VERIFIED | sw.js:8 confirmed; couchtonight.app/sw.js serves the same value (per 14-UAT.md session-blocker resolution) |
| `changelog.html` | v34 release article above v32 (reverse-chronological) | ✓ VERIFIED | v34 article at :67-79; v32 article at :81+ (correct order); deploy date placeholder remains `[deploy date YYYY-MM-DD]` (recommended follow-up) |
| `queuenight/firestore.rules` | 4th UPDATE branch on /families/{code} for couchInTonight + couchSeating dual-write allowlist + intents block widening | ✓ VERIFIED | grep couchInTonight in firestore.rules → 4 refs (comment + branch + 2× allowlist); rules deployed to queuenight-84044 per approved-deploy signal |
| `queuenight/functions/index.js` | NOTIFICATION_DEFAULTS extended with 7 D-12 keys + onIntentCreated/onIntentUpdate flow branches + watchpartyTick auto-convert + T-30min warning | ✓ VERIFIED | All 7 D-12 keys at :89-95; onIntentCreated branches `flowAPick` (:415) + `flowBNominate` (:436); onIntentUpdate `flowAVoteOnPick` (:556) + `flowBCounterTime` (:589) + `flowARejectMajority` (:626); watchpartyTick `flowBConvert` (:776/:779) + `intentExpiring` (:831) + warned30 idempotency flag; CFs deployed to us-central1 per UAT session-blocker resolution |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| Tonight tab `renderTonight` | `renderCouchViz()` (V5) | direct call after picker-card | ✓ WIRED | renderTonight calls renderCouchViz; family-doc onSnapshot also calls renderCouchViz + renderFlowAEntry (per 14-10 efd2739) |
| `renderCouchViz()` | `state.couchInTonight` | `couchInTonightFromDoc(d)` hydration in family-doc onSnapshot | ✓ WIRED | onSnapshot at js/app.js ~4131-4150 hydrates state.couchInTonight + derives state.couchMemberIds via couchInTonightToMemberIds filter |
| Downstream consumers (14-01/14-03/14-07) | `state.couchMemberIds` | shared state read | ✓ WIRED | Contract preserved across 14-04→14-10 migration (in===true filter); isWatchedByCouch + tier aggregators + Flow A roster all read state.couchMemberIds unchanged |
| Flow A picker | `createIntent({flow:'rank-pick', ...})` | function call after Send Picks | ✓ WIRED | onFlowASendPicks calls createIntent → CF onIntentCreated `flowAPick` branch fires push to expectedCouchMemberIds intersection minus creator |
| Flow B nominate | `createIntent({flow:'nominate', ...})` | function call after Send Nomination | ✓ WIRED | onFlowBSubmitNominate calls createIntent → CF onIntentCreated `flowBNominate` branch fires push to all family members minus creator |
| Push deep-link | `maybeOpenIntentFromDeepLink()` | URL `?intent=` parser at boot | ✓ WIRED | Routes to openFlowAResponseScreen (rank-pick), openFlowBStatusScreen (nominate creator), openFlowBResponseScreen (nominate recipient); legacy intents fall through |
| `toggleCouchMember(memberId)` | `families/{code}.couchInTonight.{memberId}` | updateDoc dot-path + writeAttribution | ✓ WIRED | Dual-writes couchInTonight + legacy couchSeating; firestore.rules 4th UPDATE branch permits both keys + 4 attribution fields |
| Counter-chain bump | counterChainDepth ≤ 3 | rules branch 5 in firestore.rules | ✓ WIRED | Server-side cap enforced; client UI also early-returns at depth ≥3 |
| sw.js v34.1 | couchtonight.app installed PWAs | service worker activate event | ✓ WIRED | Confirmed live at couchtonight.app/sw.js per 14-UAT.md session-blocker resolution |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| `renderCouchViz()` V5 roster | state.members + state.couchInTonight | family-doc onSnapshot | ✓ Yes — eligible roster filter + per-member pill state | ✓ FLOWING |
| `getTierOneRanked(couchMemberIds)` | state.titles + state.couchMemberIds + t.queues | live state from titlesRef onSnapshot | ✓ Yes — intersection across couch member queues | ✓ FLOWING |
| `renderFlowAPickerScreen()` | t1/t2/t3 from aggregators | calls 14-03 aggregators against state.couchMemberIds | ✓ Yes — real ranked candidates | ✓ FLOWING |
| `renderFlowAResponseScreen()` | live tally (ins/rejects/drops) | state.intents from intentsRef onSnapshot | ✓ Yes — re-renders on every snapshot tick via maybeRerenderFlowAResponse | ✓ FLOWING |
| `renderFlowBStatusScreen()` | counter rows + auto-convert countdown + all-No banner | state.intents + Date.now() vs proposedStartAt | ✓ Yes — re-renders via maybeRerenderFlowBStatus | ✓ FLOWING |
| Tile face X-want-it pill | t.queues per-member-keyed map | state.titles via titlesRef onSnapshot | ✓ Yes — micro-avatars + +N overflow computed from real queue membership | ✓ FLOWING |
| Detail modal Reviews section | t.reviews | TMDB API lazy-fetch + per-title cache (castFetchedAt/reviewsFetchedAt) | ✓ Yes — real TMDB community reviews | ✓ FLOWING |

No HOLLOW or DISCONNECTED artifacts identified. All rendered surfaces consume live state, not hardcoded defaults.

### Behavioral Spot-Checks

Auto-mode + production-deployed code; `node --check` passes per all SUMMARY files. Live behavioral checks against couchtonight.app are covered by the user's 4-step approved-deploy UAT (V5 visual + multi-device proxy + downstream contract regression). Remaining behavioral verification = the 44 pending tests in 14-UAT.md, all of which require physical-device + multi-device sessions (escalated to human_verification).

| Behavior | Command/Source | Result | Status |
| -------- | -------------- | ------ | ------ |
| All declared artifacts exist | grep across js/app.js + queuenight/functions/index.js + queuenight/firestore.rules + sw.js + changelog.html + css/app.css + app.html | All targets found at expected lines | ✓ PASS |
| sw.js CACHE = v34.1-roster-control on production | UAT session-blocker resolution + approved-deploy signal | couchtonight.app/sw.js serves correct CACHE | ✓ PASS |
| 14-04 cushion-grid surface fully removed (no zombie code) | grep -E "function renderCouchAvatarGrid|window.claimCushion |COUCH_MAX_SLOTS" | All return 0 (per 14-10 SUMMARY verification table) | ✓ PASS |
| Bug A — legacy .who-card removed from app.html | grep `<div class="who-card"` in app.html | Only a marker comment remains (no live element) | ✓ PASS |
| 7 D-12 push categories present in all 3 maps | grep flowAPick + Tonight's pick chosen across queuenight/functions/index.js + js/app.js | 7 keys in NOTIFICATION_DEFAULTS + 7 in DEFAULT_NOTIFICATION_PREFS + 7 in NOTIFICATION_EVENT_LABELS | ✓ PASS |
| V5 surface rendering on production | User's approved-deploy 4-step UAT 2026-04-26 | Tests 1/3/5/24 in 14-UAT.md flipped to pass | ✓ PASS |
| Cross-repo deploy ritual completed | UAT session-blocker resolution | queuenight CFs (us-central1) + queuenight firestore:rules + couch hosting all live | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| DECI-14-01 | 14-01 | Strict member-aware already-watched filter + rewatch override + invitation bypass | ✓ SATISFIED | js/app.js:7647 isWatchedByCouch; commits 8ddb347 + 5a9ea75 |
| DECI-14-02 | 14-03 | 3-tier candidate filter T1/T2/T3 + most-restrictive-wins T3 visibility | ✓ SATISFIED | js/app.js:7727-7822 4 functions; commit ccf600f |
| DECI-14-03 | 14-02 | Per-member queue polish (DR-2 reframe): toast + Add-tab insertion + iOS DnD | ✓ SATISFIED (code) / ? NEEDS HUMAN (iOS DnD UAT) | commits 2e1ca4b + 2b670d2; iOS Safari touch-DnD UAT deferred |
| DECI-14-04 | 14-05 | Tile redesign + openTileActionSheet + detail-modal cast/reviews + carry-over .detail-close fix | ✓ SATISFIED | commits f90155d + d1762e1 + 09db482 + 6d630c4; carry-over bug closed by pre-existing CSS at :1540 |
| DECI-14-05 | 14-05 | Vote-mode preserved in Add tab via Catch-up CTA | ✓ SATISFIED | commit 6d630c4 |
| DECI-14-06 | 14-04 → 14-10 | Couch viz on Tonight tab; **REPLACED** by V5 roster-control (sketch 003) per 14-10 gap-closure | ✓ SATISFIED (V5 surface) | 14-04 cushion grid commits 1234624+3a561bd+cb31155 then OBSOLETED by 14-10 commits efd2739+9569c33+0f45602+5f17ebc+603ac28+860dfea+81c6700+320ea81; user-confirmed approved-deploy 2026-04-26 |
| DECI-14-07 | 14-07 | Flow A: group rank-pick + push-confirm + counter-chain + reject-majority + quorum convert | ✓ SATISFIED (code) / ? NEEDS HUMAN (multi-device UAT) | commit d97a81e |
| DECI-14-08 | 14-08 | Flow B: solo-nominate + counter-time + auto-convert + all-No + deep-link routing | ✓ SATISFIED (code) / ? NEEDS HUMAN (multi-device UAT) | commit af168f1 |
| DECI-14-09 | 14-06 | Extend intents collection (DR-1) — 4 flow values + counterChainDepth + flow-aware CFs | ✓ SATISFIED | couch commits 3c6b4b9+9a09872; queuenight CFs deployed (per UAT session-blocker resolution); CF logs show 11 Flow A/B push-type references live |
| DECI-14-10 | 14-09 | Hybrid onboarding: changelog v34 entry + 3 anchored tooltips + seenTooltips Firestore gate | ✓ SATISFIED (code) / ? NEEDS HUMAN (tooltip first-render UAT) | commits 8a36336+ae7f0c0+9132144 |
| DECI-14-11 | 14-09 | 5 D-11 empty states with action-leading CTAs | ✓ SATISFIED (code) / ? NEEDS HUMAN (visual UAT) | commit fdcb9dc |
| DECI-14-12 | 14-09 | 7 push categories in 3 places per DR-3 | ✓ SATISFIED | commit e572467 + queuenight functions deployed; CFs use all 7 eventTypes |
| DECI-14-13 | 14-09 + 14-10 | sw.js CACHE bumped + v34/v34.1 deployed | ✓ SATISFIED | sw.js bumped to v34.1-roster-control; deployed to couchtonight.app via approved-deploy 2026-04-26 |

**Coverage:** 13/13 DECI-14-* requirements addressed in plans + verifiable in code; 5/13 also have pending HUMAN-UAT for visual/multi-device behavioral confirmation. Zero ORPHANED requirements.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `changelog.html` | 70 | `[deploy date YYYY-MM-DD]` placeholder remains in v34 article | ℹ️ Info | Cosmetic — production users see literal placeholder string until follow-up tiny patch deploy. Recommended: edit + redeploy as `bash scripts/deploy.sh 34.1.1-changelog-date` (mentioned in 14-09-SUMMARY.md open follow-ups + 14-10-SUMMARY.md follow-ups). Does NOT block phase goal. |
| `js/app.js` `window.sendCouchPing` | ~13113 | Path C stub — toast + Sentry breadcrumb only; no real push fan-out yet | ℹ️ Info (Documented stub) | Long-press gesture ships the visible UX win + captures Sentry telemetry under category='couch-ping' to size demand. Real push fan-out deferred to a follow-up plan that adds a `couchPing` event type to NOTIFICATION_DEFAULTS + NOTIFICATION_EVENT_LABELS + onIntentCreated fan-out branch. Documented in 14-10-SUMMARY.md known stubs + STATE.md polish backlog. Phase 14 goal does NOT require this — it is additive UX polish. |
| `queuenight/functions/index.js` + `queuenight/firestore.rules` | (whole files) | Uncommitted in source control — queuenight has no .git on user's machine | ⚠️ Warning (Tracked) | Pattern repeated across 14-06, 14-09, 14-10 deviations. Functional behavior unaffected — files were edited in-place + deployed via firebase deploy. **Code IS live in production** per UAT session-blocker resolution + approved-deploy signal. Auditing risk only. STATE.md tracks remediation: either initialize git in queuenight/ or codify "couch repo holds audit trail; queuenight is deploy-only" in CLAUDE.md. |
| `js/app.js` Phase 12 friendly-UI maps | :128-155 | NOTIF_UI_TO_SERVER_KEY / NOTIF_UI_LABELS / NOTIF_UI_DEFAULTS NOT updated with 7 new D-12 keys | ⚠️ Warning (Documented DR-3 override) | 7 D-12 push toggles surface ONLY in legacy NOTIFICATION_EVENT_LABELS Settings UI per the explicit DR-3 follow-up override locked at /gsd-plan-phase 14 (2026-04-25). Reason: avoid dual-Settings-screen collision RESEARCH §5 flagged. Friendly-UI parity captured as polish backlog. **User decision** — not a bug. |
| Legacy `couchSeating` dual-write window | persistCouchInTonight | Dual-writes both new couchInTonight + legacy couchSeating shape | ℹ️ Info (Migration window) | Intentional 1-2 week backward-compat window for v33/v34.0 PWAs to read legacy field during the V5 rollout. Drop in follow-up plan after cache cycle elapses. Tracked in 14-10-SUMMARY.md migration window note + STATE.md polish backlog. |

**No 🛑 Blocker anti-patterns found.** All ⚠️ Warnings are user-acknowledged tracked deferrals; ℹ️ Info items are intentional design choices.

### Human Verification Required

The phase ships 50 UAT tests in `14-UAT.md`. After 14-10 V5 deploy, 6 are passing (Tests 1, 2, 3, 4, 5, 24). The remaining 44 require physical-device or multi-device verification and are NOT blockers for the code-complete phase status — they are post-deploy regression UAT. Per Phase 14 pattern (4 prior deferrals locked across 14-02, 14-04, 14-07, 14-08, 14-09), these are bundled into a single batch UAT pass against production v34.1.

#### 1. iOS Safari touch-DnD on Library queue (14-02 Task 3)

**Test:** On installed iOS Safari PWA, open Library → My Queue (≥3 titles in queue). Long-press + drag a queue row to reorder it.
**Expected:** Drag works with touch input; new order persists across refresh. If touch-DnD doesn't work, fallback is Sortable.js per documented contingency.
**Why human:** Requires physical iOS device + installed PWA (touch-DnD behavior differs across browser mode vs standalone PWA mode).

#### 2. Multi-device Flow A end-to-end (14-07 Task 5)

**Test:** 2 physical devices signed in as different family members. Device A claims couch + opens Flow A picker → selects title → roster screen → Send Picks. Device B receives `flowAPick` push → response screen → tap In/Reject/Drop/Counter. Iterate counter-chain to depth 3 → verify cap. Trigger reject-majority → verify Pick #2 retry. Quorum convert → verify watchparty doc + Phase 11-05 lobby opens.
**Expected:** Push lands ≤5s on iOS PWA; live tally updates without manual refresh; counterChainDepth caps at 3 server-side; quorum convert creates watchparty + opens lobby.
**Why human:** Multi-device push delivery via real Firebase production CFs + iOS PWA standalone push activation + real-time Firestore rsvps tally + Phase 11-05 lobby handoff all require physical hardware.

#### 3. Multi-device Flow B end-to-end (14-08 Task 5)

**Test:** Device A submits Flow B nominate (NOW+20min). Device B receives `flowBNominate` push → counter-suggest NOW+30min. Device A status screen updates → Accept counter. Device B taps Join → ins count = 1. Wait until T-15min → `watchpartyTick` CF auto-converts → `flowBConvert` push lands → intent.status='converted'. Test all-No edge case separately. Test ?intent= deep-link routing.
**Expected:** Push delivery ≤5s; counter-time chain works; T-15min auto-convert fires within 5-min CF cadence; all-No banner appears + auto-cancels with cancelReason='all-no'; ?intent= deep-link routes to correct screen + strips param via history.replaceState.
**Why human:** Multi-device + 5-min CF cadence + iOS PWA standalone push + real-time updates require physical hardware + waiting period.

#### 4. Tooltip + 5 empty-states + 7 push toggles UAT (14-09)

**Test:** Fresh sign-in → verify 3 D-10 tooltips fire on first encounter (couchSeating on Couch viz first render, tileActionSheet on first tile tap, queueDragReorder on first Library/myqueue visit). Sign out + back in → verify NONE re-fire. Visit each of 5 D-11 empty-state surfaces → verify copy + CTAs match CONTEXT.md table. Open Settings → Notifications → verify 7 new D-12 toggles render with BRAND-voice labels; toggle one off + trigger corresponding flow → verify push does NOT arrive.
**Expected:** All tooltips one-shot via seenTooltips Firestore gate; empty states render correctly; push toggles take effect against production CFs.
**Why human:** Visual UI rendering + Firestore round-trip across sign-out/sign-in + push toggle effect on real push delivery require physical device + production CFs + multi-session.

#### 5. Remaining 14-UAT.md tests (Tests 6-23, 25-50 — 44 tests pending)

**Test:** Run the full 14-UAT.md test suite against couchtonight.app v34.1 production deploy. 6 tests have already passed (1, 2, 3, 4, 5, 24); 44 remain pending.
**Expected:** Each test passes per its `expected` block in 14-UAT.md.
**Why human:** Physical multi-device sessions + iOS PWA + Firestore round-trips + push delivery + waiting periods — none is programmatically verifiable from the developer machine.

### Gaps Summary

**No goal-blocking gaps.** Phase 14's underlying user goal — "couch-centered, conversation-first decision ritual replacing the vote-prominent Tonight tile, with dual flows (rank-pick + nominate), backed by extended intents primitive + push wiring + onboarding/empty-states + production deploy" — is fully delivered:

- All 13 DECI-14-* requirements have implementation evidence in code AND are deployed to production
- The V5 redesign (14-10) successfully closed the 3 UAT gaps from the original 14-04 cushion-grid surface — user confirmed via approved-deploy 4-step UAT 2026-04-26
- Cross-repo deploy ritual is COMPLETE (queuenight CFs in us-central1 + queuenight firestore:rules with 4th UPDATE branch + couch hosting at couch-v34.1-roster-control)
- The downstream contract `state.couchMemberIds` is preserved across the 14-04→14-10 migration so 14-01 / 14-03 / 14-07 all keep working unchanged

**What remains is post-deploy HUMAN-UAT** (not blockers, not gaps). 44 of 50 tests in 14-UAT.md await physical-device sessions. Per Phase 14's deliberate batch-UAT-and-deploy pattern (4 prior deferrals locked across 14-02/14-04/14-07/14-08/14-09), this is an explicit user-confirmed deferral pattern, not an oversight. The orchestrator should persist the human_verification block to a HUMAN-UAT.md follow-up file per the workflow.

**Minor follow-ups (non-blocking, tracked):**
- changelog.html v34 article still has `[deploy date YYYY-MM-DD]` placeholder — recommend a tiny patch deploy
- queuenight/ git initialization or convention codification (auditing-only impact)
- Drop legacy couchSeating dual-write after 1-2 week PWA cache cycle elapses (tracked in 14-10 migration window note)
- DR-3 friendly-UI parity for the 7 new D-12 push toggles (deferred per user override; polish backlog)
- couch-ping push channel wiring for window.sendCouchPing (deferred per Path C decision; polish backlog)

### Recommendation

**Phase 14 goal achieved at the code + production-deploy level.** Status flips from "code-complete pending v34 deploy" to "**SHIPPED with HUMAN-UAT pending**". The orchestrator should:

1. **Mark the phase as SHIPPED** (not "blocked") in ROADMAP.md Progress table — code is in production, V5 surface is verified by user, dual flows + extended intents + push categories all wired and live
2. **Persist the human_verification block** to `.planning/phases/14-decision-ritual-core/14-HUMAN-UAT.md` (or merge into existing 14-UAT.md as a tracking checkpoint)
3. **Do NOT trigger a gap-closure cycle** — there are no goal-blocking gaps; only deferred multi-device verification
4. **Apply the 5 minor non-blocking follow-ups** as polish backlog tracked in STATE.md (already there per 14-10 SUMMARY)
5. **Proceed to Phase 14 close-out + next phase planning** — Phase 14 is functionally complete and the human_verification items run in parallel with subsequent phase work

Phase 14 represents the largest single phase shipped to date in the GSD workflow on this project (10 plans, 13 requirements, ~25-30 atomic commits across 2 repos, V5 redesign + 4-step UAT closure all in 2 days), and it landed cleanly with 0 blocker anti-patterns + 0 goal-blocking gaps + complete cross-repo production deploy.

---

_Verified: 2026-04-26T20:45:00Z_
_Verifier: Claude (gsd-verifier)_
