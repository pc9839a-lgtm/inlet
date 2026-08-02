# Pagero Remaining Patches

Updated: 2026-08-03 01:16 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Latest main: `d2f929769957bfd7aff1f01b6ac0d9769612ca97`

Current candidate: PR `#41` / `agent/custom-domain-foundation`

Required prerequisite:

- PR `#50` / `agent/pagero-d1-migration-safety`

Other open candidates:

- PR `#43` / `agent/admin-audit-hardening`
- PR `#42` / `agent/account-page-limit-production-verification`

Recently merged:

- PR `#44` / three-template mobile interaction and regression patch
- merge commit `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`

Current execution mode: parallel patching is active

Code completion, QA completion, merge, migration, deployment, environment configuration, and production verification are separate states. Branch-only, mock-only, screenshot-only, or `skipped-live` results are not production completion.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow
5. Worker 5: QA, deployment, live integration readiness, docs and ops

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
- `deployment:qa`
- `npm run live:qa`

# Current Patch Checkpoint — PR #41

## Code Complete

### Domain ownership and validation

- D1 `page_domains` ownership, provider, DNS, SSL, retry, and escalation state.
- Unique-domain ownership enforcement at the database and API boundaries.
- Path, port, IP, wildcard, and Pagero-owned host rejection.
- Client attempts to forge active or SSL-complete state are ignored; new connections start pending.
- Page archive and return-to-default-address flows synchronize domain detach state.

### Cloudflare Pages integration

- Pages custom-domain lookup, create, and delete operations.
- DNS JSON lookup and CNAME guidance.
- Provider status, verification data, and validation data mapping.
- Cloudflare active state as the final criterion for flattened apex domains.
- User-safe error states separated from operator diagnostics.

### Operations and recovery

- Platform-master domain operations list and filtering.
- Manual recheck and secret-protected scheduled recheck endpoint.
- Bounded 5, 15, 30, 60, 180, and 360 minute retry sequence.
- Retryable and non-retryable failure classification.
- Operator escalation after repeated or long-running failures.
- Fifteen-minute secret-protected GitHub Actions recheck workflow.
- Missing secret returns `skipped-live`, never false success.
- Detach and reconnect reset stale failure state.

### Public routing and Settings UI

- Active custom-domain root requests resolve to their D1-owned landing page.
- Unknown or inactive custom domains return a noindex 404.
- Pagero, pages.dev, call.pagero.kr, API, and asset routing retain existing behavior.
- Settings supports Pagero address versus custom domain, status, SSL, DNS, manual recheck, detach, and owner-only changes.
- Protected production-home files and C63 assets are unchanged.

## Migration Number Collision Resolved

- Latest `main` already contains `migrations/0006_calltag_pagero_lead_queue.sql`.
- That existing migration and its feature behavior are not modified by PR `#41`.
- Custom-domain base migration moved from `0006_page_domains.sql` to `0007_page_domains.sql`.
- Custom-domain operations migration moved from `0007_page_domain_operations.sql` to `0008_page_domain_operations.sql`.
- D1 schema QA, domain QA, domain operations QA, operations readiness, and the custom-domain runbook now use `0007/0008`.
- PR `#50` is the mandatory migration-safety prerequisite.

## Latest Main Compatibility

- Original integrated main: `2623e8122ac8fde2b544645aabbbb42c0d0d4077`.
- Current main: `d2f929769957bfd7aff1f01b6ac0d9769612ca97`.
- Current main-only additions do not overlap the custom-domain application files.
- `0006_calltag_pagero_lead_queue.sql` remains first and custom-domain migrations follow as `0007/0008`.
- PR `#44` mobile gallery, consent, Korean-font regression, and QA workflow files remain preserved.
- Protected production-home files remain unchanged.

## QA Status

Previous integration head `6e6a00cdb2e4311bea488915682a5f5027c2cd38` passed workflow run `30729439100`:

- full offline QA
- page-domain validation and duplicate ownership QA
- Cloudflare registration, DNS, and SSL status mapping QA
- D1 and page JSON synchronization QA
- domain operations, retry, escalation, and scheduled recheck QA
- public custom-domain routing and inactive-domain 404 QA
- public landing browser regression
- authenticated editor browser regression
- form and reservation browser regression
- Korean-font three-template mobile browser regression
- production build and deployment artifact checks

The migration-renumbering head requires a new full workflow result before PR `#41` can return to ready-for-review state.

## Not Complete

- PR `#50` merge to `main`: not completed.
- D1 migration-safety production secrets: not configured or verified.
- Read-only production D1 preflight: not completed.
- PR `#41` merge to `main`: not completed.
- Production migrations `0007_page_domains.sql` and `0008_page_domain_operations.sql`: not applied.
- Cloudflare production account, project, token, CNAME target, and recheck secret: not configured or verified.
- Production deployment: not completed.
- Real test-domain DNS and SSL activation: not completed.
- Real custom-domain form, reservation, conversion, detach, reconnect, retry, and escalation verification: not completed.

Do not describe PR `#41` as production complete until migration safety, exact pending-list review, encrypted backup, environment configuration, merge, deployment approval, and real-domain verification are all complete.

# Absolute Rules

## Production Home Is Frozen

Protected production-home scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Stop deployment if a protected-home file changes during unrelated work.

## General Account And Administrator Policy

- General account: one active landing page.
- Platform master: unlimited landing pages and administrator API eligibility.
- Frontend and API enforcement both remain mandatory.
- Role-string forgery cannot bypass page or administrator policy.
- Existing pages remain editable, revisionable, previewable, restorable, and public.
- Archived projects do not consume the active-page quota.
- Google-login and manager/member identities follow the same owner policy.

## Active Templates Stay Exactly Three

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

## Paid Plans Stay Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not restore the discarded three-plan pricing direction or invent entitlement differences without owner approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations.
- Login, account, and member management foundations.
- General-account one-page and platform-master unlimited policy.
- Three active templates and mobile regression infrastructure.
- PR `#44` gallery and consent mobile interaction patch merged to `main`.
- Administrator and audit implementation completed on open PR `#43`.
- One-page production verification implementation completed on open PR `#42`.
- Custom-domain implementation completed on open PR `#41`; production rollout remains incomplete.
- D1 migration safety implementation completed on draft PR `#50`; production use remains incomplete.

# Other Open Checkpoints

## PR #50 — D1 Migration Safety

- Manual-only preflight and backup-and-apply workflow: code complete.
- Exact pending-list gate, encrypted export, plaintext deletion, hashes, HMAC, Time Travel evidence, and no automatic restore: QA complete on branch.
- Merge, production secrets, `verified-live` preflight, encrypted production backup, and migration execution: not completed.

## PR #43 — Administrator And Audit Operations

- Latest-main integration and automated QA: complete.
- Production audit secrets and disposable fixtures: not configured.
- Merge, deployment, and three-phase `verified-live`: not completed.

## PR #42 — One-Page Policy Production Verification

- Latest-main integration and automated QA: complete.
- Six disposable fixtures and signed sessions: not configured.
- Merge and `verified-live`: not completed.

# Active Remaining Patches

## Priority 1 — D1 Migration Safety Prerequisite

1. Confirm PR `#50` remains conflict-free and all QA jobs are green.
2. Merge PR `#50` only with explicit owner approval.
3. Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `PAGERO_D1_BACKUP_ENCRYPTION_KEY` as GitHub Secrets.
4. Run manual read-only `D1 Migration Safety` preflight against the intended production `main` SHA.
5. Require `verified-live`, review local hashes and remote `d1_migrations`, and record the exact pending filename order.
6. Do not enable writes or apply migrations during this prerequisite step.

## Priority 2 — Custom-Domain Operational Rollout

1. Confirm the live preflight pending list is exactly the reviewed sequence. Expected custom-domain files are `0007_page_domains.sql,0008_page_domain_operations.sql` only when preflight reports exactly those.
2. Obtain separate explicit approval for `backup-and-apply`.
3. Create and validate the encrypted production D1 export before migration apply.
4. Apply `0007_page_domains.sql` and `0008_page_domain_operations.sql` through the guarded workflow.
5. Verify the applied migration history and retain the encrypted backup, manifest, rollback instructions, and Time Travel evidence.
6. Configure `INLET_CLOUDFLARE_ACCOUNT_ID`.
7. Configure `INLET_CLOUDFLARE_PAGES_PROJECT`.
8. Configure least-privilege `INLET_CLOUDFLARE_API_TOKEN` with Pages custom-domain edit access.
9. Configure `INLET_CUSTOM_DOMAIN_CNAME_TARGET`.
10. Configure `INLET_DOMAIN_RECHECK_SECRET` and matching GitHub `PAGERO_DOMAIN_RECHECK_SECRET`.
11. Merge PR `#41` only after final conflict and QA verification.
12. Deploy only after explicit owner approval.
13. Verify test-domain ownership, DNS, SSL, routing, assets, forms, reservations, tracking, detach, reconnect, retry, and escalation.

## Priority 3 — One-Page Policy Live Verification

1. Prepare six disposable account fixtures and signed sessions.
2. Merge PR `#42` after final conflict and QA verification.
3. Run the manual workflow with explicit write approval.
4. Require `verified-live` and confirm all `qa-limit-*` pages are removed.

## Priority 4 — Administrator And Audit Production Rollout

1. Configure production audit hash and retention secrets.
2. Prepare disposable account and `qa-audit-` page fixtures.
3. Merge PR `#43` after final conflict and QA verification.
4. Deploy only after explicit owner approval.
5. Run read-only, email-token request, and verify-live phases.
6. Confirm no raw passwords, tokens, sessions, emails, IPs, or User-Agent values in D1 audit rows.

## Priority 5 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets OAuth, token refresh, row delivery, disconnect, retry, and dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.

## Priority 6 — Product And Operations Hardening

- Lead, blocked-submission, delivery-log, AI-draft, backup, and audit retention policy.
- Large-data inbox, stats, CSV, domain operations, and audit search verification.
- Accessibility and keyboard regression for account, domain, and administrator UI.
- Previous-deployment rollback procedure.

# Plans, Payment, And Subscription, Final Phase

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Start only after active operational priorities are stable and the owner defines the entitlement difference.

# Required QA Before Merge Or Deployment

```bash
npm run page:domain:qa
npm run page:domain:ops:qa
npm run d1:schema:qa
npm run ops:qa
npm run browser:templates-mobile:contract:qa
npm run qa:all
npm run build
npm run deployment:qa
npm run deployment:smoke:contract:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
npm run browser:production:qa
npm run live:qa
```

# Mandatory Closeout

1. Update date, branch, PR, and checkpoint.
2. Separate code complete, QA complete, merged, migrated, deployed, and production verified.
3. Move completed implementation into the baseline.
4. Remove completed work from the active list.
5. Record missing migrations, credentials, approvals, and live evidence.
6. Never claim production completion from branch-only, mock-only, screenshot-only, or `skipped-live` results.
