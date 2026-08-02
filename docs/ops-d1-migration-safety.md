# Pagero D1 Migration Safety Runbook

Status: code complete on the migration-safety patch branch. Production execution remains approval-gated.

## Purpose

This runbook defines the only approved path for applying Pagero production D1 migrations.

The workflow is designed around four requirements:

1. **Exact pending migration list** — the operator must enter the exact filenames and order expected on the remote database.
2. **Encrypted backup only** — the production SQL export is encrypted before any artifact upload.
3. **Recovery evidence before writes** — the encrypted export, hashes, HMAC, and available Time Travel bookmark are recorded before migrations run.
4. **No automatic restore** — recovery always requires a separate owner approval and a reviewed target database.

## Workflow

GitHub Actions workflow:

- `D1 Migration Safety`
- file: `.github/workflows/d1-migration-safety.yml`
- trigger: manual `workflow_dispatch` only
- concurrency: one Pagero D1 migration run at a time

Modes:

### `preflight`

Read-only checks:

- resolves the D1 database from `PAGERO_D1_DATABASE_NAME` or `wrangler.jsonc`
- lists and hashes every local SQL migration
- reads remote D1 tables and `d1_migrations`
- calculates the remote pending migration list
- records whether migration history exists
- produces non-secret JSON evidence

No export, migration, restore, or database write occurs.

### `backup-and-apply`

This mode is allowed only when all gates pass:

- selected workflow branch is `main`
- `allow_writes=true`
- approval phrase is exactly `I_APPROVE_D1_MIGRATIONS`
- expected pending migration list is non-empty
- remote pending migrations exactly match the approved filenames and order
- D1 migration history table exists
- Cloudflare credentials are configured
- `PAGERO_D1_BACKUP_ENCRYPTION_KEY` is at least 32 characters

The workflow then performs these operations in order:

1. exports the full remote D1 database to a temporary SQL file
2. validates that the export is non-empty and contains recognizable SQL
3. records the plaintext size and SHA-256 hash
4. captures available D1 Time Travel information
5. encrypts the SQL export using AES-256-CBC with PBKDF2-SHA256 and 200,000 iterations
6. records the encrypted file SHA-256 and keyed HMAC-SHA256
7. deletes the plaintext SQL file
8. writes a non-secret manifest and rollback instructions
9. applies remote D1 migrations
10. re-reads `d1_migrations` and verifies every approved migration was applied

If the migration command fails, the encrypted backup and recovery evidence remain available. The workflow itself does not restore production.

## Required GitHub Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `PAGERO_D1_BACKUP_ENCRYPTION_KEY`

Optional overrides:

- `PAGERO_D1_DATABASE_NAME` — defaults to the first `database_name` in `wrangler.jsonc`
- `PAGERO_D1_DATABASE_ID` — defaults to the first `database_id` in `wrangler.jsonc`

The Cloudflare API token must have only the minimum D1 permissions needed for query, export, Time Travel inspection, and migrations.

## Preflight Procedure

1. Open GitHub Actions → `D1 Migration Safety`.
2. Select the `main` branch.
3. Choose `preflight`.
4. Leave `allow_writes` disabled.
5. Run the workflow.
6. Download the evidence artifact.
7. Confirm:
   - status is `verified-live`
   - database name is `inlet-prod`
   - the local migration hashes match the reviewed commit
   - the remote pending list is exactly what is expected
   - no unexpected migration appears before or between approved files

A missing credential produces `skipped-live`, not a successful production verification. When `require_live=true`, missing credentials fail the workflow.

## Backup And Apply Procedure

Run only after the preflight result has been reviewed.

1. Confirm the selected revision is the intended production `main` SHA.
2. Enter the exact comma-separated pending migration filenames, in order.
3. Select `backup-and-apply`.
4. Set `allow_writes=true`.
5. Enter `I_APPROVE_D1_MIGRATIONS`.
6. Keep `require_live=true`.
7. Run the workflow.
8. Download the resulting artifact immediately.
9. Confirm the artifact contains:
   - one `.sql.enc` encrypted backup
   - one `.manifest.json`
   - one `.rollback.txt`
   - no plaintext `.sql` file
10. Confirm the final manifest status is `verified-live` and the approved migrations appear in `remoteAppliedMigrationsAfter`.

## Recovery Policy

### Preferred recovery

Use the recorded Time Travel bookmark when available. The rollback file prints a candidate command, but it is intentionally not executed by automation.

Before restoring:

1. obtain a separate owner approval
2. confirm the database name and bookmark
3. capture a second current backup if production is still reachable
4. document the incident and expected data-loss window
5. execute the restore manually
6. verify application health, critical table counts, pages, leads, events, and authentication

### Encrypted export recovery

The export can be decrypted only by an operator holding `PAGERO_D1_BACKUP_ENCRYPTION_KEY`.

Never import the export directly into production as the first recovery attempt.

1. decrypt in an isolated workspace
2. verify the manifest SHA-256 and HMAC before use
3. inspect the SQL for the intended database and migration state
4. restore into a disposable D1 database first
5. run application and data-integrity checks against the disposable database
6. prepare a separate reviewed production restore plan

## Artifact Security

- plaintext production SQL is deleted before artifact upload
- only encrypted SQL, non-secret manifest, and rollback text are uploaded
- artifact retention is 30 days
- Cloudflare tokens and the encryption key are never written to evidence
- shell command tracing must remain disabled
- database ID is represented only by its final eight characters in the manifest

## Failure Conditions

The workflow must fail before migration apply when:

- workflow branch is not `main`
- write switch is disabled
- approval phrase is incorrect
- expected list is empty
- pending list differs by filename or order
- migration history is unavailable
- export is empty or invalid
- encryption fails
- plaintext cleanup cannot be guaranteed
- approved migrations are not visible after apply

## Local QA

```bash
npm run d1:migration:safety:qa
npm run qa:all
```

The QA contract verifies manual-only execution, exact-list matching, encryption requirements, plaintext exclusion, secret non-disclosure, backup-before-apply ordering, and the absence of automatic restore execution.
