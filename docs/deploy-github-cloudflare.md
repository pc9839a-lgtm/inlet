# GitHub And Cloudflare Deployment Plan

Updated: 2026-05-28

Latest verified frontend deployment:

- GitHub `main`: `77f6e85`
- Cloudflare Pages deployment: `84d6d32e`
- Public URL: `https://inlet-8mr.pages.dev/`
- Verification: public URL returns `200`; hosted API health, hosted route QA, and production browser QA pass against `https://inlet-8mr.pages.dev/`.
- Current live readiness: hosted D1 Pages Functions are active. AI/SMTP/OAuth/conversion checks remain credential-bound and must stay `skipped-live` until credentials are configured.
- D1 direct check: Cloudflare D1 API confirms `inlet-prod` database `b68d3820-001f-4dbe-87cd-dc9fc0be17ee`, production version, and required core tables. Current core counts are empty for accounts/projects/leads/events/audit_logs.

## Decision

Use this split for the first production deploy:

1. GitHub repository
   - Source of truth.
   - Runs `npm run qa:all` on push and pull request.
   - Cloudflare Pages connects to this repository through the Cloudflare Git integration.

2. Cloudflare Pages
   - Hosts the Vite frontend from `dist`.
   - Production branch: `main`.
   - Preview branch: `staging` or feature branches.
   - Build command: `npm run qa:all`.
   - Build output directory: `dist`.

3. Node API server
   - Runs `server/index.mjs`.
   - Must be deployed on a Node runtime with persistent disk for the current JSONL storage.
   - Put it behind a Cloudflare proxied DNS record such as `api.example.com`.
   - Do not deploy the current server directly to Cloudflare Workers yet.

4. Cloudflare Worker/D1 migration path
   - D1 database `inlet-prod` is created and `migrations/0001_inlet_core.sql` has been applied.
   - `wrangler.jsonc` exposes the binding as `DB`.
   - Lead/event/stats/page/account/invite/ownership routes can use D1 when the API runtime starts with `INLET_STORAGE_ADAPTER=d1` or `auto` and a valid `DB` binding is present.
   - Project access writes mirror into D1 while `access.json` remains the local compatibility source. Hosted production should move API reads to D1 after the first live D1 smoke passes.

## Why Not Workers For The Current API

The current API is a Node server:

- Entry: `server/index.mjs`
- Start command: `npm run server`
- Storage: JSONL files under `INLET_DATA_DIR`
- Uses local filesystem persistence and long-running server process assumptions.

Cloudflare Workers can run many Node-compatible APIs, but Worker filesystem support is virtual/temporary and not the right durable source of truth for leads, events, pages, manager invites, delivery logs, and revisions. For Cloudflare-native API hosting, replace JSONL persistence behind the existing adapter with D1 first.

Current D1 production database:

- Name: `inlet-prod`
- Binding: `DB`
- Database ID: `b68d3820-001f-4dbe-87cd-dc9fc0be17ee`
- Region: APAC
- Applied migration: `migrations/0001_inlet_core.sql`

## GitHub Setup

1. Initialize or connect the repository from this project root.
2. Push to GitHub.
3. Confirm `.github/workflows/qa.yml` runs and passes.
4. Protect `main` so deploys require the QA workflow to pass.

Required repository secrets for later live checks:

- `OPENAI_API_KEY`
- SMTP secrets if live SMTP QA is enabled
- OAuth secrets if Google OAuth goes live
- `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` if `npm run d1:live:qa` is enabled in CI

Do not put production secrets into the repository.

## Cloudflare Pages Setup

Create a Cloudflare Pages project using Git integration, not Direct Upload.

Settings:

- Framework preset: Vite or None
- Build command: `npm run qa:all`
- Build output directory: `dist`
- Production branch: `main`
- Preview branch: `staging` or pull request previews
- Pages project name: `inlet`

Manual deploy after Wrangler authentication:

```bash
npm run build
npm run deploy:pages
```

Preview deploy:

```bash
npm run build
npm run deploy:pages:preview
```

Production environment variables:

- `VITE_INLET_AI_MODE=server`
- `VITE_INLET_LEAD_MODE=server`
- `VITE_INLET_PAGE_MODE=server`
- `VITE_INLET_ENABLE_OWNER_ADMIN_MODE=1`
- `VITE_INLET_API_BASE=https://api.example.com`
- `VITE_INLET_API_TOKEN=<public-client-token-if-kept>`
- `VITE_INLET_MAP_EMBED_BASE=<map-wrapper-url-if-used>`
- `VITE_GOOGLE_MAPS_EMBED_KEY=<embed-key-if-used>`

Replace `api.example.com` with the real API domain.

## Node API Server Setup

Deploy the API to a Node host first.

Required:

- Node 24 or compatible current Node runtime.
- Persistent disk mounted for `INLET_DATA_DIR`.
- HTTPS domain, normally behind Cloudflare proxy.
- Process command: `npm run server`.
- Container option: build with `Dockerfile.api` and mount persistent storage to `/data`.

Production environment variables:

- `INLET_API_PORT=<platform-port-or-8787>`
- `INLET_API_TOKEN=<strong-random-token>`
- `INLET_DATA_DIR=<persistent-disk-path>`
- `INLET_ALLOWED_ORIGINS=https://inlet-8mr.pages.dev,<your-production-domain>` so the API does not allow arbitrary browser origins in production.
- `INLET_SESSION_AUTH_MODE=production`
- `INLET_SESSION_SECRET=<long-random-secret>`
- `INLET_STORAGE_ADAPTER=d1` when the deployed API has a valid D1 binding; use `auto` only during staged rollout.
- `INLET_DELIVERY_AUTO_RETRY=1`
- `INLET_DELIVERY_RETRY_INTERVAL_MS=60000`
- `INLET_DELIVERY_RETRY_MAX_ATTEMPTS=3`
- `OPENAI_API_KEY=<only-if-server-AI-enabled>`
- `INLET_SMTP_HOST=<smtp-host>`
- `INLET_SMTP_PORT=<smtp-port>`
- `INLET_SMTP_SECURE=0`
- `INLET_SMTP_USER=<smtp-user>`
- `INLET_SMTP_PASS=<smtp-password>`
- `INLET_SMTP_FROM=<sender-email>`

Health check:

- `GET https://api.example.com/api/health`
- Must report production/strict auth source as signed-session before exposing manager invite/session flows.
- Must include `storage.coverage`; for D1 rollout confirm leads, events/stats, pages, accounts, delivery logs, AI drafts, and ownership transfer are `active`, invites/members are `partial`, and AI key vault is still `jsonl`.

Container example:

```bash
docker build -f Dockerfile.api -t wayzi-api .
docker run --rm -p 8787:8787 -v inlet-data:/data --env-file .env.production wayzi-api
```

The API image includes a container `HEALTHCHECK` that calls `GET http://127.0.0.1:$INLET_API_PORT/api/health`. Keep `npm run api:container:qa` passing whenever changing `Dockerfile.api` or API runtime env requirements.

## Cloudflare DNS

Use Cloudflare DNS for both frontend and API:

- `app.example.com` or root domain -> Cloudflare Pages
- `api.example.com` -> Node API host, proxied through Cloudflare

Keep API CORS aligned with the Pages production domain.

## Release Gate

Before first production deploy:

```bash
npm run qa:all
npm run live:qa
npm run api:hosted:qa
npm run d1:live:qa
```

Expected before credentials are set:

- `qa:all` must pass.
- `live:qa` may report `skipped-live` for D1 live schema, hosted QA cleanup plan, AI, SMTP, OAuth, conversion diagnostics, and real browser QA.
- `live:qa` may report `skipped-live` for hosted API until `INLET_PUBLIC_API_URL`, `INLET_SESSION_AUTH_MODE=production`, and `INLET_SESSION_SECRET` are set. Once those exist, it calls `GET $INLET_PUBLIC_API_URL/api/health` and reports `failed-live` if signed-session auth or storage coverage is missing.
- `api:hosted:qa` reports `skipped-live` until `INLET_PUBLIC_API_URL` is set. When pointed at the static Pages URL, it must report `static-pages-html-fallback`; when pointed at the deployed API URL with `INLET_HOSTED_API_QA_REQUIRE=1`, it must pass with `auth.sourceOfTruth=signed-session` and D1 storage active unless `INLET_HOSTED_API_EXPECT_D1=0` is explicitly set.
- `d1:live:qa` reports `skipped-live` until `INLET_D1_LIVE_QA=1`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` are set. Once enabled, it confirms the configured D1 database has the required tables and basic count queries work.

After API and Pages URLs exist:

```powershell
$env:INLET_BROWSER_QA_URL='https://app.example.com'
$env:INLET_BROWSER_QA_REQUIRE='1'
npm run browser:visual:qa
Remove-Item Env:\INLET_BROWSER_QA_URL,Env:\INLET_BROWSER_QA_REQUIRE
```

Then run one real lead submission and confirm:

- lead appears in the server inbox,
- CSV export works for the selected month,
- stats update,
- SMTP/webhook delivery logs show the expected status.

## JSONL To D1 Backfill Procedure

Use this only when moving real local JSONL records into production D1. Do not run write mode just because the script exists.

Plan-only checks:

```bash
npm run d1:backfill:dry-run
npm run d1:backfill:plan
```

Write-mode requirements:

- Review the dry-run and plan output first.
- Confirm the target D1 database was backed up or exported.
- Confirm the planned ids do not already exist in D1. The script blocks existing ids by default.
- Keep `INLET_D1_BACKFILL_ALLOW_EXISTING_IDS=1` unset unless the duplicate-id plan was manually reviewed.

Production write command shape:

```powershell
$env:INLET_D1_BACKFILL_WRITE='1'
$env:INLET_D1_BACKFILL_APPROVAL='I_APPROVE_D1_BACKFILL_WRITE'
$env:INLET_D1_BACKFILL_ROLLBACK_ACK='I_HAVE_D1_BACKUP_OR_EXPORT'
$env:CLOUDFLARE_ACCOUNT_ID='<account-id>'
$env:CLOUDFLARE_API_TOKEN='<token-with-d1-edit>'
$env:INLET_D1_DATABASE_ID='b68d3820-001f-4dbe-87cd-dc9fc0be17ee'
npm run d1:backfill:plan
Remove-Item Env:\INLET_D1_BACKFILL_WRITE,Env:\INLET_D1_BACKFILL_APPROVAL,Env:\INLET_D1_BACKFILL_ROLLBACK_ACK
```

After write mode:

```bash
npm run d1:live:qa
npm run api:hosted:routes:qa
```

Rollback is manual: restore the D1 export or remove only the imported ids listed in the backfill output. Do not run broad deletes against production D1.

## Hosted QA Data Cleanup

Hosted route QA writes test-only records into production D1 using `hosted-route-qa-*` project ids and `@inlet.test` emails. Cleanup is guarded and plan-only by default.

Plan-only check:

```bash
npm run d1:hosted-qa:cleanup
```

Production cleanup requirements:

- Review the plan output first.
- Delete only the hosted route QA rows. Do not change the project prefix or email domain to target real customer data.
- Keep write mode blocked unless the operator explicitly approves the cleanup.

Write command shape:

```powershell
$env:INLET_D1_QA_CLEANUP_WRITE='1'
$env:INLET_D1_QA_CLEANUP_APPROVAL='I_APPROVE_HOSTED_QA_CLEANUP'
$env:CLOUDFLARE_ACCOUNT_ID='<account-id>'
$env:CLOUDFLARE_API_TOKEN='<token-with-d1-edit>'
$env:INLET_D1_DATABASE_ID='b68d3820-001f-4dbe-87cd-dc9fc0be17ee'
npm run d1:hosted-qa:cleanup
Remove-Item Env:\INLET_D1_QA_CLEANUP_WRITE,Env:\INLET_D1_QA_CLEANUP_APPROVAL
```

After cleanup, rerun hosted route QA only if another QA write is acceptable. Otherwise use `npm run d1:live:qa` for a read-only schema/count check.

## Cloudflare-Native Phase 2

Move to Workers only after these are done:

1. Implement D1 behind the existing JSONL adapter boundary.
2. Keep JSONL only as local/dev fallback.
3. Use `npm run d1:backfill:dry-run` and guarded `npm run d1:backfill:plan` for JSONL imports to D1.
4. Route account/session, manager invite, leads, events, stats, delivery logs, revisions, ownership transfer, and billing state through D1.
5. Deploy API as Worker or Pages Functions after route parity QA passes.

Until then, Cloudflare should own frontend hosting, DNS, TLS, CDN, cache, and preview deployments; the API should stay on a real Node host with persistent storage.
