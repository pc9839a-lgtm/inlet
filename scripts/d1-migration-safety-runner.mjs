import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUTPUT_DIR_NAME = '.tmp-d1-migration-safety';
const APPROVAL_PHRASE = 'I_APPROVE_D1_MIGRATIONS';
const MIN_KEY_LENGTH = 32;

function stripJsonComments(source = '') {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

export function normalizeMigrationList(value = '') {
  const source = Array.isArray(value) ? value : String(value || '').split(',');
  return source
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .filter((item, index, items) => items.indexOf(item) === index);
}

export function listsMatchExactly(actual = [], expected = []) {
  return actual.length === expected.length
    && actual.every((item, index) => item === expected[index]);
}

export function evaluateSafetyGate({
  mode = 'preflight',
  branch = '',
  writeEnabled = false,
  approval = '',
  pending = [],
  expectedPending = [],
  encryptionSecret = '',
  liveConfigured = false,
} = {}) {
  const errors = [];
  if (!['preflight', 'backup-and-apply'].includes(mode)) errors.push('unsupported mode');
  if (!liveConfigured) errors.push('Cloudflare live credentials and D1 database configuration are required');

  if (mode === 'backup-and-apply') {
    if (branch !== 'main') errors.push('write mode is restricted to the main branch');
    if (!writeEnabled) errors.push('write mode requires INLET_D1_MIGRATION_WRITE=1');
    if (approval !== APPROVAL_PHRASE) errors.push(`write mode requires approval phrase ${APPROVAL_PHRASE}`);
    if (!expectedPending.length) errors.push('write mode requires a non-empty exact expected migration list');
    if (!pending.length) errors.push('write mode requires at least one pending migration');
    if (!listsMatchExactly(pending, expectedPending)) {
      errors.push('remote pending migrations do not exactly match the approved list');
    }
    if (String(encryptionSecret || '').length < MIN_KEY_LENGTH) {
      errors.push(`backup encryption key must be at least ${MIN_KEY_LENGTH} characters`);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function evaluatePreApplyConsistency({
  appliedBefore = [],
  appliedImmediatelyBeforeApply = [],
  pendingImmediatelyBeforeApply = [],
  expectedPending = [],
  historyAvailable = false,
  migrationsTable = 'd1_migrations',
} = {}) {
  const errors = [];
  if (!historyAvailable) errors.push(`${migrationsTable} history table is unavailable immediately before apply`);
  if (!listsMatchExactly(appliedImmediatelyBeforeApply, appliedBefore)) {
    errors.push('remote migration history changed after backup; apply aborted');
  }
  if (!listsMatchExactly(pendingImmediatelyBeforeApply, expectedPending)) {
    errors.push('remote pending migrations changed after backup; apply aborted');
  }
  return { ok: errors.length === 0, errors };
}

function redact(value = '') {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/(?:token|secret|password|authorization)(["'\s:=]+)[^\s,"'}]+/gi, '$1[redacted]')
    .slice(0, 2000);
}

function outputDir() {
  const requested = String(process.env.INLET_D1_MIGRATION_OUTPUT_DIR || OUTPUT_DIR_NAME).trim();
  const resolved = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('D1 migration output directory must remain inside the repository workspace');
  }
  return resolved;
}

async function wranglerConfig() {
  const raw = await readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  const parsed = JSON.parse(stripJsonComments(raw));
  const database = Array.isArray(parsed.d1_databases) ? parsed.d1_databases[0] : null;
  return {
    databaseName: String(
      process.env.PAGERO_D1_DATABASE_NAME
      || process.env.INLET_D1_DATABASE_NAME
      || database?.database_name
      || '',
    ).trim(),
    databaseId: String(
      process.env.PAGERO_D1_DATABASE_ID
      || process.env.INLET_D1_DATABASE_ID
      || database?.database_id
      || '',
    ).trim(),
    binding: String(database?.binding || 'DB').trim(),
    migrationsTable: String(database?.migrations_table || 'd1_migrations').trim(),
  };
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

async function localMigrations() {
  const directory = path.join(ROOT, 'migrations');
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const rows = [];
  for (const name of names) {
    const filePath = path.join(directory, name);
    const info = await stat(filePath);
    rows.push({ name, bytes: info.size, sha256: await hashFile(filePath) });
  }
  return rows;
}

async function d1Query({ accountId, apiToken, databaseId }, sql, params = []) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    throw new Error(
      `Cloudflare D1 query failed (${response.status}): ${redact(JSON.stringify(payload.errors || payload.messages || {}))}`,
    );
  }
  return Array.isArray(payload.result?.[0]?.results) ? payload.result[0].results : [];
}

async function remoteMigrationState(live, migrationsTable) {
  const tableRows = await d1Query(
    live,
    "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name ASC",
  );
  const tables = tableRows.map((row) => String(row.name || '')).filter(Boolean);
  const historyAvailable = tables.includes(migrationsTable);
  const safeTable = /^[A-Za-z_][A-Za-z0-9_]*$/.test(migrationsTable)
    ? migrationsTable
    : 'd1_migrations';
  const applied = historyAvailable
    ? (await d1Query(live, `SELECT name FROM ${safeTable} ORDER BY id ASC`))
      .map((row) => String(row.name || ''))
      .filter(Boolean)
    : [];
  return { tables, historyAvailable, applied };
}

function pendingMigrations(localRows, applied) {
  const appliedSet = new Set(applied);
  return localRows.map((row) => row.name).filter((name) => !appliedSet.has(name));
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

async function run(exe, args, { input = '', env = process.env, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, {
      cwd: ROOT,
      env,
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      const result = { code: Number(code ?? 1), stdout, stderr };
      if (code === 0 || allowFailure) resolve(result);
      else reject(new Error(`${exe} ${args.join(' ')} failed (${code}): ${redact(stderr || stdout)}`));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function wrangler(args, options = {}) {
  return run(executable('npx'), ['wrangler', ...args], options);
}

function bookmarkFromText(value = '') {
  const match = String(value || '').match(/[0-9a-f]{8}-[0-9a-f-]{20,}/i);
  return match ? match[0] : '';
}

async function timeTravelInfo(databaseName) {
  const result = await wrangler(
    ['d1', 'time-travel', 'info', databaseName],
    { allowFailure: true },
  );
  const bookmark = bookmarkFromText(`${result.stdout}\n${result.stderr}`);
  return {
    available: result.code === 0 && Boolean(bookmark),
    bookmark,
    commandExitCode: result.code,
    note: result.code === 0
      ? 'Time Travel information captured.'
      : 'Time Travel information was unavailable; encrypted SQL export remains required.',
  };
}

async function validateSqlExport(filePath) {
  const info = await stat(filePath);
  if (!info.isFile() || info.size < 128) {
    throw new Error('D1 export is missing or too small to be accepted as backup evidence');
  }
  const sample = (await readFile(filePath, 'utf8')).slice(0, 131072);
  if (!/(?:CREATE\s+TABLE|INSERT\s+INTO|PRAGMA)/i.test(sample)) {
    throw new Error('D1 export does not contain recognizable SQL backup content');
  }
  return { bytes: info.size, sha256: await hashFile(filePath) };
}

async function encryptSql(plainPath, encryptedPath, secret) {
  const env = { ...process.env, PAGERO_D1_BACKUP_ENCRYPTION_KEY: secret };
  await run(
    'openssl',
    [
      'enc', '-aes-256-cbc', '-salt', '-pbkdf2', '-iter', '200000',
      '-md', 'sha256', '-in', plainPath, '-out', encryptedPath,
      '-pass', 'env:PAGERO_D1_BACKUP_ENCRYPTION_KEY',
    ],
    { env },
  );
  const info = await stat(encryptedPath);
  const hmacKey = createHash('sha256')
    .update(`pagero-d1-backup-hmac:${secret}`)
    .digest();
  return {
    bytes: info.size,
    sha256: await hashFile(encryptedPath),
    hmacSha256: await hashFile(encryptedPath, hmacKey),
    cipher: 'aes-256-cbc',
    kdf: 'pbkdf2-sha256-200000',
  };
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function rollbackInstructions({ databaseName, encryptedFile, manifestFile, bookmark }) {
  const rows = [
    '# Pagero D1 rollback evidence',
    '',
    'Recovery requires separate owner approval. This file is not executed automatically.',
    `Database: ${databaseName}`,
    `Encrypted export: ${encryptedFile}`,
    `Manifest: ${manifestFile}`,
  ];
  if (bookmark) {
    rows.push(
      '',
      'Preferred point-in-time command after separate approval:',
      `npx wrangler d1 time-travel restore ${databaseName} --bookmark=${bookmark}`,
    );
  }
  rows.push(
    '',
    'Decrypt only in an isolated workspace:',
    `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in ${encryptedFile} -out pagero-d1-restore.sql -pass env:PAGERO_D1_BACKUP_ENCRYPTION_KEY`,
    '',
    'Restore into a disposable D1 database first. Never import the export directly into production without a separately reviewed plan.',
  );
  return `${rows.join('\n')}\n`;
}

async function createEncryptedBackup({ databaseName, output, encryptionSecret, baseManifest }) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  const plainPath = path.join(output, `pagero-d1-${stamp}.sql`);
  const encryptedPath = `${plainPath}.enc`;
  const manifestPath = path.join(output, `pagero-d1-${stamp}.manifest.json`);
  const rollbackPath = path.join(output, `pagero-d1-${stamp}.rollback.txt`);

  try {
    await wrangler([
      'd1', 'export', databaseName, '--remote', '--output', plainPath, '--skip-confirmation',
    ]);
    const plain = await validateSqlExport(plainPath);
    const timeTravel = await timeTravelInfo(databaseName);
    const encrypted = await encryptSql(plainPath, encryptedPath, encryptionSecret);
    const manifest = {
      ...baseManifest,
      backup: {
        createdAt: new Date().toISOString(),
        plaintextBytes: plain.bytes,
        plaintextSha256: plain.sha256,
        encryptedFile: path.basename(encryptedPath),
        encryptedBytes: encrypted.bytes,
        encryptedSha256: encrypted.sha256,
        encryptedHmacSha256: encrypted.hmacSha256,
        cipher: encrypted.cipher,
        kdf: encrypted.kdf,
        plaintextUploaded: false,
      },
      timeTravel,
    };
    await writeJson(manifestPath, manifest);
    await writeFile(
      rollbackPath,
      rollbackInstructions({
        databaseName,
        encryptedFile: path.basename(encryptedPath),
        manifestFile: path.basename(manifestPath),
        bookmark: timeTravel.bookmark,
      }),
      'utf8',
    );
    return { manifest, manifestPath };
  } finally {
    await rm(plainPath, { force: true });
  }
}

async function applyMigrations(databaseName) {
  await wrangler(
    ['d1', 'migrations', 'apply', databaseName, '--remote'],
    { input: 'y\n' },
  );
}

async function main() {
  const mode = String(process.env.INLET_D1_MIGRATION_MODE || 'preflight').trim();
  const requireLive = process.env.INLET_D1_MIGRATION_REQUIRE_LIVE === '1';
  const writeEnabled = process.env.INLET_D1_MIGRATION_WRITE === '1';
  const approval = String(process.env.INLET_D1_MIGRATION_APPROVAL || '');
  const expectedPending = normalizeMigrationList(
    process.env.INLET_D1_MIGRATION_EXPECTED_PENDING || '',
  );
  const encryptionSecret = String(process.env.PAGERO_D1_BACKUP_ENCRYPTION_KEY || '');
  const branch = String(
    process.env.GITHUB_REF_NAME || process.env.INLET_GIT_BRANCH || '',
  ).trim();
  const output = outputDir();
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });

  const config = await wranglerConfig();
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const liveConfigured = Boolean(
    accountId && apiToken && config.databaseId && config.databaseName,
  );
  const localRows = await localMigrations();

  if (!liveConfigured) {
    const skipped = {
      ok: !requireLive,
      status: 'skipped-live',
      mode,
      reason: 'Cloudflare account, token, database id, or database name is missing.',
      localMigrations: localRows,
      secretValuesIncluded: false,
    };
    await writeJson(path.join(output, 'd1-migration-preflight.json'), skipped);
    console.log(JSON.stringify(skipped, null, 2));
    if (requireLive) process.exitCode = 1;
    return;
  }

  const live = { accountId, apiToken, databaseId: config.databaseId };
  const before = await remoteMigrationState(live, config.migrationsTable);
  const pendingBefore = pendingMigrations(localRows, before.applied);
  const gate = evaluateSafetyGate({
    mode,
    branch,
    writeEnabled,
    approval,
    pending: pendingBefore,
    expectedPending,
    encryptionSecret,
    liveConfigured,
  });
  if (mode === 'backup-and-apply' && !before.historyAvailable) {
    gate.errors.push(`${config.migrationsTable} history table is unavailable`);
  }

  const baseManifest = {
    ok: gate.errors.length === 0,
    status: gate.errors.length ? 'failed-live' : 'verified-live',
    mode,
    repositorySha: String(process.env.GITHUB_SHA || ''),
    branch,
    databaseName: config.databaseName,
    databaseBinding: config.binding,
    databaseIdSuffix: config.databaseId.slice(-8),
    migrationsTable: config.migrationsTable,
    localMigrations: localRows,
    remoteAppliedMigrationsBefore: before.applied,
    pendingMigrationsBefore: pendingBefore,
    expectedPendingMigrations: expectedPending,
    exactExpectedPendingMatch: listsMatchExactly(pendingBefore, expectedPending),
    remoteTables: before.tables,
    migrationHistoryAvailable: before.historyAvailable,
    writeRequested: mode === 'backup-and-apply',
    writeGuardPassed: gate.errors.length === 0,
    gateErrors: gate.errors,
    secretValuesIncluded: false,
  };

  if (mode === 'preflight') {
    await writeJson(path.join(output, 'd1-migration-preflight.json'), baseManifest);
    console.log(JSON.stringify(baseManifest, null, 2));
    if (gate.errors.length) process.exitCode = 1;
    return;
  }

  if (gate.errors.length) {
    await writeJson(path.join(output, 'd1-migration-blocked.json'), baseManifest);
    console.error(JSON.stringify(baseManifest, null, 2));
    process.exitCode = 1;
    return;
  }

  const backup = await createEncryptedBackup({
    databaseName: config.databaseName,
    output,
    encryptionSecret,
    baseManifest,
  });

  const immediatelyBeforeApply = await remoteMigrationState(live, config.migrationsTable);
  const pendingImmediatelyBeforeApply = pendingMigrations(localRows, immediatelyBeforeApply.applied);
  const pendingMigrationsImmediatelyBeforeApply = pendingImmediatelyBeforeApply;
  const preApplyConsistency = evaluatePreApplyConsistency({
    appliedBefore: before.applied,
    appliedImmediatelyBeforeApply: immediatelyBeforeApply.applied,
    pendingImmediatelyBeforeApply,
    expectedPending,
    historyAvailable: immediatelyBeforeApply.historyAvailable,
    migrationsTable: config.migrationsTable,
  });

  if (!preApplyConsistency.ok) {
    const blockedAfterBackup = {
      ...backup.manifest,
      ok: false,
      status: 'failed-live',
      preApplyConsistency: {
        checked: true,
        ok: false,
        errors: preApplyConsistency.errors,
        remoteAppliedMigrationsImmediatelyBeforeApply: immediatelyBeforeApply.applied,
        pendingMigrationsImmediatelyBeforeApply,
      },
      migrationApply: {
        attempted: false,
        error: 'Migration state changed after backup; write was blocked.',
      },
    };
    await writeJson(backup.manifestPath, blockedAfterBackup);
    console.error(JSON.stringify(blockedAfterBackup, null, 2));
    process.exitCode = 1;
    return;
  }

  let applyError = '';
  try {
    await applyMigrations(config.databaseName);
  } catch (error) {
    applyError = redact(error?.message || error);
  }

  const after = await remoteMigrationState(live, config.migrationsTable);
  const pendingAfter = pendingMigrations(localRows, after.applied);
  const expectedApplied = expectedPending.every((name) => after.applied.includes(name));
  const ok = !applyError
    && expectedApplied
    && !pendingAfter.some((name) => expectedPending.includes(name));
  const finalManifest = {
    ...backup.manifest,
    ok,
    status: ok ? 'verified-live' : 'failed-live',
    preApplyConsistency: {
      checked: true,
      ok: true,
      errors: [],
      remoteAppliedMigrationsImmediatelyBeforeApply: immediatelyBeforeApply.applied,
      pendingMigrationsImmediatelyBeforeApply,
    },
    migrationApply: {
      attempted: true,
      error: applyError || null,
      remoteAppliedMigrationsAfter: after.applied,
      pendingMigrationsAfter: pendingAfter,
      expectedApplied,
    },
  };
  await writeJson(backup.manifestPath, finalManifest);
  console.log(JSON.stringify(finalManifest, null, 2));
  if (!ok) process.exitCode = 1;
}

const invoked = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : '';

if (invoked === import.meta.url) {
  main().catch(async (error) => {
    const output = (() => {
      try {
        return outputDir();
      } catch {
        return path.join(ROOT, OUTPUT_DIR_NAME);
      }
    })();
    await mkdir(output, { recursive: true }).catch(() => {});
    const failure = {
      ok: false,
      status: 'failed-live',
      mode: String(process.env.INLET_D1_MIGRATION_MODE || 'preflight'),
      error: redact(error?.message || error),
      secretValuesIncluded: false,
    };
    await writeJson(
      path.join(output, 'd1-migration-failure.json'),
      failure,
    ).catch(() => {});
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  });
}
