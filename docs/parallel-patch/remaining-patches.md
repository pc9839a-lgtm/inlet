# Pagero Remaining Patches

Updated: 2026-08-02 00:55 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#44` / `agent/template-mobile-final-regression`

Other open candidates:

- PR `#43` / `agent/admin-audit-hardening`
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

# Current Patch Checkpoint — PR #44

## Code Complete

- Added a real Chrome CDP regression for the three active templates only:
  - `debt-relief-consult` — personal rehabilitation consultation
  - `wedding-invitation` — mobile wedding invitation
  - `quote-request` — real estate presale
- Added viewport coverage for 360×800, 390×844, and 430×932.
- Added first-viewport checks for hero placement, visible title/body, horizontal containment, placeholder/editor-copy leakage, and runtime error/fallback output.
- Added section containment checks across every visible public block.
- Added bottom fixed-button count, touch-height, and share-button collision checks.
- Added real FAQ open/close interaction.
- Added real gallery-next interaction for wedding and real-estate templates.
- Added map-section and external map-action verification.
- Added real-estate reservation-control verification.
- Added bottom CTA navigation to the form.
- Added form-focus and simulated mobile-keyboard checks at 390px.
- Added fixed top navigation, share button, and bottom bar hiding checks while a form control is focused.
- Added template/viewport first-screen screenshots and 390px interaction screenshots.
- Added `browser:templates-mobile:qa`.
- Added `browser:templates-mobile:contract:qa` to `qa:all`.
- Added release-blocking GitHub Actions job `template-mobile-browser-regression`.
- Added screenshot artifact `template-mobile-regression-${{ github.run_id }}`.
- Protected production-home file changes: none.
- Template content and design changes: none.

## QA State

Initial PR workflow run `30706845375` showed:

- template static QA: passed
- preview/public parity QA: passed
- fixed bottom UI QA: passed
- top navigation QA: passed
- new template-mobile regression contract: passed
- build and deployment artifact checks: passed
- integration contract: failed because the old `main` backlog document omitted the required compatibility marker `Current execution mode: parallel patching is active`
- all browser jobs, including the new template-mobile job, were skipped because the shared offline QA job failed first

The failure was a documentation compatibility failure, not a template renderer or browser-test failure. This document now restores every required compatibility marker and records the PR `#44` checkpoint.

## Not Complete

- Final full offline QA after this document update: not completed yet.
- Real Chrome three-template mobile regression: not completed yet.
- Screenshot artifact review: not completed yet.
- PR `#44` ready-for-review transition: not completed yet.
- PR `#44` merge to `main`: not completed.
- Production deployment: not completed.
- Production template verification: not completed.

Do not describe the three-template mobile final regression as complete until the final PR head passes the new browser job across all nine template/viewport combinations.

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
- Administrator authorization, audit, email-change, account controls, project controls, retention, and live-verifier implementation on open PR `#43`.
- One-page policy production verifier implementation on open PR `#42`.
- Custom-domain implementation and operations tooling on open PR `#41`.

# Other Open Checkpoints

## PR #43 — Administrator And Audit Operations

- Code and automated QA are complete on its branch.
- Three-phase production verifier is implemented.
- Merge to `main`: not completed.
- Production audit secrets: not confirmed.
- Production deployment: not completed.
- Disposable fixtures and GitHub Secrets: not configured or verified.
- Real `verified-live` result: not completed.

## PR #42 — One-Page Policy Production Verification

- General-account one-active-page implementation is already merged through PR `#40`.
- Live verification script, manual workflow, cleanup, Google-login quota, and manager-bypass coverage are complete on PR `#42`.
- Merge to `main`: not completed.
- Six disposable fixtures and signed sessions: not configured or verified.
- Manual workflow result `verified-live`: not completed.

## PR #41 — Custom Domain

- Domain ownership, DNS, SSL, provider registration, routing, retries, escalation, operator list, scheduled recheck, and runbook are code/QA complete on the branch.
- Merge to `main`: not completed.
- Production D1 migrations `0006` and `0007`: not completed.
- Cloudflare production environment configuration: not completed.
- Production deployment and real customer-domain smoke test: not completed.

# Active Remaining Patches

## Priority 1 — Complete PR #44 Three-Template Mobile Regression

1. Run final full offline QA after the backlog compatibility fix.
2. Run the release-blocking `template-mobile-browser-regression` job.
3. Require all nine template/viewport combinations to pass.
4. Review the first-viewport and 390px interaction screenshot artifacts.
5. Patch only reproduced renderer or CSS regressions; do not redesign the templates during QA.
6. Confirm protected production-home files remain unchanged.
7. Mark PR `#44` ready only after all jobs are green.
8. Merge only with owner approval.
9. Deploy only with explicit deployment approval.

## Priority 2 — PR #43 Merge And Production Verification

After explicit owner approval:

1. Configure `INLET_AUDIT_HASH_SECRET` and `INLET_AUDIT_RETENTION_SECRET` in production.
2. Configure matching GitHub audit verification and retention secrets.
3. Merge PR `#43` without mixing PR `#41`, `#42`, or `#44` branch changes.
4. Deploy only after explicit deployment approval.
5. Prepare one disposable password account and one `qa-audit-` page.
6. Run the read-only, request-email-token, and verify-live phases.
7. Require the documented `verified-live` results.
8. Confirm D1 audit rows contain no raw password, token, session, email-change address, manager email, IP, or User-Agent.

## Priority 3 — Execute One-Page Policy Live Verification

1. Merge PR `#42` after checking conflict scope.
2. Prepare the six disposable fixtures documented by PR `#42`.
3. Store signed test sessions in GitHub Secrets.
4. Run Account Page Limit Production Verify with explicit write approval.
5. Require `verified-live` and confirm every `qa-limit-*` page was removed.

## Priority 4 — Custom-Domain Operational Rollout

1. Apply production migrations `0006_page_domains.sql` and `0007_page_domain_operations.sql` in order.
2. Configure the Cloudflare account, Pages project, least-privilege token, CNAME target, and recheck secret.
3. Merge PR `#41` only after migration and environment ordering is safe.
4. Deploy only after explicit owner approval.
5. Verify DNS, SSL, public routing, assets, forms, reservations, tracking, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 5 — Live Integration Production Verification

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, password-reset, email-change, invite, and ownership-transfer messages.
- Google Sheets production OAuth, token refresh, row delivery, disconnect, and retry/dead-letter visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, never false success or false product failure.
- Never expose provider credentials, verification tokens, access tokens, or raw internal errors.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback evidence.
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
