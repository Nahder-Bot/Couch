# UAT Runbook — Pre-App-Store Verification

*Authored 2026-05-06. Closes the 8 phase-UAT gaps blocking Phase 17 App Store submission.*

> **Why this runbook exists.** 8 phases shipped code-complete and live on `couchtonight.app` but the device-UAT scripts haven't been run on real devices. App Review will exercise paths the family hasn't. Better to find issues internally first. Per LAUNCH-REVIEW §6 sequencing: this batch runs in parallel with Phase 31 (Marketing refresh) so Phase 17 submission isn't gated on either alone.

---

## Status table

| Phase | Surface | Live cache | Scripts | Resume signal | Coordination needed |
|---|---|---|---|---|---|
| 18 | Availability notifications | `couch-v36-availability-notifs` | 7 | `uat passed` → `/gsd-verify-work 18` | Solo |
| 19 | Kid Mode | `couch-v36.1-kid-mode` | 8 | `uat passed` → `/gsd-verify-work 19` | Solo (need ≥1 kid avatar in roster) |
| 20 | Decision Explanation | `couch-v36.2-decision-explanation` | 13 | `uat passed` → `/gsd-verify-work 20` | Solo (need a roster + spin) |
| 24 | Native video player | `couch-v37-native-video-player` | 11 | `uat passed` → `/gsd-verify-work 24` | Solo (YouTube/MP4 URL); cross-repo Firestore rules deploy step is host-side |
| 26 | Async-replay | `couch-v38-async-replay` | 10 | `uat passed` → `/gsd-verify-work 26` | Solo (need archived past watchparty + reactions) |
| 27 | Guest RSVP | `couch-v39-guest-rsvp` | 10 | `uat passed` → `/gsd-verify-work 27` | 2 devices (host + non-member guest) |
| 28 | Pick'em + Leaderboards | `couch-v47-pickem` | 11 | `uat passed` → `/gsd-verify-work 28` | Sport-slate dependent (live game in 14 supported leagues) |
| 30 | Couch Groups | `couch-v41-couch-groups` (post-hotfix `v46`) | 11 | `uat passed` → `/gsd-verify-work 30` | 2 families' accounts; coordinate with someone outside your household |

**Total: 81 device-UAT items across 8 phases.**

Live URL for all UAT: https://couchtonight.app/app (PWA installs from there). Standalone PWA mode (Add-to-Home-Screen) is the primary surface for Phases 18, 27 (push) and 26 (replay scrubber haptic). Phase 24 (native video) needs both standalone + browser-tab modes tested.

---

## Recommended execution order

Order minimizes blocked-by-external-coordination items + builds confidence with low-friction wins early.

### Wave A — Solo, no setup overhead (~1 hr total)

Run these on your primary device (iPhone, PWA installed). Roster needs ≥1 kid avatar (you already have this — multiple kids in the test family).

1. **Phase 19 — Kid Mode** *(8 scripts, 15-20 min)* — Toggle visibility gate, tier-cap filter on Tonight, parent override on detail modal, session reset, cross-device isolation. Easiest entry point.
2. **Phase 20 — Decision Explanation** *(13 scripts, ~25 min)* — Mostly visual review of the italic-serif "why this pick" line on spin reveal, Tonight match card footer, detail-modal "Why this is in your matches" section. No new state required.
3. **Phase 18 — Availability Notifications** *(7 scripts, ~20 min)* — Provider-refresh push fires when a queued title becomes available on a service you subscribe to. Need a title in the queue with a known provider gap; can manually flip `t.providers[]` in Firestore for the script if waiting for a real-world add isn't realistic.

### Wave B — Solo, watchparty-needed (~1 hr total)

Need an active or archived watchparty. Spin one up (or open an existing).

4. **Phase 24 — Native video player** *(11 scripts, ~30 min)* — Drop a YouTube URL into a watchparty; verify player renders, persists across reactions, late-joiner seek works, mixed-content HTTP MP4 raises a warning toast. Test both PWA-standalone and browser-tab modes.
5. **Phase 26 — Async-replay** *(10 scripts, ~25 min)* — Open a past watchparty; verify scrubber drag, reactions land at the right moment, drift tolerance ±2s. Need at least one archived watchparty with reactions on it (Phase 24 walkthrough produces this naturally — chain Wave B 4 → 5).

### Wave C — 2-device coordinated (~30 min)

Need a second device (laptop browser, second phone, or family member's phone).

6. **Phase 27 — Guest RSVP** *(10 scripts, ~30 min)* — Send a watchparty invite link from your device. Open the link on the second device in incognito (no Couch account). Submit RSVP, verify guest chip with teal avatar appears in host's lobby. Test push opt-in 4-state flow, host close/reopen RSVPs, host kebab revoke.

### Wave D — Cross-family coordinated (need outside party, ~45 min)

Schedule with a family member or close friend who'll create a separate Couch family. Could be done over a weekend video call.

7. **Phase 30 — Couch Groups** *(11 scripts, ~45 min)* — Create a watchparty in your family. Use "Bring another couch in" form to invite the other family's code. Verify the cross-family roster shows both families with `(FamilyName)` chips on name collisions. Soft-cap warning at 5 families, hard-cap hide at 8. Host-only "Remove this couch" flow. Includes Script 11 NO-AFFILIATE verification (DO NOT mark as bug per CONTEXT D-03 — affiliate is Phase 30.1 carve-out).

### Wave E — Sport-slate dependent (timing-flexible)

Run when a real game is live in NFL / NBA / MLB / NHL / soccer / F1.

8. **Phase 28 — Pick'em + Leaderboards** *(11 scripts, ~45 min)* — Submit a pre-game pick. Watch live scoring update during the game. Verify reaction amplification on scoring plays. Post-game settlement should award/zero the picks. Leaderboard updates. Pick reminder push fires 15 min before tip-off. Includes Script 11 NO-UFC verification (DO NOT mark as bug per CONTEXT D-17 update 2 — UFC dropped for v1).

   **Best windows for Phase 28 UAT:**
   - Sundays during NFL season (multi-game slate, lots of scoring events)
   - Tuesday/Thursday/Friday during NBA/NHL season
   - Saturdays during EPL / La Liga / MLS matchdays
   - F1 race weekends

### Optional — defer if blocking

Wave D + E may slip. Phase 17 submission can proceed against:
- All Wave A + B + C complete (54 items)
- Wave D as "code-level acceptance" if no second family available pre-launch
- Wave E if no sport slate inside the runway window

App Review will likely catch any genuine issue in these phases regardless of UAT completion. Wave A + B + C close the most-likely-failure-mode items.

---

## Per-session presets

Suggested groupings if you only have a fixed time window:

| Session | Length | Phases | Items |
|---|---|---|---|
| **Quick win (one evening)** | ~45 min | 19 + 20 (Wave A first 2) | 21 |
| **Solo focus (one day)** | ~3 hr | All of Wave A + Wave B | 49 |
| **Couples coordinated (one evening)** | ~30 min | Wave C only | 10 |
| **Family coordinated (one weekend)** | ~1.5 hr | Wave D | 11 |
| **Game-day (Sunday/matchday)** | ~45 min | Wave E | 11 |
| **Full sweep (~1 week)** | All five waves | All 8 phases | 81 |

---

## Common setup checklist

Before running any UAT:

- [ ] Couch installed as PWA on iOS Safari home-screen (Add-to-Home-Screen). Check version is `couch-v47-pickem` or later — pull-to-refresh once, look at Account → ABOUT for the cache string.
- [ ] Roster includes at least one kid avatar (`effectiveMaxTier ≤ 3`) for Phases 19 + 20 + 24.
- [ ] Roster includes parent flag (`isParent: true`) for Phase 19 parent-override flow.
- [ ] Push permission granted in iOS Settings → Notifications → Couch (for Phases 18 + 27 push paths). Note: iOS 16.4+ required for PWA web-push.
- [ ] Trakt connected for any title-progress UAT (Phase 26 needs progress to anchor reactions). Skip if Trakt sync isn't set up.
- [ ] Second test device available for Phase 27 + 30 (laptop browser is fine if no second phone).
- [ ] Quiet hours OFF in Account settings during UAT (so push fires aren't silenced).

If anything breaks during a UAT script, log it in `.planning/phases/<N>-<slug>/<N>-HUMAN-UAT.md` directly — append a Pass/Fail matrix row at the bottom of the file.

---

## Resume signals

After each phase passes UAT, signal completion:

```
uat passed 18    # → invokes /gsd-verify-work 18
uat passed 19    # → invokes /gsd-verify-work 19
uat passed 20    # → invokes /gsd-verify-work 20
uat passed 24    # → invokes /gsd-verify-work 24
uat passed 26    # → invokes /gsd-verify-work 26
uat passed 27    # → invokes /gsd-verify-work 27
uat passed 28    # → invokes /gsd-verify-work 28
uat passed 30    # → invokes /gsd-verify-work 30
```

The verifier closes the phase, marks REQUIREMENTS.md traceability rows as Complete (no longer "HUMAN-VERIFY pending"), and unblocks Phase 17 from this phase's perspective.

If a UAT fails: fix first, re-run that phase's UATs, then signal `uat passed N`.

---

## Failure-handling

If a UAT script catches a real issue:

1. **Triage severity:**
   - **P0 (App-Review-blocking):** crash, sign-in broken, push silent on iOS 16.4+, watchparty doesn't sync. Fix before submission.
   - **P1 (visible bug, won't reject):** copy typo, off-by-one in counter, missing aria-label. Fix opportunistically; don't block submission.
   - **P2 (cosmetic / edge-case):** rare timing issue, dark-mode-only color. Defer to post-launch.
2. **For P0:** create a hotfix phase or reuse Phase 30's `hotfix/phase-30-cross-cutting-wave` branch pattern. `bash scripts/deploy.sh <hotfix-tag>` to ship the fix. Re-run the failing UAT script.
3. **For P1/P2:** open a `/gsd-add-todo` so the item doesn't get lost; can be folded into a future phase.

Don't run `/gsd-verify-work N` until the phase actually passes — verifier will mark the phase Complete based on your signal.

---

## Phase 17 unblock condition

Phase 17 (App Store Launch Readiness) plan-phase can begin when:

- [ ] Wave A complete (Phases 18, 19, 20)
- [ ] Wave B complete (Phases 24, 26)
- [ ] Wave C complete (Phase 27)
- [ ] Wave D complete OR explicitly deferred to post-launch (Phase 30) — coordination dependency may slip past June
- [ ] Wave E complete OR explicitly deferred to post-launch (Phase 28) — sport-slate dependency may slip past June

If Wave D or E slip, Phase 17 still proceeds — those phases ship "code-level acceptance" with device-UAT deferred per the precedent set by Phase 15.4 / 15.5. Submission is not blocked.

---

*End of runbook. Revisit when phases shift status. Source-of-truth: each phase's `<N>-HUMAN-UAT.md`.*
