---
created: 2026-04-25
audience: Nahder when production is broken
purpose: solo-dev incident response — what to do when something breaks, where to look, how to roll back
---

# Couch Production Runbook

When prod breaks at 11pm with a user complaining, this is the doc to read.

## Quick triage tree

```
User reports issue
├── Can the user load the app at all?
│   ├── No (white screen / 500 / 404) → Hosting issue → §A
│   └── Yes, but feature is broken
│       ├── Console shows JS error → §B
│       ├── Push notif not arriving → §C
│       ├── Watchparty / RSVP / lobby broken → §D
│       └── Photo upload failing → §E
└── How many users affected?
    ├── 1 (this user only) → device-specific (cache, permission, browser) → §F
    └── Many → real outage → roll back → §G
```

## §A — Hosting issue

Hosting is Firebase Hosting + custom domain via couchtonight.app.

**Quick checks:**
- `curl -sI https://couchtonight.app/` — HTTP 200 expected
- `curl -sI https://couchtonight.app/app` — HTTP 200 expected
- Firebase console: https://console.firebase.google.com/project/queuenight-84044/hosting/sites
- Look at "Latest release" — was a deploy made recently?

**Roll back to previous release:**

Firebase Hosting keeps versioned releases. To roll back:

```bash
cd /c/Users/nahde/queuenight
firebase hosting:clone queuenight-84044:live queuenight-84044:live --version=<PREVIOUS_VERSION_ID>
```

Or via console: Hosting → click previous release → "Rollback".

The release IDs are visible in the Hosting tab. Each release captures the entire `public/` snapshot.

**If DNS broke:** A/AAAA records for couchtonight.app point to Firebase Hosting. Check the registrar (Namecheap) DNS panel hasn't been changed.

## §B — JS error / module load failure

Symptom: app.html loads (HTML visible) but interactive features don't work.

**Check console first:**
1. Open Chrome devtools → Console
2. Look for `SyntaxError`, `ReferenceError`, `TypeError`
3. Pay attention to module-load errors (e.g., "does not provide an export named X" — this exact bug happened on 2026-04-25)

**Common causes:**
- **Module-load mismatch:** `app.js` imports something that constants.js doesn't export. Caused by HTTP cache serving stale constants.js while serving fresh app.js. Fix: bump `sw.js` CACHE name + redeploy. The `/js/**` and `/css/**` cache-control headers were tightened in commit `5ed15fc` to prevent recurrence.
- **Service worker serving stale shell:** When the SW pre-caches `/app`, `/css/app.css`, `/js/app.js` on install, it can catch a stale CDN response. Fix: bump the `CACHE` constant in `sw.js` and redeploy. Each new cache name forces install handler to re-fetch fresh.
- **Firebase SDK breaking change:** unlikely without an explicit upgrade, but check `js/firebase.js` if SDK was bumped.

**Rapid recovery:** Roll back to previous Hosting release (see §A).

## §C — Push notifications not arriving

Symptom: User says "I scheduled a watchparty but no one got a notification."

**Check the Cloud Functions logs:**
- https://console.cloud.google.com/functions/list?project=queuenight-84044
- Click the function (e.g., `onWatchpartyCreate`, `sendToMembers`, `watchpartyTick`)
- "Logs" tab — look for errors

**Common causes:**
- **VAPID key mismatch:** unlikely (key is in `js/constants.js` and `functions/index.js`).
- **Recipient unsubscribed device:** push subscription was deleted; user clicks "Resubscribe" in Account → Notifications.
- **Permission revoked at OS level:** user changed iOS/Android settings.
- **Quiet hours active:** Phase 6 server-side enforcement (`isInQuietHours`) intentionally suppresses pushes during user's quiet window.
- **Per-event toggle off:** Phase 6 + Phase 12 — the recipient turned off that specific event type.

**Diagnostic check (in Cloud Function logs):**
- Filter for "[QN push]" — look for `notificationPrefs lookup` lines
- If lookup fires and skips with "in quiet hours" or "preference disabled" — that's expected behavior, not a bug

## §D — Watchparty / RSVP / lobby broken

**Symptom triage:**

- **Watchparty doesn't sync between devices:** Firestore connectivity issue. Check `families/{code}/watchparties/{wpId}` doc directly via Firebase Console → Firestore Data tab.
- **RSVP page shows "expired" for valid invite:** Token-WP scan in `rsvpSubmit` CF didn't find the wpId. Check Cloud Functions logs for `rsvpSubmit` errors.
- **Lobby Ready check stuck:** `participants[mid].ready` field not updating. Check `firestore.rules` hasn't been changed.
- **Majority auto-start not firing at T-0:** `watchpartyTick` scheduled CF (every 1 min) — check it's deployed and running. Console → Cloud Scheduler.

## §E — Photo upload failing

**Symptom:** Post-session modal photo upload errors.

**Check:**
- Firebase Storage rules at `queuenight/storage.rules` — must allow `couch-albums/{familyCode}/{wpId}/{filename}` writes for authenticated users.
- File size > 5MB? Storage rule rejects. Client-side compression at `canvas.toBlob(1600, 0.85)` should keep most photos under 1MB.
- MIME type not image/*? Storage rule rejects.

**Reset:** Re-deploy storage rules from `queuenight/`:
```bash
firebase deploy --only storage --project queuenight-84044
```

## §F — Single-user / device-specific issue

90% of single-user reports are stale cache or permission state.

**Standard recovery script for the user:**
1. **Hard reload:** Ctrl+Shift+R (desktop) or close-and-reopen the PWA on iOS.
2. **iOS PWA cache bust:** Settings → Safari → Advanced → Website Data → delete `couchtonight.app` → reopen the PWA from home screen.
3. **Re-grant notification permission:** Settings → Notifications → Couch.
4. **Sign out and back in:** Account tab → Sign out → reopen.

If still broken, ask for:
- Browser/OS + version
- Console error screenshot
- The watchparty / family code / pack ID involved

## §G — Multi-user real outage — roll back fast

If multiple users report the same issue within a 5-minute window, treat it as a deploy regression.

**Rapid rollback (under 90 seconds):**

```bash
# 1. List recent Hosting releases
cd /c/Users/nahde/queuenight
firebase hosting:releases --project queuenight-84044

# 2. Identify the LAST KNOWN GOOD release ID
# 3. Roll back via console (faster) or CLI:
firebase hosting:clone queuenight-84044:live queuenight-84044:live --version=<GOOD_VERSION_ID>
```

For Cloud Functions there's no built-in rollback. To restore previous CF code:
```bash
cd /c/Users/nahde/claude-projects/couch
git log --oneline | head -10  # find the last good commit
git checkout <COMMIT_SHA> -- ../queuenight/functions/  # restore CF source
firebase deploy --only "functions:rsvpSubmit,functions:rsvpReminderTick,functions:watchpartyTick" --project queuenight-84044
git checkout -- .  # restore main repo state
```

## Where to look for things

| What | Where |
|------|-------|
| Hosting releases + rollback | https://console.firebase.google.com/project/queuenight-84044/hosting |
| Firestore data | https://console.firebase.google.com/project/queuenight-84044/firestore/data |
| Firestore rules | https://console.firebase.google.com/project/queuenight-84044/firestore/rules |
| Cloud Functions | https://console.cloud.google.com/functions/list?project=queuenight-84044 |
| Cloud Function logs | Click function → Logs tab |
| Cloud Scheduler (CF cron) | https://console.cloud.google.com/cloudscheduler?project=queuenight-84044 |
| Storage bucket + rules | https://console.firebase.google.com/project/queuenight-84044/storage |
| Auth users | https://console.firebase.google.com/project/queuenight-84044/authentication/users |
| Billing + budget | https://console.cloud.google.com/billing |
| Cloud Logging (everything) | https://console.cloud.google.com/logs?project=queuenight-84044 |

## Critical config locations

| Config | File |
|--------|------|
| Firestore rules | `firestore.rules` (couch repo) + deployed via `cd queuenight && firebase deploy --only firestore` |
| Storage rules | `queuenight/storage.rules` |
| Hosting headers + rewrites | `queuenight/firebase.json` |
| Cloud Function source | `queuenight/functions/index.js` + `queuenight/functions/src/*.js` |
| TMDB API key (public) | `js/constants.js` line 1 |
| VAPID public key (public) | `js/constants.js` |
| App version + build date | `js/constants.js` `APP_VERSION` + `BUILD_DATE` |
| SW cache name | `sw.js` `CACHE` constant |

## Pre-flight checklist before every deploy

```bash
# 1. Make sure tests pass
cd tests && npm test && cd ..

# 2. node --check all JS
for f in js/*.js sw.js; do node --check "$f" || break; done

# 3. Stamp BUILD_DATE
node scripts/stamp-build-date.cjs

# 4. Bump sw.js CACHE if HTML/CSS/JS changed (forces PWA invalidation)
# Edit sw.js → const CACHE = 'couch-v<NEXT>-<short-tag>'

# 5. Mirror to deploy directory
cp -v app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml /c/Users/nahde/queuenight/public/
cp -v css/*.css /c/Users/nahde/queuenight/public/css/
cp -v js/*.js /c/Users/nahde/queuenight/public/js/

# 6. Diff to confirm
for f in app.html sw.js js/app.js; do diff -q "$f" "/c/Users/nahde/queuenight/public/$f"; done

# 7. Deploy
cd /c/Users/nahde/queuenight
firebase deploy --only hosting --project queuenight-84044

# 8. Smoke test
curl -sI https://couchtonight.app/ | head -3
curl -s https://couchtonight.app/sw.js | grep "const CACHE"
```

## Known good releases (rollback targets)

| Date | Version tag | Notes |
|------|-------------|-------|
| 2026-04-25 | sw.js v32.2-asset-cache-control | Phase 12 + P0/P1 fixes + security headers — current production |
| 2026-04-24 | sw.js v29-11-07-couch-nights | Phase 11 Wave 2 — last known good before Phase 11 deploy batch |
| 2026-04-23 | sw.js v19-phase9-rename | Phase 9 / DESIGN-05 deploy — landing page first live |

## Communication if something major breaks

You don't have a public status page. For now:
- Reach out personally to the family members affected
- Post a brief explanation in the family's group chat
- Don't need a formal status comms channel until v1 actually has external users

## §H — Deploy via scripts/deploy.sh (canonical path post-Phase-13)

Phase 13 / OPS-13-02 introduces `scripts/deploy.sh` as the canonical deploy entry point.

**One-time setup (review fix HIGH-4):**

deploy.sh resolves the queuenight sibling repo via `$QUEUENIGHT_PATH` (default: `../../queuenight` relative to the couch repo root). If your queuenight clone lives elsewhere, set this once per dev machine in your shell profile:

```bash
# In ~/.bashrc, ~/.zshrc, or git-bash profile:
export QUEUENIGHT_PATH="/c/path/to/queuenight"
```

If unset and `../../queuenight` doesn't resolve, deploy.sh fails loudly with a clear error.

**Standard deploy (no CACHE bump):**
```bash
cd C:/Users/nahde/claude-projects/couch
./scripts/deploy.sh
```

**Deploy + bump sw.js CACHE (use when shipping a user-visible app-shell change):**
```bash
cd C:/Users/nahde/claude-projects/couch
./scripts/deploy.sh 33.2-some-tag
# This sets sw.js CACHE = 'couch-v33.2-some-tag' + mirrors + deploys
```

**What it does (in order):**
1. Resolves `$QUEUENIGHT_PATH` (or default `../../queuenight`) and aborts if the path doesn't exist (review fix HIGH-4).
2. Aborts if working tree is dirty (Pitfall 7 defense). Skip with `--allow-dirty` as first arg.
3. Runs `tests/` if present.
4. `node --check` on every shipping JS file.
5. Optionally bumps sw.js CACHE in source if a tag is provided.
6. Mirrors `app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml robots.txt css/ js/` to `${QUEUENIGHT_PATH}/public/`.
7. Auto-stamps BUILD_DATE in the deploy mirror's `js/constants.js` ONLY (review fix MEDIUM-8 — source tree stays clean).
8. Aborts if `app.html` or `landing.html` in the mirror still contain a Sentry DSN placeholder (review fix MEDIUM-5 — production guard for Plan 13-02 placeholder leakage).
9. Runs `firebase deploy --only hosting --project queuenight-84044`.
10. Curl-based smoke tests against couchtonight.app.

**Cloud Functions deploy** is separate (NOT covered by deploy.sh -- too risky to bundle):
```bash
cd "$QUEUENIGHT_PATH"
firebase deploy --only functions:<name>,functions:<name2> --project queuenight-84044
```

**Storage rules deploy** is also separate:
```bash
cd "$QUEUENIGHT_PATH"
firebase deploy --only storage --project queuenight-84044
```

**Firestore rules deploy:**
```bash
cd "$QUEUENIGHT_PATH"
firebase deploy --only firestore:rules --project queuenight-84044
```

If `deploy.sh` aborts on a dirty tree but you NEED to deploy a hot-fix, run with `--allow-dirty`:
```bash
./scripts/deploy.sh --allow-dirty 33.3-hotfix
```

If `deploy.sh` aborts on Sentry DSN placeholders, substitute the real DSN values in `app.html` + `landing.html`, commit, and re-run. The placeholders are intentionally allowed in version control (Plan 13-02 acceptance criteria) — the deploy guard is the production-boundary catch.

## §I — Restore from Firestore export (OPS-13-07)

**Find the latest export:**
```bash
gsutil ls gs://queuenight-84044-backups/
```

**Restore semantics (review fix LOW — be precise here, this is incident-response material):**

`gcloud firestore import` performs an UPSERT against the target Firestore database:

- Documents in the export with IDs that EXIST in the live DB → OVERWRITTEN with the export's content.
- Documents in the export with IDs that DO NOT EXIST in the live DB → CREATED.
- Documents in the live DB that do NOT exist in the export (e.g., created AFTER the export timestamp) → **LEFT UNTOUCHED** (NOT deleted).

This means a naive `gcloud firestore import` does NOT roll the database back to the export's state — it overlays the export on top of whatever's there now. Plan accordingly:

| Goal | Recipe |
|---|---|
| "Recover a lost document — I know its ID, I want the export's version" | Run `gcloud firestore import --collection-ids=<single>` against the relevant collection. The export's version is restored. |
| "Recover a single corrupted collection — replace it with the export's state" | Drop the live collection first (`firebase firestore:delete <collection> --recursive`), THEN run `gcloud firestore import --collection-ids=<collection>`. |
| "Full point-in-time rollback — make the DB match the export exactly" | Either (a) target a NEW Firestore DB and switch traffic, OR (b) drop ALL live collections then full-import. Option (a) is safer for incident response because it preserves the corrupted state for forensics. |
| "Recover from accidental delete of a single doc" | Use `gcloud firestore import --collection-ids=<collection>` and accept that other documents in the collection get re-overwritten. If that's not acceptable, use the GCP Firestore restore-to-new-DB path (option (a) above). |

**Default restore command (UPSERT semantics — review fix LOW):**
```bash
# UPSERT-RESTORE: overlays the export onto the live DB.
# Documents created after the export timestamp are NOT removed.
gcloud firestore import gs://queuenight-84044-backups/<YYYY-MM-DDTHH:MM:SS_NNNNN>/
```

**Replace-restore (single collection):**
```bash
# 1. Drop the live collection (DESTRUCTIVE — preview first)
firebase firestore:delete <collection> --recursive --project queuenight-84044
# 2. Import only that collection from the export
gcloud firestore import gs://queuenight-84044-backups/<TIMESTAMP>/ --collection-ids=<collection>
```

**Replace-restore (full DB — safest path = restore-to-new-DB):**
```bash
# Create a new Firestore DB in the same project, restore into it, then flip traffic.
# Preserves the corrupted state for forensics.
gcloud firestore databases create --database=<new-db-id> --location=us-central1
gcloud firestore import gs://queuenight-84044-backups/<TIMESTAMP>/ --database=<new-db-id>
# Then update the Firebase Hosting / app config to point at the new DB.
```

**Cost note (Pitfall 8):** Each restore reads the export bucket then rewrites Firestore. At Couch v1 scale (a handful of families) the cost is trivial (~$0.01); at growth scale a restore could be a few dollars. Replace-restore via new-DB doubles short-term storage cost until the old DB is dropped.

**NEVER run a restore on production without an outage incident declared.** The restore semantics above mean even a "safe" UPSERT can re-introduce stale data on top of recent legitimate writes.

## §J — Cloud Scheduler job inventory

Phase 13 expanded the Cloud Scheduler job count. Confirm the inventory periodically:

```bash
gcloud scheduler jobs list --location=us-central1 --project=queuenight-84044
```

**Expected jobs (post-Phase-13):**
- `firebase-schedule-watchpartyTick-us-central1` (Phase 7 / 11)
- `firebase-schedule-rsvpReminderTick-us-central1` (Phase 11)
- `firebase-schedule-accountDeletionReaper-us-central1` (Phase 13 / Plan 13-01)
- `daily-firestore-export` (Phase 13 / Plan 13-04 -- created by gcloud, not Firebase)

**Free-tier note:** Cloud Scheduler free tier covers 3 jobs/month. With Phase 13 we go to 4 jobs total -- ~$0.10/month over free tier (negligible). Verify billing in GCP Console -> Billing -> Reports if a future cost spike appears.

## §K — Firestore export setup (one-time, OPS-13-07)

**Idempotent setup (committed in repo for reproducibility on a fresh project):**

```bash
cd C:/Users/nahde/claude-projects/couch
./scripts/firestore-export-setup.sh
```

What it does (verbatim from script — read it before running for the first time):

1. Creates Cloud Storage bucket `gs://queuenight-84044-backups` in `us-central1` with uniform-bucket-level-access enabled (T-8 mitigation against world-readable misconfigurations).
2. Sets a 30-day lifecycle delete rule (cost containment per RESEARCH.md Pitfall 8).
3. Grants the App Engine default SA (`queuenight-84044@appspot.gserviceaccount.com`):
   - Project IAM role: `roles/datastore.importExportAdmin`
   - Bucket IAM: `roles/storage.objectAdmin` on the backups bucket
4. Creates a Cloud Scheduler HTTP job `daily-firestore-export` at `0 3 * * *` America/Los_Angeles (daily 3am Pacific) hitting:
   - `https://firestore.googleapis.com/v1/projects/queuenight-84044/databases/(default):exportDocuments`
   - OAuth scope: `https://www.googleapis.com/auth/datastore` (NOT the default cloud-platform — Pitfall 6)
   - Body: `{"outputUriPrefix":"gs://queuenight-84044-backups"}`

**Manual smoke-test after setup:**

```bash
gcloud scheduler jobs run daily-firestore-export --location=us-central1
# Wait ~3-5 min, then:
gsutil ls gs://queuenight-84044-backups/
# Expect a directory like: gs://queuenight-84044-backups/2026-04-25T10:00:00_NNNNN/
```

**If the smoke-test fails with 401 PERMISSION_DENIED:** the OAuth scope is wrong. Re-run firestore-export-setup.sh; the update branch corrects in-place.

**Verifying the daily run:**

```bash
gcloud scheduler jobs describe daily-firestore-export --location=us-central1 --format="value(state,lastAttemptTime,status)"
```

## §L — GitHub branch protection (OPS-13-06)

Phase 13 / OPS-13-06 enabled branch protection on `main`.

**Product used: legacy Classic Branch Protection (NOT Rulesets).**
Rulesets and legacy Branch Protection both have the same enforcement constraint on a free GitHub plan: rules only enforce on **public** repositories or on **paid Team/Enterprise** organizations. The original plan assumed Rulesets on a private repo would enforce -- it does not. Resolution: the repo was made public (its content is already public via the deployed PWA at couchtonight.app, and TMDB/Firebase keys are public-by-design per CLAUDE.md), and the legacy Classic Branch Protection product was used because Rulesets is the user-friendlier wizard but the legacy product is feature-equivalent for the §L set.

GitHub's UI shows a deprecation banner suggesting migration to Rulesets ("Level up your branch protections with Repository Rules"). Migration is a future cleanup -- not urgent because the underlying enforcement is identical.

**Path:** `github.com/Nahder-Bot/Couch` -> Settings -> Branches (NOT Settings -> Rules -> Rulesets).

**Active rules (configured 2026-04-25):**
- Require a pull request before merging (0 approvals required -- solo-dev gate)
- Require status checks to pass: `syntax-check` (from `.github/workflows/ci.yml`)
- Require conversation resolution before merging
- Require linear history
- Do not allow bypassing the above settings (applies to administrators including the repo owner -- "Solo-dev safety" property)
- Allow force pushes: NOT enabled (force push blocked for everyone)
- Allow deletions: NOT enabled (branch deletion blocked for everyone)

**To make a normal change:**
```bash
git checkout -b fix/some-thing
# ...edit...
git commit -am "fix: some thing"
git push -u origin fix/some-thing
gh pr create --title "..." --body "..."
# CI runs syntax-check
gh pr merge --merge   # or --squash; linear-history is required
```

**Verifying the ruleset (review fix MEDIUM-7 -- throwaway-branch probe, no `git reset --hard`):**

```bash
git checkout main
git fetch origin main
git checkout -b probe/branch-protection-test
date >> .planning/RUNBOOK.md
git add .planning/RUNBOOK.md
git commit -m "test: branch protection probe -- DO NOT MERGE"
git push origin "probe/branch-protection-test:main"   # expected: GH013 reject
git checkout main
git branch -D probe/branch-protection-test
```

`main` is never modified locally; the ruleset rejects the push remotely. No destructive `git reset --hard HEAD~1` against `main` is needed.

**Emergency override (very rare):** If you absolutely need to bypass -- e.g., main is broken and CI is also broken -- temporarily edit the ruleset in GitHub Settings, push, then re-enable. Document in RETROSPECTIVE.md.

**Solo-dev safety:** the bypass list is intentionally empty so direct pushes from any local machine (including the user's own) are rejected. This catches "wait, I meant to do that on a branch" mistakes.

## §M -- Production services inventory (Phase 13 ship)

Quick reference for the live external services backing couchtonight.app after Phase 13.

**Firebase project: `queuenight-84044`** -- canonical project ID; `firebase use queuenight-84044`.
- **Hosting:** https://couchtonight.app (vanity), https://queuenight-84044.web.app (default). Files mirrored from couch/ to queuenight/public/ via `bash scripts/deploy.sh [<short-tag>]`.
- **Cloud Functions (us-central1, Node 22, 2nd Gen):** `requestAccountDeletion`, `cancelAccountDeletion`, `checkAccountDeleteEligibility`, `accountDeletionReaper` (scheduled, hourly), plus the prior phase functions (`rsvpSubmit`, `rsvpReminderTick`, `inviteGuest`, `claimMember`, etc.). Deploy via `firebase deploy --only functions:<name>` from `C:\Users\nahde\queuenight`.
- **Firestore:** rules at `queuenight/firestore.rules`; composite-indexes file is `queuenight/firestore.indexes.json` and is intentionally empty (TD-7). Single-field indexes are auto-managed.
- **Cloud Storage:** `queuenight-84044.firebasestorage.app` for couch-albums + Cloud Functions deploy artifacts.
- **Cloud Scheduler (Phase 13 OPS-13-07, NOT YET CONFIGURED):** to be created via `bash scripts/firestore-export-setup.sh` from a machine with `gcloud` installed and authed to `queuenight-84044`. See §K for the run procedure.

**Sentry org: `couchtonight`** at https://couchtonight.sentry.io.
- **Project:** `couch` (slug; renamed from auto-generated `javascript` 2026-04-25). Browser JavaScript platform. US data location.
- **DSN (public-by-design, embedded in client JS at app.html + landing.html):**
  ```
  https://f90a302fd66e098b71400bed3efb40ab@o4511281867587584.ingest.us.sentry.io/4511281871454208
  ```
- **Replay:** disabled for v1 -- see TECH-DEBT.md TD-6 for re-enable plan (post-launch +30 days).
- **Settings shortcut:** https://couchtonight.sentry.io/settings/projects/couch/

**GitHub repo: `Nahder-Bot/Couch`** -- now public (was private until 2026-04-25; flipped to enable branch-protection enforcement under free plan).
- **Branch protection:** legacy product on `main` per §L (PR-required with 0 approvals + syntax-check status check + linear history + conversation resolution + no admin bypass + force-push and deletion blocked).
- **CI:** `.github/workflows/ci.yml` runs the `syntax-check` job on every push and PR (node --check on JS files + JSON validation + HTML existence check).
