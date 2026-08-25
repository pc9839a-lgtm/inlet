import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  buildMetaOauthAuthorizationUrl,
  decryptProviderCredential,
  encryptProviderCredential,
  metaOauthScopes,
  safeMetaOauthReturnPath,
} from '../functions/api/calltag/v1/_shared.js';

const env = {
  CALLTAG_PROVIDER_CREDENTIAL_KEY: 'qa-provider-credential-master-key-2026-08-25-at-least-32-chars',
  CALLTAG_META_APP_ID: '123456789012345',
  CALLTAG_META_APP_SECRET: 'qa-meta-app-secret-never-send-to-browser',
  CALLTAG_META_OAUTH_REDIRECT_URI: 'https://calltag.example/api/calltag/v1/meta/oauth/callback',
  CALLTAG_META_GRAPH_VERSION: 'v99.0',
};

assert.equal(safeMetaOauthReturnPath('/connect'), '/connect');
assert.equal(safeMetaOauthReturnPath('/connect?from=settings'), '/connect?from=settings');
assert.equal(safeMetaOauthReturnPath('https://evil.example/steal'), '/connect');
assert.equal(safeMetaOauthReturnPath('//evil.example/steal'), '/connect');
assert.equal(safeMetaOauthReturnPath('/\\evil.example/steal'), '/connect');

const scopes = metaOauthScopes(env);
for (const required of ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'leads_retrieval']) {
  assert.ok(scopes.includes(required), `Meta OAuth default scope missing: ${required}`);
}
const authUrl = new URL(buildMetaOauthAuthorizationUrl(env, 'qa-state-123'));
assert.equal(authUrl.hostname, 'www.facebook.com');
assert.equal(authUrl.searchParams.get('client_id'), env.CALLTAG_META_APP_ID);
assert.equal(authUrl.searchParams.get('redirect_uri'), env.CALLTAG_META_OAUTH_REDIRECT_URI);
assert.equal(authUrl.searchParams.get('state'), 'qa-state-123');
assert.equal(authUrl.searchParams.get('response_type'), 'code');
assert.ok(authUrl.searchParams.get('scope').includes('leads_retrieval'));
assert.ok(!authUrl.toString().includes(env.CALLTAG_META_APP_SECRET), 'Meta App Secret must never appear in browser authorization URL');

const tempUserToken = 'EAQA-temporary-user-token-never-visible-in-browser';
const tempAad = 'calltag:meta-oauth-user-token:v1:owner-qa:oauth-qa';
const envelope = await encryptProviderCredential(env, tempUserToken, tempAad);
assert.ok(!envelope.includes(tempUserToken), 'temporary Meta user token must be encrypted at rest');
assert.equal(await decryptProviderCredential(env, envelope, tempAad), tempUserToken);
await assert.rejects(
  () => decryptProviderCredential(env, envelope, `${tempAad}:wrong`),
  (error) => error?.code === 'CALLTAG_PROVIDER_CREDENTIAL_DECRYPT_FAILED',
);

const files = {
  migration: 'migrations/0013_calltag_meta_oauth.sql',
  schema: 'functions/api/calltag/v1/_meta-oauth-schema.js',
  core: 'functions/api/calltag/v1/_meta-oauth.js',
  start: 'functions/api/calltag/v1/meta/oauth/start.js',
  callback: 'functions/api/calltag/v1/meta/oauth/callback.js',
  session: 'functions/api/calltag/v1/meta/oauth/session.js',
  complete: 'functions/api/calltag/v1/meta/oauth/complete.js',
  shared: 'functions/api/calltag/v1/_shared.js',
  connectRoute: 'functions/connect.js',
  connectHtml: 'public/call/connect/index.html',
};
const source = Object.fromEntries(await Promise.all(
  Object.entries(files).map(async ([key, file]) => [key, await readFile(file, 'utf8')]),
));

for (const token of [
  'CREATE TABLE IF NOT EXISTS calltag_meta_oauth_sessions',
  'state_hash TEXT NOT NULL UNIQUE',
  'user_token_envelope TEXT NOT NULL',
  "status IN ('pending', 'exchanging', 'authorized', 'completed', 'failed', 'expired')",
  'expires_at INTEGER NOT NULL',
]) {
  assert.ok(source.migration.includes(token), `Meta OAuth migration missing: ${token}`);
  assert.ok(source.schema.includes(token), `Meta OAuth runtime schema missing: ${token}`);
}
assert.ok(!/^\s*state\s+TEXT/im.test(source.migration), 'raw OAuth state column must not exist');
assert.ok(!/^\s*user_access_token\s+TEXT/im.test(source.migration), 'plaintext Meta user token column must not exist');

for (const token of [
  'const stateHash = await sha256(rawState)',
  "status = 'exchanging'",
  "status = 'pending' AND expires_at > ?",
  'encryptProviderCredential',
  'decryptProviderCredential',
  'metaOauthUserTokenAad',
  "SET status = 'completed', user_token_envelope = ''",
  "SET status = 'expired', user_token_envelope = ''",
  "url.searchParams.set('fields', 'id,name,access_token,tasks')",
  'Authorization: `Bearer ${userToken}`',
  "subscribed_fields: 'leadgen'",
  'verifyMetaPageAccess',
  'upsertMetaConnection',
  'SELECT id, owner_id FROM calltag_meta_connections WHERE page_id = ? LIMIT 1',
]) assert.ok(source.core.includes(token), `Meta OAuth core missing: ${token}`);

assert.ok(!source.core.includes("url.searchParams.set('client_secret'"), 'Meta App Secret must not be written into a URL query helper');
assert.ok(!source.core.includes("url.searchParams.set('access_token'"), 'Meta access tokens must not be written into Graph URL query params');
assert.ok(source.core.includes("client_secret: metaOauthAppSecret(env)"), 'server-only token exchange must use configured Meta App Secret');
assert.ok(source.core.includes("body: new URLSearchParams({ subscribed_fields: 'leadgen' })"), 'Page subscription must request leadgen');

assert.ok(source.start.includes('callSession') && source.start.includes('session.ownerId'), 'OAuth start must be signed-session scoped');
assert.ok(source.session.includes('callSession') && source.session.includes('session.ownerId'), 'OAuth session view must be signed-session scoped');
assert.ok(source.complete.includes('callSession') && source.complete.includes('session.ownerId'), 'OAuth completion must be signed-session scoped');
assert.ok(!source.callback.includes('callSession'), 'OAuth callback must authenticate by one-time state, not browser owner/session fields');
assert.ok(!source.callback.includes('ownerId'), 'OAuth callback route must not read ownerId from callback input');
assert.ok(source.callback.includes("String(row.status) !== 'pending'"), 'OAuth callback must reject replay once state leaves pending');

assert.ok(source.core.includes('SELECT id, owner_id, status, pages_json, requested_scopes_json, granted_scopes_json'), 'public OAuth session projection must be explicit');
assert.ok(!source.core.includes('publicMetaOauthSession(row = {}) {\n  return {\n    userToken'), 'public OAuth session must not expose user tokens');
assert.ok(source.core.includes('const freshPages = await fetchMetaManagedPages(env, userToken)'), 'OAuth completion must re-fetch managed Pages server-side');
assert.ok(!source.complete.includes('pageAccessToken'), 'browser complete route must not accept a Page access token');
for (const token of [
  'SELECT requested_scopes_json, granted_scopes_json',
  'const grantedScopes = new Set',
  'const missingScopes = requestedScopes.filter',
  'CALLTAG_META_OAUTH_SCOPE_MISSING',
]) assert.ok(source.complete.includes(token), `OAuth completion permission gate missing: ${token}`);

assert.ok(source.connectHtml.includes("const SESSION_KEY='calllink-session'"), 'Connect screen must reuse CallTag session storage');
assert.ok(source.connectHtml.includes("const OAUTH_SESSION_KEY='calltag-meta-oauth-session'"), 'Connect screen must preserve OAuth selection session across refresh');
assert.ok(source.connectHtml.includes('/api/calltag/v1/meta/oauth/start'), 'Connect screen missing OAuth start action');
assert.ok(source.connectHtml.includes('/api/calltag/v1/meta/oauth/session'), 'Connect screen missing OAuth session action');
assert.ok(source.connectHtml.includes('/api/calltag/v1/meta/oauth/complete'), 'Connect screen missing OAuth complete action');
assert.ok(source.connectHtml.includes('Meta 로그인') && source.connectHtml.includes('페이지 선택') && source.connectHtml.includes('연결 완료'));
assert.ok(!/pageAccessToken|page_access_token|user_access_token/i.test(source.connectHtml), 'Connect UI must not expose manual token fields');
assert.ok(!/type=["'](?:text|password)["'][^>]*(?:token|access)/i.test(source.connectHtml), 'Connect UI must not render provider token inputs');
assert.ok(source.connectHtml.includes('history.replaceState'), 'OAuth session identifier should be removed from the visible URL after capture');
assert.ok(source.connectHtml.includes('resetMetaStartButton'), 'Connect UI must recover its Meta start button after an expired CallTag session');

assert.ok(source.connectRoute.includes("host === 'calltag.pagero.kr'"), 'Connect route must be limited to CallTag host');
assert.ok(source.connectRoute.includes('return context.next()'), 'non-CallTag hosts must retain existing routing');
assert.ok(source.connectRoute.includes("X-Robots-Tag', 'noindex, nofollow, noarchive'"), 'Connect route must be noindex');
assert.ok(source.connectRoute.includes("Cache-Control', 'no-store"), 'Connect route must be no-store');
assert.ok(source.shared.includes("export * from './_meta-oauth-schema.js'"));
assert.ok(source.shared.includes("export * from './_meta-oauth.js'"));

for (const file of [files.schema, files.core, files.start, files.callback, files.session, files.complete, files.connectRoute]) {
  const checked = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  assert.equal(checked.status, 0, `syntax check failed for ${file}: ${checked.stderr || checked.stdout}`);
  const loaded = spawnSync(process.execPath, ['--input-type=module', '--eval', `await import('./${file}')`], { encoding: 'utf8' });
  assert.equal(loaded.status, 0, `module import failed for ${file}: ${loaded.stderr || loaded.stdout}`);
}

console.log(JSON.stringify({
  ok: true,
  phase: 'CallTag Meta OAuth Connect',
  contracts: [
    'one-time-state-hash-only',
    'oauth-callback-replay-rejection',
    'ten-minute-oauth-session',
    'temporary-user-token-aes-gcm',
    'server-side-granted-scope-enforcement',
    'server-side-page-refetch',
    'server-side-page-owner-collision-guard',
    'leadgen-page-app-subscription',
    'no-provider-token-in-browser',
    'refresh-safe-oauth-selection-session',
    'calltag-host-only-connect-screen',
    'safe-same-origin-return-path',
    'runtime-route-import-resolution',
  ],
}, null, 2));
