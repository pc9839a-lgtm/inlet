import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { DatabaseSync } from 'node:sqlite';

const SCENARIOS = [10_000, 50_000];
const MAX_QUERY_MS = 1500;
const MAX_SEED_MS = 12_000;

function createDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA journal_mode = MEMORY;
    PRAGMA synchronous = OFF;
    PRAGMA temp_store = MEMORY;

    CREATE TABLE leads (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      page_id TEXT NOT NULL DEFAULT '',
      page_slug TEXT NOT NULL DEFAULT '',
      kind TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      contact_key TEXT NOT NULL DEFAULT '',
      values_json TEXT NOT NULL DEFAULT '{}',
      delivery_status TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL DEFAULT '',
      created_month TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    );

    CREATE INDEX idx_leads_project_month
      ON leads(project_id, created_month, created_at DESC);
    CREATE INDEX idx_leads_project_status
      ON leads(project_id, status, created_at DESC);
    CREATE INDEX idx_leads_contact_dedupe
      ON leads(project_id, contact_key, kind, created_at DESC);
    CREATE INDEX idx_leads_delivery_status
      ON leads(project_id, delivery_status, created_at DESC);
  `);
  return db;
}

function seed(db, count) {
  const insert = db.prepare(`
    INSERT INTO leads (
      id, project_id, page_id, page_slug, kind, status, name, phone, email,
      contact_key, values_json, delivery_status, source_url,
      created_month, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  db.exec('BEGIN');
  const started = performance.now();
  try {
    for (let index = 0; index < count; index += 1) {
      const projectId = index % 10 === 0 ? 'project-other' : 'project-large';
      const month = index % 12 === 0 ? '2026-09' : '2026-10';
      const day = String((index % 28) + 1).padStart(2, '0');
      const second = String(index % 60).padStart(2, '0');
      const createdAt = `2026-10-${day}T12:34:${second}.${String(index % 1000).padStart(3, '0')}Z`;
      const status = ['신규', '진행', '완료'][index % 3];
      const deliveryStatus = ['success', 'failed', 'partial', 'none'][index % 4];
      const suffix = String(index).padStart(6, '0');
      insert.run(
        `lead-${suffix}`,
        projectId,
        `page-${index % 7}`,
        `landing-${index % 5}`,
        index % 4 === 0 ? 'reservation' : 'consult',
        status,
        `고객 ${suffix}`,
        `010-${String(1000 + (index % 9000)).padStart(4, '0')}-${String(index % 10000).padStart(4, '0')}`,
        `lead${suffix}@example.test`,
        `contact-${index % 15000}`,
        JSON.stringify({ message: index % 997 === 0 ? 'special-search-token' : '일반 문의' }),
        deliveryStatus,
        index % 5 === 0 ? 'https://example.test/?utm_source=naver' : '',
        month,
        createdAt,
        createdAt,
      );
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return performance.now() - started;
}

function explain(db, sql, params) {
  return db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all(...params)
    .map((row) => String(row.detail || ''));
}

function benchmark(db, name, sql, params, { expectIndex = '', maxMs = MAX_QUERY_MS } = {}) {
  const plan = explain(db, sql, params);
  if (expectIndex) {
    assert(
      plan.some((detail) => detail.includes(expectIndex)),
      `${name} must use ${expectIndex}: ${plan.join(' | ')}`,
    );
  }

  // Warm once so the check is about query shape rather than first-use setup.
  db.prepare(sql).all(...params);
  const started = performance.now();
  const rows = db.prepare(sql).all(...params);
  const durationMs = performance.now() - started;
  assert(durationMs <= maxMs, `${name} exceeded ${maxMs}ms: ${durationMs.toFixed(1)}ms`);
  return {
    name,
    durationMs: Number(durationMs.toFixed(2)),
    rows: rows.length,
    plan,
  };
}

function runScenario(count) {
  const db = createDb();
  const seedMs = seed(db, count);
  assert(seedMs <= MAX_SEED_MS, `seed ${count} exceeded ${MAX_SEED_MS}ms: ${seedMs.toFixed(1)}ms`);

  const common = ['project-large', '2026-10'];
  const checks = [
    benchmark(
      db,
      'latest-page',
      `SELECT id, name, status, delivery_status, created_at
       FROM leads
       WHERE project_id = ? AND created_month = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...common, 50, 0],
      { expectIndex: 'idx_leads_project_month' },
    ),
    benchmark(
      db,
      'deep-page-offset',
      `SELECT id, name, status, delivery_status, created_at
       FROM leads
       WHERE project_id = ? AND created_month = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...common, 50, Math.min(20_000, Math.floor(count * 0.5))],
      { expectIndex: 'idx_leads_project_month' },
    ),
    benchmark(
      db,
      'status-filter',
      `SELECT id, name, status, created_at
       FROM leads
       WHERE project_id = ? AND created_month = ? AND status = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...common, '신규', 50, 0],
      { expectIndex: 'idx_leads_project_status' },
    ),
    benchmark(
      db,
      'delivery-filter',
      `SELECT id, delivery_status, created_at
       FROM leads
       WHERE project_id = ? AND created_month = ? AND delivery_status = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...common, 'failed', 50, 0],
      { expectIndex: 'idx_leads_delivery_status' },
    ),
    benchmark(
      db,
      'month-count',
      `SELECT COUNT(*) AS total
       FROM leads
       WHERE project_id = ? AND created_month = ?`,
      common,
      { expectIndex: 'idx_leads_project_month' },
    ),
    benchmark(
      db,
      'scoped-text-search',
      `SELECT id, name, email, created_at
       FROM leads
       WHERE project_id = ? AND created_month = ?
         AND (
           LOWER(name) LIKE ?
           OR LOWER(phone) LIKE ?
           OR LOWER(email) LIKE ?
           OR LOWER(contact_key) LIKE ?
           OR LOWER(values_json) LIKE ?
         )
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...common, '%special-search-token%', '%special-search-token%', '%special-search-token%', '%special-search-token%', '%special-search-token%', 50, 0],
      { expectIndex: 'idx_leads_project_month' },
    ),
  ];

  db.close();
  return {
    rowCount: count,
    seedMs: Number(seedMs.toFixed(2)),
    checks,
    maxQueryMs: Math.max(...checks.map((item) => item.durationMs)),
  };
}

const results = SCENARIOS.map(runScenario);
assert(results.every((scenario) => scenario.checks.length === 6), 'all P8 benchmark checks must run');

console.log(JSON.stringify({
  ok: true,
  scope: 'pagero-p8-large-data-baseline',
  productionWrites: false,
  syntheticOnly: true,
  scenarios: results,
  findings: {
    indexedProjectMonthPaging: true,
    indexedStatusFilter: true,
    indexedDeliveryFilter: true,
    scopedTextSearchUsesProjectMonthIndex: true,
    offsetPaginationStillPresent: true,
    csvStreamingNotCoveredYet: true,
  },
}, null, 2));
