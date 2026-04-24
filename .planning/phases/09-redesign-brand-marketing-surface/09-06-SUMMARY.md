---
phase: 09-redesign-brand-marketing-surface
plan: 06
subsystem: marketing
tags: [marketing, screenshots, landing, css, image-optimization, sharp]

# Dependency graph
requires:
  - phase: 09-redesign-brand-marketing-surface/05
    provides: landing.html with screenshot-grid placeholder section + css/landing.css with .screenshot-card scaffold
provides:
  - 5 marketing PNG assets at /marketing/{tonight-hero,watchparty-live,mood-filter,title-detail,intent-rsvp}.png
  - landing.html with 5 real <figure>+<img>+<figcaption> entries replacing 4 placeholders
  - css/landing.css updated: aspect-ratio 1170/2532, iPhone-frame-via-CSS treatment (border-radius 32px + multi-layer shadow + warm hover lift), figcaption gradient overlay, grid 2/3/5 col responsive
  - sharp installed in user temp dir for future image optimization
  - marketing-screenshot-plan.md production playbook (committed in d958dcf earlier)
affects: [phase-12-deferred-and-future, social-link-previews]

# Tech tracking
tech-stack:
  added: [sharp (image optimization, npm install in /c/Users/nahde/AppData/Local/Temp/img-opt/)]
  patterns:
    - "CSS-only phone-frame treatment (border-radius + box-shadow + bezel illusion) as alternative to external device-frame tools"
    - "Sharp via npm-temp-install for one-off image optimization tasks"
    - "Marketing source files archived OUTSIDE public/ at queuenight/marketing-source/ to prevent accidental deploy of duplicates"

key-files:
  created:
    - "queuenight/public/marketing/tonight-hero.png (330KB)"
    - "queuenight/public/marketing/watchparty-live.png (305KB)"
    - "queuenight/public/marketing/mood-filter.png (346KB)"
    - "queuenight/public/marketing/title-detail.png (171KB, optimized from 2.3MB)"
    - "queuenight/public/marketing/intent-rsvp.png (205KB, was mislabeled title-detail)"
  modified:
    - "landing.html (5 figure entries replaced placeholders)"
    - "css/landing.css (.screenshot-card phone-frame treatment + grid breakpoints + figcaption)"
  archived:
    - "queuenight/marketing-source/ (7 raw originals preserved outside public/)"

key-decisions:
  - "Path A (CSS-only phone-frame) chosen over external device-frame tools (AppScreens/MockUPhone/Screenhance). User reported AppScreens UX was confusing in 2026; CSS treatment ships the 'floating phone' aesthetic without any external tool dependency. Trade-off: lower fidelity than a real iPhone frame illustration; upgradeable later by overwriting the same files."
  - "title-detail.PNG raw was 2.3MB — way over Lighthouse budget. Optimized via sharp (PNG palette mode, compression level 9, quality 85) to 171KB at 660x1434. Aspect ratio preserved; visual quality acceptable."
  - "Mislabeled file resolved: 'title-detail (2).PNG' was actually the intent-rsvp modal (Super Mario Galaxy Friday 9PM Yes/Maybe/No). Renamed accordingly."
  - "Hero shot picked from 3 candidates: 'Can't remember whichone this is.PNG' chosen because it shows the most product surfaces simultaneously (picker + active watchparty + intent + members + moods + tabbar)."
  - "og.png deferred to ship with wordmark redesign per user direction. Existing 172KB og.png from April 15 still serving link previews; functional but uses dated wordmark."
  - "Filenames lowercased to .png — Firebase Hosting is case-sensitive (Linux); .PNG would 404 against landing.html .png references."
  - "Source files archived to /c/Users/nahde/queuenight/marketing-source/ (outside public/) to preserve originals without bandwidth cost."

patterns-established:
  - "Marketing-asset workflow: capture (iPhone preferred) → optimize via sharp if needed → drop in marketing/ as lowercase .png → CSS-frame via .screenshot-card class → mirror to deploy → preview channel for review → production deploy"
  - "Preview channel deploys via 'firebase hosting:channel:deploy <name> --expires Nd' — gives a temporary public URL for review without touching production. Sidesteps file:// rendering issues entirely."
  - "Source-vs-deploy separation: keep raw captures + alternates in queuenight/marketing-source/ (NOT public/) — preserves them as backup, prevents accidental publication"

requirements-completed: [DESIGN-06]

# Metrics
duration: ~45min (capture + organize + optimize + wire + preview + deploy)
completed: 2026-04-23
---

# Phase 9 / Plan 06: Marketing screenshots — DESIGN-06 closure Summary

**5 iPhone screenshots wired into landing with CSS phone-frame treatment, deployed to couchtonight.app. og.png deferred to ship with wordmark redesign.**

## Performance

- **Started:** 2026-04-23 (user dropped raw screenshots)
- **Completed:** 2026-04-23T22:15Z
- **Total time:** ~45 minutes wall-clock

## What shipped

5 PNG marketing assets at `https://couchtonight.app/marketing/`, all returning HTTP 200, all under the 400KB Lighthouse budget:

| File | Size | Content |
|---|---|---|
| `tonight-hero.png` | 330KB | Tonight screen — picker card + Knicks watchparty banner + intent card + 7-member who-list + mood filter + tabbar |
| `watchparty-live.png` | 305KB | Knicks-Hawks live, 2:32:10 elapsed, recent reactions (😭 🥹 "Hey"), Pause/Hide/Real-time/End controls, Delay 5/15/30s palette, message input |
| `mood-filter.png` | 346KB | Tonight with Cozy mood active, narrowing 3 → 2 matches (Super Mario Galaxy + Invincible) |
| `title-detail.png` | 171KB | Super Mario Galaxy: poster + 2026 Movie 88min + Family/Comedy/Adventure/Fantasy/Animation tags + Funny/Action/Cozy moods + synopsis + trailer card. Optimized via sharp from 2.3MB raw. |
| `intent-rsvp.png` | 205KB | Tonight @ 9PM RSVP modal: Super Mario Galaxy Movie, Friday 9:00 PM, Proposed by Nahder, Yes/Maybe/No buttons, Nahder voted Yes, Cancel/Close |

## Wiring (Path A: CSS-only phone-frame, no external tool)

`landing.html`:
- Replaced 4 `<div class="screenshot-placeholder">` entries with 5 `<figure class="screenshot-card">` entries
- Each `<figure>` contains `<img loading="lazy" width="1170" height="2532" alt="...">` + `<figcaption>` label
- Alt text describes each shot's content for a11y + SEO
- Explicit width/height prevents layout shift during image load

`css/landing.css`:
- `.screenshot-card` aspect-ratio: `1170 / 2532` (exact iPhone reference resolution)
- `border-radius: 32px` mimics iPhone corner curvature
- Multi-layer `box-shadow`: ambient drop (-16px Y, 40px blur, 55% black) + warm-amber glow (-8px Y, 14px blur, 10% accent) + inner light bezel (1px white-warm at 4% opacity)
- `:hover`: lift `-2px` + intensified glow (60% black drop + 18% accent glow + 6% inner light)
- `figcaption`: bottom-up dark gradient overlay (rgba(20,17,15,0.92) → 0 over 60% height), Instrument Serif italic 14px, ink-warm color
- Grid breakpoints: 2 col mobile / 3 col @ 900px / 5 col @ 1200px (was 2 / 4)
- Old `.screenshot-placeholder` rule removed — no remaining target

## Deviations from plan

1. **Path A instead of AppScreens framing.** User reported AppScreens was confusing in its current 2026 UI. CSS-only frame treatment chosen as alternative — ships the "floating phone screen" aesthetic via border-radius + box-shadow without any external tool. Lower fidelity than a real device illustration; upgradeable later by overwriting the same files via Screenhance/MockUPhone/Claude Design.

2. **og.png deferred.** Plan task 1 spec called for a 1200×630 wordmark + tonight-hero composite. User chose to defer until wordmark redesign lands so og.png ships with the new brand. Existing 172KB og.png (April 15, dated wordmark) still serves link previews — functional but stale. Tracked in Phase 12 docket.

3. **YIR screenshot not in v1 grid (planned).** Per Major-6 checker closure: capturing a placeholder YIR contradicts "App-Store-ready". Confirmed; not a deviation, the original plan explicitly marked this.

4. **Source-archive pattern introduced.** Plan didn't specify what to do with raw originals or duplicate captures. Created `/c/Users/nahde/queuenight/marketing-source/` (outside public/) to preserve 7 source files (Can't-remember-whichone, the 2.3MB title-detail raw, mislabeled title-detail-(2), 2 alt tonight-hero variants, mood-filter, watchparty-live). Pattern: source files outside deploy path, canonical files inside deploy path with normalized lowercase .png names.

5. **sharp installed for image optimization.** Plan didn't anticipate needing local image optimization (assumed user would handle in squoosh.app). Title-detail at 2.3MB warranted in-tooling fix; sharp installed via `npm install` in user temp dir, optimized 2.3MB → 171KB in one pass. Now available for future image work.

## Verification

Post-deploy automated probes (all passing):

```
200  /marketing/tonight-hero.png  (330KB)
200  /marketing/watchparty-live.png  (305KB)
200  /marketing/mood-filter.png  (346KB)
200  /marketing/title-detail.png  (171KB)
200  /marketing/intent-rsvp.png  (205KB)
```

Landing page references all 5 (via curl + grep):
```
/marketing/intent-rsvp.png
/marketing/mood-filter.png
/marketing/title-detail.png
/marketing/tonight-hero.png
/marketing/watchparty-live.png
```

User-approved manual verification via Firebase preview channel (`https://queuenight-84044--preview-09-06-screenshots-l0jvk58c.web.app`) before production deploy.

## Long-term refresh

User noted "long term pick better picks" — captured in Phase 12 docket as "Marketing screenshot refresh — opportunistic." Refresh triggers: brand wordmark redesign, major new features (Sports Game Mode, YIR), or simply more visually-loaded captures of existing surfaces. Original raw captures preserved at `queuenight/marketing-source/` for reference; production playbook at `marketing-screenshot-plan.md` is rerunnable.
