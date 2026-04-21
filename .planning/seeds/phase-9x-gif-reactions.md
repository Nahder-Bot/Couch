---
seeded: 2026-04-22
target-phase: 9.x (Redesign polish OR a dedicated sub-phase — NOT Phase 7)
trigger: "Phase 7 planning (2026-04-22) — user asked about GIF reactions. Deferred to avoid expanding Phase 7 scope + because brand-fit warrants a design-phase discussion, not a bolt-on."
related: [phase-07-watchparty-lifecycle-transitions.md]
---

# Phase 9.x seed — GIF reactions in watchparty

## Why this isn't in Phase 7

Phase 7 ships emoji reactions (PARTY-04/05) with a curated 8-emoji palette + a "+ more" native picker for unlimited emoji. That satisfies the requirement language ("reactions (emoji or preset set)") and keeps Phase 7 focused on lifecycle + discoverability.

GIFs are a meaningfully different feature:

1. **Third-party integration** — needs GIPHY or Tenor API key + wired client code
2. **Data model change** — reactions today are `{emoji: string, memberId, at}`; GIFs need `{type: 'gif' | 'emoji', content: string | {url, title, mp4Url}, memberId, at}` or similar discriminated union
3. **Moderation** — both GIPHY and Tenor support content-rating parameters (`g` / `pg` / `pg-13` / `r`). Family-safe default with owner-configurable override is a real design question
4. **Bandwidth** — GIFs are 500KB–5MB each; MP4 preferred (same content, ~10× smaller). Renders via `<video autoplay loop muted playsinline>`
5. **Brand fit** — PROJECT.md design principle: "Warm · Cinematic · Lived-in. Restraint is the principle." Chaotic GIF aesthetic clashes with the warm-dark cinematic mood. Worth design attention, not a bolt-on

## Recommended provider: Tenor (Google) or GIPHY

**Tenor (Google-owned):**
- Free tier: unlimited API calls with attribution
- Better content rating granularity — explicit `contentfilter=high|medium|low|off`
- Google backing means long-term availability more certain
- API keys are free via the Google Cloud Console

**GIPHY (Meta-owned):**
- Free tier: 1000 req/hour for production apps (more than enough)
- Larger catalog / better branded-sticker library
- Content rating: `g`/`pg`/`pg-13`/`r` at search time
- Prior API-change history — slight platform risk

**Recommendation:** Tenor. Content filter is cleaner, Google alignment simpler, our existing Firebase infra is already Google.

## Data model proposal

```
// Before (Phase 7):
{ id, memberId, memberName, emoji, at, elapsedMs }

// After (GIF reactions):
{
  id, memberId, memberName, at, elapsedMs,
  type: 'emoji' | 'gif',
  emoji?: '🎉',                               // if type === 'emoji'
  gif?: { url, mp4Url, title, w, h, provider: 'tenor' }  // if type === 'gif'
}
```

**Migration:** existing reaction docs default to `type: 'emoji'` when reading. Forward-compatible — new clients render old reactions correctly.

## UX proposal

- Keep the 8-emoji palette + "+ more" picker from Phase 7 unchanged.
- Add a **GIF** button (animated icon?) as the LAST cell in the palette row.
- Tap opens a GIF search modal with:
  - Search input (auto-focus, autocomplete off)
  - Recent/trending strip at top
  - Search results grid (2 columns on mobile, 4 on desktop)
  - Thumbnail uses Tenor's `tinygif` format (smallest preview)
  - Tap a GIF → insert as reaction + close modal
- Render in the reaction feed with `<video>` (MP4) not `<img>` (GIF) for perf.

## Moderation decisions needed

- **Default content filter:** `high` (equivalent of G / PG) family-safe default
- **Owner override:** Settings → Watchparty → "Allow edgier GIFs" toggle (off by default), sets filter to `medium` for that family
- **Report / hide** — per-reaction report button, auto-hide after 3 reports by different members within 24h, alert owner

## API-key exposure

Tenor API keys are client-side by design per their docs (same posture as TMDB_KEY and Firebase web config). No CF proxy needed. Matches our PROJECT.md "public-by-design" constraint.

## Estimate

~6 hours including UAT:
- 1h data model + back-compat read path
- 1.5h Tenor API integration + search modal UI
- 1h MP4 rendering in reaction feed
- 1h moderation + content filter wiring
- 1h Settings surface for family-level override
- 0.5h seed + commit discipline

## Success criteria

- User can send a GIF reaction during a watchparty; other family members see it animate within 2s
- Content filter defaults to family-safe; owner can relax it per family
- Existing emoji reactions continue to render (back-compat)
- No significant bandwidth regression (single reaction stays <200KB via MP4 format)
- Reactions still attributable (writeAttribution applied)

## Decision open for future discuss-phase

- Should GIFs be rate-limited per member (e.g., max 5 per session) to prevent spam?
- Should GIFs be saved to family-wide "favorites" for re-use, or are they session-only?
- Does the Watchparty reaction UX extend to other surfaces (e.g., Title Detail comments), or is it watchparty-only?

These shape the full feature. Revisit at discuss-phase time.
