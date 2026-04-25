---
phase: 13-compliance-and-ops
plan: "05"
subsystem: security-headers
tags: [csp, firebase-hosting, security, report-only, service-worker, tech-debt]
dependency_graph:
  requires: ["13-01", "13-02"]
  provides: [Content-Security-Policy-Report-Only header on all paths, sw.js v33.2-csp, TD-4 partial close]
  affects: [queuenight/firebase.json, sw.js, .planning/TECH-DEBT.md]
tech_stack:
  added: []
  patterns: [Firebase Hosting headers block (additive), CSP Report-Only HTTP header, blob: worker-src allowance]
key_files:
  created: []
  modified:
    - C:\Users\nahde\queuenight\firebase.json
    - sw.js
    - .planning/TECH-DEBT.md
decisions:
  - "CSP shipped in Report-Only mode (not enforcement) per RESEARCH.md anti-pattern guidance"
  - "No report-uri sink in v1 per Open Question #5 — console-only observation"
  - "worker-src 'self' blob: pre-allowed (review fix LOW — Firebase SDK blob-URL worker common miss)"
  - "CACHE bumped from couch-v33.1-sentry to couch-v33.2-csp per Wave 3 minor-bump convention"
  - "TD-4 marked partial-close: CSP Report-Only shipped; enforcement deferred to Milestone 2"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-25"
  tasks_completed: 1
  tasks_total: 1
---

# Phase 13 Plan 05: CSP Report-Only Header Summary

**One-liner:** Content-Security-Policy-Report-Only header covering Firebase SDK + TMDB + Trakt + Google Fonts + Sentry CDN + queuenight Cloud Functions, with blob: worker-src and no report-uri sink for solo-dev console observation.

## What Was Built

A single additive HTTP header — `Content-Security-Policy-Report-Only` — was added to the existing `**/*` headers block in `queuenight/firebase.json`. The header covers all origin allowlists required by the Couch v1 surface:

- **Firebase SDK + services:** `https://www.gstatic.com`, `https://*.firebaseapp.com`, `https://*.googleapis.com`, `https://*.firebaseio.com`, `https://identitytoolkit.googleapis.com`, `https://securetoken.googleapis.com`, `https://firestore.googleapis.com`, `https://firebasestorage.googleapis.com`, `https://firebaseinstallations.googleapis.com`, `https://firebase.googleapis.com`
- **queuenight Cloud Functions (Plan 13-01):** `https://us-central1-queuenight-84044.cloudfunctions.net`
- **Sentry CDN + ingest (Plan 13-02):** `https://js.sentry-cdn.com`, `https://*.sentry-cdn.com`, `https://browser.sentry-cdn.com`, `https://*.ingest.us.sentry.io`
- **TMDB:** `https://api.themoviedb.org`, `https://image.tmdb.org`
- **Trakt:** `https://api.trakt.tv`
- **Google Fonts:** `https://fonts.googleapis.com`, `https://fonts.gstatic.com`
- **Google user content:** `https://*.googleusercontent.com`
- **Firebase Hosting app:** `https://queuenight-84044.firebaseapp.com`

All 3 existing Phase 12 headers preserved verbatim (XCTO + Referrer-Policy + X-Frame-Options).

**Review fix LOW incorporated:** `worker-src 'self' blob:` pre-allows blob-URL workers — a documented common miss for Firebase SDK and service worker registration paths.

## Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | CSP Report-Only + sw.js bump + TD-4 update | `5149c7d` | `sw.js`, `.planning/TECH-DEBT.md` |

Note: `queuenight/firebase.json` is in the sibling repo (`C:\Users\nahde\queuenight\`) — edited directly per the project's established deploy-mirror pattern. It is not tracked in this worktree's git tree and is deployed via `firebase deploy --only hosting --project queuenight-84044`.

## CSP Header Value (full)

```
default-src 'self';
script-src 'self' 'unsafe-inline' https://js.sentry-cdn.com https://*.sentry-cdn.com https://browser.sentry-cdn.com https://www.gstatic.com https://*.firebaseapp.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: blob: https://image.tmdb.org https://*.googleusercontent.com https://firebasestorage.googleapis.com;
connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://firebaseinstallations.googleapis.com https://firebase.googleapis.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com https://firebasestorage.googleapis.com https://us-central1-queuenight-84044.cloudfunctions.net https://api.themoviedb.org https://image.tmdb.org https://api.trakt.tv https://*.ingest.us.sentry.io;
frame-src 'self' https://queuenight-84044.firebaseapp.com https://*.firebaseapp.com;
worker-src 'self' blob:;
manifest-src 'self';
base-uri 'self';
form-action 'self';
frame-ancestors 'none'
```

(Stored as a single-line JSON string in firebase.json per spec.)

## Post-Deploy Verification Commands

After mirroring sw.js to `${QUEUENIGHT_PATH}/public/` and deploying:

```bash
# Confirm CSP header is live
curl -sI https://couchtonight.app/ | grep -i 'content-security-policy-report-only'

# Confirm blob worker allowance is present (review fix LOW)
curl -sI https://couchtonight.app/ | grep -i "worker-src 'self' blob:"

# Confirm sw.js CACHE is bumped
curl -s https://couchtonight.app/sw.js | grep "const CACHE"
# Expected: const CACHE = 'couch-v33.2-csp';
```

Note: Curl smoke output will be captured during actual deploy (post-Wave-3 orchestrator step). This SUMMARY is written pre-deploy per plan completion sequence.

## 2-Week Audit-Flow Exercise Log

Flows to exercise during the observation window (browser console → watch for CSP violations):

| # | Flow | Status |
|---|------|--------|
| 1 | Trakt OAuth round-trip | Pending — scheduled week 1 |
| 2 | Photo upload to couch-albums | Pending — scheduled week 1 |
| 3 | Watchparty scheduling end-to-end | Pending — scheduled week 1 |
| 4 | RSVP submit via rsvp.html | Pending — scheduled week 1 |
| 5 | PWA install from fresh browser | Pending — scheduled week 1 |
| 6 | Sentry error transmission (induce error) | Pending — scheduled week 1 |
| 7 | TMDB poster load + CDN redirects | Pending — scheduled week 1 |
| 8 | YouTube trailer embed | N/A — Couch v1 doesn't embed YouTube |

Initial violation count: TBD (post-deploy + 5 min normal use). To be updated after first console review.

## TD-4 Status Update (post-Phase-13)

TD-4 remains Active but is now marked **partial close**. The new TD-4 body in TECH-DEBT.md records:

- **Status:** Partial close — CSP shipped in Report-Only mode; enforcement deferred.
- **What shipped:** Phase 12 quick-win headers + Phase 13 CSP-Report-Only + blob: worker-src allowance.
- **Codex audit-flow checklist:** 7 active flows (Trakt OAuth, photo upload, watchparty schedule, RSVP, install, Sentry, TMDB) + YouTube embed as future-only.
- **What still needs work:** Drop `'unsafe-inline'` from script-src and style-src; optional report-uri sink; Permissions-Policy header.
- **Path to enforcement:** 2-week observation → fix inline scripts → flip header key → deploy.

## Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Enforcement flip (CSP → Content-Security-Policy) | Must fix `'unsafe-inline'` in script-src + style-src first (11+ inline script blocks in app.html) | Milestone 2 |
| report-uri sink (Cloudflare Worker) | Console observation sufficient for solo-dev v1; sink adds complexity with minimal solo-dev benefit | Milestone 2 (if console review proves insufficient) |
| Permissions-Policy header | Defense-in-depth; not urgently needed for v1 surface | Milestone 2 |
| TD-6: Sentry Replay re-enable | Privacy review needed post-launch +30 days | post-launch +30d |

## STRIDE Threat Dispositions

| Threat ID | Category | Disposition | Notes |
|-----------|----------|-------------|-------|
| T-13-05-01 | Tampering/Elevation (inline-script XSS) | accept | Report-Only provides observability, not mitigation. Couch's `escapeHtml` + Phase 12 headers are actual XSS defenses today. CSP enforcement deferred to Milestone 2 after TD-4 inline-script audit. |
| T-13-05-02 | Information disclosure (report-uri sink) | accept | No sink added in v1. If Cloudflare Worker sink added later, URLs are already redacted by Sentry `beforeSend` regex (Plan 13-02 PII strip cross-cuts). |
| T-13-05-03 | Denial of service (misconfigured CSP breaks Firebase/TMDB/Trakt/Sentry) | mitigate | Report-Only mode: violations logged, not blocked. App functionality unaffected. 2-week audit window with explicit checklist (review fix LOW) surfaces misses before enforcement flip. |
| T-13-05-04 | Tampering (Trakt OAuth popup postMessage blocked by CSP) | accept | Report-Only doesn't break this. Trakt OAuth round-trip is item #1 in audit-flow checklist — caught during observation window. |
| T-13-05-05 | Denial of service (worker/sw.js blob: URL blocked under enforced CSP) | mitigate | `worker-src 'self' blob:` pre-allowed (review fix LOW). Install flow is item #5 in audit-flow checklist. |

## Deviations from Plan

None — plan executed exactly as written. The firebase.json edit went to the sibling repo via absolute path as specified. The worktree git commit covers sw.js + TECH-DEBT.md; firebase.json is deployed separately per the established project pattern.

## Known Stubs

None — this plan ships a complete HTTP header configuration. No placeholder data flows to UI rendering.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The CSP header restricts rather than expands the trust surface.

## Self-Check: PASSED

- `sw.js` CACHE = `couch-v33.2-csp` ✓
- `.planning/TECH-DEBT.md` contains `Report-Only`, `audit-flow checklist`, `Trakt OAuth round-trip`, `enforcement deferred` ✓
- `queuenight/firebase.json` valid JSON, 1x `Content-Security-Policy-Report-Only`, 1x `worker-src 'self' blob:`, 0x `report-uri` ✓
- Commit `5149c7d` exists ✓
- All 3 Phase 12 headers preserved verbatim ✓
- All required origins present: Sentry CDN/ingest, Firebase SDK, TMDB, Trakt, Google Fonts, queuenight CF endpoint ✓
- TD-6 (from 13-02) untouched ✓
