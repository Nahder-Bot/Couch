# Accessibility audit (light) — Couch

## Target WCAG level

**Target: WCAG 2.2 Level AA.** Realistic floor; required by Apple/Google app stores, US Section 508, EU EAA (June 2025). AAA as stretch on core reading surfaces (titles, chat). Key new 2.2 criteria:
- **2.4.11** Focus Not Obscured (baseline)
- **2.5.8** Target Size 24×24 CSS px min (go with Apple HIG 44×44 as product bar)
- **3.3.8** Accessible Authentication

Source: [W3C Understanding WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/).

## Palette analysis (computed against `#14110f` theme)

| Foreground | Ratio | AA body (4.5:1) | AA large/UI (3:1) | AAA body (7:1) |
|---|---|---|---|---|
| Orange `#e8a04a` | **~8.9:1** | PASS | PASS | PASS |
| Velvet red `#c54f63` | **~4.3:1** | **FAIL** | PASS | FAIL |
| White `#ffffff` | ~19.7:1 | PASS | PASS | PASS |

**Findings:** Orange accent is excellent on warm-dark; safe for body text + icons. **Velvet red fails AA for normal body text by ~0.2 ratio points.** Safe only for headings ≥18pt (or ≥14pt bold), icon strokes ≥3px, non-text UI (badges, pill backgrounds with white text on red). Never use `#c54f63` for paragraph text, captions, timestamps, metadata. Either brighten to ~`#d66478`+ (gets to ~5.0:1) or strictly reserve for decorative/large-text roles.

## Serif typography analysis

Fraunces and Instrument Serif are both **display-intent**. Fraunces' designers flag that "below 14px it's a bit critical and almost too delicate." Section 508 guidance recommends sans-serif for sustained reading.

**Verdict:** Fraunces/Instrument for movie titles, section headers, hero moments (≥20px, italic ≥24px). Inter for everything ≤16px — chat bubbles, metadata, buttons, form fields, toasts. Italic serif never below 18px — italics compound the legibility hit for dyslexic readers.

## Multi-generational usage

- **Grandparents 60+:** ~30% have contrast/acuity loss. Need `prefers-reduced-motion`, Dynamic Type / font scaling up to 200% without layout break (WCAG 1.4.4), 44×44 tap targets per Apple HIG.
- **Young children (pre-reader):** emoji + iconography carry the load. Icons must have text labels, not be the sole affordance.
- **Color-blind members (~8% males):** orange/red duo is risky — deuteranopia/protanopia compress orange-red. **Never encode meaning in red-vs-orange alone** (e.g., "available" vs "watched"). Pair with icon or text.

## Emoji reactions

Emoji have default screen-reader names ("face with tears of joy") that diverge from user intent ("LOL"). For reaction buttons:
```html
<span role="img" aria-label="laughing reaction">😂</span>
```

Per [Léonie Watson — Accessible Emoji](https://tink.uk/accessible-emoji/). Decorative inline emoji should be `aria-hidden="true"` if redundant to text. Never rely on emoji alone for required info — pair with text, provide non-emoji fallback for counts ("3 reactions" not just "3 😂").

## Five concrete Phase 9 improvements

1. **Retire velvet red `#c54f63` from all text <18px.** Shift to `~#d66478`/brighter for body usage OR strictly scope to ≥20px headings, filled-button backgrounds (white-on-red = AAA), non-text accents. Re-test every text/bg pair in [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/).
2. **Serif ≥20px, italic ≥24px, Inter everywhere else.** CSS custom properties (`--font-display` vs `--font-ui`) to enforce the split. Support Dynamic Type — `rem`/`em` never `px` for text. Test at 200% zoom.
3. **Tap targets ≥44×44 CSS px** for reactions, nav, close buttons, emoji picker cells. 2.5.8 floor is 24×24; HIG 44×44 is the product bar. ≥8px spacing between adjacent targets.
4. **Accessible reaction markup:** `role="img" aria-label="{contextual name}"` per emoji button, `aria-pressed` for toggle state, visible focus ring (≥3:1 against bg), text count that reads independently ("2 love, 1 laugh").
5. **Redundant encoding for state:** any color-only signal (watched, upcoming, hosting, unread) gets icon + text companion. Validate with Chrome DevTools > Rendering > Emulate vision deficiencies. Honor `prefers-reduced-motion` + `prefers-contrast: more`.

## Sources

- [W3C WCAG 2.2](https://www.w3.org/WAI/WCAG22/Understanding/), [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [Apple HIG Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Section508.gov Fonts](https://www.section508.gov/develop/fonts-typography/)
- [Pimp my Type — Fraunces review](https://pimpmytype.com/font/fraunces/)
- [Léonie Watson — Accessible Emoji](https://tink.uk/accessible-emoji/)
