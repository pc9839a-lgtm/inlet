# Pagero Remaining Patches

Updated: 2026-08-02 00:22 KST

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

### Administrator authorization

- Shared platform-master authorization for `/api/admin/*`.
- Administrator role-string forgery blocked.
- Secret-protected custom-domain recheck preserved for PR `#41`.
- Exact-secret bypass limited to the intended recheck and audit-retention paths.

### Account and authentication audit

- Signup, login, email-verification, profile, account-status, password-change, and email-change success/failure events.
- Verified email-change workflow with duplicate prevention.
- Password accounts require the current password before email change.
- Google accounts use the active session plus new-email verification.
- Account ID remains stable after email change.
- Password hash is regenerated against the new email where applicable.
- New session issued with the new email; old email session becomes invalid.
- Previous and new email values are stored only as HMAC-SHA256 fingerprints.
- Passwords, verification tokens, sessions, Authorization headers, and cookies excluded from audit metadata.
- Raw IP and User-Agent replaced with HMAC-SHA256 fingerprints.

### Manager, ownership, and project audit

- Manager invite creation and acceptance.
- Manager addition, permission change, status change, and removal diff auditing.
- Ownership-transfer request and all operator status events.
- Project archive event for normal page deletion.
- Platform-master project pause, restore, and archive API with audit events.

### Platform account controls

- Platform-master account suspend and restore API.
- Self-account status changes blocked.
- Platform-master target accounts blocked.
- Deleted-pending-retention accounts cannot be restored through this operation.
- Success and classified failure audit events.

### Audit access and retention

- `GET /api/admin/audit` search and pagination API.
- No ordinary audit-log update or deletion API.
- Route-only `/admin/audit` operator console.
- Audit search, project pause/restore, and account suspend/restore controls.
- `noindex`, no-store, CSP, and frame-blocking headers.
- No platform-master email list or server secret embedded in the operator console.
- Secret-protected `POST /api/admin/audit/retention`.
- Default 730-day retention, minimum 365 days, maximum 3,650 days.
- Bounded deletion batches: default 1,000, maximum 5,000 rows.
- Retention self-audit rows excluded from automatic deletion.
- Dry-run support.
- Monthly GitHub Actions retention workflow.
- Missing retention secret produces `skipped-live`, never false completion.

### Production verification automation

- Manual-only `Admin Audit Production Verify` workflow.
- `read-only`, `request-email-token`, and `verify-live` phases.
- Separate write approval and require-live gates.
- GitHub Secrets only for sessions, password, next email, one-time code, and retention secret.
- General and forged-role administrator rejection check.
- Platform-master administrator access check.
- `/admin/audit` security-header check.
- Real email-change, new-session, and old-session rejection sequence.
- Disposable account suspend, login rejection, restore, and login recovery sequence.
- Disposable project pause, public 404, restore, and public 200 sequence.
- Audit-retention dry-run with zero deletions.
- Required audit-action lookup after execution.
- `qa-audit-` disposable project prefix guard.
- Automatic account and project restoration attempt after a failed write sequence.
- Evidence artifact that excludes passwords, sessions, one-time codes, and retention secrets.

### QA and documentation

- Runtime QA for manager diffs, password secrecy, email change, account operations, project operations, retention policy, and operator-console headers.
- `admin:audit:qa` included in `qa:all`.
- `admin:audit:production:contract:qa` included in `qa:all`.
- `.env.example` includes audit security, retention, and manual production-verification configuration.
- `docs/ops-admin-audit-log.md` updated.
- `docs/ops-admin-audit-production-verification.md` added.
- Protected production-home file changes: none.

## QA Complete

Implementation head `546a8d29b23c16962359c4bcb5aa66bc92dec141` passed workflow run `30705689396`:

- targeted administrator audit QA
- administrator production-verification contract QA
- missing fixture and write approval `skipped-live` behavior
- manual-only workflow trigger contract
- workflow secret non-output contract
- disposable project prefix and cleanup guards
- authentication and authentication-email QA
- verified email-change contract QA
- password and metadata secrecy QA
- platform account suspend/restore policy QA
- project pause/restore policy QA
- audit-retention limits and secret QA
- route-only operator console QA
- Pages Functions and API security QA
- integration documentation contract QA
- full offline QA
- production build and deployment artifact build
- public landing real-browser regression
- authenticated editor real-browser regression
- consultation and reservation real-browser regression

## Not Complete

- PR `#43` merge to `main`: not completed.
- Production deployment: not completed.
- Production administrator authorization verification: not completed.
- Production D1 audit-row verification: not completed.
- Production `/admin/audit` smoke verification: not completed.
- Real email-change and old-session rejection verification: not completed.
- Real account suspension, login rejection, and restoration verification: not completed.
- Real project pause, public 404, and restore verification: not completed.
- Production audit-retention dry-run and deletion verification: not completed.
- `Admin Audit Production Verify` read-only phase result `verified-live`: not completed.
- `Admin Audit Production Verify` request-email-token phase result `awaiting-email-token`: not completed.
- `Admin Audit Production Verify` verify-live phase result `verified-live`: not completed.
- Disposable password account and `qa-audit-` page: not prepared or verified.
- Platform-master and disposable general signed sessions: not configured in GitHub Secrets.
- Disposable account password, next email, and email-change token: not configured or verified.
- `INLET_AUDIT_HASH_SECRET`: not confirmed in production.
- `INLET_AUDIT_RETENTION_SECRET`: not confirmed in production.
- GitHub `PAGERO_AUDIT_RETENTION_SECRET`: not configured or verified.

Do not describe PR `#43` as production complete until it is merged, deployed with explicit owner approval, and the manual workflow returns the expected live status with approved platform-master and disposable general-account fixtures.

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
- Archived projects do not consume the active-page quota.
- Google-login accounts follow the same page policy.
- Manager/member access cannot create another owner page.
- Default platform-master emails plus `INLET_PLATFORM_MASTER_EMAILS` are the only approved page-limit and administrator bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not restore the discarded 3,300원 / 6,600원 / 9,900원 direction. Do not add a third paid plan or invent entitlements before owner approval.

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
- Administrator authorization and complete account/manager/ownership/project audit implementation on PR `#43`.
- Verified email-change implementation and audit on PR `#43`.
- Platform account suspend/restore implementation and audit on PR `#43`.
- Bounded audit-retention implementation and monthly workflow on PR `#43`.
- Manual three-phase administrator and audit production-verification workflow on PR `#43`.
- Live verifier write gate, secret-output protection, `qa-audit-` target guard, and restoration cleanup on PR `#43`.

# Active Remaining Patches

## Priority 1 — PR #43 Merge And Production Verification

After explicit owner approval:

1. Confirm final PR head, changed-file scope, and all green checks.
2. Configure `INLET_AUDIT_HASH_SECRET` in production.
3. Configure `INLET_AUDIT_RETENTION_SECRET` in production.
4. Configure GitHub `PAGERO_AUDIT_RETENTION_SECRET` to the same retention value.
5. Optionally configure `PAGERO_AUDIT_RETENTION_URL` when the default production endpoint is not used.
6. Merge PR `#43` without mixing PR `#41` or PR `#42` branch changes.
7. Deploy only after explicit deployment approval.
8. Prepare one disposable verified password account and one active page whose slug starts with `qa-audit-`.
9. Confirm the disposable page contains no customer data and receives no real traffic.
10. Store `PAGERO_ADMIN_AUDIT_PLATFORM_MASTER_SESSION`.
11. Store `PAGERO_ADMIN_AUDIT_GENERAL_SESSION`.
12. Store `PAGERO_ADMIN_AUDIT_GENERAL_PASSWORD`.
13. Store a controlled unused address in `PAGERO_ADMIN_AUDIT_NEXT_EMAIL`.
14. Run `Admin Audit Production Verify` with `phase=read-only`, `allow_writes=false`, and require `verified-live`.
15. Run it with `phase=request-email-token`, `allow_writes=true`, and require `awaiting-email-token`.
16. Store the received code in `PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN` before its 30-minute expiry.
17. Run it with `phase=verify-live`, `allow_writes=true`, and require `verified-live`.
18. Retain the workflow URL, tested commit, deployment SHA, and evidence artifact.
19. Confirm the disposable account and project both finish active.
20. Confirm D1 audit rows contain no raw password, token, session, email-change addresses, manager email, IP, or User-Agent.
21. Run a controlled real retention execution only when eligible test data exists and explicit approval is given.
22. Confirm the monthly retention workflow returns real success rather than `skipped-live`.

## Priority 2 — Execute One-Page Policy Live Verification

1. Merge PR `#42` after checking conflict scope.
2. Prepare the six disposable fixtures documented by PR `#42`.
3. Store signed test sessions in GitHub Secrets.
4. Manually run Account Page Limit Production Verify with write approval.
5. Require `verified-live`, retain run/deployment/commit evidence, and confirm every `qa-limit-*` page was removed.

## Priority 3 — Custom-Domain Operational Rollout

1. Apply production migrations `0006_page_domains.sql` and `0007_page_domain_operations.sql` in order.
2. Configure the Cloudflare account, Pages project, least-privilege token, CNAME target, and recheck secret.
3. Merge PR `#41` only after migration and environment ordering is safe.
4. Deploy only after explicit owner approval.
5. Verify DNS, SSL, public routing, assets, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 4 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets production OAuth, token refresh, row delivery, disconnect, and retry/dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.
- Never expose provider credentials, verification tokens, access tokens, or raw internal errors.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify 360px, 390px, and 430px for a finished first viewport, editable visible sections, no instructional copy, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ, preview/public parity, and reduced-motion-aware effects.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback evidence.
- Current operator release checklist.
- Retention and cleanup policy for leads, blocked submissions, delivery logs, AI drafts, and backups.
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
npm run admin:audit:production:contract:qa
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

Manual production verification after deployment and fixture preparation:

```bash
npm run admin:audit:live
```

# Mandatory Closeout

At the end of every patch:

1. Update the date, branch, PR, and checkpoint.
2. Separate code complete, QA complete, merged, deployed, and production verified.
3. Move completed implementation into the baseline.
4. Remove completed work from the active list.
5. Record missing migrations, credentials, approvals, and live evidence.
6. Do not claim production completion from branch-only, mock-only, or `skipped-live` results.
