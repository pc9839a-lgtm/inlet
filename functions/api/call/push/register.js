import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { CALL_METHODS, callSession } from '../_shared.js';
import { registerPushDevice } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, CALL_METHODS);
  }
  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const session = await callSession(request, env, input);
    const push = await registerPushDevice(db, session.ownerId, {
      deviceId: input.deviceId,
      token: input.token,
      appVersion: input.appVersion,
      env,
    });
    return jsonResponse(request, env, 200, { ok: true, push }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
