# Live Integration Verification Matrix

Status: launch checklist.
Owner: Worker 4 policy, Worker 1 integration implementation, Worker 3 QA evidence.

| Integration | Env Vars | Local Fixture | Live Verification | Failure Mode | Owner |
| --- | --- | --- | --- | --- | --- |
| SMTP | `INLET_SMTP_HOST`, `INLET_SMTP_PORT`, `INLET_SMTP_SECURE`, `INLET_SMTP_USER`, `INLET_SMTP_PASS`, `INLET_SMTP_FROM` | `npm run server:smoke:integrations` covers delivery plumbing; `npm run integration:mock:qa` covers success, retryable failure, non-retryable failure, timeout, retry, dead-letter, idempotency key | Send test lead and confirm email in operator inbox | `skipped-live` if credentials missing; failed if configured but send fails; inspect `/api/leads/delivery-logs` | Worker 1 |
| External webhook | Page integration URL, `INLET_INTEGRATION_TIMEOUT_MS` | `npm run server:smoke:integrations`; `npm run integration:mock:qa` covers retry, dead-letter, idempotency evidence, and duplicate retry compaction | Send lead to real endpoint and inspect received payload plus `GET /api/leads/retry-queue` | failed/partial delivery, retry queue, dead-letter state, idempotency mismatch | Worker 1 |
| Google Calendar OAuth | TBD client id/secret | `npm run integration:mock:qa` covers not-configured, missing client ID, missing secret, expired token, revoked token, connected state | OAuth consent, create test event, revoke token | `skipped-live` until OAuth exists or credentials are available | Worker 1 |
| Google Maps wrapper | `VITE_INLET_MAP_EMBED_BASE`, wrapper service key | Map widget local render | Public custom domain renders map iframe from wrapper domain | wrapper 404, Google referrer restriction | Worker 1/4 |
| AI live generation | `OPENAI_API_KEY`, `VITE_INLET_AI_MODE=server`, `INLET_AI_TIMEOUT_MS`, `INLET_AI_FALLBACK_MODEL` | `npm run ai:qa` fixture proves editable blocks and reports supported live failure kinds | Generate real draft with short prompt and inspect editable block quality | `skipped-live` when live mode is disabled or key/server is absent; `server-unreachable` when endpoint is down; `missing-key` for auth/key rejection; `request-failed` for configured HTTP failures; `bad-model-response` for invalid JSON/schema/editable block output | Worker 2 |
| GTM | page tracking config in page settings | `npm run conversion:qa` | GTM preview/debug mode sees public-page events | no event, duplicate event, editor/template-preview event leak | Worker 3 |
| Meta Pixel | page tracking config in page settings | `npm run conversion:qa` | Meta test events receives lead/CTA events | no event, wrong event name/id, editor event leak | Worker 3 |
| Google Ads | page tracking config in page settings | `npm run conversion:qa` | Tag Assistant confirms conversion ping | no conversion, wrong label/id, duplicate conversion | Worker 3 |
| Naver | page tracking config in page settings | `npm run conversion:qa` | Naver tool confirms script and conversion | script blocked, wrong id, no conversion | Worker 3 |
| Kakao | page tracking config in page settings | `npm run conversion:qa` | Kakao pixel helper confirms conversion | script blocked, wrong id, no conversion | Worker 3 |

## Shared Local Checks

- `npm run server:smoke:integrations` verifies webhook delivery, retry queue, timeout failure, retry metadata, delivery logs, and idempotency key presence.
- `npm run server:smoke:auth` verifies strict signed sessions, forged header rejection, manager invite acceptance, and manager tab/action enforcement.
- `npm run integration:mock:qa` verifies SMTP success/retryable failure/non-retryable failure/timeout/retry/dead-letter, webhook retry/dead-letter/idempotency/duplicate compaction mock data, and OAuth missing ID/missing secret/expired/revoked/not-configured states.
- `npm run ai:qa` verifies fixture quality and editable AI draft structure; live mode reports one of `skipped-live`, `server-unreachable`, `missing-key`, `request-failed`, or `bad-model-response`.
- `npm run conversion:qa` verifies tracking insertion contracts and editor/template-preview suppression; ad platform diagnostics are reported as `skipped-live` without credentials.
- `npm run ai:qa`, `npm run integration:mock:qa`, and `npm run conversion:qa` include `liveSummary` counts. The launch record must copy those counts so pass/fail/skipped-live totals are visible without reading every provider row.
- `npm run live:qa` provides one consolidated readiness report for AI, SMTP, OAuth, conversion diagnostics, and real-browser visual QA.
- `npm run runtime:qa` verifies repository/runtime wiring.

## Result Labels

- `pass`: verified with local fixture or live credentials.
- `fail`: configured check ran and failed.
- `skipped-live`: live credential or external account missing.
- `not-implemented`: product integration is not yet available.

Do not convert `skipped-live` into a local QA failure. A launch record may include skipped-live rows only when the feature is disabled for that launch or the operator explicitly accepts the missing live check.

## Implementation Tasks

- Worker 4: local SMTP mock fixture now covers success, retryable failure, non-retryable failure, timeout, retry, dead-letter, and idempotency evidence through `npm run integration:mock:qa`.
- Worker 1: add a real SMTP dry-run endpoint only if operators need inbox testing without submitting a real lead.
- Worker 1: delivery status inspection now has `/api/leads/delivery-logs` and `/api/leads/retry-queue`; future work is UI surfacing and retention cleanup.
- Worker 2: expose AI live generation status clearly in settings.
- Worker 3: add conversion event evidence checklist for public route.
- Worker 4: keep this matrix updated whenever an integration is added.

## Live Phase Acceptance

- A `skipped-live` result is acceptable only when the integration is disabled for that launch or the operator records missing credentials as an accepted launch risk.
- A configured live credential that returns a transport error is `fail`, not `skipped-live`.
- A mock pass does not prove external account configuration. It proves local retry, dead-letter, idempotency, and status handling before live credentials are attached.
- `liveSummary.fail` must be zero for release. `liveSummary.skipped-live` is allowed only with an explicit launch-risk acceptance.
- Use `docs/ops-operator-readiness-checklist.md` as the sign-off record source for credential gate evidence.
