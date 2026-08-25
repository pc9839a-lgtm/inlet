import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

const audit = await read('scripts/d1-baseline-audit.mjs');
const entrypoint = await read('scripts/d1-migration-safety.mjs');
const workflow = await read('.github/workflows/d1-migration-safety.yml');
const packageSource = await read('package.json');
const qaAll = await read('scripts/qa-all.mjs');

for (const token of [
  'MAX_BASELINE_PREFIX = 9',
  'sqlite_schema',
  'PRAGMA table_info',
  'migrationHistoryAvailable',
  'missingTables',
  'missingColumns',
  'incompatibleColumns',
  'missingIndexes',
  'incompatibleIndexes',
  "status: audit.migrationHistoryAvailable ? 'history-present-baseline-not-needed'",
  "'baseline-compatible'",
  "'baseline-incompatible'",
  'automaticBaselineWritePerformed: false',
  'readOnly: true',
  'secretValuesIncluded: false',
  'Do not write migration history or apply 0010-0013',
]) {
  assert.ok(audit.includes(token), `baseline audit missing ${token}`);
}

for (const forbidden of [
  "d1Query(live, 'INSERT",
  'd1Query(live, `INSERT',
  "d1Query(live, 'UPDATE",
  'd1Query(live, `UPDATE',
  "d1Query(live, 'DELETE",
  'd1Query(live, `DELETE',
  "d1Query(live, 'DROP",
  'd1Query(live, `DROP',
  "d1Query(live, 'ALTER",
  'd1Query(live, `ALTER',
  "d1Query(live, 'CREATE",
  'd1Query(live, `CREATE',
]) {
  assert.ok(!audit.includes(forbidden), `baseline audit must not execute write SQL: ${forbidden}`);
}

assert.ok(entrypoint.includes("const baselineAudit = path.join(root, 'scripts', 'd1-baseline-audit.mjs')"));
assert.ok(entrypoint.includes("if (mode !== 'preflight')"), 'baseline audit must be restricted to preflight mode');
assert.ok(entrypoint.indexOf('const runnerCode = await run(runner)') < entrypoint.indexOf('const auditCode = await run(baselineAudit)'));
assert.ok(workflow.includes('.tmp-d1-migration-safety/d1-baseline-audit.json'));
assert.ok(!workflow.includes('push:'), 'D1 workflow must remain manual-only');
assert.ok(!workflow.includes('pull_request:'), 'D1 workflow must remain manual-only');
assert.ok(packageSource.includes('d1:baseline:audit:qa'));
assert.ok(qaAll.includes("['d1:baseline:audit:qa'"));

console.log(JSON.stringify({
  ok: true,
  checks: 34,
  contracts: [
    'read-only-schema-query',
    '0001-through-0009-baseline-scope',
    'table-column-index-audit',
    'no-automatic-baseline-write',
    'preflight-only-integration',
    'manual-only-production-workflow',
    'secret-redaction',
  ],
}, null, 2));
