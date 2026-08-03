import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../_shared.js';
import { consumeGoogleLoginTicket } from './_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, { ok: false, error: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const db = assertD1(env);
    const input = await readJson(request);
    const result = await consumeGoogleLoginTicket(db, input.ticket, env);
    return jsonResponse(request, env, 200, result, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
