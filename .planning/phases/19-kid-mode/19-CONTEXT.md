---
phase: 19-kid-mode
gathered: 2026-04-29
status: ready_for_planning
mode: auto-discuss (--auto + --chain) — Claude picked recommended defaults per saved YOLO config + cross-AI audit findings
---

# Phase 19: Kid Mode — Context

**Gathered:** 2026-04-29 (auto-discuss; user invoked /gsd-discuss-phase 19 --auto --chain after PROJECT.md refresh)
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a global "Kids on the couch tonight" session toggle on the V5 roster surface that caps tier ≤ TIER_PG (2) for all Tonight + Library + spin-pick + Flow A discovery surfaces while active. Today js/app.js:5101 has a per-member age-tier cap (`tierFor(t.rating) > max` rejection inside passesBaseFilter) but the cap is "every selected member can watch" — when a Tier 5 (R-rated) member is on the couch alongside a Tier 1 (G-only) kid, the cap correctly rejects R-rated titles for the kid's tier... but ALSO doesn't suppress titles based on "kids present" mode for adult-aware moments. Phase 19 adds the explicit session-state global toggle that does the opinionated thing.

NOT in scope:
- Per-kid profile differentiation (separate tier caps per kid in kid-mode)
- Hardware parental controls integration (iOS Screen Time / Family Link sync)
- Persistent kid-mode preferences (per-kid bedtime / runtime defaults)
- Auto-detection from time of day (kid-mode after 8pm) — interesting but defer
- Kid-mode interaction with Sport vs Movie watchparty modes (skip for v1)

</domain>

<decisions>
## Implementation Decisions

### Toggle surface + visibility
- **D-01:** Toggle placement: below the existing roster action row (Mark everyone in / Clear couch / Send pushes to the rest). New row, same horizontal layout. Centered between the two main columns of the V5 roster.
- **D-02:** Visibility gate: ANY family member has `effectiveMaxTier ≤ 3` (where `effectiveMaxTier = m.maxTier != null ? m.maxTier : ageToMaxTier(m.age)`). The threshold ≤ 3 captures kids with PG-13 or below cap, which is the realistic "kids in the family" definition. Adult-only families never see the toggle.
- **D-03:** Toggle visibility re-evaluation: on every renderCouchViz call (state.members snapshot may change). No persistent caching needed.

### Session state model
- **D-04:** State: `state.kidMode = false` (default). Session-scoped — NOT persisted to Firestore. NOT persisted to localStorage. Resets when:
  - User navigates away from Tonight tab via showScreen() to a non-Tonight screen
  - Couch state changes via couchClearAll (ambient cleanup)
- **D-05:** Toggle UX: tap toggles state.kidMode + re-renders roster + re-renders Tonight surfaces. Single tap. No confirmation dialog.
- **D-06:** Multi-device: kid-mode is per-device session state. Different family members on different devices may have different kid-mode states. This is intentional — kid-mode is "what *I* am seeing right now," not a family-wide vote.

### Tier cap when active
- **D-07:** Cap value: `TIER_PG = 2` (matches RATING_TIERS for 'PG' / 'TV-PG'). Higher tiers (3 PG-13, 4 R, 5 NC-17/TV-MA) hidden globally when kid-mode is on.
- **D-08:** Apply locations:
  - `passesBaseFilter` (js/app.js:5101) — Tonight matches + considerable
  - `getCurrentMatches` (js/app.js:7660) — spin-pick
  - `getNeedsVoteTitles` (js/app.js:6717) — swipe-mode candidate pool
  - `getGroupNext3` (js/app.js:7959) — group queue rankings (via passesBaseFilter? — confirm)
  - `getTierOneRanked / getTierTwoRanked / getTierThreeRanked` (js/app.js:7986+) — Flow A picker tiers
  - Library 'unwatched' filter (js/app.js:5386)
  - Library 'forme' filter (js/app.js:5397)
  - Library 'all' filter (only when no other filter beats it — confirm at planning)
- **D-09:** Implementation: shared helper `getEffectiveTierCap()` returning `state.kidMode ? 2 : null`. When non-null, all callers cap at that tier. When null, existing per-member tier-cap logic runs unchanged. Single source of truth — easier to test.

### Per-title parent override
- **D-10:** Override surface: title detail modal (renderDetailShell) — when title is tier-blocked AND kid-mode is active AND `isCurrentUserParent()` returns true, render a "Show this anyway for tonight" link/button.
- **D-11:** Override behavior: tap → adds `t.id` to `state.kidModeOverrides = new Set()`. Session-scoped (resets with kid-mode itself). Re-renders affected surfaces.
- **D-12:** Override visibility for non-parents: link does NOT render. Detail modal still shows the title (already-routed) but no override affordance.
- **D-13:** Override scope: per-title for the current session only. Parent toggling kid-mode off + back on clears overrides.

### Visual design
- **D-14:** Toggle visual: pill-style button (`<button class="wp-control-btn">`-pattern from V5 surface). Idle state: dashed-border outline + dim. Active state: amber-filled (per BRAND.md `--color-amber` token) + slight glow.
- **D-15:** Roster ambient cue when active: amber tint on the V5 hero icon area (subtle 0.05 opacity overlay) — signals "kid-mode is on" without theatrical full-screen tint. Per BRAND.md "warm restraint."
- **D-16:** Toggle label: "Kid mode" (idle) / "Kid mode on" (active). Brief.
- **D-17:** Helper hint below toggle (idle only, dim text): "Hide R + PG-13 from tonight's pool"

### Out-of-scope safeguards
- **D-18:** Vetoed titles still hidden — kid-mode does NOT bypass `isVetoed(t.id)` check.
- **D-19:** Already-watched titles still hidden — kid-mode does NOT bypass `isWatchedByCouch` check.
- **D-20:** Provider filter still applies — kid-mode does NOT auto-disable the "limit to services" filter.

### Cross-repo + cache
- **D-21:** Single-repo phase — couch only. NO queuenight changes. NO firestore.rules changes.
- **D-22:** sw.js CACHE bumps to `couch-v36.1-kid-mode` (decimal continuation since 18 took v36).
- **D-23:** No cross-repo deploy ritual needed — `bash scripts/deploy.sh 36.1-kid-mode` is the entire deploy step.

### Claude's Discretion
- Final toggle copy + helper hint text (BANNED-words audit at planning)
- Exact CSS token usage for amber tint (existing `--color-amber` vs new helper class)
- Whether the per-title parent override should write a Sentry breadcrumb (recommend yes — analytics signal for "kids excluded but parents watch anyway" frequency)
- Test coverage strategy: smoke-availability/tonight-matches established the contract pattern; add a 4th smoke-kid-mode.cjs covering passesBaseFilter behavior with kidMode=true vs false

</decisions>

<specifics>
## Specific Ideas

- Visual reference: looks similar to "Limit to services" filter chip on Library tab, but warmer when active. Same visual language family.
- Copy voice: matches BRAND.md "warm restraint" + the Phase 15.4 group-agnostic approach — "household" / "couch" instead of "family" where possible. Toggle label is just "Kid mode" — group-agnostic, works for non-family couches too.
- Signal: the cross-AI audit ranked this P0 for the "family" brand. Both reviewers independently flagged it. The roster has 6 young members (Brody, Arianna, Zoey, Eliie, Brynlee + one more) and the existing per-member tier cap is opt-in per-tile (you have to be on the couch as a kid to filter). Phase 19 makes "kids on the couch" a one-tap intent expression.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Cross-AI feature audit (this phase's strategic justification)
- `.planning/reviews/2026-04-28-feature-audit.md` § "Features both AIs flagged that I missed" item #7 — Gemini + Codex unanimous on kid-mode as P0 for family brand

### Existing tier infrastructure
- `js/constants.js:20-40` — RATING_TIERS + TIER_LABELS + tierFor + ageToMaxTier
- `js/app.js:5101-5108` — current per-member tier cap inside passesBaseFilter
- `js/app.js:7660-7670` — getCurrentMatches tier-cap usage
- `js/app.js:5478-5485` — Library 'forme' filter tier-cap usage
- `js/app.js:6190` — isCurrentUserParent() — parent-detection helper

### V5 roster surface (toggle placement target)
- `.planning/phases/14-decision-ritual-core/14-10-SUMMARY.md` — V5 redesign reference
- `js/app.js` renderCouchViz function (find via Grep) — where the new toggle row lands

### Detail modal (parent override target)
- `js/app.js` renderDetailShell function — where the "Show this anyway" override link lands

### BRAND.md
- `BRAND.md` — warm/restraint principle. Amber tint must be subtle (≤ 0.05 opacity overlay).

### Phase 14-09 D-11 (empty-state pattern)
- `.planning/phases/14-decision-ritual-core/14-09-SUMMARY.md` — establishes the "show CTA when state qualifies, hide when not" pattern. Phase 19 toggle visibility follows same model.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `tierFor(rating)` from constants.js — already maps rating → tier number
- `ageToMaxTier(age)` from constants.js — already maps age → max tier
- `isCurrentUserParent()` — already detects parent role
- `passesBaseFilter(t)` — already accepts couch + applies tier cap; needs minor surgery to add kid-mode override
- `flashToast()` — for "Kid mode on" / "Kid mode off" feedback
- `--color-amber` CSS token (per BRAND.md) — exists for theatrical brand moments; reuse for active state
- `state.kidMode` will live in the existing state object (alongside selectedMembers, etc.)

### Established Patterns
- **Session-scoped state on `state.X`:** Phase 14-10 used `state.couchMemberIds` + `state.couchInTonight` (Firestore-persisted). Phase 19 uses session-only state — model after `state.selectedMoods` (also session-only).
- **Toggle on V5 roster:** the existing action row (Mark everyone in / Clear couch / Send pushes to the rest) is the precedent. Add a 4th row below, same visual language.
- **Per-title override on detail modal:** the existing "Rewatch this one" override (Phase 14 D-01 setRewatchAllowed) is a clear pattern. Phase 19 adds a sibling "Show this anyway" override with similar surface but session-scoped (no Firestore write).
- **Render trigger discipline:** today's earlier work made renderTonight() a hot-path concern. Toggling kid-mode must call renderTonight() (and renderCouchViz for the visual update).

### Integration Points
- `state.kidMode: bool` — new field on state object, default false
- `state.kidModeOverrides: Set<titleId>` — new field for per-title parent overrides
- `getEffectiveTierCap()` — new helper returning `state.kidMode ? 2 : null`
- `passesBaseFilter` — extend to consult `getEffectiveTierCap()` AND `state.kidModeOverrides`
- `tierAggregators` (T1/T2/T3) — same extension
- `renderCouchViz` — render the new toggle below the action row
- `renderDetailShell` — render the parent override link when conditions match
- `showScreen` — clear `state.kidMode` and `state.kidModeOverrides` on tab navigation away from Tonight

</code_context>

<deferred>
## Deferred Ideas

- **Per-kid profile differentiation** (per-kid bedtime / runtime defaults) — out of scope for v1; revisit if signal shows the cap is too coarse
- **Auto-detection from time of day** ("turn kid-mode on automatically after 8pm") — interesting but adds state-of-the-world complexity; defer
- **Kid-mode mood overrides** (auto-cap moods to "kid-friendly" subset like Family / Adventure) — defer; mood already captures intent
- **Hardware parental control sync** (iOS Screen Time / Family Link integration) — way out of scope; v2+
- **Kid-mode in watchparty live mode** (cap reactions, hide adult emoji) — fascinating but cross-cutting; revisit after Phase 7 watchparty UAT signals
- **Kid-mode + mood filter interaction nuances** — kid-mode strict cap takes precedence when both active

</deferred>

---

*Phase: 19-kid-mode*
*Context gathered: 2026-04-29 (auto-discuss mode)*
