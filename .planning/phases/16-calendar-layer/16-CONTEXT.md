---
phase: 16
name: Calendar Layer
status: planned, ready for /gsd-execute-phase 16
scope_locked_at: 2026-05-27
planned_at: 2026-05-27
launch_blocking: true
seed: ../../seeds/decision-ritual-locked-scope.md (Phase 16 section)
estimated_effort: 2-3 sessions execution
plan_count: 10
wave_count: 9
---

# Phase 16 — Calendar Layer — Scope Lock

## Why launch-blocking

Nahder elected on 2026-05-27 to ship Phase 16 before App Store submission (chosen over the "submit first, build during review window" alternative). Add-for-Review is held until this ships.

## Goal

Recurring + multi-future watchparty scheduling. Supports both **title-anchored** series ("American Idol every Monday at 8pm" — TV show locked) and **time-anchored** series ("Family movie night every Friday at 7pm" — title TBD per instance via the existing picker flow), with a week-view planning surface and full series management UX.

## Scope decisions (locked 2026-05-27)

### Data primitive

`watchpartySeries/{seriesId}` Firestore doc:

```
watchpartySeries/{seriesId}
  // Identity
  familyCode: string
  createdBy: uid
  createdAt: ts

  // What's being watched
  titleType: 'tv' | 'untitled'
  titleId?: string         // TMDB ref — present iff titleType === 'tv'
  titleName?: string       // denormalized for list rendering

  // When
  daysOfWeek: number[]     // 0-6 (Sun-Sat), e.g. [1, 3] for Mon+Wed
  timeOfDay: string        // 'HH:MM' 24h local (per family timezone)
  timezone: string         // IANA tz for the family (e.g. 'America/Los_Angeles')

  // Who
  memberUids: string[]     // recipients of instance-fire pushes + materialized wp roster

  // Lifecycle
  status: 'active' | 'paused' | 'ended'
  lastFiredAt?: ts
  nextFireAt: ts           // computed from cadence; advanced after each fire
  endedAt?: ts             // if status === 'ended'
  pausedAt?: ts            // if status === 'paused'
```

### Materializer CF (`watchpartySeriesTick`)

- Cron: every 6h (every 4h if push reminder timing requires it — pin during planning)
- For each active series with `nextFireAt - now < 24h`:
  - Instantiate a `watchparties/{wpId}` doc:
    - Title from `titleId` if `titleType === 'tv'`, else create an untitled wp that triggers the existing picker flow on member join
    - `startAt = nextFireAt`
    - `memberUids` from series roster
    - `seriesId` back-reference for in-app "Part of {seriesName} series" badge
  - Send the standard wp-starting push to memberUids
  - Advance `series.nextFireAt` to next eligible day from `daysOfWeek` past current
  - Stamp `lastFiredAt`

### Entry points (BOTH ship in v1)

**Entry 1 — Tonight tab "Schedule a series" button:** full creator surface with title-or-untitled choice + multi-day cadence picker + time + members.

**Entry 2 — Post-wp "Make recurring?" prompt:** appears after a one-off wp is created, **ONLY for TV titles** (`media_type === 'tv'`). Pre-fills day-of-week + time from the wp's startAt. NEVER shown for movies or sports games. One-tap converts the just-created wp's title into a series with the inferred cadence.

### Cadence picker

Multi-day weekly: checkboxes for Sun/Mon/Tue/Wed/Thu/Fri/Sat + time-of-day picker. User can select 1-7 days.

Out of scope for v1: daily-only, monthly, biweekly, custom-interval. Add post-launch if real usage demands.

### Series list view

Location: **new section in Account tab** (co-located with Sign-in methods + notification prefs). Renders a list of active series:
- Title (or "{cadence summary}" for untitled)
- Cadence summary (e.g. "Mon + Wed at 8pm")
- Next fire (e.g. "Mon, May 28")
- Last fire (if any)
- Pause / Cancel buttons
- Tap-to-edit (opens edit surface — see below)

### Week-view UI

Location: TBD during planning. Candidates:
1. Sub-view on Tonight tab (e.g., swipe-to-calendar gesture)
2. Sub-view on Account tab (button: "Calendar view")
3. New dedicated tab (probably overkill — defer)

Renders: 7-day calendar grid (current week + nav to next/prev weeks). Each day column stacks scheduled wp instances + materialized one-off scheduled wps by time. Tap an instance → instance detail (RSVP / start / cancel-this-instance / cancel-whole-series).

Open design questions for planning:
- Multi-event-per-day stacking UX (compact rows vs full cards)
- Mobile-first responsive — week view is hard on narrow viewports
- Cross-week nav (swipe gesture vs explicit buttons)

### In-place edit

Tap an active series in the list → edit surface (full-screen modal pattern matching existing wp-edit). Editable fields:
- Title (only if `titleType === 'tv'`; can't change titleType once set — would be a recreate)
- daysOfWeek (multi-select checkboxes)
- timeOfDay
- memberUids

On save: recompute `nextFireAt` from new cadence. Any already-materialized future wp instances (within the 24h materializer window) — leave them, but the series.nextFireAt advances past them to the next eligible day under the new cadence. Past instances are immutable.

### Reminder push

30min before each instance fires (i.e., 30min before `startAt`). Reuses Phase 6 push infra. Per-user opt-in via existing notification prefs (new event-type: `seriesReminder`).

### Pause / Cancel

- Pause: status → 'paused', clears nextFireAt. Series stops firing but stays in list (resumable later via Resume button — recomputes nextFireAt from cadence).
- Cancel: status → 'ended', endedAt stamped. Removed from active list. Historical wp instances created from this series persist (their seriesId back-reference still resolves).

## Existing foundation (leveraged heavily)

- `watchparties/{wpId}` top-level doc primitive (Phase 30 / collection-group queries)
- `watchpartyIntents` flows (Phase 14 — Flow A / Flow B already shipped)
- Push notification infrastructure + per-event prefs UI (Phase 6 / Phase 12)
- Account tab "section" pattern (recently added: signin-methods-card, notif prefs)
- TMDB metadata cache for TV titles (Phase 2 / 3 / ongoing)
- Family timezone handling (existing in wp createdAt logic)

## Out of scope (post-launch)

- Daily / monthly / biweekly / custom-interval cadences (weekly multi-day only)
- Holiday/skip handling (no "skip next instance" UX; user can pause + resume manually)
- Series-level RSVP (instances use existing per-wp RSVP)
- Auto-end on N consecutive skipped instances
- Notification of "you missed a fire" if everyone dropped out
- Calendar export (.ics, Google Cal integration)

## Plan structure (suggestion — finalize at /gsd-plan-phase 16)

Suggested wave decomposition:

1. **16-01** — Firestore data primitive + rules + `watchpartySeriesTick` CF + idempotency guards
2. **16-02** — Create-series UI (Entry 1 = Tonight tab button) + cadence picker component
3. **16-03** — Series list view in Account tab + pause/cancel actions
4. **16-04** — Post-wp "Make recurring?" prompt (Entry 2, TV-only filter)
5. **16-05** — Week-view surface (location decided in plan)
6. **16-06** — In-place edit surface + nextFireAt recompute on save
7. **16-07** — seriesReminder push event-type wiring + prefs UI add
8. **16-08** — Wave close-out: smoke contract, HUMAN-UAT scaffold, sw.js bump, deploy ritual

Estimated: 2-3 sessions total (some plans can ship in parallel; data primitive must land first).

## Resume signal

**Planning is COMPLETE as of 2026-05-27.** The 8-plan suggestion above was refined by gsd-planner into 10 plans across 9 waves (see `16-01-PLAN.md` through `16-10-PLAN.md`). gsd-plan-checker passed iter 2/3 (0 blockers; 6 warnings + 1 info closed without regression). Validation strategy + per-task verification map in `16-VALIDATION.md` (nyquist_compliant: true). Pattern map in `16-PATTERNS.md` (13 strong analogs + 2 greenfield).

**Fresh session resume: `/clear` then `/gsd-execute-phase 16`** — the executor will run plans in wave order, with parallel execution where dependencies allow. CONTEXT.md (this file) + RESEARCH.md + PATTERNS.md + VALIDATION.md + each PLAN.md are the executor's source-of-truth artifacts.

Per CLAUDE.md config: YOLO mode, parallel execution, balanced model profile.
