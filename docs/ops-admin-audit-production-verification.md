# Admin Audit Production Verification

This runbook verifies the production behavior introduced by PR #43 without treating branch-only QA as production completion.

## Scope

The manual workflow verifies:

- general and forged-role sessions are blocked from `/api/admin/*`
- an approved platform-master session can read the audit API
- `/admin/audit` keeps noindex, no-store, CSP, and frame-blocking headers
- verified account email change issues a new session and rejects the old session
- a disposable general account can be suspended and restored by a platform master
- suspended session refresh and password login are rejected
- a disposable project can be paused and restored
- its public page becomes unavailable while paused and returns after restore
- required audit rows exist for email change, account operations, project operations, and retention dry-run
- audit retention is executed only as a dry-run and deletes zero rows

Do not use a real customer account or a real customer landing page. Use a disposable password account whose only active landing page slug starts with `qa-audit-`.

## Workflow

Workflow: `Admin Audit Production Verify`

The workflow is manual-only and has no push, pull-request, or schedule trigger.

Inputs:

- `base_url`: deployed Pages Functions origin, normally `https://pagero.kr`
- `phase`: `read-only`, `request-email-token`, or `verify-live`
- `allow_writes`: must be true for the two write phases
- `require_live`: when true, missing fixtures produce a failed run rather than a successful `skipped-live`
- `project_slug_prefix`: defaults to `qa-audit-` and must stay in the `qa-...-` form

## Required GitHub Secrets

Read-only phase:

- `PAGERO_ADMIN_AUDIT_PLATFORM_MASTER_SESSION`
- `PAGERO_ADMIN_AUDIT_GENERAL_SESSION`

Email token request phase additionally requires:

- `PAGERO_ADMIN_AUDIT_NEXT_EMAIL`

Full verification additionally requires:

- `PAGERO_ADMIN_AUDIT_GENERAL_PASSWORD`
- `PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN`
- `PAGERO_AUDIT_RETENTION_SECRET`

Never pass passwords, sessions, one-time codes, or retention secrets through workflow inputs. Workflow inputs are not a secret-storage surface.

## Fixture Requirements

Prepare one dedicated password account with all of the following properties:

1. It is not a platform-master account.
2. Its email is verified and its session is valid.
3. Its password is known only through GitHub Secrets.
4. It owns one disposable active project.
5. The disposable page slug starts with `qa-audit-`.
6. The page contains no customer data and receives no real traffic.
7. The next email address is controlled by the operator and is not already registered.

The platform-master session must belong to one of the approved platform-master emails. A `role=superadmin` string is not sufficient.

## Phase 1 — read-only

Run with:

- `phase=read-only`
- `allow_writes=false`
- `require_live=true`

Expected result: `verified-live`.

This phase confirms administrator authorization and `/admin/audit` security headers. It does not change account, project, email, or retention state.

## Phase 2 — request-email-token

Run with:

- `phase=request-email-token`
- `allow_writes=true`
- `require_live=true`

Expected result: `awaiting-email-token`.

The workflow requests a one-time email-change code for `PAGERO_ADMIN_AUDIT_NEXT_EMAIL`. The production API response must not contain the token. Retrieve the code from the controlled mailbox and store it in `PAGERO_ADMIN_AUDIT_EMAIL_CHANGE_TOKEN`.

The code expires after 30 minutes. A resend within the cooldown window can return `EMAIL_VERIFICATION_COOLDOWN`.

## Phase 3 — verify-live

Run with:

- `phase=verify-live`
- `allow_writes=true`
- `require_live=true`

Expected result: `verified-live`.

The workflow performs this sequence:

1. Confirms both sessions and platform-master classification.
2. Confirms the disposable project slug prefix.
3. Confirms the current password login.
4. Changes the disposable account email using the one-time code.
5. Confirms the new session works and the old session is rejected.
6. Suspends the disposable account.
7. Confirms session refresh and password login return `AUTH_ACCOUNT_SUSPENDED`.
8. Restores the account and confirms password login succeeds.
9. Pauses the disposable project and confirms the public page returns 404.
10. Restores the project and confirms the public page returns 200.
11. Runs audit retention with `dryRun=true` and confirms `deleted=0`.
12. Confirms the required audit actions exist after the run started.

The email change is intentionally not rolled back automatically because a rollback also requires a separately delivered one-time code. Rotate the two controlled QA email addresses or manually prepare the fixture before the next run.

## Automatic Cleanup

If the full phase fails after account suspension or project pause, the script attempts to restore both states before exiting. The evidence artifact records cleanup failure without printing credentials.

After every run, manually confirm:

- the account status is active
- the disposable page is publicly available
- no customer project was touched
- the artifact contains no password, session, email-change token, or retention secret

## Status Meanings

- `verified-live`: all checks for the selected phase passed against the deployed environment
- `awaiting-email-token`: the email was requested successfully and the operator must store the received code before the full phase
- `skipped-live`: required sessions, password, email, token, secret, or write approval was missing
- `failed-live`: a live request, state transition, audit assertion, or cleanup failed

A `skipped-live` result is not production verification. With `require_live=true`, it fails the workflow.

## Evidence To Retain

Retain for the release record:

- workflow run URL and run number
- tested commit SHA and deployment SHA
- selected phase and base URL
- the `admin-audit-production-evidence` artifact
- confirmation that the final account and project states are active
- confirmation that retention ran in dry-run mode only
- operator name and verification time

## Local Command

The same script can be run from a secured operator environment:

```bash
INLET_ADMIN_AUDIT_BASE_URL=https://pagero.kr \
INLET_ADMIN_AUDIT_LIVE_PHASE=read-only \
INLET_ADMIN_AUDIT_LIVE_REQUIRE=1 \
INLET_ADMIN_AUDIT_PLATFORM_MASTER_SESSION='***' \
INLET_ADMIN_AUDIT_GENERAL_SESSION='***' \
npm run admin:audit:live
```

Do not paste real secrets into shell history on shared machines.
