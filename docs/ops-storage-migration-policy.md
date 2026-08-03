# Storage Migration Policy

Status: approved implementation policy.
Owner: Worker 4 policy, Worker 1 storage implementation, Worker 2 migration UX.

## Scope

This policy defines what can remain in browser storage and what must move to server storage before live operation.

## Storage Classes

| Data | Current Risk | Target Storage | Notes |
| --- | --- | --- | --- |
| Page draft | Lost per browser, stale conflicts | Server page storage plus local recovery draft | Local copy may remain as recovery cache only. |
| Published page | Needs stable source of truth | Server page storage | Server `updatedAt` and revisions are authoritative. |
| Leads | Contains PII | Server JSONL or future DB | Browser lead storage is local-dev only. |
| Events | Analytics integrity risk | Server event storage | Browser events can be queued temporarily. |
| Images | Quota and payload risk | Remote object storage or server asset store | Base64 in page JSON should be treated as migration debt. |
| AI drafts | May contain business/PII hints | Server scoped draft store | Browser draft cache should be removable. |
| API keys | Secret | Server env or user-owned secure credential flow | Client key storage is local testing only. |
| UI preferences | Low risk | localStorage | Theme/editor panel state can remain local. |

## Allowed localStorage

- `mobile-db-landing-v12-start-mode-v2`: start mode selection.
- `inlet-auth-v1`: non-secret auth identity cache only.
- `inlet-dashboard-v1`: workspace/dashboard open state.
- Anonymous local workspace id used only for client project scoping.
- Temporary unsaved page draft for crash recovery.
- Temporary conflict drafts under `mobile-db-landing-v12-safe-page:page-conflict-draft:*`.
- UI-only preferences such as panel state, selected tab, preview mode, and editor affordances.

## Must Not Remain Browser-Only

- Production leads.
- Production reservations.
- CSV export history.
- Delivery logs.
- Published page source of truth.
- API secrets.
- Long-lived AI prompts or generated drafts containing customer information.

## Current Keys And Target State

| Key or Path | Current Use | Target State | Cleanup Owner |
| --- | --- | --- | --- |
| `mobile-db-landing-v12-safe-page` | Local page draft/source | Recovery cache after server save, not production source | Worker 2 |
| `mobile-db-landing-v12-safe-leads` | Local leads cache | Local-dev only, export/import before live server mode | Worker 1/2 |
| `mobile-db-landing-v12-safe-events` | Local event cache | Short-lived queue only; server events authoritative | Worker 1/3 |
| `mobile-db-landing-v12-safe-page:page-conflict-draft:*` | Conflict recovery drafts | Keep last 10/14 days with inspect/restore/delete UI | Worker 2 |
| `server/data/projects/<projectId>/pages` | Server page revisions | Authoritative page source in server mode | Worker 1 |
| `server/data/projects/<projectId>/leads.jsonl` | Server leads | Authoritative lead source in server mode | Worker 1 |
| `server/data/projects/<projectId>/events.jsonl` | Server events | Authoritative analytics event source in server mode | Worker 1/3 |
| `server/data/projects/<projectId>/.backups` | Rewrite/restore backup files | Keep for operator restore and retention cleanup | Worker 1/4 |
| `server/data/projects/<projectId>/.quarantine` | Malformed JSONL rows | Keep for repair audit, never served publicly | Worker 1/4 |

## Migration Path

1. Detect existing local page data.
2. Show operator a migration banner in admin/editor.
3. Upload page to server page API.
4. Keep local copy as recovery draft until server save succeeds.
5. After successful save, mark local copy as migrated with timestamp.
6. Allow operator to delete migrated local data.
7. For leads/events, export local data first, then import or archive server-side.
8. For oversized images, list heavy blocks and require replace/remove/keep decision.

## Live Mode Rules

- Server mode must read pages, leads, and events from the server path for the active `projectId`.
- Local page data may be saved after server mode only as recovery cache with an explicit timestamp.
- Local leads/events must not be silently merged into server stats; migration/import must be explicit.
- CSV export in server mode must prefer server data. Local fallback export is allowed only when the operator intentionally selected local rows.
- Base64 images are accepted for backward compatibility but must be shown in cleanup UX when they exceed warning thresholds.
- Repair and restore operations must preserve a pre-operation backup before rewriting JSONL.

## Production D1 Migration Rule

Production D1 migrations must use the manual `D1 Migration Safety` workflow documented in `docs/ops-d1-migration-safety.md`.

Required sequence:

1. Run read-only preflight against the selected production `main` SHA.
2. Review local migration hashes, remote migration history, and exact pending filename order.
3. Resolve duplicate migration sequence numbers before approving writes.
4. Run `backup-and-apply` only with explicit write approval and the exact pending list.
5. Create and validate a full SQL export before migration apply.
6. Encrypt the export before artifact upload and delete the plaintext SQL file.
7. Record SHA-256, HMAC-SHA256, and available Time Travel recovery evidence.
8. Re-read remote applied history and pending filenames immediately after backup.
9. Abort without applying when either list changed after the approved preflight state.
10. Apply only when the post-backup consistency check passes.
11. Verify approved migrations appear in remote history after apply.
12. Require separate owner approval for any restore operation.
13. Prove recovery with a disposable D1 restore drill before calling the process operationally complete.

The migration workflow must never upload plaintext production SQL, must never apply against changed post-backup migration state, and must never execute Time Travel restore automatically.

## Cleanup Rules

- Local recovery drafts: keep last 10 or 14 days, whichever is smaller.
- Local event queue: keep 24 hours max after successful server flush.
- Local lead cache: live mode should not write new entries except explicit fallback export.
- Base64 image payloads over 500 KB per image require warning.
- Encrypted D1 migration evidence artifacts: retain 30 days unless incident response requires a controlled archive.
- Plaintext D1 SQL exports: temporary workspace only and deleted before artifact upload.

## Implementation Tasks

- Worker 1: add server import endpoint or documented CLI for local lead/event migration.
- Worker 1: add retention cleanup for `.backups` and `.quarantine` with dry-run.
- Worker 2: add local migration banner for page/leads/events when switching to server mode.
- Worker 2: keep recovery draft manager and oversized image cleanup available from Settings/editor.
- Worker 3: add QA fixture for migration detection and no data loss warnings.
- Worker 4: include storage policy in launch checklist and PII retention policy.
- Completed patch: guarded D1 preflight, encrypted export, exact pending-list check, post-backup pre-apply state recheck, post-apply verification, and recovery evidence workflow.

## Verification

- `npm run auth:qa`
- `npm run server:smoke:pages`
- `npm run server:smoke:leads`
- `npm run d1:migration:safety:qa`
- Manual: create local-only page, switch to server mode, confirm migration prompt appears.
- Manual production operation: run D1 preflight first; do not run `backup-and-apply` without owner approval and reviewed pending migrations.
