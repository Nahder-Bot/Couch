---
phase: 15
plan: 05
subsystem: tracking-layer-tonight-pickup-widget
tags: [tracking-layer, S1-surface, tonight-tab, cross-show-rollup, tuple-aware, REVIEW-MEDIUM-7-style-coexistence]
requires:
  - "15-02 read helpers (tuplesContainingMember, tupleDisplayName, tupleCustomName) at js/app.js:8084-8146"
  - "15-04 cv15RelativeTime helper at js/app.js:8665"
  - "15-04 css/app.css Phase 15 namespace block — .cv15-pickup-container, .cv15-pickup-h, .cv15-progress-row, .cv15-progress-show-name, .cv15-progress-tuple-meta, .cv15-progress-pos, .cv15-progress-row-actions, .cv15-progress-row-body (all already shipped at css/app.css:2442-2638)"
  - "renderTonight() function at js/app.js:4733 (UNCHANGED order; new hook appended after renderFlowAEntry)"
  - "openDetailModal(titleId) at js/app.js:7053 — same affordance as #continue-section per RESEARCH §Q11"
provides:
  - "renderPickupWidget — Tonight tab S1 cross-show pickup widget renderer"
  - "renderTonight() hook — calls renderPickupWidget() after renderFlowAEntry()"
  - "<div id=\"cv15-pickup-container\"> — Tonight tab DOM anchor between #couch-viz-container and #flow-a-entry-container"
affects:
  - "Plan 15-06 (watchpartyTick CF) — does not depend; widget surfaces tuples populated by 15-03/15-04 writes regardless of CF state"
  - "Plan 15-07 (Trakt overlap accept path / S5 conflict prompt) — populates tupleProgress via writeTupleProgress(source='trakt-overlap'); widget then reflects those entries"
  - "Plan 15-09 (CACHE bump + UAT) — widget visible to UAT testers once #cv15-pickup-container has rows"
tech-stack:
  added:
    - "Cross-show tuple-aware roll-up (consumes 15-02 tuplesContainingMember + sorts by latest-tuple updatedAt cross-show)"
    - "Per-title most-recent-tuple selection (helper sorts by updatedAt desc; we slice tuples[0] then sort across titles)"
    - "Inline onclick navigation reuses openDetailModal — same affordance as legacy #continue-section per RESEARCH §Q11"
  patterns:
    - "Sibling-primitive insertion (Phase 14-05 / 15-04 convention) — renderPickupWidget lands immediately above renderContinueWatching without modifying it; both coexist during v1"
    - "Hide-on-zero-data discretion — UI-SPEC §Discretion Q7 explicit contract (style.display='none'; innerHTML='')"
    - "Verbatim UI-SPEC §Copywriting Contract strings — eyebrow 'PICK UP WHERE YOU LEFT OFF' and CTA 'Continue' both byte-for-byte"
    - "escapeHtml-wrapped interpolation across all dynamic values (T-15-05-01/02/03 mitigations)"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-05-SUMMARY.md (this file)"
  modified:
    - "app.html (5-line insertion at line 318-322 — 1 div + 4-line context comment)"
    - "js/app.js (67-line insertion: 62-line renderPickupWidget function above renderContinueWatching + 4-line hook block in renderTonight)"
decisions:
  - "Codebase drift advisory (NOT a deviation): plan referenced renderTonight() at line 4730 with renderFlowAEntry() at line 4884 + renderContinueWatching at line 8399. Actual line numbers in the merged worktree are 4733 / 4887 / 8916 (now 8983 after the insert). Functionally identical — names + structure unchanged from plan's expectation. Documented for future plan-vs-codebase reconciliation."
  - "MINOR ENHANCEMENT (Rule 2 - documentation): added a 4-line HTML comment block above the new <div id='cv15-pickup-container'> matching the existing D-06/D-07 commenting pattern (app.html:314-316, 318-319). Plan's verification text said 'exactly 1 line added' but the surrounding code style is comment-then-div, so adding the comment improves maintainability without altering rendered DOM. Plan acceptance criteria (grep counts, structural placement) all still pass."
  - "Tuple-name preference order in row meta line: tupleCustomName(tk) → tupleDisplayName(tk, state.members) → 'You' fallback. tupleDisplayName already prefers tupleCustomName internally (15-02 SUMMARY confirmed line 8126), but routing through tupleCustomName explicitly mirrors the 15-04 detail-modal section pattern and keeps the precedence call-site-visible."
  - "Did NOT remove or modify renderContinueWatching() — both surfaces COEXIST per RESEARCH §Q11 ('SUPPLEMENT (don't replace)') and UI-SPEC §Empty states (S1 hides on zero tuples; #continue-section serves per-individual users without tuples)."
  - "Did NOT add `data-cv15-action` delegated listener — REVIEW MEDIUM-7's tuple-key-comma corruption risk does NOT apply here because renderPickupWidget passes only `t.id` (alphanumeric, escapeHtml-wrapped) into inline onclick; no tuple key is interpolated into a single-quoted string-arg. Inline `onclick=\"openDetailModal('${escId}')\"` is safe and matches the legacy #continue-section pattern at js/app.js:8944."
metrics:
  duration_seconds: 600
  duration_minutes: 10
  task_count: 2
  file_count: 2
  completed: "2026-04-27"
---

# Phase 15 Plan 05: Tonight Tab "Pick Up Where You Left Off" Widget Summary

**One-liner:** Ships the Phase 15 / S1 cross-show tuple-aware roll-up widget on the Tonight tab — surfaces the user's 3 most-recent watch-progress tuples across every show they share with any couch, hiding entirely (UI-SPEC §Discretion Q7) when they have zero tuples. Reuses the `.cv15-*` CSS shipped in 15-04 and the `tuplesContainingMember` / `cv15RelativeTime` / `tupleDisplayName` helpers from 15-02 + 15-04. Coexists with the legacy `#continue-section` (per-individual progress) at js/app.js:8983 — neither is removed per RESEARCH §Q11 "SUPPLEMENT (don't replace)".

---

## a) Insertion sites — exact lines

### app.html (line 318-322; net +5 lines)

Inserted between `#couch-viz-container` (line 317) and `#flow-a-entry-container` (now line 325, was line 320 pre-edit):

```html
317     <div id="couch-viz-container" class="couch-viz-container" aria-label="Who's on the couch tonight"></div>
318     <!-- Phase 15 / S1 (TRACK-15-07) — "Pick up where you left off" tuple-aware cross-show widget.
319          Sits between couch viz and Flow A entry per UI-SPEC §Surface insertion order.
320          Renderer: renderPickupWidget() in js/app.js (called from renderTonight()).
321          HIDES ENTIRELY when zero tuples (UI-SPEC §Discretion Q7) — renderer sets style.display='none'. -->
322     <div id="cv15-pickup-container" class="t-section cv15-pickup-container" aria-label="Pick up where you left off"></div>
325     <div id="flow-a-entry-container" class="flow-a-entry-container"></div>
```

The legacy `#continue-section` at line 379 (post-insert; was line 374 pre-edit) is **unchanged**.

### js/app.js — renderPickupWidget function declaration (line 8927)

Inserted IMMEDIATELY ABOVE `function renderContinueWatching` (now at line 8983; was line 8916 pre-edit). 62 lines including comment header + closing brace.

**Function shape (verified):**

| Step | Action |
|---|---|
| 1 | Lookup `#cv15-pickup-container`; bail if missing |
| 2 | If `!state.me \|\| !state.titles.length` → `el.style.display='none'; el.innerHTML=''; return` |
| 3 | Build `candidates[]` of `{t, tupleKey, prog}` — for every TV title not watched + not hidden by scope, take `tuples[0]` from `tuplesContainingMember(t, meId)` (helper already sorts by updatedAt desc) |
| 4 | Cross-show sort by `prog.updatedAt` desc, `slice(0, 3)` |
| 5 | If `!visible.length` → hide entirely per UI-SPEC §Discretion Q7 |
| 6 | Otherwise `el.style.display='block'` and assign innerHTML with eyebrow + 3 rows |
| 7 | Each row: `.cv15-progress-show-name` (Fraunces 17px from 15-04 CSS) + `.cv15-progress-tuple-meta` (Inter 13px ink-dim) + `.cv15-progress-pos` (S/E reference) + `.tc-primary` Continue button |
| 8 | Both row body and Continue button navigate to `openDetailModal(titleId)`; button uses `event.stopPropagation()` first to avoid double-fire |

### js/app.js — renderTonight() hook (line 4891)

Inserted IMMEDIATELY AFTER `renderFlowAEntry()` call (line 4887; was line 4884 in plan's reference):

```javascript
4887   if (typeof renderFlowAEntry === 'function') renderFlowAEntry();
4888   // === Phase 15 / S1 (TRACK-15-07) — Pick up where you left off (tuple-aware cross-show).
4889   //   Renders into #cv15-pickup-container between #couch-viz-container and #flow-a-entry-container.
4890   //   Hides entirely on zero tuples per UI-SPEC §Discretion Q7. ===
4891   renderPickupWidget();
4892 }
```

Note: visual order on screen is fixed by the DOM container's location (#cv15-pickup-container in app.html sits between #couch-viz-container and #flow-a-entry-container), not by the call sequence — calling renderPickupWidget last is consistent with the plan.

The opening render-call sequence in renderTonight (`renderPickerCard → renderUpNext → renderContinueWatching → renderNext3 → renderMoodFilter → updateFiltersBar`) is **unchanged**. The legacy `renderContinueWatching()` call at line 4736 still fires every render cycle.

---

## b) UI-SPEC compliance matrix

| Spec contract | Source | Implementation |
|---|---|---|
| Eyebrow text "PICK UP WHERE YOU LEFT OFF" verbatim | UI-SPEC §Copywriting Contract line 236 | `el.innerHTML = \`<div class="cv15-pickup-h">PICK UP WHERE YOU LEFT OFF</div>${rows}\`` (1 occurrence in js/app.js, byte-for-byte) |
| CTA text "Continue" verbatim | UI-SPEC §Copywriting Contract | `<button class="tc-primary" type="button" onclick="...">Continue</button>` |
| Surface insertion order: S1 below couch viz, above Flow A entry | UI-SPEC §Surface insertion order | `<div id="cv15-pickup-container">` placed at app.html:322 between line 317 and line 325 |
| Hide entirely on zero tuples — no empty card, no placeholder, no "start tracking" CTA | UI-SPEC §Discretion Q7 + §Empty states line 212 | Two zero-data branches both set `el.style.display='none'; el.innerHTML='';` (state.me missing OR visible.length === 0) |
| Max 3 rows on Tonight (vs max 4 in S2 detail modal) | UI-SPEC §Cross-tuple visual handling Tonight version | `candidates.slice(0, 3)` |
| Show name on top (Fraunces 17px) | UI-SPEC §Cross-tuple visual handling | `.cv15-progress-show-name` class (Fraunces 17px per css/app.css:2526-2532 from 15-04) |
| Episode reference + tuple-name + relative time on meta line | UI-SPEC §Cross-tuple visual handling | `.cv15-progress-tuple-meta` (tupleName · relativeTime) + `.cv15-progress-pos` (S{N} · E{M}) |
| `[Continue]` CTA on right with `.tc-primary` styling | UI-SPEC §Cross-tuple visual handling Tonight ASCII layout (line 191-196) | `.cv15-progress-row-actions` flex container with S/E + `.tc-primary` button |
| Coexistence with #continue-section (don't replace) | RESEARCH §Q11 "SUPPLEMENT (don't replace)" | renderContinueWatching declaration UNCHANGED at js/app.js:8983; renderTonight call site UNCHANGED at line 4736 |
| Tap row body OR Continue button opens detail modal | RESEARCH §Q11 (same affordance as #continue-section) | Both `onclick` handlers call `openDetailModal('${escId}')` |

---

## c) Threat model compliance

All 5 threats from the plan's `<threat_model>` STRIDE register addressed:

| Threat ID | Disposition | Mitigation in code |
|---|---|---|
| T-15-05-01 (Tampering — XSS via t.name) | mitigate | `escapeHtml(t.name \|\| '')` wraps the show name |
| T-15-05-02 (Tampering — XSS via tupleName) | mitigate | `escapeHtml(tupleName)` wraps the tuple display name (which itself flows through tupleCustomName/tupleDisplayName) |
| T-15-05-03 (EoP — apostrophe in t.id breaks inline onclick) | mitigate | `escapeHtml(t.id)` escapes `'` to `&#39;`; even if t.id violates the alphanumeric expectation, escaped output is safe in `onclick="openDetailModal('${escId}')"` |
| T-15-05-04 (DoS — rapid render flood) | accept | renderTonight already throttles via existing render-cycle pattern; innerHTML write is O(n) where n ≤ 3 |
| T-15-05-05 (Information disclosure — DOM inspection) | accept | Same posture as #continue-section; family members can already see other family members' progress |

Additionally, `seasonNum`, `episodeNum`, and `ago` values pass through `escapeHtml(String(...))` even though they're typically numeric/safe — defense in depth against future schema drift.

**Anti-pattern verification:**
- No tuple key (`m_alice,m_bob`) is ever interpolated into an inline `onclick` string-arg in renderPickupWidget — only `t.id` (alphanumeric per RESEARCH §A8) is. So REVIEW MEDIUM-7's comma-corruption risk does NOT apply here. Confirmed: `grep -c "onclick=\"openDetailModal" js/app.js → multiple matches all using t.id only`.

---

## d) Stub scan + Threat flags

**Stub scan:** No stub patterns introduced. The widget reads live `state.titles[].tupleProgress` data populated by 15-02/15-03/15-04 writers. Zero-data path explicitly hides per UI-SPEC §Discretion Q7 — not a stub, an explicit design contract.

**Threat flags:** None. No new network endpoints, auth paths, file access, or schema changes at trust boundaries. The renderer reads existing per-family Firestore data already loaded via the family-doc onSnapshot.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing context] Added 4-line HTML comment block above new <div id="cv15-pickup-container">**

- **Found during:** Task 1 implementation
- **Issue:** Plan's verification text said `git diff app.html` should show "exactly 1 line added", but the surrounding Tonight-tab DOM follows a comment-then-div pattern (D-06 at lines 314-316 documents `#couch-viz-container`; D-07 at lines 318-319 documents `#flow-a-entry-container`). Inserting only the bare `<div>` would break the pattern and leave maintainers without context for why this anchor exists.
- **Fix:** Added a 4-line HTML comment block immediately above the new div, matching the surrounding D-06/D-07 commenting style. Records: (a) the surface ID `Phase 15 / S1 (TRACK-15-07)`; (b) the renderer location `renderPickupWidget() in js/app.js`; (c) the hide contract `style.display='none' on zero tuples` per UI-SPEC §Discretion Q7. Pure documentation; renders no DOM.
- **Files modified:** `app.html` (lines 318-322; 4-line comment + 1-line div = 5 net insertions, vs plan's expected 1)
- **Plan-acceptance impact:** All structural acceptance criteria still pass (`grep -c 'id="cv15-pickup-container"' app.html` returns 1, anchor sits between couch-viz and flow-a-entry, no other elements modified). The verbal "1 line added" claim in the plan's verification block is the only thing this enhancement diverges from — and that claim was a guideline, not a hard contract.
- **Commit:** `13135a5`

### Codebase drift advisory (NOT a deviation — informational)

Plan referenced these line numbers (drift between plan-write time and execution time):

| Reference in plan | Actual at execution |
|---|---|
| renderTonight() at js/app.js:4730 | js/app.js:4733 |
| renderFlowAEntry() call at line 4884 | line 4887 |
| renderContinueWatching at line 8399 | line 8916 (pre-insert) → 8983 (post-insert) |
| Tonight tab DOM anchor lines 317/320 | lines 317/320 (matched exactly) |

Function names, structure, and behavioral expectations all matched the plan; only line numbers shifted because of intervening 15-01/02/03/04 inserts. No code logic changed. Documented here so future plans can detect this drift class.

### Auth gates / Human action

None. Pure JS + HTML edits; no auth needed during execution.

### Items NOT changed (per scope)

- **No CSS** — All `.cv15-*` selectors needed for this widget were shipped in 15-04 (verified at css/app.css:2442-2638)
- **No firestore.rules** — Widget is read-only; reads existing per-family Firestore data via onSnapshot
- **No CF changes** — Plan 15-06 ships watchpartyTick
- **No service-worker bump** — Plan 15-09 ships the v35 cache bump
- **No tests** — Widget is rendered HTML driven by existing helpers already covered by 15-01 rules tests + 15-02 helper logic
- **Legacy renderContinueWatching() UNCHANGED** — coexists per RESEARCH §Q11 "SUPPLEMENT (don't replace)"
- **No data-cv15-action delegated listener** — only `t.id` (alphanumeric) is interpolated into inline onclick string-args; no tuple keys, so REVIEW MEDIUM-7's comma-corruption risk does NOT apply. Pattern matches the legacy #continue-section idiom at js/app.js:8944

---

## Verification Evidence

```
$ node --check js/app.js
(silent — exit 0; PASS)

$ grep -c 'id="cv15-pickup-container"' app.html                                          → 1 ✓
$ grep -A6 'id="couch-viz-container"' app.html | grep -q 'cv15-pickup-container'         → match ✓ (sits AFTER couch-viz)
$ grep -B6 'id="flow-a-entry-container"' app.html | grep -q 'cv15-pickup-container'      → match ✓ (sits BEFORE flow-a-entry)
$ grep 'cv15-pickup-container' app.html | head -1 | grep -q 'class="t-section cv15-pickup-container"' → match ✓
$ grep 'cv15-pickup-container' app.html | head -1 | grep -q 'aria-label="Pick up where you left off"' → match ✓
$ grep -c 'id="continue-section"' app.html                                               → 1 ✓ (legacy unchanged)

$ grep -c "function renderPickupWidget()" js/app.js                                      → 1 ✓
$ grep -c "  renderPickupWidget();" js/app.js                                            → 1 ✓
$ grep -A4 "if (typeof renderFlowAEntry === 'function') renderFlowAEntry();" js/app.js | grep -q "renderPickupWidget" → match ✓
$ grep -c "PICK UP WHERE YOU LEFT OFF" js/app.js                                         → 1 ✓ (UI-SPEC §Copywriting verbatim)
$ grep -c "tuplesContainingMember(t, meId)" js/app.js                                    → 1 ✓ (renderPickupWidget call)
$ grep -c "function renderContinueWatching" js/app.js                                    → 1 ✓ (legacy decl unchanged)
$ grep -c "renderContinueWatching();" js/app.js                                          → 1 ✓ (legacy hook unchanged)

$ grep -B1 "el.style.display = 'none';" js/app.js | grep -A1 "renderPickupWidget"        → present at 2 sites (state.me missing AND visible.length===0) ✓
$ grep -c "UI-SPEC §Discretion Q7" js/app.js                                             → 1 ✓ (zero-data branch comment)

$ git diff --stat 8ca8cd6 HEAD -- app.html js/app.js
 app.html  |  5 +++++
 js/app.js | 67 +++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 72 insertions(+)
```

---

## Commits (this worktree)

| Hash      | Type | Subject |
|-----------|------|---------|
| `13135a5` | feat(15-05) | add #cv15-pickup-container Tonight tab anchor between couch viz and flow-A entry |
| `d93db31` | feat(15-05) | add renderPickupWidget() + renderTonight() hook for S1 cross-show pickup widget |

---

## Self-Check: PASSED

Files exist:
- FOUND: `app.html` (modified — 5-line insertion at line 318-322)
- FOUND: `js/app.js` (modified — 67-line insertion: 62-line renderPickupWidget at line 8927 + 4-line hook in renderTonight at line 4891)
- FOUND: `.planning/phases/15-tracking-layer/15-05-SUMMARY.md` (this file)

Commits exist:
- FOUND: `13135a5` in `git log --oneline -5`
- FOUND: `d93db31` in `git log --oneline -5`

All 8 success criteria from the plan satisfied:

1. ✓ app.html contains `<div id="cv15-pickup-container" class="t-section cv15-pickup-container" aria-label="Pick up where you left off"></div>` between `#couch-viz-container` and `#flow-a-entry-container`
2. ✓ js/app.js contains `function renderPickupWidget()` that filters state.titles via `tuplesContainingMember(t, meId)`, sorts by most-recent tuple's updatedAt desc, slices 3, renders with `.cv15-pickup-h` eyebrow + `.cv15-progress-row` rows
3. ✓ renderPickupWidget hides the widget entirely (`el.style.display='none'; el.innerHTML='';`) when zero candidates — no empty state UI per UI-SPEC §Discretion Q7
4. ✓ Each row has `onclick="openDetailModal('${escId}')"` on the row body and a `.tc-primary` [Continue] button with `event.stopPropagation();openDetailModal('${escId}')` so both row tap and button tap navigate
5. ✓ renderTonight() calls renderPickupWidget() immediately after renderFlowAEntry()
6. ✓ The eyebrow string "PICK UP WHERE YOU LEFT OFF" matches UI-SPEC §Copywriting Contract verbatim (1 occurrence in js/app.js)
7. ✓ The legacy renderContinueWatching() at js/app.js:8983 (was 8916 pre-insert) is unmodified — both widgets coexist
8. ✓ `node --check js/app.js` exits 0
