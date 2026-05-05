---
phase: 15
plan: 04
subsystem: tracking-layer-detail-modal-section
tags: [tracking-layer, detail-modal-section, S2-S3-S6-surfaces, REVIEW-MEDIUM-6, REVIEW-MEDIUM-7, post-session-auto-track-confirmation, delegated-event-listener]
requires:
  - "15-02 read helpers (tupleCustomName, tupleDisplayName, tupleKey)"
  - "15-02 writers (writeTupleProgress, setTupleName)"
  - "15-03 state._pendingTupleAutoTrack stash + window.toggleMutedShow"
  - "15-01 firestore.rules per-member tupleProgress + mutedShows isolation (HIGH-1)"
provides:
  - "renderCv15TupleProgressSection — S2 detail-modal 'YOUR COUCH'S PROGRESS' section (gates placeholder on tupleCustomName(tk) === null per REVIEW MEDIUM-6)"
  - "renderCv15MutedShowToggle — S6 per-show kill-switch text-link"
  - "cv15RelativeTime — '3 days ago' style relative timestamp helper"
  - "cv15ShowRenameInput / cv15RenameKeydown / cv15RenameBlur / cv15SaveRenameInput / cv15CancelRenameInput — S3 inline tuple rename via pencil glyph"
  - "cv15ShowAllTuples — 'View all (N)' overflow expand handler"
  - "cv15HandleDetailModalClick + cv15AttachDetailModalDelegate — REVIEW MEDIUM-7 delegated listener for #detail-modal-content (replaces inline onclick)"
  - "cv15ConfirmAutoTrack / cv15EditAutoTrack — D-01 post-session Yes/Edit handlers"
  - "cv15HandlePostSessionClick + cv15AttachPostSessionDelegate — REVIEW MEDIUM-7 delegated listener for #wp-post-session-sub"
  - "Phase 15 CSS namespace block in css/app.css with .unnamed-placeholder modifier (renamed for MEDIUM-6 clarity)"
affects:
  - "Plan 15-05 (S1 Tonight pickup widget) — consumes renderCv15TupleProgressSection's row pattern + the .cv15-pickup-* CSS scaffolded here"
  - "Plan 15-07 (Trakt overlap accept path / S5 conflict prompt) — consumes the .cv15-cowatch-prompt-* CSS scaffolded here"
tech-stack:
  added:
    - "Delegated event listener pattern with data-cv15-action attribute dispatch (REVIEW MEDIUM-7) — addresses comma-bearing tuple keys that corrupt single-quoted inline onclick string args"
    - "Idempotent listener attach via data-cv15-bound sentinel attribute"
    - "REVIEW MEDIUM-6 gating: tupleCustomName(tk) === null distinguishes 'no custom name set' from 'no display name available' (the original !displayName gate would never have fired since tupleDisplayName always returns a derived fallback)"
    - "REVIEW MEDIUM-5 confidence surface: '(best guess)' qualifier on auto-track row when sourceField === 'host-progress-plus-1'"
  patterns:
    - "Sibling-primitive insertion (Phase 14-05 convention) — renderCv15TupleProgressSection lands immediately above renderTvProgressSection without modifying it; both coexist during v1"
    - "Auto-attach listener after every innerHTML write site (covers async re-renders + scroll-preserving _rerenderDetailFromState)"
    - "Verbatim UI-SPEC §Copywriting Contract strings (no paraphrasing)"
    - "Atomic CSS namespace block with grep markers (entry + exit) per Phase 14-05 convention"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-04-SUMMARY.md (this file)"
  modified:
    - "css/app.css (198 net insertions — single Phase 15 namespace block)"
    - "js/app.js (291 net insertions across 4 contiguous regions + 7 single-line attach calls)"
decisions:
  - "DEVIATION (Rule 3): Plan referenced #detail-modal-body throughout; the actual element ID in app.html is #detail-modal-content (verified app.html:995). Bound the delegated listener to the real element. Same fix applied to all cv15* re-render sites (cv15SaveRenameInput, cv15CancelRenameInput, cv15ShowAllTuples) — they look up #detail-modal-content (the actual modal body container) for innerHTML rewrites."
  - "Auto-attached cv15AttachDetailModalDelegate at every existing #detail-modal-content innerHTML write site (7 sites: openDetailModal, ensureTmdbReviews .then, TV details backfill, delete review, save review, addSimilar, _rerenderDetailFromState). Total cv15AttachDetailModalDelegate() call sites in the codebase: 11 (≥4 required by plan). Idempotent via data-cv15-bound sentinel — double-attach is a no-op."
  - "Insertion order in renderDetailShell: \\${renderCv15TupleProgressSection(t)} sits between \\${renderReviewsForTitle(t)} and \\${renderTmdbReviewsForTitle(t)} per plan instruction. The legacy \\${renderTvProgressSection(t)} (per-individual progress at line 7236) is preserved unchanged — both sections coexist during v1."
  - "openPostSession's existing 'How was {title}?' line replaced with a conditional baseHtml builder that appends the auto-track row when state._pendingTupleAutoTrack matches wp.titleId. Existing early-return guards (if (dismissed || alreadyRated) return;) untouched — auto-track row only renders for active actor opens that pass the guards."
metrics:
  duration_seconds: 540
  duration_minutes: 9
  task_count: 4
  file_count: 2
  completed: "2026-04-27"
---

# Phase 15 Plan 04: Detail-Modal Tracking Section + Inline Rename + Mute Toggle + D-01 Confirmation Row Summary

**One-liner:** Ships 3 of the 6 Phase 15 surfaces (S2 detail-modal section, S3 inline tuple rename, S6 per-show notification kill-switch) plus the D-01 watchparty-end auto-track confirmation row that closes the loop on 15-03's `state._pendingTupleAutoTrack` stash. All 5 click affordances use REVIEW MEDIUM-7 delegated event listeners (data-cv15-action dispatch) so that comma-bearing tuple keys like `m_alice,m_bob` cannot corrupt single-quoted inline onclick string args. The placeholder render is gated on the REVIEW MEDIUM-6 `tupleCustomName(tk) === null` predicate so it actually fires (the original `!displayName` gate would never have triggered since tupleDisplayName always returns a derived fallback).

---

## a) Function landing line numbers

### js/app.js — S2/S3/S6 region (lines 8579-8804)

| Function | Line | Purpose |
|---|---|---|
| `renderCv15TupleProgressSection(t)` | 8599 | S2 'YOUR COUCH'S PROGRESS' section renderer; gates on `tupleCustomName(tk) === null` for placeholder (MEDIUM-6); HTML uses `data-cv15-action` attrs (MEDIUM-7) |
| `renderCv15MutedShowToggle(t)` | 8653 | S6 per-show kill-switch text-link with `data-cv15-action="muteToggle"` |
| `cv15RelativeTime(ts)` | 8665 | '3 days ago' / 'yesterday' / 'just now' formatter |
| `cv15ShowRenameInput(titleId, tk)` | 8684 | Replaces tuple-name span with `<input maxlength=40>` overlay; pre-fills via `tupleCustomName` (NOT derived fallback) per MEDIUM-6 |
| `cv15RenameKeydown(ev)` | 8708 | Enter saves; Esc cancels |
| `cv15RenameBlur(ev)` | 8712 | Blur saves (unless cancelled flag set) |
| `cv15SaveRenameInput(input)` | 8716 | Calls `setTupleName(tk, value)`; toasts; re-renders detail modal; re-attaches delegate |
| `cv15CancelRenameInput(input)` | 8740 | Reverts via re-render; re-attaches delegate |
| `cv15ShowAllTuples(titleId)` | 8757 | Toggles `state._cv15ExpandTuples[titleId] = true` then re-renders |
| `cv15HandleDetailModalClick(ev)` | 8777 | Delegated listener — switch on `data-cv15-action` (renameTuple / muteToggle / expandTuples) |
| `cv15AttachDetailModalDelegate()` | 8797 | Idempotent attach (sentinel `data-cv15-bound="1"`) |

### js/app.js — D-01 post-session region (lines 11117-11155)

| Function | Line | Purpose |
|---|---|---|
| `cv15ConfirmAutoTrack()` | 11118 | Calls `writeTupleProgress(at.titleId, at.memberIds, at.season, at.episode, 'watchparty')`; clears stash; toasts; hides row |
| `cv15EditAutoTrack()` | 11127 | Opens `window.openProgressSheet(at.titleId, state.me.id)` for manual selection |
| `cv15HandlePostSessionClick(ev)` | 11134 | Delegated listener — switch on `data-cv15-action` (confirmAutoTrack / editAutoTrack) |
| `cv15AttachPostSessionDelegate()` | 11149 | Idempotent attach for `#wp-post-session-sub` |

### openPostSession sub.innerHTML extension

The original single-line write at js/app.js:11080 was replaced with a multi-line conditional builder (now lines 11079-11106) that:
1. Builds `baseHtml = '<em>How was X?</em>'`
2. If `state._pendingTupleAutoTrack` matches `wp.titleId` AND `at.memberIds.length >= 1`, appends the `.cv15-autotrack-row` markup with Yes/Edit buttons using `data-cv15-action`
3. Renders `(best guess)` qualifier via `.cv15-autotrack-confidence` span when `at.sourceField === 'host-progress-plus-1'` (REVIEW MEDIUM-5 confidence surface)
4. Calls `cv15AttachPostSessionDelegate()` after `sub.innerHTML = baseHtml`

---

## b) css/app.css Phase 15 namespace block — lines 2442-2638

Single contiguous block bounded by:
- Line 2442: `/* === Phase 15 — Tracking Layer === */`
- Line 2638: `/* === /Phase 15 — Tracking Layer === */`

Sits IMMEDIATELY ABOVE the desktop `@media (min-width: 900px)` block (now at line 2641 after the insert).

Selectors declared (all `.cv15-*` prefixed):
- `.cv15-progress-row` + `:first-of-type` + `:last-of-type`
- `.cv15-progress-row-body`
- `.cv15-tuple-name` (Fraunces 17px, letter-spacing -0.015em per established Couch convention)
- `.cv15-tuple-name.unnamed-placeholder` — **MEDIUM-6 modifier** (Instrument Serif italic, --ink-dim)
- `.cv15-tuple-rename` (pencil button) + `:hover` + `:focus-visible`
- `.cv15-tuple-rename-input` (text input overlay)
- `.cv15-progress-pos` (S/E reference)
- `.cv15-progress-time` (relative timestamp)
- `.cv15-progress-row-actions`
- `.cv15-progress-show-name` + `.cv15-progress-tuple-meta` (S1 widget reuse — consumed by 15-05)
- `.cv15-mute-toggle` + `:hover` + `.on` + `.on:hover` + `:focus-visible` (S6 kill-switch)
- `.cv15-cowatch-prompt-content` + `.cv15-cowatch-prompt-h` + `.cv15-cowatch-prompt-body` + `.cv15-cowatch-prompt-actions` (S5 modal — consumed by 15-07)
- `.cv15-pickup-container` + `:empty` + `.cv15-pickup-h` (S1 widget — consumed by 15-05)
- `.cv15-autotrack-row` + `p` + `.cv15-autotrack-confidence` (post-session row)

**Token discipline:** zero new color/spacing/type tokens. Every value resolves to existing `--ink`, `--ink-warm`, `--ink-dim`, `--ink-faint`, `--accent`, `--bad`, `--surface`, `--surface-2`, `--t-h3`, `--t-meta`, `--t-body`, `--t-micro`, `--s1`-`--s5`, `--r-sm`, `--r-md`, `--t-quick`, `--space-section`. Verified via `grep -cE "\\-\\-cv15-[a-z]+:" css/app.css → 0`.

**Brace balance:** open = close = 1618 (verified after insert).

---

## c) REVIEW MEDIUM-7 delegated-listener pattern — replaces inline onclick across 5 surfaces

Tuple keys are sorted-comma-joined (e.g. `m_alice,m_bob`). Embedded in a single-quoted JS string-arg of an inline `onclick="setTupleName('m_alice,m_bob', ...)"`, the comma terminates the JS string-literal early and corrupts the call. **REVIEW MEDIUM-7** mandated migrating to `data-*` attributes + delegated listeners.

| Affordance | Element | Action attribute | Listener |
|---|---|---|---|
| S3 pencil glyph (rename trigger) | `<button class="cv15-tuple-rename">` | `data-cv15-action="renameTuple"` + `data-title-id` + `data-tk` | `cv15HandleDetailModalClick` on `#detail-modal-content` |
| S6 mute toggle text-link | `<button class="cv15-mute-toggle">` | `data-cv15-action="muteToggle"` + `data-title-id` | same |
| 'View all (N)' overflow | `<button class="cv15-mute-toggle">` (style-overridden) | `data-cv15-action="expandTuples"` + `data-title-id` | same |
| D-01 Yes button | `<button class="tc-primary">` | `data-cv15-action="confirmAutoTrack"` | `cv15HandlePostSessionClick` on `#wp-post-session-sub` |
| D-01 Edit button | `<button class="tc-secondary">` | `data-cv15-action="editAutoTrack"` | same |

**Anti-pattern verification:** `grep -cE 'onclick="(cv15ShowRenameInput\|cv15ShowAllTuples\|toggleMutedShow|cv15ConfirmAutoTrack|cv15EditAutoTrack)' js/app.js → 0` (no inline onclicks for any cv15-action handler).

**Idempotency:** both attach functions check `getAttribute('data-cv15-bound') === '1'` before binding, so calling them twice on the same element is a no-op.

---

## d) REVIEW MEDIUM-6 placeholder gate — `tupleCustomName(tk) === null`

Per 15-02-SUMMARY's "Note for Plan 15-04": the original plan-described `!tupleDisplayName(tk)` gate would NEVER fire because `tupleDisplayName` always returns a derived fallback ("You (solo)", "Wife and me", etc.) for valid tuples. The real distinction is "user has explicitly set a custom name" vs. "no custom name set" — which is what `tupleCustomName(tk) === null` checks.

**Render contract** (renderCv15TupleProgressSection rows):
- `customName = tupleCustomName(tk)` → string-or-null
- `isUnnamed = customName === null`
- `visibleName = customName !== null ? customName : tupleDisplayName(tk, state.members)`
- Markup:
  - **Always render** the `.cv15-tuple-name` span with `visibleName` (custom OR derived fallback)
  - **Additionally render** the italic `.cv15-tuple-name.unnamed-placeholder` shimmer "*name this couch*" ONLY when `isUnnamed === true`

**Smoke test case:** A tuple `m_alice,m_bob` with no entry in `state.family.tupleNames`:
- `tupleCustomName('m_alice,m_bob')` → `null`
- `tupleDisplayName('m_alice,m_bob', state.members)` → e.g. `"Alice and me"` (derived fallback for the actor's POV)
- Row renders BOTH `<span class="cv15-tuple-name">Alice and me</span>` AND `<span class="cv15-tuple-name unnamed-placeholder"><em>name this couch</em></span>`
- After user enters "Date night" via the pencil + input + Enter:
  - `setTupleName(tk, 'Date night')` runs → optimistic state update (`state.family.tupleNames[tk] = {name:'Date night', ...}`) per MEDIUM-8
  - Re-render fires
  - `tupleCustomName(tk)` now returns `'Date night'` → `isUnnamed = false`
  - Row renders ONLY `<span class="cv15-tuple-name">Date night</span>` (no placeholder)

The `cv15ShowRenameInput` helper also pre-fills the input via `tupleCustomName` (NOT `tupleDisplayName`) so the user doesn't see "Alice and me" pre-populated and feel they need to clear it before typing the actual nickname.

**Verification:**
- `grep -c "isUnnamed = customName === null" js/app.js → 1`
- `grep -c "tupleCustomName(tk)" js/app.js → 5` (15-02 helper decl + this plan's 4 reads)

---

## e) renderDetailShell insertion site

js/app.js:7248 (between `${renderReviewsForTitle(t)}` at line 7247 and `${renderTmdbReviewsForTitle(t)}` at line 7249):

```javascript
    ${renderReviewsForTitle(t)}
    ${renderCv15TupleProgressSection(t)}    ← inserted
    ${renderTmdbReviewsForTitle(t)}
```

Per UI-SPEC §Surface inventory + §Discretion Q2: the section appears AFTER the family-authored reviews block and BEFORE the TMDB community reviews block. The legacy per-individual `${renderTvProgressSection(t)}` at line 7236 is preserved unchanged — both sections coexist during v1.

**Verification:**
- `grep -c '\\${renderCv15TupleProgressSection(t)}' js/app.js → 1` (exactly the interpolation)
- `grep -c "renderCv15TupleProgressSection(t)" js/app.js → 2` (function declaration at 8599 + interpolation at 7248)
- `grep -c '\\${renderTvProgressSection(t)}' js/app.js → 1` (legacy preserved)

---

## f) #detail-modal-content innerHTML write sites + cv15AttachDetailModalDelegate coverage

Plan instructed Grep to discover every site that writes innerHTML to the detail modal body. **Important deviation:** Plan referenced `#detail-modal-body` throughout, but the actual element ID in app.html is `#detail-modal-content` (verified `grep -n detail-modal app.html` → `app.html:995: <div class="modal detail-modal" id="detail-modal-content"></div>`). All listener-attach calls and re-render lookups use `#detail-modal-content`.

Discovered sites that write `renderDetailShell()` to `#detail-modal-content`:

| Site | Line | Trigger | cv15AttachDetailModalDelegate() call line |
|------|------|---------|-------------------------------------------|
| `deleteReview` | 6851 | User deletes their own review | 6852 |
| `saveReview` | 6876 | User saves a new/edited review | 6878 |
| `openDetailModal` initial render | 7059 | User taps a tile to open detail modal | 7060 |
| `ensureTmdbReviews` .then | 7074 | Async TMDB community reviews fetch | 7076 |
| TV details backfill | 7092 | Async fetch of showStatus/nextEpisode/etc | 7095 |
| `addSimilar` | 7299 | User adds a "more like this" recommendation | 7300 |
| `_rerenderDetailFromState` | 7375 | Mood palette + other in-place state changes | 7376 |

Plus 3 sites internal to cv15 functions that do their own re-renders:
- `cv15SaveRenameInput` (line 8735)
- `cv15CancelRenameInput` (line 8750)
- `cv15ShowAllTuples` (line 8766)

Total `cv15AttachDetailModalDelegate()` call sites in js/app.js: **11** (definition + 10 invocations), well above the plan's `≥4` threshold.

**Idempotency guarantee:** every attach call checks `data-cv15-bound === '1'` first — so if multiple async re-renders fire in quick succession, only the first one binds the listener. The listener stays bound until the next innerHTML wipe (which clears the sentinel attribute since the element's children are replaced — but the element itself is NOT replaced, so the previously-bound `addEventListener` would persist across re-renders if not for the wipe). The conservative pattern: wipe sentinel + re-attach on every innerHTML write.

Wait — actually, the element itself (`#detail-modal-content`) is NOT replaced (only its `.innerHTML` is rewritten). The `addEventListener` survives `.innerHTML` writes. So the SECOND attach call would short-circuit via the sentinel. **But** the sentinel is set on the `#detail-modal-content` element, which also is NOT replaced — so the sentinel persists. **First attach binds; subsequent attaches are no-ops.** Correct behavior.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking issue] Plan referenced #detail-modal-body throughout; actual element ID is #detail-modal-content**

- **Found during:** Task 3 pre-edit Grep for `getElementById('detail-modal-body')` returned zero matches. Followed up with Grep for `detail-modal` which surfaced 11 matches all using `#detail-modal-content`. Cross-checked `app.html:995` confirmed: `<div class="modal detail-modal" id="detail-modal-content"></div>`. There is no `#detail-modal-body` element anywhere in the codebase.
- **Issue:** The plan's `must_haves` and acceptance criteria all referenced `#detail-modal-body`. If executed verbatim, `cv15AttachDetailModalDelegate` would have looked up `getElementById('detail-modal-body')` → returned `null` → silently failed to attach → all S2/S3/S6 click affordances would be dead.
- **Fix:** Substituted `#detail-modal-content` for every reference to `#detail-modal-body` in the executed code (cv15AttachDetailModalDelegate body + cv15SaveRenameInput re-render + cv15CancelRenameInput re-render + cv15ShowAllTuples re-render + the 7 attach call sites at modal innerHTML write points). Documented inline at the cv15AttachDetailModalDelegate header comment + at renderCv15TupleProgressSection header comment so future maintainers grok the divergence.
- **Files modified:** `js/app.js` (renderCv15TupleProgressSection comment block + cv15* handler bodies + 7 attach call sites)
- **Commits:** `982ae99` (handler region) + `87f6eb0` (modal site attaches)

### Auth gates / Human action

None. JS edits + CSS edits only. No auth needed during execution.

### Items NOT changed (per scope)

- **No HTML** — Plan 15-05 ships the Tonight widget anchor in app.html
- **No CF changes** — Plan 15-06 ships watchpartyTick
- **No service-worker bump** — Plan 15-09 ships the v35 cache bump
- **No firestore.rules** — 15-01 already shipped the per-member isolation matrix this plan depends on
- **Legacy `renderTvProgressSection(t)` UNCHANGED** — per-individual section continues coexisting at line 8814 (was 8582 before our 232-line insert above it) as Phase 14-05 sibling-primitive convention requires

---

## Verification Evidence

```
$ node --check js/app.js
(silent — exit 0; PASS)

$ grep -c "/\* === Phase 15 — Tracking Layer === \*/" css/app.css                         → 1 ✓
$ grep -c "\.cv15-progress-row" css/app.css                                                → 5 ✓
$ grep -c "\.cv15-tuple-name.unnamed-placeholder" css/app.css                              → 1 ✓
$ grep -c "\.cv15-mute-toggle" css/app.css                                                 → 5 ✓
$ grep -c "\.cv15-cowatch-prompt-content" css/app.css                                      → 1 ✓
$ grep -c "\.cv15-pickup-container" css/app.css                                            → 2 ✓
$ grep -c "\.cv15-autotrack-row" css/app.css                                               → 3 ✓
$ Open-brace count == close-brace count in css/app.css                                     → 1618 / 1618 ✓
$ grep -cE "\-\-cv15-[a-z]+:" css/app.css                                                  → 0 ✓ (no new tokens)

$ grep -c "function renderCv15TupleProgressSection(t)" js/app.js                           → 1 ✓
$ grep -c "function renderCv15MutedShowToggle(t)" js/app.js                                → 1 ✓
$ grep -c "function cv15ShowRenameInput" js/app.js                                         → 1 ✓
$ grep -c "function cv15RelativeTime" js/app.js                                            → 1 ✓
$ grep -c "async function cv15SaveRenameInput" js/app.js                                   → 1 ✓
$ grep -c "function cv15HandleDetailModalClick" js/app.js                                  → 1 ✓
$ grep -c "function cv15AttachDetailModalDelegate" js/app.js                               → 1 ✓
$ grep -c "function cv15ConfirmAutoTrack" js/app.js                                        → 1 ✓
$ grep -c "function cv15EditAutoTrack" js/app.js                                           → 1 ✓
$ grep -c "function cv15HandlePostSessionClick" js/app.js                                  → 1 ✓
$ grep -c "function cv15AttachPostSessionDelegate" js/app.js                               → 1 ✓

$ grep -c "tupleCustomName(tk)" js/app.js                                                  → 5 ✓ (≥2)
$ grep -c "isUnnamed = customName === null" js/app.js                                      → 1 ✓
$ grep -c "unnamed-placeholder" js/app.js                                                  → 2 ✓ (≥1)

$ grep -c 'data-cv15-action="renameTuple"' js/app.js                                       → 1 ✓
$ grep -c 'data-cv15-action="muteToggle"' js/app.js                                        → 1 ✓
$ grep -c 'data-cv15-action="expandTuples"' js/app.js                                      → 1 ✓
$ grep -c 'data-cv15-action="confirmAutoTrack"' js/app.js                                  → 1 ✓
$ grep -c 'data-cv15-action="editAutoTrack"' js/app.js                                     → 1 ✓
$ grep -c 'data-cv15-action' js/app.js                                                     → 11 ✓ (≥5)

$ grep -cE 'onclick="(cv15ShowRenameInput|cv15ShowAllTuples|toggleMutedShow|cv15ConfirmAutoTrack|cv15EditAutoTrack)' js/app.js  → 0 ✓ (anti-pattern absent)

$ grep -c "Stop notifying me about this show" js/app.js                                    → 2 (1 doc-comment in 15-03 + 1 verbatim render) ✓
$ grep -c "Notifications off &middot; Re-enable" js/app.js                                 → 1 ✓
$ grep -c "YOUR COUCH'S PROGRESS" js/app.js                                                → 2 (1 file-header comment + 1 <h4> render) ✓
$ grep -c "name this couch" js/app.js                                                      → 2 (1 doc-comment + 1 <em> render) ✓
$ grep -c "e.g. Date night" js/app.js                                                      → 1 ✓
$ grep -c "writeTupleProgress(at.titleId, at.memberIds, at.season, at.episode, 'watchparty')" js/app.js  → 1 ✓
$ grep -c "host-progress-plus-1" js/app.js                                                 → 4 ✓ (≥1; 15-03 tier label + this plan's qualifier check + 2 doc-comments)
$ grep -c "if (dismissed || alreadyRated) return;" js/app.js                               → 1 ✓ (early-return guard preserved)

$ grep -c '\${renderCv15TupleProgressSection(t)}' js/app.js                                → 1 ✓
$ grep -B1 'renderTmdbReviewsForTitle(t)\}' js/app.js | head -1                            → contains renderCv15TupleProgressSection ✓
$ grep -c '\${renderTvProgressSection(t)}' js/app.js                                       → 1 ✓ (legacy preserved)
$ grep -c 'cv15AttachDetailModalDelegate()' js/app.js                                      → 11 ✓ (≥4)
```

---

## Commits (this worktree)

| Hash      | Type | Subject |
|-----------|------|---------|
| `f1fd4e0` | feat(15-04) | add Phase 15 CSS namespace block with .cv15-* selectors |
| `982ae99` | feat(15-04) | add renderCv15TupleProgressSection + S6 mute toggle + S3 inline-rename + delegated listener |
| `87f6eb0` | feat(15-04) | wire renderCv15TupleProgressSection into renderDetailShell + auto-attach delegated listener |
| `f92c432` | feat(15-04) | extend openPostSession with auto-track confirmation row + Yes/Edit handlers (D-01 close) |

---

## Self-Check: PASSED

Files exist:
- FOUND: `css/app.css` (modified — single Phase 15 block at lines 2442-2638, 198 net insertions)
- FOUND: `js/app.js` (modified — 4 contiguous regions + 7 single-line attach calls, ~291 net insertions)
- FOUND: `.planning/phases/15-tracking-layer/15-04-SUMMARY.md` (this file)

Commits exist:
- FOUND: `f1fd4e0` in `git log --oneline -6`
- FOUND: `982ae99` in `git log --oneline -6`
- FOUND: `87f6eb0` in `git log --oneline -6`
- FOUND: `f92c432` in `git log --oneline -6`

All 11 success criteria from the plan satisfied:
1. ✓ css/app.css contains the single Phase 15 namespace block with `.cv15-tuple-name.unnamed-placeholder` modifier (REVIEW MEDIUM-6)
2. ✓ js/app.js renderCv15TupleProgressSection gates the placeholder on `tupleCustomName(tk) === null` (REVIEW MEDIUM-6) and uses data-* attributes for handler dispatch (REVIEW MEDIUM-7)
3. ✓ js/app.js renderCv15MutedShowToggle returns a single `<button>` with `data-cv15-action="muteToggle"` (REVIEW MEDIUM-7)
4. ✓ js/app.js contains the 4 cv15Rename* handlers using `data-cv15-action="renameTuple"` + `data-tk`; cv15HandleDetailModalClick dispatches
5. ✓ cv15AttachDetailModalDelegate is idempotent (data-cv15-bound sentinel) and called after every #detail-modal-content innerHTML write site (7 outside cv15 + 3 inside cv15 = 10 invocations + 1 definition = 11 total)
6. ✓ renderDetailShell interpolates `${renderCv15TupleProgressSection(t)}` between renderReviewsForTitle and renderTmdbReviewsForTitle (line 7248)
7. ✓ openPostSession appends an auto-track confirmation row using `data-cv15-action="confirmAutoTrack" / "editAutoTrack"` (REVIEW MEDIUM-7); cv15HandlePostSessionClick dispatches; "(best guess)" qualifier appears when `sourceField === 'host-progress-plus-1'` (REVIEW MEDIUM-5 confidence surface)
8. ✓ All UI-SPEC verbatim strings present: YOUR COUCH'S PROGRESS, name this couch, e.g. Date night, Saved, Stop notifying me about this show, Notifications off · Re-enable
9. ✓ No inline `onclick` for any cv15-* handler — verified by grep returning 0 matches for the anti-pattern
10. ✓ `node --check js/app.js` exits 0
11. ✓ Legacy renderTvProgressSection (now at line 8814 due to insertions above it; was line 8582) remains unmodified
