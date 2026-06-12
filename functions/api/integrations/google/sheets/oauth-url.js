import { assertD1, authorizeProject, handleApiError, jsonResponse, optionsResponse, projectFromRequest, readJson } from '../../../_shared.js';
import { googleClientId, googleClientSecret, googleRedirectUri, googleSheetsAuthUrl, signedOAuthState } from './_oauth.js';

const METHODS = 'POST, OPTIONS';

export async function onRequestOptions({ request, env }) {
  return optionsResponse(request, env, METHODS);
}

export async function onRequestPost({ request, env }) {
  try {
    assertD1(env);
    const body = await readJson(request);
    const project = projectFromRequest(new URL(request.url), body, request);
    const projectId = String(project.projectId || body.projectId || body.project?.projectId || body.project?.id || '').trim();
    if (!projectId) {
      const error = new Error('프로젝트 정보가 필요합니다.');
      error.status = 400;
      throw error;
    }
    await authorizeProject(request, env, { ...project, projectId }, { write: true, tab: 'inbox' });

    const clientId = googleClientId(env);
    const clientSecret = googleClientSecret(env);
    if (!clientId || !clientSecret) {
      return jsonResponse(request, env, 503, {
        ok: false,
        status: 'not_configured',
        message: 'Google OAuth 설정이 필요합니다.',
        required: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
      }, METHODS);
    }

    const redirectUri = googleRedirectUri(request, env);
    const state = await signedOAuthState({
      projectId,
      ownerId: String(project.ownerId || body.ownerId || body.project?.ownerId || ''),
      slug: String(project.slug || body.slug || body.project?.slug || ''),
      sheetHeaders: normalizeSheetHeaders(body.sheetHeaders),
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

function normalizeSheetHeaders(headers = []) {
  if (!Array.isArray(headers)) return [];
  const seen = new Set();
  const normalized = [];
  for (const raw of headers) {
    const header = String(raw || '').trim();
    if (!header || seen.has(header)) continue;
    seen.add(header);
    normalized.push(header);
    if (normalized.length >= 40) break;
  }
  return normalized;
}
