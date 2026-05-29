import { getD1Lead, upsertD1Lead } from '../../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../_shared.js';

const METHODS = 'POST, OPTIONS';

function deliveryReport(status = 'none', summary = '알림 전송 설정 없음', logs = []) {
  return { status, summary, logs };
}

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, METHODS);

  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const project = projectFromRequest(new URL(request.url), input, request);
    await authorizeProject(request, env, project, { publicWrite: true });

    const id = String(params?.id || '').trim();
    const current = await getD1Lead(db, { projectId: project.projectId, id });
    if (!current) return jsonResponse(request, env, 404, { ok: false, error: 'Lead not found' }, METHODS);

    const delivery = deliveryReport();
    const saved = await upsertD1Lead(db, {
      ...current,
      delivery,
      deliveryStatus: delivery.status,
      updatedAt: new Date().toISOString(),
    }, {
      projectId: project.projectId,
      pageId: current.pageId || '',
      pageSlug: current.pageSlug || input.page?.slug || project.slug || '',
    });

    return jsonResponse(request, env, 200, { ok: true, lead: saved, delivery }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
