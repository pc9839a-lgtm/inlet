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

The first five fixtures must belong to different owner accounts. All six signed-session values must also be different. Reusing the same session for multiple fixture roles causes the workflow to stop before any request.

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

The workflow therefore runs `scripts/account-page-limit-production-runner.mjs`. The runner reuses the strict origin functions from `scripts/account-page-limit-production-safe-entry.mjs`, locks every request to one approved origin, and then surrounds the write checker with fixture-integrity checks.

Rules:

- the target must be an exact HTTPS origin
- paths, queries, fragments, usernames, and passwords are rejected
- `https://pagero.kr` is allowed by default
- any preview origin must be explicitly listed in the `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS` GitHub Secret
- multiple approved origins are comma-separated
- hostname suffix matching and wildcard matching are not used
- every fetch uses `redirect: error`
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

## Fixture Integrity Gates

The runner does not trust a successful DELETE response by itself. It verifies the complete account state before and after the live checker.

### Preflight

1. Refresh all six sessions without exposing the refreshed values.
2. Confirm each fixture has the expected platform-master state.
3. Confirm the first five fixture owner identities are isolated.
4. Confirm the empty and archived fixtures have zero active pages.
5. Confirm the occupied fixture has at least one active page.
6. Run a **preflight residue scan** across all fixture page lists.
7. Stop before writes when any existing `qa-limit-*` page is found.
8. Record each fixture's active-page count and a non-reversible **baseline digest** of page ID, project ID, and slug.

Pre-existing `qa-limit-*` pages are not deleted automatically. They may be evidence from an earlier failed operation and require manual review first.

### Postflight

1. Refresh the latest sessions again.
2. Scan every fixture for `qa-limit-*` pages created by the current run.
3. Delete only those current-run QA pages; non-QA pages are never eligible for automatic cleanup.
4. Read all fixture page lists again.
5. Confirm no QA residue remains.
6. Compare every page count and identity digest against the preflight baseline.
7. Mark the run `failed-live` when cleanup or **postflight restoration** is incomplete, even if the core quota assertions passed.

This catches silent cleanup failures, fixture mutation, same-count page replacement, and process failures that leave disposable pages behind.

## Verification Coverage

The live checker performs the following policy checks between preflight and postflight:

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
14. Return control to the integrity runner for residue cleanup and full baseline restoration verification.

## Safety Gates

The command does not perform writes unless all of the following are true:

- target is an exact HTTPS origin in the allowlist
- all six test sessions are present and unique
- fixture owner accounts are isolated
- no stale `qa-limit-*` page exists
- `INLET_ACCOUNT_PAGE_LIMIT_LIVE_WRITE=1`
- the approval phrase is exactly `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES`
- the workflow is manually dispatched with `allow_writes=true`
- the GitHub `production` environment allows the job to start

When sessions or write approval are missing, the command reports `skipped-live`. If `INLET_ACCOUNT_PAGE_LIMIT_LIVE_REQUIRE=1`, `skipped-live` is a failing result instead of a false success.

An invalid or unapproved target reports `failed-live` unconditionally and no session-bearing request is started.

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
node scripts/account-page-limit-production-runner.mjs
```

The same command is available as `npm run account:page-limit:live` after setting the environment variables.

Prefer the manual GitHub workflow because it stores the single combined result as a 30-day artifact and avoids shell-history leakage.

## GitHub Workflow

Run **Account Page Limit Production Verify** manually.

1. Confirm all six accounts are disposable QA fixtures.
2. Confirm no fixture page currently uses a `qa-limit-*` slug.
3. Confirm the intended origin is `https://pagero.kr` or is already present in `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS`.
4. Set `base_url` to that exact origin with no trailing path, query, or fragment.
5. Set `allow_writes=true`.
6. Enter `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES` exactly.
7. Keep `require_live=true` for release evidence.
8. Approve the `production` environment gate when GitHub requests it.

A successful full run must report:

```json
{
  "ok": true,
  "status": "verified-live",
  "integrity": {
    "postflight": {
      "ok": true,
      "residueAfter": {
        "total": 0
      },
      "baselineComparison": {
        "ok": true
      }
    }
  }
}
```

`skipped-live` is not production verification.

## Failure Handling

- Target origin failure: verify the exact HTTPS origin and `PAGERO_PAGE_LIMIT_ALLOWED_ORIGINS`; never bypass the gate by editing the script during an incident.
- Approval failure: re-enter `I_APPROVE_ACCOUNT_PAGE_LIMIT_LIVE_WRITES`; do not weaken or remove the phrase check.
- Duplicate fixture session failure: issue separate signed sessions for each fixture role.
- Fixture owner isolation failure: replace duplicated owner accounts before rerunning.
- Preflight residue failure: inspect existing `qa-limit-*` pages, determine which prior run created them, remove them manually, and preserve incident evidence.
- `401`: replace an expired or invalid session secret.
- `403 EMAIL_VERIFICATION_REQUIRED`: complete verification for the fixture account.
- Unexpected `200` on a second general-account creation: treat as a release blocker and inspect `functions/api/pages/_middleware.js` before cleanup.
- Cleanup failure: locate remaining `qa-limit-*` pages through the test account and remove them before rerunning.
- Baseline mismatch with zero residue: investigate unexpected fixture replacement or mutation; matching page counts alone are not sufficient.
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
- preflight residue count
- preflight and postflight page-set digests
- postflight cleanup attempt count
- cleanup confirmation
- baseline restoration confirmation
- session rotation or revocation confirmation

Do not mark the one-page policy production-verified until the workflow reports `verified-live` against the intended deployed commit with `residueAfter.total=0` and `baselineComparison.ok=true`.
