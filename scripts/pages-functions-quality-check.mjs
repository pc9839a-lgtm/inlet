import { readFile } from 'node:fs/promises';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const health = await readFile('functions/api/health.js', 'utf8');
const shared = await readFile('functions/api/_shared.js', 'utf8');
const leads = await readFile('functions/api/leads.js', 'utf8');
const leadCsv = await readFile('functions/api/leads/export.csv.js', 'utf8');
const deliveryLogs = await readFile('functions/api/leads/delivery-logs.js', 'utf8');
const retryQueue = await readFile('functions/api/leads/retry-queue.js', 'utf8');
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
  'ensureD1ProjectShell',
  'INSERT OR IGNORE INTO projects',
  'Project access is required.',
]) {
  assert(shared.includes(token), `Pages shared API helper missing ${token}`);
}

for (const [name, source, tokens] of [
  ['leads', leads, ['upsertD1Lead', 'listD1Leads', 'publicWrite: true', 'deliveryStatus', 'meta: { source:']],
  ['lead csv', leadCsv, ['listD1Leads', 'month is required for CSV export.', 'text/csv; charset=utf-8', "Content-Disposition", 'csvCell']],
  ['delivery logs', deliveryLogs, ['listD1DeliveryLogs', "type: 'delivery-logs'", "adapter: 'd1'", 'authorizeProject']],
  ['retry queue', retryQueue, ['listD1DeliveryRetryQueue', "type: 'delivery-retry-queue'", 'deadLetter', 'authorizeProject']],
  ['events', events, ['insertD1Event', 'listD1Events', 'publicWrite: true', 'eventType', 'meta: { source:']],
  ['stats summary', statsSummary, ['aggregateD1Stats', "source: 'server'", "adapter: 'd1'", 'authorizeProject']],
  ['pages', pages, ['getD1PageBySlug', 'upsertD1Page', 'ensureD1ProjectShell', 'authorizeProject']],
  ['page revisions', pageRevisions, ['listD1PageRevisions', 'authorizeProject', 'revisions']],
  ['page revision', pageRevision, ['getD1PageRevision', 'Revision not found', 'revision.page']],
  ['page restore', pageRestore, ['getD1PageRevision', 'upsertD1Page', 'restore:', 'authorizeProject']],
  ['auth shared', authShared, ['getD1AccountByEmail', 'getD1AccountByPhone', 'upsertD1Account', 'createSessionToken', 'verifySessionToken', 'issueEmailVerificationToken']],
  ['auth register', authRegister, ['registerAccount', 'user', 'AUTH_METHODS']],
  ['auth login', authLogin, ['loginAccount', 'ok: true', 'AUTH_METHODS']],
  ['auth session', authSession, ['getSessionAccount', 'expiresInSeconds', 'createSessionToken']],
  ['auth logout', authLogout, ['stateless-session', 'loggedOut']],
  ['auth account', authAccount, ['getSessionAccount', 'getD1AccountByPhone', 'AUTH_PHONE_DUPLICATE']],
  ['auth account status', authAccountStatus, ['normalizeAccountStatus', 'AUTH_ACCOUNT_STATUS_INVALID', 'session:']],
  ['auth password', authPassword, ['passwordHash', 'EMAIL_VERIFICATION_REQUIRED', 'AUTH_PASSWORD_POLICY']],
  ['auth email verification', authEmailVerification, ['issueEmailVerificationToken', 'verification']],
  ['auth email verification confirm', authEmailVerificationConfirm, ['confirmEmailVerificationToken', 'verification']],
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
  '/api/leads/delivery-logs',
  '/api/leads/retry-queue',
  '/api/events',
  '/api/stats/summary',
  '/api/pages',
  '/api/auth/register',
  '/api/auth/login',
  '/api/auth/session',
  '/api/auth/email-verification',
  ':slug read protection',
  'Hosted /api/auth login/session',
  'INLET_HOSTED_ROUTE_QA_WRITE',
  'read protection',
]) {
  assert(hostedRoutesQa.includes(token), `hosted API route QA missing ${token}`);
}

console.log(JSON.stringify({
  ok: true,
  checks: 42,
  functions: [
    'functions/api/health.js',
    'functions/api/leads.js',
    'functions/api/leads/export.csv.js',
    'functions/api/leads/delivery-logs.js',
    'functions/api/leads/retry-queue.js',
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
  ],
  binding: 'DB',
}, null, 2));
