---
status: testing
phase: 14-decision-ritual-core
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md, 14-05-SUMMARY.md, 14-06-SUMMARY.md, 14-07-SUMMARY.md, 14-08-SUMMARY.md, 14-09-SUMMARY.md
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T20:29:07Z
---

## Current Test

[V5 roster-control deployed 2026-04-26 (couch-v34.1-roster-control on couchtonight.app + queuenight firestore:rules 4th UPDATE branch live). 4-step UAT passed (cold-start V5 visual + multi-device proxy + downstream contract regression). Tests 1, 3, 5, 24 flipped to pass; all 3 gaps resolved. Resume point: **Test 6 (Already-claimed cushion toast)** — note that Test 6 was authored against the legacy 14-04 cushion grid; under V5, the equivalent is "tap a pill that's already IN flips it OUT (vacate semantics)" rather than a denial toast, since proxy-fill is now a feature not a bug. Adapt the test wording or supersede with a V5-flavored variant when running.]

## Tests

### 1. Cold Start Smoke Test
expected: Open the app in a fresh browser session (or fully close + reopen the installed PWA). Sign in. The app shell boots without errors. Family + members + titles hydrate. Tonight tab loads with the new Couch viz at the top, then existing surfaces below.
result: pass
note: "App booted v34 cleanly after force-unregister of stale sw. Couch viz hero + headline + sub-count + 1st claim all rendered. UX issues with the rendered surface logged against Test 2/3/5/24 via composite issue below — not a cold-start failure."

### 2. Couch viz hero + headline render (14-04)
expected: Tonight tab leads with the C-sectional couch icon (mark-512.png) at top with a subtle warm halo + drop shadow. Below it: Fraunces "On the couch tonight" headline + italic Instrument Serif sub-count ("N of M here" or "Tap a seat to claim it" when nobody is seated yet).
result: pass
note: "Hero + Fraunces headline + italic '1 of 7 here' sub-count all rendered correctly per spec. Aesthetic critiques rolled up into composite Issue #1 in Gaps."

### 3. Couch viz avatar grid layout (14-04)
expected: Avatar grid below the headline shows cells matching couchSize = max(2, totalMembers, claimedCount), capped at 10. On phone width it wraps 5×2; on desktop ≥768px it lays out 10×1. Each empty cell is a dashed amber circle with a ＋ glyph.
result: pass
note: "V5 redesign deployed 2026-04-26 (sketch 003 V5 — Roster IS the control) replaces the cushion grid with a wrap-flex roster of pills, one per eligible roster member. Eliminates the '7 blank spots' sprawl on desktop because OUT pills are sized to their content, not pre-rendered to fill a fixed grid. See .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md (Task 3, commit 9569c33; Task 4 CSS commit 0f45602). The original test wording above is now historic — the V5 surface contract is documented in the SUMMARY."
severity: major

### 4. Claim a cushion (14-04)
expected: Tap an empty cell — it flips to a filled member-color circle showing your initial; "me" cell gets a warm-amber outline. Sub-count updates to reflect the new claim.
result: pass
note: "First claim worked — purple N circle + 'NAHDER' label rendered with amber outline + sub-count updated to '1 of 7 here'."

### 5. Vacate own cushion (14-04)
expected: Tap your own claimed cell — it flips back to dashed empty; sub-count decrements.
result: pass
note: "V5 redesign deployed 2026-04-26 makes vacate the same gesture as claim — tap your own pill flips its state (in→out or out→in). No hidden affordance because the gesture vocabulary is now uniform across self-claim, proxy-fill, and vacate. Verified by user under 4-step UAT. See .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md (Task 3 toggleCouchMember handler, commit 9569c33)."
severity: major

### 6. Already-claimed cushion toast (14-04)
expected: Tap a cell already claimed by someone else — toast appears: "That seat is already claimed". Cell is unchanged.
result: [pending]

### 7. Couch state persists across refresh (14-04)
expected: Claim a seat, then hard-refresh the page. After reload the seat is still yours (couchSeating round-trips through Firestore family-doc snapshot).
result: [pending]

### 8. Reduced-motion respected on couch viz (14-04)
expected: With iOS Settings → Accessibility → Reduce Motion ON (or browser equivalent), empty-cell pulse animation stops; hover scale on cells stops.
result: [pending]

### 9. Already-watched filter on Library queue (14-01)
expected: Mark a title as watched (or vote No on a queued title). It disappears from Library "My Queue" filter and from "Unwatched" / "For me" Library filters across the active couch.
result: [pending]

### 10. Already-watched filter on Tonight + Spin + Swipe (14-01)
expected: Watched titles do not appear as Tonight matches/considerable, do not show up in Spin candidate pool, and do not appear during Swipe/Vote mode.
result: [pending]

### 11. Yes-vote queue auto-add toast (14-02)
expected: Vote Yes on a title that wasn't in your queue. Toast appears: 'Added "<title>" to your queue'. Title now appears in Library → My Queue. Voting Yes again on the same title (or another member's vote arriving via snapshot) does NOT re-fire the toast on your device.
result: [pending]

### 12. Add-tab insertion lands in My Queue (14-02)
expected: Use the Add tab search "+ Pull up" OR manual-entry modal OR Add-tab discovery row OR detail-modal "more like this" → the new title appears at the bottom of your personal queue. Trakt-sync / first-run pack imports do NOT auto-populate your queue.
result: [pending]

### 13. Tile face redesign — "X want it" pill + Trailer btn, no Vote (14-05)
expected: Tile face shows: "X want it" pill with up to 3 micro-avatars (initial-letter + member-color) plus +N overflow chip when more queued. ▶ Trailer button visible only when title has a trailer key. NO Vote button on the tile face.
result: [pending]

### 14. Tile body tap opens new action sheet (14-05)
expected: Tap on the tile body (not the ⋯ button) — opens an action sheet with 4 buckets: 🎬 Watch tonight, 📅 Schedule for later, 💭 Ask family, 🗳 Vote. Below a divider: ℹ Show details, ⋯ More options.
result: [pending]

### 15. Detail modal with cast + community reviews (14-05)
expected: From "Show details" entry → detail modal opens with Trailer + Providers + Synopsis + Cast scroller (existing) AND a new Reviews section with up to 3 TMDB community reviews (author + optional rating + 360-char-truncated body). Re-opening the same modal does not re-fetch.
result: [pending]

### 16. Detail-modal ✕ stays in view on long content (14-05 carry-over bug)
expected: Open detail modal on a title with long body content (long synopsis + cast + 3 reviews). Scroll the modal body. The ✕ close button stays pinned in the top corner — does NOT scroll out of view. iOS safe-area inset keeps it clear of the notch.
result: [pending]

### 17. "Catch up on votes" CTA on Add tab (14-05 / D-05)
expected: When you have ≥10 unvoted unwatched titles, the Add tab shows a "Catch up on votes (N)" CTA card at the top with a button that launches Vote/Swipe mode. The CTA disappears when unvoted count drops below 10.
result: [pending]

### 18. Tooltip — Couch viz first render (14-09)
expected: On first sign-in or first time you visit Tonight after the v34 update, an anchored tooltip appears above the first empty cushion: "Tap a cushion to seat yourself." Tip dismisses on next tap anywhere.
result: [pending]

### 19. Tooltip — Tile action sheet first open (14-09)
expected: First time you tap a tile body to open the new action sheet, an anchored tooltip appears: "These are your options for this title." Dismisses on next tap.
result: [pending]

### 20. Tooltip — Library queue first render (14-09)
expected: First time you open Library → My Queue after the update, a tooltip appears below the first queue row: "Drag to reorder your queue." Dismisses on next tap.
result: [pending]

### 21. Tooltips don't re-fire on second login (14-09)
expected: Sign out and back in (or fully reload). None of the three D-10 tooltips re-appear — the per-tooltip Firestore flag (members/{id}.seenTooltips) suppresses them.
result: [pending]

### 22. Empty state (a) — brand-new family / 0 titles (14-09)
expected: With a fresh family that has 0 titles, Tonight tab shows the D-11 (a) card: "Your couch is fresh / Nothing in queue yet. What should be the first?" with two CTAs (Add tab + Connect Trakt).
result: [pending]

### 23. Empty state (b) — empty personal queue (14-09)
expected: With My Queue empty, Library → My Queue shows: "Your queue is empty / Vote on a few titles to fill it up." with an "Open Vote mode" CTA that launches Swipe/Vote.
result: [pending]

### 24. Empty state (c) — Flow A no couch + cushion-glow (14-09)
expected: With 0 cushions claimed on the couch viz, Flow A entry shows: "Who's on the couch tonight? / Tap to seat yourself + invite family." with a "Find a seat" CTA. Empty couch cushions in the viz pulse warm-amber via cushion-glow animation (animation respects prefers-reduced-motion).
result: pass
note: "V5 redesign deployed 2026-04-26 — the dashed-pill roster IS the empty state (Bug B fix collapsed the redundant Find-a-seat CTA card; Bug A removed legacy who-card double-render). With 0 pills claimed, the roster shows N dashed-OUT pills + tally bar 'Tap who's watching' sub-line — far more informative than a generic CTA. Family-doc onSnapshot now also drives renderFlowAEntry so empty-state branches react to claim/vacate. cushion-glow pulse keyframe was deleted (no longer applicable to V5 surface). See .planning/phases/14-decision-ritual-core/14-10-SUMMARY.md (Bug A commit 603ac28; Bug B commit 860dfea; Task 1 onSnapshot wiring commit efd2739)."
severity: major

### 25. Flow A entry CTA appears under Couch viz (14-07)
expected: With at least one cushion claimed, Tonight tab shows a CTA card directly below the Couch viz: "Pick a movie for the couch" with member-count line and an "Open picker" button.
result: [pending]

### 26. Flow A picker — 3-tier list with T3 toggle (14-07)
expected: Tap "Open picker" — modal opens with Tier 1 ("everyone wants this"), Tier 2 ("some couch interest"), and a Tier 3 collapse toggle ("off-couch picks"). Tap toggle → T3 expands. If account/family/group preferences set showT3:false, the toggle is absent entirely (not just collapsed).
result: [pending]

### 27. Flow A roster screen + proxy-confirm (14-07)
expected: Pick a title → roster screen shows each couch member with avatar + name + status. Tap a member to mark them in-person ("✓ in"). The "Send picks" button shows the count of pushes that will be sent to unconfirmed members.
result: [pending]

### 28. Flow A picker — Send Picks creates intent (14-07)
expected: Tap "Send picks" — a rank-pick intent is written to Firestore with expectedCouchMemberIds + counterChainDepth=0. Picker is auto-opted-in; proxy-confirmed members have rsvps[mid].state='in' pre-seeded with proxyConfirmedBy audit field. Picker transitions to the response screen.
result: [pending]

### 29. Flow A multi-device push delivery (14-07)
expected: On a second device signed in as an unconfirmed couch member, a flowAPick push lands within ~5s on iOS PWA: "<picker> picked <title> for tonight. In, reject, or drop?"
result: [pending]

### 30. Flow A recipient response (in/reject/drop) (14-07)
expected: On the recipient's device, tap In / Reject / Drop — the picker's status screen updates the live tally (ins/rejects/drops) without manual refresh. "You said: ${state}" badge appears on recipient view.
result: [pending]

### 31. Flow A counter-nom chain + 3-cap (14-07)
expected: Recipient taps Reject + counter → picker opens, picks a different title → submitCounterNom writes rsvps[me].state='reject' + counterTitleId, increments counterChainDepth atomically. Cap at 3: 4th counter attempt shows toast "Counter chain cap reached" and the picker UI shows "options on the table" notice at depth 3. Server-side rule (14-06) also denies a 4th counter.
result: [pending]

### 32. Flow A reject-majority retry (Pick #2) (14-07)
expected: When rejects > expected.length / 2, picker's response screen shows: "Reject majority hit. Pick another title (1 retry then expire)" + "Pick #2" button. Tap → picker re-opens with the rejected title filtered out of all 3 tiers. If the second pick also gets rejected, it expires naturally at 11pm (no third retry).
result: [pending]

### 33. Flow A quorum convert → watchparty (14-07)
expected: With picker + ≥1 in, picker taps "Start watchparty (N in)". A watchparty doc is created with convertedFromIntentId. Intent.status flips to 'converted' with convertedToWpId set. Phase 11-05 lobby flow opens (openWatchpartyLive).
result: [pending]

### 34. Empty state (d) — all-watched picker + rewatch reveal (14-09)
expected: When T1 + T2 (and T3 if visible) are all empty post-filter, picker shows: "You've seen everything in queue / Revisit a favorite or expand discovery?" with "Show rewatch options" + "Discover more" CTAs. Tap "Show rewatch options" → already-watched titles reappear in the tier list. Closing and reopening the picker resets the flag.
result: [pending]

### 35. Empty state (e) — reject-exhausted → Open Flow B (14-09)
expected: When rejectMajority + counterDepth >= 3, picker response screen shows: "🎲 No alternative pick / Try again or anyone nominate?" with "Cancel for tonight" + "Open Flow B" CTAs. Tap "Open Flow B" → closes picker and opens Flow B nominate UI prefilled with the same titleId.
result: [pending]

### 36. Flow B entry — "Watch with the couch?" (14-08)
expected: Tap a tile body → action sheet shows "💭 Ask family" entry. The full action sheet (⋯ button) and the tile-action sheet both expose a "Watch with the couch?" entry that routes to openFlowBNominate.
result: [pending]

### 37. Flow B nominate UI (14-08)
expected: Open Flow B → modal shows title header, datetime-local input defaulted to 8pm tonight (or now+1hr if past 8pm), 200-char optional note textarea, Cancel + "Send nomination" buttons.
result: [pending]

### 38. Flow B nominate creates intent + push fan-out (14-08)
expected: Submit a Flow B nomination → createIntent({flow:'nominate',...}) succeeds. Status screen opens for the nominator with live tally. Other family-member devices receive a flowBNominate push: "<nominator> wants to watch <title> at <time>. Join, counter, or pass?"
result: [pending]

### 39. Flow B recipient response — Join / Counter / Decline (14-08)
expected: Recipient taps push (or opens via deep-link) → response screen with proposed time, optional note, and three buttons: Join @ proposed time / Counter-suggest / Decline. Each writes the appropriate rsvps[me].state to Firestore.
result: [pending]

### 40. Flow B counter-time chain (14-08)
expected: Recipient taps Counter-suggest → inline counter-time picker prefilled with proposed-time + 1hr. Submit writes rsvps[me]={state:'maybe', counterTime, note} AND increments counterChainDepth. Cap at 3 enforced both client and server side.
result: [pending]

### 41. Flow B nominator status — counter rows + Accept/Reject/Compromise (14-08)
expected: Nominator's status screen updates live with counter rows. Each row has Accept / Reject / Compromise buttons. Accept → proposedStartAt updates to counter time + nominator's rsvps[me].state='in'. Reject → counter clears, recipient can re-respond. Compromise → window.prompt prefilled with midpoint timestamp; submitted value validated for future-time and written to proposedStartAt.
result: [pending]

### 42. Flow B all-No edge case auto-cancel (14-08)
expected: When all recipients Decline (declines.length === recipientCount && ins.length === 0), nominator's status screen shows the all-No banner with a "Cancel nomination" button. Tap → status='cancelled' with cancelReason='all-no'.
result: [pending]

### 43. Flow B T-15min auto-convert (14-08)
expected: With ≥1 in RSVP and proposedStartAt within 15 minutes, the watchpartyTick CF (5-min cadence) creates a watchparty doc with convertedFromIntentId. flowBConvert push lands on opted-in members: "<title> in 15 min — head to the couch." Intent.status flips to 'converted'. Nominator's status screen auto-closes after 1.5s grace.
result: [pending]

### 44. Deep-link routing — ?intent=<id> (14-08)
expected: Tap a push notification on a fresh app launch (or paste a ?intent=<id> URL into the address bar). App opens directly to the correct screen — Flow A response screen for rank-pick intents, Flow B status screen for the nominator on Flow B intents, Flow B response screen for recipients. After routing, ?intent= is stripped from the URL via history.replaceState so refresh doesn't re-trigger.
result: [pending]

### 45. iOS Safari touch-DnD on Library queue (14-02 deferred)
expected: On installed iOS Safari PWA, open Library → My Queue. Long-press + drag a queue row to reorder it. The drag works with touch input; new order persists across refresh. (If touch-DnD doesn't work on iOS Safari, fallback is to load Sortable.js per the documented contingency.)
result: [pending]

### 46. iOS PWA tap targets on couch grid (14-04 deferred)
expected: On installed iOS Safari PWA at iPhone-SE width (375px), seat cells are at least ~75px wide (≥44pt minimum tap target). Tap latency is acceptable. Pulse animation on empty cells doesn't visibly drain battery.
result: [pending]

### 47. Settings — 7 new push toggles render (14-09)
expected: Open Settings → Notifications. The 7 new D-12 toggles are present with BRAND-voice labels: "Tonight's pick chosen", "Couch voted on your pick", "Your pick was passed on", "Watch with the couch?", "Counter-time on your nom", "Movie starting in 15 min", "Tonight's pick expiring". Each has a hint description below.
result: [pending]

### 48. Push toggle off → push suppressed (14-09)
expected: Toggle one of the 7 new push categories OFF, then trigger the corresponding intent flow. Push does NOT arrive on the toggled-off device.
result: [pending]

### 49. v34 changelog entry visible (14-09)
expected: Open the changelog (e.g. via /about → changelog). The v34 article appears at the top (above v32) with tagline "A new way to pick what to watch — together." and 4 highlight items: The couch / Two flows / Tile redesign / Your queue.
result: [pending]

### 50. sw.js v34 CACHE bump invalidates installed PWA (14-09)
expected: With v34 deployed, an existing installed PWA (already running v33.3) refreshes online → service worker activates new CACHE (couch-v34.0-decision-ritual). On next app open, all the new v34 surfaces are visible without manual cache clear.
result: [pending]

## Summary

total: 50
passed: 6
issues: 0
pending: 44
skipped: 0
blocked: 0

## Gaps

- truth: "Couch viz hero is the single source of truth for who's on the couch — legacy who-card pill rail must not double up below it."
  status: resolved
  resolved_by: "14-10 Task 6a (commit 603ac28) — Bug A removed legacy .who-card block from app.html line 334-337, dropped orphan applyModeLabels who-title-label set, deleted renderTonight who-list emitter, rewired sticky who-mini IIFE from .who-card → #couch-viz-container so the sticky mini bar still works."
  reason: "User reported: 'Still has the who is on the couch below it' — the new viz and the old chip rail both render on Tonight."
  severity: major
  test: 1
  artifacts:
    - app.html:334 — `<div class="who-card">` rendered unconditionally; never removed/hidden by Phase 14-04
    - js/app.js:4460 — applyModeLabels still pushes copy into #who-title-label
    - css/app.css:1645 — .who-card styling still active
  root_cause: "Phase 14-04 added couch viz ABOVE the legacy Phase 11 who-card but never deleted/hid the legacy element. Two surfaces now show the same roster simultaneously."
  fix_direction: "Remove `.who-card` block from app.html Tonight tab (lines 334-337). Drop now-orphan applyModeLabels who-title-label set. Keep .who-card CSS for now in case any other surface uses it (grep first)."
  missing: []

- truth: "After a member claims a seat, the 'Find a seat' empty-state CTA should disappear immediately — not wait for an unrelated snapshot."
  status: resolved
  resolved_by: "14-10 Task 6b (commit 860dfea) collapsed the renderFlowAEntry empty-state-c branch from a 14-line CTA card + cushion-glow forEach to a single-line clearout (V5 dashed-pill roster IS the empty state) + 14-10 Task 1 (commit efd2739) added renderFlowAEntry call inside family-doc onSnapshot block so empty-state branches react immediately to claim/vacate. Also: V5 redesign Task 3 (commit 9569c33) replaced the entire cushion-grid surface so the legacy CTA card has no remaining attach point."
  reason: "User claimed seat (purple N rendered, sub-count flipped to '1 of 7 here'), but the 🛋 + 'Who's on the couch tonight?' + 'Find a seat' card stayed on screen."
  severity: major
  test: 24
  artifacts:
    - js/app.js:4131-4150 — family-doc onSnapshot hydrates state.couchMemberIds + calls renderCouchViz() but NOT renderFlowAEntry()
    - js/app.js:13994-14014 — renderFlowAEntry empty-state branch (couchSize < 1)
    - js/app.js:4155-4168 — intents onSnapshot DOES call renderFlowAEntry, which is why it hasn't been caught (any unrelated intent write would have flipped it)
  root_cause: "renderFlowAEntry is gated correctly but only re-rendered by the intents snapshot. The family-doc snapshot updates state.couchMemberIds without re-running it, so the dependent CTA goes stale until a separate intent write fires."
  fix_direction: "Add `if (typeof renderFlowAEntry === 'function') renderFlowAEntry();` immediately after the renderCouchViz() call at js/app.js:4144 inside the family-doc onSnapshot block."
  missing: []

- truth: "The couch viz should feel streamlined — not a row of empty placeholders to scan past on a desktop viewport."
  status: resolved
  resolved_by: "14-10 Task 3 (commit 9569c33) + Task 4 (commit 0f45602) — V5 roster pills replace cushion grid; design-direction decision = sketch 003 V5 winner (Roster IS the control). renderCouchAvatarGrid + claimCushion + persistCouchSeating + COUCH_MAX_SLOTS all deleted; replaced with renderCouchViz emitting .roster wrap-flex of .pill elements (one per eligible roster member) + tally bar + 3 visibility-gated bulk-action links. .pill.in/.pill.out/.pill.me CSS gives unified gesture vocabulary across self-claim, proxy-fill, and vacate (tap own pill flips state — no hidden affordance). Long-press 700ms triggers sendCouchPing. cushion-glow pulse keyframe deleted (no longer applicable to V5 surface)."
  reason: "User reported: '7 blank spots to open which just clutters it. Should rethink how this works so it's streamlined — like Apple did it.' Also: 'I can only click once' (no obvious vacate / re-claim affordance from the claimed-state UI)."
  severity: major
  test: 3
  artifacts:
    - js/app.js:12964 — `couchSize = Math.min(COUCH_MAX_SLOTS, Math.max(2, totalMembers, claimedCount))` produces 8-cell row for 8-member family
    - js/app.js:12980-13010 — renderCouchAvatarGrid pre-renders one cell per index regardless of claimed state
    - css/app.css:3182-3196 — .couch-avatar-grid 5-col phone / 10-col desktop grid
    - css/app.css:3138-3146 — .couch-viz-container max-width:480px (centered) but child grid escapes visually on wide desktop
  root_cause: "By spec (14-04 D-06): always pre-render one cell per couchSize. Designed for the 'tap an empty cushion to claim' affordance. On desktop with 8 family members + 1 claim, the result is 1 filled circle followed by 7 dashed-amber placeholders stretching to the right edge. Vacate UX exists in code (re-tapping your own filled cell) but isn't visually signposted."
  fix_direction: "DESIGN-DIRECTION DECISION REQUIRED — not a one-line fix. Options on the table (need user input):
    1. Density: compact stack of overlapping mini-avatars + single 'Find a seat' CTA. Empty cushions never rendered as cells; one button replaces all 7 placeholders.
    2. Filled-only + invite: render only claimed seats as full circles, then ONE dashed '+' cell labeled 'Invite' that opens the share-link modal. Add a separate 'I'm out tonight' chip on your own claimed seat for vacate.
    3. Single-CTA Apple-style: hero icon + headline + one prominent pill button that flips between 'Find a seat' / 'Leave couch' depending on your own state. Roster shown as a thin underline of mini-avatars. Tap the button — no per-cushion grid at all.
    4. Hybrid: phone keeps the current 5-col grid (it works at narrow width). Desktop falls back to Option 3 single-CTA at ≥768px."
  missing: []

## Pending design call

**RESOLVED 2026-04-26:** sketch 003 V5 (Roster IS the control) won. See 14-10 SUMMARY for the V5 surface contract. Tests 6-23 + 25-50 still pending against the new surface; resume there.

## Session-wide blocker

**RESOLVED 2026-04-26T16:50Z** — v34 deploy gate cleared. Verified live state on resume:

- `couchtonight.app/sw.js` serves `CACHE = 'couch-v34.0-decision-ritual'` (hosting deploy ran)
- `~/queuenight/firestore.rules` has 5 `couchSeating` references (14-04 rules in place)
- `~/queuenight/functions/index.js` has 11 Flow A/B push-type references (14-06 + 14-09 D-12 CFs in place)
- `~/queuenight/public/sw.js` mirror file matches couch repo sw.js (deploy.sh ran)

**v34.1 deploy 2026-04-26:** couchtonight.app/sw.js now serves CACHE = `couch-v34.1-roster-control`; queuenight firestore:rules deployed with 4th UPDATE branch for couchInTonight (per 14-10). Cross-repo deploy ritual completed end-to-end via the `approved-deploy` resume signal.

The 5 previously-blocked tests (1-5) have been reset to `[pending]` so they re-run against the now-live v34 build. Original blocker text retained in git history (commit `13e08d5`).
