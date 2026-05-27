import { AI_METHODS, aiRouteError, generateAiDraft, jsonResponse, optionsResponse, readJson, resolveAiKey } from './_ai.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AI_METHODS);
  try {
    if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AI_METHODS);
    const body = await readJson(request);
    const apiKey = await resolveAiKey(request, env, body || {});
    const draft = await generateAiDraft(body?.input || {}, body?.model || 'gpt-4.1', apiKey);
    return jsonResponse(request, env, 200, { ok: true, draft }, AI_METHODS);
  } catch (error) {
    return aiRouteError(request, env, error);
  }
}
