---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous pre-staging — App Review §4.2 risk audit)
purpose: Surface-by-surface audit of Couch's app surfaces against Apple's "Minimum Functionality" §4.2 reject criterion. Pre-empts the single biggest §4.2-cite risk for PWA-wrapper apps.
related: 17-CONTEXT.md (D-15, D-16), 17-APP-STORE-CONNECT-PREP.md (Notes for Reviewer §5)
---

# Phase 17 — App Store Review §4.2 Minimum Functionality risk audit

Apple §4.2 ("Your app should include features, content, and UI that elevate it beyond a repackaged website. If your app is not particularly useful, unique, or 'app-like,' it doesn't belong on the App Store") is the single highest-probability reject reason for PWA-wrapper apps. Per CONTEXT D-15/D-16, mitigation is to lead the description + screenshots with category-unique interactive surfaces. This audit walks every Couch surface and tags §4.2 risk.

## Risk legend

- 🟢 **Low** — clearly interactive, category-unique, "app-like." Showcase in description + screenshots.
- 🟡 **Medium** — interactive but generic; pair with a 🟢 surface in any screenshot.
- 🔴 **High** — looks like a repackaged web list/catalog; do NOT lead with this.

---

## Surface-by-surface

### Tonight (decision flow) — 🟢 Low risk

**What it is:** Member chips show who's on the couch. Vote yes/maybe/no on titles. Spin button picks fairly across yes-voted titles. Veto re-spins.

**§4.2 defense:**
- Real-time multi-device coordination — votes propagate instantly via Firestore subscriptions
- Spin algorithm is non-trivial (fair-rotation across yes-voted; veto rule prevents replacement-control)
- Couch-viz with avatars filling in is a category-unique visualization

**Reviewer prompt (in screenshot caption):** "Vote together. Spin decides."

---

### Watchparty (live coordination) — 🟢 Low risk

**What it is:** Multi-device session tracking elapsed time per member. Real-time reactions (emoji + text + photos). Per-user spoiler delay ("Wait Up"). Catch-me-up auto-summary for late joiners. Push notifications when session starts.

**§4.2 defense:**
- Multi-device real-time coordination is the core mechanic — impossible in a static web page
- Per-user time-shifting (Wait Up) is genuinely novel — competitors don't have it
- Push notifications + tap-through to live session = native-like behavior
- Position-anchored reactions (Phase 26) tie reaction to runtime, not wall-clock

**Reviewer prompt:** "Live watchparty. Reactions sync. Spoilers wait."

---

### Couch Groups (multi-family wp) — 🟢 Low risk

**What it is:** Pull members from up to 4 families into one watchparty. Cross-family identity, render-time collision suffix when names clash, host-only invite authority.

**§4.2 defense:**
- Cross-family identity in a single coordination space is unique
- Real-time membership + collision-resolved display logic is non-trivial
- No equivalent in mainstream streaming-coordination apps

**Reviewer prompt:** "Watch with multiple families at once."

---

### Pick'em (sports prediction) — 🟢 Low risk

**What it is:** Predict winners on big games. Per-family leaderboard tracks accuracy across the season. Picks lock at game-start. NFL/NBA/EPL/college/F1/UFC supported.

**§4.2 defense:**
- Game-time-locking + leaderboard aggregation is interactive in a way a website can't replicate
- Free, no real-money — clears §5.3.4 cleanly (CONTEXT D-13 analysis)
- Per-family scoping (not global) is differentiated from mainstream pick'em apps

**Reviewer prompt:** "Predict the big games. Compete with your family."

---

### Decision Explanation — 🟢 Low risk

**What it is:** Tap any pick (matches list, spin result, detail modal) to see why it surfaced. Examples: "Mom and Sam said yes · Available on Hulu · 1h 38m" / "Both of you said yes · 1h 38m" / "Some of you said yes."

**§4.2 defense:**
- Voice + composition logic + dynamic data interpolation is far beyond static catalog
- Humility-voiced, not algorithm-voiced (a deliberate UX choice)
- Mirrors the "why this pick?" question that recommender-driven apps avoid answering

**Reviewer prompt:** "Tap any pick to see why."

---

### Wait Up (per-user reaction delay) — 🟢 Low risk

**What it is:** Each watchparty viewer can set a delay (0 - multi-hour). Reactions and live updates from other viewers arrive on their screen shifted by that delay. Spoilers stay sealed for whoever's behind.

**§4.2 defense:**
- Per-receiver time-shifting of real-time events is genuinely novel mechanic
- Server-side push template stripping when receiver has Wait Up active (no spoilers in lock-screen pushes)
- This is the kind of detail that makes the "this is an app" case for Reviewers

**Reviewer prompt:** "Spoilers wait until you catch up."

---

### Mood filter — 🟡 Medium risk

**What it is:** Tap a mood chip ("cozy," "action," "short") to narrow tonight's matches. Tags can be applied by anyone; auto-suggestions when nobody has.

**§4.2 defense:** It's a filter — could exist on a web page. BUT: tags are crowdsourced by the family (not external), suggestions are generated dynamically, and the filter affects the ENTIRE Tonight pipeline (not just the visible list).

**Recommendation:** don't lead a screenshot with mood filter alone. Pair with the matches list it's filtering — that pairing is more app-like.

---

### Veto — 🟢 Low risk

**What it is:** Anyone can reject a title. Before the spin (drops from pool) or after (re-spin). Fairness rule prevents the vetoer from controlling the replacement.

**§4.2 defense:**
- Real-time multi-member state mutation
- Fairness algorithm (vetoer's vote excluded from replacement choice) is non-trivial
- Tied directly to spin → demonstrably interactive

**Reviewer prompt:** "Vetoed picks re-spin instantly."

---

### Kid Mode — 🟢 Low risk

**What it is:** One toggle ("Kids on the couch tonight") hides any title above a chosen age tier from the matches list, library, and spin pool. Filters by mood, runtime, providers, and ratings.

**§4.2 defense:**
- One-toggle global filter affecting many surfaces is non-trivial
- Solves a real family pain (Dad joining 8yo on the couch shouldn't surface R-rated titles)
- Tightly scoped to session state (not persisted as a permanent profile)

**Reviewer prompt (especially for the family-app angle):** "One toggle. Kid-safe filtering."

---

### Conflict-aware empty state — 🟢 Low risk

**What it is:** When matches are empty BUT titles exist, surface a humility-voiced diagnosis: "All 12 unwatched titles are out — Nahder vetoed 4, Kid Mode hides 6, the rest are on services no one has."

**§4.2 defense:**
- Dynamic introspection of filter state — non-trivial composition
- Humility voice is a deliberate brand stance (not algorithm-shaming)
- Solves a real pain point (silent filtering frustration)

---

### Library / catalog browse — 🔴 High risk (mitigation required)

**What it is:** Browse all titles in the family's queue. Add new titles via TMDB search. View provider availability.

**§4.2 risk:** This is the most "web-like" surface in Couch — it's a list with filter chips. App Reviewer might cite this if it's the FIRST or LARGEST screenshot.

**Mitigations:**
- Do NOT lead screenshots with the library
- Library entries link to Decision Explanation overlay — make sure that's reachable from the library screenshot
- Show the library WITH the watchparty banner / member chips at top, demonstrating the family-coordination context (not solo browsing)
- The Add Title flow uses TMDB autocomplete — that's a real interactive contribution, can showcase

**Recommendation:** library appears as a secondary surface in the screenshot grid, never as #1.

---

### Account + Settings — 🟡 Medium risk

**What it is:** Sign-in management, family code, notification preferences (per-event toggles), Trakt sync, account deletion.

**§4.2 risk:** Settings screens are usually fine for App Review (every app has them). But the per-event push toggle UI is genuinely a 12-row matrix that's app-like.

**Recommendation:** don't include in primary screenshots. Reviewer may walk through it during demo-account testing — that's where the per-event toggles speak for themselves.

---

### RSVP / Intent flows (`/rsvp/<token>`) — 🟢 Low risk

**What it is:** Token-based RSVP for non-members invited to a watchparty. Web Share API integration.

**§4.2 defense:**
- Web Share API integration is a native iOS API (not a wrapped-web feature)
- Token-based deep-linking with state preservation is non-trivial
- Universal Links (once Phase 17 Wave 1 ships AASA) make this open in the native app, not Safari

**Reviewer prompt:** "Invite anyone with one tap."

---

### Sports / live scoreboard — 🟢 Low risk

**What it is:** Live game schedule across 16 leagues (TheSportsDB feed). Live scoreboard polls every 15 sec during games. Schedule sport-mode watchparties tied to specific games.

**§4.2 defense:**
- Real-time score polling + scoring-play amplified reactions (Phase 11 / Phase 23)
- Cross-league catalog — broader than most sport-coordination apps
- Game Mode pipeline (sport-flow watchparty) is genuinely interactive

**Reviewer prompt:** "Schedule around the game."

---

### Year-in-Review — n/a (deferred per CONTEXT)

Phase 10 is deferred post-launch. Not part of v1 submission.

---

## Reviewer-notes paragraph (already in 17-APP-STORE-CONNECT-PREP.md §5)

The Notes for Reviewer in `17-APP-STORE-CONNECT-PREP.md` includes the §4.2 mitigation framing. This audit reinforces it with surface-level granularity if the Reviewer escalates.

## Recommended screenshot order (per CONTEXT D-25 / Phase 31 D-25)

For both App Store and Play Store:

1. **Tonight hero** (couch viz with avatars filling in + matches list + spin) — 🟢 multi-mechanic showcase
2. **Watchparty live** (live timer + reactions + Wait Up chip) — 🟢 the most-app-like surface
3. **Couch Groups** (cross-family roster with collision-resolved names) — 🟢 unique mechanic
4. **Wait Up** (delay picker + reactions in time-shift mode) — 🟢 novel mechanic
5. **Pick'em** (leaderboard + game schedule + active pick UI) — 🟢 unique mechanic + sports angle

Phase 31 / Plan 31-02 already targets this composition. Once Phase 31 ships, the screenshot pipeline at `scripts/regenerate-store-screenshots.cjs` produces the App Store device matrix from a single 1320×2868 source set per surface.

## What to do if §4.2 is cited

Per CONTEXT D-16:
1. **First cite:** rebut with description rewrite emphasizing native-feel features. Use this audit's per-surface §4.2 defenses + the Reviewer Notes paragraph.
2. **Second cite:** escalate to Capacitor migration (spike 001 switch trigger 2). Document + start migration.

Don't accept §4.2 quietly — every PWA-wrapper interaction is precedent.

---

## Summary

| Surface count | 🟢 Low | 🟡 Medium | 🔴 High |
|---|---|---|---|
| 14 (Couch v1) | 11 | 2 | 1 (Library) |

The single high-risk surface (Library) has a clear mitigation: never lead with it; pair with coordination context. The other 13 surfaces have specific §4.2 defenses ready for Reviewer escalation.

Couch is well-positioned to clear §4.2 on first review. The risk is real but manageable.

---

*Authored autonomously 2026-05-07. Validates CONTEXT D-15 + D-16 with concrete surface-level analysis. Update if new surfaces ship before submission.*
