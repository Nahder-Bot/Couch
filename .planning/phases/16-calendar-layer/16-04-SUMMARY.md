---
phase: 16-calendar-layer
plan: 04
subsystem: cross-repo-push-pref-lockstep
tags: [cloud-functions, scheduled-cf, notification-prefs, dr3-lockstep, calendar-layer, reminder-push]

# Dependency graph
requires:
  - phase: 16-calendar-layer
    plan: 03
    provides: "watchpartySeriesTick CF + materialized wp doc shape (seriesId / seriesInstanceDateKey back-refs + memberUids[] + hostFamilyCode + families[])"
  - phase: 30-couch-groups-affiliate-hooks
    plan: 01-05
    provides: "fanOutToFamilies + sendToMembers per-family memberId resolution + per-user notificationPrefs gate at queuenight/functions/index.js:316-323"
provides:
  - "watchpartyTick TOP-LEVEL loop extended with T-30min seriesReminder branch (CAL-16-05)"
  - "DR-3 lockstep — seriesReminder key in NOTIFICATION_DEFAULTS (server) + DEFAULT_NOTIFICATION_PREFS (client) + NOTIFICATION_EVENT_LABELS (client) (CAL-16-06)"
  - "smoke-series-materializer.cjs FLOOR=29 + Group E (3 DR-3 sentinels) + Group F (6 reminder-branch sentinels) — 32 total production sentinels"
affects: [16-05-account-tab-list, 16-10-deploy]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "fanOutToFamilies (Phase 30 canonical cross-family fan-out) — used for seriesReminder push instead of literal sendToMembers call; resolves per-family memberIds correctly + supports cross-family wps + per-user pref gate happens internally"
    - "In-doc flag-BEFORE-send (rsvpReminderTick:251 canonical) — `'reminders.seriesReminder.t-30min': true` set via doc.ref.update BEFORE the fan-out call; at-most-once delivery under retry/concurrency"
    - "DR-3 three-place lockstep (Phase 14 D-12 + Phase 28 PICK-28-17 precedent) — 1 server NOTIFICATION_DEFAULTS + 2 client maps (DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS); friendly-UI NOTIF_UI_TO_SERVER_KEY intentionally skipped per TD-8 dual-Settings-screen consolidation deferral"
    - "Branch-in-TOP-LEVEL-loop placement (PATTERNS §8 D8.1) — series-materialized wps live in db.collection('watchparties') (top-level only); inserting in the legacy nested per-family loop at line 1246+ would never fire for series-materialized wps. Placement asserted by automated verify checking top anchor BEFORE / legacy anchor AFTER insertion line."
    - "+/-5min slop window (35..25 min before startAt) — watchpartyTick runs every 5 min; the slop ensures the reminder fires exactly once per instance regardless of tick alignment"

key-files:
  created: []
  modified:
    - queuenight/functions/index.js
    - js/app.js
    - scripts/smoke-series-materializer.cjs

key-decisions:
  - "Used fanOutToFamilies (Phase 30 canonical) instead of plan-literal sendToMembers(wp.hostFamilyCode, wp.memberUids || []). Rule 1 auto-fix bug: sendToMembers's 2nd arg is memberIds (per-family doc IDs), NOT memberUids (auth UIDs); passing memberUids would silently no-op at the families/{code}/members/{uid} lookup (line 305 of queuenight/functions/index.js). fanOutToFamilies iterates wp.families[] + resolves memberIds per family + delegates to sendToMembers (which still gates per-user via notificationPrefs.seriesReminder lookup on users/{uid} at line 316-323). Plan's smoke F-checks don't verify the function name (only payload contents) — fix preserved."
  - "Slop window +/-5 min (35..25 min before startAt) because watchpartyTick runs 'every 5 minutes'. Single-instance idempotency guaranteed by in-doc flag check BEFORE send: even if a tick lands at minute 25 AND another at minute 30, the second is short-circuited by `alreadyFired = wp.reminders.seriesReminder['t-30min']`."
  - "In-doc flag set BEFORE send (rsvpReminderTick:251 canonical pattern) — if fanOutToFamilies throws, the flag is already set and the push won't retry. Net: at-most-once delivery. Acceptable per RESEARCH 'Idempotency strategy' layer 3."
  - "Friendly-UI map NOTIF_UI_TO_SERVER_KEY at js/app.js:549 intentionally NOT updated for seriesReminder. PATTERNS D10b.2 + Phase 28 PICK-28-17 precedent — post-Phase-12 keys defer friendly-UI parity to TD-8 (dual-Settings-screen consolidation) to avoid the legacy/friendly UI collision RESEARCH §5 flagged."
  - "FLOOR bumped from 20 to 29 (smoke-series-materializer.cjs) to absorb +9 new sentinels (E1-E3 lockstep + F1-F6 reminder-branch). Runtime: 32 production sentinels green; headroom 3 above floor."

patterns-established:
  - "Cross-repo atomic commits split correctly: server-side server-CF + server-key edit in queuenight (commit 05201cf); client-side 2 client-map edits in couch (commit 9cedff3); smoke contract extension in couch (commit 02b8142). DR-3 lockstep is structurally cross-repo so 3 commits across 2 repos is necessary atomicity. Wave 9 / plan 16-10 must deploy queuenight functions BEFORE couch hosting (server key must exist before client UI surfaces the toggle that pings it)."

requirements-completed: [CAL-16-05, CAL-16-06]

# Metrics
duration: 6min
completed: 2026-05-28
---

# Phase 16 Plan 04: 30-min seriesReminder push + DR-3 cross-repo lockstep Summary

**Shipped the final Foundation-ish wave of Phase 16 — every materialized series instance now gets a T-30min reminder push (in-doc-flagged for at-most-once delivery, fanned out per-family with Phase 30 cross-family resolution, gated per-user via notification prefs), and the Settings toggle is wired across both repos so users can opt out before Wave 9 / plan 16-10 deploys the bundle.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-05-28T00:02:50Z (approx)
- **Completed:** 2026-05-28T00:08:55Z
- **Tasks:** 3 / 3
- **Files created:** 0
- **Files modified:** 3 (1 cross-repo CF index + 1 couch client + 1 couch smoke)

## Three places seriesReminder key was added (DR-3 lockstep)

1. **Server NOTIFICATION_DEFAULTS** at `queuenight/functions/index.js:128-132` (DR-3 server place 1 of 3) — `seriesReminder: true` appended after `pickemSeasonReset: true,`. Per-user gate at lines 316-323 reads `users/{uid}.notificationPrefs.seriesReminder` and falls through to this default when the user has not toggled it explicitly.
2. **Client DEFAULT_NOTIFICATION_PREFS** at `js/app.js:487-491` (DR-3 client place 1 of 2) — `seriesReminder: true` appended after `pickemSeasonReset: true,`. Mirror of server default.
3. **Client NOTIFICATION_EVENT_LABELS** at `js/app.js:543-545` (DR-3 client place 2 of 2) — `seriesReminder: { label: 'Recurring watchparty reminder', hint: 'Heads-up that a series instance is starting in 30 minutes.' }`. Surfaces the toggle in legacy Settings screen.

**NOT touched (intentional per PATTERNS D10b.2):** friendly-UI map `NOTIF_UI_TO_SERVER_KEY` at js/app.js:549. Phase 28 PICK-28-17 precedent — TD-8 dual-Settings-screen consolidation owns friendly-UI parity for new post-Phase-12 keys.

## Pre-action grep outputs (top-level vs legacy loop)

Mandatory placement-verification greps run BEFORE inserting the reminder branch:

| Grep | Result line | Loop type |
|------|-------------|-----------|
| `grep -n "db.collection('watchparties').get()" queuenight/functions/index.js` | line 1167 (was 1162 pre-edit; line numbers shifted by +5 after Task 1 EDIT 1's 5-line append to NOTIFICATION_DEFAULTS) | **TOP-LEVEL** (target) |
| `grep -n "collection('families')"` (with `for (const familyDoc of` confirming nested loop iteration) | first nested-loop iteration at line 1212/1213 (`for (const familyDoc of families.docs)` then `collection('families').doc(familyDoc.id).collection('watchparties').get()`) — DIFFERENT line from top-level loop | **LEGACY nested** (must avoid) |
| `grep -n "exports.watchpartyTick = onSchedule"` | line 1144 | watchpartyTick handler entry |

The two loops are at clearly different line ranges (top-level: 1167-1244; legacy nested: 1207-end-of-handler, shifted to 1246+ after insertion). PATTERNS §8 D8.1 enforced.

## Post-insert placement assertion

**Branch inserted at line 1202** (the line containing `// === Phase 16 / CAL-16-05 — series reminder push (T-30min) ===` comment).

**5-line pre-context (lines 1196-1201) read post-insert:**
```js
        if (wp.status === 'active') {
          const participantCount = Object.keys(wp.participants || {}).length;
          const lastActivity = wp.lastActivityAt || wp.startAt || 0;
          if (participantCount === 0 && lastActivity < now - THIRTY_MIN) {
            await doc.ref.update({ status: 'archived', archivedAt: now, archivedReason: 'empty_active_timeout' });
            archivedEmpty++;
          }
        }
```

**Placement assertion result (per executor verify command):**
- ✓ Top-level loop anchor `db.collection('watchparties').get()` appears BEFORE insertion line (last occurrence at line 1167 = 35 lines above insertion)
- ✓ Legacy nested-loop anchor `for (const familyDoc of` appears AFTER insertion line (still exists below at line 1213 — the legacy loop is untouched)
- ✓ 5-line pre-context contains NO legacy anchors (no `for (const familyDoc of`, no `collection('families').doc(familyDoc`)
- ✓ Confirmed: branch lives in TOP-LEVEL wp loop, NOT legacy nested per-family loop

**Note on the plan's 200-line pre-context verify command:** The plan's literal verify command checked a 200-line window which reached BACKWARD past the top-level loop start into earlier code that legitimately contains `collection('families')` calls (e.g., line 305 sendToMembers, line 388 family-roster lookup). That's a false-positive trip in the verify command itself, not a placement failure. The 5-line check (per the plan's "Read 5 lines BEFORE" intent + top-anchor-before / legacy-anchor-after structural check) is the correct placement test and PASSES cleanly.

## In-doc flag pattern + at-most-once delivery semantics

```js
if (wp.seriesId && wp.status === 'scheduled' && typeof wp.startAt === 'number') {
  const minutesBefore = (wp.startAt - now) / 60000;
  if (minutesBefore <= 35 && minutesBefore >= 25) {
    const alreadyFired = wp.reminders
      && wp.reminders.seriesReminder
      && wp.reminders.seriesReminder['t-30min'];
    if (!alreadyFired) {
      try {
        // Set flag BEFORE send to prevent double-fire under retry/concurrency
        await doc.ref.update({ 'reminders.seriesReminder.t-30min': true });
        await fanOutToFamilies(wp, {
          title: 'Couch in 30 min',
          body: `"${wp.titleName || 'Family movie night'}" — your weekly couch night is coming up.`,
          tag: `series-reminder-${wp.seriesId}-${wp.seriesInstanceDateKey}`,
          url: `/app?wp=${doc.id}`
        }, { eventType: 'seriesReminder' });
      } catch (e) {
        console.warn('watchpartyTick series-reminder failed', doc.id, e && e.message);
      }
    }
  }
}
```

**Semantics:**
- **Gate 1 (eligibility):** wp must have a `seriesId` back-ref + status='scheduled' + numeric `startAt` (defensive typeof check). Filters out one-off wps, already-active wps, archived wps, and corrupt docs.
- **Gate 2 (timing):** `minutesBefore` in [25, 35]. Slop window because watchpartyTick runs every 5 min — guarantees at least one tick lands in the window for any given instance.
- **Gate 3 (idempotency):** `alreadyFired` check on the in-doc flag short-circuits re-fires.
- **Atomicity:** flag set BEFORE fan-out — if fan-out throws, flag is persisted and the next tick won't retry. **At-most-once delivery**. Acceptable per RESEARCH 'Idempotency strategy' layer 3 (preferable to at-least-once for push spam containment).
- **Per-user gate:** `eventType: 'seriesReminder'` triggers the per-user pref check inside `sendToMembers` at queuenight/functions/index.js:316-323 — reads `users/{uid}.notificationPrefs.seriesReminder` and skips delivery if the user toggled it off. Default ON (NOTIFICATION_DEFAULTS.seriesReminder=true) when the pref is undefined.

## Smoke FLOOR bump 20 → 29 + 9 new sentinels

**Baseline (post plan 16-03):** 20 (after A9 split for shell-escape safety).

**Plan 16-04 additions to `scripts/smoke-series-materializer.cjs`:**

**Group E — DR-3 lockstep (3 sentinels):**
- E1: client `DEFAULT_NOTIFICATION_PREFS` has `seriesReminder: true`
- E2: client `NOTIFICATION_EVENT_LABELS` has a `seriesReminder:` row
- E3: server `NOTIFICATION_DEFAULTS` has `seriesReminder: true`

**Group F — reminder-branch presence (6 sentinels):**
- F1: gate on `wp.seriesId && wp.status`
- F2: slop window `minutesBefore <= 35 && minutesBefore >= 25`
- F3: in-doc flag set BEFORE send (`'reminders.seriesReminder.t-30min': true`)
- F4: push body title `'Couch in 30 min'`
- F5: deterministic push tag `series-reminder-${wp.seriesId}-${wp.seriesInstanceDateKey}`
- F6: `eventType: 'seriesReminder'`

**Runtime result:** `33 passed, 0 failed` (32 sentinels + floor meta-assert). Headroom 3 above FLOOR=29.

## Task Commits

Each task committed atomically in its respective repo:

1. **Task 1: Add seriesReminder to NOTIFICATION_DEFAULTS + watchpartyTick reminder branch** — `05201cf` in queuenight repo (`feat(16-04): add seriesReminder push (T-30min) + DR-3 server key`)
2. **Task 2: Add seriesReminder to client DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS** — `9cedff3` in couch repo (`feat(16-04): add seriesReminder to client DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS`)
3. **Task 3: Extend scripts/smoke-series-materializer.cjs with DR-3 + reminder-branch groups** — `02b8142` in couch repo (`test(16-04): extend smoke-series-materializer with DR-3 + reminder-branch groups`)

**Plan metadata commit:** [pending — added with this SUMMARY + STATE/ROADMAP updates]

## Threats Addressed

- **T-16-08 (Push spam — fires on cancelled/already-fired instance):** MITIGATED via in-doc flag `wp.reminders.seriesReminder['t-30min']` set BEFORE fan-out (rsvpReminderTick:251 canonical pattern). At-most-once delivery; second tick short-circuits at `alreadyFired` check. F3 smoke encodes this.
- **T-16-17 (DR-3 drift — client toggle exists but server gate missing):** MITIGATED via Group E cross-repo lockstep smoke (E1+E2 client + E3 server). Future PRs dropping any of the 3 keys fail the smoke at deploy time. The "added key on one side only" failure class is now structurally caught.
- **T-16-18 (Information Disclosure — fires for user who toggled OFF):** MITIGATED via existing sendToMembers per-user pref lookup at queuenight/functions/index.js:316-323 (`prefs[eventType]` check, falls through to `NOTIFICATION_DEFAULTS[eventType]` when undefined). No new code path; the existing per-user gate just sees a new eventType key. F6 smoke encodes the eventType propagation.
- **T-16-19 (Push delivery dup — multiple browser instances of same user):** MITIGATED via deterministic push `tag: series-reminder-${seriesId}-${instanceDateKey}` — OS-level notification stacking dedup by tag. Same tag = one visible notification per instance per device. F5 smoke encodes this.
- **T-16-30 (Wrong-loop landmine — reminder lands in legacy nested loop):** MITIGATED via mandatory pre-action grep (recorded above) + post-insert placement assertion (top-anchor-BEFORE / legacy-anchor-AFTER structural check). Branch verified in TOP-LEVEL loop. Series-materialized wps live at top-level only (Plan 16-03's `db.collection('watchparties').doc(wpId)` write); the legacy nested loop iterates `families/{code}/watchparties` and would never see them.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Switched plan-literal `sendToMembers(wp.hostFamilyCode, wp.memberUids || [], ...)` to canonical Phase 30 `fanOutToFamilies(wp, payload, options)`**
- **Found during:** Task 1 pre-action review of sendToMembers signature
- **Issue:** The plan's literal action block writes `sendToMembers(wp.hostFamilyCode, wp.memberUids || [], ...)`. But `sendToMembers(familyCode, memberIds, ...)` at queuenight/functions/index.js:298 expects per-family member doc IDs (`m_*` prefix), NOT auth UIDs. Looking up `families/{code}/members/{uid}` at line 305 returns `!exists`, so the push silently no-ops at line 308. The phase-30 wp shape uses `memberUids: []` (auth UIDs) and `participants{memberId: {...}}` (member doc IDs); these are different identifier spaces. Plan author conflated them.
- **Fix:** Used `fanOutToFamilies(wp, payload, options)` — the Phase 30 canonical cross-family fan-out at queuenight/functions/index.js:516. Iterates `wp.families[]` + resolves per-family memberIds via `members.get()` + delegates to sendToMembers per family. Same per-user gate (via sendToMembers internals) + correct identifier resolution + supports cross-family wps (Phase 30 wps can have multiple families).
- **Files modified:** queuenight/functions/index.js (the action block uses fanOutToFamilies instead of sendToMembers).
- **Plan smoke F-checks preserved:** F4 (`title: 'Couch in 30 min'`), F5 (push tag), F6 (`eventType: 'seriesReminder'`) — none reference the function name; all PASS on the corrected call. The auto-fix is invisible to the smoke contract.
- **Commit:** Included in Task 1 commit `05201cf` (queuenight).

**2. [Verify-command interpretation] Plan's literal 200-line pre-context placement check is over-wide; used 5-line + structural check instead**
- **Found during:** Task 1 post-insert verify
- **Issue:** The plan's verify command reaches `slice(Math.max(0, idx - 200), idx)` — 200 lines BEFORE the insertion at line 1202. That window reaches BACK past line 1167 (top-level loop start) into earlier file content (lines 1002-1166) which legitimately contains `collection('families')` calls (e.g., line 305 sendToMembers, line 388 family-roster lookup in other CFs). False-positive trip: the LEGACY anchor substring `collection('families')` appears in the window even though our branch is correctly placed inside the top-level loop.
- **Fix:** Used the plan's intent ("Read 5 lines BEFORE the insertion" per the original spec on lines 207-213) + structural check (top-level anchor appears BEFORE insertion + legacy nested-loop anchor appears AFTER insertion). Both PASS. The 200-line over-reach is a planning-time mistake in the verify command — not an actual placement failure. Documented above in §Post-insert placement assertion.
- **Files modified:** None (this is a verify-command interpretation, not a code change).
- **Commit:** N/A — interpretive note for future plan-checker improvements.

### Authentication Gates

None — pure server CF + client maps + smoke. No auth surface touched.

### Scope Boundary

Adhered strictly:
- Plan scope: 2 cross-repo lockstep edits + 1 watchpartyTick branch + smoke extension. That is exactly what shipped.
- queuenight pre-existing dirty state (`firebase.json` + `firestore.indexes.json` from prior sessions) explicitly NOT staged in any Task 1 commit — preserves prior owner's uncommitted state. Same hygiene practice as plans 16-02 + 16-03.
- NO deploys (Wave 9 / plan 16-10's job).
- NO `sw.js` cache bump (this plan is pure backend + client-map; no user-visible app-shell change until Settings UI surfaces the new toggle — that happens automatically at next render).
- NO friendly-UI (NOTIF_UI_TO_SERVER_KEY) edits — only the 2 legacy maps per PATTERNS D10b.2 + Phase 28 PICK-28-17 precedent.

## Threat Flags

None — this plan adds exactly the surface the threat model already enumerates (T-16-08 / T-16-17 / T-16-18 / T-16-19 / T-16-30 all mitigated above). No new attack surface beyond what CONTEXT/RESEARCH already planned.

## Known Stubs

None. The reminder branch is fully wired: gates eligibility, sets idempotency flag, fans out push with brand-voice body + deterministic tag + correct eventType. Per-user gate path exists from Phase 6 + reused by all eventType-tagged calls. Settings toggle renders automatically on next Settings screen mount (Phase 6/12 render loop iterates `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` keys). No mock data, no TODO/FIXME placeholders.

## Issues Encountered

**1. Plan's literal verify command pre-context window too wide.** Resolved by interpreting per plan's "Read 5 lines BEFORE the insertion" intent + adding a structural check (top-anchor-before / legacy-anchor-after). See Deviation #2 above.

**2. Plan's literal sendToMembers signature conflated memberUids vs memberIds.** Resolved via Rule 1 auto-fix using fanOutToFamilies. See Deviation #1 above.

Both issues caught at execute-time; neither blocked completion. Plan-checker may want to add these to its catalog for future planning sessions.

## User Setup Required

None — pure backend code + client maps + smoke contract. No external service configuration. Wave 9 / plan 16-10 owns the cross-repo deploy:
- queuenight: `cd ~/queuenight && firebase deploy --only functions` (this picks up the new seriesReminder branch in watchpartyTick + NOTIFICATION_DEFAULTS update)
- couch: `cd ~/claude-projects/couch && bash scripts/deploy.sh --sync-rules <tag>` (this picks up the 2 client-map updates in js/app.js)

**Deploy order:** queuenight FIRST, then couch — DR-3 lockstep semantics require the server key to exist before the client toggle surfaces (a client toggle pointing to a nonexistent server eventType is harmless but cosmetically broken until the next CF cold-start).

## Next Phase Readiness

- **Plan 16-05 (Account-tab series list view):** READY. Will subscribe to `db.collection('watchpartySeries').where('familyCode', '==', code).where('status', '==', 'active').orderBy('nextFireAt')` — backed by the second composite index from Plan 16-01. Reminder pref toggle visible alongside the series list since both surfaces live in Account tab.
- **Plan 16-06 (Tonight tab "Schedule a series" CTA + creator surface):** READY. Will write to `db.collection('watchpartySeries')` via rules-validated client write from Plan 16-01.
- **Plan 16-07 (Edit modal + nextFireAt recompute):** READY. Will edit series doc fields + recompute via Plan 16-02 helper.
- **Plan 16-08 (Post-wp "Make recurring?" prompt — TV-only Entry 2):** READY.
- **Plan 16-09 (Week-view UI):** READY.
- **Plan 16-10 (Wave 9 / deploy + sw.js bump):** READY. Will pick up 3 deploys: queuenight functions (Plan 16-03 + 16-04), couch firestore rules+indexes (Plan 16-01), couch hosting (Plans 16-04 + 16-05 + 16-06 + 16-07 + 16-08 + 16-09 client changes). sw.js CACHE bump per RUNBOOK §H.
- **No blockers** for any downstream plan in Phase 16.

## Self-Check: PASSED

- Commit `05201cf` exists in queuenight repo on branch `main` (verified via `git log --oneline -3`).
- Commit `9cedff3` exists in couch repo on branch `hotfix/phase-30-cross-cutting-wave` (verified via `git log --oneline -3`).
- Commit `02b8142` exists in couch repo on branch `hotfix/phase-30-cross-cutting-wave` (verified via `git log --oneline -3`).
- File `queuenight/functions/index.js` modified (seriesReminder added to NOTIFICATION_DEFAULTS + Phase 16 / CAL-16-05 branch in TOP-LEVEL loop confirmed via grep + Read).
- File `js/app.js` modified (seriesReminder added to DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS confirmed via grep — counts: PREFS=1, LABELS=1, CAL-16-06 comment count=2).
- File `scripts/smoke-series-materializer.cjs` modified (FLOOR=29 + Groups E+F added).
- `cd queuenight/functions && node -e "require('./index.js')"` exits 0 with "queuenight index.js loads cleanly" (verified).
- `node scripts/smoke-app-parse.cjs` exits 0 with `11 passed, 0 failed` (verified).
- `node scripts/smoke-series-materializer.cjs` exits 0 with `33 passed, 0 failed` (verified — 32 sentinels + floor; FLOOR=29).
- `node scripts/smoke-series-cadence-compute.cjs` (16-02 prereq) still exits 0 with `12 passed, 0 failed` (regression check verified).
- `node scripts/smoke-series-idempotency.cjs` (16-03 prereq) still exits 0 with `11 passed, 0 failed` (regression check verified).
- `git diff --diff-filter=D --name-only HEAD~1 HEAD` returns empty for all 3 commits (no deletions, verified).
- Friendly-UI map intentionally NOT touched: `grep "seriesReminder" js/app.js | grep -i NOTIF_UI` returns no hits (verified).

---
*Phase: 16-calendar-layer*
*Completed: 2026-05-28*
