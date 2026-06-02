import { jsonResponse, optionsResponse, readJson } from '../_shared.js';

const METHODS = 'POST, OPTIONS';

export async function onRequestOptions({ request, env }) {
  return optionsResponse(request, env, METHODS);
}

export async function onRequestPost({ request, env }) {
  try {
    const body = await readJson(request);
    const type = String(body.type || '').trim();
    if (type !== 'sheets') {
      return jsonResponse(request, env, 400, { ok: false, error: '지원하지 않는 연동 테스트입니다.' }, METHODS);
    }

    const url = String(body.url || body.webhookUrl || '').trim();
    if (!isGoogleAppsScriptUrl(url)) {
      return jsonResponse(request, env, 400, { ok: false, error: 'Google Apps Script 배포 URL(/exec)을 입력해주세요.' }, METHODS);
    }

    const payload = body.payload && typeof body.payload === 'object' ? body.payload : sampleSheetsPayload(body);
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return jsonResponse(request, env, 502, {
        ok: false,
        status: response.status,
        error: googleScriptErrorMessage(response.status, text),
      }, METHODS);
    }

    return jsonResponse(request, env, 200, {
      ok: true,
      status: response.status,
      message: 'Google Sheets 테스트 요청을 보냈습니다. 시트를 확인해주세요.',
      body: text.slice(0, 500),
    }, METHODS);
  } catch (error) {
    return jsonResponse(request, env, error?.status || 500, {
      ok: false,
      error: String(error?.message || error),
    }, METHODS);
  }
}

function isGoogleAppsScriptUrl(value = '') {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com' && /\/macros\/s\/.+\/exec$/.test(url.pathname);
  } catch {
    return false;
  }
}

function sampleSheetsPayload(body = {}) {
  const now = new Date().toISOString();
  return {
    schemaVersion: 'pagero.lead.v1',
    event: 'lead.test',
    source: 'pagero',
    target: 'google_sheets',
    provider: 'google_sheets',
    mode: 'webhook',
    sheetName: body.sheetName || '접수함',
    lead: {
      id: `test-${Date.now()}`,
      name: '연동 테스트',
      phone: '010-0000-0000',
      email: '',
      message: 'Google Sheets 연동 테스트',
      createdAt: now,
      fields: { 테스트: '성공 확인용' },
    },
    page: body.page || { title: '페이지로 테스트', slug: '', url: '' },
    project: body.project || {},
    attribution: {},
    createdAt: now,
  };
}

function googleScriptErrorMessage(status, text = '') {
  if (status === 401 || status === 403) return 'Apps Script 접근 권한을 확인해주세요. 웹 앱은 사용자 액세스 권한으로 배포되어야 합니다.';
  if (/not found|404/i.test(text)) return 'Apps Script 배포 URL이 잘못되었습니다. /exec URL을 다시 복사해주세요.';
  return `Google Apps Script 응답 실패: ${status}`;
}
