---
phase: 15
plan: 03
subsystem: tracking-layer-d01-capture
tags: [tracking-layer, d-01-capture-trigger, REVIEW-MEDIUM-5, openPostSession-extension, mute-toggle-helper, future-ready-scaffolding]
requires:
  - "15-02 writeTupleProgress / writeMutedShow primitives (consumed by 15-04, NOT this plan)"
  - "15-02 tupleKey + isSafeTupleKey helpers (HIGH-2 char-safety guard chain)"
  - "Phase 7 watchparty doc (wp.titleId, wp.participants, wp.hostId — all present)"
  - "Phase 11 / REFR-09 openPostSession scaffolding at js/app.js:10708"
provides:
  - "resolveAutoTrackEpisode(wp, t) — REVIEW MEDIUM-5 4-tier episode-resolution waterfall (wp.episode → wp.queuedEpisode → wp.intent → host-progress-plus-1 → null)"
  - "openPostSession extension: stashes state._pendingTupleAutoTrack with titleId / memberIds / season / episode / sourceField / sourceWpId, gated to TV titles + non-empty wp.participants"
  - "window.toggleMutedShow(titleId) — S6 click handler that flips t.mutedShows[me.id] via writeMutedShow"
  - "Sentry breadcrumbs (category=tupleAutoTrack) — info-level for successful stash, warning-level for tier-5 abort"
affects:
  - "Plan 15-04 (S2 detail-modal section + auto-track confirmation row) — reads state._pendingTupleAutoTrack on post-session sub-render; may render different affordances by sourceField (e.g., '(best guess)' qualifier when sourceField === 'host-progress-plus-1')"
  - "Plan 15-04 (S6 mute toggle button) — wires inline onclick or delegated data-* listener to window.toggleMutedShow"
tech-stack:
  added:
    - "Future-ready 4-tier episode-resolution waterfall (REVIEW MEDIUM-5 mitigation)"
    - "state._pendingTupleAutoTrack module-state stash convention (single-shot per-actor handoff between Phase-7 watchparty-end and Phase-15 confirmation UI)"
    - "Sentry tupleAutoTrack telemetry category (info + warning levels)"
  patterns:
    - "Sibling-primitive insertion (Phase 14-05 convention) — toggleMutedShow lands immediately after writeMutedShow without modifying it"
    - "Additive openPostSession extension — early-return guards untouched, new block sits between _postSessionRating reset and the existing UI render (REFR-09 body unchanged)"
    - "window.* global naming for inline-onclick consumption (matches advanceEpisode / openPostSession / openProgressSheet convention)"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-03-SUMMARY.md (this file)"
  modified:
    - "js/app.js (137 net insertions across 2 contiguous regions)"
decisions:
  - "Field-shape Grep at execution time confirmed wp.episode / wp.queuedEpisode / wp.intent.proposedEpisode / wp.intent.proposedSeason are NOT yet stored on Phase 7 wp docs OR propagated by Phase 14-08 Flow B intents — meaning in production today only Tier 4 (host-progress + 1) will resolve. Tiers 1-3 are SHIPPED AS FUTURE-READY SCAFFOLDING with NO live producers yet. Documented inline in the resolveAutoTrackEpisode header comment so a future maintainer extending the wp schema can wire producer-side without touching this consumer."
  - "resolveAutoTrackEpisode helper landed at js/app.js:10729 (above _postSessionWpId / _postSessionRating module-locals, below the Phase 11 / REFR-09 header comment) — exactly per plan instruction 'IMMEDIATELY ABOVE window.openPostSession'"
  - "openPostSession stash block landed at js/app.js:10777-10828 (inside openPostSession, AFTER _postSessionRating = 0 reset, BEFORE the document.getElementById('wp-post-session-sub') line) — exactly per plan instruction"
  - "toggleMutedShow landed at js/app.js:8353-8372 (immediately after writeMutedShow's closing `}`, before window.advanceEpisode)"
  - "No openPostSession existing-body lines modified — diff is additions-only (137 / 0 verified via git diff against base)"
metrics:
  duration_seconds: 480
  duration_minutes: 8
  task_count: 2
  file_count: 1
  completed: "2026-04-27"
---

# Phase 15 Plan 03: D-01 Capture Trigger + Mute Toggle Wiring Summary

**One-liner:** Wires the D-01 watchparty-end auto-track capture: openPostSession now computes a REVIEW-MEDIUM-5-compliant 4-tier episode-resolution waterfall and stashes a `state._pendingTupleAutoTrack` candidate (with `sourceField` confidence label) for 15-04's confirmation UI to consume. Also exposes `window.toggleMutedShow(titleId)` as the S6 click target. Crucially, this plan does NOT itself write `tupleProgress` — the stash is consumed by 15-04, which calls `writeTupleProgress` only after explicit user [Yes] (D-06 anti-fabrication contract).

---

## What Shipped

### a) `resolveAutoTrackEpisode(wp, t)` helper — `js/app.js:10729`

Inserted IMMEDIATELY ABOVE the `_postSessionWpId` / `_postSessionRating` module-locals (which sit just above `window.openPostSession`). Implements REVIEW MEDIUM-5's 4-tier waterfall:

| Tier | Source | sourceField label | Status today |
|---|---|---|---|
| 1 | `wp.episode` + `wp.season` (direct fields) | `'wp.episode'` | future-ready (no producer in repo) |
| 2 | `wp.queuedEpisode {season, episode}` (object) | `'wp.queuedEpisode'` | future-ready (no producer in repo) |
| 3 | `wp.intent.proposedSeason` + `wp.intent.proposedEpisode` (Phase 14-08 Flow B inheritance) | `'wp.intent'` | future-ready (no producer in repo) |
| 4 | `(t.progress[wp.hostId].episode + 1)` fallback | `'host-progress-plus-1'` | **active in production** |
| 5 | abort (return `null`) | n/a | — |

Pre-conditions: returns `null` immediately when `!wp || !t || t.kind !== 'TV'` (movies + missing inputs short-circuit before any tier inspection).

### b) `openPostSession` D-01 stash extension — `js/app.js:10777-10828`

Inserted INSIDE `window.openPostSession`, AFTER the `_postSessionRating = 0;` reset (line 10776) and BEFORE the existing `const sub = document.getElementById('wp-post-session-sub');` line (line 10832). The early-return guards (`if (dismissed || alreadyRated) return;` at line 10772) remain unchanged — the stash only computes for actor-modal-opens that pass those guards.

Stash shape (only set when a tier resolves):

```javascript
state._pendingTupleAutoTrack = {
  titleId: wp.titleId,
  memberIds: wpParticipants,                  // Object.keys(wp.participants).filter(p.startedAt)
  season: resolved.season,
  episode: resolved.episode,
  sourceField: resolved.sourceField,          // one of the 4 tier labels
  sourceWpId: wpId
};
```

Gated on:
- `wp.titleId` present (orphan watchparties skipped)
- `wpParticipants.length >= 1` (no co-watchers → no stash)
- `t.kind === 'TV'` (movies excluded — no episode concept)
- A tier resolves (else tier-5 abort, no stash)

Stash is set to `null` at the top of every open (clears stale stash from prior watchparty's open).

### c) Sentry breadcrumbs — `category: 'tupleAutoTrack'`

| Level | When | Data |
|---|---|---|
| `info` | Stash succeeds | `{ sourceField, season, episode }` |
| `warning` | Tier-5 abort (no resolution) | `{ wpId, titleId }` |

Telemetry purpose: lets us observe in production (a) which tier wins how often (informs whether the future producer-side wp schema extension is worth shipping), and (b) how often we abort entirely (informs whether the threshold for "best-effort fallback" needs lowering).

### d) `window.toggleMutedShow(titleId)` — `js/app.js:8353-8372`

Inserted IMMEDIATELY AFTER `writeMutedShow`'s closing `}` (line 8351), BEFORE the existing `window.advanceEpisode` block. Pure convenience wrapper:

```javascript
window.toggleMutedShow = async function(titleId) {
  if (!titleId) return;
  const me = state.me;
  if (!me) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const currentlyMuted = !!(t.mutedShows && t.mutedShows[me.id]);
  await writeMutedShow(titleId, me.id, !currentlyMuted);
};
```

Per REVIEW HIGH-1, the 15-01 title-doc rule enforces server-side that `mutedShows.{memberId}` writes have `memberId === auth.uid` (or `managedMemberId` for proxy-acted writes). This helper passes `me.id` so the rule allows the write. No success toast — UI re-renders via title-doc onSnapshot will flip the affordance copy from "Stop notifying me about this show" to "Notifications off · Re-enable" (per UI-SPEC §Copywriting Contract).

---

## Field-Shape Discovery (mandatory per plan read_first)

Plan required: `Grep js/app.js for wp.episode|wp.season|wp.queuedEpisode|wp.intent|queuedEpisode` to discover actual field shape used in this codebase.

**Result: ZERO matches across the entire codebase** for any of:
- `wp.episode`
- `wp.season`
- `wp.queuedEpisode`
- `wp.intent` (as a property reference — `wp.intent.proposedSeason` / `wp.intent.proposedEpisode`)
- `proposedSeason` / `proposedEpisode` (anywhere — Phase 14-08 Flow B intents store `proposedStartAt` and `proposedNote` but NOT episode/season fields)

**Implication:** Phase 7 watchparty schema does NOT currently store any queued-episode metadata on the wp doc. Phase 14-08 Flow B intents do NOT propagate episode/season into a `wp.intent` field on the spawned watchparty. The current state of the repo means tiers 1-3 of the waterfall have NO live producers — only **Tier 4 (host-progress + 1)** can fire in production today.

**Why ship the waterfall anyway:**
1. **Plan instruction is explicit** — REVIEW MEDIUM-5 mitigation requires the consumer-side waterfall be present so that any future producer-side schema extension (in a follow-up plan) lights up tiers 1-3 without touching this code.
2. **Telemetry-aware** — the `sourceField` field on every stash records which tier resolved. Sentry breadcrumbs let us observe which tier wins. If we never see anything but `'host-progress-plus-1'` after wave-3 ships, that tells us the producer-side gap needs filling.
3. **Tier-5 abort path** — if the host has no progress AND we don't have queued-episode data, we abort the stash rather than fabricate. Sentry warning-level breadcrumb captures the rate so we know how often "best-effort" fails entirely.

This is documented inline in the `resolveAutoTrackEpisode` header comment (lines 10706-10727) so a future maintainer reading the helper sees the schema-gap context immediately.

**Recommended follow-up plan (NOT in 15-03 scope):** extend the Phase 7 `endMyWatchparty` write path (and/or `createIntent` → watchparty conversion in Phase 14-08) to stamp `wp.episode + wp.season` (Tier 1, simplest) or `wp.intent.proposedEpisode + wp.intent.proposedSeason` (Tier 3, preserves the intent-as-source-of-truth pattern). Either way the waterfall consumer is unchanged.

---

## Note for Plan 15-04

Three handoff contracts:

1. **`state._pendingTupleAutoTrack` shape** — see "What Shipped §b" above. Read this on post-session sub-render; render an inline "Mark S{N}E{M} for {tupleName}?" prompt with [Yes] / [Edit] buttons.
2. **`sourceField` confidence affordance** — when `sourceField === 'host-progress-plus-1'`, consider rendering a "(best guess)" qualifier or muted styling, since this is the lowest-confidence tier. Tiers `'wp.episode'` / `'wp.queuedEpisode'` / `'wp.intent'` are direct readings and warrant high-confidence affordances. (In production today only `'host-progress-plus-1'` will appear until the producer-side schema extension ships.)
3. **`window.toggleMutedShow(titleId)`** — wire S6 button via `<button onclick="toggleMutedShow('${t.id}')">` (inline) OR `data-cv15-action="muteToggle" data-title-id="${t.id}"` with a delegated listener (per REVIEW MEDIUM-7 if 15-04 chooses to migrate). Handler signature is stable either way.

---

## Forward-Contract Compliance (15-01 + 15-02)

This plan does **not** itself write `tupleProgress` or `mutedShows` — those writes happen in 15-04's [Yes]-button handler (which calls `writeTupleProgress` from 15-02) and via `window.toggleMutedShow` (which calls `writeMutedShow` from 15-02). Both downstream writers stamp the rule-required `actingTupleKey` / `writeAttribution()` payload per the 15-01 forward contract.

This plan's only Firestore-adjacent contract is on the consumer side: 15-04 reads `state._pendingTupleAutoTrack.memberIds` and passes that array to `writeTupleProgress(titleId, memberIds, season, episode, 'watchparty')`, which builds the tupleKey internally. We never call `setDoc` / `updateDoc` directly against `titles/{id}.tupleProgress` paths from 15-03 — the 15-01 forward-contract reminder in the executor prompt is satisfied by routing through 15-02's writer.

---

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written, including the documented schema-gap fallback (which the plan explicitly anticipated: *"If NO discovery yields a field that captures the queued episode (i.e., Phase 7 + 14-06 schemas literally do not store the episode on the wp doc and there is no intent linkage), document this in the SUMMARY and the resolveAutoTrackEpisode waterfall collapses to tier 4 (host-progress fallback) — at which point this plan's MEDIUM-5 mitigation is 'documented as best-effort, schema gap recorded for follow-up plan to extend wp shape.'"*).

### Auth gates / Human action

None. Pure JS edits; no auth needed.

### Items NOT changed (per scope)

- **No CSS** — Plan 15-04 ships `.cv15-*` styles for the post-session confirmation row + S6 button
- **No HTML** — Post-session modal scaffold already exists from Phase 11 / REFR-09 (`#wp-post-session-modal-bg`)
- **No CF changes** — Plan 15-06 ships watchpartyTick (CF-side D-13/D-14/D-16 work, no overlap with this plan's couch-side capture trigger)
- **No `writeTupleProgress` / `writeMutedShow` modification** — 15-02 primitives untouched; 15-03 only consumes them via the stash → 15-04 → writeTupleProgress chain
- **No service-worker bump** — Plan 15-09 ships the v35 cache bump
- **No `endMyWatchparty` modification** — per RESEARCH §Q9, `openPostSession` is the canonical hook (runs once per actor, has wp.participants in scope), NOT `endMyWatchparty` (runs only for the actor who tapped "Done")

---

## Verification Evidence

```
$ node --check js/app.js
(silent — exit 0; PASS)

$ grep -c "function resolveAutoTrackEpisode(wp, t)" js/app.js                              → 1 ✓
$ grep -c "// === Phase 15 / D-01 (TRACK-15-03)" js/app.js                                 → 2 ✓ (helper + openPostSession marker)
$ grep -c "state._pendingTupleAutoTrack" js/app.js                                         → 3 ✓ (1 null-out + 1 set + 1 inline comment)
$ grep -c "REVIEW MEDIUM-5" js/app.js                                                      → 2 ✓
$ grep -c "sourceField:" js/app.js                                                         → 6 ✓ (4 tier returns + 1 stash assignment + 1 Sentry data field)
$ for s in 'wp.episode' 'wp.queuedEpisode' 'wp.intent' 'host-progress-plus-1'; do
    grep -q "sourceField: '$s'" js/app.js && echo "OK: $s"
  done
  → ALL 4 tier labels present ✓
$ grep -c "if (dismissed || alreadyRated) return;" js/app.js                               → 1 ✓ (early-return guard preserved)
$ grep -c "window.toggleMutedShow = async function(titleId)" js/app.js                     → 1 ✓
$ grep -A6 "window.toggleMutedShow" js/app.js | grep -c "currentlyMuted"                   → 1 ✓
$ grep -A12 "window.toggleMutedShow" js/app.js | grep -c "writeMutedShow(titleId, me.id, !currentlyMuted)"  → 1 ✓

$ git diff e75cf01a..HEAD -- js/app.js | additions/deletions accounting
  → +137 lines / -0 lines (additions only — no existing function bodies modified)
```

Two contiguous regions modified:
1. `js/app.js:8353-8372` — `window.toggleMutedShow` insertion (20 lines incl. surrounding blank line + comment)
2. `js/app.js:10706-10828` — `resolveAutoTrackEpisode` helper (62 lines) + openPostSession stash block (52 lines)

---

## Commits (this worktree)

| Hash | Type | Subject |
|------|------|---------|
| `29238c5` | feat | add resolveAutoTrackEpisode + openPostSession D-01 stash |
| `fc02ebf` | feat | add window.toggleMutedShow click handler for S6 wiring |

---

## Self-Check: PASSED

Files exist:
- FOUND: `js/app.js` (modified — 2 contiguous regions, +137/-0)
- FOUND: `.planning/phases/15-tracking-layer/15-03-SUMMARY.md` (this file)

Commits exist:
- FOUND: `29238c5` in `git log --oneline -5`
- FOUND: `fc02ebf` in `git log --oneline -5`

All 9 success criteria from the plan satisfied:

1. ✓ js/app.js contains `resolveAutoTrackEpisode(wp, t)` helper implementing the 4-tier waterfall (wp.episode → wp.queuedEpisode → wp.intent → host-progress-plus-1 → null)
2. ✓ js/app.js openPostSession contains a Phase 15 / D-01 auto-track stash block AFTER the early-return guards and BEFORE the UI render code, calling resolveAutoTrackEpisode and stashing only if a tier resolves
3. ✓ The stash records `sourceField` so consumers + telemetry can distinguish confidence levels (Sentry breadcrumb data field includes it)
4. ✓ The stash populates `state._pendingTupleAutoTrack` only when wp.titleId + at least one participant with startedAt + t.kind === 'TV' AND a tier resolves
5. ✓ js/app.js exposes `window.toggleMutedShow(titleId)` immediately after writeMutedShow from 15-02 (verified via line numbers — 8336 → 8353)
6. ✓ toggleMutedShow flips t.mutedShows[me.id] via writeMutedShow (server-side 15-01 HIGH-1 rule enforces actor-only)
7. ✓ Sentry breadcrumbs land for both successful stash (info-level) and tier-5 abort (warning-level)
8. ✓ `node --check js/app.js` exits 0
9. ✓ No existing function body is modified beyond the additive insertions (git diff additions=137 / deletions=0)
