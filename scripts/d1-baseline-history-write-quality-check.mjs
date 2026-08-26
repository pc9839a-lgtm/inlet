import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const read = (relativePath) => readFile(path.join(root, relativePath), 'utf8');

const writer = await read('scripts/d1-baseline-history-write.mjs');
const entrypoint = await read('scripts/d1-migration-safety.mjs');
const workflow = await read('.github/workflows/d1-migration-safety.yml');

for (const token of [
  "const APPROVAL = 'I_APPROVE_D1_BASELINE_0001_0009'",
  "const REQUIRED_BRANCH = 'main'",
  "'0001_inlet_core.sql'",
  "'0009_unified_billing_referral.sql'",
  "'0010_calltag_universal_lead_intake.sql'",
  "'0013_calltag_meta_oauth.sql'",
  "audit?.status !== 'baseline-compatible'",
  "audit?.migrationHistoryAvailable !== false",
  "SELECT name FROM sqlite_schema WHERE type='table' AND name='d1_migrations'",
  'preWriteBookmark = await currentBookmark(live)',
  'CREATE TABLE d1_migrations(',
  'id INTEGER PRIMARY KEY AUTOINCREMENT',
  'name TEXT UNIQUE',
  'applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL',
  'INSERT INTO d1_migrations (name)',
  "['d1', 'execute', config.databaseName, '--remote', '--file', SQL_FILE, '--yes']",
  "SELECT id, name, applied_at FROM d1_migrations ORDER BY id ASC",
  'postWriteBookmark = await currentBookmark(live)',
  "status: 'baseline-history-recorded'",
  'historyWritePerformed: true',
  'schemaReplayPerformed: false',
  'migrationApplyPerformed: false',
  'rollbackRequiresSeparateApproval: true',
  'secretValuesIncluded: false',
  'await rm(SQL_FILE, { force: true })',
]) {
  assert.ok(writer.includes(token), `baseline history writer missing ${token}`);
}

assert.ok(
  writer.indexOf("const audit = JSON.parse(await readFile(AUDIT_FILE, 'utf8'))")
    < writer.indexOf('preWriteBookmark = await currentBookmark(live)'),
  'fresh baseline audit must be checked before bookmark/write',
);
assert.ok(
  writer.indexOf('preWriteBookmark = await currentBookmark(live)')
    < writer.indexOf("await runWrangler(['d1', 'execute'"),
  'Time Travel bookmark must be captured before write',
);
assert.ok(
  writer.indexOf("await runWrangler(['d1', 'execute'")
    < writer.indexOf("SELECT id, name, applied_at FROM d1_migrations ORDER BY id ASC"),
  'history must be verified after write',
);
assert.ok(!writer.includes("'d1', 'migrations', 'apply'"), 'baseline writer must never apply migrations');
assert.ok(!writer.includes('time-travel restore'), 'baseline writer must never restore automatically');
assert.ok(!writer.includes('DROP TABLE'), 'baseline writer must not auto-drop history');

for (const token of [
  "const baselineWriter = path.join(root, 'scripts', 'd1-baseline-history-write.mjs')",
  "const BASELINE_APPROVAL = 'I_APPROVE_D1_BASELINE_0001_0009'",
  "const auditCode = await run(baselineAudit)",
  "const writeEnabled = process.env.INLET_D1_MIGRATION_WRITE === '1'",
  'approval !== BASELINE_APPROVAL',
  'const writeCode = await run(baselineWriter)',
]) {
  assert.ok(entrypoint.includes(token), `D1 entrypoint missing baseline write guard ${token}`);
}
assert.ok(
  entrypoint.indexOf('const auditCode = await run(baselineAudit)')
    < entrypoint.indexOf('const writeCode = await run(baselineWriter)'),
  'baseline audit must pass before writer can run',
);

for (const token of [
  'I_APPROVE_D1_BASELINE_0001_0009',
  '.tmp-d1-migration-safety/d1-baseline-history-write.json',
  'include-hidden-files: true',
]) {
  assert.ok(workflow.includes(token), `workflow missing baseline history contract ${token}`);
}
assert.ok(!workflow.includes('schedule:'), 'baseline write must remain manual-only');
assert.ok(!workflow.includes('push:'), 'baseline write must remain manual-only');
assert.ok(!workflow.includes('pull_request:'), 'baseline write must remain manual-only');

console.log(JSON.stringify({
  ok: true,
  checks: 43,
  contracts: [
    'explicit-baseline-approval',
    'main-only-write',
    'fresh-read-only-audit-before-write',
    'pre-write-time-travel-bookmark',
    'wrangler-compatible-d1-migrations-schema',
    'history-only-no-schema-replay',
    'exact-0010-through-0013-post-pending',
    'no-automatic-restore',
  ],
}, null, 2));
