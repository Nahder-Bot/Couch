---
phase: 16-calendar-layer
verified: 2026-05-27T00:00:00Z
status: human_needed
score: 15/15 must-haves verified (codebase-level); 6 mandatory HUMAN-UAT scripts pending
overrides_applied: 0
gaps: []
human_verification:
  - test: "Script 1 — Entry 1 create a series via Tonight tab"
    expected: "Pill CTA visible; modal opens; cadence/time/members save; doc lands in /watchpartySeries; row appears in Account tab"
    why_human: "iOS PWA tap flow + visual rendering"
  - test: "Script 2 — Entry 2 post-wp 'Make this recurring' (TV only)"
    expected: "Tile appears after a TV wp ends; movies/sports/untitled hide it; prefill matches wp.startAt dow + HH:MM in creator tz"
    why_human: "End-to-end wp-finish → tile → modal flow with prefill verification"
  - test: "Script 3 — Edit series cadence"
    expected: "Edit button opens modal in edit mode; titleType picker disabled; save fires updateDoc with allowlisted fields + nextFireAt=Date.now() reset"
    why_human: "Modal state toggle + server round-trip"
  - test: "Script 4 — Pause / Resume / Cancel"
    expected: "Pause clears nextFireAt + flips status; Resume sets nextFireAt=Date.now() + status=active; Cancel soft-deletes (status=ended); historical wps persist"
    why_human: "Multi-state lifecycle with confirm() prompt for cancel"
  - test: "Script 5 — Week view mobile + desktop"
    expected: "Calendar-view pill in Account tab opens 7-day grid; 7-col desktop / 1-col mobile via @media; today amber outline; tap-event navigates to wp"
    why_human: "Responsive breakpoint behavior + tap-to-navigate UX"
  - test: "Script 6 — 30-min seriesReminder push delivery"
    expected: "Push arrives 25-35 min before instance startAt; in-doc flag prevents double-fire; Settings toggle disables delivery per-user"
    why_human: "Real push delivery timing + APNs/FCM integration + Settings toggle round-trip"
  - test: "Script 7 (informational) — DST transition behavior"
    expected: "Spring-forward and fall-back weeks materialize within tolerance window; week-view renders correctly across DST boundary"
    why_human: "Time-sensitive observation (2x/year only); B1+B2 smoke cases cover the helper but not end-to-end UX"
---

# Phase 16: Calendar Layer Verification Report

**Phase Goal:** Recurring + multi-future watchparty scheduling. Title-anchored series ("American Idol every Monday at 8pm") and time-anchored series ("Family movie night every Friday at 7pm"), with a week-view planning surface and full series management UX. Launch-blocking per Nahder's 2026-05-27 decision.

**Verified:** 2026-05-27 (codebase-level only — HUMAN-UAT pending)
**Status:** human_needed (codebase delivers; 6 mandatory device-UAT scripts gate phase-shipped status)
**Re-verification:** No — initial verification

## Goal Achievement

### Phase Goal Recap (from 16-CONTEXT.md)

Two entry points ship: (1) Tonight-tab "Schedule a series" CTA → full creator modal; (2) post-wp "Make this recurring" tile for TV titles only, prefilled from wp.startAt. Backed by `watchpartySeries/{seriesId}` top-level Firestore primitive + every-6h `watchpartySeriesTick` materializer CF + DR-3 lockstep `seriesReminder` (T-30min) push + Account-tab series list with Pause/Resume/Cancel + in-place edit modal + 7-day week-view modal.

### Requirements Coverage (CAL-16-01..15)

| Req | Where Shipped | Plan | Status | Evidence |
|-----|---------------|------|--------|----------|
| CAL-16-01 | `firestore.rules` lines 993-1044 — `/watchpartySeries/{seriesId}` match block | 16-01 | VERIFIED | Block exists with full schema enforcement (titleType, daysOfWeek, timeOfDay regex, timezone, memberUids, etc.); 4 branches present |
| CAL-16-02 | Same rules block — 4 branches (read/create/update/delete) | 16-01 + 16-10 | VERIFIED | 12 emulator rules tests `#16-01..#16-12` in tests/rules.test.js:1572-1683 cover all branches |
| CAL-16-03 | `queuenight/functions/src/watchpartySeriesTick.js` (150 lines) | 16-03 | VERIFIED | Every-6h cron, us-central1, 256MiB, 24h horizon constant (line 28), query `where(status==active).where(nextFireAt<=horizon).orderBy(nextFireAt)` (lines 45-49). Exported via index.js:1978 |
| CAL-16-04 | Same CF lines 64-73 — deterministic wpId + existence check | 16-03 | VERIFIED | `wpId = series_${seriesDoc.id}_${instanceDateKey}` (line 68); `wpSnap.exists` short-circuit (line 73); en-CA locale ISO date key in family tz (line 67). smoke-series-idempotency.cjs B1+B2 negative-content guards (no Date.now / Math.random in wpId construction) PASS |
| CAL-16-05 | `queuenight/functions/index.js:1202-1234` — watchpartyTick TOP-LEVEL loop seriesReminder branch | 16-04 | VERIFIED | Gate on `wp.seriesId && status=='scheduled' && typeof startAt=='number'`; slop window 25-35 min; in-doc flag `reminders.seriesReminder.t-30min` set BEFORE fanOutToFamilies; per-user pref gating via `eventType: 'seriesReminder'` |
| CAL-16-06 | DR-3 lockstep across 3 places | 16-04 | VERIFIED | Server `NOTIFICATION_DEFAULTS.seriesReminder = true` at queuenight/functions/index.js:132; client `DEFAULT_NOTIFICATION_PREFS.seriesReminder = true` at js/app.js:490; client `NOTIFICATION_EVENT_LABELS.seriesReminder` at js/app.js:548. Friendly-UI NOTIF_UI_TO_SERVER_KEY intentionally skipped (Phase 28 PICK-28-17 precedent) |
| CAL-16-07 | `renderDayOfWeekPicker` at js/app.js:16232 + `.cadence-day-pill` CSS family | 16-06 | VERIFIED | 7-button DoW picker (S/M/T/W/T/F/S) with 44px touch target; reusable primitive (consumed by 16-07 edit + 16-08 Entry 2) |
| CAL-16-08 | Tonight-tab CTA injected via `renderTonight` + `#series-create-modal-bg` modal | 16-06 | VERIFIED | Modal at app.html:1304; `window.openSeriesCreate` at js/app.js:16298; `window.confirmStartSeries` at js/app.js:16615; setDoc(seriesRef(id), ...) with full validation |
| CAL-16-09 | `#wp-make-recurring-cta` tile + `window.openMakeRecurring` handler | 16-08 | VERIFIED | Tile at app.html:1397 (display:none default); handler at js/app.js:16505 with TV-only guard (`t.kind === 'TV'`); cadence inferred via Intl.DateTimeFormat from wp.startAt in wp.creatorTimeZone; defensive try/catch with Sun + 20:00 fallback |
| CAL-16-10 | `#series-list-card` Account-tab section + onSnapshot subscription | 16-05 | VERIFIED | Section at app.html:685; subscription at js/app.js:5249 (`collection(db, 'watchpartySeries')` with `where('memberUids', 'array-contains', state.auth.uid)`); teardown at sign-out (line 3502) + re-subscribe (line 5246); `renderSeriesListCard` at js/app.js:16097 |
| CAL-16-11 | `#week-view-modal-bg` + week-view handlers | 16-09 | VERIFIED | Modal at app.html:1344; `window.openWeekView` at js/app.js:16710; `renderWeekViewContent` at js/app.js:16733; 7-col grid + mobile @media (max-width: 599px) 1-col fallback; today amber outline; tap-event opens live modal for in-progress wps or navigates to Tonight banner |
| CAL-16-12 | Edit modal DOM-shared with create via state.seriesEdit.mode | 16-07 | VERIFIED | `window.openSeriesEdit` real handler at js/app.js:16372 (overrides stub at 16222 via plain reassignment — load-order win verified by automated assertion); `window.saveSeriesEdit` at js/app.js:16431; titleType picker disabled in edit mode; allowlist update payload; nextFireAt=Date.now() reset for CF re-materialization |
| CAL-16-13 | Pause/Resume/Cancel handlers | 16-05 | VERIFIED | `window.pauseSeries` at js/app.js:16151 (status='paused' + nextFireAt=null); `window.resumeSeries` at js/app.js:16168 (status='active' + nextFireAt=Date.now()); `window.cancelSeries` at js/app.js:16187 (status='ended' + endedAt + soft-delete; confirm() prompt). guardReadOnlyWrite gate applied |
| CAL-16-14 | sw.js CACHE bumped + cross-repo deploy ritual executed | 16-10 | VERIFIED | sw.js:8 `const CACHE = 'couch-v16-calendar'`; live production verified via `curl -s https://couchtonight.app/sw.js \| grep CACHE` returns `couch-v16-calendar`; landing + app both 200; queuenight commit `1563992` mirrored rules+indexes |
| CAL-16-15 | `firestore.indexes.json` composite indexes for watchpartySeries | 16-01 | VERIFIED | 2 entries (lines 31-44 + 45-62): `(status, nextFireAt)` for CF query + `(familyCode, status, nextFireAt)` for Account-tab list. Both `queryScope: "COLLECTION"` (not COLLECTION_GROUP per Plan 16-01 architectural decision). Mirrored in queuenight/firestore.indexes.json |

**Score:** 15/15 CAL-16 requirements verified at codebase level.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | watchpartySeries top-level Firestore primitive exists with full schema enforcement | VERIFIED | firestore.rules:993-1044; 12 emulator tests `#16-01..#16-12` cover all 4 branches |
| 2 | Materializer CF deployed and registered | VERIFIED | watchpartySeriesTick.js (150 lines, real implementation — not stub); index.js:1978 export; Plan 16-10 firebase functions:list confirms CREATE op completed |
| 3 | Two creation entry points wired (Tonight CTA + post-wp tile, TV-only for Entry 2) | VERIFIED | renderTonight CTA injection + openSeriesCreate + openMakeRecurring with TV-only guard |
| 4 | Account-tab series list view subscribes + renders + lifecycle handlers wire | VERIFIED | #series-list-card at app.html:685; onSnapshot at js/app.js:5249; renderSeriesListCard + pause/resume/cancel handlers |
| 5 | Edit modal reuses create modal DOM via state.seriesEdit.mode toggle | VERIFIED | openSeriesEdit real handler at js/app.js:16372 (later in file than stub — load-order win); saveSeriesEdit updateDoc with allowlist |
| 6 | Week-view modal renders 7-day grid responsive + tap-to-navigate | VERIFIED | #week-view-modal-bg at app.html:1344; renderWeekViewContent + tapWeekEvent; mobile @media (max-width: 599px) 1-col fallback |
| 7 | DR-3 lockstep seriesReminder wired across server + 2 client maps | VERIFIED | All 3 places present (DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS client + NOTIFICATION_DEFAULTS server); friendly-UI map intentionally skipped per documented convention |
| 8 | 30-min reminder push branch lives in TOP-LEVEL watchparty loop (not legacy nested) | VERIFIED | queuenight/functions/index.js:1202-1234 inside top-level loop; placement asserted at exec time (top anchor BEFORE, legacy nested anchor AFTER); fanOutToFamilies (not raw sendToMembers) handles cross-family resolution |
| 9 | All 4 Phase-16 smoke contracts pass + foundation smoke-app-parse passes | VERIFIED | smoke-series-cadence-compute 12/12, smoke-series-materializer 33/33, smoke-series-idempotency 11/11, smoke-app-parse 11/11. Total 67 sentinels green, ZERO failed |
| 10 | Cross-repo state: queuenight has CFs + rules + indexes mirror; couch has source-of-truth | VERIFIED | watchpartySeriesTick + computeNextFireAt in queuenight/functions/src/; rules mirrored at queuenight/firestore.rules:993; indexes mirrored at queuenight/firestore.indexes.json with 2 watchpartySeries entries |
| 11 | sw.js CACHE bumped + production verified | VERIFIED | sw.js:8 `couch-v16-calendar`; production curl returns same value |
| 12 | HUMAN-UAT scaffold created with 6 mandatory + 1 informational DST scripts | VERIFIED | 16-HUMAN-UAT.md (121 lines) exists with pre-flight checklist + 7 scripts |

**Score:** 12/12 observable truths verified at codebase level.

### Smoke Gate State (4 contracts × per-script sentinel counts)

Executed live at verification time (2026-05-27):

| Contract | Sentinels Passed | Sentinels Failed | Floor | Status |
|----------|------------------|------------------|-------|--------|
| `scripts/smoke-series-cadence-compute.cjs` | 12 | 0 | 8 | PASS — DST B1+B2 cases verified |
| `scripts/smoke-series-materializer.cjs` | 33 | 0 | 29 | PASS — A-F groups + DR-3 + reminder branch |
| `scripts/smoke-series-idempotency.cjs` | 11 | 0 | 9 | PASS — negative-content guards (no Date.now / Math.random in wpId) |
| `scripts/smoke-app-parse.cjs` | 11 | 0 | 6 | PASS — js/app.js + 9 other ES modules parse cleanly |

**Phase 16 smoke gate total: 67 sentinels green / 0 failed.**

Smoke contracts registered in `scripts/deploy.sh` §2.5 catch-up gate at lines 212-223 (all 3 Phase-16 smokes positioned BEFORE smoke-app-parse foundation gate per convention).

### Cross-Repo State Check

**couch repo (`C:/Users/nahde/claude-projects/couch`, source-of-truth):**

| Artifact | Path | Status |
|----------|------|--------|
| Rules block | firestore.rules:993-1044 | PRESENT |
| Composite indexes | firestore.indexes.json entries 31-44 + 45-62 | PRESENT (2 indexes, COLLECTION scope) |
| Smoke contracts | scripts/smoke-series-{cadence-compute,materializer,idempotency}.cjs | PRESENT (3 files) |
| Rules tests | tests/rules.test.js:1572-1683 (`#16-01..#16-12`) | PRESENT (12 tests) |
| sw.js CACHE | sw.js:8 = `couch-v16-calendar` | PRESENT |
| deploy.sh registrations | scripts/deploy.sh:212-223 | PRESENT (3 conditional blocks) |
| Client UI | app.html (4 anchors) + css/app.css (Phase 16 family at EOF) + js/app.js (CAL-16-* handlers) | PRESENT |
| HUMAN-UAT | .planning/phases/16-calendar-layer/16-HUMAN-UAT.md | PRESENT (121 lines, 7 scripts) |

**queuenight repo (`C:/Users/nahde/queuenight`, deploy mirror):**

| Artifact | Path | Status |
|----------|------|--------|
| Materializer CF | functions/src/watchpartySeriesTick.js (150 lines) | PRESENT |
| Cadence helper | functions/src/computeNextFireAt.js (88 lines) | PRESENT |
| CF export | functions/index.js:1978 `exports.watchpartySeriesTick = require('./src/watchpartySeriesTick').watchpartySeriesTick` | PRESENT |
| Reminder branch | functions/index.js:1202-1234 (watchpartyTick top-level loop seriesReminder branch) | PRESENT |
| Server NOTIFICATION_DEFAULTS.seriesReminder | functions/index.js:132 | PRESENT |
| Rules mirror | firestore.rules:993 (watchpartySeries match block) | PRESENT |
| Indexes mirror | firestore.indexes.json (2 watchpartySeries composites, COLLECTION scope) | PRESENT |

**Production verification:**

- `curl -s https://couchtonight.app/sw.js \| grep CACHE` → `const CACHE = 'couch-v16-calendar';` MATCHES sw.js source
- `curl https://couchtonight.app/` → HTTP 200 (landing serves)
- `curl https://couchtonight.app/app` → HTTP 200 (app shell serves)
- Plan 16-10 SUMMARY confirms `firebase functions:list` includes watchpartySeriesTick + watchpartyTick UPDATE (reminder branch added) + 2 composite indexes deployed

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|------|--------|---------|
| `renderTonight()` | `openSeriesCreate()` | Tonight CTA injection at function-end | WIRED | Visibility-gated on `state.familyCode && state.me && state.members.length >= 1`; idempotent querySelector guard prevents double-inject |
| `openSeriesCreate` | `confirmStartSeries` | Save button onclick (HTML default) | WIRED | Static `onclick="confirmStartSeries()"` in app.html:1335 |
| `confirmStartSeries` | Firestore `watchpartySeries` | `setDoc(seriesRef(id), ...)` | WIRED | seriesRef helper at js/app.js:2128; doc id pattern `series_<base36-timestamp>_<rand>` |
| `watchpartySeriesTick` CF | `watchpartySeries` query | `db.collection('watchpartySeries').where(...)` | WIRED | Query lines 45-49; backed by `(status, nextFireAt)` composite index |
| `watchpartySeriesTick` CF | `watchparties` doc write | `wpRef.set(wp)` | WIRED | Idempotent via wpSnap.exists check; admin SDK write fires onWatchpartyCreateTopLevel trigger for free per Phase 30 |
| `watchpartySeriesTick` CF | series advancement | `computeNextFireAt()` + `seriesDoc.ref.update()` | WIRED | computeNextFireAt imported at line 23; advancement at lines 128-137 |
| `watchpartyTick` CF | `seriesReminder` push | `fanOutToFamilies(wp, payload, { eventType: 'seriesReminder' })` | WIRED | Phase 30 canonical cross-family fan-out (corrects plan-literal sendToMembers which had memberUids vs memberIds bug — auto-fixed at exec time per 16-04 SUMMARY) |
| Account-tab subscription | `state.series` | `onSnapshot(query(collection(db, 'watchpartySeries'), where('memberUids', 'array-contains', state.auth.uid)))` | WIRED | js/app.js:5249; teardown at sign-out (3502) + re-subscribe (5246) |
| `renderSeriesListCard` | series rows | iterates `state.series` filtered + sorted | WIRED | escapeHtml on all user-controlled fields (T-16-20) |
| Edit button | `openSeriesEdit` real handler | row-markup `onclick="openSeriesEdit('${safeId}')"` | WIRED | Stub at js/app.js:16222 (gated by `typeof !== 'function'`); real handler at 16372 (unconditional reassignment) — load order guarantees real wins |
| `saveSeriesEdit` | Firestore update | `updateDoc(seriesRef(ed.id), { ...allowlist, nextFireAt: Date.now() })` | WIRED | Allowlist matches rules update branch; nextFireAt reset triggers CF re-materialization on next 6h tick |
| `openMakeRecurring` | `openSeriesCreate(prefill)` | Intl.DateTimeFormat cadence inference + pre-close source modal | WIRED | TV-only guard (`t.kind === 'TV'`); memberIds back-resolution from wp.memberUids via state.members |
| `openWeekView` | `renderWeekViewContent` | bucketing by `Math.floor((startAt - weekStart) / dayMs)` | WIRED | tapWeekEvent navigates: live → #wp-live-modal-bg directly; scheduled → showScreen('tonight') + renderTonight |
| `deploy.sh` §2.5 | smoke contracts | conditional `if [ -f scripts/smoke-series-X.cjs ]; then node ... \|\| exit 1; fi` | WIRED | All 3 contracts registered (lines 212-223); foundation smoke-app-parse remains LAST per ordering convention |
| Server `seriesReminder` key | client toggle in Settings | `DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS` lockstep | WIRED | DR-3 three-place lockstep complete; smoke Group E catches future drift |

All key links verified at code level.

### Data-Flow Trace (Level 4)

Series-materialized wps flow: User creates series via modal → `setDoc(seriesRef(id))` writes to /watchpartySeries → 6h tick fires → materializer CF queries active series with nextFireAt <= now+24h → builds wp doc with seriesId back-ref → `wpRef.set(wp)` writes to /watchparties → onWatchpartyCreateTopLevel trigger fires → Phase 30 push fan-out → memberUids receive "watchparty scheduled" push → wp surfaces in user's state.watchparties subscription → renders in Tonight banner + week-view grid. Reminder branch: watchpartyTick runs every 5 min, finds wps with seriesId + startAt in 25-35min window → sets in-doc flag → fanOutToFamilies seriesReminder push.

This trace is end-to-end real (not stub) per code inspection of every step. HUMAN-UAT scripts verify the full flow end-to-end on a real device.

### Anti-Patterns Found

None blocking. Spot checks for known-stub patterns:

- `return null;` in CF — present at line 52 + 149 of watchpartySeriesTick.js, but both are LEGITIMATE: line 52 is the query-failure early-return (sentry-equivalent for query crash); line 149 is the standard scheduler-CF "complete" return value. Not a stub.
- `return null;` in computeNextFireAt — present as defensive null-return for invalid input (T-16-13 mitigation); 16-02 SUMMARY documents this; smoke D1+D2 verify the null-return contract.
- `display:none` on tile/section anchors — all 4 instances (`#series-list-card`, `#wp-make-recurring-cta`, `#week-view-empty`, etc.) are intentional initial-hide states owned by JS toggle logic. Not stubs.
- `openSeriesEdit stub (plan 16-05)` sentinel — present at js/app.js:16219, 16223 — STUB INTENTIONALLY OVERRIDDEN by load-order win; real handler at line 16372. Audit-trail continuity per Plan 16-07 SUMMARY.

Zero TODO/FIXME/XXX/HACK markers in Phase 16 code paths (sampled via grep).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 4 smoke contracts pass | `node scripts/smoke-series-cadence-compute.cjs && node scripts/smoke-series-materializer.cjs && node scripts/smoke-series-idempotency.cjs && node scripts/smoke-app-parse.cjs` | 12+33+11+11 = 67 passed, 0 failed | PASS |
| Live cache matches source | `curl -s https://couchtonight.app/sw.js \| grep CACHE` | `const CACHE = 'couch-v16-calendar';` | PASS |
| Landing serves | `curl -s -o /dev/null -w "%{http_code}" https://couchtonight.app/` | 200 | PASS |
| App shell serves | `curl -s -o /dev/null -w "%{http_code}" https://couchtonight.app/app` | 200 | PASS |
| watchpartySeriesTick CF deployed | `firebase functions:list --project queuenight-84044` (per 16-10 SUMMARY) | watchpartySeriesTick listed (CREATE op succeeded) | PASS (per SUMMARY; not re-verified live in this pass) |
| Composite indexes BUILT | Firebase console → Firestore → Indexes | Per 16-10 SUMMARY: "2 new composite indexes created" — BUILD status async (5-30min) | INFORMATIONAL — pre-flight item in HUMAN-UAT |

### Open Items

**1. Mandatory HUMAN-UAT (6 device scripts) — gates phase-shipped status.**

Per `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` (frontmatter `device_uat_status: pending`):

- Script 1 — Entry 1 create via Tonight tab
- Script 2 — Entry 2 post-wp "Make this recurring" (TV only)
- Script 3 — Edit series cadence
- Script 4 — Pause / Resume / Cancel
- Script 5 — Week view mobile + desktop
- Script 6 — 30-min seriesReminder push delivery

Resume signal: `uat passed` → re-run `/gsd-verify-work 16` to flip status to `passed`.

**2. Script 7 (informational only) — DST transition verification.** Time-sensitive observation (2x/year); B1+B2 smoke cases cover the helper but not end-to-end UX. Not blocking for v1 launch.

**3. REQUIREMENTS.md Pending → Complete deferral (intentional convention).** All 15 CAL-16-01..15 entries in REQUIREMENTS.md are marked **Pending** despite shipped to production. Per 16-10 SUMMARY: "Pending → Complete status flip is DEFERRED to a future audit-trail backfill phase mirroring Phase 15.6 + Phase 31-05 precedent." This is established convention, NOT an oversight.

**4. STATE.md update.** Plan 16-10 close-out was on `hotfix/phase-30-cross-cutting-wave` branch. STATE.md will reflect 10/10 plans complete + Phase 16 SHIPPED (status `complete pending verify`) when this branch lands on main. Code is live in production via this branch's deploys; STATE entry catch-up is separate.

**5. Launch-blocking checklist (per MEMORY).** Phase 16 SHIPPED was launch-blocking. Remaining gates before App Store "Add for Review":
- ASC screenshot re-upload (user-side)
- Namecheap press@ forwarder (user-side)
- Phase 16 HUMAN-UAT pass (this verifier flagged it)

**6. Branch context — Production shipped from hotfix branch.** The Phase 16 SHIPPED deploys (queuenight functions + couch hosting + cache `couch-v16-calendar`) all completed from `hotfix/phase-30-cross-cutting-wave` per 16-10 SUMMARY. The work is LIVE in production today; the branch must eventually land on main for repo history continuity. Not blocking for verifier purposes.

### Gaps Summary

**No codebase gaps.** All 15 CAL-16 requirements verified to ship via real source code (not stubs). All 12 observable truths verified. All key links wired. All 4 smoke contracts pass live (67 sentinels green). 12 emulator rules tests cover all 4 rules branches. Production verified via curl (cache match + 200s). Cross-repo state coherent (couch source-of-truth + queuenight mirror both have rules + indexes; queuenight has CFs).

**Status is `human_needed` (not `passed`) because:** the phase explicitly defers 6 mandatory device-UAT scripts to `.planning/phases/16-calendar-layer/16-HUMAN-UAT.md` per established Phase 18/19/26/27/28 precedent. Codebase-level acceptance is complete; final "phase-shipped" status gates on the 6 device scripts being walked by the user on iPhone PWA. This is the documented, intentional convention — the verifier is not flagging missing work, it is flagging a known human-only verification step that the orchestrator + planner explicitly scoped out of automated coverage.

## Verdict

**PASSED (codebase-level) with HUMAN-UAT gate pending.**

The codebase delivers everything Phase 16 promised:

- Foundation: Firestore primitive + rules block + 2 composite indexes + 12 emulator tests
- Backend: materializer CF + cadence helper + reminder push branch + DR-3 lockstep across both repos
- Client: Account-tab list + 2 entry points (Tonight CTA + post-wp tile) + edit modal + week-view modal + Pause/Resume/Cancel
- Operations: sw.js CACHE bumped + deploy ritual executed + smoke contracts registered + HUMAN-UAT scaffolded
- Production: `couch-v16-calendar` live; watchpartySeriesTick deployed; rules + indexes mirrored

Six device scripts remain (Scripts 1-6 in 16-HUMAN-UAT.md). After Nahder walks them and signals `uat passed`, re-run `/gsd-verify-work 16` to flip status to `passed` and unblock App Store "Add for Review" (plus the 2 user-side ASC + Namecheap gates per MEMORY).

---
*Verified: 2026-05-27*
*Verifier: Claude (gsd-verifier)*
