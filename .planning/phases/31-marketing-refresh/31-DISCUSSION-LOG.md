# Phase 31: Marketing refresh — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `31-CONTEXT.md` — this log preserves the alternatives considered.

**Date:** 2026-05-06
**Phase:** 31-marketing-refresh
**Mode:** `/gsd-discuss-phase 31 --auto` (single-pass, recommended-defaults locked)
**Areas auto-resolved:** FAQ depth · og.png treatment · Comparison breadth · Pick'em screenshot · Features-headline trust line · Sentry analytics

---

## Context preceding this discussion

A 21-decision CONTEXT.md (D-01..D-21) was produced 2026-05-05 during the LAUNCH-REVIEW session. That doc covered: section ordering on landing.html, screenshot capture rig, comparison voice, features voice, FAQ structure, og.png composition, cache + deploy. The remaining open items lived in a "Claude's Discretion" subsection — six gray areas where the author wanted plan-phase to call it.

This `--auto` pass closes those six. Recommended defaults (first/recommended option for each) were selected. Each is logged below with the alternatives that were considered but not chosen.

---

## FAQ depth

| Option | Description | Selected |
|--------|-------------|----------|
| 7 questions | Per LAUNCH-REVIEW §3 fix 6 — log-in / Grandma / streaming services / cost / devices / data / vs-Teleparty | ✓ |
| 5 questions | Tighter scan; drops the streaming-services + vs-Teleparty entries | |
| 5 + legal-disclaimer block | 5 above + 2 disclaimer-style "What about my data?" / "Can I delete my account?" | |

**Resolution:** D-22 — 7 questions per LAUNCH-REVIEW spec. Legal-disclaimer questions belong on `/privacy` + `/terms`, not landing FAQ.

---

## og.png treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Refresh entirely | New 1200×630 leather-textured background, hero text matching new positioning, source SVG kept under `brand/og-source.svg` | ✓ |
| Refine text overlay only | Keep existing image; update overlay text to match new positioning | |

**Resolution:** D-23 — full refresh. The existing og.png is a pre-Phase-9 placeholder; partial refinement carries that history.

---

## Comparison-section breadth

| Option | Description | Selected |
|--------|-------------|----------|
| 3 blocks (JustWatch/Reelgood, Letterboxd/Trakt, Teleparty/Scener/Plex) | Per LAUNCH-REVIEW §3 fix 2 | |
| 4 blocks — add Apple SharePlay / FaceTime SharePlay / Microsoft Teams Together Mode | Cross-AI brief §5 Q12 flagged these as missing | ✓ |
| Keep 3, defer the 4th to a post-launch update | Conservative; lets initial copy land before adding scope | |

**Resolution:** D-24 — 4 blocks. Pre-emptively closes the cross-AI brief gap rather than deferring; the ecosystem-locked-vs-cross-platform framing is concrete and doesn't bloat the section.

---

## Pick'em screenshot inclusion

| Option | Description | Selected |
|--------|-------------|----------|
| 5 screenshots, Pick'em as 5th | Pick'em is launch-defining per LAUNCH-REVIEW §1; matches §5 4-beat hierarchy | ✓ |
| 4 screenshots, Pick'em hidden until in-app discovery | Preserves family-brand purity per cross-AI brief Q4 counter-argument | |

**Resolution:** D-25 — 5 screenshots including Pick'em. The risk of family-brand dilution is real but the "make it a competition" beat in §5 is a documented part of the positioning hierarchy. Pick'em-with-no-money is allowed under App Store §5.3.4 (cross-AI brief Q7 worth confirming with reviewers but not blocking).

---

## "What's actually in it" headline trust line

| Option | Description | Selected |
|--------|-------------|----------|
| Plain: *"What's actually in it"* | Trust signal already carried by `.hero-trust` line above | ✓ |
| With repetition: *"What's actually in it (free)"* | Repeats free-trust signal closer to features | |

**Resolution:** D-26 — plain. BRAND.md restraint principle; repetition dilutes.

---

## Sentry analytics on FAQ open

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — breadcrumb on each `<details>` toggle | `marketing.faq.opened` with `{ question_index }` payload; informs Phase 17 App Store description ordering | ✓ |
| No — keep marketing surface zero-analytics | Privacy purity; rely on conversion-rate signal alone | |
| Yes but coarser — single boolean "user opened any FAQ" | Less data, simpler implementation | |

**Resolution:** D-27 — full per-question breadcrumbs. The signal informs Phase 17 description ordering (which questions matter most to visitors), and Sentry's existing PII-strip block (`landing.html:67-101`) ensures no leak risk.

---

## Claude's Discretion (still open at planning time)

These were intentionally left for the planner — recommended defaults were not auto-locked:

- Whether the 4th comparison block (D-24) is parallel `<h3>` or denser inline-list at the end of the existing 3-block list. Plan-phase decides on visual rhythm.
- Exact CSS class names for the new sections (`.compare-*` / `.feature-block` / `.faq-*`).
- `loading="lazy"` on the Pick'em screenshot (5th = below-fold default-load probability).
- og.png cache-bust mechanism (`?v=2` query string vs filename versioning).

## Deferred Ideas

Captured in `31-CONTEXT.md` `<deferred>` section. Highlights:
- Phase 17: privacy.html / terms.html content, App Preview video, Apple Sign-In, Couch Tonight name decision, Capacitor vs PWABuilder spike.
- Post-launch signal-driven: marketing analytics, solo mode, Year-in-Review, audience-card re-additions.

## Auto-mode summary

Six discretionary items resolved in a single pass per the workflow's `--auto` pass-cap rule. No subagents spawned. No web searches. No cross-AI questions surfaced — the cross-AI brief (Step 1) handles that channel separately.

Next step authorized by user: `/gsd-spike` for Capacitor vs PWABuilder (Phase 17 prep). Phase 31 plan-phase intentionally not auto-advanced — user wants spike + UAT runbook before sinking planner cycles.

---

*End of log. Source-of-truth doc: `.planning/LAUNCH-REVIEW-2026-05-05.md`. Decisions index: `31-CONTEXT.md`.*
