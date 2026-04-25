# Phase 12 — Pre-launch polish (notif prefs UI + about/version + pack curation)

**Gathered:** 2026-04-25
**Status:** Ready for planning (auto-defaults captured; user confirmed scope path C from post-Phase-11 audit conversation)
**Mode:** `--auto` — small focused phase, ~1 day total. Skip discuss-loop heaviness.
**Phase posture:** *polish patch*, not a feature phase. Three items that should already be there from a user-trust perspective.

<domain>
## Phase Boundary

Three small, independent fixes that close gaps surfaced during Phase 11 UAT and Phase 6 push-notifications closure:

1. **Per-event notification preferences UI** (A-NEW-1) — server-side enforcement is already deployed (Phase 6 `notificationPrefs` lookup at `functions/index.js:113`). Phase 12 adds the user-facing toggle UI in Account → YOUR COUCH → Notifications so users can actually exercise the prefs server-side enforcement is honoring.
2. **About / version / feedback / changelog** (A-NEW-4) — adds a footer surface in Account tab showing version + deploy date + feedback link + "what's new" pointer. Cheap, high signal, increases user trust.
3. **Halloween Crawl pack ID curation pass** (UI-04 follow-up from Phase 11 UAT) — Plan 11-07 executor used `tmdbId 9532` in halloween-crawl pack, which resolves to "Final Destination" not the comment-claimed "Hocus Pocus." Pass through all 8 packs, verify each ID resolves to its commented title, fix mismatches.

Out of scope: anything else from the former Phase 12 docket (audited separately and reorganized into Phase 13/14/15 + future "Phase 16 commercial launch" candidate). See `.planning/seeds/phase-12-original-docket-archive-2026-04-23.md` for full audit.

</domain>

<decisions>
## Implementation Decisions

### POL-01: Per-event notification preferences UI

- **D-01:** Render inside existing `#notif-card` in Account → YOUR COUCH cluster (no new modal). Currently shows just master enable/disable + Subscribe-to-this-device button. Phase 12 expands it.
- **D-02:** 6 per-event toggles (matches Phase 6 events that have CF triggers wired):
  - `watchpartyScheduled` — default ON
  - `watchpartyStartingNow` — default ON
  - `intentRsvpRequested` — default ON
  - `inviteReceived` — default ON
  - `vetoCapReached` — default OFF (owner-only signal — too noisy for non-owners)
  - `tonightPickChosen` — default ON (UI ships even though the event has no CF trigger yet — Phase 13/14 may wire it; harmless to surface the toggle now)
- **D-03:** Quiet hours start/end pickers — HH:mm 24-hour format inputs. Default disabled. Stored to `users/{uid}.notificationPrefs.quietHours = {enabled, start, end}` matching the `isInQuietHours(qh)` shape Phase 6 already enforces server-side.
- **D-04:** When master toggle is OFF, hide the per-event sub-toggles (collapsed state). When ON, expand. Avoids overwhelming the no-push-yet user.
- **D-05:** Visual: each toggle uses existing `.toggle` switch primitive from `css/app.css` (Phase 9 token-backed). No new CSS primitives needed.
- **D-06:** Copy follows BRAND.md voice — sentence-case, italic for descriptions. Examples:
  - Toggle label: "Watchparty starting"
  - Description: "*A push when someone in the family hits play.*"
- **D-07:** Save behavior: each toggle change writes to Firestore immediately (optimistic UI per Phase 7 setWpMode pattern). Toast "Saved" confirmation reuses existing `flashToast`.
- **D-08:** Migration: existing users who were on Phase 6 deploy keep their current pref state. New defaults apply only to net-new opts. The notificationPrefs subdoc may be partially populated already from Plan 06-04 wiring — check before defaulting.

### POL-02: About / version / feedback / changelog

- **D-09:** Render at the bottom of ADMIN & MAINTENANCE cluster in Account tab, BELOW the Sign out / Leave family pills (per Plan 11-02 footer). Sub-section eyebrow: "**ABOUT**" (small dim caps).
- **D-10:** Three lines of content:
  1. **Version line:** "Couch v{N} — deployed {YYYY-MM-DD}" — dynamically populated from sw.js CACHE const + a new `BUILD_DATE` constant in js/constants.js (set at deploy time)
  2. **Feedback line:** "**[Send feedback](mailto:nahderz@gmail.com?subject=Couch%20feedback%20vXX)**" — mailto with version pre-filled in subject for traceability
  3. **What's new line:** "**[See what's new](https://couchtonight.app/changelog)**" — links to `/changelog.html` (NEW static page)
- **D-11:** `/changelog.html` is a tiny standalone page (mirror of landing.html posture — no app shell, no Firebase SDK). Lists last 5-10 releases with one-line user-facing summaries. Manually maintained alongside CACHE bumps.
- **D-12:** Hosting rewrite: `/changelog` → `/changelog.html` (added to firebase.json alongside existing /app and /rsvp/** rewrites).

### POL-03: Halloween Crawl pack curation pass

- **D-13:** Audit all 8 packs in `COUCH_NIGHTS_PACKS` constants.js. For each, query TMDB for the FIRST tmdbId in the array and verify the response title matches the commented title.
- **D-14:** When mismatched: replace the tmdbId with the correct ID for the commented title. Use TMDB search if the canonical ID isn't easily findable (e.g., `https://api.themoviedb.org/3/search/movie?query=Hocus+Pocus`).
- **D-15:** Halloween Crawl specifically: replace `9532` (Final Destination) with the real Hocus Pocus ID. Verify all other 9 IDs in the pack also match their comment labels.
- **D-16:** Hero image URLs (already fixed in commit `e91adbd`): preserve. Don't touch heroes since they were already verified post-fix.

### POL-04 (stretch): Verify other pack hero matches

- **D-17:** Same pass on the other 7 packs — verify the 9-12 IDs in each match their comment labels. Likely some are correct already, some have mismatches.
- **D-18:** Long-term durability suggestion: refactor `COUCH_NIGHTS_PACKS` to drop comment labels (they go stale) and instead use a frozen test that fetches each ID at build time (or in a unit test) and asserts title match. Defer to Phase 13 or skip if curation passes.

### POL-05 (bundled with POL-02): TMDB attribution

- **D-19:** TMDB API ToS requires "Powered by TMDB" attribution somewhere visible. Add to the new ABOUT sub-section in Account tab footer (per POL-02). One line: italic *"Powered by The Movie Database (TMDB)"* with link to themoviedb.org. Same line on landing.html footer (currently absent — landing has © Couch only).
- **D-20:** Risk note: not adding this is a passive ToS violation; unlikely to bite immediately but stronger position for future commercial work and compliance audits.

### POL-06 (stretch): Cache-Control tighten for HTML rewrite paths

- **D-21:** Today's hotfix added `Cache-Control: no-cache, no-store, must-revalidate` to `/sw.js` (firebase.json `headers` block). HTML files at rewrite paths (`/app`, `/rsvp/**`, `/`) still serve `max-age=3600` because Firebase Hosting matches header rules against the *source URL pattern*, not the rewrite *destination*. The `**/*.@(html)` pattern doesn't catch source paths without `.html` in them.
- **D-22:** Fix candidate: add explicit header rules per rewrite source path:
  ```json
  { "source": "/app", "headers": [{"key": "Cache-Control", "value": "max-age=0, must-revalidate"}] },
  { "source": "/app/**", "headers": [{"key": "Cache-Control", "value": "max-age=0, must-revalidate"}] },
  { "source": "/rsvp/**", "headers": [{"key": "Cache-Control", "value": "max-age=0, must-revalidate"}] },
  { "source": "/", "headers": [{"key": "Cache-Control", "value": "max-age=0, must-revalidate"}] }
  ```
- **D-23:** Tradeoff: pages refresh faster on deploy (good) but cost slightly more bandwidth (negligible at couch-scale). Defer if scope tight; do if scope allows.

### Claude's Discretion

- Specific copy strings for the 6 toggle descriptions (D-06 lists 1 example)
- Specific layout for quiet hours pickers (HH:mm inputs vs sliders vs preset chips)
- Exact CACHE bump value (probably v32-pre-launch-polish)
- Whether to add a "Test push" button in the Account UI (helpful for debugging, low effort)

</decisions>

<specifics>
## Specific Ideas

- A-NEW-1's most-useful affordance is **quiet hours**. People want pushes during the day but not at 11pm when their phone's on the nightstand. Make sure quiet hours are easy to find + set.
- A-NEW-4's "send feedback" mailto is the simplest path. A proper feedback form is overkill for a family-scale product right now. Mailto is good enough — it just needs to work.
- The Halloween Crawl bug is a single-character TMDB ID swap, but it's emblematic of a class of "comment vs reality" drift. Worth a one-time pass + a note in the constants.js header that says "If you change a pack ID, update the comment label."

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 6 push notification infrastructure (server-side enforcement)
- `C:/Users/nahde/queuenight/functions/index.js:45,79,91-124,228,301` — `isInQuietHours`, `notificationPrefs` lookup, `forceThroughQuiet` payload override, `vetoCapReached` event
- `.planning/phases/06-push-notifications/06-CONTEXT.md` — Phase 6 decisions
- `.planning/phases/06-push-notifications/06-04-SUMMARY.md` — quiet hours wiring
- `.planning/phases/06-push-notifications/06-UAT-RESULTS.md` — runtime UAT state (5 scenarios DEFERRED-RUNTIME, code-verified 2026-04-25)

### Phase 11 Account tab structure (Plan 11-02)
- `.planning/phases/11-feature-refresh-and-streamline/11-02-SUMMARY.md` — 3-cluster structure (YOU / YOUR COUCH / ADMIN & MAINTENANCE)
- `app.html` lines 581-633 — Account tab HTML with `#notif-card` (where POL-01 ships) + ADMIN footer (where POL-02 ships)

### Phase 11 Couch Nights packs (where POL-03 ships)
- `js/constants.js` lines 674-771 — COUCH_NIGHTS_PACKS array (heroImageUrl already fixed in `e91adbd`; tmdbIds need POL-03 audit)
- `.planning/phases/11-feature-refresh-and-streamline/11-07-SUMMARY.md` — pack curation rationale + UI-04 follow-up note

### Brand + design
- `.planning/BRAND.md` — voice guide (toggle copy + about copy must match)
- `css/app.css` — `.toggle` primitive (Phase 9 tokenized) reused for D-05

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`#notif-card`** at app.html — existing notif card with master enable/disable. Extend this in place; no new container.
- **`.toggle`** CSS primitive — Phase 9 tokenized switch. Reuse for all 6 per-event toggles.
- **`flashToast`** in js/utils.js — for "Saved" confirmation on toggle writes.
- **`updateDoc`** + `writeAttribution` Firestore patterns — already used in renderSettings; reuse for notif pref writes.
- **`landing.html` + `css/landing.css`** — pattern for the new `/changelog.html` static page.
- **Hosting rewrite pattern** in `queuenight/firebase.json` — extend with `/changelog` → `/changelog.html`.
- **`escapeHtml`** for any user-typed strings (none expected, but defensive).
- **TMDB fetch helper** `tmdbFetch` at js/app.js:10115 — reuse for POL-03 ID verification (or just use `curl` from a one-time audit script).

### Patterns to Honor
- BRAND.md voice
- sw.js CACHE bump on every user-visible app change → v32-pre-launch-polish
- TMDB rate limit (~40 req / 10s) — POL-03 audit fetches 8 IDs serially, well under
- Public-by-design secrets stay client-side
- Deploy via mirror to queuenight/public/ then firebase deploy
- Phase 9 Pitfall-2 — don't migrate JS-controlled display:none toggles to .is-hidden

</code_context>

<plan_hints>
## Hints for /gsd-plan-phase 12

Suggested 3-plan split (1 plan per item):

- **Plan 12-01 — Per-event notif prefs UI** (POL-01) — extend #notif-card with 6 toggles + quiet hours pickers + Firestore write wiring + master toggle expand/collapse behavior. Effort: M (~3-4 hrs). Test paths: each toggle writes correctly + reads correctly + survives refresh + master OFF hides sub-toggles.
- **Plan 12-02 — About / version / feedback / changelog** (POL-02) — add ABOUT sub-section + version line wiring + mailto feedback link + create `/changelog.html` static page + hosting rewrite. Effort: S (~1-2 hrs).
- **Plan 12-03 — Pack curation pass** (POL-03 + POL-04 stretch) — audit script that fetches each pack's first tmdbId from TMDB + asserts title match + applies fixes. Effort: S (~1-2 hrs). One commit per pack OR one big commit + summary.

**Wave structure:** all 3 plans are independent (different files modified). Could run W1 = parallel all-3. But sequential is fine — total is ~1 day.

**Threat model surfaces (for plan-checker):**
- Notification pref writes — already covered by existing Firestore rules per Phase 6; no new surface
- Changelog static page — XSS-safe by being static HTML; no user-typed content
- TMDB curation script — read-only API calls + local file edits; no security surface

**Total effort:** ~6-8 hours = ~1 day phase, matches "polish patch" scoping intent.

</plan_hints>

---

*Phase: 12-pre-launch-polish*
*Context gathered: 2026-04-25 via auto-mode default proposal — small focused phase; user confirmed scope path*
*Requirements to mint:* POL-01 (per-event notif prefs UI), POL-02 (about/version/feedback), POL-03 (Halloween Crawl curation), POL-04 (other-7-packs curation, stretch)
