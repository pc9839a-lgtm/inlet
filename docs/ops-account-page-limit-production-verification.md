# Pagero Account Page-Limit Production Verification

Updated: 2026-08-03

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

## Allowed Origin Security

The six signed sessions are powerful credentials. Sending them to an arbitrary `base_url` would be session exfiltration.

The workflow therefore runs `scripts/account-page-limit-production-safe-entry.mjs` before the live checker. No HTTP request is allowed until all target checks pass.

Rules:

- the target must be an exact HTTPS origin
- paths, queries, fragments, usernames, and passwords are rejected
- `https://pagero.kr` is allowed by default
- any preview origin must be explicitly listed in the `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS` GitHub Secret
- multiple approved origins are comma-separated
- hostname suffix matching and wildcard matching are not used
- an unapproved origin always reports `failed-live`, even when `require_live=false`

Examples:

- allowed: `https://pagero.kr`
- allowed only when explicitly configured: `https://preview.example.com`
- rejected: `http://pagero.kr`
- rejected: `https://pagero.kr/api`
- rejected: `https://pagero.kr?next=https://attacker.example`
- rejected: `https://user:password@pagero.kr`
- rejected: `https://attacker.example`

Never add a temporary third-party request bin, tunnel, or debugging host to the allowlist while signed sessions are configured.

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

- target is an exact HTTPS origin in the allowlist
- all six test sessions are present
- `INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1`
- the approval phrase is exactly `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES`
- the workflow is manually dispatched with `allow_writes=true`
- the GitHub `production` environment allows the job to start

When sessions or write approval are missing, the command reports `skipped-live`. If `INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE=1`, `skipped-live` is a failing result instead of a false success.

An invalid or unapproved target reports `failed-live` unconditionally and the child live checker is never started.

The live check creates only slugs beginning with `qa-limit-`. It does not modify the production homepage, customer pages, billing data, or plan settings.

## Local Command

```bash
INLET_ACCOUNT_PAGE_LIMIT_BASE_URL=https://pagero.kr \
PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS=https://pagero.kr \
INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1 \
INLET_ACCOUNT_PAGE_LIMIT_LIVE_APPROVAL=I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES \
INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE=1 \
INLET_ACCOUNT_PAGE_LIMIT_EMPTY_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_OCCUPIED_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_ARCHIVED_GENERAL_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_PLATFORM_MASTER_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_GOOGLE_SESSION='***' \
INLET_ACCOUNT_PAGE_LIMIT_MANAGER_SESSION='***' \
node scripts/account-page-limit-production-safe-entry.mjs
```

Prefer the manual GitHub workflow because it stores the result as a 30-day artifact and avoids shell-history leakage.

## GitHub Workflow

Run **Account Page Limit Production Verify** manually.

1. Confirm all six accounts are disposable QA fixtures.
2. Confirm the intended origin is `https://pagero.kr` or is already present in `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS`.
3. Set `base_url` to that exact origin with no trailing path, query, or fragment.
4. Set `allow_writes=true`.
5. Enter `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES` exactly.
6. Keep `require_live=true` for release evidence.
7. Approve the `production` environment gate when GitHub requests it.

A successful full run must report:

```json
{
  "ok": true,
  "status": "verified-live"
}
```

`skipped-live` is not production verification.

## Failure Handling

- Target origin failure: verify the exact HTTPS origin and `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS`; never bypass the gate by editing the script during an incident.
- Approval failure: re-enter `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES`; do not weaken or remove the phrase check.
- `401`: replace an expired or invalid session secret.
- `403 EMAIL_VERIFICATION_REQUIRED`: complete verification for the fixture account.
- Unexpected `200` on a second general-account creation: treat as a release blocker and inspect `functions/api/pages/_middleware.js` before cleanup.
- Cleanup failure: locate remaining `qa-limit-*` pages through the test account and remove them before rerunning.
- Platform master returning `false`: verify the exact email and `INLET_PLATFORM_MASTER_EMAILS`; do not add a role-based bypass.
- Manager creation returning `200`: treat as a privilege escalation and block release.

## Session Rotation

Signed sessions must not be treated as permanent credentials.

- create or refresh them only for the verification window
- rotate or revoke them after the release verification
- replace the GitHub Secrets after fixture account password, email, role, or OAuth state changes
- never reuse customer sessions
- remove obsolete preview origins from `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS`

## Release Evidence

Record:

- exact deployment origin and deployment ID
- GitHub commit SHA
- workflow run ID
- artifact name `account-page-limit-production-evidence-<run_id>`
- final result status
- fixture preparation date
- origin allowlist review
- cleanup confirmation
- session rotation or revocation confirmation

Do not mark the one-page policy production-verified until the workflow reports `verified-live` against the intended deployed commit.
