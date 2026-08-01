import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  applyPageDomainConfig,
  normalizeDomainHostname,
  normalizePageDomainConfig,
  pageDomainIssues,
  pagePublicUrl,
} from '../src/lib/pageDomains.js';
import {
  assertD1PageDomainAvailable,
  prepareD1PageDomainSave,
  syncD1PageDomain,
} from '../server/pageDomainStore.mjs';

function fakeDb(seed = []) {
  const rows = seed.map((row) => ({ ...row }));
  return {
    rows,
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes('WHERE page_id = ?')) {
                return rows.find((row) => row.page_id === values[0]) || null;
              }
              if (sql.includes('WHERE hostname = ?')) {
                return rows.find((row) => row.hostname === values[0] && row.status !== 'disconnected') || null;
              }
              throw new Error(`Unexpected domain query: ${sql}`);
            },
            async run() {
              if (sql.includes('UPDATE page_domains') && sql.includes("status = 'disconnected'")) {
                const row = rows.find((candidate) => candidate.page_id === values[2]);
                if (row) {
                  row.status = 'disconnected';
                  row.ssl_status = 'not_applicable';
                  row.disconnected_at = values[0];
                  row.updated_at = values[1];
                }
                return { success: true };
              }
              if (sql.includes('INSERT INTO page_domains')) {
                const [id, projectId, pageId, hostname, status, sslStatus, failureReason, verificationHash, lastCheckedAt, connectedAt, createdAt, updatedAt] = values;
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
                  last_checked_at: lastCheckedAt,
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
    last_checked_at: '2026-08-01T00:00:00.000Z',
    connected_at: '2026-08-01T00:00:00.000Z',
    created_at: '2026-08-01T00:00:00.000Z',
    updated_at: '2026-08-01T00:00:00.000Z',
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

await syncD1PageDomain(db, {
  ...preparedNew,
  domainType: 'default',
  customDomain: '',
  domainStatus: 'ready',
  sslStatus: 'not_applicable',
}, { pageId: 'page-b', projectId: 'project-b' });
assert.equal(db.rows.find((row) => row.page_id === 'page-b')?.status, 'disconnected');

const [migration, endpoint, pageRoute, panel, section, hook, qaAll, packageJson] = await Promise.all([
  readFile('migrations/0006_page_domains.sql', 'utf8'),
  readFile('functions/api/domains/check.js', 'utf8'),
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
]) assert.match(migration, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

assert.match(endpoint, /assertD1PageDomainAvailable/);
assert.match(endpoint, /INLET_CUSTOM_DOMAIN_CNAME_TARGET/);
assert.match(pageRoute, /prepareD1PageDomainSave/);
assert.match(pageRoute, /syncD1PageDomain/);
assert.match(pageRoute, /DOMAIN_ALREADY_CONNECTED/);
assert.match(panel, /usePageDomainSettings/);
assert.match(section, /페이지 도메인/);
assert.match(section, /개인 도메인/);
assert.match(hook, /postJson\('\/api\/domains\/check'/);
assert.match(qaAll, /page:domain:qa/);
assert.match(packageJson, /"page:domain:qa"/);

console.log(JSON.stringify({
  ok: true,
  policy: 'unique-custom-domain-server-enforced',
  statuses: ['pending', 'verifying', 'active', 'failed', 'disconnected'],
}, null, 2));
