import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  listD1PageDomainsDueForRecheck,
  listD1PageDomainsForOperator,
  nextPageDomainRetryAt,
  pageDomainRetryDelayMinutes,
  updateD1PageDomainOperationState,
} from '../server/pageDomainOperationsStore.mjs';
import {
  classifyPageDomainProviderError,
  pageDomainRetryDecision,
} from '../server/pageDomainOperations.mjs';

assert.deepEqual(
  [1, 2, 3, 4, 5, 6, 12].map(pageDomainRetryDelayMinutes),
  [5, 15, 30, 60, 180, 360, 360],
  'domain retry delay must use bounded exponential backoff',
);
assert.equal(
  nextPageDomainRetryAt(2, '2026-08-01T00:00:00.000Z'),
  '2026-08-01T00:15:00.000Z',
);

assert.equal(classifyPageDomainProviderError({ code: 'DOMAIN_PROVIDER_TIMEOUT' }).retryable, true);
assert.equal(classifyPageDomainProviderError({ code: 'DOMAIN_PROVIDER_UNREACHABLE' }).retryable, true);
assert.equal(classifyPageDomainProviderError({ code: 'DOMAIN_PROVIDER_REQUEST_FAILED', details: { providerStatus: 429 } }).retryable, true);
assert.equal(classifyPageDomainProviderError({ code: 'DOMAIN_PROVIDER_REQUEST_FAILED', details: { providerStatus: 503 } }).retryable, true);
assert.equal(classifyPageDomainProviderError({ code: 'DOMAIN_PROVIDER_REQUEST_FAILED', details: { providerStatus: 403 } }).retryable, false);

const retryDecision = pageDomainRetryDecision({
  retry_count: 1,
  created_at: '2026-08-01T00:00:00.000Z',
}, {
  retryable: true,
  maxRetries: 8,
}, '2026-08-01T01:00:00.000Z');
assert.equal(retryDecision.retryCount, 2);
assert.equal(retryDecision.nextRetryAt, '2026-08-01T01:15:00.000Z');
assert.equal(retryDecision.terminal, false);

const agedDecision = pageDomainRetryDecision({
  retry_count: 1,
  created_at: '2026-07-30T00:00:00.000Z',
}, {
  retryable: true,
  maxRetries: 8,
}, '2026-08-01T01:00:00.000Z');
assert.equal(agedDecision.escalated, true, 'unresolved domains older than 24 hours must escalate');

const terminalDecision = pageDomainRetryDecision({ retry_count: 7 }, {
  retryable: true,
  maxRetries: 8,
}, '2026-08-01T01:00:00.000Z');
assert.equal(terminalDecision.retryCount, 8);
assert.equal(terminalDecision.nextRetryAt, '');
assert.equal(terminalDecision.terminal, true);
assert.equal(terminalDecision.escalated, true);

function operationDb(seed = {}) {
  const row = { ...seed };
  let lastSql = '';
  let lastValues = [];
  return {
    row,
    get lastSql() { return lastSql; },
    get lastValues() { return lastValues; },
    prepare(sql) {
      return {
        bind(...values) {
          return {
            async first() {
              if (sql.includes('WHERE page_id = ?')) return row;
              throw new Error(`Unexpected first query: ${sql}`);
            },
            async run() {
              lastSql = sql;
              lastValues = values;
              if (sql.includes('SET retry_count = ?')) {
                row.retry_count = values[0];
                row.next_retry_at = values[1];
                row.last_error_code = values[2];
                row.escalated_at = values[3];
                row.last_attempt_at = values[4];
                row.updated_at = values[5];
              }
              return { success: true };
            },
          };
        },
      };
    },
  };
}

const opDb = operationDb({
  page_id: 'page-ops',
  retry_count: 1,
  next_retry_at: null,
  last_error_code: '',
  escalated_at: null,
  last_attempt_at: null,
});
await updateD1PageDomainOperationState(opDb, 'page-ops', {
  incrementRetry: true,
  nextRetryAt: '2026-08-01T01:15:00.000Z',
  lastErrorCode: 'DOMAIN_PROVIDER_TIMEOUT',
  lastAttemptAt: '2026-08-01T01:00:00.000Z',
  escalate: true,
  at: '2026-08-01T01:00:00.000Z',
});
assert.match(opDb.lastSql, /retry_count = \?/);
assert.equal(opDb.row.retry_count, 2);
assert.equal(opDb.row.last_error_code, 'DOMAIN_PROVIDER_TIMEOUT');
assert.equal(opDb.row.escalated_at, '2026-08-01T01:00:00.000Z');

function listDb(results = []) {
  let sql = '';
  let values = [];
  return {
    get sql() { return sql; },
    get values() { return values; },
    prepare(nextSql) {
      sql = nextSql;
      return {
        bind(...nextValues) {
          values = nextValues;
          return { async all() { return { results }; } };
        },
      };
    },
  };
}

const operatorDb = listDb([{
  id: 'domain-ops',
  page_id: 'page-ops',
  project_id: 'project-ops',
  hostname: 'ops.example.com',
  status: 'failed',
  ssl_status: 'failed',
  retry_count: 3,
  next_retry_at: '2026-08-01T01:15:00.000Z',
  escalated_at: '2026-08-01T01:00:00.000Z',
  project_slug: 'ops-page',
  project_title: 'Ops Page',
  owner_email: 'owner@example.com',
}]);
const operatorRows = await listD1PageDomainsForOperator(operatorDb, {
  status: 'failed',
  query: 'ops',
  staleMinutes: 60,
  limit: 100,
  now: '2026-08-01T02:00:00.000Z',
});
assert.match(operatorDb.sql, /accounts\.email AS owner_email/);
assert.match(operatorDb.sql, /page_domains\.escalated_at/);
assert.equal(operatorRows[0].ownerEmail, 'owner@example.com');
assert.equal(operatorRows[0].requiresAttention, true);

const dueDb = listDb([{
  page_id: 'page-due',
  hostname: 'due.example.com',
  status: 'verifying',
  retry_count: 2,
  next_retry_at: '2026-08-01T01:00:00.000Z',
}]);
const dueRows = await listD1PageDomainsDueForRecheck(dueDb, {
  now: '2026-08-01T02:00:00.000Z',
  limit: 20,
  maxRetries: 8,
});
assert.match(dueDb.sql, /status IN \('pending', 'verifying', 'failed'\)/);
assert.match(dueDb.sql, /retry_count < \?/);
assert.equal(dueRows.length, 1);

const [
  migration,
  adminEndpoint,
  schedulerEndpoint,
  workflow,
  runbook,
  packageJson,
  qaAll,
  envExample,
] = await Promise.all([
  readFile('migrations/0007_page_domain_operations.sql', 'utf8'),
  readFile('functions/api/admin/domains.js', 'utf8'),
  readFile('functions/api/admin/domains/recheck.js', 'utf8'),
  readFile('.github/workflows/domain-recheck.yml', 'utf8'),
  readFile('docs/ops-custom-domain-runbook.md', 'utf8'),
  readFile('package.json', 'utf8'),
  readFile('scripts/qa-all.mjs', 'utf8'),
  readFile('.env.example', 'utf8'),
]);

for (const token of [
  'retry_count INTEGER NOT NULL DEFAULT 0',
  'next_retry_at TEXT',
  "last_error_code TEXT NOT NULL DEFAULT ''",
  'escalated_at TEXT',
  'last_attempt_at TEXT',
  'idx_page_domains_retry_due',
  'idx_page_domains_escalated',
  'trg_page_domains_reset_ops_on_reconnect',
]) {
  assert(migration.includes(token), `operations migration missing ${token}`);
}

for (const token of [
  'listD1PageDomainsForOperator',
  'assertPlatformMaster',
  'staleMinutes',
  'requiresAttention',
  "source: 'operator_manual'",
]) {
  assert(adminEndpoint.includes(token), `operator endpoint missing ${token}`);
}
for (const token of [
  'INLET_DOMAIN_RECHECK_SECRET',
  'crypto.subtle.digest',
  'listD1PageDomainsDueForRecheck',
  "source: 'scheduled_recheck'",
  'INLET_DOMAIN_RECHECK_BATCH_SIZE',
]) {
  assert(schedulerEndpoint.includes(token), `scheduler endpoint missing ${token}`);
}
for (const token of [
  "cron: '*/15 * * * *'",
  'PAGERO_DOMAIN_RECHECK_SECRET',
  'skipped-live',
  '/api/admin/domains/recheck',
]) {
  assert(workflow.includes(token), `domain recheck workflow missing ${token}`);
}
for (const token of [
  'Implementation Tasks',
  'Operator Domain List',
  'Triage Procedure',
  'Detach And Reconnect',
  'Rollback',
  'Live-Only Checks',
]) {
  assert(runbook.includes(token), `custom-domain runbook missing ${token}`);
}
for (const token of [
  'INLET_CLOUDFLARE_ACCOUNT_ID',
  'INLET_CLOUDFLARE_PAGES_PROJECT',
  'INLET_CLOUDFLARE_API_TOKEN',
  'INLET_CUSTOM_DOMAIN_CNAME_TARGET',
  'INLET_DOMAIN_RECHECK_SECRET',
  'INLET_DOMAIN_RECHECK_BATCH_SIZE',
  'INLET_DOMAIN_RECHECK_MAX_RETRIES',
]) {
  assert(envExample.includes(token), `.env.example missing ${token}`);
}
assert(packageJson.includes('"page:domain:ops:qa"'), 'package.json missing page:domain:ops:qa');
assert(qaAll.includes("['page:domain:ops:qa', ['scripts/page-domain-operations-quality-check.mjs']]"), 'qa:all missing domain operations QA');

console.log(JSON.stringify({
  ok: true,
  policy: 'custom-domain-operator-list-scheduled-recheck-retry-escalation',
  retryMinutes: [5, 15, 30, 60, 180, 360],
  operatorEndpoint: '/api/admin/domains',
  schedulerEndpoint: '/api/admin/domains/recheck',
}, null, 2));
