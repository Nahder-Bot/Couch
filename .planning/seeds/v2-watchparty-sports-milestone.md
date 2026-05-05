---
created: 2026-04-30
target_milestone: v2 (post-v1-commercial-release; watchparty + sports v2 cycle)
status: locked plan (4 of 6 phases pending; 2 shipped)
priority: critical (foundational for v2 milestone)
parent_scope: watchparty + sports brutally-honest review (2026-04-30)
sources:
  - .planning/phases/22-sports-feed-abstraction/22-SUMMARY.md (lines 100-115 — the canonical 6-phase plan table)
  - .planning/phases/23-live-scoreboard/23-SUMMARY.md (next-phase pointer + Phase 24 detail)
  - .planning/seeds/phase-async-replay.md (re-targeted as Phase 26 sub-request B)
  - .planning/seeds/v3-voice-video-chat-watchparty.md (sibling seed for v3 deferral)
---

# v2 watchparty/sports milestone — locked 6-phase plan

## Why this seed exists

The v2 milestone plan was locked on 2026-04-30 during the watchparty/sports brutally-honest review and lives in `22-SUMMARY.md` lines 100-115. Phases **23 + 22** shipped the same day (direct-ship pattern; mirrors Phase 21). The remaining four phases (**24, 26, 27, 28, 30**) need formal scoping — but until they're promoted into ROADMAP.md `### Phase N:` headings, they're invisible to the GSD chain. This seed captures the locked plan so individual phase formalization (or any renumbering) doesn't lose the inter-phase dependency tree, the deliberate number gaps, or the foundational ordering.

**Seed-file naming convention (per CLAUDE.md):** content-named, not number-named. If any of these phases get renumbered later, the seed survives because it doesn't claim a number it could lose. The active ROADMAP maps phase number → seed; the seed never claims a phase number.

## The 6-phase plan

Original 9-phase scoping (during the brutally-honest review pre-2026-04-30) was conservative; honest count is 6 features. Three pairs were combined per user direction during the review:

| Slot | Capability | Merge note | Status |
|------|-----------|-----------|--------|
| Phase 23 | Live scoreboard + consolidate two sports flows | unchanged | **SHIPPED 2026-04-30** (couch-v36.7-live-scoreboard) |
| Phase 24 | Native video player (iframe + HTML5) | merges old Phase 24 + 25 | **SCOPED, awaiting kickoff** |
| Phase 26 | Position-anchored reactions + async-replay | unchanged; depends on 24 | **SCOPED, awaiting kickoff** |
| Phase 27 | Guest RSVP | unchanged; independent | **SCOPED, awaiting kickoff** |
| Phase 28 | Social pick'em + leaderboards | merges old Phase 28 + 29 | **SCOPED, awaiting kickoff** |
| Phase 30 | Couch groups + affiliate hooks | merges old Phase 30 + 31 | **SCOPED, awaiting kickoff** |

**Phase numbers 25, 29, 31 are intentionally skipped.** Per 22-SUMMARY.md: "leaving gaps is cleaner than renumbering downstream references." Combined phases ship as bigger atomic deploys (≥5 commits + smoke gate) but map honestly to user-facing capabilities.

**Foundational dependency:** Phase 22 (sports-feed abstraction) is the legitimacy floor — every phase here depends on TheSportsDB (legitimate public API) replacing the ESPN ToS-gray scrape. That's why Phase 22 shipped first.

**Voice/video chat in watchparty deferred to v3 post-launch** — see `seeds/v3-voice-video-chat-watchparty.md`.

---

## Phase 24 — Native video player (iframe + HTML5)

**Goal:** Iframe wrapper for YouTube / Twitch / Vimeo + HTML5 `<video>` for self-hosted MP4 / M3U8 / Plex / Jellyfin URLs. `Player.currentTime` broadcast to Firestore so Phase 26 reactions can anchor to runtime position. Closes the "watchparty needs an actual video surface" gap — today watchparties are coordination-only; the video plays elsewhere.

**Why merged from old Phase 24 + 25:** old plan separated the two player types (iframe vs HTML5); single phase ships both since they share the position-broadcast mechanism and the embed/URL parser pipeline.

**Depends on:** Phase 7 (watchparty primitive — wp records + reactions surface), Phase 11 / REFR-10 (video-mode catch-me-up scaffolding). No cross-repo work expected (player lives in couch repo).

**Critical downstream:** Phase 26 (position-anchored reactions + async-replay) **depends on Phase 24's `currentTime` broadcast** — without it, reactions can't anchor to runtime position. This is the one hard ordering constraint in the v2 plan.

---

## Phase 26 — Position-anchored reactions + async-replay

**Goal:** Reactions become runtime-indexed (capture `runtimePositionMs` alongside `serverTimestamp`) so a later viewer can "replay" the original group's reactions aligned to their playback position. The "Red Wedding" hero use case: watch a show the next day at minute 25 → see what the group said when they were at minute 25, so you feel like you were part of it.

**Why depends on 24:** Phase 24's `currentTime` broadcast is the data source for the `runtimePositionMs` field. Without a Couch-native player, runtime position is unobservable.

**Why merged with async-replay:** original plan separated "position anchor" (data model) from "async replay" (UX flow); single phase since async-replay's scope IS the runtime-indexed reactions schema + a rejoin flow on top.

**Source:** see `seeds/phase-async-replay.md` for the original sub-request B detail (re-targeted as the Phase 26 anchor scope).

---

## Phase 27 — Guest RSVP

**Goal:** Non-member guests can RSVP to a watchparty without creating an account — token-based RSVP link that captures display name + going/maybe/no without forcing signup. Closes the "wife's friend wants to come but doesn't want a Couch account" gap.

**Why independent:** doesn't depend on Phase 24/26 (works regardless of player surface or reactions schema). Could ship before or after 24/26 in parallel; user direction lands the order.

---

## Phase 28 — Social pick'em + leaderboards

**Goal:** Sports-mode pick'em surface (predict winner / spread / score before tip-off) + per-family leaderboard tracking pick accuracy across the season. Adds repeat-engagement loop on top of the sports watchparty primitive.

**Why merged from old Phase 28 + 29:** original plan had pick'em (data model + picker UI) and leaderboard (aggregation + visualization) as separate phases; single phase since the leaderboard is just a derived view of the pick'em data.

**Depends on:** Phase 22 (sports feed for game catalog), Phase 11 / REFR-10 (sports watchparty primitive).

---

## Phase 30 — Couch groups + affiliate hooks

**Goal:** Multi-family "couch groups" (a step up from single-family scope) + affiliate referral hooks for monetization signaling (e.g., "watch on Netflix" links carry affiliate tags where the partner program allows). Closes the "two families want a shared Couch" gap and opens the first non-paid monetization surface.

**Why merged from old Phase 30 + 31:** affiliate hooks need a multi-family scope to amortize attribution; coupling the two avoids a stranded phase that ships affiliate without the social surface to make it meaningful.

**Caveat — monetization out of scope per CLAUDE.md:** Couch CLAUDE.md explicitly lists "Don't start monetization / billing / plan-tier work (explicitly Out of Scope)" for v1. Phase 30 is v2 territory; the affiliate hook is a passive referral signal (no billing, no plan tiers), but plan/discuss steps must surface this constraint and confirm.

---

## Inter-phase ordering constraints

```
Phase 22 (shipped) ─┬─→ Phase 23 (shipped) ─┬─→ Phase 28 (pick'em — depends on 22 sports catalog)
                    │                        └─→ Phase 24 ─→ Phase 26 (reactions — depends on 24 runtime broadcast)
                    └─→ Phase 27 (guest RSVP — independent)
                    └─→ Phase 30 (couch groups + affiliate — independent of 24/26/27/28)
```

**Hard ordering:** Phase 24 must precede Phase 26.
**Soft ordering:** All other phases can ship in any order user prefers.

## Open questions for individual phase discuss-phase chains

These are the gray areas the locked plan didn't resolve — each phase's `/gsd-discuss-phase` should surface them:

- **Phase 24:** which embeds to support at v2 launch (YouTube/Twitch/Vimeo all? subset?), how to handle DRM-restricted content (Netflix/Disney+ won't iframe), self-hosted player URL format support (M3U8 yes/no?), CORS handling for Plex/Jellyfin
- **Phase 26:** retroactive reaction migration (older wall-clock-only reactions — leave or backfill?), replay UX (timeline scrubber? auto-play with reactions?), rejoin flow (separate "Replay" surface vs join-as-replay on existing watchparty?)
- **Phase 27:** RSVP token TTL, guest-name uniqueness (collision with member names?), revoke flow, push notification opt-in for guests
- **Phase 28:** which sports get pick'em (all 16 leagues? subset?), pick lock time (kickoff? earlier?), tiebreaker rules, season boundary handling
- **Phase 30:** group-of-groups data model (existing `families/{code}` → new aggregation layer?), affiliate program partners at v2 launch (TMDB? JustWatch? other?), disclosure UX (FTC requirements)

---

## Audit trail

- 2026-04-30: Plan locked during watchparty/sports brutally-honest review; 22 + 23 shipped same day; written to `22-SUMMARY.md` lines 100-115
- 2026-04-30: Plan promoted to ROADMAP.md as `### Phase 24 / 26 / 27 / 28 / 30` headings + Progress table rows; this seed created to protect inter-phase dependency tree from drift if any phase is renumbered later
