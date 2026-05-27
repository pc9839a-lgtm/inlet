import { appendFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const readCache = new Map();

export function parseJsonlText(text = '') {
  const records = [];
  const invalid = [];
  const lines = String(text || '').split(/\r?\n/);
  for (const [index, line] of lines.entries()) {
    if (!line.trim()) continue;
    try {
      records.push(JSON.parse(line));
    } catch (error) {
      invalid.push({
        line: index + 1,
        text: line,
        error: String(error?.message || error),
      });
    }
  }
  return {
    records,
    invalid,
    lines: records.length + invalid.length,
  };
}

export async function readJsonlRecords(file, options = {}) {
  try {
    if (options.cache) {
      const info = await stat(file);
      const key = `${file}:${info.size}:${info.mtimeMs}`;
      const cached = readCache.get(file);
      if (cached?.key === key) return { ...cached.value, cacheHit: true };
      const raw = await readFile(file, 'utf8');
      const value = { exists: true, raw, ...parseJsonlText(raw) };
      readCache.set(file, { key, value });
      return { ...value, cacheHit: false };
    }
    const raw = await readFile(file, 'utf8');
    return { exists: true, raw, ...parseJsonlText(raw) };
  } catch {
    return { exists: false, raw: '', records: [], invalid: [], lines: 0 };
  }
}

export function jsonlFullScanPlan(type = 'records', filters = {}, extra = {}) {
  const indexReadyFields = Array.isArray(extra.indexReadyFields) ? extra.indexReadyFields : [];
  const activeIndexFields = Array.isArray(extra.activeIndexFields)
    ? extra.activeIndexFields
    : indexReadyFields.filter((field) => filters?.[field]);
  return {
    adapter: 'jsonl',
    indexed: false,
    fullScan: true,
    type,
    filters: { ...filters },
    nextAdapter: extra.nextAdapter || 'db-index',
    indexReadyFields,
    activeIndexFields,
    missingIndexFields: Array.isArray(extra.missingIndexFields)
      ? extra.missingIndexFields
      : indexReadyFields.filter((field) => !activeIndexFields.includes(field)),
    ...extra,
  };
}

export async function queryJsonlRecords(file, options = {}) {
  const parsed = await readJsonlRecords(file, { cache: options.cache !== false });
  const filter = typeof options.filter === 'function' ? options.filter : null;
  const cursor = Math.max(0, Number(options.cursor || 0));
  const limit = Math.max(1, Number(options.limit || 100));
  const filtered = filter ? parsed.records.filter(filter) : parsed.records.slice();
  const ordered = options.reverse === false ? filtered : filtered.slice().reverse();
  const records = ordered.slice(cursor, cursor + limit);
  const nextCursor = cursor + records.length < ordered.length ? cursor + records.length : null;
  return {
    records,
    total: ordered.length,
    nextCursor,
    hasMore: nextCursor != null,
    invalidLines: parsed.invalid.length,
    queryPlan: jsonlFullScanPlan(options.type || 'records', options.filters || {}, {
      cacheHit: !!parsed.cacheHit,
      ...options.plan,
    }),
  };
}

export async function appendJsonlRecord(file, record) {
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(record)}\n`, 'utf8');
  readCache.delete(file);
}

export async function writeJsonlRecords(file, records = []) {
  await mkdir(path.dirname(file), { recursive: true });
  const body = records.length ? `${records.map((record) => JSON.stringify(record)).join('\n')}\n` : '';
  await writeFile(file, body, 'utf8');
  readCache.delete(file);
}
