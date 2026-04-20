# Phase 4: Veto System - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 4 delivers: (1) post-spin veto that triggers an auto re-spin from the remaining pool, (2) a fairness rule preventing the vetoer from being the next manual spinner, (3) per-family persistent veto history consumable by Phase 6 Year-in-Review, and (4) real-time surfacing of veto events across devices.

Substantial veto infrastructure already exists in `js/app.js` (pre-spin filtering via `isVetoed()`, `openVetoModal`/`submitVeto`/`unveto`, `state.session.vetoes` shape, `.tc-note.veto` card display, 'vetoed' activity feed entry). Phase 4 closes the gaps: post-spin re-spin wiring, fairness enforcement, persistent history collection, and surfacing polish.

</domain>

<decisions>
## Implementation Decisions

### Re-spin Flow (VETO-02)
- **D-01:** Submitting a post-spin veto **auto-triggers `spinPick()` immediately** — no "spin again" button tap required. This is the "immediately-next spin" and is exempt from the fairness-rule button-disable (see D-06).
- **D-02:** Re-spin reuses the full existing flicker + confetti sequence — re-spin feels like a fresh spin, same theatrical moment.
- **D-03:** Vetoed titles stay out of the pool for the entire session — `isVetoed()` filter continues to apply. Reusing a vetoed title would require undo.
- **D-04:** If a veto would empty the candidate pool, **progressively relax filters** before giving up: drop the mood filter first, then other non-essential filters. Only show an empty state if the pool is still empty after all relaxations.

### Fairness Rule (VETO-06)
- **D-05:** The "spinner" is whoever **last tapped the Spin button** — tracked as `session.spinnerId` (set by `spinPick()`). Not the Picker rotation (which may be disabled).
- **D-06:** Fairness enforcement: after a member vetoes, the **"Spin again" button is disabled on the vetoer's device** with tooltip copy like "Someone else spins this one." Other family devices see the button enabled. **Exception:** the auto re-spin in D-01 runs without a button tap and is allowed — the rule only gates *subsequent manual* spins.
- **D-07:** Fairness blocks **only the immediately-next spin**. Once that spin lands, the rule clears — any member (including the prior vetoer) may veto or spin on the new pick.
- **D-08:** Solo-member edge case (only 1 `state.selectedMembers`): fairness rule is **waived** — the lone member may re-spin. Log it; don't block.

### Persistence + Daily Cap (VETO-05)
- **D-09:** Veto history persists in a new Firestore subcollection: `family/{familyId}/vetoHistory/{vetoId}` — one doc per veto event with `{titleId, titleName, memberId, memberName, comment, at, sessionDate}`. Clean, queryable, enables YEAR-04 "most vetoed" aggregation.
- **D-10:** On veto submit, write to **both** `session.vetoes` (existing) AND `vetoHistory` (new) in the same operation. History is authoritative and survives the midnight session reset.
- **D-11:** Undo is allowed **within the same session only** — `unveto()` deletes both the session entry and the corresponding `vetoHistory` doc. After midnight rollover, history is immutable.
- **D-12:** Per-member daily cap changes from today's **1 veto/day** to **2 vetoes/member/day**. Middle ground: prevents spam, allows recovery from a rough start. The existing "you already used your veto tonight" guard becomes "you've used both vetoes tonight" at the 2nd veto.

### Real-Time Surfacing (VETO-03)
- **D-13:** Veto events surface via **warm toast** ("Sam passed on Inception — spinning again…") **plus** the existing `logActivity('vetoed', …)` feed entry. No full-screen interstitial.
- **D-14:** During the auto re-spin transition, all devices show a brief **"spinning again…" shimmer** on the Spin result card; the spin modal stays open throughout. New result reveals via the standard flicker landing.

### Veto Entry Points
- **D-15:** Veto button lives in **two places**:
  - **Spin result modal** (new, prominent) — primary post-spin entry (VETO-02 surface)
  - **Title detail modal** (existing) — pre-spin entry (VETO-01 surface)
  - Not added to candidate card list (no long-press/X-icon) — keeps the list scannable.

### Veto Reason (VETO-04)
- **D-16:** Keep the existing **optional text input** in the veto modal (max 200 chars). No preset quick-chips. Low-friction; matches the warm/handwritten tone of the app.

### Claude's Discretion
- Exact toast copy, timing, and dismissal behavior — follow existing `flashToast()` patterns.
- Whether `state.session.spinnerId` is stored on the session doc or a per-session field — planner to decide based on schema fit.
- Exact filter-relaxation order for D-04 beyond "mood first" — planner to decide based on filter precedence already in code.
- Disabled-state styling of the Spin button on the vetoer's device — follow existing disabled button conventions.
- Whether to include `sessionDate` (for Year-in-Review grouping) or just `at` (ms epoch) in `vetoHistory` docs.
- Whether the daily-cap message changes wording or just count.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §"Veto System (Phase 4)" — VETO-01 through VETO-06 are the acceptance criteria
- `.planning/ROADMAP.md` §"Phase 4: Veto System" — success criteria (5 items), UI hint: yes

### Existing Veto Code (extend, don't rewrite)
- `js/app.js:1045` §`// ===== Veto / session =====` — `getVetoes()`, `myVetoToday()`, `isVetoed()`, session veto shape
- `js/app.js:5238` §`// === Veto ===` — `openVetoModal`, `submitVeto`, `unveto` implementation to extend
- `js/app.js:1491` — session doc subscription; new-day reset logic (`state.session = { vetoes: {} }`)
- `js/app.js:2010` — `isVetoed(t.id)` filter in match predicate (VETO-01 already wired here)
- `js/app.js:2066-2070` — "Vetoed tonight" divider section in Tonight render
- `js/app.js:2226-2229` — `.tc-note.veto` per-card display (who passed + comment)
- `js/app.js:4653` — activity feed 'vetoed' entry rendering

### Existing Spin Code (wire re-spin into)
- `js/app.js:4393` §`window.spinPick` — weighted-random spin with flicker animation; re-spin calls this
- `js/app.js:4440` §`showSpinResult(pick)` — where the result lands and modal populates; add Veto button here
- `js/app.js:4389` — `lastSpinId` strong penalty; note: after Phase 4, `isVetoed()` filter already prevents re-pick so penalty coexists

### Picker Rotation (adjacent, NOT the spinner for fairness)
- `js/app.js:1338` §`// ===== Who-Picks-Tonight rotation =====` — separate feature; D-05 explicitly uses spin-button tapper instead

### Firestore Patterns
- `js/app.js:5269` — existing `setDoc(sessionRef(), { vetoes: {…} }, { merge: true })` — the write pattern for D-10
- `js/firebase.js` — exports `db`, Firestore functions; `addDoc`/`collection` will be needed for `vetoHistory` subcollection
- `js/state.js` — `familyDocRef()` exists; a new `vetoHistoryRef()` helper will be added (planner's call)

### Prior Phase Context
- `.planning/phases/03-mood-tags/03-CONTEXT.md` — establishes ASVS V5 `moodById` gate pattern for window functions; same pattern applies to any new window.* veto functions that accept ids from onclick

### Project Principles
- `CLAUDE.md` — TMDB rate limits, per-family Firestore nesting, warm/cinematic design language, modular JS structure

No external ADRs or design specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `state.session.vetoes[titleId] = {memberId, memberName, comment, at}` shape — extend with `vetoHistoryId` or similar back-reference if helpful
- `openVetoModal` / `submitVeto` / `unveto` window functions — extend, don't rewrite
- `spinPick()` — callable directly for auto re-spin; already weighted + has flicker/confetti
- `flashToast()` — for D-13 real-time toast surfacing
- `logActivity('vetoed', …)` — already fires on veto submit; extend payload if planner needs more fields
- `.tc-note.veto` CSS — card-level veto display already styled
- `isVetoed()` filter in `getCurrentMatches()` — handles pool filtering for both VETO-01 pre-spin and D-03 post-spin

### Established Patterns
- Optimistic `state` update → `setDoc`/`updateDoc` → real-time listener re-renders for all devices
- Day-rollover handled on session subscription (line 1491) — `vetoHistory` must NOT live under session, so rollover doesn't wipe it
- `window.*` functions assigned at top level + called via `onclick` — ASVS V5 gate pattern required for any new id-taking function
- Weighted random spin, not uniform — re-spin uses the same `buildGenreAffinity` + `scoreTitle` path

### Integration Points
- `submitVeto` (line 5259) — extend with `addDoc(vetoHistoryRef(), entry)` and trigger `spinPick()` if a post-spin veto
- `showSpinResult` (line 4440) — add Veto button; store `session.spinnerId` when spinPick runs for fairness gating
- `spinPick` (line 4393) — write `spinnerId: state.me.id` to session when user initiates manually
- `renderTonight` / match predicate — already respects `isVetoed`, no change needed for filtering
- New `vetoHistoryRef()` helper in `js/state.js` — subcollection reference

</code_context>

<specifics>
## Specific Ideas

- Toast copy style: "Sam passed on Inception — spinning again…" (warm, lowercase, em-dash, italic-ish tone matching existing Instrument Serif accents)
- Fairness disabled tooltip: "Someone else spins this one" (soft, not accusatory)
- Daily cap message at 2nd veto used: "you've used both vetoes tonight" (retains the current warm tone; don't switch to generic error language)

</specifics>

<deferred>
## Deferred Ideas

- Candidate-card quick veto (long-press / X-icon on list cards) — explicitly rejected as entry point in D-15; could revisit if 2-modal entry feels insufficient in use.
- Full-screen "VETOED BY SAM" interstitial — too theatrical for this phase; revisit if Year-in-Review or a ritual-focused phase wants it.
- Preset quick-chip reasons ("seen it", "too long") — rejected for D-16; reconsider if free-text adoption is low after ship.
- Rotating round-robin of spin rights based on veto history — rejected for D-07; more complex fairness model possible in a future phase if family dynamics demand it.
- Fairness rule applied to Picker rotation — D-05 chose last-tapper; if enablePicker() sees broader adoption, a future phase could integrate fairness with the rotation.

</deferred>

---

*Phase: 04-veto-system*
*Context gathered: 2026-04-20*
