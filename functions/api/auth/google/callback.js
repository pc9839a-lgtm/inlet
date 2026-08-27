import { assertD1, handleApiError, jsonResponse, optionsResponse } from '../../_shared.js';
import { maybeHandleGoogleFormsOauthCallback } from '../../calltag/v1/_google-forms.js';
import { AUTH_METHODS, googleAuthRedirectUri, loginGoogleAccount } from '../_auth.js';

export async function onRequest({ request, env }) {
  if (request.method === 'OPTIONS') return optionsResponse(request, env, AUTH_METHODS);
  if (request.method !== 'GET') return jsonResponse(request, env, 405, { ok: false, error: 'Method not allowed.' }, AUTH_METHODS);
  try {
    const db = assertD1(env);
    const googleFormsResponse = await maybeHandleGoogleFormsOauthCallback(db, request, env);
    if (googleFormsResponse) return googleFormsResponse;

    const url = new URL(request.url);
    const result = await loginGoogleAccount({
      code: url.searchParams.get('code') || '',
      state: url.searchParams.get('state') || '',
      redirectUri: googleAuthRedirectUri(request, env),
    }, env);
    return googleAuthSuccessHtml(result);
  } catch (error) {
    return googleAuthFailureHtml(request, env, error);
  }
}

function googleAuthSuccessHtml(result = {}) {
  const authUser = {
    ...(result.user || {}),
    session: result.session || '',
    role: 'master',
    signedAt: new Date().toISOString(),
  };
  const next = safePath(result.next || '/');
  return new Response(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google 로그인 완료</title></head>
<body>
<script>
try {
  localStorage.setItem('inlet-auth-v1', ${JSON.stringify(JSON.stringify(authUser))});
  location.replace(${JSON.stringify(next)});
} catch (error) {
  location.replace('/');
}
</script>
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function googleAuthFailureHtml(request, env, error) {
  const message = String(error?.message || error || 'Google 로그인에 실패했습니다.');
  return new Response(`<!doctype html>
<html lang="ko">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Google 로그인 실패</title></head>
<body style="margin:0;background:#f3f6fb;font-family:Arial,'Malgun Gothic',sans-serif;color:#101828;display:grid;min-height:100vh;place-items:center;">
  <section style="width:min(440px,calc(100% - 32px));background:#fff;border:1px solid #dbe4f0;border-radius:24px;padding:28px;box-shadow:0 18px 50px rgba(15,23,42,.12);text-align:center;">
    <strong style="display:inline-block;padding:7px 12px;border-radius:999px;background:#eef4ff;color:#2563eb;font-size:13px;">페이지로</strong>
    <h1 style="margin:18px 0 8px;font-size:26px;">Google 로그인 실패</h1>
    <p style="margin:0 0 20px;color:#475569;font-size:14px;line-height:1.6;">${escapeHtml(message)}</p>
    <a href="/login" style="display:block;height:48px;line-height:48px;border-radius:14px;background:#111827;color:#fff;text-decoration:none;font-weight:900;">로그인으로 돌아가기</a>
  </section>
</body>
</html>`, {
    status: Number(error?.status || 400),
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      ...Object.fromEntries(Object.entries({}).filter(Boolean)),
    },
  });
}

function safePath(value = '/') {
  const path = String(value || '/').trim();
  if (!path || !path.startsWith('/') || path.startsWith('//') || /^\/api(?:\/|$)/.test(path)) return '/';
  return path;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
