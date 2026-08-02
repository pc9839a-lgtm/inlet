# Pagero Remaining Patches

Updated: 2026-08-02 10:25 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#42` / `agent/account-page-limit-production-verification`

Other open candidates:

- PR `#43` / `agent/admin-audit-hardening`
- PR `#41` / `agent/custom-domain-foundation`

Recently merged:

- PR `#44` / three-template mobile interaction and regression patch
- merge commit `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`

Current execution mode: parallel patching is active

Code completion, QA completion, merge, deployment, and production verification are separate states. Branch-only, mock-only, screenshot-only, or `skipped-live` results are not production completion.

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

# Current Patch Checkpoint — PR #42

## Code Complete

The one-active-page policy itself is already on `main`. PR `#42` adds a controlled production verification gate without changing the product policy.

Verified scenarios:

- A general account can create its first active page.
- A second direct API creation attempt returns `409 / ACCOUNT_PAGE_LIMIT_REACHED`.
- The existing page remains editable, revisionable, previewable, restorable, and publicly readable.
- Deleting or archiving the first project permits a replacement page.
- Archived projects do not consume the active-page quota.
- Platform-master accounts can create multiple pages and retain that ability after session refresh.
- Google-login accounts follow the same one-page quota.
- Manager/member sessions cannot bypass the owner quota.

Safety controls:

- Six disposable QA identities are required before live execution.
- `allow_writes=true` and `INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1` are both required.
- Missing fixtures or Secrets produce `skipped-live`, never false `verified-live`.
- `require_live=true` treats `skipped-live` as failure.
- Generated slugs are restricted to `qa-limit-*`.
- Cleanup runs in reverse order after success or failure.
- Workflow execution is manual only; no schedule is configured.
- Sessions are read from GitHub Secrets and are not written to evidence output.

Latest-main integration:

- PR `#44` mobile changes are preserved.
- `browser:templates-mobile:qa` and its contract remain registered.
- `account:page-limit:live` and `account:page-limit:live:contract:qa` are registered.
- PR `#42` now has latest `main` as a real second parent.
- Integrated head: `1f861167462c4495413e792f709e799dc7097d92`.
- Protected production-home files changed: none.

## QA Complete

Integrated head `1f861167462c4495413e792f709e799dc7097d92` passed workflow run `30726695162`:

- full offline QA
- account one-page policy QA
- production verifier safety-contract QA
- Google-login quota coverage
- manager/member bypass rejection coverage
- public landing browser regression
- authenticated editor browser regression
- form and reservation browser regression
- Korean-font three-template mobile browser regression
- production build and deployment artifact checks

## Not Complete

- PR `#42` merge to `main`: not completed.
- Production deployment: not completed.
- Six disposable production fixtures: not prepared or verified.
- Signed sessions in GitHub Secrets: not configured or verified.
- Manual workflow result `verified-live`: not completed.
- Cleanup evidence for every generated `qa-limit-*` page: not completed.

Do not describe the one-page production verification as complete until the manual workflow returns `verified-live` and all disposable pages are confirmed removed.

# Absolute Rules

## Production Home Is Frozen

Do not change the visible production home without an explicit owner request. Protected scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

## General Account And Administrator Policy

- General account: one active landing page.
- Platform master: unlimited landing pages and administrator API eligibility.
- Frontend and API enforcement are both mandatory.
- Forged role strings must not bypass page or administrator policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived projects do not consume the active-page quota.
- Google-login accounts follow the same policy.
- Manager/member access cannot create another owner page.
- Default platform-master emails plus `INLET_PLATFORM_MASTER_EMAILS` are the only approved bypass source.

## Active Templates Stay Exactly Three

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Do not add a fourth template. Personal rehabilitation copy must not guarantee approval or legal outcomes.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not restore the discarded 3,300원 / 6,600원 / 9,900원 direction. Do not add a third paid plan or invent entitlement differences before owner approval.

## Deployment

- Never force-push `main`.
- Do not use destructive reset, clean, or restore operations to construct a release.
- Do not mix unrelated refactors into a focused patch.
- Run targeted QA and the full suite before merge or deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations.
- Login, account, and member management foundations.
- General-account one-page and platform-master unlimited policies.
- Save identity, revision conflict, draft recovery, and page-switch isolation.
- Three active templates only.
- Public landing, authenticated editor, form/reservation, and mobile template browser regression infrastructure.
- Preview/public CSS parity and fixed-bottom collision contracts.
- PR `#44` mobile gallery, consent touch target, Korean-font screenshot, and 360/390/430px regression patch merged to `main`.
- Administrator authorization and audit implementation complete on open PR `#43`.
- One-page policy production verifier implementation complete on open PR `#42`.
- Custom-domain implementation and operations tooling complete on open PR `#41`.

# Open Checkpoints

## PR #43 — Administrator And Audit Operations

- Latest `main` conflict resolution: completed.
- Integrated head: `23d1f5773ba03931f2162d3eb84fe0d32942a5cd`.
- Workflow run `30726024143`: all five QA jobs passed.
- Merge to `main`: not completed.
- Production `INLET_AUDIT_HASH_SECRET`: not confirmed.
- Production `INLET_AUDIT_RETENTION_SECRET`: not confirmed.
- GitHub audit verification and retention Secrets: not confirmed.
- Disposable `qa-audit-` fixture account and page: not prepared.
- Real three-phase `verified-live`: not completed.

## PR #42 — One-Page Policy Production Verification

- Latest `main` conflict resolution: completed.
- Integrated head: `1f861167462c4495413e792f709e799dc7097d92`.
- Workflow run `30726695162`: all five QA jobs passed.
- Merge to `main`: not completed.
- Six disposable fixtures and signed sessions: not configured.
- Manual workflow result `verified-live`: not completed.

## PR #41 — Custom Domain

- Domain ownership, DNS, SSL, provider registration, routing, retries, escalation, operator list, scheduled recheck, and runbook are code/QA complete on the branch.
- Merge to `main`: not completed.
- Production D1 migrations `0006` and `0007`: not completed.
- Cloudflare account, Pages project, API token, CNAME target, and recheck secret: not configured or verified.
- Production deployment and real customer-domain smoke test: not completed.

# Active Remaining Patches

## Priority 1 — PR #43 Operational Readiness

PR `#43` has higher security value but remains blocked by production secrets and disposable fixtures.

1. Confirm production `INLET_AUDIT_HASH_SECRET`.
2. Confirm production `INLET_AUDIT_RETENTION_SECRET`.
3. Configure matching GitHub verification and retention Secrets.
4. Prepare a disposable password account and `qa-audit-` page.
5. Obtain explicit merge and deployment approval.
6. Merge and deploy.
7. Run read-only, request-email-token, and verify-live phases.
8. Require documented `verified-live` results.
9. Confirm audit rows contain no raw password, token, session, email-change address, manager email, IP, or User-Agent.

## Priority 2 — PR #42 Merge And Live Verification

PR `#42` is code- and QA-ready and has no production schema migration.

1. Confirm final head and all five QA jobs remain green.
2. Merge PR `#42` after explicit approval.
3. Prepare the six disposable fixtures documented by the runbook.
4. Store signed sessions in GitHub Secrets.
5. Run Account Page Limit Production Verify with explicit write approval.
6. Require `verified-live`.
7. Confirm every generated `qa-limit-*` page was removed.

## Priority 3 — PR #44 Real-Device Verification

The code is merged; deployment and device verification are separate.

1. Confirm whether the merge triggered an automatic Cloudflare deployment.
2. Deploy only with explicit approval if not already deployed.
3. Verify the three templates on real Android Chrome and Samsung Internet.
4. Check gallery controls, FAQ, map actions, keyboard, consent checkbox, reservation form, sharing, and bottom actions.
5. Record deployment SHA and device evidence.

## Priority 4 — Custom-Domain Operational Rollout

1. Apply `0006_page_domains.sql` and `0007_page_domain_operations.sql` in order.
2. Configure the Cloudflare account, Pages project, least-privilege API token, CNAME target, and recheck secret.
3. Integrate PR `#41` with the latest `main` after PR `#42` and PR `#43` decisions.
4. Run the full QA suite again.
5. Merge and deploy only with explicit approval.
6. Verify DNS, SSL, public routing, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 5 — Live Integration Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets OAuth, token refresh, row delivery, disconnect, retry, and dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback evidence.
- Current operator release checklist.
- Retention and cleanup for leads, blocked submissions, delivery logs, AI drafts, backups, and audit rows.
- Large-data inbox and stats query verification.
- Abuse/rate-limit visibility without raw IP exposure.
- Accessibility and keyboard regression for account, domain, and administrator UI.
- Previous-deployment rollback procedure.

# Plans, Payment, And Subscription, Final Phase

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Start only after operational priorities are stable and entitlement differences are explicitly approved. Required architecture includes server-side entitlements, provider abstraction, checkout/billing keys, renewal, period-end cancellation, grace period, signed and idempotent webhooks, payment history, receipts, and audited administrator overrides.

# Required QA Before Merge Or Deployment

```bash
npm run account:page-limit:qa
npm run account:page-limit:live:contract:qa
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

At the end of every patch:

1. Update the date, branch, PR, and checkpoint.
2. Separate code complete, QA complete, merged, deployed, and production verified.
3. Move completed implementation into the baseline.
4. Remove completed work from the active list.
5. Record missing migrations, credentials, approvals, and live evidence.
6. Do not claim production completion from branch-only, mock-only, screenshot-only, or `skipped-live` results.
