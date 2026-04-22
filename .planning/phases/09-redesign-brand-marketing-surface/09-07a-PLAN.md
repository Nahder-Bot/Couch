---
phase: 09-redesign-brand-marketing-surface
plan: 07a
type: execute
wave: 4
depends_on: [09-01, 09-02, 09-03, 09-04, 09-05, 09-06]
files_modified:
  - index.html
  - app.html
  - css/app.css
  - js/app.js
  - .planning/BRAND.md
  - firestore.rules
autonomous: false
requirements: [DESIGN-07, DESIGN-10]
user_setup:
  - service: queuenight/functions/index.js (sibling repo)
    why: "onIntentCreated CF timezone fix lives in sibling Cloud Functions; edit + deploy required there"
  - service: queuenight/firebase.json (sibling repo, if not already covered by 09-05)
    why: "Rules update + functions deploy — `firebase deploy --only firestore:rules,functions:onIntentCreated`"
  - service: Account settings access on a legacy family (e.g. ZFAM7 or similar without ownerUid)
    why: "Testing the legacy-family self-claim CTA requires a family doc without ownerUid stamped"
commit_strategy: "3 commits — (1) first-run onboarding (3-step + seenOnboarding gate) + legacy self-claim CTA + account-settings sign-in polish (absorbs 05x-account-linking #6 + #7 + 05x-legacy-family-ownership), (2) BRAND.md authored in .planning/ (DESIGN-10), (3) onIntentCreated CF timezone fix + client creatorTimeZone write (absorbs 08x-intent-cf-timezone). Three commits = three bisect targets. NO guest-invite work here — that ships in 09-07b."
batching_rationale: "Brand-facing polish + docs + tiny CF fix are semantically distinct. Each commit is independently deployable; none touch the guest-auth surface. Splitting this from 09-07b reduces blast radius: if the guest-invite redemption in 09-07b surfaces a regression, 09-07a's commits remain live and stable."

must_haves:
  truths:
    - "First-run onboarding renders for new users (non-guest, seenOnboarding !== true) — 3-step flow with hard skip on every step; sets seenOnboarding:true on members/{id} on complete OR skip"
    - "Guest members (state.me.type === 'guest') skip onboarding entirely (research Pitfall 5) — double-guarded client-side even though 09-07b sets seenOnboarding:true at guest creation"
    - "Settings account tab shows a 'Replay intro' button so dismissed onboarding can be resurfaced"
    - "Legacy family without ownerUid shows a 'Claim ownership of this group' CTA in Account settings; first-write-wins; after claim, CTA disappears and Group admin section renders"
    - "firestore.rules gains a legacy-self-claim branch permitting a signed-in member to write `ownerUid = request.auth.uid` only when the existing doc has no ownerUid"
    - "Account settings sign-in methods card absorbs 05x #6 (Set password for faster sign-in via updatePassword) + #7 (Sign-in vs Create-account split on landing/sign-in screens)"
    - ".planning/BRAND.md exists; ≤1500 words; covers identity, color tokens (with WebAIM contrast verification), typography, spacing+radius+shadow, motion catalog, voice guide, screen patterns, do/don't gallery"
    - "onIntentCreated CF renders proposedStartAt using intent.creatorTimeZone (falls back to UTC for legacy intents); client writes creatorTimeZone on every new intent doc"
  artifacts:
    - path: ".planning/BRAND.md"
      provides: "Canonical brand-system documentation referenced by Phase 10 + future phases"
      min_lines: 150
    - path: "app.html"
      provides: "First-run onboarding DOM (overlay + 3 steps) + legacy-self-claim CTA + replay-intro button + sign-in methods card DOM"
      contains: "onboarding-step-1"
    - path: "js/app.js"
      provides: "maybeShowFirstRunOnboarding gate + completeOnboarding writer + legacy self-claim client flow + renderSignInMethodsCard + setUserPassword helper + creatorTimeZone write on intent create"
      contains: "seenOnboarding"
    - path: "css/app.css"
      provides: "Onboarding overlay + step styles + sign-in methods card tokenized styling (NO motion audit — that's 09-07b)"
      contains: "onboarding-overlay"
    - path: "firestore.rules"
      provides: "Legacy self-claim branch on /families/{fid} updates"
      contains: "ownerUid"
  key_links:
    - from: "signed-in + has-family + non-guest + !seenOnboarding"
      to: "showOnboardingStep(1)"
      via: "maybeShowFirstRunOnboarding called from routeAfterAuth"
      pattern: "maybeShowFirstRunOnboarding"
    - from: "state.ownerUid == null && auth.uid is signed in"
      to: "renderLegacyClaimCtaIfApplicable"
      via: "conditional render in renderSettings"
      pattern: "renderLegacyClaimCtaIfApplicable|dismissedOwnerClaim"
    - from: "queuenight/functions/index.js onIntentCreated sendPush"
      to: "toLocaleTimeString with timeZone: intent.creatorTimeZone"
      via: "CF read of the new field + client write on intent create"
      pattern: "creatorTimeZone"
---

<objective>
Close Phase 9's brand-facing polish, documentation, and one absorbed micro-fix. Ship first-run onboarding (DESIGN-07), BRAND.md (DESIGN-10), and three absorbed seeds (05x-account-linking items #6/#7, 05x-legacy-family-ownership-migration, 08x-intent-cf-timezone) — all aligned to the refreshed brand. Explicitly does NOT include guest-invite redemption OR motion audit — both move to 09-07b for reduced blast radius and sharper bisect scope.

Purpose: DESIGN-07 + DESIGN-10 close. Three absorbed seeds ship in-brand from the start rather than retrofitted. Lands BEFORE 09-07b so a-level stability is proven in prod before the guest-auth surface changes.

Output:
- app.html: onboarding overlay DOM, replay-intro settings button, legacy self-claim CTA DOM, sign-in-methods card DOM
- js/app.js: onboarding gate + persistence, legacy self-claim flow, setUserPassword helper, signin-vs-create UX split, creatorTimeZone write on intent create
- css/app.css: onboarding + sign-in methods card styles (NO motion audit)
- firestore.rules: legacy self-claim branch
- .planning/BRAND.md: canonical brand-system doc (≥150 lines)
- sibling queuenight/functions/index.js: onIntentCreated timezone fix
- 3 commits (onboarding+self-claim+signin-ux / BRAND / intent-tz-fix)
- Checkpoint before deploy: user validates onboarding + self-claim + password set + intent tz on iOS + desktop
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-redesign-brand-marketing-surface/09-RESEARCH.md
@.planning/phases/09-redesign-brand-marketing-surface/09-01-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-02-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-03-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-04-SUMMARY.md
@.planning/phases/09-redesign-brand-marketing-surface/09-05-SUMMARY.md
@.planning/seeds/phase-05x-account-linking.md
@.planning/seeds/phase-05x-legacy-family-ownership-migration.md
@.planning/seeds/phase-08x-intent-cf-timezone.md
@CLAUDE.md

<interfaces>
Onboarding gate from research Example 4:
```
function maybeShowFirstRunOnboarding() {
  if (!state.me) return;
  if (state.me.type === 'guest') return;
  if (state.me.seenOnboarding === true) return;
  showOnboardingStep(1);
}

async function completeOnboarding() {
  hideOnboarding();
  await updateDoc(doc(membersRef, state.me.id), { seenOnboarding: true });
}
```

3-step content from research Onboarding section:
- Step 1 — "What Couch does" — couch silhouette + tagline "Couch turns 'what do you want to watch?' into a 30-second ritual." — buttons: "Show me how" / "Skip intro"
- Step 2 — "How picking works" — illustration of spin / pick / veto / re-spin — buttons: "Got it" / "Skip intro"
- Step 3 — "What makes it yours" — 4-grid of moods / watchparty / intent / push icons — button: "Let's go" (completes + lands Tonight)

Every step: Skip visible + equal-weight with primary CTA. No forced push-opt-in in onboarding.

Legacy self-claim interfaces (from seed):
- Condition: state.me exists && state.ownerUid == null && !state.dismissedOwnerClaim
- UI: CTA in Account settings "Claim ownership of this group"
- Action: confirm -> writeDoc families/{fid} { ownerUid: state.auth.uid }
- Rules branch: allow update if existing doc has no ownerUid && auth.uid exists && writing own uid && nothing else changed
- After claim: CTA disappears for all members; Group admin section renders

Account linking seed items #6 + #7 (05x-account-linking):
- #6 "Set a password for faster sign-in" — after email-link first-sign-in, one-time banner "Set password so you can sign in faster from other devices". Account settings row. Calls updatePassword(auth.currentUser, password). Sign-in screen gets a "Sign in with password" path.
- #7 "Sign in vs Create account" split on landing screen — pure copy/layout polish. Two zones: "Welcome back" (sign-in CTA) + "New to Couch?" (create-account CTA). Same Firebase methods behind both. Optional localStorage.qn_last_provider hint for one-tap reauth.

BRAND.md structure (from research Brand Docs section):
1. Identity (logo, clear-space, do/don't)
2. Color tokens (primitive + semantic tables; WebAIM contrast results)
3. Typography tokens (Fraunces / Instrument Serif / Inter usage matrix) — references --font-display/--font-serif/--font-sans from plan 09-02
4. Spacing + radius + shadow tokens (one-line per token)
5. Motion tokens (canonical micro-interaction catalog from 09-RESEARCH)
6. Voice guide (tone "Warm, Cinematic, Lived-in. Restraint is the principle."; 10-15 do/don't copy examples; UI copy rules)
7. Screen patterns (3-tier: hero + tab-sections + modals with class-name refs)
8. Do / don't gallery (8-10 examples showing tasteful vs drift)

Keep BRAND.md under 1500 words. Target audience: future-Claude + the user.

onIntentCreated CF timezone fix (from 08x seed):
- Client (js/app.js inside createIntent): add `creatorTimeZone: (Intl.DateTimeFormat().resolvedOptions().timeZone || null)` to the intent doc
- CF (queuenight/functions/index.js:365): change `toLocaleTimeString([], { hour, minute })` to `toLocaleTimeString([], { hour, minute, timeZone: intent.creatorTimeZone || 'UTC' })`
- Legacy intents (pre-fix) fall back to UTC — acceptable graceful degrade
- ~30 min total; mirrors the 07-05 fix pattern exactly

Dynamic className logic that MUST be preserved (this plan adds DOM; none of the changes touch existing toggles):
- .act-as-active, .is-readonly, .wp-ontime-revert, .on toggles — all untouched
- style.display writes to screen sections — this plan ADDS onboarding overlay which follows the same pattern (initial inline style=display:none + JS toggles .style.display)
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: First-run onboarding + legacy self-claim CTA + sign-in-methods card (absorbs 05x-account-linking #6+#7 + 05x-legacy-family-ownership)</name>
  <files>
    app.html
    css/app.css
    js/app.js
    firestore.rules
  </files>
  <behavior>
    - Signed in + has-family + non-guest + seenOnboarding !== true => 3-step onboarding overlay renders; Skip visible every step; complete OR skip both write seenOnboarding=true
    - Guests skip entirely (Pitfall 5) — client-side guard even though 09-07b sets the flag at creation
    - Settings account tab has a "Replay intro" button that unsets seenOnboarding locally and shows onboarding
    - Legacy family (state.ownerUid == null && !state.dismissedOwnerClaim) shows "Claim ownership" CTA in Account settings
    - Claim CTA -> confirm -> updates families/{fid}.ownerUid = uid -> CTA disappears -> Group admin section renders
    - firestore.rules gains a legacy-self-claim branch permitting the write only when the existing doc lacks ownerUid
    - Account settings gets a "Sign-in methods" card: shows linked providers, "Set password" row (calls updatePassword), password change/remove rows if set, error handling for weak-password / requires-recent-login
    - Sign-in screen + landing CTAs get a "Sign in" / "Create account" split — two zones, two CTAs, same underlying Firebase methods
    - Tests: unit tests for maybeShowFirstRunOnboarding gate, for completeOnboarding Firestore write payload, for legacy-self-claim predicate, for hasPasswordCredential returning true/false from providerData
  </behavior>
  <action>
    Step A — Onboarding DOM in app.html. Add a single overlay container below the app-shell:
    ```
    <div id="onboarding-overlay" class="onboarding-overlay" style="display:none">
      <div id="onboarding-step-1" class="onboarding-step">...Step 1 markup...</div>
      <div id="onboarding-step-2" class="onboarding-step" style="display:none">...Step 2...</div>
      <div id="onboarding-step-3" class="onboarding-step" style="display:none">...Step 3...</div>
    </div>
    ```
    Each step: hero illustration placeholder, italicized tagline (page-tagline class from 09-03), primary button (Next/Let's go), secondary button (Skip intro) with equal visual weight.

    Step B — CSS for onboarding in css/app.css:
    - `.onboarding-overlay` — fixed, full-viewport, z-index above app-shell, `.has-leather` texture, token-backed padding
    - `.onboarding-step` — centered column; illustration top, copy middle, buttons bottom; reveals with fade at --duration-deliberate using --easing-cinema
    - `.onboarding-skip` — same visual weight as primary; not buried
    - Reference --font-display / --font-serif tokens from 09-02 for typography

    Step C — js/app.js onboarding flow:
    - Add `window.showOnboardingStep(n)`, `window.nextOnboardingStep()`, `window.skipOnboarding()`, `window.completeOnboarding()`
    - `maybeShowFirstRunOnboarding()` called from routeAfterAuth after a family is loaded and state.me is populated
    - `completeOnboarding()` and `skipOnboarding()` both write `seenOnboarding: true` to members/{state.me.id} via updateDoc + hide overlay
    - `hideOnboarding()` sets display:none on overlay + each step

    Step D — Settings "Replay intro" button:
    - Add button to Account settings. onclick: locally set state.me.seenOnboarding = false (in-memory only; we don't need a Firestore write to replay since maybeShowFirstRunOnboarding re-checks) + call showOnboardingStep(1)

    Step E — Legacy self-claim CTA in Account settings:
    - `renderLegacyClaimCtaIfApplicable()` — renders a card in Account settings iff (state.me && state.ownerUid == null && !state.dismissedOwnerClaim && auth.uid is the signed-in user's uid)
    - Card: "Claim ownership of this group" + "You're the admin? Lock ownership to this account." + primary "Claim ownership" + secondary "Dismiss for now"
    - On claim: confirm dialog -> updateDoc(familyDocRef, { ownerUid: state.auth.uid }) -> toast "You are now the group admin" -> re-render
    - On dismiss: state.dismissedOwnerClaim = true (local only; can revisit by reloading)
    - After successful claim: state.ownerUid set by onSnapshot; CTA disappears naturally

    Step F — firestore.rules legacy self-claim branch. Add to /families/{fid} update permissions:
    ```
    allow update: if
      // existing rules preserved...
      ||
      // Legacy ownership self-claim: no ownerUid exists, caller is auth'd, caller writes own uid as ownerUid, no other fields changed
      ( !('ownerUid' in resource.data) &&
        request.auth.uid != null &&
        request.resource.data.ownerUid == request.auth.uid &&
        request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ownerUid']) );
    ```
    Preserve existing rules branches verbatim; append this as a new OR-branch. Refer to seed for exact shape.

    Step G — Sign-in methods card (absorb 05x #6):
    - New `renderSignInMethodsCard()` called from renderSettings()
    - Lists providerData entries as "Google ✓", "Phone +1•••", "Email ✓", "Password ✓/not set"
    - If no password credential: "Set password for faster sign-in" button -> modal with password input -> calls `setUserPassword(password)` -> updatePassword(auth.currentUser, password) -> toast "Password set. You can now sign in with email + password on other devices."
    - If password set: "Change password" + "Remove password" rows
    - Error handling: catches auth/weak-password (show min length hint), auth/requires-recent-login (re-auth prompt)
    - Helpers in js/auth.js (sibling module): `setUserPassword`, `signInWithPassword`, `hasPasswordCredential`

    Step H — Sign-in vs Create-account split (absorb 05x #7):
    - Update sign-in screen in app.html (and landing.html CTAs in this repo): two zones
    - Zone 1: "Welcome back" header + "Sign in" button (opens provider picker with "Sign in with Google / Email / Phone" copy)
    - Zone 2: "New to Couch?" header + "Create an account" button (opens same provider picker with "Create account with Google / Email / Phone" copy)
    - Both call the same Firebase methods; copy is the only differentiator
    - Optional localStorage.qn_last_provider hint below Zone 1: "Last signed in with Google - [Continue]"

    Step I — TDD tests (js/app.test.js or whichever test file exists; if none, create a minimal harness):
    - Test 1: maybeShowFirstRunOnboarding returns without calling showOnboardingStep when state.me.type === 'guest'
    - Test 2: maybeShowFirstRunOnboarding returns without showing when state.me.seenOnboarding === true
    - Test 3: completeOnboarding writes { seenOnboarding: true } to members/{state.me.id}
    - Test 4: legacy self-claim predicate returns true iff state.ownerUid == null && state.me exists && !dismissed
    - Test 5: hasPasswordCredential returns true iff auth.currentUser.providerData includes one with providerId === 'password'

    Commit message: `feat(09-07a): first-run onboarding + legacy self-claim CTA + sign-in methods card`.
  </action>
  <verify>
    <automated>grep -q 'onboarding-overlay' app.html &amp;&amp; grep -q 'maybeShowFirstRunOnboarding' js/app.js &amp;&amp; grep -q 'seenOnboarding' js/app.js &amp;&amp; grep -q 'renderLegacyClaimCtaIfApplicable\|legacyClaim\|ClaimOwnership\|dismissedOwnerClaim' js/app.js &amp;&amp; grep -q 'ownerUid' firestore.rules &amp;&amp; grep -q 'setUserPassword\|hasPasswordCredential\|renderSignInMethodsCard' js/app.js &amp;&amp; node --check js/app.js</automated>
  </verify>
  <done>
    Onboarding DOM + JS + CSS + gate logic ship and pass unit tests.
    Legacy self-claim CTA renders conditionally and writes ownerUid atomically.
    firestore.rules gains a legacy-self-claim branch.
    Sign-in methods card renders providerData and supports setUserPassword.
    Sign-in vs create-account copy split lands on both sign-in screen and landing.
    Commit 1 of 3 landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Authored BRAND.md in .planning/ (DESIGN-10)</name>
  <files>
    .planning/BRAND.md
  </files>
  <behavior>
    - .planning/BRAND.md exists, 150+ lines, ≤1500 words, covers identity / color / typography / spacing+radius+shadow / motion / voice / screen patterns / do-dont gallery
    - References --font-display / --font-serif / --font-sans tokens from plan 09-02
    - Motion section lists the canonical catalog; the audit that rewrites raw ms literals in css/app.css is scoped to 09-07b
  </behavior>
  <action>
    Author .planning/BRAND.md. Structure per research Brand Docs section. Budget: 150+ lines but under 1500 words (brief over verbose).

    Sections with approximate content:

    1. **Identity** — logo rationale + clear-space rules + apple-touch-icon safe-area reminder + regeneration pointer to brand/README.md. Mention that maskable variants shipped in 09-01 with the W3C 40% safe-zone.
    2. **Color tokens** — primitive + semantic tables + WebAIM contrast results (run real checks via webaim.org contrastchecker; record actual ratios for --ink / --ink-warm / --ink-dim / --accent on --bg)
    3. **Typography tokens** — usage matrix table (Fraunces / Instrument Serif / Inter by context from research) + anti-pattern: do not mix Fraunces + Instrument Serif in the same section. Reference the --font-display / --font-serif / --font-sans tokens from 09-02.
    4. **Spacing / radius / shadow** — one-line per token with intended use
    5. **Motion tokens** — the canonical micro-interaction catalog from research table verbatim (toast / modal backdrop / modal sheet / spin / veto shimmer / wp banner pulse / button press / mood chip / who-mini / swipe / hover). Note: the audit that normalizes raw ms literals across css/app.css is scoped to 09-07b.
    6. **Voice guide** — tone quote + 10-15 do/don't copy examples + UI copy rules (no exclamation marks except celebratory; italics for brand voice taglines; sentence-case buttons)
    7. **Screen patterns** — 3-tier layout (hero + tab-sections + modals) with class-name references (.brand-hero-large, .phone-shell, .modal, .wp-live-modal, etc.)
    8. **Do / don't gallery** — 8-10 examples contrasting tasteful token use vs drift. e.g. "DO: padding: var(--space-stack-md); DON'T: padding: 20px" / "DO: .page-tagline class; DON'T: inline font-family:'Instrument Serif'" / "DO: font-family: var(--font-display); DON'T: font-family: 'Fraunces', serif"
    9. **iOS PWA cache-bust procedure** — copied from STATE.md (delete PWA + clear Safari website data + reinstall) with explicit mention it's REQUIRED after icon changes
    10. **Refresh cadence** — when to update this doc; tie to brand/ SVG refreshes

    Commit message: `docs(09-07a): BRAND.md brand-system doc (DESIGN-10)`.
  </action>
  <verify>
    <automated>test -f .planning/BRAND.md &amp;&amp; test $(wc -l &lt; .planning/BRAND.md) -ge 150 &amp;&amp; grep -q 'Identity' .planning/BRAND.md &amp;&amp; grep -q 'Color tokens' .planning/BRAND.md &amp;&amp; grep -q 'Typography' .planning/BRAND.md &amp;&amp; grep -q 'Motion' .planning/BRAND.md &amp;&amp; grep -q 'Voice guide' .planning/BRAND.md &amp;&amp; grep -q 'Do / Don' .planning/BRAND.md</automated>
  </verify>
  <done>
    BRAND.md 150+ lines, under 1500 words, covers all 8 research sections.
    Motion section lists the catalog; 09-07b owns the raw-literal audit.
    Commit 2 of 3 landed.
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: onIntentCreated CF timezone fix (absorbs 08x-intent-cf-timezone)</name>
  <files>
    js/app.js
  </files>
  <behavior>
    - Every NEW intent doc written by the client includes a creatorTimeZone field (IANA tz name or null)
    - sibling CF queuenight/functions/index.js onIntentCreated renders proposedStartAt with timeZone option falling back to UTC
    - Legacy intents (pre-fix) render in UTC (acceptable graceful degrade)
    - No client-side behavior visible to the end user beyond correct push-body time rendering
  </behavior>
  <action>
    Step A — Client side (js/app.js createIntent path):
    - Grep for where intent docs are created. Add a local const at the top of the function:
      ```
      const creatorTimeZone = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || null; } catch (e) { return null; } })();
      ```
    - Include `creatorTimeZone` in the intent payload object that goes to setDoc/addDoc

    Step B — sibling CF (queuenight/functions/index.js around line 365, onIntentCreated):
    - Current:
      ```
      const when = intent.proposedStartAt
        ? new Date(intent.proposedStartAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
        : 'soon';
      ```
    - Replace with:
      ```
      const when = intent.proposedStartAt
        ? new Date(intent.proposedStartAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: intent.creatorTimeZone || 'UTC'
          })
        : 'soon';
      ```
    - No other changes to onIntentCreated.

    Step C — Redeploy sibling CF: `cd queuenight && firebase deploy --only functions:onIntentCreated` (or `--only functions` for full redeploy).

    Step D — Testable manually: propose a `tonight_at_time` intent from a non-UTC browser (e.g. America/New_York). Inspect the new intent doc in Firestore console -> creatorTimeZone field present. Second device receives the push -> body renders local time, not UTC-offset time.

    Commit message: `fix(09-07a): onIntentCreated CF renders tz-aware time body (echoes 07-05 pattern)`.
  </action>
  <verify>
    <automated>grep -q 'creatorTimeZone' js/app.js &amp;&amp; grep -q 'Intl.DateTimeFormat' js/app.js &amp;&amp; node --check js/app.js</automated>
  </verify>
  <done>
    Client writes creatorTimeZone on every new intent doc.
    Sibling CF edit documented in SUMMARY (Claude can't edit the sibling repo, but records the exact patch).
    ~30 min of work completed; mirrors 07-05 fix pattern.
    Commit 3 of 3 landed.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: UAT across onboarding + legacy self-claim + password set + intent tz</name>
  <what-built>
    Three commits landed: (1) first-run onboarding + legacy self-claim + sign-in polish + sign-in-methods card, (2) BRAND.md, (3) intent CF timezone fix. Ready for end-to-end verification. Guest-invite redemption + motion audit come in 09-07b next wave.
  </what-built>
  <how-to-verify>
    Deploy: copy app.html + css/app.css + js/app.js to queuenight/public/, deploy sibling CF (`firebase deploy --only hosting,functions:onIntentCreated,firestore:rules`).

    1. Onboarding first-run (DESIGN-07):
       - Sign in as a NEW user (or clear members/{id}.seenOnboarding via Firestore console on your own member doc to simulate).
       - After sign-in + family load: 3-step onboarding overlay renders.
       - Step 1: "What Couch does" + Skip visible. Tap Skip -> jumps to Tonight.
       - Reload, clear seenOnboarding again. Sign in. Step through all 3: Next -> Next -> Let's go. Lands on Tonight.
       - Settings -> Account -> "Replay intro" button: tap, onboarding resurfaces.

    2. Legacy self-claim (absorbed 05x seed):
       - If you have a legacy family without ownerUid (ZFAM7 was manually patched; use FILMCLUB or create a new legacy doc via Firestore console with no ownerUid): sign in, go to Account settings.
       - Expected: "Claim ownership of this group" CTA visible.
       - Tap -> confirm -> ownerUid written + CTA disappears + Group admin section now renders.
       - Second member on same family: no CTA visible anymore.

    3. Set password (absorbed 05x #6):
       - Sign in via email link on a fresh account.
       - One-time banner: "Set a password so you can sign in faster from other devices" -> Set password -> enter password -> toast "Password set".
       - Sign out. On a different device/incognito, sign in via email + password directly. Expected: lands on Tonight without tapping a magic link.

    4. Sign-in vs create-account split (absorbed 05x #7):
       - Fresh incognito on landing page (from plan 09-05). Two zones visible: "Welcome back" + "New to Couch?" with separate CTAs.
       - Sign-in screen on /app: same two zones.
       - Both CTAs reach the provider picker (relabeled copy per zone).

    5. BRAND.md exists (DESIGN-10):
       - `ls .planning/BRAND.md` — exists.
       - Skim: Identity + Color + Typography + Spacing + Motion + Voice + Screen patterns + Do/don't sections all present.

    6. Intent timezone fix (absorbed 08x):
       - Propose a tonight_at_time intent from the dev family. Observe Firestore console -> intent doc has creatorTimeZone: "America/New_York" (or your tz).
       - Second device (authenticated as another member) receives push notification. Body reads the correct LOCAL time (e.g. "9:00 PM"), not UTC-offset.

    7. Regression gate — existing Phase 3/4/5/7/8 surfaces unchanged:
       - Walk through: Tonight spin, mood filter, veto pre/post-spin, watchparty start + join + reactions, intent create + RSVP. Nothing visibly broken.
  </how-to-verify>
  <resume-signal>
    Type "approved" if all 7 verification tracks pass. Type "onboarding <n> broken" / "legacy claim blocked" / "password set fails" / "intent tz still wrong" / "BRAND.md missing <section>" for specific failures. Claude investigates and repairs.
  </resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Legacy self-claim write from client -> families/{fid}.ownerUid | Rules branch permits only-if-missing + only-own-uid |
| updatePassword(auth.currentUser, pw) | Firebase SDK auth-client call |
| CF render of proposedStartAt -> push body -> user device | Server-rendered time string in notification payload |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-07a-01 | Tampering | Legacy self-claim writes fields other than ownerUid | mitigate | firestore.rules branch: `request.resource.data.diff(resource.data).affectedKeys().hasOnly(['ownerUid'])`. Enforces exact field scope. |
| T-09-07a-02 | Tampering | Legacy self-claim writes someone else's uid as ownerUid | mitigate | Rule clause: `request.resource.data.ownerUid == request.auth.uid`. Caller can only stamp their own uid. |
| T-09-07a-03 | Repudiation | Owner claims they never set a password but a password is in place | accept | Firebase auth logs updatePassword calls. Attribution is in Firebase Auth dashboard. |
| T-09-07a-04 | Denial of Service | maybeShowFirstRunOnboarding fires for guests, breaks the redeem-to-Tonight flow (Pitfall 5) | mitigate | Explicit client guard + test: `if (state.me.type === 'guest') return;`. 09-07b additionally sets seenOnboarding:true on guest member creation for double defense. |
| T-09-07a-05 | Information Disclosure | BRAND.md leaks internal design rationale | accept | Rationale: `.planning/` is committed to the public repo by design. No secrets. |
| T-09-07a-06 | Denial of Service | onIntentCreated CF crashes if intent.creatorTimeZone is an invalid IANA name | mitigate | `|| 'UTC'` fallback handles null/undefined. toLocaleTimeString with invalid timeZone throws RangeError -> CF silently drops that push. Acceptable graceful degrade per seed. Optionally wrap in try/catch. |

</threat_model>

<verification>
End-of-plan checks:
- `grep -q 'onboarding-overlay' app.html && grep -q 'maybeShowFirstRunOnboarding' js/app.js` passes
- `grep -q 'ownerUid' firestore.rules` passes (self-claim branch present)
- `grep -q 'renderSignInMethodsCard' js/app.js && grep -q 'setUserPassword' js/app.js` passes
- `grep -q 'creatorTimeZone' js/app.js` passes
- `test -f .planning/BRAND.md && test $(wc -l < .planning/BRAND.md) -ge 150` passes
- `node --check js/app.js` passes
- Task 4 user UAT approves all 7 tracks.
</verification>

<success_criteria>
DESIGN-07 closes — "First-run onboarding polished + introduces feature surfaces tastefully":
- ✓ 3-step onboarding + hard skip + seenOnboarding persistence.

DESIGN-10 closes — "Brand-system documentation captured in .planning/":
- ✓ BRAND.md 150+ lines / ≤1500 words / 8 sections complete.

Absorbed seeds: 05x-account-linking #6 (set-password) + #7 (signin-vs-create split), 05x-legacy-family-ownership-migration (self-claim CTA + rules branch), 08x-intent-cf-timezone (onIntentCreated tz fix). Shipped in-brand from the start rather than retrofitted.

(DESIGN-08 guest-invite redemption + DESIGN-09 motion audit close in 09-07b.)
</success_criteria>

<risk_notes>
- **No bundler:** all edits ship to single-file app.html + css/app.css + js/app.js. No compile step.
- **Two-repo sync (explicit):** onIntentCreated tz fix lives in sibling queuenight/functions/. Task 3 explicitly calls out sibling-repo deploy via `firebase deploy --only functions:onIntentCreated`. firestore.rules in THIS repo gets the legacy self-claim branch; deploy via `firebase deploy --only firestore:rules` (requires sibling firebase config).
- **iOS PWA primary surface:** onboarding overlay renders at viewport level. Tested in Task 4 on physical iOS for the user's approval.
- **Dynamic className logic preserved + extended:** new screens (#onboarding-overlay) follow the same `style="display:none"` initial + JS .style.display toggle pattern used by existing screens. Plan 09-03's Pitfall 2 defense remains intact: no attempt to replace .style.display with .is-hidden.
- **Plan 09-04 responsive layer benefits:** onboarding overlay renders well at desktop viewport because .phone-shell wrap from 09-04 caps it sensibly. Illustrations sit inside the phone-shell column.
- **Plan 09-03 token-backed classes used:** .page-tagline, .brand-hero-small, .signin-card, .cluster, .stack all used directly in new DOM to avoid inline-style regression.
- **Plan 09-02 font-family tokens referenced:** new rules in css/app.css for .onboarding-step / .sign-in-methods-card use --font-display / --font-serif / --font-sans rather than repeating typeface strings.
- **Pitfall 5 defense** (guest hitting onboarding): client guards here; 09-07b adds the CF-side guarantee of seenOnboarding:true at guest creation. Both enforce.
- **Pitfall 1 note in BRAND.md:** iOS PWA icon cache-bust procedure documented in BRAND.md per STATE.md environment note.
- **Password flow is v1-scope:** 05x-account-linking items #1-5 (provider linking proper — Phone-to-Google, etc.) remain out of scope. Only items #6 + #7 absorbed because they're pure-copy or simple-updatePassword additions. Link/unlink flows stay Phase 5.x standalone.
- **Apple Sign-in seed deferred:** phase-05x-apple-signin.md remains out of scope. $99/yr dev account + external config — not brand-polish work.
- **Phase 7 watchparty lifecycle seed deferred:** phase-07-watchparty-lifecycle-transitions.md stays standalone — backend/behavioral work, not brand polish.
- **Motion audit NOT in this plan (split to 09-07b):** Per Blocker-3 / Issue-4 checker closure. 09-07a ships stable brand-facing polish; 09-07b ships the more-surface-area guest-invite redemption + motion audit together. This keeps bisect scope tight if either surface surfaces a regression.
- **Checkpoint gates deploy:** Task 4 is checkpoint:human-verify. 7 verification tracks cover everything this plan touches; no silent regressions slip past.
- **BRAND.md is the v1 canonical reference:** Phase 10 YIR's shareable surfaces will render against these tokens + voice. BRAND.md is the artifact other phases now depend on.
</risk_notes>

<output>
After completion, create `.planning/phases/09-redesign-brand-marketing-surface/09-07a-SUMMARY.md`
</output>
