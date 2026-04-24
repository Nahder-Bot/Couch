# Phase 11 Appendix — Discovery category catalog (REFR-04)

**Created:** 2026-04-23 in response to user direction: "daily rotation but also add more categories if that wasn't clear."
**Goal:** expand candidate category list well beyond the 12-15 originally proposed, design daily-rotation logic, and surface scope decisions.

---

## Current state (post-Phase 9)

The `Add` tab today shows **4 fixed rows**:
1. Mood (filtered by selected mood chip)
2. Trending this week
3. On your streaming
4. Hidden gems

All four shown every visit. Same order, same rows. No rotation, no surprise, no seasonal awareness.

---

## Expanded candidate catalog — 35 rows across 6 buckets

### Bucket A — Always-on (top of screen, every day)

| # | Row | Source | Why always-on |
|---|---|---|---|
| A1 | **On your streaming** | TMDB providers ∩ user services | Primary utility — what they can actually watch right now |
| A2 | **What your couch is into** | Group's recent Yes votes (last 30 days) → similar | Personalization that signals "we know you" |

These two are high-utility every visit. Always shown, top of screen.

### Bucket B — Trending pool (1-2 rotated daily)

| # | Row | Source | Cadence |
|---|---|---|---|
| B1 | Trending this week | TMDB `/trending/week` | Weekdays |
| B2 | Trending today | TMDB `/trending/day` | Weekends |
| B3 | New releases | TMDB `/movie/now_playing` | Anytime |
| B4 | Coming soon | TMDB `/movie/upcoming` | Periodically |
| B5 | Top-rated this year | TMDB `/discover` filtered by year+rating | Quarterly refresh |

Pick one of B1-B5 per day. Default: B1 weekdays, B2 weekends.

### Bucket C — Discovery pool (2-3 rotated daily)

| # | Row | Source | Notes |
|---|---|---|---|
| C1 | Hidden gems | TMDB low popularity + high rating | Carry-over from current |
| C2 | Cult classics | Curated TMDB list or list-id | Needs curation |
| C3 | Critically acclaimed | TMDB filtered by vote_avg ≥ 7.5 + vote_count ≥ 1000 | Auto |
| C4 | Award winners | Curated list (Oscars, Globes, BAFTA) | Needs annual update |
| C5 | Festival favorites | Curated (Cannes, Sundance, TIFF, Venice) | Needs annual update |
| C6 | Director spotlights | Rotates director (Wes Anderson, Bong Joon-ho, Greta Gerwig…) | Weekly |
| C7 | Foreign language gems | TMDB filtered by original_language ≠ en | Auto |
| C8 | Documentaries that punch | Curated docs that landed | Needs curation |
| C9 | A24 / Neon / boutique | Filtered by production company | Auto, list-id |

Pick 2-3 per day from this pool. Rotation algorithm: avoid showing the same row twice in 7 days.

### Bucket D — Use-case rows (1-2 rotated daily)

| # | Row | Source | When it fires |
|---|---|---|---|
| D1 | Quick watches (under 90 min) | TMDB filtered by runtime ≤ 90 | Tuesday/Wednesday (school nights) |
| D2 | Long binges (5+ seasons) | TMDB TV filtered by num_seasons ≥ 5 | Sunday |
| D3 | Date night picks | Romance + dramedy + drama curated | Friday/Saturday |
| D4 | Family-safe (G/PG) | TMDB filtered by certification | Daily — family group flag |
| D5 | Kids & co-watch | Animated + family + adventure | Daily — family group flag |
| D6 | Comfort rewatches | Group's prior 4-5 star ratings | Sunday |
| D7 | Solo mode picks | Suggested for the user not the group | When fewer than 2 chips selected |
| D8 | Quick episode (TV under 30 min) | TV + episode_runtime ≤ 30 | Weeknight, late |

Pick 1-2 per day from this pool. Use day-of-week + group composition (family flag, time of day) to seed selection.

### Bucket E — Theme-of-the-day (1 per day, day-of-week-driven)

| # | Day | Theme | Source |
|---|---|---|---|
| E-Mon | Monday | Monday motivation | Curated/inspirational |
| E-Tue | Tuesday | TV pilots worth starting | TMDB TV first-season |
| E-Wed | Wednesday | Wildcard / surprise | Random discover with high rating |
| E-Thu | Thursday | Throwback Thursday | Decade rotates: 70s/80s/90s/2000s/2010s |
| E-Fri | Friday | Foreign film Friday | Filtered by language |
| E-Sat | Saturday | Saturday blockbusters | High budget + high popularity |
| E-Sun | Sunday | Cozy Sunday | Comfort genres + slow pacing |

One row per visit, depends on the day. Adds rhythm + reason to come back daily.

### Bucket F — Seasonal / contextual (auto-injected by date or event)

| # | Row | When it appears |
|---|---|---|
| F1 | Halloween crawl | Oct 1 - Nov 1 |
| F2 | Holiday classics | Dec 1 - Jan 1 |
| F3 | Summer blockbusters | Jun 1 - Aug 31 |
| F4 | Cozy winter | Dec 15 - Feb 28 |
| F5 | Back-to-school | Aug 15 - Sep 15 |
| F6 | Valentine's date night | Feb 1 - Feb 14 |
| F7 | Awards-season prestige | Jan 1 - Mar 31 |
| F8 | Pride watch | Jun 1 - Jun 30 |
| F9 | Black History Month | Feb 1 - Feb 28 |
| F10 | Spooky off-season (rainy day) | Triggered by weather API (stretch) |

When in season, this row auto-injects above the use-case row. Only one seasonal at a time (most-recent active wins).

### Bucket G — Group-aware / personalization (1-2 daily)

| # | Row | Source |
|---|---|---|
| G1 | From your Want list | Titles voted Yes by group but never picked |
| G2 | Yet to be voted on | Titles in queue with no votes from current user |
| G3 | Because you watched [recent] | TMDB similar to last-watched |
| G4 | More from [actor in recent] | TMDB person credits |
| G5 | More from [director of recent] | TMDB director credits |
| G6 | Continue this franchise | TMDB collection lookup |
| G7 | Your top genres revisited | Group's most-Yes'd genre → discover |
| G8 | Cross-group discovery | If user belongs to multiple groups, "your other crew is into…" |

Pick 1-2 per day from this pool. Requires user/group state — degrades gracefully on cold-start (new user has no "recent watch", row hidden).

---

## Daily-rotation logic

**Per-day visible row count:** 8-10 rows (vs current 4).

**Composition each day:**
1. Bucket A — both rows (2 rows)
2. Bucket B — 1 row (rotated daily)
3. Bucket C — 2-3 rows (rotated, no repeat within 7 days)
4. Bucket D — 1-2 rows (use-case + day-of-week)
5. Bucket E — 1 row (day-of-week driven)
6. Bucket F — 1 row (only if a seasonal window is active; otherwise skipped)
7. Bucket G — 1-2 rows (only if user has enough history; otherwise skipped)

**Total visible: 8-10 most days, 6-7 for cold-start users, 11-12 in seasonal windows.**

**Rotation seed:** `hash(user-id, current-date)` ensures each user sees a stable rotation per day (consistent across page refreshes within the same day) but different users see different rotations on the same day. Day boundary = midnight in user's timezone.

**TMDB rate-limit budget:**
- Couch already respects ~40 req/10s
- New rows mostly hit cached endpoints (trending, discover, providers) — most queries are cacheable per-day across all users
- Per-row backfill loop already exists (Phase 1-4 catalog terminology)
- Heaviest new load: G3-G5 (per-user "similar to last watched") — cap at 1 such row per day, cache result for 24h
- **Net new TMDB load:** estimated +50-80% over current. Manageable within rate-limit if backfill is staggered.

**"More categories" affordance:**
- Add a `Browse all` link at the bottom of the Add screen → opens a sheet listing all 35 rows organized by bucket → user can pin favorites or browse
- Pinned rows always show, in addition to the daily rotation (capped at +3 pins to prevent screen overflow)

---

## Implementation effort breakdown

| Sub-task | Effort |
|---|---|
| Daily rotation engine + hash-seeding | M (~2 hrs) |
| Wire 5-7 new rows to existing TMDB helpers | M (~3 hrs) |
| Curated lists (cult classics, awards, A24, etc.) — needs author judgement | M-L (~3-4 hrs of curation) |
| Day-of-week theme rotation | S (~1 hr) |
| Seasonal injection logic + 8-10 seasonal rows | M (~2 hrs) |
| Personalization rows (G3-G6 — depends on per-user data shape) | M (~2-3 hrs) |
| `Browse all` sheet + pinning | M (~2-3 hrs) |
| Backfill rate-limit budgeting + caching layer | M (~2 hrs) |

**Total: ~15-20 hrs** — bigger than the original Plan 11-03 estimate (was ~6-8 hrs). User's "more categories" direction expanded scope materially.

**Splittable into 11-03a (rotation engine + 8-10 always-on rows) + 11-03b (full catalog + Browse all + curated content)** if you want phased execution.

---

## Decision needed

For **REFR-04 (discovery rotation + categories)**:

1. **Total row count per day** — accept 8-10 visible (proposed) or trim?
2. **Daily rotation seed scope** — per-user-per-day (proposed; stable within day, different across users) or simpler global-per-day?
3. **Curated lists vs auto-only** — accept the manual curation effort for cult classics / awards / A24 / festival lists (better quality, ~3-4 hr curation)? Or auto-only via TMDB filters (worse quality, no ongoing maintenance)?
4. **`Browse all` + pinning** — include in v1 or defer to v1.x?
5. **Plan split** — single Plan 11-03 (~15-20 hrs) or split into 11-03a (rotation + 8 rows) + 11-03b (full catalog + browse + curation)?

My recommendations:
1. 8-10 rows
2. Per-user-per-day (worth the extra complexity — feels personalized)
3. Hybrid — auto-only for v1, curated lists ship in 11-03b or Phase 12 (lower scope risk)
4. Defer `Browse all` to 11-03b
5. Split into 11-03a (rotation engine + 8-10 auto rows + day-of-week theme + seasonal) and 11-03b (curated lists + Browse all + pinning + personalization)

Net result if you accept my recommendations: **Plan 11-03a in Wave 2 (~8-10 hrs); Plan 11-03b in Wave 4 (~7-10 hrs).**

---

**Reply with `(a)` or per-question answers and I'll lock REFR-04 scope.**
