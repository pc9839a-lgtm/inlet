import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { DatabaseSync } from 'node:sqlite';

const migration = await readFile('migrations/0015_page_domain_ownership.sql', 'utf8');
const currentDomainUi = await readFile('src/panels/settings/CustomDomainSettingsSection.jsx', 'utf8');
const currentMiddleware = await readFile('functions/_middleware.js', 'utf8');

function createCoreDb() {
  const db = new DatabaseSync(':memory:');
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE projects (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'active',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE pages (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      page_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );
  `);
  return db;
}

function pageJson(hostname = '', extra = {}) {
  return JSON.stringify({
    title: 'qa',
    ...extra,
    integrations: {
      ...(extra.integrations || {}),
      domain: {
        ...(extra.integrations?.domain || {}),
        hostname,
      },
    },
  });
}

function domainRow(db, pageId) {
  return db.prepare('SELECT * FROM page_domains WHERE page_id = ?').get(pageId);
}

for (const token of [
  'CREATE TABLE IF NOT EXISTS page_domains',
  'hostname_key TEXT NOT NULL',
  'UNIQUE(page_id)',
  'idx_page_domains_hostname_owner',
  "$.integrations.domain.hostname",
  'trg_pages_domain_validate_insert',
  'trg_pages_domain_validate_update',
  'trg_pages_domain_sync_insert',
  'trg_pages_domain_sync_update',
  'trg_pages_domain_disconnect_update',
  'trg_projects_domain_disconnect_archive',
]) {
  assert(migration.includes(token), `custom-domain migration missing contract token: ${token}`);
}

assert(
  currentDomainUi.includes("updateIntegrations('domain'") && currentDomainUi.includes('hostname'),
  'current domain editor must keep integrations.domain.hostname as the saved UI contract',
);
assert(
  currentMiddleware.includes("$.integrations.domain.hostname"),
  'current custom-domain router must still read integrations.domain.hostname',
);

// Existing-data backfill: apex/www duplicates must not become two active owners.
{
  const db = createCoreDb();
  db.exec(`
    INSERT INTO projects (id, status) VALUES ('legacy-a', 'active'), ('legacy-b', 'active'), ('legacy-c', 'active');
  `);
  const insert = db.prepare('INSERT INTO pages (id, project_id, page_json, updated_at) VALUES (?, ?, ?, ?)');
  insert.run('legacy-page-a', 'legacy-a', pageJson('example.com'), '2026-09-01T00:00:00.000Z');
  insert.run('legacy-page-b', 'legacy-b', pageJson('www.example.com'), '2026-09-02T00:00:00.000Z');
  insert.run('legacy-page-c', 'legacy-c', pageJson('pagero.kr'), '2026-09-03T00:00:00.000Z');

  db.exec(migration);

  const exampleRows = db.prepare(`
    SELECT page_id, hostname, hostname_key, status
    FROM page_domains
    WHERE hostname_key = 'example.com'
    ORDER BY page_id
  `).all();
  assert.equal(exampleRows.length, 2, 'legacy apex/www claims should both be recorded');
  assert.equal(exampleRows.filter((row) => row.status !== 'disconnected').length, 1, 'only one legacy equivalent hostname may remain active');
  assert.equal(exampleRows.find((row) => row.status !== 'disconnected')?.page_id, 'legacy-page-b', 'newest legacy claim should win backfill ownership');
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM page_domains WHERE hostname_key = 'pagero.kr'").get().count,
    0,
    'Pagero-owned hostnames must not be backfilled as customer domains',
  );
  db.close();
}

// Runtime triggers: normalize, reserve, release, and prevent equivalent-host collisions.
{
  const db = createCoreDb();
  db.exec(migration);
  db.exec(`
    INSERT INTO projects (id, status) VALUES ('project-a', 'active'), ('project-b', 'active'), ('project-c', 'active');
  `);
  const insert = db.prepare('INSERT INTO pages (id, project_id, page_json, updated_at) VALUES (?, ?, ?, ?)');
  insert.run('page-a', 'project-a', pageJson('Example.NET'), '2026-09-17T01:00:00.000Z');

  let row = domainRow(db, 'page-a');
  assert.equal(row.hostname, 'example.net');
  assert.equal(row.hostname_key, 'example.net');
  assert.equal(row.status, 'pending');
  assert.equal(row.ssl_status, 'pending');

  assert.throws(
    () => insert.run('page-b-collision', 'project-b', pageJson('www.example.net'), '2026-09-17T01:01:00.000Z'),
    /UNIQUE constraint failed: page_domains\.hostname_key/,
    'www/apex equivalent domains must not be claimable by separate pages',
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM pages WHERE id = 'page-b-collision'").get().count,
    0,
    'a conflicting page write must roll back atomically',
  );

  assert.throws(
    () => insert.run('page-reserved', 'project-c', pageJson('sub.pagero.kr'), '2026-09-17T01:02:00.000Z'),
    /DOMAIN_INVALID/,
    'Pagero-owned hostnames must be rejected at the D1 boundary',
  );
  assert.throws(
    () => insert.run('page-bad-path', 'project-c', pageJson('example.org/path'), '2026-09-17T01:03:00.000Z'),
    /DOMAIN_INVALID/,
    'hostname values containing paths must be rejected at the D1 boundary',
  );

  // Operational status must survive unrelated page-json saves when hostname is unchanged.
  db.prepare(`
    UPDATE page_domains
    SET status = 'active', ssl_status = 'active', provider = 'cloudflare-pages', provider_domain_id = 'provider-1'
    WHERE page_id = 'page-a'
  `).run();
  db.prepare('UPDATE pages SET page_json = ? WHERE id = ?').run(pageJson('example.net', { description: 'changed' }), 'page-a');
  row = domainRow(db, 'page-a');
  assert.equal(row.status, 'active');
  assert.equal(row.ssl_status, 'active');
  assert.equal(row.provider_domain_id, 'provider-1');

  // Clearing the editor hostname releases ownership.
  db.prepare('UPDATE pages SET page_json = ? WHERE id = ?').run(pageJson(''), 'page-a');
  row = domainRow(db, 'page-a');
  assert.equal(row.status, 'disconnected');
  assert.equal(row.ssl_status, 'not_applicable');
  assert.ok(row.disconnected_at);

  // The released canonical hostname can now be claimed by another page.
  insert.run('page-b', 'project-b', pageJson('WWW.EXAMPLE.NET'), '2026-09-17T01:04:00.000Z');
  row = domainRow(db, 'page-b');
  assert.equal(row.hostname, 'www.example.net');
  assert.equal(row.hostname_key, 'example.net');
  assert.equal(row.status, 'pending');

  // Archiving a project releases its claim but restoring does not auto-reconnect it.
  db.prepare("UPDATE projects SET status = 'archived' WHERE id = 'project-b'").run();
  row = domainRow(db, 'page-b');
  assert.equal(row.status, 'disconnected');
  db.prepare("UPDATE projects SET status = 'active' WHERE id = 'project-b'").run();
  row = domainRow(db, 'page-b');
  assert.equal(row.status, 'disconnected');

  db.close();
}

console.log(JSON.stringify({
  ok: true,
  migration: '0015_page_domain_ownership.sql',
  canonicalSource: '$.integrations.domain.hostname',
  collisionKey: 'apex/www canonical hostname_key',
  archivedProjectRelease: true,
  protectedRootChanged: false,
}, null, 2));
