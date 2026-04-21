# Growth & Virality Mechanics — Couch

**Researched:** 2026-04-21
**Confidence:** MEDIUM (benchmarks are industry-wide; few "family PWA" specifics exist)

## 1. K-Factor Patterns: What Compounds vs Plateaus

K = invites_per_user × conversion_rate. K>1 compounds; K<1 plateaus and requires paid acquisition. ([First Round](https://review.firstround.com/glossary/k-factor-virality/), [Getmonetizely](https://www.getmonetizely.com/articles/how-to-calculate-viral-coefficient-and-k-factor-the-math-behind-saas-virality))

| App | Loop Type | K Pattern | Lesson for Couch |
|---|---|---|---|
| **WhatsApp** | 1:N contact-graph autodetect | K ~1.0+ at peak; invite was *the product* (your contacts appear the moment you open it) | Make "who's already here" visible day one |
| **Slack** | Team multi-seat, admin pushes invites | High K *inside* the workspace, but each workspace is a closed graph | Families behave like workspaces — one invite wave, then flat |
| **Discord** | Server model, 1 server → many joiners | Medium K; server creators do heavy lifting | Only works if one user has strong incentive to recruit |
| **Geneva** | Small-group ("home") invite | Stalled — groups die if organizer stops pushing | Warning: Couch's family-graph is similar |
| **BeReal** | Friend-invite, FOMO-gated | K spiked to ~1.5 (21M→73M in one month Jul–Aug 2022), crashed by mid-2023 to ~6M DAU | Viral ≠ retained. ([TechCrunch](https://techcrunch.com/2023/12/12/bereal-adds-private-groups-and-live-photo-like-features-pew-estimates-13-of-us-teens-use-app/), [Wikipedia](https://en.wikipedia.org/wiki/BeReal)) |

**Key insight for Couch:** family apps are structurally Slack-like, not WhatsApp-like. The graph is bounded (~3–6 people). You can't expect compounding K>1 *within* a family. Virality must come from **family-to-family** spread (friend recommends Couch to another parent), not within-family.

## 2. Invite UX: Proven vs Unproven

### PROVEN to work

- **One-tap share + rich media**: invites with images/video install at **2× the rate of text-only** ([GrowSurf](https://growsurf.com/statistics/mobile-app-referral-statistics/))
- **Friction-free one-tap**: 60% higher participation than multi-step flows ([GrowSurf](https://growsurf.com/statistics/mobile-app-referral-statistics/))
- **Deep-links with pre-filled context**: Branch/AppsFlyer data — contextual deep links drop user into correct state with code already applied ([Branch](https://www.branch.io/deep-linking/), [AppsFlyer](https://www.appsflyer.com/glossary/deep-linking/))
- **SMS over email for personal invites**: ~90% of direct-message referral traffic happens via SMS/WhatsApp; SMS conversion 21–40% industry-wide vs email 2–5% ([Omnisend](https://www.omnisend.com/blog/sms-marketing-statistics/), [GrowSurf](https://growsurf.com/statistics/mobile-app-referral-statistics/))
- **Referred users retain better**: D1 retention 42% vs 28% paid-acquired; LTV +25% ([GrowSurf](https://growsurf.com/statistics/mobile-app-referral-statistics/))

### FAILS (SOUNDS GOOD, UNPROVEN OR HARMFUL)

- **4-char code typed into a field** (Couch's current): adds 2–3 steps of friction. Typed codes are a fallback, not the primary path.
- **"Install, then invite"** chicken-and-egg: sender must install, then navigate to invite, then send — every step loses ~30%. ([Medium: Viral Loops](https://medium.com/@gbao.hnguyen/viral-loop-growth-mechanics-bde51e24fcdf))
- **Public "leaderboard" sharing** for private family content: privacy-sensitive families won't do it
- **Refer-and-earn credits**: no evidence these work for household/free-tier apps; they work for transactional apps (Uber, DoorDash)

**Verdict on Couch's 4-char family code:** functional but suboptimal. **Deep-link with code embedded (`couchtonight.app/join/AB12`) is the gold standard.** Keep typed code as fallback for "I got the code verbally."

## 3. Natural Share-Out Moments in Couch's Flow

Viral prompts must hit at **moments of satisfaction**, not friction. ([Andrew Chen](https://andrewchen.com/more-retention-more-viral-growth/)) Couch's existing surfaces:

| Moment | Share Type | Audience | Why It Works |
|---|---|---|---|
| **Match happens** ("everyone swiped yes") | In-app: "add another family member?" | Intra-family | Dopamine hit — best moment to expand the family |
| **Tonight's pick chosen** | Shareable card (poster + "We're watching X tonight — get Couch") | Inter-family (Instagram/iMessage) | Letterboxd-pattern: authentic taste signal |
| **Watchparty starts** | "Invite a friend to join" deep-link | Inter-family | Teleparty's proven pattern ([MakeUseOf](https://www.makeuseof.com/teleparty-vs-discord-best-way-watch-with-friends/)) |
| **Post-watch rating** | "Your weekend in movies" recap card | Social (IG story) | Spotify Wrapped / Letterboxd year-in-review pattern |
| **Empty-state / nobody to match with** | "Who's missing? Invite them." | Intra-family | Solves chicken-and-egg — app is unusable solo |

## 4. Who Invites? (Family App Dynamics)

Apple Family Sharing, Google Family Link, and every co-parenting app research shows **one "family organizer" initiates** ([Apple Support](https://support.apple.com/en-us/105062), [Google](https://families.google/intl/en_ca/families/)). No studies name *which* parent, but anecdotal pattern across family-org apps (Cozi, OurFamilyWizard) points to the **most-digital-native parent — typically the one who already manages the family calendar/streaming logins**. Aim onboarding at them: "Set up Couch in 60 seconds, then text the link to your family."

## 5. Letterboxd Lesson (Media-App Network Effects)

Letterboxd grew 1.8M→17M users (2020–2024) with near-zero paid marketing. Drivers ([Variety](https://variety.com/vip/letterboxd-year-end-report-growth-1236277320/), [NoGood](https://nogood.io/2024/12/02/letterboxd-marketing/), [TheWrap](https://www.thewrap.com/letterboxd-social-media-platform-film-fans/)):

1. **Shareable review screenshots** posted to Twitter/TikTok — organic, taste-signaling, zero cost to Letterboxd
2. **Year-end stats** users share voluntarily (Spotify Wrapped pattern)
3. **Authentic voice** — quotes landing on official movie posters closed the loop

**Can Couch mirror this?** Partially. Letterboxd virality = *individual taste expression*. Couch is *group consensus* — harder to show off. But **"Couch recap" cards ("Our family watched 12 movies in April — here's what we agreed on")** map directly onto the Wrapped/Letterboxd pattern and are low-risk to build.

## 6. Onboarding First-Minute Benchmarks

- **Teleparty**: install extension → pick title → click "Start Party" → copy link. ~60 sec. ([MakeUseOf](https://www.makeuseof.com/teleparty-vs-discord-best-way-watch-with-friends/))
- **Plex Watch Together** (being deprecated): multi-step, high friction. ([Android Authority](https://www.androidauthority.com/jellyfin-syncplay-explained-3530437/))
- **Letterboxd**: signup → follow 3 friends → rate 5 films. Friends-first gates the value.
- **Geneva**: organizer creates home → invites → most homes die within weeks if organizer disengages.

**Stuck points:** (1) user alone in app with nothing to match against, (2) invite step buried behind settings, (3) no perceived value until 2nd person joins.

## 7. Recommended Growth Loops for Couch (Priority Order)

1. **Deep-link family invites** (replace typed code as primary path). Pre-fill code via `couchtonight.app/join/{CODE}`. Keep 4-char typed code as SMS-friendly fallback. **Highest-leverage change.**
2. **"Share tonight's pick" card** — auto-generated OG image with poster + "We agreed on [X] tonight via Couch." Native share sheet → iMessage/Instagram. Mirrors Letterboxd taste-signaling loop.
3. **Empty-state invite pressure** — when family has <2 members, the primary CTA must be "Invite [spouse/kids]" not "Browse movies." Solves install-then-invite dead-end.
4. **Monthly family recap** — "Your April in movies" shareable card. Low build cost, Spotify-Wrapped-proven pattern.
5. **Watchparty invite deep-links** (Phase 6+) — Teleparty-style "send this link, they join in 1 tap."

**Avoid:** public leaderboards, refer-a-friend credits, gamified invite streaks. Wrong vibe for family privacy context.

## Confidence Notes

- **HIGH:** Letterboxd growth data, BeReal trajectory, Teleparty UX — all well-documented
- **MEDIUM:** SMS vs email conversion (industry avg, not family-app specific), deep-link lift (vendor-reported)
- **LOW:** "Which parent invites first" — zero published research; inferred from adjacent family-org apps

## Sources

- [First Round: K-factor](https://review.firstround.com/glossary/k-factor-virality/)
- [Andrew Chen: Retention > Virality](https://andrewchen.com/more-retention-more-viral-growth/)
- [GrowSurf: 35+ Mobile App Referral Statistics](https://growsurf.com/statistics/mobile-app-referral-statistics/)
- [Omnisend: 2025 SMS Benchmarks](https://www.omnisend.com/blog/sms-marketing-statistics/)
- [Branch.io: Deep Linking](https://www.branch.io/deep-linking/)
- [AppsFlyer: Deep Linking Glossary](https://www.appsflyer.com/glossary/deep-linking/)
- [Variety: Letterboxd Growth](https://variety.com/vip/letterboxd-year-end-report-growth-1236277320/)
- [NoGood: Letterboxd Marketing](https://nogood.io/2024/12/02/letterboxd-marketing/)
- [TheWrap: Letterboxd Grassroots](https://www.thewrap.com/letterboxd-social-media-platform-film-fans/)
- [TechCrunch: BeReal Private Groups](https://techcrunch.com/2023/12/12/bereal-adds-private-groups-and-live-photo-like-features-pew-estimates-13-of-us-teens-use-app/)
- [Wikipedia: BeReal](https://en.wikipedia.org/wiki/BeReal)
- [MakeUseOf: Teleparty vs Discord](https://www.makeuseof.com/teleparty-vs-discord-best-way-watch-with-friends/)
- [Plex: Watch Together Support](https://support.plex.tv/articles/watch-together/)
- [Medium: Viral Loop Growth Mechanics](https://medium.com/@gbao.hnguyen/viral-loop-growth-mechanics-bde51e24fcdf)
- [Apple: Family Sharing](https://support.apple.com/en-us/105062)
- [Getmonetizely: Viral Coefficient Math](https://www.getmonetizely.com/articles/how-to-calculate-viral-coefficient-and-k-factor-the-math-behind-saas-virality)
