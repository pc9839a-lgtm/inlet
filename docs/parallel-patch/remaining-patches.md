# Pagero Remaining Patches

Updated: 2026-08-01 12:40 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#41` / `agent/custom-domain-foundation`

Current execution mode: parallel patching is active

This document must be updated at the end of every patch. Code completion, QA completion, merge, deployment, and production verification are separate states. A patch is not fully complete until the state written here matches reality.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow
5. Worker 5: QA, deployment, live integration readiness, docs and ops

## Current Patch Checkpoint — Custom Domain

- Code: complete on PR `#41`.
- Targeted QA: complete.
- Full offline QA: complete.
- Landing browser regression: complete.
- Authenticated editor browser regression: complete.
- Form and reservation browser regression: complete.
- Closeout-document compatibility QA: complete.
- Pull request: open and ready for review.
- Merge to `main`: not completed.
- Production D1 migration: not completed.
- Production Cloudflare environment configuration: not completed.
- Production deployment: not completed.
- Real customer-domain smoke test: not completed.

The custom-domain implementation is **code and feature QA complete, operational rollout remaining**. Do not describe it as production complete.

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

Unless the owner explicitly requests a production-home change, do not modify the visible design, copy, section order, menu, footer, hero, animation, login/start behavior, or responsive result of `https://pagero.kr/`.

Protected scope:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root and public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Hostname-aware middleware may route customer domains, but it must not change the `pagero.kr`, `pages.dev`, or `call.pagero.kr` result.

## General Account Page Limit Must Stay Enforced

- General account: one active landing page.
- Platform-master account: unlimited pages.
- Frontend and API enforcement must both remain.
- Forged roles must not bypass the policy.
- Existing pages remain editable and publishable.
- Archived or deleted projects must not create a false count.
- Default platform-master emails and `INLET_PLATFORM_MASTER_EMAILS` are the only approved bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The old 3,300원 / 6,600원 / 9,900원 direction is discarded. Do not add a third paid plan. Do not invent plan entitlements before owner approval.

## Sharing And Deployment

- Global sharing uses `page.share` and remains separate from the bottom bar.
- Share URLs must use the public page URL, not editor or dashboard URLs.
- Never force-push `main`.
- Do not use destructive reset, clean, or restore operations to construct a release.
- Do not mix unrelated refactors into a patch.
- Run targeted QA and the full suite before deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Reopen Only After Reproducing A Regression

## Account, Editor, And Landing Baseline

- General-account one-page policy and platform-master bypass.
- `ACCOUNT_PAGE_LIMIT_REACHED` server enforcement and frontend creation lock.
- Existing-page replay, save, preview, and publish allowance.
- Top navigation for one through eight items.
- Native sharing and clipboard fallback with four persisted positions.
- Form-focus collision handling.
- Three timer layouts, bottom-timer inheritance, and shared countdown clock.
- Fixed UI collision regression coverage.
- Account-scoped draft recovery and delayed-save isolation.
- Image orientation, resize, compression, and deduplication.
- Consultation and reservation browser regression.
- Server-backed blocked-submission history and month-bounded CSV.
- AWS SES and Google Sheets integration foundations.

## Custom-Domain Code And QA Baseline — PR #41

- `page_domains` D1 ownership and lifecycle schema.
- Server hostname validation and duplicate ownership protection.
- Client-forged active and SSL state rejection.
- Cloudflare Pages domain lookup, registration, and deletion client.
- DNS JSON CNAME inspection.
- Provider, verification, and SSL state mapping.
- D1 and `pages.page_json` state synchronization.
- Default-address and personal-domain settings UI.
- Manual `연결 상태 확인` action.
- Detach when returning to the default Pagero address.
- Active customer-host `/` routing to the owning landing page.
- `noindex` 404 for unregistered or inactive customer hosts.
- Existing Pagero, Pages preview, CallTag, API, and static-asset routing preservation.
- Dedicated `page:domain:qa` registered in `qa:all`.

This baseline exists on PR `#41`; it is not yet production-deployed.

# Active Remaining Patches

## Priority 1 — Custom-Domain Operational Rollout

Before merge or deployment:

1. Apply `migrations/0006_page_domains.sql` to production D1.
2. Verify the actual schema and write rollback steps.
3. Set `INLET_CLOUDFLARE_ACCOUNT_ID`.
4. Set `INLET_CLOUDFLARE_PAGES_PROJECT`.
5. Set the minimum-permission Pages Edit token as `INLET_CLOUDFLARE_API_TOKEN`.
6. Set the real Pages target as `INLET_CUSTOM_DOMAIN_CNAME_TARGET`.
7. Keep credentials server-only.
8. Merge PR `#41` only after migration and environment ordering is safe.
9. Deploy only after explicit owner approval.

Live verification:

- Real subdomain reaches `pending → verifying → active`.
- SSL reaches active.
- Customer domain root shows the correct landing, not Pagero home.
- Forms, reservations, tracking, and assets work on the customer host.
- Inactive or unowned hosts return the `noindex` 404.
- Returning to the Pagero address detaches the provider domain.
- Reconnection works after detach.
- Another page cannot claim an occupied hostname.
- Apex/root-domain CNAME-flattening behavior works.
- Public, share, preview, and canonical URLs remain consistent.

Still unimplemented:

- Operator list for failed or long-stuck domain checks.
- Scheduled recheck for pending or verifying domains.
- Provider timeout retry and escalation policy.
- Support runbook for detach, reconnect, rollback, and bad DNS.

## Priority 2 — One-Page Policy Production Verification

- New general account creates the first page.
- A second dashboard creation is blocked.
- Direct API creation returns `409 / ACCOUNT_PAGE_LIMIT_REACHED`.
- Existing page save, revision, restore, preview, and publish remain functional.
- Platform-master creates multiple pages and survives session refresh.
- Google-login accounts follow the same policy.
- Archived/deleted projects do not create a false count.
- Manager or member paths cannot create a second owner page.

## Priority 3 — Admin And Audit Completeness Review

Patch only confirmed gaps after inspecting current code:

- Signup, verification, classified login failure, and profile/password changes.
- Account suspension, restoration, and deletion-state changes.
- Manager invite, acceptance, permission change, and removal.
- Ownership-transfer lifecycle.
- Project pause, archive, and restore.
- Platform-master manual actions.
- Search by account, project, action, actor, and date.
- Protection against silent audit deletion.

The internal admin surface remains route-only.

## Priority 4 — Live Integration Production Verification

AWS SES:

- Domain identity, DKIM, SPF, DMARC, and production access.
- Real verification, reset, invite, and ownership-transfer messages.
- Generic user errors and classified internal errors.

Google Sheets:

- Production OAuth redirect URI and token refresh.
- Real lead-row delivery with submitted-field headers.
- Disconnect immediately stops future delivery.
- Retry and failed-delivery visibility.

Also verify real conversion events and preserve `skipped-live` for missing credentials. Never expose provider secrets or raw errors.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify at 360px, 390px, and 430px: finished first viewport, no builder instructions, editable visible blocks, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ/forms, preview/public parity, and intentional motion. Personal-rehabilitation copy must not guarantee approval or legal outcome.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback.
- Current operator release checklist.
- Retention and cleanup policy for logs and audit data.
- Large-data inbox and stats query verification.
- Abuse visibility without raw IP exposure.
- Accessibility and keyboard regression for account, domain, and admin UI.
- Previous-deployment rollback procedure.

# Final Phase — Plans, Payment, And Subscription

Start only after Priorities 1 through 6 are stable.

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The owner must define the Classic/Pro entitlement difference before checkout work. Then implement server entitlements, provider abstraction, checkout/billing key, renewal, period-end cancellation, grace period, signed/idempotent webhooks, payment history, receipts, and audited admin override.

# Mandatory Closeout For Every Future Patch

Before the final user response:

1. Update timestamp and branch, PR, or commit.
2. Record code, QA, merge, deployment, and production-verification separately.
3. Move completed implementation into the baseline.
4. Remove completed items from active priorities.
5. Reorder the remaining priorities.
6. Record blockers, owner decisions, migrations, and environment values.
7. Commit this document in the same branch or PR.
8. Include the refreshed remaining-patch list in the final response.

A patch reported complete without this update is an incomplete closeout.

# Required Verification Commands

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

A skipped live check must identify the exact missing credential or external approval and must not be reported as completed live verification.
