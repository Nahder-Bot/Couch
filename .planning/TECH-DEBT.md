---
created: 2026-04-25
status: live
audience: Claude + future-Nahder
purpose: track deferred-but-known tech debt with concrete migration notes so the next session can pick up cleanly
---

# Couch — Tech Debt Register

Living document. Items move to closed when they ship; new items append at the top.

## Active

### TD-1. firebase-functions SDK 4.x → 7.x upgrade

**Severity:** medium · **Effort:** 1 dedicated session (~2-3 hr) · **Risk:** moderate (3 majors of breaking changes; production CFs running real traffic)

**Current state**
- `queuenight/functions/package.json` declares `"firebase-functions": "^4.6.0"`; resolved to 4.9.0 today.
- npm latest is **7.2.5** (3 majors behind).
- Deploy on 2026-04-25 emitted: *"package.json indicates an outdated version of firebase-functions. Please upgrade using `npm install --save firebase-functions@latest`. Note: there will be breaking changes when you upgrade."*

**Why this exists**
v4 still works, just not idiomatically. The deploy warning is a soft nudge, not a forcing function. Phase 11 deferred deploys + Phase 12 launch-readiness window meant we never had a clean session to do the migration carefully.

**Migration scope (per current functions/index.js)**
| API surface used today (v4 style) | Target (v7 style) |
|--|--|
| `functions.firestore.document(path).onCreate(handler)` | `onDocumentCreated(path, handler)` from `firebase-functions/v2/firestore` |
| `onSchedule({ schedule, region })` | already 2nd gen — should survive |
| `functions.https.onCall(handler)` | `onCall(handler)` from `firebase-functions/v2/https` |
| Top-level `functions` import | per-module `firebase-functions/v2/...` imports |
| Function `.runWith({ memory, timeoutSeconds })` | `setGlobalOptions` or per-function options object |

**Breaking-change checklist (skim before doing the work)**
- v5: 1st-gen → 2nd-gen migration encouraged; still backward-compatible via `firebase-functions/v1/*` namespace.
- v6: Node 16 → 18 minimum (we're on Node 22 ✓); some pre-deploy hook config removed.
- v7: API restructure; the legacy 1st-gen API still works under `v1/*` import but the top-level `functions` namespace was removed.

**Migration plan for the dedicated session**
1. Read [Migrate from 1st gen to 2nd gen](https://firebase.google.com/docs/functions/2nd-gen-upgrade) and the [v7 release notes](https://github.com/firebase/firebase-functions/releases) before touching code.
2. Bump to v7 (`npm install --save firebase-functions@7`).
3. Migrate exports one at a time, redeploying each independently:
   - `onWatchpartyCreate` (Firestore trigger — biggest behavioral surface; test in emulator)
   - `onIntentCreated` (Firestore trigger)
   - `watchpartyTick` (already 2nd gen; should be near-clean)
   - `rsvpReminderTick` (already 2nd gen)
   - `rsvpSubmit` (onCall — verify CORS still applies)
   - `claimMember`, `consumeGuestInvite`, `inviteGuest`, `joinGroup`, `mintClaimTokens`, `setGroupPassword`, `transferOwnership`, `sendToMembers` helper
4. Run Firebase Functions emulator + `rules.test.js` integration tests if/when those exist for CFs (currently only firestore.rules tests exist).
5. Deploy each migrated function with `--only functions:<name>` so a regression doesn't cascade.
6. Smoke-test prod flows: schedule a watchparty (onWatchpartyCreate fires), submit an RSVP (rsvpSubmit reachable), let watchpartyTick fire on schedule (cron healthy).

**Why NOT do it in a launch-readiness session**
v7 migration introduces meaningful regression risk on production traffic the family is currently using. The deploy warning is informational, not blocking. Better to upgrade in a dedicated post-v1 session where it's the only thing in flight.

---

### TD-2. Variant-B storage rules tightening

**Severity:** low · **Effort:** ~30 min once unblocked · **Blocked on:** Phase 5 member-uid migration

**Current state (Variant A)**
`queuenight/storage.rules` gates `couch-albums/{familyCode}/{wpId}/{filename}` writes on:
1. `request.auth != null` (signed-in)
2. `request.resource.size < 5 * 1024 * 1024` (5 MiB cap)
3. `request.resource.contentType.matches('image/.*')` (MIME floor)

Default-deny everything else.

**The gap Variant B closes**
Today, ANY signed-in user can write to ANY family's couch-album path — not just members of that family. The product layer enforces "only members upload to their own family" via the client UI; Firestore rules enforce it for Firestore writes; but Storage rules do NOT enforce it for Storage writes. A motivated attacker with a valid Firebase auth token could PUT a 4.9 MB image into any familyCode's album.

Mitigations already in place that make this lower priority:
- Family codes are 6-character random — not enumerable
- Photos are family-internal (only that family's app shell renders the album)
- T-11-05-04 (family-internal photo read) is explicitly accepted per Plan 11-05 threat model

**Why Variant B isn't ready yet**
Variant B requires either:
- (a) Member docs migrate to uid-keyed (currently `m_<ts>_<rand>` with optional `uid` field per Plan 5.8 SUMMARY notes), OR
- (b) Top-level `userFamilies/{uid}` → familyCode mapping document maintained on every member-create / claim / leave-family

Neither has shipped. Phase 5 was code-complete with Variant A explicitly accepted; tightening was queued.

**Variant B rule (when ready)**
```javascript
match /couch-albums/{familyCode}/{wpId}/{filename} {
  allow read: if request.auth != null
    && exists(/databases/$(database)/documents/families/$(familyCode)/members/$(request.auth.uid));
  allow write: if request.auth != null
    && exists(/databases/$(database)/documents/families/$(familyCode)/members/$(request.auth.uid))
    && request.resource.size < 5 * 1024 * 1024
    && request.resource.contentType.matches('image/.*');
}
```

**When to revisit**
After member-uid migration ships (likely Phase 13 or Milestone 2). Not a v1 launch blocker.

---

### TD-3. Console error/warn surface noise

**Severity:** low · **Effort:** ~60 min · **Risk:** low

`js/app.js` has 50 `console.warn`/`console.error` calls. None leak PII (reviewed during launch-readiness audit), but they fire unconditionally including in production. Worth a future pass to:
1. Funnel through a single `logError(category, error, context)` helper that can be silenced/throttled in production builds.
2. Decide which are actionable vs. "always-on debug" noise.
3. Consider opt-in error reporting via Firebase Crashlytics or similar (Phase 6 push infrastructure already proves we have CF-side logging).

Not a launch blocker; most users never open devtools.

---

### TD-4. CSP / security-header coverage

**Severity:** low · **Effort:** 30-60 min · **Risk:** low (could break embedded fonts / TMDB images if mis-configured)

Live response headers include `Strict-Transport-Security` ✓ but not:
- `Content-Security-Policy` — defense-in-depth against XSS. Couch is XSS-disciplined (no `innerHTML` from user content; everything goes through `escapeHtml`), so the actual XSS surface is small. CSP would still tighten the failure radius.
- `X-Frame-Options: DENY` (or `frame-ancestors 'none'` in CSP) — clickjacking protection.
- `X-Content-Type-Options: nosniff` — cheap, prevents MIME sniffing.
- `Referrer-Policy: strict-origin-when-cross-origin` — prevents leaking deep-link tokens (e.g., `/rsvp/<token>`) to outbound third parties.

**Suggested order to ship**
1. **Quick wins (no testing needed):** `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin` + `X-Frame-Options: DENY` — three lines in `firebase.json` headers, no behavioral change.
2. **CSP (needs testing):** allowlist for Trakt OAuth, TMDB image CDN, Google Fonts, Firebase SDK, service worker. Plan a test pass in a separate session.

---

### TD-5. PWA manifest screenshots / maskable icons

**Severity:** very low · **Effort:** ~15 min · **Risk:** none

Current inline manifest declares 4 icon sizes (144/192/384/512 after launch-readiness fix). Could add:
- `screenshots[]` for richer PWA install dialogs (Chrome Android shows them since 2023+)
- `purpose: "maskable"` icon variants (for Android adaptive icons — current icons are `purpose: "any"` only)
- Categories field (`"categories": ["entertainment", "social"]`) for app-store discovery

Backlog only; not user-impacting at couch-scale.

---

## Closed

*(none yet — this is the first iteration of the register)*

---

## Conventions

- Severity: **high** = active production risk, **medium** = real but not urgent, **low** = polish, **very low** = future-proofing.
- Effort estimates assume Claude is doing the work; double for solo manual work.
- Each item lists the *blocking* condition explicitly so future sessions can check unblock status without re-reading PR/SUMMARY trail.
