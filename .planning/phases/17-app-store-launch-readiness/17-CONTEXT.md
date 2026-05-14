---
phase: 17-app-store-launch-readiness
gathered: 2026-05-06 (autonomous pre-stage during launch-prep) + 2026-05-14 (auto discuss-phase chain)
status: discussed_ready_for_planning
mode: pre-staged 2026-05-06; auto-discussed 2026-05-14 — D-28..D-40 added, 9 open questions resolved, new findings folded
source_doc: .planning/LAUNCH-REVIEW-2026-05-05.md
sibling_artifacts:
  - .planning/spikes/001-capacitor-vs-pwabuilder/README.md (PWABuilder verdict)
  - .planning/PRIVACY-TERMS-AUDIT-2026-05-06.md (privacy/ToS gap)
  - .planning/APP-STORE-ASSETS-AUDIT-2026-05-06.md (icon + screenshot matrix)
  - .planning/phases/31-marketing-refresh/31-CONTEXT.md (Phase 31 dependency)
---

# Phase 17: App Store Launch Readiness — Context

**Gathered:** 2026-05-06 (autonomous pre-stage)
**Status:** Scoped, awaiting formal `/gsd-discuss-phase 17` chain
**Source-of-truth:** `.planning/LAUNCH-REVIEW-2026-05-05.md` (positioning + sequencing)

> **2026-05-07 update:** Substantial autonomous launch-prep work landed during the wait for Apple Developer activation. See supplemental docs in this directory before /gsd-discuss-phase 17:
> - `17-PWABUILDER-FINDINGS-2026-05-07.md` — 4 production bugs caught + fixed via PWABuilder dry-run; iOS Info.plist Xcode-time checklist; Android keystore handling
> - `17-PLAY-CONSOLE-PREP.md` — copy-paste-ready Play Store listing + Data Safety form + Content Rating answers
> - `17-APP-STORE-CONNECT-PREP.md` — copy-paste-ready App Store name/subtitle/description/keywords + App Privacy Nutrition Labels + App Reviewer notes
> - `17-DEVICE-VERIFICATION-FINDINGS-2026-05-07.md` — Apple pending-after-payment + Google Play hard device-verification gates (Bark Phone Device Owner block documented)
> - `PrivacyInfo.xcprivacy` — Apple's required machine-readable privacy declaration; drop into Xcode at `Couch Tonight/PrivacyInfo.xcprivacy`
> - `apple-app-site-association.template.json` — Universal Links template; fill in Team ID + Bundle ID at Wave 1, then deploy to `couch/.well-known/apple-app-site-association`
>
> Production: `privacy.html`, `terms.html`, `manifest.json`, `.well-known/assetlinks.json` all live at couchtonight.app. PWABuilder-generated iOS + Android packages downloaded + inspected (`~/Downloads/Couch Tonight.zip`, `~/Downloads/Couch - Google Play package.zip`).
>
> Folds 8 new D-decisions (D-28..D-35) into the next /gsd-discuss-phase 17 chain — tracked individually in the supplements.

<domain>
## Phase Boundary

Wrap the existing `couchtonight.app` PWA into iOS App Store + Google Play submissions. Reactivated 2026-05-05 after being deferred 2026-04-29. Sequenced AFTER Phase 31 (Marketing refresh) per LAUNCH-REVIEW §6 — Phase 17 consumes Phase 31's screenshots, og.png, refreshed copy.

**Target window:** TestFlight + Play Internal early June 2026; submission mid-June; public launch late June / early July 2026. Runway: ~3-4 weeks from kickoff.

**In scope:**
1. **Apple Developer Program enrollment** ($99/yr; 1-2 day verification window). Start before everything else.
2. **Google Play Console enrollment** ($25 one-time).
3. **Native wrapper packaging via PWABuilder** (per spike 001). Generates Xcode + Android Studio projects from `couchtonight.app` PWA URL.
4. **Apple Sign-In implementation** via Firebase Auth Apple provider. Gated by §4.8 since Couch ships Google Sign-In (see CONTEXT D-02 for §4.8 nuance).
5. **App Store Connect listing** per LAUNCH-REVIEW §5: name, subtitle, promo text, description, keywords, category, age rating, App Privacy Nutrition Labels.
6. **Google Play Console listing**: name, short/full description, screenshots, feature graphic, Data Safety form.
7. **Privacy policy authoring** at `/privacy.html` (~3-5 hrs).
8. **Terms of Service authoring** at `/terms.html` (~3-5 hrs).
9. **Privacy Manifest** (`PrivacyInfo.xcprivacy`) — Apple's machine-readable privacy declaration, required since 2024-Q1.
10. **App Store screenshot capture** — device-class matrix (iPhone 6.9", 6.7", 6.5", 5.5"; iPad-13" optional).
11. **App Preview video** — 15-30s walkthrough; .mov/.mp4; matches screenshot dimensions.
12. **App icon set generation** — Apple's full size matrix from canonical SVG (Phase 15.3 dependency, see D-08).
13. **Adaptive icons for Android** — 432×432 foreground + background.
14. **Feature graphic for Play** — 1024×500.
15. **TestFlight beta** (Apple, 10K external testers cap).
16. **Play Internal Testing track** (Google).
17. **App Review submission** + iteration loop until approval (Apple: 1-3 days median; Google: 1-7 days).
18. **Phased rollout** (Apple Phased Release + Google Staged Rollout — both default 7-day 1%→100%).

**Out of scope:**
- Capacitor migration (escalation option per spike 001, NOT v1 plan)
- iPad-specific UI layouts (PWABuilder will use the iPhone layout in iPad-compatibility mode; native iPad redesign deferred to post-launch)
- Localization beyond en-US (defer to post-launch per LAUNCH-REVIEW §9)
- Custom EULA (use Apple's standard EULA + custom clauses inline; full custom EULA is overkill for v1)
- Apple Watch companion app
- App Clip variants (instant-app feature)
- Marketing-channel strategy (Product Hunt, Twitter/X, Reddit)
- Beta-tester recruiting strategy (TestFlight URL distribution)
- Affiliate hooks (Phase 30.1 — explicitly out of scope per CLAUDE.md no-monetization rule)

</domain>

<decisions>
## Implementation Decisions

### Wrapper choice (locked via spike 001)
- **D-01:** Native wrapper = **PWABuilder** for v1. Capacitor is the v2 escalation option (triggered if iOS push delivery <85% over 30 days OR App Review §4.2 reject). See `.planning/spikes/001-capacitor-vs-pwabuilder/README.md` for the 13-dimension decision matrix and switch triggers.

### Apple §4.8 — Sign in with Apple requirement
- **D-02:** Apple Sign-In MUST be implemented. Couch ships Google Sign-In + Email-link + Phone today. §4.8 (verified 2026-05-06 from official guidelines) requires "another login service" meeting 3 criteria when ANY third-party social login is offered. Email-link MAY satisfy the 3 criteria (limited to email; user controls email; no ad tracking) but Apple Sign-In is the canonical safe answer that App Reviewers don't second-guess. Implementation: Firebase Auth Apple provider in webview (~1 day per spike 001). DO NOT remove Google Sign-In — it's an existing user-flow. Add Apple Sign-In as an additional provider.

### App Store name (per LAUNCH-REVIEW)
- **D-03:** App Store name = **"Couch Tonight"** (NOT "Couch" alone). ASO collision with furniture apps + Couchsurfing argues for the longer string. Domain `couchtonight.app` and existing OG `alternateName: "Couch Tonight"` already imply this. In-app wordmark stays "Couch" (BRAND.md unchanged).
- **D-04:** App Store subtitle (30 char limit Apple): *"Pick & watch together"* OR *"Movie night, decided."* — final choice at planning time based on ASO keyword research.

### Phase 31 dependency
- **D-05:** Phase 31 (Marketing refresh) MUST complete before Phase 17 Wave 3 (asset packaging). Phase 17 consumes Phase 31's:
  - 5 PWA screenshots at 1170×2532 (used as source for App Store screenshot downscaling)
  - Refreshed og.png (used as feature-graphic basis)
  - Refreshed landing.html copy (used as App Store description voice baseline)
  - Refreshed audience grid (Family/Crew/Duo) — informs App Store description audience callouts
- **D-06:** Phase 31's screenshots are 1170×2532; Apple wants 1320×2868 for iPhone 16 Pro Max + 1290×2796 for 15 Pro Max + 1242×2688 for XS Max + 1242×2208 for 8 Plus. Capture pass for Phase 17 = highest-resolution capture (1320×2868) once + sharp downscaling for the rest. Saves ~3 hours vs. capturing on each device. Decision: do this via sharp pipeline same as Phase 31 / Plan 31-02 pattern.

### Apple Developer Program enrollment (Wave 0 blocker)
- **D-07:** Apple Developer Program enrollment is a Wave 0 task — start the moment Phase 17 plan-phase fires. 1-2 day verification window. Without this, no TestFlight upload possible. Same for Google Play Console enrollment ($25 one-time, faster verification).
- **D-08:** Apple Developer Program account = same Apple ID as the user's iCloud (no shared developer account needed for v1). Cost: $99/yr personal account, OR $299/yr organization (only if launching as LLC; defer to user — likely $99/yr personal for v1).

### Phase 15.3 (PNG masters + sharp pipeline) — HARD DEPENDENCY
- **D-09:** Phase 15.3 was originally deferred per LAUNCH-REVIEW §6 P2 and originally scoped as "canonical SVG." **REVISED 2026-05-06:** brand identity refresh adopted a photorealistic leather-cushion wordmark which can't be vectorized without losing texture, so Phase 15.3 pivoted to PNG masters + sharp downscale pipeline. **PROMOTED from soft-dependency to hard-dependency:** Phase 15.3 must complete before Phase 17 Wave 2 (icon-set deployment to Xcode/Android Studio projects). Specifically Phase 15.3 produces: `brand/logo-master.png` (3000×1500 wordmark), `brand/mark-master.png` (1024×1024 SQUARE — leather-cushion C with glowing TV nested in C's opening; canonical brand-storytelling icon depicting a couch facing a TV; NO baked-in rounded corners — iOS/Android apply their own corner masks at render time), `brand/notification-mark.png` (96×96 flat-white C silhouette only — no TV at notification scale; Android can't render color/texture), `scripts/regenerate-icons.sh` (sharp pipeline). Phase 17 consumes the generated `mark-{16..1024}.png` set + `logo-h{300,200,100}.png` + `favicon.ico` + maskable variants. ~3 plans, ~2 days execution once masters exist. Sharp-upscale-from-existing-PNG fallback is no longer relevant (existing PNGs are the OLD identity).

### Privacy + ToS authoring (P0 blockers)
- **D-10:** `privacy.html` and `terms.html` MUST be authored before submission. Source repo doesn't have them; deploy mirror status unverified but treat as missing. Privacy policy enumerates Firebase + TMDB + Trakt + Sentry + Google + Apple + push providers. ToS includes Apple-required + Google-required clauses, DMCA + content takedown, acceptable-use, geographic limitations. See `.planning/PRIVACY-TERMS-AUDIT-2026-05-06.md` §"Phase 17 work items implied" for the full enumeration list.
- **D-11:** Apple Privacy Manifest (`PrivacyInfo.xcprivacy`) — XML file shipped in iOS bundle; required since 2024-Q1. Authored from same data-collection survey as privacy.html. PWABuilder may auto-generate a stub — verify and extend at planning time.
- **D-12:** Google Play Data Safety Form — web form in Play Console; same content surface as Apple's Nutrition Labels but separate authoring. Treat as parallel work to Apple Nutrition Labels.

### Pick'em on App Store (§5.3.4 risk assessment)
- **D-13:** Pick'em (Phase 28 — shipped) is FREE — no real-money gaming, no purchases, no in-app betting. §5.3.4 governs "real money gaming" only. Pick'em with no money + no purchases = NOT subject to §5.3.4. Verified 2026-05-06: §5.3.4 wording explicitly references "real money gaming (e.g. sports betting, poker, casino games, horse racing) or lotteries" + "must be free on the App Store" + "must have necessary licensing." Couch's free leaderboard-pick'em fits "Sweepstakes and contests" (§5.3.1) — no licensing required since no consideration is exchanged. App Store description should NOT use language like "betting" / "wagering" / "winning" — use "predict winners," "earn points," "leaderboard."
- **D-14:** Pick'em screenshot inclusion in App Store listing: YES per Phase 31 / D-25 + LAUNCH-REVIEW §5. Showcases category-unique feature.

### App Review §4.2 mitigation
- **D-15:** §4.2 ("Minimum Functionality") risk assessment: Couch is NOT a "repackaged website" — Watchparty + Couch Groups + Pick'em + Decision Explanation + Wait Up are all category-unique interactive surfaces. App Store description SHOULD lead with these per LAUNCH-REVIEW §5 (4-beat hierarchy: Decide → Watch together → Remember → Make it a competition). Mitigation strategy: every screenshot demonstrates an interactive surface (NOT static catalog browsing).
- **D-16:** §4.2 fallback plan: if App Review cites §4.2 once, address with description rewrite emphasizing native-feel features. If cited twice, escalate to Capacitor (per spike 001 switch trigger 2). Don't accept §4.2 cite quietly — every PWA-wrapper App Review interaction is a precedent.

### Native build pipeline
- **D-17:** PWABuilder generates Xcode + Android Studio projects. Build flow:
  - Step 1: Generate via PWABuilder web UI (or CLI if available) using `https://couchtonight.app` URL.
  - Step 2: Open generated Xcode project, configure code-signing (Apple Developer account), wire Apple Sign-In capability.
  - Step 3: Open generated Android Studio project, configure signing keystore, wire adaptive-icon assets.
  - Step 4: TestFlight upload (Xcode → Archive → Distribute) + Play Internal upload (Bundle → Play Console).
- **D-18:** PWABuilder version pinning: use latest stable (semver-tracked) at Phase 17 kickoff. Document the exact version in 17-PLAN.md so re-builds for v1.x updates use the same generator.
- **D-19:** Code-signing: Apple cert via Xcode auto-managed signing (simplest path). Google: generate keystore at Phase 17 kickoff, store secret in 1Password (NOT in repo).

### TestFlight + Play Internal beta
- **D-20:** TestFlight beta period: **5-7 days minimum** before App Review submission. Recruit 10-20 testers from family + close friends. Distribute via TestFlight invite URL (one-tap install).
- **D-21:** Play Internal Testing: parallel to TestFlight; 5-day beta period; 100-tester cap (vs Play Closed Testing 1000+).
- **D-22:** Beta feedback channel: TestFlight's built-in screenshot+text feedback OR a dedicated email alias `beta@couchtonight.app` (decision deferred to planning time).
- **D-23:** Beta-blocking issue criteria: any P0 from `UAT-RUNBOOK-2026-05-06.md` Wave A/B/C must pass on real devices BEFORE TestFlight ships. Wave D + E may slip per UAT-RUNBOOK.

### App Review submission strategy
- **D-24:** First submission: **Phased Release** enabled (Apple) + **Staged Rollout** at 1% (Google). Catches review-blockers before mass exposure.
- **D-25:** Apple App Review reviewer demo account: create dedicated account `apple-review@couchtonight.app` with pre-populated test family; document credentials in App Store Connect "Notes for Reviewer" field.
- **D-26:** Notes for Reviewer (Apple) MUST include:
  - Demo account credentials
  - "How to spin up a watchparty" (3-step walkthrough)
  - "How to test Pick'em" (note that picks lock at game-start; reviewer may need a live game window OR can verify the pre-lock UI without scoring)
  - "Family code is `xxxxxx` (test family)" — pre-populated roster
  - PWA-wrapper acknowledgement: "This app is built using PWABuilder; the core experience runs in the iOS WKWebView. The app meets §4.2 minimum-functionality through interactive surfaces (Watchparty, Couch Groups, Pick'em)."

### Sentry production telemetry post-launch
- **D-27:** Post-launch, monitor Sentry breadcrumbs for the 30-day switch-trigger evaluation per spike 001:
  - iOS push delivery rate (target ≥85%)
  - App-foreground crashes (target <0.1% of sessions)
  - §4.2-related App Review interactions (track via App Store Connect notification logs)
  - Apple Sign-In success rate (vs. abandoned auth attempts)

### Claude's Discretion (open at planning time)
- Whether to ship iPad support in v1 or defer to post-launch (PWABuilder generates iPad-compatible build by default; iPad-optimized layouts are separate work)
- App Preview video content + length (15s "spin" walkthrough vs 30s "full ritual" walkthrough)
- TestFlight tester recruitment cadence (closed family-only beta vs open-invite via Twitter)
- Apple ID for developer account (personal vs LLC) — depends on user's tax + liability preference
- Whether to author a custom EULA or use Apple's standard EULA + custom clauses inline (Apple's standard EULA is acceptable for v1)
- App Preview video soundtrack (silent + captions vs background music — captions only is safer for App Review)
- Whether the Apple Sign-In button placement matches Google Sign-In's position on the signin screen, OR follows Apple's Human Interface Guidelines (placement-above-Google) — likely the latter
- ASO keyword strategy: which 100-char Apple keyword field gets which terms (movie night, family, watch together, picker, what to watch, streaming, household, pickem are starting candidates; trim to fit)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source-of-truth for launch positioning
- `.planning/LAUNCH-REVIEW-2026-05-05.md` — full review with corrections log, file-specific fixes, sequencing
- `.planning/CROSS-AI-BRIEF-2026-05-05.md` — second-opinion brief (used for cross-AI feedback)

### Sibling artifacts (Phase 17 dependencies)
- `.planning/spikes/001-capacitor-vs-pwabuilder/README.md` — wrapper choice + switch triggers
- `.planning/PRIVACY-TERMS-AUDIT-2026-05-06.md` — privacy/ToS authoring scope
- `.planning/APP-STORE-ASSETS-AUDIT-2026-05-06.md` — icon + screenshot matrix
- `.planning/UAT-RUNBOOK-2026-05-06.md` — pre-submission UAT plan (Phase 17 inherits)
- `.planning/phases/31-marketing-refresh/31-CONTEXT.md` — Phase 31 dependency
- `.planning/BRAND.md` — voice rules + design tokens (App Store description copy must respect)

### Apple references
- https://developer.apple.com/app-store/review/guidelines/ — App Review Guidelines (verified §4.8 + §4.7 + §4.2 + §5.3.4 wording on 2026-05-06)
- https://developer.apple.com/sign-in-with-apple/ — Apple Sign-In integration
- https://developer.apple.com/app-store-connect/ — App Store Connect docs
- https://developer.apple.com/documentation/bundleresources/privacy_manifest_files — Privacy Manifest spec
- https://firebase.google.com/docs/auth/web/apple — Firebase Auth Apple provider integration
- https://docs.pwabuilder.com/#/builder/app-store — PWABuilder iOS submission guide

### Google references
- https://play.google.com/console/ — Play Console
- https://support.google.com/googleplay/android-developer/answer/13327826 — Data Safety Form spec
- https://developer.android.com/distribute/play-policies — Play policies
- https://docs.pwabuilder.com/#/builder/android — PWABuilder Android submission guide

### Existing project artifacts (read before planning)
- `CLAUDE.md` — no bundlers, no monetization, deploy ritual
- `app.html` — PWA shell (signin section + manifest)
- `landing.html` — current marketing front door
- `sw.js` — service-worker cache (currently `couch-v47-pickem`; will be `couch-v48-marketing-refresh` post Phase 31)
- `js/firebase.js` — Firebase Auth init (extend with Apple provider)
- `scripts/deploy.sh` — deploy ritual (Phase 31 / Plan 31-04 extends mirror loop)

</canonical_refs>

<code_context>
## Existing Code Insights (for Phase 17 planner)

### Reusable Assets
- **Firebase Auth init** (`js/firebase.js`) — extends with `OAuthProvider('apple.com')` + `signInWithRedirect` for Apple. Pattern matches existing GoogleAuthProvider wiring.
- **Phase 27 Guest RSVP** — first non-app-shell PWA route (`/rsvp/<token>`). Establishes pattern for non-app pages (privacy.html / terms.html follow same hosting convention).
- **landing.html OG metadata pattern** — privacy.html + terms.html should mirror this for social-share linkability.
- **`sw.js` cache-bumping** — Phase 17's deploy uses same `bash scripts/deploy.sh <tag>` ritual. Cache target: `couch-v49-app-store-launch` (or similar; planner picks).
- **deploy.sh mirror loop extension** — Phase 31 / Plan 31-04 already extends to cover `marketing/` + `brand/`. Phase 17 inherits.

### Established Patterns
- **Single-file HTML (no bundler)** — privacy.html + terms.html are vanilla HTML. PWABuilder's wrapper packages the live PWA URL, so privacy/terms get bundled implicitly.
- **Restraint-first design** — App Store description copy follows BRAND.md voice rules: loud about behaviors, restrained about feelings.
- **Sentry breadcrumb-driven analytics** — Phase 31 / D-27 establishes the marketing-instrumentation pattern. Phase 17 extends with App-Store-specific events: `signin.apple.success`, `signin.apple.abandon`, `app.foreground`, etc.

### Integration Points
- **Phase 31 → Phase 17:** Phase 31 ships before Phase 17. Phase 17 consumes Phase 31's screenshots + og.png + refreshed copy.
- **Phase 15.3 → Phase 17:** OPTIONAL soft-dependency. If Phase 15.3 ships first, asset generation is clean; if not, sharp upscaling from `mark-512.png` is the fallback (lossy, reviewer-acceptable).
- **UAT-RUNBOOK → Phase 17:** Wave A/B/C UATs MUST pass before TestFlight ships (D-23). Wave D + E may slip with code-level acceptance per Phase 15.4 / 15.5 precedent.

</code_context>

<specifics>
## Specific Ideas

- **Visual reference for App Preview video:** restraint-first cinematic. 15s vertical-mode walkthrough. Open on couch viz with avatars filling in (Phase 14 V5 surface), tap spin, reveal Tonight's pick, fade to watchparty live with Wait Up reaction, fade to Pick'em leaderboard with score celebration. No voiceover; rely on captions. Music: warm acoustic, low energy (matches BRAND.md "Warm · Cinematic · Lived-in").
- **App Store description voice:** factual not hyperbolic. "Decide what to watch in 30 seconds. Watch together when you can't be in the same room. Free, no ads." NOT "Brings families closer through the magic of shared cinema."
- **Reviewer Notes paragraph (Apple):** treat as the single most important PR piece. App Reviewers read it carefully. Lead with the "why this is an app" justification: "Couch is a 28-phase product (28 weeks of development) that combines decision, watch-together, memory, and sport surfaces. It is NOT a wrapped website. The PWA wrapper is the deployment vehicle; the experience is rich enough to fill an interactive native app."
- **Risk: PWABuilder's webview default may not handle Apple Sign-In's privacy-relay-email flow correctly on first try.** Test thoroughly in TestFlight before submission. Firebase Auth Apple provider is the recommended path (Tinder Lite, Adobe Photoshop Web both use this combination successfully).

</specifics>

<deferred>
## Deferred Ideas

These came up during scoping but belong to other phases / post-launch.

### Post-launch (signal-driven)
- iPad-optimized layouts (PWABuilder iPad-compat works but doesn't use iPad screen real estate well)
- Apple Watch companion (would require Capacitor + native Swift)
- Localization (en-US only for v1; Spanish + French candidates if usage signal supports)
- App Clip variants
- Custom Apple TV app (separate from iOS)
- Carplay integration (would require Capacitor)

### Phase 30.1 (post-launch monetization)
- Affiliate hooks for streaming services (where-to-stream links with affiliate IDs) — explicit carve-out per CLAUDE.md "no monetization" rule until v2

### Phase 16 (Calendar Layer)
- Recurring watchparty scheduling — deferred per cross-AI 2026-04-28; revisit if usage signal supports

### Phase 17.x (escalation paths)
- Capacitor migration (triggered by spike 001 switch criteria: iOS push <85% over 30 days OR §4.2 reject twice)
- iOS push fidelity tuning (if VAPID web-push delivery rate falls below threshold)

</deferred>

## Success Criteria (what must be TRUE at /gsd-verify-work 17)

1. App Store Connect listing live with name "Couch Tonight," subtitle, promo text, description, keywords, category, age rating, App Privacy Nutrition Labels.
2. Google Play Console listing live with name, descriptions, screenshots, feature graphic, Data Safety Form.
3. `privacy.html` + `terms.html` deployed at `https://couchtonight.app/privacy.html` and `/terms.html` (or the bare `/privacy` + `/terms` rewrites) — content enumerates all data flows.
4. Apple Sign-In wired via Firebase Auth + visible on signin screen above Google Sign-In (per Apple HIG).
5. Privacy Manifest (`PrivacyInfo.xcprivacy`) shipped in iOS bundle.
6. iOS app passes App Review (status: "Ready for Sale") with Phased Release enabled.
7. Android app passes Google Review (status: "Production - Available") with Staged Rollout at 1% → 100% over 7 days.
8. TestFlight build distributed to 10-20 external testers; at least 5 days of beta feedback collected without P0 issues.
9. Play Internal Testing track build distributed to family + close-friend testers in parallel.
10. UAT-RUNBOOK Wave A + B + C complete on real devices (Wave D + E may slip with code-level acceptance per Phase 15.4 / 15.5 precedent).
11. App Store name decision locked: "Couch Tonight" (or alternative if user overrides).
12. Sentry telemetry baseline captured for the 30-day switch-trigger evaluation per spike 001.
13. App Preview video deployed to App Store Connect.
14. App icon set generated for all required sizes (Apple matrix + Google adaptive icon).
15. Apple Sign-In success rate ≥ 95% in TestFlight (any blocker fixed before submission).

## Suggested Plan Count

**~8 plans across 4 waves.** Estimated runway: 3-4 weeks.

- **Wave 0 (parallel — start immediately):**
  - 17-01: Apple Developer Program + Google Play Console enrollment (1-2 days verification, blocks subsequent waves)
  - 17-02: Author privacy.html + terms.html + Privacy Manifest + Data Safety Form copy (3-5 days)
- **Wave 1 (depends on 17-01):**
  - 17-03: Apple Sign-In via Firebase Auth — wire signin screen + test in dev (1-2 days)
  - 17-04: PWABuilder generation — Xcode + Android Studio projects produced (1 day)
  - 17-05: Asset generation — Apple icon matrix + Android adaptive icons + feature graphic (2-3 days; parallel-able with 17-03)
- **Wave 2 (depends on 17-04 + 17-05):**
  - 17-06: App Store screenshot capture — multi-device dimensions via sharp pipeline (2 days)
  - 17-07: App Preview video capture + edit (1-2 days)
- **Wave 3 (depends on Wave 2):**
  - 17-08: TestFlight + Play Internal upload + 5-7 day beta + App Review submission + Phased Release configuration (1 week beta + 1-3 days Apple review + 1-7 days Google review)

## ~~Open questions for `/gsd-discuss-phase 17`~~ — RESOLVED 2026-05-14

All 9 questions auto-resolved in the 2026-05-14 `/gsd-discuss-phase 17 --auto` chain. See D-28..D-36 below.

---

## 2026-05-14 Discussion Update (auto-discuss-phase chain)

> Resolves 9 open questions + folds 4 new findings discovered since 2026-05-06 pre-stage:
> Phase 31 shipped (D-39), auth back/forward hotfix deployed (D-37), nav-affordance UX gap surfaced (D-38),
> Apple Developer enrollment complete + App Store Connect ~85% filled per .continue-here.md (referenced).

### Resolved open-questions

- **D-28** (was Q1, iPad support): **Defer to post-launch.** PWABuilder iPad-compat mode uses the iPhone layout in iPad-compatibility — adequate for v1. Native iPad redesign is a v2 candidate per LAUNCH-REVIEW §9. Rationale: scope discipline; iPad-specific UX is multi-week separate work.
- **D-29** (was Q2, App Preview video): **15s "spin walkthrough"**, captions only, no voiceover. Content (per `<specifics>` line 224): open on couch viz with avatars → tap spin → reveal Tonight's pick → fade to watchparty live with Wait Up reaction → fade to Pick'em leaderboard. Warm acoustic music, low energy (matches BRAND.md "Warm · Cinematic · Lived-in"). Rationale: 15s is the App Store cap for autoplay; captions-only is App-Review-safe and avoids voiceover localization debt.
- **D-30** (was Q3, Apple Developer account type): **Personal $99/yr** — CONFIRMED already enrolled per `.continue-here.md` (Apple Team ID `49R296FJGF`, paid 2026-05-06, activated 2026-05-07). Rationale: LLC formation not on the v1 critical path; personal account converts to organization later if needed.
- **D-31** (was Q4, EULA): **Apple's standard EULA + custom clauses inline.** Custom clauses (DMCA, content takedown, acceptable-use, geographic limitations) live inline in `terms.html`. Rationale: full custom EULA is overkill for v1; standard EULA is the default App Store choice that reviewers expect.
- **D-32** (was Q5, ASO keywords): **Defer final 100-char string to App Store Connect "Add for Review" time.** Starting candidate list (per `<decisions>` line 153): `movie night, family, watch together, picker, what to watch, streaming, household, pickem`. Trim to fit 100ch during the screenshot+keyword upload session (Wave 2). Rationale: ASO research is most accurate against current App Store competitor landscape at submission time, not 3 weeks earlier.
- **D-33** (was Q6, App Store name): **"Couch Tonight"** — LOCKED per D-03 + `.continue-here.md` "App Information section: Name = Couch Tonight reserved in App Store Connect 2026-05-06". Rationale: already saved in ASC; ASO collision avoidance with furniture apps is the original reason and still holds.
- **D-34** (was Q7, Phase 15.3 promotion): **Promoted to hard dependency 2026-05-06 per D-09** — Phase 15.3 SHIPPED (per `js/firebase.js` icon refs + brand/mark-master.png deployed). Phase 17 Wave 2 (asset packaging) consumes the deployed icon set. No sharp-upscale fallback needed. Rationale: brand identity refresh adopted photorealistic leather wordmark that needed PNG masters; Phase 15.3 pivot delivered.
- **D-35** (was Q8, Beta-tester recruiting): **Closed family-only first** — 10-20 testers from family + close friends per D-20. Open-invite via Twitter/X is post-launch growth motion, not v1 beta. Rationale: family is the actual target user (D-15 §4.2 framing — "categories: Family/Crew/Duo"); their feedback is the highest-signal source for the watchparty + couch-groups flows.
- **D-36** (was Q9, Submission timing): **"As ready"** with internal target **mid-June 2026** (~3-4 weeks from full Wave 1 kickoff). Don't pin a public date until TestFlight is live and beta-stable. Rationale: avoid public commitments before App Review uncertainty resolves; CONTEXT line 38 already targets early-to-mid-June.

### New findings 2026-05-14 (folded into Phase 17 scope)

- **D-37 (auth back/forward hotfix — SHIPPED):** Safari back/forward Firebase Auth error fixed + deployed 2026-05-14T05:05Z as `couch-vfix-auth-bfcache` (commits 6563207 + c5cef7e + 02105cd). Two-part patch in `js/auth.js`: `signInWithPopup` branch for Safari non-PWA (popups allowed via direct user gesture) + `performance.getEntriesByType('navigation')[0]?.type === 'back_forward'` guard in `bootstrapAuth`. iOS standalone PWA keeps redirect per D-06. Removes one urgency vector for D-02 Apple Sign-In (was tracked as candidate (c) "Apple Sign-In sidesteps the Google-OAuth-redirect dance entirely"); Apple Sign-In is still required for §4.8 compliance but is no longer an emergency.
- **D-38 (nav-affordance UX gap — NEW Wave 1 work):** Surfaced 2026-05-14 during Phase 31 UAT Test 1. User reported: "way too many instances where I click something and don't have an easy way to click back or an x to return where I was. It's almost like you are stuck." Audit + fix back/X chrome on: title detail view, mood-filter screens, watchparty creation flow, intent-RSVP flow, family-roster screen, settings, deep-link-landed states (`?invite=` / `?claim=`). Bundle with the 30-HOTFIX-WAVE-5 modal aria-dialog + keyboard-trap work where overlap exists (per STATE.md line 143). New plan slot: **17-NAV** in Wave 1. ~2 days execution.
- **D-39 (Phase 31 dependency satisfied):** Phase 31 (Marketing refresh) SHIPPED 2026-05-13 as `couch-v48-marketing-refresh` (5/5 plans complete; 4/7 UAT auto-verified pass; 2 blocked on device/third-party; 1 issue routed back to Phase 17 as the D-37 fix). D-05 (Phase 31 dependency) is now fully satisfied — screenshots (1170×2532 fresh + Phase-9 soft-fallback), refreshed og.png (sha256-anchored, 67KB), refreshed landing.html copy with 4-block comparison + features + FAQ + audience grid all live at couchtonight.app.
- **D-40 (PR #8 merge before submission):** PR #8 (origin/main catch-up, 594 commits, +122K/-1K, 356 files) should merge BEFORE Phase 17 Wave 3 (App Review submission). Rationale: App Reviewers may pull production-mirror state for reproducibility audits; clean Git topology reduces friction. Add to Wave 3 pre-flight checklist.

### Revised Suggested Plan Count

Original 8 plans → revised based on 2026-05-06 / 2026-05-07 / 2026-05-13 / 2026-05-14 advance progress:

**Wave 0 (DONE):**
- ✅ 17-01: Apple Developer Program enrollment (Apple Team ID `49R296FJGF` active through 2027-05) + Google Play Console enrollment (BLOCKED on Android device verification — Bark Phone hit Device Owner API; workaround: borrow Pixel)
- ✅ 17-02: Author privacy.html + terms.html + Privacy Manifest + Data Safety form copy (privacy.html + terms.html LIVE at couchtonight.app; `PrivacyInfo.xcprivacy` ready in phase dir; Data Safety form drafted in `17-PLAY-CONSOLE-PREP.md`)

**Wave 1 (READY — kick off after `/gsd-plan-phase 17 --auto`):**
- 17-03: Apple Sign-In via Firebase Auth (1-2 days; `signInWithPopup` import already in `js/firebase.js` per D-37 hotfix — Apple provider extension is straightforward)
- 17-NAV (NEW from D-38): Nav-affordance UX audit + fix (~2 days; bundles with 30-HOTFIX-WAVE-5 aria-dialog work)
- ✅ 17-04: PWABuilder Xcode + Android Studio package generation (zips already at `~/Downloads/Couch Tonight.zip` + `~/Downloads/Couch - Google Play package.zip`)
- ✅ 17-05: Asset generation (Phase 15.3 produced `brand/mark-master.png` + `scripts/regenerate-icons.sh`; icon set + logo set already deployed)

**Wave 2 (depends on Wave 1):**
- 17-06: App Store screenshot capture via sharp downscale from Phase 31 1170×2532 captures (1-2 days)
- 17-07: App Preview video — 15s spin walkthrough per D-29 (1-2 days)
- 17-XCODE: Execute 17-XCODE-PATCHES-2026-05-11.md task list (~30-45 min on macOS)

**Wave 3 (depends on Wave 2 + user-side blockers cleared):**
- 17-08: TestFlight upload + 5-7 day beta (per D-20) + App Review submission + Phased Release config (~2 weeks total)
- 17-PLAY: Play Internal Testing track upload + 5-day beta (BLOCKED on Android device verification)
- 17-DNS: DNS email forwarding for `support@/security@/dmca@/review-apple@couchtonight.app` via Cloudflare (~10 min — unblocks reviewer demo account)
- 17-DEMO: Apple Reviewer demo account `review-apple@couchtonight.app` (pre-populated test family; paste credentials into ASC structured fields + replace `[SET AT SUBMISSION TIME]` in Notes for Reviewer) — depends on 17-DNS
- 17-MERGE (NEW from D-40): Merge PR #8 to clean Git topology before "Add for Review"

**Wave 4 (final):**
- 17-09: "Add for Review" final submission + Phased Release at 1% + Staged Rollout at 1%
- 17-10: Post-submission iteration loop until approval

**Total remaining runway:** ~3-4 weeks from Wave 1 kickoff, assuming macOS access (Xcode) + Android device unblock land in parallel.

### Open user-side blockers (unchanged)

- macOS access for Xcode/TestFlight (D-17 step 4)
- Android unmanaged device for Google Play Console verification (Bark Phone Device Owner API blocks)
- Apple Reviewer demo account creation depends on Cloudflare email forwarding (17-DNS, ~10 min config)

---

*Phase: 17-app-store-launch-readiness*
*Context pre-staged: 2026-05-06 via autonomous launch-prep work*
*Discussed: 2026-05-14 via `/gsd-discuss-phase 17 --auto` — D-28..D-40 added*
