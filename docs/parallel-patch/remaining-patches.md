# Pagero Remaining Patches

Updated: 2026-08-01 20:45 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current patch branch: `agent/account-page-limit-production-verification`

Open custom-domain candidate: PR `#41` / `agent/custom-domain-foundation`

Current execution mode: parallel patching is active

This document must be updated at the end of every patch. Code completion, QA completion, merge, deployment, and production verification are separate states. A patch is not fully complete until the state written here matches reality.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow
5. Worker 5: QA, deployment, live integration readiness, docs and ops

## Current Patch Checkpoint — One-Page Policy Production Verification

- Existing one-page policy implementation: merged through PR `#40`.
- Offline general-account and platform-master regression QA: existing and extended.
- Google-login quota regression case: code complete on the current branch.
- Manager-role quota-bypass regression case: code complete on the current branch.
- Manual production verification script: code complete on the current branch.
- Manual GitHub Actions workflow: code complete on the current branch.
- Disposable fixture and cleanup runbook: complete on the current branch.
- Targeted QA: pending.
- Full offline QA: pending.
- Landing browser regression: pending.
- Authenticated editor browser regression: pending.
- Form and reservation browser regression: pending.
- Pull request: not opened yet.
- Merge to `main`: not completed.
- Production workflow secrets: not configured or verified in this patch.
- Production live write verification: not completed.

Do not describe the one-page policy as production-verified until the manual workflow reports `verified-live` against the intended deployed commit and cleanup evidence is recorded.

## Open Custom-Domain Checkpoint — PR #41

- Connection, DNS, SSL, provider registration, host routing, retries, escalation, operator list, scheduled recheck, and runbook: code and QA complete on PR `#41`.
- Merge to `main`: not completed.
- Production D1 migrations `0006` and `0007`: not completed.
- Production Cloudflare environment configuration: not completed.
- Production deployment: not completed.
- Real customer-domain smoke test: not completed.

Do not describe the custom-domain feature as production complete.

## Source Of Truth Order

1. `AGENTS.md`
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
3. `docs/PAGERO_PLAN_POLICY_KO.md`
4. This document
5. Task-specific handoff and operations documents
6. Current `main` code and recent commits
7. Old worker documents as historical context only

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
- Required command references: `deployment:qa`, `npm run live:qa`

# Absolute Rules

## Production Home Is Frozen

Unless the owner explicitly requests a production-home change, do not modify the visible design, copy, section order, menu, footer, hero, animation, login/start behavior, or responsive result of `https://pagero.kr/`.

Protected scope includes:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root and public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Stop if unrelated work changes a protected production-home file or required production-home signal.

## General Account Page Limit Must Stay Enforced

- General account: one active landing page.
- Platform-master account: unlimited pages.
- Frontend and API enforcement must both remain.
- Forged role strings must not bypass the policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived and deleted projects do not consume the active-page quota.
- Google-login accounts follow the same policy.
- Manager or member access cannot create another owner page.
- Default platform-master emails and `INLET_PLATFORM_MASTER_EMAILS` are the only approved bypass source.

## Paid Plans Are Locked To Two

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The old 3,300원 / 6,600원 / 9,900원 direction is discarded. Do not add a third paid plan. Do not invent plan entitlements before owner approval.

## Sharing And Deployment

- Global sharing uses `page.share` and remains separate from the bottom bar.
- Share URLs must use the public page URL, not editor or dashboard URLs.
- Never force-push `main`.
- Do not use destructive reset, clean, or restore operations to construct a release.
- Do not mix unrelated refactors into a patch.
- Run targeted QA and the full suite before merge or deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Reopen Only After Reproducing A Regression

## Account And Page Policy

- General-account one-page policy model.
- Platform-master email policy.
- Server-side creation middleware returning `ACCOUNT_PAGE_LIMIT_REACHED`.
- Frontend creation-control lock state.
- Existing-page replay and update allowance.
- Login, Google login, and session responses preserving account identity.
- Role-string quota bypass blocked.
- Archived/deleted project exclusion in the server count query.
- Existing `account:page-limit:qa` registered in `qa:all`.

## Account Page-Limit Verification Infrastructure — Current Patch

- Manual live script at `scripts/account-page-limit-production-check.mjs`.
- Manual-only workflow at `.github/workflows/account-page-limit-production-verify.yml`.
- Six dedicated fixture types: empty, occupied, archived, platform master, Google, and manager.
- Explicit write gate through `INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1`.
- Required-live gate that rejects `skipped-live` evidence.
- Disposable `qa-limit-*` page creation and reverse-order cleanup.
- Live checks for first create, second-create `409`, existing save, revisions, preview, restore, public read, delete/recreate, archived exclusion, platform-master multiple pages, Google quota, and manager bypass.
- Contract QA that proves missing secrets cannot create a false live success.
- Operations runbook at `docs/ops-account-page-limit-production-verification.md`.

This infrastructure is not itself production verification. A real workflow result of `verified-live` is still required.

## Editor, Landing, Forms, And Integrations

- Top navigation supports one through eight balanced items.
- Sharing has native and clipboard paths with four persisted positions.
- Form-focus collision handling exists.
- Three timer layouts and one shared countdown clock exist.
- Bottom timer rendering and fixed-UI collision coverage exist.
- Account-scoped draft recovery and delayed-save isolation exist.
- Image orientation, resize, compression, and deduplication exist.
- Consultation and reservation browser regression exists.
- Server-backed blocked-submission history and month-bounded CSV exist.
- AWS SES and Google Sheets integration foundations exist.

## Custom-Domain Code And QA Baseline — PR #41

- D1 domain ownership and lifecycle schema.
- Cloudflare Pages registration, deletion, DNS, SSL, and host routing.
- Duplicate ownership and client-forged state protection.
- Operator list, bounded retries, escalation, and scheduled recheck.
- Detach/reconnect and rollback runbook.

This baseline remains on PR `#41`; it is not production-deployed.

# Active Remaining Patches

## Priority 1 — Execute One-Page Policy Live Verification

Preparation:

1. Create six disposable QA fixtures described in `docs/ops-account-page-limit-production-verification.md`.
2. Store their sessions in the six `PAGERO_PAGE_LIMIT_*_SESSION` GitHub secrets.
3. Confirm the archived fixture has retained archived evidence but zero active pages.
4. Confirm no fixture belongs to a real customer.

Execution:

1. Manually run **Account Page Limit Production Verify**.
2. Set the intended deployed URL.
3. Set `allow_writes=true` only after reviewing the fixtures.
4. Keep `require_live=true`.
5. Require final status `verified-live`.
6. Save the 30-day workflow artifact and record workflow run ID, deployment ID, and commit SHA.
7. Confirm all `qa-limit-*` pages were removed.

Required live evidence:

- New general account first page succeeds.
- Second dashboard/API creation is blocked with `409 / ACCOUNT_PAGE_LIMIT_REACHED`.
- Existing save, revision list, revision preview, restore, and public read work.
- Deleting the QA page allows a replacement.
- Archived project does not create a false count.
- Platform master creates two pages and survives session refresh.
- Google-login account follows the same quota.
- Manager/member path returns `403` or `409` and creates nothing.

## Priority 2 — Custom-Domain Operational Rollout

Before merge or deployment:

1. Apply `migrations/0006_page_domains.sql` to production D1.
2. Apply `migrations/0007_page_domain_operations.sql` immediately afterward.
3. Verify the schema and record rollback evidence.
4. Configure the Cloudflare account ID, Pages project, minimum-permission API token, CNAME target, and recheck secret.
5. Configure the matching GitHub Actions secret.
6. Merge PR `#41` only when migration and environment ordering is safe.
7. Deploy only after explicit owner approval.

Live verification must cover real DNS, SSL, correct landing host routing, forms, reservations, assets, tracking, share/canonical URLs, duplicate ownership, detach/reconnect, retries, and escalation.

## Priority 3 — Admin And Audit Completeness Review

Patch only confirmed gaps after inspecting current code:

- Signup and verification audit.
- Classified login failure audit without secrets.
- Profile, password, account-status, and deletion-state changes.
- Manager invite, acceptance, permission change, and removal.
- Ownership-transfer lifecycle.
- Project pause, archive, and restore.
- Platform-master manual actions.
- Search by account, project, action, actor, and date.
- Protection against silent audit deletion.

The internal admin surface remains route-only.

## Priority 4 — Live Integration Production Verification

AWS SES:

- Domain identity, DKIM, SPF, DMARC, and production access.
- Real verification, reset, invite, and ownership-transfer messages.
- Generic user errors and classified internal errors.

Google Sheets:

- Production OAuth redirect URI and token refresh.
- Real lead-row delivery with submitted-field headers.
- Disconnect immediately stops future delivery.
- Retry and failed-delivery visibility.

Also verify real conversion events and preserve `skipped-live` for missing credentials. Never expose provider secrets or raw errors.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify at 360px, 390px, and 430px: finished first viewport, no instructional copy, editable visible blocks, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ/forms, preview/public parity, and intentional reduced-motion-aware effects. Personal-rehabilitation copy must not guarantee approval or legal outcome.

## Priority 6 — Product And Operations Hardening

- D1 backup and migration rollback execution evidence.
- Current operator release checklist.
- Retention and cleanup policy for logs and audit data.
- Large-data inbox and stats query verification.
- Abuse visibility without raw IP exposure.
- Accessibility and keyboard regression for account, domain, and admin UI.
- Previous-deployment rollback procedure.

# Final Phase — Plans, Payment, And Subscription

Start only after Priorities 1 through 6 are stable.

Approved products:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

The owner must define the Classic/Pro entitlement difference before checkout work. Then implement server entitlements, provider abstraction, checkout/billing key, renewal, period-end cancellation, grace period, signed and idempotent webhooks, payment history, receipts, and audited admin override.

# Mandatory Closeout For Every Future Patch

Before the final user response:

1. Update the date, branch, PR, and commit checkpoint in this document.
2. Separate code complete, QA complete, merged, deployed, and production verified.
3. Move genuinely completed implementation into the completed baseline.
4. Remove completed work from the active list.
5. Reorder remaining priorities based on reality.
6. Record missing migrations, environment variables, credentials, approvals, and live evidence.
7. Include the refreshed remaining-patch summary in the user response.

Do not claim production completion from a branch-only or mock-only result.

# Required QA Before Merge Or Deployment

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

Feature-specific commands include:

```bash
npm run account:page-limit:qa
npm run account:page-limit:live:contract:qa
npm run account:page-limit:live
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
