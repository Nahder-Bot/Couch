# Phase 8: Watch-Intent Flows - Context

**Gathered:** 2026-04-22 (autonomous, `/gsd-discuss-phase 8 --auto`)
**Status:** Ready for planning

<domain>
## Phase Boundary

Introduce two first-class flows that sit **alongside** Couch's existing Yes/No/Maybe per-title voting: **Tonight @ time** (time-bound RSVP to a specific movie at a specific time tonight-ish) and **Watch-this-title** (content-bound interest poll without a time commitment). Both converge into the Phase 7 watchparty or the existing schedule system when a family-size-aware threshold is hit. Both cleanly expire with no Firestore orphans. Per-member intent activity is logged in a shape Phase 10 Year-in-Review can aggregate (most-anticipated, most-wanted-never-watched).

Intent flows are **separate from the general vote system**. A member can have a standing "yes" vote on The Matrix (meaning "I'd watch it") AND a "no" RSVP to tonight-at-9pm's specific Matrix intent poll (meaning "not tonight, too tired"). Different signals, different lifecycles.

**In scope:** New `families/{code}/intents/{id}` subcollection with discriminated type. Start-flow entry points on the existing title-detail action sheet. RSVP modal (yes/no/maybe/later). Open-intents strip on Tonight screen. Group-size-aware threshold resolution (duo→any-yes, crew→any-yes, family→majority, configurable per-family). Match-then-prompt conversion UX: intent poll → watchparty launch OR schedule-for-later; tonight@time → watchparty launch. Expiry CF (`intentsTick` or extend `watchpartyTick`). Phase 6 push integration via two new eventTypes (`intentProposed`, `intentMatched`).

**Out of scope (deferred):**
- Public / cross-family intent polls — family-scoped only in v1
- Intent polls on titles not yet in the family's catalog — gated on title already being added
- Per-member intent history view (Phase 10 YIR consumes the same data for its recap)
- Rich intent UX (animated match reveal, confetti, etc.) — Phase 9 polish
- Intent-flow for watchparty replay / historical parties — n/a
- Tonight@time "multi-title" flows (e.g., "movie night, pick one of these three") — v1 is one title per intent
- Auto-demoting intents that match an existing active watchparty — user just sees both and picks

</domain>

<scaffolding_already_in_place>
## What's Already Shipped

**Downstream agents: read before proposing new primitives.**

### Data layer
- Firestore family doc already has `mode: 'family' | 'crew' | 'duo'` — used at line 1360 for queue copy and elsewhere for group-size behavior
- Members doc has `uid` + `managedBy` (Phase 5 attribution) — used for "who can RSVP on behalf of whom"
- Titles already carry `scheduledFor` (unix ms) + `scheduledNote` — the existing schedule-a-title system that intent polls can convert into
- `writeAttribution()` helper (Phase 5) — use it on every intent write
- Firestore rules scope all writes to family members (Phase 5 Plan 04) — new `intents` subcollection inherits same pattern

### UX / code surfaces
- Title-detail action sheet (`openActionSheet`, `js/app.js:8600ish`) — has 🎬 Start watchparty, 📅 Schedule, 🚫 Not tonight. Natural home for the new intent entries.
- Tonight screen already has `wp-banner-tonight` div — pattern for a second "open-intents" strip
- `renderWatchpartyBanner` pattern (Phase 7 reuse) — same onSnapshot+tick approach for intents

### Push (Phase 6)
- `notificationPrefs` map + `sendToMembers(... eventType ...)` — add two new eventTypes:
  - `intentProposed` (default ON)
  - `intentMatched` (default ON)
- `NOTIFICATION_DEFAULTS` + client `DEFAULT_NOTIFICATION_PREFS` + client `NOTIFICATION_EVENT_LABELS` all get 2 new rows

### Watchparty (Phase 7)
- `confirmStartWatchparty(titleId)` API — intent conversion calls this directly
- `openScheduleModal(titleId)` for the time-shift case

</scaffolding_already_in_place>

<decisions>
## Implementation Decisions

### Schema — single collection, discriminated type

- **D-01:** **`families/{code}/intents/{id}` holds both flow types** with `type: 'tonight_at_time' | 'watch_this_title'`. Same schema diff except `proposedStartAt` (required on tonight_at_time, absent on watch_this_title). Single onSnapshot listener, single rules block, single Firestore index.
- **D-02:** **Doc shape:**
  ```
  { id, type, titleId, titleName, titlePoster,
    createdBy (memberId), createdByUid, createdAt,
    proposedStartAt?,                         // tonight_at_time only
    proposedNote?,                            // optional free text
    rsvps: { [memberId]: { value: 'yes'|'no'|'maybe'|'later', at, actingUid, memberName } },
    thresholdRule: 'any_yes'|'majority',      // resolved at create time from family.mode + family.intentThreshold override
    status: 'open'|'matched'|'converted'|'expired'|'cancelled',
    expiresAt,                                // computed at create time
    convertedTo?: { type: 'watchparty'|'schedule', id, at },
    matchedAt?                                // stamped when threshold crossed
  }
  ```
- **D-03:** **RSVP semantics:**
  - `yes` = "I'm in" (counts toward threshold)
  - `maybe` = "probably" (does NOT count toward threshold in v1 — keep decision binary; revisit if families find it too strict)
  - `no` = "I can't / won't" (doesn't count negative against threshold, just doesn't count as yes)
  - `later` = watch_this_title only — "some other time, keep it on the list" (ambiguous signal, doesn't count as yes)

### Threshold rules (INTENT-04)

- **D-04:** **Default per group mode:**
  - `duo` → `any_yes` (2 people; any yes other than creator = match)
  - `crew` → `any_yes` (3–4 people; low friction — one co-signer is enough)
  - `family` → `majority` (5+ people; >50% yes among non-creator members counts as match)
- **D-05:** **Override:** `families/{code}.intentThreshold: 'any_yes' | 'majority'` — owner-configurable in Settings. Defaults to the group-mode default above.
- **D-06:** **Creator is implicit yes** — the creator's own RSVP is stamped `yes` at intent create. Not a vote, but they're counted in the denominator and numerator for majority calculations. (They're obviously in; the question is whether they reach threshold with others.)
- **D-07:** **Match evaluation client-side** on every onSnapshot tick — cheap, no CF needed. Intent doc's `status: 'open' → 'matched'` write happens when client detects threshold crossed; like the Phase 7 flip, idempotent under races (recheck status before write).

### Entry points + RSVP UX

- **D-08:** **Action sheet adds two entries on any unwatched title:**
  - 📅 **"Propose tonight @ time"** → opens a small picker modal (quick-pick times: Tonight 8pm / 9pm / 10pm / Custom). Creates `tonight_at_time` intent. Replaces or supplements the existing "Schedule" for the intent flow use case — existing Schedule stays for solo "remind me later" use.
  - 💭 **"Ask the family"** → no time picker, creates `watch_this_title` intent. One tap.
- **D-09:** **RSVP modal** triggered from Tonight screen's open-intents strip OR from a push notification tap. Shows the title + proposed time (if any) + current RSVP tallies + 3-4 buttons: Yes / Maybe / No (/ Later for watch_this_title only). Tap to commit; re-tap same choice to un-vote.

### Tonight-screen open-intents strip (INTENT-03 discoverability)

- **D-10:** **New strip on Tonight screen** mirroring the watchparty banner pattern. Shows active intents sorted by most-recently-created. Each card: title + type indicator + your-RSVP-or-tap-to-RSVP state + progress toward threshold ("2 of 3 yes").
- **D-11:** **Strip collapses when no open intents.** No "+" button inside — creation always happens via title-detail action sheet.

### Conversion UX (INTENT-03)

- **D-12:** **Match prompt = in-app toast + push to creator.** When threshold crossed on-device, fire a non-intrusive toast "[title] has a match! 3 of 4 yes." with "Start watchparty" / "Schedule" buttons.
- **D-13:** **Auto-conversion rules:**
  - `tonight_at_time` + threshold met → prompt "Start watchparty now?" (with poster + scheduled time) → tap → calls existing `confirmStartWatchparty` pre-populated with the intent's title + proposedStartAt
  - `watch_this_title` + threshold met → prompt "Schedule this?" → opens existing `openScheduleModal(titleId)` with empty time field
- **D-14:** **No forced auto-conversion.** Creator can dismiss the prompt and the intent stays in `matched` state (match recorded for YIR, but no watchparty launched).

### Expiry + cleanup (INTENT-05)

- **D-15:** **`tonight_at_time` intents expire at `proposedStartAt + 3h`.** If nobody converted by then, it's stale.
- **D-16:** **`watch_this_title` intents expire at `createdAt + 30d`.** Long tail for "eventually" polls.
- **D-17:** **Extend `watchpartyTick` CF** — add a third branch for intents: set `status='expired'` on intents with `status='open'` AND `expiresAt < now`. Same 5-min cron; amortized cost.
- **D-18:** **Cancel = creator-only.** Creator can explicitly cancel their own intent via the open-intents strip or RSVP modal; sets `status='cancelled'`.

### Push (reuses Phase 6)

- **D-19:** **Two new event types added to `NOTIFICATION_DEFAULTS`:**
  - `intentProposed` — default ON; fires on `onIntentCreated` CF trigger; sends to non-creator members
  - `intentMatched` — default ON; fires when client flips status to `matched`; sends to creator only
- **D-20:** **New CF `onIntentCreated`** fires on `families/{code}/intents/{id}` doc create. Pushes to non-creator members. Self-echo guard via excludeUid=createdByUid.
- **D-21:** **Match push is client-triggered via writing a derived field**, not a CF trigger. When client writes `status='matched'`, it also writes `matchPushSentAt: null` (placeholder). A Firestore trigger (`onIntentUpdate`) detects the transition to `status='matched'`, sends push to creator, and nulls out the placeholder. Or simpler: make it a single CF trigger on `status→matched`. Plan resolves at plan time.

### Year-in-Review shape (INTENT-06)

- **D-22:** **Intent activity logged in the same intent doc** — no separate Year-in-Review log. The YIR phase reads historical intents with `status ∈ {matched, converted, expired}`, aggregates by member (creator + RSVPs), and surfaces "most-anticipated" (highest RSVP-yes count across intents) and "most-wanted-never-watched" (matched or expired intents whose titleId has no subsequent watchparty or "watched" vote).
- **D-23:** **Never hard-delete intents** — they're the YIR raw data. Status field transitions only. Archive via `status='expired'` or `status='cancelled'`. (Consistent with VETO-01 and PARTY-06 patterns.)

### Claude's Discretion

- Exact quick-pick time options for tonight-at-time (propose: 8pm / 9pm / 10pm / custom based on family's recent watchparty start times)
- Visual treatment of intent strip vs watchparty banner (consistent but differentiable)
- Whether match-prompt toast uses `flashToast` or a custom richer UI (planner's call; flashToast is adequate)
- Index on intents subcollection (`where status=='open' orderBy createdAt`) — Firestore auto-prompts if needed
- Whether majority rounds up or down (proposing: `yesCount >= ceil(eligibleCount / 2)`)
- Plan granularity (proposing 5: schema+rules, UX entry+strip, threshold+conversion, push, UAT)
- Whether `intentsTick` is its own CF or merged into `watchpartyTick` (recommend merged to keep cron count low)

</decisions>

<canonical_refs>
## Canonical References

- `.planning/ROADMAP.md` — Phase 8 goal + dependencies (5, 6)
- `.planning/REQUIREMENTS.md` — INTENT-01 through INTENT-06
- `.planning/PROJECT.md` — design principle (warm/cinematic/restraint)
- `.planning/phases/05-auth-groups/05-CONTEXT.md` — writeAttribution pattern
- `.planning/phases/06-push-notifications/06-CONTEXT.md` — eventType granularity
- `.planning/phases/07-watchparty/07-CONTEXT.md` — watchpartyTick CF pattern (extend this)
- `js/app.js` — existing vote system, schedule system, action sheet, Tonight banner pattern
- `queuenight/functions/index.js` — existing CFs + sendToMembers + watchpartyTick

</canonical_refs>

<deferred>
## Deferred to Later Phases

- Cross-family / public intent polls — post-v1
- Intent history view per-member — Phase 10 YIR covers this
- Rich match-reveal UX (confetti, animation) — Phase 9
- Multi-title intent ("which of these 3 tonight") — revisit post-v1 if families want it
- Threshold tuning beyond the 2 rules (e.g., "unanimous" or "quorum of 60%") — Phase 9 polish if feedback demands
- Intent on titles not yet in the family catalog — would require title-add flow integration; post-v1
- Undo / re-open an expired intent — post-v1 (cancel is the only v1 escape hatch)

</deferred>

<assumptions>
## Assumptions to Flag

1. **`family.mode` and `family.intentThreshold` are reachable via the existing family doc** — verify at plan time. Both read via existing `state.group` path.
2. **`watchpartyTick` CF can take on intent expiry too** — its per-family-per-doc iteration is already there; one more branch is cheap. If family count grows >1000 this may need a dedicated cron; not a v1 concern.
3. **`onSnapshot` on `families/{code}/intents` is fine to add** — adds one more real-time subscription per family member. Already well within Firestore real-time budget.
4. **Existing Phase 6 notificationPrefs UI handles "add 2 new rows" gracefully** — it iterates over `Object.keys(DEFAULT_NOTIFICATION_PREFS)`, so adding 2 keys auto-renders 2 new toggles.
5. **RSVP edits (change mind mid-flow) don't re-fire push** — once `intentProposed` fires at create, subsequent RSVP changes are silent. Plan accepts this.

</assumptions>

---

*CONTEXT gathered autonomously 2026-04-22 after Phase 7 deploy. Planning only — execution is a separate decision.*
