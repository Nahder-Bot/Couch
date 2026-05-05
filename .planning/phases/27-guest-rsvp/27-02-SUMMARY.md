---
phase: 27-guest-rsvp
plan: 02
subsystem: validation-surface
tags:
  - guest-rsvp
  - firestore-rules
  - rules-tests
  - smoke-tests
  - validation
  - admin-sdk-bypass

# Dependency graph
requires:
  - phase: 27-guest-rsvp
    plan: 01
    provides: rsvpSubmit transactional upsert + rsvpStatus + rsvpRevoke CFs (admin-SDK; smoke scaffold references their helper contracts inline)
provides:
  - "firestore.rules carries an admin-SDK-bypass annotation inside /watchparties/{wpId} (zero rule predicate changes)"
  - "tests/rules.test.js + 1 seed (wp_phase27_test) + 1 describe block ('Phase 27 Guest RSVP rules') with 4 assertions; 52/0 passing (was 48/0)"
  - "scripts/smoke-guest-rsvp.cjs scaffold (119 lines, 17 helper-behavior assertions across 4 families: guestId regex / name-collision render / response normalization / visibleGuestCount)"
  - "package.json scripts.smoke chain extended to 10 contracts; new smoke:guest-rsvp per-contract alias"
affects:
  - 27-03 (rsvp.html — relies on guestId regex + response normalization helpers contract)
  - 27-04 (app.html roster — relies on displayGuestName + visibleGuestCount helpers contract)
  - 27-05 (rsvpReminderTick + cross-repo deploy — extends smoke contract to >=13 final floor with guest-loop + production-code sentinels)

# Tech tracking
tech-stack:
  added:
    - "no new runtime deps; smoke scaffold is pure node + crypto (built-in)"
  patterns:
    - "Comment-only firestore.rules edit pattern — annotate admin-SDK bypass without modifying any predicate"
    - "Append-only rules.test.js extension — new seed adjacent to existing seed; new describe block before testEnv.cleanup()"
    - "Inline-helper smoke scaffold — verbatim copy of canonical implementation; drift forces explicit re-sync (no module require to keep zero deps)"
    - "Per-contract alias + chained aggregate dual-wiring in package.json scripts (mirrors existing 9 smoke contracts)"

key-files:
  created:
    - "C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs (119 lines, 17 assertions)"
    - "C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-02-SUMMARY.md (this file)"
  modified:
    - "C:/Users/nahde/claude-projects/couch/firestore.rules (+7 lines, comment-only inside /watchparties/{wpId})"
    - "C:/Users/nahde/claude-projects/couch/tests/rules.test.js (+60 lines: 1 new seed + 1 new describe block with 4 assertions)"
    - "C:/Users/nahde/claude-projects/couch/package.json (+1 entry, +1 chain step in scripts.smoke)"

key-decisions:
  - "Phase 27 comment block lives INSIDE the /watchparties/{wpId} match block (line 578, immediately before allow read:) rather than at file top — anchors the bypass note to the affected resource so future archaeologists don't have to cross-reference."
  - "Test IDs use #27-01..#27-04 convention rather than the Phase 24 #wpN convention — the plan locked this naming; matches the substring 'Phase 27' grep gate so the smoke-style verifier catches the describe block."
  - "Smoke scaffold inlines the four helpers as verbatim copies (vs requiring queuenight/functions/index.js) — keeps the contract zero-dep + zero-skip; the inline copies act as drift detectors when Plan 03/04/05 import the canonical helpers from production code."
  - "package.json scripts.smoke aggregate now ends with smoke-guest-rsvp.cjs — placement matters for the floor meta-assertion in Plan 05 (Plan 05 extends THIS file, not a new one)."

patterns-established:
  - "Rules-test seed shape for Phase 27 wp doc: { hostId, hostUid, hostName, titleId, titleName, startAt, state, status, participants, guests:[], guestCount:0, rsvpClosed:false } — Plan 03/04 can extend wp_phase27_test in-place if they need additional rule assertions."
  - "Smoke contract scaffold pattern for Phase N: pure inline helpers (no graceful skip needed) + 4 numbered families (1.x / 2.x / 3.x / 4.x) + simple eq()/eqObj() helpers + final 'X passed, Y failed' line + non-zero exit on failure."

requirements-completed:
  - RSVP-27-05
  - RSVP-27-06
  - RSVP-27-11
  - RSVP-27-14

# Metrics
duration: ~3min
completed: 2026-05-02
---

# Phase 27 Plan 02: Validation Surface Summary

**Locks the Phase 27 validation floor before any client-side or reminder-loop code ships — annotates firestore.rules with the admin-SDK-bypass rationale (zero predicate changes), adds a 4-assertion 'Phase 27 Guest RSVP rules' describe block to tests/rules.test.js (now 52/0 passing), and scaffolds scripts/smoke-guest-rsvp.cjs with 17 helper-behavior assertions covering guestId format / name-collision / response normalization / visibleGuestCount, wired into the npm run smoke aggregate as the 10th contract.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-02T02:41:20Z
- **Completed:** 2026-05-02T02:44:39Z
- **Tasks:** 3 / 3
- **Files modified:** 4 (1 created, 3 modified)
- **Test runs:** rules-tests 52/0 PASS (was 48/0); smoke aggregate 10/10 PASS (was 9/9)

## Accomplishments

- `firestore.rules` carries a 7-line Phase 27 admin-SDK-bypass comment block (lines 578-584) inside `/watchparties/{wpId}`, immediately before `allow read:`. Zero rule predicate changes — `git diff -U0` confirms only `//` lines added. The comment names the three new fields (`wp.guests[]`, `wp.guestCount`, `wp.rsvpClosed`), explains that admin SDK bypasses Firestore rules entirely (RESEARCH Q2), and points future readers to `tests/rules.test.js` for the anti-spoof floor + `27-RESEARCH.md` for the platform guarantee.
- `tests/rules.test.js` extended with 1 new seed (`families/fam1/watchparties/wp_phase27_test` carrying `guests: []`, `guestCount: 0`, `rsvpClosed: false`) and 1 new describe block (`Phase 27 Guest RSVP rules`) containing 4 assertions:
  - `#27-01` anon write to `wp.guests` → DENIED
  - `#27-02` anon write to `wp.rsvpClosed` → DENIED
  - `#27-03` family member read of wp doc including guests array → ALLOWED
  - `#27-04` anon write to `wp.guestCount` → DENIED
- `scripts/smoke-guest-rsvp.cjs` scaffolded with 17 helper-behavior assertions across the four families called out in 27-RESEARCH.md Wave 0 Gaps:
  - **1.x guestId format (4 ok)** — `GUEST_ID_REGEX = /^[A-Za-z0-9_-]{20,32}$/` matches base64url(16); rejects 8-char + 50-char strings; 22-char length confirmation for `crypto.randomBytes(16).toString('base64url')`.
  - **2.x name-collision render (4 ok)** — `displayGuestName(rawName, familyMemberNames)` adds `(guest)` suffix only on Set collision; case-insensitive trim+lowercase normalization; 'Alex' → 'Alex (guest)' / 'Riley' → 'Riley' / 'ALEX' → 'ALEX (guest)' / '  Sam ' → '  Sam  (guest)'.
  - **3.x response normalization (6 ok)** — `normalizeResponseForReminders(r)`: yes/maybe/no pass through; undefined/null/garbage all → 'notResp'.
  - **4.x visible guest count (3 ok)** — `visibleGuestCount(guests)`: counts non-revoked + tolerates null entries; `[]` → 0; `undefined` → 0; sample of 5 entries (1 revoked, 1 null) → 3.
- `package.json scripts.smoke` chain extended from 9 to 10 contracts (ends with `&& node scripts/smoke-guest-rsvp.cjs`); new `smoke:guest-rsvp` per-contract alias added next to the existing `smoke:*` family.

## Task Commits

Each task committed atomically in the **couch** repo:

1. **Task 2.1: firestore.rules comment** — `402c519` (docs)
   - 7-line Phase 27 admin-SDK-bypass comment block inserted at line 578, immediately before `allow read:`.
   - `git diff -U0 firestore.rules | grep -E "^\+" | grep -vE "^\+\+\+|\+\s*//"` → empty (no non-comment additions).
2. **Task 2.2: rules.test.js Phase 27 describe block** — `d5b5724` (test)
   - Adds `wp_phase27_test` seed (lines 121-141) + new describe block (lines 947-975) with 4 assertions.
   - Test run: 52 passing / 0 failing (was 48; +4 new). All prior describe blocks (Sessions, Anonymous + CF-only, Family-doc CREATE, Member-doc CREATE branches, picker-only update, couchSeating D-06, tupleNames D-02, title-doc HIGH-1, SEC-15-1-* hardening, couchPings, Phase 24 wp video fields) still pass.
3. **Task 2.3 STEP A: smoke-guest-rsvp.cjs scaffold** — `d8d0b89` (test)
   - 119-line file with 17 ok-line assertions; standalone exit 0.
4. **Task 2.3 STEP B: package.json wiring** — `53e0907` (chore)
   - smoke aggregate now ends with `&& node scripts/smoke-guest-rsvp.cjs`; new `"smoke:guest-rsvp": "node scripts/smoke-guest-rsvp.cjs"` entry.
   - Full `npm run smoke` exits 0; all 10 contracts pass.

## Files Created/Modified

### Created
- `C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs` — 119 lines. Pure-helper smoke scaffold; no Firestore/queuenight/TMDB deps; 17 ok-line assertions across guestId / name-collision / response normalization / visibleGuestCount families. Plan 05 extends with rsvpReminderTick guest-loop + production-code sentinels.

### Modified
- `C:/Users/nahde/claude-projects/couch/firestore.rules` — +7 lines. Comment block at lines 578-584 inside `/watchparties/{wpId}` match block. Zero rule predicate changes; `attributedWrite()` continues to deny anon writes to all wp fields.
- `C:/Users/nahde/claude-projects/couch/tests/rules.test.js` — +60 lines. Phase 27 seed (lines 121-141) + Phase 27 Guest RSVP rules describe block (lines 947-975) with 4 assertions (`#27-01` through `#27-04`).
- `C:/Users/nahde/claude-projects/couch/package.json` — +1 chain step to `scripts.smoke` (now 10 contracts) + 1 new entry `smoke:guest-rsvp`.

## Decisions Made

- **Comment block placement:** Inside `/watchparties/{wpId}` block (line 578, immediately before `allow read:`) rather than at file top. Anchors the bypass note to the affected resource so future archaeologists reading the watchparties rule don't have to cross-reference top-of-file matter. Mirrors the architecture-note pattern at lines 327-345 (admin-SDK-only path note for guest-invite member docs).
- **Test ID convention `#27-NN`:** Plan-locked. Substring `Phase 27` appears in the describe block name, satisfying any future smoke-style verifier grep. Matches the existing `#wpN` Phase 24 convention spirit (per-phase prefix) without colliding with it.
- **Smoke scaffold helpers inlined:** Avoids requiring `queuenight/functions/index.js` (which would pull in `firebase-functions` runtime). Pure helpers as verbatim copies act as drift detectors — when Plan 03/04/05 import the canonical implementations from production code, any divergence will fail this smoke and force an explicit re-sync.
- **smoke aggregate placement:** New contract is appended (last in chain). Plan 05's floor meta-assertion (`>=13 floor`) extends this same file, so chain-tail placement keeps the diff trivial.
- **No graceful-skip gate:** Sibling smokes (smoke-availability.cjs, smoke-position-anchored-reactions.cjs) gate on the presence of `queuenight/functions/index.js`. This contract has no such dependency, so no skip gate is needed; documented inline.

## Deviations from Plan

### Auto-fixed Issues

**None substantive.** One micro-adjustment that did not change shape or behavior:

**1. [Process — readability] Suppress unused-import warning for `eqObj`**
- **Found during:** Task 2.3 STEP A self-review (immediately after the Write call, before standalone smoke run)
- **Issue:** The plan's exact code defines both `eq()` and `eqObj()` helpers, but the 17 assertions all use `eq()` only. Without a reference, some linters flag `eqObj` as unused. Plan 05 will use it for the rsvpReminderTick guest-loop sentinels (object-deep-equality on push payloads).
- **Fix:** Added a single-line `void eqObj;` near the bottom of the file with a comment noting it's exposed for Plan 05 sentinel additions. Keeps the helper available without triggering lint noise; behaviorally identical to the plan's exact code.
- **Files modified:** `C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs`
- **Committed in:** `d8d0b89` (final state of Task 2.3 STEP A commit; 17 ok lines unchanged).

---

**Total deviations:** 0 substantive (1 forward-compat readability micro-touch).
**Impact on plan:** Plan executed exactly as written. All 5 must_have truths satisfied; all 4 artifacts contains/contains_2 grep gates green; 2 key_links pattern present (`assertFails.*guests` regex matches all 3 anon-write assertions; `smoke-guest-rsvp\.cjs` regex matches both new package.json references).

## Issues Encountered

- The plan's verify block for Task 2.2 used `tee /tmp/rules-test-out.log` which is fine on this Windows-via-bash environment because the repo's bash sandbox routes `/tmp` to a real path. No issue in execution.
- Pre-existing modification to `.planning/ROADMAP.md` was present at execution start. Per orchestrator contract (`Do NOT update STATE.md or ROADMAP.md`), it was left untouched throughout this plan.

## User Setup Required

None for this plan. No deploy needed; no cross-repo coordination needed. Plan 05 owns the cross-repo deploy ritual + `sw.js` CACHE bump.

## Next Plan Readiness

**Ready for parallel Wave-1 finish + Wave-2 plans:**
- **Plan 27-01 + 27-02 are now both complete** — Wave 1 finished. The validation floor (rules + tests + smoke scaffold) is locked in; Plans 03/04/05 can proceed without coordinating fixes back through 27-02.
- **Plan 27-03 (rsvp.html)** can call `rsvpSubmit` with `guestId` and start a 30s polling loop against `rsvpStatus`. The smoke scaffold's `GUEST_ID_REGEX` matches the regex contract Plan 27-01 stamped in `rsvpSubmit.js`; `normalizeResponseForReminders` matches the response-shape contract Plan 27-05 will rely on in `rsvpReminderTick`.
- **Plan 27-04 (app.html roster UI)** can call `rsvpRevoke` with `{token, action:'revoke', guestId}` for the kebab "remove" action. The smoke scaffold's `displayGuestName` matches the `(guest)` suffix render rule (D-04). `visibleGuestCount` matches the `wp.guestCount` denormalization Plan 27-01 maintains in the rsvpSubmit/rsvpRevoke transactions.

**Note for Plan 05 — additional sentinels needed:**

To reach the final ≥ 13 floor (currently the smoke is a pure-helper scaffold with 17 helper-behavior ok lines but no production-code grep sentinels), Plan 05 must extend `scripts/smoke-guest-rsvp.cjs` with:

1. **rsvpReminderTick guest-loop sentinels** (queuenight/functions/src/rsvpReminderTick.js):
   - Grep for the second loop over `wp.guests` (`for (const guest of guests)`)
   - Grep for `if (!guest.pushSub) continue` (skip-no-pushsub gate, RSVP-27-11)
   - Grep for `if (guest.revoked) continue` (skip-revoked gate)
   - Grep for `webpush.sendNotification(guest.pushSub` (direct push path, not sendToMembers)
   - Grep for `reminders.${guest.guestId}.${w.key}` (idempotency flag pattern)
2. **Production-code sentinels for the three Plan 27-01 CFs:**
   - rsvpSubmit.js: `runTransaction`, `WP_ARCHIVE_MS = 25 * 60 * 60 * 1000`, `wp.rsvpClosed === true`, `guestCapReached`, `crypto.randomBytes(16).toString('base64url')`
   - rsvpStatus.js: read-only (zero `.update(` calls), CORS allowlist, looksLikeWpId regex, `revoked`/`closed`/`guestCount` keys in return shape
   - rsvpRevoke.js: `runTransaction` (revoke path), `permission-denied` (host gate), `wpRef.update({ rsvpClosed: true })` (close path), `Object.assign(..., { revoked: true })` (soft-delete path)
3. **sw.js CACHE bump assertion** (Plan 05 owns the bump to `couch-v39-guest-rsvp` per ROADMAP convention):
   - Grep `const CACHE = 'couch-v39-guest-rsvp'` (or whatever short-tag Plan 05 picks)
4. **Floor meta-assertion (RSVP-27 floor lock):**
   - `eq('Phase 27 smoke meets floor (>=13 assertions)', total >= 13, true)` — mirrors RPLY-26-17 pattern from Phase 26 (Plan 26-05).

These additions take the contract from the current 17 to a final figure in the 30-40 range, with the floor meta-assertion guaranteeing future plans can't accidentally drop below 13.

## Self-Check

Verified each completion claim:

**Files exist:**
- `C:/Users/nahde/claude-projects/couch/scripts/smoke-guest-rsvp.cjs` — FOUND (119 lines, 17 ok lines verified)
- `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-02-SUMMARY.md` — this file

**Files modified:**
- `C:/Users/nahde/claude-projects/couch/firestore.rules` — +7 lines comment block; `git diff` shows only `//` lines added
- `C:/Users/nahde/claude-projects/couch/tests/rules.test.js` — +60 lines (1 seed + 1 describe block)
- `C:/Users/nahde/claude-projects/couch/package.json` — +1 entry + 1 chain step

**Commits exist (couch repo):**
- `402c519` — docs(27-02): annotate Phase 27 admin-SDK bypass in firestore.rules — FOUND in `git log -6`
- `d5b5724` — test(27-02): add Phase 27 Guest RSVP rules describe block + seed wp_phase27_test — FOUND
- `d8d0b89` — test(27-02): scaffold smoke-guest-rsvp.cjs (17 helper-behavior assertions) — FOUND
- `53e0907` — chore(27-02): wire smoke-guest-rsvp.cjs into smoke aggregate + per-contract alias — FOUND

**Test runs:**
- Rules tests (`cd tests && npm test`): 52 passing, 0 failing (was 48 — +4 new Phase 27 assertions)
- smoke-guest-rsvp.cjs standalone: 17 passed, 0 failed, exit 0
- Aggregate `npm run smoke` (10 contracts): exit 0; all contracts green

**Must-have grep checks (all PASSED):**
- `grep -nE "Phase 27 — wp\\.guests" firestore.rules` → line 578 (FOUND, inside watchparties block on line 577)
- `grep -nE "Phase 27 Guest RSVP rules" tests/rules.test.js` → line 947 (FOUND)
- `grep -nE "wp_phase27_test" tests/rules.test.js` → 5 matches (1 seed + 4 assertions)
- `grep -cE "assertFails" tests/rules.test.js` → 33 (was 30; +3 anon-deny assertions)
- `grep -E "displayGuestName|normalizeResponseForReminders|visibleGuestCount|GUEST_ID_REGEX" scripts/smoke-guest-rsvp.cjs | wc -l` → ≥ 4 (all 4 helper symbols present)
- `node -e "console.log(require('./package.json').scripts.smoke.endsWith('node scripts/smoke-guest-rsvp.cjs'))"` → true
- `node -e "console.log(require('./package.json').scripts['smoke:guest-rsvp'])"` → `node scripts/smoke-guest-rsvp.cjs`

## Self-Check: PASSED

---
*Phase: 27-guest-rsvp*
*Plan: 02*
*Completed: 2026-05-02*
