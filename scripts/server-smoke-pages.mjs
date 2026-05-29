import { assert, json, runSmoke } from './lib/serverSmokeHarness.mjs';

await runSmoke('server-smoke-pages', async ({ baseUrl }) => {
  const smokeId = `smoke-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const project = { projectId: `smoke-pages-${smokeId}`, slug: smokeId };
  const query = new URLSearchParams(project).toString();
  const page = {
    title: 'Smoke Page',
    slug: smokeId,
    blocks: [{ id: 'hero', type: 'hero', visible: true, s: { title: 'Smoke', body: 'Page' } }],
  };

  const pagePath = `/api/pages/${encodeURIComponent(smokeId)}`;
  const saved = await json({ baseUrl }, 'POST', pagePath, { project, page });
  assert(saved.res.ok && saved.data.page?.slug === smokeId, 'page save failed');

  const read = await json({ baseUrl }, 'GET', `${pagePath}?${query}`);
  assert(read.res.ok && read.data.page?.title === 'Smoke Page', 'page read failed');

  const updated = await json({ baseUrl }, 'POST', pagePath, {
    project,
    page: { ...page, title: 'Smoke Page Updated' },
  });
  assert(updated.res.ok && updated.data.page?.title === 'Smoke Page Updated', 'page update failed');

  const guarded = await json({ baseUrl }, 'POST', pagePath, {
    project,
    expectedUpdatedAt: updated.data.page.updatedAt,
    page: { ...page, title: 'Smoke Page Guarded' },
  });
  assert(guarded.res.ok && guarded.data.page?.title === 'Smoke Page Guarded', 'page guarded update failed');

  const conflict = await json({ baseUrl }, 'POST', pagePath, {
    project,
    expectedUpdatedAt: updated.data.page.updatedAt,
    page: { ...page, title: 'Smoke Page Stale' },
  });
  assert(conflict.res.status === 409, `page conflict expected 409, got ${conflict.res.status}`);
  assert(conflict.data.code === 'PAGE_REVISION_CONFLICT', 'page conflict code missing');
  assert(conflict.data.latest?.updatedAt === guarded.data.page.updatedAt, 'page conflict latest metadata missing');
  assert(conflict.data.page?.title === 'Smoke Page Guarded', 'page conflict latest page missing');

  const revisions = await json({ baseUrl }, 'GET', `${pagePath}/revisions?${query}`);
  assert(revisions.res.ok && Array.isArray(revisions.data.revisions) && revisions.data.revisions.length >= 1, 'page revisions failed');

  const revisionId = revisions.data.revisions[0]?.id;
  const revision = await json({ baseUrl }, 'GET', `${pagePath}/revisions/${encodeURIComponent(revisionId)}?${query}`);
  assert(revision.res.ok && revision.data.revision?.id === revisionId, 'page revision read failed');

  const oldestRevision = revisions.data.revisions[revisions.data.revisions.length - 1]?.id;
  const restored = await json({ baseUrl }, 'POST', `${pagePath}/restore`, { project, revisionId: oldestRevision });
  assert(restored.res.ok && restored.data.page?.slug === smokeId, 'page restore failed');

  const afterRestore = await json({ baseUrl }, 'GET', `${pagePath}/revisions?${query}`);
  assert(afterRestore.res.ok && afterRestore.data.revisions.length >= revisions.data.revisions.length + 2, 'page restore should keep backup and restored revisions');
});
