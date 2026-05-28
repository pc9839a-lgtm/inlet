# Worker 2: Leads, Duplicate Policy, Inbox, Stats, D1 Scale

Updated: 2026-05-28

## Goal

Make lead intake, duplicate/spam prevention, blocked history, inbox, CSV, stats, and D1 scale behavior production-grade.

This worker owns the data policy. Worker 4 may build Settings UI, but the server behavior and persistence must be correct here.

## Current Baseline

Already deployed:

- D1 lead dedupe columns migration `0002` applied.
- D1 event dimension migration `0003` applied.
- Hosted route QA passed for lead write/read, event write, stats summary, CSV, delivery logs, retry queue.
- Inbox first-load/month-bounded behavior exists.
- Basic duplicate metadata fields exist.
- Patch A/B local implementation exists after 2026-05-28 patch:
  - server consumes `leadDuplicateSettings` / `duplicateCollectionSettings` aliases;
  - default phone/email duplicate behavior is mark-only;
  - explicit `phoneEmailMode: block` blocks duplicate contact submissions;
  - explicit `rejectCookieDuplicate` / `rejectIpDuplicate` block by configured count/window;
  - hard 1-minute same-IP abuse rate limit remains active;
  - blocked submissions are persisted to JSONL and D1 `lead_blocked_submissions`;
  - `GET /api/leads/blocked-history` returns safe, paged, month/date-bounded rows.

Do not redo the D1 baseline. Finish policy and operational behavior.

## Primary Files

- `server/index.mjs`
- `server/storage/d1Adapter.mjs`
- `server/storage/runtimeAdapter.mjs`
- `server/storage/**`
- `src/lib/leadCsv.js`
- `src/panels/InboxPanel.jsx`
- `src/panels/StatsPanel.jsx`
- `scripts/server-smoke-leads.mjs`
- `scripts/stats-quality-check.mjs`
- `scripts/csv-quality-check.mjs`
- `scripts/offline-performance-check.mjs`
- `scripts/d1-adapter-quality-check.mjs`
- `migrations/*.sql` only for lead/event/stat schema/index changes

Do not edit Settings UI unless coordinating with Worker 4.

## Patch A: Server-Enforced Duplicate Settings

Status: implemented locally, not yet deployed unless the current branch has been pushed and migration `0004` applied.

The server must consume project/page duplicate settings. Hard-coded values may be defaults only.

Phone/email is the primary duplicate key.

Cookie/client id prevents accidental repeated submission.

IP is only a short-window spam/rate-limit signal.

Required settings:

- `ipDuplicateRejectEnabled`
- `cookieDuplicateRejectEnabled`
- `fieldDuplicateLimitCount`
- `fieldDuplicateLimitPeriod`
- `phoneEmailDuplicateMode`

Map any UI aliases into the same server model:

- `rejectIpDuplicate`
- `rejectCookieDuplicate`
- `formDuplicateLimitCount`
- `formDuplicateLimitWindow`
- `phoneEmailMode`

Default policy:

- cookie/client duplicate rejection on for short accidental repeat;
- IP rejection off by default or short-window only;
- phone/email duplicate detection on;
- phone/email default behavior is mark-only, not hard block;
- hard block only rapid repeat, rate-limit abuse, high risk score, or explicit strict owner setting.

Required tests:

- Covered in `scripts/server-smoke-leads.mjs`: phone duplicate mark, client repeat mark, hard same-IP abuse block, configured strict policy block, blocked history read.
- Still add if editing this area again: explicit IP-off same-IP non-abuse fixture and cookie-off fixture.

## Patch B: Blocked Submission History

Status: implemented locally, with D1 migration `migrations/0004_lead_blocked_submissions.sql`.

Implement server-persisted blocked/rate-limited history.

Do not treat page JSON `blockedHistory` as sufficient.

Required fields:

- id;
- createdAt;
- projectId;
- pageSlug or pageId;
- form/block id if available;
- reason;
- riskScore;
- policySnapshot;
- ipHash;
- clientId;
- userAgentHash;
- phone/email masked or hashed summary;
- submitted field summary with minimal PII.

Read API:

- owner/client admin can read blocked history for their project/page;
- manager access follows project permission rules;
- unauthenticated users cannot read it;
- response uses safe fields only;
- support month/date bounds and pagination.

UI contract for Worker 4:

- empty state must mean no rows;
- loading/unavailable state must mean server path not loaded;
- blocked history should show date, page/form, reason, risk score, and safe identifier.

QA:

- Passed locally: `npm run server:smoke:leads`
- Passed locally: `npm run d1:schema:qa`
- Passed locally: `npm run integration:qa`
- Hosted follow-up after deploy: apply migration `0004`, then run `api:hosted:routes:qa`.

## Patch C: Inbox And CSV Operation Quality

Keep:

- first load 50 rows;
- more rows only by paging;
- month-bounded list;
- month-bounded CSV;
- date-only compact list view;
- no useless phone/message/mail/copy action clutter in compact rows.

Improve:

- duplicate badge and reason visibility;
- blocked/limited status visibility where relevant;
- CSV fields for duplicate, duplicate reason, risk score, source page, delivery status, memo, form values;
- Excel/Korean compatibility remains intact.

QA:

- `npm run csv:qa`
- `npm run server:smoke:leads`
- large fixture/perf check if query behavior changes.

## Patch D: Stats Expansion

Add or verify D1 aggregate coverage for:

- PV;
- CTA click;
- link click;
- form start;
- submit attempt;
- submit success;
- reservation attempt;
- reservation success;
- conversion rate;
- source/channel;
- device;
- page;
- monthly trend;
- period comparison.

Rules:

- Do not hydrate huge event lists on the client for core stats.
- D1 SQL aggregation is preferred for production.
- JSONL full scan remains local fallback only.
- Add indexes before adding high-volume queries.

QA:

- `npm run stats:qa`
- `npm run perf:qa`
- `npm run d1:adapter:qa`
- `npm run server:smoke:events`

## Do Not Touch

- Template copy.
- Manager permission UI.
- Page duplication UX.
- Account auth behavior except consuming stable identity.
- Billing checkout.

## Final Report

Report:

- changed files;
- exact duplicate policy defaults and settings;
- blocked history API/storage;
- D1 schema/index changes;
- inbox/CSV changes;
- stats aggregation changes;
- QA commands and results;
- remaining production data-volume risk.
