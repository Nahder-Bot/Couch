---
phase: 17-app-store-launch-readiness
plan: NAV
type: execute
wave: 1
depends_on: []
files_modified:
  - app.html
  - css/app.css
  - js/app.js
autonomous: true
requirements: [LAUNCH-17-NAV]
tags: [ux, nav-affordance, back-button, modal-chrome, a11y, pre-launch-polish]

must_haves:
  truths:
    - "Every drill-down / modal / detail surface in app.html exposes a visible back affordance (back arrow OR X / Close button) reachable within one tap, OR a clear swipe-to-dismiss that's discoverable without prior knowledge"
    - "No surface can leave the user 'stuck' — every state has at least one path back to the immediately-prior surface"
    - "Deep-link landed surfaces (?invite=, ?claim=) gracefully redirect to a known surface (couch viz, family roster, or signin) after the deep-link payload is consumed"
    - "iOS Mobile Safari (NOT installed PWA) users can recover from any nav dead-end without a hard refresh"
    - "Existing 30-HOTFIX-WAVE-5 aria-modal + role=dialog + aria-labelledby work is preserved or extended; nothing regresses"
  artifacts:
    - path: "app.html"
      provides: "Back/X chrome added to surfaces that previously lacked it"
      contains_all: ["aria-label=\"Back\"", "aria-label=\"Close\""]
    - path: "css/app.css"
      provides: ".modal-close / .back-link / .detail-back styling (or analog using existing tokens)"
      contains_all: [".modal-close", ".back-link"]
    - path: "js/app.js"
      provides: "Back/close click handlers + back-button history.back() fallback"
      contains_all: ["history.back()", "data-action=\"back\"", "data-action=\"close\""]
  key_links:
    - from: "Each drill-down surface in app.html"
      to: "Either history.back() (browser-back semantics) OR an explicit close handler in js/app.js"
      via: "Click delegate routing data-action='back' or 'close'"
      pattern: "data-action=\"(back|close)\""
    - from: "Phase 17 / D-38 nav-affordance gap"
      to: "30-HOTFIX-WAVE-5 modal aria work (per STATE.md line 143)"
      via: "Shared chrome — modal close button serves both a11y (aria-label='Close') AND nav-recovery (visible X)"
      pattern: "bundle changes in same commit; don't regress aria attributes"

threat_model:
  scope: "UX chrome changes to existing surfaces. No new data flows, no new auth surface, no new third-party. Risk surface = a11y regression or visual regression in established design system."
  threats:
    - id: T-NAV-01
      severity: medium
      threat: "Adding back/X buttons could regress the warm-dark restraint-first design language (BRAND.md voice rule: 'loud about behaviors, restrained about feelings')"
      mitigation: "Reuse existing :root tokens (var(--ink-dim), var(--surface), var(--border)); 16px close glyph max; no shadows or accent colors; mirror existing .detail-close pattern from Phase 14-05"
      status: addressed
    - id: T-NAV-02
      severity: medium
      threat: "Adding history.back() handlers could trigger the just-fixed Firebase Auth back/forward error (D-37)"
      mitigation: "D-37 hotfix (couch-vfix-auth-bfcache) already guards bootstrapAuth against bfcache restoration via performance.navigation back_forward check. New back-button clicks ARE intentional back navigation, not bfcache restore — the guard remains correct (only skips getRedirectResult on PASSIVE bfcache restore, not ACTIVE user-initiated back)"
      status: addressed
    - id: T-NAV-03
      severity: low
      threat: "Deep-link landing redirects could lose the deep-link payload mid-redirect (e.g. ?invite= consumed then redirect loses state)"
      mitigation: "Existing _stashTokensFromUrl in js/auth.js already preserves claim/invite/family tokens to sessionStorage before any URL mutation. New redirects MUST consume from sessionStorage, not URL params"
      status: addressed
---

<objective>
Close the "I feel stuck" UX gap surfaced during Phase 31 UAT Test 1 (D-38). User reported "way too many instances where I click something and don't have an easy way to click back or an x to return where I was. It's almost like you are stuck." Audit + add back/X chrome to surfaces that lack it. Bundle with 30-HOTFIX-WAVE-5 modal aria-dialog work where overlap exists.

Purpose: Closes one App Store launch readiness item. Pre-launch polish — substantially improves first-time-user navigation confidence. No new features, no schema changes — purely existing-surface chrome additions.

Output: All drill-down + modal + detail surfaces in app.html expose a visible recovery path; deep-link landings cleanly redirect; iOS Mobile Safari users never feel stuck.

Estimated execution: ~2 days. Bundle commit with 30-HOTFIX-WAVE-5 aria work where touching the same files.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<tasks>

<task id="17-NAV-01" autonomous="true">
<title>Audit app.html — enumerate all surfaces and classify back-affordance state</title>
<action>
Read app.html top-to-bottom (~990 lines — safe to read in full per CLAUDE.md token guidance). For each distinct surface (screen, modal, detail view, drill-down), produce a row in a Markdown audit table written to `.planning/phases/17-app-store-launch-readiness/17-NAV-AUDIT.md`:

| Surface | DOM selector | Has back? | Has X? | Recovery path | Verdict |
|---------|--------------|-----------|--------|---------------|---------|
| Couch viz (home) | `#tonight-section` or analog | N/A (root) | N/A | N/A | OK (root surface) |
| Title detail modal | `.title-detail-modal` | ? | ? | ? | OK / NEEDS-BACK / NEEDS-X / NEEDS-BOTH |
| Mood-filter screen | ? | ? | ? | ? | ? |
| Watchparty creation | ? | ? | ? | ? | ? |
| Intent-RSVP flow | ? | ? | ? | ? | ? |
| Family-roster | ? | ? | ? | ? | ? |
| Settings | ? | ? | ? | ? | ? |
| Pickem leaderboard | ? | ? | ? | ? | ? |
| Wait Up modal | ? | ? | ? | ? | ? |
| Couch Groups | ? | ? | ? | ? | ? |
| Replay modal | ? | ? | ? | ? | ? |
| Sign-in screen | ? | ? | ? | ? | ? |

Use Grep for `modal`, `detail`, `drawer`, `sheet`, `screen`, `view`, `section` to enumerate.

After enumeration, identify which surfaces have a `.modal-close` / `.back-link` / `.detail-close` element already (Phase 14-05 added `.detail-close{position:fixed}` rule per CLAUDE.md note) and which lack one.

Output: 17-NAV-AUDIT.md with the table populated + a prioritized "fix list" at the bottom: which surfaces need NEEDS-X / NEEDS-BACK / NEEDS-BOTH chrome.

This task is read-only; commits the audit file.
</action>
<read_first>
- app.html (~990 lines; read in full)
- css/app.css (Grep for .modal-close, .detail-close, .back-link existing patterns)
- .planning/STATE.md (line 143: 30-HOTFIX-WAVE-5 modal aria work — note which modals already have aria-dialog + label)
- .planning/phases/30-couch-groups-affiliate-hooks/30-HOTFIX-WAVE-3-CSS.md (existing modal chrome work for reference)
</read_first>
<acceptance_criteria>
- 17-NAV-AUDIT.md exists in phase dir
- Audit table has at least 10 rows (all major surfaces enumerated)
- Each row's Verdict column is one of: OK, NEEDS-BACK, NEEDS-X, NEEDS-BOTH
- Fix list at bottom enumerates only NEEDS-* surfaces with proposed chrome treatment
</acceptance_criteria>
</task>

<task id="17-NAV-02" autonomous="true">
<title>Apply back/X chrome to NEEDS-* surfaces per audit fix list</title>
<action>
Read 17-NAV-AUDIT.md from task 01. For each row marked NEEDS-X / NEEDS-BACK / NEEDS-BOTH, apply the corresponding chrome.

Chrome patterns to use (reuse existing tokens — restraint-first design):

**Pattern A — Close X (for modals, detail views):**

```html
<button type="button" class="modal-close" data-action="close" aria-label="Close">
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M5 5l10 10M15 5l-10 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  </svg>
</button>
```

CSS (only add if not already present — check existing `.detail-close` and `.modal-close` rules first):

```css
.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 44px;  /* HIG / WCAG touch target */
  height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  color: var(--ink-dim);
  border: 0;
  border-radius: 50%;
  cursor: pointer;
  transition: color 200ms ease, background 200ms ease;
}
.modal-close:hover, .modal-close:focus-visible {
  color: var(--ink);
  background: var(--surface);
}
```

**Pattern B — Back arrow (for drill-down screens that maintain a left-of-root mental model):**

```html
<button type="button" class="back-link" data-action="back" aria-label="Back">
  <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
    <path d="M12 4l-7 6 7 6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  </svg>
  <span>Back</span>
</button>
```

CSS:

```css
.back-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
  color: var(--ink-dim);
  background: transparent;
  border: 0;
  font: inherit;
  font-size: 15px;
  padding: 8px 12px 8px 4px;
  margin: 4px 0 12px;
  cursor: pointer;
}
.back-link:hover, .back-link:focus-visible {
  color: var(--ink);
}
```

js/app.js handler additions (find the existing click delegate, add two branches):

```js
// In the main click delegate (find existing data-action handler):
if (target.matches('[data-action="back"], [data-action="back"] *')) {
  // Prefer popping the in-app stack if we have one; else history.back()
  if (typeof state?.popView === 'function' && state.popView()) return;
  if (history.length > 1) { history.back(); return; }
  // Fallback: route to root
  if (typeof showTonight === 'function') showTonight();
}
if (target.matches('[data-action="close"], [data-action="close"] *')) {
  const modal = target.closest('.modal, .detail-overlay, [role="dialog"]');
  if (modal) modal.classList.remove('open');  // existing pattern; adjust per actual modal hide convention
}
```

Apply chrome to all NEEDS-* surfaces per the audit. Where the surface already has 30-HOTFIX-WAVE-5 aria-dialog work, preserve those attributes and ADD the chrome — don't replace.
</action>
<read_first>
- 17-NAV-AUDIT.md (this phase, output of task 01)
- app.html (~990 lines)
- css/app.css (grep for .modal-close, .detail-close, .back-link)
- js/app.js (grep for "data-action" — find the existing click delegate ~line range)
</read_first>
<acceptance_criteria>
- Every surface marked NEEDS-X has a `.modal-close` button with `data-action="close"` + `aria-label="Close"`
- Every surface marked NEEDS-BACK has a `.back-link` button with `data-action="back"` + `aria-label="Back"`
- Every surface marked NEEDS-BOTH has both chrome elements
- js/app.js click delegate handles `data-action="back"` AND `data-action="close"`
- No existing aria-dialog / role="dialog" attribute is removed (30-HOTFIX-WAVE-5 preserved)
- All chrome reuses var(--ink-dim) / var(--ink) / var(--surface) — NO new color tokens (matches D-21 pattern from Phase 31)
- All touch targets are ≥44×44px (WCAG / iOS HIG)
</acceptance_criteria>
</task>

<task id="17-NAV-03" autonomous="true">
<title>Audit deep-link landing handling (?invite= / ?claim= / future ?rsvp=)</title>
<action>
Read landing.html (the marketing surface at /) and check the inline redirect block that forwards deep links to /app. Confirm it preserves query string. Then read app.html boot sequence (js/app.js) and confirm `_stashTokensFromUrl` (in js/auth.js) is called BEFORE any URL mutation.

For each deep-link parameter (`claim`, `family`, `invite`, and any future `rsvp` / `pickemid` / etc.):
- Confirm the value is stashed to sessionStorage on landing arrival
- Confirm the URL is cleaned (history.replaceState) AFTER the stash
- Confirm the post-auth flow reads from sessionStorage, NOT the URL
- Confirm there's a clear "recovery" UI if the deep-link payload is invalid (e.g. expired claim token) — user lands on a known surface (signin OR couch viz) with a toast, NOT a blank screen

If any deep-link handling is missing a clean redirect path, add it. The pattern: stash → clean URL → boot → consume from sessionStorage → if invalid, route to signin with toast.
</action>
<read_first>
- landing.html (~165 lines)
- js/auth.js (_stashTokensFromUrl, lines 127-145)
- js/app.js (Grep for "claim", "invite", "rsvp", "sessionStorage.getItem" patterns)
- .planning/phases/27-guest-rsvp/27-CONTEXT.md (rsvp token handling reference)
</read_first>
<acceptance_criteria>
- landing.html redirect preserves query string (no regression — D-31 marketing-refresh kept this)
- js/auth.js _stashTokensFromUrl runs BEFORE any URL mutation (confirm via code path tracing)
- For each deep-link param, the URL is cleaned (history.replaceState) after stash
- Invalid deep-link payloads produce a toast + route to signin or couch viz — NOT a blank screen or error page
- 17-NAV-AUDIT.md updated with a "Deep-link recovery" section confirming each param's clean handling
</acceptance_criteria>
</task>

<task id="17-NAV-04" autonomous="true">
<title>Verify in production via Playwright + log HUMAN-VERIFY for iOS Safari</title>
<action>
After deploy via `bash scripts/deploy.sh nav-affordances`:

1. Drive Playwright to https://couchtonight.app/app
2. For each major surface, navigate in and confirm a visible back or X button is present + clickable
3. Spot-check: click into title detail, then click X — confirm modal closes
4. Spot-check: navigate into Settings (if reachable from current auth state), then click Back — confirm return to prior surface
5. Test the deep-link recovery: open https://couchtonight.app/app?invite=nonexistent-token-uat — confirm graceful landing (signin or couch viz with a toast), NOT a blank screen

Then log HUMAN-VERIFY to STATE.md: "Phase 17 / Nav-affordance audit + fix shipped [cache-name] [date]; HUMAN-VERIFY pending real-iPhone Mobile Safari spot-check of: title detail X / mood-filter back / watchparty creation X / intent-RSVP back / family-roster back / settings back / deep-link recovery toast. Reply 'nav verified' when done."
</action>
<read_first>
- 17-NAV-AUDIT.md (this phase)
- scripts/deploy.sh (deploy ritual)
</read_first>
<acceptance_criteria>
- Production curl confirms `data-action="close"` and `data-action="back"` are live in /app
- Playwright snapshot of /app shows back/X buttons on at least 5 different surfaces
- Playwright deep-link recovery test passes: ?invite=nonexistent-token lands cleanly (signin OR couch viz, NOT blank)
- STATE.md updated with HUMAN-VERIFY entry
</acceptance_criteria>
</task>

</tasks>

<verification>
1. Read 17-NAV-AUDIT.md — confirm 100% of NEEDS-* surfaces have been resolved (every row's Verdict resolves to OK in a post-task pass).

2. Production checks:
   - `curl -s https://couchtonight.app/app | grep -E 'data-action="(back|close)"'` returns multiple matches.
   - `curl -s https://couchtonight.app/css/app.css | grep -E '\.(modal-close|back-link)'` returns the style rules.
   - sw.js CACHE bumped vs prior deploy.

3. Playwright sanity-check: navigate to /app, snapshot, confirm back/X buttons visible on at least 5 distinct surfaces.

4. STATE.md updated with HUMAN-VERIFY entry for real-iPhone spot-checking.

If any verification step fails, do NOT mark this plan complete.
</verification>

<files_to_summarize_on_complete>
- 17-NAV-AUDIT.md (newly created)
- app.html (back/X chrome additions)
- css/app.css (style rules added)
- js/app.js (click delegate handlers added)
- STATE.md (HUMAN-VERIFY entry)
</files_to_summarize_on_complete>
