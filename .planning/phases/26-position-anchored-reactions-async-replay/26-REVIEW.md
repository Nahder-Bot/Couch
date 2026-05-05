---
phase: 26-position-anchored-reactions-async-replay
reviewed: 2026-05-03T00:00:00Z
depth: standard
files_reviewed: 4
files_reviewed_list:
  - C:/Users/nahde/claude-projects/couch/js/app.js (Phase 26 surfaces — replay, postReaction, postBurstReaction, derivePositionForReaction, past-parties)
  - C:/Users/nahde/claude-projects/couch/js/native-video-player.js
  - C:/Users/nahde/claude-projects/couch/js/state.js
  - C:/Users/nahde/claude-projects/couch/firestore.rules (Path A/B from Phase 24 REVIEWS M2)
findings:
  blocker: 0
  critical: 2
  warning: 4
  info: 2
  total: 8
status: issues_found
---

# Phase 26: Position-Anchored Reactions / Async-Replay — Code Review

**Reviewed:** 2026-05-03
**Depth:** standard (with deep cross-file tracing on ~7 helper chains)
**Files Reviewed:** 4 source files
**Status:** issues_found — 2 CRITICAL, 4 WARNING, 2 INFO

## Summary

Phase 26 passes its 9th smoke contract (33 sentinels) and rules tests cleanly, but two Critical bugs silently break the dual-entry "Red Wedding" use case described in 26-CONTEXT.md. Both Critical findings affect users who land in replay mode via Past parties row tap or title-detail row tap **without having been on the original couch** — the entire point of the D-08 dual-entry surface.

The smoke layer cannot catch CR-26-01/02 because it verifies declarations + literal strings + helper outputs in isolation, never the integration path "non-participant opens replay → posts reaction." 26-HUMAN-UAT.md Script 4 (compound-reaction posts to Firestore at correct position) is the manual test that would surface them.

## CRITICAL Issues

### CR-26-01: Replay-mode reactions blocked for non-original-participants

**File:** `js/app.js:12866-12867` (in `postReaction`)
**Severity:** CRITICAL
**Confidence:** >95%

D-05's compound-write contract says replay-mode reactions COMPOUND back to `wp.reactions`. D-08's "Red Wedding" use case explicitly targets viewers who weren't on the original couch — they discover an archived party via title-detail "Past watchparties" and join in spirit. But `postReaction` short-circuits with `alert('Start your timer first.')` whenever `mine` (their participation record on the historical wp) is null OR `mine.startedAt` is missing:

```js
const mine = myParticipation(wp);
if (!mine || !mine.startedAt) { alert('Start your timer first.'); return; }
if (mine.pausedAt) { alert('You are paused. Resume to post.'); return; }
```

A user opening an archived wp via Past parties row tap or title-detail row tap will land in replay mode (`state.activeWatchpartyMode === 'revisit'`), but if they were never a participant — or if the historical participant record has `startedAt` null or `pausedAt` set — the alert fires and the reaction never reaches `derivePositionForReaction` (which is below the guard at line 12875). The recursive-family-memory loop is broken for the entry surface that exists explicitly to serve them.

**Repro:** Open the app as User A (never on original couch for `wp_X`). Tap the wp's row in title-detail "Past watchparties" section. Replay modal opens. Type any reaction. Result: `alert('Start your timer first.')`.

**Fix:** Hoist the replay-mode branch above the participation guard. Bypass the `pausedAt` guard in replay mode (it's a live-mode UX rule that has no meaning when revisiting):

```js
if (!state.me || !state.activeWatchpartyId) return;
if (guardReadOnlyWrite()) return;
const wp = state.watchparties.find(x => x.id === state.activeWatchpartyId);
if (!wp) return;
const mine = myParticipation(wp);
const isReplay = state.activeWatchpartyMode === 'revisit';
if (!isReplay) {
  if (!mine || !mine.startedAt) { alert('Start your timer first.'); return; }
  if (mine.pausedAt) { alert('You are paused. Resume to post.'); return; }
}
const elapsedMs = isReplay ? 0 : computeElapsed(mine, wp);
const { runtimePositionMs, runtimeSource } = derivePositionForReaction({
  wp, mine, elapsedMs, isReplay,
  localReplayPositionMs: state.replayLocalPositionMs
});
const reaction = { /* ... */ elapsedMs, runtimePositionMs, runtimeSource, ...payload };
```

---

### CR-26-02: Replay reactions feed never renders for non-original-participants

**File:** `js/app.js:12310-12318` (in `renderWatchpartyLive`)
**Severity:** CRITICAL
**Confidence:** >95%

Same scenario class as CR-26-01 but on the read side. The `else if (!mine)` branch builds the body as the un-joined viewer's "Ready when you are" prompt and does NOT include `renderReplayReactionsFeed()`. So a user who taps a past-party row to revisit lands in the replay modal — sees the scrubber strip + REVISITING eyebrow — but the body is the live-mode "Start the movie on your device, then tap the button below to sync your timer" prompt with no reactions visible. The whole point of replay (seeing what the family said) is silently broken for the entire D-08 dual-entry surface.

**Repro:** Same as CR-26-01. After tapping replay entry, body shows "Ready when you are" instead of the scrubber-aligned reactions feed.

**Fix:** Replace the `!mine` branch with replay-aware branching:

```js
} else if (!mine) {
  if (isReplay) {
    body = window.renderReplayReactionsFeed(wp, state.replayLocalPositionMs || 0);
  } else {
    body = `<div class="wp-prelaunch">...</div>`;  // existing live-mode copy
  }
} else if (!mine.startedAt) {
  // ...
}
```

The existing `else if (!mine.startedAt)` and `else` branches already handle replay mode correctly via the `isReplay ? renderReplayReactionsFeed : renderReactionsFeed` ternary. Only the `!mine` branch missed the retrofit.

---

## WARNING Issues

### WR-26-01: Tonight inline-link count diverges from Past parties modal contents

**File:** `js/app.js:2952-2964` (`allReplayableArchivedCount`) vs `js/app.js:13097` (`renderPastParties`)
**Severity:** WARNING
**Confidence:** 85%

The two surfaces use different "is this archived?" predicates:

- `allReplayableArchivedCount` (Tonight inline-link gating): only counts `wp.status === 'archived'` literally
- `renderPastParties` (modal contents): uses `archivedWatchparties()` which returns `wp.status === 'archived' || (now - wp.startAt) >= WP_ARCHIVE_MS`

For any wp with `status === 'active'` but `startAt` older than `WP_ARCHIVE_MS`, the modal will show a row but the count helper returns 0 — Tonight inline-link is hidden ("Past parties (0) ›" never renders), and the user has no way to reach those rows.

The dead branch at line 2960 (`if (wp.status === 'cancelled') continue;`) is unreachable because line 2959 already short-circuited.

**Fix:** Reuse the same source-of-truth filter:
```js
function allReplayableArchivedCount(allWatchparties) {
  const archived = (Array.isArray(allWatchparties) && allWatchparties !== state.watchparties)
    ? allWatchparties.filter(wp => wp && (wp.status === 'archived' || (Date.now() - wp.startAt) >= WP_ARCHIVE_MS))
    : archivedWatchparties();
  return archived
    .filter(wp => wp.status !== 'cancelled')
    .filter(wp => replayableReactionCount(wp) >= 1)
    .length;
}
```

---

### WR-26-02: Missing `mine` not handled in derivePositionForReaction live path

**File:** `js/app.js:12826-12858` (`derivePositionForReaction`) and `js/app.js:10958-10964` (`postBurstReaction`)
**Severity:** WARNING
**Confidence:** 85%

`postBurstReaction` passes `mine: null, elapsedMs: 0` always. A burst reaction posted on a non-live, non-replay wp where the broadcast is stale falls into branch (4) and stamps `runtimePositionMs: 0, runtimeSource: 'elapsed'`. Every burst reaction at a stale-broadcast moment lands at position 0ms.

Sports bursts mostly run on live-stream wps (branch 2), so partially masked. But Phase 23's "legacy `wp.sportEvent` watchparties" may not have `isLiveStream` set, and any non-live game wp with stale broadcast hits this trap.

**Fix:** Derive caller's actual `elapsedMs` from `myParticipation(wp)` if available, mirroring `postReaction`.

---

### WR-26-03: Replay scrubber duration silently caps at 60-min for missing TMDB metadata

**File:** `js/app.js:3075-3095` (`getScrubberDurationMs`)
**Severity:** WARNING
**Confidence:** 80%

The 60-minute floor (`return 60 * 60 * 1000`) at line 3094 is the last fallback. For long-form content (3-hour movie or TV episode without TMDB metadata) where `wp.reactions` is empty (or all filtered as live-stream), the scrubber max is 1h regardless of actual content length. The user can't scrub past 60min on a 2.5h movie.

`Math.max(...positions) + 30000` line at 3092 also has stack-overflow risk on very large reaction arrays (~125k+ entries reject); reduce safely.

**Fix:**
```js
const maxPos = positions.reduce((m, p) => p > m ? p : m, 0);
if (maxPos > 0) return maxPos + 30000;
return 4 * 60 * 60 * 1000; // 4h floor
```

---

### WR-26-04: `state.replayShownReactionIds` leaks across wps in same session

**File:** `js/app.js:12122-12134` (`renderReplayReactionsFeed`)
**Severity:** WARNING
**Confidence:** 85%

The persistent-set holds reaction ids monotonically across the session. Navigating Past parties → replay modal A → close → Past parties → replay modal B accumulates ids from prior wps. Cross-wp pollution is harmless (ids are unique), but memory leaks by N reactions per visited wp until session-close.

**Fix:** Reset on `openWatchpartyLive` when entering revisit mode:
```js
if (state.activeWatchpartyMode === 'revisit') {
  state.replayShownReactionIds = new Set();
}
```

---

## INFO Issues

### IN-26-01: Dead/unreachable branch in `allReplayableArchivedCount`

**File:** `js/app.js:2960`
**Issue:** `if (wp.status === 'cancelled') continue;` is unreachable — line 2959 already filters out anything where `wp.status !== 'archived'`.
**Fix:** Remove the line. (Bundled with WR-26-01 fix.)

### IN-26-02: Three-times re-evaluation of `getDuration()` per broadcast tick

**File:** `js/app.js:11665`
**Issue:** YouTube broadcaster calls `_wpYtPlayer.getDuration()` three times in one boolean expression. Cheap but unnecessary.
**Fix:**
```js
const dur = (_wpYtPlayer && typeof _wpYtPlayer.getDuration === 'function') ? _wpYtPlayer.getDuration() : NaN;
if (isFinite(dur) && dur > 0) { duration = dur; } else { isLive = true; duration = null; }
```

---

## Summary Table

| ID | Severity | File | One-line |
|----|----------|------|----------|
| CR-26-01 | Critical | js/app.js:12866 | postReaction blocks non-participants in replay |
| CR-26-02 | Critical | js/app.js:12310 | renderWatchpartyLive `!mine` branch missing replay path |
| WR-26-01 | Warning | js/app.js:2952 | Past-parties count predicate diverges from modal filter |
| WR-26-02 | Warning | js/app.js:10958 | postBurstReaction passes mine:null → all bursts → pos=0 |
| WR-26-03 | Warning | js/app.js:3075 | Scrubber duration floor caps at 60min |
| WR-26-04 | Warning | js/app.js:12122 | replayShownReactionIds leaks across wps |
| IN-26-01 | Info | js/app.js:2960 | Dead `cancelled` branch (bundled with WR-26-01) |
| IN-26-02 | Info | js/app.js:11665 | 3× getDuration() re-evaluation |

**Highest priority:** CR-26-01 + CR-26-02 — both must land together for D-08 dual-entry surface to actually work. Recommended manual verification after fix: 26-HUMAN-UAT.md Script 4.
