# Pagero Remaining Patches

Updated: 2026-08-01 12:29 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#41` / `agent/custom-domain-foundation`

This document must be updated at the end of every patch. Code completion, QA
completion, merge, deployment, and production verification are separate states.
A patch is not fully complete until the state written here matches reality.

## Current Patch Checkpoint

### Custom-domain workflow

- Code: complete on PR `#41`.
- Targeted QA: complete.
- Full offline QA: complete.
- Landing browser regression: complete.
- Authenticated editor browser regression: complete.
- Form and reservation browser regression: complete.
- Pull request: open and ready for review.
- Merge to `main`: not completed.
- Production D1 migration: not completed.
- Production Cloudflare environment configuration: not completed.
- Production deployment: not completed.
- Real customer-domain smoke test: not completed.

The custom-domain implementation must therefore be described as **code and QA
complete, operational rollout remaining**. Do not describe it as production
complete.

## Source Of Truth Order

1. `AGENTS.md`
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
3. `docs/PAGERO_PLAN_POLICY_KO.md`
4. This document
5. Task-specific handoff documents
6. Current `main` code and recent commits
7. Old worker documents as historical context only

## Compatibility Labels Retained For QA Contracts

- Production account/session hardening
- Customer-owned AI key storage
- D1 real runtime smoke and write-side migration
- Add lead duplicate and spam policy
- Page duplication and URL setup
- Expanded Launch Backlog
- Login, account, and member management
- Plans, payment, and subscription, final phase
- Do not reassign these
- Required command references: `deployment:qa`, `npm run live:qa`

# Absolute Rules

## Production Home Is Frozen

Unless the owner explicitly requests a production-home change, do not modify the
visible design, copy, section order, menu, footer, hero, animation, login/start
behavior, or responsive result of `https://pagero.kr/`.

Protected scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root and public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

The custom-domain patch may add hostname-aware middleware routing, but it must
not change the `pagero.kr`, `pages.dev`, or `call.pagero.kr` production-home
result.

## General Account Page Limit Must Stay Enforced

- A general account may own and create one active landing page only.
- Platform-master accounts may create unlimited landing pages.
- Enforcement must remain in frontend controls and the server/API boundary.
- Forged role strings must not bypass the limit.
- Existing pages must remain editable and publishable.
- Archived or deleted projects must not create a false active-page count.
- Default platform-master emails and `INLET_PLATFORM_MASTER_EMAILS` are the only approved bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The old 3,300원 / 6,600원 / 9,900원 direction is discarded. Do not add a third
paid plan. Plan feature entitlements remain undecided until the owner explicitly
defines them.

## Page Sharing Must Stay Separate From Bottom Bar

- Global sharing state uses `page.share`.
- Public and preview sharing use the independent share-button flow.
- Do not restore `bottombar.s.shareEnabled`.
- Share URLs must use the public page URL, not editor or dashboard URLs.

## Deployment Rules

- Never force-push `main`.
- Do not use destructive reset, clean, or restore operations to construct a release.
- Do not mix unrelated refactors into a functional patch.
- Run targeted QA and the full suite before deployment.
- Verify desktop and 360px, 390px, and 430px visible behavior when UI changes.
- Production deployment requires explicit owner approval.

# Completed Baseline — Reopen Only After Reproducing A Regression

## Account And Page Policy

- General-account one-page policy model.
- Platform-master policy and session persistence.
- Server-side `ACCOUNT_PAGE_LIMIT_REACHED` enforcement.
- Frontend creation-control lock state.
- Existing-page replay and update allowance.
- Dedicated and full-suite regression QA.

## Editor And Public Landing Baseline

- Top navigation supports one through eight menu items.
- Native sharing and clipboard fallback.
- Four persisted share positions.
- Form-focus collision handling.
- Three timer layouts and bottom-timer inheritance.
- Shared countdown clock.
- Fixed UI collision and viewport regression coverage.
- Account-scoped draft recovery and delayed-save isolation.
- Image orientation, resize, compression, and deduplication.
- Consultation and reservation browser regression.
- Server-backed blocked-submission history and month-bounded CSV.
- AWS SES and Google Sheets integration foundations.

## Custom-Domain Code And QA Baseline — PR #41

The following implementation exists on PR `#41` and passed the required QA:

- `page_domains` D1 ownership and lifecycle schema.
- Server-side hostname validation and duplicate ownership protection.
- New connections forced to trusted server state instead of client-forged active state.
- Cloudflare Pages custom-domain lookup, registration, and deletion client.
- DNS JSON CNAME inspection.
- Mapping of Cloudflare provider, verification, and SSL status.
- D1 domain state and `pages.page_json` synchronization.
- Page settings UI for default and personal domain selection.
- Manual `연결 상태 확인` action.
- Detach flow when returning to the default Pagero address.
- Active custom-host `/` routing to the owning customer landing page.
- `noindex` 404 response for unregistered or inactive custom hosts.
- Existing Pagero, Pages preview, CallTag, API, and static-asset routing preservation.
- Dedicated `page:domain:qa` registered in `qa:all`.

This baseline does not mean the feature is deployed. The rollout items below
remain active.

# Active Remaining Patches

Proceed in this order unless the owner explicitly changes priority.

## Priority 1 — Custom-Domain Operational Rollout

### Required before merge or production deployment

1. Apply `migrations/0006_page_domains.sql` to the production D1 database.
2. Confirm the migration against the actual production schema and record rollback steps.
3. Set `INLET_CLOUDFLARE_ACCOUNT_ID`.
4. Set `INLET_CLOUDFLARE_PAGES_PROJECT`.
5. Set `INLET_CLOUDFLARE_API_TOKEN` with the minimum required Pages custom-domain edit permission.
6. Set `INLET_CUSTOM_DOMAIN_CNAME_TARGET` to the actual Pages target hostname.
7. Keep all provider credentials server-only.
8. Merge PR `#41` only after the migration and environment-value order is safe.
9. Deploy only after explicit owner approval.

### Required live verification

- Connect a real subdomain and confirm `pending → verifying → active`.
- Confirm Cloudflare SSL reaches active state.
- Confirm the custom-domain root displays the correct customer landing, not the Pagero home.
- Confirm forms, reservations, tracking, and public assets work on the custom host.
- Confirm an inactive or unowned host returns the `noindex` 404 page.
- Confirm switching back to the Pagero address detaches the Cloudflare domain.
- Confirm reconnecting the same domain works after detach.
- Confirm another page cannot claim an already connected hostname.
- Confirm apex/root-domain behavior where CNAME flattening is used.
- Confirm public URL, share URL, preview URL, and canonical behavior do not diverge.

### Still-unimplemented operational follow-ups

- Operator list for failed or long-stuck domain verification.
- Automatic scheduled recheck for domains left in pending or verifying state.
- Retry and escalation policy for provider timeout or transient failure.
- Support runbook for detach, reconnect, rollback, and incorrect DNS records.

## Priority 2 — One-Page Policy Production Verification

The implementation is complete, but production evidence must still be recorded.

- New general account creates its first page.
- General account with one active page cannot create a second from the dashboard.
- Direct API creation returns `409 / ACCOUNT_PAGE_LIMIT_REACHED`.
- Existing page save, revision, restore, preview, and publish remain functional.
- Platform-master account creates multiple pages.
- Platform-master state survives logout/login and session refresh.
- Google-login accounts follow the same policy.
- Archived/deleted projects do not create a false count.
- Manager or member paths cannot create a second owner page.

Do not weaken the server limit to fix a frontend display issue.

## Priority 3 — Admin And Audit Completeness Review

Inspect the current implementation first and patch only confirmed gaps.

- Signup and verification audit rows.
- Classified login failures without secret exposure.
- Password, name, email, and phone changes.
- Account suspension, restoration, and deletion-state changes.
- Manager invite, acceptance, permission change, and removal.
- Ownership-transfer request through completion.
- Project pause, archive, and restore actions.
- Platform-master manual actions.
- Search and filter by account, project, action, actor, and date.
- Protection against silent audit deletion through normal operator actions.

The internal admin surface remains route-only and must not appear in public
workspace navigation.

## Priority 4 — Live Integration Production Verification

Do not reimplement foundations already present.

### AWS SES

- Domain identity, DKIM, SPF, and DMARC.
- Production access if the account is sandboxed.
- Real signup verification, password reset, manager invite, and ownership-transfer email.
- Generic user-facing errors and classified internal errors.

### Google Sheets

- Production OAuth redirect URI.
- Token refresh after expiry.
- Real lead-row delivery with submitted-field headers.
- Disconnect immediately stops future delivery.
- Retry and failed-delivery visibility.

### Tracking and live checks

- Real conversion event receipt where configured.
- Missing credentials reported as `skipped-live`, not false completion.
- No provider credentials, tokens, or raw internal errors exposed to the browser.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly these templates:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify at 360px, 390px, and 430px:

- Finished first viewport, not a builder demo.
- No instructional or placeholder copy in public output.
- Every visible section remains editable through existing blocks.
- No overlap among navigation, hero, share, form, timer, and bottom fixed UI.
- Mobile keyboard does not hide fields or submission controls.
- Gallery, map, FAQ, and form interactions remain usable.
- Preview and public output remain aligned.
- Effects remain intentional and motion-reduction aware.

Personal-rehabilitation copy must not guarantee approval or legal outcome.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback procedure.
- Current operator release checklist.
- Retention and cleanup policy for logs, blocked submissions, delivery logs, and audit rows.
- Large-data inbox and stats query verification.
- Abuse and rate-limit visibility without exposing raw IP addresses.
- Accessibility and keyboard regression for account, domain, and admin UI.
- Previous-deployment rollback procedure.

# Final Phase — Plans, Billing, And Subscription

Start only after Priorities 1 through 6 are stable.

Exactly two paid products remain approved:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Before checkout implementation, the owner must define the difference between
Classic and Pro. Do not invent limits for pages, duplication, leads, statistics,
managers, domains, tracking, or integrations.

Required architecture after entitlements are approved:

- Server-side entitlement enforcement.
- Payment-provider abstraction.
- Owner-selected provider integration.
- Checkout and billing-key/card registration.
- Renewal and cancel-at-period-end.
- Payment-failure grace period.
- Webhook signature verification and idempotency.
- Payment history and receipt links.
- Admin override with audit logging.

# Mandatory Closeout For Every Future Patch

Before the final user response for every patch:

1. Update the timestamp and current branch, PR, or commit in this document.
2. Record code, QA, merge, deployment, and production-verification states separately.
3. Move completed implementation into the completed baseline.
4. Remove completed items from active priorities.
5. Reorder the remaining priorities.
6. Record exact blockers, required owner decisions, migrations, and environment values.
7. Commit this document in the same branch or PR as the patch.
8. Include the refreshed remaining-patch list in the final response.

A final response that says a patch is complete without this document update is
an incomplete patch closeout.

# Required Verification Commands

Use the relevant feature QA and the full release checks before production:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run deployment:smoke:contract:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:production:qa
npm run account:page-limit:qa
npm run page:domain:qa
npm run page:save:qa
npm run page:draft:qa
npm run page:operation:isolation:qa
npm run image:upload:qa
npm run preview:parity:qa
npm run bottom:fixed:qa
npm run timer:workflow:qa
npm run topnav:balance:qa
npm run live:qa
```

A skipped live check must identify the exact missing credential or external
approval. It must never be reported as completed live verification.
