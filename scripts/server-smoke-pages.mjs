import { assert, authHeaders, fetchWithTimeout, json, runSmoke } from './lib/serverSmokeHarness.mjs';

function stablePublicStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stablePublicStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stablePublicStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function publicRenderFingerprint(page = {}) {
  return stablePublicStringify({
    title: page.title || '',
    slug: page.slug || '',
    theme: page.theme || {},
    blocks: Array.isArray(page.blocks) ? page.blocks : [],
    settings: page.settings || {},
  });
}

async function assertPublicPageMatches(ctx, pagePath, expectedPage, message) {
  const publicRead = await fetchWithTimeout(`${ctx.baseUrl}${pagePath}?public=1&fresh=${Date.now()}`, {}, 5000);
  const publicData = await publicRead.json();
  assert(publicRead.ok, `${message}: public page read failed`);
  assert(/no-store/i.test(publicRead.headers.get('cache-control') || ''), `${message}: public page read must bypass cached content`);
  assert(
    publicRenderFingerprint(publicData.page) === publicRenderFingerprint(expectedPage),
    `${message}: public page content does not match saved page`,
  );
  return publicData.page;
}

await runSmoke('server-smoke-pages', async ({ baseUrl }) => {
  const ctx = { baseUrl };
  const smokeId = `smoke-page-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const project = { projectId: `smoke-pages-${smokeId}`, slug: smokeId };
  const query = new URLSearchParams(project).toString();
  const page = {
    title: 'Smoke Page',
    slug: smokeId,
    theme: { accent: '#2563eb', bg: '#f8fafc', text: '#111827' },
    settings: { topNavFixed: true, bottomBarFixed: true },
    blocks: [
      { id: 'hero', type: 'hero', visible: true, s: { title: 'Smoke', body: 'Page' } },
      {
        id: 'text-style',
        type: 'text',
        visible: true,
        s: {
          title: 'Styled Text',
          body: 'Text widget style must survive save.',
          layout: 'card',
          bgEnabled: true,
          bgColor: '#fff7ed',
          padding: 28,
          marginY: 30,
          radius: 26,
          shadow: true,
          spacingPreset: 'wide',
          radiusPreset: 'pill',
        },
      },
      { id: 'image-style', type: 'image', visible: true, s: { mode: 'single', image: '', marginY: 34, imageHeightPx: 300, imageX: 63, imageY: 42 } },
      {
        id: 'reservation-style',
        type: 'reservation',
        visible: true,
        s: {
          title: 'Reserve',
          desc: 'Reserve smoke',
          marginY: 27,
          buttonHover: 'zoom',
          buttonColorMode: 'custom',
          buttonColor: '#f97316',
          buttonTextColor: '#ffffff',
          duplicatePhone: 'block',
          duplicateWindow: '7d',
        },
      },
      { id: 'form', type: 'form', visible: true, s: { title: '문의', submit: '접수' } },
    ],
  };

  const pagePath = `/api/pages/${encodeURIComponent(smokeId)}`;
  const saved = await json({ baseUrl }, 'POST', pagePath, { project, page });
  assert(saved.res.ok && saved.data.page?.slug === smokeId, 'page save failed');
  const savedText = saved.data.page?.blocks?.find((block) => block.id === 'text-style');
  assert(savedText?.s?.bgEnabled === true && savedText?.s?.padding === 28 && savedText?.s?.marginY === 30 && savedText?.s?.shadow === true && savedText?.s?.spacingPreset === 'wide' && savedText?.s?.radiusPreset === 'pill', 'text widget style settings should survive page save');
  const savedImage = saved.data.page?.blocks?.find((block) => block.id === 'image-style');
  assert(savedImage?.s?.marginY === 34 && savedImage?.s?.imageHeightPx === 300 && savedImage?.s?.imageX === 63 && savedImage?.s?.imageY === 42, 'image widget position/style settings should survive page save');
  const savedReservation = saved.data.page?.blocks?.find((block) => block.id === 'reservation-style');
  assert(savedReservation?.s?.marginY === 27 && savedReservation?.s?.buttonHover === 'zoom' && savedReservation?.s?.buttonColorMode === 'custom' && savedReservation?.s?.buttonColor === '#f97316', 'reservation widget style settings should survive page save');
  await assertPublicPageMatches(ctx, pagePath, saved.data.page, 'initial page save');

  const emailLocked = await fetchWithTimeout(`${baseUrl}${pagePath}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Email': 'owner@example.test',
    }),
    body: JSON.stringify({
      project,
      page: {
        ...page,
        plan: 'free',
        integrations: {
          email: { enabled: true, to: 'other@example.test', consult: true, reservation: true },
        },
      },
    }),
  }, 5000);
  const emailLockedData = await emailLocked.json();
  assert(emailLocked.ok, 'free page email lock save failed');
  assert(emailLockedData.page?.integrations?.email?.to === 'owner@example.test', 'free page email alert recipient should be forced to account email');
  assert(emailLockedData.page?.integrations?.email?.lockedToAccount === true, 'free page email alert should be marked locked to account');

  const read = await json({ baseUrl }, 'GET', `${pagePath}?${query}`);
  assert(read.res.ok && read.data.page?.integrations?.email?.to === 'owner@example.test', 'page read failed or email lock was not persisted');

  const emailRelock = await fetchWithTimeout(`${baseUrl}${pagePath}`, {
    method: 'POST',
    headers: authHeaders({
      'Content-Type': 'application/json',
      'X-Inlet-Email': 'owner@example.test',
    }),
    body: JSON.stringify({
      project,
      page: {
        ...read.data.page,
        integrations: {
          ...(read.data.page?.integrations || {}),
          email: { ...(read.data.page?.integrations?.email || {}), enabled: true, to: 'changed@example.test', lockedToAccount: false },
        },
      },
    }),
  }, 5000);
  const emailRelockData = await emailRelock.json();
  assert(emailRelock.ok, 'free page email relock save failed');
  assert(emailRelockData.page?.integrations?.email?.to === 'owner@example.test', 'free page email alert recipient should not be editable after initial lock');
  assert(emailRelockData.page?.integrations?.email?.lockedToAccount === true, 'free page email alert relock should keep locked marker');

  const updated = await json({ baseUrl }, 'POST', pagePath, {
    project,
    page: {
      ...page,
      title: 'Smoke Page Updated',
      theme: { ...page.theme, accent: '#f97316' },
      blocks: page.blocks.map((block) => (
        block.id === 'hero'
          ? { ...block, s: { ...block.s, title: 'Smoke Updated', body: 'Updated public page' } }
          : block
      )),
    },
  });
  assert(updated.res.ok && updated.data.page?.title === 'Smoke Page Updated', 'page update failed');
  await assertPublicPageMatches(ctx, pagePath, updated.data.page, 'page update save');

  const secondSlug = `${smokeId}-second`;
  const secondPath = `/api/pages/${encodeURIComponent(secondSlug)}`;
  const second = await json({ baseUrl }, 'POST', secondPath, {
    project: { ...project, slug: secondSlug },
    page: { ...page, id: `${smokeId}-second-id`, slug: secondSlug, title: 'Smoke Page Second' },
  });
  assert(second.res.ok && second.data.page?.slug === secondSlug, 'second page save failed');
  assert(second.data.page?.id !== updated.data.page?.id, 'second page should not overwrite the first page id');

  const firstAfterSecond = await json({ baseUrl }, 'GET', `${pagePath}?${query}`);
  assert(firstAfterSecond.res.ok && firstAfterSecond.data.page?.title === 'Smoke Page Updated', 'second page save should not overwrite the first page');

  const globalSlugConflict = await json({ baseUrl }, 'POST', pagePath, {
    project: { projectId: `${project.projectId}-other`, ownerId: 'local-user', slug: smokeId },
    page: { ...page, id: `${smokeId}-duplicate-id`, title: 'Smoke Page Duplicate Slug' },
  });
  assert(globalSlugConflict.res.status === 409, `global page slug conflict expected 409, got ${globalSlugConflict.res.status}`);
  assert(globalSlugConflict.data.code === 'PAGE_SLUG_CONFLICT', 'global page slug conflict code missing');

  const renamedSlug = `${smokeId}-renamed`;
  const renamedPath = `/api/pages/${encodeURIComponent(renamedSlug)}`;
  const renamed = await json({ baseUrl }, 'POST', renamedPath, {
    project: { ...project, slug: renamedSlug },
    page: { ...updated.data.page, slug: renamedSlug, title: 'Smoke Page Renamed' },
  });
  assert(renamed.res.ok && renamed.data.page?.id === updated.data.page.id && renamed.data.page?.slug === renamedSlug, 'page slug rename should update the existing project page');

  const guarded = await json({ baseUrl }, 'POST', renamedPath, {
    project: { ...project, slug: renamedSlug },
    expectedUpdatedAt: renamed.data.page.updatedAt,
    page: { ...renamed.data.page, title: 'Smoke Page Guarded' },
  });
  assert(guarded.res.ok && guarded.data.page?.title === 'Smoke Page Guarded', 'page guarded update failed');

  const publicPage = await assertPublicPageMatches(ctx, renamedPath, guarded.data.page, 'guarded page save');
  assert(publicPage?.title === 'Smoke Page Guarded', 'public page read should not require auth headers');

  const renamedQuery = new URLSearchParams({ ...project, slug: renamedSlug }).toString();
  const conflict = await json({ baseUrl }, 'POST', renamedPath, {
    project: { ...project, slug: renamedSlug },
    expectedUpdatedAt: updated.data.page.updatedAt,
    page: { ...renamed.data.page, title: 'Smoke Page Stale' },
  });
  assert(conflict.res.status === 409, `page conflict expected 409, got ${conflict.res.status}`);
  assert(conflict.data.code === 'PAGE_REVISION_CONFLICT', 'page conflict code missing');
  assert(conflict.data.latest?.updatedAt === guarded.data.page.updatedAt, 'page conflict latest metadata missing');
  assert(conflict.data.page?.title === 'Smoke Page Guarded', 'page conflict latest page missing');

  const revisions = await json({ baseUrl }, 'GET', `${renamedPath}/revisions?${renamedQuery}`);
  assert(revisions.res.ok && Array.isArray(revisions.data.revisions) && revisions.data.revisions.length >= 1, 'page revisions failed');

  const revisionId = revisions.data.revisions[0]?.id;
  const revision = await json({ baseUrl }, 'GET', `${renamedPath}/revisions/${encodeURIComponent(revisionId)}?${renamedQuery}`);
  assert(revision.res.ok && revision.data.revision?.id === revisionId, 'page revision read failed');

  const oldestRevision = revisions.data.revisions[revisions.data.revisions.length - 1]?.id;
  const restored = await json({ baseUrl }, 'POST', `${renamedPath}/restore`, { project: { ...project, slug: renamedSlug }, revisionId: oldestRevision });
  assert(restored.res.ok && restored.data.page?.slug === renamedSlug, 'page restore failed');

  const afterRestore = await json({ baseUrl }, 'GET', `${renamedPath}/revisions?${renamedQuery}`);
  assert(afterRestore.res.ok && afterRestore.data.revisions.length >= revisions.data.revisions.length + 2, 'page restore should keep backup and restored revisions');
});
