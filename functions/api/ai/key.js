import { AI_METHODS, aiRouteError, deleteAiKey, jsonResponse, optionsResponse, readAiKeyStatus, readJson, saveAiKey } from './_ai.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AI_METHODS);
  try {
    const url = new URL(request.url);
    if (request.method === 'GET') {
      const key = await readAiKeyStatus(request, env, Object.fromEntries(url.searchParams));
      return jsonResponse(request, env, 200, { ok: true, key }, AI_METHODS);
    }
    if (request.method === 'PUT' || request.method === 'POST') {
      const key = await saveAiKey(request, env, await readJson(request));
      return jsonResponse(request, env, 200, { ok: true, key }, AI_METHODS);
    }
    if (request.method === 'DELETE') {
      const body = await readJson(request).catch(() => ({}));
      const key = await deleteAiKey(request, env, { ...Object.fromEntries(url.searchParams), ...(body || {}) });
      return jsonResponse(request, env, 200, { ok: true, key }, AI_METHODS);
    }
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AI_METHODS);
  } catch (error) {
    return aiRouteError(request, env, error);
  }
}
