import { handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { googleAuthorizationUrl } from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const url = new URL(request.url);
    const destination = await googleAuthorizationUrl(env, {
      returnScheme: url.searchParams.get('return_scheme') || 'calltag',
    });
    return Response.redirect(destination, 302);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
