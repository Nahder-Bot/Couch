# 01 — Direct Competitors

**Researched:** 2026-04-21
**Scope:** Apps that exist to coordinate watching together (sync playback, co-viewing, group decision-making).
**Confidence:** MEDIUM-HIGH. Sources below; a few specific data points marked "not found."

---

## Competitor Matrix

| Competitor | Model | Does Well | Misses | Monetization | User Sentiment |
|---|---|---|---|---|---|
| **Teleparty** (ex-Netflix Party) | Chrome extension; syncs playback + text chat on Netflix/Disney+/Max/Hulu/Prime + 20 more on Premium | Ubiquity (20M+ users claimed), works across biggest catalogs, zero-friction if you're on desktop Chrome | No real iOS hosting, chat detaches from video in Premium, no voting/pre-watch decisioning, no family modes | Freemium: $3.99/mo annual or $6.59/mo monthly; Premium unlocks iOS, video chat, reactions, 23 extra services | Chrome store 3.7/5 and falling; heavy complaints re billing/refunds, Disney+ breakage, mobile sync, "privacy" pop-ups. Reputation is eroding. |
| **Plex Watch Together** | Native-app feature on top of personal Plex library | Works for self-hosted libraries (the Plex superuser niche); deep integration with your own media | Being sunset on most platforms as of the "New Plex Experience" — web-only going forward; only useful if you already run a Plex server | Bundled with Plex Pass ($4.99/mo or $119.99 lifetime) | Lifetime-pass owners feel betrayed; forum threads full of "scammed" / "please don't remove" posts. Small but loyal audience. |
| **Kast** (ex-Rabbit successor) | Cross-platform rooms with screen-share + audio/video overlay; desktop + iOS/Android | Rabbit-style video overlay during stream, big rooms (100+), no library restriction because it's screen-share | Screen-share is brittle; recent update pay-walled the previously-free screen share; DRM'd content often black-screens | Freemium with ads; paid membership now required for desktop screen-share; iOS has IAP; exact 2026 price not found | Overwhelmingly negative on Trustpilot/justuseapp: "works 10% of the time," constant crashes, unauthorized billing complaints. Community sees Kast as having "killed Rabbit to absorb its users." |
| **Scener** | Chrome extension + watch-party site for Netflix/Disney+/HBO Max/etc.; livestream host w/ video overlay | "Virtual movie theater" aesthetic (closest vibe neighbor to Couch's "cinematic · lived-in"); livestream-host rooms are a unique twist | Still extension-bound → desktop-only hosting; no decisioning layer; marketing/product activity looks thin (blog infrequent, docs vague) | Freemium; Premium tier exists but pricing not exposed on landing — **not found** | Appears operational in 2026 (contrary to rumor of 2024 shutdown — **no evidence of shutdown found**; Variety 2020 funding round $2.1M is last notable press). Feels like a zombie-live product: running but quiet. |
| **Amazon Prime Video Watch Party** | Platform-bundled sync feature | Was zero-install for Prime members | **DEAD.** Amazon silently removed it April 2024. Twitch Watch Parties also killed 2024. | N/A | Post-mortem consensus: low usage + high maintenance, text-only chat, no voice/video, limited catalog. Users only "noticed when it was gone." |
| **Discord Watch Together / screen-share in VC** | Informal: voice channel + screen-share, or the built-in "Watch Together" activity (YouTube only) | Already where friend-groups live; zero onboarding; voice+chat+presence is free and excellent | YouTube-only for native Watch Together; 180-min cap in groups, 30-min solo; screen-share-the-Netflix-tab is against Netflix ToS and has audio/DRM issues; no decisioning, no catalog, no family mode | Free; Nitro ($9.99/mo) for 1080p/4k screen-share | De facto winner for Gen-Z/gamer friend-groups. No one "loves" it for movies but everyone uses it because it's already open. |

---

## Common Failure Patterns Across the Field

1. **Extension/screen-share fragility.** Every one of Teleparty/Kast/Scener/Discord fights the streamer's DRM. Sync breaks, black frames, audio drops. This is the #1 complaint vector.
2. **Platform-bundled features keep dying.** Amazon (2024), Twitch (2024), Disney+ GroupWatch (deprecated), Sling (2024), Plex (2025 sunset). Co-viewing is perennially "launched and unloved" when it's a side feature of a streamer.
3. **Nobody solves the *decision*.** Every competitor starts *after* the group has picked something. Movie Night Polls and PickAMovieForMe exist but aren't co-viewing tools. **This is Couch's opening.**
4. **Billing trust is low.** Teleparty and Kast both have Trustpilot reputations wrecked by refund/cancel horror stories. Monetization can poison the brand faster than churn.
5. **Mobile-first hosting is rare.** Teleparty iOS is paid-only and flaky; Plex is desktop-leaning; Kast mobile is unstable. A PWA-first mobile-hosting experience is genuinely under-served.

---

## What Couch Should Steal

- **Scener's "cinematic" framing** — the closest vibe match to "Warm · Cinematic · Lived-in." Couch can out-execute a zombie product here.
- **Teleparty's cross-service reach as aspiration** — but via TMDB-metadata + deep-links rather than playback-sync, sidestepping the DRM mess.
- **Discord's "already where the group is" insight** — lean into web-push + SMS-style intent polls ("Tonight @ 8?") so Couch shows up *in* existing group chats, not in competition with them.
- **Rabbit/Kast reaction overlays** — Couch's watchparty reactions are directionally right; keep them lightweight.

## What Couch Should Avoid

- **Extension/DRM sync wars.** Don't try to be Teleparty-v2. Couch's moat is decisioning + presence, not frame-accurate playback sync.
- **Pay-walling the core loop.** Teleparty Premium pulled chat *out of* fullscreen and became the #1 complaint. Keep the core "decide + start tonight" flow free forever.
- **Dark-pattern billing.** Teleparty/Kast reputations show how fast trust dies. One-click cancel, clear refunds.
- **Platform-bundling dependency.** Amazon/Plex/Twitch co-view graveyards prove that if Couch depends on a single streamer's goodwill, it's a dead man walking. Stay TMDB-first + streaming-agnostic.
- **"Virtual theater" livestream-host mode.** Scener and Kast both tried it; both are now quiet. Too complex for a family deciding Tuesday night.

---

## Sources

- [Teleparty landing / pricing](https://www.teleparty.com/)
- [Teleparty on Chrome Web Store (3.7/5)](https://chromewebstore.google.com/detail/netflix-party-is-now-tele/oocalimimngaihdkbihfgmpkcpnmlaoa)
- [Teleparty Trustpilot (billing/refund complaints)](https://www.trustpilot.com/review/teleparty.com)
- [Movpilot Teleparty review 2025](https://movpilot.com/blog/teleparty-review/)
- [Plex Watch Together sunset thread](https://forums.plex.tv/t/watch-together-going-away-in-app/906895/266)
- [Plex: Please do NOT remove Watch Together](https://forums.plex.tv/t/please-do-not-remove-watch-together/906929)
- [Plex Watch Together support doc](https://support.plex.tv/articles/watch-together/)
- [Kast on App Store](https://apps.apple.com/us/app/kast-watch-together/id1467026423)
- [Kast Trustpilot (negative)](https://www.trustpilot.com/review/kast.gg)
- [Kast on justuseapp](https://justuseapp.com/en/app/1467026423/kast-watch-together/reviews)
- [Scener landing](https://www.scener.com/)
- [Scener FAQ](https://www.scener.com/faq)
- [Variety 2020 — Scener $2.1M raise](https://variety.com/2020/digital/news/scener-watch-party-disney-plus-hbo-max-netflix-1234787891/)
- [Amazon quietly killed Prime Video Watch Party — Android Authority](https://www.androidauthority.com/amazon-prime-viewing-party-axed-3458167/)
- [Amazon discontinued Prime Video Watch Party — TechTimes (Jul 2024)](https://www.techtimes.com/articles/306472/20240708/amazon-discontinued-prime-video-watch-party-feature-users-noticed.htm)
- [Twitch ending Amazon Watch Parties — Streams Charts](https://streamscharts.com/news/twitch-shut-down-amazon-prime-video-watch-parties)
- [How-To Geek: You can't use Watch Party in Prime Video anymore](https://www.howtogeek.com/prime-video-watch-party-shutdown/)
- [Discord Watch Together FAQ](https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ)
- [Discord Activities announcement](https://discord.com/blog/server-activities-games-voice-watch-together)
- [Movie Night Polls (adjacent — decisioning-only tool)](https://www.movienightpolls.com/)

---

## Data Gaps (not found)

- Scener 2026 Premium pricing (navigation link exists, price not surfaced on landing).
- Kast 2026 current membership price (evidence of paywall change, no numeric confirmation).
- Confirmation or denial of "Scener shutdown 2024" referenced in the research brief — **no shutdown evidence found**; company appears operational but low-signal. Worth a direct check of Scener X/Twitter and blog cadence before citing as dead.
- Teleparty active-user numbers past the "20M+" self-claim; no third-party MAU telemetry surfaced.
