import { assertD1 } from '../../../_shared.js';
import {
  createGoogleSpreadsheet,
  exchangeGoogleOAuthCode,
  fetchGoogleProfile,
  googleClientId,
  googleClientSecret,
  googleRedirectUri,
  saveGoogleSheetsIntegration,
  verifyOAuthState,
} from './_oauth.js';

export async function onRequestGet({ request, env }) {
  try {
    assertD1(env);
    const url = new URL(request.url);
    const code = String(url.searchParams.get('code') || '').trim();
    const state = String(url.searchParams.get('state') || '').trim();
    const payload = await verifyOAuthState(state, env);
    if (!code || !payload?.projectId) return html('Google 연결 실패', '연결 정보가 올바르지 않습니다.');

    const clientId = googleClientId(env);
    const clientSecret = googleClientSecret(env);
    if (!clientId || !clientSecret) return html('Google 연결 실패', 'Google OAuth 설정이 필요합니다.');

    const tokens = await exchangeGoogleOAuthCode({
      code,
      clientId,
      clientSecret,
      redirectUri: googleRedirectUri(request, env),
    });
    const profile = await fetchGoogleProfile(tokens.access_token || '');
    const sheetName = '접수함';
    const spreadsheet = await createGoogleSpreadsheet(tokens.access_token || '', {
      title: `Pagero 접수함 - ${payload.slug || payload.projectId}`,
      sheetName,
    });

    await saveGoogleSheetsIntegration(env.DB, {
      projectId: payload.projectId,
      connectedEmail: profile.email || '',
      externalId: spreadsheet.spreadsheetId || '',
      settings: {
        slug: payload.slug || '',
        ownerId: payload.ownerId || '',
        googleUserId: profile.sub || '',
        spreadsheetId: spreadsheet.spreadsheetId || '',
        spreadsheetUrl: spreadsheet.spreadsheetUrl || '',
        sheetName,
      },
      tokens: {
        accessToken: tokens.access_token || '',
        refreshToken: tokens.refresh_token || '',
        expiresIn: tokens.expires_in || 0,
        tokenType: tokens.token_type || '',
        scope: tokens.scope || '',
        savedAt: new Date().toISOString(),
      },
    });

    return html('Google Sheets 연결 완료', '첫 접수가 들어오면 입력폼 항목대로 시트 컬럼이 자동 생성됩니다.', { projectId: payload.projectId });
  } catch (error) {
    return html('Google 연결 실패', String(error?.message || error || '잠시 후 다시 시도해주세요.'));
  }
}

function html(title = '', message = '', payload = null) {
  const completeScript = payload?.projectId ? `
  <script>
    try {
      if (window.opener) {
        window.opener.postMessage({ type: 'pagero:google-sheets-connected', projectId: ${JSON.stringify(String(payload.projectId || ''))} }, '*');
      }
      window.setTimeout(function(){ window.close(); }, 900);
    } catch (_) {}
  </script>` : '';
  return new Response(`<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f6fb;font-family:Arial,'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#111827;">
  <main style="width:min(440px,calc(100vw - 32px));padding:32px;border-radius:24px;background:#fff;border:1px solid #dbe4f0;box-shadow:0 18px 50px rgba(15,23,42,.10);text-align:center;">
    <strong style="display:inline-block;padding:8px 12px;border-radius:999px;background:#eef4ff;color:#2563eb;font-size:13px;">페이지로</strong>
    <h1 style="margin:18px 0 10px;font-size:26px;line-height:1.25;">${escapeHtml(title)}</h1>
    <p style="margin:0;color:#64748b;font-size:14px;line-height:1.7;">${escapeHtml(message)}</p>
    <button type="button" onclick="window.close()" style="margin-top:24px;width:100%;height:48px;border:0;border-radius:14px;background:#111827;color:#fff;font-weight:900;">닫기</button>
  </main>
  ${completeScript}
</body>
</html>`, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
