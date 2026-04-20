# Phase 4: Veto System - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 04-veto-system
**Areas discussed:** Re-spin flow, Fairness rule, Persistence + daily cap, Real-time surfacing + entry points

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Re-spin flow (VETO-02) | Trigger, animation, pool rules, empty pool | ✓ |
| Fairness rule (VETO-06) | Spinner definition, enforcement, edge cases | ✓ |
| Persistence + daily cap (VETO-05) | Storage shape, cap, write timing, mutability | ✓ |
| Real-time surfacing + entry points (VETO-03) | Loudness, button placement, reason UX, pending state | ✓ |

---

## Re-spin Flow (VETO-02)

### Q1: Trigger

| Option | Selected |
|--------|----------|
| Auto re-spin immediately | ✓ |
| Show 'Spin again' button | |
| 5s undo window, then auto-spin | |

### Q2: Animation

| Option | Selected |
|--------|----------|
| Full flicker + confetti again | ✓ |
| Quick fade transition, no flicker | |
| Shortened flicker (3 frames) | |

### Q3: Vetoed title reusability

| Option | Selected |
|--------|----------|
| No — vetoed titles stay out | ✓ |
| Yes, but heavily penalized | |
| Only if pool is empty | |

### Q4: Empty pool handling

| Option | Selected |
|--------|----------|
| Show empty state + 'clear vetoes' | |
| Auto-expand filters (drop mood first) | ✓ |
| Block veto if it would empty the pool | |

---

## Fairness Rule (VETO-06)

### Q1: Spinner definition

| Option | Selected |
|--------|----------|
| Whoever last tapped Spin | ✓ |
| Current Picker (rotation) | |
| Both — spinner OR picker if active | |

### Q2: Enforcement

| Option | Selected |
|--------|----------|
| Spin button disabled on vetoer's device | ✓ |
| Auto re-spin server-side, no button | |
| Anyone can tap, veto-submit triggers spin first | |

**Follow-up note captured:** Since Q1 of Re-spin chose auto re-spin, button-disable applies only to *subsequent manual* spins, not the auto re-spin fired by veto submit. Captured as D-06 exception.

### Q3: Solo case

| Option | Selected |
|--------|----------|
| Fairness rule waived | ✓ |
| Block veto with message | |
| Fairness applies to sequential vetoes only | |

### Q4: Session scope

| Option | Selected |
|--------|----------|
| Only blocks immediately-next spin | ✓ |
| Vetoer blocked rest of session | |
| Rotate — each veto shifts spin rights | |

---

## Persistence + Daily Cap (VETO-05)

### Q1: Storage location

| Option | Selected |
|--------|----------|
| New subcollection family/{id}/vetoHistory | ✓ |
| Array on each member doc | |
| Keep session doc, archive at midnight | |

### Q2: Daily cap

| Option | Selected |
|--------|----------|
| Remove the cap | |
| Keep cap (1) but allow undo + re-veto | |
| Cap at 2 per member per day | ✓ |

### Q3: Write timing

| Option | Selected |
|--------|----------|
| Write to both on submit | ✓ |
| Write session only, archive at rollover | |
| Write history only, derive session view | |

### Q4: Mutability

| Option | Selected |
|--------|----------|
| Undo within same session only | ✓ |
| Fully immutable once written | |
| Editable comment, immutable event | |

---

## Real-Time Surfacing + Entry Points

### Q1: Surfacing loudness

| Option | Selected |
|--------|----------|
| Toast + activity feed entry | ✓ |
| Full-screen interstitial | |
| Silent card-only + activity feed | |

### Q2: Entry points (multi-select)

| Option | Selected |
|--------|----------|
| Spin result modal (prominent) | ✓ |
| Title detail modal (existing) | ✓ |
| Quick action on candidate cards | |

### Q3: Reason capture

| Option | Selected |
|--------|----------|
| Keep current optional text input | ✓ |
| Quick-chips + optional text | |
| No comment — just pass | |

### Q4: Pending state

| Option | Selected |
|--------|----------|
| Brief 'spinning again…' shimmer | ✓ |
| Close modal, reopen with flicker | |
| Keep old card with pass stamp, reveal new beneath | |

---

## Claude's Discretion

- Toast copy/timing/dismissal (follow flashToast patterns)
- Storage location of `spinnerId` on session doc
- Exact filter-relaxation order beyond "mood first"
- Disabled-state styling of Spin button
- `sessionDate` vs `at`-only in vetoHistory docs
- Daily-cap message wording

## Deferred Ideas

- Candidate-card quick veto
- Full-screen interstitial
- Preset quick-chip reasons
- Round-robin spin rights
- Picker rotation integrated with fairness
