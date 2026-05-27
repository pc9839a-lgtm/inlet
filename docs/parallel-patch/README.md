# Parallel Patch Files

Updated: 2026-05-26

Only two files should remain in this folder:

- `README.md`
- `remaining-patches.md`

Use `remaining-patches.md` for the current 3-worker split. Old completed worker files, backlog files, and historical review files were removed so workers do not repeat finished patches.

Current split:

- Worker 1: Auth/session + storage/index.
- Worker 2: Real browser QA + deployment artifacts.
- Worker 3: Live integrations.

Do not recreate old worker files unless explicitly asked.
