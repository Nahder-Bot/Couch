# Adjacent Tools Research — Couch

**Researched:** 2026-04-21
**Scope:** Discovery/tracking apps adjacent to Couch (not direct watch-together competitors)
**Confidence:** MEDIUM (WebSearch-based; verified across multiple sources)

## Per-App Summary

| App | Core Loop | Per-User vs Shared State | Killer UX | Relevance to Couch |
|-----|-----------|--------------------------|-----------|---------------------|
| **Letterboxd** | Log → rate → review → list → follow | Pure per-user diary; lists are personal but publicly shareable. Friends "filter watchlists together" to intersect what-to-watch [1] | Watchlist intersection with friends; 4-star personal diary; curated lists as identity | HIGH — intersection pattern maps directly onto Couch group polls; lists as a warm keepsake fit "lived-in" tone |
| **JustWatch** | Search → filter by your services → watchlist → notify | Single per-user watchlist, availability-aware; "seen" filter is Pro-only [2] | Timeline of new releases per provider; notify when title lands on your service; price-drop alerts for rent/buy | HIGH — availability-driven notifications ("now on Netflix") are missing from Couch |
| **Reelgood** | Unified catalog → queue → next-up | Per-user viewing-progress tracker; **Search Party** swipe-match layer creates shared state [3] | "Search Party" Tinder-swipe matching → "matches" tab for group decisions; 150+ services | HIGH — Couch already does voting, but swipe-match is a lighter-weight entry for indecisive groups |
| **TV Time** | Mark episode watched → react → badge → notify | Strong per-user state (scrobble-like); shared layer is spoiler-gated community reactions [4] | Push 1 hour before airtime; spoiler-walled episode reactions; character voting; emoji-emotion ratings | MEDIUM — emotion ratings (not stars) and spoiler-gated discussion fit families; airtime pushes less relevant |
| **Trakt** | Scrobble everywhere → sync → analyze | Rigorously per-user; open ecosystem — data flows into dozens of apps [5] | Universal scrobbler (Netflix/Prime/Hulu/AppleTV+ via VIP); custom lists; "Most Watched" aggregation | HIGH — Couch already integrates Trakt auth; lean harder on Trakt as the per-user "seen" source-of-truth |
| **Plex Discover** | Cross-service search → universal watchlist → deep-link out | Per-user watchlist unified across services; **Discover Together** adds friend activity feed + shared ratings [6] | Deep-link into the right streaming app on the right device; friends' real-time activity feed | MEDIUM — deep-link-out is a PWA win; friend activity feed risks clashing with Couch's warmer tone |
| **Goodreads-for-movies attempts** | — | — | GetGlue/TVtag (check-ins + stickers) peaked then collapsed post-pivot in 2014 [7]. Letterboxd effectively won this slot by being diary-first, not check-in-first | Warning: check-in mechanics alone aren't sticky. Diary + lists + social graph is what stuck |

## Answers to the Four Specific Questions

**1. Watchlist-curation patterns users love.** Letterboxd's *named, curated lists* (not one flat watchlist) are the defining pattern [1]. Users build identity through "10 comfort films for a rainy Sunday," "heist night," "Dad will actually watch these." JustWatch's *filter-by-your-services* watchlist removes friction [2]. Reelgood's *swipe-to-match* is the social variant [3].

**2. Per-user "seen" vs shared state.** Dominant pattern: per-user state is authoritative and private; shared state is *derived* (intersections, matches, activity feeds). Trakt is the purest — per-user scrobble, then apps derive group views from it [5]. Plex Discover Together exposes ratings+activity but never overrides your private list [6]. **Implication for Couch:** keep per-user "seen" strictly private; compute group suggestions as the intersection of *un-seen-by-anyone*.

**3. Mood patterns that beat genre tags.** Tag-based moods (Couch's current approach) are losing to *natural-language + context* prompting. ReelWise and PickAMovieForMe both frame as "in the mood for ___, with ___, in ___ minutes" — mood + companion + runtime as one query [8]. FlixyAI/MovieUncover use free-text NLP against a tagged catalog. Hand-curated mood lists (like Letterboxd's) consistently outperform algorithmic mood matching for trust.

**4. Cold-start handling.** Three patterns: (a) **Trakt import** — offer immediate history sync on signup [5]; (b) **Curated editorial lists** — Letterboxd surfaces staff/community lists so empty profiles feel inhabited [1]; (c) **Availability as content** — JustWatch's "new this week on *your* services" turns a zero-state into a browsable feed [2]. Couch should do all three.

## Features Couch Should Steal — Ranked by Effort/Value

| Rank | Feature | Source | Effort | Value | Fits "warm cinematic"? |
|------|---------|--------|--------|-------|------------------------|
| 1 | **Watchlist intersection** ("what we all still want to watch") | Letterboxd [1] | Low (Couch has votes already) | Very high | Yes — it's the core promise |
| 2 | **Trakt-history import on signup** to kill cold-start | Trakt [5] | Low (auth exists) | Very high | Yes — "lived-in" from day one |
| 3 | **Availability notifications** ("The Bear just hit Hulu for Sam") | JustWatch [2] | Medium (needs availability provider) | High | Yes — opt-in, low-frequency |
| 4 | **Named curated lists** ("Friday-night comforts," "Kids can't handle this yet") beyond one flat watchlist | Letterboxd [1] | Medium | High | Yes — lists as keepsakes |
| 5 | **Swipe-to-match mini-flow** for low-energy nights, feeds into existing vote | Reelgood Search Party [3] | Medium | Medium-high | Yes if styled as "couch mode" |
| 6 | **Natural-language mood prompt** alongside tag chips | ReelWise/FlixyAI [8] | Medium (LLM call or tag-mapper) | Medium | Yes — feels conversational |
| 7 | **Spoiler-gated reactions** after everyone's marked watched | TV Time [4] | Medium | Medium | Yes — family memory layer |
| 8 | **Deep-link-out to correct streaming app** per household member's services | Plex Discover [6] | High (provider-by-provider) | High | Yes — invisible polish |
| 9 | **Friend/household activity feed** with opt-in granularity | Plex Discover Together [6] | High | Medium | Risky — could feel surveillance-y; make per-household only |
| 10 | **Emotion ratings** instead of stars (cozy/thrilling/cried/everyone-loved) | TV Time [4] | Low | Medium | Very — nails the tone |

## Sources

1. [Letterboxd — Social film discovery](https://letterboxd.com/) · [Welcome to Letterboxd](https://letterboxd.com/welcome/) · [Apartment Therapy: Letterboxd is Goodreads for movies](https://www.apartmenttherapy.com/what-is-letterboxd-37358786)
2. [JustWatch — The Streaming Guide](https://www.justwatch.com) · [Cloudwards: How to Use JustWatch in 2026](https://www.cloudwards.net/how-to-use-justwatch/)
3. [Cloudwards: How to Use Reelgood in 2026](https://www.cloudwards.net/how-to-use-reelgood/) · [Reelgood FAQ](https://reelgood.com/faq)
4. [TV Time](https://www.tvtime.com/) · [TV Time — Wikipedia](https://en.wikipedia.org/wiki/TV_Time) · [TechCrunch on TV Time binge-finder](https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge/)
5. [Trakt.tv](https://trakt.tv/) · [Trakt Streaming Scrobbler announcement](https://www.prnewswire.com/news-releases/trakt-partners-with-younify-to-launch-its-streaming-scrobbler-302324174.html) · [Moviebase: Trakt integration guide](https://moviebase.app/resources/trakt-integration-guide)
6. [Plex Discover](https://www.plex.tv/discover/) · [TechCrunch: Plex Discover Together](https://techcrunch.com/2022/08/10/plex-introduces-a-social-experience-to-its-streaming-app-with-launch-of-discover-together/) · [Plex 2026 Roadmap](https://pcxio.com/what-changes-are-coming-to-plex-ultimate-2026-roadmap-guide/)
7. [tvtag — Wikipedia](https://en.wikipedia.org/wiki/Tvtag) · [Gigaom: GetGlue successor TVtag shutting down](https://gigaom.com/2014/12/19/getglue-successor-tvtag-is-shutting-down/)
8. [ReelWise](https://www.reelwise.app/) · [PickAMovieForMe](https://pickamovieforme.com/) · [MovieUncover](https://aianytool.com/Tool/movieuncover)
