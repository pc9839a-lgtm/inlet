import { assertD1, readJson } from '../_shared.js';
import {
  authorizeProject,
  fileBucket,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
  validateObjectKey,
} from './_files.js';
import { findProjectAssetUsage, projectAssetKind } from './_assetSafety.js';

const METHODS = 'DELETE, OPTIONS';

function pageUsageMessage(pages = []) {
  if (!pages.length) return '';
  const names = pages.slice(0, 3).map((page) => page.title || page.slug || '페이지').filter(Boolean);
  const suffix = pages.length > names.length ? ` 외 ${pages.length - names.length}개` : '';
  return `${names.join(', ')}${suffix}`;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'DELETE') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
      message: '허용되지 않는 요청 방식입니다.',
    }, METHODS);
  }

  try {
    const url = new URL(request.url);
    const body = await readJson(request);
    const project = projectFromRequest(url, body, request);
    await authorizeProject(request, env, project, {
      write: true,
      tab: 'edit',
      requireSignedSession: true,
    });

    const key = validateObjectKey(body.key || url.searchParams.get('key') || '');
    const kind = projectAssetKind(project, key);
    const allowRevisionReferences = body.allowRevisionReferences === true;
    const db = assertD1(env);
    const usage = await findProjectAssetUsage(db, project, key);

    if (usage.pages.length) {
      const usedIn = pageUsageMessage(usage.pages);
      return jsonResponse(request, env, 409, {
        ok: false,
        code: 'ASSET_IN_USE',
        error: '현재 페이지에서 사용 중인 미디어는 삭제할 수 없습니다.',
        message: usedIn
          ? `이 미디어는 ${usedIn}에서 사용 중이라 삭제할 수 없습니다.`
          : '현재 페이지에서 사용 중인 미디어는 삭제할 수 없습니다.',
        usage,
      }, METHODS);
    }

    if (usage.revisions.length && !allowRevisionReferences) {
      return jsonResponse(request, env, 409, {
        ok: false,
        code: 'ASSET_REVISION_REFERENCED',
        error: '이 미디어는 과거 버전 기록에서 사용 중입니다.',
        message: '이 미디어는 과거 버전 기록에서 사용 중입니다. 삭제하면 해당 버전을 복원할 때 이미지나 영상이 보이지 않을 수 있습니다.',
        usage,
      }, METHODS);
    }

    const bucket = fileBucket(env);
    if (typeof bucket.delete !== 'function') {
      const error = new Error('R2 미디어 삭제 기능을 사용할 수 없습니다.');
      error.status = 503;
      error.code = 'ASSET_DELETE_UNAVAILABLE';
      throw error;
    }

    const object = typeof bucket.head === 'function'
      ? await bucket.head(key)
      : await bucket.get(key);
    if (!object) {
      return jsonResponse(request, env, 404, {
        ok: false,
        code: 'ASSET_NOT_FOUND',
        error: '삭제할 미디어를 찾을 수 없습니다.',
        message: '삭제할 미디어를 찾을 수 없습니다.',
      }, METHODS);
    }

    await bucket.delete(key);
    return jsonResponse(request, env, 200, {
      ok: true,
      key,
      kind,
      deleted: true,
      revisionReferencesIgnored: allowRevisionReferences && usage.revisions.length > 0,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
