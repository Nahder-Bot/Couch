# Phase 26: Position-Anchored Reactions + Async-Replay — Research

**Researched:** 2026-05-01
**Domain:** Couch PWA — single-file no-bundler architecture; watchparty live-modal extension; Firestore `wp.reactions[]` schema additive change; replay-mode UX overlay on existing scaffold.
**Confidence:** HIGH (all claims verified against current `js/app.js` source; no external library lookups required — Phase 26 is pure intra-codebase work with one production-module reuse from `js/native-video-player.js`)

---

## Summary

Phase 26 is a **predominantly additive** schema + UX layer on top of three already-shipped foundations: Phase 7's `wp.reactions[]` array primitive, Phase 24's `wp.currentTimeMs` host broadcast, and Phase 15.5's "Past parties" stale-window surface. Every architectural decision needed for the planner is already locked in `26-CONTEXT.md` (D-01..D-11) and the UI Design Contract (`26-UI-SPEC.md` — locks the `runtimeSource` enum at 4 values, drift tolerance ±2s, scrubber 1-sec snap, replay banner copy `REVISITING` + *together again*, pagination 20, Wait Up = OFF, auto-play = render-but-not-auto-start).

The research found **only one terminology drift** between CONTEXT.md and the live source — the function called `sendReaction` in CONTEXT.md is named **`postReaction`** in production (`js/app.js:11932`). Every other code reference in CONTEXT.md and UI-SPEC.md verifies as correct (line numbers within ±5 of the live source for `renderWatchpartyLive`, `openWatchpartyLive`, `renderReactionsFeed`, `renderPastParties`, `renderWatchpartyHistoryForTitle`, `wpForTitle`, `archivedWatchparties`, `broadcastCurrentTime`).

Two architectural details surfaced from the verification pass that the planner should treat as research-confirmed facts:

1. **firestore.rules already allows the schema additions.** Phase 24 / REVIEWS M2 added a host-only field denylist on watchparty UPDATE (`firestore.rules:589-600`) covering `currentTimeMs / currentTimeUpdatedAt / currentTimeSource / durationMs / isLiveStream / videoUrl / videoSource / hostId / hostUid / hostName`. The `reactions` field is NOT in this denylist — non-host participants writing reactions with the new `runtimePositionMs` + `runtimeSource` sub-fields are permitted via the existing Path B allowance for non-host attributedWrite. **No firestore.rules changes anticipated for Phase 26.** Verification step belongs in the smoke / plan-checker phase.
2. **The Phase 24 broadcast write site already documents Phase 26 intent.** `js/app.js:11079-11103` (`broadcastCurrentTime`) carries inline comments stating `Phase 26 anchor` and `Phase 26 chooses replay strategy` and `tells Phase 26 not to anchor reactions to runtime position` — the schema is forward-compatible by intentional design, not by accident. Phase 26 is consuming a contract that was deliberately shaped for it.

**Primary recommendation:** Execute the locked plan as specified. The research surface is small because the design surface is already closed. Plan-phase should produce ~5 plans (schema-write integration, replay-modal render branch + scrubber, reactions-feed position-aligned subset, Past parties query expansion + title-detail bifurcation, smoke contract + CACHE bump deploy). Estimated total touch surface: ~600-900 lines of additive `js/app.js` (no new modules, no new HTML files), ~80-120 lines of `css/app.css`, one new `state.activeWatchpartyMode` slot in `js/state.js`, one new `scripts/smoke-position-anchored-reactions.cjs` smoke contract.

---

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Live-mode position capture:**
- **D-01:** Hybrid by wp state. Each reaction stamps `runtimePositionMs` + `runtimeSource` based on wp's current state at send time:
  - Player attached AND `wp.isLiveStream !== true` AND broadcast fresh (`Date.now() - wp.currentTimeUpdatedAt < STALE_BROADCAST_MAX_MS`) → derive `runtimePositionMs = wp.currentTimeMs + (Date.now() - wp.currentTimeUpdatedAt)`. Stamp `runtimeSource = 'broadcast'`.
  - No player OR stale broadcast → use this member's existing `elapsedMs`. Stamp `runtimeSource = 'elapsed'`.
  - `wp.isLiveStream === true` → `runtimePositionMs = null`. Stamp `runtimeSource = 'live-stream'`.
- **D-02:** Stale broadcast → fall back to `elapsedMs` (NOT extrapolate forever). Reuse `STALE_BROADCAST_MAX_MS` from `js/native-video-player.js`.
- **D-03:** Live streams stay wall-clock-only. `runtimePositionMs = null`, `runtimeSource = 'live-stream'`. Replay surface filters these out.

**Reaction schema (additive, no back-compat risk):** Two new fields on each reaction in `wp.reactions[]`:
```js
{
  // existing (unchanged): id, kind, text/emoji, elapsedMs, at, ...writeAttribution() spread
  runtimePositionMs: number | null,
  runtimeSource: 'broadcast' | 'elapsed' | 'live-stream' | 'replay',
}
```

**Replay-mode UX shape:**
- **D-04:** Auto-play with self-positioning scrubber as primary model. Scrubber range = TMDB title runtime → `wp.durationMs` → max observed `runtimePositionMs`. Drift tolerance Claude's discretion — leaning ±2s.
- **D-05:** Replay-mode reactions COMPOUND. Stamp with viewer's CURRENT `runtimePositionMs` (local replay clock position) + `runtimeSource: 'replay'` (locked in UI-SPEC). Write to `wp.reactions` via `arrayUnion`.
- **D-06:** Surface = variant of existing live modal. Reuse `#wp-live-modal-bg` / `#wp-live-content` (`app.html:1212-1213`). When `wp.status === 'archived'` AND user opts into replay, render replay variant.
- **D-07:** No push to original members on replay-mode reactions. Single-repo Phase 26 deploy. No new `reactionInReplay` eventType in queuenight CF.

**Replay entry point:**
- **D-08:** Dual entry points. Past parties (extend Phase 15.5 surface from 25h → all-time-paginated) + Title detail "Past watchparties for this title" section.
- **D-09:** All-time, paginated. Default page size 20 (locked).
- **D-10:** Hide parties with zero replay-able reactions. A "replay-able reaction" is one where `runtimePositionMs !== null` (i.e., `runtimeSource` is `'broadcast'` or `'elapsed'` or `'replay'`). Per-party filter happens client-side at list-render time.

**Retroactive migration:**
- **D-11:** NO backfill of pre-Phase-26 reactions. Phase 26 is a clean demarcation line. Pre-deploy parties stay invisible to replay surface. Planner MUST NOT add an opt-in "recover my history" affordance.

### Claude's Discretion (resolved by UI-SPEC, locked here)

The UI Design Contract (`26-UI-SPEC.md`, approved 2026-05-01) closes ALL Claude's Discretion items from CONTEXT.md. The planner MUST treat these as locked:

- **Drift tolerance:** ±2 seconds (UI-SPEC §2)
- **Scrubber granularity:** 1-sec snap (`step="1000"` ms) (UI-SPEC §2)
- **Scrubber range source priority:** TMDB runtime → `wp.durationMs` → max observed `runtimePositionMs` (+30s cushion) → 60min floor (UI-SPEC §2)
- **Replay banner copy:** `REVISITING` (Inter eyebrow, accent-colored) + *together again* (Instrument Serif italic sub-line) (UI-SPEC §Copywriting)
- **Pagination size:** 20 per page (UI-SPEC §4)
- **Title-detail "Past watchparties" section:** placed immediately after the existing (now-bifurcated, active-only) `Watchparties` block; sort most-recent-first; cap 10 rows (no in-section pagination); hide when empty (UI-SPEC §5)
- **Wait Up × replay:** OFF — `participants[mid].reactionDelay` ignored in replay mode; chip strip / slider hidden (UI-SPEC §Wait Up × replay)
- **Auto-play of `wp.videoUrl` in replay modal:** Render the player but do NOT auto-start. No `playerVars.autoplay`, no `<video autoplay>` attribute (UI-SPEC §6)
- **`runtimeSource: 'replay'` value:** locked as the 4th enum value (UI-SPEC §`runtimeSource` enum closure)
- **`runtimeSource` enum closure:** 4 values — `'broadcast' | 'elapsed' | 'live-stream' | 'replay'` (UI-SPEC §`runtimeSource` enum closure)
- **Smoke contract assertions:** ≥13 (5 helper-behavior + 6 production-code sentinels + 2 replay-list filter); UI-SPEC §7 enumerates all 13 and locks them

### Deferred Ideas (OUT OF SCOPE)

- Backfill of pre-Phase-26 reactions (D-11 explicitly rejects)
- Push notifications for replay reactions (`reactionInReplay` eventType — D-07 defers; no NOTIFICATION_DEFAULTS change; no queuenight CF work)
- Manual position scrubber on LIVE-mode modal for DRM / external parties (rejected as primary capture path)
- Multi-episode bingeable parties (S3E1 → S3E2 single party — out of scope per seed § Not-goals)
- Active host-paused-everyone-paused sync (out-of-scope from Phase 24; still out-of-scope here)
- Voice / video chat over the player (deferred to v3)
- Standalone "Memories" / "Replay" top-level surface (overkill for v2.0)
- Visual differentiation of `runtimeSource` in replay UX (all sources render uniformly per CONTEXT specifics)
- Sub-second drift tolerance / perfect sync (out of scope per seed § Not-goals)
- Title-detail in-section pagination (cap 10 rows; full history reachable via Past parties surface)
- Two-way bind between in-app player position and local replay clock (deferred to v2.1+)

---

## Phase Requirements

The planner will define new requirement IDs (recommended: `RPLY-26-*` for parity with existing `VID-24-*` style). Each D-XX in CONTEXT.md is the de-facto requirement source. The mapping below proposes the requirement set the planner can finalize:

| Proposed ID | Description | Source Decision | Research Support |
|----|-------------|----|-----|
| RPLY-26-01 | `postReaction` derives `runtimePositionMs` + `runtimeSource` per the 4-state hybrid (broadcast / elapsed / live-stream / replay) | D-01, D-02, D-03, D-05 | Position-derivation helper §2 below; `postReaction` integration site §1 |
| RPLY-26-02 | `derivePositionForReaction()` helper imports `STALE_BROADCAST_MAX_MS` from `js/native-video-player.js` | D-02 | Already-shipped export at `js/native-video-player.js:31` |
| RPLY-26-03 | `runtimeSource` enum closure: exactly `'broadcast' \| 'elapsed' \| 'live-stream' \| 'replay'` | UI-SPEC lock | §3 below |
| RPLY-26-04 | Replay-modal variant of `renderWatchpartyLive` gated on `state.activeWatchpartyMode === 'revisit'` (with `wp.status === 'archived'` as the eligibility gate) | D-04, D-06 | §4 below |
| RPLY-26-05 | Replay scrubber strip with 1-sec snap + ±2s drift tolerance + range source-of-truth precedence (TMDB → `wp.durationMs` → max observed → 60min floor) | UI-SPEC locks | §5 below |
| RPLY-26-06 | Reactions feed in replay variant uses position-aligned selection rule (skip `runtimePositionMs == null`; show if `r.runtimePositionMs ≤ localReplayPositionMs + 2000`); sort ascending by `runtimePositionMs` | D-04, UI-SPEC §3 | §4 below |
| RPLY-26-07 | Replay-mode reactions COMPOUND via `arrayUnion` to `wp.reactions` with `runtimeSource: 'replay'` and `runtimePositionMs = currentLocalReplayPositionMs` | D-05 | §1 below |
| RPLY-26-08 | `openWatchpartyLive(wpId, opts)` accepts `opts.mode === 'revisit'`; default behavior preserved when `opts` omitted | D-06, UI-SPEC §1 | §6 below |
| RPLY-26-09 | `renderPastParties` query expands from 5h-25h `WP_STALE_MS` window to all-time-paginated archived parties with `replayableReactionCount(wp) ≥ 1` filter | D-08, D-09, D-10 | §7 below |
| RPLY-26-10 | New `replayableReactionCount(wp)` helper filters `runtimePositionMs != null && runtimeSource !== 'live-stream'` | D-10 | §7 below |
| RPLY-26-11 | New `renderPastWatchpartiesForTitle(t)` section in `renderDetailShell` after the existing (bifurcated, active-only) `renderWatchpartyHistoryForTitle` block | D-08, UI-SPEC §5 | §8 below |
| RPLY-26-12 | `renderWatchpartyHistoryForTitle` bifurcated to active-only watchparties for the title | D-08, UI-SPEC §5 | §8 below |
| RPLY-26-13 | `state.activeWatchpartyMode = 'live' \| 'revisit'` slot added to `js/state.js`; cleared in `closeWatchpartyLive` | UI-SPEC §1 | §6 below |
| RPLY-26-14 | Wait Up × replay = OFF — `mine.reactionDelay` ignored in replay mode; chip strip / slider hidden | UI-SPEC §Wait Up × replay | §9 below |
| RPLY-26-15 | Replay banner: `REVISITING` eyebrow in `.wp-live-status` + *together again* italic-serif sub-line in `.wp-live-titleinfo` | UI-SPEC §Copywriting | §4 below |
| RPLY-26-16 | Auto-play of `wp.videoUrl` in replay modal: render but do NOT auto-start | UI-SPEC §6 | §10 below |
| RPLY-26-17 | `scripts/smoke-position-anchored-reactions.cjs` covers ≥13 assertions (5 helper-behavior + 6 production-code sentinels + 2 replay-list filter) | UI-SPEC §7 | §11 below |
| RPLY-26-18 | `sw.js` CACHE bump to `couch-v38-async-replay` (auto-via `bash scripts/deploy.sh 38-async-replay`) | CLAUDE.md project rule | §12 below |
| RPLY-26-19 | firestore.rules verification: confirm Phase 24 M2 currentTime denylist is scoped to `wp.*` top-level fields (NOT reaction sub-fields). NO rules edit expected. | CONTEXT.md verification gate | §13 below |
| RPLY-26-20 | Past parties Tonight tab inline link gating: hide-when-empty (`allReplayableArchivedCount === 0`) | UI-SPEC §4, first-week framing | §7 below |

---

## Project Constraints (from CLAUDE.md)

The planner MUST honor these constraints (extracted from `./CLAUDE.md`):

| Directive | Enforcement |
|-----------|-------------|
| **Single-file PWA, no bundlers, no npm dependencies** | Phase 26 adds zero npm deps; all logic lives in `js/app.js` + `js/state.js` (state slot only) + reuses `js/native-video-player.js` ES module. |
| **Never read `js/app.js` in full** (~16k lines, ~190K tokens) | Researcher used `Grep` + `Read(offset/limit)` exclusively. Planner MUST follow same pattern. |
| **Bump `sw.js` CACHE on every user-visible change** | Phase 26 = user-visible (new replay UI surface). Auto-bumped via `bash scripts/deploy.sh 38-async-replay`. |
| **Deploy via `bash scripts/deploy.sh <short-tag>` from couch repo root** | Single-repo deploy per D-07 (no queuenight CF work). |
| **Mobile Safari is primary surface** | UI-SPEC §Accessibility verifies all touch-target floors ≥44pt (scrubber thumb, play/pause, pagination, rows). |
| **No bundler / no build step** | Confirmed: Phase 26 introduces no toolchain. |
| **Test on mobile Safari (PWA + iOS home-screen)** | UAT scripts will cover iOS PWA standalone mode. |
| **Phase numbering safeguards** | Phase 26 slot is locked in `seeds/v2-watchparty-sports-milestone.md` (depends on Phase 24, hard ordering). No reassignment risk. |
| **No monetization / billing / plan-tier work** | Confirmed: Phase 26 is pure UX feature work. |
| **Atomic Firestore updates; per-family nesting preserved** | All reaction writes go through existing `families/{code}/watchparties/{id}` path via `arrayUnion`. No new collection paths. |
| **Public-by-design secrets unchanged** | TMDB key + Firebase web config remain client-side (Phase 26 reads `t.runtime` + `t.episode_run_time` from already-cached title docs). |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|--------------|----------------|-----------|
| Position derivation at reaction-send time | **Browser/Client** (single helper inside `js/app.js`) | — | Reads live runtime state (`wp.currentTimeMs`, `wp.currentTimeUpdatedAt`, `wp.isLiveStream`, `mine.startedAt`); no backend logic. Client is the only tier with both the broadcast read + the `elapsedMs` fallback context. |
| Reaction write with new sub-fields | **Browser/Client** (`postReaction` → `arrayUnion`) | **Database/Firestore** (storage; NO server-side validation per Phase 7 / 24 precedent — schema is client-enforced) | Existing pattern: reaction objects are client-built and `arrayUnion`'d as-is. No server validates emoji/text shape today; same posture for new fields. |
| Replay-mode rendering (scrubber + position-aligned reactions feed) | **Browser/Client** (`renderWatchpartyLive` branch + new render fn for scrubber strip) | — | Pure DOM/state work in the existing live-modal scaffold. No backend involvement. |
| Local replay clock advancement | **Browser/Client** (`requestAnimationFrame` tick + `Date.now()` deltas for tab-blur correctness per UI-SPEC §2) | — | Per-viewer state; never written to Firestore. Solo-by-definition replay model. |
| Past parties query (all-time archived + replay-able filter) | **Browser/Client** (consumes existing `state.watchparties` snapshot via `archivedWatchparties()` + filter) | **Database/Firestore** (existing `onSnapshot` already streams the entire watchparties subcollection) | Phase 7 already established the wp-collection-wide subscription. Phase 26 adds NO new query paths. |
| Title-detail "Past watchparties for this title" section | **Browser/Client** (new render fn inserted into `renderDetailShell`) | — | Filters in-memory `state.watchparties` by `titleId`. No new backend. |
| `replayableReactionCount` filter | **Browser/Client** (pure helper in `js/app.js`) | — | Predicate over the in-memory reactions array. |
| Pagination cursor (Past parties surface) | **Browser/Client** (`state.pastPartiesShownCount` per UI-SPEC) | — | All archived wps already loaded into `state.watchparties` via existing snapshot; pagination is purely a render-side slice. NO Firestore page cursor needed. |
| Schema permission for new reaction sub-fields | **Database/Firestore** (existing rules) | — | Phase 24 / REVIEWS M2 denylist is scoped to top-level `wp.*` fields; reaction sub-fields are NOT denied. NO rules edit needed. |
| `STALE_BROADCAST_MAX_MS` constant import | **Browser/Client** (already-shipped ES module `js/native-video-player.js`) | — | Phase 24 deliberately exported this for Phase 26 (RESEARCH §Code Insights confirms intent comment in source). |

**Why this matters:** Phase 26 has zero backend tier work. The architecture map confirms D-07's single-repo deploy assertion is well-founded — there is no responsibility that legitimately belongs to queuenight CFs. The one exception (push for replay reactions) is explicitly deferred.

---

## Standard Stack

### Core (already shipped — Phase 26 consumes verbatim)

| Module | Version | Purpose | Why Standard |
|--------|---------|---------|--------------|
| `js/native-video-player.js` | Phase 24 (shipped 2026-05-01) | Exports `STALE_BROADCAST_MAX_MS = 60_000` (D-02 dependency) and `VIDEO_BROADCAST_INTERVAL_MS = 5000` (informational) | Pure ES module; no DOM side effects; smoke-tested via dynamic `await import()` in `scripts/smoke-native-video-player.cjs`. Phase 26 STATIC-imports the constant from this file — same import pattern as Phase 24 already established. |
| `js/state.js` | Phase 14 baseline | `state` object with all per-session slots; Phase 26 adds `activeWatchpartyMode: 'live' \| 'revisit' \| null` | Existing pattern — every phase that adds session state extends this object. |
| `js/utils.js` `writeAttribution()` | Phase 5 / 15.1 | Spreads `actingUid + memberId + memberName + managedMemberId` into every Firestore write payload | Required by firestore.rules `attributedWrite()` predicate. Reaction writes already use this; Phase 26 changes nothing here. |
| `js/firebase.js` `arrayUnion`, `updateDoc`, `watchpartyRef` | Phase 7 | Atomic append to `wp.reactions[]`; targeted update of wp doc | Established Phase 7 pattern. Phase 26 reuses verbatim. |

### Supporting (Phase 26 introduces)

| Module/Helper | Purpose | Location | Why Inline (not new module) |
|---------------|---------|----------|------------------------------|
| `derivePositionForReaction(ctx)` | Pure helper implementing the 4-state D-01..D-03 + D-05 hybrid logic | Inside `js/app.js` near `postReaction` (~line 11930) | Helper is small (~30 lines), single consumer, depends on one external constant (`STALE_BROADCAST_MAX_MS`). A new module would add a file for one consumer. The smoke contract can still test it via the production-code-sentinel pattern (regex-grep `runtimeSource:` + `runtimePositionMs:` at the consumer site) plus pure-helper assertions if the planner exports the function on `window` for testing OR mirrors the helper inline in the smoke file like `smoke-decision-explanation.cjs` does for `buildMatchExplanation`. **Researcher recommends: mirror inline in smoke** (matches Phase 20 pattern; avoids `window.derivePositionForReaction` polluting global scope). Planner finalizes. |
| `replayableReactionCount(wp)` | Pure helper for D-10 filter | Inside `js/app.js` near `archivedWatchparties` (~line 2932) | One-liner predicate. Used by both `renderPastParties` query expansion AND the `allReplayableArchivedCount` Tonight-tab gating (RPLY-26-20). |
| `friendlyPartyDate(startAt)` | Pure helper for the date-format ladder (`Last night` / `Tuesday` / `Last Tuesday` / `April 12` / `April 12, 2025`) | Inside `js/app.js` near `formatStartTime` (line 2999) | New helper for the Past parties row subtitle line + Past watchparties row subtitle. Used in 2 sites. |
| `renderReplayScrubber(wp, durationMs, localPosMs)` | Renders the scrubber strip HTML | Inside `js/app.js` inside `renderWatchpartyLive`'s replay branch | Single consumer; closely coupled to surrounding render code. |
| `renderPastWatchpartiesForTitle(t)` | Renders the new title-detail section per UI-SPEC §5 | Inside `js/app.js` near `renderWatchpartyHistoryForTitle` (line 7942) | New render fn for one site. |
| `state.activeWatchpartyMode` | Session state slot | Add to `js/state.js` `state` object | Single-line addition to existing state initializer (`js/state.js:7`). |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Researcher Recommendation |
|------------|-----------|----------|---------------------------|
| Inline `derivePositionForReaction` helper | New `js/reactions-replay.js` ES module | Pro: full unit-testable surface via dynamic import (matches `smoke-native-video-player.cjs` pattern). Con: ~30 lines doesn't justify a new file; only one consumer; planner / executor needs to read+write 2 files instead of 1; sw.js SHELL pre-cache list grows by one URL. | **Inline.** Match `buildMatchExplanation` (Phase 20) pattern: helper in `js/app.js`, smoke mirrors inline. Reserve module-extraction for cases with ≥2 consumers OR ≥80 lines OR runtime-state interactions (like Phase 24's player lifecycle). |
| `state.activeWatchpartyMode` flag | Use `wp.status === 'archived'` as the implicit signal | Pro: zero state slot. Con: a watchparty can be `status === 'archived'` AND a viewer chooses to view it in *non*-replay legacy mode (e.g., scrolling the historical reactions list without engaging the scrubber). The mode is a **viewer choice**, not a wp property. Conflating them removes the option. | **Use the flag.** Cheap to add; explicit; matches UI-SPEC §1 wording ("State flag: `state.activeWatchpartyMode = 'revisit' \| 'live'`"). |
| Local replay clock via `setInterval(fn, 1000)` | `requestAnimationFrame` + `Date.now()` deltas (UI-SPEC §2) | `setInterval` drifts under tab-blur; rAF is paused under tab-blur; UI-SPEC requires `Date.now()` deltas to handle tab-blur correctness. | **rAF + Date.now() deltas** as UI-SPEC §2 locks. |
| Page cursor in Firestore for pagination | In-memory slice of `state.watchparties` (Phase 26 already loads ALL via existing snapshot) | Cursor would be premature optimization — at v2 scale, even 100 archived parties per family is ~50KB of in-memory data. Pagination is a render-side concern, not a fetch concern. | **In-memory slice.** Simpler; preserves single source of truth in `state.watchparties`. |

**Installation:** None. Zero npm dependencies introduced.

**Version verification:** N/A. All code is intra-repo. The one external constant (`STALE_BROADCAST_MAX_MS = 60_000`) was verified at `js/native-video-player.js:31` against the Phase 24 spec.

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌────────────────────────────────────────┐
                         │  USER posts reaction in LIVE watchparty │
                         └──────────────────┬─────────────────────┘
                                            │
                                            ▼
                       ┌──────────────────────────────────────────┐
                       │  postReaction(payload)  [js/app.js:11932] │
                       │   ├─ build base reaction obj              │
                       │   │   (id, writeAttribution, elapsedMs,   │
                       │   │    at, kind, text/emoji)              │
                       │   ├─ derivePositionForReaction(ctx)  ←─── NEW Phase 26
                       │   │   ├─ branch on wp.isLiveStream         │
                       │   │   ├─ branch on broadcast freshness     │
                       │   │   ├─ branch on player attached         │
                       │   │   ├─ branch on replay mode flag        │
                       │   │   └─ returns {runtimePositionMs, runtimeSource}
                       │   └─ updateDoc(wpRef, {                   │
                       │        reactions: arrayUnion(reaction),    │
                       │        lastActivityAt: Date.now(),         │
                       │        ...writeAttribution()})             │
                       └──────────────────┬───────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────────┐
                       │  Firestore /watchparties/{wpId}.reactions │
                       │  (rules: Path B non-host write — ALLOWED  │
                       │   because reactions is NOT in the         │
                       │   currentTime/video host-only denylist)   │
                       └──────────────────┬───────────────────────┘
                                          │
                                          ▼
                       ┌──────────────────────────────────────────┐
                       │  onSnapshot fans out to ALL family clients│
                       └──────────────────┬───────────────────────┘
                                          │
                                          ▼
        ┌─────────────────────────────────┴─────────────────────────────┐
        │                                                                │
        ▼                                                                ▼
┌──────────────────┐                                          ┌──────────────────────┐
│ LIVE viewers     │                                          │ FUTURE replayers     │
│ ─────────────    │                                          │ (next day / week / yr)│
│ renderReactionsFeed                                          │ ────────────────     │
│ existing live    │                                          │ openWatchpartyLive(  │
│ filter logic     │                                          │   wpId,              │
│ (Phase 7+15.5)   │                                          │   {mode:'revisit'})  │
│                  │                                          │                      │
│ NO scrubber      │                                          │ state.activeWatchparty│
│ NO position-aware│                                          │   Mode = 'revisit'   │
│ Wait Up active   │                                          │                      │
└──────────────────┘                                          │ renderWatchpartyLive │
                                                              │ branches:            │
                                                              │  ─ scrubber strip    │
                                                              │  ─ replay banner     │
                                                              │  ─ position-aligned  │
                                                              │    reactions feed    │
                                                              │  ─ Wait Up HIDDEN    │
                                                              │  ─ video player =    │
                                                              │    render but no auto│
                                                              │                      │
                                                              │ Local replay clock:  │
                                                              │  ─ rAF tick          │
                                                              │  ─ Date.now() deltas │
                                                              │  ─ ±2s drift window  │
                                                              │                      │
                                                              │ Compounding:         │
                                                              │ if user posts here,  │
                                                              │ stamp runtimeSource: │
                                                              │   'replay' +         │
                                                              │ runtimePositionMs =  │
                                                              │   localReplayPos     │
                                                              └──────────────────────┘

ENTRY POINTS to replay mode:
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Past parties surface (Phase 15.5 modal — extended)                   │
│    ├─ openPastParties()  [js/app.js:12134]                              │
│    └─ row tap → closePastParties();                                     │
│                openWatchpartyLive(wpId, {mode:'revisit'})              │
│                                                                         │
│ 2. Title detail "Past watchparties" section (NEW — D-08)                │
│    ├─ renderPastWatchpartiesForTitle(t) inside renderDetailShell        │
│    └─ row tap → closeDetailModal();                                     │
│                openWatchpartyLive(wpId, {mode:'revisit'})              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

Phase 26 introduces **zero new files** in `js/` (additive logic to `js/app.js` + one slot to `js/state.js`). The directory shape stays:

```
couch/
├── app.html                      # NO CHANGES (modal scaffold already shipped Phase 24)
├── css/
│   └── app.css                   # NEW: ~80-120 lines for .wp-replay-scrubber-strip,
│                                 #      .wp-live-revisit-subline,
│                                 #      .past-watchparties-* recipe
├── js/
│   ├── app.js                    # NEW: ~600-900 lines additive
│   ├── state.js                  # NEW: 1 slot (activeWatchpartyMode)
│   ├── native-video-player.js    # NO CHANGES (consumes existing export)
│   ├── firebase.js               # NO CHANGES
│   ├── constants.js              # NO CHANGES
│   └── utils.js                  # NO CHANGES
├── sw.js                         # NEW: CACHE bumped to couch-v38-async-replay
├── firestore.rules               # NO CHANGES (Phase 24 M2 denylist already correct)
└── scripts/
    ├── deploy.sh                 # NEW: smoke contract added to gate (one-line addition,
                                  #      matches Phase 24 pattern at deploy.sh §2.5)
    └── smoke-position-anchored-reactions.cjs   # NEW: ≥13 assertions per UI-SPEC §7
```

### Pattern 1: Position-Derivation Helper (4-state hybrid)

**What:** Pure helper that consolidates D-01..D-03 + D-05 branching into one function.

**When to use:** Called once per reaction post (live OR replay mode). Single consumer is `postReaction`.

**Signature (proposed — planner finalizes):**

```javascript
// Source: js/app.js (NEW, Phase 26 — proposed location near postReaction at line 11932)
//
// Computes {runtimePositionMs, runtimeSource} for a reaction at send time.
// Pure: no DOM reads, no Firestore writes; only reads its arguments.
//
// Args:
//   ctx.wp                   — the watchparty record (reads currentTimeMs, currentTimeUpdatedAt,
//                              isLiveStream)
//   ctx.mine                 — this member's participant record (reads startedAt, pausedAt,
//                              pausedOffset for elapsed-fallback path; or pass elapsedMs directly)
//   ctx.elapsedMs            — pre-computed elapsed (matches the call site already computes this
//                              at js/app.js:11940)
//   ctx.isReplay             — boolean; true when in replay variant (state.activeWatchpartyMode
//                              === 'revisit')
//   ctx.localReplayPositionMs — viewer's current local replay clock (only read when isReplay=true)
//
// Returns: { runtimePositionMs: number | null, runtimeSource: 'broadcast'|'elapsed'|'live-stream'|'replay' }
//
// Branch order (LOCKED — matches CONTEXT D-01..D-05 + UI-SPEC enum closure):
//   1. ctx.isReplay === true               → { localReplayPositionMs, 'replay' }
//   2. ctx.wp.isLiveStream === true        → { null, 'live-stream' }
//   3. broadcast fresh (within STALE_BROADCAST_MAX_MS) → { extrapolated, 'broadcast' }
//   4. otherwise (no broadcast / stale)    → { ctx.elapsedMs, 'elapsed' }
function derivePositionForReaction(ctx) {
  const wp = ctx && ctx.wp ? ctx.wp : {};

  // (1) Replay-mode compounding (D-05 — locked first because it overrides all live-mode logic)
  if (ctx && ctx.isReplay === true) {
    const pos = (typeof ctx.localReplayPositionMs === 'number' && isFinite(ctx.localReplayPositionMs))
      ? Math.max(0, Math.round(ctx.localReplayPositionMs))
      : 0;
    return { runtimePositionMs: pos, runtimeSource: 'replay' };
  }

  // (2) Live-stream — D-03 (no re-watchable timeline)
  if (wp.isLiveStream === true) {
    return { runtimePositionMs: null, runtimeSource: 'live-stream' };
  }

  // (3) Fresh broadcast — D-01 primary path
  const ct = (typeof wp.currentTimeMs === 'number' && isFinite(wp.currentTimeMs)) ? wp.currentTimeMs : null;
  const ctUpdatedAt = (typeof wp.currentTimeUpdatedAt === 'number' && isFinite(wp.currentTimeUpdatedAt))
    ? wp.currentTimeUpdatedAt : null;
  if (ct !== null && ctUpdatedAt !== null) {
    const sinceUpdate = Date.now() - ctUpdatedAt;
    if (sinceUpdate >= 0 && sinceUpdate < STALE_BROADCAST_MAX_MS) {
      return {
        runtimePositionMs: Math.max(0, Math.round(ct + sinceUpdate)),
        runtimeSource: 'broadcast'
      };
    }
  }

  // (4) Fallback — D-02 (no player / stale broadcast → elapsedMs proxy)
  const elapsed = (typeof ctx.elapsedMs === 'number' && isFinite(ctx.elapsedMs)) ? ctx.elapsedMs : 0;
  return { runtimePositionMs: Math.max(0, Math.round(elapsed)), runtimeSource: 'elapsed' };
}
```

**Integration site (`postReaction` at `js/app.js:11932-11954`) — proposed minimal edit:**

```javascript
// Source: js/app.js:11941-11947 (existing) — modified per Phase 26 D-01..D-05
async function postReaction(payload) {
  // ... existing guards unchanged ...
  const elapsedMs = computeElapsed(mine, wp);

  // NEW Phase 26: derive position-anchored fields
  const { runtimePositionMs, runtimeSource } = derivePositionForReaction({
    wp,
    mine,
    elapsedMs,
    isReplay: state.activeWatchpartyMode === 'revisit',
    localReplayPositionMs: state.replayLocalPositionMs   // populated by scrubber/clock when in replay
  });

  const reaction = {
    id: 'r_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    ...writeAttribution(),
    elapsedMs,
    at: Date.now(),
    runtimePositionMs,    // NEW Phase 26
    runtimeSource,        // NEW Phase 26
    ...payload
  };
  // ... existing updateDoc/arrayUnion call unchanged ...
}
```

**Note on `postBurstReaction` at line 10672:** This is a Phase 23 sports-mode amplified-reaction path that ALSO writes to `wp.reactions` via `arrayUnion`. The planner must decide whether to wire `derivePositionForReaction` into THIS site too. **Researcher recommendation:** YES — same hybrid logic applies; otherwise sports-watchparty reactions never get `runtimePositionMs`. Both call sites should converge on the same helper.

### Pattern 2: Replay-Variant Render Branch in `renderWatchpartyLive`

**What:** Inside the existing `renderWatchpartyLive()` function (`js/app.js:11424`), branch on `state.activeWatchpartyMode === 'revisit'` to render the scrubber strip ABOVE the coordination header, swap the `.wp-live-status` text from `Started …` to `REVISITING`, insert the italic-serif *together again* sub-line, hide the participants strip + Wait Up chips/slider + the live timer, and replace `renderReactionsFeed` with the position-aligned subset.

**When to use:** Single branch inside `renderWatchpartyLive`. The replay variant is read-time, not write-time — same wp record drives both modes. The mode is a viewer choice signaled by `state.activeWatchpartyMode`.

**Skeleton (proposed — planner finalizes specifics):**

```javascript
// Source: js/app.js renderWatchpartyLive() — proposed Phase 26 branch
// Insert near existing live-mode body construction (~line 11498+).

const isReplay = state.activeWatchpartyMode === 'revisit';

// Replay banner copy variants — UI-SPEC §Copywriting locks these
const statusText = isReplay
  ? 'REVISITING'
  : (preStart ? `Starts ${formatStartTime(wp.startAt)}` : `Started ${formatStartTime(wp.startAt)}`);

// Italic-serif sub-line (replay only) — appended to .wp-live-titleinfo
const revisitSubline = isReplay
  ? `<div class="wp-live-revisit-subline" style="font-family:'Instrument Serif',serif;font-style:italic;color:var(--ink-warm);">together again</div>`
  : '';

// Replay scrubber strip (replay only) — renders above the coordination header per UI-SPEC §1
const scrubberStrip = isReplay
  ? renderReplayScrubber(wp)
  : '';

// Hide the live-mode advisory timer in replay (scrubber readout replaces it)
const timerHtml = (mine && mine.startedAt && !isReplay)
  ? `<div class="wp-live-timer" id="wp-live-timer-display">${formatElapsed(computeElapsed(mine, wp))}</div>`
  : '';

// Wait Up chip strip / slider hidden in replay variant — UI-SPEC §Wait Up × replay
// (Existing renderWaitUpChips / renderDvrSlider call sites guarded with !isReplay)

// Reactions feed: live mode = renderReactionsFeed (existing); replay = position-aligned subset
const feedHtml = isReplay
  ? renderReplayReactionsFeed(wp, state.replayLocalPositionMs || 0)
  : renderReactionsFeed(wp, mine);

// Participants strip hidden in replay variant — UI-SPEC §1
// (Existing renderParticipantTimerStrip call site guarded with !isReplay)
```

### Pattern 3: Past Parties Query Expansion

**What:** Replace the existing `WP_STALE_MS` 5h-25h window in `renderPastParties()` (`js/app.js:12145`) with an all-time-paginated archived-parties query, filtered by `replayableReactionCount(wp) ≥ 1`.

**Existing code (lines 12148-12154):**
```javascript
const stale = activeWatchparties().filter(wp =>
  wp.status !== 'cancelled' &&
  wp.startAt <= now &&
  (now - wp.startAt) >= WP_STALE_MS
).sort((a, b) => b.startAt - a.startAt);
```

**Proposed Phase 26 replacement:**
```javascript
// Source: js/app.js:12145 renderPastParties — Phase 26 D-08 / D-09 / D-10
const PAST_PARTIES_PAGE_SIZE = 20;   // D-09 default leaning, locked in UI-SPEC §4

const allArchived = archivedWatchparties()   // existing helper at js/app.js:2932
  .filter(wp => wp.status !== 'cancelled')
  .filter(wp => replayableReactionCount(wp) >= 1)   // D-10 hide-empty
  .sort((a, b) => b.startAt - a.startAt);            // most-recent-first

const shownCount = state.pastPartiesShownCount || PAST_PARTIES_PAGE_SIZE;
const visible = allArchived.slice(0, shownCount);

// ... render rows ...

// Pagination "Show older parties" row — append below last row when more pages remain
const showOlderHtml = allArchived.length > shownCount
  ? `<div class="past-parties-show-older" role="button" tabindex="0"
        onclick="state.pastPartiesShownCount=(state.pastPartiesShownCount||${PAST_PARTIES_PAGE_SIZE})+${PAST_PARTIES_PAGE_SIZE};renderPastParties()"
        aria-label="Show older parties">Show older parties ›</div>`
  : '';
```

### Pattern 4: Title-Detail Bifurcation

**What:** The existing `renderWatchpartyHistoryForTitle(t)` at `js/app.js:7942` returns ALL watchparties for a title (active + archived) in one block. Phase 26 bifurcates this:
- **Existing block:** narrowed to active-only (`activeWatchparties().filter(wp => wp.titleId === t.id)`).
- **NEW block:** `renderPastWatchpartiesForTitle(t)` returns archived-only with replay-able reactions, sorted most-recent-first, capped at 10 rows, hidden when empty.

**Existing code (line 7943):**
```javascript
const related = state.watchparties.filter(wp => wp.titleId === t.id).sort((a,b) => b.startAt - a.startAt);
```

**Proposed Phase 26 bifurcation:**
```javascript
// Source: js/app.js:7942 renderWatchpartyHistoryForTitle — Phase 26 narrowed to active-only
function renderWatchpartyHistoryForTitle(t) {
  const related = activeWatchparties().filter(wp => wp.titleId === t.id);   // bifurcated: active-only
  if (!related.length) return '';
  // ... existing render unchanged ...
  // NOTE: status pill becomes redundant when set is active-only — planner may simplify.
}

// NEW Phase 26 (insert immediately after the call to renderWatchpartyHistoryForTitle in renderDetailShell):
function renderPastWatchpartiesForTitle(t) {
  const past = archivedWatchparties()
    .filter(wp => wp.titleId === t.id)
    .filter(wp => replayableReactionCount(wp) >= 1)   // D-10
    .sort((a,b) => b.startAt - a.startAt)
    .slice(0, 10);   // UI-SPEC §5: cap 10 rows; full history via Past parties surface
  if (!past.length) return '';   // D-10 silent-UX: hide section entirely when empty
  return `<div class="detail-section">
    <h4>Past watchparties</h4>
    <p class="detail-section-subline"><em>Catch up on what the family said.</em></p>
    <div class="past-watchparties-for-title-list">
      ${past.map(wp => renderPastWatchpartyRow(wp, t)).join('')}
    </div>
  </div>`;
}
```

### Anti-Patterns to Avoid

- **DO NOT extrapolate `runtimePositionMs` off a stale broadcast.** D-02 explicitly forbids this. If `Date.now() - wp.currentTimeUpdatedAt > STALE_BROADCAST_MAX_MS`, fall back to `elapsedMs`. Extrapolating off a 30-min-old `currentTimeUpdatedAt` would stamp reactions at fictional positions forever.
- **DO NOT visually penalize `runtimeSource: 'elapsed'` reactions in replay UX.** No faded color, no asterisk, no "approximate" badge. CONTEXT specifics: `'elapsed'` is first-class. UI-SPEC §3 reinforces this.
- **DO NOT add an opt-in "recover my history" affordance.** D-11 explicitly rejects backfill of pre-Phase-26 reactions. The user chose clean semantics over data preservation.
- **DO NOT split `wp.reactions` into `originalReactions` + `replayReactions`.** D-05 architectural framing: recursive family memory is one array. Replay-mode reactions are equal-weight to original-party reactions.
- **DO NOT add Wait Up offset on top of replay-mode position matching.** Double-shift. UI-SPEC §Wait Up × replay locks Wait Up = OFF in replay.
- **DO NOT auto-start the player in replay modal.** UI-SPEC §6 + CONTEXT default leaning. The viewer's IRL viewing is on a different surface (TV, second device) — auto-start would be confusing.
- **DO NOT mount/unmount reactions during active scrubber drag.** UI-SPEC §2: only `onchange` (drag end) re-evaluates. `oninput` updates the readout text + filled-track width only.
- **DO NOT re-fetch wps for pagination.** Phase 26 reuses the existing `state.watchparties` snapshot — pagination is a render-side slice, not a Firestore re-query.
- **DO NOT introduce a new HTML modal.** D-06 reuses `#wp-live-modal-bg` / `#wp-live-content`. The replay variant is a render-time branch inside `renderWatchpartyLive`, not a separate DOM scaffold.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Throttled position broadcast | A new throttle for replay-clock writes | NOTHING — the local replay clock is per-viewer-only and never written to Firestore | UI-SPEC §2: solo-by-definition replay model. No write traffic for the clock itself; only the COMPOUND reactions write. |
| Stale-broadcast threshold | A new constant in `js/app.js` | `import { STALE_BROADCAST_MAX_MS } from './native-video-player.js'` | Phase 24 already exported this for Phase 26's use (intent comment in source at line 30-31). Inventing a new constant would create drift. |
| Per-viewer reaction-render filter | Extend `renderReactionsFeed`'s elapsed/wallclock branching with a third 'position-aligned' mode | Write a NEW `renderReplayReactionsFeed(wp, localPosMs)` that's clean | The existing function (line 11713) is already complex with elapsed/wallclock/Wait-Up filter logic; bolting on a third mode obscures the live-mode contract. Replay rendering is sufficiently different (sort by `runtimePositionMs` not `elapsedMs`, no per-poster Wait-Up exemption, NO unmount on scrub-back per UI-SPEC §3) to warrant its own function. |
| Friendly date format | A `Date.toLocaleString()` one-liner with English-only fallbacks | `friendlyPartyDate(startAt)` helper with the explicit ladder (`Last night` / `Tuesday` / `Last Tuesday` / `April 12` / `April 12, 2025`) | UI-SPEC §Copywriting locks the exact ladder. A bare `toLocaleString` would produce "5/1/2026" — wrong tone. The ladder is friend-voice and bounded; deterministic implementation is ~20 lines. |
| Pagination cursor | A Firestore page-cursor mechanism for archived wps | An in-memory `state.pastPartiesShownCount` slice over the existing `state.watchparties` snapshot | All wps already loaded; cursor would be dead code. |
| New Firestore subscription for archived wps | A separate `query(collection, where('status', '==', 'archived'))` | The existing `state.watchparties` snapshot already has them | Phase 7's snapshot is wp-collection-wide. Filtering is client-side. |
| Local replay clock with `setInterval` | A polling loop | `requestAnimationFrame` + `Date.now()` deltas | UI-SPEC §2 locks this. `setInterval` drifts under tab-blur; rAF naturally pauses; the `Date.now()` delta on resume reconciles. |
| YouTube embed sizing for replay variant | A new `.wp-replay-video-frame` CSS recipe | The existing `.wp-video-frame` (`css/app.css:1614-1623`) | UI-SPEC §6: render-but-not-auto-start uses the EXISTING Phase 24 player surface verbatim. Zero CSS delta. |
| Replay-mode entry signal | A separate `openReplayWatchparty(wpId)` function | Extend `openWatchpartyLive(wpId, opts)` with `opts.mode` parameter | UI-SPEC §1 locks this. Single entry-function preserves Phase 24's lifecycle (attach/teardown video player) without forking. |

**Key insight:** Phase 26 is unusually low on hand-roll risk because the upstream phases (7, 15.5, 24) already shaped the substrate. The primary discipline is **resisting the urge to extract** — every new helper has 1-2 consumers; modularity here is over-engineering.

---

## Runtime State Inventory

> **NOT APPLICABLE** — Phase 26 is a greenfield UX feature on top of an existing data model. No rename, no refactor, no string replacement, no migration. D-11 explicitly **rejects** backfill of pre-Phase-26 reactions, so there is no migration sub-task. New reactions stamped with the new fields go forward; old reactions stay as-is and are silently filtered out by `replayableReactionCount`'s null check.
>
> **Verified by:** D-11 lock + the proposed `replayableReactionCount` predicate handles `r.runtimePositionMs === undefined` (pre-Phase-26 reactions) by returning `false` (the `r.runtimePositionMs != null` check fails for undefined). UI-SPEC §4 codifies this in the helper signature.

---

## Common Pitfalls

### Pitfall 1: Reaction-write race between live snapshot and replay compound
**What goes wrong:** A viewer is in replay mode (state.activeWatchpartyMode === 'revisit') for an *archived* wp, posts a reaction → the optimistic local mount fires → 800ms later the `onSnapshot` fires with the authoritative server state, which now includes the reaction with `runtimeSource: 'replay'`. If the live-mode `renderReactionsFeed` filter is reused, it might re-mount the reaction in the wrong position (using elapsedMs instead of runtimePositionMs).

**Why it happens:** `renderReactionsFeed` and `renderReplayReactionsFeed` operate on the same `wp.reactions` array but with different sort+filter semantics. The replay variant's render path needs to be the one called when `state.activeWatchpartyMode === 'revisit'`.

**How to avoid:** Branch on `state.activeWatchpartyMode` at the call site inside `renderWatchpartyLive`, NOT inside `renderReactionsFeed`. Two distinct render functions, one branch point.

**Warning signs:** During UAT, post a reaction in replay mode and observe whether it appears at the scrubber position OR at the bottom of an elapsed-sorted list.

### Pitfall 2: Pre-Phase-26 reactions appearing in replay surface (D-11 violation)
**What goes wrong:** Pre-deploy reactions have `r.runtimePositionMs === undefined` (not `null`). A naive predicate `r.runtimePositionMs !== null` returns `true` for `undefined` — the reaction would be included.

**Why it happens:** JavaScript `undefined !== null` evaluates to `true`. The correct predicate is `r.runtimePositionMs != null` (loose-equality) which catches BOTH `null` and `undefined`.

**How to avoid:** The locked `replayableReactionCount` helper in UI-SPEC §4 uses `r.runtimePositionMs != null` (loose). Verify smoke assertion #13 (which includes a `{}` pre-Phase-26 reaction in the test fixture).

**Warning signs:** Smoke assertion #13 fails; OR Past parties surface shows pre-deploy parties on deploy day instead of being silent.

### Pitfall 3: Stale broadcast extrapolation produces fictional positions
**What goes wrong:** Host backgrounds the tab; `broadcastCurrentTime` stops firing; 5 minutes later, `wp.currentTimeUpdatedAt` is 5min stale; a reaction posted now naively extrapolates `currentTimeMs + 5*60*1000` → reaction stamped at minute 30 of a movie that's actually paused at minute 25.

**Why it happens:** The hybrid path needs the staleness check FIRST before extrapolating. Easy to forget when copy-pasting.

**How to avoid:** The `derivePositionForReaction` helper guards `sinceUpdate < STALE_BROADCAST_MAX_MS` BEFORE returning the broadcast-derived value. Smoke assertion #3 (stale broadcast → fall back to elapsedMs) covers this.

**Warning signs:** Smoke assertion #3 fails; OR replay UX shows reactions at positions that don't match the original moment.

### Pitfall 4: Player auto-start in replay modal
**What goes wrong:** Phase 24's `attachVideoPlayer(wp)` is called in `openWatchpartyLive` at line 11304 unconditionally when `wp.videoUrl` is set. If the YouTube IFrame Player is configured with `playerVars: { autoplay: 1 }` (it isn't today, but easy to add accidentally), the replay modal would auto-start the video — confusing because the viewer is on a TV elsewhere and the in-app audio would compete.

**Why it happens:** UI-SPEC §6 locks "render but do NOT auto-start" but the player attach path is shared with live mode where auto-start might be desirable for some surfaces.

**How to avoid:** Audit `attachVideoPlayer` (Phase 24 source — co-located with `openWatchpartyLive` lifecycle pair near line 11044) for `autoplay: 1` / `<video autoplay>` attributes. Confirm zero auto-start. Phase 26 should not introduce these. Smoke assertion (proposed addition for planner): regex-grep `js/app.js` for `autoplay` and ensure no production-code matches outside comments.

**Warning signs:** UAT user reports "the video started playing on its own" in replay mode.

### Pitfall 5: Reactions unmounted on scrub-backward
**What goes wrong:** Viewer scrubs from minute 25 back to minute 10 → naive implementation unmounts all reactions with `runtimePositionMs > 600000` → user loses sight of the family memory they were just looking at.

**Why it happens:** Naive selection rule `r.runtimePositionMs ≤ localReplayPositionMs + 2000` correctly INCLUDES past reactions, but if the implementation tracks a "shown set" and removes reactions when their position exceeds the local clock, scrub-backward would be destructive.

**How to avoid:** UI-SPEC §3 locks: "Reactions do not unmount when the viewer scrubs backward — once seen, they persist visible. This matches the family-memory framing: revisiting feels additive, not a destructive timeline." Implement as union (set of "ever shown in this session"), not as filter-on-each-render.

**Warning signs:** UAT user reports reactions disappearing when they scrub backward.

### Pitfall 6: Drag-induced rapid mount/unmount thrash
**What goes wrong:** Viewer drags scrubber across the entire timeline in 500ms → naive implementation fires reaction-mount logic on every `oninput` event → 100+ reactions try to fade in simultaneously → visual chaos + jank.

**Why it happens:** `<input type="range">` `oninput` fires continuously during drag (~60fps).

**How to avoid:** UI-SPEC §2 locks: "Reactions DO NOT fade in during active drag — only on `onchange` (drag end) does the position-aligned set re-evaluate." `oninput` updates ONLY the readout text + filled-track width.

**Warning signs:** Drag stutters; reactions flash on/off during drag; FPS drops during scrubber interaction.

### Pitfall 7: Title-detail "Past watchparties" empty-state regression
**What goes wrong:** Renderer outputs the `<h4>Past watchparties</h4>` heading + sub-line + empty list when no replay-able archived parties exist for the title → empty section sits in the detail modal with no rows.

**Why it happens:** D-10 hide-when-empty is easy to miss when the section header HTML is built unconditionally and only the row loop is conditional.

**How to avoid:** UI-SPEC §5 locks: `if (!past.length) return '';` BEFORE building the section HTML. Smoke could add a sentinel for `pastReplayableForTitle(t.id).length === 0` short-circuit.

**Warning signs:** UAT user opens a title-detail modal for a movie the family has never watched, sees an empty `Past watchparties` section.

### Pitfall 8: Tonight-tab inline link rendering when count is zero
**What goes wrong:** Phase 15.5 link `Past parties (N) ›` was gated on `staleWps.length > 0`. Phase 26 expands the count source to `allReplayableArchivedCount(state.watchparties)`. On deploy day, this count is 0 for existing families (D-11 + D-10 combination). If gating is removed by accident, the link renders as `Past parties (0) ›`.

**Why it happens:** Refactoring the count source while leaving the gating logic stale.

**How to avoid:** The locked rendering condition in UI-SPEC §4 is "only render link when `count > 0`". Smoke could add a sentinel that the gating check `if (count === 0) return '';` or equivalent appears at the link render site.

**Warning signs:** UAT user on deploy day sees a `Past parties (0) ›` link in the Tonight tab.

### Pitfall 9: `state.activeWatchpartyMode` not cleared on close
**What goes wrong:** Viewer opens replay modal, closes it via the X button or backdrop tap, then opens a *live* watchparty. Because `state.activeWatchpartyMode === 'revisit'` was never cleared, the live modal renders in replay variant.

**Why it happens:** `closeWatchpartyLive` at `js/app.js:11309-11317` clears `state.activeWatchpartyId = null` but doesn't know about the new flag.

**How to avoid:** Add `state.activeWatchpartyMode = null;` (or `'live'`) inside `closeWatchpartyLive`. This is a one-line change and should be covered by a smoke production-code sentinel: regex-grep for `activeWatchpartyMode = ` (the assignment) + ensure it appears in both `openWatchpartyLive` AND `closeWatchpartyLive`.

**Warning signs:** UAT user opens a replay modal, closes it, opens a live watchparty, sees the scrubber strip.

### Pitfall 10: Past parties pagination cursor cross-session leak
**What goes wrong:** Viewer scrolls through Past parties, taps `Show older parties` 4 times → `state.pastPartiesShownCount = 100`. Closes the modal. Re-opens later → still showing 100 rows (which is fine UX-wise) BUT the cursor never resets between distinct viewing sessions.

**Why it happens:** State slot lives on the long-lived `state` object.

**How to avoid:** Reset `state.pastPartiesShownCount = null` in `closePastParties()` (`js/app.js:12140`). The next open recomputes `shownCount = state.pastPartiesShownCount || PAST_PARTIES_PAGE_SIZE`.

**Warning signs:** Minor — most users won't notice. But planner should add the reset for cleanliness.

---

## Code Examples

### Example 1: `replayableReactionCount` helper

```javascript
// Source: js/app.js (NEW Phase 26 — proposed location near archivedWatchparties at line 2932)
//
// Counts reactions in a wp that are eligible for replay surface inclusion (D-10).
// Pre-Phase-26 reactions have r.runtimePositionMs === undefined; the != null
// (loose-equality) check correctly rejects both null AND undefined.
function replayableReactionCount(wp) {
  if (!wp || !Array.isArray(wp.reactions)) return 0;
  return wp.reactions.filter(r =>
    r.runtimePositionMs != null && r.runtimeSource !== 'live-stream'
  ).length;
}
```

### Example 2: `friendlyPartyDate` helper (date-format ladder)

```javascript
// Source: js/app.js (NEW Phase 26 — proposed location near formatStartTime at line 2999)
//
// Returns the friend-voice date string for a wp's startAt timestamp per UI-SPEC.
// Ladder: Started N hr ago (< 24h) | Last night (24-48h) | Weekday (within 6 days) |
//         Last Weekday (7-13 days) | Month Day (14d-current year) | Month Day, Year (cross-year)
function friendlyPartyDate(startAt) {
  const now = Date.now();
  const ageMs = now - startAt;
  const hr = ageMs / (60 * 60 * 1000);
  if (hr < 24) {
    const hours = Math.max(1, Math.floor(hr));
    return `Started ${hours} hr ago`;
  }
  if (hr < 48) return 'Last night';
  const day = ageMs / (24 * 60 * 60 * 1000);
  const d = new Date(startAt);
  const weekdays = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  if (day < 7) return weekdays[d.getDay()];
  if (day < 14) return `Last ${weekdays[d.getDay()]}`;
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const monthDay = `${months[d.getMonth()]} ${d.getDate()}`;
  const sameYear = d.getFullYear() === new Date(now).getFullYear();
  return sameYear ? monthDay : `${monthDay}, ${d.getFullYear()}`;
}
```

### Example 3: Scrubber range source-of-truth precedence

```javascript
// Source: js/app.js (NEW Phase 26 — inside renderReplayScrubber or as a separate helper)
//
// Per UI-SPEC §2 locked precedence:
//   1. TMDB title runtime (movies: t.runtime in minutes; TV: t.episode_run_time[0] in minutes)
//   2. Phase 24's wp.durationMs
//   3. Max observed runtimePositionMs across replay-able reactions + 30s cushion
//   4. Final floor: 60 minutes (3,600,000 ms)
function getScrubberDurationMs(wp) {
  // (1) TMDB title runtime
  const t = state.titles && state.titles.find(x => x.id === wp.titleId);
  if (t) {
    if (typeof t.runtime === 'number' && t.runtime > 0) {
      return t.runtime * 60 * 1000;   // movies (line 1172 / 7590)
    }
    // TV: t.episode_run_time stored as number in this codebase (line 28-29: dd.episode_run_time[0])
    if (typeof t.episode_run_time === 'number' && t.episode_run_time > 0) {
      return t.episode_run_time * 60 * 1000;
    }
  }
  // (2) Phase 24's wp.durationMs (set when host's player reports finite getDuration())
  if (typeof wp.durationMs === 'number' && wp.durationMs > 0) {
    return wp.durationMs;
  }
  // (3) Max observed runtimePositionMs + 30s cushion
  const positions = (wp.reactions || [])
    .map(r => r.runtimePositionMs)
    .filter(p => typeof p === 'number' && p > 0);
  if (positions.length > 0) {
    return Math.max(...positions) + 30000;
  }
  // (4) Final floor
  return 60 * 60 * 1000;
}
```

### Example 4: Replay-mode reaction selection rule

```javascript
// Source: js/app.js (NEW Phase 26 — renderReplayReactionsFeed)
//
// Per UI-SPEC §3 selection rule (locked):
//   - Skip if r.runtimePositionMs == null (covers 'live-stream' AND pre-Phase-26)
//   - Show if r.runtimePositionMs ≤ localReplayPositionMs + 2000 (within drift OR already passed)
//   - Hide if r.runtimePositionMs > localReplayPositionMs + 2000 (still future)
// Sort: ascending by runtimePositionMs.
//
// "Once seen, persist visible" semantic per UI-SPEC §3: maintain a session-set of
// shown reaction IDs that survives scrub-backward. Reset on modal close.
const DRIFT_TOLERANCE_MS = 2000;   // UI-SPEC §2 lock

function renderReplayReactionsFeed(wp, localReplayPositionMs) {
  const all = wp.reactions || [];
  const visible = all
    .filter(r => r.runtimePositionMs != null)
    .filter(r => r.runtimePositionMs <= (localReplayPositionMs + DRIFT_TOLERANCE_MS))
    .sort((a, b) => a.runtimePositionMs - b.runtimePositionMs);
  if (!visible.length) {
    return `<div class="wp-live-body" id="wp-reactions-feed">
      <div style="text-align:center;color:var(--ink-dim);font-size:var(--t-meta);padding:20px;">
        <em style="font-family:'Instrument Serif',serif;">Nothing yet at this moment.</em>
      </div>
    </div>`;
  }
  return `<div class="wp-live-body" id="wp-reactions-feed">${visible.map(r => renderReaction(r, 'replay')).join('')}</div>`;
}
```

---

## State of the Art

This section is intentionally short — Phase 26 is intra-codebase; "state of the art" is defined by the upstream Couch phases.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Reactions wall-clock indexed only (`at: serverTimestamp()`) | Reactions ALSO runtime-indexed (`runtimePositionMs` + `runtimeSource`) | Phase 26 (this phase) | Async-replay becomes possible; the "Red Wedding" use case unlocked. |
| Past parties surface bounded to `5h ≤ age < 25h` (Phase 15.5) | All-time-paginated archived (Phase 26 D-09) | Phase 26 | Family memory becomes browsable indefinitely; Firestore reads bounded by per-session pagination cursor. |
| `renderWatchpartyHistoryForTitle` mixed active+archived | Bifurcated: existing block = active-only; NEW block = `renderPastWatchpartiesForTitle` archived-only-with-replay | Phase 26 D-08 | Title-detail context for "what did we say last time we watched this" becomes a first-class entry point. |
| `wp.currentTimeMs` host broadcast unused by reactions (Phase 24 shipped the field; Phase 26 was the planned consumer) | Reactions consume the broadcast at send time (D-01) | Phase 26 | The deliberate Phase 24 / Phase 26 contract is realized; intent comments at `js/app.js:11079-11103` referenced "Phase 26 anchor" since 2026-05-01. |

**Deprecated/outdated:** Nothing. Phase 26 is purely additive; no Phase 7 / 15.5 / 24 patterns are deprecated.

---

## Validation Architecture

> Nyquist validation is **enabled** (`config.json: workflow.nyquist_validation: true`). This section is MANDATORY.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bespoke per-phase smoke contracts in CommonJS (Node `node scripts/smoke-*.cjs`); pattern established in Phase 18+ (8 contracts shipped through Phase 24). No npm test framework (jest/mocha) per CLAUDE.md no-bundler / no-deps constraint. |
| Config file | None — each smoke is self-contained, exits 0 on pass / 1 on fail. Wired into `bash scripts/deploy.sh` §2.5 as a deploy gate. |
| Quick run command | `node scripts/smoke-position-anchored-reactions.cjs` (Phase 26 NEW) |
| Full suite command | `bash scripts/deploy.sh --dry-run` (runs all smoke contracts as part of the deploy gate) — current 8 contracts: position-transform, tonight-matches, availability, kid-mode, decision-explanation, conflict-aware-empty, sports-feed, native-video-player; Phase 26 adds the 9th. |
| Phase gate | All smoke contracts green before `bash scripts/deploy.sh 38-async-replay`; HUMAN-UAT scripts in `26-HUMAN-UAT.md` (planner authors) before `/gsd-verify-work 26`. |

### Phase Requirements → Test Map

> Per UI-SPEC §7 lock: ≥13 assertions (5 helper-behavior + 6 production-code sentinels + 2 replay-list filter). Below maps each requirement to its test.

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RPLY-26-01 | `derivePositionForReaction` returns correct shape across 4 cases | unit (helper-behavior) | `node scripts/smoke-position-anchored-reactions.cjs` (assertions #1-#5) | ❌ Wave 0 |
| RPLY-26-02 | `STALE_BROADCAST_MAX_MS` import from `js/native-video-player.js` appears in production source | sentinel (regex-grep) | same smoke (assertion #11) | ❌ Wave 0 |
| RPLY-26-03 | `runtimeSource` enum values literal — `'broadcast'`, `'elapsed'`, `'live-stream'`, `'replay'` all appear in production source | sentinel (regex-grep) | same smoke (extend assertions to 4 enum-value sentinels) | ❌ Wave 0 |
| RPLY-26-04 | `wp.status === 'archived'` branch appears in `renderWatchpartyLive` (replay-variant gating) | sentinel | same smoke (assertion #8) | ❌ Wave 0 |
| RPLY-26-05 | Scrubber duration helper picks correct precedence (TMDB → durationMs → max observed → 60min floor) | unit (helper-behavior) | same smoke (NEW: 4 assertions for `getScrubberDurationMs` cases) | ❌ Wave 0 |
| RPLY-26-06 | `replayableReactionCount` filter behavior (D-10) | unit | same smoke (assertions #12, #13) | ❌ Wave 0 |
| RPLY-26-07 | `runtimeSource: 'replay'` literal appears at the compound write site | sentinel | same smoke (NEW assertion: regex-grep for `'replay'` in postReaction context) | ❌ Wave 0 |
| RPLY-26-08 | `mode: 'revisit'` literal appears in ≥2 call sites (Past parties row tap + Past watchparties for title row tap) | sentinel | same smoke (assertion #9) | ❌ Wave 0 |
| RPLY-26-09 | `archivedWatchparties()` invoked + `replayableReactionCount` filter applied in `renderPastParties` | sentinel | same smoke (regex-grep for both function names in `renderPastParties` context) | ❌ Wave 0 |
| RPLY-26-10 | `replayableReactionCount` helper appears in production source | sentinel | same smoke (assertion #10) | ❌ Wave 0 |
| RPLY-26-11 | `renderPastWatchpartiesForTitle` function defined + invoked in `renderDetailShell` | sentinel | same smoke (regex-grep for function declaration + call site) | ❌ Wave 0 |
| RPLY-26-12 | `renderWatchpartyHistoryForTitle` query narrowed to `activeWatchparties()` | sentinel | same smoke (regex-grep for `activeWatchparties()` inside the function body) | ❌ Wave 0 |
| RPLY-26-13 | `state.activeWatchpartyMode` slot exists in `js/state.js` AND assigned in `openWatchpartyLive` AND cleared in `closeWatchpartyLive` | sentinel | same smoke (3 regex-greps) | ❌ Wave 0 |
| RPLY-26-14 | Wait Up filter `mine.reactionDelay` IS NOT applied in replay variant — checked by sentinel that the replay-feed filter expression doesn't reference `reactionDelay` | sentinel (negative match) | same smoke (regex-grep) | ❌ Wave 0 |
| RPLY-26-15 | Banner copy strings `REVISITING` AND `together again` appear in production | sentinel | same smoke (2 regex-greps; whitespace-insensitive) | ❌ Wave 0 |
| RPLY-26-16 | NO `autoplay` attribute / `playerVars.autoplay` in production source | sentinel (negative match) | same smoke (regex-grep — should report 0 matches outside comments) | ❌ Wave 0 |
| RPLY-26-17 | Smoke contract ≥13 assertions (UI-SPEC §7 floor) | meta-assertion | smoke self-reports `total assertions: N` and exits 1 if N < 13 | ❌ Wave 0 |
| RPLY-26-18 | `sw.js` CACHE bumped to `couch-v38-async-replay` | manual (visible in `sw.js` post-deploy) | grep `sw.js` for `'couch-v38-async-replay'` | ❌ Wave 0 (auto-bumped at deploy time) |
| RPLY-26-19 | firestore.rules verification — Phase 24 M2 denylist scope check | manual + smoke (regex-grep) | smoke (NEW assertion: regex-grep `firestore.rules` for the denylist allowlist; assert `reactions` NOT in the list) | ❌ Wave 0 |
| RPLY-26-20 | Tonight tab inline link gating — `count > 0` check appears at link render site | sentinel | same smoke (regex-grep) | ❌ Wave 0 |
| Past parties pagination | `state.pastPartiesShownCount` slot used + `Show older parties ›` copy appears | sentinel | same smoke (2 regex-greps) | ❌ Wave 0 |
| Friendly date helper | `friendlyPartyDate` returns correct string for 5 fixture inputs (today, last night, weekday, last weekday, cross-year) | unit (helper-behavior) | same smoke (5 assertions) | ❌ Wave 0 |
| Drift tolerance | `DRIFT_TOLERANCE_MS = 2000` literal in production | sentinel | same smoke (regex-grep) | ❌ Wave 0 |
| Scrubber 1-sec snap | `step="1000"` (or equivalent) literal in scrubber HTML | sentinel | same smoke (regex-grep `wp-replay-scrubber` context) | ❌ Wave 0 |

**Total assertion count target:** ≥25 (well above UI-SPEC §7 floor of 13). Planner can prune to the 13-floor minimum or extend; researcher recommends ≥20 for robust coverage.

### Sampling Rate

- **Per task commit:** `node scripts/smoke-position-anchored-reactions.cjs` (Phase 26 smoke only — fast feedback during plan execution)
- **Per wave merge:** `bash scripts/deploy.sh --dry-run` (full 9-contract suite — Phase 18+ smoke gate ensures no cross-phase regression)
- **Phase gate:** Full suite green before `bash scripts/deploy.sh 38-async-replay`; then HUMAN-UAT scripts before `/gsd-verify-work 26`

### Wave 0 Gaps

- [ ] `scripts/smoke-position-anchored-reactions.cjs` — covers all RPLY-26-* requirements (NEW file; ~250 lines following `smoke-native-video-player.cjs` pattern)
- [ ] Smoke wired into `scripts/deploy.sh` §2.5 (one-line addition matching Phase 24 / Plan 24-01 wiring at deploy.sh)
- [ ] Smoke wired into `package.json` test script if applicable (verify Phase 24 pattern — Plan 24-01 added one)
- [ ] HUMAN-UAT scripts in `26-HUMAN-UAT.md` (planner authors after Plan 4 ships): replay-modal entry from Past parties, replay-modal entry from title-detail, scrubber drag + reaction fade-in at known position, compound-reaction posts to Firestore at correct position, hide-when-empty surfaces (deploy-day silence), Wait Up disabled in replay, video player render but no auto-start, drift tolerance ±2s feel, scrub-backward preserves shown reactions, post-deploy `couch-v38-async-replay` CACHE active.

*If no other gaps surface during plan-phase: above is the full Wave 0 backlog.*

---

## Security Domain

> Phase 26 is a UX feature on existing schema. Security surface is **read existing rules + verify no rule changes needed**. No new auth flows, no new sensitive data, no new credentials.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no — existing Phase 5 auth model unchanged; replay-mode reactions still go through `writeAttribution()` which carries `actingUid` + (optional) `managedMemberId` | — |
| V3 Session Management | no — existing per-family code + Firebase Auth session; Phase 26 adds no auth surface | — |
| V4 Access Control | yes — must verify the Phase 24 / REVIEWS M2 currentTime denylist on watchparty UPDATE remains enforceable; non-host participants writing `runtimePositionMs` + `runtimeSource` MUST NOT inadvertently unlock host-only fields | Existing `firestore.rules:577-603` Path A (host) + Path B (non-host with denylist) — verified scoped to top-level `wp.*` fields, not reaction sub-fields |
| V5 Input Validation | yes — `runtimePositionMs` is a number (or null); `runtimeSource` is one of 4 enum values; client-enforced (Phase 7 / 24 precedent: rules don't validate inner reaction shape) | Client validation in `derivePositionForReaction`; smoke assertions cover the enum closure |
| V6 Cryptography | no — no new crypto surface | — |

### Known Threat Patterns for Couch / Phase 26

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Spoofed `runtimePositionMs` to mis-anchor reactions in replay (e.g., post a reaction at minute 3 of a 90-min movie that's actually all-spoiler text) | Tampering | Same posture as existing reaction text/emoji — client-built, server-stored as-is, displayed to family. Mitigation = social trust (family-only scope) + viewer can ignore. NOT a security boundary. |
| `runtimeSource: 'broadcast'` spoofing to falsely claim broadcast-derivation when actually elapsed-derived | Repudiation | No data-integrity claim is made about `runtimeSource` — it's a source descriptor, not an attestation. UI-SPEC §3 explicitly: "all sources render uniformly". No mitigation needed. |
| Non-host writing `currentTimeMs` via reaction-write side-channel | Elevation of Privilege | **Already mitigated by Phase 24 / REVIEWS M2.** firestore.rules `wp.update` Path B `affectedKeys().hasAny([..., 'currentTimeMs', ...])` blocks any non-host write touching this field, regardless of whether the write site is reaction or other. |
| Replay-mode user posting reactions that flood `wp.reactions` array indefinitely | DoS / Cost | Existing Phase 7 reaction surface has no rate limit; same posture preserved. Family-only scope makes economic abuse vector negligible. NOT a v2 concern. |
| Pre-Phase-26 reactions appearing in replay surface (D-11 violation) | Information Disclosure (mild — pre-deploy reactions could leak to a context they weren't intended for) | The `r.runtimePositionMs != null` predicate in `replayableReactionCount` correctly excludes pre-Phase-26 reactions. Smoke assertion #13 covers. |

**Verification step for the plan-checker:**

1. Open `firestore.rules` → locate the `match /watchparties/{wpId}` block (lines 577-603).
2. Confirm Path B's `affectedKeys().hasAny([...])` denylist includes ONLY top-level `wp.*` field names: `currentTimeMs`, `currentTimeUpdatedAt`, `currentTimeSource`, `durationMs`, `isLiveStream`, `videoUrl`, `videoSource`, `hostId`, `hostUid`, `hostName`.
3. Confirm `reactions` is NOT in the denylist (verified — it isn't).
4. Conclude: non-host participants writing `wp.reactions = arrayUnion({..., runtimePositionMs, runtimeSource})` is permitted via `attributedWrite()` + Path B (denylist-not-touched).
5. **NO firestore.rules edit anticipated for Phase 26.** RPLY-26-19 codifies this verification as a smoke sentinel.

---

## Environment Availability

> Phase 26 is a code/config-only change — no new external tools, runtimes, or services. Skip is justified.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Smoke contracts (`node scripts/smoke-*.cjs`) | ✓ (already required for existing 8 smoke contracts) | per Phase 24 baseline | — |
| Firebase Hosting | Deploy via `bash scripts/deploy.sh` | ✓ (already required) | — | — |
| TMDB API | Reading `t.runtime` / `t.episode_run_time` for scrubber range | ✓ (data already cached on title docs from Phase 9 / 18) | — | Fall back to `wp.durationMs` per UI-SPEC §2; final floor 60min. NO new TMDB fetches needed. |
| YouTube IFrame API | Replay modal player render (Phase 24 reuse, render-but-no-auto-start) | ✓ (already required by Phase 24) | — | DRM-only titles → hide player surface (Phase 24 D-03 behavior unchanged) |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None.

---

## Phase 26 Smoke Contract — Specification Summary

> Per UI-SPEC §7 + research §11. The planner copies this into `scripts/smoke-position-anchored-reactions.cjs` task description.

**File:** `scripts/smoke-position-anchored-reactions.cjs` (NEW; ~250 lines following `smoke-native-video-player.cjs` pattern at `scripts/smoke-native-video-player.cjs`)

**Pattern:** Self-contained CJS script. Inlines a mirror of `derivePositionForReaction` (matches `smoke-decision-explanation.cjs` mirroring `buildMatchExplanation`) since the helper is in `js/app.js` (an ES module not require-able from CJS — see `smoke-decision-explanation.cjs` lines 5-9 for the rationale comment template). Imports `STALE_BROADCAST_MAX_MS` via dynamic `await import(pathToFileURL('../js/native-video-player.js').href)` (matches `smoke-native-video-player.cjs` Windows-portable file-URL form).

**Assertion floor (UI-SPEC §7 lock):** ≥13. Researcher recommendation: ≥20.

**Assertions (proposed; planner finalizes; UI-SPEC §7 are the locked minimum):**

**Helper-behavior (mirrored `derivePositionForReaction`):**

1. `derivePositionForReaction({ wp: { isLiveStream: true } })` returns `{ runtimePositionMs: null, runtimeSource: 'live-stream' }`.
2. `derivePositionForReaction({ wp: { currentTimeMs: 1500000, currentTimeUpdatedAt: Date.now() - 1000, isLiveStream: false } })` returns `{ runtimePositionMs: ~1501000 ±100, runtimeSource: 'broadcast' }`.
3. `derivePositionForReaction({ wp: { currentTimeMs: 1500000, currentTimeUpdatedAt: Date.now() - (STALE_BROADCAST_MAX_MS + 1000), isLiveStream: false }, elapsedMs: 60000 })` returns `{ runtimePositionMs: ~60000, runtimeSource: 'elapsed' }` (stale broadcast → elapsedMs fallback per D-02).
4. `derivePositionForReaction({ wp: {}, elapsedMs: 30000 })` returns `{ runtimePositionMs: ~30000, runtimeSource: 'elapsed' }` (no broadcast at all).
5. `derivePositionForReaction({ wp: {}, isReplay: true, localReplayPositionMs: 750000 })` returns `{ runtimePositionMs: 750000, runtimeSource: 'replay' }` (D-05).

**Helper-behavior (mirrored `replayableReactionCount`):**

12. `replayableReactionCount({ reactions: [{ runtimePositionMs: null, runtimeSource: 'live-stream' }] })` returns `0`.
13. `replayableReactionCount({ reactions: [{runtimePositionMs: 1000, runtimeSource: 'broadcast'}, {runtimePositionMs: 2000, runtimeSource: 'elapsed'}, {runtimePositionMs: null, runtimeSource: 'live-stream'}, {/* pre-Phase-26: no runtime fields */}] })` returns `2`.

**Helper-behavior (mirrored `friendlyPartyDate`) — proposed additional:**

14. Today (5h ago) → `Started 5 hr ago` (preserved from Phase 15.5)
15. 36h ago → `Last night`
16. 4 days ago → weekday name
17. 10 days ago → `Last {weekday}`
18. 200 days ago, same year → `Month Day`

**Helper-behavior (mirrored `getScrubberDurationMs`) — proposed additional:**

19. Title with `runtime: 142` → returns 8520000ms (142 × 60 × 1000)
20. Title without runtime, wp with `durationMs: 7200000` → returns 7200000ms
21. Both null, reactions max 1500000 → returns 1530000ms (max + 30s)
22. All null + no reactions → returns 3600000ms (60min floor)

**Production-code sentinels (regex-grep against `js/app.js`, `js/state.js`, `firestore.rules`):**

6. `runtimeSource:` literal appears at the `postReaction` write site (proves Phase 26 schema additions wired in).
7. `runtimePositionMs` literal appears at `postReaction`.
8. `wp.status === 'archived'` (or equivalent) branch appears in `renderWatchpartyLive` (proves replay-variant gating).
9. `mode: 'revisit'` literal appears in ≥2 call sites.
10. `replayableReactionCount` helper appears in production source.
11. `STALE_BROADCAST_MAX_MS` import from `js/native-video-player.js` appears in production source.

**Production-code sentinels — proposed additional:**

23. `state.activeWatchpartyMode` literal appears in `js/state.js` AND in `openWatchpartyLive` AND in `closeWatchpartyLive` (3 sentinels).
24. `REVISITING` AND `together again` literals appear in production source.
25. `friendlyPartyDate` AND `getScrubberDurationMs` AND `renderPastWatchpartiesForTitle` AND `renderReplayReactionsFeed` AND `renderReplayScrubber` function declarations all appear (5 sentinels).
26. NO `autoplay` (case-insensitive) match outside `/* */` or `//` comments (negative sentinel).
27. firestore.rules: `'reactions'` NOT present in the watchparty UPDATE denylist allowlist (negative sentinel — confirms Phase 26 scoping).

**Total assertion count target:** ≥27 (well above the 13-floor).

---

## CACHE Bump Tag Proposal

**Current:** `couch-v37-native-video-player` (verified at `sw.js:8`; live on couchtonight.app per STATE.md curl-verified 2026-05-01T03:47:39Z; Phase 24 deploy).

**Phase 26 proposed CACHE name:** `couch-v38-async-replay`

**Rationale:**
- `v38` continues the linear major-bump sequence (v36 = Phase 18; v36.1 = Phase 19; v36.2 = Phase 20; v36.7 = Phase 23; v37 = Phase 24). Phase 26 is the next user-visible deploy after Phase 24.
- `async-replay` is the seed-doc name for this scope (see `seeds/phase-async-replay.md`); short-tag matches the canonical seed name.
- Auto-bumped via `bash scripts/deploy.sh 38-async-replay` (per CLAUDE.md deploy convention).

**Note on Phase 25 / 27 / 28 / 29 / 30 numbering:** Per `seeds/v2-watchparty-sports-milestone.md`, phase numbers 25, 29, 31 are intentionally skipped (combined phases). Phase 27 is independent of Phase 26 (Guest RSVP — could ship in either order). If Phase 27 ships before Phase 26, its CACHE would be `v38-guest-rsvp`, and Phase 26 would become `v39-async-replay`. **Researcher recommendation:** Lock the tag at plan-phase based on actual ship order; the deploy script auto-bumps regardless.

---

## Replay-Modal Player Surface Decision (Claude's Discretion — closed by UI-SPEC)

**Closed in UI-SPEC §6:** Render the player but do NOT auto-start.

**Researcher confirmation:** This is the right default. Reasoning:

- **Two-clock problem:** The viewer's IRL viewing surface is almost certainly NOT the Couch PWA player (TV, theater, second device with the show on Netflix). Auto-starting the in-app player would mean two simultaneous audio sources and zero sync.
- **Battery / data:** Auto-starting a YouTube embed on mobile burns battery + data with no user intent.
- **Affordance discoverability:** The native YouTube / `<video>` controls render unconditionally. Viewers who DO want the in-app player (rare case: their phone IS the viewing surface) tap the native play button. Zero new affordance to learn.
- **Phase 24 silent-UX precedent:** Phase 24 D-03 chose "hide DRM-only player entirely" over "show 'play on Netflix' message". Same posture — silent default + opt-in interaction.

**No further research needed.** UI-SPEC §6 implementation contract is correct.

---

## Wait Up × Replay Decision (Claude's Discretion — closed by UI-SPEC)

**Closed in UI-SPEC §Wait Up × replay:** OFF — `participants[mid].reactionDelay` ignored in replay mode; chip strip / slider hidden.

**Researcher confirmation:** This is the right default. Reasoning:

- **Double-shift problem:** Wait Up exists to spoiler-protect a viewer who is N seconds behind the live group (Phase 7 D-04 + Phase 15.5). In replay, the viewer is already CHOOSING their position via the scrubber. Adding a Wait Up offset on top would mean: viewer at scrubber-position 25:00 sees reactions from runtime-position 24:30 (with 30s Wait Up). That's confusing — they expect to see reactions from 25:00.
- **Per-receiver-only contract preserved:** Phase 15.5 D-06 locked Wait Up as per-receiver-only (never affects others). Phase 26 OFF-by-default in replay is consistent — no other viewer sees a difference.
- **No data-correctness implication:** UI-SPEC explicitly notes this is a UX choice, not a data-correctness one. The reaction's `runtimePositionMs` doesn't change; the viewer just doesn't apply the offset filter.

**No further research needed.** UI-SPEC implementation contract is correct.

---

## Replay Banner Copy (Claude's Discretion — closed by UI-SPEC)

**Closed in UI-SPEC §Copywriting:**
- Eyebrow (replaces `LIVE` / `WATCHING`): `REVISITING` (source string `Revisiting`; CSS `text-transform: uppercase`)
- Italic-serif sub-line: *together again* (Instrument Serif italic, `--ink-warm`, lowercase)
- Empty-state in feed: *Nothing yet at this moment.* (italic Instrument Serif, `--ink-dim`)
- Scrubber play/pause aria-labels: `Start watching from here` / `Pause where you are`
- Scrubber strip aria-label: `Move to where you are in the movie`

**Researcher confirmation:** All copy clears the Phase 15.5 + Phase 26 banned-words ledger (`scrubber`, `timeline`, `broadcast`, `replay` (as user-facing noun), `playback`, `runtime`, `position`, `index`, `delay`, `buffer`, `queue`, `offset`, `sync`, `lag`, `latency`, `timer`, `countdown`). Friend-voice register preserved. No em-dashes. Sentence-case. ONE italic-serif moment per surface (the *together again* sub-line).

**No further research needed.** Copy is locked; planner uses verbatim.

---

## Assumptions Log

| # | Claim | Section | Confidence | Risk if Wrong |
|---|-------|---------|------------|---------------|
| A1 | `postReaction` (`js/app.js:11932`) is the canonical reaction-write site for the live modal; CONTEXT.md / UI-SPEC.md "sendReaction" terminology is stale | §1 (Pattern 1 integration site) | [VERIFIED: js/app.js Grep + Read 11920-12000] HIGH | None — verified directly |
| A2 | `postBurstReaction` (`js/app.js:10672`) ALSO writes reactions via arrayUnion and SHOULD ALSO be wired to `derivePositionForReaction` | §1 (Pattern 1 note) | [VERIFIED: js/app.js Read 10670-10696] HIGH for the arrayUnion fact; researcher RECOMMENDATION for the wiring decision | If planner doesn't wire `postBurstReaction`, sports-watchparty amplified reactions never get `runtimePositionMs` → invisible to replay. Low family-impact (sports replay is rare use case) but inconsistent. |
| A3 | firestore.rules Phase 24 M2 denylist is scoped to top-level `wp.*` fields; `reactions` is NOT in the denylist; non-host participants writing reactions with new sub-fields is allowed | §13 + Security Domain | [VERIFIED: firestore.rules:577-603 Read in full] HIGH | If wrong, every reaction write from non-host participants in Phase 26 fails post-deploy. Smoke assertion #27 (negative sentinel) catches this at the smoke layer; rules-tests would catch at the deploy gate. |
| A4 | TMDB title runtime fields are `t.runtime` (movies, minutes) and `t.episode_run_time` (TV, minutes — stored as a single number, not array, per existing code at line 28-29 + 1172) | §3 (Example 3) | [VERIFIED: js/app.js Grep `t\.runtime\|episode_run_time`] HIGH — confirmed in 2 different fetch sites (line 28-29 catalog backfill + 7590 detail fetch) both store as single number from `dd.episode_run_time[0]` | If wrong, scrubber duration falls through to `wp.durationMs` then max-observed then 60min floor — Phase 26 still works, just without TMDB-precision range. |
| A5 | `state.watchparties` Firestore subscription already includes archived wps (not just active); the existing snapshot is wp-collection-wide | §Architecture Map + Pattern 3 | [VERIFIED: js/app.js `archivedWatchparties` at line 2932 reads `state.watchparties.filter(wp => wp.status === 'archived' || ...)` — proves the snapshot includes archived] HIGH | If wrong, Past parties surface would be empty. Easy to test via existing 15.5 surface (which is non-empty for stale wps). |
| A6 | Phase 24's `wp.durationMs` is set on the wp record when host's player reports finite `getDuration()` | §3 (Example 3) + scrubber range | [VERIFIED: js/app.js:11091-11093 — `durationMs: (typeof durationSecondsOrNull === 'number' && isFinite(...) && > 0) ? Math.round(... * 1000) : null` shows the field is populated for non-live] HIGH | If wrong, scrubber falls through to max-observed or 60min floor. |
| A7 | `derivePositionForReaction` should be inline in `js/app.js` (not a new module); smoke mirrors inline | §Standard Stack alternatives + Pattern 1 | [ASSUMED based on Phase 20 pattern with `buildMatchExplanation`] MEDIUM | If planner extracts to `js/reactions-replay.js`, smoke shifts to dynamic-import pattern (matches `smoke-native-video-player.cjs`) — both are valid. Researcher recommendation is preference, not blocker. |
| A8 | `state.pastPartiesShownCount` reset in `closePastParties` is best practice (Pitfall 10) | §Common Pitfalls | [ASSUMED — UX cleanliness judgment] LOW-MEDIUM | If not implemented, the cursor leaks between sessions. Minor UX issue; user gets more rows than expected on re-open. Not a correctness bug. Planner can defer if scope-tight. |
| A9 | Phase 26 should wire the smoke into `bash scripts/deploy.sh §2.5` and `package.json` test script (matches Phase 24 / Plan 24-01 pattern) | §Wave 0 Gaps | [ASSUMED based on Phase 24 precedent] HIGH (well-established pattern) | If skipped, smoke runs manually only. Standard practice is to gate deploy on smoke; researcher strongly recommends wiring. |
| A10 | Phase 26 CACHE tag is `couch-v38-async-replay` (assuming Phase 26 ships next; Phase 27 hasn't been planned yet per STATE.md) | §CACHE Bump | [ASSUMED — depends on actual ship order] HIGH at time of writing; deploy script auto-bumps if order changes | If Phase 27 ships first, Phase 26 becomes v39. Trivial to update at deploy time. |
| A11 | `derivePositionForReaction` returning `'replay'` for `isReplay=true` should NOT also emit `null` for `runtimePositionMs` even when `localReplayPositionMs` is undefined — defensive default to 0 | §1 (Pattern 1 helper) | [ASSUMED — defensive coding] MEDIUM | If `localReplayPositionMs` is somehow null/undefined when `isReplay=true`, defaulting to 0 means the reaction stamps at position 0, which is a reasonable degraded behavior (visible to all replayers) vs `null` which would be filtered out by D-10. |
| A12 | The Past parties Tonight inline link gating should use a NEW `allReplayableArchivedCount(state.watchparties)` helper (or inline `archivedWatchparties().filter(replayableReactionCount).length`) | §7 + RPLY-26-20 | [VERIFIED LOCATION: js/app.js Grep — Phase 15.5 link rendering needs to be located more precisely; the existing `Past parties (N) ›` link is rendered somewhere in `renderWatchpartyBanner` (line 11319) area] MEDIUM-HIGH | Planner needs to grep for the exact `Past parties` string in production source to find the existing inline-link render site. Researcher confirms the surface exists; planner finalizes the line offset. |

**If all `[ASSUMED]` items are confirmed during plan-phase user check-in:** Phase 26 can proceed to plan execution without further research.

---

## Open Questions (RESOLVED)

> All 5 open questions were absorbed by the planner during /gsd-plan-phase 26 (commit 1d963a9). Each `RESOLVED:` line below cites the plan + task that locks the answer.

1. **Should `postBurstReaction` (sports-mode amplified reactions) ALSO get `runtimePositionMs` + `runtimeSource`?**
   - What we know: `postBurstReaction` at `js/app.js:10672` writes to the same `wp.reactions` array via `arrayUnion`. CONTEXT.md / UI-SPEC.md only references `sendReaction` (= `postReaction`).
   - What's unclear: Whether sports-watchparty amplified bursts should appear in the replay timeline.
   - Recommendation: **YES, wire them too.** Sports parties (Phase 23+) have `wp.isLiveStream === true` very often → bursts get `runtimePositionMs: null, runtimeSource: 'live-stream'` → filtered out of replay anyway. For non-live sports replay (rare but possible — a re-broadcast game), the burst behaves correctly. Cost is one additional integration site (~5 lines). **Planner finalizes during plan-phase.**
   - **RESOLVED:** Plan 26-01 Task 1.3 wires `postBurstReaction` to `derivePositionForReaction` alongside `postReaction`, mirroring the same call signature.

2. **Should `state.replayLocalPositionMs` be a state slot or scoped to a render closure?**
   - What we know: The local replay clock advances every animation frame and is read by `renderReplayScrubber` + `renderReplayReactionsFeed` + the compound `postReaction` write site.
   - What's unclear: Whether to attach it to `state` (simpler cross-call access) or to a module-level closure inside the replay-render code path (less global pollution).
   - Recommendation: **Attach to `state`.** Three distinct call sites need to read it (scrubber render, feed render, postReaction). Module-level closure would require pass-through plumbing through `renderWatchpartyLive`. State slot is consistent with `state.activeWatchpartyMode` and `state.pastPartiesShownCount`. **Planner finalizes.**
   - **RESOLVED:** Plan 26-01 Task 1.1 adds `state.replayLocalPositionMs = null` to `js/state.js` initializer; Plans 26-02 / 26-03 wire the lifecycle (assign on open, advance via local clock, clear on close).

3. **Does the empty-state copy `Nothing yet at this moment.` need a "drag the scrubber" hint?**
   - What we know: UI-SPEC §3 locks the copy as italic Instrument Serif `Nothing yet at this moment.` with NO instruction copy ("silent UX preference per CONTEXT specifics").
   - What's unclear: Whether a first-time-user signal would help discoverability (could become a deferred polish if UAT shows confusion).
   - Recommendation: **Trust the UI-SPEC lock.** First-week-after-deploy framing means the surface starts empty for everyone — onboarding moments could be added in a v2.1+ polish if UAT demands. **No action for Phase 26.**
   - **RESOLVED:** Plan 26-03 Task 3.1 honors the UI-SPEC silent-UX lock — empty-state copy ships verbatim with no instructional hint; revisit only if HUMAN-UAT (Plan 26-05) surfaces discoverability friction.

4. **Should `friendlyPartyDate` use the user's locale for weekday names?**
   - What we know: UI-SPEC §Copywriting locks English weekdays (`Last night`, `Tuesday`, `Last Tuesday`, `April 12`, `April 12, 2025`). Couch is English-only at v2.
   - What's unclear: Whether to use `Date#toLocaleString()` (which would respect browser locale) vs hardcoded English.
   - Recommendation: **Hardcoded English** — matches existing Couch copy posture (no i18n surface anywhere in the app). **No action for Phase 26.**
   - **RESOLVED:** Plan 26-04 Task 4.1 implements `friendlyPartyDate` with hardcoded English weekday/month strings; smoke fixture `RPLY-26-DATE` covers 5 cases (today, last night, weekday, last weekday, cross-year) against literal expected outputs.

5. **What is the exact line offset for the Phase 15.5 `Past parties (N) ›` inline link rendering?** (RPLY-26-20 needs precise location for the gating-condition extension.)
   - What we know: Phase 15.5 D-04 added it; it lives somewhere in the Tonight-tab render path; CONTEXT.md says "location TBD by researcher."
   - What's unclear: Exact Grep target.
   - Recommendation: **Planner Grep `Past parties \\(` in `js/app.js`** at plan-phase (researcher attempted but the string is dynamic via template literal — would need to grep `Past parties` + filter to render-context lines). The code path is reachable via `openPastParties()` (line 12134) callback; the link rendering is upstream of that. Likely in `renderWatchpartyBanner` (line 11319) area.
   - **RESOLVED:** Plan 26-04 Task 4.2 `<read_first>` block instructs the executor to `Grep "Past parties" js/app.js` to pin the exact render site at execute-time, then extend the gating-condition with `allReplayableArchivedCount > 0`. RPLY-26-20 sentinel verifies the gate post-edit.

---

## Validation Architecture (D-XX → Verification Dimension Map)

> Per Nyquist gate: each D-XX maps to a verification dimension. The plan-phase reads this and creates `26-VALIDATION.md` from it.

| D-XX | Decision | Verification Dimension | Verifier |
|------|----------|------------------------|----------|
| D-01 | Hybrid by wp state (4 cases for position derivation) | Smoke assertions #1-#5 (helper-behavior across 4 wp-state inputs); UAT scripts cover each branch on real devices | Smoke + UAT |
| D-02 | Stale broadcast → elapsedMs fallback; reuse `STALE_BROADCAST_MAX_MS` from Phase 24 module | Smoke assertion #3 (stale → elapsed); production-code sentinel #11 (import statement) | Smoke |
| D-03 | Live streams → `runtimePositionMs = null`, `runtimeSource = 'live-stream'`; replay surface filters out | Smoke assertion #1 (live-stream branch); smoke assertions #12, #13 (replay-list filter rejects live-stream); UAT script for live-stream wp showing it doesn't appear in replay surface | Smoke + UAT |
| D-04 | Auto-play with self-positioning scrubber; range = TMDB / durationMs / max-observed / 60min floor; drift tolerance ±2s | Smoke assertions #19-#22 (scrubber duration precedence); production-code sentinels for `DRIFT_TOLERANCE_MS = 2000` literal + `step="1000"` literal; UAT scripts cover scrubber drag + reaction fade-in at known positions | Smoke + UAT |
| D-05 | Replay-mode reactions COMPOUND with `runtimeSource: 'replay'` | Smoke assertion #5 (`isReplay=true` → 'replay'); production-code sentinel for `'replay'` literal at compound write site; UAT script: post replay-mode reaction, observe in Firestore + visible to next replayer | Smoke + UAT + manual Firestore inspection |
| D-06 | Replay surface = variant of existing live modal; scaffold reused; gated on `wp.status === 'archived'` + `state.activeWatchpartyMode === 'revisit'` | Production-code sentinel #8 (archived branch in `renderWatchpartyLive`); production-code sentinel for `state.activeWatchpartyMode` slot in `js/state.js` + assignments in open/closeWatchpartyLive (sentinel #23); UAT scripts cover replay-modal entry from both Past parties + title-detail surfaces | Smoke + UAT |
| D-07 | No push to original members on replay reactions; single-repo Phase 26 deploy | Negative verification: confirm no `queuenight/functions/index.js` modification proposed in plan-phase; confirm `NOTIFICATION_DEFAULTS` unchanged; confirm no `reactionInReplay` eventType in source | Plan-checker review + manual code audit |
| D-08 | Dual entry points (Past parties expansion + title-detail "Past watchparties" section) | Production-code sentinels #9 (`mode: 'revisit'` in ≥2 call sites) + #11 (`renderPastWatchpartiesForTitle` declared); UAT scripts cover entry from both surfaces | Smoke + UAT |
| D-09 | All-time, paginated; default page size 20 | Production-code sentinel for `PAST_PARTIES_PAGE_SIZE = 20` literal + `Show older parties ›` copy + `state.pastPartiesShownCount` slot; UAT script: family with > 20 archived replay-able parties scrolls Past parties + taps Show older + verifies next page loads | Smoke + UAT |
| D-10 | Hide parties with zero replay-able reactions; `replayableReactionCount(wp) ≥ 1` filter | Smoke assertions #12, #13 (helper behavior); UAT scripts cover empty-state suppression on deploy day + Past watchparties section hidden when no replay-able for title | Smoke + UAT |
| D-11 | NO backfill; pre-Phase-26 parties stay invisible | Negative verification: smoke assertion #13 (pre-Phase-26 reaction with no runtime fields → counted as 0); no migration helper / opt-in CTA in plan-phase; UAT script: confirm deploy-day empty-state silence | Smoke + plan-checker review + UAT |

**Validation Architecture summary:** All 11 D-XX decisions are covered by smoke assertions OR plan-checker review OR UAT (most have multiple verification layers). Plan-phase produces `26-VALIDATION.md` with this matrix expanded into per-decision verification scripts.

---

## Sources

### Primary (HIGH confidence — VERIFIED via Read/Grep against current source)

- `js/app.js` — verified line offsets via Grep for: `postReaction` (11932), `renderWatchpartyLive` (11424), `openWatchpartyLive` (11284), `closeWatchpartyLive` (11309), `renderReactionsFeed` (11713), `renderPastParties` (12145), `renderWatchpartyHistoryForTitle` (7942), `renderDetailShell` (7837), `wpForTitle` (2936), `archivedWatchparties` (2932), `activeWatchparties` (~2920), `broadcastCurrentTime` (11084), `postBurstReaction` (10672 — second arrayUnion site), `WP_STALE_MS` (1934), `WP_ARCHIVE_MS` (1932), `formatStartTime` (2999), `formatElapsed` (2981), `effectiveStartFor` (2953), `computeElapsed` (2969), `myParticipation` (2937), `attachVideoPlayer` lifecycle (~11280), `openPastParties` (12134), `closePastParties` (12140)
- `js/native-video-player.js` — full read; confirms `STALE_BROADCAST_MAX_MS = 60_000` (line 31), `VIDEO_BROADCAST_INTERVAL_MS = 5000` (line 25), pure ES module with no DOM side effects
- `js/state.js` — full read; confirms `state.activeWatchpartyMode` is NOT yet present (Phase 26 will add it)
- `js/utils.js` — full read; confirms `writeAttribution()` shape; reaction writes already include `actingUid + memberId + memberName + (managedMemberId)` via existing call sites
- `firestore.rules` — full read; verified Phase 24 / REVIEWS M2 denylist scope at lines 577-603; `reactions` confirmed NOT in the denylist
- `app.html:1212-1213` — verified `#wp-live-modal-bg` / `#wp-live-content` scaffold; Phase 24 split into `#wp-video-surface` (1219) + `#wp-live-coordination` (1223)
- `app.html:1013` — verified `#past-parties-bg` modal scaffold (Phase 15.5)
- `sw.js` — full read; current CACHE = `couch-v37-native-video-player` (line 8)
- `scripts/smoke-native-video-player.cjs` (lines 1-80) + `scripts/smoke-decision-explanation.cjs` (lines 1-60) — confirm two valid smoke patterns: dynamic ES module import (Phase 24) and inline mirror (Phase 20)
- `scripts/deploy.sh` (lines 1-60) — confirms deploy ritual + `--allow-dirty` flag + `COUCH_DEPLOY_PATH` env-var convention
- `.planning/phases/26-position-anchored-reactions-async-replay/26-CONTEXT.md` — full read; 11 D-XX locked decisions
- `.planning/phases/26-position-anchored-reactions-async-replay/26-UI-SPEC.md` — full read; closes all CONTEXT Claude's Discretion items + locks 13 smoke assertions
- `.planning/phases/24-native-video-player/24-CONTEXT.md` — full read; broadcast schema source of truth
- `.planning/phases/15.5-wait-up-flex/15.5-CONTEXT.md` — full read; Past parties surface origin + per-receiver-only contract
- `.planning/phases/07-watchparty/07-CONTEXT.md` — full read; reactions array primitive (`wp.reactions[]` via `arrayUnion`); advisory per-member timer model
- `.planning/seeds/phase-async-replay.md` — full read; Sub-request B is scope anchor
- `.planning/seeds/v2-watchparty-sports-milestone.md` — full read; Phase 26 scoping in v2 plan
- `.planning/STATE.md` (offset 1, limit 100) — current Phase 24 ship status + production CACHE version
- `.planning/config.json` — full read; confirms `nyquist_validation: true`; `commit_docs: true`; `parallelization: true`

### Secondary (MEDIUM confidence — extrapolated from VERIFIED sources)

- Per-phase smoke contract pattern (Phases 18+) — extrapolated from 8 existing smoke files; pattern verified in `smoke-native-video-player.cjs` (Phase 24) + `smoke-decision-explanation.cjs` (Phase 20)
- TMDB title runtime field semantics (`t.runtime` for movies = number of minutes; `t.episode_run_time` for TV = number of minutes, stored as a single number from `dd.episode_run_time[0]`) — Grep-verified at `js/app.js:28-29, 1172, 7590, 7841, 5539, 5869, 6663, 8319, 8631, 9897` (15+ consistent usages)

### Tertiary (LOW confidence — flagged for plan-checker / user confirmation)

- (None — all material claims are HIGH confidence verified.)

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all helpers verified in source; `STALE_BROADCAST_MAX_MS` import path verified
- Architecture (Patterns 1-4): HIGH — all line offsets verified; `postReaction` integration site read in full
- Pitfalls: HIGH — derived from verified code patterns + UI-SPEC locks; covers known race + idempotency surfaces
- Smoke contract: HIGH — Phase 24 + Phase 20 patterns are proven references
- firestore.rules verification: HIGH — Phase 24 / REVIEWS M2 denylist scope read in full and confirmed
- Phase requirements (RPLY-26-*): HIGH — directly mapped from CONTEXT D-XX + UI-SPEC locks; planner can adopt verbatim or adjust IDs

**Research date:** 2026-05-01
**Valid until:** 2026-06-01 (30 days; pattern is stable, no fast-moving external deps)

**Researcher confidence in overall research quality:** HIGH. Phase 26 is unusually well-prepared by upstream artifacts (CONTEXT.md is exhaustive; UI-SPEC.md closes all open design questions; Phase 24 deliberately shaped its broadcast schema for Phase 26 consumption). The research surface is small because the design surface is closed. Planner can proceed with high confidence to plan generation.

---

*Phase: 26-position-anchored-reactions-async-replay*
*Research completed: 2026-05-01*
*Next step: gsd-planner consumes this RESEARCH.md to author plan files (~5 plans recommended: schema-write integration, replay-modal render branch + scrubber, reactions-feed position-aligned subset, Past parties query expansion + title-detail bifurcation, smoke contract + CACHE bump deploy).*
