# Phase 13 — Compliance & Ops Sprint (sketch)

**Gathered:** 2026-04-25
**Status:** Ideation only — not yet planned. Use this as the seed for `/gsd-plan-phase 13` when ready.
**Mode:** Solo-actionable post-v1 hardening sprint. No multi-device blockers.

## Phase Boundary

Phase 13 is the "ship v1 properly" sprint. v1 is technically launchable today (Phase 12 closed all UX gaps; Phase 11 closed deploy gaps), but a few operational + compliance items would meaningfully reduce post-launch risk. Phase 13 closes those.

This is **not a feature phase**. It's a hardening / hygiene phase. No new product surfaces. The user-visible changes are minimal — but the operational risk profile drops materially.

## Candidate items (with effort + risk)

### COMP-01: Self-serve account deletion (4-6 hr)
Privacy.html promises "email privacy@couchtonight.app and we will delete your account within 30 days." Today that's a manual chore. Phase 13 should add a one-click "Delete my account" button in Account → ADMIN that triggers a Cloud Function to sweep all user-related Firestore docs (members, votes, queues, watchparty participations, photos in Storage) and revoke auth.

**Compliance value:** High. CCPA + GDPR require timely deletion (30 days max). Manual flow becomes a real burden once user count >5.
**Risk:** Destructive — must have a confirmation gate + grace window (soft-delete 14 days?) before hard-delete. Test extensively in emulator.

### OPS-01: firebase-functions SDK 4.9.0 → 7.x upgrade (2-3 hr)
TECH-DEBT TD-1. Three majors of breaking changes; methodical per-export migration in emulator first.

**Risk:** Medium — touches all 11 Cloud Functions. Roll out one at a time.

### OPS-02: Auto-stamp BUILD_DATE on deploy (30 min)
Wire `scripts/stamp-build-date.cjs` into a `deploy.sh` shell script that runs before `firebase deploy`. Or hook via a Git pre-push hook. Eliminates the "I forgot to bump the date" failure mode.

### OPS-03: Variant-B storage rules tightening (1 hr — once Phase 5 member-uid migration ships)
TECH-DEBT TD-2. Currently gated on members migrating from `m_<ts>_<rand>` to uid-keyed. Could either (a) ship the migration in Phase 13, OR (b) add the alternate `userFamilies/{uid}` reverse-index doc maintained by Cloud Functions. The reverse-index path is faster + non-breaking.

**Recommendation:** add the reverse-index in Phase 13, save the full member migration for a later milestone.

### OPS-04: CSP + remaining security headers (1-2 hr)
TECH-DEBT TD-4. Already shipped XCTO + Referrer-Policy + X-Frame-Options in this session. CSP is the bigger lift: needs allow-listing for Trakt OAuth callback + TMDB image CDN + Google Fonts + Firebase SDK + service worker. Test in `Content-Security-Policy-Report-Only` mode first (no enforcement, just logging) to catch what would break.

### OPS-05: Crashlytics or Sentry integration (1-2 hr)
Set up app-side error reporting. Without it, prod errors are invisible until users report them. Crashlytics is free + Firebase-native (zero setup friction). Sentry is more powerful but requires another account.

**Recommendation:** Crashlytics. Add 30 lines to `js/app.js` to capture window.onerror + unhandled promise rejections + send to Firebase. Filter PII (we already discipline this elsewhere).

### OPS-06: GitHub branch protection rules (15 min)
Settings → Branches → Add rule for `main`:
- Require pull request reviews before merge (set to 0 reviewers — this is solo dev, but the gate prevents accidental direct push)
- Require status checks to pass (the CI workflow we just added)
- Require linear history
- Lock force-push

**Why bother for solo dev?** Future-proofing. If you ever bring on a contributor or want to require yourself to slow down before pushing, this is the gate.

### OPS-07: Crash recovery + scheduled Firestore export (30 min)
Set up a Cloud Scheduler job that exports Firestore to Cloud Storage daily. Firebase doesn't backup automatically. If a user (or bug) corrupts the families collection, no rollback exists today.

```bash
gcloud firestore export gs://queuenight-84044-backups/$(date +%Y-%m-%d)
```

Scheduled via `gcloud scheduler jobs create`. ~$0.06/GB/month for the storage bucket.

## Recommended Phase 13 plan split

5-plan phase, 2 waves:

**Wave 1 (parallel):**
- 13-01 — COMP-01 self-serve account deletion (the biggest user-facing item)
- 13-02 — OPS-05 Crashlytics integration (tiny but high-value)

**Wave 2 (sequential, depends on 13-01):**
- 13-03 — OPS-02 BUILD_DATE auto-stamp + 13-04 OPS-06 branch protection (tiny ops items, can bundle)
- 13-04 — OPS-07 Firestore backup
- 13-05 — OPS-04 CSP report-only mode + report URI

**Deferred to Phase 14 or Milestone 2:**
- OPS-01 firebase-functions SDK upgrade (sufficiently risky to deserve its own session)
- OPS-03 Variant-B storage rules (gated on independent member-uid decision)

## Estimate

~1.5 days total. None of it is hard; most of it is well-scoped tech debt that's been queued in TECH-DEBT.md.

## When to plan + execute

Recommendation: **after** v1 is announced and has been live for 2-4 weeks with no incidents. Phase 13 then becomes "now that we have real users, here's the production-grade ops layer."

Alternative: **before** v1 announcement if a discovery during friends-and-family soft-launch reveals one of these gaps (most likely: a user emails for deletion and you realize the manual flow is annoying).

Either way: not urgent today.

## Cross-references

- `.planning/TECH-DEBT.md` — TD-1 through TD-5
- `.planning/LAUNCH-READINESS.md` — P2 + P3 backlog items
- `.planning/RUNBOOK.md` — incident response baseline
- `.planning/STATE.md` — current v1 milestone status

## Plan hints for `/gsd-plan-phase 13`

When this phase gets formally planned, the planner should:
1. Treat Wave 1 plans as truly parallel (different files modified — COMP-01 is a CF + UI surface, OPS-05 is a JS-only error handler)
2. Pair the small ops items into one plan to keep plan count down
3. Don't plan COMP-01 and OPS-01 (SDK upgrade) in the same phase — too much risk concentration; move OPS-01 to Phase 14
4. Threat model COMP-01 carefully — destructive flow with auth bypass risk if Cloud Function is misconfigured
