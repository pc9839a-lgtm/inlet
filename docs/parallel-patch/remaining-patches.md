# Pagero Remaining Patches

Updated: 2026-09-17 KST

Repository: `pc9839a-lgtm/inlet`

Production branch: `main`

Verified production-code baseline before the current patch series: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`

This document is the current execution-order source of truth for PageRo editor, publishing, account, integrations, billing, and operations work.

`code complete`, `QA complete`, `merged`, `deployed`, `migration applied`, and `production verified` are separate states. Branch-only, mock-only, screenshot-only, CI-only, or `skipped-live` evidence is not production completion.

# 1. Production Recovery Checkpoint

On 2026-09-17 the protected PageRo production home was accidentally changed by PR `#230` and PR `#231` after root identity was inferred from component names rather than the repository handoff rules.

Recovery was completed without force-push or history rewriting.

- last verified pre-incident code commit: `935e6cb37ab22a553f9b30dfaa68711e1768efde`
- restored tree: `8c757f1e6a951a3b11c7c290a649220817baea80`
- recovery commit on `main`: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`
- reverted effects: PR `#230` and PR `#231`
- force push: not used
- recovery deployment: `https://05a7e004.inlet-8mr.pages.dev`
- production readiness: passed
- exact-deployment readiness: passed
- production save → D1 → authenticated readback → public readback: passed

Do not re-apply the root-identity assumptions from PR `#230` or PR `#231`.

# 2. Absolute Production Home Lock

`https://pagero.kr/` is a frozen production baseline.

Before any PageRo task:

1. Read `AGENTS.md`.
2. Read `docs/PAGERO_MAINTENANCE_HANDOFF_KO.md`.
3. Read `docs/PAGERO_PLAN_POLICY_KO.md` when plans/billing are in scope.
4. Confirm the task is not a production-home change.
5. Exclude protected-home files unless the owner explicitly overrides the lock.
6. Verify the actual production URL; never infer root identity from component names.

Protected production-home scope includes at minimum:

- `functions/index.js`
- `index.html`
- `src/main.jsx`
- root/public-home routing inside `src/App.jsx`
- `src/screens/PublicHomeRoute.jsx`
- public-home components/styles
- `public/c63-assets/**`
- `public/c63-life-bridge.js`
- `public/c63-life-bridge.css`
- root/static handling inside `server/index.mjs`

Stop deployment if an unrelated patch changes protected-home files.

# 3. Completed Baseline — Do Not Reassign

The old 2026-08-02 backlog is stale. The following are baseline unless current-production evidence proves a regression.

## PR #44 — Three-template mobile regression

Merged to `main` on 2026-08-02.

Baseline includes:

- three active templates
- 360 / 390 / 430 px real-browser regression
- gallery interaction coverage
- form keyboard/fixed-UI coverage
- Korean-font screenshot evidence
- mobile touch-target fixes

Do not create a new task to merge PR `#44`.

## PR #42 — One-page policy production verifier

Merged to `main` on 2026-08-03.

Baseline includes verification tooling for:

- normal account one-active-page policy
- platform-master bypass policy
- Google-login parity
- manager/member bypass prevention
- fixture cleanup/residue checks

Remaining work is production verification where evidence is still missing, not reimplementation.

## PR #43 — Administrator and audit hardening

Merged to `main` on 2026-08-03.

Baseline includes administrator/audit verification tooling and retention foundations.

Remaining work is live verification and operations evidence where still missing, not re-merging PR `#43`.

## Editor interaction foundations

Treat these as baseline unless reproduced on current code:

- native sharing and persisted share positions
- form/reservation focus fixed-UI hiding
- timer/effect foundations
- preview/public fixed-UI parity
- save identity and revision conflict protection
- local draft/recovery foundations
- editor browser regression infrastructure
- template/mobile browser regression infrastructure
- later block-add/search/category/recent work
- later image/video reuse and save/recovery work

Do not revive an old editor PR solely because it remains open.

# 4. Current Custom-Domain Reality

The current `main` already contains basic custom-domain product behavior added after the old backlog.

Already present:

- personal-domain input UI in settings
- saved hostname at `page.integrations.domain.hostname`
- CNAME guidance targeting `inlet-8mr.pages.dev`
- custom-host public routing based on the saved hostname
- existing domain settings/billing presentation

Therefore **custom domain is not a full rebuild task**.

What is still missing or insufficiently operationalized:

- canonical D1 ownership boundary
- apex / `www.` equivalent-domain collision protection
- provider registration lifecycle
- Cloudflare Pages domain registration/removal
- live DNS verification
- SSL/provider status verification
- fail-closed detach/replace behavior
- provider orphan cleanup protection
- controlled retries/escalation
- authenticated UI status refresh/actions backed by server state
- scheduled recheck/operator tooling
- controlled real-domain production verification

## Old PR #41

PR `#41` is still open/draft and contains useful historical work, but must not be merged as-is.

Reasons:

- it was built against an old `main`
- current migration numbering and schema have moved on
- current `main` already has later domain UI/routing not represented by the old branch assumptions
- the branch contains a large historical delta

Rule: extract only still-missing behavior into small current-main patches.

# 5. Current Custom-Domain Patch Series

## Phase 1A — Canonical domain ownership core — PR #233

Branch: `fix/pagero-domain-core-20260917`

Base: `00d0cef636ddc03fa6b5d9126f61d0a52c8b1661`

Status:

- code complete: yes
- full offline QA: passed
- landing browser regression: passed
- authenticated editor regression: passed
- form/reservation regression: passed
- three-template mobile browser regression: passed
- protected-home changes: none
- merged to `main`: no
- production deployment: no
- production D1 migration applied: no
- production verified: no

Patch content:

- new `0015_page_domain_ownership.sql`
- dedicated `page_domains` ownership/lifecycle mirror
- canonical apex/`www.` ownership key
- existing page-JSON backfill
- duplicate active ownership rejection
- reserved PageRo/Pages.dev/localhost host rejection
- page save → ownership sync trigger
- hostname removal → ownership release
- project archive → ownership release
- real `node:sqlite` migration behavior QA

Operational rule: do not apply `0015` to production without D1 preflight, exact pending-list review, explicit write approval, and encrypted backup.

## Phase 1B — Cloudflare provider + DNS/SSL operations — PR #234

Branch: `feat/pagero-domain-provider-20260917`

Stack base: PR `#233`

Current scope:

- Cloudflare Pages provider module
- fixed `api.cloudflare.com/client/v4/accounts/...` credential destination
- server-owned Bearer token
- redirect following blocked
- provider timeout/error normalization
- allowlisted HTTPS `/dns-query` resolver only
- CNAME status verification
- SSL/provider status mapping
- retry cadence: 5 → 15 → 30 → 60 → 180 → 360 minutes
- page/project identity revalidation before provider actions
- `verify` / `detach` mutation allowlist
- provider-attachment marker before external registration call
- fail-closed `DOMAIN_PROVIDER_CLEANUP_REQUIRED` when safe cleanup cannot be proven
- provider security tests wired into the D1 release gate

Current state at this document revision:

- code: in progress / branch only
- PR: `#234` draft
- QA: pending current run
- merged: no
- deployed: no
- live Cloudflare call: not performed

## Phase 1C — Current settings UI wiring

Start only after Phase 1B server/API contracts are green.

Required behavior:

- pass the current page/project identity to the domain settings view without changing protected root files
- check availability through the authenticated server endpoint
- show canonical server status rather than trusting local-only `integrations.domain.status`
- user-triggered `상태 확인`
- explicit safe detach before replacement
- concise DNS/SSL/provider state
- preserve existing PageRo plan policy; do not invent new entitlement differences

## Phase 1D — Scheduled recheck + operator operations

After manual owner flow is stable:

- due-for-recheck query
- protected scheduled/manual runner
- exact approved origin/path for any secret-bearing recheck request
- bounded retry count
- 24-hour/retry-exhaustion escalation
- operator list for failed/stale domain mappings
- no raw provider token or sensitive internal error in artifacts

## Phase 1E — Controlled production verification

Only with explicit owner approval:

1. D1 migration preflight.
2. Confirm exact pending migration list.
3. Create encrypted backup.
4. Apply only the approved migration set.
5. Configure least-privilege Cloudflare/runtime secrets.
6. Connect one controlled test domain/subdomain.
7. Verify DNS and SSL active.
8. Verify public root/assets/forms/reservations/tracking.
9. Verify duplicate ownership rejection.
10. Verify detach/reconnect/provider cleanup.
11. Record deployment SHA and live evidence.

# 6. Stale/Open PR Handling

Open does not mean current.

For PR `#162`, `#163`, `#100`, and similar old editor branches:

- reproduce on current code first
- compare against current `main`
- port only a still-missing minimal fix
- never restore an old full layout or save flow wholesale

For PR `#45` and old D1-safety branches:

- current `main` already contains D1 migration-safety tooling
- use current-main tooling and remote migration state
- do not merge an old safety branch wholesale

# 7. Locked Product Policies

## Account policy

- General account: one active landing page.
- Platform master: unlimited landing pages and administrator API eligibility.
- Frontend and API enforcement remain mandatory.
- Role-string forgery must not bypass page/admin policy.
- Existing pages remain editable, revisionable, restorable, previewable, and public.
- Archived projects do not consume active-page quota.
- Google-login accounts follow the same page policy.
- Manager/member access cannot create another owner page.

## Active templates

Keep exactly the currently approved three templates unless the owner explicitly changes direction:

1. Personal rehabilitation consultation.
2. Mobile wedding invitation.
3. Real estate presale.

## Paid plans

Approved paid plans remain:

- `classic`: 클래식, 월 3,500원
- `pro`: 프로, 월 5,500원

Do not add a third paid plan or invent entitlement differences without owner approval.

# 8. Remaining Work After Custom Domain

## Priority 2 — Close production-verification gaps for existing features

Do not rebuild already-implemented features. Use existing production-verification tooling and patch only reproduced failures.

Verify at minimum:

### Account/page policy

- normal account first page succeeds
- second active page is rejected
- existing page editing still works
- archived-project handling is correct
- platform master manages multiple pages
- Google login follows the same quota
- manager/member access cannot bypass owner quota

### Administrator/audit

- approved platform-master authorization boundary
- no raw password/token/session/private PII in audit rows
- retention behavior
- account/project controls with audit evidence

### Authentication email / SES

- email verification
- password reset
- email change
- invitations/ownership transfer where applicable
- provider/DKIM/SPF/DMARC readiness evidence

### Google Sheets

- OAuth connect
- token refresh
- row delivery
- idempotency
- disconnect
- failure/retry visibility
- QA fixture cleanup

### Conversion tracking

- expected event semantics
- no raw lead PII
- duplicate suppression

Missing credentials or fixtures must be `not verified` / `skipped-live`, never false success.

## Priority 3 — Finish web billing/subscription

Current server readiness still reports web billing unavailable at `stage: pre_checkout`.

Required before paid self-serve launch:

- checkout/billing-key flow
- server-side product/entitlement mapping
- signed/idempotent provider webhook
- payment activation
- renewal
- failed renewal/grace policy
- period-end cancellation
- payment history
- receipt/invoice surface where supported
- audited admin override
- webhook replay safety
- no client-only entitlement trust

## Priority 4 — Large-data and operations hardening

Use realistic volumes.

Scope:

- inbox pagination at thousands/tens-of-thousands of leads
- larger-range statistics performance
- month-bounded and large CSV export
- blocked/spam history growth
- delivery/audit retention
- AI draft/cache cleanup where applicable
- backup retention
- abuse/rate-limit visibility without raw IP
- measured query/index review

## Priority 5 — Current editor real-use audit

Audit current code/current production end-to-end instead of reviving old PRs:

`page open/create → block add → text/image/video edit → reorder → options → save/publish → reload → public readback`

Verify:

- block add/search/category/recent
- selected-block editing
- image upload/reuse
- video upload/reuse and supported URL playback
- undo/redo
- revision restore
- save while continuing to type
- stale response cannot overwrite newer edits
- conflict/recovery behavior
- page-switch/logout/reload unsaved protection
- preview/public parity
- narrow-desktop overflow
- exposed mobile editor touch targets

## Priority 6 — Accessibility, keyboard, and mobile final pass

- keyboard navigation order
- visible focus
- dialog/modal focus behavior
- Escape behavior
- 44 px touch targets where required
- 360 / 390 / 430 px public layouts
- form keyboard viewport behavior
- fixed-UI collision
- screen-order controls without pointer-only dependency
- labels/accessibility names
- actionable-control contrast

## Priority 7 — Backup, migration, deployment, and rollback closeout

Required evidence:

- D1 remote preflight
- exact pending migration list
- encrypted pre-write backup
- post-migration verification
- disposable restore drill where applicable
- release checklist
- deployment SHA record
- readiness verification
- save/readback verification
- previous-deployment rollback procedure
- narrow bad-commit revert procedure

Never force-push `main`.

Never construct production rollback with destructive reset/clean/restore operations.

# 9. Live-Screen Verification Contract

A green build is not visual production verification.

## Frozen root

For `https://pagero.kr/`:

- compare the real production URL against the protected baseline
- verify desktop/mobile behavior
- verify required root DOM signals from the maintenance handoff
- never infer root identity from React component names

## Authenticated internal screens

For editor/settings/dashboard/admin:

- code review alone is insufficient
- use authenticated production browser coverage, a controlled QA account, or owner-provided production evidence
- if live authenticated access is unavailable, mark visual production verification pending

## Public customer pages

Verify at least:

- desktop
- 360 px
- 390 px
- 430 px
- form focus/keyboard
- fixed UI
- media assets
- save/publish readback

# 10. Migration Rules

Do not assume old PR migration numbers remain available.

Current `main` has historical numbering complexity, including multiple `0006_*` files and later `0008`, `0009`, `0010+` migrations.

Rules:

1. local filenames alone do not establish production pending state
2. remote migration history is authoritative for rollout planning
3. new domain ownership uses `0015_page_domain_ownership.sql` on the current branch, but it is not approved for production merely because the filename exists
4. no production migration write occurs without current preflight, exact pending-list review, explicit write approval, and backup gate

# 11. QA And Deployment Rules

Use current `package.json` as command source of truth.

Release-blocking coverage must include at minimum:

```bash
npm run qa:all
npm run build
npm run deployment:qa
npm run browser:landing:qa
npm run browser:editor:qa
npm run browser:forms:qa
npm run browser:templates-mobile:qa
```

Where still defined, keep relevant parity/deployment/live contracts as well.

Deployment rules:

- never force-push `main`
- do not mix unrelated refactors into focused patches
- do not deploy a branch merely because CI is green
- production deployment requires explicit owner approval
- a docs-only `main` push can still trigger QA → Cloudflare production deployment; keep docs-only changes on a non-main branch/PR until deployment is approved
- protected-home files must remain unchanged for unrelated work

# 12. Mandatory Patch Closeout

At the end of every patch:

1. Record date, branch, PR, and exact head SHA.
2. Separate `code complete`, `QA complete`, `merged`, `deployed`, `migration applied`, and `production verified` states.
3. Record actual live-screen verification scope.
4. Move completed implementation into the baseline.
5. Remove superseded/stale work from the active list.
6. Record missing migrations, credentials, approvals, fixtures, and live evidence.
7. Do not claim production completion from branch-only, mock-only, screenshot-only, CI-only, or `skipped-live` evidence.
8. Re-read the production-home lock before the next unrelated task.
