# Phase 11 Research — Feature refresh & streamline

**Research date:** 2026-04-23
**Method:** 3 parallel subagents (competitive landscape / watchparty & scheduling lifecycle / sports-specific UX) + local Couch codebase audit
**Total research time:** ~13 min wall-clock, ~450k tokens across agents
**Output:** This synthesis feeds `11-CONTEXT.md` (proposed GSD phase scope)

---

## 1. Executive summary

Couch's competitive whitespace is **bigger than assumed**. Every adjacent product in the space treats "deciding what to watch" as a minor feature bolted onto a bigger product — Reelgood owns availability, Letterboxd owns social tracking, Teleparty owns sync playback. **Nobody owns the group-decision ritual.** Couch's two-path (vote-together + nominate-a-pick) + veto re-spin + spinner-from-Yes-pool + time-and-RSVP-baked-in is a distinctive product posture with real moat potential.

Three research threads distilled:

- **Competitive (A):** adopt SMS invites, themed "ready-to-run" ballot packs (Fable model), shareable list URLs that unfurl in iMessage; avoid Tinder-swipe-everything, algorithmic opacity, heavy onboarding taxes.
- **Watchparty + scheduling (D):** Partiful-style asymmetric RSVP nurture (Maybes get *more* reminders than Yes's, not fewer), proper pre-session lobby, post-session loop (rate + photo album + one-tap "schedule next") that converts one party into recurring rituals, and Couch's per-user reaction-delay is a genuinely unique feature to defend.
- **Sports (mode-specific):** build a dedicated Game Mode distinct from movie-party; don't distribute the stream (Playback.tv just died on rights complexity, Amazon/Disney/Sling killed their party modes, Twitch banned sports co-streaming April 2024) — own the social layer, users BYO stream.

Couch's per-user reaction-delay is the single most defensible differentiator. No competitor has it. It's also *incompatible* with voice chat — which reinforces the decision to defer voice indefinitely.

---

## 2. Competitive landscape

### Market map — 5 roles, nobody owning group decisions

| Role | Who plays it | Gap |
|---|---|---|
| Pure discovery / availability | Reelgood, JustWatch | Group decision is bolt-on or absent |
| Social cinema tracking | Letterboxd, Serializd, Trakt | Zero decision ritual |
| Recommendation engines | Watchworthy, Likewise | Algorithmic consensus, no ritual |
| Sync playback | Teleparty, Scener, Discord Watch Together | Assumes already decided |
| Group-decision attempts | Reelgood Search Party, Stream Vote, Movie Night Polls | Tiny catalogs, no brand warmth, no event semantics |

### Per-competitor intelligence

| App | Group-decision? | Killer UX | Fatal flaw |
|---|---|---|---|
| **Reelgood** | Search Party (mutual swipe-match) | Real-time swipe across streamers | Buggy, sparse, signup friction |
| **JustWatch** | No | Best availability data globally | Utility-only, no social |
| **Watchworthy** | "Group Worthy Suggestions" (algorithmic) | Cancel/keep advisor | TV-only, algo-over-ritual |
| **Fable** | Host-picks (not voted) | Ready-Picks themed clubs + Spotify integration | Host is a dictator; no member voting |
| **Letterboxd** | No | Diary, reviews, cultural weight | Groupthink, performativity |
| **Serializd** | No | Episode-level granularity | Feature-thin |
| **Plex Discover Together** | Partial (shared watchlists) | RSS watchlist sharing | Killed its own Watch Together Feb 2025 |
| **Trakt** | Collaborative lists (Jan 2025) | Best history data | Dated UX |
| **Likewise** | Group taste threads | "Pix" AI companion | Scope-sprawl, low traction |
| **Teleparty** | No | Cross-streamer Chrome extension | "Buggy" is #1 review word |
| **Scener** | No | Webcam grid reactions | Paywalled voice |
| **Stream Vote / Movie Night / Movie Night Polls** | The whole product | Swipe-match, shareable polls | Tiny catalog, no taste memory |

### Patterns Couch should ADOPT

1. **Reelgood match-moment** — when everyone independently lands on same Yes, surface a match celebration. Couch's spinner reveal can absorb this emotional beat.
2. **Fable Ready-Picks + themed packs** — ship "Couch Nights" themes (Studio Ghibli, Cozy Rainy Sunday, Halloween Crawl) with pre-loaded ballots + optional mood music.
3. **Trakt/Plex shareable list URLs** — links that unfurl beautifully in Messages/iMessage/Discord. No install required to RSVP.
4. **Fable chapter-threaded discussion** (adapted to episode-threaded) — lock watchparty discussion to "through ep X" default.
5. **Serializd badges tied to rituals, not volume** — badge the act of voting together, not movie count. Reinforces group-first identity.

### Patterns Couch should AVOID

1. **Tinder-swipe as core UX** (Stream Vote, Movie Night, Reelgood Search Party) — swipe fatigue + transactional frame clashes with warm-cinematic voice. Yes/Maybe/No on ballot cards is the correct primitive.
2. **Algorithmic "Group Worthy Suggestions"** (Watchworthy) — opaque score replaces the ritual. The decision IS the fun.
3. **Feed-scroll social-media posture** (Likewise, Letterboxd home) — infinite scroll + public review performance clashes with "living room" intimacy.
4. **Heavy setup taxes** (Plex, Trakt) — requiring onboarding before first vote kills the hosting moment. First-vote in &lt;60s.

### Couch's unmet differentiation (not shipped by anyone)

1. **Two-path entry** — vote-together AND nominate-a-pick. Every competitor picks one lane.
2. **Veto re-spin ritual** — models the renegotiation beat after a pick. Novel.
3. **Spinner from a Yes-pool** — randomized fairness. Nowhere in the landscape.
4. **Time + RSVP semantics baked in** — nominate-a-pick = scheduling event, not just vote. Teleparty/Scener assume you've already scheduled externally.
5. **Warm-cinematic brand in a utility-dominant category** — Reelgood, JustWatch, Trakt all feel like spreadsheets. Fraunces + #14110f is distinctive positioning.

### Whitespace (nobody ships this)

- Rolling "couch calendar" — recurring Sunday nights with auto-generated ballots from unseen overlap.
- Availability-aware ballot filtering — dim titles nobody in the group can stream.
- Kid-mode ballots with rating caps + parental final-say.
- Post-watch reaction capture feeding future ballot weight (closes the Letterboxd loop).
- Async-first nominate flow — collect RSVPs over hours, not minutes.
- Availability-aware invitations — "who's free Sat 9pm?" poll fused with ballot.
- Spoiler-safe group chat — auto-locks to pre-watch until press-play.

---

## 3. Watchparty + scheduling lifecycle

### The gold-standard 5-step flow (Partiful + Apple Invites)

1. **Nominate** — title + cover + tap-to-set time. Partiful: ~30s. Apple adds cover animation upfront.
2. **Invite** — **SMS link, not email**. Partiful claims ~98% open vs Evite's 20-30% email. Frictionless: tap link → RSVP with phone, no account.
3. **RSVP** — Yes/Maybe/No + optional +1. Live guest list = social proof.
4. **Remind** — asymmetric cadence by RSVP state (see below).
5. **Start** — one-tap "Join" CTA dominant hour-of.

### RSVP psychology — the Maybe problem

Removing Maybe pushes honest "probably" into dishonest Yes (inflates no-show) or dishonest No (suppresses attendance). Keep Yes/Maybe/No with **text labels** ("Going / Maybe / Can't") + emoji accents, not emoji-only.

Top tools treat Maybe as a **distinct nurture track** — more reminders, not fewer:

| RSVP state | Touches | Triggers |
|---|---|---|
| Going | 2 | T-24h (logistics), T-1h ("starting soon") |
| Maybe | 3 | T-7d, T-24h (nudge to Yes), T-1h (direct join link) |
| Not responded | 2 | T-48h (host-prompted blast), T-4h (last call) |
| No | 0 | silence — respect the No |

Key: reminders must be **useful, quick, expected**. Over-notifying = #1 opt-out cause. Give hosts a manual "text blast unresponsive" button rather than more auto-nags.

### Live session UX deep-dive

**Pre-session lobby (5-15 min before start):** who's here/en-route, chat live, countdown, "press play when everyone's ready" host control. Couch's participant timer strip is already close — elevate into proper lobby.

**Reaction fidelity hierarchy:**
- Emoji bubbles (lowest friction, best for silent co-watch) ← Couch today
- Stickers/GIFs (richer, noisier, can spoil)
- Voice chat (highest presence, breaks silent mode, must be opt-in)
- Video tiles (highest bandwidth, small groups only ≤6)

Couch should stay **emoji + optional text chat drawer**. Voice = v2 togglable mode.

**Spoiler handling — Couch's moat.** Per-user reaction-delay is genuinely unique. Teleparty/SharePlay/Discord have no equivalent. Fall-behind users on those tools see out-of-context reactions and get spoiled. **Keep and market this feature.**

**Pause philosophy:**
- Democratic (SharePlay, Teleparty) — anyone pauses, pauses everyone. Fits friend groups.
- Host-only (Scener, Twitch) — "pass the remote." Fits parent-led nights.

Couch: **democratic by default with host-only toggle**. Families want parent-override; friend groups don't.

**Late-joiner problem. Three strategies:**
- Snap-to-now (SharePlay, Teleparty): jump to group time, miss content.
- Start-from-beginning with drift: sync breaks.
- Self-declare (Couch's "I started on time" override): trust user.

Couch: keep self-declare + add **"Catch me up" button → 30-second recap of reactions that happened** so they're not lost.

**Offline/connection loss:** tolerate ~2s jitter silently, show "reconnecting…" beyond. On reconnect offer "Catch up" or "Stay". Transient drops invisible.

**Post-session loop (Partiful model — highest leverage):** auto-prompt photo upload, host "thank you" text blast, one-tap "schedule next" using same roster. Apple Invites ships post-event collaborative playlist. Conversion collapses if you wait >48h.

### Feature matrix — where Couch sits

| Feature | Teleparty | SharePlay | Discord | Partiful | Couch today | Couch rec |
|---|---|---|---|---|---|---|
| SMS invites | ✗ | iMessage | Server | ✓ | Push only | **Add SMS + web fallback** |
| Yes/Maybe/No | n/a | n/a | Interested | ✓ | ✓ | Keep + add commit microtask |
| Asymmetric nurture | ✗ | ✗ | ✗ | ✓ | Uniform | **Adopt** |
| Pre-session lobby | Minimal | FaceTime | Stage | ✓ | Timer strip | **Upgrade to lobby** |
| Emoji reactions | ✓ | ✓ | ✓ | ✓ | ✓ | Keep |
| **Per-user delay** | ✗ | ✗ | ✗ | n/a | **✓** | **Defend, market** |
| Democratic pause | ✓ | ✓ | Host | n/a | ✓ | Keep + host-toggle |
| Late-joiner recap | Snap | Snap | ✗ | n/a | Self-declare | **Add 30s recap** |
| Shared photo album | ✗ | ✗ | Channel | ✓ | ✗ | **Add** |
| "Schedule next" loop | ✗ | ✗ | Recurring | Duplicate | Manual | **Add one-tap** |
| Cross-platform | Chrome | Apple | All | Web+SMS | PWA | **Lean into PWA** |

### Top 5 features to prioritize

1. **SMS invite links + web-guest RSVP** — unlocks non-member participation. Effort M / Impact H.
2. **Asymmetric RSVP nurture** — fixes Maybe reliability, no new UI. Effort S / Impact H.
3. **Proper pre-session lobby** — "who's ready" + democratic auto-start. Effort M / Impact H.
4. **Post-session loop** — rate + photo + one-tap "schedule next." Partiful's highest-leverage pattern. Effort M / Impact H.
5. **Late-joiner "Catch me up" recap** — defends spoiler protection with context. Effort S / Impact M.

### 3 to NOT build (yet)

1. Voice/video chat tiles — SharePlay/Discord territory, high infra, incompatible with per-user delay.
2. Payments/deposits — breaks family vibe; social commitment via Ready-check gets most benefit.
3. Complex co-host permission trees — Partiful offers them; single-trust model is fine v1.

---

## 4. Sports / Game Mode deep-dive

### The sports watchparty graveyard (do not try to be video distribution)

- **Playback.tv** (the closest purpose-built sports-watch product) — shut down Dec 2025 on rights complexity. Announced March 2026: relaunching as part of ESPN.
- **Twitch Watch Parties** — discontinued April 2024. Sports co-streaming always prohibited.
- **Amazon Prime Watch Party / Disney+ GroupWatch / Sling Watch Party** — killed 2023-2024.
- **Generic sync tools** (Teleparty, Scener, Kast, Metastream, Rave, WEVER) — movie-first, sync drift.

**Lesson:** don't distribute the stream. Users BYO stream. Own the social layer.

### Where people actually watch remote sports today

| Venue | Scale | Pattern |
|---|---|---|
| Discord sports servers | Official NFL Discord 60k+ | Gameday channels, voice, picks competitions |
| r/nfl game threads | 3.7M members | Minute-by-minute text commentary, new comment every few seconds |
| iMessage/WhatsApp group texts | Universal | 4-8 friend groups = the actual incumbent |
| Fanatics Live | Adjacent | Live card-break streams with chat |
| Social sportsbooks (WagerLab, Pikkit) | Niche | Friend-group pools on props |

### What sports-watchers need that movie-watchers don't

Ranked by importance:

1. **Live score/clock in room chrome** — always-visible. Non-negotiable.
2. **Zero-spoiler latency alignment** — biggest complaint across every platform: friend on DirecTV sees TD 30s before friend on streaming. If your reaction widget fires before their video does, the product is broken.
3. **Late-joiner catch-up card** — "current score + last 3 plays". ESPN's "Catch Up To Live" is the pattern.
4. **Hard-start countdown + auto-room-open at kickoff** — movies negotiate start; sports have one.
5. **Play-scoped reactions** — reactions expire ~30s, not attached to 2hr arc. "GOAL/TD" needs amplified UI (burst, optional sound).
6. **Team allegiance expression** — badges, color auras, flair. Rival-fan banter is the point.
7. **Micro-predictions / pick'em layer** — "who scores next?", "O/U on next drive." Casual, free (no real money = no licensing), drives retention.
8. **Pre-game lobby with build-up** — 15-60min window for memes, trash talk, lineups, weather. Movie lobbies are seconds; sports are long.
9. **Post-game debrief mode** — room stays open for reactions, MVPs, highlights. Movies close the room.
10. **Pinned officiating-controversy thread** — every game has 1-3 "was that a catch?" moments.
11. **Voice/push-to-talk** — text lags fast breaks. Voice is how Discord wins.
12. **Mute-spoilers toggle for delayed watchers** — DVR mode per user.

### Movie-vs-sports lifecycle divergence

| Phase | Movie flow | Sports flow |
|---|---|---|
| Invite | "What should we watch?" browsing | "Game's on at 4:25 ET" — title fixed |
| Lobby | &lt;5 min | 15-60 min pre-game |
| Start | Host press-play | Kickoff at broadcaster time — no host control |
| Pause | Supported | Impossible |
| Reactions | Even across 2hr arc | Bursty — 80% clustered in 6-10 key plays |
| Late joiner | Rewind or wait | Score + last-3-plays card |
| Ads/breaks | None | ~18 min goldmine for secondary content |
| Climax | One | Possibly OT, walk-off, buzzer-beater |
| End | Credits, room closes | Final whistle → **post-game debrief** |
| Follow-up | Rarely | Next game, playoff bracket, fantasy settlement |

### Minimum v1 Game Mode (6 features)

1. **Game picker** — ESPN hidden API (`site.api.espn.com/.../scoreboard`) — pick NFL/NBA/MLB/NHL game, room auto-titled with teams + kickoff.
2. **Live score strip** — always visible in room chrome, polled every 15-30s.
3. **Kickoff countdown + pre-game lobby** auto-transitioning to "Live" at start time.
4. **Play-scoped reactions** — amplified burst UI for score events detected via score-delta polling.
5. **Late-joiner recap card** — last 3 plays from ESPN play-by-play, auto-shown on entry.
6. **Team-flair badges** — pick team at room entry, avatar gets team color border.

Stretch v1.1: free pick'em, voice rooms, post-game debrief mode.

### Tech stack recommendation

| Need | Recommendation |
|---|---|
| Metadata/scores API | **BALLDONTLIE primary** (free tier, NBA/NFL/MLB/NHL/EPL/WNBA) + **ESPN hidden endpoints** fallback, abstracted behind `SportsDataProvider` interface |
| Polling cadence | 15s off-play, 5s during active play |
| Kickoff timezone sync | API returns ISO-8601 UTC; render per-user `Intl.DateTimeFormat` with browser tz |
| Broadcast latency | Don't try to sync video (don't own it). Per-user "I'm N seconds behind" slider offsets their reaction visibility |
| Score-delta detection | Diff consecutive polls; on home/away score change, emit `SCORING_PLAY` event with last play-by-play entry |

### Anti-patterns (do not do)

- Distribute the video stream → Playback died on rights; Twitch banned it
- Assume everyone is synced → #1 killer bug
- Movie-style reactions for sports → fails 80/20 bursty pattern
- Force real-money betting → state-by-state regulated, KYC friction = churn
- Close room at final whistle → 30-40% of engagement is post-game debrief (Discord gameday channels prove this)
- Hide score for spoiler users globally → default visible, opt-in "DVR mode" per user
- Build a feed → ESPN Verts is feed, great for solo, useless for group. Couch's moat is the *room*
- Copy r/nfl wall-of-text → works at 3.7M scale; 6-person room, voice+reactions beat text floods
- Couple tightly to one league's API → Couch needs NFL Sunday, MLB weeknights, NBA evenings, Champions League. Abstract provider from day 1

---

## 5. Local Couch audit — current state snapshot

### Feature inventory (post-Phase 9 deploy, 2026-04-23)

**Tonight tab (`#screen-tonight`):**
- Sync dot (connectivity indicator)
- Claim-prompt banner (Plan 5.8 legacy)
- **Picker card** (app.html:190, css:322) — "Tonight's pick goes to [Name]" — **user flagged: too prominent, hide**
- WP banner tonight (watchparty status)
- Intents strip (Phase 8 nominate-a-pick)
- **Who's on the couch card** (app.html:203, css:1574) — `.who-list` flex-wrap chips — **user flagged: cleaner format wanted**
- Mood filter section with inline mood chips (app.html:221)
- Active moods row
- Tonight's picks (matches-list)
- Continue (in-progress watches)
- Up next
- Activity (last 7 days)

**Queue tab (`#screen-library`):** Vote mode entry, Lists section, Couch list with filter tabs (all/forme/mine/requests/in-progress/top-rated/unwatched/scheduled/watched/recent), services bar, library list.

**Add tab (`#screen-add`):** Search bar, sports entry card, search results, discovery rows:
- **Mood row** (discovery by selected mood)
- **Trending this week** (`.discover-row#add-row-trending`)
- **On your streaming** (filtered to user services)
- **Hidden gems** ("beloved but quieter")

**Family tab (`#screen-family`):** 6 sections
- Tab hero + stat grid
- Approvals card (kids-waiting)
- Members list
- **"Who picks tonight" section** (app.html:412) — **user flagged: hide, part of picker removal**
- Family favorites (shown when 2+ people rated)
- Per-member breakdown (who's watched what)
- Share/invite section

**Account tab (`#screen-settings`):** 9+ sections
- Hero with identity strip
- **Year in Review** card (prominent; currently pre-Phase-10 placeholder)
- Streaming services picker
- Trakt sync (conditional)
- Notifications (conditional)
- Kids & sub-profiles
- Owner-only group admin (password, guest invites, ownership transfer, claim-members, grace banner)
- Keyboard shortcuts (conditional)
- Sign out / leave family footer

### User's 4 direct UX complaints — code mapping

| # | Complaint | Code location | Solve |
|---|---|---|---|
| 1 | Moods have big space between them | `.mood-filter { gap: var(--s2) }` at css/app.css:679; chip padding at `.mood-chip` line 682 | Tighten gap to `var(--s1)` + reduce chip padding + possibly reduce chip font size |
| 2 | Picker feature way too prominent — hide | `.picker-card` at css:322 + app.html:190; `#picker-heading`+`#picker-strip` at app.html:412-422; `#picker-sheet-bg` modal at app.html:577-592 | Add `.picker-ui-hidden` body class; CSS `display:none` on the three surfaces; keep backend spinnership writes intact |
| 3 | Recommendations — more categories + rotation | Current Add screen has 4 rows (mood/trending/streaming/gems) at app.html:327-376 | Expand to ~15 candidate rows with rotating 4-6 visible daily/weekly |
| 4 | "Who's on the couch" — cleaner format | `.who-card` + `.who-list` at css:1574, app.html:203-206 | Explore: horizontal scrolling avatar row, stacked overlapping avatars, or per-person compact row with toggle |

### Render function locations (js/app.js)

- `renderPickerCard()` — line 2981
- `renderMoodFilter()` — line 3612
- `renderTonight()` — line 3657
- `renderStats()` — line 4301
- `renderSettings()` — line 4440
- `renderPickerStrip()` — line 4547
- `renderMembersList()` — line 4579

---

## 6. Sources

### Competitive landscape
- [Reelgood Search Party](https://blog.reelgood.com/swipe), [Reelgood review](https://apps.uk/reelgood-review/), [JustWatch Lists](https://everymoviehasalesson.com/blog/2023/11/justwatch-adds-new-lists-feature-and-imports-your-imdb-lists), [Watchworthy / TechCrunch](https://techcrunch.com/2024/03/20/watchworthy-will-now-tell-you-which-streaming-services-to-cancel-and-which-to-keep/), [Fable club features](https://fable.co/club-features), [Letterboxd](https://letterboxd.com/), [Serializd](https://www.serializd.com/), [Plex Universal Watchlist](https://support.plex.tv/articles/universal-watchlist/), [Plex Watch Together FAQ](https://support.plex.tv/articles/frequently-asked-questions-watch-together/), [Trakt Jan 2025 release notes](https://releasenotes.trakt.tv/release/Y2LCE-january-21-2025), [Likewise upgrades](https://www.prnewswire.com/news-releases/entertainment-discovery-platform-likewise-introduces-new-ai-powered-mobile-app-upgrades-to-its-content-recommendations-ecosystem-302087504.html), [Teleparty 2025 review](https://movpilot.com/blog/teleparty-review/), [Discord Watch Together FAQ](https://support-apps.discord.com/hc/en-us/articles/26502500234519-Watch-Together-FAQ), [Movie Night Polls](https://www.movienightpolls.com/), [Stream Vote App Store](https://apps.apple.com/us/app/stream-vote-what-to-watch/id1560203643)

### Watchparty + scheduling
- [Design Critique: Partiful / IXD@Pratt](https://ixd.prattsi.org/2025/02/design-critique-partiful/), [Partiful vs Evite vs Paperless Post](https://invitfull.com/blog/partiful-evite-paperless-post-invitation-platform), [Apple Invites critique](https://pont.is/p/apple-invites), [Partiful Event Reminders](https://help.partiful.com/hc/en-us/sections/11974267096091--Event-Reminders), [Partiful Messaging Guests](https://help.partiful.com/hc/en-us/sections/27223770956187--Messaging-Guests), [SharePlay Apple guide](https://support.apple.com/guide/iphone/shareplay-watch-listen-play-iphb657eb791/ios), [SharePlay full walkthrough / NerdsChalk](https://nerdschalk.com/how-to-start-use-and-end-shareplay-on-facetime-everything-you-need-to-know/), [Discord Scheduled Events](https://support.discord.com/hc/en-us/articles/4409494125719-Scheduled-Events), [Discord Scheduled Event UX case study](https://medium.com/@ryudhisb/ui-ux-case-study-improving-scheduled-event-feature-on-discord-dcec4a9a97b6), [Hulu Watch Party](https://help.hulu.com/article/hulu-watch-party), [Best streaming watch parties 2026](https://agoodmovietowatch.com/cord-cutting/best-watch-party-streaming-services/), [Kast](https://www.kastapp.co/), [When2meet vs Doodle](https://koalendar.com/blog/when2meet-vs-doodle), [Rise of the Maybe RSVP](https://medium.com/mental-gecko/the-rise-of-the-maybe-rsvp-how-social-anxiety-is-changing-our-commitment-culture-860b5a91d809), [Reduce RSVP no-show rate](https://www.glueup.com/blog/fix-high-event-rsvp-no-show-rate), [Email Event Reminders](https://add-to-calendar-pro.com/articles/email-event-reminders), [Push Notification Best Practices](https://www.eventable.com/blog/how-to-master-push-notifications/), [Watch Party Sync w/ Shaka+PubNub](https://www.pubnub.com/blog/build-a-watch-party-sync-demo-with-shaka-player-and-pubnub/), [The problem with every watch-party app](https://dev.to/devpratyush/the-problem-with-every-watch-party-app-ever-made-ip9), [Kampfire — photo follow-ups](https://www.kampfire.online/)

### Sports / Game Mode
- [ESPN DTC Launch](https://espnpressroom.com/us/press-releases/2025/08/espn-launches-new-direct-to-consumer-service-enhanced-espn-app/), [ESPN enhanced app fan guide](https://www.espnfrontrow.com/2025/08/dtc-launch-week-a-sports-fans-guide-to-the-enhanced-espn-app/), [ESPN mobile multiview](https://www.espnfrontrow.com/2025/11/four-games-at-once-one-screen-anywhere-multiview-goes-mobile-on-the-espn-app/), [Playback MLB partnership](https://creator.playback.tv/blog/mlb-partnership), [Playback NBA partnership](https://creator.playback.tv/blog/nba-partnership), [Playback end-of-life](https://creator.playback.tv/blog/goodbye), [Playback relaunching via ESPN](https://mickeyblog.com/2026/03/19/social-sports-streamer-playback-tv-is-coming-back-as-part-of-espn/), [MLB.TV features 2025](https://www.mlb.com/news/mlb-tv-features-faq-2025), [NFL Sunday Ticket multiview / Tom's Guide](https://www.tomsguide.com/how-to/how-to-use-nfl-sunday-ticket-multiview-youtube-tv), [NFL Sunday Ticket multiview FAQ](https://support.google.com/youtubetv/answer/15139079?hl=en), [Twitch Watch Parties discontinued](https://www.esportsheaven.com/features/twitch-says-goodbye-to-watch-parties-what-you-need-to-know/), [Twitch Content Sharing Guidelines](https://help.twitch.tv/s/article/twitch-content-sharing-guidelines?language=en_US), [Amazon Prime Watch Party removed](https://www.neowin.net/news/amazon-prime-quietly-got-rid-of-a-covid-19-era-feature-watch-party/), [Dolby latency debate](https://optiview.dolby.com/resources/blog/sports/the-latency-debate-in-live-sports-consistency-vs-speed/), [Sky Sports Live Sync](https://www.techradar.com/streaming/sky-tv/what-is-sky-sports-live-sync-the-new-low-latency-sports-streaming-feature-explained), [Public ESPN API](https://github.com/pseudo-r/Public-ESPN-API), [ESPN hidden API Gist](https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b), [BALLDONTLIE](https://www.balldontlie.io/), [MySportsFeeds](https://www.mysportsfeeds.com/), [SportsDataIO](https://sportsdata.io/), [NFL Discord](https://discord.com/invite/nfl-official), [Reddit NFL guide](https://www.swaggermagazine.com/culture/sports/reddit-nfl-the-ultimate-guide-to-streaming-nfl-games-and-community-highlights/), [Social sportsbooks 2026](https://www.sportsbookreview.com/best-sportsbooks/social-sportsbooks/), [WagerLab](https://www.wagerlab.app/), [Fanatics Live launch](https://www.fanaticsinc.com/press-releases/fanatics-officially-launches-fanatics-live-a-next-gen-live-commerce-platform), [Watchers sports watch parties](https://watchersapp.medium.com/sports-watch-parties-newly-launched-services-and-their-performance-edbde85cc778)
