# Provider-Data Audit — Availability Notifications Feasibility Spike

**Date:** 2026-04-29
**Trigger:** Phase 18 (Availability Notifications) prerequisite — per cross-AI review 2026-04-28 + seed `phase-10x-availability-notifications.md`. Need to know if availability notifs is a small phase (existing data) or a new-provider-integration phase (JustWatch/Watchmode/etc.).
**Spike duration:** ~30 min code trace + write-up.

## TL;DR — FEASIBLE as a small phase

**Verdict:** Couch already pulls TMDB `watch/providers` data and stores it per title. Per-member subscriptions (`m.services[]`) already exist for the filter UX. Push CF infrastructure is proven and scheduled-CF pattern (`watchpartyTick`) runs every 5 min. **No new provider integration needed.** Estimated scope: 4-5 plans, 1 deploy day. Same shape as Phase 15.4.

## Existing Infrastructure (ready to use)

### Provider data fetch
- **`fetchTmdbExtras(mediaType, tmdbId)`** at `js/app.js:13-82` — calls `https://api.themoviedb.org/3/{mediaType}/{tmdbId}/watch/providers?api_key=…` and parses US results into 3 buckets (subscription/free/ads → `providers`, rent → `rentProviders`, buy → `buyProviders`)
- Returns `{ providers, rentProviders, buyProviders, providersChecked, providersSchemaVersion: 3 }`
- Each entry: `{ name, logo }` where logo is the TMDB CDN URL
- `dedupe()` uses `normalizeProviderName()` so "Prime Video w/ Ads" collapses into "Prime Video"

### Per-title storage in Firestore
Each title doc carries:
- `t.providers[]` — subscription brands available
- `t.rentProviders[]` — rental brands
- `t.buyProviders[]` — purchase brands
- `t.providersChecked: bool` — has TMDB been queried at all
- `t.providersSchemaVersion: int` — currently v3 (post-Phase-9 normalization)

### Per-member subscriptions
Each member doc carries:
- `m.services[]` — array of brand names the member subscribes to
- Used by `titleMatchesProviders(t)` at `js/app.js:4825-4848` for the "limit to services" filter
- Union of all members' services = "family pack" for filtering UX

### Push CF infrastructure (proven)
- `NOTIFICATION_DEFAULTS` map at `queuenight/functions/index.js:95-115` — server-side push event catalog. Adding `titleAvailable: true` is a 1-line change.
- `sendToMembers(memberIds, body, options)` — push fan-out helper with `excludeMemberId` for self-echo and per-member-pref gating via `eventType` arg
- `isInQuietHours(member)` — quiet-hours respected
- Friendly-UI Settings parity pattern just landed in Phase 15.4 (mirror into NOTIF_UI_TO_SERVER_KEY + NOTIF_UI_LABELS + NOTIF_UI_DEFAULTS)

### Scheduled CF pattern
- `watchpartyTick` at `queuenight/functions/index.js:768-809` — runs `every 5 minutes`, region `us-central1`, 256MiB, iterates all families
- Establishes the pattern: scheduled CF + family-loop + Firestore mutation. Same skeleton for `providerRefreshTick`.

### Refresh cadence today
- Provider data is fetched **client-side only** during:
  - First add (autoBackfill Phase 2 — capped at 10 per session)
  - Schema migration (autoBackfill Phase 3 — also capped at 10 per session)
- **No scheduled refresh exists today.** Provider list goes stale once a title is in the queue and the user doesn't re-encounter it.

## What's needed for Availability Notifications

### Server side
1. **New scheduled CF** `providerRefreshTick` — daily cadence (24h), `every 24 hours` schedule
2. **Refresh loop:**
   - Iterate families → titles in each family's queue (where `t.queues` is non-empty, i.e. yes-voted by ≥1 member)
   - For each title: fetch fresh `watch/providers` from TMDB
   - Diff against stored `t.providers[]`
   - On new providers added: capture `addedBrands[]`
3. **Fan-out logic:**
   - For each member of the family: intersect `addedBrands` with `m.services[]`
   - If intersection non-empty AND member has `notificationPrefs.titleAvailable !== false`: queue push
   - Body: "{titleName} just hit {brand} for your household."
   - Use `sendToMembers` with `eventType: 'titleAvailable'`, `excludeMemberId` for self
4. **Update `t.providers[]`** — write the refreshed list back so the next diff is against the new state
5. **Pacing:** TMDB rate limit ~40 req/10s. Round-robin across families OR last-checked-timestamp per title. Likely process ~50-100 titles per CF tick (well under limit).

### Client side
6. **`titleAvailable` event type** — add to:
   - `NOTIFICATION_DEFAULTS` (queuenight) — 1 line
   - `DEFAULT_NOTIFICATION_PREFS` (couch) — 1 line
   - `NOTIFICATION_EVENT_LABELS` (couch legacy Settings) — 1 entry
   - `NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS` (couch friendly-UI Settings) — 3 entries each (mirror per Phase 15.4 pattern)
7. **Confidence + opt-out UX** (per Codex 2026-04-28 audit):
   - When push lands, include "seen on Max via TMDB" humility text in body OR detail screen
   - Add a "refresh availability" affordance somewhere in the title detail (manual force-refresh)
   - Per-title or per-list opt-out — defer to follow-up phase if simple per-event toggle is enough

## Risks (and mitigations)

### Risk 1: TMDB provider data can be stale or wrong
**Source:** Codex flagged this as a humility concern. TMDB aggregates from JustWatch + studio reports; lag of 24-72h is common.
**Mitigation:** Brand the push as "seen on {brand} via TMDB" not "available now"; include refresh affordance; daily cadence (not hourly) absorbs short-lag false positives.

### Risk 2: Notification noise — could spam fast
**Source:** Both AIs flagged. A family of 6 with 100-title queues across 4 streamers could see dozens of pushes per week.
**Mitigation:** Default ON but with conservative thresholds. Group multiple-titles-on-same-day into one push ("3 titles just hit Max"). Per-member opt-out via existing Settings UI.

### Risk 3: TMDB rate limit at scale
**Source:** PROJECT.md note: ~40 req/10s. Daily refresh of 100-500 titles is well within limit.
**Mitigation:** Round-robin titles across days; cap per-tick to ~50 titles; back off on 429.

### Risk 4: Cost — Cloud Function invocations + TMDB egress
**Source:** Each tick = N TMDB calls + 1 fan-out per delta. Daily CF + ~100 titles + Firebase Blaze pricing = pennies/month at current scale.
**Mitigation:** Negligible at family-and-friends scale. Re-evaluate if user count grows 10x.

### Risk 5: Async-replay-style emotional risk
**Source:** Codex: "could become creepy or cluttered if reactions appear out of context". Doesn't directly apply (this is availability not reactions) but the principle does — pushes should feel rare and useful.
**Mitigation:** Quiet-hours gate; explicit opt-out toggle; refresh-batching to avoid drip.

## Recommended Phase Shape

### Phase 18 — Availability Notifications

| Plan | Theme | Wave |
|------|-------|------|
| 18-01 | New `titleAvailable` event type — server + client mirror in lockstep (NOTIFICATION_DEFAULTS + 3 friendly-UI maps + legacy EVENT_LABELS) | 1 |
| 18-02 | `providerRefreshTick` scheduled CF — refresh loop + diff + fan-out logic + rules-emulator tests | 1 |
| 18-03 | Confidence/refresh affordance UX — "via TMDB" attribution + manual refresh button on detail modal | 1 |
| 18-04 | sw.js CACHE bump + cross-repo deploy ritual + UAT (single-device + ~24h soak) | 2 |

**Estimated effort:** 1 deploy day (mirrors Phase 15.4 structure).
**Cross-repo:** Yes — queuenight CF + couch client.
**Decimal-phase fit:** Could be Phase 15.6 (continues the post-v33.3-audit decimal stream) or full Phase 18 (new top-level capability). Recommend Phase 18 — this is a moat capability, not a polish item.

## Open questions (defer to /gsd-discuss-phase 18)

1. **Cadence:** daily vs every-6h vs weekly? Default daily but flexible.
2. **Push body grouping:** single-title-per-push or batch ("3 titles hit Max today")? Default batch above 2 titles.
3. **Confidence text:** "via TMDB" attribution required or optional? Recommend required for trust per Codex.
4. **Per-list opt-out:** does the user want to mute a specific provider's pushes (e.g., already aware of Netflix releases)? Defer to follow-up unless it surfaces as needed.
5. **Refresh affordance:** detail-modal button only, or list-level button too? Recommend detail-modal only for now (simpler).

## Next step

Run `/gsd-discuss-phase 18` (or 15.6 if user prefers decimal) once user confirms which slot. Auto-mode discuss can pick recommended defaults from this audit.

---

**Audit complete. Provider-data is in good shape; availability notifications is a small phase, NOT a new provider integration.**
