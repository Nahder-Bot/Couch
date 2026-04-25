---
phase: 14-decision-ritual-core
captured: 2026-04-25
source: /gsd-discuss-phase 14 (text mode, /remote-control session)
locked-scope: .planning/seeds/decision-ritual-locked-scope.md (Phase 14 section, multi-round scoping 2026-04-24)
mode: discuss
---

# Phase 14 — Decision Ritual Core / CONTEXT

## Goal

Replace the vote-prominent Tonight tile with a couch-centered, conversation-first ritual. Two parallel flows (group rank-pick when together, solo nominate when apart) backed by a unified `watchpartyIntent` primitive. This is Couch's product moat — what nobody else ships — and reshapes the core UX of the app.

## Locked decisions

These flowed from the multi-round scoping conversation 2026-04-24 (see `seeds/decision-ritual-locked-scope.md`) PLUS the 8 discuss-phase 14 gray areas resolved 2026-04-25. Downstream agents (researcher, planner) should treat these as fixed inputs, not open questions.

### D-01 — Already-watched filter is strict, member-aware, with rewatch override

- Strict: ANY couch member has watched a title → hide it from discovery for the whole couch.
- Sources of "watched" status: Trakt sync history + voted Yes prior + voted No prior + manually marked-watched.
- Per-title override: "Rewatch this one" tap re-enables the title for that couch session.
- **Invitation bypass:** the filter applies to MY discovery view (browse / spin / swipe), NOT to invitations from other family members. If someone else nominates a title I've watched, I still get the push and can choose to join the rewatch.

### D-02 — Tiered candidate filter (3 tiers) + most-restrictive privacy hierarchy

- **Tier 1 (default visible):** titles where every couch member has it in their personal queue.
  - Sort: average of member-queue ranks; ties broken by TMDB / Trakt rating.
- **Tier 2 (default visible, below T1):** titles ≥1 couch member recommends.
- **Tier 3 (hidden behind expand):** titles ONLY off-couch members want — "watching her movie without her."
- **Tier 3 toggle hierarchy: most-restrictive wins** (account-level / family-level / group-level).
  - If anyone in the chain says "hide T3", T3 stays hidden.
  - "Show T3" only takes effect when no other level says hide.
  - Privacy-leaning posture, matches Phase 13 compliance philosophy.

### D-03 — Per-member personal queue (NEW PRIMITIVE)

- Each family member has their own ordered queue.
- Drag-to-reorder UI lives in Library tab (or new "My queue" surface — planner decides).
- Adding from Add tab pushes to bottom of personal queue + family library.
- **Yes votes are unified with queue:** voting Yes on a title auto-adds it to the bottom of your personal queue. You can drag-reorder afterward. (Resolves discuss-Q2.)

### D-04 — Tile redesign

**Tile face content:**
- Poster + title + year + runtime
- "X want it" pill: 3 micro-avatars + "+N" overflow chip
- ▶ Trailer button
- **Vote button is REMOVED from tile face** (demoted; see D-05 for where it goes)

**Tile primary action sheet** (single tap on tile body):
- Watch tonight
- Schedule for later
- Ask family
- Vote (de-emphasized, kept for completeness)

**Hidden-behind-⋯ items now surfaced** in the tile detail view:
- Trailer (lazy-loaded)
- Providers (where to stream)
- Synopsis
- Cast
- Reviews

### D-05 — Vote mode preserved, accessible from Add tab

- Vote mode (swipe through unvoted titles to populate queue) is KEPT.
- Different purpose from tile action sheet: bulk curation when you have a backlog.
- Lives under **Add tab** (the discovery / curation surface).
- Surfaces automatically via "Catch up on votes (N)" CTA when ≥10 unvoted family titles exist.

### D-06 — Couch visualization (SVG sofa)

- SVG sofa with avatar circles seated on cushions.
- Empty cushions are "+ add to couch" affordances (tap to seat yourself or invite).
- 2-3 mockup variants generated via `/gsd-sketch` at plan time (sketch-driven design step).
- **Adaptive seat count, capped at 8 cushions** (resolves discuss-Q4):
  - Common case (2-6 members): renders cleanly with one cushion per member.
  - Edge case (7+ members): 7 individual cushions + 1 "+N more" overflow cushion that opens a sheet listing the rest.
  - Min 2 cushions, max 8 cushions; couch SVG sizes to family.

### D-07 — Flow A: Group rank-pick + push-confirm

1. Members select themselves on Couch viz (cushion-tap → claim seat).
2. App shows ranked list per tier (T1 first, T2 below, T3 hidden behind expand).
3. Picker selects a title → roster screen → picker proxy-confirms members "in person" (taps to mark them "in") → only unmarked members get push.
4. Push payload to unmarked members: vote In / Reject / Drop out.
5. **Reject-majority → auto-prompt picker for #2 from ranked list (1 retry, then expire).** Any rejector can attach a counter-nomination ("rejected because I want X instead") — counter goes back to picker as a sub-prompt.
6. **Counter-nomination chain capped at 3 levels** (resolves discuss-Q3):
   - Original pick + up to 2 counters allowed.
   - On the 3rd round, picker MUST decide between the current options on the table — no further counters accepted.
   - Picker UI on round 3: "X options on the table — pick one or end nomination."
   - If picker doesn't act before hard-expire (11pm same-day), the intent expires.
7. **Quorum to convert intent → watchparty:** picker + ≥1 confirmed In (low bar; Phase 11-05 lobby flow takes over from there).
8. **Hard expire:** 11pm same-day if not converted.

### D-08 — Flow B: Solo-nominate + invite + counter-time

1. Member nominates a title with a proposed time.
2. Push to other members: join @ proposed time / counter-suggest (later/earlier with note) / decline.
3. **Counter-time:** nominator decides — accepts / rejects / picks compromise per counter (option B from scope locking).
4. **Auto-convert intent → watchparty at T-15min if any Yes RSVPs exist.**
5. **All-No edge case:** auto-cancel + notify nominator immediately.
6. **Hard expire:** T+4hr past proposed start time.

### D-09 — Unified data primitive: watchpartyIntents

```
watchpartyIntents/{intentId}
  flow: 'rank-pick' | 'nominate'
  creatorId: uid
  titleId: string
  proposedStartAt?: timestamp     // Flow B only
  expectedCouchMemberIds: string[] // Flow A pre-selected couch
  rsvps: {
    [memberId]: {
      state: 'in' | 'reject' | 'drop' | 'maybe'
      counterTime?: timestamp
      counterTitleId?: string     // Flow A counter-nomination
      note?: string
      at: timestamp
    }
  }
  status: 'open' | 'converted' | 'cancelled' | 'expired'
  convertedToWpId?: string
  createdAt: timestamp
  expiresAt: timestamp
  counterChainDepth: number       // 0 = original; cap at 3 per D-07
```

Single onSchedule CF (`watchpartyIntentTick`) handles expiry sweeps + conversion checks. Cadence: every 5 min (matches existing `watchpartyTick` pattern).

### D-10 — Onboarding for new primitives: hybrid

(resolves discuss-Q6)

- **Changelog:** v34 entry added to existing `/changelog.html` page (Phase 12 infra) describing the redesign — for users who go looking.
- **In-context tooltips:** lightweight, dismiss-on-interaction tooltips at the moment a user first encounters each new primitive:
  - Tonight tab first-load post-update: tooltip on Couch viz — "Tap a cushion to seat yourself."
  - First tile tap post-update: tooltip on action sheet — "These are your options for this title."
  - First Library tab visit post-update: tooltip on queue — "Drag to reorder your queue."
- **NO mandatory modal.** Modals get dismissed without being read; this approach pulls users into discovery at the moment of relevance.
- One-time per user per primitive; tracked via a small client-side `state.onboarding.seen.{primitiveId}` map.

### D-11 — Empty states with action-leading CTAs

(resolves discuss-Q7) Every empty state has 1-2 CTAs that pull toward the next concrete action. No dead ends.

| State | Copy | CTAs |
|---|---|---|
| (a) Brand-new family, nothing watched | "Your couch is fresh. What should be the first?" | "Add a title" → Add tab. "Connect Trakt to import history" → settings. |
| (b) Empty personal queue | "Your queue is empty. Vote on a few titles to fill it up." | "Open Vote mode" + small carousel of 3-5 trending family titles |
| (c) Flow A entry — no couch yet | "Who's on the couch tonight? Tap to seat yourself + invite family." | Couch viz with all cushions glowing as +add affordances |
| (d) All watched (T1+T2 empty) | "You've seen everything in queue. Revisit a favorite or expand?" | "Show rewatch options" (reveal T3) + "Discover more" → Add tab |
| (e) Flow A reject-majority, no #2 | "No alternative pick. Try again or anyone nominate?" | "Cancel for tonight" + "Open Flow B" |

### D-12 — Push notification copy + cadence

(resolves discuss-Q8)

**Cadence: critical immediate, contextual batched.**
- **Immediate:** state changes needing the user's action (your turn to vote, your nomination got a counter-time, watchparty starts in 15 min, hard-expire warning).
- **Batched (every 60-90s):** info-only state changes (someone joined the lobby, someone's queue changed) — coalesced into one digest push.
- Quiet-hours respected (Phase 6 enforces this; new categories inherit).

**Copy tone: warm, family-tapping-shoulder.** First-name + title. No "Notification:" prefix, no UTC timestamps, no transactional jargon.

| Moment | Push text |
|---|---|
| Flow A pick | "Dad picked Inception for tonight. In, reject, or drop?" |
| Flow A reject-majority | "The couch passed on Inception. Dad's picking again." |
| Flow A counter-nom | "Mom countered with The Holdovers. Vote on it?" |
| Flow B nominate | "Sister wants to watch Past Lives at 8pm. Join, counter, or pass?" |
| Flow B counter-time | "Brother countered with 9pm. Sister is deciding." |
| Flow B convert (T-15) | "Past Lives in 15 min — head to the couch." |
| Hard expire | "Tonight's pick expired. Try again tomorrow?" |

**New per-event toggle categories** (added under Phase 6 notifPrefs system, mirroring Phase 12 POL-01 UI pattern):
- `flowAPick` — your couch picked something (you got pushed for vote)
- `flowAVoteOnPick` — someone voted on YOUR pick (picker only)
- `flowARejectMajority` — you're picker; reject majority hit
- `flowBNominate` — someone wants to watch with you @ time
- `flowBCounterTime` — your nomination got a counter (nominator only)
- `flowBConvert` — auto-convert imminent in 15 min
- `intentExpiring` — hard-expire warning at T-30min

## Suggested plan structure

The seed file proposed 8 plans. After resolving the 8 gray areas, this remains a good split. Final plan list will be locked at `/gsd-plan-phase 14`.

1. **14-01 Already-watched filter** (D-01) — 4 sources + per-title rewatch override + invitation bypass
2. **14-02 Per-member queue primitive** (D-03) — Firestore field + drag-reorder UI in Library tab + Yes-vote unification
3. **14-03 Tiered candidate filter** (D-02) — 3-tier rendering + most-restrictive toggle hierarchy
4. **14-04 Couch visualization** (D-06) — SVG sofa + adaptive seat count + overflow cushion + sketched first via `/gsd-sketch`
5. **14-05 Tile redesign** (D-04) — face content + action sheet + vote demotion + detail-view surfacing
6. **14-06 watchpartyIntent primitive + CF** (D-09) — Firestore schema + watchpartyIntentTick onSchedule CF + expiry/conversion logic
7. **14-07 Flow A — group rank-pick** (D-07) — picker UI + roster proxy-confirm + reject→#2 + counter-nomination chain (3-level cap)
8. **14-08 Flow B — solo-nominate** (D-08) — nominate UI + counter-time + nominator-decides + auto-convert at T-15
9. *(probable add)* **14-09 Onboarding tooltips + empty states + push integration** (D-10, D-11, D-12) — touches the seven new push categories, the five empty-state designs, and the three onboarding tooltip moments. Could split or absorb into the relevant flow plans; planner decides.

Requirement IDs to mint at plan-phase: `DECI-01` through `DECI-13` (range — actual count locked at /gsd-plan-phase 14).

## Carry-over UAT bug from seed

> "When clicking a show in here it wasn't easy to click out" (referring to title detail modal in Library/Queue context). The ✕ close button scrolls out of view on long detail content.
>
> **Fix candidate:** make `.detail-close` `position: fixed` within the modal so it stays accessible regardless of scroll position.

Capture as **14-05 Tile redesign sub-task** OR Phase-9 follow-up (depending on planner scope assessment). Don't lose it.

## Anti-patterns / pitfalls

Things to NOT do during research and planning:

1. **Don't mock the Firestore in tests** — Phase 13 hit this; integration tests must use the Firebase Emulator pattern already established in `tests/rules.test.js`.
2. **Don't use absolute Windows paths inside worktree-isolated executor agents** — Phase 13 Wave 1 hit this; couch-side files via worktree-relative paths only. queuenight-side files (deploy mirror) via absolute paths.
3. **Don't add a build step / bundler** — CLAUDE.md non-negotiable; no webpack/vite/rollup.
4. **Don't move TMDB key / Firebase config server-side** — public-by-design per CLAUDE.md.
5. **Don't auto-add Yes votes to queue without making this discoverable** — D-03 unifies queue+vote, but users need to see this happening (toast confirmation, inline animation) so it doesn't feel like surprise behavior.
6. **Don't ship Couch SVG without `/gsd-sketch` first** — D-06 explicitly defers visual exploration to sketch phase; planner should NOT lock visuals before sketches are reviewed.
7. **Don't conflate the existing `watchparty` primitive with the new `watchpartyIntent` primitive** — they're separate Firestore collections. Intent → Watchparty is a one-way conversion (D-07.7 / D-08.4). Once converted, intent doc stays as historical record (status='converted') with `convertedToWpId` pointer.
8. **Don't forget Phase 6's notifPrefs allowlist** — D-12's seven new push categories MUST be added to the server-side `NOTIFICATION_PREFS_ALLOWLIST` AND the client-side UI list (matches Phase 12 POL-01 pattern). Skipping the allowlist means new pushes silently no-op.

## Research targets (for /gsd-phase-researcher)

When the researcher is spawned next, these are the high-value investigation areas:

1. **Existing `watchparty` Firestore schema + CF patterns** — `watchpartyIntent` mirrors the lifecycle pattern; researcher should map similarities + differences and identify reusable CF helpers (auth-check / family-discovery / send-to-members / quiet-hours). Files: `queuenight/functions/index.js` (existing watchpartyTick + sendToMembers + claimMember), `js/app.js` (existing watchparty UI patterns).
2. **Existing tile rendering** — `js/app.js` `renderTitleTile` (or equivalent) for current tile patterns. Identify what action sheet system is in place (if any), or whether the iOS-style sheet primitive needs to be built.
3. **Drag-reorder libraries** — pure JS / minimal-dep options (project rule: no bundler). Check if existing code uses any drag pattern; if not, evaluate `interact.js` vs hand-rolled HTML5 drag-and-drop API.
4. **SVG sofa rendering approaches** — inline SVG vs `<img src="couch.svg">`. Inline allows per-cushion event binding (tap to seat) which is what we need.
5. **Phase 6 notifPrefs allowlist** — confirm the server-side enforcement file (`functions/index.js` lines noted in Phase 12 SUMMARY) and the client-side UI list (`NOTIF_UI_TO_SERVER_KEY` in `js/constants.js`). New categories from D-12 must be added in BOTH places.
6. **Trakt sync history** — for D-01 source 1, what's the current import flow? Is there a per-user `watchedTitleIds` cache, or does the filter check Trakt API on every load? (Latter is a TMDB-style rate-limit problem at family scale.)
7. **Cross-cutting onboarding state** — does Couch already track `state.onboarding.seen.*` flags somewhere? Phase 9 had first-run onboarding (REFR-09a); D-10 should reuse that pattern, not create a parallel state path.

## Sketch targets (for /gsd-sketch round before plan-phase)

D-06 explicitly defers Couch visualization to a sketch round. Recommended targets for `/gsd-sketch`:

1. **Couch SVG variants (3 mockups)** at common seat counts (3, 5, 8). Material exploration: leather / fabric / minimal-line. Seat shape: cushioned / banquette / sectional. Avatar treatment: circle / pill / framed.
2. **Tile redesign before-after** at common state (logged in, 2-3 want it, watched-by-some). Useful to validate "X want it" pill density.
3. **Action sheet visual treatment** at tile-tap. iOS-native sheet vs custom modal vs inline expand.

## Deferred ideas (NOT in scope; capture for backlog)

Per scope-guardrail rule, scope creep redirected here rather than acted on:

- **Couch viz live presence** — show which members are currently online with pulse/glow on their cushion. Adjacent to Phase 6 push but not core to D-06. → seed for post-Phase-14.
- **AI-assisted picker hint** — "you usually pick comedies on Friday — try The Holdovers?" → Phase 14+N (LLM integration not in current scope).
- **Family member voting weight** (kids = 0.5 vote) — adjacent to Phase 8 group-size thresholds. → revisit at Phase 8.
- **Intent → Calendar conversion** — converting an intent into a recurring `watchpartySeries` (Phase 16 primitive). → cross-phase integration story for Phase 16.
- **Solo-only mode tile** — a "just for me" tile flow that bypasses the couch entirely. → conflicts with Couch's "plural" identity per `seeds/phase-9x-solo-mode.md` (already parked there).

## Open questions resolved

All 8 gray areas from the discuss-phase 14 session resolved:

- ✅ Q1 — Tier-3 toggle hierarchy: most-restrictive wins (D-02)
- ✅ Q2 — Queue/Yes unified: voting Yes auto-adds to bottom of queue (D-03)
- ✅ Q3 — Counter-nom chain: 3-level cap (D-07.6)
- ✅ Q4 — Couch viz overflow: adaptive 2-8 with +N cushion (D-06)
- ✅ Q5 — Vote mode: kept, surfaces from Add tab (D-05)
- ✅ Q6 — Onboarding: hybrid changelog + in-context tooltips, no mandatory modal (D-10)
- ✅ Q7 — Empty states: action-leading CTAs across 5 patterns (D-11)
- ✅ Q8 — Push: critical immediate / contextual batched + warm copy + 7 new toggle categories (D-12)

## Next steps

1. Run `/gsd-sketch` for Couch SVG + tile redesign + action sheet (3-mockup round per D-06).
2. After sketch sign-off, run `/gsd-plan-phase 14` to mint requirements (DECI-01 through DECI-N) and produce the formal plan files (14-01 through ~14-09).
3. Optional: `/gsd-research-phase 14` between sketch and plan if the researcher's targets above warrant a dedicated artifact (likely yes, given the Trakt sync + Firestore CF patterns + drag-reorder library decisions).
