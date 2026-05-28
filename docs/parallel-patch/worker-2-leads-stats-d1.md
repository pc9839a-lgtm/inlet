# Worker 2: Leads, Duplicate Policy, Inbox, Stats, D1 Scale

Updated: 2026-05-28

## Goal

Make lead intake, duplicate/spam handling, inbox paging, CSV, stats, and D1 large-data behavior ready for real operation.

## Owns

- Public lead submit dedupe/rate-limit policy.
- Inbox first-load limit and `더보기` paging.
- Month-bounded lead list and CSV export.
- Duplicate/spam badges and export fields.
- Stats SQL aggregation and D1 performance checks.
- Large fixture/performance QA.
- JSONL fallback boundary and D1 migration safety.

## Primary Files

- `server/index.mjs`
- `server/storage/**`
- `src/panels/InboxPanel.jsx`
- `src/panels/StatsPanel.jsx`
- `scripts/*leads*`
- `scripts/*stats*`
- `scripts/*csv*`
- `scripts/*perf*`
- `scripts/*d1*`

## Allowed High-Conflict Files

- `server/index.mjs`
- `src/panels/InboxPanel.jsx`
- `src/panels/StatsPanel.jsx`
- `migrations/0001_inlet_core.sql` only if dedupe fields/indexes require it.

Do not edit `src/panels/SettingsPanel.jsx`.

## Required Product Rules

Lead duplicate policy:

- Phone/email is the primary duplicate key.
- Cookie/client id prevents accidental repeated submission from the same browser.
- IP is only a short-window spam/rate-limit signal. Do not use IP alone for long-term blocking.
- Prefer saving duplicate leads with metadata over losing potentially valid leads.
- Hard-block only obvious rapid repeat or rate-limit abuse.

Recommended rules:

- Same page/project + same phone within 30 days -> save as duplicate with `phone_30d`.
- Same page/project + same email within 30 days -> save as duplicate with `email_30d`.
- Same page + same client id within 30 minutes -> block or save as duplicate with `client_repeat_30m`.
- Same page + same IP 3+ times in 1 minute -> rate limit.
- Same IP too many times per day -> `spam_suspected`.

Data fields to add or normalize where practical:

- `clientId`
- `ipHash`
- `userAgentHash`
- `phoneNormalized`
- `emailNormalized`
- `duplicate`
- `duplicateReason`
- `riskScore`
- `submittedAt`

Inbox/CSV:

- First load must stay limited to 50 rows.
- More rows only through `더보기`.
- Month-bounded query only.
- CSV must be month-bounded.
- CSV should include duplicate status/reason and useful operator fields.
- Compact row should not reintroduce useless phone/message/mail/copy action clutter.

Stats:

- D1 SQL aggregation should remain preferred for monthly PV, CTA, form, reservation, lead, status, delivery, and trend.
- Add/verify indexes for page, month/date, type, source, device, dedupe key where useful.

## Do Not Touch

- Template content.
- Manager permission UI.
- Auth UI except consuming stable account/session identity.
- Billing checkout.
- Public legal page copy.

## QA

Run at minimum:

- `npm run server:smoke:leads`
- `npm run server:smoke:events`
- `npm run stats:qa`
- `npm run csv:qa`
- `npm run perf:qa`
- `npm run d1:adapter:qa`
- `npm run api:hosted:routes:qa` if hosted env is available
- `npm run build`

Report:

- Changed files.
- Duplicate/rate-limit policy implemented.
- D1 indexes or schema changes.
- Measured behavior for large fixture, if added.
- Remaining risk for real production data volume.
