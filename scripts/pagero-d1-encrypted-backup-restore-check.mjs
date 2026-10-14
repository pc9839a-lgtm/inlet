// Owner-approved verification of a real encrypted D1 export in isolated local SQLite.
// Never connects to Cloudflare D1, uploads plaintext, or imports into production.
import assert from 'node:assert/strict';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { chmod, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const WORKSPACE = path.resolve('.tmp-pagero-d1-restore-verify');
const APPROVAL = 'I_APPROVE_PAGERO_D1_OFFLINE_RESTORE';
const MAX_SQL_BYTES = 256 * 1024 * 1024;
const REQUIRED_TABLES = ['accounts', 'projects', 'pages', 'leads'];

export function evaluateRestoreGate({ event = '', branch = '', approval = '', sourceRun = '', secret = '' } = {}) {
  const errors = [];
  if (event !== 'workflow_dispatch') errors.push('manual-dispatch-required');
  if (branch !== 'main') errors.push('main-branch-required');
  if (approval !== APPROVAL) errors.push('explicit-offline-restore-approval-required');
  if (!/^[1-9][0-9]{0,17}$/.test(String(sourceRun))) errors.push('valid-backup-run-id-required');
  if (String(secret).length < 32) errors.push('backup-encryption-key-missing');
  return { ok: errors.length === 0, errors };
}

async function digestFile(filePath, key) {
  const digest = key ? createHmac('sha256', key) : createHash('sha256');
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (buf) => digest.update(buf));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}
function sameDigest(actual, expected) {
  if (!/^[a-f0-9]{64}$/i.test(String(expected || ''))) return false;
  return timingSafeEqual(Buffer.from(String(actual), 'hex'), Buffer.from(String(expected), 'hex'));
}
export function inspectRestoredDatabase(db) {
  const integrity = String(db.prepare('PRAGMA integrity_check').get()?.integrity_check || '');
  assert.equal(integrity, 'ok', 'restored SQL fails SQLite integrity_check');
  const foreignKeyViolations = db.prepare('PRAGMA foreign_key_check').all();
  assert.equal(foreignKeyViolations.length, 0, 'restored SQL has foreign key violations');
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all()
    .map((r) => String(r.name || ''));
  for (const name of REQUIRED_TABLES) assert(tables.includes(name), `required restored table is missing: ${name}`);
  const recordCounts = {};
  for (const table of REQUIRED_TABLES) {
    const row = db.prepare(`SELECT COUNT(*) AS n FROM "${table}"`).get();
    recordCounts[table] = Number(row?.n || 0);
  }
  return {
    integrityOk: true,
    foreignKeysOk: true,
    restoredTables: tables.length,
    recordCounts,
  };
}

async function main() {
  const runId = String(process.env.PAGERO_D1_RESTORE_SOURCE_RUN_ID || '').trim();
  const secret = String(process.env.PAGERO_D1_BACKUP_ENCRYPTION_KEY || '');
  const gate = evaluateRestoreGate({
    event: process.env.GITHUB_EVENT_NAME || '',
    branch: process.env.GITHUB_REF_NAME || '',
    approval: process.env.PAGERO_D1_RESTORE_APPROVAL || '',
    sourceRun: runId,
    secret,
  });
  if (!gate.ok) throw new Error(gate.errors.join(','));
  const artifacts = path.join(WORKSPACE, 'artifact');
  const files = await readdir(artifacts);
  const candidates = files.filter((name) => /^pagero-d1-[0-9]{14}\.manifest\.json$/.test(name));
  if (candidates.length !== 1) throw new Error('expected-exactly-one-real-backup-manifest');
  const manifest = JSON.parse(await readFile(path.join(artifacts, candidates[0]), 'utf8'));
  const backup = manifest?.backup;
  if (!backup || !manifest.ok || !/^pagero-d1-[0-9]{14}\.sql\.enc$/.test(String(backup.encryptedFile || ''))) {
    throw new Error('unverified-or-invalid-encrypted-export-manifest');
  }
  if (backup.cipher !== 'aes-256-cbc' || backup.kdf !== 'pbkdf2-sha256-200000' || backup.plaintextUploaded !== false) {
    throw new Error('unexpected-or-unprotected-backup-format');
  }
  if (manifest?.migrationApply?.attempted === true) throw new Error('migration-apply-artifact-requires-separate-review');
  const encryptedPath = path.join(artifacts, backup.encryptedFile);
  const encryptedInfo = await stat(encryptedPath);
  if (!encryptedInfo.isFile() || encryptedInfo.size < 64 || encryptedInfo.size !== Number(backup.encryptedBytes)) {
    throw new Error('encrypted-backup-size-mismatch');
  }
  const plainSize = Number(backup.plaintextBytes);
  if (!Number.isSafeInteger(plainSize) || plainSize <= 0 || plainSize > MAX_SQL_BYTES) {
    throw new Error('backup-too-large-for-bounded-in-memory-restore');
  }
  const cipherHash = await digestFile(encryptedPath);
  if (!sameDigest(cipherHash, backup.encryptedSha256)) throw new Error('encrypted-backup-sha256-mismatch');
  const hmacKey = createHash('sha256').update(`pagero-d1-backup-hmac:${secret}`).digest();
  const hmac = await digestFile(encryptedPath, hmacKey);
  if (!sameDigest(hmac, backup.encryptedHmacSha256)) throw new Error('encrypted-backup-authentication-failed');

  await mkdir(WORKSPACE, { recursive: true, mode: 0o700 });
  const temp = path.join(WORKSPACE, `plaintext-${process.pid}.sql`);
  try {
    const decrypted = spawnSync('openssl', [
      'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000', '-md', 'sha256',
      '-in', encryptedPath, '-out', temp, '-pass', 'env:PAGERO_D1_BACKUP_ENCRYPTION_KEY',
    ], {
      env: { ...process.env, PAGERO_D1_BACKUP_ENCRYPTION_KEY: secret },
      encoding: 'utf8',
      maxBuffer: 1024 * 1024,
    });
    if (decrypted.error || decrypted.status !== 0) throw new Error('encrypted-backup-decryption-failed');
    await chmod(temp, 0o600);
    const fileInfo = await stat(temp);
    if (fileInfo.size !== plainSize || !sameDigest(await digestFile(temp), backup.plaintextSha256)) {
      throw new Error('decrypted-plaintext-size-or-sha256-mismatch');
    }
    const sql = await readFile(temp, 'utf8');
    // D1 uses SQLite, but a local SQLite round trip is NOT a remote disposable D1 restore.
    const db = new DatabaseSync(':memory:');
    let checks;
    try {
      db.exec(sql);
      checks = inspectRestoredDatabase(db);
    } finally {
      db.close();
    }
    const report = {
      ok: true,
      scope: 'pagero-d1-encrypted-backup-offline-restore',
      restoreMode: 'ephemeral-local-sqlite',
      sourceRunId: runId,
      encryptedSha256Verified: true,
      encryptedHmacVerified: true,
      plaintextSha256Verified: true,
      ...checks,
      productionD1Writes: false,
      remoteDisposableD1Restore: 'not-run',
      secretValuesIncluded: false,
    };
    await writeFile(path.join(WORKSPACE, 'pagero-d1-restore-evidence.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await rm(temp, { force: true });
  }
}
const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invoked === import.meta.url) {
  main().catch((error) => {
    // Avoid printing any SQL, decrypted data, tokens, paths, or OpenSSL stderr.
    console.error(JSON.stringify({
      ok: false,
      scope: 'pagero-d1-encrypted-backup-offline-restore',
      reason: String(error?.message || 'restore-verification-failed').slice(0, 120),
      secretValuesIncluded: false,
    }));
    process.exitCode = 1;
  });
}
