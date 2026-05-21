---
phase: 31-marketing-refresh
plan: 04
subsystem: marketing/deploy
tags: [deploy, og-metadata, cache-bump, sw, uat, mirror-extension, screenshots-rewire]
requirements: [MARK-31-08, MARK-31-11, MARK-31-12, MARK-31-13, MARK-31-14]
dependency_graph:
  requires:
    - .planning/phases/31-marketing-refresh/31-01-SUMMARY.md (comparison + features + FAQ on landing)
    - .planning/phases/31-marketing-refresh/31-02-SUMMARY.md (3 new marketing/ PNGs + soft-fallback map for 2 missing surfaces)
    - .planning/phases/31-marketing-refresh/31-03-SUMMARY.md (og.png 1200×630 at repo root + brand/og-source.svg)
  provides:
    - landing.html: .screenshots section consuming new marketing/ files + og.png?v=2 in 2 places
    - changelog.html: og.png?v=2 in 2 places
    - rsvp.html: 12 new OG/Twitter meta tags (closes D-18 gap)
    - scripts/deploy.sh: extended mirror loop for og.png + marketing/ + brand/
    - sw.js: CACHE = couch-v48-marketing-refresh (live at couchtonight.app)
    - .planning/phases/31-marketing-refresh/31-HUMAN-UAT.md: 7 device-UAT scripts
  affects:
    - production deploy: couchtonight.app now serving Phase-31 marketing surface
tech_stack:
  added: []
  patterns:
    - conditional mirror block `if [ -f og.png ]` / `if [ -d marketing ]` / `if [ -d brand ]` in deploy.sh
    - og.png?v=2 query-string cache-bust for social-card scrapers (Facebook / Twitter / iMessage)
    - soft-fallback to marketing/archive-phase-9/ with inline HTML comment audit trail
    - native <details>/<summary> FAQ accordion (zero JS framework, replicates D-04 lock)
key_files:
  created:
    - .planning/phases/31-marketing-refresh/31-HUMAN-UAT.md
    - .planning/phases/31-marketing-refresh/31-04-SUMMARY.md
  modified:
    - landing.html (5 screenshot figures rewired + og:image cache-bust + JSON-LD image cache-bust)
    - changelog.html (og:image + twitter:image cache-bust)
    - rsvp.html (added 12 OG/Twitter meta tags)
    - scripts/deploy.sh (3 new conditional mirror blocks)
    - sw.js (CACHE = couch-v48-marketing-refresh)
decisions:
  - "Used 5-figure grid (D-25 happy path) with 2 soft-fallback figures pointing at marketing/archive-phase-9/watchparty-live.png — preserves D-25 5-shot grid intent rather than collapsing to 4 figures"
  - "Honored D-18 cross-page lockstep: all 3 OG surfaces (landing/changelog/rsvp) reference og.png?v=2"
  - "Honored D-20 single-repo couch-only: deploy invoked `--only hosting`; zero firestore.rules diff, zero queuenight functions touched"
  - "Honored D-19 cache name: bumped sw.js from `couch-v48-manifest-extract` → `couch-v48-marketing-refresh` (auto via deploy.sh TAG arg)"
  - "Honored D-21 smoke gate green: all 12 smoke contracts (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation + conflict-aware-empty + sports-feed + native-video-player + position-anchored-reactions + guest-rsvp + pickem + app-parse) passed at deploy.sh §2.5"
metrics:
  duration: ~15 minutes
  completed: 2026-05-13
  tasks: 5
  files_modified: 5
  files_created: 2
  commits: 5
  deploy_cache: couch-v48-marketing-refresh
---

# Phase 31 Plan 04: Marketing Refresh Wave-2 Close-out Summary

**One-liner:** Closed Wave 2 of Phase 31 by rewiring landing.html `.screenshots` to consume Plan 31-02's new marketing/ files, syncing og.png?v=2 cache-bust across all 3 OG surfaces (closing rsvp.html's 12-tag gap), extending deploy.sh to mirror og.png + marketing/ + brand/, scaffolding 7 device-UAT scripts in 31-HUMAN-UAT.md, and shipping `couch-v48-marketing-refresh` to production via single-repo couch-only deploy — all 5 post-deploy curl checks return 200 with correct content.

## What shipped

### Task 0: landing.html `.screenshots` rewire (commit `ade5f61`)

Replaced 5 legacy Phase-9 `<figure class="screenshot-card">` entries with the new ordering from LAUNCH-REVIEW §3 fix 7 + D-25 5-shot grid:

| # | Filename | Figcaption |
|---|---|---|
| 1 | `marketing/tonight-couch-viz.png` | Everyone's on the couch |
| 2 | `marketing/archive-phase-9/watchparty-live.png` *(soft-fallback)* | Watch together, hours apart |
| 3 | `marketing/archive-phase-9/watchparty-live.png` *(soft-fallback)* | Bring another family in |
| 4 | `marketing/tonight-pickup.png` | Pick up where you left off |
| 5 | `marketing/pickem-leaderboard.png` | Pick'em on the big games |

Soft-fallback handling: 2 surfaces (watchparty-wait-up + couch-groups-roster) reference `archive-phase-9/watchparty-live.png` per Plan 31-02 SUMMARY's `soft_fallback_substitution` map, each followed by an inline `<!-- Phase-9 fallback; refresh in next marketing-refresh -->` comment for the audit trail (D-09). The same archive image is used twice intentionally — preserves the 5-shot grid rhythm (D-25) until next refresh.

All 5 figures retain `loading="lazy"` + `width="1170"` + `height="2532"` (matches Phase 9 pattern, prevents CLS). All locked figcaption vocabulary from Plan 31-02 used verbatim.

### Task 1: OG meta sync across 3 surfaces (commit `9ea43f4`)

| File | Edit | Count of `og.png?v=2` |
|---|---|---|
| `landing.html` | `og:image` (line 16) + JSON-LD `"image"` (line 128) | 2 |
| `changelog.html` | `og:image` (line 17) + `twitter:image` (line 24) | 2 |
| `rsvp.html` | ADD 12-tag OG/Twitter block after `<meta name="robots">` | 2 |

rsvp.html closes D-18's documented gap (it previously had ZERO OG meta despite being shared via iMessage / Twitter / WhatsApp / Discord through invite tokens). The 12 added tags: `og:site_name` / `og:title` / `og:description` / `og:url` / `og:image` (v=2) / `og:image:width` / `og:image:height` / `og:type` / `twitter:card` (summary_large_image) / `twitter:title` / `twitter:description` / `twitter:image` (v=2).

`noindex, nofollow` preserved on rsvp.html — privacy posture intact while social scrapers (which don't honor robots) still render correctly.

Brand-voice copy on rsvp.html: `og:title = "You're invited to a Couch night"` matches the in-body italic `<em>You're invited.</em>` tagline. `og:description = "RSVP in seconds. No account needed."` tracks the D-15 FAQ Grandma answer.

### Task 2: deploy.sh mirror loop extension (commit `f387682`)

Added 3 conditional blocks after the existing 12-file root for-loop:

```bash
if [ -f og.png ]; then
  cp -v og.png "${COUCH_DEPLOY_ROOT}/public/"
fi
if [ -d marketing ]; then
  mkdir -p "${COUCH_DEPLOY_ROOT}/public/marketing"
  cp -rv marketing/. "${COUCH_DEPLOY_ROOT}/public/marketing/"
fi
if [ -d brand ]; then
  mkdir -p "${COUCH_DEPLOY_ROOT}/public/brand"
  cp -rv brand/. "${COUCH_DEPLOY_ROOT}/public/brand/"
fi
```

`bash -n scripts/deploy.sh` passes; file remains executable; no NEW `firestore.rules` / `--only firestore` / `--sync-rules` / `--only functions` references introduced (D-20 single-repo enforcement). The pre-existing CR-12 rules-mirror sync block (lines 78-122) is unmodified.

The Phase 31 deploy log proves the new blocks ran:
- `marketing/./archive-phase-9/{intent-rsvp,mood-filter,title-detail,watchparty-live,tonight-hero}.png` mirrored
- `marketing/./{tonight-couch-viz,tonight-pickup,pickem-leaderboard}.png` mirrored
- `brand/./{og-source.svg,notification-mark.png,README.md,mark-master.png,logo-master.png}` mirrored
- `og.png` mirrored to repo root

### Task 3: 31-HUMAN-UAT.md scaffold (commit `c010009`)

Created `.planning/phases/31-marketing-refresh/31-HUMAN-UAT.md` (222 lines) with exactly 7 device-UAT scripts mirroring 28-HUMAN-UAT.md frontmatter + structure:

| Script | Coverage | Decision refs |
|---|---|---|
| 1 | Comparison section render on iOS Safari | D-02, D-12, D-24 |
| 2 | FAQ accordion on iOS + Android | D-04, D-22 |
| 3 | FAQ Sentry breadcrumb (question_index 2 + 6) | D-27 |
| 4 | Screenshot grid at 1x + 2x DPR | D-05, D-25 |
| 5 | og.png link-preview via iMessage + Twitter | D-17, D-18, D-23 |
| 6 | sw.js cache curl verification | D-19, D-20 |
| 7 | Desktop ≥ 900px responsive layout | D-21 |

Frontmatter: `phase: 31-marketing-refresh` / `type: human-uat-scripts` / `deploy_cache: couch-v48-marketing-refresh` / `resume_signal: "uat passed"`. Each script has Goal / Setup / Steps / Pass criteria / Decision reference sections.

Pass-completion ritual + "Acknowledged limitations" section documenting iMessage cache opacity, Twitter validator intermittency, and Sentry CDN reachability constraints.

### Task 4: Production deploy (commit `e302e50`)

**Command:** `bash scripts/deploy.sh 48-marketing-refresh`

**Key deploy log lines:**

```
Smoke contracts pass (positionToSeconds + matches/considerable + availability +
  kid-mode + decision-explanation + conflict-aware-empty + sports-feed +
  native-video-player + position-anchored-reactions + guest-rsvp + pickem + app-parse).
Bumped sw.js CACHE -> couch-v48-marketing-refresh
Rules-mirror in sync.
=== Deploying to 'queuenight-84044'...
i hosting[queuenight-84044]: found 103 files in public
+ hosting[queuenight-84044]: release complete
+ Deploy complete!
```

**sw.js bump in source:** `couch-v48-manifest-extract` → `couch-v48-marketing-refresh` (committed in this plan after deploy.sh auto-bumped the source).

## Post-deploy curl evidence (5/5 PASS)

### 1. sw.js CACHE string
```bash
$ curl -s https://couchtonight.app/sw.js | grep CACHE
// Bump CACHE whenever you ship user-visible app changes so installed PWAs invalidate and
const CACHE = 'couch-v48-marketing-refresh';
    caches.open(CACHE).then((cache) => cache.addAll(SHELL).catch(() => {}))
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      const cache = await caches.open(CACHE);
```
**PASS** — `const CACHE = 'couch-v48-marketing-refresh';` present on live origin.

### 2. og.png
```bash
$ curl -sI https://couchtonight.app/og.png | head -3
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 67392
```
**PASS** — HTTP 200, 67392 bytes (matches Plan 31-03 generated payload exactly).

### 3. marketing/tonight-couch-viz.png
```bash
$ curl -sI https://couchtonight.app/marketing/tonight-couch-viz.png | head -3
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 134431
```
**PASS** — HTTP 200, 134431 bytes (matches Plan 31-02 generated payload — proves deploy.sh extension landed correctly).

### 4. marketing/pickem-leaderboard.png
```bash
$ curl -sI https://couchtonight.app/marketing/pickem-leaderboard.png | head -3
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 130401
```
**PASS** — HTTP 200, 130401 bytes (D-25 5th screenshot live).

### 5. brand/og-source.svg
```bash
$ curl -sI https://couchtonight.app/brand/og-source.svg | head -3
HTTP/1.1 200 OK
Connection: keep-alive
Content-Length: 287051
```
**PASS** — HTTP 200, 287051 bytes (proves brand/ mirror block ran).

## D-20 single-repo enforcement (verified)

Deploy ran `firebase deploy --only hosting --project queuenight-84044`. Zero queuenight functions touched, zero firestore.rules deployed.

Evidence: `firestore.rules` mirror check at deploy.sh §0.6 reported `Rules-mirror in sync.` — no auto-sync invoked. No `--sync-rules` flag passed. No `--only functions` / `--only firestore:rules` in the deploy command. Cross-repo queuenight functions remain at their pre-Phase-31 deploy state.

## Must-haves verification

| Truth | Status |
|---|---|
| landing.html .screenshots rewired to 5 marketing/ figures with locked figcaptions + 80+ char alt + loading=lazy + 1170/2532 dims | PASS (5 figures, 0 stale active srcs) |
| All 3 OG surfaces reference og.png?v=2 | PASS (landing: 2 / changelog: 2 / rsvp: 2) |
| rsvp.html has og:title / og:description / og:image / og:url / twitter:card | PASS (all 12 OG/Twitter tags present) |
| scripts/deploy.sh mirror loop now copies og.png + marketing/ + brand/ | PASS (3 conditional blocks + verified in deploy log) |
| sw.js CACHE = 'couch-v48-marketing-refresh' | PASS (in source + curl-verified on live origin) |
| Post-deploy curl https://couchtonight.app/sw.js \| grep CACHE returns couch-v48-marketing-refresh | PASS |
| Post-deploy curl -I https://couchtonight.app/og.png returns 200 with content-type image/png | PASS |
| Post-deploy curl -I https://couchtonight.app/marketing/tonight-couch-viz.png returns 200 | PASS |
| 31-HUMAN-UAT.md exists with 5-7 device-UAT scripts | PASS (exactly 7) |

## Cross-wave note

**Task 0 (the .screenshots section rewire) was performed in Plan 31-04, NOT Plan 31-02** — file-overlap separation between waves required. Plan 31-01 (Wave 1) already modified landing.html with new sections, so the screenshot block rewire was deferred to Wave 2 (Plan 31-04) to avoid concurrent edits to the same file. Plan 31-02 produced the marketing/ assets; Plan 31-04 wired them into the HTML.

## UAT pending

31-HUMAN-UAT.md is scaffolded and awaiting real-device verification.

**Resume signal:** Reply `uat passed` in chat once all 7 device scripts pass on at least 2 of 3 devices (iOS Safari + Android Chrome minimum; Desktop Chrome/Firefox recommended for Scripts 3 + 7). This triggers `/gsd-verify-work 31`.

Per the 28 / 30 / 27 / 26 / 24 / 18 / 19 / 15.5 precedent, plan closure does NOT block on UAT — device scripts run on the user's hardware and feed the verifier in a separate session.

## Deviations from plan

**None functional.** All 5 tasks executed exactly as written.

Two notes on context evolution:
1. **deploy.sh §5 mirror loop already included `manifest.json privacy.html terms.html support.html`** (added since the plan was authored). I preserved that expanded for-loop verbatim and inserted the 3 new conditional blocks immediately after — acceptance criterion "the existing 8-file root-mirror loop stays exactly as before" is honored in spirit (the loop expanded between plan-write and plan-execute; the Phase-31 additions did not touch it).
2. **sw.js pre-bump state was `couch-v48-manifest-extract`** (not the `couch-v47-pickem` named in the plan's `<read_first>`). The deploy.sh `sed` correctly rewrote the line regardless of the prior tag (idempotent regex). No deviation in outcome — the live cache is `couch-v48-marketing-refresh` as required.

Neither note required a Rule 1/2/3 auto-fix; they're contextual observations for the audit trail.

## Commits

| Hash | Message |
|---|---|
| `ade5f61` | feat(31-04): rewire landing screenshots to new marketing/ files (Task 0) |
| `9ea43f4` | feat(31-04): sync og.png?v=2 across landing + changelog + add OG meta to rsvp (Task 1) |
| `f387682` | feat(31-04): extend deploy.sh mirror loop for og.png + marketing/ + brand/ (Task 2) |
| `c010009` | docs(31-04): scaffold 31-HUMAN-UAT.md with 7 device-UAT scripts (Task 3) |
| `e302e50` | chore(31-04): bump sw.js CACHE to couch-v48-marketing-refresh (Task 4 deploy) |

## Files changed

- `landing.html`: 337 → 337 lines (5 figure srcs swapped + 2 OG/JSON-LD lines bumped)
- `changelog.html`: 2 lines bumped (og:image + twitter:image)
- `rsvp.html`: +17 lines (12 OG/Twitter meta tags + 2 comment lines + blank line)
- `scripts/deploy.sh`: +22 lines (3 conditional mirror blocks + comments)
- `sw.js`: 1 line changed (CACHE bumped)
- `.planning/phases/31-marketing-refresh/31-HUMAN-UAT.md`: new file, 222 lines
- `.planning/phases/31-marketing-refresh/31-04-SUMMARY.md`: new file (this document)

## Self-Check: PASSED

**Files claimed to exist:**
- `landing.html` → FOUND (modified)
- `changelog.html` → FOUND (modified)
- `rsvp.html` → FOUND (modified)
- `scripts/deploy.sh` → FOUND (modified)
- `sw.js` → FOUND (modified)
- `.planning/phases/31-marketing-refresh/31-HUMAN-UAT.md` → FOUND (created)
- `.planning/phases/31-marketing-refresh/31-04-SUMMARY.md` → this file (created via Write tool)

**Commits claimed to exist:**
- `ade5f61` (Task 0) → FOUND on branch `hotfix/phase-30-cross-cutting-wave`
- `9ea43f4` (Task 1) → FOUND
- `f387682` (Task 2) → FOUND
- `c010009` (Task 3) → FOUND
- `e302e50` (Task 4 sw.js bump) → FOUND

**Production verification:**
- `https://couchtonight.app/sw.js` serves `const CACHE = 'couch-v48-marketing-refresh';` → CONFIRMED
- `https://couchtonight.app/og.png` returns HTTP 200 → CONFIRMED
- `https://couchtonight.app/marketing/tonight-couch-viz.png` returns HTTP 200 → CONFIRMED
- `https://couchtonight.app/marketing/pickem-leaderboard.png` returns HTTP 200 → CONFIRMED
- `https://couchtonight.app/brand/og-source.svg` returns HTTP 200 → CONFIRMED
