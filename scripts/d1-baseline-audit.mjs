import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, '.tmp-d1-migration-safety');
const MAX_BASELINE_PREFIX = 9;

function stripComments(source = '') {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*--.*$/gm, '');
}

function stripJsonComments(source = '') {
  return String(source)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function splitTopLevel(value = '', delimiter = ',') {
  const out = [];
  let current = '';
  let depth = 0;
  let quote = '';
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (quote) {
      current += ch;
      if (ch === quote && value[i - 1] !== '\\') quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '(') depth += 1;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === delimiter && depth === 0) {
      out.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

function splitStatements(sql = '') {
  return splitTopLevel(stripComments(sql), ';').filter(Boolean);
}

function cleanIdentifier(value = '') {
  return String(value).trim().replace(/^["'`\[]|["'`\]]$/g, '');
}

function parseColumnDefinition(segment = '') {
  const trimmed = segment.trim();
  if (!trimmed || /^(PRIMARY|FOREIGN|UNIQUE|CHECK|CONSTRAINT)\b/i.test(trimmed)) return null;
  const match = trimmed.match(/^(["`\[]?[A-Za-z_][A-Za-z0-9_]*["`\]]?)\s+([A-Za-z0-9_]+)/i);
  if (!match) return null;
  const name = cleanIdentifier(match[1]);
  const type = String(match[2] || '').toUpperCase();
  const primaryKey = /\bPRIMARY\s+KEY\b/i.test(trimmed);
  const notNull = /\bNOT\s+NULL\b/i.test(trimmed);
  return { name, type, primaryKey, notNull };
}

function expectedFromSql(sql = '') {
  const tables = new Map();
  const indexes = new Map();
  for (const statement of splitStatements(sql)) {
    const createTable = statement.match(/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+(["`\[]?[A-Za-z_][A-Za-z0-9_]*["`\]]?)\s*\(([\s\S]*)\)$/i);
    if (createTable) {
      const table = cleanIdentifier(createTable[1]);
      const columns = splitTopLevel(createTable[2]).map(parseColumnDefinition).filter(Boolean);
      const existing = tables.get(table) || new Map();
      for (const column of columns) existing.set(column.name, column);
      tables.set(table, existing);
      continue;
    }

    const alter = statement.match(/^ALTER\s+TABLE\s+(["`\[]?[A-Za-z_][A-Za-z0-9_]*["`\]]?)\s+ADD\s+COLUMN\s+([\s\S]+)$/i);
    if (alter) {
      const table = cleanIdentifier(alter[1]);
      const column = parseColumnDefinition(alter[2]);
      if (column) {
        const existing = tables.get(table) || new Map();
        existing.set(column.name, column);
        tables.set(table, existing);
      }
      continue;
    }

    const index = statement.match(/^CREATE\s+(UNIQUE\s+)?INDEX\s+IF\s+NOT\s+EXISTS\s+(["`\[]?[A-Za-z_][A-Za-z0-9_]*["`\]]?)\s+ON\s+(["`\[]?[A-Za-z_][A-Za-z0-9_]*["`\]]?)/i);
    if (index) {
      indexes.set(cleanIdentifier(index[2]), {
        table: cleanIdentifier(index[3]),
        unique: Boolean(index[1]),
      });
    }
  }
  return { tables, indexes };
}

async function loadExpectedBaseline() {
  const entries = await readdir(path.join(ROOT, 'migrations'), { withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile() && /^\d+.*\.sql$/i.test(entry.name))
    .map((entry) => entry.name)
    .filter((name) => Number.parseInt(name.match(/^(\d+)/)?.[1] || '9999', 10) <= MAX_BASELINE_PREFIX)
    .sort((a, b) => a.localeCompare(b, 'en'));

  const tables = new Map();
  const indexes = new Map();
  for (const file of files) {
    const sql = await readFile(path.join(ROOT, 'migrations', file), 'utf8');
    const expected = expectedFromSql(sql);
    for (const [table, columns] of expected.tables.entries()) {
      const existing = tables.get(table) || new Map();
      for (const [name, column] of columns.entries()) existing.set(name, { ...column, migration: file });
      tables.set(table, existing);
    }
    for (const [name, index] of expected.indexes.entries()) indexes.set(name, { ...index, migration: file });
  }
  return { files, tables, indexes };
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

function assertIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) throw new Error(`Unsafe SQLite identifier: ${value}`);
  return value;
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
    throw new Error(`Cloudflare D1 read-only audit failed (${response.status}) codes=${codes.join(',')}`);
  }
  return Array.isArray(payload?.result?.[0]?.results) ? payload.result[0].results : [];
}

async function inspectRemote(live, expected) {
  const schema = await d1Query(
    live,
    "SELECT type, name, tbl_name, sql FROM sqlite_schema WHERE type IN ('table','index') ORDER BY type, name",
  );
  const tableNames = new Set(schema.filter((row) => row.type === 'table').map((row) => String(row.name || '')));
  const indexRows = new Map(schema.filter((row) => row.type === 'index').map((row) => [String(row.name || ''), row]));
  const missingTables = [];
  const missingColumns = [];
  const incompatibleColumns = [];
  const missingIndexes = [];
  const incompatibleIndexes = [];

  for (const [table, columns] of expected.tables.entries()) {
    if (!tableNames.has(table)) {
      missingTables.push(table);
      continue;
    }
    const safe = assertIdentifier(table);
    const actualRows = await d1Query(live, `PRAGMA table_info(${safe})`);
    const actual = new Map(actualRows.map((row) => [String(row.name || ''), row]));
    for (const [name, required] of columns.entries()) {
      const row = actual.get(name);
      if (!row) {
        missingColumns.push({ table, column: name, migration: required.migration });
        continue;
      }
      const actualType = String(row.type || '').toUpperCase();
      const actualPk = Number(row.pk || 0) > 0;
      const actualNotNull = Number(row.notnull || 0) > 0 || actualPk;
      const reasons = [];
      if (required.type && actualType && required.type !== actualType) reasons.push(`type expected=${required.type} actual=${actualType}`);
      if (required.primaryKey && !actualPk) reasons.push('primary-key missing');
      if (required.notNull && !actualNotNull) reasons.push('not-null missing');
      if (reasons.length) incompatibleColumns.push({ table, column: name, migration: required.migration, reasons });
    }
  }

  for (const [name, required] of expected.indexes.entries()) {
    const row = indexRows.get(name);
    if (!row) {
      missingIndexes.push({ index: name, table: required.table, migration: required.migration });
      continue;
    }
    if (String(row.tbl_name || '') !== required.table) {
      incompatibleIndexes.push({ index: name, expectedTable: required.table, actualTable: String(row.tbl_name || ''), migration: required.migration });
    }
  }

  return {
    remoteTableCount: tableNames.size,
    remoteIndexCount: indexRows.size,
    migrationHistoryAvailable: tableNames.has('d1_migrations'),
    missingTables,
    missingColumns,
    incompatibleColumns,
    missingIndexes,
    incompatibleIndexes,
  };
}

async function main() {
  const accountId = String(process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
  const apiToken = String(process.env.CLOUDFLARE_API_TOKEN || '').trim();
  if (!accountId || !apiToken) throw new Error('Cloudflare production credentials are required');

  const config = await wranglerConfig();
  if (!config.databaseId || !config.databaseName) throw new Error('D1 database configuration is required');

  const expected = await loadExpectedBaseline();
  const live = { accountId, apiToken, databaseId: config.databaseId };
  const audit = await inspectRemote(live, expected);
  const baselineCompatible = !audit.migrationHistoryAvailable
    && audit.missingTables.length === 0
    && audit.missingColumns.length === 0
    && audit.incompatibleColumns.length === 0
    && audit.missingIndexes.length === 0
    && audit.incompatibleIndexes.length === 0;

  const result = {
    ok: baselineCompatible,
    status: audit.migrationHistoryAvailable ? 'history-present-baseline-not-needed' : baselineCompatible ? 'baseline-compatible' : 'baseline-incompatible',
    readOnly: true,
    databaseName: config.databaseName,
    databaseBinding: config.binding,
    databaseIdSuffix: config.databaseId.slice(-8),
    auditedMigrations: expected.files,
    expectedTables: expected.tables.size,
    expectedIndexes: expected.indexes.size,
    ...audit,
    automaticBaselineWritePerformed: false,
    nextStep: baselineCompatible
      ? 'Review evidence, then separately approve a migration-history baseline plan for already-present 0001-0009 only.'
      : 'Do not write migration history or apply 0010-0013. Reconcile the reported schema differences first.',
    secretValuesIncluded: false,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(path.join(OUTPUT_DIR, 'd1-baseline-audit.json'), `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(result, null, 2));
  if (!baselineCompatible && !audit.migrationHistoryAvailable) process.exitCode = 1;
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    status: 'baseline-audit-failed',
    readOnly: true,
    error: String(error?.message || error).slice(0, 1000),
    automaticBaselineWritePerformed: false,
    secretValuesIncluded: false,
  }, null, 2));
  process.exitCode = 1;
});
