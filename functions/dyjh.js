import { decodeD1Page, decodeD1PageRevision, upsertD1Page } from '../server/storage/d1Adapter.mjs';

const TARGET_SLUG = 'dyjh';
const INCIDENT_CUTOFF = '2026-08-04T13:30:00.000Z';
const RECOVERY_ID = 'pagero-dyjh-20260804-v2';

async function findCurrentPage(db) {
  const row = await db.prepare(`
    SELECT *
    FROM pages
    WHERE slug = ?
    ORDER BY updated_at DESC, revision DESC, id DESC
    LIMIT 1
  `).bind(TARGET_SLUG).first();
  return row ? decodeD1Page(row) : null;
}

async function findPreIncidentRevision(db) {
  const row = await db.prepare(`
    SELECT *
    FROM page_revisions
    WHERE created_at < ?
      AND page_json LIKE ?
    ORDER BY created_at DESC, revision DESC, id DESC
    LIMIT 1
  `).bind(INCIDENT_CUTOFF, `%\"slug\":\"${TARGET_SLUG}\"%`).first();
  return row ? decodeD1PageRevision(row) : null;
}

async function restoreDyjh(db) {
  const current = await findCurrentPage(db);
  if (current?.recoveredIncidentId === RECOVERY_ID && Array.isArray(current.blocks) && current.blocks.length > 0) {
    return current;
  }

  const revision = await findPreIncidentRevision(db);
  if (!revision?.page || !Array.isArray(revision.page.blocks) || revision.page.blocks.length === 0) {
    throw new Error('DYJH_PRE_INCIDENT_REVISION_NOT_FOUND');
  }

  const pageId = current?.id || revision.pageId || revision.page.id || '';
  const projectId = current?.projectId || revision.projectId || revision.page.projectId || '';
  if (!pageId || !projectId) throw new Error('DYJH_RECOVERY_IDENTITY_NOT_FOUND');

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE projects
    SET status = 'active', updated_at = ?
    WHERE id = ?
  `).bind(now, projectId).run();

  return upsertD1Page(db, {
    ...revision.page,
    id: pageId,
    projectId,
    slug: TARGET_SLUG,
    createdAt: current?.createdAt || revision.page.createdAt || '',
    updatedAt: now,
    recoveredIncidentId: RECOVERY_ID,
  }, {
    pageId,
    projectId,
    slug: TARGET_SLUG,
    reason: `incident-recovery:${RECOVERY_ID}`,
  });
}

async function serveApp(request, env, recoveryStatus) {
  const appUrl = new URL('/index.html', request.url);
  const appRequest = new Request(appUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });
  const asset = await env.ASSETS.fetch(appRequest);
  const headers = new Headers(asset.headers);
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  headers.set('X-Pagero-Dyjh-Recovery', recoveryStatus);
  return new Response(asset.body, {
    status: asset.status,
    statusText: asset.statusText,
    headers,
  });
}

export async function onRequest({ request, env }) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  let recoveryStatus = 'restored';
  try {
    if (!env.DB) throw new Error('D1_BINDING_MISSING');
    await restoreDyjh(env.DB);
  } catch (error) {
    recoveryStatus = `failed:${String(error?.message || error).slice(0, 80)}`;
    console.error('dyjh emergency recovery failed', error);
  }

  return serveApp(request, env, recoveryStatus);
}
