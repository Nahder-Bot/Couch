---
phase: 17-app-store-launch-readiness
discuss_chain: /gsd-discuss-phase 17 --auto
date: 2026-05-14
mode: auto (recommended option auto-selected per question)
---

# Phase 17: App Store Launch Readiness — Discussion Log

> **Audit trail only.** Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-14
**Phase:** 17-app-store-launch-readiness
**Chain:** Auto-discuss-phase resolving 9 open questions from 2026-05-06 pre-stage + folding 4 new findings (2026-05-13 → 2026-05-14)

---

## Auto-resolutions (recommended option per question)

### Q1 — iPad support (→ D-28)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer to post-launch | PWABuilder iPad-compat mode (uses iPhone layout); native iPad redesign in v2 | ✓ (recommended) |
| Native iPad layouts in v1 | Multi-week separate work for iPad-optimized UX | |

**Auto-selected:** Defer to post-launch.
**Rationale:** Scope discipline; iPad-specific UX is multi-week separate work. PWABuilder iPad-compat is adequate for v1 per LAUNCH-REVIEW §9.

### Q2 — App Preview video length + content (→ D-29)

| Option | Description | Selected |
|--------|-------------|----------|
| 15s "spin walkthrough" | Couch viz → spin → Tonight pick → Wait Up → Pick'em; captions, no voiceover | ✓ (recommended) |
| 30s "full ritual" walkthrough | Same beats + extended dwell on each surface; more detail | |

**Auto-selected:** 15s spin walkthrough, captions-only, warm acoustic music.
**Rationale:** 15s is App Store autoplay cap; captions-only is App-Review-safe and avoids voiceover localization debt.

### Q3 — Apple Developer account type (→ D-30)

| Option | Description | Selected |
|--------|-------------|----------|
| Personal $99/yr | Already enrolled per .continue-here.md; Apple Team ID 49R296FJGF | ✓ (CONFIRMED — already done) |
| Organization $299/yr | Requires LLC formation | |

**Auto-selected:** Personal. Already done 2026-05-06 (paid) / 2026-05-07 (activated).
**Rationale:** LLC formation not on v1 critical path; personal account converts later if needed.

### Q4 — EULA (→ D-31)

| Option | Description | Selected |
|--------|-------------|----------|
| Apple's standard EULA + custom clauses inline | Custom clauses in terms.html (DMCA, takedown, acceptable-use) | ✓ (recommended) |
| Full custom EULA | Standalone EULA document; lawyer-intensive | |

**Auto-selected:** Apple's standard + custom clauses inline.
**Rationale:** Full custom EULA is overkill for v1; standard is the default App Store choice that reviewers expect.

### Q5 — ASO keyword strategy (→ D-32)

| Option | Description | Selected |
|--------|-------------|----------|
| Defer final 100-char string to "Add for Review" time | ASO research most accurate against current competitor landscape at submission | ✓ (recommended) |
| Lock 100-char string now | Predictable but may go stale by submission | |

**Auto-selected:** Defer; starting candidates `movie night, family, watch together, picker, what to watch, streaming, household, pickem`.
**Rationale:** ASO depends on current competitor landscape; locking 3 weeks early sacrifices accuracy.

### Q6 — App Store name final lock (→ D-33)

| Option | Description | Selected |
|--------|-------------|----------|
| "Couch Tonight" | LOCKED per D-03 + already saved in App Store Connect 2026-05-06 | ✓ (CONFIRMED — already done) |
| "Couch" alone | ASO collision risk with furniture apps + Couchsurfing | |

**Auto-selected:** "Couch Tonight". Already in ASC.
**Rationale:** D-03 still holds; reservation locked.

### Q7 — Phase 15.3 promotion (→ D-34)

| Option | Description | Selected |
|--------|-------------|----------|
| Promoted to hard dependency 2026-05-06 per D-09 — SHIPPED | brand/mark-master.png + scripts/regenerate-icons.sh deployed | ✓ (CONFIRMED — already done) |
| Defer with sharp-upscale fallback | Lossy upscale from existing mark-512.png | |

**Auto-selected:** Promoted + shipped. No fallback needed.
**Rationale:** Photorealistic leather wordmark needed PNG masters; Phase 15.3 pivot delivered.

### Q8 — Beta-tester recruiting (→ D-35)

| Option | Description | Selected |
|--------|-------------|----------|
| Closed family-only first | 10-20 testers from family + close friends per D-20 | ✓ (recommended) |
| Open-invite via Twitter | Public beta recruitment via social | |

**Auto-selected:** Closed family-only.
**Rationale:** Family IS the target user (D-15 Family/Crew/Duo categories); their feedback is highest-signal for watchparty + couch-groups.

### Q9 — Submission timing (→ D-36)

| Option | Description | Selected |
|--------|-------------|----------|
| "As ready" with internal target mid-June 2026 | ~3-4 weeks from Wave 1 kickoff; no public commitment | ✓ (recommended) |
| Pin specific date (e.g., June 15) | Public date commitment | |

**Auto-selected:** "As ready" with internal mid-June target.
**Rationale:** Avoid public commitments before App Review uncertainty resolves.

---

## New findings folded (2026-05-13 → 2026-05-14)

### D-37 — Auth back/forward hotfix SHIPPED 2026-05-14

Surfaced during Phase 31 UAT Test 1 on Nahder's iPhone Mobile Safari. Root cause: `signInWithRedirect` leaves `couchtonight.app/__/auth/handler` in session history; Safari ITP / storage partitioning wipes auth nonce sessionStorage; bfcache restores handler on back/forward, surfacing "missing initial state" error in the Firebase handler page (NOT in app code — `try/catch` couldn't catch it).

Fix: `signInWithPopup` for Safari non-PWA + `back_forward` navigation guard in `bootstrapAuth`. Deployed as `couch-vfix-auth-bfcache` (commits 6563207 + c5cef7e + 02105cd).

Phase 17 impact: D-02 Apple Sign-In is still required for §4.8 but is no longer an emergency.

### D-38 — Nav-affordance UX gap NEW (Wave 1 work)

Surfaced 2026-05-14 same Phase 31 UAT Test 1. User quote: "way too many instances where I click something and don't have an easy way to click back or an x to return where I was. It's almost like you are stuck."

New plan slot: **17-NAV**. Audit + fix back/X chrome across: title detail, mood-filter, watchparty creation, intent-RSVP, family-roster, settings, deep-link landings. Bundles with 30-HOTFIX-WAVE-5 aria-dialog + keyboard-trap work.

### D-39 — Phase 31 dependency SATISFIED

Phase 31 SHIPPED 2026-05-13. D-05 dependency (Phase 31 screenshots + og.png + refreshed copy) is now fully met.

### D-40 — Merge PR #8 before submission

PR #8 (594-commit catch-up) should merge before Wave 3 App Review submission for clean Git topology / reviewer reproducibility audits. Added to Wave 3 pre-flight as 17-MERGE.

---

## Areas NOT discussed (carried forward unchanged from 2026-05-06)

D-01..D-27 from pre-stage all retained as-is. Specifically:
- Wrapper choice (PWABuilder per spike 001) — D-01
- §4.8 Apple Sign-In requirement — D-02
- App Store naming — D-03/D-04
- Phase 31 dependency mechanics — D-05/D-06
- Apple Developer + Play Console enrollment — D-07/D-08
- Phase 15.3 hard dependency — D-09
- Privacy + ToS authoring — D-10/D-11/D-12
- Pick'em §5.3.4 risk assessment — D-13/D-14
- §4.2 mitigation strategy — D-15/D-16
- Native build pipeline — D-17/D-18/D-19
- TestFlight + Play Internal beta — D-20/D-21/D-22/D-23
- App Review submission strategy — D-24/D-25/D-26
- Sentry telemetry — D-27

## Claude's Discretion (unchanged from original CONTEXT)

Original Claude's Discretion list at end of `<decisions>` block remains open at plan-phase time:
- App Preview video soundtrack final selection
- Apple Sign-In button placement vs HIG
- ASO keyword field final 100-char string

## Deferred Ideas (carried forward unchanged)

All items in `<deferred>` section of CONTEXT.md (iPad-optimized layouts, Apple Watch, Localization, App Clips, Apple TV, CarPlay, affiliate hooks for Phase 30.1, recurring scheduling for Phase 16, Capacitor escalation, iOS push fidelity tuning) — unchanged.
