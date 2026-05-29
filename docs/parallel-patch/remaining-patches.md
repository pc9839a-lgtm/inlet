# Remaining Patches

Updated: 2026-05-28

Current deployed baseline:

- GitHub `main`: `db6d3b0`
- Cloudflare Pages deployment: `3c76ed78`
- URL: `https://pagero.kr`
- D1: `inlet-prod`
- Applied migrations: `0001`, `0002_lead_dedupe_fields.sql`, `0003_event_dimensions.sql`, `0004_lead_blocked_submissions.sql`
- Passed after deployment: hosted API QA, hosted route QA, production browser QA, strict artifact QA.

This document lists only remaining production work. Completed baseline work should not be reassigned unless a regression is found.

Current execution mode: parallel patching is active.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data.
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV.
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates.
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow.
5. Worker 5: QA, deployment, live integration readiness, docs and ops.

Compatibility labels for QA contracts:

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration.
- Add lead duplicate and spam policy.
- Page duplication and URL setup.
- Expanded Launch Backlog.
- Login, account, and member management.
- Plans, payment, and subscription, final phase.
- Do not reassign these.
- Required command references: `deployment:qa`, `npm run live:qa`.

## Immediate Priority

1. Account settings and real email delivery.
2. Settings UI connection for blocked-history and duplicate/spam policy visibility.
3. Stats and inbox operation quality.
4. Template quality pass for the three active templates.
5. Settings/admin UX completion.
6. Live integrations.
7. Billing and subscriptions last.

## Worker 1: Account, Auth, Email, Members

Main remaining work:

- Build real account settings UI and API for name, email, phone, password change, logout, and session status.
- Add account states: active, pending verification, suspended, deleted pending retention.
- Reject suspended/deleted accounts during login and session refresh with clear Korean copy.
- Keep signup blocked until email verification is complete.
- Keep password rule: at least 6 characters, must include English letters and numbers.
- Password reset must stay as: email verification completed -> set new password -> return to login.
- Duplicate email and duplicate phone must be checked server-side across active, pending, suspended, and deleted-pending-retention accounts unless a later retention policy explicitly allows reuse.
- Add transactional email provider boundary for verification, manager invite, password reset, ownership transfer approval/rejection, and later payment failure.
- Preferred live provider decision: start with AWS SES unless changed by owner.
- Keep provider swappable, but first implementation should target AWS SES HTTP/API sending for Cloudflare Pages Functions.
- Do not use raw SMTP sockets in production Pages Functions.
- SES has a limited free tier, but launch planning must not depend on free usage:
  - first 12 months after SES usage starts: up to 3,000 message charges/month free;
  - normal outbound email price is roughly USD 0.10 per 1,000 emails, plus possible data/add-on charges.
- SES requires domain verification, DKIM/SPF/DMARC DNS, and production access approval if the account is still in sandbox.
- User-facing mail failure copy must be generic. Do not show quota/provider/internal reason to users.
- Internal logs should classify not configured, quota exceeded, timeout, provider error, sandbox rejection, and domain not verified.
- Missing email credentials must be `skipped-live` or unavailable, not a broken signup path.
- Move remaining account/session/member/invite access reads toward D1 while keeping JSONL/dev fallback.
- Add audit rows for signup, verification, login failure category, password change, profile change, invite accepted, member removed, account suspended/restored.

Done baseline, do not repeat:

- Login/session endpoints exist.
- Offline email verification mock exists.
- Manager invite accept exists.
- Signed session strict/production mode exists.
- Hosted API route QA passed after deployment.

## Worker 2: Leads, Duplicate Policy, Inbox, Stats, D1

Main remaining work:

- Server now enforces per project/page duplicate settings as of `db6d3b0`.
- Server now persists blocked/rate-limited attempts in D1/JSONL blocked-history as of `db6d3b0`.
- UI blocked history must read from server data, not from page JSON placeholder.
- Required owner settings: IP duplicate rejection, cookie/client duplicate rejection, form-field duplicate count, duplicate period, phone/email mark vs block mode.
- Defaults should be conservative: cookie duplicate rejection on for accidental repeats, IP rejection off or short-window only, phone/email mark-only by default.
- Hard-block only rapid repeat, rate-limit abuse, high risk score, or explicit owner-selected reject mode.
- Store duplicate metadata on saved leads: client id, IP hash, user agent hash, normalized phone/email, duplicate flag, duplicate reason, risk score, submitted time.
- Store blocked-history metadata: time, project/page/form, reason, risk score, policy snapshot, IP hash, client id, user agent hash, masked contact summary.
- Do not expose raw IP if only hashes are stored.
- Inbox first load must stay 50 rows and use more paging.
- CSV must stay month-bounded and include useful duplicate/reason/operator fields.
- Stats should expand beyond basic totals: source/channel, device, page, CTA, form start, submit attempt, submit success, reservation attempt/success, conversion rate, trend comparison.
- Keep D1 SQL aggregation preferred for high volume. JSONL is dev/import fallback only.

Done baseline, do not repeat:

- D1 lead dedupe/event dimension migrations are applied.
- D1 blocked lead submission migration is applied.
- Server duplicate policy and blocked-history API are deployed.
- Hosted route QA confirms lead/event public writes and authenticated reads.
- Month-bounded CSV and paging exist.
- Basic stats summary route exists.

## Worker 3: Templates, Public Landing, Editor Preview

Main remaining work:

- Keep exactly three templates: personal rehabilitation consultation, mobile wedding invitation, real estate presale.
- Do not add more templates.
- Do not build non-editable HTML templates.
- Remove all public instructional/sample/usage-guide copy.
- Every visible section must remain editable through existing blocks.
- Make each template first viewport feel like a finished public service page, not a builder demo.
- Personal rehabilitation: trust, eligibility, debt situation, consultation benefit, compliant wording, form, FAQ, bottom CTA. No guaranteed approval/outcome wording.
- Mobile wedding invitation: names, date, venue/map, gallery, RSVP, message, subtle premium effects. Effects must look intentional and not block text.
- Real estate presale: project name, location, premium points, type/benefit, gallery/image emphasis, visit reservation, map, FAQ, bottom CTA.
- Continue editor live-preview fixes for text color, font, background, underline, premium effects, scroll behavior, topnav fit, CTA chips, map/gallery/form overlap.
- Cards block remains 1 or 2 columns only.
- Premium effects must be subtle, randomized, image-overlay aware, and non-blocking.

Done baseline, do not repeat:

- Template count is 3.
- Template structural QA passes.
- Production browser QA covers the three first-viewport cases.
- Style color/font/rich toolbar production QA passes.

## Worker 4: Settings, Managers, Ownership, Page Duplication, Admin

Main remaining work:

- Settings manager permissions must remain in normal project Settings for every client/admin project.
- Internal admin is route-only and must not appear in public workspace navigation.
- Manager permission UI must stay compact. Menu-level permission first, detailed permission only after expansion.
- Labels must be user-facing Korean: 보기, 편집, 소유권이전.
- Manager invite should create and copy invite link in one action after valid name/email.
- Invited manager must login/signup and load the invited project only if authenticated email matches invite email.
- Ownership transfer section should be collapsed and named 소유권이전.
- Transfer target must be selected from existing managers only.
- Transfer request goes to internal admin approval before completion.
- If a paid subscription exists later, transfer waits for billing period end or cancellation before completion.
- Page duplication is paid-only later. Template duplication is not needed.
- Page duplication must first open URL setup, not immediately copy.
- URL setup supports default provided domain slug and custom domain pending DNS state.
- Saved URL data should be domain-agnostic: domain type, slug, custom domain, domain status. Do not hard-code current Pages domain in records.
- Page duplication may copy page settings, blocks, style, form structure, CTA, effects, SEO basics.
- Page duplication must not copy leads, stats, delivery logs, managers, ownership-transfer history, billing/subscription state, or audit history.
- Internal admin needs practical operator tools: user search, project search, ownership approval queue, suspend/restore, project pause/archive, abuse/blocked history review, audit log search.

Done baseline, do not repeat:

- Settings manager card exists.
- Ownership transfer route/API baseline exists.
- Page duplication URL modal baseline exists.
- Production browser QA covers manager settings, duplicate settings, page duplication modal, internal admin ownership queue.

## Worker 5: QA, Deploy, Live Integrations, Ops

Main remaining work:

- Keep production browser QA current as Workers 1-4 add visible behavior.
- Add browser QA cases for account settings, email verification UX, blocked-history panel, stats channel/device filters, and deeper template mobile behavior when implemented.
- Keep hosted route QA covering every production API added by Workers 1, 2, and 4.
- Keep D1 migration checks aligned with new migrations.
- Keep artifact cleanup safe. It must never delete source, migrations, config, or committed assets.
- Maintain release order docs: local QA, build, D1 migration, push, Pages deployment, hosted QA, production browser QA, live readiness.
- Live integrations still needing credentials: SMTP/email, OAuth/Google, conversion tracking accounts, webhook/CRM endpoint, optional live AI test with customer key.
- Email credential target is now AWS SES unless owner changes this decision.
- Required SES live checklist:
  - AWS account ready;
  - SES region selected;
  - sending domain selected;
  - SES domain identity verified;
  - DKIM records added;
  - SPF record added;
  - DMARC record added;
  - production access requested/approved if sandboxed;
  - Cloudflare Pages secrets added for SES access key/secret and sender;
  - live email QA run without exposing token to browser.
- Missing credentials must remain `skipped-live`, not false failure.
- Add rollback/backup runbook for D1 schema changes and Pages deployment rollback.
- Add custom domain readiness checklist: DNS instructions, verification status, SSL status, route binding.

Done baseline, do not repeat:

- Latest deployment passed.
- D1 migrations were applied.
- Hosted API/route QA passed.
- Production browser QA passed with Settings next cases included.

## Final Phase: Billing And Plans

Do this last.

- Plans under the 9,900 KRW ceiling: 3,300 / 6,600 / 9,900.
- Server-side feature limits: pages, page duplication, monthly leads, stats retention, managers, custom domain, conversion tracking.
- Payment provider abstraction first.
- Toss Payments or selected provider implementation after abstraction.
- Checkout, billing key/card registration, subscription renewal, cancel-at-period-end, payment failure, grace period.
- Webhook signature verification and idempotency before accepting payment state changes.
- Payment history and receipt/invoice link storage.
- Admin manual billing override with audit log.
- Payment secrets server-only.
