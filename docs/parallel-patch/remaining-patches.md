# Pagero Remaining Patches

Updated: 2026-07-31

Repository: `pc9839a-lgtm/inlet`

Branch: `main`

Current production feature baseline: `59d33060b3e1377128aa3967fc1c5783b2d30090`

Latest deployment record commit: `e8391b203750811a46c5e7b8d7371d7efb49aa31`

Latest successful Cloudflare preview recorded in repository: `https://9d7c4684.inlet-8mr.pages.dev`

This document is the current master backlog and execution-order reference for Pagero. The previous 2026-05-28 backlog was more than 800 commits behind `main`; completed work from that document must not be reassigned unless an actual regression is reproduced.

## Source Of Truth Order

Before modifying Pagero, use the following order.

1. `AGENTS.md`
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
3. This document
4. A task-specific handoff document, when one exists
5. Current `main` code and recent commits
6. Old worker documents only as historical context

Do not treat an old unchecked backlog item as unfinished without checking current code and commit history first.

# Absolute Rules

## 1. Production Home Is Frozen

The current `https://pagero.kr/` root screen is the canonical production home.

Unless the owner explicitly requests a production-home change, do not change its visible design, copy, section order, menu, footer, hero, animation, lifestyle bridge, login/start behavior, or responsive result.

The actual Cloudflare Pages root source of truth is `functions/index.js`. Do not judge the production root only from the local Vite home or `index.html`.

Protected production-home scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- public-home screen components
- public-home and frozen C63 styles/assets
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

Stop deployment if any protected-home file or required signal changes during unrelated work.

## 2. General Account Page Limit Must Stay Enforced

- A general account may own and create one active landing page only.
- Platform master accounts may create unlimited landing pages.
- The limit must remain enforced on both frontend controls and the server/API boundary.
- A forged role string such as `superadmin` must not bypass the limit.
- Existing owned pages must remain editable and publishable.
- Archived/deleted projects must not incorrectly block a valid first active page.
- Platform-master status must survive login and session refresh.

Current default platform-master emails are code-level operational defaults plus optional `INLET_PLATFORM_MASTER_EMAILS`. Do not add another bypass path without an explicit owner decision.

## 3. Page Sharing Must Stay Separate From Bottom Bar

- Global sharing state uses `page.share`.
- Public and preview sharing use the independent `PageShareButton` flow.
- Do not restore `bottombar.s.shareEnabled`.
- Do not move share-position controls into the bottom fixed button editor.
- Share URLs must use the public page URL, never `/app`, `/dashboard`, or editor query parameters.

## 4. Editor-Only Work Must Stay Editor-Only

For editor UI work, do not change unrelated:

- auth or session behavior
- account roles or entitlement policy
- D1 schema
- page ownership
- form/reservation payloads
- stats event contracts
- public save policy
- production home
- SEO files
- deployment scripts

Keep the editor workflow:

`add block -> check mobile preview -> edit selected block -> save/publish`

Patch editor work incrementally. Do not replace multiple editor systems with one large CSS override.

## 5. Deployment Rules

- Never force-push `main`.
- Do not use destructive reset/clean/restore operations to construct a release.
- Do not deploy a dirty or unclear integration tree.
- Do not mix unrelated refactors into a functional patch.
- Run targeted QA during implementation and the full required suite before deployment.
- Verify preview at desktop, compact, and mobile widths.
- Verify production-home DOM signals before deployment.
- Production deployment requires explicit owner approval.

## 6. Billing Remains The Final Product Phase

Do not start payment-provider implementation before account policy, custom-domain behavior, admin/audit readiness, live integrations, template mobile QA, and production regression checks are stable.

# Completed Baseline — Do Not Repeat

The following work is already present on current `main`. Reopen only when a regression is reproduced.

## Account And Page Policy

- General-account one-page policy model.
- Platform-master account policy.
- Server-side creation middleware returning `ACCOUNT_PAGE_LIMIT_REACHED`.
- Frontend creation-control lock state.
- Existing-page replay/update allowance.
- Login and session responses exposing platform-master state.
- Regression QA through `account:page-limit:qa` and the full QA suite.

## Top Navigation, Sharing, And Form Focus

- Top navigation supports one through eight menu items.
- One through four items use a balanced single row.
- Five through eight items wrap into balanced rows without horizontal scrolling.
- Long menu labels remain visible without destructive ellipsis behavior.
- Native mobile sharing uses the platform share sheet where supported.
- Desktop/unsupported environments use clipboard fallback.
- Share-position selection supports four persisted positions.
- Share positioning avoids top navigation, safe areas, and bottom fixed controls.
- Form/reservation input focus temporarily hides fixed top/bottom/share UI.

## Timer And Bottom Fixed UI

- Three purposeful timer layouts with legacy storage compatibility.
- Editable timer headline and promotional text.
- Multiple motion/effect choices including strong visual options.
- Main timer design settings inherited by the compact bottom timer.
- Bottom timer converted to declarative rendering.
- Duplicate bottom-timer CSS layers consolidated.
- Main and bottom countdowns synchronized through one shared second-aligned clock.
- Fixed UI collision, reserved-space, and viewport-spill regressions covered by QA.

## Save Reliability And Draft Recovery

- Late save responses are isolated after page/project switches.
- Server-page drafts are separated from local page cache.
- Drafts are scoped by authenticated account and page identity.
- Only compatible same-revision drafts are offered for recovery.
- Sensitive values are excluded from browser draft persistence.
- Drafts clear after successful server save.
- Page operation and save-identity regression checks exist.

## Image Handling

- Editor images are oriented, resized, compressed, and deduplicated before storage.
- Gallery images are processed sequentially with progress feedback.
- Image optimization has dedicated QA coverage.

## Forms, Leads, Inbox, And Stats

- Real-browser consultation and reservation submission regression exists.
- Rapid repeated submission locking is covered.
- Duplicate blocking and inbox reflection are covered.
- Blocked lead history is server-authoritative and paginated.
- Month-bounded CSV and useful duplicate fields exist.
- Stats filters and chart spacing have been stabilized.

## Live Integration Foundations

- AWS SES auth-email delivery implementation exists.
- SES readiness and hosted behavior checks exist.
- User-facing mail errors hide provider internals.
- Google Sheets OAuth connect, status, refresh, delivery, header generation, and disconnect flows exist.
- Deployment route smoke contracts block broken live route/function releases.

## Browser And Deployment Regression

- Authenticated editor browser regression exists.
- Public landing browser regression exists.
- Form/reservation browser regression exists.
- 360px, 390px, and 430px mobile operation checks exist in the editor flow.
- Preview/public parity and fixed-bottom UI contracts exist.

# Active Remaining Patches

Patch in the following order unless the owner explicitly changes priority.

## Priority 1 — One-Page Policy Production Verification

The policy is implemented. This is an operational regression pass, not a redesign.

Required verification:

- A new general account can create its first page.
- A general account with one active page cannot create a second page from dashboard controls.
- Direct API creation attempts return `409` with `ACCOUNT_PAGE_LIMIT_REACHED`.
- Existing page save, revision, restore, preview, and publish remain functional.
- A platform-master account can create multiple pages.
- Platform-master state remains after logout/login and session refresh.
- Google-login accounts follow the same quota policy.
- Archived/deleted projects do not produce a false active-page count.
- Manager/member access cannot create a second owner page through a different UI path.

Do not weaken the server limit to fix a frontend display issue.

## Priority 2 — Custom Domain Product Completion

Current page URL and duplication foundations do not prove a complete customer-facing custom-domain product flow.

Required work:

- Default Pagero domain plus validated slug.
- Customer custom-domain input.
- Domain ownership/DNS instructions.
- Domain states: `pending`, `verifying`, `active`, `failed`, and removable/disconnected state.
- SSL readiness/status.
- Duplicate-domain ownership protection.
- Reconnect and detach behavior.
- Public URL, canonical URL, preview, and share URL synchronization.
- Operator view for failed or stuck domain verification.
- Domain-agnostic stored fields; do not hard-code the current Pages preview hostname into page records.
- Compatibility with the one-page general-account policy.

Page duplication remains a later paid feature. Do not make template duplication a product feature.

## Priority 3 — Admin And Audit Completeness Review

Inspect current D1 schema, API, and internal admin UI first. Patch only confirmed gaps.

Required capabilities:

- Audit rows for signup and verification.
- Login failure category without exposing secrets.
- Password, name, email, and phone changes.
- Account suspension, restoration, and deletion-state changes.
- Manager invite, acceptance, permission change, and removal.
- Ownership-transfer request, approval, rejection, cancellation, and completion.
- Project pause/archive/restore actions.
- Platform-master manual actions.
- Search/filter by account, project, action, actor, and date.
- Audit records must not be silently deleted through normal operator actions.

Internal admin remains route-only and must not appear as public workspace navigation.

## Priority 4 — Live Integration Production Verification

Do not reimplement integrations already present. Verify actual production credentials and behavior.

Required live checks:

- SES domain identity, DKIM, SPF, and DMARC.
- SES production access when the AWS account is sandboxed.
- Real signup verification email.
- Real password-reset email.
- Real manager-invite email.
- Ownership-transfer approval/rejection email.
- Generic user-facing failure copy.
- Internal classification for not configured, quota, timeout, provider error, sandbox, and domain verification failure.
- Google Sheets OAuth connect with production redirect URI.
- Token refresh after expiry.
- Lead row delivery with submitted-field headers.
- Disconnect immediately stops future delivery.
- Delivery retry/dead-letter visibility where applicable.
- Conversion tracking credentials and real event receipt where configured.
- Missing credentials remain `skipped-live`, not a false product failure.

Never expose provider credentials, verification tokens, access tokens, or raw internal errors to the browser.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly these three templates:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Do not add more templates and do not replace them with non-editable HTML shells.

Required verification at 360px, 390px, and 430px:

- Finished first viewport, not a builder demo.
- No instructional, editor-guide, sample-usage, or placeholder explanation copy in public output.
- Every visible section remains editable through existing blocks.
- No overlap among top navigation, hero, share button, forms, timer, and bottom fixed UI.
- Mobile keyboard does not hide active fields or submission controls.
- Gallery, map, FAQ, and form interactions remain usable.
- Preview and public output remain visually aligned.
- Premium effects remain intentional, non-blocking, and motion-reduction aware.

Personal rehabilitation copy must not guarantee approval or legal outcome.

## Priority 6 — Remaining Product And Operations Hardening

Inspect before implementing. Complete only gaps proven in current behavior.

- Custom-domain rollback and support runbook.
- D1 schema backup/rollback procedure.
- Operator release checklist with current command names.
- Retention and cleanup policy for logs, blocked submissions, delivery logs, and audit rows.
- Large-data inbox/stat query verification using D1 aggregation.
- Abuse/rate-limit operator visibility without exposing raw IP when only hashes are stored.
- Accessibility and keyboard regression for new account/domain/admin UI.

# Final Phase — Plans, Billing, And Subscription

Start only after Priorities 1 through 6 are stable.

## Plan Direction

Maximum plan ceiling remains under KRW 9,900.

Target paid ladder:

- KRW 3,300
- KRW 6,600
- KRW 9,900

Final entitlements must be explicitly defined before checkout implementation:

- active pages
- page duplication
- monthly leads
- stats retention
- manager count
- custom domain
- conversion tracking
- integration limits where applicable

## Required Billing Architecture

- Server-side entitlement enforcement.
- Payment-provider abstraction before provider-specific code.
- Toss Payments or another owner-selected provider after abstraction.
- Checkout.
- Billing key/card registration.
- Subscription renewal.
- Cancel-at-period-end.
- Payment failure and grace period.
- Webhook signature verification.
- Idempotency before accepting payment-state changes.
- Payment history and receipt/invoice link storage.
- Admin manual billing override with audit log.
- Payment credentials server-only.

Do not use frontend-only plan locks as the final entitlement system.

# Execution Protocol For Every Patch

## Before Editing

1. Confirm repository and branch: `pc9839a-lgtm/inlet` / `main`.
2. Fetch current remote state.
3. Read `AGENTS.md` and `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`.
4. Read this document and any task-specific handoff.
5. List exact allowed files for the patch.
6. Exclude protected production-home files unless the owner explicitly requested home changes.
7. Check recent commits so completed work is not repeated.

## During Editing

- Keep one patch group focused on one product problem.
- Avoid unrelated cleanup and broad formatting.
- Preserve working API, auth, storage, routing, and public behavior outside scope.
- Add or update direct regression QA with the implementation.
- Stop and report scope conflicts instead of silently widening the patch.

## Before Commit

At minimum verify:

- changed-file list
- no unintended protected-home diff
- targeted QA
- build
- affected browser flow
- preview/public parity when renderer or CSS changes
- desktop and 360/390/430px behavior for visible UI
- no mojibake or broken Korean copy

## Before Production Deployment

Run the current full required QA and release checks, including the relevant commands from `package.json`:

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

Also run feature-specific QA where applicable, including:

```bash
npm run account:page-limit:qa
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

A skipped live check must identify the exact missing credential or external approval. It must not be reported as a completed live verification.

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

When one of these appears broken, reproduce it first and patch the smallest confirmed regression rather than rebuilding the feature.
