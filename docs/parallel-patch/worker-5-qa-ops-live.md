# Worker 5: QA, Deployment, Live Integrations, Ops

Updated: 2026-05-28

## Goal

Keep the project deployable while other workers patch in parallel. Expand QA only where it catches real regressions and document live integration readiness without blocking offline work.

## Work Mode

- Do not send routine progress reports.
- Inspect the QA/deploy/live-readiness area broadly, not only the exact bullet list.
- Patch obvious stale QA contracts, false failures, missing cleanup, missing artifact gates, browser QA blind spots, deployment-doc drift, and skipped-live reporting risks found inside this worker area.
- Do not stop after listing a QA/ops risk if it can be fixed safely within owned files.
- Ask only for live credentials, destructive production cleanup, Cloudflare setting changes with cost/security impact, or edits outside this worker boundary.

## Owns

- QA scripts.
- Browser visual QA.
- Deployment gates.
- Artifact/bundle/CSS/runtime checks.
- Artifact cleanup command and release cleanup workflow.
- Live readiness reports.
- Ops documentation.
- Cloudflare/GitHub deployment notes.

## Primary Files

- `scripts/*qa*`
- `scripts/*quality*`
- `scripts/*deployment*`
- `scripts/*browser*`
- `package.json`
- `wrangler.jsonc`
- `docs/**`

## Allowed High-Conflict Files

- `package.json`
- `wrangler.jsonc`
- `docs/**`

Do not edit product UI or server behavior unless adding a QA hook requires a small non-behavioral data-testid/selector change. Coordinate such UI hooks with the owning worker.

## Required Product Rules

- Browser QA must remain capable of using local Chrome/Edge CDP without forcing Playwright/Puppeteer install.
- Mandatory browser mode must fail if no real browser ran.
- Production browser QA should keep covering public routes, templates, settings/manager states, admin, invite acceptance, style live preview, and rich text toolbar behavior.
- Missing live credentials must be `skipped-live`, not false failures.
- Live integrations still needing credentials: SMTP, OAuth, conversion tracking, webhook, live AI generation.
- Customer-owned AI key policy must remain visible in docs and checks.
- Payment provider work remains last.

Deployment rules:

- Build before release.
- Push to GitHub main only after local QA passes.
- Deploy Cloudflare Pages from the pushed commit.
- After deploy, run hosted API QA and production browser QA.
- Clean `.tmp-browser-visual` before strict artifact QA.
- `artifact:clean` should remove local generated artifacts such as `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, `preview.zip`, and `.tmp-browser-visual` without touching source, migrations, config, or committed assets.
- If `artifact:clean` exists locally, keep it covered by `integration:qa` and document it in release order.

Current local recheck notes:

- `artifact:clean` script and ops release-order docs may exist locally.
- `integration:qa`, `ops:qa`, strict `artifact:qa`, and full `qa:all` pass locally with the active changes.
- Worker 5 should still add/keep production browser QA coverage for any new Settings duplicate policy UI and page duplication modal before launch sign-off.

## Do Not Touch

- Template copy.
- Manager permission UI.
- Lead duplicate business logic.
- Account/auth route behavior.
- Payment provider implementation.

## QA

Run relevant checks depending on what changed:

- `npm run qa:all`
- `npm run runtime:qa`
- `npm run css:qa`
- `npm run bundle:qa`
- `npm run deployment:qa`
- `npm run integration:qa`
- `npm run browser:production:qa`
- `npm run live:qa`
- strict `artifact:qa`

Report:

- Changed QA/deploy files.
- New checks added.
- Extra QA/ops risks found and patched.
- Local QA pass/fail.
- Production deploy id and commit if deployed.
- Remaining skipped-live items and exact credentials needed.
