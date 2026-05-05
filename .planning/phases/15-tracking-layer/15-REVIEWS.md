---
phase: 15
reviewers: [gemini, codex]
reviewed_at: 2026-04-26T23:55:00Z
self_skipped: claude (running inside Claude Code CLI)
plans_reviewed:
  - 15-01-PLAN.md
  - 15-02-PLAN.md
  - 15-03-PLAN.md
  - 15-04-PLAN.md
  - 15-05-PLAN.md
  - 15-06-PLAN.md
  - 15-07-PLAN.md
  - 15-08-PLAN.md
context_included:
  - 15-CONTEXT.md (full)
  - 15-RESEARCH.md (key findings excerpted)
  - 15-UI-SPEC.md (6-surface summary)
  - PROJECT.md (first 80 lines)
  - ROADMAP.md row 15
---

# Cross-AI Plan Review — Phase 15: Tracking Layer

## Gemini Review

**Risk Assessment: LOW**

The implementation plans for Phase 15 are exceptionally well-structured, demonstrating a deep understanding of the project's "brownfield" constraints and established architectural patterns. By leveraging the "Atomic Sibling Primitive" convention (coexistence of legacy individual tracking and new group tracking), the plans mitigate migration risks while delivering a clear product differentiator. The strategy for managing TMDB's data precision limits is pragmatic, and the cross-repo deploy ritual is robustly sequenced.

### Strengths
- **Non-Destructive Coexistence:** The decision to keep `t.progress[memberId]` and `t.tupleProgress[tupleKey]` as parallel primitives (rather than an immediate, destructive migration) is a high-signal "senior engineer" move. It prevents regressions in existing Trakt/sync code and allows for a "clean-up" phase later once the new shape is proven.
- **Attribution & Security:** Plan 15-01 correctly identifies the minimum viable rules change (the 5th UPDATE branch for `tupleNames`) while realizing that title-doc updates for `tupleProgress` and `mutedShows` are already covered by the existing permissive regime. The use of `writeAttribution()` across all new writers maintains system integrity.
- **Deployment Ritual (15-08):** The 4-step cross-repo deploy ritual (Rules → Indexes → CFs → App) is essential for this project. Specifically, gating the CF deploy on the watchparties index build completion prevents `FAILED_PRECONDITION` errors in production.
- **UI Contextualization:** Placing the "Your couch's progress" section (S2) within the detail modal specifically between Cast and Reviews is a thoughtful UX choice, answering "where are we?" before surfacing opinions.
- **Performance Awareness:** The CF live-release sweep (Plan 15-06) avoids the "forking parallel CFs" anti-pattern by extending `watchpartyTick`. The decision to rely on client-side TMDB refreshes instead of forcing a CF-side TMDB crawl per tick respects the rate-limit budget.

### Concerns
- **MEDIUM — Timezone/Airtime Heuristic:** Plan 15-06 Task 2 assumes a hardcoded "9pm local" (`T21:00:00`) for the `airTs` calculation. While the push body is day-only, the 24-hour window gate might miss shows that air significantly earlier/later in a specific market or for families spanning multiple timezones (though Couch is "couch-scoped," implying physical proximity).
- **LOW — Detail Modal Manual Refresh:** In Plan 15-04 Task 2, `cv15SaveRenameInput` manually re-renders the detail modal. This is necessary because the family-doc update won't trigger the title-doc listener. However, if the user renames a tuple from the "Tonight" widget (if that affordance is added later), the detail modal would need similar logic. For v1, this is handled.
- **LOW — Trakt Overlap Prompt Frequency:** The 3-hour window for co-watch detection (Plan 15-07) is a sensible heuristic, but without a "Don't ask again" persistent flag (other than simply creating the tuple), a user who repeatedly denies the grouping might see the prompt again after the next Trakt sync.

### Suggestions
- **Window Buffer in CF:** In Plan 15-06 Task 2, the window check is `minsToAir > 60 * 23 && minsToAir <= 60 * 25`. Consider widening the upper bound slightly (e.g., `60 * 26`) to account for potential 5-minute tick drift or minor Firestore delay, ensuring the "once per episode" logic doesn't skip a show due to a tight boundary.
- **Empty State "Mark Watched" CTA:** Plan 15-04 Task 2 returns `''` (hides section) if `tupleProgress` is empty. Consider implementing the "S2 empty state row 3" from UI-SPEC §Empty States (the "No progress tracked yet" message with a CTA to Mark Watched) if a user has zero tuples but clearly has individual progress. This aids feature discoverability.
- **Mute State Resilience:** In Plan 15-06, the subscriber set is `subscriberIds.delete(mid)` if muted. Confirm that `writeMutedShow` uses `deleteField()` on `muted:false` to keep the title doc clean.

---

## Codex Review

**Risk Assessment: MEDIUM-HIGH**

The Phase 15 plan is unusually thorough and mostly coherent: it decomposes the work into a sensible foundation-to-UI-to-deploy sequence, preserves the existing single-file architecture, and directly targets the phase goal of group-based watch progress plus push-based release prompts. The strongest part is the traceability from decisions to plans and the explicit cross-repo deploy ordering. The main risks are in security posture around permissive title writes, correctness of the live-release sweep, brittle Trakt overlap logic, and several implementation details that look likely to introduce UI bugs or stale-state behavior if executed verbatim.

### Strengths
- Clear dependency structure: rules/indexes first, tuple helpers second, UI and Cloud Functions later, close-out last.
- Good additive strategy: `t.tupleProgress` coexists with legacy `t.progress`, reducing migration risk.
- Strong deploy discipline: rules → indexes → functions → hosting is the right ordering.
- The push-copy substitution is surfaced explicitly with a human checkpoint instead of being silently shipped.
- The plan respects the locked v1 constraints: no framework migration, no new backend beyond existing Firebase/CF patterns.
- UI scope maps cleanly to the six surfaces from the UI spec.
- The plan anticipates PWA cache invalidation with a service worker version bump.
- It correctly avoids silently creating group progress from Trakt overlap and requires confirmation.

### Concerns

- **HIGH — Firestore title-doc rules remain too permissive for new sensitive fields.**
  The plan repeatedly accepts that any family member can write any member's `tupleProgress`, `mutedShows`, and `liveReleaseFiredFor`. That may match the existing title rule, but Phase 15 adds fields that affect other members' notifications and progress history. A malicious or confused family member can silence another person's show alerts, fabricate group progress, or suppress live-release pushes.

- **HIGH — `tupleNames` dotted-path keys may break with comma-containing or special member IDs.**
  The plan assumes member IDs cannot contain commas or Firestore field-path-sensitive characters. If member IDs are generated internally and guaranteed safe, this is fine, but the rules and helpers do not enforce it. Since `setTupleName` uses `` [`tupleNames.${tupleKeyStr}`] ``, any dot/backtick/path-sensitive character in a tuple key can corrupt nested paths or fail.

- **HIGH — Cloud Function live-release sweep may be expensive at 5-minute cadence.**
  `watchpartyTick` will fetch all titles for every family every 5 minutes, then scan all tracked TV titles. Even with early exits, this scales poorly as usage grows. It also runs on the same scheduled function as existing watchparty/intents logic, increasing blast radius.

- **HIGH — Live-release depends on client-populated `t.nextEpisode`, so pushes will silently miss stale shows.**
  The CF does not fetch TMDB and only uses title docs already refreshed by clients. That is acceptable for v1 only if explicitly framed as "best effort." For a release-notification feature, stale `nextEpisode` is a core correctness risk.

- **MEDIUM — Push-copy checkpoint is adequate, but the feature name may overpromise.**
  Dropping `{Provider}` and `{time}` is reasonable given TMDB precision, but calling the category "New season air dates" while actually using next-episode prompts could confuse users. The checkpoint should approve both copy and semantic scope: episode release prompt, not only new-season alert.

- **MEDIUM — `renderCv15TupleProgressSection` unnamed logic appears internally inconsistent.**
  `tupleDisplayName` returns derived names like "You (solo)" or "Ashley and me," so `isUnnamed = !displayName` will almost never be true. That means the `*name this couch*` placeholder may never render unless member lookup fails.

- **MEDIUM — HTML/JS escaping inside inline handlers is fragile.**
  The plans rely heavily on `innerHTML` and inline `onclick` with escaped IDs/tuple keys. `escapeHtml` is not the same as JS string escaping. This is especially risky for tuple keys embedded inside single-quoted JS arguments.

- **MEDIUM — Rename save re-render may use stale `state.family.tupleNames`.**
  `setTupleName` writes Firestore, then immediately re-renders using local state. Unless the family snapshot has already arrived, the UI may briefly revert. The plan should either optimistically update local state or wait for the snapshot.

- **MEDIUM — `cv15ShowAllTuples` expansion is underspecified.**
  The action says to add an expand flag after inserting a block that initially slices unconditionally. This is easy for an executor to miss. It should be encoded directly in the provided function body.

- **MEDIUM — Watchparty auto-track inference is too weak.**
  Using host progress + 1 is a rough guess and ignores actual queued episode data if available. The decision (D-01) says "members who joined + episode queued"; the plan instead infers from host progress. That may violate D-01 if watchparty payload already contains episode info.

- **MEDIUM — Trakt overlap detector can duplicate prompts.**
  There is no durable "declined" record. After every sync, declined candidates can reappear. The plan accepts this, but it may become irritating quickly, especially for family members with large Trakt histories.

- **MEDIUM — Trakt overlap candidate episode selection has a bug-prone comparison.**
  `candSeason` and `candEpisode` are derived separately and can mismatch if one member has a higher season and the other has a higher episode in a lower season. Use a single compare function and copy both season and episode from the winning progress object.

- **MEDIUM — Notification category deployment mismatch can create odd behavior.**
  The server may send `newSeasonAirDate` before all clients have the client preference key. The deploy order is same release window, but existing installed PWAs may remain on old cache briefly.

- **LOW — Requirement counts are inconsistent in the prompt.**
  The roadmap row says "13 TRACK-15-* requirements" in one place, but the close-out plan mints 14. The plan itself is internally 14 after adding D-07, but the source-of-truth language should be cleaned up. *(Note: ROADMAP row already updated to 0/8 on 2026-04-26; the "13" reference is the stale version Codex saw before commit bf35c64 + e7b4a73; remaining reference is in the row text. Consider a follow-up scrub.)*

- **LOW — CSS violates stated frontend guidance in one place.**
  `.cv15-tuple-name` uses `letter-spacing: -0.015em`, while the design instructions say letter spacing must be 0, not negative. *(Note: Couch's existing design system uses negative letter-spacing on Fraunces display titles per BRAND.md §3 — Codex appears to have applied a default web-design heuristic rather than the project's actual typography rules. Verify against BRAND.md before acting.)*

- **LOW — Some acceptance criteria rely on brittle grep counts.**
  Grep-based verification is useful, but several checks will become false positives/negatives as strings appear in comments, summaries, or repeated helper code.

### Suggestions
- Tighten Firestore rules for `mutedShows` at minimum: only allow a user to write/delete their own `mutedShows.{memberId}` unless acting as a managed subprofile.
- Consider validating `tupleProgress` writes so tuple keys must contain the acting member or managed member. If proxy group tracking is intentional, document that as a product decision, not just an accepted threat.
- Avoid dotted paths for tuple names unless tuple keys are guaranteed path-safe. Safer shape: `tupleNamesByHash.{hash}` with `{ tupleKey, name }`, or use `FieldPath` if available.
- Split the live-release sweep out of `watchpartyTick` or add a coarse throttle so the title scan runs at most hourly/daily per family, not every 5 minutes.
- Store a `nextEpisodeRefreshedAt` and skip/flag stale `nextEpisode` data. Consider a later CF-side TMDB refresh only for tracked shows near expected air windows.
- Change the push/category language to "Episode air dates" or "New episode alerts" unless the implementation truly targets new seasons only.
- Fix unnamed tuple rendering by separating "custom display name" from "derived display name." Placeholder should render when no custom name exists, even if a derived fallback is available elsewhere.
- Replace inline `onclick` strings for tuple keys with `data-*` attributes plus delegated event listeners, especially for rename and detail-row actions.
- Optimistically update `state.family.tupleNames[tupleKey]` after `setTupleName` succeeds before re-rendering.
- Use actual queued episode data from the watchparty/session payload if present; only fall back to host progress + 1 when no episode is known.
- Add durable decline suppression for Trakt overlap prompts, even simple `coWatchPromptDeclined.{titleId}.{tupleKey}.{season}.{episode}`.
- Fix Trakt overlap winner selection by comparing full `(season, episode)` tuples and copying both fields from the same progress object.
- Add a small integration smoke checklist specifically for old PWA cache clients: old client + new rules/functions, new client + old cached settings, and fresh install.
- Normalize Phase 15 requirement count to 14 everywhere.

---

## Consensus Summary

### Agreed Strengths (mentioned by both reviewers)
1. **Coexistence strategy is sound** — additive `t.tupleProgress[tupleKey]` alongside legacy `t.progress[memberId]` is a senior-engineer move that reduces migration risk.
2. **Cross-repo deploy ordering is correct** — rules → indexes → CFs → app + sw.js CACHE bump is the right sequence.
3. **Push-copy substitution checkpoint is the right pattern** — surfacing the TMDB-precision tradeoff to the user via `approved-push-copy` instead of silently shipping is good discipline.
4. **CF strategy: extend rather than fork** — extending `watchpartyTick` honors the existing primitive-extension convention.
5. **UI scope maps cleanly to the 6 UI-SPEC surfaces.**

### Agreed Concerns (raised by both reviewers — highest priority)

| # | Concern | Severity | Reviewers |
|---|---------|----------|-----------|
| 1 | **Trakt overlap prompt repetition risk** — no durable "declined" record; declined candidates can reappear after every sync | LOW (Gemini) / MEDIUM (Codex) | both |
| 2 | **Hardcoded 9pm local airtime / window-buffer brittleness** in CF live-release sweep | MEDIUM | both (Codex frames as scaling, Gemini as timezone) |

### Divergent Views (worth investigating)

| Issue | Gemini | Codex |
|-------|--------|-------|
| **Firestore rules permissiveness for `mutedShows` / `liveReleaseFiredFor` writes** | "Correctly identifies minimum viable rules change" — accepts as-is | **HIGH** — any family member can silence another's show alerts or suppress live-release pushes; recommends per-member field-level isolation |
| **Tuple key dotted-path safety** | Not raised | **HIGH** — `setTupleName` uses `` [`tupleNames.${tupleKeyStr}`] `` which can corrupt nested paths if member IDs contain dots, backticks, or commas |
| **CF live-release sweep cadence (5-min)** | "Respects rate-limit budget" — accepts as-is | **HIGH** — title scan every 5 minutes scales poorly; recommends throttle to hourly/daily per family |
| **Stale `t.nextEpisode` correctness** | Not raised | **HIGH** — pushes will silently miss shows without recent client refresh; for a release-notification feature, this is a core correctness risk |
| **Overall Risk Assessment** | **LOW** | **MEDIUM-HIGH** |

The divergence between LOW (Gemini) and MEDIUM-HIGH (Codex) is itself a signal: Codex's analysis is more security-focused and surfaces 4 HIGH-severity issues (rules permissiveness, dotted-path safety, CF scaling, stale-data correctness) that Gemini either accepted as project norms or didn't probe. Codex's HIGH items deserve a closer look before execution.

### Codex-Only Concerns Worth Surfacing

These are issues Gemini did not raise; some are already partially addressed in the locked CONTEXT.md / UI-SPEC, others reveal real bugs in the planned implementation:

- **Watchparty auto-track inference vs D-01 spec** — Codex notes D-01 says "members who joined + episode queued"; the plan currently infers from `host progress + 1`. If the watchparty payload already carries the episode, the plan should use that instead. Worth verifying against the actual `t.watchparties` schema in the code.
- **`renderCv15TupleProgressSection` unnamed-placeholder logic bug** — `isUnnamed = !displayName` will rarely be true if `tupleDisplayName` returns derived fallbacks like "You (solo)". The `*name this couch*` placeholder may never render. Real bug.
- **Trakt overlap candidate episode selection bug** — comparing `candSeason` and `candEpisode` separately can mismatch if one member has S5E1 and another has S4E10. Real bug.
- **Inline `onclick` + tuple keys** — escaping is fragile when tuple keys contain commas or quotes inside single-quoted JS args. Recommend `data-*` attributes + delegated listeners.

---

## Recommended Action

The 4 HIGH-severity issues from Codex (Firestore rules permissiveness for sensitive new fields, dotted-path safety, CF cadence, stale `nextEpisode`) are the most consequential. None block the plan at a structural level, but each represents a real correctness/security gap that the executor should address.

**Suggested next step:**

```
/gsd-plan-phase 15 --reviews
```

This re-spawns the planner in `--reviews` mode, which reads this REVIEWS.md and produces targeted patches to the affected plans. Expected revisions:
- 15-01: tighten the firestore.rules UPDATE branches to enforce per-member field isolation on `mutedShows` and `liveReleaseFiredFor` (and possibly `tupleProgress` if proxy writes aren't intended)
- 15-02: switch `setTupleName` from dotted-path update to a hash-keyed shape OR enforce member-ID character constraints
- 15-04: fix the unnamed-placeholder logic + replace inline `onclick` with `data-*` delegation
- 15-06: throttle the live-release scan (run inside `watchpartyTick` but only every Nth tick, or split to a daily CF) + flag stale `nextEpisode` data
- 15-07: durable Trakt overlap decline record + fix episode selection comparison

If you'd rather merge selective feedback, you can also reply with which Codex concerns to address and which to defer (e.g., the CF cadence concern may be acceptable at v1's family-count scale — defer until usage grows).
