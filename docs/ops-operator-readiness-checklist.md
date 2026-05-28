# Operator Readiness Checklist

Status: launch checklist.
Owner: operator plus Worker 5 QA/ops. Coordinate product, server, billing, or provider behavior changes with the owning worker before changing code.

## Local Verification

- Install dependencies: `npm install`.
- Run server syntax check: `node --check server/index.mjs`.
- Run API container contract QA: `npm run api:container:qa`.
- Run runtime QA: `npm run runtime:qa`.
- Run mojibake text QA: `npm run mojibake:qa`.
- Run auth context QA: `npm run auth:qa`.
- Run AI fixture QA: `npm run ai:qa`.
- Run templates QA: `npm run templates:qa`.
- Run revision QA: `npm run revision:qa`.
- Run stats QA: `npm run stats:qa`.
- Run conversion QA: `npm run conversion:qa`.
- Run mock integration QA: `npm run integration:mock:qa`.
- Run CSV QA: `npm run csv:qa`.
- Run CSS QA: `npm run css:qa`.
- Run rendering QA: `npm run rendering:qa`.
- Run accessibility QA: `npm run accessibility:qa`.
- Run Worker 3 aggregate QA: `npm run worker3:qa`.
- Run production browser QA in mandatory real-browser mode before launch sign-off: `INLET_PRODUCTION_BROWSER_QA_REQUIRE=1 npm run browser:production:qa`.
- For a newly deployed Settings patch, include duplicate policy and page duplication modal browser cases with `INLET_PRODUCTION_QA_URL=https://<production-host>` or `INLET_PRODUCTION_QA_INCLUDE_NEXT_SETTINGS=1`.
- Run JSONL operations QA: `npm run jsonl:qa`.
- Run server auth smoke: `npm run server:smoke:auth`.
- Run server leads smoke: `npm run server:smoke:leads`.
- Run server events smoke: `npm run server:smoke:events`.
- Run server pages smoke: `npm run server:smoke:pages`.
- Run server integrations smoke: `npm run server:smoke:integrations`.
- Run production build: `npm run build -- --outDir dist-check-readiness`.
- Confirm the build output includes `bundle-quality-check` JSON with JS/CSS totals under budget.
- Remove generated QA/browser artifacts with `npm run artifact:clean`, then run strict artifact QA: `npm run artifact:qa -- --strict`.

## Credentials

- `INLET_API_TOKEN` set for server.
- `INLET_ALLOWED_ORIGINS` set to the deployed Pages/custom domain before exposing the API publicly.
- `INLET_SESSION_AUTH_MODE=strict` and `INLET_SESSION_SECRET` set before exposing manager invite/session flows outside local smoke/dev.
- Treat `INLET_SESSION_AUTH_MODE=production` as signed-session strict mode. `/api/health` must report `auth.sourceOfTruth=signed-session`.
- Do not use `INLET_SESSION_AUTH_MODE=hosted` for launch until `/api/health` reports `auth.hostedAuthImplemented=true`.
- `VITE_INLET_API_TOKEN` set only for trusted admin/editor deployment.
- `OPENAI_API_KEY` set for server AI mode.
- SMTP credentials set if email delivery is enabled.
- Google Maps Embed key set only on map wrapper service.
- Webhook endpoints verified with test payload.
- GTM/Meta/Google Ads/Naver/Kakao IDs verified on public preview page.

## Live Credential Gate

Do not mark a launch candidate live-ready until each enabled integration has either a pass record or an explicit `skipped-live` acceptance.

| Integration | Required Inputs | Command | Manual Evidence |
| --- | --- | --- | --- |
| AI generation | `OPENAI_API_KEY`, `INLET_AI_QA_LIVE=1`, server URL if not localhost | `npm run ai:qa` | One short prompt returns editable hero, form/reservation, and CTA blocks. Failures must be recorded as `server-unreachable`, `missing-key`, `request-failed`, or `bad-model-response`. |
| SMTP | `INLET_SMTP_HOST`, `INLET_SMTP_PORT`, `INLET_SMTP_USER`, `INLET_SMTP_PASS`, `INLET_SMTP_FROM` | `npm run integration:mock:qa` then `npm run server:smoke:integrations` | Test lead reaches an operator inbox and delivery log is `sent`. |
| External webhook | Real CRM/test endpoint URL and timeout policy | `npm run server:smoke:integrations` | CRM receives one payload; repeated retry keeps one idempotency key record. |
| OAuth | Client ID, client secret, redirect URL, operator test account | `npm run integration:mock:qa` | Consent succeeds, one event is created, revoke state is captured before re-consent. |
| Conversion tracking | Public URL plus GTM/Meta/Ads/Naver/Kakao account access | `npm run conversion:qa` | Platform diagnostics see public-page events and no editor/template-preview events. |
| Map wrapper | Wrapper base URL and Google Maps Embed key on wrapper service | Public route manual check | Custom domain page renders wrapper iframe without exposing unrestricted map usage. |

## Data Operations

- Backup location documented.
- Restore dry-run documented.
- JSONL corruption/repair procedure documented.
- JSONL backup listing tested with `/api/jsonl/backups`.
- JSONL repair dry-run tested with `/api/jsonl/report` and `/api/jsonl/repair`.
- Lead CSV export tested.
- CSV export warning copy reviewed against PII policy.
- Lead delete tested.
- Webhook retry tested.
- Retry queue/dead-letter visibility tested.
- Failed delivery review path documented.
- Storage migration policy reviewed before switching a local-only workspace to server mode.

## Public Tracking

- Admin/editor routes noindexed.
- Public landing page routes indexable only when intended.
- Conversion events verified on public page, not editor preview.
- Internal operator traffic filtering policy documented.
- Browser visual QA is either run with `INLET_BROWSER_QA_URL` or explicitly recorded as `skipped-local-browser` with static rendering QA passing.

## Deployment Cache

- Build output directory cleaned or deployed atomically.
- Stale assets not served after deploy.
- Cache busting strategy confirmed.
- `robots.txt` and sitemap route checked.
- Windows EPERM local build cleanup notes treated as local-only risk, not production incident.
- GitHub `main` commit SHA recorded before Cloudflare Pages deploy.
- Cloudflare Pages deployment id, production URL, and Pages Functions state recorded after deploy.
- Hosted API QA and hosted route QA run against the deployed production URL when `INLET_PUBLIC_API_URL` is available.
- Browser QA screenshots and Chrome profile output cleaned with `npm run artifact:clean` before strict artifact QA.

## Live-Only Checks

Missing live credentials should be recorded as `skipped-live`, not local QA failure.

- SMTP real email delivery.
- External CRM webhook delivery.
- OAuth consent screen.
- Production AI generation with paid account.
- Real ad platform conversion diagnostics.
- Hosted API runtime check: run `npm run api:hosted:qa` with `INLET_PUBLIC_API_URL` set to the deployed API URL. `static-pages-html-fallback` means the URL is still only serving the static frontend, not the server API.

Local mock QA must still pass before accepting a `skipped-live` result. `npm run integration:mock:qa` proves SMTP success/retryable failure/non-retryable failure/timeout/retry/dead-letter, webhook retry/dead-letter/idempotency/duplicate compaction, and OAuth missing client ID/missing secret/expired/revoked/not-configured handling without external credentials.

## Sign-Off Record

For each launch candidate, record:

- Date/time and operator.
- Git commit or package artifact id.
- QA commands run and pass/fail/skipped-live results.
- `liveSummary` from `npm run ai:qa`, `npm run integration:mock:qa`, and `npm run conversion:qa`.
- `liveSummary` from `npm run live:qa` showing every enabled live path is either ready or explicitly accepted as skipped-live.
- `liveSummary` from `npm run api:hosted:qa` showing hosted `/api/health` is ready, or explicitly recording why it is still skipped/failed before launch.
- Production browser QA result showing `requireRealBrowser=true`, browser engine, screenshot count, and Settings duplicate policy/page duplication modal coverage.
- Cloudflare Pages deployment id, production URL, Pages Functions state, and GitHub `main` commit SHA.
- Build output directory and bundle totals.
- Backup/restore dry-run evidence.
- CSV export sample evidence.
- Any known residual risks accepted for launch.
