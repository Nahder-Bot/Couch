---
status: open_threats
threats_open: 2
threats_closed: 9
verified_at: 2026-04-27T00:00:00Z
phase: 15
asvs_level: 2
auditor: gsd-security-audit (Opus 4.7 1M)
scope:
  - firestore.rules — 5th UPDATE branch (tupleNames + coWatchPromptDeclined) + title-doc HIGH-1 isolation
  - js/app.js — Phase 15 writers, S2/S3/S6 renders, Trakt overlap detector + S5 modal
  - ~/queuenight/functions/index.js — watchpartyTick live-release sweep extension
  - cross-repo deploy diff (queuenight 0910514..31470d1)
---

# Phase 15 (Tracking Layer) — Post-Deploy Security Audit

This audit examines the new attack surfaces introduced by Phase 15. The phase shipped + deployed to production at couchtonight.app / Firebase project `queuenight-84044`. 11 findings evaluated, 2 are open with concrete exploit paths, 9 are confirmed mitigated.

> **Important caveat on F-OPEN-01:** the root cause is a pre-Phase-15 gap in title-doc rules — Phase 15 inherits and amplifies the impact, but did not introduce the bug. Listed here because the Trakt overlap path (15-07) is the first feature that treats `t.progress[*].source` as a trust signal.

---

## F-OPEN-01 — HIGH — `t.progress[X].source` is forgeable, breaks Trakt-overlap trust model

**Description.** The Trakt overlap detector at `js/app.js:951-994` decides which member pairs to prompt by reading `progressMap[otherId].source === 'trakt'` and `progressMap[otherId].lastWatchedAt` from the title doc. These fields are part of the legacy `t.progress` map. The Phase 15 firestore.rules title-doc UPDATE branch only adds per-member isolation for `tupleProgress`, `mutedShows`, and `liveReleaseFiredFor` — the legacy `progress` field falls under the permissive `attributedWrite()` baseline, with no per-member-key check. Any authed family member can therefore overwrite `t.progress.<other_member_id>` with crafted `{source:'trakt', lastWatchedAt: <now>}` values via `writeMemberProgress(titleId, OTHER_ID, ...)` — `js/app.js:8407` does not constrain `memberId` to the caller's id, and the rules don't either.

**Concrete exploit path.**
1. Eve (authed family member) calls `updateDoc(titlesRef/X, { progress: { ...prev, m_alice: {source:'trakt', lastWatchedAt:Date.now()}, m_bob: {source:'trakt', lastWatchedAt:Date.now(), season:5, episode:1} } , ...writeAttribution() })`. The rules accept this because the attribution-only baseline applies to `progress` and `actingTupleKey` is not required (no `tupleProgress` diff).
2. Bob opens the app and `trakt.detectAndPromptCoWatchOverlap` runs. Bob sees the S5 prompt "Looks like you and Alice both watched X S5E1 around the same time. Group your progress?".
3. Bob taps Yes — `writeTupleProgress(X, [m_bob, m_alice], 5, 1, 'trakt-overlap')` runs. Rule check passes because Bob's memberId is in the tupleKey. Now Bob+Alice have a phantom co-watched tuple they didn't actually watch together, polluting the S1 widget, S2 detail-modal section, and the live-release sweep's subscriber set.

**Severity rationale.** HIGH because (a) it requires only family-member auth (not external), but (b) the impact crosses trust into a UX surface that explicitly tells users "you and Alice watched together" — a falsehood the user cannot easily distinguish from a real Trakt sync. Combined with the live-release CF subscriber-set membership, a bad actor could also induce push notifications to members not actually watching the show.

**Evidence.**
- `js/app.js:8414` — `await updateDoc(..., { ...writeAttribution(), progress: prevProgress })` writes the entire progress map, no per-member dotted-path constraint.
- `firestore.rules:366-432` — title-doc UPDATE rule has per-member isolation only for `tupleProgress` / `mutedShows` / `liveReleaseFiredFor`. The `progress` field falls under the baseline `attributedWrite()` allowing any authed member to write the entire map.
- `js/app.js:961` — `if (!myProg || myProg.source !== 'trakt' ...)` — detector trusts the source field as authentic Trakt origin.

**Recommendation.**
1. (Patch, queue for Phase 15.x patch wave.) Add a 4th sub-rule to the title-doc UPDATE branch enforcing per-member isolation on `progress`: `!affectedKeys().hasAny(['progress']) || (request.resource.data.progress.diff(...).affectedKeys().hasOnly([memberId-or-managedMemberId]))`. Then refactor `writeMemberProgress` to use a dotted-path write (`{[`progress.${memberId}`]: ...}`) so the diff's affected keys is exactly one inner-key.
2. (Defense-in-depth, client.) Have the Trakt overlap detector also check that `otherProg.updatedAt` is consistent with `lastWatchedAt` (within a few seconds), making the spoof require synchronized timestamp manipulation. Won't stop a determined attacker but raises the cost.
3. (Acceptance path.) If patching is deferred, document in SECURITY.md accepted-risks log that the attack is in-family-only, and the worst impact is UX pollution + occasional misleading push (not data exfiltration or auth bypass).

---

## F-OPEN-02 — MEDIUM — `tupleNames` is not write-scoped to tuple participants; any member can rename any couch

**Description.** The 5th UPDATE branch on `/families/{familyCode}` (firestore.rules:181-200) permits writes to `tupleNames` via the allowlist `['tupleNames', 'coWatchPromptDeclined', 'actingUid', 'managedMemberId', 'memberId', 'memberName']`. The rule does not peek into nested `tupleNames.<tupleKey>` keys, nor does it constrain which tupleKeys the writer may rename. Combined with `setTupleName` (`js/app.js:8517`) which does no client-side participant check, **any authed family member can rename ANY tuple** — including tuples that don't include them.

**Exploit path.** Eve (in family with Alice and Bob) writes: `updateDoc(families/CODE, { 'tupleNames.m_alice,m_bob': { name: '<inappropriate string>', setBy: 'm_eve', setAt: Date.now() }, ...writeAttribution() })`. Rule passes (allowlist matches; no nested-key check). Alice and Bob now see Eve's chosen name on their couch tuple in the S2 detail-modal + S1 Tonight widget. The `setBy` field records the truth (m_eve) but the UI does not currently surface it.

**Severity rationale.** MEDIUM because: (a) in-family social-engineering / pranking / harassment vector, especially in extended/blended families with managed sub-profiles where children's tuple names could be vandalized by other adults; (b) `name.slice(0, 40)` cap + `escapeHtml` at render mean no XSS / no payload-overflow — purely a content-trust issue; (c) detection trail (`setBy` field) exists in data but not in the UI.

**Evidence.**
- `firestore.rules:197-200` — allowlist has no per-key constraint; comment explicitly says "rules do not peek into nested map values per the established pattern".
- `js/app.js:8517-8554` — `setTupleName` writes any `tupleKeyStr` the caller passes; no `me.id ∈ tupleKeyStr.split(',')` guard.

**Recommendation.**
1. (Cheap mitigation, client-side.) In `cv15ShowRenameInput` and `cv15HandleDetailModalClick`, gate the pencil-glyph from rendering when `me.id` is not in the tupleKey. Reduces the UI surface to "the user only sees the rename affordance for tuples they're in." Doesn't stop a user crafting a direct Firestore write but raises the cost considerably.
2. (Server-side fix, deferred.) Add an `actingTupleKey` echo + regex check to the 5th UPDATE branch mirroring the title-doc HIGH-1 pattern. Requires (a) a `setTupleName` payload change to stamp `actingTupleKey: tupleKeyStr` and (b) a regex match against the actor's memberId.
3. (Detection.) Surface the `setBy` field in the rename UI so the actor's id is visible — turns the silent griefing path into an attributable one.
4. (Acceptance path.) Document as an accepted in-family social-trust assumption — same risk class as a family member changing other people's votes via `t.votes` (which has identical exposure today).

---

## F-CLOSED-01 — Title-doc HIGH-1 isolation matrix lands as designed (mitigated)

`tupleProgress`, `mutedShows`, `liveReleaseFiredFor` per-member field-level isolation enforced via the 3 sub-rules at `firestore.rules:366-432`. The `actingTupleKey` echo contract is honored by `writeTupleProgress` (`js/app.js:8476`) and `clearTupleProgress` (`js/app.js:8497`), regex check `(^|.*,)<actor>(,.*|$)` correctly anchors at start, end, or comma boundaries — so `actingTupleKey: m_eve,m_alice,m_bob` would NOT match for an actor whose memberId is `m_carol`. Tests #29-#31 in `tests/rules.test.js` cover the deny paths. **No exploit path found.**

---

## F-CLOSED-02 — `liveReleaseFiredFor` client write is denied; CF admin SDK is the only writer

Verified at `firestore.rules:366-373`: explicit DENY `!affectedKeys().hasAny(['liveReleaseFiredFor'])` precedes the per-member checks. Test #31 confirms the deny path. CF admin SDK bypasses rules and is the sole legitimate writer (`~/queuenight/functions/index.js:978, 985, 1003`). Rules-tested.

---

## F-CLOSED-03 — `liveReleaseSweepLastRunAt` throttle cursor is server-only

`families/{familyCode}` UPDATE rule (firestore.rules:151-200) restricts client writes to the 5 allowlists (picker / ownerUid / couchSeating / couchInTonight / tupleNames+coWatchPromptDeclined). `liveReleaseSweepLastRunAt` is not in any allowlist, so client writes are denied. The CF admin SDK writes it at `~/queuenight/functions/index.js:1024`. Cannot be manipulated client-side.

---

## F-CLOSED-04 — FCM push body is plain-text; no template injection risk

The push payload built at `~/queuenight/functions/index.js:998-999` (`pushTitle = "New episode ${when}"`, `pushBody = "${showName} S${next.season}E${next.episode} — watch with the couch?"`) interpolates `t.name` (writable by any family member). FCM treats `notification.title` and `notification.body` as plain UTF-8 strings — no markdown / no HTML / no template language is interpreted on iOS or Android push surfaces. Worst case: a malicious member edits `t.name` to a phishing-style string ("URGENT: click here"). This is in-family social-engineering, not a security vulnerability.

---

## F-CLOSED-05 — Subscriber-set tuple-membership cannot be spoofed across families

The CF reads `t.tupleProgress` from the family-scoped title doc (`families/{familyDoc.id}/titles/{tdoc.id}`). Subscriber IDs are union-extracted via `tk.split(',')` then passed to `sendToMembers(familyDoc.id, [...subscriberIds], ...)`. `sendToMembers` (`functions/index.js:111`) reads FCM tokens scoped under the same `familyDoc.id`. There is no cross-family escape — even if Eve in Family A spoofed a tuple key naming `m_bob_in_family_b`, the CF would only attempt to deliver to Family A's subscriber tokens. Token lookup is family-scoped.

---

## F-CLOSED-06 — `setTupleName` HIGH-2 character-safety guard mitigates field-path corruption

`isSafeTupleKey` (`js/app.js:8264`) regex `/^[A-Za-z0-9_,-]+$/` rejects any character that could shred a dotted-path field (`.`, `[`, `$`, etc.). `setTupleName` (`js/app.js:8519`) gates the dotted-path write on this validator + emits Sentry breadcrumb on rejection + surfaces a warn toast. `tupleKey()` (`js/app.js:8272`) also validates each input member ID via `/^[A-Za-z0-9_-]+$/` (no comma allowed in single IDs). Defense-in-depth confirmed.

---

## F-CLOSED-07 — XSS in S2/S3/S5/S6 surfaces is correctly escaped

All dynamic strings rendered by the Phase 15 surfaces are wrapped in `escapeHtml` from `js/utils.js:3` (handles `&`, `<`, `>`, `"`, `'`):
- `renderCv15TupleProgressSection` (`js/app.js:8842, 8843, 8845, 8847, 8857, 8860`) — `t.id`, `tk`, `visibleName`, `seasonNum`, `episodeNum`, `ago` all escaped before interpolation.
- `renderCv15CoWatchPromptModal` (`js/app.js:1026-1029`) — `otherMemberName`, `titleName`, `season`, `episode` all escaped.
- `renderCv15MutedShowToggle` (`js/app.js:8886`) — `t.id` escaped; the literal label strings are static.

The `name` field in `tupleNames` (capped at 40 chars in `setTupleName`) flows into `visibleName` → `escapeHtml(visibleName)` at line 8847. Even if a member named a tuple `<script>alert(1)</script>`, render produces `&lt;script&gt;alert(1)&lt;/script&gt;`. **No XSS path found.**

---

## F-CLOSED-08 — Notification preferences are self-only

`users/{u}` rule at `firestore.rules:98-100` restricts read/write to `signedIn() && u == uid()`. The 8th `newSeasonAirDate` key in `DEFAULT_NOTIFICATION_PREFS` (`js/app.js:123`) and the corresponding server gate (`functions/index.js:103`) write to `users/{state.auth.uid}.notificationPrefs` — no other member can toggle. `updateNotificationPref` (`js/app.js:267-282`) merges only into the caller's own user doc.

---

## F-CLOSED-09 — Cross-repo deploy diff is clean — no unrelated CFs ride along

`git diff 0910514..31470d1` on `~/queuenight` shows three files modified: `firestore.indexes.json` (+11 lines, the composite index), `firestore.rules` (+115 lines, the 5th UPDATE branch + HIGH-1 tightening), `functions/index.js` (+192 −1 lines, only the NOTIFICATION_DEFAULTS 8th key + the live-release sweep block). No body of `requestAccountDeletion`, `claimMember`, `joinGroup`, `inviteGuest`, `consumeGuestInvite`, or any other unrelated CF was modified. They were redeployed (because `firebase deploy --only functions` redeploys all 23) but with byte-identical implementations.

---

## Summary table

| ID | Severity | Status | Title |
|----|----------|--------|-------|
| F-OPEN-01 | HIGH | OPEN | `t.progress[X].source` forgeable; breaks Trakt-overlap trust model |
| F-OPEN-02 | MEDIUM | OPEN | `tupleNames` not write-scoped to tuple participants |
| F-CLOSED-01 | — | mitigated | Title-doc HIGH-1 isolation matrix shipped as designed |
| F-CLOSED-02 | — | mitigated | `liveReleaseFiredFor` client write denied; CF-only |
| F-CLOSED-03 | — | mitigated | `liveReleaseSweepLastRunAt` server-only |
| F-CLOSED-04 | — | n/a | FCM push body is plain-text — no injection |
| F-CLOSED-05 | — | mitigated | Subscriber set cannot leak across families |
| F-CLOSED-06 | — | mitigated | `isSafeTupleKey` blocks field-path corruption |
| F-CLOSED-07 | — | mitigated | All Phase 15 render sites escape user-controlled strings |
| F-CLOSED-08 | — | mitigated | Notification prefs are self-only |
| F-CLOSED-09 | — | n/a | Deploy diff clean; no unrelated CF body changes |

---

## Recommended next steps (ordered by ROI)

1. **Patch F-OPEN-02 client-side first** (cheap, high-value): in `cv15ShowRenameInput` and the `renderCv15TupleProgressSection` row mapper, hide the `.cv15-tuple-rename` pencil glyph when `state.me.id` is not in `tk.split(',')`. ~10 lines of JS, no rules change, no migration. Closes the casual-griefing path even without the server-side fix.
2. **Plan F-OPEN-01 for a rules tightening patch** — add per-member isolation to `progress` mirroring the existing `mutedShows` pattern, then convert `writeMemberProgress` to dotted-path. Requires careful coordination because `progress` is written from many sites (manual edit, Trakt sync, post-watchparty). Estimate 1 plan. The legacy permissive path is a pre-Phase-15 gap, so call this Phase 15.x or the start of a "Phase 5 hardening" backfill.
3. **Surface `setBy` in the rename UI** — even before the server-side fix lands for F-OPEN-02, showing "renamed by Eve" turns silent vandalism into attributable action.
4. **Add a rules test** for both open findings so regressions are caught (currently #1-#32 cover the closed paths only).
