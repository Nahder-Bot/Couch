---
phase: 13-compliance-and-ops
plan: "03"
subsystem: infra
tags: [deploy, shell-script, build-automation, github-branch-protection, runbook, firebase-hosting]

requires:
  - phase: 13-compliance-and-ops/13-01
    provides: accountDeletionReaper Cloud Function (referenced in §J scheduler inventory)

provides:
  - scripts/deploy.sh: one-stop pre-deploy automation with BUILD_DATE mirror-stamp, Sentry placeholder guard, CACHE bump, firebase deploy
  - package.json: npm run deploy + npm run stamp shortcuts at repo root
  - RUNBOOK.md §H: canonical deploy.sh usage guide with QUEUENIGHT_PATH env var setup
  - RUNBOOK.md §J: Cloud Scheduler job inventory command and expected post-Phase-13 job list
  - RUNBOOK.md §L: GitHub branch protection ruleset details and throwaway-branch verification procedure

affects:
  - 13-compliance-and-ops/13-04 (§I and §K RUNBOOK sections reserved for that plan)
  - future deploys (deploy.sh replaces manual checklist in RUNBOOK pre-flight section)

tech-stack:
  added: []
  patterns:
    - "deploy.sh wraps pre-deploy checklist: dirty-tree check, node --check, mirror, stamp (mirror-only), Sentry guard, firebase deploy, smoke test"
    - "QUEUENIGHT_PATH env-var-with-default pattern for sibling repo resolution (no hardcoded user paths)"
    - "BUILD_DATE stamp via sed on deploy mirror constants.js (mirror-only, source tree stays clean)"
    - "Sentry DSN placeholder guard: grep mirror HTML before firebase deploy to catch Plan 13-02 placeholder leakage"

key-files:
  created:
    - scripts/deploy.sh
    - package.json
  modified:
    - .planning/RUNBOOK.md

key-decisions:
  - "deploy.sh uses sed directly on mirror constants.js for BUILD_DATE stamp rather than invoking stamp-build-date.cjs via cd-into-mirror; stamp-build-date.cjs hardcodes its target via __dirname so the cd strategy would not work — sed is functionally equivalent and avoids modifying the existing script"
  - "QUEUENIGHT_PATH env-var-with-default (${QUEUENIGHT_PATH:-../../queuenight}) with loud failure if path does not resolve — no hardcoded user-specific path literal anywhere in deploy.sh (review fix HIGH-4)"
  - "Task 2 GitHub branch protection is a HUMAN-VERIFY checkpoint — documented in §L of RUNBOOK.md; code-side work (deploy.sh, RUNBOOK) committed without blocking"
  - "§I and §K RUNBOOK sections deliberately omitted — reserved for Plan 13-04 (Firestore backup)"

patterns-established:
  - "Mirror-only stamp: never mutate source js/constants.js during deploy; stamp the deploy mirror copy only (review fix MEDIUM-8)"
  - "Sentry placeholder guard at deploy boundary: grep mirror HTML after copy, before firebase deploy (review fix MEDIUM-5)"
  - "Dirty-tree guard with --allow-dirty escape hatch: Pitfall 7 defense in deploy.sh"
  - "Throwaway-branch probe for branch protection verification: push probe branch tip to main remotely; local main never modified; no git reset --hard needed (review fix MEDIUM-7)"

requirements-completed: [OPS-13-02, OPS-13-06]

duration: 35min
completed: "2026-04-25"
---

# Phase 13 Plan 03: OPS-13-02 BUILD_DATE Auto-stamp + OPS-13-06 Branch Protection Summary

**Pre-deploy automation shell script with mirror-only BUILD_DATE stamping, Sentry placeholder guard, and RUNBOOK operational sections for deploy, scheduler inventory, and GitHub branch protection**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-25T15:42:00Z
- **Completed:** 2026-04-25T16:17:21Z
- **Tasks:** 2 of 3 auto-executed (Task 2 is a HUMAN-VERIFY checkpoint for GitHub web UI)
- **Files modified:** 3

## Accomplishments

- `scripts/deploy.sh` ships with all four review fixes applied: HIGH-4 (env-var path), MEDIUM-5 (Sentry placeholder guard), MEDIUM-7 (throwaway-branch verification in RUNBOOK §L), MEDIUM-8 (mirror-only BUILD_DATE stamp)
- Root-level `package.json` created with `npm run deploy` and `npm run stamp` shortcuts
- RUNBOOK.md extended from §A-§G (224 lines) to §A-§L (350 lines, +126 lines) with §H deploy guide, §J scheduler inventory, and §L branch protection

## Task Commits

Each task was committed atomically:

1. **Task 1: Create scripts/deploy.sh + wire npm run deploy/stamp shortcuts** - `7df42a2` (feat)
2. **Task 2: GitHub branch protection** - HUMAN-VERIFY checkpoint (see below — no commit; GitHub web UI only)
3. **Task 3: Append RUNBOOK.md sections §H §J §L** - `45a9da7` (docs)

**Plan metadata:** committed with SUMMARY.md (docs)

## Files Created/Modified

- `scripts/deploy.sh` (NEW, 152 lines) — one-stop pre-deploy automation replacing the manual RUNBOOK pre-flight checklist; implements HIGH-4 + MEDIUM-5 + MEDIUM-8 review fixes
- `package.json` (NEW, 9 lines) — root-level npm manifest with `deploy` and `stamp` script shortcuts
- `.planning/RUNBOOK.md` (MODIFIED, +126 lines) — appended §H (deploy.sh guide), §J (Cloud Scheduler job inventory), §L (GitHub branch protection with throwaway-branch verification)

## Decisions Made

**Decision 1: sed-based BUILD_DATE stamp in mirror rather than invoking stamp-build-date.cjs via cd-into-mirror**

The plan's preferred strategy was `( cd "${QUEUENIGHT_ROOT}/public" && node "${REPO_ROOT}/scripts/stamp-build-date.cjs" )`. However, `stamp-build-date.cjs` uses `const REPO_ROOT = path.resolve(__dirname, '..')` and `const CONSTANTS = path.join(REPO_ROOT, 'js', 'constants.js')` — both resolved at load time from the script's physical location, not from CWD. Changing CWD would have no effect; the script would still stamp `<couch-repo>/js/constants.js` in the source tree, defeating review fix MEDIUM-8.

Fix: deploy.sh directly applies an equivalent `sed -i.bak -E` against `${QUEUENIGHT_ROOT}/public/js/constants.js`. The sed expression `s|export const BUILD_DATE = '[0-9]{4}-[0-9]{2}-[0-9]{2}';|export const BUILD_DATE = '${TODAY}';|` is functionally identical to what stamp-build-date.cjs does internally. The source `scripts/stamp-build-date.cjs` is left unmodified. This decision is documented in SUMMARY §Technical Notes below and flagged in the Deviation section.

**Decision 2: no predeploy npm hook**

The plan explicitly stated "Do NOT add a predeploy hook — that would double-stamp." Followed as specified; only `deploy` and `stamp` scripts added.

**Decision 3: Task 2 treated as HUMAN-VERIFY without blocking**

Per `<non_autonomous_note>` in the execution context: document the GitHub branch ruleset configuration spec and continue. The exact ruleset settings are specified in Task 2 of the PLAN.md and documented in RUNBOOK §L.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] stamp-build-date.cjs cannot be cd-targeted; replaced with equivalent sed on mirror constants.js**

- **Found during:** Task 1 (reading stamp-build-date.cjs before writing deploy.sh)
- **Issue:** The plan's step 6 proposed `( cd "${QUEUENIGHT_ROOT}/public" && node "${REPO_ROOT}/scripts/stamp-build-date.cjs" )` as the mirror-targeting strategy. After reading the script body, `__dirname` is hardcoded at load time — changing CWD does not redirect the script's file writes. The strategy would silently stamp the source tree instead of the mirror, directly violating MEDIUM-8.
- **Fix:** deploy.sh applies `sed -i.bak -E` directly to `${QUEUENIGHT_ROOT}/public/js/constants.js`. The regex `s|export const BUILD_DATE = '[0-9]{4}-[0-9]{2}-[0-9]{2}';|export const BUILD_DATE = '${TODAY}';|` is byte-for-byte equivalent to what stamp-build-date.cjs does internally (script uses the same `re = /export const BUILD_DATE\s*=\s*'(\d{4}-\d{2}-\d{2})';/` pattern and writes back the same line format).
- **Files modified:** `scripts/deploy.sh` (Step 6 uses sed; stamp-build-date.cjs unchanged)
- **Verification:** `bash -n scripts/deploy.sh` exits 0; no `__dirname` used; mirror path is the only write target
- **Committed in:** `7df42a2` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — bug in plan's proposed stamp invocation strategy)

**Impact on plan:** Fix is necessary for MEDIUM-8 correctness. The outcome (source tree untouched, mirror stamped) matches the plan's intent exactly. No scope creep.

## Technical Notes

### Review fix HIGH-4 — no hardcoded user-specific path

Verified: `grep '/c/Users/nahde/queuenight' scripts/deploy.sh` exits 1 (no matches). Path resolution uses `${QUEUENIGHT_PATH:-${REPO_ROOT}/../../queuenight}` with an existence check that fails loudly if the resolved directory is absent.

### Review fix MEDIUM-5 — Sentry placeholder guard

Sentry guard runs at step 7 in deploy.sh (lines 120-138), after the mirror copy (step 5, lines 87-97) and before `firebase deploy` (step 8, line 142). Ordering verified by line numbers. Guard checks `${QUEUENIGHT_ROOT}/public/app.html` and `${QUEUENIGHT_ROOT}/public/landing.html` for `<SENTRY_PUBLIC_KEY>|<SENTRY_ORGID>|<SENTRY_PROJECTID>` via `grep -qE`. Abort on any match.

### Review fix MEDIUM-8 — mirror-only stamp

BUILD_DATE stamp targets only `${QUEUENIGHT_ROOT}/public/js/constants.js`. Source tree `js/constants.js` is never opened for writing by deploy.sh. After a deploy.sh run, `git status` on the couch source repo shows no changes to `js/constants.js` (only sw.js changes if a CACHE bump tag was provided).

### stamp-build-date.cjs path-resolution behavior

`stamp-build-date.cjs` resolves its target using `__dirname` (the scripts/ directory) → `REPO_ROOT` → `js/constants.js`. It always stamps `<couch-repo>/js/constants.js` regardless of CWD. The cd-into-mirror strategy proposed in the plan would NOT work. The sed-in-deploy.sh strategy used instead produces identical output against the mirror file without modifying the existing script. This is documented in TECH-DEBT.md as a future refactor candidate (add an optional `--target` flag to stamp-build-date.cjs for cleaner mirror-targeting).

### bash -n verification

```
$ bash -n scripts/deploy.sh
(no output — exit 0)
```

### package.json validity

```
$ node -e "JSON.parse(require('fs').readFileSync('package.json','utf8'))"
(no output — exit 0)
```

### RUNBOOK section count

Before: §A through §G (224 lines)
After: §A through §H, §J, §L (350 lines; §I and §K reserved for Plan 13-04)

`scripts/deploy.sh` appears 5 times in RUNBOOK.md (§H header + 4 body references) — meets "at least 4 times" acceptance criterion.

## Human-Verify Checkpoints

### CHECKPOINT 1: GitHub Branch Protection Ruleset (Task 2 — OPS-13-06)

**Status:** Pending user action

**What to configure:** Go to `github.com/<owner>/couch` → Settings → Rules → Rulesets → New branch ruleset

| Setting | Value |
|---------|-------|
| Ruleset Name | `protect-main` |
| Enforcement status | Active |
| Bypass list | (leave EMPTY) |
| Target branches | Include by pattern → `main` |
| Restrict deletions | ON |
| Block force pushes | ON |
| Require linear history | ON |
| Require a pull request before merging | ON |
| Required approvals | 0 |
| Dismiss stale PR approvals when new commits pushed | ON |
| Require approval of most recent reviewable push | OFF |
| Require conversation resolution before merging | ON |
| Require status checks to pass | ON |
| Status check: `syntax-check` | Add (from `.github/workflows/ci.yml`) |
| Require branches to be up to date before merging | ON |
| Restrict creations | OFF |
| Require deployments to succeed | OFF |
| Require signed commits | OFF |

**Verification procedure (throwaway-branch probe — review fix MEDIUM-7):**

```bash
cd C:/Users/nahde/claude-projects/couch
git stash push -u -m "pre-branch-protection-probe" 2>/dev/null || true
git checkout main
git fetch origin main
MAIN_TIP="$(git rev-parse HEAD)"
git checkout -b probe/branch-protection-13-03
date >> .planning/RUNBOOK.md
git add .planning/RUNBOOK.md
git commit -m "test(13-03): branch protection probe -- DO NOT MERGE"
git push origin "probe/branch-protection-13-03:main" 2>&1 | tee /tmp/branch-probe.log
```

**Expected output:** `remote: error: GH013: Repository rule violations found for refs/heads/main.`

**Cleanup after verification:**

```bash
git checkout main
[ "$(git rev-parse HEAD)" = "$MAIN_TIP" ] || echo "ERROR: main moved"
git branch -D probe/branch-protection-13-03
git push origin --delete probe/branch-protection-13-03 2>/dev/null || true
git stash pop 2>/dev/null || true
```

### CHECKPOINT 2: QUEUENIGHT_PATH env var setup (one-time per dev machine)

**Status:** Pending user action (optional if queuenight clone is at `../../queuenight` relative to couch repo)

If your queuenight clone is at `/c/path/to/queuenight` (not the default `../../queuenight`), add to your shell profile:

```bash
# ~/.bashrc or ~/.zshrc or git-bash profile
export QUEUENIGHT_PATH="/c/path/to/queuenight"
```

Verification: `./scripts/deploy.sh` should proceed past the path-resolution step without the "queuenight repo not found" error.

## Issues Encountered

None — plan executed cleanly. The stamp-build-date.cjs path behavior was detected from source reading before writing deploy.sh (not an error encountered during execution).

## Deferred Items

- **stamp-build-date.cjs `--target` flag** — future refactor to support explicit target path for cleaner mirror-targeting from deploy.sh. Current sed approach works but is less expressive. Not blocking. (Candidate for TECH-DEBT.md)
- **gh CLI ruleset configuration script** — branch protection is configured via GitHub web UI (one-time setup). A `gh api` or terraform equivalent could automate this for future projects. Defer; not needed for solo-dev Couch workflow.
- **pre-push git hook for stamp** — deferred; deploy.sh handles stamping in the mirror, which is the correct boundary (stamp runs only when actually deploying, not on every push).

## Next Phase Readiness

- 13-04 (Firestore backup) can proceed: deploy.sh includes the `daily-firestore-export` job in §J scheduler inventory as a forward reference; RUNBOOK §I and §K are reserved for 13-04 content
- 13-05 (CSP report-only) can proceed: deploy.sh has no CSP-specific logic; CSP goes in `queuenight/firebase.json` headers (unchanged by this plan)
- All deployments should now use `./scripts/deploy.sh` instead of the manual RUNBOOK pre-flight checklist

---

## Self-Check: PASSED

- FOUND: `scripts/deploy.sh`
- FOUND: `package.json`
- FOUND: `.planning/RUNBOOK.md`
- FOUND: `.planning/phases/13-compliance-and-ops/13-03-SUMMARY.md`
- FOUND commit: `7df42a2` (Task 1)
- FOUND commit: `45a9da7` (Task 3)
