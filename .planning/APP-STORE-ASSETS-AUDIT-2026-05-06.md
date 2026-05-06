# App Store / Play Assets Audit (Phase 17 Prep)

*Authored 2026-05-06 during launch-prep autonomous work.*

## Finding

**Source repo (`C:\Users\nahde\claude-projects\couch\`) contains zero brand or marketing assets** at the repo root or in any conventional folder (`brand/`, `marketing/`, `assets/`, `static/`, `public/`).

Verified via Bash + Glob:
- No `mark-*.png` (icon set referenced in `app.html:38-52` manifest + favicons)
- No `logo-*.png` (wordmark referenced in `landing.html:138`, `app.html:218,277,242`)
- No `og.png` (referenced in `landing.html:16`, `changelog.html:17`)
- No `favicon.ico` (referenced in `landing.html:23`, `app.html:38`, `changelog.html:27`, `rsvp.html:10`)
- No `brand/` or `marketing/` folders

**Where the assets actually live:** the sibling `couch-deploy` mirror repo (`${COUCH_DEPLOY_PATH:-../../couch-deploy}/public/`). `scripts/deploy.sh` mirrors source files INTO that location at deploy time, but the static binary assets only ever lived there.

**Implication for Phase 17:** PWABuilder (selected via spike 001 as the v1 native-wrapper) reads from a deployed PWA URL (`https://couchtonight.app`) — it doesn't need source-side assets. BUT App Store + Google Play require additional assets that the live PWA doesn't expose (1024×1024 marketing icon, App Preview video, device-class screenshots in specific dimensions). Those need a single canonical location.

## Required asset matrix

### Apple App Store (iOS)

| Asset | Dimensions | Purpose | Status |
|---|---|---|---|
| App Icon — Marketing | 1024×1024 | App Store Connect listing | **MISSING** (existing `mark-512.png` is 50% too small) |
| App Icon — iPad Pro (12.9") | 167×167 | Home screen | Need verify in mirror |
| App Icon — iPad (any) | 152×152 | Home screen | Need verify in mirror |
| App Icon — iPhone | 180×180 (@3x), 120×120 (@2x) | Home screen | Mirror has 180×180 |
| App Icon — Settings | 87×87 (@3x), 58×58 (@2x), 29×29 (@1x) | Settings app | Likely missing |
| App Icon — Spotlight | 120×120 (@3x), 80×80 (@2x), 40×40 (@1x) | Spotlight search | Likely missing |
| App Icon — Notification | 60×60 (@3x), 40×40 (@2x), 20×20 (@1x) | Notification banner | Likely missing |
| Screenshots — iPhone 6.9" (16 Pro Max) | 1320×2868 | Listing | **NEEDS CAPTURE** (Phase 31 produces 1170×2532) |
| Screenshots — iPhone 6.7" (15 Pro Max) | 1290×2796 | Listing | NEEDS CAPTURE |
| Screenshots — iPhone 6.5" (XS Max) | 1242×2688 | Listing | NEEDS CAPTURE |
| Screenshots — iPhone 5.5" (8 Plus) | 1242×2208 | Listing | NEEDS CAPTURE |
| Screenshots — iPad Pro 13" | 2064×2752 | Listing | NEEDS CAPTURE (skippable for v1 if iPad-not-supported) |
| Screenshots — iPad Pro 12.9" | 2048×2732 | Listing | NEEDS CAPTURE (skippable for v1) |
| App Preview Video | 1080×1920 (or matching screenshot dimensions), .mov/.mp4, 15-30s, ≤500MB | Listing | **MISSING** — Phase 17 produces |
| Privacy Manifest | `PrivacyInfo.xcprivacy` (XML) | Bundle | MISSING — Phase 17 authors |

### Google Play (Android)

| Asset | Dimensions | Purpose | Status |
|---|---|---|---|
| App Icon — Hi-res | 512×512 | Play Store listing | Mirror has — verify |
| Adaptive Icon — Foreground | 432×432 PNG (within 108dp safe zone) | Modern Android home | **MISSING** |
| Adaptive Icon — Background | 432×432 PNG (solid color or pattern) | Modern Android home | **MISSING** |
| Feature Graphic | 1024×500 | Play Store hero banner | **MISSING** |
| Screenshots — Phone | 1080×1920+ (any 16:9 portrait, 320-3840 long edge) | Listing | NEEDS CAPTURE (Phase 31's 1170×2532 may pass) |
| Screenshots — Tablet 7" | 1024×1600+ | Listing | Skippable for v1 |
| Screenshots — Tablet 10" | 1920×1200+ | Listing | Skippable for v1 |
| Promo Video | YouTube URL (not uploaded directly) | Listing | OPTIONAL — defer to v2 |
| Data Safety Form | (web UI in Play Console, not file) | Listing | Phase 17 authors |

### Phase 31 (already in flight) — landing-page screenshots

5 screenshots at 1170×2532 (iPhone 14 Pro PWA standalone) per `31-CONTEXT.md` D-05. **Those don't satisfy App Store screenshot requirements** — Apple wants device-specific dimensions (6.9", 6.7", 6.5", 5.5"). Phase 17 needs a separate capture pass per device class.

**Optimization:** capture once at the highest dimension (iPhone 16 Pro Max 1320×2868) and downscale to the others via sharp. Saves time vs. capturing on each device.

## What's currently working

✓ `mark-{16,32,48,96,128,144,180,192,384,512}.png` exist in the deploy mirror per `app.html` manifest references — confirmed by curl earlier in the session (live at `https://couchtonight.app/mark-512.png` etc.)
✓ `logo-h300.png` and `logo-h200.png` exist per `app.html:218,242,277` references
✓ `favicon.ico` exists per landing.html / app.html references
✓ `og.png` referenced from landing/changelog/og:image — but Phase 31 / D-23 calls for full visual refresh of this anyway
✓ `apple-touch-icon` declarations cover 128/144/152/180 per `app.html:49-52`

## What's missing for Phase 17

1. **`mark-1024.png`** — generate from canonical SVG (Phase 15.3 dependency!). Without the canonical SVG, the existing PNG set can't be cleanly rescaled to 1024 without artifacts. Phase 15.3 (SVG logo + wordmark sources, currently scoped-deferred) becomes a soft-dependency.
2. **iOS device-icon set** at 87/58/29/120/80/40/60/40/20 — generate from same canonical SVG
3. **Android adaptive-icon foreground + background** at 432×432 — separate compositing decision (logo on transparent foreground, theme color on solid background — likely `#14110f`)
4. **Feature Graphic** 1024×500 — new asset; lean on og.png treatment for v1
5. **Device-specific App Store screenshots** — capture pass after Phase 31 marketing screenshots
6. **App Preview video** 15-30s — captures the user journey from sign-in → tonight → spin → watchparty join
7. **Privacy Manifest** XML — author from data-collection survey (see PRIVACY-TERMS-AUDIT-2026-05-06.md)

## Recommendation: Phase 15.3 promotion (REVISED 2026-05-06)

Phase 15.3 (DESIGN-01) was originally deferred per LAUNCH-REVIEW §6 P2 list ("Cosmetic; PNGs work fine for v1 launch"). **This audit reverses that judgment** AND **the brand-identity refresh on 2026-05-06 changes the scope.**

**Revised scope:** Phase 15.3 pivots from "canonical SVG sources" to "**PNG masters + sharp downscale pipeline**" because the new leather-cushion brand identity is photorealistic 3D-render. SVG can't preserve the leather texture or stitching detail.

Phase 15.3 deliverables:
- `brand/logo-master.png` — 3000×1500 high-resolution wordmark (the new leather-cushion "Couch" — user-generated)
- `brand/mark-master.png` — 1024×1024 standalone leather-cushion **capital C** (user generating via ChatGPT 2026-05-06; same material/lighting/backdrop as wordmark, ~15% safe-zone padding)
- `brand/notification-mark.png` — 96×96 flat white silhouette of the C on transparent background (Android notification icon — required because Android can't render photorealistic icons in the notification strip)
- `scripts/regenerate-icons.sh` — sharp pipeline that generates the full Apple + Google + favicon + maskable size matrix from the masters

**New recommendation:** Schedule Phase 15.3 as a Phase 17 **hard** Wave 0 dependency (was "soft"). Without `mark-1024.png` from the new identity, iOS App Store packaging is blocked.

The previous fallback ("rasterize from `mark-512.png` via sharp upscale") is no longer relevant — the existing PNGs are the OLD brand identity (film-reel C concept) which has been superseded. Phase 15.3 replaces all of them in deploy.

## Asset workflow proposal for Phase 17

```
brand/  (NEW — at source repo root)
├── mark-source.svg         (Phase 15.3 deliverable)
├── logo-source.svg         (Phase 15.3 deliverable)
├── og-source.svg           (Phase 31 / D-17 deliverable)
└── ios-icons/              (Phase 17 generates from mark-source.svg)
    ├── mark-1024.png
    ├── mark-180.png
    ├── mark-167.png
    └── ... (full Apple matrix)

marketing/  (Phase 31 creates; Phase 17 extends with device captures)
├── (Phase 31 outputs: 5 PWA-standalone screenshots at 1170×2532)
├── archive-phase-9/  (Phase 31 archives existing set here)
└── app-store/  (Phase 17 NEW)
    ├── iphone-6.9/
    ├── iphone-6.7/
    ├── iphone-6.5/
    ├── iphone-5.5/
    ├── ipad-13/  (skippable v1)
    └── feature-graphic.png
```

Phase 31 already creates `marketing/` per Plan 31-02. Phase 17 extends with `marketing/app-store/` and `brand/ios-icons/`.

`scripts/deploy.sh` mirror-loop extension (Phase 31 / Plan 31-04 Task 2) already handles `marketing/` + `brand/` — Phase 17 inherits that.

## Implications for spike 001 (PWABuilder verdict)

Spike 001 verdict (PWABuilder for v1) is unchanged. The asset matrix above is identical regardless of whether Capacitor or PWABuilder is the wrapper — both consume the same 1024×1024, 512×512, screenshot-set, App Preview video.

PWABuilder's specific advantage: it doesn't need a custom Xcode project for icon catalog management — it generates the iOS icon catalog from the manifest's icon array. As long as `mark-512.png` and `mark-192.png` exist in the manifest, PWABuilder fills in the rest by upscaling (with the visual-quality caveat above).

## Deferred

- iPad screenshot variants (skippable for v1 if iPad isn't a primary surface)
- Localized screenshots (English-only for v1)
- App Clip variants (Apple instant-app feature; out of scope)

---

*Source-of-truth doc for launch positioning: `.planning/LAUNCH-REVIEW-2026-05-05.md`. Phase 17 scope: `.planning/phases/17-app-store-launch-readiness/17-CONTEXT.md`. Sibling spike: `.planning/spikes/001-capacitor-vs-pwabuilder/README.md`.*
