# Phase roadmap audit — post-Phase-11 ship + Phase 12 activation

**Audited:** 2026-04-25
**Trigger:** User asked "what about Phase 12, and what should we be doing that we aren't"
**Status:** Recommendations — user reviews + commits to ladder before formalizing

## The ladder (recommended sequence)

| Phase | Theme | Status | Notes |
|-------|-------|--------|-------|
| 3-9, 11 | v1 feature buildout | ✓ Shipped | Phases 3, 4, 5, 7, 8, 9, 11 all live; Phase 6 push code-deployed + 3-day stable |
| 10 | Year-in-Review | ⏸ DEFERRED post-launch | Needs accumulated watch history + audience to feel substantive |
| **12** | **Pre-launch polish** | **▶ ACTIVE** | POL-01 notif prefs UI / POL-02 about+changelog / POL-03 pack curation / POL-04 stretch — ~1 day |
| 13 | Decision ritual core | Scoped, awaiting kickoff | Couch viz + tile redesign + Flow A + Flow B + watchpartyIntent — see seeds/phase-13-14-15-decision-ritual-locked-scope.md |
| 14 | Tracking layer | Scoped, awaiting kickoff | Per-group progress + season notifs + live-release scheduling |
| 15 | Calendar layer | Scoped, awaiting kickoff | Recurring watchparties + week-view planning surface |
| 16 | App Store launch readiness | **NEW PROPOSAL** | Native wrapper + legal + Apple Sign-In + App Store Connect — gated on $99 Apple Dev account |
| 17 | Post-PMF infrastructure | **NEW PROPOSAL** | Observability + analytics + cost optimization + Twilio (signal-gated) |

## Items dropped from "deferred backlog" tracking

### Now obsoleted by Phase 11 ship

- F-NEW-3 Recent watchparties drilldown — REFR-09 photo upload + REFR-11 Couch history covers it
- 2 missing curated discovery rows — 33 is enough; engine proven
- F-NEW-2 Couch calendar — covered by Phase 15

### Folded into Phase 13/14/15 scope

- Per-user availability-aware ballot filtering — Phase 13 tier filter
- Async-first nominate flow — Phase 13 Flow B
- Availability-aware invitations ("who's free Sat 9pm?") — Phase 13 Flow B + Phase 15 calendar
- Post-watch reaction capture feeding ballot weight — Phase 13 watchpartyIntent + Phase 14 tracking
- Phase 7 watchparty lifecycle transitions seed — Phase 11 REFR-07 + Phase 13 intent primitive
- phase-10x-availability-notifications.md — Phase 14
- phase-10x-star-ratings-reviews.md — Phase 13 + Phase 14

## Items still valid — held in seeds/

### Bucket A: Ship-next-after-Phase-12 (high signal-to-effort)

- **A-NEW-2 Privacy / data controls** (export + delete) — Phase 16 (App Store launch). Apple/Google require this.
- **A-NEW-3 Theme / display preferences** (font-size + reduced-motion override) — Phase 16 or stretch into 12 if scope allows
- **og.png composite redesign** — bundle with wordmark redesign session

### Bucket B: Wait-for-real-signal (defer until data justifies)

- **Twilio SMS integration** — only if host-share friction is bottlenecking conversion
- **Marketing screenshot refresh** — opportunistic with brand or feature moments
- phase-9x-gif-reactions.md — needs design audit (conflicts with reaction-delay moat)
- phase-9x-solo-mode.md — needs product-direction call (dilutes "plural" brand)
- phase-9x-async-replay.md — v2-class, no signal yet
- phase-10x-custom-lists.md — lower priority unless requested
- phase-11-teen-mode.md — audience expansion post-PMF
- Spoiler-safe group chat — speculative
- Kid-mode ballots — revisit with kid users

### Bucket C: Apple-Sign-In-gated

- phase-05x-apple-signin.md — Phase 16 (gated on $99/yr Apple Dev account)

## What this changes

- **Phase 12 directory** repurposed for pre-launch polish (this audit)
- **Original parking-lot docket** archived to `seeds/phase-12-original-docket-archive-2026-04-23.md` for reference
- **Phase 13/14/15 scope** stays as scoped in `seeds/phase-13-14-15-decision-ritual-locked-scope.md`
- **Phase 16 proposal** emerges from this audit (App Store launch readiness)
- **Phase 17 proposal** emerges from this audit (post-PMF infrastructure)

## Why ladder this way

The constraint is *what's reversible vs what locks you in*. v1 polish (12) is reversible. Decision ritual (13-15) reshapes core UX — bigger commitment, but Couch's product moat. App Store (16) is an external dependency with cost + review delay. Post-PMF infrastructure (17) is gated on having real users producing real signal. So the ladder respects: cheap-and-reversible first, then product moats, then external commitments, then scale.

You can re-order based on priorities you have that I don't see. Two flag-worthy alternates:

- **Push App Store earlier (12 → 16 → 13)** if discoverability is bottlenecking growth more than UX is
- **Push tracking before decision ritual (12 → 14 → 13)** if you want the data layer flowing before the UX consumes it

Both viable. The default I propose follows GSD's existing momentum (decision ritual was already scoped + committed verbally during Phase 11 UAT).
