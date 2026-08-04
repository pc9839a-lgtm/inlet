import { decodeD1Page, decodeD1PageRevision, upsertD1Page } from '../server/storage/d1Adapter.mjs';

const TARGET_SLUG = 'dyjh';
const RECOVERY_ID = 'pagero-dyjh-20260804-v3';
const MIN_WEDDING_BLOCKS = 10;
const WEDDING_MARKERS = ['김도윤', '오지현'];

function rowsFromResult(result = {}) {
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result)) return result;
  return [];
}

function isWeddingPage(page = {}) {
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  if (blocks.length < MIN_WEDDING_BLOCKS) return false;
  let serialized = '';
  try {
    serialized = JSON.stringify(page);
  } catch {
    return false;
  }
  return WEDDING_MARKERS.every((marker) => serialized.includes(marker))
    || (serialized.includes('2026-11-28') && serialized.includes('삼산월드컨벤션'));
}

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

async function findWeddingRevision(db, current = null) {
  const queries = [];

  if (current?.id) {
    queries.push(db.prepare(`
      SELECT *
      FROM page_revisions
      WHERE page_id = ?
      ORDER BY created_at DESC, revision DESC, id DESC
      LIMIT 50
    `).bind(current.id).all());
  }

  queries.push(db.prepare(`
    SELECT *
    FROM page_revisions
    WHERE page_json LIKE ?
      AND page_json LIKE ?
    ORDER BY created_at DESC, revision DESC, id DESC
    LIMIT 50
  `).bind('%김도윤%', '%오지현%').all());

  queries.push(db.prepare(`
    SELECT *
    FROM page_revisions
    WHERE page_json LIKE ?
      AND page_json LIKE ?
    ORDER BY created_at DESC, revision DESC, id DESC
    LIMIT 50
  `).bind('%2026-11-28%', '%삼산월드컨벤션%').all());

  queries.push(db.prepare(`
    SELECT *
    FROM page_revisions
    WHERE page_json LIKE ?
    ORDER BY created_at DESC, revision DESC, id DESC
    LIMIT 50
  `).bind('%\"slug\":\"dyjh\"%').all());

  const seen = new Set();
  for (const query of queries) {
    const result = await query;
    for (const row of rowsFromResult(result)) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      const revision = decodeD1PageRevision(row);
      if (revision?.page && isWeddingPage(revision.page)) return revision;
    }
  }
  return null;
}

async function restoreDyjh(db) {
  const current = await findCurrentPage(db);
  if (
    current?.recoveredIncidentId === RECOVERY_ID
    && isWeddingPage(current)
  ) {
    return { page: current, status: 'already-restored' };
  }

  if (current && isWeddingPage(current)) {
    return { page: current, status: 'current-is-valid' };
  }

  const revision = await findWeddingRevision(db, current);
  if (!revision?.page) throw new Error('DYJH_WEDDING_REVISION_NOT_FOUND');

  const pageId = current?.id || revision.pageId || revision.page.id || '';
  const projectId = current?.projectId || revision.projectId || revision.page.projectId || '';
  if (!pageId || !projectId) throw new Error('DYJH_RECOVERY_IDENTITY_NOT_FOUND');

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE projects
    SET status = 'active', updated_at = ?
    WHERE id = ?
  `).bind(now, projectId).run();

  const restored = await upsertD1Page(db, {
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
    reason: `incident-recovery:${RECOVERY_ID}:${revision.id || 'revision'}`,
  });

  return {
    page: restored,
    status: `restored:${revision.id || revision.revision || 'revision'}`,
  };
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

  let recoveryStatus = 'not-run';
  try {
    if (!env.DB) throw new Error('D1_BINDING_MISSING');
    const result = await restoreDyjh(env.DB);
    recoveryStatus = result.status;
  } catch (error) {
    recoveryStatus = `failed:${String(error?.message || error).slice(0, 100)}`;
    console.error('dyjh emergency recovery failed', error);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('recovery-status') === '1') {
    return Response.json({ ok: !recoveryStatus.startsWith('failed:'), recoveryStatus }, {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  return serveApp(request, env, recoveryStatus);
}
