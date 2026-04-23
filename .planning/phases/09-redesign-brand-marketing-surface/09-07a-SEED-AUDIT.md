# 09-07a Seed-vs-Plan Audit

**Audit date:** 2026-04-23 (autonomous session, post-09-05 deploy)
**Scope:** Compare the three absorbed seeds against `09-07a-PLAN.md` to surface drift before execution.
**Status:** **No blockers.** Plan accurately reflects seeds at the high level. Three small drift points worth acknowledging when executing.

## Absorbed seeds

| # | Seed file | Absorbed as | Drift? |
|---|-----------|-------------|--------|
| 1 | `phase-08x-intent-cf-timezone.md` | Plan commit 3 (CF timezone fix) | None — clean match |
| 2 | `phase-05x-legacy-family-ownership-migration.md` | Plan commit 1 (legacy self-claim CTA) | One: scope may be >1 family |
| 3 | `phase-05x-account-linking.md` items #6 + #7 | Plan commit 1 (sign-in methods card) | Two: "landing" ambiguity + js/auth.js question |

---

## Drift 1 — Legacy-family prod audit (seed #2 → plan)

**Seed says** (`phase-05x-legacy-family-ownership-migration.md:96`):
> At least TWO families exist in prod: ZFAM7 (Nahder's primary) AND FILMCLUB (flagged incidentally by browser-Claude during UAT on 2026-04-22 — membership/ownership status unverified). Scope may not be "just the dev family" — needs a prod audit during plan-phase to count how many families lack `ownerUid`.

**Plan says** (`09-07a-PLAN.md` user_setup line 21):
> Account settings access on a legacy family (e.g. ZFAM7 or similar without ownerUid) — Testing the legacy-family self-claim CTA requires a family doc without ownerUid stamped.

**The drift:** Plan only references ZFAM7 for test access. The FILMCLUB finding + "scope may be >1 family" is not called out.

**Implications during execution:**
- Before deploying the self-claim CTA + rules branch, worth running a quick Firestore Console query: `families/` where `ownerUid == null` → count the hits. If it's 2, fine. If it's 10+, the CTA will fire on real users who may not be expecting it.
- No code change needed — the CTA is correctly per-family-scoped and first-write-wins. Just awareness of blast radius.

**Recommended action when executing 09-07a:** add a manual step before deploy: "Firestore Console → filter families with missing ownerUid → record count for audit trail." Costs 2 minutes, surfaces any surprise.

---

## Drift 2 — "landing" terminology ambiguity (seed #3 item #7 → plan)

**Seed #7 says** (`phase-05x-account-linking.md:65-80`):
> Landing screen restructured into two clear zones: "Welcome back" (Sign in CTA) and "New to Couch?" (Create an account CTA).

**Plan says** (`09-07a-PLAN.md` must_haves line 33):
> Account settings sign-in methods card absorbs 05x #6 (Set password for faster sign-in via updatePassword) + #7 (Sign-in vs Create-account split on landing/sign-in screens).

**The drift:** When this seed was written (pre-Phase 9), "landing screen" meant the app's `#signin-screen` — the first screen a not-signed-in user saw. **Post-Phase 9, "landing" is the marketing page at `couchtonight.app/` — which is a DIFFERENT surface** (landing.html, not the app shell). The app's sign-in screen still exists inside app.html at `#signin-screen`.

**Correct interpretation:** seed #7 is about restructuring the **app sign-in screen** (`#signin-screen` inside app.html) — adding "Welcome back / New to Couch?" zones to clarify returning vs new-user intent. The marketing landing.html has its own "Pull up a seat" CTA + "Already have an account? Sign in" secondary link; it already splits the two paths correctly.

**Implications during execution:**
- Execute against `#signin-screen` in app.html, not landing.html.
- If the phrasing in plan line 33 ("landing/sign-in screens") accidentally pulls edits into landing.html, the marketing copy would get reshuffled needlessly.

**Recommended action when executing 09-07a:** treat the plan's "landing/sign-in screens" as "the app's sign-in screen". Landing.html is a separate surface owned by 09-05 and should NOT be modified by 09-07a.

---

## Drift 3 — js/auth.js as a new module? (seed #3 item #6 → plan)

**Seed #6 file map says** (`phase-05x-account-linking.md:54-58`):
> - `js/firebase.js` — add `updatePassword`, `EmailAuthProvider`, `signInWithEmailAndPassword` re-exports
> - `js/auth.js` — `setUserPassword(password)`, `signInWithPassword(email, password)`, `hasPasswordCredential()` helpers

**Plan says** (`09-07a-PLAN.md` artifacts line 44):
> js/app.js — maybeShowFirstRunOnboarding gate + completeOnboarding writer + legacy self-claim client flow + renderSignInMethodsCard + setUserPassword helper + creatorTimeZone write on intent create

**The drift:** Seed recommends introducing a NEW `js/auth.js` module for auth helpers. Plan silently consolidates into `js/app.js` (which is already ~8100 lines).

**Which is right?**
- Arguments for `js/auth.js`: matches the existing modular split (firebase / constants / state / utils); keeps auth logic grouped; reduces js/app.js bloat which is already concerning.
- Arguments for consolidating into `js/app.js`: `setUserPassword` is ONE function; a new module for a single helper is overkill; most auth UI logic already lives in app.js so splitting would fragment.

**Implications during execution:** this is a legitimate planning decision that was silently resolved in the plan. The plan's implicit choice (consolidate into app.js) is defensible but the seed's recommendation (new module) is also valid, especially if account-linking v2 ships more helpers later.

**Recommended action when executing 09-07a:** make a conscious call. Either:
- Stick with plan (consolidate into app.js) — pragmatic, minimal delta.
- Override and create `js/auth.js` — future-proof if linking work continues, but 1-function overhead.

Mention the decision in 09-07a-SUMMARY.md regardless of which way it goes.

---

## Additional notes

### Seed #3 item #7 — "Continue as ..." localStorage hint
Seed #7 suggests an optional polish: `localStorage.qn_last_provider` to show "Continue as +•••5678" on subsequent sign-ins. Plan 09-07a doesn't explicitly surface this as a must-have. It's clearly OPTIONAL per the seed. Execute without it if time-pressed; layer in later if the "feels like re-signup" feedback recurs.

### Seed #1 — CF deploy in sibling repo
Seed says the intent-cf-timezone fix requires `firebase deploy --only functions:onIntentCreated`. Plan user_setup line 19-20 captures this. Just a reminder: the sibling `queuenight/functions/index.js` edit lives in a different repo (non-git mirror), and CF deploys have longer propagation than hosting (cold-start effects — first push to a redeployed CF may lag by a few seconds while the runtime warms). Not a bug, just operational context.

### What didn't drift
- Onboarding 3-step flow: plan captures it verbatim from research Example 4; no seed drift.
- `seenOnboarding` persistence on `members/{id}`: match.
- Guest-skip (Pitfall 5 defense): match.
- Replay-intro in Settings: covered.
- BRAND.md (DESIGN-10) structure: well-specified in plan must_haves line 35 — identity, tokens, type, spacing, motion, voice, patterns, do/don't. No seed predates this (it's first-draft docs).

---

## Summary for execution

**Before running 09-07a:**
1. Pull legacy-family count from Firestore Console (drift 1).
2. Confirm "landing" = app sign-in screen, not landing.html (drift 2).
3. Decide on `js/auth.js` new module vs app.js consolidation (drift 3) and note decision in SUMMARY.md.

**During execution:** nothing blocking. Plan is solid; these are sequence/scope clarifications, not missing content.

**Autonomously audited 2026-04-23 while user was offline — no code changes made, documentation only.**
