## Summary

2026-05-03/04 hotfix wave — closed **61 of 67 findings** from a 4-reviewer code review (Phase 24 + 26 + 27 + 30 + cross-cutting) plus a cross-AI peer review (Codex + Gemini), across 5 deploy waves. Plus a queue-toggle UX fix and expanded rules-test coverage (60 → 78 passing).

**Already deployed to production.** Latest cache: `couch-v46-wave-5-hotfix`. PR exists for audit trail.

## Highlights by wave

**Wave 1 — backend retarget + frontend criticals (38 closed):**
- CR-01 watchparty push triggers retargeted to top-level `/watchparties/` — closes silent-push-fail
- BL-01..03 Phase 27 RSVP CFs resolve top-level + legacy nested
- CR-02 wpMigrate ADMIN_UIDS gate + merge:true + zero-member guard
- CR-26-01/02 replay reactions for non-original-participants
- CR-24-01 broadcasters wait for metadata before stamping isLiveStream
- CR-04/07 sign-out tears down all subs (cross-tenant leak fix)
- Plus 30+ more

**Wave 2 — cross-AI Codex review P0 (4 closed):**
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

**UX improvement:** Tile action sheet surfaces queue-toggle as the first option with state-aware copy. Single-tap remove instead of digging through Vote modal.

**Rules coverage:** 60 → 78 tests across 5 new test groups. Test #30-09 documented a real Path B `participants` per-key gap for follow-up.

## Scope note

Branch is 571 commits ahead of origin/main since origin was last touched at Phase 14 docs. All Phase 15.x → 30 work flows through this PR.

## Items deferred

| Item | Reason |
|---|---|
| HI-01 indexed rsvpStatus | Needs `wp.id` schema migration first |
| Modal focus trap on ~30 lower-traffic modals | Pattern established; mechanical follow-up |
| Tagline normalization at app.html:220 | Single inconsistency, below 3+ threshold |
| G-P1-2 service filter elevation | Gemini misread DOM; toggle is already top-level |
| Path B `participants` per-key constraint | Surfaced by test #30-09; needs design work |
| HUMAN-UAT scripts (4 phases, ~32 scripts) | Real-device matrix testing |

## Test plan

- [x] `npm run smoke` — 13 contracts, 350+ assertions green
- [x] `cd tests && npm test` — 78/78 firebase-emulator rules tests passing
- [x] Production deploy verified at couchtonight.app (cache `couch-v46-wave-5-hotfix`)
- [x] Browser-verified in Playwright: page loads with no console errors
- [x] `--sync-rules` deploy gate exercised end-to-end (Wave 4)
- [ ] Real-device UAT (HUMAN-UAT scaffolds in 4 phases, ~32 scripts)

## Stats

- 5 deploy waves
- 3 new Cloud Functions (`onWatchpartyCreateTopLevel`, `onWatchpartyUpdateTopLevel`, `onMemberDelete`)
- 1 process hardening gate (deploy.sh `--sync-rules`)
- 18 rules tests added (60 → 78)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
