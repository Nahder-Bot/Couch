---
status: partial
phase: 19-kid-mode
source: [19-03-PLAN.md, 19-03-SUMMARY.md]
started: 2026-04-29T23:39:00Z
updated: 2026-04-29T23:39:00Z
---

## Current Test

[awaiting human testing — code shipped + deployed; UAT requires real device + a kid avatar in the family]

## Tests

### 1. SW + cache version (~30s)
expected:
- Hard-reload couchtonight.app/app or force-quit + reopen PWA
- Confirm active SW = `couch-v36.1-kid-mode`
result: [pending]

### 2. Toggle visibility (BLOCKING)
expected:
- Tonight tab → below action row, "Kid mode" pill renders
- Helper hint: "Hide R + PG-13 from tonight's pool"
- Visible only because family has ≥1 member with effectiveMaxTier ≤ 3 (the kid threshold)
result: [pending]

### 3. Toggle interaction + visual state (BLOCKING)
expected:
- Tap pill → flips to amber-filled active state + label "Kid mode on" + roster gets subtle amber tint + flashToast "Kid mode on — hiding R + PG-13"
- Tap again → reverts to dashed-border idle + flashToast "Kid mode off — full pool back"
result: [pending]

### 4. Tier-cap filter on Tonight (BLOCKING)
expected:
- Pre-condition: family library has ≥1 R-rated + ≥1 PG-13 title with a couch yes-vote
- Activate kid-mode → matches + considerable lists exclude R + PG-13 (G/PG yes-voted still visible)
- Vetoed + already-watched stay hidden (no bypass)
- Deactivate → R + PG-13 re-appear
result: [pending]

### 5. Library filter respects kid-mode
expected:
- Activate kid-mode → Library 'For me' filter → PG-13/R excluded
- Library 'Unwatched' filter → same behavior
result: [pending]

### 6. Session-scope reset
expected:
- Activate kid-mode → tap Library tab (away from Tonight) → silent reset
- Return to Tonight → kid-mode is OFF; couch state preserved
- Re-activate kid-mode → tap "Clear couch" → kid-mode OFF + couch empty
result: [pending]

### 7. Parent override on detail modal (BLOCKING)
expected:
- As PARENT, activate kid-mode → open PG-13 title detail
- "Show this anyway for tonight" link visible below "+ Add to list"
- Tap link → modal closes + flashToast "Showing this for tonight" + title appears in Tonight matches
- Re-open same title detail → link replaced with italic "Showing this for tonight (kid-mode override)" (NOT clickable)
- As NON-PARENT: same title detail → NO override link visible
- Toggle kid-mode off + on → re-open title → override cleared, link visible again
result: [pending]

### 8. Cross-device session isolation
expected:
- Device A: activate kid-mode
- Device B (same family, different device or different signed-in user): kid-mode NOT active there
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
