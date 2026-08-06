import { ApiError, apiFetch, postJson } from './apiClient.js';

function sessionHeaders(authUser = null) {
  const session = String(authUser?.session || '').trim();
  return session ? { 'X-Inlet-Session': session } : {};
}

async function readError(response, fallback) {
  const text = await response.text().catch(() => '');
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    return data?.message || data?.error || fallback;
  } catch {
    return text || fallback;
  }
}

export async function fetchAccountFinance(authUser = null) {
  if (!authUser?.session) throw new ApiError('로그인이 필요합니다.', 401);
  const response = await apiFetch('/api/account-finance', {
    cache: 'no-store',
    headers: {
      ...sessionHeaders(authUser),
      'Cache-Control': 'no-store',
    },
  });
  if (!response.ok) throw new ApiError(await readError(response, '결제 정보를 불러오지 못했습니다.'), response.status);
  const data = await response.json();
  return data?.finance || null;
}

export async function applyAccountReferralCode(authUser = null, code = '') {
  const data = await postJson('/api/account-finance', {
    action: 'apply-referral',
    code,
  }, {
    headers: sessionHeaders(authUser),
  });
  return data?.finance || null;
}

export async function createAccountCheckout(authUser = null, service = '', planCode = '') {
  const data = await postJson('/api/account-finance', {
    action: 'create-checkout',
    service,
    planCode,
  }, {
    headers: sessionHeaders(authUser),
  });
  return String(data?.checkoutUrl || '');
}
