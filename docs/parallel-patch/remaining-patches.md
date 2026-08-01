# Pagero Remaining Patches

Updated: 2026-08-01 20:55 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Current candidate: PR `#42` / `agent/account-page-limit-production-verification`

Open custom-domain candidate: PR `#41` / `agent/custom-domain-foundation`

Current execution mode: parallel patching is active

This document must be updated at the end of every patch. Code completion, QA completion, merge, deployment, and production verification are separate states.

## Parallel Worker Split

1. Worker 1: account, auth, email verification, sessions, member data
2. Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV
3. Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates
4. Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow
5. Worker 5: QA, deployment, live integration readiness, docs and ops

## Current Patch Checkpoint — PR #42

- Existing one-page account policy: merged through PR `#40`.
- Google-login quota regression: complete.
- Manager-role bypass regression: complete.
- Manual production verification script: complete.
- Manual GitHub Actions workflow: complete.
- Six-fixture preparation and cleanup runbook: complete.
- `skipped-live` false-success prevention contract: complete.
- Targeted QA: complete.
- Full offline QA: complete.
- Landing browser regression: complete.
- Authenticated editor browser regression: complete.
- Form and reservation browser regression: complete.
- Protected production-home file changes: none.
- PR `#42`: open.
- Merge to `main`: not completed.
- Production fixture secrets: not configured or verified by this code patch.
- Production live-write workflow result: not completed.
- Production verification status: **not verified live**.

The implementation and QA tooling are complete. Do not call the account policy production-verified until the manual workflow returns `verified-live` against the intended deployed commit and cleanup evidence is saved.

## Open Custom-Domain Checkpoint — PR #41

- Domain connection, DNS, SSL, provider registration, host routing, retries, escalation, operator list, scheduled recheck, and runbook: code and QA complete.
- Merge to `main`: not completed.
- Production D1 migrations `0006` and `0007`: not completed.
- Production Cloudflare environment configuration: not completed.
- Production deployment: not completed.
- Real customer-domain smoke test: not completed.

The custom-domain feature is not production complete.

## Source Of Truth Order

1. `AGENTS.md`
2. `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
3. `docs/PAGERO_PLAN_POLICY_KO.md`
4. This document
5. Task-specific operations documents
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

Protected scope:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root and public-home routing inside `src/App.jsx`
- public-home components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

Stop if unrelated work changes a protected production-home file or required production signal.

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

The old 3,300원 / 6,600원 / 9,900원 direction is discarded. Do not add a third paid plan or invent entitlements before owner approval.

## Sharing And Deployment

- Global sharing uses `page.share` and remains separate from the bottom bar.
- Share URLs use the public page URL, not editor or dashboard URLs.
- Never force-push `main`.
- Do not construct releases with destructive reset, clean, or restore operations.
- Do not mix unrelated refactors into a patch.
- Run targeted QA and the full suite before merge or deployment.
- Production deployment requires explicit owner approval.

# Completed Baseline — Reopen Only After Reproducing A Regression

## Account And Page Policy

- General-account one-active-page policy.
- Platform-master email policy and unlimited quota.
- Server middleware returning `ACCOUNT_PAGE_LIMIT_REACHED`.
- Frontend creation lock and modal guard.
- Existing-page replay and update allowance.
- Login and session platform-master state.
- Role-string bypass protection.
- Archived/deleted project exclusion.
- Existing `account:page-limit:qa` coverage.

## Account Page-Limit Production Verification Infrastructure — PR #42

- Live script: `scripts/account-page-limit-production-check.mjs`.
- Manual-only workflow: `.github/workflows/account-page-limit-production-verify.yml`.
- Fixture types: empty general, occupied general, archived general, platform master, Google general, manager/member.
- Explicit write gate and required-live gate.
- `qa-limit-*` disposable pages and reverse cleanup.
- First create, second-create `409`, save, revision list, revision preview, restore, public read, delete/recreate, archived exclusion, platform-master multiple pages, Google quota, and manager bypass checks.
- `skipped-live`, `verified-live`, and `failed-live` result separation.
- Workflow artifact retention for release evidence.
- Runbook: `docs/ops-account-page-limit-production-verification.md`.
- Contract QA registered in `qa:all`.

This is verification infrastructure, not live production evidence.

## Editor, Landing, Forms, And Integration Baseline

- Balanced top navigation for one through eight items.
- Independent sharing with four positions.
- Form-focus fixed-UI collision handling.
- Three timer layouts and shared countdown clock.
- Declarative bottom timer and fixed-UI collision QA.
- Account-scoped draft recovery and delayed-save isolation.
- Image resize, orientation, compression, and deduplication.
- Consultation and reservation browser regression.
- Server-backed blocked history and month-bounded CSV.
- AWS SES and Google Sheets integration foundations.

## Custom-Domain Code And QA Baseline — PR #41

- D1 ownership and lifecycle schema.
- Cloudflare Pages domain registration and deletion.
- DNS, SSL, host routing, and duplicate ownership protection.
- Operator list, bounded retries, escalation, and scheduled recheck.
- Detach, reconnect, migration, and rollback runbook.

This baseline remains branch-only until PR `#41` is merged and deployed.

# Active Remaining Patches

## Priority 1 — Execute One-Page Policy Live Verification

Preparation:

1. Create six disposable QA fixtures described in `docs/ops-account-page-limit-production-verification.md`.
2. Store their signed sessions in the six `PAGERO_PAGE_LIMIT_*_SESSION` GitHub secrets.
3. Confirm the archived fixture has archived evidence but zero active pages.
4. Confirm no fixture belongs to a real customer.

Execution:

1. Manually run **Account Page Limit Production Verify**.
2. Select the intended deployed URL and commit.
3. Set `allow_writes=true` only after fixture review.
4. Keep `require_live=true`.
5. Require final status `verified-live`.
6. Save workflow run ID, deployment ID, commit SHA, and the 30-day artifact.
7. Confirm all `qa-limit-*` pages were removed.

Until this is done, the policy remains implemented and QA-covered but not production-verified.

## Priority 2 — Custom-Domain Operational Rollout

1. Apply `migrations/0006_page_domains.sql` to production D1.
2. Apply `migrations/0007_page_domain_operations.sql` immediately afterward.
3. Verify schema and rollback evidence.
4. Configure Cloudflare account ID, Pages project, minimum-permission API token, CNAME target, and recheck secret.
5. Configure the matching GitHub Actions secret.
6. Merge PR `#41` only when migration and environment ordering is safe.
7. Deploy only after explicit owner approval.
8. Verify real DNS, SSL, landing routing, forms, reservations, assets, tracking, URLs, duplicate ownership, detach/reconnect, retries, and escalation.

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

- SES identity, DKIM, SPF, DMARC, and production access.
- Real verification, reset, invite, and ownership-transfer messages.
- Generic user errors and classified internal errors.
- Google Sheets production OAuth, refresh, row delivery, disconnect, and retry visibility.
- Real conversion events where configured.
- Missing credentials remain `skipped-live`, not false failure or false success.
- Never expose provider secrets or raw errors.

## Priority 5 — Three Template Mobile Final Regression

Keep exactly:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Verify at 360px, 390px, and 430px: finished first viewport, no instructional copy, editable visible blocks, no fixed-UI overlap, keyboard-safe forms, usable gallery/map/FAQ/forms, preview/public parity, and reduced-motion-aware effects. Personal-rehabilitation copy must not guarantee approval or legal outcome.

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

1. Update date, branch, PR, and checkpoint.
2. Separate code complete, QA complete, merged, deployed, and production verified.
3. Move completed implementation into the completed baseline.
4. Remove completed work from the active list.
5. Reorder priorities based on reality.
6. Record missing migrations, credentials, approvals, and live evidence.
7. Include the refreshed remaining-patch summary in the user response.

Do not claim production completion from a branch-only, mock-only, or `skipped-live` result.

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

Feature-specific commands:

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
