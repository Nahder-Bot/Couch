# Phase 3: Mood Tags - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 03-mood-tags
**Areas discussed:** Tag ownership model, Detail view mood section, Active filter quick-clear, Auto-suggest vs. user-tag distinction

---

## Tag ownership model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-member store | `title.memberMoods: { memberId: string[] }` — each member owns their tags, can only remove their own | |
| Shared family array | Any member adds to/removes from existing `title.moods[]` — simplest, no new schema | ✓ |
| Separate userMoods array | New `title.userMoods: string[]` distinct from auto-suggested `title.moods` | |

**User's choice:** Shared family array  
**Notes:** Follow-up confirmed any member can remove any mood — no ownership restriction desired. Simplicity wins.

---

## Detail view mood section

### Layout position

| Option | Description | Selected |
|--------|-------------|----------|
| Below genres, above overview | Natural metadata placement; user sees mood context before overview | ✓ |
| After overview, before cast/providers | Secondary detail below description | |
| Dedicated detail-section block | Labeled section like Cast or Providers, more weight | |

**User's choice:** Below genres, above overview

### Interaction model

| Option | Description | Selected |
|--------|-------------|----------|
| Always-editable chips | Chips inline, tap to remove, + to add — no separate edit mode | ✓ |
| Read + edit mode toggle | Read-only view, pencil icon reveals palette | |
| Expandable section | Collapsible row; collapsed = chips, expanded = palette | |

**User's choice:** Always-editable chips  
**Notes:** No edit mode toggle needed — inline add/remove directly on the chips.

---

## Active filter quick-clear

| Option | Description | Selected |
|--------|-------------|----------|
| Inline chips below filter row | Active mood chips appear as second row below toggle, outside panel, each with × | ✓ |
| Clear button on toggle pill | "Mood: Cozy, Action ×" on the button — clears all at once | |
| Auto-expand when active | Filter body stays open when moods are active | |

**User's choice:** Inline chips below the filter row  
**Notes:** Individual × per chip for granular removal. Panel can stay closed.

---

## Auto-suggest vs. user-tag distinction

| Option | Description | Selected |
|--------|-------------|----------|
| No distinction — one list | All moods render as identical chips regardless of source | ✓ |
| Subtle visual distinction | Auto-suggested chips get softer appearance (dashed border / lower opacity) | |
| Labeled sections: Suggested / Added | Two separate rows in detail view | |

**User's choice:** No distinction — one list  
**Notes:** Once a mood is in `moods[]` it's a mood, regardless of whether it was inferred or added. Clean and simple.

---

## Claude's Discretion

- Exact chip styling in detail view
- "+" entry point affordance design
- Empty-state copy when no moods exist
- Whether removing last mood triggers re-suggest or leaves empty

## Deferred Ideas

None.
