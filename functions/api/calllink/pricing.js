import {
  authorizeProject,
  handleApiError,
  jsonResponse,
  optionsResponse,
  projectFromRequest,
} from '../_shared.js';
import { requireCallLinkDevice } from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const authorization = String(request.headers.get('Authorization') || '').trim();
    if (authorization.toLowerCase().startsWith('bearer cl_')) {
      await requireCallLinkDevice(request, env);
    } else {
      const project = projectFromRequest(new URL(request.url), {}, request);
      await authorizeProject(request, env, project, { write: false, tab: 'settings' });
    }
    return jsonResponse(request, env, 200, {
      ok: true,
      currency: 'KRW',
      prices: {
        sms: Number(env.CALLLINK_SMS_PRICE || 18),
        lms: Number(env.CALLLINK_LMS_PRICE || 45),
        mms: Number(env.CALLLINK_MMS_PRICE || 110),
        alimtalk: Number(env.CALLLINK_ALIMTALK_PRICE || 13),
      },
      note: '실제 청구금액은 메시지 유형과 대체발송 결과에 따라 달라질 수 있습니다.',
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
