# Parallel Patch Handoff

Updated: 2026-05-28

This folder is the active handoff set for the next production patches after deployment `6e4178c`.

Do not use older backlog notes as the source of truth. The current deployment is live on Cloudflare Pages, D1 migrations `0002` and `0003` have been applied, hosted route QA passed, and production browser QA passed including Settings duplicate policy and page duplication modal coverage.

Active files:

- `remaining-patches.md`
- `worker-1-auth-members.md`
- `worker-2-leads-stats-d1.md`
- `worker-3-templates-editor.md`
- `worker-4-manager-ownership.md`
- `worker-5-qa-ops-live.md`

## How To Work

Primary mode: parallel patching is active.

Five workers can run at the same time only if they respect file ownership.

Five workers may patch in parallel only by file ownership.

1. Worker 1: account, auth, sessions, member records, transactional email boundary.
2. Worker 2: lead intake, duplicate/spam policy, blocked history, inbox, stats, CSV, D1 scale.
3. Worker 3: the three templates, public landing quality, editor/preview polish.
4. Worker 4: Settings UX, manager permissions, ownership transfer, page duplication UX, internal admin UI.
5. Worker 5: QA automation, deployment, live integration readiness, operations docs.

Each worker should read only their own worker file plus `remaining-patches.md`. Do not wait for routine progress reporting. Patch the assigned area, fix obvious adjacent bugs inside the same boundary, run QA, and report once at the end.

## Stop Conditions

Stop and ask only for:

- destructive production data deletion;
- real payment-provider behavior;
- production D1 backfill writes beyond migrations already approved;
- SMTP/OAuth/conversion/webhook credentials;
- DNS or custom-domain ownership changes;
- product decisions not stated in the worker file;
- edits in another worker's high-conflict file.

Do not stop just because a task reveals another fix inside the same worker boundary. Patch it and add QA.

## High-conflict files

These files require the owning worker rule:

- `src/App.jsx`
- `src/panels/SettingsPanel.jsx`
- `server/index.mjs`
- `server/storage/d1Adapter.mjs`
- `package.json`
- `wrangler.jsonc`
- `migrations/*.sql`
- `scripts/production-browser-quality-check.mjs`

If a high-conflict file is needed by two workers, one worker patches first and the second worker rebases or waits for merge.

## Final Report Format

Each worker must finish with:

- modified files;
- implemented work;
- risks found and patched;
- QA commands with pass/fail;
- remaining blocker that needs credentials, deployment, another worker, or a product decision.

## Billing Rule

Do not start payment provider implementation yet. The 3,300 / 6,600 / 9,900 KRW plans remain the final phase after account, email, duplicate policy, stats, templates, admin, and live integration readiness are stable.
