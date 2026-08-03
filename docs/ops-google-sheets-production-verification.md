# Google Sheets Production Verification

This runbook verifies the existing Pagero Google Sheets OAuth delivery against a dedicated disposable fixture.

Do not use a customer spreadsheet, customer landing page, customer account, or customer lead. The page slug must start with `qa-sheets-`, and the dedicated worksheet name must start with `QA`.

## What It Verifies

The manual workflow checks:

- the signed Pagero fixture session is valid
- the dedicated `qa-sheets-` page is accessible to the fixture account
- a Google OAuth refresh token can be exchanged at the fixed Google token endpoint
- the verifier credential can read the dedicated worksheet
- Pagero can deliver one unique lead through Google Sheets OAuth
- the unique marker appears in exactly one row
- a manual delivery retry does not create a second row
- Pagero delivery logs contain successful Google Sheets idempotency evidence
- the test row and Pagero lead are removed before successful completion

## Security Boundary

The workflow carries a signed Pagero session and Google OAuth client credentials and refresh token. Before any secret-backed request, the safe entrypoint enforces:

- an exact HTTPS Pagero origin
- no username, password, path, query, or fragment in the Pagero origin
- `https://pagero.kr` as the only default origin
- preview origins only when listed exactly in `PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS`
- no suffix, wildcard, or substring hostname matching
- every Pagero request remains on the approved origin
- Google OAuth requests use only `https://oauth2.googleapis.com/token`
- Google Sheets requests use only `https://sheets.googleapis.com/v4/spreadsheets/...`
- all requests use `redirect: error`
- invalid origins fail before secrets or network requests are used

Secrets are never passed through workflow inputs and are not included in evidence output.

## Workflow

Workflow: `Google Sheets Production Verify`

It is manual-only and uses the GitHub `production` environment.

Inputs:

- `base_url`: exact approved Pagero HTTPS origin
- `phase`: `read-only` or `verify-live`
- `allow_writes`: must be true for `verify-live`
- `approval_phrase`: must be `I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES` for `verify-live`
- `require_live`: when true, missing fixtures or credentials fail rather than return a successful `skipped-live`

## Required Fixture

Prepare a dedicated test setup:

1. A non-customer Pagero account with a valid signed session.
2. One page whose slug starts with `qa-sheets-`.
3. That page is connected to Google Sheets in OAuth mode.
4. A spreadsheet used only for integration QA.
5. A worksheet whose title starts with `QA`, such as `QA Leads`.
6. A separate Google verifier OAuth credential that has permission to read and delete rows in that spreadsheet.
7. No real customer data, automations, emails, webhooks, or CallTag delivery enabled on the fixture page.

The verifier OAuth credential may be a controlled operator account. Its refresh token must be stored only in GitHub Secrets.

## GitHub Configuration

Repository variables:

- `PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS`: exact comma-separated preview origins; leave empty for production-only verification
- `PAGERO_GOOGLE_SHEETS_PAGE_SLUG`: dedicated slug beginning with `qa-sheets-`
- `PAGERO_GOOGLE_SHEETS_SHEET_NAME`: dedicated worksheet title beginning with `QA`

GitHub Secrets:

- `PAGERO_GOOGLE_SHEETS_SESSION`
- `PAGERO_GOOGLE_SHEETS_PROJECT_ID`
- `PAGERO_GOOGLE_SHEETS_SPREADSHEET_ID`
- `PAGERO_GOOGLE_SHEETS_VERIFY_CLIENT_ID`
- `PAGERO_GOOGLE_SHEETS_VERIFY_CLIENT_SECRET`
- `PAGERO_GOOGLE_SHEETS_VERIFY_REFRESH_TOKEN`

## Phase 1 — read-only

Run with:

- `phase=read-only`
- `allow_writes=false`
- `require_live=true`

Expected result: `verified-live`.

This phase refreshes the Pagero session, confirms the dedicated fixture page, exchanges the Google refresh token, loads spreadsheet metadata, and reads the QA worksheet. It does not create a lead or a sheet row.

## Phase 2 — verify-live

Run with:

- `phase=verify-live`
- `allow_writes=true`
- `approval_phrase=I_APPROVE_GOOGLE_SHEETS_LIVE_WRITES`
- `require_live=true`

Expected result: `verified-live`.

The workflow performs this sequence:

1. Completes every read-only preflight.
2. Generates a unique `qa-sheets-...` marker.
3. Confirms the marker does not already exist in the worksheet.
4. Creates one disposable Pagero lead with the marker in its name and memo.
5. Requires a successful `google_sheets` delivery log.
6. Polls the worksheet until the marker appears in exactly one row.
7. Requests delivery retry for the same lead.
8. Confirms the marker still appears in exactly one row, proving row-level idempotency.
9. Confirms the delivery-log API contains a successful Google Sheets record with an idempotency key.
10. Deletes the inserted worksheet row.
11. Deletes the disposable Pagero lead.
12. Re-reads the worksheet and confirms the marker is gone.

## Cleanup Rules

Cleanup runs on success and after a failed live sequence whenever a row or lead may have been created.

A successful run requires:

- zero remaining rows containing the marker
- the disposable Pagero lead deleted or already absent
- no customer spreadsheet or page touched

If cleanup fails, the workflow result is `failed-live`. Cleanup failure must never be hidden behind a successful verification result.

## Status Meanings

- `verified-live`: every selected phase check passed against the deployed environment
- `skipped-live`: required disposable fixture or credential is missing
- `failed-live`: security gate, OAuth refresh, Pagero request, sheet delivery, idempotency, or cleanup failed

A `skipped-live` result is not production verification. Use `require_live=true` for release evidence.

## Evidence To Retain

- workflow run URL and run number
- tested commit SHA and deployment SHA
- selected phase and approved Pagero origin
- `google-sheets-production-evidence-<run-id>` artifact
- confirmation that the row count for the marker was exactly one after retry
- confirmation that the marker row and Pagero lead were removed
- operator name and verification time

Do not retain OAuth access tokens, refresh tokens, client secrets, signed sessions, spreadsheet contents, customer data, or raw provider error bodies.
