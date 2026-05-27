import { AI_METHODS, aiRouteError, classifyAiKeyTestError, jsonResponse, optionsResponse, readJson, resolveAiKey, testOpenAiKey, updateAiKeyTestStatus } from './_ai.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AI_METHODS);
  try {
    if (request.method !== 'POST') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AI_METHODS);
    const body = await readJson(request);
    const apiKey = await resolveAiKey(request, env, body || {});
    try {
      await testOpenAiKey(apiKey, body?.model || 'gpt-4.1');
      await updateAiKeyTestStatus(request, env, body || {}, { status: 'valid', message: 'AI key test succeeded.' }).catch(() => {});
      return jsonResponse(request, env, 200, { ok: true, keyTest: { status: 'valid', message: 'AI key test succeeded.' } }, AI_METHODS);
    } catch (error) {
      const keyTest = classifyAiKeyTestError(error);
      await updateAiKeyTestStatus(request, env, body || {}, keyTest).catch(() => {});
      error.details = { ...(error.details || {}), keyTest };
      throw error;
    }
  } catch (error) {
    return aiRouteError(request, env, error);
  }
}
