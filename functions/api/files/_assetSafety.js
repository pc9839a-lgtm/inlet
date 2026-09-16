import {
  projectImagesPrefix,
  projectMediaPrefix,
  safeProjectId,
  validateObjectKey,
} from './_files.js';

const USAGE_LIMIT = 25;

function lowerEncodedSlashes(value = '') {
  return String(value || '').replace(/%[0-9A-F]{2}/g, (match) => match.toLowerCase());
}

export function assetReferenceNeedles(key = '') {
  const safeKey = validateObjectKey(key);
  const encoded = encodeURIComponent(safeKey);
  return [...new Set([safeKey, encoded, lowerEncodedSlashes(encoded)])];
}

export function projectAssetKind(project = {}, key = '') {
  const safeKey = validateObjectKey(key);
  const projectId = safeProjectId(project);
  if (safeKey.startsWith(projectImagesPrefix(projectId))) return 'image';
  if (safeKey.startsWith(projectMediaPrefix(projectId))) return 'video';
  const error = new Error('이 프로젝트의 이미지 또는 영상만 삭제할 수 있습니다.');
  error.status = 400;
  error.code = 'ASSET_PROJECT_SCOPE';
  throw error;
}

export function pageJsonReferencesAssetKey(pageJson = '', key = '') {
  const raw = typeof pageJson === 'string' ? pageJson : JSON.stringify(pageJson || {});
  return assetReferenceNeedles(key).some((needle) => raw.includes(needle));
}

function resultRows(result = {}) {
  return Array.isArray(result?.results) ? result.results : [];
}

function revisionLabel(row = {}) {
  let page = {};
  try {
    page = JSON.parse(String(row.page_json || '{}')) || {};
  } catch {
    page = {};
  }
  return {
    pageId: String(row.page_id || page.id || ''),
    revision: Number(row.revision || page.revision || 0),
    slug: String(page.slug || ''),
    title: String(page.title || page.slug || '페이지'),
  };
}

export async function findProjectAssetUsage(db, project = {}, key = '') {
  if (!db || typeof db.prepare !== 'function') {
    const error = new Error('안전 삭제 확인을 위한 서버 데이터베이스 연결이 필요합니다.');
    error.status = 503;
    error.code = 'ASSET_USAGE_CHECK_UNAVAILABLE';
    throw error;
  }

  const projectId = safeProjectId(project);
  const needles = assetReferenceNeedles(key);
  const usageWhere = needles.map(() => 'instr(page_json, ?) > 0').join(' OR ');

  const pageResult = await db.prepare(`
    SELECT id, slug, title
    FROM pages
    WHERE project_id = ?
      AND (${usageWhere})
    ORDER BY updated_at DESC
    LIMIT ${USAGE_LIMIT}
  `).bind(projectId, ...needles).all();

  const revisionResult = await db.prepare(`
    SELECT page_id, revision, page_json
    FROM page_revisions
    WHERE project_id = ?
      AND (${usageWhere})
    ORDER BY created_at DESC
    LIMIT ${USAGE_LIMIT}
  `).bind(projectId, ...needles).all();

  return {
    pages: resultRows(pageResult).map((row) => ({
      pageId: String(row.id || ''),
      slug: String(row.slug || ''),
      title: String(row.title || row.slug || '페이지'),
    })),
    revisions: resultRows(revisionResult).map(revisionLabel),
  };
}
