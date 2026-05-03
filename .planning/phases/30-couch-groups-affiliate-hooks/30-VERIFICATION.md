---
phase: 30-couch-groups-affiliate-hooks
verified: 2026-05-03T22:30:00Z
status: human_needed
score: 8/8 must-haves verified at code level
overrides_applied: 0
human_verification:
  - test: "Cross-family invite happy path (Script 1)"
    expected: "Family A host invites Family B; on Family B's device the wp banner appears in Tonight tab subscription within ~5s; opening the wp shows Family A members with real names + avatars (D-06 full identity)"
    why_human: "Requires two physical devices on different family accounts (iPhone Safari PWA + Android Chrome) signed into Family A and Family B; verifies real-time Firestore propagation across cross-family subscription"
  - test: "Soft-cap warning at 5+ families (Script 2)"
    expected: "After 5th family added, sub-line copy changes to 'That's a big couch — are you sure?' in --warn color; input row + Bring them in button still active"
    why_human: "Requires creating 4+ test family accounts (Family B/C/D/E codes) with members; visual color/copy assertion on real device"
  - test: "Hard-cap rejection at 8 families (Script 3)"
    expected: "After 8th family, input row + Bring them in button + per-row kebabs HIDE; sub-line shows 'This couch is full for tonight.'; over-cap CF call surfaces toast 'No more room on this couch tonight.'"
    why_human: "Requires 7 additional test family accounts; visual assertion on real device"
  - test: "Cross-family name collision suffix (Script 4)"
    expected: "Family A's Sam renders as plain 'Sam'; Family B's Sam renders as 'Sam (Smiths)'; Family C's Sam renders as 'Sam (Joneses)'; suffix span uses class 'family-suffix' (NOT <em>) per UI-SPEC accessibility note"
    why_human: "Requires multiple test family accounts with same first name on members; visual + DOM inspection on real device"
  - test: "Within-family same-name does NOT trigger suffix (Script 5; Pitfall 6 negative test)"
    expected: "Family A with two members both named Sam, host creates wp without inviting other family; both Sam chips render plain (no (FamilyName) suffix)"
    why_human: "Requires Family A test account with duplicate-named members; visual assertion on real device that Pitfall 6 same-family suppression branch fires correctly"
  - test: "Host-only invite gate (Script 6)"
    expected: "Non-host Family A member opens a wp where they are NOT host; .wp-couches-list IS visible (D-06 transparency); input row + Bring them in button + per-row kebabs HIDDEN; defensive bypass via DevTools triggers CF permission-denied toast"
    why_human: "Requires Family A member account that is not the wp host; visual gate verification + optional DevTools defensive test on real device"
  - test: "Cross-family read denied for stranger (Script 7)"
    expected: "Family X stranger (NOT in memberUids) opens Tonight tab; cross-family wp banner does NOT appear; direct doc read attempt returns FirebaseError: Missing or insufficient permissions"
    why_human: "Requires Family X test account that is NOT invited to the wp; verifies live firestore.rules predicate at production layer"
  - test: "Guest RSVP works for top-level wp (Script 8; Pitfall 5 mitigation)"
    expected: "Fresh post-Phase-30 wp's /rsvp/<token> link loads RSVP form (NOT expired error); Going+name+submit works; wp.guests[] gets the entry; guest chip with apricot pill appears on host roster"
    why_human: "Requires incognito browser RSVP submission flow + verification on host device that wp.guests[] update propagated correctly through the new top-level + Pitfall 5 fix branch"
  - test: "Cache bump activation (Script 9)"
    expected: "On a device that had the app cached pre-deploy at v40: re-open PWA, verify active SW source contains 'couch-v41-couch-groups'; old couch-v40-sports-feed-fix cache purged; .wp-add-family-section appears in wp-create modal"
    why_human: "Requires a device that previously had the app installed/cached BEFORE the deploy; iOS Safari requires hard relaunch via app-switcher swipe to fully activate new SW; visual + DevTools verification"
  - test: "Existing wp regression check (Script 10; GROUP-30-08)"
    expected: "Pre-Phase-30 wp opens and renders without error; cross-family chip block is empty (Array.isArray short-circuits); Phase 27 guest chips with (guest) suffix still render"
    why_human: "Requires an existing pre-Phase-30 wp doc in production that lacks crossFamilyMembers/families/memberUids fields; verifies defensive Array.isArray short-circuit on real device"
  - test: "Residual read access post-Remove this couch (Script 11; T-30-14 ACCEPT v1)"
    expected: "Host clicks Remove this couch on Family B; UI hides Family B from .wp-couches-list AND .crossFamilyMembers roster IMMEDIATELY on Device 1; toast 'Removed the {FamilyName} couch.' at --good; Device 2 (Family B member) STILL has read access to wp doc until natural 25h archive — verifies v1 known limitation surfaces as documented (NOT a bug)"
    why_human: "Requires two physical devices and waiting/observing the deliberate v1 trade-off (memberUids residue) on the second device; documents that the limitation matches T-30-14 ACCEPT disposition rather than being mistaken for a bug"
---

# Phase 30: Couch Groups Verification Report

**Phase Goal:** Per ROADMAP.md, deliver Couch Groups — multi-family watchparties via top-level `/watchparties/{wpId}` collection with `memberUids` gate, "Bring another couch in" UI affordance, name-collision disambiguation across families, soft-cap@5 / hard-cap@8 family limits, host-only remove flow, and production-ready deploy. Affiliate hooks were CARVED OUT to a future Phase 30.1 per CONTEXT D-03 — this phase is groups-only.

**Verified:** 2026-05-03T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                                                                                                                                                                          | Status     | Evidence                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Watchparties live at top-level `/watchparties/{wpId}` with memberUids[] read gate via firestore.rules                                                                                                                                          | ✓ VERIFIED | `match /watchparties/{wpId}` block present in firestore.rules (count=2: legacy nested + new top-level); `request.auth.uid in resource.data.memberUids` predicate present (count=2 — covers both create+read paths) |
| 2   | Client subscription uses collectionGroup query gated by memberUids array-contains                                                                                                                                                              | ✓ VERIFIED | `collectionGroup(db, 'watchparties')` count=1 in js/app.js; `where('memberUids', 'array-contains', state.auth.uid)` count=1; firebase.js exports collectionGroup + where (count=2 each: import + export) |
| 3   | Wp-create paths stamp hostFamilyCode + families + memberUids + crossFamilyMembers (host self-read works)                                                                                                                                       | ✓ VERIFIED | `hostFamilyCode: state.familyCode` count=4 in js/app.js (3 wp-create paths + 1 reference); `crossFamilyMembers: []` count=4; `memberUids:` count=3 |
| 4   | "Bring another couch in" UI affordance live on BOTH wp-create modal AND wp-edit lobby (B2 fix); host-gated; soft-cap warn at >=5 families, hard-cap hide at >=8                                                                                | ✓ VERIFIED | renderAddFamilySection function decl=1; invocations at modal open + snapshot callback + lobby (3 sites); `wp-add-family-section-lobby` lobby DOM hook present; `familyCount >= 5` (B1 soft-cap) and `familyCount >= 8` (hard-cap) both present in js/app.js |
| 5   | Cross-family roster renders with full identity (D-06): real names + avatars + colors via crossFamilyChips with Pitfall 6-correct collision suffix                                                                                              | ✓ VERIFIED | `function buildNameCollisionMap(wp)` decl=1; `crossFamilyChips` count=2 (declaration + return-statement interpolation); `data-member-id` hook + `family-suffix` span class present |
| 6   | Cross-repo CFs deployed: addFamilyToWp (host-only with idempotency + hard-cap-8 + W4 zero-member guard) + wpMigrate (one-shot collectionGroup-scan + bulkWriter-copy with idempotency) + rsvpSubmit Pitfall 5 fix (B3-gated top-level lookup) | ✓ VERIFIED | All 3 source files exist in queuenight; addFamilyToWp.js contains looksLikeFamilyCode, hostUid auth check, currentFamilies.includes idempotency, length>=8 hard cap, failed-precondition zero-member guard, FieldValue.arrayUnion fan-out; rsvpSubmit.js contains topLevelDoc + Pitfall 5 comment + B3 hostFamilyCode-gated branch + Fallback nested scan |
| 7   | Host-only Remove this couch flow (Path A direct write); T-30-14 v1 known limitation (memberUids residue) documented inline + UAT-30-11                                                                                                          | ✓ VERIFIED | onClickRemoveCouch function decl=1; "Their crew will lose access to this watchparty" confirm modal copy present; T-30-14 cross-references in 30-HUMAN-UAT.md count=5; "Residual read access" in Script 11 |
| 8   | Production deploy verified live: couchtonight.app serves CACHE = couch-v41-couch-groups; Phase 30 UI surfaces (DOM hooks, JS exports, CSS) all served from production                                                                          | ✓ VERIFIED | `curl https://couchtonight.app/sw.js` returns `const CACHE = 'couch-v41-couch-groups';`; production app.html contains wp-add-family-section; production firebase.js contains collectionGroup; production css/app.css contains Phase 30 marker + .family-suffix |

**Score:** 8/8 truths verified at code level

### Required Artifacts

| Artifact                                                       | Expected                                                                                              | Status     | Details                                                                                                                                                                                       |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `js/firebase.js`                                               | Imports + re-exports collectionGroup + where                                                          | ✓ VERIFIED | Both terms present in import + export lines; CDN URL unchanged                                                                                                                                |
| `js/app.js`                                                    | Subscription rewrite + watchpartyRef retarget + 3 wp-create stamps + buildNameCollisionMap + renderAddFamilySection + onClickAddFamily + onClickRemoveCouch | ✓ VERIFIED | All functions present; 3 invocation sites for renderAddFamilySection; lobby DOM hook injection; collectionGroup subscription with Pitfall 2 alignment filter; auth guard + qnLog error handler |
| `app.html`                                                     | #wp-add-family-section DOM hook in #wp-start-modal-bg with locked UI-SPEC copy                        | ✓ VERIFIED | Section block with heading, sub-line, input, submit, help-line all present                                                                                                                    |
| `css/app.css`                                                  | ~190 lines of .wp-add-family-* + .wp-couches-* + .family-suffix selectors using existing semantic tokens | ✓ VERIFIED | Phase 30 — Couch groups marker present; .wp-add-family-section + .family-suffix selectors present; mobile breakpoint @599px present                                                          |
| `firestore.rules`                                              | New top-level /watchparties/{wpId} block (memberUids read gate + Path A/B write split + denylist)     | ✓ VERIFIED | 2 match blocks (legacy nested + new top-level); memberUids read predicate present; 'families', 'memberUids' Path B denylist additions present                                                 |
| `tests/rules.test.js`                                          | Phase 30 describe block ACTIVE with 4 real assertSucceeds/assertFails (#30-01..04)                    | ✓ VERIFIED | Phase 30 Couch Groups rules describe present (count=2); wp_phase30_test seed line present (count=5); 4 #30-0[1-4] declarations present                                                       |
| `queuenight/functions/src/addFamilyToWp.js`                    | Host-only callable CF with all STRIDE mitigations + W4 zero-member guard                              | ✓ VERIFIED | All 5 STRIDE mitigations + W4 failed-precondition guard present in source                                                                                                                     |
| `queuenight/functions/src/wpMigrate.js`                        | One-shot callable CF with collectionGroup-scan + bulkWriter + idempotency                             | ✓ VERIFIED | File exists; per Plan 02 SUMMARY confirmed deployed live in queuenight-84044 us-central1                                                                                                      |
| `queuenight/functions/src/rsvpSubmit.js`                       | Pitfall 5 fix: B3-gated top-level lookup BEFORE legacy nested scan                                    | ✓ VERIFIED | Pitfall 5 comment + topLevelDoc.exists + hostFamilyCode-gated branch + Fallback nested scan all present                                                                                       |
| `queuenight/firestore.indexes.json`                            | COLLECTION_GROUP composite index for watchparties.memberUids array-contains + startAt DESCENDING       | ✓ VERIFIED | Entry present with COLLECTION_GROUP queryScope + memberUids CONTAINS arrayConfig                                                                                                              |
| `queuenight/functions/index.js`                                | Exports addFamilyToWp + wpMigrate                                                                     | ✓ VERIFIED | Both exports present                                                                                                                                                                          |
| `scripts/smoke-couch-groups.cjs`                               | 53 assertions (4 helper + 48 production-code + 1 floor); FLOOR=16                                     | ✓ VERIFIED | npm run smoke:couch-groups exits 0 with `53 passed, 0 failed`; floor met (48 >= 16)                                                                                                          |
| `sw.js`                                                        | CACHE bumped to couch-v41-couch-groups                                                                 | ✓ VERIFIED | Source-tree + production both serve `const CACHE = 'couch-v41-couch-groups';`                                                                                                                 |
| `.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md` | 11 device-UAT scripts (10 baseline + W5 follow-on Script 11)                                          | ✓ VERIFIED | 11 ### Script headings; 352 lines; T-30-14 cross-refs present; couch-v41-couch-groups in Script 9                                                                                            |

### Key Link Verification

| From                                                          | To                                                       | Via                                                                              | Status     | Details                                                                                                                                            |
| ------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| js/app.js subscription                                         | Firestore /watchparties top-level                        | `collectionGroup(db, 'watchparties').where('memberUids','array-contains',uid)`   | ✓ WIRED    | Subscription block at line 4889 area uses the canonical RESEARCH Pattern 1 query; Pitfall 2 alignment filter present                              |
| js/app.js renderParticipantTimerStrip                         | wp.crossFamilyMembers[]                                  | crossFamilyChips append after guestChips                                         | ✓ WIRED    | Return statement interpolates `${crossFamilyChips}` after `${guestChips}` per RESEARCH Pattern 3                                                  |
| js/app.js buildNameCollisionMap                               | wp.participants + wp.crossFamilyMembers                  | Two-pass lowercased name-counter; consumer applies Pitfall 6 disambiguation       | ✓ WIRED    | Helper builds counts; chip-render branch checks participants OR crossFamilyMembers from DIFFERENT familyCode for collision (Pitfall 6 nuance)    |
| Bring them in submit button                                    | addFamilyToWp callable CF in queuenight                  | `httpsCallable(functions, 'addFamilyToWp')({wpId, familyCode})`                  | ✓ WIRED    | onClickAddFamily wires httpsCallable with full UI-SPEC error matrix                                                                                |
| .wp-add-family-section render                                 | host-only gate                                           | `state.me.id === wp.hostId` predicate                                            | ✓ WIRED    | Render gate at template-level for lobby (omits section entirely for non-hosts) + at handler-bind level for wp-create modal                         |
| addFamilyToWp CF                                               | /watchparties/{wpId} doc                                 | admin-SDK FieldValue.arrayUnion fan-out (families + memberUids + crossFamilyMembers) | ✓ WIRED    | All 3 atomic updates present in CF source                                                                                                          |
| firestore.rules /watchparties/{wpId}                          | wp.memberUids[] field                                    | `request.auth.uid in resource.data.memberUids` (read + create + update gates)    | ✓ WIRED    | Predicate present for all 3 rule branches                                                                                                          |
| rsvpSubmit.js                                                  | /watchparties/{token} top-level doc (Pitfall 5 fix)     | B3-gated top-level lookup BEFORE legacy nested scan                              | ✓ WIRED    | Pitfall 5 fix branch present; falls through to legacy nested scan when top-level missing OR when hostFamilyCode missing                            |

### Data-Flow Trace (Level 4)

| Artifact                       | Data Variable          | Source                                                                                       | Produces Real Data | Status     |
| ------------------------------ | ---------------------- | -------------------------------------------------------------------------------------------- | ------------------ | ---------- |
| renderParticipantTimerStrip    | wp.crossFamilyMembers  | Stamped at create (empty `[]`); appended by addFamilyToWp CF on host-invite via FieldValue.arrayUnion | Yes (live CF write) | ✓ FLOWING  |
| renderAddFamilySection (lobby) | wp.families            | Stamped at create as `[hostFamilyCode]`; appended by addFamilyToWp CF                        | Yes                | ✓ FLOWING  |
| state.watchparties             | onSnapshot result      | collectionGroup(watchparties).where(memberUids array-contains uid) — production index BUILT | Yes (live snapshot) | ✓ FLOWING  |
| Cross-family chip avatar color | m.color                | Stamped by addFamilyToWp CF from foreign family member doc data                              | Yes                | ✓ FLOWING  |

### Behavioral Spot-Checks

| Behavior                               | Command                                          | Result                                | Status |
| -------------------------------------- | ------------------------------------------------ | ------------------------------------- | ------ |
| Phase 30 smoke contract                | `npm run smoke:couch-groups`                     | 53 passed, 0 failed (floor 48 >= 16)  | ✓ PASS |
| Production hosting reachable           | `curl https://couchtonight.app/`                 | HTTP 200                              | ✓ PASS |
| Production app shell reachable         | `curl https://couchtonight.app/app`              | HTTP 200                              | ✓ PASS |
| Production CACHE string                | `curl https://couchtonight.app/sw.js \| grep CACHE` | `const CACHE = 'couch-v41-couch-groups';` | ✓ PASS |
| Production app.html has Phase 30 hook  | `curl https://couchtonight.app/app.html \| grep wp-add-family-section` | count=1 | ✓ PASS |
| Production firebase.js has collectionGroup | `curl https://couchtonight.app/js/firebase.js \| grep collectionGroup` | count=2 (import + export) | ✓ PASS |
| Production css/app.css has Phase 30    | `curl https://couchtonight.app/css/app.css \| grep "Phase 30 — Couch groups"` | count=1 | ✓ PASS |
| Production css/app.css has .family-suffix | `curl https://couchtonight.app/css/app.css \| grep family-suffix` | count=2 | ✓ PASS |

### Requirements Coverage

| Requirement   | Source Plan          | Description                                                                            | Status                         | Evidence                                                                                                                                            |
| ------------- | -------------------- | -------------------------------------------------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| GROUP-30-01   | 30-02 + 30-03 + 30-04 | Host can add a family code at wp-create; wp gains wp.families[] + wp.memberUids[]      | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | addFamilyToWp CF live; UI affordance + onClickAddFamily wires the CF; UAT Script 1 verifies hero path on real device                                |
| GROUP-30-02   | 30-03                 | Family B member sees cross-family wp in their subscription                             | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | collectionGroup + memberUids array-contains query; production composite index BUILT; UAT Script 1 verifies on cross-family device                  |
| GROUP-30-03   | 30-03                 | Cross-family members render in roster with real names + avatars                        | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | crossFamilyChips block in renderParticipantTimerStrip; UAT Scripts 1 + 4 verify on real device                                                     |
| GROUP-30-04   | 30-03                 | Name collision triggers (FamilyName) suffix; no collision = no suffix; same-family suppression (Pitfall 6) | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | buildNameCollisionMap helper + Pitfall 6 disambiguation branch in chip-render; UAT Scripts 4 + 5 verify cross-family + within-family cases         |
| GROUP-30-05   | 30-04                 | Soft cap of 4 families: client warns above 4 (>=5); hard ceiling rejects above 8       | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | familyCount >= 5 soft-cap branch + familyCount >= 8 hard-cap branch + addFamilyToWp resource-exhausted error; UAT Scripts 2 + 3 verify on real device |
| GROUP-30-06   | 30-02                 | Host-only: non-host cannot add a family to a wp                                        | ✓ SATISFIED (CODE+RULES)       | Path B denylist on families/memberUids; addFamilyToWp CF host-only check; rules-tests #30-03 + #30-04 PASS; UAT Script 6 verifies UI gate         |
| GROUP-30-07   | 30-02                 | Cross-family wp read denied for users NOT in memberUids                                | ✓ SATISFIED (CODE+RULES)       | request.auth.uid in resource.data.memberUids predicate; rules-tests #30-01 + #30-02 PASS; UAT Script 7 verifies on real device                    |
| GROUP-30-08   | 30-03                 | Existing per-family wps still render correctly (no regression)                         | ✓ SATISFIED (CODE) / ? HUMAN-VERIFY | Defensive Array.isArray short-circuit on missing crossFamilyMembers; rsvpSubmit Pitfall 5 fix preserves Phase 27 semantics; UAT Script 10 + 8 verify |

All 8 requirement IDs from REQUIREMENTS.md Traceability table accounted for; no orphaned requirements.

### Anti-Patterns Found

None. Spot checks for TODO/FIXME/placeholder/hardcoded-empty-data found nothing relevant in the Phase 30 surfaces. The defensive `(wp.crossFamilyMembers || [])` and `Array.isArray(wp.crossFamilyMembers) ? ... : []` patterns are intentional GROUP-30-08 backward-compat handling, NOT stub indicators (they get populated by the addFamilyToWp CF write path).

### Human Verification Required

11 device-UAT scripts in `.planning/phases/30-couch-groups-affiliate-hooks/30-HUMAN-UAT.md` require physical iOS Safari PWA + Android Chrome devices that this verifier agent cannot operate. All 11 scripts must be exercised against production at couchtonight.app to convert HUMAN-VERIFY pending status to fully Complete:

1. **Cross-family invite happy path** (GROUP-30-01 + GROUP-30-02 + GROUP-30-03)
2. **Soft-cap warning at 5+ families** (GROUP-30-05 soft cap)
3. **Hard-cap rejection at 8 families** (GROUP-30-05 hard cap)
4. **Cross-family name collision suffix** (GROUP-30-04 + Pitfall 6 cross-family case)
5. **Within-family same-name does NOT trigger suffix** (Pitfall 6 negative test)
6. **Host-only invite gate** (GROUP-30-06)
7. **Cross-family read denied for stranger** (GROUP-30-07)
8. **Guest RSVP works for top-level wp** (Pitfall 5 mitigation)
9. **Cache bump activation** (CACHE = couch-v41-couch-groups)
10. **Existing wp regression check** (GROUP-30-08)
11. **Residual read access post-Remove this couch** (W5 fix — T-30-14 ACCEPT v1 known limitation)

Resume signal after device-UAT: `uat passed` (or describe any failures) → `/gsd-verify-work 30` re-run for final close-out.

### Gaps Summary

No gaps at the code, rules, deploy, or test layers. Every must_have artifact exists, every key link is wired, every requirement has implementation evidence, and the production deploy is curl-verified live with the new CACHE string. The phase is code-complete + production-deployed; only the device-UAT step remains to flip the 8 GROUP-30-* requirements from `Complete — HUMAN-VERIFY pending` to fully `Complete`.

This is the expected state for a phase that landed cleanly through all 5 plans (Wave 0 foundation → Wave 1 backend → Wave 2 client → Wave 3 UI → Wave 4 close-out), with the W5 v1 trade-off (T-30-14 residual read access until 25h archive) explicitly documented inline + in UAT-30-11 rather than treated as a gap. The plan's deploy_authorization clause was honored at Plan 05 Task 5.2; no manual deploy step remains.

---

_Verified: 2026-05-03T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
