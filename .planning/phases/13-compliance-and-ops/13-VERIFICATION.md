---
phase: 13-compliance-and-ops
verified: 2026-04-25T18:00:00Z
status: human_needed
score: 6/6 requirements delivered (code-side); 4 items awaiting user action
overrides_applied: 0
deferred:
  - truth: "firebase-functions SDK upgraded from v4 to v7"
    addressed_in: "Phase 14"
    evidence: "TECH-DEBT.md TD-1: 'firebase-functions SDK 4.x -> 7.x upgrade — deferred to Phase 14'"
  - truth: "Variant-B storage rules tightened to uid-scoped member writes"
    addressed_in: "Post Phase 5 milestone"
    evidence: "TECH-DEBT.md TD-2: 'Variant-B storage rules tightening — Blocked on Phase 5 member-uid migration'"
human_verification:
  - test: "Deploy Cloud Functions: requestAccountDeletion + cancelAccountDeletion + checkAccountDeleteEligibility + accountDeletionReaper"
    expected: "All 4 CFs live in us-central1 under queuenight-84044; Cloud Scheduler job firebase-schedule-accountDeletionReaper-us-central1 auto-created"
    why_human: "CF deploy requires gcloud/firebase CLI auth in the queuenight sibling repo — cannot be automated from couch repo"
  - test: "Deploy Firestore indexes (firebase deploy --only firestore:indexes --project queuenight-84044)"
    expected: "collectionGroup(members).where('uid','==',uid) index shows READY status in GCP Console > Firestore > Indexes"
    why_human: "Index build requires firebase CLI auth + takes a few minutes to become READY; cannot verify programmatically from this repo"
  - test: "Sentry account creation + DSN substitution: replace <SENTRY_PUBLIC_KEY>, <SENTRY_ORGID>, <SENTRY_PROJECTID> in app.html + landing.html before running deploy.sh"
    expected: "deploy.sh Sentry DSN guard passes (no MEDIUM-5 abort); errors from couchtonight.app appear in Sentry inbox"
    why_human: "Requires a Sentry account and a live project DSN — external service, cannot be code-verified"
  - test: "Configure protect-main branch ruleset in GitHub Settings > Rules > Rulesets per RUNBOOK §L; execute gcloud auth + ./scripts/firestore-export-setup.sh"
    expected: "Direct push to main rejected (GH013 error); daily-firestore-export Cloud Scheduler job visible in GCP Console"
    why_human: "GitHub ruleset is web-UI config; gcloud setup requires CLI auth — both require live external-system access"
---

# Phase 13: Compliance & Ops Sprint — Verification Report

**Phase Goal:** Operational hygiene + compliance hardening sprint — self-serve account deletion, Sentry error reporting, BUILD_DATE auto-stamp, scheduled Firestore export, CSP Report-Only header, and GitHub branch protection spec.

**Verified:** 2026-04-25

**Status:** HUMAN_NEEDED — all 6 requirements are code-delivered and structurally wired; 4 items require user/live-system action before the phase is operationally complete.

**Re-verification:** No — initial verification.

---

## Overall Verdict: PARTIAL (code-complete; ops activation pending)

| Req | Promise | Verdict |
|-----|---------|---------|
| COMP-13-01 | Self-serve account deletion with 14-day grace + cascade reaper | CODE-DELIVERED, USER-PENDING (CF deploy + indexes) |
| OPS-13-02 | BUILD_DATE auto-stamp at deploy time, mirror-only | DELIVERED |
| OPS-13-04 | CSP-Report-Only header covering all 6 origin classes; existing 3 headers preserved | DELIVERED |
| OPS-13-05 | Sentry CDN loader in both HTML surfaces, PII-scrub, no Replay | CODE-DELIVERED, USER-PENDING (DSN substitution) |
| OPS-13-06 | Deploy.sh Sentry DSN fail-fast guard; RUNBOOK §L protect-main spec | CODE-DELIVERED, USER-PENDING (GitHub web UI) |
| OPS-13-07 | scripts/firestore-export-setup.sh idempotent; Cloud Scheduler HTTP job via Firestore REST; RUNBOOK §I + §K | CODE-DELIVERED, USER-PENDING (gcloud execution) |
| OPS-13-01 | firebase-functions SDK 4→7 | DEFERRED to Phase 14 (TD-1) |
| OPS-13-03 | Variant-B storage rules | DEFERRED to post-Phase-5 milestone (TD-2) |

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Signed-in user can request account deletion from Account → ADMIN via typed-DELETE modal | VERIFIED | `app.html:783` — `delete-account-btn` with `onclick="openDeleteAccountConfirm()"` present; `app.html:816-829` — typed-DELETE modal with `delete-account-confirm-input` |
| 2 | Soft-delete sets 14-day grace window; sign-in detects pending deletion and shows banner | VERIFIED | `requestAccountDeletion.js:34-42` — `hardDeleteAt = Date.now() + 14*24*60*60*1000`; `js/app.js:2072-2088` — onAuthStateChangedCouch detour reads `deletionRequestedAt`+`hardDeleteAt > now` |
| 3 | Cascade hard-delete via scheduled reaper: Firestore families+sessions sweep + Storage couch-albums + Firebase Auth | VERIFIED | `accountDeletionReaper.js:126-293` — hourly onSchedule CF; sessions sweep at lines 68-124; Storage sweep at lines 249-255; Auth delete at lines 262-265; audit log at lines 269-273 |
| 4 | BUILD_DATE auto-stamp targets the deploy mirror only, not source tree | VERIFIED | `scripts/deploy.sh:99-118` — stamps `QUEUENIGHT_ROOT/public/js/constants.js` via sed; comment at line 117: "source tree untouched — review fix MEDIUM-8" |
| 5 | CSP-Report-Only header on all paths covering all 6 origin classes; existing 3 headers preserved verbatim | VERIFIED | `queuenight/firebase.json:72-82` — X-Content-Type-Options + Referrer-Policy + X-Frame-Options + CSP-Report-Only on `**/*` |
| 6 | Sentry CDN loader in both app.html + landing.html; PII-scrubbing beforeSend; Firestore noise beforeBreadcrumb; Session Replay absent | VERIFIED | `app.html:56-125`; `landing.html:46-115`; Session Replay absent: no `replaysOnErrorSampleRate`, `replaysSessionSampleRate`, or `Sentry.replayIntegration` in either file |
| 7 | deploy.sh fail-fast guard for unsubstituted Sentry DSN placeholders | VERIFIED | `scripts/deploy.sh:120-138` — SENTRY_PLACEHOLDERS_REGEX guard with `exit 1` on match |
| 8 | RUNBOOK §L documents protect-main ruleset configuration | VERIFIED | `RUNBOOK.md:397-441` — §L section with full ruleset spec, probe procedure, and solo-dev safety note |
| 9 | firestore-export-setup.sh is idempotent and creates Cloud Scheduler HTTP job hitting Firestore admin REST | VERIFIED | `scripts/firestore-export-setup.sh:23-77` — all 4 steps (bucket, lifecycle, IAM, scheduler) use idempotent patterns; scheduler job uses `--uri="https://firestore.googleapis.com/v1/projects/..."` at line 63 |
| 10 | RUNBOOK §I distinguishes UPSERT from replace semantics; §K covers setup runbook | VERIFIED | `RUNBOOK.md:291-340` — §I documents UPSERT semantics explicitly with table of goals vs. recipes; `RUNBOOK.md:359-396` — §K setup commands |

**Score:** 10/10 truths verified (code-side)

---

## Per-Requirement Deep Dives

### COMP-13-01 — Self-Serve Account Deletion

**Verdict: CODE-DELIVERED, USER-PENDING**

**Code evidence:**

- `app.html:783` — `<button class="pill destructive-confirm" id="delete-account-btn" onclick="openDeleteAccountConfirm()">Delete account</button>`
- `app.html:816-852` — Three modals: typed-DELETE (`delete-account-modal-bg`), owner-blocker (`delete-account-blocker-bg`), deletion-pending (`deletion-pending-bg`)
- `css/app.css:2653-2660` — `.destructive-confirm` class defined; `app.css:2662+` — delete-account modal-specific styles
- `js/app.js:2725` — `window.openDeleteAccountConfirm` pre-flight calls `checkAccountDeleteEligibility` CF
- `js/app.js:2772` — `window.performDeleteAccount` calls `requestAccountDeletion` CF with `confirm:'DELETE'` gate
- `js/app.js:2807` — `window.cancelMyDeletion` calls `cancelAccountDeletion` CF
- `js/app.js:2072-2088` — soft-delete detour in `onAuthStateChangedCouch`; reads `deletionRequestedAt`+`hardDeleteAt`; routes to `deletion-pending-bg` before normal app shell
- `queuenight/functions/src/requestAccountDeletion.js:34-42` — 14-day `hardDeleteAt` timer; owner-of-family pre-flight at line 27
- `queuenight/functions/src/cancelAccountDeletion.js:16-20` — clears `deletionRequestedAt`, `hardDeleteAt`, writes `deletionCancelledAt`
- `queuenight/functions/src/checkAccountDeleteEligibility.js:16-19` — queries `families.where('ownerUid','==',uid)`
- `queuenight/functions/src/accountDeletionReaper.js:126` — `onSchedule('every 1 hours', ...)` in us-central1
- `accountDeletionReaper.js:40-64` — `discoverFamilyCodes` uses reverse-index primary + `collectionGroup('members').where('uid','==',uid)` fallback
- `accountDeletionReaper.js:68-124` — `sweepSessionsForFamily`: expired sessions deleted, active sessions scrubbed (actingUid, votes, vetoes, chooserHistory, participants)
- `accountDeletionReaper.js:249-255` — Storage sweep: `bucket.getFiles({prefix:'couch-albums/{familyCode}/'})` filtered by `_${uid}.jpg`
- `accountDeletionReaper.js:259` — `recursiveDeleteRef(db.collection('users').doc(uid))` via Admin SDK
- `accountDeletionReaper.js:262-265` — `admin.auth().deleteUser(uid)` (terminal step)
- `accountDeletionReaper.js:269-274` — `deletionAudits` collection write
- `queuenight/functions/index.js:662-665` — all 4 CFs registered: `requestAccountDeletion`, `cancelAccountDeletion`, `checkAccountDeleteEligibility`, `accountDeletionReaper`
- `queuenight/firestore.indexes.json:1-12` — `collectionGroup members` index on `uid` ASCENDING
- Fallback contact: `js/app.js:2802` — `"privacy@couchtonight.app"` (not nahderz@gmail.com)

**User-pending:**
1. `firebase deploy --only functions:requestAccountDeletion,functions:cancelAccountDeletion,functions:checkAccountDeleteEligibility,functions:accountDeletionReaper --project queuenight-84044` from queuenight/
2. `firebase deploy --only firestore:indexes --project queuenight-84044` — collectionGroup(members) index must be READY before reaper's fallback path works reliably

---

### OPS-13-02 — BUILD_DATE Auto-Stamp

**Verdict: DELIVERED**

**Code evidence:**

- `scripts/deploy.sh:99-118` — Step 6: stamps `${QUEUENIGHT_ROOT}/public/js/constants.js` (the mirror), NOT `js/constants.js` in source. Uses `sed -i` with regex `s|export const BUILD_DATE = '[0-9]{4}-[0-9]{2}-[0-9]{2}';|export const BUILD_DATE = '${TODAY}';|`
- `scripts/deploy.sh:117` — inline comment: "source tree untouched — review fix MEDIUM-8"
- `js/constants.js:792-793` — `export const APP_VERSION = 32; export const BUILD_DATE = '2026-04-25';` — source tree has a static date that deploy.sh intentionally leaves alone; the mirror gets the live stamp
- `package.json:6-7` — `"deploy": "bash scripts/deploy.sh"` shortcut registered
- `RUNBOOK.md:226-265` — §H documents `scripts/deploy.sh` as canonical deploy path with BUILD_DATE stamp described in step 7
- `scripts/stamp-build-date.cjs` — legacy standalone script retained (still works for source-stamping if needed separately)

The review fix MEDIUM-8 (no dirty-tree-after-deploy failure mode) is structurally enforced: deploy.sh stamps only the mirror copy, so `git status` in the couch repo stays clean after a deploy run.

---

### OPS-13-04 — Content-Security-Policy-Report-Only Header

**Verdict: DELIVERED**

**Code evidence (queuenight/firebase.json:72-82):**

Applied to `**/*` source pattern. Full CSP value verified against all 6 origin classes:

| Origin Class | Covered By | Directive |
|---|---|---|
| Firebase (hosting, auth, SDK, Firestore, Storage) | `https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://www.gstatic.com https://*.firebaseapp.com` | connect-src, script-src, frame-src |
| TMDB | `https://api.themoviedb.org https://image.tmdb.org` | connect-src, img-src |
| Trakt | `https://api.trakt.tv` | connect-src |
| Google Fonts | `https://fonts.googleapis.com https://fonts.gstatic.com` | style-src, font-src |
| Sentry CDN + ingest | `https://js.sentry-cdn.com https://*.sentry-cdn.com https://browser.sentry-cdn.com https://*.ingest.us.sentry.io` | script-src, connect-src |
| queuenight Cloud Functions | `https://us-central1-queuenight-84044.cloudfunctions.net` | connect-src |

**Existing 3 headers preserved verbatim (lines 74-76):**
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`

**Review fix LOW (worker-src blob:):** `worker-src 'self' blob:` present in CSP value.

**TECH-DEBT.md TD-4** updated to "Partial close — CSP shipped in Report-Only mode; enforcement deferred" at line 161.

---

### OPS-13-05 — Sentry CDN Loader

**Verdict: CODE-DELIVERED, USER-PENDING (DSN substitution)**

**Code evidence:**

**app.html (lines 56-125):**
- CDN script: `<script src="https://js.sentry-cdn.com/<SENTRY_PUBLIC_KEY>.min.js" crossorigin="anonymous">` at line 125
- `window.sentryOnLoad` block at lines 63-123 with:
  - `Sentry.init({dsn: 'https://<SENTRY_PUBLIC_KEY>@o<SENTRY_ORGID>.ingest.us.sentry.io/<SENTRY_PROJECTID>', ...})`
  - `tracesSampleRate: 0.1`
  - `integrations: [Sentry.browserTracingIntegration()]` — NO Replay integration
  - `beforeSend`: strips `user.id`, `user.email`, `user.username`, `user.ip_address`; scrubs family codes via `FAMILY_RE = /\b[a-f0-9]{6}\b/gi`; strips `?invite=`, `?claim=`, `/rsvp/<token>` from URLs and breadcrumbs
  - `beforeBreadcrumb`: filters messages matching `/WebChannelConnection|FirebaseError|firestore\.googleapis/` — returns null (drops them)

**landing.html (lines 46-115):** Identical `sentryOnLoad` block and CDN script tag.

**Session Replay verification:** Neither file contains `replaysOnErrorSampleRate`, `replaysSessionSampleRate`, or `Sentry.replayIntegration`. Confirmed absent via grep.

**TECH-DEBT.md TD-6** documents Sentry Replay deferral with re-enable plan.

**User-pending:**
- Create Sentry project at sentry.io → get DSN
- Substitute `<SENTRY_PUBLIC_KEY>`, `<SENTRY_ORGID>`, `<SENTRY_PROJECTID>` in `app.html` + `landing.html`
- Commit, then run `./scripts/deploy.sh` — the MEDIUM-5 guard will abort if placeholders remain in the mirror

---

### OPS-13-06 — GitHub Branch Protection + deploy.sh Sentry Guard

**Verdict: CODE-DELIVERED, USER-PENDING (GitHub web UI)**

**Code evidence:**

**deploy.sh Sentry DSN placeholder guard (lines 120-138):**
```bash
SENTRY_PLACEHOLDERS_REGEX='<SENTRY_PUBLIC_KEY>|<SENTRY_ORGID>|<SENTRY_PROJECTID>'
for f in "${QUEUENIGHT_ROOT}/public/app.html" "${QUEUENIGHT_ROOT}/public/landing.html"; do
  if grep -qE "${SENTRY_PLACEHOLDERS_REGEX}" "$f"; then
    echo "ERROR: ${f} still contains a Sentry DSN placeholder."
    SENTRY_VIOLATIONS=$((SENTRY_VIOLATIONS + 1))
  fi
done
if [ "$SENTRY_VIOLATIONS" -gt 0 ]; then
  exit 1  # fail-fast
fi
```

**RUNBOOK §L (lines 397-441):** Documents the full `protect-main` ruleset configuration:
- Restrict deletions
- Block force pushes
- Require linear history
- Require a pull request before merging (0 reviewers — solo-dev gate)
- Require status checks to pass: `syntax-check` (from `.github/workflows/ci.yml`)
- Require conversation resolution before merging
- Includes probe procedure and solo-dev safety note

**User-pending:** Configure the ruleset in GitHub Settings > Rules > Rulesets per §L (web UI action).

---

### OPS-13-07 — Scheduled Firestore Export

**Verdict: CODE-DELIVERED, USER-PENDING (gcloud execution)**

**Code evidence:**

**scripts/firestore-export-setup.sh (lines 1-82):** Idempotent bash script:
- Step 1 (lines 23-30): Bucket create with `gsutil ls -b` existence check; creates with `-b on` (uniform-bucket-level-access per T-8 mitigation)
- Step 2 (lines 32-45): Lifecycle rule (30-day delete); uses `gsutil lifecycle set` which is always idempotent (replaces existing rule)
- Step 3 (lines 47-56): IAM bindings; `add-iam-policy-binding` and `gsutil iam ch` are both idempotent for same bindings
- Step 4 (lines 58-77): Cloud Scheduler job using `gcloud scheduler jobs describe` to detect exists → update vs. create

**Cloud Scheduler job config:**
- Schedule: `0 3 * * *` (daily 3am Pacific / America/Los_Angeles)
- URI: `https://firestore.googleapis.com/v1/projects/queuenight-84044/databases/(default):exportDocuments` (Firestore admin REST, not Cloud Functions)
- Method: POST with OAuth `datastore` scope
- Body: `{"outputUriPrefix":"gs://queuenight-84044-backups"}`

**RUNBOOK §I (lines 291-340):** Restore semantics — explicitly distinguishes UPSERT (overlay, does NOT remove post-export docs) from replace-restore (drop + re-import or restore-to-new-DB path). Table at line 307-313 covers 4 recovery scenarios.

**RUNBOOK §K (lines 359-396):** One-time setup commands + smoke-test + failure triage.

**User-pending:** `gcloud auth login` + `gcloud config set project queuenight-84044` + `./scripts/firestore-export-setup.sh`

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|---------|--------|---------|
| `queuenight/functions/src/requestAccountDeletion.js` | Soft-delete callable | VERIFIED | ~43 lines; 14-day timer; owner pre-flight |
| `queuenight/functions/src/cancelAccountDeletion.js` | Cancel callable | VERIFIED | ~22 lines; clears hardDeleteAt + sets deletionCancelledAt |
| `queuenight/functions/src/checkAccountDeleteEligibility.js` | Eligibility check callable | VERIFIED | ~22 lines; queries ownerUid |
| `queuenight/functions/src/accountDeletionReaper.js` | Hourly scheduled reaper | VERIFIED | ~293 lines; sessions sweep + Storage + Auth + audit log |
| `queuenight/functions/index.js` | CF registrations | VERIFIED | Lines 662-665: all 4 COMP-13-01 CFs exported |
| `queuenight/firestore.indexes.json` | collectionGroup(members) uid index | VERIFIED | 12 lines; COLLECTION_GROUP scope; uid ASCENDING |
| `app.html` | Delete-account button + 3 modals | VERIFIED | Lines 783, 816-852; `delete-account-btn`, 3 modal-bg elements |
| `app.html` | Sentry CDN loader + sentryOnLoad | VERIFIED | Lines 56-125; DSN placeholder (intentional; deploy guard enforces substitution) |
| `landing.html` | Sentry CDN loader + sentryOnLoad | VERIFIED | Lines 46-115; identical to app.html Sentry block |
| `css/app.css` | `.destructive-confirm` class | VERIFIED | Lines 2653-2660 |
| `scripts/deploy.sh` | BUILD_DATE stamp + Sentry DSN guard + mirror logic | VERIFIED | Mirror-stamp at lines 99-118; DSN guard at lines 120-138 |
| `scripts/firestore-export-setup.sh` | Idempotent gcloud setup script | VERIFIED | 82 lines; all 4 steps idempotent |
| `queuenight/firebase.json` | CSP-Report-Only header on `**/*` | VERIFIED | Lines 72-82; all 6 origin classes; 3 existing headers preserved |
| `.planning/RUNBOOK.md §H` | deploy.sh canonical deploy procedure | VERIFIED | Lines 226-290 |
| `.planning/RUNBOOK.md §I` | Restore semantics (UPSERT vs. replace) | VERIFIED | Lines 291-340 |
| `.planning/RUNBOOK.md §J` | Cloud Scheduler job inventory | VERIFIED | Lines 343-357; accountDeletionReaper + daily-firestore-export listed |
| `.planning/RUNBOOK.md §K` | Firestore export setup runbook | VERIFIED | Lines 359-396 |
| `.planning/RUNBOOK.md §L` | protect-main ruleset spec | VERIFIED | Lines 397-441 |
| `.planning/TECH-DEBT.md TD-4` | CSP status updated | VERIFIED | Lines 157-183; "Partial close — CSP shipped in Report-Only mode" |
| `.planning/TECH-DEBT.md TD-6` | Sentry Replay deferred entry | VERIFIED | Lines 14-50; re-enable plan documented |
| `package.json` | npm run deploy + npm run stamp shortcuts | VERIFIED | Lines 6-7 |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `app.html #delete-account-btn` | `openDeleteAccountConfirm()` | `onclick=` | WIRED | Line 783 |
| `openDeleteAccountConfirm` | `checkAccountDeleteEligibility` CF | `httpsCallable(functions, 'checkAccountDeleteEligibility')` | WIRED | `js/app.js:2729` |
| `performDeleteAccount` | `requestAccountDeletion` CF | `httpsCallable(functions, 'requestAccountDeletion')` | WIRED | `js/app.js:2772+` |
| `cancelMyDeletion` | `cancelAccountDeletion` CF | `httpsCallable(functions, 'cancelAccountDeletion')` | WIRED | `js/app.js:2807-2810` |
| `accountDeletionReaper.js` | `discoverFamilyCodes` (dual-path) | reverse-index + `collectionGroup('members')` | WIRED | Lines 39-64 |
| `accountDeletionReaper.js` | sessions sweep | `sweepSessionsForFamily(famRef, uid)` | WIRED | Lines 68-124, 236-245 |
| `accountDeletionReaper.js` | Storage sweep | `bucket.getFiles({prefix:'couch-albums/...'})` | WIRED | Lines 249-255 |
| `accountDeletionReaper.js` | Auth deletion | `admin.auth().deleteUser(uid)` | WIRED | Lines 262-265 |
| `deploy.sh step 6` | mirror constants.js | `sed -i` on `QUEUENIGHT_ROOT/public/js/constants.js` | WIRED | Lines 99-118 |
| `deploy.sh step 7` | Sentry DSN guard | `grep -qE SENTRY_PLACEHOLDERS_REGEX` | WIRED | Lines 120-138 |
| `firebase.json **/*` | CSP-Report-Only header | headers array, source `**/*` | WIRED | Lines 72-82 |
| `app.html sentryOnLoad` | Sentry CDN script | `<script src="https://js.sentry-cdn.com/...">` | WIRED | Line 125 |
| `landing.html sentryOnLoad` | Sentry CDN script | `<script src="https://js.sentry-cdn.com/...">` | WIRED | Line 115 |
| `functions/index.js` | accountDeletionReaper export | `require('./src/accountDeletionReaper')` | WIRED | Line 665 |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| delete-account modal | `r.data.eligible`, `r.data.ownedFamilies` | `checkAccountDeleteEligibility` CF → Firestore `families.where('ownerUid','==',uid)` | Yes — live Firestore query | FLOWING |
| deletion-pending banner | `userData.hardDeleteAt`, `userData.deletionRequestedAt` | `getDoc(doc(db,'users',user.uid))` in `onAuthStateChangedCouch` | Yes — live Firestore read | FLOWING |
| accountDeletionReaper | `due` (users with expired grace) | `db.collection('users').where('hardDeleteAt','<=',now)` | Yes — live Firestore query | FLOWING |
| BUILD_DATE in ABOUT section | `BUILD_DATE` from `js/constants.js` | `stamp-build-date.cjs` / deploy.sh sed stamps mirror constants.js | Yes — stamped per deploy | FLOWING |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED for CF functions (require Firebase/GCP live execution). The following static checks were performed instead:

| Check | Result |
|-------|--------|
| `node --check scripts/deploy.sh` equivalent — bash syntax | Script uses valid bash constructs; `set -euo pipefail` guards |
| `node --check scripts/firestore-export-setup.sh` equivalent — bash syntax | Script uses valid bash constructs; all gsutil/gcloud invocations correctly formed |
| Sentry Replay keys absent from app.html | PASS — grep confirms no `replaysOnErrorSampleRate`, `replaysSessionSampleRate`, `Sentry.replayIntegration` |
| CSP covers all 6 origin classes | PASS — see OPS-13-04 table above |
| DSN placeholder guard regex `<SENTRY_PUBLIC_KEY>|<SENTRY_ORGID>|<SENTRY_PROJECTID>` matches current app.html | PASS — current placeholder strings will trigger the guard correctly |
| fallback contact is `privacy@couchtonight.app` (not nahderz@gmail.com) | PASS — `js/app.js:2802` confirmed |

---

## Anti-Patterns Found

| File | Pattern | Severity | Impact | Verdict |
|------|---------|---------|--------|---------|
| `app.html:66`, `landing.html:56` | DSN string `https://<SENTRY_PUBLIC_KEY>@...` contains literal placeholders | Info | Intentional: deploy.sh MEDIUM-5 guard aborts if these reach the mirror; version-control placeholders are by design | NOT a blocker — deploy guard is the enforcement point |

No stubs, no hardcoded empty returns, no orphaned handlers found.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| COMP-13-01 | 13-01-PLAN.md | Self-serve account deletion | CODE-DELIVERED | 4 CFs + UI wired; user-pending: deploy |
| OPS-13-02 | 13-03-PLAN.md | BUILD_DATE auto-stamp at deploy (mirror-only) | DELIVERED | `deploy.sh:99-118` |
| OPS-13-04 | 13-05-PLAN.md | CSP-Report-Only on all paths | DELIVERED | `firebase.json:72-82` |
| OPS-13-05 | 13-02-PLAN.md | Sentry CDN + PII scrub + no Replay | CODE-DELIVERED | app.html + landing.html; user-pending: DSN |
| OPS-13-06 | 13-03-PLAN.md | deploy.sh Sentry DSN guard + RUNBOOK §L | CODE-DELIVERED | `deploy.sh:120-138`, `RUNBOOK.md §L` |
| OPS-13-07 | 13-04-PLAN.md | firestore-export-setup.sh + RUNBOOK §I §K | CODE-DELIVERED | script + RUNBOOK; user-pending: gcloud execution |
| OPS-13-01 | (deferred) | firebase-functions SDK 4→7 | DEFERRED | TD-1 in TECH-DEBT.md; Phase 14 |
| OPS-13-03 | (deferred) | Variant-B storage rules | DEFERRED | TD-2 in TECH-DEBT.md; post-Phase-5 |

---

## Deferred Items

Items explicitly out of scope for Phase 13:

| Item | Addressed In | Evidence |
|------|-------------|---------|
| OPS-13-01: firebase-functions SDK 4.x → 7.x upgrade (TD-1) | Phase 14 | `TECH-DEBT.md:55` — "TD-1. firebase-functions SDK 4.x → 7.x upgrade — deferred to Phase 14"; `ROADMAP.md Phase 13 Requirements` field explicitly notes deferral |
| OPS-13-03: Variant-B storage rules tightening (TD-2) | Post-Phase-5 milestone | `TECH-DEBT.md:100-103` — "Blocked on: Phase 5 member-uid migration"; rules cannot be uid-scoped until Phase 5 ships |

---

## Human Verification Required

### 1. Deploy Cloud Functions (COMP-13-01)

**Test:** From `C:\Users\nahde\queuenight`, run:
```bash
firebase deploy --only functions:requestAccountDeletion,functions:cancelAccountDeletion,functions:checkAccountDeleteEligibility,functions:accountDeletionReaper --project queuenight-84044
```
**Expected:** All 4 CFs appear in Firebase Console > Functions; Cloud Scheduler job `firebase-schedule-accountDeletionReaper-us-central1` visible in GCP Console > Cloud Scheduler > us-central1.
**Why human:** Requires Firebase CLI auth in the queuenight deploy repo.

### 2. Deploy Firestore Indexes (COMP-13-01)

**Test:** From `C:\Users\nahde\queuenight`, run:
```bash
firebase deploy --only firestore:indexes --project queuenight-84044
```
**Expected:** `collectionGroup(members).where('uid','==',uid)` index shows READY status in GCP Console > Firestore > Indexes (may take a few minutes).
**Why human:** Index deployment requires Firebase CLI auth; READY state cannot be verified programmatically from this repo.

### 3. Sentry account creation + DSN substitution (OPS-13-05)

**Test:** Create a Sentry project at sentry.io, copy the DSN. Substitute `<SENTRY_PUBLIC_KEY>`, `<SENTRY_ORGID>`, `<SENTRY_PROJECTID>` in `app.html` + `landing.html`, commit, then run `./scripts/deploy.sh`.
**Expected:** deploy.sh MEDIUM-5 guard passes (no abort); after deploy, induce a JS error in couchtonight.app/app and confirm it appears in the Sentry inbox within ~30 seconds.
**Why human:** Requires a Sentry account and live external service configuration.

### 4. GitHub protect-main ruleset + Firestore export setup (OPS-13-06 + OPS-13-07)

**Test (GitHub):** Configure the `protect-main` ruleset in `github.com/<owner>/couch` > Settings > Rules > Rulesets per RUNBOOK §L. Verify with probe: `git push origin "probe/test:main"` — expect GH013 rejection.
**Test (Firestore export):** Run `gcloud auth login && gcloud config set project queuenight-84044 && ./scripts/firestore-export-setup.sh` from the couch repo root. Then smoke-test with `gcloud scheduler jobs run daily-firestore-export --location=us-central1` and verify export directory appears in `gsutil ls gs://queuenight-84044-backups/`.
**Expected:** Push to main rejected; export directory created in the backups bucket.
**Why human:** GitHub ruleset is web-UI config; gcloud setup requires CLI auth — both require live external-system access.

---

## What to Do Next

**Immediate (complete Phase 13 operational activation):**

1. **Deploy Cloud Functions** (COMP-13-01): `firebase deploy --only functions:requestAccountDeletion,...` from queuenight/ (see Human Verify item 1)
2. **Deploy Firestore indexes** (COMP-13-01): `firebase deploy --only firestore:indexes` (see Human Verify item 2)
3. **Sentry DSN** (OPS-13-05): Create project at sentry.io, substitute DSN in app.html + landing.html, commit, deploy
4. **GitHub ruleset** (OPS-13-06): Configure protect-main in GitHub web UI per RUNBOOK §L
5. **Firestore export setup** (OPS-13-07): Run `gcloud auth login` + `./scripts/firestore-export-setup.sh`

**Short-term (post-activation):**
- 2-week CSP Report-Only observation window: after deploy, check browser console periodically for CSP violations against the flows listed in TECH-DEBT.md TD-4 (Trakt OAuth, photo upload, watchparty scheduling, RSVP submit, install flow, Sentry error transmission, TMDB poster load)
- Summarize CSP violation set at ~2 weeks; decide on enforcement-flip plan based on actual data

**Phase 14 prep:**
- TD-1 (firebase-functions SDK 4→7 upgrade) is the primary Phase 14 action item per ROADMAP.md

---

_Verified: 2026-04-25_
_Verifier: Claude (gsd-verifier / claude-sonnet-4-6)_
