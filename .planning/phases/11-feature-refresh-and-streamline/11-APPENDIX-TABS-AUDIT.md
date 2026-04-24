# Phase 11 Appendix — Family + Account tab section-by-section audit

**Created:** 2026-04-23 in response to user direction to "reorganize but also review if we should trim, edit, add, or reframe things."
**Goal:** for every section in both tabs, record what it does today, evaluate value, and propose KEEP / TRIM / EDIT / REFRAME / CUT / ADD with specific actions.

> **DECIDED 2026-04-23: option (b) — accept restructure now, defer ADDs to Phase 12.**
>
> Plan 11-02 ships the proposed Family tab (6→5 sections) + Account tab (9→3 cognitive clusters) restructure. NEW sections (Tonight status block F-NEW-1, Couch calendar F-NEW-2, Recent watchparties F-NEW-3 on Family; Notification preferences detail A-NEW-1, Privacy/data controls A-NEW-2, Theme prefs A-NEW-3, About/version/feedback A-NEW-4 on Account) defer to Phase 12 to keep Phase 11 scoped to existing-content reorganization.
>
> Note: F-NEW-3 "Recent watchparties" is partially absorbed via the Couch history consolidation (REFR-11 commits F5+F6+recent into one section). Full per-watchparty drill-down with photos waits for REFR-09 post-session loop to ship.

---

## Family tab — current 6 sections

### F1 — Tab hero + stat grid
- **What:** "Your couch" eyebrow + serif headline ("Everyone on the couch") + horizontal stat grid (member count, queue size, watched count, etc.)
- **Renderer:** populated by `renderFamilyHeader()` and `renderFamilyHeroStats()` (inferred from `id="family-hero-stats"`)
- **Value:** medium-high — sets identity + provides at-a-glance pulse on group health
- **Recommendation:** **KEEP + EDIT.** Stats grid feels generic. Replace with 2-3 *story-telling* stats: "Last watched: [title]", "Picked tonight: [name]", "Next scheduled: [title @ time]". Information density up, decoration down.

### F2 — Approvals card (kids waiting)
- **What:** promoted accent card when kids have requests pending parent approval
- **Renderer:** `renderApprovalsCard()` at js/app.js:4356
- **Value:** high (when present) — solves a real coordination friction (kids' titles otherwise don't show up)
- **Recommendation:** **KEEP unchanged.** Conditional render is correct; no daily clutter when empty.

### F3 — Members list
- **What:** chips/cards of all members in the family
- **Renderer:** `renderMembersList()` at js/app.js:4579
- **Value:** high — primary identity surface for the group
- **Recommendation:** **KEEP + EDIT.** Currently a flat list. Propose: split into "On the couch" (active members) vs "Off-couch" (sub-profiles, guests, dormant). Makes the active group feel tighter; sub-profiles get visible parental control.

### F4 — "Who picks tonight" section
- **What:** displays the rotation status + setup CTA for the spinnership feature
- **Renderer:** `renderPickerStrip()` at js/app.js:4547
- **Value:** previously medium; *user explicitly flagged for hide* in REFR-02
- **Recommendation:** **CUT (per REFR-02).** Section disappears. Backend rotation logic stays (preserved per option 3b earlier).

### F5 — Family favorites (shown when 2+ members rated)
- **What:** highlights titles 2+ family members rated highly
- **Renderer:** rendered in `renderFamilyTab` flow (no standalone function name found)
- **Value:** medium — interesting social signal, but only shows up after enough rating volume
- **Recommendation:** **KEEP + REFRAME.** Combine with F6 (per-member breakdown) into a single "Couch history" section. Reduces section count. Add: "Recently watched together" sub-block showing last 3-5 watchparties (closes loop with REFR-09 post-session photo album).

### F6 — Per-member breakdown ("Who's watched what")
- **What:** table-ish breakdown of what each person has watched
- **Renderer:** `renderStats()` at js/app.js:4301 (also feeds Account tab)
- **Value:** medium — interesting once a quarter; daily clutter otherwise
- **Recommendation:** **TRIM + REFRAME.** Move into the consolidated "Couch history" section from F5. Show top-3 most-watched per member instead of full breakdown; "See everything" link → modal for full data.

### F7 — Invite/Share section
- **What:** displays the shareable family code + URL
- **Renderer:** `renderShareSection()` (inferred)
- **Value:** medium — needed but doesn't need its own section
- **Recommendation:** **EDIT + REFRAME.** Move into a compact "Group settings" footer block. Pair with: "Group name" (editable), "Group code", "Generate guest invite" (links to existing functionality).

### NEW — Things to ADD that are missing today

#### F-NEW-1 — "Tonight on the couch" status block (top, replaces the bare hero)
- **Why:** the family tab should answer "what's the family up to right now?" immediately
- **Content:** active watchparty (if any) → CTA to join. Active intent (if any) → CTA to RSVP. Otherwise: latest pick / today's couch invitation / next scheduled.
- **Effort:** S

#### F-NEW-2 — "Couch calendar" (recurring + scheduled)
- **Why:** Rolling Sunday-night family movies are a real ritual. Today there's no surface for "we always watch on Sunday."
- **Content:** lightweight list of scheduled watchparties + recurring nights (e.g., "Sunday 8pm — Family movie")
- **Effort:** M (introduces a recurrence concept; could be a stretch / Phase 12)

#### F-NEW-3 — "Recent watchparties" log
- **Why:** social-memory layer — "remember when we watched X?" Closes the post-session loop.
- **Content:** last 3-5 watchparties, click to see participants + reactions + photos (from REFR-09 post-session album)
- **Effort:** S — uses existing watchparty data

### Family tab — proposed restructure (5 sections, down from 6)

1. **Tonight status** (F-NEW-1) — active watchparty / intent / next scheduled — replaces the bare hero
2. **Approvals** (F2 unchanged, conditional)
3. **Members** (F3 edited — split active / sub-profiles)
4. **Couch history** (F5 + F6 consolidated + F-NEW-3 recent watchparties)
5. **Group settings footer** (F7 reframed + group name editing + guest invites)

OUT: F4 picker section (REFR-02). Optional: F-NEW-2 calendar if/when recurrence ships (defer to Phase 12).

---

## Account tab — current 9 sections

### A1 — Identity strip + greeting
- **What:** "Your account" eyebrow + greeting + avatar + name + family + auth email
- **Renderer:** `renderSettings()` at js/app.js:4440
- **Value:** medium-high — clear "this is you" anchor
- **Recommendation:** **KEEP unchanged.** Maybe add: "Switch group" pill if user has multiple group memberships (already exists elsewhere as `#group-pill` — this is the natural account-tab home for it).

### A2 — Year in Review card (currently placeholder)
- **What:** promoted accent card for YIR feature
- **Renderer:** static HTML; populated by Phase 10 work
- **Value:** *currently low* (placeholder); *post-Phase-10 high*
- **Recommendation:** **KEEP placement, EDIT visibility.** Today it's a confusing placeholder. Either: (a) hide entirely until Phase 10 ships (reduces clutter today), or (b) reframe as "Coming soon" with a small soft surface so users know what's planned. Recommend (a) — hide until Phase 10. Re-promote then.

### A3 — Streaming services picker
- **What:** grid of streaming service icons; user taps to mark "I have this"
- **Renderer:** `renderServicesPicker()` at js/app.js:4343
- **Value:** high — gates the "Only what I can watch" filter
- **Recommendation:** **KEEP + EDIT.** Section is fine functionally. Add: "Quick-add via account email" if Trakt or similar can auto-detect (probably not — leave as manual). Consider: condense to 2-row icon grid instead of large grid for visual rhythm.

### A4 — Trakt sync (conditional)
- **What:** Trakt connect/disconnect + sync status
- **Renderer:** `renderTraktCard()` at js/app.js:4477
- **Value:** medium — only matters to ~5% of users (Trakt-using power users)
- **Recommendation:** **KEEP + REFRAME.** Move into a collapsible "Integrations" group (with future: Letterboxd import, IMDb watchlist import). Reduces visual weight when not used; future-proofs.

### A5 — Notifications (conditional)
- **What:** push-notification opt-in status + enable button
- **Renderer:** rendered inside `renderSettings`
- **Value:** high — direct UX gateway for push permission
- **Recommendation:** **KEEP + EDIT.** Currently: just on/off. Add: per-event-type toggles (REFR-06 setup) — "Watchparty starting", "Intent RSVP requested", "Veto cap reached", "Approval pending". Quiet hours pref. This is the "Notifications preferences" surface that should have shipped with Phase 6.

### A6 — Sub-profiles (Kids)
- **What:** create/edit/delete sub-profiles for kids without their own accounts
- **Renderer:** populates `#subprofile-list` via inferred function
- **Value:** medium-high for families; null for childless duos
- **Recommendation:** **KEEP + REFRAME.** Move into a "Couch members" section that pairs with the F3 split — "people on the couch" vs "people I represent" (sub-profiles). Same content, different framing aligned with Family tab restructure.

### A7 — Owner-only group admin (conditional)
- **What:** password, guest invites, ownership transfer, claim members, grace banner
- **Renderer:** `renderOwnerSettings()` at js/app.js:2554
- **Value:** high for owners (5-10% of users); null for everyone else
- **Recommendation:** **KEEP + EDIT.** Currently dense and intimidating. Group into 3 sub-cards: "Group security" (password, invites), "Member admin" (claims, ownership transfer), "Group lifecycle" (grace banner, dangers like delete). Reduces cognitive load; admins still find what they need.

### A8 — Keyboard shortcuts (conditional)
- **What:** "Press ? for cheat sheet" tiny hint
- **Renderer:** static HTML, conditional via JS
- **Value:** low — true power-users find it; everyone else ignores
- **Recommendation:** **KEEP unchanged.** Already minimal; doesn't hurt.

### A9 — Sign out / leave family footer
- **What:** two pills at bottom
- **Renderer:** static HTML
- **Value:** high (when needed)
- **Recommendation:** **KEEP + EDIT.** "Leave family" is destructive and adjacent to "Sign out" — easy mis-tap. Add: confirmation modal before "Leave family". Add: "Delete account" (privacy/GDPR consideration; required for App Store eventually anyway).

### NEW — Things to ADD that are missing today

#### A-NEW-1 — Notification preferences (per-event-type granularity)
- **Why:** REFR-06 requires per-event toggles + quiet hours. Phase 6 partial UAT flagged "per-event opt-out" as still-pending.
- **Content:** master enable/disable + 4-6 per-event toggles + quiet-hours start/end
- **Effort:** M

#### A-NEW-2 — Privacy / data controls
- **Why:** App Store requires (when shipped). Also right thing to do.
- **Content:** "Export my data" button (download JSON of votes/reactions/diary entries), "Delete my account" with grace period
- **Effort:** M-L (delete is harder than export — needs CF + grace period semantics)

#### A-NEW-3 — Theme / display preferences
- **Why:** future-proof. Locked to dark today, but font-size / reduced-motion overrides are accessibility wins.
- **Content:** font-size slider (regular / large), motion toggle (full / reduced override), maybe future light-mode hook
- **Effort:** S — mostly CSS variable overrides

#### A-NEW-4 — About / version / feedback
- **Why:** users want to know what version they're on; you want a feedback funnel
- **Content:** "Version: 1.0 (deployed 2026-04-22)", "Send feedback" link (mailto or form), "What's new" link (changelog)
- **Effort:** S

### Account tab — proposed restructure (3 clusters from 9 sections)

**Cluster 1 — You** (identity + your profiles)
- A1 Identity strip
- A6 Sub-profiles ("people I represent")
- A-NEW-3 Display preferences

**Cluster 2 — Couch-wide** (your account in the group)
- A3 Streaming services
- A4 Trakt sync (under "Integrations" expandable)
- A5 + A-NEW-1 Notifications (with per-event detail)
- A2 YIR (hidden until Phase 10)

**Cluster 3 — Admin & maintenance**
- A7 Owner-only group admin (sub-grouped: security, members, lifecycle) — visible to owners only
- A-NEW-4 About / version / feedback
- A-NEW-2 Privacy / data controls
- A8 Keyboard shortcuts
- A9 Sign out / leave family / delete account

Same content (mostly), clearer cognitive grouping. 9 sections → 3 clusters with sub-sections.

---

## Decision needed

For **REFR-11 (Family) + REFR-12 (Account)**:
- (a) **Accept this audit as-is** — proposed restructure with all KEEP/TRIM/EDIT/CUT/ADD calls
- (b) **Accept the restructure but defer the ADDs** to Phase 12 — keeps Phase 11 scoped to existing-content reorganization only
- (c) **Override specific calls** — tell me which sections you want kept/cut differently
- (d) **Do less** — pure reorganize-only (no edits, no cuts, no adds beyond what REFR-02 already removes)

My recommendation: **(b)** — restructure is the right call now, but bundling A-NEW-2 (data export/delete) and A-NEW-3 (theme prefs) into Phase 11 inflates scope. Defer ADDs to Phase 12 unless one stands out as "I need this now."

---

**Reply with `(a)`/`(b)`/`(c)` + any overrides, or specific section calls if you want to override piecemeal.**
