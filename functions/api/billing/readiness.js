import { handleApiError, jsonResponse, optionsResponse } from '../_shared.js';
import { CALL_METHODS, callSession } from '../call/_shared.js';
import { googlePlayBillingReadiness } from './_readiness.js';
import { webBillingReadiness } from './_webBilling.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, {
      ok: false,
      error: '허용되지 않는 요청 방식입니다.',
    }, CALL_METHODS);
  }
  try {
    await callSession(request, env);
    const googlePlay = googlePlayBillingReadiness(env);
    const web = webBillingReadiness(env);
    return jsonResponse(request, env, 200, {
      ok: true,
      serverNow: new Date().toISOString(),
      billingReadiness: {
        googlePlay,
        web: {
          ...web,
          message: web.available
            ? '웹 결제 서버 준비가 완료되었습니다.'
            : '웹 자동결제는 아직 활성화되지 않았습니다.',
        },
      },
    }, CALL_METHODS);
  } catch (error) {
    return handleApiError(request, env, error, CALL_METHODS);
  }
}
