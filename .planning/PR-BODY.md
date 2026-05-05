## Summary

This is a **catch-up PR** that brings `origin/main` from Phase 14 era (`93d102d`, last touched 2026-04-25) up to current production. **594 commits** spanning **13 shipped phases** (15.1 through 30 inclusive, plus Phase 14 finalization), all already deployed and curl-verified at couchtonight.app.

Latest production cache: **`couch-v47-pickem`** (deployed 2026-05-05T04:28Z).

PR exists for audit trail and to re-sync `origin/main`. Phases were shipped iteratively over ~10 days; production traffic has been served by every intermediate cache version. Reviewing this PR line-by-line is impractical — the commit history and per-phase HUMAN-UAT scaffolds are the audit surface.

## Phases shipped on this branch

| Phase | Slug | Cache when shipped | Date | Plans |
|---|---|---|---|---|
| 14 (finalize) | decision-ritual-core | `couch-v34.x` | 2026-04-26 | 14-04, 14-05, 14-09, 14-10 |
| 15.1 | security-hardening | `couch-v35.1-security-hardening` | 2026-04-27 | 3 plans |
| 15.2 | audit-trail-backfill | (docs-only) | 2026-04-28 | 7 plans |
| 15.4 | integration-polish | `couch-v35.6-integration-polish` | 2026-04-29 | 2 plans |
| 15.5 | wait-up-flex | `couch-v35.5-wait-up-flex` | 2026-04-28 | 6 plans |
| 15.6 | audit-trail-backfill-2 | (docs-only) | 2026-04-30 | 3 plans |
| 18 | availability-notifications | `couch-v36-availability-notifs` | 2026-04-29 | 4 plans (cross-repo) |
| 19 | kid-mode | `couch-v36.1-kid-mode` | 2026-04-29 | 3 plans |
| 20 | decision-explanation | `couch-v36.2-decision-explanation` | 2026-04-30 | 3 plans |
| 24 | native-video-player | `couch-v37-native-video-player` | 2026-05-01 | 4 plans |
| 26 | position-anchored-reactions-async-replay | `couch-v38-async-replay` | 2026-05-01 | 5 plans |
| 27 | guest-rsvp | `couch-v39-guest-rsvp` | 2026-05-02 | 5 plans (cross-repo) |
| 30 | couch-groups-affiliate-hooks | `couch-v41-couch-groups` → `couch-v46-wave-5-hotfix` | 2026-05-02..04 | 5 plans + 5 hotfix waves |
| **28** | **social-pickem-leaderboards** | **`couch-v47-pickem`** | **2026-05-05** | **6 plans (cross-repo) — just shipped** |

## Phase 28 — social-pickem-leaderboards (newest, shipped 2026-05-05)

NFL/NBA/MLB/NHL/EPL/UCL/F1 weekly pick'em with per-family leaderboards. 14 team-leagues + F1 podium = 15 of 16 LEAGUES; UFC dropped from v1 (D-17 update 2 — Patreon/API-Sports paths abandoned, Jolpica F1 ergast endpoint verified working).

**6 plans across 4 execution waves:**
- **Plan 28-01** — TheSportsDB free-tier verification + smoke-pickem.cjs scaffold (11th smoke contract).
- **Plan 28-02** — `js/pickem.js` pure-helpers ES module (8 named exports: `scorePick`, `validatePickSelection`, `compareMembers`, `PICK_TYPE_BY_LEAGUE`, etc.).
- **Plan 28-03** — Cross-repo Cloud Functions: `gameResultsTick` (every 5 min, settles picks transactionally with TheSportsDB team-sport branch + Jolpica F1 podium branch, branch-aware grace 3h/24h, per-tick fetch cache, sole leaderboard writer per HIGH-2 counter ownership) + `pickReminderTick` (T-15min push with `picks_reminders/{id}` idempotency) + `firestore.indexes.json` (2 composite indexes per HIGH-3) + 3-map notification lockstep.
- **Plan 28-04** — `firestore.rules` 3 new blocks (`picks` / `leaderboards` / `picks_reminders`) with REVIEWS Amendments 6/7/8/9: state required on create, pickType allowlist (no UFC), `affectedKeys().hasOnly()` mutable-fields-only update allowlist, hard DELETE denied. Rules-tests grew 78 → 88 (10 Phase 28 cases).
- **Plan 28-05** — UI: 5 render functions (`renderPickemSurface`, `renderPickemPickerCard`, `renderLeaderboard`, `renderInlineWpPickRow`, `renderPastSeasonsArchive`) + `fetchF1Roster` (Jolpica `/drivers/`) + chunked `onSnapshot` with **aggregate teardown** `() => unsubs.forEach(fn => fn())` per Amendment 12 (single-unsubscribe pattern would leak chunks past 10 games) + `submitPick` defense-in-depth allowlist + `.pe-*` CSS family (~308 lines, zero new design tokens) + Tonight inline-link + `#screen-pickem` shell.
- **Plan 28-06** — Cross-repo deploy: queuenight (functions + indexes + rules) → couch hosting → curl-verified `couch-v47-pickem` → 11-script `28-HUMAN-UAT.md` scaffold (Script 11 explicit NO-UFC verification with "DO NOT mark as bug" language per Phase 30 T-30-14 v1 precedent).

**REVIEWS amendments (15/15 closed):** HIGH-1 state required on create / HIGH-2 counter ownership (CF is sole writer of picksTotal/picksSettled/lastPickAt) / HIGH-3 composite indexes / HIGH-4 4-layer UFC defense (backend skip + rules deny + client allowlist + smoke negative sentinels) / HIGH-9 affectedKeys allowlist / MEDIUM-5 branch-aware grace / MEDIUM-6 F1 submit guard / MEDIUM-7 D-09 pre-fill source resolution (verified via Grep — `teamAllegiance` is wp-only) / MEDIUM-8 rules-tests 4 → 10 / MEDIUM-10 per-tick fetch cache / MEDIUM-11 aggregate listener teardown / LOW-13 deploy pre-flight checks / LOW-15 named-counter smoke FLOOR (replaces brittle `HELPER_ASSERTIONS=27` magic with `helperAssertions`/`productionSentinels`/`metaAssertions` triple).

## Phase 30 — couch-groups-affiliate-hooks (initial ship + 5 hotfix waves)

Cross-family watchparties via top-level `/watchparties/` collection-group queries. **5 deploy waves**, **61 of 67 review findings closed** from a 4-reviewer code review (Phase 24+26+27+30 + cross-cutting) plus a cross-AI peer review (Codex + Gemini).

**Wave 1 — backend retarget + frontend criticals (38 closed):**
- CR-01 watchparty push triggers retargeted to top-level `/watchparties/` — closes silent-push-fail
- BL-01..03 Phase 27 RSVP CFs resolve top-level + legacy nested
- CR-02 wpMigrate ADMIN_UIDS gate + merge:true + zero-member guard
- CR-26-01/02 replay reactions for non-original-participants
- CR-24-01 broadcasters wait for metadata before stamping isLiveStream
- CR-04/07 sign-out tears down all subs (cross-tenant leak fix)
- Plus 30+ more

**Wave 2 — cross-AI Codex P0 (4 closed):**
- CDX-1 cross-family wp injection block (require creator belongs to hostFamilyCode + families==[hostFamilyCode] at create)
- CDX-2 stale watchpartiesRef() → top-level + Phase 30 fields
- CDX-3 Flow B nominate auto-conversion migrated to top-level
- CDX-5 VAPID configured before guest webpush calls

**Wave 3 — cross-AI Codex P1 + Gemini P0/P1 (9 closed):**
- CDX-4 top-level wp hard-delete denied (force soft-delete via status)
- CDX-6/7 sign-out clears intervals; host-only status flip
- G-P0-1 Firebase Auth SDK errors sanitized
- G-P0-2 aria-modal + role=dialog on all 39 .modal-bg elements
- G-P1-1 warmer error toast copy
- G-P1-3 --ink-dim contrast 4.0:1 → 5.33:1 (WCAG AA compliance)
- G-P1-4 guest redemption "Pull up a seat" warmth

**Wave 4 — process gate (CR-12):**
- `scripts/deploy.sh` gains `--sync-rules` flag — pre-flight diff between source-of-truth and queuenight mirror; fails fast if drifted, OR auto-mirrors + commits + deploys rules with the flag
- Documented in RUNBOOK §H
- Closes the v44 deploy-mirror gap that left CR-05/CR-06 protections unenforced for ~24h

**Wave 5 — deferred items burnt down (9 closed):**
- MD-01 revoked-guest re-submit denied
- MD-02 dead-sub prune endpoint match (closes attachPushSub race)
- MD-03 NFKC normalize guest names (NBSP bypass closed)
- HI-02 in-memory rate limiter on Phase 27 unauth CFs (rsvpSubmit 10/min, Status 60/min, Revoke 30/min)
- CR-10 onMemberDelete CF — strips stale memberUids when family member is deleted
- G-P0-2 part 2 — keyboard focus trap helper wired to 6 high-traffic modals
- Hero alt text richer
- Tap targets bumped to 44px minimum
- iOS PWA Add-to-Home-Screen nudge banner (one-time, dismissable)

**UX improvement bundled:** Tile action sheet surfaces queue-toggle as the first option with state-aware copy. Single-tap remove instead of digging through Vote modal.

## Other shipped feature highlights

- **Phase 27 — Guest RSVP**: Token-based RSVP at `/rsvp/<token>` for non-member guests with localStorage continuity + 4-state PushManager opt-in + privacy footer + host-side guest chips. Cross-repo: 4 Cloud Functions in queuenight (rsvpSubmit transactional `wp.guests[]` upsert / rsvpStatus / rsvpRevoke / rsvpReminderTick guest webpush loop with 410/404 dead-sub prune).
- **Phase 26 — Position-anchored reactions + async replay**: Reactions get `runtimePositionMs` + `runtimeSource` enum so they replay at the right scrub position. New replay variant of the live-watchparty modal with rAF clock + ±2s drift tolerance + scrubber + position-aligned reactions feed. Past parties surface expanded from 5h-25h window to all-time-paginated. Title-detail Watchparties section bifurcated (active-only + Past watchparties).
- **Phase 24 — Native video player**: YouTube + MP4 video surface inside the live watchparty modal with 3-flow URL fields + persistent surface + REVIEWS H1-M3 closed end-to-end. Firestore rules tightened for non-host writes (REVIEWS M2 `attributedWrite()` constraint).
- **Phase 20 — Decision Explanation**: `buildMatchExplanation` pure helper + 3 surface integrations (spin-pick italic serif sub-line, matches card dim footer, detail modal "Why this is in your matches" section).
- **Phase 19 — Kid Mode**: Session-scope kid-mode toggle with `getEffectiveTierCap` + 7 filter splices + V5 roster pill toggle + parent override.
- **Phase 18 — Availability Notifications**: Daily `providerRefreshTick` Cloud Function (us-central1) with TMDB diff detection + `titleAvailable` push channel + Settings UI parity. Cross-repo deploy.
- **Phase 15.5 — Wait Up flex**: Reactions queue when participant is paused; replay continues when they catch up.
- **Phase 15.4 — Integration polish**: couch-ping push channel + friendly-UI parity (3 maps lockstep).
- **Phase 15.1 — Security hardening**: Hardened CSP candidate + Firestore rules tightening + Sentry breadcrumb sanitization.
- **Phase 15.6 / 15.2 — Audit-trail backfill**: REQUIREMENTS.md traceability rows + STATE.md repair (docs-only, no cache bump).

## Production status

- **Latest cache:** `couch-v47-pickem` (deployed 2026-05-05T04:28:43Z; curl-verified at couchtonight.app)
- **Smoke gate:** `npm run smoke` — 13 contracts green, 350+ assertions pass
- **Rules tests:** `cd tests && npm test` — **88/88** firebase-emulator rules tests passing (60 → 78 across Phase 30 hotfix waves; 78 → 88 in Phase 28)
- **Cloud Functions live in queuenight-84044 us-central1:** `gameResultsTick`, `pickReminderTick`, `addFamilyToWp`, `wpMigrate`, `onMemberDelete`, `onWatchpartyCreateTopLevel`, `onWatchpartyUpdateTopLevel`, `rsvpSubmit`, `rsvpStatus`, `rsvpRevoke`, `rsvpReminderTick`, `providerRefreshTick`, `onCouchPingFire`, plus pre-existing watchparty + intent + veto push triggers
- **Composite indexes built:** Phase 30 collectionGroup `watchparties` (mode, hostFamilyCode); Phase 28 picks (state, gameStartTime); plus pre-existing
- **Firestore rules:** Source-of-truth at `couch/firestore.rules`; mirrored to queuenight via `bash scripts/deploy.sh --sync-rules` (Phase 30 Wave 4 process gate; Phase 28 deploy auto-mirrored 2026-05-05T04:28:18Z)

## Items deferred (non-blocking; tracked in `.planning/STATE.md` Open follow-ups)

| Item | Reason |
|---|---|
| HUMAN-UAT (~78 device-UAT scripts across Phases 18/19/20/24/26/27/28/30) | Real-device matrix testing; user-driven |
| HI-01 indexed `rsvpStatus` lookup | Needs `wp.id` schema migration first |
| Modal focus trap on ~30 lower-traffic modals | Pattern established in G-P0-2; mechanical follow-up |
| Tagline normalization at app.html:220 | Single inconsistency, below 3+ threshold |
| G-P1-2 service filter elevation | Gemini misread DOM; toggle is already top-level |
| Path B `participants` per-key constraint | Surfaced by rules-test #30-09; needs design work |
| TD-1..TD-8 (firebase-functions SDK 4→7, Variant-B storage rules, CSP enforcement flip, Sentry Replay re-enable, Firestore index spec record-only, dual-Settings consolidation) | See `.planning/TECH-DEBT.md` |
| Couch viz `couchSeating` legacy dual-write | Drop after one PWA cache cycle (~1-2 weeks of v34.1+ deployed) |

## Test plan

- [x] `npm run smoke` — 13 smoke contracts, 350+ assertions, all green (gated by `productionSentinels >= FLOOR=13` in smoke-pickem.cjs)
- [x] `cd tests && npm test` — 88/88 firebase-emulator rules tests passing
- [x] Production deploy verified at couchtonight.app for every cache bump in the progression chain (curl-verified)
- [x] `--sync-rules` deploy gate exercised end-to-end (Phase 30 Wave 4 + Phase 28 Plan 06)
- [x] Cross-repo deploys verified for Phases 18, 27, 28, 30 (queuenight functions + couch hosting)
- [ ] Real-device UAT (HUMAN-UAT scaffolds in 8 phases; resume signal `uat passed` per phase → `/gsd-verify-work N`)

## Stats

- 594 commits across 13 shipped phases (15.1 through 30 + Phase 14 finalize)
- ~32 cache bumps in the production progression chain (`couch-v34.x` → `couch-v47-pickem`)
- 13+ Cloud Functions deployed/updated (cross-repo to `queuenight-84044`)
- 1 process hardening gate (`scripts/deploy.sh --sync-rules`)
- Rules tests: 60 → 88 (28 added across hotfix waves + Phase 28)
- 8 HUMAN-UAT scaffolds awaiting real-device verification

🤖 Generated with [Claude Code](https://claude.com/claude-code)
