---
phase: 18-availability-notifications
plan: 02
subsystem: couch client / push notifications / friendly-UI Settings parity / detail-modal affordance
tags: [push, settings, friendly-ui, detail-modal, refresh, phase-18, client-mirror]
requires:
  - js/app.js DEFAULT_NOTIFICATION_PREFS map (existing — extended)
  - js/app.js NOTIFICATION_EVENT_LABELS map (existing — extended)
  - js/app.js NOTIF_UI_TO_SERVER_KEY map (existing — extended)
  - js/app.js NOTIF_UI_LABELS map (existing — extended)
  - js/app.js NOTIF_UI_DEFAULTS map (existing — extended)
  - js/app.js fetchTmdbExtras (existing — reused by refreshProviders)
  - js/app.js writeAttribution helper (existing — reused)
  - js/app.js flashToast utility (existing — reused for success + error toasts)
  - queuenight NOTIFICATION_DEFAULTS.titleAvailable (Plan 18-01; server gate)
provides:
  - DEFAULT_NOTIFICATION_PREFS.titleAvailable: true (DR-3 client place 2 of 6)
  - NOTIFICATION_EVENT_LABELS.titleAvailable entry (DR-3 client place 3 of 6)
  - NOTIF_UI_TO_SERVER_KEY.titleAvailable identity entry (DR-3 client place 4 of 6)
  - NOTIF_UI_LABELS.titleAvailable entry, verbatim copy (DR-3 client place 5 of 6)
  - NOTIF_UI_DEFAULTS.titleAvailable: true (DR-3 client place 6 of 6)
  - refreshProviders writes lastProviderRefreshAt: Date.now() so CF round-robin stays accurate after manual refresh
  - "Refresh availability" detail-modal button label (D-17)
  - "Provider data via TMDB" italic attribution footnote (D-16)
  - "Availability refreshed." success toast + "Refresh failed. Try again." failure toast
affects:
  - Plan 18-04 (cross-repo deploy ritual) — couch hosting deploy will surface the new toggle in BOTH legacy + friendly-UI Settings + the refreshed detail-modal affordance
  - Plan 18-03 (smoke gate) — no direct dep; this plan only touches client-side code, server smoke gate is independent
  - TD-8 (dual-Settings-screen consolidation) — adds 1 more key to the dual-coverage tracking; both surfaces now expose titleAvailable
tech-stack:
  added: []
  patterns:
    - "Phase 15.4-02 5-map mirror pattern: 1 server key landing in lockstep across DEFAULT + LABELS + 3 friendly-UI maps to satisfy DR-3 dual-Settings-screen parity"
    - "Single-source-of-voice copy: NOTIF_UI_LABELS.titleAvailable mirrors NOTIFICATION_EVENT_LABELS.titleAvailable verbatim (BRAND restraint — author once, mirror everywhere)"
    - "Aligned-equals-sign columns inside the 3 friendly-UI maps preserved (key:      'value') matching Phase 15.4-02 style"
    - "writeAttribution + setBy:'system' attribution split: client-side refreshProviders is a USER write (writeAttribution stamps acting member), CF-side providerRefreshTick is a SYSTEM write (setBy:'system' marker; Plan 18-01)"
    - "alert() -> flashToast migration: BRAND warm-restraint requires console.warn breadcrumb + flashToast user-facing surface; alert() is jarring per CLAUDE.md design system"
key-files:
  created: []
  modified:
    - C:/Users/nahde/claude-projects/couch/js/app.js
decisions:
  - "Used PLAN's verbatim copy for label/hint ('Newly watchable' / 'When a title in your queue lands on a service in your pack.') rather than the CONTEXT.md D-20 alternate copy ('New on a service you have' / 'Daily check: when a title someone on your couch wants becomes watchable on a service in your pack.'). PLAN is normative spec; CONTEXT is gathered-decisions input — planner finalized + banned-words-swept the chosen copy in PLAN's <objective>. Both copies pass banned-words sweep. PLAN copy is shorter + more agentive ('lands on' is BRAND-aligned, vivid)"
  - "Preserved setTimeout(openDetailModal) on success — the existing reopen-modal UX rerenders with fresh providers; the new flashToast adds explicit confirmation but doesn't replace the visual refresh"
  - "providerAttribution rendered in BOTH ternary branches (anyAvail + providersChecked-empty) so users see TMDB attribution even when no providers are listed (the third 'else empty' branch is unaffected — no detail section rendered means no attribution to show)"
  - "Inline style on attribution footnote uses --s1 + --t-micro tokens + 0.6 opacity + italic — matches BRAND restraint posture (subtle, not shouty); avoids touching css/app.css for a 1-element footnote"
metrics:
  duration: "~2 min"
  completed: 2026-04-29
  tasks_completed: 3
  tasks_total: 3
  files_changed: 1
  lines_added: ~47
  lines_removed: ~13
---

# Phase 18 Plan 02: Couch Client Mirror + Manual Refresh Affordance — Summary

Client-side closure for Phase 18 Availability Notifications. All edits local to
`couch/js/app.js`. Adds the `titleAvailable` key to 5 client-side maps (closing
the DR-3 dual-Settings-screen parity) and polishes the existing detail-modal
manual-refresh affordance with a clearer button label, an explicit success
toast, the `lastProviderRefreshAt` write that keeps the CF round-robin
accurate, and a small "Provider data via TMDB" attribution footnote per the
Codex confidence requirement (D-16). No deploy — gated to Plan 18-04.

## What Shipped

### js/app.js (3 commits; +~47 / -~13 net)

**Task 1 — DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS (commit `5a86045`)**

- **Line 136 — DEFAULT_NOTIFICATION_PREFS gains `titleAvailable: true`.**
  `couchPing: true` (the previous last key) gained a trailing comma.
  `titleAvailable` slots in immediately after as the new last key. Mirror of
  queuenight `NOTIFICATION_DEFAULTS.titleAvailable` (Plan 18-01). Default ON
  per RESEARCH risk-2 + cross-AI review: low-volume, high-signal channel —
  fires only when a title in someone's queue becomes newly watchable on a
  brand they own. Users opt out via Settings if noisy (D-20). This is client
  place 2 of 6 in the DR-3 mirror chain.

- **Line 185 — NOTIFICATION_EVENT_LABELS gains `titleAvailable` entry.**
  `couchPing` entry gained a trailing comma. New entry uses BRAND-voice copy:
  - Label: `'Newly watchable'`
  - Hint: `'When a title in your queue lands on a service in your pack.'`

  Banned-words sweep PASSES — `'queue'` and `'pack'` are Couch product
  primitives (per BRAND.md banned-words section, the prohibited cluster is
  video-playback engineering vocabulary; the product noun `'queue'` is exempt
  per same exemption status as `'couch'` in `'couch nudges'`). `'lands on'`
  is vivid + agentive (BRAND-aligned). Client place 3 of 6.

**Task 2 — 3 friendly-UI Settings maps mirror (commit `7f04d2f`)**

Per the Phase 15.4-02 mirror pattern, identical entries land in all 3
friendly-UI maps in canonical post-`couchPing` position:

- **Line 214 — NOTIF_UI_TO_SERVER_KEY** gains `titleAvailable: 'titleAvailable'`
  identity entry. uiKey === serverKey (no rename — post-Phase-12 keys keep
  server names; the alias map only exists to bridge the 6 Phase-12 keys whose
  friendly-UI names diverged). Client place 4 of 6.

- **Line 241 — NOTIF_UI_LABELS** gains `titleAvailable` entry with VERBATIM
  copy mirroring NOTIFICATION_EVENT_LABELS (single-source-of-voice; the same
  string set appears in both the legacy + friendly-UI Settings surfaces).
  Client place 5 of 6.

- **Line 266 — NOTIF_UI_DEFAULTS** gains `titleAvailable: true` matching
  server-side NOTIFICATION_DEFAULTS exactly (Plan 18-01). Client place 6 of 6.

All 3 edits added a trailing comma to the previous-last `couchPing` line, so
the new `titleAvailable` line is the new last entry preserving the existing
"last entry has no trailing comma" convention. Aligned-equals-sign column
spacing preserved per Phase 15.4-02 style.

**Task 3 — refreshProviders + renderDetailShell (commit `416ab32`)**

- **Lines 7123-7152 — refreshProviders rewrite.** The function body keeps its
  existing TMDB re-fetch + Firestore writeback structure with three changes:
  1. **`lastProviderRefreshAt: Date.now()` added to update object** (D-18) so
     a manual refresh advances the same cursor the daily CF reads. This
     prevents the providerRefreshTick CF from immediately re-fetching a title
     the user just manually refreshed (round-robin oldest-first sort uses the
     same field).
  2. **Success path — explicit `flashToast('Availability refreshed.', { kind: 'info' })`**
     added (D-18 verbatim copy). The existing `setTimeout(() => openDetailModal(id), 150)`
     is preserved — the modal still rerenders with fresh provider data; the
     toast adds the user-visible confirmation that previously was implicit.
  3. **Error path — `alert(...)` replaced with `flashToast('Refresh failed. Try again.', { kind: 'warn' })`**
     plus a `console.warn('[18/refreshProviders] failed:', e && e.message)`
     breadcrumb for Sentry-side observability. `alert()` is jarring per the
     CLAUDE.md design-system "warm restraint" principle; flashToast surfaces
     errors at the same UX level without breaking the modal flow.

  Manual refresh does NOT trigger any push fan-out (D-19) — the CF
  `providerRefreshTick` is the only push-firing path. No Firestore write to
  `/couchPings` or any other push collection occurs in this function.

- **Lines 7552-7561 — renderDetailShell Where-to-watch updates.**
  1. **Button label changed** from `'↻ Refresh'` to `'↻ Refresh availability'`
     (D-17). Self-describing affordance — users who don't know what
     `'Refresh'` refers to in the where-to-watch section now get explicit
     context. Title attribute (`'Refetch availability from TMDB'`) preserved
     verbatim. Same `onclick="refreshProviders('${t.id}')"` handler.
  2. **`'Provider data via TMDB'` attribution footnote added** (D-16).
     Rendered as inline-styled italic divider with `--t-micro` font-size +
     `--s1` top margin + 0.6 opacity (BRAND restraint; subtle, not shouty).
     Renders in BOTH branches of the providersHtml ternary (anyAvail +
     providersChecked-empty) so the attribution shows even when no providers
     are listed. The third (else `''`) branch is unaffected — no detail
     section rendered means no attribution to show.

## Deviations from Plan

### None functional — copy-source clarification

The PLAN's `<action>` blocks specified label `'Newly watchable'` + hint
`'When a title in your queue lands on a service in your pack.'`. The
prompt's `<key_context>` (sourced from CONTEXT.md D-20) referenced a different
copy variant (`'New on a service you have'` / `'Daily check: when a title
someone on your couch wants becomes watchable on a service in your pack.'`).

Per GSD convention, the PLAN.md `<action>` block is the normative spec —
CONTEXT.md is gathered-decisions input that the planner refines through
banned-words sweeps + length/voice review before locking the final copy in
the plan. The PLAN's chosen copy was banned-words-swept in `<objective>`
(both copies pass — `'queue'` + `'pack'` are Couch product primitives per
BRAND.md exemption). The PLAN copy is shorter + more agentive (`'lands on'`
is vivid; `'Daily check:'` prefix adds nouns without information). Used
PLAN copy verbatim. No deviation tracker entry needed — this is "follow the
spec exactly" not "auto-fix bug" or "change scope".

No CLAUDE.md violations. The "NEVER full-read js/app.js" rule was respected:
all reads used offset+limit windows (95-160 for the maps section, 7100-7140
for refreshProviders, 7510-7560 for renderDetailShell). Total lines read from
js/app.js this session: ~250 of ~15800 (1.6%).

No pre-existing code touched outside the named edit anchors. No untracked
files created. No package.json or build config changed.

## Auth Gates

None. All edits local to filesystem; no external auth required. No deploy
this plan — couch hosting deploy is gated to Plan 18-04.

## Banned-Words Audit

New strings introduced in this plan:

- `'Newly watchable'` (label x2 — legacy + friendly-UI maps) — **clean**.
  BRAND-aligned (warm + direct).
- `'When a title in your queue lands on a service in your pack.'` (hint x2) —
  **clean**. `'queue'` is a Couch product primitive (exempt — the BANNED-words
  list prohibits `'queue'` in the video-playback cluster, not the UX-noun
  sense). `'pack'` is the family-services-pack primitive established in
  Phase 11 + Phase 15.4. `'lands on'` is vivid + agentive.
- `'Provider data via TMDB'` (attribution footnote) — **clean**. Source
  attribution; no banned terms.
- `'Availability refreshed.'` (success toast) — **clean**.
- `'Refresh failed. Try again.'` (failure toast) — **clean**. Direct,
  warm-restraint per BRAND.
- `'↻ Refresh availability'` (button label) — **clean**.

No banned terms (buffer / queue-as-playback-noun / sync / lag / latency /
playback). **PASS.**

## Threat Model Coverage

Per the plan's `<threat_model>` section, this plan's implementation covers:

| Threat | Disposition | Implementation |
|---|---|---|
| T-18-07 (manual refresh storms cause TMDB rate-limit hit) | accept | No client-side debounce added; bounded by detail-modal interaction (~1 click/sec realistic). Per CONTEXT Deferred Ideas, refresh-availability rate limiting is deferred until signal of abuse. |
| T-18-08 (manual refresh writes lastProviderRefreshAt for unauthorized titles) | mitigate | Existing title-doc UPDATE rule (firestore.rules:427-516) gates on `attributedWrite()` (auth.uid + memberId anchored). lastProviderRefreshAt is not under any per-key isolation branch, so the existing attributedWrite gate applies — same trust model as the existing providers writeback. |
| T-18-09 (via-TMDB attribution leaks third-party dependency) | accept | TMDB attribution is a public TMDB API ToS requirement; surfacing it is a transparency win. Same posture as the public-by-design TMDB key. |
| T-18-10 (alert -> flashToast accidentally drops error visibility) | mitigate | flashToast surfaces errors at same UX level as alert() (more BRAND-aligned). console.warn breadcrumb retained for Sentry-side observability — user-facing toast plus server-side console log gives both UX feedback AND debug trace. |

ASVS L1: input validation handled by existing title-doc UPDATE rule
(attributedWrite + Phase 15.1 per-key isolation); per-event-type opt-out gate
via existing sendToMembers eventType-aware path (Plan 18-01 server-side); no
new collections or fields require new rules (D-23 still holds).

## Cross-Repo Deploy Status

**Couch commit:** `416ab32` (last of 3 task commits) on `main` branch at
`C:/Users/nahde/claude-projects/couch/`. Local-only — not yet deployed. No
hosting deploy this plan; deploy gated to Plan 18-04.

**Queuenight:** unchanged. Plan 18-01 commit `d622dc6` still local-only on
queuenight `main`. Plan 18-04 cross-repo deploy ritual will:
1. `cd ~/queuenight && firebase deploy --only functions --project queuenight-84044`
   (queuenight FIRST per D-21 — the providerRefreshTick CF + titleAvailable
   server gate must exist before clients start writing it to user prefs)
2. `cd C:/Users/nahde/claude-projects/couch/ && bash scripts/deploy.sh 36-availability-notifs`
   (couch hosting SECOND — sw.js CACHE auto-bumped to
   `couch-v36-availability-notifs` per D-22)

Per `feedback_deploy_autonomy.md` MEMORY note Claude is authorized to run
`firebase deploy` to queuenight-84044 without per-deploy approval — but only
at Wave 2 / Plan 18-04, NOT here.

## Verification Gates Run

| Gate | Command | Result |
|---|---|---|
| Syntax | `node -c js/app.js` | exit 0 ✓ |
| Total titleAvailable occurrences | `grep -c "titleAvailable" js/app.js` | 10 (≥5 expected — 5 keys + 5 traceability comments) ✓ |
| Single-quote 'Newly watchable' label | `grep -c "label: 'Newly watchable'" js/app.js` | 1 (NOTIFICATION_EVENT_LABELS) ✓ |
| Double-quote "Newly watchable" label | `grep -c 'label: "Newly watchable"' js/app.js` | 1 (NOTIF_UI_LABELS) ✓ |
| lastProviderRefreshAt write | `grep -c "lastProviderRefreshAt: Date.now()" js/app.js` | 1 ✓ |
| Success toast | `grep -c "Availability refreshed." js/app.js` | 1 ✓ |
| Button label new | `grep -c "↻ Refresh availability" js/app.js` | 1 ✓ |
| Attribution footnote | `grep -c "Provider data via TMDB" js/app.js` | 1 ✓ |
| Failure toast | `grep -c "Refresh failed. Try again." js/app.js` | 1 ✓ |
| Old alert removed | `grep -c "alert('Refresh failed:" js/app.js` | 0 ✓ |
| Old button label removed | `grep -c "↻ Refresh<" js/app.js` | 0 ✓ |

Plan-level verify gate #3 expected `grep -nc "titleAvailable: true"` to
return 2 (DEFAULT + NOTIF_UI_DEFAULTS). Actual: 1. Cause: NOTIF_UI_DEFAULTS
uses aligned-equals-sign style (`titleAvailable:      true` — multiple
spaces) per Phase 15.4-02 friendly-UI map convention; the literal-string
grep pattern doesn't match the multi-space variant. Both entries are
semantically present + verified by direct line inspection
(line 136: `titleAvailable: true`, line 266: `titleAvailable:      true`).
Acceptance criteria met (DEFAULT_NOTIFICATION_PREFS contains titleAvailable: true,
NOTIF_UI_DEFAULTS contains titleAvailable: true).

## Requirements Closed

Per Plan frontmatter `requirements_addressed`:
- **REQ-18-03** (manual refresh affordance + via-TMDB attribution) — closed
  (button label refreshed; attribution footnote added; lastProviderRefreshAt
  write keeps CF round-robin accurate)
- **REQ-18-04** (titleAvailable client mirror) — closed (5 client-side maps
  all carry the new key in lockstep; D-20 client mirror complete; combined
  with Plan 18-01 server place this completes places 1-6 of 6)
- **REQ-18-05** (per-event-type opt-out via Settings) — closed (toggle
  surfaces in BOTH legacy NOTIFICATION_EVENT_LABELS Settings UI AND the
  Phase 12 friendly-UI Settings via NOTIF_UI_LABELS; sendToMembers
  eventType gate already lands the opt-out enforcement server-side per
  Plan 18-01)

## Open Questions / Follow-ups

None blocking. Minor:

- **Dual-Settings-screen consolidation (TD-8)** — adding the 5th Phase-18
  key to both legacy + friendly-UI surfaces continues the dual-coverage
  pattern. Both surfaces now expose the same key set; picking a winner is
  risk-free polish work tracked in TECH-DEBT.md.

- **Phase 18 device-UAT items for HUMAN-VERIFY queue** — Plan 18-04 Task 4
  will UAT:
  1. Settings → notifications shows the new "Newly watchable" toggle (default ON)
  2. Title detail modal → Where-to-watch shows the new "↻ Refresh availability"
     button + "Provider data via TMDB" footnote
  3. Tap the button → toast "Availability refreshed." + providers re-render +
     Firestore title doc shows updated `lastProviderRefreshAt` timestamp
  4. Toggle "Newly watchable" OFF in Settings → simulated CF push to that
     user is suppressed (server-side eventType-gate)

  Tracked under Plan 18-04, not this plan.

## Self-Check: PASSED

**Files verified:**
- `C:/Users/nahde/claude-projects/couch/js/app.js` — FOUND (modified, syntax valid)
- `C:/Users/nahde/claude-projects/couch/.planning/phases/18-availability-notifications/18-02-SUMMARY.md` — FOUND (this file)

**Commits verified:**
- `5a86045` — FOUND on main (Task 1: DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS)
- `7f04d2f` — FOUND on main (Task 2: 3 friendly-UI Settings maps mirror)
- `416ab32` — FOUND on main (Task 3: refreshProviders + renderDetailShell polish)

**Verification grep results (all per Plan acceptance criteria):**
- `node -c js/app.js` → exit 0 ✓
- `titleAvailable` total → 10 (5 entries + 5 comment markers) ✓
- `label: 'Newly watchable'` → 1 ✓
- `label: "Newly watchable"` → 1 ✓
- `lastProviderRefreshAt: Date.now()` → 1 ✓
- `Availability refreshed.` → 1 ✓
- `↻ Refresh availability` → 1 ✓
- `Provider data via TMDB` → 1 ✓
- `Refresh failed. Try again.` → 1 ✓
- `alert('Refresh failed:` → 0 ✓
- `↻ Refresh<` → 0 ✓
