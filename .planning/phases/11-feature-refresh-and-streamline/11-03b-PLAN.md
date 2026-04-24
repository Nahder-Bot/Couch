---
phase: 11
plan: 03b
type: execute
wave: 2
depends_on: [11-03a]
files_modified:
  - js/constants.js
  - js/app.js
  - app.html
  - css/app.css
  - sw.js
autonomous: false
requirements: [REFR-04]
requirements_addressed: [REFR-04]
tags: [discovery, curated-lists, browse-all, personalization, pinning, refr-04-second-half]
commit_strategy: 3 atomic commits — (1) curated C-bucket rows + Bucket G personalization rows added to DISCOVERY_CATALOG + their loaders, (2) Browse-all sheet UI + pin-up-to-3 with localStorage persistence, (3) sw.js CACHE bump bundled with commit 2 final
must_haves:
  truths:
    - "DISCOVERY_CATALOG contains curated C-bucket rows (cult classics, award winners, festival favorites, director spotlights, documentaries) — at least 5 new entries that pickDailyRows can include in rotation"
    - "DISCOVERY_CATALOG contains personalization Bucket G rows (G1 from-your-want-list, G3 because-you-watched, G7 your-top-genres) — at least 3 new entries that activate when user has sufficient history"
    - "Browse-all sheet opens from a 'Browse all' link at bottom of Add tab; lists all rows organized by bucket; user can tap a row to preview + pin"
    - "Pinned rows always show in addition to daily rotation, capped at 3 pins to prevent screen overflow"
    - "Pin state persists in localStorage keyed on user-id (per-user, not per-family)"
    - "Personalization rows G1/G3/G7 gracefully degrade — render empty-state when state has insufficient history (cold-start users see no broken rows)"
    - "PWA cache bumped to couch-v25-11-03b-discovery-curated"
  artifacts:
    - path: "js/constants.js"
      provides: "DISCOVERY_CATALOG extended with 5+ curated C rows + 3+ personalization G rows + 8 themed-pack hooks for REFR-13 future-compat (commented placeholders only — actual REFR-13 ships in 11-07)"
      contains: "c2-cult-classics"
    - path: "js/app.js"
      provides: "Curated row loaders (group-yes-not-watched, group-recent-similar, group-top-genres) + Browse-all sheet + pin-rows-to-front logic + localStorage pin persistence"
      contains: "openBrowseAllSheet"
    - path: "app.html"
      provides: "Browse-all sheet modal (#browse-all-sheet-bg) + 'Browse all' link at bottom of Add tab + #pinned-rows container above #add-discovery-rows"
      contains: 'id="browse-all-sheet-bg"'
    - path: "css/app.css"
      provides: ".browse-all-sheet + .browse-all-bucket-group + .browse-all-row-tile + .pin-toggle + .pinned-row-pinned-badge styles"
      contains: ".browse-all-sheet"
    - path: "sw.js"
      provides: "CACHE bumped to couch-v25-11-03b-discovery-curated"
      contains: "couch-v25-11-03b"
  key_links:
    - from: "js/app.js renderAddDiscovery"
      to: "js/app.js renderPinnedRows"
      via: "pinned rows render BEFORE daily rotation in same #add-discovery-rows container OR a separate #pinned-rows container"
      pattern: "pinned"
    - from: "js/app.js openBrowseAllSheet"
      to: "app.html #browse-all-sheet-bg modal"
      via: "modal classList add/remove pattern"
      pattern: "browse-all-sheet"
    - from: "js/app.js togglePinRow"
      to: "browser localStorage couch-pinned-rows-{userId}"
      via: "localStorage.setItem with JSON-stringified pin id array, capped at 3"
      pattern: "couch-pinned-rows-"
---

<objective>
Close the second half of REFR-04: ship the curated lists, Browse-all sheet, pin-up-to-3 favorites, and personalization rows that 11-03a deferred. Curated lists need author judgement (cult classics, award winners, festival favorites, A24/Neon, documentaries that punch). Personalization rows leverage state.titles vote history (from-your-want-list, because-you-watched, your-top-genres). Browse-all gives users escape velocity from the daily rotation when they want to discover something specific.

Purpose: REFR-04 was split because curated content + personalization data plumbing + Browse-all UI is meaningfully more work than the engine + auto rows. Splitting kept Plan 11-03a in budget and lets 11-03b accumulate user history (G3 because-you-watched needs real production data to feel useful).

Output: Extended DISCOVERY_CATALOG with curated + personalized rows + Browse-all sheet + pin-up-to-3 + localStorage persistence. Closes REFR-04 fully.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/BRAND.md
@.planning/phases/11-feature-refresh-and-streamline/11-CONTEXT.md
@.planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md
@.planning/phases/11-feature-refresh-and-streamline/11-PATTERNS.md
@.planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md
@CLAUDE.md
@js/constants.js
@.planning/phases/11-feature-refresh-and-streamline/11-03a-SUMMARY.md

<interfaces>
<!-- Inherits from 11-03a — these MUST be present before this plan runs -->

From js/discovery-engine.js (shipped 11-03a):
```javascript
export function pickDailyRows(userId, dateKey, catalog);
export function isInSeasonalWindow(date, win);
```

From js/constants.js (shipped 11-03a):
```javascript
export const DISCOVERY_CATALOG = [...];  // 25 rows; this plan EXTENDS it
```

From js/app.js (shipped 11-03a):
```javascript
function renderAddDiscovery();  // populates #add-discovery-rows
async function loadDiscoveryRow(row);  // per-row TMDB or group-data loader
```

From app.html (shipped 11-03a):
```html
<div id="add-mood-section">...</div>
<div id="add-discovery-rows"></div>  <!-- this plan ADDS #pinned-rows above -->
```

From css/app.css (shipped 11-03a):
- .discover-row-eyebrow + .discover-row-subtitle — reuse for curated + personalized + pinned rows

From js/utils.js — escapeHtml, haptic, flashToast (use these for all new UI feedback)
From js/state.js — state.titles array shape (votes per member, year, genres) — use for personalization
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Extend DISCOVERY_CATALOG with curated C rows + personalization G rows + their loaders</name>
  <files>js/constants.js, js/app.js</files>
  <read_first>
    - js/constants.js (current DISCOVERY_CATALOG from 11-03a — append, do not replace)
    - js/app.js loadDiscoveryRow at the location 11-03a placed it (likely near :8980-9080) — extend the switch on src.type to handle new types
    - js/app.js Grep for `state.titles` to understand vote shape — confirm fields like t.votes, t.genres, t.year, t.runtime are queryable
    - js/app.js Grep for `mapTmdbItem` to confirm existing TMDB-result mapping helper exists
    - .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §"Bucket C" lines 53-65 (curated rows: C2 cult, C4 awards, C5 festivals, C6 director, C8 docs)
    - .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §"Bucket G" lines 116-125 (personalization rows G1, G3, G5, G7)
    - .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Copywriting Contract REFR-04 (lines 343-352 — copy for new rows)
  </read_first>
  <behavior>
    - DISCOVERY_CATALOG gets at least 5 new curated C rows (C2 cult-classics, C4 award-winners, C5 festival-favorites, C6 director-spotlight, C8 documentaries-that-punch) using TMDB-discover with curated keyword/list IDs OR a hardcoded "approved-tmdb-id-list" source type
    - DISCOVERY_CATALOG gets at least 3 personalization G rows (G1 from-your-want-list, G3 because-you-watched, G7 your-top-genres) with source type 'group-want-list' / 'group-similar-to-recent' / 'group-top-genre-discover'
    - loadDiscoveryRow extended to handle these new source types — each personalization loader reads state.titles for the data slice and either falls back to empty (cold-start) or fetches TMDB-similar from a recent watched title
    - pickDailyRows logic NOT changed — engine already picks "any C row" and "any G row"; new entries automatically eligible
  </behavior>
  <action>
    **Part A — js/constants.js DISCOVERY_CATALOG extension:** Append new entries to the existing array. Use copy from UI-SPEC §Copywriting Contract REFR-04. Do NOT touch existing 25 entries.

    Curated C rows (planner uses TMDB-discover with documented keyword IDs OR a manually curated TMDB-id list):
    ```javascript
    // Curated C rows — added in Plan 11-03b
    { id: 'c2-cult-classics', bucket: 'C', label: 'Cult classics', subtitle: 'The midnight-screening canon',
      source: { type: 'tmdb-curated-list', tmdbIds: [/* 20-30 IDs of cult films — planner curates from a known canon list */] } },
    { id: 'c4-award-winners', bucket: 'C', label: 'Award winners', subtitle: 'Best Picture, Globes, BAFTA',
      source: { type: 'tmdb-discover', params: { 'with_keywords': '209714', 'vote_average.gte': 7.5 } } },
    { id: 'c5-festival-favorites', bucket: 'C', label: 'Festival favorites', subtitle: 'Cannes, Sundance, TIFF, Venice',
      source: { type: 'tmdb-curated-list', tmdbIds: [/* 20-30 IDs of festival award winners — planner curates */] } },
    { id: 'c6-director-spotlight', bucket: 'C', label: 'Director spotlight', subtitle: 'A focus on one filmmaker',
      source: { type: 'tmdb-director-rotating', directors: [/* TMDB person IDs for: Wes Anderson, Bong Joon-ho, Greta Gerwig, Denis Villeneuve, Chloé Zhao, Lulu Wang, Christopher Nolan, etc. */] } },
    { id: 'c8-docs-that-punch', bucket: 'C', label: 'Documentaries that punch', subtitle: 'Non-fiction with a heartbeat',
      source: { type: 'tmdb-discover', params: { 'with_genres': '99', 'vote_average.gte': 7.5, 'vote_count.gte': 200 } } },
    ```

    Personalization G rows (3 minimum):
    ```javascript
    // Bucket G — Personalization (only fire when user has sufficient state)
    { id: 'g1-want-list', bucket: 'G', label: 'From your Want list', subtitle: 'Voted Yes, never picked',
      source: { type: 'group-want-list' } },
    { id: 'g3-because-you-watched', bucket: 'G', label: 'Because you watched', subtitle: 'Similar films, similar night',
      source: { type: 'group-similar-to-recent' } },
    { id: 'g7-top-genres', bucket: 'G', label: 'Your top genres revisited', subtitle: 'What your couch keeps coming back to',
      source: { type: 'group-top-genre-discover' } },
    ```

    For C2 cult-classics + C5 festival-favorites tmdbIds arrays: planner curates 20-30 well-known IDs from canonical lists. Examples for cult: Donnie Darko (564), The Big Lebowski (115), Eternal Sunshine of the Spotless Mind (38), Pulp Fiction (680), etc. For festival: Parasite (496243), Anatomy of a Fall (915935), Drive My Car (758323), Roma (426426), etc. Verify each ID exists on TMDB before commit (`curl https://api.themoviedb.org/3/movie/{id}?api_key=...`).

    For C6 director-spotlight directors array: list TMDB person IDs (Wes Anderson 5655, Bong Joon-ho 21684, Greta Gerwig 45400, Denis Villeneuve 137427). Loader picks one director deterministically from the list using current date as seed (already-deterministic per-day per-row id).

    **Part B — js/app.js loadDiscoveryRow extension:** Extend the source.type switch to handle 4 new types. Locate loadDiscoveryRow function (placed by 11-03a) and add new branches:

    ```javascript
    } else if (src.type === 'tmdb-curated-list') {
      // Fetch each TMDB-id from the curated list. To stay under rate limit:
      // - Cache the full list result for 7 days (curated lists don't change daily)
      // - Use Promise.all but cap parallelism via batching
      const ids = src.tmdbIds || [];
      const sample = ids.slice(0, 20);  // cap to top-20 to stay reasonable
      const fetches = sample.map(id => tmdbFetch(`/movie/${id}`).catch(() => null));
      const results = await Promise.all(fetches);
      items = results.filter(x => x && x.poster_path).map(x => mapTmdbItem({ ...x, media_type: 'movie' }));
    } else if (src.type === 'tmdb-director-rotating') {
      // Pick one director deterministically per (rowId, dateKey) — use isolated mulberry seed
      const directors = src.directors || [];
      if (!directors.length) { items = []; }
      else {
        const seedFn = xmur3(`${row.id}-${todayKey()}`);
        const idx = seedFn() % directors.length;
        const personId = directors[idx];
        const d = await tmdbFetch(`/discover/movie?with_people=${personId}&sort_by=vote_average.desc&vote_count.gte=100`);
        items = (d.results || []).filter(x => x.poster_path).slice(0, 20).map(x => mapTmdbItem({ ...x, media_type: 'movie' }));
      }
    } else if (src.type === 'group-want-list') {
      // Titles where the current user voted Yes but title was never picked (no spinnerPickedAt or watched flag)
      const myId = state.me && state.me.id;
      if (!myId) { items = []; }
      else {
        items = (state.titles || []).filter(t => {
          const myVote = (t.votes && t.votes[myId]) || (t.votes && t.votes[`m_${myId}`]);
          return myVote === 'yes' && !t.watched && !t.lastPickedAt;
        }).slice(0, 20).map(t => ({
          id: t.id, name: t.name, year: t.year, kind: t.kind,
          poster: t.poster || (t.tmdbId ? `https://image.tmdb.org/t/p/w300/${t.posterPath}` : '')
        }));
      }
    } else if (src.type === 'group-similar-to-recent') {
      // Find the most recently-watched title (max watchedAt or pickedAt) and fetch TMDB similar
      const recent = (state.titles || []).filter(t => t.watched && t.tmdbId).sort((a,b) => (b.watchedAt||0) - (a.watchedAt||0))[0];
      if (!recent || !recent.tmdbId) { items = []; }
      else {
        const d = await tmdbFetch(`/movie/${recent.tmdbId}/similar`);
        items = (d.results || []).filter(x => x.poster_path).slice(0, 20).map(x => mapTmdbItem({ ...x, media_type: 'movie' }));
        // Update row label dynamically to "Because you watched [TitleName]"
        const eyebrowEl = document.querySelector(`#add-row-${row.id}`).closest('.add-section').querySelector('.discover-row-eyebrow');
        if (eyebrowEl) eyebrowEl.textContent = `Because you watched ${recent.name}`.toUpperCase();
      }
    } else if (src.type === 'group-top-genre-discover') {
      // Aggregate genres across all titles with any Yes vote, pick top 1-2 genre IDs, query TMDB discover
      const genreCount = {};
      (state.titles || []).forEach(t => {
        const hasYes = t.votes && Object.values(t.votes).some(v => v === 'yes');
        if (!hasYes || !t.genres) return;
        t.genres.forEach(g => { genreCount[g] = (genreCount[g] || 0) + 1; });
      });
      const topGenres = Object.entries(genreCount).sort((a,b) => b[1]-a[1]).slice(0,2).map(e => e[0]);
      if (!topGenres.length) { items = []; }
      else {
        const d = await tmdbFetch(`/discover/movie?with_genres=${topGenres.join(',')}&sort_by=popularity.desc&vote_average.gte=6.5`);
        items = (d.results || []).filter(x => x.poster_path).slice(0, 20).map(x => mapTmdbItem({ ...x, media_type: 'movie' }));
      }
    ```

    For all new G/curated branches: empty `items` array gracefully degrades to per-row empty state ("Nothing new here today — check back tomorrow." — already wired by 11-03a).

    Per D-XX from CONTEXT.md (REFR-04 second half — curated + personalization + Browse-all + pinning).
  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" &amp;&amp; grep -c "c2-cult-classics" js/constants.js &amp;&amp; grep -c "c4-award-winners" js/constants.js &amp;&amp; grep -c "c5-festival-favorites" js/constants.js &amp;&amp; grep -c "c6-director-spotlight" js/constants.js &amp;&amp; grep -c "c8-docs-that-punch" js/constants.js &amp;&amp; grep -c "g1-want-list" js/constants.js &amp;&amp; grep -c "g3-because-you-watched" js/constants.js &amp;&amp; grep -c "g7-top-genres" js/constants.js &amp;&amp; grep -c "tmdb-curated-list" js/app.js &amp;&amp; grep -c "tmdb-director-rotating" js/app.js &amp;&amp; grep -c "group-want-list" js/app.js &amp;&amp; grep -c "group-similar-to-recent" js/app.js &amp;&amp; grep -c "group-top-genre-discover" js/app.js &amp;&amp; node --check js/app.js &amp;&amp; node --check js/constants.js &amp;&amp; node --test js/discovery-engine.test.js</automated>
  </verify>
  <acceptance_criteria>
    - All 5 curated C row IDs present in js/constants.js: c2-cult-classics, c4-award-winners, c5-festival-favorites, c6-director-spotlight, c8-docs-that-punch each return >= 1
    - All 3 G personalization row IDs present: g1-want-list, g3-because-you-watched, g7-top-genres each return >= 1
    - All 5 new source types handled in loadDiscoveryRow: tmdb-curated-list, tmdb-director-rotating, group-want-list, group-similar-to-recent, group-top-genre-discover each return >= 1 in js/app.js
    - 11-03a tests STILL PASS (regression check) — `node --test js/discovery-engine.test.js` 10/10 PASS (the engine is unchanged; only catalog grew)
    - C2 + C5 tmdbIds arrays populated with at least 15 IDs each (count integer literals inside the arrays)
    - C6 directors array populated with at least 4 person IDs
    - `node --check js/app.js` exits 0
    - `node --check js/constants.js` exits 0
  </acceptance_criteria>
  <done>
    Catalog grew from 25 rows to ~33 rows (+5 curated C, +3 personalization G). Loaders handle 5 new source types. Cold-start gracefully degrades. 1 atomic commit: `feat(11-03b): extend DISCOVERY_CATALOG with curated + personalization rows + their loaders (REFR-04 curated half)`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Browse-all sheet + pin-up-to-3 favorites with localStorage persistence</name>
  <files>app.html, js/app.js, css/app.css</files>
  <read_first>
    - app.html — find existing modal pattern (e.g. `#wp-start-modal-bg` or `#sports-picker-bg`) for style consistency
    - js/app.js Grep for `classList.add\(['"]on['"]\)` to find existing modal open/close pattern
    - js/app.js renderAddDiscovery (placed by 11-03a) — extend to render pinned rows ABOVE rotation rows
    - js/app.js Grep for `localStorage.setItem` to see existing localStorage usage (if any) and pattern
    - .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §"More categories affordance" (lines 156-159 — Browse-all + pin-cap-at-3)
    - .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Layout Contract Add tab (line 539)
    - .planning/BRAND.md §4 (radius + shadow tokens)
    - css/app.css existing `.modal-bg` + `.modal` rules
  </read_first>
  <behavior>
    - Bottom of Add tab discovery section gets a "Browse all" link/button
    - Tapping opens a full-width modal (Browse-all sheet) listing ALL DISCOVERY_CATALOG entries grouped by bucket (Always-on / Trending / Discovery / Use-case / Theme of the day / Seasonal / Personalization)
    - Each row tile shows label + subtitle + pin toggle (heart or pin icon)
    - User can pin up to 3 rows; over-pin attempts show toast "You can pin up to 3 rows."
    - Pinned rows always render at the top of #pinned-rows container above #add-discovery-rows
    - Pin state persists in localStorage at key `couch-pinned-rows-{userId}` as JSON array of row IDs
    - Pin toggle has hover/tap feedback; sw.js cache bumped
  </behavior>
  <action>
    **Part A — HTML (app.html):**

    1. Add a Browse-all link at the bottom of #add-discovery-rows. Strategy: don't put it inside #add-discovery-rows (which is dynamically replaced). Put it in a sibling `<div>` immediately after:
    ```html
    <div id="add-discovery-rows"></div>
    <div id="add-browse-all-trigger" class="add-browse-all-trigger">
      <button class="add-browse-all-btn" onclick="openBrowseAllSheet()">Browse all rows</button>
    </div>
    ```

    2. Add a #pinned-rows container immediately ABOVE #add-discovery-rows (so pinned rows render first):
    ```html
    <div id="pinned-rows"></div>
    <div id="add-discovery-rows"></div>
    ```

    3. Add the Browse-all sheet modal at the bottom of app.html, near other modals:
    ```html
    <div class="modal-bg" id="browse-all-sheet-bg" onclick="if(event.target.id==='browse-all-sheet-bg')closeBrowseAllSheet()">
      <div class="modal browse-all-sheet">
        <h3 class="modal-h2">Browse all rows</h3>
        <div class="meta modal-meta-sub"><em>Pin up to 3 to keep them at the top.</em></div>
        <div id="browse-all-content"></div>
        <div class="modal-actions-row">
          <button class="pill" onclick="closeBrowseAllSheet()">Close</button>
        </div>
      </div>
    </div>
    ```

    **Part B — js/app.js:**

    ```javascript
    // ---- Phase 11 / REFR-04 second half — Browse-all sheet + pinning ----

    const PIN_CAP = 3;

    function pinStorageKey() {
      const uid = (state.me && state.me.id) || 'anon';
      return `couch-pinned-rows-${uid}`;
    }

    function getPinnedRowIds() {
      try {
        const raw = localStorage.getItem(pinStorageKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.slice(0, PIN_CAP) : [];
      } catch(e) { return []; }
    }

    function setPinnedRowIds(ids) {
      try { localStorage.setItem(pinStorageKey(), JSON.stringify(ids.slice(0, PIN_CAP))); }
      catch(e) { /* localStorage full or unavailable — silent */ }
    }

    window.togglePinRow = function(rowId) {
      const pinned = getPinnedRowIds();
      const idx = pinned.indexOf(rowId);
      if (idx >= 0) {
        pinned.splice(idx, 1);
        setPinnedRowIds(pinned);
        haptic('light');
        flashToast('Unpinned', { kind: 'info' });
      } else {
        if (pinned.length >= PIN_CAP) {
          haptic('warn');
          flashToast(`You can pin up to ${PIN_CAP} rows.`, { kind: 'warn' });
          return;
        }
        pinned.push(rowId);
        setPinnedRowIds(pinned);
        haptic('success');
        flashToast('Pinned', { kind: 'success' });
      }
      renderBrowseAllSheet();  // re-render sheet to update toggle state
      renderPinnedRows();      // re-render pinned strip on Add tab
    };

    function renderPinnedRows() {
      const container = document.getElementById('pinned-rows');
      if (!container) return;
      const pinnedIds = getPinnedRowIds();
      if (!pinnedIds.length) { container.innerHTML = ''; return; }
      const pinnedRows = pinnedIds
        .map(id => DISCOVERY_CATALOG.find(r => r.id === id))
        .filter(Boolean);
      container.innerHTML = pinnedRows.map(row => `
        <div class="add-section pinned-section">
          <div class="discover-row-eyebrow">PINNED &middot; ${escapeHtml(row.label)}</div>
          <div class="discover-row-subtitle"><em>${escapeHtml(row.subtitle)}</em></div>
          <div class="discover-row-wrap">
            <button class="discover-scroll-btn left" aria-label="Scroll left" onclick="scrollAddRow('${row.id}',-1)">&#9666;</button>
            <div class="discover-row" id="add-row-${row.id}"><div class="sk-row-posters" aria-hidden="true"><div class="sk-poster"></div><div class="sk-poster"></div><div class="sk-poster"></div></div></div>
            <button class="discover-scroll-btn right" aria-label="Scroll right" onclick="scrollAddRow('${row.id}',1)">&#9656;</button>
          </div>
        </div>
      `).join('');
      // Trigger loaders for pinned rows
      pinnedRows.forEach((row, idx) => {
        setTimeout(() => loadDiscoveryRow(row), idx * 200);
      });
    }

    window.openBrowseAllSheet = function() {
      const bg = document.getElementById('browse-all-sheet-bg');
      if (!bg) return;
      bg.classList.add('on');
      renderBrowseAllSheet();
    };

    window.closeBrowseAllSheet = function() {
      const bg = document.getElementById('browse-all-sheet-bg');
      if (bg) bg.classList.remove('on');
    };

    function renderBrowseAllSheet() {
      const el = document.getElementById('browse-all-content');
      if (!el) return;
      const pinned = new Set(getPinnedRowIds());
      const buckets = [
        { key: 'A', label: 'Always-on' },
        { key: 'B', label: 'Trending' },
        { key: 'C', label: 'Discovery' },
        { key: 'D', label: 'Use-case' },
        { key: 'E', label: 'Theme of the day' },
        { key: 'F', label: 'Seasonal' },
        { key: 'G', label: 'Personalization' }
      ];
      el.innerHTML = buckets.map(b => {
        const rows = DISCOVERY_CATALOG.filter(r => r.bucket === b.key);
        if (!rows.length) return '';
        return `<div class="browse-all-bucket-group">
          <h4 class="browse-all-bucket-h">${escapeHtml(b.label)}</h4>
          ${rows.map(row => {
            const isPinned = pinned.has(row.id);
            return `<div class="browse-all-row-tile">
              <div class="browse-all-row-text">
                <div class="browse-all-row-label">${escapeHtml(row.label)}</div>
                <div class="browse-all-row-subtitle"><em>${escapeHtml(row.subtitle)}</em></div>
              </div>
              <button class="pin-toggle ${isPinned?'pinned':''}" onclick="togglePinRow('${row.id}')" aria-pressed="${isPinned}" aria-label="${isPinned?'Unpin':'Pin'} ${escapeHtml(row.label)}">
                ${isPinned ? '&#9733;' : '&#9734;'}
              </button>
            </div>`;
          }).join('')}
        </div>`;
      }).join('');
    }
    ```

    Wire `renderPinnedRows()` into the Add tab orchestration so it fires alongside `renderAddDiscovery()`. Strategy: find where renderAddDiscovery is called (Task 4 of 11-03a wired it). Add `renderPinnedRows();` immediately before that call.

    **Part C — css/app.css:** Add styles using only semantic tokens:
    ```css
    /* Phase 11 / REFR-04 second half — Browse-all sheet + pinning */
    .add-browse-all-trigger{margin:var(--s5) 0 var(--s7);text-align:center}
    .add-browse-all-btn{padding:var(--s2) var(--s5);background:var(--surface-2);
      border:1px solid var(--border);border-radius:var(--r-pill);
      color:var(--ink-warm);font-family:var(--font-sans);font-weight:600;
      font-size:var(--t-meta);cursor:pointer;min-height:44px;
      transition:border-color var(--duration-fast) var(--easing-standard)}
    .add-browse-all-btn:hover{border-color:var(--accent);color:var(--ink)}
    .browse-all-sheet{max-width:540px;max-height:80vh;overflow-y:auto}
    .browse-all-bucket-group{margin-bottom:var(--s5)}
    .browse-all-bucket-h{font-family:var(--font-sans);font-size:var(--t-eyebrow);
      color:var(--ink-dim);letter-spacing:0.12em;text-transform:uppercase;
      font-weight:600;margin-bottom:var(--s2)}
    .browse-all-row-tile{display:flex;align-items:center;justify-content:space-between;
      gap:var(--s3);padding:var(--s3) 0;border-bottom:1px solid var(--border)}
    .browse-all-row-tile:last-child{border-bottom:none}
    .browse-all-row-text{flex:1;min-width:0}
    .browse-all-row-label{font-family:var(--font-sans);font-size:var(--t-body);
      font-weight:600;color:var(--ink)}
    .browse-all-row-subtitle{font-family:var(--font-serif);font-style:italic;
      font-size:var(--t-meta);color:var(--ink-warm);margin-top:2px}
    .pin-toggle{flex-shrink:0;width:44px;height:44px;border:1px solid var(--border);
      background:transparent;border-radius:50%;color:var(--ink-dim);
      font-size:20px;cursor:pointer;display:grid;place-items:center;
      transition:all var(--duration-fast) var(--easing-standard)}
    .pin-toggle:hover{border-color:var(--accent);color:var(--ink)}
    .pin-toggle.pinned{background:var(--accent);color:var(--bg);border-color:transparent}
    .pinned-section .discover-row-eyebrow{color:var(--accent)}
    ```

    **Part D — sw.js CACHE bump:** Update line 8 from current value (couch-v24-11-03a-discovery-engine after 11-03a) to `'couch-v25-11-03b-discovery-curated'`.

    Per D-XX from CONTEXT.md (REFR-04 second half — Browse-all + pinning).
  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" &amp;&amp; grep -c 'id="browse-all-sheet-bg"' app.html &amp;&amp; grep -c 'id="pinned-rows"' app.html &amp;&amp; grep -c 'id="add-browse-all-trigger"' app.html &amp;&amp; grep -c "openBrowseAllSheet" js/app.js &amp;&amp; grep -c "closeBrowseAllSheet" js/app.js &amp;&amp; grep -c "togglePinRow" js/app.js &amp;&amp; grep -c "renderPinnedRows" js/app.js &amp;&amp; grep -c "couch-pinned-rows-" js/app.js &amp;&amp; grep -c "PIN_CAP = 3" js/app.js &amp;&amp; grep -c ".browse-all-sheet" css/app.css &amp;&amp; grep -c ".pin-toggle" css/app.css &amp;&amp; grep -c "couch-v25-11-03b-discovery-curated" sw.js &amp;&amp; node --check js/app.js &amp;&amp; node --check sw.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'id="browse-all-sheet-bg"' app.html` returns 1
    - `grep -c 'id="pinned-rows"' app.html` returns 1
    - `grep -c 'id="add-browse-all-trigger"' app.html` returns 1
    - `grep -c "function openBrowseAllSheet\|window.openBrowseAllSheet" js/app.js` returns >= 1
    - `grep -c "function closeBrowseAllSheet\|window.closeBrowseAllSheet" js/app.js` returns >= 1
    - `grep -c "togglePinRow" js/app.js` returns >= 2 (definition + onclick reference)
    - `grep -c "function renderPinnedRows" js/app.js` returns >= 1
    - `grep -c "renderPinnedRows()" js/app.js` returns >= 2 (call sites — orchestration + togglePinRow re-render)
    - `grep -c "couch-pinned-rows-" js/app.js` returns >= 1 (localStorage key)
    - `grep -c "PIN_CAP = 3\|PIN_CAP=3" js/app.js` returns >= 1
    - `grep -c ".browse-all-sheet" css/app.css` returns >= 1
    - `grep -c ".pin-toggle" css/app.css` returns >= 2 (.pin-toggle + .pin-toggle.pinned)
    - `grep -c "couch-v25-11-03b-discovery-curated" sw.js` returns 1
    - NO raw px in new CSS (verify by inspecting added .browse-all-* and .pin-toggle rules — must use --s* and --r-* tokens; small exception: `width:44px;height:44px` for the toggle is acceptable as it matches existing 44px touch-target convention used in BRAND.md and css/app.css elsewhere)
    - `node --check js/app.js` exits 0
    - `node --check sw.js` exits 0
  </acceptance_criteria>
  <done>
    Browse-all sheet opens from Add tab; lists all rows by bucket; pin toggle works; cap at 3 enforced with toast feedback; pinned rows render at top of Add tab; localStorage persists pins per-user. 1 atomic commit: `feat(11-03b): browse-all sheet + pin-up-to-3 favorites + bump sw.js CACHE (REFR-04)`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Human-verify curated rows + Browse-all + pinning</name>
  <what-built>
    DISCOVERY_CATALOG extended with 5+ curated C rows + 3+ personalization G rows + 5 new source-type loaders + Browse-all sheet + pin-up-to-3 with localStorage persistence + sw.js cache bump. Total: 2 atomic commits, 4 files modified.
  </what-built>
  <how-to-verify>
    Open http://localhost:5500/app or deploy to a Firebase preview channel.

    **Catalog extension (DevTools console):**
    1. Run `DISCOVERY_CATALOG.length` — should be >= 33 (was 25 after 11-03a).
    2. Run `DISCOVERY_CATALOG.filter(r => r.bucket === 'C').map(r => r.id)` — should include c1, c3, c7, c9 (from 11-03a) PLUS c2-cult-classics, c4-award-winners, c5-festival-favorites, c6-director-spotlight, c8-docs-that-punch.
    3. Run `DISCOVERY_CATALOG.filter(r => r.bucket === 'G').map(r => r.id)` — should include g1-want-list, g3-because-you-watched, g7-top-genres.

    **Add tab visible behavior:**
    4. Open Add tab. Confirm 7-10 discovery rows still render (mix of A/B/C/D/E/F + possibly G).
    5. Scroll to bottom of discovery rows: confirm "Browse all rows" pill button visible.
    6. Tap "Browse all rows": modal opens, lists ALL ~33 rows grouped by bucket headings (Always-on / Trending / Discovery / Use-case / Theme of the day / Seasonal / Personalization).

    **Pinning:**
    7. In Browse-all modal, tap the pin (star) toggle on row "Hidden gems" (c1-hidden-gems). Confirm:
       - Star fills with accent color
       - Toast "Pinned" appears
       - Haptic fires (on mobile)
    8. Pin 2 more rows. Total 3 pinned.
    9. Try to pin a 4th: confirm toast "You can pin up to 3 rows." appears + 4th does NOT pin.
    10. Close the modal. Confirm at top of Add tab (above the daily rotation), 3 "PINNED · [Label]" sections appear with the pinned rows + their TMDB content.
    11. Refresh the page. Pinned rows persist (localStorage).
    12. Open DevTools → Application → Local Storage → confirm key `couch-pinned-rows-{your-uid}` contains a JSON array of 3 row IDs.
    13. Open Browse-all again, unpin one. Confirm:
        - Star empties
        - Toast "Unpinned" appears
        - Pinned section count drops to 2 on Add tab

    **Personalization rows:**
    14. If you have a Yes-vote on any title that's never been picked: g1-want-list row should populate when it's in rotation (might require a few day-rotation iterations to surface — pin it via Browse-all to test immediately).
    15. If you have a recently-watched title (`watched: true`): g3-because-you-watched should show "Because you watched [TitleName]" eyebrow when active.
    16. Cold-start (no Yes votes): pin g1 row → confirm it shows empty state "Nothing new here today — check back tomorrow." instead of crashing.

    **PWA cache:**
    17. DevTools → Application → Service Workers → version `couch-v25-11-03b-discovery-curated`.

    **Regression:**
    18. `node --test js/discovery-engine.test.js` — 10/10 still pass.
    19. Mood section + existing daily rotation still works.

    Type "approved" if all 19 checks pass; describe failures otherwise.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to address before deploy</resume-signal>
</task>

</tasks>

<threat_model>
This plan adds NO new auth surface but DOES add localStorage write (pin state) — a new client-side persistence boundary.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-03b-01 | Information Disclosure | localStorage pin keys leak family/user identity if device is shared | accept | Pin state contains only row IDs (not titles, not preferences). Worst case: another household member sees that "your top genres" row was pinned. Pin key uses state.me.id which is family-internal, not Google UID. No PII. |
| T-11-03b-02 | Tampering | User edits localStorage to set 100 pinned rows | mitigate | All read paths (`getPinnedRowIds`, `renderPinnedRows`) cap to PIN_CAP=3 via `.slice(0, PIN_CAP)`. Tampered state degrades gracefully — only first 3 render; setter re-caps on next pin/unpin action. |
| T-11-03b-03 | Denial of Service | TMDB rate-limit exhaustion if user pins all 3 rows + daily rotation also fetches | mitigate | Pinned-row loaders are also staggered (200ms each). Total cold-load ≈ 3 pinned + 7-10 rotation = 10-13 fetches over ~2.5s. Per-row cache prevents re-fetch within ADD_CACHE_TTL. Below 40req/10s TMDB budget. |
| T-11-03b-04 | Information Disclosure | g3-because-you-watched eyebrow reveals "Because you watched [Title]" — could be sensitive in shared-screen contexts | accept | Title is already visible elsewhere in the user's library; no new disclosure surface. User can unpin/hide via Browse-all if they choose. |
</threat_model>

<verification>
1. `node --test js/discovery-engine.test.js` 10/10 PASS (regression)
2. `node --check js/app.js`, `node --check js/constants.js`, `node --check sw.js` all exit 0
3. DISCOVERY_CATALOG.length >= 33
4. Browse-all modal opens + closes; all ~33 rows listed grouped by bucket
5. Pinning works (cap-at-3 enforced); persists across refresh in localStorage
6. Pinned rows render at top of Add tab
7. Personalization rows degrade gracefully on cold-start (empty state, no crash)
8. PWA SW version registered as couch-v25-11-03b-discovery-curated
</verification>

<success_criteria>
- 2 atomic commits land
- 5+ curated C rows + 3+ personalization G rows added
- 5 new source-type loaders functional (tmdb-curated-list, tmdb-director-rotating, group-want-list, group-similar-to-recent, group-top-genre-discover)
- Browse-all sheet UI functional + accessible (44px touch targets on pin toggle)
- Pin-up-to-3 enforced with toast + haptic
- localStorage persistence per-user
- sw.js CACHE bumped to v25
- REFR-04 fully closes (both halves done after 11-03a + 11-03b)
- Zero regressions on 11-03a engine tests
</success_criteria>

<output>
After completion, create `.planning/phases/11-feature-refresh-and-streamline/11-03b-SUMMARY.md` documenting:
- 2 commit SHAs + brief description each
- Confirmed REFR-04 full closure
- DISCOVERY_CATALOG growth (25 → 33+ rows)
- Curated content list (which TMDB IDs were chosen for c2-cult / c5-festival)
- Director rotation list for c6
- Pin localStorage key format documented
- sw.js CACHE bump (v24 → v25-11-03b-discovery-curated)
- Verification matrix from human-verify checkpoint
- Note: REFR-13 themed packs (Plan 11-07) will use same DISCOVERY_CATALOG entry pattern (themed packs as a pseudo-bucket); pin infrastructure ready for reuse there
</output>
