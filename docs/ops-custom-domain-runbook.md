# Pagero Custom Domain Operations Runbook

Updated: 2026-08-03

This runbook covers production migration, Cloudflare Pages configuration, automatic verification, failed-domain triage, detach/reconnect, and rollback. It does not authorize a production deployment or database write. Production migration and deployment still require explicit owner approval.

## Implementation Tasks

### 1. Confirm migration safety dependency

The production `main` branch already contains `migrations/0006_calltag_pagero_lead_queue.sql`. That migration remains unchanged and is outside this custom-domain patch.

Custom-domain migrations therefore begin at the next unambiguous sequence:

1. `migrations/0007_page_domains.sql`
2. `migrations/0008_page_domain_operations.sql`

PR `#50` must be merged before any custom-domain production migration. Use its manual `D1 Migration Safety` workflow; do not apply these migrations through an ad-hoc Wrangler command.

Required order:

1. Merge PR `#50` after its QA remains green.
2. Configure the D1 migration-safety secrets documented in `docs/ops-d1-migration-safety.md`.
3. Run read-only `preflight` against the intended production `main` SHA.
4. Review the remote `d1_migrations` history and every local migration hash.
5. Continue only when the remote pending list is exactly the reviewed list and order. For this release, the expected custom-domain list is `0007_page_domains.sql,0008_page_domain_operations.sql` only when the live preflight reports exactly those pending migrations.
6. Run `backup-and-apply` only after separate owner approval, with the exact pending list, write switch, approval phrase, and encrypted-backup key.
7. Keep the encrypted SQL export, manifest, rollback instructions, and Time Travel evidence.

A `skipped-live` preflight is not production verification. Never infer the pending list from repository filenames alone.

### 2. Apply database migrations in order

Apply both custom-domain migrations to the production `inlet-prod` D1 database through the guarded workflow:

1. `migrations/0007_page_domains.sql`
2. `migrations/0008_page_domain_operations.sql`

Before applying them, record the latest Cloudflare deployment ID and GitHub `main` commit SHA. After applying them, confirm that `page_domains` exists and contains the retry fields `retry_count`, `next_retry_at`, `last_error_code`, `escalated_at`, and `last_attempt_at`.

Do not deploy application code that writes these columns before `0008_page_domain_operations.sql` is present in production.

### 3. Configure Cloudflare Pages domain access

Set these server-only environment values:

- `INLET_CLOUDFLARE_ACCOUNT_ID`
- `INLET_CLOUDFLARE_PAGES_PROJECT`
- `INLET_CLOUDFLARE_API_TOKEN`
- `INLET_CUSTOM_DOMAIN_CNAME_TARGET`
- `INLET_DOMAIN_RECHECK_SECRET` with at least 32 random characters
- `INLET_DOMAIN_RECHECK_BATCH_SIZE` (recommended: `20`)
- `INLET_DOMAIN_RECHECK_MAX_RETRIES` (recommended: `8`)
- `INLET_DNS_JSON_RESOLVER_URL` only when a non-default resolver is required
- `INLET_DNS_JSON_RESOLVER_ALLOWED_ENDPOINTS` containing every approved exact `/dns-query` endpoint

The Cloudflare token must have only the minimum Pages custom-domain edit permission needed for the selected account/project. Never expose this token, the recheck secret, provider responses, or validation secrets in client JavaScript.

Configure the GitHub Actions secret `PAGERO_DOMAIN_RECHECK_SECRET` with the same value as `INLET_DOMAIN_RECHECK_SECRET`.

Configure these GitHub Actions repository variables:

- `PAGERO_DOMAIN_RECHECK_URL=https://pagero.kr/api/admin/domains/recheck`
- `PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS=https://pagero.kr`

Preview deployments may be added only as exact HTTPS origins. Do not add request bins, tunnels, wildcard hosts, URL paths, queries, fragments, usernames, or passwords.

### 4. Verify automatic rechecks

The `Custom Domain Recheck` workflow runs every 15 minutes and calls the protected recheck endpoint. A missing or weak Secret is a failing `failed-live` result; scheduled verification must never silently succeed or report `skipped-live`.

The retry schedule is bounded exponential backoff: 5, 15, 30, 60, 180, then 360 minutes. A domain is escalated when provider verification fails, a non-retryable provider error occurs, retries are exhausted, at least six attempts have occurred, or the connection remains unresolved for 24 hours.

The endpoint processes a bounded batch sequentially to avoid provider bursts. Failed transient attempts remain scheduled. Non-retryable failures remain in the operator list and are not retried indefinitely.

## Scheduled Recheck Security

The recheck Secret must never be sent to a URL taken directly from an unchecked repository variable.

`scripts/domain-recheck-safe-runner.mjs` enforces all of the following before the Authorization header is created:

- HTTPS only
- exact path `/api/admin/domains/recheck`
- no query, fragment, username, or password
- exact origin membership in `PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS`
- Secret length of at least 32 characters
- `redirect: error`
- 30-second request timeout
- output limited to counts and status; no Secret or complete domain result list

The Cloudflare API client also fixes the destination to `https://api.cloudflare.com/client/v4/accounts/...` and blocks redirects before the API token can be forwarded.

DNS-over-HTTPS requests are limited to exact approved `/dns-query` endpoints. An unapproved `INLET_DNS_JSON_RESOLVER_URL` is rejected before a network request, preventing server-side request forgery through environment misconfiguration.

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
- `DOMAIN_PROVIDER_CLEANUP_REQUIRED`: the provider mapping may still exist but Cloudflare credentials are unavailable. Restore the provider configuration and detach again; do not manually mark the D1 row disconnected.
- `DOMAIN_DETACH_REQUIRED`: an API attempted to replace or clear an attached hostname without completing the detach operation first.

## Detach And Reconnect

When a customer switches back to the Pagero address or replaces a custom hostname, the application must delete the previous Cloudflare Pages custom domain before saving the replacement state. Only after the provider reports deletion or absence may the D1 row become `disconnected`.

After detaching:

1. Confirm the public Pagero slug still loads.
2. Confirm the custom hostname returns the `noindex` 404 response.
3. Reconnect the hostname from page settings.
4. Confirm the new connection starts from `pending`, not a client-forged `active` state.
5. Confirm the provider domain is recreated and the same hostname cannot be claimed by a different page.

## Orphan Domain Prevention

A page save cannot change an attached custom hostname directly. The server returns `DOMAIN_DETACH_REQUIRED` until `/api/domains/manage` has safely completed `detach`.

The settings screen follows this order:

1. detect that the saved custom hostname differs from the requested hostname or default-address state
2. call `detach` with the currently saved hostname
3. require Cloudflare deletion or confirmed provider absence
4. update the D1 row and page JSON to the default address
5. save the new hostname or remain on the Pagero address
6. begin verification for the new hostname

If Cloudflare credentials are missing while a provider attachment may still exist, `DOMAIN_PROVIDER_CLEANUP_REQUIRED` blocks the state transition. This intentionally favors a visible operational error over a hidden provider mapping that could later be reassigned in D1.

The domain availability endpoint binds `pageId` to the authorized project before returning existing connection state. A caller cannot submit another project's page ID to reuse its same-page exception or inspect its connection record.

## Rollback

Application rollback does not require deleting customer ownership rows. Roll back to the previous known-good deployment while leaving `page_domains` intact. Disable the scheduled workflow or rotate `INLET_DOMAIN_RECHECK_SECRET` if the recheck endpoint itself is suspected.

SQLite/D1 does not support dropping added columns directly. If the operational columns must be removed, create a replacement table from the `0007` schema, copy the original columns, validate row counts and unique hostname ownership, swap tables inside a controlled migration, recreate indexes, and only then deploy code that no longer references the operational columns.

Never delete all domain rows as a rollback shortcut. Preserve hostname ownership, connection history, provider IDs, and timestamps for support and audit evidence.

## Local Commands

Run before merge:

```bash
npm run page:domain:qa
npm run page:domain:ops:qa
npm run page:domain:security:qa
npm run d1:schema:qa
npm run api:functions:qa
npm run ops:qa
npm run qa:all
npm run build
```

## Live-Only Checks

After explicit migration and deployment approval and production configuration:

- Confirm PR `#50` is merged and the D1 preflight result is `verified-live`.
- Apply both D1 migrations through `D1 Migration Safety` and verify the schema.
- Trigger the `Custom Domain Recheck` workflow manually once.
- Confirm its artifact is `custom-domain-recheck-evidence-<run_id>` and contains no Secret values.
- Connect a controlled real subdomain and observe `pending → verifying → active`.
- Confirm SSL becomes active.
- Force one harmless DNS mismatch and confirm the connection appears in the operator list with a retry/escalation state.
- Restore DNS and confirm automatic or manual verification clears retry and escalation metadata.
- Replace the controlled hostname and confirm the old provider domain is deleted before the new page state is saved.
- Detach and reconnect the same domain.
- Confirm a different page cannot claim the connected hostname.
- Verify assets, consultation forms, reservations, analytics, share URL, and canonical URL on the custom host.

Record the Cloudflare deployment ID, GitHub commit SHA, migration workflow run, encrypted-backup manifest, test hostname, and final domain/SSL status in the release evidence.
