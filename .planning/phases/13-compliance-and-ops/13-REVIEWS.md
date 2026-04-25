---
phase: 13
reviewers: [gemini, codex]
reviewed_at: 2026-04-25
plans_reviewed: [13-01-PLAN.md, 13-02-PLAN.md, 13-03-PLAN.md, 13-04-PLAN.md, 13-05-PLAN.md]
gemini_model: gemini-2.5 (CLI default, free tier)
codex_model: codex-cli 0.125.0 default
---

# Cross-AI Plan Review — Phase 13

Independent peer review of the 5 PLAN.md files by two external AI CLIs. Both invoked sequentially with the same ~60K-token prompt (CONTEXT.md + RESEARCH.md + REQUIREMENTS.md excerpt + ROADMAP excerpt + all 5 plans + review instructions). Claude Code self-skipped per `--all` semantics (review independence).

---

## Gemini Review

This is a high-quality, professional-grade hardening plan. It demonstrates a deep understanding of the existing codebase, Firebase's operational nuances, and modern security/privacy standards.

### Summary
The Phase 13 plan is a comprehensive hardening sprint that successfully transitions Couch from a "solo hobby project" to a production-ready application. By implementing automated account deletion, structured error reporting, and robust deployment guards, it materially reduces the project's operational risk and compliance debt. The strategy of using "Report-Only" modes and grace windows reflects a mature, "safety-first" engineering culture.

### Strengths
- **Exhaustive Deletion Sweep:** Plan 13-01's reaper is impressively thorough, covering 12 distinct Firestore paths and Storage objects.
- **Privacy-First Observability:** The Sentry integration (13-02) proactively scripts PII redaction and filters Firestore transport noise.
- **Process Institutionalization:** Moving from manual `RUNBOOK.md` checklist to automated `deploy.sh` (13-03).
- **Modern GCP Integration:** Plan 13-04's direct Cloud Scheduler-to-REST calls (avoids unnecessary Pub/Sub plumbing).
- **Graceful Soft-Delete UX:** Sign-in detour for accounts pending deletion (no dedicated recovery microservice).

### Concerns
- **HIGH — Hardcoded Deployment Paths (13-03):** `deploy.sh` hardcodes `/c/Users/nahde/queuenight`. Non-portable; breaks if project is moved or contributor added.
- **MEDIUM — Storage Deletion Scalability (13-01):** `bucket.getFiles({ prefix: 'couch-albums/${familyCode}/' })` fetches full metadata into memory; risks OOM for large albums.
- **LOW — Sign-in Detour Read (13-01):** Adds a blocking `users/{uid}` read on every sign-in to the critical app-boot path.
- **LOW — CSP `'unsafe-inline'` (13-05):** Significantly weakens the XSS-protection rationale that motivates having a CSP at all.
- **LOW — Reaper Batching (13-01):** 20 users/hour cap could backlog under spike (unlikely at current scale).

### Suggestions
- Use `$QUEUENIGHT_PATH` env var or `.env` file in `deploy.sh` instead of hardcoded path.
- Stream Storage metadata via pagination if album sizes grow.
- Centralize Sentry DSN in `js/constants.js` (avoid duplication across `app.html` + `landing.html`).
- Wrap `haptic('success')` in try-catch (project convention; helper may be missing on desktop).
- Audit for orphan vetoes — when a user is deleted, clear their active veto state on the current night's session.
- Explicitly enable "Require linear history" in the GitHub Ruleset (13-03); easy to skip in UI setup.

### Risk Assessment
**Overall Risk: MEDIUM.** Technical implementation is robust. Driven by destructive nature of 13-01; any cascading-delete bug = irreversible data loss. 14-day grace + Report-Only CSP provide strong safety nets.

---

## Codex Review

### Summary
Phase 13 is directionally strong: focuses on the right launch-hardening work, avoids the risky Firebase Functions SDK upgrade, and treats account deletion with appropriate seriousness. The plans are unusually thorough, with threat models, acceptance gates, and ops runbooks. The main risks are not lack of detail, but a few places where the implementation plan is overconfident or internally inconsistent: the account-deletion reaper may leave user data behind, Sentry is scheduled after deletion despite being described as parallel, the deploy/branch-protection flow has unsafe verification instructions, and CSP/Sentry decisions accept more third-party and inline-script risk than the plan wording sometimes implies.

### Strengths
- Clear phase boundary: no billing, no framework migration, no native work, no TMDB/Firebase config churn.
- Good risk separation: deferring `firebase-functions` major upgrade away from destructive deletion work.
- COMP-01 has the right shape: authenticated callable, 14-day soft delete, scheduled reaper, owner-blocking, cancel path, terminal Auth deletion.
- Sentry switch is well justified; rejecting Crashlytics for web is correct.
- Firestore export plan is pragmatic and reproducible, with lifecycle retention and explicit restore docs.
- CSP starts in Report-Only mode, which is the correct launch posture.

### Concerns

- **HIGH — 13-01 / Task 1.4: Cascading delete is incomplete despite claiming completeness.** Plan explicitly skips `families/{familyCode}/sessions/{dateKey}` mutation as "short-lived," but the must-have says sessions vote/veto attribution is hard-deleted. Compliance mismatch — leaves user-linked data behind if sessions include votes, vetoes, chooser history, or names tied to `actingUid`.

- **HIGH — 13-01 / Task 1.4: Family discovery depends only on `users/{uid}/groups`.** If reverse index is missing, stale, or absent for older accounts, reaper misses family-scoped data. Should also `collectionGroup` query for `families/*/members where uid == X`.

- **HIGH — 13-01 / Task 1.4: `firebase-tools.firestore.delete()` inside Cloud Functions is operationally risky.** `firebase-tools` is CLI-oriented, large, may require credentials/project assumptions, can create cold-start/runtime surprises. Prefer Admin SDK `recursiveDelete` / `BulkWriter`.

- **MEDIUM — 13-01 / Task 1.4: collectionGroup comments query inside each family loop.** Repeats work for users in multiple families; risks broad reads. Query once outside the loop.

- **MEDIUM — 13-01 / Task 3: Sign-in detour falls through on Firestore read failure.** Plan chooses availability over privacy. If rules/network fail, pending-deletion user gets normal access. Safer default: block boot on read failure, show retry/sign-out state.

- **MEDIUM — 13-01 / UI: Account deletion not feature-flagged.** Research recommends hidden rollout; plan defers it. Deploy CFs first, smoke-test with throwaway user, then expose UI.

- **MEDIUM — 13-01 / Task 3: Fallback contact uses `nahderz@gmail.com`, not `privacy@couchtonight.app`.** Phase objective is compliance against the privacy policy; fallback should point to the address promised in `privacy.html`.

- **MEDIUM — 13-02 / Sequencing: Frontmatter says wave 2, depends_on [13-01], but original split said Sentry is Wave 1 parallel.** Unnecessarily serializes Sentry behind the riskiest plan; creates `sw.js` cache-bump coupling. (Note: plan-checker iter 1 deliberately moved this — see consensus below.)

- **MEDIUM — 13-02 / Task 1: Literal Sentry placeholder DSNs in production HTML can silently "ship nothing."** Plan says placeholders acceptable in version control, but `autonomous: true` + later hosting deploy could publish nonfunctional telemetry. Add deploy-blocking grep in `deploy.sh` or plan verification.

- **MEDIUM — 13-02 / PII scrubbing: Family-code regex is overbroad and underbroad.** Six hex chars may redact unrelated IDs while missing non-hex family codes. Sentry stack frames, breadcrumbs, tags, request headers, localStorage/sessionStorage breadcrumbs, replay metadata may still carry identifiers. Should not claim all PII stripped.

- **MEDIUM — 13-02 / Replay: `replaysOnErrorSampleRate: 0.1` may be too much for a family app before privacy review.** Even masked replay captures UI structure, flows, timestamps, event metadata. Errors-only at launch; replay later.

- **MEDIUM — 13-03 / Task 2: Branch-protection verification uses `git reset --hard HEAD~1`.** Violates project's destructive-command safety posture; risks discarding unrelated local changes. Use temporary branch or `git revert`.

- **MEDIUM — 13-03 / deploy.sh dirty-tree guard conflicts with auto-stamping.** Requires clean tree, then modifies `js/constants.js`. After deploy, tree is dirty by design. Plan documents the pitfall but doesn't resolve it. Either commit before deploy, stamp into deploy mirror only, or print explicit post-deploy commit instruction.

- **MEDIUM — 13-04 / IAM: bucket permission says `storage.objectAdmin`** but must verify Firestore export service has enough ability to create/list objects under the prefix. Likely works; smoke test catches it; expect IAM iteration.

- **LOW — 13-04 / Restore docs: "restore overwrites everything" is imprecise.** Firestore import merges/restores exported documents and may overwrite matching ones, but may not delete documents created after export unless collection-level behavior is handled. Runbook should be precise for incident response.

- **LOW — 13-05 / CSP: Report-Only plus `'unsafe-inline'` gives observability, not material XSS mitigation.** Plan acknowledges, but must-have "defense-in-depth for XSS" is overstated until enforcement + inline cleanup happen.

- **LOW — 13-05 / CSP directives may miss endpoints.** Common misses: `blob:` for workers, `connect-src` to Sentry envelope variants, Firebase Auth handler paths, Google identity endpoints, YouTube trailer embeds (if used), TMDB poster redirects. Report-Only makes this safe; initial testing should include Trakt OAuth, photo upload, trailers, install flow, RSVP links.

### Suggestions

- Make COMP-01 two-stage: deploy CFs hidden, run emulator + one live throwaway-account deletion, then expose UI behind a temporary flag.
- Replace or benchmark `firebase-tools.firestore.delete()` in the reaper; prefer Admin SDK `recursiveDelete` / `BulkWriter`.
- Add fallback family-membership discovery path that doesn't rely solely on `users/{uid}/groups`.
- Resolve the sessions deletion gap: either scrub `actingUid` / vote / veto maps OR explicitly downgrade the must-have and the privacy claim.
- Disable Sentry Replay for v1; start with errors only, masked tags, conservative breadcrumbs.
- Add deploy-time blockers for Sentry placeholder DSNs and accidental CSP enforcement header.
- Fix branch-protection verification — avoid `git reset --hard`; use temporary branch or `git revert`.
- Decide cache-bump ownership once. Multiple plans editing `sw.js` creates avoidable conflicts; centralize bumping in `deploy.sh` or only bump for app-shell body changes.

### Risk Assessment
**Overall Risk: MEDIUM.** Phase goals sound and mostly deliverable, but COMP-01 is destructive and currently has data-completeness + operational reliability gaps that should be tightened before execution.

---

## Consensus Summary

Both reviewers rated overall risk **MEDIUM** with COMP-01 (account deletion) as the primary risk surface. Both gave generally positive structural assessments — neither suggested re-planning from scratch. The disagreement is in depth: Gemini reads the plan as "professional-grade" with mostly polish suggestions, while Codex reads it as "directionally strong but overconfident in places" with several real correctness gaps.

### Agreed Strengths

| Theme | Both reviewers noted |
|-------|----------------------|
| Cascading-delete shape | Sweep-by-collection design is the right architecture |
| Sentry-vs-Crashlytics call | Correct — Firebase Crashlytics has no web SDK |
| CSP Report-Only posture | Correct launch stance |
| Phase scope discipline | Deferring SDK upgrade (OPS-01) is the right call |

### Agreed Concerns

| Severity | Issue | Plans affected | Notes |
|----------|-------|---------------|-------|
| HIGH-ish | CSP `'unsafe-inline'` undermines XSS protection rationale | 13-05 | Both flag (Gemini LOW, Codex LOW). Acknowledged limitation; not blocking. |
| MEDIUM | Storage / Firestore deletion completeness has scaling + correctness gaps | 13-01 | Gemini: Storage memory; Codex: sessions doc + family discovery + firebase-tools-in-CF antipattern. |

### Codex-Only HIGH Findings (Action-Worthy)

These are the highest-value findings from this review pass — issues neither the original planner nor the iter-2 plan-checker caught:

1. **`families/{familyCode}/sessions/{dateKey}` sweep gap (HIGH).** Plan 13-01 Task 1.4 marks sessions as "short-lived, skip" but the must-have promises hard-delete of vote/veto attribution. Either fix the sweep OR downgrade the must-have wording (and amend the privacy claim).
2. **Family discovery via `users/{uid}/groups` is fragile (HIGH).** Add a `collectionGroup` fallback querying `families/*/members where uid == X` for stale/missing reverse index.
3. **`firebase-tools.firestore.delete()` inside a Cloud Function is operationally risky (HIGH).** It's a CLI tool; use Admin SDK `recursiveDelete` / `BulkWriter` instead.

### Gemini-Only HIGH Finding

4. **`deploy.sh` hardcodes `/c/Users/nahde/queuenight` (HIGH).** Non-portable. Use `$QUEUENIGHT_PATH` env var.

### Codex-Only MEDIUM Findings (Action-Worthy)

5. **No deploy-time guard against shipping placeholder Sentry DSNs.** Add a grep in `deploy.sh` that fails the deploy if `app.html` still contains the placeholder string.
6. **Sentry Replay sample 0.1 is too aggressive pre-privacy review** — disable replay for v1 launch.
7. **`git reset --hard HEAD~1` in branch-protection verify (13-03 Task 2) is destructive.** Use `git revert` or a throwaway branch.
8. **`deploy.sh` clean-tree guard conflicts with auto-stamp** (stamp dirties the tree). Resolve to one of: stamp into mirror only, or auto-commit post-stamp.
9. **PII-scrub claims overbroad** — Sentry breadcrumbs, tags, replay metadata can still carry identifiers. Soften the must-have wording from "all PII stripped" to "explicit PII fields stripped; defensive scrubbing applied to known-leak surfaces."
10. **Fallback delete contact `nahderz@gmail.com`** should be `privacy@couchtonight.app` to match `privacy.html`.

### Divergent Views

| Topic | Gemini | Codex |
|-------|--------|-------|
| Overall tone | "Professional-grade" | "Overconfident in places" |
| 13-02 wave assignment | Not flagged | MEDIUM concern (stale serialization) — but plan-checker iter 1 explicitly moved 13-02 to Wave 2 due to `app.html` + `sw.js` overlap with 13-01. Codex's concern reflects RESEARCH text, not final plan state. **Defensible as-is.** |
| Sentry DSN strategy | "Centralize in `js/constants.js`" | "Block deploy on placeholder DSN" | Both are valid; can do both. |
| Reaper deletion engine | Not addressed | "Don't use `firebase-tools` inside CF" | **Codex is correct** — this is a real anti-pattern. |
| Sign-in detour fail-mode | LOW (perf concern) | MEDIUM (privacy concern — fail-open on read error) | Both have a point; framing differs. |

### Recommended Next Action

Of the 10 action-worthy findings above, several rise to "should fix before execute":

- **Findings 1, 2, 3 (Codex HIGH on 13-01 reaper):** all touch the same plan task (13-01 Task 1.4 reaper implementation). A single targeted revision pass on 13-01 can close all three: switch to Admin SDK `recursiveDelete`, add fallback family discovery, and resolve the sessions sweep ambiguity.
- **Finding 4 (Gemini HIGH on deploy.sh):** trivial — env var swap in 13-03 Task 1 action.
- **Findings 5, 7, 8 (Codex MEDIUM on deploy/Sentry guards):** these are 13-03 + 13-02 polish; surgical edits.
- **Finding 6 (Codex MEDIUM on Sentry Replay):** simple — drop `replaysOnErrorSampleRate` line in 13-02 Task 1 action.
- **Findings 9, 10:** wording fixes only.

Findings explicitly **not** action-worthy:
- Codex's 13-02 wave concern (already addressed by checker iter 1).
- Gemini's "centralize Sentry DSN in constants.js" suggestion — adds coupling to another module for marginal benefit; fine as-is.

To incorporate: `/gsd-plan-phase 13 --reviews ${GSD_WS}` will spawn the planner with `13-REVIEWS.md` as input and produce a revision. Or apply manually before execute.
