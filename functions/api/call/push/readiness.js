import { jsonResponse, optionsResponse } from '../../_shared.js';
import { CALL_METHODS } from '../_shared.js';
import { firebaseConfigured } from './_shared.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, CALL_METHODS);
  if (request.method !== 'GET') {
    return jsonResponse(
      request,
      env,
      405,
      { ok: false, error: '허용되지 않는 요청 방식입니다.' },
      CALL_METHODS
    );
  }

  const firebase = {
    projectId: present(env?.FIREBASE_PROJECT_ID),
    clientEmail: present(env?.FIREBASE_CLIENT_EMAIL),
    privateKey: present(env?.FIREBASE_PRIVATE_KEY),
  };
  firebase.configured = firebaseConfigured(env);

  const d1 = {
    bound: !!env?.DB?.prepare,
    pushDevicesTable: false,
  };
  if (d1.bound) {
    try {
      const row = await env.DB.prepare(`
        SELECT name
        FROM sqlite_master
        WHERE type = 'table' AND name = 'calltag_push_devices'
        LIMIT 1
      `).first();
      d1.pushDevicesTable = String(row?.name || '') === 'calltag_push_devices';
    } catch {
      d1.pushDevicesTable = false;
    }
  }

  const ready = firebase.configured && d1.bound && d1.pushDevicesTable;
  const response = jsonResponse(
    request,
    env,
    200,
    {
      ok: true,
      ready,
      firebase,
      d1,
      checkedAt: new Date().toISOString(),
    },
    CALL_METHODS
  );
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

function present(value) {
  return String(value ?? '').trim().length > 0;
}
