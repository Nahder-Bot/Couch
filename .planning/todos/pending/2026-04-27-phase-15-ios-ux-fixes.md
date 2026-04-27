---
created: 2026-04-27T11:48:08.361Z
title: Phase 15 iOS UX fixes
area: ui
files:
  - css/app.css:2482-2497 (.cv15-tuple-rename — pencil tap target ~22px, below iOS 44pt floor)
  - css/app.css:2498-2508 (.cv15-tuple-rename-input — 15px font triggers iOS Safari auto-zoom)
  - css/app.css:2442-2638 (Phase 15 namespace block — extract .cv15-tuple-overflow class)
  - js/app.js:8866-8868 (overflow link re-purposes .cv15-mute-toggle with inline style overrides)
  - js/app.js:5908-5909 (D-07 disclosure — inline style font-family — extract to .cv15-trakt-disclosure-* classes)
  - js/app.js:8924-8964 (cv15ShowRenameInput — iOS Safari focus race; add defensive sentinel)
  - .planning/phases/15-tracking-layer/15-UI-REVIEW.md (UI auditor findings — pillar scores)
---

## Problem

Phase 15 UI 6-pillar audit (2026-04-27) returned 5 PASS / 1 PARTIAL — the PARTIAL is on touch targets and surfaces real iOS PWA issues that real-device testing will hit. Plus 2 minor cleanup items (overflow class re-purposing + D-07 inline-style typography) and 1 defensive concern (iOS focus race in inline rename).

**UI-1 (HIGH) — Rename pencil tap target ~22px (below iOS 44pt floor).**
`.cv15-tuple-rename` has `padding: var(--s1)` = 4px on a 14px glyph → ~22px square hitbox. iOS HIG mandates 44pt minimum. Mistapping the pencil opens the parent row's tap zone instead, sending the user to the detail modal — UX frustration on a frequently-used affordance.

**UI-2 (HIGH) — Rename input 15px font triggers iOS Safari auto-zoom.**
`.cv15-tuple-rename-input` uses `font-size: var(--t-body)` = 15px. iOS auto-zooms inputs with computed font-size <16px, jumping the viewport ~10% and not auto-reverting. Breaks the inline-rename illusion entirely on iPhone — user has to pinch-out manually after save/cancel.

**UI-3 (MEDIUM) — `.cv15-mute-toggle` class re-purposed for "View all (N)" overflow.**
The overflow expand affordance reuses the kill-switch button class then inline-overrides `border-top:0;color:var(--ink-dim);`. Couples two semantically unrelated affordances — future style changes to `.cv15-mute-toggle` silently propagate to the overflow link. Fragile.

**WR-04 (LOW) — iOS Safari focus race in inline rename.**
`cv15ShowRenameInput` at js/app.js:8924-8964 — defensive sentinel + iOS UAT case recommended. Low severity; mostly a hardening item.

**D-07 inline-style typography (LOW).**
`renderTraktCard()` D-07 disclosure at js/app.js:5908-5909 uses inline `style="font-family:'Inter'..."` and `style="font-family:var(--font-serif)..."` rather than declaring `.cv15-*` classes. Violates BRAND.md §3 anti-pattern: "do not hand-code font-family strings." Works visually but inconsistent with the cv15 namespace discipline elsewhere in Phase 15.

## Solution

Single small patch (~15-20 lines total). No plan needed — straightforward CSS + minor JS extraction. Can ship inline as a `35.0.2-ios-ux` patch when convenient.

**Step-by-step:**

1. **Pencil button hitbox** (UI-1) — 3 CSS lines on `.cv15-tuple-rename`:
   ```css
   .cv15-tuple-rename {
     /* ...existing... */
     min-width: 44px;
     min-height: 44px;
     display: inline-flex;
     align-items: center;
     justify-content: center;
   }
   ```
   Preserves the 14px glyph but expands hitbox to iOS HIG spec.

2. **Input auto-zoom prevention** (UI-2) — 1 CSS line on `.cv15-tuple-rename-input`:
   ```css
   .cv15-tuple-rename-input {
     /* ...existing... */
     font-size: 16px; /* iOS auto-zoom prevention; explicit override of var(--t-body) */
   }
   ```
   Or: `font-size: max(16px, var(--t-body));`. Either works.

3. **Extract `.cv15-tuple-overflow` class** (UI-3) — ~6 lines new CSS, drop 2 inline-style overrides at js/app.js:8866-8868. Decouples the overflow link from the kill-switch button.

4. **Defensive focus sentinel** (WR-04) — 1-2 lines in `cv15ShowRenameInput` to handle race conditions on iOS. UI auditor flagged this as defensive hardening rather than an active bug.

5. **D-07 typography extraction** (D-07 inline-style) — Extract `.cv15-trakt-disclosure-eyebrow` + `.cv15-trakt-disclosure-body` classes; drop inline `style="font-family:..."` from js/app.js:5908-5909. Cleanup pass; ~8 CSS lines + 2 JS string changes.

**After patching:**
- `bash scripts/deploy.sh 35.0.2-ios-ux` from couch repo
- Smoke test on real iPhone PWA: tap pencil affordance, type 8 chars, blur — should NOT zoom; should save cleanly

**Reference docs:**
- `.planning/phases/15-tracking-layer/15-UI-REVIEW.md` — full 6-pillar audit with evidence (lines 1-300+)
- BRAND.md §2 (color/contrast tokens) and §3 (typography anti-patterns)

**Estimated effort:** ~20 minutes of work + 1 deploy cycle. Not worth a full GSD plan — can be `/gsd-fast` or just inline.

**Priority:** MEDIUM — affects iOS PWA usability of Phase 15's S2/S3 inline rename surface. Not exploitable, not a feature gap, but a real UX papercut on the project's primary device target (iOS PWA per CLAUDE.md "Test on mobile Safari").
