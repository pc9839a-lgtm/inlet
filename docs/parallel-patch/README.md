# Parallel Patch Files

Updated: 2026-05-27

Only two files should remain in this folder:

- `README.md`
- `remaining-patches.md`

Use `remaining-patches.md` for the current 3-worker split. Old completed worker files, backlog files, and historical review files were removed so workers do not repeat finished patches.

Current split:

- Worker 1: Auth/session/account/member/storage.
- Worker 2: Real browser QA + frontend product polish + deployment artifacts.
- Worker 3: Live integrations + internal admin/ops documentation.

Billing, subscriptions, and the 3,300/6,600/9,900 KRW plan work is intentionally last. Do not start payment-provider work until account, permission, D1 storage, inbox/stat scale, visual QA, and live integration readiness are stable.

Do not recreate old worker files unless explicitly asked.
