# Phase 15: Tracking Layer — Pattern Map

**Date:** 2026-04-26
**Project:** Couch
**Status:** Pattern map complete

> Per CLAUDE.md token-cost rule, every line number below was verified via Grep + targeted offset/limit Read against the working tree. No file was loaded in full where a section read sufficed. Re-derivation by the executor is unnecessary — copy the analog excerpts verbatim and adapt the diff column.

---

## Files to Create or Modify

A unified table maps every Phase 15 file/region to one analog. Per-file detail follows.

| # | File / Region | Role | Reuse strategy | Plan slot (suggested) |
|---|---|---|---|---|
| F1 | `~/queuenight/firestore.rules` — 5th UPDATE branch on `match /families/{familyCode}` | Firestore rules block | extend-in-place (add 5th `||` clause, lines 168-181 trailer) | 15-01 |
| F2 | `~/queuenight/firestore.indexes.json` — composite index `watchparties (titleId asc, startAt asc)` | Firestore index config | extend-in-place (current file is 4 lines, empty `indexes: []`) | 15-01 |
| F3 | `tests/rules.test.js` — Phase 15 block (4-6 new it() blocks) | Rules test | clone-as-sibling (mirror DECI-14-06 `describe('Family doc — couchSeating update (D-06)')` block at line 317) | 15-01 |
| F4 | `js/app.js` — `tupleKey(memberIds)` + `tupleProgressFromTitle(t)` + `tuplesContainingMember(t, memberId)` + `tupleDisplayName(tk, members)` helpers | JS feature module (read primitives) | clone-as-sibling — insert directly above `getMemberProgress` at line 8020 | 15-02 |
| F5 | `js/app.js` — `writeTupleProgress(titleId, memberIds, season, episode, source)` + `clearTupleProgress(titleId, tupleKeyStr)` writers | JS feature module (write primitives) | clone-as-sibling of `writeMemberProgress` at line 8052 / `clearMemberProgress` at line 8072 | 15-02 |
| F6 | `js/app.js` — `setTupleName(tupleKeyStr, name)` writer + `state.family.tupleNames` snapshot hydration | JS feature module (family-doc map writer) | clone-as-sibling of `persistCouchInTonight` at line 13213; snapshot extension inside the family-doc onSnapshot at line 4131-4147 | 15-02 |
| F7 | `js/app.js` — `openPostSession` extension for D-01 auto-track tuple confirmation | JS feature module (extend existing handler) | extend-in-place at line 10438-10456 (insert after `_postSessionRating` reset, before sub render) | 15-03 |
| F8 | `js/app.js` — `writeMutedShow(titleId, memberId, muted)` writer for S6 per-show kill switch | JS feature module (write primitive) | clone-as-sibling of `writeMemberProgress` at line 8052 (same per-member-keyed map shape) | 15-03 |
| F9 | `js/app.js` — `renderCv15TupleProgressSection(t)` + `renderCv15MutedShowToggle(t)` + inline-rename micro-affordance | JS feature module (HTML-template renderer) | clone-as-sibling of `renderTvProgressSection(t)` at line 8291; insertion call site `renderDetailShell` at line 7239 (between `renderReviewsForTitle` line 7239 and `renderTmdbReviewsForTitle` line 7240) | 15-04 |
| F10 | `app.html` — `<div id="cv15-pickup-container">` Tonight tab anchor | HTML template fragment | clone-as-sibling of `<div id="continue-section">` at app.html:374; INSERT between line 317 (`#couch-viz-container`) and line 320 (`#flow-a-entry-container`) | 15-05 |
| F11 | `js/app.js` — `renderPickupWidget()` Tonight S1 widget renderer | JS feature module (HTML-template renderer) | clone-as-sibling of `renderContinueWatching` at line 8399; HOOK inside `renderTonight` at line 4730-4736 (add new line after line 4733 OR after line 4884 per UI-SPEC ordering) | 15-05 |
| F12 | `css/app.css` — `=== Phase 15 — Tracking Layer ===` block with `.cv15-*` selectors | CSS section | clone-as-sibling of `.continue-card` block at line 2062-2083 + `.detail-section` echo at 1550-1551 + `.flow-b-counter-row` echo at 3101-3110 | 15-04 + 15-05 |
| F13 | `~/queuenight/functions/index.js` — extend `watchpartyTick` with tracking sweep (D-11/D-13/D-14/D-15/D-16) | Cloud Function (per-doc loop branch) | extend-in-place — insert NEW per-titles loop INSIDE `watchpartyTick` at line 843 (after intents loop, before closing brace at line 844) | 15-06 |
| F14 | `~/queuenight/functions/index.js` — `NOTIFICATION_DEFAULTS` 8th key `newSeasonAirDate: true` | Cloud Function config triad (place 1 of 3) | extend-in-place at line 95 (extend Object.freeze block) | 15-07 |
| F15 | `js/app.js` — `DEFAULT_NOTIFICATION_PREFS` 8th key `newSeasonAirDate: true` | Config triad (place 2 of 3) | extend-in-place at line 120 (extend Object.freeze block) | 15-07 |
| F16 | `js/app.js` — `NOTIFICATION_EVENT_LABELS` 8th key with BRAND-voice label/hint | Config triad (place 3 of 3) | extend-in-place at line 147 (extend Object.freeze block) | 15-07 |
| F17 | `js/app.js` — `trakt.ingestSyncData` augmentation: capture per-episode `last_watched_at` for D-06 overlap detection | JS feature module (extend Trakt ingest loop) | extend-in-place at lines 715-721 (3-line addition inside the seasons.episodes loop) | 15-08 |
| F18 | `js/app.js` — `trakt.detectAndPromptCoWatchOverlap()` + `state._coWatchPromptQueue` + `renderCv15CoWatchPromptModal()` (D-06 / S5) | JS feature module (sibling primitive) | clone-as-sibling — `detect…` near `trakt.sync` end (~line 660); `render…` near `renderFlowBNominateScreen` at line 1882 (modal-bg shell precedent) | 15-08 |
| F19 | `sw.js` — bump `CACHE` constant | sw.js CACHE | extend-in-place at line 8 (`const CACHE = 'couch-v34.1.3-…'` → `'couch-v35.0-tracking-layer'`) | 15-09 |
| F20 | `changelog.html` — v35 release article | HTML template fragment | clone-as-sibling of v34 article at lines 67-79 | 15-09 |

---

## Pattern Assignments

### F1 — `~/queuenight/firestore.rules` 5th UPDATE branch

- **Role:** Firestore rules block
- **Analog:** `~/queuenight/firestore.rules:168-181` (4th branch, couchInTonight V5 from 14-10)
- **Reuse strategy:** extend-in-place — add 5th `||` clause after line 181's closing `);`
- **Insertion anchor:** after the `couchInTonight` branch's closing `);` at line 181; comment `// === Phase 15 / D-02 — tupleNames write ===`
- **Excerpt from analog (firestore.rules:168-181):**
  ```javascript
        ) || (
          // 14-10 (DECI-14-06 redesign per sketch 003 V5): couchInTonight write —
          // attribution-required. Any family member can write any member's slot
          // (proxy-fill is a feature, not a bug — one operator marks family in).
          // Audit trail via proxyConfirmedBy field embedded in the per-member
          // payload (NOT in affectedKeys; it's nested inside couchInTonight).
          // The allowlist also names couchSeating because persistCouchInTonight
          // dual-writes both shapes for one PWA cache cycle. After the cycle
          // elapses, a follow-up plan will drop couchSeating from this allowlist
          // AND the third branch above.
          attributedWrite(familyCode)
          && request.resource.data.diff(resource.data).affectedKeys()
              .hasOnly(['couchInTonight', 'couchSeating', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
        );
  ```
- **Why this analog:** `tupleNames` is the same shape — a family-doc-level map written by attributed family members. The `attributedWrite()` helper plus `affectedKeys().hasOnly([...])` is the EXACT primitive needed.
- **Adaptations needed:**
  - Replace allowlist with `['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName']`.
  - Add Phase 15 banner comment.
  - Per RESEARCH §Q14: NO change required for `t.tupleProgress` or `t.mutedShows` (covered by permissive `match /titles/{titleId}` block at lines 317-319; explicit comment block at 307-315 already permits new top-level title fields).

---

### F2 — `~/queuenight/firestore.indexes.json` composite index

- **Role:** Firestore index config
- **Analog:** No prior composite index ships in this repo (file is 4 lines, empty `indexes: []`). Closest documented pattern is the indexes mentioned in the deploy-mirror; the `where('titleId','==',...).where('startAt','>=',...).where('startAt','<=',...)` query in the new CF requires this index.
- **Reuse strategy:** extend-in-place (replace empty array with single-element array)
- **Insertion anchor:** the `"indexes": []` line in the JSON (line 2)
- **Excerpt from current file (firestore.indexes.json:1-4):**
  ```json
  {
    "indexes": [],
    "fieldOverrides": []
  }
  ```
- **Why this analog:** No-op file currently. Phase 15 introduces the FIRST composite index. The shape (per Firebase docs) is canonical — RESEARCH §Q8 spelled out the 6-line block.
- **Adaptations needed:** insert the watchparties composite index per RESEARCH §Q8 verbatim:
  ```json
  {"indexes":[{"collectionGroup":"watchparties","queryScope":"COLLECTION","fields":[{"fieldPath":"titleId","order":"ASCENDING"},{"fieldPath":"startAt","order":"ASCENDING"}]}],"fieldOverrides":[]}
  ```

---

### F3 — `tests/rules.test.js` Phase 15 test block

- **Role:** Rules test (firebase-rules-unit-testing)
- **Analog:** `tests/rules.test.js:317-386` — 14-06's `describe('Family doc — couchSeating update (D-06)')` block (4 tests, #19-#22)
- **Reuse strategy:** clone-as-sibling — append a NEW `describe('Family doc — tupleNames update (Phase 15 / D-02)')` block at line 386 (just before `await testEnv.cleanup()` at line 388)
- **Insertion anchor:** add directly before `await testEnv.cleanup();` at line 388
- **Excerpt from analog (tests/rules.test.js:317-330):**
  ```javascript
    await describe('Family doc — couchSeating update (D-06)', async () => {
      await it('#19 authed member writes couchSeating + attribution → ALLOWED', async () => {
        await assertSucceeds(
          member.doc('families/fam1').set(
            {
              couchSeating: { 'm_UID_MEMBER': 0, 'm_UID_OWNER': 1 },
              actingUid: UID_MEMBER,
              memberId: 'm_UID_MEMBER',
              memberName: 'Member',
            },
            { merge: true }
          )
        );
      });
  ```
- **Why this analog:** Test #19-#22 cover the exact 4-case matrix Phase 15 needs (happy / no-attribution / non-allowlisted-field / stranger). The `member`, `stranger`, `assertSucceeds`, `assertFails`, `withSecurityRulesDisabled` primitives are already imported.
- **Adaptations needed:**
  - Number the new tests #23-#28 (continuing the running count).
  - Replace `couchSeating` with `tupleNames` everywhere; payload becomes `tupleNames: { 'm_alice,m_bob': { name: 'Date night', setBy: 'm_UID_MEMBER', setAt: 1234 } }`.
  - Per RESEARCH §Q15 add 2 sibling tests for `t.tupleProgress[tk]` and `t.mutedShows[memberId]` writes on title docs (positive regression — should pass under existing permissive title rule at firestore.rules:319).

---

### F4 — `js/app.js` tuple read helpers (sibling primitives)

- **Role:** JS feature module (pure read primitives + decorative-name resolver)
- **Analog:** `js/app.js:8020-8049` — `getMemberProgress` + `membersWithProgress` per-individual reads
- **Reuse strategy:** clone-as-sibling — insert NEW helpers DIRECTLY ABOVE the existing `getMemberProgress` at line 8020 (atomic-sibling-primitive convention from Phase 14-05)
- **Insertion anchor:** grep marker `// === Phase 15 — Tracking Layer ===` at line 8019 (immediately above `function getMemberProgress`)
- **Excerpt from analog (js/app.js:8036-8049):**
  ```javascript
  // Which members have *any* progress on this title. Used for the card pill.
  function membersWithProgress(t) {
    const ids = new Set();
    if (t.progress) {
      Object.keys(t.progress).forEach(id => {
        const p = t.progress[id];
        if (p && p.season != null && p.episode != null) ids.add(id);
      });
    }
    // Legacy shared data counts as the current user's progress if they don't already have per-member
    if (state.me && t.progressSeason != null && t.progressEpisode != null && !ids.has(state.me.id)) {
      ids.add(state.me.id);
    }
    return [...ids].map(id => state.members.find(m => m.id === id)).filter(Boolean);
  }
  ```
- **Why this analog:** Same shape (read map keyed by string), same null-safety pattern, same return-array-of-member-objects convention. Phase 15 helpers do the SAME thing but key off `tupleKey` instead of `memberId`.
- **Adaptations needed:**
  - `tupleKey(memberIds)` per RESEARCH §Q2: `[...memberIds].filter(Boolean).sort().join(',')`.
  - `tupleProgressFromTitle(t)`: returns `t.tupleProgress || {}`.
  - `tuplesContainingMember(t, memberId)`: walks tupleProgress, splits each key on comma, includes if `memberId` is in the split.
  - `tupleDisplayName(tk, members)`: reads `state.family.tupleNames[tk]?.name`; falls back to derived "Wife and me" / "You (solo)" / "You + 2" per RESEARCH §Q3 (planner locks exact derivation copy from UI-SPEC).

---

### F5 — `js/app.js` tuple writer primitives

- **Role:** JS feature module (Firestore writers)
- **Analog:** `js/app.js:8052-8081` — `writeMemberProgress` + `clearMemberProgress`
- **Reuse strategy:** clone-as-sibling — insert NEW writers directly between existing `clearMemberProgress` (line 8081) and `window.advanceEpisode` (line 8084)
- **Insertion anchor:** grep marker `// === Phase 15 — Tracking Layer (writers) ===` after line 8081
- **Excerpt from analog (js/app.js:8052-8081):**
  ```javascript
  // Write a member's progress. Always goes to the new per-member map.
  async function writeMemberProgress(titleId, memberId, season, episode) {
    if (!titleId || !memberId) return;
    const t = state.titles.find(x => x.id === titleId);
    if (!t) return;
    const prevProgress = t.progress && typeof t.progress === 'object' ? { ...t.progress } : {};
    prevProgress[memberId] = { season: season, episode: episode, updatedAt: Date.now() };
    try {
      await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), progress: prevProgress });
    } catch(e) { console.warn('progress write failed', e); }
    // Push to Trakt if connected and this is the current user's own progress.
    if (state.me && memberId === state.me.id && t.tmdbId && t.kind === 'TV') {
      if (typeof trakt !== 'undefined' && trakt && trakt.pushEpisodeWatch) {
        trakt.pushEpisodeWatch(t.tmdbId, season, episode).catch(() => {});
      }
    }
  }

  // Clear a member's progress (when they say "I haven't started this")
  async function clearMemberProgress(titleId, memberId) {
    if (!titleId || !memberId) return;
    const t = state.titles.find(x => x.id === titleId);
    if (!t) return;
    const prevProgress = t.progress && typeof t.progress === 'object' ? { ...t.progress } : {};
    delete prevProgress[memberId];
    try {
      await updateDoc(doc(titlesRef(), titleId), { ...writeAttribution(), progress: prevProgress });
    } catch(e) { console.warn('progress clear failed', e); }
  }
  ```
- **Why this analog:** Identical write shape — title-doc update, member-keyed-map field, `writeAttribution()` spread, fire-and-forget try/catch. Phase 15 writers swap the `progress` field for `tupleProgress` and key off `tupleKey(memberIds)` instead of `memberId`.
- **Adaptations needed:**
  - `writeTupleProgress(titleId, memberIds, season, episode, source)` — accept `source` param (`'watchparty' | 'manual' | 'trakt-overlap'`) for D-05/D-06 attribution.
  - DROP the `trakt.pushEpisodeWatch` call — D-08 specifies independent tuples; group writes do NOT push to anyone's Trakt account.
  - `writeMutedShow(titleId, memberId, muted)` — extends `writeMemberProgress` shape but the field is `mutedShows` (set `true` or delete key), still member-keyed, same `updateDoc` wrapper.

---

### F6 — `js/app.js` tupleNames writer + family-doc snapshot hydration

- **Role:** JS feature module (family-doc-level writer + onSnapshot hook)
- **Analog:** `js/app.js:13213-13236` — `persistCouchInTonight` family-doc writer; `js/app.js:4131-4149` — family-doc onSnapshot
- **Reuse strategy:** clone-as-sibling for the writer (next to `persistCouchInTonight`); extend-in-place for the snapshot
- **Insertion anchor (writer):** grep marker `// === Phase 15 — Tracking Layer (tupleNames writer) ===` immediately after line 13236
- **Insertion anchor (snapshot hook):** add a single line after line 13145 (after `state.couchInTonight` and `state.couchMemberIds` hydration)
- **Excerpt from analog writer (js/app.js:13213-13236):**
  ```javascript
  async function persistCouchInTonight() {
    if (!state.familyCode) return;
    const cit = state.couchInTonight || {};
    // Build legacy couchSeating map for back-compat...
    const seatingMap = {};
    let nextIdx = 0;
    (state.members || []).forEach(m => {
      if (cit[m.id] && cit[m.id].in === true) {
        seatingMap[m.id] = nextIdx++;
      }
    });
    try {
      await updateDoc(doc(db, 'families', state.familyCode), {
        couchInTonight: cit,
        couchSeating: seatingMap,
        ...writeAttribution()
      });
    } catch (e) {
      console.error('[couch] persist failed', e);
      flashToast('Could not save couch — try again', { kind: 'warn' });
    }
  }
  ```
- **Excerpt from analog snapshot hook (js/app.js:4131-4147):**
  ```javascript
  state.unsubGroup = onSnapshot(familyDocRef(), s => {
    if (!s.exists()) return;
    const d = s.data();
    state.group = { ...(state.group||{}), code: state.familyCode, ... };
    state.ownerUid = d.ownerUid || null;
    state.couchInTonight = couchInTonightFromDoc(d);
    state.couchMemberIds = couchInTonightToMemberIds(state.couchInTonight);
    state.selectedMembers = state.couchMemberIds.slice();
    if (typeof renderCouchViz === 'function') renderCouchViz();
    if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
    renderPickerCard();
  ```
- **Why this analog:** `persistCouchInTonight` is the canonical family-doc-level writer that uses `doc(db, 'families', state.familyCode)` + `writeAttribution()` + flashToast error path. The onSnapshot hydration is the ONLY snapshot for family-doc-level fields.
- **Adaptations needed:**
  - `setTupleName(tupleKeyStr, name)` writes `{ [`tupleNames.${tupleKeyStr}`]: { name: name.slice(0,40), setBy: state.me.id, setAt: Date.now() } }` plus `...writeAttribution()`. Uses dotted-path field write (NOT full-map replace) so concurrent renames don't clobber.
  - On Firestore failure: flashToast `"Couldn't save name — try again"` per UI-SPEC Copywriting Contract.
  - Snapshot extension: `state.family = state.family || {}; state.family.tupleNames = (d && d.tupleNames) || {};` after line 4145 (before `renderCouchViz` so any current detail-modal re-render picks up the new map).

---

### F7 — `js/app.js` `openPostSession` D-01 auto-track extension

- **Role:** JS feature module (extend existing post-session handler)
- **Analog:** `js/app.js:10438-10456` — `window.openPostSession`
- **Reuse strategy:** extend-in-place at line 10445 (after `_postSessionRating = 0;` reset, before sub render at line 10446)
- **Insertion anchor:** grep marker `// === Phase 15 / D-01 — auto-track tuple progress ===` inserted at line 10446
- **Excerpt from analog (js/app.js:10438-10456):**
  ```javascript
  window.openPostSession = function(wpId) {
    const wp = state.watchparties && state.watchparties.find(x => x.id === wpId);
    if (!wp || !state.me) return;
    const dismissed = wp.postSessionDismissedBy && wp.postSessionDismissedBy[state.me.id];
    const alreadyRated = wp.ratings && wp.ratings[state.me.id];
    if (dismissed || alreadyRated) return;
    _postSessionWpId = wpId;
    _postSessionRating = 0;
    const sub = document.getElementById('wp-post-session-sub');
    if (sub) sub.innerHTML = `<em>How was ${escapeHtml(wp.titleName || 'that')}?</em>`;
    // Reset rating + photo UI
    document.querySelectorAll('.wp-rating-star').forEach(s => { s.classList.remove('filled'); s.innerHTML = '&#9734;'; });
    const rc = document.getElementById('wp-rating-confirm'); if (rc) rc.style.display = 'none';
    const pp = document.getElementById('wp-photo-preview'); if (pp) { pp.style.display = 'none'; pp.innerHTML = ''; }
    const pt = document.getElementById('wp-photo-upload-tile'); if (pt) pt.style.display = '';
    const pi = document.getElementById('wp-photo-input'); if (pi) pi.value = '';
    const bg = document.getElementById('wp-post-session-modal-bg');
    if (bg) bg.classList.add('on');
  };
  ```
- **Why this analog:** This handler runs ONCE per actor per watchparty (gated by `dismissed || alreadyRated` early return). It already has `wp.participants`, `wp.titleId`, `state.me` in scope — exactly what the D-01 tuple write needs. RESEARCH §Q9 picked this over `endMyWatchparty` (line 10601) precisely because of the per-actor scope.
- **Adaptations needed:**
  - Compute `wpParticipants = Object.keys(wp.participants || {}).filter(mid => wp.participants[mid] && wp.participants[mid].startedAt)` (mirrors `endMyWatchparty:10608` filter).
  - Look up `t = state.titles.find(x => x.id === wp.titleId)`; gate on `t.kind === 'TV'`.
  - Inferred episode: `t.progress[wp.hostId]?.episode + 1` (per RESEARCH §Q9 option (a)).
  - Stash to `state._pendingTupleAutoTrack = { titleId, memberIds, season, episode, sourceWpId: wpId }` so the post-session modal sub-template can render an inline confirmation row ("Mark S{N} E{M} for {tupleName}?" Yes/Edit) — actual confirmation UI handled by 15-04 once the renderer scaffold lands.

---

### F8 — `js/app.js` `writeMutedShow(titleId, memberId, muted)` writer

- **Role:** JS feature module (per-member-keyed map writer)
- **Analog:** `js/app.js:8052-8068` — `writeMemberProgress` (but for the `mutedShows` field instead of `progress`)
- **Reuse strategy:** clone-as-sibling — insert next to `writeTupleProgress` (F5), after line 8081
- **Insertion anchor:** same grep block as F5
- **Excerpt from analog:** see F5 above (writeMemberProgress lines 8052-8068)
- **Why this analog:** Same per-member-keyed map shape (`{ [memberId]: true }`); same `attributedWrite()` regime via the existing permissive title rule (firestore.rules:317-319). RESEARCH §Q15 confirms NO new rules branch needed.
- **Adaptations needed:**
  - On `muted=true`: write `{ [`mutedShows.${memberId}`]: true, ...writeAttribution() }` (dotted-path).
  - On `muted=false`: write `{ [`mutedShows.${memberId}`]: deleteField(), ...writeAttribution() }` — match the `deleteField()` pattern at `js/app.js:236-237`.
  - DROP the Trakt push side-effect (mute is purely local prefs).

---

### F9 — `js/app.js` S2 detail-modal section + S3 inline rename + S6 nested kill switch

- **Role:** JS feature module (HTML-template renderer + inline UX)
- **Analog:** `js/app.js:8291-8325` — `renderTvProgressSection(t)` (the per-INDIVIDUAL section that Phase 15 sits ABOVE / NEXT TO, NOT replaces)
- **Reuse strategy:** clone-as-sibling — insert NEW `renderCv15TupleProgressSection(t)` directly above the existing `renderTvProgressSection` at line 8291; HOOK into `renderDetailShell` between line 7239 and 7240
- **Insertion anchor (renderer):** grep marker `// === Phase 15 / S2 — Your couch's progress (tuple-aware) ===` at line 8290
- **Insertion anchor (call site):** between `${renderReviewsForTitle(t)}` (line 7239) and `${renderTmdbReviewsForTitle(t)}` (line 7240) — per UI-SPEC §Surface inventory "ABOVE reviews, BELOW cast"
- **Excerpt from analog (js/app.js:8291-8325):**
  ```javascript
  function renderTvProgressSection(t) {
    if (t.kind !== 'TV' || t.watched) return '';
    if (!state.members || !state.members.length) return '';
    const meId = state.me && state.me.id;
    const statusStripHtml = renderDetailStatusStrip(t, meId);
    const rows = state.members.map(m => {
      const p = getMemberProgress(t, m.id);
      const isMe = meId === m.id;
      const posHtml = p
        ? `<div class="progress-row-pos">S${p.season} · E${p.episode}</div>`
        : `<div class="progress-row-pos unset">Not started</div>`;
      const actions = [];
      if (p && isMe) {
        actions.push(`<button class="pill accent" onclick="advanceEpisode('${t.id}',event)">Next ep ▸</button>`);
      }
      actions.push(`<button class="pill" onclick="openProgressSheet('${t.id}','${m.id}')">${p ? 'Edit' : 'Set'}</button>`);
      return `<div class="progress-row">
        <div class="who-avatar" style="background:${m.color}">${avatarContent(m)}</div>
        <div class="progress-row-body">
          <div class="progress-row-name">${escapeHtml(m.name)}${isMe?' <span style="color:var(--accent);font-size:var(--t-eyebrow);font-weight:600;">you</span>':''}</div>
          ${posHtml}
        </div>
        <div class="progress-row-actions">${actions.join('')}</div>
      </div>`;
    }).join('');
    const totalSub = t.seasons ? `${t.seasons} season${t.seasons===1?'':'s'} total` : '';
    return `<div class="detail-section detail-progress">
      <div class="detail-progress-h">Progress${totalSub?` · ${totalSub}`:''}</div>
      ${statusStripHtml}
      ${rows}
    </div>`;
  }
  ```
- **Why this analog:** Same section shell, same `<div class="detail-section">` wrapper (which gets `--s5` top margin from css/app.css:1550), same row-flex layout, same `escapeHtml` + `state.members.find(m => m.id === ...)` resolution. Phase 15 swaps "iterate state.members" for "iterate Object.entries(t.tupleProgress)".
- **Adaptations needed:**
  - Use `<h4>` eyebrow (matches Phase 14-05 style) instead of the legacy `<div class="detail-progress-h">` — per UI-SPEC §Color: "YOUR COUCH'S PROGRESS" eyebrow uses `.detail-section h4` from css/app.css:1551 verbatim.
  - Class names: `.cv15-progress-row`, `.cv15-tuple-name`, `.cv15-tuple-rename`, `.cv15-progress-pos`, `.cv15-progress-time`, `.cv15-mute-toggle` (couch-v15 namespace).
  - Sort by `watchedAt` desc; slice to max 4 rows; if more, append "View all (N)" affordance per UI-SPEC §Cross-tuple visual handling.
  - Unnamed tuples render `<span class="cv15-tuple-name unnamed"><em>name this couch</em></span>` (italic Instrument Serif, `--ink-dim`) per UI-SPEC §Copywriting "*name this couch*".
  - Pencil affordance: `<button class="cv15-tuple-rename" aria-label="Rename this couch">✎</button>` — onclick reveals an inline `<input type="text" maxlength="40" placeholder="e.g. Date night">` overlay; Enter saves via `setTupleName`, Esc cancels, blur saves; flash toast on save/error per UI-SPEC.
  - S6 nested kill-switch at the bottom of the section (NOT a separate section): `<button class="cv15-mute-toggle" onclick="toggleMutedShow('${t.id}')">{copy}</button>` — copy depends on `t.mutedShows[meId]` state per UI-SPEC.
  - Empty state: return `''` if `Object.keys(t.tupleProgress || {}).length === 0` AND no Trakt-or-watchparty signal (per UI-SPEC §Empty states row 2).

---

### F10 — `app.html` `<div id="cv15-pickup-container">` Tonight tab anchor

- **Role:** HTML template fragment
- **Analog:** `app.html:374` — `<div id="continue-section" class="t-section" style="display:none;"></div>`
- **Reuse strategy:** clone-as-sibling — insert NEW container between line 317 (`#couch-viz-container`) and line 320 (`#flow-a-entry-container`)
- **Insertion anchor:** between `<div id="couch-viz-container">` (line 317) and `<div id="flow-a-entry-container">` (line 320)
- **Excerpt from analog (app.html:374):**
  ```html
  <div id="continue-section" class="t-section" style="display:none;"></div>
  ```
- **Why this analog:** Same idiom — empty `<div>` populated by a JS renderer via `innerHTML`. The `t-section` class supplies the standard top-margin rhythm. Hidden by default (`display:none`) so the renderer flips it visible only when there's data to show.
- **Adaptations needed:**
  - Use `id="cv15-pickup-container"` and `class="t-section cv15-pickup-container"` per UI-SPEC §Discretion Q1 ("Hybrid — new `.tab-list-card` shell WITH the row-internals borrowed from 14-05").
  - Add `aria-label="Pick up where you left off"` (UI-SPEC's S1 hint).
  - DON'T set `style="display:none;"` — UI-SPEC §Discretion Q7 says the widget HIDES via the renderer (`el.style.display = 'none'`) only when zero tuples; default initial state can be empty `<div>`.

---

### F11 — `js/app.js` `renderPickupWidget()` Tonight S1 widget renderer

- **Role:** JS feature module (HTML-template renderer)
- **Analog:** `js/app.js:8399-8439` — `renderContinueWatching()` (cross-show per-individual continue card list)
- **Reuse strategy:** clone-as-sibling — insert NEW `renderPickupWidget()` directly above the existing `renderContinueWatching` at line 8399; HOOK into `renderTonight` at line 4733 (call BEFORE existing `renderContinueWatching` so S1 sits above #continue-section) AND in app.html the container is above flow-a-entry — verify ordering: per UI-SPEC §Surface insertion order, S1 sits BELOW couch viz, ABOVE Flow A entry, so the DOM container is above; the render-call order doesn't matter as long as both populate distinct anchors
- **Insertion anchor (renderer):** grep marker `// === Phase 15 / S1 — Pick up where you left off (tuple-aware cross-show) ===` at line 8398
- **Insertion anchor (renderTonight hook):** insert `renderPickupWidget();` at line 4734 (between `renderContinueWatching();` line 4733 and `renderNext3();` line 4734)
- **Excerpt from analog (js/app.js:8399-8439):**
  ```javascript
  function renderContinueWatching() {
    const el = document.getElementById('continue-section');
    if (!el) return;
    if (!state.me) { el.style.display = 'none'; return; }
    const meId = state.me.id;
    // Show TV shows where the current user has progress set, newest first.
    const list = state.titles
      .filter(t => {
        if (t.kind !== 'TV' || t.watched) return false;
        if (isHiddenByScope(t)) return false;
        return !!getMemberProgress(t, meId);
      })
      .map(t => ({ t, prog: getMemberProgress(t, meId) }))
      .sort((a,b) => (b.prog.updatedAt||0) - (a.prog.updatedAt||0))
      .slice(0,4);
    if (!list.length) { el.style.display = 'none'; return; }
    el.style.display = 'block';
    el.innerHTML = `<div class="t-section-head"><div class="t-section-title">Continue watching</div><div class="t-section-meta">Your TV shows</div></div>` +
      list.map(({t, prog}) => {
        const subParts = [];
        if (t.seasons) subParts.push(`${t.seasons} season${t.seasons===1?'':'s'} total`);
        const badge = tvStatusBadge(t, meId);
        let badgeHtml = '';
        if (badge) {
          badgeHtml = `<span class="tv-status-badge ${badge.kind}" style="margin-left:auto;">${escapeHtml(badge.text)}</span>`;
        }
        return `<div class="continue-card" onclick="openDetailModal('${t.id}')">
          <div class="continue-poster" style="background-image:url('${t.poster||''}')"></div>
          <div class="continue-info" style="display:flex;flex-direction:column;gap:3px;">
            <div style="display:flex;align-items:center;gap:var(--s2);">
              <div class="continue-name" style="flex:1;min-width:0;">${escapeHtml(t.name)}</div>
              ${badgeHtml}
            </div>
            <div class="continue-pos">S${prog.season} · Episode ${prog.episode}</div>
            <div class="continue-sub">${subParts.join(' · ')}</div>
          </div>
        </div>`;
      }).join('');
  }
  ```
- **Why this analog:** EXACT shape — element lookup + early-return-on-no-data + filter/map/sort/slice over `state.titles` + innerHTML template. Phase 15's S1 does the same thing but the filter is "tuples containing me" instead of "I have progress" and the row visual swaps the show-name-only header for `show_title + sub-line(tuple_name + relative_time)`.
- **Adaptations needed:**
  - `el = document.getElementById('cv15-pickup-container')`.
  - Filter: walk `state.titles` where `t.kind === 'TV'` AND `tuplesContainingMember(t, meId).length > 0`.
  - For each title, find the most-recent tuple containing me: `tuplesContainingMember(t, meId).sort((a,b) => (b.prog.updatedAt||0) - (a.prog.updatedAt||0))[0]`.
  - Sort the cross-show list by that selected tuple's `updatedAt` desc; slice to MAX 3 (UI-SPEC §Cross-tuple visual handling: "Max 3 rows visible on Tonight").
  - Inner HTML uses `.cv15-progress-row` class with eyebrow "PICK UP WHERE YOU LEFT OFF" (UI-SPEC §Copywriting eyebrow).
  - Each row: `[show title big] [S{N} · E{M}] / [tupleName · relative_time] [Continue button .tc-primary]`.
  - Per UI-SPEC §Empty states: when `list.length === 0`, set `el.style.display = 'none'` (NO empty card).
  - Continue button onclick → `openDetailModal('${t.id}')` (or, planner can decide: pre-prime `openProgressSheet` directly to advance episode in one tap).

---

### F12 — `css/app.css` Phase 15 namespace block

- **Role:** CSS section
- **Analog:** `.continue-card` block at css/app.css:2062-2083 (visual idiom for a horizontal show-row card on Tonight); `.detail-section h4` at css/app.css:1551 (eyebrow style — REUSED, NOT redeclared); `.flow-b-counter-row` at css/app.css:3101-3110 (modal-internal row layout for S5 conflict prompt); `.modal-bg` + `.modal-content` at css/app.css:478-497 (S5 modal shell — REUSED, NOT redeclared); `.tc-want-pill` at css/app.css:3391+ (micro-avatar pattern reference, intentionally NOT used per UI-SPEC §Integration note)
- **Reuse strategy:** clone-as-sibling — insert single new block at end of css/app.css (after line 2360 / before the desktop @media block) wrapped in grep markers
- **Insertion anchor:** grep marker `/* === Phase 15 — Tracking Layer === */` at the end of the file (or right before the `@media (min-width:900px)` desktop block per CLAUDE.md "css/app.css ~line 2360")
- **Excerpt from analog (css/app.css:2062-2079):**
  ```css
  .continue-card{display:flex;gap:var(--s3);background:var(--surface);
    border:1px solid var(--border);border-left:3px solid var(--accent);
    border-radius:var(--r-md);padding:var(--s3);margin-bottom:var(--s2);
    cursor:pointer;transition:border-color var(--t-quick),transform var(--t-quick)}
  .continue-card:hover{border-color:var(--border-accent);transform:translateY(-1px)}
  .continue-poster{width:54px;height:80px;border-radius:var(--r-sm);
    background-size:cover;background-position:center;background-color:var(--surface-2);
    flex-shrink:0;box-shadow:var(--shadow-soft)}
  .continue-info{flex:1;min-width:0}
  .continue-name{font-family:'Instrument Serif','Fraunces',serif;font-style:italic;
    font-weight:400;font-size:var(--t-h3);letter-spacing:-0.015em;
    color:var(--ink);line-height:1.15;margin-bottom:3px;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .continue-pos{font-family:'Geist Mono','SF Mono',Menlo,monospace;
    font-size:var(--t-meta);color:var(--accent);font-weight:500;
    letter-spacing:0.04em;margin-bottom:2px}
  ```
- **Excerpt from analog modal shell (css/app.css:478-497):**
  ```css
  .modal-bg{display:none;position:fixed;inset:0;
    background:rgba(8,6,5,0.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    z-index:100;align-items:flex-end;justify-content:center;
    animation:modal-fade-in var(--t-base) var(--var(--ease-out))}
  .modal-bg.on{display:flex}
  .modal{background:var(--surface);border-radius:24px 24px 0 0;
    border-top:1px solid var(--border-strong);
    padding:var(--s5) var(--s5) var(--s6);width:100%;max-width:480px;max-height:85vh;
    overflow-y:auto;
    box-shadow:0 -24px 80px rgba(0,0,0,0.65),0 0 0 1px rgba(232,160,74,0.04);
    animation:modal-slide-up var(--t-cinema) var(--var(--ease-out)-cinema)}
  ```
- **Why this analog:** `.continue-card` already establishes the warm-dark Tonight-tab card visual at the size Phase 15 needs. Phase 15's `.cv15-pickup-container` row visual is a sibling, not a replacement, sharing the surface tone but adapting the layout (left = show title big, right = episode meta + Continue button) per UI-SPEC §Cross-tuple visual handling.
- **Adaptations needed:**
  - All new selectors use `.cv15-` namespace per UI-SPEC §Integration with existing patterns.
  - Reuse `--s1..--s8` spacing primitives + `--space-stack-md` / `--space-section` semantic aliases per UI-SPEC §Spacing Scale.
  - Reuse existing color tokens: `--bg`, `--surface-2`, `--surface`, `--accent`, `--ink`, `--ink-warm`, `--ink-dim`, `--ink-faint`, `--bad` per UI-SPEC §Color (zero new tokens).
  - For S5 conflict-prompt modal: REUSE `.modal-bg` shell verbatim; inner uses a NEW `.cv15-cowatch-prompt` content class with `max-width:320px; padding:var(--s5); border-radius:var(--r-md);` per UI-SPEC §Discretion Q4.
  - Reduced-motion clamp via existing `@media (prefers-reduced-motion: reduce)` block (UI-SPEC §Motion).

---

### F13 — `~/queuenight/functions/index.js` `watchpartyTick` extension (D-11/D-13/D-14/D-15/D-16)

- **Role:** Cloud Function (per-doc loop branch)
- **Analog:** `~/queuenight/functions/index.js:642-847` (`watchpartyTick`); specifically the intents-loop branches B + C at lines 730-838 (Flow B auto-convert + intentExpiring warning push)
- **Reuse strategy:** extend-in-place — insert NEW per-titles-doc loop INSIDE `watchpartyTick`'s outer `for (const familyDoc of families.docs)` loop, AFTER the intents loop closing brace at line 843, BEFORE the outer-loop closing brace at line 844
- **Insertion anchor:** grep marker `// === Phase 15 / D-11 + D-13 + D-14 + D-15 + D-16 — live-release sweep ===` at line 843
- **Excerpt from analog (functions/index.js:730-782):**
  ```javascript
        // === Branch B — Flow B auto-convert at T-15min (D-08) ===
        if (flow === 'nominate' && intent.proposedStartAt) {
          const minutesBefore = (intent.proposedStartAt - now) / 60000;
          const hasYes = Object.values(intent.rsvps || {}).some(r =>
            r && (r.state === 'in' || r.value === 'yes')
          );
          if (minutesBefore <= 15 && minutesBefore > 0 && hasYes) {
            const wpRef = db.collection('families').doc(familyDoc.id).collection('watchparties').doc();
            await wpRef.set({
              status: 'scheduled',
              hostId: intent.createdBy,
              hostUid: intent.createdByUid || null,
              hostName: intent.createdByName || null,
              titleId: intent.titleId,
              startAt: intent.proposedStartAt,
              creatorTimeZone: intent.creatorTimeZone || null,
              createdAt: now,
              convertedFromIntentId: intent.id || idoc.id,
              actingUid: intent.createdByUid || null,
              memberId: intent.createdBy || null,
              memberName: intent.createdByName || null
            });
            await idoc.ref.update({
              status: 'converted',
              convertedToWpId: wpRef.id,
              convertedAt: now
            });
            const optedInIds = Object.entries(intent.rsvps || {})
              .filter(([, r]) => r && (r.state === 'in' || r.value === 'yes'))
              .map(([mid]) => mid);
            if (optedInIds.length) {
              try {
                await sendToMembers(familyDoc.id, optedInIds, {
                  title: 'Heading to the couch',
                  body: `${intent.titleName} in 15 min — head to the couch.`,
                  tag: `intent-convert-${idoc.id}`,
                  url: `/?wp=${wpRef.id}`
                }, {
                  eventType: 'flowBConvert'
                });
              } catch (e) {
                console.warn('flowBConvert push failed', familyDoc.id, idoc.id, e.message);
              }
            }
            continue;
          }
        }
  ```
- **Why this analog:** Branch B is the canonical "compute a window-gated event, fire idempotent push via sendToMembers, mark a flag to prevent double-fire, log on failure" pattern. Phase 15's live-release sweep is structurally IDENTICAL: window check (T-25h to T-23h) + threshold gate (≥2 members) + suppression check (existing watchparty within ±90min) + idempotent flag (`t.liveReleaseFiredFor[epKey]`) + push fan-out via `sendToMembers`.
- **Adaptations needed:**
  - Outer loop: `const titlesSnap = await db.collection('families').doc(familyDoc.id).collection('titles').get();` then per-titles `for (const tdoc of titlesSnap.docs)`.
  - Per-title gates: `t.kind === 'TV'` AND `Object.keys(t.tupleProgress || {}).length > 0`.
  - Subscriber set per D-09/D-10: union all comma-split keys in `t.tupleProgress`; minus members in `t.mutedShows`.
  - D-14 threshold: `subscriberIds.size >= 2` (else continue).
  - D-13 window: `airTs = new Date(next.airDate + 'T21:00:00').getTime()` (best-guess 9pm; RESEARCH §Q6 noted TMDB has only date-precision).
  - D-16 suppression query: `wpSnap = await db.collection('families').doc(familyDoc.id).collection('watchparties').where('titleId','==',tdoc.id).where('startAt','>=',airTs - 90*60000).where('startAt','<=',airTs + 90*60000).get();` — REQUIRES the F2 composite index live BEFORE this CF deploys.
  - Push payload: `{ title: 'Live tonight', body: ${t.name} S{N}E{M} airs {dayName(airTs)}. Watch with the couch?, tag: live-release-${tdoc.id}-${epKey}, url: /?nominate=${tdoc.id}&prefillTime=${airTs} }, { eventType: 'newSeasonAirDate' }`.
  - Idempotency stamp: `await tdoc.ref.update({ [`liveReleaseFiredFor.${epKey}`]: now })`.
  - Per-doc try/catch (mirrors line 695-698 pattern).

---

### F14 + F15 + F16 — Push category triad (3-place add)

- **Role:** Config triad — server gate + client default + UI label
- **Analog (place 1, F14):** `~/queuenight/functions/index.js:74-96` — `NOTIFICATION_DEFAULTS` Object.freeze block (extended in 14-09 with 7 keys at lines 84-95)
- **Analog (place 2, F15):** `js/app.js:100-121` — `DEFAULT_NOTIFICATION_PREFS` Object.freeze block (extended in 14-09 at lines 110-120)
- **Analog (place 3, F16):** `js/app.js:131-148` — `NOTIFICATION_EVENT_LABELS` Object.freeze block (extended in 14-09 at lines 140-147)
- **Reuse strategy:** extend-in-place (each block — add ONE entry per file; 3 single-line additions total)
- **Insertion anchors:**
  - F14: line 95 (last entry in NOTIFICATION_DEFAULTS — `intentExpiring: true`)
  - F15: line 120 (last entry in DEFAULT_NOTIFICATION_PREFS — `intentExpiring: true`)
  - F16: line 147 (last entry in NOTIFICATION_EVENT_LABELS — `intentExpiring: { label, hint }`)
- **Excerpt from F16 analog (js/app.js:140-147):**
  ```javascript
    flowAPick:           { label: "Tonight's pick chosen",      hint: "When someone on your couch picks a movie." },
    flowAVoteOnPick:     { label: "Couch voted on your pick",   hint: "When someone responds to a pick you made." },
    flowARejectMajority: { label: "Your pick was passed on",    hint: "When the couch asks you to pick again." },
    flowBNominate:       { label: "Watch with the couch?",      hint: "When someone wants to watch with you at a time." },
    flowBCounterTime:    { label: "Counter-time on your nom",   hint: "When someone counters with a different time." },
    flowBConvert:        { label: "Movie starting in 15 min",   hint: "When your nomination becomes a watchparty." },
    intentExpiring:      { label: "Tonight's pick expiring",    hint: "Heads-up that a tonight intent is about to expire." }
  });
  ```
- **Excerpt from F15 analog (js/app.js:110-121):**
  ```javascript
    // === Phase 14 — Decision Ritual Core (D-12 / DR-3 place 2 of 3) ===
    // Must stay in lockstep with the deploy-mirror repo's functions/index.js NOTIFICATION_DEFAULTS
    flowAPick: true,
    flowAVoteOnPick: true,
    flowARejectMajority: true,
    flowBNominate: true,
    flowBCounterTime: true,
    flowBConvert: true,
    intentExpiring: true
  });
  ```
- **Why this analog:** This is the SAME triad pattern Phase 14-09 used — exactly 3 single-line additions across 2 files. The pattern is documented verbatim in 14-09-SUMMARY.md and the in-source comment at js/app.js:111-113 ("Must stay in lockstep with the deploy-mirror repo's functions/index.js NOTIFICATION_DEFAULTS").
- **Adaptations needed (all three places):**
  - Key name: `newSeasonAirDate`.
  - Default value: `true` per UI-SPEC §S4 ("default-on toggle, BRAND-voice copy").
  - Label (F16): `"New season air dates"` per UI-SPEC §Copywriting.
  - Hint (F16): `"When a tracked show's next season hits a streamer."` per UI-SPEC §Copywriting (single sentence, period at end).
  - Per Phase 14-09 DR-3 follow-up override (called out explicitly in js/app.js:127-130 comment): do NOT mirror the new key into `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` / `NOTIF_UI_TO_SERVER_KEY`. Legacy Settings UI only.

---

### F17 — `js/app.js` Trakt ingestSyncData augmentation (D-06 prerequisite)

- **Role:** JS feature module (extend Trakt ingest loop)
- **Analog:** `js/app.js:710-720` — the `for (const s of (entry.seasons || []))` inner loop that finds `maxSeason` + `maxEpisodeInSeason`
- **Reuse strategy:** extend-in-place — add `lastWatchedAt` tracking inside the existing loop
- **Insertion anchor:** between line 717 (`if (ep.number > maxEpisodeInSeason) maxEpisodeInSeason = ep.number;`) — extend that single line into a 4-line block tracking the timestamp
- **Excerpt from analog (js/app.js:709-720 + 730-740):**
  ```javascript
        let maxSeason = 0, maxEpisodeInSeason = 0;
        for (const s of (entry.seasons || [])) {
          if (s.number > maxSeason) {
            maxSeason = s.number;
            maxEpisodeInSeason = 0;
          }
          if (s.number === maxSeason) {
            for (const ep of (s.episodes || [])) {
              if (ep.number > maxEpisodeInSeason) maxEpisodeInSeason = ep.number;
            }
          }
        }
        // ...
            prevProgress[meId] = {
              season: maxSeason,
              episode: maxEpisodeInSeason,
              updatedAt: Date.now(),
              source: 'trakt'
            };
  ```
- **Why this analog:** This IS the existing Trakt ingest path. The augmentation is minimal — capture the per-episode `last_watched_at` field that Trakt already returns but the current code discards.
- **Adaptations needed:**
  - Track `lastWatchedAt` inside the seasons.episodes loop; `lastWatchedAt = ep.last_watched_at ? new Date(ep.last_watched_at).getTime() : null` when bumping `maxEpisodeInSeason`.
  - Add `lastWatchedAt` to both write payloads (line 734-739 update path AND line 754-759 create path inside `trakt.createTitleFromTrakt`).
  - Without this, F18's 3-hour-overlap detection collapses to "did both members reach the same `{season, episode}` ever, regardless of when?" (RESEARCH §Q10 caveat).

---

### F18 — `js/app.js` `trakt.detectAndPromptCoWatchOverlap()` + S5 conflict-prompt modal

- **Role:** JS feature module (sibling primitive — async overlap detection + queued modal)
- **Analog:** `js/app.js:1882-1927` — `renderFlowBNominateScreen()` (modal-bg shell + Yes/No layout precedent for S5)
- **Reuse strategy:** clone-as-sibling — insert detector at end of `trakt.sync` (~line 660) and the modal renderer near `renderFlowBNominateScreen`
- **Insertion anchor (detector):** grep marker `// === Phase 15 / D-06 — co-watch overlap detection ===` at end of `trakt.sync` (after `lastSyncedAt` write)
- **Insertion anchor (modal renderer):** grep marker `// === Phase 15 / S5 — co-watch conflict prompt ===` after `renderFlowBNominateScreen` close (~line 1927)
- **Excerpt from analog modal renderer (js/app.js:1882-1927):**
  ```javascript
  function renderFlowBNominateScreen() {
    let modal = document.getElementById('flow-b-nominate-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'flow-b-nominate-modal';
      modal.className = 'modal-bg flow-b-nominate-modal';
      document.body.appendChild(modal);
    }
    // ...
    modal.innerHTML = `<div class="modal-content flow-b-nominate-content">
      <header class="flow-b-nominate-h">
        <button class="modal-close" type="button" onclick="closeFlowBNominate()" aria-label="Close">✕</button>
        <h2>Nominate ${escapeHtml(t.name)}</h2>
        <p>Pick a time. Family members can join, counter, or pass.</p>
      </header>
      <form class="flow-b-nominate-form" onsubmit="event.preventDefault();onFlowBSubmitNominate();">
        <!-- ... form fields ... -->
        <div class="flow-b-nominate-footer">
          <button class="tc-secondary" type="button" onclick="closeFlowBNominate()">Cancel</button>
          <button class="tc-primary" type="submit">Send nomination</button>
        </div>
      </form>
    </div>`;
    modal.classList.add('on');
  }
  ```
- **Why this analog:** Same modal-bg shell pattern: lazy-create `<div class="modal-bg">` if missing, set innerHTML, toggle `.on` class. Phase 15's S5 modal is structurally identical with smaller copy + Yes/No buttons + DEFAULT-NO focus.
- **Adaptations needed:**
  - Modal id: `cv15-cowatch-prompt-modal`.
  - Inner: italic Instrument Serif body + 320px max-width per UI-SPEC §Discretion Q4.
  - Buttons: "No, keep separate" (`.tc-secondary`, default focus) + "Yes, group us" (`.tc-secondary` with `border-color:var(--accent)` per UI-SPEC §Color).
  - Tap on `.modal-bg` outside = No (UI-SPEC §Discretion Q4).
  - `state._coWatchPromptQueue` queue management — only show one at a time; on Yes, call `writeTupleProgress(titleId, [meId, otherId], season, episode, 'trakt-overlap')`.
  - Detector logic per RESEARCH §Q10: walk every TV title; for each, find member-pairs whose `t.progress[mid].source === 'trakt'` AND `lastWatchedAt` within ±3hr window; skip if a `t.tupleProgress[tk]` already exists for that pair on that title; queue prompt.

---

### F19 — `sw.js` CACHE bump

- **Role:** sw.js CACHE
- **Analog:** `sw.js:8` — current value `couch-v34.1.3-selectedmembers-shim`
- **Reuse strategy:** extend-in-place
- **Insertion anchor:** line 8
- **Excerpt from current file (sw.js:5-8):**
  ```javascript
  // Bump CACHE whenever you ship user-visible app changes so installed PWAs invalidate and
  // re-fetch the shell. Version naming convention: couch-v{N}-{milestone-or-fix-shorthand}.

  const CACHE = 'couch-v34.1.3-selectedmembers-shim';
  ```
- **Why this analog:** Single-line constant; all prior phases bumped it via `bash scripts/deploy.sh <short-tag>` per CLAUDE.md.
- **Adaptations needed:**
  - New value: `couch-v35.0-tracking-layer` (RESEARCH §Cross-Repo Deploy Ordering).
  - Bump auto-handled if executor passes `35.0-tracking-layer` to deploy.sh; if not, hand-edit line 8.

---

### F20 — `changelog.html` v35 release article

- **Role:** HTML template fragment
- **Analog:** `changelog.html:67-79` — v34 article (Decision Ritual launch entry)
- **Reuse strategy:** clone-as-sibling — insert NEW `<article class="release">` block above the v34 article (newest-first ordering)
- **Insertion anchor:** between `<section class="changelog-hero">` close (line 65) and `<article class="release">` open (line 67)
- **Excerpt from analog (changelog.html:67-79):**
  ```html
  <article class="release">
    <header class="release-h">
      <span class="release-version">v34</span>
      <span class="release-date">[deploy date YYYY-MM-DD] · Decision ritual</span>
    </header>
    <p class="release-summary">A new way to pick what to watch &mdash; together.</p>
    <ul class="release-list">
      <li><strong>The couch:</strong> tap a cushion to seat yourself. See who's in.</li>
      <li><strong>Two flows:</strong> rank-pick when you're together, or nominate-and-invite when you're apart.</li>
      <li><strong>Tile redesign:</strong> see who wants what at a glance. Tap the tile for what to do next.</li>
      <li><strong>Your queue:</strong> drag to reorder. Voting Yes adds to the bottom &mdash; we'll show you.</li>
    </ul>
  </article>
  ```
- **Why this analog:** Identical HTML structure across all prior changelog entries; uses landing.css tokens; no new CSS needed.
- **Adaptations needed:**
  - Version: `v35`.
  - Tagline: `Tracking layer` or `Pick up where you left off`.
  - Summary copy: BRAND-voice (single line, italic serif rendered) — planner picks; suggested: `*See where every couch is in every show — together or apart.*`
  - Bullets (3-4 max): "Pick up where you left off", "Group your watches", "New season alerts", "Live air-time pings" — copy locked in plan-phase.

---

## Shared Patterns

### Authentication / Attribution

**Source:** `js/utils.js:92-107` — `writeAttribution()` helper
**Apply to:** F5, F6, F7, F8, F18 — every Firestore write Phase 15 makes
```javascript
export function writeAttribution(extraFields = {}) {
  const actingUid = (state.auth && state.auth.uid) || null;
  const actingAsSubProfile = state.actingAs || null;
  const actingAsName = state.actingAsName || null;
  const payload = {
    actingUid,
    ...(actingAsSubProfile ? { managedMemberId: actingAsSubProfile } : {}),
    memberId: actingAsSubProfile || (state.me && state.me.id) || null,
    memberName: actingAsName || (state.me && state.me.name) || null,
    ...extraFields
  };
  if (actingAsSubProfile) { state.actingAs = null; state.actingAsName = null; }
  return payload;
}
```
- Phase 15 rule: every `updateDoc(...)` call spreads `...writeAttribution()` per the existing `firestore.rules` `attributedWrite()` enforcement at lines 165, 178 (and the new 5th branch).

### Error Handling / Toast Pattern

**Source:** `js/utils.js:18-39` — `flashToast(message, opts)`
**Apply to:** F6 (tuple-name save failure), F7 (auto-track confirmation feedback), F18 (overlap-prompt error)
```javascript
export function flashToast(message, opts) {
  // ... lazy-create container, append toast div with class 'toast toast-' + kind
}
```
- BRAND-voice copy locked in UI-SPEC §Copywriting Contract: "Saved" / "Couldn't save name — try again".
- Existing kinds: `info`, `warn`, `error`, `success` — Phase 15 reuses, no new kind.

### Idempotency Stamps in CF Loops

**Source:** `~/queuenight/functions/index.js:792-803` — `intent.warned30` flag pattern
**Apply to:** F13 — `t.liveReleaseFiredFor[epKey]` and (Phase 15 lastSeason) `t.lastSeasonNotifiedFor`
```javascript
if (...&& !intent.warned30) {
  // Set the flag FIRST so a concurrent tick doesn't double-fire. If the push
  // fails after the flag is set we just lose this warning — acceptable
  try {
    await idoc.ref.update({ warned30: true });
  } catch (e) {
    console.warn('warned30 flag write failed', familyDoc.id, idoc.id, e.message);
    continue;
  }
  // ... fire push ...
}
```

### Push Send via `sendToMembers`

**Source:** `~/queuenight/functions/index.js:104-161` — `sendToMembers(familyCode, memberIds, payload, options)`
**Apply to:** F13 — every Phase 15 push fan-out
- Pass `eventType: 'newSeasonAirDate'` to gate on the new pref key (F14 + F15 + F16 triad).
- Pass `excludeUid` / `excludeMemberId` for self-echo guard (PUSH-05) — for live-release prompts, no one is the "host" so leave both null.
- Quiet-hours: do NOT pass `forceThroughQuiet` for Phase 15 pushes (they're informational, not "user is waiting for the movie now").

### Dual-shape Coexistence Pattern

**Source:** `js/app.js:13226-13231` — `persistCouchInTonight` writes BOTH `couchInTonight` (V5 new) AND `couchSeating` (legacy) for one PWA cache cycle
**Apply to:** Phase 15 mental model: `t.progress[memberId]` (per-individual, existing) and `t.tupleProgress[tupleKey]` (new, includes `[memberId]` solo tuples for new writes) coexist throughout v1. RESEARCH §Foundational Finding + §A5 lock this. Follow-up plan post-Phase-15 collapses `t.progress` into singleton solo tuples.

---

## No Analog Found

Files with no close existing match (planner should use UI-SPEC and RESEARCH directly):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| Composite Firestore index in `firestore.indexes.json` (F2) | infrastructure config | one-time write | The repo currently has ZERO composite indexes — this is the first. The shape comes from RESEARCH §Q8 + Firebase docs, not a sibling. |
| Inline rename input UX (F9 sub-feature) | UX micro-affordance | input-blur-save | No prior inline-rename pattern in `js/app.js` (existing edit modal at openEditTitle uses a separate modal). UI-SPEC §Discretion Q3 prescribes the entire interaction; planner locks per UI-SPEC. |
| `state._coWatchPromptQueue` queue manager (F18) | client-side queue | one-at-a-time async | No prior queued-modal pattern in the codebase. Planner can defer to a simple `state._coWatchPromptQueue: []` array + `_coWatchPromptShowing: bool` lock, or model after `state._postSessionWpId` single-instance pattern at js/app.js:10435. |

---

## Cross-File Wiring Map

How writes flow through onSnapshot to UI surfaces (planner uses this to assign waves):

```
       ┌──────────────────────────────────────────────────────────────────┐
       │                       WRITE PATHS                                │
       └──────────────────────────────────────────────────────────────────┘

  D-01 watchparty-end    F7 openPostSession ext.    →   F5 writeTupleProgress
                                                         updateDoc(titles/{id},
                                                         { tupleProgress })
  D-05 Trakt seed        F17 ingestSyncData         →   existing writeMemberProgress
                                                         (writes t.progress[me])
  D-06 overlap accept    F18 detectAndPrompt + S5   →   F5 writeTupleProgress
                                                         (source: 'trakt-overlap')
  D-02 tuple rename      F9 inline rename onChange  →   F6 setTupleName
                                                         updateDoc(families/{code},
                                                         { tupleNames.{tk} })
  D-12 per-show mute     F9 S6 mute toggle onclick  →   F8 writeMutedShow
                                                         updateDoc(titles/{id},
                                                         { mutedShows.{me} })

       ┌──────────────────────────────────────────────────────────────────┐
       │                       SNAPSHOT FAN-OUT                           │
       └──────────────────────────────────────────────────────────────────┘

  titles/* changes  →  existing onSnapshot(titlesRef())  →  state.titles updated
                                                              ↓
                       ┌─────────────────────┬─────────────────────┐
                       ↓                     ↓                     ↓
                F11 renderPickupWidget   F9 detail-modal     F8 mute affects F13 sweep
                (#cv15-pickup-           re-render on next    (next CF tick)
                 container)               openDetailModal

  families/{code}.tupleNames  →  F6 onSnapshot extension  →  state.family.tupleNames
                                                              ↓
                                                       F9 + F11 use tupleDisplayName(tk)

       ┌──────────────────────────────────────────────────────────────────┐
       │                       CF SWEEP (every 5min)                      │
       └──────────────────────────────────────────────────────────────────┘

  watchpartyTick     →    F13 per-titles loop          →     sendToMembers (F14 gated)
                          (D-13 window check                    eventType: 'newSeasonAirDate'
                           D-14 ≥2 threshold                    payload to deviceTokens
                           D-16 wp suppression query)           via webpush
                                ↓
                          tdoc.ref.update({
                            liveReleaseFiredFor:{...}
                          })  ← idempotency
                                ↓
                          NO direct UI fan-out — push
                          arrives via sw.js push handler
                          → deep-link /?nominate=ID
                          → opens openFlowBNominate

       ┌──────────────────────────────────────────────────────────────────┐
       │                       SETTINGS UI                                │
       └──────────────────────────────────────────────────────────────────┘

  F16 NOTIFICATION_EVENT_LABELS extends    →   renderNotificationPrefsRows
  (extends existing iteration at                (js/app.js:1043 already iterates
   js/app.js:1066+)                              NOTIFICATION_EVENT_LABELS keys —
                                                 ZERO render-code change needed)
```

**Wave assignment hint for planner:**
- **Wave 1 (data foundation, no UI dependencies):** F1, F2, F3 — rules + index + tests, all in `~/queuenight`. Can deploy independently.
- **Wave 2 (client primitives, depends on Wave 1):** F4, F5, F6, F8 — read/write helpers + state hydration. No UI yet.
- **Wave 3 (CF, depends on Wave 1 + 2 schema):** F13, F14 — server sweep + push category. F14 must be live BEFORE F15 ships.
- **Wave 4 (client UI, depends on Wave 2 + 3):** F7 (auto-track), F9 (S2/S3/S6), F10+F11 (S1), F12 (CSS), F15+F16 (client triad), F17+F18 (Trakt overlap + S5).
- **Wave 5 (close-out):** F19 (CACHE), F20 (changelog).

---

## CONFIRMED FROM RESEARCH

The following research file:line claims were re-verified via Grep + targeted Read against the working tree:

| Research claim | Status | Evidence |
|---|---|---|
| `getMemberProgress` at js/app.js:8020 | CONFIRMED | Grep hit at 8020; Read 8020-8033 shows full body |
| `membersWithProgress` at js/app.js:8036 | CONFIRMED | Grep hit at 8036; Read 8036-8049 shows full body |
| `writeMemberProgress` at js/app.js:8052 | CONFIRMED | Grep hit at 8052; Read 8052-8068 shows full body with writeAttribution + Trakt push side-effect |
| `clearMemberProgress` at js/app.js:8072 | CONFIRMED | Grep hit at 8072; Read 8072-8081 shows full body |
| `renderTvProgressSection` at js/app.js:8291 | CONFIRMED | Grep hit at 8291; Read 8291-8325 shows full per-individual section render |
| `renderDetailStatusStrip` at js/app.js:8330 | CONFIRMED | Grep hit at 8330; Read 8330-8396 shows status-strip body |
| `renderContinueWatching` at js/app.js:8399 | CONFIRMED | Grep hit at 8399; Read 8399-8439 shows full continue-card render |
| `renderTonight` at js/app.js:4730 | CONFIRMED | Grep hit at 4730; Read shows render order (renderPickerCard / renderUpNext / renderContinueWatching / renderNext3 ...) |
| `renderTonight` calls `renderContinueWatching` at line 4733 | CONFIRMED | Read 4733 verbatim |
| `renderCouchViz` called at line 4881, `renderFlowAEntry` at 4884 | CONFIRMED | Read 4881-4884 verbatim |
| `openPostSession` at js/app.js:10438 | CONFIRMED | Grep hit at 10438; Read 10438-10456 shows full body |
| `endMyWatchparty` at js/app.js:10601 | CONFIRMED | Grep hit at 10601; Read 10601-10625 shows full body |
| `renderDetailShell` at js/app.js:7179 | CONFIRMED | Grep hit at 7179; Read 7179-7244 shows full template |
| `renderTmdbReviewsForTitle` at line 7240 (within renderDetailShell) | CONFIRMED | Read 7240 verbatim |
| `renderTvProgressSection` called at line 7233 (within renderDetailShell) | CONFIRMED | Read 7233 verbatim |
| `couchInTonightFromDoc` at js/app.js:12943 | CONFIRMED | Grep hit at 12943; Read 12943-12958 shows full body |
| `persistCouchInTonight` at js/app.js:13213 | CONFIRMED | Grep hit at 13213; Read 13213-13236 shows full writer |
| Family-doc onSnapshot at js/app.js:4131-4147 | CONFIRMED | Grep hit at 4131; Read 4131-4149 shows hydration including state.couchInTonight + state.couchMemberIds |
| `fetchTmdbDetails` at js/app.js:6934 | CONFIRMED | Grep hit at 6934 |
| `DEFAULT_NOTIFICATION_PREFS` at js/app.js:100-121 | CONFIRMED | Read 100-121 verbatim; 14-09 added 7 keys at 110-120 |
| `NOTIFICATION_EVENT_LABELS` at js/app.js:131-148 | CONFIRMED | Read 131-148 verbatim; 14-09 added 7 keys at 141-147 |
| `writeAttribution` at js/utils.js:92 | CONFIRMED | Read 92-107 verbatim |
| `flashToast` at js/utils.js:18 | CONFIRMED | Read 18-39 verbatim |
| `escapeHtml` at js/utils.js:3 | CONFIRMED | Read 3-6 verbatim |
| `firestore.rules:151-181` 4-branch family-doc UPDATE block | CONFIRMED | Read 151-181 verbatim including the `couchInTonight` 4th branch ending at line 181 with closing `);` |
| `firestore.rules:317-319` permissive title-doc UPDATE | CONFIRMED | Read 317-319 verbatim; comment at 307-315 confirms "any new top-level field added by an attributed family-member write is accepted" — covers both `t.tupleProgress` AND `t.mutedShows` with NO rules change |
| `firestore.rules:364-368` watchparties allow attributedWrite | CONFIRMED | Read 364-368 verbatim |
| `watchpartyTick` at functions/index.js:642 | CONFIRMED | Grep hit at 642; Read 642-847 shows full body including intents loop branches A/B/C |
| `NOTIFICATION_DEFAULTS` at functions/index.js:74-96 | CONFIRMED | Read 74-96 verbatim; 14-09 added 7 keys at 84-95 |
| `sendToMembers` at functions/index.js:104 | CONFIRMED | Grep hit at 104; Read 104-161 shows full body with eventType + quiet-hours logic |
| `firestore.indexes.json` is empty (`indexes: []`) | CONFIRMED | Read full file (4 lines) — first composite index addition |
| `app.html:317` `#couch-viz-container` and `app.html:320` `#flow-a-entry-container` | CONFIRMED | Read 305-394 shows the full Tonight tab DOM; verified S1 insertion gap at line 317-320 |
| `app.html:374` `#continue-section` exists | CONFIRMED | Read 374 verbatim |
| `sw.js:8` CACHE constant `couch-v34.1.3-selectedmembers-shim` | CONFIRMED | Read full sw.js (110 lines); line 8 confirmed |
| Tests rules at `tests/rules.test.js` (couch repo, NOT queuenight) | CONFIRMED | Glob shows it lives in couch repo at `tests/rules.test.js`. RESEARCH §Q15 said `~/queuenight/tests/rules.test.js` — that path is WRONG. Test file is at `~/claude-projects/couch/tests/rules.test.js` (couch repo, mirrored to queuenight by deploy.sh). FLAG for planner: 15-01 plan should target `couch/tests/rules.test.js` for the test edits, NOT `queuenight/tests/...`. |
| Phase 14-06 couchSeating tests #19-#22 at tests/rules.test.js:317-386 | CONFIRMED | Grep + Read shows describe block at 317 with 4 tests |
| `openFlowBNominate` at js/app.js:1874 + `renderFlowBNominateScreen` at 1882 | CONFIRMED | Grep hit at 1874; Read 1874-1927 shows the modal-bg + modal-content shell |
| `trakt.ingestSyncData` at js/app.js:683; loop at 702-768 | CONFIRMED | Grep hit at 683; Read 700-789 shows the seasons.episodes loop at 710-720 (without `last_watched_at` capture) |

### RESEARCH UNVERIFIED — flags for planner

| Claim | Status | Note |
|---|---|---|
| RESEARCH §Q15 references `~/queuenight/tests/rules.test.js` | INCORRECT — test file lives in **couch repo** at `tests/rules.test.js` | Planner: 15-01 (rules + tests) should specify `couch/tests/rules.test.js` for the edit. The file is mirrored to queuenight via `deploy.sh` per CLAUDE.md. Deploy still works the same — just the SOURCE OF TRUTH is in couch. |
| `firestore.rules` line 165 says `legacyGraceWrite()` is the third branch | UNVERIFIED but NOT BLOCKING — Phase 15 doesn't touch that branch | The 5th branch insertion is correctly anchored to the closing `);` of the 4th branch (couchInTonight) at line 181 regardless of the third branch's helper name. |
| RESEARCH §Q11 says Tonight render order has `renderUpNext` at step 2 | CONFIRMED via Read 4732 verbatim — `renderUpNext()` is line 4732 between `renderPickerCard()` and `renderContinueWatching()` |
| TMDB `next_episode_to_air.air_date` is date-only (no time-of-day) | UNVERIFIED in this session (RESEARCH §A1 flagged as ASSUMED) — planner should confirm OR ship `{day}`-only push copy per RESEARCH §Q6 + UI-SPEC fallback. |

---

## Metadata

**Analog search scope:**
- `C:\Users\nahde\claude-projects\couch\js\app.js` (Grep + targeted Read with offset/limit)
- `C:\Users\nahde\claude-projects\couch\js\utils.js` (full Read, 144 lines)
- `C:\Users\nahde\claude-projects\couch\css\app.css` (Grep + targeted Read for 8 anchors)
- `C:\Users\nahde\claude-projects\couch\app.html` (targeted Read of Tonight tab section, lines 305-394)
- `C:\Users\nahde\claude-projects\couch\sw.js` (full Read, 110 lines)
- `C:\Users\nahde\claude-projects\couch\changelog.html` (targeted Read of v34 article)
- `C:\Users\nahde\claude-projects\couch\tests\rules.test.js` (Grep for describe blocks; Read of #19-#22 at lines 314-393)
- `C:\Users\nahde\queuenight\firestore.rules` (Read 140-181 family-doc update branches; 300-368 titles + watchparties)
- `C:\Users\nahde\queuenight\firestore.indexes.json` (full Read, 4 lines)
- `C:\Users\nahde\queuenight\functions\index.js` (Grep for entry points; Read 70-160 sendToMembers + NOTIFICATION_DEFAULTS; Read 640-847 watchpartyTick)

**Files NOT loaded in full (per CLAUDE.md token-cost rule):** js/app.js (~10200 lines), css/app.css (~3700+ lines), functions/index.js (~1027 lines), firestore.rules (~461 lines). All Grep + offset/limit only.

**Pattern extraction date:** 2026-04-26

## PATTERN MAPPING COMPLETE
