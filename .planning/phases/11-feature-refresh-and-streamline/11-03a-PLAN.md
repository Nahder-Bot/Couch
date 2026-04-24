---
phase: 11
plan: 03a
type: execute
wave: 2
depends_on: []
files_modified:
  - js/app.js
  - app.html
  - css/app.css
  - sw.js
  - js/constants.js
  - js/discovery-engine.js
  - js/discovery-engine.test.js
autonomous: false
requirements: [REFR-04]
requirements_addressed: [REFR-04]
tags: [discovery, rotation, hash-seeded, tmdb, add-tab, auto-rows, day-of-week, seasonal, tdd]
commit_strategy: 4 atomic commits — (1a) RED tests for discovery engine, (1b) GREEN xmur3/mulberry32/pickDailyRows + 25-row catalog, (2) wire 7-10 dynamic discovery rows into Add tab, (3) eyebrow + subtitle CSS + sw.js CACHE bump
must_haves:
  truths:
    - "Add tab renders 7-10 discovery rows per visit (vs current 4)"
    - "Same user opening Add tab twice on the same day sees the SAME 7-10 rows (deterministic per-user-per-day rotation)"
    - "Two different users opening Add tab on the same day see DIFFERENT row selections"
    - "Same user opening Add tab on day N+1 sees a DIFFERENT row selection"
    - "Day-of-week theme row appears (e.g. Throwback Thursday on Thu, Foreign Friday on Fri)"
    - "Seasonal injection fires when current date is inside an active window (Halloween Oct, Holiday Dec, Valentine Feb, Awards Jan-Mar, Summer Jun-Aug)"
    - "TMDB request budget honored — staggered fetches; per-row cache prevents re-fetch within ADD_CACHE_TTL"
    - "Empty rows show italic 'Nothing new here today — check back tomorrow.' fallback"
    - "PWA cache bumped to couch-v24-11-03a-discovery-engine"
  artifacts:
    - path: "js/constants.js"
      provides: "DISCOVERY_CATALOG export — 25-row catalog covering Buckets A/B/C-auto/D/E/F"
      contains: "DISCOVERY_CATALOG"
    - path: "js/discovery-engine.js"
      provides: "xmur3 + mulberry32 PRNGs + pickDailyRows + isInSeasonalWindow"
      exports: ["xmur3", "mulberry32", "pickDailyRows", "isInSeasonalWindow"]
    - path: "js/discovery-engine.test.js"
      provides: "Node test runner unit tests for engine determinism + composition rules"
      contains: "node:test"
    - path: "js/app.js"
      provides: "Imports + renderAddDiscovery + loadDiscoveryRow + Add-tab orchestration wiring"
      contains: "renderAddDiscovery"
    - path: "app.html"
      provides: "#add-discovery-rows container replacing 4 hardcoded discovery sections"
      contains: 'id="add-discovery-rows"'
    - path: "css/app.css"
      provides: ".discover-row-eyebrow + .discover-row-subtitle + .discover-row-eyebrow.seasonal"
      contains: ".discover-row-eyebrow"
    - path: "sw.js"
      provides: "CACHE bumped to couch-v24-11-03a-discovery-engine"
      contains: "couch-v24-11-03a"
  key_links:
    - from: "js/constants.js DISCOVERY_CATALOG"
      to: "js/discovery-engine.js pickDailyRows"
      via: "passed as third argument to pickDailyRows(userId, dateKey, catalog)"
      pattern: "DISCOVERY_CATALOG"
    - from: "js/app.js renderAddDiscovery"
      to: "app.html #add-discovery-rows container"
      via: "innerHTML emission of N discovery row blocks"
      pattern: "add-discovery-rows"
    - from: "js/app.js loadDiscoveryRow"
      to: "TMDB API via tmdbFetch helper"
      via: "fetch + addTabCache._discovery cache layer keyed on (rowId, dateKey, userId)"
      pattern: "tmdbFetch"
---

<objective>
Build the daily-rotation engine + 7-10 auto-derived discovery rows that close the first half of REFR-04. Today the Add tab shows 4 fixed rows. Post-plan it shows 7-10 rows per day, hash-seeded per (user, date) so each user sees a stable-within-day rotation. Includes day-of-week themed row and date-window seasonal injection.

Purpose: Make the Add tab feel alive. Daily revisit incentive ("what's new today?"). Same engine in 11-03b plugs in curated lists + Browse-all + personalization.

Output: Discovery engine + 7-10 visible rows + day-of-week theme + seasonal injection + per-row eyebrow + subtitle + cache layer + sw.js bump. Curated lists, Browse-all sheet, pinning, personalization rows ship in 11-03b.
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

<interfaces>
From js/app.js:9001-9007 (TMDB helper):
```javascript
async function tmdbFetch(url) {
  const sep = url.includes('?') ? '&' : '?';
  const full = `https://api.themoviedb.org/3${url}${sep}api_key=${TMDB_KEY}`;
  const r = await fetch(full);
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}
```

From js/app.js:9009-9084 (loadTrendingRow analog):
```javascript
async function loadTrendingRow() {
  if (addTabCache.trending && Date.now() - addTabCache.trending.ts < ADD_CACHE_TTL) {
    renderAddRow('trending', addTabCache.trending.items);
    return;
  }
  try {
    const d = await tmdbFetch('/trending/all/week');
    const items = (d.results || [])
      .filter(x => (x.media_type === 'movie' || x.media_type === 'tv') && (x.title || x.name) && x.poster_path)
      .slice(0, 20).map(x => mapTmdbItem(x));
    addTabCache.trending = { ts: Date.now(), items };
    renderAddRow('trending', items);
  } catch(e) { /* error fallback */ }
}
```

From js/app.js:8981-8999 (renderAddRow shared):
```javascript
function renderAddRow(rowId, items) {
  const el = document.getElementById('add-row-' + rowId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="discover-loading">Nothing to show here yet.</div>';
    return;
  }
  el.innerHTML = items.map(x => { /* discover-card markup */ }).join('');
}
```

From app.html lines 392-430 (existing 4 hardcoded sections — to be replaced):
- `<div class="add-section">` with hardcoded `<div class="discover-row" id="add-row-trending">`
- Same for streaming, gems, mood

From todayKey() (referenced at js/app.js:3183):
```javascript
function todayKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Discovery engine — RED tests + GREEN implementation (xmur3/mulberry32/pickDailyRows + 25-row catalog)</name>
  <files>js/constants.js, js/discovery-engine.js, js/discovery-engine.test.js, js/app.js</files>
  <read_first>
    - js/constants.js full file (small; locate the right section to append DISCOVERY_CATALOG)
    - js/app.js line 9001-9094 (TMDB + addTabCache + ADD_CACHE_TTL pattern)
    - js/app.js Grep for `addTabCache` to enumerate read/write sites — must NOT break existing trending/streaming/gems loaders
    - js/app.js Grep for `todayKey` — confirm helper exists at :3183
    - .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §"Expanded candidate catalog — 35 rows across 6 buckets" (lines 30-127)
    - .planning/phases/11-feature-refresh-and-streamline/11-APPENDIX-CATEGORIES.md §"Daily-rotation logic" (lines 132-158)
    - .planning/phases/11-feature-refresh-and-streamline/11-PATTERNS.md §REFR-04 (row loader pattern + cache TTL)
    - .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Copywriting Contract REFR-04 (lines 333-352)
  </read_first>
  <behavior>
    - DISCOVERY_CATALOG is array of ~25 row descriptors covering Buckets A/B/C-auto-only/D/E/F. Bucket G personalization + curated C2/C4/C5/C6/C8 deferred to 11-03b.
    - Each row: { id, label, subtitle, bucket, source: { type, endpoint?, params? }, optional seasonalWindow / dayOfWeek / preferredDays / weekdayOnly / weekendOnly }
    - pickDailyRows(userId, dateKey, catalog) returns 7-10 row descriptors, deterministically selected via hash(userId+dateKey) seed
    - Composition: 2 from A always + 1 from B (weekday→B1, weekend→B2 fallback) + 2-3 from C random + 1-2 from D (preferred day weighted) + 1 from E (matching today's day-of-week) + 1 from F (only if active seasonal window)
    - PRNG = xmur3 (string→32-bit hash) + mulberry32 (seed→[0,1)) — both inline, no deps
    - Pure functions, sync, deterministic
  </behavior>
  <action>
    **Part A — js/constants.js:** Append a new export DISCOVERY_CATALOG. Use copy verbatim from 11-UI-SPEC.md §Copywriting Contract REFR-04. Include:
    - Bucket A (2 always-on): a1-streaming, a2-couch-into
    - Bucket B (4 trending pool, 1 picked/day): b1-trending-week (weekdayOnly:true), b2-trending-day (weekendOnly:true), b3-new-releases, b4-coming-soon
    - Bucket C (4 auto-only): c1-hidden-gems, c3-acclaimed, c7-foreign, c9-boutique (skip C2/C4/C5/C6/C8 — those are curated, ship in 11-03b)
    - Bucket D (3 use-case with preferredDays): d1-quick-watch [1,2], d3-date-night [5,6], d6-comfort-rewatch [0]
    - Bucket E (7 day-of-week): e-mon dayOfWeek:1 through e-sun dayOfWeek:0
    - Bucket F (5 seasonal): f1-halloween {monthStart:10,dayStart:1,monthEnd:11,dayEnd:1}, f2-holiday {monthStart:12,dayStart:1,monthEnd:1,dayEnd:1}, f3-summer {monthStart:6,dayStart:1,monthEnd:8,dayEnd:31}, f6-valentine {monthStart:2,dayStart:1,monthEnd:2,dayEnd:14}, f7-awards {monthStart:1,dayStart:1,monthEnd:3,dayEnd:31}

    Use the catalog skeleton from the patterns doc + UI-SPEC copy contract. Each row has a `source` field with type='tmdb-endpoint'|'tmdb-discover'|'tmdb-streaming-filter'|'group-recent-yes-similar'|'group-rewatch-candidates' and appropriate params (TMDB endpoint or discover query params, with verified TMDB v3 syntax).

    For TMDB-discover rows, use ONLY documented v3 query params: with_genres, with_runtime.lte/gte, with_original_language, with_companies, vote_average.gte, vote_count.gte/lte, primary_release_date.gte/lte, with_keywords, sort_by. Verify against TMDB Discover docs if unsure.

    A24 production company id = 41077. Neon = 90733 (verify via TMDB before commit; if uncertain, use a single confirmed boutique-studio id).

    **Part B — js/discovery-engine.test.js (RED first):** Create test file using Node built-in test runner (no test framework dep). Tests required:
    1. xmur3 deterministic — same input string → same output across calls
    2. mulberry32 deterministic — same seed → same sequence
    3. pickDailyRows deterministic per (userId, dateKey)
    4. pickDailyRows differs across users on same date
    5. pickDailyRows differs across dates for same user
    6. pickDailyRows always includes both Bucket A rows
    7. pickDailyRows includes day-of-week E row matching current weekday
    8. pickDailyRows total count is 7-10
    9. isInSeasonalWindow handles year-spanning Holiday window correctly (Dec 1 - Jan 1)
    10. isInSeasonalWindow handles same-month Valentine window (Feb 1-14)

    Run `node --test js/discovery-engine.test.js` — MUST FAIL (RED). Commit as commit 1a.

    **Part C — js/discovery-engine.js (GREEN):** Create the module:
    ```javascript
    export function xmur3(str) {
      let h = 1779033703 ^ str.length;
      for (let i = 0; i < str.length; i++) {
        h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
      }
      return function() {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
      };
    }

    export function mulberry32(seed) {
      return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
    }

    export function isInSeasonalWindow(date, win) {
      const m = date.getMonth() + 1;
      const d = date.getDate();
      if (win.monthEnd < win.monthStart) {
        // Year-spanning (e.g. Dec 1 - Jan 1)
        return (m > win.monthStart) || (m === win.monthStart && d >= win.dayStart) ||
               (m < win.monthEnd) || (m === win.monthEnd && d <= win.dayEnd);
      }
      if (m < win.monthStart || m > win.monthEnd) return false;
      if (m === win.monthStart && d < win.dayStart) return false;
      if (m === win.monthEnd && d > win.dayEnd) return false;
      return true;
    }

    export function pickDailyRows(userId, dateKey, catalog) {
      const seedFn = xmur3(`${userId}-${dateKey}`);
      const rng = mulberry32(seedFn());
      const date = new Date(dateKey + 'T12:00:00');
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const out = [];
      out.push(...catalog.filter(r => r.bucket === 'A'));
      const bRows = catalog.filter(r => r.bucket === 'B');
      const bPreferred = bRows.filter(r => isWeekend ? r.weekendOnly : r.weekdayOnly);
      const bPool = bPreferred.length ? bPreferred : bRows;
      out.push(bPool[Math.floor(rng() * bPool.length)]);
      const cRows = catalog.filter(r => r.bucket === 'C');
      const shuffledC = [...cRows].sort(() => rng() - 0.5);
      out.push(...shuffledC.slice(0, 2 + Math.floor(rng() * 2)));
      const dRows = catalog.filter(r => r.bucket === 'D');
      const dPreferred = dRows.filter(r => r.preferredDays && r.preferredDays.includes(dayOfWeek));
      const dPool = dPreferred.length ? dPreferred : dRows;
      const shuffledD = [...dPool].sort(() => rng() - 0.5);
      out.push(...shuffledD.slice(0, 1 + Math.floor(rng() * 2)));
      const eRow = catalog.find(r => r.bucket === 'E' && r.dayOfWeek === dayOfWeek);
      if (eRow) out.push(eRow);
      const fActive = catalog.filter(r => r.bucket === 'F' && r.seasonalWindow && isInSeasonalWindow(date, r.seasonalWindow));
      if (fActive.length) out.push(fActive[Math.floor(rng() * fActive.length)]);
      return out;
    }
    ```

    Run `node --test js/discovery-engine.test.js` — MUST PASS (GREEN). If a test fails, fix the engine logic (NOT the test). Commit as commit 1b.

    **Part D — js/app.js imports:** Add at top of file (next to other imports):
    ```javascript
    import { pickDailyRows, isInSeasonalWindow } from './discovery-engine.js';
    import { DISCOVERY_CATALOG } from './constants.js';
    ```

    Verify js/constants.js uses ES module export syntax (it should — confirm by reading file). If constants.js currently uses `export const` — DISCOVERY_CATALOG follows the same pattern. If it uses any other module style, match that style.

    Per D-XX from CONTEXT.md (REFR-04 first half LOCKED).
  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" &amp;&amp; node --test js/discovery-engine.test.js &amp;&amp; grep -c "DISCOVERY_CATALOG" js/constants.js &amp;&amp; grep -c "export function pickDailyRows" js/discovery-engine.js &amp;&amp; grep -c "export function xmur3" js/discovery-engine.js &amp;&amp; grep -c "export function mulberry32" js/discovery-engine.js &amp;&amp; grep -c "export function isInSeasonalWindow" js/discovery-engine.js &amp;&amp; grep -c "import.*pickDailyRows" js/app.js &amp;&amp; grep -c "import.*DISCOVERY_CATALOG" js/app.js &amp;&amp; node --check js/app.js &amp;&amp; node --check js/discovery-engine.js &amp;&amp; node --check js/constants.js</automated>
  </verify>
  <acceptance_criteria>
    - `node --test js/discovery-engine.test.js` ALL TESTS PASS (10 tests)
    - `grep -c "export const DISCOVERY_CATALOG" js/constants.js` returns 1
    - `grep -c "export function pickDailyRows" js/discovery-engine.js` returns 1
    - `grep -c "export function xmur3" js/discovery-engine.js` returns 1
    - `grep -c "export function mulberry32" js/discovery-engine.js` returns 1
    - `grep -c "export function isInSeasonalWindow" js/discovery-engine.js` returns 1
    - `grep -c "import.*pickDailyRows" js/app.js` returns >= 1
    - `grep -c "import.*DISCOVERY_CATALOG" js/app.js` returns >= 1
    - DISCOVERY_CATALOG entries: at least 24 (count `id:` occurrences inside the catalog literal block)
    - All 7 day-of-week E rows present: `grep -cE "dayOfWeek:\s*[0-6]" js/constants.js` returns >= 7
    - At least 5 seasonal F rows present: `grep -c "seasonalWindow:" js/constants.js` returns >= 5
    - Bucket A rows present: `grep -c "a1-streaming" js/constants.js` returns >= 1, `grep -c "a2-couch-into" js/constants.js` returns >= 1
    - `node --check js/app.js`, `node --check js/discovery-engine.js`, `node --check js/constants.js` all exit 0
    - 2 atomic commits land: RED tests commit + GREEN engine commit
  </acceptance_criteria>
  <done>
    Discovery engine TDD complete. 25-row catalog committed. PRNG + selector + window-check all unit-tested + green. Wire-up to UI is Task 2. 2 atomic commits: `test(11-03a): add RED tests for discovery engine` + `feat(11-03a): xmur3+mulberry32+pickDailyRows + 25-row catalog (REFR-04 engine)`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Wire pickDailyRows into Add tab — render 7-10 dynamic discovery rows</name>
  <files>app.html, js/app.js</files>
  <read_first>
    - app.html lines 380-435 (FULL READ — current Add tab discovery section: 4 hardcoded rows)
    - js/app.js lines 8980-9100 (renderAddRow + addTabCache + ADD_CACHE_TTL + loadTrendingRow + loadStreamingRow + loadGemsRow + scrollAddRow)
    - js/app.js Grep for `addTabCache\|ADD_CACHE_TTL\|mapTmdbItem` to confirm helpers
    - js/app.js Grep for `showAddTab\|renderAddTab\|onAddTab\|setActiveTab` to find Add tab orchestration entry point
    - .planning/phases/11-feature-refresh-and-streamline/11-PATTERNS.md §REFR-04 lines 195-238 (row markup template)
    - .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Copywriting Contract REFR-04 (lines 333-352)
  </read_first>
  <behavior>
    - Add tab discovery section: instead of 4 hardcoded blocks, ONE container `<div id="add-discovery-rows">` populated dynamically
    - On Add-tab open: pickDailyRows runs → 7-10 row descriptors → renderAddDiscovery emits one `<div class="add-section">` per row → each triggers loader (TMDB fetch or group-data lookup)
    - Mood section STAYS hardcoded above the dynamic container
    - Cache key per (rowId, dateKey, userId)
    - Per-row empty state: italic 'Nothing new here today — check back tomorrow.'
    - Loaders staggered to respect TMDB rate limit
  </behavior>
  <action>
    **Part A — HTML restructure (app.html lines 392-430):** Replace the 4 hardcoded `<div class="add-section">` blocks with:
    ```html
    <!-- Phase 11 / REFR-04 — Mood row stays hardcoded above the rotation -->
    <div class="add-section" id="add-mood-section">
      <!-- existing mood-filter UI moved here verbatim from current location -->
    </div>

    <!-- Phase 11 / REFR-04 — Dynamic discovery rotation; populated by renderAddDiscovery() -->
    <div id="add-discovery-rows"></div>
    ```

    Move existing mood-filter section UP (it stays static). DELETE the 4 hardcoded discovery sections (`#add-row-trending`, `#add-row-streaming`, `#add-row-gems`, plus any other hardcoded discovery row sections). Their loaders stay in js/app.js — invoked dynamically when rotation picks them.

    **Part B — js/app.js renderAddDiscovery + loadDiscoveryRow** (place near existing renderAddRow at ~js/app.js:8980):
    ```javascript
    function renderAddDiscovery() {
      const container = document.getElementById('add-discovery-rows');
      if (!container) return;
      const userId = (state.me && state.me.id) || 'anon';
      const dateKey = todayKey();
      const rows = pickDailyRows(userId, dateKey, DISCOVERY_CATALOG);

      container.innerHTML = rows.map(row => {
        const seasonalClass = row.bucket === 'F' ? ' seasonal' : '';
        return `<div class="add-section">
          <div class="discover-row-eyebrow${seasonalClass}">${escapeHtml(row.label)}</div>
          <div class="discover-row-subtitle"><em>${escapeHtml(row.subtitle)}</em></div>
          <div class="discover-row-wrap">
            <button class="discover-scroll-btn left" aria-label="Scroll left" onclick="scrollAddRow('${row.id}',-1)">&#9666;</button>
            <div class="discover-row" id="add-row-${row.id}"><div class="sk-row-posters" aria-hidden="true"><div class="sk-poster"></div><div class="sk-poster"></div><div class="sk-poster"></div></div></div>
            <button class="discover-scroll-btn right" aria-label="Scroll right" onclick="scrollAddRow('${row.id}',1)">&#9656;</button>
          </div>
        </div>`;
      }).join('');

      // Stagger loader invocations to respect TMDB ~40 req/10s budget
      rows.forEach((row, idx) => {
        const delay = idx < 4 ? 0 : (idx - 3) * 250;
        setTimeout(() => loadDiscoveryRow(row), delay);
      });
    }

    async function loadDiscoveryRow(row) {
      const cacheKey = `${row.id}-${todayKey()}-${(state.me && state.me.id) || 'anon'}`;
      addTabCache._discovery = addTabCache._discovery || {};
      const cached = addTabCache._discovery[cacheKey];
      if (cached && Date.now() - cached.ts < ADD_CACHE_TTL) {
        renderAddRow(row.id, cached.items);
        return;
      }
      try {
        let items = [];
        const src = row.source;
        if (src.type === 'tmdb-endpoint') {
          const d = await tmdbFetch(src.endpoint);
          items = (d.results || [])
            .filter(x => (x.media_type === 'movie' || x.media_type === 'tv' || src.endpoint.includes('/movie/') || src.endpoint.includes('/tv/')) && (x.title || x.name) && x.poster_path)
            .slice(0, 20).map(x => mapTmdbItem(x));
        } else if (src.type === 'tmdb-discover') {
          const params = new URLSearchParams({ sort_by: 'popularity.desc', ...src.params });
          const d = await tmdbFetch('/discover/movie?' + params.toString());
          items = (d.results || []).filter(x => x.poster_path && (x.title || x.name)).slice(0, 20).map(x => mapTmdbItem({ ...x, media_type: 'movie' }));
        } else if (src.type === 'tmdb-streaming-filter') {
          if (typeof loadStreamingRow === 'function') return loadStreamingRow();
        } else if (src.type === 'group-recent-yes-similar' || src.type === 'group-rewatch-candidates') {
          // Cold-start: empty triggers per-row empty state. Real implementation in 11-03b.
          items = [];
        }
        addTabCache._discovery[cacheKey] = { ts: Date.now(), items };
        renderAddRow(row.id, items);
      } catch(e) {
        const el = document.getElementById('add-row-' + row.id);
        if (el) el.innerHTML = '<div class="discover-loading"><em>Nothing new here today — check back tomorrow.</em></div>';
      }
    }
    ```

    **Part C — Update renderAddRow empty state** (js/app.js:8981-8999): Replace `'<div class="discover-loading">Nothing to show here yet.</div>'` with `'<div class="discover-loading"><em>Nothing new here today &mdash; check back tomorrow.</em></div>'` (or hyphen-em equivalent — match UI-SPEC line 352).

    **Part D — Wire renderAddDiscovery into orchestration:** Find Add-tab entry (`grep -n "showAddTab\|renderAddTab\|setActiveTab.*['\"]add['\"]" js/app.js`). Add `renderAddDiscovery()` call in the appropriate place (after mood section is rendered).

    Per D-XX from CONTEXT.md.
  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" &amp;&amp; grep -c 'id="add-discovery-rows"' app.html &amp;&amp; grep -c 'id="add-mood-section"' app.html &amp;&amp; grep -c "renderAddDiscovery" js/app.js &amp;&amp; grep -c "loadDiscoveryRow" js/app.js &amp;&amp; grep -c "Nothing new here today" js/app.js &amp;&amp; grep -c "addTabCache._discovery" js/app.js &amp;&amp; node --check js/app.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c 'id="add-discovery-rows"' app.html` returns 1
    - `grep -c 'id="add-mood-section"' app.html` returns 1
    - `grep -c "renderAddDiscovery" js/app.js` returns >= 2 (definition + call site)
    - `grep -c "loadDiscoveryRow" js/app.js` returns >= 2
    - `grep -c "Nothing new here today" js/app.js` returns >= 1
    - `grep -c "addTabCache._discovery" js/app.js` returns >= 1
    - HARDCODED ROWS REMOVED FROM HTML: `grep -c 'id="add-row-trending"' app.html` returns 0; `grep -c 'id="add-row-streaming"' app.html` returns 0; `grep -c 'id="add-row-gems"' app.html` returns 0
    - LOADERS STILL EXIST IN JS: `grep -c "function loadTrendingRow\|function loadStreamingRow\|function loadGemsRow" js/app.js` returns >= 2 (preserved for backward compat — invoked dynamically OR by other code paths)
    - `node --check js/app.js` exits 0
  </acceptance_criteria>
  <done>
    Add tab dynamically renders 7-10 discovery rows via pickDailyRows. Mood section stays static at top. Loaders staggered for TMDB rate-limit safety. Per-row cache keyed on (row, day, user). 1 atomic commit: `feat(11-03a): wire dynamic discovery rotation into Add tab (REFR-04)`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Eyebrow + subtitle CSS + sw.js CACHE bump</name>
  <files>css/app.css, sw.js</files>
  <read_first>
    - css/app.css line 1227 area (.add-section + .discover-row-wrap rules — find via grep)
    - css/app.css line 32-152 (token defs — confirm --t-eyebrow, --t-meta, --ink-dim, --ink-warm, --accent, --s1, --s2 all valid)
    - .planning/phases/11-feature-refresh-and-streamline/11-UI-SPEC.md §Component Inventory REFR-04 (lines 286-289 — .discover-row-eyebrow + .discover-row-subtitle)
    - .planning/phases/11-feature-refresh-and-streamline/11-PATTERNS.md §REFR-04 lines 230-238 (CSS rule template)
    - sw.js current CACHE value — should be `couch-v23-11-02-tab-restructure` post-Plan-11-02; if Plan 11-02 hasn't run yet, use whatever current value is
    - CLAUDE.md CACHE bump rule
  </read_first>
  <behavior>
    - .discover-row-eyebrow renders 11px uppercase Inter eyebrow above each row, color --ink-dim
    - .discover-row-eyebrow.seasonal renders same shape but color --accent (highlights seasonal F rows)
    - .discover-row-subtitle renders 13px Instrument Serif italic subtitle, color --ink-warm
    - PWA cache bumped to couch-v24-11-03a-discovery-engine
  </behavior>
  <action>
    **Part A — css/app.css:** Add new rules near the existing `.add-section` rule (search via grep `.add-section{` — likely around line 1220-1240). Insert AFTER the existing .add-section + .discover-row-wrap rules:
    ```css
    /* Phase 11 / REFR-04 — Discovery row eyebrow + subtitle (per UI-SPEC) */
    .discover-row-eyebrow{font-family:var(--font-sans);font-size:var(--t-eyebrow);
      color:var(--ink-dim);letter-spacing:0.12em;text-transform:uppercase;
      margin-bottom:var(--s1);font-weight:600}
    .discover-row-eyebrow.seasonal{color:var(--accent)}
    .discover-row-subtitle{font-family:var(--font-serif);font-style:italic;
      font-size:var(--t-meta);color:var(--ink-warm);margin-bottom:var(--s2);
      line-height:1.4}
    ```

    USE ONLY semantic tokens. ZERO raw px (use --s1, --s2, --t-eyebrow, --t-meta). ZERO raw font-family strings (use --font-sans, --font-serif). ZERO raw color hex (use --ink-dim, --accent, --ink-warm). Per BRAND.md and Phase 9 motion audit discipline.

    **Part B — sw.js CACHE bump:** Update sw.js line 8:
    - From: `const CACHE = 'couch-v23-11-02-tab-restructure';` (or whatever current value is)
    - To: `const CACHE = 'couch-v24-11-03a-discovery-engine';`

    Per CLAUDE.md rule.
  </action>
  <verify>
    <automated>cd "C:/Users/nahde/claude-projects/couch" &amp;&amp; grep -c ".discover-row-eyebrow{" css/app.css &amp;&amp; grep -c ".discover-row-eyebrow.seasonal{" css/app.css &amp;&amp; grep -c ".discover-row-subtitle{" css/app.css &amp;&amp; grep -c "couch-v24-11-03a-discovery-engine" sw.js &amp;&amp; node --check sw.js</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c ".discover-row-eyebrow{" css/app.css` returns 1
    - `grep -c ".discover-row-eyebrow.seasonal{" css/app.css` returns 1
    - `grep -c ".discover-row-subtitle{" css/app.css` returns 1
    - `grep -c "couch-v24-11-03a-discovery-engine" sw.js` returns 1
    - `grep -c "couch-v23-11-02-tab-restructure" sw.js` returns 0 (or whatever the prior value was — should be replaced)
    - NO raw px in new rules: any new line in the .discover-row-eyebrow/.discover-row-subtitle blocks must NOT contain `\d+px` literals — only token references
    - NO raw font-family strings in new rules: NO `'Inter'\|'Fraunces'\|'Instrument Serif'` directly in new rules — only `var(--font-*)` tokens
    - `node --check sw.js` exits 0
  </acceptance_criteria>
  <done>
    Per-row eyebrow + italic subtitle rendered above each discovery row. Seasonal rows highlighted with accent color. PWA cache bumped to v24. 1 atomic commit: `style(11-03a): discovery row eyebrow + subtitle + bump sw.js CACHE (REFR-04)`.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Human-verify discovery rotation</name>
  <what-built>
    Discovery engine TDD (xmur3 + mulberry32 + pickDailyRows + isInSeasonalWindow + 25-row catalog) + dynamic Add-tab rendering of 7-10 rows per day with hash-seeded rotation + day-of-week themes + seasonal injection + per-row eyebrow + subtitle styling + sw.js cache bump. Total: 4 atomic commits, 7 files modified.
  </what-built>
  <how-to-verify>
    Open http://localhost:5500/app or deploy to a Firebase preview channel.

    **Engine determinism (DevTools console):**
    1. Open Add tab → DevTools → Console.
    2. Run: `pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id)` (note the array).
    3. Run again — exact same array.
    4. Run with different date: `pickDailyRows('user-A', '2026-04-25', DISCOVERY_CATALOG).map(r => r.id)` — DIFFERENT array.
    5. Run with different user: `pickDailyRows('user-B', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id)` — DIFFERENT array.
    6. Confirm both Bucket A rows (a1-streaming, a2-couch-into) appear in EVERY result.

    **Day-of-week theme:**
    7. Today (2026-04-24) is Friday → confirm e-fri "Foreign Film Friday" row appears.
    8. (OPTIONAL) Use system date override or call directly: `pickDailyRows('user-A', '2026-04-23', DISCOVERY_CATALOG)` (Thursday) → confirm e-thu "Throwback Thursday" appears.

    **Seasonal injection:**
    9. Today is April → seasonal F rows should NOT appear UNLESS within an active window. April is inside Awards Season window (Jan 1 - Mar 31)? NO — Awards window ends Mar 31. So no seasonal row today.
    10. (OPTIONAL test) Run `pickDailyRows('user-A', '2026-10-15', DISCOVERY_CATALOG)` — confirm Halloween F1 row appears in result.
    11. (OPTIONAL test) Run `pickDailyRows('user-A', '2026-12-15', DISCOVERY_CATALOG)` — confirm Holiday F2 row appears.

    **Add tab UI:**
    12. Tap Add tab. Confirm:
       a. Mood section at top (unchanged).
       b. Below mood: 7-10 discovery row cards.
       c. Each row has an UPPERCASE eyebrow (e.g. "TRENDING THIS WEEK") in dim ink.
       d. Each row has italic subtitle below eyebrow (e.g. "*What everyone's on*").
       e. Each row populates with poster cards from TMDB after a brief skeleton.
       f. Empty rows (e.g. group-recent-yes-similar with no group history) show italic "Nothing new here today — check back tomorrow."
    13. Refresh the page. Confirm SAME 7-10 rows appear (deterministic per-day).
    14. Open DevTools → Network → filter to themoviedb.org → confirm fetches happen but staggered (not 10 at once); confirm count is reasonable (≤10 fetches for cold-load, 0 fetches on subsequent same-day refreshes thanks to cache).

    **PWA cache:**
    15. DevTools → Application → Service Workers → confirm version `couch-v24-11-03a-discovery-engine`.

    **No regressions:**
    16. Mood-filter chip selection still works (mood section unchanged).
    17. Tap any discovery card → existing `addFromAddTab(rowId, titleId)` add-flow still works.
    18. `node --test js/discovery-engine.test.js` still passes (regression check).

    Type "approved" if all 18 checks pass; describe specific failures otherwise.
  </how-to-verify>
  <resume-signal>Type "approved" or describe issues to address before deploy</resume-signal>
</task>

</tasks>

<threat_model>
This plan introduces NEW network surface (additional TMDB endpoints) and NEW client-side data structure (DISCOVERY_CATALOG) but no new authenticated write paths, no new Firestore writes, no new auth boundaries.

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-03a-01 | Denial of Service | TMDB rate-limit exhaustion if 7-10 rows fetch in parallel | mitigate | Loaders staggered (4 immediate + 250ms each thereafter); per-row cache keyed on (rowId, dateKey, userId) so re-renders within ADD_CACHE_TTL hit cache; cold-load total request count capped at ~10 within a 2-3s window, well under 40req/10s TMDB budget |
| T-11-03a-02 | Information Disclosure | Hash seed (userId + dateKey) reveals nothing about user identity to third parties — TMDB sees only the discovery query, not the seed | accept | xmur3+mulberry32 outputs are not transmitted; seed used only client-side. No new disclosure surface. |
| T-11-03a-03 | Tampering | User could modify DISCOVERY_CATALOG in dev console to force specific rows | accept | Catalog is public-by-design (matches existing TMDB key + Firebase config posture per CLAUDE.md); modification only affects local view, no security implication |
| T-11-03a-04 | Spoofing | Hash collision could in principle let one user predict another's row selection | accept | xmur3+mulberry32 is not a crypto hash, but this is presentational (which discovery rows show), not a security boundary; 32-bit space + 25-row catalog → effectively no consequential collision |
</threat_model>

<verification>
1. `node --test js/discovery-engine.test.js` 10/10 PASS
2. `node --check js/app.js`, `node --check js/discovery-engine.js`, `node --check js/constants.js`, `node --check sw.js` all exit 0
3. Add tab renders 7-10 rows per visit (verified via DevTools console pickDailyRows call)
4. Hash determinism per (userId, dateKey) confirmed via human-verify
5. Day-of-week theme E row matches today
6. Seasonal injection only fires when current date inside window
7. PWA SW version registered in browser is `couch-v24-11-03a-discovery-engine`
8. TMDB request count on cold load ≤ 10 (verified via Network tab)
</verification>

<success_criteria>
- 4 atomic commits land (RED tests + GREEN engine + UI wire + CSS+cache)
- DISCOVERY_CATALOG with 24+ rows shipped in js/constants.js
- Pure-function engine (xmur3, mulberry32, pickDailyRows, isInSeasonalWindow) shipped in js/discovery-engine.js with green unit tests
- Add tab dynamically renders 7-10 deterministic rows per (user, day)
- Day-of-week theme row appears (Mon-Sun rotation)
- Seasonal injection fires within active windows (Halloween/Holiday/Valentine/Summer/Awards)
- Per-row eyebrow + subtitle render with accent variant for seasonal
- TMDB rate limit honored (staggered + cached)
- sw.js CACHE bumped to v24
- REFR-04 first-half closes (curated lists + Browse-all + personalization deferred to 11-03b)
- Zero functional regressions on Add tab
</success_criteria>

<output>
After completion, create `.planning/phases/11-feature-refresh-and-streamline/11-03a-SUMMARY.md` documenting:
- 4 commit SHAs + brief description each
- Confirmed REFR-04 first-half closure
- 25-row catalog summary (which Bucket-C/D rows shipped, which deferred to 11-03b)
- TDD test pass count + test runtime
- sw.js CACHE bump (v23 → v24-11-03a-discovery-engine)
- Verification matrix from human-verify checkpoint
- TMDB rate-limit observed cold-load fetch count
- File modification summary
- Note on what 11-03b will add: Bucket C curated rows (cult/awards/festivals/director/docs), Bucket G personalization (5+ rows), Browse-all sheet, pin-up-to-3 favorites
</output>
