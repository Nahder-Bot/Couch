---
status: gaps_found
flows_checked: 4
regressions_found: 0
gaps_found: 1
verified_at: 2026-04-27T00:00:00Z
phase: 15
phase_name: tracking-layer
scope: cross-phase regression check (P6, P7, P11, P13, P14) + 4 E2E flow read-throughs
---

# Phase 15 -- Cross-Phase Integration Check

**Goal:** Confirm Phase 15 (Tracking Layer, ~999 net lines added to js/app.js plus rules + CF extension) has not broken contracts in prior shipped phases (6, 7, 11, 13, 14) AND that the four marquee Phase 15 cross-phase E2E flows close at the read-the-code level.

**Method:** Code-level read-through. Targeted Grep for known integration symbols + Read of specific line ranges. No runtime exercise (real Trakt OAuth + watchparty + push delivery is the human-UAT scope per 15-VERIFICATION.md human_verification block).

**Headline:** Zero regressions to prior phases. One pre-existing gap in the Flow B deep-link wiring is exposed (not introduced) by Phase 15 live-release push URL -- see Concern #1.

---

## Per-Prior-Phase Regression Check

### Phase 7 (Watchparty) -- PASS

openPostSession extension is purely additive. Verified at js/app.js:11304-11403:

- **Early-return guards preserved** -- the `if (dismissed || alreadyRated) return;` at line 11309 fires BEFORE any Phase 15 stash logic. `_pendingTupleAutoTrack` cannot be set on already-rated or dismissed sessions because the function exits first.
- **`_postSessionRating = 0;` reset preserved** -- line 11311, immediately before the new P15 block. Original semantics intact.
- **Rating UI reset block preserved** -- lines 11396-11400 (star elements, rating-confirm, photo preview, photo-upload tile, photo input value) all run unchanged AFTER the P15 stash logic.
- **Modal show preserved** -- `bg.classList.add("on")` at line 11402 still fires last.
- **#wp-post-session-sub render preserved + extended** -- line 11369 still seeds `<em>How was {titleName}?</em>` baseHtml first; the auto-track row is only APPENDED if a candidate stashed (`if (at && at.titleId === wp.titleId && at.memberIds.length)` at line 11373). Zero-stash case = pre-Phase-15 behavior bit-identical.
- **Stash always cleared first** -- `state._pendingTupleAutoTrack = null;` at line 11319 prevents stale cross-watchparty bleed-through.

**Evidence:** js/app.js:11290-11443 Read.

---

### Phase 11 (Feature Refresh & Streamline) -- PASS

No naming collisions. Phase 15 placed all 9 new helpers in a single grep-marked region at js/app.js:8254 (// === Phase 15 -- Tracking Layer (read helpers) ===), immediately AFTER the existing per-member TV progress region (line 8248). The new helpers SUPPLEMENT (not replace) getMemberProgress, renderTvProgressSection, renderContinueWatching.

**Definition-count check (each defined exactly once):**

| Symbol | Definition Site |
|---|---|
| isSafeTupleKey | js/app.js:8264 |
| tupleKey | js/app.js:8272 |
| tupleProgressFromTitle | js/app.js:8301 |
| tuplesContainingMember | js/app.js:8309 |
| tupleCustomName | js/app.js:8329 |
| tupleDisplayName | js/app.js:8349 |
| writeTupleProgress | js/app.js:8458 |
| setTupleName | js/app.js:8517 |
| writeMutedShow | js/app.js:8569 |

No symbol collision with prior phases. Helper region grouping is consistent with Phase 11 organizational discipline.

**Evidence:** Grep for ^function matrix; js/app.js:8240-8264 Read.

---

### Phase 14 (Decision Ritual Core / V5 Roster) -- PASS

Three sub-checks:

1. **Family-doc onSnapshot -- single subscription, no race.** Verified at js/app.js:4344-4360. The onSnapshot(familyDocRef()) callback at line 4344 hydrates ALL of: state.couchInTonight (4354 / P14-10), state.couchMemberIds (4355), state.family.tupleNames (4358 / P15), state.family.coWatchPromptDeclined (4360 / P15). Single callback, no duplicate subscription, no temporal hydration race. Phase 15 piggybacks on the existing P14-10 hydration site rather than opening a parallel listener.

2. **renderCouchViz / renderFlowAEntry untouched.** Both defined exactly once (13959, 15126) -- Phase 15 did NOT redefine, shadow, or wrap them. renderTonight() at line 5099-5106 calls renderCouchViz -> renderFlowAEntry -> renderPickupWidget (new). Phase 15 renderPickupWidget writes to its own dedicated container #cv15-pickup-container in app.html:322, which sits BETWEEN #couch-viz-container (317) and #flow-a-entry-container (325) -- exactly per UI-SPEC sec.S1 placement contract. The legacy #continue-section at js/app.js:9204 still runs (verified by P15 verifier; coexistence is intentional per SUPPLEMENT-do-not-replace).

3. **couchPing deferral preserved.** Verified at js/app.js:14121-14138. Still toast + Sentry breadcrumb only (Path C from P14-10 Task 5). Phase 15 did NOT wire push fan-out for couchPing. The decision-rationale comment block (lines 14110-14120) still explicitly documents that Path A/B were rejected and that real CF wiring is deferred. Polish backlog item still owned by a future plan.

**8th notification key (newSeasonAirDate) follows DR-3 deferral pattern.** Verified at js/app.js:100-157:
- DEFAULT_NOTIFICATION_PREFS.newSeasonAirDate: true at line 123 (DR-3 place 2 of 3)
- NOTIFICATION_EVENT_LABELS.newSeasonAirDate at line 156 (DR-3 place 3 of 3) with label "New episode alerts"
- NOTIF_UI_TO_SERVER_KEY / NOTIF_UI_LABELS / NOTIF_UI_DEFAULTS (the friendly-UI maps at 163-189) are NOT extended -- same intentional skip as the 7 P14 keys per the inline comment at line 129-133. P15 follows the established DR-3 pattern; the 8th toggle surfaces in the legacy Settings UI only, not the friendly Settings page.

**Evidence:** js/app.js:4330-4370, 5095-5107, 100-189, 14105-14138 Read; app.html:317,322,325.

---

### Phase 6 (Push Notifications) -- PASS

Server-side (~/queuenight/functions/index.js):

- NOTIFICATION_DEFAULTS extended to 16 keys (verified at functions/index.js:74-103). 8th P14 key block + 1 P15 key (newSeasonAirDate: true at line 102) are additive only; no prior keys removed or modified.
- sendToMembers filter logic (functions/index.js:111-168) is unchanged. The per-event-type pref check at lines 129-145 uses the existing pattern -- for newSeasonAirDate this resolves to defaultOn=true -> push fires when user has not explicitly muted. Correct default-on behavior matching client.
- watchpartyTick extension at functions/index.js:990-1014 calls sendToMembers(...) with eventType: newSeasonAirDate (line 1014) -- passes through the existing filter.

Client-side parity verified above (Phase 14 section item 4).

**Evidence:** ~/queuenight/functions/index.js:70-145, 990-1014 Read.

---

### Phase 13 (Compliance & Ops) -- PASS

- **Account deletion CFs unchanged.** requestAccountDeletion (line 1183) and accountDeletionReaper (line 1186) are still routed via require(./src/...). Phase 15 deploy was a 23-CF redeploy with the watchpartyTick extension as the only modified function. No code changes to the account-deletion path; redeploy is no-op.
- **Sentry breadcrumbs integrate cleanly with P13-02 init.** All 6 P15 breadcrumb sites in js/app.js (lines 1080, 8281, 8522, 11340, 11354) use the established defensive pattern (typeof Sentry !== undefined && Sentry.addBreadcrumb) matching the P13-02 init at app.html:65. New categories (tupleNames, tupleAutoTrack, coWatchPromptDeclined) integrate as-is -- Sentry category field accepts any string.
- **Firestore rules -- additive only.** The 5th UPDATE branch (firestore.rules:181-200) is OR-d onto the prior 4 branches via ||. None of the existing 4 branches were modified. Account-deletion writes go through the Admin SDK path which bypasses rules entirely.

**Evidence:** ~/queuenight/functions/index.js:1175-1190, ~/queuenight/firestore.rules:170-202, js/app.js:1080,8281,8522,11340,11354 Grep.

---

## E2E Flow Verification

### Flow 1 -- Watchparty -> Auto-Track Confirmation: PASS

**Read-through:**

1. Watchparty starts (P7) -> host participants[mid].startedAt populated
2. Host triggers post-session via openPostSession(wpId) at js/app.js:11304
3. Early-return guard at line 11309 lets the call proceed (not dismissed, not rated)
4. P15 stash block at 11319-11366: state._pendingTupleAutoTrack = null first, then if wp.titleId + t.kind === TV + participants.length >= 1 AND resolveAutoTrackEpisode(wp, t) returns a tier 1-4 hit -> stash populated with {titleId, memberIds, season, episode, sourceField, sourceWpId}
5. #wp-post-session-sub render at 11367-11394 reads stash; if present, appends the auto-track row with verbatim copy and Yes/Edit buttons (data-cv15-action per MEDIUM-7)
6. cv15AttachPostSessionDelegate() at 11393 binds the delegated listener (idempotent via data-cv15-bound attr)
7. Tap Yes -> cv15ConfirmAutoTrack at 11406 -> writeTupleProgress(at.titleId, at.memberIds, at.season, at.episode, watchparty) (line 11409)
8. writeTupleProgress at 8458 stamps actingTupleKey: tk to satisfy the rule echo (line 8476)
9. Title-doc tupleProgress[tk] populated -> next titlesRef onSnapshot re-renders S2 detail modal section + S1 pickup widget

**All chain links present.** Tier 4 (host-progress-plus-1) is the only producer that fires today (tiers 1-3 are future-ready scaffolding) -- documented in 15-03-SUMMARY and routed to human UAT item #2 in 15-VERIFICATION.md.

---

### Flow 2 -- Trakt Sync -> S5 Co-Watch Prompt -> Tuple Creation: PASS

**Read-through:**

1. User taps Sync (or auto-sync runs) -> trakt.sync writes history to titles + members
2. members/{me}.trakt.lastSyncedAt = Date.now() written at js/app.js:665
3. P15 hook at 670-672: trakt.detectAndPromptCoWatchOverlap() fires with .catch guard
4. Detector reads state.family.coWatchPromptDeclined (hydrated by family-doc onSnapshot at 4360) -> skips already-declined tuple keys (cross-session persistence -- REVIEW MEDIUM-9)
5. For each tuple where 2+ members watched within +/-3hr (single-comparator REVIEW MEDIUM-10 -- cv15EpisodeOrdinal: season*1000+episode): show S5 modal with verbatim copy
6. Yes -> cv15CoWatchPromptAccept at 1046 -> writeTupleProgress(c.titleId, c.memberIds, c.season, c.episode, trakt-overlap) (1049)
7. No -> cv15CoWatchPromptDecline at 1057 -> dotted-path write coWatchPromptDeclined.{tk} = Date.now() to families/{code} (1064)
8. Rule allowlist at firestore.rules:199 permits the write via the 5th UPDATE branch (closes the 15-07 documented rules gap that 15-08 closed cross-plan)

**All chain links present.** Decline persistence requires real Trakt OAuth + paired family members + multi-account session to verify -- routed to human UAT item #1 (the marquee verification per 15-VERIFICATION.md).

---

### Flow 3 -- Live-Release Push -> Nominate: CONCERN (1 finding)

**Read-through:**

1. CF watchpartyTick runs every 5 min -> P15 sweep block at functions/index.js:852-1033
2. HIGH-3 hourly throttle (lines 870-872) -> skip if liveReleaseSweepLastRunAt < 1h ago
3. HIGH-4 stale-data skip (lines 895-897) -> skip titles whose nextEpisodeRefreshedAt > 7 days old (Sentry breadcrumb)
4. For each title with nextEpisode.airDate in 23-26h (MEDIUM-11 widened bound) + >=2 trackers + no existing watchparty for titleId+startAt+/-N: build push
5. MEDIUM-12 framing: title = New episode {tonight/tomorrow/Weekday}, body = {Show} S{N}E{M} -- watch with the couch? (lines 998-999)
6. Idempotency flag-then-fire: liveReleaseFiredFor.{epKey} = now (1003), then sendToMembers(...) with eventType: newSeasonAirDate (1014) and url: /?nominate={titleId}&prefillTime={airTs} (1013)
7. User taps push -> service worker notificationclick opens URL -> app boots

**CONCERN -- Steps 7->8 break:** The deep-link query params ?nominate={titleId} and &prefillTime={airTs} are NOT consumed anywhere in js/app.js. Verified by Grep: params.get(nominate) returns 0 matches, prefillTime returns 0 matches. The existing deep-link handler maybeOpenIntentFromDeepLink (js/app.js:2560) only reads ?intent={intentId} (an existing intent ID), not ?nominate={titleId} (a titleId for a NEW nomination).

**Effective behavior today:** Push tap opens the app to the default screen (Tonight tab). The user sees the show in the tracker but does NOT land in the Flow B nominate modal with the prefilled start time -- they would need to manually navigate Show -> Watch with the couch? -> enter time. The push works as a notification but NOT as a 1-tap nominate per D-11.

**Severity:** MEDIUM. Not a regression (pre-existing scope gap; the URL was specified by D-11 in 15-CONTEXT.md but no client handler was planned in any of 15-01..15-08). Not blocking -- push delivery + tracking core both work -- but the marquee D-11 1-tap nominate-from-push UX is degraded to tap-then-navigate.

**Recommendation:** Add a maybeOpenNominateFromDeepLink() handler that parses ?nominate={titleId}&prefillTime={airTs}, removes the params from URL (matching the maybeOpenIntentFromDeepLink pattern at line 2569-2572), waits for state.titles to hydrate, then calls openFlowBNominate(titleId, { proposedStartAt: parseInt(prefillTime, 10) }). Estimated work: 1 small follow-up plan (~30-50 lines client + 0 server).

---

### Flow 4 -- Couch Viz Round-Trip Unchanged: PASS

**Read-through:**

1. User taps a member chip -> toggleCouchMember(memberId) near js/app.js:14085 writes state.couchInTonight[mid] = {in: true/false, at: ts, ...}
2. persistCouchInTonight() writes to families/{code}.couchInTonight (and dual-writes legacy couchSeating)
3. Family-doc onSnapshot fires at js/app.js:4344 -> re-hydrates state.couchInTonight = couchInTonightFromDoc(d) (line 4354)
4. state.couchMemberIds = couchInTonightToMemberIds(...) (4355)
5. P15 hydration runs in same callback (lines 4358 + 4360) -- no race because both happen synchronously inside the same snapshot handler
6. renderCouchViz() re-runs at line 4363 -> V5 roster pills render

**All chain links unchanged.** Phase 15 piggybacks on the same callback rather than creating a parallel one. The 5 P14 render hooks downstream (renderCouchViz, renderFlowAEntry, renderPickerCard, applyModeLabels, renderOwnerSettings) all still fire in their original order.

---

## Concerns

### Concern #1 -- Live-release push URL is not handled (MEDIUM)

**Surface:** Live-release push CF emits url: /?nominate={titleId}&prefillTime={airTs} (functions/index.js:1013).

**Issue:** No client handler reads ?nominate= or ?prefillTime=. Verified via Grep: zero matches in js/app.js. The existing maybeOpenIntentFromDeepLink handler at js/app.js:2560 only reads ?intent= (existing intent ID), not ?nominate= (new nomination titleId).

**Impact:** Push tap opens the app but does NOT open Flow B nominate prefilled. User must manually navigate Show -> Watch with the couch? -- the marquee D-11 1-tap UX is degraded to multi-tap. Push delivery + per-show tracking + idempotency all still work; only the deep-link routing is missing.

**Pre-existing vs. introduced:** Pre-existing scope gap. The URL was specified in 15-CONTEXT.md D-11 but no plan in 15-01..15-08 added the client URL parser. Phase 15 did not break a working flow; it shipped the CF half of a flow whose client half was implicitly deferred.

**Recommendation:** Single follow-up plan adds maybeOpenNominateFromDeepLink(). Pattern mirrors maybeOpenIntentFromDeepLink at js/app.js:2560-2601: parse params, strip them via window.history.replaceState, retry-poll until state.titles hydrates, then call openFlowBNominate(titleId, { proposedStartAt: parseInt(prefillTimeRaw, 10) }). Wire into the same boot site that already calls maybeOpenIntentFromDeepLink (call site visible at js/app.js:2601). Estimated 30-50 lines client-only; no rules / CF / server changes needed. Could ship as a 1-task hotfix or be folded into the next phase.

**Telemetry recommendation:** Add a Sentry breadcrumb on URL-handler entry so post-deploy we can measure tap-through rates. Today the tap is invisible to product analytics.

---

## Summary

| Area | Finding | Status |
|---|---|---|
| Phase 7 -- openPostSession extension | Additive, all guards + reset preserved | PASS |
| Phase 11 -- helper namespace | All 9 P15 helpers defined exactly once; placed in dedicated grep-marked region after existing TV-progress block | PASS |
| Phase 14 -- family-doc hydration race | Single onSnapshot callback hydrates couchInTonight + tupleNames + coWatchPromptDeclined synchronously; no race | PASS |
| Phase 14 -- renderCouchViz / renderFlowAEntry | Untouched (1 def each); P15 renderPickupWidget added as 3rd container in DOM order between viz and flowA | PASS |
| Phase 14 -- couchPing deferral | Still toast + Sentry breadcrumb only; P15 did not wire push fan-out | PASS |
| Phase 6 -- server NOTIFICATION_DEFAULTS | 8th key additive; sendToMembers filter logic unchanged; default-on path correct | PASS |
| Phase 6 -- DR-3 friendly-UI deferral | 8th key follows P14 7-key pattern: legacy Settings only, friendly-UI maps NOT extended | PASS |
| Phase 13 -- account deletion | CFs unchanged; redeploy no-op; Admin SDK bypasses rules | PASS |
| Phase 13 -- Sentry breadcrumbs | All 6 P15 breadcrumb sites use defensive typeof Sentry guard matching P13-02 init pattern | PASS |
| Flow 1 -- Watchparty -> auto-track confirmation | All chain links present; tier 4 only producer today (documented) | PASS |
| Flow 2 -- Trakt sync -> S5 -> tuple | All chain links present; rule allowlist closed by 15-08 | PASS |
| Flow 3 -- Live-release push -> nominate | CF emits URL; client deep-link handler MISSING | **CONCERN (MEDIUM)** |
| Flow 4 -- Couch viz round-trip | Single-callback hydration; P15 piggybacks correctly | PASS |

**Regressions:** 0
**Gaps:** 1 (Concern #1 above -- pre-existing scope gap exposed by P15 CF half shipping)

Phase 15 ships cleanly with respect to prior-phase contracts. The single MEDIUM concern is a self-contained UX gap with a small, well-scoped fix path that does not require any rules/CF changes.

---

_Integration check: 2026-04-27_
_Checker: Claude (gsd-integration-checker)_
