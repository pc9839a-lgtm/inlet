import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  cloudflarePagesDomainReadiness,
  deleteCloudflarePagesDomain,
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  mapCloudflarePagesDomain,
  resolveDnsResolverEndpoint,
} from '../server/cloudflarePagesDomains.mjs';
import { pageDomainRetryDelayMinutes } from '../server/pageDomainOperations.mjs';

const providerSource = await readFile('server/cloudflarePagesDomains.mjs', 'utf8');
const storeSource = await readFile('server/pageDomainStore.mjs', 'utf8');
const operationsSource = await readFile('server/pageDomainOperations.mjs', 'utf8');
const checkRoute = await readFile('functions/api/domains/check.js', 'utf8');
const manageRoute = await readFile('functions/api/domains/manage.js', 'utf8');
const migrationSource = await readFile('migrations/0015_page_domain_ownership.sql', 'utf8');

const env = {
  INLET_CLOUDFLARE_ACCOUNT_ID: 'account-123',
  INLET_CLOUDFLARE_PAGES_PROJECT: 'inlet',
  INLET_CLOUDFLARE_API_TOKEN: 'super-secret-provider-token',
  INLET_CUSTOM_DOMAIN_CNAME_TARGET: 'inlet-8mr.pages.dev',
};

assert.equal(cloudflarePagesDomainReadiness(env).configured, true);
assert.equal(cloudflarePagesDomainReadiness({}).configured, false);
assert.equal(resolveDnsResolverEndpoint(env), 'https://cloudflare-dns.com/dns-query');
assert.throws(() => resolveDnsResolverEndpoint({
  ...env,
  INLET_DNS_JSON_RESOLVER_URL: 'https://evil.example/dns-query',
}), /not approved/);
assert.throws(() => resolveDnsResolverEndpoint({
  ...env,
  INLET_DNS_JSON_RESOLVER_URL: 'http://cloudflare-dns.com/dns-query',
}), /HTTPS/);
assert.throws(() => resolveDnsResolverEndpoint({
  ...env,
  INLET_DNS_JSON_RESOLVER_URL: 'https://cloudflare-dns.com/dns-query?token=x',
}), /exact/);

function jsonResponse(status, payload) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return payload; },
  };
}

{
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) return jsonResponse(404, { success: false, errors: [{ code: 8000007, message: 'not found' }] });
    return jsonResponse(200, {
      success: true,
      result: {
        id: 'domain-id-1',
        name: 'example.com',
        status: 'pending',
        verification_data: { status: 'pending' },
        validation_data: { status: 'pending' },
      },
    });
  };
  const result = await ensureCloudflarePagesDomain(env, 'Example.com', fetchImpl);
  assert.equal(result.id, 'domain-id-1');
  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/account-123\/pages\/projects\/inlet\/domains\/example\.com$/);
  assert.match(requests[1].url, /^https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/account-123\/pages\/projects\/inlet\/domains$/);
  assert.equal(requests[0].options.redirect, 'error');
  assert.equal(requests[1].options.redirect, 'error');
  assert.equal(requests[0].options.headers.Authorization, 'Bearer super-secret-provider-token');
  assert.equal(requests[1].options.headers.Authorization, 'Bearer super-secret-provider-token');
  assert.deepEqual(JSON.parse(requests[1].options.body), { name: 'example.com' });
}

{
  let count = 0;
  const existing = await ensureCloudflarePagesDomain(env, 'example.com', async () => {
    count += 1;
    return jsonResponse(200, { success: true, result: { id: 'existing-id', status: 'active' } });
  });
  assert.equal(existing.id, 'existing-id');
  assert.equal(count, 1);
}

{
  const requests = [];
  const deleted = await deleteCloudflarePagesDomain(env, 'example.com', async (url, options = {}) => {
    requests.push({ url, options });
    if (requests.length === 1) return jsonResponse(200, { success: true, result: { id: 'existing-id' } });
    return jsonResponse(200, { success: true, result: null });
  });
  assert.equal(deleted.deleted, true);
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.method, 'DELETE');
  assert.equal(requests[1].options.redirect, 'error');
}

{
  const requests = [];
  const dns = await inspectCustomDomainDns(env, 'www.example.com', async (url, options = {}) => {
    requests.push({ url, options });
    return jsonResponse(200, {
      Status: 0,
      Answer: [{ type: 5, data: 'inlet-8mr.pages.dev.' }],
    });
  });
  assert.equal(dns.matched, true);
  assert.equal(requests.length, 1);
  const parsed = new URL(requests[0].url);
  assert.equal(parsed.origin, 'https://cloudflare-dns.com');
  assert.equal(parsed.pathname, '/dns-query');
  assert.equal(parsed.searchParams.get('name'), 'www.example.com');
  assert.equal(parsed.searchParams.get('type'), 'CNAME');
  assert.equal(requests[0].options.redirect, 'error');
}

{
  let called = false;
  const dns = await inspectCustomDomainDns({
    ...env,
    INLET_DNS_JSON_RESOLVER_URL: 'https://evil.example/dns-query',
  }, 'example.com', async () => {
    called = true;
    return jsonResponse(200, {});
  });
  assert.equal(called, false);
  assert.equal(dns.matched, false);
  assert.match(dns.error, /허용되지 않은 DNS/);
}

const active = mapCloudflarePagesDomain({
  id: 'domain-id-1',
  status: 'active',
  verification_data: { status: 'active' },
  validation_data: { status: 'active' },
}, { matched: true });
assert.equal(active.domainStatus, 'active');
assert.equal(active.sslStatus, 'active');
assert.equal(mapCloudflarePagesDomain({
  status: 'active',
  verification_data: { status: 'active' },
  validation_data: { status: 'active' },
}, { matched: false }).domainStatus, 'verifying');
assert.equal(mapCloudflarePagesDomain({
  status: 'blocked',
  verification_data: { status: 'error', error_message: 'blocked' },
  validation_data: { status: 'pending' },
}, { matched: true }).domainStatus, 'failed');

assert.deepEqual([1, 2, 3, 4, 5, 6, 7].map(pageDomainRetryDelayMinutes), [5, 15, 30, 60, 180, 360, 360]);

for (const token of [
  "redirect: 'error'",
  "Authorization: `Bearer ${readiness.apiToken}`",
  'CLOUDFLARE_API_ORIGIN',
  'CLOUDFLARE_API_PATH_PREFIX',
  'INLET_DNS_JSON_RESOLVER_ALLOWED_ENDPOINTS',
]) {
  assert(providerSource.includes(token), `provider hardening missing: ${token}`);
}
assert(providerSource.indexOf('...optionHeaders') < providerSource.indexOf('Authorization: `Bearer ${readiness.apiToken}`'), 'provider Authorization must override caller-supplied headers');
for (const token of [
  'hostname_key = ?',
  'assertD1PageBelongsToProject',
  'DOMAIN_PROJECT_MISMATCH',
  'DOMAIN_HOSTNAME_MISMATCH',
  'disconnectD1PageDomain',
]) {
  assert(storeSource.includes(token), `domain store contract missing: ${token}`);
}
assert(!storeSource.includes('UPDATE pages SET page_json'), 'provider state must not bypass normal page revision writes');
assert(!storeSource.includes('mirrorPageJsonDomainState'), 'provider state must remain canonical in page_domains only');
for (const token of [
  'DOMAIN_PROVIDER_CLEANUP_REQUIRED',
  'deleteCloudflarePagesDomain',
  'ensureCloudflarePagesDomain',
  'inspectCustomDomainDns',
  '5, 15, 30, 60, 180, 360',
]) {
  assert(operationsSource.includes(token), `domain operation contract missing: ${token}`);
}
for (const source of [checkRoute, manageRoute]) {
  assert(source.includes('authorizeProject(request, env, project'), 'domain API must use existing project authorization');
  assert(source.includes('assertD1(env)'), 'domain API must require D1');
}
assert(checkRoute.includes('assertD1PageBelongsToProject'), 'domain check must verify page/project binding server-side');
assert(manageRoute.includes('assertOwnedD1PageDomain'), 'domain mutation must verify canonical ownership server-side');
assert(manageRoute.includes("['verify', 'detach']"), 'domain mutation action allowlist must stay narrow');
assert(migrationSource.includes('idx_page_domains_hostname_owner'), 'provider layer requires canonical ownership migration');

console.log(JSON.stringify({
  ok: true,
  provider: 'cloudflare_pages',
  dnsResolver: 'allowlisted DoH only',
  cloudflareRedirects: 'blocked',
  providerAuthorization: 'server-owned',
  providerState: 'page_domains canonical; page_json revision-isolated',
  actions: ['check', 'verify', 'detach'],
  retryMinutes: [5, 15, 30, 60, 180, 360],
  protectedRootChanged: false,
}, null, 2));
