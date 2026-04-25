---
phase: 14-decision-ritual-core
plan: 05
type: execute
wave: 1
depends_on: []
files_modified:
  - js/app.js
  - css/app.css
autonomous: false
requirements_addressed: [DECI-14-04, DECI-14-05]
must_haves:
  truths:
    - "card(t) at js/app.js:4333 no longer renders the Vote button on tile face — primary action is a single tap on tile body opening openTileActionSheet (4 buckets: Watch tonight / Schedule for later / Ask family / Vote de-emphasized)."
    - "Tile face now includes 'X want it' pill: 3 micro-avatars (initial-letter circles using memberColor) + '+N' overflow chip, computed from t.queues membership; renders only when t.queues has ≥1 entry."
    - "Tile face includes ▶ Trailer button when t.trailerKey exists; tap launches existing trailer flow (delegates to action-sheet's trailer entry implementation, NOT a new player)."
    - "openDetailModal surfaces formerly-hidden items: trailer (lazy-loaded section), providers (existing logic preserved), synopsis, cast (NEW section), reviews (NEW section)."
    - "Add tab renders 'Catch up on votes (N)' CTA that appears automatically when count of unvoted family titles ≥ 10; tap launches existing openVoteModal()."
    - "Carry-over UAT bug verified: .detail-close{position:fixed} at css/app.css:1540 is inspected for Library/Queue context coverage; if a different scroll container is involved, fix is extended OR documented as out-of-context for the bug."
    - "Existing openActionSheet at js/app.js:11853 is NOT modified — only a new sibling openTileActionSheet is added next to it."
  artifacts:
    - path: "js/app.js"
      provides: "card(t) modifications + openTileActionSheet + tile-tap rewire + Catch-up-on-votes CTA + detail-modal extensions"
      contains: "window.openTileActionSheet"
    - path: "css/app.css"
      provides: ".tc-want-pill, .tc-want-avatar, .tc-want-overflow, .tc-trailer-btn, detail-modal cast/reviews sections"
      contains: ".tc-want-pill"
      min_lines_added: 80
  key_links:
    - from: "tile body onclick at js/app.js:4469"
      to: "openTileActionSheet(titleId, event)"
      via: "swap from openDetailModal to openTileActionSheet"
      pattern: "openTileActionSheet\\("
    - from: "Add tab renderer"
      to: "Catch-up-on-votes CTA"
      via: "conditional render when unvoted count >= 10"
      pattern: "Catch up on votes"
---

<objective>
Implement the tile redesign per D-04 + Vote-mode preservation per D-05. Demote Vote from tile face; surface the new "X want it" pill (3 micro-avatars + +N); add ▶ Trailer button on tile face; rewire single-tap on tile body to open a new openTileActionSheet (4 buckets) instead of the existing openDetailModal; surface previously-hidden items (trailer / providers / synopsis / cast / reviews) inside the detail modal as the secondary entry; add Add-tab "Catch up on votes (N)" CTA; verify the carry-over UAT bug fix (`.detail-close{position:fixed}`) covers the reported Library/Queue context.

Purpose: D-04 reframes the tile from "vote-prominent" to "decision-prominent." Vote is bulk curation (preserved in Vote mode under Add tab per D-05); the tile is now an action launcher. The "X want it" pill makes social proof visible at a glance. Surfacing trailer/providers/cast/reviews into detail-modal closes the long-standing "buried under ⋯" UX gap. The carry-over UAT bug close-out is genuinely small (the fix may already be in place — see PATTERNS.md finding) but must be verified against the actual reported context (Library/Queue).

Output: card(t) modifications, new openTileActionSheet primitive, detail-modal extensions, Add-tab CTA, CSS for new tile UI, and a checkpoint verifying the carry-over bug.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 2 (independent of 14-01..14-04 in code dependency; lives in Wave 2 to keep Wave 1 narrow).

**Two-repo discipline:** Couch-side only — repo-relative paths.

**No primitive-rebuild:** the existing openActionSheet at js/app.js:11853 stays UNCHANGED. The new openTileActionSheet is a SIBLING that calls into the same #action-sheet-bg DOM. The "More options" entry in openTileActionSheet falls back to the full openActionSheet so power-user functionality is preserved.

**Carry-over UAT bug:** PATTERNS.md §16 (and finding at line 1205-1214) reports that `.detail-close{position:fixed}` is ALREADY in css/app.css at line 1540. Task 4 verifies this covers the reported Library/Queue context and either closes the bug OR extends the fix.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md
@.planning/BRAND.md

<interfaces>
**Existing card(t)** at js/app.js:4333-4486 — full body returns the tile HTML string. Key surface lines:
- 4353: `${yesCount} 👍` pill (the new "X want it" pill replaces this).
- 4423-4428: `.tc-vote-chip` per-member vote chips with `memberColor()`.
- 4466: `primaryBtn` (the Vote button on tile face — REMOVED).
- 4469: tile body onclick=`openDetailModal('${t.id}')` (REWIRED to openTileActionSheet).
- 4480-4483: `.tc-footer` containing `.tc-primary` + `.tc-more` (⋯ → openActionSheet).

**Existing openActionSheet** at js/app.js:11853-11896 — full primitive. The new openTileActionSheet copies the shell verbatim (DOM container, .action-sheet-item / .action-sheet-divider / .action-sheet-title classes already styled, `#action-sheet-bg.classList.add('on')` open contract).

**Existing memberColor() helper** — emits a stable per-member color from member id; used at js/app.js:11930 (`<div class="who-avatar" style="background:${memberColor(c.id)}">${(c.name||'?')[0]}</div>`). The "X want it" pill micro-avatars use the same shape.

**openDetailModal / renderDetail** — exact line not located in research, but PATTERNS.md §5 calls them out as planner-grep targets. Detail modal is where trailer/providers/synopsis/cast/reviews surface in D-04. The existing modal already has trailer + providers + synopsis (per pre-Phase-14 state); D-04 specifies adding cast + reviews as NEW sections.

**openVoteModal()** — existing Vote-mode launcher (referenced in PATTERNS.md analog). Add-tab "Catch up on votes" CTA delegates to this.

**Add-tab handler** — likely `function renderAdd` or similar; planner greps to locate.

**.detail-close fix at css/app.css:1540** — already present per PATTERNS.md §16 / line 1205-1214:
```css
/* fixed (not absolute) so the close button stays visible while the detail view scrolls.
   position:fixed inside a transformed parent would break; detail-modal-bg doesn't transform, so fixed
   pins against the viewport correctly. iOS safe-area inset keeps the button clear of the notch. */
.detail-close{position:fixed;top:calc(var(--s3) + env(safe-area-inset-top, 0px));...}
```
Plus a scoped override at css/app.css:2373: `.avatar-picker-modal .detail-close{position:absolute;...}`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Modify card(t) — remove Vote button, add 'X want it' pill, add ▶ Trailer button, rewire body tap</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js lines 4333-4490 (full card(t) body)
    - js/app.js around line 11930 (memberColor + who-avatar pattern)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §4 (concrete X-want-it pill excerpt) and §5 (openTileActionSheet skeleton)
    - css/app.css — grep `.tc-vote-chip` and `.tc-primary` for adjacent CSS class neighborhood
  </read_first>
  <action>
1. **Locate** the yes-count pill at js/app.js:4353. Replace the line with:

```js
// D-04 (DECI-14-04) — "X want it" pill replaces the bare yes-count pill.
// Counts members with this title in their queues map (per DR-2, queues == Yes votes today; future-proof against decoupling by reading queues directly).
if (!t.watched && t.queues) {
  const queuers = (state.members || []).filter(m => t.queues[m.id] != null);
  if (queuers.length > 0) {
    const visible = queuers.slice(0, 3);
    const overflow = queuers.length - visible.length;
    const avatars = visible.map(m =>
      `<div class="tc-want-avatar" title="${escapeHtml(m.name || 'Member')}" style="background:${memberColor(m.id)}">${escapeHtml((m.name || '?')[0].toUpperCase())}</div>`
    ).join('');
    const overflowChip = overflow > 0 ? `<div class="tc-want-overflow">+${overflow}</div>` : '';
    const wantWord = queuers.length === 1 ? 'wants' : 'want';
    metaParts.push(
      `<span class="tc-want-pill" aria-label="${queuers.length} ${queuers.length === 1 ? 'person' : 'people'} ${wantWord} this">
        <span class="tc-want-avatars">${avatars}${overflowChip}</span>
        <span class="tc-want-label">${queuers.length} ${wantWord} it</span>
      </span>`
    );
  }
}
```

   The original `else if (!t.watched && yesCount > 0) metaParts.push(\`${yesCount} 👍\`);` line is REPLACED by this block. The watched-state pill (if present, e.g. `else if (t.watched) ...`) stays.

2. **Locate the tile body onclick** at js/app.js:4469. Change:
```js
   onclick="openDetailModal('${t.id}')"
   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailModal('${t.id}');}">
```
To:
```js
   onclick="openTileActionSheet('${t.id}',event)"
   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openTileActionSheet('${t.id}',event);}">
```

3. **Add ▶ Trailer button on tile face**. Insert IMMEDIATELY before the existing `.tc-footer` block (around js/app.js:4480), inside the tile markup:

```js
const trailerBtnHtml = (t.trailerKey && !t.watched)
  ? `<button class="tc-trailer-btn" type="button" aria-label="Watch trailer for ${escapeHtml(t.name)}"
      onclick="event.stopPropagation();openActionSheetTrailer('${t.id}')">▶ Trailer</button>`
  : '';
```

   And append `${trailerBtnHtml}` into the tile HTML composition where appropriate (e.g. near the `.tc-meta` section). The trailer button uses event.stopPropagation() to avoid bubbling into the new openTileActionSheet.

   Add a small helper near openTileActionSheet (Task 2):
```js
window.openActionSheetTrailer = function(titleId) {
  // Delegate to existing action-sheet trailer entry implementation.
  // Search for the existing trailer launch code in openActionSheet body (~js/app.js:11886) and
  // call the same downstream function it calls (e.g. openTrailerModal / playTrailer / etc.).
  const t = state.titles.find(x => x.id === titleId);
  if (!t || !t.trailerKey) return;
  // Reuse the existing function the action sheet uses — locate via grep.
  if (typeof openTrailerModal === 'function') openTrailerModal(t);
  else if (typeof window.openTrailerModal === 'function') window.openTrailerModal(t);
  else { console.warn('[trailer] no openTrailerModal in scope; falling back to action sheet'); openActionSheet(titleId); }
};
```

4. **Remove the Vote button (`primaryBtn` Vote case)** at js/app.js:4459-4467. Locate the `primaryBtn` variable assignment for the Vote case and delete the Vote branch entirely. If `primaryBtn` is also used for other states (e.g. "Veto", "Schedule"), preserve those branches; remove ONLY the Vote case.

   If primaryBtn becomes empty as a result (no remaining cases for unwatched titles), the `.tc-primary` slot in `.tc-footer` becomes empty — the layout should still hold (CSS flex). Verify by reading the footer composition at js/app.js:4480-4483.

5. Run `node --check` after each edit to fail fast on syntax errors.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "tc-want-pill" js/app.js && grep -c "openTileActionSheet" js/app.js</automated>
    Expect: `node --check` exits 0; grep `tc-want-pill` returns ≥1; grep `openTileActionSheet` returns ≥2 (definition site in Task 2 + tile body call site).
  </verify>
  <done>
    - card(t) renders `tc-want-pill` (with 3 micro-avatars + +N overflow + count text) when t.queues has ≥1 entry.
    - Tile body onclick calls `openTileActionSheet('${t.id}',event)` not `openDetailModal('${t.id}')`.
    - ▶ Trailer button renders when t.trailerKey exists; uses event.stopPropagation().
    - Vote button removed from `.tc-primary` (or its primaryBtn branch deleted).
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add openTileActionSheet primitive (sibling to openActionSheet)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 11853-11900 (full openActionSheet body — the analog to copy verbatim shell from)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §5 (concrete openTileActionSheet skeleton — copy verbatim)
  </read_first>
  <action>
1. Locate `window.openActionSheet = function(titleId, e)` at js/app.js:11853. Insert the new function IMMEDIATELY ABOVE it (so the two sit side-by-side; the file ordering doesn't matter for `window.*` functions but co-location aids future reading).

2. Insert verbatim:

```js
// D-04 (DECI-14-04) — primary tile-tap entry. Narrower than openActionSheet's full menu.
// 4 D-04 buckets: Watch tonight / Schedule for later / Ask family / Vote (de-emphasized).
// Plus secondary divider + "Show details" (delegates to openDetailModal) + "More options" (delegates to full openActionSheet).
window.openTileActionSheet = function(titleId, e) {
  if (e) e.stopPropagation();
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  const content = document.getElementById('action-sheet-content');
  if (!content) return;
  const items = [];
  if (!t.watched && state.me) {
    // 1. Watch tonight — start a watchparty immediately.
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openWatchpartyStart('${titleId}')"><span class="icon">🎬</span>Watch tonight</button>`);
    // 2. Schedule for later — existing schedule modal.
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openScheduleModal('${titleId}')"><span class="icon">📅</span>Schedule for later</button>`);
    // 3. Ask family — existing askTheFamily entry.
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();askTheFamily('${titleId}')"><span class="icon">💭</span>Ask family</button>`);
    // 4. Vote — de-emphasized (kept for completeness per D-04).
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openVoteModal('${titleId}')"><span class="icon">🗳</span>Vote</button>`);
  }
  items.push(`<div class="action-sheet-divider"></div>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openDetailModal('${titleId}')"><span class="icon">ℹ</span>Show details</button>`);
  items.push(`<button class="action-sheet-item" onclick="closeActionSheet();openActionSheet('${titleId}',event)"><span class="icon">⋯</span>More options</button>`);
  // Per-title rewatch override entry (D-01 surface — wired to setRewatchAllowed from 14-01).
  if (state.me && t.watched) {
    items.push(`<div class="action-sheet-divider"></div>`);
    items.push(`<button class="action-sheet-item" onclick="closeActionSheet();setRewatchAllowed('${titleId}','${state.me.id}')"><span class="icon">🔁</span>Rewatch this one</button>`);
  }
  content.innerHTML = `<div class="action-sheet-title">${escapeHtml(t.name)}</div>${items.join('')}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};
```

3. Verify `closeActionSheet`, `openWatchpartyStart`, `openScheduleModal`, `askTheFamily`, `openVoteModal`, `openDetailModal`, `openActionSheet`, `setRewatchAllowed` are all in scope (window-scoped or top-level). If any are missing (likely because they're internal to a section not yet bridged to window), wrap them in window.* aliases at their existing definition site OR adjust the new openTileActionSheet calls to match their actual scope.

4. Add comment marker `// === D-04 openTileActionSheet — DECI-14-04 ===` immediately above the new function for grep traceability.
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "window.openTileActionSheet" js/app.js</automated>
    Expect: `node --check` exits 0; grep returns 1.
  </verify>
  <done>
    - window.openTileActionSheet defined exactly once.
    - 4 D-04 buckets present (Watch tonight / Schedule for later / Ask family / Vote).
    - Show details + More options secondary entries present.
    - Rewatch entry surfaces when t.watched (D-01 cross-link).
    - Existing window.openActionSheet at js/app.js:11853 is UNCHANGED (verifiable by `git diff js/app.js | grep -c "^[-+].*openActionSheet = function"` returns 0 for changes to the existing one).
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Extend detail modal — add cast + reviews sections; verify trailer/providers/synopsis already surfaced</name>
  <files>js/app.js, css/app.css</files>
  <read_first>
    - js/app.js — Grep for `function openDetailModal` and `function renderDetail` to locate the modal body composition
    - css/app.css — Grep for `.detail-modal-bg`, `.detail-content`, `.detail-section` to locate the styling neighborhood
  </read_first>
  <action>
1. **Locate the detail-modal renderer.** Grep for `function openDetailModal` AND `function renderDetail` (one or both should exist). Read the modal body composition (likely a multi-section innerHTML string).

2. **Audit current sections** the detail modal renders. For each of the 5 D-04-required surfaces, mark present/absent:
   - Trailer (lazy-loaded section): EXPECTED PRESENT — likely already in detail-modal as a lazy-loaded YouTube iframe gated on t.trailerKey.
   - Providers (where to stream): EXPECTED PRESENT — the tile already shows providers, likely also detail.
   - Synopsis: EXPECTED PRESENT — almost certainly already in detail.
   - Cast: NEW per D-04 — likely absent.
   - Reviews: NEW per D-04 — likely absent.

3. **For ABSENT sections (cast + reviews per audit), add them.** Cast comes from TMDB (`/movie/{id}/credits` or `/tv/{id}/credits` — search if a t.cast field exists; if not, fetch lazily on detail-modal open with TMDB rate-limit budgeting per CLAUDE.md). Reviews come from TMDB (`/movie/{id}/reviews` or `/tv/{id}/reviews`).

   Pattern (verify TMDB constant locations before composing — TMDB_KEY lives in js/constants.js):

```js
// D-04 (DECI-14-04) — Cast + Reviews lazy-fetch on detail-modal open.
async function ensureTitleCastAndReviews(t) {
  if (!t || (t.castFetchedAt && t.reviewsFetchedAt)) return;
  const isMovie = (t.type === 'movie' || !t.type); // default to movie if untyped
  const seg = isMovie ? 'movie' : 'tv';
  const tmdbId = t.tmdbId || t.id; // tmdbId is the canonical TMDB numeric id
  if (!tmdbId) return;
  try {
    if (!t.castFetchedAt) {
      const r = await fetch(`https://api.themoviedb.org/3/${seg}/${tmdbId}/credits?api_key=${TMDB_KEY}`);
      if (r.ok) {
        const data = await r.json();
        t.cast = (data.cast || []).slice(0, 8); // top 8 cast for detail-modal
        t.castFetchedAt = Date.now();
      }
    }
    if (!t.reviewsFetchedAt) {
      const r = await fetch(`https://api.themoviedb.org/3/${seg}/${tmdbId}/reviews?api_key=${TMDB_KEY}`);
      if (r.ok) {
        const data = await r.json();
        t.reviews = (data.results || []).slice(0, 3); // top 3 reviews for detail-modal
        t.reviewsFetchedAt = Date.now();
      }
    }
  } catch (e) {
    console.warn('[detail] cast/reviews fetch failed', e);
  }
}

function renderDetailCastSection(t) {
  if (!t.cast || !t.cast.length) return '';
  const items = t.cast.slice(0, 8).map(p =>
    `<div class="detail-cast-item">
      <div class="detail-cast-name">${escapeHtml(p.name || '')}</div>
      ${p.character ? `<div class="detail-cast-char">${escapeHtml(p.character)}</div>` : ''}
    </div>`
  ).join('');
  return `<section class="detail-section">
    <h3 class="detail-section-h">Cast</h3>
    <div class="detail-cast-grid">${items}</div>
  </section>`;
}

function renderDetailReviewsSection(t) {
  if (!t.reviews || !t.reviews.length) return '';
  const items = t.reviews.slice(0, 3).map(r =>
    `<article class="detail-review">
      <header class="detail-review-h">${escapeHtml(r.author || 'Reviewer')}${r.author_details && r.author_details.rating ? ` · ${r.author_details.rating}/10` : ''}</header>
      <p class="detail-review-body">${escapeHtml((r.content || '').slice(0, 360))}${(r.content || '').length > 360 ? '…' : ''}</p>
    </article>`
  ).join('');
  return `<section class="detail-section">
    <h3 class="detail-section-h">Reviews</h3>
    <div class="detail-reviews-list">${items}</div>
  </section>`;
}
```

4. Inside the existing `openDetailModal` (or `renderDetail`) body, AFTER the existing innerHTML composition, add:

```js
// D-04 — lazy-fetch cast + reviews; re-render section appends after fetch.
ensureTitleCastAndReviews(t).then(() => {
  const detailBody = document.getElementById('detail-body') || document.querySelector('.detail-content');
  if (!detailBody) return;
  // Append cast + reviews sections if they're missing.
  if (!detailBody.querySelector('.detail-section[data-section="cast"]')) {
    const wrap = document.createElement('div');
    wrap.dataset.section = 'cast';
    wrap.innerHTML = renderDetailCastSection(t);
    if (wrap.firstElementChild) {
      wrap.firstElementChild.dataset.section = 'cast';
      detailBody.appendChild(wrap.firstElementChild);
    }
  }
  if (!detailBody.querySelector('.detail-section[data-section="reviews"]')) {
    const wrap = document.createElement('div');
    wrap.dataset.section = 'reviews';
    wrap.innerHTML = renderDetailReviewsSection(t);
    if (wrap.firstElementChild) {
      wrap.firstElementChild.dataset.section = 'reviews';
      detailBody.appendChild(wrap.firstElementChild);
    }
  }
});
```

   The exact selector (`#detail-body` vs `.detail-content`) depends on the existing modal markup — read it first, match exactly. If neither exists, the SUMMARY notes the discovery and the executor adapts.

5. **Add CSS** for the new sections. Append to css/app.css:

```css
/* === D-04 detail modal extensions — DECI-14-04 === */
.detail-section { margin: var(--s4) 0; }
.detail-section-h {
  font-family: var(--font-serif, 'Instrument Serif', serif);
  font-size: 22px;
  margin: 0 0 var(--s2);
  color: var(--c-text-strong, #e8dcc4);
}
.detail-cast-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--s2);
}
.detail-cast-item { padding: var(--s2); background: var(--c-bg-elevated, #1f1a16); border-radius: var(--r-md, 8px); }
.detail-cast-name { font-weight: 600; color: var(--c-text-strong, #e8dcc4); }
.detail-cast-char { font-size: 13px; color: var(--c-text-dim, #8a7d6e); margin-top: 2px; }
.detail-reviews-list { display: flex; flex-direction: column; gap: var(--s3); }
.detail-review { padding: var(--s3); background: var(--c-bg-elevated, #1f1a16); border-radius: var(--r-md, 8px); }
.detail-review-h { font-weight: 600; color: var(--c-text-strong, #e8dcc4); margin-bottom: var(--s2); }
.detail-review-body { color: var(--c-text-body, #c4b89e); line-height: 1.5; margin: 0; }

/* "X want it" pill for tile face (D-04) */
.tc-want-pill {
  display: inline-flex;
  align-items: center;
  gap: var(--s2);
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--c-bg-elevated, #1f1a16);
  font-size: 12px;
  color: var(--c-text-body, #c4b89e);
}
.tc-want-avatars { display: inline-flex; align-items: center; }
.tc-want-avatar {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 10px; font-weight: 700;
  color: var(--c-text-on-avatar, #fff);
  margin-left: -4px;
  border: 2px solid var(--c-bg-elevated, #1f1a16);
}
.tc-want-avatar:first-child { margin-left: 0; }
.tc-want-overflow {
  width: 18px; height: 18px;
  border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
  background: var(--c-bg-deep, #14110f);
  color: var(--c-text-dim, #8a7d6e);
  border: 2px solid var(--c-bg-elevated, #1f1a16);
  margin-left: -4px;
}
.tc-want-label { white-space: nowrap; }
.tc-trailer-btn {
  appearance: none;
  background: transparent;
  border: 1px solid var(--c-warm-amber, #d4a574);
  color: var(--c-warm-amber, #d4a574);
  padding: 6px 12px;
  border-radius: var(--r-md, 8px);
  font-size: 13px;
  cursor: pointer;
}
```
  </action>
  <verify>
    <automated>node --check js/app.js && grep -c "renderDetailCastSection" js/app.js && grep -c "\\.detail-cast-grid" css/app.css</automated>
    Expect: `node --check` exits 0; both grep ≥1.
  </verify>
  <done>
    - Detail modal lazy-fetches cast + reviews from TMDB (8 cast / 3 reviews).
    - Detail modal markup includes Cast + Reviews sections after fetch resolves.
    - CSS rules for `.tc-want-pill`, `.tc-want-avatar`, `.tc-trailer-btn`, `.detail-section`, `.detail-cast-grid`, `.detail-review` all present.
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Add 'Catch up on votes (N)' CTA to Add tab (D-05)</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js — Grep for `function renderAdd` or `tab === 'add'` to locate Add-tab renderer
    - js/app.js — Grep for `openVoteModal` to confirm the existing Vote-mode launcher signature
  </read_first>
  <action>
1. Locate the Add-tab renderer. Read the function body to understand the existing render structure (likely composes innerHTML for an Add-tab container element).

2. Insert IMMEDIATELY at the top of the rendered content (before existing rows):

```js
// D-05 (DECI-14-05) — Vote-mode CTA. Surfaces when ≥10 unvoted family titles exist.
const unvotedCount = (state.titles || []).filter(t => {
  if (t.watched) return false;
  if (!state.me) return false;
  const v = (t.votes || {})[state.me.id];
  return v == null;
}).length;
const catchUpCtaHtml = unvotedCount >= 10
  ? `<div class="add-catchup-cta">
      <div class="add-catchup-h">Catch up on votes</div>
      <p class="add-catchup-body">${unvotedCount} titles waiting for your vote. Swipe through them.</p>
      <button class="tc-primary" type="button" onclick="openVoteModal()">Open Vote mode</button>
    </div>`
  : '';
```

3. Splice `${catchUpCtaHtml}` into the existing Add-tab innerHTML composition at the top.

4. Add CSS to css/app.css:

```css
/* === D-05 Catch-up-on-votes CTA — DECI-14-05 === */
.add-catchup-cta {
  background: var(--c-bg-elevated, #1f1a16);
  padding: var(--s3);
  border-radius: var(--r-lg, 12px);
  margin-bottom: var(--s4);
  border: 1px solid var(--c-warm-amber, #d4a574);
}
.add-catchup-h {
  font-family: var(--font-serif, 'Instrument Serif', serif);
  font-size: 20px;
  color: var(--c-text-strong, #e8dcc4);
}
.add-catchup-body {
  color: var(--c-text-body, #c4b89e);
  margin: var(--s2) 0 var(--s3);
}
```

5. Verify `openVoteModal` is window-scoped (search `window.openVoteModal =` or top-level `function openVoteModal`). If only top-level and Add tab is rendered via inline innerHTML script context, alias as `window.openVoteModal = openVoteModal;` at the existing definition site.
  </action>
  <verify>
    <automated>grep -c "Catch up on votes" js/app.js && grep -c "add-catchup-cta" css/app.css</automated>
    Expect: both ≥1.
  </verify>
  <done>
    - Add-tab renderer conditionally inserts Catch-up CTA when unvotedCount >= 10.
    - CTA tap calls `openVoteModal()` (existing function).
    - CSS rules `.add-catchup-cta`, `.add-catchup-h`, `.add-catchup-body` present.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: HUMAN-VERIFY — Carry-over UAT bug closure (.detail-close position:fixed in Library/Queue context)</name>
  <what-built>
    PATTERNS.md §16 reports `.detail-close{position:fixed}` is already at css/app.css:1540 with explanatory comment. Carry-over CONTEXT.md UAT bug: "When clicking a show in here it wasn't easy to click out — ✕ scrolls out of view on long detail content," reported in Library/Queue context. Task 5 verifies the existing fix actually covers the reported context (vs. a different scroll container that bypasses the fix).
  </what-built>
  <how-to-verify>
    1. Deploy current main + Phase-14-05 changes to staging (or run locally).
    2. Sign in. Navigate to the Library tab. Set the filter to `myqueue`.
    3. Tap a title with a long detail body (lots of cast + reviews — Task 3 just added these so they should be present).
    4. Detail modal opens. Scroll the modal body down past the trailer / providers sections.
    5. Verify: the ✕ close button STAYS visible at the top-right of the viewport at all scroll positions.
    6. If the ✕ disappears mid-scroll: a different scroll container is involved. Inspect with devtools to find the scroll container and the close-button positioning ancestor — the fix needs extension (e.g. additional `.library-detail .detail-close{position:fixed}` rule, or a different containment strategy).
    7. Repeat with the same title from the Tonight tab + Add tab to confirm the fix is consistent across entry points.
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "closed: existing fix covers Library/Queue" — SUMMARY records bug closed by pre-existing CSS at line 1540; no new code change.
    - "extend: <details>" — describe the failure mode + which selector needs the fix. The plan executor adds the targeted CSS extension and reruns Task 5.
    - "out-of-context" — reported context is unreproducible / no longer present (perhaps the Library tab has been redesigned). SUMMARY records the closure with rationale.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → TMDB API | Cast + Reviews fetch consumes TMDB rate budget (~40 req / 10s). Lazy fetch on detail-modal open + per-title cache via t.castFetchedAt + t.reviewsFetchedAt timestamps |
| user input → tile rendering | Title names, member names rendered into HTML; escapeHtml() must be applied at every interpolation site |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.05-01 | Cross-Site Scripting | TMDB review content rendered into modal body without escape | mitigate | escapeHtml() applied to r.content + r.author + p.name + p.character — explicit in Task 3 markup |
| T-14.05-02 | DoS (TMDB rate limit) | Detail-modal opens for many titles cascade fetches and exhaust TMDB budget | mitigate | Per-title fetch gated on `castFetchedAt`/`reviewsFetchedAt` timestamps — re-open is a no-op |
| T-14.05-03 | Information Disclosure | TMDB API key already client-side per CLAUDE.md "public-by-design" | accept | Project decision — TMDB key embedded in client intentionally; no security benefit from server-side proxy |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `grep -c "tc-want-pill" js/app.js` → ≥1.
- `grep -c "tc-want-pill" css/app.css` → ≥1.
- `grep -c "openTileActionSheet('${t.id}',event)" js/app.js` → ≥1 (tile body wire-up).
- `grep -c "window.openTileActionSheet" js/app.js` → 1.
- `grep -c "renderDetailCastSection" js/app.js` → ≥1.
- `grep -c "Catch up on votes" js/app.js` → ≥1.
- `grep -c "openVoteModal()" js/app.js` → ≥1 (Catch-up CTA invocation).
- Existing openActionSheet at js/app.js:11853 unchanged (verifiable via git diff).
- Task 5 checkpoint resolved with one of {closed, extend: ..., out-of-context}.
</verification>

<success_criteria>
1. Tile face shows "X want it" pill (3 micro-avatars + +N), ▶ Trailer button (when t.trailerKey exists), and NO Vote button.
2. Tap on tile body opens openTileActionSheet (4 D-04 buckets); ⋯ button still opens full openActionSheet.
3. Detail modal surfaces cast + reviews (lazy-fetched from TMDB on first open) in addition to existing trailer + providers + synopsis.
4. Add tab shows "Catch up on votes (N)" CTA when unvoted count ≥ 10; tap launches existing openVoteModal.
5. Carry-over UAT bug verified closed (Task 5 checkpoint).
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-05-SUMMARY.md` documenting:
- card(t) modification line numbers + diff summary.
- openTileActionSheet insertion file:line.
- Detail-modal renderer location + which sections were ALREADY present vs. NEWLY added.
- Add-tab renderer location + Catch-up CTA insertion site.
- Task 5 carry-over bug resolution + any CSS extensions applied.
</output>
