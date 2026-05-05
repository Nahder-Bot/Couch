---
phase: 18-availability-notifications
gathered: 2026-04-29
status: ready_for_planning
mode: auto-discuss (--auto + --chain) — Claude picked recommended defaults per saved YOLO config + audit findings
---

# Phase 18: Availability Notifications — Context

**Gathered:** 2026-04-29 (auto-discuss; user invoked /gsd-discuss-phase 18 --auto --chain after provider-data audit confirmed feasibility)
**Status:** Ready for planning

<domain>
## Phase Boundary

Daily-cadence scheduled Cloud Function watches each family's queued titles for newly-added streaming providers, fans out push notifications to family members whose subscription packs intersect the new brand. Push voice: "Dune just hit Max for your household." Brand-fit: low-volume, high-signal — the user opens the app on a Tuesday because something they wanted is suddenly watchable.

NOT in scope:
- Per-list/per-title opt-out granularity (defer until single per-event toggle proves insufficient)
- Letterboxd-style "Discover availability" surface (that's a separate Phase candidate)
- Provider DEPARTURE notifs ("Dune leaves Max in 7 days") — different UX, requires expiration date data; defer to follow-up
- Cross-region availability (user moves countries) — TMDB US results only for v1
- Non-TMDB provider sources (JustWatch / Watchmode / Reelgood) — TMDB is sufficient at current scale per audit

</domain>

<decisions>
## Implementation Decisions

### Cadence + scheduling
- **D-01:** Scheduled CF runs **daily** (`schedule: 'every 24 hours'`). Daily absorbs short TMDB lag (24-72h propagation is common) and avoids notification spam. Hourly = noisy; weekly = misses the moment-of-availability win.
- **D-02:** Region: `us-central1` (matches all other queuenight CFs). Memory `256MiB`, timeoutSeconds `540` (9 min — generous for the iterate-families loop).
- **D-03:** Pacing: cap `~50 titles per tick`. With ~40 req/10s TMDB rate limit, 50 titles = ~12.5 sec at full throttle. Round-robin via `t.lastProviderRefreshAt` timestamp — oldest-first, so all queued titles refresh once per ~N days where N = total-titles / 50.
- **D-04:** Backoff: catch 429 responses; abort the rest of the tick, log to Sentry, retry on next 24h cycle (no exponential backoff — daily cadence is forgiving enough).

### CF design
- **D-05:** New CF name: `providerRefreshTick` (matches `watchpartyTick` naming pattern from `queuenight/functions/index.js:768`)
- **D-06:** Iteration scope: families → titles where `t.queues` has at least 1 entry (yes-voted by ≥1 member). Titles with zero queue interest don't get refreshed (they're not in anyone's pack of intent).
- **D-07:** Diff strategy: compute `addedBrands = newBrands - oldBrands` where brands are normalized provider names. Only `t.providers[]` (subscription/free/ads bucket) is watched — `rentProviders` and `buyProviders` don't qualify (rent/buy is always available; only "free with my subscription" is the moment that matters).
- **D-08:** Write back: `updateDoc(titleRef, { providers: refreshed.providers, providersSchemaVersion: 3, lastProviderRefreshAt: Date.now() })`. NO `writeAttribution()` because this is a system write, not a user write — add a `setBy: 'system'` marker per Phase 15.1 attribution pattern.

### Push fan-out
- **D-09:** For each member in the family: compute `matchingBrands = intersection(addedBrands, m.services)`. If non-empty, queue this member for a push.
- **D-10:** Self-echo guard: not applicable (no "sender" — this is a system push). Skip the excludeMemberId arg.
- **D-11:** Quiet-hours respected via existing `isInQuietHours(member)` helper (Phase 6 baseline).
- **D-12:** Push event type: `titleAvailable` (camelCase, matches existing convention).
- **D-13:** Per-member opt-out gate via existing `sendToMembers` eventType-aware suppression (Phase 6 contract). Member with `notificationPrefs.titleAvailable === false` gets no push.

### Push body design
- **D-14:** Single-title body: "{titleName} just hit {brand} for your household."
  - Example: "Dune just hit Max for your household."
  - 'household' is group-agnostic per the same family-vs-other-groups concern that drove 15.4 friendly-UI copy
- **D-15:** Batch body when ≥2 titles for the same member on the same tick (same brand or different): "{N} titles your couch wants are now watchable: {title1}, {title2}, +{N-2} more on {brand1}, {brand2}…"
  - Threshold: ≥2 → batch. Single title gets the dedicated body.
  - Cap surfaced titles at 3 in the body (truncate with "+ N more")
- **D-16:** Confidence/source attribution: detail-modal "Refresh availability" affordance includes "Provider data via TMDB" footnote. Push body itself does NOT carry "via TMDB" (too verbose for a push) — the affordance lives in the title detail surface.

### Manual refresh affordance (Codex confidence requirement)
- **D-17:** Title detail modal gets a small "Refresh availability" link/button (existing detail-modal scaffold has the right home for this — likely near the provider strip).
- **D-18:** Manual refresh writes a per-title flag, NOT a global trigger. Calls `fetchTmdbExtras` client-side (same path as autoBackfill Phase 2), updates `t.providers` + `t.lastProviderRefreshAt`. Toast "Availability refreshed."
- **D-19:** Manual refresh doesn't fire pushes — push fan-out is server-side scheduled-CF only. (Avoids a manual-refresh-spam push exploit.)

### Settings parity (mirror Phase 15.4 pattern)
- **D-20:** Add `titleAvailable` to:
  - `NOTIFICATION_DEFAULTS` (queuenight) — default `true`
  - `DEFAULT_NOTIFICATION_PREFS` (couch) — default `true`
  - `NOTIFICATION_EVENT_LABELS` (couch legacy Settings) — label "New on a service you have", hint "Daily check: when a title someone on your couch wants becomes watchable on a service in your pack."
  - `NOTIF_UI_TO_SERVER_KEY` + `NOTIF_UI_LABELS` + `NOTIF_UI_DEFAULTS` (couch friendly-UI Settings) — mirror per Phase 15.4 pattern

### Cross-repo + cache
- **D-21:** Cross-repo deploy ritual mirrors Phase 15.4 + 15.5 pattern: queuenight functions FIRST (new `providerRefreshTick` + `titleAvailable` in NOTIFICATION_DEFAULTS), then couch hosting (titleAvailable client mirror + manual-refresh affordance + sw.js bump).
- **D-22:** Bump `sw.js` CACHE to `couch-v36-availability-notifs`.
- **D-23:** No new firestore.rules changes needed (no new collections; existing titles + members rules cover the writes).

### Claude's Discretion
- Final friendly-UI Settings label/hint copy (subject to BANNED-words audit at planning)
- Exact placement of "Refresh availability" affordance in detail modal (below provider strip vs in overflow menu)
- Backoff timing on 429 (could be smarter than "abort rest of tick" — but avoid premature optimization)
- Test coverage strategy: rules-emulator coverage is moot (no new rules); CF unit test for `addedBrands` computation + smoke test for push body builder
- Whether the daily tick has a "cold start" exemption — first tick after deploy, refresh ALL titles (not just oldest 50). Recommend YES — backfills the `lastProviderRefreshAt` field.

</decisions>

<specifics>
## Specific Ideas

- The push body voice "Dune just hit Max for your household." mirrors JustWatch's pattern but adds the family/household framing. "Household" is the term used because it's the family/group-agnostic noun that fits both the "family" and "friends-group" personas (per the Phase 15.4 group-agnostic "couch isn't unanimous" copy decision).
- Push categorization: this should LIVE alongside the existing 15-category push catalog (D-12 from 14-09). Not its own thing.
- Trakt-overlap consideration: a title might be marked as `t.watched: true` (Trakt synced or manual mark). The CF should SKIP refresh on watched titles — a household member already saw it; "now available on Max" doesn't matter. Add `t.watched !== true` to the iteration filter at D-06.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Provider-data audit (this phase's prerequisite)
- `.planning/research/2026-04-29-provider-data-audit.md` — full feasibility audit with current state inventory + risk analysis + 4-plan recommendation

### Cross-AI feature audit (this phase's strategic justification)
- `.planning/reviews/2026-04-28-feature-audit.md` — Tier 2 #5 ranks availability notifications as the strongest moat play. Both Gemini + Codex independently flagged.

### Existing implementation references
- `js/app.js:13-82` — `fetchTmdbExtras` (TMDB watch/providers fetch; reuse for client-side manual refresh)
- `js/app.js:4825-4848` — `titleMatchesProviders` + `m.services` filter pattern
- `js/app.js:6340-6405` — autoBackfill Phase 2 + 3 (existing per-title refresh patterns)
- `queuenight/functions/index.js:768-820` — `watchpartyTick` (template for `providerRefreshTick`)
- `queuenight/functions/index.js:95-115` — `NOTIFICATION_DEFAULTS` (where `titleAvailable: true` lands)

### Phase 15.4 pattern (mirror for cross-repo + Settings parity)
- `.planning/phases/15.4-integration-polish/15.4-CONTEXT.md` — decisions D-08..D-10 (mirror approach for friendly-UI Settings parity)
- `.planning/phases/15.4-integration-polish/15.4-02-SUMMARY.md` — concrete code changes for adding push key to all 5 surfaces in lockstep

### Push CF baseline (Phase 6)
- `.planning/phases/06-push-notifications/06-VERIFICATION.md` — per-event opt-in, quiet hours, self-echo guard contract

### Brand voice
- `BRAND.md` — "warm restraint" principle. Push body must pass banned-words sweep. "Household" framing is group-agnostic per Phase 15.4 follow-up.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `fetchTmdbExtras(mediaType, tmdbId)` — already returns `{ providers, rentProviders, buyProviders, providersChecked, providersSchemaVersion: 3 }`. Server-side CF can re-implement the same logic OR call out to a shared TMDB helper. Recommend re-implementing in queuenight/functions/index.js (DRY across repos isn't worth the deploy-mirror complexity).
- `normalizeProviderName(name)` (couch) — collapses "Prime Video w/ Ads" → "Prime Video". Server CF needs the same normalization. Recommend duplicating into queuenight (small, stable).
- `sendToMembers(memberIds, body, options)` — queuenight push fan-out helper; supports eventType + excludeMemberId
- `isInQuietHours(member)` — queuenight quiet-hours gate
- `onSchedule({ schedule, region, timeoutSeconds, memory }, async () => {...})` — queuenight scheduler API (already imported at line 20)

### Established Patterns
- **Cross-repo deploy ordering:** Phase 15.4 + 15.5 codified the queuenight functions → couch hosting sequence. Mirror identically.
- **Friendly-UI Settings parity:** Phase 15.4 pattern landed 9 keys in 3 maps. This phase lands 1 key (`titleAvailable`) — same pattern, smaller delta.
- **Push body voice:** Warm, restraint, direct. Past examples: "Brody wants you on the couch tonight" (15.4), "{Sender} is reacting to {Title}" (15.5-05). New: "{Title} just hit {brand} for your household."
- **Refresh-affordance pattern:** Detail modal already hosts the existing provider strip; add the "Refresh availability" link below it. No new modal scaffold needed.

### Integration Points
- New CF: `providerRefreshTick` exported from `queuenight/functions/index.js`. v2 scheduler API already imported.
- New field on title docs: `lastProviderRefreshAt: number` (epoch ms). Used for round-robin oldest-first iteration.
- Client-side: detail modal renders provider strip (look at existing rendering for the right insertion point); add "Refresh availability" link + onclick handler.
- Friendly-UI Settings: 1 entry added to each of NOTIF_UI_TO_SERVER_KEY + NOTIF_UI_LABELS + NOTIF_UI_DEFAULTS at js/app.js:128-155 (per Phase 15.4 location).

</code_context>

<deferred>
## Deferred Ideas

- **Per-list opt-out** (mute pushes for specific provider's releases, e.g. "I already follow Netflix") — defer until per-event toggle proves insufficient
- **Provider DEPARTURE notifications** ("Dune leaves Max in 7 days") — different UX surface, requires expiration date data; defer to follow-up
- **Cross-region availability** (user moves countries) — TMDB US-only for v1; add multi-region later
- **Refresh-availability rate limiting** (user spam-clicking the manual refresh button) — defer until signal
- **JustWatch / Watchmode / Reelgood backup providers** — TMDB sufficient at current scale; revisit at 10x growth
- **"Just-released" detection** (theatrical → streaming first window) — requires release-date stitching; out of scope for v1

</deferred>

---

*Phase: 18-availability-notifications*
*Context gathered: 2026-04-29 (auto-discuss mode)*
