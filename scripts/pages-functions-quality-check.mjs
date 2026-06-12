import { readFile } from 'node:fs/promises';
import { sendSesEmail } from '../functions/api/_ses.js';
import {
  buildLeadDeliveryJobs,
  failedDeliveryProviders,
  mergeDeliveryReports,
  normalizeDeliveryPage,
  sendLeadDelivery,
} from '../functions/api/leads/_delivery.js';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await readFile('functions/api/health.js', 'utf8');
const shared = await readFile('functions/api/_shared.js', 'utf8');
const leads = await readFile('functions/api/leads.js', 'utf8');
const leadDelivery = await readFile('functions/api/leads/_delivery.js', 'utf8');
const leadCsv = await readFile('functions/api/leads/export.csv.js', 'utf8');
const blockedHistory = await readFile('functions/api/leads/blocked-history.js', 'utf8');
const deliveryLogs = await readFile('functions/api/leads/delivery-logs.js', 'utf8');
const retryQueue = await readFile('functions/api/leads/retry-queue.js', 'utf8');
const leadDeliver = await readFile('functions/api/leads/[id]/deliver.js', 'utf8');
const integrationsTest = await readFile('functions/api/integrations/test.js', 'utf8');
const googleSheetsOauth = await readFile('functions/api/integrations/google/sheets/_oauth.js', 'utf8');
const googleSheetsOauthUrl = await readFile('functions/api/integrations/google/sheets/oauth-url.js', 'utf8');
const googleSheetsCallback = await readFile('functions/api/integrations/google/sheets/callback.js', 'utf8');
const googleSheetsStatus = await readFile('functions/api/integrations/google/sheets/status.js', 'utf8');
const googleSheetsDisconnect = await readFile('functions/api/integrations/google/sheets/disconnect.js', 'utf8');
const events = await readFile('functions/api/events.js', 'utf8');
const statsSummary = await readFile('functions/api/stats/summary.js', 'utf8');
const pages = await readFile('functions/api/pages/[slug].js', 'utf8');
const pageRevisions = await readFile('functions/api/pages/[slug]/revisions.js', 'utf8');
const pageRevision = await readFile('functions/api/pages/[slug]/revisions/[id].js', 'utf8');
const pageRestore = await readFile('functions/api/pages/[slug]/restore.js', 'utf8');
const filesShared = await readFile('functions/api/files/_files.js', 'utf8');
const filesUpload = await readFile('functions/api/files/upload.js', 'utf8');
const filesDownload = await readFile('functions/api/files/download.js', 'utf8');
const authShared = await readFile('functions/api/auth/_auth.js', 'utf8');
const authRegister = await readFile('functions/api/auth/register.js', 'utf8');
const authLogin = await readFile('functions/api/auth/login.js', 'utf8');
const authSession = await readFile('functions/api/auth/session.js', 'utf8');
const authLogout = await readFile('functions/api/auth/logout.js', 'utf8');
const authAccount = await readFile('functions/api/auth/account.js', 'utf8');
const authAccountStatus = await readFile('functions/api/auth/account/status.js', 'utf8');
const authPassword = await readFile('functions/api/auth/password.js', 'utf8');
const authEmailVerification = await readFile('functions/api/auth/email-verification.js', 'utf8');
const authEmailVerificationConfirm = await readFile('functions/api/auth/email-verification/confirm.js', 'utf8');
const invitesShared = await readFile('functions/api/projects/_invites.js', 'utf8');
const invitesCreate = await readFile('functions/api/projects/invites.js', 'utf8');
const inviteRead = await readFile('functions/api/projects/invites/[token].js', 'utf8');
const inviteAccept = await readFile('functions/api/projects/invites/[token]/accept.js', 'utf8');
const ownershipShared = await readFile('functions/api/projects/_ownership.js', 'utf8');
const ownershipProject = await readFile('functions/api/projects/ownership-transfer.js', 'utf8');
const ownershipAdmin = await readFile('functions/api/admin/ownership-transfer/[id].js', 'utf8');
const adminSummary = await readFile('functions/api/admin/summary.js', 'utf8');
const aiShared = await readFile('functions/api/ai/_ai.js', 'utf8');
const aiKey = await readFile('functions/api/ai/key.js', 'utf8');
const aiTest = await readFile('functions/api/ai/test.js', 'utf8');
const aiDraft = await readFile('functions/api/ai/draft.js', 'utf8');
const aiDrafts = await readFile('functions/api/ai/drafts.js', 'utf8');
const aiDraftDelete = await readFile('functions/api/ai/drafts/[id].js', 'utf8');
const wrangler = await readFile('wrangler.jsonc', 'utf8');
const hostedQa = await readFile('scripts/hosted-api-quality-check.mjs', 'utf8');

assert(
  shared.includes('UNIQUE constraint failed: pages\\.id')
    && shared.includes('UNIQUE constraint failed: pages\\.project_id, pages\\.slug')
    && shared.includes('이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.')
    && shared.includes('현재 계정에 이 페이지 접근 권한이 없습니다.')
    && shared.includes('요청 처리 실패'),
  'Functions shared API errors should map D1 page unique constraint failures to operator-readable Korean messages',
);
assert(!/[�]|諛|獄|揆|濡쒓렇|沅뚰븳|\?꾩|\?섏|\?붿|\?대\?/.test(shared), 'Functions shared API errors must not contain mojibake text');
assert(
  shared.includes('cleanUserFacingApiError')
    && shared.includes('이미 사용 중인 페이지 주소입니다. 다른 주소를 입력해주세요.')
    && shared.includes('현재 계정에 이 페이지 저장 권한이 없습니다.')
    && shared.includes('이미 가입된 이메일입니다.')
    && shared.includes('인증 코드가 올바르지 않습니다.')
    && shared.includes('메일 전송에 실패했습니다. 잠시 후 다시 시도해주세요.'),
  'Functions shared API errors should route user-facing failures through readable Korean messages',
);
const hostedRoutesQa = await readFile('scripts/hosted-api-routes-quality-check.mjs', 'utf8');

const storedDeliveryPage = normalizeDeliveryPage(
  {
    title: 'Public payload',
    slug: 'public-page',
    integrations: {
      email: { enabled: false, to: '', consult: true, reservation: true },
      webhook: { enabled: false, url: '' },
      conversion: { enabled: true, dataLayer: true },
    },
  },
  {
    title: 'Stored page',
    slug: 'public-page',
    integrations: {
      email: { enabled: true, to: 'pc9839a@naver.com', consult: true, reservation: true },
      webhook: { enabled: false, url: '' },
      conversion: { enabled: true, dataLayer: false },
    },
  },
  { slug: 'public-page' },
);
assert(pages.includes('function enforceFreeEmailAlertRecipient') && pages.includes('lockedToAccount: true') && pages.includes('identity?.email'), 'hosted page saves must enforce free plan email alert recipient from the signed account');
assert(pages.includes('async function fallbackFreeEmailAlertRecipient') && pages.includes('SELECT email FROM accounts WHERE id = ? LIMIT 1') && pages.includes('getD1ProjectById'), 'hosted page saves must fallback to project owner email when the session email is unavailable');
assert(storedDeliveryPage.integrations.email.enabled === true, 'public lead payload must not disable stored email alerts');
assert(storedDeliveryPage.integrations.email.to === 'pc9839a@naver.com', 'stored email alert recipient should remain authoritative');
assert(storedDeliveryPage.integrations.conversion.dataLayer === true, 'public conversion settings can still merge from payload');
assert(buildLeadDeliveryJobs(storedDeliveryPage, { id: 'lead-public-submit', type: 'consult' }).some((job) => job.type === 'email'), 'stored email settings should create a public submit delivery job');
assert(buildLeadDeliveryJobs({
  ...storedDeliveryPage,
  integrations: {
    ...storedDeliveryPage.integrations,
    email: { enabled: true, to: 'pc9839a@naver.com', consult: false, reservation: true },
  },
}, { id: 'lead-public-unknown-submit', type: '' }).some((job) => job.type === 'email'), 'unknown/custom public submit types should not silently skip enabled email alerts');
const externalDeliveryJobs = buildLeadDeliveryJobs({
  title: 'External payload',
  slug: 'external-payload',
  integrations: {
    webhook: { enabled: true, url: 'https://example.test/webhook', service: 'custom' },
    automation: { enabled: true, url: 'https://example.test/make', service: 'make' },
    sheets: { enabled: true, provider: 'google_sheets', mode: 'webhook', webhookUrl: 'https://example.test/sheets', spreadsheetId: 'sheet-pages', sheetName: 'Leads', connectedEmail: 'owner@example.test', status: 'connected' },
  },
}, {
  id: 'lead-external-payload',
  type: 'consult',
  name: 'Payload QA',
  phone: '010-0000-0000',
  email: 'qa@example.test',
  createdAt: '2026-06-01T00:00:00.000Z',
  values: { name: 'Payload QA', phone: '010-0000-0000', '관심타입': '84A' },
  answers: [
    { id: 'name', label: '이름', type: 'name', value: 'Payload QA' },
    { id: 'phone', label: '연락처', type: 'phone', value: '010-0000-0000' },
    { id: 'budget', label: '예산대', type: 'select', value: '5억-7억' },
  ],
});
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'webhook' && job.payload?.schemaVersion === 'pagero.lead.v1'), 'Pages delivery should prepare webhook payload schema');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'automation' && job.payload?.service === 'make'), 'Pages delivery should prepare Make/Zapier payload');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'google_sheets' && job.payload?.sheetName === 'Leads'), 'Pages delivery should prepare Google Sheets payload');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'google_sheets' && job.payload?.provider === 'google_sheets' && job.payload?.mode === 'webhook'), 'Pages delivery should prepare Google Sheets provider/mode');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'google_sheets' && job.payload?.spreadsheetId === 'sheet-pages' && job.payload?.connectedEmail === 'owner@example.test' && job.payload?.integration?.status === 'connected'), 'Pages delivery should keep Google Sheets OAuth-ready metadata');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'google_sheets' && job.payload?.lead?.fields && job.payload?.page?.slug === 'external-payload' && job.payload?.project && job.payload?.source), 'Pages delivery should prepare Google Sheets structured payload');
assert(externalDeliveryJobs.some((job) => job.payload?.target === 'google_sheets' && job.payload?.lead?.fields?.['관심타입'] === '84A' && job.payload?.lead?.fields?.['예산대'] === '5억-7억' && !job.payload?.lead?.fields?.['이름']), 'Pages delivery should keep custom form fields as sheet columns without duplicating base fields');
assert(googleSheetsOauth.includes("input.sheetName || '접수함'") && googleSheetsOauth.includes("String(sheetName || '접수함').trim() || '접수함'"), 'Google Sheets OAuth should create and append to the Korean default sheet tab');
assert(googleSheetsCallback.includes("const sheetName = '접수함'") && googleSheetsCallback.includes('Pagero 접수함'), 'Google Sheets OAuth callback should create Korean-named sheets by default');
assert(googleSheetsStatus.includes("settings.sheetName || '접수함'") && leadDelivery.includes("sheetName: integrations.sheets.sheetName || '접수함'"), 'Google Sheets status and delivery should keep Korean sheet defaults');

const missingKeyDelivery = await sendLeadDelivery({ id: 'lead-mail-missing-key', type: 'consult' }, storedDeliveryPage, {});
assert(missingKeyDelivery.status === 'failed', 'missing SES key should create failed delivery status');
assert(String(missingKeyDelivery.summary || '').includes('알림 전송 실패'), 'failed delivery should keep Korean summary');
assert(missingKeyDelivery.logs?.[0]?.provider === 'ses', 'failed email delivery should keep SES provider log');
assert(String(missingKeyDelivery.logs?.[0]?.message || '') === '메일 발송 설정을 확인해주세요.', 'failed email delivery should keep user-safe Korean message');
assert(!/AWS|SES|quota|sandbox|access key|secret/i.test(String(missingKeyDelivery.logs?.[0]?.message || '')), 'failed email delivery UI message must not expose provider/internal terms');

const partialDelivery = {
  status: 'partial',
  logs: [
    { provider: 'google_sheets', status: 'success', message: 'sent' },
    { provider: 'ses', status: 'failed', message: 'failed' },
  ],
};
assert(failedDeliveryProviders(partialDelivery).join(',') === 'ses', 'partial retry should target only failed providers');
const mergedDelivery = mergeDeliveryReports(partialDelivery, {
  status: 'success',
  logs: [{ provider: 'ses', status: 'success', message: 'resent' }],
});
assert(mergedDelivery.status === 'success' && mergedDelivery.logs.length === 2, 'partial retry should preserve existing successes and replace failed providers');

async function expectSesError(label, setup, expectedCode) {
  const originalFetch = globalThis.fetch;
  try {
    if (setup.fetch) globalThis.fetch = setup.fetch;
    await sendSesEmail({
      to: setup.to || 'receiver@example.test',
      subject: 'SES QA',
      text: 'SES QA',
    }, {
      AWS_SES_ACCESS_KEY_ID: setup.accessKeyId ?? 'AKIA_TEST',
      AWS_SES_SECRET_ACCESS_KEY: setup.secretAccessKey ?? 'secret',
      AWS_SES_REGION: 'ap-northeast-2',
      INLET_LEAD_EMAIL_FROM: setup.from || '페이지로 <support@pagero.kr>',
    });
    throw new Error(`${label} should fail`);
  } catch (error) {
    assert(error.code === expectedCode, `${label} expected ${expectedCode}, got ${error.code || error.message}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

await expectSesError('SES missing key', { accessKeyId: '', secretAccessKey: '' }, 'EMAIL_SEND_KEY_MISSING');
await expectSesError('SES invalid recipient', { to: 'bad-email' }, 'EMAIL_TO_INVALID');
await expectSesError('SES sandbox rejected', {
  fetch: async () => new Response(JSON.stringify({ message: 'Email address is not verified because account is in the sandbox' }), { status: 400 }),
}, 'EMAIL_SEND_SANDBOX_REJECTED');
await expectSesError('SES unverified recipient', {
  fetch: async () => new Response(JSON.stringify({ message: 'Email address is not verified. The following identities failed the check: receiver@example.test' }), { status: 400 }),
}, 'EMAIL_RECIPIENT_NOT_VERIFIED');
await expectSesError('SES domain not verified', {
  fetch: async () => new Response(JSON.stringify({ message: 'FromEmailAddress identity is not verified' }), { status: 400 }),
}, 'EMAIL_DOMAIN_NOT_VERIFIED');
await expectSesError('SES quota exceeded', {
  fetch: async () => new Response(JSON.stringify({ message: 'Maximum sending rate exceeded' }), { status: 429 }),
}, 'EMAIL_SEND_QUOTA_EXCEEDED');

for (const token of [
  'export async function onRequest',
  'createStorageRuntime',
  'storageRuntimeCoverage',
  "service: 'pagero-api'",
  "mode: 'pages-functions'",
  "sourceOfTruth: 'signed-session'",
  "INLET_STORAGE_ADAPTER: env.INLET_STORAGE_ADAPTER || 'd1'",
  'INLET_SESSION_SECRET',
  'Access-Control-Allow-Origin',
  'Access key ID',
  'Secret access key',
  'INLET_LEAD_EMAIL_FROM',
  "authEmailModeInput === 'api' || authEmailModeInput === 'ses'",
]) {
  assert(health.includes(token), `Pages health function missing ${token}`);
}

for (const token of [
  'sessionIdentity',
  'sessionSecret',
  'crypto.subtle.importKey',
  'X-Inlet-Session',
  'X-Inlet-Api-Token',
  'publicWrite',
  'getD1ProjectAccess',
  'canUseProjectAccess',
  'sameOwnerIdentity',
  'identityOwnerAliases',
  'masterOnly',
  'CLIENT_ADMIN_TABS',
  'MANAGER_TABS',
  'ensureD1ProjectShell',
  'publicProjectShell',
  'INSERT OR IGNORE INTO projects',
  'isClaimableProjectShell',
  'local-user',
  'ownerId.startsWith(\'ws_\')',
  'pendingClaim',
  '현재 계정에 이 페이지 접근 권한이 없습니다.',
]) {
  assert(shared.includes(token), `Pages shared API helper missing ${token}`);
}

for (const [name, source, tokens] of [
  ['leads', leads, ['upsertD1Lead', 'listD1Leads', 'listD1DeliveryLogs', 'skipSuccessfulIdempotencyKeys', 'findD1LeadsByIntakeSignals', 'insertD1BlockedLeadSubmission', 'publicWrite: true', 'publicProjectShell(project)', "tab: 'inbox'", "url.searchParams.get('dateFrom')", "url.searchParams.get('dateTo')", "url.searchParams.get('channel')", 'getD1PageBySlug', 'getD1LatestPageByProject', 'getD1PublicPageBySlug', 'publicLeadPageContext', 'body.project = project', 'storedPage = await getD1LatestPageByProject', 'normalizeDeliveryPage(inputPage, storedPage || {}, project)', 'const delivery = await sendSavedLeadDelivery', 'deliveryStatus: delivery.status', 'delivery: saved.delivery || delivery', 'LEAD_RATE_LIMITED', 'PUBLIC_POST_HEADERS', "'Access-Control-Allow-Origin': '*'", 'handlePublicPostError', 'trafficAttributionFromSourceUrl', 'utm_source', 'meta: { source:', '중복 접수 정책', '접수는 저장됐지만 알림 전송에 실패했습니다.']],
  ['lead csv', leadCsv, ['listD1Leads', 'month is required for CSV export.', 'text/csv; charset=utf-8', "Content-Disposition", 'csvCell', "tab: 'inbox'", 'parseCsvIds', "url.searchParams.get('ids')", "url.searchParams.get('dateFrom')", "url.searchParams.get('dateTo')", "url.searchParams.get('channel')", "'Referrer'", "'\\uC720\\uC785 \\uCC44\\uB110'", 'source.sourceUrl || source.url || source.pageUrl', 'source.utm_source', "return cleanFieldLabel(label) || '\\uC785\\uB825\\uAC12'", "'\\uC774\\uB984'", 'uniqueHeader', 'BASE_DYNAMIC_VALUE_KEYS.has(label)', 'visibleStart']],
  ['blocked history', blockedHistory, ['listD1BlockedLeadSubmissions', 'pageSlug', "source: 'd1'", "tab: 'inbox'"]],
  ['delivery logs', deliveryLogs, ['listD1DeliveryLogs', "type: 'delivery-logs'", "adapter: 'd1'", "tab: 'inbox'"]],
  ['retry queue', retryQueue, ['listD1DeliveryRetryQueue', "type: 'delivery-retry-queue'", 'deadLetter', "tab: 'inbox'"]],
  ['lead deliver', leadDeliver, ['getD1Lead', 'getD1LatestPageByProject', 'upsertD1Lead', 'publicWrite: true', 'NO_DELIVERY_SETTINGS_MESSAGE', 'failedDeliveryProviders', 'mergeDeliveryReports', '접수를 찾을 수 없습니다.']],
  ['integrations test', integrationsTest, ['type !== \'sheets\'', 'isGoogleAppsScriptUrl', 'text/plain;charset=utf-8', 'Google Apps Script', 'pagero.lead.v1', "event: 'lead.test'", "service: 'pagero'", "target: 'google_sheets'", "provider: 'google_sheets'", "mode: 'webhook'", "sheetName: body.sheetName", "utmSource: 'connection_test'"]],
  ['google sheets oauth shared', googleSheetsOauth, ['project_integrations', 'saveGoogleSheetsIntegration', 'getGoogleSheetsIntegration', 'deleteGoogleSheetsIntegration', 'refreshGoogleAccessToken', 'appendGoogleSheetRow', 'appendGoogleSheetPayload', 'ensureGoogleSheetHeaders', 'googleSheetsPayloadTable']],
  ['google sheets oauth url', googleSheetsOauthUrl, ['googleSheetsAuthUrl', 'signedOAuthState', 'authorizeProject', "write: true", "tab: 'inbox'"]],
  ['google sheets callback', googleSheetsCallback, ['verifyOAuthState', 'exchangeGoogleOAuthCode', 'createGoogleSpreadsheet', 'saveGoogleSheetsIntegration', 'pagero:google-sheets-connected']],
  ['google sheets status', googleSheetsStatus, ['getGoogleSheetsIntegration', 'authorizeProject', "tab: 'inbox'"]],
  ['google sheets disconnect', googleSheetsDisconnect, ['deleteGoogleSheetsIntegration', 'authorizeProject', "write: true", "tab: 'inbox'"]],
  ['events', events, ['insertD1Event', 'listD1Events', 'publicWrite: true', 'publicProjectShell(project)', "tab: 'stats'", 'eventType', 'meta: { source:']],
  ['stats summary', statsSummary, ['aggregateD1Stats', "source: 'server'", "adapter: 'd1'", "tab: 'stats'"]],
  ['pages', pages, ['getD1PageBySlug', 'upsertD1Page', 'ensureD1ProjectShell', 'authorizeProject', 'PUBLIC_PAGE_CACHE_CONTROL', 'no-store', 'pages.revision DESC', 'PAGE_SLUG_CONFLICT', 'expectedUpdatedAt', 'PAGE_REVISION_CONFLICT', 'canRecoverPageSaveProject', 'accountOwnedProjectForSave']],
  ['page revisions', pageRevisions, ['listD1PageRevisions', "tab: 'edit'", 'revisions']],
  ['page revision', pageRevision, ['getD1PageRevision', "tab: 'edit'", 'revision.page']],
  ['page restore', pageRestore, ['getD1PageRevision', 'upsertD1Page', 'restore:', "tab: 'edit'"]],
  ['files shared', filesShared, ['FILES_BUCKET', 'MAX_FILE_BYTES = 20 * 1024 * 1024', 'DEFAULT_PROJECT_MAX_BYTES = 100 * 1024 * 1024', 'DEFAULT_PROJECT_MAX_FILES = 20', "['pdf', 'ppt', 'pptx', 'xls', 'xlsx']", 'safeObjectKey', 'validateObjectKey', 'assertProjectFileQuota']],
  ['files upload', filesUpload, ['request.formData()', 'authorizeProject(request, env, project, { write: true', 'fileBucket(env)', 'assertAllowedFile(file)', 'assertProjectFileQuota(bucket, project', 'bucket.put', 'publicDownloadUrl']],
  ['files download', filesDownload, ['bucket.get(key)', 'Content-Disposition', "filename*=UTF-8''", 'Cache-Control', 'validateObjectKey']],
  ['auth shared', authShared, ['getD1AccountByEmail', 'getD1AccountByPhone', 'upsertD1Account', 'createSessionToken', 'verifySessionToken', 'issueEmailVerificationToken', 'AUTH_EMAIL_DUPLICATE', "mode === 'api' || mode === 'ses'"]],
  ['auth register', authRegister, ['registerAccount', 'createSessionToken', 'session', 'AUTH_METHODS']],
  ['auth login', authLogin, ['loginAccount', 'ok: true', 'AUTH_METHODS']],
  ['auth session', authSession, ['getSessionAccount', 'expiresInSeconds', 'createSessionToken']],
  ['auth logout', authLogout, ['stateless-session', 'loggedOut']],
  ['auth account', authAccount, ['getSessionAccount', 'getD1AccountByPhone', 'AUTH_PHONE_DUPLICATE']],
  ['auth account status', authAccountStatus, ['normalizeAccountStatus', 'AUTH_ACCOUNT_STATUS_INVALID', 'session:']],
  ['auth password', authPassword, ['confirmEmailVerificationToken', 'password-reset', 'EMAIL_VERIFICATION_REQUIRED', 'AUTH_PASSWORD_POLICY']],
  ['auth email verification', authEmailVerification, ['issueEmailVerificationToken', 'verification']],
  ['auth email verification confirm', authEmailVerificationConfirm, ['confirmEmailVerificationToken', 'verification']],
  ['invites shared', invitesShared, ['upsertD1Invite', 'getD1InviteByToken', 'upsertD1ProjectMember', 'acceptD1ManagerInvite']],
  ['invites create', invitesCreate, ['createD1ManagerInvite', "tab: 'settings'", 'masterOnly: true', 'invite']],
  ['invite read', inviteRead, ['getD1PublicInvite', 'params.token']],
  ['invite accept', inviteAccept, ['acceptD1ManagerInvite', 'params.token']],
  ['ownership shared', ownershipShared, ['upsertD1OwnershipTransferRequest', 'listD1OwnershipTransferRequests', 'completeD1OwnershipTransfer', 'OWNERSHIP_TRANSFER_BILLING_NOT_CLEAR']],
  ['ownership project', ownershipProject, ['createD1OwnershipTransferRequest', 'listD1OwnershipTransfers', "tab: 'settings'", 'masterOnly']],
  ['ownership admin', ownershipAdmin, ['updateD1OwnershipTransferRequest', 'params.id', 'masterOnly: true']],
  ['admin summary', adminSummary, ['buildD1MasterSummary', 'assertPlatformMaster', 'accounts', 'projects', 'leads', 'events', 'payments', 'subscriptions', 'lead_blocked_submissions', 'fileUsageFromPageJson', 'listR2FileUsage', 'projectDownloadsPrefix', 'listProjectPaymentSummary', 'isOperationalAccount', 'isOperationalProject', 'isTestProjectSlug', 'knownProjectIds', 'listOpsSummary', 'domainInfoFromPageJson', 'managerMembers', 'pendingInvites', 'failedDeliveries', 'activeAiKeys', 'pendingOwnershipTransfers', 'auditLogs']],
  ['ai shared', aiShared, ['ai_keys', 'encryptSecret', 'resolveAiKey', 'listD1AiDrafts', 'upsertD1AiDraft', 'deleteD1AiDraft']],
  ['ai key', aiKey, ['readAiKeyStatus', 'saveAiKey', 'deleteAiKey']],
  ['ai test', aiTest, ['testOpenAiKey', 'classifyAiKeyTestError', 'keyTest']],
  ['ai draft', aiDraft, ['generateAiDraft', 'resolveAiKey']],
  ['ai drafts', aiDrafts, ['listAiDrafts', 'saveAiDraft']],
  ['ai draft delete', aiDraftDelete, ['removeAiDraft', 'params.id']],
]) {
  for (const token of tokens) {
    assert(source.includes(token), `Pages ${name} function missing ${token}`);
  }
}

for (const token of [
  '"pages_build_output_dir": "dist"',
  '"d1_databases"',
  '"binding": "DB"',
  '"database_name": "inlet-prod"',
  '"r2_buckets"',
  '"binding": "FILES_BUCKET"',
  '"bucket_name": "inlet-files"',
  '"INLET_FILES_PROJECT_MAX_MB": "100"',
  '"INLET_FILES_PROJECT_MAX_COUNT": "20"',
]) {
  assert(wrangler.includes(token), `wrangler Pages config missing ${token}`);
}

for (const token of [
  "payload?.service === 'pagero-api'",
  "storageActive === 'd1'",
  'static-pages-html-fallback',
]) {
  assert(hostedQa.includes(token), `hosted API QA missing ${token}`);
}

for (const token of [
  '/api/leads',
  '/api/leads/export.csv',
  '/api/leads/blocked-history',
  '/api/leads/delivery-logs',
  '/api/leads/retry-queue',
  '/api/leads/:id/deliver',
  '/api/events',
  '/api/stats/summary',
  '/api/pages',
  '/api/files/upload',
  '/api/files/download',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/email-verification',
  '/api/projects/invites',
  '/api/projects/ownership-transfer',
  '/api/admin/summary',
  '/api/admin/ownership-transfer',
  '/api/ai/key',
  '/api/ai/drafts',
  '/api/ai/test',
  '/accept',
  ':slug read protection',
  'Hosted /api/auth login/session',
  'Hosted /api/leads authenticated D1 list',
  'Hosted /api/leads duplicate policy block',
  'Hosted /api/stats/summary authenticated D1 aggregate',
  'Hosted /api/leads/export.csv authenticated D1 month export',
  'Hosted /api/leads/blocked-history authenticated D1 list',
  'Hosted /api/leads/delivery-logs authenticated D1 list',
  'Hosted /api/leads/retry-queue authenticated D1 list',
  'Hosted /api/pages/:slug authenticated D1 save v1',
  'Hosted /api/pages/:slug authenticated D1 save v2',
  'Hosted /api/pages/:slug authenticated D1 read',
  'Hosted /api/pages/:slug public D1 read',
  '?public=1',
  'Hosted /api/pages/:slug/revisions authenticated D1 list',
  'Hosted /api/pages/:slug/revisions/:id authenticated D1 read',
  'Hosted /api/pages/:slug/restore authenticated D1 write',
  'Hosted /api/projects/invites create',
  'Hosted /api/projects/ownership-transfer create',
  'Hosted /api/ai/key save',
  'Hosted /api/ai/drafts save',
  'INLET_HOSTED_ROUTE_QA_WRITE',
  'read protection',
]) {
  assert(hostedRoutesQa.includes(token), `hosted API route QA missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: 75,
  functions: [
    'functions/api/health.js',
    'functions/api/leads.js',
    'functions/api/leads/export.csv.js',
    'functions/api/leads/blocked-history.js',
    'functions/api/leads/delivery-logs.js',
    'functions/api/leads/retry-queue.js',
    'functions/api/leads/[id]/deliver.js',
    'functions/api/integrations/test.js',
    'functions/api/integrations/google/sheets/_oauth.js',
    'functions/api/integrations/google/sheets/oauth-url.js',
    'functions/api/integrations/google/sheets/callback.js',
    'functions/api/integrations/google/sheets/status.js',
    'functions/api/integrations/google/sheets/disconnect.js',
    'functions/api/events.js',
    'functions/api/stats/summary.js',
  'functions/api/pages/[slug].js',
  'functions/api/pages/[slug]/revisions.js',
  'functions/api/pages/[slug]/revisions/[id].js',
  'functions/api/pages/[slug]/restore.js',
  'functions/api/files/upload.js',
  'functions/api/files/download.js',
    'functions/api/auth/register.js',
    'functions/api/auth/login.js',
    'functions/api/auth/session.js',
    'functions/api/auth/logout.js',
    'functions/api/auth/account.js',
    'functions/api/auth/account/status.js',
    'functions/api/auth/password.js',
    'functions/api/auth/email-verification.js',
    'functions/api/auth/email-verification/confirm.js',
    'functions/api/projects/invites.js',
    'functions/api/projects/invites/[token].js',
    'functions/api/projects/invites/[token]/accept.js',
    'functions/api/projects/ownership-transfer.js',
    'functions/api/admin/summary.js',
    'functions/api/admin/ownership-transfer/[id].js',
    'functions/api/ai/key.js',
    'functions/api/ai/test.js',
    'functions/api/ai/draft.js',
    'functions/api/ai/drafts.js',
    'functions/api/ai/drafts/[id].js',
  ],
  binding: 'DB',
}, null, 2));
