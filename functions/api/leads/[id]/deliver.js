import { getD1Lead, getD1PageBySlug, upsertD1Lead } from '../../../../server/storage/d1Adapter.mjs';
import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../_shared.js';
import { NO_DELIVERY_SETTINGS_MESSAGE, normalizeDeliveryPage, sendLeadDelivery } from '../_delivery.js';

const METHODS = 'POST, OPTIONS';
const TERMINAL_DELIVERY_STATUSES = new Set(['success', 'partial']);

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.', message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const project = projectFromRequest(new URL(request.url), input, request);
    await authorizeProject(request, env, project, { publicWrite: true });

    const id = String(params?.id || '').trim();
    const current = await getD1Lead(db, { projectId: project.projectId, id });
    if (!current) {
      return jsonResponse(request, env, 404, { ok: false, error: '접수를 찾을 수 없습니다.', message: '접수를 찾을 수 없습니다.' }, METHODS);
    }

    if (TERMINAL_DELIVERY_STATUSES.has(String(current.delivery?.status || current.deliveryStatus || ''))) {
      return jsonResponse(request, env, 200, { ok: true, lead: current, delivery: current.delivery || { status: 'none', summary: NO_DELIVERY_SETTINGS_MESSAGE, logs: [] } }, METHODS);
    }

    const storedPage = await getD1PageBySlug(db, {
      projectId: project.projectId,
      slug: input.page?.slug || current.pageSlug || project.slug || '',
    });
    const deliveryPage = normalizeDeliveryPage(input.page || {}, storedPage || {}, project);
    const delivery = await sendLeadDelivery(current, deliveryPage, env);
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
