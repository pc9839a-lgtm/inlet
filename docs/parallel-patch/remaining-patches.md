# Pagero Remaining Patches

Updated: 2026-08-01 21:51 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#43` / `agent/admin-audit-hardening`

Other open candidates:

- PR `#42` / `agent/account-page-limit-production-verification`
- PR `#41` / `agent/custom-domain-foundation`

Current execution mode: parallel patching is active

Code completion, QA completion, merge, deployment, and production verification are separate states. Branch-only, mock-only, or `skipped-live` results are not production completion.

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

# Current Patch Checkpoint — PR #43

## Code Complete

- Added shared platform-master authorization for `/api/admin/*`.
- Removed administrator access based only on role strings such as `superadmin` and `serviceadmin`.
- Preserved the secret-protected automatic domain recheck route required by PR `#41`.
- Added non-blocking D1 audit writes for signup, login, email-verification request, profile change, and account-status change.
- Added success and classified-failure events without storing passwords, tokens, sessions, Authorization headers, or cookies.
- Replaced raw IP and User-Agent values with HMAC-SHA256 fingerprints.
- Added `GET /api/admin/audit` with search, action, actor, project, target type, date, cursor, and limit filters.
- Excluded raw IP and raw User-Agent from audit responses.
- Added no audit-log update or deletion API.
- Added manager invite creation and acceptance audit events.
- Added page-save diff auditing for manager addition, permission change, status change, and removal.
- Added ownership-transfer request, billing-wait, approval, rejection, cancellation, completion, and fallback status-change events.
- Added project archive auditing when page deletion archives the project.
- Added runtime QA that verifies manager additions, permission changes, status changes, and removals are emitted separately and manager emails are not persisted in audit rows.
- Added `admin:audit:qa` to `qa:all`.
- Updated `docs/ops-admin-audit-log.md`.
- Protected production-home file changes: none.

## QA Complete

Implementation commit `5ae8588d3bc6ee020c784d9fad78ae629c6da8a1` passed:

- targeted administrator audit QA
- authentication QA
- authentication-email QA
- Pages Functions QA
- API security QA
- full offline QA
- production build and deployment artifact build
- public landing real-browser regression
- authenticated editor real-browser regression
- consultation and reservation real-browser regression

Documentation-only follow-up commits must still keep the same full QA green before final closeout.

## Not Complete

- PR `#43` merge to `main`: not completed.
- Production deployment: not completed.
- Production administrator authorization verification: not completed.
- Production D1 audit-row verification: not completed.
- Password-change and email-change workflow audit: not completed.
- Project pause and restore API/audit: not completed.
- Platform-master manual action audit: not completed.
- Internal route-only audit UI: not completed.

Do not describe PR `#43` as production complete until it is merged, deployed with explicit owner approval, and checked using an approved platform-master account plus a denied general account.

# Other Open Checkpoints

## PR #42 — One-Page Policy Production Verification

- General-account one-active-page implementation is already merged through PR `#40`.
- Live verification script, manual workflow, cleanup, Google-login quota, and manager bypass coverage are complete in PR `#42`.
- Full QA and browser regression passed on that branch.
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
- Frontend and API page-limit enforcement both remain mandatory.
- Role-string forgery must not bypass page or administrator policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived/deleted projects do not consume the active-page quota.
- Google-login accounts follow the same page policy.
- Manager/member access cannot create another owner page.
- Default platform-master emails plus `INLET_PLATFORM_MASTER_EMAILS` are the only approved page-limit and administrator bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The previous 3,300원 / 6,600원 / 9,900원 direction is discarded. Do not add a third paid plan or invent entitlements before owner approval.

## Deployment

- Never force-push `main`.
- Do not construct releases with destructive reset, clean, or restore operations.
- Do not mix unrelated refactors into a focused patch.
- Run targeted QA and the full suite before merge or deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations; template duplication is not needed.
- Login, account, and member management foundations.
- General-account one-page and platform-master unlimited policies.
- Save identity, revision conflict, draft recovery, and page-switch isolation.
- Three active templates only: personal rehabilitation, mobile wedding invitation, and real estate presale.
- Public landing, authenticated editor, and form/reservation browser regression infrastructure.
- AWS SES and Google Sheets integration foundations.
- Deployment route smoke contracts.

# Active Remaining Patches

## Priority 1 — PR #43 Merge And Production Verification

After owner approval:

1. Merge PR `#43` without mixing PR `#41` or PR `#42` branch changes.
2. Deploy only after explicit deployment approval.
3. Verify a general account receives 403 from `/api/admin/summary` and `/api/admin/audit`.
4. Verify a forged `superadmin` role also receives 403.
5. Verify an approved platform-master receives 200.
6. Create account, login, email-verification, manager, ownership-transfer, and project-archive events.
7. Confirm D1 audit rows contain no raw password, token, session, manager email, IP, or User-Agent.
8. Confirm filtering and pagination work and no ordinary audit deletion path exists.
9. Confirm ordinary page content saves do not create manager-change events when manager data is unchanged.

## Priority 2 — Complete Remaining Admin And Audit Gaps

Patch only confirmed remaining gaps after the current PR `#43` implementation:

- password-change audit
- email-change workflow and audit
- account restoration audit where restoration is implemented
- project pause and restore API plus audit
- platform-master manual action audit
- audit retention that prevents ordinary operator deletion
- internal route-only audit UI, never public workspace navigation

Manager invite, acceptance, permission change, status change, removal, ownership-transfer states, and project archive are implemented in PR `#43`; do not reassign them unless a regression is reproduced.

## Priority 3 — Execute One-Page Policy Live Verification

1. Prepare the six disposable fixtures documented by PR `#42`.
2. Store signed test sessions in GitHub Secrets.
3. Manually run Account Page Limit Production Verify with write approval.
4. Require `verified-live`, retain run/deployment/commit evidence, and confirm every `qa-limit-*` page was removed.

## Priority 4 — Custom-Domain Operational Rollout

1. Apply production migrations `0006_page_domains.sql` and `0007_page_domain_operations.sql` in order.
2. Configure the Cloudflare account, Pages project, least-privilege token, CNAME target, and recheck secret.
3. Merge PR `#41` only after migration and environment ordering is safe.
4. Deploy only after explicit owner approval.
5. Verify DNS, SSL, public routing, assets, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

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

Verify 360px, 390px, and 430px for a finished first viewport, editable visible sections, no instructional copy, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ, preview/public parity, and reduced-motion-aware effects.

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
