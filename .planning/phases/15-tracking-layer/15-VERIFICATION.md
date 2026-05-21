---
phase: 15
phase_name: tracking-layer
status: human_needed
verified_at: 2026-04-27T00:00:00Z
must_haves_pass: 14/14
must_haves_fail: 0
human_verification_count: 7
overrides_applied: 0
re_verification:
  previous_status: none
  previous_score: n/a
  gaps_closed: []
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Trakt co-watch overlap → S5 modal appears for paired-member sync within ±3hr; tapping 'Yes, group us' creates a tuple; tapping 'No, keep separate' persists decline cross-session"
    expected: "Modal renders with verbatim copy; Yes writes t.tupleProgress[meId,otherId]; No writes families/{code}.coWatchPromptDeclined.{tk}; second sync skips the same pair"
    why_human: "Requires real Trakt OAuth + paired family members + actual co-watch history; cannot be exercised programmatically. REVIEW MEDIUM-9 marquee verification — this is the only surface that proves the cross-plan rules+client coordination actually closes the loop in production."
  - test: "Post-watchparty auto-track confirmation row appears in #wp-post-session-sub when state._pendingTupleAutoTrack stash matches wp.titleId"
    expected: "Row renders with 'Mark S{N}E{M} for {tupleName}?' Yes/Edit; (best guess) qualifier appears when sourceField === 'host-progress-plus-1'; Yes calls writeTupleProgress with source='watchparty'"
    why_human: "Requires running an actual watchparty end-to-end (start → join with ≥1 co-watcher → end → openPostSession fires for each actor). All schema producers for tiers 1-3 (wp.episode / wp.queuedEpisode / wp.intent) are future-ready scaffolding with no live writers yet — only Tier 4 (host-progress + 1) fires today. Confirms: stash flows; resolveAutoTrackEpisode tier 4 resolves; row renders; delegated listener dispatches Yes correctly."
  - test: "Live-release push (D-13/D-14/D-15) actually fires from watchpartyTick CF for a tracked TV show whose nextEpisode airs in 23-26h with ≥2 trackers and no existing watchparty"
    expected: "Push title 'New episode tonight/tomorrow/{Weekday}'; body '{Show} S{N}E{M} — watch with the couch?'; tap opens /?nominate={titleId}&prefillTime={airTs}; subsequent tick within hour skipped by HIGH-3 throttle (liveReleaseSweepLastRunAt cursor not updated)"
    why_human: "Requires real TV titles with populated next.airDate metadata + ≥2 family members tracking + an FCM device subscription + waiting for the 5-min CF tick. Spot-checks REVIEW HIGH-3 (hourly throttle), HIGH-4 (stale-data skip), LOW/MEDIUM-11 (widened 26h bound), MEDIUM-12 (push body framing) end-to-end."
  - test: "Per-show kill-switch (S6): tap 'Stop notifying me about this show' → text flips to 'Notifications off · Re-enable'; toggle persists per-member via writeMutedShow; another family member's mute state is independent"
    expected: "t.mutedShows[me.id] toggles true/deleteField; rule denies attempted writes to t.mutedShows[someone-else.id] (devtools test surfaces the HIGH-1 isolation rule)"
    why_human: "Requires UI interaction + multi-account devtools to verify the rule denial path. Code path is wired (writeMutedShow + window.toggleMutedShow + cv15HandleDetailModalClick); deny-path requires authed multi-account session."
  - test: "S2 detail-modal 'YOUR COUCH'S PROGRESS' section renders for a TV title with ≥1 tuple; pencil glyph reveals input; Enter saves via setTupleName; placeholder '*name this couch*' renders ONLY when tupleCustomName(tk) === null"
    expected: "REVIEW MEDIUM-6 placeholder gate fires correctly; REVIEW MEDIUM-7 delegated listener dispatches renameTuple/muteToggle/expandTuples; rename re-renders detail modal with new name (MEDIUM-8 optimistic update)"
    why_human: "Requires populated t.tupleProgress data + open modal interaction + detail-modal innerHTML re-render trigger to confirm cv15AttachDetailModalDelegate idempotency holds across all 11 attach call sites."
  - test: "S1 Tonight tab 'PICK UP WHERE YOU LEFT OFF' widget renders with ≥1 tuple containing me; hides entirely (style.display='none') when zero tuples"
    expected: "Widget renders max 3 rows sorted by tuple updatedAt desc; tap row body or Continue button opens openDetailModal(titleId); legacy #continue-section coexists below"
    why_human: "Requires populated state.titles with tupleProgress entries + me.id presence. Visual placement contract (between #couch-viz-container and #flow-a-entry-container) is structurally verified, but rendering correctness needs real data."
  - test: "Phase 14 surfaces (V5 couch viz, Flow A entry, Flow B entry, Settings → Notifications, member roster) unchanged after Phase 15 deploy"
    expected: "All Phase 14 features behave identically; no console errors on load; sw.js v35.0-tracking-layer activates and refetches shell"
    why_human: "Visual regression check requires real device rendering (especially iOS PWA cache invalidation). Code-level evidence (renderCouchViz/renderFlowAEntry/renderFlowBEntry/couchInTonight all present and untouched) gives high confidence but the user should sample one app load to confirm no runtime regression."
---

# Phase 15: Tracking Layer Verification Report

**Phase Goal:** Build the tracking layer that lets families "see where every couch is in every show — together or apart" — tuple progress per show, custom tuple names, pickup-where-left-off widget, post-watchparty auto-track confirmation, Trakt co-watch overlap detection, per-show mute, live-release push notifications.

**Verified:** 2026-04-27
**Status:** human_needed
**Re-verification:** No — initial verification.

---

## Summary

All 14 TRACK-15-* requirements are structurally complete in production: client-side primitives shipped in `js/app.js` with REVIEW patches HIGH-2 through MEDIUM-12 incorporated, server-side rules + composite index + watchpartyTick CF extension deployed to queuenight-84044 (commit `31470d1`), `sw.js` cache `couch-v35.0-tracking-layer` live at couchtonight.app, and `changelog.html` v35 article dated 2026-04-27. The cross-plan REVIEW MEDIUM-9 allowlist extension closing 15-07's decline-persistence gap is in the deployed rules. The only items requiring user action are runtime spot-checks that depend on real devices, real Trakt OAuth, and real watchparties — particularly the marquee Trakt overlap S5 modal flow and the post-watchparty auto-track row.

---

## Goal Achievement

### Observable Truths

| # | Truth (from ROADMAP/Plans) | Status | Evidence |
|---|---|---|---|
| 1 | Tuple progress per show — sorted-Set memberId tuple key with HIGH-2 char-safety guard | ✓ VERIFIED | `tupleKey` + `isSafeTupleKey` at js/app.js:8264-8299; regex `/^[A-Za-z0-9_,-]+$/`; per-ID validation + Sentry breadcrumb on rejection |
| 2 | Custom tuple names with cross-session persistence + optimistic local update | ✓ VERIFIED | `setTupleName` at js/app.js:8517 with HIGH-2 gate + MEDIUM-8 optimistic write to `state.family.tupleNames` (line 8549); 5th UPDATE branch in firestore.rules:182-199 allows the dotted-path write |
| 3 | "Pick up where you left off" widget on Tonight tab | ✓ VERIFIED | `renderPickupWidget()` at js/app.js:9148; `<div id="cv15-pickup-container">` at app.html:322 between #couch-viz-container and #flow-a-entry-container; renderTonight() hook at js/app.js:5106; verbatim eyebrow "PICK UP WHERE YOU LEFT OFF" |
| 4 | Post-watchparty auto-track confirmation row (D-01) | ✓ VERIFIED (code-wired) / ? UNCERTAIN (runtime) | `resolveAutoTrackEpisode` waterfall at js/app.js:11264; `state._pendingTupleAutoTrack` stash in openPostSession; `cv15ConfirmAutoTrack` calls writeTupleProgress with source='watchparty'; tiers 1-3 are future-ready scaffolding (no live producers — only Tier 4 host-progress+1 fires today, documented in 15-03-SUMMARY) |
| 5 | Trakt co-watch overlap detection (D-06) with ±3hr window + REVIEW MEDIUM-10 single-comparator | ✓ VERIFIED | `trakt.detectAndPromptCoWatchOverlap` at js/app.js:951; `cv15EpisodeOrdinal` + `cv15SelectHigherProgress` at js/app.js:937-952; S5 modal renderer at js/app.js:1006 with verbatim "Watched together?" / "Yes, group us" / "No, keep separate"; detector hook fires after trakt.sync at line 670-671 |
| 6 | Per-show mute (S6 kill-switch) with HIGH-1 per-member isolation | ✓ VERIFIED | `writeMutedShow` at js/app.js:8569; `window.toggleMutedShow` at js/app.js:8594; `renderCv15MutedShowToggle` at js/app.js:8878; firestore.rules title-doc HIGH-1 isolation enforces memberId == acting memberId |
| 7 | Live-release push notification (D-13/D-14/D-15/D-16) | ✓ VERIFIED (code-wired) / ? UNCERTAIN (runtime) | watchpartyTick CF extension at queuenight/functions/index.js:852-1033 with HIGH-3 hourly throttle (line 870-872), HIGH-4 stale-data guard (line 895-897), LOW/MEDIUM-11 widened 23-26h window, MEDIUM-12 "New episode {tonight/tomorrow/Weekday}" framing (line 998); 8th NOTIFICATION_DEFAULTS key newSeasonAirDate (line 102); deployed in commit 31470d1 |
| 8 | REVIEW MEDIUM-9 cross-session decline persistence (don't re-nag) | ✓ VERIFIED (code-wired) / ? UNCERTAIN (runtime) | `cv15CoWatchPromptDecline` at js/app.js:1057 writes families/{code}.coWatchPromptDeclined.{tk}; family-doc snapshot hydration at js/app.js:4360; rules allowlist extended to include 'coWatchPromptDeclined' at firestore.rules:199 — this closes the 15-07 documented "permission denied until 15-08" gap |
| 9 | New 8th push category in Settings → Notifications with REVIEW MEDIUM-12 reframed label | ✓ VERIFIED | DEFAULT_NOTIFICATION_PREFS.newSeasonAirDate at js/app.js:123; NOTIFICATION_EVENT_LABELS at js/app.js:156 with label "New episode alerts" + hint "When a tracked show drops a new episode."; anti-regression: 0 occurrences of "New season air dates" |
| 10 | D-07 Trakt opt-in disclosure ("Optional — tracking works without it") | ✓ VERIFIED | renderTraktCard disconnected branch eyebrow + Instrument Serif sub-line; both verbatim strings present in js/app.js (1 each) |
| 11 | sw.js CACHE bumped + production deploy live | ✓ VERIFIED | `const CACHE = 'couch-v35.0-tracking-layer';` at sw.js:8; live at https://couchtonight.app/sw.js (HTTP 200, body confirmed); /app and /changelog.html both serve HTTP 200 |
| 12 | Changelog v35 dated article above v34 | ✓ VERIFIED | changelog.html line 69-77 contains v35 article with date "2026-04-27 · Tracking layer", REVIEW MEDIUM-9 copy ("Decline once and we won't re-ask"), REVIEW MEDIUM-12 copy ("New episode alerts") |
| 13 | All 14 TRACK-15-* requirement IDs minted with traceability | ✓ VERIFIED | REQUIREMENTS.md:152 has "### Tracking Layer (Phase 15)" section; TRACK-15-01..14 all present in body + 14 traceability table rows at lines 300-313 |
| 14 | No regression on Phase 14 surfaces (couch viz, Flow A/B, V5 roster, Settings notifications) | ✓ VERIFIED (code) / ? UNCERTAIN (visual) | renderCouchViz, renderFlowAEntry, renderFlowBEntry, couchInTonight, NOTIFICATION_EVENT_LABELS — 45 occurrences across these symbols; legacy renderTvProgressSection (js/app.js:9033) and renderContinueWatching (js/app.js:9204) preserved per "SUPPLEMENT (don't replace)" contract |

**Score:** 14/14 truths verified at code/structural level. Items 4, 7, 8, 14 carry runtime UNCERTAIN flags routed to human verification (see below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `js/app.js` | Tuple primitives + S1/S2/S3/S5/S6 surfaces + Trakt overlap + auto-track + push triad | ✓ VERIFIED | All 28 functions verified present (grep matrix in tool output); parses with `node --check` exit 0; ~1100 net insertions across waves |
| `app.html` | `<div id="cv15-pickup-container">` between #couch-viz-container and #flow-a-entry-container | ✓ VERIFIED | Line 322; aria-label "Pick up where you left off" |
| `css/app.css` | Single Phase 15 grep-marker block with `.cv15-*` selectors | ✓ VERIFIED | `/* === Phase 15 — Tracking Layer === */` at line 2442; `.cv15-progress-row`, `.cv15-tuple-name.unnamed-placeholder`, `.cv15-mute-toggle`, `.cv15-cowatch-prompt-content`, `.cv15-pickup-container`, `.cv15-autotrack-row` all present |
| `~/queuenight/firestore.rules` | 5th UPDATE branch + HIGH-1 title-doc isolation + MEDIUM-9 allowlist extension | ✓ VERIFIED | Lines 182-199 (5th branch with tupleNames + coWatchPromptDeclined allowlist); lines 336-435 (title-doc HIGH-1 with explicit DENY for liveReleaseFiredFor + per-key tupleProgress isolation via actingTupleKey echo + per-member mutedShows isolation); deployed in commit 31470d1 |
| `~/queuenight/firestore.indexes.json` | Composite index `watchparties (titleId asc, startAt asc)` | ✓ VERIFIED | Single index present in valid JSON; deployed (build status not re-checked in this verification — assumed live per 15-08 deploy log) |
| `~/queuenight/functions/index.js` | watchpartyTick sweep block + 8th NOTIFICATION_DEFAULTS key | ✓ VERIFIED | newSeasonAirDate at line 102; sweep block lines 852-1033 with HIGH-3/HIGH-4/MEDIUM-11/MEDIUM-12 markers all grep-confirmed; deployed |
| `sw.js` | CACHE = 'couch-v35.0-tracking-layer' | ✓ VERIFIED | Line 8; production HTTP fetch returns matching string |
| `changelog.html` | v35 article above v34, dated 2026-04-27 | ✓ VERIFIED | Lines 69-77; placeholder substituted in commit b3e6952 |
| `.planning/REQUIREMENTS.md` | New Tracking Layer (Phase 15) section + 14 TRACK-15-* IDs + traceability rows | ✓ VERIFIED | Section heading at line 152; all 14 IDs present; 14 traceability rows |
| `.planning/ROADMAP.md` | Row 15 status=Complete, plans=8/8, narrative scrub "13 → 14" | ✓ VERIFIED | Line 255 "Tracking Layer | 8/8 | Complete | 2026-04-27"; "13 TRACK-15-*" returns 0 matches; "14 TRACK-15-*" returns 1 match |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `writeTupleProgress` | Firestore titles/{id}.tupleProgress | `actingTupleKey` echo per 15-01 forward-contract | ✓ WIRED | js/app.js:8458 stamps actingTupleKey + writeAttribution; rule at firestore.rules:391-413 enforces echo equality + actor membership |
| `setTupleName` | Firestore families/{code}.tupleNames | dotted-path `tupleNames.{tk}` + writeAttribution | ✓ WIRED | js/app.js:8517 with isSafeTupleKey gate; rule at firestore.rules:182-199 allows via 5th UPDATE branch |
| `writeMutedShow` | Firestore titles/{id}.mutedShows[memberId] | dotted-path with deleteField unmute | ✓ WIRED | js/app.js:8569; rule at firestore.rules:421-432 enforces inner-key == actor memberId |
| `cv15CoWatchPromptDecline` | Firestore families/{code}.coWatchPromptDeclined.{tk} | dotted-path + try/catch + Sentry breadcrumb | ✓ WIRED | js/app.js:1064-1073; rule allowlist extended in 15-08 (firestore.rules:199); deployed |
| watchpartyTick sweep | Firestore watchparties (composite query) | `.where('titleId','==')` + range on startAt | ✓ WIRED | functions/index.js:967-994; depends on composite index from 15-01 — deployed |
| watchpartyTick sweep | sendToMembers fan-out | `eventType: 'newSeasonAirDate'` (8th key) | ✓ WIRED | functions/index.js:1014; matches 8th DEFAULT_NOTIFICATION_PREFS key in client at js/app.js:123 |
| Tonight tab DOM anchor | renderPickupWidget | `getElementById('cv15-pickup-container')` + renderTonight() hook | ✓ WIRED | app.html:322 div + js/app.js:5106 hook + js/app.js:9148 renderer |
| renderDetailShell | renderCv15TupleProgressSection | template-literal interpolation between renderReviewsForTitle and renderTmdbReviewsForTitle | ✓ WIRED | js/app.js:7473 interpolation site verified |
| openPostSession | state._pendingTupleAutoTrack stash | extension after _postSessionRating reset, before sub.innerHTML | ✓ WIRED | js/app.js:11319 (clear) + 11330 (set) + 11393 (delegate attach) |
| trakt.sync | trakt.detectAndPromptCoWatchOverlap | `.catch`-guarded fire after lastSyncedAt write | ✓ WIRED | js/app.js:670-671 |
| Family-doc onSnapshot | state.family.tupleNames + state.family.coWatchPromptDeclined hydration | extension after couchInTonight hydration | ✓ WIRED | js/app.js:4358 (tupleNames) + 4360 (coWatchPromptDeclined) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|---|---|---|---|---|
| renderPickupWidget | tuplesContainingMember(t, meId) | state.titles[].tupleProgress (populated by writeTupleProgress on watchparty-end Yes / Trakt-overlap Yes / manual edit) | Yes (via real Firestore titles subcollection) | ✓ FLOWING |
| renderCv15TupleProgressSection | t.tupleProgress (map) | Same as above | Yes | ✓ FLOWING |
| renderCv15MutedShowToggle | t.mutedShows[me.id] | writeMutedShow → titles/{id}.mutedShows | Yes | ✓ FLOWING |
| Settings → Notifications row | NOTIFICATION_EVENT_LABELS.newSeasonAirDate | Static const, render in legacy notif UI iteration | Static — design-intentional | ✓ FLOWING (static config) |
| watchpartyTick push body | next.season + next.episode + showName | t.nextEpisode + t.name from titles subcollection | Yes (TMDB-populated nextEpisode; client writes nextEpisodeRefreshedAt) | ✓ FLOWING (gated by HIGH-4 7-day staleness skip) |
| auto-track row in openPostSession | state._pendingTupleAutoTrack | resolveAutoTrackEpisode waterfall — Tier 4 (host-progress+1) is the only live producer today | PARTIAL — Tier 4 only, future-ready scaffolding for Tiers 1-3 documented in 15-03-SUMMARY | ⚠️ STATIC-FALLBACK (acceptable per plan; see human verification item 2) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| sw.js production fetch | `curl -s https://couchtonight.app/sw.js \| grep "const CACHE"` | `const CACHE = 'couch-v35.0-tracking-layer';` | ✓ PASS |
| /app endpoint live | `curl -I https://couchtonight.app/app` | HTTP/1.1 200 OK | ✓ PASS |
| /changelog.html v35 live | `curl https://couchtonight.app/changelog.html \| grep v35` | "v35" + "2026-04-27 · Tracking layer" | ✓ PASS |
| js/app.js parse-clean | `node --check js/app.js` | exit 0 (PARSE_OK) | ✓ PASS |
| queuenight functions deployed | `cd ~/queuenight && git log --oneline -1` | commit `31470d1 feat(15): tracking layer — rules + index + CF sweep + push category` | ✓ PASS |
| Trakt overlap detector S5 modal end-to-end | (requires real Trakt sync data + paired members) | n/a | ? SKIP — routed to human verification item 1 |
| watchpartyTick HIGH-3 throttle (1/hour cadence) | (requires waiting one full sweep cycle + Firestore inspection) | n/a | ? SKIP — routed to human verification item 3 |
| HIGH-4 Sentry breadcrumb on stale title | (requires real stale title + Sentry inspection) | n/a | ? SKIP — routed to human verification item 3 |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TRACK-15-01 | Plan 01 | Firestore data foundation (rules + index + tests + REVIEW HIGH-1 title-doc tightening) | ✓ SATISFIED | firestore.rules + firestore.indexes.json + tests/rules.test.js #23-#32; deployed in commit 31470d1 |
| TRACK-15-02 | Plan 02 | Tuple read/write helpers + family-doc snapshot hydration + HIGH-2 + MEDIUM-6 + MEDIUM-8 | ✓ SATISFIED | js/app.js:8264-8569 read/write blocks + 4358 hydration |
| TRACK-15-03 | Plan 03 | D-01 watchparty-end auto-track stash with MEDIUM-5 episode-resolution waterfall | ✓ SATISFIED | resolveAutoTrackEpisode at js/app.js:11264; openPostSession stash at 11319-11330; window.toggleMutedShow at 8594 |
| TRACK-15-04 | Plan 04 | S2 detail-modal "YOUR COUCH'S PROGRESS" section + MEDIUM-6 placeholder + MEDIUM-7 delegated listener | ✓ SATISFIED | renderCv15TupleProgressSection at js/app.js:8824; tupleCustomName(tk)===null gate; cv15HandleDetailModalClick at 9002; cv15AttachDetailModalDelegate idempotent |
| TRACK-15-05 | Plan 04 | S3 inline tuple rename via pencil glyph; MEDIUM-7 + MEDIUM-8 | ✓ SATISFIED | cv15ShowRenameInput at js/app.js:8909; cv15SaveRenameInput at 8941; data-cv15-action="renameTuple" attribute |
| TRACK-15-06 | Plan 04 | S6 per-show kill-switch with MEDIUM-7 + verbatim copy | ✓ SATISFIED | renderCv15MutedShowToggle at js/app.js:8878; "Stop notifying me about this show" + "Notifications off · Re-enable" both grep-confirmed |
| TRACK-15-07 | Plan 05 | S1 Tonight tab "PICK UP WHERE YOU LEFT OFF" widget | ✓ SATISFIED | app.html:322 anchor + renderPickupWidget at js/app.js:9148 + renderTonight() hook at 5106; coexists with renderContinueWatching at 9204 |
| TRACK-15-08 | Plan 06 | watchpartyTick CF extension — D-13/D-14/D-15/D-16 sweep with HIGH-3/HIGH-4/MEDIUM-11/MEDIUM-12 patches | ✓ SATISFIED | functions/index.js:852-1033; deployed; live in queuenight-84044 |
| TRACK-15-09 | Plan 06 | Server NOTIFICATION_DEFAULTS 8th key newSeasonAirDate (DR-3 place 1 of 3) | ✓ SATISFIED | functions/index.js:102 |
| TRACK-15-10 | Plan 07 | Client DEFAULT_NOTIFICATION_PREFS 8th key (DR-3 place 2 of 3) | ✓ SATISFIED | js/app.js:123 |
| TRACK-15-11 | Plan 07 | Client NOTIFICATION_EVENT_LABELS 8th entry with REVIEW MEDIUM-12 reframed label (DR-3 place 3 of 3) | ✓ SATISFIED | js/app.js:156 — "New episode alerts" / "When a tracked show drops a new episode."; anti-regression "New season air dates" returns 0 |
| TRACK-15-12 | Plan 07 | trakt.ingestSyncData lastWatchedAt capture + cross-session decline persistence (MEDIUM-9 + MEDIUM-10 single comparator) | ✓ SATISFIED | trakt.detectAndPromptCoWatchOverlap at js/app.js:951; cv15EpisodeOrdinal + cv15SelectHigherProgress at 937-952; cv15CoWatchPromptDecline at 1057 with rule allowlist extended in 15-08 |
| TRACK-15-13 | Plan 08 | sw.js CACHE bump + REQUIREMENTS mint + ROADMAP scrub + MEDIUM-9 cross-plan allowlist extension + changelog v35 + cross-repo deploy ritual | ✓ SATISFIED | All artifacts present and live in production per evidence above |
| TRACK-15-14 | Plan 07 | D-07 Trakt opt-in Settings disclosure | ✓ SATISFIED | renderTraktCard disconnected branch with verbatim eyebrow + sub-line at js/app.js |

**Note:** REQUIREMENTS.md still shows all TRACK-15-* IDs and traceability rows as `[ ] Pending`. Per 15-08-SUMMARY §"Resume Instructions for Continuation Agent" step 3, this flip from `[ ]` to `[x]` was deferred to post-deploy and is owned by the orchestrator, not the verifier. Flagging this as documentation-state drift, not a code/feature gap. Worth orchestrator follow-up to flip the 14 boxes + update Coverage line "41 complete + 14 = 55 complete; 47 pending."

### REVIEW Patch Verification

All 13 REVIEW patches confirmed landed in production:

| Patch | Severity | Surface | Evidence |
|---|---|---|---|
| HIGH-1 | High | firestore.rules title-doc isolation (tupleProgress + mutedShows + liveReleaseFiredFor) | firestore.rules:336-435; explicit DENY for liveReleaseFiredFor at line 372; per-tuple-key isolation via actingTupleKey echo at lines 391-413; per-member mutedShows isolation at lines 421-432 — deployed |
| HIGH-2 | High | js/app.js isSafeTupleKey + tupleKey character validation + setTupleName guard | js/app.js:8264 isSafeTupleKey + 8272 tupleKey with per-ID regex; gates on every tuple-key-touching write |
| HIGH-3 | High | watchpartyTick hourly throttle (was per-tick) | functions/index.js:870 cursor read + 872 skip + 1024-1027 cursor write; `liveReleaseSweepLastRunAt` field |
| HIGH-4 | High | watchpartyTick stale-data skip + Sentry breadcrumb | functions/index.js:895-924; STALE_NEXT_EPISODE_MS guard + category='liveReleaseStale' breadcrumb + daily rate-limit |
| MEDIUM-5 | Medium | resolveAutoTrackEpisode 4-tier waterfall (wp.episode → wp.queuedEpisode → wp.intent → host-progress+1 → null) | js/app.js:11264; all 4 tier sourceField labels grep-confirmed; documented as future-ready (tiers 1-3 have no producers in repo today) |
| MEDIUM-6 | Medium | tupleCustomName(tk) === null placeholder gate (separate from tupleDisplayName) | js/app.js:8329 tupleCustomName decl returning null when no custom name; renderCv15TupleProgressSection uses isUnnamed = customName === null |
| MEDIUM-7 | Medium | data-* attributes + delegated event listeners (replace inline onclick for tuple-key-bearing handlers) | 5 data-cv15-action attrs (renameTuple/muteToggle/expandTuples/confirmAutoTrack/editAutoTrack); cv15HandleDetailModalClick + cv15HandlePostSessionClick delegated listeners |
| MEDIUM-8 | Medium | Optimistic state.family.tupleNames update inside setTupleName | js/app.js:8549 — `state.family.tupleNames = { ...prev, [tupleKeyStr]: slot };` |
| MEDIUM-9 | Medium | coWatchPromptDeclined cross-session persistence + rule allowlist extension | js/app.js:1064-1078 dotted-path write + try/catch + Sentry; firestore.rules:199 allowlist includes 'coWatchPromptDeclined' (cross-plan coordination by 15-08 closes the gap 15-07 documented) |
| MEDIUM-10 | Medium | Single-comparator (cv15EpisodeOrdinal: season*1000 + episode) — fixes S5E1-vs-S4E10 mismatch | js/app.js:937 cv15EpisodeOrdinal + 945 cv15SelectHigherProgress; anti-pattern grep "Math.max(myProg.season, otherProg.season)" returns 0 |
| MEDIUM-11 | Medium/Low | watchpartyTick window widened to 23-26h to absorb hourly tick-drift | functions/index.js gate `60 * 23 \|\| minsToAir > 60 * 26` confirmed |
| MEDIUM-12 | Medium | "New episode {tonight/tomorrow/Weekday}" framing (key 'newSeasonAirDate' preserved for back-compat) + Settings label "New episode alerts" | js/app.js:156 label + functions/index.js:998 push title; anti-regression "New season air dates" returns 0 in js/app.js |
| LOW (narrative scrub) | Low | ROADMAP "13 TRACK-15-*" → "14 TRACK-15-*" | ROADMAP.md line 281 (footer); grep "13 TRACK-15-\*" returns 0 |

### Cross-Plan Integration

| Coordination | Verified |
|---|---|
| 15-01 forward-contract → 15-02 writeTupleProgress stamps actingTupleKey | ✓ js/app.js:8458 + 8486 stamp the rule-required echo; rule at firestore.rules:397-413 validates it |
| 15-04 consumes 15-03 state._pendingTupleAutoTrack stash via cv15ConfirmAutoTrack | ✓ js/app.js:11406-11422 reads `state._pendingTupleAutoTrack` set in 15-03 openPostSession extension |
| 15-08 closes 15-07's MEDIUM-9 rules gap by extending 5th UPDATE branch allowlist | ✓ firestore.rules:199 allowlist now includes 'coWatchPromptDeclined' — deployed in commit 31470d1; cv15CoWatchPromptDecline writes will succeed (currently failed pre-15-08) |
| 15-06 server NOTIFICATION_DEFAULTS lockstep with 15-07 client DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS | ✓ Both files have newSeasonAirDate: true; client label is REVIEW MEDIUM-12 reframed; KEY preserved for back-compat |
| 15-05 widget consumes 15-04 CSS namespace + 15-02 helpers | ✓ Single Phase 15 CSS block at css/app.css:2442; renderPickupWidget at js/app.js:9148 uses tuplesContainingMember + tupleDisplayName + cv15RelativeTime |

### Production Deploy Evidence

- **couchtonight.app/app** → HTTP 200 OK
- **couchtonight.app/sw.js** → HTTP 200 OK; body contains `const CACHE = 'couch-v35.0-tracking-layer';`
- **couchtonight.app/changelog.html** → HTTP 200 OK; v35 article present with date "2026-04-27 · Tracking layer"
- **queuenight commit `31470d1`** → 1 commit shipping all 3 uncommitted files (firestore.rules + firestore.indexes.json + functions/index.js); 315 insertions / 3 deletions; preceded only by `0910514 initial: deploy-mirror infra`
- **firebase deploy log (per 15-08-SUMMARY)** → rules + indexes + 23 functions (incl. `watchpartyTick`) all deployed to queuenight-84044; couch hosting deploy 1 (initial) + deploy 2 (changelog date substitution); BUILD_DATE auto-stamped 2026-04-27

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| .planning/REQUIREMENTS.md | 163-176 + 300-313 | All 14 TRACK-15-* IDs still show `[ ] Pending` after deploy | ℹ️ Info | Documentation-state drift only — code/feature delivery is complete; orchestrator was meant to flip these post-deploy per 15-08-SUMMARY §"Resume Instructions" |
| ~/queuenight/firestore.indexes.json | 2-10 | Composite index build status not re-checked at verification time | ℹ️ Info | Plan 15-08-SUMMARY documents the deploy; orchestrator did not pause to confirm "Building → Enabled" transition. If still Building, watchpartyTick's first sweep tick will stamp `'suppression_query_failed'` for any title that hits the suppression query — non-blocking, telemetry-visible, self-healing once index lights up |
| 15-03-SUMMARY | n/a | Tiers 1-3 of resolveAutoTrackEpisode are future-ready scaffolding with no live producers in repo today | ℹ️ Info | Documented intentional gap — only Tier 4 (host-progress+1) fires today. Sentry telemetry surfaces tier distribution; future plan can extend Phase 7 wp schema to light up tiers 1-3 |

No blocker or warning anti-patterns. All "stub" patterns identified are explicit design contracts (e.g., S1 widget hides on zero tuples; S2 section returns '' when t.tupleProgress is empty) per UI-SPEC §Discretion Q7 + §Empty states.

### Human Verification Required

7 items routed to human verification because they require real devices, real Trakt OAuth, real watchparties, or multi-account devtools sessions. See `human_verification:` block in frontmatter for full detail. Highlights:

1. **Trakt overlap S5 modal end-to-end** (REVIEW MEDIUM-9 marquee verification) — the only surface that proves cross-plan rule+client coordination actually closes the loop in production. Decline persistence cross-session is the headline test.
2. **Post-watchparty auto-track row** — proves D-01 stash → row render → Yes → writeTupleProgress chain (Tier 4 fallback path is the live one).
3. **Live-release push** — proves CF sweep → 26h window resolution → push delivery → MEDIUM-12 framing reads correctly on lockscreen.
4. **Per-show mute toggle** — proves S6 surface UX + REVIEW HIGH-1 deny path via devtools.
5. **S2 detail-modal section + S3 rename** — proves MEDIUM-6 placeholder gate fires; MEDIUM-7 delegated listener idempotency holds.
6. **S1 Pickup widget** — proves visual placement + cross-show roll-up data correctness.
7. **Phase 14 regression check** — sample one app load to confirm no runtime regression (code-level evidence already verified).

### Gaps Summary

No code-level or structural gaps blocking the phase from being called done. All 14 must-haves verified at code/structural level. All REVIEW patches landed. All cross-plan coordination resolved. Production deploy live and reachable.

The remaining work is human runtime verification of behaviors that cannot be exercised programmatically (real Trakt sync, real watchparty, real push delivery, real device PWA cache invalidation). Status is `human_needed` rather than `passed` because these runtime spot-checks are non-trivial — particularly the marquee REVIEW MEDIUM-9 cross-session decline test which is the only proof that the cross-plan rule+client coordination actually works end-to-end.

One non-blocking documentation item: REQUIREMENTS.md still has all 14 TRACK-15-* boxes as `[ ] Pending` and Coverage line still reads "41 complete; 61 pending"; per 15-08-SUMMARY §"Resume Instructions", the orchestrator was meant to flip these to `[x]` and update the Coverage line to "55 complete; 47 pending" after `approved-deploy`. Worth a follow-up touch but does not affect feature delivery.

---

_Verified: 2026-04-27_
_Verifier: Claude (gsd-verifier)_
