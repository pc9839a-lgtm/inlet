# Parallel Patch Files

Updated: 2026-05-27

Only two files should remain in this folder:

- `README.md`
- `remaining-patches.md`

Use `remaining-patches.md` for the current active backlog. Old completed worker files, backlog files, and historical review files were removed so work does not repeat finished patches.

Current execution mode:

- Primary mode: one worker continues sequentially from the top priority.
- Parallel split is optional only when the owner explicitly asks to fan work out again.
- If parallel work resumes, split by file ownership: server/storage/auth, frontend/editor/QA, integrations/admin/ops.

Billing, subscriptions, and the 3,300/6,600/9,900 KRW plan work is intentionally last. Do not start payment-provider work until account, permission, D1 storage, inbox/stat scale, visual QA, and live integration readiness are stable.

Do not recreate old worker files unless explicitly asked.
