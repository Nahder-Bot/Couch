---
phase: 17-app-store-launch-readiness
plan: DNS
type: execute
wave: 1
depends_on: []
files_modified: []
autonomous: false
requirements: [LAUNCH-17-DNS]
tags: [dns, email-forwarding, cloudflare, apple-reviewer, infra]

must_haves:
  truths:
    - "couchtonight.app domain has 4 email forwarding rules active: support@, security@, dmca@, review-apple@ — all routing to nahder@yahoo.com (or user-chosen inbox)"
    - "Sending an email to any of the 4 addresses arrives at the destination inbox within 5 minutes"
    - "DKIM + SPF records are configured for the routing provider (Cloudflare Email Routing default; no action needed for receiving)"
    - "The 4 addresses are referenced in privacy.html + terms.html — confirmed reachable (audit privacy.html for 'support@couchtonight.app' / 'security@couchtonight.app' / 'dmca@couchtonight.app' presence)"
    - "Apple Reviewer demo account (next plan, 17-DEMO) can use review-apple@couchtonight.app for Apple ID verification mail"
  artifacts:
    - path: "DNS records on couchtonight.app (Cloudflare)"
      provides: "MX records + 4 forwarding rules"
      contains_all: ["MX record route1.mx.cloudflare.net", "MX record route2.mx.cloudflare.net", "MX record route3.mx.cloudflare.net"]
    - path: "Cloudflare Email Routing dashboard"
      provides: "4 routing rules"
      contains_all: ["support@couchtonight.app", "security@couchtonight.app", "dmca@couchtonight.app", "review-apple@couchtonight.app"]
  key_links:
    - from: "privacy.html + terms.html email references"
      to: "Cloudflare Email Routing forwarding rules"
      via: "DNS MX records + per-address routing"
      pattern: "support@couchtonight.app -> nahder@yahoo.com (etc.)"
    - from: "Phase 17 Apple Reviewer demo account (17-DEMO)"
      to: "review-apple@couchtonight.app receiving Apple verification mail"
      via: "Same Cloudflare routing rules"
      pattern: "Apple sends to review-apple@; Cloudflare forwards to nahder@yahoo.com; reviewer can verify"

threat_model:
  scope: "Adds inbound email routing only. No outbound SMTP, no transactional email. Receives mail destined for 4 specific addresses; everything else bounces."
  threats:
    - id: T-DNS-01
      severity: medium
      threat: "Email-forwarding rules could leak the destination personal inbox if reply-all is used (reveals nahder@yahoo.com)"
      mitigation: "Cloudflare Email Routing rewrites reply-to headers by default (verify in dashboard). Document in launch checklist that replies should be authored from a dedicated couchtonight.app SMTP if/when outbound is needed"
      status: accepted_risk
    - id: T-DNS-02
      severity: low
      threat: "Spam volume on support@ could overwhelm personal inbox"
      mitigation: "Cloudflare Email Routing has built-in spam filtering; add a Gmail filter on receiving side to auto-label 'couchtonight'. Monitor for 30 days post-launch; switch to dedicated Couch inbox if volume exceeds noise budget"
      status: accepted_risk
    - id: T-DNS-03
      severity: low
      threat: "Apple Reviewer demo account uses Apple ID at review-apple@couchtonight.app; if Apple sends OTP and it doesn't arrive within 10 min, App Review may be delayed"
      mitigation: "Verify routing within 5 min of setup by sending a test email to each address; document the routing inbox path in App Store Connect Notes for Reviewer body so user knows where Apple's verification mail will arrive"
      status: addressed
---

<objective>
Configure DNS email forwarding for `couchtonight.app` via Cloudflare Email Routing. Four addresses MUST be live + verified-reachable BEFORE Phase 17 Apple Reviewer demo account creation (separate plan): `support@`, `security@`, `dmca@`, `review-apple@`. All route to the user's primary inbox (`nahder@yahoo.com` per CLAUDE.md user email field; user can override).

Purpose: Unblocks Apple Reviewer demo account creation (Apple ID verification mail needs a working inbox at review-apple@couchtonight.app). Also makes privacy.html + terms.html email references actually reachable (currently they reference addresses that don't deliver).

Output: 4 email-forwarding rules active in Cloudflare; verified by sending a test email to each address.

Estimated execution: ~10-15 minutes (mostly user steps in Cloudflare dashboard).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<tasks>

<task id="17-DNS-01" autonomous="false">
<title>Enable Cloudflare Email Routing on couchtonight.app + add 4 forwarding rules</title>
<action>
User steps in Cloudflare dashboard (https://dash.cloudflare.com → couchtonight.app → Email → Email Routing):

1. **Enable Email Routing** (if not already enabled): Click "Enable Email Routing" → Cloudflare auto-creates required MX records. If prompted to confirm DNS changes, accept.

2. **Verify destination address** (one-time per inbox): Click "Destination addresses" → "Add destination address" → enter `nahder@yahoo.com` (or user-chosen address) → click verify → check that inbox → click verification link.

3. **Create 4 forwarding rules** under "Routing rules":
   - Custom address: `support` → Destination: `nahder@yahoo.com` → Action: "Send to an email" → Save
   - Custom address: `security` → Destination: `nahder@yahoo.com` → Save
   - Custom address: `dmca` → Destination: `nahder@yahoo.com` → Save
   - Custom address: `review-apple` → Destination: `nahder@yahoo.com` → Save

4. (Optional) Add catch-all rule: "Catch-all address" → Action: "Drop" — silently discards mail to any unmapped local-part (prevents inbox spam from random aliases).

5. Confirm DNS records: Email Routing tab should show "Configured" status with 3 MX records (route1/2/3.mx.cloudflare.net) at priority 7/15/35.

Claude verification (after user confirms):
- `dig MX couchtonight.app +short` should return 3 Cloudflare route* MX records.
- Send a test email to each of the 4 addresses from any external email account; expect arrival within 5 min at nahder@yahoo.com.
</action>
<read_first>
- privacy.html (Grep for email addresses referenced; ensures we're configuring the right 4 addresses)
- terms.html (Grep for email addresses referenced)
- .planning/phases/17-app-store-launch-readiness/.continue-here.md (lists DNS as remaining work)
- https://developers.cloudflare.com/email-routing/setup/ (reference docs; no live fetch needed — instructions captured above)
</read_first>
<acceptance_criteria>
- User confirms Cloudflare Email Routing dashboard shows 4 rules with custom addresses: support, security, dmca, review-apple
- `dig MX couchtonight.app +short` returns 3 route*.mx.cloudflare.net MX records (run via Bash after user confirms setup)
- Test email sent to each of the 4 addresses arrives at the destination inbox within 5 min (user confirms each)
- privacy.html email references match (Grep "support@couchtonight.app" / "security@couchtonight.app" / "dmca@couchtonight.app" — all present)
</acceptance_criteria>
</task>

<task id="17-DNS-02" autonomous="true">
<title>Verify production-side reachability post-setup</title>
<action>
After user confirms task 01 complete:

1. Run `dig MX couchtonight.app +short` — confirm 3 Cloudflare route*.mx.cloudflare.net MX records.
2. Run `dig TXT couchtonight.app +short` — confirm any DKIM/SPF records Cloudflare added (informational; not blocking).
3. Send a structured test email from Claude's Bash environment IF a CLI SMTP / mail tool is available (e.g. `curl` to a mail-test service). If no tool available, document the test instructions in 17-DNS-VERIFY.md and prompt user to run them.
4. Append to STATE.md Open follow-ups:
   `| Phase 17 / DNS email forwarding | ✅ DEPLOYED [date]; 4 addresses (support/security/dmca/review-apple) routing to nahder@yahoo.com via Cloudflare. Unblocks 17-DEMO Apple Reviewer account. | (Cloudflare dashboard) |`
5. Update 17-CONTEXT.md decision D-31 status note to: "DNS email forwarding DEPLOYED [date]; unblocks Apple Reviewer demo creation per 17-DEMO."

No code files modified by this plan.
</action>
<read_first>
- .planning/STATE.md (Open follow-ups section, line 136)
- .planning/phases/17-app-store-launch-readiness/17-CONTEXT.md (D-30/D-31 area)
</read_first>
<acceptance_criteria>
- dig MX couchtonight.app returns 3 Cloudflare MX records
- STATE.md updated with HOTFIX shipped / DNS forwarding active entry
- 17-CONTEXT.md updated with deployment date for DNS forwarding
- 17-DNS-VERIFY.md (if used) documents user-side verification of the test emails
</acceptance_criteria>
</task>

</tasks>

<verification>
After both tasks:

1. `dig MX couchtonight.app +short` returns 3 route*.mx.cloudflare.net records.
2. User has confirmed test emails arrived at destination inbox for all 4 addresses.
3. STATE.md Open follow-ups has the DNS-deployed entry.
4. 17-CONTEXT.md frontmatter date updated.

This plan is intentionally lightweight — it's a config task gating 17-DEMO (Apple Reviewer account creation). No code commit unless STATE.md / CONTEXT.md updates are committed.
</verification>

<files_to_summarize_on_complete>
- STATE.md (Open follow-ups entry added)
- 17-CONTEXT.md (D-31 area date update)
- 17-DNS-VERIFY.md (if created for user-side test instructions)
</files_to_summarize_on_complete>
