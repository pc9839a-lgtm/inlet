# PII Retention And Export Policy

Status: approved implementation policy.
Owner: Worker 4 policy, Worker 1 data implementation, Worker 2 operator UX.

## PII Fields

| Field | Examples | Risk | Policy |
| --- | --- | --- | --- |
| Phone | lead phone, reservation phone | High | Mask by default in list views after launch. |
| Email | lead email, OAuth email | High | Mask by default in list views after launch. |
| Address | reservation/address fields | High | Store only when needed for service fulfillment. |
| Memo | operator notes | High | Treat as PII because free text may contain sensitive data. |
| Answers | form answers | High | Retain by configured period. |
| Delivery logs | webhook/SMTP logs | Medium/High | Do not store secrets or full payload duplicates. |
| CSV files | exports | High | Warn before download and include timestamp. |

## Collection Rules

- Forms and reservation blocks should request only fields required for the selected business workflow.
- Phone or email is required for follow-up; address should be optional unless visit, delivery, or service area matching needs it.
- Memo fields are operator-only and must be treated as sensitive because they can contain arbitrary customer details.
- Delivery logs must store status, target, time, idempotency key, and short error message only. They must not store SMTP passwords, bearer tokens, full webhook secrets, or duplicated full lead payloads.
- AI prompts and drafts must not include raw customer leads unless a future explicit consent/workflow is added.

## Retention Defaults

- Leads and reservations: 180 days default.
- Delivery logs: 30 days default, keep status summary longer if needed.
- Events without PII: 13 months default.
- Current PageRo event rows are not yet guaranteed PII-free because `payload_json` preserves the submitted event object. Until the event write contract is narrowed to an analytics-only schema, automated runtime retention uses a stricter 180-day maximum for all PageRo events.
- AI drafts: 30 days default.
- Failed integration payloads: 14 days default unless operator retries.
- JSONL backups containing leads: 30 days default unless retained for incident investigation.
- JSONL quarantine files containing malformed lead rows: 14 days default after repair review.

Retention runtime config:

- `INLET_LEAD_RETENTION_DAYS` — default 180 days.
- `INLET_DELIVERY_LOG_RETENTION_DAYS` — default 30 days.
- `INLET_AI_DRAFT_RETENTION_DAYS` — default 30 days.
- `INLET_EVENT_RETENTION_DAYS` — default 180 days and currently capped at 180 while event payloads are potentially PII-bearing.
- `INLET_DATA_RETENTION_BATCH_LIMIT` — default 500 explicit deletes per table/run, maximum 5000.
- `INLET_JSONL_BACKUP_RETENTION_DAYS` — 30-day policy target; implementation is part of P8 backup/restore closeout.
- `INLET_JSONL_QUARANTINE_RETENTION_DAYS` — 14-day policy target; implementation is part of P8 backup/restore closeout.

The PageRo D1 cleanup endpoint is `POST /api/admin/data/retention`. It requires a dedicated `INLET_DATA_RETENTION_SECRET`; API/session/audit secrets are not reused. The safe runner defaults to dry-run. Actual deletion additionally requires both `PAGERO_DATA_RETENTION_WRITE=1` and the exact approval phrase `I_APPROVE_PAGERO_DATA_RETENTION`.

## Masking Rules

- Phone: `010-1234-5678` -> `010-****-5678`.
- Email: `owner@example.com` -> `o***r@example.com`.
- Address: show city/district only in list view; full address only in detail view.
- Memo/answers: no automatic partial masking; use detail-only display and export warning.

Operator UI requirements:

- List views should support a "mask PII" default-on mode for live operations.
- Detail views may show full PII after a deliberate row open.
- CSV export must always be treated as full PII even if the list view is masked.
- Copy-to-clipboard controls should copy only the selected contact fields and should be logged as an operator action in a future audit trail.

## Delete Policy

- Deleting a lead must remove the lead row and associated delivery retry state.
- Deleting a page must not automatically delete leads unless explicitly confirmed.
- Export before delete should be offered but not forced.
- Delete operations should be logged without storing deleted PII.
- Backup files may still contain deleted PII until backup retention cleanup runs; delete confirmation copy must disclose this.
- Quarantine files may contain deleted PII until quarantine retention cleanup runs; repair UI must expose this operational risk.

## CSV Export Policy

Before download, operator UI should warn:

- CSV contains personal information.
- Spreadsheet apps may sync downloaded files.
- Export should be stored only in approved locations.
- Formula injection is neutralized, but operators should still inspect files before sharing.

CSV implementation requirements:

- Keep formula neutralization.
- Include export timestamp and project slug in filename.
- Support selected leads and filtered export.
- Add delivery log export as separate file if operators need it.
- Preserve UTF-8 BOM for Excel Korean readability.
- Include delivery status, summary, and bounded recent delivery logs when exporting leads.
- Server export and local export must use the same PII warning copy.

Required warning copy:

> CSV contains personal information such as phone, email, address, memo, answers, and delivery logs. Download only to an approved device/location and delete the file when the task is complete.

## Implementation Status And Tasks

- D1 retention: lead, delivery log, AI draft, and conservative event retention have a bounded cleanup/report endpoint plus fail-closed runner.
- Audit retention: the existing dedicated audit retention endpoint/workflow remains separate and keeps its 730-day default/minimum policy.
- Production deletion is not enabled by code alone. The production environment must supply the dedicated secret and explicit write/approval gates.
- JSONL backup/quarantine expiry and D1 restore verification remain part of P8 backup/restore closeout.
- Worker 1: add delivery log export endpoint or CLI if operators require a separate log export.
- Worker 2: add masking toggle and export warning modal.
- Worker 2: add delete confirmation copy that names PII impact.
- Worker 3: keep CSV sample QA for Korean text, formula neutralization, reservation fields, and delivery logs.
- Worker 4: keep `.env.example` and operator checklist aligned with retention env vars.

## Verification

- `npm run pagero:data-retention:p8:qa`
- `npm run server:smoke:leads`
- `npm run csv:qa`
- `npm run pagero:data-retention:run` is live-safe and dry-run unless the explicit write gate is enabled.
- Manual: export sample CSV and inspect in Excel/Sheets.
- Manual: verify lead deletion removes its associated delivery retry state.
