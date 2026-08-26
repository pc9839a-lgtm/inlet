import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../../../_shared.js';
import { callSession } from '../../../../call/_shared.js';
import { completeMetaOauthSession, readJsonLimited } from '../../_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const db = assertD1(env);
    const body = await readJsonLimited(request, 32768);
    const session = await callSession(request, env, body || {});
    const oauthSessionId = String(body?.sessionId || body?.id || '').trim();

    if (oauthSessionId) {
      const oauth = await db.prepare(`
        SELECT requested_scopes_json, granted_scopes_json
        FROM calltag_meta_oauth_sessions
        WHERE id = ? AND owner_id = ?
        LIMIT 1
      `).bind(oauthSessionId, session.ownerId).first();
      if (oauth) {
        const requestedScopes = parseScopeArray(oauth.requested_scopes_json);
        const grantedScopes = new Set(parseScopeArray(oauth.granted_scopes_json));
        const missingScopes = requestedScopes.filter((scope) => !grantedScopes.has(scope));
        if (missingScopes.length) {
          const error = new Error('필요한 Meta 권한이 승인되지 않았습니다. Meta 연결을 다시 시도해주세요.');
          error.status = 409;
          error.code = 'CALLTAG_META_OAUTH_SCOPE_MISSING';
          error.details = { code: error.code, missingScopes };
          throw error;
        }
      }
    }

    const result = await completeMetaOauthSession(
      db,
      session.ownerId,
      oauthSessionId,
      body?.pageIds || [],
      env,
    );
    return jsonResponse(request, env, 200, { ok: true, ...result }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}

function parseScopeArray(value) {
  try {
    const parsed = Array.isArray(value) ? value : JSON.parse(String(value || '[]'));
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed
      .map((scope) => String(scope || '').trim())
      .filter((scope) => /^[a-z0-9_]{2,80}$/i.test(scope))))
      .slice(0, 100);
  } catch {
    return [];
  }
}
