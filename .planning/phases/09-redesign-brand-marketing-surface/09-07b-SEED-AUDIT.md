# 09-07b Seed-vs-Plan Audit

**Audit date:** 2026-04-23 (autonomous session, parallel to 09-07a audit)
**Scope:** Compare `phase-05x-guest-invite-redemption.md` seed against `09-07b-PLAN.md` to surface drift before execution.
**Status:** **No blockers.** Plan mostly tightens the seed (good additions). Three drift points worth acknowledging — one protocol gap, two implementation details.

## Absorbed seed

| Seed file | Absorbed as | Drift? |
|-----------|-------------|--------|
| `phase-05x-guest-invite-redemption.md` | Plan commits 1 (rules invariant) + 2 (redemption client + CF + bootstrap) | Three: rate-limit, post-redemption expiry, owner-side URL strip |

Note: Plan 09-07b ALSO includes DESIGN-09 motion audit in commit 3 — this is **NOT** from the seed (the seed covers only DESIGN-08 guest-auth). Motion audit is the second half of DESIGN-09 that was deferred from plan 09-02 (token layer) with the understanding that rule-body adoption would land here. Intentional expansion, not drift.

---

## Drift 1 — Rate limiting not in must_haves (medium priority)

**Seed says** (`phase-05x-guest-invite-redemption.md:65`):
> Rate-limit `consumeGuestInvite` per-IP at the CF level (App Check or a simple Firestore counter) to prevent token-enumeration attacks.

**Plan says:** plan objective line 70 mentions "(admin-SDK, idempotent, rate-limited)" in prose, but the `must_haves.truths` block (lines 24-32) enumerates 8 truths and none of them explicitly require rate-limiting. Idempotency IS called out (truth #5: "second call with same token errors with failed-precondition (already-consumed)").

**Distinction worth making:**
- **Idempotency** = "same token can't be consumed twice" (token-scoped; prevents accidental double-creation if client retries)
- **Rate limiting** = "same IP can't hit the CF N times/second" (IP-scoped; prevents token-enumeration attacks by a malicious client)

Idempotency doesn't prevent enumeration — an attacker iterating through token guesses would still consume CF calls. Rate-limiting is the defense.

**Implications during execution:**
- If skipped: tokens are cryptographically-random 32+ bytes (seed line 64), so enumeration is statistically infeasible anyway. The risk is mostly cost exhaustion (attacker burning CF minutes) not security compromise. Real-world risk is low for a product at Couch's scale.
- If included: App Check is the canonical Firebase answer. Costs ~10 min to wire up client-side + add the enforce-App-Check-in-CF line.

**Recommended action when executing 09-07b:** Make a conscious decision during the plan execution:
- **Low-effort path:** App Check client integration for *all* callable CFs (not just consumeGuestInvite) — fully protects against future CF abuse, ~15 min to wire.
- **Zero-effort path:** Skip for v1; document as known-gap; revisit if CF abuse ever becomes a real signal.

Flag the decision in `09-07b-SUMMARY.md`.

---

## Drift 2 — Post-redemption guest-session expiry not explicit in plan (medium priority)

**Seed says** (`phase-05x-guest-invite-redemption.md:56-60`):
> Guest members already have `expiresAt` on the member doc. Enforcement should happen at:
> - **Chip-list render** (`continueToNameScreen` at `js/app.js:56`): already filters `!m.temporary || m.expiresAt > now`. Good — passive expiry.
> - **Write path** (votes, reactions, etc.): add `expiresAt` check to the guest's member doc before attribution. If expired, block the write with a user-facing "Your guest access has expired" toast.
> - **Scheduled CF** (optional): daily cron that archives expired guest members so they're not even fetched. Nice-to-have, not required for v1.

**Plan says:** `must_haves.truths` covers token redemption + expired-invite dead-end, but **does NOT explicitly require the write-path expiry check**. Post-redemption guest-session behavior is not called out.

**The drift:** A guest whose invite expires (30 days later) still has a valid member doc with `temporary:true` + stale `expiresAt`. Without the write-path check, they could keep voting/reacting. Their chip disappears on next render (chip-list filter works), but their writes still hit the DB until their own client finally re-renders.

**Verification needed during execution:**
- Run `grep -nE "m\.expiresAt|temporary.*expires" js/app.js` to see what's already in place from Phase 5.
- If write-path `expiresAt` check exists: no action. If missing: add it.

**Recommended action when executing 09-07b:** add a Task-1.5 or incorporate into Task 2:
> Verify that every guest-write path (vote, reaction, veto, watchparty-join, intent-RSVP) guards against expired guest members. Add `expiresAt` check before attribution if missing.

---

## Drift 3 — Owner-side `?family=` URL strip (small, verify-only)

**Seed says** (`phase-05x-guest-invite-redemption.md:24` and line 67):
> Current: `couchtonight.app/?invite=<token>&family=<code>` link.
>
> ... Mitigation: require the invite token alone to resolve the family — don't bundle `?family=` at all. Owner-side code can stop appending it.

**Plan says** (line 90):
> URL shape: couchtonight.app/?invite=<token> (family code no longer bundled — security per seed)

**The drift:** Plan correctly adopts the seed's security recommendation (token-only URL). But this change requires **two edits** that the plan doesn't clearly separate:
1. **Redeemer side:** parse only `?invite=` (consumeGuestInvite CF resolves family via the token doc). ✓ Covered by plan line 93.
2. **Owner side:** the invite-generation code (Plan 05-07's `createGuestInvite` or wherever the clipboard-copy link is built) must stop appending `&family=<code>`. Not explicitly called out in plan's files_modified or must_haves.

**Implications during execution:**
- If Plan 05-07 already generates token-only URLs, the plan's implicit adoption is correct and no action needed. Verify with `grep -nE "invite=.*family=" js/app.js` — should return zero hits.
- If 05-07 still appends `&family=`, 09-07b must modify the owner-side generator. One-line edit, but easy to overlook since plan focuses on the redeemer flow.

**Recommended action when executing 09-07b:** add a pre-flight verification:
> `grep -nE '\?invite=[^"]*&family=' js/app.js` — should return zero hits. If not, strip the `&family=` append in the invite-generation helper before shipping the redemption flow (otherwise a generated URL still leaks the family code to anyone intercepting the link).

---

## Plan's additive improvements over seed (all good)

These are NOT drift — the plan adds defenses the seed didn't specify, and they're the right call:

1. **`seenOnboarding: true` on guest creation** (plan truth #4). Seed doesn't call this out. Plan adds it as Pitfall 5 defense, paired with 09-07a's onboarding gate. Prevents the guest-hits-onboarding regression.

2. **Pre-flight rules invariant check (Task 1 entirely)**. Seed assumes the `temporary:true` member branch is live in Firestore rules (it is, per STATE.md 2026-04-22). Plan codifies this as a pre-execution gate — if the rules ever regress, the plan halts before shipping the client/CF changes that depend on it. Archaeological defense for future.

3. **URL shape adoption** (plan line 90). Seed raised the family-code-in-URL concern but didn't mandate removal; plan adopts the more secure shape by default.

---

## Motion audit (commit 3) — plan-only content, no seed

Plan commit 3 covers DESIGN-09 second half — migrating raw `transition:` / `animation:` durations and easings in `css/app.css` to the semantic tokens introduced in 09-02 (`--t-*` + `--duration-*` + `--ease-*` + `--easing-*`). Scope:
- Every `transition:` / `animation:` rule references a `--t-*` or `--duration-*` token (no raw `150ms`/`200ms`/`300ms` literals)
- Every easing references a `--ease-*` or `--easing-*` token (no raw `cubic-bezier(...)` except inside the 4 :root token definitions)
- `prefers-reduced-motion` block reduces all non-essential motion to ≤50ms or removes transitions

This is mechanical + orthogonal to the guest-invite work. No seed drift possible.

---

## Summary for execution

**Before running 09-07b:**
1. **Decide rate-limiting approach** (drift 1). App Check integration or document-and-defer.
2. **Verify + potentially add write-path expiry checks** (drift 2). Run `grep -nE "m\.expiresAt|temporary.*expires" js/app.js` to inventory existing defenses. Add missing ones to Task 2 scope.
3. **Verify owner-side URL generator already strips `&family=`** (drift 3). One grep. If dirty, add to plan.

**During execution:** nothing blocking. Plan is solid; these are sharpening-of-scope items, not missing content.

**Autonomously audited 2026-04-23 while user was offline — no code changes made, documentation only.**
