# Worker 5: QA, Deployment, Live Integrations, Ops

Updated: 2026-05-28

## Goal

Keep the project deployable while Workers 1-4 continue feature work. Add QA that catches real regressions, keep deployment reliable, and make live integration readiness explicit.

## Current Baseline

Already completed for deployment `6e4178c`:

- GitHub `main` pushed.
- Cloudflare Pages deployment succeeded.
- Pages Functions active.
- D1 migrations `0002` and `0003` applied.
- Hosted API QA passed.
- Hosted route QA passed.
- Production browser QA passed with duplicate settings and page duplication modal cases enabled.

Do not redo the last deployment unless a new worker patch needs release.

## Primary Files

- `scripts/*qa*`
- `scripts/*quality*`
- `scripts/*deployment*`
- `scripts/*browser*`
- `scripts/*hosted*`
- `package.json`
- `wrangler.jsonc`
- `docs/**`

Do not change product behavior unless adding a non-behavioral selector/hook is required and coordinated with the owning worker.

## Patch A: QA Coverage For New Work

Add/update QA as Workers 1-4 add behavior.

Upcoming required cases:

- account settings screen;
- logout/session expiry UX;
- email verification success/failure;
- password reset verified change;
- duplicate policy save/reload;
- blocked history panel;
- stats channel/device/source filters;
- page duplication locked/unlocked URL flow;
- admin user/project search;
- template mobile first viewport and effects.

Rules:

- Browser QA must support local Chrome/Edge CDP without requiring Playwright/Puppeteer install.
- Mandatory mode must fail if no real browser ran.
- Production browser QA should report screenshot paths.
- Do not make skipped-live look like pass for a required release case.

## Patch B: Hosted Route QA

Keep hosted route QA aligned with production APIs.

Add route coverage when new endpoints are added for:

- account profile update;
- account suspend/restore;
- email provider test/status;
- blocked history read;
- duplicate policy save/read;
- stats dimensions;
- admin user/project search;
- page duplication request/preview.

Rules:

- Write QA data with unique prefixes.
- Cleanup path must be documented.
- Production destructive cleanup requires explicit approval.
- Protected routes must check unauthenticated and unauthorized states.

## Patch C: Deployment And Artifact Safety

Release order:

1. local relevant QA;
2. `npm run build`;
3. `npm run deployment:qa`;
4. D1 migration review/apply if needed;
5. commit;
6. push to GitHub main;
7. Cloudflare Pages deploy/retry if auto deploy is skipped;
8. hosted API QA;
9. hosted route QA;
10. production browser QA;
11. live readiness QA.

Rules:

- `artifact:clean` must never delete source, migrations, config, or committed assets.
- Windows local locked `dist` or `.tmp-browser-visual` is a local cleanup issue, not automatically a product blocker.
- Deployment artifact QA must fail stale referenced assets.
- Build output budgets must stay enforced.

## Patch D: Live Integration Readiness

Live integrations needing credentials:

- SMTP or transactional email provider;
- OAuth/Google Calendar if used;
- GTM;
- Meta Pixel/CAPI;
- Google Ads;
- Naver;
- Kakao;
- webhook/CRM endpoint;
- optional live AI test using customer-owned key.

Rules:

- Missing credentials are `skipped-live`.
- Missing live credentials must be `skipped-live`, not false failures.
- Invalid credentials are failed-live.
- Live readiness output must show ready/skipped/failed counts.
- Customer-owned AI key policy must remain clear: customer pays their own AI provider usage.
- Do not store raw AI keys in page JSON/localStorage.

## Patch E: Ops Runbooks

Maintain docs for:

- Cloudflare Pages deploy;
- D1 migration and rollback;
- D1 backup/export before destructive changes;
- hosted QA data cleanup;
- custom domain setup;
- DNS verification;
- SSL status;
- SMTP credential setup;
- conversion tracking verification;
- webhook retry/dead-letter;
- incident rollback.

## Do Not Touch

- Template copy.
- Manager permission UI.
- Lead duplicate business logic.
- Account/auth route behavior.
- Payment provider implementation.

## Final Report

Report:

- changed QA/deploy/doc files;
- new checks added;
- local QA pass/fail;
- deployed commit and deployment id if deployed;
- hosted QA results if deployed;
- production browser QA results if visible UI changed;
- remaining skipped-live credentials.
