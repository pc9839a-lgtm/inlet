# Remaining Patches: 3 Workers

Updated: 2026-05-27

This is the only active patch assignment file. All completed worker handoff files and old backlog/history files were removed from this folder to prevent duplicate work.

## Current Recheck Snapshot

Last checked on 2026-05-27:

- Passing: `npm run css:qa`, `npm run runtime:qa`, `npm run templates:qa`, `npm run bundle:qa`, `npm run deployment:qa`, `npm run integration:qa`.
- CSS source total: `388804/500000`.
- Main referenced JS: `313614/430000`.
- Largest lazy preview CSS: `188791` bytes.
- Templates: `3` templates, `189` structural checks.
- Full offline QA: `npm run qa:all` passes `30` steps.
- Strict artifact QA: passes with no leftover `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, or `preview.zip` artifacts.
- Current UI note: Cards block is intentionally limited to `1/2` columns. Keep that scope unless the product direction changes.

## Already Done

Do not reassign these unless a regression is found:

- Client admin UI gating: client mode sees Inbox, Stats, and Settings; Settings includes manager invite/read-write permission controls.
- Internal admin route separation: the public workspace navigation no longer exposes an Admin tab; logged-in master-only controls live on `/admin` or `/{pageSlug}/admin`.
- Master/manager permission groundwork: managers are stored under `ownership.managers`, tabs are read-gated, and writes are blocked unless the manager has write permission for that tab.
- Server manager permission enforcement: `access.json` stores manager owner ids and tab read/write access, and protected server routes check tab scope before read/write.
- Manager invite/session API: server can create manager invite tokens, read invite metadata, accept invites, promote accepted users to managers, and return a signed session when `INLET_SESSION_SECRET` is configured.
- Settings manager invite UI: masters and transferred client admins can issue and copy manager invite links from the Settings permission card.
- Public manager invite acceptance: `/invite/:token` lets invited managers confirm email/name, stores the returned session, and opens the assigned project.
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
- Full QA aggregate: `npm run qa:all` runs 30 verification steps and cleans generated `dist-check-*`, `.tmp-*`, `inlet-deploy-artifact-*`, and `preview.zip` artifacts before strict artifact gates.
- Mojibake QA: `mojibake:qa` scans runtime source/server text, and it is included in Worker 3 QA plus integration readiness.
- Mock integrations: AI/SMTP/webhook/OAuth/conversion skipped-live and mock checks pass.
- AI, mock integration, and conversion QA now include `liveSummary` counts so pass/fail/skipped-live status is visible without reading every row.
- Browser visual QA keeps Playwright/Puppeteer optional by default and supports mandatory mode with `INLET_BROWSER_QA_REQUIRE=1`.
- Browser visual QA skipped output now includes POSIX and PowerShell mandatory real-browser commands to run when a local URL/browser dependency is available.
- `INLET_SESSION_AUTH_MODE=production` now aliases to strict signed-session auth and rejects forged dev identity headers.
- `/api/health` now exposes `auth.sourceOfTruth`; production/strict reports `signed-session`, while hosted mode remains blocked as `hosted-auth-unimplemented` until a real provider is integrated.
- JSONL query plans now expose active/missing index fields plus the recommended DB/index adapter target.
- JSONL query plans now also expose `indexKey` and `migrationPriority`, so stats/events/month and delivery retry paths can be indexed first.
- `npm run live:qa` summarizes AI, SMTP, OAuth, conversion, and real-browser live readiness in one skipped-live/ready report.
- D1 production database `inlet-prod` exists on Cloudflare, is bound as `DB` in `wrangler.jsonc`, and has `migrations/0001_inlet_core.sql` applied.
- D1 production schema groundwork exists in `migrations/0001_inlet_core.sql` for accounts, projects, members, invites, pages, revisions, leads, events, delivery logs, AI drafts, subscriptions, payments, ownership transfer requests, and audit logs.
- D1 adapter groundwork exists in `server/storage/d1Adapter.mjs`; it now includes lead/event row encoding, decoding, paged list helpers, idempotent lead upsert, and event insert helpers.
- D1 runtime selection groundwork exists in `server/storage/runtimeAdapter.mjs`; `INLET_STORAGE_ADAPTER=jsonl|d1|auto` is recognized and `/api/health` reports the requested/active storage mode. Runtime routes still use JSONL until the D1 route migration is completed.
- D1 adapter behavior QA exists in `scripts/d1-adapter-quality-check.mjs` and verifies lead/event encode/decode, lead upsert, event dedupe insert, paged lists, and storage runtime fallback/ready plans.

## 3 Parallel Workers

Run these three workers in parallel. They must not share write ownership.

| Worker | Patch | Files |
| --- | --- | --- |
| Worker 1 | Auth/session/account/member/billing/storage | `server/index.mjs`, `server/storage/**`, account/payment scripts, auth QA |
| Worker 2 | Browser visual QA + frontend product polish | browser/rendering QA, editor/settings/inbox UI, build/clean/prune scripts |
| Worker 3 | Live integrations + internal admin/ops docs | AI key handling, SMTP/OAuth/conversion/webhook QA, admin/ops docs |

## Immediate Remaining Functional Patches

These are not already-done items. Patch in this order unless a worker is blocked:

1. Real browser visual QA
   - Static rendering QA passes, but this still does not prove the actual localhost screen is visually correct.
   - Run mandatory real-browser mode once Playwright/Puppeteer or the in-app browser path is available.
   - Cover start modal, editor, cards block `1/2` column behavior, template first viewport, inbox, settings, and public landing footer/legal pages.

2. Settings and manager permissions UX
   - Manager permission structure exists, but the Settings UI still needs product-level polish.
   - Keep manager permissions inside Settings for every client admin.
   - Keep internal owner/admin/operator controls behind `/admin`.
   - Keep read/write labels user-facing as `보기/편집`, not implementation language.

3. Auth and account lifecycle
   - Signed sessions exist, but hosted signup/login/email verification is not fully implemented.
   - Master signup/login, manager invite acceptance after login/signup, email mismatch handling, duplicate email/phone checks, and password reset-by-email-verification remain production features.
   - Phone self-verification is explicitly out of scope for now.

4. Ownership transfer
   - Ownership transfer should select an existing manager, request admin approval, and stay pending until payment/subscription state allows transfer.
   - Real payment handoff is not implemented yet; model the states and UI clearly before wiring a provider.

5. Storage and large-data scale
   - JSONL adapter boundary exists, but implementation is still a fallback full scan.
   - Add DB/index implementation behind the adapter, starting from the D1 schema and adapter groundwork.
   - Keep inbox and CSV month-bounded.
   - Keep stats server-aggregated and indexed before large production data.

6. Live integrations
   - Mock/skipped-live checks pass.
   - Real AI, SMTP, OAuth, conversion tracking, and webhook end-to-end checks require keys, public URL, and live server.
   - Missing credentials must remain `skipped-live`, not a false failure.

## Expanded Launch Backlog

Use this as the full production checklist. These items are not already done unless explicitly listed in the Already Done section.

1. Login, account, and member management
   - Replace local-only auth UX with production account flows backed by the server store.
   - Implement real login session issue/refresh/logout for masters, client admins, and managers.
   - Add email verification request/confirm flow; signup must stay blocked until email is verified.
   - Keep password rule: at least 6 chars and must include English letters plus numbers.
   - Password reset must work as "email verification completed -> set new password".
   - Enforce duplicate email and duplicate phone server-side, not only in local UI.
   - Add account profile/settings for name, email, phone, password change, customer-owned AI API key status, and logout.
   - Add session expiry handling in the frontend: expired session should return to login with a clear message.
   - Add account deletion/suspension state model, but do not hard-delete operational records until retention policy exists.

2. Member roles and permissions
   - Keep manager permissions in normal Settings for every client/admin project, not in internal admin.
   - Permission labels must be user-facing Korean: `보기` and `편집`.
   - Menu permission itself should be compact/selectable, not a grid that shows every read/write toggle at once.
   - Manager invite should create and copy the invite link in one action after valid email/name input.
   - Invited manager must login/signup, then only load the invited project if the authenticated email matches the invite email.
   - If invite email does not match login/signup email, show `초대받은 이메일을 확인해주세요.`
   - Add manager disable/remove flow and ensure removed managers lose server access immediately.
   - Add manager activity/audit rows for invite created, invite accepted, permission changed, and removed.

3. Internal admin and operator control
   - Internal admin must be route-only, such as `/admin`, and must require internal master/operator login.
   - Public workspace navigation must not show internal admin controls.
   - Internal admin should manage users, projects, billing states, ownership transfer approvals, abuse reports, and system health.
   - Add search/filter by email, phone, project id, slug, plan, status, and payment status.
   - Add operator audit log for all dangerous actions.
   - Add admin approval queue for ownership transfer.
   - Add manual account suspend/restore and project pause/archive tools.

4. Ownership transfer and billing handoff
   - In project Settings, ownership transfer should be a collapsed `소유권이전` section.
   - Transfer target must be selected from existing managers only.
   - Transfer request should go to internal admin approval before completion.
   - If a paid subscription exists, transfer remains pending until the current billing period expires or subscription is canceled.
   - After transfer completes, new owner must be able to attach their own card/payment method.
   - Add transfer states: requested, waiting_billing_clearance, approved, rejected, completed, canceled.
   - Add user-facing status copy for each state.
   - Add smoke/contract QA proving managers cannot self-transfer ownership without admin approval.

5. Plans, payment, and subscription
   - Add plan model under the 9,900 KRW ceiling: free/trial, 3,300, 6,600, 9,900.
   - Feature limits must be enforced server-side: pages, monthly leads, stats retention, managers, custom domain, conversion tracking.
   - Add payment provider abstraction first, then Toss Payments implementation.
   - Add checkout, billing key/card registration, subscription renewal, cancel-at-period-end, payment failure, and grace-period state.
   - Add webhook signature verification and idempotency keys before accepting payment state changes.
   - Add payment history and invoice/receipt link storage.
   - Add admin manual override for billing state with audit log.
   - Keep payment provider secrets server-only.

6. Customer-owned AI API keys
   - Since AI cost is customer-owned, add per-account or per-project API key storage.
   - Encrypt or seal API keys at rest; do not store raw keys in page JSON/localStorage.
   - Add key test endpoint and clear status: connected, invalid, quota/rate-limited, missing.
   - Add UI copy explaining that AI usage is billed by the customer's own provider/API key.
   - Keep AI draft output editable and never insert non-editable template fragments.
   - Add per-project model selection and safe fallback when key is missing.

7. D1 storage route migration
   - Runtime selection exists, but routes still operate on JSONL fallback.
   - Move `/api/leads` create/list/update/delete to D1 when `INLET_STORAGE_ADAPTER=d1|auto` and binding exists.
   - Move `/api/events` create/list/dedupe to D1.
   - Move `/api/stats/summary` to D1 server aggregation; do not fetch all events/leads into memory.
   - Move CSV export to D1 month-bounded queries.
   - Move delivery logs/retry queue to D1.
   - Move accounts, sessions, manager invites, page metadata, revisions, AI drafts, subscriptions, payments, transfer requests, and audit logs to D1.
   - Keep JSONL fallback for local dev and import/backfill only.
   - Add JSONL -> D1 import script with dry-run, counts, duplicate handling, and rollback note.

8. Inbox, stats, and retention
   - Inbox first load must stay limited to 50 and use "더보기" paging.
   - Inbox and CSV must stay month-bounded.
   - Add monthly lead quota enforcement per plan.
   - Add stats retention by plan: free short retention, paid longer retention.
   - Add server-side indexes/queries for PV, CTA, form submit, reservation, conversion rate, page, source, device.
   - Add dedupe strategy for events and leads using D1 indexes.
   - Add admin retention job or scheduled cleanup plan.

9. Public landing, templates, and editor polish
   - Templates are now 3, but each must feel like a real service page, not a sample shell.
   - Keep all template content editable via existing blocks.
   - Add HTML/import mode later only if it maps to editable blocks or a controlled embedded-code block.
   - Continue fixing style controls where text color/font/underline do not reflect live preview immediately.
   - Keep premium effects subtle, randomized, and image-overlay aware.
   - Preserve cards block `1/2` columns only unless product direction changes.
   - Run real browser QA against start modal, editor, template first viewport, inbox, settings, and legal footer pages.

10. Legal, email, and operational integrations
   - Legal pages exist, but content should become service-generic and configurable, not hard-coded example business copy.
   - Add transactional email provider: verification, invite, password reset, payment failure, transfer approval/rejection.
   - Keep SMTP/mock checks as skipped-live until credentials exist.
   - Add custom domain flow later: DNS instructions, verification, SSL status, route binding.
   - Add conversion tracking live verification for GTM, Meta, Google Ads, Naver, Kakao.
   - Add webhook delivery retry/dead-letter UI backed by D1.
   - Add real browser visual QA mandatory gate before production launch.

## Worker 1: Auth Session, Accounts, Billing, And Storage Scale

Goal:

- Move from local identity headers and JSONL full scans toward production-ready account/session, member management, billing state, and indexed storage.

Current state:

- Local API token plus project access enforcement exists.
- Server trusts local identity headers in dev/operator mode.
- Signed session strict mode exists for invite acceptance and smoke verification.
- Manager invite acceptance exists on `/invite/:token`.
- Register/password endpoints exist as smoke-level account groundwork, but they are not complete hosted login/email-verification membership flows.
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
- Implement master/client/manager login with signed sessions and server-side account lookup.
- Implement email verification issue/confirm flow and block signup/invite acceptance until verified.
- Implement password reset as verified-email password change.
- Enforce duplicate email and duplicate phone in D1.
- Add account profile/session/logout endpoints.
- Move persisted manager invitations from project `access.json` into D1 `invites` and `project_members`.
- Add ownership transfer request/approval state in D1 before UI completion.
- Add payment/subscription state APIs before real Toss provider wiring.
- Add a DB/index implementation behind the existing JSONL adapter boundary.
- Use `migrations/0001_inlet_core.sql` as the first D1 migration and keep `d1:schema:qa` passing when changing account, billing, ownership transfer, lead/event, or audit structures.
- Keep `d1:adapter:qa` passing when changing D1 lead/event/account runtime behavior.
- Add migration/backfill scripts from JSONL to D1 with dry-run.
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
- Polish plan/usage/billing state UI once Worker 1 exposes subscription state.
- Continue editor/style live-preview fixes for color/font/underline/background effects.
- Keep inbox compact row design: row number visible, date-only in list view, no useless phone/message/mail/copy action clutter.
- Keep CSV export clearly month-bound.
- Do not add Playwright/Puppeteer as a default dependency yet; keep it optional to avoid forcing browser downloads into offline/local installs.
- Use `INLET_BROWSER_QA_REQUIRE=1` in CI or release verification when Playwright/Puppeteer is installed.
- Use `INLET_BROWSER_QA_TEMPLATE_ROUTES=auto` or a comma-separated route list when screenshotting template/public routes.
- If a browser dependency is added, run desktop and mobile screenshots.
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

- Document production env groups: app, auth/session, D1, payments, SMTP, AI key policy, OAuth, conversion, webhook.
- Document customer-owned AI key policy and support boundaries.
- Document plan limits and what happens at quota.
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
