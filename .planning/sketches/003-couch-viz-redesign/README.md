---
sketch: 003
name: couch-viz-redesign
question: "How should the 'Who's on the couch tonight?' control work, given it must serve both proxy-fill (one operator marks family in) AND self-claim/remote-ping (each member taps in)?"
winner: "5"
winner_name: "Roster IS the control"
locked_at: 2026-04-26T18:30:00Z
tags: [hero, couch-viz, decision-ritual, dual-mode, redesign]
---

# Sketch 003: Couch Viz Redesign

## Design Question

How should the "Who's on the couch tonight?" control work on the Tonight tab, given it must serve **both** usage modes natively (no special "proxy mode" toggle) AND avoid the current Phase 14-04 sloppiness (7 dashed `+` placeholders stretching across desktop)?

## What we're rethinking

Phase 14-04 currently ships a `couchSize = max(2, totalMembers, claimedCount)` grid capped at 10 cells. On a typical 8-member family with 1 claim, this produces 1 filled member-color circle followed by 7 dashed-amber `+` placeholders that stretch to the right edge of the desktop viewport. User reported the surface feels "sloppy," "cluttered," and asked for something "streamlined like Apple did it."

Mid-sketch the user added the dual-mode requirement: the surface needs to handle BOTH the home-tonight scenario (one person filling in family who are physically on the couch but haven't tapped in) AND the remote-ping scenario (one person at work watching the couch fill up as friends/family tap themselves in). Both flows must feel native — no separate "proxy mode" toggle.

## How to View

```
open .planning/sketches/003-couch-viz-redesign/index.html
```

Or open any single variant directly:

```
open .planning/sketches/003-couch-viz-redesign/variant-1-density.html
open .planning/sketches/003-couch-viz-redesign/variant-2-filled-only.html
open .planning/sketches/003-couch-viz-redesign/variant-3-single-cta.html
open .planning/sketches/003-couch-viz-redesign/variant-4-hybrid.html
open .planning/sketches/003-couch-viz-redesign/variant-5-roster-control.html
```

Each file has 3 state buttons at the top (`0 in` / `Me only` / `4 of 8 in`) — flip between them to see the surface in each occupancy state. All interactions are wired (tap, hover, long-press) so you can feel them, not just see static screenshots.

## Variants

### A — Density (Slack-stack)
Roster renders as overlapping mini-avatars. Out-state members are dimmed/grayscaled in place; in-state members are full color and slightly elevated. Tap any avatar to flip in/out. One CTA below ("Find a seat" / "Send pushes").

**Best for:** Visual compactness. No empty placeholders ever. Roster always visible at a glance.
**Worst for:** Loses the visceral "claim a cushion" interaction the original Phase 14-04 viz was built around.

### B — Filled-only + Invite cell
Only claimed seats render as full member-color circles labeled with name. ONE trailing dashed `+` cell labeled "INVITE" that opens a sheet. Sheet has the full roster as tappable rows — multi-select, then "Done" to commit. Vacate via × on hover over your seat.

**Best for:** Preserves the "row of seats" metaphor. Empty state is a single pulsing `+` (still feels visceral). Sheet handles bulk-fill cleanly.
**Worst for:** Two-tap to seat someone (open sheet → tap row → done). Heavier than V1's single-tap-per-member.

### C — Single CTA
Hero icon + Fraunces headline + ONE big pill button that flips between "Find a seat" / "Leave couch" based on me-state. Below: thin row of micro-avatars (32px) for awareness, tappable for proxy-toggle.

**Best for:** Maximum restraint. Most "Apple Health" feel. Self-claim is one tap, no decoration.
**Worst for:** Proxy-fill — micro-avatars at 32px are tap-target-marginal on touch. Roster is de-emphasized as input, which de-prioritizes the proxy use case.

### D — Hybrid (phone vs desktop)
Phone (≤767px): tightened 5-col grid, capped at filled+1 cells (no scroll, no clutter). Desktop (≥768px): falls back to Variant 3's single-CTA layout because rows of empty cells look worst on wide screens.

**Best for:** Each viewport gets the right metaphor. Phone keeps direct manipulation, desktop gets restraint.
**Worst for:** Two mental models the user has to learn. Implementation cost (two parallel layouts to maintain).

### E — Roster IS the control ★ proposed direction
Each family member is a toggleable pill (avatar + name). Default state = "out" (dim, dashed outline, ghost initial). Tap = "in" (member-color filled, bright initial). Long-press an out-pill (held 700ms with a progress underline) = send push to that member. Hero shows: count line ("3 of 8 watching"), a "Mark everyone in" / "Clear couch" / "Send pushes to the rest" action row.

**Best for:** All three modes (self-claim / proxy-fill / remote-ping) are native to the same gesture vocabulary — no mode switch. Direct manipulation on real domain objects (people), not abstract intermediaries (seats). Empty state is a roster of dashed pills, which actually communicates "your family" rather than "8 fake seats."
**Worst for:** Drops the "couch capacity" metaphor entirely. Larger DOM footprint than Variant 3. The "couchSeating: { [memberId]: index }" Firestore shape becomes a per-member bool + timestamp instead of an indexed array — small data model migration.

## What to Look For

- **Open all 5 in tabs and flip the state toggle (`0 in` / `Me only` / `4 of 8 in`) on each.** Empty state and full state matter as much as the typical 1-of-N case.
- **Try all three interactions per variant** — tap your own avatar, tap someone else's, look for vacate UX.
- **On Variant 5, hold-press an out-state pill for 700ms** to feel the long-press → ping interaction. The progress underline gives haptic-like feedback.
- **Resize the browser** (especially with Variant 4) to see how each handles the desktop-wide-empty-space problem the original 14-04 hit.
- **Check the dual-mode mental model.** When you imagine "I'm at work pinging my family," which UI feels like it was designed for that vs which feels like proxy-fill is a power-user move?

## Side-by-side comparison

| Criterion | V1 Density | V2 Filled+Invite | V3 Single CTA | V4 Hybrid | V5 Roster ★ |
|---|---|---|---|---|---|
| **Self-claim** | ✓ 1 tap | ✓ 1 tap | ✓ 1 tap | ✓ 1 tap | ✓ 1 tap |
| **Proxy-fill** | ✓ 1 tap each | ⚠ 2 taps via sheet | ⚠ Small tap targets | ⚠ Phone only | ✓ 1 tap each |
| **Remote ping** | ⚠ Long-press hidden | ✓ Sheet-native | ✓ Text link | ✓ Text link | ✓ Long-press + link |
| **Empty placeholders** | ✓ None | ✓ None (1 invite cell) | ✓ None | ⚠ filled+1 on phone | ✓ None |
| **Visual restraint** | High | High | Highest | Med | High |
| **Per-cushion metaphor** | ✗ Lost | ✓ Kept | ✗ Lost | ✓ Phone only | N/A — replaced |
| **Roadmap-fit (Flow A picker, push notifs)** | ✓ Stack stays compact below | ✓ Stack stays compact | ⚠ Roster-line cramped | ⚠ Two layouts wire | ✓ Pills carry into Flow A roster screen unchanged |
| **Implementation churn vs current 14-04** | Med | Med-High | Low | High | Med (but simpler than current) |

## Recommendation

**Variant 5 (Roster IS the control)** best handles the dual-mode constraint because it makes the family roster — not abstract seats — the primary input surface. Both proxy-fill and self-claim become the same gesture (tap a pill); remote-ping becomes a discoverable variant of that gesture (long-press). No mode switch, no special UI for "I'm filling in for the family" vs "I'm tapping myself in." The whole interaction is symmetric.

The trade is dropping the "couch capacity" metaphor (no more "X of N seats") and migrating the Firestore data shape from `couchSeating: { [memberId]: index }` (positional) to `couchInTonight: { [memberId]: { in: bool, at: timestamp } }` (member-keyed). That's a small migration with a clear win: the new shape has built-in audit trail (proxyConfirmedBy), real-time deltas, and TTL-friendly cleanup.

**If Variant 5 feels too radical** — Variant 2 (Filled-only + Invite) is the next-best dual-mode candidate. It keeps the per-cushion metaphor but kills the placeholder pollution. Slightly higher tap cost for proxy-fill (sheet round-trip) but easier to ship as an incremental change to the existing 14-04 code.

## Implementation Notes (whichever variant wins)

- **Always-fix in any variant:** Bug A — remove legacy `.who-card` from `app.html:334-337` (Phase 11 pill rail still rendering below new viz). Bug B — add `renderFlowAEntry()` call inside the family-doc onSnapshot at `js/app.js:4144` so the empty-state CTA re-renders when claims land.
- **For V5 specifically:** Migration path — keep `couchSeating` Firestore field for one release for backward-compat read, write the new `couchInTonight` shape, drop legacy field after one full PWA cache cycle.
- **For V2/V5:** Vacate UX needs to be obvious. The current implementation lets you tap your own claimed cell to vacate but with no visual hint — V2 adds a hover × button, V5 makes the pill itself toggle.

## Open Questions

- Does V5 work for **non-family** modes (crew, duo)? Yes — the roster is the source of truth in all modes; just fewer pills.
- What about families with 12+ members? V5 wraps cleanly. V1 stack starts overlapping past ~6 avatars but that's still readable. V2 row scrolls horizontally on phone if needed. V3 micro-row gets cramped past 10 (would need to add a "+N more" overflow chip).
- Per-pill long-press on V5 — does iOS Safari fire `touchstart` reliably to power the 700ms timer? Yes, but with a `passive: true` listener so it doesn't block scroll. Verified this pattern in production already (Sortable.js fallback in 14-02).

## Status

**SHIPPED 2026-04-26** via Phase 14 Plan 10 (gap-closure plan after UAT identified 3 issues converging on this redesign). Production surface in `js/app.js` renderCouchViz + `css/app.css` .pill rules + `app.html` #couch-viz-container. Migration: `families/{code}.couchSeating` (positional) → `families/{code}.couchInTonight` (member-keyed); dual-write for one PWA cache cycle; legacy field will be dropped in a follow-up plan. Deploy bundled with v34.1 cross-repo deploy gate.
