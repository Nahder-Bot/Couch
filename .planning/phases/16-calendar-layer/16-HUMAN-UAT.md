---
phase: 16
slug: calendar-layer
created: 2026-05-27
device_uat_status: pending
resume_signal: "uat passed → /gsd-verify-work 16"
---

# Phase 16 — Calendar Layer — Human UAT

Manual device verification scripts. Code-level acceptance was completed at deploy time;
this file gates final phase-shipped status per Phase 18 / 19 / 26 / 27 / 28 precedent.

## Pre-flight

- [ ] Confirm production cache version via curl: `curl -s https://couchtonight.app/sw.js | grep CACHE` should return `couch-v16-calendar` (Task 4 deploy.sh auto-bump from short-tag `16-calendar`; manual source value committed in Wave 9 was `couch-v49-phase-16-calendar` as belt-and-suspenders — auto-bump wins at deploy time).
- [ ] Confirm CFs deployed: `firebase functions:list --project queuenight-84044` should include `watchpartySeriesTick`.
- [ ] Confirm composite indexes deployed + ENABLED: Firebase console → Firestore → Indexes → look for `watchpartySeries` collection with 2 composite indexes in BUILT status (not BUILDING). NOTE: first 6h tick after deploy may log `FAILED_PRECONDITION` if index is still BUILDING — this is expected (T-16-36 disposition: accept). Next tick succeeds.

## Script 1: Entry 1 — create a series via Tonight tab

**Device:** iPhone PWA (primary surface)

1. Sign in to couchtonight.app/app on iPhone
2. Go to Tonight tab
3. Verify: "Schedule a series" pill button appears in the actions slot (gated on family + me present)
4. Tap "Schedule a series"
5. Modal opens. Verify all fields present: titleType toggle, title input (visible when "A TV show" is selected), 7-button day picker, time input, members chips, Save + Cancel.
6. Type "American Idol" in title — autocomplete suggestions appear; tap "American Idol (2002)" or similar
7. Tap "M" and "W" in the day picker — both should turn amber (`.on` state)
8. Set time to 20:00
9. Tap all family member chips
10. Tap "Save series"
11. Modal closes, toast "Series scheduled. First fire within 6 hours."
12. Navigate to Account tab → "Your series" section appears → row shows "American Idol — Mon + Wed at 8 PM — Next: <next eligible day>"

**Expected:** Series persists across page refresh. Firestore console shows new doc in `watchpartySeries` collection.

## Script 2: Entry 2 — create a series via post-wp prompt (TV-only)

**Device:** iPhone PWA

1. Finish a one-off TV-show watchparty (any TV show — e.g., start one and end immediately)
2. Post-session modal opens
3. Verify: "Make this recurring" button is visible
4. Tap it
5. Series-create modal opens with TV title + day-of-week (matching wp.startAt's day) + time-of-day pre-filled
6. Refine if desired; tap Save
7. Account-tab list shows the new series

**Negative case (movies + sports):**
- Finish a MOVIE watchparty → "Make this recurring" tile should NOT appear
- Finish a SPORTS GAME watchparty → "Make this recurring" tile should NOT appear

## Script 3: Edit cadence

**Device:** iPhone PWA (or desktop)

1. Navigate to Account tab "Your series" → tap "Edit" on the American Idol row
2. Modal opens pre-filled. Title type toggle is greyed out (immutable). Days picker shows [Mon, Wed] as `.on`.
3. Tap "F" in picker → day picker now shows [Mon, Wed, Fri]
4. Tap Save changes
5. Modal closes, toast "Series updated. Next fire recomputes within 6 hours."
6. Row shows "Mon + Wed + Fri" in cadence pills (after re-render)

**Edge:** Verify clicking the titleType buttons does nothing (disabled).

## Script 4: Pause / Resume / Cancel

**Device:** iPhone PWA

1. Tap "Pause" on a series row → row shows "paused" status badge; Edit + Pause buttons replaced with Resume + Cancel; toast "Series paused."
2. Tap "Resume" → row returns to active state; toast "Series resumed."
3. Tap "Cancel" → confirm dialog → tap OK → toast "Series cancelled." Row disappears from the list.

**Expected:** Firestore doc status goes `active → paused → active → ended`. Historical wp instances from the cancelled series (if any materialized) remain visible in past parties; their seriesId back-reference still resolves.

## Script 5: Week-view render — mobile + desktop

**Device:** iPhone PWA (mobile path) + desktop browser (grid path)

**Mobile (iPhone PWA at iPhone SE 375px):**
1. Tap Account tab → tap "Calendar view" button at bottom of "Your series" card
2. Modal opens. Header shows date range (e.g., "May 25 – May 31"). Prev / Next pills present.
3. Verify: layout is 1-column stack (each day full-width row).
4. Empty days are hidden (display:none — to save scroll).
5. Tap "Next →" → header shifts to next 7 days. Tap "← Prev" → back.
6. Tap an event row → modal closes + navigates to that wp (or fallback flashToast if no nav function).

**Desktop (browser ≥600px):**
1. Same flow → layout is 7-column grid.
2. Today column has amber outline.

## Script 6: 30-min reminder push received

**Device:** iPhone PWA + Android Chrome PWA

1. Create a series with first fire ~31 min in the future (manually set `nextFireAt` in Firestore console to `Date.now() + 31*60*1000` to test, or wait for natural cadence)
2. Within ~5 minutes of fire time, observe a push notification: title "Couch in 30 min", body `"American Idol" — your weekly couch night is coming up.`
3. Tap the push → opens `/app?wp=<wpId>` deep link → resolves to the live wp banner.
4. Verify in Firestore: `watchparties/{wpId}.reminders.seriesReminder.t-30min === true`.

**Negative case (per-user opt-out):**
1. In Settings → Notifications → toggle "Recurring watchparty reminder" OFF
2. Re-run step 1 → push should NOT arrive for that user (other family members still receive it).

## Script 7: DST transition behavior (optional — verifies at next DST event)

**Device:** any with system clock

1. On the next DST transition (March or November in northern hemisphere), observe a Sun-only series scheduled for 02:30 America/Los_Angeles.
2. Spring-forward (March): 2:30 doesn't exist → instance resolves to ~03:30 PDT. Expected: push arrives at 3:30 PDT wall-clock.
3. Fall-back (November): 1:30 happens twice → instance fires at either of the two 1:30 instants (impl-defined, both acceptable).

**Document outcome in next milestone retrospective.**

## Resume signal

When all 6 mandatory scripts pass (Script 7 is informational):
- Run `/gsd-verify-work 16`
- Update ROADMAP.md Phase 16 row to SHIPPED status
