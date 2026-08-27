import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../../_shared.js';
import { callSession } from '../../../../call/_shared.js';
import { getGoogleFormsOauthSession } from '../../_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  try {
    const db = assertD1(env);
    const session = await callSession(request, env, {});
    const id = new URL(request.url).searchParams.get('id') || '';
    return jsonResponse(request, env, 200, {
      ok: true,
      oauth: await getGoogleFormsOauthSession(db, session.ownerId, id),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
