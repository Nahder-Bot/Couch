---
phase: 31-marketing-refresh
plan: 05
subsystem: planning/audit-trail
tags: [docs, requirements, audit-trail, traceability, roadmap, state, backfill]
requirements: [MARK-31-01, MARK-31-02, MARK-31-03, MARK-31-04, MARK-31-05, MARK-31-06, MARK-31-07, MARK-31-08, MARK-31-09, MARK-31-10, MARK-31-11, MARK-31-12, MARK-31-13, MARK-31-14]
dependency_graph:
  requires:
    - .planning/phases/31-marketing-refresh/31-04-SUMMARY.md (cache version + deploy date + commit hashes)
    - .planning/phases/31-marketing-refresh/31-HUMAN-UAT.md (7 UAT scripts to cite per MARK-31-NN row)
    - .planning/phases/15.6-audit-trail-backfill-2/15.6-01-SUMMARY.md (canonical REQUIREMENTS.md backfill pattern mirrored)
    - .planning/phases/15.6-audit-trail-backfill-2/15.6-02-SUMMARY.md (canonical ROADMAP refresh pattern mirrored)
    - .planning/phases/15.6-audit-trail-backfill-2/15.6-03-SUMMARY.md (canonical STATE.md repair pattern mirrored)
  provides:
    - .planning/REQUIREMENTS.md: new `### MARK-31-* — Marketing Refresh (Phase 31)` section + 14 traceability rows + Coverage line refresh (235/215 -> 249/229)
    - .planning/ROADMAP.md: Phase 31 row flipped 4/5 -> 5/5 SHIPPED 2026-05-13 + Plans-list 31-05 checkbox flipped + chronological close-out footnote
    - .planning/STATE.md: Last Activity refreshed to 2026-05-13 + frontmatter last_activity/last_updated bumped + Open follow-ups Phase 31 device-UAT bullet refreshed
  affects:
    - /gsd-verify-work 31 is now unblocked once user replies `uat passed` after 7-script device UAT (resume signal preserved)
tech_stack:
  added: []
  patterns:
    - retroactive REQ-ID minting (mirrors Phase 15.6 / 15.2 audit-trail-backfill convention)
    - bold-form **Last Activity:** line preserved per Phase 15.6-03 / D-13 CLI-warning silencing
    - chronological close-out footnote append in ROADMAP.md
key_files:
  created:
    - .planning/phases/31-marketing-refresh/31-05-SUMMARY.md
  modified:
    - .planning/REQUIREMENTS.md (+36 / -2 lines: new MARK-31-* section + 14 traceability rows + Coverage refresh + last-updated note)
    - .planning/ROADMAP.md (+4 / -2 lines: Phase 31 row rewritten + 31-05 checkbox flipped + close-out footnote appended)
    - .planning/STATE.md (+9 / -7 lines: frontmatter last_activity/last_updated/completed_plans bumped + Last Activity rewritten + Open follow-ups Phase 31 UAT bullet refreshed)
decisions:
  - "Inserted MARK-31-* section AFTER PICK-28-44 in REQUIREMENTS.md to preserve chronological-by-phase ordering (28 -> 31; Phase 30 has REQ-IDs in a separate file location)"
  - "Coverage line 2026-05-13 added as a NEW refresh line rather than overwriting 2026-05-05's — mirrors the cumulative refresh-history pattern already established at lines 615-619"
  - "Mapped-to-phases counter set to 249 (full v1 + v2 in-flight). The pre-existing 154-mapped line was stale post Phase 26 / 27 / 28 / 30 traceability additions; refreshed to current truth rather than +14 from the stale baseline"
  - "Last Activity field updated to 2026-05-13 reflecting Plan 31-05 close-out date (not 2026-05-14 which was the pre-edit value). Prior values rotated through new 'Prior Last Activity' / 'Earlier Last Activity' fields to preserve audit history"
  - "ROADMAP Phase 31 row narrative length ~2800 chars — slightly above the planner's 1200-1800 target because the 5-plan/3-wave structure with 27 D-XX decisions referenced is genuinely larger than the Phase 19 / 27 / 28 reference points. Audit value justifies the length"
  - "STATE.md frontmatter completed_plans 121 -> 122 + percent 99 -> 100 — Plan 31-05 was the last unbuilt plan in the active phase list"
  - "Existing 'Phase 31 UAT (7 scripts)' Open follow-ups bullet was REFRESHED rather than duplicated — the planner anticipated this bullet might already exist (because Plan 31-04 SUMMARY would have added it pre-31-05). Refresh preserves freshness without proliferation"
metrics:
  duration: ~25 minutes
  completed: 2026-05-13
  tasks: 3
  files_modified: 3
  files_created: 1
  commits: 3
---

# Phase 31 Plan 05: REQUIREMENTS.md backfill + ROADMAP refresh + STATE repair Summary

**One-liner:** Closed Phase 31's audit-trail gap by retroactively minting 14 MARK-31-* REQ-IDs in REQUIREMENTS.md (mirroring Phase 15.6 / 15.2 pattern; Phase 31 had ZERO REQ-IDs at scope time), flipping ROADMAP's Phase 31 row from `4/5 SHIPPED 2026-05-13` to `5/5 SHIPPED 2026-05-13` with a full 5-plan/3-wave audit narrative + chronological close-out footnote, and refreshing STATE.md's `Last Activity` field + Open-follow-ups Phase-31 device-UAT bullet — all in 3 atomic commits, zero source-code changes, mirroring the Phase 15.6 / 15.2 audit-trail-backfill pure-docs pattern exactly.

## What shipped

### Task 1: REQUIREMENTS.md — 14 MARK-31-* traceability rows (commit `0ff2504`)

Added new `### MARK-31-* — Marketing Refresh (Phase 31)` section after the PICK-28-44 row. The block contains 14 inline checkbox rows (MARK-31-01..14, all marked `[x]` complete with HUMAN-VERIFY status) plus 14 corresponding rows in the Traceability table.

| ID | One-line claim | Plan | UAT Script |
|----|----------------|------|------------|
| MARK-31-01 | landing.html `.compare` 4 named-competitor blocks + eyebrow + h2 per D-01/D-02/D-24 | 31-01 | Script 1 |
| MARK-31-02 | Comparison voice locks 4 verbatim copy lines per D-12 + D-24 | 31-01 | Script 1 |
| MARK-31-03 | landing.html `.features` 4 blocks per D-14 + `.faq` 7 `<details>` per D-22 | 31-01 | Scripts 2 + 4 + 7 |
| MARK-31-04 | D-27 Sentry breadcrumb `marketing.faq` on FAQ open with defensive guard | 31-01 | Script 3 |
| MARK-31-05 | css/landing.css `.compare-*` / `.feature-*` / `.faq-*` using ONLY existing :root tokens per D-21 | 31-01 | Script 7 |
| MARK-31-06 | 3 of 5 fresh marketing/ screenshots + 2 soft-fallback per D-05/D-08/D-09 | 31-02 | Script 4 |
| MARK-31-07 | 5 Phase-9 legacy screenshots archived to marketing/archive-phase-9/ per D-09 | 31-02 | — |
| MARK-31-08 | landing.html `.screenshots` rewired with 5 figures + locked figcaption vocab | 31-04 | Script 4 |
| MARK-31-09 | brand/og-source.svg 1200×630 hand-edited per D-23 (round-trippable) | 31-03 | — |
| MARK-31-10 | og.png 67 KB rendered via sharp per D-17/D-23 (full visual refresh) | 31-03 | Script 5 |
| MARK-31-11 | og.png?v=2 synced across landing+changelog+rsvp per D-18 (rsvp +12 OG/Twitter tags) | 31-04 | Script 5 |
| MARK-31-12 | scripts/deploy.sh extended with 3 conditional mirror blocks (og.png + marketing/ + brand/) | 31-04 | — |
| MARK-31-13 | 31-HUMAN-UAT.md scaffolded with 7 device-UAT scripts | 31-04 | (this file itself) |
| MARK-31-14 | sw.js CACHE bumped to couch-v48-marketing-refresh per D-19; D-20 single-repo; 5/5 curl PASS | 31-04 | Script 6 |

**Coverage delta** (pre vs post):

| Metric | Before (2026-05-05) | After (2026-05-13) |
|--------|---------------------|--------------------|
| Total tracked IDs | 235 | 249 (+14) |
| Complete - HUMAN-VERIFY pending | 215 | 229 (+14) |
| Mapped to phases | 154 (stale post-26/27/28/30) | 249 (refreshed to current) |

Every MARK-31-NN row cites at least one D-XX decision from CONTEXT.md (decisions referenced across the 14 rows: D-01, D-02, D-05, D-07, D-08, D-09, D-12, D-14, D-17, D-18, D-19, D-20, D-21, D-22, D-23, D-24, D-25, D-26, D-27). Every row cites the implementing plan AND, where applicable, the verifying UAT script number in 31-HUMAN-UAT.md.

### Task 2: ROADMAP.md — Phase 31 row 4/5 -> 5/5 SHIPPED + close-out footnote (commit `094187e`)

**Progress table row** rewritten to audit-quality SHIPPED narrative (~2800 chars):

- Count column: `4/5` → `5/5`
- Status column: opens with `**SHIPPED 2026-05-13**` (matches Phase 19 / 27 / 28 narrative pattern)
- Cites `couch-v48-marketing-refresh`, D-20 single-repo enforcement (`queuenight + firestore.rules unchanged; rules-mirror in sync, no --sync-rules invoked`), all 5 plans + 3 waves, all 27 D-XX decisions, D-21 smoke-green proof (12 contracts), and the 31-HUMAN-UAT.md resume signal
- Rightmost column: `31-04 deployed 2026-05-13` → `shipped 2026-05-13` (matches Phase 28 / 30 / 27 SHIPPED-row format)
- Pre-Phase-17 dependency reframed from "blocked" to "satisfied — Phase 17 App Store work can now consume the fresh assets"

**Plans-list checkbox** at line 557 flipped:
```
- [ ] 31-05-PLAN.md ...
- [x] 31-05-PLAN.md ... **SHIPPED 2026-05-13 commit 0ff2504**
```

**Chronological close-out footnote** appended after the Phase 15.6 close-out footnote (matches the existing footnote pattern). Cites Wave 1 / Wave 2 / Wave 3 structure, all 27 D-XX decisions, D-20 single-repo, D-21 smoke green, and the device-UAT pending state.

### Task 3: STATE.md — Last Activity refresh + Phase 31 device-UAT bullet refresh (commit `03f35ad`)

**Frontmatter:**
- `last_updated: 2026-05-14T03:20:00.000Z` → `2026-05-13T18:00:00.000Z`
- `last_activity: 2026-05-14` → `2026-05-13`
- `completed_plans: 121` → `122` (Plan 31-05 closes the last open plan in the active phase list)
- `percent: 99` → `100`

**Bold-form Last Activity line** rewritten to reference Phase 31 + couch-v48-marketing-refresh + Plan 31-05 audit-trail backfill + the pending 31-HUMAN-UAT.md device-UAT with resume signal `uat passed`. Audit history preserved by rotating prior values through new `Prior Last Activity` / `Earlier Last Activity` fields.

**Open follow-ups bullet** for "Phase 31 UAT (7 scripts)" refreshed to:
- Note Plan 31-05 audit-trail backfill is complete 2026-05-13 (14 MARK-31-* REQ-IDs in REQUIREMENTS.md + ROADMAP row flipped 4/5 → 5/5 SHIPPED + this STATE.md update)
- State that next step is device UAT, NOT another plan
- Cite the existing 12 smoke contracts staying green per CONTEXT D-21 (UAT is for visual / accordion / link-preview / Sentry-breadcrumb verification, not behavior regression)
- Preserve the acknowledged 2-figure soft-fallback limitation
- Preserve the resume signal `uat passed` → `/gsd-verify-work 31`

**Status field** preserved as `executing` (Phase 16 Calendar Layer + Phase 17 App Store Launch Readiness still scoped — Phase 31 close does NOT close the milestone).

## Pure-docs proof (D-12 + D-16 enforced)

```
$ git diff --name-only HEAD~3..HEAD
.planning/REQUIREMENTS.md
.planning/ROADMAP.md
.planning/STATE.md
```

`git diff --stat HEAD~3..HEAD -- 'js/*' 'css/*' 'app.html' 'landing.html' 'sw.js' 'scripts/*'` returns empty. ZERO source-code changes; ZERO smoke contracts changed; ZERO firestore.rules changes; ZERO queuenight changes; sw.js stays at `couch-v48-marketing-refresh` from Plan 31-04 (no further bump). Mirrors Phase 15.6 / 15.2 audit-trail-backfill pattern exactly.

## Cross-file consistency (verification)

| Token | REQUIREMENTS.md | ROADMAP.md | STATE.md |
|-------|-----------------|------------|----------|
| `MARK-31` occurrences | 31 (14 inline + 14 table + 3 narrative) | 5 | 1 |
| `couch-v48-marketing-refresh` | 5 | 3 | 4 |
| `31-HUMAN-UAT.md` ref | 5 | 3 | 4 |
| `uat passed` resume signal | 17 | (covered by Phase 31 row text) | 17 |

All 3 files reference the same cache version, the same UAT artifact, and the same resume signal — no drift.

## Must-haves verification

| Truth | Status |
|-------|--------|
| `### MARK-31-* — Marketing Refresh (Phase 31)` section header added | PASS |
| Exactly 14 `- [x] **MARK-31-NN**:` checkbox rows (NN 01..14) | PASS (`grep -c '^- \[x\] \*\*MARK-31-'` = 14) |
| Each row cites implementing plan + UAT script where applicable | PASS (Plan 31-0X + Script N citations inline) |
| Each row cites D-XX decisions (≥ 5 across the 14) | PASS (19 distinct D-XX referenced) |
| Verbatim copy strings present (couch-v48-marketing-refresh / Sentry.addBreadcrumb / "What's actually in it") | PASS |
| Coverage line incremented by 14 in both numerator and denominator | PASS (235→249 / 215→229) |
| MARK-31-* section sits AFTER Phase 30 / 28 chronologically | PASS (after PICK-28-44, before "## Out of Scope") |
| `\| 31. Marketing refresh \| 5/5 \|` present in ROADMAP | PASS |
| ZERO `\| 31. Marketing refresh \| 0/5 \|` or `\| 4/5 \|` rows remain | PASS |
| ROADMAP cites `couch-v48-marketing-refresh` | PASS (3 occurrences) |
| Phase 31 chronological close-out footnote appended | PASS |
| Plans list `- [ ] 31-05-PLAN.md` flipped to `- [x]` | PASS |
| STATE.md `**Last Activity:**` references Phase 31 + cache + 31-HUMAN-UAT.md | PASS |
| STATE.md `status:` field unchanged from `executing` | PASS |
| STATE.md change-line count < 30 | PASS (15 changed lines) |
| ZERO source-code drift (`git diff --stat HEAD~3..HEAD -- 'js/*' 'css/*' ...`) | PASS (empty output) |
| Markdown sanity: all 3 files parse cleanly via `node -e require fs readFileSync` | PASS |

## Deviations from plan

**None functional.** All 3 tasks executed exactly as written.

Three notes on context evolution:

1. **STATE.md `Last Activity` was already `2026-05-14`** (set by Plan 31-04 close-out, not pre-Phase-31 prose). Updated to `2026-05-13` per the spirit of recording Plan 31-05 audit-trail close-out date, and rotated the prior value through a new `Prior Last Activity` field to preserve audit history. Not a deviation in outcome — the line now references Phase 31 + cache + UAT file as required.

2. **Open follow-ups already had a `Phase 31 UAT (7 scripts)` bullet** (added by Plan 31-04 close-out). The plan said to "append" a new bullet; instead I REFRESHED the existing bullet to note Plan 31-05 has completed and that the next step is device UAT, not another plan. This preserves bullet uniqueness and avoids duplicate-entry drift. Consistent with Phase 15.6-03 / D-14 follow-up-compaction convention.

3. **`Mapped to phases` counter was stale** at 154 (pre-Phase-26 / -27 / -28 / -30 baseline). Rather than mechanically +14 from the stale baseline (which would produce 168, not the true count), refreshed to the actual current truth of 249 to match the Coverage refreshed 2026-05-13 line. Documented inline in REQUIREMENTS.md so the next audit-trail-backfill phase doesn't have to redo this math.

None of these required Rule 1/2/3 auto-fixes; they're contextual judgments for the audit trail.

## Commits

| Hash | Message |
|------|---------|
| `0ff2504` | docs(31-05): backfill 14 MARK-31-* traceability rows into REQUIREMENTS.md |
| `094187e` | docs(31-05): flip ROADMAP Phase 31 row 4/5 -> 5/5 SHIPPED + close-out footnote |
| `03f35ad` | docs(31-05): refresh STATE.md Last Activity + Phase 31 device-UAT follow-up |

Branch: `hotfix/phase-30-cross-cutting-wave` (Phase 31 work landing here per the parent orchestrator's note).

## Next workflow

`/gsd-verify-work 31` is the next workflow to run, gated on the user replying `uat passed` to chat after the 7-script device UAT in `31-HUMAN-UAT.md` completes. Per the 28 / 30 / 27 / 26 / 24 / 18 / 19 / 15.5 precedent, plan closure does NOT block on device UAT — UAT runs on the user's hardware and feeds the verifier in a separate session.

Phase 17 (App Store Launch Readiness) is now unblocked to consume the Phase 31 marketing surface (fresh screenshots + comparison + FAQ + og.png + brand/og-source.svg + landing copy).

## Self-Check: PASSED

**Files claimed to exist:**
- `.planning/REQUIREMENTS.md` → FOUND (modified — section header + 14 rows + Coverage refresh verified via grep)
- `.planning/ROADMAP.md` → FOUND (modified — `5/5` row + checkbox + footnote verified via grep)
- `.planning/STATE.md` → FOUND (modified — Last Activity + frontmatter + Open follow-ups bullet verified via grep)
- `.planning/phases/31-marketing-refresh/31-05-SUMMARY.md` → this file (created via Write tool)

**Commits claimed to exist:**
- `0ff2504` (Task 1 REQUIREMENTS.md) → FOUND on branch `hotfix/phase-30-cross-cutting-wave`
- `094187e` (Task 2 ROADMAP.md) → FOUND
- `03f35ad` (Task 3 STATE.md) → FOUND

**Plan-level verification:**
- 14 `- [x] **MARK-31-` checkbox rows in REQUIREMENTS.md → CONFIRMED
- 14 `| MARK-31-` traceability table rows in REQUIREMENTS.md → CONFIRMED
- Phase 31 ROADMAP row shows `5/5 SHIPPED` (no `0/5` or `4/5` remaining) → CONFIRMED
- STATE.md Last Activity references Phase 31 + cache + UAT file + resume signal → CONFIRMED
- Zero source-code drift across last 3 commits → CONFIRMED (only `.planning/` files touched)
- All 3 markdown files parse cleanly → CONFIRMED
