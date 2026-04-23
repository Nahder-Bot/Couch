# Phase 9 Marketing Screenshot Production Pipeline

Capture + frame + optimize + commit procedure for the App-Store-ready marketing asset set. Every future refresh (new features, rebrand, App Store submission) reruns this playbook.

## Required assets (5)

| # | Filename | Screen | Key elements | Notes |
|---|----------|--------|-------------|-------|
| 1 | `tonight-hero.png` | Tonight | who-mini strip, picker card with 3+ member chips, mood filter chip, poster row with at least 4 posters | HERO SHOT — most-visited surface. Everything must feel alive (real votes, real moods). |
| 2 | `watchparty-live.png` | Watchparty live modal (during active session) | Participant timer strip with 3+ participants, reaction palette visible, one recent reaction bubble above the feed | Requires an active watchparty; capture on the "starter" phone with 2 other devices joined. |
| 3 | `mood-filter.png` | Tonight with mood filter applied | Active mood row showing 2-3 moods (e.g. "cozy", "short", "action"), filtered poster row showing narrower results vs `tonight-hero.png` | Contrasts with #1 to communicate filtering |
| 4 | `title-detail.png` | Title detail modal | Poster hero, title + year, providers row, mood pills visible, vote grid (Yes/Maybe/No) with at least one vote cast | Pick a title with rich metadata (lots of moods, multiple providers) |
| 5 | `intent-rsvp.png` | Intent RSVP modal | "Tonight at 9pm" card with 3+ member RSVPs (mix of Yes/Maybe/No) | Captures the Phase 8 differentiator — the "drop a pick, others RSVP" path shown on the landing's "Two ways to couch" section |

## Optional / Stretch assets (3)

| # | Filename | Screen | Dependency | Notes |
|---|----------|--------|------------|-------|
| 6 | `year-in-review.png` | YIR teaser card on Tonight OR first real YIR screen from Phase 10 | **Phase 10 (YIR) ships** | **Deferred per Major-6 checker closure.** Phase 10 has not shipped any YIR UI — capturing a placeholder contradicts "App-Store-ready". Capture this during Phase 10 execution using the same pipeline (rerun this doc). |
| 7 | `watchparty-desktop.png` | Watchparty live on desktop (≥900px viewport) | Plan 09-04 shipped ✓ | Proves the responsive expansion works; 2560x1440. Stretch — not required for DESIGN-06 closure. |
| 8 | `invite-redeem.png` | Guest invite redemption screen | Plan 09-07b ships the redemption UI | Deferred until 09-07b lands; rerun pipeline then. |

## Capture pipeline

### Step 1 — Capture raw screenshots

**Preferred: physical iPhone 14/15 Pro running the standalone PWA.**
- Launch installed PWA from home screen (couchtonight.app, installed via Share → Add to Home Screen).
- Set up the scenario in the app (cast a few votes, join a watchparty, etc.). Use the same dev family with realistic content.
- Take screenshots with iPhone (volume up + side button). Raw output is 1170x2532 (iPhone 14 Pro) or 1290x2796 (15 Pro Max — rescale in step 2).
- Transfer via AirDrop or iCloud. DO NOT use screen mirroring to capture (quality degrades).

**Fallback: Chrome DevTools iPhone 14 Pro simulation.**
- DevTools → Toggle device toolbar → "iPhone 14 Pro" → 393x852 viewport at 3x DPR (captured 1179x2556).
- Navigate to `https://couchtonight.app/app`, sign in on the dev family, set up each scenario.
- Three-dot menu in DevTools → "Capture full-size screenshot" or "Capture screenshot".
- Raw resolution may differ from 1170x2532 — resize to 1170x2532 exactly in step 2 or the frame tool.

### Step 2 — Clean + resize raw captures

- Crop out the iOS status bar area (time / battery / reception icons) OR use AppScreens' built-in status bar removal.
- If raw output isn't exactly 1170x2532, resize with an image editor (preserve aspect ratio; pad with `#14110f` background if the source aspect differs).

### Step 3 — Frame + caption in AppScreens.com

1. Visit https://appscreens.com (no account needed for basic exports).
2. Upload raw screenshot.
3. Select iPhone 15 Pro device frame (Titanium Black variant — closest to the warm dark aesthetic).
4. Optional: add a one-line caption above the frame (e.g. "Tonight, together"). Keep typography subtle — Inter 400, 32px, ink-warm color.
5. Background: use `#14110f` solid OR a subtle brand gradient (color stops `#e8a04a` → `#d97757` → `#8b3a4e` at 8% opacity overlay).
6. Export at full App-Store resolution (1242x2688 or 1170x2532 depending on template). We pick 1170x2532 for the committed files.

**Alternative: AppLaunchpad.com** — same workflow, slightly different template library. Use if AppScreens has rate-limits.

### Step 4 — Optimize

- Run each PNG through https://squoosh.app (free, browser-based) with "OxiPNG" effort level 4 OR ImageOptim locally.
- Target: under 400KB per screenshot. If a file is over, reduce frame-background gradient fidelity or crop unneeded padding.

### Step 5 — Commit to sibling queuenight/public/marketing/

- Create `queuenight/public/marketing/` if missing: `mkdir -p /c/Users/nahde/queuenight/public/marketing`
- Copy all 5 required optimized PNGs with their canonical filenames into that directory.
- **Note:** `queuenight/` is a deploy mirror (not a git repo). Assets land there without a commit step; they ship on the next `firebase deploy --only hosting`.
- Do NOT commit to THIS repo.
- If/when optional assets are captured (Phase 10 for YIR, post-09-07b for invite-redeem, opportunistic for desktop watchparty): rerun this pipeline and drop additional files.

## OG image (1200x630) production

The landing page references `/og.png` for link previews.

- Composition: vertical split layout. LEFT half: wordmark (Couch, 200px height) + tagline ("Who's on the couch tonight?" Instrument Serif italic 28px) on warm dark background. RIGHT half: `tonight-hero.png` in an iPhone 15 Pro frame, rotated slightly (5 degrees) for dynamic feel.
- Tool: AppScreens "social preview" template OR any design tool the user has (Figma, Canva, Photopea browser-based).
- Export 1200x630 PNG. Optimize via squoosh to under 300KB.
- Drop into `queuenight/public/og.png` (root, not under `marketing/`).

## Acceptance (Phase 9 DESIGN-06 closure)

- 5 required PNGs in `queuenight/public/marketing/` at 1170x2532 each
- 1 `og.png` in `queuenight/public/` at 1200x630
- All files under the 400KB / 300KB budgets
- All filenames match the required table above (lowercase hyphen-separated)
- `landing.html` references updated to use the 5 real images (plan 09-06 task 3)
- iMessage / Slack / Twitter preview tests pass post-deploy

Optional assets do NOT block Phase 9 closure. They are tracked here so the pipeline can be rerun when their blocking dependencies resolve.

## Refresh cadence

- On every brand refresh (new logo, new palette) — rerun all 5 required captures + og composite
- On every new feature visible in a screenshot surface — re-capture affected frames only
- When Phase 10 ships YIR UI — capture asset #6 and add it to the landing grid
- When plan 09-07b ships invite redemption — capture asset #8 and (optionally) add to grid
- Annual "state of the product" refresh is a reasonable default

## Anti-patterns (do NOT do)

- Do NOT hand-build screenshot frames in HTML/CSS + Playwright. It is tempting (in-repo, reproducible) but will eat days of CSS tuning. Stick with AppScreens.
- Do NOT add App Store captions like "Free forever!" — contradicts "Warm, Cinematic, Lived-in. Restraint is the principle."
- Do NOT use motion-blur or over-saturated color grading in the frames. The raw warm-dark app palette IS the mood.
- Do NOT auto-rotate multiple frames inside one asset (parallax gallery). One screenshot per PNG. Clean.
- Do NOT include a placeholder YIR screenshot captured against Phase 9 mock UI — wait for real Phase 10 surfaces. The required set is only 5 for exactly this reason (Major-6 checker closure).

## Notes

- Current deploy layout post-plan-09-05: `landing.html` at `/`, `app.html` at `/app`. Marketing assets served from `/marketing/*` path. OG image at `/og.png`.
- If AppScreens changes its free-tier limits, fall back to AppLaunchpad. Both produce identical output quality for our use case.
- No Figma license assumption — everything here is browser-based + free.
- Existing brand assets in `queuenight/public/` (appstore-1024.png, mark-*.png sizes, logo-h*.png sizes, favicon-*.png) are already shipped and don't need rebuilding. This plan only produces the 5 app-screenshot marketing set + og.png composite.
