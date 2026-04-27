---
phase: 15
plan: 07
subsystem: tracking-layer-client-push-triad-and-trakt-overlap
tags: [tracking-layer, notification-triad, trakt-sync, co-watch-overlap, S5-modal, D-07-disclosure, REVIEW-MEDIUM-9, REVIEW-MEDIUM-10, REVIEW-MEDIUM-12]
requires:
  - "15-02 helpers (tupleKey, isSafeTupleKey, writeTupleProgress) — js/app.js:8043+"
  - "15-04 .cv15-cowatch-prompt-* CSS namespace block (css/app.css:2564-2595) — consumed verbatim"
  - "15-06 server NOTIFICATION_DEFAULTS.newSeasonAirDate: true (queuenight/functions/index.js — uncommitted, awaiting 15-08 deploy)"
  - "15-02 family-doc onSnapshot tupleNames hydration (extended here for coWatchPromptDeclined)"
  - "writeAttribution() from js/utils.js (already imported)"
  - "Sentry global guard pattern (typeof Sentry !== 'undefined' && Sentry.addBreadcrumb)"
provides:
  - "8th DEFAULT_NOTIFICATION_PREFS key newSeasonAirDate: true (DR-3 place 2 of 3) — client-side mirror of 15-06 server gate"
  - "8th NOTIFICATION_EVENT_LABELS entry newSeasonAirDate (DR-3 place 3 of 3) — REVIEW MEDIUM-12 'New episode alerts' framing"
  - "trakt.ingestSyncData per-episode lastWatchedAt capture (TRACK-15-12) — lands in t.progress[meId].lastWatchedAt on both update + create paths"
  - "trakt.detectAndPromptCoWatchOverlap — walks state.titles, finds member pairs with source==='trakt' AND lastWatchedAt within ±3hr"
  - "cv15EpisodeOrdinal + cv15SelectHigherProgress (REVIEW MEDIUM-10) — single-comparator winner-pair selector preventing S5E1-vs-S4E10 mismatch"
  - "state._coWatchPromptQueue + cv15ProcessNextCoWatchPrompt — one S5 modal at a time"
  - "renderCv15CoWatchPromptModal — S5 modal with verbatim UI-SPEC copy + No default focus + outside-tap=No"
  - "cv15CoWatchPromptAccept → writeTupleProgress(...,'trakt-overlap')"
  - "cv15CoWatchPromptDecline → families/{code}.coWatchPromptDeclined.{tk} dotted-path write (REVIEW MEDIUM-9; try/catch + Sentry breadcrumb)"
  - "state.family.coWatchPromptDeclined hydration via family-doc onSnapshot extension"
  - "renderTraktCard disconnected-state D-07 disclosure (eyebrow + Instrument Serif italic sub-line)"
  - "Detector hook fired after trakt.sync's lastSyncedAt write (.catch-guarded)"
affects:
  - "Plan 15-08 (cross-repo deploy ritual close-out): MUST extend the family-doc 5th UPDATE branch allowlist in firestore.rules to include 'coWatchPromptDeclined' before deploying queuenight rules. Without this, every cv15CoWatchPromptDecline persistence write will be DENIED by rules — the local UX still drains the queue (try/catch + Sentry breadcrumb wraps the failure) but the durable decline record will not land, defeating the REVIEW MEDIUM-9 'don't re-nag' guarantee. See 'CRITICAL CROSS-PLAN COORDINATION NOTE' below."
  - "Plan 15-VERIFY: smoke test the REVIEW MEDIUM-10 single-comparator (S5E1 vs S4E10 within ±3hr → resolves to S5E1, NOT S5E10 — the original bug); smoke test REVIEW MEDIUM-9 decline persistence (decline + re-sync → no re-prompt); confirm Settings → Notifications shows 'New episode alerts' label (NOT 'New season air dates')."
tech-stack:
  added:
    - "Per-episode timestamp capture in Trakt sync (lastWatchedAt = ep.last_watched_at scoped to max-season run; reset on new max season)"
    - "Single-ordinal episode comparator pattern (cv15EpisodeOrdinal: season * 1000 + episode); prevents independent-max bug"
    - "Per-tuple decline persistence pattern (families/{code}.coWatchPromptDeclined.{tupleKey} = timestamp; dotted-path with HIGH-2 isSafeTupleKey gate; optimistic local update mirroring 15-02 MEDIUM-8)"
    - "Modal queue manager pattern (state._coWatchPromptQueue + cv15ProcessNextCoWatchPrompt — one modal at a time per UI-SPEC §Surface S5)"
    - "REVIEW MEDIUM-7-style delegated listener for the S5 modal (data-cv15-action='cowatchAccept'/'cowatchDecline' + outside-tap-equals-decline)"
  patterns:
    - "Mirrors 15-04's .modal-bg shell + delegated-listener pattern (data-cv15-action attrs; idempotent listener attach by sentinel-DOM-element-existence rather than data-cv15-bound)"
    - "Mirrors 15-02 family-doc snapshot hydration line (state.family.tupleNames neighbor)"
    - "Mirrors 15-02 setTupleName try/catch + Sentry breadcrumb pattern for the cross-plan-deferred decline write"
    - "Server/client triad lockstep: 8th key matches 15-06 NOTIFICATION_DEFAULTS exactly; key preserved 'newSeasonAirDate' for D-12 back-compat per MEDIUM-12 KEY-vs-LABEL distinction"
key-files:
  created:
    - ".planning/phases/15-tracking-layer/15-07-SUMMARY.md (this file)"
  modified:
    - "js/app.js (~226 net insertions across 6 contiguous regions)"
decisions:
  - "Inserted the detector + helpers + S5 modal block at js/app.js:914-1101 — IMMEDIATELY AFTER 'window.trakt = trakt;' (line 912 → 913) and BEFORE the OAuth postMessage listener (was line 914, now 1103). The plan said 'AFTER the }; of trakt.sync's assignment expression' but trakt is structured as an object literal at 'const trakt = { ... }' (line 399 → 911) with sync as a property method — so the trakt.detectAndPromptCoWatchOverlap = ... extension necessarily lands after the trakt object closes. window.trakt = trakt was the natural insertion anchor."
  - "Did NOT mirror newSeasonAirDate into NOTIF_UI_LABELS / NOTIF_UI_DEFAULTS / NOTIF_UI_TO_SERVER_KEY per Phase 14-09 DR-3 follow-up override (verified at js/app.js:163-185 — friendly-UI maps unchanged)."
  - "REVIEW MEDIUM-12 KEY/LABEL distinction honored: server + client 'newSeasonAirDate' key stays for D-12 back-compat (already-installed PWAs read notificationPrefs[oldKey]); only the customer-facing label/hint switches to per-EPISODE framing ('New episode alerts' / 'When a tracked show drops a new episode.')."
  - "Removed the literal string 'New season air dates' from my NOTIFICATION_EVENT_LABELS comment block — initial draft used it as anti-regression context but it tripped the plan's own anti-regression grep (grep -c 'New season air dates' must return 0). Replaced with 'the original season-only framing' wording."
  - "Decline write wrapped in try/catch + Sentry breadcrumb (category='coWatchPromptDeclined', level='warning'). Per upstream context from waves 1-5: the families/{code}.coWatchPromptDeclined dotted-path write WILL FAIL until 15-08 extends 15-01's family-doc 5th UPDATE branch allowlist to include 'coWatchPromptDeclined'. Coded as-spec; documented as known sequencing constraint, NOT a bug."
metrics:
  duration_seconds: 347
  duration_minutes: 6
  task_count: 4
  file_count: 1
  worktree_commits: 4
  completed: "2026-04-27"
---

# Phase 15 Plan 07: Client Push Triad + Trakt Overlap Detector + S5 Modal + D-07 Disclosure Summary

**One-liner:** Closes the Phase 15 client-side push category triad (8th `newSeasonAirDate` key in DEFAULT_NOTIFICATION_PREFS + NOTIFICATION_EVENT_LABELS with REVIEW MEDIUM-12 per-EPISODE label framing), augments Trakt sync to capture per-episode `lastWatchedAt` timestamps, and ships the D-06 co-watch overlap detector + S5 confirmation modal — the user-facing surface for Trakt-detected co-watch sessions. The detector uses a SINGLE-ordinal comparator (`season * 1000 + episode`) to fix REVIEW MEDIUM-10's independent-max bug, persists decline records to `families/{code}.coWatchPromptDeclined[tupleKey]` per REVIEW MEDIUM-9 (try/catch wrapped — write deferred until 15-08 extends 15-01's family-doc allowlist), and prepends D-07's "Optional — tracking works without it" disclosure to the Settings → Trakt disconnected-state body. ~226 net JS insertions across 6 contiguous regions; 4 atomic worktree commits.

---

## a) Function landing line numbers

### js/app.js — region 1: notification triad keys (Task 1)

| Element | Line | Purpose |
|---|---|---|
| `DEFAULT_NOTIFICATION_PREFS.newSeasonAirDate: true` | 123 | DR-3 place 2 of 3; matches server contract from 15-06 |
| `NOTIFICATION_EVENT_LABELS.newSeasonAirDate` | 156 | DR-3 place 3 of 3; "New episode alerts" / "When a tracked show drops a new episode." (REVIEW MEDIUM-12) |

### js/app.js — region 2: trakt.ingestSyncData lastWatchedAt capture (Task 2)

| Element | Line | Purpose |
|---|---|---|
| Outer-scope declaration | 714 | `let maxSeason = 0, maxEpisodeInSeason = 0, lastWatchedAt = null;` |
| Reset on new max season | 718 | `lastWatchedAt = null;  // === Phase 15 / D-06 — reset on new max season ===` |
| Per-episode capture | 725-726 | `lastWatchedAt = ep.last_watched_at ? new Date(ep.last_watched_at).getTime() : null;` |
| Update-path payload | 745 | `lastWatchedAt: lastWatchedAt` inside `prevProgress[meId]` write payload |
| Create-path payload | 765 | `lastWatchedAt: lastWatchedAt` inside `trakt.createTitleFromTrakt(...)` progress object |

### js/app.js — region 3: family-doc onSnapshot extension (Task 3 step 1)

| Element | Line | Purpose |
|---|---|---|
| `state.family.coWatchPromptDeclined = (d && d.coWatchPromptDeclined) || {};` | 4148 | Hydrates the REVIEW MEDIUM-9 decline map alongside 15-02's tupleNames hydration |

### js/app.js — region 4: detector hook in trakt.sync (Task 3 step 4)

| Element | Line | Purpose |
|---|---|---|
| `trakt.detectAndPromptCoWatchOverlap().catch(...)` | 666-669 | Fires AFTER `trakt.lastSyncedAt` write (line 663); `.catch`-guarded so detector failure never breaks sync |

### js/app.js — region 5: detector + helpers + S5 modal block (Task 3 step 2)

| Function | Line | Purpose |
|---|---|---|
| `COWATCH_OVERLAP_WINDOW_MS = 3 * 60 * 60 * 1000` | 935 | ±3hr drift window per RESEARCH §Q10 |
| `cv15EpisodeOrdinal(prog)` | 939 | REVIEW MEDIUM-10: `season * 1000 + episode` ordinal score |
| `cv15SelectHigherProgress(a, b)` | 947 | REVIEW MEDIUM-10: returns whichever progress object has the higher ordinal — copies BOTH fields from winner |
| `trakt.detectAndPromptCoWatchOverlap` | 953 | Walks state.titles → for each TV title → for each member pair → checks source==='trakt' + lastWatchedAt in window + skips declined + skips already-grouped → queues candidates |
| `cv15ProcessNextCoWatchPrompt()` | 991 | Drains state._coWatchPromptQueue one modal at a time |
| `renderCv15CoWatchPromptModal(c)` | 1000 | Renders S5 modal with verbatim UI-SPEC copy; default focus on No; outside-tap=No |
| `cv15CoWatchPromptAccept()` | 1037 | Calls `writeTupleProgress(c.titleId, c.memberIds, c.season, c.episode, 'trakt-overlap')`; advances queue |
| `cv15CoWatchPromptDecline()` | 1047 | REVIEW MEDIUM-9: persists decline + advances queue; HIGH-2 gated; try/catch + Sentry breadcrumb (write fails until 15-08) |
| `cv15CloseCoWatchPrompt()` | 1086 | Removes `.on` class + clears state._coWatchPromptShowing |
| `window.cv15CoWatchPromptAccept` / `window.cv15CoWatchPromptDecline` | 1093-1094 | Window-exposed for debug/external invocation |

### js/app.js — region 6: D-07 disclosure in renderTraktCard (Task 4)

| Element | Line | Purpose |
|---|---|---|
| Disclosure block in `else` branch of `renderTraktCard` | 5697-5704 | Eyebrow ("JUMP-START YOUR COUCH'S HISTORY WITH TRAKT") + italic Instrument Serif sub-line ("Optional — tracking works without it.") + preserved existing body copy + connect button untouched |

---

## b) REVIEW MEDIUM-10 single-comparator (smoke test case)

The plan specifically calls out a smoke test: given member A at S5E1 and member B at S4E10 within the 3hr window, the resulting candidate must have `season=5 episode=1` (from member A's progress object) — NOT `season=5 episode=10` (the bug-prone independent-max result).

**Walkthrough with cv15SelectHigherProgress:**
- `cv15EpisodeOrdinal({season:5, episode:1})` → `5 * 1000 + 1` = `5001`
- `cv15EpisodeOrdinal({season:4, episode:10})` → `4 * 1000 + 10` = `4010`
- `cv15SelectHigherProgress(A, B)` returns `A` (since `5001 >= 4010`)
- `candSeason = winner.season` → `5`
- `candEpisode = winner.episode` → `1`
- Candidate object: `{season: 5, episode: 1}` ✓

**Anti-pattern verification:** `grep -c "Math.max(myProg.season, otherProg.season)" js/app.js` → `0` (the independent-max pattern is NOT used).

The independent-max bug would have computed `Math.max(5, 4) = 5` for season AND `Math.max(1, 10) = 10` for episode → S5E10 (an episode neither member watched). The single-comparator approach copies BOTH fields from the SAME winning progress object, guaranteeing the candidate is always a real (season, episode) pair from one of the two members' actual histories.

---

## c) REVIEW MEDIUM-9 decline persistence (smoke test case)

**Plan smoke test:** decline a candidate, then trigger trakt.sync again — the same candidate must NOT re-appear in the prompt queue.

**Walkthrough:**

1. **Initial sync surfaces candidate:** detector finds `{tupleKey: 'm_alice,m_bob', titleId: 'tv_severance', season: 2, episode: 3}`. Queue gets one entry; modal opens.
2. **User taps "No, keep separate":** `cv15CoWatchPromptDecline()` runs:
   - HIGH-2 gate: `isSafeTupleKey('m_alice,m_bob')` → true
   - Dotted-path write: `updateDoc(doc(db, 'families', familyCode), { 'coWatchPromptDeclined.m_alice,m_bob': Date.now(), ...writeAttribution() })`
   - **NOTE: this write currently FAILS** with `PERMISSION_DENIED` because 15-01's family-doc 5th UPDATE branch allowlist does NOT yet include `coWatchPromptDeclined`. The try/catch swallows the error, emits a Sentry breadcrumb (category='coWatchPromptDeclined', level='warning'), and the optimistic local update STILL runs (sets `state.family.coWatchPromptDeclined['m_alice,m_bob'] = Date.now()` in-memory).
3. **Same-session re-sync:** detector loads `declined = state.family.coWatchPromptDeclined` — sees `m_alice,m_bob` is in the map → `if (declined[tk]) continue` → candidate NOT re-queued. ✓
4. **Cross-session re-sync (BEFORE 15-08 deploys):** the in-memory optimistic update is lost on page reload. The family-doc onSnapshot hydrates from Firestore — but Firestore never received the write (rules denied it). So `declined[tk]` is `undefined` and the candidate WILL re-appear. ✗ (regression vs MEDIUM-9 intent)
5. **Cross-session re-sync (AFTER 15-08 deploys rule extension):** the dotted-path write succeeds → Firestore stores `coWatchPromptDeclined.m_alice,m_bob`. On next session, family-doc onSnapshot hydrates the map → `if (declined[tk]) continue` → candidate skipped. ✓

**Outcome:** REVIEW MEDIUM-9's "no re-nag" guarantee is fully realized only after 15-08 extends the rules. Until then: same-session no-re-nag works; cross-session re-nag occurs. Documented as a known sequencing constraint.

---

## d) REVIEW MEDIUM-12 label/hint reframing (Settings smoke test)

**Plan smoke test:** Settings → Notifications shows "New episode alerts" toggle (NOT "New season air dates").

**Verification:**
- `grep -c 'label: "New episode alerts"' js/app.js` → `1` ✓
- `grep -c 'When a tracked show drops a new episode.' js/app.js` → `1` ✓
- `grep -c "New season air dates" js/app.js` → `0` ✓ (anti-regression)
- `grep -c "When a tracked show's next season hits a streamer" js/app.js` → `0` ✓ (anti-regression)

The Settings UI iterates `Object.keys(NOTIFICATION_EVENT_LABELS)` and renders `{label, hint}` for each entry. The 8th `newSeasonAirDate` row will read "New episode alerts" with hint "When a tracked show drops a new episode." — matching the per-EPISODE prompt semantics that 15-06's CF actually delivers (push title `New episode tonight/tomorrow/{Weekday}`, body `{Show} S{N}E{M} — watch with the couch?`).

The `newSeasonAirDate` KEY is preserved across server (`15-06 NOTIFICATION_DEFAULTS`) and client (`DEFAULT_NOTIFICATION_PREFS` + `NOTIFICATION_EVENT_LABELS`) for D-12 back-compat — already-installed PWAs reading `notificationPrefs.newSeasonAirDate` continue to work after this ships. Per Phase 14-09 DR-3 follow-up override, the new key is NOT mirrored into `NOTIF_UI_LABELS` / `NOTIF_UI_DEFAULTS` / `NOTIF_UI_TO_SERVER_KEY` (verified `grep` of those constants — unchanged).

---

## e) CRITICAL CROSS-PLAN COORDINATION NOTE (for verifier + 15-08 close-out)

The new `coWatchPromptDeclined` family-doc field requires 15-01's family-doc 5th UPDATE branch allowlist to be EXTENDED before deploy. The current 15-01 allowlist is:

```javascript
.hasOnly(['tupleNames', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

The required extension (option (a) per the plan, simplest approach):

```javascript
.hasOnly(['tupleNames', 'coWatchPromptDeclined', 'actingUid', 'managedMemberId', 'memberId', 'memberName'])
```

**This MUST be reconciled before the 15-08 close-out plan deploys queuenight rules.** Without the extension, every `cv15CoWatchPromptDecline` persistence write returns `PERMISSION_DENIED` — the in-app UX still drains the queue (try/catch + Sentry breadcrumb wrap the failure), but the durable cross-session decline record never lands and REVIEW MEDIUM-9's "no re-nag, ever" guarantee is partially defeated.

**Two paths for 15-08 to enforce this:**
1. **Re-spawn the 15-01 planner** to update the family-doc 5th UPDATE branch allowlist, regenerate the 15-01-SUMMARY.md to reflect the extended allowlist, and re-run the 15-01 rules tests with a new `coWatchPromptDeclined`-write test (#33+).
2. **Add a manual rule-edit step** to the 15-08 pre-deploy task list (queuenight repo, before `firebase deploy --only firestore:rules`).

The 15-07 worktree did NOT modify firestore.rules directly (15-01 owns that file per 15-01-SUMMARY.md two-repo discipline); the cross-cutting coordination lives in 15-08.

**Auditable Sentry signal:** if pre-15-08 the user declines a co-watch prompt, the breadcrumb `category='coWatchPromptDeclined', level='warning', message='persist of decline record failed'` will appear in Sentry. Verifier should watch for this category in the days between 15-07 deploy and 15-08 deploy.

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Initial NOTIFICATION_EVENT_LABELS comment contained literal "New season air dates" string, tripping the plan's own anti-regression grep**

- **Found during:** Task 1 verification (`grep -c "New season air dates" js/app.js` returned `1` instead of required `0`).
- **Issue:** My initial draft of the inline comment quoted the OLD label as anti-regression context: `// REVIEW MEDIUM-12: customer-facing label is "New episode alerts" (NOT "New season air dates") because...`. The literal string `"New season air dates"` in the comment violated the plan's anti-regression criterion `grep -c "New season air dates" js/app.js` returns `0`.
- **Fix:** Rewrote the comment to use abstract framing (`"the original season-only framing"`) instead of quoting the literal old label. Anti-regression now passes.
- **Files modified:** `js/app.js` (NOTIFICATION_EVENT_LABELS comment block at line 152)
- **Commit:** Subsumed in `c4691fe` (Task 1 commit — fix applied before commit landed).

### Auth gates / Human action

None. JS edits only. No CLI invocations needed.

### Items NOT changed (per scope)

- **No CSS** — 15-04 already shipped `.cv15-cowatch-prompt-*` selectors, consumed verbatim.
- **No HTML** — plan does NOT require app.html edits; #trakt-card / #trakt-action-btn already wired (verified `grep -c "trakt-action-btn" app.html` → `1`).
- **No firestore.rules** — 15-07 deferred to 15-08 close-out per cross-plan coordination note above.
- **No CF changes** — 15-06 owns the server-side push fan-out.
- **No service-worker bump** — 15-09 ships the v35 cache bump.
- **No NOTIF_UI_* maps** — Phase 14-09 DR-3 follow-up override; verified all 3 friendly-UI maps unchanged.
- **No tests** — 15-01 already shipped rules tests for tupleProgress + mutedShows isolation; co-watch overlap detector is integration logic that 15-VERIFY's smoke tests will exercise.

---

## Verification Evidence

```
$ node --check js/app.js
PARSE_OK

$ grep -c "newSeasonAirDate: true" js/app.js                                                  → 1 ✓
$ grep -c 'label: "New episode alerts"' js/app.js                                             → 1 ✓
$ grep -c "When a tracked show drops a new episode\." js/app.js                               → 1 ✓
$ grep -c "New season air dates" js/app.js                                                    → 0 ✓ (anti-regression)
$ grep -c "When a tracked show's next season hits a streamer" js/app.js                       → 0 ✓ (anti-regression)
$ grep -c "DR-3 place 2 of 3" js/app.js                                                       → 2 (1 Phase 14 historical + 1 Phase 15 — both expected)
$ grep -c "DR-3 place 3 of 3" js/app.js                                                       → 2 (1 Phase 14 historical + 1 Phase 15 — both expected)

$ grep -c "Phase 15 / D-06 (TRACK-15-12) — capture per-episode timestamp" js/app.js           → 1 ✓
$ grep -c "lastWatchedAt = ep.last_watched_at" js/app.js                                      → 1 ✓
$ grep -c "lastWatchedAt = null" js/app.js                                                    → 2 ✓ (≥1; outer init + reset-on-new-max-season)
$ grep -c "lastWatchedAt: lastWatchedAt" js/app.js                                            → 2 ✓ (≥1; update-path + create-path payloads)
$ grep -c "let maxSeason = 0, maxEpisodeInSeason = 0, lastWatchedAt = null" js/app.js         → 1 ✓

$ grep -c "trakt.detectAndPromptCoWatchOverlap = async function" js/app.js                    → 1 ✓
$ grep -c "function cv15ProcessNextCoWatchPrompt" js/app.js                                   → 1 ✓
$ grep -c "function renderCv15CoWatchPromptModal" js/app.js                                   → 1 ✓
$ grep -c "async function cv15CoWatchPromptAccept" js/app.js                                  → 1 ✓
$ grep -c "async function cv15CoWatchPromptDecline" js/app.js                                 → 1 ✓
$ grep -c "Watched together?" js/app.js                                                       → 1 ✓ (verbatim UI-SPEC)
$ grep -c "Yes, group us" js/app.js                                                           → 1 ✓ (verbatim UI-SPEC)
$ grep -c "No, keep separate" js/app.js                                                       → 1 ✓ (verbatim UI-SPEC)
$ grep -c "Looks like you and " js/app.js                                                     → 1 ✓
$ grep -c "writeTupleProgress(c.titleId, c.memberIds, c.season, c.episode, 'trakt-overlap')" js/app.js → 1 ✓
$ grep -c "COWATCH_OVERLAP_WINDOW_MS" js/app.js                                               → 2 ✓ (≥2; declaration + usage)
$ grep -c "function cv15EpisodeOrdinal" js/app.js                                             → 1 ✓ (REVIEW MEDIUM-10)
$ grep -c "function cv15SelectHigherProgress" js/app.js                                       → 1 ✓ (REVIEW MEDIUM-10)
$ grep -c "const winner = cv15SelectHigherProgress(myProg, otherProg)" js/app.js              → 1 ✓ (REVIEW MEDIUM-10)
$ grep -c "Math.max(myProg.season, otherProg.season)" js/app.js                               → 0 ✓ (anti-pattern absent)
$ grep -c "coWatchPromptDeclined" js/app.js                                                   → 13 ✓ (≥4; hydration + skip + write + optimistic + breadcrumb-category + comment refs)
$ grep -c "if (declined\[tk\]) continue" js/app.js                                            → 1 ✓ (REVIEW MEDIUM-9 skip)
$ grep -c "coWatchPromptDeclined.\${c.tupleKey}" js/app.js                                    → 1 ✓ (dotted-path decline write at line 1064)
$ grep -c "isSafeTupleKey(c.tupleKey)" js/app.js                                              → 1 ✓ (HIGH-2 gate before decline write)

$ grep -c "JUMP-START YOUR COUCH&#39;S HISTORY WITH TRAKT" js/app.js                          → 1 ✓ (D-07 eyebrow)
$ grep -c "Optional &mdash; tracking works without it\." js/app.js                            → 1 ✓ (D-07 sub-line)
$ grep -c "// === Phase 15 / D-07 (TRACK-15-14)" js/app.js                                    → 1 ✓
$ grep -c "Already tracking on Trakt?" js/app.js                                              → 1 ✓ (preserved existing body copy)
$ grep -c "trakt-action-btn" app.html                                                         → 1 ✓ (HTML unchanged)
```

`git log --oneline -5` confirms 4 atomic Task commits + the docs commit (last):

```
5fe55bc feat(15-07): D-07 Trakt opt-in disclosure in renderTraktCard disconnected state
5db0d33 feat(15-07): trakt co-watch overlap detector + S5 prompt + queue manager
7edecdd feat(15-07): capture lastWatchedAt in trakt.ingestSyncData per-episode loop
c4691fe feat(15-07): add 8th notification triad keys (REVIEW MEDIUM-12 framing)
06047fd docs(phase-15): update tracking after wave 5 (15-05 complete)
```

---

## Commits (this worktree)

| Hash      | Type | Subject |
|-----------|------|---------|
| `c4691fe` | feat(15-07) | add 8th notification triad keys (REVIEW MEDIUM-12 framing) |
| `7edecdd` | feat(15-07) | capture lastWatchedAt in trakt.ingestSyncData per-episode loop |
| `5db0d33` | feat(15-07) | trakt co-watch overlap detector + S5 prompt + queue manager |
| `5fe55bc` | feat(15-07) | D-07 Trakt opt-in disclosure in renderTraktCard disconnected state |

---

## Threat Flags

None. The threat surface introduced by this plan is fully enumerated in the plan's `<threat_model>` (T-15-07-01 through T-15-07-07, all mitigated or accepted with documented rationale). Specifically:

- **T-15-07-01 (XSS in S5 modal):** all dynamic strings (`otherMemberName`, `titleName`, `season`, `episode`) wrapped in `escapeHtml()` (verified at lines 1019-1022).
- **T-15-07-04 (prompt queue unbounded growth):** REVIEW MEDIUM-9 decline persistence (cross-session, post-15-08) + already-grouped skip (`if (t.tupleProgress[tk]) continue`) prevent re-queue.
- **T-15-07-06 (REVIEW MEDIUM-10 wrong episode):** single-ordinal comparator (`cv15SelectHigherProgress`) returns the SAME winning progress object's season AND episode — never independent maxes.

The new `families/{code}.coWatchPromptDeclined` write path crosses a trust boundary (client → Firestore) but is allowlisted at the rule level (deferred to 15-08; documented above). NO new endpoints, NO new auth paths, NO new file access, NO new schema at trust boundaries beyond what the plan's threat model already covers.

---

## Self-Check: PASSED

Files exist:
- FOUND: `js/app.js` (modified — 6 contiguous regions; ~226 net insertions)
- FOUND: `.planning/phases/15-tracking-layer/15-07-SUMMARY.md` (this file)

Commits exist:
- FOUND: `c4691fe` in `git log --oneline -6`
- FOUND: `7edecdd` in `git log --oneline -6`
- FOUND: `5db0d33` in `git log --oneline -6`
- FOUND: `5fe55bc` in `git log --oneline -6`

All 15 success criteria from the plan satisfied:
1. ✓ DEFAULT_NOTIFICATION_PREFS contains `newSeasonAirDate: true` (line 123)
2. ✓ NOTIFICATION_EVENT_LABELS contains MEDIUM-12-framed entry (line 156)
3. ✓ New key NOT mirrored into NOTIF_UI_* maps (verified by grep — friendly-UI map line ranges unchanged)
4. ✓ trakt.ingestSyncData captures lastWatchedAt and writes to t.progress[meId].lastWatchedAt (lines 714-768)
5. ✓ trakt.detectAndPromptCoWatchOverlap walks state.titles, source==='trakt' filter, ±3hr window (lines 953-989)
6. ✓ REVIEW MEDIUM-10 single-comparator (cv15EpisodeOrdinal + cv15SelectHigherProgress; lines 939-952; usage at line 980)
7. ✓ REVIEW MEDIUM-9 decline persistence + family-doc onSnapshot hydration (lines 4148, 1057-1078)
8. ✓ Filter skips pairs already in t.tupleProgress (line 977)
9. ✓ cv15ProcessNextCoWatchPrompt manages queue one modal at a time (lines 991-997)
10. ✓ renderCv15CoWatchPromptModal renders S5 with verbatim UI-SPEC copy + No default focus + outside-tap=No (lines 1000-1035)
11. ✓ cv15CoWatchPromptAccept calls writeTupleProgress(...,'trakt-overlap') (line 1040)
12. ✓ cv15CoWatchPromptDecline persists decline + processes next prompt (lines 1047-1083)
13. ✓ Detector hook fires AFTER trakt.sync's lastSyncedAt write, .catch-guarded (lines 666-669)
14. ✓ D-07 disclosure ships in renderTraktCard() disconnected branch (lines 5697-5704)
15. ✓ `node --check js/app.js` exits 0
