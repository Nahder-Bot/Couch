---
created: 2026-04-25
purpose: drift audit of the 5 landing-page marketing screenshots vs. current production UI
audit_method: file-mtime vs commit history (no manual side-by-side comparison)
---

# Marketing Screenshot Drift Audit

## Verdict: SIGNIFICANT DRIFT — recapture all 5 before public announcement

**Screenshots last captured:** 2026-04-23 (Phase 9 Plan 09-06 production pipeline).
**Production UI today:** 8 phases of changes since (Phase 11's eight plans + Phase 12's three plans).

The screenshots represent the app as it was at landing-page first-deploy, not as it is now. Friends-and-family won't notice. Public announcement traffic will, because the screenshots will look slightly different from what they see when they install.

## Per-screenshot drift assessment

| File | Captured | What it shows (per landing.html alt) | Drift | Why |
|------|----------|--------------------------------------|-------|-----|
| `tonight-hero.png` | 2026-04-23 | Tonight: picker card with member chips, watchparty banner, intent card, mood filter | **HIGH** | Plan 11-01 tightened mood chip spacing, hid "whose turn to pick" surface, redesigned "who's on the couch" card to denser format |
| `watchparty-live.png` | 2026-04-23 | Watchparty live: participant timer, reactions feed, spoiler delay, message input | **HIGH** | Plans 11-05 (lobby + catch-me-up + post-session) + 11-06 (sports mode score strip + amplified reactions + DVR slider) materially changed the watchparty surface |
| `mood-filter.png` | 2026-04-23 | Cozy mood narrowing the poster row | **MEDIUM** | Plan 11-01 mood chip spacing changes |
| `title-detail.png` | 2026-04-23 | Poster, runtime, genres, mood pills, vote grid, trailer card | **LOW-MEDIUM** | Less directly affected, but Phase 11 token refinements may have touched it |
| `intent-rsvp.png` | 2026-04-23 | RSVP card with Yes/Maybe/No and member responses | **MEDIUM** | Plans 11-04 (Web RSVP route) + 11-05 (lobby Ready check) changed the intent/RSVP surface |

## Recommendation

**Before public announcement:** recapture all 5 from current production.

**For friends-and-family soft launch:** acceptable as-is. Drift is cosmetic, not misleading.

## Capture pipeline (from Phase 9 Plan 09-06)

The original capture pipeline doc is at `.planning/phases/09-redesign-brand-marketing-surface/09-06-PRODUCTION-DOC.md` (or similar — the `d958dcf` commit). Key requirements from that pipeline:

- Capture at iPhone 14 Pro / 15 Pro viewport (1170×2532px) — matches the `aspect-ratio: 1170 / 2532` in `css/landing.css`
- Use Chrome DevTools device toolbar with iPhone preset
- Sign in with a real-looking family account (not "Test User") so the people chips look natural
- Use a watchparty in the right state for `watchparty-live.png` — needs ≥2 participants visible
- Drop captures into `queuenight/public/marketing/` (NOT in main repo per `e91adbd`-style hosting-mirror separation)
- No deploy step needed — they're served at `https://couchtonight.app/marketing/<file>` automatically

## Quick win during recapture

Take an `og.png` re-shot at the same time. The current `og.png` (1200×630) is fine but if you're recapturing anyway, an updated hero shot for social previews is worth it.

## Defer-OK alternative

If recapture is too much friction pre-soft-launch, hide the screenshot grid temporarily by adding `display: none` to `.screenshot-grid` in `css/landing.css`. Cleaner than shipping stale shots. ~1 line change. Restore when shots are ready.

## Status

- [ ] tonight-hero.png — HIGH drift, recapture
- [ ] watchparty-live.png — HIGH drift, recapture
- [ ] mood-filter.png — MEDIUM drift, recapture
- [ ] title-detail.png — LOW-MEDIUM drift, defer-OK
- [ ] intent-rsvp.png — MEDIUM drift, recapture
- [ ] og.png — LOW drift, defer-OK

Tracked in TECH-DEBT.md as deferred work.
