---
phase: 30-couch-groups-affiliate-hooks
type: human-uat
created: 2026-05-03
status: pending
deploy_cache: couch-v41-couch-groups
resume_signal: "uat passed"
---

# Phase 30 — Couch Groups — Device UAT Scripts

> **Trigger after deploy completes.** Resume signal: `uat passed` → `/gsd-verify-work 30`.
>
> Test on at least: (a) iPhone Safari (PWA from home-screen), (b) Android Chrome, (c) Desktop Chrome. Cross-family scripts (1, 4, 6, 7, 11) require two devices: Device 1 = host signed in to Family A; Device 2 = signed-in member of Family B (or another family code). Test family codes for B / C / D / E may need to be created if you don't already have them — test family code creation via the existing /app onboarding flow, then capture each family's `code` from Settings.

## Pre-flight

- Confirm production cache is `couch-v41-couch-groups` via `curl -s https://couchtonight.app/sw.js | grep CACHE`.
- Confirm the 3 Phase 30 Cloud Functions are deployed: `firebase functions:list --project queuenight-84044` shows `addFamilyToWp`, `wpMigrate`, plus the updated `rsvpSubmit` (Plan 02 Pitfall 5 fix) — all in us-central1.
- Confirm the Firestore composite index is BUILT: `firebase firestore:indexes --pretty --project queuenight-84044` shows `[READY] (watchparties) -- (memberUids,CONTAINS) (startAt,DESCENDING)`.
- On each test device, fully close the PWA / browser tab and re-open to ensure the new service worker activates and serves `couch-v41-couch-groups`.
- Pick a host Family A account; have Family B's `code` ready to paste. Optional: have C / D / E codes for soft-cap and hard-cap tests.

## Scripts

### Script 1: Cross-family invite happy path (GROUP-30-01 + GROUP-30-02 + GROUP-30-03)

**Goal:** Verify the hero path — Family A host invites Family B; Family B's members appear in the wp roster on Family B's device with full identity.

**Setup:**
- Device 1: iPhone Safari PWA, signed in as Family A host (user who will create the wp).
- Device 2: Android Chrome (or any second browser), signed in as a member of Family B.
- Test data: Family A host account + a Family B test family with at least one member who has a `name` field set + one of Family A's queued titles.

**Steps:**
1. On Device 1, open the app, tap **Tonight**, pick a queued title, tap **Start watchparty**.
2. The wp-create modal opens. Scroll down to the **Bring another couch in** section.
3. Verify section heading reads exactly **"Bring another couch in"** (Fraunces, 17px) and sub-line reads italic **"Pull up another family for tonight."** (Instrument Serif at `--ink-warm`).
4. In the **"Paste their family code"** input, paste Family B's family code (uppercase autocapitalize is OK).
5. Tap **"Bring them in"**.
6. Within ~2s, observe a green toast **"Couch added"** at the bottom of the screen (`--good` color).
7. The new family row animates into the **"Couches in this party"** list below the input. Verify row label shows Family B's display name (no `(your couch)` suffix).
8. Tap **"Send invites"** to fire `confirmStartWatchparty`.
9. Switch to Device 2. Open the app. Within ~5s, the wp banner appears in the **Tonight** tab subscription.
10. Tap the wp banner to open the wp live modal on Device 2.

**Pass criteria:**
- Device 1 toast `Couch added` rendered at `--good` color.
- Family B's display name visible in `.wp-couches-list` immediately after add.
- Device 2's `Tonight` tab subscription returns the wp within ~5s (verify by waiting for `collectionGroup` query to fire — should not require app reload).
- Device 2's wp roster shows Family A's members with their real names + avatars (D-06 full identity cross-family).

**Pitfall reference:** RESEARCH Pitfall 1 (cross-family wp silent failure) + Pitfall 2 (rules-vs-query alignment).

**Decision reference:** CONTEXT D-04 (wp-only cross-family scope) + D-05 (ad-hoc per-wp via family-code paste) + D-06 (full identity cross-family).

---

### Script 2: Soft-cap warning at 5+ families (GROUP-30-05 soft cap)

**Goal:** Verify the soft-cap warning copy fires when the 5th family is added.

**Setup:**
- Device 1: Family A host signed in.
- Test data: Family B + C + D + E test family codes (4 cross-family adds to push the wp to 5 total families including the host's). If only B exists, mark this script `DEFERRED — needs B/C/D/E test accounts` and skip.

**Steps:**
1. Open the wp-create modal as in Script 1.
2. Add Family B → wait for `Couch added` toast → confirm `.wp-couches-list` count = 2 (host + B).
3. Repeat for Family C → count = 3.
4. Repeat for Family D → count = 4. Sub-line should still read **"Pull up another family for tonight."** (no warn yet).
5. Repeat for Family E → count = 5. **Verify**: sub-line text changes to italic **"That's a big couch — are you sure?"** rendered in `--warn` color (Instrument Serif italic).

**Pass criteria:**
- After 5th family successfully added, sub-line copy is exactly `That's a big couch — are you sure?`.
- Color shifts from `--ink-warm` to `--warn` (apricot tone — visually distinct from default sub-line).
- Input row + `Bring them in` button are still visible and active (soft cap warns; doesn't block).

**Pitfall reference:** RESEARCH Pitfall 6 NOT applicable here (this is the cap branch).

**Decision reference:** CONTEXT D-08 (soft cap of 4 families with warn at 5+).

---

### Script 3: Hard-cap rejection at 8 families (GROUP-30-05 hard cap)

**Goal:** Verify the hard-cap UI hides the input row + reports `No more room on this couch tonight.` when an over-cap add is attempted.

**Setup:** Continuation from Script 2. Need 7 additional family codes (F, G, H to reach 8 total including host).

**Steps:**
1. Continue from Script 2 (5 families). Add Family F → count = 6. Add G → count = 7. Add H → count = 8.
2. After the 8th add succeeds, **verify**: input row + `Bring them in` button + per-row kebabs HIDE entirely.
3. Sub-line text changes to italic **"This couch is full for tonight."** in `--ink-dim` color.
4. From Device 1's browser console (or a debug `Add a family` attempt forced via DevTools), invoke `addFamilyToWp` with a 9th code. **Verify**: toast `No more room on this couch tonight.` appears at `--warn`. The CF returns `resource-exhausted`.

**Pass criteria:**
- After 8th family, input row + Bring them in button + per-row kebabs all HIDE.
- Sub-line copy is exactly `This couch is full for tonight.`.
- Server-side over-cap attempt surfaces toast `No more room on this couch tonight.`.

**Pitfall reference:** RESEARCH Pitfall 6 NOT applicable.

**Decision reference:** CONTEXT D-08 (hard ceiling 8 families per wp doc-size budget).

---

### Script 4: Cross-family name collision suffix (GROUP-30-04 + Pitfall 6)

**Goal:** Verify `(FamilyName)` suffix renders only when a name collides across DIFFERENT families.

**Setup:**
- Device 1: Family A host. Family A has a member named **Sam**.
- Test data: Family B has a member named **Sam**. Family C has a member named **Sam**.

**Steps:**
1. As host, create a wp inviting Family B AND Family C (two adds in the Bring another couch in section per Script 1's flow).
2. Tap **Send invites** to fire `confirmStartWatchparty`.
3. Open the wp live modal on Device 1.
4. Inspect the participants strip / roster.

**Pass criteria:**
- Family A's Sam renders as plain `Sam` (no suffix; this is the host's family — D-09 default).
- Family B's Sam renders as `Sam (Smiths)` (or whatever Family B's display name is) with the `(Smiths)` portion in italic Instrument Serif at `--ink-dim` color.
- Family C's Sam renders as `Sam (Joneses)` similarly.
- The italic suffix span is `<span class="family-suffix">` (verify in DevTools — NOT `<em>`, per UI-SPEC accessibility note).

**Pitfall reference:** RESEARCH Pitfall 6 (collision suffix only across DIFFERENT families).

**Decision reference:** CONTEXT D-09 (family-attributed roster only on collision; render-time disambiguation, never stored).

---

### Script 5: Within-family same-name does NOT trigger suffix (Pitfall 6 negative test)

**Goal:** Verify the Pitfall 6 fix — same-family same-name members do NOT get the `(FamilyName)` suffix.

**Setup:**
- Device 1: Family A host. Family A has TWO members BOTH named **Sam** (rare but possible — ask the user to add a duplicate-named member to a test family if this isn't the case naturally).
- No cross-family invite in this script.

**Steps:**
1. As host, create a wp WITHOUT inviting any other family (host's family only).
2. Tap **Send invites**.
3. Open the wp live modal on Device 1. Inspect the participants strip.

**Pass criteria:**
- Both Sam chips render as plain `Sam` with NO `(FamilyName)` suffix on either.
- The `buildNameCollisionMap` returns count >= 2 for `sam`, but the chip-render Pitfall 6 branch correctly suppresses suffix because both Sams are within `wp.participants` (same family) — no `crossFamilyMembers` row from a different `familyCode` triggers the suffix.

**Pitfall reference:** RESEARCH Pitfall 6 (within-family same-name silently passes through suffix-free).

**Decision reference:** CONTEXT D-09 (collision suffix only when collision spans different families).

---

### Script 6: Host-only invite gate (GROUP-30-06)

**Goal:** Verify non-host members of Family A can SEE the family list but cannot ADD or REMOVE families.

**Setup:**
- Device 2: Sign in as a non-host member of Family A (not the user who created the wp).
- Pre-condition: a wp exists where you are NOT the host.

**Steps:**
1. On Device 2, open the wp live modal (any wp where another member of Family A is the host).
2. Scroll to the **Bring another couch in** section.

**Pass criteria:**
- `.wp-couches-list` IS visible (D-06 transparency — non-hosts can see who's in the wp).
- The input row (`Paste their family code` + `Bring them in` button) is HIDDEN.
- Per-row kebabs (`Remove this couch`) are HIDDEN on every row.
- The section's empty-state copy may render as `Just your couch tonight` if the host hasn't invited anyone yet, but no add affordance is offered.
- Defensively, even if a non-host bypasses the gate via DevTools and tries to call `addFamilyToWp` directly, the CF returns `permission-denied` and the toast reads `Only the host can add families to this watchparty.` — this is server-side defense in depth (Plan 02 host-only gate).

**Pitfall reference:** RESEARCH Pitfall 1 NOT applicable; this is the host-only-invite gate verification.

**Decision reference:** CONTEXT D-07 (host-only invite authority).

---

### Script 7: Cross-family read denied for stranger (GROUP-30-07)

**Goal:** Verify a member of a third family (NOT in `wp.memberUids[]`) cannot see or read the cross-family wp.

**Setup:**
- Device 2: Sign in as a member of Family X (a third family that is NOT invited to the cross-family wp from Script 1).
- Pre-condition: the cross-family wp from Script 1 still exists in production (not yet archived).

**Steps:**
1. On Device 2, open the **Tonight** tab.
2. **Verify**: the cross-family wp banner does NOT appear (Family X member is not in `memberUids[]`, so the `collectionGroup('watchparties').where('memberUids','array-contains',uid)` query returns 0 results for this wp).
3. Optionally, in DevTools open the Firestore tab and attempt a direct doc read at `/watchparties/<wpId>` for the wp's ID. **Verify**: `FirebaseError: Missing or insufficient permissions` is returned (the rules predicate `request.auth.uid in resource.data.memberUids` evaluates `false`).

**Pass criteria:**
- Tonight subscription does NOT return the cross-family wp for Family X stranger.
- Direct Firestore read attempt returns permission-denied.

**Pitfall reference:** RESEARCH Pitfall 2 (rules-vs-query alignment — verifies the rules predicate gates correctly).

**Decision reference:** CONTEXT D-06 (full identity cross-family ONLY for invited families; strangers blocked at rules layer).

---

### Script 8: Guest RSVP works for top-level wp (Pitfall 5 mitigation)

**Goal:** Verify the rsvpSubmit Pitfall 5 fix — Phase 27 guest RSVP flow continues to work for Phase 30 top-level wp docs.

**Setup:**
- Device 1: Family A host. Create a fresh wp post-Phase-30 (this wp will land at top-level `/watchparties/{wpId}`).
- Device 2: A non-Couch user (incognito browser; no signed-in account).

**Steps:**
1. On Device 1, after wp creation, copy the `/rsvp/<token>` link from the wp's host roster (the `Get RSVP link` affordance from Phase 27).
2. Open the link in an incognito browser on Device 2.
3. The `/rsvp/<token>` page loads. **Verify**: it does NOT show the `expired` error state — it shows the RSVP form (Phase 27 happy path).
4. Tap **Going**. Enter name `RSVP-Test`. Submit.
5. **Verify**: confirmation screen renders normally with `CONFIRMED` eyebrow + count line.
6. Switch to Device 1. Refresh the wp roster.
7. **Verify**: a guest chip for `RSVP-Test` appears with the apricot guest pill (Phase 27 normal render path).

**Pass criteria:**
- The Phase 27 `expired` error is NOT shown for the top-level wp.
- `wp.guests[]` gets the new entry on the top-level wp doc.
- The Phase 30 top-level lookup (B3 fix in `rsvpSubmit.js`) hit the top-level path FIRST and never fell through to the legacy nested scan for this wp.

**Pitfall reference:** RESEARCH Pitfall 5 (rsvpSubmit CF scan breaks for top-level wps post-migration; B3 hostFamilyCode-gated fix).

**Decision reference:** N/A (cross-phase regression check; Plan 02 Task 2.2 owns the fix).

---

### Script 9: Cache bump activation (CACHE = couch-v41-couch-groups)

**Goal:** Verify installed PWAs auto-revalidate to the new cache string after deploy.

**Setup:**
- Any device that had the app installed/cached BEFORE today's deploy (sw.js was previously serving `couch-v40-sports-feed-fix`).

**Steps:**
1. Open the app on the device. Observe whether the service worker auto-revalidates on next online activation.
2. May require closing and re-opening the PWA (iOS Safari requires hard relaunch via app-switcher swipe-up; Android Chrome may auto-update).
3. In DevTools (desktop or remote-debug for mobile), open Application → Service Workers.
4. **Verify**: the active SW registration's source code at line 8 reads `const CACHE = 'couch-v41-couch-groups';`.
5. Observe the older `couch-v40-sports-feed-fix` cache being deleted in the Cache Storage panel (the activate handler deletes non-current caches).
6. Confirm the **Bring another couch in** section is now visible in any wp-create modal (proof the new app shell is being served).

**Pass criteria:**
- Active SW source contains `couch-v41-couch-groups`.
- Old `couch-v40-sports-feed-fix` cache is purged.
- New Phase 30 UI surfaces (e.g., `.wp-add-family-section`) render in the wp-create flow.

**Pitfall reference:** N/A (sw.js cache-bump is the established pattern; sw.js install handler `skipWaiting` + activate handler `clients.claim` ensure fast adoption).

**Decision reference:** N/A (deploy ritual).

---

### Script 10: Existing wp regression check (GROUP-30-08)

**Goal:** Verify pre-Phase-30 wps (from Phase 27 / 26) still render correctly without regression.

**Setup:**
- Pre-condition: a wp created BEFORE the Phase 30 deploy (e.g., from Phase 27 testing or a real prior wp). Such a wp lacks `wp.crossFamilyMembers`, `wp.families`, and `wp.memberUids` (these fields are stamped only at create-time post-Phase-30).

**Steps:**
1. Find an old wp by direct deep-link OR via the **Past parties** surface in the Tonight tab.
2. Open the old wp.
3. **Verify**: the wp roster renders normally — host-family members appear with their normal chips. NO error in console. NO crash.
4. **Verify**: the cross-family chip block is empty (`crossFamilyChips = ''`) because `wp.crossFamilyMembers` is `undefined` and `Array.isArray(undefined)` short-circuits to empty array.
5. **Verify**: if you ran `wpMigrate`, this wp should appear in the new top-level subscription via the migration backfill. If `migrate-deferred` (this deploy's choice), this wp is accessible only via direct deep-link OR the old per-family path (legacy nested rules block at line 577 of firestore.rules is still active).

**Pass criteria:**
- Old wp opens and renders without error.
- No JS crash from missing `crossFamilyMembers` / `families` / `memberUids` fields.
- Phase 27 guest chips (if present on this old wp) still render with their `(guest)` collision suffix as before.

**Pitfall reference:** N/A (defensive `Array.isArray` short-circuit handles missing fields).

**Decision reference:** RESEARCH Q5 (pre-Phase-30 wp migration — backward-compat on read; migration optional).

---

### Script 11: Residual read access post-Remove this couch (W5 fix — known v1 limitation; Threat T-30-14 in Plan 04)

**Goal:** Document and verify the v1 known limitation — when a host removes a cross-family couch, the removed family's UI is hidden immediately, but the underlying wp doc remains readable to that family until the natural 25h archive (`WP_ARCHIVE_MS`).

**Setup:**
- Device 1: Family A host on iPhone Safari PWA (signed in as the host who created the wp).
- Device 2: Family B member on Android Chrome (signed in).
- Pre-condition: a fresh cross-family wp where Family A invited Family B (per Script 1's hero path); confirm Device 2 currently sees the wp banner in their Tonight tab subscription.

**Steps:**
1. Confirm baseline: Device 2 (Family B member) opens the Tonight tab — the wp banner is visible. Tap into the wp; the live modal opens; you see Family A's roster including the host. Note the wp URL / direct-doc fetch is reachable.
2. On Device 1, open the same wp's live modal. Scroll to the **Bring another couch in** section's `.wp-couches-list`.
3. Tap the kebab `⋮` next to Family B's row → tap **Remove this couch**.
4. Confirmation modal opens with heading **"Remove the {FamilyName} couch?"** and body italic **"Their crew will lose access to this watchparty. They can be added back the same way."**
5. Tap **"Yes, remove them"**.
6. **Immediate observation on Device 1 (host):**
   - Toast `Removed the {FamilyName} couch.` appears at `--good` color.
   - Family B's row disappears from `.wp-couches-list` immediately.
   - Family B's members disappear from `.crossFamilyMembers` roster on Device 1's view immediately.
7. **Observation on Device 2 (Family B member) — the v1 known limitation:**
   - The wp doc itself remains readable via the direct deep-link (or via whatever subscription path their client uses) until the natural 25h archive (`WP_ARCHIVE_MS`).
   - The `request.auth.uid in resource.data.memberUids` rule predicate still evaluates `true` for Device 2 because Family B's UIDs were NOT pruned from `wp.memberUids[]` (per the v1 trade-off documented inline in `onClickRemoveCouch` at js/app.js — Plan 04 Task 4.2).
   - Device 2's client may or may not auto-refresh the wp banner from the Tonight subscription — the wp doc still has Family B's UID in `memberUids[]`, so `collectionGroup('watchparties').where('memberUids','array-contains',uid)` still returns it.

**Pass criteria:**
- (a) UI hides Family B from Device 1's `.wp-couches-list` AND `.crossFamilyMembers` roster IMMEDIATELY (sub-second).
- (b) Toast `Removed the {FamilyName} couch.` rendered at `--good` color on Device 1.
- (c) Device 2 can STILL open the wp via direct deep-link OR continues to see it in their Tonight subscription, because their `request.auth.uid` is still in `wp.memberUids[]` per the v1 trade-off.
- (d) Document this script's outcome as the v1 known limitation — DO NOT mark it as a bug. **If usage signal warrants** in a follow-up phase (e.g., Phase 30.x), a transactional `memberUids` prune can be added; until then, this is the accepted v1 behavior tracked under Threat **T-30-14: Residual read access — ACCEPT (v1)**.

**Pitfall reference:** none (this is a v1 known trade-off, not a research pitfall — but it relates to Plan 04 `onClickRemoveCouch` inline trade-off comment and threat T-30-14).

**Decision reference:** Plan 04 threat model T-30-14 (ACCEPT disposition). v1 known limitation.

---

## Sign-off

User confirms PASS / FAIL on each script above and replies `uat passed` (or describes failures). On `uat passed`, run `/gsd-verify-work 30`.

## Browser matrix coverage map

| Platform | Browser | Covered by | Expected |
|---|---|---|---|
| iOS 16.4+ | Safari (PWA from home-screen) | All scripts (host on Device 1) | Bring another couch in section + chip flow + cache bump activation |
| Android | Chrome | Scripts 1, 2, 4, 6, 7, 11 (Device 2 cross-family member) | wp banner appears within 5s; wp roster renders; non-host gate works |
| Desktop | Chrome | Scripts 5, 8, 9 (DevTools needed) | DevTools verify SW source; rules-deny check; legacy wp render |
| Incognito | Chrome / Safari | Script 8 (guest RSVP for top-level wp) | rsvp.html happy path for post-Phase-30 wp |

## Requirement coverage

This UAT scaffold covers all 8 Phase 30 requirements (mapped to scripts):

| Requirement ID | Covered by |
|---|---|
| GROUP-30-01 (host can add a family code) | Script 1 |
| GROUP-30-02 (Family B member sees cross-family wp in subscription) | Script 1 |
| GROUP-30-03 (cross-family members render with real names + avatars) | Script 1, 4 |
| GROUP-30-04 (name collision (FamilyName) suffix) | Script 4, 5 |
| GROUP-30-05 (soft cap 4 + hard cap 8) | Scripts 2, 3 |
| GROUP-30-06 (host-only invite authority) | Script 6 |
| GROUP-30-07 (cross-family read denied for stranger) | Script 7 |
| GROUP-30-08 (existing per-family wps no regression) | Script 10 |

CONTEXT decisions exercised: D-04 (wp-only scope, Script 1), D-06 (full identity, Script 1+4), D-07 (host-only, Script 6), D-08 (caps, Scripts 2+3), D-09 (collision suffix, Scripts 4+5).

RESEARCH pitfalls verified: Pitfall 1 (silent failure → Script 1), Pitfall 2 (rules-vs-query alignment → Scripts 1+7), Pitfall 5 (rsvpSubmit fix → Script 8), Pitfall 6 (within-family suppression → Script 5), Pitfall 7 (composite index BUILT → covered in pre-flight).

W5 follow-on threat T-30-14 (residual read access ACCEPT v1): Script 11.
