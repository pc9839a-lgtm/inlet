# Pagero Remaining Patches

Updated: 2026-08-03 01:16 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Latest main: `d2f929769957bfd7aff1f01b6ac0d9769612ca97`

Current candidate: draft PR `#41` / `agent/custom-domain-foundation`

Required prerequisite: draft PR `#50` / `agent/pagero-d1-migration-safety`

Other open candidates:

- PR `#42` / `agent/account-page-limit-production-verification`
- PR `#43` / `agent/admin-audit-hardening`

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
- `deployment:qa`
- Do not reassign these
- `npm run live:qa`

# Current Patch — PR #41 Custom Domain

## Code Complete

- D1 `page_domains` ownership and duplicate-hostname prevention.
- Domain input validation for paths, ports, IPs, wildcards, and Pagero-owned hosts.
- Cloudflare Pages custom-domain lookup, registration, deletion, DNS inspection, and SSL state mapping.
- Active custom-host `/` routing to the owning public landing page.
- Unknown or inactive custom hosts return noindex 404.
- Settings UI for Pagero address, custom domain, DNS instructions, status verification, and detach.
- Operator domain list, manual recheck, scheduled recheck, retry, terminal failure, and escalation.
- Existing public home, three templates, general-account one-page rule, and paid-plan policy remain unchanged.

## Migration Collision Fixed

Latest `main` already contains:

- `migrations/0006_calltag_pagero_lead_queue.sql`

PR `#41` does not modify that migration or its feature behavior. Custom-domain migrations now follow it:

1. `migrations/0007_page_domains.sql`
2. `migrations/0008_page_domain_operations.sql`

Removed superseded files:

- `migrations/0006_page_domains.sql`
- `migrations/0007_page_domain_operations.sql`

Updated references:

- `scripts/d1-schema-quality-check.mjs`
- `scripts/page-domain-quality-check.mjs`
- `scripts/page-domain-operations-quality-check.mjs`
- `scripts/ops-readiness-check.mjs`
- `docs/ops-custom-domain-runbook.md`

## QA Complete

Current head: `d2bc3e91b7c359d83ca3bd8e369db144f7649502`

Workflow run: `30756621186`

All five jobs passed:

- full offline QA, including D1 schema, custom-domain, retry/escalation, operations docs, build, bundle, accessibility, and deployment artifact checks
- public landing real-browser regression
- authenticated editor real-browser regression
- consultation and reservation real-browser regression
- Korean-font three-template mobile real-browser regression

PR `#41` remains mergeable but intentionally stays Draft because PR `#50` and production preflight are unresolved.

## Not Complete

- PR `#50` merge: not completed.
- Migration-safety GitHub Secrets: not configured or verified.
- Production D1 read-only preflight: not completed.
- PR `#41` merge: not completed.
- Production migrations `0007_page_domains.sql` and `0008_page_domain_operations.sql`: not applied.
- Cloudflare production account, Pages project, token, CNAME target, and recheck secret: not configured or verified.
- Production deployment: not completed.
- Real test-domain DNS, SSL, form, reservation, analytics, detach, reconnect, retry, and escalation verification: not completed.

# Absolute Rules

## Production Home Is Frozen

Protected production-home scope:

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

## Account Policy

- General account: one active landing page.
- Platform master: unlimited landing pages and administrator API eligibility.
- Frontend and API enforcement both remain mandatory.
- Role-string forgery cannot bypass policy.
- Existing pages remain editable, revisionable, previewable, restorable, and public.

## Active Templates Stay Exactly Three

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

## Paid Plans Stay Exactly Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not invent a third plan or entitlement differences without owner approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations.
- Login, account, and member management foundations.
- General-account one-page and platform-master unlimited policy.
- Three active templates and mobile regression infrastructure.
- PR `#44` mobile gallery and consent patch merged to `main`.
- Custom-domain code and migration-number fix complete on draft PR `#41`.
- D1 migration-safety code complete on draft PR `#50`.
- One-page live verifier complete on open PR `#42`.
- Administrator and audit operations complete on open PR `#43`.

# Active Remaining Patches

## Priority 1 — D1 Migration Safety

1. Confirm PR `#50` remains conflict-free and green.
2. Merge PR `#50` only with explicit owner approval.
3. Configure `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, and `PAGERO_D1_BACKUP_ENCRYPTION_KEY` as GitHub Secrets.
4. Run manual read-only `D1 Migration Safety` preflight against the intended production `main` SHA.
5. Require `verified-live` and inspect remote `d1_migrations`, local hashes, and exact pending order.
6. Do not enable writes during preflight.

## Priority 2 — Custom-Domain Rollout

1. Continue only when live preflight reports the exact reviewed pending list. Expected custom-domain files are `0007_page_domains.sql,0008_page_domain_operations.sql` only when preflight reports exactly those.
2. Obtain separate owner approval for `backup-and-apply`.
3. Create and validate the encrypted D1 export before applying migrations.
4. Apply migrations through `D1 Migration Safety` and verify remote history afterward.
5. Retain encrypted backup, manifest, rollback instructions, hashes, HMAC, and Time Travel evidence.
6. Configure Cloudflare Pages domain environment values and matching recheck secret.
7. Merge PR `#41` after final conflict and QA verification.
8. Deploy only after explicit owner approval.
9. Verify a controlled real domain end to end.

## Priority 3 — One-Page Policy Live Verification

1. Prepare six disposable account fixtures and signed sessions.
2. Merge PR `#42` after final conflict and QA verification.
3. Run the manual workflow with explicit write approval.
4. Require `verified-live` and confirm all `qa-limit-*` pages are removed.

## Priority 4 — Administrator And Audit Rollout

1. Configure audit hash and retention secrets.
2. Prepare disposable account and `qa-audit-` page fixtures.
3. Merge PR `#43` after final conflict and QA verification.
4. Deploy only after explicit owner approval.
5. Run all production verifier phases and confirm sensitive raw data is absent from audit rows.

## Priority 5 — Live Integrations And Hardening

- SES identity, DKIM, SPF, DMARC, and live authentication emails.
- Google Sheets OAuth, refresh, row delivery, disconnect, retry, and dead-letter visibility.
- Conversion events where configured.
- Retention, cleanup, accessibility, large-data, and previous-deployment rollback checks.

# Plans, Payment, And Subscription, Final Phase

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Start only after operational priorities are stable and the owner defines entitlement differences.

# Required QA Before Merge Or Deployment

```bash
npm run page:domain:qa
npm run page:domain:ops:qa
npm run d1:schema:qa
npm run ops:qa
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

1. Update date, branch, PR, commit, and workflow evidence.
2. Separate code complete, QA complete, merged, migrated, deployed, and production verified.
3. Remove completed work from active priorities.
4. Record missing migrations, credentials, approvals, and live evidence.
5. Never claim production completion from branch-only, mock-only, screenshot-only, or `skipped-live` results.
