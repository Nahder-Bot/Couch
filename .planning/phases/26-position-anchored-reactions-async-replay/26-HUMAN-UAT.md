---
phase: 26-position-anchored-reactions-async-replay
type: human-uat
status: pending-device-verification
deployed: 2026-05-01  # update to actual deploy date during Task 5.3
cache: couch-v38-async-replay
resume_signal: "uat passed"
---

# Phase 26 — Human-UAT scripts

> Authored 2026-05-01 by Plan 26-05.
> Resume signal when complete: reply `uat passed` → triggers `/gsd-verify-work 26`.
> Mirrors the Phase 18 / 19 / 24 device-UAT scaffold pattern.
>
> **Deploy-day expectation:** the Past parties surface (Tonight tab inline link)
> AND the title-detail "Past watchparties" section will be **empty for the existing
> family on deploy day** because Phase 26 is a clean demarcation (D-11 — no backfill
> of pre-Phase-26 reactions). This is the correct silent-UX behavior per D-10 +
> first-week-after-deploy framing in CONTEXT specifics. To verify the surfaces
> positively, scripts 5 + 1-4 require creating a NEW watchparty AFTER deploy, posting
> Phase 26 reactions, archiving the wp (or waiting for auto-archive at WP_ARCHIVE_MS
> age), and then revisiting via the Past parties row tap.

---

## Pre-UAT setup

- **Device:** iPhone with Couch installed as PWA on home screen (primary surface).
- **Backup device:** any second device signed in to the same family (for two-device
  verification of compound-reaction visibility — script 4).
- **Force-reload PWA once before starting** so the new `couch-v38-async-replay`
  service-worker activates: hard-quit the PWA, re-launch from home-screen icon, then
  verify Settings shows the new cache via the existing about-screen footer (or via
  script 10 below).

## UAT scripts

### Script 1 — Replay-modal entry from Past parties tap (RPLY-26-08, RPLY-26-04)

**What to test:** Tapping a row in the Past parties surface opens the replay variant
of the live-watchparty modal (scrubber strip + REVISITING eyebrow + *together again*
sub-line — NOT the live-mode chrome).

**Setup (one-time, requires a freshly-archived Phase 26 wp — see Pre-UAT note):**
1. On host device: start a watchparty for any title.
2. Post 2-3 reactions during the wp (any emoji from the existing reaction picker).
3. Either wait for the wp to auto-archive (age ≥ WP_ARCHIVE_MS) OR end the wp
   manually.
4. Wait for the snapshot to update (~2-3 seconds) so the wp transitions to
   `status: 'archived'` in Firestore.

**Steps:**
1. Open the Tonight tab. Look for the inline link `Past parties (1) ›` below the
   active-watchparties banner area.
2. Tap the link.
3. The Past parties modal opens. Confirm the row for the freshly-archived wp shows:
   title, friendly date (`Started N hr ago` if < 24h, else weekday/date ladder),
   `N on the couch`, `N reactions` (3rd subtitle line — NEW in Phase 26).
4. Tap the row.
5. The Past parties modal closes AND the live-watchparty modal opens in REPLAY
   VARIANT.

**Expected:** The live-modal chrome reads `REVISITING` in the eyebrow slot (NOT
`LIVE` / `WATCHING`), the italic-serif sub-line *together again* sits below the
title, the scrubber strip renders ABOVE the coordination header. The advisory
live-mode timer + Wait Up chip strip + participants strip are all hidden.

**Pass criterion:** All chrome deltas listed above are visible. Resume signal:
`script 1 pass` (or describe any visual mismatch).

---

### Script 2 — Replay-modal entry from title-detail tap (RPLY-26-11, RPLY-26-04)

**What to test:** A NEW section `Past watchparties` appears in the title-detail view
when the family has ≥1 archived wp with replay-able reactions for that title.
Tapping a row enters the replay variant.

**Setup:** Same as script 1 — requires ≥1 freshly-archived Phase 26 wp.

**Steps:**
1. Open the title-detail view for the same title used in script 1's wp.
2. Scroll down to find the section `Past watchparties` (NEW Phase 26 — distinct
   from the existing `Watchparties` heading which is now active-only).
3. Confirm the section has the italic-serif sub-line *Catch up on what the family
   said.*
4. Confirm the row shows poster + title + friendly-date subtitle + `N on the couch
   · N reactions` middle-dot line.
5. Tap the row.
6. Title-detail modal closes; replay variant of live-watchparty modal opens.

**Expected:** Same replay variant chrome as script 1. The `Past watchparties` section
does NOT render at all when the family has zero archived wps with replay-able
reactions for the title (D-10 silent UX — verify this by visiting the detail view
for a title the family has never watched).

**Pass criterion:** Section renders + tap enters replay variant + empty-state silent
behavior verified. Resume signal: `script 2 pass`.

---

### Script 3 — Scrubber drag + reaction fade-in at known position (RPLY-26-05, RPLY-26-DRIFT)

**What to test:** Dragging the scrubber to a known reaction's `runtimePositionMs`
causes the reaction to fade in within the ±2s drift window.

**Setup:** Use the wp from script 1 (must have ≥1 reaction with a known
`runtimePositionMs` — for an MP4/YouTube wp the reaction will have
`runtimeSource: 'broadcast'` if posted while the player was active OR `'elapsed'`
if posted without a player; either is fine for this script).

**Steps:**
1. Open the wp in replay variant via script 1 entry path.
2. Note the scrubber starts at `0:00`.
3. Drag the scrubber thumb to a position you BELIEVE is near a known reaction's
   runtime position. (You can check Firestore directly via the existing dev tools
   to find an actual `runtimePositionMs` value if needed — e.g., `wp.reactions[0].runtimePositionMs`.)
4. Release the thumb.
5. Within ~2 seconds (the drift tolerance), the reaction fades in at the bottom of
   the feed.

**Expected:** Reaction fades in smoothly with the existing reaction-row recipe.
Visually feels neither premature nor late.

**Pass criterion:** Drift tolerance "felt right" — reaction appears within 2s of
the scrubber dropping near its position. Resume signal: `script 3 pass` or
describe perceived timing issue.

---

### Script 4 — Compound-reaction posts to Firestore at correct position (RPLY-26-07)

**What to test:** Posting a reaction in replay mode stamps it with
`runtimeSource: 'replay'` AND `runtimePositionMs` equal to the local replay clock
position at post time. Future replayers see it at that position.

**Setup:** Use the wp from script 1. You'll need access to either Firestore console
OR a developer tools view to inspect the `wp.reactions[]` array shape after posting.

**Steps:**
1. Open the wp in replay variant.
2. Drag scrubber to a deliberately-recognizable position (e.g., `25:00`).
3. Use the existing reaction picker at the bottom of the modal to post any emoji.
4. Optimistic mount: the reaction appears at the bottom of the feed immediately.
5. Wait ~2-3 seconds for the snapshot round-trip.
6. Inspect Firestore (or use a second device): the wp's `reactions[]` array now
   contains a new entry with `runtimeSource: 'replay'` and `runtimePositionMs`
   within ±1s of `25 * 60 * 1000 = 1500000`.
7. On a SECOND device (still signed in to the same family), open the same wp in
   replay variant. Drag the scrubber to `25:00`. The compound reaction posted in
   step 3 fades in.

**Expected:** Recursive-family-memory contract holds (D-05). The replay-posted
reaction is visible to future replayers at the position it was stamped.

**Pass criterion:** Firestore inspection confirms `runtimeSource: 'replay'`;
second-device replay shows the new reaction at the correct position. Resume signal:
`script 4 pass`.

---

### Script 5 — Hide-when-empty surfaces / deploy-day silence (RPLY-26-06, RPLY-26-09, RPLY-26-20)

**What to test:** On deploy day BEFORE creating any new Phase 26 wps, the Tonight
inline link does NOT render AND the title-detail `Past watchparties` section does
NOT render. This is the correct silent-UX behavior per D-10 + first-week framing.

**Setup:** Run this script BEFORE running scripts 1-4 (i.e., before creating any
Phase 26 wps). If you've already run scripts 1-4, this script is moot for the
current device — verify on a fresh device install or by waiting until existing
Phase 26 wps age past WP_ARCHIVE_MS without replay-able reactions (won't naturally
happen; this script is best-run pre-script-1).

**Steps:**
1. Open the Tonight tab. Verify the `Past parties (N) ›` inline link is NOT
   visible (the area below the active-watchparties banner shows nothing).
2. Open the title-detail view for any title the family has watched in the past
   (Phase 7 / 15.5 era wps). Scroll down past the existing Watchparties section
   (which may show legacy archived wps). Verify NO `Past watchparties` heading
   appears.

**Expected:** Both surfaces silent. No "no past parties yet" copy, no empty-state
placeholder, just absence.

**Pass criterion:** Both surfaces correctly silent. Resume signal: `script 5 pass`.

---

### Script 6 — Wait Up disabled in replay (RPLY-26-14)

**What to test:** When the user has a `participants[me].reactionDelay > 0` set
(Wait Up — Phase 7 / 15.5 mechanic), reactions in REPLAY variant appear at their
stamped `runtimePositionMs` WITHOUT the delay being applied. The Wait Up chip strip
/ slider is hidden in replay variant.

**Steps:**
1. In a LIVE watchparty (any active wp), set Wait Up to a known offset like 30s
   via the existing Wait Up chip / slider.
2. Verify Wait Up is active in live mode (your reactions feed shifts by 30s).
3. Now open an ARCHIVED wp via script 1 entry path (replay variant).
4. Confirm the Wait Up chip strip / slider is HIDDEN in the replay variant.
5. Drag the scrubber to a known reaction's runtimePositionMs.
6. Reaction fades in WITHOUT the 30s Wait Up delay being applied (the reaction
   appears at the runtimePositionMs the original poster intended, not 30s offset).

**Expected:** No double-shift. Wait Up only applies in live mode.

**Pass criterion:** Wait Up chrome hidden in replay; reaction fade-in not shifted
by reactionDelay. Resume signal: `script 6 pass`.

---

### Script 7 — Video player renders but does NOT auto-start (RPLY-26-16)

**What to test:** When the archived wp has `videoUrl` still attached AND the title
is non-DRM, the player surface renders in the replay modal BUT does NOT begin
playback automatically. The viewer can opt to play in-app via the native play button.

**Setup:** Requires an archived wp where the host originally attached a `videoUrl`
(YouTube or MP4 — Phase 24 schema). If you don't have one, create a new wp with a
YouTube URL via the Phase 24 video URL field, post a reaction, archive.

**Steps:**
1. Open the wp in replay variant.
2. Confirm the player surface (`#wp-video-surface`) renders with the iframe / video
   element.
3. Confirm the player is IDLE — no audio plays, the YouTube embed shows the
   thumbnail with play button overlay (NOT auto-started), the MP4 video element
   shows the first frame poster (NOT playing).
4. Tap the native play button — the player begins.

**Expected:** Render-but-not-auto-start contract holds. No `playerVars.autoplay`,
no `<video autoplay>` (sentinel-verified at smoke layer; this UAT is the visual
confirmation).

**Pass criterion:** Player visible + idle on entry; user-initiated play works.
Resume signal: `script 7 pass`.

---

### Script 8 — Drift tolerance ±2s feel (RPLY-26-DRIFT)

**What to test:** Subjective UX — the ±2s drift window for reaction fade-in feels
neither premature nor late.

**Steps:**
1. Use the wp from script 1.
2. Drag scrubber to a known reaction's runtimePositionMs MINUS 1.5s (just before).
3. Reaction should fade in promptly.
4. Drag scrubber backward past the reaction.
5. Reaction stays visible (per script 9).
6. Drag scrubber FORWARD past the reaction by 3-4s.
7. Reaction stays visible (per script 9 — once seen, persistent).

**Expected:** Drift tolerance feels right for the family-memory framing. NOT
metronome-precise (±2s is intentionally generous per CONTEXT § Deferred — sub-second
sync is out of scope).

**Pass criterion:** "Felt natural" — no perceived premature or late mounting.
Resume signal: `script 8 pass` or describe perceived issue.

---

### Script 9 — Scrub-backward preserves shown reactions (UI-SPEC §3 persistence)

**What to test:** Once a reaction is shown in the visible window during a session,
scrubbing backward does NOT cause it to disappear. The visible-set is additive per
session, never destructive.

**Steps:**
1. Use the wp from script 1.
2. Drag scrubber forward past 2-3 reactions, letting each fade in.
3. Note all 2-3 reactions are visible in the feed.
4. Drag scrubber backward to position 0 (or near 0).
5. All 2-3 reactions stay visible (NOT unmounted).

**Expected:** Persistent visible-set per UI-SPEC §3 lock — "revisiting feels
additive, not a destructive timeline."

**Pass criterion:** No unmount on scrub-backward. Resume signal: `script 9 pass`.

---

### Script 10 — Post-deploy `couch-v38-async-replay` CACHE active (RPLY-26-18)

**What to test:** The new service-worker cache version `couch-v38-async-replay` is
live on production AND has invalidated the previous `couch-v37-native-video-player`
cache.

**Steps:**
1. From any device with the PWA installed, force-reload (hard-quit + re-launch).
2. Either: (a) On the device, run a curl from a desktop terminal:
   ```
   curl -fsSL https://couchtonight.app/sw.js | grep "const CACHE"
   ```
   Expected output: `const CACHE = 'couch-v38-async-replay';`
3. Or: open the PWA's "About" screen footer (which displays the cache version) and
   confirm it reads `couch-v38-async-replay` (NOT the previous `v37-native-video-player`).
4. Verify previous cache is purged: open DevTools (desktop browser) → Application →
   Cache Storage → confirm only `couch-v38-async-replay` is present (older versions
   removed by service-worker activate handler).

**Expected:** `couch-v38-async-replay` is live; older caches purged.

**Pass criterion:** New cache live + curl-verified + old cache purged. Resume signal:
`script 10 pass`.

---

## Final sign-off

When all 10 scripts pass: reply with `uat passed` to trigger
`/gsd-verify-work 26` which will mark Phase 26 as fully verified end-to-end.

If any script fails: reply with the failing script number + a short description of
the observed vs expected behavior. The orchestrator will route to the appropriate
remediation flow (likely a Phase 26 gap-closure plan via `/gsd-plan-phase 26 --gaps`).
