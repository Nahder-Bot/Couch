---
phase: 28
slug: social-pickem-leaderboards
status: approved
shadcn_initialized: false
preset: none
created: 2026-05-02
reviewed_at: 2026-05-02
checker_iterations: 2
authored_via: /gsd-ui-phase 28
upstream_inputs:
  - .planning/phases/28-social-pickem-leaderboards/28-CONTEXT.md (16 locked decisions)
  - .planning/BRAND.md (Couch Brand System v1)
  - .planning/PROJECT.md (Out-of-Scope: cross-family / public discovery)
  - .planning/seeds/v2-watchparty-sports-milestone.md
  - css/app.css (~4654 lines, 47-token semantic alias layer)
  - app.html (~1519 lines, 5-tab .tabbar bottom nav)
ui_safety_gate: applied (no third-party registries declared)
---

# Phase 28 — UI Design Contract

> Visual and interaction contract for the **Social pick'em + leaderboards** surface.
> This contract extends the existing Couch design system (BRAND.md v1) — it does NOT introduce a new design language or component library. Couch is a single-file PWA with a hand-crafted token layer; shadcn does not apply.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | none (existing hand-crafted system) | CLAUDE.md "no bundlers, no framework, no module splitting" |
| Preset | not applicable | Phase 9 / DESIGN-02..10 locked the system; Phase 28 reuses tokens |
| Component library | none — vanilla DOM + `js/app.js` render functions | js/app.js + css/app.css recipes |
| Icon library | inline SVG (currentColor stroke, 22×22 default) | app.html `.tabbar` precedent |
| Font | Fraunces (display) + Instrument Serif (italic brand voice) + Inter (body/UI) | BRAND.md §3 |

**Phase 28 file plan** (planner finalizes — locked at the visual-contract level here):
- `js/pickem.js` (NEW — pure helpers per CONTEXT D-15; ~150-200 lines projected)
- `js/app.js` (extended) — `renderPickemSurface`, `renderPickerCard`, `renderLeaderboard`, `renderInlineWpPickRow`, `renderPastSeasonsArchive`
- `css/app.css` (extended) — appended `.pe-*` class family at end of file (no token changes)

---

## Spacing Scale

Phase 28 uses the existing semantic-spacing token layer from `css/app.css` Layer 2 (lines 155-163). **No new tokens introduced.**

| Token | Value | Phase 28 Usage |
|-------|-------|----------------|
| `--space-inline-xs` | 4px | Icon-text gaps inside picker chips, leaderboard rank-pill internal padding |
| `--space-inline-sm` | 8px | Pick chip gaps, tiebreaker numeric input internal padding |
| `--space-inline-md` | 12px | Picker card column gaps, leaderboard row internal padding |
| `--space-inline-lg` | 16px | Picker card outer padding, leaderboard card outer padding |
| `--space-stack-sm` | 12px | Vertical gap between rows inside the same picker card |
| `--space-stack-md` | 20px | Vertical gap between picker cards inside a slate |
| `--space-stack-lg` | 28px | Vertical gap between major sub-surfaces (e.g. picker → leaderboard CTA) |
| `--space-section` | 40px | Vertical gap between league sections in the Pick'em surface |
| `--space-page` | 56px | Top breathing room of the Pick'em surface (after `.tab-hero`) |

**Touch target floor:** **44px minimum** for any tappable element (winner-team chip, draw chip, F1 podium row, UFC fighter chip, edit-pick affordance, member rank row in leaderboard, Past-seasons archive row). Mirrors `app.css:843` `.wp-control-btn` and `app.css:882` `.wp-lobby-start-btn` precedents and matches CONTEXT Specifics "44px min-height" pattern from Phase 27 guest pills.

**Exceptions:**
- Tiebreaker numeric input: 40px tall (single-line numeric, mirrors `.score-btn` pattern at `app.css:598`); compensated with the chip directly above/below being 44px.
- Inline wp pick row chips inside the live-wp modal (D-07): 36px tall (these sit inside a denser modal context and are read-mostly — the inline row is informational, not a primary tap target). Mirrors `.pill.icon-only` recipe at `app.css:2225`.

**Locked games collapsed section** uses `--space-stack-md` (20px) outer breathing + `--space-stack-sm` (12px) between locked rows (denser than active picker cards by design — locked games are reference, not action).

---

## Typography

Phase 28 uses the existing semantic-typography token layer from `css/app.css` Layer 1 (lines 73-80) + the three font-family tokens at lines 176-178. **No new sizes introduced.**

> **Brand-inheritance note:** The size set (32/22/17/15/13/11) and weight set (400/500/600) below exceed the Dimension 4 "max 4 sizes / max 2 weights" heuristic. These are inherited verbatim from BRAND.md §3, locked at Phase 9 / DESIGN-02..10, and applied across all post-Phase-9 phases. This is a system-level inheritance flag, not a Phase 28 violation — Phase 28 introduces zero new sizes or weights.

| Role | Token | Size | Family | Weight | Line Height | Phase 28 Usage |
|------|-------|------|--------|--------|-------------|----------------|
| Tab-hero possessive title | `--t-h1` | 32px | `--font-serif` italic | 400 | 1.15 | "Your pick'em" / "Mom's pick'em" hero on Pick'em sub-surface |
| Tab-hero eyebrow | `--t-eyebrow` | 11px | `--font-sans` uppercase 0.12em tracking | 600 | 1.4 | "PICK'EM · NFL WEEK 8" eyebrow above hero title |
| Tab-section heading | `--t-eyebrow` | 11px | `--font-sans` uppercase 0.12em tracking | 600 | 1.4 | League section divider ("NBA — TONIGHT'S SLATE") |
| Picker card matchup | `--t-h3` | 17px | `--font-serif` italic | 400 | 1.3 | "Lakers @ Bucks" inside picker card (mirrors `.sports-game-teams` at `app.css:981`) |
| Picker card team chip label | `--t-body` | 15px | `--font-sans` | 600 | 1.35 | "Lakers" / "Draw" / "P1: Verstappen" winner-pick chip text |
| Picker card meta (start time + tiebreaker tag) | `--t-meta` | 13px | `--font-sans` | 500 | 1.4 | "Tonight, 7:30 PM · (tiebreaker)" |
| Pre-fill brand-voice sub-line | `--t-meta` | 13px | `--font-serif` italic | 400 | 1.4 | "Lakers — your pick from your team commitment. *Tap to change.*" (D-09) |
| Leaderboard rank number | `--t-h2` | 22px | `--font-serif` italic | 400 | 1.1 | "1" / "2" / "T-3" rank cell |
| Leaderboard member name | `--t-body` | 15px | `--font-sans` | 600 | 1.35 | "Mom" / "Dad" / "Anna" |
| Leaderboard score line | `--t-meta` | 13px | `--font-sans` (numerals tabular) | 500 | 1.4 | "32 pts · 32 of 51 settled · 6 missed" |
| Result revealed total | `--t-h3` | 17px | `--font-serif` italic | 400 | 1.3 | "(tiebreaker — your guess: 47, actual: 52, off by 5)" |
| Past-seasons archive row | `--t-body` | 15px | `--font-sans` | 500 | 1.35 | "NFL 2025 — Mom 152-89, Dad 144-97, Kid 38-17" |
| Empty-state heading | `--t-h2` | 22px | `--font-serif` italic | 400 | 1.2 | "No games on the slate tonight." |
| Empty-state body | `--t-body` | 15px | `--font-sans` | 400 | 1.55 | "Check back tomorrow — your leagues are quiet." |
| Push-notification copy | `--t-body` | 15px | system-default (push body) | system | system | "Mom, the Lakers/Bucks tip-off is in 15. Make your pick." |

**Anti-patterns (from BRAND.md §3, must hold):**
- Do NOT mix Fraunces and Instrument Serif in the same card. Leaderboard rank uses Instrument Serif italic; if any leaderboard heading needs display-weight Fraunces, place it in a separate `.tab-hero` block above the card.
- Inline emphasis goes in `<em>` wrapped by `.page-tagline` or a serif-italic span. NEVER `style="font-family:'Instrument Serif'"`.
- No ALL-CAPS in source text. Eyebrow uppercase is CSS-only (`text-transform: uppercase`).
- No exclamation marks except celebratory moments. The `pickResults` push label "Pick'em results" is celebratory-adjacent but stays sentence-case per BRAND voice.

---

## Color

Phase 28 uses the existing 60/30/10 split from BRAND.md §2 + `css/app.css` Layer 1 (lines 32-54) + Layer 2 semantic aliases (lines 124-152). **No new color tokens introduced.**

| Role | Token | Hex | Phase 28 Usage |
|------|-------|-----|----------------|
| Dominant (60%) — app background | `--bg` | `#14110f` | Pick'em surface background, leaderboard outer-card backdrop |
| Secondary (30%) — raised surfaces | `--surface` | `#1c1814` | Picker card, leaderboard row card, past-seasons row card |
| Secondary tier 2 — sunken / nested | `--surface-2` | `#25201a` | Inner team-chip background (un-selected), tiebreaker numeric input bg |
| Secondary tier 3 — pressed / hover | `--surface-3` | `#2f2820` | Active picker card hover state, pressed leaderboard row |
| Accent (10%) — amber brand voice | `--accent` | `#e8a04a` | (see "Accent reserved for" below) |
| Accent gradient — primary CTAs only | `--brand-grad` | `linear-gradient(135deg, #e8a04a, #d97757, #c54f63)` | "Make your pick" primary CTA when picker has empty selection; "View leaderboard" entry CTA on Tonight sub-surface |
| Velvet (rare celebratory) | `--velvet-glow` | `#c54f63` | First-place leaderboard rank pill micro-glow (`box-shadow: 0 0 0 2px rgba(197,79,99,0.18)`) on the #1 row only |
| Semantic — correct pick | `--good` | `#7fb069` | Settled-pick correct chip border + 1pt scoreline accent |
| Semantic — incorrect pick | `--bad` | `#c44536` | Settled-pick incorrect chip border + 0pt scoreline accent |
| Semantic — locked / pending | `--warn` | `#d4a76a` | "Locked games" collapsed-section header tint; "(picks closed)" pill |
| Ink primary | `--ink` | `#f5ede0` | Picker card matchup text, leaderboard member name, all primary-readable text |
| Ink secondary | `--ink-warm` | `#c9bca8` | Picker card meta line, leaderboard score line, past-season archive sub-text |
| Ink muted | `--ink-dim` | `#847868` | Empty-state body, "(tiebreaker)" annotation, footer attribution |
| Ink faint | `--ink-faint` | `#5a4f43` | Decorative dividers between picker cards, league-section bottom rule |
| Team-color custom property | `--team-color` | varies (per `participants[mid].teamColor`) | Pre-filled team chip border + member-row leaderboard avatar ring (D-09 visual hook; mirrors `.wp-participant-av.has-team-flair` at `app.css:3200`) |

**60/30/10 distribution check:**
- 60% `--bg` `#14110f`: page background everywhere; ~60% of total pixels.
- 30% `--surface` `#1c1814` + `--surface-2` `#25201a` + `--surface-3` `#2f2820`: picker cards, leaderboard rows, past-seasons rows, tiebreaker input bg, team-chip un-selected bg.
- 10% `--accent` `#e8a04a`: see strict reserved-for list below.

**Accent reserved for** (Phase 28 — explicit list, never "all interactive elements"):
1. **Active tab indicator** if Pick'em entry is surfaced from `.tabbar` (per Discretion below; mirrors `app.css:559` `.tab.on{color:var(--accent)}`).
2. **Selected pick chip ring** — when the user has tapped a winner-team chip (or draw / F1 podium row / UFC fighter chip), a 2px solid `--accent` border appears around the chip. Un-selected chips use `--border-mid` `#3a3128`.
3. **Tiebreaker designation marker** — the small italic "(tiebreaker)" annotation on the picker card matchup line + the small amber dot prefix on the tiebreaker numeric input.
4. **"Pick locked" countdown chime** — when `gameStartTime - now < 60 minutes`, the start-time meta line shifts to `--accent` for the last hour (visual urgency without alarm; mirrors `.pill.scheduled.active` at `app.css:672`).
5. **Primary CTA brand-gradient** — "Make your pick" CTA on Tonight sub-surface when slate has un-picked games + "View leaderboard" entry from Tonight + "View past seasons" archive entry. **Exactly one brand-gradient per surface per BRAND.md "one gradient instance per screen" rule (DO/DON'T gallery).**
6. **First-place leaderboard rank pill** — `#1` rank cell uses `--accent` ink color + `--velvet-glow` micro-shadow. Rank 2-N use `--ink-warm`. Tied #1s share the accent treatment.
7. **Pre-fill brand-voice sub-line accent word** (D-09) — the team name in "*Lakers* — your pick from your team commitment" gets `<em>` styling with `--accent` color when the team chip is the pre-fill source. Mirrors BRAND.md DO/DON'T gallery `<em>` inside serif italic tagline.

**Destructive color (`--bad` `#c44536`):** Reserved for **incorrect-pick result chip border** (settled-pick reveal — the chip shows what the member picked, with red border meaning "this was wrong"). NOT used for any tap target. There are NO destructive actions in the Phase 28 user flow — picks can be edited (lock-time-bound per D-04) but not deleted, and "auto_zeroed" missed picks just render with `--ink-dim` and "(missed)" suffix.

**Semantic-state color usage:**
- `--good` `#7fb069`: correct-pick reveal chip (mirrors `.pill.comments` style at `app.css:670`); leaderboard "5W2L last 7" hot-streak callout if planner adds it (Discretion).
- `--bad` `#c44536`: incorrect-pick reveal chip border only.
- `--warn` `#d4a76a`: "Locked games" collapsed section header; "(picks closed)" pill on a card whose `gameStartTime` has passed.

---

## Copywriting Contract

All copy follows BRAND.md §6 voice rules: warm, lived-in, sentence-case, no exclamations except celebratory moments, italic Instrument Serif for brand-voice lines, no ALL-CAPS in source.

| Element | Copy | Notes |
|---------|------|-------|
| Pick'em surface tab-hero eyebrow | `PICK'EM · {LEAGUE_LABEL_UPPER} · {SLATE_CONTEXT}` | Example: "PICK'EM · NFL · WEEK 8". Uppercase via CSS only. |
| Pick'em surface tab-hero title | "Your pick'em" (own-view) / "{Member}'s pick'em" (peer-view) | Possessive serif italic per BRAND §7 tab-section pattern. |
| Pick'em surface tab-hero sub | "*Pick a winner. Earn a point. Tease the rest of the couch.*" | Instrument Serif italic; mirrors BRAND DO copy "*Pick what to watch, together.*" |
| Picker card matchup | "{Away} @ {Home}" (US sports) / "{Home} v {Away}" (soccer) / "{RaceName}" (F1) / "{MainEvent} — {EventName}" (UFC) | Mirrors `.sports-game-teams` at `app.css:981`. |
| Picker card meta | "Tonight, {time}" or "{day}, {time}" or "Live in {N}h{M}m" | Same pattern as `.sports-game-time` at `app.css:988`. |
| Picker card tiebreaker tag | " · (tiebreaker)" | Italic Instrument Serif inline; serif italic for "moments of warmth" per BRAND. |
| Tiebreaker input label | "Predict total points (tiebreaker only)" | Sentence-case; spelled-out parenthetical. |
| Tiebreaker input placeholder | "e.g. 47" | Lowercase "e.g." per BRAND informal voice. |
| Pre-fill brand-voice sub-line | "*{Team} — your pick from your team commitment. **Tap to change.***" | Instrument Serif italic; team name in `<em>` with `--accent` color. |
| Primary CTA (slate has un-picked games) | "Make your pick" | Brand-gradient, exactly one per surface. |
| Primary CTA — already picked, can still edit | "Edit your pick" | Brand-gradient retained until lock; mirrors "edit until lock" rule per Specifics. |
| Primary CTA — locked (read-only) | not rendered (CTA disappears at lock) | Locked games render in collapsed section per Specifics. |
| Locked games section header | "Locked games" | Plain `.tab-section-h` styling. |
| Locked-game settled correct sub-line | "{Member} picked {Pick} · 1 pt" | `--good` accent on the "1 pt" pip. |
| Locked-game settled incorrect sub-line | "{Member} picked {Pick} · 0 pt" | `--bad` accent on the chip border, neutral on text. |
| Locked-game tiebreaker reveal | "(tiebreaker — your guess: {N}, actual: {M}, off by {abs(N-M)})" | Italic Instrument Serif; "off by" warmer than "delta". |
| Locked-game missed | "{Member} didn't pick · 0 pt (missed)" | `--ink-dim` body, "(missed)" italic. |
| Pick lock countdown (T-60min onset) | "Picks close in {N}m" | `--accent` color shift; replaces start-time string. |
| Pick lock final state | "Picks closed" | `--warn` `.pill` style. |
| Inline wp pick row (in live-wp modal, pre-tip-off) | "Your pick: {Team} · {Member}: {Team} · {Member}: {Team}" | Read-only; `--ink-warm` body. Disappears at lock per D-07. |
| Inline wp pick row — own pick missing | "You haven't picked yet — *make your pick*" with inline link | `<em>` italic clickable; opens picker as overlay over wp modal. |
| Leaderboard tab-hero eyebrow | `LEADERBOARD · {LEAGUE_LABEL_UPPER} · {SEASON}` | Example: "LEADERBOARD · NFL · 2025". |
| Leaderboard tab-hero title | "Who's calling it right" | Possessive-adjacent voice; sentence-case; serif italic. |
| Leaderboard row member line | "{Member}" (left col) + rank `{N}` or `T-{N}` (right) | "T-3" for ties; pure numeric with hyphen. |
| Leaderboard row score line | "{points} pts · {settled} of {total} settled · {missed} missed" | Tabular numerals; `--ink-warm`. |
| Leaderboard tied-bottom-tier note | "{N} more — *tap to expand*" | If >5 members, collapse the tail behind a tap. |
| Leaderboard mid-season-join note | "{Member} joined Week {N} of {total}" | `--ink-dim` italic Instrument Serif; renders only when D-13 forward-only applies. |
| Past-seasons archive entry CTA | "View past seasons" | Plain link-style button, no gradient (already used by Make-your-pick). |
| Past-seasons archive row | "{LEAGUE} {SEASON} — {top1} {pts1}, {top2} {pts2}, {top3} {pts3}" | Single line; truncates at top 3 even if more members. |
| Past-seasons row caption | "*Frozen at season end.*" | Instrument Serif italic; one-time per row, dim. |
| Empty-state — no upcoming games for any enabled league | Heading: "Quiet on the couch tonight."<br>Body: "No games on the slate this week. Pick'em comes alive when your leagues do." | Heading serif italic 22px; body sans 15px ink-warm. |
| Empty-state — no picks made yet (own-view, slate has games) | Heading: "First pick of the season is yours."<br>Body: "Tap a matchup below to call it." | Welcoming, low-pressure. |
| Empty-state — leaderboard before anyone picks | Heading: "Nobody's called a game yet."<br>Body: "Make the first pick to start the board." | Mirrors BRAND DO copy "Pull up a seat." |
| Empty-state — past seasons before any seasons turned over | (entire archive entry hidden — D-12 hard-reset doesn't render the section until at least one frozen season exists) | Hide-when-empty per Phase 26 / D-10 precedent. |
| Error — TheSportsDB schedule fetch fails | "Couldn't load tonight's slate. Try again in a minute." with retry-link | `--ink-warm`; retry surfaces the loader once tapped. |
| Error — pick submit Firestore write fails | "Couldn't save your pick. {Member}, your network might be napping. Try again." | Sentence-case "Try again" link button. |
| Error — pick submitted after lock (race condition between client clock + Firestore rules) | "This pick locked while you were tapping. {OtherTeam} picked it for you? — no points awarded." | Friend-tone humor per BRAND voice rules. |
| Push notification — `pickReminder` body | "Heads-up — {GameMatchup} tips off in 15. Make your pick." | Existing 3-map pattern from CONTEXT D-06. |
| Push notification — `pickResults` body | "{Member}, your {LeagueLabel} picks just settled. Tap to see how you did." | Celebratory-adjacent; sentence-case. |
| Push notification — `pickemSeasonReset` body | "The {LeagueLabel} {Season} season just turned over. Fresh slate, fresh picks." | Warm "fresh slate" double-meaning. |
| Picks-closed pill text | "Picks closed" | `--warn` background, `--bg` text. |
| F1 podium row prefix | "P1 / P2 / P3" | Caps tag; mirrors motorsport convention. |
| UFC method-of-victory chip labels | "KO" / "SUB" / "DEC" | Three-letter caps mirror UFC tradition; readable. |
| Edit-pick affordance | "Edit" pill icon-only at row right; aria-label "Edit your pick for {Matchup}" | 36px touch target inside the row; full row also tap-opens. |
| Destructive confirmation | not applicable — Phase 28 has NO destructive actions | Confirmed via CONTEXT D-13 (no backfill/delete) + Specifics (edits overwrite, no history audit) |

**Voice rules carried forward** (BRAND §6, must hold):
- "Speak like a friend handing you the remote, not a product manager." — verified across 31 strings above; "Heads-up", "Quiet on the couch", "fresh slate" all pass.
- "No exclamation marks except celebratory moments." — zero exclamation marks in Phase 28 copy. The `pickResults` push body is celebratory-adjacent but stays sentence-period.
- "Sentence-case buttons. Never ALL-CAPS except eyebrows." — verified ("Make your pick", "Edit your pick", "View past seasons", "Try again"). All eyebrows are CSS-uppercase via `text-transform`.
- "No em-dashes dangling at line-end." — verified (em-dashes only used inline mid-string).

---

## Surface map

Phase 28 introduces **5 surfaces**. Locking each surface's host + entry pattern resolves CONTEXT Discretion item ("Pick'em tab nav placement").

| # | Surface | Host | Entry | Visual posture |
|---|---------|------|-------|----------------|
| 1 | **Pick'em sub-surface** (slate browser per league) | New `#screen-pickem` block inside `.phone-shell` | (a) Sub-surface link from Tonight tab `.tab-hero-sub` row when slate has games; (b) Inline link from Add tab when zero matches in family library | Full screen in mobile; mirrors `.tab-section` rhythm. **NOT a 6th `.tabbar` button** — bottom nav is full at 5 tabs (Tonight/Queue/Add/Family/Account); a 6th would crowd `max-width:480px` per `app.css:553`. |
| 2 | **Picker card** (per game in a slate) | Inside surface 1 `.tab-section` | Auto-rendered for every game in the active slate | Card uses `.tab-list-card` recipe at `app.css:1156`; matchup line + chip row + meta + (optional tiebreaker input) + pre-fill sub-line if D-09 applies |
| 3 | **Leaderboard sub-surface** (per league per season) | Inside surface 1 (sibling `.tab-section`) | "View leaderboard" CTA button on surface 1 league section header | Compact card stack; one row per family member; rank pill + name + score line |
| 4 | **Inline wp pick row** | Inside existing `.wp-live-modal` (between participant strip and reactions area) | Auto-rendered in live-wp modal when `wp.mode === 'game'` AND any family member has picked AND game not yet locked | Compact horizontal chrome row; `--surface-2` background; `--ink-warm` text; disappears at lock per D-07 |
| 5 | **Past-seasons archive** | Inside surface 1 (sibling `.tab-section` — only renders when ≥1 frozen season exists per D-12 hide-when-empty) | "View past seasons" link inside surface 3 leaderboard footer | Flat list; one row per `{strSeason}` doc; tap → frozen-leaderboard read-only modal (reuses surface 3 rendering, adds "(frozen)" eyebrow) |

**Discoverability constraint** (CONTEXT Discretion):
- Pick'em surface MUST be reachable in ≤2 taps from the home screen (Tonight tab). Lock: 1-tap from `.tab-hero` "*Tonight: NFL Week 8 has 3 games. **Open pick'em.***" inline link when slate has games; 2-tap from Add tab via "Find something to bet on tonight" entry when family library is empty + sports leagues are active.
- Pick'em surface MUST NOT bury behind 3 taps OR require account-tab navigation.
- When NO leagues have upcoming games this week (rare empty-state), the Tonight tab inline-link is hidden and only the Add tab entry remains (planner discretion: surface inline link is hide-when-empty per Phase 26 D-10 / RPLY-26-20 precedent).

---

## Picker card layout (locked)

Vertical stack inside `.tab-list-card` recipe (app.css:1156):

```
┌─────────────────────────────────────────┐
│ Lakers @ Bucks  · (tiebreaker)          │  ← matchup line: --t-h3 serif italic + (tiebreaker) tag
│ Tonight, 7:30 PM                        │  ← meta line: --t-meta sans, --ink-warm
├─────────────────────────────────────────┤
│ ┌───────────┐ ┌───────────┐             │  ← team-chip row (or 3-row F1 podium / 2-chip+method UFC)
│ │  Lakers   │ │  Bucks    │             │     min-height 44px each; gap --space-inline-sm
│ └───────────┘ └───────────┘             │
├─────────────────────────────────────────┤
│ Lakers — your pick from your team       │  ← pre-fill sub-line (D-09); only if applicable
│ commitment. *Tap to change.*            │     --t-meta serif italic, --ink-dim, "Lakers" with --accent <em>
├─────────────────────────────────────────┤
│ Predict total points (tiebreaker only)  │  ← tiebreaker label; only on designated game per slate
│ ┌─────┐                                 │
│ │ 47  │                                 │  ← numeric input, 40px tall, type="number" inputmode="numeric"
│ └─────┘                                 │
└─────────────────────────────────────────┘
```

**Selection state visual** (D-04 / D-09):
- Default chip (un-selected): `--surface-2` background, `--ink-warm` text, `--border-mid` 1px border.
- Hover (mouse only): `--surface-3` background, no border change. Mobile: no hover state — straight to tap.
- Selected (user tapped): `--surface-2` background unchanged, text shifts to `--ink`, **2px solid `--accent` border** appears.
- Pre-filled (D-09 team-allegiance match): `--surface-2` background unchanged, **2px solid `--team-color` border** (member's team color from `participants[mid].teamColor`); the brand-voice sub-line below clarifies the source. If user taps the OTHER chip, both chips reset and `--accent` ring moves to the new selection.
- Locked (game past start): chip background dims to `--surface` (matching outer card), text shifts to `--ink-dim`, border drops to `--ink-faint`. Card moves to "Locked games" collapsed section.

**F1 podium variant** (`pickType === 'f1_podium'`):
- Replaces the 2-chip row with a 3-row vertical stack labeled "P1" / "P2" / "P3".
- Each row is a tap-to-open dropdown selector. Driver names auto-populate from TheSportsDB race entry list (CONTEXT D-02).
- Each row min-height 44px; gap `--space-stack-sm` (12px).
- Pre-fill (D-09) does NOT apply to F1.

**UFC variant** (`pickType === 'ufc_winner_method'`):
- 2-chip row for fighters (same as `team_winner`).
- Below it, a 3-chip row labeled "Method" with chips "KO" / "SUB" / "DEC", each min-height 44px.
- Both selections required to enable submit.
- Pre-fill (D-09) does NOT apply to UFC.

**Soccer variant** (`pickType === 'team_winner_or_draw'`):
- 3-chip row: `{Home}` / `Draw` / `{Away}`.
- Draw chip uses neutral `--surface-2` background; selected state same `--accent` ring.

---

## Leaderboard layout (locked)

```
┌─────────────────────────────────────────┐
│ LEADERBOARD · NFL · 2025                │  ← .tab-hero-eyebrow uppercase
│ Who's calling it right                  │  ← --t-h1 serif italic
├─────────────────────────────────────────┤
│ ┌─────┐                                 │
│ │  1  │  Mom                            │  ← rank pill: --t-h2 serif italic, --accent color (#1 only)
│ └─────┘  32 pts · 32 of 51 settled · 6 missed
│                                         │
│ ┌─────┐                                 │
│ │  2  │  Dad                            │  ← rank 2-N: --ink-warm color, no glow
│ └─────┘  28 pts · 30 of 51 settled · 5 missed
│                                         │
│ ┌─────┐                                 │
│ │ T-3 │  Anna                           │  ← tied: hyphenated rank, no special color
│ └─────┘  21 pts · 22 of 51 settled · 9 missed (joined Week 8 of 17)
└─────────────────────────────────────────┘
                                          
       View past seasons →                ← link-style, no gradient
```

Row min-height: 56px (rank pill 40px tall + breathing). Row tap target: full row width (no edit affordance — leaderboard is read-only). Member avatar (24px) optional inline left of name (planner discretion; matches existing `.who-mini-avatars` at `app.css:571` precedent).

**Member-row team-color ring** (Discretion): The member's avatar in the leaderboard row gets a 2px `--team-color` ring matching their `participants[mid].teamColor` for THIS league (if set). Mirrors `.wp-participant-av.has-team-flair` from `app.css:3200`.

---

## Inline wp pick row (live-wp modal context)

Compact chrome row inside `.wp-live-modal` between participant strip and reactions area:

```
┌─────────────────────────────────────────┐
│ Picks · You: Lakers · Mom: Bucks · Dad: Lakers │  ← single line, --t-meta sans, --ink-warm; `--surface-2` bg
└─────────────────────────────────────────┘
```

- Background: `--surface-2` (matches dense-modal context).
- Padding: `--space-inline-md` (12px) horizontal, `--space-inline-sm` (8px) vertical.
- Visibility threshold (Discretion lock): renders when **≥1 family member has picked** for this game (not just 2+). Members who haven't picked render as "{Member}: —" placeholder so the social pressure is gentle ("everyone but Dad has called this one"). User's OWN missing pick gets the inline link "*make your pick*" with `<em>` style.
- Disappears entirely at `gameStartTime` (lock); replaced by nothing until score settles, at which point it returns showing "Picks · You: Lakers ✓ · Mom: Bucks ✗ · Dad: Lakers ✓" with `--good`/`--bad` chip-pip indicators.
- Real-time update via Firestore `onSnapshot` per CONTEXT D-10.

---

## Motion

Phase 28 uses the existing motion catalog from BRAND.md §5 + `css/app.css` Layer 1 (lines 95-97 + 181-192) + Layer 2 (lines 199-207). **No new duration or easing tokens introduced.**

| Motion | Token | Phase 28 Usage |
|--------|-------|----------------|
| Selection chip ring fade-in | `--duration-fast` (150ms) `--easing-standard` | `--accent` border appears on tap; chip-text color shift uses same timing |
| Pre-fill chip ring entrance | `--duration-base` (220ms) `--easing-out` | `--team-color` border decelerates in on first picker render (D-09); subtle enough to read as a hint, not a celebration |
| Picker card slide-in (slate render) | `--duration-deliberate` (300ms) `--easing-out` | Cards stagger 50ms apart on initial render (chronological order = stagger order) |
| Locked-game collapse | `--duration-base` (220ms) `--easing-standard` | Picker card transitions from active section to "Locked games" collapsed section; height + opacity tween |
| Settle-time result reveal | `--duration-cinema` (400ms) `--easing-cinema` | When `pickResults` settle (own picks newly settled this session), chip border tweens un-set → `--good`/`--bad`; theatrical per BRAND |
| Tiebreaker reveal annotation | `--duration-deliberate` (300ms) `--easing-out` | "(tiebreaker — your guess: 47, actual: 52)" fade-in + slide-up after the chip border settles |
| Leaderboard rank shuffle | `--duration-cinema` (400ms) `--easing-cinema` | When a settle event causes rank reordering (own session), rows FLIP-tween via transform; rare moment, theatrical |
| Lock-countdown color shift | `--duration-base` (220ms) `--easing-standard` | Start-time meta line shifts to `--accent` at T-60min onset; one-shot transition |
| Pick'em surface entrance | `--duration-deliberate` (300ms) `--easing-out` | Mirrors existing `showScreen()` tab-switch motion (already in `js/app.js`) |

**Reduced-motion contract** (BRAND §5, MUST hold):
```css
@media (prefers-reduced-motion: reduce) {
  .pe-* { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```
Applied as a class-family scoped override; do not retrofit individual rules. The leaderboard rank-shuffle FLIP must also clamp to 0.01ms — when reduced-motion is on, ranks just snap to new positions.

**Anti-celebration:** No confetti, no podium ceremony, no "you won!" overlay. Phase 28 is a season-long engagement loop — celebrating a single 1pt correct pick would feel cheap. Year-in-Review (Phase 10, deferred) is the right place for season-end ceremony.

---

## Accessibility

| Requirement | Phase 28 application |
|-------------|---------------------|
| Touch targets ≥44px (WCAG 2.5.5 AAA) | All picker chips, edit affordances, leaderboard rows, tab-bar entries |
| Color contrast (BRAND §2 measured ratios) | `--ink` on `--bg` ≥14:1 (matchup, name); `--ink-warm` on `--bg` ≥8.5:1 (meta, score line); `--ink-dim` ONLY on text ≥17px (`--t-h3`+) per BRAND §2 (passes AA large only) |
| Focus-visible outline | `:focus-visible{outline:2px solid var(--accent);outline-offset:2px}` from `app.css:211` — applies automatically to all `<button>` elements in picker + leaderboard + archive |
| Skip-link parity | Existing `.skip-link#screen-tonight` at `app.html:293` continues to anchor; surface 1 inherits; no new skip-link needed since Pick'em is a sub-surface, not a top-level screen |
| ARIA — picker chip role | Each chip is `role="radio"` inside a `role="radiogroup"` per game card (single-select per game, except F1 podium which uses 3 separate `role="combobox"` selectors) |
| ARIA — leaderboard | `<ol>` semantic with `aria-label="{LeagueLabel} {Season} leaderboard"`; rank cell aria-hidden (number is decorative — name + score line carry meaning) |
| ARIA — inline wp pick row | `aria-live="polite"` so screen readers announce when a family member submits a pick (D-10 social signal must be inclusive) |
| ARIA — picks-closed pill | `role="status"` + visible "Picks closed" text — NOT just a color change |
| Tabular numerals | All numeric scores + rank cells use `font-variant-numeric: tabular-nums` to keep columns aligned (mirrors `.sports-game-score` at `app.css:990` mono-treatment, but with sans tabular instead of mono — the score line stays in body voice) |
| Screen-reader announcement on settle | When own pick settles correct: "Your Lakers/Bucks pick was right — 1 point added." When incorrect: "Your Lakers/Bucks pick was wrong — no points." `aria-live="polite"` on a hidden `.sr-announce` div |
| Numeric input keyboard | Tiebreaker input uses `inputmode="numeric"` + `pattern="\d*"` to surface the numeric keypad on iOS without the "+/-/.,e" decimal-flavored keypad |
| Reduced-motion | Locked at the `.pe-*` class-family level (see Motion §) |

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| (none — Phase 28 introduces no third-party UI registries) | n/a | not applicable |

**Confirmation:** CONTEXT lists no third-party registries; CLAUDE.md prohibits bundlers / frameworks; the existing design system is hand-crafted. The `ui_safety_gate: applied` frontmatter signals that the gate was evaluated and found inapplicable, NOT skipped.

---

## Component reuse map

Phase 28 reuses or extends existing recipes — **no new visual primitives invented.**

| Existing recipe | Source | Phase 28 reuse |
|-----------------|--------|----------------|
| `.tab-list-card` | `css/app.css:1156` | Picker card outer shell |
| `.tab-section` + `.tab-section-h` | `css/app.css:1115-1117` | League sectioning inside Pick'em surface |
| `.tab-hero` + `.tab-hero-eyebrow` + `.tab-hero-title` + `.tab-hero-sub` | `css/app.css:1084-1098` | Pick'em surface hero + Leaderboard hero |
| `.sports-game-teams` + `.sports-game-time` | `css/app.css:981-988` | Picker card matchup + meta line copy treatment |
| `.sports-game-card` (border + hover) | `css/app.css:972-978` | Picker card border + hover state |
| `.pill` + `.pill.accent` | `css/app.css:3568, 1762` | Edit-pick affordance + first-place rank treatment |
| `.pill.scheduled` + `.pill.scheduled.active` | `css/app.css:671-672` | Picks-closed pill + lock-countdown urgency |
| `.wp-control-btn` recipe | `css/app.css:843` | 44px min-height touch target standard |
| `.team-flair-pick` + `.wp-participant-av.has-team-flair` | `css/app.css:3198, 3200` | Pre-fill chip team-color ring + leaderboard avatar ring |
| `.modal-bg` + `.modal` (sheet variant) | `css/app.css:478, 486` | Past-seasons frozen-leaderboard read-only modal |
| `.tabbar` + `.tab.on{color:var(--accent)}` | `css/app.css:553-559` | Active-state precedent for sub-surface section anchors |
| `.brand-grad` recipe | `css/app.css:102` | "Make your pick" / "View leaderboard" / "View past seasons" primary CTAs (one-per-surface lock) |
| `.shadow-warm` | `css/app.css:92` | Brand-CTA glow on `--brand-grad` buttons (one-per-screen) |
| `.empty-state` lineage (D-11) | `css/app.css:4202` | Empty states across all 3 sub-surfaces |
| `.pickup-widget` placement precedent | `app.html:322` (`#cv15-pickup-container`) | Tonight-tab Pick'em entry placement (above Flow A entry CTA) |
| Existing `<svg>` inline icons (.tab .icon) | `app.html:1387, 1391, ...` | Custom Pick'em icon for surface header (planner sources from existing icon vocabulary; brief: trophy/checkmark hybrid, 22×22, currentColor stroke 1.8) |

---

## Source-authority map (for executor + UI-checker)

| Decision dimension | Source of truth |
|--------------------|-----------------|
| Spacing tokens | `css/app.css` Layer 1 (lines 73-92) + Layer 2 (lines 155-163) — DO NOT introduce new tokens |
| Color tokens | `css/app.css` Layer 1 (lines 32-54) + BRAND.md §2 — DO NOT introduce new tokens |
| Typography sizes + weights | `css/app.css` Layer 1 (lines 73-80) + BRAND.md §3 — DO NOT introduce new sizes |
| Font families | BRAND.md §3 (`--font-display` Fraunces / `--font-serif` Instrument Serif / `--font-sans` Inter) — DO NOT load additional families |
| Motion durations + easings | `css/app.css` Layer 1 (lines 95-192) + BRAND.md §5 — DO NOT introduce new tokens |
| Empty-state recipes | Phase 14 / DECI-14-13 (D-11 empty-states) `css/app.css:4202` |
| Touch-target floor | 44px per BRAND §7 + Phase 27 / Phase 24 precedents |
| Voice + copy | BRAND.md §6 + this contract's Copywriting table |
| Accent reservation | this contract's "Accent reserved for" 7-item list — never expand without UI-checker re-approval |
| Surface placement | this contract's "Surface map" — sub-surface in Tonight, NOT a 6th tabbar button |
| Reduced-motion | BRAND.md §5 + `.pe-*` scoped override per Motion § |

---

## Pre-population trace

| Source | Decisions used in this contract |
|--------|----------------------------------|
| `28-CONTEXT.md` (16 decisions) | All 16 decisions consumed: D-01 (16-league always-on) → surface map; D-02 (polymorphic schema) → picker variants F1/UFC/soccer; D-03 (1pt flat) → leaderboard score line; D-04 (lock at gameStartTime) → locked-state visual + countdown; D-05 (tiebreaker = chronologically-latest in slate) → picker tiebreaker tag + sub-line; D-06 (T-15min push, then auto-zero) → push copy + missed-state visual; D-07 (standalone Pick'em surface + inline wp row) → surface map #1 + #4; D-08 (members only, no guests) → no guest UI in any surface; D-09 (soft pre-fill) → pre-fill chip ring + brand-voice sub-line; D-10 (real-time visibility) → inline wp row + leaderboard live update; D-11 (strSeason tagging) → leaderboard hero eyebrow; D-12 (hard reset + snapshot) → past-seasons archive surface #5; D-13 (mid-season-join forward-only) → "joined Week N of M" annotation; D-14 (zero-config) → no settings UI in any surface; D-15 (`js/pickem.js` ES module) → file plan in Design System §; D-16 (gameResultsTick) → settle-time animation timing |
| `BRAND.md` v1 (entire) | Color §2, Typography §3, Spacing §4, Motion §5, Voice §6, Screen patterns §7, Do/Don't gallery §8 — all consumed verbatim |
| `PROJECT.md` Out-of-Scope | "no public discovery / cross-family social feed" → leaderboard scope locked to `families/{code}/` (D-08 alignment) |
| `seeds/v2-watchparty-sports-milestone.md` | Phase 28 = old 28+29 merge → leaderboard is a derived view (drives surface map: leaderboard is sub-surface of Pick'em, not its own tab) |
| `css/app.css` (47-token semantic alias layer) | All token references in this contract resolved against this file; zero new tokens |
| `app.html` `.tabbar` (`#1385`) | 5-tab cap → Pick'em is sub-surface, not 6th tab |
| `app.html#cv15-pickup-container` (`#322`) | Sub-surface entry placement precedent → Pick'em entry sits in same vertical band on Tonight |
| User input during `/gsd-ui-phase 28` | (none required — all questions resolved by upstream artifacts) |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending — UI-checker validates against the 6 dimensions above

---

*Phase: 28-social-pickem-leaderboards*
*UI-SPEC drafted: 2026-05-02 via /gsd-ui-phase 28*
*UI-SPEC revision 1: 2026-05-02 — fixed Spacing § 14px → `--space-stack-sm` (12px) per UI-checker BLOCK; added Typography § brand-inheritance note*
*Cache-bump target on deploy: `couch-v40-pickem` (per CONTEXT Specifics)*
