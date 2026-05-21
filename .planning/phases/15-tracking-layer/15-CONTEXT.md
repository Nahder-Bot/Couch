# Phase 15: Tracking Layer - Context

**Gathered:** 2026-04-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Per-watching-group watch progress + new-season air-date push notifications + live-release watchparty auto-prompts. Tracks GROUPS (subsets of family members), not just individuals — Couch's primary differentiator vs Trakt.

**3 capabilities (locked from `seeds/decision-ritual-locked-scope.md` Phase 15 section):**
1. Per-arbitrary-subset progress tuples ("watched Invincible S4 with wife + stepson, finished episode 8")
2. New-season air-date push notifications (TMDB season metadata + existing FCM stack)
3. Live-release scheduling — 24h-before push that one-taps into a Flow B nomination ("Severance S2E3 airs Friday 9pm — schedule a watchparty?")

**Not in scope (would be other phases):**
- Recurring/calendar watchparty primitives (Phase 16)
- Star ratings UI changes (data model already exists)
- New decision flows (Flow A/B locked in Phase 14)

</domain>

<decisions>
## Implementation Decisions

### Group-progress data shape

- **D-01 (Capture trigger):** Auto-track from watchparty session ending — members who joined the watchparty + episode queued = automatic progress tuple. PLUS allow explicit "toggle watched" override per tuple after the fact (user can mark eps watched outside a watchparty, or correct mistakes). Reuses Phase 7 watchparty roster + Phase 8 intent payload.
- **D-02 (Group identity):** Sorted `Set<memberId>` is the canonical group key. No formal "group" entity — same 2 people watching together = same tuple thread automatically. Layer on optional **fun naming**: user can name a tuple ("Wife and me", "Kids", "Date night") for display purposes only; tuple stays the data key. Names editable any time. No setup required to start tracking.
- **D-03 (Granularity):** Last-watched episode only. Per-tuple-per-show data shape: `{seasonIndex, episodeIndex, watchedAt}`. Smallest viable shape; matches Netflix/Trakt 90% case ("continue from S4E8"). Required for live-release auto-prompt (D-13/D-14 need episode-level state). Skipping-around use case deferred.
- **D-04 (UI surface):** Two surfaces — (a) detail-modal section "Your couch's progress" listing each tuple + its last-watched episode (reuses Phase 14-05 detail-modal pattern); (b) Tonight tab "Pick up where you left off" widget (cross-show roll-up). Covers both "I have a show in mind" and "what should I continue?" flows.

### Episode source of truth

- **D-05 (Source):** Both — Trakt sync seeds initial state for connected users; manual marks (D-01 watchparty auto-track + explicit toggles) always take precedence after that. Latest manual write wins regardless of Trakt sync timing.
- **D-06 (Trakt → group attribution):** Inferred from co-watch overlap WITH user confirmation. When 2+ family members both Trakt-watched the same episode within a window (e.g., 3-hour overlap), surface a soft prompt: "Looks like you watched this together — group your progress?" with Yes/No (defaults to No / always editable later). Combines automation hint with explicit user control. Does NOT silently fabricate group tuples.
- **D-07 (Non-Trakt UX):** Manual is first-class. Tracking works fully without Trakt OAuth. Trakt is positioned as an optional "jump-start your history" accelerator in Settings — same opt-in posture as the rest of the app. No nag, no friction gate.
- **D-08 (Conflict resolution):** Independent tuples — no conflict possible. Trakt populates `[memberId]` solo tuple. Watchparty/manual populates `[m1, m2, ...]` group tuples. Both states coexist (e.g., user is at S4E10 solo, S4E8 with wife). No reconciliation needed because tuples never overlap.

### Season-notif subscription

- **D-09 (Default subscription):** Auto-subscribe on watch. Anyone who has watched ≥1 episode of a show is auto-subscribed to new-season pushes. Per-user toggle for unsubscribing.
- **D-10 (Subscription trigger):** Anyone in any watched-tuple (solo OR group). Union-of-tuples logic — if your `memberId` appears in any progress tuple for the show, you're subscribed. Captures "watched S1 alone, S2 with wife" → still subscribed.
- **D-11 (Push payload):** Soft prompt + Flow B link. Copy: `"{Show} S{N} hits {Provider} {day}. Watch with the couch?"`. Tap opens Flow B nominate flow (Phase 14-08) prefilled with the show. Default-on. New 8th push category `newSeasonAirDate` extending Phase 14-09 D-12 framework.
- **D-12 (Subscription management):** Two layers — (a) Settings → Notifications → "New season air dates" toggle (8th category in D-12 framework); (b) per-show "Stop notifying me about this show" control in detail modal. Global kill-switch + per-show granularity.

### Live-release prompt gating

- **D-13 (Timing):** 24h before air time. Per the seed doc literally — fires Thursday 9pm for Friday 9pm episode. Gives the family planning time without being so far ahead they forget.
- **D-14 (Threshold):** ≥2 family members tracking the same show. Suppresses solo prompts — "schedule a watchparty?" only meaningful with someone to schedule WITH. Reduces noise; makes feature feel relevant rather than spammy.
- **D-15 (Frequency, v1):** Every episode that meets the threshold. Worst case: ~10 prompts/show/season. Mitigated by D-14 gate. Re-evaluate post-launch if user feedback says noisy.
- **D-16 (Suppression):** Already-scheduled wins. If a watchparty for this show + episode already exists for the relevant time window, suppress the prompt. Simplest universally-desired rule. No dismissed-prompt tracking in v1 — predictability over self-correcting.

### Claude's Discretion

- Specific Firestore document path for progress tuples (per-family subcollection vs document field on title — researcher can pick based on query patterns)
- Exact CF schedule cadence for TMDB season-metadata polling (daily vs hourly — researcher can pick based on TMDB rate limits and freshness needs)
- Tonight-tab widget visual design (planner can decide based on existing patterns, e.g., reuse 14-05 tile pattern or new card)
- Detail-modal section placement order (above/below cast/reviews)
- Naming UI for tuples (inline rename vs Settings panel — defer to UI-phase if frontend-heavy)
- Conflict-prompt copy + button labels (planner picks)

### Folded Todos
None — no pending todos matched Phase 15 scope.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 15 scope source
- `.planning/seeds/decision-ritual-locked-scope.md` §"Phase 15 — Tracking layer" — the locked scope this discussion refines (3 capabilities, no scope-creep room)
- `.planning/ROADMAP.md` row "15. Tracking Layer" — phase entry + originally-tagged-Phase-14 audit note

### Cross-phase decisions to preserve
- `.planning/phases/14-decision-ritual-core/14-CONTEXT.md` D-09 — "extend existing `families/{code}/intents/` collection" pattern; Flow B nomination is the target for live-release one-tap
- `.planning/phases/14-decision-ritual-core/14-CONTEXT.md` D-12 — 7-category push notification framework; Phase 15 adds the 8th category `newSeasonAirDate`
- `.planning/phases/14-decision-ritual-core/14-08-SUMMARY.md` — Flow B nominate flow that the live-release prompt prefills
- `.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md` — push category framework + NOTIFICATION_DEFAULTS / DEFAULT_NOTIFICATION_PREFS / NOTIFICATION_EVENT_LABELS triad
- `.planning/phases/14-decision-ritual-core/14-LEARNINGS.md` — patterns from Phase 14 incl. atomic sibling primitive insertion + cross-repo deploy ordering

### Code locations to reference
- `js/app.js:400-580` — Trakt OAuth + history sync (existing per-individual data flow; D-05/D-06 build on top)
- `js/app.js:708-728` — last-played episode logic from Trakt history (already extracts `seasons[].episodes[]`)
- `js/app.js:843-849, 6941-6942` — TMDB metadata extraction (`number_of_seasons`, `episode_run_time`)
- `js/firebase.js`, `js/state.js` — Firestore primitives + state container patterns
- `js/utils.js` — `flashToast`, `escapeHtml`, `haptic` helpers

### Cloud Functions (deploy-mirror sibling repo)
- `~/couch-deploy/functions/index.js` — existing `onSchedule` + `onIntentCreated` + push fan-out patterns (Phase 14-06 + 14-09 work)
- `~/couch-deploy/firestore.rules` — 4 existing UPDATE branches; Phase 15 may need a 5th for tracking-tuple writes
- `~/couch-deploy/.firebaserc` — project ID `queuenight-84044` (immutable)

### External references
- TMDB API `/tv/{id}` and `/tv/{id}/season/{n}` endpoints — season air date discovery (existing TMDB integration in `js/app.js`)
- TMDB rate limit: ~40 req/10s — must budget any new polling against this (CLAUDE.md)
- Trakt API: existing OAuth scopes already cover episode history reads (`/users/me/history/episodes`)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Trakt OAuth + history sync** (`js/app.js:400-580`) — per-individual episode-level data already flowing for connected users. D-05 seeds from this; D-06 reads it for co-watch overlap inference.
- **FCM push stack** + `notify*` helpers — Phase 6/14 work, includes the `userPushTokens` collection, NOTIFICATION_DEFAULTS server gate, and per-event-type fan-out CFs. D-11/D-12 add 1 new push event type (`newSeasonAirDate`) using this exact pattern.
- **`onSchedule` Cloud Function pattern** — `watchpartyTick` (`functions/index.js:642`) shows the recurring-poll pattern. D-13 daily TMDB poll uses the same primitive.
- **Flow B nomination flow** — Phase 14-08 ships the 1-tap target for D-11 live-release pushes. `createIntent({flow:'nominate', titleId, proposedStartAt})` is the call site.
- **Detail-modal section pattern** — Phase 14-05 added a TMDB community-reviews section to the detail modal. D-04 adds a "Your couch's progress" section in the same place using the same idiom.
- **Push category Settings framework** — Phase 14-09 D-12 ships the 7-category Settings UI (`NOTIFICATION_EVENT_LABELS`). D-12 adds an 8th key without restructuring.
- **TMDB metadata fields** — `t.kind` (Movie/TV), `t.seasons` (number_of_seasons), `t.episode_run_time` already populated. D-03 needs a new `seasonIndex`/`episodeIndex` per-tuple state but TMDB fields used for lookup.

### Established Patterns
- **Member-keyed Firestore maps** — Phase 14-10 `couchInTonight` shape (`{[memberId]: {in, at, proxyConfirmedBy?}}`) is the closest analog to D-02 tuple-keyed progress. Pattern proven in production.
- **BRAND-voice push copy** — Phase 14-09 D-12 sets the tone (warm, declarative, no exclamation points). D-11 push payload follows the same voice.
- **Atomic sibling primitive insertion** — Phase 14-05 Task 2 (openTileActionSheet inserted next to openActionSheet without modifying it). When adding new tracking helpers in Phase 15, follow this pattern: don't refactor existing trakt/history code; insert sibling primitives.
- **Per-event preference defaults** — `DEFAULT_NOTIFICATION_PREFS` map at `js/app.js:100-130`. Add `newSeasonAirDate: true` here.
- **`onSnapshot` re-render hooks** — every Firestore-driven UI surface uses `families/{code}` onSnapshot. Tonight widget (D-04b) hooks the same pattern for cross-show progress.

### Integration Points
- **Tonight tab** — D-04b widget renders inside `#screen-tonight` near existing surfaces (couch viz, picker card, Flow A/B entries). Likely below couch viz, above picker.
- **Detail modal** — D-04a section renders inside the existing detail modal structure (next to cast + reviews from 14-05).
- **Settings → Notifications** — D-12 adds entry to `NOTIFICATION_EVENT_LABELS` Settings UI (DR-3 friendly-UI parity follow-up still deferred per Phase 14-09 — friendly Settings page does NOT need the new key, only legacy page).
- **Watchparty end handler** — D-01 hooks `onWatchpartyEnd` (or equivalent — researcher confirms exact location) to write the auto-progress tuple.
- **Trakt history import callback** — D-05/D-06 hooks the existing import path to seed `[memberId]` solo tuples + run the co-watch overlap check.

</code_context>

<specifics>
## Specific Ideas

- **Co-watch overlap confirmation prompt copy** (D-06): "Looks like you and Ashley both watched Severance S2E3 around the same time. Group your progress?" — soft, opt-in, defaults to No.
- **Group naming as "fun":** D-02 lets users attach playful names to tuples ("Date night", "Kids' couch") — not required, surfaces as inline rename in detail-modal progress section. The DATA stays as `Set<memberId>` regardless of name.
- **Live-release push body** (D-11): "{Show} S{N}E{M} airs {day} at {time}. Watch with the couch?" — explicit episode reference (not just season) since D-15 says every episode is a prompt.
- **No `progressGroup` entity in Firestore** (D-02): keep tuple-as-key. If user names `[a,b]` as "Date night", store `{tupleKey: "a,b", name: "Date night"}` in a separate `tupleNames` map at family level — name is decoration, not identity.

</specifics>

<deferred>
## Deferred Ideas

- **Recurring watchparty primitive** (`watchpartySeries` doc) — Phase 16 Calendar Layer scope, not Phase 15.
- **Skipping-around episode tracking** (Set<episodeId> per tuple instead of last-episode-only) — could revisit if D-03's last-watched-only model proves limiting in usage. Defer to v2.
- **Episode-progress conflict UI** for the rare case where Trakt sync runs after a manual mark — D-08 says independent tuples avoid this, but if we ever cross-pollinate sources (e.g., backfill group tuples from Trakt heuristically), we'll need conflict UI. Not needed in v1 per D-06 prompt model.
- **Dismissed-prompt suppression learning** (D-16 alternate) — track which users dismiss live-release prompts and suppress future prompts for that show/user. Self-correcting feedback. Defer to post-launch if D-15+D-16 prompts feel noisy.
- **Calendar/agenda surface** — Phase 16 territory.
- **Trakt-required mode** — D-07 keeps Trakt opt-in. If standalone tracking proves messy/incomplete, could revisit a "Connect Trakt for richer tracking" gate. Not v1.

</deferred>

---

*Phase: 15-tracking-layer*
*Context gathered: 2026-04-26*
