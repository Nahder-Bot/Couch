---
status: testing
phase: 14-decision-ritual-core
source: 14-01-SUMMARY.md, 14-02-SUMMARY.md, 14-03-SUMMARY.md, 14-04-SUMMARY.md, 14-05-SUMMARY.md, 14-06-SUMMARY.md, 14-07-SUMMARY.md, 14-08-SUMMARY.md, 14-09-SUMMARY.md
started: 2026-04-26T00:00:00Z
updated: 2026-04-26T19:34:00Z
---

## Current Test

[paused — environment is serving pre-v34 code; v34 surfaces (couch viz, redesigned tile, Flow A/B entries) are not rendering. Awaiting user direction: deploy v34 to test environment first, OR mark v34-dependent tests as blocked and continue with the few that don't depend on v34 UI.]

## Tests

### 1. Cold Start Smoke Test
expected: Open the app in a fresh browser session (or fully close + reopen the installed PWA). Sign in. The app shell boots without errors. Family + members + titles hydrate. Tonight tab loads with the new Couch viz at the top, then existing surfaces below.
result: blocked
blocked_by: release-build
reason: "Tonight tab boots OK and family/titles hydrate, but it does NOT show the new Couch viz at the top — the v34 surface is not running in this test environment. See screenshot in user's response to test 5. Per 14-09 SUMMARY Task 7 is DEFERRED: queuenight CFs uncommitted, firestore:rules undeployed, couch hosting undeployed; whatever URL was tested is still serving pre-v34 (v33.3) code."

### 2. Couch viz hero + headline render (14-04)
expected: Tonight tab leads with the C-sectional couch icon (mark-512.png) at top with a subtle warm halo + drop shadow. Below it: Fraunces "On the couch tonight" headline + italic Instrument Serif sub-count ("N of M here" or "Tap a seat to claim it" when nobody is seated yet).
result: blocked
blocked_by: release-build
reason: "Initial 'yes' was a false-positive — screenshot from test 5 shows the existing pre-Phase-14 'WHO'S ON THE COUCH' member-pill chip rail at the top, not the new v34 couch hero icon + Fraunces headline. v34 hosting deploy is pending (Task 7 DEFERRED)."

### 3. Couch viz avatar grid layout (14-04)
expected: Avatar grid below the headline shows cells matching couchSize = max(2, totalMembers, claimedCount), capped at 10. On phone width it wraps 5×2; on desktop ≥768px it lays out 10×1. Each empty cell is a dashed amber circle with a ＋ glyph.
result: blocked
blocked_by: release-build
reason: "Screenshot shows the pre-Phase-14 horizontal avatar pill rail, not the new dashed-amber grid of seat-cells. v34 hosting deploy pending."

### 4. Claim a cushion (14-04)
expected: Tap an empty cell — it flips to a filled member-color circle showing your initial; "me" cell gets a warm-amber outline. Sub-count updates to reflect the new claim.
result: blocked
blocked_by: release-build
reason: "No new seat-cell grid exists in the test environment to claim — pre-v34 code is running. (Original response was 'skip'; reclassifying as release-build blocked since the underlying cause is the missing deploy.)"

### 5. Vacate own cushion (14-04)
expected: Tap your own claimed cell — it flips back to dashed empty; sub-count decrements.
result: blocked
blocked_by: release-build
reason: "User reported 'I'm not seeing it' with screenshot confirming the new v34 couch viz is absent in this test environment. v34 hosting + queuenight CFs + firestore:rules deploy are all DEFERRED per 14-09 SUMMARY Task 7."

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
result: [pending]

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
passed: 0
issues: 0
pending: 45
skipped: 0
blocked: 5

## Gaps

[none yet — no code-level issues confirmed; session-wide blocker is environment/deploy state, not Phase 14 code]

## Session-wide blocker

**Test environment is serving pre-v34 code.** All 5 tests run so far (#1, #2, #3, #4, #5) are blocked by the same root cause: the v34 surfaces from Phase 14 (Couch viz, redesigned tile, Flow A/B entry CTAs, etc.) are not rendering in the user's test environment. The screenshot attached to test 5 confirms the pre-Phase-14 member-pill chip rail + old "Vote" tile button + old "X 👍" pill are still in place.

This matches the documented deferred-deploy state in `14-09-SUMMARY.md` Task 7 (`ship_state: CODE-COMPLETE — Tasks 1-6 shipped across 5 atomic couch commits; Task 7 (CFs+hosting deploy) DEFERRED`):

1. `~/queuenight/functions/index.js` NOTIFICATION_DEFAULTS edit applied in-place but UNCOMMITTED on this machine.
2. `firebase deploy --only functions` (queuenight CFs) — NOT YET RUN.
3. `firebase deploy --only firestore:rules --project queuenight-84044` — NOT YET RUN (per 14-04 deploy gate; without this, `couchSeating` writes will be denied in prod).
4. `bash scripts/deploy.sh 34.0-decision-ritual` (couch hosting + sw.js bump) — NOT YET RUN.

**To unblock the rest of UAT, run the cross-repo deploy ritual** (from `14-09-SUMMARY.md` "Task 7 — DEFERRED deploy gate"):

```bash
# 1) Commit + deploy queuenight CFs
cd ~/queuenight
git add functions/index.js
git commit -m "feat(14-06+14-09): extend intents CFs + add D-12 push categories"
firebase deploy --only functions

# 2) Deploy firestore.rules so couchSeating writes are accepted in prod
firebase deploy --only firestore:rules --project queuenight-84044

# 3) Deploy couch hosting + sw.js v34 CACHE bump
cd ~/claude-projects/couch
bash scripts/deploy.sh 34.0-decision-ritual

# 4) On any installed PWA (or browser): refresh while online so the new sw.js
#    activates couch-v34.0-decision-ritual CACHE; the new v34 surfaces become visible.
```

After deploy, re-run `/gsd-verify-work 14` — this UAT file resumes from test 1 with the 5 blocked tests reset, and the remaining 45 pending tests run against the live v34 build.
