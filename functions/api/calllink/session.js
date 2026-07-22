import {
  assertD1,
  handleApiError,
  jsonResponse,
  optionsResponse,
} from '../_shared.js';
import {
  channelConfig,
  projectConnectionPayload,
  requireCallLinkDevice,
  walletBalance,
} from './_shared.js';

const METHODS = 'GET, OPTIONS';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(request, env, 405, { ok: false, message: '허용되지 않는 요청 방식입니다.' }, METHODS);
  }
  try {
    const db = assertD1(env);
    const device = await requireCallLinkDevice(request, env);
    return jsonResponse(request, env, 200, {
      ok: true,
      device: {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
      },
      project: await projectConnectionPayload(db, device.projectId),
      channel: await channelConfig(db, device.projectId),
      wallet: await walletBalance(db, device.projectId),
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
