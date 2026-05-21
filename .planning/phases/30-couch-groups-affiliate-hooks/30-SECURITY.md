---
phase: 30
slug: couch-groups-affiliate-hooks
status: verified
threats_open: 0
asvs_level: 2
created: 2026-05-03
---

# Phase 30 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Audit run via `/gsd-secure-phase 30` after phase code-complete + production deploy.
> 20 STRIDE threats declared across 5 plans; all dispositioned and verified.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Untrusted client → addFamilyToWp CF | Family code + wpId arrive from untrusted client; CF must validate format, family existence, and host-only authorization | Family code (4-char string), wpId (UUID), uid (auth context) |
| Untrusted client → Firestore rules /watchparties/{wpId} | Cross-family read attempts arrive without server mediation; rules predicate is the gate | Watchparty doc (memberUids, families, crossFamilyMembers, currentTime fields, hostUid) |
| Cross-family member subcollection → CF (admin-SDK) | Admin SDK bypasses isMemberOfFamily(foreignCode) — only the CF (not direct client) can read the foreign family's members | Member display names, colors, avatars, memberIds |
| Pre-Phase-30 nested wps → rsvpSubmit → guest RSVP flow | The rsvpSubmit branch decision (top-level vs nested) is the trust boundary that preserves Phase 27 behavior post-migration | Guest RSVP token (UUID), guest doc payload |
| Untrusted snapshot data → client render | wp.crossFamilyMembers comes from CF-stamped data (admin-SDK trust); render still escapeHtml all user-derived strings (defense-in-depth XSS guard) | Display strings rendered via .innerHTML |
| Subscription query → Firestore rules predicate | Client query MUST include `where memberUids array-contains uid` to align with rules; otherwise Firestore rejects entire query | Subscription filter |
| Source-tree sw.js → production sw.js | Deploy script is the trust boundary; CACHE bump must propagate or installed PWAs continue serving v40 cached shell | sw.js CACHE constant |
| wpMigrate invocation → wp doc backfill | Optional admin-callable; runs as the calling user's signed-in admin client; CF bypasses rules via admin-SDK; idempotent on re-run | Pre-Phase-30 nested wps copied to top-level with memberUids stamped |

---

## Threat Register

ID prefix `Pxx-` indicates the source plan (e.g., `P02-T-30-01` = declared in Plan 30-02). Plans use overlapping numeric IDs (planning numbering defect noted) — composite key `{plan}-{threat_id}` keeps them distinct.

| Threat ID | Category | Component | Disposition | Mitigation | Status |
|-----------|----------|-----------|-------------|------------|--------|
| P01-T-30-01 | Tampering | firestore.indexes.json | accept | Source file in sibling repo with no live deploy in Plan 01; Plan 02 owns deploy boundary | closed |
| P01-T-30-02 | Information Disclosure | REQUIREMENTS.md / ROADMAP.md edits | accept | Public-by-design GSD planning artifacts; no secrets introduced | closed |
| P01-T-30-03 | Denial of Service | composite index NOT YET BUILT | mitigate | Plan 02 deploys + verifies BUILT via `firebase firestore:indexes`. Verified: queuenight/firestore.indexes.json:11-18 declares COLLECTION_GROUP `memberUids array-contains` + `startAt DESCENDING`; Plan 02 SUMMARY confirms index status `[READY]` post-deploy | closed |
| P02-T-30-01 | Spoofing | addFamilyToWp CF | mitigate | Host-only check: `addFamilyToWp.js:46` — `if (!wpDoc.exists \|\| wpDoc.data().hostUid !== request.auth.uid) throw HttpsError('permission-denied', 'Host only.')`. Auth precondition at `:27`. | closed |
| P02-T-30-02 | Tampering | firestore.rules /watchparties/{wpId} | mitigate | Path B denylist `firestore.rules:158-163` includes `families`, `memberUids`. Rules tests `tests/rules.test.js` `#30-03` and `#30-04` use `assertFails` on non-host writes to those fields. 56→57 passing. | closed |
| P02-T-30-03 | Spoofing / Info Disclosure | addFamilyToWp CF (enum guard) | mitigate | CF returns identical `'No family with that code.'` error for malformed (`addFamilyToWp.js:35`) and nonexistent (`:41`) cases. Not-host returns `'Host only.'` (different signal, but signed-in non-host already knows they aren't host of a wp they're trying to admin — different CIA surface than family-code enumeration). | closed |
| P02-T-30-04 | Denial of Service | wp doc size + memberUids fan-out | mitigate | Hard ceiling at `addFamilyToWp.js:59-61` — `if (currentFamilies.length >= 8) throw HttpsError('resource-exhausted', 'No more room on this couch tonight.')`. Idempotency early-return placed before cap so re-adds don't trip it. | closed |
| P02-T-30-05 | Denial of Service | rsvpSubmit guest RSVP regression | mitigate | Top-level wp lookup at `rsvpSubmit.js:101-128` runs first; legacy nested family-scan at `:117-127` fallback. Smoke `smoke-guest-rsvp 47/0` preserved (Plan 03 SUMMARY); rules-tests Phase 27 block still passes. | closed |
| P03-T-30-06 | Information Disclosure | cross-family chip render | mitigate | All five user-derived fields wrapped in `escapeHtml()` at `js/app.js:12683-12692` — `displayName`, `data-member-id`, `style:background`, avatar initial, `familyDisplayName`. | closed |
| P03-T-30-07 | Spoofing | crossFamilyMembers attribution | mitigate | **Closed via remediation** during this audit run. Initial verification 2026-05-03 found `crossFamilyMembers` MISSING from Path B denylist despite planner's declaration. Fix applied: `firestore.rules:158-163` (couch a633e98) + queuenight mirror (9c7565a) now lists `'crossFamilyMembers'`. New rules-test `#30-05` at `tests/rules.test.js:1029-1036` asserts non-host writes are denied (0aef0f4). Rules tests 57/0. Rules deployed LIVE to queuenight-84044 2026-05-03. | closed |
| P03-T-30-08 | Denial of Service | collectionGroup query missing index | mitigate | Plan 02 BLOCKING gate confirmed index BUILT before Plan 03 shipped. Subscription at `js/app.js:4900-4905` uses `query(collectionGroup(db, 'watchparties'), where('memberUids', 'array-contains', state.auth.uid))`. Imports verified in `js/firebase.js:2,27`. | closed |
| P03-T-30-09 | Tampering | false-positive collision suffix on within-family same-name | mitigate | `js/app.js:12668-12681` — `hasCrossFamilyCollision` only triggered when `(collisionMap[norm] > 1)` AND collision spans different `familyCode`. Within-family same-name passes through suffix-free. Smoke sentinel `scripts/smoke-couch-groups.cjs:123` asserts the literal `'different familyCode'` substring. | closed |
| P04-T-30-10 | Information Disclosure | family-code enumeration via UI | mitigate | Error matrix at `js/app.js:11447-11461` maps CF error codes to neutral copy: `not-found` → `'No family with that code. Double-check the spelling.'`, `permission-denied` → host-only copy, `resource-exhausted` → cap copy, `failed-precondition` → W4 zero-member toast, `unauthenticated` → 'Sign in...'. Server-side neutral string preserved at `addFamilyToWp.js:35,41`. | closed |
| P04-T-30-11 | Tampering | non-host Remove this couch via DOM tampering | mitigate | Three layers: (a) render-time gate `js/app.js:11389-11392` `if (!isHost) section.classList.add('non-host-view'); return;` skips handler binding; (b) lobby template-omits the entire section for non-hosts via `${isHost ? ... : ''}` ternary; (c) Path B denylist on `families` (`firestore.rules:158-163`) blocks any non-host write attempt server-side. | closed |
| P04-T-30-12 | Denial of Service | spam clicks on Bring them in | mitigate | `js/app.js:11423-11424` — `submitBtn.disabled = true; input.disabled = true` at "validating" state entry; reset only in `finally` at `:11463-11466`. CF idempotency guard at `addFamilyToWp.js:51-56` early-returns `{ ok: true, alreadyAdded: true }` for duplicate familyCode — duplicate calls become safe no-ops. | closed |
| P04-T-30-13 | Cross-Site Scripting | family display name rendered without escape | mitigate | All user-derived strings in `renderAddFamilySection` at `js/app.js:11370-11381` wrapped in `escapeHtml()`: `ownCode`, `ownDisplayName`, `code`, `fdn`. `.innerHTML` assignments at `:11366,11340,11346,11353,11384` use only escaped/literal content. | closed |
| P04-T-30-14a | Information Disclosure | residual read access after Remove this couch (W5) | accept | v1 trade-off: removed family's UIDs remain in `wp.memberUids[]` until natural 25h `WP_ARCHIVE_MS` archive. UI hides immediately; rule gate stays open. Inline acknowledgment comment at `js/app.js:11479-11483`. UAT-30-11 in 30-HUMAN-UAT.md verifies this known v1 limitation. Mitigation deferred to Phase 30.x if usage signal warrants. | closed |
| P05-T-30-14b | Tampering | sw.js CACHE bump skipped | mitigate | `sw.js:8` declares `const CACHE = 'couch-v41-couch-groups';`. Plan 05 SUMMARY confirms `curl -s https://couchtonight.app/sw.js \| grep "const CACHE"` returns the same string (curl-verified 2026-05-03T22:08Z). | closed |
| P05-T-30-15 | Information Disclosure | wpMigrate exposes wp data | accept | Migration writes top-level wp docs gated by Plan 02 rules (`request.auth.uid in resource.data.memberUids`). Migration itself doesn't surface data beyond what calling user already had access to (their own family's wps). wpMigrate exported at `queuenight/functions/index.js:1640` (LIVE us-central1). | closed |
| P05-T-30-16 | Denial of Service | production deploy fails mid-flight | mitigate | `scripts/deploy.sh:55-67` dirty-tree abort with `--allow-dirty` escape hatch; `:178-179` sw.js CACHE bump conditional on `grep -q` so re-run with same tag is no-op. `firebase deploy --only hosting` itself idempotent. Rollback via `firebase hosting:rollback` documented in RUNBOOK §H. | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-30-01 | P01-T-30-01 | Source-tree firestore.indexes.json edit in Plan 01 has no live deploy boundary; Plan 02 owns the deploy. Tampering surface is closed by Plan 02's verified deploy. | nahderz | 2026-05-03 |
| R-30-02 | P01-T-30-02 | ROADMAP.md and REQUIREMENTS.md are public-by-design GSD planning artifacts. The phase requirement IDs reveal nothing not already in 30-CONTEXT.md (committed earlier). No secrets introduced. | nahderz | 2026-05-03 |
| R-30-03 | P04-T-30-14a | After "Remove this couch" host-direct write removes family from `wp.families[]` and `wp.crossFamilyMembers[]`, the removed members' UIDs remain in `wp.memberUids[]` until natural 25-hour `WP_ARCHIVE_MS` archive. UI hides immediately, but `request.auth.uid in resource.data.memberUids` rule stays open for the residual window. v1 acceptable because: (1) cross-family watchparties are explicit invites, removal is rare; (2) residual access expires naturally within a day; (3) implementing transactional UID prune adds complexity that hasn't earned its keep at v1 usage. UAT-30-11 documents and verifies the limitation. | nahderz | 2026-05-03 |
| R-30-04 | P05-T-30-15 | wpMigrate writes top-level wp docs that are then gated by the same Path A/B rules as live wps. Migration runs as the calling admin's signed-in client and only operates on data the user already has read access to (their own family's wps). Admin-SDK bypass is unavoidable for cross-family backfill; the post-migration wp docs are no more exposed than any wp the user creates today. | nahderz | 2026-05-03 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-05-03 (initial) | 20 | 19 (15 verified mitigate + 4 accepted) | 1 (P03-T-30-07) | gsd-security-auditor (sonnet) |
| 2026-05-03 (post-fix) | 20 | 20 | 0 | Claude Opus 4.7 (1M context) — manual verification + 57/0 rules-tests + LIVE deploy to queuenight-84044 |

### Initial audit findings (2026-05-03)

Auditor verified 15/16 mitigate threats CLOSED with concrete file:line evidence (see Threat Register column "Mitigation"). The lone OPEN finding was P03-T-30-07: planner declared `crossFamilyMembers` was in the Path B denylist but the actual rules text at `firestore.rules:158-163` only listed `families` and `memberUids`. A non-host who passed the read gate could issue a Path B `update({ crossFamilyMembers: [...] })` and the `hasAny([...])` check would return false, permitting the spoofing write.

### Remediation (2026-05-03)

Three commits closed P03-T-30-07:

| Commit | Repo | Change |
|--------|------|--------|
| `a633e98` | couch | `firestore.rules` Path B denylist appended `'crossFamilyMembers'` |
| `0aef0f4` | couch | `tests/rules.test.js` added `#30-05 non-host cannot write wp.crossFamilyMembers -> DENIED` (`assertFails` on Path B update spoofing memberId/name/familyCode) |
| `9c7565a` | queuenight | mirrored `firestore.rules` Path B denylist update |

Rules tests result post-fix: **57 passing, 0 failing** (52 baseline + 4 prior Phase 30 + 1 new `#30-05`). Rules deployed LIVE to queuenight-84044 via `firebase deploy --only firestore:rules` (release confirmation: "released rules firestore.rules to cloud.firestore" 2026-05-03).

### Planner-vs-implementation drift note

Plan 03 PLAN line 537 declared P03-T-30-07's mitigation as "Already covered by P02-T-30-02 (Path B denylist)" — but Plan 02's denylist did NOT include `crossFamilyMembers`. This was a documented-but-not-built gap that smoke tests missed (smoke contracts don't exercise rules denylists). Future planners should explicitly add new fields to the denylist enumeration in their own plan rather than relying on a sibling plan to have done it. The existence of this audit trail entry is the structural mechanism that prevents recurrence — `/gsd-secure-phase {N}` after every phase exercises the verification loop that catches this class of drift.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-05-03
