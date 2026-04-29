---
created: 2026-04-25
status: live
audience: Claude + future-Nahder
purpose: track deferred-but-known tech debt with concrete migration notes so the next session can pick up cleanly
---

# Couch — Tech Debt Register

Living document. Items move to closed when they ship; new items append at the top.

## Active

### TD-7. Firestore index spec in 13-01 was redundant (already-covered by single-field auto-index)

**Severity:** trivial · **Effort:** 0 (already resolved) · **Risk:** none

**Source:** Phase 13 / Plan 13-01 — discovered during HUMAN-VERIFY follow-through 2026-04-25 when `firebase deploy --only firestore:indexes --project queuenight-84044` returned `HTTP 400, this index is not necessary, configure using single field index controls`.

**Resolution applied:** `queuenight/firestore.indexes.json` had its sole composite index entry removed (file is now `{ "indexes": [], "fieldOverrides": [] }`). The `discoverFamilyCodes` collectionGroup fallback (`collectionGroup('members').where('uid', '==', uid)`) works on Firestore's auto-managed single-field index for `uid`; no extra config needed.

**Why this is worth recording**
Plan 13-01's review fix HIGH-2 specified the composite index as part of the fallback safety net. The reviewer assumed all collection-group queries need an explicit composite index — they don't, when the query is single-field equality. This is a Firestore-quirk worth catching at planning time in future phases that touch Firestore indexes: simple equality-on-single-field queries don't need a composite entry.

**Action item:** none. Record-only.

### TD-6. Sentry Replay deferred (post-launch +30 days)

**Severity:** low · **Effort:** 30-60 min (re-enable + privacy review writeup) · **Risk:** low (Replay is opt-in; flipping it back on doesn't break anything)

**Source:** Phase 13 / Plan 13-02 cross-AI peer review (Codex MEDIUM-6).

**Current state**
- Phase 13 / OPS-13-05 ships Sentry with Replay DISABLED for v1.
- `replaysSessionSampleRate` and `replaysOnErrorSampleRate` keys are absent from `Sentry.init()` in both `app.html` and `landing.html`.
- `Sentry.replayIntegration({...})` is NOT in the integrations array.

**Why deferred**
Codex review flagged that even masked Replay (`maskAllText: true, blockAllMedia: true`) captures DOM structure, user flows, timestamps, and event metadata. Couch is a family app — household members, photo albums, watchparty timing — and we have not done a privacy review confirming the Replay surface is acceptable for that audience. Errors-only telemetry at v1 launch covers the operational need (visibility into prod errors) without the privacy ambiguity.

**Re-enable plan (target: post-launch +30 days)**
1. Sentry inbox should have ~30 days of real-world error data; review the captured payload shape to confirm `beforeSend` actually catches the PII surfaces we expect.
2. Decide on replay sample rates:
   - Conservative: `replaysSessionSampleRate: 0` (no proactive replay) + `replaysOnErrorSampleRate: 0.1` (10% of error sessions get replay).
   - More conservative: `replaysOnErrorSampleRate: 0.05` (5% — half the originally-planned rate).
3. Add `Sentry.replayIntegration({maskAllText: true, blockAllMedia: true})` back to the integrations array in `app.html` AND `landing.html`.
4. Test: induce an error in dev, confirm replay captures with masked text + blocked images.
5. Update privacy.html if Replay's data-collection profile materially differs from the existing telemetry disclosure.

**Re-enable code diff sketch**
```javascript
Sentry.init({
  // ...existing config...
  replaysSessionSampleRate: 0,         // no proactive replay
  replaysOnErrorSampleRate: 0.05,      // 5% of error sessions
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllText: true, blockAllMedia: true })
  ],
});
```

**Why NOT do it before launch**
Privacy posture is a launch-blocker concern; Replay's risk surface (DOM structure capture) is non-trivial and there's no rollback if a user complains post-launch. Errors-only Sentry covers the v1 operational need. Re-enable Replay deliberately with a privacy-review checklist, not as a launch task.

---

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

**Severity:** low · **Effort:** 30-60 min for the enforcement flip · **Risk:** medium (could break flows we haven't audited if CSP is enforced before fixing inline-script reliance)

**Status (post-Phase-13):** Partial close — CSP shipped in Report-Only mode; enforcement deferred.

**What shipped:**
- Phase 12: XCTO + Referrer-Policy + X-Frame-Options (3 quick-win headers).
- Phase 13 / OPS-13-04: Content-Security-Policy-Report-Only header on `**/*` covering Firebase SDK + TMDB + Trakt + Google Fonts + Sentry CDN + Cloud Functions endpoint. Browser logs violations to console for solo-dev introspection. No report-uri sink (deferred per RESEARCH.md Open Question #5).
- Phase 13 / OPS-13-04: Strict-Transport-Security inherited from Firebase Hosting default (was already live).
- Phase 13 / OPS-13-04: `worker-src 'self' blob:` allows blob-URL workers (review fix LOW — common miss).

**Codex audit-flow checklist (review fix LOW — exercise these during the 2-week observation window):**

The following flows are the most likely to surface CSP violations that the initial directive list missed. Check the browser console after each:

1. **Trakt OAuth round-trip** — open Account → Trakt sync → start OAuth → complete in popup → return to Couch. Watch for `frame-src` or `connect-src` violations on the Trakt callback.
2. **Photo upload to couch-albums** — start a watchparty session → upload a photo. Watch for `connect-src` violations against `firebasestorage.googleapis.com` or any redirect chains.
3. **Watchparty scheduling** — schedule a watchparty (intent → CF write → push). Watch for `connect-src` violations against the cloudfunctions.net endpoint or push-notification SDK.
4. **RSVP submit** — submit an RSVP from the rsvp.html surface. Watch for `connect-src` violations on the rsvp callable CF.
5. **Install flow** — install Couch as a PWA from a fresh browser. Watch for `manifest-src`, `worker-src` (sw.js registration), and `script-src` violations during the install handshake.
6. **Sentry error transmission** — induce a JS error. Watch for `connect-src` violations on `*.ingest.us.sentry.io` envelope endpoints (Sentry occasionally adds new ingest hostnames; Report-Only is the early-warning).
7. **TMDB poster load + CDN redirects** — browse the catalog. Watch for `img-src` violations on `image.tmdb.org` redirect chains.
8. **YouTube trailer embed (if used)** — Couch v1 doesn't embed YouTube trailers; if a future change does, audit `frame-src` for `https://www.youtube.com` and `https://www.youtube-nocookie.com`.

After 2 weeks, summarize the violation set in 13-05-SUMMARY.md (or a follow-up RETROSPECTIVE entry) and decide on the enforcement-flip plan based on the actual data.

**What still needs work (the enforcement flip):**
1. **Drop `'unsafe-inline'` from `script-src`.** Couch has multiple inline `<script>` blocks: Sentry `sentryOnLoad` config (app.html + landing.html), landing.html standalone-redirect IIFE, inline PWA manifest data URL. Options: move each inline script to an external `js/<name>.js` file (cheapest; recommended for Milestone 2), OR add nonce-based whitelisting (requires server-side per-request nonce — not supported by Firebase Hosting).
2. **Drop `'unsafe-inline'` from `style-src`.** Smaller surface — most Couch styling is in css/app.css. Audit any inline `style=""` attributes.
3. **Optional: add a report-uri sink** (Cloudflare Worker per RESEARCH.md "Don't Hand-Roll"; ~30 min; only if console review proves insufficient).
4. **Add Permissions-Policy header** (camera/microphone/geolocation: `()`) — defense-in-depth for the small permission surface Couch uses.

**Path to enforcement:**
- Watch the browser console for 2 weeks of CSP violation reports — exercise the Codex audit-flow checklist above weekly.
- Fix the inline-script allowance.
- Flip the header key from `Content-Security-Policy-Report-Only` to `Content-Security-Policy` in `queuenight/firebase.json`.
- Deploy + monitor.

**Why we don't enforce on day 1:** Couch has 11+ inline `<script type="module">` blocks in app.html that no one has stress-tested against a strict policy. Trakt OAuth callback handler also has inline messaging. Report-Only mode FLAGS these without breaking — that's the value (RESEARCH.md "Anti-Pattern: Ship CSP enforcement (not Report-Only) on day 1").

---

### TD-5. PWA manifest screenshots / maskable icons

**Severity:** very low · **Effort:** ~15 min · **Risk:** none

Current inline manifest declares 4 icon sizes (144/192/384/512 after launch-readiness fix). Could add:
- `screenshots[]` for richer PWA install dialogs (Chrome Android shows them since 2023+)
- `purpose: "maskable"` icon variants (for Android adaptive icons — current icons are `purpose: "any"` only)
- Categories field (`"categories": ["entertainment", "social"]`) for app-store discovery

Backlog only; not user-impacting at couch-scale.

---

### TD-8. Dual-Settings-screen consolidation (DR-3 collision proper)

**Severity:** low · **Effort:** ~1 plan / ~2 tasks (pick winning surface, remove loser, update Settings nav copy) · **Risk:** low (surface choice; either works because parity is real now)

**Source:** Phase 15.4 / D-10. Plan 15.4-02 took the "mirror approach" (Path 1 of DR-3) — added 9 push keys (7 D-12 + newSeasonAirDate + couchPing) to the Phase 12 friendly-UI maps (`NOTIF_UI_TO_SERVER_KEY` / `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` at js/app.js:181-247) so the friendly-UI Settings surface now exposes EVERY push category the legacy `NOTIFICATION_EVENT_LABELS` Settings surface does. This closes the immediate parity gap (POL-01: partial → satisfied) but leaves the underlying architectural decision deferred: which Settings surface wins (legacy vs friendly-UI) long-term?

**Status:** ⏸ DEFERRED — chose mirror approach over removal at /gsd-discuss-phase 15.4 (D-08). Mirror is reversible: a future polish phase can pick a winner and remove the loser without re-litigating the parity question.

**Trigger:** Next plan that touches Settings UI rendering (e.g., a Settings redesign, an Account-tab restructure, or a new push-category addition that has to decide where to surface). At that point, choose ONE surface and remove the other.

**Considerations for the eventual decision:**
- Legacy `NOTIFICATION_EVENT_LABELS` Settings UI is the one users actually see today (per Phase 14-09 SUMMARY: the 7 D-12 keys "surface ONLY in the legacy Settings UI" prior to 15.4). Surface real estate, navigation depth.
- Phase 12 friendly-UI Settings is newer, has BRAND voice tightened, has the 6 Phase-12 keys with renamed friendly aliases. May be more discoverable.
- 9-key parity (this plan) means EITHER surface can be the winner without losing coverage.

**Pointer:** RESEARCH §5 of the Phase 15-tracking-layer plan flagged the dual-Settings-screen collision risk originally. `.planning/phases/15.4-integration-polish/15.4-CONTEXT.md` D-10 records the deferral decision. `.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md` "Polish backlog" row "DR-3 friendly-UI parity" was the predecessor follow-up item — closed by Plan 15.4-02, but the meta-decision (which surface wins) re-deferred under TD-8.

**When to revisit**
Next time anyone touches Settings UI for any reason — pick a surface and remove the other. Not before; the mirror is functional and doing no harm.

---

## Closed

*(none yet — this is the first iteration of the register)*

---

## Conventions

- Severity: **high** = active production risk, **medium** = real but not urgent, **low** = polish, **very low** = future-proofing.
- Effort estimates assume Claude is doing the work; double for solo manual work.
- Each item lists the *blocking* condition explicitly so future sessions can check unblock status without re-reading PR/SUMMARY trail.
