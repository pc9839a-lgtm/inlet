import { assertD1, handleApiError, jsonResponse, optionsResponse, readJson } from '../../../_shared.js';
import { googleClientId, googleRedirectUri, googleSheetsAuthUrl, signedOAuthState } from './_oauth.js';

const METHODS = 'POST, OPTIONS';

export async function onRequestOptions({ request, env }) {
  return optionsResponse(request, env, METHODS);
}

export async function onRequestPost({ request, env }) {
  try {
    assertD1(env);
    const body = await readJson(request);
    const projectId = String(body.projectId || body.project?.projectId || body.project?.id || '').trim();
    if (!projectId) {
      const error = new Error('프로젝트 정보가 필요합니다.');
      error.status = 400;
      throw error;
    }

    const clientId = googleClientId(env);
    if (!clientId) {
      return jsonResponse(request, env, 503, {
        ok: false,
        status: 'not_configured',
        message: 'Google OAuth 클라이언트 설정이 필요합니다.',
        required: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET'],
      }, METHODS);
    }

    const redirectUri = googleRedirectUri(request, env);
    const state = await signedOAuthState({
      projectId,
      ownerId: String(body.ownerId || body.project?.ownerId || ''),
      slug: String(body.slug || body.project?.slug || ''),
    }, env);

    return jsonResponse(request, env, 200, {
      ok: true,
      provider: 'google_sheets',
      mode: 'oauth',
      authUrl: googleSheetsAuthUrl({ clientId, redirectUri, state }),
      redirectUri,
    }, METHODS);
  } catch (error) {
    return handleApiError(request, env, error, METHODS);
  }
}
