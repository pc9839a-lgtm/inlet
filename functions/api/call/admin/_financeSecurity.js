import { callError } from '../_shared.js';
import { adminJson, requireCalltagAdmin } from './_security.js';

const ALLOWED_ORIGIN = 'https://calltag.pagero.kr';

function csv(value = '') {
  return String(value || '').split(',').map((item) => item.trim()).filter(Boolean).slice(0, 50);
}

function normalizeEmail(value = '') {
  return String(value || '').trim().toLowerCase().slice(0, 254);
}

export async function requireCalltagFinanceAdmin(request, env = {}, expectedAction = '') {
  const identity = await requireCalltagAdmin(request, env);
  const allowedOwnerIds = new Set(csv(env.CALLTAG_ADMIN_FINANCE_OWNER_IDS || ''));
  const allowedEmails = new Set(csv(env.CALLTAG_ADMIN_FINANCE_EMAILS || '').map(normalizeEmail).filter(Boolean));
  if (!allowedOwnerIds.size && !allowedEmails.size) {
    throw callError('정산 관리자 권한이 설정되지 않았습니다.', 503, { code: 'CALLTAG_ADMIN_FINANCE_CONFIG_REQUIRED' });
  }
  if (!allowedOwnerIds.has(identity.ownerId) && !allowedEmails.has(normalizeEmail(identity.email))) {
    throw callError('정산 변경 권한이 없습니다.', 403, { code: 'CALLTAG_ADMIN_FINANCE_FORBIDDEN' });
  }

  const action = String(request.headers.get('x-calltag-admin-action') || '').trim();
  if (!expectedAction || action !== expectedAction) {
    throw callError('정산 변경 요청을 확인할 수 없습니다.', 403, { code: 'CALLTAG_ADMIN_ACTION_REQUIRED' });
  }
  const origin = String(request.headers.get('origin') || '').trim().replace(/\/+$/, '');
  if (origin && origin !== ALLOWED_ORIGIN) {
    throw callError('허용되지 않은 관리자 요청입니다.', 403, { code: 'CALLTAG_ADMIN_ORIGIN_FORBIDDEN' });
  }
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    throw callError('JSON 요청만 허용됩니다.', 415, { code: 'CALLTAG_ADMIN_JSON_REQUIRED' });
  }
  return identity;
}

export function financeOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      allow: 'POST, OPTIONS',
      'cache-control': 'no-store, max-age=0',
      'x-content-type-options': 'nosniff',
    },
  });
}

export function methodNotAllowed() {
  return adminJson(405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' });
}

export async function readJsonBody(request, maxBytes = 4096) {
  const text = await request.text();
  if (!text || text.length > maxBytes) {
    throw callError('요청 데이터가 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_BODY_INVALID' });
  }
  try {
    const value = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    throw callError('요청 데이터가 올바르지 않습니다.', 400, { code: 'CALLTAG_ADMIN_BODY_INVALID' });
  }
}
