# Couch — Launch Readiness Review

*Authored 2026-05-05. Source-of-truth doc for App-Store-launch positioning.*
*User direction: launch type = App Store (1B), push on all four areas (2), Kid-Mode broken-promise concern (3B → corrected: ALREADY SHIPPED), `/gsd-review` on resulting phase plans (4B), refresh screenshots + changelog as part of this work (5).*

> **One-line verdict.** Couch is a 28-phase product wearing a 9-phase landing page. Before App Store submission we close the visibility gap (catch up the marketing surface against the actual feature set), close out pending UAT for Phases 18–28, and sequence Phase 17.

---

## Corrections log

This doc was first drafted before STATE.md was fully cross-referenced. Initial draft assumed Kid Mode + Conflict-Aware Empty State were unshipped (per stale PROJECT.md backlog). STATE.md is the true source. Corrections:

| Initial-draft claim | Reality (per STATE.md 2026-05-05) |
|---|---|
| "Kid Mode is in Tier-2 backlog; ship as Phase 31 before launch" | **Phase 19 SHIPPED 2026-04-29** as `couch-v36.1-kid-mode`. 92 smoke + 43 rules tests pass. UAT pending real-device. Copy at `app.html:225` is NOT a broken promise. |
| "Conflict-aware empty state is Codex P0; ship as Phase 32" | **Phase 21 SHIPPED 2026-04-30** as `couch-v36.5-conflict-aware-empty`. Codex P0 already closed. |
| "Live cache is `couch-v41-couch-groups`" | Live cache is **`couch-v47-pickem`** (curl-verified 2026-05-05T04:28:47Z). PROJECT.md hadn't caught up. |
| "Marketing refresh covers Phases 18, 20, 24, 26, 27, 30" | Add Phases **19 (Kid Mode), 21 (Empty State), 22 (Sports Feed), 23 (Live Scoreboard), 28 (Social Pick'em + Leaderboards)** + 5 Phase 30 hotfix waves. Pick'em (28) shipped 2026-05-05 — yesterday — and is a launch-defining feature my first pass missed entirely. |
| Recommended sequence: Phase 31 (Kid Mode) + 32 (Polish) + 33 (Marketing) → 17 (App Store) | **Drop 31 + 32; renumber Marketing to Phase 31. Sequence: UAT close-out (19, 20, 21, 24, 26, 27, 28, 30) + Phase 31 (Marketing) → Phase 17 (App Store).** |

PROJECT.md cleanup tracked under Task 10 in this conversation's task list — should be done as part of B-step phase scoping.

---

## 0. Executive summary

| Area | State | Action |
|---|---|---|
| Brand voice | Launch-grade (BRAND.md is excellent) | Keep — no rewrites |
| Brand positioning | "Decision app for movie night" | **Reposition** to "the couch operating system" — picking is the front door, the loop is the moat |
| Landing page | Copy quality high; coverage 11+ caches stale | **Restructure** — comparison section, social proof, FAQ, free-and-private trust line, screenshot refresh |
| App-shell first-run | Tight, voice-correct | **Two copy fixes** (signin value-promise + signin privacy/terms link) |
| Feature messaging hierarchy | Implicit, scattered | **Lock 1 promise + 4 supporting beats**; everything else stays in-app |
| Market comparison | Has unique features (Wait Up, Couch Groups, per-tuple progress, Decision Explanation, Pick'em) all invisible | **Surface 4 of these on landing**; reserve the rest for in-app discovery |
| Kid Mode | **Shipped (Phase 19), UAT pending** | Run `/gsd-verify-work 19` after device UAT |
| Conflict-aware empty state | **Shipped (Phase 21)** | Already closed; no further action |
| Pick'em + Leaderboards | **Shipped 2026-05-05 (Phase 28), UAT pending** | Run `/gsd-verify-work 28` after device UAT; surface in marketing |
| Phase 17 (App Store) | Scoped, deferred | **Reactivate** — sequence after marketing refresh + UAT close-outs |
| Screenshots | Phase 9 (April 2026), 19 cache versions stale | **Refresh** against v47-pickem build |
| Changelog | Stops at v35.1 (2026-04-27) | **Catch up** through v47-pickem (Phases 18, 19, 20, 21, 22, 23, 24, 26, 27, 28, 30 + hotfix waves) |

---

## 1. The visibility gap

STATE.md "Recent shipped phases" table + sw.js cache progression confirms 28 phases shipped (v1: 19 phases; v2: 19, 20, 21, 22, 23, 24, 26, 27, 28, 30). The landing surface reflects ~9 of them (Phases 3–9 + glimpses of 7/8). A first-time visitor sees ~30% of the actual product.

### Shipped features and where each is visible

| Feature (phase) | Live cache | landing.html | App Store listing (TBD) | In-app only |
|---|---|---|---|---|
| Mood tags (3) | — | ✓ screenshot | — | — |
| Tonight + spin (4, 14) | — | ✓ paths-grid | — | — |
| Veto + fairness rule (4) | — | — | — | ✓ |
| Auth + groups (5) | — | implied | — | — |
| Push (6, per-event) | — | — | — | ✓ |
| Watchparty + reactions (7) | — | ✓ screenshot | — | — |
| **Wait Up reaction delay 0–24hr (15.5)** | v35.5 | — | — | ✓ |
| Watch-intent flows (8) | — | ✓ screenshot | — | — |
| **Decision Explanation (20)** | v36.2 | — | — | ✓ |
| **Per-watching-group progress (15)** | v35 | — | — | ✓ |
| Availability notifications (18) | v36 | — | — | ✓ |
| **Kid Mode (19)** | v36.1 | implied (mode-pick) | — | ✓ |
| Conflict-aware empty state (21) | v36.5 | — | — | ✓ |
| Sports Feed Abstraction (22) | v36.6 | — | — | ✓ |
| Live Scoreboard (23) | v36.7 | — | — | ✓ |
| Native video player YouTube/MP4 (24) | v37 | — | — | ✓ |
| Async-replay reactions (26) | v38 | — | — | ✓ |
| Guest RSVP no-account token (27) | v39 | — | — | ✓ |
| **Couch Groups multi-family (30)** | v41–v46 | — | — | ✓ |
| **Social Pick'em + Leaderboards (28)** | v47 | — | — | ✓ |
| Couch Nights themed packs (11) | — | — | — | ✓ |

**Five features in bold are launch-defining.** Wait Up + Couch Groups + per-tuple progress + Decision Explanation + Pick'em are *categorically unique*. Surfacing them on landing + App Store is the highest-leverage marketing move.

---

## 2. Brand positioning

### Current implicit positioning

From landing.html structure: **"the decision app for movie night."** The hero centers on "Who's on the couch tonight?", "Why we built it" frames the 20-minute argument, and "Two ways to couch" frames the product as a deciding tool.

This is *true* but *under-claims*.

### Recommended positioning

**"Couch is the couch operating system. Pick what to watch together, watch together when you can't be in the same room, remember what you watched with whom, compete on Sunday's games."**

Four layers, ordered:
1. **Front door (decision):** the spin/nominate ritual everyone starts with. *Already well-marketed.*
2. **Heart (watch together):** Watchparty + Wait Up + Couch Groups + Native Video. *Currently invisible.*
3. **Loop (memory):** Per-tuple progress + availability notifications + decision explanation + activity history. *Currently invisible.*
4. **Edge (sport):** Pick'em + Live Scoreboard + Sports Feed + Sports Game Mode. *Currently invisible.*

The decision is the front door, but the **loop + sport edge are what bring people back tomorrow night.** Trakt has the loop without the front door. JustWatch has the front door without the loop. Letterboxd has solo memory without plural use. Reelgood-Together has casual sync without memory. Pick'em + Live Scoreboard inside the same app as the watchparty is genuinely unprecedented in this market — nobody bundles "decide + watch + remember + sport" in one consumer surface.

### Voice rules from BRAND.md still hold

- "Speak like a friend handing you the remote, not a product manager."
- Italics carry meaning; no exclamation marks except celebratory.
- Sentence-case buttons.
- DO: "One yes is enough." / DON'T: "Sufficient affirmations detected."

**New rule for App Store copy:** be loud about behaviors, restrained about feelings.
- DO: "Decided in 30 seconds." / DON'T: "Brings families closer."
- DO: "Watch together when you can't be in the same room." / DON'T: "Reimagine connection."
- DO: "Free. No ads. No paywall." / DON'T: "Ad-supported but lightweight."

---

## 3. Landing page review (file-specific)

`landing.html` is well-written but architected for v1 feature set (April 2026). Below are line-specific fixes ordered by impact.

### Fix 1 — Differentiate the two CTAs (`landing.html:140-143`)

Today both CTAs link to `/app`. Wasted real estate.

```html
<div class="hero-cta">
  <a class="cta-primary" href="/app">Start your couch — free</a>
  <a class="cta-secondary" href="#how">See how it works ↓</a>
</div>
```

`Start your couch — free` is concrete (verb + outcome + price-trust signal). Secondary scrolls to "How it works" anchor.

### Fix 2 — Add a "What makes Couch different" section after `.about` (~line 158)

Today the page implies differentiation but never names alternatives:

```
Why not [JustWatch / Reelgood]?            They tell you where to stream.
                                            We help everyone agree on what.

Why not [Letterboxd / Trakt]?              They're solo cinephile journals.
                                            Couch is built for the people watching
                                            with you tonight.

Why not [Teleparty / Scener / Plex]?       They sync your screen with friends.
                                            Couch handles deciding, watching, AND
                                            remembering — without making everyone
                                            install a Chrome extension.
```

Voice: factual, not hostile. Comparative, not bragging.

### Fix 3 — Add a "What's actually in it" features section before screenshots

Four feature blocks, each with a 1-line headline + 2-line elaboration:

```
Wait Up — watch together when you can't be in the same room
Reactions land at the same moment in the show, even if one of you
started 90 minutes late. Or yesterday.

Couch Groups — bring another family in
Multi-family watchparties without a group chat. Cousins three
states away can join your Sunday-night Severance ritual.

Pick up where you left off
We track every "watching group" — Mom + the eldest watch Severance,
both parents watch Lupin. The home screen tells you which couch
left off where.

Pick'em on the big games
Pick winners across NFL, NBA, MLB, NHL, soccer leagues, F1.
Live scores. Reaction-amplified scoring plays. Friend leaderboard.
The cousin who never watches finally has a reason to show up.
```

These are **the four features no other product has.** Surfacing them is the difference between "another decision app" and "a category we own."

### Fix 4 — Replace audience grid with a tighter set (`landing.html:184-193`)

Drop from 5 cards to **3 cards** matching the in-app mode picker:
- **Family** — Mixed ages, kid-safe filtering, everyone on the couch tonight.
- **Crew** — Friends who pile onto the couch. Film clubs, group chats, scheduled nights.
- **Duo** — Just the two of you. Date nights, shared queue, one yes is enough.

Maps 1:1 to `app.html:222-237`. Same nouns, same voice.

### Fix 5 — Add a "Free and private" trust line in or near hero

Place under hero CTA cluster:

```
Free. No ads. No paywalls. Your couch isn't anyone's data.
```

### Fix 6 — Add an FAQ section before footer

5–7 questions, scannable:
- Do I need to log in? *(Yes; Google or email-link or phone, with Apple Sign-In coming for App Store.)*
- Does Grandma need an account? *(No — guest RSVP works without one.)*
- Which streaming services? *(All major. We pull data from TMDB; we never link to pirate sources.)*
- Does it cost? *(No.)*
- What devices? *(Web today, iOS + Android home-screen install today, native App Store apps coming.)*
- What happens to my data? *(Stays in your family's Firestore doc. Read the privacy policy.)*
- How is this different from Teleparty? *(Teleparty needs a Chrome extension and a paid streaming subscription on the same service for everyone. Couch decides, syncs, and remembers — no extension, no shared subscription required.)*

### Fix 7 — Refresh screenshots (out-of-date by 19 cache versions)

Current 5 screenshots from Phase 9 (`landing.html:198-202`):
- tonight-hero · watchparty-live · mood-filter · title-detail · intent-rsvp

**Replacement set (5–6 screenshots, each demonstrating a launch-defining behavior):**

| New screenshot | Surface | What it proves |
|---|---|---|
| `tonight-couch-viz.png` | Tonight tab with V5 couch viz | "Everyone's on the couch" — the unique primitive |
| `watchparty-wait-up.png` | Watchparty live with Wait Up slider | "Watch together at different times" |
| `couch-groups-roster.png` | Watchparty with multi-family roster + (FamilyName) chips | "Bring another family in" |
| `tonight-pickup.png` | Pickup-where-you-left-off widget on Tonight | "We remember which couch left off where" |
| `decision-explanation.png` | Match-card with "Why this is in your matches" | "We tell you why this pick" |
| *(optional 6th)* `pickem-leaderboard.png` | Pick'em surface with leaderboard | "Pick winners on the big games" |

Capture against current build (`couch-v47-pickem`). 1170×2532 (iPhone 14 Pro). Single device, consistent lighting/family-state.

### Fix 8 — Catch up the changelog

`changelog.html` ends at v35.1 (2026-04-27). Missing entries through v47-pickem (~12 cache versions, organized by phase rather than per-cache):

| Cache | Phase | One-line release-summary |
|---|---|---|
| v36 (2026-04-29) | 18 — Availability Notifications | *"Dune just hit Max for your household."* — daily provider-refresh push when a queued title appears on a service the family subscribes to. |
| v36.1 (2026-04-29) | 19 — Kid Mode | *"Kids on the couch."* — global toggle that filters Tonight to G/PG, with parent override on detail modal. |
| v36.2 (2026-04-30) | 20 — Decision Explanation | *"Why this pick?"* — humility-voiced match explanations on spin reveal, Tonight matches, and detail-modal "Why this is in your matches." |
| v36.5 (2026-04-30) | 21 — Conflict-Aware Empty State | *"Why nothing's matching."* — empty state diagnoses the cause (vetoes / kid mode / mood / providers) instead of generic "No matches yet." |
| v36.7 (~2026-04-30/05-01) | 23 — Live Scoreboard | Live score strip + amplified reactions on scoring plays inside watchparty Game Mode. |
| v37 (2026-05-01) | 24 — Native Video Player | Watchparties can play YouTube + MP4 titles in-app on a persistent player surface. |
| v38 (2026-05-01) | 26 — Async-Replay | Replay any past watchparty with reactions snapped to the moment they were posted, even days or weeks later. |
| v39 (2026-05-02) | 27 — Guest RSVP | Non-members can RSVP to a watchparty via token-based link (`/rsvp/<token>`) without creating a Couch account. |
| v41 (2026-05-02) | 30 — Couch Groups | Multi-family watchparties — your cousins three states away can join your Sunday-night ritual. |
| v42–v46 (2026-05-03/04) | 30 hotfix waves | Cross-AI Codex P0/P1 + Gemini P0/P1/P2 burndown — 61 of 67 review findings closed across 5 waves. |
| v47 (2026-05-05) | 28 — Social Pick'em + Leaderboards | Pick winners on NFL, NBA, MLB, NHL, soccer leagues, F1. Live scores. Reaction-amplified scoring plays. Family leaderboard. |

Voice match: existing changelog entries are short, italic-summary + bullet list. Use that pattern.

This is also SEO surface — Google indexes /changelog.

---

## 4. App-shell first-run review (file-specific)

### Issue 1 — Sign-in screen lacks value promise (`app.html:160-214`)

Today the sign-in screen says only "Couch / Who's on the couch tonight?" — assumes the visitor knows what Couch is. From an App Store install, the user lands here cold.

**Recommendation:** under the existing tagline, add a 1-line value promise:

```html
<p class="signin-subtag">Decide what to watch tonight in 30 seconds. Free.</p>
```

### Issue 2 — Footer/legal not visible on `/app` route

`landing.html` has Privacy + Terms in the footer. `app.html` does not. Privacy-conscious visitors landing directly on `/app` (deep link, App Store install, share link) never see them.

**Recommendation:** add a low-key link cluster in the signin-footer:

```html
<p class="signin-footer">By continuing you agree to be awesome to the others on your couch. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
```

This is also an App Store reviewer requirement — they will reject a sign-in screen with no privacy link.

---

## 5. Feature messaging hierarchy

For App Store, you need a **single promise + 4 supporting beats** (one per layer of the "couch operating system" framing).

### Recommended hierarchy

**Single promise (App Store subtitle, landing hero, all comms):**
> *"Decide what to watch in 30 seconds. Watch together when you can't be in the same room."*

(Two clauses; first is the front door, second is the moat. Long-form on landing; shortened to *"Decide. Watch together. Remember."* for App Store 30-char subtitle.)

**Four supporting beats (App Store screenshots 1-4, landing features-section):**

1. **Decide together.** *Spin to decide, or nominate a pick. Veto if you hate it. Everyone gets a say.*
   (Anchors: Tonight, spin, veto, nominate, intents, mood filter, Kid Mode)

2. **Watch together — even when you can't be in the same room.** *Watchparty syncs reactions across devices. Wait Up holds them until you press play, hours or days later.*
   (Anchors: Watchparty, Wait Up, native video player, Couch Groups, async-replay)

3. **Remember which couch watched what.** *Per-couple, per-friend-pair progress tracking — no spoilers, no lost-thread.*
   (Anchors: Per-tuple progress, pickup widget, availability notifications, decision explanation, conflict-aware empty state)

4. **Make it a competition.** *Pick'em across NFL, NBA, MLB, NHL, soccer leagues, F1. Live scores in the watchparty. Friend leaderboard.*
   (Anchors: Pick'em, Live Scoreboard, Sports Game Mode, reaction-amplified scoring plays)

Everything else (Couch Nights, themed packs, push notifications, Trakt sync, mood tags) stays as **in-app discovery**. They delight after install but don't drive install.

### App Store listing structure

| Slot | Content |
|---|---|
| Name | Couch Tonight (recommend over "Couch" — ASO collision with furniture apps + Couchsurfing; matches domain `couchtonight.app` + existing `og.alternateName`) |
| Subtitle (30 char Apple) | *"Pick & watch together"* or *"Movie night, decided."* |
| Promotional text (170 char) | *"Decide what to watch in 30 seconds. Watchparty syncs reactions even hours apart. We remember which couch left off where. Free, no ads, your couch isn't anyone's data."* |
| Description (4000 char) | Long-form: hero promise + 4 beats + audience cards (Family/Crew/Duo) + free/private + privacy commitment + what's not in it (no ads, no paywall, no public feeds) |
| Keywords (100 char) | *movie night, family, watch together, watchparty, picker, what to watch, streaming, household, pickem* |
| Category | Entertainment (primary) + Lifestyle (secondary) |

---

## 6. Phase recommendations for launch

### Phase 31: Marketing refresh (NEW — proposed)

**Goal:** Close the visibility gap between shipped product (28 phases / cache v47-pickem) and public surface (Phase 9 marketing). Ships *before* App Store work so Phase 17 has fresh assets.

**Scope (~1 week):**
- Update `landing.html` per §3 fixes 1–6 (CTA differentiation, comparison section, features section, audience trim, free/private trust line, FAQ)
- Capture 5–6 new screenshots per §3 fix 7 (couch-viz, wait-up, couch-groups, pickup, decision-explanation, optional pickem)
- Update changelog per §3 fix 8 (catch up Phases 18, 19, 20, 21, 23, 24, 26, 27, 28, 30 + hotfix waves)
- Update `app.html` per §4 fixes 1-2 (signin subtag, signin privacy/terms)
- Replace `og.png` with 1200×630 hero matching new positioning

Run `/gsd-discuss-phase 31` → `/gsd-plan-phase 31` → `/gsd-review` → `/gsd-execute-phase 31`.

### Phase 17: App Store Launch Readiness (REACTIVATED)

**Already scoped in PROJECT.md "Active":**
> "Native wrapper (Capacitor/PWABuilder) for iOS App Store + Google Play; Apple Sign-In ($99/yr Apple Developer Program); App Store Connect listings + privacy policy + ToS authoring."

**Suggested expanded scope (2-3 weeks):**
- Native wrapper decision (Capacitor recommended for one-codebase iOS+Android; PWABuilder is the lighter route if PWA-feature-parity is acceptable). **Conflicts with CLAUDE.md "no bundlers" — needs `/gsd-spike` resolution.**
- Apple Developer Program enrollment ($99/yr; 1-2 day verification window)
- Google Play Console enrollment ($25 one-time)
- Apple Sign-In implementation (Apple requires it if Google Sign-In is offered; Couch already offers Google → must add Apple to pass review)
- App Store Connect listing per §5 hierarchy
- Google Play listing
- Privacy nutrition labels (Apple) + Data Safety form (Google)
- Privacy policy expansion (must enumerate Firebase, TMDB, Trakt, Sentry, push providers, all data types)
- ToS expansion (must include Apple's required clauses if iOS)
- App Store assets: app icon (mark-1024.png), screenshots per device size matrix, App Preview video (15-30s)
- TestFlight beta (Apple) + Internal Testing track (Google)
- App Review submission (Apple: 1-3 days; Google: 1-7 days)

**Critical gotcha:** Apple Sign-In is mandatory if you ship any other federated sign-in. Couch ships Google + Email-link + Phone today; **Apple Sign-In must be added before App Store review.** Reject-on-sight item per Apple Developer Program Guidelines §4.8.

### UAT close-out checkpoint (BEFORE Phase 17 submission)

Eight phases shipped code-complete, awaiting real-device UAT verification:
- `/gsd-verify-work 18` (7 items in 18-HUMAN-UAT.md)
- `/gsd-verify-work 19` (8 items in 19-HUMAN-UAT.md) — Kid Mode
- `/gsd-verify-work 20` (13 items in 20-HUMAN-UAT.md) — Decision Explanation
- `/gsd-verify-work 24` (11 items in 24-HUMAN-UAT.md) — Native Video Player
- `/gsd-verify-work 26` (10 items in 26-HUMAN-UAT.md) — Async-Replay
- `/gsd-verify-work 27` (10 items in 27-HUMAN-UAT.md) — Guest RSVP
- `/gsd-verify-work 28` (11 items in 28-HUMAN-UAT.md) — Pick'em
- `/gsd-verify-work 30` (11 items in 30-HUMAN-UAT.md) — Couch Groups

App Store submission with unverified UAT is risky — App Review will exercise paths the family hasn't. Run UATs before submission, fix any failures, then submit. ~1 week of device-time spread across the family roster.

### Recommended sequence

```
This week (May 5–11) : Phase 31 (Marketing refresh)        ~1 week
                       UAT close-outs in parallel           ~1 week (device-time)
                       ─────────────────────────────────────────────
Week of May 12       : Phase 17 spike — Capacitor vs PWABuilder
                       Apple + Google Developer Program enrollment
                       ─────────────────────────────────────────────
May 15 – June 5      : Phase 17 execution (~2-3 weeks)
                       Apple Sign-In implementation
                       App Store + Play listing assets
                       Privacy policy + ToS expansion
                       ─────────────────────────────────────────────
June 5–12            : TestFlight beta + Play Internal Testing
                       ─────────────────────────────────────────────
mid-June             : App Review submission (Apple 1-3 days, Google 1-7 days)
late June            : Public launch
```

**6-7 week runway from today to public launch.**

---

## 7. Cross-AI review preparation (for `/gsd-review`)

When the user runs `/gsd-review` on Phase 31 / 17 plans, external AIs should be asked to pressure-test these specific claims:

### Strategic claims to challenge

1. **"Repositioning from 'decision app' to 'couch operating system' (4 layers)"** — Is this overreach? Does the brand earn it? Counter-argument worth surfacing: Letterboxd kept positioning narrow ("for film lovers") and won. Maybe Couch should stay narrow.

2. **"Surface Wait Up + Couch Groups + per-tuple progress + Pick'em on landing"** — Are these four features visitors will *understand* without context, or do they need pre-explanation? Does adding Pick'em (a sport-betting-adjacent surface) confuse the family-brand?

3. **"Drop Teams + Clubs from audience grid"** — Plural-brand dilution risk vs. addressable-market tradeoff. Is the tighter audience cluster worth losing the casual-discovery hits?

4. **"App Store name = 'Couch Tonight' not 'Couch'"** — Is the ASO collision argument strong enough to override the existing single-word brand?

5. **"Decision app vs Trakt vs Letterboxd vs Teleparty vs JustWatch positioning"** — Is the comparison matrix accurate? Are we missing a closer competitor (Wachter, Reelgood-Together, Plex Discover Together, Apple SharePlay, FaceTime SharePlay)?

6. **"Run UATs before App Store submission"** — Worth a week of device-time to find issues before App Review does, or is App Review's catch-rate good enough that UAT can run in parallel?

### Tactical claims to challenge

7. **"Replace 'Pull up a seat' CTA with 'Start your couch — free'"** — Loses voice ("Pull up a seat" is a BRAND.md DO pattern). Is the voice loss worth the conversion gain?

8. **"Capacitor over PWABuilder for native wrapper"** — Capacitor adds bundler dependency Couch deliberately avoided per CLAUDE.md. PWABuilder skips this but ships shallower native integration. Tradeoff worth a separate spike.

9. **"Apple Sign-In as the launch blocker"** — Confirm Apple's current policy (Apple's rules drift quarterly). Last verified: Apple Developer Program Guidelines §4.8 requires Apple Sign-In if you offer any other federated sign-in.

10. **"Pick'em as a launch beat"** — Or hold it back as a "look what else" surprise post-install? Does putting "pick winners" on landing crowd out the family-friendly framing?

### Format for cross-AI feedback

Each AI is asked to:
- Take a position on each strategic claim (agree / disagree / depends-on)
- Surface 1-2 risks I haven't flagged
- Recommend a single "must-fix-before-launch" item if forced to pick one

The structured second-opinion brief lives at `.planning/CROSS-AI-BRIEF-2026-05-05.md` (produced as C-step output).

---

## 8. Prioritized fix list

### P0 — launch blockers (must ship before App Store submission)

| # | Item | Owner | Phase | Estimate |
|---|---|---|---|---|
| 1 | Apple Sign-In (App Review reject-on-sight without it) | Dev | 17 | 2-3 days |
| 2 | Privacy policy expansion (enumerate all data flows) | Copy | 17 | 1-2 days |
| 3 | App Store listing copy + assets | Copy + Design | 17 | 3-5 days |
| 4 | Apple Privacy nutrition labels + Google Data Safety form | Dev | 17 | 1 day |
| 5 | Refresh landing screenshots against v47-pickem build | Design | 31 | 1 day |
| 6 | Catch up changelog (Phases 18, 19, 20, 21, 23, 24, 26, 27, 28, 30 + hotfixes) | Copy | 31 | 1 day |
| 7 | Add /privacy + /terms links to /app sign-in screen | Dev | 31 | 30 min |
| 8 | Add value-promise subtag to /app sign-in screen | Copy | 31 | 30 min |
| 9 | UAT close-out for Phases 18, 19, 20, 24, 26, 27, 28, 30 | Tester (user + family) | parallel | 1 week device-time |
| 10 | App Store name decision: "Couch" vs "Couch Tonight" | Brand | 17 | 30 min decision |
| 11 | Native wrapper spike (Capacitor vs PWABuilder) | Dev | 17 | 1-2 days |

### P1 — high-impact, ship if time permits

| # | Item | Phase | Estimate |
|---|---|---|---|
| 12 | "What makes Couch different" comparison section on landing | 31 | 0.5 day |
| 13 | "What's actually in it" 4-feature section (Wait Up + Couch Groups + Pickup + Pick'em) | 31 | 0.5 day |
| 14 | "Free and private" trust line in hero | 31 | 15 min |
| 15 | Tighten audience grid (drop Teams + Clubs) | 31 | 15 min |
| 16 | FAQ section on landing | 31 | 0.5 day |
| 17 | Differentiate two hero CTAs ("Start your couch" + "See how it works") | 31 | 15 min |
| 18 | App Preview video (15-30s) for App Store | 17 | 1-2 days |
| 19 | og.png refresh against new positioning | 31 | 0.5 day |

### P2 — nice-to-have, post-launch acceptable

| # | Item | Notes |
|---|---|---|
| 20 | Year-in-Review revival (Phase 10 deferred) | Per PROJECT.md, deferred until usage signal earns it |
| 21 | Solo mode on-ramp | Both AIs said defer (plural-brand dilution) |
| 22 | Custom lists primitive | Codex Tier 2; nice but post-launch |
| 23 | Calendar layer (recurring watchparties) | Phase 16 deferred per cross-AI 2026-04-28 |
| 24 | Affiliate hooks (Phase 30.1) | Carved out per CONTEXT D-03; post-launch monetization |
| 25 | Phase 15.3 (DESIGN-01 SVG logo + wordmark sources) | Cosmetic; PNGs work fine for v1 launch |

---

## 9. What this review does NOT cover

- **Code-level review of js/app.js, css/app.css, sw.js** — out of scope. Run `/gsd-code-review` if needed.
- **Security audit** — already done per Phases 13, 15.1. Re-run `/gsd-secure-phase` against current state if Phase 17 expands attack surface.
- **Performance review** — out of scope. Sentry tracesSampleRate 0.1 means production data exists; query before launch.
- **Accessibility audit** — BRAND.md notes WCAG contrast already verified on tokens. Run a separate a11y pass before App Store submission (Apple's accessibility review can flag).
- **Internationalization** — Couch is en-US only today. Out of scope for launch.

---

## 10. Open questions for the user

These don't block the analysis but shape execution:

1. **App Store name: "Couch" or "Couch Tonight"?** ASO collision with furniture apps + Couchsurfing argues for "Couch Tonight." Domain + `og.alternateName` already imply the latter.

2. **Native wrapper: Capacitor or PWABuilder?** CLAUDE.md says no bundlers. PWABuilder respects that constraint; Capacitor is more capable but adds bundler infrastructure. Worth a `/gsd-spike` before Phase 17 planning.

3. **Soft launch vs hard launch?** App Store submission can include phased rollout (Apple Phased Release; Google Staged Rollout). Recommend phased.

4. **Marketing channel for launch?** Out of scope for this review. Product Hunt? Twitter/X? Reddit r/television? Personal-network invite waterfall?

5. **Beta-tester recruiting?** TestFlight caps at 10,000 external testers; need to recruit before submission. Personal network alone may not stress-test multi-family Couch Groups properly.

6. **Pick'em as a launch beat?** Open question whether to lead with Pick'em on landing (expands audience to sport-curious folks) or hold it back as post-install delight (preserves family-brand purity).

---

*End of review. Source-of-truth doc; refresh on every launch-prep phase transition.*
