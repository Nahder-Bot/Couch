# Feature Gap Matrix — Couch vs Teleparty / Plex Watch Together / Letterboxd

**Researched:** 2026-04-22 | **Couch state source:** PROJECT.md + ROADMAP.md. Phases 5-8 shipped and deployed; Phase 9 Redesign and Phase 10 Year-in-Review remain.

## Matrix

| Feature | Teleparty | Plex Watch Together | Letterboxd | Couch today |
|---|---|---|---|---|
| Synced playback | Yes (extension host-sync) | Yes (any-member control) | No | ⚠ Advisory per-member timer only (Phase 7 shipped — no DRM-bound sync) |
| In-session chat | Yes (sidebar + emoji) | No (defers to third-party) | No | ❌ |
| Reactions | Yes (Premium = custom) | No | Likes on reviews | ✅ 8-emoji palette + `+more` native picker (Phase 7) |
| Per-user history | Limited | Yes (library-linked) | Yes (diary, central) | ✅ via Trakt sync + votes |
| Recommendations | No | Basic library surfacing | Yes (friends/activity) | ⚠ Mood + provider + Yes-queue filter — group-ritual-scoped |
| Social feed / activity | No | No | Yes (core) | ❌ Intentionally out-of-scope (family-scoped) |
| Lists / watchlists | No | Playlists | Yes (core; custom + watchlist) | ⚠ Auto-queue from Yes votes; no user-curated lists |
| Reviews / ratings | No | Basic | Yes (5-star + half + text) | ⚠ Yes/Maybe/No only; no star/text |
| RT / IMDb aggregation | No | No | TMDB + own avg | ⚠ TMDB only |
| Friends / followers | No | Managed users/Home | Yes (follow graph) | ❌ Family-code membership, not follow graph |
| Notifications | Extension toasts | Push (mobile) | Push (Pro+) | ✅ 8 eventTypes (watchparty, intent, invite, title approval, veto cap, + more) |
| Push (real web-push) | No | Yes | Yes | ✅ Phase 6 shipped |
| Groups / rooms | Yes (up to 1000) | Watch Together session | No | ✅ family/crew/duo modes |
| Cross-platform | Chrome ext + iOS + Mac; Android beta | iOS/Android/web/TV | iOS/Android/AppleTV/web | ⚠ Web PWA only — iOS/Android native = post-v1 |
| Offline | No | Yes (downloaded library) | Partial (diary cache) | ❌ SW exists but no offline catalog |
| Accessibility (a11y) | Minimal public info | Platform-level | Patron translation; unclear WCAG | ❌ No audit yet |
| Languages | English-first | Multi-lang UI | Patron-only review translation | ❌ English-only |
| Theming | None | Light/Dark | Light/Dark + Patron customization | ⚠ Single warm-dark (brand-locked — intentional) |
| Onboarding flow | Install ext + sign in | Plex account + server | Signup + follow suggestions | ⚠ Family code entry; Phase 9 redesigns this |
| Paid tiers | $3.99/mo, $47.88/yr | Plex Pass ($4.99+) | Pro $19/yr, Patron $49/yr | ❌ None (v1 free per PROJECT.md) |

## Missing Features Ranked (demand × effort × brand-fit)

1. **Star/half-star ratings + short review text** — Letterboxd table-stakes. Yes/Maybe/No feels thin for retained users. HIGH demand, LOW effort (Firestore field + UI), strong brand fit. **Ship next.**
2. **User-curated lists ("Rainy Sunday," "Dad-safe horror")** — Distinct from auto-queues; expressive surface inside family scope. HIGH demand, MEDIUM effort, strong fit.
3. **RT/Metacritic aggregation alongside TMDB** — Elevates the decision moment. MEDIUM demand, MEDIUM effort, strong fit.
4. **Native iOS/Android wrap** — Every competitor is there; PWA-only limits growth. HIGH demand, HIGH effort, high fit. Planned post-v1.
5. **Accessibility audit (captions, VoiceOver, reduced-motion)** — Table stakes for commercial release. MEDIUM demand, LOW-MEDIUM effort, strong brand fit. **Fold into Phase 9.**
6. **Multi-language UI (ES first)** — Family-app audience skews multilingual. LOW-MEDIUM demand in-market, MEDIUM effort, MEDIUM fit. Defer past v1.
7. **Offline/cached Tonight view** — Family couch has flaky wifi. LOW demand signal, MEDIUM effort, MEDIUM fit. Defer.

## Brand-fit filter (explicit anti-features)

- Public social feed, follower graph, public reviews — **reject**: violates family-scoped design per PROJECT.md.
- Host-authoritative playback sync (Teleparty model) — already rejected; Phase 7 chose advisory per-member timer.

## Sources

- [Teleparty product page](https://www.teleparty.com/), [Teleparty Premium pricing](https://www.teleparty.com/premium)
- [Plex Watch Together support](https://support.plex.tv/articles/watch-together/)
- [Plex dropping Watch Together — Android Authority](https://www.androidauthority.com/plex-watch-together-removed-3529939/)
- [Letterboxd](https://letterboxd.com/), [Letterboxd Pro/Patron](https://letterboxd.com/about/pro/)

## Confidence

HIGH on competitor state (2025 sources, official pages). HIGH on Couch state (PROJECT.md/ROADMAP.md read directly). MEDIUM on accessibility row — none of the four publish WCAG audits.
