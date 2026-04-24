# Phase 11: Feature refresh & streamline — Pattern Map

**Mapped:** 2026-04-24
**Files analyzed:** 9 distinct touch-points (HTML shell, CSS, js/app.js, sw.js, CF index.js, new rsvp.html, new css/rsvp.css, new CF reminderTick, new Firestore schema additions)
**Analogs found:** 9 / 9 matched (1 — Plan 11-05 post-session modal + Plan 11-03b curated rows — compose from closest-role analogs; no exact precedent)

> **Scope posture:** Phase 11 is a brownfield extension of a mature post-Phase-9 surface. There are no "new files by role" in the traditional sense — everything lands in the existing 4-file shell (app.html / css/app.css / js/app.js / sw.js) PLUS (REFR-05 only) two brand-new standalone files at the repo root (`rsvp.html` + `css/rsvp.css`) PLUS new Cloud Functions in the sibling `queuenight/functions/` repo. Pattern assignments below map each REFR-ID to its closest existing analog by role + data flow.
>
> **Read discipline:** `js/app.js` (~10200 lines) was never read in full; each pattern was located via Grep then Read with offset/limit. `css/app.css` (~2360 lines) similarly grep-first. All reads non-overlapping; no range re-read.

## File Classification

| Surface / REFR-ID | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| **REFR-01** mood-chip density (`css/app.css`) | CSS component | presentation | `.mood-chip` at `css/app.css:700-710` | exact (edit existing) |
| **REFR-02** picker-hide feature flag (`css/app.css` + `js/app.js`) | CSS utility + JS body-class toggle | presentation | `body.is-readonly` pattern at `css/app.css:2230-2237` | exact (same pattern: body-class CSS kill-switch) |
| **REFR-03** who-card redesign (`css/app.css` `.who-card` + `js/app.js` `renderTonight`) | CSS component + JS render | request-response | `.who-card` + `.who-list` at `css/app.css:1592-1610` + `renderTonight()` at `js/app.js:3840-3864` | exact (variant swap on existing) |
| **REFR-04** discovery rotation engine + new rows (`js/app.js` discovery loaders + `app.html` discover rows + new catalog module) | JS loader + HTML row markup | request-response + TMDB | `loadTrendingRow()` / `loadGemsRow()` / `loadStreamingRow()` at `js/app.js:9009-9084` + `app.html:393-428` | exact (same loader + render shape, multiplied) |
| **REFR-05** RSVP standalone page (`rsvp.html` + `css/rsvp.css`) | NEW standalone HTML + CSS | request-response (HTTP GET + Firestore write via unauth'd callable CF) | `landing.html` (~160 lines) + `css/landing.css` (~86 lines) | exact role-match (zero-SDK brochure + trim CSS) |
| **REFR-05** Web Share API in schedule modal (`js/app.js` `saveSchedule`) | JS event-handler | request-response | `window.saveSchedule` at `js/app.js:5383-5398` + `createGuestInvite` at `js/app.js:2911-2942` | exact (same modal-save pattern + guest-link share precedent) |
| **REFR-06** Asymmetric push reminder CF (`queuenight/functions/index.js` new export) | Scheduled CF | pub-sub / scheduled | `watchpartyTick` at `queuenight/functions/index.js:435-500` + `onWatchpartyCreate` at `:153-194` | exact (scheduled + FCM send patterns) |
| **REFR-07** Pre-session lobby + Ready check (`js/app.js` + `css/app.css`) | JS render branch + CSS component | event-driven (Firestore snapshot) | `renderWatchpartyLive()` preStart branch at `js/app.js:7829-7838` + `.wp-prelaunch` at `css/app.css:848-849` + `.wp-participants-strip` at `css/app.css:763-772` | exact (lobby extends existing preStart state) |
| **REFR-08** Late-joiner "Catch me up" (`js/app.js` inside `renderWatchpartyLive`) | JS render branch | event-driven (reaction array slice) | Existing late-joiner `wallclock` mode + `effectiveStartFor` at `js/app.js:1754` + `renderReactionsFeed` at `:7918-7959` | exact (extends existing reactions-feed with 30s-slice card) |
| **REFR-09** Post-session modal (`js/app.js` new modal + `app.html` new `<div class="modal-bg">`) | JS modal render + HTML shell | request-response + Firebase Storage | `.wp-start-modal-bg` at `app.html:872-897` + `saveSchedule` modal pattern + `.modal-bg` / `.modal` shell | role-match (new modal variant, rating stars are net-new) |
| **REFR-10** Sports Game Mode v1 (`js/app.js` extends `renderWatchpartyLive` + new DVR slider + score strip) | JS render + data poller | request-response + polling | `loadSportsGames()` at `js/app.js:7398-7432` + `renderWatchpartyBanner()` sport branch at `:7696-7760` | exact (existing sports-watchparty scaffold extends) |
| **REFR-11** Family tab restructure (`app.html:437-505` + `js/app.js:renderTonight`+`renderStats`+`renderMembersList`) | HTML reorder + render-function consolidation | presentation | Existing `#screen-family` sections at `app.html:437-505` | exact (pure reorder) |
| **REFR-12** Account tab 3-cluster regroup (`app.html:507-652` + `.tab-section-h` cluster dividers) | HTML reorder + CSS eyebrow headers | presentation | Existing `#screen-settings` sections at `app.html:507-652` + `.tab-section-h` at `css/app.css:1056-1061` | exact (pure reorder + new cluster eyebrows) |
| **REFR-13** Couch Nights themed packs (`js/app.js` new seeded-ballot + `app.html` new section + tile modal) | JS feature + CSS component + HTML section | request-response | `.intent-card` at `css/app.css:778-785` (tile aesthetic) + `openSportsPicker`/`renderSportsGames` pattern (picker→action) at `js/app.js:7377-7432` | role-match (pack tile = intent-card variant; pack-start = spin-seed precedent TBD) |
| **sw.js CACHE bump** (all plans touching app shell) | Cache versioning | config | Existing `CACHE = 'couch-v21-09-07b-guest-invite'` at `sw.js:8` | exact (bump pattern locked in CLAUDE.md) |

## Pattern Assignments

### REFR-01 — Mood chip density tightening (Plan 11-01 commit 1)

**Surface:** `css/app.css` — edit existing `.mood-filter` + `.mood-chip` rules only.

**Analog:** `css/app.css:697-712` (self — modify in place).

**Current pattern** (lines 697-710):
```css
.mood-filter{display:flex;gap:var(--s2);overflow-x:auto;...}
.mood-filter::-webkit-scrollbar{display:none}
.mood-chip{display:inline-flex;align-items:center;gap:var(--s2);
  padding:var(--s2) var(--s3);...}
.mood-chip:hover{border-color:var(--border-strong);color:var(--ink)}
.mood-chip.on{background:var(--accent);color:var(--bg);border-color:transparent;...}
.mood-chip .mood-icon{font-size:var(--t-body);line-height:1}
.mood-chip.all{padding:var(--s2) var(--s4)}
```

**Edit contract (from 11-UI-SPEC.md Subtraction Contract):**
- `.mood-filter` gap: `var(--s2)` → `var(--s1)`
- `.mood-chip` padding: `var(--s2) var(--s3)` → `var(--s1) var(--s3)`
- `.mood-chip` enforce `min-height: 36px` (new line)
- `.mood-chip` font-size: (currently inherits body; make explicit) → `var(--t-meta)` 13px
- `.mood-chip .mood-icon` font-size: KEEP at `var(--t-body)` 15px (UI-SPEC §Spacing line 580)

**No JS edit.** `renderMoodFilter()` at `js/app.js:3788-3810` and `renderAddMoodChips()` at `:9086-9094` both already emit the same `.mood-chip` markup — CSS-only change ripples automatically.

---

### REFR-02 — Picker UI hide via body class (Plan 11-01 commit 2)

**Surfaces:** `css/app.css` (new rule) + `js/app.js` (body-class toggle call at app init).

**Analog:** `body.is-readonly` pattern at `css/app.css:2230-2237`:
```css
body.is-readonly .vote-btn,
body.is-readonly .veto-btn,
body.is-readonly .mood-add-btn,
body.is-readonly .mood-chip-remove,
body.is-readonly .reaction-btn,
body.is-readonly .wp-compose-btn,
body.is-readonly .detail-mood-add,
body.is-readonly .swipe-btn { opacity: 0.4; pointer-events: none; }
```

**Copy this pattern for REFR-02** — add to end of Phase 9 utility block (near line ~2237):
```css
body.picker-ui-hidden #picker-card,
body.picker-ui-hidden #picker-heading,
body.picker-ui-hidden #picker-strip,
body.picker-ui-hidden .tab-section:has(#picker-heading),
body.picker-ui-hidden #picker-sheet-bg { display: none !important; }
```

**Hidden surfaces (verified by reading `app.html`):**
- `#picker-card` at `app.html:243-249` (Tonight hero)
- `#picker-heading` + `#picker-strip` at `app.html:465-475` (Family tab section)
- `#picker-sheet-bg` modal at `app.html:654-669`

**JS toggle site:** One-line addition on app boot. No function to copy — the pattern is `document.body.classList.add('picker-ui-hidden')` at wherever `body` classes get applied on app init (search for existing `document.body.classList.add` usages). **Backend writes preserved:** `renderPickerCard()` at `js/app.js:3134-3153` and `renderPickerStrip()` at `:4726-4752` continue to run; they just render into hidden DOM. Spinnership Firestore writes at `getPicker()` / `togglePickerAuto` / `passPickerTurn` stay untouched.

---

### REFR-03 — Who's-on-the-couch card redesign (Plan 11-01 commit 3)

**Surface:** `css/app.css` (`.who-card` + `.who-list` + `.who-chip`) + `js/app.js` (`renderTonight` who-list branch).

**Analog:** `renderTonight()` at `js/app.js:3840-3864` — existing who-list emitter:
```javascript
const whoEl = document.getElementById('who-list');
if (!whoEl) return;
const nowTs = Date.now();
const tonightMembers = (state.members || []).filter(m =>
  !m.archived &&
  (!m.temporary || (m.expiresAt && m.expiresAt > nowTs))
);
whoEl.innerHTML = tonightMembers.map(m => {
  const isSub = !!m.managedBy && !m.uid;
  const isGuest = !!m.temporary;
  // ...
  return `<div class="who-chip ${selected?'on':''} ${isMe?'me':''}" role="button"
    tabindex="0" aria-pressed="${selected}" aria-label="${escapeHtml(m.name)}"
    onclick="toggleMember('${m.id}')" ...>
    <div class="who-avatar" style="background:${m.color}" aria-hidden="true">${avatarContent(m)}</div>
    <div class="who-name">${escapeHtml(m.name)}${badgeHtml}</div>
  </div>`;
}).join('');
```

**Current CSS** at `css/app.css:1592-1610`:
```css
.who-card{background:var(--surface);border-radius:var(--r-lg);padding:var(--s5);...}
.who-list{display:flex;flex-wrap:wrap;gap:var(--s2);position:relative;z-index:1}
.who-chip{display:flex;align-items:center;gap:var(--s2);...}
.who-chip:hover{border-color:var(--border-strong)}
.who-chip.on{border-color:var(--accent);background:rgba(232,160,74,0.10)}
.who-chip.me{position:relative}
.who-chip.me::after{content:'';position:absolute;top:-2px;right:-2px;width:8px;height:8px;...}
```

**Per 11-UI-SPEC.md §Interaction States REFR-03 default recommendation = Variant B (compact horizontal row):** reuse `.wp-participant-chip` CSS at `css/app.css:765-772`:
```css
.wp-participant-chip{display:flex;align-items:center;gap:8px;padding:6px 10px 6px 6px;
  background:var(--surface);border:1px solid var(--border);border-radius:100px;flex-shrink:0;
  transition:opacity var(--t-quick)}
.wp-participant-chip.me{border-color:rgba(232,160,74,0.45);
  background:linear-gradient(135deg,rgba(232,160,74,0.08),transparent)}
.wp-participant-av{width:26px;height:26px;border-radius:50%;display:grid;place-items:center;
  font-size:12px;font-weight:700;color:white;flex-shrink:0}
.wp-participant-name{font-size:var(--t-meta);font-weight:600;color:var(--ink);white-space:nowrap}
```

**Action for planner:** Extend `.who-list` to horizontal scroll (like `.wp-participants-strip` at line 763: `display:flex;gap:8px;overflow-x:auto;scrollbar-width:none`), shrink `.who-chip` avatar from 40-ish to 26-28px, drop `flex-wrap:wrap` for `overflow-x:auto`. Empty-state copy per UI-SPEC line 327-330.

---

### REFR-04 — Discovery rotation engine + 35-row catalog (Plans 11-03a / 11-03b)

**Surfaces:** `js/app.js` (new: catalog data structure + `pickDailyRows()` hash-seed selector + per-row loaders) + `app.html` (new discovery row template) + `css/app.css` (new `.discover-row-eyebrow` + `.discover-row-subtitle`).

**Primary analog — row loader pattern** at `js/app.js:9009-9084`:
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
      .slice(0, 20)
      .map(x => mapTmdbItem(x));
    addTabCache.trending = { ts: Date.now(), items };
    renderAddRow('trending', items);
  } catch(e) {
    const el = document.getElementById('add-row-trending');
    if (el) el.innerHTML = '<div class="discover-loading">Could not load trending</div>';
  }
}
```

**Shared row render** at `js/app.js:8981-8999`:
```javascript
function renderAddRow(rowId, items) {
  const el = document.getElementById('add-row-' + rowId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<div class="discover-loading">Nothing to show here yet.</div>';
    return;
  }
  el.innerHTML = items.map(x => {
    const inLib = state.titles.find(t => t.id === x.id);
    const safeName = escapeHtml(x.name);
    return `<div class="discover-card" onclick="addFromAddTab('${rowId}','${x.id}')">
      <div class="discover-poster ${inLib?'added':''}" style="background-image:url('${x.poster}')">
        <div class="add-badge">${inLib?'✓':'+'}</div>
      </div>
      <div class="discover-name">${safeName}</div>
      <div class="discover-meta">${x.year||''} · ${x.kind}</div>
    </div>`;
  }).join('');
}
```

**Section-wrapper markup** at `app.html:392-403` (repeat 8-10×, parameterized):
```html
<div class="add-section">
  <div class="t-section-head">
    <div class="t-section-title">Trending this week</div>
    <div class="t-section-meta">What everyone's watching</div>
  </div>
  <div class="discover-row-wrap">
    <button class="discover-scroll-btn left" aria-label="Scroll left" onclick="scrollAddRow('trending',-1)">◂</button>
    <div class="discover-row" id="add-row-trending"><div class="sk-row-posters" aria-hidden="true">...</div></div>
    <button class="discover-scroll-btn right" aria-label="Scroll right" onclick="scrollAddRow('trending',1)">▸</button>
  </div>
</div>
```

**TMDB helper** at `js/app.js:9001-9007`:
```javascript
async function tmdbFetch(url) {
  const sep = url.includes('?') ? '&' : '?';
  const full = `https://api.themoviedb.org/3${url}${sep}api_key=${TMDB_KEY}`;
  const r = await fetch(full);
  if (!r.ok) throw new Error('TMDB ' + r.status);
  return r.json();
}
```

**Cache TTL discipline — preserve:** `ADD_CACHE_TTL` constant already exists; every new row loader uses the same cache-first pattern. For REFR-04's 8-10 rows/day, set cache keyed on `(rowId, current-date, user-id)` so the hash-seeded selection is stable per-day per-user.

**Hash-seed pick** (new utility, no existing analog — implement per CATEGORIES appendix §Daily-rotation logic):
- `hash(user-id, current-date)` → `rng-seed` → deterministic `rotationPicker(seed, bucketPool, count)`.
- Implement using a simple xmur3 / mulberry32 PRNG seeded by `state.me.id + todayKey()` (use `todayKey()` helper — already referenced at `js/app.js:3183`).

**New CSS rules** (planner to add near `css/app.css:1227` `.add-section`):
```css
.discover-row-eyebrow{font-family:'Inter',sans-serif;font-size:var(--t-eyebrow);
  color:var(--ink-dim);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:var(--s1)}
.discover-row-eyebrow.seasonal{color:var(--accent)}
.discover-row-subtitle{font-family:'Instrument Serif','Fraunces',serif;font-style:italic;
  font-size:var(--t-meta);color:var(--ink-warm);margin-bottom:var(--s2)}
```

---

### REFR-05 (a) — RSVP standalone page at `/rsvp/<token>` (Plan 11-04)

**Surfaces:** NEW `rsvp.html` (repo root) + NEW `css/rsvp.css` (new, ~80 lines) + `queuenight/firebase.json` rewrite rule (sibling repo; out of scope of pattern mapping but noted).

**Analog:** `landing.html` (~160 lines) + `css/landing.css` (~86 lines). **This is the template for the trim, zero-SDK page posture.**

**Imports / boilerplate pattern** (`landing.html:1-33`):
```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>Couch — Who's on the couch tonight?</title>
<meta name="description" content="...">
<meta name="theme-color" content="#14110f">
<link rel="canonical" href="https://couchtonight.app/">
<!-- OG / Twitter -->
<meta property="og:site_name" content="Couch">
<!-- ...og:image, og:url etc... -->
<!-- Icons -->
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link rel="apple-touch-icon" sizes="180x180" href="/mark-180.png">
<!-- Fonts: subset only -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;800&family=Inter:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap">
<link rel="stylesheet" href="/css/rsvp.css">
</head>
```

**CSS posture pattern** (`css/landing.css:1-32`):
```css
:root {
  --bg: #14110f;
  --bg-deep: #0e0a07;
  --surface: #1c1814;
  --ink: #f5ede0;
  --ink-warm: #c9bca8;
  --ink-dim: #847868;
  --accent: #e8a04a;
  --accent-2: #d97757;
  --velvet: #8b3a4e;
  --border: rgba(245,237,224,0.10);
  --r-md: 14px;
  --r-lg: 20px;
  --r-pill: 999px;
  --brand-grad: linear-gradient(135deg, #e8a04a 0%, #d97757 50%, #c54f63 100%);
  --ease-cinema: cubic-bezier(0.32, 0.72, 0, 1);
}
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; background: var(--bg); color: var(--ink);
  font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.55;
  -webkit-font-smoothing: antialiased; }
body::before { /* grain texture — same as app shell */ }
body > * { position: relative; z-index: 2; }
```

**Key posture contract (copy verbatim into `css/rsvp.css`):**
- NO import of `css/app.css` — standalone tokens inline.
- NO Firebase SDK on the page — RSVP write goes through an unauth'd `onCall` CF OR a public Firestore security-rule write path (planner to decide; reference `consumeGuestInvite` unauth CF pattern at `queuenight/functions/src/consumeGuestInvite.js`).
- Install + deep-link redirect script from `landing.html:35-44` is inline-inline script, zero-bundle; but for `/rsvp/<token>` the script should NOT redirect to `/app` when the URL is `/rsvp/<token>` — it should be a pure RSVP page that only offers an "Install Couch" link after RSVP completion.

**RSVP hero pattern** (adapt `landing.html:64-73`):
```html
<main class="rsvp">
  <section class="hero">
    <img class="hero-wordmark" src="/logo-h200.png" alt="Couch" width="423" height="200">
    <p class="hero-tagline">You're invited.</p>
  </section>
  <!-- event card + RSVP buttons per UI-SPEC §REFR-05 -->
</main>
```

**3-button RSVP row — reuse the existing app-shell pattern** at `css/app.css:804-806`:
```css
.intent-rsvp-btn{flex:1;min-width:70px;padding:12px;border-radius:12px;
  border:1px solid var(--border);background:var(--surface);color:var(--ink);
  font-family:inherit;font-weight:700;font-size:var(--t-body);cursor:pointer;
  transition:all var(--t-quick)}
.intent-rsvp-btn.on{background:linear-gradient(135deg,var(--accent),var(--velvet));
  color:var(--bg);border-color:transparent;box-shadow:0 4px 12px rgba(232,160,74,0.24)}
```

Re-declare under a new class name in `css/rsvp.css` (e.g. `.rsvp-btn`) — do not import app.css.

**Firebase Hosting rewrite (sibling repo `firebase.json`):** Must rewrite `/rsvp/**` to `/rsvp.html` so the token stays in the URL for JS parsing. Planner confirms in sibling-repo deploy section.

**sw.js CACHE bump:** Plan 11-04 MUST bump `CACHE` in `sw.js:8` from `'couch-v21-09-07b-guest-invite'` to e.g. `'couch-v22-11-04-rsvp'`. The RSVP page itself is NOT pre-cached (non-core route), but the sw.js handler's `SHELL` array at `sw.js:13` could optionally include `/rsvp` — **recommend NOT caching `/rsvp/*` paths** since tokens are unique per-invite.

---

### REFR-05 (b) — Web Share API in schedule modal (Plan 11-04)

**Surface:** `js/app.js` `saveSchedule` (or a new wrapper on top of `confirmStartWatchparty`).

**Analog:** `window.saveSchedule` at `js/app.js:5383-5398` + `window.createGuestInvite` at `:2911-2942` + `window.copyGuestLink` at `:2944-2949`.

**Save+share pattern** (extend `saveSchedule` or `confirmStartWatchparty` at `js/app.js:7602-7660`):
```javascript
window.confirmStartWatchparty = async function() {
  // ... existing validation ...
  try {
    await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
    logActivity('wp_started', { titleName: t.name });
    document.getElementById('wp-start-modal-bg').classList.remove('on');
    state.activeWatchpartyId = id;
    // ... existing open-live-view ...
  } catch(e) { alert('Could not start watchparty: ' + e.message); }
};
```

**Copy this Web Share fallback pattern from `createGuestInvite` at `:2921-2932`:**
```javascript
let link = r.data.deepLink || `https://couchtonight.app/?invite=${encodeURIComponent(r.data.inviteToken)}`;
try {
  const u = new URL(link); u.searchParams.delete('family'); link = u.toString();
} catch(e) {}
const out = document.getElementById('settings-guest-link-out');
if (out) {
  out.innerHTML = `<p>Send this link to your guest:</p>
    <code>${escapeHtml(link)}</code>
    <button onclick="copyGuestLink(this)" data-link="${escapeHtml(link)}">Copy</button>`;
}
haptic('success');
flashToast('Invite link ready', { kind: 'success' });
```

**New write path** — wp.id becomes the RSVP token (or mint a per-wp `rsvpToken` field):
```javascript
const rsvpUrl = `https://couchtonight.app/rsvp/${encodeURIComponent(wp.id)}`;
if (navigator.share) {
  try {
    await navigator.share({
      title: `Couch Night — ${t.name}`,
      text: `${state.me.name} invited you to watch ${t.name} on ${dayStr} at ${timeStr}. RSVP: ${rsvpUrl}`,
      url: rsvpUrl
    });
  } catch(e) { /* user cancelled — not an error */ }
} else {
  // Fallback: copy-to-clipboard + toast (same pattern as copyGuestLink)
  try { await navigator.clipboard.writeText(rsvpUrl); flashToast('Link copied', { kind: 'success' }); }
  catch(e) { /* show modal with link */ }
}
```

---

### REFR-06 — Asymmetric push reminder CF (Plan 11-04)

**Surface:** NEW `exports.rsvpReminderTick` in `queuenight/functions/index.js` (scheduled function).

**Analog 1 — scheduled CF shape** at `queuenight/functions/index.js:435-500`:
```javascript
exports.watchpartyTick = onSchedule({
  schedule: 'every 5 minutes',
  region: 'us-central1',
  timeoutSeconds: 120,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  const families = await db.collection('families').get();
  for (const familyDoc of families.docs) {
    let wpSnap;
    try {
      wpSnap = await db.collection('families').doc(familyDoc.id).collection('watchparties').get();
    } catch (e) { /* skip family */ continue; }
    for (const doc of wpSnap.docs) {
      const wp = doc.data();
      // ... per-wp logic ...
    }
  }
  console.log('watchpartyTick done', { /* counters */ });
  return null;
});
```

**Analog 2 — FCM recipient send pattern** at `queuenight/functions/index.js:153-194` (`onWatchpartyCreate`):
```javascript
const membersSnap = await db.collection('families').doc(familyCode).collection('members').get();
const recipientIds = membersSnap.docs.map(d => d.id).filter(id => id !== wp.hostId);
return sendToMembers(familyCode, recipientIds, {
  title: 'New watchparty',
  body: `${hostName} scheduled "${titleName}" for ${startTime}`,
  tag: `wp-create-${wpId}`,
  url: `/?wp=${wpId}`
}, {
  excludeUid: wp.hostUid || null,
  excludeMemberId: wp.hostId || null,
  eventType: 'watchpartyScheduled'
});
```

**REFR-06 reminder CF skeleton** (planner writes new export):
```javascript
exports.rsvpReminderTick = onSchedule({
  schedule: 'every 15 minutes',
  region: 'us-central1',
  timeoutSeconds: 180,
  memory: '256MiB'
}, async () => {
  const now = Date.now();
  // Per-wp, compute delta-to-startAt, find (participantId, rsvpState) pairs whose
  // reminder window has just crossed (e.g. T-24h for Yes, T-1h for Yes, T-7d for Maybe, etc.)
  // See 11-UI-SPEC.md §REFR-06 push copy templates table for (state, window, title, body).
  // Guard against double-send via a `wp.reminders.<participantId>.<windowKey>` boolean flag.
  // Use `sendToMembers` helper exactly as `onWatchpartyCreate` / `onWatchpartyUpdate` do.
});
```

**Copy contract** — verbatim from 11-UI-SPEC.md §Copywriting Contract REFR-06, lines 384-394.

**`sendToMembers` helper** — already exists in functions/index.js (referenced by lines 184-193 and 219-232). Planner should `grep` its definition (likely earlier in the file) and reuse as-is.

---

### REFR-07 — Pre-session lobby + Ready check (Plan 11-05)

**Surface:** `js/app.js` extend `renderWatchpartyLive()` preStart branch + new state on `participants[mid].ready` boolean + new CSS components.

**Primary analog — existing preStart branch** at `js/app.js:7829-7838`:
```javascript
if (preStart) {
  const secs = Math.max(0, Math.floor((wp.startAt - now)/1000));
  const mins = Math.floor(secs/60);
  const countdownStr = mins >= 1 ? formatCountdown(wp.startAt - now) : `${secs}s`;
  body = `<div class="wp-prelaunch">
    <div style="color:var(--ink-dim);font-size:var(--t-meta);">Starts in</div>
    <div class="wp-prelaunch-count" id="wp-prelaunch-count">${countdownStr}</div>
    <div style="font-size:var(--t-meta);color:var(--ink-dim);margin-bottom:18px;">
      ${participants.length} ${participants.length===1?'person':'people'} in:
      ${participants.map(([,p]) => p.name).join(', ')}
    </div>
    <div style="font-size:var(--t-meta);color:var(--ink-dim);font-style:italic;">
      When you actually hit play, tap "Start my timer" below...</div>
  </div>`;
}
```

**Existing countdown CSS** at `css/app.css:848-849`:
```css
.wp-prelaunch{text-align:center;padding:48px 20px}
.wp-prelaunch-count{font-family:'Instrument Serif','Fraunces',serif;font-style:italic;
  font-size:48px;font-weight:400;color:var(--accent);margin:14px 0;
  font-variant-numeric:tabular-nums;letter-spacing:-0.02em}
```

**Existing participant strip** — reuse `renderParticipantTimerStrip()` at `js/app.js:7965-8007` for lobby roster:
```javascript
function renderParticipantTimerStrip(wp) {
  const entries = Object.entries(wp.participants || {});
  if (!entries.length) return '';
  const chips = entries.map(([mid, p]) => {
    const member = state.members.find(m => m.id === mid);
    const name = (member && member.name) || p.name || 'Member';
    const color = (member && member.color) || '#888';
    let statusLabel;
    let chipClass = '';
    if (!p.startedAt) { statusLabel = 'Joined'; chipClass = 'joined'; }
    // ...
    return `<div class="wp-participant-chip ${chipClass} ${isMe ? 'me' : ''}" ...>
      <div class="wp-participant-av" style="background:${color};">${escapeHtml(initial)}</div>
      <div class="wp-participant-info">
        <div class="wp-participant-name">${escapeHtml(name)}</div>
        <div class="wp-participant-time">${escapeHtml(statusLabel)}</div>
      </div>
    </div>`;
  }).join('');
  return `<div class="wp-participants-strip" role="list">${chips}</div>`;
}
```

**Ready-check write pattern** (copy from existing watchparty writes — `js/app.js:7677-7683`):
```javascript
const update = {
  [`participants.${state.me.id}.ready`]: true,
  ...writeAttribution()
};
await updateDoc(watchpartyRef(wpId), update);
```

**CSS for `.wp-ready-check` — extend existing `.wp-control-btn`** at `css/app.css:834-837`:
```css
.wp-control-btn{background:var(--surface);border:1px solid var(--border);color:var(--ink);
  padding:7px 13px;border-radius:100px;font-family:inherit;font-size:var(--t-meta);
  cursor:pointer;transition:all var(--t-quick)}
.wp-control-btn.on{background:var(--brand-grad);color:var(--bg);border-color:transparent;
  font-weight:700;box-shadow:0 2px 8px rgba(232,160,74,0.2),inset 0 1px 0 rgba(255,255,255,0.15)}
```

New:
```css
.wp-ready-check{/* same shape as .wp-control-btn */ min-height:44px;padding:var(--s2) var(--s4);}
.wp-ready-check.on{background:var(--good);color:var(--bg);border-color:transparent;font-weight:700;}
```

**Auto-start at T-0 / majority-ready:** Implement inside the existing `watchpartyTick` CF (or a new `lobbyAutoStartTick` — planner chooses) using the same pattern that flips `scheduled` → `active` at `functions/index.js:454-462`.

---

### REFR-08 — Late-joiner "Catch me up" recap card (Plan 11-05)

**Surface:** `js/app.js` — new render function inside `renderWatchpartyLive()` body slot + new CSS component.

**Analog 1 — late-joiner branch** at `js/app.js:7848-7865`:
```javascript
} else if (!mine.startedAt) {
  // joined participant whose timer hasn't started yet (late joiner / pre-start creator / re-joiner)
  const prompt = `<div class="wp-prelaunch" style="padding-bottom:12px;">
    <div style="font-family:'Instrument Serif','Fraunces',serif;font-size:var(--t-h2);font-weight:400;margin-bottom:8px;">Ready when you are</div>
    <div style="font-size:var(--t-meta);color:var(--ink-dim);margin-bottom:18px;">Start the movie on your device...</div>
  </div>`;
  body = prompt + renderParticipantTimerStrip(wp) + renderReactionsFeed(wp, mine, 'wallclock');
}
```

**Analog 2 — reactions feed slicer** at `js/app.js:7918-7959`:
```javascript
function renderReactionsFeed(wp, mine, modeOverride) {
  const mode = modeOverride || mine.reactionsMode || 'elapsed';
  // ...
  const delayMs = (mine.reactionDelay || 0) * 1000;
  const nowMs = Date.now();
  const visible = allReactions.filter(r => {
    if (mode === 'wallclock') return true;
    if (r.memberId === state.me.id) return true;
    return (r.at || 0) <= (nowMs - delayMs);
  });
  // ...
  const sorted = visible.slice().sort((a,b) => mode === 'wallclock' ? (a.at - b.at) : ...);
  return `<div class="wp-live-body" id="wp-reactions-feed">${sorted.map(r => renderReaction(r, mode)).join('')}</div>`;
}
```

**Analog 3 — reaction render shape** at `js/app.js:8009-8025`:
```javascript
function renderReaction(r, mode) {
  const color = memberColor(r.memberId);
  const initial = (r.memberName || '?')[0].toUpperCase();
  const stamp = mode === 'wallclock'
    ? new Date(r.at).toLocaleTimeString([], {hour:'numeric', minute:'2-digit'})
    : formatElapsed(r.elapsedMs || 0);
  const content = r.kind === 'emoji'
    ? `<div class="wp-reaction-emoji">${r.emoji || ''}</div>`
    : `<div>${escapeHtml(r.text || '')}</div>`;
  return `<div class="wp-reaction-row">
    <div class="wp-reaction-avatar" style="background:${color};">${escapeHtml(initial)}</div>
    <div style="flex:1;min-width:0;">
      <div class="wp-reaction-bubble">${content}</div>
      <div class="wp-reaction-meta">${escapeHtml(r.memberName)} · ${stamp}</div>
    </div>
  </div>`;
}
```

**REFR-08 new render function** (planner writes):
```javascript
function renderCatchupCard(wp, mine) {
  // Only show if mine.joinedAt > wp.startAt + 60s (past on-time grace)
  // Slice the LAST 30 seconds of reactions (not "before I joined" — more useful)
  const joinedAt = mine.joinedAt || Date.now();
  const windowStart = joinedAt - 30 * 1000;
  const preJoinReactions = (wp.reactions || [])
    .filter(r => (r.at || 0) < joinedAt && (r.at || 0) >= windowStart)
    .sort((a, b) => (a.at || 0) - (b.at || 0));
  if (preJoinReactions.length < 3) return ''; // empty state = hide entirely
  const rail = preJoinReactions.map(r => {/* compact 24px emoji + avatar timeline */}).join('');
  return `<div class="wp-catchup-card">
    <div class="wp-catchup-eyebrow">YOU MISSED</div>
    <div class="wp-catchup-title">Here's the last 30 seconds.</div>
    <div class="wp-catchup-rail">${rail}</div>
    <button class="wp-control-btn" onclick="dismissCatchup()">Got it — catch me up to now</button>
  </div>`;
}
```

Inject at top of `wp-live-body` slot when `mine.joinedAt > wp.startAt + ONTIME_GRACE_MS` (see existing `ONTIME_GRACE_MS` usage at `js/app.js:7989`).

---

### REFR-09 — Post-session modal: rate + photo + schedule-next (Plan 11-05)

**Surfaces:** NEW `<div class="modal-bg" id="wp-post-session-modal-bg">` in `app.html` (near other wp modals) + NEW render+save functions in `js/app.js` + Firebase Storage upload (NEW infra — first use).

**Primary analog — modal shell pattern** at `app.html:872-897` (`wp-start-modal-bg`):
```html
<div class="modal-bg" id="wp-start-modal-bg">
  <div class="modal">
    <h3>Start a watchparty</h3>
    <div class="meta" id="wp-start-meta">...</div>
    <div class="modal-field-stack">
      <div class="field">
        <label>When are you starting?</label>
        <div class="wp-lead-grid" id="wp-lead-grid">...</div>
      </div>
      <!-- ...fields... -->
      <button class="modal-close" onclick="confirmStartWatchparty()">Start watchparty</button>
      <button class="pill modal-btn-block" onclick="closeWatchpartyStart()">Cancel</button>
    </div>
  </div>
</div>
```

**Analog — modal open/close + save pattern** at `js/app.js:7289-7660` (`openWatchpartyStart` + `confirmStartWatchparty`):
```javascript
window.openWatchpartyStart = function(titleId) {
  if (!state.me) { alert('Join the group first.'); return; }
  const t = state.titles.find(x => x.id === titleId);
  if (!t) return;
  wpStartTitleId = titleId;
  // ... initialize modal fields ...
  document.getElementById('wp-start-modal-bg').classList.add('on');
};
window.closeWatchpartyStart = function() {
  document.getElementById('wp-start-modal-bg').classList.remove('on');
  wpStartTitleId = null;
};
window.confirmStartWatchparty = async function() {
  // ... validation ...
  try {
    await setDoc(watchpartyRef(id), { ...wp, ...writeAttribution() });
    logActivity('wp_started', { titleName: t.name });
    document.getElementById('wp-start-modal-bg').classList.remove('on');
    // ... post-save actions ...
  } catch(e) { alert('Could not start watchparty: ' + e.message); }
};
```

**Rating stars — no existing analog. Compose from diary-stars pattern** at `css/app.css:2340-2341` + `app.html:965-967` (but diary stars are half-step; REFR-09 is 5-star whole):
```html
<label class="diary-eyebrow">Stars (tap twice for half)</label>
<div id="diary-stars" class="diary-stars-row"></div>
```
Planner writes new `.wp-rating-stars` component with 5 outline stars tap-to-fill (see 11-UI-SPEC.md §Interaction States REFR-09).

**Photo upload — Firebase Storage is new to Couch.** CLAUDE.md line 161 explicitly notes: *"No new Firebase product surface... unless REFR-09 photo album forces it — if so, scope as a single narrow Storage use."* Planner MUST add:
- `import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'` in `js/firebase.js`.
- Storage security rule (sibling repo `queuenight/storage.rules`): allow writes only by family-member UIDs to path `/couch-albums/{familyCode}/{wpId}/{ts}_{uid}.jpg`.
- Client upload helper in `js/app.js` that reads user-picked file → compresses to ≤1MB → uploads → writes `downloadURL` back into `wp.photos[]` array.

**No existing analog for this — flag as "composed from Storage API docs" in plan 11-05.**

**Schedule-next CTA — reuse `openScheduleModal()` / `openWatchpartyStart()`** at `js/app.js:5343-5360` / `:7289-7314` directly. Prepopulate title = just-watched title; prepopulate participants = current wp.participants.

---

### REFR-10 — Sports Game Mode v1 (Plan 11-06)

**Surface:** `js/app.js` extend sports scaffold (picker exists, score strip + play-scoped reactions + DVR slider are new) + `css/app.css` new components + `app.html` sports game picker exists.

**Primary analog 1 — sports data loader** at `js/app.js:7398-7432`:
```javascript
async function loadSportsGames(leagueKey) {
  const listEl = document.getElementById('sports-games-list');
  if (!listEl) return;
  const league = SPORTS_LEAGUES[leagueKey];
  const cached = sportsGamesCache[leagueKey];
  if (cached && Date.now() - cached.fetchedAt < SPORTS_CACHE_TTL) {
    renderSportsGames(cached.games);
    return;
  }
  listEl.innerHTML = '<div class="sports-loading">Loading ' + league.label + ' games…</div>';
  try {
    const allGames = [];
    const today = new Date();
    const fetches = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() + i);
      const dateStr = d.getFullYear() + String(d.getMonth()+1).padStart(2,'0') + String(d.getDate()).padStart(2,'0');
      const url = 'https://site.api.espn.com/apis/site/v2/sports/' + league.sport + '/' + league.league + '/scoreboard?dates=' + dateStr;
      fetches.push(fetch(url).then(r => r.json()).catch(() => null));
    }
    const results = await Promise.all(fetches);
    results.forEach(data => {
      if (data && Array.isArray(data.events)) {
        data.events.forEach(ev => allGames.push(ev));
      }
    });
    sportsGamesCache[leagueKey] = { fetchedAt: Date.now(), games: allGames };
    renderSportsGames(allGames);
  } catch(e) {
    qnLog('[Sports] fetch failed', e);
    listEl.innerHTML = '<div class="sports-empty"><strong>Couldn\'t load games</strong>...</div>';
  }
}
```

**Primary analog 2 — ESPN event parse** at `js/app.js:7434-7460`:
```javascript
function parseEspnEvent(ev) {
  if (!ev) return null;
  const comp = (ev.competitions && ev.competitions[0]) || {};
  const teams = comp.competitors || [];
  const home = teams.find(t => t.homeAway === 'home') || {};
  const away = teams.find(t => t.homeAway === 'away') || {};
  // ... startTime, homeTeam, awayTeam, statusName ...
  return { id, shortName, startTime, homeTeam, awayTeam, broadcast, statusName, statusDetail };
}
```

**Primary analog 3 — sports watchparty banner variant** at `js/app.js:7708-7717`:
```javascript
const isSport = !!wp.sportEvent;
const titleHtml = isSport
  ? `<div class="wp-banner-matchup">${escapeHtml(wp.sportEvent.awayTeam || 'Away')}<span class="at">at</span>${escapeHtml(wp.sportEvent.homeTeam || 'Home')}</div>`
  : `<div class="wp-banner-title">${escapeHtml(wp.titleName)}</div>`;
const posterHtml = isSport
  ? `<div class="wp-banner-poster" style="display:grid;place-items:center;font-size:26px;...">${wp.sportEvent.leagueEmoji || '🎮'}</div>`
  : `<div class="wp-banner-poster" style="background-image:url('${wp.titlePoster||''}')"></div>`;
```

**`SportsDataProvider` abstraction** — no existing analog; planner composes from UI-SPEC §REFR-10 contract. Wrap both `loadSportsGames` (ESPN) and a new `loadBalldontlieGames` behind a single interface:
```javascript
const SportsDataProvider = {
  async getSchedule(league, days) { /* routes to ESPN or BALLDONTLIE */ },
  async getScore(gameId) { /* score polling */ },
  async getPlays(gameId, since) { /* play-by-play for catchup */ }
};
```

**Score-strip sticky chrome** — no existing analog within `.wp-live-modal`. Planner composes using existing sticky patterns in `css/app.css` (search for `position:sticky` — `.sports-score-strip` per UI-SPEC §REFR-10 table row 2).

**DVR slider — extend existing reactionDelay pattern** at `js/app.js:7936` (already implements per-user time offset on reaction display):
```javascript
const delayMs = (mine.reactionDelay || 0) * 1000;
// ...
return (r.at || 0) <= (nowMs - delayMs);
```
REFR-10 DVR slider writes to the same `mine.reactionDelay` field (or a new `mine.dvrOffsetMs` — planner chooses; suggest reusing reactionDelay and renaming UI).

**Polling cadence** — planner adds a `setInterval` for score polls inside `openWatchpartyLive`-related flow, 15s off-play / 5s on-play. **TMDB rate-limit discipline** (from CLAUDE.md line 132) does NOT apply here (this is ESPN, not TMDB) — but planner should still cap at 40 req / 10s globally and cache per `(gameId, timestamp-window)`.

---

### REFR-11 — Family tab restructure (Plan 11-02)

**Surface:** `app.html:437-505` section reorder + `js/app.js` consolidate `renderFamilyFavorites` + `renderStats` into `renderCouchHistory`.

**Analog (self — reorder in place):** Existing sections at `app.html:437-505`:
- F1 hero+stats at `:438-443`
- F2 approvals at `:446-451`
- F3 members at `:454-462`
- F4 picker (CUT per REFR-02) at `:465-475`
- F5 family favorites at `:478-487`
- F6 per-member breakdown at `:490-495`
- F7 invite/share at `:498-504`

**Target structure per 11-APPENDIX-TABS-AUDIT.md line 76-82 (LOCKED option b):**
1. Tonight status (new block replacing bare hero content — partial F-NEW-1)
2. Approvals (F2 unchanged)
3. Members (F3 edited — split active / sub-profiles)
4. Couch history (F5 + F6 consolidated, recent-watchparties partial)
5. Group settings footer (F7 reframed with editable group name)

**CUT entirely:** F4 picker section (consequence of REFR-02).

**No new JS patterns — just HTML reorder + consolidation.** `renderStats` at `js/app.js:4477-4515` stays (still emits stats into the Couch-history section under its new parent); `renderFamilyFavorites` at `:4577-...` also stays. Section-grouping is achieved via new `<div class="tab-section">` wrappers.

---

### REFR-12 — Account tab 3-cluster regroup (Plan 11-02)

**Surface:** `app.html:507-652` reorder + new `.tab-section-h` cluster eyebrows.

**Analog (self):** Existing sections at `app.html:507-652`:
- A1 hero+identity at `:509-520`
- A2 YIR card at `:523-531`
- A-legacy-claim at `:537-544`
- A-signin-methods at `:549-553`
- A3 streaming services at `:556-562`
- A4 Trakt at `:565-571`
- A5 notifications at `:574-582`
- A6 sub-profiles at `:585-590`
- A7 owner-admin at `:594-637`
- A8 keyboard shortcuts at `:640-643`
- A9 footer (sign out / leave) at `:646-651`

**Cluster eyebrow pattern** — copy existing `.tab-section-h` at `css/app.css:1056-1061`:
```css
.tab-section-h{font-family:'Inter',sans-serif;font-size:var(--t-eyebrow);
  color:var(--ink-dim);letter-spacing:0.12em;text-transform:uppercase;margin-bottom:var(--s3);
  display:flex;align-items:baseline;justify-content:space-between;gap:var(--s3)}
```

**Target per 11-APPENDIX-TABS-AUDIT.md line 167-183 (LOCKED option b):**
- **Cluster 1 — "YOU"**: A1 identity + A6 sub-profiles
- **Cluster 2 — "YOUR COUCH"**: A3 streaming + A4 Trakt (under new collapsible "Integrations") + A5 notifications + A2 YIR (hidden until Phase 10)
- **Cluster 3 — "ADMIN"**: A7 owner admin (sub-grouped into Security/Members/Lifecycle) + A8 shortcuts + A9 sign out / leave family (with confirmation modal added for destructive "Leave family" per UI-SPEC §Destructive actions)

**Hide YIR until Phase 10:** Add `#yir-card` display:none default, unhide when `state.family.yirReady === true` (similar to how `#notif-card` at `app.html:574` has `style="display:none;"` and `renderSettings` un-hides). Follow existing conditional pattern in `renderSettings()` at `js/app.js:4616`.

---

### REFR-13 — Couch Nights themed packs (Plan 11-07)

**Surfaces:** `app.html` new section on Add tab + new `.couch-night-tile` CSS + `js/app.js` new render + pack-start action + Firestore new collection `packs/` under family doc (or global collection — planner decides; UI-SPEC leaves to planner).

**Analog 1 — tile aesthetic** at `css/app.css:778-785` (`.intent-card`):
```css
.intent-card{flex-shrink:0;width:260px;display:flex;gap:10px;padding:10px;
  background:linear-gradient(135deg,rgba(126,84,138,0.14) 0%,rgba(232,160,74,0.08) 100%);
  border:1px solid rgba(232,160,74,0.28);border-radius:var(--r-lg);
  cursor:pointer;transition:transform var(--t-quick),border-color var(--t-quick)}
.intent-card-poster{width:42px;height:63px;border-radius:6px;background-size:cover;
  background-position:center;flex-shrink:0;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
.intent-card-title{font-family:'Instrument Serif','Fraunces',serif;font-style:italic;
  font-size:var(--t-body);color:var(--ink);line-height:1.2;...}
```

**Analog 2 — picker → action flow** at `js/app.js:7377-7432` (sports picker):
- Modal opens (`openSportsPicker`)
- Loads data (`loadSportsGames`)
- Renders list of tappable cards (`renderSportsGames`)
- Tap creates a new Firestore doc (`scheduleSportsWatchparty` / equivalent)
- Modal closes, live view opens

Copy this shape for "Start this pack": `openCouchNightsPicker()` → `renderCouchNightsPacks(packs)` → tap card → `startCouchNightsPack(packId)` → seeds ballot from pack's pre-loaded titles + opens Vote mode (existing `openSwipeMode` at `:5422-5428`).

**Analog 3 — pack-detail sheet shell** — copy `sports-picker-bg` modal shell at `app.html:853-870`:
```html
<div class="modal-bg" id="sports-picker-bg" onclick="if(event.target.id==='sports-picker-bg')closeSportsPicker()">
  <div class="modal sports-picker-modal">
    <h3 class="modal-h2">Pick a game</h3>
    <div class="meta modal-meta-sub">Upcoming and live, from the major leagues</div>
    <!-- list -->
    <div class="modal-actions-row">
      <button class="pill" onclick="closeSportsPicker()">Close</button>
    </div>
  </div>
</div>
```

**Pack data** — curated JSON shipped as constant (simplest v1, matches CLAUDE.md "public-by-design"). Planner may later move to Firestore; for v1 keep it in `js/constants.js` alongside `MOODS`, `SUBSCRIPTION_BRANDS`, etc.

---

## Shared Patterns

### Authentication / guard
**Source:** `guardReadOnlyWrite()` at `js/app.js:7604` (Plan 5.8 D-15 post-grace read-only).
**Apply to:** All new writes in REFR-05 (host send-share), REFR-07 (Ready-check), REFR-09 (post-session rating + photo), REFR-13 (pack start).
```javascript
if (guardReadOnlyWrite()) return;
```

### Write attribution
**Source:** `writeAttribution()` at `js/utils.js` (referenced at `js/app.js:7644`, `:5393`, `:7678`).
**Apply to:** Every new Firestore write in this phase.
```javascript
await updateDoc(watchpartyRef(id), { /* fields */, ...writeAttribution() });
```

### Haptic + toast feedback
**Source:** `haptic('success')` + `flashToast('...', { kind: 'success' })` — used throughout (e.g. `js/app.js:2931-2932`, `:2947`).
**Apply to:** RSVP confirm, share-link copy fallback, Ready-check toggle, rating save, photo upload success.

### Escape HTML + safe interpolation
**Source:** `escapeHtml()` from `js/utils.js` — used in every `innerHTML` template literal.
**Apply to:** All new template-literal HTML writes in REFR-03/04/07/08/09/10/13.

### Firestore snapshot re-render
**Source:** `onSnapshot` subscription pattern at `js/app.js:3184-3214` (`subscribeSession`) → triggers `renderTonight()` on data change.
**Apply to:** REFR-07 (lobby Ready-check flows — participants subdoc already syncs via existing watchparty snapshot subscription), REFR-09 (post-session modal triggered by `wp.status === 'ended'` transition — use existing watchparty onSnapshot, add a state-transition handler).

### sw.js CACHE bump
**Source:** `sw.js:8` — `const CACHE = 'couch-v21-09-07b-guest-invite';`
**Apply to:** EVERY plan that ships a user-visible change to app shell (11-01, 11-02, 11-03a, 11-03b, 11-04, 11-05, 11-06, 11-07 all qualify). Naming convention: `couch-v{N}-11-{plan-short}` (per CLAUDE.md ✓ rule).

### Modal open/close body-class pattern
**Source:** Every modal in `js/app.js` uses `document.getElementById('XXX-modal-bg').classList.add('on')` / `.remove('on')`.
**Apply to:** All new modals in this phase (REFR-09 post-session, REFR-10 game picker if split from existing sports picker, REFR-13 pack detail sheet).

### TMDB rate-limit budget
**Source:** CLAUDE.md line 132 — *"~40 requests / 10 seconds. Any new TMDB-dependent feature must budget for this"*; existing `ADD_CACHE_TTL` cache discipline at `js/app.js:9010-9011`.
**Apply to:** REFR-04 rotation engine (8-10 rows × 20 items each = risk). Cache per `(rowId, date, user-id)` so hash-seeded selection is stable per-day. Stagger cold-fetches on Add-tab open.

### ESPN/BALLDONTLIE provider caching
**Source:** `sportsGamesCache` at `js/app.js:7374-7375` + `SPORTS_CACHE_TTL = 5 * 60 * 1000`.
**Apply to:** REFR-10 score/play-by-play polls. Use shorter TTL (15s off-play, 5s on-play per UI-SPEC §Tech stack).

---

## No Analog Found

Files/patterns with no close match in the existing Couch codebase — planner should compose from UI-SPEC.md + RESEARCH.md and flag as net-new in plan risk notes.

| Surface | Role | Data Flow | Reason |
|---------|------|-----------|--------|
| `rsvp.html` Firestore write path (no SDK) | Standalone HTTP write | request-response | `landing.html` is brochure-only (no writes). RSVP needs either: (a) unauth'd `onCall` CF — compose from `consumeGuestInvite.js` pattern, OR (b) public Firestore security-rule path. Planner decides at 11-04. |
| `.wp-rating-stars` (5-star tap-to-fill) | CSS component | presentation | Diary uses half-step stars at different density; REFR-09 is whole-star only. Compose from UI-SPEC §REFR-09. |
| Firebase Storage photo upload | Storage API | file-I/O | First Storage use in Couch (CLAUDE.md line 161). No in-repo precedent. Must compose from Firebase Storage SDK docs. Planner adds import to `js/firebase.js` + storage.rules in sibling repo. |
| `SportsDataProvider` interface (ESPN + BALLDONTLIE abstraction) | Data layer | request-response | Current sports code is ESPN-only, inlined. REFR-10 requires pluggable provider. No interface pattern exists in codebase; compose per UI-SPEC §Tech stack. |
| `.sports-score-strip` sticky chrome in `.wp-live-modal` | CSS component | presentation | No existing sticky chrome inside modals. Compose from `position:sticky` + UI-SPEC §Interaction States REFR-10 row 2. |
| Score-delta amplified reaction UI | Event-driven | event-driven | Existing reactions are user-driven; score-delta is auto-emitted. No precedent. Compose from UI-SPEC §REFR-10 table row 3 + existing emoji-burst patterns at `css/app.css:748`. |
| DVR slider HTML range input styled | Form control | request-response | No existing styled range input in Couch. Compose from HTML5 range + UI-SPEC. |
| Web Share API call | Browser API | request-response | Never used in Couch; `createGuestInvite` uses clipboard-only. Copy+adapt per REFR-05 pattern above. |
| Themed-pack seeded-ballot start | Feature glue | CRUD | "Seed a ballot from a pre-loaded title list" has no exact precedent. Closest is spin-candidate-pool construction (Tonight tab). Planner composes at 11-07. |
| Hash-seeded daily row rotation (REFR-04) | Deterministic PRNG | transform | No PRNG utility in codebase. Planner writes xmur3/mulberry32 inline or imports. |
| `/rsvp/**` Firebase Hosting rewrite | Config | config | Current `firebase.json` rewrites `/` → `/landing.html` and `/app` → `/app.html`. REFR-05 adds `/rsvp/**` → `/rsvp.html`. Planner confirms in sibling-repo deploy section of 11-04. |

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\claude-projects\couch\js\app.js` (via Grep + offset/limit Reads — never full)
- `C:\Users\nahde\claude-projects\couch\css\app.css` (via Grep + offset/limit Reads)
- `C:\Users\nahde\claude-projects\couch\app.html` (chunked reads 1-500, 500-990)
- `C:\Users\nahde\claude-projects\couch\landing.html` (full, 163 lines)
- `C:\Users\nahde\claude-projects\couch\css\landing.css` (full, 90 lines)
- `C:\Users\nahde\claude-projects\couch\sw.js` (full, 110 lines)
- `C:\Users\nahde\queuenight\functions\index.js` (targeted reads: onSchedule + sendToMembers callsites + Trakt wrappers)
- `C:\Users\nahde\queuenight\functions\src\inviteGuest.js` (first 80 lines — unauth onCall shape)

**Files scanned:** 8 primary + ls of `functions/src/`
**Pattern extraction date:** 2026-04-24
