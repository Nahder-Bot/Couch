---
created: 2026-04-30
target_milestone: v3 (post-launch)
status: deferred
priority: high (cross-AI 2026-04-28 + user 2026-04-30)
parent_scope: watchparty + sports companion review
---

# v3 Seed: Voice/video chat in watchparty

## Context

User explicitly deferred this to "v3 post-launch" during the watchparty/sports
review on 2026-04-30. Confirmed as a future-must-have, not a never. Captured
here so the scope doesn't get lost when v1 ships.

## Problem

Watchparty reactions are emoji + occasional text bubbles. For a real cross-couch
movie night ("we're all watching from different homes"), families want to
actually talk during the watch — not just react. Today they bridge this with
external apps (FaceTime / WhatsApp / Discord on a side device). Couch should
own that surface.

## Two paths

### A. Daily.co prebuilt UI ($9/mo)

**Pros:** ships in 1-2 days; turnkey; STUN/TURN included; recording optional
**Cons:** generic UI doesn't fit Couch brand; another vendor dependency; per-user pricing scales
**Use when:** v3 launch where speed matters more than brand fit

### B. Roll-your-own WebRTC + Twilio TURN ($20-50/mo)

**Pros:** full brand control; cheaper at scale; integrates with existing roster/avatars
**Cons:** 1-2 weeks dev; need signaling Cloud Function; STUN/TURN management
**Use when:** v3+ where brand-fit and unit economics matter

## Recommended sequence (when v3 fires)

1. **Phase X.1 — Daily.co integration** behind a feature flag. Ship to active families. Measure: do they use it? Long sessions or quick check-ins?
2. **Phase X.2 — Decision gate** (3-month soak): if usage is high enough to justify the brand investment AND the per-user spend is hurting, switch to roll-your-own. If usage is low, stay on Daily.co or kill the feature.

## Notes

- Voice-only first ("phone call alongside the movie") is probably what families actually want. Video adds bandwidth + privacy concerns + "I look terrible" friction. Start audio-only.
- Push-to-talk (Discord-style hold-to-speak) is more polite than always-on for movie watch context.
- Mute when player audio is loud (auto-duck) — basic ergonomic.
- Cross-device support: works in PWA + native wrapper (iOS Safari WebRTC works since 2020+; Android Chrome WebRTC fine).

## Why deferred (not killed)

- v1/v2 watchparty UX is being polished first (sports feed, video player, pick'em, affiliate)
- Voice/video adds ongoing infra cost — wait until usage justifies
- Apple App Store has additional review requirements for camera/mic apps (privacy strings, age gates) — easier to handle post-launch
- Daily.co or similar SaaS is mature enough that ~6 months of waiting doesn't cost us anything

## Pointers

- Daily.co docs: https://docs.daily.co/
- Twilio Network Traversal Service (STUN/TURN): https://www.twilio.com/stun-turn
- Apple WebRTC + ATT considerations: https://developer.apple.com/app-store/review/guidelines/#5.1.1
- Existing watchparty surface: `js/app.js` `openWatchpartyLive` + `wp-*` CSS classes (~line 11000+)

## Triggers to revisit

- Couch hits 500+ active families (warrants the spend)
- v2 watchparty improvements (Phase 22-31) shipped and stable
- User signals real demand ("we use FaceTime alongside Couch every week")
