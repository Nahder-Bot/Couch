# Phase 30 — Hotfix Wave 3 — CDX-4

**Date:** 2026-05-03
**Severity:** Critical (irreversible data loss)
**Surface:** `firestore.rules` (top-level `/watchparties/{wpId}` delete rule)
**Status:** Fixed + tested + committed (deploy pending)

---

## The defect

The Phase 30 migration that introduced top-level `/watchparties/{wpId}`
documents silently expanded host authority on delete. The new rule was:

```
allow delete: if signedIn() && resource.data.hostUid == uid();
```

Meanwhile, the legacy nested rule at `firestore.rules` ~line 378
(under `families/{code}/watchparties/{wpId}`) had:

```
allow delete: if false;
```

So Phase 30 quietly upgraded the host from "cannot delete" to
"can permanently erase reactions / replay clips / RSVP history."
A hard delete is irreversible — Firestore document deletion drops
all subcollections and embedded fields with no audit trail.

There is **no client surface** that calls `delete()` on a wp doc.
The whole watchparty lifecycle uses status transitions:
`status: 'scheduled' → 'active' → 'archived'` (or `'cancelled'`).
Soft-delete is the model. The hard-delete rule existed only because
nobody re-derived it from the legacy semantic during the migration.

## The fix

`firestore.rules` line 244 (was 239) now reads:

```
// CDX-4 (Phase 30 hotfix Wave 3): top-level wp hard-delete is fully denied —
//   a hard delete erases reactions/replay/RSVP history irrevocably and there
//   is no client surface that needs it. Wp lifecycle uses status transitions
//   (status: 'cancelled' | 'archived') for soft-delete; legacy nested rule at
//   ~line 378 already denies delete, this top-level rule now matches.
allow delete: if false;
```

Top-level and legacy nested rules are now symmetric.

## Test coverage

Added `tests/rules.test.js #30-26`:

```js
await it('#30-26 host attempts to hard-delete top-level wp -> DENIED (CDX-4 -- must use status transition)', async () => {
  await assertFails(
    owner.doc('watchparties/wp_phase30_test').delete()
  );
});
```

Combined with the pre-existing `#30-19` (non-host delete) and `#30-20`
(stranger delete), the wp delete rule is now fully covered for all
three actor classes.

Test run: **78 passing, 0 failing** (was 77; +1 from #30-26).
Emulator log confirms denial trace `false for 'delete' @ L244` —
matching the new `allow delete: if false;` line in firestore.rules.

## Commits

| Hash | Subject |
|------|---------|
| `d0de7a5` | `fix(security): top-level wp hard-delete denied; force soft-delete via status (CDX-4)` |
| `53bbe09` | `test(phase-30): rules-test #30-26 covers host hard-delete denial (CDX-4)` |

Branch: `hotfix/phase-30-cross-cutting-wave`

## Files touched

- `firestore.rules` — line 239 → lines 239-244 (comment + `allow delete: if false;`)
- `tests/rules.test.js` — inserted #30-26 between #30-20 and the CDX-1 block (lines 1265-1279)

Untouched (other parallel fixers own these): `js/app.js`, `css/app.css`,
`app.html`, `sw.js`, `queuenight/` mirror.

## Deploy

Standard rules-only deploy from couch repo root:

```
firebase deploy --only firestore:rules
```

(No `sw.js` cache bump needed — rules change is server-side only,
no client surface affected.)

## Why this slipped through

CDX-1/2/3/5 (Wave 2) audited the create + update rules on the new
top-level wp surface. The delete rule got its own line in the
migration but wasn't cross-checked against the legacy nested rule.
Lesson: when migrating an existing collection to a new path, audit
**every CRUD verb** against the legacy semantic, not just the ones
that changed shape.

---

_Wave 3 fixer: Claude (gsd-code-fixer for CDX-4)_
_Wave 3 scope: this single defect; other parallel fixers handled
their findings on separate surfaces._
