import { jsonResponse, optionsResponse } from '../../_shared.js';
import { googleClientId } from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }

  const clientId = googleClientId(env);
  return jsonResponse(request, env, clientId ? 200 : 503, {
    ok: !!clientId,
    clientId,
    configured: !!clientId,
  }, METHODS);
}
