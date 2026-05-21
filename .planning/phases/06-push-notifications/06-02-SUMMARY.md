---
phase: 06-push-notifications
plan: 06-02
status: complete
completed: 2026-04-21
executor: Claude (retroactive backfill via Phase 15.2)
requirements_completed: [PUSH-02, PUSH-05]
verifier_method: retroactive_backfill_phase_15.2
---

# Plan 06-02 — Wire VAPID public key + self-echo guard on sendToMembers

The two foundational pieces every subsequent Phase 6 plan depends on: (a) move the real `VAPID_PUBLIC_KEY` into `js/constants.js` and remove the `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'` placeholder from `js/app.js` so `subscribeToPush()` actually subscribes (the entire existing scaffolding was dead code without this); (b) extend `sendToMembers` in `queuenight/functions/index.js` with `excludeUid` + `excludeMemberId` options so actors never receive their own push (PUSH-05).

## What landed

### Couch repo (committed)
- **`js/constants.js`** — added `export const VAPID_PUBLIC_KEY = 'BGwhEJGIKjf4MSd4vyZA6uegbKhiG5kkxoAD2o1WUfxYmcm5cUmSjc0z05d-r7meS1gmKOT0f0Sn4zXQwhriRHg'` (real public key from `queuenight/functions/.env`). Public-by-design — same security posture as TMDB_KEY + Firebase web config (per CLAUDE.md "Public-by-design secrets").
- **`js/app.js`** — removed `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'` placeholder + its early-bail guard from `subscribeToPush()`; imports `VAPID_PUBLIC_KEY` from `./constants.js`. The previously-shipped subscribe/permission flow is now functional end-to-end.

### queuenight/ repo (deployed; not git-tracked)
- **`functions/index.js`** — `sendToMembers` signature extended to accept a 4th `options` argument destructured to `{excludeUid, excludeMemberId}`. Inside the per-member loop:
  - `if (excludeMemberId && memberId === excludeMemberId) continue;` — early skip before doc read (legacy grace-window guard)
  - `if (excludeUid && memberData.uid && memberData.uid === excludeUid) continue;` — post doc-read skip (post-claim auth guard)
- **All 3 existing CF triggers updated** to pass actor attribution via the new options: `onWatchpartyCreate({excludeUid: wp.hostUid, excludeMemberId: wp.hostId})`, `onWatchpartyUpdate(...)`, `onTitleApproval({excludeUid: approverUid, excludeMemberId: approverMemberId})`.
- Dual-check pattern matches Phase 5's `writeAttribution` lineage (commit 874c145) — supports both pre-claim member.id-only writes and post-claim uid-bearing writes (D-06 / D-07 of 06-CONTEXT).

## Smoke tests

Per Plan 06-02 Task 5 — static verification only (prod deploy was staged-only at end of autonomous run):

- `grep -n "VAPID_PUBLIC_KEY" js/app.js js/constants.js` — both files reference consistently ✓
- `grep "'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'" js/app.js` — 0 hits (placeholder gone) ✓
- `grep -n "sendToMembers" queuenight/functions/index.js` — every existing call-site passes 4 args ✓
- `node --check queuenight/functions/index.js` — syntax validates ✓

Runtime confirmation came in the 06-05 UAT (commit 25453be 2026-04-22): iPhone scheduled own watchparty, did NOT receive push, while other family members did. End-to-end self-echo guard verified.

## Must-haves checklist

From `06-02-PLAN.md` `must_haves.truths`:

- [x] `VAPID_PUBLIC_KEY` constant lives in `js/constants.js` with the real value from `queuenight/functions/.env`
- [x] The placeholder string `'PASTE_YOUR_VAPID_PUBLIC_KEY_HERE'` is GONE from `js/app.js`
- [x] `subscribeToPush()` in `js/app.js` imports `VAPID_PUBLIC_KEY` from `js/constants.js`
- [x] `sendToMembers` in `queuenight/functions/index.js` accepts a new options arg `{excludeUid, excludeMemberId}`
- [x] Every existing CF trigger (`onWatchpartyCreate`, `onWatchpartyUpdate`, `onTitleApproval`) passes `excludeUid` (actor's uid) and/or `excludeMemberId`
- [x] `sendToMembers` skips a member whose doc has `uid === excludeUid` OR `id === excludeMemberId`
- [x] Existing push flow continues to work — no regression

## Commits

- `a425257` — `feat(06-02): wire VAPID public key + self-echo guard on sendToMembers`

## Cross-repo note

`queuenight/` repo is not git-tracked from couch — `C:\Users\nahde\queuenight\` is a sibling deploy-only copy with no `.git` initialization. The deploy itself is the shipping surface; couch-repo has no commit reference for the CF-side `sendToMembers` extension or the 3 trigger updates. Production state at `queuenight-84044` us-central1 per audit YAML + STATE.md cache progression. This is the same Pitfall 2 pattern seen in Phase 5 (Cloud Functions for setGroupPassword/joinGroup) and Phase 7 (07-05-SUMMARY documents this explicitly). Functional behavior unaffected — files were edited in-place at `C:\Users\nahde\queuenight\functions\index.js` and deployed via `firebase deploy --only functions` per 06-SESSION-SUMMARY deploy batch.

## What this enables

- **Plan 06-03** assumes VAPID is wired (existing subscribe flow functional) and self-echo guard exists at the canonical `sendToMembers` send-path; adds the 3rd `eventType` option + per-event pref gate on top
- **Plan 06-04** adds quiet-hours gate + 2 new triggers (`onInviteCreated`, `onSessionUpdate`) all routed through the canonical `sendToMembers` path
- **Phase 7 / 8 / 11 / 14 / 15 push extensions** all inherit the self-echo guard for free — no per-trigger reimplementation
- **PUSH-05 (self-echo guard)** and the unblock half of **PUSH-02 (per-event opt-in primitive)** both close at this plan

## Reconstruction note

Produced retroactively by Phase 15.2 (audit-trail backfill) on 2026-04-27. Original SUMMARY was never written when Plan 06-02 shipped 2026-04-21 (autonomous run; only `06-SESSION-SUMMARY.md` was produced for the merged plan-suite). v33.3 audit YAML lines 152-179 identified the orphan-REQ gap (PUSH-02 + PUSH-05 both showed `claimed_by_plans: []` because Phase 6 plans never explicitly minted REQ ownership in canonical frontmatter form). Evidence sources: `06-02-PLAN.md`, `06-SESSION-SUMMARY.md` (commits + scope deviation log), `js/constants.js` + `js/app.js:100-262` + `queuenight/functions/index.js:111-145` (production-live state), audit YAML lines 152-179, commit `a425257` in couch repo `git log`.
