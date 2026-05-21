---
phase_target: 05.x (auth-groups follow-up) or hardening pass
priority: low (single known user affected; hotfixed manually on 2026-04-22)
surfaced_during: /gsd-verify-work 5 — Test 2 (Password-protected join)
---

# Legacy family-ownership migration (Phase 5.x)

## Problem

Phase 5 introduced `families/{id}.ownerUid` stamped at family creation time
(`js/app.js:2277` — `submitFamily` path). The `renderOwnerSettings` check at
`js/app.js:2557` gates the owner-only settings panel on
`state.auth.uid === state.ownerUid`.

**Missing:** no migration path for family docs that predate Phase 5. When a
pre-Phase-5 family doc lacks `ownerUid`, the admin check evaluates
`someUid === undefined → false`, and the original creator — despite being the
de-facto owner — cannot see the Group admin section (password, guest invites,
ownership transfer, migration claim, grace banner, etc.).

This blocks Phase 5 owner-only features entirely for any legacy family and is
what surfaced during `/gsd-verify-work 5` — the primary dev family ZFAM7
(created 2026-04-08, 10 days before Phase 5 planning) had no `ownerUid`.

## Current mitigation

Manual one-time Firestore Console write on 2026-04-22: stamped
`families/ZFAM7.ownerUid = <Nahder's Google uid>`. Unblocks Phase 5 UAT.

This was an ad-hoc repair, not a reproducible migration — acceptable because
ZFAM7 is currently the only known legacy family.

## Proper fix (when this seed gets picked up)

Client-side, on sign-in with a family loaded, if the user is a member AND
`family.ownerUid` is missing:

**Option A — self-claim CTA (recommended):**
- Add a "Claim ownership of this group" surface in Account settings, visible only
  when `state.ownerUid == null && state.me exists`.
- Tap → confirm dialog → writes `ownerUid = state.auth.uid` + notifies other
  members via a toast "Nahder is now the group admin."
- First-write-wins: whoever taps first becomes the owner. Any subsequent member
  loses the CTA.

**Option B — auto-claim for the earliest member:**
- Server-side (CF) job that scans `families/*` for docs missing `ownerUid`,
  finds the member with the earliest `createdAt` that has a `uid`, stamps that
  as `ownerUid`.
- Lower friction but riskier — picks an owner without the user's explicit
  consent. Also depends on `members.createdAt` being reliably populated on
  legacy docs.

**Recommended:** Option A. Explicit consent, trivial to reason about, pairs
cleanly with the existing Plan 05-08 migration-claim affordance pattern
(opt-in, user-initiated).

## Rules impact

**CONFIRMED via UAT on 2026-04-22:** client-side `updateDoc` attempt from
Nahder's signed-in session to write `ownerUid` on ZFAM7 was rejected with
`permission-denied: Missing or insufficient permissions.` — current rules
explicitly disallow writing `ownerUid` when the field is absent (classic
catch-22 for legacy docs). Self-claim CTA without a rules update would fail.

Firestore rules for family-doc writes currently check `ownerUid`. Adding the
self-claim write requires a new rule branch:

```
match /families/{fid} {
  allow update: if
    // existing rules...
    // Legacy ownership self-claim: ownerUid was missing, caller is a member,
    // caller is writing their own uid as ownerUid, nothing else changed.
    ( !('ownerUid' in resource.data) &&
      request.auth.uid != null &&
      exists(/databases/$(database)/documents/families/$(fid)/members/*) &&  // member query
      request.resource.data.ownerUid == request.auth.uid &&
      request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ownerUid']) );
}
```

Refine during plan-phase.

## Testable deliverables

- Legacy family (no ownerUid) signed-in member sees Claim CTA
- Tap → write succeeds → Group admin section renders
- Second member on same family no longer sees Claim CTA (now has ownerUid)
- Non-legacy families show no CTA (ownerUid present)
- CTA dismissible (state.dismissedOwnerClaim local flag — revisitable via button)

## Notes

- **At least TWO families exist in prod:** ZFAM7 (Nahder's primary, legacy pre-Phase-5) AND FILMCLUB (flagged incidentally by browser-Claude during UAT on 2026-04-22 — membership/ownership status unverified). Scope may not be "just the dev family" — needs a prod audit during plan-phase to count how many families lack `ownerUid`.
- Low urgency today, but scales with family count. Production families created
  post-Phase-5 all have ownerUid stamped correctly.
- If Phase 9 (Redesign) touches Account settings layout, roll this in there.
- If onboarding a second dev family or doing commercial launch prep, promote to
  active milestone.
