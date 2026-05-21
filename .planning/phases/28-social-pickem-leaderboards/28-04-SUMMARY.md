---
phase: 28-social-pickem-leaderboards
plan: 04
subsystem: firestore-rules + rules-tests + smoke-sentinels
tags: [firestore-rules, rules-unit-testing, pickem, leaderboards, picks-reminders, REVIEWS-amendments]

# Dependency graph
requires:
  - phase: 28-01
    provides: smoke-pickem.cjs scaffold + Group 7 placeholder slot
  - phase: 28-02
    provides: js/pickem.js validatePickSelection schema (defense-in-depth pair)
  - phase: 28-03
    provides: gameResultsTick + pickReminderTick CFs that consume the rule contract
provides:
  - "/families/{code}/picks/{pickId} Firestore rule block (member self-write before lock; CF-only fields blocked via REVIEWS HIGH-9 affectedKeys allowlist)"
  - "/families/{code}/leaderboards/{lbDoc} Firestore rule block (family-member read; client write denied)"
  - "/picks_reminders/{reminderId} Firestore rule block (top-level CF-only; client read+write denied)"
  - "tests/rules.test.js Phase 28 describe block — 10 it() cases #28-01..#28-10 (REVIEWS Amendment 9 / MEDIUM-8 — expanded from 4 to 10)"
  - "scripts/smoke-pickem.cjs Group 7 — 10 production-code grep sentinels covering all REVIEWS-amended rule literals"
affects:
  - "28-05 (UI surface): pick CREATE/UPDATE writes from picker UI must satisfy state=='pending' + 3-value pickType allowlist + lock-time check"
  - "28-06 (phase-close): cross-repo firestore.rules deploy via `bash scripts/deploy.sh --sync-rules` (mirrors couch -> queuenight)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "REVIEWS Amendment 6 / HIGH-1 enforcement — pick CREATE rule REQUIRES state == 'pending' explicitly (no omission branch); same hard-equality for pointsAwarded == 0, settledAt == null, tiebreakerActual == null. Closes silent-leaderboard-pollution gap (gameResultsTick where('state','==','pending') would never see state-omitted picks)."
    - "REVIEWS Amendment 7 / HIGH-9 enforcement — pick UPDATE rule uses affectedKeys().hasOnly([...]) ALLOWLIST of mutable fields ONLY: {selection, tiebreakerTotal, editedAt, actingUid, memberId, memberName}. All routing/identity/scoring fields immutable post-create. Replaces the previous denylist approach which allowed pickType/gameId/leagueKey/strSeason/f1Year/f1Round/gameStartTime/submittedAt mutation."
    - "REVIEWS Amendment 8 / HIGH-4 enforcement — pick CREATE rule constrains pickType to 3-value allowlist ['team_winner', 'team_winner_or_draw', 'f1_podium']. UFC pickType create denied at rules layer (defense-in-depth alongside Plan 28-03's gameResultsTick KNOWN_PICKTYPES skip). UFC dropped per D-17 update 2."
    - "REVIEWS Amendment 9 / MEDIUM-8 enforcement — rules-tests describe block expanded from 4 to 10 cases covering full denial surface (#28-05 state-omit deny / #28-06 UFC pickType deny / #28-07 gameStartTime update deny / #28-08 pickType update deny / #28-09 leaderboards write deny / #28-10 picks_reminders write deny)."
    - "Hard DELETE denied for everyone on /picks/{pickId} — append-only collection (D-13 no-backfill alignment + CONTEXT Specifics no edit-history audit). Admin SDK in CF bypasses if cleanup ever needed."
    - "Top-level /picks_reminders/{reminderId} collection (NOT nested under /families/) — pickReminderTick uses single doc.get() per (leagueKey, gameId, memberId) tuple to short-circuit double-fires under retry. Doc ID format: '{leagueKey}_{gameId}_{memberId}'."

key-files:
  created: []
  modified:
    - "firestore.rules — +100 lines: 3 new match blocks at correct nesting levels (picks_reminders top-level after /watchparties; picks + leaderboards inside /families/{familyCode}). All REVIEWS-amended literals present."
    - "tests/rules.test.js — +138 lines: Phase 28 describe block with 10 it() cases #28-01..#28-10 reusing the existing fam1 + UID_MEMBER seed harness."
    - "scripts/smoke-pickem.cjs — Group 7 replaced from FLOOR=1 placeholder to 10 production-code grep sentinels (7.A..7.J); existing floor placeholder renamed Group 8 (still FLOOR=1; Plan 28-06 raises to 13)."

key-decisions:
  - "Used existing attributedWrite() helper verbatim — already validates auth + family membership + actingUid + memberId regex anchor + memberName. No new helper needed."
  - "Inserted picks_reminders block BEFORE the /families/{familyCode} block (line 248-260, between watchparties block close at 245 and families block open at 268), keeping monotonic top-level order."
  - "Inserted picks + leaderboards blocks at the END of /families/{familyCode} (after the existing intents nested matcher closing brace), keeping the existing Phase 5/14/15 nested matchers untouched."
  - "Test data uses fam1 + UID_MEMBER + m_UID_MEMBER (already seeded in tests/rules.test.js seed()) instead of fabricating new FAM_TEST/UID_MEMBER_TEST stubs — leverages the existing /users/{uid}/groups/{familyCode} membership wire that isMemberOfFamily() reads."
  - "Smoke Group 7 floor placeholder renumbered to Group 8 (still FLOOR=1) so monotonic group numbering is preserved; Plan 28-06 raises FLOOR to 13."

patterns-established:
  - "REVIEWS-aware Firestore rules block — when REVIEWS amendments tighten a CREATE rule, every required-equals constraint goes on the create allow with explicit comment citation (REVIEWS HIGH-1, HIGH-4 etc.) so future maintainers can trace the security invariant back to the review."
  - "affectedKeys ALLOWLIST not denylist — for any UPDATE rule on a multi-field doc, prefer affectedKeys().hasOnly([mutable]) over hasAny([immutable]) because the allowlist denies-by-default new fields that get added in later phases (the denylist would silently allow them until someone audits)."

requirements-completed:
  - PICK-28-09
  - PICK-28-10
  - PICK-28-11
  - PICK-28-23
  - PICK-28-24
  - PICK-28-36
  - PICK-28-37
  - PICK-28-38

# Metrics
duration: 12min
completed: 2026-05-05
---

# Phase 28 Plan 04: Pick'em Firestore rules + rules-tests + smoke sentinels Summary

**Three new Firestore rule blocks (picks / leaderboards / picks_reminders) with REVIEWS Amendment 6/7/8 tightening (state-required-on-create + 3-value pickType allowlist + affectedKeys allowlist on update) — rules-tests grow 78 → 88 PASS via 10 new Phase 28 cases; smoke-pickem grows 55 → 65 PASS via 10 new Group 7 production-code grep sentinels.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-05T03:42:00Z
- **Completed:** 2026-05-05T03:54:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- 3 new firestore.rules match blocks landed at correct nesting levels: picks_reminders top-level (between watchparties and families) + picks + leaderboards nested inside /families/{familyCode}.
- REVIEWS Amendment 6 / HIGH-1 enforced verbatim at the rules layer: pick CREATE REQUIRES `state == 'pending'` (no omission branch); same hard-equality for `pointsAwarded == 0`, `settledAt == null`, `tiebreakerActual == null`. State-omitted picks are no longer creatable. Test #28-05 covers.
- REVIEWS Amendment 7 / HIGH-9 enforced verbatim: pick UPDATE uses `affectedKeys().hasOnly([selection, tiebreakerTotal, editedAt, actingUid, memberId, memberName])` ALLOWLIST. All 13 routing/identity/scoring fields are immutable post-create. Tests #28-07 (gameStartTime) + #28-08 (pickType) cover.
- REVIEWS Amendment 8 / HIGH-4 enforced verbatim: pick CREATE constrains `pickType in ['team_winner', 'team_winner_or_draw', 'f1_podium']`. UFC pickType create denied at the rules layer (defense-in-depth alongside Plan 28-03 backend KNOWN_PICKTYPES skip). Test #28-06 covers.
- REVIEWS Amendment 9 / MEDIUM-8 enforced: tests/rules.test.js Phase 28 describe block has 10 it() cases (was 4 in original plan) — full denial surface coverage including state-omit / UFC / gameStartTime-update / pickType-update / leaderboards-write / picks_reminders-write.
- Hard DELETE of pick docs denied for everyone (no edit-history audit per CONTEXT Specifics).
- Total rules-tests count: 88 PASS / 0 FAIL (was 78 before Plan 04). All existing Phase 5/14/15/24/27/30 tests unchanged.
- smoke-pickem total: 65 passed / 0 failed (was 55 before Plan 04). Group 7 replaced FLOOR=1 placeholder with 10 production-code grep sentinels (7.A..7.J); floor placeholder renamed Group 8 (Plan 28-06 raises to 13).
- Full `npm run smoke` aggregate green across all 13 contracts — no regressions from this couch-only change.

## Task Commits

1. **Task 4.1: Add Firestore rule blocks (picks + leaderboards + picks_reminders)** — `f6640aa` (feat)
2. **Task 4.2: Add Phase 28 rules-tests describe block + smoke Group 7 sentinels** — `d451123` (test)

**Plan metadata:** `<this commit>` (docs: complete plan)

## Files Created/Modified

- `firestore.rules` — +100 lines: 3 new match blocks. picks_reminders at top-level (line 258) between watchparties + families. picks (line 898) + leaderboards (line 945) nested at the end of /families/{familyCode} (after the existing intents matcher). Reuses existing attributedWrite() + isMemberOfFamily() helpers in scope. All REVIEWS-amended literals present.
- `tests/rules.test.js` — +138 lines: appended `await describe('Phase 28 Pick'em rules', async () => { ... })` after the Phase 30 describe block close (line 1411). 10 it() cases #28-01..#28-10. Uses existing fam1 + UID_MEMBER + m_UID_MEMBER seed.
- `scripts/smoke-pickem.cjs` — Group 7 replaced from `FLOOR = 1` placeholder to 10 production-code grep sentinels (7.A through 7.J) verifying all 3 rule blocks landed verbatim with REVIEWS Amendments 6/7/8 literals + the Phase 28 rules-tests describe block + #28-10 anchor present. Existing floor placeholder renamed Group 8 (still FLOOR=1; Plan 28-06 raises to 13).

## Decisions Made

- **Reused existing test seed harness (fam1 + UID_MEMBER + m_UID_MEMBER)** rather than fabricating a new FAM_TEST/UID_MEMBER_TEST surface. Leverages the already-seeded /users/{uid}/groups/{familyCode} membership wire that isMemberOfFamily() depends on, avoiding seed drift across describe blocks.
- **Inserted picks_reminders BEFORE the /families/ block** (after the watchparties closing brace at line 245) — keeps monotonic top-level order in firestore.rules and groups all top-level CF-only collections together (the only existing top-level non-watchparties block).
- **Inserted picks + leaderboards at the END of /families/{familyCode}** (after the existing intents nested matcher) — matches the convention used by every prior /families nested matcher addition (Phase 5/14/15/24/27).
- **No PICK_REMINDER_OFFSET_MS or KNOWN_PICKTYPES references in the rules layer** — the rules layer enforces the static 3-value pickType allowlist (the rule predates a future 4th pickType, but adding one would require a Phase 28.x rules amendment per the explicit allowlist literal). The KNOWN_PICKTYPES backend allowlist (Plan 03) is the dynamic counterpart.

## Deviations from Plan

None - plan executed exactly as written.

The plan specified the exact rule block contents verbatim including all REVIEWS Amendment 6/7/8 literals; the test surface specified exact `validPick(overrides)` shape and 10 it() cases #28-01..#28-10; the smoke Group 7 specified 10 assertions 7.A..7.J. All landed verbatim. Test data values were swapped from the plan's `FAM_TEST + UID_MEMBER` placeholders to the existing `fam1 + UID_MEMBER + m_UID_MEMBER` seed (a non-deviation — the plan's `<action>` block explicitly noted: "Confirm FAM_TEST family + UID_MEMBER user are already set up in beforeAll (Phase 30 tests use them)" — confirming use of the existing seed names was the intended behavior).

## Issues Encountered

None. Rules engine accepted the file on first parse; all 88 rules-tests passed on first run; all 65 smoke assertions passed on first run.

## User Setup Required

None - couch-only change. Cross-repo firestore.rules deploy is OWNED by Plan 28-06 via `bash scripts/deploy.sh --sync-rules` (added in Phase 30 hotfix Wave 4 / CR-12 — pre-flight diff between source-of-truth couch/firestore.rules and queuenight mirror; auto-mirrors + commits + deploys rules with the flag).

## Next Phase Readiness

- **Wave 3 (Plan 28-05) unblocked:** UI surface (pick'em picker + leaderboard renderers + .pe-* CSS family) can now write picks confident the Firestore rules will deny any malformed payload (state-omitted, wrong pickType, post-lock, mutated immutable fields). Plan 05 client code can rely on the rules layer as the security floor; client validation (js/pickem.js validatePickSelection) is defense-in-depth.
- **Wave 4 (Plan 28-06) deferred work:** (a) Cross-repo firestore.rules deploy via `bash scripts/deploy.sh --sync-rules`. (b) Smoke FLOOR raised from 1 to 13 in Group 8 (placeholder block). (c) sw.js CACHE bump to `couch-v47-pickem`.
- **Total Phase 28 progress:** Plans 01 + 02 + 03 + 04 SHIPPED. Plans 05 + 06 remaining (Wave 3 + Wave 4).

## Self-Check: PASSED

**Files verified:**
- `firestore.rules` — exists; +100 lines (851 → 951); 3 new match blocks present (`match /picks/{pickId}` line 898 / `match /leaderboards/{lbDoc}` line 945 / `match /picks_reminders/{reminderId}` line 258).
- `tests/rules.test.js` — exists; +138 lines (1422 → 1560); Phase 28 describe block present with #28-01 through #28-10.
- `scripts/smoke-pickem.cjs` — exists; Group 7 has 10 production-code sentinels 7.A..7.J; placeholder block renamed Group 8.
- `.planning/phases/28-social-pickem-leaderboards/28-04-SUMMARY.md` — this file.

**Commits verified:**
- `f6640aa` (feat 28-04 firestore.rules) — present in `git log --oneline`.
- `d451123` (test 28-04 rules-tests + smoke Group 7) — present in `git log --oneline`.

**Verification commands re-run:**
- `cd tests && npm test` → 88 passing, 0 failing (78 baseline + 10 new Phase 28 cases).
- `node scripts/smoke-pickem.cjs` → 65 passed, 0 failed (55 baseline + 10 new Group 7 sentinels + floor placeholder).
- `npm run smoke` → all 13 contracts green; no regressions.

---
*Phase: 28-social-pickem-leaderboards*
*Plan: 04*
*Completed: 2026-05-05*
