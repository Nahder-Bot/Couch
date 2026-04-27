---
created: 2026-04-27T11:48:08.361Z
title: Live-release push nominate deep-link handler
area: ui
files:
  - js/app.js:2560-2601 (maybeOpenIntentFromDeepLink — pattern to mirror)
  - ~/queuenight/functions/index.js:1013 (CF emits /?nominate={titleId}&prefillTime={airTs})
  - .planning/phases/15-tracking-layer/15-INTEGRATION.md (Concern #1 — full context)
  - .planning/phases/15-tracking-layer/15-CONTEXT.md (D-11 — original spec for the flow)
  - js/app.js (search for ?intent= handling — find anchor for new ?nominate= handler)
---

## Problem

Phase 15 cross-phase integration check (2026-04-27) found 0 regressions and 1 MEDIUM scope gap: the live-release push CF (TRACK-15-08) emits `/?nominate={titleId}&prefillTime={airTs}` URLs, but **no client handler reads `?nominate=` or `?prefillTime=`**. Verified via Grep — 0 matches in `js/app.js`. The existing `maybeOpenIntentFromDeepLink` at `js/app.js:2560` only reads `?intent={intentId}`, not `?nominate=`.

**Effective behavior today (post-15.0.1 fix to CR-01 stale-data guard):**
- CF watchpartyTick correctly fires the live-release push
- Push delivered with title "New episode {tonight|tomorrow|Weekday}" + body "{Show} S{N}E{M} — watch with the couch?"
- User taps the push notification
- App opens to default screen (Tonight tab)
- User has to manually navigate Library → find the show → open detail → "Watch with the couch?" → nominate
- Multi-tap journey instead of the spec'd 1-tap nominate-prefill

**Pre-existing scope gap** — D-11 in 15-CONTEXT.md specifies the deep-link contract, but no plan in 15-01..15-08 added the client URL parser. P15 shipped the CF half of a flow whose client half was implicitly deferred. Push delivery + tracking + idempotency all work — only the 1-tap nominate UX is degraded.

## Solution

Single-file client patch. ~30-50 lines mirroring the existing `maybeOpenIntentFromDeepLink` at js/app.js:2560-2601.

**Implementation outline:**

```js
// === Phase 15 / D-11 / TRACK-15-?? — live-release push deep-link handler ===
// Receives /?nominate={titleId}&prefillTime={airTs} from the CF live-release push
// (queuenight/functions/index.js watchpartyTick sweep). Pre-fills the Flow B
// nominate UI for the show + suggested time. Idempotent — safe to call on every
// load; reads URLSearchParams once, removes the params after handling so refresh
// doesn't re-trigger.
async function maybeOpenNominateFromDeepLink() {
  const params = new URLSearchParams(window.location.search);
  const titleId = params.get('nominate');
  if (!titleId) return;

  const prefillTime = parseInt(params.get('prefillTime'), 10) || null;

  // Strip the params so back-button + refresh don't re-fire
  params.delete('nominate');
  params.delete('prefillTime');
  const newUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
  window.history.replaceState({}, '', newUrl);

  // Wait for state hydration if needed (mirror maybeOpenIntentFromDeepLink pattern)
  await waitForStateReady();

  const t = state.titles[titleId];
  if (!t) {
    // Title not in family library — cannot nominate. Silently skip + breadcrumb.
    if (typeof Sentry !== 'undefined') {
      Sentry.addBreadcrumb({ category: 'nominateDeepLink', message: 'titleId not in family', data: { titleId } });
    }
    return;
  }

  // Open Flow B nominate flow with prefill — touchpoint TBD per existing 14-08 nominate API
  openFlowBNominate(titleId, { prefillTime });
}

// Wire to load — call after state hydration in onAuthReady or wherever
// maybeOpenIntentFromDeepLink is currently called.
```

**Key questions to resolve in implementation:**
1. **Where to wire the call?** — find `maybeOpenIntentFromDeepLink()` invocation site and add this beside it
2. **`openFlowBNominate` API shape?** — Flow B is from Phase 14-08; verify the signature accepts `prefillTime` or determine the correct state to set before calling the existing nominate UI entry point
3. **Race with PWA cold boot?** — same `waitForStateReady` pattern as the intent handler
4. **Title not in family edge case** — silently skip + breadcrumb (don't show error toast; the push could be from a previous session)

**Test plan:**
- Manual: trigger a watchpartyTick CF run with a real tracked TV title, get the push on a real device, tap it, verify nominate UI opens with the correct title + time prefill
- Or simulate: navigate to `https://couchtonight.app/app?nominate=<titleId>&prefillTime=1735678800000` and verify same UX

**Reference docs:**
- `.planning/phases/15-tracking-layer/15-INTEGRATION.md` Concern #1 — full evidence
- `.planning/phases/15-tracking-layer/15-CONTEXT.md` D-11 — original spec
- `js/app.js:2560-2601` `maybeOpenIntentFromDeepLink` — existing pattern to mirror

**Estimated effort:** ~45 min of work — single function + 1 wire-up call + smoke test. Not worth a full GSD plan unless you want test coverage; could ship as `/gsd-fast` or `/gsd-quick`.

**Priority:** MEDIUM — degrades a marquee Phase 15 push UX from 1-tap to multi-tap. Not blocking; live-release push itself works (post-15.0.1 fix). User-noticed if Phase 15 gets real-world live-release fires before this lands.
