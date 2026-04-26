---
phase: 14-decision-ritual-core
plan: 04
type: execute
wave: 1
depends_on: []
files_modified:
  - js/app.js
  - js/state.js
  - css/app.css
  - app.html
autonomous: false
requirements_addressed: [DECI-14-06]
must_haves:
  truths:
    - "renderCouchViz() injects two elements into #couch-viz-container: a hero <img src='/mark-512.png'> and a CSS-grid avatar layer with cushionCount cells (filled = .seat-avatar with member color + initial; empty = .seat-empty with ＋ glyph + pulse animation)."
    - "claimCushion(idx) writes state.couchMemberIds (adds state.me.id at slot idx if empty; toggles off if already claimed by state.me); persists to family doc field families/{code}.couchSeating: { [memberId]: index }."
    - "openCouchOverflowSheet() opens a member-picker via existing #action-sheet-bg primitive at js/app.js:11853 — used only when claimCushion fails (e.g., shared-device 'sit on behalf of' use case). Adaptive grid up to 10 spots means overflow is rare; primarily a fallback affordance."
    - "Hero icon element uses <img src='/mark-512.png' alt='Couch'> — no SVG generation. Production swap = update mark-512.png in queuenight/public/; Tonight tab inherits automatically."
    - "Avatar grid wraps to 5×2 on phone, 10×1 on wider viewports via CSS grid auto-fill. Each grid cell ≥44×44pt at iPhone-SE width (375px / 5 cols ≈ 75px-wide cells)."
    - "Couch viz is rendered into a new container element on the Tonight tab (id='couch-viz-container'); render is gated by app.html surfacing the container."
    - "couchSeating Firestore writes carry writeAttribution() — required by attributedWrite() rules helper."
    - "Capacity is 1-10 native (D-06's 2-8 cap loosened per sketch 001 outcome — grid handles arbitrary count cleanly)."
  artifacts:
    - path: "js/app.js"
      provides: "renderCouchViz + renderCouchAvatarGrid + claimCushion + openCouchOverflowSheet + persistCouchSeating + Tonight-tab render hook + family-doc snapshot hydration"
      contains: "function renderCouchViz("
      min_lines_added: 110
    - path: "js/state.js"
      provides: "state.couchMemberIds slot declaration"
      contains: "couchMemberIds"
    - path: "css/app.css"
      provides: "couch-viz-container + hero-icon + avatar-grid + seat-avatar + seat-empty rules"
      contains: ".couch-viz-container"
      min_lines_added: 70
    - path: "app.html"
      provides: "<div id='couch-viz-container'> on Tonight tab"
      contains: "couch-viz-container"
  key_links:
    - from: "Flow A picker UI in 14-07 (downstream)"
      to: "state.couchMemberIds populated by claimCushion"
      via: "shared state read"
      pattern: "state\\.couchMemberIds"
    - from: "isWatchedByCouch helper in 14-01 (foundation)"
      to: "state.couchMemberIds (used as the second arg)"
      via: "shared state read"
      pattern: "state\\.couchMemberIds"
---

<objective>
Build the Tonight tab's "Who's on the couch tonight?" centerpiece per D-06 (DECI-14-06), using the **hero-icon + avatar-grid pattern** locked by sketch 001 (.planning/sketches/001-couch-shape/, winner Variant P).

**Approach (NEW per sketch 001 outcome — supersedes original D-06 plan to procedurally render an inline SVG sofa):** Use the existing app icon (`/mark-512.png` in production, the C-sectional couch image) as a brand hero element at the top, with a CSS-grid avatar layer below showing "On the couch tonight · {N} of {couchSize} here" + filled/empty seat cells. Members claim seats by tapping empty cells; persistence + state shape unchanged from the original plan.

Purpose: The Couch viz is the centerpiece of Phase 14's redesign — it's the affordance that makes "who's on the couch tonight" tangible instead of a checkbox list. It writes state.couchMemberIds, which 14-01 (already-watched filter), 14-03 (tier aggregators), and 14-07 (Flow A picker) all consume. Without this plan, the entire decision ritual has no input source for "couch composition."

Output: New `renderCouchViz()` + `renderCouchAvatarGrid()` + `claimCushion(idx)` + `openCouchOverflowSheet()` + `persistCouchSeating()` in js/app.js; the persistence writer for `families/{code}.couchSeating`; the CSS for hero-icon + grid styling; the Tonight-tab container in app.html.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 1 (independent of 14-01/14-02/14-06). 14-07 (Flow A) hard-depends on this plan for state.couchMemberIds.

**Two-repo discipline:** Couch-side only. couchSeating is a NEW field on the family doc — firestore.rules MAY need a tiny widening (Task 4 audits and updates if needed).

**Sketch-driven design:** The original D-06 plan deferred to /gsd-sketch for visual treatment. **That sketch round (001) ran 2026-04-25 and concluded** that the right architecture is hero-icon + avatar-grid (NOT a procedural SVG sofa). This plan implements the locked direction. No further sketch checkpoint needed.

**Brand asset:** Currently uses the existing `mark-512.png` in `queuenight/public/`. A Fiverr-commissioned brand refresh (Standard, ETA 2026-04-28) may deliver a new icon. Because this plan references the file by path (`/mark-512.png`), the new icon will swap in transparently when production deploys with the updated PNG — zero code change required.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@.planning/sketches/001-couch-shape/README.md
@.planning/sketches/001-couch-shape/index.html
@CLAUDE.md

<interfaces>
**Existing inline DOM onclick pattern** at js/app.js:4469 + js/app.js:4482 — Couch's pervasive idiom. New avatar grid cells follow the same shape:
```js
return `<div class="seat-cell" role="button" tabindex="0"
  onclick="claimCushion(${idx})"
  onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();claimCushion(${idx});}">
```

**Existing action-sheet primitive** at js/app.js:11853 (`window.openActionSheet`) — reuse #action-sheet-bg + #action-sheet-content for the overflow / "claim on behalf of" sheet.

**Existing applyVote attribution write pattern** at js/app.js:12325ff (per-member-keyed map writes on family-scoped docs):
```js
await updateDoc(doc(membersRef(), state.me.id), {
  [`some.path.${memberId}`]: value,
  ...writeAttribution()
});
```

**Family doc reference** — `state.familyCode` provides the family code; `doc(db, 'families', state.familyCode)` resolves the family doc reference.

**Existing app icon path** — `app.html` already references `/mark-512.png` (and other sizes) for favicons + PWA manifest. The Tonight tab hero re-uses the same asset path.

**Sketch 001 reference** — `.planning/sketches/001-couch-shape/index.html` Variant P is the canonical visual reference. The HTML/CSS in that sketch is production-aligned (uses Fraunces + Inter, brand color palette, `--color-bg`/`--color-text`/etc. tokens). Executor should pattern-match the sketch's avatar grid styling.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Declare state.couchMemberIds slot in js/state.js</name>
  <files>js/state.js</files>
  <read_first>
    - js/state.js (full file — small per CLAUDE.md, "9 lines, read in full")
  </read_first>
  <action>
1. Read js/state.js in full.

2. Add `couchMemberIds: []` to the existing state object literal. If the existing state already has a default empty-list slot for similar collections (e.g. `members: []`), match the formatting verbatim.

3. Do NOT introduce any new export — couchMemberIds rides the existing `state` object that's already exported.

4. Add a one-line comment: `// D-06 (DECI-14-06) — couch composition; written by claimCushion in js/app.js`.
  </action>
  <verify>
    <automated>node --check js/state.js && grep -c "couchMemberIds" js/state.js</automated>
    Expect: `node --check` exits 0; grep returns ≥1.
  </verify>
  <done>
    - js/state.js declares `couchMemberIds: []` on the state object.
    - Comment marker present for grep traceability.
    - File parses with `node --check`.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add renderCouchViz + renderCouchAvatarGrid + claimCushion + handlers to js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 4460-4490 (analog: card(t) inline-onclick render pattern)
    - js/app.js lines 11853-11900 (analog: openActionSheet primitive — reused for overflow sheet)
    - js/app.js lines 11920-11940 (analog: existing avatar markup patterns; Grep `who-avatar` and `memberColor(`)
    - js/app.js lines 12325-12390 (analog: per-member-keyed map write pattern with writeAttribution)
    - .planning/sketches/001-couch-shape/index.html (canonical visual + behavior reference — Variant P; copy CSS class structure verbatim where possible)
    - .planning/sketches/001-couch-shape/README.md (winner-direction spec + icon-swap convention)
  </read_first>
  <action>
1. Locate a good insertion point. The renderer + handlers are best co-located near other tonight-tab render code. Grep for `renderTonight` or pick a location ~50 lines above `openActionSheet` at js/app.js:11853 (so all action-sheet code stays grouped). Capture insertion line in SUMMARY.

2. Insert this block verbatim:

```js
// === D-06 Couch viz — DECI-14-06 (sketch 001 winner: hero-icon + avatar-grid) ===
// Hero element: <img src='/mark-512.png'> (the existing C-sectional app icon — same asset
// used by favicons + PWA manifest). When the icon is updated in queuenight/public/, this
// hero auto-inherits with zero code change.
//
// Functional layer: CSS-grid avatar cells. Filled = colored circle with initial; empty =
// dashed amber circle with ＋ glyph + pulse animation. Capacity 1-10 native.
//
// State writes: families/{code}.couchSeating = { [memberId]: index }.

const COUCH_HERO_SRC = '/mark-512.png'; // single source of truth — bump if filename changes
const COUCH_MAX_SLOTS = 10;             // grid wraps to 5×2 on phone, 10×1 on wide viewports

function renderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;

  const totalMembers = (state.members || []).length;
  // Couch size = max(2, totalMembers, current claimed count) — at least 2 because couch is plural.
  // Cap at COUCH_MAX_SLOTS.
  const claimedCount = (state.couchMemberIds || []).filter(Boolean).length;
  const couchSize = Math.min(COUCH_MAX_SLOTS, Math.max(2, totalMembers, claimedCount));

  container.innerHTML = `
    <img class="couch-hero" src="${COUCH_HERO_SRC}" alt="Couch" />
    <h3 class="couch-headline">On the couch tonight</h3>
    <p class="couch-sub">${claimedCount > 0 ? `${claimedCount} of ${couchSize} here` : 'Tap a seat to claim it'}</p>
    ${renderCouchAvatarGrid(couchSize)}
  `;
}

function renderCouchAvatarGrid(couchSize) {
  const cells = [];
  for (let i = 0; i < couchSize; i++) {
    const mid = (state.couchMemberIds || [])[i] || null;
    if (mid) {
      const m = (state.members || []).find(x => x.id === mid);
      const initial = m ? escapeHtml((m.name || '?')[0].toUpperCase()) : '?';
      const name = m ? escapeHtml(m.name || 'Member') : 'Unknown';
      const color = m ? memberColor(m.id) : '#7a705f';
      const isMe = state.me && mid === state.me.id;
      cells.push(`
        <div class="seat-cell ${isMe ? 'me' : ''}" data-cushion-idx="${i}" role="button" tabindex="0"
          aria-label="${name} on the couch — tap to vacate"
          onclick="claimCushion(${i})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();claimCushion(${i});}">
          <div class="seat-avatar" style="background:${color}">${initial}</div>
          <div class="seat-name">${name}</div>
        </div>
      `);
    } else {
      cells.push(`
        <div class="seat-cell empty" data-cushion-idx="${i}" role="button" tabindex="0"
          aria-label="Empty seat — tap to claim"
          onclick="claimCushion(${i})"
          onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();claimCushion(${i});}">
          <div class="seat-empty">＋</div>
          <div class="seat-name" aria-hidden="true">·</div>
        </div>
      `);
    }
  }
  return `<div class="couch-avatar-grid" role="group" aria-label="Couch seats">${cells.join('')}</div>`;
}

// D-06 — claim a cushion seat. Adds state.me.id to state.couchMemberIds at index idx
// (if empty); toggles off if already claimed by state.me. Persists to family doc.
window.claimCushion = async function(idx) {
  if (!state.me) { flashToast('Sign in to seat yourself', { kind: 'warn' }); return; }
  // Ensure array length covers idx.
  while (state.couchMemberIds.length <= idx) state.couchMemberIds.push(null);
  const current = state.couchMemberIds[idx] || null;
  // Toggle off if I'm sitting there.
  if (current === state.me.id) {
    state.couchMemberIds[idx] = null;
    while (state.couchMemberIds.length && state.couchMemberIds[state.couchMemberIds.length - 1] == null) {
      state.couchMemberIds.pop();
    }
    await persistCouchSeating();
    renderCouchViz();
    return;
  }
  if (current) {
    flashToast('That seat is already claimed', { kind: 'info' });
    return;
  }
  // Take the slot. If state.me is already at another slot, vacate that one first (no clones).
  const existingIdx = state.couchMemberIds.findIndex(mid => mid === state.me.id);
  if (existingIdx >= 0) state.couchMemberIds[existingIdx] = null;
  state.couchMemberIds[idx] = state.me.id;
  await persistCouchSeating();
  renderCouchViz();
};

// D-06 — overflow / "sit on behalf of" sheet. Opens member picker via #action-sheet-bg.
// Used when grid is full OR for shared-device "claim a seat for another member" cases.
window.openCouchOverflowSheet = function() {
  const content = document.getElementById('action-sheet-content');
  if (!content) return;
  const seated = new Set((state.couchMemberIds || []).filter(Boolean));
  const items = (state.members || [])
    .filter(m => !seated.has(m.id))
    .map(m =>
      `<button class="action-sheet-item" onclick="closeActionSheet();claimCushionByMember('${m.id}')">
        <div class="who-avatar" style="background:${memberColor(m.id)};display:inline-block;margin-right:8px">${escapeHtml((m.name||'?')[0])}</div>
        ${escapeHtml(m.name || 'Member')}
      </button>`
    );
  content.innerHTML = `<div class="action-sheet-title">Add to couch</div>${items.join('') || '<div class="action-sheet-item" style="opacity:0.6">Everyone is on the couch</div>'}`;
  document.getElementById('action-sheet-bg').classList.add('on');
};

// D-06 — claim a cushion on behalf of a specific member (used by overflow sheet).
window.claimCushionByMember = async function(memberId) {
  if (!memberId) return;
  let firstEmpty = -1;
  for (let i = 0; i < COUCH_MAX_SLOTS; i++) {
    if (!state.couchMemberIds[i]) { firstEmpty = i; break; }
  }
  if (firstEmpty < 0) {
    flashToast('Couch is full', { kind: 'warn' });
    return;
  }
  state.couchMemberIds[firstEmpty] = memberId;
  await persistCouchSeating();
  renderCouchViz();
};

// D-06 — persist couchSeating map to family doc.
// Shape: families/{code}.couchSeating = { [memberId]: index }; null/missing = not seated.
async function persistCouchSeating() {
  if (!state.familyCode) return;
  const map = {};
  (state.couchMemberIds || []).forEach((mid, i) => { if (mid) map[mid] = i; });
  try {
    await updateDoc(doc(db, 'families', state.familyCode), {
      couchSeating: map,
      ...writeAttribution()
    });
  } catch (e) {
    console.error('[couch] persist failed', e);
    flashToast('Could not save couch — try again', { kind: 'warn' });
  }
}
```

3. Wire `renderCouchViz()` into the existing Tonight tab render path. Grep for `function renderTonight` or `tab === 'tonight'` to locate. Add `renderCouchViz();` call AFTER the existing innerHTML-set so the container is in DOM by the time the call fires.

4. Hydrate `state.couchMemberIds` from family doc on family load. Grep for the existing onSnapshot listener for the family doc (probably near `state.unsubFamily` or similar). Inside the snapshot handler, after `state.family = snap.data()`, add:

```js
// D-06 — hydrate couch seating from family doc into the indexed-array state shape.
const seating = (snap.data() && snap.data().couchSeating) || {};
const couchArr = [];
Object.entries(seating).forEach(([mid, idx]) => { couchArr[idx] = mid; });
state.couchMemberIds = couchArr;
if (typeof renderCouchViz === 'function') renderCouchViz();
```

5. Confirm `db`, `doc`, `updateDoc`, `writeAttribution`, `flashToast`, `escapeHtml`, `memberColor` are all already imported in js/app.js. If not, add to the existing import statement (do NOT introduce a build step).
  </action>
  <verify>
    <automated>node --check js/app.js && grep -cE "function (renderCouchViz|renderCouchAvatarGrid|persistCouchSeating)\\(|window\\.claimCushion =|window\\.openCouchOverflowSheet =|window\\.claimCushionByMember =" js/app.js</automated>
    Expect: `node --check` exits 0; grep returns `6` (3 named functions + 3 window assignments).
  </verify>
  <done>
    - All 6 functions/handlers present in js/app.js exactly once each.
    - renderCouchViz called from at least 1 site (Tonight render path) and from claimCushion / claimCushionByMember after mutations.
    - Family doc onSnapshot hydrates state.couchMemberIds.
    - persistCouchSeating writes carry writeAttribution().
    - `node --check js/app.js` exits 0.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Add #couch-viz-container to app.html (Tonight tab) + CSS rules to css/app.css</name>
  <files>app.html, css/app.css</files>
  <read_first>
    - app.html (full file — ~990 lines per CLAUDE.md, safe to read in full)
    - css/app.css lines 1-60 (token primitives — colors / radius / shadow tokens)
    - .planning/sketches/001-couch-shape/index.html lines 60-180 (canonical CSS for hero-icon-wrap + avatar-grid + seat-cell + seat-empty — copy as starting point and adapt to production token names)
  </read_first>
  <action>
1. **app.html** — locate the Tonight tab section (grep for `id="tab-tonight"` or `data-tab="tonight"` or `<section.*tonight`). Insert a new container element near the top of the Tonight tab content, ABOVE existing surfaces (the couch viz is the new centerpiece):

```html
<!-- D-06 (DECI-14-06) — Couch viz centerpiece. Rendered by renderCouchViz() in js/app.js. -->
<div id="couch-viz-container" class="couch-viz-container" aria-label="Who's on the couch tonight"></div>
```

2. **css/app.css** — append a new section near the bottom (or near other Tonight-tab classes if a section exists). Pattern-match the sketch 001 CSS at .planning/sketches/001-couch-shape/index.html lines 60-180 — same class names, adapt color refs to existing CSS variables in css/app.css:

```css
/* === D-06 Couch viz — DECI-14-06 (hero-icon + avatar-grid pattern, sketch 001 winner P) === */

.couch-viz-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 480px;
  margin: var(--s4) auto;
  padding: var(--s2);
}

.couch-hero {
  display: block;
  width: 100%;
  max-width: 280px;
  aspect-ratio: 1;
  border-radius: 22px;
  margin-bottom: var(--s3);
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.55), 0 0 0 1px var(--c-border-soft, #2a241f);
  /* Subtle warm halo around the hero (firelight) — fades into the dark bg */
  background:
    radial-gradient(ellipse at center, rgba(217, 122, 60, 0.10) 0%, transparent 65%);
  background-size: 140% 140%;
  background-position: center;
}

.couch-headline {
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-size: var(--text-xl, 1.4rem);
  font-weight: 500;
  letter-spacing: -0.015em;
  color: var(--c-text, #f5ede1);
  margin: 0 0 var(--s1) 0;
  text-align: center;
}

.couch-sub {
  font-family: var(--font-serif, 'Instrument Serif', Georgia, serif);
  font-style: italic;
  color: var(--c-text-muted, #b3a797);
  font-size: var(--text-base, 1rem);
  margin: 0 0 var(--s4) 0;
  text-align: center;
}

.couch-avatar-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: var(--s3);
  width: 100%;
  max-width: 380px;
}

@media (min-width: 768px) {
  .couch-avatar-grid {
    /* On wider viewports, lay out the row (up to 10 wide) */
    grid-template-columns: repeat(10, 1fr);
    max-width: 720px;
  }
}

.seat-cell {
  position: relative;
  aspect-ratio: 1;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: transform 180ms var(--ease-out, ease-out);
}
.seat-cell:hover, .seat-cell:focus-visible { transform: scale(1.06); }
.seat-cell:focus-visible { outline: 2px solid var(--c-warm-amber, #d4a574); outline-offset: 4px; border-radius: 50%; }

.seat-avatar {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-text-on-avatar, #fff);
  font-family: var(--font-display, 'Fraunces', Georgia, serif);
  font-weight: 500;
  font-size: clamp(15px, 3.2vw, 22px);
  border: 2.5px solid var(--c-bg, #14110f);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.55);
}

.seat-cell.me .seat-avatar {
  outline: 2px solid var(--c-warm-amber, #d4a574);
  outline-offset: 2px;
}

.seat-empty {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 50%;
  border: 2px dashed var(--c-warm-amber, #d4a574);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--c-warm-amber, #d4a574);
  font-family: var(--font-body, Inter, sans-serif);
  font-size: clamp(20px, 4vw, 32px);
  font-weight: 300;
  background: radial-gradient(circle at center, rgba(217, 122, 60, 0.12), transparent 70%);
  animation: couch-empty-pulse 2.4s ease-in-out infinite;
  transition: border-color 180ms var(--ease-out, ease-out);
}
.seat-cell:hover .seat-empty,
.seat-cell:focus-visible .seat-empty {
  border-style: solid;
}

.seat-name {
  margin-top: var(--s1);
  font-family: var(--font-body, Inter, sans-serif);
  font-size: 10px;
  color: var(--c-text-muted, #b3a797);
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  /* Truncate to keep grid cells tight */
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@keyframes couch-empty-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217, 122, 60, 0); }
  50%      { box-shadow: 0 0 18px 0 rgba(217, 122, 60, 0.35); }
}

@media (prefers-reduced-motion: reduce) {
  .seat-empty { animation: none; }
  .seat-cell, .seat-cell:hover, .seat-cell:focus-visible { transition: none; transform: none; }
}
```

3. If any of the CSS variable names (`--c-warm-amber`, `--c-text-on-avatar`, etc.) don't exist in the existing token layer, either (a) add them to the token block at the top of css/app.css using BRAND.md values OR (b) inline hardcoded fallbacks (already provided in the snippet above as the second arg of `var()`).
  </action>
  <verify>
    <automated>grep -c "couch-viz-container" app.html && grep -c "\.couch-viz-container" css/app.css && grep -c "\.couch-hero" css/app.css && grep -c "\.couch-avatar-grid" css/app.css && grep -c "\.seat-cell" css/app.css && grep -c "\.seat-empty" css/app.css</automated>
    Expect: each grep returns ≥1.
  </verify>
  <done>
    - app.html contains `<div id="couch-viz-container">` exactly once on the Tonight tab.
    - css/app.css contains `.couch-viz-container`, `.couch-hero`, `.couch-headline`, `.couch-sub`, `.couch-avatar-grid`, `.seat-cell`, `.seat-avatar`, `.seat-empty`, `.seat-name` rules.
    - prefers-reduced-motion block disables pulse + hover transitions.
    - All CSS uses tokens (or hardcoded fallbacks) — no inline styles in app.html.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 4: Audit + extend firestore.rules for couchSeating field on family doc updates</name>
  <files>firestore.rules</files>
  <read_first>
    - firestore.rules — grep for `match /families/{familyCode}` to locate the family-doc rule block; read 50 lines around it
  </read_first>
  <action>
1. Grep firestore.rules for `match /families/{familyCode}` (NOT inside a subcollection match). Read the surrounding 50 lines.

2. Determine if family-doc updates are restricted by `affectedKeys().hasOnly([...])`:
   - **Case A** — allowlist exists: add `'couchSeating'` to the allowed-keys list. Add the same attribution allowance pattern (`'actingUid','managedMemberId','memberId','memberName'`) if not already present.
   - **Case B** — permissive update rule (any member of family can write any field): no change needed; document with comment marker `// D-06: couchSeating permitted by existing permissive family-doc update rule`.

3. Confirm the rule still requires `attributedWrite(familyCode)` — couchSeating writes carry writeAttribution() per Task 2.

4. If a tests/rules.test.js exists with family-doc write tests, add a sibling test case proving a couchSeating write succeeds. Out of scope to scaffold the test suite from scratch.
  </action>
  <verify>
    <automated>grep -c "couchSeating" firestore.rules</automated>
    Expect: ≥1 (allowlist mention OR comment marker).
  </verify>
  <done>
    - firestore.rules either explicitly allows `couchSeating` in family-doc affectedKeys list OR carries a comment documenting permissive coverage.
    - Existing rule semantics (member-of-family + attributedWrite) preserved verbatim.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5: HUMAN-VERIFY — Couch viz works on Tonight tab + iOS PWA</name>
  <what-built>
    Tasks 1-4 ship the Tonight-tab Couch viz: hero icon (existing app icon at /mark-512.png) + headline + sub-count + 5×2 (mobile) / 10×1 (desktop) avatar grid + claim/overflow handlers + persistence + rules widening. No procedural SVG — sketch 001 outcome locked the hero+grid pattern.
  </what-built>
  <how-to-verify>
    1. Deploy current main to staging (`bash scripts/deploy.sh 14-04-couch-preview`) OR run locally.
    2. Open the Tonight tab. Confirm:
       - Couch viz renders above existing surfaces.
       - Hero icon (the current C-sectional couch image) appears at top with subtle warm halo + drop shadow.
       - Headline "On the couch tonight" + sub-count "{N} of {couchSize} here" present.
       - Avatar grid below shows cells matching couchSize (max(2, totalMembers, claimedCount), capped at 10).
       - Tapping an empty cell claims it for state.me; cell flips to filled (member-color circle + initial); the "me" cell has a warm-amber outline.
       - Tapping my own claimed cell vacates it.
       - Tapping someone else's claimed cell shows toast "That seat is already claimed".
       - Refresh — couch state persists (couchSeating doc field round-trips).
       - On iPhone Safari (browser + installed PWA): cell tap targets feel ≥44pt; tap latency is acceptable; pulse animation on empty cells doesn't drain battery.
       - prefers-reduced-motion: User Settings → Accessibility → Reduce Motion ON → empty-cell pulse stops, hover scale stops.
    3. Visual sanity check: hero icon does NOT look pixelated at the rendered size; the icon's existing dark-warm surroundings blend cleanly with the page bg (no harsh edges where the icon ends).
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "approved" — viz ships as-is for v34. SUMMARY records the rendering insertion sites.
    - "refine: <details>" — specify visual changes to apply (e.g., bigger hero, smaller grid cells, different halo). The plan executor edits Task 2 markup or Task 3 CSS to match. Re-run Task 5 once changes are in.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → family doc | New couchSeating field widens the family-doc update surface; firestore.rules must permit |
| inline DOM event binding | onclick handlers are window-scoped; XSS surface IFF a member name reaches the grid markup without escaping (mitigated by escapeHtml on all member-name interpolations) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.04-01 | Tampering | A member writes couchSeating to plant a fake "claim" by another member | mitigate | writeAttribution() spread enforces actor-uid; Phase 5 attribution rules already check `request.auth.uid == request.resource.data.actingUid` (or equivalent legacy member-id check). Server-side validation lives in attributedWrite() helper; this plan inherits it. |
| T-14.04-02 | Information Disclosure | couchSeating exposes co-presence ("Mom and Dad are on the couch right now") | accept | Family-scoped read; only family members can read the family doc. Co-presence within a family is the intended UX, not a leak. |
| T-14.04-03 | Cross-Site Scripting | Member name rendered into grid markup without escape | mitigate | escapeHtml() applied to all member-name interpolations in renderCouchAvatarGrid + openCouchOverflowSheet (acceptance criterion). |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `node --check js/state.js` → exit 0.
- `grep -c "function renderCouchViz(" js/app.js` → 1.
- `grep -c "function renderCouchAvatarGrid(" js/app.js` → 1.
- `grep -c "window.claimCushion = " js/app.js` → 1.
- `grep -c "window.openCouchOverflowSheet = " js/app.js` → 1.
- `grep -c "function persistCouchSeating(" js/app.js` → 1.
- `grep -c "couch-viz-container" app.html` → ≥1.
- `grep -c "\.couch-viz-container" css/app.css` → ≥1.
- `grep -c "\.couch-hero" css/app.css` → ≥1.
- `grep -c "\.seat-cell" css/app.css` → ≥1.
- `grep -c "couchSeating" firestore.rules` → ≥1.
- `grep -c "writeAttribution()" js/app.js` near persistCouchSeating → ≥1.
- `grep -c "/mark-512.png" js/app.js` → ≥1 (COUCH_HERO_SRC constant references the existing favicon path).
- `grep -c "renderCouchViz" js/app.js` → ≥3 (declaration + Tonight render hook + family snapshot hydration).
- Task 5 checkpoint resolved with one of {approved, refine: ...}.
</verification>

<success_criteria>
1. Couch viz renders on Tonight tab with hero icon + headline + sub-count + adaptive avatar grid (1-10 spots).
2. Tapping an empty cell seats state.me; tapping a claimed-by-me cell vacates; "claim on behalf of" via overflow sheet works.
3. couchSeating persists to family doc with proper attribution.
4. state.couchMemberIds is hydrated on family-doc snapshot — downstream consumers (14-01 isWatchedByCouch, 14-03 tier aggregators, 14-07 Flow A) see live data.
5. Hero icon swap is one-step (replace `mark-512.png` in queuenight/public/) with zero code change required.
6. prefers-reduced-motion respected (no empty-cell pulse, no hover scale).
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-04-SUMMARY.md` documenting:
- Insertion file:line for renderCouchViz + claim handlers.
- Tonight-tab render hook integration site.
- Family-doc snapshot hydration site.
- firestore.rules case applied (A or B).
- Task 5 checkpoint resolution.
- **Approach note:** Original plan called for procedural inline-SVG `renderCouchSvg()`. Sketch 001 (.planning/sketches/001-couch-shape/) concluded that hero-icon + avatar-grid is the right architecture. This plan implements that direction; the original SVG renderer was never built.
</output>
    <automated>grep -c "couch-viz-container" app.html && grep -c "\\.couch-viz-container" css/app.css && grep -c "\\.couch-hero" css/app.css && grep -c "\\.couch-avatar-grid" css/app.css && grep -c "\\.seat-cell" css/app.css && grep -c "\\.seat-empty" css/app.css