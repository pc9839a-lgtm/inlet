import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { onRequest as routeDomainRequest } from '../functions/_middleware.js';
import {
  applyPageDomainConfig,
  normalizeDomainHostname,
  normalizePageDomainConfig,
  pageDomainIssues,
  pagePublicUrl,
} from '../src/lib/pageDomains.js';
import {
  cloudflarePagesDomainReadiness,
  ensureCloudflarePagesDomain,
  inspectCustomDomainDns,
  mapCloudflarePagesDomain,
} from '../server/cloudflarePagesDomains.mjs';
import {
  assertD1PageDomainAvailable,
  disconnectD1PageDomain,
  prepareD1PageDomainSave,
  syncD1PageDomain,
  updateD1PageDomainVerification,
} from '../server/pageDomainStore.mjs';

function fakeResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() {
      return payload;
    },
  };
}

function fakeDb(domainSeed = [], pageSeed = []) {
  const rows = domainSeed.map((row) => ({ ...row }));
  const pages = pageSeed.map((row) => ({ ...row }));
  return {
    rows,
    pages,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes('SELECT page_json FROM pages')) {
                return pages.find((row) => row.id === values[0]) || null;
              }
              if (sql.includes('WHERE page_id = ?')) {
                return rows.find((row) => row.page_id === values[0]) || null;
              }
              if (sql.includes('WHERE hostname = ?')) {
                return rows.find((row) => row.hostname === values[0] && row.status !== 'disconnected') || null;
              }
              throw new Error(`Unexpected domain query: ${sql}`);
            },
            async run() {
              if (sql.includes('UPDATE pages SET page_json = ?')) {
                const page = pages.find((candidate) => candidate.id === values[1]);
                if (page) page.page_json = values[0];
                return { success: true };
              }
              if (sql.includes('UPDATE page_domains') && sql.includes('provider_domain_id = ?')) {
                const row = rows.find((candidate) => candidate.page_id === values[15]);
                if (row) {
                  [
                    row.status,
                    row.ssl_status,
                    row.failure_reason,
                    row.provider,
                    row.provider_domain_id,
                    row.provider_status,
                    row.verification_status,
                    row.validation_status,
                    row.validation_method,
                    row.validation_name,
                    row.validation_value,
                    row.last_checked_at,
                    row.last_provider_sync_at,
                    row.connected_at,
                    row.updated_at,
                  ] = values.slice(0, 15);
                  row.disconnected_at = null;
                }
                return { success: true };
              }
              if (sql.includes('UPDATE page_domains') && sql.includes('provider_status = ?')) {
                const row = rows.find((candidate) => candidate.page_id === values[6]);
                if (row) {
                  row.status = 'disconnected';
                  row.ssl_status = 'not_applicable';
                  row.failure_reason = values[0];
                  row.provider_status = values[1];
                  row.verification_status = '';
                  row.validation_status = '';
                  row.last_checked_at = values[2];
                  row.last_provider_sync_at = values[3];
                  row.disconnected_at = values[4];
                  row.updated_at = values[5];
                }
                return { success: true };
              }
              if (sql.includes('UPDATE page_domains') && sql.includes("status = 'disconnected'")) {
                const row = rows.find((candidate) => candidate.page_id === values[2]);
                if (row) {
                  row.status = 'disconnected';
                  row.ssl_status = 'not_applicable';
                  row.failure_reason = '';
                  row.disconnected_at = values[0];
                  row.updated_at = values[1];
                }
                return { success: true };
              }
              if (sql.includes('INSERT INTO page_domains')) {
                const [
                  id,
                  projectId,
                  pageId,
                  hostname,
                  status,
                  sslStatus,
                  failureReason,
                  verificationHash,
                  provider,
                  providerDomainId,
                  providerStatus,
                  verificationStatus,
                  validationStatus,
                  validationMethod,
                  validationName,
                  validationValue,
                  lastCheckedAt,
                  lastProviderSyncAt,
                  connectedAt,
                  createdAt,
                  updatedAt,
                ] = values;
                const existing = rows.find((candidate) => candidate.page_id === pageId);
                const next = {
                  id,
                  project_id: projectId,
                  page_id: pageId,
                  hostname,
                  domain_type: 'custom',
                  status,
                  ssl_status: sslStatus,
                  failure_reason: failureReason,
                  verification_token_hash: verificationHash,
                  provider,
                  provider_domain_id: providerDomainId,
                  provider_status: providerStatus,
                  verification_status: verificationStatus,
                  validation_status: validationStatus,
                  validation_method: validationMethod,
                  validation_name: validationName,
                  validation_value: validationValue,
                  last_checked_at: lastCheckedAt,
                  last_provider_sync_at: lastProviderSyncAt,
                  connected_at: connectedAt,
                  disconnected_at: null,
                  created_at: createdAt,
                  updated_at: updatedAt,
                };
                if (existing) Object.assign(existing, next);
                else rows.push(next);
                return { success: true };
              }
              throw new Error(`Unexpected domain mutation: ${sql}`);
            },
          };
        },
      };
    },
  };
}

assert.equal(normalizeDomainHostname('HTTPS://WWW.Example.com/path'), 'www.example.com');
assert.equal(normalizeDomainHostname('shop.example.com.'), 'shop.example.com');
assert.deepEqual(pageDomainIssues({ domainType: 'custom', customDomain: 'shop.example.com' }), []);
assert.match(pageDomainIssues({ domainType: 'custom', customDomain: 'https://shop.example.com/path' })[0], /경로/);
assert.match(pageDomainIssues({ domainType: 'custom', customDomain: 'pagero.kr' })[0], /페이지로 운영 도메인/);
assert.match(pageDomainIssues({ domainType: 'custom', customDomain: '127.0.0.1' })[0], /IP 주소/);

const pending = applyPageDomainConfig({ slug: 'sample' }, {
  domainType: 'custom',
  customDomain: 'WWW.Example.com',
  domainStatus: 'active',
});
assert.equal(pending.customDomain, 'www.example.com');
assert.equal(pending.url.customDomain, 'www.example.com');
assert.equal(pagePublicUrl(pending), 'https://www.example.com');
assert.equal(pagePublicUrl({ slug: 'sample', domainType: 'default' }), 'https://pagero.kr/sample');
assert.equal(normalizePageDomainConfig({ domainType: 'custom', domainStatus: 'pending_dns', customDomain: 'a.example.com' }).domainStatus, 'pending');

const providerEnv = {
  INLET_CLOUDFLARE_ACCOUNT_ID: 'account-1',
  INLET_CLOUDFLARE_PAGES_PROJECT: 'inlet',
  INLET_CLOUDFLARE_API_TOKEN: 'test-token',
  INLET_CUSTOM_DOMAIN_CNAME_TARGET: 'inlet.pages.dev',
};
assert.equal(cloudflarePagesDomainReadiness(providerEnv).configured, true);
assert.deepEqual(cloudflarePagesDomainReadiness({}).missing, [
  'INLET_CLOUDFLARE_ACCOUNT_ID',
  'INLET_CLOUDFLARE_PAGES_PROJECT',
  'INLET_CLOUDFLARE_API_TOKEN',
  'INLET_CUSTOM_DOMAIN_CNAME_TARGET',
]);

const providerCalls = [];
const providerResult = await ensureCloudflarePagesDomain(providerEnv, 'shop.example.com', async (url, options = {}) => {
  providerCalls.push({ url, method: options.method });
  if (options.method === 'GET') return fakeResponse(404, { success: false, errors: [] });
  return fakeResponse(200, {
    success: true,
    result: {
      id: 'provider-domain-1',
      domain_id: 'provider-domain-1',
      name: 'shop.example.com',
      status: 'active',
      verification_data: { status: 'active' },
      validation_data: { status: 'active', method: 'txt' },
    },
  });
});
assert.equal(providerResult.domain_id, 'provider-domain-1');
assert.equal(providerCalls.length, 2);
assert.match(providerCalls[1].url, /\/accounts\/account-1\/pages\/projects\/inlet\/domains$/);

const dns = await inspectCustomDomainDns(providerEnv, 'shop.example.com', async () => fakeResponse(200, {
  Status: 0,
  Answer: [{ name: 'shop.example.com.', type: 5, data: 'inlet.pages.dev.' }],
}));
assert.equal(dns.matched, true);
const mapped = mapCloudflarePagesDomain(providerResult, dns);
assert.equal(mapped.domainStatus, 'active');
assert.equal(mapped.sslStatus, 'active');
assert.equal(mapCloudflarePagesDomain(providerResult, { configured: true, matched: false }).domainStatus, 'active');

let pageroNextCalled = false;
const pageroResponse = await routeDomainRequest({
  request: new Request('https://pagero.kr/assets/app.js'),
  env: {},
  next: async () => {
    pageroNextCalled = true;
    return new Response('pagero-next');
  },
});
assert.equal(pageroNextCalled, true);
assert.equal(await pageroResponse.text(), 'pagero-next');

let customNextCalled = false;
const customResponse = await routeDomainRequest({
  request: new Request('https://shop.example.com/'),
  env: {
    DB: {
      prepare(sql) {
        assert.match(sql, /page_domains\.status = 'active'/);
        assert.match(sql, /page_domains\.ssl_status = 'active'/);
        return {
          bind(hostname) {
            assert.equal(hostname, 'shop.example.com');
            return {
              async first() {
                return { slug: 'sample-page', page_id: 'page-b', project_id: 'project-b' };
              },
            };
          },
        };
      },
    },
    ASSETS: {
      async fetch() {
        return new Response('<!doctype html><html><head><script type="module" src="/assets/app.js"></script></head><body><div id="root"></div></body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      },
    },
  },
  next: async () => {
    customNextCalled = true;
    return new Response('unexpected-next');
  },
});
assert.equal(customNextCalled, false);
assert.equal(customResponse.status, 200);
assert.equal(customResponse.headers.get('X-Inlet-Custom-Domain'), 'shop.example.com');
assert.equal(customResponse.headers.get('X-Inlet-Custom-Page'), 'sample-page');
const customHtml = await customResponse.text();
assert.match(customHtml, /__INLET_CUSTOM_DOMAIN_SLUG__="sample-page"/);
assert.match(customHtml, /public-landing-shell/);
const injectedBoot = customHtml.match(/<script>(window\.__INLET_CUSTOM_DOMAIN_SLUG__[\s\S]*?)<\/script>/)?.[1] || '';
assert.ok(injectedBoot);
assert.doesNotThrow(() => new Function(injectedBoot));

const missingCustomResponse = await routeDomainRequest({
  request: new Request('https://missing.example.com/'),
  env: {
    DB: {
      prepare() {
        return { bind: () => ({ first: async () => null }) };
      },
    },
  },
  next: async () => new Response('unexpected-next'),
});
assert.equal(missingCustomResponse.status, 404);
assert.match(await missingCustomResponse.text(), /도메인 연결을 확인/);

const db = fakeDb([
  {
    id: 'domain-a',
    project_id: 'project-a',
    page_id: 'page-a',
    hostname: 'owned.example.com',
    status: 'active',
    ssl_status: 'active',
    failure_reason: '',
    verification_token_hash: '',
    provider: 'cloudflare_pages',
    provider_domain_id: 'provider-a',
    provider_status: 'active',
    verification_status: 'active',
    validation_status: 'active',
    validation_method: 'txt',
    validation_name: '',
    validation_value: '',
    last_checked_at: '2026-08-01T00:00:00.000Z',
    last_provider_sync_at: '2026-08-01T00:00:00.000Z',
    connected_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
  },
], [
  {
    id: 'page-b',
    page_json: JSON.stringify({
      id: 'page-b',
      projectId: 'project-b',
      slug: 'sample',
      domainType: 'custom',
      customDomain: 'new.example.com',
      domainStatus: 'pending',
      sslStatus: 'pending',
    }),
  },
]);

await assert.rejects(
  () => assertD1PageDomainAvailable(db, 'owned.example.com', 'page-b'),
  (error) => error?.status === 409 && error?.details?.code === 'DOMAIN_ALREADY_CONNECTED',
);

const preparedNew = await prepareD1PageDomainSave(db, {
  id: 'page-b',
  projectId: 'project-b',
  slug: 'sample',
  domainType: 'custom',
  customDomain: 'new.example.com',
  domainStatus: 'active',
  sslStatus: 'active',
}, { pageId: 'page-b', projectId: 'project-b' });
assert.equal(preparedNew.domainStatus, 'pending', 'client must not forge an active domain state');
assert.equal(preparedNew.sslStatus, 'pending', 'client must not forge active SSL');

await syncD1PageDomain(db, preparedNew, { pageId: 'page-b', projectId: 'project-b' });
assert.equal(db.rows.find((row) => row.page_id === 'page-b')?.hostname, 'new.example.com');

await updateD1PageDomainVerification(db, 'page-b', {
  ...mapped,
  checkedAt: '2026-08-01T01:00:00.000Z',
  providerSyncedAt: '2026-08-01T01:00:00.000Z',
});
assert.equal(db.rows.find((row) => row.page_id === 'page-b')?.status, 'active');
assert.equal(JSON.parse(db.pages[0].page_json).domainStatus, 'active');

await disconnectD1PageDomain(db, 'page-b');
assert.equal(db.rows.find((row) => row.page_id === 'page-b')?.status, 'disconnected');
assert.equal(JSON.parse(db.pages[0].page_json).domainType, 'default');

const [migration, checkEndpoint, manageEndpoint, middleware, providerModule, pageRoute, panel, section, hookFile, qaAll, packageJson] = await Promise.all([
  readFile('migrations/0006_page_domains.sql', 'utf8'),
  readFile('functions/api/domains/check.js', 'utf8'),
  readFile('functions/api/domains/manage.js', 'utf8'),
  readFile('functions/_middleware.js', 'utf8'),
  readFile('server/cloudflarePagesDomains.mjs', 'utf8'),
  readFile('functions/api/pages/[slug].js', 'utf8'),
  readFile('src/panels/SettingsPanel.jsx', 'utf8'),
  readFile('src/panels/settings/PageDomainSettingsSection.jsx', 'utf8'),
  readFile('src/panels/settings/usePageDomainSettings.js', 'utf8'),
  readFile('scripts/qa-all.mjs', 'utf8'),
  readFile('package.json', 'utf8'),
]);

for (const token of [
  'CREATE TABLE IF NOT EXISTS page_domains',
  'UNIQUE(page_id)',
  'idx_page_domains_hostname_owner',
  "status <> 'disconnected'",
  'ssl_status',
  'provider_domain_id',
  'validation_status',
  'idx_page_domains_provider_status',
]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(checkEndpoint, /assertD1PageDomainAvailable/);
assert.match(checkEndpoint, /INLET_CUSTOM_DOMAIN_CNAME_TARGET/);
assert.match(manageEndpoint, /ensureCloudflarePagesDomain/);
assert.match(manageEndpoint, /deleteCloudflarePagesDomain/);
assert.match(manageEndpoint, /masterOnly: true/);
assert.match(middleware, /INNER JOIN page_domains|FROM page_domains/);
assert.match(middleware, /X-Inlet-Custom-Domain/);
assert.match(middleware, /__INLET_CUSTOM_DOMAIN_SLUG__/);
assert.match(providerModule, /api\.cloudflare\.com\/client\/v4/);
assert.match(providerModule, /INLET_CLOUDFLARE_ACCOUNT_ID/);
assert.match(providerModule, /INLET_CLOUDFLARE_PAGES_PROJECT/);
assert.match(providerModule, /INLET_CLOUDFLARE_API_TOKEN/);
assert.match(pageRoute, /prepareD1PageDomainSave/);
assert.match(pageRoute, /syncD1PageDomain/);
assert.match(pageRoute, /DOMAIN_ALREADY_CONNECTED/);
assert.match(panel, /usePageDomainSettings/);
assert.match(section, /연결 상태 확인/);
assert.match(section, /DNS 연결/);
assert.match(hookFile, /postJson\('\/api\/domains\/manage'/);
assert.match(hookFile, /domainRequest\('detach'/);
assert.match(qaAll, /page:domain:qa/);
assert.match(packageJson, /"page:domain:qa"/);

console.log(JSON.stringify({
  ok: true,
  policy: 'cloudflare-pages-domain-provider-and-host-routing',
  statuses: ['pending', 'verifying', 'active', 'failed', 'disconnected'],
  provider: 'cloudflare_pages',
}, null, 2));
