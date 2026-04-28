---
seeded: 2026-04-21
target-phase: post-v1 OR a dedicated sub-phase whenever Wait Up flex (Phase 15.5) earns its keep in production — NOT Phase 7, NOT Phase 9
trigger: "Phase 7 UAT (2026-04-21, Scenario 3 observation) — user described async-replay use case and banner lifecycle gap. Deferred to avoid expanding Phase 7 scope; both sub-requests require schema + UX changes that warrant dedicated planning. 2026-04-28: re-confirmed as the natural follow-on to Phase 15.5 (Wait Up flex); the 'Red Wedding' hero use case (watch a series years late and feel the original group's reactions) maps directly to Sub-request B below."
related: [phase-07-watchparty-lifecycle-transitions.md, v33.3-MILESTONE-AUDIT.md]
status: deferred
filename-history: "2026-04-21 phase-9x-async-replay.md → 2026-04-28 phase-async-replay.md (dropped numeric prefix per phase-slot safeguard rule — seeds shouldn't claim phase numbers they may not get)"
---

# Seed — Banner dismiss + async-replay watchparty mode

## Why this isn't in Phase 7

Phase 7 shipped live-party lifecycle + reactions + participant strip. What this seed describes are two *adjacent* capabilities the user wants next:

1. **Banner lifecycle UX** — small, could stand alone
2. **Async-replay mode** — larger, changes the reactions data model

Both are out of scope for the Phase 7 gap-closure batch; bundling them would balloon the plan set. They also share a natural home with Phase 9 (Redesign) since both touch Tonight-surface layout + introduce a new "Parties / Replay" surface.

---

## Sub-request A — Banner dismiss / collapse

### Problem

The live-watchparty banner on the Tonight tab renders persistently while a party is active. A family member who isn't interested in joining has no way to hide or minimize it — it "clogs the front." The existing 25h archive window clears it eventually, but that's too coarse for an uninterested viewer in the moment.

### Proposal

- Add a **dismiss / collapse affordance** (× or chevron) on the banner.
- Dismissed state is **per-member, session-scoped** (doesn't persist across PWA restarts — party is still "live," they just chose to hide it right now). Store in `state.uiDismissedParties` (in-memory Set of watchparty ids).
- Collapsed state is a small **pill** at the bottom-right or top-right corner with just title + "Join" — tap to re-expand.
- Alternative: auto-minimize after N minutes of not being tapped (e.g., 10 min) — same pill target.

### Must-stay-reachable requirement

Even when collapsed/dismissed, the party must remain reachable. Options:
1. Persistent pill (as above)
2. A **Parties surface** — dedicated entry point from the top-bar menu or Settings listing all live + recent parties for this family
3. Notifications continue to fire per user prefs (Phase 6)

### Scope estimate

~1 plan, ~60-120 lines of JS. UI state only, no schema change.

---

## Sub-request B — Async watchparty replay

### Problem (in user's words)

> "If someone watches a show the next day they can still join and see everyones actions as they watched it. So you understand my goal is if you watch a show the next day when you are say 25 minutes in you can see what someone else said or typed when they were 25 minutes in so you feel like you were still apart of it."

### The core product idea

Today: reactions are **wall-clock indexed** — `serverTimestamp` captures when the reaction was posted in absolute time.

Proposed: reactions are **runtime-indexed** — also capture `runtimePositionMs` (how far into the movie/episode the poster was when they reacted). This lets a later viewer "replay" the experience aligned to *their* playback position.

A family member watching Dune Part Two the next night could, at the 25:00 mark of their own viewing, see the same reactions that landed when the original party was at 25:00.

### Schema implications

**Reactions today** (inferred shape):
```js
{
  memberId: "uid-abc",
  emoji: "🎉",
  at: serverTimestamp(),  // wall-clock
}
```

**Reactions with replay support:**
```js
{
  memberId: "uid-abc",
  emoji: "🎉",
  at: serverTimestamp(),         // kept for live delivery
  runtimePositionMs: 1500000,    // NEW — 25:00.000 into the title
  runtimeSource: "manual",       // NEW — "manual" | "auto" (future) | "estimated"
}
```

Migration: additive field, no back-compat risk. Old reactions (no `runtimePositionMs`) simply don't appear in replay mode.

### Playback-position source of truth

We almost certainly **cannot** read the external player (Netflix, Prime Video, HBO Max, etc.) — browser sandboxing + DRM prevents it. So the position has to come from the client's local estimate.

**V1 proposal — manual position tracker:**

- Watchparty modal adds a **"I'm at X min"** timeline scrubber (0 → title runtime from TMDB).
- User drags to set position on join. Client then advances position at 1-sec intervals based on `Date.now() - lastScrubAt`.
- **Pause affordance** — if user pauses their TV, they tap Pause in the app and the elapsed-advance stops.
- **Resync affordance** — if app's estimate drifts, user re-scrubs the slider. Drift recovery on every tap.

**Replay mode — same tracker, reactions stream from history:**

- When joining an **archived** party, client shows a "Replay" variant of the modal.
- Instead of `onSnapshot` on live reactions, fetch all reactions for that party ordered by `runtimePositionMs`.
- As user's position advances through the timeline, fade reactions in at their matching `runtimePositionMs` (±2s tolerance).
- Reactions continue to stream live (if user also posts while in replay mode, their new reactions are captured with the viewer's current runtime position — which enables recursive async parties).

### Archive-reachability requirement

Archived parties need a first-class **entry point**:
- From a title detail view: "Past watchparties for this title" → list of archived parties → "Watch in replay mode"
- From a Parties surface: all parties for this family, with status (live / archived), title, date, member count.

### Scope estimate

~3-5 plans:
1. **Runtime-position tracker UI** — timeline scrubber, pause/resync, local runtime state management
2. **`runtimePositionMs` on reactions** — client write path update, CF-side optional-but-don't-validate
3. **Replay-mode modal variant** — archived-party fetch, position-aligned fade-in, styling delta vs live
4. **Archive-reachability surface** — title-detail entry point + Parties surface (may split into 2 plans)
5. **(Maybe) position-aware participant strip** — strip chips in replay mode show where each original participant *was* in runtime when they joined/paused/reacted

---

## Open design questions (resolve at planning time)

1. **Should live parties also expose a timeline scrubber?** Phase 7 doesn't have one today; participants just tap Join and the strip tracks elapsed time. Adding a scrubber to live parties would backfill `runtimePositionMs` for future replay — biggest payoff — but adds UI surface.
2. **What happens when a replay-mode viewer posts a reaction?** Is it visible to anyone else? Options: (a) private-to-replayer, (b) attached to the party for *future* replayers (compounding), (c) compounds + notifies original party members as an async post.
3. **Title runtime data source** — TMDB returns `runtime` for movies and `episode_run_time` for TV. Reliable enough for scrubber bounds. What about multi-episode bingeable parties (S3E1 → S3E2)? Probably out of scope for v1; one-title-per-party constraint is fine.
4. **Drift tolerance** — ±2s feels right but may need tuning. Too tight = reactions feel "missed"; too loose = feels unmoored from viewing.

---

## Dependencies / ordering

- **Phase 7 gap closure first** — Issue #3 (late-joiner backlog) is arguably a *light* version of this same problem (replay for live-late-joiners). Fixing #3 with a full-history subscription may naturally prep the ground for replay mode.
- **Phase 9 design pass** — banner dismiss UX, Parties surface entry point, replay-modal styling — all benefit from the full Phase 9 redesign attention rather than being shimmed in now.

## Not-goals (v1 of this feature)

- Automatic sync with external player (out of reach — DRM-sandboxed)
- Perfect sub-second accuracy (the family use case is "feel like you were there" — ±2s is fine)
- Cross-family parties (v1 stays within the family-code boundary)
- Text comments / chat (reactions only — text threading is a bigger surface)
