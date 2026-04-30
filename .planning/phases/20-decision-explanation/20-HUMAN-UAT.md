---
phase: 20-decision-explanation
plan: "03"
type: human-uat
status: pending
created: "2026-04-30"
live_cache: couch-v36.2-decision-explanation
live_url: https://couchtonight.app
---

# Phase 20 — Device UAT: Decision Explanation

Live cache verified: `couch-v36.2-decision-explanation` at `https://couchtonight.app/sw.js` (curl-confirmed post-deploy).
HTTP 200 confirmed at `https://couchtonight.app/`.
BUILD_DATE stamped 2026-04-30 in production constants.js.

## Pre-flight (~30 sec)

1. Open https://couchtonight.app/ on iPhone Safari.
2. If the PWA was installed for `couch-v36.1-kid-mode`, force a cache refresh: quit Safari fully → reopen. The service worker auto-revalidates on next online activation.
3. Sign in with your test family (at least 2 couch members + at least one title yes-voted by both).

---

## UAT-1 — Surface 1: Spin-pick result modal italic serif sub-line (D-07)

**Steps:**
1. From the Tonight tab, tap "Spin" to trigger the spin-pick flow.
2. When the result modal lands, look between the title's meta line (year · kind · runtime) and the providers strip.
3. Verify a NEW italic-serif sub-line appears there.

**Expected text:** Something like `"Nahder + Zoey said yes · Available on Hulu · 1 hr 38 min"` — your actual member names, provider, runtime.

**Visual checks:**
- Font is italic Instrument Serif (cursive serif look, NOT Inter sans-serif)
- Color is dim (NOT warm-amber — that amber color belongs to the "✨ A couch favorite" line)
- The `✨ A couch favorite` `.spin-reason` line is STILL present below the new sub-line (both coexist)

**Pass:** New italic serif sub-line visible with correct text. Existing spin-reason line intact.
**Fail:** Sub-line absent / wrong font / amber color / spin-reason line missing.

---

## UAT-2 — Surface 2: Tonight match-card dim footer (D-08)

**Steps:**
1. Close the spin modal. Scroll the Tonight matches list.
2. Inspect EVERY match card — look for a single-line dim-text footer immediately above the action-button row (the row with the primary action + ▶ Trailer + ⋯ buttons).

**Expected text:** e.g. `"Nahder said yes · Available on Netflix · 95 min"` or similar.

**Visual checks:**
- Color is dim (`--ink-dim` — roughly same dim level as meta text)
- Font is plain sans-serif (NOT italic, NOT Instrument Serif — italic serif is for D-07 and D-09 only)

**Pass:** Every match card shows the dim footer with correct text/style.
**Fail:** Footer absent on any match card / wrong font (italic) / wrong color.

---

## UAT-3 — Surface 3: Considerable variant voter phrase (D-10)

**Steps:**
1. Scroll past matches to the "Worth considering" section (titles where at least one couch member voted yes but couch is not unanimous).
2. For each considerable card with exactly 1 yes-voter on the couch, verify the footer reads `"Some of you said yes"` (NOT the member's name).
3. For cards with 2+ yes-voters, verify it reads `"{N1} + {N2} said yes"` or `"All of you said yes"` (matches the matches-card behavior).

**Note:** If no considerable titles exist in your test family, skip this step — the smoke assertion A15 already regression-locks this behavior and the deploy is gated on smoke pass.

**Pass:** 1-voter considerable cards show "Some of you said yes"; multi-voter behavior matches matches cards.
**Fail:** 1-voter considerable card shows member name instead of "Some of you said yes".

---

## UAT-4 — Surface 4: Detail modal "Why this is in your matches" section gate (D-09)

**Steps:**
1. Tap any match card to open the detail modal.
2. Scroll inside the detail body. Look for a NEW section titled `"Why this is in your matches"` — an italic Instrument Serif h4 heading, followed by a dim plain-text phrase below it. Section sits between the kid-mode override row (if visible) and the TV progress section.

**Expected heading text:** Exactly `"Why this is in your matches"` — no exclamation, no marketing language.

**Visual checks:**
- h4 is italic Instrument Serif (NOT all-caps Inter — CSS override applied)
- Body text is plain dim, NOT italic

3. Close the detail modal. Now open the SAME title from the Library tab (or any non-matches surface). Open its detail modal.
4. Scroll through the detail body. Verify the `"Why this is in your matches"` section is ABSENT (omitted because title is not in the current matches list — D-09 gate).

**Pass:** Section visible when opened from matches. Section absent when opened from Library/non-matches.
**Fail:** Section missing from matches detail / section appears in Library detail (gate broken).

---

## UAT-5 — Voice / brand check (D-11 + D-12)

**Steps:**
On any of the rendered explanation strings from UAT-1 through UAT-4, verify:

- No exclamation marks in any explanation string
- No marketing language ("amazing", "perfect", "awesome", "great pick", etc.)
- No banned words: "buffer", "delay", "queue" (in queue-UX context)
- If any family member has a name containing `<`, `>`, `&`, or `'`, verify the name renders correctly (escaped, not as raw HTML) — informational only if no such member exists

**Pass:** All rendered explanation strings are clean, direct, warm, restraint voice.
**Fail:** Any exclamation / marketing phrase / banned word found in the rendered UI.

---

## UAT-6 — Cross-device check (optional, ~2 min)

**Steps (if Android Chrome handy):**
1. Repeat UAT-1 through UAT-4 on Android Chrome.
2. Verify rendering is consistent: same text, same color tokens, italic serif still renders (via Fraunces fallback if Instrument Serif unavailable on the platform).

**Pass:** Consistent rendering across devices.
**Skip:** Acceptable — iOS primary surface is sufficient for Phase 20 UAT.

---

## Resume Signal

Type `"uat passed"` to confirm all 4 required surfaces (UAT-1 through UAT-5) render correctly and voice check is clean. This triggers `/gsd-verify-work 20` to formally close the phase against the 13 ROADMAP success criteria.

Or list failures by UAT number and surface description, e.g.:
- `"UAT-2 footer not visible on iOS"` 
- `"UAT-4 h4 rendering all-caps Inter — CSS override didn't take"`

UAT-3 and UAT-6 are skippable if data/device conditions are not met.

---

## Deploy Evidence (pre-UAT)

| Check | Command | Result |
|-------|---------|--------|
| sw.js CACHE on prod | `curl -s https://couchtonight.app/sw.js \| grep "const CACHE"` | `const CACHE = 'couch-v36.2-decision-explanation';` |
| HTTP 200 | `curl -sI https://couchtonight.app/ \| head -1` | `HTTP/1.1 200 OK` |
| Old cache absent | `curl -s https://couchtonight.app/sw.js \| grep -c "couch-v36.1-kid-mode"` | 0 |
| BUILD_DATE | `curl -s https://couchtonight.app/js/constants.js \| grep BUILD_DATE` | `BUILD_DATE = '2026-04-30'` |
| 5-smoke gate | Deploy log | `Smoke contracts pass (positionToSeconds + matches/considerable + availability + kid-mode + decision-explanation).` |
| Firebase deploy | Deploy log | `+ hosting[queuenight-84044]: release complete` |
