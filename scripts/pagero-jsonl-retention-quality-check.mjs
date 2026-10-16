import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readdir, readFile, symlink, utimes, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { planJsonlRetention, runJsonlRetention } from './pagero-jsonl-retention.mjs';

const root = await mkdtemp(path.join(os.tmpdir(), 'pagero-jsonl-retention-'));
const now = Date.UTC(2026, 9, 16);
const day = 86400000;
const project = path.join(root, 'projects', 'sample');
const backups = path.join(project, '.backups');
const quarantine = path.join(project, '.quarantine');
const stamp = '2026-08-01T01-02-03-000Z';
const current = path.join(project, 'leads.jsonl');
const files = [
  ['.backups', 'leads.jsonl.' + stamp + '.leads-rewrite.bak', 80],
  ['.backups', 'leads.jsonl.2026-09-01T01-02-03-000Z.leads-rewrite.bak', 45],
  ['.backups', 'leads.jsonl.2026-10-01T01-02-03-000Z.leads-rewrite.bak', 15],
  ['.backups', 'events.jsonl.' + stamp + '.events-rewrite.bak', 80],
  ['.quarantine', 'leads.jsonl.' + stamp + '.leads-invalid.jsonl', 60],
  ['.quarantine', 'leads.jsonl.2026-09-01T01-02-03-000Z.leads-invalid.jsonl', 45],
  ['.quarantine', 'leads.jsonl.2026-10-01T01-02-03-000Z.leads-invalid.jsonl', 15],
];
try {
  await mkdir(backups, { recursive: true });
  await mkdir(quarantine, { recursive: true });
  await writeFile(current, 'CUSTOMER DATA MUST REMAIN');
  for (const [dir, name, age] of files) {
    const file = path.join(project, dir, name);
    await writeFile(file, 'test PII payload');
    const mtime = new Date(now - age * day);
    await utimes(file, mtime, mtime);
  }
  const unrelated = path.join(backups, 'keep-me.txt');
  await writeFile(unrelated, 'unrelated data');
  await writeFile(path.join(backups, 'leads.jsonl.untrusted.bak'), 'not a generated backup');
  // A symlink must never lead cleanup outside the root.
  const outside = await mkdtemp(path.join(os.tmpdir(), 'pagero-jsonl-outside-'));
  try {
    await symlink(outside, path.join(root, 'projects', 'linked-project'));
    await mkdir(path.join(outside, '.backups'));
    await writeFile(path.join(outside, '.backups', 'leads.jsonl.' + stamp + '.leads-rewrite.bak'), 'outside');
    const planned = await planJsonlRetention({ dataDir: root, now });
    assert.equal(planned.inspected, 7, 'only normal generated files are included');
    assert.equal(planned.candidates.length, 2, 'preserve two newest backups and one newest quarantine per file');
    assert(planned.candidates.every(x => !x.relativePath.includes('linked-project')), 'skip symlink projects');
    const preview = await runJsonlRetention({ dataDir: root, now });
    assert(preview.dryRun && preview.deleted === 0 && preview.expired === 2);
    assert.equal((await readdir(backups)).length, 5, 'dry-run must not delete files');
    await assert.rejects(() => runJsonlRetention({ dataDir: root, now, execute: true, env: {} }), /approval/);
    await assert.rejects(() => runJsonlRetention({ dataDir: root, now, execute: true, env: {
      PAGERO_JSONL_RETENTION_WRITE: '1', PAGERO_JSONL_RETENTION_APPROVAL: 'I_APPROVE_PAGERO_JSONL_RETENTION',
      PAGERO_JSONL_RETENTION_ALLOWED_ROOT: outside,
    }}), /mismatch/);
    const env = { PAGERO_JSONL_RETENTION_WRITE: '1', PAGERO_JSONL_RETENTION_APPROVAL: 'I_APPROVE_PAGERO_JSONL_RETENTION', PAGERO_JSONL_RETENTION_ALLOWED_ROOT: root };
    const limited = await runJsonlRetention({ dataDir: root, now, execute: true, env, maxDeletes: 1 });
    assert.equal(limited.deleted, 1);
    const remaining = await runJsonlRetention({ dataDir: root, now, execute: true, env });
    assert.equal(remaining.deleted, 1);
    const idempotent = await runJsonlRetention({ dataDir: root, now, execute: true, env });
    assert.equal(idempotent.deleted, 0);
    assert.equal(await readFile(current, 'utf8'), 'CUSTOMER DATA MUST REMAIN');
    assert.equal(await readFile(unrelated, 'utf8'), 'unrelated data');
    assert.equal((await readdir(backups)).filter(x => x.endsWith('.bak')).length, 4, 'one old backup removed; retained two latest leads and only events backup');
    assert.equal((await readdir(quarantine)).length, 2, 'older quarantine removed while newest stays');
  } finally {
    await rm(outside, { recursive: true, force: true });
  }
  console.log(JSON.stringify({ ok: true, name: 'pagero-jsonl-retention', inspect: 7, preservedRecent: true, dryRun: true, gatedWrite: true, scope: 'isolated-fixture-only' }));
} finally {
  await rm(root, { recursive: true, force: true });
}
