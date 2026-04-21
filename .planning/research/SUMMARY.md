# Couch — Research Synthesis

**Produced:** 2026-04-22 (autonomous dispatch of 13 parallel research agents + synthesis)
**Corpus:** `01-direct-competitors` → `13-naming-trademark` in this directory
**Scope:** pre-Phase-9 deep dive — market, competitors, users, design, monetization, growth, a11y, naming

---

## 🎯 The single most important finding

**Couch is in an unclaimed market quadrant and everyone else who tried to own it either died or never tried.**

Map competitors on a Solo↔Group × Decide↔Watch grid:

| | Solo | Group |
|---|---|---|
| **Decide** | JustWatch, Reelgood | ❌ **EMPTY — this is Couch's lane** |
| **Watch** | Individual streaming | Teleparty, Plex WT, Kast, Scener (dying) |

- **Group × Watch is a graveyard.** Teleparty/Kast peaked during 2020 lockdowns. Scener raised $2.1M, went quiet. Amazon Watch Party killed April 2024. Twitch Watch Parties killed 2024. Disney+ GroupWatch deprecated. Plex Watch Together sunsetting 2025. Platform-bundled co-viewing is structurally unhealthy.
- **Group × Decide — nobody is really there.** Movie Night Polls / PickAMovieForMe are toys. Cozi / OurHome aren't media apps. Letterboxd is solo + async social.
- **The status-quo "alternative" is texting + yelling across the room + one person dictating.** AITA/Reddit threads show this is a real emotional pain point, not just mild friction. Nielsen: ~10.5 min/session picking; 1 in 5 viewers give up entirely. 86% of families plan to watch more together YoY. Segment is a tailwind, not a fad.

**Couch's wedge:** own the decision moment for households. Everything else is a growth layer on top.

---

## 🧭 Strategic recommendations (ranked by impact)

### 1. 📦 Collapse family/crew/duo into one "Couch" container (STRUCTURAL)

**Research thread 08 is the most load-bearing finding in this dive.** Forcing users to pick a "mode" at signup is unusual in successful multi-user apps. Geneva, Discord, Notion, Jellyfin all converged on **one flexible container with composable members + profiles + roles**, where the "type" is *inferred* from composition, not declared.

**Recommendation:** one user-facing concept — "a Couch." Members + Profiles + Roles inside. Family/crew/duo become internal tags used for defaults (thresholds, icon set, copy tone), not user-chosen modes.

**Cost:** schema refactor, onboarding rewrite. Should land early in Phase 9 before design tokens calcify.

### 2. 🧍 Solo mode as the on-ramp, not the destination (STRATEGIC)

**Research threads 02 + 06 + 08 converge:** Letterboxd (17M→26M users, solo-first) proves solo + mood-driven is a real market. Couch's current coordination-only posture locks out the ~50% of target users who aren't in a group-watching habit yet.

**Recommendation:** ship "Couch for One" — same app, mood-driven recommendations replace the voting layer. Import Trakt history for instant cold-start rescue. Single onboarding for both paths.

**Critical invariant (from thread 08 Q3):** merging solo → group must be one-way ("invite my people into my Couch"), with a **retroactive-privacy dialog** on invite acceptance: Share everything / Ratings only / Keep private (default: Ratings only). Letterboxd's "Between Us" ships precisely because they didn't design this in; painful to retrofit.

### 3. 👶👧 Teens are MORE relevant to Couch than adults (CREATIVE)

Teens discuss movies with friends more than social content (53%). "See a new movie" is their #1 weekend activity two years running. **Letterboxd already owns teen movie taste**; no app owns teen friend-group coordination.

**Top 2 teen-specific hooks to prototype:**
- **Always-On Friend Room / "Couch Channel"** — persistent weekly suggestion room (teens plan 2-5 days out with friends, not 20 min before — Couch's current "tonight" cadence misfits this)
- **Watch-Together Streak** — Duolingo Friend Streak mechanic for weekly co-watches (+22% DAU lift at Duolingo)

**Parent-branding risk is real but mitigable:** COPPA 2.0 teen self-consent (passed Senate March 2026), distinct teen-mode aesthetic, teen-owned social graph separate from parent's family.

### 4. 📣 Naming: keep "Couch Tonight" — not bare "Couch" (TRADEMARK)

**Thread 13 verdict: AMBER.** Bare "Couch" in the App Store hits several existing movie/TV apps (Couch TV, Couch Movies, CouchTimes). Couch-to-5K owns the "couch + app" mental model. Bare COUCH in USPTO Classes 9/41 risks descriptiveness refusal.

**Thread 08 vocabulary blueprint:**
- **Couch** = product/space name (keep — love the brand, use in logotype)
- **"Couch Tonight"** = full wordmark + App Store title
- **Tonight** = primary screen tab (already true)
- **Pick** = the unit of activity ("start a Pick," "your last Pick")
- **"Watching tonight"** replaces "who's on the couch" in member picker copy (fixes the phone-not-on-couch literalism)

Defensive domains to grab: `couchtonight.com`, `couchtonight.tv`, `thecouch.app`, `getcouch.app`, `oncouch.app`. File COUCH TONIGHT in USPTO Class 9 + 41.

Fallback names if counsel blocks: **Popcorn Night** (top pick), Loungely, Reel Night, Snuggle Cinema, Showtime Together.

### 5. 💰 Monetization: "Couch Plus" — $4.99/mo, $39/yr, $99 lifetime, family-scope billing

**Thread 10 recommendation** grounded in RevenueCat/Adapty 2025 benchmarks.

- **Free forever:** everything shipped + Phase 6/7/8/10 basics. Core ritual never paywalled.
- **Couch Plus ($4.99/mo | $39/yr | $99 lifetime):** family-scope (admin pays, all members covered). Mirrors Firestore data model; avoids per-seat anti-pattern.
- **No ads, ever.** Positioning feature. Say it on landing page.

**Key anti-patterns to avoid:**
- Paywalling existing free features (Cozi/Fantastical trust collapses are permanent)
- Mid-ritual upsell modals (contradicts 30-second value prop)
- Weekly pricing (predatory-adjacent, off-brand)
- Trial-abuse 7-day trials (use 14-day annual instead)

**Revenue sketch:** ~$38 blended ARPU. 10K households × 8% conversion ≈ $30K ARR. 100K households × 8% ≈ $304K ARR. Distribution is the bottleneck, not monetization.

### 6. 🌱 Growth: deep-link invites, SMS-first, Letterboxd-style shareables

**Thread 11 ranking:**

1. **Deep-link family invites** (`couchtonight.app/join/AB12` with code pre-filled). Replace typed 4-char code as primary path. 60% higher participation; 2× install rate over text-only.
2. **"Share tonight's pick" shareable card** (Letterboxd-pattern taste signal, Instagram/TikTok-sized)
3. **Empty-state invite pressure** (primary CTA = "Invite your family," not "Browse movies" — solves chicken-and-egg)
4. **Monthly family recap card** (Spotify-Wrapped pattern, cheap, high-shareability)
5. **Watchparty invite deep-links** (already in Phase 6)

**SMS beats email decisively** for family: 21-40% vs 2-5% conversion. Referred users retain at 42% D1 vs 28% paid.

**Aim onboarding at the most-digital-native parent** (the one who manages family calendar/streaming logins). Goal: 60-second setup → SMS link to the rest.

**Avoid:** public leaderboards, refer-a-friend credits, gamified streaks (wrong vibe for family privacy).

**Cautionary tale:** BeReal hit K≈1.5 (21M→73M in a month) then collapsed to 6M DAU in a year. Viral ≠ retained.

### 7. 🎨 Design direction for Phase 9: warm-dark sepia (not OLED black), cinema-serif, motion restraint

**Thread 05 key moves:**
- **Closest precedent for `#14110f`:** Reeder's "dark sepia" — validates warm-under-black; reserve true-black for an optional late-night variant.
- **Typography guardrail:** Fraunces / Instrument Serif only ≥20px, italic only ≥24px, Inter below that. Consider adding mono for metadata (the A24 move).
- **Palette expansion:** add a bone/cream (~#F1E8DA) and one saturated accent. Avoid orange (Letterboxd owns it) and yellow (Mubi owns it). **Amber/marquee-gold + low-saturation oxblood for ritual moments is defensible lane.**
- **Ritual pattern:** Mubi "Film of the Day" and Criterion "Tonight's Feature" are the conceptual siblings — treat the pick as ceremony via framing, not search UI.
- **Motion:** eased linear cross-fades 300-400ms, letterbox-bar reveals, subtle Ken Burns. **No spring physics** — springs read SaaS, not cinema.
- **Landing page:** Arc's long-scroll narrative rhythm + Mubi's photographic restraint. Use a real warm-living-room still, not a laptop mockup.

### 8. ♿ Accessibility: WCAG 2.2 AA baseline — fix velvet red before Phase 9 freezes

**Thread 12 hard finding:** Velvet red `#c54f63` fails AA for body text (~4.3:1 vs 4.5:1 required). Two fixes:
- Brighten to ~`#d66478`+ (gets to ~5.0:1) for body usage, OR
- Strictly scope to ≥20px headings + filled-button backgrounds (white-on-red = AAA)

**Five concrete Phase 9 a11y improvements:**
1. Retire velvet red from text <18px
2. Serif ≥20px / italic ≥24px / Inter elsewhere (via CSS custom properties)
3. Tap targets ≥44×44 (Apple HIG, stronger than WCAG 2.5.8 floor of 24×24)
4. Accessible reaction markup (`role="img" aria-label="laughing reaction"`, `aria-pressed`)
5. Redundant encoding for state (never color-only)

---

## 📊 Priority feature additions (from thread 07 gap analysis, reranked by this synthesis)

1. **Star/half-star ratings + short review text** — fills the Letterboxd gap; low effort; enables per-member diary that becomes YIR raw data
2. **User-curated lists ("Rainy Sunday," "Dad-safe horror")** — expressive family surface; moderate effort; strong brand fit
3. **Deep-link invites as primary** — immediate growth lift; low effort
4. **Trakt history import on signup** — kills cold-start (Couch already has Trakt auth)
5. **Watchlist intersection** ("films we all still want") — reframes existing votes as a warm keepsake
6. **"Tonight's pick" shareable OG card** — opens Letterboxd-style growth loop
7. **Availability notifications** ("Dune just hit Max for your household") — highest-value new capability; needs provider data
8. **TV Time-style "emotion ratings"** (cozy/cried/everyone-loved) instead of just stars — low effort, on-brand

---

## 🧠 Voice-of-user terminology guide

From thread 04 (Reddit + App Store review mining):

**Use:**
- "Movie night" (dominant)
- "Tonight's pick" / "what to watch" (SEO)
- "Vibe" / "mood"

**Use sparingly:**
- "Watch party" — owned by Teleparty

**Avoid:**
- "Content" / "title" / "viewing session" (corporate)
- Slang that ages (Flick Pick, Vibe Check)

**Reframe consideration:** "Veto" risks feeling punitive. Try "Not tonight" or "Pass" in copy.

---

## ⚠ Hard risks + caveats (don't skip)

| Risk | Source | Mitigation |
|---|---|---|
| Schema refactor for collapsed archetypes is invasive | Thread 08 Q1 | Land in Phase 9 BEFORE tokens calcify; atomic migration |
| Solo → group retroactive privacy is P0 | Thread 08 Q3 | Privacy dialog on invite acceptance; default to Ratings-only share |
| Velvet red fails AA body contrast | Thread 12 | Brighten to `#d66478`+ or restrict to ≥18px/filled-button |
| Teen mode is premature if family MVP isn't stable | Thread 09 | Scope teen-mode phase AFTER Phase 9 lands |
| Monetization switch-backlash is permanent | Thread 10 | Never reclaim existing free features; only new capability into Plus |
| BeReal cautionary tale: viral ≠ retained | Thread 11 | Build retention loops (streaks, recap) alongside acquisition |
| "Couch" bare in USPTO risky — needs paid clearance | Thread 13 | File COUCH TONIGHT; human-do paid TESS/Corsearch ($500-1.5k) before Phase 9 commits branding |

---

## ❓ Open questions (not answered by this research — follow-ups needed)

1. **Direct Reddit thread retrieval was weak** (web-search aggregated reviews only). Manual subreddit crawl for verbatim user phrasing before product-copy decisions.
2. **Teen qualitative interviews (5-10 teens 13-17)** before heavy build on always-on room / streak features.
3. **Paid TESS/Corsearch clearance** by IP counsel before Phase 9 commits COUCH or COUCH TONIGHT branding.
4. **Availability data source audit** — does Couch pull TMDB provider data, or would adding availability-notifications require a new integration?
5. **Actual K-factor measurement** on Couch's current 4-char code flow — needs instrumentation before invite-UX rework.
6. **Native speaker international slang check** for "Couch" in ES/FR/DE/JP before international launch.

---

*This is Couch's strategic brief going into Phase 9. Decisions flagged as structural (archetype refactor, solo mode, teen mode) are the biggest bets — scope them deliberately. Copy/palette/a11y tweaks are cheaper but compound. Monetization/growth/trademark are prep work that Phase 9 can land on.*
