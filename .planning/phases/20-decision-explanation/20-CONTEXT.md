---
phase: 20-decision-explanation
gathered: 2026-04-29
status: ready_for_planning
mode: pre-scoped (Claude wrote CONTEXT.md directly to save the discuss step in a fresh session)
---

# Phase 20: Decision Explanation — Context

**Gathered:** 2026-04-29 (pre-scoped at end of long session for next-session pickup; fresh session should run `/gsd-plan-phase 20 --auto` directly)
**Status:** Ready for planning

<domain>
## Phase Boundary

Add a humility-voiced explanation layer that answers "why did it pick this?" or "why is this in our matches?" on the spin-pick result + matches list + detail modal. Builds a single composable helper `buildMatchExplanation(t, couch)` that returns a human-readable string from existing data — yes-voters on couch, available providers in family pack, runtime, veto status. Surfaces in 3 places.

NOT in scope:
- Persistent decision-history surface (Year-in-Review territory)
- ML / "your couch usually picks X-genre" learned recommendations
- Provider-availability confidence beyond Phase 18's "via TMDB" attribution
- Surface restyling beyond text addition (no new modals, no new sections)

</domain>

<decisions>
## Implementation Decisions

### Helper contract
- **D-01:** New helper: `buildMatchExplanation(title, couchMemberIds)` returns a string.
- **D-02:** Output format: dot-separated phrases, ≤ 3 phrases per output. Examples:
  - `"Nahder + Zoey said yes · Available on Max · 165 min"`
  - `"Both of you said yes · Hulu · 1 hr 38 min"` (when 2 couch + both yes-voted)
  - `"Nahder said yes · Streaming on Netflix"` (when single member)
- **D-03:** Voters phrase generation:
  - 1 yes-voter: `"{Name} said yes"`
  - 2 yes-voters: `"{Name1} + {Name2} said yes"`
  - 3+ yes-voters: `"All of you said yes"` when count == couch.length else `"{count} of you said yes"`
- **D-04:** Provider phrase: pick the first matching brand in `t.providers[]` that intersects ANY couch member's `m.services[]`. Otherwise show `"Streaming on {firstProvider}"` if t.providers non-empty, else omit.
- **D-05:** Runtime phrase: `"{H} hr {M} min"` if ≥ 60 min, else `"{M} min"`. Skip if t.runtime is null.
- **D-06:** Cap output at 3 phrases — if more would qualify, drop in priority order: voters > provider > runtime.

### Surface integrations
- **D-07:** Spin-pick result modal — explanation rendered as italic Instrument Serif sub-line below the picked title's name. Always visible (no tap-to-reveal).
- **D-08:** Tonight matches list — explanation rendered as a small dim-text footer on each match card, single line. Visible by default (no tap-to-reveal — Codex feedback was "reduces distrust" so always-on is the right call).
- **D-09:** Detail modal — new "Why this is in your matches" section, rendered when t.id is currently in matches list. If not in matches (e.g. user opened from Library), section omitted.
- **D-10:** Considerable list — same explanation but voters phrase reads `"Some of you said yes"` for the 1-of-N case to match the "not unanimous" framing.

### Voice
- **D-11:** Per BRAND.md: warm, restraint, direct. No marketing language, no exclamation marks. Italic Instrument Serif on spin-pick + detail-modal placements.
- **D-12:** Banned words: same sweep as Phase 15.4 / 15.5 / 18. No "buffer", "delay", "queue" (in queue UX context). "Available", "streaming", "said yes" are OK.

### Out-of-scope guards
- **D-13:** No persistence — explanation is computed at render time, not stored.
- **D-14:** No new state slots on `state.X`.
- **D-15:** No Firestore writes.

### Cross-repo + cache
- **D-16:** Single-repo couch only. NO queuenight changes.
- **D-17:** sw.js CACHE bumps to `couch-v36.2-decision-explanation`.

### Claude's Discretion
- Final phrase punctuation (· vs · vs |)
- Whether to add a 4th smoke contract `smoke-decision-explanation.cjs` covering the helper (recommend yes — pure function)
- Whether to add a Sentry breadcrumb on detail-modal "why this won" expansion (probably no — read-only surface, no behavior to track)
- Whether to A/B test always-visible vs tap-to-reveal on the matches-card footer (defer — instrument first, A/B later)

</decisions>

<specifics>
## Specific Ideas

- Codex pitch verbatim: *"Decision history / why this won. Families will ask 'why did it pick this?' A small explanation layer could reduce distrust: 'Ashley + Nahder said yes, available on Hulu, 112 min.'"*
- Voice consistency with today's other shipped phases: 18 used "{titleName} just hit {brand} for your household" + "Provider data via TMDB" attribution. Phase 20's "Available on {brand}" reuses the same brand-naming pattern.
- Matches-list footer placement: under the existing tile content, before any action buttons. Single line. Dim color (--ink-dim per design tokens).
- Considerable variant must call out that the couch isn't unanimous — "Some of you said yes" is the considerable-flavored voter phrase.

</specifics>

<canonical_refs>
## Canonical References

### Cross-AI feature audit (this phase's strategic justification)
- `.planning/reviews/2026-04-28-feature-audit.md` § "Features both AIs flagged that I missed" item #8 — Codex pitch on decision explanation

### Existing data sources
- `js/app.js:5052` (or current line) — matches filter (couch yes-voters live in `t.votes` keyed by member id)
- `js/app.js` — passesBaseFilter (already excludes vetoes, watched, no/seen votes — explanation does NOT need to repeat these)
- `js/app.js:4825-4848` — titleMatchesProviders + m.services intersection logic (mirror for D-04 provider phrase)
- `js/app.js` — t.providers / t.rentProviders / t.buyProviders shape (Phase 18-02 reference for provider name iteration)
- `js/app.js` — t.runtime field

### Surface integration targets
- Spin-pick result modal — Grep for spinPick or `function spinPick`
- renderTonight matches-list rendering — Grep for `card(t)` or matchesHtml composition
- renderDetailShell — Grep; same surface as Phase 19-02's parent override

### Voice
- `BRAND.md` — warm/restraint principle
- Phase 19's `19-02-SUMMARY.md` — italic Instrument Serif voice on detail-modal additions (parent override link uses same family)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `t.votes` map (memberId → 'yes'/'no'/'seen') — primary data source
- `state.members` for name lookup
- `m.services[]` per member — provider intersection
- `normalizeProviderName()` — for brand matching
- `t.providers[]`, `t.rentProviders[]`, `t.buyProviders[]` — provider data
- `t.runtime` — minutes
- `escapeHtml` — for safe HTML interpolation

### Established Patterns
- Pure-function smoke contracts (smoke-tonight-matches / smoke-availability / smoke-kid-mode) — add a 4th smoke-decision-explanation.cjs
- Italic Instrument Serif voice for "humility" text — Phase 18 "Provider data via TMDB" affordance + Phase 19 parent override link both use this
- Pure helper at module top (no state mutation) — mirror getEffectiveTierCap (Phase 19) location/style

### Integration Points
- New helper `buildMatchExplanation(t, couchMemberIds)` near other display helpers
- 3 call sites for the helper:
  - spinPick result render
  - matches-list card composition (tile rendering)
  - detail-modal "Why this is in your matches" section
- Optional 4th call site: considerable-list card composition (variant voter phrase)

</code_context>

<deferred>
## Deferred Ideas

- **Persistent decision history** — capture per-night spin results to feed Year-in-Review (Phase 10 territory)
- **Learned recommendations** — "your couch usually picks comedies on Friday nights" requires ML/heuristic engine, way out of scope
- **Provider confidence indicators** — Phase 18's "via TMDB" attribution covers this for the availability surface; Phase 20 doesn't extend it
- **Tap-to-expand decision detail** — full breakdown of every couch member's vote, every provider available, etc. Defer; the 3-phrase summary is enough for v1

</deferred>

---

*Phase: 20-decision-explanation*
*Context gathered: 2026-04-29 (pre-scoped for next-session pickup)*
