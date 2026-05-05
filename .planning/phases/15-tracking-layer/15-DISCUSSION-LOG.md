# Phase 15: Tracking Layer - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-26
**Phase:** 15-tracking-layer
**Areas discussed:** Group-progress data shape, Episode source of truth, Season-notif subscription, Live-release prompt gating

---

## Group-progress data shape

### Q1: When a couch finishes an episode, how is the progress captured?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from watchparty (Recommended) | Watchparty session ending = automatic progress entry | ✓ (modified) |
| Explicit 'Mark watched' tap | After session ends, prompt one couch member to confirm | |
| Watchparty seeds, user edits | Watchparty pre-fills the tuple, user adjusts before commit | |

**User's choice:** Option 1 modified — auto-track AND allow explicit toggle override. User note: "I like answer 1 but let's also give people the ability to toggle watched"
**Notes:** Captured as D-01 (auto-track + explicit toggle). Reuses Phase 7 watchparty roster + Phase 8 intent payload.

### Q2: How is 'the group' identified across sessions?

| Option | Description | Selected |
|--------|-------------|----------|
| Member-tuple key (Recommended) | Sorted Set<memberId>, no setup | ✓ (modified) |
| Explicit named groups | User creates 'Wife and me' once in Settings | |
| Member-tuple + opt-in naming | Default tuple, prompt to name after 3+ sessions | |

**User's choice:** Option 1 with addition — tuple-as-key plus optional fun naming. User note: "Let's go with 1 but give them the option to edit names of the group for fun"
**Notes:** Captured as D-02. Tuple is canonical data key; name is decoration.

### Q3: For TV shows, what granularity gets tracked?

| Option | Description | Selected |
|--------|-------------|----------|
| Last-watched episode (Recommended) | One {seasonIndex, episodeIndex} per group+show | ✓ |
| All watched episodes (set) | Set of episode IDs, supports skipping around | |
| Season-level only | Track which seasons finished, not per-episode | |

**User's choice:** Last-watched episode (recommended)
**Notes:** Captured as D-03. Required for live-release auto-prompt (D-13/D-14 need episode-level).

### Q4: Where does group progress surface in the UI?

| Option | Description | Selected |
|--------|-------------|----------|
| Detail-modal section (Recommended) | 'Your couch's progress' section inside show's detail modal | |
| New 'Progress' tab | Top-level tab next to Tonight/Add/Library/Settings | |
| Both — modal + Tonight widget | Detail-modal section + 'Pick up where you left off' widget on Tonight | ✓ |

**User's choice:** Both — modal + Tonight widget
**Notes:** Captured as D-04. Two surfaces; covers per-show + cross-show flows.

---

## Episode source of truth

### Q1: Where does episode/season state primarily come from?

| Option | Description | Selected |
|--------|-------------|----------|
| Both — Trakt seeds, manual wins (Recommended) | Trakt as initial seed, manual marks always win after | ✓ |
| Trakt sync only | Tracking requires Trakt OAuth | |
| Manual only | Ignore Trakt for tracking entirely | |

**User's choice:** Both — Trakt seeds, manual wins (recommended)
**Notes:** Captured as D-05.

### Q2: Trakt history is per-INDIVIDUAL. How does it map to GROUPS?

| Option | Description | Selected |
|--------|-------------|----------|
| Solo tuple only (Recommended) | Trakt populates [memberId] solo tuple ONLY | |
| Inferred from co-watch overlap | If 2 members both Trakt-watched within 3hr window, infer group | ✓ (modified) |
| Trakt only seeds future watchparties | Used purely for 'caught up?' suggestions | |

**User's choice:** Option 2 with confirmation gate. User note: "Let's do 2 but maybe we have it ask if they are at the same episode and they always have the option to change later"
**Notes:** Captured as D-06. Modified — surfaces a confirmation prompt ("Looks like you watched this together — group your progress?") rather than silent inference. Always editable after.

### Q3: For users without Trakt connected, what's the standalone experience?

| Option | Description | Selected |
|--------|-------------|----------|
| Manual is first-class (Recommended) | Tracking works without Trakt; Trakt is opt-in accelerator | ✓ |
| Soft nag in Settings | Works without Trakt but show 'Connect Trakt' card | |
| Trakt-required, with friendly gate | Force choice on first tracking-feature use | |

**User's choice:** Manual is first-class (recommended)
**Notes:** Captured as D-07.

### Q4: When Trakt and manual disagree — who wins?

| Option | Description | Selected |
|--------|-------------|----------|
| Independent tuples — no conflict (Recommended) | Solo and group tuples are separate threads | ✓ |
| Manual group entry is authoritative | Manual entry locks; Trakt can't overwrite | |
| Latest write wins | Whichever source has newest timestamp | |

**User's choice:** Independent tuples (recommended)
**Notes:** Captured as D-08. No reconciliation needed because tuples never overlap.

---

## Season-notif subscription

### Q1: What's the DEFAULT subscription model for new-season pushes?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-subscribe on watch (Recommended) | Anyone watched ≥1 ep is auto-subscribed | ✓ |
| Per-title bell icon | Detail-modal bell, must opt in per show | |
| Per-member Settings master toggle | Single Settings switch | |

**User's choice:** Auto-subscribe on watch (recommended)
**Notes:** Captured as D-09.

### Q2: Who counts as 'watching the show' (the subscription trigger)?

| Option | Description | Selected |
|--------|-------------|----------|
| Anyone in any watched-tuple (Recommended) | Union of solo + group tuples | ✓ |
| Only solo tuple | Subscription tied to [memberId] solo only | |
| Most recent group tuple | Subscription routes to most recent group | |

**User's choice:** Anyone in any watched-tuple (recommended)
**Notes:** Captured as D-10. Captures "watched S1 alone, S2 with wife" → still subscribed.

### Q3: When a new season is detected, what does the push say + do?

| Option | Description | Selected |
|--------|-------------|----------|
| Soft prompt + Flow B link (Recommended) | "Severance S2 hits Apple TV+ Friday. Watch with the couch?" → opens Flow B nominate | ✓ |
| Plain awareness push | Plain notification, no CTA | |
| Watch-history pivot | Personalized: "You watched S1 with Ashley last June..." | |

**User's choice:** Soft prompt + Flow B link (recommended)
**Notes:** Captured as D-11. Reuses Phase 14-08 nominate; new push category 'newSeasonAirDate'.

### Q4: Where does the user manage their subscriptions?

| Option | Description | Selected |
|--------|-------------|----------|
| Settings push category (Recommended) | 8th category in D-12 framework + per-show unsubscribe | ✓ |
| Per-show only | Manage entirely from each show's detail modal | |
| Global toggle only | Single on/off in Settings | |

**User's choice:** Settings push category (recommended)
**Notes:** Captured as D-12. Two layers: global category toggle + per-show unsubscribe.

---

## Live-release prompt gating

### Q1: When does the live-release auto-prompt fire?

| Option | Description | Selected |
|--------|-------------|----------|
| 24h before air (Recommended) | Per the seed doc — fires Thursday 9pm for Friday 9pm episode | ✓ |
| Day-of (morning of air date) | Push fires 9am day-of | |
| Multiple windows (24h + 1h) | Two pushes per episode | |

**User's choice:** 24h before air (recommended)
**Notes:** Captured as D-13.

### Q2: How many family members must be tracking before the prompt fires?

| Option | Description | Selected |
|--------|-------------|----------|
| ≥2 members tracking same show (Recommended) | Suppress solo prompts | ✓ |
| Any 1 member tracking | Even solo trackers get the prompt | |
| ≥2 members + at least one is at same episode index | Strictest gate | |

**User's choice:** ≥2 members tracking same show (recommended)
**Notes:** Captured as D-14. Reduces noise; makes feature feel relevant.

### Q3: Per-show frequency cap — how often per show?

| Option | Description | Selected |
|--------|-------------|----------|
| Every episode (Recommended for v1) | ~10 prompts/show/season; mitigated by ≥2-member gate | ✓ |
| Season premiere only | Only first ep of each new season | |
| First few episodes of season | Eps 1-3 of each season; rest silent | |

**User's choice:** Every episode (recommended for v1)
**Notes:** Captured as D-15. Re-evaluate post-launch if noisy.

### Q4: Auto-suppress logic — when should the prompt NOT fire even if gate passes?

| Option | Description | Selected |
|--------|-------------|----------|
| Already-scheduled wins (Recommended) | If watchparty already exists, suppress | ✓ |
| Already-scheduled + last-prompt-dismissed | Above PLUS dismissed-tracking | |
| Only the already-scheduled rule | No dismissal-based suppression | |

**User's choice:** Already-scheduled wins (recommended)
**Notes:** Captured as D-16. Predictability over self-correcting in v1; users mute via per-show unsubscribe.

---

## Claude's Discretion

User did not delegate any specific question; planner/researcher discretion captured in CONTEXT.md "Claude's Discretion" subsection — Firestore document path, CF schedule cadence, Tonight-widget visual design, detail-modal section placement, naming UI, conflict-prompt copy.

## Deferred Ideas

Captured in CONTEXT.md `<deferred>` section:
- Recurring watchparty primitive (Phase 16)
- Skipping-around episode tracking (post-v1)
- Episode-progress conflict UI (only if cross-pollination ever introduced)
- Dismissed-prompt suppression learning (post-launch)
- Calendar/agenda surface (Phase 16)
- Trakt-required mode (post-v1 if needed)
