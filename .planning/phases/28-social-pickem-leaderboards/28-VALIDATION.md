---
phase: 28
slug: social-pickem-leaderboards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-02
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

> Source: `28-RESEARCH.md` § Validation Architecture (line 760+).
> Planner fills the Per-Task Verification Map after PLAN.md files are emitted; this file is the contract the executor samples against.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node CommonJS smoke contracts (`scripts/smoke-*.cjs`) — pattern from Phase 26/27 |
| **Config file** | none — smoke contracts are self-contained scripts run via `node` |
| **Quick run command** | `node scripts/smoke-pickem.cjs` |
| **Full suite command** | `bash scripts/smoke-all.sh` (aggregate already wired in `package.json`; Phase 28 adds the 11th contract) |
| **Estimated runtime** | smoke-pickem.cjs ~3-5s; full aggregate ~30-45s |

---

## Sampling Rate

- **After every task commit:** Run `node scripts/smoke-pickem.cjs`
- **After every plan wave:** Run `bash scripts/smoke-all.sh`
- **Before `/gsd-verify-work`:** Full smoke aggregate must be green AND `bash scripts/deploy.sh` §2.5 floor meta-assertion (≥13 contracts) passes
- **Max feedback latency:** ~5 seconds (per-contract); ~45 seconds (aggregate)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _planner fills_ | _01..N_ | _0..N_ | _PICK-28-XX_ | _T-28-XX_ | _expected behavior_ | _unit/integration/smoke_ | `node scripts/...` | ❌ W0 | ⬜ pending |

*Planner MUST emit one row per task with concrete `<automated>` command in PLAN.md. Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Wave 0 must establish the smoke contract scaffolding + verify the three TheSportsDB ASSUMED items from RESEARCH.md before downstream waves rely on them:

- [ ] `scripts/smoke-pickem.cjs` — exists with the assertion harness skeleton (Phase 26/27 pattern)
- [ ] `scripts/deploy.sh` §2.5 — `if-block` for `smoke-pickem.cjs` registered AND floor meta-assertion bumped to ≥13 (per RESEARCH § Validation Architecture)
- [ ] **Wave 0 verification curls (from RESEARCH § "Wave 0 Verification Items"):**
  - [ ] F1 race event from `lookupevent.php` — confirm driver name fields + podium data on free TheSportsDB key (`'1'`)
  - [ ] UFC event from `lookupevent.php` — confirm fighter names + round data on free key
  - [ ] EPL `eventsday.php` response — confirm `intRound` is populated for domestic soccer slates (D-05 slate-grouping rule depends on this)

*If any of the three curl checks fails, the slate-definition / pickType-selection logic for that league must be revisited BEFORE pickem.js is coded. Treat as a Wave 0 BLOCKING gate.*

---

## Manual-Only Verifications

Per the BRAND voice + UI-SPEC contract, certain Phase 28 behaviors are subjective enough to require human eyes:

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Picker pre-fill animation feel (D-09) | _planner assigns PICK-28-XX_ | Animation timing + BRAND italic-serif sub-line read is subjective | Open `/app#pickem`, verify pre-filled team chip pulses once + sub-line "Lakers — your pick from your team commitment. Tap to change." renders in Fraunces italic |
| Real-time pick visibility latency feel (D-10) | _planner assigns PICK-28-XX_ | "Feels real-time" is subjective; latency under ~500ms is fine for non-stress UX | Two browser tabs as different family members; member A submits pick; member B should see it on the picker card within 1s |
| Inline wp pick row read-only chrome (D-07) | _planner assigns PICK-28-XX_ | Visual density / non-modal feel is subjective | Open a `wp.mode === 'game'` watchparty; confirm "Your pick: Lakers • Mom: Bucks • Dad: Lakers" row sits inside live-modal layout without pushing other chrome |
| Past-seasons archive readability (D-12) | _planner assigns PICK-28-XX_ | List-view density on small mobile-portrait screens is subjective | Pick'em tab → tap a league → "Past seasons" — verify rows like "NFL 2025 — Mom 152-89, Dad 144-97, Kid 38-17" are readable without horizontal scroll |
| Empty-state copy BRAND voice | _planner-discretion item_ | Copy is judgment-driven (Fraunces italic / restraint posture) | Pick'em tab with no upcoming games for any enabled league — verify empty-state line reads in BRAND voice (warm, not corporate) |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (smoke contract + deploy.sh §2.5 + 3 TheSportsDB curl checks)
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s per-contract / 45s aggregate
- [ ] `nyquist_compliant: true` set in frontmatter (set after planner emits Per-Task Verification Map)

**Approval:** pending
