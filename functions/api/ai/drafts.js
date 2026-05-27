import { AI_METHODS, aiRouteError, jsonResponse, listAiDrafts, optionsResponse, readJson, saveAiDraft } from './_ai.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AI_METHODS);
  try {
    if (request.method === 'GET') {
      const drafts = await listAiDrafts(request, env);
      return jsonResponse(request, env, 200, { ok: true, drafts }, AI_METHODS);
    }
    if (request.method === 'POST') {
      const draft = await saveAiDraft(request, env, await readJson(request));
      return jsonResponse(request, env, 200, { ok: true, draft }, AI_METHODS);
    }
    return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AI_METHODS);
  } catch (error) {
    return aiRouteError(request, env, error);
  }
}
