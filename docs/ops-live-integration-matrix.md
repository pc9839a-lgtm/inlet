# Live Integration Verification Matrix

Status: launch checklist.
Owner: Worker 5 QA/ops. Coordinate provider implementation or product UI changes with the owning worker.

| Integration | Env Vars | Local Fixture | Live Verification | Failure Mode | Owner |
| --- | --- | --- | --- | --- | --- |
| AWS SES auth email | `INLET_AUTH_EMAIL_MODE=api`, `INLET_EMAIL_PROVIDER=ses`, `AWS_SES_REGION`, `AWS_SES_ACCESS_KEY_ID`, `AWS_SES_SECRET_ACCESS_KEY`, `INLET_AUTH_EMAIL_FROM` | mock auth email mode covers token issue/confirm; `npm run server:smoke:auth` keeps local mock verification passing | Send signup/password-reset verification email through SES and confirm browser response does not expose token | `skipped-live` if credentials/domain approval missing; failed if configured but send fails; user copy remains generic | Worker 1 |
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

- `npm run qa:all` runs the full offline gate and must pass before a release commit is pushed.
- `npm run server:smoke:integrations` verifies webhook delivery, retry queue, timeout failure, retry metadata, delivery logs, and idempotency key presence.
- `npm run server:smoke:auth` verifies strict signed sessions, forged header rejection, manager invite acceptance, and manager tab/action enforcement.
- `npm run integration:mock:qa` verifies legacy SMTP delivery plumbing for lead notifications, webhook retry/dead-letter/idempotency/duplicate compaction mock data, and OAuth missing ID/missing secret/expired/revoked/not-configured states.
- `npm run ai:qa` verifies fixture quality and editable AI draft structure; live mode reports one of `skipped-live`, `server-unreachable`, `missing-key`, `request-failed`, or `bad-model-response`.
- `npm run conversion:qa` verifies tracking insertion contracts and editor/template-preview suppression; ad platform diagnostics are reported as `skipped-live` without credentials.
- `npm run ai:qa`, `npm run integration:mock:qa`, and `npm run conversion:qa` include `liveSummary` counts. The launch record must copy those counts so pass/fail/skipped-live totals are visible without reading every provider row.
- `npm run live:qa` provides one consolidated readiness report for AI, AWS SES auth email, OAuth, conversion diagnostics, and real-browser visual QA.
- `npm run runtime:qa` verifies repository/runtime wiring.
- `npm run browser:production:qa` must be run with a real browser for launch sign-off. Use `INLET_PRODUCTION_BROWSER_QA_REQUIRE=1`; missing browser runtime in mandatory mode is a release failure, not `skipped-live`.

## Result Labels

- `pass`: verified with local fixture or live credentials.
- `fail`: configured check ran and failed.
- `skipped-live`: live credential or external account missing.
- `not-implemented`: product integration is not yet available.

Do not convert `skipped-live` into a local QA failure. A launch record may include skipped-live rows only when the feature is disabled for that launch or the operator explicitly accepts the missing live check.

## Implementation Tasks

- Worker 4: local SMTP mock fixture remains for lead delivery integrations and idempotency evidence through `npm run integration:mock:qa`.
- Worker 1: AWS SES auth email delivery is the live signup/password-reset email path for Pages Functions.
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

## Launch Record Fields

Record these fields beside the final QA output:

- GitHub repository and commit SHA pushed to `main`.
- Cloudflare Pages deployment id and production URL.
- `npm run live:qa` `liveSummary` counts.
- `npm run browser:production:qa` browser engine, screenshot count, and whether mandatory browser mode was enabled.
- Every `skipped-live` row with the exact missing credential or external account access.
- Operator decision for each skipped AWS SES/OAuth/AI/conversion/webhook check.
