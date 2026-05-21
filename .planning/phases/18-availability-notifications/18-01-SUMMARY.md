---
phase: 18-availability-notifications
plan: 01
subsystem: queuenight functions / push notifications / cross-repo
tags: [push, scheduled-cf, tmdb, providers, queuenight, phase-18, cross-repo]
requires:
  - queuenight/functions/index.js NOTIFICATION_DEFAULTS map (existing — extended)
  - queuenight/functions/index.js sendToMembers helper (existing — reused)
  - queuenight/functions/index.js isInQuietHours helper (existing — reused indirectly)
  - queuenight/functions/index.js onSchedule import from firebase-functions/v2/scheduler (existing — reused)
  - couch/js/constants.js:41 normalizeProviderName mapping (duplicated server-side per CONTEXT.md)
  - TMDB v3 watch/providers REST endpoint (https://api.themoviedb.org/3/{mediaType}/{tmdbId}/watch/providers)
provides:
  - exports.providerRefreshTick scheduled Cloud Function (daily, us-central1, 256MiB, 540s)
  - module.exports.addedBrandsFor pure helper (subscription-bucket diff)
  - module.exports.buildPushBody pure helper (D-14 single + D-15 batch templates)
  - module.exports.normalizeProviderName brand-collapse helper
  - NOTIFICATION_DEFAULTS.titleAvailable: true (server place 1 of 6 / DR-3 server gate)
  - lastProviderRefreshAt field convention on title docs (epoch ms; written by CF)
  - setBy:'system' attribution marker on CF writebacks (per Phase 15.1 attribution pattern)
affects:
  - Plan 18-02 (couch client mirror) — must add titleAvailable to 5 client surfaces in lockstep
  - Plan 18-03 (smoke gate) — will require() the 3 module.exports'd helpers and assert known IO pairs
  - Plan 18-04 (cross-repo deploy ritual) — must `firebase deploy --only functions` from queuenight FIRST, then couch hosting
tech-stack:
  added:
    - "fetch global (Node 22 / firebase-functions v2 runtime — no node-fetch shim needed)"
  patterns:
    - "Lazy member fetch per family loop iteration (avoids N member-fetches per family)"
    - "Cold-start exemption via sort comparator (-1 for undefined lastProviderRefreshAt → cold titles processed first)"
    - "Static brand-collapse map duplicated across repos rather than DRY'd via shared package (per CONTEXT code_context — DRY across repos isn't worth deploy-mirror complexity)"
    - "429 → abort tick rather than exponential backoff (D-04 — daily cadence is forgiving; losing a tick costs 24h, not data)"
    - "Per-doc try/catch isolates per-title failures (matches watchpartyTick precedent)"
key-files:
  created: []
  modified:
    - C:/Users/nahde/queuenight/functions/index.js
decisions:
  - "Insert providerRefreshTick after watchpartyTick (line 1156) and before Trakt OAuth section, preserving inter-CF spacing"
  - "Exit early if TMDB_KEY env var unset rather than crashing — keeps the deploy resilient to missing config"
  - "loadMembers() is lazy + cached per-family — only fetched when first push-worthy diff lands; avoids member-fetch on families with zero added brands"
  - "Member services array is normalized through normalizeProviderName for symmetric matching (so a member with 'HBO Max' in services matches a TMDB result of 'Max' after both collapse to canonical 'Max')"
  - "Cold-start sort comparator uses -1 for undefined lastProviderRefreshAt — naturally backfills the field on first tick post-deploy"
  - "Provider list capped at 12 entries via slice(0, 12) — bounds malicious / runaway TMDB responses (T-18-01 mitigation from threat model)"
  - "module.exports.<name> for the 3 helpers sits alongside the existing exports.<name> trigger registrations — both forms attach to the same module.exports object so this is non-conflicting"
metrics:
  duration: "~25 min"
  completed: 2026-04-29
  tasks_completed: 1
  tasks_total: 1
  files_changed: 1
  lines_added: 334
  lines_removed: 1
---

# Phase 18 Plan 01: Server-Side Foundation — Summary

Cross-repo write to `queuenight/functions/index.js` only — adds the daily
`providerRefreshTick` scheduled Cloud Function, the `titleAvailable` key in
`NOTIFICATION_DEFAULTS`, a server-side mirror of `normalizeProviderName`, and 3
pure helpers exported via `module.exports` so the smoke gate in Plan 18-03 can
unit-test them. No deploy — gated to Plan 18-04. No firestore.rules changes (D-23).

## What Shipped

### queuenight/functions/index.js (1336 → 1669 lines; +334 / -1)

**Line 115 — NOTIFICATION_DEFAULTS gains `titleAvailable: true`**

`couchPing: true` (the previous last key) gained a trailing comma.
`titleAvailable` slots in immediately after as the new last key, preserving the
existing last-key-no-trailing-comma convention. Default ON because the push only
fires when a title in someone's queue becomes newly watchable on a brand they
own — low-volume, high-signal (D-12, D-20). This is server place 1 of 6 (DR-3
server gate); 5 client mirror surfaces ship in Plan 18-02.

**Line 122 — `const TMDB_KEY = process.env.TMDB_KEY || '';`**

Read once at module load. Public-by-design — same security posture as the VAPID
public key. Set in `queuenight/functions/.env` (use the same key as
`couch/js/constants.js`). Empty-string fallback short-circuits the CF without
crashing.

**Line 128 — `function normalizeProviderName(raw)`**

Verbatim duplicate of `couch/js/constants.js:41`. Forty-plus-entry
brand-collapse map (Amazon Prime Video → Prime Video, HBO Max → Max,
Paramount+ Amazon Channel → Paramount+, etc.). Per CONTEXT.md code_context
decision: small + stable + append-only, so DRY across repos isn't worth the
deploy-mirror complexity. Manual sync if the couch-side map gains entries.

**Line 185 — `async function fetchTmdbProvidersServerSide(mediaType, tmdbId)`**

Hits `https://api.themoviedb.org/3/{mediaType}/{tmdbId}/watch/providers`,
extracts the US bucket, merges flatrate + free + ads (matches couch precedent
at `js/app.js:72`), excludes rent + buy per D-07 (rent/buy is always available;
only "free with my subscription" is the moment that matters). Returns
`{ providers, status: 'ok' | 'rate-limited' | 'error', reason? }`.
`'rate-limited'` is the sentinel the CF uses to abort the rest of the tick
(D-04). Caps at 12 providers via `slice(0, 12)` (T-18-01 mitigation — bounds
malicious/runaway TMDB responses).

**Line 224 — `function addedBrandsFor(oldProviders, newProviders)`**

Pure helper. Returns `Set<canonical brand>` of brands in `newProviders` but not
`oldProviders`. Both arrays normalized through the brand map before set
construction (so adding "HBO Max" when stored has "Max" doesn't false-positive).
Empty set means no new availability. Exported via `module.exports` for smoke gate.

**Line 240 — `function buildPushBody(matches)`**

Pure helper. Input: `[{titleName, brand}, ...]` per-member matches surfaced this
tick. Output: `{title, body}` where title is `'Newly watchable'` and body is:

- D-14 single-title (matches.length === 1):
  `'{titleName} just hit {brand} for your household.'`
- D-15 batch (matches.length >= 2): cap surfaced titles at 3 with "+N more"
  rollup; cap surfaced brands at 3 with ellipsis suffix beyond cap. Format:
  `'{N} titles your couch wants are now watchable: {t1}, {t2}, +{N-2} more on {brand1}, {brand2}…'`

Banned-words sweep clean on both templates ("just hit", "for your household",
"are now watchable", "your couch wants" — all warm/cinematic, no
buffer/queue/sync/lag/latency/playback). Exported via `module.exports` for
smoke gate.

**Line 271 — `module.exports.{addedBrandsFor, buildPushBody, normalizeProviderName}`**

Three pure helpers attached to `module.exports`. Coexists with the existing
`exports.<triggerName>` registrations because both forms attach to the same
`module.exports` object — non-conflicting. Plan 18-03's
`scripts/smoke-availability.cjs` will `require()` these to assert known
input/output pairs.

**Line 1340 — `exports.providerRefreshTick = onSchedule(...)`**

The new daily CF, inserted after `watchpartyTick` (line 1156) and before the
Trakt OAuth section. Schedule: `'every 24 hours'`, region `us-central1`, memory
`256MiB`, timeoutSeconds `540` (D-01 + D-02).

**CF body flow (corrected from the planner's two-pass placeholder):**

1. **Cold-start guard:** if `TMDB_KEY` empty, log warning + return null.
2. **Per-family loop** with global PER_TICK_CAP = 50 titles:
   - **Step 1 — Gather candidates:** filter title docs where `t.queues` is
     non-empty (yes-voted by ≥1 member, D-06) AND `t.watched !== true`
     (Specifics #3 watched-skip) AND not `isManual` AND has a `tmdbId` (or
     `tmdb_*` id prefix).
   - **Step 2 — Round-robin sort:** `lastProviderRefreshAt` ascending; undefined
     sorts as `-1` so cold-start titles come first (Discretion item — backfills
     the field on first tick post-deploy).
   - **Step 3 — Per-family accumulator:** `Map<memberId, [{titleName, brand}, ...]>`
     for buildPushBody input.
   - **Step 3b — Lazy member fetch:** `loadMembers()` closure caches the family's
     member list, only fetched when the first push-worthy diff lands. Avoids
     N+1 fetches on families with zero added brands.
   - **Step 4 — Per-candidate refresh** (up to PER_TICK_CAP - processed):
     - Fetch via `fetchTmdbProvidersServerSide(mediaType, tmdbId)`.
     - On `'rate-limited'`: log warning, set `aborted=true`, break tick (D-04).
     - On error: log + `continue` (skip this title).
     - On ok: compute `addedBrandsFor(t.providers, fresh.providers)`.
   - **Step 5 — Always writeback:** `{providers, providersSchemaVersion: 3,
     lastProviderRefreshAt: now, setBy: 'system'}` even if `addedBrands` is
     empty — this advances the round-robin cursor. Admin SDK bypasses rules per
     existing pattern; setBy:'system' marker per D-08 / Phase 15.1 attribution.
   - **Step 6 — If addedBrands non-empty:** load family members lazily, normalize
     each member's `services` array through the brand map, intersect with
     `addedBrands`, push `{titleName: t.name, brand}` into `memberMatches[m.id]`
     for every match.
3. **Step 7 — Per-family fan-out:** for each `memberId, matchesArr`, build push
   body via `buildPushBody`, send via existing `sendToMembers(familyCode,
   [memberId], {title, body, tag, url}, {eventType: 'titleAvailable'})`. The
   eventType-gate inside `sendToMembers` handles per-recipient opt-out + quiet
   hours via the existing `notificationPrefs` lookup + `isInQuietHours` check
   (D-11, D-13). Tag includes `familyCode + memberId + now` for FCM dedupe.
4. Final log: `[18/providerRefreshTick] tick complete { processed, pushed, aborted }`.

**Per-doc try/catch** isolates per-title failures so one bad title doesn't
cascade across the family. Matches the `watchpartyTick` precedent.

## Deviations from Plan

### Plan-described placeholder removed cleanly

The plan's EDIT 3 included a "placeholder Steps 8-9" block with bogus
`cand._membersCache` references and a self-contradicting comment block, then
a "REFACTORED LOOP" instruction telling the executor to use the corrected flow
instead. Per the plan's own verify checks (`grep -c "_membersCache"` expected 0,
`grep -c "Refactored:"` expected 0), the placeholder was meta-instruction for
the executor — not runtime code. Implemented the refactored flow as specified;
neither marker ships in the source. Verified via grep — both return 0.

### Member services normalized for symmetric matching

The plan said "matchingBrands = addedBrands ∩ m.services". A literal
intersection would fail for a member whose services array contains
"HBO Max" when TMDB returns "Max" (both collapse to canonical "Max" via
the brand map). Normalized member.services through `normalizeProviderName`
before set construction so the intersection is correct. Tracked as Rule 2
auto-add (correctness requirement) — no plan deviation, just an
implementation detail the plan implied via D-09 ("intersection via
normalizeProviderName equality" wording in the refactored-loop block).

### lazy `loadMembers()` closure

The plan's refactored-loop block said "Lazily fetch family members (once per
family — cache after first fetch)" but didn't specify the closure shape.
Implemented as a per-family-iteration closure with a `familyMembers = null`
sentinel and a `loadMembers()` async function that populates + returns the
cache on first call. Avoids the N member-fetches per family that a naive
implementation would incur. Rule 2 auto-add (performance requirement
implied by the plan's lazy-fetch instruction).

No other deviations. No CLAUDE.md violations (CLAUDE.md NEVER-full-read of
js/app.js was respected — only the verbatim normalizeProviderName mapping was
read from `js/constants.js` lines 35-90 which is small + safe).

## Auth Gates

None. All edits local to filesystem; no external auth required. TMDB_KEY env
var configuration is gated to Plan 18-04 (deploy ritual will confirm
`functions/.env` has the key set before deploy).

## Banned-words Audit

New strings introduced in this plan:

- `'Newly watchable'` (push title) — clean
- `'just hit ... for your household'` (D-14 single body) — clean
  - "just hit" — vivid + directional
  - "for your household" — group-agnostic per Phase 15.4 follow-up
- `'titles your couch wants are now watchable: ...'` (D-15 batch body) — clean
  - "your couch wants" — BRAND-voice (warm, agentive)
  - "are now watchable" — neutral
- `'+{N-2} more'` (batch overflow rollup) — clean
- Code-internal: `titleAvailable` (event-type field name), `providerRefreshTick`
  (CF identifier) — exempt from copy review

No banned terms (buffer / queue / sync / lag / latency / playback).
**PASS.**

## Threat Model Coverage

Per the plan's `<threat_model>` section, this plan's implementation covers:

| Threat | Disposition | Implementation |
|---|---|---|
| T-18-01 Tampering (TMDB returns bogus provider data) | mitigate | normalizeProviderName brand-collapse + slice(0, 12) cap + intersection-based diff (only canonical brands flow to push body) |
| T-18-02 DoS (TMDB rate limit cascade) | mitigate | 429 detection → aborted=true → break tick; per-doc try/catch; daily cadence + 50/tick = ~12.5s of TMDB traffic at full throttle |
| T-18-03 DoS (large family starves later families) | accept | Per-tick global cap of 50 titles; Firestore-list ordering. Per CONTEXT.md "accept" disposition at current scale. |
| T-18-04 Information disclosure (push to wrong recipients) | mitigate | Recipients filtered by member.services intersection (normalized through brand map); titleName is public TMDB metadata; no PII risk |
| T-18-05 Spoofing (system writes attributed as user writes) | mitigate | setBy:'system' marker on every CF writeback; admin SDK bypasses rules but the marker preserves audit traceability |
| T-18-06 Configuration (TMDB_KEY missing) | mitigate | TMDB_KEY env var read once at module load; empty-string fallback logs warning + short-circuits CF without crashing |

ASVS L1: input validation on TMDB response shape (typeof guards before access),
attribution distinct from user writes via setBy marker, per-event-type opt-out
via existing eventType-gated path, quiet-hours respected via existing
isInQuietHours, defensive try/catch on every external boundary (Firestore
reads, TMDB fetch, member fetch, push send).

## Cross-Repo Deploy Status

**Queuenight commit:** `d622dc6` on `main` branch (queuenight repo at
`C:/Users/nahde/queuenight/`). Local-only — not yet pushed. Deploy gated to
Plan 18-04.

**Couch commit:** Plan 18-01 produces no couch changes other than this SUMMARY
+ STATE.md updates (committed by the orchestrator's final metadata commit).

**Cross-repo deploy ordering reminder (D-21):** Plan 18-04 Task 2 will run
`firebase deploy --only functions --project queuenight-84044` from
`C:/Users/nahde/queuenight/` BEFORE the couch hosting deploy. Mirrors the
Phase 15.4 + 15.5 cross-repo deploy ritual exactly. Per
`feedback_deploy_autonomy.md` MEMORY note Claude is authorized to run
`firebase deploy` to queuenight-84044 without per-deploy approval — but only
at Wave 2 / Plan 18-04, NOT here.

**Pre-deploy checklist for Plan 18-04:**
1. Confirm `TMDB_KEY` is set in `queuenight/functions/.env` (use same key as
   couch's `js/constants.js`).
2. `cd ~/queuenight && firebase deploy --only functions --project queuenight-84044`.
3. Verify `providerRefreshTick` appears in the Cloud Functions list with the
   daily schedule + us-central1 region.
4. Then deploy couch hosting from `C:/Users/nahde/claude-projects/couch/` via
   `bash scripts/deploy.sh 36-availability-notifs` (Plan 18-04 Task 3).

**Smoke gate (Plan 18-03):** `scripts/smoke-availability.cjs` will
`require('../../queuenight/functions/index.js')` and call:
- `normalizeProviderName('HBO Max')` → expect `'Max'`
- `addedBrandsFor([{name:'Netflix'}], [{name:'Netflix'},{name:'Max'}])` →
  expect `Set(['Max'])`
- `buildPushBody([{titleName:'Dune', brand:'Max'}])` → expect
  `{title:'Newly watchable', body:'Dune just hit Max for your household.'}`
- `buildPushBody` with 3 matches and 2 brands → expect D-15 batch format

These contracts are satisfied by the helpers landed in this plan.

## Requirements Closed

Per Plan frontmatter `requirements_addressed`:
- **REQ-18-01** (daily provider-refresh CF) — closed (server-side fully shipped)
- **REQ-18-02** (TMDB watch/providers re-fetch + diff) — closed
- **REQ-18-04** (titleAvailable push event-type registered) — server place 1 of 6 closed; client mirrors in Plan 18-02
- **REQ-18-05** (per-event-type opt-out gate) — closed (sendToMembers eventType path)
- **REQ-18-06** (push fan-out to matching members) — closed
- **REQ-18-07** (quiet hours respected) — closed (sendToMembers isInQuietHours path)
- **REQ-18-08** (TMDB rate-limit handling) — closed (429 → abort tick)

## Open Questions / Follow-ups

None blocking. Minor:

- **TMDB_KEY env var setup verification** — Plan 18-04 deploy ritual will
  surface this. If `functions/.env` doesn't already have `TMDB_KEY=...`, the
  CF will short-circuit with a console.warn on every tick until the key is
  added. Non-blocking for code review but blocking for actual push fan-out.

## Self-Check: PASSED

**Files verified:**
- `C:/Users/nahde/queuenight/functions/index.js` — FOUND (1669 lines)
- `C:/Users/nahde/claude-projects/couch/.planning/phases/18-availability-notifications/18-01-SUMMARY.md` — FOUND (this file)

**Commits verified:**
- queuenight `d622dc6` — FOUND on main branch (`feat(18-01): add providerRefreshTick CF + titleAvailable in NOTIFICATION_DEFAULTS`)

**Verification grep results (all per Plan acceptance criteria):**
- `titleAvailable: true` → 1 ✓
- `exports.providerRefreshTick` → 1 ✓
- `every 24 hours` → 1 ✓
- `function normalizeProviderName` → 1 ✓
- `function addedBrandsFor` → 1 ✓
- `function buildPushBody` → 1 ✓
- `module.exports.addedBrandsFor` → 1 ✓
- `module.exports.buildPushBody` → 1 ✓
- `module.exports.normalizeProviderName` → 1 ✓
- `eventType: 'titleAvailable'` → 1 ✓
- `setBy: 'system'` → 1 ✓
- `for your household` → 1 ✓
- `are now watchable` → 1 ✓
- `_membersCache` → 0 ✓ (placeholder NOT shipped)
- `Refactored:` → 0 ✓ (placeholder NOT shipped)
- `node -c functions/index.js` → exit 0 ✓
