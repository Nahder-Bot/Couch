---
created: 2026-04-25
status: audit-complete
audit_scope: solo-device static + curl audit of live https://couchtonight.app
audit_method: file-tree, grep, curl, JSON-parse, base64-decode of inline manifest
---

# Couch — v1 Launch Readiness Audit

Single-pass audit before Couch announces publicly. Prioritized punch list. **No code changes were made during the audit** — fixes are recommendations to action separately.

## Verdict

**Couch is technically shippable today** but has 3 small launch blockers that should land before any public announcement, plus a few P1/P2 hygiene gaps that don't block but materially raise the polish bar. Total fix effort: ~1-2 hours.

## Findings

### P0 — Launch blockers (fix before announcing publicly)

#### LB-1. `landing.html` footer missing legal links
**Severity: BLOCKER** for public launch · **Effort: 5 min**

`landing.html:154` carries a `TODO pre-launch: wire footer legal links (privacy + terms)` comment from Phase 9. The privacy.html and terms.html pages **DO exist live** (deploy mirror has them; both return HTTP 200 from couchtonight.app). The TODO was simply forgotten when the legal pages landed.

Today the landing footer reads only `© Couch + Powered by The Movie Database (TMDB)`. App-shell footer (`app.html:1295`) DOES link to /privacy and /terms; landing-page does not. First-time visitors arriving at `https://couchtonight.app/` see no privacy policy link — that's a real compliance gap if traffic comes from anywhere regulated (CA, EU, anywhere asking GDPR/CCPA).

**Fix:**
```html
<!-- landing.html footer -->
<footer class="landing-footer">
  <p>© Couch</p>
  <p class="landing-tmdb-attr"><em>Powered by <a href="...">The Movie Database (TMDB)</a></em></p>
  <p class="landing-legal">
    <a href="/privacy.html">Privacy</a>
    <span class="sep">·</span>
    <a href="/terms.html">Terms</a>
  </p>
</footer>
```
Plus matching `.landing-legal` rule in `css/landing.css` (mirror of the TMDB attribution style).

#### LB-2. `sitemap.xml` missing /changelog and stale lastmod
**Severity: BLOCKER** (low impact, but free fix) · **Effort: 2 min**

```xml
<!-- current sitemap.xml -->
<urlset>
  <url>
    <loc>https://couchtonight.app/</loc>
    <lastmod>2026-04-23</lastmod>
    ...
  </url>
</urlset>
```

- `<lastmod>` is `2026-04-23` but landing.html was edited 2026-04-25 (TMDB attribution add).
- `/changelog` is not in the sitemap — search engines won't auto-discover it. The page sets `robots: index,follow` and has `<link rel="canonical" href="https://couchtonight.app/changelog">`, so it expects to be indexed.
- `/app` is correctly absent (intentionally noindex per robots.txt).

**Fix:**
```xml
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://couchtonight.app/</loc>
    <lastmod>2026-04-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://couchtonight.app/changelog</loc>
    <lastmod>2026-04-25</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>
</urlset>
```

#### LB-3. HTML rewrite paths cache for 1 hour (POL-06 deferred from Phase 12)
**Severity: HIGH** · **Effort: 5 min**

`firebase.json` has a header rule:
```json
{ "source": "**/*.@(html)", "headers": [{ "key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate" }] }
```

But Firebase Hosting matches header rules against the **source URL pattern**, not the rewrite destination. So:

| URL | Cache-Control served | Why |
|-----|---------------------|-----|
| `/app.html` | `no-cache, max-age=0` ✓ | matches `**/*.@(html)` |
| `/landing.html` | `no-cache, max-age=0` ✓ | matches `**/*.@(html)` |
| `/app` (canonical) | `max-age=3600` ✗ | rewrite source has no `.html` |
| `/` (canonical) | `max-age=3600` ✗ | rewrite source has no `.html` |
| `/changelog` (canonical) | `max-age=3600` ✗ | rewrite source has no `.html` |
| `/rsvp/<token>` | `max-age=3600` ✗ | rewrite source has no `.html` |

**User-visible impact:** non-PWA visitors who land on the canonical URLs `/`, `/app`, `/changelog` may see stale HTML for up to 1 hour after a deploy. PWA users are fine — `sw.js` cache invalidates on the v32 bump. But every first-time visitor goes through a non-PWA browser, and they're the ones the marketing surface needs to be fresh for.

**Fix:** add explicit per-rewrite-source header rules in `queuenight/firebase.json`:
```json
"headers": [
  { "source": "/sw.js", "headers": [{"key":"Cache-Control","value":"no-cache, no-store, must-revalidate"}] },
  { "source": "**/*.@(html)", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] },
  { "source": "/", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] },
  { "source": "/app", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] },
  { "source": "/app/**", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] },
  { "source": "/changelog", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] },
  { "source": "/rsvp/**", "headers": [{"key":"Cache-Control","value":"no-cache, max-age=0, must-revalidate"}] }
]
```

This was the POL-06 stretch goal in Phase 12 CONTEXT.md (D-21..D-23) that was deferred. Cost: negligible bandwidth at couch-scale; benefit: deploys go live for everyone immediately instead of after a 1-hr CDN warm.

---

### P1 — Should fix pre-announcement (polish)

#### P1-1. `changelog.html` missing OG/Twitter cards
**Severity: MEDIUM** · **Effort: 5 min**

`changelog.html` has `<meta name="description">` and a canonical, but no `og:image`, `og:title`, `og:description`, or `twitter:card`. When someone tweets/shares "what's new" link, they get a blank-card preview instead of the og.png hero. Easy add — copy the OG block from landing.html.

#### P1-2. PWA manifest icon coverage
**Severity: LOW** · **Effort: 5 min** (icons already in deploy mirror)

Inline manifest in app.html declares only 192x192 and 512x512 sizes. The deploy mirror already has icons at 16, 24, 32, 48, 64, 72, 96, 128, 144, 152, 180, 256, 384, 512, 1024. Manifest could declare 192 + 384 + 512 (Android) and reference the maskable variants. Not blocking — Android handles missing sizes gracefully — but improves install affordance on edge devices.

#### P1-3. `rsvp.html` name input missing `aria-label`
**Severity: LOW** · **Effort: 1 min**

```html
<!-- current -->
<input class="rsvp-name-input" id="rsvp-name" type="text" placeholder="Your name" ...>
```

Placeholders aren't substitutes for labels per WCAG. Screen readers read this as "edit text" without context. Add either `aria-label="Your name"` to the input or a `<label for="rsvp-name">` above it. The `<label>` is preferred but `aria-label` is the lighter touch.

---

### P2 — Nice-to-have hardening

#### P2-1. Missing security headers
**Severity: LOW** for a family-scale PWA · **Effort: 30-60 min** (CSP requires testing)

Live response headers include `Strict-Transport-Security` ✓ but not:
- `Content-Security-Policy` — defense-in-depth against XSS. Couch is XSS-disciplined (zero `innerHTML` from user content; everything goes through `escapeHtml`), so the actual XSS surface is small. CSP would still tighten the failure radius if a third-party SDK ever ships a vulnerability. Implementation cost: real, because Trakt OAuth callback + TMDB image CDN + Google Fonts + Firebase SDK + service worker all need allow-listing.
- `X-Frame-Options: DENY` or `frame-ancestors 'none'` in CSP — protects against clickjacking. Couch isn't an embeddable app; safe to deny entirely.
- `X-Content-Type-Options: nosniff` — cheap (one header), prevents MIME sniffing attacks.
- `Referrer-Policy: strict-origin-when-cross-origin` — prevents leaking deep-link tokens (e.g., `/rsvp/<token>`) to outbound third parties via Referer header. Mid-priority for the RSVP flow.

**Fix:** add a `headers` block to `firebase.json` covering `/**`. Lowest-effort minimum: `X-Content-Type-Options: nosniff` + `Referrer-Policy: strict-origin-when-cross-origin`. Defer CSP to a later session (needs a real test pass).

#### P2-2. `js/app.js` has 50 `console.warn`/`console.error` calls
**Severity: LOW** · **Effort: 60 min** if cleaning up

This is normal for an app that uses `qnLog` + targeted error reporting. Not a leak (no PII in messages reviewed). Worth a future pass to:
- Funnel through a single `logError` helper that can be silenced in production.
- Decide which warnings are actionable vs. noise. Currently they all log unconditionally; production should probably suppress non-critical paths.

This is **not a launch blocker** — most users never open devtools.

---

### P3 — Backlog (don't block v1)

- **firebase-functions SDK 4.9.0 → 5.1.0+** (deploy warning today; breaking-change-aware bump). Tracked in B (tech-debt cleanup).
- **`couch-albums/` Variant-B storage rules tightening** — current rules gate on auth+size+MIME but not family-membership. Queued in Plan 11-05 SUMMARY for after the member-uid migration ships.
- **PWA manifest screenshot/maskable icon variants** — richer install experience on Android.
- **Auto-stamp `BUILD_DATE` from git** — would prevent the version-line drift tracked in Plan 12-02 deploy notes.

---

## Summary punch-list

Items in **bold** below are recommended pre-announcement.

| ID | Severity | Effort | Item |
|----|----------|--------|------|
| **LB-1** | BLOCKER | 5 min | **Wire privacy/terms links into landing.html footer (TODO from Phase 9)** |
| **LB-2** | BLOCKER | 2 min | **Update sitemap.xml: add /changelog + bump lastmod to 2026-04-25** |
| **LB-3** | HIGH | 5 min | **Fix HTML cache-control on rewrite URLs (firebase.json headers — POL-06)** |
| P1-1 | MEDIUM | 5 min | Add OG/Twitter cards to changelog.html |
| P1-2 | LOW | 5 min | Expand PWA manifest icon sizes |
| P1-3 | LOW | 1 min | Add aria-label to rsvp.html name input |
| P2-1 | LOW | 30-60 min | Add nosniff + Referrer-Policy headers (defer CSP) |
| P2-2 | LOW | 60 min | console.warn/error noise pass (not a launch blocker) |
| P3   | — | — | firebase-functions SDK upgrade, Variant-B storage rules, manifest variants, BUILD_DATE auto-stamp |

**Recommended pre-announcement actions:** LB-1 + LB-2 + LB-3. Total ~12 min of edits + one deploy (already approved). Three small fixes that ensure (a) compliance compliance copy ships, (b) search engines find the changelog, (c) deploys propagate immediately to non-PWA visitors instead of caching for 1 hour.

P1 items are quality-of-launch — they're worth doing in the same session if you have ~15 more minutes to spend. P2 / P3 can ship after the public announcement.

## Audit coverage

Categories audited:

- ✓ Legal/compliance (privacy + terms presence + linkage)
- ✓ SEO meta (canonicals, robots, descriptions, OG/Twitter cards across landing/app/changelog/rsvp)
- ✓ Sitemap currency + completeness
- ✓ Iconography (favicon, PWA, OG image existence in deploy mirror + live)
- ✓ Accessibility (alt attributes, ARIA, form labels — static scan only)
- ✓ Security headers (HSTS ✓; CSP/XCTO/X-Frame/Referrer absent)
- ✓ Cache-control posture across rewrite vs. literal HTML paths
- ✓ PWA manifest decode + icon coverage
- ✓ 404 page exists
- ✓ Console error/warning surface scan
- ✓ Firestore + Storage rules sanity-check (Variant A storage acknowledged)

**Not covered (would need browser):**
- Lighthouse perf/a11y/SEO scores (deferred to phase C — solo browser walkthrough)
- Runtime error handling on broken-state paths (declined push permission, expired token, offline)
- Visual regression vs. Phase 9 brand spec
- Real device install flow

**Not covered (would need multi-device):**
- Cross-device push delivery
- Watchparty multi-participant flows
- Lobby Ready check majority threshold
- Photo upload via deployed Storage rules
