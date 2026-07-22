import {
  assertD1,
  authorizeProject,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
} from '../_shared.js';
import {
  requireCallLinkDevice,
  solapiRequest,
  walletBalance,
} from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const db = assertD1(env);
    const authorization = String(request.headers.get('Authorization') || '').trim();
    let projectId = '';
    if (authorization.toLowerCase().startsWith('bearer cl_')) {
      const device = await requireCallLinkDevice(request, env);
      projectId = device.projectId;
    } else {
      const project = projectFromRequest(new URL(request.url), {}, request);
      await authorizeProject(request, env, project, { write: false, tab: 'settings' });
      projectId = project.projectId;
    }
    const wallet = await walletBalance(db, projectId);
    let provider = null;
    let providerAvailable = true;
    try {
      const result = await solapiRequest(env, '/cash/v1/balance', { method: 'GET' });
      provider = {
        balance: Number(result?.balance || 0),
        point: Number(result?.point || 0),
        autoRecharge: !!result?.autoRecharge,
        minimumCash: Number(result?.minimumCash || 0),
      };
    } catch (error) {
      if (String(error?.message || '').includes('CALLLINK_SOLAPI_NOT_CONFIGURED')) {
        providerAvailable = false;
      } else {
        throw error;
      }
    }
    return jsonResponse(request, env, 200, {
      ok: true,
      wallet,
      providerAvailable,
      provider,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
