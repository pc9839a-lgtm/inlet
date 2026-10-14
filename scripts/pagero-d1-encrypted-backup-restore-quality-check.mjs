import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import {
  evaluateRestoreGate,
  inspectRestoredDatabase,
} from './pagero-d1-encrypted-backup-restore-check.mjs';

const gate = {
  event: 'workflow_dispatch',
  branch: 'main',
  approval: 'I_APPROVE_PAGERO_D1_OFFLINE_RESTORE',
  sourceRun: '123456789',
  secret: 'x'.repeat(32),
};
assert.equal(evaluateRestoreGate(gate).ok, true);
for (const [label, changes] of [
  ['wrong event', { event: 'push' }],
  ['wrong branch', { branch: 'feature' }],
  ['wrong approval', { approval: 'wrong' }],
  ['no source run', { sourceRun: '' }],
  ['bad source run', { sourceRun: '../backup' }],
  ['missing key', { secret: 'short' }],
]) {
  assert.equal(evaluateRestoreGate({ ...gate, ...changes }).ok, false, label);
}
const sql = [
  'CREATE TABLE accounts (id TEXT PRIMARY KEY);',
  'CREATE TABLE projects (id TEXT PRIMARY KEY);',
  'CREATE TABLE pages (id TEXT PRIMARY KEY);',
  'CREATE TABLE leads (id TEXT PRIMARY KEY);',
  "INSERT INTO accounts VALUES ('example-user');",
  "INSERT INTO projects VALUES ('example-project');",
  "INSERT INTO pages VALUES ('example-page');",
  "INSERT INTO leads VALUES ('example-lead');",
].join('\n');
const db = new DatabaseSync(':memory:');
try {
  db.exec(sql);
  const info = inspectRestoredDatabase(db);
  assert(info.integrityOk && info.foreignKeysOk);
  assert.equal(info.recordCounts.accounts, 1);
  assert.equal(info.recordCounts.pages, 1);
  assert.equal(info.restoredTables, 4);
} finally { db.close(); }
const missing = new DatabaseSync(':memory:');
try {
  missing.exec('CREATE TABLE accounts(id TEXT PRIMARY KEY);');
  assert.throws(() => inspectRestoredDatabase(missing), /required restored table is missing/);
} finally { missing.close(); }
const [script, workflow, backupWorkflow] = await Promise.all([
  readFile('scripts/pagero-d1-encrypted-backup-restore-check.mjs', 'utf8'),
  readFile('.github/workflows/pagero-d1-offline-restore-verify.yml', 'utf8'),
  readFile('.github/workflows/d1-migration-safety.yml', 'utf8'),
]);
for (const token of [
  'encryptedHmacSha256', 'encryptedSha256', 'plaintextSha256',
  "manifest.mode !== 'backup-only'", "manifest.encryptedBackupOnly !== true",
  "'openssl'", "'-d'", "'-pbkdf2'", 'timingSafeEqual',
  "new DatabaseSync(':memory:')", "PRAGMA foreign_key_check",
  "PRAGMA integrity_check", 'await rm(temp, { force: true })',
  "remoteDisposableD1Restore: 'not-run'", 'productionD1Writes: false',
]) assert(script.includes(token), `missing offline encrypted-restoration guard ${token}`);
assert(workflow.includes('workflow_dispatch:') && !workflow.includes('\n  schedule:') && !workflow.includes('\n  push:'), 'must only run on explicit dispatch');
assert(workflow.includes('environment: production'), 'sensitive access requires production environment');
assert(workflow.includes('actions: read'), 'read permissions needed to retrieve prior backup');
assert(workflow.includes('d1-migration-safety-$SOURCE_RUN_ID'), 'must fetch exact prior backup artifact');
assert(workflow.includes('I_APPROVE_PAGERO_D1_OFFLINE_RESTORE'), 'must request manual restore approval');
assert(workflow.includes('pagero-d1-restore-evidence.json') && workflow.includes('rm -rf .tmp-pagero-d1-restore-verify'), 'only counts-only evidence survives');
assert(backupWorkflow.includes('backup-only'), 'original encrypted backup workflow must exist');
assert(!script.includes("'d1', 'execute'") && !script.includes('wrangler d1 execute'), 'offline verification must never write to Cloudflare D1');

console.log(JSON.stringify({ ok: true, check: 'pagero-d1-encrypted-backup-offline-restore', productionWrites: false }));
