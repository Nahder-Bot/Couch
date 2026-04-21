# Monetization Research — Couch

**Researched:** 2026-04-21 | **Confidence:** MEDIUM-HIGH (benchmarks from RevenueCat/Adapty 2025 reports; Couch-specific projections are modeled, not measured)

---

## Benchmarks (family & media-adjacent apps)

| App | Model | Price | Free tier | What's paywalled |
|---|---|---|---|---|
| **Cozi** | Freemium + ads | Free / Gold $39/yr | Shared calendar, lists | Ad removal, month view, birthday tracker, change notifications, shopping mode |
| **Life360** | Tiered freemium | Free / Silver / Gold $14.99/mo ($99.99/yr) / Platinum | Basic location + 2 Places | Location history, crash detection, ID theft, roadside |
| **OurHome** | Was free-only; 2025 added Premium | Free / Premium (small) | Chores, rewards, calendar | Shopping-list sections, rewards mgmt, custom messages |
| **Picniic** | Freemium hybrid | Free / ~$50/yr / ~$250 lifetime | Dashboard basics | Full feature unlock |
| **Fantastical** | Subscription (post-2020 switch) | ~$4.75/mo annual | Read-only calendar | Natural language, templates, proposals — subscription backlash ongoing |
| **Things 3** | One-time | $49.99 iPhone + $49.99 Mac + $19.99 iPad | None — pay once | Nothing; cult-loved for it |

**Subscription vs lifetime (RevenueCat State of Subscription Apps 2025):** Subscriptions produce 45.4% of app revenue from only 4% of apps. But 35% of apps now hybrid (sub + consumables/lifetime). Family plans increase retention by **52%**. Trial length sweet spot: 17–32 days → 45.7% conversion. The Fantastical → subscription move is still cited in reviews 5 years later as a reason to leave; Things 3 users brag about never paying again.

**Consumer utility pricing cluster:** $2.99–$9.99/mo, with **$4.99/mo** the repeat sweet spot. Users benchmark against Netflix/Spotify. $12.99+/mo hits "nearly fifteen quid" resistance. Annual $29.99–$39.99 converts best.

**Ads in family/kids media:** Structurally hostile to warm-cinematic brands. PBS Kids, Minno stay ad-free as a *positioning moat*. 75% of parents cite ad exposure as a streaming concern. Every "family app with ads" review thread complains about tone-break. **Ads would poison Couch's "warm restraint" brand. Don't.**

**Tip jar / donation:** Works for open-source tools (Pi-hole, Standard Notes), creator platforms (Buy Me a Coffee), and single-dev indie apps with a personality attached. Consensus from RevenueCat: unreliable as a *sole* model; fine as a complement. Couch doesn't have enough dev-brand visibility for tip jar to float the lights.

## Anti-patterns to avoid

1. **Paywalling a feature users already have free** (Cozi Gold quietly moved "month view" behind paywall — review rage is permanent). Couch's existing Tonight/voting/queues flow is sacred — **anything shipped free stays free**.
2. **Trial-abuse paywalls** (7-day trials → binge → cancel). Better: let the free tier be genuinely useful forever.
3. **Hostile upsell modals** mid-ritual. The entire point of Couch is compressing a 20-min argument to 30 sec; a paywall interstitial *is* the argument.
4. **Opaque pricing / hidden cancel.** Standard dark pattern; kills trust in a family-invite product where one angry member uninstalls for everyone.
5. **Subscription switch after launching free** (Fantastical). If Couch commits to free forever for core, honor it loudly.
6. **Per-seat pricing for a family.** Couch's unit is the family, not the user. Charging per member is a mis-read of the product.

## Recommended model: "Couch Plus" — single-family subscription + lifetime option

**Structure:** Hybrid sub+lifetime, family-scoped, generous free tier.

- **Free forever:** every feature currently shipped + Phase 4 veto + Phase 5 watchparty basic (2 devices) + Phase 6 year-in-review. Core ritual is never paywalled.
- **Couch Plus ($4.99/mo or $39/yr or $99 lifetime), one purchase covers the whole family** (whoever admins the family code pays; all members get Plus).
- **No ads, ever.** This becomes brand positioning, not absence — say it on the landing page.
- **Optional tip jar** inside settings ("Buy the devs a coffee") — secondary, not load-bearing.

**Why this shape:**
- Family-scope billing mirrors Couch's data model (families are the primary entity in Firestore). Per-seat would require re-architecting and feel wrong to users.
- Lifetime at ~20x monthly captures the Things-3 crowd who loathe subscriptions — and gives early adopters a trust gesture. Keep it available at least through year 1.
- $4.99/mo sits in the documented sweet spot and frames below Netflix mental anchor. $39/yr matches Cozi Gold exactly (proven family willingness to pay).
- Honors the "restraint" brand principle: one price, one tier, no Silver/Gold/Platinum ladder.

## Paid-tier feature list (proposed, Plus-only, none exist yet)

Chosen so free-tier ritual stays whole; Plus is *more*, never *unlocking*.

| Feature | Why it fits Plus, not free |
|---|---|
| **Unlimited watchparty devices + reactions history** | Free = 2 devices synced. Plus = whole extended family + persistent reaction timeline. |
| **Trakt two-way sync** (write scrobbles back) | Free = read-only import (already shipped). Write is power-user. |
| **Custom mood tags + per-family mood dictionary** | Free users get the built-in mood set. Power-families create their own vocabulary. |
| **Extended year-in-review** (multi-year trends, export poster/PDF) | Free = current year recap. Plus = archive + shareable. |
| **Priority provider refresh + advanced filters** (bitrate, dub/sub, director) | Cost-aligns with TMDB API budget. |
| **Family-code rotation / admin controls / audit log** | Appeals to larger blended-family setups. |
| **Multiple families per account** (grandparents with 2 kid-households) | Real ask from blended families; natural Plus-tier. |
| **Supporter badge + "founding family" cosmetic** | Cheap, warm, on-brand. |

Rule of thumb: if removing the feature from a *current* free user would make them angry, it cannot be Plus. Only *new* capability goes behind Plus.

## Pricing recommendation

- **$4.99/mo** (monthly, easy escape)
- **$39/yr** (35% discount — matches Cozi)
- **$99 one-time lifetime** (first 12 months only as founding-family offer; reevaluate)
- **14-day free trial** on annual (short enough to avoid binge-cancel, matches trial benchmarks)
- **No weekly plan** (predatory-adjacent, off-brand)
- Apple Family Sharing: enable on iOS (Apple allows up to 6 family members to share a single subscription at no extra charge — aligns perfectly with Couch's family-scope)

## Revenue sketch

Assumptions: family-scope pricing, 50/50 annual/monthly split on subs, ~15% of Plus buyers take lifetime in year 1 then tapers, blended ARPU ≈ $38/yr for subscribers. Conversion to Plus modeled at **5% (conservative)** / **8% (base)** / **12% (optimistic)** — RevenueCat median consumer conversion is 3–7%; family apps with clear value trend higher.

| Households | Free:Plus @ 5% | Plus households | Blended ARR @ $38 | 8% base case ARR | 12% optimistic |
|---:|---:|---:|---:|---:|---:|
| 1,000 | 950 / 50 | 50 | **~$1.9K** | ~$3.0K | ~$4.6K |
| 10,000 | 9,500 / 500 | 500 | **~$19K** | ~$30K | ~$46K |
| 100,000 | 95,000 / 5,000 | 5,000 | **~$190K** | ~$304K | ~$456K |

**Read:** Couch needs ~10K households just to cover a meaningful side-income; ~100K households to fund a small team. Lifetime purchases front-load cash (good for funding Phase 5 watchparty infra) but don't recur. Real leverage is invite-driven household growth — the product is already architected for it (family codes). **Monetization is not the bottleneck; distribution is.** Consider this an 18–24 month runway question, not a launch question.

## Sources

- [RevenueCat — State of Subscription Apps 2025](https://www.revenuecat.com/state-of-subscription-apps-2025/)
- [Adapty — State of In-App Subscriptions 2025](https://adapty.io/blog/state-of-in-app-subscriptions-2025-in-10-minutes/)
- [Adapty — Utility app subscription benchmarks 2026](https://adapty.io/blog/utilities-app-subscription-benchmarks/)
- [Cozi Gold features & pricing](https://www.cozi.com/cozi-gold/)
- [Life360 plans & pricing](https://www.life360.com/plans-pricing)
- [Picniic Family Organizer](https://www.picniic.com/)
- [OurHome app](http://ourhomeapp.com/)
- [Daring Fireball — Fantastical 3's Move to Subscription](https://daringfireball.net/linked/2020/02/04/fantastical-3-app-store)
- [Flexibits Premium pricing](https://flexibits.com/pricing)
- [RevenueCat — Lifetime subscriptions guide](https://www.revenuecat.com/blog/growth/lifetime-subscriptions/)
- [RevenueCat — How to monetize without ads](https://www.revenuecat.com/blog/engineering/how-to-monetize-your-app-without-ads/)
- [RevenueCat — How top apps approach paywalls](https://www.revenuecat.com/blog/growth/how-top-apps-approach-paywalls/)
- [RevenueCat — Apple Family Sharing for in-app subscriptions](https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-family-sharing)
- [Apple — Family Sharing](https://www.apple.com/family-sharing/)
- [Apphud — High-converting paywall design](https://apphud.com/blog/design-high-converting-subscription-app-paywalls)
- [Funnelfox — Top 5 subscription cancellation reasons](https://blog.funnelfox.com/fix-subscription-cancellation-reasons/)
- [Consumer subscription apps pricing benchmark (memohub)](https://blog.memohub.io/consumer-subscription-apps-pricing-benchmark/)
