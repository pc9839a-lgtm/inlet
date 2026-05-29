import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await readFile('functions/api/health.js', 'utf8');
const shared = await readFile('functions/api/_shared.js', 'utf8');
const leads = await readFile('functions/api/leads.js', 'utf8');
const leadCsv = await readFile('functions/api/leads/export.csv.js', 'utf8');
const blockedHistory = await readFile('functions/api/leads/blocked-history.js', 'utf8');
const deliveryLogs = await readFile('functions/api/leads/delivery-logs.js', 'utf8');
const retryQueue = await readFile('functions/api/leads/retry-queue.js', 'utf8');
const leadDeliver = await readFile('functions/api/leads/[id]/deliver.js', 'utf8');
const events = await readFile('functions/api/events.js', 'utf8');
const statsSummary = await readFile('functions/api/stats/summary.js', 'utf8');
const pages = await readFile('functions/api/pages/[slug].js', 'utf8');
const pageRevisions = await readFile('functions/api/pages/[slug]/revisions.js', 'utf8');
const pageRevision = await readFile('functions/api/pages/[slug]/revisions/[id].js', 'utf8');
const pageRestore = await readFile('functions/api/pages/[slug]/restore.js', 'utf8');
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
const aiShared = await readFile('functions/api/ai/_ai.js', 'utf8');
const aiKey = await readFile('functions/api/ai/key.js', 'utf8');
const aiTest = await readFile('functions/api/ai/test.js', 'utf8');
const aiDraft = await readFile('functions/api/ai/draft.js', 'utf8');
const aiDrafts = await readFile('functions/api/ai/drafts.js', 'utf8');
const aiDraftDelete = await readFile('functions/api/ai/drafts/[id].js', 'utf8');
const wrangler = await readFile('wrangler.jsonc', 'utf8');
const hostedQa = await readFile('scripts/hosted-api-quality-check.mjs', 'utf8');
const hostedRoutesQa = await readFile('scripts/hosted-api-routes-quality-check.mjs', 'utf8');

for (const token of [
  'export async function onRequest',
  'createStorageRuntime',
  'storageRuntimeCoverage',
  "service: 'inlet-api'",
  "mode: 'pages-functions'",
  "sourceOfTruth: 'signed-session'",
  "INLET_STORAGE_ADAPTER: env.INLET_STORAGE_ADAPTER || 'd1'",
  'INLET_SESSION_SECRET',
  'Access-Control-Allow-Origin',
]) {
  assert(health.includes(token), `Pages health function missing ${token}`);
}

for (const token of [
  'sessionIdentity',
  'crypto.subtle.importKey',
  'X-Inlet-Session',
  'X-Inlet-Api-Token',
  'publicWrite',
  'getD1ProjectAccess',
  'canUseProjectAccess',
  'masterOnly',
  'CLIENT_ADMIN_TABS',
  'MANAGER_TABS',
  'ensureD1ProjectShell',
  'publicProjectShell',
  'INSERT OR IGNORE INTO projects',
  'isPublicProjectShell',
  'pendingClaim',
  'Project access is required.',
]) {
  assert(shared.includes(token), `Pages shared API helper missing ${token}`);
}

for (const [name, source, tokens] of [
  ['leads', leads, ['upsertD1Lead', 'listD1Leads', 'findD1LeadsByIntakeSignals', 'insertD1BlockedLeadSubmission', 'publicWrite: true', 'publicProjectShell(project)', "tab: 'inbox'", 'deliveryStatus', 'LEAD_RATE_LIMITED', 'meta: { source:']],
  ['lead csv', leadCsv, ['listD1Leads', 'month is required for CSV export.', 'text/csv; charset=utf-8', "Content-Disposition", 'csvCell', "tab: 'inbox'"]],
  ['blocked history', blockedHistory, ['listD1BlockedLeadSubmissions', 'pageSlug', "source: 'd1'", "tab: 'inbox'"]],
  ['delivery logs', deliveryLogs, ['listD1DeliveryLogs', "type: 'delivery-logs'", "adapter: 'd1'", "tab: 'inbox'"]],
  ['retry queue', retryQueue, ['listD1DeliveryRetryQueue', "type: 'delivery-retry-queue'", 'deadLetter', "tab: 'inbox'"]],
  ['lead deliver', leadDeliver, ['getD1Lead', 'upsertD1Lead', 'publicWrite: true', '알림 전송 설정 없음']],
  ['events', events, ['insertD1Event', 'listD1Events', 'publicWrite: true', 'publicProjectShell(project)', "tab: 'stats'", 'eventType', 'meta: { source:']],
  ['stats summary', statsSummary, ['aggregateD1Stats', "source: 'server'", "adapter: 'd1'", "tab: 'stats'"]],
  ['pages', pages, ['getD1PageBySlug', 'upsertD1Page', 'ensureD1ProjectShell', 'authorizeProject', 'PUBLIC_PAGE_CACHE_CONTROL', 'stale-while-revalidate=86400']],
  ['page revisions', pageRevisions, ['listD1PageRevisions', "tab: 'edit'", 'revisions']],
  ['page revision', pageRevision, ['getD1PageRevision', "tab: 'edit'", 'revision.page']],
  ['page restore', pageRestore, ['getD1PageRevision', 'upsertD1Page', 'restore:', "tab: 'edit'"]],
  ['auth shared', authShared, ['getD1AccountByEmail', 'getD1AccountByPhone', 'upsertD1Account', 'createSessionToken', 'verifySessionToken', 'issueEmailVerificationToken']],
  ['auth register', authRegister, ['registerAccount', 'user', 'AUTH_METHODS']],
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
]) {
  assert(wrangler.includes(token), `wrangler Pages config missing ${token}`);
}

for (const token of [
  "payload?.service === 'inlet-api'",
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
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/email-verification',
  '/api/projects/invites',
  '/api/projects/ownership-transfer',
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
  checks: 61,
  functions: [
    'functions/api/health.js',
    'functions/api/leads.js',
    'functions/api/leads/export.csv.js',
    'functions/api/leads/blocked-history.js',
    'functions/api/leads/delivery-logs.js',
    'functions/api/leads/retry-queue.js',
    'functions/api/leads/[id]/deliver.js',
    'functions/api/events.js',
    'functions/api/stats/summary.js',
    'functions/api/pages/[slug].js',
    'functions/api/pages/[slug]/revisions.js',
    'functions/api/pages/[slug]/revisions/[id].js',
    'functions/api/pages/[slug]/restore.js',
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
    'functions/api/admin/ownership-transfer/[id].js',
    'functions/api/ai/key.js',
    'functions/api/ai/test.js',
    'functions/api/ai/draft.js',
    'functions/api/ai/drafts.js',
    'functions/api/ai/drafts/[id].js',
  ],
  binding: 'DB',
}, null, 2));
