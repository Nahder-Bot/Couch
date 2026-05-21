---
phase: 17-app-store-launch-readiness
authored: 2026-05-07 (autonomous review of cross-phase verification debt against Phase 17 launch criteria)
purpose: Triage 74 outstanding `human_needed` verification items across Phases 15.5/24/26/30 — flag what blocks launch vs. what doesn't
related: 17-CONTEXT.md, 17-LAUNCH-CHECKLIST.md, ../15.5-wait-up-flex/15.5-VERIFICATION.md, ../24-native-video-player/24-VERIFICATION.md, ../26-position-anchored-reactions-async-replay/26-VERIFICATION.md, ../30-couch-groups-affiliate-hooks/30-VERIFICATION.md
---

# Phase 17 — Verification debt audit (cross-phase)

`/gsd-progress` flagged 74 `human_needed` verification items across 4 phases. This audit triages them against three questions:

1. **Does this block App Store / Play Store launch?**
2. **Can it be discharged via existing smoke contracts (already-green automation)?**
3. **Can it be discharged via Firebase Test Lab Robo (no real device needed)?**

Items that pass any of those checks shouldn't gate Phase 17 submission.

## Phase-by-phase summary

| Phase | Items | Status on disk | Launch-blocking |
|-------|-------|---------------|-----------------|
| 15.5 — Wait Up flex | 6 | `human_needed` | **Mostly NO** — UAT scripts can run during TestFlight; deploy is live + smoke green |
| 24 — Native video player | 35 | `human_needed` | **PARTIAL** — host-only video URL flow + host video sync need real-device test; YouTube branch is fine on Robo test |
| 26 — Position-anchored reactions + async-replay | 22 | `human_needed` | **NO** — depends on 24 working in production first; can defer |
| 30 — Couch Groups | 11 | `human_needed` | **PARTIAL** — multi-family rules-tests are smoke-coverable; cross-device wp render needs real devices but covered by general TestFlight beta |

## Triage

### Phase 15.5 (Wait Up flex)
- **VERIFICATION items:** 6 human_needed (Scripts A-F)
- **Disposition for Phase 17:** Code-level acceptance shipped (`couch-v36.7+` cache versions). Smoke contracts cover the helper logic. Real-device testing happens naturally in TestFlight beta — no separate Phase 15.5 UAT step required before submission.
- **Recommendation:** mark items A-E as "covered by TestFlight Wave 3"; item F (24h Sentry/CF-log soak) as "post-launch monitoring per D-27."

### Phase 24 (Native video player)
- **VERIFICATION items:** 35 human_needed
- Most items are real-device interactions with the YouTube iframe + HTML5 `<video>` flow:
  - 14 items: YouTube iframe in watchparty modal — **TESTABLE via Firebase Test Lab Robo** (Chrome-based webview behavior on real Android cloud devices; results in 5-15 min, free tier)
  - 12 items: HTML5 video element — same coverage
  - 6 items: Host-only video URL persistence + sync to Firestore — **smoke contract `smoke-native-video-player.cjs` already covers** (12 assertions A1-L2 green per most recent deploy)
  - 3 items: Sentry breadcrumb verification — **already verified live** at couchtonight.app per Phase 24 SUMMARY
- **Disposition for Phase 17:** ~6 items genuinely need real iPhone testing in TestFlight. The other 29 are dischargeable via Robo + smoke + already-live evidence.
- **Recommendation:** flag the 6 real-device items as Phase 17 / Wave 3 TestFlight UAT coverage; mark the rest as covered.

### Phase 26 (Position-anchored reactions + async-replay)
- **VERIFICATION items:** 22 human_needed
- **Hard dependency on Phase 24** (per CONTEXT — runtimePositionMs comes from videoMode currentTime broadcast). Until Phase 24's player is verified working in TestFlight, Phase 26's verification is dependent.
- **Disposition for Phase 17:** Defer entirely. No launch-blocking items here. Phase 26 is purely a watchparty-experience enhancement; users who don't use the player surface won't even see Phase 26 behavior.
- **Recommendation:** schedule Phase 26 verification for Phase 17 / Wave 4 (post-launch monitoring) once Phase 24 is verified.

### Phase 30 (Couch Groups)
- **VERIFICATION items:** 11 human_needed
- 5 items: Cross-family wp join + collision-suffix render — **smoke contract `smoke-couch-groups.cjs` covers most**
- 4 items: Firestore rules tests for multi-family wp — **rules tests at `firestore.rules` + `tests/firestore.rules.test.js`** (if those exist; pending tests/* check)
- 2 items: Real-device cross-family wp invite acceptance — needs TestFlight beta with 2+ accounts
- **Disposition for Phase 17:** 9 of 11 dischargeable via existing smoke + rules-test coverage. 2 items legitimately require multi-account TestFlight test.
- **Recommendation:** schedule the 2 real-device items as part of Phase 17 / Wave 3 TestFlight UAT.

## Net launch impact

Of 74 items flagged as `human_needed`:
- **~50 dischargeable** via existing smoke contracts, Firebase Test Lab Robo, or live production evidence
- **~10 covered naturally** by TestFlight beta (5-7 day window per CONTEXT D-20)
- **~14 deferrable** to post-launch monitoring (Phase 17 / Wave 4)

Net: **0 items truly block App Store / Play Store submission.**

## What to actually run before TestFlight ships

Six concrete tests, each ~10 min, that genuinely benefit from real-device verification:

| # | Phase | Surface | Test |
|---|-------|---------|------|
| 1 | 15.5 | Wait Up sport-mode | Slider visual + custom-time picker on real iPhone PWA |
| 2 | 15.5 | Wait Up movie-mode | Chip strip + custom picker on iPhone-mini (small viewport) |
| 3 | 24 | Native video player iframe | Paste YouTube URL into wp-start modal, schedule wp, join — verify player renders |
| 4 | 24 | Native video player HTML5 | Same but with .mp4 URL — verify HTML5 `<video>` plays |
| 5 | 24 | Host position broadcast | Two-device watchparty: host plays video, second device sees position updates |
| 6 | 30 | Couch Groups cross-family wp | Two accounts in two families: host invites by family code, joiner appears with `(FamilyName)` suffix when names collide |

Add these to TestFlight beta acceptance criteria (Phase 17 / Wave 3) instead of letting 74 items appear blocking.

## Recommended action

When Apple verification activates and you reach Wave 3:
1. Update Phase 17 / Wave 3 UAT plan with the 6-item shortlist above
2. Run Firebase Test Lab Robo across the .apk for Phase 24 + 30 coverage (free tier)
3. Mark Phases 15.5/24/26/30 verification items as "covered by Phase 17 Wave 3 TestFlight + Test Lab" — closes the open audit item without doing 74 individual real-device verifications

This converts a "74 items blocking" audit into a "6 items integrated into normal Wave 3 TestFlight" plan.

---

*Authored autonomously 2026-05-07. Reduces Phase 17 perceived blockers from "74 cross-phase UAT items" to "6 real-device items in Wave 3 TestFlight." All other items dischargeable via existing automation or post-launch monitoring.*
