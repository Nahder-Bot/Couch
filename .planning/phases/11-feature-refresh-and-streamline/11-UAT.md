---
status: testing
phase: 11-feature-refresh-and-streamline
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
  - 11-03a-SUMMARY.md
  - 11-03b-SUMMARY.md
  - 11-04-SUMMARY.md
  - 11-05-SUMMARY.md
  - 11-06-SUMMARY.md
  - 11-07-SUMMARY.md
started: 2026-04-24
updated: 2026-04-24
deploy_status: Hosting + Functions LIVE at couchtonight.app (commit ffab048, sw.js v29). Storage pending human enablement in Firebase Console.
---

## Current Test

number: 1
name: Wave 1 visual smoke — mood chip density, picker hidden, who-card compact row
expected: |
  Open https://couchtonight.app/app on your phone or desktop browser. On the Tonight screen:
  - Mood filter row is visibly tighter than the pre-Phase-11 version — at least one additional chip visible per mobile viewport width. Chips have a 36px min-height tap target.
  - No "whose turn to pick" / "Tonight's pick goes to [Name]" card visible anywhere. (Backend spinnership preserved — spinnerId still writes.)
  - "Who's on the couch" card is a horizontal scrollable row of 26px avatar chips (not a multi-line grid).
  If family is empty, you see "Nothing but us." headline + italic "Pull up a seat — invite someone to the couch." + "Share an invite" button.
awaiting: user response

## Tests

### Wave 1 (deployed; visual verify)

- [ ] **1. Wave 1 visual smoke — mood chip density, picker hidden, who-card compact row** — plan 11-01 REFR-01/02/03
  - _What should happen:_ see Current Test.
- [ ] **2. Family tab restructure — 5 sections in correct order** — plan 11-02 REFR-11
  - _What should happen:_ Open Family tab. Top-to-bottom sections: (1) Hero + italic "Nothing scheduled yet." tonight-status line, (2) Approvals card if any pending, (3) "On the couch" active members (+ "Sub-profiles" below if any), (4) "Couch history" consolidating favorites + per-member stats, (5) "Group settings" footer with share URL + group name. No picker section visible.
- [ ] **3. Account tab restructure — 3 cognitive clusters** — plan 11-02 REFR-12
  - _What should happen:_ Account tab shows YOU eyebrow (identity + sub-profiles), YOUR COUCH eyebrow (streaming + Integrations/Trakt expandable + Notifications + YIR hidden when yirReady=false), ADMIN & MAINTENANCE eyebrow (owner admin split into Security / Members / Lifecycle + Shortcuts + Sign out/Leave family footer).
- [ ] **4. Leave-family confirmation modal** — plan 11-02
  - _What should happen:_ Tap "Leave family" in Account footer → serif "Leave this group?" modal appears with red "Leave" pill + Cancel pill. Cancel dismisses without leaving. (Don't actually leave unless you want to re-join.)

### Wave 2 (deployed; visual verify + console checks)

- [ ] **5. Discovery engine determinism** — plan 11-03a REFR-04 (console test)
  - _What should happen:_ Open Add tab. DevTools Console: `pickDailyRows('user-A', '2026-04-24', DISCOVERY_CATALOG).map(r => r.id)` returns 7–10 IDs. Run twice — identical. Change date to `2026-04-25` — different result. Friday 2026-04-24 → includes `e-fri` "Foreign Film Friday" row.
- [ ] **6. Add tab UI — 7-10 discovery rows + eyebrows** — plan 11-03a
  - _What should happen:_ Add tab renders mood section on top; below: 7-10 discovery row cards each with UPPERCASE eyebrow + italic subtitle + TMDB poster horizontal scroll. Empty rows show italic "Nothing new here today — check back tomorrow."
- [ ] **7. TMDB rate-limit discipline** — plan 11-03a (Network tab)
  - _What should happen:_ DevTools → Network → filter "themoviedb.org" on first Add-tab load → fetches are staggered (not simultaneous), ≤10 cold-load requests, 0 on same-day refreshes (cache hit).
- [ ] **8. Browse-all sheet + pinning** — plan 11-03b REFR-04 second half
  - _What should happen:_ Tap "Browse all rows" pill under discovery rows → sheet opens listing 33 rows grouped by 7 buckets (Always-on/Trending/Discovery/Use-case/Theme of the day/Seasonal/Personalization). Pin 3 rows → toast "Pinned" + star fills. 4th → "Pin up to 3" toast. Pinned rows appear above rotation. Persist across refresh. localStorage key: `couch-pinned-rows-{yourUid}`.

### Wave 3 (deployed; production smoke + end-to-end)

- [x] **9. rsvp.html zero-SDK + hosting rewrite** — plan 11-04 REFR-05 (auto-verified post-deploy)
  - _What happened:_ `GET https://couchtonight.app/rsvp/test` → 200, 6648 bytes, `<title>You're invited · Couch</title>`, 0 Firebase SDK references. `/rsvp/**` rewrite ordered before `/` catch-all.
- [x] **10. rsvpSubmit CF live + CORS locked** — plan 11-04 REFR-05 (auto-verified post-deploy)
  - _What happened:_ `POST https://us-central1-queuenight-84044.cloudfunctions.net/rsvpSubmit` with empty token → `400 INVALID_ARGUMENT "Invalid invite token."` — correct rejection. CORS locked to couchtonight.app + queuenight-84044.web.app (no localhost).
- [ ] **11. End-to-end RSVP flow** — plan 11-04 REFR-05 (manual)
  - _What should happen:_ Schedule a watchparty → "Send invites" → Web Share (mobile) or clipboard fallback (desktop) — you get a `/rsvp/<wpId>` link. Open in incognito → name + "Going" submit → confirmation card. Host sees you in participants list.
- [ ] **12. Expired/invalid token** — plan 11-04 REFR-05 (manual)
  - _What should happen:_ Open `https://couchtonight.app/rsvp/nonsense` → page shows "This invite has expired." dead-end card.
- [ ] **13. rsvpReminderTick CF scheduled** — plan 11-04 REFR-06 (manual)
  - _What should happen:_ Firebase Console → Functions → Logs → `rsvpReminderTick` fires every 30m (cron). First execution after a scheduled watchparty matches asymmetric cadence: Yes=2 pushes, Maybe=3, NotResp=2, No=silent.
- [ ] **14. Pre-session lobby + Ready check + majority auto-start** — plan 11-05 REFR-07 (manual, multi-device)
  - _What should happen:_ Schedule a watchparty starting in ~2 minutes. On 2+ devices, open the Tonight banner at T-15min. See `.wp-lobby-card` with countdown ring, participant list, Ready toggle per member. Majority Ready before T-0 → auto-start (existing preStart branch mutex-guarded by `!inLobbyWindow`, so no duplicate UI).
- [ ] **15. Catch-me-up card for late joiner** — plan 11-05 REFR-08 (manual, multi-device)
  - _What should happen:_ During active watchparty (2+ devices posting reactions), join late on device 3 → catch-me-up card renders with 30s reaction summary via `renderReactionsFeed` wall-clock slice.
- [ ] **16. Post-session modal: rating + photo upload + schedule-next** — plan 11-05 REFR-09 (BLOCKED — Storage pending)
  - _What should happen:_ End a watchparty → post-session modal with 5-star rating + "Add photo to album" + "Schedule another night". Rating + schedule-next work now. Photo upload WILL FAIL until Firebase Storage product is enabled in Console.
- [ ] **17. DVR slider does NOT break Phase 7 reactionDelay** — plan 11-06 REFR-10 regression (manual)
  - _What should happen:_ Plan 11-06's DVR slider dual-writes `dvrOffsetMs` + `reactionDelay` to the same Firestore field. Phase 7's reactionDelay chip still visible alongside DVR slider in sport mode; both feed the same `effectiveStartFor` anchor.

### Wave 4 (deployed; mostly manual)

- [ ] **18. Game picker modal + live score strip** — plan 11-06 REFR-10 (manual, live-game needed)
  - _What should happen:_ Tap Add tab → "📺 Watch a game live" → modal lists 4 leagues (NFL/NBA/MLB/NHL). Pick a live game → watchparty created with `mode: 'game'` → sticky-top score strip renders inside .wp-live-modal with LIVE indicator. Score polls every 15s (drops to 5s on scoring play).
- [ ] **19. Score-delta amplified reactions** — plan 11-06 REFR-10 (live-game needed)
  - _What should happen:_ During live game, when score changes → reactions amplify for 3s (bigger emoji + color flash) + persists to `wp.scoringPlays[]`.
- [ ] **20. Sports catch-me-up variant** — plan 11-06 REFR-10 (live-game needed)
  - _What should happen:_ Join active sport watchparty mid-game → catch-me-up card says "Score: AWY X, HOM Y · Last 3 plays:" instead of the reaction rail from 11-05.
- [ ] **21. Couch Nights themed packs** — plan 11-07 REFR-13 (manual)
  - _What should happen:_ Add tab → scroll to Couch Nights row (between mood + discovery). See 8 pack tiles (Studio Ghibli Sunday / Cozy Rainy Night / Halloween Crawl / Date Night Classics / Kids' Room Classics / A24 Night / Oscars Short List / Dad's Action Pantheon). Tap pack → detail sheet with hero + title preview. "Start this pack" → seeds ballot + launches Vote mode.

### Cross-cutting

- [x] **22. sw.js CACHE progression v21 → v29** — all plans (auto-verified)
  - _What happened:_ `curl https://couchtonight.app/sw.js | grep CACHE` → `const CACHE = 'couch-v29-11-07-couch-nights';` — final Phase 11 value serving.
- [x] **23. HTTP smoke: all 3 surfaces live** — auto-verified
  - _What happened:_ `GET /` 200 (landing 9010b), `GET /app` 200 (app 73511b, grew from 54335), `GET /rsvp/test` 200 (rsvp 6648b) — all correct Content-Type.
- [x] **24. Phase 11 static DOM IDs all deployed** — auto-verified
  - _What happened:_ `grep` on live app.html returns all 9 static Phase 11 IDs (family-tonight-status / pinned-rows / add-discovery-rows / add-browse-all-trigger / browse-all-sheet-bg / couch-nights-section / couch-night-sheet-bg / leave-family-confirm-bg / wp-post-session-modal-bg). Dynamic ones (wp-lobby / game-picker-modal / sports-score-strip) render runtime.
- [x] **25. PWA registration** — auto-verified via DevTools required
  - _What should happen:_ DevTools → Application → Service Workers → `couch-v29-11-07-couch-nights` shown + active. Cache Storage lists `couch-v29-*` and no `v28-/v27-` leftovers after registration.

### Auto-verified gates (5/25)

Tests 9, 10, 22, 23, 24 — passed pre-deploy + post-deploy HTTP smoke.

### Production blockers (1 item)

Test 16 (photo upload in post-session modal) — WILL FAIL until Firebase Storage is enabled in Console. Manual one-time click at https://console.firebase.google.com/project/queuenight-84044/storage → "Get started". Then I'll run `firebase deploy --only storage` to land Variant A rules.

### Deferred from plan SUMMARYs (Phase 12)

These are documented scope deferrals, NOT failures:
- Twilio SMS nurture for non-members (plan 11-04 D4 locked)
- Host-triggered "remind unresponsive" button (routed to 11-05 lobby)
- Browse-all 35-row target (33 shipped; 2 curated rows deferred per 11-03b shippable-density)
- Account tab new sections (notif prefs detail, data export, theme prefs, about/version+feedback)
- Sports post-game debrief, voice rooms (11-06 v2)

---

*Use: reply to the Current Test with "yes" / "y" / "next" if it passes, or describe what's different. I'll log the result and advance to the next test. Tests run top-to-bottom; skip any that depend on live-game windows (18-20) or multi-device (14-15) until convenient.*
