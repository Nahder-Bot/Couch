# Phase 12 — Deferred & Future Considerations

> # ⚠️ THIS IS NOT AN ACTIVE PHASE
>
> **This document is a parking lot, NOT a committed plan.** Items here have been deferred from Phase 11 (or earlier) for review *after Phase 11 ships* and we have real signals about what's actually causing pain.
>
> **Treat this as a docket to revisit, not a roadmap to execute.** Do not run `/gsd-plan-phase 12` against this file. When/if Phase 12 becomes a real phase, it should:
>
> 1. Re-audit every item below against then-current product state (what shipped in Phase 11 might solve some; user feedback might invalidate others)
> 2. Reprioritize based on actual signals, not the order they're listed here
> 3. Possibly split into multiple phases (e.g., Phase 12 = pre-App-Store-launch ADDs, Phase 13 = post-PMF infrastructure, etc.)
> 4. Get its own `/gsd-discuss-phase` + `/gsd-plan-phase` cycle with full requirements derivation
>
> **Until then: this is just a list. Read it as a memory aid.**

---

## Source: deferred from Phase 11 decisions (locked 2026-04-23)

### From decision 5 — Tab restructure ADDs (option b: "restructure now, defer ADDs")

These were explicitly considered for Phase 11 and explicitly deferred. They are **the most likely Phase 12 candidates** because they're already audited and scoped.

#### Family tab ADDs

- **F-NEW-2 — Couch calendar** (recurring + scheduled events list)
  - Why: Sunday-night family movies are a real ritual; today there's no surface for "we always watch on Sunday."
  - Content: lightweight scheduled-watchparty list + recurring nights ("Sunday 8pm — Family movie")
  - Effort: M (~3-4 hrs); requires a recurrence concept new to the data model
  - Likely Phase 12 priority: medium-high (genuine new utility surface)

- **F-NEW-3 — Recent watchparties full drill-down** (with photos from REFR-09 album)
  - Why: social-memory layer — "remember when we watched X?" Closes the post-session loop fully.
  - Note: partially absorbed into Phase 11 REFR-11 Couch history section. Full per-watchparty page with participants + reactions + photos waits on REFR-09 post-session loop having shipped first.
  - Effort: S (~2 hrs) once REFR-09 is live
  - Likely Phase 12 priority: medium (complementary to existing surface, not net-new)

#### Account tab ADDs

- **A-NEW-1 — Per-event-type notification preferences detail** + quiet hours
  - Why: Phase 6 partial UAT flagged "per-event opt-out" as still-pending. REFR-06 asymmetric cadence implies users want granular control.
  - Content: master enable/disable + 4-6 per-event toggles (watchparty starting / intent RSVP requested / veto cap reached / approval pending / push prompt at quiet hours boundary) + quiet hours start/end
  - Effort: M (~3-4 hrs)
  - Likely Phase 12 priority: **high** — this is the closest to "should already be there" from a user-trust perspective

- **A-NEW-2 — Privacy / data controls**
  - Why: App Store will require this when Couch ever submits. GDPR/CCPA right thing to do regardless.
  - Content: "Export my data" (download JSON of votes/reactions/diary entries), "Delete my account" with grace period
  - Effort: M-L (~5-7 hrs); delete is harder than export — needs CF + grace-period semantics
  - Likely Phase 12 priority: **high** if App Store launch is coming; **medium** otherwise

- **A-NEW-3 — Theme / display preferences**
  - Why: future-proof; font-size + reduced-motion overrides are accessibility wins
  - Content: font-size slider (regular / large), motion toggle (full / reduced override), maybe future light-mode hook (no light-mode design exists yet so light-mode toggle would be pre-work)
  - Effort: S (~2 hrs) for font-size + motion; L if light-mode design lands
  - Likely Phase 12 priority: medium (nice-to-have, accessibility-defensive)

- **A-NEW-4 — About / version / feedback / changelog**
  - Why: users want to know what version they're on; you want a feedback funnel
  - Content: "Version: X (deployed YYYY-MM-DD)", "Send feedback" link (mailto or form), "What's new" link (changelog page)
  - Effort: S (~1-2 hrs)
  - Likely Phase 12 priority: medium (low cost, high signal)

### From decision 4 — SMS infrastructure (option a: web-share now, Twilio later)

- **Twilio SMS integration** for non-member nurture automation
  - Why: REFR-06 asymmetric cadence currently works only for members (push-only). Non-member nurture deferred. If "host has to manually share invite link" turns out to be a real conversion bottleneck, layering Twilio on top of the Phase 11 web RSVP route is the unlock.
  - Content: `sendInviteSMS` CF + A2P 10DLC compliance + SMS-specific reminder cadence in addition to push for members
  - Effort: L (~10-12 hrs) + ~$30-60/mo ongoing + ~$50 one-time A2P 10DLC setup
  - Likely Phase 12 priority: **gated on signal** — only if we see "non-member invites are common AND host-share-friction is bottlenecking conversion." Otherwise stays parked indefinitely.

---

## Source: standalone seeds still in `.planning/seeds/`

These pre-existed Phase 11 and weren't absorbed into 9-07a/9-07b/11.

- **`phase-05x-apple-signin.md`** — Sign in with Apple integration. Gated on $99 Apple Developer account purchase. Required for App Store launch.
- **`phase-07-watchparty-lifecycle-transitions.md`** — Backend behavioral cleanup of watchparty state-machine edges (cleaner transitions between scheduled/lobby/live/ended states). Was deferred from Phase 7 closure. May overlap with Phase 11 REFR-07 lobby work — re-audit when REFR-07 ships.
- **`phase-9x-gif-reactions.md`** — Add GIF reactions in addition to emoji. Stretch UX. May conflict with per-user reaction-delay moat (GIFs harder to delay-render); needs review.
- **`phase-9x-solo-mode.md`** — Solo-watcher mode (single-person picks without family). Adjacent to Couch's "couch is plural" identity; may dilute brand. Needs product-direction call.
- **`phase-9x-async-replay.md`** — Watchparty replay for those who couldn't make it live. Big feature (recording reactions + scrubber). Likely v2.
- **`phase-10x-star-ratings-reviews.md`** — Expanded review/rating system. Probably consolidates with Phase 10 YIR work.
- **`phase-10x-custom-lists.md`** — User-created lists beyond the existing "Lists" surface. Lower priority unless requested.
- **`phase-10x-availability-notifications.md`** — Notify users when a "Want to watch" title becomes available on their streaming service. Genuinely useful; depends on TMDB providers data + diff-detection cron.
- **`phase-11-teen-mode.md`** — Teen-specific mode (limits, peer features). Audience expansion; ties to "Friends" audience card from Phase 9 landing.

---

## Source: competitive research whitespace (from Phase 11 RESEARCH)

These came up as "nobody ships this; Couch could differentiate" but weren't absorbed into Phase 11 scope:

- **Rolling "couch calendar"** — recurring Sunday-night groups with auto-generated ballots from unseen watchlist overlap. Overlaps with F-NEW-2.
- **Availability-aware ballot filtering** — auto-dim titles nobody in the group can stream during the vote phase.
- **Kid-mode ballots** — family-night picker with rating caps, per-viewer veto weight, and parental final-say.
- **Post-watch reaction capture feeding future ballot weight** — closes the loop Letterboxd opens but doesn't connect to group decisions.
- **Async-first nominate flow** — collect RSVPs over hours rather than minutes (REFR-05 starts this; deeper async patterns possible).
- **Availability-aware invitations** — "who's free Sat 9pm?" poll fused with the ballot.
- **Spoiler-safe group chat** — auto-locks to pre-watch discussion until press-play, then unlocks episode-by-episode.

---

## Source: operational / commercial-readiness items

These aren't features — they're maturity work that needs doing before broad commercial launch.

- **App Store native wrapper** — Capacitor or PWABuilder to ship to iOS App Store + Google Play. Required for the Phase 1 milestone goal "iOS App Store + Android Play Store" delivery.
- **Privacy policy + Terms of Service authoring** — `/privacy.html` + `/terms.html` exist on the site already. Footer of landing.html has a deliberate `<!-- TODO pre-launch -->` comment for wiring. Legal copy authoring is a separate lift.
- **App Store Connect setup** — listings, screenshots (Phase 9 plan 09-06 handles 5 of these), categories, age rating, App Privacy declarations.
- **Server-side cost optimization** — TMDB caching layer (could move expensive lookups to a CF + Firestore cache); Firestore quota review at scale.
- **Observability / error monitoring** — Sentry or similar. Currently Couch logs errors to console only.
- **Accessibility audit** — WCAG AA pass. The 09-02 token layer added contrast notes; full audit not yet done.

---

## Source: explicit non-goals from Phase 11 worth revisiting

These were intentionally NOT built in Phase 11. Re-evaluate post-PMF.

- **Voice/video chat tiles in watchparty** — incompatible with per-user reaction-delay moat. Revisit if user feedback shows demand.
- **Real-money or prediction-betting layer** — state-by-state regulated. Revisit only if strong signal.
- **Cross-UID data migration** — merging two existing Firebase users' group memberships. Firebase provides no safe automated path.
- **Container queries for component-context-aware layouts** — research recommended media-queries-only for Phase 9; revisit if reuse grows.

---

## How to use this document

1. **Don't execute against it.** This is a memory store, not a plan.
2. **Re-audit when you're ready to scope Phase 12.** Run a fresh `/gsd-discuss-phase 12` against current product state. Many items here will have been solved by Phase 11 shipping; some will be invalidated by user feedback; some will turn out to be more urgent than they look today.
3. **Consider splitting.** "Phase 12" could easily become 2-3 distinct phases:
   - **Phase 12 — Pre-App-Store ADDs** (notification prefs, data controls, privacy/terms wiring, Apple sign-in)
   - **Phase 13 — App Store launch** (native wrapper, listings, asset prep)
   - **Phase 14 — Post-PMF infrastructure** (Twilio SMS, observability, cost optimization)
4. **Promote items by editing this doc.** When a parked item becomes a real candidate, copy it into a new phase's `/gsd-discuss-phase` input or directly into `REQUIREMENTS.md`.

---

**Document created 2026-04-23 during Phase 11 scoping conversation. All items here are deferred-from-decisions, not user-requested for Phase 12.**

**STRONG REMINDER: review every item before promoting. Do not assume any of these is still relevant when Phase 11 closes.**
