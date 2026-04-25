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
    - "renderCouchSvg(seatCount) returns inline-SVG markup string with N cushions where N = clamp(seatCount, 2, 8); when seatCount > 7, the 8th cushion is the +N-more overflow cushion (NOT an individual seat)."
    - "Each cushion <g> element has tabindex='0', role='button', and an inline onclick='claimCushion(idx)' OR onclick='openCouchOverflowSheet()' (overflow case) — no addEventListener post-render (S4 inline-handler pattern)."
    - "claimCushion(idx) writes state.couchMemberIds (adds state.me.id at slot idx if empty; toggles off if already claimed by state.me); persists to family doc field families/{code}.couchSeating: { [memberId]: true }."
    - "openCouchOverflowSheet() reuses the existing #action-sheet-bg primitive at js/app.js:11853 — does NOT create a new sheet DOM."
    - "SVG uses viewBox='0 0 800 280' with preserveAspectRatio='xMidYMid meet'; cushion <g> hit areas are ≥44×44pt at iPhone-SE viewport width (375px); avatars composited as DOM <img> overlay positioned over SVG (NOT in-SVG <image href>) per RESEARCH §4 iOS caching guidance."
    - "Couch viz is rendered into a new container element on the Tonight tab (id='couch-viz-container'); render is gated by app.html surfacing the container."
    - "couchSeating Firestore writes carry writeAttribution() — required by attributedWrite() rules helper."
  artifacts:
    - path: "js/app.js"
      provides: "renderCouchSvg + claimCushion + openCouchOverflowSheet + Tonight-tab render hook"
      contains: "function renderCouchSvg("
      min_lines_added: 120
    - path: "js/state.js"
      provides: "state.couchMemberIds slot declaration (writer)"
      contains: "couchMemberIds"
    - path: "css/app.css"
      provides: "couch-svg + cushion + couch-avatar-overlay rules"
      contains: ".couch-svg"
      min_lines_added: 60
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
Build the SVG sofa visualization per D-06. Procedural inline SVG renderer with adaptive seat count (2-8), per-cushion event binding for "claim seat" / "+N overflow", iOS-Safari-safe rendering (viewBox scaling, ≥44pt targets, no SVG filters, DOM-overlay avatars). Visual treatment was deferred to /gsd-sketch — this plan ships the SHAPE; the styling is open to refinement once /gsd-sketch round runs.

Purpose: The Couch viz is the centerpiece of Phase 14's redesign — it's the affordance that makes "who's on the couch tonight" tangible instead of a checkbox list. It also writes state.couchMemberIds, which 14-01 (already-watched filter), 14-03 (tier aggregators), and 14-07 (Flow A picker) all consume. Without this plan, the entire decision ritual has no input source for "couch composition."

Output: New `renderCouchSvg(seatCount)` + `claimCushion(idx)` + `openCouchOverflowSheet()` in js/app.js, the persistence writer for `families/{code}.couchSeating`, the CSS for cushion styling + avatar overlay, the Tonight-tab container in app.html, and a sketch-driven visual checkpoint.
</objective>

<execution_context>
Phase 14 — Decision Ritual Core. Wave 2 (independent of 14-01..14-03 in code dependency, but lives in Wave 2 to keep Wave 1 lightweight). 14-07 (Flow A) hard-depends on this plan for state.couchMemberIds.

**Two-repo discipline:** Couch-side only. couchSeating is a NEW field on the family doc — firestore.rules MAY need a tiny widening if the family-doc update rule is allowlist-restricted (Task 4 audits and updates if needed).

**Sketch-driven design:** D-06 explicitly defers visual treatment to /gsd-sketch (Anti-pattern #6). This plan implements the structural shape (cushion count, hit-target sizing, event binding, persistence) with placeholder geometry. Task 5 is a checkpoint where the user confirms the visual shape is acceptable OR provides /gsd-sketch outputs to refine.
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/14-decision-ritual-core/14-CONTEXT.md
@.planning/phases/14-decision-ritual-core/14-RESEARCH.md
@.planning/phases/14-decision-ritual-core/14-PATTERNS.md
@CLAUDE.md

<interfaces>
**Existing inline DOM onclick pattern** at js/app.js:4469 + js/app.js:4482 — Couch's pervasive idiom. New SVG cushions follow the same shape:
```js
return `<div class="tc..." role="button" tabindex="0"
  aria-label="${escapeHtml(t.name)}..."
  onclick="openDetailModal('${t.id}')"
  onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();openDetailModal('${t.id}');}">
```

**Existing action-sheet primitive** at js/app.js:11853 (`window.openActionSheet`) — reuse #action-sheet-bg + #action-sheet-content for the +N overflow sheet. Setting `content.innerHTML` then toggling `#action-sheet-bg.classList.add('on')` is the open contract.

**Existing applyVote attribution write pattern** at js/app.js:12325ff (per-member-keyed map writes on family-scoped docs):
```js
await updateDoc(doc(membersRef(), state.me.id), {
  [`some.path.${memberId}`]: value,
  ...writeAttribution()
});
```

**Family doc reference** — `state.familyCode` provides the family code; `doc(db, 'families', state.familyCode)` resolves the family doc reference. Existing writes to family-doc fields likely already exist (search `doc(db, 'families', state.familyCode)` to find).

**RESEARCH §4 iOS PWA gotchas** (re-stated for in-task use):
- Touch target ≥44×44pt at iPhone-SE width (375px). 8 cushions in 800-unit viewBox → each cushion ~95 units wide → at 375px viewport that's ~44.5px. Just enough; do NOT shrink further.
- Use `viewBox="0 0 800 280"` + `preserveAspectRatio="xMidYMid meet"` for predictable cross-device scaling.
- Avatars composited as absolute-positioned DOM `<img>` over SVG (NOT in-SVG `<image href>` — iOS Safari has cross-origin caching quirks).
- NO `filter:url(#...)` SVG filter primitives (broken in iOS PWA WebKit before iOS 17). Use CSS box-shadow / filter for any glow.
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
  <name>Task 2: Add renderCouchSvg + claimCushion + openCouchOverflowSheet to js/app.js</name>
  <files>js/app.js</files>
  <read_first>
    - js/app.js lines 4460-4490 (analog: card(t) inline-onclick render pattern)
    - js/app.js lines 11853-11900 (analog: openActionSheet primitive — reused for overflow)
    - js/app.js lines 11920-11940 (analog: existing avatar markup patterns; Grep `who-avatar` and `memberColor(`)
    - js/app.js lines 12325-12390 (analog: per-member-keyed map write pattern with writeAttribution)
    - .planning/phases/14-decision-ritual-core/14-PATTERNS.md §6 (concrete renderCouchSvg skeleton — copy + extend)
  </read_first>
  <action>
1. Locate a good insertion point. The renderer + handlers are best co-located near the other tonight-tab render code. Grep for `renderTonight` or pick a location ~50 lines above `openActionSheet` at js/app.js:11853 (so all action-sheet code stays grouped). Capture insertion line in SUMMARY.

2. Insert this block verbatim (visual geometry is placeholder-friendly; values TBD by sketch checkpoint Task 5):

```js
// === D-06 Couch SVG visualization — DECI-14-06 ===
// Procedural inline SVG; adaptive seat count 2-8; +N overflow cushion when family > 7.
// Visual geometry placeholder until /gsd-sketch sign-off (Task 5 checkpoint in 14-04 plan).
// iOS PWA budget: viewBox scaling, ≥44pt cushion hit targets at 375px viewport, no SVG filters.

function renderCouchSvg(seatCount) {
  // Clamp seat count: min 2 (couch is plural by definition), max 8 (UX cap per D-06).
  const totalMembers = (state.members || []).length;
  const requested = Math.max(2, Math.min(8, seatCount || Math.max(2, totalMembers)));
  // If we have >7 members and only 8 cushion slots, last cushion becomes +N overflow.
  const hasOverflow = totalMembers > 7;
  const cushionCount = hasOverflow ? 8 : Math.max(2, Math.min(8, totalMembers || requested));
  const overflowN = hasOverflow ? (totalMembers - 7) : 0;

  // viewBox geometry — 800 units wide / 280 units tall. Each cushion gets ~(800 / cushionCount) units.
  // Placeholder geometry: rounded rect for each cushion. Real shape comes from /gsd-sketch round.
  const viewW = 800;
  const viewH = 280;
  const padding = 20;
  const cushionW = (viewW - padding * 2) / cushionCount;
  const cushionH = 160;
  const cushionY = 80;

  const cushions = [];
  for (let i = 0; i < cushionCount; i++) {
    const isOverflow = (hasOverflow && i === cushionCount - 1);
    const x = padding + i * cushionW;
    const seatedMid = state.couchMemberIds[i] || null;
    const isClaimedByMe = seatedMid && state.me && seatedMid === state.me.id;
    const handler = isOverflow ? 'openCouchOverflowSheet()' : `claimCushion(${i})`;
    const labelText = isOverflow
      ? `+${overflowN} more`
      : (seatedMid ? '' : 'Add to couch');
    const cls = ['cushion'];
    if (isOverflow) cls.push('overflow');
    if (seatedMid) cls.push('claimed');
    if (isClaimedByMe) cls.push('claimed-by-me');
    cushions.push(`<g class="${cls.join(' ')}" data-cushion-idx="${i}" tabindex="0" role="button"
      aria-label="${isOverflow ? `${overflowN} more couch members` : (seatedMid ? `Seat claimed` : 'Empty seat — tap to seat yourself')}"
      onclick="${handler}"
      onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();${handler};}">
      <rect x="${x + 4}" y="${cushionY}" width="${cushionW - 8}" height="${cushionH}" rx="18" ry="18"
        class="cushion-rect" />
      ${labelText ? `<text x="${x + cushionW/2}" y="${cushionY + cushionH/2 + 5}" text-anchor="middle" class="cushion-label">${labelText}</text>` : ''}
    </g>`);
  }

  // SVG returns the structure; avatar DOM overlay is rendered separately by the caller (DOM-on-top
  // approach per RESEARCH §4 — avoids iOS in-SVG <image href> caching quirks).
  return `<svg class="couch-svg" viewBox="0 0 ${viewW} ${viewH}" preserveAspectRatio="xMidYMid meet"
    aria-label="Couch with ${cushionCount} seats">
    ${cushions.join('')}
  </svg>`;
}

// D-06 — Avatar DOM overlay (rendered as absolutely-positioned <img> elements over the SVG).
// Called by the caller after innerHTML-injecting the SVG. Returns markup string for a sibling div.
function renderCouchAvatarOverlay(seatCount) {
  const cushionCount = Math.max(2, Math.min(8, ((state.members || []).length > 7 ? 8 : ((state.members || []).length || seatCount))));
  const seats = [];
  for (let i = 0; i < cushionCount; i++) {
    const mid = state.couchMemberIds[i];
    if (!mid) continue;
    const m = (state.members || []).find(x => x.id === mid);
    if (!m) continue;
    const initial = escapeHtml((m.name || '?')[0].toUpperCase());
    seats.push(
      `<div class="couch-avatar-slot" data-slot="${i}" style="--slot-idx: ${i}; --slot-total: ${cushionCount}">
        <div class="couch-avatar" style="background:${memberColor(m.id)}" title="${escapeHtml(m.name || 'Member')}">${initial}</div>
      </div>`
    );
  }
  return `<div class="couch-avatar-overlay" aria-hidden="true">${seats.join('')}</div>`;
}

// D-06 — claim a cushion seat. Adds state.me.id to state.couchMemberIds at index idx
// (if empty); toggles off if already claimed by state.me. Persists to family doc.
window.claimCushion = async function(idx) {
  if (!state.me) { flashToast('Sign in to seat yourself', { kind: 'warn' }); return; }
  const current = state.couchMemberIds[idx] || null;
  // Toggle off if I'm sitting there.
  if (current === state.me.id) {
    state.couchMemberIds[idx] = null;
    // Compact: drop trailing nulls (keep order for non-tail slots).
    while (state.couchMemberIds.length && state.couchMemberIds[state.couchMemberIds.length - 1] == null) {
      state.couchMemberIds.pop();
    }
    await persistCouchSeating();
    rerenderCouchViz();
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
  rerenderCouchViz();
};

// D-06 — overflow sheet for families > 7 members. Reuses #action-sheet-bg primitive.
window.openCouchOverflowSheet = function() {
  const content = document.getElementById('action-sheet-content');
  if (!content) return;
  const seated = new Set(state.couchMemberIds.filter(Boolean));
  const items = (state.members || [])
    .filter(m => !seated.has(m.id))
    .slice(7) // members 8+
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
// Same persistence path as claimCushion.
window.claimCushionByMember = async function(memberId) {
  if (!memberId) return;
  // Find the first empty slot in 0..7 range.
  let firstEmpty = -1;
  for (let i = 0; i < 8; i++) {
    if (!state.couchMemberIds[i]) { firstEmpty = i; break; }
  }
  if (firstEmpty < 0) {
    flashToast('Couch is full', { kind: 'warn' });
    return;
  }
  state.couchMemberIds[firstEmpty] = memberId;
  await persistCouchSeating();
  rerenderCouchViz();
};

// D-06 — persist couchSeating map to family doc.
// Shape: families/{code}.couchSeating = { [memberId]: index }; null/missing = not seated.
async function persistCouchSeating() {
  if (!state.familyCode) return;
  const map = {};
  state.couchMemberIds.forEach((mid, i) => { if (mid) map[mid] = i; });
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

// D-06 — render+rerender hook. Called from Tonight tab render path AND after every claimCushion mutation.
function rerenderCouchViz() {
  const container = document.getElementById('couch-viz-container');
  if (!container) return;
  const seatCount = Math.max(2, Math.min(8, (state.members || []).length || 4));
  container.innerHTML = renderCouchSvg(seatCount) + renderCouchAvatarOverlay(seatCount);
}
```

3. Wire `rerenderCouchViz()` into the existing Tonight tab render path. Grep for `function renderTonight` or `tab === 'tonight'` to locate. Add `rerenderCouchViz();` call AFTER the existing innerHTML-set so the container is in DOM by the time the call fires.

4. Hydrate `state.couchMemberIds` from family doc on family load. Grep for the existing onSnapshot listener for the family doc (probably near `state.unsubFamily` or similar). Inside the snapshot handler, after `state.family = snap.data()`, add:

```js
// D-06 — hydrate couch seating from family doc into the indexed-array state shape.
const seating = (snap.data() && snap.data().couchSeating) || {};
const couchArr = [];
Object.entries(seating).forEach(([mid, idx]) => { couchArr[idx] = mid; });
state.couchMemberIds = couchArr;
if (typeof rerenderCouchViz === 'function') rerenderCouchViz();
```

5. Confirm `db`, `doc`, `updateDoc`, `writeAttribution`, `flashToast`, `escapeHtml`, `memberColor` are all already imported in js/app.js. If not, add to the existing import statement (do NOT introduce a build step).
  </action>
  <verify>
    <automated>node --check js/app.js && grep -cE "function (renderCouchSvg|renderCouchAvatarOverlay|rerenderCouchViz|persistCouchSeating)\\(|window\\.claimCushion =|window\\.openCouchOverflowSheet =|window\\.claimCushionByMember =" js/app.js</automated>
    Expect: `node --check` exits 0; grep returns `7` (4 named functions + 3 window assignments).
  </verify>
  <done>
    - All 7 functions/handlers present in js/app.js exactly once each.
    - rerenderCouchViz called from at least 1 site (Tonight render path) and from claimCushion / claimCushionByMember after mutations.
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
    - css/app.css lines 1-60 (token primitives — colors / radius / shadow tokens) and grep for `.tc-want-pill` analog if present
    - .planning/BRAND.md (color tokens for warm-dark palette)
  </read_first>
  <action>
1. **app.html** — locate the Tonight tab section (grep for `id="tab-tonight"` or `data-tab="tonight"` or `<section.*tonight`). Insert a new container element near the top of the Tonight tab content, ABOVE existing surfaces (the couch viz is the new centerpiece):

```html
<!-- D-06 (DECI-14-06) — Couch viz centerpiece. Rendered by rerenderCouchViz() in js/app.js. -->
<div id="couch-viz-container" class="couch-viz-container" aria-label="Who's on the couch tonight"></div>
```

2. **css/app.css** — append a new section near the bottom (or near other Tonight-tab classes if a section exists). Use the token system from BRAND.md (warm-dark palette); placeholder values shown:

```css
/* === D-06 Couch viz — DECI-14-06 === */
/* Visual geometry placeholder pending /gsd-sketch round (Task 5 checkpoint). */

.couch-viz-container {
  position: relative;
  width: 100%;
  max-width: 720px;
  margin: var(--s4) auto;
  padding: var(--s2) 0;
  /* Reserve aspect ratio matching SVG viewBox 800x280. */
  aspect-ratio: 800 / 280;
}

.couch-svg {
  display: block;
  width: 100%;
  height: 100%;
  /* No SVG filter primitives — iOS PWA WebKit < iOS 17 breaks them. Use CSS instead. */
}

.couch-svg .cushion {
  cursor: pointer;
  transition: opacity var(--t-shimmer, 200ms) var(--ease-out, ease-out);
}

.couch-svg .cushion-rect {
  fill: var(--c-cushion-empty, #2b231e);
  stroke: var(--c-cushion-stroke, #4a3d33);
  stroke-width: 2;
  transition: fill var(--t-shimmer, 200ms) var(--ease-out, ease-out);
}

.couch-svg .cushion.claimed .cushion-rect {
  fill: var(--c-cushion-claimed, #3a2f25);
}

.couch-svg .cushion.claimed-by-me .cushion-rect {
  stroke: var(--c-warm-amber, #d4a574);
  stroke-width: 3;
}

.couch-svg .cushion.overflow .cushion-rect {
  fill: var(--c-cushion-overflow, #1f1a16);
  stroke-dasharray: 6 4;
}

.couch-svg .cushion-label {
  font-family: var(--font-body, Inter, sans-serif);
  font-size: 16px;
  fill: var(--c-text-dim, #8a7d6e);
  pointer-events: none;
}

.couch-svg .cushion:hover .cushion-rect,
.couch-svg .cushion:focus-visible .cushion-rect {
  fill: var(--c-cushion-hover, #4a3d33);
}

/* Avatar overlay — DOM <img>/<div> positioned over SVG via CSS grid (DOM-on-top per iOS guidance). */
.couch-avatar-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  align-items: center;
  pointer-events: none;
  padding: 0 calc(20px / 800 * 100%); /* matches SVG padding */
}

.couch-avatar-slot {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Position by --slot-idx (0..7); span 1 column. Couch SVG cushions use 1-of-N width;
     because grid is fixed at 8, slots beyond cushionCount stay empty (pointer-events:none). */
  grid-column: calc(var(--slot-idx, 0) + 1);
}

.couch-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: var(--font-body, Inter, sans-serif);
  font-weight: 600;
  font-size: 18px;
  color: var(--c-text-on-avatar, #fff);
  pointer-events: auto;
  box-shadow: 0 2px 6px rgba(0,0,0,0.4);
}

@media (prefers-reduced-motion: reduce) {
  .couch-svg .cushion,
  .couch-svg .cushion-rect {
    transition: none;
  }
}
```

3. If any of the CSS variable names (`--c-cushion-empty`, `--c-warm-amber`, etc.) don't exist in the existing token layer, either (a) add fallback hardcoded values matching BRAND.md palette OR (b) wire up to existing tokens with the closest semantic match. Defer the precise color refinement to Task 5 (sketch checkpoint).
  </action>
  <verify>
    <automated>grep -c "couch-viz-container" app.html && grep -c "\\.couch-svg" css/app.css</automated>
    Expect: app.html has ≥1 mention of `couch-viz-container`; css/app.css has ≥1 `.couch-svg` rule.
  </verify>
  <done>
    - app.html contains `<div id="couch-viz-container">` exactly once on the Tonight tab.
    - css/app.css contains `.couch-svg`, `.cushion`, `.cushion-rect`, `.couch-avatar-overlay`, `.couch-avatar` rules.
    - prefers-reduced-motion block hardens the transitions.
    - All CSS uses tokens (or documented hardcoded fallbacks) — no inline styles in app.html.
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
  <name>Task 5: HUMAN-VERIFY — Couch SVG visual treatment + /gsd-sketch sign-off</name>
  <what-built>
    Tasks 1-4 ship the structural Couch viz: SVG renderer, claim/overflow handlers, avatar overlay, persistence, rules widening. Visual treatment is placeholder geometry (rounded rects + token-based colors) per D-06's explicit defer-to-sketch directive (Anti-pattern #6). Task 5 closes the loop.
  </what-built>
  <how-to-verify>
    1. Deploy current main to staging (`bash scripts/deploy.sh 14-04-couch-preview`) OR run locally.
    2. Open the Tonight tab. Confirm:
       - Couch viz renders above existing surfaces.
       - Cushion count matches family member count (clamped 2-8).
       - Tapping an empty cushion claims it for state.me; the cushion stroke turns warm-amber (claimed-by-me).
       - Tapping a claimed-by-me cushion vacates it (toggles off).
       - With ≥8 family members, the 8th cushion shows "+N more" and tapping opens the overflow sheet.
       - Refresh — couch state persists (couchSeating doc field round-trips).
       - On iPhone Safari (browser + installed PWA): cushion hit targets feel ≥44pt; tap latency is acceptable.
    3. Run `/gsd-sketch` for couch SVG variants per D-06 sketch target #1 (3 mockups at 3/5/8 seats; material exploration; avatar treatment). Compare sketch outputs to the placeholder geometry shipped in Task 1-3.
    4. Decide: PASS (placeholder geometry is acceptable for v34 ship; sketch refinements deferred), OR REFINE (specify which sketch variant to apply + which CSS/SVG values to swap).
  </how-to-verify>
  <resume-signal>
    Reply with one of:
    - "approved" — placeholder geometry ships as-is for v34. SUMMARY records the decision; sketch refinements tracked as a Phase-15 polish item.
    - "refine: <details>" — specify visual changes to apply. The plan executor edits Task 2's renderCouchSvg geometry + Task 3's CSS to match. Re-run Task 5 once changes are in.
    - "skip-sketch" — defer /gsd-sketch round; ship placeholder geometry now. Note in SUMMARY as deferred design decision.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → family doc | New couchSeating field widens the family-doc update surface; firestore.rules must permit |
| inline SVG event binding | onclick handlers are window-scoped; XSS surface IFF a member name reaches the SVG without escaping (mitigated by escapeHtml on labels) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14.04-01 | Tampering | A member writes couchSeating to plant a fake "claim" by another member | mitigate | writeAttribution() spread enforces actor-uid; Phase 5 attribution rules already check `request.auth.uid == request.resource.data.actingUid` (or the equivalent legacy member-id check). Server-side validation lives in attributedWrite() helper; this plan inherits it. |
| T-14.04-02 | Information Disclosure | couchSeating exposes co-presence ("Mom and Dad are on the couch right now") | accept | Family-scoped read; only family members can read the family doc. Co-presence within a family is the intended UX, not a leak. |
| T-14.04-03 | Cross-Site Scripting | Member name rendered into SVG label without escape | mitigate | escapeHtml() applied to all member-name interpolations in renderCouchSvg + renderCouchAvatarOverlay (acceptance criterion). |
</threat_model>

<verification>
- `node --check js/app.js` → exit 0.
- `node --check js/state.js` → exit 0.
- `grep -c "function renderCouchSvg(" js/app.js` → 1.
- `grep -c "window.claimCushion = " js/app.js` → 1.
- `grep -c "window.openCouchOverflowSheet = " js/app.js` → 1.
- `grep -c "couch-viz-container" app.html` → ≥1.
- `grep -c "\\.couch-svg" css/app.css` → ≥1.
- `grep -c "couchSeating" firestore.rules` → ≥1.
- `grep -c "writeAttribution()" js/app.js` near persistCouchSeating → ≥1.
- Task 5 checkpoint resolved with one of {approved, refine: ..., skip-sketch}.
</verification>

<success_criteria>
1. Couch viz renders on Tonight tab with 2-8 cushions adapting to family size.
2. Tapping an empty cushion seats state.me; tapping a claimed-by-me cushion vacates; +N overflow sheet works.
3. couchSeating persists to family doc with proper attribution.
4. state.couchMemberIds is hydrated on family-doc snapshot — downstream consumers (14-01 isWatchedByCouch, 14-03 tier aggregators, 14-07 Flow A) see live data.
5. Visual geometry either ships as placeholder (Task 5 approved) OR is refined per /gsd-sketch sign-off.
</success_criteria>

<output>
After completion, create `.planning/phases/14-decision-ritual-core/14-04-SUMMARY.md` documenting:
- Insertion file:line for renderCouchSvg + claim handlers.
- Tonight-tab render hook integration site.
- Family-doc snapshot hydration site.
- firestore.rules case applied (A or B).
- Task 5 checkpoint resolution + any sketch-driven refinements applied.
</output>
