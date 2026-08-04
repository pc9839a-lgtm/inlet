import { decodeD1Page, decodeD1PageRevision, upsertD1Page } from '../server/storage/d1Adapter.mjs';

const TARGET_SLUG = 'dyjh';
const RECOVERY_ID = 'pagero-dyjh-20260804-v4';
const INCIDENT_CUTOFF = Date.parse('2026-08-04T13:30:00.000Z');
const MIN_RECOVERY_BLOCKS = 10;

function rowsFromResult(result = {}) {
  if (Array.isArray(result?.results)) return result.results;
  if (Array.isArray(result)) return result;
  return [];
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {});
  } catch {
    return '';
  }
}

function revisionScore(revision = {}) {
  const page = revision.page || {};
  const blocks = Array.isArray(page.blocks) ? page.blocks : [];
  const serialized = safeJson(page);
  const slug = String(page.slug || '').replace(/^\/+|\/+$/g, '');
  const createdAt = Date.parse(String(revision.revisionAt || revision.createdAt || ''));
  let score = blocks.length * 50;

  if (slug === TARGET_SLUG) score += 1500;
  if (serialized.includes('김도윤')) score += 800;
  if (serialized.includes('오지현')) score += 800;
  if (serialized.includes('도윤')) score += 300;
  if (serialized.includes('지현')) score += 300;
  if (serialized.includes('2026-11-28')) score += 700;
  if (serialized.includes('삼산월드컨벤션')) score += 700;
  if (serialized.includes('부평구 체육관로 60')) score += 500;
  if (serialized.includes('dyjh-wedding-20261128')) score += 500;
  if (Number.isFinite(createdAt) && createdAt < INCIDENT_CUTOFF) score += 250;

  if (serialized.includes('상담 DB 랜딩페이지')) score -= 1200;
  if (serialized.includes('모바일 랜딩을\\n쉽고 예쁘게')) score -= 1200;
  if (blocks.length === 0) score -= 5000;

  return { score, blocks: blocks.length, slug, serialized };
}

function isUsableCandidate(revision = {}) {
  const result = revisionScore(revision);
  if (result.blocks < MIN_RECOVERY_BLOCKS) return false;
  return result.slug === TARGET_SLUG
    || result.serialized.includes('도윤')
    || result.serialized.includes('지현')
    || result.serialized.includes('2026-11-28');
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

async function loadRevisionRows(db, current = null) {
  const rows = [];
  const seen = new Set();

  const append = (result) => {
    for (const row of rowsFromResult(result)) {
      if (!row?.id || seen.has(row.id)) continue;
      seen.add(row.id);
      rows.push(row);
    }
  };

  if (current?.id) {
    append(await db.prepare(`
      SELECT *
      FROM page_revisions
      WHERE page_id = ?
      ORDER BY created_at DESC, revision DESC, id DESC
      LIMIT 300
    `).bind(current.id).all());
  }

  append(await db.prepare(`
    SELECT *
    FROM page_revisions
    WHERE page_json LIKE ?
       OR page_json LIKE ?
       OR page_json LIKE ?
       OR page_json LIKE ?
       OR page_json LIKE ?
    ORDER BY created_at DESC, revision DESC, id DESC
    LIMIT 500
  `).bind('%dyjh%', '%도윤%', '%지현%', '%2026-11-28%', '%삼산월드컨벤션%').all());

  return rows;
}

async function findBestRevision(db, current = null) {
  const rows = await loadRevisionRows(db, current);
  const candidates = rows
    .map((row) => decodeD1PageRevision(row))
    .filter(isUsableCandidate)
    .map((revision) => ({ revision, ...revisionScore(revision) }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (right.blocks !== left.blocks) return right.blocks - left.blocks;
      return Date.parse(String(right.revision.revisionAt || '')) - Date.parse(String(left.revision.revisionAt || ''));
    });

  return {
    best: candidates[0] || null,
    candidateCount: candidates.length,
    scannedCount: rows.length,
    preview: candidates.slice(0, 5).map((item) => ({
      id: item.revision.id,
      pageId: item.revision.pageId,
      projectId: item.revision.projectId,
      revisionAt: item.revision.revisionAt,
      score: item.score,
      blocks: item.blocks,
      slug: item.slug,
      title: item.revision.page?.title || '',
    })),
  };
}

async function restoreDyjh(db) {
  const current = await findCurrentPage(db);
  const currentBlocks = Array.isArray(current?.blocks) ? current.blocks.length : 0;
  const currentSerialized = safeJson(current);
  const currentLooksValid = currentBlocks >= MIN_RECOVERY_BLOCKS
    && !currentSerialized.includes('상담 DB 랜딩페이지')
    && (currentSerialized.includes('도윤') || currentSerialized.includes('지현') || currentSerialized.includes('2026-11-28'));

  if (current?.recoveredIncidentId === RECOVERY_ID && currentLooksValid) {
    return { page: current, status: 'already-restored', currentBlocks };
  }

  if (currentLooksValid) {
    return { page: current, status: 'current-is-valid', currentBlocks };
  }

  const selection = await findBestRevision(db, current);
  const candidate = selection.best;
  if (!candidate?.revision?.page) {
    const error = new Error('DYJH_RECOVERY_CANDIDATE_NOT_FOUND');
    error.details = selection;
    throw error;
  }

  const revision = candidate.revision;
  const pageId = current?.id || revision.pageId || revision.page.id || '';
  const projectId = current?.projectId || revision.projectId || revision.page.projectId || '';
  if (!pageId || !projectId) {
    const error = new Error('DYJH_RECOVERY_IDENTITY_NOT_FOUND');
    error.details = { selection };
    throw error;
  }

  const now = new Date().toISOString();
  await db.prepare(`
    UPDATE projects
    SET status = 'active', slug = ?, updated_at = ?
    WHERE id = ?
  `).bind(TARGET_SLUG, now, projectId).run();

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
    status: 'restored',
    currentBlocks,
    selectedRevision: {
      id: revision.id,
      pageId,
      projectId,
      revisionAt: revision.revisionAt,
      score: candidate.score,
      blocks: candidate.blocks,
      slug: candidate.slug,
      title: revision.page?.title || '',
    },
    candidateCount: selection.candidateCount,
    scannedCount: selection.scannedCount,
    preview: selection.preview,
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
  headers.set('X-Pagero-Dyjh-Recovery', String(recoveryStatus || 'unknown').slice(0, 180));
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

  let result = null;
  let errorPayload = null;
  try {
    if (!env.DB) throw new Error('D1_BINDING_MISSING');
    result = await restoreDyjh(env.DB);
  } catch (error) {
    errorPayload = {
      message: String(error?.message || error).slice(0, 180),
      details: error?.details || null,
    };
    console.error('dyjh emergency recovery failed', error);
  }

  const url = new URL(request.url);
  if (url.searchParams.get('recovery-status') === '1') {
    return Response.json({
      ok: !errorPayload,
      recoveryId: RECOVERY_ID,
      result,
      error: errorPayload,
    }, {
      status: errorPayload ? 500 : 200,
      headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' },
    });
  }

  return serveApp(request, env, errorPayload ? `failed:${errorPayload.message}` : result?.status || 'not-run');
}
