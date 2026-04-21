# 08 — User Archetypes & Naming Strategy

**Project:** Couch (couchtonight.app)
**Researched:** 2026-04-21
**Confidence:** MEDIUM-HIGH overall. Q1/Q2/Q3 grounded in cross-domain precedent (family/friend/team apps, viewing trackers). Q4 naming recommendation is opinionated strategic judgment informed by competitor landscape; final trademark clearance is out of scope for this thread.

This thread is strategic — findings may reshape the product, not just polish it. Recommendations lead; rationale follows.

---

## Q1: Is family / crew / duo the right archetype axis?

### TL;DR
**No — not as the primary user-facing axis.** Keep the three modes internally as *capacity presets*, but reorganize the user-facing model around a single concept: **the Couch (a household-like space) with flexible members**. Successful multi-user coordination apps (Geneva, Notion, Discord) converged on *one container, flexible composition* — not "pick your archetype at signup."

### Evidence

**Family-only apps (Cozi, Apple Family) are dated and narrow.** Cozi is now described as "a dated app with an aggressive paywall, one-way sync, no parental controls, no data portability" ([Calendara, 2026](https://www.usecalendara.com/blog/cozi-review-2026)). Its strict family-only framing is a *competitive liability* in 2026 — users want flexibility. Apple Family is infrastructure, not a coordination UX pattern worth copying.

**Friend-group apps (Geneva, Discord DMs) converged on "one container, many shapes."** Geneva calls every group a "home" and lets you mix "5 room types" inside it — chat, post, video, audio, broadcast — letting the group choose its shape ([Geneva blog](https://www.geneva.com/blog/hey), [Indie Hackers](https://www.indiehackers.com/post/introducing-geneva-an-all-in-one-communication-app-for-groups-clubs-and-communities-6301a80650)). Discord learned that users overwhelmingly prefer group DMs over servers for small friend groups: *"groups are way more convenient... especially when you join a lot of servers and lose the one you had with your friends"* ([Discord community](https://support.discord.com/hc/en-us/community/posts/360063798871-Adding-more-than-10-people-in-a-Group-DM)). The lesson: **small intimate groups want one simple container, not an archetype picker.**

**Flexible-mode apps (Notion Teamspaces) normalized "one workspace, many shapes."** Notion allows a single workspace to host family event planning, team projects, and solo notes via Teamspaces with per-space permissions — *"the Guest role is perfect for people outside of your team or organization, including contractors, clients, or friends and family members with whom you're planning an event"* ([Notion Help](https://www.notion.com/help/guides/teamspaces-give-teams-home-for-important-work)). No user is forced to pick "family" vs "team" at signup.

**Jellyfin vs Plex household pattern:** Both model "one server, many user profiles" rather than picking a household archetype — the *number of profiles* and *permissions per profile* (Dashboard → Users → Library Access) carry all the nuance ([JellyWatch Blog, 2026](https://jellywatch.app/blog/jellyfin-multi-user-parental-controls-guide-2026)). This is the right mental model: **one Couch, many couch members, with roles.**

### Recommendation

Collapse family / crew / duo into **"a Couch"** (one space) with:
- **Members** (full accounts: adult-to-adult, can create, vote, invite)
- **Profiles** (sub-profiles without auth: young kids, pets-as-gag, guest personas)
- **Roles** per member: `host` (admin/billing), `member` (equal vote), `kid` (parental-controlled taste profile, limited vote weight), `guest` (temporary — the visiting niece)

The old `family / crew / duo` split becomes **implicit from composition** — if 2 adults + 2 kid profiles, the UI subtly leans "family" (e.g., defaults to G/PG filter); if 3 adult members, no kid profiles, it leans "crew" (defaults unlock). **This is taste-driven personalization, not archetype lock-in.** Users resize their Couch over time without migrating.

**What this buys you:**
- Roommate who has a kid on weekends isn't forced to pick one mode
- Duo that becomes a family of 3 doesn't need to "upgrade" archetypes
- Crew that invites a partner's parents for a holiday weekend just adds a guest profile
- International generalization is easier — "family" carries cultural baggage; "Couch" doesn't

---

## Q2: Can SOLO be a viable use case for Couch?

### TL;DR
**Yes — but as an on-ramp, not a destination.** Solo should be a fully functional first-run experience that naturally leads to inviting others. Do NOT build a Letterboxd competitor — build a "solo Couch that's already shaped like a group Couch, just with one seat filled."

### Evidence

**Letterboxd proves solo-first + social-additive works at scale.** Letterboxd is explicitly "a diary to record your opinion about films as you watch them, or just to keep track of films you've seen" — solo-primary. Social layers on via follows, and private list-sharing for couples/groups was added later ([Letterboxd FAQ](https://letterboxd.com/about/faq/), [Between Us](https://letterboxd.com/journal/between-us-private-lists-sharing/)). The solo experience is rich enough to be a product on its own.

**TV Time's telling usage split:** *"70% of TV Time's active users primarily use the app for tracking and discovery features"* — solo. The social 30% drives most engagement volume ([TechCrunch](https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge/), [Wikipedia](https://en.wikipedia.org/wiki/TV_Time)). **This is the ratio Couch should plan for: most users will open it solo on a Tuesday; the magic happens on Friday when the group is present.**

**Mood-driven solo recommendations have strong traction.** The Movie App claims *"93.2% less search time, reduced from 17 minutes to 1.15 minutes"* via mood quizzes ([themovieapp.co.uk](https://www.themovieapp.co.uk/)). Moodies and Taranify use color/mood quizzes with no login ([Taranify](https://www.taranify.com/)). The solo pain point — *"I have 45 minutes and four streaming services, what do I watch?"* — is real and monetizable without requiring a group.

### Recommendation

**Ship solo as a real use case, framed as "Couch for One."** Solo users get:

1. **Personal Couch with a single seat filled.** Same UI, same "Tonight" screen, same mood filters — just no vote consensus needed (your pick wins instantly).
2. **Mood-driven recommendations** as the marquee solo hook — addresses the Tuesday-night-alone use case where Couch's group features are irrelevant.
3. **Watch history + taste profile** that's yours forever, migrates cleanly into a group.
4. **Gentle group-upgrade prompts** — *"Liked this? Your partner would probably vote for it too. Invite them →"* after ~5 picks.

**Do NOT:**
- Build a social following graph (Letterboxd owns that, and it dilutes your family-first warmth)
- Add public reviews/likes (solo should feel private, not performative)
- Over-gamify solo stats (that's TV Time's territory — keep Couch's solo mode cozy, not completionist)

**The positioning line:** *"Couch works alone. It's better with people."*

---

## Q3: Solo → group merge/upgrade flow

### TL;DR
**Yes, implement it — but only as "invite people into YOUR Couch," never as "merge two Couches."** Data migration is cheap if the solo user is always the seed; bidirectional merging is a known UX and data disaster.

### Evidence

**The pattern is well-established in onboarding design.** Best practice: *"After completing registration, users can be directed to a screen that empowers them to choose between working individually or as part of a team... team invites should be made prominent but optional, prompting users to invite teammates during setup while always providing a skip or do it later option"* ([RapidNative](https://www.rapidnative.com/blogs/user-onboarding-best-practices), [Mockplus](https://www.mockplus.com/blog/post/app-onboarding-examples)). Slack, Notion, Linear, and Figma all do solo-first-then-invite as the default path.

**Emotional/privacy risk is real and documented.** The Letterboxd team shipped "Between Us" specifically because users wanted to share without making solo history public — *"You can now share your private lists with Letterboxd friends (members you follow), or with anyone"* ([Letterboxd Journal](https://letterboxd.com/journal/between-us-private-lists-sharing/)). **Solo watch history is private by default and must stay private retroactively when a group forms.**

**Technical pattern from media servers:** WatchState, JellyPlex-Watched, and similar sync tools use *per-identity* watch state with explicit one-way or many-to-many sync — they never silently merge histories ([WatchState](https://github.com/arabcoders/watchstate), [JellyPlex-Watched](https://github.com/luigi311/JellyPlex-Watched)). The precedent is: **each member keeps their own history; shared history is a view, not a merge.**

### Recommendation — implementation sketch

**Data model:**
- Solo user creates account → system creates a `Couch` with one `Member` (them).
- Watch history, ratings, watchlist are attached to the **Member**, not the Couch.
- When they invite someone, the new person joins the same Couch, brings their own empty (or imported) Member record.
- "Tonight" voting and group history are **Couch-level** aggregations; solo history stays on the Member.

**UX flow:**
1. Solo onboarding never mentions "family vs crew" — just "Set up your Couch" (one person).
2. After 3-5 solo picks, soft prompt: *"Couch gets better with others. Invite someone →"* Skippable, never modal-blocking.
3. On invite acceptance:
   - Inviter's solo history stays **private to them by default**.
   - A one-time dialog: *"Share your watch history with [Name]? You can change this anytime."* Three options: **Share everything / Share ratings only / Keep private.** Default to "Share ratings only."
   - Everything from that moment forward is shared Couch activity.
4. Retroactive privacy is the default — joining a Couch never exposes prior solo content unless explicitly unlocked.

**What NOT to build:**
- Bidirectional Couch merging (solo user A invites solo user B, their Couches fuse). Instead: B joins A's Couch and B's solo Couch becomes a dormant personal space or is archived. Merging two active group histories is a well-known nightmare with no clean UX pattern.
- "Downgrade to solo" when a group dissolves — model it as "members leave; the Couch persists with remaining members; departing member keeps their own Member record and starts fresh or joins another Couch."

---

## Q4: Naming — what to call an "evening / session / gathering"

### TL;DR recommendation

**Keep "Tonight" as the primary tab/screen label. Introduce "a pick" as the unit of activity (what a Couch does on a Tonight). Retire "who's on the couch" in favor of "who's watching tonight."**

This leans into Couch's existing domain (`couchtonight.app`), avoids cringe (which kills teen uptake faster than anything), and scales internationally.

### 5 candidates ranked

| Rank | Label | Age appeal (teen/parent) | Translation | Cringe risk | Trademark risk | Verdict |
|------|-------|---------|-------------|-------------|---------------|---------|
| **1** | **Tonight** | High / High | Excellent — every language has a "tonight" word; translates as-is (Heute Abend, Stasera, Esta noche) | Very low — it's a time word, not a brand try-hard | Low — unregistrable as a mark in this context; abundant prior use in UX | **Primary tab. Keep it.** |
| **2** | **Pick** | High / High | Good — "pick" ≈ choose, universal action verb, translates to Wahl/Scelta/Elección | Low — action-oriented, not trying to be cool | Low — generic verb | **Unit of activity.** "Make tonight's pick," "Past picks," "Pick together." |
| **3** | **The Couch** (as the session, capitalized) | Med / High | Excellent — "couch/divan/sofa" cognate across most European languages; warm furniture metaphor is universal | Low for parents, slight "trying-too-hard" for teens if overused | You own couchtonight.app — strong brand anchor | **Use for the space, not the session.** Don't say "start a Couch" (weird); say "on the Couch tonight." |
| 4 | **Session** | Low / Med | Good | Med — feels corporate/clinical; kids associate with therapy, gaming | Low | Avoid. Too transactional for a cozy brand. |
| 5 | **Movie Night / Show Night** | Med / High | Fine but verbose — "Filmabend" in DE is fine; "Noche de película" in ES is clunky as UI label | Low — nostalgic, familiar | Low — generic | Fallback if "Tonight" tests poorly with adults who find it ambiguous. |

### Explicitly rejected

- **"Flick Pick" / "Vibe Check"** — Hard reject. *"Vibe"* already shows as an overused Gen Z slang term being adopted and abandoned rapidly ([Gabb Teen Slang 2026](https://gabb.com/blog/teen-slang/), [SheKnows 2026](https://www.sheknows.com/parenting/slideshow/1234883077/teen-slang-2026/)). Slang-native names age badly — they sound dated within 18 months and instantly alienate parents. Even if teens used *"flick"* and *"vibe"* today, the dual-audience product (parents + teens) loses both camps: teens smell try-hard, parents don't get the reference. This is a classic founder trap.
- **"Kino" / "Cinema"** — "Kino" has a real competitor footprint: `kino.de` (Germany, 4M+ installs in DACH), `KINO: Watch, Engage, Discover` on the App Store, Kino Film Collection ([Google Play kino.de](https://play.google.com/store/apps/details?id=de.kino.app), [App Store KINO](https://apps.apple.com/us/app/kino-watch-engage-discover/id6450518656)). European expansion becomes a trademark minefield. "Cinema" is too grand for what Couch is — it's not a cinema, it's a sofa with three people on it.
- **"Round"** — Too gamified; implies competition. Couch is cooperative.
- **"Couch Session"** — Two-word compounds feel institutional. A "Couch Session" sounds like therapy. ([Discussion of this exact risk in brand naming](https://www.ebaqdesign.com/blog/brand-naming).)

### The vocabulary blueprint

Use this consistent vocabulary across the app:

| Concept | Label | Example usage |
|---------|-------|----------------|
| The product | **Couch** | "Open Couch" |
| A household/space | **your Couch** (lowercase) | "Who's in your Couch?" |
| The shared screen/activity | **Tonight** | "Tonight" tab, "Tonight's pick" |
| The act of choosing | **Pick** | "Make a pick," "Today's pick" |
| Past selections | **Picks** | "Past picks," "Picks you loved" |
| The people present | **Watching tonight** | "Who's watching tonight?" (replaces "who's on the couch") |

**Why this is better than the current model:**

- *"Who's on the couch"* has a physical-literalism problem — on a PWA used from a phone, the user may literally be on the couch, or in bed, or at a hotel. "Watching tonight" works in all contexts.
- *"Tonight"* as a tab answers the one-question-that-matters immediately on open: *"what are we doing tonight?"* No cognitive reframe.
- *"Pick"* is verb + noun (BeReal, Locket, Airbnb pattern of simple evocative names — *"evocative brand names conjure up feelings or images associated with the product"* ([BrandedAgency](https://www.brandedagency.com/blog/how-to-name-your-brand))). It invites action without being corporate.

### Trademark + international posture

- **"Couch" as a brand** — well-positioned since you already hold `couchtonight.app`. Bare "Couch" has conflicts (furniture retailers, Couchsurfing, CouchDB) but "Couch" in Class 009 / 041 for media-picking software is defensible with the "tonight" qualifier. Run a USPTO search ([tmsearch.uspto.gov](https://tmsearch.uspto.gov/)) before any paid marketing. Out of scope for this thread.
- **No UI labels require translation of brand terms.** "Tonight" → localize to the user's language; "Pick" → localize; "Couch" → keep as brand (proper noun), same way Airbnb stays Airbnb in every locale.
- **Do not trademark "Tonight," "Pick," or "Session"** — they're generic. Trademark "Couch" in the software class and the full mark "Couch Tonight" / the logomark.

---

## Sources

### Q1 — Archetypes
- [Geneva — Intro: all-in-one communication for groups](https://www.indiehackers.com/post/introducing-geneva-an-all-in-one-communication-app-for-groups-clubs-and-communities-6301a80650)
- [Geneva — Hey / offline-people framing](https://www.geneva.com/blog/hey)
- [Geneva — Member Groups](https://www.geneva.com/blog/introducing-member-groups)
- [Notion — Teamspaces give every team a home](https://www.notion.com/help/guides/teamspaces-give-teams-home-for-important-work)
- [Notion — Sharing & permissions guide](https://www.notion.com/help/sharing-and-permissions)
- [Discord — Group Chat and Calls](https://support.discord.com/hc/en-us/articles/223657667-Group-Chat-and-Calls)
- [Discord community on group DMs vs servers](https://support.discord.com/hc/en-us/community/posts/360063798871-Adding-more-than-10-people-in-a-Group-DM)
- [Cozi 2026 review — aging + paywall](https://www.usecalendara.com/blog/cozi-review-2026)
- [Best family organizer apps 2026 comparison](https://gethomsy.com/blog/comparisons/best-family-organizer-apps-2026)
- [Jellyfin multi-user setup + parental controls 2026](https://jellywatch.app/blog/jellyfin-multi-user-parental-controls-guide-2026)
- [XDA — Jellyfin ready for families](https://www.xda-developers.com/jellyfin-comes-very-close-to-plex-in-family-friendly-features/)

### Q2 — Solo viability
- [Letterboxd FAQ — core solo features](https://letterboxd.com/about/faq/)
- [Letterboxd — Between Us private list sharing](https://letterboxd.com/journal/between-us-private-lists-sharing/)
- [Letterboxd — Wikipedia overview](https://en.wikipedia.org/wiki/Letterboxd)
- [TechCrunch — TV Time daily users, binge discovery](https://techcrunch.com/2018/03/12/tv-time-the-tv-tracking-app-with-over-a-million-daily-users-can-now-find-your-next-binge/)
- [TV Time — Wikipedia](https://en.wikipedia.org/wiki/TV_Time)
- [Variety — TV Time social analytics](https://variety.com/2018/digital/news/tv-time-fan-reaction-social-analytics-1202888016/)
- [The Movie App — mood-based search-time stat](https://www.themovieapp.co.uk/)
- [Taranify — mood quiz, no login](https://www.taranify.com/)
- [Moodies — mood-based recommendations](https://www.trendhunter.com/trends/moodies)
- [A Good Movie to Watch — mood-based curation](https://agoodmovietowatch.com/mood/)

### Q3 — Solo → group merge
- [RapidNative — onboarding best practices (solo vs team paths)](https://www.rapidnative.com/blogs/user-onboarding-best-practices)
- [Mockplus — app onboarding examples](https://www.mockplus.com/blog/post/app-onboarding-examples)
- [NN/G — mobile app onboarding components](https://www.nngroup.com/articles/mobile-app-onboarding/)
- [SAP Fiori — multi-user onboarding pattern](https://www.sap.com/design-system/fiori-design-ios/ui-elements/patterns/multiuser-onboarding/)
- [WatchState — multi-user play-state sync](https://github.com/arabcoders/watchstate)
- [JellyPlex-Watched — per-user sync tool](https://github.com/luigi311/JellyPlex-Watched)

### Q4 — Naming
- [USPTO trademark search](https://tmsearch.uspto.gov/)
- [USPTO trademarks for mobile apps primer](https://arapackelaw.com/trademarks/trademarks-for-mobile-apps/)
- [BrandedAgency — brand naming framework (evocative/descriptive)](https://www.brandedagency.com/blog/how-to-name-your-brand)
- [How Brands Are Built — types of brand names chart](https://howbrandsarebuilt.com/types-of-brand-names/)
- [Siegel+Gale — on verbing product names](https://www.siegelgale.com/stop-obsessing-over-the-verbing-of-your-product-names/)
- [Gabb — 2026 teen slang dictionary](https://gabb.com/blog/teen-slang/)
- [SheKnows — 2026 teen/tween slang guide](https://www.sheknows.com/parenting/slideshow/1234883077/teen-slang-2026/)
- [Axis — 2026 parent guide to teen slang](https://axis.org/resource/a-parent-guide-to-teen-slang/)
- [kino.de Google Play listing](https://play.google.com/store/apps/details?id=de.kino.app)
- [KINO App Store listing](https://apps.apple.com/us/app/kino-watch-engage-discover/id6450518656)
- [Kino Film Collection](https://kinofilmcollection.com/)
- [Movie Night - Swipe & Watch (App Store)](https://apps.apple.com/us/app/movie-night-swipe-watch/id1554471846)
- [Best watch party apps overview](https://gadgetio.xyz/best-watch-party-apps/)
- [Brand naming — 5-step process](https://www.lexiconbranding.com/brand-naming-process/)
- [Duolingo brand narrative](https://design.duolingo.com/writing/brand-narrative)

---

## Summary for roadmap

1. **Rearchitect archetypes → one "Couch" with flexible members/roles.** Affects data model, onboarding, and settings screens. This is a structural change, not cosmetic — address in an early phase or it calcifies.
2. **Ship solo as a first-class on-ramp.** Mood-driven recs is the anchor feature for solo. This lets Couch acquire users who don't have a group yet — doubling the addressable market.
3. **Implement solo→group invite flow with retroactive privacy defaults.** Member-scoped watch history with explicit share-level dialog on invite acceptance.
4. **Lock vocabulary: Couch (product/space) · Tonight (screen) · Pick (unit) · Watching tonight (member picker).** Update the current "who's on the couch" label. Reject slang-based naming ("Vibe Check," "Flick Pick").
