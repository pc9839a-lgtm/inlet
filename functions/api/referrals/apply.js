import { handleApiError, jsonResponse, optionsResponse, readJson } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'POST') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    const input = await readJson(request);
    await callSession(request, env, input);
    return jsonResponse(request, env, 409, {
      ok: false,
      error: '추천인 코드는 회원가입할 때만 입력할 수 있습니다.',
      code: 'REFERRAL_SIGNUP_ONLY',
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
