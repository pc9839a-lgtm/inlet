# Parallel Patch Files

Updated: 2026-05-28

Active files in this folder:

- `README.md`
- `remaining-patches.md`
- `worker-1-auth-members.md`
- `worker-2-leads-stats-d1.md`
- `worker-3-templates-editor.md`
- `worker-4-manager-ownership.md`
- `worker-5-qa-ops-live.md`

Use `remaining-patches.md` for the master backlog and current state. Use the worker files as the actual parallel handoff documents. Old completed worker files, backlog files, and historical review files must stay deleted so work does not repeat finished patches.

Current execution mode:

- Primary mode: parallel patching is active.
- Five workers can run at the same time only if they respect file ownership.
- Each worker must patch only their assigned area, run their own QA, and report changed files plus remaining risk.
- Final integration must be done after all worker branches/patches are merged.

Billing, subscriptions, and the 3,300/6,600/9,900 KRW plan work is intentionally last. Do not start payment-provider work until account, permission, D1 storage, inbox/stat scale, visual QA, and live integration readiness are stable.

Hard split:

- Worker 1 owns account, auth, email verification, sessions, member data.
- Worker 2 owns lead intake, duplicate policy, inbox, stats, D1 scale, CSV.
- Worker 3 owns the three templates, public landing/editor preview polish, block style behavior.
- Worker 4 owns Settings manager permission UX, ownership transfer, page duplication UX.
- Worker 5 owns QA automation, deploy readiness, live integration readiness, docs/ops.

High-conflict files:

- `src/App.jsx`
- `src/panels/SettingsPanel.jsx`
- `server/index.mjs`
- `package.json`
- `migrations/0001_inlet_core.sql`
- `src/styles/panels.css`

Touch high-conflict files only when assigned by the worker document. If two workers need the same high-conflict file, one worker patches first and the other rebases after.
