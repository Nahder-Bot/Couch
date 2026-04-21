---
phase: 07-watchparty
plan: 04
type: uat-results
---

# Phase 7 — Watchparty UAT Results

**Scaffolded:** 2026-04-22 (autonomous execution of plans 07-01..03; this file awaits hands-on UAT)
**Tester:** (to fill on device UAT)
**Devices:** iPhone home-screen PWA + at least one second device (desktop / other phone) with a different family member signed in

---

## Pre-flight

| Check | Status | Notes |
|---|---|---|
| `firebase deploy --only functions:watchpartyTick` | PENDING | New scheduled CF, runs every 5 min |
| `firebase deploy --only hosting` | PENDING | Ships client flip timer + "Watch together" CTA + emoji +more + participant strip. Cache bumped to v16. |
| Open couchtonight.app PWA → Settings → Notifications → ensure "Watchparty starting" toggle ON | PENDING | Default ON from Phase 6; verify still set |

---

## Scenarios

| # | Scenario | Result | Latency | Notes |
|---|---|---|---|---|
| 1 | **Flagship: scheduled→active flip + watchpartyStarting push** — Second device schedules a watchparty 2 min in the future. Leave iPhone PWA closed. At the scheduled time, iPhone should receive **"Watchparty starting"** push within ~5 s. This is the Phase 6 event that couldn't fire until 07-01 shipped the flip mechanism. | PENDING | — | Proves both the client-primary setTimeout flip (if iPhone was open at the moment) AND the CF cron safety net (if both devices were closed). |
| 2 | **"Watch together" CTA from Tonight spin** — On iPhone, tap Spin → pick lands in modal → tap "🎬 Watch together" button → start-watchparty modal opens pre-populated → tap Now → Start. Existing watchparty live modal opens. | PENDING | — | Tests PARTY-01 discoverability improvement. |
| 3 | **Existing banner shows live party** — From second device, start a watchparty. On iPhone, open Tonight tab. Banner should render with title + host + Join button. Tap Join → routed to live modal. | PENDING | — | Verifies existing renderWatchpartyBanner still works after Phase 7 changes (no regression). |
| 4 | **Emoji +more picker** — In a live watchparty modal, tap the "+" button at the right of the emoji bar. iOS native keyboard should open. Swipe to emoji tab (may need to do this once; iOS remembers thereafter). Tap any emoji (e.g., 🥹). Reaction posts and appears in the feed. | PENDING | — | Tests 07-03 picker hook. Multi-codepoint emoji like 👨‍👩‍👧‍👦 should also send correctly (first grapheme extraction). |
| 5 | **Participant timer strip** — In a live watchparty with ≥2 members, the strip above the reactions feed shows one chip per member with name + elapsed-minutes status ("Joined" / "Paused" / "X min in"). Your own chip is highlighted with a warm border. Numbers advance as the minute rolls over. | PENDING | — | Tests 07-03 PARTY-03 advisory-timer visualization. |
| 6 | **Reactions real-time (regression check)** — iPhone taps 🎉 → second device shows "[iPhone member] 🎉" within 2 s. Repeat with 2-3 emoji in quick succession. No drops. | PENDING | — | Pre-Phase-7 behavior preserved; adds lastActivityAt field but sendReaction unchanged in semantics. |
| 7 | **Orphan archive: stale scheduled** — Firebase Console → edit a watchparty doc to have status=scheduled, startAt=(now - 7h). Wait for next 5-min CF tick. Doc should update to status=archived, archivedReason=stale_scheduled. | PENDING-OPS | — | Tests 07-01 branch 1b. Can be verified via CF logs if patience allows. |
| 8 | **Orphan archive: empty active** — From second device, create a watchparty (startAt=Now), then immediately leaveWatchparty. Watchparty doc now has status=active, participants={}. Wait 30 min + 5 min. Doc should archive with reason=empty_active_timeout. | PENDING-OPS | — | Tests 07-01 branch 2. Long wait; skip for initial UAT and verify later from logs. |

---

## Known stubs / deferrals (not UAT failures)

- **GIF reactions** — deferred to Phase 9.x per seed `.planning/seeds/phase-9x-gif-reactions.md`. The `+` button is emoji-only in v1.
- **Banner session dismiss** — 07-02 scoped this in but the existing banner already naturally disappears when parties archive (25h window); explicit dismiss button skipped for v1.
- **Reaction palette lock to 8** — 07-03 CONTEXT D-13 proposed locking to 8 emoji; kept existing 10 + added `+more` picker to avoid churning familiar UX. Strict upgrade.

---

## Outstanding issues

(to fill during UAT)

---

## Recommendation

**Phase 7 ready for /gsd-verify-work:** PENDING — flagship (Scenario 1) is the single most important pass since it closes the Phase 6 loop. Scenarios 2-6 validate the new UX surface. 7-8 are long-wait ops checks that don't need to block phase closure.

---

## Provenance

Scaffolded 2026-04-22 after autonomous execution of plans 07-01 (lifecycle), 07-02 (spin CTA), 07-03 (emoji picker + participant strip). Update in place and commit per scenario (`docs(07-04): UAT results — scenario N PASS`).
