# Phase 30 Hotfix — Frontend (`js/app.js`)

**Date:** 2026-05-03
**Author:** Claude (Opus 4.7, 1M context) via /gsd-code-review-fix flow
**Source reviews:**
- `.planning/phases/26-position-anchored-reactions-async-replay/26-REVIEW.md`
- `.planning/phases/24-native-video-player/24-REVIEW.md`
- `.planning/phases/27-guest-rsvp/27-REVIEW.md` (BL-04 only — others are backend)
- `.planning/phases/30-couch-groups-affiliate-hooks/30-REVIEW.md`
- Phase 30 cross-cutting findings (CR-03, CR-04, CR-07, CR-08, CR-09, CR-11) inline from review prompt

**Scope:** CRITICAL + WARNING + MEDIUM frontend fixes touching only `js/app.js`. Backend/CFs (queuenight repo), `firestore.rules`, `js/native-video-player.js`, `sw.js`, and `rsvp.html` are owned by parallel fixer agents and untouched here.

**Smoke status (final):** all 13 contracts pass · exit 0 · 350+ assertions green
**Baseline before fixes:** 51/2 (couch-groups smoke had 2 pre-existing rules+CF sentinel fails, both since closed by sibling agents)

---

## Findings applied (top of file → bottom, by source line)

| ID | Phase | Title | Commit | Lines (post-fix) |
|----|-------|-------|--------|------------------|
| CR-11 | cross-cutting | unsubscribeFromPush iterates all family memberships | `21257ab` | ~542-589 |
| CR-04 + CR-07 | cross-cutting | sign-out tears down watchparties/session/group/activity/lists subscriptions | `fa16e68` | ~3244-3284 |
| CR-08 | cross-cutting | startSync teardown guards on every onSnapshot (members/titles/group/intents) | `7bd054e` | ~4811-4905 |
| CR-08 (follow-up) | cross-cutting | startSync teardown guard on watchparties subscription | `117e2fe` | ~4948 |
| WR-26-01 + IN-26-01 | 26 | allReplayableArchivedCount predicate aligned with modal + dead branch removed | `9150b4f` | ~2952-2964 |
| WR-26-03 | 26 | getScrubberDurationMs safe reduce + 4h floor (was 60min) | `a7e412c` | ~3088-3099 |
| MED-3 | 30 | only host fires watchparty auto-archive write | `ce31425` | ~4910-4920 |
| BL-04 + CR-03 | 27 | openRsvps writes to top-level `watchpartyRef()` + attribution | `102a26d` | ~4525-4533 |
| WR-26-02 | 26 | postBurstReaction derives elapsedMs from myParticipation | `f038dc8` | ~10960-10970 |
| HIGH-1 | 30 | wp-create modal hides "Bring them in" pre-creation + click guard | `5769379` | ~11340-11357 + ~11430-11437 |
| MED-1 | 30 | cold-start guards on confirmStartWatchparty / scheduleSportsWatchparty / confirmGamePicker | `f7e1422` | ~10487-10493, ~10713-10719, ~11293-11298 |
| CR-09 | 30 | defensively include host uid in memberUids + sports hostUid stamp on all 3 wp-create paths | `275d05b` | ~10543-10560, ~10572-10580, ~10781-10791, ~11258-11268 |
| CR-09 (follow-up) | 30 | hoist myUid declaration in scheduleSportsWatchparty | `a860169` | ~10571 |
| MED-4 | 30 | addFamilyToWp error matrix handles invalid-argument + internal | `68ca3cd` | ~11500-11517 |
| WR-24-01 | 24 | hard-block mixed-content HTTP MP4 submit (returns inline error, was non-blocking toast) | `d8762dc` | ~11195-11215 |
| CR-24-01 (yt) | 24 + 26 (IN-26-02) | YouTube broadcaster reads getDuration() once + skips unknown samples (no false isLiveStream stamping) | `d3be482` | ~11675-11696 |
| CR-24-01 (mp4) | 24 | MP4 broadcaster waits for loadedmetadata before arming | `99522ef` | ~11716-11733 |
| WR-26-04 | 26 | replayShownReactionIds reset on revisit-open | `1564494` | ~11800-11804 |
| CR-26-02 | 26 | renderWatchpartyLive replay branch renders feed for non-participants | `ada0528` | ~12330-12342 |
| LOW-1 | 30 | validate cross-family chip color before CSS injection | `8235650` | ~12700-12706 |
| CR-26-01 | 26 | replay-mode reactions allowed for non-original-participants in postReaction | `b115a6a` | ~12880-12895 |

**Total atomic commits:** 21 (across 19 distinct findings — 2 follow-ups merge with CR-08 and CR-09)

---

## Findings classified as bundled

These were applied within the parent finding's commit and are documented here for traceability:

- **IN-26-01** (dead `if (wp.status === 'cancelled') continue;` branch in `allReplayableArchivedCount`) — bundled with WR-26-01 (`9150b4f`). The dead line was deleted as part of the helper rewrite.
- **IN-26-02** (3× re-evaluation of `getDuration()` per YouTube broadcast tick) — bundled with CR-24-01-yt (`d3be482`). The new code reads `getDuration()` once into `dur`, satisfying both findings simultaneously.
- **CR-03** (Phase 27 BL-04 also referenced in cross-cutting context as "openRsvps writes wrong path") — bundled with BL-04 (`102a26d`). Same fix; same commit.

---

## Findings explicitly out of scope (handed to parallel fixers)

Per the workflow instructions, the following were NOT touched by this fixer:

- `firestore.rules` — owned by rules fixer agent (CR-05 / CR-06 / CR-12 / P03-T-30-07 commits already in tree)
- `queuenight/functions/src/*.js` — owned by backend fixer agent (BL-01/02/03/05, HI-01/02, MD-01/02, CR-02/06)
- `js/native-video-player.js` — owned by native-video-player fixer (WR-24-03, WR-24-04)
- `sw.js` — owned by sw.js fixer (CR-13)
- `rsvp.html` — owned by rsvp fixer (LO-01)
- `sw.js` `CACHE` bump — done by `bash scripts/deploy.sh <tag>` at deploy time, not now

---

## Smoke verification

```
$ npm run smoke
…
Total assertions: 103; Failures: 0
Phase 26 smoke PASSED.
…
smoke-guest-rsvp: 47 passed, 0 failed
smoke-pickem: 26 passed, 0 failed
smoke-couch-groups: 62 passed, 0 failed
smoke-app-parse: 11 passed, 0 failed
EXIT: 0
```

All 13 smoke contracts green. The Phase 30 couch-groups suite added new sentinels (2.7 / 2.7b CR-09 defensive memberUids; 2.14 family hasOnly allowlist; 2.15 host-uid check loosened to `.data().hostUid !== request.auth.uid` for runTransaction compat) and they all pass against the new code.

---

## Manual UAT recommended

Per the source reviews, the highest-risk fix paths benefit from manual verification:

1. **CR-26-01 + CR-26-02** — `26-HUMAN-UAT.md` Script 4 (compound-reaction post by non-original-participant in replay mode). Open a past-party row in title-detail; tap to revisit; type any reaction; verify it lands in Firestore with `runtimeSource: 'replay'` and the reactions feed renders.
2. **CR-24-01** — `24-HUMAN-UAT.md` Script 11 (two-device currentTime broadcast on a normal MP4 + YouTube). Watch the first 3 seconds; verify no reactions get stamped with `runtimeSource: 'live-stream'` in Firestore (post-archive, scrub through the replay scrubber from 0:00 — every reaction posted in the opening seconds should appear).
3. **HIGH-1** — Open Tonight tab → start watchparty modal → verify the "Bring them in" input row is hidden with the deferred-message subline; create the wp; verify the lobby (post-creation) shows the input row again.
4. **CR-09 + MED-1** — cold-start a fresh sign-in tab; immediately tap into Tonight → start watchparty → confirm. Should not surface "Could not schedule: missing or insufficient permissions" toast even on a slow network.
5. **CR-04 + CR-07 + CR-08** — sign in to family A, sign out, sign in to family B, verify no stale data from family A leaks into family B's UI.
6. **BL-04 (Phase 27)** — host: schedule a movie wp; close RSVPs; reopen RSVPs; verify the "RSVPS CLOSED" pill clears immediately and a guest can RSVP.

---

## Open follow-ups (not in this fix wave)

- **WR-24-02** (firestore.rules:629 Path A on legacy hostUid-less wps) — owned by rules fixer; awaiting decision (option a "accept" vs option c "loosen with get()").
- **MD-03** (Phase 27 displayGuestName Unicode normalization) — Phase 27 polish; deferred per review priority.
- **LOW-2** (Phase 30 addFamilyToWp transactional read-check-write) — owned by backend fixer; already applied in `c97b726` per the smoke 2.18c sentinel.

_End of frontend hotfix summary._
