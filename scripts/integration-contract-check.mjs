import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), 'utf8');
}

function requireAll(source, tokens, label) {
  for (const token of tokens) {
    assert(source.includes(token), `${label} missing ${token}`);
  }
}

const packageJson = JSON.parse(await read('package.json'));
const scripts = packageJson.scripts || {};

for (const name of [
  'ai:qa',
  'templates:qa',
  'auth:qa',
  'jsonl:qa',
  'd1:schema:qa',
  'd1:adapter:qa',
  'd1:runtime:qa',
  'd1:live:qa',
  'ops:qa',
  'api:container:qa',
  'api:security:qa',
  'stats:qa',
  'csv:qa',
  'perf:qa',
  'runtime:qa',
  'mojibake:qa',
  'integration:mock:qa',
  'rendering:qa',
  'browser:visual:qa',
  'accessibility:qa',
  'css:qa',
  'bundle:qa',
  'worker3:qa',
  'artifact:qa',
  'deployment:qa',
  'qa:all',
]) {
  assert(scripts[name], `package script missing ${name}`);
}

const server = await read('server/index.mjs');
requireAll(server, [
  '/api/jsonl/backups',
  '/api/jsonl/restore',
  '/api/jsonl/report',
  '/api/jsonl/repair',
  './storage/jsonlAdapter.mjs',
  'readJsonlRecords',
  'writeJsonlRecords',
  'appendJsonlRecord',
  '/api/leads/retry-queue',
  '/api/stats/summary',
  'authorizeProjectAccess',
  'X-Inlet-Owner-Id',
  'PROJECT_ACCESS_FORBIDDEN',
  'ownerIdForEmail',
  'clientOwnerIds',
  'managerOwnerIds',
  'managersFromPage',
  'managerAccessForIdentity',
  '/api/projects/invites',
  'createManagerInvite',
  'assertProjectAdmin',
  'acceptManagerInvite',
  '/api/projects/ownership-transfer',
  'adminTransferMatch',
  'createOwnershipTransferRequest',
  'listOwnershipTransferRequests',
  'updateOwnershipTransferRequest',
  'insertD1AuditLog',
  'upsertD1OwnershipTransferRequest',
  'listD1OwnershipTransferRequests',
  'syncD1ProjectAccess',
  'upsertD1Project',
  'replaceD1ProjectMembers',
  "reason: 'restore'",
  'createSessionToken',
  'loginUserAccount',
  'issueEmailVerification',
  'confirmEmailVerification',
  'hasConfirmedEmailVerification',
  'upsertD1Lead',
  'listD1Leads',
  'getD1Lead',
  'deleteD1Lead',
  'findD1DuplicateLead',
  'canUseD1LeadList',
  'listD1LeadsForExport',
  'd1LeadKindFilter',
  'd1LeadDeliveryStatusFilter',
  'listD1EventsForStats',
  'assertLeadVersion',
  'sanitizedLeadPatch',
  "tab: 'inbox'",
  "tab: 'stats'",
  "tab: 'edit'",
], 'server ops contract');

const authSmoke = await read('scripts/server-smoke-auth.mjs');
requireAll(authSmoke, [
  'client@example.test',
  'manager@example.test',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/auth/email-verification',
  '/api/auth/password',
  'duplicate account email expected 409',
  'duplicate account phone expected 409',
  'weak password register expected 400',
  'unverified signup expected 403',
  'email verification issue expected 200',
  'email verification confirm expected 200',
  'verified signup expected 200',
  'account login invalid password expected 401',
  'account login expected 200',
  'server-smoke-auth-session-refresh',
  'session refresh expected 200',
  'session logout expected 200',
  'invalid session refresh expected 401',
  'password change without email verification expected 403',
  'password change after email verification expected 200',
  'signup invite without phone expected 400',
  'server-smoke-manager-invite-session',
  'server-smoke-strict-session-missing-secret',
  'server-smoke-strict-invalid-session',
  'accepted manager should receive signed session',
  'manager invite login wrong password expected 401',
  'assertManagerServerAccessMatrix',
  'inbox write denied',
  'stats write denied',
  'invite create denied',
  'client admin manager invite expected 200',
  'client admin manager invite should include token',
  'client admin ownership transfer request expected 200',
  'ownership transfer request should stay requested before internal approval',
  'client ownership transfer approval expected 403',
  'owner ownership transfer approval expected 200',
  'ownership transfer approval should preserve billing wait state',
  'manager ownership transfer request expected 403',
  'strict mode without session secret should reject dev headers',
  'strict mode with invalid session should reject forged dev headers',
  'manager page write must not overwrite ownership metadata',
  'project access for transferred client expected 200',
  'client project id mismatch expected 403',
], 'server auth smoke project transfer contract');

const jsonlQa = await read('scripts/jsonl-ops-quality-check.mjs');
requireAll(jsonlQa, [
  '/api/jsonl/backups',
  '/api/jsonl/restore',
  '/api/jsonl/report',
  '/api/jsonl/repair',
  'confirm: true',
], 'jsonl QA');

const jsonlAdapter = await read('server/storage/jsonlAdapter.mjs');
requireAll(jsonlAdapter, [
  'export async function readJsonlRecords',
  'export async function queryJsonlRecords',
  'export async function appendJsonlRecord',
  'export async function writeJsonlRecords',
  'export function parseJsonlText',
  'export function jsonlFullScanPlan',
  'readCache',
  'cacheHit',
  'missingIndexFields',
], 'jsonl storage adapter');

const d1SchemaQa = await read('scripts/d1-schema-quality-check.mjs');
requireAll(d1SchemaQa, [
  'migrations/0001_inlet_core.sql',
  'server/storage/d1Adapter.mjs',
  'accounts',
  'subscriptions',
  'payments',
  'ownership_transfer_requests',
  'audit_logs',
], 'D1 schema QA contract');

const d1Adapter = await read('server/storage/d1Adapter.mjs');
requireAll(d1Adapter, [
  'D1_SCHEMA_TABLES',
  'D1_INDEX_PRIORITIES',
  'd1UnavailablePlan',
  'assertD1Binding',
  'listD1Leads',
  'getD1Lead',
  'deleteD1Lead',
  'deliveryStatus',
  'listD1Events',
  'encodeD1Lead',
  'decodeD1Lead',
  'upsertD1Lead',
  'encodeD1Page',
  'decodeD1Page',
  'upsertD1Page',
  'getD1PageBySlug',
  'insertD1PageRevision',
  'listD1PageRevisions',
  'getD1PageRevision',
  'encodeD1Project',
  'decodeD1Project',
  'upsertD1Project',
  'getD1ProjectById',
  'getD1ProjectBySlug',
  'listD1ProjectMembers',
  'getD1ProjectAccess',
  'replaceD1ProjectMembers',
  'encodeD1AiDraft',
  'decodeD1AiDraft',
  'upsertD1AiDraft',
  'listD1AiDrafts',
  'deleteD1AiDraft',
  'encodeD1Event',
  'decodeD1Event',
  'insertD1Event',
  'encodeD1OwnershipTransferRequest',
  'decodeD1OwnershipTransferRequest',
  'upsertD1OwnershipTransferRequest',
  'listD1OwnershipTransferRequests',
  'insertD1AuditLog',
  'fallbackAdapter',
], 'D1 adapter contract');

const d1RuntimeAdapter = await read('server/storage/runtimeAdapter.mjs');
requireAll(d1RuntimeAdapter, [
  'normalizeStorageMode',
  'detectD1Binding',
  'createStorageRuntime',
  'storageRuntimeCoverage',
  'storageRuntimeHealth',
  'storageRuntimePlan',
  'D1_RUNTIME_ROUTE_COVERAGE',
  'INLET_STORAGE_ADAPTER',
  'INLET_STORAGE_MODE',
  'd1UnavailablePlan',
], 'D1 runtime adapter contract');

const d1RuntimeQa = await read('scripts/d1-runtime-coverage-check.mjs');
requireAll(d1RuntimeQa, [
  'D1_RUNTIME_ROUTE_COVERAGE',
  'storageRuntimeCoverage',
  'accounts',
  'leads',
  'eventsStats',
  'invitesMembers',
  'ownershipTransfer',
  'aiKeys',
  'AI key vault should use D1',
], 'D1 runtime coverage QA contract');

const d1AdapterQa = await read('scripts/d1-adapter-quality-check.mjs');
requireAll(d1AdapterQa, [
  'fakeD1',
  'upsertD1Lead',
  'getD1Lead',
  'deleteD1Lead',
  'upsertD1Page',
  'getD1PageBySlug',
  'listD1PageRevisions',
  'upsertD1AiDraft',
  'listD1AiDrafts',
  'deleteD1AiDraft',
  'listD1Leads',
  'insertD1Event',
  'listD1Events',
  'listD1OwnershipTransferRequests',
  'upsertD1Project',
  'replaceD1ProjectMembers',
  'createStorageRuntime',
  'storageRuntimeCoverage',
  'storageRuntimePlan',
], 'D1 adapter QA contract');

const d1Migration = await read('migrations/0001_inlet_core.sql');
requireAll(d1Migration, [
  'CREATE TABLE IF NOT EXISTS accounts',
  'CREATE TABLE IF NOT EXISTS projects',
  'CREATE TABLE IF NOT EXISTS project_members',
  'CREATE TABLE IF NOT EXISTS leads',
  'CREATE TABLE IF NOT EXISTS events',
  'CREATE TABLE IF NOT EXISTS subscriptions',
  'CREATE TABLE IF NOT EXISTS payments',
  'CREATE TABLE IF NOT EXISTS ownership_transfer_requests',
  'CREATE TABLE IF NOT EXISTS audit_logs',
  'idx_leads_project_month',
  'idx_events_project_month_type',
], 'D1 core migration contract');

const integrationSmoke = await read('scripts/server-smoke-integrations.mjs');
requireAll(integrationSmoke, [
  '/api/leads/retry-queue',
  '/api/leads/retry-failed',
  'delivery logs queryPlan missing',
  'retry queue queryPlan missing',
  'index migration plan missing',
  'retryable',
  'idempotency',
], 'integration smoke');

const mockIntegrationQa = await read('scripts/mock-integration-quality-check.mjs');
requireAll(mockIntegrationQa, [
  'SMTP',
  'OAuth',
  'skipped-live',
  'liveRequirements',
  'deadLetter',
  'idempotencyKey',
  'non-retryable',
  'revoked',
  'timeout',
  'retry',
  'liveSummary',
], 'mock integration QA');

const aiQa = await read('scripts/ai-quality-check.mjs');
requireAll(aiQa, [
  'liveFailureKinds',
  'skipped-live',
  'server-unreachable',
  'missing-key',
  'request-failed',
  'bad-model-response',
  'liveSummary',
], 'AI live QA status contract');

const aiDraftGenerator = await read('src/ai/aiDraftGenerator.js');
const aiSettings = await read('src/ai/aiSettings.js');
const aiPanel = await read('src/ai/AiPanel.jsx');
const aiKeyRepository = await read('src/lib/aiKeyRepository.js');
requireAll(aiDraftGenerator, [
  "postJson('/api/ai/draft', { model, input: normalizedInput, apiKey: apiKey || '', project: request.project }, request.options)",
  "postJson('/api/ai/test', { model, apiKey: apiKey || '', project: request.project }, request.options)",
], 'customer-owned AI key request contract');
requireAll(aiSettings, [
  'VITE_INLET_ALLOW_CLIENT_AI_KEY_STORAGE=1',
  "isClientAiKeyStorageEnabled() ? (settings.apiKey || '') : ''",
], 'customer-owned AI key storage contract');
requireAll(aiPanel, [
  'saveServerAiKey(key, page, authUser)',
  'deleteServerAiKey(page, authUser)',
  'serverAiKeyLabel(serverKeyStatus)',
], 'customer-owned AI key UI contract');
requireAll(aiKeyRepository, [
  "apiFetch(`/api/ai/key?",
  "postJson('/api/ai/key'",
  'serverAiKeyLabel',
], 'frontend server AI key repository contract');

const serverIndex = await read('server/index.mjs');
requireAll(serverIndex, [
  "url.pathname === '/api/ai/key'",
  'encryptAiSecret(apiKey)',
  "maskedKey: record.last4 ? `sk-...${record.last4}` : ''",
], 'server customer-owned AI key storage contract');

const app = await read('src/App.jsx');
requireAll(app, [
  "const AdminPanel = lazy(() => import('./panels/AdminPanel.jsx'))",
  "const InviteAcceptScreen = lazy(() => import('./screens/InviteAcceptScreen.jsx'))",
  'function WayziFooter()',
  'WAYZI_STATIC_PAGES',
  'WayziStaticPage',
  "'/about'",
  "'/contact'",
  "'/privacy'",
  "'/terms'",
  'WAYZI',
  '538-42-01450',
  '개인정보처리방침',
  'adminRoute',
  "return /^\\/(?:admin|[^/?#]+\\/admin)\\/?$/.test(location.pathname)",
  '<AdminPanel',
  'const canWriteTabKey = (key) => canWriteTab(accessMode, page, authUser, key)',
  'blockWrite',
  'inviteToken',
  'acceptInviteAuth',
], 'builder admin panel contract');

const authContext = await read('src/lib/authContext.js');
requireAll(authContext, [
  "export const CLIENT_ADMIN_TABS = ['inbox', 'stats', 'settings']",
  "export const BUILDER_TABS = ['edit', 'style', 'inbox', 'stats', 'settings']",
  'MANAGER_PERMISSION_TABS',
  'DEFAULT_MANAGER_ACCESS',
  'managerForAuthUser',
  'export function canWriteTab',
  'export function canReadTab',
], 'admin tab access contract');

const settingsPanel = await read('src/panels/SettingsPanel.jsx');
requireAll(settingsPanel, [
  'normalizeOwnershipSettings',
  'MANAGER_PERMISSION_TABS',
  'createServerManagerInvite',
  'managerInviteUrl',
  'manager-access-card',
  'manager-permission-grid',
  'copyInvite',
  '복사 중',
  'canManageProjectUsers',
], 'SettingsPanel manager permission contract');
assert(!settingsPanel.includes('AiPanel') && !settingsPanel.includes('START_MODE_KEY'), 'SettingsPanel must not contain internal-only AI/start controls');

const adminPanel = await read('src/panels/AdminPanel.jsx');
requireAll(adminPanel, [
  '내부 관리자',
  'START_MODE_KEY',
  '<AiPanel page={page}',
  '프로젝트 ID',
], 'AdminPanel private route controls contract');
assert(!adminPanel.includes('manager-access-card') && !adminPanel.includes('createServerManagerInvite'), 'AdminPanel must not own client manager permission settings');
const adminPanelCss = await read('src/panels/AdminPanel.css');
assert(!adminPanelCss.includes('manager-'), 'AdminPanel CSS must not keep manager permission styles');

const managerInvites = await read('src/lib/managerInvites.js');
requireAll(managerInvites, [
  '/api/projects/invites',
  'fetchServerManagerInvite',
  'acceptServerManagerInvite',
  'projectAuthHeaders',
  'projectContext',
  'managerInviteUrl',
], 'manager invite client contract');

const inviteAcceptScreen = await read('src/screens/InviteAcceptScreen.jsx');
requireAll(inviteAcceptScreen, [
  'fetchServerManagerInvite',
  'acceptServerManagerInvite',
  'normalizeAccountPhone',
  '이메일 인증',
  '핸드폰번호',
  'onAccepted',
  'InviteAcceptScreen',
], 'manager invite accept screen contract');

const authAccounts = await read('src/lib/authAccounts.js');
requireAll(authAccounts, [
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/logout',
  '/api/auth/email-verification',
  '/api/auth/email-verification/confirm',
  '/api/auth/password',
  'AUTH_EMAIL_DUPLICATE',
  'AUTH_PHONE_DUPLICATE',
  'AUTH_PASSWORD_POLICY',
  'AUTH_LOGIN_INVALID',
  'AUTH_SESSION_INVALID',
  'EMAIL_VERIFICATION_REQUIRED',
  'refreshAuthSession',
  'logoutAuthAccount',
  'normalizeAccountPhone',
  'isValidAccountPassword',
], 'auth account duplicate contract');

const apiClient = await read('src/lib/apiClient.js');
requireAll(apiClient, [
  'X-Inlet-Session',
], 'session header client contract');

const projectContextLib = await read('src/lib/projectContext.js');
requireAll(projectContextLib, [
  'session: authUser?.session',
], 'project context session contract');
assert(!/import\s+(?:\{[^}]*Editor[^}]*\}|[A-Z][A-Za-z]+Editor)\s+from\s+['"]\.\/editor\/blockEditors\//.test(app), 'block editors must stay out of App static imports');

const blockEditor = await read('src/editor/BlockEditor.jsx');
requireAll(blockEditor, [
  'data-lazy-editor-fallback="true"',
  'data-lazy-editor-error="true"',
  'class LazyEditorErrorBoundary',
  'componentDidUpdate(prevProps)',
], 'lazy block editor contract');

const bundleQa = await read('scripts/bundle-quality-check.mjs');
requireAll(bundleQa, [
  'initialJsNames',
  'landing templates must not be referenced as an initial JS asset',
  'block editor chunks must not be referenced as initial JS assets',
], 'bundle lazy asset contract');

const statsPanel = await read('src/panels/StatsPanel.jsx');
requireAll(statsPanel, [
  'eventPageMeta',
  'leadPageMeta',
  'statsPartial',
  'stats-partial-notice',
], 'stats panel contract');

const eventRepository = await read('src/lib/eventRepository.js');
const leadRepository = await read('src/lib/leadRepository.js');
requireAll(eventRepository, ['withMeta', "source: 'server'", 'dateFrom', 'dateTo'], 'event repository');
requireAll(leadRepository, ['fetchAllServerLeads', 'withMeta', "source: 'server'", 'dateFrom', 'dateTo', 'deliveryStatus'], 'lead repository');

const formBlocks = await read('src/preview/renderers/FormBlocks.jsx');
requireAll(formBlocks, [
  "type: 'form_start'",
  "type: 'reservation_submit_attempt'",
  "type: 'reservation_submit_success'",
], 'funnel renderers');

const leadCsv = await read('src/lib/leadCsv.js');
requireAll(leadCsv, [
  'filterLeadsForCsv',
  'deliveryStatus',
  'downloadLeadsCsv',
], 'CSV export contract');

const conversionQa = await read('scripts/conversion-quality-check.mjs');
requireAll(conversionQa, [
  'liveChecks',
  'liveSummary',
  'summarizeStatuses',
], 'conversion live QA summary contract');

const liveQa = await read('scripts/live-readiness-check.mjs');
requireAll(liveQa, [
  'liveSummary',
  'Hosted API health',
  'hostedApiHealthCheck',
  'failed-live',
  '/api/health',
  'AI live generation',
  'SMTP live delivery',
  'Google OAuth consent',
  'Conversion public diagnostics',
  'Real browser visual QA',
], 'live readiness aggregate QA');

const apiContainerQa = await read('scripts/api-container-quality-check.mjs');
const pagesFunctionsQa = await read('scripts/pages-functions-quality-check.mjs');
requireAll(apiContainerQa, [
  'Dockerfile.api',
  'HEALTHCHECK',
  '/api/health',
  'INLET_STORAGE_ADAPTER=d1',
], 'API container QA contract');
requireAll(pagesFunctionsQa, [
  'functions/api/health.js',
  'pages-functions',
  'inlet-api',
  'sourceOfTruth',
  'signed-session',
  "storageActive === 'd1'",
], 'Pages Functions API health QA contract');

const apiSecurityQa = await read('scripts/api-security-quality-check.mjs');
requireAll(apiSecurityQa, [
  'INLET_ALLOWED_ORIGINS',
  'Access-Control-Max-Age',
  'setCors(req, res)',
], 'API security QA contract');

const perfQa = await read('scripts/offline-performance-check.mjs');
requireAll(perfQa, [
  'fixtureLeads',
  'fixtureEvents',
  '10000',
  'const INBOX_PAGE_SIZE = 50',
  'fullScanEndpoints',
  "fallback: 'jsonl'",
  'nextIndexFields',
  'activeIndexFields',
  'recommendedIndex',
  'indexKey',
  'migrationPriority',
], 'offline performance QA');

const d1BackfillDryRun = await read('scripts/d1-backfill-dry-run.mjs');
requireAll(d1BackfillDryRun, [
  'dryRun: true',
  'duplicateMonthlyContacts',
  'duplicateMonthlyEventDedupeKeys',
  'deliveryLogs',
  'skippedInvalidLines',
  'future D1 write backfill with explicit confirmation only',
], 'D1 backfill dry-run contract');

const d1BackfillPlan = await read('scripts/d1-backfill-write-plan.mjs');
requireAll(d1BackfillPlan, [
  'INLET_D1_BACKFILL_WRITE',
  'I_APPROVE_D1_BACKFILL_WRITE',
  'I_HAVE_D1_BACKUP_OR_EXPORT',
  'preflightExistingIds',
  'INSERT OR IGNORE INTO leads',
  'INSERT OR IGNORE INTO events',
  'Rollback must only be used',
], 'D1 backfill write plan contract');

const packageSource = await read('package.json');
requireAll(packageSource, [
  'd1:backfill:dry-run',
  'd1:backfill:plan',
  'd1:hosted-qa:cleanup',
  'd1:live:qa',
], 'D1 backfill package script');

const d1HostedQaCleanup = await read('scripts/d1-hosted-qa-cleanup.mjs');
requireAll(d1HostedQaCleanup, [
  'INLET_D1_QA_CLEANUP_WRITE',
  'I_APPROVE_HOSTED_QA_CLEANUP',
  'hosted-route-qa-',
  'inlet.test',
  'DELETE FROM delivery_logs',
  'DELETE FROM page_revisions',
  'DELETE FROM accounts',
  'plan-only',
], 'D1 hosted QA cleanup contract');

const hostedRouteQa = await read('scripts/hosted-api-routes-quality-check.mjs');
requireAll(hostedRouteQa, [
  'normalizeCheckOutput',
  'detail: failureReason',
  'failureReason',
  'INLET_HOSTED_ROUTE_QA_WRITE',
  'Hosted /api/leads authenticated D1 list',
], 'hosted route QA output contract');

const d1LiveQa = await read('scripts/d1-live-quality-check.mjs');
requireAll(d1LiveQa, [
  'INLET_D1_LIVE_QA',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  'skipped-live',
  'failed-live',
  'SELECT name FROM sqlite_master',
  'audit_logs',
], 'D1 live QA contract');

const liveReadiness = await read('scripts/live-readiness-check.mjs');
requireAll(liveReadiness, [
  'Hosted QA D1 cleanup plan',
  'hostedQaCleanupReadiness',
  'INLET_D1_QA_CLEANUP_WRITE',
  'I_APPROVE_HOSTED_QA_CLEANUP',
  'hosted-route-qa-',
  'inlet.test',
  'd1:hosted-qa:cleanup',
], 'live readiness hosted QA cleanup contract');

requireAll(server, [
  'queryJsonlRecords',
  'normalizeSessionAuthMode',
  "INLET_SESSION_AUTH_MODE || 'dev-headers'",
  'sessionAuthSourceForMode',
  'sourceOfTruth',
  'hostedAuthImplemented',
  "nextAdapter: 'db-index'",
  'recommendedIndex',
  'activeIndexFields',
  'indexKey',
  'migrationPriority',
  'storageMigrationPriority',
  "type: 'csv-leads'",
  "type: 'delivery-logs'",
  "type: 'delivery-retry-queue'",
  "type: 'stats-events'",
  "type: 'stats-leads'",
  'aggregateD1Stats',
  'getD1AccountByEmail',
  'getD1AccountByPhone',
  'upsertD1Account',
  'upsertD1Invite',
  'upsertD1ProjectMember',
  'findD1LeadsByContact',
  'listD1DeliveryLogs',
  'listD1DeliveryRetryQueue',
  'rowHydration: false',
  'matchesLeadFilters',
], 'server indexed storage boundary contract');
assert(!server.includes('async function listLeads(') && !server.includes('async function listEvents(') && !server.includes('function filterLeadList('), 'server must not keep legacy unpaged lead/event list helpers');

const worker3Qa = await read('scripts/worker3-quality-check.mjs');
requireAll(worker3Qa, [
  'browser:visual:qa',
  'accessibility:qa',
  'bundle:qa',
  'live:qa',
  'artifact-quality-check.mjs',
  '--strict',
], 'worker3 aggregate QA');

const qaAll = await read('scripts/qa-all.mjs');
requireAll(qaAll, [
  'templates:qa',
  'server:smoke:auth',
  'server:smoke:integrations',
  'build',
  'deployment:qa',
  'worker3:qa',
  'integration:qa',
  'cleanGeneratedArtifacts',
  'dist-check-',
  '.tmp-',
], 'full QA aggregate contract');

const artifactQa = await read('scripts/artifact-quality-check.mjs');
requireAll(artifactQa, [
  'process.argv.slice(2)',
  "args.includes('--no-strict')",
  'INLET_ARTIFACT_QA_STRICT',
], 'strict artifact QA contract');

const browserVisualQa = await read('scripts/browser-visual-quality-check.mjs');
const productionBrowserQa = await read('scripts/production-browser-quality-check.mjs');
const hostedApiQa = await read('scripts/hosted-api-quality-check.mjs');
const cssQa = await read('scripts/css-quality-check.mjs');
requireAll(browserVisualQa, [
  'INLET_BROWSER_QA_REQUIRE',
  'INLET_BROWSER_QA_EXTRA_URLS',
  'INLET_BROWSER_QA_TEMPLATE_ROUTES',
  'INLET_BROWSER_QA_STATE_PRESET',
  'INLET_BROWSER_QA_CLICK_SELECTOR',
  'INLET_BROWSER_QA_CLICK_TEXT',
  'INLET_BROWSER_QA_EXPECT_TEXT',
  'INLET_BROWSER_QA_FORBID_TEXT',
  'INLET_BROWSER_QA_VIEWPORTS',
  'owner-settings',
  'client-settings',
  'manager-limited',
  'launchPlan',
  'local-chrome-cdp',
  'requires Playwright, Puppeteer, or local Chrome/Edge',
  '.error-screen, .app-error-screen, .block-render-fallback',
], 'browser visual QA enforcement contract');
requireAll(productionBrowserQa, [
  'INLET_PRODUCTION_QA_URL',
  'INLET_PRODUCTION_BROWSER_QA_REQUIRE',
  'INLET_BROWSER_QA_REQUIRE',
  'manager-limited',
  'owner-settings',
  'INLET_BROWSER_QA_FORBID_TEXT',
  'browser-visual-quality-check.mjs',
], 'production browser QA contract');
requireAll(hostedApiQa, [
  'normalizeCheckOutput',
  'INLET_PUBLIC_API_URL',
  'INLET_HOSTED_API_QA_REQUIRE',
  'INLET_HOSTED_API_EXPECT_D1',
  'static-pages-html-fallback',
  'sourceOfTruth',
  'signed-session',
  "storageActive === 'd1'",
], 'hosted API runtime QA contract');
requireAll(cssQa, [
  'INLET_QA_COMPACT',
  'CF_PAGES',
  'largestFiles',
  'fileCount',
], 'CSS QA compact output contract');

const opsQa = await read('scripts/ops-readiness-check.mjs');
requireAll(opsQa, [
  'docs/ops-storage-migration-policy.md',
  'docs/ops-pii-retention-export-policy.md',
  'docs/ops-operator-readiness-checklist.md',
  'docs/ops-live-integration-matrix.md',
  'docs/ops-deployment-cache-seo-checklist.md',
  'integration:mock:qa',
  'Live Credential Gate',
  'Live Phase Acceptance',
  'server-unreachable',
  'bad-model-response',
], 'ops QA');

const remainingPatches = await read('docs/parallel-patch/remaining-patches.md');
requireAll(remainingPatches, [
  'Remaining Patches',
  'Current execution mode: parallel patching is active',
  'Parallel Worker Split',
  'Production account/session hardening',
  'Customer-owned AI key storage',
  'D1 real runtime smoke and write-side migration',
  'Worker 1: account, auth, email verification, sessions, member data',
  'Worker 2: lead intake, duplicate policy, inbox, stats, D1 scale, CSV',
  'Worker 3: personal-rehabilitation, mobile-wedding-invitation, and real-estate-presale templates',
  'Worker 4: Settings manager permissions, ownership transfer, page duplication URL flow',
  'Worker 5: QA, deployment, live integration readiness, docs and ops',
  'Add lead duplicate and spam policy',
  'Page duplication and URL setup',
  'Expanded Launch Backlog',
  'Login, account, and member management',
  'Plans, payment, and subscription, final phase',
  'deployment:qa',
  'Do not reassign these',
  'npm run live:qa',
], 'remaining patch docs');

const parallelReadme = await read('docs/parallel-patch/README.md');
requireAll(parallelReadme, [
  'remaining-patches.md',
  'worker-1-auth-members.md',
  'worker-2-leads-stats-d1.md',
  'worker-3-templates-editor.md',
  'worker-4-manager-ownership.md',
  'worker-5-qa-ops-live.md',
  'Primary mode: parallel patching is active',
  'Five workers can run at the same time only if they respect file ownership',
  'High-conflict files',
], 'parallel README');

const workerDocs = await Promise.all([
  read('docs/parallel-patch/worker-1-auth-members.md'),
  read('docs/parallel-patch/worker-2-leads-stats-d1.md'),
  read('docs/parallel-patch/worker-3-templates-editor.md'),
  read('docs/parallel-patch/worker-4-manager-ownership.md'),
  read('docs/parallel-patch/worker-5-qa-ops-live.md'),
]);
requireAll(workerDocs.join('\n'), [
  'Duplicate email and duplicate phone must be server-side checks',
  'Phone/email is the primary duplicate key',
  'Cookie/client id prevents accidental repeated submission',
  'IP is only a short-window spam/rate-limit signal',
  'Do not write instructional copy',
  'Only these three templates are active',
  'Page duplication',
  'URL setup',
  'Template duplication is not needed',
  'Missing live credentials must be `skipped-live`, not false failures',
], 'parallel worker docs');

console.log(JSON.stringify({
  ok: true,
  checks: 37,
  scripts: 20,
  contracts: [
    'jsonl-ops',
    'd1-schema',
    'delivery-retry-observability',
    'stats-source-pagination',
    'funnel-events',
    'csv-export-filtering',
    'offline-performance-fixtures',
    'monthly-inbox-csv-contract',
    'lazy-template-bundle-contract',
    'lazy-editor-runtime-contract',
    'initial-lazy-asset-contract',
    'worker3-aggregate-qa',
    'worker4-ops-docs',
    'mock-integration-proof',
    'ai-live-status-contract',
    'remaining-patches-doc',
    'owner-admin-mode',
    'server-project-access',
    'deployment-artifact-qa',
    'strict-artifact-qa',
    'full-qa-aggregate',
    'jsonl-storage-adapter',
    'd1-storage-adapter',
    'd1-runtime-adapter',
    'mandatory-browser-visual-qa',
  ],
}, null, 2));
