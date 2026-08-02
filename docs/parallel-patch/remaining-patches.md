# Pagero Remaining Patches

Updated: 2026-08-02 12:45 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#45` / `agent/d1-migration-safety`

Other open candidates:

- PR `#43` / `agent/admin-audit-hardening`
- PR `#42` / `agent/account-page-limit-production-verification`
- PR `#41` / `agent/custom-domain-foundation`

Merged baseline:

- PR `#44` / three-template mobile interaction and browser regression patch
- merge commit: `1c1c4bc3503f367cea81b0a3f435cd6c0d8b7473`
- latest deployment-record commit observed on main: `2623e8122ac8fde2b544645aabbbb42c0d0d4077`

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

# Current Patch Checkpoint — PR #45

## Code Complete

### Guarded D1 migration workflow

- Added manual-only `D1 Migration Safety` workflow.
- Added read-only `preflight` mode.
- Added approval-gated `backup-and-apply` mode.
- Restricted write mode to the `main` branch.
- Requires `allow_writes=true` and exact phrase `I_APPROVE_D1_MIGRATIONS`.
- Requires the remote pending migration filenames and order to exactly match the approved list.
- Records SHA-256 for every local migration file.
- Reads remote D1 migration history and table state.
- Uses the official Wrangler `d1 export --remote --output ... --skip-confirmation` contract.
- Captures available D1 Time Travel bookmark evidence.
- Encrypts the full SQL export with AES-256-CBC and PBKDF2-SHA256 before artifact upload.
- Records encrypted SHA-256 and keyed HMAC-SHA256.
- Deletes plaintext SQL before artifact upload.
- Uploads only encrypted SQL and non-secret evidence.
- Verifies expected migrations in remote history after apply.
- Never performs an automatic production restore.

### CallTag Android app developer handoff

- Added `docs/calltag-pagero-android-app-implementation-spec.md`.
- Defines the full flow from Pagero lead submission to CallTag notification, customer card, call, message, post-call summary, and follow-up schedule.
- Defines app screens, data models, duplicate-customer rules, FCM payload, sync cursor, Room/WorkManager outbox, conflict handling, API requirements, and acceptance tests.
- Separates P0 Play-safe implementation from P1 server messaging and P2 default Phone/SMS handler scope.
- Prohibits unsafe automatic SIM SMS and unrestricted call-log/SMS permissions in the MVP.
- Defines Calendar INSERT Intent, Photo Picker, contact picker, ACTION_DIAL, offline retry, security, and device test requirements.

### Documentation

- Added `docs/ops-d1-migration-safety.md`.
- Updated `docs/ops-storage-migration-policy.md`.
- Updated `.env.example` with non-secret variable names.
- Added static and runtime safety contracts to `qa:all`.

## QA Status

Initial implementation workflow run `30731060075` passed:

- full offline QA
- public landing browser regression
- authenticated editor browser regression
- form/reservation browser regression
- Korean-font three-template mobile browser regression

Final command corrections, app handoff contract, and documentation changes require the final HEAD workflow to pass before PR `#45` is marked ready.

## Not Complete

- PR `#45` merge to `main`: not completed.
- Production Secrets: not configured or verified.
- Real D1 `preflight`: not executed.
- Encrypted production backup: not created.
- Production migrations: not applied.
- Restore drill against a disposable database: not completed.
- Android application implementation: not started in this web repository.

# Absolute Rules

## Production Home Is Frozen

The current `https://pagero.kr/` root screen is the canonical production home.

Unless the owner explicitly requests a production-home change, do not change its visible design, copy, section order, menu, footer, hero, animation, lifestyle bridge, login/start behavior, or responsive result.

Protected production-home scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home screen components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Stop deployment if a protected-home file changes during unrelated work.

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

## Page Sharing And Fixed UI

- Global sharing state uses `page.share`.
- Sharing stays separate from the bottom fixed-button editor.
- Public and preview sharing use the same PageShareButton flow.
- Share URLs must use the public page URL, never the editor or dashboard URL.
- Form and reservation focus must hide top navigation, share, and bottom fixed UI where required to protect the active input.

## Active Templates Stay Exactly Three

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Do not add more templates and do not replace them with non-editable HTML shells.

Personal rehabilitation copy must not guarantee approval or legal outcome.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not restore the discarded 3,300원 / 6,600원 / 9,900원 direction. Do not add a third paid plan or invent entitlement differences before owner approval.

## Deployment

- Never force-push `main`.
- Do not construct releases with destructive reset, clean, or restore operations.
- Do not mix unrelated refactors into a focused patch.
- Run targeted QA and the full suite before merge or deployment.
- Production deployment requires explicit owner approval.
- Production D1 writes require encrypted backup evidence and exact pending-list approval.

# Completed Baseline — Do Not Reassign These

- Production account/session hardening.
- Customer-owned AI key storage.
- D1 real runtime smoke and write-side migration foundations.
- Add lead duplicate and spam policy foundations.
- Page duplication and URL setup foundations; template duplication is not needed.
- Login, account, and member management foundations.
- General-account one-page and platform-master unlimited policies.
- Save identity, revision conflict, draft recovery, and page-switch isolation.
- Native sharing and four persisted share positions.
- Form-focus fixed UI hiding foundations.
- Three timer styles, strong effects, bottom-timer inheritance, and shared countdown clock.
- Image optimization before storage.
- Server-backed blocked history and month-bounded CSV.
- AWS SES authentication-email foundation.
- Google Sheets OAuth and delivery foundation.
- Public landing, authenticated editor, and form/reservation browser regression infrastructure.
- Preview/public CSS parity and fixed-bottom collision contracts.
- Deployment route smoke contracts.
- Three-template 360/390/430px real-browser regression merged through PR `#44`.
- Shared gallery 44px targets and pointer-capture guard merged through PR `#44`.
- Shared consent-row mobile touch contract merged through PR `#44`.
- Korean-font screenshot evidence pipeline merged through PR `#44`.
- Administrator authorization, audit, email-change, account controls, project controls, retention, and live-verifier implementation on open PR `#43`.
- One-page policy production verifier implementation on open PR `#42`.
- Custom-domain implementation and operations tooling on open PR `#41`.
- Guarded D1 migration and encrypted backup implementation on open PR `#45`.
- CallTag Android application implementation handoff document on open PR `#45`.

# Active Remaining Patches

## Priority 1 — Complete And Merge PR #45

1. Confirm the final HEAD full offline QA and all four browser regressions are green.
2. Confirm protected production-home files are unchanged.
3. Move PR `#45` from draft to ready.
4. Merge only after owner approval.
5. Do not run production D1 writes during merge.
6. Configure Secrets separately after merge.
7. Run `preflight` before any migration work.

## Priority 2 — PR #43 Administrator And Audit Operations

1. Integrate the latest `main` after PR `#45` if it is merged first.
2. Configure `INLET_AUDIT_HASH_SECRET` and `INLET_AUDIT_RETENTION_SECRET` in production.
3. Configure matching GitHub audit verification and retention secrets.
4. Merge and deploy only after explicit approval.
5. Prepare one disposable password account and one `qa-audit-` page.
6. Run read-only, request-email-token, and verify-live phases.
7. Confirm audit rows contain no raw password, token, session, email-change address, manager email, IP, or User-Agent.

## Priority 3 — PR #42 One-Page Policy Production Verification

1. Integrate the latest `main` after preceding merges.
2. Prepare six disposable fixtures and signed sessions.
3. Merge only after conflict and QA review.
4. Run Account Page Limit Production Verify with explicit write approval.
5. Require `verified-live`.
6. Confirm every `qa-limit-*` page is removed.

## Priority 4 — PR #41 Custom-Domain Operational Rollout

1. Integrate latest `main`, including PR `#45` migration safety.
2. Run read-only D1 preflight.
3. Review exact pending migrations.
4. Use the guarded encrypted backup workflow before applying `0006_page_domains.sql` and `0007_page_domain_operations.sql`.
5. Configure Cloudflare account, Pages project, least-privilege token, CNAME target, and recheck secret.
6. Merge and deploy only after explicit approval.
7. Verify DNS, SSL, routing, assets, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 5 — CallTag Android App P0 Implementation

Developer source document:

- `docs/calltag-pagero-android-app-implementation-spec.md`

P0 delivery order:

1. Login, session refresh, account suspension handling.
2. FCM device registration and lead deep links.
3. Pagero lead inbox and customer card.
4. Pagero/manual source separation.
5. Duplicate customer merge by normalized phone.
6. Status, tags, notes, assignee, and next action.
7. ACTION_DIAL call flow.
8. Large post-call summary on app return.
9. Template SMS using SMS Intent.
10. Internal follow-up schedule and Calendar INSERT Intent.
11. Room cache, WorkManager, sync cursor, and outbox idempotency.
12. Today/7-day/30-day/custom statistics.
13. Offline, conflict, permission-denied, and retry handling.
14. Samsung device, notification, keyboard, font-size, dark-mode, and background-restriction QA.

Do not start P2 default Phone/SMS handler scope before P0 is stable and Play policy review is approved.

## Priority 6 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets production OAuth, token refresh, row delivery, disconnect, and retry/dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.
- Never expose provider credentials, verification tokens, access tokens, or raw internal errors.

## Priority 7 — Product And Operations Hardening

- Restore drill using a disposable D1 database.
- Current operator release checklist.
- Retention and cleanup policy for leads, blocked submissions, delivery logs, AI drafts, backups, and audit rows.
- Large-data inbox and stats query verification.
- Abuse/rate-limit visibility without raw IP exposure.
- Accessibility and keyboard regression for account, domain, and administrator UI.
- Previous-deployment rollback procedure.

# Plans, Payment, And Subscription, Final Phase

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Start only after active operational priorities are stable and the owner defines the entitlement difference. Required architecture includes server-side entitlements, provider abstraction, checkout/billing key, renewal, period-end cancellation, grace period, signed and idempotent webhooks, payment history, receipts, and audited administrator override.

# Required QA Before Merge Or Deployment

```bash
npm run templates:qa
npm run browser:templates-mobile:contract:qa
npm run browser:templates-mobile:qa
npm run preview:parity:qa
npm run bottom:fixed:qa
npm run topnav:balance:qa
npm run d1:migration:safety:qa
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
6. Do not claim production completion from branch-only, mock-only, screenshot-only, or `skipped-live` results.
