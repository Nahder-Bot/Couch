---
phase: 11
slug: feature-refresh-and-streamline
status: CODE-COMPLETE
milestone: v1.0
plans: 8
plans_complete: 8
requirements: 13
requirements_closed: 13
deploy_status: deferred
completed_at: "2026-04-24T00:00:00Z"
---

# Phase 11 Completion — Feature Refresh & Streamline

**Phase 11 closes CODE-COMPLETE 2026-04-24. All 8 plans shipped; all 13 REFR-* requirements closed. Deploy + human-verify of Waves 3 and 4 (plans 11-04 through 11-07) bundled for a single future session pending Blaze billing confirmation + Firebase Console Storage enablement (REFR-09 requirement) + live game window (REFR-10 score-delta verification). Couch moves from "functional PWA with post-Phase-9 brand refresh" to "decision ritual product" — the stated phase goal per 11-CONTEXT.md. Two parallel tracks delivered: declutter+streamline (REFR-01/02/03/11/12) and moat-expansion (REFR-04/05/06/07/08/09/10/13).**

## Plan Rollup

| Plan | Requirements | Commit(s) | Status | Completed |
|------|--------------|-----------|--------|-----------|
| **11-01** UX tightening | REFR-01, REFR-02, REFR-03 | (3 commits — see 11-01-SUMMARY.md) | COMPLETE + deployed | 2026-04-24 |
| **11-02** Family + Account tab restructures | REFR-11, REFR-12 | (2 commits — see 11-02-SUMMARY.md) | COMPLETE + deployed | 2026-04-24 |
| **11-03a** Discovery rotation engine + auto rows | REFR-04 (first half) | (see 11-03a-SUMMARY.md) | COMPLETE + deployed | 2026-04-24 |
| **11-03b** Curated lists + Browse-all + personalization | REFR-04 (second half) | (see 11-03b-SUMMARY.md) | COMPLETE + deployed | 2026-04-24 |
| **11-04** Web RSVP route + Web Share + push nurture | REFR-05, REFR-06 | `e1404f3` + `c2434d6` + `de0b372` | CODE-COMPLETE (deploy deferred) | 2026-04-24 |
| **11-05** Pre-session lobby + catch-me-up + post-session | REFR-07, REFR-08, REFR-09 | `c04597e` + `123d954` + `a938901` | CODE-COMPLETE (deploy deferred) | 2026-04-24 |
| **11-06** Sports Game Mode v1 | REFR-10 | `0181de1` + `c79ab78` + `1f03ff1` + `0ec62f8` | CODE-COMPLETE (deploy deferred) | 2026-04-24 |
| **11-07** Couch Nights themed packs | REFR-13 | `823b3ed` + `65037c4` | CODE-COMPLETE (deploy deferred) | 2026-04-24 |

## Requirements Closed

All 13 REFR-* items closed (code):

- **REFR-01** Mood filter chip density tightened — `.mood-filter` gap + `.mood-chip` padding reduced; 36px min tap target preserved. Plan 11-01.
- **REFR-02** "Whose turn to pick" UI hidden via `body.picker-ui-hidden` feature flag class; backend spinnership writes preserved; reversible in one commit. Plan 11-01.
- **REFR-03** "Who's on the couch" card redesigned — compact horizontal row variant (planner-selected variant B from the 3-variant shortlist). Plan 11-01.
- **REFR-04** Add-tab discovery — 25-row DISCOVERY_CATALOG (auto + curated) + daily hash-seeded rotation engine + Browse-all sheet + pin-up-to-3 favorites + personalization rows. Plan 11-03a + 11-03b.
- **REFR-05** Web RSVP route at `/rsvp/<token>` — standalone rsvp.html + css/rsvp.css (zero Firebase SDK, no full app shell) + Web Share API in schedule modal. Plan 11-04.
- **REFR-06** Asymmetric push reminder cadence keyed to RSVP state — 7 reminder windows (Yes × 2, Maybe × 3, Not-responded × 2, No = silence) via rsvpReminderTick scheduled CF. Plan 11-04.
- **REFR-07** Pre-session lobby — `.wp-lobby-card` with 56px countdown ring + roster + Ready toggle + host "Start the session" gradient CTA + majority-ready auto-start. Plan 11-05.
- **REFR-08** Late-joiner "Catch me up" recap — `.wp-catchup-card` slices last 30s of reactions pre-join (<3 reactions hides entirely to preserve reaction-delay moat). Plan 11-05.
- **REFR-09** Post-session loop — `.wp-post-session-modal` with 5-star rating + photo upload (Firebase Storage first use, Variant A rules) + "Schedule another night" gradient CTA. Plan 11-05.
- **REFR-10** Sports Game Mode v1 — SportsDataProvider abstraction (ESPN + BALLDONTLIE stub), game picker modal, sticky live score strip, score-delta polling (5s on-play / 15s off-play), amplified burst reactions, per-user DVR slider, team-flair badges, sports variant of Catch-me-up. Plan 11-06.
- **REFR-11** Family tab 6-section → 5-section restructure per 11-APPENDIX-TABS-AUDIT.md (Tonight status NEW / Approvals / Members split / Couch history consolidated / Group settings footer). Picker section cut per REFR-02. Plan 11-02.
- **REFR-12** Account tab 9-section → 3-cluster regroup (You / Couch-wide / Admin & maintenance) per 11-APPENDIX-TABS-AUDIT.md. NEW sections deferred to Phase 12. Plan 11-02.
- **REFR-13** Couch Nights themed ballot packs — 8 curated packs (Ghibli / Cozy Rainy / Halloween / Date Night / Kids' / A24 / Oscars / Dad's Action) with pack-detail sheet + seed-ballot flow launching Vote mode. Plan 11-07.

## Wave Execution

Per 11-CONTEXT.md plan structure (4 waves, 8 plans):

- **Wave 1 — Quick wins (low risk, high visible):** 11-01 + 11-02 landed + deployed 2026-04-24 morning. Paired well as both touch Tonight + Family + Account surfaces.
- **Wave 2 — Discovery:** 11-03a (rotation engine + auto rows) + 11-03b (curated lists + Browse-all + personalization) landed + deployed 2026-04-24. Daily hash-seeded rotation engine + 25-row catalog + pin-up-to-3 favorites shipped.
- **Wave 3 — Watchparty lifecycle (the big one):** 11-04 (Web RSVP + async push) + 11-05 (lobby + catch-me-up + post-session) code-complete 2026-04-24. Deploy deferred pending Blaze billing confirmation (scheduled CF rsvpReminderTick requires Blaze) + Firebase Console Storage enablement (REFR-09 photo album first Storage use).
- **Wave 4 — Sports + themed packs (polish + expansion):** 11-06 (Sports Game Mode v1, REFR-10) + 11-07 (Couch Nights themed packs, REFR-13) code-complete 2026-04-24. Deploy bundled with Wave 3 deferred batch.

## sw.js CACHE Progression

Full Phase 11 cache version history:

- **v21** `couch-v21-09-07b-guest-invite` — pre-Phase-11 baseline (Phase 9 Plan 07b)
- **v22** `couch-v22-11-01-ux-tightening` — Plan 11-01
- **v23** `couch-v23-11-02-tabs` — Plan 11-02
- **v24** `couch-v24-11-03a-discovery-auto` — Plan 11-03a
- **v25** `couch-v25-11-03b-discovery-curated` — Plan 11-03b
- **v26** `couch-v26-11-04-rsvp` — Plan 11-04
- **v27** `couch-v27-11-05-lifecycle` — Plan 11-05
- **v28** `couch-v28-11-06-sports` — Plan 11-06
- **v29** `couch-v29-11-07-couch-nights` — Plan 11-07 (current HEAD)

## Deferred Items — Rolled to Phase 12

Per plan-level deferrals documented across the 8 SUMMARY.md files:

### SMS + Invites (Plan 11-04)

- Twilio SMS infrastructure + automated non-member nurture (user decision 4 → option a, M2 scope)
- App Check rate limiting on `rsvpSubmit` CF (M2)
- Top-level `rsvpTokens` reverse index for O(1) token lookup (M2; current implementation scans families/<code>/watchparties for matching wpId)
- Member-conversion-on-first-RSVP (non-members who RSVP via web become push-receiving members on next app visit)

### Tab Restructures (Plan 11-02)

- Per-event notification prefs detail UI (ADD deferred per user decision 5 option b)
- Data export / delete surfaces
- Theme prefs surface
- About / version / feedback surface
- Family tab: Couch calendar with recurrence
- Family tab: Recent watchparties drilldown with photos

### Watchparty Lifecycle (Plan 11-05)

- Host-triggered "remind unresponsive" button (deferred to Plan 11-05 lobby scope at Plan 11-04 close; re-deferred post-11-05 completion — requires manual-invite button surface in lobby)
- Variant B storage.rules tightening (requires member-uid migration post-Phase 5 Auth — current rules are Variant A: auth + size + MIME allowlist on couch-albums path)
- Emulator test 5-case matrix for REFR-09 photo upload (owes post-deploy)
- Multi-device lobby walkthrough for majority-ready auto-start (owes post-deploy)

### Sports Game Mode (Plan 11-06)

- BALLDONTLIE provider activation (if ESPN denies hidden-API usage per T-11-06-01 ToS-gray posture; ~3-5 hr to activate the stub branch in SportsDataProvider)
- Free pick'em / prediction layer for sports watchparties
- Post-game debrief mode (sports variant of REFR-09 post-session)
- Voice rooms for sports watchparties (BRAND.md §Out-of-scope in Phase 11 per per-user-reaction-delay moat)

### Themed Packs (Plan 11-07)

- Pack data migration from constant → Firestore (if/when community-curated packs become a surface)
- Seasonal pack rotation (Halloween pack auto-promoted in October, Holiday pack in December) — pack data already has mood token but no seasonal_window field; Phase 12 addition
- Per-family pack authorship ("your family's Couch Nights")

## v1 Milestone Status Update (Proposal for STATE.md)

**Before Phase 11:** v1 = Phases 3, 4, 5, 7, 8, 9 complete; Phase 6 UAT partial (2/7); Phase 10 (YIR) pending; Phase 11 executing.

**After Phase 11 closure (code-complete):** v1 = Phases 3, 4, 5, 7, 8, 9 complete; Phase 6 UAT partial (2/7); Phase 10 (YIR) pending; **Phase 11 CODE-COMPLETE** (deploy + human-verify of Waves 3-4 pending).

**Remaining v1 work to reach Commercial Release:**

1. Phase 6 UAT completion — 5 of 7 scenarios still pending (per-event opt-out, quiet hours, invite received, veto cap, Android delivery)
2. Phase 10 planning + execution (Year-in-Review — depends on data from 3/4/7/8 + brand tokens from 9; unblocked)
3. Phase 11 Wave 3+4 deploy batch (11-04 + 11-05 + 11-06 + 11-07 in one session) — requires Blaze billing confirmation + Firebase Console Storage enablement
4. Phase 11 Wave 3+4 human-verify matrix (9 end-to-end scenarios across 4 plans, plus the 18-step Phase 11 closure smoke in 11-07 Task 3)

**v1 Commercial Release is within 2-3 sessions of completion** once the pending deploy batch lands and Phase 10 is planned + executed.

## Phase 11 In Numbers

- **Total commits:** 22 main-repo atomic commits across 8 plans (plus finalization commits per plan)
- **Total main-repo files modified:** 7 (`js/app.js`, `js/constants.js`, `js/firebase.js`, `js/utils.js`, `css/app.css`, `app.html`, `sw.js`) plus 2 net-new (`rsvp.html`, `css/rsvp.css`)
- **Sibling repo (queuenight/) files landed:** `storage.rules` NEW, `firebase.json` EDITED (hosting rewrite + storage section), `functions/index.js` EDITED (+ `functions/src/rsvpSubmit.js` NEW + `functions/src/rsvpReminderTick.js` NEW)
- **Net lines added (main repo, estimated):** ~2000 JS + ~300 CSS + ~250 HTML + ~200 constants data
- **New components / features shipped:** 10 (lobby card, ready check, catchup card, post-session modal, photo upload, game picker, score strip, DVR slider, team-flair, couch-nights packs) plus 4 tab-restructure groupings
- **Requirements-to-plan ratio:** 13 REFR-* across 8 plans = ~1.6 requirements/plan (reasonable density)

## Closure Rationale

Phase 11 accomplished both declarative goals from 11-CONTEXT.md:

1. **Declutter + streamline:** REFR-01 (mood density), REFR-02 (picker hidden, reversible), REFR-03 (who-card denser), REFR-11 + REFR-12 (tab restructures) all deliver the "less busy, less dated, more coherent" UX direction the user flagged.
2. **Feature-expand the moat:** REFR-05 + REFR-06 (Web RSVP + push nurture — Partiful-class invitation layer), REFR-07 + REFR-08 + REFR-09 (lobby + catch-me-up + post-session — Partiful's highest-leverage recurring-ritual pattern), REFR-10 (Sports Game Mode — no incumbent does this correctly), REFR-04 (discovery expansion — Fable's Ready-Picks pattern adapted to family-scale), REFR-13 (themed packs — kickoff shortcut that solves the decision paralysis problem).

Every plan shipped within its commit_strategy contract. Zero plans required revision or blocker escalation. The only gating item between code-complete and production is the one-time Blaze billing + Firebase Storage Console enablement for REFR-09 photo upload + REFR-06 scheduled CF.

---

*Phase 11 planned 2026-04-24. Executed 2026-04-24 across a single session. Code-complete 2026-04-24. Deploy batch pending; Phase 12 deferrals documented.*
