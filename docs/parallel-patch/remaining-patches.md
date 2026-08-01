# Pagero Remaining Patches

Updated: 2026-08-01

Repository: `pc9839a-lgtm/inlet`

Branch: `main`

This document is the current execution-order reference for Pagero. Current code and recent commits take precedence over historical unchecked items. Completed work must not be reassigned unless an actual regression is reproduced.

Current execution mode: parallel patching is active

## Source Of Truth Order

1. `AGENTS.md`
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
3. `docs/PAGERO_PLAN_POLICY_KO.md`
4. This document
5. Task-specific handoff documents
6. Current `main` code and recent commits
7. Old worker documents as historical context only

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data.
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV.
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates.
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow.
5. Worker 5: QA, deployment, live integration readiness, docs and ops.

Compatibility labels retained for existing QA contracts:

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

## 1. Production Home Is Frozen

The current `https://pagero.kr/` root screen is the canonical production home. Unless the owner explicitly requests a production-home change, do not change its visible design, copy, section order, menu, footer, hero, animation, lifestyle bridge, login/start behavior, or responsive result.

The Cloudflare Pages root source of truth is `functions/index.js`. Protected production-home scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home screen components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Required production-home signals must remain unchanged:

- exactly one `.pagero-exact-home`
- exactly one `.c63-life-nav-link`
- exactly one `.c63-life-bridge`
- exactly four `.c63-life-post` links
- visible `https://life.pagero.kr/` link
- visible `https://awards.pagero.kr/` link
- `/c63-assets/index-pagero-main-fix-20260615.js`
- `/c63-assets/index-B0Q5rFVf.css`

Stop deployment if an unrelated patch changes a protected-home file or required signal.

## 2. General Account Page Limit Must Stay Enforced

- A general account may own and create one active landing page only.
- Platform-master accounts may create unlimited landing pages.
- The limit must remain enforced on frontend controls and the server/API boundary.
- A forged role string such as `superadmin` must not bypass the limit.
- Existing owned pages must remain editable and publishable.
- Archived or deleted projects must not incorrectly block a valid first active page.
- Platform-master status must survive login and session refresh.
- Default platform-master emails and `INLET_PLATFORM_MASTER_EMAILS` remain the only approved bypass source.

## 3. Paid Plans Are Locked To Two

Pagero has exactly two paid plans:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The old 3,300원 / 6,600원 / 9,900원 three-tier direction is discarded. Do not add a third paid plan unless the owner explicitly changes the decision. Plan entitlements remain undecided until separately approved; do not invent page, lead, manager, custom-domain, tracking, or integration limits.

## 4. Page Sharing Must Stay Separate From Bottom Bar

- Global sharing state uses `page.share`.
- Public and preview sharing use the independent `PageShareButton` flow.
- Do not restore `bottombar.s.shareEnabled`.
- Do not move share-position controls into the bottom fixed button editor.
- Share URLs must use the public page URL, never `/app`, `/dashboard`, or editor query parameters.

## 5. Scope Must Stay Narrow

For editor-only work, do not change unrelated auth, session, account entitlement, D1 schema, ownership, form payload, stats contract, public save policy, production home, SEO, or deployment scripts.

Keep the editor workflow:

`add block -> check mobile preview -> edit selected block -> save/publish`

Patch incrementally. Do not replace multiple editor systems with one broad override.

## 6. Deployment Rules

- Never force-push `main`.
- Do not use destructive reset, clean, or restore operations to construct a release.
- Do not deploy a dirty or unclear integration tree.
- Do not mix unrelated refactors into a functional patch.
- Run targeted QA during implementation and the full suite before deployment.
- Verify desktop, compact, and mobile widths.
- Verify production-home DOM signals before deployment.
- Production deployment requires explicit owner approval.

## 7. Billing Is The Final Product Phase

Do not start payment-provider implementation before account policy, custom-domain behavior, admin/audit readiness, live integrations, template mobile QA, and production regression checks are stable.

# Completed Baseline — Do Not Repeat

Reopen the following only after reproducing a regression.

## Account And Page Policy

- General-account one-page policy model.
- Platform-master account policy.
- Server-side `ACCOUNT_PAGE_LIMIT_REACHED` enforcement.
- Frontend creation-control lock state.
- Existing-page replay and update allowance.
- Login and session responses exposing platform-master state.
- Dedicated and full-suite regression QA.

## Top Navigation, Sharing, Forms, Timer, And Fixed UI

- Top navigation supports one through eight menu items without horizontal scrolling.
- Native mobile sharing and clipboard fallback.
- Four persisted share positions.
- Form/reservation focus hides colliding fixed UI.
- Three timer layouts with editable copy and effect choices.
- Bottom timer inherits main timer settings.
- Main and bottom countdowns use one synchronized clock.
- Fixed UI collision and viewport spill regression coverage.

## Save Reliability And Images

- Late save responses are isolated after page/project switches.
- Server-page drafts are account and page scoped.
- Compatible same-revision recovery only.
- Sensitive values excluded from draft persistence.
- Drafts clear after successful save.
- Editor images are oriented, resized, compressed, and deduplicated.
- Gallery images process sequentially with progress feedback.

## Forms, Leads, Inbox, Stats, And Integrations

- Consultation and reservation browser regression.
- Rapid-click locking, duplicate blocking, and inbox reflection.
- Server-authoritative blocked history and month-bounded CSV.
- Stabilized stats filters and chart spacing.
- AWS SES auth-email foundation.
- Google Sheets OAuth and lead-delivery foundation.
- Deployment route smoke contracts.

# Active Remaining Patches

Patch in this order unless the owner explicitly changes priority.

## Priority 1 — One-Page Policy Production Verification

The policy is implemented. This is an operational regression pass, not a redesign.

Required verification:

- A new general account creates its first page.
- A general account with one active page cannot create a second page from dashboard controls.
- Direct API creation returns `409` with `ACCOUNT_PAGE_LIMIT_REACHED`.
- Existing page save, revision, restore, preview, and publish remain functional.
- A platform-master account creates multiple pages.
- Platform-master state remains after logout/login and session refresh.
- Google-login accounts follow the same quota policy.
- Archived/deleted projects do not create a false active-page count.
- Manager/member access cannot create a second owner page through another UI path.

Do not weaken the server limit to fix a frontend display issue.

## Priority 2 — Custom Domain Product Completion

The current foundation covers domain-agnostic page fields, server-side hostname validation, duplicate ownership protection, lifecycle and SSL status storage, settings UI, and dedicated QA.

Remaining work:

- Apply and verify the `page_domains` D1 migration in the target environment.
- Configure the production CNAME target.
- Perform real DNS ownership and CNAME checks.
- Move states through `pending`, `verifying`, `active`, `failed`, and `disconnected` only from trusted server logic.
- Bind and detach custom hostnames at the hosting provider.
- Verify SSL provisioning and renewal state.
- Route custom-host requests to the correct public page.
- Synchronize public URL, canonical URL, preview, and share URL.
- Add operator visibility for failed or stuck verification.
- Add reconnect, detach, and rollback behavior.
- Keep duplicate-domain ownership protection server-side.
- Keep compatibility with the general-account one-page policy.

Page duplication remains a later paid feature. Template duplication is not a product feature.

## Priority 3 — Admin And Audit Completeness Review

Inspect current D1 schema, API, and internal admin UI first. Patch only confirmed gaps.

Required capabilities:

- Audit rows for signup and verification.
- Login failure category without exposing secrets.
- Password, name, email, and phone changes.
- Account suspension, restoration, and deletion-state changes.
- Manager invite, acceptance, permission change, and removal.
- Ownership-transfer request, approval, rejection, cancellation, and completion.
- Project pause, archive, and restore actions.
- Platform-master manual actions.
- Search and filter by account, project, action, actor, and date.
- Audit records must not be silently deleted through normal operator actions.

Internal admin remains route-only and must not appear in public workspace navigation.

## Priority 4 — Live Integration Production Verification

Do not reimplement integrations already present. Verify actual production credentials and behavior.

Required live checks:

- SES domain identity, DKIM, SPF, and DMARC.
- SES production access when sandboxed.
- Real signup verification, password reset, manager invite, and ownership-transfer emails.
- Generic user-facing failure copy and classified internal errors.
- Google Sheets OAuth production redirect URI.
- Token refresh after expiry.
- Lead row delivery with submitted-field headers.
- Disconnect immediately stops future delivery.
- Retry/dead-letter visibility where applicable.
- Conversion tracking credentials and real event receipt where configured.
- Missing credentials remain `skipped-live`, not a false product failure.

Never expose provider credentials, verification tokens, access tokens, or raw internal errors to the browser.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly these templates:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Required verification at 360px, 390px, and 430px:

- Finished first viewport, not a builder demo.
- No instructional or placeholder explanation copy in public output.
- Every visible section remains editable through existing blocks.
- No overlap among top navigation, hero, share button, forms, timer, and bottom fixed UI.
- Mobile keyboard does not hide active fields or submission controls.
- Gallery, map, FAQ, and form interactions remain usable.
- Preview and public output remain aligned.
- Premium effects remain intentional, non-blocking, and motion-reduction aware.

Personal rehabilitation copy must not guarantee approval or legal outcome.

## Priority 6 — Product And Operations Hardening

Inspect before implementing. Complete only confirmed gaps.

- Custom-domain rollback and support runbook.
- D1 schema backup and rollback procedure.
- Operator release checklist with current commands.
- Retention and cleanup policy for logs, blocked submissions, delivery logs, and audit rows.
- Large-data inbox/stat query verification using D1 aggregation.
- Abuse/rate-limit operator visibility without exposing raw IP when only hashes are stored.
- Accessibility and keyboard regression for new account, domain, and admin UI.

# Final Phase — Plans, Billing, And Subscription

Start only after Priorities 1 through 6 are stable.

## Plan Direction

Exactly two paid products:

- `classic`: 클래식, KRW 3,500 per month
- `pro`: 프로, KRW 5,500 per month

Before checkout implementation, the owner must explicitly define entitlements for active pages, page duplication, monthly leads, stats retention, manager count, custom domain, conversion tracking, and integration limits. Do not guess them.

## Required Billing Architecture

- Server-side entitlement enforcement.
- Payment-provider abstraction before provider-specific code.
- Toss Payments or another owner-selected provider after abstraction.
- Checkout and billing-key/card registration.
- Subscription renewal and cancel-at-period-end.
- Payment failure and grace period.
- Webhook signature verification and idempotency.
- Payment history and receipt/invoice link storage.
- Admin manual billing override with audit log.
- Payment credentials remain server-only.

Frontend-only plan locks are not the final entitlement system.

# Execution Protocol For Every Patch

## Before Editing

1. Confirm repository and branch: `pc9839a-lgtm/inlet` / `main`.
2. Fetch the current remote state.
3. Read `AGENTS.md`, `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`, and `docs/PAGERO_PLAN_POLICY_KO.md`.
4. Read this document and any task-specific handoff.
5. List exact allowed files.
6. Exclude protected production-home files unless the owner requested home changes.
7. Check recent commits so completed work is not repeated.

## During Editing

- Keep one patch group focused on one product problem.
- Avoid unrelated cleanup and broad formatting.
- Preserve working API, auth, storage, routing, and public behavior outside scope.
- Add or update direct regression QA with the implementation.
- Stop and report scope conflicts instead of silently widening the patch.

## Before Commit

Verify at minimum:

- changed-file list
- no protected-home diff
- targeted QA
- build
- affected browser flow
- preview/public parity when renderer or CSS changes
- desktop and 360/390/430px behavior for visible UI
- no mojibake or broken Korean copy

## Before Production Deployment

Run the current full required QA and release checks, including:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run deployment:smoke:contract:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:production:qa
```

Run relevant feature-specific QA, including:

```bash
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

A skipped live check must identify the exact missing credential or external approval. It must not be reported as completed live verification.

Production deployment occurs only after explicit owner approval.

# Do Not Reassign Without A Reproduced Regression

- Top navigation one-to-eight layout.
- Native sharing and four share positions.
- Form-focus fixed UI hiding.
- Three timer styles and strong effects.
- Bottom timer inheritance and compact layout.
- Shared countdown clock.
- Preview/public CSS parity.
- Fixed bottom UI collision handling.
- Account-scoped draft recovery.
- Delayed-save page-switch isolation.
- Image optimization before storage.
- Server-backed blocked history.
- Google Sheets OAuth foundation.
- AWS SES auth-email foundation.
- General-account one-page enforcement.

When one appears broken, reproduce it first and patch the smallest confirmed regression rather than rebuilding the feature.
