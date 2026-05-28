# Worker 2: Leads, Duplicate Policy, Inbox, Stats, D1 Scale

Updated: 2026-05-28

## Goal

Make lead intake, duplicate/spam handling, inbox paging, CSV, stats, and D1 large-data behavior ready for real operation.

## Work Mode

- Do not send routine progress reports.
- Inspect the lead/inbox/stats/D1 area broadly, not only the exact bullet list.
- Patch obvious duplicate, spam, paging, CSV, stats accuracy, D1 query, retention, and QA risks found inside this worker area.
- Do not stop after listing a data/scale risk if it can be fixed safely within owned files.
- Ask only for production D1 write migration, data deletion, unclear product decisions, or edits outside this worker boundary.

## Owns

- Public lead submit dedupe/rate-limit policy.
- Server-side duplicate/spam settings model and API contract.
- Blocked/limited submission history storage and read API.
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
- Duplicate/spam behavior must be configurable per project/page by the owner. Do not hard-code one global policy.
- If there is already a hard-coded duplicate/rate-limit implementation, treat it as incomplete until it reads project/page `leadDuplicateSettings` or the final equivalent persisted settings.
- Hard-coded values such as phone/email 30 days, client repeat 30 minutes, and IP 1 minute / 3 submissions may be defaults only. User settings must override them.

Required configurable settings:

- `ipDuplicateRejectEnabled`: IP duplicate collection rejection on/off.
- `cookieDuplicateRejectEnabled`: cookie/client-id duplicate collection rejection on/off.
- `fieldDuplicateLimitCount`: how many same form-field duplicates are allowed before limiting.
- `fieldDuplicateLimitPeriod`: duplicate check period, such as 1 day, 7 days, 1 month.
- `phoneEmailDuplicateMode`: mark-only or reject for phone/email duplicates. Default should be mark-only unless the owner explicitly chooses stricter behavior.
- Map any UI names such as `rejectIpDuplicate`, `rejectCookieDuplicate`, `formDuplicateLimitCount`, `formDuplicateLimitWindow`, and `phoneEmailMode` into the server policy consistently.

Default recommendation:

- Cookie duplicate rejection on for short accidental repeats.
- IP duplicate rejection off by default, or limited to short-window abuse only.
- Phone/email duplicate detection on with `duplicate=true` metadata, not hard reject.
- Hard-block only rapid repeat, high risk score, or explicit owner-selected reject mode.

Recommended rules:

- Same page/project + same phone within 30 days -> save as duplicate with `phone_30d`.
- Same page/project + same email within 30 days -> save as duplicate with `email_30d`.
- Same page + same client id within 30 minutes -> block or save as duplicate with `client_repeat_30m`.
- Same page + same IP 3+ times in 1 minute -> rate limit.
- Same IP too many times per day -> `spam_suspected`.

Blocked/limited submission history:

- Store a row for blocked or rate-limited submissions.
- Include time, project/page/form id, reason, risk score, duplicate policy snapshot, IP hash, client id, user agent hash, normalized phone/email hash if available, and submitted field summary without exposing more PII than needed.
- Provide a read API for the UI to show blocked history.
- A UI-only `blockedHistory` placeholder on page JSON is not enough. The server must persist blocked/rate-limited attempts and expose them through a stable read path.
- CSV export for normal leads should not silently include blocked rows unless the user explicitly chooses a blocked-history export later.

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
- `blocked`
- `blockedReason`
- `policySnapshot`

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
- Add/keep tests proving user settings override defaults:
  - IP duplicate rejection off does not block normal same-IP submissions except clear abuse.
  - IP duplicate rejection on blocks or limits according to configured threshold/window.
  - cookie/client duplicate rejection on/off changes behavior.
  - phone/email mode `mark` saves duplicate metadata; mode `block` stores a blocked-history row.
  - blocked-history read path returns safe fields only.
- `npm run api:hosted:routes:qa` if hosted env is available
- `npm run build`

Report:

- Changed files.
- Duplicate/rate-limit policy implemented.
- Duplicate/spam settings fields and defaults.
- Blocked submission history storage/API.
- Extra lead/stat/D1 risks found and patched.
- D1 indexes or schema changes.
- Measured behavior for large fixture, if added.
- Remaining risk for real production data volume.
