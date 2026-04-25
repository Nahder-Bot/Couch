---
phase: 13-compliance-and-ops
plan: "04"
subsystem: ops-infra
tags: [firestore-backup, cloud-scheduler, gcs, iam, runbook]
dependency_graph:
  requires: ["13-03"]
  provides: ["daily-firestore-export job config", "RUNBOOK §I restore semantics", "RUNBOOK §K export setup"]
  affects: ["queuenight-84044 GCP project (post human-verify)", ".planning/RUNBOOK.md"]
tech_stack:
  added: ["Cloud Scheduler HTTP job", "Cloud Storage lifecycle rule"]
  patterns: ["idempotent shell setup script", "OAuth-scoped scheduler job", "UPSERT vs replace-restore runbook discipline"]
key_files:
  created:
    - scripts/firestore-export-setup.sh
  modified:
    - .planning/RUNBOOK.md
decisions:
  - "Bucket region locked to us-central1 (matches Firestore region — Pitfall 3)"
  - "OAuth scope locked to auth/datastore not cloud-platform (Pitfall 6)"
  - "uniform-bucket-level-access enabled on bucket creation (T-8 / T-13-04-01 mitigation)"
  - "30-day lifecycle delete rule for cost containment (Pitfall 8)"
  - "RUNBOOK §I uses precise UPSERT semantics per review fix LOW — not the imprecise 'overwrites everything' wording"
  - "Idempotent script: gsutil ls -b checks bucket, gcloud scheduler jobs describe checks job before create"
metrics:
  duration: "~20 min (code-side only; gcloud execution deferred to human-verify)"
  completed: "2026-04-25T16:38:03Z"
  tasks_completed: 1
  tasks_total: 2
  files_created: 1
  files_modified: 1
---

# Phase 13 Plan 04: Scheduled Firestore Export (OPS-13-07) Summary

Daily Firestore export to `gs://queuenight-84044-backups` via Cloud Scheduler HTTP job hitting the Firestore admin REST endpoint directly with an OAuth-scoped App Engine service account — with RUNBOOK §I restore semantics calibrated for precision (UPSERT not destructive-overwrite) per review fix LOW.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | firestore-export-setup.sh + RUNBOOK §I §K | 4813bf2 | scripts/firestore-export-setup.sh (NEW), .planning/RUNBOOK.md (§I + §K appended) |

## Task 2: HUMAN-VERIFY Required

Task 2 is a `checkpoint:human-verify` that cannot be automated — it invokes `gcloud` against the live production project `queuenight-84044`. The code-side work is complete and committed; the GCP-side mutations require the user to run the setup script.

### Pre-flight: confirm gcloud auth + project state

```bash
gcloud auth list
# Expect: an authed account (the google account that owns the Firebase project)

gcloud config get-value project
# If not queuenight-84044:
gcloud config set project queuenight-84044
```

### Step B: Run the setup script

```bash
cd C:/Users/nahde/claude-projects/couch
./scripts/firestore-export-setup.sh
```

Expected output milestones:
- "Bucket gs://queuenight-84044-backups already exists; skipping create." OR "Creating bucket..."
- "Lifecycle set: delete objects after 30 days."
- "Granted queuenight-84044@appspot.gserviceaccount.com -> roles/datastore.importExportAdmin"
- "Granted queuenight-84044@appspot.gserviceaccount.com -> storage.objectAdmin on gs://queuenight-84044-backups"
- "Creating scheduler job daily-firestore-export..." OR "...exists; updating..."
- "=== Setup complete ==="

### Step C: Smoke-test by triggering the job manually

```bash
gcloud scheduler jobs run daily-firestore-export --location=us-central1
```

### Step D: Wait 3-5 minutes, then verify the export landed

```bash
gsutil ls gs://queuenight-84044-backups/
# Expect: gs://queuenight-84044-backups/2026-04-25T<HH:MM:SS>_NNNNN/
```

### Step E: Verify Cloud Scheduler shows the job in healthy state

```bash
gcloud scheduler jobs describe daily-firestore-export --location=us-central1 --format="value(state,lastAttemptTime,status.code)"
# Expected: ENABLED  <recent timestamp>  0
```

### Common failure modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| 401 PERMISSION_DENIED in scheduler logs | OAuth scope wrong | Re-run firestore-export-setup.sh (the update branch corrects in-place) |
| "BillingDisabled" on bucket create | Blaze billing not active | STATE.md confirms it IS active for queuenight-84044 — should not happen |
| "API not enabled" for cloudscheduler.googleapis.com | API disabled | Enable in GCP Console once, then re-run script |

### Resume signal (reply with one of):

- `"setup complete -- smoke export landed at gs://queuenight-84044-backups/<timestamp>"` (success)
- `"setup complete -- script ran clean but smoke run hasn't fired yet (will check tomorrow's 3am run)"` (acceptable)
- `"setup failed -- <error>"` (escalation — debug per Pitfall 6 / billing / API-enable checks above)
- `"skip -- gcloud not authed; will defer this plan to a session where setup can run"` (acceptable defer)

## What Was Built

### scripts/firestore-export-setup.sh

Idempotent one-time gcloud setup script (min_lines: 25 — actual: 83 lines). Safe to re-run.

Key implementation decisions:
- **Bucket existence check:** `gsutil ls -b "${BUCKET}" >/dev/null 2>&1` — only creates if absent, never errors if bucket already exists
- **Lifecycle:** `gsutil lifecycle set` is always run (idempotent — replaces any existing rule)
- **IAM:** `gcloud projects add-iam-policy-binding` is idempotent by design
- **Scheduler job:** `gcloud scheduler jobs describe` probe → branch to `create` or `update http`
- **OAuth scope:** `https://www.googleapis.com/auth/datastore` (Pitfall 6 — NOT the default `cloud-platform`)
- **Uniform-bucket-level-access:** `gsutil mb -l "${REGION}" -b on "${BUCKET}"` (T-13-04-01 / T-8 mitigation)
- **Schedule:** `0 3 * * *` America/Los_Angeles (daily 3am Pacific)

### RUNBOOK §I — Restore from Firestore export (OPS-13-07)

Inserted between §H and §J. Review fix LOW applied — semantics are precise:

- **Default path (UPSERT):** Documents in export overwrite live matches; documents created AFTER the export are LEFT UNTOUCHED (not deleted). Documents in export that don't exist live are CREATED.
- **Replace-restore (single collection):** Drop live collection (`firebase firestore:delete`) then `gcloud firestore import --collection-ids=<collection>`
- **Replace-restore (full DB):** Restore-to-new-DB path (safest — preserves corrupted state for forensics); or drop-all-then-import.
- **Partial restore:** `--collection-ids=` documented for targeted recovery.
- Literal "UPSERT" used throughout; "restore overwrites everything" NOT present.

### RUNBOOK §K — Firestore export setup (one-time, OPS-13-07)

Inserted between §J and §L. Contains:
- Script invocation command
- What the script does (4 steps verbatim)
- Manual smoke-test commands
- 401 PERMISSION_DENIED recovery note
- `gcloud scheduler jobs describe` verification command

### Section ordering verified

`§A §B §C §D §E §F §G §H §I §J §K §L` — confirmed by `grep -n "^## §" .planning/RUNBOOK.md`

## STRIDE Threat Dispositions

| Threat ID | Category | Component | Disposition | Status |
|-----------|----------|-----------|-------------|--------|
| T-13-04-01 | I (Information disclosure) | Backup bucket world-readable | mitigate | `gsutil mb -b on` in script — uniform-bucket-level-access enabled at creation; no per-object ACLs possible |
| T-13-04-02 | E (Elevation) | OAuth scope cloud-platform (over-broad) | mitigate | `--oauth-token-scope="https://www.googleapis.com/auth/datastore"` in script — scope locked to Firestore admin only |
| T-13-04-03 | D (Denial of service) | Daily export cost spiral at growth | accept | 30-day lifecycle rule + Pitfall 8 guidance in RUNBOOK §K to switch to PITR if cost matters at scale |
| T-13-04-04 | T (Tampering) | Restore command is UPSERT not destructive (review fix LOW) | mitigate | RUNBOOK §I documents precise UPSERT semantics + drop-then-import + restore-to-new-DB recipes + "NEVER without outage incident declared" warning |
| T-13-04-05 | R (Repudiation) | No audit trail of restore operations | accept | GCP Cloud Audit Logs capture gcloud calls automatically — no additional code needed |

## Deviations from Plan

None — plan executed exactly as written. The `autonomous: false` / `checkpoint:human-verify` at Task 2 is by design; gcloud execution against `queuenight-84044` requires user auth and is documented above.

## Deferred Items

1. **PITR cost comparison (Pitfall 8):** Post-launch, evaluate Google Cloud Firestore PITR (Point-In-Time Recovery — native, no bucket needed) vs the current scheduled-export approach once the family count grows. PITR is simpler operationally but costs more at scale. Tracked in TECH-DEBT.md (Plan 13-05 wave).
2. **Quarterly restore drill:** Validate `gcloud firestore import` recipes in RUNBOOK §I against a TEST Firestore database (not prod). Confirm UPSERT vs replace-restore semantics match documented behavior. Schedule quarterly. Tracked in TECH-DEBT.md.

## Known Stubs

None. This plan produces infrastructure configuration (script + runbook docs), not UI. No data stubs.

## Threat Flags

None. No new network endpoints, auth paths, or schema changes introduced beyond what is already in the plan's threat model.

## Self-Check

### Created files exist:
- `scripts/firestore-export-setup.sh` — confirmed (created by Write tool, committed at 4813bf2)
- `.planning/phases/13-compliance-and-ops/13-04-SUMMARY.md` — this file

### Commits exist:
- `4813bf2` — `feat(13-04): add firestore-export-setup.sh + RUNBOOK §I §K (restore semantics precise per review)`

### Acceptance criteria verified:
- [x] `scripts/firestore-export-setup.sh` begins with `#!/usr/bin/env bash`
- [x] Contains `set -euo pipefail`
- [x] Contains literal `gs://queuenight-84044-backups` (in comment on BUCKET line)
- [x] Contains `roles/datastore.importExportAdmin`
- [x] Contains `https://www.googleapis.com/auth/datastore`
- [x] Contains `gsutil mb -l "${REGION}" -b on "${BUCKET}"` (T-8 mitigation)
- [x] Contains `daily-firestore-export`
- [x] Contains `0 3 * * *`
- [x] Contains `America/Los_Angeles`
- [x] Contains `gsutil ls -b` (bucket existence check — idempotency)
- [x] Contains `gcloud scheduler jobs describe` (job existence check — idempotency)
- [x] `bash -n scripts/firestore-export-setup.sh` exits 0
- [x] RUNBOOK.md contains exactly 1 × `## §I — Restore from Firestore export`
- [x] RUNBOOK.md contains exactly 1 × `## §K — Firestore export setup`
- [x] RUNBOOK.md still contains §H, §J, §L (Plan 13-03 content preserved)
- [x] RUNBOOK.md §I contains `UPSERT` (×4), `Replace-restore` (×3), `--collection-ids=` (×4), `restore-to-new-DB` (×2)
- [x] RUNBOOK.md §I does NOT contain `restore overwrites everything`
- [x] Section ordering: §A < §B < ... < §H < §I < §J < §K < §L

## Self-Check: PASSED
