# Pagero Account Page-Limit Production Verification

Updated: 2026-08-01

This runbook verifies the owner-approved account policy against a deployed Pagero environment without changing the production homepage or plan entitlements.

## Policy Under Test

- A general account may own one active landing page.
- A platform-master account may own multiple landing pages.
- The limit is enforced at both dashboard and API boundaries.
- A forged role such as `superadmin` must not grant a quota bypass.
- Existing pages remain editable and public after the limit is reached.
- Deleted and archived projects do not consume the active-page quota.
- Google-login accounts follow the same quota.
- Manager and member access cannot create another owner page.

## Required Test Fixtures

Use dedicated QA accounts only. Never use a real customer account.

1. **Empty general account**: verified email, no active page.
2. **Occupied general account**: verified email, at least one active page.
3. **Archived general account**: verified email, no active page, at least one archived project retained as evidence.
4. **Platform-master account**: email listed in the approved platform-master configuration.
5. **Google general account**: created or authenticated through Google and not a platform master.
6. **Manager account**: manager or member access to a project it does not own.

Store their signed sessions as GitHub Actions secrets:

- `PAGERO_PAGE_LIMIT_EMPTY_GENERAL_SESSION`
- `PAGERO_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION`
- `PAGERO_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION`
- `PAGERO_PAGE_LIMIT_PLATFORM_MASTER_SESSION`
- `PAGERO_PAGE_LIMIT_GOOGLE_SESSION`
- `PAGERO_PAGE_LIMIT_MANAGER_SESSION`

Sessions are secrets. Do not place them in repository files, issue comments, screenshots, or workflow output.

## Verification Coverage

The live script performs the following checks:

1. Refresh every signed session and confirm platform-master state.
2. Confirm the empty and archived fixtures expose zero active pages.
3. Confirm the occupied fixture exposes at least one active page.
4. Create the empty account's first page.
5. Save the existing page, read revisions, preview a revision, restore it, and read the public page.
6. Confirm a second direct API creation returns `409 / ACCOUNT_PAGE_LIMIT_REACHED`.
7. Delete the QA page and confirm the same general account can create a replacement.
8. Confirm the occupied account cannot create a second page.
9. Confirm the archived fixture can create a first active page.
10. Confirm the platform master can create two pages and still returns `platformMaster: true` after session refresh.
11. Confirm the Google account receives the same one-page limit.
12. Confirm the manager/member attempt returns `403` or `409` and does not change its accessible page count.
13. Delete every disposable QA page in reverse order, including after a failed assertion.

## Safety Gates

The command does not perform writes unless all of the following are true:

- all six test sessions are present
- `INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1`
- the workflow is manually dispatched with `allow_writes=true`

When sessions or write approval are missing, the command reports `skipped-live`. If `INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE=1`, `skipped-live` is a failing result instead of a false success.

The live check creates only slugs beginning with `qa-limit-`. It does not modify the production homepage, customer pages, billing data, or plan settings.

## Local Command

```bash
INLET_ACCOUNT_PAGE_LIMIT_BASE_URL=https://pagero.kr \
INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1 \
INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE=1 \
INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION='***' \
npm run account:page-limit:live
```

Prefer the manual GitHub workflow because it stores the result as a 30-day artifact and avoids shell-history leakage.

## GitHub Workflow

Run **Account Page Limit Production Verify** manually.

- Set `base_url` to the production or approved preview origin.
- Set `allow_writes=true` only after confirming all six accounts are disposable QA fixtures.
- Keep `require_live=true` for release evidence.

A successful full run must report:

```json
{
  "ok": true,
  "status": "verified-live"
}
```

`skipped-live` is not production verification.

## Failure Handling

- `401`: replace an expired or invalid session secret.
- `403 EMAIL_VERIFICATION_REQUIRED`: complete verification for the fixture account.
- Unexpected `200` on a second general-account creation: treat as a release blocker and inspect `functions/api/pages/_middleware.js` before cleanup.
- Cleanup failure: locate remaining `qa-limit-*` pages through the test account and remove them before rerunning.
- Platform master returning `false`: verify the exact email and `INLET_PLATFORM_MASTER_EMAILS`; do not add a role-based bypass.
- Manager creation returning `200`: treat as a privilege escalation and block release.

## Release Evidence

Record:

- deployment URL and deployment ID
- GitHub commit SHA
- workflow run ID
- artifact name `account-page-limit-production-evidence`
- final result status
- fixture preparation date
- cleanup confirmation

Do not mark the one-page policy production-verified until the workflow reports `verified-live` against the intended deployed commit.
