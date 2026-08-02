import { spawn } from 'node:child_process';
import { createHash, createHmac } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const DEFAULT_OUTPUT_DIR = '.tmp-d1-migration-safety';
const APPROVAL_PHRASE = 'I_APPROVE_D1_MIGRATIONS';
const MIN_ENCRYPTION_SECRET_LENGTH = 32;

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
  return actual.length === expected.length && actual.every((item, index) => item === expected[index]);
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
    if (!listsMatchExactly(pending, expectedPending)) errors.push('remote pending migrations do not exactly match the approved list');
    if (String(encryptionSecret || '').length < MIN_ENCRYPTION_SECRET_LENGTH) {
      errors.push(`backup encryption key must be at least ${MIN_ENCRYPTION_SECRET_LENGTH} characters`);
    }
  }
  return { ok: errors.length === 0, errors };
}

function redact(value = '') {
  return String(value || '')
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, 'Bearer [redacted]')
    .replace(/(?:token|secret|password|authorization)(["'\s:=]+)[^\s,"'}]+/gi, '$1[redacted]')
    .slice(0, 2000);
}

function safeTimestamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function resolveOutputDir() {
  const requested = String(process.env.INLET_D1_MIGRATION_OUTPUT_DIR || DEFAULT_OUTPUT_DIR).trim();
  const resolved = path.resolve(ROOT, requested);
  const relative = path.relative(ROOT, resolved);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error('D1 migration output directory must remain inside the repository workspace');
  }
  return resolved;
}

async function parseWranglerConfig() {
  const configPath = path.join(ROOT, 'wrangler.jsonc');
  const raw = await readFile(configPath, 'utf8');
  const config = JSON.parse(stripJsonComments(raw));
  const database = Array.isArray(config.d1_databases) ? config.d1_databases[0] : null;
  return {
    databaseName: String(process.env.PAGERO_D1_DATABASE_NAME || process.env.INLET_D1_DATABASE_NAME || database?.database_name || '').trim(),
    databaseId: String(process.env.INLET_D1_DATABASE_ID || database?.database_id || '').trim(),
    binding: String(database?.binding || 'DB').trim(),
  };
}

async function fileHash(filePath, algorithm = 'sha256', key = null) {
  return new Promise((resolve, reject) => {
    const digest = key ? createHmac(algorithm, key) : createHash(algorithm);
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(digest.digest('hex')));
  });
}

async function localMigrationManifest() {
  const migrationDir = path.join(ROOT, 'migrations');
  const entries = await readdir(migrationDir, { withFileTypes: true });
  const names = entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right, 'en'));
  const files = [];
  for (const name of names) {
    const filePath = path.join(migrationDir, name);
    const info = await stat(filePath);
    files.push({ name, bytes: info.size, sha256: await fileHash(filePath) });
  }
  return files;
}

async function d1Query({ accountId, apiToken, databaseId }, sql, params = []) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sql, params }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const detail = redact(JSON.stringify(payload.errors || payload.messages || { status: response.status }));
    throw new Error(`Cloudflare D1 query failed (${response.status}): ${detail}`);
  }
  return Array.isArray(payload.result?.[0]?.results) ? payload.result[0].results : [];
}

async function remoteMigrationState(live) {
  const tableRows = await d1Query(live, "SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name ASC");
  const tables = tableRows.map((row) => String(row.name || '')).filter(Boolean);
  const historyAvailable = tables.includes('d1_migrations');
  const applied = historyAvailable
    ? (await d1Query(live, 'SELECT name FROM d1_migrations ORDER BY id ASC')).map((row) => String(row.name || '')).filter(Boolean)
    : [];
  return { tables, historyAvailable, applied };
}

function pendingMigrations(localFiles, applied) {
  const appliedSet = new Set(applied);
  return localFiles.map((file) => file.name).filter((name) => !appliedSet.has(name));
}

function commandExecutable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

async function runCommand(executable, args, { input = '', env = process.env, allowFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
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
      else reject(new Error(`${executable} ${args.join(' ')} failed (${code}): ${redact(stderr || stdout)}`));
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

async function runWrangler(args, options = {}) {
  return runCommand(commandExecutable('npx'), ['wrangler', ...args], options);
}

function parseJsonFromOutput(source = '') {
  const text = String(source || '').trim();
  if (!text) return null;
  for (const marker of ['[', '{']) {
    const start = text.indexOf(marker);
    if (start < 0) continue;
    try {
      return JSON.parse(text.slice(start));
    } catch {
      // Try the next marker.
    }
  }
  return null;
}

function findBookmark(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/[0-9a-f]{8}-[0-9a-f-]{20,}/i);
    return match ? match[0] : '';
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findBookmark(item);
      if (match) return match;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const key of ['bookmark', 'current_bookmark', 'currentBookmark']) {
      if (typeof value[key] === 'string' && value[key]) return value[key];
    }
    for (const item of Object.values(value)) {
      const match = findBookmark(item);
      if (match) return match;
    }
  }
  return '';
}

async function timeTravelEvidence(databaseName) {
  const result = await runWrangler(['d1', 'time-travel', 'info', databaseName, '--json'], { allowFailure: true });
  const parsed = parseJsonFromOutput(result.stdout || result.stderr);
  const bookmark = findBookmark(parsed || result.stdout || result.stderr);
  return {
    available: result.code === 0 && Boolean(bookmark),
    bookmark,
    commandExitCode: result.code,
    note: result.code === 0 ? 'Time Travel information captured.' : 'Time Travel information was unavailable; encrypted SQL export remains the required backup evidence.',
  };
}

async function validateExport(filePath) {
  const info = await stat(filePath);
  if (!info.isFile() || info.size < 128) throw new Error('D1 export is missing or too small to be accepted as backup evidence');
  const handle = await readFile(filePath, 'utf8');
  const sample = handle.slice(0, 131072);
  if (!/(?:CREATE\s+TABLE|INSERT\s+INTO|PRAGMA)/i.test(sample)) {
    throw new Error('D1 export does not contain recognizable SQL backup content');
  }
  return { bytes: info.size, sha256: await fileHash(filePath) };
}

async function encryptBackup(plainPath, encryptedPath, encryptionSecret) {
  const env = { ...process.env, PAGERO_D1_BACKUP_ENCRYPTION_KEY: encryptionSecret };
  await runCommand('openssl', [
    'enc',
    '-aes-256-cbc',
    '-salt',
    '-pbkdf2',
    '-iter',
    '200000',
    '-md',
    'sha256',
    '-in',
    plainPath,
    '-out',
    encryptedPath,
    '-pass',
    'env:PAGERO_D1_BACKUP_ENCRYPTION_KEY',
  ], { env });
  const info = await stat(encryptedPath);
  const hmacKey = createHash('sha256').update(`pagero-d1-backup-hmac:${encryptionSecret}`).digest();
  return {
    bytes: info.size,
    sha256: await fileHash(encryptedPath),
    hmacSha256: await fileHash(encryptedPath, 'sha256', hmacKey),
    cipher: 'aes-256-cbc',
    kdf: 'pbkdf2-sha256-200000',
  };
}

function rollbackText({ databaseName, encryptedFile, bookmark, manifestFile }) {
  const lines = [
    '# Pagero D1 rollback evidence',
    '',
    'This file is a recovery plan, not an executable workflow.',
    'Never restore production automatically. Require a separate owner approval and verify the target database first.',
    '',
    `Database: ${databaseName}`,
    `Encrypted export: ${encryptedFile}`,
    `Manifest: ${manifestFile}`,
  ];
  if (bookmark) {
    lines.push('', 'Preferred point-in-time recovery command after separate approval:', `npx wrangler d1 time-travel restore ${databaseName} --bookmark=${bookmark}`);
  }
  lines.push(
    '',
    'Encrypted export inspection in an isolated workspace:',
    `openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in ${encryptedFile} -out pagero-d1-restore.sql -pass env:PAGERO_D1_BACKUP_ENCRYPTION_KEY`,
    '',
    'Inspect the SQL and restore into a disposable D1 database first. Do not import directly into production without a separate reviewed restore plan.',
  );
  return `${lines.join('\n')}\n`;
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function createBackup({ databaseName, outputDir, encryptionSecret, baseManifest }) {
  const stamp = safeTimestamp();
  const plainPath = path.join(outputDir, `pagero-d1-${stamp}.sql`);
  const encryptedPath = `${plainPath}.enc`;
  const manifestPath = path.join(outputDir, `pagero-d1-${stamp}.manifest.json`);
  const rollbackPath = path.join(outputDir, `pagero-d1-${stamp}.rollback.txt`);
  let plainEvidence = null;
  try {
    await runWrangler(['d1', 'export', databaseName, '--remote', '--output', plainPath, '--yes']);
    plainEvidence = await validateExport(plainPath);
    const timeTravel = await timeTravelEvidence(databaseName);
    const encryptedEvidence = await encryptBackup(plainPath, encryptedPath, encryptionSecret);
    const manifest = {
      ...baseManifest,
      backup: {
        createdAt: new Date().toISOString(),
        plaintextBytes: plainEvidence.bytes,
        plaintextSha256: plainEvidence.sha256,
        encryptedFile: path.basename(encryptedPath),
        encryptedBytes: encryptedEvidence.bytes,
        encryptedSha256: encryptedEvidence.sha256,
        encryptedHmacSha256: encryptedEvidence.hmacSha256,
        cipher: encryptedEvidence.cipher,
        kdf: encryptedEvidence.kdf,
        plaintextUploaded: false,
      },
      timeTravel,
    };
    await writeJson(manifestPath, manifest);
    await writeFile(rollbackPath, rollbackText({
      databaseName,
      encryptedFile: path.basename(encryptedPath),
      bookmark: timeTravel.bookmark,
      manifestFile: path.basename(manifestPath),
    }), 'utf8');
    return { manifest, manifestPath, rollbackPath, encryptedPath };
  } finally {
    await rm(plainPath, { force: true });
  }
}

async function applyMigrations(databaseName) {
  await runWrangler(['d1', 'migrations', 'apply', databaseName, '--remote'], { input: 'y\n' });
}

async function main() {
  const mode = String(process.env.INLET_D1_MIGRATION_MODE || 'preflight').trim();
  const requireLive = process.env.INLET_D1_MIGRATION_REQUIRE_LIVE === '1';
  const writeEnabled = process.env.INLET_D1_MIGRATION_WRITE === '1';
  const approval = String(process.env.INLET_D1_MIGRATION_APPROVAL || '');
  const expectedPending = normalizeMigrationList(process.env.INLET_D1_MIGRATION_EXPECTED_PENDING || '');
  const encryptionSecret = String(process.env.PAGERO_D1_BACKUP_ENCRYPTION_KEY || '');
  const branch = String(process.env.GITHUB_REF_NAME || process.env.INLET_GIT_BRANCH || '').trim();
  const outputDir = resolveOutputDir();
  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });

  const config = await parseWranglerConfig();
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  const liveConfigured = Boolean(accountId && apiToken && config.databaseId && config.databaseName);
  const localFiles = await localMigrationManifest();

  if (!liveConfigured) {
    const skipped = {
      ok: !requireLive,
      status: 'skipped-live',
      mode,
      reason: 'Cloudflare account, API token, D1 database id, or database name is missing.',
      localMigrations: localFiles,
      secretValuesIncluded: false,
    };
    await writeJson(path.join(outputDir, 'd1-migration-preflight.json'), skipped);
    console.log(JSON.stringify(skipped, null, 2));
    if (requireLive) process.exitCode = 1;
    return;
  }

  const live = { accountId, apiToken, databaseId: config.databaseId };
  const remoteBefore = await remoteMigrationState(live);
  const pendingBefore = pendingMigrations(localFiles, remoteBefore.applied);
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
  const baseManifest = {
    ok: gate.ok,
    status: gate.ok ? 'verified-live' : 'failed-live',
    mode,
    repositorySha: String(process.env.GITHUB_SHA || ''),
    branch,
    databaseName: config.databaseName,
    databaseBinding: config.binding,
    databaseIdSuffix: config.databaseId.slice(-8),
    localMigrations: localFiles,
    remoteAppliedMigrationsBefore: remoteBefore.applied,
    pendingMigrationsBefore: pendingBefore,
    expectedPendingMigrations: expectedPending,
    exactExpectedPendingMatch: listsMatchExactly(pendingBefore, expectedPending),
    remoteTables: remoteBefore.tables,
    migrationHistoryAvailable: remoteBefore.historyAvailable,
    writeRequested: mode === 'backup-and-apply',
    writeGuardPassed: gate.ok,
    gateErrors: gate.errors,
    secretValuesIncluded: false,
  };

  if (mode === 'preflight') {
    await writeJson(path.join(outputDir, 'd1-migration-preflight.json'), baseManifest);
    console.log(JSON.stringify(baseManifest, null, 2));
    if (!gate.ok) process.exitCode = 1;
    return;
  }

  if (!remoteBefore.historyAvailable) gate.errors.push('d1_migrations history table is unavailable');
  if (gate.errors.length) {
    const blocked = { ...baseManifest, ok: false, status: 'failed-live', writeGuardPassed: false, gateErrors: gate.errors };
    await writeJson(path.join(outputDir, 'd1-migration-blocked.json'), blocked);
    console.error(JSON.stringify(blocked, null, 2));
    process.exitCode = 1;
    return;
  }

  const backup = await createBackup({
    databaseName: config.databaseName,
    outputDir,
    encryptionSecret,
    baseManifest,
  });

  let applyError = null;
  try {
    await applyMigrations(config.databaseName);
  } catch (error) {
    applyError = redact(error?.message || error);
  }

  const remoteAfter = await remoteMigrationState(live);
  const pendingAfter = pendingMigrations(localFiles, remoteAfter.applied);
  const expectedApplied = expectedPending.every((name) => remoteAfter.applied.includes(name));
  const ok = !applyError && expectedApplied && !pendingAfter.some((name) => expectedPending.includes(name));
  const finalManifest = {
    ...backup.manifest,
    ok,
    status: ok ? 'verified-live' : 'failed-live',
    migrationApply: {
      attempted: true,
      error: applyError,
      remoteAppliedMigrationsAfter: remoteAfter.applied,
      pendingMigrationsAfter: pendingAfter,
      expectedApplied,
    },
  };
  await writeJson(backup.manifestPath, finalManifest);
  console.log(JSON.stringify(finalManifest, null, 2));
  if (!ok) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : '';
if (invokedPath === import.meta.url) {
  main().catch(async (error) => {
    const outputDir = (() => {
      try { return resolveOutputDir(); } catch { return path.join(ROOT, DEFAULT_OUTPUT_DIR); }
    })();
    await mkdir(outputDir, { recursive: true }).catch(() => {});
    const failure = {
      ok: false,
      status: 'failed-live',
      mode: String(process.env.INLET_D1_MIGRATION_MODE || 'preflight'),
      error: redact(error?.message || error),
      secretValuesIncluded: false,
    };
    await writeJson(path.join(outputDir, 'd1-migration-failure.json'), failure).catch(() => {});
    console.error(JSON.stringify(failure, null, 2));
    process.exitCode = 1;
  });
}
