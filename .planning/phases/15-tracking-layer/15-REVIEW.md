---
phase: 15-tracking-layer
reviewed: 2026-04-27T07:07:35Z
depth: deep
files_reviewed: 6
files_reviewed_list:
  - js/app.js
  - css/app.css
  - firestore.rules
  - tests/rules.test.js
  - app.html
  - ../queuenight/functions/index.js
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 15: Code Review Report — Tracking Layer

**Reviewed:** 2026-04-27T07:07:35Z
**Depth:** deep (cross-file + cross-repo)
**Files Reviewed:** 6 (5 in couch repo + sibling queuenight CF)
**Status:** issues_found

## Summary

Phase 15 ships a substantial, well-instrumented tracking layer (~999 LOC in `js/app.js` plus a large CF extension). The defensive posture is unusually strong for this codebase: `isSafeTupleKey` validates field-path safety, optimistic local state writes prevent UI flicker, idempotency flags are written before push sends, the hourly throttle correctly gates the live-release sweep, and event-listener delegation uses a `data-cv15-bound` sentinel that is properly idempotent across all 10 attach call sites.

That said, **two issues land squarely in production-broken / production-risky territory**, both of which are invisible from the verifier's standpoint because they fail silently:

1. **Live-release push notifications will never fire in production.** The CF stale-data guard (HIGH-4) requires `t.nextEpisodeRefreshedAt`, but no client code writes that field — every title is treated as stale and skipped permanently. The Sentry breadcrumb will eventually surface this once a real tracked TV title with ≥2 trackers hits the airdate window, but the marquee Phase 15 push feature is currently dead-on-arrival.

2. **Source repo `firestore.rules` is out of sync with deployed rules.** The deployed (mirror) rules include the `coWatchPromptDeclined` allowlist key; the source repo's rules file does NOT. Tests load the source file, so any future test of the decline-persistence path would fail; any future deploy that doesn't manually re-edit the mirror file will regress.

The other findings are smaller but worth tracking: a regex-injection vector in the title-doc `actingTupleKey` rule (the per-tuple isolation can be bypassed via attacker-controlled `memberId` payload), absence of test coverage for the `coWatchPromptDeclined` write path, an iOS Safari focus race in `cv15ShowRenameInput`, and a couple of Info items.

The Phase 15 verifier marked this `human_needed` — the findings below are exactly the class of issues the verifier flagged for human review.

---

## Critical Issues

### CR-01: Live-release push notifications never fire — `nextEpisodeRefreshedAt` is never written by any client code

**File:** `js/app.js:7314-7316` (writer) + `~/queuenight/functions/index.js:897-924` (consumer)
**Issue:**
The CF stale-data guard (REVIEW HIGH-4 implementation) at `functions/index.js:898` skips any title where `(now - t.nextEpisodeRefreshedAt) > 7 days`. With `t.nextEpisodeRefreshedAt || 0` defaulting missing fields to 0, every title without this field is treated as 56+ years stale and skipped.

`fetchTmdbDetails(mediaType, tmdbId)` at `js/app.js:7164` returns an `out` object containing `nextEpisode`, `lastEpisode`, `seasons`, `seasonsMeta`, etc. — **but never includes `nextEpisodeRefreshedAt`**. The single client write site at line 7316 spreads `details` (i.e. `out`) into the Firestore update without stamping a refresh timestamp:

```js
const details = await fetchTmdbDetails(mediaType, tmdbId);
const update = { detailsCached: true };
Object.keys(details).forEach(k => { if (details[k] !== undefined && details[k] !== null) update[k] = details[k]; });
try { await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update }); } catch(e){ console.error(e); }
```

`grep -r nextEpisodeRefreshedAt couch/js/` returns zero matches. The CF expects a field the client never produces. **The marquee Phase 15 push notification feature (TRACK-15-09 / D-13 — "new episode tonight" alerts) will not fire for a single title in production until this is fixed.**

The Sentry breadcrumb category `liveReleaseStale` will surface this on the first real-world hit, but stale-skip-rate-limited at most daily per title — meaning the production alarm is muted. Plan 15-06 SUMMARY line 115 grep-validated `nextEpisodeRefreshedAt` ≥1 occurrence in `functions/index.js` (3 found), but never grep-validated it on the client side.

**Fix:**
Stamp the timestamp at the same write site where TMDB details are persisted:

```js
// js/app.js around line 7314 — openDetailModal's TMDB details persist branch
const details = await fetchTmdbDetails(mediaType, tmdbId);
const update = { detailsCached: true };
Object.keys(details).forEach(k => { if (details[k] !== undefined && details[k] !== null) update[k] = details[k]; });
// Phase 15 / HIGH-4 — CF live-release sweep skips titles whose nextEpisode is stale
// (>7 days without refresh). Stamp the refresh timestamp whenever we re-pull TMDB
// details so the sweep can distinguish fresh from stale data. Without this stamp,
// every title is treated as permanently stale and the live-release push never fires.
if (update.nextEpisode) {
  update.nextEpisodeRefreshedAt = Date.now();
}
try { await updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...update }); } catch(e){ console.error(e); }
```

Also stamp at the other TMDB-details-persist sites if any (Trakt sync, manual refetch). Add a smoke test: in production, after fixing, manually open a tracked TV show in the detail modal, verify `nextEpisodeRefreshedAt` appears in Firestore. Then wait for next hourly sweep — Sentry breadcrumb `liveReleaseStale` count should drop materially for tracked titles.

**Severity rationale:** This kills a marquee feature in production while looking healthy in CI. Verification artifacts list "live-release push fires from watchpartyTick" as the test case but it was never end-to-end verified post-deploy (15-VERIFICATION line 23 marked it as a deferred manual smoke).

---

## Warnings

### WR-01: `firestore.rules` source repo is out of sync with deployed (mirror) rules — `coWatchPromptDeclined` allowlist missing in source

**File:** `firestore.rules:181-194` (source) vs `~/queuenight/firestore.rules:182-200` (deploy mirror)
**Issue:**
Plan 15-08 Task 4 (REVIEW MEDIUM-9) explicitly extended the family-doc 5th UPDATE branch's `affectedKeys().hasOnly([...])` to include `'coWatchPromptDeclined'` so the `cv15CoWatchPromptDecline` write would pass rules. The patch landed in `~/queuenight/firestore.rules` (deploy mirror, line 199):

```
.hasOnly(['tupleNames', 'coWatchPromptDeclined', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

But the **source repo's `firestore.rules` (line 193)** still has the old 5-key allowlist:

```
.hasOnly(['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

`scripts/deploy.sh` lines 104-113 do NOT copy `firestore.rules` to the mirror — the mirror is hand-edited. Tests at `tests/rules.test.js:22` load `RULES_FILE = path.resolve(__dirname, '..', 'firestore.rules')` (the source file), so:

1. **Tests do not exercise the deployed allowlist** — any test for `coWatchPromptDeclined` would fail today.
2. **Next deploy is fragile** — if anyone re-edits `firestore.rules` in the source repo and rsyncs blindly, the mirror's MEDIUM-9 patch is overwritten. Production decline-persistence regresses silently.

In-app code at `js/app.js:1057-1090` already accepts that the write may fail (try/catch + Sentry breadcrumb) "until 15-08 extends the family-doc 5th UPDATE branch allowlist," but the comment doesn't acknowledge that the source-repo file is permanently out-of-sync.

**Fix:**
Bring the source-repo `firestore.rules` in line with the mirror. Single-line patch around line 193:

```
.hasOnly(['tupleNames', 'coWatchPromptDeclined', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

Plus a test in `tests/rules.test.js`:

```js
await it('#33 authed member writes coWatchPromptDeclined → ALLOWED', async () => {
  await assertSucceeds(
    member.doc('families/fam1').set({
      coWatchPromptDeclined: { 'm_UID_MEMBER,m_UID_OWNER': 1234567890 },
      actingUid: UID_MEMBER, memberId: 'm_UID_MEMBER', memberName: 'Member',
    }, { merge: true })
  );
});
```

Also add a CI-level (or RUNBOOK) check that `diff couch/firestore.rules queuenight/firestore.rules` is empty, OR roll `firestore.rules` into the deploy.sh mirror copy step.

---

### WR-02: Title-doc `actingTupleKey` regex check is vulnerable to regex-injection via attacker-controlled `memberId`

**File:** `firestore.rules:397-404`
**Issue:**
The Phase 15 / REVIEW HIGH-1 per-tuple isolation rule constructs a runtime regex from the payload's `memberId`/`managedMemberId`:

```
request.resource.data.actingTupleKey
  .matches(
    '(^|.*,)' +
    (...managedMemberId... ? request.resource.data.managedMemberId : request.resource.data.memberId) +
    '(,.*|$)'
  )
```

`validAttribution()` (lines 59-66) only enforces that `actingUid == auth.uid` — it does NOT validate that `memberId` corresponds to the auth UID. An authenticated family member can therefore set `memberId` to ANY string, including regex meta-characters.

Attack:
1. Authenticated attacker (legit family member) issues `updateDoc(titles/x, { tupleProgress: { 'm_VICTIM,m_OTHER': {...} }, actingTupleKey: 'm_VICTIM,m_OTHER', memberId: '.*', actingUid: <attacker's uid> })`.
2. Constructed regex: `(^|.*,).*(,.*|$)`. This matches the attacker-controlled `actingTupleKey` regardless of whether the attacker's memberId actually appears in the tuple key.
3. The write succeeds; the attacker fabricates progress for a tuple they're not part of.

A more targeted variant: `memberId: 'm_[^,]*'` would match any tupleKey containing one segment.

The same payload-trust pattern applies to the `mutedShows` `hasOnly([memberId])` check on lines 420-424 — though that one is exact-match (no regex), it still trusts the attacker-controlled `memberId` field. A signed-in family member can pass `memberId: 'm_VICTIM'` + `actingUid: <self UID>` and silence the victim's notifications by writing `mutedShows.m_VICTIM = true`.

The `managedMemberId` branch IS protected (it does a `get()` on the member doc and verifies `managedBy == uid()`), so the proxy-acted path is safe. But the unprotected `memberId` field is the attack surface.

**Fix:**
Anchor `memberId` (and `managedMemberId`) to a safe character class before letting it influence the regex or hasOnly check. Add to the title-doc UPDATE rule:

```
&& request.resource.data.memberId is string
&& request.resource.data.memberId.matches('^m_[A-Za-z0-9_-]+$')
&& (
  !('managedMemberId' in request.resource.data)
  || (request.resource.data.managedMemberId is string
      && request.resource.data.managedMemberId.matches('^m_[A-Za-z0-9_-]+$'))
)
```

Better still: enforce that `memberId` corresponds to a real member doc whose `uid == auth.uid`. The `validAttribution()` helper could be extended to do a `get(.../members/$(memberId)).data.uid == uid()` lookup (one extra rule read per write — cached per-request).

This finding doesn't apply only to Phase 15 — the same pattern exists across the rules file (`couchSeating`, `couchInTonight`, `tupleNames`, etc.), but Phase 15 introduced the regex-construction angle that makes it newly exploitable.

---

### WR-03: No test coverage for `coWatchPromptDeclined` write path (compounds CR-01 + WR-01)

**File:** `tests/rules.test.js` (no test exists; tests #23-#32 cover other Phase 15 paths)
**Issue:**
Tests #23-#26 cover `tupleNames`, #27-#32 cover the title-doc isolation matrix. None of the new Phase 15 tests writes `coWatchPromptDeclined`. Combined with WR-01 (source rules don't allow that field), this means the production decline-persistence cross-session UX is unvalidated end-to-end. The 15-08 SUMMARY line 386 explicitly defers the cross-session check to "Phase 15 verifier — requires real Trakt sync session" — the verifier marked it `human_needed`.

**Fix:** Add the test from WR-01's fix block (#33), plus a negative test (#34) that a stranger writing `coWatchPromptDeclined` is denied. This pins the contract and blocks regressions.

---

### WR-04: iOS Safari focus/save race in `cv15ShowRenameInput` — blur and Enter keydown can both fire `cv15SaveRenameInput`

**File:** `js/app.js:8924-8964`
**Issue:**
On iOS Safari (the primary target per CLAUDE.md), tapping outside the input or pressing the keyboard "return" fires events in this order: blur → keydown(Enter). Both `cv15RenameBlur` and `cv15RenameKeydown` call `cv15SaveRenameInput(input)` (lines 8934, 8939). Listener removal happens inside save (lines 8946-8947) BEFORE the `await setTupleName(tk, value)` resolves.

Because removeEventListener runs synchronously before the await, the second event handler IS unregistered in time for normal cases. **However**, there's a subtle Trakt-overlap-style race: if the user types into the input, then:
1. Taps outside (blur fires) → `cv15SaveRenameInput` called, listeners removed sync, then `await setTupleName(...)`.
2. The await suspends; flashToast 'Saved' fires after.
3. If the modal element is replaced via innerHTML during the rerender (line 8959), the input element is GC'd. Enter keydown can no longer fire on it.

So the race is technically benign in the happy path. BUT — `cv15RenameBlur` checks `ev.target.dataset.cancelled === '1'` (line 8938), implying the design was aware of cancel-then-blur ordering. The cancel path at line 8966-8979 sets `cancelled='1'` then calls renderDetailShell innerHTML wipe. If a user rapidly types Esc → tap outside, the order is keydown(Esc) → cancel runs → innerHTML wipes → blur fires on detached input. The `dataset.cancelled` check correctly skips. Acceptable.

**Real iOS-only quirk**: `input.focus(); input.select();` after `span.replaceWith(input)` may not actually focus on iOS Safari outside of a fresh user gesture. The replacement happens inside the click handler (delegated from `cv15HandleDetailModalClick`), which IS a user gesture, so this should work. But on iPad PWA in particular, dynamically-created inputs are known to fail focus reliably. Not verified in 15-VERIFICATION (test deferred to UAT).

**Fix:**
Two small hardenings:

1. Guard against double-save by stamping a sentinel before the await:
```js
async function cv15SaveRenameInput(input) {
  if (!input || input.dataset.saving === '1') return;
  input.dataset.saving = '1';
  // ... rest
}
```

2. Add to 15-HUMAN-UAT.md a specific test case: "On iPhone Safari PWA, open a tracked show's detail modal, tap the pencil icon, type a name, tap the on-screen Return key — the input should save and disappear within 500ms; no double-save observed in Firestore audit log." This covers the focus-reliability question.

---

## Info

### IN-01: `cv15-progress-row` inline `onclick` uses HTML-escaped `t.id` inside a JS string literal — defensive only, not exploitable today

**File:** `js/app.js:9190, 9197`
**Issue:**
`renderPickupWidget` renders `onclick="openDetailModal('${escId}')"` where `escId = escapeHtml(t.id)`. `escapeHtml` (utils.js:5) encodes `'` as `&#39;`, which the HTML parser decodes back to `'` before the JS engine sees it. If `t.id` contained `'`, this would break the JS string literal (XSS).

Today, all `t.id` values are `tmdb_<integer>` (verified at `js/app.js:6385, 7260, 12294`), so the attack surface is empty. But this is the ONE Phase-15 inline `onclick` site that escaped the MEDIUM-7 delegation conversion — every other Phase-15 click handler uses `data-cv15-action`. If a future plan introduces a different `t.id` shape (e.g. user-supplied IDs, IMDB IDs containing punctuation, manually-added titles using a uuid7 with hyphens), this becomes a real XSS.

**Fix:**
Convert these two onclick handlers to the same `data-cv15-action` delegated pattern used elsewhere in Phase 15:
```js
return `<div class="cv15-progress-row" data-cv15-action="openDetail" data-title-id="${escId}" style="cursor:pointer;">
  ...
  <button class="tc-primary" type="button" data-cv15-action="openDetail" data-title-id="${escId}">Continue</button>
</div>`;
```
Then attach a delegated listener on `#cv15-pickup-container` that calls `openDetailModal(trigger.dataset.titleId)`. Mirrors the 15-04 pattern exactly.

---

### IN-02: `resolveAutoTrackEpisode` Tier 4 ignores legacy `progressSeason`/`progressEpisode` fields

**File:** `js/app.js:11286-11296`
**Issue:**
Tier 4 (host-progress + 1 fallback) reads `(t.progress || {})[wp.hostId]` directly. `getMemberProgress` (line 8375) handles a legacy fallback for the current user where `t.progressSeason`/`t.progressEpisode` exist (pre-per-member tracking era). If the watchparty's host happens to be the current user AND only has legacy progress fields, Tier 4 returns null and we fall through to Tier 5 abort — `state._pendingTupleAutoTrack` stays null, the post-session "Mark S{N}E{M}? [Yes] [Edit]" affordance never appears.

Edge case is small: the host must be the current user AND have only legacy fields AND the wp itself doesn't carry `wp.episode` / `wp.queuedEpisode` / `wp.intent.proposedEpisode`. Unlikely but possible for users who haven't touched their progress since pre-Phase-3 days.

**Fix:**
Replace `(t.progress || {})[wp.hostId]` with a call through `getMemberProgress(t, wp.hostId)`:
```js
if (wp.hostId) {
  const hostProgress = (typeof getMemberProgress === 'function') ? getMemberProgress(t, wp.hostId) : (t.progress || {})[wp.hostId];
  if (hostProgress && hostProgress.season != null && hostProgress.episode != null) {
    return { season: hostProgress.season, episode: hostProgress.episode + 1, sourceField: 'host-progress-plus-1' };
  }
}
```

---

### IN-03: Plan said "between Cast and Reviews" — actual placement is between local Reviews and TMDB Reviews

**File:** `js/app.js:7470-7474`
**Issue:**
Gemini's REVIEWS.md "Strengths" entry praises "Placing the YOUR COUCH'S PROGRESS section (S2) within the detail modal specifically between Cast and Reviews is a thoughtful UX choice." The actual `renderDetailShell` order is:

```js
${similarHtml}
${renderDiaryForTitle(t)}
${renderReviewsForTitle(t)}            // local family reviews
${renderCv15TupleProgressSection(t)}   // <-- here
${renderTmdbReviewsForTitle(t)}        // TMDB community reviews
${renderWatchpartyHistoryForTitle(t)}
```

So the section is between FAMILY reviews and TMDB reviews — NOT between Cast and Reviews. UX impact is minor (still in a sensible spot), but the verification narrative claims a placement that doesn't match the code. Worth either re-ordering the renderDetailShell call to honor the plan's intent OR updating the planning narrative.

**Fix:** Reorder if "before Cast" was material to the UX rationale:
```js
${castHtml}
${renderCv15TupleProgressSection(t)}  // S2 — UI-SPEC §Surface insertion order
${renderDiaryForTitle(t)}
${renderReviewsForTitle(t)}
...
```
Otherwise, edit `15-04-SUMMARY.md` to reflect actual placement. Either is fine; pick one.

---

_Reviewed: 2026-04-27T07:07:35Z_
_Reviewer: Claude (gsd-code-reviewer, opus 4.7 1M)_
_Depth: deep — cross-file analysis including sibling repo `~/queuenight/functions/index.js` and rules-vs-mirror drift_
_Files reviewed: js/app.js (~999 added lines), css/app.css (~198 added lines), firestore.rules (~128 added lines), tests/rules.test.js (~202 added lines), app.html (5 added lines), ~/queuenight/functions/index.js (~191 added lines)_
