import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../_shared.js';
import { pageroAccountStatus } from './_account.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, CALL_METHODS);
  }

  try {
    const db = assertD1(env);
    const session = await callSession(request, env, {});
    const connection = await pageroAccountStatus(db, session.ownerId);
    return jsonResponse(request, env, 200, { ok: true, connection }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
