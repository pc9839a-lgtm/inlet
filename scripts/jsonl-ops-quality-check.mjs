import { appendFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { assert, json, runSmoke } from './lib/serverSmokeHarness.mjs';

async function backupCount(dataDir, projectId) {
  const backupDir = path.join(dataDir, 'projects', projectId, '.backups');
  try {
    const files = await readdir(backupDir);
    return files.filter((file) => file.includes('leads.jsonl') && file.endsWith('.bak')).length;
  } catch {
    return 0;
  }
}

await runSmoke('jsonl-ops-quality-check', async ({ baseUrl, dataDir }) => {
  const project = { projectId: 'jsonl-ops', slug: 'jsonl-ops' };
  const query = new URLSearchParams(project).toString();
  const page = { title: 'JSONL Ops', slug: 'jsonl-ops' };

  for (const lead of [
    { id: 'dup', name: 'First', phone: '010-0000-0001', memo: 'first' },
    { id: 'keep', name: 'Keep', phone: '010-0000-0002', memo: 'keep' },
    { id: 'tail', name: 'Tail', phone: '010-0000-0003', memo: 'tail' },
  ]) {
    const saved = await json({ baseUrl }, 'POST', '/api/leads', { project, page, lead });
    assert(saved.res.ok, `lead append failed: ${lead.id}`);
  }

  const leadFile = path.join(dataDir, 'projects', project.projectId, 'leads.jsonl');
  await appendFile(leadFile, `${JSON.stringify({ id: 'dup', name: 'Latest', phone: '010-0000-0004', memo: 'latest', updatedAt: new Date().toISOString() })}\n`, 'utf8');

  const firstPage = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=2`);
  assert(firstPage.res.ok && firstPage.data.leads.length === 2 && firstPage.data.total === 4 && firstPage.data.hasMore, 'cursor first page failed');
  const secondPage = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=2&cursor=${firstPage.data.nextCursor}`);
  assert(secondPage.res.ok && secondPage.data.leads.length === 2 && !secondPage.data.hasMore, `cursor second page failed: ${JSON.stringify({ status: secondPage.res.status, count: secondPage.data.leads?.length, hasMore: secondPage.data.hasMore, error: secondPage.data.error })}`);

  const dryRun = await json({ baseUrl }, 'POST', '/api/leads/compact', { project, dryRun: true });
  assert(dryRun.res.ok && dryRun.data.dryRun === true && dryRun.data.removed === 1, 'compact dry-run contract failed');
  assert(await backupCount(dataDir, project.projectId) === 0, 'compact dry-run must not create backup');

  const compact = await json({ baseUrl }, 'POST', '/api/leads/compact', { project, dryRun: false });
  assert(compact.res.ok && compact.data.dryRun === false && compact.data.after === 3, 'compact execution contract failed');
  assert(await backupCount(dataDir, project.projectId) >= 1, 'compact execution must create backup before rewrite');

  const backups = await json({ baseUrl }, 'GET', `/api/jsonl/backups?${query}&type=leads`);
  assert(backups.res.ok && backups.data.current?.lines === 3 && backups.data.backups?.length >= 1, 'jsonl backup listing failed');
  const backupId = backups.data.backups[0].id;

  const restoreDryRun = await json({ baseUrl }, 'POST', '/api/jsonl/restore', { project, type: 'leads', backup: backupId });
  assert(restoreDryRun.res.ok && restoreDryRun.data.dryRun === true && restoreDryRun.data.backup?.lines === 4, 'jsonl restore dry-run failed');

  const restore = await json({ baseUrl }, 'POST', '/api/jsonl/restore', { project, type: 'leads', backup: backupId, confirm: true });
  assert(restore.res.ok && restore.data.dryRun === false && restore.data.after?.lines === 4 && restore.data.currentBackup, 'jsonl confirmed restore failed');

  const afterRestoreBackups = await json({ baseUrl }, 'GET', `/api/jsonl/backups?${query}&type=leads`);
  assert(afterRestoreBackups.res.ok && afterRestoreBackups.data.backups.length >= backups.data.backups.length + 1, 'jsonl restore should preserve current file as backup');

  const after = await json({ baseUrl }, 'GET', `/api/leads?${query}&limit=10`);
  assert(after.res.ok && after.data.total === 4, 'restored total mismatch');
  const latestDup = after.data.leads.find((lead) => lead.id === 'dup');
  assert(latestDup?.memo === 'latest', 'compact should keep latest lead by id');

  const backupsBeforeRepair = await backupCount(dataDir, project.projectId);
  await appendFile(leadFile, '{bad json\n', 'utf8');

  const corruptionReport = await json({ baseUrl }, 'GET', `/api/jsonl/report?${query}&type=leads`);
  assert(
    corruptionReport.res.ok
      && corruptionReport.data.current?.validLines === 4
      && corruptionReport.data.current?.invalidLines === 1
      && corruptionReport.data.invalidLines?.[0]?.line === 5,
    'jsonl corruption report failed',
  );

  const repairDryRun = await json({ baseUrl }, 'POST', '/api/jsonl/repair', { project, type: 'leads' });
  assert(
    repairDryRun.res.ok
      && repairDryRun.data.dryRun === true
      && repairDryRun.data.current?.invalidLines === 1
      && repairDryRun.data.invalidLines?.length === 1,
    'jsonl repair dry-run failed',
  );
  assert(await backupCount(dataDir, project.projectId) === backupsBeforeRepair, 'repair dry-run must not create backup');

  const repair = await json({ baseUrl }, 'POST', '/api/jsonl/repair', { project, type: 'leads', confirm: true });
  assert(
    repair.res.ok
      && repair.data.dryRun === false
      && repair.data.changed === true
      && repair.data.repaired === 1
      && repair.data.kept === 4
      && repair.data.currentBackup
      && repair.data.quarantine,
    'jsonl confirmed repair failed',
  );

  const repairedReport = await json({ baseUrl }, 'GET', `/api/jsonl/report?${query}&type=leads`);
  assert(
    repairedReport.res.ok
      && repairedReport.data.current?.validLines === 4
      && repairedReport.data.current?.invalidLines === 0
      && repairedReport.data.invalidLines?.length === 0,
    'jsonl repair should remove invalid lines',
  );
}, { timeoutMs: 10000 });
