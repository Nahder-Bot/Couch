---
phase: 09-redesign-brand-marketing-surface
plan: 07b
type: execute
wave: 5
depends_on: [09-07a]
files_modified:
  - app.html
  - css/app.css
  - js/app.js
autonomous: false
requirements: [DESIGN-08, DESIGN-09]
user_setup:
  - service: queuenight/functions/index.js (sibling repo)
    why: "consumeGuestInvite CF (guest invite redemption) lives in sibling Cloud Functions; edit + deploy required there"
  - service: queuenight/firebase.json (sibling repo)
    why: "Functions deploy — `firebase deploy --only functions:consumeGuestInvite`"
  - service: Active guest invite token from a dev family
    why: "End-to-end redemption UAT requires a real token minted by the shipped Plan 05-07 inviteGuest CF"
commit_strategy: "3 commits — (1) firestore.rules invariant pre-flight check (capture the temporary:true rules invariant from Plan 05-07 for future archaeology; halts if missing), (2) guest-invite redemption client screen + consumeGuestInvite CF + bootstrapAuth detour, (3) motion audit across css/app.css (DESIGN-09 second half) + prefers-reduced-motion hardening. Three commits = three bisect targets."
batching_rationale: "Rules invariant check is defensive and fast to execute first so any deviation halts before the CF ships. Redemption client + CF is a coherent feature unit. Motion audit is mechanical + orthogonal. Separating these gives clear bisect boundaries."

must_haves:
  truths:
    - "Pre-flight invariant check confirms firestore.rules contains the Plan 05-07 temporary:true member branch BEFORE guest-invite redemption ships; if missing, halt and point to Plan 05-07"
    - "Guest invite redemption screen renders when app.html sees ?invite=<token> — bypasses sign-in screen; renders 'Join <family> as guest' with name input; calls consumeGuestInvite CF; lands on Tonight"
    - "Expired-invite path shows a friendly dead-end screen (NOT sign-in)"
    - "Guest member doc includes seenOnboarding:true at creation (Pitfall 5 defense paired with 09-07a's client guard)"
    - "consumeGuestInvite CF is idempotent: second call with same token errors with failed-precondition (already-consumed)"
    - "Every css/app.css transition: / animation: rule references a --t-* or --duration-* token (no raw 150ms/200ms/300ms literals) AND a --ease-* or --easing-* token (no raw cubic-bezier/ease-in-out literals)"
    - "prefers-reduced-motion block reduces all non-essential motion to ≤50ms or removes transitions"
    - "Motion audit preserves the 4 :root token definitions containing raw cubic-bezier literals — those are LEGITIMATE token definitions, not drift"
  artifacts:
    - path: "app.html"
      provides: "Invite-redeem screen DOM + invite-expired dead-end DOM"
      contains: "invite-redeem-screen"
    - path: "js/app.js"
      provides: "bootstrapAuth ?invite= detour + showInviteRedeemScreen + submitGuestRedeem + fetchInvitePreview wiring"
      contains: "showInviteRedeemScreen"
    - path: "css/app.css"
      provides: "invite-redeem + invite-expired styles + token-normalized transition/animation rules + reduced-motion hardening"
      contains: "invite-redeem-screen"
  key_links:
    - from: "app.html ?invite=<token> bootstrap"
      to: "showInviteRedeemScreen(token)"
      via: "bootstrapAuth query-param inspection BEFORE sign-in gate"
      pattern: "showInviteRedeemScreen"
    - from: "submitGuestRedeem client call"
      to: "queuenight/functions/index.js consumeGuestInvite onCall"
      via: "httpsCallable invocation with { token, guestName }"
      pattern: "consumeGuestInvite"
    - from: "firestore.rules temporary:true member branch (from Plan 05-07)"
      to: "guest member doc writes"
      via: "rules invariant that ALLOWS guest (temporary=true) member doc mutations"
      pattern: "temporary"
---

<objective>
Close DESIGN-08 (guest invite redemption + branded redeem/expired screens) and DESIGN-09 (motion audit across css/app.css). Absorbs the 05x-guest-invite-redemption seed. Lands AFTER 09-07a so brand-facing polish is stable in prod before the guest-auth surface mutates.

Per STATE.md (2026-04-22): Phase 5 plans 05-07 AND 05-08 are code-complete — the temporary:true member rules ARE live in production Firestore. Task 1 captures this as a rules invariant so future archaeology has a floor to stand on if Plan 05-07 rules ever regress.

Purpose: DESIGN-08 + DESIGN-09 close. Phase 9 fully sealed.

Output:
- Firestore rules invariant check (Task 1) — documented + automated; halts if the Plan 05-07 branch is missing
- app.html: invite-redeem screen DOM, invite-expired dead-end DOM
- js/app.js: bootstrapAuth invite detour, showInviteRedeemScreen, fetchInvitePreview, submitGuestRedeem
- css/app.css: invite-redeem + invite-expired styles + motion audit normalization (all durations + easings now token-backed) + prefers-reduced-motion hardening
- sibling queuenight/functions/index.js: consumeGuestInvite CF (admin-SDK, idempotent, rate-limited)
- 3 commits (rules-invariant / redeem+CF / motion-audit)
- Checkpoint before deploy: user validates full redeem flow + motion audit + regression gate on iOS + desktop
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-redesign-brand-marketing-surface/09-RESEARCH.md
@.planning/phases/09-redesign-brand-marketing-surface/09-02-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-03-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-07a-SUMMARY.md
@.planning/seeds/phase-05x-guest-invite-redemption.md
@CLAUDE.md

<interfaces>
Invite redemption interfaces (from seed):
- URL shape: couchtonight.app/?invite=<token> (family code no longer bundled — security per seed)
- bootstrapAuth detects ?invite= BEFORE sign-in gate
- showInviteRedeemScreen(token) renders: wordmark + "Join <family>" + duration badge + name input + "Join the couch" CTA
- consumeGuestInvite CF: input {token, guestName}, output {familyCode, memberId, memberName}; admin SDK writes; idempotent
- Expired-invite dead-end: friendly "This invite link has expired — ask <owner> for a new one"
- Member doc: { type: 'guest', temporary: true, expiresAt, seenOnboarding: true } (setting seenOnboarding at creation prevents the guest-hits-onboarding Pitfall 5)

Firestore rules invariant (from Plan 05-07, currently LIVE in production per STATE.md 2026-04-22):
- /families/{fid}/members/{mid} — allow write iff:
  - existing rules preserved
  - OR new "guest / temporary member" branch: request.resource.data.temporary == true && (admin-SDK-originated OR self-referential guest lifecycle path)
- /invites/{token} — allow read from unauth (if rate-limit counter OK) to support the redeem preview; allow update from admin-SDK only (to flip consumedAt)

The invariant we must guarantee BEFORE shipping the CF: the rules file must CONTAIN a branch referencing `temporary` under /families/{fid}/members/{mid} writes. If it doesn't, either (a) Plan 05-07 rules regressed post-deploy, or (b) the sibling repo's firestore.rules is out of sync with this repo's — either way, halt and point the user at Plan 05-07 before proceeding.

Motion audit targets (from research DESIGN-09 second half):
- Every transition: in css/app.css must reference a --t-* or --duration-* token; no raw 50ms/100ms/150ms/200ms/220ms/300ms/400ms literals
- Every animation-duration: same rule
- Every easing function must reference --ease-* or --easing-* token; no raw cubic-bezier/ease-in-out/ease-out literals
- EXCEPTION: the 4 :root token DEFINITIONS (`--ease-out`, `--ease-cinema`, `--ease-standard`, `--ease-spring`) contain raw cubic-bezier(...) — these are LEGITIMATE token declarations, not drift. The audit script must ignore hits inside :root.
- prefers-reduced-motion block (css:95) should reduce all non-essential motion to ~0 (current rule uses 0.01ms which is fine)

Odd-duration grep (Minor-11 closure). Before the audit starts, enumerate non-canonical raw durations:
```bash
grep -nE 'transition[^;]*[0-9]+ms' css/app.css | grep -vE ':root'
grep -nE 'animation[^;]*[0-9]+ms' css/app.css | grep -vE ':root'
```
Expected canonical tokens map: 50ms -> --t-instant, 150ms -> --t-quick, 220ms -> --t-base (the canonical 200-ish-ms slot), 300ms -> --t-deliberate, 400ms -> --t-cinema. Any odd duration surfaced (e.g. 180ms, 250ms, 500ms) must be explicitly mapped to the nearest token with a comment in the commit body — NOT silently rounded.

Dynamic className logic that MUST be preserved (this plan adds DOM; redemption follows existing screen-section pattern):
- New screens (#invite-redeem-screen, #invite-expired-screen) follow the same `style="display:none"` initial + JS .style.display toggle pattern
- .act-as-active, .is-readonly, .wp-ontime-revert, .on toggles — all untouched
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Firestore rules invariant pre-flight check</name>
  <files>
    firestore.rules
  </files>
  <behavior>
    - Confirms the Plan 05-07 temporary:true member branch is LIVE in firestore.rules before any guest-invite redemption ships
    - If branch is missing, HALTS with a clear error pointing to Plan 05-07
    - If branch is present (expected state per STATE.md 2026-04-22), proceeds with no rules mutation
    - Captures the invariant in a SUMMARY-logged grep result for future archaeology
  </behavior>
  <action>
    Step A — Pre-flight grep. Run:
    ```bash
    node -e "
      const rules = require('fs').readFileSync('firestore.rules','utf8');
      const hasTempBranch = /temporary\\s*==\\s*true|temporary:\\s*true|'temporary'/.test(rules);
      if (!hasTempBranch) {
        console.error('HALT: firestore.rules does not contain a temporary:true member branch.');
        console.error('Plan 05-07 should have shipped this rule. STATE.md 2026-04-22 reports Phase 5 code-complete.');
        console.error('Investigate: is this repo\\'s firestore.rules out of sync with sibling queuenight/? Did a post-deploy rules regression land?');
        console.error('Do NOT ship consumeGuestInvite until the rule is present.');
        process.exit(1);
      }
      console.log('OK: temporary:true member branch present in firestore.rules');
    "
    ```

    Step B — If the check fails:
    - Compare `firestore.rules` in THIS repo against `queuenight/firestore.rules` (sibling repo). Identify divergence.
    - If sibling has the branch and this repo doesn't: sync this repo's copy to match the deployed production rules (NOT a content change — just resync).
    - If NEITHER has the branch: the production deploy from Plan 05-07 relied on a local edit that was never committed. Escalate to user — a standalone rule-recovery commit must land before 09-07b can proceed.

    Step C — If the check passes (expected):
    - Record the grep hit (line numbers + surrounding 5 lines of rule context) in the pending 09-07b SUMMARY as "Plan 05-07 rules invariant confirmed present — `temporary` branch at firestore.rules:<lines>".
    - Do NOT mutate firestore.rules in this commit. The invariant check is a documentation-first, halt-if-false gate.

    Step D — Commit: this task lands as `docs(09-07b): capture Plan 05-07 temporary:true rules invariant pre-flight check`. The commit body contains the grep output + a reference to STATE.md's 2026-04-22 Phase 5 code-complete entry.

    Tooling note: if the user prefers, this check can be added as a shell script at `.planning/phases/09-redesign-brand-marketing-surface/check-rules-invariant.sh` so the invariant becomes a re-runnable artifact. Recommended but optional.
  </action>
  <verify>
    <automated>node -e "const rules = require('fs').readFileSync('firestore.rules','utf8'); const hasTempBranch = /temporary\s*==\s*true|temporary:\s*true|'temporary'/.test(rules); if (!hasTempBranch) { process.exit(1); }"</automated>
  </verify>
  <done>
    firestore.rules contains the Plan 05-07 temporary:true member branch (invariant confirmed).
    Grep output recorded in pending SUMMARY for future archaeology.
    No rules mutation in this commit.
    Commit 1 of 3 landed.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Guest invite redemption screen + consumeGuestInvite CF + bootstrapAuth detour (absorbs 05x-guest-invite-redemption)</name>
  <files>
    app.html
    css/app.css
    js/app.js
  </files>
  <behavior>
    - bootstrapAuth detects ?invite=&lt;token&gt; in URL BEFORE sign-in gate, skips to showInviteRedeemScreen(token)
    - Screen: wordmark + "Join &lt;family&gt; as a guest" + duration badge + name input + "Join the couch" CTA + fine print
    - Submit: calls sibling consumeGuestInvite CF -> sets state.groups -> switches family -> lands Tonight with guest chip (badge-guest)
    - Expired/invalid invite: renders friendly dead-end screen ("This invite link has expired - ask the family owner for a new one"), does NOT route to sign-in
    - Guest member doc includes seenOnboarding:true at creation (Pitfall 5 double defense with 09-07a's client guard)
    - consumeGuestInvite CF in queuenight/functions/ — onCall, admin-SDK, idempotent (second call with same token errors with failed-precondition: already-consumed)
    - Tests: bootstrapAuth redirect check, showInviteRedeemScreen renders family name from prefetch, submitGuestRedeem happy-path + expired-path
  </behavior>
  <action>
    Step A — app.html: add invite-redeem screen DOM (sibling to signin-screen):
    ```
    <section id="invite-redeem-screen" class="wrap has-leather" style="display:none">
      <div class="brand-hero-small">...wordmark + "Join <family> as a guest"...</div>
      <span class="badge-guest">Your guest pass: <span id="invite-duration-label">1 week</span></span>
      <input id="invite-guest-name" class="input" placeholder="Your name" type="text">
      <button id="invite-redeem-submit" class="btn-primary" onclick="submitGuestRedeem()">Join the couch</button>
      <p class="fine-print">Guest access expires in <span id="invite-expires-label">7 days</span>. You can vote, react, and join watchparties.</p>
    </section>
    <section id="invite-expired-screen" class="wrap has-leather" style="display:none">
      <div class="brand-hero-small">...wordmark + "This invite has expired"...</div>
      <p>Ask the family owner for a new invite.</p>
    </section>
    ```

    Step B — css/app.css styling for invite-redeem-screen + invite-expired-screen:
    - .badge-guest — pill with var(--color-accent-secondary) bg + sage accent border (--good-glow variant)
    - Tokenized padding + token-based typography (--font-display, --font-serif) throughout; no new one-offs

    Step C — js/app.js:
    - `bootstrapAuth` gains early branch: if URL has `?invite=<token>`, stash token in sessionStorage, call `showInviteRedeemScreen(token)`, return early (do NOT proceed to sign-in gate)
    - `showInviteRedeemScreen(token)` — prefetches invite doc (via a tiny public-read CF or via exposing invites/{token} reads to unauthenticated traffic; per seed's security note, research a rate-limited public-read path OR surface minimal details via the CF). Pseudo:
      - Call `fetchInvitePreview(token)` -> returns { familyName, durationLabel, expiresAt } OR throws expired/invalid
      - On success: populate DOM labels, show invite-redeem-screen
      - On expired/invalid: show invite-expired-screen
    - `submitGuestRedeem()`:
      - Read token from sessionStorage + name from input
      - Call consumeGuestInvite CF (onCall) with { token, guestName }
      - CF returns { familyCode, memberId, memberName }
      - Update state.groups + state.currentFamily + state.me (with type:'guest', temporary:true, expiresAt, seenOnboarding:true)
      - Subscribe to the family + land on Tonight

    Step D — sibling CF (queuenight/functions/index.js): add `consumeGuestInvite` onCall function. Admin SDK:
    - Validate token: Firestore read `invites/{token}`. If missing -> throw 'not-found'. If expiresAt < now -> throw 'failed-precondition: expired'. If consumedAt set -> throw 'failed-precondition: already-consumed'.
    - Create anonymous-auth user OR require client to signInAnonymously first (seed discusses both — pick: signInAnonymously on client side BEFORE the CF call so writeAttribution works).
    - Create member doc under families/{familyCode}/members/{memberId} with { uid: caller, type:'guest', temporary:true, name:guestName, expiresAt, seenOnboarding:true, createdAt: serverTimestamp }
    - Mark invite consumed: invites/{token}.consumedAt = serverTimestamp + consumedBy = memberId
    - Return { familyCode, memberId, memberName }

    Step E — Security: App Check or simple Firestore counter to rate-limit consumeGuestInvite per-IP. Per seed, this is recommended. Minimum viable: a rate-limit check reading a recent consumption counter for the IP, reject if > N per window.

    Step F — TDD tests:
    - Test 1: bootstrapAuth with ?invite= in URL calls showInviteRedeemScreen and skips sign-in
    - Test 2: showInviteRedeemScreen renders family name + duration label from CF response
    - Test 3: submitGuestRedeem happy-path: CF success -> state.me.type === 'guest' && state.me.seenOnboarding === true
    - Test 4: submitGuestRedeem expired-invite path: CF throws failed-precondition -> shows invite-expired-screen, no sign-in redirect

    Commit message: `feat(09-07b): guest invite redemption screen + consumeGuestInvite CF + bootstrapAuth detour`.
  </action>
  <verify>
    <automated>grep -q 'invite-redeem-screen' app.html &amp;&amp; grep -q 'invite-expired-screen' app.html &amp;&amp; grep -q 'showInviteRedeemScreen' js/app.js &amp;&amp; grep -q 'submitGuestRedeem' js/app.js &amp;&amp; grep -q 'badge-guest' css/app.css &amp;&amp; node --check js/app.js</automated>
  </verify>
  <done>
    Invite-redeem flow lands a guest directly on Tonight without showing sign-in.
    Expired invite shows friendly dead-end.
    consumeGuestInvite CF committed in sibling queuenight/functions/.
    Pitfall 5 defense confirmed: guest members get seenOnboarding:true at creation (double-guards 09-07a's client guard).
    Commit 2 of 3 landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: Motion audit across css/app.css (DESIGN-09 second half)</name>
  <files>
    css/app.css
  </files>
  <behavior>
    - Every transition: / animation: rule in css/app.css references a --t-* or --duration-* token (no raw ms literals outside :root)
    - Every easing function references a --ease-* or --easing-* token (no raw cubic-bezier/ease-* outside :root)
    - prefers-reduced-motion block hardened to reduce all non-essential motion to ≤50ms
    - The 4 :root token definitions (--ease-out, --ease-cinema, --ease-standard, --ease-spring) preserved verbatim
    - Odd durations (180ms, 250ms, etc.) explicitly mapped with commit-body comments per Minor-11 checker closure
  </behavior>
  <action>
    Step A — Pre-audit grep (Minor-11 closure). Enumerate odd durations:
    ```bash
    grep -nE 'transition[^;]*[0-9]+ms' css/app.css | grep -v ':root'
    grep -nE 'animation[^;]*[0-9]+ms' css/app.css | grep -v ':root'
    ```
    Record the full list with line numbers in a scratch file. For each odd duration, decide the canonical mapping:
    - 50ms -> var(--t-instant)
    - 100-175ms -> var(--t-quick) (150ms canonical)
    - 180-260ms -> var(--t-base) (220ms canonical)
    - 261-350ms -> var(--t-deliberate) (300ms canonical)
    - 351+ms -> var(--t-cinema) (400ms canonical)

    Any duration that doesn't map cleanly (e.g. a deliberate 800ms cinema shimmer) — escalate to the user or map to --t-cinema with an inline comment explaining the deviation.

    Step B — Motion audit. Grep for every transition + animation + easing in css/app.css:
    - `grep -nE 'transition:\s*[^;]+' css/app.css` — list every transition declaration
    - `grep -nE 'animation(-duration)?:\s*[0-9]+m?s' css/app.css` — raw duration literals
    - `grep -nE 'cubic-bezier|ease-(in|out|in-out)\b' css/app.css` — raw easing functions

    For each hit OUTSIDE :root:
    - If duration uses a raw ms value (e.g. 200ms), replace with the nearest token per the mapping table
    - If easing is a raw function, replace: cubic-bezier(0.2, 0.8, 0.2, 1) -> var(--ease-out), cubic-bezier(0.32, 0.72, 0, 1) -> var(--ease-cinema), cubic-bezier(0.4, 0, 0.2, 1) -> var(--ease-standard), ease-out/ease-in-out heuristically map to var(--ease-standard)
    - EXCEPTION 1 (:root): the 4 token definitions keep raw cubic-bezier — they ARE the tokens.
    - EXCEPTION 2 (prefers-reduced-motion): the block at css:95 uses `0.01ms` literals — keep those (they mean "effectively off" and are the documented trick).

    Step C — prefers-reduced-motion hardening:
    - Current rule reduces animation-duration + transition-duration to 0.01ms. Verify it captures scroll-behavior:auto too.
    - Add explicit carve-outs for any motion judged "essential": e.g. if a progress spinner's animation is essential, consider letting it run at a longer duration instead of zeroing out. Document decisions inline in the @media rule.

    Step D — Post-audit self-check:
    - `grep -cE 'transition:\s*[^;]*[0-9]+m?s' css/app.css` — outside :root, returns 0 (no raw transition durations). Trick: grep `-v ':root'` doesn't work mid-block; use an AWK pass that flags hits by section.
    - `grep -cE 'animation:\s*[^;]*[0-9]+m?s' css/app.css` — same, outside :root, should return hits only for @keyframes references (NOT duration literals — verify by manual inspection).
    - `grep -cE 'cubic-bezier' css/app.css` returns exactly 4 (the 4 :root token definitions — nothing else).

    Automated audit script (captures the exceptions cleanly):
    ```bash
    node -e "
      const css = require('fs').readFileSync('css/app.css','utf8');
      // Strip :root block
      const noRoot = css.replace(/:root\\{[\\s\\S]+?\\n\\}/, '');
      // Strip prefers-reduced-motion block
      const noReduced = noRoot.replace(/@media \\(prefers-reduced-motion[\\s\\S]+?\\n\\}\\s*\\n\\}/, '');
      // Look for raw ms in transitions / animations
      const rawMs = noReduced.match(/(transition|animation)(-duration)?:[^;]*?[0-9]+m?s/g) || [];
      const rawEase = noReduced.match(/cubic-bezier\\(|ease-in|ease-out\\b|ease-in-out/g) || [];
      if (rawMs.length || rawEase.length) {
        console.error('AUDIT FAIL:', { rawMs: rawMs.slice(0,5), rawEase: rawEase.slice(0,5) });
        process.exit(1);
      }
      console.log('AUDIT OK');
    "
    ```

    Step E — Commit message: `refactor(09-07b): motion audit — normalize all transitions/animations to token-backed durations + easings`. Commit body lists every odd-duration mapping made (e.g. "180ms at css/app.css:412 -> var(--t-base)") so the next reviewer can sanity-check the rounding decisions.
  </action>
  <verify>
    <automated>node -e "const css = require('fs').readFileSync('css/app.css','utf8'); const noRoot = css.replace(/:root\{[\s\S]+?\n\}/, ''); const noReduced = noRoot.replace(/@media \(prefers-reduced-motion[\s\S]+?\n\}\s*\n\}/, ''); const rawMs = noReduced.match(/(transition|animation)(-duration)?:[^;]*?[0-9]+m?s/g) || []; if (rawMs.length) { console.error('AUDIT FAIL:', rawMs.slice(0,5)); process.exit(1); } console.log('AUDIT OK');"</automated>
  </verify>
  <done>
    All transitions and animation durations in css/app.css reference tokens (outside :root + prefers-reduced-motion).
    cubic-bezier + raw ease-* literals only exist inside :root token definitions (exactly 4).
    prefers-reduced-motion block hardened with documented carve-outs if any.
    Odd-duration mappings recorded in commit body.
    Commit 3 of 3 landed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: UAT across guest-invite redemption + motion audit + regression gate</name>
  <what-built>
    Three commits landed: (1) rules invariant confirmed, (2) guest-invite redemption + consumeGuestInvite CF, (3) motion audit. Ready for end-to-end verification. Phase 9 closes after this passes.
  </what-built>
  <how-to-verify>
    Deploy: copy app.html + css/app.css + js/app.js to queuenight/public/, deploy sibling CF (`firebase deploy --only hosting,functions:consumeGuestInvite`).

    1. Invite redeem (DESIGN-08):
       - Create a guest invite from Account settings (owner flow from Plan 05-07 which is already shipped).
       - Copy the URL.
       - Open in a different browser / incognito: couchtonight.app/?invite=<token>
       - Expected: lands on invite-redeem-screen (NOT sign-in). Shows family name, duration badge, name input.
       - Type a name, tap "Join the couch". Expected: lands on Tonight as guest chip with badge-guest. No onboarding fired (Pitfall 5 defense — 09-07a client guard + this plan's seenOnboarding:true at creation).
       - Verify owner sees the new chip appear in their member list within 1s.
       - Test expired path: manually set invites/{token}.expiresAt to a past timestamp in Firestore console. Click the URL again. Expected: invite-expired-screen with friendly message, NOT sign-in.
       - Test idempotency: try to submit the same token twice. Second submission should surface a "already consumed" toast or redirect to expired screen.

    2. Rate-limit spot-check:
       - Attempt to call consumeGuestInvite with fake tokens from the same IP in rapid succession (5-10 within a minute). Expected: after N attempts, CF returns rate-limit error.

    3. Motion audit (DESIGN-09):
       - Enable "Reduce Motion" in OS settings (iOS: Settings -> Accessibility -> Motion -> Reduce Motion ON).
       - App: tap a title -> modal opens without its cinematic-slide animation (snap in). Toast appears without slide. Button presses feel instant.
       - DevTools: verify `grep -cE 'cubic-bezier' css/app.css` returns exactly 4 (only the :root token declarations).
       - Spot-check a handful of screens (Tonight, Title Detail, Watchparty, Settings modal, Intent RSVP): animations still feel right — no jarring snap, no dropped-frame transitions.

    4. Regression gate — 09-07a surfaces unchanged:
       - Onboarding first-run still fires for new users.
       - Legacy self-claim CTA still renders on legacy families.
       - Sign-in methods card still lists providers + offers set-password.
       - Intent tz-aware push still renders correct local time.

    5. Regression gate — pre-Phase-9 surfaces unchanged:
       - Walk through: Tonight spin, mood filter, veto pre/post-spin, watchparty start + join + reactions, intent create + RSVP. Nothing visibly broken.

    6. iOS physical device pass: install the latest deploy on a real iPhone. Redeem an invite on a second Google account / browser. Launch the installed PWA as the host; verify the guest chip appears. Confirm no CSS layout regressions on iPhone specifically.
  </how-to-verify>
  <resume-signal>
    Type "approved" if all 6 verification tracks pass. Type "invite redeem broken" / "rate-limit not firing" / "motion raw <hits>" / "regression <surface>" for specific failures. Claude investigates and repairs.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Unauthed URL (?invite=token) -> bootstrapAuth detour | Client trusts the URL param to identify an invite; CF validates |
| Anon auth + CF write path -> Firestore guest member doc | consumeGuestInvite runs admin-SDK; rules bypass |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-07b-01 | Spoofing | Attacker guesses valid invite token and enumerates tokens via consumeGuestInvite | mitigate | Tokens are 32+ bytes cryptographically random (per seed + Plan 05-07 inviteGuest CF). App Check or rate-limit counter on consumeGuestInvite (Task 2 Step E). |
| T-09-07b-02 | Information Disclosure | invite-redeem prefetch leaks family name/code to unauth URL visitor | mitigate | Per seed's security note: invite token alone resolves family. Do NOT bundle `?family=CODE` in the URL. Family name is returned by CF only after valid token resolution (not from unauth Firestore read). |
| T-09-07b-03 | Denial of Service | maybeShowFirstRunOnboarding fires for guests, breaks the redeem-to-Tonight flow (Pitfall 5) | mitigate | 09-07a added the client guard `if (state.me.type === 'guest') return;`. This plan's consumeGuestInvite CF sets seenOnboarding:true at member-creation time — double defense. |
| T-09-07b-04 | Elevation of Privilege | Guest member writes to protected paths | mitigate | Existing rules (Plan 05-07) already constrain temporary:true members. Task 1 invariant check confirms this branch is live before the CF ships. This plan adds no new write paths. |
| T-09-07b-05 | Tampering | Motion audit replacement changes behavior for a component that relied on a specific duration | accept | All tokens map to the same milliseconds as the literal values being replaced (e.g. 150ms -> var(--t-quick) == 150ms). Value-preserving refactor. Odd-duration mappings explicitly logged in commit body for reviewer verification. |
| T-09-07b-06 | Tampering | :root token redefinition silently alters many rules that reference tokens | accept | Rationale: this plan does NOT redefine any :root token. 09-02 owns the :root extensions; 09-07b only changes call sites. The audit script explicitly strips :root from the scan. |
| T-09-07b-07 | Denial of Service | consumeGuestInvite rate-limit locks out a legitimate burst of invites on a shared corporate IP | accept | Standard trade-off. Legitimate users retry with exponential backoff; worst case they wait 60s. Tuneable post-launch if real-world friction surfaces. |
| T-09-07b-08 | Tampering | Plan 05-07 rules invariant regresses after Task 1 but before CF deploy | mitigate | Invariant check is a first-commit gate. Any subsequent rules edit between Task 1 and Task 2 deploy would be caught by the sibling-repo pre-deploy checks in firebase CLI. If paranoid: re-run the invariant check as step 0 of Task 4 UAT. |

</threat_model>

<verification>
End-of-plan checks:
- `node -e "const r = require('fs').readFileSync('firestore.rules','utf8'); if(!/temporary/.test(r)) process.exit(1);"` passes (Task 1 invariant).
- `grep -q 'invite-redeem-screen' app.html && grep -q 'showInviteRedeemScreen' js/app.js` passes.
- Audit script (from Task 3) passes: zero raw ms literals outside :root + prefers-reduced-motion.
- cubic-bezier occurrences exactly 4 (the :root token definitions).
- `node --check js/app.js` passes.
- Task 4 user UAT approves all 6 tracks.
</verification>

<success_criteria>
DESIGN-08 closes — "Invite-flow onboarding polished + brand-aligned":
- ✓ Guest invite redemption screen replaces the stub; branded; expired-path dead-ends friendly.
- ✓ consumeGuestInvite CF is idempotent + rate-limited.
- ✓ Pitfall 5 double-guarded (09-07a client guard + this plan's CF-side seenOnboarding:true at creation).

DESIGN-09 second half closes — "Motion language applied":
- ✓ All transitions + animations use token-backed durations + easings.
- ✓ Raw cubic-bezier / ease-* literals only inside :root token definitions (4 tokens).
- ✓ prefers-reduced-motion hardened.
- ✓ Odd-duration mappings explicitly logged in commit body (Minor-11 closure).

Absorbed seed: 05x-guest-invite-redemption (consumeGuestInvite CF + redeem screen) shipped in-brand.

Phase 9 closes: all DESIGN-01..DESIGN-10 requirements met across 09-01 through 09-07b.
</success_criteria>

<risk_notes>
- **No bundler:** all edits ship to single-file app.html + css/app.css + js/app.js. No compile step.
- **Two-repo sync (explicit):** consumeGuestInvite CF lives in sibling queuenight/functions/. Task 2 explicitly calls out sibling-repo deploy via `firebase deploy --only functions:consumeGuestInvite`. firestore.rules in THIS repo does NOT change in this plan (Task 1 is a read-only invariant check).
- **iOS PWA primary surface:** invite redeem screen follows the existing screen-section pattern (.style.display toggles). Tested in Task 4 on physical iOS for the user's approval.
- **Dynamic className logic preserved + extended:** new screens (#invite-redeem-screen, #invite-expired-screen) follow the same `style="display:none"` initial + JS .style.display toggle pattern used by existing screens. Plan 09-03's Pitfall 2 defense remains intact: no attempt to replace .style.display with .is-hidden.
- **Plan 09-04 responsive layer benefits:** new screens render well at desktop viewport because .phone-shell wrap from 09-04 caps them sensibly.
- **Plan 09-03 token-backed classes used:** .brand-hero-small, .badge-guest (new), .fine-print all use token references.
- **Plan 09-02 font-family tokens referenced:** new rules in css/app.css use --font-display / --font-serif rather than repeating typeface strings.
- **09-07a landed first (depends_on chain):** stable brand-facing polish is in prod before guest-auth surface changes here. If 09-07b surfaces a regression, rollback window is smaller because 09-07a's commits are decoupled.
- **Rules invariant check (Task 1, Blocker-3 closure):** STATE.md confirms Plan 05-07 rules are live in production. This check captures the invariant for future archaeology + halts the plan if the rule is missing at the moment of execution. Fail-fast gate; zero mutation on the happy path.
- **Motion audit is value-preserving:** tokens map to the same milliseconds as the literals being replaced. However, any component that depended on a specific odd duration (e.g. 180ms) gets rounded to the nearest token tier. The commit body lists every non-canonical duration mapping so a reviewer can veto a rounding if visible regression surfaces.
- **Checkpoint gates deploy:** Task 4 is checkpoint:human-verify. 6 verification tracks cover everything this plan touches + explicit regression gates against 09-07a and pre-Phase-9 surfaces.
</risk_notes>

<output>
After completion, create `.planning/phases/09-redesign-brand-marketing-surface/09-07b-SUMMARY.md`
</output>
