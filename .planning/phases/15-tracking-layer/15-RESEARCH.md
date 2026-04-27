# Phase 15: Tracking Layer — Research

**Date:** 2026-04-26
**Project:** Couch
**Status:** Research complete

---

## Decisions Locked Upstream

The 16 D-XX decisions in `15-CONTEXT.md` are **LOCKED**. This research does not re-litigate them — it answers the items explicitly marked **Claude's Discretion** (Firestore document path, CF cadence, etc.) and surfaces concrete code-location investigation that the planner needs to assign tasks to specific file:line insertion points. Where this research recommends a path, it is grounded in patterns already shipped in Phases 7 / 8 / 11 / 14 — not greenfield invention. The 6 visible surfaces and BRAND-voice copy in `15-UI-SPEC.md` are also LOCKED; this research covers wiring + data shape only.

Throughout this document, all line numbers are verified against the working tree as of 2026-04-26.

---

## Major Foundational Finding (read this first)

**Per-individual progress is already shipped in production.** Phase 15 is NOT building progress tracking from scratch — it is generalizing an existing primitive from `[memberId]` keys to `[tupleKey]` keys.

The existing primitive (per `js/app.js:8020-8081`):

```js
// Title doc field: t.progress = { [memberId]: { season, episode, updatedAt, source } }
function getMemberProgress(t, memberId)        // js/app.js:8020 — read with legacy fallback
function membersWithProgress(t)                // js/app.js:8036 — collect all member ids
async function writeMemberProgress(...)        // js/app.js:8052 — atomic per-member write
async function clearMemberProgress(...)        // js/app.js:8072
window.advanceEpisode = ...                    // js/app.js:8084 — "Next ep ▸" handler
window.openProgressSheet = ...                 // js/app.js:8096 — episode picker sheet
function renderTvProgressSection(t)            // js/app.js:8291 — detail-modal "Progress" section
function renderDetailStatusStrip(t, memberId)  // js/app.js:8330 — "New season available" banner
function renderContinueWatching()              // js/app.js:8399 — Tonight tab "Continue watching"
```

There is also already a Tonight-tab DOM anchor `<div id="continue-section">` at `app.html:374` that hosts `renderContinueWatching` (currently per-individual TV continue cards).

**What this means for Phase 15 plans:**

1. **D-01 (auto-track from watchparty end):** writes a tuple-keyed entry next to the existing `t.progress[memberId]` entries — most cleanly via Option (b) in question 1 below (per-title field).
2. **S1 Tonight widget:** can substantially reuse `renderContinueWatching` patterns, anchor, and `.continue-card` CSS — UI-SPEC.md S1 calls for new `.cv15-progress-row` styling but the section shell at `#continue-section` is already wired into `renderTonight()` at line 4733.
3. **S2 detail modal "Your couch's progress":** the existing `renderTvProgressSection` is a per-INDIVIDUAL section. Phase 15 inserts a SIBLING tuple-keyed section directly above it (or replaces — see plan recommendation below).
4. **Trakt seed (D-05):** `trakt.ingestSyncData` at `js/app.js:702-768` already writes solo `t.progress[memberId]` tuples. D-05 needs no new code — it's the EXISTING write path. D-06 is the new code.
5. **TMDB ingestion (Q17):** `next_episode_to_air`, `last_episode_to_air`, `seasons[].air_date`, `showStatus` are ALREADY captured by `fetchTmdbDetails` at `js/app.js:6934-6989`. The fields surface in `renderDetailStatusStrip` ("Next episode Friday") TODAY. Phase 15's CF can read these fields directly from Firestore — no new TMDB ingestion path needed for the new-season-airdate push.

This finding shrinks Phase 15 substantially relative to a literal reading of CONTEXT.md. The phase is largely (a) a tuple-key generalization of an existing per-member shape, (b) one new CF + one new push category, and (c) modest UI sibling additions — NOT a new tracking subsystem.

---

## Firestore Schema Recommendation (Q1-Q4)

### Q1 — Where do progress tuples live?

**Recommendation: Option (b) — field on the title doc.**

```
families/{code}/titles/{titleId}.tupleProgress: {
  [tupleKey]: {
    season: number,
    episode: number,
    updatedAt: number,
    source: 'watchparty' | 'manual' | 'trakt-overlap',
    sourceWpId?: string,        // if source=='watchparty', the wp id that minted this
    actingUid: string,
    memberId: string,
    memberName: string
  }
}
```

**Why a field on the title doc, not a subcollection:**

| Criterion | Field on title doc (RECOMMENDED) | Per-family subcollection |
|---|---|---|
| Co-location with existing `t.progress[memberId]` (the per-individual analog) | ✅ Mirrors the shipped primitive verbatim | ✗ Splits the "where is progress?" answer across 2 surfaces |
| Co-location with `t.queues[memberId]`, `t.votes[memberId]`, `t.ratings[memberId]`, `t.reviews[memberId]` | ✅ Follows the established per-member-keyed map convention | ✗ Diverges |
| Reads at the detail modal (S2) | ✅ Already in `state.titles` — zero extra reads | ✗ Need a fresh `onSnapshot(progressRef)` per modal open or per family |
| Cross-show roll-up for Tonight widget (S1) | ✅ Trivial: walk `state.titles` once, collect tuples whose key contains `me.id` | ✗ Need to fan-out a query across all titles or maintain a denormalized index |
| Atomicity with title state (e.g., `watched: true` flip) | ✅ Single-doc update | ✗ Cross-doc transaction or separate write |
| firestore.rules complexity | ✅ Already covered by the permissive `match /titles/{titleId}` allow update branch at `firestore.rules:317-319` (`attributedWrite(familyCode)` with NO `affectedKeys` allowlist — see explicit comment at `firestore.rules:307-315` saying ANY new top-level field added by attributed write is accepted) | ✗ Need a NEW `match /families/{code}/progress/{tupleKey}_{titleId}` block |
| Doc-size ceiling (1 MB / Firestore limit) | ⚠ Theoretical risk for 100+ tuples per show — acceptable for v1 (most shows: 1-3 tuples) | ✅ Unbounded |
| Migration cost | ✅ Zero — sibling field on existing doc | ✗ New collection + new rules + new test suite |

**Estimated rules-rewrite cost:**
- **Option (b) RECOMMENDED:** 0 lines of rules changes. The existing `match /titles/{titleId}` block (`firestore.rules:317-331`) already accepts any attributed write because there's no affectedKeys allowlist on title updates (see lines 307-315 comment block — they explicitly thought about this for `t.rewatchAllowedBy` in 14-01 and the same logic applies to `t.tupleProgress`). The only rules work would be optional defense-in-depth tightening, NOT required correctness work.
- **Option (a):** ~30-40 lines for a new `match /families/{code}/progress/{progressId}` block plus 4-6 new tests in `tests/rules.test.js`.

**Therefore:** the field path is `families/{code}/titles/{titleId}.tupleProgress[tupleKey]`. (Distinct from the existing `t.progress[memberId]` field — keep both during v1; the per-individual one stays for Trakt seeding and the legacy `renderTvProgressSection` path. After two PWA cache cycles a follow-up plan can fold the per-individual entries into the tuple shape using a `[memberId]` solo tuple, matching the same dual-shape pattern Phase 14-10 used for `couchInTonight`/`couchSeating`.)

### Q2 — Tuple key encoding

**Recommendation: comma-joined sorted memberId list, no escaping needed.**

```js
// Helper (insert near getMemberProgress at js/app.js:8020):
function tupleKey(memberIds) {
  return [...memberIds].filter(Boolean).sort().join(',');
}
```

Examples (memberIds in Couch are short alphanumeric strings — see Branch A/B/C member-create rules):

```
['m_alice']                         → "m_alice"
['m_alice', 'm_bob']                → "m_alice,m_bob"
['m_alice', 'm_bob', 'm_stepson']   → "m_alice,m_bob,m_stepson"
['m_zoe']                           → "m_zoe"
```

**Why comma-join + sort:**
- Couch memberIds are already comma-safe (no internal commas — Firestore generates them via `doc()` from `members` collection or as randomized IDs from `joinAsNew`/`createSubProfile`; both produce alphanumeric IDs).
- Sorting before joining gives idempotent keys regardless of the order the watchparty roster produces them in.
- The key is used as a **map field name** (not as a doc ID), so the 1500-byte UTF-8 limit on doc IDs does not apply here. Firestore's map-key constraint is documented as "no leading underscore, no `.` characters" — comma is allowed. (Even in the worst case of 8 cushion-cap members with 20-char IDs each plus separators, the key stays under 200 bytes.)
- Reusable for the `tupleNames` map (Q3).
- Hash-encoding (e.g., SHA-256) was rejected because (a) the cleartext key is debuggable in Firestore console, (b) sorting + joining is bit-perfect deterministic across JS / Cloud Function / firestore.rules expression-language environments, and (c) hashes lose the ability to grep "who's in this tuple" without an index.

### Q3 — Tuple-name storage location

**Recommendation: confirm UI-SPEC's family-doc map approach. Specific path:**

```
families/{code}.tupleNames: {
  [tupleKey]: {
    name: string,                    // user-supplied, max 40 chars (UI-SPEC S3 input maxlength)
    setBy: string,                   // memberId who last named it
    setAt: number,                   // ms epoch
    actingUid: string,
    memberId: string,
    memberName: string
  }
}
```

Stored at the family-doc level (NOT on the title doc) because:

1. **Names are decoration, not identity (D-02):** the tuple stays as the data key on title docs. Tying names to the family doc means renaming a tuple is one write that affects every show — not a fan-out across N titles.
2. **Names are scoped per-family by definition** — the same `[m_alice, m_bob]` tuple in family X is "Date night" and in family Y is "Wife and me" if those families' members happened to share IDs (they wouldn't, because IDs are family-scoped, but the principle holds).
3. **No cross-show sync needed** — UI-SPEC S3 (inline rename) writes to one place; every show's "Your couch's progress" section reads from that one place via `state.family.tupleNames[tupleKey]?.name`.

**Read pattern (insert helper near `couchInTonightFromDoc` at `js/app.js:12943`):**

```js
function tupleDisplayName(tupleKey, members) {
  const fam = state.family || {};
  const namedEntry = (fam.tupleNames || {})[tupleKey];
  if (namedEntry && namedEntry.name) return namedEntry.name;
  // Fallback: derive from members ("Wife and me", "You (solo)", etc.)
  // For solo: if me.id is in the tuple, "You (solo)"; else `${otherName} (solo)`.
  // For pair: "<other-name> and me" if me is included, else "<a> & <b>".
  // For 3+: "You + 2" / "Mom, Dad, You" — first 3 names with comma-separator.
  // Locked details deferred to plan-phase.
  return ''; // empty → S2 renders italic placeholder "*name this couch*"
}
```

### Q4 — `tupleNames` write attribution + which rules branch

The `tupleNames` write goes to the **family doc** (not a subcollection) and so it falls under the existing UPDATE-branch system in `firestore.rules:151-181`. Phase 15 needs to **add a fifth UPDATE branch**:

```
allow update: if (
    /* branch 1: picker rotation — unchanged */
  ) || (
    /* branch 2: legacy ownership self-claim — unchanged */
  ) || (
    /* branch 3: couchSeating dual-write legacy — unchanged */
  ) || (
    /* branch 4: couchInTonight V5 — unchanged */
  ) || (
    // === NEW (Phase 15 / D-02 tuple naming) ===
    // Allow attributed family members to write a single tupleNames slot.
    // The affectedKeys allowlist explicitly names tupleNames + the four
    // attribution fields. Inner shape (slot.name, slot.setBy, slot.setAt)
    // validated client-side; rules don't peek into nested map values.
    attributedWrite(familyCode)
    && request.resource.data.diff(resource.data).affectedKeys()
        .hasOnly(['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
  );
```

Yes, the write must use `attributedWrite()` (matches the established pattern from 14-04 / 14-10 — see `firestore.rules:165-181`). This means the client write site uses `...writeAttribution()` spread, e.g.:

```js
async function setTupleName(tupleKeyStr, name) {
  if (!state.familyCode) return;
  await updateDoc(familyDocRef(), {
    [`tupleNames.${tupleKeyStr}`]: {
      name: name.slice(0, 40),
      setBy: state.me.id,
      setAt: Date.now()
    },
    ...writeAttribution()
  });
}
```

The threat model (T-15-tupleNames-01: a non-member plants a name) is mitigated by `attributedWrite` enforcing `actingUid == auth.uid` AND `isMemberOfFamily(familyCode)`.

---

## Cloud Function Architecture (Q5-Q8)

### Q5 — TMDB season-metadata polling cadence

**Recommendation: piggyback on the existing `watchpartyTick` 5-minute cadence — NOT a new onSchedule.**

The existing `watchpartyTick` CF (`queuenight/functions/index.js:642-847`) already iterates every family doc on a 5-minute schedule and is the canonical "sweep all families" primitive. It already houses 3 concerns: watchparty state flips, intent expiry, and intent T-30min warnings. Adding a 4th concern (live-release sweep) follows the same pattern locked by 14-06 (Anti-pattern #7 in Phase 14 LEARNINGS: don't fork a parallel CF when an existing primitive can be extended).

**For TMDB metadata refresh** (the slower-moving "is `next_episode_to_air` accurate?" question): we don't need a separate poll because **TMDB metadata is already fetched on title open** via `fetchTmdbDetails` at `js/app.js:6934`. The existing flow:

1. User opens a TV show detail modal.
2. `fetchTmdbDetails` runs lazily, populates `t.nextEpisode` / `t.lastEpisode` / `t.seasonsMeta` / `t.showStatus` on the title doc.
3. The fields update in Firestore via `updateDoc(doc(titlesRef(), id), { ...writeAttribution(), ...tmdbExtras })`.

Because Phase 15 only needs `t.nextEpisode` / `t.seasonsMeta` to surface the new-season-airdate push, and Phase 14's tile redesign already opens the detail modal at much higher frequency than v1, **realistic data freshness for tracked shows is on the order of "any time anyone in the family browses the title"** — TMDB normally updates `next_episode_to_air` weeks before air, so daily-or-better freshness is achievable without a dedicated poll.

**However, for shows nobody opens for weeks, we DO need a backfill sweep.** Recommendation:

```
Add to watchpartyTick (queuenight/functions/index.js:~700, INSIDE the per-family loop,
AFTER the intents loop):

  // === Phase 15 / D-11 / D-13 — TMDB freshness refresh + live-release sweep ===
  // Per family, walk titles where t.kind === 'TV' AND t.tupleProgress is non-empty
  // (i.e., at least one tuple is tracking it). For each tracked show:
  //   (a) If t.tmdbRefreshedAt < now - 24h, fetch /tv/{id} and update next_episode_to_air,
  //       seasonsMeta, lastEpisode, showStatus.
  //   (b) If t.nextEpisode.airDate is within 24h-25h from now AND >= 2 family members
  //       are tracking the show (D-14 threshold), fire flowBNominate-style push to
  //       those members suggesting a watchparty (subject to D-16 suppression — see Q8).
  //   (c) If a previously-stored t.nextEpisode.airDate just transitioned from "future" to
  //       "<= 24h from now" (relative to the prior tick), AND the show subscription gate
  //       (D-09 union-of-tuples) marks ≥1 family member as subscribed, fire newSeasonAirDate
  //       push (D-11 copy: "{Show} S{N} hits {Provider} {day}. Watch with the couch?").
```

**Cadence math:**
- Existing watchpartyTick: every 5 minutes → 288 ticks/day.
- Tracked-shows growth model: ~500 tracked TV shows total across all families in v1 (UI-SPEC's ceiling assumption).
- TMDB refresh path runs only when `t.tmdbRefreshedAt < now - 24h` → average ~21 refreshes per tick (500 / 288 ÷ 24h × 12 ticks/h × 1h = ~17), well within the ~40 req/10s rate limit shared across all families.
- Live-release push path runs only when `t.nextEpisode.airDate` is within the 24h-25h window — this is a small set per tick (most days, 0-3 across all families).

**Recommended cadence: ZERO new schedules — extend `watchpartyTick`.** Crontab is already set: `'every 5 minutes'` per `queuenight/functions/index.js:643`. No change to the schedule string.

Estimated CF runtime impact: ~+30-60% per tick (mostly the TMDB refresh sub-loop). Existing timeout is 120s; current observed runtime is well under 5s per the deployed log; new total likely under 15s. Within budget.

### Q6 — TMDB endpoints used + air-time field shape

**The existing TMDB integration uses `/tv/{id}` only, NOT `/tv/{id}/season/{n}`.** From `fetchTmdbDetails` at `js/app.js:6934`:

```js
const r = await fetch(`https://api.themoviedb.org/3/${mediaType}/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,similar`);
```

The response shape (verified against TMDB docs and the parsing at `js/app.js:6956-6989`):

```json
{
  "next_episode_to_air": {
    "air_date": "2026-04-30",         // YYYY-MM-DD only — NO TIME-OF-DAY
    "season_number": 2,
    "episode_number": 3,
    "name": "Episode title"
  },
  "last_episode_to_air": { ... same shape ... },
  "seasons": [
    {
      "season_number": 1,
      "air_date": "2025-04-15",
      "episode_count": 8,
      "name": "Season 1"
    },
    ...
  ]
}
```

**Critical gotcha for D-13 ("Thursday 9pm for Friday 9pm episode"):** TMDB's `next_episode_to_air.air_date` is a **DATE ONLY**, not a date-time. There is no "9pm" in the TMDB response. The push body in UI-SPEC ("airs Friday at 9pm") cannot be reliably populated from `/tv/{id}` alone.

**Two viable paths to recover air-time:**

1. **Heuristic: derive from network/provider conventions.** US prime-time network shows typically air at 9pm or 10pm local. We don't ship localization for v1, so picking a default ("Friday at 9pm") that matches Severance's actual slot would be wrong for shows like American Idol (8pm Mon). NOT recommended.
2. **Augment with `/tv/{id}/season/{n}/episode/{e}`** (TMDB *can* expose richer episode-level metadata via `air_date` field — but this is still date-only in the public API). The `episode_run_time` is in minutes (already captured at `js/app.js:6942`).

**Pragmatic recommendation for v1:** Drop the "at 9pm" precision from D-11 push copy. UI-SPEC.md §Copywriting Contract Push notification copy says:

```
Live-release: "{Show} S{N}E{M} airs {day} at {time}. Watch with the couch?"
```

Replace `{time}` with a coarse "tonight" / "tomorrow" / "{day}" rendering keyed off `air_date`:

```js
const airDate = parseAirDate(t.nextEpisode.airDate);
const daysOut = Math.round((airDate - new Date()) / 86400000);
const when = daysOut === 0 ? 'tonight'
            : daysOut === 1 ? 'tomorrow'
            : weekdayName(airDate);  // "Friday"
const body = `${t.name} S${n}E${e} airs ${when}. Watch with the couch?`;
```

**Open question for the user / planner:** is "airs tonight" / "airs Friday" acceptable copy, or does the user want time-of-day precision (which would require a server-side per-show network-slot lookup table out of TMDB)? Flagging in Open Questions below.

### Q7 — Live-release scheduling primitive

**Recommendation: Path (a) — daily sweep inside `watchpartyTick`. Reject Cloud Tasks.**

Three options were on the table:

| Path | Pros | Cons | Verdict |
|---|---|---|---|
| **(a) Daily sweep inside watchpartyTick** | Reuses existing CF infrastructure; no new firebase deploy artifacts; idempotent across ticks; matches Phase 14-06 primitive-extension pattern | 5-minute granularity (acceptable for "fires ~24h before air"); per-family iteration cost grows with family count | **RECOMMENDED** |
| (b) Cloud Tasks / Cloud Scheduler one-shot | Precise timing; no polling cost | New CF deploy primitive (firebase-functions doesn't natively support per-doc Cloud Tasks for v1; would need admin SDK + node-cron in CF runtime, or a separate Cloud Scheduler job per show — neither is shipped); requires re-enqueue if `next_episode_to_air` shifts; harder to suppress (D-16) | REJECT (deploy footprint too high for v1) |
| (c) New onSchedule trigger separate from watchpartyTick | Cleanest separation of concerns | Two parallel sweeps doing similar work; conflicts with Anti-pattern #7 from Phase 14 LEARNINGS | REJECT |

**Implementation outline (insert into watchpartyTick after the intents loop, around `queuenight/functions/index.js:843`):**

```js
// === Phase 15 / D-11 + D-13 — live-release sweep ===
let titlesSnap;
try {
  titlesSnap = await db.collection('families').doc(familyDoc.id).collection('titles').get();
} catch (e) { console.warn('titles list failed', familyDoc.id, e.message); continue; }

for (const tdoc of titlesSnap.docs) {
  const t = tdoc.data();
  if (t.kind !== 'TV') continue;
  if (!t.tupleProgress || Object.keys(t.tupleProgress).length === 0) continue;
  const next = t.nextEpisode;
  if (!next || !next.airDate) continue;
  // Build subscriber set per D-09/D-10: any member appearing in ANY tuple.
  // Suppress shows where t.mutedShows[memberId] is true (D-12 per-show kill-switch).
  const subscriberIds = new Set();
  for (const tupleKey of Object.keys(t.tupleProgress || {})) {
    for (const mid of tupleKey.split(',')) subscriberIds.add(mid);
  }
  // Filter out per-show muted members (D-12 / S6).
  for (const mid of [...subscriberIds]) {
    if (t.mutedShows && t.mutedShows[mid]) subscriberIds.delete(mid);
  }
  if (subscriberIds.size === 0) continue;

  // === D-14 threshold gate: ≥2 family members tracking the show ===
  const couchTrackerCount = subscriberIds.size;
  if (couchTrackerCount < 2) continue;

  // === D-13 / D-15 / D-16 — live-release prompt ===
  // Compute airDate timestamp (midday local — TMDB has only date precision).
  const airTs = new Date(next.airDate + 'T21:00:00').getTime();  // 9pm best-guess; see Q6
  const minsToAir = (airTs - now) / 60000;

  // Fire when between T-25h and T-23h (one-shot per episode via t.liveReleaseFiredFor[...])
  if (minsToAir > 60 * 23 && minsToAir <= 60 * 25) {
    const epKey = `s${next.season}e${next.episode}`;
    if (t.liveReleaseFiredFor && t.liveReleaseFiredFor[epKey]) continue;
    // === D-16 suppression: already-scheduled wins ===
    // Query watchparties for one targeting this title within the next 23-25h window.
    const wpSnap = await db.collection('families').doc(familyDoc.id).collection('watchparties')
      .where('titleId', '==', tdoc.id)
      .where('startAt', '>=', airTs - 90 * 60000)   // ±90min around airTs
      .where('startAt', '<=', airTs + 90 * 60000)
      .get();
    if (!wpSnap.empty) {
      // Mark as fired anyway so we don't re-evaluate every 5min.
      await tdoc.ref.update({ [`liveReleaseFiredFor.${epKey}`]: 'suppressed_existing_wp' });
      continue;
    }
    // Fire push
    await sendToMembers(familyDoc.id, [...subscriberIds], {
      title: 'Live tonight',
      body: `${t.name} S${next.season}E${next.episode} airs ${dayName(airTs)}. Watch with the couch?`,
      tag: `live-release-${tdoc.id}-${epKey}`,
      url: `/?nominate=${tdoc.id}&prefillTime=${airTs}`,    // deep-link to Flow B prefilled
    }, { eventType: 'newSeasonAirDate' });
    await tdoc.ref.update({ [`liveReleaseFiredFor.${epKey}`]: now });
  }

  // === D-11 — new-season-airdate push (fires once per season ingest) ===
  // When seasonsMeta has a new season's air_date that wasn't previously surfaced (i.e.,
  // this season number hasn't been in lastSeasonNotifiedFor), fire push.
  // Implementation: track t.lastSeasonNotifiedFor = { [seasonNumber]: timestamp } and
  // compare against seasonsMeta[].season. Defer specifics to plan-phase.
}
```

**Key idempotency knobs:**
- `t.liveReleaseFiredFor[epKey]` — stamped on push success; prevents re-fire on subsequent ticks. (Suppressed-by-existing-wp also stamps with a sentinel value.)
- Day-of-week / season-number gates — TMDB `next_episode_to_air` only changes after an episode airs, so the same `epKey` won't fire twice per episode.
- Per-tick early-continue gates — `t.tupleProgress empty` / `kind !== TV` / `next.airDate missing` short-circuit the cheap cases.

### Q8 — D-16 suppression query

**Recommendation: titleId + startAt-window query (shown in Q7 above).**

The watchparty schema (verified from `js/app.js:9665-9824` + `firestore.rules:364-368`) keys on `families/{code}/watchparties/{wpId}` with fields `{titleId, startAt, status, hostId, ...}`. Suppression checks "is there a watchparty for THIS title within ±90min of the live air time?":

```js
const wpSnap = await db.collection('families').doc(familyCode)
  .collection('watchparties')
  .where('titleId', '==', titleId)
  .where('startAt', '>=', airTs - 90 * 60000)
  .where('startAt', '<=', airTs + 90 * 60000)
  .get();
const blocking = wpSnap.docs.filter(d => {
  const wp = d.data();
  return wp.status !== 'archived' && wp.status !== 'cancelled';
});
return blocking.length > 0;
```

**Index required:** Firestore needs a composite index on `(titleId asc, startAt asc)` within the watchparties subcollection. Add to `queuenight/firestore.indexes.json`:

```json
{
  "collectionGroup": "watchparties",
  "queryScope": "COLLECTION",
  "fields": [
    {"fieldPath": "titleId", "order": "ASCENDING"},
    {"fieldPath": "startAt", "order": "ASCENDING"}
  ]
}
```

(Phase 15's plan task for the deploy-mirror sibling repo includes this index addition. `firebase deploy --only firestore:indexes` runs from `~/queuenight`.)

**±90min window justification:** D-13 says 24h-before push for a Friday 9pm episode. Tolerating a watchparty that's already scheduled within ±90min of the airtime covers (a) someone who scheduled at 10pm thinking "we'll start it together when it drops" and (b) someone who scheduled at 8:30pm ("watch it before bed"). Tighter than ±90min risks false negatives; looser risks false positives where the family's already settled on a 7pm watchparty for a different episode of the same show.

---

## Frontend Insertion Points (Q9-Q13)

All line numbers verified against `js/app.js` as of 2026-04-26 (working tree).

### Q9 — Watchparty-end auto-tracking hook (D-01)

**Function:** `window.endMyWatchparty` at **`js/app.js:10601`** (line range 10601-10625).

This is the canonical "I just finished watching" handler. It already:
1. Builds the cowatchers list (`Object.entries(wp.participants).filter([mid,p] => p.startedAt)` at line 10608).
2. Closes the live modal.
3. Defers to `openPostSession(wpId)` at line 10617-10618 (delayed 200ms) for the rating/photo/schedule-next surface.

**Phase 15 hook recommendation:** insert the auto-track tuple write **inside `openPostSession`** at `js/app.js:10438-10456` rather than `endMyWatchparty`. Reason: `endMyWatchparty` is hit only by the actor who tapped "Done"; `openPostSession` is the ratings UI and a different actor opens it for their own ratings. By writing the tuple inside `openPostSession` we have access to BOTH the wp roster AND the just-watched titleId AND the fact that an episode was actually watched (vs cancelled / abandoned).

**However** — `openPostSession` doesn't know which **episode** was watched (D-03's `{seasonIndex, episodeIndex}` shape). The watchparty doc has `wp.titleId` but not the episode. Two solutions:

| Solution | Source of episode | Ergonomic |
|---|---|---|
| (a) Read `t.progress[hostId]?.episode` and infer "+1" | Implicit; assumes host advanced before/during watchparty | Brittle — host might not have updated |
| (b) Add a single-step episode picker in the post-session modal ("Just finished S2 E3?") | Explicit | UI footprint; locked Phase 15 scope |
| (c) Read `wp.episodeRef` from the watchparty doc IF watchparty creation captured it | Currently NOT in schema | Requires upstream change to `openWatchpartyStart` |

**Recommended for v1:** option (a) **with a single fallback** — read `t.progress[hostId]?.episode || 1` plus a confirmation step in `openPostSession` UI ("Mark S{N} E{M} watched as Wife and me?" Yes/Edit). This piggybacks on the existing rating UI which the post-session modal already mounts.

**Concrete insertion point:**

```js
// js/app.js:10438-10456 — extend openPostSession to write tuple progress.
// Insert after line 10445 (right after _postSessionRating reset, before the sub render).

// === Phase 15 / D-01 — auto-track tuple progress on watchparty end ===
const wpParticipants = Object.keys(wp.participants || {}).filter(mid => {
  const p = wp.participants[mid];
  return p && p.startedAt;  // only those who actually started timers
});
if (wpParticipants.length >= 1 && wp.titleId) {
  const t = state.titles.find(x => x.id === wp.titleId);
  if (t && t.kind === 'TV') {
    // Inferred episode: latest known per-host progress + 1.
    const hostProgress = (t.progress || {})[wp.hostId] || { season: 1, episode: 0 };
    const inferredSeason = hostProgress.season;
    const inferredEpisode = hostProgress.episode + 1;
    state._pendingTupleAutoTrack = {
      titleId: wp.titleId,
      memberIds: wpParticipants,
      season: inferredSeason,
      episode: inferredEpisode,
      sourceWpId: wpId
    };
    // Plan can: render an inline "Mark S{N} E{M} for {tupleName}?" confirmation
    // in the post-session modal; on confirm, call writeTupleProgress(...).
    // Defer: D-03 says "explicit toggle" is the override path so a UI confirmation
    // beat is consistent with the locked decisions.
  }
}
```

A new write helper sibling to `writeMemberProgress` at `js/app.js:8052`:

```js
async function writeTupleProgress(titleId, memberIds, season, episode, source) {
  if (!titleId || !memberIds || !memberIds.length) return;
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const tupleKeyStr = tupleKey(memberIds);
  const prev = (t.tupleProgress && typeof t.tupleProgress === 'object') ? { ...t.tupleProgress } : {};
  prev[tupleKeyStr] = {
    season, episode,
    updatedAt: Date.now(),
    source: source || 'manual',
    ...writeAttribution()  // attribution required by firestore.rules
  };
  await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), tupleProgress: prev });
}
```

### Q10 — Trakt history import callback (D-05/D-06)

**File:** `js/app.js:619-768` (the `trakt.sync` and `trakt.ingestSyncData` flow).

Critical lines:
- `js/app.js:702-768` — the `for (const entry of (data.watchedShows || []))` loop where Trakt episode history gets converted to per-member `t.progress` writes (already shipped — see line 731-749). **D-05 requires NO new code here.** This is the existing solo seed.
- `js/app.js:781` — `entry.last_watched_at` IS already captured into `watchedAt` (for movies). For shows, the per-episode timestamp is at `entry.seasons[].episodes[].last_watched_at` per Trakt API but the existing code does NOT capture it (only the max season/episode).

**For D-06 (co-watch overlap with user confirmation):** insert a NEW sibling helper after `trakt.ingestSyncData` returns. The overlap detection cannot run until BOTH family members have synced Trakt at least once — so the natural place is at the end of `trakt.sync` after stamping `lastSyncedAt`.

**Concrete insertion point:**

```js
// js/app.js:619 — trakt.sync function.
// AFTER the sync result is returned (~line 660), AFTER the lastSyncedAt write at line 657,
// insert a sibling primitive that probes for co-watch overlap and surfaces the
// confirmation prompt (UI-SPEC S5) for any candidate pairs.

async function detectAndPromptCoWatchOverlap() {
  if (!state.me || !state.familyCode) return;
  // Walk every TV title; for each, compute pairs of members whose
  // t.progress[member].source === 'trakt' AND updatedAt within 3-hour window.
  // For each candidate pair, skip if a tupleProgress already exists for that pair on
  // that title (we don't ask twice). Queue prompt in state._coWatchPromptQueue.
  // Plan-phase locks the exact criteria; the entry point + state slot are right here.
}
trakt.detectAndPromptCoWatchOverlap = detectAndPromptCoWatchOverlap;
```

The prompt itself is locked in UI-SPEC S5 (`.modal-bg` shell from `css/app.css:478` + Yes/No layout matching 14-08 Flow B counter rows). The render function lives near `openFlowBNominate` (~`js/app.js:14130+` zone — sibling primitive insertion convention).

**Note on Trakt episode-timestamp capture:** the existing ingest at `js/app.js:710-720` only tracks `maxEpisodeInSeason` — it does NOT preserve per-episode `last_watched_at`. For the 3-hour-overlap window check to work properly, Phase 15 needs to **augment** the ingest loop to additionally capture `entry.seasons[lastSeason].episodes[lastEpisode].last_watched_at` and write it to `t.progress[memberId].watchedAt`. This is a 3-line addition at `js/app.js:715-721`:

```js
for (const ep of (s.episodes || [])) {
  if (ep.number > maxEpisodeInSeason) {
    maxEpisodeInSeason = ep.number;
    lastWatchedAt = ep.last_watched_at ? new Date(ep.last_watched_at).getTime() : null;
  }
}
// ...
prevProgress[meId] = { season: maxSeason, episode: maxEpisodeInSeason, lastWatchedAt, updatedAt: Date.now(), source: 'trakt' };
```

(Without `lastWatchedAt`, the overlap detection collapses to "did both members reach the same `{season, episode}` ever, regardless of when?" which is a much weaker signal.)

### Q11 — `renderTonight` and Tonight-tab DOM structure

**Function:** `renderTonight()` at **`js/app.js:4730-4885`**.

Render order (verified from the function body):

| Step | Line | Action | Notes |
|---|---|---|---|
| 1 | 4731 | `renderPickerCard()` | shows "Tonight's pick goes to" |
| 2 | 4732 | `renderUpNext()` | renders `#upnext-section` |
| 3 | 4733 | `renderContinueWatching()` | renders `#continue-section` (per-individual TV continue) |
| 4 | 4734 | `renderNext3()` | "Up next" 3-card group recommendations |
| 5 | 4735 | `renderMoodFilter()` | mood chips |
| 6 | 4736 | `updateFiltersBar()` | filter pill |
| 7 | 4740-4878 | matches list + considerable + vetoed | the main `#matches-list` body |
| 8 | 4881 | `renderCouchViz()` | renders `#couch-viz-container` (V5 roster pills — top of screen visually) |
| 9 | 4884 | `renderFlowAEntry()` | renders `#flow-a-entry-container` |

**Visual order (Tonight tab DOM, from `app.html:308-394`):**

```
#screen-tonight
├── #couch-viz-container         (line 317 — V5 hero icon + roster)
├── #flow-a-entry-container      (line 320 — Flow A entry CTA)
├── .picker-card                 (line 321 — "tonight's pick goes to")
├── #wp-banner-tonight           (line 329)
├── #tonight-intents-strip       (line 332 — Phase 8 intents)
├── .t-filters / mood            (line 338-356)
├── .t-section "Tonight's picks" (line 358-365 — #matches-list)
├── #upnext-section              (line 367)
├── #continue-section            (line 374 — already-rendered TV per-individual)
├── #next3-section               (line 376)
└── .activity-section            (line 384)
```

**Phase 15 / S1 widget insertion (per UI-SPEC.md):**

UI-SPEC says S1 sits BELOW couch viz, ABOVE Flow A entry. That maps to inserting a NEW container between line 317 and line 320 in `app.html`:

```html
<!-- Phase 15 / S1 — "Pick up where you left off" tuple-aware progress widget -->
<div id="cv15-pickup-container" class="cv15-pickup-container" aria-label="Pick up where you left off"></div>
```

…AND adding `renderPickupWidget()` to the `renderTonight` call sequence at `js/app.js:4884` (sibling-after `renderFlowAEntry`).

**However** — UI-SPEC also says S1 should be a CROSS-SHOW roll-up (different from the existing `#continue-section` which is Continue-watching also cross-show but per-individual). Phase 15 plan-phase decision: should S1 SUPPLEMENT `#continue-section` or REPLACE it for users with tuple progress?

**Recommendation:** SUPPLEMENT (don't replace). The existing `#continue-section` shows your individual show progress and renders for users without tuples. Phase 15's S1 shows tuple-aware progress and renders only when at least one tuple exists. Both can coexist; UI-SPEC.md explicitly says S1 hides when zero tuples exist (no empty state). When both are active, render order from top: `#cv15-pickup-container` (S1) → `#continue-section` (legacy) — most-recent-tuple first, then per-individual fallback. This matches the same dual-shape coexistence pattern used in 14-10 for couchInTonight/couchSeating.

### Q12 — Detail-modal section render path (S2 + S6)

**Function:** `renderDetailShell(t)` at **`js/app.js:7179-7244`**.

Section render order in `renderDetailShell` (lines 7223-7243):

| Order | Line | Section | Notes |
|---|---|---|---|
| 1 | 7227 | `.detail-name` (title + rating pill) | header |
| 2 | 7228 | `.detail-meta` | year · kind · runtime |
| 3 | 7229 | `.detail-genres` | genre pills |
| 4 | 7230 | `${moodsHtml}` | renderDetailMoodsSection |
| 5 | 7231 | `.detail-overview` | synopsis |
| 6 | 7232 | "+ Add to list" pill | |
| 7 | **7233** | **`${renderTvProgressSection(t)}`** | per-INDIVIDUAL Progress section (the existing one) |
| 8 | 7234 | `${trailerHtml}` | YouTube iframe |
| 9 | 7235 | `${providersHtml}` | Where to watch |
| 10 | 7236 | `${castHtml}` | Cast |
| 11 | 7237 | `${similarHtml}` | You might also like |
| 12 | 7238 | `${renderDiaryForTitle(t)}` | Diary entries |
| 13 | 7239 | `${renderReviewsForTitle(t)}` | Family-local reviews |
| 14 | 7240 | `${renderTmdbReviewsForTitle(t)}` | TMDB community reviews (Phase 14-05) |
| 15 | 7241 | `${renderWatchpartyHistoryForTitle(t)}` | Watchparties for this title |

**UI-SPEC.md S2 insertion:** "ABOVE reviews, BELOW cast" → between line 7236 (cast) and line 7237 (similar). But UI-SPEC explicitly says "above reviews" means above `renderTmdbReviewsForTitle` (line 7240). Proposed placement:

```js
// New insertion line ~7239 (between renderReviewsForTitle and renderTmdbReviewsForTitle).
${renderCv15TupleProgressSection(t)}   // Phase 15 / S2 — "Your couch's progress"
```

**Render-function recommendation (sibling primitive insertion convention):**

```js
// js/app.js:8290+ — insert directly above renderTvProgressSection at line 8291.
// Sibling primitive: NEW function, existing function unchanged.
// === Phase 15 / D-04 / S2 — "Your couch's progress" (tuple-aware) ===
function renderCv15TupleProgressSection(t) {
  if (t.kind !== 'TV' || t.watched) return '';
  const tuples = t.tupleProgress || {};
  if (Object.keys(tuples).length === 0) {
    // UI-SPEC.md S2 empty state — section hides when no tuples exist on this show.
    return '';
  }
  // Sort by watchedAt descending; max 4 visible (UI-SPEC.md cross-tuple visual handling).
  const rows = Object.entries(tuples)
    .sort(([,a],[,b]) => (b.updatedAt||0) - (a.updatedAt||0))
    .slice(0, 4)
    .map(([tk, prog]) => {
      const memberIds = tk.split(',');
      const displayName = tupleDisplayName(tk, state.members);
      const isUnnamed = !displayName;
      // ... render row per UI-SPEC.md spec
    });
  // S6 nested inline kill-switch (mutedShows) at the bottom.
  return `<div class="detail-section detail-cv15-progress">
    <h4>YOUR COUCH'S PROGRESS</h4>
    ${rows.join('')}
    ${renderCv15MutedShowToggle(t)}
  </div>`;
}
```

The existing `renderTvProgressSection(t)` at line 8291 (per-individual) is **NOT modified**. Both sections coexist during v1; a follow-up plan can migrate `renderTvProgressSection` to be tuple-only after the per-individual progress data folds into solo tuples.

### Q13 — Existing tuple-keyed Firestore patterns to clone

UI-SPEC.md notes Phase 14-10 `couchInTonight` shape (`{[memberId]: {in, at, proxyConfirmedBy?}}`) as the closest analog. Verified locations:

**Reader:** `couchInTonightFromDoc` at **`js/app.js:12943-12962`**.

```js
function couchInTonightFromDoc(d) {
  if (d && d.couchInTonight && typeof d.couchInTonight === 'object') {
    return d.couchInTonight;
  }
  // Legacy fallback: rebuild from couchSeating.
  ...
}
function couchInTonightToMemberIds(cit) {
  // returns the array of memberIds where cit[mid].in === true
}
```

Reader pattern for tuple-keyed maps in Phase 15 should match:

```js
// New reader near tupleDisplayName helper (Q3).
function tupleProgressFromTitle(t) {
  if (!t || !t.tupleProgress) return {};
  return t.tupleProgress;
}
function tuplesContainingMember(t, memberId) {
  const out = [];
  const tp = t.tupleProgress || {};
  for (const tk of Object.keys(tp)) {
    if (tk.split(',').includes(memberId)) out.push({ tupleKey: tk, prog: tp[tk] });
  }
  return out;
}
```

**Writer:** `persistCouchInTonight` at **`js/app.js:13213-13238`**. Reuse pattern:

```js
async function writeTupleProgress(titleId, memberIds, season, episode, source) {
  // (full implementation in Q9 above)
}
```

**Snapshot hydration:** `js/app.js:4136-4142` — family-doc onSnapshot already hydrates `state.couchInTonight`. Phase 15's tuple progress lives on title docs, so the existing `state.titles` snapshot at `js/app.js:~4060` (the `onSnapshot(titlesRef(), ...)` block) automatically picks up `t.tupleProgress` updates with zero new wiring.

**For tupleNames at the family-doc level:** add a single line to the family-doc onSnapshot handler at `js/app.js:4136-4147` (right after the couchInTonight hydration):

```js
state.family = state.family || {};
state.family.tupleNames = (d && d.tupleNames) || {};
```

---

## firestore.rules Plan (Q14-Q15)

### Q14 — 5th UPDATE branch for `tupleNames`

**Rules file:** `~/queuenight/firestore.rules` (sibling deploy-mirror; the source-of-truth at production).

The family-doc `match /families/{familyCode}` `allow update` block currently has 4 branches (lines 151-181) — picker / legacy-ownership-claim / couchSeating / couchInTonight. Phase 15 adds a 5th branch:

```javascript
// Insert after the couchInTonight branch (currently the closing `);` at line 181).
// New:
) || (
  // === Phase 15 / D-02 — tupleNames write (decoration map for tuple progress) ===
  // Allows attributed family members to write their family's tupleNames map.
  // Inner shape (slot.name, slot.setBy, slot.setAt) validated client-side; rules
  // don't peek into nested map values per the established pattern (e.g., couchInTonight
  // proxyConfirmedBy is also nested-only). Phase 15 / S3 inline rename consumes.
  attributedWrite(familyCode)
  && request.resource.data.diff(resource.data).affectedKeys()
      .hasOnly(['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
);
```

For the `t.tupleProgress` field (on title docs, NOT family docs), the existing `match /titles/{titleId}` allow update at `firestore.rules:317-319` is permissive (`attributedWrite(familyCode)` with no affectedKeys allowlist) and already covers the new field. **NO rules change needed for `t.tupleProgress`.** The explicit comment block at lines 307-315 is exactly the pattern for `t.rewatchAllowedBy` in Phase 14 — and `t.tupleProgress` falls under the same regime.

### Q15 — Per-show notif kill-switch storage (S6)

**Recommendation: per-title member-keyed map `t.mutedShows: {[memberId]: true}`.**

Two options were on the table:

| Option | Path | Pros | Cons |
|---|---|---|---|
| (a) per-member array | `members/{id}.mutedShows: [titleId]` | Reads at member level (one doc) | Sparse; unbounded array growth; member-doc rules stricter (only self can update at `firestore.rules:225-235`); requires per-member-doc-update for muting |
| **(b) per-title member-keyed map (RECOMMENDED)** | `titles/{id}.mutedShows: {[memberId]: true}` | Mirrors `t.queues / t.votes / t.ratings / t.progress / t.tupleProgress` per-member-keyed convention; covered by existing permissive title rules; reads collocated with the title (no extra fetch); CF can read directly when sweeping `tupleProgress` for D-11 push subscriber set | Slightly more writes if a member mutes 50 shows (each is a separate title-doc update — but realistically a member mutes 1-2 shows, max) |

**Rules:** zero new branches needed. The title-doc `attributedWrite()` covers it (same logic as `t.tupleProgress` above).

**Tests to add to `tests/rules.test.js`:** Phase 14 added 22 passing tests covering couchSeating + couchInTonight branches. Phase 15 should add **4-6 sibling tests** under a new `// === Phase 15 / Tracking Layer ===` block:

| # | Test | Expected |
|---|------|----------|
| 1 | Member writes `tupleNames.{tk}` with full attribution → permitted | PASS |
| 2 | Non-member writes `tupleNames.{tk}` → permission_denied | DENY |
| 3 | Member writes `tupleNames.{tk}` AND `couchInTonight` in the same atomic update → DENY (the affectedKeys allowlist for the new branch ONLY allows tupleNames; mixing with couchInTonight fails the `hasOnly` check) | DENY |
| 4 | Non-attributed write to `tupleNames.{tk}` (missing `actingUid`) → DENY (and not covered by legacyGraceWrite either) | DENY |
| 5 | Member writes `t.tupleProgress[tk]` on a title doc → permitted (covered by existing branch, but worth a regression test) | PASS |
| 6 | Member writes `t.mutedShows[memberId]` on a title doc → permitted | PASS |

Each test follows the existing `tests/rules.test.js` skeleton pattern from 14-04 (4 tests added, 22/22 passing per `14-04-SUMMARY.md`).

---

## TMDB Ingestion Adjustments (Q17)

**Confirmed via Grep:** `number_of_seasons` is captured at `js/app.js:6943` and `js/app.js:849`; `episode_run_time` at `js/app.js:6942` and `js/app.js:843`. Both populated by `fetchTmdbDetails` at `js/app.js:6934-7032`.

**Also confirmed via Grep:** `next_episode_to_air` is ALREADY captured at `js/app.js:6956-6966`:

```js
if (d.next_episode_to_air) {
  const n = d.next_episode_to_air;
  out.nextEpisode = {
    airDate: n.air_date || null,
    season: n.season_number || null,
    episode: n.episode_number || null,
    name: n.name || ''
  };
}
```

`last_episode_to_air` at lines 6969-6977; `seasonsMeta` (per-season air dates + episode counts) at lines 6980-6989; `showStatus` at lines 6949-6953.

**Migration approach for already-ingested titles:** the per-tick refresh logic recommended in Q5/Q7 (every-24h check via `t.tmdbRefreshedAt`) will naturally backfill `t.nextEpisode` for titles that were ingested before they had a known next episode. No one-time migration script needed.

The ONE missing field for D-13's "Friday at 9pm" precision is **air-time-of-day**, which TMDB does not expose via `/tv/{id}`. See Q6 for the recommended fallback: drop time-of-day from the push body and use `{day}` only ("airs Friday").

**Net change to TMDB ingestion path:** adding a server-side TMDB fetch from `watchpartyTick` (queuenight CF, NOT the client). Two implementation options:

| Option | Where TMDB fetch happens | Pros | Cons |
|---|---|---|---|
| **(a) CF-side fetch (RECOMMENDED)** | `watchpartyTick` directly calls `https://api.themoviedb.org/3/tv/{id}` | Server has higher rate-limit budget (CF runtime); doesn't depend on a user opening a detail modal; matches the "sweep all families" scope of the existing tick | Requires TMDB key in CF env |
| (b) Client-piggyback | Set a flag on title docs that triggers next user opening detail modal to refresh | No CF code | Slow; depends on user interaction; doesn't deliver D-13 punctuality |

**TMDB key in CF:** the project's CLAUDE.md says TMDB key is public-by-design and embedded in client. The CF can use the same key (it's already in `js/constants.js` exported as `TMDB_KEY`). Adding it to the CF env is `firebase functions:config:set tmdb.key="..."` from `~/queuenight`. Or just embed inline (it's public; no security regression).

---

## Cross-Repo Deploy Ordering (Q16)

Phase 15 spans both repos; the deploy ritual must obey strict ordering or installed PWAs get permission-denied (this is the gap that bit Phase 14-10 — see `14-LEARNINGS.md` "approved-deploy" lesson).

**Locked deploy order:**

```
1. cd ~/queuenight && firebase deploy --only firestore:rules --project queuenight-84044
   — adds the 5th UPDATE branch (tupleNames) to live rules.
   — without this, the next step's writes from PWAs running v34.1+ code would be
     permission-denied.

2. cd ~/queuenight && firebase deploy --only firestore:indexes --project queuenight-84044
   — deploys the watchparties (titleId asc, startAt asc) composite index for D-16
     suppression queries.

3. cd ~/queuenight && firebase deploy --only functions
   — deploys: extended watchpartyTick with tracking sweep + new newSeasonAirDate
     push category in NOTIFICATION_DEFAULTS.

4. cd ~/claude-projects/couch && bash scripts/deploy.sh 35.0-tracking-layer
   — auto-bumps sw.js CACHE → couch-v35.0-tracking-layer
   — mirrors couch repo into queuenight/public/
   — runs firebase deploy --only hosting
   — at this point installed PWAs invalidate on next online activation.
```

**Which plan tasks produce which deployable artifacts:**

| Plan (suggested) | Repo | Artifact | Deploy step |
|---|---|---|---|
| 15-01 (data shape + rules) | queuenight | firestore.rules 5th UPDATE branch + index | Step 1 + 2 |
| 15-02 (tuple write helpers) | couch | js/app.js (writeTupleProgress, tupleKey, tupleDisplayName, tuplesContainingMember) + state.family.tupleNames hydration | Step 4 |
| 15-03 (auto-track from watchparty end) | couch | js/app.js openPostSession extension + UI confirmation beat | Step 4 |
| 15-04 (D-04a / S2 detail-modal section) | couch | js/app.js renderCv15TupleProgressSection + renderDetailShell insertion | Step 4 |
| 15-05 (D-04b / S1 Tonight widget) | couch | app.html #cv15-pickup-container + js/app.js renderPickupWidget + css/app.css | Step 4 |
| 15-06 (CF live-release sweep) | queuenight | functions/index.js watchpartyTick extension | Step 3 |
| 15-07 (push category + S4 Settings + S6 kill-switch) | both | queuenight/functions/index.js NOTIFICATION_DEFAULTS + couch js/app.js DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS | Steps 3 + 4 |
| 15-08 (D-06 co-watch overlap S5 prompt + Trakt episode-timestamp capture) | couch | js/app.js trakt.ingestSyncData augment + co-watch detection + S5 prompt | Step 4 |
| 15-09 (CACHE bump + changelog v35) | couch | sw.js + changelog.html | Step 4 |
| 15-10 (rules tests) | queuenight | tests/rules.test.js Phase 15 block | Run before Step 1 |

The `bash scripts/deploy.sh 35.0-tracking-layer` invocation handles step 4 atomically via the established Phase 13-14 pattern. Steps 1-3 run from `~/queuenight` (same machine; user has confirmed in Phase 14 deploy this works).

---

## Recommended Plan Decomposition

This is a HINT, not a hard structure. Phase 14 used 9-10 plans; Phase 15 is smaller (data primitive already exists per the foundational finding). **Suggested 6-8 plans:**

| # | Plan | Repo touch | Dependencies |
|---|---|---|---|
| 15-01 | **Data shape + rules + tests** — `t.tupleProgress` field (no rules change), `families.tupleNames` 5th UPDATE branch, `t.mutedShows`, watchparties (titleId, startAt) index, 4-6 rules tests | queuenight | none (foundational) |
| 15-02 | **Tuple write helpers + hydration** — `tupleKey`, `writeTupleProgress`, `clearTupleProgress`, `tupleDisplayName`, `tuplesContainingMember`, `state.family.tupleNames` snapshot hydration | couch | 15-01 |
| 15-03 | **Auto-track tuple on watchparty end (D-01)** + per-show muted helper (`writeMutedShow`) — extends `openPostSession` with tuple confirmation; sibling write to `t.mutedShows` | couch | 15-02 |
| 15-04 | **S2 detail-modal section + S3 inline rename + S6 kill-switch** — `renderCv15TupleProgressSection` + `renderCv15MutedShowToggle` + inline rename UX; insert at `renderDetailShell` between line 7239 and 7240 | couch | 15-02 + 15-03 |
| 15-05 | **S1 Tonight widget** — `#cv15-pickup-container` in app.html, `renderPickupWidget` in app.js, hook into `renderTonight` after `renderFlowAEntry`, CSS in css/app.css | couch | 15-02 |
| 15-06 | **CF live-release sweep + new-season push (D-11/D-13/D-14/D-15/D-16)** — extend `watchpartyTick` after intents loop; D-16 watchparty suppression query; `t.liveReleaseFiredFor[epKey]` idempotency; CF-side TMDB refresh | queuenight | 15-01 |
| 15-07 | **Push category triad (D-12 / 8th key) + S4 Settings + Trakt overlap detection (D-05/D-06) + S5 prompt** — single new key `newSeasonAirDate` in 3 places; trakt.ingestSyncData capture of `last_watched_at`; co-watch overlap detection; S5 modal from `.modal-bg` shell | both | 15-02 + 15-04 + 15-06 |
| 15-08 | **CACHE bump + changelog v35 + cross-repo deploy ritual** — sw.js → couch-v35.0-tracking-layer; changelog.html v35 article; deploy gate documentation | couch | 15-01 through 15-07 |

Plan 15-08 is the close-out plan matching Phase 14-09's pattern. Plan-bouncing 15-04+15-05 together if scope is small enough, or splitting 15-06 into "sweep" + "push fan-out" if the executor finds the watchpartyTick changes are large, are both reasonable plan-time refinements. Phase 15 may also benefit from a sketch round if the user wants S1 visual variation explored before lock-in (probably unnecessary given UI-SPEC.md's level of prescription).

**Requirements to mint at /gsd-plan-phase 15:** likely TRACK-15-01 through TRACK-15-08 (matching Phase 14's DECI-14-* convention, scoped to one requirement per plan).

---

## Open Questions

1. **Time-of-day precision in D-13 push body (Q6).** TMDB only provides date, not time-of-day. UI-SPEC's "airs Friday at 9pm" copy cannot be honored verbatim from TMDB alone. Options: (a) drop time-of-day, use "{day}" only ("airs Friday"); (b) add a per-show network-airtime mapping table (server-side); (c) defer to user-confirm at push-tap. Recommend (a) for v1; flag this for the user explicitly at /gsd-plan-phase 15.

2. **Episode inference at watchparty end (Q9).** The auto-track tuple write needs a `{season, episode}` value but the watchparty doc doesn't store episode. Recommended fallback: `t.progress[hostId]?.episode + 1` plus a single-step UI confirmation in the post-session modal. Open: should the watchparty creation flow capture an episode reference upstream (would require a Phase 7-style "which episode?" selector at `openWatchpartyStart` — Phase 16 territory? Or Phase 15 polish?).

3. **D-09 union-of-tuples subscriber set vs the per-show kill-switch precedence (D-12 / S6).** When a user is in a tuple AND has muted that show, S6 wins (push suppressed). The push subscriber-set computation in Q7 handles this correctly. But what if a user mutes the show, then a NEW season is added 6 months later — does the mute persist or should it expire? Recommendation for v1: persistent mute, no expiry — recoverable via S6 inline "Re-enable" (UI-SPEC §Surface S6). Lock at /gsd-plan-phase 15.

4. **Co-watch overlap window (D-06).** "3 hours" was an example. Real Trakt scrobble timestamps for two co-watching family members typically land within ±15 minutes (synchronized session) but can drift to several hours when sessions are paused/resumed. Recommend 3 hours as a compromise; tune post-launch from telemetry. Lock at /gsd-plan-phase 15.

5. **Existing `t.progress[memberId]` legacy data: keep or fold into solo tuples?** The foundational finding above proposes coexistence during v1. After two PWA cache cycles, a follow-up plan can fold all `t.progress[memberId]` entries into `t.tupleProgress[memberId]` (where the tupleKey is the singleton `[memberId]`). This is post-Phase-15 polish. Confirm in plan-phase that v1 keeps both shapes.

---

## Risks & Landmines

1. **TMDB rate-limit interactions with the new CF refresh.** The CF-side TMDB fetch (Q5/Q7) consumes from a shared 40 req/10s budget. With ~500 tracked shows refreshed every 24h, the load is light (~21 fetches per 5min tick). But if a future feature also adds CF-side TMDB calls, the budget can saturate. Mitigation: track `t.tmdbRefreshedAt` per title and never refresh more than once per 24h per title; respect a global "no more than 30 fetches per tick" hard cap.

2. **iOS Safari touch-DnD is NOT introduced by Phase 15** — the inline rename (S3) uses a single-line `<input>` overlay (not drag-reorder). The Phase 14-03 carry-over UAT for iOS Safari touch-DnD does not regress. Verified by reading UI-SPEC §Surface S3 — pencil glyph reveals input; no DnD primitive. Continue treating Phase 14-03's iOS Safari UAT as out-of-scope-here.

3. **Cross-repo deploy ordering (rules → indexes → CFs → app).** Phase 14's "approved-deploy" lesson (`14-LEARNINGS.md`) is still fresh. Phase 15's plan-08 must encode the ordering verbatim and the executor must run all four steps, not just the hosting deploy. Fail-safe: add a smoke-test step (curl rules version + functions list) before declaring v35 live.

4. **Watchparty index deploy is non-trivial.** A new composite index can take 1-5 minutes to build in production. Phase 15 plan-06 (CF) cannot be invoked safely until the index is live (the suppression query will fail with a "no index" error). Mitigation: deploy index FIRST (step 2 in the deploy order); functions step 3 reads the index; step 4 ships the client. The index build runtime is observable via `firebase firestore:indexes` listing.

5. **Map-key length explosion at large couch sizes.** Cushion cap is 8 (per CONTEXT 14-04 D-06). 8 memberIds × ~20 chars + 7 commas ≈ 167 bytes per key. Firestore allows 1500 bytes for doc IDs and 1500 for map keys. We're under by 10x. No risk, but plan-phase should reject any future scope creep that lifts the cushion cap to 20+ without re-checking encoding.

6. **`t.tupleProgress` doc-size growth.** A show with 100 tuples × 100 bytes/tuple = 10KB on the title doc. Firestore's 1MB doc limit is comfortable. Hard ceiling: ~1000 tuples per show (way beyond v1). Telemetry: track P95 tuple count per show post-launch; alert if any exceeds 50.

---

## Sources

### Primary (HIGH confidence)
- `js/app.js` — verified line numbers via Grep + targeted Read (offset/limit per CLAUDE.md token-cost rule)
- `app.html:308-394` — Tonight tab DOM structure, full read
- `~/queuenight/firestore.rules` — full read (current production rules including 14-10 4th UPDATE branch)
- `~/queuenight/functions/index.js` — Grep + Read for watchpartyTick (lines 642-847), sendToMembers (lines 104-161), NOTIFICATION_DEFAULTS (lines 74-96)
- `.planning/phases/14-decision-ritual-core/14-CONTEXT.md` — DR-1, DR-3, D-09 schema details
- `.planning/phases/14-decision-ritual-core/14-LEARNINGS.md` — patterns, surprises, deploy-ordering lesson
- `.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md` — push-category triad three-place pattern
- `.planning/phases/14-decision-ritual-core/14-08-SUMMARY.md` — Flow B nominate flow target for D-11

### Secondary (MEDIUM confidence)
- TMDB API docs (`/tv/{id}` response shape) — verified against existing parser at `js/app.js:6934-6989` which has been deployed and works in production. [CITED: themoviedb.org/documentation]
- Firestore map-key constraints — leading underscore + dots forbidden; commas allowed. [CITED: firebase.google.com/docs/firestore/manage-data/data-types]
- Firebase Functions v2 onSchedule — every-N-minutes syntax already in use at `queuenight/functions/index.js:642`. [VERIFIED: existing deployed CF]

### Tertiary (LOW confidence — flagged)
- TMDB time-of-day air-time precision — claim that TMDB does NOT expose time-of-day. [ASSUMED, based on parser at js/app.js:6934-6989 only consuming `air_date` — not verified against TMDB docs in this session. The planner should confirm before locking D-11 push copy.]
- Trakt scrobble timestamp drift for co-watch overlap (D-06). [ASSUMED based on general knowledge of Trakt; not verified in this research session. Window of "3 hours" is conservative; post-launch telemetry should refine.]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | TMDB does not expose episode time-of-day via `/tv/{id}` (only date) | Q6 — push-body copy | Push body has to drop "{at time}" precision. Mitigation: ship "{day}" copy in v1; refine post-launch if user objects. |
| A2 | Trakt scrobble timestamps for two co-watching family members are typically within 3 hours | Q10, D-06 — co-watch overlap window | Window may be too tight (false negatives → no prompt) or too loose (false positives → prompt fatigue). Mitigation: telemetry post-launch; configurable knob deferred to v2. |
| A3 | Watchparty rules permit creating a watchparty doc from a CF (admin SDK bypasses rules) | Q7 — D-08 auto-convert pattern | Verified — admin SDK bypasses rules per `firestore.rules` design comments, and `watchpartyTick` already creates watchparty docs at lines 743-757 today. No risk. |
| A4 | `t.tupleProgress` map field is accepted under the existing permissive title-doc rules | Q1, Q14 — schema choice | Verified by reading `firestore.rules:317-319` + comment block at 307-315 which explicitly permits new top-level fields under attributedWrite. No risk. |
| A5 | Per-individual `t.progress` will continue to coexist with new `t.tupleProgress` for v1 | foundational finding | This is a deliberate dual-shape choice matching 14-10's couchInTonight/couchSeating pattern. Risk: if the user wants immediate consolidation, the plan-phase needs to add an additional migration plan. Lock at /gsd-plan-phase 15. |
| A6 | TMDB API key in CF env is acceptable per project convention (TMDB key public-by-design) | Q5/Q17 — CF-side TMDB fetch | CLAUDE.md explicitly allows TMDB key client-side; the same posture extends to CF env. No risk. |
| A7 | The `~/queuenight` deploy-mirror has no `.git` on the development machine — same pattern as Phases 14-06/14-09/14-10 | deploy ordering | Verified by `find` showing only firestore.rules / functions/index.js / storage.rules. Plan-phase 15 should track queuenight commits as "Two-repo discipline" follow-up rows in STATE.md, matching the established cross-repo split pattern. |
| A8 | Couch `members` document IDs are alphanumeric (no commas, no leading dots) — safe for tupleKey encoding | Q2 — tuple key encoding | Verified by reading `firestore.rules:195-217` (member-create branches A/B/C all use Firestore-generated IDs from `doc()` or `joinAsNew`/`createSubProfile` admin-SDK paths, both of which produce safe IDs). No risk. |

If A1 or A2 are wrong, the impact is bounded to push-copy quality; A1 mitigation is shipping {day}-only copy (v1 acceptable); A2 mitigation is launching with a wider window and tightening post-launch.

---

## RESEARCH COMPLETE
