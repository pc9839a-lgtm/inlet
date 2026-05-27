import { AI_METHODS, aiRouteError, jsonResponse, optionsResponse, removeAiDraft } from '../_ai.js';

export async function onRequest({ request, env, params }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AI_METHODS);
  try {
    if (request.method !== 'DELETE') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AI_METHODS);
    const id = params.id || '';
    const result = await removeAiDraft(request, env, decodeURIComponent(id));
    return jsonResponse(request, env, 200, { ok: true, ...result }, AI_METHODS);
  } catch (error) {
    return aiRouteError(request, env, error);
  }
}
