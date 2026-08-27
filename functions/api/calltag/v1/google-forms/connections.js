import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../_shared.js';
import { callSession } from '../../../call/_shared.js';
import { listGoogleFormsConnections, readJsonLimited, revokeGoogleFormsConnection } from '../_shared.js';

const METHODS = 'GET, PATCH, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  try {
    const db = assertD1(env);
    if (request.method === 'GET') {
      const session = await callSession(request, env, {});
      return jsonResponse(request, env, 200, {
        ok: true,
        connections: await listGoogleFormsConnections(db, session.ownerId),
      }, METHODS);
    }
    if (request.method === 'PATCH') {
      const body = await readJsonLimited(request, 8192);
      const session = await callSession(request, env, body || {});
      if (String(body?.action || '').toLowerCase() !== 'revoke') {
        return jsonResponse(request, env, 400, { ok: false, error: '지원하지 않는 작업입니다.' }, METHODS);
      }
      const result = await revokeGoogleFormsConnection(db, session.ownerId, body?.connectionId || '');
      return jsonResponse(request, env, 200, { ok: true, ...result }, METHODS);
    }
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
