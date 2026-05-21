---
phase: 07-watchparty
plan: 03
subsystem: watchparty-reactions
tags: [reactions, emoji, picker, participant-timer, watchparty, ui, css]

# Dependency graph
requires:
  - phase: 07-watchparty
    provides: "Plan 07-01 lifecycle + lastActivityAt bookkeeping (sendReaction includes lastActivityAt: Date.now())"
  - phase: 07-watchparty
    provides: "Existing wp.reactions[] array + arrayUnion write path + watchparties onSnapshot"
provides:
  - "Locked 8-emoji reaction palette (laugh / shock / love / chill / sad / cheer / silence / sleep) + 9th '+' cell opening native iOS emoji keyboard"
  - "Hidden-input grapheme-cluster-safe emoji picker (Intl.Segmenter) — no JS emoji-picker library, preserves single-file-no-bundler constraint"
  - "Participant timer strip in wp-live modal — chips show name + avatar + elapsed-min status ('Just joined' / 'X min in' / 'Paused')"
  - "Innerhtml compare-before-assign re-render guard — prevents flicker when watchparties onSnapshot ticks"
affects: [07-06-render-path-gap, 07-07-reaction-delay, 07-08-on-time-inference]

# Tech tracking
tech-stack:
  added:
    - "Intl.Segmenter — for grapheme-cluster-safe first-char extraction from native iOS emoji input (handles multi-codepoint emoji that combine multiple base codepoints with U+200D ZWJ joiners, e.g. family or profession glyphs)"
  patterns:
    - "Hidden-input focus trick for native iOS emoji keyboard: a fixed off-screen <input> receives focus → native keyboard opens → user taps globe to switch to emoji tab → oninput fires with typed char → Intl.Segmenter extracts first grapheme cluster → sendReaction(char). No JS picker library required."
    - "Advisory per-member timer pattern (D-01): each participant tracks own elapsedMs + reactionsMode, no host-broadcast. Reactions are timestamped against the reacter's own elapsed time, comparable across drift."

key-files:
  created: []
  modified:
    - "js/app.js — REACTION_PALETTE const (8 emoji), openEmojiPicker function, renderParticipantTimerStrip function"
    - "index.html — hidden <input id='wp-emoji-input'> at root for native picker focus target (later renamed app.html post-09-05)"
    - "css/app.css — .wp-reaction-btn (44x44 thumb-friendly per iOS HIG) + .wp-reaction-more + .wp-participants-strip (flex overflow-x:auto) + .wp-participant-chip / -av / -info / -name / -time + .paused dimming state"

key-decisions:
  - "8-emoji palette locked (D-13 in 07-CONTEXT.md): 😂 😱 ❤️ 😎 😭 🎉 🤫 😴 — Claude's discretion picked the mix to cover laugh/shock/love/chill/sad/cheer/silence/sleep. v1 not user-configurable."
  - "Native iOS picker over JS emoji-picker library — no bundler, preserves CLAUDE.md single-file-no-bundler constraint. iOS users get familiar keyboard; system remembers last-used keyboard tab."
  - "Reactions timestamped against the reacter's own elapsedMs (D-03) — Alice reacts 🔥 at her 23:10; Bob sees 'Alice reacted at 23:10' regardless of where Bob is. Feels right for advisory-timer; reactions are always comparable."
  - "writeAttribution() helper used for reactions (D-15) — Phase 5 attribution stamping. Self-echo suppression NOT applied client-side (reactions are fun to see your own pop up)."
  - "innerHTML compare-before-assign in wp-live snapshot handler — prevents flicker when watchparties onSnapshot ticks but reaction payload is unchanged."

patterns-established:
  - "Curated-palette + native-fallback pattern: lock the small thumb-reachable set (8 cells) and expose unlimited variety via a '+' cell that opens the system picker. Single-file constraint preserved."
  - "Grapheme-cluster-safe first-char extraction: `Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(val))[0]?.segment` — handles multi-codepoint emoji + ZWJ sequences correctly."
  - "Advisory-timer participant chip rendering: name + avatar (member-color initial) + elapsed-min status string. Chip has 'paused' dim state via CSS class."

requirements_completed: [PARTY-03, PARTY-04, PARTY-05]
verifier_method: retroactive_backfill_phase_15.2

# Metrics
duration: ~unknown (autonomous run; commit 544fcf5 follows febdc8a closely)
completed: 2026-04-22
---

# Plan 07-03 — Reaction Palette + Advisory Per-Member Timer Strip

**PARTY-04 + PARTY-05: locked 8-emoji reaction palette + 9th `+` cell opens native iOS emoji keyboard via hidden-input focus trick (Intl.Segmenter for grapheme-cluster-safe first-char extraction). PARTY-03: advisory per-member timer strip in wp-live modal — chips show each participant's elapsed-minute status with paused/just-joined/X-min-in copy. innerHTML compare-before-assign prevents snapshot-tick flicker.**

## What landed

- **Reaction palette:** `const REACTION_PALETTE = ['😂', '😱', '❤️', '😎', '😭', '🎉', '🤫', '😴']` — covering laugh / shock / love / chill / sad / cheer / silence / sleep. Rendered as `.wp-reaction-palette` flex row with 8 cells + a 9th `.wp-reaction-more` cell labeled `+`.
- **`openEmojiPicker()`:** Focuses the hidden `<input id="wp-emoji-input">` (fixed off-screen, opacity:0, aria-hidden). iOS native keyboard opens. User taps globe to switch to emoji tab (system remembers thereafter). `oninput` extracts the first grapheme cluster via `Array.from(new Intl.Segmenter('en', { granularity: 'grapheme' }).segment(val))[0]?.segment` — handles multi-codepoint emoji (ZWJ sequences such as family/profession glyphs that combine multiple base codepoints with U+200D joiners). Calls `sendReaction(char)` via the existing palette path. Clears + blurs input.
- **`renderParticipantTimerStrip(wp)`:** One chip per participant in `wp.participants`. Each chip shows:
  - **Avatar:** 24x24 circle with member-color background + first-letter initial
  - **Name:** member name (resolved from `state.members` if available, else `p.memberName`)
  - **Time:** "Paused" (if `pausedAt`), "Just joined" (if elapsed === 0), or "X min in" (rounded floor of elapsedMs / 60000)
  - `.paused` CSS class dims the chip when paused
- **Re-render guard:** wp-live snapshot handler compares rendered innerHTML before assigning — prevents flicker when watchparties onSnapshot ticks with unchanged participant/reaction payload.
- **CSS:** `.wp-reaction-btn` is 44x44 thumb-friendly per iOS HIG. `.wp-participants-strip` is `flex; overflow-x:auto` for scrollable horizontal chip rows. Warm-cinematic palette per design system.

## Commits

- **`544fcf5`** — `feat(07-03): emoji '+more' picker + advisory per-member timer strip (PARTY-03/04/05)`

Note: an earlier `899cc49` commit recorded the picker decision in 07-CONTEXT.md + seeded `phase-9x-gif-reactions.md`. The `+more` was scoped here for v1; GIF reactions deferred.

## Smoke tests

What was tested at the static + UAT level:

1. `sendReaction` write path uses `arrayUnion` + `...writeAttribution()` + includes `lastActivityAt: Date.now()` (from Plan 07-01)
2. wp-live modal renderer subscribes to the watchparty doc via `state.unsubWatchparties` onSnapshot
3. Existing Sports Watchparty session can still send reactions without error (regression-safe)
4. UAT Scenario 4 (PASS): emoji `+` more picker → native iOS keyboard → 🥹 selected → reaction posts and appears in feed; multi-codepoint emoji extraction confirmed
5. UAT Scenario 5 (PASS): participant timer strip renders one chip per participant with name + elapsed-min; self-highlight border visible; numbers advance per minute
6. UAT Scenario 6 (PASS): reactions real-time cross-device <2s, no drops on rapid-fire (post-fix verification with commits 14e959a + ce3c507 — see Reconstruction note)

## Must-haves checklist

- [x] Reaction palette: 8 curated emoji covering laugh / shock / love / chill / sad / cheer / silence / sleep
- [x] A '+ more' button opens iOS native emoji keyboard (via hidden-input focus trick); user-picked emoji goes through the same sendReaction path
- [x] Any emoji typed from the native picker is treated identically to a palette emoji — stored as a string, no type discriminator
- [x] Reactions propagate to other devices within 2s via the existing onSnapshot on watchparty doc — verified live (post-fix)
- [x] Live modal shows each participant's current elapsedMs (advisory per-member timer — PARTY-03 D-01) with a pause badge when paused
- [x] Participant-timer display updates on every snapshot without flicker (innerHTML compare-before-assign pattern)
- [x] No regression on existing Sports Watchparty reaction behavior

## What this enables

- **Plan 07-04 UAT (Scenarios 4-6):** All passed end-to-end — picker, strip, real-time reactions.
- **Plan 07-06 (gap-closure):** `renderReactionsFeed` modeOverride pattern + late-joiner backlog branch build on the rendering shape this plan introduced.
- **Plan 07-07 (gap-closure):** Reaction-delay feature builds on the elapsed-vs-wallclock filter contract this plan formalized.
- **Plan 07-08 (gap-closure):** `effectiveStartFor` overrides + late-joiner manual on-time toggle build on the participant-chip rendering this plan introduced.
- **PARTY-03 ✓ 2026-04-22 in REQUIREMENTS.md** — this plan + 07-08 fully delivered the advisory-per-member-timer + on-time inference + manual override.

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 07-03 shipped 2026-04-22 — only the 4 gap-closure plans (07-05..08) got proper SUMMARYs at the time. The v33.3 milestone audit YAML (`.planning/v33.3-MILESTONE-AUDIT.md` lines 51-102) identified the gap as "PARTY-05: orphaned + PARTY-04/03 partial — 07-03-SUMMARY.md absent." Evidence sources used for this reconstruction:

- `07-03-PLAN.md` (must_haves checklist + interfaces sketch with palette, openEmojiPicker, renderParticipantTimerStrip code shapes)
- `07-CONTEXT.md` (locked decisions D-01/D-03/D-13/D-14/D-15 for sync model + palette + reaction attribution)
- `07-04-UAT-RESULTS.md` Scenarios 4 + 5 + 6 (PASS — picker, strip, reactions real-time)
- Existing `07-06-SUMMARY.md` (references the modeOverride param this plan's `renderReactionsFeed` introduced)
- Production-live state at couchtonight.app/app (live wp modal renders palette + strip in the production bundle)
- Cross-cutting in-session fixes during 07-04 UAT: commits `14e959a` (renderWatchpartyLive snapshot wiring) + `ce3c507` (wallclock filter) — pre-existing bugs surfaced + closed in the same UAT session, not introduced by 07-03
- v33.3 audit YAML evidence blocks for PARTY-03 + PARTY-04 + PARTY-05 (lines 68-95)

---

_Phase: 07-watchparty_
_Plan: 03_
_Completed: 2026-04-22_
_Reconstructed: 2026-04-27 by Phase 15.2-03 (retroactive_backfill_phase_15.2)_
