# Google Sheets Production Verification

This runbook verifies the existing Pagero Google Sheets OAuth delivery against a dedicated disposable fixture.

Do not use a customer spreadsheet, customer landing page, customer account, or customer lead. The page slug must start with `qa-sheets-`, the spreadsheet title must start with `QA`, and the dedicated worksheet name must start with `QA`.

## What It Verifies

The manual workflow checks:

- the signed Pagero fixture session is valid
- the dedicated `qa-sheets-` page is accessible to the fixture account
- the persisted page integration matches the approved spreadsheet and worksheet exactly
- a Google OAuth refresh token can be exchanged at the fixed Google token endpoint
- the verifier credential can read the dedicated worksheet
- the worksheet contains only the approved header row before writes
- no previous `qa-sheets-` lead or sheet-row residue exists
- Pagero can deliver one unique lead through Google Sheets OAuth
- the unique marker appears in exactly one row
- a manual delivery retry does not create a second row
- Pagero delivery logs contain successful Google Sheets idempotency evidence
- the test row and Pagero lead are removed before successful completion
- the worksheet baseline digest is restored after cleanup

## Security Boundary

The workflow carries a signed Pagero session and Google OAuth client credentials and refresh token. Before any secret-backed request, the safe entrypoint enforces:

- an exact HTTPS Pagero origin
- no username, password, path, query, or fragment in the Pagero origin
- `https://pagero.kr` as the only default origin
- preview origins only when listed exactly in `PAGERO_GOOGLE_SHEETS_ALLOWED_ORIGINS`
- no suffix, wildcard, or substring hostname matching
- every Pagero request remains on the approved origin
- Google OAuth requests use only `https://oauth2.googleapis.com/token`
- Google Sheets requests remain under the approved spreadsheet ID at `https://sheets.googleapis.com/v4/spreadsheets/...`
- all requests use `redirect: error`
- invalid origins fail before secrets or network requests are used

Provider errors and evidence are sanitized recursively. Signed sessions, OAuth client secrets, refresh tokens, access tokens, project IDs, spreadsheet IDs, email addresses, and phone numbers are not included in evidence output.

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
3. That persisted page is connected to Google Sheets in OAuth mode and has status `connected`.
4. The persisted page's spreadsheet ID and worksheet name exactly match the workflow Secrets and variables.
5. A spreadsheet used only for integration QA whose title starts with `QA`.
6. A worksheet whose title starts with `QA`, such as `QA Leads`.
7. A separate Google verifier OAuth credential that has permission to read and delete rows in that spreadsheet.
8. No real customer data, automations, emails, webhooks, or CallTag delivery enabled on the fixture page.

The verifier OAuth credential may be a controlled operator account. Its refresh token must be stored only in GitHub Secrets.

## Persisted Page Integration Check

The workflow does not trust a synthetic page object supplied by the checker. It reloads the saved page through the authenticated Pagero API and requires all of the following:

- page ID matches the project listing when the listing exposes an ID
- project ID matches `PAGERO_GOOGLE_SHEETS_PROJECT_ID`
- slug matches `PAGERO_GOOGLE_SHEETS_PAGE_SLUG`
- `integrations.sheets.enabled=true`
- `integrations.sheets.mode=oauth`
- `integrations.sheets.status=connected`
- saved spreadsheet ID matches `PAGERO_GOOGLE_SHEETS_SPREADSHEET_ID`
- saved worksheet name matches `PAGERO_GOOGLE_SHEETS_SHEET_NAME`

A mismatch is `failed-live` before any test lead is created.

## Clean Baseline Contract

Before either phase succeeds, the worksheet must contain exactly one row and no data rows.

The required header is exactly:

`접수일시, 이름, 연락처, qaMarker, source`

Do not add, remove, reorder, or rename these columns for the fixture. Pagero's test payload is deliberately shaped to use this exact header so the production delivery must not rewrite the header during the test.

The preflight also checks:

- no worksheet cell starts with `qa-sheets-`
- no Pagero lead in the fixture project contains a `qa-sheets-` marker
- the header-only worksheet baseline digest is captured before writes

Previous residue blocks the run before a new lead or row is created. Do not automatically delete unidentified residue; investigate the prior failed run first.

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

This phase refreshes the Pagero session, loads and validates the persisted fixture page, exchanges the Google refresh token, verifies the QA spreadsheet and worksheet metadata, checks the exact header-only baseline, and confirms there is no previous QA residue. It does not create a lead or a sheet row.

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
4. Creates one disposable Pagero lead with the marker in its ID, name, memo, and `qaMarker` field.
5. Requires a successful `google_sheets` delivery log.
6. Polls the worksheet until an exact marker cell appears in exactly one row.
7. Requests delivery retry for the same lead.
8. Confirms the exact marker still appears in exactly one row, proving row-level idempotency.
9. Confirms the delivery-log API contains a successful Google Sheets record with an idempotency key.
10. Deletes every row containing an exact current-run marker cell.
11. Deletes the current-run Pagero lead even when the original save response was interrupted or malformed.
12. Re-reads the worksheet and confirms the exact marker is gone.
13. Confirms the header-only baseline digest is restored.
14. Confirms the current-run lead is absent.

## Cleanup Rules

Cleanup runs on success and after a failed live sequence whenever the current marker has been generated. It does not depend on an earlier `leadCreated` or `sheetRowCreated` flag because a request can succeed remotely and fail locally before such a flag is set.

A successful run requires:

- zero remaining rows containing an exact current-run marker cell
- the disposable Pagero lead deleted or already absent
- the worksheet contents equal the captured header-only baseline
- no customer spreadsheet or page touched

Substring matches are not deleted. This prevents a row containing unrelated text such as `prefix-qa-sheets-...` from being removed accidentally.

If cleanup or baseline restoration fails, the workflow result is `failed-live`. Cleanup failure must never be hidden behind a successful verification result.

## Status Meanings

- `verified-live`: every selected phase check passed against the deployed environment
- `skipped-live`: required disposable fixture or credential is missing
- `failed-live`: security gate, fixture identity, persisted integration, clean baseline, OAuth refresh, Pagero request, sheet delivery, idempotency, or cleanup failed

A `skipped-live` result is not production verification. Use `require_live=true` for release evidence.

## Evidence To Retain

- workflow run URL and run number
- tested commit SHA and deployment SHA
- selected phase and approved Pagero origin
- `google-sheets-production-evidence-<run-id>` artifact
- confirmation that the preflight found zero previous QA residues
- confirmation that the row count for the marker was exactly one after retry
- confirmation that the marker row and Pagero lead were removed
- confirmation that the worksheet baseline digest was restored
- operator name and verification time

Do not retain OAuth access tokens, refresh tokens, client secrets, signed sessions, project IDs, spreadsheet IDs, spreadsheet contents, customer data, or raw provider error bodies.
