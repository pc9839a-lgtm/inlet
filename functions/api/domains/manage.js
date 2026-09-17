import { assertOwnedD1PageDomain } from '../../../server/pageDomainStore.mjs';
import {
  detachPageDomainConnection,
  verifyPageDomainConnection,
} from '../../../server/pageDomainOperations.mjs';
import {
  assertD1,
  authorizeProject,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
  readJson,
} from '../_shared.js';

const METHODS = 'POST, OPTIONS';

function actionError(message, status, code) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.details = { code };
  return error;
}

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    await authorizeProject(request, env, project, { write: true, tab: 'settings' });
    const db = assertD1(env);
    const pageId = String(body.pageId || '').trim();
    const action = String(body.action || 'verify').trim().toLowerCase();
    if (!['verify', 'detach'].includes(action)) {
      throw actionError('지원하지 않는 도메인 작업입니다.', 400, 'DOMAIN_ACTION_INVALID');
    }

    const record = await assertOwnedD1PageDomain(db, {
      projectId: project.projectId,
      pageId,
      hostname: body.hostname || body.customDomain || '',
    });

    if (action === 'detach') {
      const result = await detachPageDomainConnection({ db, env, pageId, record });
      return jsonResponse(request, env, 200, result, METHODS);
    }

    const result = await verifyPageDomainConnection({
      db,
      env,
      pageId,
      record,
      source: 'owner_manual',
    });
    return jsonResponse(request, env, 200, result, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
