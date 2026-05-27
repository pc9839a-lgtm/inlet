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
  'ops:qa',
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
  'decodeD1Project',
  'getD1ProjectById',
  'getD1ProjectBySlug',
  'listD1ProjectMembers',
  'getD1ProjectAccess',
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
  'storageRuntimeHealth',
  'storageRuntimePlan',
  'INLET_STORAGE_ADAPTER',
  'INLET_STORAGE_MODE',
  'd1UnavailablePlan',
], 'D1 runtime adapter contract');

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
  'createStorageRuntime',
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
requireAll(aiDraftGenerator, [
  "postJson('/api/ai/draft', { model, input: normalizedInput, apiKey: apiKey || '' })",
  "postJson('/api/ai/test', { model, apiKey: apiKey || '' })",
], 'customer-owned AI key request contract');
requireAll(aiSettings, [
  'VITE_INLET_ALLOW_CLIENT_AI_KEY_STORAGE=1',
  "isClientAiKeyStorageEnabled() ? (settings.apiKey || '') : ''",
], 'customer-owned AI key storage contract');
requireAll(aiPanel, [
  '고객 API 키를 이번 세션에서만 사용합니다. 저장하지 않습니다.',
  '입력한 API 키는 저장하지 않고 이번 요청에만 서버로 전달합니다.',
], 'customer-owned AI key UI contract');

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
  'AI live generation',
  'SMTP live delivery',
  'Google OAuth consent',
  'Conversion public diagnostics',
  'Real browser visual QA',
], 'live readiness aggregate QA');

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

const packageSource = await read('package.json');
requireAll(packageSource, [
  'd1:backfill:dry-run',
], 'D1 backfill package script');

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
requireAll(browserVisualQa, [
  'INLET_BROWSER_QA_REQUIRE',
  'INLET_BROWSER_QA_EXTRA_URLS',
  'INLET_BROWSER_QA_TEMPLATE_ROUTES',
  'launchPlan',
  'local-chrome-cdp',
  'requires Playwright, Puppeteer, or local Chrome/Edge',
  '.error-screen, .app-error-screen, .block-render-fallback',
], 'browser visual QA enforcement contract');

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
  'Remaining Patches: 3 Workers',
  'Worker 1: Auth Session, Accounts, Members, And Storage Scale',
  'Worker 2: Real Browser QA And Frontend Product Polish',
  'Worker 3: Live Integration, Internal Admin, And Ops Verification',
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
  'Only two files should remain',
  'Worker 1',
  'Worker 2',
  'Worker 3',
], 'parallel README');

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
