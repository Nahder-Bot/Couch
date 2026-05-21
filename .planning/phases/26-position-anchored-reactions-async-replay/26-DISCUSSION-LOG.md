# Phase 26: Position-anchored reactions + async-replay - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 26-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-01
**Phase:** 26-position-anchored-reactions-async-replay
**Areas discussed:** Position source (live), Replay UX shape, Replay entry point, Retroactive migration

---

## Position source (live)

### Q1: When a reaction is sent during a LIVE party, what becomes its runtimePositionMs?

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid by wp state | Player → derive from wp.currentTimeMs + extrapolation. No-player → fall back to elapsedMs. isLiveStream → null. | ✓ |
| Player-only — skip the rest | Only player-attached wps capture runtimePositionMs. DRM / external / live-stream get no replay. | |
| Manual scrubber for everyone | Live modal grows an "I'm at X min" scrubber for ALL parties; viewers babysit position. | |
| Hybrid + opt-in scrubber for DRM | Hybrid default + DRM-only scrubber affordance. Two ways to do same thing. | |

**User's choice:** Hybrid by wp state (recommended)
**Notes:** Foundational schema decision. Drives runtimeSource enum: 'broadcast' | 'elapsed' | 'live-stream'.

### Q2: When the player broadcast is STALE, how should we capture runtimePositionMs?

| Option | Description | Selected |
|--------|-------------|----------|
| Fall back to elapsedMs | Stale broadcast → treat as no-player → use elapsedMs + runtimeSource='elapsed'. | ✓ |
| Extrapolate anyway | Use last known currentTimeMs + (now - currentTimeUpdatedAt) regardless of staleness. | |
| Skip — stamp null | Stale broadcast → no runtimePositionMs at all. Holes in replay timeline. | |
| You decide | Defer to research/planning. | |

**User's choice:** Fall back to elapsedMs (recommended)
**Notes:** STALE_BROADCAST_MAX_MS already exported from Phase 24 module (js/native-video-player.js). Reuse.

### Q3: For LIVE-STREAM watchparties (isLiveStream === true), should reactions even attempt runtime indexing?

| Option | Description | Selected |
|--------|-------------|----------|
| No — wall-clock only | runtimePositionMs = null, runtimeSource = 'live-stream'. Replay surface skips. | ✓ |
| Yes — use currentTimeMs anyway | Some live streams VOD-able later; capture position; let replay UX decide. | |
| Yes for sports, no for news | Differentiated by mode. Per-mode logic complexity. | |

**User's choice:** No — wall-clock only (recommended)
**Notes:** Honest about the data: a live broadcast doesn't have a re-watchable timeline.

---

## Replay UX shape

### Q4: What's the primary replay UX model?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-play with self-positioning | User sets "I'm at minute X"; reactions auto-stream as local clock advances. Mirrors live emotionally. | ✓ |
| Scrubber-driven (browse mode) | Horizontal timeline + reaction density bars; tap any moment. No auto-advance. | |
| Both — same surface, two modes | Auto-play default + scrubber for jumping. More UX surface to design. | |
| You decide | Defer to research/planning. | |

**User's choice:** Auto-play with self-positioning (recommended)
**Notes:** "Feel like you were there" magic preserved.

### Q5: What happens when a viewer in REPLAY mode posts their own reaction?

| Option | Description | Selected |
|--------|-------------|----------|
| Compounds — attached to party for future replayers | Stamp with current runtimePositionMs; arrayUnion to wp.reactions; future replayers see it. | ✓ |
| Private to replayer (no write) | Local UI only; party frozen. Cleanest data; loses recursive memory. | |
| Block replay-mode reactions | Send button disabled in replay mode. Strongest "past is past" framing. | |
| Compounds locally + opt-in publish | Lands locally + per-reaction "share" affordance. Friction-y. | |

**User's choice:** Compounds — attached to party for future replayers (recommended)
**Notes:** Recursive family memory framing.

### Q6: Where does the replay surface live?

| Option | Description | Selected |
|--------|-------------|----------|
| Variant of live modal | Reuse #wp-live-modal-bg / #wp-live-content. wp.status === 'archived' + replay flag → replay variant. | ✓ |
| New dedicated screen | Own route + chrome. More design freedom; doubles surface area. | |
| You decide | Defer to research/planning. | |

**User's choice:** Variant of live modal (recommended)
**Notes:** Brand-restraint + reuses Phase 24 player surface for archived wp.videoUrl playback.

### Q7: When a replayer reacts to an archived party, should ORIGINAL party members get a push?

| Option | Description | Selected |
|--------|-------------|----------|
| No push — silent compound | Reaction lands in wp.reactions; no notification. Avoids intrusive pings on shows from weeks ago. | ✓ |
| Push to original members, opt-in (default off) | New eventType 'reactionInReplay'; default OFF Settings toggle. | |
| Push to original members, opt-in (default on) | Same with default ON. Stronger "watching together" signal but risks intrusive feel. | |
| You decide | Defer to research/planning. | |

**User's choice:** No push — silent compound (recommended)
**Notes:** Single-repo Phase 26 deploy. No queuenight CF work. Reinforces Phase 24 silent-UX preference.

---

## Replay entry point

### Q8: Where should users discover and enter replay mode? (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Past parties surface (extend 15.5) | Extend Tonight-tab Past parties from 25h to all-time. | (covered by Both) |
| Title detail "Past watchparties" section | Contextual section on title detail view. | (covered by Both) |
| Both — Past parties + title detail | Maximizes discoverability; two surfaces sharing same replay-modal target. | ✓ |
| New top-level surface (Memories tab) | Dedicated nav surface. Overkill for v2.0. | |

**User's choice:** Both — Past parties + title detail (recommended)
**Notes:** Single replay-modal target; two entry paths.

### Q9: How far back should the Past parties surface look once it's the replay entry point?

| Option | Description | Selected |
|--------|-------------|----------|
| All-time, paginated | All archived parties; most recent N + "show older" affordance. Bounded reads per session. | ✓ |
| Last 90 days only | Cap at 90 days; older parties drop off list (still queryable from title detail). | |
| All-time, no pagination | Render everything. Bad scaling for active families. | |
| You decide | Defer to research/planning. | |

**User's choice:** All-time, paginated (recommended)
**Notes:** Page size to be picked by researcher (default leaning 20).

### Q10: What happens when an archived party has ZERO reactions with runtimePositionMs?

| Option | Description | Selected |
|--------|-------------|----------|
| Hide from Past parties list | Filter out parties with no replay-able reactions. Honest framing; aligns with Phase 24 silent-UX. | ✓ |
| Show with "no reactions to replay" state | Greyed treatment + tooltip; replay opens but shows wall-clock-only. Dead-end UX. | |
| Show with reaction count badge instead | Show all parties; show "N reactions" badge; replay shows wall-clock list. | |

**User's choice:** Hide from Past parties list (recommended)
**Notes:** Combined with D-11 below, this means existing family's pre-Phase-26 parties are invisible.

---

## Retroactive migration

### Q11: Should pre-Phase-26 reactions be backfilled with runtimePositionMs from their existing elapsedMs?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — backfill all | One-time client-side migration: runtimePositionMs = elapsedMs, runtimeSource = 'elapsed-backfilled'. Family history stays alive. | |
| No — leave them invisible | Pre-Phase-26 reactions stay wall-clock-only; their parties hidden from Past parties (per Q10). Clean Phase 26 demarcation. | ✓ |
| Backfill only when player was attached (post-Phase-24) | Only migrate parties with wp.currentTimeMs in schema. Mid-ground. | |
| You decide | Defer to research/planning. | |

**User's choice:** No — leave them invisible (NOT recommended — user chose against)
**Notes:** Strong preference signal: clean semantics over data preservation. The elapsedMs proxy is judged not trustworthy enough to claim as runtimePositionMs. Past parties surface starts empty on deploy day for the existing family; populates with new parties going forward. Planner must NOT propose opt-in recovery affordances or migration helpers — explicitly out of scope.

---

## Claude's Discretion (areas user did not lock)

- Drift tolerance for replay reaction matching (±2s default leaning per seed)
- Scrubber granularity (1-sec snap; range source priority TMDB → wp.durationMs → max observed)
- Replay modal copy + state banner
- Past parties pagination size
- Title-detail section design (placement, sort order, empty state)
- Wait Up × replay interaction (default leaning: Wait Up irrelevant in replay)
- Auto-play of wp.videoUrl in replay modal (default: render but don't auto-start)
- Replay-mode reaction runtimeSource value (planner finalizes — possibly 'replay')
- runtimeSource enum closure (3 vs 4 values)
- Smoke contract assertions for scripts/smoke-position-anchored-reactions.cjs

## Deferred Ideas

- Replay-reactions push (eventType 'reactionInReplay') — v2.1+ if demand surfaces
- Backfill of pre-Phase-26 reactions — explicitly rejected; not "later", just NO
- Manual scrubber on LIVE modal for DRM parties — follow-up phase if elapsedMs proxy proves insufficient
- Multi-episode bingeable parties — out of scope per seed
- Standalone "Memories" top-level surface — v2.1+ if usage proves intent
- Visual differentiation of runtimeSource in replay UX — v2.1+ polish
- Sub-second sync / perfect drift accuracy — out of scope per seed
