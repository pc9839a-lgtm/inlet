# Pagero Remaining Patches

Updated: 2026-08-02 11:41 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Latest main: `2623e8122ac8fde2b544645aabbbb42c0d0d4077`

Current candidate: PR `#41` / `agent/custom-domain-foundation`

Other open candidates:

- PR `#43` / `agent/admin-audit-hardening`
- PR `#42` / `agent/account-page-limit-production-verification`

Recently merged:

- PR `#44` / three-template mobile interaction and regression patch
- merge commit `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`

Current execution mode: parallel patching is active

Code completion, QA completion, merge, deployment, migration, environment configuration, and production verification are separate states. Branch-only, mock-only, screenshot-only, or `skipped-live` results are not production completion.

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
- Fifteen-minute manual-secret GitHub Actions recheck workflow.
- Missing secret returns `skipped-live`, never false success.
- Detach and reconnect reset stale failure state.

### Public routing and Settings UI

- Active custom-domain root requests resolve to their D1-owned landing page.
- Unknown or inactive custom domains return a noindex 404.
- Pagero, pages.dev, call.pagero.kr, API, and asset routing retain existing behavior.
- Settings supports Pagero address versus custom domain, status, SSL, DNS, manual recheck, detach, and owner-only changes.
- Protected production-home files and C63 assets are unchanged.

## Latest Main Integration Complete

- Original PR head: `bbd717aae1b7dc1a496195808d1359b0ef4c9b05`
- Integrated latest main: `2623e8122ac8fde2b544645aabbbb42c0d0d4077`
- Integration commit: `6e6a00cdb2e4311bea488915682a5f5027c2cd38`
- PR `#44` mobile gallery, consent, Korean-font regression, and QA workflow files are preserved.
- Latest Cloudflare deployment-record files are preserved.
- `package.json` and `scripts/qa-all.mjs` register both custom-domain and mobile-template QA.
- PR `#41` is open, ready, and mergeable against current `main`.

## QA Complete

Integration head `6e6a00cdb2e4311bea488915682a5f5027c2cd38` passed workflow run `30729439100`:

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

## Not Complete

- PR `#41` merge to `main`: not completed.
- Production migrations `0006_page_domains.sql` and `0007_page_domain_operations.sql`: not applied.
- Cloudflare production account, project, token, CNAME target, and recheck secret: not configured or verified.
- Production deployment: not completed.
- Real test-domain DNS and SSL activation: not completed.
- Real custom-domain form, reservation, conversion, detach, and reconnect verification: not completed.

Do not describe PR `#41` as production complete until migrations, environment configuration, merge, deployment approval, and real-domain verification are all complete.

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
- Custom-domain implementation and latest-main integration completed on open PR `#41`.

# Other Open Checkpoints

## PR #43 — Administrator And Audit Operations

- Latest-main integration and automated QA: complete.
- Production audit secrets and disposable fixtures: not configured.
- Merge, deployment, and three-phase `verified-live`: not completed.

## PR #42 — One-Page Policy Production Verification

- Latest-main integration and automated QA: complete.
- Six disposable fixtures and signed sessions: not configured.
- Merge and `verified-live`: not completed.

# Active Remaining Patches

## Priority 1 — Administrator And Audit Production Rollout

1. Configure production audit hash and retention secrets.
2. Prepare disposable account and `qa-audit-` page fixtures.
3. Merge PR `#43` after final conflict and QA verification.
4. Deploy only after explicit owner approval.
5. Run read-only, email-token request, and verify-live phases.
6. Confirm no raw passwords, tokens, sessions, emails, IPs, or User-Agent values in D1 audit rows.

## Priority 2 — One-Page Policy Live Verification

1. Prepare six disposable account fixtures and signed sessions.
2. Merge PR `#42` after final conflict and QA verification.
3. Run the manual workflow with explicit write approval.
4. Require `verified-live` and confirm all `qa-limit-*` pages are removed.

## Priority 3 — Custom-Domain Operational Rollout

1. Back up production D1.
2. Apply `0006_page_domains.sql`.
3. Apply `0007_page_domain_operations.sql`.
4. Configure `INLET_CLOUDFLARE_ACCOUNT_ID`.
5. Configure `INLET_CLOUDFLARE_PAGES_PROJECT`.
6. Configure least-privilege `INLET_CLOUDFLARE_API_TOKEN` with Pages Edit access.
7. Configure `INLET_CUSTOM_DOMAIN_CNAME_TARGET`.
8. Configure `INLET_DOMAIN_RECHECK_SECRET` and matching GitHub `PAGERO_DOMAIN_RECHECK_SECRET`.
9. Merge PR `#41` only after migration and environment ordering is safe.
10. Deploy only after explicit owner approval.
11. Verify test-domain ownership, DNS, SSL, routing, assets, forms, reservations, tracking, detach, reconnect, retry, and escalation.

## Priority 4 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets OAuth, token refresh, row delivery, disconnect, retry, and dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.

## Priority 5 — Product And Operations Hardening

- D1 backup and migration rollback evidence.
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
