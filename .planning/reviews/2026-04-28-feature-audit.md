# Couch — Feature Audit & Recommendations
**Date:** 2026-04-28
**Triggered by:** User asking for a full review of features, what's missing, and tweaks worth making.
**Live cache:** `couch-v35.5.5-tonight-couch-abstain-ok` at https://couchtonight.app/app
**Context:** PWA at couchtonight.app/app for families (and small friend groups) to pick what to watch together. Single-file architecture (`app.html` + modular `js/` + `css/app.css`); Firebase Hosting + Firestore + sibling Cloud Functions repo (queuenight). Brand voice: "Warm · Cinematic · Lived-in. Restraint is the principle."

---

## A. What's shipped (12/15 phases)

### Foundation (pre-GSD)
- Family codes + join flow, member profiles, Tonight screen, spin-picker, TMDB catalog (posters/runtimes/ratings/trailers), provider availability buckets (stream/rent/buy), "hide what I can't watch" toggle, Yes/No/Seen voting, per-member queues from yes-votes, Trakt OAuth + history sync, mood suggestions from TMDB genres+runtime, filter bar with counts, PWA install support, Firestore real-time sync.

### Phase 3 — Mood Tags
Inline mood editing in detail view; active-mood row outside collapsible panel; user-edit guard.

### Phase 3.5 — Index split
Modular JS — `js/firebase.js`, `js/constants.js`, `js/state.js`, `js/utils.js`, `js/app.js` (now ~16k lines).

### Phase 4 — Veto System
Pre-spin veto (removes from pool), post-spin veto (re-spins), real-time multi-device propagation, optional reason text, per-member veto records (for Year-in-Review), fairness rule (vetoer can't re-spin same session).

### Phase 5 — Auth + Groups
Firebase Auth (Google + Email-link + Phone), `uid` stamping on every Firestore write, owner-set group passwords, claim flow for legacy members, guest invites, ownership transfer. 6 Cloud Functions: setGroupPassword, joinGroup, claimMember, mintClaimTokens, inviteGuest, transferOwnership.

### Phase 6 — Push Notifications
Web-push delivery, per-event opt-in via `notificationPrefs`, quiet hours via `isInQuietHours`, self-echo guard (excludeUid + excludeMemberId), watchparty-starting push delivers ≤5s on iOS PWA.

### Phase 7 — Watchparty
Live shared watching session with reactions (emoji + text), participant strip, sport mode (DVR slider for time-shifted), movie mode (pause-aware reaction timing), per-receiver render filter (Wait Up — see 15.5).

### Phase 8 — Watch-Intent Flows
Schedule-watch ("Watch Inception with Mom Sat 9pm"), interest-per-title ("I want to watch this someday"). 4 push CFs for matched intents.

### Phase 9 — Redesign / Brand / Marketing Surface (passed_partial)
47-token semantic alias layer (1840 var(--…) uses); inline-style purge (119→36); desktop responsive layer; landing page at `/`; first-run onboarding; invite-flow onboarding; motion tokens; BRAND.md (185 lines).
**Outstanding:** DESIGN-01 (canonical SVG logo + wordmark sources) — deferred to Phase 15.3.

### Phase 11 — Feature Refresh & Streamline
Photo upload, Couch history, member-archived state, queue polish, etc.

### Phase 12 — Pre-launch Polish (3/3 + 8/8 smoke tests)
POL-01..04 — notification prefs UI, about+changelog, pack curation, stretch items.

### Phase 13 — Compliance & Ops Sprint (5/5)
Self-serve account deletion (4 CFs in us-central1), BUILD_DATE auto-stamp, CSP Report-Only, Sentry (DSN substituted, deployed), GitHub branch protection, Firestore daily export setup script.

### Phase 14 — Decision Ritual Core (10/10)
- 14-01: Couch-aware already-watched filter (D-01)
- 14-02: Queue polish + Add-tab insertion + iOS DnD UAT
- 14-03: Tier aggregators T1/T2/T3 + T3 visibility resolver
- 14-04: Couch viz hero-icon + avatar grid (sketch 001 winner P, replaced by V5)
- 14-05: Tile redesign + Vote-mode preservation
- 14-06: V5 couch viz roster pills (sketch 003 V5 — Roster IS the control)
- 14-07: Flow A group rank-pick + push-confirm UI
- 14-08: Flow B solo-nominate + counter-time + auto-convert + all-No edge
- 14-09: Onboarding tooltips + 5 empty states + 7 push categories + sw.js v34 CACHE bump
- 14-10: V5 redesign

### Phase 15 — Tracking Layer (8/8)
Per-watching-group progress (vs Trakt's per-individual), tuple primitive (e.g. "Nahder + Ashley"), tuple WRITE/READ helpers, S6 mute, S3 inline-rename, S5 Trakt opt-in disclosure, S1 cross-show pickup widget, new-season air-date push, live-release scheduling.

### Phase 15.1 — Security Hardening (3/3)
Closed 4 audit findings: F-OPEN-01 HIGH (`t.progress[X].source` forgeable), WR-02 HIGH (regex injection via attacker-controlled `memberId`), F-OPEN-02 MEDIUM (`tupleNames` not write-scoped to participants), WR-03 MEDIUM (no rules-test coverage for `coWatchPromptDeclined`). 38 rules-tests green.

### Phase 15.2 — Audit-trail Backfill + Project Hygiene (7/7)
5 retroactive VERIFICATION.md files (Phases 5/6/7/8/9), 10 missing SUMMARYs backfilled, REQUIREMENTS.md traceability refresh (28 rows flipped Pending→Complete, Coverage 81%), STATE.md milestone normalization, CLAUDE.md token-budget refresh.

### Phase 15.5 — Wait Up Flex (7/7) — SHIPPED TODAY
Storage-layer clamp 60→86400 sec, sport-mode slider step ramp via positionToSeconds (5-band non-linear transform), movie-mode 8-chip ladder + sub-line + +5min nudge, Custom… picker bottom sheet (iOS native numeric keypad), cross-repo CF reaction-content stripping per-receiver, Tonight 5h cutoff + Past parties tall-sheet, sw.js cache bump, cross-repo deploy ritual followed (functions → hosting).

### Today's Tonight surface fixes (post-15.5)
- v35.5.1: V5 toggleCouchMember missing renderTonight() call
- v35.5.2: isWatchedByCouch wrongly conflated yes-vote with watched
- v35.5.3: Matches semantics — at least one couch yes
- v35.5.4: Tightened to all couch yes + no off-couch yes
- v35.5.5: Relaxed back — at least one couch yes + no off-couch yes (couch abstainers OK)

---

## B. Scoped, awaiting kickoff

| Phase | Theme | Notes |
|-------|-------|-------|
| **15.3** | DESIGN-01 SVG logo + wordmark | Closes only genuinely unsatisfied REQ from v33.3 audit. Production phase: SVG logo + wordmark sources, PNG regen pipeline, 09-01-SUMMARY backfill. |
| **15.4** | Integration polish — push fan-out + Settings parity | 2 user-impacting FLAGS from v33.3: F-W-1 (sendCouchPing fake fan-out), D-3 (friendly-UI Settings missing 8 push keys → POL-01 partial). Cross-repo. |
| **16** | Calendar Layer | Recurring + multi-future watchparty scheduling. New `watchpartySeries` doc primitive + week-view planning. |
| **17** | App Store Launch Readiness | Native wrapper (Capacitor/PWABuilder), Apple Sign-In ($99/yr Dev account gate), App Store Connect listings, privacy policy + ToS authoring. |
| **10** | Year-in-Review (DEFERRED) | Paused 2026-04-25; revisit post-launch when there's accumulated history + audience to make it substantive. |

---

## C. Parked in seeds/ (waiting for signal)

| Seed | Pitch | Status |
|------|-------|--------|
| `phase-async-replay` | "Red Wedding" use case — feel original group's reactions days/weeks/years later. Banner dismiss + async-replay watchparty mode. | Natural follow-on to Phase 15.5 if Wait Up flex earns its keep in production. |
| `phase-9x-gif-reactions` | Tenor/Giphy reaction picker | Needs design audit (conflicts with reaction-delay moat — 15.5 just shipped). |
| `phase-9x-solo-mode` | Solo mode on-ramp (Letterboxd 17M→26M model) | ~50% addressable market expansion. Requires retroactive privacy dialog (P0). |
| `phase-10x-availability-notifications` | "Dune just hit Max for your household" — JustWatch pattern | Research thread 02 ranked this as highest-value new capability. Needs provider-data audit first. |
| `phase-10x-custom-lists` | Letterboxd-style user-curated lists | Research thread 07 ranked #2 missing. |
| `phase-11-teen-mode` | Audience expansion — teen friend-group cadence | Research thread 09 found Couch is more relevant to teens than adults. Audience expansion post-PMF. |
| `phase-05x-account-linking` | Google + Phone create separate Firebase uids today | Phase 5 UAT 2026-04-21. |
| `phase-05x-apple-signin` | Apple Sign-In | Gated on $99/yr Apple Dev account → Phase 17. |
| `phase-05x-guest-invite-redemption` | Guest invite link routes to sign-in instead of letting recipient join as guest | Phase 5 UAT 2026-04-22 Test 3. |
| `phase-15x-nyquist-backfill` | Validation framework backfill for Phases 4-13 (tooling tech debt) | Accept for v1; framework applies going forward only. |

---

## D. Open follow-ups + tech debt (per STATE.md and TECH-DEBT.md)

### Pending HUMAN-VERIFY (blocks formal phase verification, not deploys)
- iOS Safari touch-DnD UAT for Phase 14 queue drag-reorder (must run before v34 production deploy — actually deploy already shipped 2026-04-26)
- Phase 14 multi-device Flow A & Flow B UAT (5 deferred items)
- Phase 14 tooltip + empty-states + push toggles UAT
- Phase 15.1 24h post-deploy soak (~24h since 2026-04-27)
- **Phase 15.5 Scripts A/B/C/D/E** — today's deploy, fresh
- gcloud Firestore export setup (`scripts/firestore-export-setup.sh`)
- Trigger account-deletion flow E2E from real signed-in user

### Polish backlog
- F-W-1 sendCouchPing fake fan-out (Phase 15.4 territory)
- Drop legacy couchSeating dual-write — written for ~1-2 weeks of v34.1 then drop. v34.1 deployed 2026-04-26. Currently 2026-04-28. Cache cycle has happened. **Ready to drop.**
- DR-3 friendly-UI parity (Phase 15.4)

### Tech debt
- TD-1: firebase-functions SDK 4→7 (Phase 14 follow-up)
- TD-2: Variant-B storage rules (post-Phase-5 follow-up)
- TD-4: CSP audit window flip (2 weeks then enforcement) — flip due ~2026-05-09
- TD-6: Sentry Replay re-enable +30 days
- TD-7: Firestore index spec record-only (resolved, archived)

### Documentation drift
- PROJECT.md is stale (last updated 2026-04-20 after Phase 3). 12 phases shipped since. Phase 14, 15, 15.1, 15.2, 15.5 not reflected in Validated section.

---

## E. My recommendations (prioritized)

### Tier 1 — Ship soon (high signal-to-effort, ready to start)

1. **Phase 15.4 — Push fan-out + Settings parity (POL-01 closure)**
   *Closes 2 user-facing bugs flagged in v33.3 audit. F-W-1 is a UX lie (toast says "push sent" but no push fires); D-3 leaves a Settings inconsistency. Already scoped, decisions locked.*
   **Why:** finishing what's already started costs less than starting something new; closes two known-broken loops.

2. **Phase 15.3 — SVG logo + wordmark sources (DESIGN-01)**
   *Last unsatisfied requirement from v33.3 audit. Tied to App Store readiness because the manifest icons need to be regeneratable from SVG source.*
   **Why:** unblocks Phase 17 (App Store Connect needs final-quality assets). Small phase (~2-4 plans).

3. **Couch UAT pass — v35.5 + Phase 14 deferred items**
   *Today's 6 hotfixes touched core matching/render logic. Phase 14 multi-device + tooltip UAT was deferred. Worth 30-60 min device session before scoping anything new.*
   **Why:** every UI change post-Phase-14 has compounded debt — tap that drum before adding new features.

4. **Drop legacy `couchSeating` dual-write**
   *Per Phase 14 LEARNINGS, the dual-write was scheduled to drop after one PWA cache cycle (~1-2 weeks of v34.1). v34.1 deployed 2026-04-26 → drop window opens now.*
   **Why:** dead code, easy delete, removes a write that costs Firestore ops.

### Tier 2 — Strong-signal ideas worth scoping next

5. **Availability notifications (`phase-10x-availability-notifications`)**
   *Research thread 02 ranked this as the highest-value new capability. JustWatch nailed this pattern. Brand fit is excellent (low-volume, high-signal pushes).*
   **Prerequisite:** Provider-data audit — Couch already pulls TMDB providers; small CF watches for changes and pushes diff. Could be 1-2 plans (~6h) if TMDB provider data is reliable.
   **Why:** unique capability JustWatch/Letterboxd don't combine with the family/group layer. Direct moat play.

6. **Custom lists (`phase-10x-custom-lists`)**
   *Research thread 07 ranked #2 missing. Letterboxd-style user-curated lists — "Cozy Sunday Movies", "Brody's Sci-Fi Picks".*
   **Why:** UX-cheap (1 doc primitive + 2 surfaces), enables the **family wishlist surface** that's adjacent to the Worth considering work. Could ladder with Phase 16 calendar (lists feed scheduled rituals).

### Tier 3 — Defer until signal

7. **Phase 16 — Calendar Layer**
   *Already scoped. Real signal: do existing users naturally schedule recurring viewings? If yes, ship; if no, this is feature speculation.*
   **Why deferred:** without signal, calendar surface adds depth without proving value. Better to instrument current usage first.

8. **Phase 10 — Year-in-Review (already deferred)**
   *Per the original 2026-04-25 audit: needs accumulated history + audience to feel substantive. Author's family + a few invites isn't enough yet. Revisit at v1 milestone close + ~3 months of usage data.*

9. **Solo mode (`phase-9x-solo-mode`)**
   *50% addressable market expansion per research, but P0 retroactive privacy dialog + product-direction call ("plural" brand dilution risk). Defer until commercial release path is clear.*

10. **Async replay (`phase-async-replay`)**
    *Today's Phase 15.5 ships the live-ish foundation. The "Red Wedding" use case (watch a series years late and feel the original group's reactions) is the natural follow-on, but only earns priority if Wait Up flex sees usage in production.*

### Tier 4 — Ops + hygiene

11. **Refresh PROJECT.md**
    *11 phases of evolution unrecorded. Validated section is stuck at Phase 3. Drift becomes hard to recover the further it lags.*

12. **Tonight surface invariant test**
    *Today's 6 deploys for the same surface revealed a fragile area. Worth 1 plan to add a node-level smoke test (similar to scripts/smoke-position-transform.cjs) covering the matches/considerable filter rules with mock state — would have caught the v35.5.1-→.5 sequence in 30 seconds.*

13. **Phase 17 prep — privacy policy + ToS**
    *Apple/Google require these before listing. Unblock-able now (no $99 yet) by drafting docs and publishing under `/legal/*`. Doesn't depend on native wrapper choice.*

### Tier 5 — Specific UX tweaks visible from today's session

14. **Tonight surface — show what's happening when matches is empty**
    *Today's session ended at "Tonight's picks" possibly empty if no movie meets the strict pure-couch rule. The empty-state copy could surface a CTA — "Vote yes on something only you on the couch want" or "X movies from your family wishlist below". Right now it just says "No matches yet".*

15. **Pill long-press reliability**
    *Per Phase 14 LEARNINGS, long-press to send push is implemented as toast + Sentry breadcrumb only (Path C — sendCouchPing doesn't actually send a push yet). The user-facing toast says "Push sent to {name}" which is a UX lie. Should bundle with Phase 15.4.*

16. **"Worth considering" subtitle copy A/B**
    *Just shipped: "At least one of you picked these — couch isn't unanimous." Group-agnostic but a touch dry. Alternates worth testing: "Family wants these — couch hasn't all picked them" / "On the radar — not a unanimous tonight pick" / keep as-is and instrument tap-through to see if rephrasing matters.*

---

## F. Open questions for the user

1. **Order of 15.3 vs 15.4** — Should DESIGN-01 (logo) ship first (unblocks App Store assets) or push polish (closes user-facing bugs)? Recommend 15.4 first since it closes broken loops.
2. **Calendar Layer signal** — Do you have user signal that recurring scheduling is the next gap, or is it speculation? If speculation, defer Phase 16 in favor of availability-notifications (Tier 2 #5).
3. **App Store timeline** — Is the $99 Apple Dev account in the picture this milestone or next? That gates Apple Sign-In + App Store flow.
4. **Solo mode** — Is the "plural" brand dilution risk worth the 50% addressable-market expansion? Maybe gather signal from a few solo testers before committing.
5. **PROJECT.md refresh** — Do you want me to bring this up to date as a quick chore now, or batch it with `/gsd-complete-milestone`?

---

## Summary

The app is in good shape — 12/15 v1 phases shipped, single-deploy-day cadence proven (today's 15.5 + 5 hotfixes), real-time multi-device sync working, push CF infrastructure deployed. The "warm restraint" brand voice has held through the build.

The most concrete near-term wins are:
- **Phase 15.4** — closes two known-broken UX loops (sendCouchPing lie, Settings parity)
- **Availability notifications** — strongest moat play that's not yet committed
- **Tonight smoke test** — would prevent more deploy ping-pong like today's

The riskiest decisions are:
- **App Store path** — gating signature work on $99 Apple Dev account commitment
- **Solo mode vs plural-brand identity** — strategic, not tactical
- **PROJECT.md drift** — small chore, but invisible drift compounds

Recommend tackling Phase 15.4 next, while doing the device UAT pass for 15.5 + Phase 14 deferred items in parallel.
