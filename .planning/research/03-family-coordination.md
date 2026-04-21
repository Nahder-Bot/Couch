# Family Coordination UX Research

**For:** Couch (couchtonight.app) — family movie-night PWA
**Date:** 2026-04-21
**Scope:** Non-media coordination apps + group movie-pick apps. Focus on member model, parent-guardian gating, multi-member decisions, and group-size labels.

## App-by-app findings

| App | Member model | Parent/guardian gating | Multi-member decision UX | Group labels |
|---|---|---|---|---|
| **Cozi** | Single shared account; each person gets a **color**, not a real account. Email + shared family password. | **None.** Kids have admin access to chores/calendar and can reassign their own tasks. Widely flagged as a 2026 weakness. | No voting. Shared lists + color-coded assignments; coordination is "who sees what." | "Family" only. Color-per-person is the identity metaphor. |
| **OurHome** | Per-member profiles (name, optional email). Not real auth — parent-curated identities. | Parents **personalize what each child can see, add, or edit** per-member. Task assignment is parent-driven. | Points-for-chores → claim rewards. Not "pick together," but the claim-a-reward model is a useful async pattern. | "Family" / "household." |
| **Life360** | **Circle** is the primary primitive — not "family." Creator = admin; other members = default read-only to admin actions. Admin role can be delegated. | Admin controls circle membership; members control their own privacy (turn off tracking, "Bubble" for temporary obfuscation). Not kid-specific gating — age-agnostic role model. | No "decide together" feature — coordination is passive (location, geofence alerts, crash detection, SOS). | **"Circle"** is the dominant label — works for families, roommates, partners. Very relevant to Couch's family/crew/duo split. |
| **Apple Family Sharing** | Real roles: **Organizer, Parent/Guardian, Adult, Child/Teen**. Organizer invites; any adult can be promoted to Parent/Guardian. | **Ask to Buy** is the gold-standard async-approval pattern: kid initiates → Organizer gets push → approves/declines from their device. On by default under 13; toggleable up to 18. At 13, kids can self-remove (unless Screen Time locks it). | No group voting. Individual request → single adult approves. | "Family" only (hardcoded). Role labels carry the nuance. |
| **Picniic** | Shared dashboard for "mom, dad, kids, caregivers." Per-member profiles. | Light — shopping list, calendar, locker. No granular permission model. Project appears stagnant (last notable reviews 2016-2023). | No decision primitive — shared artifacts only. | "Family." |
| **Movie Night / Swipflix / Movie Swiper** (group movie pickers) | **Room code** model (4-digit code, QR join). No persistent membership — ephemeral session. | None. Age-blind. | **Tinder-swipe → match** is the dominant pattern. Swipe right to like; when everyone (or N) agrees, it's a "match." Filters: streaming platform, genre. | "Room," "crew," "group" — never "family." |
| **Disney+ GroupWatch / Teleparty** | Host + invitees via link/code. | None (host controls pause/play). | Synchronous playback + chat; no pre-decision voting. | "GroupWatch" / "party." |

## Patterns worth adopting for Couch

### 1. Steal Apple's role vocabulary, not Cozi's color-per-person
Cozi's flat "everyone is admin" model is the anti-pattern cited in 2026 reviews. Apple's explicit **Organizer / Parent-Guardian / Adult / Child** ladder is the proven mental model. For Couch: make "family owner," "co-parent" (can manage sub-profiles and gate content), and "member" distinct roles. Duo mode collapses this to two peers; crew mode can use "host" instead of "organizer."

### 2. Sub-profile "tap-in" = Apple's child-account pattern minus auth
Kids under ~10 shouldn't manage credentials. Apple's pattern: the parent creates the identity; the device remembers them; the child interacts via gated actions (Ask to Buy). For Couch: sub-profiles live under a parent account, show as tappable avatars on the movie-night screen ("Tap yourself in"), and any settings/rating-override action routes to a parent-approval prompt. **Ask-to-Buy is the template** — async push to parent, approve/decline, done.

### 3. Swipe-to-match for the actual pick, but bounded
Movie Night / Swipflix have proven the swipe-match pattern works for movie selection. But Couch has kids, so: (a) cap the deck (~15-20 cards, not infinite), (b) hide other members' swipes until reveal to prevent groupthink (per NN/g dot-voting guidance), (c) "match" = first title where every tapped-in member swiped right. Parent can override the match (veto) without breaking the fun — this is the parent-guardian gating in action.

### 4. Borrow "Circle" framing for the group label
Life360's **Circle** is the only non-media app that successfully labels variable-size groups without assuming "family." Couch already uses family/crew/duo — keep those as *modes*, but consider "your circle" as the default noun for the member list screen. Avoids infantilizing crew/duo users while still feeling warm.

### 5. Cadence label: "Tonight" > "Today"
No direct research hit, but the ecosystem signal is clear: every group-pick app (Movie Night, Swipflix, Movie Night Polls) uses **"tonight"** / **"movie night"** framing. Cozi/OurHome use "today" because chores happen all day. For a watch-deciding product, "tonight" is the right mental anchor — it implies a single evening decision, not a standing list. Reserve "weekend" as the secondary cadence for longer-form picks.

### 6. Solo-within-family: Prime Video Profiles is the reference
Prime Video's per-profile watchlist inside a shared account is the cleanest pattern: shared billing/membership, private recommendations and watchlist per person. For Couch: **each member (including parent) gets a private watchlist**, plus the family gets a shared "Tonight's shortlist." Parent's private list never leaks into kid sub-profile recommendations. This is table-stakes once there are >2 members.

### 7. Async approval > synchronous voting for mixed-age groups
Apple's Ask-to-Buy is async: kid taps → parent gets notified → approves later. For families where kids and parents aren't always in the same room at decision time, Couch should support async pre-voting ("Leo swiped these 3 earlier today; approve for tonight's deck?") in addition to live swipe sessions.

## Sources

- [Cozi Review 2026 — Calendara](https://www.usecalendara.com/blog/cozi-review-2026)
- [Cozi Family Organizer — Zift App Advisor](https://wezift.com/parent-portal/apps/cozi-family-organizer/)
- [OurHome — Little Day Out parent review](https://www.littledayout.com/parent-review-ourhome-app-for-home-organisation-and-behaviour-management/)
- [OurHome official](http://ourhomeapp.com/)
- [Life360 Review 2026 — SafetyDetectives](https://www.safetydetectives.com/best-parental-control/life360/)
- [Everything about Life360 Circle — iToolab](https://itoolab.com/location/life360-circle/)
- [Apple Family Sharing overview for kids and teens](https://support.apple.com/en-us/119854)
- [How Family Sharing works — Apple Support](https://support.apple.com/en-us/105062)
- [Apple Family Sharing roles — AirDroid](https://www.airdroid.com/ios-parental/iphone-family-sharing/)
- [Picniic — Zift App Advisor](https://wezift.com/parent-portal/apps/picniic-family-organizer/)
- [Movie Night: Film & TV Picker — App Store](https://apps.apple.com/us/app/movie-night-film-tv-picker/id1554471846)
- [Swipflix — App Store](https://apps.apple.com/us/app/swipflix-movie-night-picker/id6756960810)
- [Movie Night Polls](https://www.movienightpolls.com/)
- [Prime Video Profiles help](https://www.primevideo.com/help?nodeId=GD8VJD2EDJ2GSNEC)
- [Disney+ GroupWatch / Teleparty overview — Entertainment.ie](https://entertainment.ie/on-demand/on-demand-news/how-to-host-a-streaming-party-on-netflix-amazon-and-disney-plus-478033/)
- [Dot Voting — NN/Group](https://www.nngroup.com/articles/dot-voting/)

**Confidence:** MEDIUM-HIGH. Named features (Ask-to-Buy, Circle admin, Cozi's lack of parental controls, swipe-match in Movie Night/Swipflix) are verified from official/review sources. Label recommendations ("tonight" framing, "Circle" noun) are synthesized from ecosystem signal rather than a single source — treat as informed opinion, validate in user testing.
