# Pagero D1 Migration Safety Runbook

Status: code complete on the landing-only migration-safety patch branch. Production execution remains approval-gated.

## Purpose

This runbook defines the only approved path for applying Pagero production D1 migrations.

The workflow is designed around five requirements:

1. **Exact pending migration list** — the operator must enter the exact filenames and order shown by the production preflight.
2. **Encrypted backup only** — the production SQL export is encrypted before any artifact upload.
3. **Recovery evidence before writes** — hashes, HMAC, and available Time Travel evidence are recorded before migrations run.
4. **Post-backup state recheck** — remote applied and pending migration lists must remain unchanged after backup and immediately before apply.
5. **No automatic restore** — recovery always requires a separate owner approval and a reviewed target database.

This workflow is for Pagero landing-page production storage only. It does not define or validate CallTag application behavior.

## Workflow

GitHub Actions workflow:

- name: `D1 Migration Safety`
- file: `.github/workflows/d1-migration-safety.yml`
- trigger: manual `workflow_dispatch` only
- concurrency: one Pagero D1 migration run at a time

## Modes

### `preflight`

Read-only checks:

- resolves the D1 database from GitHub Secrets or `wrangler.jsonc`
- lists and hashes every local SQL migration
- reads remote tables and the D1 migration history
- calculates the exact remote pending migration list
- records whether the migration-history table exists
- produces non-secret JSON evidence

No export, migration apply, restore, schema write, or data write occurs.

### `backup-and-apply`

This mode is allowed only when all gates pass:

- selected workflow branch is `main`
- `allow_writes=true`
- approval phrase is exactly `I_APPROVE_D1_MIGRATIONS`
- expected pending migration list is non-empty
- remote pending migrations exactly match the approved filenames and order
- D1 migration history exists
- Cloudflare credentials are configured
- `PAGERO_D1_BACKUP_ENCRYPTION_KEY` is at least 32 characters

The workflow then performs these operations in order:

1. exports the full remote D1 database to a temporary SQL file
2. validates that the export is non-empty and recognizable as SQL
3. records plaintext size and SHA-256 only in the non-secret manifest
4. captures available D1 Time Travel information
5. encrypts the SQL export using AES-256-CBC with PBKDF2-SHA256 and 200,000 iterations
6. records encrypted SHA-256 and keyed HMAC-SHA256
7. deletes the plaintext SQL file
8. writes a non-secret manifest and rollback instructions
9. re-reads remote migration history and recalculates pending migrations
10. aborts without applying when the applied or pending list changed after backup
11. applies the exact pending migrations only when the post-backup state is unchanged
12. re-reads migration history and verifies every approved migration was applied

If migration apply fails, or the post-backup state check blocks the write, the encrypted backup and recovery evidence remain available. The workflow itself never restores production.

## Required GitHub Secrets

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `PAGERO_D1_BACKUP_ENCRYPTION_KEY`

Optional overrides:

- `PAGERO_D1_DATABASE_NAME` — defaults to the first `database_name` in `wrangler.jsonc`
- `PAGERO_D1_DATABASE_ID` — defaults to the first `database_id` in `wrangler.jsonc`

The Cloudflare token must have the minimum permissions required for D1 query, export, Time Travel inspection, and migration apply. Do not reuse a broad account-administration token.

## Preflight Procedure

1. Open GitHub Actions → `D1 Migration Safety`.
2. Select the intended production `main` revision.
3. Choose `preflight`.
4. Leave `allow_writes` disabled.
5. Keep `require_live=true`.
6. Run the workflow.
7. Download the evidence artifact.
8. Confirm:
   - status is `verified-live`
   - database name is the intended production database
   - local migration hashes match the reviewed commit
   - remote applied history is present
   - pending filenames and order are exactly understood
   - there are no duplicate migration sequence numbers that create operator ambiguity

A missing credential produces `skipped-live`, not a successful production verification. When `require_live=true`, missing credentials fail the workflow.

## Migration Number Collision Rule

Do not assume the next migration number from an old PR description.

Before renaming or approving a new migration:

1. run production preflight
2. inspect all local migration filenames
3. inspect remote applied history
4. identify duplicate numeric prefixes
5. rename pending files to the next unambiguous sequence
6. update QA, runbooks, and PR descriptions together
7. rerun preflight against the exact final commit

The `expected_pending` workflow input must contain the final filenames returned by preflight, not guessed examples.

## Backup And Apply Procedure

Run only after the preflight result has been reviewed.

1. Confirm the selected revision is the intended production `main` SHA.
2. Enter the exact comma-separated pending migration filenames in order.
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
10. Confirm `preApplyConsistency.checked=true`.
11. Confirm `preApplyConsistency.ok=true` and that both immediately-before-apply lists match the reviewed state.
12. Confirm the final manifest status is `verified-live`.
13. Confirm all approved migrations appear in `remoteAppliedMigrationsAfter`.
14. Run service health, auth, page read/write, form, reservation, and statistics checks.

When `preApplyConsistency.ok=false`, `migrationApply.attempted` must be `false`. Treat that result as a blocked write, inspect who or what changed D1 migration history, rerun read-only preflight, and obtain a new approval. Never reuse the previous expected list.

## Recovery Policy

### Preferred recovery

Use the recorded Time Travel bookmark when available. The rollback file prints a candidate command, but automation intentionally does not execute it.

Before restoring:

1. obtain a separate owner approval
2. confirm the database name and bookmark
3. capture a second current backup when production remains reachable
4. document the incident and expected data-loss window
5. restore to a disposable D1 database first when practical
6. verify critical table counts, pages, leads, events, authentication, and integrations
7. execute a separately reviewed production restore

### Encrypted export recovery

The export can be decrypted only by an operator holding `PAGERO_D1_BACKUP_ENCRYPTION_KEY`.

Never import the export directly into production as the first recovery attempt.

1. decrypt in an isolated workspace
2. verify the manifest SHA-256 and HMAC
3. inspect the SQL and migration state
4. restore into a disposable D1 database
5. run application and data-integrity checks
6. prepare a separate production restore plan

## Disposable Restore Drill

A backup-and-apply workflow is not considered operationally complete until at least one encrypted export has been restored into a disposable D1 database.

The drill must record:

- source production commit SHA
- encrypted artifact digest
- decryption verification result
- disposable database identifier
- schema and migration-history result
- representative table counts
- page read result
- form or reservation write result using disposable data only
- cleanup result

Never use live customer writes to prove a disposable restore drill.

## Artifact Security

- plaintext production SQL is deleted before artifact upload
- only encrypted SQL, non-secret manifest, and rollback text are uploaded
- artifact retention is 30 days
- tokens and the encryption key are never written to evidence
- shell command tracing remains disabled
- database ID is represented only by its final eight characters
- encrypted artifacts must not be copied into the repository

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
- remote applied migration history changes after backup
- remote pending migration filenames or order change after backup
- approved migrations are not visible after apply

## Local QA

```bash
npm run d1:migration:safety:qa
npm run qa:all
```

The QA contract verifies manual-only execution, exact-list matching, post-backup pre-apply consistency, encryption requirements, plaintext exclusion, secret non-disclosure, backup-before-apply ordering, and the absence of automatic restore execution.
