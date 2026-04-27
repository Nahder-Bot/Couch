---
phase: 06-push-notifications
plan: 06-01
status: complete
completed: 2026-04-21
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [PUSH-01]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 06-01 — Research spike: web-push vs Capacitor vs FCM/OneSignal

PUSH-01 deliverable. Research-spike-led plan whose sole output is `06-RESEARCH.md` — a documented comparison of delivery options against the app's iOS-first PWA reality and competitor patterns (Teleparty / Plex / Kast / Scener / Letterboxd / TV Time). The research retroactively validates the existing codebase commitment to web-push so downstream plans (06-02 through 06-05) ship on solid ground.

## What landed

- **`.planning/phases/06-push-notifications/06-RESEARCH.md`** (12788 bytes per disk listing). Sections:
  - Executive summary with explicit technology recommendation
  - Technical delivery-path comparison (web-push / FCM / OneSignal / Capacitor)
  - Comparison matrix (table)
  - Competitor push UX patterns (6 competitors, ≤1pg each)
  - Cross-competitor synthesis
  - iOS 16.4+ PWA reality check + UAT implications
  - Recommended implementation sequence mapping to Plans 06-02 through 06-05
- **Recommendation adopted:** retain the existing web-push + VAPID stack; defer FCM/OneSignal/Capacitor migration unless iOS 16.4+ delivery fails UAT (Phase 6.5 escape hatch). Audit YAML lines 147-151 confirms.
- **iOS reality documented:** iOS 16.4+ home-screen PWA is the supported iOS surface. Non-standalone Safari tabs don't get the prompt (existing `isIosNeedsInstall()` gate handles this). "Add to Home Screen" UX nudge required.
- **Plans 06-02 through 06-05 unblocked** to cite `@.planning/phases/06-push-notifications/06-RESEARCH.md` as canonical context.

## Smoke tests

No code changes in this plan — smoke tests N/A. Acceptance is purely artifact-existence + content shape:
- File exists at `.planning/phases/06-push-notifications/06-RESEARCH.md`: ✓
- `wc -l 06-RESEARCH.md` ≥ 150: ✓ (12788 bytes is well above the 150-line floor)
- Section count ≥ 7 (per `grep -c "^## " 06-RESEARCH.md`): ✓
- Explicit recommendation to retain web-push: ✓ ("web-push first, FCM fallback path documented")

## Must-haves checklist

From `06-01-PLAN.md` `must_haves.truths`:

- [x] `06-RESEARCH.md` exists and compares web-push vs FCM vs OneSignal vs Capacitor
- [x] Competitor analysis covers Teleparty, Plex, Kast, Scener, Letterboxd, TV Time at ≤1pg each
- [x] Explicit recommendation: retain web-push + VAPID stack, defer FCM/OneSignal/Capacitor
- [x] iOS 16.4+ standalone PWA constraint documented with UAT implications
- [x] Recommended implementation sequence maps to plans 06-02 through 06-05

## Commits

- `a4c244d` — `docs(06): plan suite — RESEARCH + 5 plan files (research spike + 4 execute + UAT)` — 06-RESEARCH.md authored alongside the rest of the plan suite. Per the plan's `<output>` block, "the research doc IS the summary" — no separate SUMMARY.md was originally produced.

(Original plan declared no per-plan SUMMARY required since the research artifact itself was the deliverable. This SUMMARY backfilled retroactively by Phase 15.2 to mint the canonical `requirements_completed: [PUSH-01]` claim per audit YAML guidance — the audit explicitly flags PUSH-01 `claimed_by_plans: []` because the research-spike-led plan never minted REQ ownership.)

## Cross-repo note

N/A for this plan — no `queuenight/` changes; pure documentation artifact landed at `.planning/phases/06-push-notifications/06-RESEARCH.md` in the couch repo.

## What this enables

- **Plan 06-02** can now wire VAPID + self-echo guard with confidence that web-push is the right primitive (not a leftover decision waiting to be re-litigated)
- **Plan 06-03** can build per-event opt-in toggles that match the "every competitor" pattern documented in §4 of 06-RESEARCH.md (Plex / Kast / Letterboxd / TV Time all do per-event granularity)
- **Plan 06-04** can ship quiet-hours with the iOS 16.4+ tz-aware constraints documented in §6
- **Plan 06-05** can run iOS PWA UAT against the documented iOS Add-to-Home-Screen nudge UX
- **Phase 7 + 8 + 14 + 15 push extensions** all extend the same web-push primitive validated by this artifact — no rewrite cycles

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 06-01 landed 2026-04-21 — the research artifact itself was the intended deliverable per `06-01-PLAN.md` `<output>` block ("Sole output: `06-RESEARCH.md`. No separate SUMMARY.md needed — the research doc IS the summary."). v33.3 audit YAML lines 141-151 identified the orphan-REQ gap: PUSH-01 `claimed_by_plans: []` because the research-spike-led plan never minted REQ ownership in canonical frontmatter form. Evidence sources: `06-01-PLAN.md`, `06-RESEARCH.md` (12788 bytes on disk), `06-SESSION-SUMMARY.md` (autonomous-run history), production-live state at couchtonight.app + queuenight-84044 us-central1, audit YAML lines 141-151.
