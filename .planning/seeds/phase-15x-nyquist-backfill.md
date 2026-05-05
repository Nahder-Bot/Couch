---
seeded: 2026-04-28
target-phase: post-v1 (no fixed phase number; whatever slot the milestone-2 cycle assigns)
trigger: "v33.3 milestone audit (2026-04-27) — surfaced that Nyquist VALIDATION.md framework was adopted late (Phase 15.1 first compliant phase; Phase 03 partial draft; Phases 4-13 missing entirely). User decision recorded in `Phase 15.2 / 15.3 / 15.4 inserted: 2026-04-27` ROADMAP footnote: accepting Nyquist tooling tech-debt for v1; framework applies going forward only. This seed parks the back-fill so it isn't silently lost."
related: [v33.3-MILESTONE-AUDIT.md, phases/15.1-security-hardening/15.1-VALIDATION.md, phases/03-mood-tags/03-VALIDATION.md]
status: deferred
---

# Post-v1 seed — Nyquist VALIDATION.md back-fill for Phases 4-15

## Why this is parked, not abandoned

The v33.3 milestone audit (2026-04-27) scored Nyquist coverage as **1 of 15 phases compliant** (Phase 15.1 only; Phase 03 has a `status: draft, nyquist_compliant: false` partial; Phases 04-15 are missing entirely). The framework was adopted at the end of the v1 milestone, not back-applied during the Auth/Push/Watchparty/Intent/Redesign sprint when most phases shipped.

The user explicitly chose deferral over back-fill on 2026-04-27 — back-filling 10+ phases of VALIDATION.md retroactively is multi-day work, and v1 is launch-priority. The ROADMAP footnote initially read *"Phase 15.5 Nyquist back-fill DEFERRED"* which committed the work to a numeric slot that was later needed for other scope (Wait Up flex / Queue UX). Promoting the parking-lot to this seed (2026-04-28) freed the 15.5 slot without losing the scope.

## What back-fill would entail

For each of Phases 04, 05, 06, 07, 08, 09, 10, 11, 12, 13, 14, 15 (Phase 03 has a partial draft already):

1. Read each phase's existing PLAN.md set + SUMMARY.md set + VERIFICATION.md (now backfilled by Phase 15.2).
2. Author a `<phase>-VALIDATION.md` per the Nyquist framework conventions (see `phases/15.1-security-hardening/15.1-VALIDATION.md` as the canonical example).
3. Mark `nyquist_compliant: true` in frontmatter once acceptance criteria are met.
4. Cross-reference VALIDATION.md against REQUIREMENTS.md acceptance gates.

## Triggers to revive

Promote this seed back to a real phase when one of these is true:

- **Milestone 2 cycle begins** and the Nyquist framework is part of milestone-2 quality gates
- **External audit / compliance request** requires retroactive validation coverage for v1 phases
- **A new milestone-1 phase fails verification** because of a missing Nyquist anchor that the back-fill would have provided

## Not-goals

- Back-filling Phases 1-2 (shipped pre-GSD, no plans/summaries to anchor against)
- Promoting Nyquist to *blocking* on v1 — explicit user decision was forward-only
- Combining with the Phase 15.2 audit-trail backfill — that phase explicitly excluded Nyquist (see `phases/15.2-audit-trail-backfill/15.2-RESEARCH.md` Pitfall 5)
