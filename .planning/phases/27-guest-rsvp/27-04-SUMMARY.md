---
phase: 27-guest-rsvp
plan: 04
subsystem: app-html-host-roster
tags:
  - guest-rsvp
  - app-html
  - roster
  - guest-chip
  - kebab-menu
  - host-controls
  - close-rsvps

# Dependency graph
requires:
  - phase: 27-guest-rsvp
    plan: 01
    provides: rsvpRevoke CF (action='revoke' | 'close') + Phase 24 host-only Path A Firestore rule (allows host writes to rsvpClosed)
  - phase: 27-guest-rsvp
    plan: 02
    provides: smoke-guest-rsvp.cjs scaffold + helper-contract drift detectors (displayGuestName, visibleGuestCount, GUEST_ID_REGEX, normalizeResponseForReminders)
  - phase: 7-watchparty
    provides: renderParticipantTimerStrip (member chip render template) + .wp-participant-chip CSS family + renderWatchpartyBanner banner-render entry point
  - phase: 5-auth
    provides: .chip-badge.badge-guest pill (apricot teal #7cb4a9) + .link-btn (link-style button)
provides:
  - "renderParticipantTimerStrip extended to append guest chips after member chips, filtered to (wp.guests || []).filter(g => g && !g.revoked)"
  - "Three module-level helpers above renderParticipantTimerStrip: getFamilyMemberNamesSet (Set helper for O(1) D-04 collision lookup), displayGuestName (D-04 (guest) suffix on collision), guestResponseLabel (yes→Going, maybe→Maybe, no→Not coming, undefined→Invited)"
  - "Each guest chip: class='wp-participant-chip guest', data-guest-id, fixed teal #5a8a84 avatar, badge-guest pill, response label, host-only kebab"
  - "window.openGuestMenu(guestId, wpId, event) — host-gated popover anchored to kebab; click-outside dismiss; single 'Remove {name}' menu item"
  - "window.revokeGuest(wpId, guestId, displayName) — httpsCallable rsvpRevoke {action:'revoke'} + flashToast (analog removeMember at js/app.js:6847; no confirm() per D-07 reversibility)"
  - "window.closeRsvps(wpId) — httpsCallable rsvpRevoke {action:'close'} + flashToast"
  - "window.openRsvps(wpId) — direct host-only Firestore write doc(db, 'families', state.familyCode, 'watchparties', wpId) updateDoc({rsvpClosed: false}) per Note B asymmetry"
  - "Three banner helpers above renderWatchpartyBanner: buildWpBannerMetaSuffix (' · {N} guest(s)' when wp.guestCount > 0), buildWpClosedPillHtml (.wp-rsvp-closed-pill 'RSVPs CLOSED' when wp.rsvpClosed), buildWpHostRsvpToggleHtml (.link-btn Close RSVPs / Open RSVPs visibility-gated by host && rsvpClosed flip)"
  - "renderWatchpartyBanner extended at BOTH banner template paths (cancelled + active): meta-line gets buildWpBannerMetaSuffix; .wp-banner-body gets buildWpClosedPillHtml + buildWpHostRsvpToggleHtml"
  - "css/app.css: .wp-participant-chip.guest (teal-tinted border) + .wp-participant-av background #5a8a84 inserted after .wp-participant-chip.joined; Phase 27 host-controls block (.wp-guest-kebab 44x44 touch target, .wp-rsvp-closed-pill, .wp-guest-menu, .wp-guest-menu-item, .wp-guest-menu-item.destructive) appended after .link-btn:hover"
  - "app.html: 1 Phase 27 comment hook above #wp-banner-tonight noting JS-rendered banner; no new DOM elements"
affects:
  - 27-05 (rsvpReminderTick + cross-repo deploy + sw.js CACHE bump + HUMAN-UAT scaffold + smoke ≥13 floor extension)

# Tech tracking
tech-stack:
  added:
    - "no new runtime deps; reuses existing httpsCallable + functions + db + doc + updateDoc + escapeHtml imports"
  patterns:
    - "Module-level helper trio inserted ABOVE the renderer they support — keeps invocation chain top-down readable"
    - "Two-path banner template extension: same suffix/pill/toggle injection applied to BOTH cancelled + active branches; no template path skipped"
    - "Defense-in-depth host gate: client-side state.me.id === wp.hostId guards (kebab visibility + openGuestMenu early-return + closeRsvps/openRsvps early-return) + server-side Plan 01 rsvpRevoke CF host gate (permission-denied) + Phase 24 Firestore Path A rule"
    - "Note B asymmetry: rsvpRevoke CF only handles action='close'; re-open is a direct host-only Firestore updateDoc({rsvpClosed: false}) — Phase 24 Path A allows any field write by host"
    - "No-confirm() reversibility (D-07): both revoke (soft-delete via wp.guests[i].revoked=true) and close (wp.rsvpClosed flip) are reversible, so neither path adds a confirm() dialog (count unchanged at 17 across the plan)"

key-files:
  created:
    - "C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-04-SUMMARY.md (this file)"
  modified:
    - "C:/Users/nahde/claude-projects/couch/js/app.js (17297 → 17458; +161 lines net)"
    - "C:/Users/nahde/claude-projects/couch/css/app.css (4600 → 4654; +54 lines net)"
    - "C:/Users/nahde/claude-projects/couch/app.html (1514 → 1519; +5 lines comment hook)"

key-decisions:
  - "Single comment hook in app.html (above #wp-banner-tonight) — banner is fully JS-rendered with NO static .wp-banner skeleton in the HTML, so the plan's alternative single-comment posture was the only valid option. The 5-line comment names all three Phase 27 helpers (buildWpBannerMetaSuffix / buildWpClosedPillHtml / buildWpHostRsvpToggleHtml) so future archaeologists can grep their way to the renderer."
  - "Both wp-banner-body template paths got the same Phase 27 injection — cancelled banner is informational-only (no host actions are useful when the wp is dead), but the closed-pill + host toggle was still added there for visual consistency and forward-compat: a host who closes RSVPs and then cancels the wp will still see the closed-pill until cancellation supersedes."
  - "openRsvps uses state.familyCode (74 existing matches in js/app.js confirm canonical property name) — verified via Phase 5+ Firestore-write conventions; no familyId / familyDocPath alternative needed."
  - "Kebab onclick uses event.stopPropagation() inline AND inside openGuestMenu — defensive double-stop prevents the wp-banner-action button onclick from firing if the kebab is ever positioned near it. Since guest chips live in renderParticipantTimerStrip (not the banner), this is forward-compat insurance for future layout changes."
  - "displayGuestName accepts the familyMemberNamesSet as a 2nd arg (rather than computing it inline) so renderParticipantTimerStrip computes it once and passes it into the .map iterator — O(N) chips × O(1) Set lookup instead of O(N) chips × O(M) members.find()."
  - "guestResponseLabel returns 'Invited' for both undefined AND null AND 'invited' string — matches D-01 'no RSVP yet' state regardless of how the absence is encoded server-side."

patterns-established:
  - "Phase 27 guest chip render rule: const visibleGuests = (Array.isArray(wp.guests) ? wp.guests : []).filter(g => g && !g.revoked); appended after the existing chips.map().join() with shared .wp-participants-strip container — single render path, defensively handles missing/non-array wp.guests."
  - "Banner template suffix injection pattern: inline ${buildWpBannerMetaSuffix(wp)} concatenated to existing meta-line text content; closed-pill + host-toggle injected AFTER .wp-banner-status, BEFORE .wp-banner-body close. Pattern applies cleanly to any future banner additions (e.g., 'in progress · 5 going · 2 guests')."
  - "Host-only Firestore client write for state-flip-back: when a CF only handles one direction of a boolean flip (close: true), use a direct client updateDoc for the reverse (close: false). Validated by Phase 24's Path A rule allowing host writes of any non-allowlisted field."

requirements-completed:
  - RSVP-27-14
  - RSVP-27-15

# Metrics
duration: ~3min
completed: 2026-05-02
---

# Phase 27 Plan 04: Host Roster + Banner UI Summary

**Wired the host- and member-side guest experience into js/app.js + css/app.css + app.html in three atomic commits — renderParticipantTimerStrip emits guest chips with badge + response label + host-only kebab; window.{openGuestMenu, revokeGuest, closeRsvps, openRsvps} carry the four host actions (rsvpRevoke CF + Note B Firestore re-open); renderWatchpartyBanner appends ' · {N} guest(s)' + RSVPs CLOSED pill + Close/Open RSVPs link-btn at both banner template paths; all 12/12 substring checks + 11/11 key_link patterns + 10/10 smoke contracts green.**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-05-02T02:57:15Z
- **Completed:** 2026-05-02T03:00:19Z
- **Tasks:** 3 / 3
- **Files modified:** 3 (js/app.js + css/app.css + app.html); 1 SUMMARY created
- **Test runs:** smoke-guest-rsvp 17/17 PASS; smoke aggregate (10 contracts) green; smoke-position-anchored-reactions 103/103 PASS; smoke-native-video-player + sports-feed + decision-explanation + tonight-matches + position-transform + availability + kid-mode + conflict-aware-empty all PASS

## Accomplishments

- **renderParticipantTimerStrip extended cleanly** — three module-level helpers added above the function (getFamilyMemberNamesSet / displayGuestName / guestResponseLabel) + final return rewritten to compute visibleGuests, isHost, and guestChips template, then concatenate `${chips}${guestChips}` inside the existing .wp-participants-strip container. Member chips unchanged; existing on-time control + team-flair + me-marker logic preserved verbatim.
- **D-04 collision rule fully implemented** — getFamilyMemberNamesSet builds a normalized Set once per render; displayGuestName applies trim+lowercase comparison; pill renders unconditionally; (guest) suffix only appears when collision detected. Verified via grep `(guest)` literal present in source.
- **Host-only kebab fully gated** — kebab HTML is only emitted when `state.me && state.me.id === wp.hostId`. aria-label uses display name (post-suffix); onclick uses event.stopPropagation() to prevent any parent click-handler escape; openGuestMenu has its own host gate as a defense-in-depth.
- **Four window.* host actions wired** — openGuestMenu (popover with click-outside dismiss + role=menu), revokeGuest (rsvpRevoke action='revoke'), closeRsvps (rsvpRevoke action='close'), openRsvps (Note B: direct client updateDoc({rsvpClosed: false})). All four flashToast on success/failure; permission-denied path on revokeGuest produces 'Only the host can remove guests.' (matches createGuestInvite pattern).
- **renderWatchpartyBanner extended at BOTH template paths** — cancelled banner + active banner both got buildWpBannerMetaSuffix appended to their meta-line, plus buildWpClosedPillHtml + buildWpHostRsvpToggleHtml injected at end of .wp-banner-body. Each helper invoked exactly twice in source (declaration + 2 invocations = 3 occurrences each, verified via grep -c).
- **css/app.css extended with all required Phase 27 selectors** — .wp-participant-chip.guest (teal-tinted border) + .wp-participant-av background:#5a8a84 inserted after .wp-participant-chip.joined (line 772 area). Phase 27 host-controls block appended after .link-btn:hover (line 2345 area): .wp-guest-kebab (44x44 touch target via min-width/min-height + display:grid + place-items:center), .wp-rsvp-closed-pill (Inter 11px uppercase pill), .wp-guest-menu + .wp-guest-menu-item + .wp-guest-menu-item.destructive (single 'Remove {name}' menu, --bad text color).
- **app.html annotated with single Phase 27 comment hook** — placed above #wp-banner-tonight scaffold; 5-line comment names all three banner helpers + their JS-rendered nature. No new DOM elements introduced (per plan constraint).

## Banner render-path count

The banner has TWO render paths in renderWatchpartyBanner (single template function, two `return` branches inside the freshWps.map iteratee):

1. **Cancelled branch** (`wp.status === 'cancelled'`): muted no-click banner; meta-line carries `${hostLabel} cancelled this watchparty`.
2. **Active branch** (default): full clickable banner with title, meta-line + status + action button; meta-line carries `${metaLine}` (host + participant count).

Both paths got identical Phase 27 injection: `${buildWpBannerMetaSuffix(wp)}` on the meta-line (so a cancelled wp with N guests still surfaces the count), and `${buildWpClosedPillHtml(wp)}${buildWpHostRsvpToggleHtml(wp)}` after .wp-banner-status (so the host can still re-open RSVPs even after cancellation if business need ever requires it).

`grep -c 'buildWpBannerMetaSuffix' js/app.js` returns 3 (1 declaration + 2 invocations in the two banner branches), satisfying the acceptance criterion (≥ 2).

## Insertion points used

| Location | File | Where | Lines added |
|----------|------|-------|-------------|
| Phase 27 helpers (chip) | js/app.js | Above `function renderParticipantTimerStrip` (line ~12152) | 21 lines (3 helpers + comment) |
| Guest chip render | js/app.js | After `.join('')` of member chips, before final `return` (line ~12227) | 22 lines (visibleGuests + isHost + guestChips template + return rewrite) |
| Phase 27 host actions | js/app.js | After `window.copyGuestLink` (line ~4434) | 95 lines (4 window.* functions + comment) |
| Phase 27 banner helpers | js/app.js | Above `function renderWatchpartyBanner` (line ~11572) | 19 lines (3 helpers + comment) |
| Cancelled-banner suffix + closed pill + host toggle | js/app.js | Inside `wp.status === 'cancelled'` branch (line ~11519) | 2 lines (suffix call + pill+toggle line) |
| Active-banner suffix + closed pill + host toggle | js/app.js | Inside default branch (line ~11552) | 2 lines (suffix call + pill+toggle line) |
| Phase 27 chip variant CSS | css/app.css | After `.wp-participant-chip.joined` (line ~772) | 3 lines |
| Phase 27 host-controls CSS | css/app.css | After `.link-btn:hover` (line ~2345) | 51 lines (kebab + pill + menu + menu-item + destructive) |
| Phase 27 comment hook | app.html | Above `<div id="wp-banner-tonight"></div>` (line ~334) | 5 lines |

## File deltas

| File | Before | After | Delta |
|------|--------|-------|-------|
| js/app.js | 17297 lines | 17458 lines | +161 |
| css/app.css | 4600 lines | 4654 lines | +54 |
| app.html | 1514 lines | 1519 lines | +5 |
| **Total** | **23411** | **23631** | **+220** |

Plan estimate: ~80-130 lines js + ~40 css + 2 comment hooks ≈ 122-172. Actual +220 — slightly above estimate due to (a) the openGuestMenu popover full implementation (95 lines vs the plan's tighter implied scope), and (b) the Phase 27 CSS block being expanded to fully implement .wp-guest-menu + .wp-guest-menu-item which the plan listed separately from the kebab+pill core.

## Task Commits

Each task committed atomically in the **couch** repo:

1. **Task 4.1: extend renderParticipantTimerStrip with guest chips + helpers** — `f87a3a9` (feat)
   - Added getFamilyMemberNamesSet / displayGuestName / guestResponseLabel module helpers above the function (D-04 + D-01).
   - Appended guest chips after member chips inside .wp-participants-strip: class='wp-participant-chip guest', data-guest-id, fixed teal #5a8a84 avatar, badge-guest pill, response label, host-only kebab with aria-label 'Guest options for {displayName}' and openGuestMenu hook.
   - 8/8 substring checks pass; smoke aggregate green; defensive Array.isArray + filter on !revoked.
2. **Task 4.2: add window.openGuestMenu / revokeGuest / closeRsvps / openRsvps host actions** — `75d6b26` (feat)
   - openGuestMenu: host-gated popover anchored to kebab via fixed-position rect calc, single 'Remove {name}' menu item, click-outside dismiss with capture-phase listener.
   - revokeGuest: httpsCallable(functions, 'rsvpRevoke') with {token, action: 'revoke', guestId}; flashToast on success/failure; permission-denied → 'Only the host can remove guests.'
   - closeRsvps: httpsCallable rsvpRevoke {token, action: 'close'}; flashToast 'RSVPs closed.' on success.
   - openRsvps: Note B asymmetry — rsvpRevoke CF only handles 'close'; re-open uses doc(db, 'families', state.familyCode, 'watchparties', wpId) + updateDoc({rsvpClosed: false}); flashToast on result.
   - 10/10 substring checks pass; confirm() count unchanged (17 — no new modals); smoke green.
3. **Task 4.3: banner guest count + RSVPs CLOSED pill + host Close/Open RSVPs toggle** — `21b532a` (feat)
   - js/app.js: 3 banner helpers (buildWpBannerMetaSuffix / buildWpClosedPillHtml / buildWpHostRsvpToggleHtml) above renderWatchpartyBanner. Applied to BOTH banner branches: meta-line suffix + closed-pill + host toggle inside .wp-banner-body. Host toggle label flips Close/Open by wp.rsvpClosed.
   - css/app.css: .wp-participant-chip.guest (teal border) + #5a8a84 avatar after .wp-participant-chip.joined. Phase 27 host-controls block (kebab 44x44, closed-pill, menu + menu-item + destructive) after .link-btn:hover.
   - app.html: 5-line Phase 27 comment hook above #wp-banner-tonight (no new DOM elements).
   - 12/12 substring checks pass; 11/11 key_link patterns present; smoke aggregate green; CSS grew +54 (≥30 floor); min-height:44px count grew 17→21 (+4, ≥2 floor).

**Plan metadata commit:** This SUMMARY.md, committed separately as `docs(27-04): plan summary`.

## Decisions Made

- **Single comment hook in app.html (not two)** — Banner is fully JS-rendered with NO static .wp-banner skeleton; per plan's alternative posture, ONE comment near the wp-banner-tonight scaffold suffices. The 5-line comment names all three new helpers so future archaeologists can grep their way to the renderer.
- **Cancelled-banner branch got the same Phase 27 injection** — Visual consistency + forward-compat. A host who closes RSVPs then cancels the wp will still see the closed-pill until the cancelled state supersedes, matching user mental model ("I closed RSVPs first, then cancelled — both states should be visible until the wp dies").
- **getFamilyMemberNamesSet computed once per render in renderParticipantTimerStrip** — Set passed into displayGuestName as 2nd arg per O(N×1) vs O(N×M) tradeoff. M family members can be 0-20+; doing the trim+lowercase scan once per render rather than once per guest is the right shape.
- **No confirm() dialogs added** — Plan-locked by D-07 reversibility (revoke is soft-delete; close is reversible by openRsvps). confirm() count unchanged at 17 throughout the plan, verified before-and-after.
- **`event.currentTarget || event.target` fallback in openGuestMenu** — currentTarget is the canonical bound element, but on some browsers in certain handler chain conditions target is more reliable. Defensive fallback prevents NullPointer if event.currentTarget is unset.
- **destructive class uses `var(--bad)`** — Existing token (defined in css/app.css :root); same color used by .pill.warn elsewhere. No new color tokens introduced.
- **Phase 27 CSS positioned in two distinct blocks rather than one** — `.wp-participant-chip.guest` lives near other chip variants (line ~772, after .joined); host-controls block (.wp-guest-kebab + .wp-rsvp-closed-pill + .wp-guest-menu* family) lives near other Phase 5 / Plan 07 host-action affordances (after .link-btn:hover at line ~2345). Mirrors the existing locality-of-reference convention in css/app.css.

## Deviations from Plan

**None substantive.** Plan executed exactly as written.

Two micro-touches that did not change shape or behavior:

**1. [Process — defensive] `event.currentTarget || event.target` fallback in openGuestMenu**
- **Found during:** Task 4.2 implementation
- **Issue:** Plan's exact code wrote `const btn = (event && event.currentTarget) || event.target;` — but `event.target` access without `event &&` guard would NullPointer if event itself is undefined. Defensive fix wraps both accesses inside the same `event &&` chain.
- **Fix:** Wrote `const btn = (event && event.currentTarget) || (event && event.target);`. Identical behavior in normal use; defensive against pathological no-event invocation.
- **Files modified:** `C:/Users/nahde/claude-projects/couch/js/app.js`
- **Committed in:** `75d6b26` (Task 4.2 commit, not a separate fix).

**2. [Process — readability] Plan's exact buildWpHostRsvpToggleHtml HTML used single-quote attribute style for onclick** — preserved verbatim. No deviation; noted only because the plan's snippet style does not match the existing renderWatchpartyBanner template style (which uses double-quotes nested with single-quotes for onclick). Both are valid HTML; chose to preserve the plan's exact code character-for-character to avoid scope creep.

---

**Total deviations:** 0 substantive (1 forward-compat defensive guard).
**Impact on plan:** Plan executed exactly as written. All 9 must_have truths satisfied; all 4 artifact contains/contains_2/contains_3/contains_4 grep gates green; all 4 key_link patterns present.

## Issues Encountered

- **Pre-existing modification to `.planning/ROADMAP.md`** was present in the couch working tree at execution start (`M .planning/ROADMAP.md`). Per orchestrator contract (`Do NOT update STATE.md or ROADMAP.md — orchestrator owns those.`), it was left untouched throughout this plan. `git status --short` continued to show only the same modification at completion.
- **READ-BEFORE-EDIT pre-tool hook fired on each Edit call** — defensive runtime guard. All Edit calls had already been preceded by a Read call in the same session; no edit was rejected; the hook logged the reminder but did not block.

## User Setup Required

None for this plan. No deploy in 27-04 — Plan 27-05 owns the cross-repo `firebase deploy --only functions` from `C:\Users\nahde\queuenight\` (for rsvpReminderTick guest-loop) plus `bash scripts/deploy.sh 39-guest-rsvp` for the sw.js CACHE bump.

## Plan 04 → Plan 05 Handoff

**Plan 05 must add:**

1. **rsvpRevoke action='attachPushSub' server branch** (queuenight/functions/src/rsvpRevoke.js): Plan 03's rsvp.html already POSTs this action when a guest opts into web push. Until Plan 05 lands, the call returns 4xx and degrades gracefully to State C ("Couldn't set up reminders. Ask {host} to message you directly.") — once Plan 05 ships, same client code path returns State A ("You're on the list."). Pattern: runTransaction read-modify-write into wp.guests[i].pushSub via Object.assign({}, prev, {pushSub}).

2. **rsvpReminderTick guest-loop extension** (queuenight/functions/src/rsvpReminderTick.js): per Plan 02 SUMMARY's "Note for Plan 05," add second loop over wp.guests[] filtered to entries with non-null pushSub. Skip-no-pushsub gate (`if (!guest.pushSub) continue`), skip-revoked gate (`if (guest.revoked) continue`), direct webpush.sendNotification (not via sendToMembers — guests don't have member docs), idempotency flag at `wp.reminders.{guestId}.{windowKey}`. Asymmetric cadence matches members (Yes T-24h+T-1h, Maybe T-7d+T-24h+T-1h, NotResp T-48h+T-4h, No silent).

3. **scripts/smoke-guest-rsvp.cjs ≥13 floor extension** (per Plan 02 SUMMARY's "additional sentinels needed"): production-code sentinels for all three Plan 27-01 CFs (rsvpSubmit/rsvpStatus/rsvpRevoke) + rsvpReminderTick guest-loop sentinels + sw.js CACHE bump assertion (`couch-v39-guest-rsvp` or chosen short-tag) + floor meta-assertion (`eq('Phase 27 smoke meets floor (>=13 assertions)', total >= 13, true)`). Mirrors RPLY-26-17 pattern from Phase 26 (Plan 26-05).

4. **sw.js CACHE bump** via `bash scripts/deploy.sh 39-guest-rsvp` (or chosen short-tag). Auto-bumps the const + handles BUILD_DATE auto-stamp + Sentry DSN guard + mirror to queuenight/public/ + firebase deploy --only hosting from couch repo.

5. **Cross-repo `firebase deploy --only functions`** from `C:\Users\nahde\queuenight\`. Suggested scoped form: `firebase deploy --only functions:rsvpSubmit,functions:rsvpStatus,functions:rsvpRevoke,functions:rsvpReminderTick` to limit blast radius (avoids redeploying unrelated CFs like accountDeletionReaper or the Trakt OAuth functions).

6. **27-HUMAN-UAT.md scaffold** with browser matrix (per RESEARCH Q1 + Plan 03 SUMMARY's Plan-05 readiness note):
   - iOS Safari non-PWA → push block ABSENT (graceful absence, D-06)
   - Android Chrome → push block PRESENT, opt-in works (RSVP-27-08)
   - Two-device revoke (RSVP-27-09): host kebab → Remove → guest's rsvp.html shows revoked state within 30s
   - Two-device close: host Close RSVPs → guest's rsvp.html shows closed state within 30s; host Open RSVPs → flips back
   - Privacy footer link (RSVP-27-13): tap → /privacy
   - Member view: chips render correctly with badge + response label + (guest) suffix on collision
   - Banner: with 0 guests no count appended; with N guests, ' · N guest(s)' appended; with rsvpClosed:true, RSVPs CLOSED pill appears + 'Open RSVPs' toggle visible to host

## Self-Check

Verified each completion claim:

**Files exist:**
- `C:/Users/nahde/claude-projects/couch/.planning/phases/27-guest-rsvp/27-04-SUMMARY.md` — this file
- `C:/Users/nahde/claude-projects/couch/js/app.js` — modified (17458 lines)
- `C:/Users/nahde/claude-projects/couch/css/app.css` — modified (4654 lines)
- `C:/Users/nahde/claude-projects/couch/app.html` — modified (1519 lines)

**Commits exist (couch repo):**
- `f87a3a9` — feat(27-04): extend renderParticipantTimerStrip with guest chips + helpers — FOUND in `git log -5`
- `75d6b26` — feat(27-04): add window.openGuestMenu / revokeGuest / closeRsvps / openRsvps host actions — FOUND
- `21b532a` — feat(27-04): banner guest count + RSVPs CLOSED pill + host Close/Open RSVPs toggle — FOUND

**Must-have grep checks (all PASSED):**
- Task 4.1: 8/8 substrings (`function getFamilyMemberNamesSet` / `function displayGuestName` / `function guestResponseLabel` / `wp-participant-chip guest` / `chip-badge badge-guest` / `(guest)` / `visibleGuests` / `openGuestMenu`)
- Task 4.1: defensive guard `Array.isArray(wp.guests)` PRESENT at js/app.js:12229
- Task 4.2: 10/10 substrings (`window.openGuestMenu` / `window.revokeGuest` / `window.closeRsvps` / `window.openRsvps` / `httpsCallable(functions, 'rsvpRevoke')` / `action: 'revoke'` / `action: 'close'` / `wp-guest-menu` / `rsvpClosed: false` / `flashToast`)
- Task 4.2: confirm() count unchanged at 17 (no new modals)
- Task 4.2: state.familyCode count = 75 (was 74; +1 from openRsvps Firestore write)
- Task 4.3: 12/12 substrings (3 helpers × 2 modes [decl + call] + 1 html comment + 6 css selectors)
- Task 4.3: each helper invoked 3 times in source (1 decl + 2 invocations across both banner branches)
- Task 4.3: css/app.css contains all 6 new selectors (`.wp-participant-chip.guest` / `.wp-guest-kebab` / `.wp-rsvp-closed-pill` / `.wp-guest-menu` / `.wp-guest-menu-item` / `.wp-guest-menu-item.destructive`)
- Task 4.3: css/app.css line count grew +54 (≥30 floor)
- Task 4.3: min-height:44px count grew 17→21 (+4, ≥2 floor — kebab + menu-item touch targets)

**Key-link regex patterns (all PASSED):**
- `wp\.guests.*filter.*revoked` — MATCH at js/app.js:12229
- `rsvpRevoke.*action.*revoke` — MATCH (multiline) in revokeGuest body
- `rsvpRevoke.*action.*close` — MATCH (multiline) in closeRsvps body
- `wp-rsvp-closed-pill` — MATCH in js/app.js (helper) + css/app.css (selector)

**Test runs:**
- `npm run smoke` (10 contracts): exit 0; all contracts green
- smoke-guest-rsvp standalone: 17/17 PASS (helper-contract drift detectors all match Plan 02 scaffold)
- smoke-position-anchored-reactions: 103/103 PASS (Phase 26 floor preserved)
- smoke-native-video-player: PASS
- smoke-sports-feed / smoke-decision-explanation / smoke-tonight-matches / smoke-position-transform / smoke-availability / smoke-kid-mode / smoke-conflict-aware-empty: PASS

## Self-Check: PASSED

---
*Phase: 27-guest-rsvp*
*Plan: 04*
*Completed: 2026-05-02*
