# Pagero Remaining Patches

Updated: 2026-08-01 21:35 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#43` / `agent/admin-audit-hardening`

Other open candidates:

- PR `#42` / `agent/account-page-limit-production-verification`
- PR `#41` / `agent/custom-domain-foundation`

Current execution mode: parallel patching is active

This file separates code completion, QA completion, merge, deployment, and production verification. A branch-only or mock-only result is not production completion.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow
5. Worker 5: QA, deployment, live integration readiness, docs and ops

## Compatibility Labels Retained For QA Contracts

These labels remain because integration QA uses them as execution-contract markers:

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

# Current Patch Checkpoint — PR #43

## Completed In Branch

- Added shared platform-master authorization for `/api/admin/*`.
- Removed administrator access based only on forged role strings such as `superadmin` or `serviceadmin`.
- Preserved the secret-protected scheduled custom-domain recheck route used by PR `#41`.
- Added non-blocking D1 audit writes for signup, login, verification request, profile change, and account-status change.
- Added success and classified failure audit events without storing passwords, tokens, sessions, Authorization headers, or cookies.
- Replaced raw IP and User-Agent storage with HMAC-SHA256 fingerprints.
- Added `GET /api/admin/audit` with query, action, actor, project, target type, date, cursor, and limit filters.
- Excluded raw IP and raw User-Agent from administrator audit responses.
- Added no audit-log update or deletion API.
- Added `admin:audit:qa` and registered it in `qa:all`.
- Added `docs/ops-admin-audit-log.md`.
- Protected production-home file changes: none.

## Validation State

- Targeted admin audit QA: complete.
- Authentication QA: complete.
- Authentication email QA: complete.
- Pages Functions QA: complete.
- API security QA: complete.
- Build and deployment-artifact build: complete.
- First full QA run: implementation checks passed; final integration step failed because this backlog still contained the outdated pre-parallel text.
- Backlog contract correction: complete in this commit.
- Full QA rerun: pending.
- Landing browser regression: pending after full QA rerun.
- Authenticated editor browser regression: pending after full QA rerun.
- Form and reservation browser regression: pending after full QA rerun.
- PR `#43` merge to `main`: not completed.
- Production deployment: not completed.
- Production administrator/audit verification: not completed.

Do not describe PR `#43` as production complete until it is merged, deployed with explicit owner approval, and verified with one allowed platform-master account plus one denied general account.

# Other Open Checkpoints

## PR #42 — One-Page Policy Production Verification

- General-account one-active-page implementation is already merged through PR `#40`.
- Live verification script, manual workflow, cleanup, Google-account quota, and manager bypass coverage are complete in PR `#42`.
- Full QA and browser regressions passed on that branch.
- Merge to `main`: not completed.
- Six disposable production fixtures and signed sessions: not configured or verified.
- Manual workflow result `verified-live`: not completed.
- Production verification status: not verified live.

## PR #41 — Custom Domain

- Domain ownership, DNS, SSL, provider registration, routing, retries, escalation, operator list, scheduled recheck, and runbook are code/QA complete on the branch.
- Merge to `main`: not completed.
- Production D1 migrations `0006` and `0007`: not completed.
- Cloudflare production environment configuration: not completed.
- Production deployment and real customer-domain smoke test: not completed.

# Absolute Rules

## Production Home Is Frozen

Do not change the visible production home unless the owner explicitly requests it. Protected scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

## General Account Page Policy

- General account: one active landing page.
- Platform master: unlimited landing pages.
- Frontend and API enforcement both remain mandatory.
- Role-string forgery must not bypass account or administrator policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived/deleted projects do not consume the active-page quota.
- Google-login accounts follow the same policy.
- Manager/member access cannot create another owner page.
- Default platform-master emails plus `INLET_PLATFORM_MASTER_EMAILS` are the only approved account and administrator bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The former 3,300원 / 6,600원 / 9,900원 three-tier direction is discarded. Do not add a third paid plan or invent Classic/Pro entitlements before owner approval.

## Deployment

- Never force-push `main`.
- Do not construct a release with destructive reset, clean, or restore operations.
- Keep unrelated refactors out of focused patches.
- Run targeted QA and the full required suite before merge or deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations; template duplication is not needed.
- Login, account, and member management foundations.
- General-account one-page policy and platform-master unlimited policy.
- Save identity, revision conflict, draft recovery, and page-switch isolation.
- Three active templates only: personal rehabilitation, mobile wedding invitation, and real estate presale.
- Public landing, authenticated editor, and form/reservation browser regression infrastructure.
- AWS SES and Google Sheets integration foundations.
- Deployment route smoke contracts.

# Active Remaining Patches

## Priority 1 — Complete PR #43 Validation

1. Require the refreshed full QA run to pass.
2. Require landing, authenticated-editor, and form/reservation browser jobs to pass.
3. Confirm no protected production-home file changed.
4. Mark PR `#43` ready for review only after all checks pass.
5. Do not merge or deploy without an explicit owner action.
6. After deployment, verify:
   - ordinary account receives 403 from `/api/admin/summary` and `/api/admin/audit`
   - forged `superadmin` role also receives 403
   - approved platform-master receives 200
   - signup/login/profile/status events appear in D1
   - audit responses expose no raw IP, User-Agent, password, token, or session

## Priority 2 — Execute One-Page Policy Live Verification

1. Prepare the six disposable fixtures documented by PR `#42`.
2. Store signed test sessions in GitHub Secrets.
3. Manually run the Account Page Limit Production Verify workflow with write approval.
4. Require `verified-live`, save the run/deployment/commit evidence, and confirm all `qa-limit-*` pages were removed.

## Priority 3 — Custom-Domain Operational Rollout

1. Apply production migrations `0006_page_domains.sql` and `0007_page_domain_operations.sql` in order.
2. Configure the Cloudflare account, Pages project, least-privilege API token, CNAME target, and recheck secret.
3. Merge PR `#41` only after migration and environment ordering is safe.
4. Deploy only after explicit owner approval.
5. Verify DNS, SSL, public routing, assets, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 4 — Remaining Admin And Audit Completeness

After PR `#43`, inspect and patch only confirmed gaps:

- password-change audit
- email-change workflow and audit
- account restoration audit
- manager invite, acceptance, permission change, and removal in Pages Functions
- ownership-transfer request, approval, rejection, cancellation, and completion
- project pause, archive, and restore
- platform-master manual action audit
- retention policy that preserves audit records from ordinary operator deletion
- internal route-only audit UI, never public workspace navigation

## Priority 5 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, password-reset, invite, and ownership-transfer messages.
- Google Sheets production OAuth, token refresh, row delivery, disconnect, and retry/dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.
- Never expose provider credentials, verification tokens, access tokens, or raw internal errors.

## Priority 6 — Three Template Mobile Final Regression

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify 360px, 390px, and 430px for finished first viewport, editable visible sections, no instructional copy, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ, preview/public parity, and reduced-motion-aware effects.

## Priority 7 — Product And Operations Hardening

- D1 backup and migration rollback evidence.
- Current operator release checklist.
- Retention and cleanup policy for logs, blocked submissions, delivery logs, and audit rows.
- Large-data inbox and stats query verification.
- Abuse/rate-limit visibility without raw IP exposure.
- Accessibility and keyboard regression for account, domain, and administrator UI.
- Previous-deployment rollback procedure.

# Plans, Payment, And Subscription, Final Phase

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Start only after the active operational priorities are stable and the owner defines the entitlement difference. Required architecture includes server-side entitlements, provider abstraction, checkout/billing key, renewal, period-end cancellation, grace period, signed and idempotent webhooks, payment history, receipts, and audited administrator override.

# Required QA Before Merge Or Deployment

```bash
npm run admin:audit:qa
npm run auth:qa
npm run auth:email:qa
npm run api:functions:qa
npm run api:security:qa
npm run qa:all
npm run build
npm run deployment:qa
npm run deployment:smoke:contract:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
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
6. Do not claim production completion from branch-only, mock-only, or `skipped-live` results.
