import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, '.tmp-d1-migration-safety');
const AUDIT_FILE = path.join(OUTPUT_DIR, 'd1-baseline-audit.json');
const EVIDENCE_FILE = path.join(OUTPUT_DIR, 'd1-baseline-history-write.json');
const SQL_FILE = path.join(OUTPUT_DIR, 'd1-baseline-history.sql');
const APPROVAL = 'I_APPROVE_D1_BASELINE_0001_0009';
const REQUIRED_BRANCH = 'ops/calltag-d1-baseline-audit-20260825';
const EXPECTED_BASELINE = [
  '0001_inlet_core.sql',
  '0002_lead_dedupe_fields.sql',
  '0003_event_dimensions.sql',
  '0004_lead_blocked_submissions.sql',
  '0005_auth_email_verifications.sql',
  '0006_calllink_app_accounts.sql',
  '0006_calltag_pagero_lead_queue.sql',
  '0006_project_integrations.sql',
  '0008_calltag_realtime_push.sql',
  '0009_unified_billing_referral.sql',
];
const EXPECTED_PENDING_AFTER = [
  '0010_calltag_universal_lead_intake.sql',
  '0011_calltag_generic_webhook_mapper.sql',
  '0012_calltag_meta_lead_ads.sql',
  '0013_calltag_meta_oauth.sql',
];

function stripJsonComments(source = '') {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function sameList(a = [], b = []) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function sqlLiteral(value = '') {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function wranglerConfig() {
  const raw = await readFile(path.join(ROOT, 'wrangler.jsonc'), 'utf8');
  const parsed = JSON.parse(stripJsonComments(raw));
  const database = Array.isArray(parsed.d1_databases) ? parsed.d1_databases[0] : null;
  return {
    databaseName: String(process.env.PAGERO_D1_DATABASE_NAME || database?.database_name || '').trim(),
    databaseId: String(process.env.PAGERO_D1_DATABASE_ID || database?.database_id || '').trim(),
    binding: String(database?.binding || 'DB').trim(),
  };
}

async function localMigrationNames() {
  const entries = await readdir(path.join(ROOT, 'migrations'), { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en'));
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
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const codes = Array.isArray(payload?.errors) ? payload.errors.map((item) => item?.code).filter(Boolean) : [];
    throw new Error(`Cloudflare D1 query failed (${response.status}) codes=${codes.join(',')}`);
  }
  return Array.isArray(payload?.result?.[0]?.results) ? payload.result[0].results : [];
}

async function currentBookmark({ accountId, apiToken, databaseId }) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/time_travel/bookmark`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${apiToken}` },
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    },
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false) {
    const codes = Array.isArray(payload?.errors) ? payload.errors.map((item) => item?.code).filter(Boolean) : [];
    throw new Error(`Cloudflare D1 Time Travel bookmark failed (${response.status}) codes=${codes.join(',')}`);
  }
  return String(payload?.result?.bookmark || '').trim();
}

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

async function runWrangler(args) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable('npx'), ['wrangler', ...args], {
      cwd: ROOT,
      env: process.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`wrangler D1 baseline write failed with exit code ${code}: ${stderr.slice(0, 800)}`));
    });
  });
}

async function main() {
  const mode = String(process.env.INLET_D1_MIGRATION_MODE || '').trim();
  const writeEnabled = process.env.INLET_D1_MIGRATION_WRITE === '1';
  const approval = String(process.env.INLET_D1_MIGRATION_APPROVAL || '');
  const branch = String(process.env.GITHUB_REF_NAME || '').trim();
  const expectedPendingInput = String(process.env.INLET_D1_MIGRATION_EXPECTED_PENDING || '').trim();

  if (mode !== 'preflight') throw new Error('baseline history write requires preflight mode');
  if (!writeEnabled) throw new Error('baseline history write requires allow_writes=true');
  if (approval !== APPROVAL) throw new Error(`baseline history write requires approval phrase ${APPROVAL}`);
  if (branch !== REQUIRED_BRANCH) throw new Error(`baseline history write is restricted to ${REQUIRED_BRANCH}`);
  if (expectedPendingInput) throw new Error('expected_pending must remain empty during baseline history write');

  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !apiToken) throw new Error('Cloudflare production credentials are required');

  const config = await wranglerConfig();
  if (!config.databaseName || !config.databaseId) throw new Error('D1 database configuration is required');

  const audit = JSON.parse(await readFile(AUDIT_FILE, 'utf8'));
  if (audit?.status !== 'baseline-compatible' || audit?.readOnly !== true || audit?.migrationHistoryAvailable !== false) {
    throw new Error('baseline history write requires a fresh successful read-only baseline audit');
  }
  if (!sameList(audit?.auditedMigrations || [], EXPECTED_BASELINE)) {
    throw new Error('baseline audit migration list does not exactly match the approved 0001-0009 baseline');
  }

  const local = await localMigrationNames();
  const localBaseline = local.filter((name) => Number.parseInt(name.match(/^(\d+)/)?.[1] || '9999', 10) <= 9);
  if (!sameList(localBaseline, EXPECTED_BASELINE)) throw new Error('local 0001-0009 migration set changed after approval');

  const live = { accountId, apiToken, databaseId: config.databaseId };
  const existingHistory = await d1Query(live, "SELECT name FROM sqlite_schema WHERE type='table' AND name='d1_migrations'");
  if (existingHistory.length) throw new Error('d1_migrations appeared after audit; baseline write aborted');

  const preWriteBookmark = await currentBookmark(live);
  if (!preWriteBookmark) throw new Error('pre-write Time Travel bookmark is required');

  const sql = [
    'CREATE TABLE d1_migrations(',
    '  id INTEGER PRIMARY KEY AUTOINCREMENT,',
    '  name TEXT UNIQUE,',
    '  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL',
    ');',
    ...EXPECTED_BASELINE.map((name) => `INSERT INTO d1_migrations (name) VALUES (${sqlLiteral(name)});`),
    '',
  ].join('\n');

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(SQL_FILE, sql, 'utf8');
  try {
    await runWrangler(['d1', 'execute', config.databaseName, '--remote', '--file', SQL_FILE, '--yes']);
  } finally {
    await rm(SQL_FILE, { force: true });
  }

  const rows = await d1Query(live, 'SELECT id, name, applied_at FROM d1_migrations ORDER BY id ASC');
  const applied = rows.map((row) => String(row.name || '')).filter(Boolean);
  if (!sameList(applied, EXPECTED_BASELINE)) {
    throw new Error('baseline history rows do not exactly match the approved baseline after write');
  }

  const pending = local.filter((name) => !new Set(applied).has(name));
  if (!sameList(pending, EXPECTED_PENDING_AFTER)) {
    throw new Error(`post-baseline pending migrations are not the expected 0010-0013 set: ${pending.join(',')}`);
  }

  const postWriteBookmark = await currentBookmark(live);
  const evidence = {
    ok: true,
    status: 'baseline-history-recorded',
    databaseName: config.databaseName,
    databaseBinding: config.binding,
    databaseIdSuffix: config.databaseId.slice(-8),
    branch,
    appliedBaselineMigrations: applied,
    pendingMigrationsAfter: pending,
    preWriteBookmark,
    postWriteBookmark,
    historyWritePerformed: true,
    schemaReplayPerformed: false,
    migrationApplyPerformed: false,
    rollbackRequiresSeparateApproval: true,
    secretValuesIncluded: false,
  };
  await writeFile(EVIDENCE_FILE, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(evidence, null, 2));
}

main().catch(async (error) => {
  const failure = {
    ok: false,
    status: 'baseline-history-write-failed',
    error: String(error?.message || error).replace(/Bearer\s+\S+/gi, 'Bearer [redacted]').slice(0, 1200),
    historyWriteMayHaveBeenAttempted: true,
    automaticRestorePerformed: false,
    secretValuesIncluded: false,
  };
  try {
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(EVIDENCE_FILE, `${JSON.stringify(failure, null, 2)}\n`, 'utf8');
  } catch {}
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
