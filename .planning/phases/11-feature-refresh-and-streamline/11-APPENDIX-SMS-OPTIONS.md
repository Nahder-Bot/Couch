# Phase 11 Appendix — SMS / Invite-delivery options for REFR-05

**Created:** 2026-04-23 in response to user decision to "review further" on SMS infrastructure commitment.
**Goal:** surface every realistic invite-delivery path so the Twilio-yes/no decision is informed.

> **DECIDED 2026-04-23: option (a) — Web Share API + web RSVP route. Defer Twilio SMS to Milestone 2 / post-PMF.**
>
> Rationale: ships in 5-7hr at $0/mo and covers most of what's needed; Twilio can layer in later without rework on the same RSVP route. See "My recommendation" section below for full reasoning. Plan 11-04 scope updated in `11-CONTEXT.md` to reflect this.

---

## The actual problem REFR-05 solves

Today, Couch sends watchparty / intent invites via **Firebase Cloud Messaging push notifications**. That works *only for installed-PWA users on this family*. For invitations that should reach:
- A friend who isn't on Couch yet
- A grandparent across the country
- A non-installed family member
- Anyone you want to invite into a watchparty without forcing app install first

…push isn't a delivery mechanism. They get nothing.

Research finding (Partiful): **SMS open rates ~98%, email 20-30%**. SMS converts the most. But it's also the most expensive and most regulated.

Below: every realistic option, ranked by effort × cost × reach.

---

## Option 1 — **Web Share API** (zero infra, free, no automation)

The host taps "Invite" → triggers `navigator.share({ title, text, url })` → OS opens iMessage/SMS/WhatsApp/whatever the host has. Host picks recipients manually and sends.

**Pros:**
- Zero cost, zero infra, zero PII surface
- Works today on iOS Safari, Android Chrome, Edge, most modern browsers
- Recipient sees the message in their preferred channel
- No phone numbers stored anywhere
- Ships in ~1 hour

**Cons:**
- Host has to send each invite themselves (no bulk)
- No automated reminders (the asymmetric nurture from REFR-06 doesn't work — the "system" can't text people it doesn't have numbers for)
- No web RSVP page integration (recipient still needs to install or follow web link without UX continuity)
- Host has to remember to do it

**Best for:** v1 commercial release with low operational complexity. The ritual remains "host invites manually." Nurture cadence applies only to people already in the group via push.

**Implementation effort:** S (~1-2 hrs)

---

## Option 2 — **Twilio** (managed SMS, automated)

The canonical answer. Twilio is the most mature SMS API; battle-tested.

**Pricing (US, 2026):**
- Phone number: $1.15/mo (long code) or $2/mo (toll-free)
- A2P 10DLC registration: **~$50 one-time** + ~$2-15/mo (mandatory for US business SMS or you get filtered/blocked)
- Per SMS: ~$0.0079 outbound, $0.0079 inbound
- Estimated monthly at low volume (50 invites/mo): **~$10-20/mo all-in**
- Estimated monthly at modest volume (500 invites/mo + reminders): **~$30-60/mo**

**Pros:**
- Reliable delivery (the gold standard)
- Programmatic — can fire reminder cadence (REFR-06) automatically
- Web RSVP page can route through a Twilio short-link
- Two-way (Twilio can receive responses, e.g., "Y" → mark Yes)
- Excellent SDKs, docs, debugging tools

**Cons:**
- Paid ongoing infra
- A2P 10DLC compliance overhead (registration form, ~2-week approval, brand/campaign verification)
- PII surface: now storing phone numbers of non-members
- Rate-limit + spam-prevention requires careful architecture
- New CF dependency (`sendInviteSMS`)

**Best for:** post-PMF or when manual share friction is the actual conversion bottleneck.

**Implementation effort:** L (~10-12 hrs incl. CF + RSVP route + compliance forms)

---

## Option 3 — **Plivo** (Twilio competitor, cheaper)

Drop-in alternative. ~30-40% cheaper SMS pricing. Same A2P 10DLC requirements (US carrier rules, not the vendor's).

**Pricing (US, 2026):**
- Per SMS: ~$0.0050 outbound (vs Twilio $0.0079)
- Phone number: ~$0.80/mo
- Same A2P 10DLC fees (carrier-imposed, not vendor)
- Estimated monthly at low volume: ~$8-15/mo all-in
- At modest volume: ~$20-45/mo

**Pros:** cheaper, same capability set, comparable docs.
**Cons:** smaller community, fewer 3rd-party integrations, less stable historically (some outage reports).

**Best for:** if Twilio commits feel right but you want to shave 30% off costs.

**Implementation effort:** L (~10-12 hrs, equivalent to Twilio)

---

## Option 4 — **AWS SNS** (transactional SMS via AWS)

Amazon's SMS service. Often cheaper at scale. No phone number purchase required for transactional messages (but per-message rates higher in some countries).

**Pricing (US, 2026):**
- Per SMS: ~$0.00645 outbound
- No phone number lease (uses AWS shared short codes for transactional)
- A2P 10DLC still required
- Monthly minimums depend on AWS billing posture; can be ~$5-15/mo at low volume

**Pros:** AWS infra (if you're already there), no number management, good rate at scale.
**Cons:** harder for two-way; can't easily own a number for branded sender ID without extra setup; carrier filtering more aggressive on shared short codes.

**Best for:** AWS-native shops. Couch is Firebase-native, so this adds a cross-cloud dependency.

**Implementation effort:** M-L (~8-10 hrs but adds AWS account + IAM management)

---

## Option 5 — **Email + push hybrid** (no SMS, free)

Skip SMS entirely. Use email as the universal-reach channel + push for installed users.

**Pricing:** Firebase has no email SDK; would need SendGrid (free tier 100/day) or AWS SES (~$0.10 per 1000) or Mailgun (free tier 5000/mo). All have generous free tiers for this volume.

**Pros:**
- Free at Couch's scale
- Universal reach (everyone has email)
- Same async-cadence reminder strategy works
- Lower regulatory burden than SMS (no A2P 10DLC, no carrier filtering, just SPF/DKIM setup)

**Cons:**
- Open rates 20-30% (vs SMS 98%) — Partiful's research holds
- Spam-folder risk
- Less "casual party invite" feel — email feels formal
- Higher latency (email delivery can be minutes, not seconds)

**Best for:** if you want automated nurture without SMS commitment.

**Implementation effort:** M (~5-7 hrs incl. SendGrid setup + RSVP route + reminder CF)

---

## Option 6 — **Native push deep-links + shareable URL** (status quo, free)

Existing FCM push for members. For non-members: host generates a unique RSVP link, Web-Share-API or copy-paste it, recipient lands on a web RSVP page (no app required), and *then* converts to push-receiving member after first interaction.

**Pros:**
- Zero new infra, zero ongoing cost
- Recipient experience: tap link → see invite → RSVP → optionally join Couch
- Combines Option 1's free-ness with the web-RSVP page UX from REFR-05
- Async nurture still works for members; non-members convert into members on first RSVP and *then* fall into the cadence

**Cons:**
- Same as Option 1 — host manually shares the link
- The "RSVP page" still needs to be built (some of REFR-05's effort)
- No automated reminders for never-converted recipients

**Best for:** the path I'd recommend for v1 — get the web-RSVP route shipped *without* SMS infra, then layer SMS later if conversion is bottlenecked.

**Implementation effort:** M (~5-7 hrs — RSVP route + Web Share trigger + member-conversion handler)

---

## Comparison matrix

| Option | Setup cost | Monthly cost (low vol) | Auto-reminders to non-members | Reach | PII risk | Effort |
|---|---|---|---|---|---|---|
| 1 — Web Share API | $0 | $0 | ✗ | iOS Safari + Android Chrome native share | None | S |
| 2 — Twilio | ~$50 | $10-20 → $30-60 | ✓ | Universal SMS | Phone numbers stored | L |
| 3 — Plivo | ~$50 | $8-15 → $20-45 | ✓ | Universal SMS | Phone numbers stored | L |
| 4 — AWS SNS | $0 | $5-15 → $20-40 | ✓ | Universal SMS | Phone numbers stored | M-L |
| 5 — Email | $0 | $0 (free tier) | ✓ | Universal email | Email addresses stored | M |
| 6 — Web Share + RSVP route | $0 | $0 | ✗ for non-members | Native share UX | None | M |

---

## My recommendation

**Ship Option 6 in Phase 11. Treat Twilio (Option 2) as a Milestone 2 / post-PMF question.**

Reasoning:
1. **You don't have product-market fit yet.** Building paid SMS infra before validating "do hosts actually struggle to invite non-members?" is premature optimization.
2. **The web-RSVP page is the real unlock.** Whether the link arrives via host-shared SMS, host-shared iMessage, host-shared WhatsApp, or host-shared Discord, the recipient lands on the same RSVP page either way. Build the page; let delivery be free.
3. **Option 6 ships in 5-7 hours of work** vs. 10-12 for Twilio + ongoing $30-60/mo + A2P 10DLC paperwork. The marginal value of automated SMS reminders for non-members is unclear at your scale (Nahder's family + invites = probably <10 invites/month right now).
4. **You can layer Twilio later without rework.** Option 6's RSVP route is the same route Twilio would post into. Adding Twilio later = adding the SMS-sending CF + a `notify_via: 'sms'` flag on the invite. The web RSVP page doesn't change.
5. **The async-nurture cadence (REFR-06)** still works perfectly for *members* via push — that's where the highest-value conversion already lives. Non-member nurture is a v2 problem.

**Concrete v1 scope for REFR-05 + REFR-06 if you accept this:**
- Build: web-RSVP route at `/rsvp/<token>`, `navigator.share()` integration in the watchparty schedule modal, `member-conversion-on-first-rsvp` flow
- Skip: Twilio CF, A2P 10DLC paperwork, SMS-specific reminder cadence
- Keep: asymmetric reminder cadence for members via push (existing channel)
- Defer: SMS infra to Milestone 2

**If you reject this and want SMS in Phase 11:** Twilio (Option 2) over Plivo (Option 3) for ecosystem maturity, despite the price difference.

---

## Decision needed

**Which option for Phase 11 REFR-05?**
- (a) **Option 6 — Web Share + RSVP route, defer SMS** (my recommendation)
- (b) **Option 2 — Twilio**, full async automation
- (c) **Option 5 — Email** as universal-reach instead of SMS
- (d) **Hybrid — Option 6 in v1 + plan for Twilio in v1.x post-validation**
- (e) **Skip REFR-05/06 entirely** — push-only (members only, no non-member invites)

Most teams I've seen in Couch's stage land at (a) or (d). (b) is right after first signs of PMF. (e) is right if non-member invites are vanishingly rare.

---

**Reply with `(a)` etc. and I'll lock REFR-05 + REFR-06 scope accordingly.**
