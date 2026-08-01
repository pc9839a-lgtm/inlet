# Pagero Custom Domain Operations Runbook

Updated: 2026-08-01

This runbook covers production migration, Cloudflare Pages configuration, automatic verification, failed-domain triage, detach/reconnect, and rollback. It does not authorize a production deployment. Production deployment still requires explicit owner approval.

## Implementation Tasks

### 1. Apply database migrations in order

Apply both migrations to the production `inlet-prod` D1 database:

1. `migrations/0006_page_domains.sql`
2. `migrations/0007_page_domain_operations.sql`

Before applying them, export the current D1 schema and record the latest Cloudflare deployment ID and GitHub `main` commit SHA. After applying them, confirm that `page_domains` contains the retry fields `retry_count`, `next_retry_at`, `last_error_code`, `escalated_at`, and `last_attempt_at`.

Do not deploy application code that writes these columns before `0007_page_domain_operations.sql` is present in production.

### 2. Configure Cloudflare Pages domain access

Set these server-only environment values:

- `INLET_CLOUDFLARE_ACCOUNT_ID`
- `INLET_CLOUDFLARE_PAGES_PROJECT`
- `INLET_CLOUDFLARE_API_TOKEN`
- `INLET_CUSTOM_DOMAIN_CNAME_TARGET`
- `INLET_DOMAIN_RECHECK_SECRET`
- `INLET_DOMAIN_RECHECK_BATCH_SIZE` (recommended: `20`)
- `INLET_DOMAIN_RECHECK_MAX_RETRIES` (recommended: `8`)

The Cloudflare token must have only the minimum Pages custom-domain edit permission needed for the selected account/project. Never expose this token, the recheck secret, provider responses, or validation secrets in client JavaScript.

Configure the GitHub Actions secret `PAGERO_DOMAIN_RECHECK_SECRET` with the same value as `INLET_DOMAIN_RECHECK_SECRET`. Optionally set the Actions variable `PAGERO_DOMAIN_RECHECK_URL`; when omitted, the workflow calls `https://pagero.kr/api/admin/domains/recheck`.

### 3. Verify automatic rechecks

The `Custom Domain Recheck` workflow runs every 15 minutes and calls the protected recheck endpoint. If the GitHub secret is absent, the workflow reports `skipped-live` and exits without claiming success.

The retry schedule is bounded exponential backoff: 5, 15, 30, 60, 180, then 360 minutes. A domain is escalated when provider verification fails, a non-retryable provider error occurs, retries are exhausted, at least six attempts have occurred, or the connection remains unresolved for 24 hours.

The endpoint processes a bounded batch sequentially to avoid provider bursts. Failed transient attempts remain scheduled. Non-retryable failures remain in the operator list and are not retried indefinitely.

## Operator Domain List

Platform-master sessions can call:

```text
GET /api/admin/domains?status=failed&staleMinutes=60&limit=100
GET /api/admin/domains?query=customer.example.com
```

The response includes the page/project owner label, domain and SSL state, retry count, next retry time, last error code, escalation time, and whether operator attention is required. This endpoint is internal and must not be linked from the public Pagero navigation.

A platform master can manually verify one connection with:

```text
POST /api/admin/domains
Content-Type: application/json
X-Inlet-Session: <signed platform-master session>

{"action":"verify","pageId":"<page id>"}
```

## Triage Procedure

1. Check `domainStatus`, `sslStatus`, `providerStatus`, `verificationStatus`, and `validationStatus`.
2. Check `lastErrorCode` before changing customer DNS.
3. Confirm the customer hostname is not already owned by another active `page_domains` row.
4. Confirm the CNAME points to `INLET_CUSTOM_DOMAIN_CNAME_TARGET`.
5. For apex domains, confirm the DNS provider supports CNAME flattening or an equivalent ALIAS/ANAME behavior.
6. Run a manual operator verification after DNS changes.
7. Confirm the custom hostname root loads the owning customer landing, not the Pagero home.
8. Confirm consultation forms, reservations, assets, analytics, share URL, and canonical URL work on the custom host.

### Common error categories

- `DOMAIN_PROVIDER_NOT_CONFIGURED`: production environment values or permissions are missing. This is an operator configuration issue.
- `DOMAIN_PROVIDER_TIMEOUT` or `DOMAIN_PROVIDER_UNREACHABLE`: transient provider/network issue. Automatic retry remains enabled.
- `DOMAIN_PROVIDER_REQUEST_FAILED` with HTTP 429 or 5xx: transient/rate-limit issue. Retry remains enabled.
- `DOMAIN_PROVIDER_REQUEST_FAILED` with a non-retryable 4xx: inspect token scope, project/account identity, or invalid provider state before retrying.
- `DOMAIN_PROVIDER_VERIFICATION_FAILED`: Cloudflare returned a failed verification/SSL state. Inspect customer DNS and validation details.

## Detach And Reconnect

When a customer switches back to the Pagero address, the application deletes the Cloudflare Pages custom domain when credentials are available and marks the D1 row `disconnected`. The hostname unique index excludes disconnected rows, so the same hostname can be reconnected later.

After detaching:

1. Confirm the public Pagero slug still loads.
2. Confirm the custom hostname returns the `noindex` 404 response.
3. Reconnect the hostname from page settings.
4. Confirm the new connection starts from `pending`, not a client-forged `active` state.
5. Confirm the provider domain is recreated and the same hostname cannot be claimed by a different page.

## Rollback

Application rollback does not require deleting customer ownership rows. Roll back to the previous known-good deployment while leaving `page_domains` intact. Disable the scheduled workflow or rotate `INLET_DOMAIN_RECHECK_SECRET` if the recheck endpoint itself is suspected.

SQLite/D1 does not support dropping added columns directly. If the operational columns must be removed, create a replacement table from the `0006` schema, copy the original columns, validate row counts and unique hostname ownership, swap tables inside a controlled migration, recreate indexes, and only then deploy code that no longer references the operational columns.

Never delete all domain rows as a rollback shortcut. Preserve hostname ownership, connection history, provider IDs, and timestamps for support and audit evidence.

## Local Commands

Run before merge:

```bash
npm run page:domain:qa
npm run page:domain:ops:qa
npm run d1:schema:qa
npm run api:functions:qa
npm run ops:qa
npm run qa:all
npm run build
```

## Live-Only Checks

After explicit deployment approval and production configuration:

- Apply both D1 migrations and verify the schema.
- Trigger the GitHub workflow manually once.
- Connect a real subdomain and observe `pending → verifying → active`.
- Confirm SSL becomes active.
- Force one harmless DNS mismatch and confirm the connection appears in the operator list with a retry/escalation state.
- Restore DNS and confirm automatic or manual verification clears retry and escalation metadata.
- Detach and reconnect the same domain.
- Confirm a different page cannot claim the connected hostname.

Record the Cloudflare deployment ID, GitHub commit SHA, migration output, test hostname, and final domain/SSL status in the release evidence.
