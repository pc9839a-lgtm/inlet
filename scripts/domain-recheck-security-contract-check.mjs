import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  executeDomainRecheck,
  normalizeAllowedOrigins,
  validateDomainRecheckSecret,
  validateDomainRecheckTarget,
} from './domain-recheck-safe-runner.mjs';
import {
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  resolveDnsResolverEndpoint,
} from '../server/cloudflarePagesDomains.mjs';
import { prepareD1PageDomainSave } from '../server/pageDomainStore.mjs';

const allowedOrigins = normalizeAllowedOrigins('https://preview.pagero.example');
assert.deepEqual(allowedOrigins, ['https://pagero.kr', 'https://preview.pagero.example']);
assert.equal(validateDomainRecheckTarget(
  'https://pagero.kr/api/admin/domains/recheck',
  allowedOrigins,
).ok, true);
for (const endpoint of [
  'https://attacker.example/api/admin/domains/recheck',
  'http://pagero.kr/api/admin/domains/recheck',
  'https://pagero.kr/api/admin/domains/recheck/extra',
  'https://pagero.kr/api/admin/domains/recheck?next=https://attacker.example',
  'https://user:password@pagero.kr/api/admin/domains/recheck',
]) {
  assert.equal(validateDomainRecheckTarget(endpoint, allowedOrigins).ok, false, `${endpoint} must be blocked`);
}
assert.equal(validateDomainRecheckSecret('').ok, false);
assert.equal(validateDomainRecheckSecret('too-short').ok, false);
assert.equal(validateDomainRecheckSecret('x'.repeat(32)).ok, true);

let recheckInit = null;
const recheckResult = await executeDomainRecheck({
  endpoint: 'https://pagero.kr/api/admin/domains/recheck',
  secret: 's'.repeat(40),
  fetchImpl: async (_url, init) => {
    recheckInit = init;
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, processed: 2, succeeded: 1, failed: 1, operatorRequired: 1 };
      },
    };
  },
});
assert.equal(recheckInit.redirect, 'error');
assert.equal(recheckInit.method, 'POST');
assert.equal(recheckInit.headers.Authorization, `Bearer ${'s'.repeat(40)}`);
assert.equal(recheckResult.processed, 2);
assert.equal(recheckResult.secretValuesIncluded, false);

const providerEnv = {
  INLET_CLOUDFLARE_ACCOUNT_ID: 'account-1',
  INLET_CLOUDFLARE_PAGES_PROJECT: 'inlet',
  INLET_CLOUDFLARE_API_TOKEN: 'provider-secret-token',
  INLET_CUSTOM_DOMAIN_CNAME_TARGET: 'inlet.pages.dev',
};
let providerInit = null;
await ensureCloudflarePagesDomain(providerEnv, 'secure.example.com', async (_url, init = {}) => {
  providerInit = init;
  if (init.method === 'GET') {
    return { ok: false, status: 404, async json() { return { success: false, errors: [] }; } };
  }
  return {
    ok: true,
    status: 200,
    async json() {
      return { success: true, result: { id: 'domain-1', name: 'secure.example.com' } };
    },
  };
});
assert.equal(providerInit.redirect, 'error');
assert.equal(providerInit.headers.Authorization, 'Bearer provider-secret-token');

assert.equal(resolveDnsResolverEndpoint({}), 'https://cloudflare-dns.com/dns-query');
assert.throws(
  () => resolveDnsResolverEndpoint({ INLET_DNS_JSON_RESOLVER_URL: 'https://attacker.example/dns-query' }),
  /not approved/,
);
let dnsFetchCalled = false;
const blockedDns = await inspectCustomDomainDns({
  ...providerEnv,
  INLET_DNS_JSON_RESOLVER_URL: 'https://attacker.example/dns-query',
}, 'secure.example.com', async () => {
  dnsFetchCalled = true;
  throw new Error('must not fetch');
});
assert.equal(dnsFetchCalled, false);
assert.match(blockedDns.error, /허용되지 않은 DNS 확인 주소/);

const activeDomain = {
  page_id: 'page-1',
  project_id: 'project-1',
  hostname: 'old.example.com',
  status: 'active',
  ssl_status: 'active',
};
const domainDb = {
  prepare(sql) {
    return {
      bind(value) {
        return {
          async first() {
            if (sql.includes('WHERE page_id = ?')) return value === 'page-1' ? activeDomain : null;
            if (sql.includes('WHERE hostname = ?')) return null;
            throw new Error(`Unexpected SQL: ${sql}`);
          },
        };
      },
    };
  },
};
await assert.rejects(
  () => prepareD1PageDomainSave(domainDb, {
    id: 'page-1',
    projectId: 'project-1',
    domainType: 'custom',
    customDomain: 'new.example.com',
  }, { pageId: 'page-1', projectId: 'project-1' }),
  (error) => error?.code === 'DOMAIN_DETACH_REQUIRED',
);
await assert.rejects(
  () => prepareD1PageDomainSave(domainDb, {
    id: 'page-1',
    projectId: 'project-1',
    domainType: 'default',
    customDomain: '',
  }, { pageId: 'page-1', projectId: 'project-1' }),
  (error) => error?.code === 'DOMAIN_DETACH_REQUIRED',
);

const [workflow, schedulerEndpoint, providerModule, manageEndpoint, checkEndpoint, hook, store, runbook] = await Promise.all([
  readFile('.github/workflows/domain-recheck.yml', 'utf8'),
  readFile('functions/api/admin/domains/recheck.js', 'utf8'),
  readFile('server/cloudflarePagesDomains.mjs', 'utf8'),
  readFile('functions/api/domains/manage.js', 'utf8'),
  readFile('functions/api/domains/check.js', 'utf8'),
  readFile('src/panels/settings/usePageDomainSettings.js', 'utf8'),
  readFile('server/pageDomainStore.mjs', 'utf8'),
  readFile('docs/ops-custom-domain-runbook.md', 'utf8'),
]);

for (const token of [
  'node scripts/domain-recheck-safe-runner.mjs',
  'PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS',
  'custom-domain-recheck-evidence-${{ github.run_id }}',
  'retention-days: 30',
]) assert(workflow.includes(token), `domain workflow missing ${token}`);
assert(!workflow.includes('curl --fail-with-body'), 'workflow must not send secrets through an unchecked curl target');
assert(!workflow.includes("exit 0\n          fi"), 'missing scheduled secret must not be treated as success');

for (const token of [
  'MIN_SECRET_LENGTH = 32',
  'constantTimeEqual',
  'DOMAIN_RECHECK_SECRET_WEAK_OR_MISSING',
  "status: 'failed-live'",
]) assert(schedulerEndpoint.includes(token), `scheduler endpoint missing ${token}`);
assert(!schedulerEndpoint.includes("status: 'skipped-live'"), 'weak or missing scheduler secrets must fail closed');

for (const token of [
  "redirect: 'error'",
  'DOMAIN_PROVIDER_TARGET_BLOCKED',
  'INLET_DNS_JSON_RESOLVER_ALLOWED_ENDPOINTS',
  'DNS resolver endpoint is not approved',
]) assert(providerModule.includes(token), `provider module missing ${token}`);

for (const token of [
  'providerAttachmentMayExist',
  'DOMAIN_PROVIDER_CLEANUP_REQUIRED',
  'operatorRequired: true',
]) assert(manageEndpoint.includes(token), `domain detach endpoint missing ${token}`);
assert(checkEndpoint.includes('SELECT id, project_id FROM pages WHERE id = ? LIMIT 1'));
assert(checkEndpoint.includes("'DOMAIN_PROJECT_MISMATCH'"));
assert(store.includes("'DOMAIN_DETACH_REQUIRED'"));
assert(hook.indexOf("domainRequest('detach'") < hook.indexOf('onSavePage?.(nextPage)'), 'previous provider mapping must be removed before page save');
for (const token of [
  'Scheduled Recheck Security',
  'Orphan Domain Prevention',
  'PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS',
  'DOMAIN_PROVIDER_CLEANUP_REQUIRED',
]) assert(runbook.includes(token), `custom-domain runbook missing ${token}`);

const fakeSecret = 'SECRET_MUST_NOT_APPEAR_1234567890';
const blocked = spawnSync(process.execPath, ['scripts/domain-recheck-safe-runner.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PAGERO_DOMAIN_RECHECK_URL: 'https://attacker.example/api/admin/domains/recheck',
    PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS: '',
    PAGERO_DOMAIN_RECHECK_SECRET: fakeSecret,
  },
  encoding: 'utf8',
});
const blockedOutput = `${blocked.stdout}\n${blocked.stderr}`;
assert.equal(blocked.status, 1);
assert.match(blockedOutput, /"status": "failed-live"/);
assert.doesNotMatch(blockedOutput, new RegExp(fakeSecret));

const missingSecret = spawnSync(process.execPath, ['scripts/domain-recheck-safe-runner.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PAGERO_DOMAIN_RECHECK_URL: 'https://pagero.kr/api/admin/domains/recheck',
    PAGERO_DOMAIN_RECHECK_ALLOWED_ORIGINS: '',
    PAGERO_DOMAIN_RECHECK_SECRET: '',
  },
  encoding: 'utf8',
});
assert.equal(missingSecret.status, 1);
assert.match(`${missingSecret.stdout}\n${missingSecret.stderr}`, /PAGERO_DOMAIN_RECHECK_SECRET is required/);

console.log(JSON.stringify({
  ok: true,
  contract: 'custom-domain-recheck-security',
  exactEndpoint: 'https://pagero.kr/api/admin/domains/recheck',
  redirectFollowing: false,
  minimumSecretLength: 32,
  providerCleanupBeforeReplacement: true,
  pageOwnershipBound: true,
}, null, 2));
