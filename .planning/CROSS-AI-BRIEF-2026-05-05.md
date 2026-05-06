# Cross-AI Second-Opinion Brief — Couch Launch Positioning

*Authored 2026-05-05. Self-contained brief for external-AI peer review of the launch-readiness analysis at `.planning/LAUNCH-REVIEW-2026-05-05.md`. Written so it can be pasted into ChatGPT-5 / Gemini Advanced / Grok / a fresh Claude session and produce comparable, structured feedback.*

---

## How to use this brief

**For the user:** copy this entire document into a fresh chat with an external AI and add the prompt at the bottom. Bring the response back and we'll diff it against my analysis.

**For the external AI:** you are being asked to peer-review a launch-positioning plan for a small consumer app. The author's analysis is already written; your job is to pressure-test it. Take a position on each numbered claim. Surface 1–2 risks the author missed. Recommend a single must-fix-before-launch item if forced to pick one. Avoid generic SaaS-launch advice — engage with the specifics.

---

## 1. Product context (so the review is grounded)

**What Couch is.** A PWA at couchtonight.app for families (and small friend-groups) to pick what to watch together. Tagline: *"Who's on the couch tonight?"* Core value: turn the 20-minute "what do you want to watch?" argument into a 30-second ritual. Built by a single developer over the past 6+ weeks across 28 phases.

**Stack.** Single `app.html` + modular `js/` (no bundler) + `css/app.css` + Firebase Hosting + Firebase Firestore + Firebase Cloud Functions (sibling repo). TMDB for catalog metadata. Trakt for watch-history sync. Sentry for error tracking. Service worker for PWA install + cache. ~17000 lines of vanilla JS (`js/app.js` is the bulk).

**What's actually shipped (28 phases):**

| Layer | Features (phase) |
|---|---|
| **Decision** | Mood tags (3) · Veto + fairness rule (4) · Couch viz V5 + Spin + Flow A/B (14) · Decision Explanation (20) · Conflict-Aware Empty State (21) · Couch Nights themed packs (11) |
| **Watch together** | Watchparty + reactions (7) · Wait Up reaction delay 0–24hr (15.5) · Native video player YouTube/MP4 (24) · Async-Replay reactions (26) · Multi-family Couch Groups (30) |
| **Memory / loop** | Per-watching-group progress tracking (15) · Pickup-where-you-left-off (15) · Availability notifications (18) · Trakt sync · Couch history |
| **Plurality** | Auth + Groups (5; Google/Email-link/Phone) · Push notifications per-event opt-in + quiet hours (6) · Watch-Intent Flows (Tonight @ time + interest poll) (8) · Guest RSVP no-account token (27) |
| **Family safety** | Kid Mode global toggle + per-member tier cap + parent override (19) |
| **Sport edge** | 16-league sports feed (22) · Live Scoreboard + reaction-amplified scoring plays (23) · Sports Game Mode (11) · Pick'em + Leaderboards (28, shipped 2026-05-05) |

**Live cache:** `couch-v47-pickem` (curl-verified at couchtonight.app).
**Today's status:** code-shipped end-to-end; 8 phases (18, 19, 20, 24, 26, 27, 28, 30) have device-UAT scripts pending real-device verification by the author's family.

**The user.** Solo developer, builder/founder profile. Family of 5 kids + parents is the primary test surface. Wants commercial launch, not just side-project polish. Brand voice doc (`BRAND.md`) is mature: *"Warm · Cinematic · Lived-in. Restraint is the principle."* DO/DON'T copy patterns specified in detail.

**Launch direction (set 2026-05-05):**
- Target: **App Store** launch (iOS App Store + Google Play), not just web-public.
- Sequence: **Phase 31 (Marketing refresh)** + UAT close-outs in parallel → **Phase 17 (App Store Launch Readiness)** → submission → public launch.
- Runway: **6–7 weeks** from today; target public-launch late June / early July 2026.

---

## 2. The strategic claims to pressure-test

Each numbered claim is the author's working position, with a one-line counter-argument the author has already considered. The external AI is asked to take a position (agree / disagree / depends-on) and add anything missing.

### Claim 1: Reposition from "decision app for movie night" to "the couch operating system"

**Author's position:** the current "decision app" framing under-claims the product. With Watchparty + Wait Up + Couch Groups + per-tuple progress + Decision Explanation + Pick'em all shipped, the actual surface is much wider. Recommend a 4-layer framing: front door (decision), heart (watch together), loop (memory), edge (sport).

**Counter-argument the author considered:** Letterboxd kept positioning narrow ("for film lovers") and won. Maybe Couch should stay narrow.

**Pressure-test:** is the bigger claim earned by the actual product, or is this scope-creep marketing? Does naming 4 layers dilute the front-door message visitors absorb in <10 seconds?

### Claim 2: Surface "Wait Up" + "Couch Groups" + "Pick up where you left off" + "Pick'em" on landing

**Author's position:** these four features are categorically unique in this market. Nobody else has 0-24hr async reaction-delay synchronization, multi-family watchparties, per-watching-group progress, or sports-pick'em-inside-watchparty. Surfacing them turns "another decision app" into "a category we own."

**Counter-argument the author considered:** these features need pre-explanation; visitors won't grasp them in a 200-character scan. Adding Pick'em to the family-brand may confuse audience perception (sport-betting-adjacent vs family-friendly).

**Pressure-test:** can these features be communicated in ≤2 lines each on landing? Is Pick'em an asset or a liability for the family-brand? Should it be hidden until post-install?

### Claim 3: Trim audience grid from 5 cards (Family / Couples / Friends / Clubs / Teams) to 3 (Family / Crew / Duo)

**Author's position:** "for everyone" = "for nobody." Tighter audience matches the in-app mode picker 1:1, sharpens positioning. Cross-AI review on 2026-04-28 (Gemini + Codex) deferred Solo Mode for the same plural-brand-dilution reason; "Teams · Remote happy hour" extends in the same dangerous direction.

**Counter-argument the author considered:** dropping "Teams" loses casual-discovery hits from remote-team users. Possibly post-launch usage signal supports a Team mode, defer the trim until then.

**Pressure-test:** is this premature optimization? Does a 5-card grid actually dilute, or does it cast a wider net that catches more signups even if the core audience is family?

### Claim 4: Ship Phase 31 (Marketing refresh) BEFORE Phase 17 (App Store)

**Author's position:** Phase 17's App Store assets (screenshots, listing copy) need fresh marketing inputs. Doing Phase 17 against stale Phase-9 assets means double-work later.

**Counter-argument the author considered:** Phase 17 is the launch-blocker; everything else is overhead. Marketing can iterate post-launch.

**Pressure-test:** is the assets-coupling strong enough to delay Phase 17 by ~1 week, or should Phase 17 + Phase 31 run in parallel?

### Claim 5: App Store name should be "Couch Tonight" not "Couch"

**Author's position:** "Couch" alone collides with furniture apps + Couchsurfing in App Store discovery. The domain is `couchtonight.app` and OG `alternateName: Couch Tonight` already implies the bigger string. ASO research suggests "tonight" is a high-search-intent keyword for entertainment.

**Counter-argument the author considered:** "Couch Tonight" is two words, harder to remember; the brand wordmark in-app should stay "Couch." The split may confuse — App Store name vs in-app wordmark vs domain.

**Pressure-test:** is the ASO collision argument strong enough to override the 1-word brand? How damaging is the split between App-Store-name and in-app-wordmark? Are there examples of apps that successfully use a longer App Store name + shorter in-app brand?

### Claim 6: Apple Sign-In is a launch-blocker (not optional)

**Author's position:** Apple Developer Program Guidelines §4.8 requires Apple Sign-In if the app offers any other federated sign-in. Couch ships Google + Email-link + Phone today. Apple Sign-In must be added before App Review or it's a reject-on-sight item.

**Counter-argument the author considered:** Email-link and Phone may not count as "federated sign-in" in Apple's interpretation; Google is the only federated provider. Apple Sign-In may be optional if the others are de-emphasized.

**Pressure-test:** has Apple's policy on §4.8 changed in 2025–2026? Are there current submissions that pass review without Apple Sign-In despite shipping Google? Does Email-link OAuth flow trigger §4.8?

### Claim 7: Capacitor adds bundler conflict; PWABuilder respects "no bundlers" but ships shallower native integration

**Author's position:** the project's CLAUDE.md says "Don't introduce a bundler or build step." Capacitor (most popular wrapper) requires Vite/Webpack. PWABuilder (Microsoft's PWA wrapper tool) outputs a thin native wrapper with no JS bundler change. Tradeoff: Capacitor enables full native API access (camera, contacts, deep notifications), PWABuilder is just a webview shell.

**Counter-argument the author considered:** for v1 launch, a webview shell is enough — Couch doesn't need camera or contacts. Worth `/gsd-spike` to verify PWA-feature-parity inside the wrapper (push notifications, install banner, deep links) work correctly.

**Pressure-test:** has anyone successfully shipped a PWABuilder app to App Store + Play in 2025–2026? What's the failure mode when Apple's reviewer hits a PWA-only feature? Is there a third option (Bubblewrap for Android, Hotwire Native for iOS)?

### Claim 8: Drop Teams + Clubs from audience grid and lock 3-card structure (already done in A-step)

**Author's position:** see Claim 3.

**Counter-argument the author considered:** see Claim 3.

**Pressure-test:** see Claim 3.

### Claim 9: "Run UATs before App Store submission" — worth ~1 week of device-time

**Author's position:** 8 phases shipped code-complete with device-UAT scripts pending. App Review will exercise paths the family hasn't. Better to find issues internally first.

**Counter-argument the author considered:** App Review's catch-rate is good enough; UAT can run in parallel with submission. App Review's first round usually flags listing/privacy issues, not feature bugs.

**Pressure-test:** what's the realistic likelihood App Review catches a real feature bug in a 28-phase app? Does running 8 UATs in 1 week stress the family roster?

### Claim 10: Pick'em is a launch beat (not held back)

**Author's position:** Pick'em is a unique feature (nobody else bundles pick'em with watchparty + leaderboard). Surfacing it on landing expands audience to sport-curious folks without alienating family core.

**Counter-argument the author considered:** Pick'em is sport-betting-adjacent; some App Store reviewers may flag it under §5.3.4 (Real-Money Gaming) even though no money is involved. Keeping Pick'em as post-install delight preserves family-brand purity.

**Pressure-test:** is Pick'em-with-no-money-involved a §5.3.4 risk? Are there examples of free pick'em apps shipping to App Store without flags? Does the App Store category (Entertainment) protect against this?

---

## 3. Tactical claims (lower-leverage, but still worth a position)

### Claim T-1: Replace landing CTA "Pull up a seat" with "Start your couch — free" (NOT done in A-step — kept "Pull up a seat" for voice purity)

The author kept "Pull up a seat" because it's a BRAND.md DO pattern. The conversion-optimization pull is to switch to "Start your couch — free" (verb + outcome + price-trust). Should this be A/B tested in Phase 31, or is voice-pure the right call?

### Claim T-2: Free / no-ads / no-paywall trust line in landing hero (already shipped in A-step)

"Free. No ads. No paywalls. Your couch isn't anyone's data." — placed below hero CTA. Loud + restrained per BRAND.md's voice rule. Pressure-test: is this too defensive? Do users default-trust apps without ads, or do they need the explicit reassurance?

### Claim T-3: 5–6 fresh screenshots vs 8–10 (some competitors use 8+)

Author's position: 5–6 is the sweet spot. App Store accepts up to 10; many apps fill the slots but most users only scroll 3–4. Quality > quantity.

Pressure-test: should one of the slots be a video (App Preview)?

### Claim T-4: og.png refresh as part of Phase 31 (not Phase 17)

og.png drives social-share previews. Refreshing as part of marketing makes sense. Pressure-test: should og.png have variants per channel (square for Instagram, wide for Twitter/iMessage)?

---

## 4. Specific questions for the AI

These are the YES/NO/DEPENDS questions the author wants direct answers on:

**Q1.** Should Phase 31 (Marketing refresh) ship BEFORE Phase 17 (App Store) [as currently planned], or in PARALLEL with Phase 17?

**Q2.** Is "Couch Tonight" or "Couch" the right App Store name?

**Q3.** Capacitor or PWABuilder for native wrapper? Or a third option (Bubblewrap / Hotwire Native / direct Swift+Kotlin port)?

**Q4.** Should Pick'em be on landing as a launch beat, or held as post-install delight?

**Q5.** Is the 4-layer "couch operating system" repositioning earned by the actual product, or scope-creep marketing?

**Q6.** Is Apple Sign-In actually required (Apple Developer Program Guidelines §4.8) given Couch ships Google + Email-link + Phone?

**Q7.** Does free Pick'em (no money involved) trigger App Store §5.3.4 (Real-Money Gaming) flagging risk?

**Q8.** Should the audience grid trim to 3 cards (Family/Crew/Duo) or stay at 5 (adding Couples/Friends/Clubs/Teams)?

**Q9.** What's the most likely launch-blocker the author hasn't flagged?

**Q10.** What's the single must-fix-before-launch item if you could only pick one?

---

## 5. Competitive framing the author is using

The author's positioning matrix names these as competitors. Pressure-test the matrix:

| Competitor | Author's positioning |
|---|---|
| **JustWatch / Reelgood** | Where to stream. Couch helps everyone agree on what. |
| **Letterboxd / Trakt** | Solo cinephile journals. Couch is built for the people watching together tonight. |
| **Teleparty / Scener / Plex Watch Together** | Sync your screen with friends. Couch handles deciding, watching, AND remembering — without a Chrome extension. |
| **TV Time / Hobi** | Episode tracking + reminders. Couch's pickup-where-you-left-off + per-tuple progress beats the per-individual model. |
| **Apple TV / Disney+ profiles** | Per-profile recs inside one service. Couch is cross-service. |

**Q11.** Is the matrix accurate?

**Q12.** Are there missing competitors? Specifically: Apple SharePlay, FaceTime SharePlay, Microsoft Teams Together Mode, Discord Watch Together, Wachter, Reelgood-Together, Watch2Gether, Plex Discover Together?

**Q13.** Does the matrix's tone (factual, comparative) work for App Store description copy, or does Apple's review process penalize naming-competitors?

---

## 6. Things the author has NOT covered (and why)

So the AI doesn't waste time pointing these out:

- **Code-level review** — out of scope for positioning. The author has separate `/gsd-code-review` workflows.
- **Performance audit** — out of scope. Sentry tracesSampleRate 0.1 is collecting prod data; query before launch.
- **Accessibility audit** — out of scope for positioning. WCAG contrast already verified in BRAND.md tokens. Separate a11y pass before App Store submission.
- **Internationalization** — Couch is en-US only. Out of scope for v1 launch.
- **Marketing channel strategy** — out of scope. Product Hunt / Twitter/X / Reddit r/television not yet decided.
- **Beta-tester recruiting** — out of scope. TestFlight caps at 10,000 external testers; recruiting plan TBD.
- **Affiliate / monetization** — explicitly out of scope per CLAUDE.md "Don't start monetization / billing / plan-tier work."
- **Solo mode** — deferred per cross-AI 2026-04-28 (plural-brand dilution risk).

---

## 7. Format for the AI's response

Please structure your reply as:

```
## Position on each claim (1-10 strategic + T-1..T-4 tactical)

Claim 1 (Repositioning): AGREE / DISAGREE / DEPENDS-ON [pick one]
  Reasoning: [2-3 sentences]
  Risk I'd add: [optional, 1 sentence]

Claim 2 (Four features on landing): ...
[continue for all 14]

## Direct answers to Q1–Q13

Q1: [your answer in ≤3 sentences]
Q2: ...
[continue]

## Two risks the author missed

Risk A: [1-3 sentences]
Risk B: [1-3 sentences]

## Single must-fix-before-launch (if forced to pick one)

[Your pick + 1 sentence on why]
```

Please be concrete and engage with specifics. Avoid generic SaaS-launch advice ("focus on user research", "consider product-market fit") — the author has been at this for 6 weeks across 28 shipped phases; the fundamentals are settled. The questions are about the specific positioning and sequencing trade-offs.

---

## 8. (For the user) prompt to paste with this brief

Suggested wording when sending to ChatGPT-5 / Gemini Advanced / Grok / a fresh Claude:

> *I'm launching a small consumer app and want a structured second opinion on the positioning + sequencing plan. Below is the full brief. Please respond in the format specified at the bottom (§7). Be concrete; engage with the specifics, not generic SaaS-launch advice. The author has built this product over 6 weeks across 28 phases — the fundamentals are settled, the questions are about positioning and sequencing trade-offs.*

---

*End of brief. Source-of-truth doc: `.planning/LAUNCH-REVIEW-2026-05-05.md`. Phase 31 scope: `.planning/phases/31-marketing-refresh/31-CONTEXT.md`.*
