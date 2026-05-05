# Phase 26: Position-anchored reactions + async-replay - Context

**Gathered:** 2026-05-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Reactions become **runtime-indexed** (capture `runtimePositionMs` alongside the existing `at` / `elapsedMs`) so a viewer watching the same title later — next day, next week, next year — can experience the original group's reactions aligned to *their* playback position. The "Red Wedding" use case: at minute 25 of a solo viewing, see what the family said when they were at minute 25.

**In scope:**
- Schema additions on each reaction in `wp.reactions[]` — `runtimePositionMs` + `runtimeSource` fields (additive; no migration of existing data)
- Live-mode capture path: derive `runtimePositionMs` at reaction-send time from Phase 24's `wp.currentTimeMs` broadcast when fresh, fall back to per-member `elapsedMs` when no player / stale broadcast / DRM
- Replay-mode UX: a variant of the existing live modal that auto-plays reactions aligned to a self-positioned scrubber the viewer drags to "I'm at minute X"
- Replay-mode reactions compound — write back to `wp.reactions` so future replayers see them (recursive family memory)
- Dual entry points: extend the existing Phase 15.5 "Past parties" inline link from a 25h window to all-time paginated, AND add a "Past watchparties for this title" section on the title detail view
- Hide archived parties with zero replay-able reactions from both surfaces (silent dead-end UX per Phase 24 specifics)
- `sw.js` CACHE bump

**Out of scope (deferred to other phases or v2.1+):**
- Backfilling pre-Phase-26 reactions with `runtimePositionMs` from their existing `elapsedMs` (explicit user decision — clean Phase 26 demarcation preferred over data preservation)
- Push notifications for replay-mode reactions (no new `reactionInReplay` eventType; no queuenight CF work — single-repo Phase 26 deploy)
- Manual position scrubber on LIVE-mode modal for DRM / external parties (rejected as primary capture path; live mode uses hybrid auto-derivation only)
- Multi-episode bingeable parties (S3E1 → S3E2 single-party — preserves the one-title-per-party constraint from seed)
- Active host-paused-everyone-paused sync (out-of-scope from Phase 24; still out-of-scope here)
- Voice / video chat over the player (already deferred to v3)
- A standalone "Memories" / "Replay" top-level surface (overkill for v2.0; could be v2.1+ if usage proves family-history is a primary intent)

</domain>

<decisions>
## Implementation Decisions

### Live-mode position capture (the schema-shaping decisions)

- **D-01:** **Hybrid by wp state.** Each reaction stamps `runtimePositionMs` + `runtimeSource` based on the wp's current state at send time:
  - **Player attached AND `wp.isLiveStream !== true` AND broadcast fresh** (`Date.now() - wp.currentTimeUpdatedAt < STALE_BROADCAST_MAX_MS`) → derive `runtimePositionMs = wp.currentTimeMs + (Date.now() - wp.currentTimeUpdatedAt)`. Stamp `runtimeSource = 'broadcast'`.
  - **No player OR stale broadcast** → use this member's existing `elapsedMs` as the position proxy. Stamp `runtimeSource = 'elapsed'`.
  - **`wp.isLiveStream === true`** → `runtimePositionMs = null`. Stamp `runtimeSource = 'live-stream'`. Live broadcasts are not re-watchable on a runtime timeline; replay surface skips these.
- **D-02:** **Stale broadcast → fall back to `elapsedMs`** (NOT extrapolate forever). The `STALE_BROADCAST_MAX_MS` constant is already exported by Phase 24's pure-helpers ES module (`js/native-video-player.js`); reuse it. Rationale: extrapolating off a long-stale `currentTimeUpdatedAt` (e.g., host backgrounded the tab while paused) would stamp reactions at fictional positions forever in replay. Fallback to `elapsedMs` is honest about the data quality; replay UX can render `runtimeSource='elapsed'` reactions with the same fade-in but a future v2.1 polish could differentiate visually if needed.
- **D-03:** **Live streams stay wall-clock-only.** When `wp.isLiveStream === true`, do not attempt runtime indexing (`runtimePositionMs = null`, `runtimeSource = 'live-stream'`). Live streams do not have a re-watchable timeline (sports is a 3pm Sunday broadcast; news is yesterday's news). Replay surface filters `runtimeSource === 'live-stream'` reactions out of its timeline overlay; they remain in `wp.reactions` for any wall-clock-list views.

### Reaction schema (additive, no back-compat risk)

The existing reaction shape per `js/app.js:11949` (`{ id, memberId, memberName, elapsedMs, at, emoji }` → joined to `wp.reactions[]` via `arrayUnion`) gets two new fields:

```js
// reaction in wp.reactions[]
{
  // existing (unchanged)
  id, memberId, memberName, elapsedMs, at, emoji,

  // NEW in Phase 26
  runtimePositionMs: number | null,
  runtimeSource: 'broadcast' | 'elapsed' | 'live-stream',
}
```

Old reactions (no `runtimePositionMs`, no `runtimeSource`) keep working for live-mode delivery exactly as today — additive only. Per D-11 below, they are NOT backfilled; they simply are not surfaced in replay-mode.

### Replay-mode UX shape

- **D-04:** **Auto-play with self-positioning scrubber as primary model.** Replay surface opens with a horizontal timeline scrubber at top (range = title runtime from TMDB if known, else `wp.durationMs` if set, else max observed `runtimePositionMs` in the party). User drags to "I'm at minute X" (matches what they're watching IRL on whatever device). A local clock advances from that point; reactions fade in at their `runtimePositionMs` as the local position crosses each timestamp (drift tolerance Claude's discretion — leaning ±2s per seed). Pause/resume affordance preserves the user's current position on the scrubber.
- **D-05:** **Replay-mode reactions COMPOUND.** When a viewer in replay mode posts their own reaction, stamp it with their CURRENT `runtimePositionMs` (where they are on the local replay clock) + `runtimeSource: 'broadcast'` (or `'elapsed'` per D-01 if no fresh broadcast — but in practice replay mode always has a viewer-set position so `'broadcast'`-equivalent semantics apply; planner to confirm naming). Write to `wp.reactions` via `arrayUnion`. Future replayers see this new reaction land at the same moment. Recursive family memory grows.
- **D-06:** **Surface = variant of existing live modal.** Reuse `#wp-live-modal-bg` / `#wp-live-content` (`app.html:1176-1177`). When `wp.status === 'archived'` AND user opts into replay, the modal renders as a "replay variant": scrubber appears, reactions stream from `wp.reactions` history (sorted by `runtimePositionMs`) instead of via `onSnapshot`, banner / chrome reflects the replay state. If `wp.videoUrl` is still attached (Phase 24), the player surface can play in the replay modal too — researcher to scope whether playback is auto-started or user-initiated. Brand-restraint preserved by reusing existing chrome.
- **D-07:** **No push to original members on replay-mode reactions.** Single-repo Phase 26 deploy. No new `reactionInReplay` eventType in queuenight CF; no NOTIFICATION_DEFAULTS change. Replay reactions land silently in `wp.reactions`; original party members see them next time they (themselves) replay the party. Reinforces Phase 24's silent-UX preference and avoids the "show I finished a week ago keeps pinging me" feel. Deferred to v2.1+ if user demand surfaces.

### Replay entry point

- **D-08:** **Dual entry points.** Both surfaces route to the same replay-modal target:
  - **Past parties (extend Phase 15.5 surface)** — the existing Tonight-tab `Past parties (N) ›` link expands its window from `5h ≤ age < 25h` to ALL archived parties for this family. List view shows poster + title + date + member count + reaction count per row; tap → opens replay variant of live modal.
  - **Title detail "Past watchparties for this title"** — new section on the title detail view listing past parties for this family that featured this title. Contextual discovery for the "I'm watching this now solo, what did the family say when they watched" flow. Sort and copy details are Claude's discretion.
- **D-09:** **All-time, paginated.** Past parties list shows the most recent N archived parties (researcher to pick page size — default leaning 20) with a "show older" affordance to load more. Bounds Firestore reads per session; doesn't quietly hide history. Title-detail section follows the same pagination model if the family has ≥ N parties for that title (rare).
- **D-10:** **Hide parties with zero replay-able reactions** from both surfaces. A "replay-able reaction" is one where `runtimePositionMs !== null` (i.e., `runtimeSource` is `'broadcast'` or `'elapsed'`). Parties that have only `'live-stream'` reactions or only pre-Phase-26 reactions (per D-11) do not appear. Silent dead-end UX per Phase 24 specifics. Per-party filter happens client-side at list-render time (the Firestore query returns all archived; client filters).

### Retroactive migration

- **D-11:** **NO backfill of pre-Phase-26 reactions.** Pre-Phase-26 reactions remain wall-clock + `elapsedMs` only — they are NOT migrated to set `runtimePositionMs = elapsedMs`. Combined with D-10, this means **every watchparty archived before Phase 26 deploy is invisible to the new replay surface**. New parties created after deploy will populate Past parties going forward. User chose this against the recommendation — the preference signal is **clean semantics over data preservation**: a Phase 26 demarcation line where everything before lacks runtime-indexed reactions and everything after has them. The `elapsedMs` proxy (Phase 7 D-01 / D-03) is judged not trustworthy enough to claim as `runtimePositionMs`. Planner should NOT add an opt-in "recover my history" affordance — that's explicitly out of scope.

### Claude's Discretion

The user opted to leave these areas to research / planning rather than locking them now. Downstream agents have flexibility but should follow the implicit guidance below:

- **Drift tolerance for replay reaction matching** — how close does the viewer's local replay position need to be to a reaction's `runtimePositionMs` for it to "fade in"? Default leaning per seed: ±2s. Researcher / planner to confirm or revise based on UX testing.
- **Scrubber granularity** — 1-sec snap vs 5-sec snap; whether scrubber range comes from TMDB title runtime, `wp.durationMs`, or max observed reaction position. Default leaning: TMDB runtime if available (most accurate); fall back to `wp.durationMs`; fall back to max observed.
- **Replay modal banner / state copy** — friend-voice imperative per BRAND.md §6 (no em-dashes, sentence-case, no tech-mechanism words). Should signal "you're in replay" without being heavy-handed. Planner finalizes.
- **Past parties pagination size** — default leaning 20; researcher confirms based on Firestore read budget and typical wp-record size.
- **Title-detail "Past watchparties" section** — placement within detail view, sort order (most-recent-first vs reverse-chronological), empty-state behavior (hide section entirely if zero replay-able parties for this title). Researcher proposes during plan-phase.
- **Wait Up × replay interaction** — does `participants[mid].reactionDelay` (Phase 7 / 15.5) still apply in replay mode? Default leaning: NO — Wait Up is irrelevant in replay since the viewer is already choosing their moment via the scrubber. Adding Wait Up offset on top would be a double-shift. Planner finalizes; per Phase 15.5 D-06 contract (per-receiver-only, never affects others), this is a UX choice not a data-correctness one.
- **Auto-play of `wp.videoUrl` in replay modal** — if the archived party still has `wp.videoUrl` (Phase 24), should the player render and auto-start in replay mode? Trade-off: synchronizing the user's IRL viewing with an in-app player playback has product friction (they might be on a TV, not the phone). Default leaning: render the player but don't auto-start; viewer can opt to play in-app if their viewing surface allows. Researcher proposes.
- **Replay-mode reaction `runtimeSource` value** — D-05 noted ambiguity; planner picks final string (e.g., `'replay'` to distinguish replay-posted from broadcast-derived).
- **`runtimeSource` enum closure** — final set may be `'broadcast' | 'elapsed' | 'live-stream' | 'replay'` (4 values) or planner may collapse `'replay'` into one of the others. Lock in plan-phase.
- **Replay smoke contract assertions** — Phase 26 should add `scripts/smoke-position-anchored-reactions.cjs` per the per-phase smoke pattern (Phases 18+). Researcher / planner defines assertions: position-derivation helper output for {fresh-broadcast, stale-broadcast, no-player, live-stream} cases; replay-list filter (D-10 hide-empty); etc.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 26 origin + milestone scope
- `.planning/seeds/phase-async-replay.md` — Origin doc. Sub-request B is the scope anchor. The "Red Wedding" hero use case + the three open questions from § Open design questions are partially resolved here (live position source = D-01..D-03; replay UX shape = D-04..D-06; rejoin = D-08). Multi-episode parties + perfect sub-second sync stay deferred per § Not-goals.
- `.planning/seeds/v2-watchparty-sports-milestone.md` — Locked 6-phase v2 plan. Defines Phase 26 as the natural follow-on to Phase 24's `currentTime` broadcast.

### Phase 24 — broadcast schema source of truth
- `.planning/phases/24-native-video-player/24-CONTEXT.md` — Broadcast schema (D-04 + Claude's Discretion notes on cadence). 5s host-only writes; extended schema `{currentTimeMs, currentTimeUpdatedAt, currentTimeSource, durationMs, isLiveStream}`. DRM titles → no player surface → no broadcast (D-03). Phase 26's hybrid capture must respect all of these.
- `js/native-video-player.js` — Pure ES module with `STALE_BROADCAST_MAX_MS` + `VIDEO_BROADCAST_INTERVAL_MS` exports. D-02's stale-broadcast check imports from here.

### Phase 7 — reactions data shape (the foundation)
- `.planning/phases/07-watchparty/07-CONTEXT.md` — Reactions array primitive (`wp.reactions[]` via `arrayUnion`); advisory per-member timer (D-01); `elapsedMs` per reaction (D-03). Phase 26's `runtimeSource: 'elapsed'` fallback path leans on this.

### Phase 15.5 — Past parties surface + per-receiver contract
- `.planning/phases/15.5-wait-up-flex/15.5-CONTEXT.md` — Past parties inline link (D-04); per-receiver-only contract (D-06 — Wait Up never affects others). Phase 26 D-08 extends Past parties surface; D-10's hide-from-list mirrors per-receiver semantics (each viewer sees only what's relevant to them).
- `.planning/phases/15.5-wait-up-flex/15.5-SPEC.md` — 11 requirements + 18 acceptance criteria; useful for understanding the surface that's being extended.

### Project foundations
- `.planning/PROJECT.md` — Vision + brand voice + non-negotiables. v1 milestone constraints (single-file, no bundlers).
- `.planning/BRAND.md` §6 (voice — friend-on-couch, no em-dashes, sentence-case) + §7 (modal patterns) + §5 (motion catalog) — affects replay-modal copy + transitions.
- `.planning/REQUIREMENTS.md` — Existing PARTY-* / VID-24-* IDs; Phase 26 will add new requirement IDs (planner to define — likely `RPLY-26-*` or `REPL-26-*`).
- `CLAUDE.md` — Token-cost rules (NEVER read `js/app.js` in full; Grep + offset/limit only); no-bundler / no-dep constraint; `sw.js` CACHE bump on every user-visible change; deploy via `bash scripts/deploy.sh <short-tag>`. Phase numbering safeguards.

### Existing code touchpoints (read offsets, not in full — `js/app.js` is ~16k lines)
- `js/app.js:11080-11094` — Phase 24 `currentTimeMs` / Source / etc. broadcast write site. Read to understand the live data shape D-01 reads from.
- `js/app.js:11949` — `sendReaction` write path with `arrayUnion`. Phase 26 modifies this to compute + stamp `runtimePositionMs` + `runtimeSource` per D-01..D-03.
- `js/app.js:11722-11731` — Existing `wp.reactions` render path with the `participants[mid].reactionDelay` Wait Up filter at `:11731`. Replay-mode rendering (D-04) replaces this with position-aligned fade-in.
- `js/app.js:11115` — `renderWatchpartyLive()` host surface. D-06 replay variant renders inside this function gated on `wp.status === 'archived'` + replay-mode flag.
- `js/app.js:10954-10987` — `openWatchpartyLive` paths. Phase 26 extends with replay-mode entry; gating logic widens.
- `js/app.js:1303` — `wpForTitle()` (active only). Phase 26 needs an archived variant for title-detail "Past watchparties" section.
- `js/app.js:10684` — Existing `arrayUnion(reaction)` write. Phase 26's reaction shape change (additive fields) flows through here unchanged.
- Phase 15.5 Past parties link rendering (location TBD by researcher) — D-08 / D-09 extend this from 25h window to all-time-paginated.
- Title detail view rendering (location TBD by researcher) — D-08 adds new "Past watchparties for this title" section.

### Cross-repo (queuenight) — NOT expected for Phase 26
- D-07 explicitly locks Phase 26 as a single-repo couch-only deploy. No `queuenight/functions/index.js` changes; no Firestore rules changes anticipated (`wp.reactions` writes already covered by Phase 7 / 15.1 host + participant rules; planner / researcher to verify the `runtimePositionMs` field doesn't cross any denylist).
- `firestore.rules` review during plan-phase: ensure Phase 24's M2 host-only currentTime denylist (Plan 24-04) doesn't accidentally block participants from writing reactions with `runtimePositionMs` — the denylist is on wp.* fields, not reaction sub-fields, so this should be fine; verify.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 24 pure-helpers ES module (`js/native-video-player.js`)** — exports `STALE_BROADCAST_MAX_MS`. D-02 imports this constant for the stale-broadcast check. No new helper module needed for Phase 26 unless the position-derivation logic warrants one (researcher's call — small enough that inline at the `sendReaction` site is also reasonable).
- **`wp.reactions` array via `arrayUnion`** — additive Phase 26 fields slot into the existing reaction object shape. No new collection, no new Firestore path.
- **Live modal scaffold (`#wp-live-modal-bg` / `#wp-live-content`)** — D-06 reuses this directly for replay-variant rendering.
- **Phase 15.5 Past parties inline link + list view** — D-08 / D-09 extend the existing 25h surface to all-time. Researcher maps the current banner-list render path (15.5 CONTEXT notes location TBD) and identifies the cleanest insertion point for the window expansion.
- **`elapsedMs` per reaction (Phase 7 D-03)** — already on every reaction in production. D-01's no-player / stale-broadcast fallback uses this directly.
- **`wp.currentTimeMs` / `currentTimeUpdatedAt` / `isLiveStream` (Phase 24)** — host-only 5s broadcast. D-01's primary capture path reads these.

### Established Patterns
- **Per-watchparty Firestore field on `families/{code}/watchparties/{id}`** — Phase 26 adds nothing new here; reaction-object shape change lives inside the existing `wp.reactions[]` array.
- **Per-phase smoke contract** (Phases 18+: 8 contracts, native-video-player most recent in Phase 24): Phase 26 should add `scripts/smoke-position-anchored-reactions.cjs` covering the position-derivation helper across the 4 wp-state cases (fresh-broadcast, stale-broadcast, no-player, live-stream) + the `runtimeSource` enum + the replay-list filter (D-10 hide-empty).
- **`sw.js` CACHE bump on every user-visible change** — Phase 26 will encode a CACHE bump (e.g., `couch-v38-async-replay`) per CLAUDE.md.
- **Single-file architecture preserved** — additive logic lives in `js/app.js`; new replay-render code path inside `renderWatchpartyLive`. No new HTML surfaces (modal scaffold reused).

### Integration Points
- **`sendReaction` write path** (`js/app.js:11949`) — Phase 26 modifies the reaction object construction to compute `runtimePositionMs` + `runtimeSource` from `wp.currentTimeMs` / `wp.currentTimeUpdatedAt` / `wp.isLiveStream` + this member's `elapsedMs`.
- **`renderWatchpartyLive()`** (`js/app.js:11115`) — D-06 adds a replay-variant render branch gated on `wp.status === 'archived'` + a replay-mode flag (state.replayWp or similar — researcher names it).
- **`openWatchpartyLive`** (`js/app.js:10954-10987`) — extends to accept a replay-mode entry signal (e.g., `openWatchpartyLive(wpId, { replay: true })`).
- **Past parties surface (Phase 15.5)** — window expansion + per-row "Replay" affordance + filter for replay-able reactions (D-10).
- **Title detail view** — new "Past watchparties for this title" section + per-row tap → replay modal.
- **TMDB title runtime data** — already on `t.runtime` (movies) / `t.episode_run_time` (TV); replay scrubber range reads from this when available.

</code_context>

<specifics>
## Specific Ideas

- **The "Red Wedding" emotional arc is the design north star.** Replay UX should feel like joining the family in spirit, not browsing a log. D-04's auto-play with self-positioning is chosen specifically to preserve the "feel like you were there" magic.
- **User's preference signal: clean semantics over data preservation.** D-11 (no backfill, against recommendation) reflects this. The planner should NOT propose helper migrations, opt-in recovery affordances, or "rescue your history" UX. Phase 26 is a demarcation line.
- **User's preference signal: silent over explanatory UX (continued from Phase 24 specifics).** D-07 (no push to originals on replay reactions) + D-10 (hide replay-empty parties from list) both reinforce this. When in doubt between "show a message about why this is empty" vs "hide the surface", prefer hiding.
- **First-week-after-deploy framing**: with D-10 + D-11, the Past parties list and title-detail "Past watchparties" sections will be **empty for the existing family on Phase 26 deploy day**. New watchparties created after deploy populate them going forward. Planner should consider whether the empty state needs any copy treatment or whether the link / section should simply not render until ≥ 1 replay-able party exists (the latter aligns better with D-10's silent-UX framing — researcher to propose).
- **The `elapsedMs` proxy is honest data** for D-01's fallback path (per Phase 7 D-01 / D-03 advisory-timer model, most members open the live modal close to actual title-start). `runtimeSource: 'elapsed'` is not a downgrade flag; it's a description of the data path. Planner / researcher should not visually penalize `'elapsed'` reactions in replay UX (no faded color, no asterisk, no "approximate" badge) — they are first-class.
- **Recursive family memory framing matters.** D-05's compounding behavior is the architectural signal. Future replayers' reactions are real reactions, equal weight to original-party reactions. The data model should not separate them (no "originalReactions" + "replayReactions" split — one `wp.reactions[]` array, period).

</specifics>

<deferred>
## Deferred Ideas

### Scope explicitly deferred from Phase 26

- **Backfill of pre-Phase-26 reactions** — explicitly rejected by D-11. Pre-deploy parties stay invisible to replay surface. NOT a "we might do this later" — it's a clean line. If a future need to recover history surfaces, it's a separate phase with its own discussion.
- **Replay-reactions push notifications** (`reactionInReplay` eventType) — D-07 defers this. If user feedback later requests "Aunt Linda just reacted to Dune (replay)" pushes, scope as v2.1+ phase with new NOTIFICATION_DEFAULTS key + queuenight CF + Settings opt-in.
- **Manual position scrubber on LIVE-mode modal for DRM / external parties** — D-01's hybrid uses `elapsedMs` fallback for these. If users find the proxy quality lacking and explicitly want to control their own position during live parties, scope a follow-up phase that adds an opt-in scrubber to the live modal (paralleling DVR slider pattern).
- **Wait Up × replay interaction beyond default-off** — Claude's discretion section notes default leaning is "Wait Up irrelevant in replay." If feedback says it should still apply, scope a small follow-up.
- **Multi-episode bingeable parties (S3E1 → S3E2 in single party)** — Out of scope per seed § Not-goals. One-title-per-party constraint preserved. Future phase if family-binge use case proves common.
- **Standalone "Memories" / "Replay" top-level surface** — Dual entry (D-08) is judged sufficient. Revisit if v2.1+ usage data shows family-history is a primary intent.
- **Visual differentiation of `runtimeSource` in replay UX** — All sources render uniformly per specifics above. If future polish wants to subtly indicate "this reaction was elapsed-derived, not broadcast-derived", that's a v2.1+ design treatment — not Phase 26 scope.
- **Sub-second drift tolerance / perfect sync** — Out of scope per seed § Not-goals. Default ±2s drift tolerance is the target; family use case is "feel like you were there", not metronome accuracy.

### Reviewed Todos (not folded)

No pending todos in `.planning/todos/pending/` directly relate to Phase 26 scope. The two carried-over todos (live-release push deep link, Phase 15 iOS UX fixes) are independent and stay in the queue for future phases.

</deferred>

---

*Phase: 26-position-anchored-reactions-async-replay*
*Context gathered: 2026-05-01*
*Discussion mode: interactive default (all 4 areas selected; user picked recommendations on 8/9 questions; declined recommendation on retroactive migration — locked clean-semantics framing)*
