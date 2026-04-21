---
phase: 05-auth-groups
plan: 09
type: uat-results
---

# Phase 5 — UAT Results

**Tested:** 2026-04-21 (incrementally, during Wave 1–6 live-testing session)
**Tester:** Nahder (nahderz@gmail.com)
**Devices:**
- Desktop Chrome (primary), incognito windows used for fresh-session tests
- iOS physical device testing: **NOT YET PERFORMED** (requires follow-up)
**Environment:** `couchtonight.app` (Firebase Hosting, custom-domain authDomain)

---

## Provider round-trips (Task 1)

| Provider | Result | Notes |
|---|---|---|
| Google | **PASS** | Verified multiple round-trips. Durable across fresh incognito windows — user lands directly on Tonight inside their last-active group (ZFAM7) with no re-prompt. Post-`authDomain` flip to `couchtonight.app` redirect returns cleanly (commit `c2c5af6`). |
| Apple | **DEFERRED** | Intentionally scoped out of Phase 5 per scope-deviation binding and `.planning/seeds/phase-09-apple-signin.md`. The `signInWithApple` helper is exported from `js/auth.js` but not surfaced in the sign-in screen DOM. Provider not enabled in Firebase console. To be completed in **Phase 9**. |
| Email link | **PASS** | End-to-end round-trip verified in Gmail web. Link opened couchtonight.app, signed in cleanly, landed on Tonight in ZFAM7. Note: delivery went to spam folder on first send — deliverability tuning (SPF/DKIM on the sender domain, or a branded `noreply@couchtonight.app`) is a Phase-9 polish item, not a functional blocker. |
| Phone (SMS) | **PASS** | Round-trip verified: SMS delivered, code accepted, signed in. Initial input validation was too strict (only accepted raw E.164); loosened to accept `555-123-4567` / `+1 (555) 123-4567` formats with auto-`+1` prefix for bare 10-digit US numbers. Phone sign-in creates a separate Firebase uid from Google sign-in; tester landed on mode-pick, joined ZFAM7 manually, tapped existing "Nahder" chip — `users/{phone_uid}/groups/ZFAM7` now co-exists with `users/{google_uid}/groups/ZFAM7`, both pointing at the same member doc. **Follow-up (Phase 9 polish):** add an in-app "Link phone to this account" affordance (`linkWithCredential`) so Google + phone unify into a single Firebase user rather than two sibling accounts. |

### Desktop vs iOS standalone PWA

All PASS verifications above were done in **desktop Chrome** (incognito). iOS Safari home-screen PWA standalone mode — the environment where redirect gotchas historically live — has not yet been tested this phase. Recommended follow-up: physical-device round-trip on one provider (Google is sufficient) to confirm the PWA iframe redirect still lands cleanly.

---

## Feature regression (Task 2)

| # | Scenario | Result | Notes |
|---|---|---|---|
| 1 | Vote + veto + self-echo | **PASS (informal)** | User-reported “everything seems to work so far” after the full `writeAttribution` migration (commit `874c145`) + grace-window + picker-rule deploy. Cross-device toast suppression (VETO-03) not explicitly re-verified with two devices this session. |
| 2 | Sub-profile act-as | **PENDING** | Wave 5 / Plan 05-07 deployed (commit `3ab102c`). Sub-profile CRUD + act-as chip wired. Needs hands-on: create a sub-profile, tap its chip on Tonight, cast one vote, confirm Firestore session doc carries `managedMemberId` + next vote clears back to self (D-04 per-action). |
| 3 | Password-protected join | **PENDING** | Wave 5 / Plan 05-07 deployed (commit `900ebad`). Set-password CF and wrong-password rejection live. Needs hands-on: owner sets password, second account tries wrong then right password, confirms `joinGroup` CF accepts only the correct one. |
| 4 | Guest invite + expiry | **PENDING** | `inviteGuest` CF + Settings UI live (Plan 05-07). Needs hands-on: generate a 1-day link, redeem it on a second browser, manually expire the member, confirm chip filters out. |
| 5 | Mood tags cross-device | **PASS (implicit)** | Covered by the writeAttribution audit + “everything works so far.” Write site at `js/app.js:addDetailMood` now carries `actingUid`; rules accept. |
| 6 | Sports Watchparty | **NOT VERIFIED** | No explicit watchparty smoke this session. All 11 watchparty writes migrated to `writeAttribution` (commit `874c145`). Needs: start a Sports watchparty, join from second device, send reactions, confirm all appear real-time. |
| 7 | Sign-out + teardown | **PASS** | Sign-out → sign-in screen reappears cleanly. Re-sign-in from incognito lands back on last-active group with full state (durable identity link verified). `auth.currentUser == null` teardown exercised multiple times. |

---

## Migration + grace (Task 3)

| # | Scenario | Result | Notes |
|---|---|---|---|
| 8 | Migration claim (AUTH-04) | **PENDING** | Wave 6 / Plan 05-08 deployed (commits `cc077ed`, `49b8625`). `mintClaimTokens` CF live. Claim-your-members panel renders unclaimed legacy members. Claim-confirm screen wired. Needs hands-on end-to-end: seed a legacy member without `uid`, generate link, redeem on a second Google account, confirm uid stamped + legacy vote history preserved. |
| 9 | Graduation (D-16) | **PENDING** | Same Wave 6 code path. Needs: create sub-profile, send graduation link from Kids & sub-profiles settings, redeem on a third account, confirm `managedBy` cleared + `uid` + `graduatedAt` stamped. |
| 10 | Grace-window cutoff | **PENDING** | Client-side helpers (`isReadOnlyForMember`, `applyReadOnlyState`) live and bound to `state.settings` snapshot. Server-side rules have the `validAttribution` branches in place. Needs: temporarily flip `settings/auth.graceUntil` to the past via Firebase Console, confirm read-only banner + disabled buttons on unclaimed member profiles, confirm Firestore rejects legacy-only writes. Restore `graceUntil` after. |

---

## Outstanding issues

1. **iOS standalone PWA verification** — still owed for Phase 5 sign-off. One physical-device round-trip on Google sign-in is the minimum acceptable test.
2. **Apple Sign-In** — deferred to Phase 9 (intentional scope cut, not a failure).
3. **Password-removal flow** — deployed `setGroupPassword` CF rejects empty passwords (min-4 validation). A separate `clearGroupPassword` CF was considered but deferred; can be added if/when anyone asks.
4. **`clearGroupPassword` follow-up** — tracked as a deferred improvement, not blocking Phase 5.
5. **Two-device UAT scenarios (1, 2, 4, 6, 8, 9)** — require a second account + optionally a second device. Solo-tester path: use two browser profiles or incognito windows with different Google accounts.

---

## Recommendation

**Phase 5 ready for `/gsd-verify-work`: PARTIAL.**

Core auth + rules + migration paths are live and the most-exercised flows (Google sign-in, group switcher, multi-group add, vote/veto/mood under `writeAttribution`) are green based on live testing during the build. Several UAT scenarios remain **PENDING** rather than **FAIL** — meaning the code is deployed and the infrastructure is in place, but hands-on verification hasn’t happened yet.

Suggested next action:

- Complete the 9 **PENDING** scenarios (2, 3, 4, 6, 8, 9, 10, plus Email-link and Phone) at your own pace — either inline with Claude guidance, or independently — and update the table above to PASS/FAIL per scenario.
- Update this file in-place as each scenario is tested. Re-commit with `docs(05-09): UAT results — <scenario summary>` as scenarios land.
- When every non-deferred scenario is PASS, Phase 5 is ready for `/gsd-verify-work` and phase completion.

---

## Provenance

This file was drafted by the orchestrator at the end of the Wave 6 build session, reflecting live-testing results verified during the session and calling out what remains to be tested. The plan (05-09-PLAN.md) requires physical-device + cross-device UAT which the tester has opted to perform incrementally rather than in a single blocking session.
