# Pagero Remaining Patches

Updated: 2026-09-17 10:29 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Production code baseline before this documentation-only update: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`

Documentation branch: `docs/pagero-remaining-patches-20260917`

This document is the current backlog and execution-order source of truth for **PageRo landing creation, editor, publishing, account, integration, billing, and operations work**.

Code complete, QA complete, merged, deployed, and production verified are separate states. A branch, mock, screenshot, CI pass, or `skipped-live` result alone is not production completion.

# 1. 2026-09-17 Production Recovery Checkpoint

The protected PageRo production home was accidentally changed by PR `#230` and PR `#231` after the root identity was inferred from component names instead of the repository handoff rules.

Recovery was completed by restoring the last verified pre-incident tree without force-pushing or rewriting history.

- last verified pre-incident code commit: `935e6cb37ab22a553f9b30dfaa68711e1768efde`
- restored tree: `8c757f1e6a951a3b11c7c290a649220817baea80`
- recovery commit on `main`: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`
- reverted effects: PR `#230` and PR `#231`
- force push: **not used**
- production deployment after recovery: `https://05a7e004.inlet-8mr.pages.dev`
- production readiness: passed
- exact deployment readiness: passed
- production save → D1 → authenticated readback → public readback roundtrip: passed

Do not re-apply the root identity assumptions from PR `#230` or PR `#231`.

# 2. Absolute Production Home Lock

`https://pagero.kr/` is a frozen production baseline.

Unless the owner explicitly requests a production-home change, do not change its visible design, copy, section order, menu, footer, hero, animation, lifestyle bridge, login/start behavior, or responsive result.

Before any PageRo task:

1. Read `AGENTS.md`.
2. Read `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`.
3. Confirm the task is not a production-home change.
4. Exclude protected-home files from the patch unless the owner explicitly overrides the lock.
5. Verify the actual production URL, not only local Vite or component names.

Protected production-home scope includes at minimum:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- `src/screens/PublicHomeRoute.jsx`
- public-home screen components and styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static routing inside `server/index.mjs`

The production `/` source of truth is the frozen Pages Function path described in the handoff document. Do not replace it because another React component name appears newer or more canonical.

Stop deployment if an unrelated patch changes protected-home files.

# 3. Baseline Completed Since The Old 2026-08-02 Backlog

The previous version of this document is stale. The following items must no longer be treated as unmerged backlog merely because the old document says so.

## PR #44 — Three-template mobile regression

Merged to `main` on 2026-08-02.

Baseline now includes:

- three active templates
- 360 / 390 / 430 px real-browser regression
- gallery interaction coverage
- form keyboard/fixed-UI coverage
- Korean-font screenshot evidence
- mobile touch-target fixes

Do not create a new task to "merge PR #44".

## PR #42 — One-page policy production verifier

Merged to `main` on 2026-08-03.

Baseline includes the production-verification workflow for:

- general-account one-active-page policy
- platform-master bypass policy
- Google-login parity
- manager/member bypass prevention
- fixture cleanup and residue checks

The remaining work is **production verification where still unverified**, not re-implementing or re-merging PR #42.

## PR #43 — Administrator and audit hardening

Merged to `main` on 2026-08-03.

Baseline includes administrator/audit verification tooling and retention workflow foundations.

The remaining work is **production verification and operations evidence where still missing**, not re-merging PR #43.

## Editor interaction foundations

Treat these as baseline unless current production evidence proves a regression:

- native sharing
- four persisted share positions
- form/reservation focus hides top navigation, share, and bottom fixed UI
- timer style/effect foundations
- preview/public fixed-UI parity
- save identity and revision conflict protection
- local draft/recovery foundations
- editor browser regression infrastructure
- template/mobile browser regression infrastructure

Do not revive an old editor PR solely because it is still open. Compare it with current `main` first.

# 4. Stale/Open PR Handling Rules

Open does not mean current.

## PR #41 — Custom domain

Status: **still open / draft / not merged**.

This is the only major old PageRo product branch that still maps to a genuinely unfinished capability, but it must **not** be merged as-is.

Reasons:

- it was built against an old `main`
- migration numbering and operational assumptions have changed
- current `main` already contains later migrations and D1 tooling
- the branch has accumulated a large historical delta

Required approach:

1. Start from current `main`.
2. Re-audit the current schema and migration history.
3. Extract only the still-needed custom-domain product behavior.
4. Assign safe new migration numbers only after remote preflight.
5. Re-run current QA and live verification.
6. Never mix production-home changes into the port.

## PR #162 / #163 / #100 and similar old editor branches

Do not merge them merely because their original UX or save issue still sounds relevant.

Current `main` has received substantial later editor/save work. For any old editor PR:

- reproduce the issue on current `main` first
- compare the old patch against current code
- port only a still-missing minimal fix
- never restore an old full layout or old save flow wholesale

## PR #45 and other old D1-safety branches

Current `main` already contains `.github/workflows/d1-migration-safety.yml` and later migration tooling.

Do not merge an old D1-safety branch wholesale. Use current-main tooling and current remote state.

# 5. Current Product Policies That Stay Locked

## Account policy

- General account: one active landing page.
- Platform master: unlimited landing pages and administrator API eligibility.
- Frontend and API enforcement both remain required.
- Role-string forgery must not bypass page or administrator policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived projects do not consume the active-page quota.
- Google-login accounts follow the same page policy.
- Manager/member access cannot create another owner page.

## Active templates

Keep exactly the currently approved three active templates unless the owner explicitly changes product direction:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

Do not replace editable templates with static HTML shells.

## Paid plans

Approved paid plans remain:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not reintroduce discarded pricing or create a third plan without owner approval.

# 6. Active Remaining Work — Current Priority Order

This is the current execution order as of 2026-09-17.

## Priority 1 — Rebuild Custom Domain On Current Main

Goal: safely complete customer-owned domain support without reviving stale PR #41 wholesale.

Required product behavior:

- connect a customer domain to the correct PageRo page
- verify ownership and prevent duplicate ownership
- register/manage the Cloudflare Pages custom domain
- show DNS and SSL status
- support explicit detach before replacement
- prevent orphaned provider mappings
- support safe recheck/retry/escalation
- route the custom-domain root to the correct public landing
- return safe noindex/error states for invalid or inactive hosts

Before implementation:

1. Inspect current migration files and remote migration history.
2. Run current D1 migration preflight.
3. Resolve migration numbering from actual remote state; do not reuse stale `0006`/`0007` assumptions.
4. Port the smallest current-main-compatible subset of PR #41.

Acceptance:

- controlled test domain connect succeeds
- DNS status is correct
- SSL reaches active
- public page loads with assets/forms/reservations intact
- duplicate ownership is rejected
- detach/reconnect is deterministic
- provider mapping cleanup is proven
- protected PageRo production home is unchanged

## Priority 2 — Close Production Verification Gaps For Existing Features

Do not rebuild already-implemented features. Run the existing production-verification tools and patch only reproduced failures.

Verify at minimum:

### Account / page policy

- normal account first page succeeds
- second active page is rejected
- existing page editing still works
- archived project handling is correct
- platform master can manage multiple pages
- Google login follows the same quota
- manager/member access cannot bypass owner quota

### Administrator / audit

- administrator authorization uses the approved platform-master boundary
- audit rows contain no raw password/token/session/private PII
- retention workflow behaves correctly
- account/project controls work with audit evidence

### Authentication email / SES

- email verification
- password reset
- email change
- invitations/ownership transfer where applicable
- DKIM/SPF/DMARC/provider readiness evidence

### Google Sheets

- OAuth connect
- token refresh
- one-row delivery
- idempotency
- disconnect
- failure/retry visibility
- cleanup of QA fixtures

### Conversion tracking

- configured conversion events fire with expected event semantics
- no raw lead PII is sent
- duplicate suppression works

Missing credentials or fixtures must be reported as `not verified` / `skipped-live`, not product success and not product failure.

## Priority 3 — Finish Web Billing And Subscription

Current server readiness explicitly reports web billing as not available:

- `available: false`
- `stage: pre_checkout`
- message: `웹 결제 checkout과 webhook을 준비하고 있습니다.`

Therefore paid self-serve web billing is **not complete**.

Required architecture:

- checkout session / billing key flow
- server-side product and entitlement mapping
- signed/idempotent provider webhook processing
- successful payment activation
- renewal
- failed renewal / grace period policy
- period-end cancellation
- payment history
- receipt/invoice surface where supported
- audited administrator override
- replay-safe webhook handling
- no client-only entitlement trust

Do not mark paid web launch ready until a real test subscription completes the full lifecycle.

## Priority 4 — Large-Data And Operations Hardening

Verify with realistic data volume rather than only small fixtures.

Scope:

- inbox pagination under thousands/tens-of-thousands of leads
- statistics query performance over larger date ranges
- month-bounded and large CSV export
- blocked/spam history growth
- delivery-log retention
- audit-log retention
- AI draft/cache cleanup where applicable
- backup retention
- rate-limit/abuse visibility without raw IP exposure
- index/query-plan review where measurements justify it

Acceptance must include measured production-like evidence, not only static code review.

## Priority 5 — Current Editor Real-Use Audit

Do not start by merging old editor branches.

Audit the current production/current-main flow end to end:

`page create/open → block add → text/image/video edit → reorder → page options → save/publish → reload → public readback`

Verify:

- block add/search/category/recent flow
- selected-block editing
- image upload and existing-image reuse
- video upload/reuse and supported URL playback
- undo/redo
- revision restore
- save while continuing to type
- stale server response cannot overwrite newer local edits
- conflict/recovery behavior
- page switch / logout / reload unsaved protection
- preview/public parity
- editor width/overflow at narrow desktop widths
- mobile touch targets where editor mobile UI is exposed

Only create patches for defects reproduced on current code or current production.

## Priority 6 — Accessibility, Keyboard, And Mobile Final Pass

Scope:

- keyboard navigation order
- visible focus
- dialog/modal focus behavior
- Escape behavior
- 44 px touch targets where required
- 360 / 390 / 430 px public layouts
- form keyboard viewport behavior
- fixed UI collision
- screen-order controls without pointer-only dependency
- labels and accessible names
- contrast for actionable controls

This is a regression and usability pass, not a broad redesign.

## Priority 7 — Backup, Migration, Deployment, And Rollback Closeout

Required operating evidence:

- D1 remote preflight
- exact pending migration list
- encrypted backup before write-side migration
- post-migration verification
- disposable restore drill where applicable
- release checklist
- current deployment SHA recording
- readiness verification
- save/readback verification
- previous-deployment rollback procedure
- narrow bad-commit revert procedure

Never force-push `main`.

Never use destructive reset/clean/restore operations to construct a production rollback.

When a deployment incident is isolated to one or more bad commits, preserve history and revert the minimal bad scope.

# 7. Live-Screen Verification Contract

A green build is not visual production verification.

For every UI patch, verify the actual deployed screen together with code/CI evidence.

## Frozen root

For `https://pagero.kr/`:

- compare the actual production URL against the protected baseline
- verify desktop and mobile behavior
- verify required root DOM signals from `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`
- do not infer root identity from React component names

## Authenticated internal screens

For editor/settings/dashboard/admin screens:

- code review alone is insufficient to claim live-screen correctness
- use an authenticated production browser test, controlled QA account, or owner-provided production screenshot/session evidence
- if authenticated live access is unavailable, explicitly mark visual production verification as pending

## Public customer pages

Verify at least:

- desktop
- 360 px
- 390 px
- 430 px
- form focus / keyboard state
- fixed UI
- media assets
- save/publish readback

# 8. Current Main Migration Caution

Do not assume migration numbers from old PR descriptions are still available.

Current `main` contains historical numbering complexity, including multiple `0006_*` files and later `0008`, `0009`, `0010+` migrations.

Therefore:

1. local file order is not enough to decide production pending state
2. remote migration history is authoritative for rollout planning
3. custom-domain work must not reuse stale migration numbers without preflight
4. no production migration write occurs without explicit write approval and backup gate

# 9. Required QA Before Merge Or Deployment

Use current `package.json` as the command source of truth. At minimum, keep the release-blocking coverage represented by:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

Where the current repository still exposes the corresponding contracts, also run:

```bash
npm run preview:parity:qa
npm run bottom:fixed:qa
npm run topnav:balance:qa
npm run deployment:smoke:contract:qa
npm run browser:production:qa
npm run live:qa
```

Do not copy obsolete commands from this document if `package.json` no longer defines them; update the document instead.

# 10. Deployment Rules

- Never force-push `main`.
- Do not mix unrelated refactors into focused patches.
- Do not deploy a branch simply because CI is green.
- Production deployment requires explicit owner approval.
- A docs-only `main` push can still trigger the QA → Cloudflare production workflow; use a non-main documentation branch/PR when production deployment was not approved.
- Protected-home files must remain unchanged for unrelated work.

# 11. Mandatory Patch Closeout

At the end of every patch:

1. Record date, branch, PR, and exact head SHA.
2. Separate `code complete`, `QA complete`, `merged`, `deployed`, and `production verified` states.
3. Record actual live-screen verification scope.
4. Move completed implementation into the baseline.
5. Remove superseded/stale work from the active list.
6. Record missing migrations, credentials, approvals, fixtures, and live evidence.
7. Do not claim production completion from branch-only, mock-only, screenshot-only, CI-only, or `skipped-live` evidence.
8. Re-read the production-home lock before the next unrelated task.
