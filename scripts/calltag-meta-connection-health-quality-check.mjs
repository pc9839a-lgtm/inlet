import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import {
  evaluateMetaConnectionHealth,
  metaConnectionCredentialAad,
} from '../functions/api/calltag/v1/_meta-health.js';

const root = process.cwd();
const healthModulePath = path.join(root, 'functions/api/calltag/v1/_meta-health.js');
const healthRoutePath = path.join(root, 'functions/api/calltag/v1/meta/health.js');
const connectPath = path.join(root, 'public/call/connect/index.html');
const [healthSource, routeSource, connectSource] = await Promise.all([
  readFile(healthModulePath, 'utf8'),
  readFile(healthRoutePath, 'utf8'),
  readFile(connectPath, 'utf8'),
]);

const baseRow = {
  id: 'ctmeta_qa',
  page_id: '123456789',
  page_name: 'QA Page',
  status: 'active',
  token_expires_at: '',
  granted_scopes_json: JSON.stringify(['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'leads_retrieval']),
  last_webhook_at: '2026-08-25 00:00:00',
  last_lead_at: '2026-08-25 00:01:00',
  last_error: '',
};
const requiredScopes = ['pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'leads_retrieval'];

const healthy = evaluateMetaConnectionHealth(baseRow, {
  requiredScopes,
  pageAccess: true,
  checkedAt: Date.now(),
  graphVersion: 'v24.0',
});
assert.equal(healthy.state, 'healthy');
assert.equal(healthy.pageAccess, true);
assert.deepEqual(healthy.scopes.missing, []);
assert.equal(healthy.scopes.complete, true);
assert.equal('credentialEnvelope' in healthy, false);
assert.equal('ownerId' in healthy, false);

const missingScope = evaluateMetaConnectionHealth({
  ...baseRow,
  granted_scopes_json: JSON.stringify(['pages_show_list']),
}, { requiredScopes, pageAccess: true });
assert.equal(missingScope.state, 'warning');
assert.ok(missingScope.reasons.includes('CALLTAG_META_SCOPE_MISSING'));
assert.deepEqual(missingScope.scopes.missing.sort(), requiredScopes.filter((scope) => scope !== 'pages_show_list').sort());

const expired = evaluateMetaConnectionHealth({
  ...baseRow,
  token_expires_at: '2020-01-01T00:00:00.000Z',
}, { requiredScopes, pageAccess: true });
assert.equal(expired.state, 'error');
assert.ok(expired.reasons.includes('CALLTAG_META_TOKEN_EXPIRED'));

const denied = evaluateMetaConnectionHealth(baseRow, {
  requiredScopes,
  pageAccess: false,
  checkCode: 'CALLTAG_META_PAGE_ACCESS_DENIED',
});
assert.equal(denied.state, 'error');
assert.ok(denied.reasons.includes('CALLTAG_META_PAGE_ACCESS_DENIED'));

const revoked = evaluateMetaConnectionHealth({ ...baseRow, status: 'revoked' }, { requiredScopes });
assert.equal(revoked.state, 'revoked');
assert.equal(revoked.pageAccess, null);

assert.equal(
  metaConnectionCredentialAad('owner_qa', '123456789'),
  'calltag:meta-page-token:v1:owner_qa:123456789',
);
assert.match(healthSource, /decryptProviderCredential\s*\(/);
assert.match(healthSource, /verifyMetaPageAccess\s*\(/);
assert.match(healthSource, /WHERE id = \? AND owner_id = \?/);
assert.match(healthSource, /calltag:meta-page-token:v1/);
assert.doesNotMatch(healthSource, /pageAccessToken\s*:/);

assert.match(routeSource, /callSession\s*\(/);
assert.match(routeSource, /checkMetaConnectionHealth\s*\(/);
assert.match(routeSource, /request\.method !== 'POST'/);
assert.doesNotMatch(routeSource, /ownerId\s*:\s*body/);

assert.match(connectSource, /\/api\/calltag\/v1\/meta\/health/);
assert.match(connectSource, /상태 확인/);
assert.match(connectSource, /최근 문의/);
assert.match(connectSource, /최근 Webhook/);
assert.match(connectSource, /재연결/);
assert.doesNotMatch(connectSource, /pageAccessToken/);
assert.doesNotMatch(connectSource, /access_token/);

for (const file of [healthModulePath, healthRoutePath]) {
  const checked = spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' });
  assert.equal(checked.status, 0, `${path.relative(root, file)} syntax failed: ${checked.stderr || checked.stdout}`);
  await import(`${pathToFileURL(file).href}?qa=${Date.now()}-${Math.random()}`);
}

console.log('[calltag:meta-connection-health:qa] PASS');
