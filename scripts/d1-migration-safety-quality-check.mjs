import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  evaluatePreApplyConsistency,
  evaluateSafetyGate,
  listsMatchExactly,
  normalizeMigrationList,
} from './d1-migration-safety-runner.mjs';
import {
  classifyD1AccessFailure,
  resolveD1Target,
} from './d1-cloudflare-access-preflight.mjs';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');
const pending = ['0010_alpha.sql', '0011_beta.sql'];

assert.deepEqual(
  normalizeMigrationList('0010_alpha.sql, 0011_beta.sql,0010_alpha.sql'),
  pending,
);
assert.equal(listsMatchExactly(pending, pending), true);
assert.equal(listsMatchExactly([...pending].reverse(), pending), false);

const declaredD1 = {
  d1_databases: [{ binding: 'DB', database_name: 'inlet-prod', database_id: 'b68d3820-001f-4dbe-87cd-dc9fc0be17ee' }],
};
const resolvedFromWrangler = resolveD1Target({ env: {}, config: declaredD1 });
assert.equal(resolvedFromWrangler.ok, true);
assert.equal(resolvedFromWrangler.databaseName, 'inlet-prod');
assert.equal(resolvedFromWrangler.nameSource, 'wrangler.jsonc');
assert.equal(resolvedFromWrangler.idSource, 'wrangler.jsonc');

const matchingOverride = resolveD1Target({
  env: {
    PAGERO_D1_DATABASE_NAME: 'inlet-prod',
    PAGERO_D1_DATABASE_ID: 'b68d3820-001f-4dbe-87cd-dc9fc0be17ee',
  },
  config: declaredD1,
});
assert.equal(matchingOverride.ok, true);
assert.equal(matchingOverride.nameSource, 'environment');
assert.equal(matchingOverride.idSource, 'environment');

const staleOverride = resolveD1Target({
  env: { PAGERO_D1_DATABASE_ID: '00000000-0000-0000-0000-000000000000' },
  config: declaredD1,
});
assert.equal(staleOverride.ok, false);
assert.ok(staleOverride.errors.some((message) => message.includes('does not match wrangler.jsonc')));

const accountMismatch = classifyD1AccessFailure({
  status: 403,
  errors: [{ code: 7403, message: 'not authorized' }],
});
assert.equal(accountMismatch.code, 'CLOUDFLARE_D1_ACCOUNT_OR_PERMISSION_MISMATCH');
assert.ok(accountMismatch.message.includes('D1 Read permission'));

const safeGate = evaluateSafetyGate({
  mode: 'backup-and-apply',
  branch: 'main',
  writeEnabled: true,
  approval: 'I_APPROVE_D1_MIGRATIONS',
  pending,
  expectedPending: pending,
  encryptionSecret: 'x'.repeat(32),
  liveConfigured: true,
});
assert.equal(safeGate.ok, true, safeGate.errors.join('; '));

for (const [name, patch, expectedMessage] of [
  ['branch', { branch: 'agent/test' }, 'main branch'],
  ['write switch', { writeEnabled: false }, 'INLET_D1_MIGRATION_WRITE=1'],
  ['approval', { approval: 'wrong' }, 'I_APPROVE_D1_MIGRATIONS'],
  ['expected list', { expectedPending: ['0010_alpha.sql'] }, 'exactly match'],
  ['encryption', { encryptionSecret: 'short' }, 'at least 32'],
  ['credentials', { liveConfigured: false }, 'Cloudflare live credentials'],
]) {
  const gate = evaluateSafetyGate({
    mode: 'backup-and-apply',
    branch: 'main',
    writeEnabled: true,
    approval: 'I_APPROVE_D1_MIGRATIONS',
    pending,
    expectedPending: pending,
    encryptionSecret: 'x'.repeat(32),
    liveConfigured: true,
    ...patch,
  });
  assert.equal(gate.ok, false, `${name} guard should fail`);
  assert.ok(
    gate.errors.some((message) => message.includes(expectedMessage)),
    `${name} guard message missing`,
  );
}

const safeConsistency = evaluatePreApplyConsistency({
  appliedBefore: ['0001_core.sql'],
  appliedImmediatelyBeforeApply: ['0001_core.sql'],
  pendingImmediatelyBeforeApply: pending,
  expectedPending: pending,
  historyAvailable: true,
});
assert.equal(safeConsistency.ok, true, safeConsistency.errors.join('; '));

for (const [name, patch, expectedMessage] of [
  [
    'history changed after backup',
    { appliedImmediatelyBeforeApply: ['0001_core.sql', '0009_external.sql'] },
    'history changed after backup',
  ],
  [
    'pending changed after backup',
    { pendingImmediatelyBeforeApply: ['0011_beta.sql'] },
    'pending migrations changed after backup',
  ],
  [
    'history table disappeared',
    { historyAvailable: false },
    'history table is unavailable immediately before apply',
  ],
]) {
  const consistency = evaluatePreApplyConsistency({
    appliedBefore: ['0001_core.sql'],
    appliedImmediatelyBeforeApply: ['0001_core.sql'],
    pendingImmediatelyBeforeApply: pending,
    expectedPending: pending,
    historyAvailable: true,
    ...patch,
  });
  assert.equal(consistency.ok, false, `${name} guard should fail`);
  assert.ok(
    consistency.errors.some((message) => message.includes(expectedMessage)),
    `${name} guard message missing`,
  );
}

const entrypoint = await read('scripts/d1-migration-safety.mjs');
const accessScript = await read('scripts/d1-cloudflare-access-preflight.mjs');
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
  'evaluatePreApplyConsistency',
  'remote migration history changed after backup; apply aborted',
  'remote pending migrations changed after backup; apply aborted',
  'immediatelyBeforeApply = await remoteMigrationState',
  'pendingMigrationsImmediatelyBeforeApply',
  'attempted: false',
  "'d1', 'export'",
  "'--skip-confirmation'",
  "'d1', 'migrations', 'apply'",
  "'d1', 'time-travel', 'info'",
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

for (const token of [
  '/user/tokens/verify',
  '/d1/database/',
  "redirect: 'error'",
  'D1_CONFIG_OVERRIDE_MISMATCH',
  'CLOUDFLARE_D1_ACCOUNT_OR_PERMISSION_MISMATCH',
  'D1 Read permission',
  'databaseNameSource',
  'databaseIdSource',
  'd1-cloudflare-access-preflight.json',
]) {
  assert.ok(accessScript.includes(token), `D1 access preflight missing ${token}`);
}

assert.ok(
  script.indexOf("'d1', 'export'") < script.indexOf("'d1', 'migrations', 'apply'"),
  'backup export must be defined before migration apply',
);
assert.ok(
  script.indexOf('immediatelyBeforeApply = await remoteMigrationState')
    < script.indexOf('await applyMigrations(config.databaseName)'),
  'remote migration state must be rechecked immediately before apply',
);
assert.ok(
  !script.includes("'d1', 'time-travel', 'restore'"),
  'production restore must never execute automatically',
);
assert.ok(!script.includes("'--yes'"), 'D1 export must use --skip-confirmation');
assert.ok(!script.includes('console.log(encryptionSecret)'), 'encryption secret must not be logged');
assert.ok(!script.includes('console.log(apiToken)'), 'Cloudflare token must not be logged');
assert.ok(!accessScript.includes('console.log(apiToken)'), 'access preflight must not log Cloudflare token');
assert.ok(entrypoint.includes("'d1-cloudflare-access-preflight.mjs'"));
assert.ok(entrypoint.includes("'d1-migration-safety-runner.mjs'"));
assert.ok(
  entrypoint.indexOf('runScript(accessPreflight)') < entrypoint.indexOf('runScript(runner)'),
  'Cloudflare access preflight must run before migration inspection',
);

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
  '.tmp-d1-migration-safety/d1-cloudflare-access-preflight.json',
  '.tmp-d1-migration-safety/*.rollback.txt',
  'retention-days: 30',
]) {
  assert.ok(workflow.includes(token), `D1 migration workflow missing ${token}`);
}
assert.ok(!workflow.includes('schedule:'), 'workflow must not run on schedule');
assert.ok(!workflow.includes('push:'), 'workflow must not run on push');
assert.ok(!workflow.includes('pull_request:'), 'workflow must not run on pull request');
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
  'disposable D1 database',
]) {
  assert.ok(runbook.includes(token), `D1 migration runbook missing ${token}`);
}

assert.ok(packageSource.includes('node scripts/d1-migration-safety.mjs'));
assert.ok(packageSource.includes('d1:migration:safety:qa'));
assert.ok(qaAll.includes("['d1:migration:safety:qa'"));

console.log(JSON.stringify({
  ok: true,
  checks: 70,
  contracts: [
    'manual-only-workflow',
    'cloudflare-token-verify-first',
    'account-d1-access-before-migration-query',
    'wrangler-target-fallback',
    'stale-d1-override-block',
    '7403-actionable-classification',
    'main-branch-write-gate',
    'exact-pending-list',
    'post-backup-pre-apply-consistency-gate',
    'encrypted-export-only',
    'plaintext-cleanup',
    'time-travel-evidence',
    'no-automatic-restore',
    'secret-redaction',
    'landing-product-only-scope',
  ],
}, null, 2));
