---
phase: 13-compliance-and-ops
plan: 02
subsystem: error-reporting
tags: [sentry, pii-scrub, service-worker, tech-debt]
dependency_graph:
  requires: [13-01]
  provides: [sentry-loader, pii-beforeSend, firestore-noise-filter]
  affects: [app.html, landing.html, sw.js, .planning/TECH-DEBT.md]
tech_stack:
  added: [Sentry CDN loader (js.sentry-cdn.com), browserTracingIntegration]
  patterns: [sentryOnLoad init block, beforeSend PII scrubber, beforeBreadcrumb noise filter]
key_files:
  created: []
  modified:
    - app.html
    - landing.html
    - sw.js
    - .planning/TECH-DEBT.md
decisions:
  - "Replay DISABLED for v1 (review fix MEDIUM-6) — privacy surface too broad for a family app pre-privacy-review; tracked as TD-6 for post-launch +30 days re-enable"
  - "SRI hash rejected for Sentry loader script (T-7 accept) — Sentry loader is auto-versioned at CDN edge; SRI would lock to a single immutable build defeating the auto-update purpose"
  - "DSN left as placeholder strings in version control — deploy.sh MEDIUM-5 guard aborts production deploy if placeholders remain; operator must substitute real DSN before deploy"
  - "De-duplicated Sentry block across app.html + landing.html acceptable for v1 — refactor to shared js/sentry-config.js deferred to Milestone 2"
metrics:
  duration: ~15 min
  completed: 2026-04-25
  tasks_completed: 3
  tasks_total: 3
  files_changed: 4
  insertions: 184
  deletions: 1
---

# Phase 13 Plan 02: Sentry CDN Loader + PII-Scrubbing beforeSend Summary

One-liner: Sentry CDN loader with ES5 beforeSend PII scrubber (uid/email/family-code/token strip) + Firestore breadcrumb noise filter added to both HTML surfaces; Session Replay disabled for v1 per Codex MEDIUM-6 privacy review finding.

## Commits Landed

| Hash | Type | Description |
|------|------|-------------|
| 19f9f6a | feat | Add Sentry loader + PII-scrubbing beforeSend to app.html + landing.html (Replay disabled) |
| 7b9aa5e | chore | Bump sw.js CACHE to couch-v33.1-sentry for Sentry shell change |
| bd2890f | docs | Add TECH-DEBT.md entry TD-6 for Sentry Replay deferral (review fix MEDIUM-6) |

## Files Modified

| File | Change | Lines +/- |
|------|--------|-----------|
| app.html | Sentry loader block inserted in `<head>` after `<link rel="stylesheet" href="/css/app.css">`, before `</head>` | +71 |
| landing.html | Identical Sentry loader block inserted after redirect IIFE `</script>`, before `<script type="application/ld+json">` | +71 |
| sw.js | CACHE constant bumped: `couch-v33-comp-13-01-account-deletion` → `couch-v33.1-sentry` | +1/-1 |
| .planning/TECH-DEBT.md | TD-6 entry prepended to Active section (Sentry Replay deferred, post-launch +30 days) | +41 |

## What Was Built

### Sentry Loader Block (identical across both surfaces)

Both `app.html` and `landing.html` now include the following structure in `<head>`:

1. A `window.sentryOnLoad` callback that calls `Sentry.init({...})` with:
   - `dsn`: placeholder string (operator substitutes real DSN before deploy)
   - `environment`: `'production'` if `location.hostname === 'couchtonight.app'`, else `'dev'`
   - `tracesSampleRate: 0.1` (10% of transactions, fits free tier)
   - `integrations: [Sentry.browserTracingIntegration()]` — Replay omitted per MEDIUM-6
   - `beforeSend`: PII scrubber (see detail below)
   - `beforeBreadcrumb`: Firestore noise filter (Pitfall 5 defense)

2. `<script src="https://js.sentry-cdn.com/<SENTRY_PUBLIC_KEY>.min.js" crossorigin="anonymous"></script>`

### PII Scrubber (beforeSend)

Four scrubbing operations applied synchronously before Sentry transmits any event:

1. **Explicit user field deletion:** `event.user.id` (uid), `event.user.email`, `event.user.username`, `event.user.ip_address` deleted from every event object.
2. **Family-code regex:** `/\b[a-f0-9]{6}\b/gi` replaces 6-char hex strings in `event.message` and `event.exception.values[*].value` with `<FAMILY>`.
3. **Token strip from request URLs:** `?invite=`, `?claim=` query params redacted to `<REDACTED>`; `/rsvp/<token>` path segments replaced with `/rsvp/<TOKEN>`.
4. **Breadcrumb URL strip:** same token patterns applied to `event.breadcrumbs[*].data.url`.

Review fix MEDIUM-9 caveat: stack frames, request headers, tags not directly mutated by `beforeSend`, and any future Replay metadata may still carry identifiers. Sentry inbox review every ~30 days post-launch is required to detect new identifier sources.

### Firestore Noise Filter (beforeBreadcrumb)

Any breadcrumb whose `message` matches `/WebChannelConnection|FirebaseError|firestore\.googleapis/` is dropped (returns `null`). Prevents Firestore real-time transport noise from flooding the Sentry breadcrumb trail and masking real errors (Pitfall 5 defense from RESEARCH.md).

## Review Fixes Applied

### MEDIUM-6: Session Replay disabled for v1

**Evidence (grep proof):**

```
app.html:     grep -c "replaysSessionSampleRate"  → 0
app.html:     grep -c "replaysOnErrorSampleRate"  → 0
app.html:     grep -c "Sentry.replayIntegration"  → 0
landing.html: grep -c "replaysSessionSampleRate"  → 0
landing.html: grep -c "replaysOnErrorSampleRate"  → 0
landing.html: grep -c "Sentry.replayIntegration"  → 0
```

The `integrations` array contains only `Sentry.browserTracingIntegration()`. No replay keys or integration present in either file.

Re-enable path tracked in TECH-DEBT.md as TD-6 (target: post-launch +30 days with privacy review).

### MEDIUM-9: PII scrub wording softened

The `beforeSend` implementation is unchanged from original PATTERNS.md. Only the surrounding claim language was softened: the plan's `must_haves.truths` now reads "explicit fields stripped + defensive scrubbing on known-leak surfaces" rather than "all PII stripped". The SUMMARY comments include the MEDIUM-9 caveat about residual surfaces (stack frames, headers, tags).

## Security Decisions

### T-7: SRI Hash Rejected — disposition: accept

**Threat:** Sentry CDN script tampering (compromised CDN injects malicious code).

**Mitigation applied:** `crossorigin="anonymous"` on the `<script>` loader tag.

**SRI hash decision:** NOT applied. Rationale: Sentry's loader script is auto-versioned at the CDN edge ("latest" per project). Adding an `integrity="sha384-..."` attribute would lock the app to a single immutable build, defeating the auto-update purpose of the loader pattern that docs.sentry.io explicitly recommends. Operational cost: re-pinning the hash on every Sentry SDK version bump is infeasible for a solo dev.

**Accepted risk:** Sentry CDN compromise → Couch ships malicious JS to all users for the duration of the compromise. Documented in TECH-DEBT.md; revisit if Sentry has a CDN incident.

### T-6: PII Disclosure — disposition: mitigate

Explicit-fields deletion in `beforeSend` (uid, email, username, ip_address) + family-code regex + token-strip on request URLs and breadcrumb URLs. Severity: HIGH per threat register.

## Pre-Deploy Steps for the Operator

**REQUIRED before running `firebase deploy`:**

1. Create a free-tier Sentry account at https://sentry.io/signup/
2. Create a Browser JavaScript project named `couch`
3. Navigate to: Sentry Dashboard → Settings → Projects → couch → Client Keys (DSN) → Loader Script
4. Copy the DSN (format: `https://<PUBLIC_KEY>@o<ORGID>.ingest.us.sentry.io/<PROJECTID>`)
5. Substitute the real values in **both** `app.html` and `landing.html`:
   - Replace `<SENTRY_PUBLIC_KEY>` with the actual public key (appears twice per file: in the DSN string and in the `<script src>` URL)
   - Replace `<SENTRY_ORGID>` with the actual org ID
   - Replace `<SENTRY_PROJECTID>` with the actual project ID

**Deploy guard:** `scripts/deploy.sh` (Plan 13-03) contains a MEDIUM-5 guard that aborts production deploy if `app.html` or `landing.html` (in the queuenight/public mirror) still contain any of the literal strings `<SENTRY_PUBLIC_KEY>`, `<SENTRY_ORGID>`, or `<SENTRY_PROJECTID>`. The deploy will fail loudly with an error message if placeholders remain.

## sw.js CACHE Bump

Wave-2 minor bump:
- Before: `couch-v33-comp-13-01-account-deletion` (Plan 13-01 Wave 1)
- After: `couch-v33.1-sentry` (Plan 13-02 Wave 2)

Installed PWAs will invalidate their cache on next online activation and re-fetch the shell including the new Sentry loader in `app.html`.

## TECH-DEBT Entry Created

TD-6 "Sentry Replay deferred (post-launch +30 days)" prepended to the Active section of `.planning/TECH-DEBT.md`. Contains:
- Why deferred (DOM capture privacy surface for family app)
- Re-enable plan (sample rates, integration re-add, privacy review, smoke test)
- Re-enable code diff sketch (`replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 0.05`)
- Source traceability: Codex peer review MEDIUM-6

## Post-Deploy Smoke Tests (deferred — requires real DSN)

These tests require a real Sentry DSN to be substituted and the app deployed:

1. `curl -s https://couchtonight.app/app | grep -c "sentryOnLoad"` → 1
2. `curl -s https://couchtonight.app/ | grep -c "sentryOnLoad"` → 1
3. Replay-absence: `curl -s https://couchtonight.app/app | grep -c "replaysSessionSampleRate"` → 0
4. Open Sentry dashboard inbox, run in DevTools: `throw new Error('Phase 13-02 Sentry smoke test')` — verify event appears within ~30s with no uid/email in explicit-fields payload
5. Family-code regex: `throw new Error('test family abc123 leaked')` — Sentry should show `'test family <FAMILY> leaked'`

## Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Extract `js/sentry-config.js` shared module | ~50 lines duplicated across app.html + landing.html | Milestone 2 refactor |
| CSP nonce migration for inline `sentryOnLoad` block | Plan 13-05 ships CSP report-only; when enforcement is enabled, inline script must move to external file or get a nonce | When Plan 13-05 flips to enforcement |
| Sentry Replay re-enable | Privacy review required; disabled per MEDIUM-6 | Post-launch +30 days (TD-6) |
| DSN substitution + smoke test | Requires operator Sentry account setup | Pre-deploy operator action |

## Deviations from Plan

None — plan executed exactly as written. The comment-wording deviation (removing "No replaysSessionSampleRate, no replaysOnErrorSampleRate" from the inline comment to satisfy the grep acceptance criteria that those strings be absent from the files) is a self-correction during execution, not a plan deviation.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| app.html exists | FOUND |
| landing.html exists | FOUND |
| sw.js exists | FOUND |
| .planning/TECH-DEBT.md exists | FOUND |
| 13-02-SUMMARY.md exists | FOUND |
| commit 19f9f6a (feat: Sentry loader) | FOUND |
| commit 7b9aa5e (chore: sw.js bump) | FOUND |
| commit bd2890f (docs: TECH-DEBT TD-6) | FOUND |
| sentryOnLoad in app.html | OK |
| sentryOnLoad in landing.html | OK |
| couch-v33.1-sentry in sw.js | OK |
| TD-6 in TECH-DEBT.md | OK |
| No unexpected file deletions | OK |
