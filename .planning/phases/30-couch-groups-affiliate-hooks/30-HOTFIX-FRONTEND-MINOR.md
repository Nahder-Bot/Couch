# Phase 30 Hotfix — Frontend minor fixes

**Date:** 2026-05-03
**Scope:** Cross-phase frontend fixes from Phase 24 / Phase 27 reviews + cross-cutting CR-13.
**Backend counterparts:** MD-02 / BL-01 land in queuenight repo via separate fixer agent.

## Findings fixed

| ID         | Severity | File                            | Line(s)   | Commit   |
|------------|----------|---------------------------------|-----------|----------|
| WR-24-03   | Warning  | `js/native-video-player.js`     | 154-162   | `a05137e` |
| WR-24-04   | Warning  | `js/native-video-player.js`     | 61-72     | `55c459b` |
| CR-13      | Critical | `sw.js`                         | 92-119    | `d1e801c` |
| LO-01      | Logic    | `rsvp.html`                     | 56-80     | `e63ea28` |

## Fix summary

### WR-24-03 — `seekToBroadcastedTime` accepts Infinity duration (commit `a05137e`)

**File:** `js/native-video-player.js:154-162`

Replaced `typeof player.duration === 'number' && !isNaN(player.duration)` with
`isFinite(player.duration) && player.duration > 0`. The prior guard accepted
`Infinity` as a valid duration; HLS / live MP4 streams report duration=Infinity
and seeking to a position on those is undefined behavior per HTML spec.

`isFinite()` rejects both NaN and ±Infinity in one call; the additional `> 0`
guard prevents a no-op seek on zero-duration streams.

### WR-24-04 — YouTube ID regex too loose (commit `55c459b`)

**File:** `js/native-video-player.js:61-72`

Tightened all four YouTube parse branches (`/watch?v=`, `/shorts/`, `/embed/`,
`youtu.be/`) from `[A-Za-z0-9_-]{6,}` to `[A-Za-z0-9_-]{11}`. Real YouTube IDs
are exactly 11 chars; the prior `{6,}` floor accepted spoofed or mangled IDs
that would 404 at load and confuse the player surface. Path-based matches also
got a `(?:[/?#]|$)` terminator so trailing junk doesn't slip through via greedy
prefix.

### CR-13 — sw.js push handler trusts arbitrary `data.url` for openWindow (commit `d1e801c`)

**File:** `sw.js:92-119`

Push payloads are attacker-influenced in principle (a hijacked VAPID key or
compromised CF could deliver `data.url='https://evil.example/'`), and
`self.clients.openWindow()` on a cross-origin URL launches an attacker-controlled
page from a system-trust notification — surprisingly potent pivot.

Added defensive same-origin validation right before the `openWindow` call:
resolve `targetUrl` against `self.location.origin` via `new URL()`; on
same-origin, pass through `pathname + search + hash`; on mismatch, parse error,
or any throw, fall back to `/app`. The earlier `client.postMessage` path is
unchanged — the receiving page already gates on its own logic.

### LO-01 — rsvp.html cold load doesn't check status before rendering form (commit `e63ea28`)

**File:** `rsvp.html:56-80`

Cold loads of revoked / closed / expired invites previously flashed the
submittable RSVP form for the duration of the page render before the 30-second
status poll could redirect. Worse, the form was actionable: a tap would post
to rsvpSubmit and only THEN hit the wp-state error path.

Hoisted a single `rsvpStatus` call to the front of the page-load script,
mirroring the 30s poll's branch ordering (revoked → closed → expired → form).
Network or transient errors fall through to the form so flaky-network users
still get an actionable surface — `rsvpSubmit` re-validates server-side anyway.

**Depends on:** BL-01 backend fix to `rsvpStatus` (separate fixer agent in
queuenight repo). Once BL-01 deploys, the cold-load gate works correctly for
all wp states.

## Smoke tests run

All targeted smoke suites pass post-fix:

- `npm run smoke:native-video-player` — ALL ASSERTIONS PASSED (covers WR-24-03 + WR-24-04)
- `npm run smoke:guest-rsvp` — 47 passed, 0 failed (covers LO-01 surface)
- `npm run smoke:app-parse` — 11 passed, 0 failed (ES-module parse contract)

Pre-existing unrelated failure on `smoke:couch-groups` test 2.14 (firestore.rules
denylist substring mismatch in Phase 30 hotfix) is NOT introduced by this work
and is tracked separately under Phase 30 verification.

## Out of scope (explicit)

- **MD-02** — backend dead-sub prune race in queuenight `functions/src/`. Backend fixer.
- **BL-01** — backend `rsvpStatus` payload correctness. Backend fixer.
- `js/app.js`, `firestore.rules`, queuenight repo — other agents.
- `sw.js` CACHE constant bump — `deploy.sh` auto-bumps at deploy time.
- Deploy commands — not run by this fixer.

---

_Fixer: Claude (frontend hotfix agent)_
_Auto mode active. All commits atomic; each finding stands alone in git history._
