# Phase 30 Hotfix Wave 2 — CDX-2: Flow A rank-pick wp conversion regression

**Severity:** HIGH (full Flow A "Convert to watchparty" path broken on v43 deploy)
**Source:** Cross-AI peer review (Codex), finding CDX-2
**Fixed at:** 2026-05-03
**Commit:** `b8b1f38` (branch `hotfix/phase-30-cross-cutting-wave`)
**Files touched:** `js/app.js` only (1 file, +25 / -5)

---

## The bug

`window.onFlowAConvert` at `js/app.js:17908` was calling:

```js
const wpRef = await addDoc(watchpartiesRef(), { ... });
```

`watchpartiesRef()` is a helper that **was removed** during the Phase 30 top-level
`/watchparties/{wpId}` migration. The removal note still lives at `js/app.js:1958`:

```js
// watchpartiesRef helper is REMOVED — the subscription uses inline collectionGroup query
```

So every time a user hit the "Convert" CTA on a rank-pick intent that had ≥1 confirmed
in, the function threw `ReferenceError: watchpartiesRef is not defined` **before** the
wp create write went through. Both Firestore writes (wp create + `intent.status =
'converted'`) were aborted, the toast showed "Convert failed — try again", and the
intent stayed stuck in its prior state.

Confirmed unreachable for any Flow A user on the v43 deploy.

## The fix

Switched the call site to the canonical Phase 30 wp-create pattern used at the three
sites that the hotfix-wave-1 commit `275d05b` stamped (lines ~10630, ~10841, ~11359):

1. **Auto-id**: `const id = doc(collection(db, 'watchparties')).id;`
2. **setDoc** instead of addDoc: `await setDoc(watchpartyRef(id), { ... });`
3. **Phase 30 fields stamped on create**:
   - `hostFamilyCode: state.familyCode`
   - `families: [state.familyCode]`
   - `memberUids: Array.from(new Set([myUid, ...members.map(m => m.uid)])).filter(Boolean)`
     — defensive per CR-09 (works even pre-state.members-sync; satisfies the rule that
     requires `request.auth.uid in resource.data.memberUids` on create)
   - `crossFamilyMembers: []`
4. **Intent + navigation** updated to use the locally generated `id` (no more `wpRef.id`)

Variables verified available in this scope (from reading `js/app.js:17898-17934`):
`state.familyCode` ✓, `state.me` ✓, `state.auth.uid` ✓, `state.members` ✓.

## Verification

**Tier 1 (re-read):** Confirmed lines 17905-17954 are intact, fix text present, no
corruption.

**Tier 2 (smoke):** `npm run smoke` — all 13 contracts pass:

| Contract | Result |
|---|---|
| smoke-position-transform | 23 passed, 0 failed |
| smoke-tonight-matches | 15 passed, 0 failed |
| smoke-availability | 14 passed, 0 failed |
| smoke-kid-mode | 33 passed, 0 failed |
| smoke-decision-explanation | (passed) |
| smoke-conflict-aware-empty | (passed) |
| smoke-sports-feed | (passed) |
| smoke-native-video-player | (passed) |
| smoke-position-anchored-reactions | (passed) |
| smoke-guest-rsvp | 47 passed, 0 failed |
| smoke-pickem | 26 passed, 0 failed |
| smoke-couch-groups | 62 passed, 0 failed |
| smoke-app-parse | 11 passed, 0 failed (ES module parse confirmed) |

The Phase 30 sentinels in `smoke-couch-groups` (2.7, 2.7b, 2.8) only require >=1
occurrence of the defensive `Array.from(new Set([` and `crossFamilyMembers: []`
patterns, which were already satisfied by the three pre-existing call sites. My fix
adds a fourth occurrence — no new sentinels needed and none disabled.

`smoke-app-parse` confirms `js/app.js` still parses as a clean ES module.

## Out of scope (parallel agents)

Per the briefing, NOT touched:
- `firestore.rules` — modified by parallel agent
- `tests/rules.test.js` — modified by parallel agent
- `queuenight/` repo (Cloud Functions)
- `sw.js` CACHE bump (deferred to wave-2 deploy step)
- `firebase deploy` (deferred to wave-2 deploy step)

## Follow-ups for the human

- Wait for parallel agent commits on `firestore.rules` + `tests/rules.test.js` to land
- Then run the wave-2 cache bump + deploy step
- Manual UAT: trigger a rank-pick intent → get ≥1 RSVP "in" → tap "Convert" → confirm
  the wp doc lands at top-level `/watchparties/{wpId}` with all Phase 30 fields and the
  intent flips to `status: 'converted'` with `convertedToWpId` populated
