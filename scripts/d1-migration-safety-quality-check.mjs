import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  evaluateSafetyGate,
  listsMatchExactly,
  normalizeMigrationList,
} from './d1-migration-safety-runner.mjs';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

assert.deepEqual(normalizeMigrationList('0001_a.sql, 0002_b.sql,0001_a.sql'), ['0001_a.sql', '0002_b.sql']);
assert.equal(listsMatchExactly(['0001.sql', '0002.sql'], ['0001.sql', '0002.sql']), true);
assert.equal(listsMatchExactly(['0002.sql', '0001.sql'], ['0001.sql', '0002.sql']), false);

const safeGate = evaluateSafetyGate({
  mode: 'backup-and-apply',
  branch: 'main',
  writeEnabled: true,
  approval: 'I_APPROVE_D1_MIGRATIONS',
  pending: ['0006_page_domains.sql', '0007_page_domain_operations.sql'],
  expectedPending: ['0006_page_domains.sql', '0007_page_domain_operations.sql'],
  encryptionSecret: 'x'.repeat(32),
  liveConfigured: true,
});
assert.equal(safeGate.ok, true, safeGate.errors.join('; '));

for (const [name, patch, expectedMessage] of [
  ['branch', { branch: 'agent/test' }, 'main branch'],
  ['write switch', { writeEnabled: false }, 'INLET_D1_MIGRATION_WRITE=1'],
  ['approval', { approval: 'wrong' }, 'I_APPROVE_D1_MIGRATIONS'],
  ['expected list', { expectedPending: ['0006_page_domains.sql'] }, 'exactly match'],
  ['encryption', { encryptionSecret: 'short' }, 'at least 32'],
]) {
  const gate = evaluateSafetyGate({
    mode: 'backup-and-apply',
    branch: 'main',
    writeEnabled: true,
    approval: 'I_APPROVE_D1_MIGRATIONS',
    pending: ['0006_page_domains.sql', '0007_page_domain_operations.sql'],
    expectedPending: ['0006_page_domains.sql', '0007_page_domain_operations.sql'],
    encryptionSecret: 'x'.repeat(32),
    liveConfigured: true,
    ...patch,
  });
  assert.equal(gate.ok, false, `${name} guard should fail`);
  assert.ok(gate.errors.some((message) => message.includes(expectedMessage)), `${name} guard message missing`);
}

const entrypoint = await read('scripts/d1-migration-safety.mjs');
const script = await read('scripts/d1-migration-safety-runner.mjs');
const workflow = await read('.github/workflows/d1-migration-safety.yml');
const runbook = await read('docs/ops-d1-migration-safety.md');
const packageSource = await read('package.json');
const qaAll = await read('scripts/qa-all.mjs');

for (const token of [
  "INLET_D1_MIGRATION_MODE || 'preflight'",
  'INLET_D1_MIGRATION_EXPECTED_PENDING',
  "INLET_D1_MIGRATION_WRITE === '1'",
  'I_APPROVE_D1_MIGRATIONS',
  'PAGERO_D1_BACKUP_ENCRYPTION_KEY',
  'remote pending migrations do not exactly match the approved list',
  "['d1', 'export'",
  "'--skip-confirmation'",
  "['d1', 'migrations', 'apply'",
  "['d1', 'time-travel', 'info'",
  'aes-256-cbc',
  'pbkdf2-sha256-200000',
  'encryptedHmacSha256',
  'plaintextUploaded: false',
  "await rm(plainPath, { force: true })",
  "status: 'skipped-live'",
  "status: ok ? 'verified-live' : 'failed-live'",
]) {
  assert.ok(script.includes(token), `migration safety runner missing ${token}`);
}

assert.ok(script.indexOf("['d1', 'export'") < script.indexOf("['d1', 'migrations', 'apply'"), 'backup export must be defined before migration apply');
assert.ok(!script.includes("['d1', 'time-travel', 'restore'"), 'production restore must never execute automatically');
assert.ok(!script.includes("'--json'"), 'Time Travel info must use the supported text command contract');
assert.ok(!script.includes("'--yes'"), 'D1 export must use --skip-confirmation, not unsupported --yes');
assert.ok(!script.includes('console.log(encryptionSecret)'), 'encryption secret must not be logged');
assert.ok(!script.includes('console.log(apiToken)'), 'Cloudflare token must not be logged');
assert.ok(entrypoint.includes("'d1-migration-safety-runner.mjs'"), 'entrypoint must delegate to final runner');
assert.ok(entrypoint.includes("stdio: 'inherit'"), 'entrypoint must preserve workflow output and exit code');

for (const token of [
  'workflow_dispatch:',
  'backup-and-apply',
  'allow_writes',
  'expected_pending',
  'approval_phrase',
  'PAGERO_D1_BACKUP_ENCRYPTION_KEY',
  'CLOUDFLARE_ACCOUNT_ID',
  'CLOUDFLARE_API_TOKEN',
  "INLET_D1_MIGRATION_WRITE: ${{ inputs.allow_writes == true && '1' || '0' }}",
  'node scripts/d1-migration-safety.mjs',
  'd1-migration-safety-${{ github.run_id }}',
  '.tmp-d1-migration-safety/*.enc',
  '.tmp-d1-migration-safety/*.manifest.json',
  '.tmp-d1-migration-safety/*.rollback.txt',
  'retention-days: 30',
]) {
  assert.ok(workflow.includes(token), `D1 migration workflow missing ${token}`);
}
assert.ok(!workflow.includes('schedule:'), 'D1 migration workflow must not run on a schedule');
assert.ok(!workflow.includes('push:'), 'D1 migration workflow must not run on push');
assert.ok(!workflow.includes('pull_request:'), 'D1 migration workflow must not run on pull request');
assert.ok(!workflow.includes('.tmp-d1-migration-safety/*.sql\n'), 'plaintext SQL must not be uploaded');
assert.ok(!workflow.includes('set -x'), 'workflow must not enable command tracing');

for (const token of [
  'Encrypted backup only',
  'Exact pending migration list',
  'I_APPROVE_D1_MIGRATIONS',
  'PAGERO_D1_BACKUP_ENCRYPTION_KEY',
  'Time Travel',
  'separate owner approval',
  'Never import the export directly into production',
]) {
  assert.ok(runbook.includes(token), `D1 migration runbook missing ${token}`);
}

assert.ok(packageSource.includes('node scripts/d1-migration-safety.mjs'), 'package script must execute stable D1 migration entrypoint');
assert.ok(packageSource.includes('d1:migration:safety:qa'), 'package script d1:migration:safety:qa missing');
assert.ok(qaAll.includes("['d1:migration:safety:qa'"), 'qa:all registration missing D1 migration safety QA');

console.log(JSON.stringify({
  ok: true,
  checks: 41,
  contracts: [
    'manual-only-workflow',
    'stable-entrypoint-delegation',
    'main-branch-write-gate',
    'exact-pending-list',
    'official-wrangler-command-contract',
    'encrypted-export-only',
    'plaintext-cleanup',
    'time-travel-evidence',
    'no-automatic-restore',
    'secret-redaction',
  ],
}, null, 2));
