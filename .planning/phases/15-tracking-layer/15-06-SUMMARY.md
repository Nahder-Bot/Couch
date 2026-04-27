---
phase: 15
plan: 06
subsystem: cloud-functions-live-release-sweep
tags: [tracking-layer, cloud-functions, watchpartyTick, live-release, REVIEW-HIGH-3, REVIEW-HIGH-4, REVIEW-LOW-MEDIUM-11, REVIEW-MEDIUM-12]
requires:
  - 15-01 firestore.rules client-DENY for liveReleaseFiredFor (verified at firestore.rules:366) — admin SDK bypass remains the only write path
  - 15-01 watchparties composite index (titleId asc, startAt asc) — D-16 suppression query depends on it
  - watchpartyTick CF (functions/index.js:642) — extension target
  - sendToMembers helper (functions/index.js:111) — used as fan-out primitive
  - NOTIFICATION_DEFAULTS server-side gate (functions/index.js:74) — extended in Task 1
provides:
  - "8th NOTIFICATION_DEFAULTS key newSeasonAirDate: true (server-side gate matching client DEFAULT_NOTIFICATION_PREFS shipped in 15-07)"
  - "Per-titles live-release sweep block inside watchpartyTick: HIGH-3 hourly throttle + HIGH-4 stale-data skip + LOW/MEDIUM-11 23h-26h window + MEDIUM-12 'New episode {when}' framing"
  - "Family-doc cursor liveReleaseSweepLastRunAt + telemetry sub-doc liveReleaseSweepStats {sweptCount, staleCount, firedCount, suppressedCount, at}"
  - "Per-title rate-limit timestamp liveReleaseStaleLoggedAt (caps Sentry breadcrumb category='liveReleaseStale' to once per day per title)"
  - "Idempotency markers t.liveReleaseFiredFor[`s{N}e{M}`] = now | 'suppressed_existing_wp' | 'suppression_query_failed'"
  - "Push payload: title 'New episode {tonight|tomorrow|Weekday}', body '{Show} S{N}E{M} — watch with the couch?', tag 'live-release-{titleId}-{epKey}', url '/?nominate={titleId}&prefillTime={airTs}', eventType 'newSeasonAirDate'"
affects:
  - "Plan 15-07 (client-side push triad): NOTIFICATION_EVENT_LABELS hint copy must align with REVIEW MEDIUM-12 framing — 'New episode alerts' semantic (per-episode prompts, not new-season-only). Key 'newSeasonAirDate' is preserved for D-12 back-compat; only the user-facing label/copy is reframed."
  - "Plan 15-08 (cross-repo deploy ritual close-out): MUST commit + deploy queuenight/functions/index.js AFTER 15-01 rules+indexes are deployed AND the watchparties composite index has finished BUILDING (1-5 min)."
  - "Telemetry surface: liveReleaseSweepStats (per family per sweep) + liveReleaseStaleLoggedAt (per title) + Sentry breadcrumb category='liveReleaseStale' — verifier should sample these post-deploy to inform whether v2 needs CF-side TMDB refresh."
tech-stack:
  added:
    - "Per-family throttle cursor pattern: families/{code}.liveReleaseSweepLastRunAt + read-skip-write at end-of-sweep (HIGH-3 reduces per-tick CF load by 12x)"
    - "Per-title stale-data skip pattern with daily-rate-limited Sentry breadcrumb (HIGH-4 surfaces gap frequency without breadcrumb noise)"
    - "Flag-then-fire idempotency stamp pattern (matches existing warned30 pattern at functions/index.js:806 from Phase 14-06 Branch C)"
  patterns:
    - "Mirrors Phase 14-06 Branch B/C structure: per-doc try/catch isolation, idempotency-flag-before-side-effect, sendToMembers fan-out with eventType gate"
    - "Mirrors Phase 14-06 deviation pattern: queuenight edits applied in-place but NOT committed; deferred to Plan 15-08 cross-repo deploy ritual"
    - "Per-family-loop iteration shape preserved (no new top-level CF; no new onSchedule trigger; sweep lives between intents-loop close and outer-family-loop close)"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-06-SUMMARY.md (this worktree — committed)"
  modified:
    - "~/queuenight/functions/index.js (CANONICAL — uncommitted, deferred to 15-08; 191 insertions, 1 deletion of the trailing comma after intentExpiring)"
decisions:
  - "Preserved the eventType KEY 'newSeasonAirDate' for D-12 back-compat with already-installed PWAs reading notificationPrefs[oldKey]. Renaming the key would be a breaking change; defer key rename to a v2 migration plan. Only the user-facing LABEL/COPY (15-07 NOTIFICATION_EVENT_LABELS + this CF's push body) reflects MEDIUM-12 per-episode framing."
  - "Used flag-then-fire ordering for liveReleaseFiredFor idempotency — set epKey timestamp BEFORE awaiting sendToMembers. If the push await fails after the flag is set, accept push loss (per D-15 cadence model) rather than retry-and-double-fire."
  - "On suppression-query failure (composite-index missing or transient Firestore error), stamp liveReleaseFiredFor[epKey] = 'suppression_query_failed' and skip — prevents retry-storm on subsequent ticks; the missing index is observable in CF logs."
  - "Per-title liveReleaseStaleLoggedAt timestamp rate-limits the Sentry breadcrumb to AT MOST once per day per title — keeps telemetry actionable without flooding Sentry on a long-tail of stale-tracked shows."
metrics:
  duration_seconds: 480
  duration_minutes: 8
  task_count: 2
  file_count: 1
  worktree_commits: 1
  queuenight_pending_commits: 1
  completed: "2026-04-27"
---

# Phase 15 Plan 06: CF Live-Release Sweep (watchpartyTick Extension) Summary

**One-liner:** Extends the existing watchpartyTick Cloud Function with a per-titles live-release sweep that fires `newSeasonAirDate` pushes for tracked TV titles whose next episode airs within 23-26h, gated by the ≥2-tracker threshold (D-14), suppressed when an existing watchparty covers the slot (D-16), throttled to once-per-hour per family (REVIEW HIGH-3 — 12x runtime reduction vs naive per-tick), skip-with-Sentry-telemetry on stale TMDB data (REVIEW HIGH-4), 23-26h window absorbing hourly tick-drift (REVIEW LOW/MEDIUM-11), and per-episode push framing (REVIEW MEDIUM-12). Two-repo discipline: queuenight commit + deploy deferred to 15-08.

---

## What Shipped

### a) NOTIFICATION_DEFAULTS — 8th key (Task 1)

`~/queuenight/functions/index.js` lines **96-103** (post-edit; was line 95-96 before):

```javascript
  flowBConvert: true,
  intentExpiring: true,
  // === Phase 15 / D-11 + D-12 (TRACK-15-09 — DR-3 place 1 of 3) — auto-subscribe on watch ===
  // Per REVIEW MEDIUM-12: the KEY 'newSeasonAirDate' is preserved for D-12
  // back-compat, but the user-facing label/copy ships in 15-07 + this CF body
  // describes per-EPISODE prompts (not new-season-only). Rename of the key
  // would be a breaking change for already-installed PWAs reading
  // notificationPrefs[oldKey]; defer key rename to a v2 migration plan.
  newSeasonAirDate: true
```

The 8th key joins the 6 P6 + 7 P14 entries already present. Server-side gate at `sendToMembers` line 126 (`NOTIFICATION_DEFAULTS[eventType]`) now recognizes `'newSeasonAirDate'` and falls back to default-on (`true`) when a recipient hasn't explicitly toggled it.

### b) watchpartyTick — per-titles live-release sweep (Task 2)

`~/queuenight/functions/index.js` lines **852-1033** (the new sweep block):
- **Lives between** the intents-loop close (line 850) and the outer family-loop close (line 1034).
- **Insertion is additive only** — no existing line in watchpartyTick state-flips, intents Branch A/B/C, or sendToMembers was modified.
- **Block size:** 182 lines (sweep block body) — exceeds the plan's "min_lines: 100" artifact requirement.

The sweep does, in order, per family:

1. **HIGH-3 throttle gate** (lines 867-874): reads `familyData.liveReleaseSweepLastRunAt`; if `(now - lastSweep) < HOURLY_MS`, `continue` to next family. Skips ~92% of ticks per family (5-min cadence × 12 = 60min).
2. **Titles list** (lines 876-882): wrapped in try/catch; on error, `continue` to next family.
3. **Per-title loop** (lines 891-1020) for each `tdoc`:
   - Cheap early exits: `t.kind !== 'TV'`, empty `t.tupleProgress`.
   - **HIGH-4 stale-data guard** (lines 894-924): if `!t.nextEpisode` OR `(now - t.nextEpisodeRefreshedAt) > 7 days`, increment `staleCount`, write `liveReleaseStaleLoggedAt: now` (rate-limited daily), emit Sentry breadcrumb `category='liveReleaseStale'` with `{familyCode, titleId, hasNextEpisode, refreshedAtAgeDays}`, `continue`.
   - Subscriber-set computation (lines 933-948): union of comma-split tupleKeys MINUS members in `t.mutedShows`.
   - **D-14 threshold** (line 950): `if (subscriberIds.size < 2) continue;`
   - **D-13 + LOW/MEDIUM-11 window** (lines 952-961): `airTs = new Date(next.airDate + 'T21:00:00').getTime()`; `minsToAir = (airTs - now) / 60000`; gate on `minsToAir > 60 * 23 && minsToAir <= 60 * 26` (widened upper bound from 25h to 26h to absorb hourly tick-drift).
   - Idempotency check (lines 963-965): `if (t.liveReleaseFiredFor && t.liveReleaseFiredFor[epKey]) continue;`
   - **D-16 suppression query** (lines 967-994): compound query on watchparties (titleId == tdoc.id, startAt within ±90min of airTs); if any non-archived/non-cancelled wp blocks, stamp `liveReleaseFiredFor.{epKey} = 'suppressed_existing_wp'` and `continue`. On query error (index missing / transient), stamp `'suppression_query_failed'` and `continue` (prevents retry-storm).
   - **MEDIUM-12 push framing** (lines 998-1006): `daysOut = Math.round((airTs - now) / 86400000)`; `when = 'tonight' | 'tomorrow' | <Weekday>`; title = `New episode ${when}`; body = `${showName} S${N}E${M} — watch with the couch?`.
   - **Flag-then-fire** (lines 1008-1019): write `liveReleaseFiredFor.{epKey} = now` BEFORE awaiting `sendToMembers`, with `eventType: 'newSeasonAirDate'`, `tag: 'live-release-{titleId}-{epKey}'`, `url: '/?nominate={titleId}&prefillTime={airTs}'`. On push failure, flag stays set (accept push loss per D-15 cadence model).
4. **HIGH-3 cursor update** (lines 1023-1032): writes `liveReleaseSweepLastRunAt: now` + `liveReleaseSweepStats: {sweptCount, staleCount, firedCount, suppressedCount, at: now}` on the family doc.

### c) Verification grep matrix

All acceptance grep counts pass (run against post-edit `~/queuenight/functions/index.js`):

| Acceptance | Required | Actual |
|---|---|---|
| `newSeasonAirDate: true` | ≥1 | 1 |
| `Phase 15 / D-11 + D-12 (TRACK-15-09` | ≥1 | 1 |
| Phase 15 sweep header marker | =1 | 1 |
| `REVIEW HIGH-3` | ≥2 | 3 |
| `REVIEW HIGH-4` | ≥1 | 2 |
| `liveReleaseSweepLastRunAt` | ≥3 | 3 |
| `(now - lastSweep) < HOURLY_MS` | =1 | 1 |
| `STALE_NEXT_EPISODE_MS` | ≥2 | 2 |
| `nextEpisodeRefreshedAt` | ≥1 | 3 |
| `category: 'liveReleaseStale'` | =1 | 1 |
| `60 * 26` | ≥1 | 1 |
| `60 * 23 \|\| minsToAir > 60 * 26` | =1 | 1 |
| `New episode ` | ≥1 | 4 |
| `watch with the couch?` | ≥1 | 2 |
| `eventType: 'newSeasonAirDate'` | =1 | 1 |
| `subscriberIds` | ≥5 | 6 |
| `tupleProgress` | ≥2 | 3 |
| `where('titleId', '==', tdoc.id)` | =1 | 1 |
| `node --check functions/index.js` | exit 0 | exit 0 (PARSE_OK) |

`git diff --stat` confirms additions only: **191 insertions, 1 deletion** (the trailing comma flip on the prior `intentExpiring: true` line). `sendToMembers` (now at line 111, was 104; shifted by 7 lines from the NOTIFICATION_DEFAULTS comment + key insertion) was not touched. The intents loop's Branch A/B/C bodies (lines 723-849) are unmodified.

---

## CF-only Contract Verification (15-01 forward-contract)

Per the 15-01 SUMMARY + the forward_contract_from_15_01 brief: ALL `liveReleaseFiredFor` mutations live INSIDE the CF and write via the admin SDK (`tdoc.ref.update({[`liveReleaseFiredFor.${epKey}`]: ...})`). No client-side write paths exist or were added by this plan.

Verification of the client-DENY rule was performed before implementation:
- `firestore.rules` line 366: `!request.resource.data.diff(resource.data).affectedKeys().hasAny(['liveReleaseFiredFor'])` (in the `match /titles/{titleId}` UPDATE branch — explicit DENY for ANY client write touching the field).
- `firestore.rules` line 338: documentation comment "liveReleaseFiredFor.{epKey} — CLIENT WRITES DENIED; CF-only via …".

The CF admin SDK bypasses Firestore rules entirely, so all three write sites in this plan's sweep block (`'suppression_query_failed'` stamp at line 989, `'suppressed_existing_wp'` stamp at line 996, fire-flag stamp at line 1009) succeed independent of the deny rule.

---

## Deviations from Plan

### Auto-fixed Issues

None. Both tasks executed exactly as written. No bugs, no missing critical functionality, no blocking issues.

### Auth gates / Human action

None. All work was deterministic edits to a JS source file.

### Items NOT changed (per scope)

- **`~/queuenight/functions/index.js` is NOT committed in queuenight's git** — per the cross_repo_note + Phase 14-06 two-repo discipline pattern (also seen in 14-09 + 14-10 + 15-01). Plan 15-08 close-out picks this up.
- **No couch-side files modified** — this plan touches ONLY queuenight CF code. The worktree commit is the SUMMARY.md only.
- **No client-side push triad changes** — the 8th key in client `DEFAULT_NOTIFICATION_PREFS` and `NOTIFICATION_EVENT_LABELS` is in 15-07.
- **No CF-side TMDB refresh** — accepted "best effort" per REVIEW HIGH-4; telemetry surfaces (Sentry breadcrumb + sweep stats) will inform whether v2 needs it.
- **Throttle uses simple per-family cursor**, not a sharded distributed lock — at v1 family scale (~10s of families), per-family per-tick read of one timestamp is cheap and correct under the existing CF schedule (single instance, no concurrent invocations of the same family loop per the `every 5 minutes` + 256MiB + 120s timeout config at lines 642-647).

---

## Two-Repo Discipline — Pending Queuenight Commit

Per the cross_repo_note and the Phase 14-06 deviation pattern (continued from 14-09 + 14-10 + 15-01):

| File | Status in queuenight repo | Picked up by |
|------|---------------------------|--------------|
| `~/queuenight/firestore.rules` | EDITED IN-PLACE; uncommitted (from 15-01) | Plan 15-08 (cross-repo deploy ritual Step 1) |
| `~/queuenight/firestore.indexes.json` | EDITED IN-PLACE; uncommitted (from 15-01) | Plan 15-08 (cross-repo deploy ritual Step 1) |
| `~/queuenight/functions/index.js` | EDITED IN-PLACE; uncommitted (THIS plan) | Plan 15-08 (cross-repo deploy ritual Step 4) |

**Confirmed via `cd ~/queuenight && git status --short` post-Task-2:**
```
 M firestore.indexes.json
 M firestore.rules
 M functions/index.js
```

**Plan 15-08 (cross-repo deploy ritual close-out) MUST execute, in order:**
1. `cd ~/queuenight && git add firestore.rules firestore.indexes.json && git commit -m "feat(15): Phase 15 rules + first composite index"` (or two separate commits if 15-08 prefers per-plan attribution — single commit per the 15-01 note)
2. `firebase deploy --only firestore:rules,firestore:indexes --project queuenight-84044`
3. **Wait 1-5 minutes** for the watchparties composite index to finish BUILDING (Firebase Console → Firestore → Indexes; status Building → Enabled). The 15-06 CF's D-16 suppression query depends on this index — if deployed before the index is Enabled, every query will fail and stamp `'suppression_query_failed'` for every tracked title's epKey.
4. `cd ~/queuenight && git add functions/index.js && git commit -m "feat(15-06): watchpartyTick live-release sweep (HIGH-3 throttle + HIGH-4 stale guard + LOW/MEDIUM-11 widened window + MEDIUM-12 framing)"`
5. `firebase deploy --only functions --project queuenight-84044`
6. `bash scripts/deploy.sh <short-tag>` from couch repo (mirror + hosting deploy — this picks up 15-07 client work + 15-08 final mirror sync)

---

## Notes for Plan 15-07 (client-side push triad)

- The 8th key `newSeasonAirDate` is now in the SERVER `NOTIFICATION_DEFAULTS`. The client `DEFAULT_NOTIFICATION_PREFS` (in `js/app.js`) MUST mirror this — same key, same default value (`true`), same insertion position relative to the 7 P14 keys (after `intentExpiring`).
- The `NOTIFICATION_EVENT_LABELS` user-facing copy for `newSeasonAirDate` MUST align with REVIEW MEDIUM-12 framing: **"New episode alerts"** (per-episode prompts), NOT "New season air dates" (would mislead — the CF fires per-episode, not per-season). The KEY stays `newSeasonAirDate` for D-12 back-compat — only the LABEL is reframed.
- Push body actually delivered: `"{Show} S{N}E{M} — watch with the couch?"` with title `"New episode {tonight|tomorrow|Weekday}"`. The 15-07 NOTIFICATION_EVENT_LABELS hint copy should match this register.

---

## Notes for Plan 15-08 (cross-repo deploy ritual)

- Cross-repo deploy ordering is locked: **rules → indexes → CFs → app**. Specifically: 15-01 rules+indexes commit+deploy MUST land before 15-06 CF commit+deploy, AND the watchparties composite index MUST be in Enabled state (not Building) before the 15-06 CF's first sweep tick.
- Sentry CF instrumentation: this plan's `category: 'liveReleaseStale'` breadcrumb assumes Sentry is already initialized in the CF runtime. If 15-08 detects no Sentry SDK is loaded, the `typeof Sentry !== 'undefined'` guard will short-circuit silently — telemetry just won't appear. 15-08 deploy gate should verify Sentry SDK initialization in the CF entry point (search for `Sentry.init` near top of `~/queuenight/functions/index.js`).
- liveReleaseSweepStats is written on every sweep — verifier should sample one family doc post-deploy to confirm the schema lands correctly.

---

## Notes for verifier (15-VERIFY)

Smoke tests must verify:
1. **One-hour cadence (NOT 5-min)** — REVIEW HIGH-3. After deploy, observe that `liveReleaseSweepLastRunAt` on a family doc updates AT MOST once per hour despite the 5-min CF schedule.
2. **Widened 26h upper bound** — REVIEW LOW/MEDIUM-11. A title with `next.airDate` set such that `minsToAir` falls between 25h and 26h MUST be picked up by the sweep (would have been excluded under the 25h cap).
3. **Stale-data guard + Sentry breadcrumb** — REVIEW HIGH-4. A title with `nextEpisodeRefreshedAt` older than 7 days MUST be skipped, and the Sentry breadcrumb MUST appear in Sentry within 5 minutes (subject to Sentry's own ingestion latency).
4. **Push framing** — REVIEW MEDIUM-12. Push title MUST read `"New episode tonight"` (NOT `"airs tonight"`); body MUST read `"{Show} S{N}E{M} — watch with the couch?"`.
5. **Subscriber threshold + muted exclusion** — D-14 + D-12. A title with only 1 tracker MUST NOT fire. A title with 2 trackers where one has muted the show MUST NOT fire (drops below threshold after mute exclusion).
6. **D-16 suppression** — A title that would otherwise fire BUT has an existing watchparty within ±90min of airTs MUST mark `liveReleaseFiredFor[epKey] = 'suppressed_existing_wp'` and NOT fire.
7. **Idempotency** — A second tick within the same hour MUST be skipped by the HIGH-3 throttle (verified by `liveReleaseSweepLastRunAt` not updating). Even across hours, a title with `liveReleaseFiredFor[epKey]` set MUST NOT re-fire.

---

## Verification Evidence

```
$ cd ~/queuenight && node --check functions/index.js
PARSE_OK

$ cd ~/queuenight && git status --short
 M firestore.indexes.json
 M firestore.rules
 M functions/index.js

$ cd ~/queuenight && git diff --stat functions/index.js
 functions/index.js | 192 ++++++++++++++++++++++++++++++++++++++++++++++++++++-
 1 file changed, 191 insertions(+), 1 deletion(-)
```

All 17 success_criteria items in `15-06-PLAN.md` satisfied:
1. ✓ NOTIFICATION_DEFAULTS includes `newSeasonAirDate: true` as the 8th key.
2. ✓ Sweep block lives AFTER intents loop close (line 850) and BEFORE outer-family-loop close (line 1034).
3. ✓ HIGH-3 hourly throttle: cursor read at line 870, write at line 1024-1027, skip-condition at line 871.
4. ✓ HIGH-4 stale guard: `STALE_NEXT_EPISODE_MS` declared at line 868, used at line 894; Sentry breadcrumb category='liveReleaseStale' at line 909; daily rate-limit via `liveReleaseStaleLoggedAt` at line 901.
5. ✓ LOW/MEDIUM-11 widened window: `if (minsToAir <= 60 * 23 || minsToAir > 60 * 26) continue;` at line 961.
6. ✓ MEDIUM-12 push framing: title `New episode ${when}` at line 1004, body `${showName} S${next.season}E${next.episode} — watch with the couch?` at line 1006.
7. ✓ Subscriber set: union of comma-split tuple keys at lines 935-940, minus muted at lines 943-947.
8. ✓ D-14 threshold: `if (subscriberIds.size < 2) continue;` at line 950.
9. ✓ D-16 suppression with `'suppressed_existing_wp'` stamp at line 996.
10. ✓ Flag-then-fire: stamp at line 1009, fire at line 1014 (idempotency flag set before push).
11. ✓ Push tag `live-release-${tdoc.id}-${epKey}` at line 1015.
12. ✓ Push url `/?nominate=${tdoc.id}&prefillTime=${airTs}` at line 1016.
13. ✓ eventType `'newSeasonAirDate'` at line 1017.
14. ✓ liveReleaseSweepStats sub-doc written at line 1026.
15. ✓ Per-title try/catch isolation: titles list (876-882), stale stamp (897-899), Sentry call (903-921), suppression query (969-993), suppress stamp (995-997), fire stamp (1009-1013), push (1014-1019), cursor update (1023-1032). Every async I/O is guarded.
16. ✓ `node --check functions/index.js` exits 0.
17. ✓ Commit + deploy deferred to 15-08 — confirmed by `git status --short` showing functions/index.js as M (modified, uncommitted).

---

## Commits (this worktree)

| Hash | Type | Subject |
|------|------|---------|
| (this commit) | docs | complete 15-06 live-release sweep plan |

Note: This plan modifies ONLY queuenight files (no couch-side code), so the worktree commit history contains the SUMMARY.md only. The queuenight `functions/index.js` edits will be committed separately by Plan 15-08 in the queuenight repo.

---

## Self-Check: PASSED

Files exist:
- FOUND: `~/queuenight/functions/index.js` (1218 lines post-edit; contains Phase 15 D-11+D-13 sweep marker + 8th NOTIFICATION_DEFAULTS key)
- FOUND: `.planning/phases/15-tracking-layer/15-06-SUMMARY.md` (this file — about to be committed)

Commits exist:
- (Worktree commit hash will be recorded after `git commit` runs immediately after this Self-Check section.)

All success criteria from the plan satisfied (see "Verification Evidence" above).

Stub/threat-flag scan:
- No stubs introduced — all writes flow real telemetry data.
- No new threat surfaces beyond those enumerated in the plan's `<threat_model>` (T-15-06-01 through T-15-06-08, all already mitigated).
