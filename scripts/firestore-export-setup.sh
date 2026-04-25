#!/usr/bin/env bash
# scripts/firestore-export-setup.sh -- Phase 13 / OPS-13-07
# ONE-TIME setup. Run once per Firebase project. Idempotent (safe to re-run).
# Verbatim from RESEARCH.md Pattern 3 + T-13-04-01 (T-8) bucket-level-access mitigation.
#
# Prerequisites (NOT installed by this script):
#   gcloud CLI authed (`gcloud auth login`)
#   gcloud project set: gcloud config set project queuenight-84044

set -euo pipefail

PROJECT="queuenight-84044"
REGION="us-central1"  # MUST match Firestore region (Firestore is us-central1)
BUCKET="gs://${PROJECT}-backups"  # gs://queuenight-84044-backups
SA="${PROJECT}@appspot.gserviceaccount.com"
JOB_NAME="daily-firestore-export"

echo "=== Phase 13 / OPS-13-07 -- Firestore export setup ==="
echo "Project: $PROJECT  Region: $REGION  Bucket: $BUCKET"
echo ""

# 1. Bucket (idempotent: gsutil ls -b fails if not exists, so test first)
if gsutil ls -b "${BUCKET}" >/dev/null 2>&1; then
  echo "Bucket ${BUCKET} already exists; skipping create."
else
  echo "Creating bucket ${BUCKET} in ${REGION}..."
  # T-13-04-01 (T-8) mitigation: uniform-bucket-level-access prevents per-object ACL drift
  gsutil mb -l "${REGION}" -b on "${BUCKET}"
  echo "Bucket created."
fi

# 2. Lifecycle (30-day retention) -- idempotent: gsutil lifecycle set replaces existing
TMP_LC="$(mktemp 2>/dev/null || echo /tmp/lifecycle-$$.json)"
cat > "${TMP_LC}" <<EOF
{
  "lifecycle": {
    "rule": [
      { "action": {"type": "Delete"}, "condition": {"age": 30} }
    ]
  }
}
EOF
gsutil lifecycle set "${TMP_LC}" "${BUCKET}"
rm -f "${TMP_LC}"
echo "Lifecycle set: delete objects after 30 days."

# 3. IAM -- idempotent: add-iam-policy-binding is idempotent
gcloud projects add-iam-policy-binding "${PROJECT}" \
  --member="serviceAccount:${SA}" \
  --role="roles/datastore.importExportAdmin" \
  --condition=None >/dev/null
echo "Granted ${SA} -> roles/datastore.importExportAdmin"

# Bucket-level admin -- idempotent: gsutil iam ch is idempotent for the same binding
gsutil iam ch "serviceAccount:${SA}:roles/storage.objectAdmin" "${BUCKET}"
echo "Granted ${SA} -> storage.objectAdmin on ${BUCKET}"

# 4. Cloud Scheduler job (idempotent: try create, if exists then update)
JOB_ARGS=(
  --location="${REGION}"
  --schedule="0 3 * * *"
  --time-zone="America/Los_Angeles"
  --uri="https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default):exportDocuments"
  --http-method=POST
  --oauth-service-account-email="${SA}"
  --oauth-token-scope="https://www.googleapis.com/auth/datastore"
  --headers="Content-Type=application/json"
  --message-body="{\"outputUriPrefix\":\"${BUCKET}\"}"
)

if gcloud scheduler jobs describe "${JOB_NAME}" --location="${REGION}" >/dev/null 2>&1; then
  echo "Scheduler job ${JOB_NAME} exists; updating..."
  gcloud scheduler jobs update http "${JOB_NAME}" "${JOB_ARGS[@]}"
else
  echo "Creating scheduler job ${JOB_NAME}..."
  gcloud scheduler jobs create http "${JOB_NAME}" "${JOB_ARGS[@]}"
fi

echo ""
echo "=== Setup complete ==="
echo "To smoke-test now: gcloud scheduler jobs run ${JOB_NAME} --location=${REGION}"
echo "To list exports:    gsutil ls ${BUCKET}/"
