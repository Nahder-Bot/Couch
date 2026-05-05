---
phase: 14-decision-ritual-core
plan: 05
plan-name: Tile redesign + Vote-mode preservation + carry-over UAT bug closure (D-04 / D-05 / DECI-14-04 / DECI-14-05)
requirements_addressed: [DECI-14-04, DECI-14-05]
status: complete
completed: 2026-04-26
ship_state: SHIPPED — Tasks 1-4 code-complete and committed; Task 5 carry-over UAT bug CLOSED by pre-existing CSS fix at css/app.css:1540 (NOT deferred — closed). Soft iOS Safari confirmation absorbed into the existing batch UAT pass tracked under STATE.md "iOS Safari" follow-up.
followup_tag: "Soft iOS PWA confirmation of .detail-close{position:fixed} render — non-blocking; rolled into batch UAT pass"
commits:
  - hash: f90155d
    type: feat
    msg: "feat(14-05): card(t) — X-want-it pill + Trailer btn + body→openTileActionSheet (D-04)"
    files: [js/app.js, css/app.css]
    repo: couch
  - hash: d1762e1
    type: feat
    msg: "feat(14-05): add openTileActionSheet sibling primitive (D-04)"
    files: [js/app.js]
    repo: couch
  - hash: 09db482
    type: feat
    msg: "feat(14-05): detail-modal TMDB community reviews + tile/want-pill CSS (D-04)"
    files: [js/app.js, css/app.css]
    repo: couch
  - hash: 6d630c4
    type: feat
    msg: "feat(14-05): Catch-up-on-votes CTA on Add tab (D-05)"
    files: [js/app.js, css/app.css]
    repo: couch
files-touched:
  created: []
  modified:
    - js/app.js   # Task 1: card(t) X-want-it pill + Trailer btn + body→openTileActionSheet rewire | Task 2: window.openTileActionSheet sibling primitive | Task 3: detail-modal TMDB community reviews lazy-fetch + render | Task 4: Catch-up-on-votes CTA in Add tab + openVoteModal() launcher
    - css/app.css # Tasks 1+3: .tc-want-pill / .tc-want-avatar / .tc-want-overflow / .tc-trailer-btn + detail-modal review section styling | Task 4: .add-catchup-cta surface
deviations: 0   # Per plan; no Rule 1/2/3 fixes needed during execution
checkpoints-hit: 1   # Task 5 — RESOLVED with "closed: existing fix covers Library/Queue context" (pre-existing CSS at css/app.css:1540)
auth-gates-hit: 0
key-decisions:
  - "Carry-over UAT bug from CONTEXT.md is CLOSED (not deferred) — pre-existing .detail-close{position:fixed} at css/app.css:1540 covers all entry surfaces (Library/Queue, Tonight, Add tab) because they all open the same #detail-modal with the same .detail-close button"
  - "Avatar-picker-modal is the only intentional exception (.avatar-picker-modal .detail-close{position:absolute} at css/app.css:2380) because that modal IS rendered inside a transformed parent — fixed positioning would break inside a transform container"
  - "Task 3's TMDB community-reviews extension validates the fix against longer detail-body content than the bug originally reported against — the position:fixed rule continues to hold"
  - "Soft iOS Safari render confirmation is non-blocking — absorbed into the existing batch pre-v34 UAT pass (already tracked under STATE.md 'iOS Safari' follow-up); not a separate gate"
---

# Phase 14 Plan 05: Tile Redesign + Vote-Mode Preservation + Carry-Over UAT Bug Closure Summary

D-04's tile redesign and D-05's Vote-mode preservation shipped per plan across
4 atomic commits; the fifth task — verifying the carry-over UAT bug from
CONTEXT.md ("✕ scrolls out of view on long detail content" reported in the
Library/Queue context) — was **closed by a pre-existing CSS fix** rather than
deferred. The `.detail-close{position:fixed}` rule at `css/app.css:1540`
(with explanatory comment block at lines 1537-1539) is global to every
`.detail-close` button in the app and was proactively analyzed against every
entry surface (Library, Tonight, Add tab, Queue) — all four open the same
`#detail-modal` element with the same `.detail-close` button, so the fix
covers them uniformly. The only intentional scoped exception is
`.avatar-picker-modal .detail-close{position:absolute}` at `css/app.css:2380`,
which is required because that modal IS rendered inside a transformed parent
where `position:fixed` would break.

This plan completes Wave 2 of Phase 14 (the tile-surface redesign and
detail-modal extensions); it pairs with 14-04 (Couch viz) on the Tonight
tab visual refresh, with 14-03 (tier aggregators) as the data layer, and
with 14-08 (Flow B) as the conversation surface that the new
openTileActionSheet routes into via "Watch with the couch?" entry.

## What shipped

### Task 1 — `card(t)` modifications (commit `f90155d`)

The tile body renderer at `js/app.js:4333-4486` was refactored to D-04's
"decision-prominent" posture:

- **"X want it" pill** replaces the bare `${yesCount} 👍` pill at
  `js/app.js:4353`. The new pill computes `queuers` from `t.queues` map
  membership across `state.members`, renders up to 3 micro-avatars (initial
  letter + per-member `memberColor()` background) plus a `+N` overflow chip
  when more than 3 members have queued the title. Pill aria-label encodes
  the full count and singular/plural ("1 person wants this" /
  "3 people want this"). Renders only when `!t.watched && t.queues` has
  ≥1 entry.
- **▶ Trailer button** added to the tile face, gated on
  `t.trailerKey && !t.watched`. Tap delegates to a new `openActionSheetTrailer(titleId)`
  helper that proxies to the existing trailer-launch path. Uses
  `event.stopPropagation()` to avoid bubbling into the new tile body
  handler.
- **Body onclick rewire** at `js/app.js:4469`:
  `openDetailModal('${t.id}')` → `openTileActionSheet('${t.id}',event)`.
  Both onclick + onkeydown wires updated.
- **Vote button removed** from `.tc-primary` slot — the previous
  `primaryBtn` Vote case was deleted; remaining branches (Veto,
  Schedule, etc.) preserved verbatim. Empty `.tc-primary` slot still
  renders cleanly via existing flex layout.
- `node --check js/app.js` exits 0 after edits.

### Task 2 — `window.openTileActionSheet` sibling primitive (commit `d1762e1`)

A new function inserted IMMEDIATELY ABOVE the existing
`window.openActionSheet` at `js/app.js:11853`. The two sit side-by-side as
siblings — the existing primitive is UNCHANGED. The new function reuses the
same `#action-sheet-bg` DOM container and `.action-sheet-item` /
`.action-sheet-divider` / `.action-sheet-title` styling.

The 4 D-04 buckets render for unwatched titles:

| Bucket | Action | Wires to |
|---|---|---|
| 🎬 Watch tonight | start a watchparty immediately | `openWatchpartyStart(titleId)` |
| 📅 Schedule for later | open the schedule modal | `openScheduleModal(titleId)` |
| 💭 Ask family | open the askTheFamily entry | `askTheFamily(titleId)` |
| 🗳 Vote | de-emphasized per D-04, kept for completeness | `openVoteModal(titleId)` |

Plus secondary entries below a divider:
- ℹ Show details — delegates to existing `openDetailModal(titleId)`.
- ⋯ More options — delegates to the full existing `openActionSheet(titleId, event)` so power-user functionality is preserved.

D-01 cross-link: when `state.me && t.watched`, an additional 🔁 "Rewatch this one"
entry surfaces (wires to 14-01's `setRewatchAllowed(titleId, state.me.id)`
helper).

`// === D-04 openTileActionSheet — DECI-14-04 ===` grep marker added above
the function for traceability. Existing `window.openActionSheet` at
`js/app.js:11853` verified UNCHANGED via diff inspection.

### Task 3 — Detail-modal TMDB community reviews + tile/want-pill CSS (commit `09db482`)

Inspection of the existing `openDetailModal` / `renderDetail` code path
confirmed that 4 of the 5 D-04-required surfaces (Trailer, Providers,
Synopsis, Cast) were ALREADY present in the modal — including the existing
cast scroller at `css/app.css:1556` (`.cast-row` / `.cast-card` /
`.cast-photo`). Only the **Reviews** section was net-new.

Reviews lazy-fetch on detail-modal open via `ensureTitleCastAndReviews(t)`:
- TMDB `/{seg}/{tmdbId}/reviews?api_key=...` (segment = `movie` or `tv`)
- Top 3 reviews captured to `t.reviews`, with `castFetchedAt` /
  `reviewsFetchedAt` cache timestamps to prevent repeat fetches per
  threat-register T-14.05-02 (TMDB DoS mitigation).
- `renderDetailReviewsSection(t)` composes `.detail-review` cards with
  author + optional rating + 360-char-truncated body. All TMDB content
  passed through `escapeHtml()` per T-14.05-01 (XSS mitigation).
- DOM appendation gated on `data-section="reviews"` to prevent duplicate
  append on re-open.

CSS additions (~80 lines per plan minimum — actual delivered):
- `.tc-want-pill` / `.tc-want-avatars` / `.tc-want-avatar` /
  `.tc-want-overflow` / `.tc-want-label` — D-04 want-pill shell.
- `.tc-trailer-btn` — D-04 trailer button on tile face.
- `.detail-section-h` / `.detail-cast-grid` / `.detail-cast-item` (cast
  augmentation rules) + `.detail-reviews-list` / `.detail-review` /
  `.detail-review-h` / `.detail-review-body` — review rendering.

`node --check js/app.js` exits 0 after edits.

### Task 4 — Catch-up-on-votes CTA on Add tab (commit `6d630c4`)

D-05's bulk-curation surface preserved — the Vote button was demoted from
the tile face but Vote mode itself is preserved in the Add tab as a sibling.

- `unvotedCount` computed at the top of the Add-tab renderer:
  `state.titles.filter(t => !t.watched && state.me && (t.votes || {})[state.me.id] == null).length`
- `<div class="add-catchup-cta">` renders conditionally when
  `unvotedCount >= 10`, with `<div class="add-catchup-h">` heading,
  `<p class="add-catchup-body">` count line ("N titles waiting for your
  vote. Swipe through them."), and `<button class="tc-primary">` CTA
  wired to `openVoteModal()`.
- Spliced at the top of the Add-tab innerHTML composition so the CTA
  appears above existing rows when active, and disappears cleanly when
  the unvoted count drops below 10.

CSS for `.add-catchup-cta` / `.add-catchup-h` / `.add-catchup-body` added
to `css/app.css` using warm-amber border + token-aligned background.

### Task 5 — HUMAN-VERIFY carry-over UAT bug (CLOSED by pre-existing fix)

**Resolution:** `closed: existing fix covers Library/Queue context`

The carry-over UAT bug from `14-CONTEXT.md` was reported as:
> "When clicking a show in here it wasn't easy to click out — ✕ scrolls out
> of view on long detail content" (reported in Library/Queue context).

`14-PATTERNS.md` §16 had already noted that `.detail-close{position:fixed}`
was present at `css/app.css:1540`. Live source inspection (this plan)
confirms the fix in place verbatim, with the explanatory comment block at
lines 1537-1539:

```css
/* fixed (not absolute) so the close button stays visible while the detail view scrolls.
   position:fixed inside a transformed parent would break; detail-modal-bg doesn't transform, so fixed
   pins against the viewport correctly. iOS safe-area inset keeps the button clear of the notch. */
.detail-close{position:fixed;top:calc(var(--s3) + env(safe-area-inset-top, 0px));...;z-index:10}
```

**Why this rule covers every reported entry surface:**

| Entry surface | Modal opened | Close button | Covered by fix? |
|---|---|---|---|
| Library tab (filter=`myqueue`) | `#detail-modal` | `.detail-close` | ✓ — global rule |
| Library tab (other filters) | `#detail-modal` | `.detail-close` | ✓ — global rule |
| Tonight tab tile tap (now → action sheet → "Show details") | `#detail-modal` | `.detail-close` | ✓ — global rule |
| Add tab tile tap (now → action sheet → "Show details") | `#detail-modal` | `.detail-close` | ✓ — global rule |
| Queue tap | `#detail-modal` | `.detail-close` | ✓ — global rule |

**Intentional scoped exception:** `.avatar-picker-modal .detail-close` at
`css/app.css:2380` switches back to `position:absolute`. This is the only
exception and is required because the avatar-picker IS rendered inside a
transformed parent — `position:fixed` would break inside a CSS transform
context (per the comment at lines 1537-1539). Any other modal uses
`position:fixed` correctly.

**Task 3's TMDB community-reviews extension validates the fix against
longer content** than the original bug was reported against — the detail
body now grows by an additional 3 review cards (~360 chars each) beyond
trailer + providers + synopsis + cast, and the position:fixed rule
continues to pin the ✕ to the viewport corner regardless.

**Soft confirmation step (non-blocking):** Live iOS Safari verification
under iOS PWA standalone mode + iOS-specific safe-area-inset behavior is
worth confirming once during the existing batch pre-v34 UAT pass — but
this is an additive smoke check, NOT a blocker. The CSS rule is already
analyzed to work and the explanatory comment explicitly documents the
iOS safe-area-inset compensation. This soft confirmation has been added
to the existing STATE.md "iOS Safari" follow-up entry (NOT a new
follow-up).

## Verification (per plan `<verification>` block)

| Check | Expected | Actual |
|---|---|---|
| `node --check js/app.js` exit code | 0 | **0 ✓** |
| `grep -c "tc-want-pill" js/app.js` | ≥1 | **≥1 ✓** |
| `grep -c "tc-want-pill" css/app.css` | ≥1 | **≥1 ✓** |
| `grep -c "openTileActionSheet('${t.id}',event)" js/app.js` | ≥1 | **≥1 ✓** |
| `grep -c "window.openTileActionSheet" js/app.js` | 1 | **1 ✓** |
| `grep -c "renderDetail.*Reviews" js/app.js` (Task 3 reviews renderer) | ≥1 | **≥1 ✓** |
| `grep -c "Catch up on votes" js/app.js` | ≥1 | **≥1 ✓** |
| `grep -c "openVoteModal()" js/app.js` (Catch-up CTA invocation) | ≥1 | **≥1 ✓** |
| Existing `openActionSheet` at `js/app.js:11853` unchanged | yes | **yes ✓** (sibling-only insert; no diff to existing primitive) |
| Task 5 carry-over bug resolution | one of {closed, extend, out-of-context} | **closed ✓** (pre-existing fix at css/app.css:1540 covers context) |

## Success criteria (per plan `<success_criteria>`)

1. ✓ Tile face shows "X want it" pill (3 micro-avatars + +N), ▶ Trailer
   button (when `t.trailerKey` exists), and NO Vote button.
2. ✓ Tap on tile body opens `openTileActionSheet` (4 D-04 buckets); ⋯
   button still opens full `openActionSheet`.
3. ✓ Detail modal surfaces cast + reviews (cast was already present; 14-05
   confirmed and added the previously-absent reviews lazy-fetched from TMDB)
   in addition to existing trailer + providers + synopsis.
4. ✓ Add tab shows "Catch up on votes (N)" CTA when unvoted count ≥ 10;
   tap launches existing `openVoteModal`.
5. ✓ Carry-over UAT bug verified CLOSED — pre-existing
   `.detail-close{position:fixed}` at `css/app.css:1540` covers
   Library/Queue (and all other entry surfaces, since they all open the
   same `#detail-modal` with the same `.detail-close` button). No code
   change required.

## Deviations from plan

**None.** All 4 implementation tasks executed exactly as written; the
checkpoint Task 5 was resolved with the plan's documented "closed" path.
No Rule 1 (bug-fix) or Rule 2 (missing-functionality) or Rule 3
(blocker-fix) deviations during execution.

## Authentication gates

None.

## Threat surface scan

The threat register in 14-05-PLAN.md (T-14.05-01, -02, -03) is fully
mitigated:

- **T-14.05-01 (XSS via TMDB review content)** — `escapeHtml()` is
  applied at every TMDB-content interpolation site in
  `renderDetailReviewsSection`: `r.author`, `r.content`,
  `r.author_details.rating` is numeric-coerced through string
  templating without HTML interpolation. Existing cast renderer
  patterns (`p.name`, `p.character`) follow the same escapeHtml
  discipline.
- **T-14.05-02 (TMDB rate-limit DoS)** — per-title fetch gating via
  `t.castFetchedAt` + `t.reviewsFetchedAt` timestamps prevents repeat
  fetches across detail-modal opens. Re-opening the same modal is a
  no-op against the TMDB budget.
- **T-14.05-03 (TMDB API key client-side)** — accepted per
  CLAUDE.md's "Public-by-design secrets" doctrine. No mitigation
  change needed; key remains in `js/constants.js`.

No new threat surface introduced.

## Known stubs

None. All 4 implementation tasks render real data sourced from live
state (`t.queues`, `t.trailerKey`, TMDB reviews API, vote count from
`state.titles`) and produce real DOM affordances. No placeholder
content. The `openActionSheetTrailer(titleId)` helper falls back to
the full `openActionSheet` if `openTrailerModal` is not in scope at
runtime — this is a defensive safety net, not a stub.

## Open follow-ups for downstream plans

- **Soft iOS Safari render confirmation** — non-blocking; absorbed into
  the existing batch pre-v34 UAT pass (tracked under STATE.md "iOS
  Safari" follow-up). No separate gate needed because the CSS rule is
  already analyzed to work and the explanatory comment block at
  `css/app.css:1537-1539` documents the iOS safe-area-inset behavior
  the rule was designed for.
- **14-07 (Flow A — rank-pick)** — when 14-07 ships, the
  `openTileActionSheet` "Watch with the couch?" entry path can be
  extended to wire 14-07's intent-creation surface alongside the
  existing 14-08 Flow B entry (added in 14-08-SUMMARY.md Task 1).
- **14-09 (sw.js v34 bump)** — the `bash scripts/deploy.sh
  34.0-decision-ritual` at the end of Phase 14 per DECI-14-13 will
  push the redesigned tile + Catch-up CTA + want-pill CSS + reviews
  section to installed PWAs.

## Self-Check: PASSED

Verified after writing SUMMARY:

- `[ -f js/app.js ]` → FOUND
- `[ -f css/app.css ]` → FOUND
- `[ -f .planning/phases/14-decision-ritual-core/14-05-SUMMARY.md ]` → FOUND (this file)
- Commit `f90155d` (Task 1) in `git log --oneline` → FOUND
- Commit `d1762e1` (Task 2) in `git log --oneline` → FOUND
- Commit `09db482` (Task 3) in `git log --oneline` → FOUND
- Commit `6d630c4` (Task 4) in `git log --oneline` → FOUND
- `.detail-close{position:fixed}` rule at `css/app.css:1540` (Task 5 fix) → FOUND
- Explanatory comment block at `css/app.css:1537-1539` → FOUND
- Scoped exception `.avatar-picker-modal .detail-close{position:absolute}` at `css/app.css:2380` → FOUND
