---
phase: 12-pre-launch-polish
plan: 03
status: complete
wave: 1
files_modified:
  - js/constants.js
  - .planning/phases/12-pre-launch-polish/audit-report.txt
files_created:
  - .planning/phases/12-pre-launch-polish/audit-report.txt
requirements_addressed: [POL-03, POL-04]
---

# Plan 12-03 Summary — COUCH_NIGHTS_PACKS curation pass

**Wave 1 of 3** — data-layer audit + corrections. Plans 12-01 (Wave 2) and 12-02 (Wave 3) sequence after this one because they share `js/constants.js` and other files.

## What shipped

### Task 1 — TMDB audit script + report
Wrote a one-time CommonJS audit script `audit-tmdb-packs.cjs` that read `js/constants.js`, fetched every TMDB id in every pack via `/movie/{id}` (200ms inter-request delay; 91 ids × 200ms ≈ 18s, well under TMDB 40req/10s budget), and wrote a plain-text PASS/MISMATCH report to `audit-report.txt`. The script self-deleted via `try/finally` so no script artifact remains in the repo (verified via `test ! -f .../audit-tmdb-packs.cjs`).

EXPECTED_COUNT (91) computed from integer literals inside `tmdbIds: [...]` blocks of the COUCH_NIGHTS_PACKS region; PASS+MISMATCH+NOT_FOUND = 91 (hard-equality gate satisfied).

**Caveat documented inline in audit-report.txt:** the script's "expected" column drew labels from the last 2 comment lines before each `tmdbIds:` block, then split on commas. This caused label-to-id misalignment when comments contain digits ("Paddington 2", "12 Years a Slave", "(500) Days of Summer") and for the first id in every pack (where the heroImageUrl comment leaks into the parsed labels). The "actual:" column (TMDB-resolved title) is the source of truth — manual cross-reference against in-source pack comments yielded the real mismatch list.

### Task 2 — id corrections + drift-prevention header
Cross-referencing the report's `actual:` column against in-source pack comment lines yielded **14 real mismatches across 5 of 8 packs**. Replacement IDs verified via TMDB `/search/movie?query={title}&year={year}` returning a title-exact + year-exact match (one-shot `verify-replacements.cjs` and `search-replacements.cjs` scripts, both self-deleting).

| Pack | Index | Bad ID | Bad Title | Correct ID | Correct Title |
|------|-------|--------|-----------|-----------|---------------|
| studio-ghibli-sunday | 7 | 11544 | Lilo & Stitch | **11621** | Porco Rosso (1992) |
| cozy-rainy-night | 2 | 194662 | Birdman | **212778** | Chef (2014) |
| cozy-rainy-night | 3 | 31011 | Mr. Nobody | **24803** | Julie & Julia (2009) |
| cozy-rainy-night | 5 | 11005 | Awakenings | **9489** | You've Got Mail (1998) |
| cozy-rainy-night | 6 | 228326 | The Book of Life | **116149** | Paddington (2014) |
| cozy-rainy-night | 9 | 6963 | The Weather Man | **1581** | The Holiday (2006) |
| halloween-crawl | 0 | 9532 | Final Destination | **10439** | Hocus Pocus (1993) [POL-03 SEED] |
| halloween-crawl | 3 | 14164 | Dragonball Evolution | **14836** | Coraline (2009) |
| halloween-crawl | 4 | 82702 | How to Train Your Dragon 2 | **77174** | ParaNorman (2012) |
| halloween-crawl | 8 | 536554 | M3GAN | **567609** | Ready or Not (2019) |
| date-night-classics | 2 | 152601 | Her | **132344** | Before Midnight (2013) |
| date-night-classics | 5 | 398818 | Call Me by Your Name | **416477** | The Big Sick (2017) |
| date-night-classics | 8 | 82690 | Wreck-It Ralph | **82693** | Silver Linings Playbook (2012) |
| a24-night | 1 | 550988 | Free Guy | **559907** | The Green Knight (2021) |

**Packs with zero mismatches (no edits applied):** kids-room-classics, oscars-short-list, dads-action-pantheon. The ID 194662 (Birdman) is wrong in cozy-rainy-night but **correct** in oscars-short-list — array-context-aware Edits ensured the latter wasn't disturbed.

### Halloween-crawl hero comment cleanup
The pre-existing comment block above the halloween-crawl heroImageUrl said "id 9532 actually resolves to Final Destination ... need a curation pass." Replaced with a forward-looking comment pointing to the drift-prevention header + audit log, since the curation pass has now been done.

### Drift-prevention header
Added a 4-line comment block immediately above `export const COUCH_NIGHTS_PACKS = [`:
```javascript
// ⚠ Curation contract: each tmdbId in tmdbIds MUST resolve to the title in
// the immediately-preceding comment line. Drift causes silent ballot bugs
// (Phase 12 / POL-03). If you change a pack id, update the comment label.
// Audit lives at .planning/phases/12-pre-launch-polish/audit-report.txt.
```
The key phrase "If you change a pack id, update the comment label" is on a single line so the plan's verify gate (`grep -c "If you change a pack id, update the comment label"`) passes.

## Deviation from plan (documented)

Plan 12-03 hinted that Hocus Pocus = TMDB id 10661, with `pattern: "10661"` in the key_links section. **TMDB `/movie/10661` resolves to "You Don't Mess with the Zohan" (2008), not Hocus Pocus.** Canonical Hocus Pocus is **10439** (verified via TMDB `/search/movie?query=Hocus+Pocus&year=1993` → results[0].id = 10439, title = "Hocus Pocus", release_date = "1993-07-30").

The plan itself anticipated this: *"Confirm during audit; do not assume — Step 1 verification will confirm 10661."* I confirmed and the canonical value is 10439. The verify gate `grep -c "10661" js/constants.js  # ≥1` from the plan would not pass — but the substantive acceptance criterion ("halloween-crawl tmdbIds first id is the canonical Hocus Pocus id") is satisfied with 10439. Deviation logged in audit-report.txt POST-AUDIT REPLACEMENTS APPLIED section.

## Files NOT touched (per plan boundaries)

- `sw.js` — Plan 12-01 owns the v32 CACHE bump
- `app.html`, `js/app.js`, `css/app.css` — data-layer only plan
- All 8 `heroImageUrl` values — D-16 forbids touching them (8 w780 URLs preserved verbatim)
- `kids-room-classics`, `oscars-short-list`, `dads-action-pantheon` packs — zero mismatches found

## Verification gates (all pass)

| Gate | Result |
|------|--------|
| `test -f audit-report.txt` | ✓ |
| `grep -c "halloween-crawl" audit-report.txt` | 4 (≥1) |
| `grep -c "studio-ghibli-sunday" audit-report.txt` | 2 (≥1) |
| `grep -c "dads-action-pantheon" audit-report.txt` | 2 (≥1) |
| `grep -c "SUMMARY" audit-report.txt` | 1 |
| `grep -c "EXPECTED_COUNT:" audit-report.txt` | 1 |
| `grep -cE "PASS|MISMATCH|NOT_FOUND" audit-report.txt` | 94 (≥10) |
| `test ! -f audit-tmdb-packs.cjs` | ✓ (self-deleted) |
| Hard exact-count gate (PASS+MISMATCH+NOT_FOUND == EXPECTED_COUNT) | 91=91 ✓ |
| `9532` absent from COUCH_NIGHTS_PACKS region | ✓ |
| `grep -c "10439" js/constants.js` | 1 (≥1) — canonical Hocus Pocus id present |
| `grep -c "If you change a pack id, update the comment label"` | 1 |
| `grep -c "POST-AUDIT REPLACEMENTS APPLIED" audit-report.txt` | 1 |
| `grep -c "https://image.tmdb.org/t/p/w780" js/constants.js` | 8 (heroes preserved) |
| `node --check js/constants.js` | exit 0 ✓ |

## LOC delta

- `js/constants.js`: +6 lines (drift header) and 14 single-id swaps + comment refresh = ~+10 net lines
- `.planning/phases/12-pre-launch-polish/audit-report.txt`: NEW, ~175 lines (audit table + parser-noise note + POST-AUDIT REPLACEMENTS APPLIED section)

## Long-term durability note (D-18 deferred)

Inline comment labels are brittle: they go stale when ids change, and the comment-vs-id drift is silent at runtime (no test catches it). A future Phase 13 plan could replace the inline comment-list pattern with a build-time JSON manifest test that fetches each id and asserts title match — captured as a deferred suggestion, not a Phase 12 deliverable.

## Deploy note

This change is invisible until a user opens an affected pack — the curated ids only surface when the pack preview loads or when "Start this pack" seeds the ballot. Deploy by mirroring `js/constants.js` to `queuenight/public/js/constants.js` then `firebase deploy --only hosting` from `C:/Users/nahde/queuenight/`. The ballot bug fix lands silently for all users on the next install / cache refresh (Plan 12-01 owns the sw.js v32 bump that forces installed PWAs to refresh).

## Self-Check: PASSED
