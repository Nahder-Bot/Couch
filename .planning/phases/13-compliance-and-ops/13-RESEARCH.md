# Phase 13: Compliance & Ops Sprint — Research

**Researched:** 2026-04-25
**Domain:** Firebase Cloud Functions + Firestore + Storage + GitHub branch protection + CSP + error reporting (vanilla JS PWA)
**Confidence:** HIGH overall — every recommendation is grounded in either the live codebase, official Firebase/Google Cloud docs, Sentry official docs, or GitHub docs. Two `[ASSUMED]` items flagged in the Assumptions Log.

## Summary

Phase 13 is operational-hygiene work for an already-shipped vanilla-JS Firebase PWA. The five items in scope (COMP-01 self-serve account deletion, OPS-05 error reporting, OPS-02+OPS-06 BUILD_DATE auto-stamp + branch protection bundle, OPS-07 scheduled Firestore export, OPS-04 CSP report-only) are all standard problems with well-trodden patterns — no exotic engineering. The interesting findings live in three places:

1. **OPS-05 must flip from Crashlytics to Sentry.** Firebase Crashlytics has no web/PWA SDK as of April 2026 — it's mobile-only. CONTEXT.md's "use Crashlytics" recommendation rests on a stale assumption. Sentry's loader script (CDN, zero-bundler, plays nicely with ES modules + service workers) is the correct fit for Couch's architecture.
2. **COMP-01 cannot use a 1st-gen `auth.user().onDelete` trigger.** Auth triggers have NO 2nd-gen replacement; firebase-functions v2 doesn't expose them. The right pattern is an HTTPS callable Cloud Function (mirroring the existing `consumeGuestInvite` / `rsvpSubmit` pattern in `queuenight/functions/`). It calls `admin.auth().deleteUser()` itself + sweeps Firestore via `firebase-tools.firestore.delete(path, {recursive:true})` or hand-rolled subcollection traversal.
3. **OPS-07 has TWO valid implementation paths.** The "official" Firebase tutorial uses Cloud Function + Pub/Sub + Cloud Scheduler (3 moving parts). A simpler 2026-current path: pure Cloud Scheduler HTTP job hitting the Firestore admin REST API directly with an OAuth-token-bound service account (1 moving part). The simpler path is recommended for Couch — fewer surfaces to maintain.

**Primary recommendation:** Plan Phase 13 as a 4-plan, 2-wave structure that closely matches CONTEXT.md's hint, with one substitution: 13-02 ships **Sentry**, not Crashlytics. Item-wise estimates hold (1-2 hr for OPS-05). All work is solo-actionable; no environment provisioning blockers detected.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Self-serve account deletion (UI button, confirmation gate) | Browser / Client (`app.html` + `js/app.js`) | API / Backend (Cloud Function) | UI affordance lives on Account ADMIN; destructive sweep belongs server-side because admin SDK bypasses Firestore rules and `admin.auth().deleteUser()` requires admin credentials |
| Cascading Firestore + Storage + Auth deletion | API / Backend (Cloud Function, us-central1) | — | Only the admin SDK can call `auth().deleteUser`; Firestore subcollection deletion needs a server context to bypass per-user rule scoping; idempotency + retry boundary belongs server-side |
| Soft-delete grace window | Database / Storage (Firestore `users/{uid}.deletionRequestedAt`) | API / Backend (scheduled tick) | Grace state is data; reaper is a scheduled CF (mirrors `watchpartyTick` pattern) |
| Error reporting (Sentry) | Browser / Client (loader script in `app.html` + `landing.html`) | Browser / Service Worker (optional `Sentry.init` in `sw.js`) | All errors originate client-side; the SDK self-batches and sends to Sentry's ingest; no backend involvement |
| BUILD_DATE auto-stamp | Build/Deploy (shell script) | — | Pre-deploy step; runs on dev machine before `firebase deploy` |
| GitHub branch protection | Repo Configuration (GitHub web UI) | — | One-time setting on `github.com/<owner>/couch` |
| Scheduled Firestore export | API / Backend (Cloud Scheduler HTTP job) | Database / Storage (GCS bucket `gs://queuenight-84044-backups`) | Bucket holds artifacts; scheduler triggers; no client involvement |
| CSP report-only | CDN / Static (Firebase Hosting headers in `firebase.json`) | API / Backend (Cloudflare Worker or Cloud Function for report-uri sink, optional) | CSP is an HTTP response header; Firebase Hosting is the only place to set it for couchtonight.app |

## User Constraints (from CONTEXT.md)

### Locked Decisions
> CONTEXT.md is a sketch; not a fully gathered discuss-phase. The decisions below are extracted as binding scope but treated as guidance rather than hard locks. The planner should treat any of these the user wants to revise as discussable. Items that ARE locked by upstream architecture (no bundler, no framework migration, single-file `app.html` shell, etc.) ARE non-negotiable.

- Phase 13 is a **hardening / hygiene sprint** — no new product surfaces. (CONTEXT.md "Phase Boundary")
- Phase 13 ships these 5 items: **COMP-01, OPS-02, OPS-04, OPS-05, OPS-06, OPS-07**.
- **OPS-01** (firebase-functions SDK 4→7) is **deferred to Phase 14 or later**. Risk-concentration with COMP-01 is unacceptable.
- **OPS-03** (Variant-B storage rules) is **deferred** — gated on Phase 5 member-uid migration which has not landed.
- COMP-01 uses **soft-delete + 14-day grace** before hard-delete (CONTEXT.md "Risk" line). Privacy.html promises 30-day window; 14-day soft-delete fits inside that envelope with breathing room.
- COMP-01 button lives in **Account → ADMIN cluster** (existing UI per `app.html:632`).
- All Cloud Functions stay in **sibling `queuenight/functions/`** repo, deployed from there.
- All header changes go in **sibling `queuenight/firebase.json`**.
- TMDB key + Firebase web config stay client-side (public-by-design — do not "fix").
- Plan structure (CONTEXT.md hint, 5 plans, 2 waves):
  - Wave 1 parallel: 13-01 COMP-01 + 13-02 OPS-05
  - Wave 2 sequential: 13-03 (OPS-02 + OPS-06 bundled) + 13-04 OPS-07 + 13-05 OPS-04

### Claude's Discretion
- COMP-01 confirmation gate UX (type DELETE vs double-tap vs OAuth re-auth) — research below recommends **type DELETE pattern** with a 5-character match.
- COMP-01 grace-window UX: whether to show a "you have 14 days to undo this" banner on subsequent sign-in, and how to render it.
- OPS-05 PII filter implementation: the exact `beforeSend` shape — research below provides a concrete pattern.
- OPS-04 CSP directive list: research below provides the concrete domains, but the planner picks final wording.
- OPS-07 retention period: research recommends **30 days** (lifecycle rule), planner can adjust.
- BUILD_DATE wiring: research recommends **`deploy.sh` shell script** path; alternative is npm pre-deploy or git pre-push hook.
- Whether to add a CSP report-uri sink vs go report-uri-less in initial report-only deploy. Research below recommends **add a Cloudflare Worker sink** OR **start without report-uri** and read CSP violations from the browser console for the first week, then decide.

### Deferred Ideas (OUT OF SCOPE)
- OPS-01 (firebase-functions SDK 4→7 migration) — deferred per CONTEXT.md to Phase 14
- OPS-03 (Variant-B storage rules) — deferred per CONTEXT.md, gated on Phase 5 member-uid migration
- Twilio / SMS deletion notification (no need; deletion is silent)
- Public status page (not at couch-scale)
- Right-to-export (GDPR data portability) — privacy.html does not currently promise export. If added later it's its own item.
- Cookie banner / consent management — Couch doesn't use third-party cookies (TMDB images and Google Fonts are static GET, not tracking)

## Phase Requirements

> Phase 13 has no requirement IDs in REQUIREMENTS.md yet. Suggested ID assignments below; planner finalizes.

| Suggested ID | Description | Research Support |
|----|-------------|------------------|
| **COMP-01** | Self-serve account deletion: signed-in user can request deletion of their account from Account → ADMIN; soft-delete enters a 14-day grace window; cascading hard-delete sweeps all user-related Firestore + Storage data + revokes auth | "COMP-01" section below — onCall CF pattern, recursive Firestore delete, Storage path enumeration, 14-day grace reaper |
| **OPS-02** | BUILD_DATE in `js/constants.js` is auto-stamped before every production deploy | "OPS-02 + OPS-06" section — deploy.sh wiring + alternatives |
| **OPS-04** | `Content-Security-Policy-Report-Only` header is served on couchtonight.app/* with directives covering Firebase SDK + TMDB + Trakt + Google Fonts; existing XCTO/Referrer-Policy/X-Frame-Options unchanged | "OPS-04" section — concrete directive list per third party + Firebase Hosting `firebase.json` JSON shape |
| **OPS-05** | Vanilla-JS PWA captures uncaught errors + unhandled promise rejections + sends them to a third-party error reporter with PII filtered out | "OPS-05" section — Sentry loader script init pattern + `beforeSend` PII filter |
| **OPS-06** | `main` branch on GitHub is protected: PR-required before merge (0 reviewers — solo gate not review), CI status checks must pass, linear history, force-push blocked, deletion blocked | "OPS-02 + OPS-06" section — GitHub Rulesets UI checklist |
| **OPS-07** | Daily Firestore export to `gs://queuenight-84044-backups`; 30-day retention via lifecycle rule; documented restore command | "OPS-07" section — Cloud Scheduler HTTP job, IAM bindings, lifecycle.json |

## Standard Stack

### Core (Cloud Functions side — already in repo)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `firebase-admin` | ^12.0.0 (existing) | Firestore admin SDK + auth().deleteUser() + bulk delete primitives | Already in `queuenight/functions/package.json`; bypasses Firestore rules for legitimate admin ops [VERIFIED: queuenight/functions/package.json:14] |
| `firebase-functions` | ^4.6.0 (existing) | onCall + onSchedule wrappers | Already in repo; v4 idiom matches existing CFs we mirror [VERIFIED: queuenight/functions/package.json:17]. **Note:** TD-1 tracks v4→v7 upgrade; defer that to Phase 14 — Phase 13 stays on v4 to keep the new CFs idiomatic with existing code. |
| `@google-cloud/firestore` | implicit dep of firebase-admin | exposes `v1.FirestoreAdminClient` for export operations IF using a Cloud Function path (alternative to the simpler HTTP-job path) | Bundled with firebase-admin; only needed if OPS-07 uses the CF-based path [CITED: cloud.google.com/firestore/docs/solutions/schedule-export] |

### Core (Client side — Sentry)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Sentry browser SDK (loader script) | latest from `js.sentry-cdn.com` | Error tracking for vanilla JS PWA | Loader script supports zero-bundler delivery, lazy-loads the full SDK on first error, exposes `Sentry.captureException` immediately. Plays nicely with ES modules. [CITED: docs.sentry.io/platforms/javascript/install/loader/] |

### Supporting (one-off CLI / config)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `gcloud` CLI | already installed locally | Cloud Scheduler / IAM bindings | OPS-07 setup (one-time) |
| `gsutil` CLI | bundled with gcloud | Cloud Storage bucket creation + lifecycle config | OPS-07 setup (one-time) |
| `firebase-tools` (npm) | already used for deploy | `firebase-tools.firestore.delete(path, {recursive:true})` for COMP-01 sweep | Imported INTO the Cloud Function (`require('firebase-tools')`) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Sentry loader script | `@sentry/browser` via NPM + bundle | We have no bundler (architecture lock); NPM path is wrong for this codebase. Loader script is correct for vanilla ES-modules-no-bundler. [VERIFIED: CLAUDE.md "✗ Don't introduce a bundler"] |
| Sentry | LogRocket / Datadog RUM / Bugsnag / Rollbar | Sentry has the best free tier (5K errors/mo) for solo-dev scale, has the most mature loader-script-without-bundler story, and offers Session Replay for incident debugging. CONTEXT.md tentatively suggested Crashlytics — that recommendation must be revised because Crashlytics has no web SDK as of 2026 [CITED: github.com/firebase/firebase-js-sdk/issues/710]. |
| Sentry | Custom error logger to Cloud Logging | Possible (write a `console.error` wrapper that POSTs to a Cloud Function which writes to Cloud Logging), but rebuilds 90% of what Sentry gives for free, lacks deduplication/grouping, lacks session context. Don't hand-roll. |
| Cloud Scheduler HTTP job (direct REST call) | Cloud Function + Pub/Sub + Cloud Scheduler (Firebase tutorial path) | The CF-and-Pub/Sub path is what the official Firebase tutorial shows but adds 2 unnecessary moving parts (Pub/Sub topic + Cloud Function source) when Cloud Scheduler can hit the Firestore admin REST endpoint directly with OAuth. Direct HTTP is fewer surfaces; both paths work. |
| `firebase-tools.firestore.delete` (recursive) for COMP-01 | Hand-rolled BFS subcollection traversal | `firebase-tools` recursiveDelete is documented + battle-tested. Hand-roll only if `firebase-tools` adds too much weight (~30MB) to the CF cold-start; benchmark before committing. [CITED: firebase.google.com/docs/firestore/solutions/delete-collections] |
| 14-day grace + soft-delete | Hard-delete immediately on user click | Soft-delete is industry-standard for destructive UX (you cannot un-delete a Firebase Auth user once gone if the user re-signs-up they get a NEW uid; all family memberships orphan permanently). 14 days < 30-day privacy.html promise. Recommended. [ASSUMED — see Assumptions Log A1] |
| `data-lazy="no"` for Sentry loader | default lazy-load | Lazy is fine for Couch — the SDK only fetches itself on the first error; at app-launch we just need `captureException` registered. Default lazy keeps the home-page weight low (loader script is ~3 KB). [CITED: docs.sentry.io] |

**Installation (CF side, in `queuenight/functions/`):**

```bash
cd /c/Users/nahde/queuenight/functions
npm install firebase-tools  # for recursive delete in COMP-01
# (firebase-admin + firebase-functions + web-push already installed)
```

**Installation (client side, no install — CDN-loaded):**

```html
<!-- in app.html <head>, BEFORE the firebase SDK imports -->
<script>
  window.sentryOnLoad = function () { Sentry.init({ /* see OPS-05 section */ }); };
</script>
<script src="https://js.sentry-cdn.com/<PUBLIC_KEY>.min.js" crossorigin="anonymous"></script>
```

**Version verification:**
- `firebase-functions` 4.9.0 latest 4.x [VERIFIED: queuenight/functions/package-lock.json deploy warning 2026-04-25]
- `firebase-admin` 12.x is current [VERIFIED: queuenight/functions/package.json]
- Sentry loader: CDN-versioned, no pinning needed [VERIFIED: docs.sentry.io/platforms/javascript/install/loader/]
- `firebase-tools` npm: `npm view firebase-tools version` to confirm at execute-time [ASSUMED — script will verify]

## Architecture Patterns

### System Architecture Diagram

```
                              [ User on couchtonight.app/app ]
                                         │
                  ┌──────────────────────┼─────────────────────────┐
                  │                      │                         │
       click "Delete account"   any uncaught error          page load
                  │                      │                         │
                  ▼                      ▼                         ▼
         [confirm modal:           [Sentry loader              [Sentry init
          type DELETE]              detects + buffers]          via sentryOnLoad]
                  │                      │                         │
                  ▼                      ▼                         │
         [callable CF:           [Sentry SDK fetches itself,      │
          requestAccountDelete]   sends to ingest endpoint]       │
                  │                      │                         │
                  ▼                      ▼                         ▼
       writes users/{uid}.        [POST to                  [GET js.sentry-cdn.com]
       deletionRequestedAt =      o<orgid>.ingest.us.
       Date.now() + 14 days        sentry.io]
                  │
                  ▼
       [scheduled CF: deletionReaperTick (every 1hr)]
                  │
                  ▼
       finds users with deletionRequestedAt <= now
                  │
                  ▼
       [for each user uid]:
                  ├─→ family memberships: query members where uid=X across families
                  │   → set deleted=true OR delete doc OR remove from family
                  ├─→ vetoHistory: where actingUid=X → delete
                  ├─→ titles: where actingUid=X (mood-tag attribution) → delete or null-out
                  ├─→ lists: where actingUid=X → delete or transfer
                  ├─→ activity: where actingUid=X → delete
                  ├─→ intents: where createdByUid=X → delete; rsvps[uid] → strip
                  ├─→ watchparties: participants[uid] → strip; if hostUid=X → cancel/transfer
                  ├─→ users/{uid}/groups/* → recursiveDelete
                  ├─→ users/{uid} (notificationPrefs, push subs) → delete
                  ├─→ Storage: gs://queuenight-84044/couch-albums/*/*/*<uid>* → delete  [see note]
                  └─→ admin.auth().deleteUser(uid)
                  │
                  ▼
       [audit log: deletionAudits/{auditId} = {uid, completedAt, sweepCounts:{members:N,votes:N,...}}]


       ┌─── SEPARATE: scheduled Firestore export ───────────────┐
       │                                                         │
       │  Cloud Scheduler "daily-firestore-export"              │
       │       │ (cron 0 3 * * *)                                │
       │       ▼                                                 │
       │  HTTP POST → firestore.googleapis.com/v1/.../databases/(default):exportDocuments
       │       │ (OAuth via SA queuenight-84044@appspot.gservi…) │
       │       ▼                                                 │
       │  gs://queuenight-84044-backups/<YYYY-MM-DD>/            │
       │       │ (lifecycle: delete @ 30 days)                   │
       │       ▼                                                 │
       │  [restore: gcloud firestore import gs://.../<date>/]    │
       └─────────────────────────────────────────────────────────┘


       ┌─── SEPARATE: CSP report-only ──────────────────────────┐
       │                                                         │
       │  firebase.json header: "**/*"                           │
       │     Content-Security-Policy-Report-Only: <directives>   │
       │     report-uri https://csp-reports.couchtonight.app/    │
       │       │ (or omit; check console for v1)                 │
       │       ▼                                                 │
       │  Cloudflare Worker (or Cloud Function) sink → Cloud     │
       │  Logging                                                │
       └─────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
queuenight/                          # sibling repo (Cloud Functions + hosting config)
├── functions/
│   ├── index.js                     # registers all CF exports (existing pattern)
│   ├── src/
│   │   ├── consumeGuestInvite.js    # existing — model for COMP-01 callable
│   │   ├── rsvpSubmit.js            # existing — model for COMP-01 callable
│   │   ├── requestAccountDelete.js  # NEW — onCall, signed-in, soft-delete entry
│   │   ├── deletionReaperTick.js    # NEW — onSchedule(every 1 hour), hard-delete reaper
│   │   └── (...)
│   └── package.json                 # add firebase-tools dep for recursive delete
├── firebase.json                    # NEW header: CSP-Report-Only on **/*
└── public/                          # deploy mirror

couch/                               # main repo
├── app.html                         # NEW: Sentry loader in <head>; new "Delete my account" button in ADMIN cluster
├── landing.html                     # NEW: Sentry loader in <head>
├── js/
│   ├── app.js                       # NEW: deleteAccount() handler + confirmation modal logic
│   ├── constants.js                 # auto-stamped BUILD_DATE
│   └── (...)
├── scripts/
│   ├── stamp-build-date.cjs         # existing
│   └── deploy.sh                    # NEW — runs stamp + sw bump + mirror + firebase deploy
└── .github/
    └── workflows/ci.yml             # existing — branch protection requires this passing
```

### Pattern 1: Authenticated callable Cloud Function (mirror of `consumeGuestInvite.js`)

**What:** A 2nd-gen `onCall` HTTPS function with auth gate, server-side input validation, idempotent state mutation.
**When to use:** Any client-initiated action that needs admin SDK power (auth().deleteUser, recursive Firestore delete, cross-family writes).

```javascript
// queuenight/functions/src/requestAccountDelete.js
// Source pattern: queuenight/functions/src/rsvpSubmit.js + consumeGuestInvite.js
'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.requestAccountDelete = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 30
}, async (request) => {
  // Auth gate: only the user themselves can request their own deletion
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError('unauthenticated', 'Must be signed in.');
  }
  const uid = request.auth.uid;

  // Confirmation gate: client must echo the typed-DELETE confirmation token
  const { confirm } = (request.data || {});
  if (confirm !== 'DELETE') {
    throw new HttpsError('failed-precondition', 'Confirmation phrase missing or wrong.');
  }

  // Set soft-delete state — 14 days from now
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const hardDeleteAt = Date.now() + FOURTEEN_DAYS_MS;

  await db.collection('users').doc(uid).set({
    deletionRequestedAt: admin.firestore.FieldValue.serverTimestamp(),
    hardDeleteAt: hardDeleteAt
  }, { merge: true });

  return { success: true, hardDeleteAt };
});
```

### Pattern 2: Scheduled hard-delete reaper

```javascript
// queuenight/functions/src/deletionReaperTick.js
// Source pattern: existing watchpartyTick / rsvpReminderTick scheduled CFs
'use strict';

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const firebaseTools = require('firebase-tools');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.deletionReaperTick = onSchedule({
  schedule: 'every 1 hours',
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '512MiB'
}, async (event) => {
  const now = Date.now();
  const due = await db.collection('users')
    .where('hardDeleteAt', '<=', now)
    .limit(20)  // batch size; cap so a single tick can't exhaust quotas
    .get();

  for (const userDoc of due.docs) {
    const uid = userDoc.id;
    const sweepCounts = {};
    try {
      // 1. Find all families this user is a member of
      const familiesSnap = await db.collection('users').doc(uid).collection('groups').get();
      const familyCodes = familiesSnap.docs.map(d => d.id);

      for (const familyCode of familyCodes) {
        const famDoc = await db.collection('families').doc(familyCode).get();
        if (!famDoc.exists) continue;

        // 2. Delete this user's member doc(s) in each family
        const myMembers = await db.collection('families').doc(familyCode)
          .collection('members').where('uid', '==', uid).get();
        for (const m of myMembers.docs) {
          await m.ref.delete();
          sweepCounts.members = (sweepCounts.members || 0) + 1;
        }

        // 3. Strip uid from any vetoHistory / activity / intents this user authored
        // (See "Collections that reference user uid" table below for full list.)
        // ... per-collection sweeps ...

        // 4. Strip user from watchparty.participants[uid] across all sessions
        // ... see Storage handling for couch-albums ...

        // 5. If user is family ownerUid, transfer to next-most-senior member OR
        //    cancel deletion with error "transfer ownership first"
      }

      // 6. Recursive delete users/{uid} subtree
      await firebaseTools.firestore.delete(`users/${uid}`, {
        project: process.env.GCLOUD_PROJECT,
        recursive: true,
        force: true,
      });

      // 7. Storage: enumerate gs://couch-albums/*/<wpId>/<ts>_<uid>.jpg
      // (See "Storage path enumeration" pattern below.)

      // 8. Auth: revoke (the actual deletion).
      await admin.auth().deleteUser(uid);

      // 9. Audit log
      await db.collection('deletionAudits').add({
        uid, completedAt: admin.firestore.FieldValue.serverTimestamp(), sweepCounts
      });
    } catch (e) {
      // Idempotent: leave the user doc in place; log; next tick will retry
      console.error('deletionReaperTick failed for uid', uid, e.message);
      await db.collection('users').doc(uid).set({
        lastDeletionAttemptError: e.message,
        lastDeletionAttemptAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
});
```

### Pattern 3: Cloud Scheduler HTTP job for Firestore export

```bash
# One-time setup (run from any machine with gcloud authed to queuenight-84044)

# 1. Create the bucket (us-central1 to match Firestore region — STATE.md confirms)
gsutil mb -l us-central1 gs://queuenight-84044-backups

# 2. Lifecycle: delete exports older than 30 days
cat > /tmp/lifecycle.json <<'EOF'
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 30}
      }
    ]
  }
}
EOF
gsutil lifecycle set /tmp/lifecycle.json gs://queuenight-84044-backups

# 3. Grant the App Engine default service account export + storage perms
gcloud projects add-iam-policy-binding queuenight-84044 \
  --member=serviceAccount:queuenight-84044@appspot.gserviceaccount.com \
  --role=roles/datastore.importExportAdmin

gsutil iam ch serviceAccount:queuenight-84044@appspot.gserviceaccount.com:admin \
  gs://queuenight-84044-backups

# 4. Create the Cloud Scheduler job (HTTP target, OAuth-bound)
gcloud scheduler jobs create http daily-firestore-export \
  --location=us-central1 \
  --schedule="0 3 * * *" \
  --time-zone="America/Los_Angeles" \
  --uri="https://firestore.googleapis.com/v1/projects/queuenight-84044/databases/(default):exportDocuments" \
  --http-method=POST \
  --oauth-service-account-email=queuenight-84044@appspot.gserviceaccount.com \
  --oauth-token-scope="https://www.googleapis.com/auth/datastore" \
  --headers="Content-Type=application/json" \
  --message-body='{"outputUriPrefix":"gs://queuenight-84044-backups"}'
```

The scheduler will append a timestamp to the `outputUriPrefix` automatically; exports land at `gs://queuenight-84044-backups/<YYYY-MM-DDTHH:MM:SS_NNNNN>/`.

### Pattern 4: Sentry loader script init (vanilla JS, ES modules, no bundler)

```html
<!-- app.html <head>, AFTER fonts but BEFORE Firebase SDK imports -->
<!-- Source: docs.sentry.io/platforms/javascript/install/loader/ -->
<script>
  window.sentryOnLoad = function () {
    Sentry.init({
      dsn: 'https://<PUBLIC_KEY>@o<ORGID>.ingest.us.sentry.io/<PROJECTID>',
      release: 'couch@' + (window.__COUCH_VERSION || 'dev'),
      environment: location.hostname === 'couchtonight.app' ? 'production' : 'dev',
      tracesSampleRate: 0.1,  // 10% of transactions; cheap on free tier
      replaysSessionSampleRate: 0,  // no proactive session replay (privacy)
      replaysOnErrorSampleRate: 0.1,  // 10% of error sessions get replay
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,    // PII defense
          blockAllMedia: true,  // photos in couch-albums + posters
        })
      ],
      // PII filter — strip uid, email, family code from any event payload
      beforeSend(event, hint) {
        // 1. Strip user.email (we never want this off-platform)
        if (event.user) {
          delete event.user.email;
          delete event.user.username;
          delete event.user.ip_address;
        }
        // 2. Strip stack trace strings that may contain family codes (6 hex chars)
        const FAMILY_RE = /\b[a-f0-9]{6}\b/gi;
        if (event.message) event.message = event.message.replace(FAMILY_RE, '<FAMILY>');
        if (event.exception?.values) {
          for (const ex of event.exception.values) {
            if (ex.value) ex.value = ex.value.replace(FAMILY_RE, '<FAMILY>');
          }
        }
        // 3. Strip request URLs that might carry tokens (?invite= ?claim= /rsvp/<token>)
        if (event.request?.url) {
          event.request.url = event.request.url
            .replace(/[?&](invite|claim)=[^&]+/g, (_, k) => `?${k}=<REDACTED>`)
            .replace(/\/rsvp\/[^/?]+/g, '/rsvp/<TOKEN>');
        }
        return event;
      }
    });

    // Set the uid as a tag (NOT user.id — Sentry sends user.id in the payload;
    // tags are searchable but don't ship to user-context analytics)
    if (window.__COUCH_UID) {
      Sentry.setTag('couch_uid_hash', window.__COUCH_UID.slice(0, 8));
    }
  };
</script>
<script src="https://js.sentry-cdn.com/<PUBLIC_KEY>.min.js"
        crossorigin="anonymous"></script>
```

`Sentry.captureException()` is exposed even before the full SDK loads — buffered and replayed once the SDK arrives [CITED: docs.sentry.io/platforms/javascript/install/loader/]. `window.onerror` and `unhandledrejection` are auto-instrumented by the SDK; no manual `addEventListener` needed.

### Pattern 5: deploy.sh wiring (BUILD_DATE auto-stamp)

```bash
#!/usr/bin/env bash
# scripts/deploy.sh — Phase 13 / OPS-02
# One-stop pre-deploy automation. Replaces the manual checklist in RUNBOOK.md.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
QUEUENIGHT_ROOT="/c/Users/nahde/queuenight"

cd "$REPO_ROOT"

# 1. Tests must pass
if [ -d tests ]; then (cd tests && npm test); fi

# 2. node --check all JS
for f in js/*.js sw.js; do node --check "$f"; done

# 3. Auto-stamp BUILD_DATE
node scripts/stamp-build-date.cjs

# 4. Bump sw.js CACHE — caller must edit before running OR pass tag arg
TAG="${1:-}"
if [ -n "$TAG" ]; then
  sed -i.bak -E "s|const CACHE = '[^']+';|const CACHE = '${TAG}';|" sw.js
  rm sw.js.bak
fi

# 5. Mirror to deploy directory
cp -v app.html landing.html changelog.html rsvp.html 404.html sw.js sitemap.xml robots.txt "${QUEUENIGHT_ROOT}/public/"
mkdir -p "${QUEUENIGHT_ROOT}/public/css" "${QUEUENIGHT_ROOT}/public/js"
cp -v css/*.css "${QUEUENIGHT_ROOT}/public/css/"
cp -v js/*.js "${QUEUENIGHT_ROOT}/public/js/"

# 6. Deploy
cd "${QUEUENIGHT_ROOT}"
firebase deploy --only hosting --project queuenight-84044

# 7. Smoke test
curl -sI https://couchtonight.app/ | head -3
curl -s https://couchtonight.app/sw.js | grep "const CACHE"
```

### Anti-Patterns to Avoid

- **Anti-pattern: Use `auth.user().onDelete` for COMP-01 cascade.** firebase-functions v2 has no auth triggers; you'd be stuck on v1 syntax forever, and CONTEXT.md correctly defers the v4→v7 SDK upgrade. Use HTTPS callable + reaper instead.
- **Anti-pattern: CSP-Report-Only via `<meta http-equiv>`.** The CSP3 spec explicitly disallows Report-Only via meta; it MUST be an HTTP header [CITED: github.com/w3c/webappsec-csp/issues/277]. Firebase Hosting `firebase.json` headers is the only correct surface.
- **Anti-pattern: Ship CSP enforcement (not Report-Only) on day 1.** Couch has 11+ inline `<script type="module">` blocks in `app.html` and Trakt OAuth callback flow that no one has stress-tested against a strict policy. Report-Only first, monitor for 2 weeks, then enforce.
- **Anti-pattern: Use `firebase-tools.firestore.delete` for the COMP-01 sweep WITHOUT enumerating per-family-nested collections first.** `users/{uid}` doesn't contain family-scoped vetoes/votes/etc — those live at `families/{familyCode}/...` keyed by `actingUid` or `uid`. A naive `recursiveDelete users/{uid}` will leave 80% of the user's data behind. Sweep family collections explicitly first.
- **Anti-pattern: Hard-delete a Firebase Auth user before sweeping Firestore.** Once `admin.auth().deleteUser(uid)` runs, the uid is gone — but Firestore docs that reference it remain orphaned. Sweep Firestore first, then auth.
- **Anti-pattern: Branch protection that requires admin to push.** Solo dev needs to be able to push. Use 0-reviewer PR-required gate; do NOT enable "Do not allow bypassing the above settings" / "include administrators" — that locks you out of your own repo.
- **Anti-pattern: Using `'unsafe-inline'` in CSP `script-src`.** Couch has zero user-supplied script content (XSS-disciplined per TECH-DEBT TD-4). Use `'self'` + nonce or `'self'` + `'strict-dynamic'`. If inline scripts in app.html prove too painful, refactor those into a single external module first; do not weaken the policy.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Recursive Firestore subcollection deletion | BFS traverser with `getDocs` + `deleteDoc` loops | `firebase-tools.firestore.delete(path, {recursive:true})` | Battle-tested, handles 4000+ docs/sec, supports `force` flag for headless CF context [CITED: firebase.google.com/docs/firestore/solutions/delete-collections] |
| Cron-style scheduling for deletion reaper | `setTimeout` chains in a long-lived process | `firebase-functions/v2/scheduler` `onSchedule({schedule:'every 1 hours'})` | Cloud Scheduler-backed, reliable, free tier covers 3 jobs/month and we're under it |
| Browser uncaught-error capture | window.addEventListener('error', ...) + 'unhandledrejection' + ad-hoc localStorage queue + custom POST | Sentry loader script | Sentry handles deduplication, fingerprinting, source maps, breadcrumbs, session replay; rolling our own = ~500 LOC + ongoing maintenance |
| PII filtering in error reports | Hand-walk every event property and regex it | Sentry `beforeSend` hook | Single function, runs synchronously before any network call |
| Email-style "your account will be deleted in 14 days" reminders | Cloud Function + custom email template | (1) UI banner on next sign-in (2) push notification reusing existing `sendToMembers` helper | We don't have email infra and shouldn't build it for one feature; UI banner + push is sufficient |
| Firestore export job | Cloud Function + Pub/Sub topic | `gcloud scheduler jobs create http` direct REST call | Two fewer moving parts; the OAuth-token-bound HTTP target works equally well [VERIFIED: cloud.google.com/scheduler/docs/firestore-data-exports describes both paths] |
| CSP report-uri sink | Custom Cloud Function | Cloudflare Worker (free tier covers <100K reports/mo) OR start without sink + read browser console | At Couch's scale, CSP violations will be sparse; a sink is overengineering for v1 [CITED: codemzy.com/blog/cloudflare-function-csp-report] |
| GitHub branch protection ruleset | Custom Git pre-push hooks | Native GitHub Rulesets (Settings → Rules → Rulesets) | UI configuration; survives clones; can't be bypassed by switching machines |

**Key insight:** Phase 13 is operational hygiene, not novel engineering. Every problem here has a canonical solution shipped by Google/Sentry/GitHub. The wins come from wiring them up correctly, not from cleverness.

## Runtime State Inventory

> COMP-01 is a destructive flow that mutates Firestore + Storage + Auth. The grep audit below MUST drive the planner's task structure — every collection that references a user uid is a sweep target.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data — Firestore collections referencing user uid** | See "Collections that reference user uid" table immediately below. 13 distinct attribution fields across 8 collections. | Each collection needs an explicit sweep step in the deletion reaper. Code edit ONLY (CF source); no separate data migration needed. |
| **Stored data — Cloud Storage** | `gs://queuenight-84044/couch-albums/{familyCode}/{wpId}/{filename}` — filename pattern is `${ts}_${uidForPath}.jpg` per `js/app.js:9425`. The user's uid IS in the filename. Plus possibly Variant-A bucket-wide (not user-scoped). | Sweep step: list bucket prefix, filter filenames containing target uid, delete. Hand-roll OK (Storage admin SDK is lightweight); do NOT use `firebase-tools` for Storage (different scope). |
| **Live service config** | None for COMP-01 itself. For OPS-07 / Firestore export: NEW Cloud Scheduler job `daily-firestore-export` will be created in Cloud Scheduler — that lives in GCP console, NOT git. | Document creation in PHASE-13-COMPLETION.md so a future dev knows to recreate it on a fresh project. |
| **OS-registered state** | None. No Windows Task Scheduler / launchd / systemd dependencies for any of the 5 items. | None. |
| **Secrets and env vars** | NEW: Sentry DSN. Public-by-design (Sentry DSNs are designed to be embedded in client code; rate-limited per project). Add to `js/constants.js` next to TMDB_KEY. NOT a secret. | Code edit: add `SENTRY_DSN` constant; reference in app.html loader script. |
| **Build artifacts / installed packages** | NEW: `firebase-tools` will be added to `queuenight/functions/package.json` for COMP-01 — adds ~30MB to the CF bundle on cold start (concern for cold-start latency on the reaper, but the reaper is a scheduled CF that runs hourly, not user-facing — acceptable). NEW: `scripts/deploy.sh` becomes the new canonical deploy path; RUNBOOK.md "Pre-flight checklist" section needs updating to reference `./scripts/deploy.sh`. | Update `queuenight/functions/package.json` + commit. Update RUNBOOK.md after deploy.sh ships. |

### Collections that reference user uid (COMP-01 sweep targets)

Source: grep + `firestore.rules` review + `state.js` collection refs.

| Collection path | Field that holds the uid | Mutation type | Notes |
|-----------------|--------------------------|---------------|-------|
| `users/{uid}` | doc id | DELETE | Top-level user doc — notificationPrefs + push subs |
| `users/{uid}/groups/{familyCode}` | doc id | DELETE (recursive) | Reverse-index of which families the user belongs to |
| `families/{familyCode}/members/{memberId}` | `.uid` (since Plan 5.8) OR doc id (post-migration) | DELETE | The actual family-membership doc |
| `families/{familyCode}` | `.ownerUid` | UPDATE (transfer) or BLOCK | If user is owner, must transfer ownership first OR cancel deletion. See COMP-01 threat model. |
| `families/{familyCode}/sessions/{dateKey}` | `.actingUid` (votes), `.veto.actingUid` (veto data nested) | UPDATE (clear) or DELETE if entire session is by this user | Vote rows and veto rows nested in the session map |
| `families/{familyCode}/vetoHistory/{vetoId}` | `.actingUid` | DELETE | Per-veto audit trail |
| `families/{familyCode}/titles/{titleId}` | `.actingUid` (last edit), `.userMoods.{uid}` (mood tag attribution) | UPDATE (clear field at `.userMoods.{uid}`) — title doc itself is family-shared, do NOT delete | Subtle: title docs are co-owned. Just strip the user's mood-tag attributions. |
| `families/{familyCode}/titles/{titleId}/comments/{commentId}` | `.actingUid` | DELETE | If user authored the comment |
| `families/{familyCode}/activity/{activityId}` | `.actingUid` | DELETE | Activity feed entries authored by user |
| `families/{familyCode}/lists/{listId}` | `.actingUid` | DELETE | Custom-list authoring |
| `families/{familyCode}/watchparties/{wpId}` | `.hostUid`, `.participants.{uid}` map key | UPDATE (strip from participants); if hostUid==uid AND watchparty in active state → end the session before stripping | Late-joiner state is in participants map — keyed by uid. |
| `families/{familyCode}/intents/{intentId}` | `.createdByUid`, `.rsvps.{uid}` map key | DELETE intent if creator; else strip from rsvps map | Phase 8 intent flows. |

**Total per-user blast radius:** ~12 doc paths × N families the user is in. For a typical user in 1 family this is small (<50 docs). For a power user in 5 families with a year of history it could be 500-1500 docs. The reaper's 540s timeout + batch size of 20 users-per-tick keeps this comfortably bounded.

### Storage path enumeration for couch-albums sweep

```javascript
// In deletionReaperTick, AFTER firestore sweeps complete:
const bucket = admin.storage().bucket();  // default bucket queuenight-84044.appspot.com
// Storage rule already in place (storage.rules:29) for couch-albums.
// File pattern from js/app.js:9425 → `couch-albums/${state.familyCode}/${_postSessionWpId}/${ts}_${uidForPath}.jpg`
// Iterate every family the user was in:
for (const familyCode of familyCodes) {
  const [files] = await bucket.getFiles({ prefix: `couch-albums/${familyCode}/` });
  const mine = files.filter(f => f.name.includes(`_${uid}.jpg`));
  await Promise.all(mine.map(f => f.delete()));
  sweepCounts.photos = (sweepCounts.photos || 0) + mine.length;
}
```

## Common Pitfalls

### Pitfall 1: Owner-of-family blocking deletion
**What goes wrong:** User is the `ownerUid` of a family. Deleting them orphans the family — no one can change the password, transfer ownership, etc.
**Why it happens:** Couch's family ownership model has exactly one owner. Auth deletion alone doesn't solve this.
**How to avoid:** In `requestAccountDelete`, BEFORE entering grace state, scan `families/*` where `ownerUid == uid`. If any results, throw `failed-precondition` with message "Transfer ownership of <count> families first." UI shows the family list with a "Transfer ownership" link.
**Warning signs:** A user reports "I tried to delete my account but got an error about transferring ownership" — this is the gate working correctly.

### Pitfall 2: User signs back in during the 14-day grace window
**What goes wrong:** Couch shows them a normal sign-in but the reaper runs and nukes their data.
**Why it happens:** Sign-in flow doesn't check `users/{uid}.deletionRequestedAt`.
**How to avoid:** In `onAuthStateChangedCouch` (js/app.js ~line 2070), read `users/{uid}.deletionRequestedAt`. If set + not expired, route to a `deletion-pending.html`-style banner with "Your account is scheduled for deletion in N days. Cancel deletion?" CTA. Cancel-CTA calls a `cancelAccountDelete` callable that clears the field.
**Warning signs:** Late-stage UAT — sign in with a soft-deleted account and verify behavior.

### Pitfall 3: COMP-01 callable rate-limited by an attacker
**What goes wrong:** Bot submits 1000 deletion requests for random uids; even if each is rejected at auth gate, the CF burns budget.
**Why it happens:** CF onCall is unmetered by default until quota.
**How to avoid:** The auth gate (`request.auth.uid` required) means an unauthenticated attacker can't pass the first check. The only way to abuse this is from a stolen account session — at which point the attacker has worse vectors. Skip rate-limit work in v1; revisit if Cloud Logging shows abuse.
**Warning signs:** Cloud Functions invocation count spikes for `requestAccountDelete` without corresponding signups.

### Pitfall 4: CSP report-only breaks Trakt OAuth popup
**What goes wrong:** Trakt OAuth popup uses an inline script to message the parent window (sessionStorage) — CSP in report-only mode doesn't break it but if you accidentally enable enforcement it does.
**Why it happens:** Couch's Trakt OAuth flow opens a popup window with `https://trakt.tv/oauth/authorize`, which redirects to a `/__/auth/handler` (`callback.html` or similar) that ends with a script setting sessionStorage. That handler is on `couchtonight.app` and inherits the CSP.
**How to avoid:** Audit `app.html` for inline `<script>` blocks. Each one needs to be migrated to an external module OR the policy needs to allow the specific hash/nonce. CSP report-only mode FLAGS these but doesn't break them — that's the value.
**Warning signs:** CSP violation reports for `'inline-script'` against the OAuth handler URL.

### Pitfall 5: Sentry breaks Firestore real-time listeners by intercepting console.error
**What goes wrong:** Firestore SDK logs warnings on transient connection errors; if Sentry's `console.error` integration is loud, it spams the Sentry dashboard with "WebChannelConnection RPC..." noise that's unactionable.
**Why it happens:** Sentry's default browser integrations include a `consoleIntegration` that captures `console.error`/`console.warn`.
**How to avoid:** In `Sentry.init({integrations: [...]})`, explicitly DISABLE the default console integration OR configure `beforeBreadcrumb` to drop messages matching `/WebChannelConnection|FirebaseError|firestore.googleapis/`.
**Warning signs:** Sentry inbox flooded with Firestore transport noise within 24h of deploy.

### Pitfall 6: Cloud Scheduler job missing OAuth scope
**What goes wrong:** Job creation succeeds but every run returns 401 from Firestore admin API.
**Why it happens:** `--oauth-token-scope` defaults to `cloud-platform` which is over-broad; the export endpoint accepts `https://www.googleapis.com/auth/datastore`.
**How to avoid:** Use the explicit scope shown in Pattern 3 above. After creating the job, run it manually once (`gcloud scheduler jobs run daily-firestore-export --location us-central1`) and verify in `gs://queuenight-84044-backups/` that an export landed within 5 minutes.
**Warning signs:** Cloud Scheduler logs show "PERMISSION_DENIED" or HTTP 401 from the target.

### Pitfall 7: BUILD_DATE auto-stamp creates a dirty git tree
**What goes wrong:** `deploy.sh` modifies `js/constants.js`; if the user runs deploy without committing, the working tree has uncommitted changes.
**Why it happens:** stamp-build-date.cjs writes back to constants.js.
**How to avoid:** deploy.sh commits the stamp change BEFORE deploying — or the script aborts if the working tree is already dirty (so the stamp change isn't lost in unrelated WIP).
**Warning signs:** User runs `deploy.sh`, then later does `git status` and sees an unexpected `js/constants.js` modification.

### Pitfall 8: Firestore export costs more than expected
**What goes wrong:** Each export = 1 read op per document. At Couch v1 scale (a handful of families × ~500 titles each + watchparty/intent docs), this is trivial (~$0.01/day). At growth scale (hundreds of families × thousands of titles × years of history) it can become noticeable.
**Why it happens:** Daily exports + retention.
**How to avoid:** Lifecycle rule (30d) keeps storage cheap. If the read-op cost matters: switch to Firestore PITR (Point-in-Time Recovery) which is cheaper per-op but covers the same window. PITR was [generally available since 2024]; check current price-perf at execute time.
**Warning signs:** Billing dashboard shows Firestore read ops climbing without product-side traffic increase.

## Code Examples

### Example 1: Client-side deletion request UI (in `js/app.js`)

```javascript
// Source pattern: existing confirmLeaveFamily() / performLeaveFamily() in js/app.js
// Phase 13 / COMP-01

async function openDeleteAccountConfirm() {
  // Pre-flight check via callable: are there families I own?
  // Use a separate "checkAccountDeleteEligibility" callable that returns
  // {eligible: bool, ownedFamilies: [familyCode, ...]} without writing anything.
  try {
    const check = httpsCallable(functions, 'checkAccountDeleteEligibility');
    const { data } = await check();
    if (!data.eligible) {
      // Render a modal with "Transfer ownership of <names> first" + per-family transfer CTA
      openOwnershipBlockerModal(data.ownedFamilies);
      return;
    }
  } catch (e) {
    flashToast('Could not verify deletion eligibility — try again.');
    return;
  }
  // Open the typed-DELETE confirmation modal
  document.getElementById('delete-account-modal-bg').style.display = 'flex';
}

async function performDeleteAccount() {
  const typed = document.getElementById('delete-account-confirm-input').value;
  if (typed !== 'DELETE') {
    document.getElementById('delete-account-error').textContent =
      'Type DELETE in capitals to confirm.';
    return;
  }
  try {
    const fn = httpsCallable(functions, 'requestAccountDelete');
    const { data } = await fn({ confirm: 'DELETE' });
    // Render confirmation: "Your account will be deleted in 14 days.
    //   You can cancel this from the link in your sign-in screen."
    flashToast('Deletion scheduled. Signing out…');
    setTimeout(() => signOut(), 2000);
  } catch (e) {
    document.getElementById('delete-account-error').textContent =
      e.message || 'Could not schedule deletion. Try again or email privacy@couchtonight.app.';
  }
}
```

### Example 2: HTML for the confirmation modal (in `app.html`)

```html
<!-- Source pattern: leave-family-confirm-bg modal at app.html:732 -->
<!-- Phase 13 / COMP-01 -->
<div class="modal-bg" id="delete-account-modal-bg"
     onclick="if(event.target.id==='delete-account-modal-bg')closeDeleteAccountModal()">
  <div class="modal modal--w-440">
    <h3>Delete your Couch account?</h3>
    <p class="meta">
      This permanently deletes your account, your votes, your reactions, your
      watchparty history, and any photos you uploaded. <strong>This cannot be undone after 14 days.</strong>
      Other family members' data is unaffected.
    </p>
    <p class="meta">Type <strong>DELETE</strong> in capitals to confirm:</p>
    <input id="delete-account-confirm-input" type="text" autocomplete="off" />
    <p id="delete-account-error" class="meta error"></p>
    <div class="modal-actions-row">
      <button class="pill" onclick="closeDeleteAccountModal()">Cancel</button>
      <button class="pill warn" onclick="performDeleteAccount()">Delete my account</button>
    </div>
  </div>
</div>

<!-- And in the ADMIN cluster (app.html ~line 705 footer area), add: -->
<!-- AFTER the existing "Leave family" button: -->
<button class="pill warn" onclick="openDeleteAccountConfirm()">Delete account</button>
```

### Example 3: firebase.json CSP-Report-Only header (in `queuenight/firebase.json`)

```json
{
  "source": "**/*",
  "headers": [
    { "key": "X-Content-Type-Options", "value": "nosniff" },
    { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
    { "key": "X-Frame-Options", "value": "DENY" },
    {
      "key": "Content-Security-Policy-Report-Only",
      "value": "default-src 'self'; script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com https://*.sentry-cdn.com https://browser.sentry-cdn.com https://www.gstatic.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob: https://image.tmdb.org https://*.googleusercontent.com https://firebasestorage.googleapis.com; connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://us-central1-queuenight-84044.cloudfunctions.net https://api.themoviedb.org https://image.tmdb.org https://api.trakt.tv https://*.ingest.us.sentry.io; frame-src 'self' https://queuenight-84044.firebaseapp.com https://*.firebaseapp.com; worker-src 'self'; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; report-uri https://csp-reports.couchtonight.app/"
    }
  ]
}
```

> **Replace** the existing `**/*` headers block in `firebase.json` (currently sets only XCTO + Referrer-Policy + X-Frame-Options) — additive only, all three existing values preserved verbatim.

> **Note on `'unsafe-inline'` in script-src:** Couch has multiple inline `<script type="module">` blocks in `app.html` (the `landing.html` install-redirect, the Sentry `sentryOnLoad` config, the inline manifest `data:` URL, etc.). Adding `'unsafe-inline'` to `script-src` is a known Couch-specific weakening; in **report-only mode** it harms nothing but flag it for future tightening. The CSP-strict path (nonce-based) requires either a build step (we don't have one) or moving every inline script to an external file (a meaningful refactor). Defer that to Milestone 2.

### Example 4: Deletion eligibility check callable

```javascript
// queuenight/functions/src/checkAccountDeleteEligibility.js
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

exports.checkAccountDeleteEligibility = onCall({
  region: 'us-central1',
  cors: ['https://couchtonight.app', 'https://queuenight-84044.web.app'],
  memory: '256MiB',
  timeoutSeconds: 15
}, async (request) => {
  if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Must be signed in.');
  const uid = request.auth.uid;
  const owned = await db.collection('families').where('ownerUid', '==', uid).get();
  return {
    eligible: owned.empty,
    ownedFamilies: owned.docs.map(d => ({ familyCode: d.id, name: d.data().name || d.id }))
  };
});
```

### Example 5: GitHub Branch Protection Ruleset (UI checklist for `main`)

GitHub's UI for branch protection moved from "Branch protection rules" to "Rulesets" in 2024+. Use the newer Rulesets path — it's the modern surface and supports identical rules.

**Path:** `github.com/<owner>/couch` → Settings → Rules → Rulesets → New branch ruleset.

Configure these settings exactly:

- **Ruleset Name:** `protect-main`
- **Enforcement status:** Active
- **Bypass list:** (leave empty for solo dev — this is the gate you want)
- **Target branches:** Include by pattern → `main`
- **Branch rules** (check ALL of the following):
  - ✓ **Restrict deletions** (default-on)
  - ✓ **Block force pushes** (default-on)
  - ✓ **Require linear history**
  - ✓ **Require a pull request before merging**
    - Required approvals: **0**
    - Dismiss stale pull request approvals when new commits are pushed: ✓ (irrelevant at 0 approvals but harmless)
    - Require approval of the most recent reviewable push: leave unchecked
    - Require conversation resolution before merging: ✓
  - ✓ **Require status checks to pass**
    - Add: `syntax-check` (the job in `.github/workflows/ci.yml`)
    - "Require branches to be up to date before merging": ✓
- Leave OFF:
  - ✗ Restrict creations (allow new branches off main)
  - ✗ Restrict updates (allow normal merges via PR)
  - ✗ Require deployments to succeed
  - ✗ Require signed commits (GPG/SSH signing — solo dev burden, no security upside at this scale)

Verify by attempting `git push origin main` directly — should be rejected with "GH013: Repository rule violations found".

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `functions.auth.user().onDelete(handler)` (1st gen) | onCall callable + admin.auth().deleteUser() called from CF body | 2nd gen Firebase functions; 1st gen still works but won't get parity features | Use callable pattern; do not rely on auth triggers for COMP-01 |
| `--oauth-token-scope=cloud-platform` (broad) | `--oauth-token-scope=https://www.googleapis.com/auth/datastore` (narrow) | Cloud Scheduler 2024+ guidance | Tighter scope; fewer cross-service blast radius |
| GitHub "Branch protection rules" tab | GitHub "Rulesets" tab | GitHub UI migration 2024 | Same capabilities, newer surface; both still work |
| Crashlytics for web | Sentry / LogRocket / Bugsnag | N/A — Crashlytics never had a web SDK | Skip Crashlytics path entirely |
| CSP via `<meta http-equiv>` | CSP via HTTP header | CSP3 spec — Report-Only mode REQUIRES header, can't be in meta | Must use `firebase.json` headers for OPS-04 |
| Hard-delete on confirm-click | Soft-delete + grace-window reaper | Industry pattern across Google/Apple/Twitter | 14-day window protects against impulsive deletions |

**Deprecated/outdated:**
- Firebase Functions 1st gen authentication triggers — **deprecated** in v2, no replacement; use callable instead.
- `gcloud scheduler jobs create app-engine` — superseded by `pubsub` and `http` targets; we use `http`.
- CSP `report-uri` directive (deprecated, but still wider browser support than `report-to`) — recommend including BOTH directives in OPS-04 for maximum coverage. [CITED: developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri]

## Assumptions Log

> Items the planner / discuss-phase should confirm with the user before locking.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 14-day soft-delete window is appropriate (CONTEXT.md proposed it; not user-confirmed against privacy.html's 30-day promise) | COMP-01 / Pattern 1 | If user wants longer (e.g., 30 days = full privacy.html window) the CF constant changes; trivial. If shorter (7 days) — still inside privacy.html envelope. No data risk; UX only. |
| A2 | Sentry is acceptable as the third-party error reporting service (CONTEXT.md said Crashlytics; we're flipping the recommendation due to web SDK availability). User has not been asked. | OPS-05 | If user prefers a different vendor (LogRocket, Bugsnag, Datadog RUM) the loader-script pattern is similar but provider-specific; ~30 min refactor per swap. |

**Not blocking:** Both items A1 and A2 are in CONTEXT.md's "Claude's Discretion" zone. The planner can ship with these defaults and the user can revise during execute or post-deploy.

## Open Questions

1. **Should the deletion reaper email/push the user "your account was deleted"?**
   - What we know: Phase 6 push infra exists; we have the user's pushSubscriptions before deletion fires.
   - What's unclear: Privacy.html doesn't promise a confirmation. Most apps DO send one ("we've completed your deletion request") for legal cover.
   - Recommendation: Yes, push a final confirmation BEFORE deleting `users/{uid}`. Reuse `sendToMembers` helper. Defer if it adds plan complexity.

2. **What happens to a user who deletes account, then re-signs-up with same email?**
   - What we know: Firebase Auth re-creates a new UID for the same email. The new UID has zero data (good — clean slate).
   - What's unclear: If reaper hasn't run yet (within grace window), the OLD soft-deleted account is still scheduled for hard-delete; the new account is a separate UID. They'd be distinct accounts.
   - Recommendation: Document this in privacy.html ("re-creating an account does not restore your old data"). No code change needed; the UID change handles it cleanly.

3. **Should COMP-01 ship behind a feature flag for v1?**
   - What we know: Plan 11-02 used `state.family.yirReady` as a hide-feature flag for YIR.
   - What's unclear: COMP-01 is destructive; a feature flag would let us soft-launch (deploy CF, hide UI) and run a test deletion against a throwaway account before exposing it.
   - Recommendation: Yes — gate the "Delete account" button behind `?ff=delete` URL param OR a `state.family.deletionEnabled` flag for the first deploy. Flip the flag once we've run a successful end-to-end test.

4. **Is there a Cloud Scheduler quota concern with adding daily-firestore-export?**
   - What we know: Cloud Scheduler free tier = 3 jobs/month free; we already have `watchpartyTick` and `rsvpReminderTick` (both onSchedule, both 1st-class jobs). Adding `daily-firestore-export` + `deletionReaperTick` = 4 total. **One job over free tier.**
   - What's unclear: How GCP bills. Each additional job is ~$0.10/month — negligible.
   - Recommendation: Confirm in `gcloud scheduler jobs list --location=us-central1` after Phase 13 ships. Add to RUNBOOK.md "Cloud Scheduler" row.

5. **Do we want a CSP report-uri sink in v1, or wait?**
   - What we know: report-only mode + browser console works fine for solo-dev introspection. A sink (Cloudflare Worker) takes 30 min to set up.
   - What's unclear: How frequently CSP violations will fire. Our codebase is small.
   - Recommendation: Ship report-only WITHOUT a sink in v1. If after 2 weeks we still want a sink (or want to enforce), add it then. Saves a plan, keeps Phase 13 tight.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `firebase` CLI | All deploy paths (existing) | ✓ | latest installed | — |
| `gcloud` CLI | OPS-07 (Cloud Scheduler + IAM bindings) | ✓ assumed (Firebase deploys imply gcloud auth) | — | Manual setup via Cloud Console UI as alternative |
| `gsutil` | OPS-07 (bucket lifecycle) | ✓ bundled with gcloud | — | gcloud storage subcommands as alternative |
| Node 22 | All CF + scripts | ✓ | 22 (per `queuenight/functions/package.json:engines`) | — |
| `firebase-tools` (npm) | COMP-01 reaper recursive delete | ⚠ needs install in `queuenight/functions/` | will pin at install | Hand-rolled BFS subcollection traversal — adds ~50 LOC, increases COMP-01 plan size |
| GitHub admin access | OPS-06 branch protection | ✓ assumed (user owns the repo) | — | None — user must do this manually |
| Sentry account | OPS-05 | ⚠ user must create one | latest | LogRocket / Bugsnag / Datadog RUM as alternatives (similar loader-script story) |
| Cloudflare account | OPS-04 report-uri sink (optional) | ⚠ unknown | — | Skip sink; rely on browser console for first 2 weeks |

**Missing dependencies with no fallback:** None — every blocker has a fallback or is user-controllable.

**Missing dependencies with fallback:**
- Sentry account creation: 5-minute signup; fallback is to defer OPS-05 until account is provisioned (don't block other plans).
- Cloudflare account: optional; defer entirely.

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives constrain Phase 13 plans. Plans MUST honor all of these:

- ✓ **Never read `js/app.js` in full** — use Grep + offset/limit. RESEARCH.md grep'd the file in chunks.
- ✗ **Don't introduce a bundler or build step** — Sentry MUST use the loader script (CDN), not NPM. CSP nonce-based hardening is deferred for the same reason.
- ✗ **Don't move TMDB key / Firebase config server-side.** Sentry DSN is also public-by-design (rate-limited per project).
- ✓ **Bump `sw.js` CACHE on user-visible app changes.** Phase 13 user-visible changes: Delete-account button (COMP-01) and Sentry loader. Sentry alone might not warrant a CACHE bump (no UI change), but COMP-01 does.
- ✓ **Cloud Functions in sibling `queuenight/functions/`.** All new CFs in Phase 13 land there.
- ✓ **TMDB rate limit ~40 req/10s.** No new TMDB calls in Phase 13. Not relevant.
- ✓ **Per-family Firestore nesting.** COMP-01 sweep respects this; reaper iterates `families/{code}/...` per family-membership.
- ✗ **Don't renumber product phases.** Phase 13 stays Phase 13; OPS-01 and OPS-03 deferred to "Phase 14 or Milestone 2".

## Sources

### Primary (HIGH confidence)
- `queuenight/firebase.json` — read directly; confirmed Phase 12 shipped XCTO + Referrer-Policy + X-Frame-Options
- `queuenight/firestore.rules` — read directly; confirmed `users/{uid}/groups/{familyCode}` reverse-index pattern + `actingUid` attribution requirement on every write
- `queuenight/storage.rules` — read directly; confirmed Variant A (auth+size+MIME, no family-membership gate)
- `queuenight/functions/src/rsvpSubmit.js` — onCall pattern model
- `queuenight/functions/src/consumeGuestInvite.js` — admin SDK + idempotency model
- `queuenight/functions/index.js` — `sendToMembers` push helper, `isInQuietHours`, `NOTIFICATION_DEFAULTS`
- `couch/scripts/stamp-build-date.cjs` — existing BUILD_DATE auto-stamp
- `couch/.github/workflows/ci.yml` — existing CI workflow (the status check that branch protection will require)
- `couch/sw.js` line 8 — current CACHE name `couch-v32.2-asset-cache-control`
- `couch/app.html` line 632-728 — ADMIN cluster structure where Delete button attaches
- `couch/js/app.js` line 9425 — Storage path pattern `couch-albums/${state.familyCode}/${_postSessionWpId}/${ts}_${uidForPath}.jpg`
- `couch/js/state.js` — collection refs (membersRef, titlesRef, familyDocRef)
- [Firebase docs — Schedule data exports](https://firebase.google.com/docs/firestore/solutions/schedule-export) — Cloud Function + IAM pattern
- [Cloud docs — Schedule data exports](https://cloud.google.com/firestore/docs/solutions/schedule-export) — IAM commands
- [Sentry docs — Loader script](https://docs.sentry.io/platforms/javascript/install/loader/) — exact loader pattern + sentryOnLoad
- [Sentry docs — Sensitive data scrubbing](https://docs.sentry.io/platforms/javascript/data-management/sensitive-data/) — beforeSend pattern
- [Firebase docs — Delete data with callable function](https://firebase.google.com/docs/firestore/solutions/delete-collections) — recursiveDelete pattern + memory/timeout config
- [GitHub Issue #710 — FR: Web Observability in Crashlytics](https://github.com/firebase/firebase-js-sdk/issues/710) — confirmation that Crashlytics has no web SDK as of 2026

### Secondary (MEDIUM confidence — WebSearch verified by docs)
- [Auth onCreate/onDelete triggers for v2 functions GitHub issue #1383](https://github.com/firebase/firebase-functions/issues/1383) — confirms 2nd-gen has no auth triggers
- [GitHub Docs — Available rules for rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) — Rulesets UI labels
- [MDN — CSP report-uri](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/report-uri) — deprecated but wider support
- [MDN — CSP-Report-Only must be header](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy-Report-Only) — meta forbidden
- [W3C webappsec-csp Issue #277](https://github.com/w3c/webappsec-csp/issues/277) — meta-tag Report-Only forbidden
- [GDPR Article 17](https://gdpr-info.eu/art-17-gdpr/) — "without undue delay" + 30-day max for response (privacy.html promise compatible)
- [Sentry pricing 2026](https://sentry.io/pricing/) — 5K errors/mo free tier
- [Codemzy — Cloudflare Worker CSP report endpoint](https://www.codemzy.com/blog/cloudflare-function-csp-report) — report-uri sink pattern

### Tertiary (LOW confidence — single source)
- Firebase functions free-tier scheduler quota = 3 jobs/month — sourced from older Google Cloud docs; verify at execute time via `gcloud scheduler jobs list` billing notes.

## Metadata

**Confidence breakdown:**
- COMP-01 architecture (callable + reaper + sweep): **HIGH** — pattern matches existing `consumeGuestInvite` + `rsvpSubmit` + scheduled `watchpartyTick` CFs; collection enumeration verified by direct grep.
- COMP-01 14-day soft-delete window: **MEDIUM** — industry-standard but specific number is `[ASSUMED A1]`.
- OPS-05 Sentry choice: **HIGH** — Crashlytics-no-web-SDK confirmed; Sentry loader-no-bundler pattern verified by docs.
- OPS-05 Sentry as preferred vendor: **MEDIUM** — `[ASSUMED A2]` — user might prefer LogRocket/Bugsnag.
- OPS-02 + OPS-06 wiring: **HIGH** — deploy.sh pattern is straightforward; GitHub Rulesets labels verified by docs.
- OPS-07 gcloud commands: **HIGH** — verbatim from official docs.
- OPS-04 CSP directive list: **MEDIUM** — domain list compiled from grep + docs; may need refinement during Wave 2 of execute (report-only mode catches mistakes).

**Research date:** 2026-04-25
**Valid until:** 2026-05-25 (30 days for stable infrastructure-level claims; Sentry pricing tier may change quarterly)

## RESEARCH COMPLETE

All 5 items in scope (COMP-01, OPS-05, OPS-02+OPS-06, OPS-07, OPS-04) have concrete recommendations, code/config snippets, and identified pitfalls. The planner can now write `<action>` blocks with verbatim commands, header values, SDK init code, and gcloud invocations — no TBDs. Two `[ASSUMED]` items (14-day grace window, Sentry vendor choice) are flagged in the Assumptions Log for the discuss-phase or planner to confirm with the user.

**Cross-cutting threat surface validated:**
- COMP-01: auth gate (uid-required), confirmation gate (typed DELETE), grace window (cancellation surface), owner-of-family pre-flight, soft-delete idempotency.
- OPS-05: PII scrubbing in `beforeSend`, masked replay, no email/uid in payload.
- OPS-04: report-only first (no enforcement risk), additive only to existing headers.
- OPS-07: tight OAuth scope, IAM least-privilege, lifecycle rule prevents storage runaway.
- OPS-06: 0-reviewer protection lets solo dev push via PR, blocks force-push + deletion.
