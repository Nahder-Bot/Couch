---
phase: 27-guest-rsvp
type: context
created: 2026-05-02
updated: 2026-05-02
status: ready-for-research
authored_via: /gsd-discuss-phase 27
gray_areas_discussed: 4
decisions_locked: 7
---

# Phase 27 — Guest RSVP — CONTEXT

## Domain boundary

Non-member guests RSVP to a single watchparty without creating a Couch account. Capture display name + going/maybe/no via the existing `/rsvp/<token>` page (Phase 11). Decide what a "guest" *is* in the watchparty model after they tap — visibility on roster, lifecycle, push policy, kick flow.

**In scope:** Token-based guest RSVP signal capture, guest visibility on watchparty roster, lifecycle (creation → expiry → archive), kick/revoke flow, web push opt-in for guests, minimal privacy disclosure.

**Out of scope (explicitly):**
- Guests creating watchparties (would require some form of auth)
- Guests becoming permanent members later (Phase 5x territory — `consumeGuestInvite` for family-wide guest membership)
- Multi-watchparty guest sessions (each token = one wp)
- Guests posting reactions, voting on Wait Up, seeing member chat (RSVP signal-only per D-01)
- Email-based reminders (would reintroduce signup-style friction)
- Native push (iOS/Android) — only web push is in scope

## Carrying forward (already shipped)

- **`rsvp.html` standalone page** (Phase 11 / REFR-05): zero Firebase SDK, ~120 lines, served at `/rsvp/<token>` via Hosting rewrite, mirrors `landing.html` zero-shell posture
- **`rsvpSubmit` unauth onCall CF** (Phase 11 / `queuenight/functions/src/rsvpSubmit.js`): token-validated, idempotent, admin-SDK; today writes `{response, name}` directly to a wp's RSVP collection
- **`rsvpReminderTick` scheduled CF** (Phase 11): runs every 15 min; sends pushes to **members only** today on asymmetric cadence (Yes T-24h+T-1h, Maybe T-7d+T-24h+T-1h, NotResp T-48h+T-4h, No silent)
- **Phase 5 `members[].temporary` shape** (partially shipped — Phase 5x `phase-05x-guest-invite-redemption.md` describes the gap for *family* guest invites; Phase 27 explicitly does NOT use this shape — see D-01)
- **Hosting rewrite** `/rsvp/** → /rsvp.html` with token preserved in URL for client-side parsing (Phase 11)
- **Privacy surface** `/privacy` (Phase 13): existing landing.html-style legal page; Phase 27 links to it from rsvp.html footer

## Decisions

### D-01 — Guest schema + watchparty surface = per-wp `wp.guests[]` array, RSVP signal-only

Guests are stored as rows in a new `wp.guests[]` array on the watchparty doc:
```js
wp.guests: [
  { guestId, name, response, rsvpAt, expiresAt, revoked?, pushSub? },
  ...
]
wp.guestCount: number  // denormalized for roster headers
```

**Surface for guests:** read-only event card on rsvp.html showing what they RSVP'd, party time, and aggregate counts (e.g., "3 going · 1 maybe"). **No party-page access** — guests do NOT load app.html, do NOT see member chat, do NOT post reactions or vote on Wait Up.

**Why not `members[].temporary`?** That shape is Phase 5x territory (joining family as guest with cross-wp visibility). It would leak other family content beyond the single wp the guest was invited to.

**Why not RSVP-doc-only collection?** Roster render would need an extra query per wp. The denormalized `wp.guests[]` array means the existing wp snapshot already carries guest data — zero extra reads.

**Lifecycle:** `wp.guests[]` dies with the wp's archive cycle (existing `WP_ARCHIVE_MS`). Aligns with the "RSVP = signal-only, not membership" framing.

### D-02 — Token TTL = `wp.startAt + WP_ARCHIVE_MS`

Token stays valid from invite-mint until the wp auto-archives (~5h post-start, existing constant). Guest can RSVP late, change their mind during the party, etc. Single source of truth tied to wp lifecycle (matches D-01).

### D-03 — Identity continuity = localStorage `guestId` per token

On first RSVP submit, mint a `guestId` (random 16-byte, URL-safe base64) and store in `localStorage` keyed by `qn_guest_<token>`. Subsequent submits from the same browser reuse the guestId → CF UPDATEs the existing `wp.guests[]` row instead of appending. Same browser = same guest. Different browser/incognito = new guest (acceptable; anonymous-ish identity model).

Handles change-of-mind ("going" → "maybe" → "going") cleanly without server-side token-to-guest mapping.

### D-04 — Name collision = `(guest)` suffix on display only when collision detected

Storage is unchanged: `wp.guests[].name = "Alex"` whether or not a member "Alex" exists. The `(guest)` suffix is added at **render time** when the renderer detects a name collision against the family roster.

Always pair with the existing `badge-guest` apricot pill (Phase 5 / DESIGN-03 token) for visual reinforcement. Zero friction at the input step.

**Render rule:**
```
if (familyMemberNames.has(guestName)) → render: "{guestName} (guest)" + apricot pill
else                                  → render: "{guestName}" + apricot pill
```

### D-05 — Privacy/ToS = one-line footer link to existing `/privacy`

rsvp.html footer:
> "By tapping going/maybe/no, you agree to our Privacy Policy."

Link to existing `/privacy` page (Phase 13). Zero modal friction. Matches the lightweight zero-SDK posture of rsvp.html.

**Phase 13 compliance posture is satisfied:** data collected is minimal — `{name, response, timestamp, guestId}`. No email, phone, or auth identity. No FCM token unless the guest opts in to push (D-06).

### D-06 — Push notifications = Web Push opt-in on rsvp.html

After successful RSVP, rsvp.html shows an opt-in CTA: "Get reminded when the party starts?" Tapping subscribes to FCM web push under the guestId, stores the push subscription on `wp.guests[].pushSub`. Reminders piggyback on existing `rsvpReminderTick` CF (filter expanded to include guests via `wp.guests[]` enumeration).

**Known tradeoff (researcher must investigate):** iOS web push requires PWA install via Safari 16.4+. One-shot guests are unlikely to install Couch as a PWA, so iOS guests will silently get no push. Acceptable for v1 since the rsvp.html surface itself is iOS-friendly and the host can pass party reminders manually if needed. Researcher should:
1. Document the iOS PWA-install requirement (Safari 16.4+, no Chrome iOS support)
2. Confirm Android Chrome / desktop Safari/Chrome/Firefox all work without install
3. Render a graceful "Push not supported on this device" state when notification permission API unavailable

**Reminder cadence for guests:** match the asymmetric cadence used for members (Yes T-24h+T-1h, Maybe T-7d+T-24h+T-1h, NotResp T-48h+T-4h, No silent). Idempotency flag: `wp.reminders.{guestId}.{windowKey}` (mirrors existing member pattern).

### D-07 — Revoke / kick flow = per-guest soft-delete + secondary 'close RSVPs' control

**Primary kick mechanism:** Host taps 'remove' on a guest chip in the wp roster → CF sets `wp.guests[i].revoked: true` (soft delete, preserves audit trail). Guest's next visit to `/rsvp/<token>` shows "Your RSVP was removed by the host." Token still validates (not invalidated globally), so kicking one guest doesn't break the link for other RSVP'd guests.

**Secondary control:** Host can tap 'close RSVPs for this party' → invalidates the entire token by deleting the invite doc OR setting `wp.rsvpClosed: true` (researcher to choose simplest implementation). All token-uses fail after that.

**Real-time eviction:** Connected guests on rsvp.html should react to `wp.guests[i].revoked` flipping true within one snapshot cycle (rsvp.html runs a Firestore listener post-RSVP for the `wp.guests[]` aggregate counts; same listener can detect own-row revocation).

## Specifics

- **rsvp.html stays zero-SDK** for the initial RSVP path (existing Phase 11 contract). The Firestore listener for D-07 real-time eviction can be added post-RSVP (after the user has explicitly engaged) — keeps the cold-load light.
- **`(guest)` suffix is render-time only**, never stored. Storage stays "Alex"; render becomes "Alex (guest)".
- **`guestId` is the source of truth for identity**, not the name. Two guests named "Sam" both get unique guestIds and appear as separate rows on the roster.
- **wp.guestCount denormalized** so the wp banner can show "5 going · 2 guests" without iterating wp.guests[].
- **No guest-side reactions or Wait Up votes in v1** (per D-01 surface scope). If user demand emerges post-v1, that's a separate phase.
- **Guest count display on rsvp.html** is anonymized aggregate ("3 going · 1 maybe"), not per-name. Members see the full guest names on the roster; guests see counts only on rsvp.html. Privacy posture: guests don't need to see other guests' names to make their own RSVP decision.

## Claude's Discretion

- **Where the "remove" control lives** in the roster UI — likely a long-press or a kebab menu on the guest chip, mirroring the existing member-remove pattern from Phase 5. Planner picks the exact placement.
- **`guestId` format** — 16-byte URL-safe base64 (matches the `inviteGuest` CF token convention from Phase 5x seed). Researcher confirms.
- **`wp.guests[]` count cap** — implementation detail. Defer to CF-level rate limiting (Phase 13 compliance) rather than schema cap. Planner can add a soft cap (e.g., 50 guests/wp) if it simplifies rules.
- **Web push subscription storage shape** — `wp.guests[i].pushSub` as the FCM subscription object directly, vs a hash/reference. Researcher decides based on Firestore doc-size budget (wp doc has many other denormalized fields).
- **`rsvpClosed: true` vs deleting invite doc** for D-07's secondary 'close RSVPs' — researcher picks the simpler/safer option.
- **Listener strategy on rsvp.html** for D-07 real-time eviction — Firestore web SDK adds payload weight to the otherwise-zero-SDK page. Researcher decides if a lightweight onSnapshot is worth it, or if a 30s polling fallback suffices.

## Deferred Ideas

- **Guest can post reactions in replay mode** — Phase 26's compound-write contract includes `runtimeSource: 'replay'`. A guest viewing the wp post-archive could in theory post replay reactions, but D-01 limits guests to the rsvp.html surface, no party-page access. If demand emerges, a future phase can extend the rsvp.html surface to include a read-only replay view + opt-in reaction posting under the guestId.
- **Guest converts to member later** — Phase 5x territory. After RSVPing, prompt the guest "Want to join {family} as a member?" Out of scope for Phase 27; queue if user-research signals demand.
- **Multi-wp guest session** — One token works for all of a family's wps. Decoupled from Phase 27's single-wp scope. Could be Phase 27.x or an independent phase.
- **Email-based reminders** — Would require email field, reintroduces signup friction. Out of scope per D-06 framing.
- **Calendar invite (.ics file) on RSVP** — Mature add-on. Out of scope for v1.

## Canonical refs

- `.planning/ROADMAP.md` § Phase 27 (goal + dependencies + 4 pre-noted gray areas)
- `.planning/seeds/v2-watchparty-sports-milestone.md` § Phase 27 (independence framing)
- `.planning/seeds/phase-05x-guest-invite-redemption.md` (related Phase 5x scope — `members[].temporary` family-guest model that Phase 27 explicitly does NOT use, see D-01)
- `.planning/phases/11-feature-refresh-and-streamline/11-04-PLAN.md` (existing rsvp.html + rsvpSubmit CF + rsvpReminderTick CF that Phase 27 builds on)
- `.planning/PROJECT.md` (project posture: PWA, Firestore per-family nesting, public-by-design API keys)
- `CLAUDE.md` § Architecture (rsvp.html, sw.js CACHE convention, deploy.sh, ⚠ Token cost — read only what you need: js/app.js is ~15800 lines)
- `.planning/REQUIREMENTS.md` (Phase 27 RSVP-* IDs to be assigned during /gsd-research-phase 27 → /gsd-plan-phase 27)
- `rsvp.html` (existing — Phase 11 zero-SDK page, ~120 lines, parse token from URL, call rsvpSubmit CF on tap)
- `css/rsvp.css` (existing — Phase 11 standalone CSS, ~80 lines)
- `queuenight/functions/src/rsvpSubmit.js` (existing CF — admin-SDK, idempotent, token-validated)
- `queuenight/functions/src/rsvpReminderTick.js` (existing scheduled CF — Phase 27 expands its filter to include guests)
- `firestore.rules` (will need rules for `wp.guests[]` array writes via the rsvpSubmit CF — admin-SDK bypass should already cover this; researcher confirms)
- `seeds/phase-roadmap-2026-04-25-audit.md` (audit context for v2 phase ordering)

## Open questions for researcher

1. **iOS Safari web push reality check (D-06):** What's the install-friction landscape on Safari 16.4+? Document the no-PWA-install path explicitly so we know the iOS guest rate. Confirm Android Chrome / desktop work without install.
2. **Firestore rules for `wp.guests[]` writes (D-01, D-07):** Confirm admin-SDK CF writes bypass rules cleanly when adding/updating/soft-deleting array elements. Check for ArrayUnion/ArrayRemove gotchas with object elements (typically requires read-modify-write in CF).
3. **`rsvpSubmit` CF backward compat (D-01, D-03):** Today the CF takes `{token, response, name}`. Phase 27 needs to also handle `{guestId}` (D-03 continuity). Plan the additive parameter migration so Phase 11's existing flow doesn't break.
4. **rsvp.html bundle size budget (D-07):** If we add a Firestore SDK listener for real-time eviction, what's the cold-load weight? Compare against polling fallback. Phase 11's "zero Firebase SDK" contract should be revisited explicitly — is it still the right posture, or is a tiny SDK acceptable now?
5. **wp.guests[] array growth + denormalized counts (D-01):** Confirm the wp doc stays under Firestore's 1MB doc-size limit even with 50+ guests + push subs. If risky, plan a sub-collection fallback.
6. **`rsvpReminderTick` scope expansion (D-06):** The existing CF iterates members for push targets. Phase 27 needs to also iterate `wp.guests[]` filtered to those with `pushSub` set. Confirm the CF's existing query pattern can absorb this.

## Folded todos

(none — no pending todos matched Phase 27 scope on this pass)

## Next steps

1. Run `/gsd-research-phase 27` to investigate the 6 open questions above and produce RESEARCH.md (researcher will read this CONTEXT.md as the locked-decisions input).
2. Or skip directly to `/gsd-plan-phase 27` if you want planning to proceed with the 7 locked decisions and let the planner surface remaining ambiguity.
3. Recommended: `/gsd-plan-phase 27` (it auto-runs research → pattern-mapping → planning → plan-check in sequence).
