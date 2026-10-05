import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUTPUT_DIR_NAME = '.tmp-d1-restore-drill';
const SOURCE_DIR_NAME = '.tmp-d1-restore-source';
const APPROVAL_PHRASE = 'I_APPROVE_D1_DISPOSABLE_RESTORE';
const MIN_KEY_LENGTH = 32;
const SAFE_TABLES = [
  'accounts',
  'projects',
  'project_members',
  'pages',
  'page_revisions',
  'leads',
  'events',
  'delivery_logs',
  'ai_drafts',
  'audit_logs',
  'd1_migrations',
];

function redact(value = '') {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/(?:token|secret|password|authorization)(["'\s:=]+)[^\s,"'}]+/gi, '$1[redacted]')
    .slice(0, 2000);
}

function resolveWorkspacePath(value, fallback) {
  const target = path.resolve(ROOT, String(value || fallback).trim());
  const relative = path.relative(ROOT, target);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('D1 restore drill paths must remain inside the repository workspace');
  }
  return target;
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

async function run(exe, args, { env = process.env } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: ROOT,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve({ code: 0, stdout, stderr });
        return;
      }
      reject(new Error(`${exe} ${args.join(' ')} failed (${code}): ${redact(stderr || stdout)}`));
    });
  });
}

async function hashFile(filePath, key = null) {
  return new Promise((resolve, reject) => {
    const digest = key ? createHmac('sha256', key) : createHash('sha256');
    const input = createReadStream(filePath);
    input.on('data', (chunk) => digest.update(chunk));
    input.on('error', reject);
    input.on('end', () => resolve(digest.digest('hex')));
  });
}

async function listFilesRecursive(directory) {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await listFilesRecursive(full));
    else if (entry.isFile()) output.push(full);
  }
  return output;
}

export function normalizeRestoreRunId(value = '') {
  const runId = String(value || '').trim();
  if (!/^\d{4,20}$/.test(runId)) throw new Error('backup run id must be a GitHub Actions numeric run id');
  return runId;
}

export function evaluateRestoreDrillGate({
  mode = 'artifact-verify',
  branch = '',
  writeEnabled = false,
  approval = '',
  sourceRunId = '',
  encryptionSecret = '',
  accountId = '',
  apiToken = '',
  productionDatabaseName = '',
} = {}) {
  const errors = [];
  if (!['artifact-verify', 'restore-drill'].includes(mode)) errors.push('unsupported restore drill mode');
  try {
    normalizeRestoreRunId(sourceRunId);
  } catch (error) {
    errors.push(String(error?.message || error));
  }
  if (String(encryptionSecret || '').length < MIN_KEY_LENGTH) {
    errors.push(`backup encryption key must be at least ${MIN_KEY_LENGTH} characters`);
  }

  if (mode === 'restore-drill') {
    if (branch !== 'main') errors.push('disposable D1 restore drill is restricted to the main branch');
    if (!writeEnabled) errors.push('restore drill requires PAGERO_D1_RESTORE_WRITE=1');
    if (approval !== APPROVAL_PHRASE) errors.push(`restore drill requires approval phrase ${APPROVAL_PHRASE}`);
    if (!String(accountId || '').trim() || !String(apiToken || '').trim()) {
      errors.push('Cloudflare account and D1 write token are required');
    }
    if (!String(productionDatabaseName || '').trim()) errors.push('production database name is required for target safety check');
  }

  return { ok: errors.length === 0, errors };
}

export function disposableDatabaseName(sourceRunId, currentRunId = '') {
  const source = normalizeRestoreRunId(sourceRunId);
  const current = String(currentRunId || Date.now()).replace(/\D/g, '').slice(-12) || String(Date.now());
  return `pagero-restore-drill-${source.slice(-10)}-${current}`.slice(0, 62);
}

async function validateSqlExport(filePath) {
  const info = await stat(filePath);
  if (!info.isFile() || info.size < 64) throw new Error('decrypted D1 SQL is missing or too small');
  const sample = (await readFile(filePath, 'utf8')).slice(0, 131072);
  if (!/(?:CREATE\s+TABLE|INSERT\s+INTO|PRAGMA)/i.test(sample)) {
    throw new Error('decrypted D1 SQL does not contain recognizable backup content');
  }
  return { bytes: info.size, sha256: await hashFile(filePath) };
}

export async function verifyAndDecryptBackup({
  artifactDir,
  outputDir,
  encryptionSecret,
} = {}) {
  if (String(encryptionSecret || '').length < MIN_KEY_LENGTH) {
    throw new Error(`backup encryption key must be at least ${MIN_KEY_LENGTH} characters`);
  }
  const files = await listFilesRecursive(artifactDir);
  const manifestFiles = files.filter((file) => file.endsWith('.manifest.json'));
  if (manifestFiles.length !== 1) throw new Error('restore drill requires exactly one backup manifest');

  const manifestPath = manifestFiles[0];
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const encryptedName = String(manifest?.backup?.encryptedFile || '').trim();
  if (!encryptedName || !manifest?.backup?.encryptedSha256 || !manifest?.backup?.encryptedHmacSha256) {
    throw new Error('backup manifest is missing encrypted digest evidence');
  }
  const encryptedMatches = files.filter((file) => path.basename(file) === encryptedName);
  if (encryptedMatches.length !== 1) throw new Error('backup manifest encrypted file is missing or ambiguous');
  const encryptedPath = encryptedMatches[0];

  const encryptedSha256 = await hashFile(encryptedPath);
  if (encryptedSha256 !== manifest.backup.encryptedSha256) {
    throw new Error('encrypted backup SHA-256 does not match manifest');
  }
  const hmacKey = createHash('sha256')
    .update(`pagero-d1-backup-hmac:${encryptionSecret}`)
    .digest();
  const encryptedHmacSha256 = await hashFile(encryptedPath, hmacKey);
  if (encryptedHmacSha256 !== manifest.backup.encryptedHmacSha256) {
    throw new Error('encrypted backup HMAC does not match manifest');
  }

  await mkdir(outputDir, { recursive: true });
  const plainPath = path.join(outputDir, 'pagero-d1-restore.sql');
  const env = { ...process.env, PAGERO_D1_BACKUP_ENCRYPTION_KEY: encryptionSecret };
  await run('openssl', [
    'enc', '-d', '-aes-256-cbc', '-pbkdf2', '-iter', '200000',
    '-md', 'sha256', '-in', encryptedPath, '-out', plainPath,
    '-pass', 'env:PAGERO_D1_BACKUP_ENCRYPTION_KEY',
  ], { env });

  const plain = await validateSqlExport(plainPath);
  if (String(manifest?.backup?.plaintextSha256 || '') && plain.sha256 !== manifest.backup.plaintextSha256) {
    throw new Error('decrypted backup SHA-256 does not match manifest');
  }
  if (Number(manifest?.backup?.plaintextBytes || 0) > 0 && plain.bytes !== Number(manifest.backup.plaintextBytes)) {
    throw new Error('decrypted backup size does not match manifest');
  }

  return {
    manifest,
    manifestPath,
    encryptedPath,
    plainPath,
    encryptedSha256,
    encryptedHmacSha256,
    plaintextSha256: plain.sha256,
    plaintextBytes: plain.bytes,
  };
}

async function cloudflareRequest({ accountId, apiToken }, pathname, options = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(`Cloudflare D1 API failed (${response.status}): ${redact(JSON.stringify(payload.errors || payload.messages || {}))}`);
  }
  return payload;
}

async function createDisposableDatabase(live, name) {
  const payload = await cloudflareRequest(live, '/d1/database', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
  const databaseId = String(payload?.result?.uuid || '').trim();
  if (!databaseId) throw new Error('Cloudflare D1 create response did not include a database UUID');
  return { databaseId, name: String(payload?.result?.name || name) };
}

async function deleteDisposableDatabase(live, databaseId) {
  await cloudflareRequest(live, `/d1/database/${databaseId}`, { method: 'DELETE' });
}

async function d1Query(live, databaseId, sql, params = []) {
  const payload = await cloudflareRequest(live, `/d1/database/${databaseId}/query`, {
    method: 'POST',
    body: JSON.stringify({ sql, params }),
  });
  return Array.isArray(payload?.result?.[0]?.results) ? payload.result[0].results : [];
}

async function writeWranglerRestoreConfig(outputDir, database) {
  const configPath = path.join(outputDir, 'wrangler.restore-drill.json');
  const config = {
    name: 'pagero-d1-restore-drill',
    compatibility_date: '2026-05-27',
    d1_databases: [{
      binding: 'DB',
      database_name: database.name,
      database_id: database.databaseId,
    }],
  };
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return configPath;
}

async function importSqlIntoDisposableD1(database, plainPath, configPath) {
  await run(executable('npx'), [
    'wrangler', 'd1', 'execute', database.name,
    '--remote',
    '--file', plainPath,
    '--config', configPath,
    '--yes',
  ]);
}

async function verifyRestoredDatabase(live, databaseId) {
  const rows = await d1Query(
    live,
    databaseId,
    "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name ASC",
  );
  const tables = rows.map((row) => String(row.name || '')).filter(Boolean);
  if (!tables.length) throw new Error('disposable restore contains no tables');

  const counts = {};
  for (const table of SAFE_TABLES) {
    if (!tables.includes(table)) continue;
    const result = await d1Query(live, databaseId, `SELECT COUNT(*) AS count FROM "${table}"`);
    counts[table] = Number(result?.[0]?.count || 0);
  }

  await d1Query(live, databaseId, 'CREATE TABLE IF NOT EXISTS _pagero_restore_probe (id TEXT PRIMARY KEY, created_at TEXT NOT NULL)');
  await d1Query(live, databaseId, 'INSERT OR REPLACE INTO _pagero_restore_probe (id, created_at) VALUES (?, ?)', ['probe', new Date().toISOString()]);
  const probe = await d1Query(live, databaseId, 'SELECT COUNT(*) AS count FROM _pagero_restore_probe WHERE id = ?', ['probe']);
  await d1Query(live, databaseId, 'DROP TABLE _pagero_restore_probe');
  if (Number(probe?.[0]?.count || 0) !== 1) throw new Error('disposable restore write/read probe failed');

  return {
    tables: tables.filter((name) => !name.startsWith('_cf_') && name !== '_pagero_restore_probe'),
    counts,
    writeReadProbe: true,
  };
}

async function writeEvidence(outputDir, value) {
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, 'd1-restore-drill-evidence.json'), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function main() {
  const mode = String(process.env.INLET_D1_RESTORE_MODE || 'artifact-verify').trim();
  const sourceRunId = String(process.env.PAGERO_D1_RESTORE_SOURCE_RUN_ID || '').trim();
  const branch = String(process.env.GITHUB_REF_NAME || process.env.INLET_GIT_BRANCH || '').trim();
  const writeEnabled = process.env.PAGERO_D1_RESTORE_WRITE === '1';
  const approval = String(process.env.PAGERO_D1_RESTORE_APPROVAL || '');
  const encryptionSecret = String(process.env.PAGERO_D1_BACKUP_ENCRYPTION_KEY || '');
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const productionDatabaseName = String(process.env.PAGERO_D1_DATABASE_NAME || 'inlet-prod').trim();
  const outputDir = resolveWorkspacePath(process.env.PAGERO_D1_RESTORE_OUTPUT_DIR, OUTPUT_DIR_NAME);
  const artifactDir = resolveWorkspacePath(process.env.PAGERO_D1_RESTORE_ARTIFACT_DIR, SOURCE_DIR_NAME);

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const gate = evaluateRestoreDrillGate({
    mode,
    branch,
    writeEnabled,
    approval,
    sourceRunId,
    encryptionSecret,
    accountId,
    apiToken,
    productionDatabaseName,
  });
  if (!gate.ok) throw new Error(gate.errors.join('; '));

  let verified = null;
  let disposable = null;
  let cleanup = { attempted: false, ok: true };
  let evidence = null;

  try {
    verified = await verifyAndDecryptBackup({
      artifactDir,
      outputDir,
      encryptionSecret,
    });

    if (mode === 'artifact-verify') {
      evidence = {
        ok: true,
        status: 'verified-artifact',
        mode,
        sourceRunId,
        sourceRepositorySha: String(verified.manifest?.repositorySha || ''),
        encryptedSha256: verified.encryptedSha256,
        plaintextSha256: verified.plaintextSha256,
        plaintextBytes: verified.plaintextBytes,
        disposableDatabaseCreated: false,
        productionDatabaseTouched: false,
        secretValuesIncluded: false,
      };
      return;
    }

    const databaseName = disposableDatabaseName(sourceRunId, process.env.GITHUB_RUN_ID || '');
    if (databaseName === productionDatabaseName) throw new Error('disposable restore target must never equal the production database name');

    const live = { accountId, apiToken };
    disposable = await createDisposableDatabase(live, databaseName);
    if (disposable.name === productionDatabaseName) throw new Error('Cloudflare created an unsafe restore target name');

    const configPath = await writeWranglerRestoreConfig(outputDir, disposable);
    await importSqlIntoDisposableD1(disposable, verified.plainPath, configPath);
    const restored = await verifyRestoredDatabase(live, disposable.databaseId);

    evidence = {
      ok: true,
      status: 'verified-live-disposable-restore',
      mode,
      sourceRunId,
      sourceRepositorySha: String(verified.manifest?.repositorySha || ''),
      encryptedSha256: verified.encryptedSha256,
      plaintextSha256: verified.plaintextSha256,
      plaintextBytes: verified.plaintextBytes,
      disposableDatabaseName: disposable.name,
      disposableDatabaseIdSuffix: disposable.databaseId.slice(-8),
      restoredTables: restored.tables,
      representativeCounts: restored.counts,
      writeReadProbe: restored.writeReadProbe,
      productionDatabaseTouched: false,
      secretValuesIncluded: false,
    };
  } finally {
    await rm(path.join(outputDir, 'pagero-d1-restore.sql'), { force: true });
    await rm(path.join(outputDir, 'wrangler.restore-drill.json'), { force: true });

    if (disposable?.databaseId) {
      cleanup.attempted = true;
      try {
        await deleteDisposableDatabase({ accountId, apiToken }, disposable.databaseId);
        cleanup.ok = true;
      } catch (error) {
        cleanup.ok = false;
        cleanup.error = redact(error?.message || error);
      }
    }

    if (evidence) {
      evidence.cleanup = cleanup;
      if (!cleanup.ok) {
        evidence.ok = false;
        evidence.status = 'cleanup-required';
      }
      await writeEvidence(outputDir, evidence);
      console.log(JSON.stringify(evidence, null, 2));
    }
  }

  if (!evidence?.ok) {
    throw new Error(cleanup.error || 'D1 restore drill failed');
  }
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  main().catch(async (error) => {
    const outputDir = (() => {
      try {
        return resolveWorkspacePath(process.env.PAGERO_D1_RESTORE_OUTPUT_DIR, OUTPUT_DIR_NAME);
      } catch {
        return path.join(ROOT, OUTPUT_DIR_NAME);
      }
    })();
    const failure = {
      ok: false,
      status: 'failed-restore-drill',
      error: redact(error?.message || error),
      productionDatabaseTouched: false,
      secretValuesIncluded: false,
    };
    try {
      await writeEvidence(outputDir, failure);
    } catch {}
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  });
}
