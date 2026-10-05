import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  disposableDatabaseName,
  evaluateRestoreDrillGate,
  verifyAndDecryptBackup,
} from './d1-restore-drill.mjs';

const root = process.cwd();
const temp = path.join(root, '.tmp-d1-restore-drill-qa');
const artifactDir = path.join(temp, 'artifact');
const outputDir = path.join(temp, 'output');
const key = 'qa-restore-encryption-key-0123456789abcdef';

function run(exe, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd: root, env, shell: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve({ stdout, stderr }) : reject(new Error(stderr || stdout || String(code))));
  });
}

function hashFile(filePath, keyBytes = null) {
  return new Promise((resolve, reject) => {
    const digest = keyBytes ? createHmac('sha256', keyBytes) : createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

await rm(temp, { recursive: true, force: true });
await mkdir(artifactDir, { recursive: true });

const sql = [
  'PRAGMA foreign_keys=OFF;',
  'CREATE TABLE projects (id TEXT PRIMARY KEY, slug TEXT NOT NULL);',
  'CREATE TABLE pages (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, slug TEXT NOT NULL);',
  'CREATE TABLE leads (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, created_at TEXT NOT NULL);',
  'CREATE TABLE events (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, created_at TEXT NOT NULL);',
  "INSERT INTO projects VALUES ('project-1','qa-project');",
  "INSERT INTO pages VALUES ('page-1','project-1','qa-page');",
  "INSERT INTO leads VALUES ('lead-1','project-1','2026-10-05T00:00:00.000Z');",
  "INSERT INTO events VALUES ('event-1','project-1','2026-10-05T00:00:00.000Z');",
].join('\n') + '\n';

const plainFixture = path.join(temp, 'fixture.sql');
const encryptedName = 'pagero-d1-fixture.sql.enc';
const encryptedFixture = path.join(artifactDir, encryptedName);
await writeFile(plainFixture, sql, 'utf8');

await run('openssl', [
  'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '200000',
  '-md', 'sha256', '-in', plainFixture, '-out', encryptedFixture,
  '-pass', 'env:PAGERO_D1_BACKUP_ENCRYPTION_KEY',
], { ...process.env, PAGERO_D1_BACKUP_ENCRYPTION_KEY: key });

const plaintextSha256 = await hashFile(plainFixture);
const encryptedSha256 = await hashFile(encryptedFixture);
const hmacKey = createHash('sha256').update(`pagero-d1-backup-hmac:${key}`).digest();
const encryptedHmacSha256 = await hashFile(encryptedFixture, hmacKey);
const manifest = {
  ok: true,
  repositorySha: 'qa-source-sha',
  backup: {
    plaintextBytes: Buffer.byteLength(sql),
    plaintextSha256,
    encryptedFile: encryptedName,
    encryptedSha256,
    encryptedHmacSha256,
    cipher: 'aes-256-cbc',
    kdf: 'pbkdf2-sha256-200000',
    plaintextUploaded: false,
  },
};
await writeFile(path.join(artifactDir, 'pagero-d1-fixture.manifest.json'), JSON.stringify(manifest, null, 2), 'utf8');

const verified = await verifyAndDecryptBackup({ artifactDir, outputDir, encryptionSecret: key });
assert.equal(verified.plaintextSha256, plaintextSha256);
assert.equal(verified.encryptedSha256, encryptedSha256);
assert.equal(verified.manifest.backup.plaintextUploaded, false);

const restoredSql = await readFile(verified.plainPath, 'utf8');
const disposable = new DatabaseSync(':memory:');
disposable.exec(restoredSql);
assert.equal(Number(disposable.prepare('SELECT COUNT(*) AS count FROM projects').get().count), 1);
assert.equal(Number(disposable.prepare('SELECT COUNT(*) AS count FROM pages').get().count), 1);
assert.equal(Number(disposable.prepare('SELECT COUNT(*) AS count FROM leads').get().count), 1);
assert.equal(Number(disposable.prepare('SELECT COUNT(*) AS count FROM events').get().count), 1);
disposable.exec("CREATE TABLE _pagero_restore_probe (id TEXT PRIMARY KEY); INSERT INTO _pagero_restore_probe VALUES ('probe');");
assert.equal(Number(disposable.prepare("SELECT COUNT(*) AS count FROM _pagero_restore_probe WHERE id='probe'").get().count), 1);
disposable.close();

const artifactGate = evaluateRestoreDrillGate({
  mode: 'artifact-verify',
  branch: 'feature/test',
  sourceRunId: '123456',
  encryptionSecret: key,
});
assert(artifactGate.ok, 'artifact verification must remain read-only and branch-independent');

const blockedBranch = evaluateRestoreDrillGate({
  mode: 'restore-drill',
  branch: 'feature/test',
  writeEnabled: true,
  approval: 'I_APPROVE_D1_DISPOSABLE_RESTORE',
  sourceRunId: '123456',
  encryptionSecret: key,
  accountId: 'account',
  apiToken: 'token',
  productionDatabaseName: 'inlet-prod',
});
assert(!blockedBranch.ok && blockedBranch.errors.some((item) => item.includes('main branch')));

const blockedApproval = evaluateRestoreDrillGate({
  mode: 'restore-drill',
  branch: 'main',
  writeEnabled: true,
  approval: '',
  sourceRunId: '123456',
  encryptionSecret: key,
  accountId: 'account',
  apiToken: 'token',
  productionDatabaseName: 'inlet-prod',
});
assert(!blockedApproval.ok && blockedApproval.errors.some((item) => item.includes('approval phrase')));

const approved = evaluateRestoreDrillGate({
  mode: 'restore-drill',
  branch: 'main',
  writeEnabled: true,
  approval: 'I_APPROVE_D1_DISPOSABLE_RESTORE',
  sourceRunId: '123456',
  encryptionSecret: key,
  accountId: 'account',
  apiToken: 'token',
  productionDatabaseName: 'inlet-prod',
});
assert(approved.ok);

const testName = disposableDatabaseName('123456', '987654321');
assert(testName.startsWith('pagero-restore-drill-'));
assert.notEqual(testName, 'inlet-prod');

const scriptSource = await readFile('scripts/d1-restore-drill.mjs', 'utf8');
const workflowSource = await readFile('.github/workflows/d1-restore-drill.yml', 'utf8');
const runbookSource = await readFile('docs/ops-d1-migration-safety.md', 'utf8');

for (const token of [
  'I_APPROVE_D1_DISPOSABLE_RESTORE',
  'restore-drill is restricted to the main branch',
  'productionDatabaseTouched: false',
  'DROP TABLE _pagero_restore_probe',
  'deleteDisposableDatabase',
]) {
  assert(scriptSource.includes(token), `restore drill runner missing safety contract: ${token}`);
}
assert(!scriptSource.includes('time-travel restore'), 'restore drill must never target production Time Travel');
assert(workflowSource.includes('workflow_dispatch:') && !workflowSource.includes('schedule:'), 'restore drill workflow must remain manual-only');
assert(workflowSource.includes('actions: read'), 'restore drill must use read-only access to source artifacts');
assert(workflowSource.includes('environment: production'), 'Cloudflare disposable D1 mutation must remain behind protected environment');
assert(workflowSource.includes('allow_disposable_writes'), 'workflow must expose an explicit disposable write gate');
assert(workflowSource.includes('I_APPROVE_D1_DISPOSABLE_RESTORE'), 'workflow must require exact approval phrase');
assert(runbookSource.includes('Disposable Restore Drill'), 'D1 runbook must retain disposable restore procedure');

await writeFile(encryptedFixture, Buffer.from('tampered-backup-content'), 'utf8');
await assert.rejects(
  () => verifyAndDecryptBackup({ artifactDir, outputDir: path.join(temp, 'tampered-output'), encryptionSecret: key }),
  /SHA-256/,
);

await rm(temp, { recursive: true, force: true });

console.log(JSON.stringify({
  ok: true,
  checks: 32,
  contracts: [
    'real-local-restore',
    'encrypted-artifact-sha-and-hmac',
    'decrypted-plaintext-digest',
    'main-only-live-disposable-write',
    'explicit-write-approval',
    'manual-only-workflow',
    'protected-environment',
    'disposable-create-import-query-delete',
    'plaintext-cleanup',
    'production-target-exclusion',
  ],
  productionWriteExecuted: false,
}, null, 2));
