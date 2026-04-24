# Phase 11 — Feature refresh & streamline

> **Status:** DRAFT — pending user review of scope + requirements before `/gsd-plan-phase 11`.
> Tentative phase number; user may renumber. Phase 10 (Year-in-Review) stays next in the current roadmap; this work slots after.

## Phase goal

Take Couch from "functional PWA with post-Phase-9 brand refresh" to "decision ritual product that nobody else ships." Two parallel tracks:

1. **Declutter + streamline** — the in-app surfaces the user flagged as too busy, too prominent, or too dated, plus a coherent Family + Account tab restructure.
2. **Feature-expand the moat** — what competitive research identified as Couch's unmet differentiation: SMS invite links, asymmetric RSVP nurture, proper watchparty lobby, post-session loop, late-joiner recap, dedicated Sports Game Mode, themed "Couch Nights" packs.

## Full context

See `11-RESEARCH.md` for the full competitive landscape, watchparty + scheduling lifecycle deep-dive, sports-specific UX findings, and local Couch audit. That doc is the factual floor; this doc is the scope proposal.

## Depends on

- Phase 9 (Redesign/Brand) complete — design tokens, landing page, app.html + sw.js live ✓
- Phase 10 (YIR) — independent; can ship before, after, or in parallel. The Account-tab YIR card lives today as a pre-Phase-10 placeholder and stays.

## Out of scope / non-goals

- **Voice/video chat in watchparties** — explicitly deferred (incompatible with per-user reaction-delay, which is Couch's unique moat).
- **Distributing the video stream** — users BYO. Playback.tv just died on this exact rights complexity; don't repeat.
- **Real-money betting integration** — state-by-state regulated, KYC friction. Free pick'em only.
- **Cross-UID data migration** — same as Phase 5 stance.
- **Monetization / tier design / billing** — explicit Out of Scope from PROJECT.md, preserved.

---

## Proposed requirements (13 items, grouped by plan)

### UX tightening (3)

- **REFR-01**: Mood filter chip spacing tightened; chip padding reduced; visually denser without sacrificing tap target.
- **REFR-02**: "Whose turn to pick" UI surfaces hidden across Tonight + Family tabs. Backend spinnership writes (spinnerId, spinnerAt, auto-advance flag) preserved. Feature-flag reversible.
- **REFR-03**: "Who's on the couch" card redesigned to a cleaner, denser format (avatar-stack or compact horizontal row, TBD from 2-3 explored variants).

### Discovery expansion (1)

- **REFR-04**: Add-tab discovery rows expanded from 4 to 12+ candidate rows with daily/weekly rotation logic. 4-6 visible at a time. Categories span time-of-year, use-case, personalization, and group-aware signals.

### Watchparty lifecycle redesign (4)

- **REFR-05**: SMS invite links + web-guest RSVP. Non-members land on a web page via SMS shortlink, RSVP with phone number, no install required. Deep-linked into `/app` for those who want more.
- **REFR-06**: Asymmetric RSVP nurture cadence. Yes = 2 touches (T-24h, T-1h). Maybe = 3 touches (T-7d, T-24h, T-1h). Not-responded = 2 (T-48h, T-4h). No = silence. Host-triggered "text blast unresponsive" button.
- **REFR-07**: Pre-session lobby upgrade. Evolve the participant timer strip into a proper T-15min "green room": who's here, who's en-route, countdown, emoji reactions already live, per-person "Ready" check, democratic auto-start at T-0 once majority Ready.
- **REFR-08**: Late-joiner "Catch me up" recap. 30-second summary of reactions that fired before they joined. Preserves Couch's unique per-user reaction-delay moat while eliminating the "lost in the timeline" friction.
- **REFR-09**: Post-session loop. Auto-prompt 5-star rating + "Add photo to album" + one-tap "Schedule next" using same roster. Converts one party into recurring ritual (Partiful's highest-leverage pattern).

### Sports Game Mode (1)

- **REFR-10**: Dedicated Game Mode for sports watchparties — distinct from movie mode. Minimum v1: game picker (ESPN hidden API + BALLDONTLIE), live score strip always visible, kickoff countdown + auto-transition, play-scoped amplified reactions triggered by score-delta polling, late-joiner "current score + last 3 plays" card, team-flair avatar badges. Per-user "I'm N seconds behind" DVR slider for latency mitigation.

### Tab restructures (2)

- **REFR-11**: Family tab restructured. Current 6 sections audited for rhythm; proposed trim: hero+stats kept, approvals promoted when present, members list polished, picker section removed (REFR-02), family favorites + stats consolidated into one "Couch history" section, invite stays. Target: 4-5 sections instead of 6+.
- **REFR-12**: Account tab restructured. Current 9 sections grouped into 3 clusters: "You" (identity + sub-profiles), "Couch-wide" (services, Trakt, notifications, YIR), "Admin" (owner-only group admin). Footer (sign out + leave) stays. Target: same content, clearer cognitive grouping.

### Themed packs (1 — stretch)

- **REFR-13** (stretch, maybe Phase 12): "Couch Nights" themed ballot packs — Studio Ghibli, Cozy Rainy Sunday, Halloween Crawl, Date Night Picks, etc. Pre-loaded ballots the host taps once to kick off a themed session. Fable's Ready-Picks pattern adapted.

---

## Proposed plan structure (6 plans across 4 waves)

### Wave 1 — Quick wins (low risk, high visible)

**Plan 11-01** — UX tightening (REFR-01, REFR-02, REFR-03)
- 3 atomic commits: mood spacing, picker-hide (feature-flag via body class), who-card cleaner format
- Effort: **S-M (~3-4 hrs)**
- Human-verify checkpoint after all 3 commits: walk Tonight + Family tabs, confirm no functional regressions

**Plan 11-02** — Family + Account tab restructures (REFR-11, REFR-12)
- 2 atomic commits: one per tab
- Effort: **M (~4-5 hrs)** — mostly HTML reordering + CSS section grouping; no new features
- Pairs with Plan 11-01 since it shares the surfaces

### Wave 2 — Discovery

**Plan 11-03** — Discovery expansion (REFR-04)
- Design the category list (~15 candidates: trending, new releases, hidden gems, by-decade, critically-acclaimed, award-winners, cozy-Sunday, Halloween, kid-friendly, short-films-under-90, binge-worthy, director spotlights, for-your-streaming, family-favorites, your-top-genres)
- Rotation engine — 4-6 visible daily/weekly, seeded by (day-of-week, user-taste, group-taste), remaining swipeable/via "More categories…"
- Per-row empty-state handling + TMDB rate-limit budgeting
- Effort: **M-L (~6-8 hrs)**

### Wave 3 — Watchparty lifecycle (the big one)

**Plan 11-04** — Invitations + async nurture (REFR-05, REFR-06)
- SMS link delivery via a new `sendInviteSMS` CF (Twilio or similar — needs a paid service)
- Web-guest RSVP page (new route `/rsvp/<token>` serving a lightweight HTML+JS, no full app shell)
- Asymmetric reminder CF scheduled for each RSVP state
- Host-triggered "text blast unresponsive" button in the scheduled-watchparty view
- Effort: **L (~10-12 hrs)** — requires new paid service + CF infra + new deploy route
- User setup required: Twilio account, phone number, webhook config

**Plan 11-05** — Live session + post-session (REFR-07, REFR-08, REFR-09)
- Pre-session lobby DOM + render function + Ready check
- Democratic auto-start at T-0 once majority Ready
- Late-joiner "Catch me up" — render last 30s of reactions from existing wp reactions feed
- Post-session modal: rating + photo upload (Firebase Storage) + schedule-next shortcut
- Effort: **L (~10-12 hrs)** — extends existing wp-live-modal, new wp-lobby state, new wp-post-session modal

### Wave 4 — Sports + themed packs (polish + expansion)

**Plan 11-06** — Sports Game Mode v1 (REFR-10)
- `SportsDataProvider` interface abstracting ESPN + BALLDONTLIE
- New mode-variant of the watchparty flow (`watchparty.mode === 'game'`) — game picker, score-strip chrome, play-scoped reactions, catch-up card, team-flair badges
- Score-delta detection + amplified reaction UI
- DVR offset slider per user
- Effort: **L (~12-14 hrs)** — new data layer + new UI variants. Bigger than other plans; may warrant splitting.
- User setup: ESPN hidden API ToS review, optional BALLDONTLIE free-tier signup

**Plan 11-07** (STRETCH, may defer to Phase 12) — "Couch Nights" themed packs (REFR-13)
- Data model for themed ballot packs (set of preloaded titles + mood + optional Spotify playlist URL)
- Library of 8-12 initial packs (author-curated)
- Add-screen entry: "Browse Couch Nights" sub-surface
- Effort: **M (~5-7 hrs)** — mostly content work (curating packs) + a small UI for pack selection

---

## Prioritized roadmap — what to build first

Ranking by **Impact × Urgency × Fit-with-current-momentum**:

| Rank | Plan | Why it comes first |
|---|---|---|
| 1 | **11-01 UX tightening** | User's explicit direct complaints. Low risk, visible wins, ships in a session. |
| 2 | **11-02 Tab restructures** | Shares surfaces with 11-01; cognitive cleanup matches the "declutter" goal. |
| 3 | **11-03 Discovery expansion** | User explicitly asked. Visible, bounded scope, no infra cost. |
| 4 | **11-05 Live session + post-session** | Closes the biggest UX gap in the watchparty flow. Defensible (per-user delay moat). No new paid infra. |
| 5 | **11-04 SMS invites + async nurture** | Highest conversion lever but requires paid Twilio infra + new deploy route. Waits until the simpler wins land so it doesn't block them. |
| 6 | **11-06 Sports Game Mode** | Big lift, new data layer. Do when the movie watchparty UX is solid so Game Mode has a proven lifecycle to specialize from. |
| 7 | **11-07 Couch Nights packs** | Content-heavy. Defer to Phase 12 unless a specific launch moment (Halloween season, etc.) moves it up. |

Total effort estimate: **~45-60 hrs** of focused work for plans 11-01 through 11-06 (the non-stretch scope). At your session velocity that's realistically 4-6 sessions.

## Non-goals (preserved from prior scope)

- No bundler / build step
- Zero JS migration for landing surfaces
- No server-side secrets move (TMDB + Firebase config stay client-side)
- No monetization work
- No cross-UID merging
- No new Firebase product surface (no Realtime Database, no Storage beyond existing) unless REFR-09 photo album forces it — if so, scope as a single narrow Storage use

## Risks

| Risk | Mitigation |
|---|---|
| **Picker-hide may expose other assumptions in code** — 3 render sites + 1 modal + state.rotation logic. Hidden UI might mask a bug in the spinnership autoAdvance path. | Plan 11-01 ships feature-flagged via body class, reversible in one commit. If a regression surfaces, flip flag back until fix lands. |
| **SMS invites require paid Twilio** — new operational cost + new PII surface (phone numbers of non-members) | Gate behind a feature flag initially; limit to one sender number; rate-limit per-owner; log PII retention policy. If costs balloon, fall back to shareable-link-only. |
| **Score-delta polling may hit API rate limits** — ESPN hidden API is ToS-gray, BALLDONTLIE free tier has limits | `SportsDataProvider` abstraction + per-request caching + back-off; multiple provider keys; upgrade path to paid tier if Couch ever monetizes. |
| **Expanded discovery rows inflate TMDB request count** — Phase 11-03 adds ~10 new categories, each potentially fetching trending/filter results | Per-category caching + staggered cold-fetch + reuse of existing backfill-phase pattern; 40req/10s budget still honored. |
| **Account tab restructure breaks muscle memory for existing users** — Nahder's family is accustomed to the current layout | 11-02 does not remove features — purely regroups. Ship with a brief in-app "what moved" toast on first load post-deploy. |
| **Sports Game Mode is big enough to be its own phase** — effort estimate 12-14 hrs, could split into 11-06a (data layer) + 11-06b (UI) | Decide at `/gsd-plan-phase 11` time based on complexity. Splitting is cheap. |

## User decisions — locked vs. pending

### Locked (2026-04-23)

| # | Question | Decision |
|---|---|---|
| 1 | Phase number | **Phase 11** within v1.0 milestone (no split, no Milestone 2 yet) |
| 2 | Scope commitment | **All 7 plans** including stretch 11-07 (Couch Nights packs) |
| 3 | Sports scope (REFR-10) | **Dedicated Game Mode** (research-recommended path) |

### Pending — see appendices for deeper review

| # | Question | Status | Appendix |
|---|---|---|---|
| 4 | SMS infrastructure (REFR-05/06) | Awaiting decision after review of 6 alternatives | `11-APPENDIX-SMS-OPTIONS.md` |
| 5 | Tab restructure depth (REFR-11/12) | Awaiting decision after section-by-section trim/edit/add/cut/reframe audit | `11-APPENDIX-TABS-AUDIT.md` |
| 6 | Discovery categories + rotation (REFR-04) | Awaiting decision after review of expanded 35-row catalog + daily rotation logic | `11-APPENDIX-CATEGORIES.md` |

### Notes from locked decisions

**On #1 (Phase 11 in v1):** This work joins Phase 6 UAT closure + Phase 9 remaining (09-06, 09-07a, 09-07b) + Phase 10 YIR as the remaining v1 surfaces. v1 ships when all of those + Phase 11 are complete. Implies a longer v1 runway but a more commercially-ready surface at v1 launch.

**On #2 (all 7 plans):** Stretch plan 11-07 (Couch Nights themed packs) is now committed in-scope. Estimated additional ~5-7 hrs. Total Phase 11 effort estimate revises to **~50-67 hrs** for all 7 plans.

**On #3 (dedicated Game Mode):** Plan 11-06 stays as designed — `SportsDataProvider` abstraction + game picker + score strip + play-scoped reactions + late-joiner card + team-flair badges + DVR offset slider. Movie watchparty flow stays distinct.

### What pending decisions affect downstream

- **#4 SMS** — affects Plan 11-04 scope (Twilio = full async automation; web-share = simpler flow, no SMS infra). Effort delta ~5 hrs.
- **#5 Tabs** — affects Plan 11-02 scope (pure-reorg vs. include ADDs like notification preferences detail, data export). Effort delta ~3-8 hrs depending on how many ADDs land.
- **#6 Categories** — affects Plan 11-03 scope (single 11-03 vs split 11-03a + 11-03b). Effort delta ~7-10 hrs if curated lists + Browse all + personalization land in v1.

Until #4/#5/#6 are decided, the planner can scope plans 11-01, 11-05, 11-06, 11-07 (which don't depend on these). Plans 11-02, 11-03, 11-04 wait.

---

## Next step

User reviews this proposal. Once locked:

1. User updates `ROADMAP.md` and `REQUIREMENTS.md` with the chosen REFR-XX items.
2. User invokes `/gsd-plan-phase 11` (or whatever number chosen) → planner + plan-checker produce the detailed `PLAN.md` files per the plan structure above.
3. Execution proceeds per the prioritized roadmap.

**Research complete 2026-04-23 via 3 parallel subagents + local audit. All findings + sources in `11-RESEARCH.md`.**
