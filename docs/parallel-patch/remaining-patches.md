# Remaining Patches

Updated: 2026-05-28

This is the only active patch assignment file. All completed worker handoff files and old backlog/history files were removed from this folder to prevent duplicate work.

Current execution mode: one worker continues sequentially from the highest priority. Parallel split is optional only if explicitly requested again.

## Current Recheck Snapshot

Last checked on 2026-05-28 after commit `67279fa`:

- Passing baseline after the authenticated browser QA, tab deep-link deployment, production browser QA, hosted API runtime QA, Pages Functions health API, and D1 hosted route patches: `npm run qa:all`, `npm run integration:qa`, `npm run api:functions:qa`, `npm run api:hosted:routes:qa`, `npm run deployment:qa`, and strict `artifact:qa`.
- CSS source total: `391276/500000`.
- CSS QA now emits compact file summaries on Cloudflare Pages or when `INLET_QA_COMPACT=1`, preventing release build logs from being dominated by every split CSS file row.
- Main referenced JS: `318589/430000`.
- Largest lazy preview CSS: `188791` bytes.
- Templates: `3` templates, `189` structural checks.
- Full offline QA: `npm run qa:all` passes `33` steps, including `api:hosted:qa`, `api:hosted:routes:qa`, and `api:functions:qa`.
- Real browser visual QA: `INLET_BROWSER_QA_REQUIRE=1` passes against production `https://inlet-8mr.pages.dev/?tab=stats` with `INLET_BROWSER_QA_STATE_PRESET=manager-limited`, verifying the Stats tab deep link. It also passes against production `https://inlet-8mr.pages.dev/?tab=settings` with `INLET_BROWSER_QA_STATE_PRESET=owner-settings` plus `INLET_BROWSER_QA_CLICK_TEXT=매니저 권한,관리`, verifying the Settings manager card and ownership transfer entry.
- Production browser visual QA: `npm run browser:production:qa` now runs seventeen production cases: public desktop home, public mobile PC-guard, public about/contact/privacy/terms routes, owner edit cards, owner start modal, the 3 primary template first viewports, owner inbox, manager stats, owner settings manager permissions, owner settings manager permissions compact, internal admin ownership queue, and manager invite acceptance. With `INLET_PRODUCTION_BROWSER_QA_REQUIRE=1` or `INLET_BROWSER_QA_REQUIRE=1`, all cases use a real browser and assert that error/start-modal text, required selectors, and target screens are present or absent where expected.
- Production browser visual QA now reports the browser engine, viewport list, screenshot count, and screenshot paths per case, so failed or suspicious screens can be inspected without rerunning route discovery.
- Production browser visual QA also accepts `INLET_BROWSER_QA_REQUIRE=1` as the mandatory-browser alias, so release commands do not silently run optional mode because the wrong require env was used.
- Strict artifact QA: passes with no leftover `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, or `preview.zip` artifacts.
- GitHub: pushed to `pc9839a-lgtm/inlet` `main` at commit `67279fa`.
- Cloudflare Pages: production deployment `c0acdf0f` succeeded for commit `67279fa` with `uses_functions=true`; public URL `https://inlet-8mr.pages.dev/` returns `200`, hosted API runtime QA passes, and production browser QA passes seventeen real-browser cases with the current QA scripts.
- Cloudflare Pages deployment `fcab1c27` for commit `4b214b1` failed during the verbose `qa:all` build log phase before deploy. The follow-up `79d5d59` compacted CSS QA output for Pages builds and deployed successfully.
- `/api/health` is now served by Cloudflare Pages Functions with `uses_functions=true`, `service=inlet-api`, `mode=pages-functions`, `auth.sourceOfTruth=signed-session`, `auth.signedSessionReady=true`, `storage.active=d1`, `storage.d1Ready=true`, and `storage.coverage.length=9`.
- `npm run live:qa` now reports hosted API health as `ready` when run with `INLET_PUBLIC_API_URL=https://inlet-8mr.pages.dev`; it reads the deployed `/api/health` response directly and no longer requires local session-secret env just to inspect hosted health. It also surfaces the hosted QA D1 cleanup plan so `hosted-route-qa-*` and `@inlet.test` cleanup readiness is visible before launch review.
- Hosted API runtime QA: `INLET_PUBLIC_API_URL=https://inlet-8mr.pages.dev INLET_HOSTED_API_QA_REQUIRE=1 npm run api:hosted:qa` passes with `liveSummary.ready=1`.
- Hosted route QA: `INLET_PUBLIC_API_URL=https://inlet-8mr.pages.dev INLET_HOSTED_ROUTE_QA_REQUIRE=1 INLET_HOSTED_ROUTE_QA_WRITE=1 npm run api:hosted:routes:qa` passes with `liveSummary.ready=46`, proving D1-backed public writes for `/api/leads` and `/api/events`, protected read/write checks for page routes, authenticated D1 read checks for lead list, stats summary, CSV export, delivery logs, retry queue, page save/read, revision list/read, restore, hosted account flow checks, hosted manager invite create/read/accept checks, hosted AI key status/save/delete, hosted AI draft save/list/delete, hosted ownership transfer create/list, and internal admin billing-wait/block/complete checks.
- Hosted route QA success details now use `detail`; `failureReason` is reserved for failed-live checks so production logs do not look like false failures.
- Hosted API runtime QA removes empty `failureReason` on ready checks; the field is now reserved for failed-live/static-fallback cases.
- Cloudflare D1 direct API check confirms `inlet-prod` exists with required core tables and empty initial core counts for accounts/projects/leads/events/audit_logs.
- Current UI note: Cards block is intentionally limited to `1/2` columns. Keep that scope unless the product direction changes.

## Already Done

Do not reassign these unless a regression is found:

- Client admin UI gating: client mode sees Inbox, Stats, and Settings; Settings includes manager invite/read-write permission controls.
- Internal admin route separation: the public workspace navigation no longer exposes an Admin tab; logged-in master-only controls live on `/admin` or `/{pageSlug}/admin`.
- Master/manager permission groundwork: managers are stored under `ownership.managers`, tabs are read-gated, and writes are blocked unless the manager has write permission for that tab.
- Server manager permission enforcement: `access.json` stores manager owner ids and tab read/write access, and protected server routes check tab scope before read/write.
- Manager invite/session API: server can create manager invite tokens, read invite metadata, accept invites, promote accepted users to managers, and return a signed session when `INLET_SESSION_SECRET` is configured.
- Account login/session groundwork: `/api/auth/login` verifies server-stored accounts, rejects invalid credentials, requires verified email, and returns the normalized user plus a session field.
- Session refresh/logout groundwork: `/api/auth/session` verifies and refreshes signed sessions, `/api/auth/logout` gives the client a stable stateless logout contract, and the app clears expired sessions on 401/403/404.
- Email verification mock contract: `/api/auth/email-verification` and `/api/auth/email-verification/confirm` issue/confirm offline verification tokens so signup/reset flows can be tested before a real email provider exists.
- Signup now requires email verification server-side; smoke covers unverified signup rejection and verified-token signup.
- Settings manager invite UI: masters and transferred client admins can issue and copy manager invite links from the Settings permission card.
- Public manager invite acceptance: `/invite/:token` lets invited managers confirm email/name, stores the returned session, and opens the assigned project.
- Browser visual QA covers the manager invite acceptance screen without writing test invite rows to production D1 by mocking the invite read response in the browser init script.
- Manager invite login hardening: invite acceptance in login mode now verifies the invited account password server-side; wrong passwords return 401 before the manager is added.
- Invite acceptance screen is lazy-loaded so the manager invite route does not add to the normal initial app path.
- Manager server permission matrix: smoke now verifies edit read/write allow, inbox read/write deny, stats read allow/write deny, and invite creation deny for both local manager headers and accepted signed manager sessions.
- Strict session smoke now rejects forged dev headers when `INLET_SESSION_AUTH_MODE=strict` is set without `INLET_SESSION_SECRET`.
- Strict session smoke now also rejects invalid signed sessions even when forged dev identity headers are present.
- Env/operator docs now include `INLET_SESSION_AUTH_MODE` and `INLET_SESSION_SECRET` for deployed invite/session flows.
- Server project access enforcement: `X-Inlet-Owner-Id` and `X-Inlet-Project-Id` are checked against project access metadata.
- Transferred client access: `clientEmail` maps to a client owner id and is verified in `server:smoke:auth`.
- Inbox large-data behavior: month bounded, 50-row paging, CSV month/filter bounded.
- Server CSV export now rejects unbounded requests and requires a month or one-month-or-less date range.
- Server smoke temp data cleanup is enforced so `.tmp-smoke` does not remain after successful smoke runs.
- JSONL storage now goes through `server/storage/jsonlAdapter.mjs` for read/write/append operations.
- Lead/event list and stats summary now use the JSONL adapter query boundary, so the later DB/index implementation can replace one adapter surface instead of scattered list filtering code.
- CSV export, delivery logs, and delivery retry queue now also use/report the JSONL query boundary where the response format allows it.
- Unpaged legacy server helpers `listLeads`, `listEvents`, and `filterLeadList` were removed; new read paths must use the paged/query boundary.
- `perf:qa` reports JSONL fallback full-scan endpoints and next index fields for leads/events/stats/CSV/delivery logs/retry queue.
- Server/operator-facing lead/event error messages were normalized away from mojibake text.
- Stats labels, period labels, delivery labels, and reservation lead counting were normalized away from mojibake text.
- Stats large-data behavior: month/period capped and server summary contract verified.
- Templates: 3 primary templates, structural QA passing with `189` checks; IDs are `debt-relief-consult`, `wedding-invitation`, and `quote-request`.
- Template structure: all 3 templates now start with an editable topnav block; wedding invitation no longer uses a hidden non-editor topnav, and quote-request no longer relies on page normalization to append topnav at the end.
- Map renderer: generic labels such as `오시는 길` no longer trigger a weak Google iframe query by themselves; specific address/place data gets an iframe and every non-empty query gets an explicit external map link fallback.
- CSS: source total `388804/500000`, baseline guard active, exact duplicate rule count is zero, and CSS QA rejects mojibake/replacement characters in split CSS files.
- Background effects: snow/petals/sparkle now have distinct particle generation, shape styling, and animation QA coverage through rendering/runtime/css checks.
- Lazy CSS: panel/home/preview owner CSS files are imported by their lazy components, and `LandingRenderer` CSS is no longer part of the first screen CSS.
- Bundle: referenced main JS `313614/430000`; initial app CSS is about `131KB`; preview renderer CSS is lazy (`LandingRenderer-*.css`, `188984` bytes, `initial:false`).
- Dist artifacts: `bundle:qa` reports `staleAssetCount: 0`, and strict artifact QA passes with no leftover local generated artifacts.
- Full QA aggregate: `npm run qa:all` runs 33 verification steps and cleans generated `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, and `preview.zip` artifacts before strict artifact gates.
- Mojibake QA: `mojibake:qa` scans runtime source/server text, and it is included in Worker 3 QA plus integration readiness.
- Server/operator-facing mojibake cleanup is now stricter: `scripts/mojibake-quality-check.mjs` catches additional broken CJK and `?`-prefixed Korean mojibake patterns. `server/index.mjs` compiles after cleanup, and lead/event/CSV/SMTP/integration/page/revision/account-facing server strings no longer trip the current guard.
- Mock integrations: AI/SMTP/webhook/OAuth/conversion skipped-live and mock checks pass.
- AI, mock integration, and conversion QA now include `liveSummary` counts so pass/fail/skipped-live status is visible without reading every row.
- Browser visual QA keeps Playwright/Puppeteer optional by default and supports mandatory mode with `INLET_BROWSER_QA_REQUIRE=1`.
- Browser visual QA skipped output now includes POSIX and PowerShell mandatory real-browser commands to run when a local URL/browser dependency is available.
- Browser visual QA now also supports local Chrome/Edge through CDP without installing Playwright/Puppeteer. It resets its dedicated browser profile per run, writes desktop/mobile screenshots, rejects blank/error/overflow screens, and reports the actual browser engine used.
- Browser visual QA now supports `INLET_BROWSER_QA_EXTRA_URLS=auto`, which expands public footer/legal route coverage to `/about`, `/contact`, `/privacy`, and `/terms`.
- Browser visual QA now supports authenticated state presets through `INLET_BROWSER_QA_STATE_PRESET=owner-settings|client-settings|manager-limited`, template state presets through `INLET_BROWSER_QA_STATE_PRESET=template-preview:<template-id>`, invite acceptance mocking through `INLET_BROWSER_QA_STATE_PRESET=invite-acceptance`, text/selector interactions through `INLET_BROWSER_QA_CLICK_TEXT` and `INLET_BROWSER_QA_CLICK_SELECTOR`, expected text assertions through `INLET_BROWSER_QA_EXPECT_TEXT`, required selector assertions through `INLET_BROWSER_QA_EXPECT_SELECTOR`, and authenticated desktop checks through `INLET_BROWSER_QA_VIEWPORTS=desktop|compact`. The compact viewport is 920px wide so it exercises narrow desktop layouts without hitting the app's below-900px PC-only guard.
- Authenticated tab deep links now work through `?tab=edit|style|inbox|stats|settings`. The app sanitizes requested tabs against the known navigation keys, falls back to the first allowed tab when the account cannot access the requested tab, and updates the URL when operators switch tabs.
- App shell title is normalized to `Inlet` for generated production builds instead of the old MVP placeholder title.
- `INLET_SESSION_AUTH_MODE=production` now aliases to strict signed-session auth and rejects forged dev identity headers.
- `/api/health` now exposes `auth.sourceOfTruth`; production/strict reports `signed-session`, while hosted mode remains blocked as `hosted-auth-unimplemented` until a real provider is integrated.
- JSONL query plans now expose active/missing index fields plus the recommended DB/index adapter target.
- JSONL query plans now also expose `indexKey` and `migrationPriority`, so stats/events/month and delivery retry paths can be indexed first.
- `npm run live:qa` summarizes hosted API health, AI, SMTP, OAuth, conversion, and real-browser live readiness in one skipped-live/ready report.
- D1 production database `inlet-prod` exists on Cloudflare, is bound as `DB` in `wrangler.jsonc`, and has `migrations/0001_inlet_core.sql` applied.
- D1 production schema groundwork exists in `migrations/0001_inlet_core.sql` for accounts, projects, members, invites, pages, revisions, leads, events, delivery logs, AI drafts, subscriptions, payments, ownership transfer requests, and audit logs.
- D1 adapter groundwork exists in `server/storage/d1Adapter.mjs`; it now includes lead/event row encoding, decoding, paged list helpers, idempotent lead upsert, event insert helpers, monthly stats SQL aggregation, delivery log sync, and delivery retry queue reads.
- D1 runtime selection groundwork exists in `server/storage/runtimeAdapter.mjs`; `INLET_STORAGE_ADAPTER=jsonl|d1|auto` is recognized and `/api/health` reports requested/active storage mode plus route-level coverage for accounts, pages, leads, events/stats, delivery logs, AI drafts, invites/members, ownership transfer, and AI key storage.
- D1 lead/event route migration has started: `/api/leads` create/list/update/delete, month-bounded CSV export, `/api/events` create/list, and month-bounded `/api/stats/summary` use D1 when `storageRuntime.active === 'd1'`; lead status, kind, delivery-status, and month-bounded search filters are covered.
- Cloudflare Pages Functions now host `/api/leads`, `/api/leads/export.csv`, `/api/leads/delivery-logs`, `/api/leads/retry-queue`, `/api/events`, `/api/stats/summary`, `/api/pages/:slug`, `/api/pages/:slug/revisions`, `/api/pages/:slug/revisions/:id`, `/api/pages/:slug/restore`, `/api/auth/email-verification`, `/api/auth/email-verification/confirm`, `/api/auth/register`, `/api/auth/login`, `/api/auth/session`, `/api/auth/logout`, `/api/auth/account`, `/api/auth/account/status`, `/api/auth/password`, `/api/projects/invites`, `/api/projects/invites/:token`, `/api/projects/invites/:token/accept`, `/api/projects/ownership-transfer`, `/api/admin/ownership-transfer/:id`, `/api/ai/key`, `/api/ai/test`, `/api/ai/draft`, `/api/ai/drafts`, and `/api/ai/drafts/:id` against production D1 for the hosted route slices. Public POST writes create a minimal project/account shell when needed to satisfy D1 foreign keys; protected GET/read paths still require signed session or API token.
- Browser production QA presets now use stored auth state without fake signed-session tokens, so hosted `/api/auth/session` no longer clears the visual QA login state during manager/settings screenshots.
- D1 duplicate lead detection now uses contact/email SQL lookup instead of hydrating the first 100 monthly leads.
- D1 stats now uses SQL aggregate queries for monthly PV/CTA/form/reservation/lead/status/delivery/type/trend counts instead of hydrating the full month into memory, honors `dateFrom/dateTo` inside the selected month, and dedupes events with `dedupe_key` when available.
- D1 delivery logs now sync from lead delivery payloads into `delivery_logs`; delivery log and retry queue APIs use D1 when active, while JSONL remains the local fallback.
- D1 backfill dry-run exists as `npm run d1:backfill:dry-run`; it scans JSONL project/singleton data and reports lead/event/page/delivery-log counts, invalid lines, duplicate ids, duplicate monthly contacts, and duplicate event dedupe keys without writing to D1.
- D1 guarded backfill write plan exists as `npm run d1:backfill:plan`; it is plan-only by default, skips empty local data, preflights existing production ids, and requires explicit write/approval/rollback-ack environment variables before any D1 insert can run.
- Hosted route QA cleanup plan exists as `npm run d1:hosted-qa:cleanup`; it targets only `hosted-route-qa-*` projects and `@inlet.test` QA accounts, runs plan-only by default, and requires `INLET_D1_QA_CLEANUP_WRITE=1` plus `INLET_D1_QA_CLEANUP_APPROVAL=I_APPROVE_HOSTED_QA_CLEANUP` before deleting QA rows.
- D1 account helper exists for normalized account encode/decode, email lookup, phone lookup, and account upsert. Auth register/login/session/password routes now use D1 `accounts` when `storageRuntime.active === 'd1'`; JSONL remains the fallback.
- D1 invite/member sync exists: manager invite creation writes to D1 `invites` when D1 is active, invite acceptance syncs accepted invite status plus the manager row into D1 `project_members`, and project access writes now mirror `projects/project_members` into D1 while `access.json` remains the local compatibility source.
- D1 ownership transfer request storage exists: `ownership_transfer_requests` encode/decode/upsert/list helpers are wired, `/api/projects/ownership-transfer` can create/list requests, `/api/admin/ownership-transfer/:id` can move requests into approval/billing-clearance states, and JSONL/access metadata remains the local fallback.
- Ownership transfer smoke now proves client admins can request transfer, managers cannot request transfer, and only the master can move a request into billing-clearance/approval state.
- Internal `/admin` now shows a project-scoped ownership transfer approval queue with refresh, billing-wait, approve, and reject actions. Manager permission settings remain in normal Settings, not internal admin.
- D1 page storage now has `pages` and `page_revisions` encode/decode/upsert/read/list helpers. Page GET/POST and revision list/read use D1 when `storageRuntime.active === 'd1'`, with JSON file storage kept as local fallback.
- D1 AI draft storage now has `ai_drafts` encode/decode/upsert/list/soft-delete helpers. `/api/ai/drafts` list/save/delete uses D1 when active, with JSON file storage kept as local fallback.
- D1 project access read fallback exists: if `access.json` is absent and D1 is active, project access can be derived from `projects` plus active `project_members`. The remaining migration is a real Cloudflare D1 smoke plus deciding when to make D1 the primary permission read/write source for hosted projects.
- D1 adapter behavior QA exists in `scripts/d1-adapter-quality-check.mjs` and verifies lead/event encode/decode, lead upsert, event dedupe insert, paged lists, SQL stats aggregation, storage runtime fallback/ready plans, and runtime route coverage.
- D1 runtime coverage QA exists as `npm run d1:runtime:qa`; it proves that missing D1 bindings show JSONL fallback for every route and ready D1 bindings expose active/partial/jsonl status by feature group.
- D1 live schema QA exists as `npm run d1:live:qa`; it stays `skipped-live` until `INLET_D1_LIVE_QA=1`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_API_TOKEN` are provided, then checks the real Cloudflare D1 schema and basic counts.
- Preview renderer CSS import regression is fixed: `LandingRenderer.css` now imports `preview-cards.css` by relative path, so Vite no longer looks for a missing root-level `styles/preview-cards.css`.
- Account dashboard polish exists: the dashboard now shows account email, phone, role label, and a clear logout action instead of a bare email-only header.
- Auth error messages now use readable Korean copy for duplicate email/phone, password policy, email verification, login, and expired session cases.
- Account profile update now has a signed-session `PATCH /api/auth/account` endpoint and dashboard form for name/phone edits. Server smoke covers normalized phone persistence and duplicate-phone rejection.
- Settings manager UX has quick permission presets: `편집 담당`, `운영 담당`, and `조회 전용`. Detailed per-menu permission rows stay collapsed until needed, and invite creation first persists the current manager draft into ownership settings.
- Ownership transfer completion now exists. `completed` is rejected unless `billingClearanceStatus` is `clear`; when completed, the target manager becomes the project owner, previous owner/client access is removed, the manager row is removed from manager permissions, page ownership metadata is updated, and server smoke verifies old-owner denial plus new-owner access.
- Customer-owned AI key groundwork is started. Server AI test/draft endpoints can accept a per-request `apiKey`, validate its format, and fall back to `OPENAI_API_KEY` only when no customer key is sent. The frontend can pass the typed key through server mode without saving it to page JSON/localStorage by default.
- Hosted customer AI key and draft routes are deployed on Cloudflare Pages Functions. Production D1 now has the `ai_keys` table, hosted route QA proves masked key status, invalid-key rejection, encrypted key save/delete without raw-key echo, invalid test classification, and AI draft save/list/delete against production D1.
- Account dashboard now exposes the AI cost/key policy as account state, so operators see that AI generation uses a customer key per request unless a server fallback key is configured.
- Production deploy is confirmed through GitHub push plus Cloudflare Pages retry. Wrangler direct deploy still requires `CLOUDFLARE_API_TOKEN`, so current deploy path is GitHub push -> Cloudflare Pages build/retry.
- Account/session hardening patch 1 is done locally: email verification delivery now has a `mock`/`smtp` server boundary, SMTP mode does not expose verification tokens, health reports auth email delivery readiness, password reset returns users to login instead of creating a sessionless logged-in state, and server smoke covers SMTP-missing skip behavior.
- Account status model exists: accounts can be soft-blocked as `suspended` or `deleted` without physical removal, inactive accounts are denied login/session/profile/password operations, and duplicate email/phone checks still see inactive records so operational history stays attached.
- Server-side customer AI key storage exists: `/api/ai/key` can read masked status, save an encrypted OpenAI key scoped by account/project, and soft-delete it without ever returning the raw key. Server smoke verifies invalid-key rejection, masked connected status, and delete-to-missing behavior.
- AI panel server-key wiring exists: in server AI mode the panel reads masked key status, saves/deletes via `/api/ai/key`, and generation/test requests include project auth headers so the server can use the stored key without putting the raw key in page JSON or localStorage.
- AI key test/audit hardening exists: `/api/ai/test` returns `keyTest.status` for stored-key tests, records last test status/message/time on the masked key record, and writes local/D1 audit rows for save, delete, and test actions.
- Manager disable/remove hardening exists: Settings can mark managers inactive or remove them, inactive/removed managers are blocked by both frontend access-mode resolution and server project access checks, and ownership transfer can only target active managers.
- Manager access audit exists: manager invite creation, invite acceptance, permission changes, and removal write local `audit.jsonl` rows and attempt D1 `audit_logs` rows when D1 is active.
- Ownership transfer status UX exists: Settings and internal Admin now share readable Korean labels/copy for requested, billing wait, approved, rejected, completed, and canceled states; the Settings request button now calls the real server persistence path in server mode.

## Optional Parallel Split

Default is single-worker sequential patching. If parallel work is explicitly requested again, split only by file ownership.

| Worker | Patch | Files |
| --- | --- | --- |
| Worker 1 | Auth/session/account/member/storage | `server/index.mjs`, `server/storage/**`, account/auth/storage scripts, auth QA |
| Worker 2 | Frontend/editor/settings/inbox/visual QA | `src/**`, browser/rendering QA, build/clean/prune scripts |
| Worker 3 | Live integrations + internal admin/ops docs | AI key handling, SMTP/OAuth/conversion/webhook QA, admin/ops docs |

## Sequential Patch Priority

Patch in this order. Billing must not jump ahead of the foundation work:

1. Account/session/login/email verification/password reset.
2. Manager invite, member permission, and ownership transfer request state.
3. D1 route migration for leads, events, stats, CSV, delivery logs, invites, account records, and ownership transfer.
4. Inbox/stat large-data behavior, retention hooks, and quota hooks without paid-plan enforcement.
5. Frontend product polish: Settings, Inbox, editor live preview, template first viewport, real browser visual QA.
6. Live integration readiness: customer-owned AI keys, SMTP, OAuth, conversion tracking, webhook retry/dead-letter.
7. Final billing phase: 3,300/6,600/9,900 plans, checkout, card registration, subscription renewal, payment failure, invoices, and payment admin overrides.

## Immediate Remaining Functional Patches

These are not already-done items. Patch sequentially from item 1 unless the owner explicitly changes priority.

1. Production account/session hardening
   - Email verification delivery boundary exists: default mock for offline QA, SMTP mode hides tokens and reports skipped when SMTP is not configured.
   - Password reset flow now runs as `email verified -> set new password -> return to login`.
   - Expired-session UX already clears local auth and shows a clear login-required toast.
   - Account deletion/suspension state model exists without hard-deleting operational records.
   - Remaining work: configure real transactional SMTP provider and run a live send smoke with credentials.
   - Keep duplicate email/phone enforcement server-side.

2. Customer-owned AI key storage and hosted AI routes
   - Per-request customer API key support exists.
   - Encrypted per-account/per-project server key storage exists with masked status and delete/disconnect API.
   - AI panel UI is connected to `/api/ai/key` for masked status, save, and delete.
   - Stored-key test now records `valid`, `missing`, `invalid`, `quota_rate_limited`, or `request_failed` status when the endpoint can classify the failure.
   - Local JSONL audit plus D1 audit write attempts exist for key save/delete/test.
   - Hosted Pages Functions and production D1 route QA are done for `/api/ai/key`, `/api/ai/test`, `/api/ai/draft`, `/api/ai/drafts`, and `/api/ai/drafts/:id`.
   - Remaining work: run real live AI generation with a real customer key or configured `OPENAI_API_KEY`, then polish the UI copy for connected/invalid/quota/rate-limited states.
   - Never store raw keys in page JSON/localStorage by default.

3. D1 real runtime smoke and write-side migration
   - D1 schema and adapter QA exist.
   - `/api/health` now exposes route-level D1 coverage, and `npm run d1:runtime:qa` locks the expected active/partial/jsonl states.
   - Real Cloudflare D1 database/schema smoke is prepared through `npm run d1:live:qa`; latest direct check confirms the production D1 schema exists.
   - Hosted API QA now detects whether `/api/health` is a real API JSON response or a static Pages HTML fallback.
   - Pages Functions `/api/health` is deployed with signed-session health and D1 binding active.
   - Pages Functions `/api/leads`, `/api/leads/export.csv`, `/api/leads/delivery-logs`, `/api/leads/retry-queue`, `/api/events`, `/api/stats/summary`, `/api/pages/:slug`, `/api/pages/:slug/revisions`, `/api/pages/:slug/revisions/:id`, `/api/pages/:slug/restore`, account/auth session routes, manager invite/member routes, ownership transfer routes, and internal admin ownership approval routes are deployed for the current hosted route slices. Live hosted route QA proves public lead/event writes, protected read endpoints, authenticated D1 lead/stats/CSV/delivery/retry reads, D1-backed page save/read/revision/restore behavior, D1-backed account behavior, invite create/read/accept behavior, ownership transfer request/list, and admin billing-clearance completion behavior.
   - Remaining work: run the guarded JSONL -> D1 write backfill only after operator approval and backup/export confirmation; hosted core route migration is now functionally covered through `ready=46`.
   - Project access/member writes are now mirrored into D1; remaining work is switching hosted reads to D1 as the primary source for every protected route, not only the current slice.
   - Use `npm run d1:backfill:dry-run` and `npm run d1:backfill:plan` before any production write. The write path must stay blocked unless `INLET_D1_BACKFILL_WRITE=1`, `INLET_D1_BACKFILL_APPROVAL=I_APPROVE_D1_BACKFILL_WRITE`, and `INLET_D1_BACKFILL_ROLLBACK_ACK=I_HAVE_D1_BACKUP_OR_EXPORT` are set.
   - Keep JSONL fallback only for local dev/import.

4. Inbox, stats, and large-data scale
   - Inbox first load must stay 50 rows and use `더보기`.
   - Inbox/CSV must stay month-bounded.
   - Add server-side indexes/queries for PV, CTA, form submit, reservation, conversion, page, source, device.
   - Add retention hooks and future quota hooks without enforcing paid plans yet.
   - Add more D1-specific smoke for stats/CSV/delivery logs.
   - Keep hosted QA data cleanup plan-only unless the operator explicitly approves deleting `hosted-route-qa-*` and `@inlet.test` rows from production D1.

5. Manager permissions and ownership UX polish
   - Keep manager permissions inside normal Settings.
   - Keep internal owner/operator controls behind `/admin`.
   - Disable/remove flow and server access revocation are done.
   - Activity/audit rows for invite created, invite accepted, permission changed, and removed are done.
   - User-facing transfer status copy for requested/waiting/approved/rejected/completed/canceled is done.
   - Production browser visual QA now verifies the compact manager card, ownership transfer entry, and disabled/removed manager rows through `?tab=settings` plus the `owner-settings` preset.
   - Remaining work: visual-polish pass on the expanded permission editor itself, including mobile/overflow checks and invite-link copy state.

6. Authenticated browser visual QA
   - Public route visual QA exists.
   - Scripted logged-in states now exist for manager-limited stats and owner settings/manager permissions.
   - Production browser QA now covers public desktop home, public mobile PC-guard, public about/contact/privacy/terms routes, owner edit cards, owner start modal, the 3 primary template first viewports, owner inbox, manager stats, owner settings manager permissions, owner settings manager permissions compact, internal admin ownership queue, and manager invite acceptance.
   - Production browser QA now prints per-case engine, viewport, screenshot count, and screenshot paths.
   - Remaining work: deeper editor interactions.
   - Screenshot artifact paths and failure reason output are available for every production browser QA case.

7. Live integrations
   - Mock/skipped-live checks pass.
   - Real SMTP, OAuth, conversion tracking, webhook retry/dead-letter, and live AI checks need credentials/public URL.
   - Missing credentials must remain `skipped-live`, not false failures.
   - Add operator-facing readiness screen or checklist status.

8. Public landing/template/editor polish
   - Keep 3 templates, but continue making each feel like a real service page.
   - Keep every template section editable via existing blocks.
   - Continue fixing live preview issues for text color/font/underline and premium effects.
   - HTML/import mode is later only if it maps to editable blocks or controlled embedded-code blocks.

9. Billing and subscription, final only
   - Do not implement checkout, card registration, renewal, invoices, or Toss Payments before the above is stable.
   - Keep only lightweight schema/state placeholders needed by ownership transfer approval.
   - Final plan ladder remains under 9,900 KRW: 3,300 / 6,600 / 9,900.

## Expanded Launch Backlog

Use this as the full production checklist. These items are not already done unless explicitly listed in the Already Done section.

1. Login, account, and member management
   - Replace remaining local-only auth UX with production account flows backed by the server store.
   - Server login, session refresh/logout, and email verification mock endpoints exist; D1 account storage is wired when D1 is active. Remaining work is provider-backed email delivery and full editable account settings UX.
   - Keep expanding session handling for client admins and managers as D1 membership data moves out of JSONL/access files.
   - Replace mock email verification delivery with transactional email; signup is already blocked server-side until email is verified.
   - Keep password rule: at least 6 chars and must include English letters plus numbers.
   - Password reset must work as "email verification completed -> set new password".
   - Enforce duplicate email and duplicate phone server-side, not only in local UI.
   - Expand the account profile/settings area for name, email, phone, password change, customer-owned AI API key status, and logout.
   - Add session expiry handling in the frontend: expired session should return to login with a clear message.
   - Add account deletion/suspension state model, but do not hard-delete operational records until retention policy exists.

2. Member roles and permissions
   - Keep manager permissions in normal Settings for every client/admin project, not in internal admin.
   - Permission labels must be user-facing Korean: `보기` and `편집`.
   - Menu permission itself should be compact/selectable, not a grid that shows every read/write toggle at once.
   - Manager invite should create and copy the invite link in one action after valid email/name input.
   - Invited manager must login/signup, then only load the invited project if the authenticated email matches the invite email. Login-mode invite acceptance already checks the account password server-side.
   - If invite email does not match login/signup email, show `초대받은 이메일을 확인해주세요.`
   - Manager disable/remove flow now revokes frontend and server access.
   - Manager activity/audit rows now cover invite created, invite accepted, permission changed, and removed.

3. Internal admin and operator control
   - Internal admin must be route-only, such as `/admin`, and must require internal master/operator login.
   - Public workspace navigation must not show internal admin controls.
   - Internal admin should manage users, projects, ownership transfer approvals, abuse reports, and system health.
   - Add search/filter by email, phone, project id, slug, and status.
   - Add operator audit log for all dangerous actions.
   - Add admin approval queue for ownership transfer.
   - Add manual account suspend/restore and project pause/archive tools.

4. Ownership transfer
   - In project Settings, ownership transfer should be a collapsed `소유권이전` section.
   - Transfer target must be selected from existing managers only.
   - Transfer request should go to internal admin approval before completion.
   - If a paid subscription exists later, transfer remains pending until the current billing period expires or subscription is canceled.
   - Real card/payment-method handoff is intentionally deferred to the final billing phase.
   - Add transfer states: requested, waiting_billing_clearance, approved, rejected, completed, canceled.
   - Add user-facing status copy for each state.
   - Add smoke/contract QA proving managers cannot self-transfer ownership without admin approval.

5. Customer-owned AI API keys
   - Since AI cost is customer-owned, server AI mode now supports per-request customer API keys.
   - Raw keys are still not stored in page JSON/localStorage unless the explicit development flag `VITE_INLET_ALLOW_CLIENT_AI_KEY_STORAGE=1` is enabled.
   - Encrypted per-account/per-project key storage exists through `/api/ai/key`, with masked status, save, and delete.
   - Remaining work: add explicit live key test result states for connected, invalid, quota/rate-limited, and missing, plus audit rows for save/delete/test.
   - Add UI copy explaining that AI usage is billed by the customer's own provider/API key.
   - Keep AI draft output editable and never insert non-editable template fragments.
   - Add per-project model selection and safe fallback when key is missing.

6. D1 storage route migration
   - Runtime selection exists, and the core routes below use D1 when `INLET_STORAGE_ADAPTER=d1|auto` has a valid `DB` binding.
   - `/api/leads` create/list/update/delete and month-bounded CSV export have started using D1 for basic lead operations when `INLET_STORAGE_ADAPTER=d1|auto` and binding exists.
   - Remaining lead route work: approved production backfill execution and real D1 Worker smoke coverage.
   - `/api/events` create/list and month-bounded `/api/stats/summary` now use D1 when active.
   - Month-bounded `/api/stats/summary` now uses D1 SQL aggregate queries for high-volume counts and no longer hydrates the full month for the core summary.
   - Remaining stats work: D1-specific smoke coverage with a real Worker binding and deeper SQL aggregates for future custom dimensions.
   - CSV export uses D1 for month-bounded lead exports when active.
   - Delivery logs/retry queue now have D1 read paths and log sync from lead upsert; remaining work is real Worker binding smoke and approved JSONL backfill execution.
   - Move remaining write-side project access, deeper audit/session metadata to D1.
   - Page metadata, revisions, and AI drafts now use D1 when active.
   - Keep JSONL fallback for local dev and import/backfill only.
   - JSONL -> D1 dry-run and guarded write-plan exist; remaining work is actual production execution after reviewing dry-run/plan output and confirming backup/export.

7. Inbox, stats, and retention
   - Inbox first load must stay limited to 50 and use `더보기` paging.
   - Inbox and CSV must stay month-bounded.
   - Keep monthly lead quota and stats retention hooks ready, but defer final plan enforcement to the final billing phase.
   - Add server-side indexes/queries for PV, CTA, form submit, reservation, conversion rate, page, source, device.
   - Add dedupe strategy for events and leads using D1 indexes.
   - Add admin retention job or scheduled cleanup plan.

8. Public landing, templates, and editor polish
   - Templates are now 3, but each must feel like a real service page, not a sample shell.
   - Keep all template content editable via existing blocks.
   - Add HTML/import mode later only if it maps to editable blocks or a controlled embedded-code block.
   - Continue fixing style controls where text color/font/underline do not reflect live preview immediately.
   - Keep premium effects subtle, randomized, and image-overlay aware.
   - Preserve cards block `1/2` columns only unless product direction changes.
   - Run real browser QA against invite acceptance, manager permission overflow/mobile states, deeper editor interactions, and legal footer pages.

9. Legal, email, and operational integrations
   - Legal pages exist, but content should become service-generic and configurable, not hard-coded example business copy.
   - Add transactional email provider: verification, invite, password reset, payment failure, transfer approval/rejection.
   - Keep SMTP/mock checks as skipped-live until credentials exist.
   - Add custom domain flow later: DNS instructions, verification, SSL status, route binding.
   - Add conversion tracking live verification for GTM, Meta, Google Ads, Naver, Kakao.
   - Add webhook delivery retry/dead-letter UI backed by D1.
   - Add real browser visual QA mandatory gate before production launch.

10. Plans, payment, and subscription, final phase
   - This is the last production patch group, after account, permissions, storage, stats, visual QA, templates, and live integration readiness.
   - Add plan model under the 9,900 KRW ceiling: free/trial, 3,300, 6,600, 9,900.
   - Feature limits must be enforced server-side: pages, monthly leads, stats retention, managers, custom domain, conversion tracking.
   - Add payment provider abstraction first, then Toss Payments implementation.
   - Add checkout, billing key/card registration, subscription renewal, cancel-at-period-end, payment failure, and grace-period state.
   - Add webhook signature verification and idempotency keys before accepting payment state changes.
   - Add payment history and invoice/receipt link storage.
   - Add admin manual override for billing state with audit log.
   - Keep payment provider secrets server-only.

## Worker 1: Auth Session, Accounts, Members, And Storage Scale

Goal:

- Move from local identity headers and JSONL full scans toward production-ready account/session, member management, and indexed storage.

Current state:

- Local API token plus project access enforcement exists.
- Server trusts local identity headers in dev/operator mode.
- Signed session strict mode exists for invite acceptance and smoke verification.
- Manager invite acceptance exists on `/invite/:token`.
- Register/password/login/session endpoints and offline email verification mock contracts exist, but hosted auth and real transactional email delivery are not complete.
- JSONL works but still scans files for duplicate lookup, stats, export, and repair.
- List/stat reads are routed through the JSONL query boundary, but the implementation is still a full-scan fallback.

Tasks:

- Signed server sessions are the current production source of truth.
- Hosted auth is explicitly not implemented yet and must remain blocked until a provider is integrated.
- Server should derive `ownerId` from signed/hosted auth in production mode, not from client-supplied `X-Inlet-Owner-Id`.
- Use `INLET_SESSION_AUTH_MODE=production` or `strict` for signed-session enforcement; dev headers are accepted only in `dev-headers` mode.
- Keep local identity headers only for dev/smoke mode.
- Keep smoke proving forged owner headers are ignored when session enforcement is enabled.
- Move persisted manager invitations from project `access.json` into the long-term account/auth store once that store exists.
- Keep master/client/manager login on signed sessions and server-side account lookup; next hardening is session persistence in D1 and account profile/logout UX.
- Implement email verification issue/confirm flow and block signup/invite acceptance until verified.
- Implement password reset as verified-email password change.
   - Duplicate email and duplicate phone are enforced through D1 account lookup when D1 is active.
- Add account profile endpoints and UI; session refresh/logout endpoints already exist.
   - Manager invitation/member rows are now synced into D1 when active; remaining work is switching project access reads from `access.json` to D1.
- Add ownership transfer request/approval state in D1 before UI completion.
- Do not add payment/subscription APIs in this worker; keep billing for the final phase unless a small placeholder is required by ownership transfer state.
- Add a DB/index implementation behind the existing JSONL adapter boundary.
- Use `migrations/0001_inlet_core.sql` as the first D1 migration and keep `d1:schema:qa` passing when changing account, ownership transfer, lead/event, or audit structures.
- Keep `d1:adapter:qa` passing when changing D1 lead/event/account runtime behavior.
- Keep `d1:adapter:qa` passing when changing D1 stats aggregation; it now covers aggregate counts and trend buckets.
- Use `npm run d1:backfill:dry-run` and `npm run d1:backfill:plan` before any real D1 write migration; write mode still requires explicit operator approval and rollback/backup acknowledgement.
- Keep JSONL as fallback.
- Use query plan `activeIndexFields`, `missingIndexFields`, `recommendedIndex`, `indexKey`, and `migrationPriority` to prioritize the first DB indexes.
- Keep expanding the adapter query contract when new lead/event/stat read paths are added.
- Do not reintroduce unpaged `listLeads`, `listEvents`, or ad hoc list filter helpers. Use `queryJsonlRecords` or the future DB/index adapter.
- Use the `perf:qa` full-scan report as the migration checklist when adding DB indexes.
- Keep CSV/export endpoints bounded by month while JSONL remains the fallback.
- Keep `mojibake:qa` passing when touching server/operator/account UI text.
- Keep manager invitation and read/write permission settings in Settings so every client admin can manage project staff. Keep AI start/reset and internal-only operator controls on `/admin`.
- Do not bypass `canWriteTab` in App mutations when adding new panels or actions.

Do not touch:

- Template data.
- CSS files.
- Browser screenshot scripts unless needed for auth smoke output.

Verification:

- `npm run auth:qa`
- `npm run d1:schema:qa`
- `npm run d1:adapter:qa`
- `npm run server:smoke:auth`
- `npm run server:smoke:leads`
- `npm run server:smoke:events`
- `npm run perf:qa`
- `npm run integration:qa`
- `npm run build`

## Worker 2: Real Browser QA And Frontend Product Polish

Goal:

- Make visual QA, frontend product polish, and build artifacts deployment-safe.

Current state:

- `browser:visual:qa` has fallback/static checks.
- Playwright/Puppeteer is not installed.
- Default `dist/assets` can keep Windows-locked stale files locally.
- `bundle:qa` budgets only current referenced assets and reports stale assets.
- Prune no longer causes long timeout.
- Strict artifact QA now also fails on leftover `inlet-deploy-artifact-*` folders.
- `npm run build` owns release artifact generation and pruning.
- `deployment:qa` validates the current `dist` artifact and fails if stale/unreferenced JS/CSS assets or budget overruns are present.

Tasks:

- Polish Settings manager permissions without moving them to internal admin.
- Replace implementation language with user-facing Korean labels: `보기`, `편집`, `소유권이전`.
- Keep manager permission editor compact: menu-level permission first, detailed mode only when expanded.
- Keep invite creation/copy one-step after valid manager email/name.
- Polish account/login/signup/reset UI once Worker 1 exposes production endpoints.
- Do not polish plan/usage/billing UI yet; it belongs to the final billing phase.
- Continue editor/style live-preview fixes for color/font/underline/background effects.
- Keep inbox compact row design: row number visible, date-only in list view, no useless phone/message/mail/copy action clutter.
- Keep CSV export clearly month-bound.
- Do not add Playwright/Puppeteer as a default dependency yet; keep it optional to avoid forcing browser downloads into offline/local installs.
- Use `INLET_BROWSER_QA_REQUIRE=1` in CI or release verification with Playwright/Puppeteer or local Chrome/Edge CDP.
- Use `INLET_BROWSER_QA_TEMPLATE_ROUTES=auto` or a comma-separated route list when screenshotting template/public routes.
- Run desktop and mobile screenshots for authenticated states before release.
- Detect blank page, app error boundary, severe overflow, and missing screenshot files.
- Support template routes for the 3 templates if routable.
- Keep `.tmp-browser-visual` cleanup covered by artifact QA.
- Keep `npm run build` followed by `deployment:qa` as the local deployment artifact gate.
- If the production deploy pipeline supports clean output swaps, add that outside the local Windows-locked `dist` flow.
- Document local Windows lock as a dev-machine issue, not production artifact policy.

Do not touch:

- Server auth/session/storage behavior except consuming stable APIs.
- Template content.
- Live integration credentials or provider logic.

Verification:

- `npm run browser:visual:qa`
- `npm run rendering:qa`
- `npm run worker3:qa`
- `npm run build`
- `npm run bundle:qa`
- `npm run deployment:qa`
- strict artifact QA

## Worker 3: Live Integration, Internal Admin, And Ops Verification

Goal:

- Turn offline mock confidence into real live verification, internal admin readiness, and operations documentation once credentials and public URLs exist.

Current state:

- Offline mock/skipped-live checks pass.
- Missing credentials correctly report `skipped-live`.

Live requirements:

- AI: `OPENAI_API_KEY`, `INLET_AI_QA_LIVE=1`, server AI mode.
- SMTP: `INLET_SMTP_HOST`, `INLET_SMTP_PORT`, `INLET_SMTP_USER`, `INLET_SMTP_PASS`, `INLET_SMTP_FROM`.
- OAuth: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, operator consent.
- Conversion: public landing URL and GTM/Meta/Google Ads/Naver/Kakao account access.
- Webhook: real CRM/test endpoint.

Tasks:

- Document production env groups: app, auth/session, D1, SMTP, AI key policy, OAuth, conversion, webhook. Payment envs are documented only in the final billing phase.
- Document customer-owned AI key policy and support boundaries.
- Document non-billing quota hooks only; final plan limits move with the billing phase.
- Document internal admin route and operator-only approval actions.
- Document deployment rollback and D1 migration/backfill procedure.
- Keep missing credentials as `skipped-live`, not failure.
- Keep `liveSummary` present when adding new providers or live checks.
- Run `npm run live:qa` before launch review to see which live checks are ready versus explicitly skipped.
- Verify one real lead delivery path end to end.
- Verify one real AI draft remains editable.
- Verify conversion snippets on a public landing route, not editor preview.
- Update ops docs with exact env vars, manual checks, and failure modes.

Do not touch:

- Server auth/session ownership.
- CSS/build artifact scripts.
- Template data.

Verification:

- `npm run ai:qa`
- `npm run conversion:qa`
- `npm run integration:mock:qa`
- `npm run server:smoke:integrations`
- `npm run ops:qa`
- `npm run integration:qa`
- `npm run live:qa`

## Final Integration

After any worker finishes, run:

- `npm run qa:all`
- `npm run auth:qa`
- `npm run runtime:qa`
- `npm run perf:qa`
- `npm run mojibake:qa`
- `npm run css:qa`
- `npm run bundle:qa`
- `npm run templates:qa`
- `npm run ai:qa`
- `npm run conversion:qa`
- `npm run worker3:qa`
- `npm run deployment:qa`
- `npm run integration:qa`
- `npm run build`
- strict artifact QA

